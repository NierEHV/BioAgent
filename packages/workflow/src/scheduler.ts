// ============================================================
// @bioagent/workflow — WorkflowScheduler
// ============================================================

import type { WorkflowNode, NodeState } from "./engine.types.js";

/**
 * 工作流调度器。
 *
 * 负责 DAG 拓扑排序、就绪节点检测、关键路径分析和循环依赖检测。
 *
 * 核心算法：
 * - 拓扑排序：Kahn 算法，按批次返回可并行执行的节点组
 * - 就绪检测：根据 dependsOnMode (all/any) 判断前置依赖是否满足
 * - 关键路径：DAG 最长路径分析
 * - 循环检测：DFS + 三色标记
 */
export class WorkflowScheduler {
  /**
   * 拓扑排序 — 返回按层级分组的批次。
   *
   * 使用 Kahn 算法：
   * 1. 计算每个节点的入度（依赖数）
   * 2. 入度为 0 的节点为第一批
   * 3. 移除已处理节点，更新入度，生成下一批
   *
   * 返回 string[][]，每个子数组为一个批次（可并行执行的节点 ID 列表）。
   *
   * @param nodes - DAG 节点列表
   * @returns 按批次分组的节点 ID 列表
   * @throws 如果存在循环依赖
   */
  topoSort(nodes: WorkflowNode[]): string[][] {
    if (nodes.length === 0) return [];

    // 检查循环依赖
    const cycle = this.detectCycle(nodes);
    if (cycle !== null) {
      throw new Error(
        `Workflow contains a cyclic dependency: ${cycle.join(" -> ")}`,
      );
    }

    // 构建节点映射
    const nodeMap = new Map<string, WorkflowNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // 计算入度：对于每个节点，有多少节点依赖它（反向计数）
    // 实际上 Kahn 算法是计算每个节点的前置依赖数
    const inDegree = new Map<string, number>();
    for (const node of nodes) {
      if (!inDegree.has(node.id)) {
        inDegree.set(node.id, 0);
      }
      for (const dep of node.dependsOn) {
        // dep 是当前节点的前置依赖 — Kahn 入度是"有多少未完成的前置"
        const current = inDegree.get(node.id) ?? 0;
        inDegree.set(node.id, current + 1);
      }
    }

    // 找出所有入度为 0 的节点（无前置依赖）
    const batchOrder: string[][] = [];

    while (batchOrder.flat().length < nodes.length) {
      const currentBatch: string[] = [];

      for (const [nodeId, degree] of inDegree) {
        if (degree === 0) {
          currentBatch.push(nodeId);
        }
      }

      if (currentBatch.length === 0) {
        // 如果没有入度为 0 的节点但还有未处理的节点，说明有循环
        throw new Error(
          "Workflow contains a cyclic dependency — topological sort failed.",
        );
      }

      batchOrder.push(currentBatch);

      // 移除当前批次节点，更新它们下游节点的入度
      for (const nodeId of currentBatch) {
        inDegree.set(nodeId, -1); // 标记为已处理

        // 找到所有依赖此节点的节点
        for (const node of nodes) {
          if (node.dependsOn.includes(nodeId)) {
            const current = inDegree.get(node.id) ?? 0;
            if (current > 0) {
              inDegree.set(node.id, current - 1);
            }
          }
        }
      }
    }

    return batchOrder;
  }

  /**
   * 获取当前就绪的节点。
   *
   * 根据节点状态和依赖模式判断：
   * - dependsOnMode "all": 所有前置依赖节点必须已完成
   * - dependsOnMode "any": 任意一个前置依赖节点已完成即可
   *
   * 可选节点如果所有前置都跳过，则自己也被跳过。
   *
   * @param nodes - 所有 DAG 节点
   * @param nodeStates - 当前节点状态映射
   * @returns 就绪节点列表
   */
  getReadyNodes(
    nodes: WorkflowNode[],
    nodeStates: Map<string, NodeState>,
  ): WorkflowNode[] {
    const ready: WorkflowNode[] = [];

    for (const node of nodes) {
      const state = nodeStates.get(node.id);

      // 只考虑待处理的节点
      if (!state || state.status !== "pending") {
        continue;
      }

      // 无前置依赖 → 直接就绪
      if (node.dependsOn.length === 0) {
        ready.push(node);
        continue;
      }

      // 检查前置依赖是否满足
      const depsSatisfied = this.areDependenciesSatisfied(
        node,
        nodeStates,
      );

      if (depsSatisfied) {
        ready.push(node);
      }
    }

    return ready;
  }

