// ============================================================
// @bioagent/workflow — WorkflowEngine
// ============================================================

import { randomUUID } from "node:crypto";
import type { SkillExecutor, SkillResult } from "@bioagent/skills";
import type { ContainerManager } from "@bioagent/executor";
import { WorkflowRegistry } from "./registry";
import { CheckpointManager } from "./checkpoint";
import { WorkflowScheduler } from "./scheduler";
import { evaluateCondition } from "./condition";
import { applyErrorPolicy } from "./error-policy";
import type {
  WorkflowDef,
  WorkflowNode,
  WorkflowState,
  NodeState,
  ErrorPolicy,
  CheckpointData,
} from "./engine.types";

/**
 * 工作流引擎。
 *
 * 核心职责：
 * - 启动工作流
 * - 检查点恢复和断点续跑
 * - 节点调度和并行执行
 * - 条件分支评估
 * - 错误处理和重试策略
 * - 资源估算
 */
export class WorkflowEngine {
  private scheduler = new WorkflowScheduler();

  constructor(
    private registry: WorkflowRegistry,
    private skillExecutor: SkillExecutor,
    private checkpointMgr: CheckpointManager,
    private logger?: {
      info: (msg: string | Record<string, unknown>, ...args: unknown[]) => void;
      warn: (msg: string | Record<string, unknown>, ...args: unknown[]) => void;
      error: (msg: string | Record<string, unknown>, ...args: unknown[]) => void;
    },
  ) {}

  /**
   * 启动工作流。
   *
   * 1. 查找工作流定义
   * 2. 创建运行时状态
   * 3. 保存初始检查点
   * 4. 开始执行循环
   *
   * @param config - 启动配置
   * @returns runId
   */
  async start(config: {
    workflowName: string;
    projectId: string;
    dataPath: string;
    container: string;
    paramOverrides?: Record<string, any>;
  }): Promise<string> {
    const workflow = this.registry.get(config.workflowName);
    if (!workflow) {
      throw new Error(
        `Unknown workflow: "${config.workflowName}". Available: ${this.registry.listNames().join(", ")}`,
      );
    }

    const runId = randomUUID();

    // 创建初始节点状态
    const nodeStates = new Map<string, NodeState>();
    for (const node of workflow.nodes) {
      nodeStates.set(node.id, {
        nodeId: node.id,
        skill: node.skill,
        status: "pending",
        startedAt: null,
        endedAt: null,
        retryCount: 0,
        result: null,
        error: null,
      });
    }

    const state: WorkflowState = {
      runId,
      workflowName: workflow.name,
      status: "running",
      projectId: config.projectId,
      container: config.container,
      dataPath: config.dataPath,
      nodeStates,
      currentNodes: [],
      completedNodes: [],
      failedNodes: [],
      skippedNodes: [],
      totalNodes: workflow.nodes.length,
      progress: 0,
      results: new Map(),
      startedAt: new Date().toISOString(),
      completedAt: null,
      intermediateData: config.paramOverrides ?? {},
      userDecisions: {},
    };

    // 保存初始检查点
    await this.saveCheckpoint(state, workflow);

    this.logger?.info({
      msg: `Workflow "${workflow.name}" started`,
      runId,
      projectId: config.projectId,
      totalNodes: workflow.nodes.length,
    });

    // 开始执行循环（异步，不等待完成）
    this.executeLoop(state, workflow).catch((err) => {
      this.logger?.error({
        msg: `Workflow "${workflow.name}" execution loop errored`,
        runId,
        error: String(err),
      });
    });

    return runId;
  }

