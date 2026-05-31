// ============================================================
// @bioagent/workflow — WorkflowRegistry
// ============================================================

import type { WorkflowDef } from "./engine.types.js";

/**
 * 工作流注册中心。
 *
 * 管理所有已注册的工作流定义。
 * 提供按名称查找、列表、注册等功能。
 */
export class WorkflowRegistry {
  private workflows = new Map<string, WorkflowDef>();

  /**
   * 注册工作流定义。
   *
   * @param workflow - 工作流定义
   * @throws 如果同名工作流已注册
   */
  register(workflow: WorkflowDef): void {
    if (this.workflows.has(workflow.name)) {
      throw new Error(
        `Duplicate workflow registration: "${workflow.name}". A workflow with this name is already registered.`,
      );
    }

    // 验证工作流定义
    this.validateWorkflowDef(workflow);

    this.workflows.set(workflow.name, workflow);
  }

  /**
   * 获取工作流定义。
   *
   * @param name - 工作流名称
   * @returns 工作流定义，不存在时返回 undefined
   */
  get(name: string): WorkflowDef | undefined {
    return this.workflows.get(name);
  }

  /**
   * 获取所有已注册的工作流定义。
   *
   * @returns 工作流定义数组
   */
  getAll(): WorkflowDef[] {
    return [...this.workflows.values()];
  }

  /**
   * 获取所有已注册的工作流名称。
   *
   * @returns 名称数组
   */
  listNames(): string[] {
    return [...this.workflows.keys()];
  }

  /**
   * 检查指定名称的工作流是否已注册。
   *
   * @param name - 工作流名称
   * @returns 是否已注册
   */
  has(name: string): boolean {
    return this.workflows.has(name);
  }

  /**
   * 验证工作流定义的基本完整性。
   *
   * @param workflow - 工作流定义
   * @throws 如果定义不完整
   */
  private validateWorkflowDef(workflow: WorkflowDef): void {
    const errors: string[] = [];

    if (!workflow.name || workflow.name.trim().length === 0) {
      errors.push("Workflow name is required.");
    }

    if (!workflow.version || workflow.version.trim().length === 0) {
      errors.push("Workflow version is required.");
    }

    if (!workflow.nodes || workflow.nodes.length === 0) {
      errors.push("Workflow must have at least one node.");
    }

    if (!workflow.errorPolicy) {
      errors.push("Workflow must define an errorPolicy.");
    }

    // 验证节点 ID 唯一性
    const nodeIds = new Set<string>();
    for (const node of workflow.nodes) {
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID: "${node.id}".`);
      }
      nodeIds.add(node.id);

      if (!node.id || node.id.trim().length === 0) {
        errors.push("Each node must have a non-empty id.");
      }

      if (!node.skill || node.skill.trim().length === 0) {
        errors.push(`Node "${node.id}" must reference a skill.`);
      }
    }

    // 验证所有依赖引用存在的节点
    for (const node of workflow.nodes) {
      for (const dep of node.dependsOn) {
        if (!nodeIds.has(dep)) {
          errors.push(
            `Node "${node.id}" depends on unknown node "${dep}".`,
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Invalid workflow definition "${workflow.name}":\n${errors.map((e) => `  - ${e}`).join("\n")}`,
      );
    }
  }
}
