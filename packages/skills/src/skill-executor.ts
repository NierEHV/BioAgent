// ============================================================
// @bioagent/skills — SkillExecutor
// ============================================================

import type { ContainerManager, ResourceReport } from "@bioagent/executor";
import type { SkillRegistry } from "./skill-registry";
import type { SkillContext, SkillResult, SkillSpec } from "./base-skill.types";

/**
 * 资源检查结果。
 */
export interface ResourceCheckResult {
  /** 资源是否充足 */
  ok: boolean;
  /** 警告信息列表 */
  warnings: string[];
}

/**
 * Skill 执行器。
 *
 * 职责：
 * - 查找 Skill 并检查存在性
 * - 检查前置依赖链是否就绪
 * - 资源充足性检查（比较宿主机资源 vs Skill 资源估算）
 * - 调用 skill.execute(context)
 * - QC 失败时自动查询故障排除建议
 * - 日志记录
 */
export class SkillExecutor {
  constructor(
    private registry: SkillRegistry,
    private containerManager: ContainerManager,
    private logger?: {
      info: (msg: string | Record<string, unknown>, ...args: unknown[]) => void;
      warn: (msg: string | Record<string, unknown>, ...args: unknown[]) => void;
      error: (msg: string | Record<string, unknown>, ...args: unknown[]) => void;
    },
  ) {}

  /**
   * 执行指定的 Skill。
   *
   * 完整流程：
   * 1. 获取 Skill，检查存在性
   * 2. 检查前置依赖链
   * 3. 资源检查
   * 4. 调用 skill.execute(context)
   * 5. QC 失败时自动查询故障排除建议
   * 6. 日志记录
   *
   * @param skillName - 要执行的 Skill 名称
   * @param context - Skill 运行时上下文
   * @returns SkillResult
   * @throws 如果 Skill 未注册
   */
  async execute(
    skillName: string,
    context: SkillContext,
  ): Promise<SkillResult> {
    // 1. 获取 Skill，检查存在性
    const skill = this.registry.get(skillName);
    if (!skill) {
      throw new Error(
        `Unknown skill: "${skillName}". Available skills: ${this.registry.listNames().join(", ")}`,
      );
    }

    // 2. 检查前置依赖链
    const deps = this.registry.getDependencyChain(skillName);
    const missingDeps: string[] = [];
    for (const dep of deps) {
      if (!this.registry.has(dep)) {
        missingDeps.push(dep);
      }
    }
    this.logger?.info({
      msg: `Executing skill "${skillName}"`,
      deps,
      missingDeps: missingDeps.length > 0 ? missingDeps : undefined,
    });

    if (missingDeps.length > 0) {
      const msg = `Skill "${skillName}" has unregistered dependencies: ${missingDeps.join(", ")}. Register them first.`;
      this.logger?.warn(msg);
      if (!context.force) {
        throw new Error(msg);
      }
      this.logger?.warn({ msg: "Force flag set — proceeding despite missing dependencies." });
    }

    // 3. 资源检查
    const estimate = skill.spec.resourceEstimate;
    const resourceCheck = this.checkResources(context.resources, estimate);
    if (!resourceCheck.ok) {
      this.logger?.warn({
        msg: `Resource warnings for "${skillName}"`,
        warnings: resourceCheck.warnings,
      });
      if (!context.force) {
        this.logger?.info("Continuing despite resource warnings (non-blocking).");
      }
    }

    // 4. 调用 skill.execute(context)
    const result = await skill.execute(context);

    // 5. QC 失败时自动查询故障排除建议
    if (result.qcReport.overall === "fail" && !context.force) {
      const troubleshooting = skill.spec.troubleshooting.common_issues.filter(
        (issue) =>
          result.qcReport.gates.some((g) =>
            g.detail.toLowerCase().includes(issue.symptom.toLowerCase()) ||
            issue.symptom.toLowerCase().includes(g.name.toLowerCase()),
          ),
      );

      if (troubleshooting.length > 0) {
        const fixSteps = troubleshooting.flatMap((t) => [
          `Troubleshoot: ${t.symptom}`,
          `  Cause: ${t.likely_cause}`,
          `  Diagnosis: ${t.diagnosis}`,
          `  Fix: ${t.fix}`,
        ]);
        result.nextSteps.push(...fixSteps);
      }

      // Add generic fallback suggestions if no specific troubleshooting matched
      if (troubleshooting.length === 0) {
        result.nextSteps.push("QC failed with no matching troubleshooting entries.");
        result.nextSteps.push("Check the container logs and verify input data integrity.");
      }
    }

    // 6. 日志记录
    this.logger?.info({
      msg: `Skill "${skillName}" completed`,
      status: result.status,
      qc: result.qcReport.overall,
      duration: result.duration,
      passed: result.qcReport.passed,
      warned: result.qcReport.warned,
      failed: result.qcReport.failed,
    });

    if (result.status === "error") {
      this.logger?.error({
        msg: `Skill "${skillName}" errored`,
        error: result.error,
        duration: result.duration,
      });
    }

    return result;
  }