  /**
   * 恢复暂停的工作流。
   *
   * 从检查点加载状态并继续执行。
   *
   * @param runId - 运行 ID
   * @param userDecisions - 用户决策记录
   */
  async resume(
    runId: string,
    userDecisions?: Record<string, string>,
  ): Promise<void> {
    // 从检查点查找
    const checkpoints = await this.checkpointMgr.list("");
    const checkpoint = checkpoints.find((cp) => cp.runId === runId);

    if (!checkpoint) {
      throw new Error(
        `No checkpoint found for runId: "${runId}". Cannot resume.`,
      );
    }

    const workflow = this.registry.get(checkpoint.workflowName);
    if (!workflow) {
      throw new Error(
        `Workflow "${checkpoint.workflowName}" is not registered. Cannot resume.`,
      );
    }

    // 恢复状态
    const state = await this.checkpointMgr.restore(checkpoint);

    // 应用用户决策
    if (userDecisions) {
      state.userDecisions = { ...state.userDecisions, ...userDecisions };
    }

    // 将暂停的节点恢复为 pending
    for (const [nodeId, nodeState] of state.nodeStates) {
      if (nodeState.status === "paused") {
        nodeState.status = "pending";
      }
    }

    state.status = "running";
    state.currentNodes = [];

    this.logger?.info({
      msg: `Workflow "${workflow.name}" resumed`,
      runId,
      completedNodes: state.completedNodes.length,
      totalNodes: state.totalNodes,
    });

    // 继续执行循环
    this.executeLoop(state, workflow).catch((err) => {
      this.logger?.error({
        msg: `Workflow "${workflow.name}" execution loop errored after resume`,
        runId,
        error: String(err),
      });
    });
  }

  /**
   * 暂停工作流。
   *
   * 将状态设为 paused 并保存检查点。
   *
   * @param runId - 运行 ID
   */
  async pause(runId: string): Promise<void> {
    // 通过检查点查找状态（简化实现：从最近的检查点推断）
    const state = await this.findActiveState(runId);
    if (!state) {
      throw new Error(`No active workflow found for runId: "${runId}".`);
    }

    state.status = "paused";

    const workflow = this.registry.get(state.workflowName);
    if (workflow) {
      await this.saveCheckpoint(state, workflow);
    }

    this.logger?.info({
      msg: `Workflow "${state.workflowName}" paused`,
      runId,
    });
  }

  /**
   * 中止工作流。
   *
   * @param runId - 运行 ID
   * @param reason - 中止原因
   */
  async abort(runId: string, reason: string): Promise<void> {
    const state = await this.findActiveState(runId);
    if (!state) {
      throw new Error(`No active workflow found for runId: "${runId}".`);
    }

    state.status = "aborted";
    state.abortReason = reason;
    state.completedAt = new Date().toISOString();

    const workflow = this.registry.get(state.workflowName);
    if (workflow) {
      await this.saveCheckpoint(state, workflow);
    }

    this.logger?.info({
      msg: `Workflow "${state.workflowName}" aborted`,
      runId,
      reason,
    });
  }

  /**
   * 获取工作流状态。
   *
   * @param runId - 运行 ID
   * @returns 工作流状态
   */
  async getState(runId: string): Promise<WorkflowState> {
    const state = await this.findActiveState(runId);
    if (!state) {
      throw new Error(`No workflow found for runId: "${runId}".`);
    }
    return state;
  }

  /**
   * 资源估算。
   *
   * 根据工作流定义和输入数据路径估算资源需求。
   *
   * @param workflowName - 工作流名称
   * @param dataPath - 数据路径
   * @returns 资源估算结果
   */
  async estimate(
    workflowName: string,
    dataPath: string,
  ): Promise<{
    totalTimeMinutes: { min: number; max: number };
    totalDiskGB: number;
    peakRAMGB: number;
    recommendedCPUCores: number;
    gpuRecommended: boolean;
  }> {
    const workflow = this.registry.get(workflowName);
    if (!workflow) {
      throw new Error(`Unknown workflow: "${workflowName}".`);
    }

    // 从 resourceEstimate 解析估算值
    const estimate = workflow.resourceEstimate;

    // 解析时间范围
    let timeMin = 120;
    let timeMax = 480;

    const timeMatch = estimate.time.match(/(\d+)-(\d+)\s*hours/);
    if (timeMatch) {
      timeMin = parseInt(timeMatch[1], 10) * 60;
      timeMax = parseInt(timeMatch[2], 10) * 60;
    }

    // 解析 CPU
    let cpuCores = 8;
    const cpuMatch = estimate.cpu.match(/(\d+)-(\d+)\s*cores/);
    if (cpuMatch) {
      cpuCores = parseInt(cpuMatch[2], 10);
    }

    // 解析 RAM
    let peakRAM = 32;
    const ramMatch = estimate.ram.match(/(\d+)-(\d+)GB/);
    if (ramMatch) {
      peakRAM = parseInt(ramMatch[2], 10);
    }

    // 解析 Disk
    let diskGB = 50;
    const diskMatch = estimate.disk.match(/(\d+)-(\d+)GB/);
    if (diskMatch) {
      diskGB = parseInt(diskMatch[2], 10);
    }

    return {
      totalTimeMinutes: { min: timeMin, max: timeMax },
      totalDiskGB: diskGB,
      peakRAMGB: peakRAM,
      recommendedCPUCores: cpuCores,
      gpuRecommended: estimate.gpu !== "not_needed",
    };
  }