  /**
   * 检查节点的前置依赖是否满足。
   *
   * @param node - 要检查的节点
   * @param nodeStates - 节点状态映射
   * @returns 是否满足
   */
  private areDependenciesSatisfied(
    node: WorkflowNode,
    nodeStates: Map<string, NodeState>,
  ): boolean {
    const depStates = node.dependsOn.map((depId) => nodeStates.get(depId));

    if (node.dependsOnMode === "all") {
      // 所有前置必须完成（或被跳过）
      return depStates.every((s) => {
        if (!s) return false;
        return s.status === "completed" || s.status === "skipped";
      });
    }

    // dependsOnMode === "any"
    // 任一前置完成即可（或被跳过）
    // 注意：如果所有前置都被跳过，则 any 模式也认为满足
    const allSkipped = depStates.every(
      (s) => s?.status === "skipped",
    );
    if (allSkipped && node.optional) {
      return true;
    }

    return depStates.some((s) => {
      if (!s) return false;
      return s.status === "completed" || s.status === "skipped";
    });
  }

  /**
   * 获取关键路径（DAG 中的最长路径）。
   *
   * 使用 DFS + DP 计算从起始节点到终端节点的最长路径。
   *
   * @param nodes - DAG 节点列表
   * @returns 关键路径上的节点 ID 列表（按拓扑顺序）
   */
  getCriticalPath(nodes: WorkflowNode[]): string[] {
    if (nodes.length === 0) return [];

    // 起始节点：没有前置依赖的节点（dependsOn 为空）
    const startNodes = nodes.filter((n) => n.dependsOn.length === 0);

    // 如果所有节点都有依赖（循环），从第一个开始
    const roots = startNodes.length > 0 ? startNodes : [nodes[0]];

    // 找到所有下游节点（即：依赖了 nodeId 的节点）
    const getDownstream = (nodeId: string): WorkflowNode[] => {
      return nodes.filter((n) => n.dependsOn.includes(nodeId));
    };

    // DP 缓存：从 nodeId 出发到任意终端的最长路径长度
    const memo = new Map<string, number>();

    const longestFrom = (nodeId: string, visited: Set<string>): number => {
      if (visited.has(nodeId)) return 0; // 防止循环
      if (memo.has(nodeId)) return memo.get(nodeId)!;

      visited.add(nodeId);

      const downstream = getDownstream(nodeId);
      if (downstream.length === 0) {
        memo.set(nodeId, 1);
        return 1;
      }

      let maxDown = 0;
      for (const next of downstream) {
        const len = longestFrom(next.id, new Set(visited));
        if (len > maxDown) maxDown = len;
      }

      const result = 1 + maxDown;
      memo.set(nodeId, result);
      return result;
    };

    // 重建路径：从起始节点沿 memo 值最大的下游节点前进
    const rebuildPath = (startId: string): string[] => {
      const path: string[] = [startId];
      let current = startId;

      while (true) {
        const downstream = getDownstream(current);
        if (downstream.length === 0) break;

        // 选择 memo 值最大的下游节点
        let best: WorkflowNode | null = null;
        let bestLen = 0;
        for (const next of downstream) {
          const len = memo.get(next.id) ?? 0;
          if (len > bestLen) {
            bestLen = len;
            best = next;
          }
        }

        if (!best) break;
        path.push(best.id);
        current = best.id;
      }

      return path;
    };

    // 计算所有起点的最长路径长度
    let maxLength = 0;
    let longestPath: string[] = [];

    for (const root of roots) {
      const len = longestFrom(root.id, new Set());
      if (len > maxLength) {
        maxLength = len;
        longestPath = rebuildPath(root.id);
      }
    }

    return longestPath;
  }

  /**
   * 检测循环依赖。
   *
   * 使用 DFS + 三色标记算法（WHITE/GRAY/BLACK）。
   *
   * @param nodes - DAG 节点列表
   * @returns 循环路径（如 ["A", "B", "C", "A"]），无循环时返回 null
   */
  detectCycle(nodes: WorkflowNode[]): string[] | null {
    if (nodes.length === 0) return null;

    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;

    const color = new Map<string, number>();
    for (const node of nodes) {
      color.set(node.id, WHITE);
    }

    const nodeMap = new Map<string, WorkflowNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    const path: string[] = [];

    const dfs = (nodeId: string): string[] | null => {
      color.set(nodeId, GRAY);
      path.push(nodeId);

      const node = nodeMap.get(nodeId);
      if (node) {
        for (const depId of node.dependsOn) {
          const depColor = color.get(depId) ?? WHITE;

          if (depColor === GRAY) {
            // 找到循环
            const cycleStart = path.indexOf(depId);
            const cycle = path.slice(cycleStart);
            cycle.push(depId); // 闭合循环
            return cycle;
          }

          if (depColor === WHITE) {
            const result = dfs(depId);
            if (result !== null) return result;
          }
        }
      }

      path.pop();
      color.set(nodeId, BLACK);
      return null;
    };

    for (const node of nodes) {
      if (color.get(node.id) === WHITE) {
        const result = dfs(node.id);
        if (result !== null) return result;
      }
    }

    return null;
  }
}