  /**
   * 检查宿主机资源是否满足 Skill 的估算需求。
   *
   * 比较项：
   * - CPU 核心数
   * - 可用内存
   * - 可用磁盘空间
   * - GPU（如果需要）
   *
   * 注意：此检查是尽力而为的，不保证精确匹配。
   *
   * @param available - 宿主机资源报告
   * @param needed - Skill 资源估算
   * @returns 检查结果（ok + warnings）
   */
  checkResources(
    available: ResourceReport,
    needed: SkillSpec["resourceEstimate"],
  ): ResourceCheckResult {
    const warnings: string[] = [];

    // CPU check
    const neededCpu = parseFloat(needed.cpu);
    if (!isNaN(neededCpu) && neededCpu > available.cpu.cores) {
      warnings.push(
        `CPU: needed ${needed.cpu} cores, available ${available.cpu.cores} cores (${available.cpu.model}). May be slower than expected.`,
      );
    }

    // RAM check
    const ramMatch = needed.ram.match(/^(\d+(?:\.\d+)?)\s*(GB|MB|TB)?$/i);
    if (ramMatch) {
      const ramValue = parseFloat(ramMatch[1]);
      const ramUnit = (ramMatch[2] ?? "GB").toUpperCase();
      let ramGB = ramValue;
      if (ramUnit === "MB") ramGB = ramValue / 1024;
      if (ramUnit === "TB") ramGB = ramValue * 1024;

      if (ramGB > available.memory.available_gb) {
        warnings.push(
          `RAM: needed ${needed.ram}, available ${available.memory.available_gb.toFixed(1)} GB. May cause swapping or OOM.`,
        );
      }
    }

    // Disk check
    const diskMatch = needed.disk.match(/^(\d+(?:\.\d+)?)\s*(GB|MB|TB)?$/i);
    if (diskMatch) {
      const diskValue = parseFloat(diskMatch[1]);
      const diskUnit = (diskMatch[2] ?? "GB").toUpperCase();
      let diskGB = diskValue;
      if (diskUnit === "MB") diskGB = diskValue / 1024;
      if (diskUnit === "TB") diskGB = diskValue * 1024;

      // Check primary volume available space
      const primaryVolume = available.disk.volumes[0];
      if (primaryVolume && diskGB > primaryVolume.available_gb) {
        warnings.push(
          `Disk: needed ${needed.disk}, available ${primaryVolume.available_gb.toFixed(1)} GB on ${primaryVolume.mount}.`,
        );
      }
    }

    // GPU check
    if (needed.gpu === "required" && !available.gpu.available) {
      warnings.push(
        "GPU: required but not available. Skill may fail or fall back to CPU.",
      );
    } else if (needed.gpu === "optional" && !available.gpu.available) {
      warnings.push(
        "GPU: optional but not available. Skill will run on CPU (may be slower).",
      );
    }

    return {
      ok: true, // Resource check is advisory, never blocking
      warnings,
    };
  }
}
