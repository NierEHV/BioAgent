// ============================================================
// @bioagent/workflow — Core Type Definitions
// ============================================================

import type { SkillResult } from "@bioagent/skills";

// ---------------------------------------------------------------------------
// WorkflowDef — 工作流定义
// ---------------------------------------------------------------------------

/**
 * 完整的工作流定义。
 * 包含所有节点 DAG 结构、资源估算和错误策略。
 */
export interface WorkflowDef {
  /** 工作流唯一名称，如 "scrna-seq-standard" */
  name: string;
  /** 语义版本号，如 "1.0.0" */
  version: string;
  /** 人类可读的工作流描述 */
  description: string;
  /** 资源估算 */
  resourceEstimate: ResourceEstimate;
  /** 输入定义 */
  input: WorkflowInput;
  /** 输出定义 */
  output: WorkflowOutput;
  /** DAG 节点列表 */
  nodes: WorkflowNode[];
  /** 全局错误策略 */
  errorPolicy: ErrorPolicy;
}

/**
 * 资源估算（供 estimate() 使用）。
 */
export interface ResourceEstimate {
  /** CPU 需求，如 "8-16 cores" */
  cpu: string;
  /** 内存需求，如 "32-64GB" */
  ram: string;
  /** 磁盘需求，如 "50-100GB" */
  disk: string;
  /** 时间估算，如 "2-8 hours" */
  time: string;
  /** GPU 需求 */
  gpu: "required" | "optional" | "not_needed";
}

/**
 * 工作流输入定义。
 */
export interface WorkflowInput {
  /** 支持的数据格式 */
  dataFormat: string[];
  /** 必需的输入项 */
  required: string[];
  /** 可选的输入项 */
  optional: string[];
}

/**
 * 工作流输出定义。
 */
export interface WorkflowOutput {
  /** 输出目录（使用模板变量，如 {project_id}） */
  directory: string;
  /** 输出文件列表 */
  files: WorkflowOutputFile[];
}

/**
 * 单个输出文件描述。
 */
export interface WorkflowOutputFile {
  /** 文件名 */
  name: string;
  /** 文件说明 */
  description: string;
}

// ---------------------------------------------------------------------------
// WorkflowNode — DAG 节点
// ---------------------------------------------------------------------------

/**
 * DAG 中的单个节点。
 * 表示工作流中的一个执行步骤。
 */