  // -------------------------------------------------------------------------
  // 私有方法 — 执行循环
  // -------------------------------------------------------------------------

  /**
   * 主执行循环。
   *
   * while running:
   *   1. scheduler.getReadyNodes() — 获取依赖满足的节点
   *   2. 如果没有就绪节点且没有运行中的节点 → 完成
   *   3. 对每个就绪节点并行执行
   *   4. 检测条件分支，决定跳过/执行
   *   5. 错误处理（重试/跳过/暂停/中止）
   */
  private async executeLoop(
    state: WorkflowState,
    workflow: WorkflowDef,
  ): Promise<void> {
    try {
      while (state.status === "running") {
        // 1. 获取就绪节点
        const readyNodes = this.scheduler.getReadyNodes(
          workflow.nodes,
          state.nodeStates,
        );

        // 2. 如果没有就绪节点
        if (readyNodes.length === 0) {
          // 检查是否有正在运行的节点
          const runningCount = state.currentNodes.length;

          if (runningCount === 0) {
            // 所有节点都已处理完毕
            await this.finishWorkflow(state, workflow);
            return;
          }

          // 等待一段时间后再检查
          await this.delay(1000);
          continue;
        }

        // 3. 处理每个就绪节点
        for (const node of readyNodes) {
          if (state.status !== "running") break;

          // 标记节点为运行中
          const nodeState = state.nodeStates.get(node.id)!;
          nodeState.status = "running";
          nodeState.startedAt = new Date().toISOString();
          state.currentNodes.push(node.id);

          try {
            // 检查条件分支
            const conditionResult = this.evaluateNodeCondition(
              node,
              state,
            );

            if (conditionResult === "skip") {
              this.skipNode(node, state, "Condition evaluation resulted in skip");
              continue;
            }

            if (conditionResult === "ask_user") {
              this.pauseNode(node, state, node.condition?.message ?? "User confirmation required");
              continue;
            }

            // 检查是否为条件检查节点
            if (node.skill === "__conditional__") {
              // 条件检查节点：只评估条件，不执行技能
              // 条件满足则标记完成，否则跳过
              const condPassed = this.evaluateUserCondition(
                node,
                state,
              );

              if (condPassed) {
                this.completeNode(
                  node,
                  state,
                  this.createEmptyResult(node.skill),
                );
              } else {
                this.skipNode(
                  node,
                  state,
                  "Conditional node: condition not met",
                );
              }
              continue;
            }

            // 执行节点
            await this.executeNode(node, state, workflow);

            // 检查是否有 pauseAfter 标志
            if (node.pauseAfter && state.status === "running") {
              this.pauseNode(
                node,
                state,
                `Node "${node.id}" completed. Workflow paused for confirmation.`,
              );
              await this.saveCheckpoint(state, workflow);
              return; // 暂停执行循环
            }
          } catch (error) {
            const err =
              error instanceof Error ? error : new Error(String(error));

            // 错误处理
            await this.handleNodeError(node, err, state, workflow.errorPolicy);
          }
        }

        // 保存检查点（定期保存）
        await this.saveCheckpoint(state, workflow);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger?.error({
        msg: `Workflow "${workflow.name}" execution loop crashed`,
        runId: state.runId,
        error: err.message,
      });

      state.status = "failed";
      state.completedAt = new Date().toISOString();
      await this.saveCheckpoint(state, workflow);
    }
  }

  /**
   * 执行单个节点。
   */
  private async executeNode(
    node: WorkflowNode,
    state: WorkflowState,
    workflow: WorkflowDef,
  ): Promise<SkillResult> {
    this.logger?.info({
      msg: `Executing node "${node.id}" (skill: ${node.skill})`,
      runId: state.runId,
    });

    const nodeState = state.nodeStates.get(node.id)!;

    // 调用 SkillExecutor
    const result = await this.skillExecutor.execute(node.skill, {
      skillName: node.skill,
      params: {
        ...(state.intermediateData as Record<string, unknown>),
        nodeId: node.id,
      },
      data: {
        inputPath: state.dataPath,
        outputPath: `${state.dataPath}/output/${node.id}`,
        intermediatePath: `${state.dataPath}/intermediate`,
        metadata: state.intermediateData,
      },
      containerName: state.container,
      containerManager: {} as ContainerManager, // 由 SkillExecutor 内部管理
      resources: {} as any, // 由 SkillExecutor 内部探测
      force: false,
    });

    // 评估节点级别的条件
    if (node.condition) {
      const condContext = this.buildConditionContext(result, state);
      const condMet = evaluateCondition(node.condition.if, condContext);

      if (condMet) {
        switch (node.condition.then) {
          case "skip":
            this.skipNode(node, state, node.condition.message);
            return result;
          case "ask_user":
            this.pauseNode(node, state, node.condition.message);
            return result;
          case "warn_continue":
            this.logger?.warn({
              msg: `Node "${node.id}" condition warning`,
              condition: node.condition.if,
              message: node.condition.message,
            });
            break;
          case "abort":
            state.status = "aborted";
            state.abortReason = node.condition.message;
            state.completedAt = new Date().toISOString();
            return result;
          case "continue":
          default:
            // 继续执行
            break;
        }
      }
    }

    // 标记完成
    this.completeNode(node, state, result);

    // 保存检查点（如果节点要求）
    if (node.checkpoint) {
      await this.saveCheckpoint(state, workflow);
    }

    return result;
  }

  /**
   * 处理节点错误。
   */
  private async handleNodeError(
    node: WorkflowNode,
    error: Error,
    state: WorkflowState,
    policy: ErrorPolicy,
  ): Promise<void> {
    const nodeState = state.nodeStates.get(node.id)!;

    this.logger?.error({
      msg: `Node "${node.id}" failed`,
      runId: state.runId,
      error: error.message,
      retryCount: nodeState.retryCount,
    });

    const result = applyErrorPolicy(node, error, state, policy);

    switch (result.action) {
      case "retry": {
        // 增加重试计数
        nodeState.retryCount++;
        nodeState.status = "pending";
        nodeState.error = error.message;

        // 从当前节点列表中移除（将在下一轮重新获取）
        state.currentNodes = state.currentNodes.filter(
          (id) => id !== node.id,
        );

        this.logger?.info({
          msg: `Node "${node.id}" will retry`,
          retryCount: nodeState.retryCount,
          message: result.message,
        });

        // 指数退避延迟
        const backoff = node.retry?.backoff ?? "fixed";
        const delayMs =
          backoff === "exponential"
            ? (node.retry?.delayMs ?? policy.retryDelayMs) *
              Math.pow(2, nodeState.retryCount - 1)
            : (node.retry?.delayMs ?? policy.retryDelayMs);

        await this.delay(delayMs);
        break;
      }

      case "skip": {
        this.skipNode(node, state, result.message);
        break;
      }

      case "pause": {
        this.pauseNode(node, state, result.message);
        break;
      }

      case "abort": {
        this.failNode(node, state, error.message);
        state.status = "aborted";
        state.abortReason = result.message;
        state.completedAt = new Date().toISOString();
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // 私有方法 — 节点状态管理
  // -------------------------------------------------------------------------

  /**
   * 标记节点为完成。
   */
  private completeNode(
    node: WorkflowNode,
    state: WorkflowState,
    result: SkillResult,
  ): void {
    const nodeState = state.nodeStates.get(node.id)!;
    nodeState.status = "completed";
    nodeState.endedAt = new Date().toISOString();
    nodeState.result = result;
    nodeState.error = null;

    state.completedNodes.push(node.id);
    state.currentNodes = state.currentNodes.filter((id) => id !== node.id);
    state.results.set(node.id, result);

    // 将结果数据合并到中间数据
    if (result.outputs) {
      state.intermediateData = {
        ...state.intermediateData,
        [node.id]: result.outputs.metrics,
        result: {
          status: result.status,
          qc: result.qcReport,
        },
      };
    }

    // 更新进度
    state.progress =
      (state.completedNodes.length + state.skippedNodes.length) /
      state.totalNodes;

    this.logger?.info({
      msg: `Node "${node.id}" completed`,
      runId: state.runId,
      progress: state.progress,
    });
  }

  /**
   * 标记节点为跳过。
   */
  private skipNode(
    node: WorkflowNode,
    state: WorkflowState,
    reason: string,
  ): void {
    const nodeState = state.nodeStates.get(node.id)!;
    nodeState.status = "skipped";
    nodeState.endedAt = new Date().toISOString();
    nodeState.error = reason;

    state.skippedNodes.push(node.id);
    state.currentNodes = state.currentNodes.filter((id) => id !== node.id);

    state.progress =
      (state.completedNodes.length + state.skippedNodes.length) /
      state.totalNodes;

    this.logger?.info({
      msg: `Node "${node.id}" skipped`,
      reason,
      runId: state.runId,
    });
  }

  /**
   * 标记节点为失败。
   */
  private failNode(
    node: WorkflowNode,
    state: WorkflowState,
    errorMessage: string,
  ): void {
    const nodeState = state.nodeStates.get(node.id)!;
    nodeState.status = "failed";
    nodeState.endedAt = new Date().toISOString();
    nodeState.error = errorMessage;

    state.failedNodes.push(node.id);
    state.currentNodes = state.currentNodes.filter((id) => id !== node.id);

    this.logger?.error({
      msg: `Node "${node.id}" failed permanently`,
      error: errorMessage,
      runId: state.runId,
    });
  }

  /**
   * 标记节点为暂停。
   */
  private pauseNode(
    node: WorkflowNode,
    state: WorkflowState,
    reason: string,
  ): void {
    const nodeState = state.nodeStates.get(node.id)!;
    nodeState.status = "paused";
    nodeState.error = reason;

    state.currentNodes = state.currentNodes.filter((id) => id !== node.id);

    // 如果整体状态还是 running，保持 running 等待其他节点
    // 如果有 pauseAfter，整体状态变为 paused
    if (node.pauseAfter) {
      state.status = "paused";
    }

    this.logger?.info({
      msg: `Node "${node.id}" paused`,
      reason,
      runId: state.runId,
    });
  }

  // -------------------------------------------------------------------------
  // 私有方法 — 条件评估
  // -------------------------------------------------------------------------

  /**
   * 评估节点的条件表达式。
   *
   * @returns "execute" | "skip" | "ask_user" | "warn_continue"
   */
  private evaluateNodeCondition(
    node: WorkflowNode,
    state: WorkflowState,
  ): "execute" | "skip" | "ask_user" | "warn_continue" {
    if (!node.condition) return "execute";

    const context = this.buildConditionContext(null, state);
    const condMet = evaluateCondition(node.condition.if, context);

    if (!condMet) {
      // 条件不满足时的默认行为
      if (node.optional) {
        return "skip";
      }
      return "execute";
    }

    // 条件满足
    switch (node.condition.then) {
      case "skip":
        return "skip";
      case "ask_user":
        return "ask_user";
      case "warn_continue":
        return "warn_continue";
      case "continue":
      default:
        return "execute";
    }
  }

  /**
   * 评估条件检查节点的用户级条件。
   */
  private evaluateUserCondition(
    node: WorkflowNode,
    state: WorkflowState,
  ): boolean {
    if (!node.condition) return true;

    const context = this.buildConditionContext(null, state);
    return evaluateCondition(node.condition.if, context);
  }

  /**
   * 构建条件评估上下文。
   */
  private buildConditionContext(
    result: SkillResult | null,
    state: WorkflowState,
  ): Record<string, any> {
    const context: Record<string, any> = {
      ...state.intermediateData,
      metadata: state.intermediateData.metadata ?? state.intermediateData,
    };

    if (result) {
      context.result = {
        status: result.status,
        qc: {
          overall: result.qcReport.overall,
          passed: result.qcReport.passed,
          warned: result.qcReport.warned,
          failed: result.qcReport.failed,
        },
        outputs: result.outputs,
      };

      // 将结果指标展平到顶层
      if (result.outputs?.metrics) {
        for (const [key, value] of Object.entries(result.outputs.metrics)) {
          context[key] = value;
        }
      }
    }

    return context;
  }

  // -------------------------------------------------------------------------
  // 私有方法 — 工作流生命周期
  // -------------------------------------------------------------------------

  /**
   * 完成工作流。
   */
  private async finishWorkflow(
    state: WorkflowState,
    workflow: WorkflowDef,
  ): Promise<void> {
    const hasFailures = state.failedNodes.length > 0;

    if (hasFailures) {
      state.status = "failed";
    } else {
      state.status = "completed";
    }

    state.completedAt = new Date().toISOString();
    state.progress = 1;

    await this.saveCheckpoint(state, workflow);

    this.logger?.info({
      msg: `Workflow "${workflow.name}" ${state.status}`,
      runId: state.runId,
      completedNodes: state.completedNodes.length,
      failedNodes: state.failedNodes.length,
      skippedNodes: state.skippedNodes.length,
      totalNodes: state.totalNodes,
      duration: state.completedAt
        ? (
            (new Date(state.completedAt).getTime() -
              new Date(state.startedAt).getTime()) /
            1000
          ).toFixed(0) + "s"
        : "unknown",
    });
  }

  /**
   * 保存检查点。
   */
  private async saveCheckpoint(
    state: WorkflowState,
    workflow: WorkflowDef,
  ): Promise<void> {
    try {
      // 将 Map 序列化为普通对象
      const nodeStatesObj: Record<string, NodeState> = {};
      for (const [id, ns] of state.nodeStates) {
        nodeStatesObj[id] = { ...ns };
      }

      const checkpoint: CheckpointData = {
        runId: state.runId,
        projectId: state.projectId,
        workflowName: state.workflowName,
        status: state.status,
        nodeStates: nodeStatesObj,
        completedNodes: [...state.completedNodes],
        failedNodes: [...state.failedNodes],
        skippedNodes: [...state.skippedNodes],
        intermediateData: { ...state.intermediateData },
        containerName: state.container,
        containerId: "",
        dataPath: state.dataPath,
        userDecisions: { ...state.userDecisions },
        savedAt: new Date().toISOString(),
        abortReason: state.abortReason,
        agentState: {},
      };

      await this.checkpointMgr.save(checkpoint);
    } catch (error) {
      this.logger?.warn({
        msg: "Failed to save checkpoint",
        runId: state.runId,
        error: String(error),
      });
    }
  }

  /**
   * 查找活跃状态。
   */
  private async findActiveState(
    runId: string,
  ): Promise<WorkflowState | null> {
    // 遍历所有检查点查找匹配的 runId
    const checkpoints = await this.checkpointMgr.list("");
    const checkpoint = checkpoints.find((cp) => cp.runId === runId);

    if (!checkpoint) return null;

    return this.checkpointMgr.restore(checkpoint);
  }

  /**
   * 创建空的 SkillResult。
   */
  private createEmptyResult(skillName: string): SkillResult {
    return {
      skillName,
      skillVersion: "1.0.0",
      status: "success",
      qcReport: {
        overall: "pass",
        gates: [],
        passed: 0,
        warned: 0,
        failed: 0,
        total: 0,
      },
      outputs: {
        files: [],
        metrics: {},
        logs: [],
      },
      nextSteps: [],
      duration: 0,
      executedAt: new Date().toISOString(),
    };
  }

  /**
   * 异步延迟。
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
