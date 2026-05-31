// ============================================================
// @bioagent/skills — SkillRegistry
// ============================================================

import type { BaseSkill } from "./base-skill";

/**
 * Skill 验证结果。
 */
export interface SkillValidationResult {
  /** 是否通过验证 */
  valid: boolean;
  /** 验证错误列表 */
  errors: string[];
  /** 验证警告列表 */
  warnings: string[];
}

/**
 * Skill 注册中心。
 *
 * 职责：
 * - 注册/查询所有 Skill
 * - 按组学类型筛选
 * - 依赖链拓扑排序分析
 * - 循环依赖检测
 * - Skill 规格验证
 */
export class SkillRegistry {
  /** 已注册的 Skill 映射（name -> skill） */
  private skills = new Map<string, BaseSkill>();

  /**
   * 注册单个 Skill。
   *
   * @param skill - 要注册的 Skill 实例
   * @throws 如果同名 Skill 已注册
   */
  register(skill: BaseSkill): void {
    const name = skill.spec.name;
    if (this.skills.has(name)) {
      throw new Error(
        `Duplicate skill registration: "${name}". A skill with this name is already registered.`,
      );
    }
    this.skills.set(name, skill);
  }

  /**
   * 批量注册 Skill。
   *
   * @param skills - Skill 实例数组
   * @throws 如果存在同名 Skill
   */
  registerAll(skills: BaseSkill[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  /**
   * 按名称获取 Skill。
   *
   * @param name - Skill 名称
   * @returns Skill 实例，不存在时返回 undefined
   */
  get(name: string): BaseSkill | undefined {
    return this.skills.get(name);
  }

  /**
   * 按组学类型获取所有 Skill。
   *
   * @param type - 组学类型过滤
   * @returns 匹配的 Skill 数组
   */
  getByOmicsType(type: string): BaseSkill[] {
    return [...this.skills.values()].filter(
      (s) => s.spec.omicsType === type,
    );
  }

  /**
   * 获取所有已注册的 Skill。
   *
   * @returns Skill 数组
   */
  getAll(): BaseSkill[] {
    return [...this.skills.values()];
  }

  /**
   * 检查指定名称的 Skill 是否已注册。
   *
   * @param name - Skill 名称
   * @returns 是否已注册
   */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * 获取所有已注册 Skill 的名称列表。
   *
   * @returns 名称数组
   */
  listNames(): string[] {
    return [...this.skills.keys()];
  }

  /**
   * 获取指定 Skill 的版本。
   *
   * @param name - Skill 名称
   * @returns 版本号，不存在时返回 undefined
   */
  getVersion(name: string): string | undefined {
    return this.skills.get(name)?.spec.version;
  }

  /**
   * 获取指定 Skill 的依赖链（拓扑排序）。
   *
   * 递归收集所有硬依赖（requires），去重后按依赖顺序返回。
   * 返回的数组中，索引越小表示越先需要执行。
   *
   * @param name - Skill 名称
   * @returns 依赖链中的 Skill 名称数组（不包含自身）
   */
  getDependencyChain(name: string): string[] {
    const skill = this.get(name);
    if (!skill) return [];

    const chain = new Set<string>();

    const collectDeps = (skillName: string) => {
      const s = this.get(skillName);
      if (!s) return;
      for (const dep of s.spec.dependencies.requires) {
        if (!chain.has(dep)) {
          chain.add(dep);
          collectDeps(dep);
        }
      }
    };

    collectDeps(name);
    return [...chain];
  }

  /**
   * 获取依赖指定 Skill 的所有下游 Skill。
   *
   * 遍历所有已注册 Skill，找出 requires 中包含指定 Skill 的条目。
   *
   * @param name - Skill 名称
   * @returns 下游 Skill 名称数组
   */
  getDownstream(name: string): string[] {
    const downstream: string[] = [];
    for (const [, skill] of this.skills) {
      if (skill.spec.dependencies.requires.includes(name)) {
        downstream.push(skill.spec.name);
      }
      if (skill.spec.dependencies.recommends.includes(name)) {
        downstream.push(skill.spec.name);
      }
    }
    return [...new Set(downstream)];
  }

  /**
   * 检查是否存在循环依赖。
   *
   * 对每个 Skill 执行 DFS，检测是否有环。
   *
   * @returns 循环路径字符串（如 "A -> B -> C -> A"），无循环时返回 null
   */
  checkCircularDependency(): string | null {
    const WHITE = 0; // 未访问
    const GRAY = 1; // 访问中（当前 DFS 路径上）
    const BLACK = 2; // 已完成

    const color = new Map<string, number>();
    const path: string[] = [];

    const dfs = (name: string): string | null => {
      color.set(name, GRAY);
      path.push(name);

      const skill = this.get(name);
      if (skill) {
        for (const dep of skill.spec.dependencies.requires) {
          const depColor = color.get(dep) ?? WHITE;
          if (depColor === GRAY) {
            // 找到循环：从 dep 开始到当前 name
            const cycleStart = path.indexOf(dep);
            const cycle = path.slice(cycleStart);
            cycle.push(dep); // 闭合循环
            return cycle.join(" -> ");
          }
          if (depColor === WHITE) {
            const result = dfs(dep);
            if (result !== null) return result;
          }
        }
      }

      path.pop();
      color.set(name, BLACK);
      return null;
    };

    for (const [name] of this.skills) {
      const startColor = color.get(name) ?? WHITE;
      if (startColor === WHITE) {
        const result = dfs(name);
        if (result !== null) return result;
      }
    }

    return null;
  }

  /**
   * 验证 Skill 规格的完整性。
   *
   * 检查项：
   * - 必需字段是否存在
   * - 名称是否符合规范
   * - 版本是否符合 semver 格式
   * - 依赖的 Skill 是否已注册
   *
   * @param skill - 要验证的 Skill
   * @returns 验证结果
   */
  validateSkill(skill: BaseSkill): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const spec = skill.spec;

    // Valid name
    if (!spec.name || spec.name.trim().length === 0) {
      errors.push("Skill name is required and must be non-empty.");
    } else if (!/^[a-z][a-z0-9-]*$/.test(spec.name)) {
      errors.push(
        `Skill name "${spec.name}" must be lowercase alphanumeric with hyphens, starting with a letter.`,
      );
    }

    // Valid version (semver)
    if (!spec.version || spec.version.trim().length === 0) {
      errors.push("Skill version is required.");
    } else if (!/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(spec.version)) {
      errors.push(
        `Skill version "${spec.version}" does not match semver format.`,
      );
    }

    // Valid description
    if (!spec.description || spec.description.trim().length === 0) {
      warnings.push("Skill description should be non-empty.");
    }

    // Valid omicsType
    const validOmicsTypes = [
      "scrna",
      "bulk-rna",
      "atac",
      "chipseq",
      "wgs",
      "proteomics",
      "metabolomics",
      "microbiome",
    ];
    if (!validOmicsTypes.includes(spec.omicsType)) {
      errors.push(
        `Unknown omicsType "${spec.omicsType}". Valid: ${validOmicsTypes.join(", ")}`,
      );
    }

    // Validate tools section
    if (!spec.tools || !spec.tools.primary) {
      errors.push("Skill must define tools.primary.");
    }
    if (!spec.tools?.decisionTree || spec.tools.decisionTree.length === 0) {
      warnings.push("Skill tools.decisionTree is empty — no automatic tool selection possible.");
    }
    if (!spec.tools?.dockerImages || Object.keys(spec.tools.dockerImages).length === 0) {
      errors.push("Skill must define at least one dockerImages entry.");
    }

    // Validate QC gates
    if (!spec.qcGates || spec.qcGates.length === 0) {
      warnings.push("Skill has no QC gates — quality will not be checked.");
    }
    for (const gate of spec.qcGates ?? []) {
      if (!gate.id || !gate.name) {
        errors.push("Each QC gate must have an id and name.");
      }
      if (!gate.check || !gate.check.type || !gate.check.expression) {
        errors.push(
          `QC gate "${gate.id}" must define check.type and check.expression.`,
        );
      }
    }

    // Validate dependencies: referenced skills should be registered
    // (Note: only if this is checked after registration; skip for pre-registration validation)
    for (const dep of spec.dependencies.requires) {
      if (dep === spec.name) {
        errors.push(`Skill "${spec.name}" requires itself (circular dependency).`);
      }
    }
    for (const conflict of spec.dependencies.conflicts) {
      if (conflict === spec.name) {
        errors.push(`Skill "${spec.name}" declares conflict with itself.`);
      }
    }

    // Validate resourceEstimate
    if (!spec.resourceEstimate) {
      errors.push("Skill must define resourceEstimate.");
    } else {
      if (!spec.resourceEstimate.cpu) warnings.push("resourceEstimate.cpu is missing.");
      if (!spec.resourceEstimate.ram) warnings.push("resourceEstimate.ram is missing.");
      if (!spec.resourceEstimate.disk) warnings.push("resourceEstimate.disk is missing.");
      if (!spec.resourceEstimate.time) warnings.push("resourceEstimate.time is missing.");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 按关键词搜索 Skill。
   *
   * 搜索范围：Skill 名称、描述、工具名称。
   *
   * @param query - 搜索关键词
   * @returns 匹配的 Skill 数组
   */
  search(query: string): BaseSkill[] {
    const lowerQuery = query.toLowerCase();
    return [...this.skills.values()].filter((skill) => {
      const spec = skill.spec;
      return (
        spec.name.toLowerCase().includes(lowerQuery) ||
        spec.description.toLowerCase().includes(lowerQuery) ||
        spec.tools.primary.toLowerCase().includes(lowerQuery) ||
        spec.tools.alternatives.some((a) =>
          a.toLowerCase().includes(lowerQuery),
        ) ||
        spec.omicsType.toLowerCase().includes(lowerQuery)
      );
    });
  }

  /**
   * 导出指定 Skill 的 spec 为 JSON 字符串。
   *
   * @param name - Skill 名称
   * @returns JSON 字符串，Skill 不存在时返回 null
   */
  export(name: string): string | null {
    const skill = this.get(name);
    if (!skill) return null;
    // Remove circular references — spec is a plain object, safe to serialize
    return JSON.stringify(skill.spec, null, 2);
  }
}