export interface WorkflowNode {
  /** 节点唯一 ID */
  id: string;
  /** 关联的 Skill 名称 */
  skill: string;
  /** 前置依赖节点 ID 列表 */
  dependsOn: string[];
  /** 依赖满足模式：all（所有前置完成）或 any（任一前置完成） */
  dependsOnMode: "all" | "any";
  /** 是否为可选节点 */
  optional: boolean;
  /** 是否在执行后保存检查点 */
  checkpoint: boolean;
  /** 是否在执行完成后暂停 */
  pauseAfter: boolean;
  /** 条件表达式配置 */
  condition?: NodeCondition;
  /** 重试配置 */
  retry?: NodeRetryConfig;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 节点条件表达式配置。
 */
export interface NodeCondition {
  /** 条件表达式，如 "result.qc.overall === 'fail'" */
  if: string;
  /** 条件满足时的动作 */
  then: "continue" | "skip" | "warn_continue" | "ask_user" | "abort";
  /** 用户提示消息（当 then 为 ask_user 时使用） */
  message: string;
}

/**
 * 节点重试配置。
 */
export interface NodeRetryConfig {
  /** 最大重试次数 */
  maxAttempts: number;
  /** 重试延迟（毫秒） */
  delayMs: number;
  /** 退避策略 */
  backoff: "fixed" | "exponential";
}

// ---------------------------------------------------------------------------
// ErrorPolicy — 错误策略
// ---------------------------------------------------------------------------

/**
 * 全局错误策略。
 * 定义节点失败时的默认行为。
 */
export interface ErrorPolicy {
  /** 最大重试次数（全局默认） */
  maxRetries: number;
  /** 重试延迟（毫秒，全局默认） */
  retryDelayMs: number;
  /** 重试耗尽后的行为 */
  onExhausted: "pause_and_ask" | "skip" | "abort";
  /** 是否跳过可选节点 */
  skipOptional: boolean;
  /** 是否在警告时通知 */
  notifyOnWarning: boolean;
}

// ---------------------------------------------------------------------------
// WorkflowState — 运行时状态
// ---------------------------------------------------------------------------

/**
 * 工作流运行时状态。
 * 从检查点恢复时还原此对象。
 */
export interface WorkflowState {
  /** 本次运行的唯一 ID */
  runId: string;
  /** 工作流名称 */
  workflowName: string;
  /** 运行状态 */
  status: WorkflowStatus;
  /** 项目 ID */
  projectId: string;
  /** 容器名称 */
  container: string;
  /** 数据路径 */
  dataPath: string;
  /** 各节点状态映射 (nodeId -> NodeState) */
  nodeStates: Map<string, NodeState>;
  /** 当前正在执行的节点 ID 列表 */
  currentNodes: string[];
  /** 已完成节点 ID 列表 */
  completedNodes: string[];
  /** 失败节点 ID 列表 */
  failedNodes: string[];
  /** 跳过节点 ID 列表 */
  skippedNodes: string[];
  /** 节点总数 */
  totalNodes: number;
  /** 进度（0-1） */
  progress: number;
  /** 节点执行结果缓存 (nodeId -> SkillResult) */
  results: Map<string, SkillResult>;
  /** 启动时间 (ISO 8601) */
  startedAt: string;
  /** 完成时间 (ISO 8601)，未完成时为 null */
  completedAt: string | null;
  /** 中间数据（工作流级别共享数据） */
  intermediateData: Record<string, unknown>;
  /** 用户决策记录 (nodeId -> decision) */
  userDecisions: Record<string, string>;
  /** 中止原因 */
  abortReason?: string;
}

/** 工作流运行状态 */
export type WorkflowStatus =
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "aborted";

/**
 * 单个节点的运行时状态。
 */
export interface NodeState {
  /** 节点 ID */
  nodeId: string;
  /** Skill 名称 */
  skill: string;
  /** 节点执行状态 */
  status: NodeExecutionStatus;
  /** 执行开始时间 (ISO 8601) */
  startedAt: string | null;
  /** 执行结束时间 (ISO 8601) */
  endedAt: string | null;
  /** 重试次数 */
  retryCount: number;
  /** 执行结果（执行完成后有值） */
  result: SkillResult | null;
  /** 错误信息（执行失败时有值） */
  error: string | null;
}

/** 节点执行状态 */
export type NodeExecutionStatus =
  | "pending"
  | "ready"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "paused";

// ---------------------------------------------------------------------------
// CheckpointData — 检查点持久化数据
// ---------------------------------------------------------------------------

/**
 * 检查点数据（持久化到磁盘）。
 * 用于断点续跑。
 */
export interface CheckpointData {
  /** 运行 ID */
  runId: string;
  /** 项目 ID */
  projectId: string;
  /** 工作流名称 */
  workflowName: string;
  /** 工作流运行状态 */
  status: WorkflowStatus;
  /** 各节点状态（序列化为普通对象） */
  nodeStates: Record<string, NodeState>;
  /** 已完成节点 ID 列表 */
  completedNodes: string[];
  /** 失败节点 ID 列表 */
  failedNodes: string[];
  /** 跳过节点 ID 列表 */
  skippedNodes: string[];
  /** 中间数据 */
  intermediateData: Record<string, unknown>;
  /** 容器名称 */
  containerName: string;
  /** 容器 ID（如果有） */
  containerId: string;
  /** 数据路径 */
  dataPath: string;
  /** 用户决策记录 */
  userDecisions: Record<string, string>;
  /** 保存时间 (ISO 8601) */
  savedAt: string;
  /** 中止原因 */
  abortReason?: string;
  /** Agent 状态（预留） */
  agentState: Record<string, unknown>;
}
