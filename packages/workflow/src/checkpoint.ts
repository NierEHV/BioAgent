// ============================================================
// @bioagent/workflow — CheckpointManager
// ============================================================

import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import type { CheckpointData, WorkflowState } from "./engine.types";

/**
 * 检查点管理器。
 *
 * 负责工作流运行状态的持久化和恢复。
 * 检查点数据以 JSON 格式保存到磁盘。
 *
 * 目录结构：
 *   {basePath}/
 *     {projectId}/
 *       checkpoints/
 *         {workflowName}/
 *           {runId}.json
 */
export class CheckpointManager {
  private basePath: string;

  /**
   * @param basePath - 检查点存储根目录（如 data/projects/）
   */
  constructor(basePath: string) {
    this.basePath = basePath;
    this.ensureDir(basePath);
  }

  /**
   * 保存检查点。
   *
   * 将 CheckpointData 序列化为 JSON 并写入磁盘。
   *
   * @param checkpoint - 检查点数据
   */
  async save(checkpoint: CheckpointData): Promise<void> {
    const dir = this.getCheckpointDir(
      checkpoint.projectId,
      checkpoint.workflowName,
    );
    this.ensureDir(dir);

    // 更新时间戳
    checkpoint.savedAt = new Date().toISOString();

    const filePath = path.join(dir, `${checkpoint.runId}.json`);
    const content = JSON.stringify(checkpoint, null, 2);

    await fs.promises.writeFile(filePath, content, "utf-8");
  }

  /**
   * 查找最新的检查点。
   *
   * 按保存时间排序，返回最新的检查点数据。
   *
   * @param workflowName - 工作流名称
   * @param projectId - 项目 ID
   * @returns 最新检查点，不存在时返回 null
   */
  async findLatest(
    workflowName: string,
    projectId: string,
  ): Promise<CheckpointData | null> {
    const dir = this.getCheckpointDir(projectId, workflowName);

    try {
      const files = await fs.promises.readdir(dir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      if (jsonFiles.length === 0) return null;

      let latest: CheckpointData | null = null;
      let latestTime = "";

      for (const file of jsonFiles) {
        const filePath = path.join(dir, file);
        const content = await fs.promises.readFile(filePath, "utf-8");
        try {
          const data = JSON.parse(content) as CheckpointData;
          if (data.savedAt > latestTime) {
            latestTime = data.savedAt;
            latest = data;
          }
        } catch {
          // 跳过损坏的文件
        }
      }

      return latest;
    } catch {
      // 目录不存在
      return null;
    }
  }

  /**
   * 列出指定项目的所有检查点。
   *
   * @param projectId - 项目 ID
   * @returns 检查点列表（按保存时间降序）
   */
  async list(projectId: string): Promise<CheckpointData[]> {
    const results: CheckpointData[] = [];

    /**
     * 递归扫描目录中的检查点文件。
     */
    const scanDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await scanDir(fullPath);
          } else if (entry.isFile() && entry.name.endsWith(".json")) {
            try {
              const content = await fs.promises.readFile(fullPath, "utf-8");
              const data = JSON.parse(content) as CheckpointData;
              results.push(data);
            } catch {
              // 跳过损坏文件
            }
          }
        }
      } catch {
        // 目录不存在或不可访问
      }
    };

    if (projectId && projectId.length > 0) {
      // 搜索指定项目目录
      const projectDir = path.join(
        this.basePath,
        projectId,
        "checkpoints",
      );
      await scanDir(projectDir);
    } else {
      // 搜索所有项目目录
      await scanDir(this.basePath);
    }

    // 按保存时间降序排序
    results.sort(
      (a, b) =>
        new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
    );

    return results;
  }

  /**
   * 清理旧检查点，只保留最新的 N 个。
   *
   * @param projectId - 项目 ID
   * @param keepLatest - 保留的最新检查点数量
   */
  async prune(projectId: string, keepLatest: number): Promise<void> {
    const checkpoints = await this.list(projectId);

    if (checkpoints.length <= keepLatest) return;

    // 跳过最新的 keepLatest 个
    const toDelete = checkpoints.slice(keepLatest);

    for (const cp of toDelete) {
      await this.delete(cp.runId);
    }
  }

  /**
   * 验证检查点数据的完整性。
   *
   * 检查内容：
   * - 必需字段是否存在
   * - nodeStates 中引用的 ID 是否一致
   * - 数据完整性
   *
   * @param checkpoint - 检查点数据
   * @returns 验证结果
   */
  async verify(
    checkpoint: CheckpointData,
  ): Promise<{
    valid: boolean;
    missingFiles: string[];
    corruptedFiles: string[];
  }> {
    const missingFiles: string[] = [];
    const corruptedFiles: string[] = [];

    // 检查必需字段
    if (!checkpoint.runId) {
      corruptedFiles.push("Missing required field: runId");
    }
    if (!checkpoint.projectId) {
      corruptedFiles.push("Missing required field: projectId");
    }
    if (!checkpoint.workflowName) {
      corruptedFiles.push("Missing required field: workflowName");
    }
    if (!checkpoint.nodeStates || typeof checkpoint.nodeStates !== "object") {
      corruptedFiles.push("Missing or invalid field: nodeStates");
    }
    if (!Array.isArray(checkpoint.completedNodes)) {
      corruptedFiles.push("Missing or invalid field: completedNodes");
    }
    if (!Array.isArray(checkpoint.failedNodes)) {
      corruptedFiles.push("Missing or invalid field: failedNodes");
    }
    if (!Array.isArray(checkpoint.skippedNodes)) {
      corruptedFiles.push("Missing or invalid field: skippedNodes");
    }
    if (!checkpoint.savedAt) {
      corruptedFiles.push("Missing required field: savedAt");
    }

    // 检查文件是否存在于磁盘
    const dir = this.getCheckpointDir(
      checkpoint.projectId,
      checkpoint.workflowName,
    );
    const filePath = path.join(dir, `${checkpoint.runId}.json`);

    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      missingFiles.push(filePath);
    }

    const valid = corruptedFiles.length === 0 && missingFiles.length === 0;

    return { valid, missingFiles, corruptedFiles };
  }

  /**
   * 从检查点恢复 WorkflowState。
   *
   * 将磁盘上的检查点数据还原为内存中的 WorkflowState 对象。
   *
   * @param checkpoint - 检查点数据
   * @returns 恢复的 WorkflowState
   */
  async restore(checkpoint: CheckpointData): Promise<WorkflowState> {
    // 将普通对象转换为 Map
    const nodeStates = new Map<string, import("./engine.types").NodeState>();

    for (const [nodeId, state] of Object.entries(checkpoint.nodeStates)) {
      nodeStates.set(nodeId, state);
    }

    return {
      runId: checkpoint.runId,
      workflowName: checkpoint.workflowName,
      status: checkpoint.status ?? "paused", // 使用检查点中保存的状态，默认为 paused
      projectId: checkpoint.projectId,
      container: checkpoint.containerName,
      dataPath: checkpoint.dataPath,
      nodeStates,
      currentNodes: [],
      completedNodes: [...checkpoint.completedNodes],
      failedNodes: [...checkpoint.failedNodes],
      skippedNodes: [...checkpoint.skippedNodes],
      totalNodes: Object.keys(checkpoint.nodeStates).length,
      progress: this.calculateProgress(
        checkpoint.completedNodes,
        Object.keys(checkpoint.nodeStates).length,
      ),
      results: new Map(),
      startedAt: checkpoint.savedAt,
      completedAt: null,
      intermediateData: { ...checkpoint.intermediateData },
      userDecisions: { ...checkpoint.userDecisions },
      abortReason: checkpoint.abortReason,
    };
  }

  /**
   * 删除指定运行的检查点。
   *
   * @param runId - 运行 ID
   */
  async delete(runId: string): Promise<void> {
    // 搜索所有项目目录找到对应的检查点文件
    try {
      const entries = await fs.promises.readdir(this.basePath);

      for (const entry of entries) {
        const projectPath = path.join(this.basePath, entry);
        try {
          const stat = await fs.promises.stat(projectPath);
          if (!stat.isDirectory()) continue;

          const cpDir = path.join(projectPath, "checkpoints");
          try {
            await fs.promises.access(cpDir);
          } catch {
            continue;
          }

          const wfDirs = await fs.promises.readdir(cpDir);
          for (const wfDir of wfDirs) {
            const filePath = path.join(cpDir, wfDir, `${runId}.json`);
            try {
              await fs.promises.unlink(filePath);
              return; // 删除成功
            } catch {
              // 文件不存在，继续搜索
            }
          }
        } catch {
          // 跳过不可访问的目录
        }
      }
    } catch {
      // basePath 不存在
    }
  }

  /**
   * 计算进度百分比。
   */
  private calculateProgress(
    completedNodes: string[],
    totalNodes: number,
  ): number {
    if (totalNodes === 0) return 0;
    return Math.min(completedNodes.length / totalNodes, 1);
  }

  /**
   * 获取检查点目录路径。
   */
  private getCheckpointDir(
    projectId: string,
    workflowName: string,
  ): string {
    return path.join(
      this.basePath,
      projectId,
      "checkpoints",
      workflowName,
    );
  }

  /**
   * 确保目录存在。
   */
  private ensureDir(dir: string): void {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // 目录已存在
    }
  }
}
