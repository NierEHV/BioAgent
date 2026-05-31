// ============================================================
// @bioagent/skills — BaseSkill 抽象类
// ============================================================

import type {
  SkillSpec,
  SkillContext,
  SkillResult,
  SkillOutput,
  SkillOutputFile,
  SkillExecResult,
  QCReport,
  QCGateResult,
  ValidationResult,
  ToolChoice,
  DataContext,
} from "./base-skill.types";
import type { ResourceReport, ExecResult } from "@bioagent/executor";

// ---------------------------------------------------------------------------
// BaseSkill — 所有 Skill 的抽象基类
// ---------------------------------------------------------------------------

/**
 * 所有生物信息学 Skill 的抽象基类。
 *
 * 每个子类必须：
 * 1. 定义 `spec` — 完整的 SkillSpec 元数据
 * 2. 实现 6 个抽象方法 — validateInput, selectTool, configureParams, run, runQC, formatOutput
 *
 * execute() 方法实现标准 6 步管线编排：
 *   ① 输入校验 → ② 工具选择 → ③ 参数配置 → ④ 执行 → ⑤ QC → ⑥ 格式化输出
 */
export abstract class BaseSkill {
  /** Skill 规格描述 — 子类必须覆盖 */
  abstract readonly spec: SkillSpec;

  // -------------------------------------------------------------------------
  // 6 步管线编排（模板方法）
  // -------------------------------------------------------------------------

  /**
   * 执行完整的 6 步管线。
   *
   * @param context - Skill 运行时上下文
   * @returns SkillResult — 包含执行状态、QC 报告、输出和后续建议
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    const startTime = Date.now();

    try {
      // ① 输入校验
      const validation = await this.validateInput(context.data);
      if (!validation.valid) {
        return this.buildFailureResult(validation.errors, validation.warnings, startTime);
      }

      // ② 工具选择
      const toolChoice = await this.selectTool(context.data, context.resources);

      // ③ 参数配置
      const params = await this.configureParams(context.data, toolChoice);
      // 将配置好的参数合并到 context.params
      context.params = { ...context.params, ...params };

      // ④ 执行
      const execResult = await this.run(context);

      // ⑤ QC
      const qcReport = await this.runQC(execResult);

      // ⑥ 格式化输出
      const outputs = await this.formatOutput(execResult, qcReport);

      // 判定最终状态
      let status: SkillResult["status"];
      if (qcReport.failed > 0) {
        status = qcReport.overall === "fail" ? "failed" : "partial";
      } else if (qcReport.warned > 0) {
        status = "partial";
      } else {
        status = "success";
      }

      return {
        skillName: this.spec.name,
        skillVersion: this.spec.version,
        status,
        qcReport,
        outputs,
        nextSteps: this.buildNextSteps(qcReport),
        duration: Date.now() - startTime,
        executedAt: new Date().toISOString(),
      };
    } catch (error) {
      return this.buildErrorResult(error, Date.now() - startTime);
    }
  }

  // -------------------------------------------------------------------------
  // 6 个抽象方法 — 子类必须实现
  // -------------------------------------------------------------------------

  /**
   * ① 输入校验 — 检查输入文件是否存在、格式是否正确、数据是否完整。
   *
   * @param data - 数据上下文（输入/输出路径等）
   * @returns ValidationResult — 校验是否通过及错误/警告信息
   */
  abstract validateInput(data: DataContext): Promise<ValidationResult>;

  /**
   * ② 工具选择 — 根据输入数据和宿主资源选择合适的工具和 Docker 镜像。
   *
   * @param data - 数据上下文
   * @param resources - 宿主机资源报告
   * @returns ToolChoice — 选中的工具、理由和 Docker 镜像
   */
  abstract selectTool(
    data: DataContext,
    resources: ResourceReport,
  ): Promise<ToolChoice>;

  /**
   * ③ 参数配置 — 根据数据和工具选择配置具体的分析参数。
   *
   * @param data - 数据上下文
   * @param tool - 选中的工具信息
   * @returns 参数键值对
   */
  abstract configureParams(
    data: DataContext,
    tool: ToolChoice,
  ): Promise<Record<string, unknown>>;

  /**
   * ④ 执行 — 在 Docker 容器中运行实际的分析命令。
   *
   * 典型实现：通过 context.containerManager.execInContainer() 执行 Python/R 脚本。
   *
   * @param context - Skill 运行时上下文
   * @returns SkillExecResult — 执行结果（包含解析后的结构化数据）
   */
  abstract run(context: SkillContext): Promise<SkillExecResult>;

  /**
   * ⑤ QC — 对执行结果运行所有 QC 关卡。
   *
   * 每个 QC gate 的 expression 会被求值并记录通过/警告/失败状态。
   *
   * @param results - Skill 执行结果
   * @returns QCReport — 聚合的 QC 报告
   */
  abstract runQC(results: SkillExecResult): Promise<QCReport>;

  /**
   * ⑥ 格式化输出 — 将执行结果和 QC 报告格式化为标准化的 SkillOutput。
   *
   * @param results - Skill 执行结果
   * @param qc - QC 报告
   * @returns SkillOutput — 文件列表、指标、日志
   */
  abstract formatOutput(
    results: SkillExecResult,
    qc: QCReport,
  ): Promise<SkillOutput>;

  // -------------------------------------------------------------------------
  // 辅助方法
  // -------------------------------------------------------------------------

  /**
   * 根据 QC 报告生成后续步骤建议。
   *
   * 默认行为：
   * - 若 overall 为 pass，建议继续下一步
   * - 若 overall 为 warn，建议检查警告项后再继续
   * - 若 overall 为 fail，从 troubleshooting 中提取对应的修复建议
   *
   * @param qc - QC 报告
   * @returns 建议步骤的字符串数组
   */
  protected buildNextSteps(qc: QCReport): string[] {
    const steps: string[] = [];

    if (qc.overall === "pass") {
      steps.push("QC passed. Proceed to next step.");
      // 如果有下游推荐 Skill，给出建议
      if (this.spec.dependencies.recommends.length > 0) {
        steps.push(
          `Recommended next skills: ${this.spec.dependencies.recommends.join(", ")}`,
        );
      }
    } else if (qc.overall === "warn") {
      steps.push("QC has warnings. Review the following before proceeding:");
      for (const gate of qc.gates) {
        if (gate.result === "warn") {
          steps.push(`  [${gate.id}] ${gate.detail}`);
        }
      }
    } else {
      // overall === "fail"
      steps.push("QC failed. Troubleshooting suggestions:");
      const failedGateIds = new Set(
        qc.gates.filter((g) => g.result === "fail").map((g) => g.id),
      );

      for (const issue of this.spec.troubleshooting.common_issues) {
        // 如果 troubleshooting 条目的 symptom 匹配了某个失败 gate，加入建议
        for (const gate of qc.gates) {
          if (
            gate.result === "fail" &&
            (issue.symptom.toLowerCase().includes(gate.id.toLowerCase()) ||
              gate.detail.toLowerCase().includes(issue.symptom.toLowerCase()))
          ) {
            if (!steps.includes(`  Fix: ${issue.fix}`)) {
              steps.push(`  Symptom: ${issue.symptom}`);
              steps.push(
                `  Diagnosis: ${issue.diagnosis}`,
              );
              steps.push(`  Fix: ${issue.fix}`);
            }
          }
        }
      }

      // 如果没有任何匹配的 troubleshooting，添加通用建议
      if (steps.length === 1) {
        for (const gate of qc.gates) {
          if (gate.result === "fail") {
            steps.push(`  Gate "${gate.name}" failed: ${gate.detail}`);
          }
        }
      }
    }

    return steps;
  }

  /**
   * 构建校验失败时的 SkillResult。
   */
  protected buildFailureResult(
    errors: string[],
    warnings: string[],
    startTime: number,
  ): SkillResult {
    const gates: QCGateResult[] = errors.map((err, i) => ({
      id: `validation_error_${i}`,
      name: "Input Validation",
      result: "fail" as const,
      actualValue: null,
      expectedValue: null,
      detail: err,
    }));

    return {
      skillName: this.spec.name,
      skillVersion: this.spec.version,
      status: "failed",
      qcReport: {
        overall: "fail",
        gates,
        passed: 0,
        warned: warnings.length,
        failed: errors.length,
        total: errors.length + warnings.length,
      },
      outputs: {
        files: [],
        metrics: {},
        logs: [...errors, ...warnings],
      },
      nextSteps: [
        "Input validation failed.",
        ...errors.map((e) => `Fix: ${e}`),
      ],
      duration: Date.now() - startTime,
      executedAt: new Date().toISOString(),
    };
  }

  /**
   * 构建异常发生时的 SkillResult。
   */
  protected buildErrorResult(
    error: unknown,
    duration: number,
  ): SkillResult {
    const message =
      error instanceof Error ? error.message : String(error);

    return {
      skillName: this.spec.name,
      skillVersion: this.spec.version,
      status: "error",
      qcReport: {
        overall: "fail",
        gates: [
          {
            id: "runtime_error",
            name: "Runtime Error",
            result: "fail",
            actualValue: message,
            expectedValue: null,
            detail: `Unexpected error during execution: ${message}`,
          },
        ],
        passed: 0,
        warned: 0,
        failed: 1,
        total: 1,
      },
      outputs: {
        files: [],
        metrics: {},
        logs: [message],
      },
      nextSteps: [
        "An unexpected error occurred during execution.",
        `Error: ${message}`,
        ...this.spec.troubleshooting.common_issues
          .filter((issue) =>
            message.toLowerCase().includes(issue.symptom.toLowerCase()),
          )
          .flatMap((issue) => [
            `Troubleshoot: ${issue.symptom}`,
            `  Diagnosis: ${issue.diagnosis}`,
            `  Fix: ${issue.fix}`,
          ]),
      ],
      duration,
      executedAt: new Date().toISOString(),
      error: message,
    };
  }

  /**
   * 执行 Docker 容器内命令的便捷方法。
   *
   * 封装 context.containerManager.execInContainer，添加常用默认值。
   *
   * @param context - Skill 上下文
   * @param command - 要执行的 shell 命令
   * @param options - 可选执行选项
   * @returns Docker 执行结果
   */
  protected async execInContainer(
    context: SkillContext,
    command: string,
    options?: {
      workdir?: string;
      timeout?: number;
      env?: Record<string, string>;
    },
  ): Promise<ExecResult> {
    return context.containerManager.execInContainer({
      container: context.containerName,
      command,
      workdir: options?.workdir ?? context.data.outputPath,
      timeout: options?.timeout ?? 300_000, // 5 minutes default
      env: options?.env ?? {},
      captureStderr: true,
    });
  }

  /**
   * 尝试从 stdout 中解析 JSON 输出。
   *
   * Python 脚本最后一行输出 JSON 是常见的模式。
   * 本方法尝试解析 stdout 中的最后一个 JSON 对象。
   *
   * @param stdout - 标准输出文本
   * @returns 解析后的对象，解析失败返回空对象
   */
  protected parseJSONFromStdout(stdout: string): Record<string, unknown> {
    if (!stdout || stdout.trim().length === 0) {
      return {};
    }

    // 尝试解析最后一行作为 JSON（最常见模式）
    const lines = stdout.trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          return JSON.parse(trimmed);
        } catch {
          // Continue to previous line
        }
      }
    }

    // 尝试解析整个 stdout 作为 JSON
    try {
      return JSON.parse(stdout.trim());
    } catch {
      // Not valid JSON, return empty
    }

    return {};
  }

  /**
   * 求值 QC gate 的 expression。
   *
   * 使用安全的表达式求值：只支持简单的比较和逻辑运算。
   *
   * @param expression - 表达式字符串，如 "n_cells > 0 && n_genes > 0"
   * @param metrics - 指标键值对
   * @returns 表达式求值结果
   */
  protected evaluateGateExpression(
    expression: string,
    metrics: Record<string, number>,
  ): boolean {
    try {
      // 构建一个安全的求值函数
      const metricNames = Object.keys(metrics);
      const metricValues = Object.values(metrics);

      // 替换表达式中的指标名称为对应的值
      let evaluableExpr = expression;
      for (const name of metricNames) {
        // 使用 word boundary 替换
        const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
        evaluableExpr = evaluableExpr.replace(regex, String(metrics[name]));
      }

      // 安全检查：只允许数字、运算符、括号、空格
      if (!/^[\d\s+\-*/%<>=!&|?.():,[\]'"`\w]+$/.test(evaluableExpr)) {
        return false;
      }

      // 使用 Function 构造函数进行求值
      const fn = new Function(`"use strict"; return (${evaluableExpr});`);
      const result = fn();
      return Boolean(result);
    } catch {
      return false;
    }
  }

  /**
   * 运行所有 QC gates 并生成 QCReport。
   *
   * 这是一个便捷方法，子类的 runQC() 可以调用它，
   * 也可以完全自定义实现。
   *
   * @param metrics - 从执行结果中提取的指标
   * @returns QCReport
   */
  protected runQCGates(metrics: Record<string, number>): QCReport {
    const gateResults: QCGateResult[] = [];
    let passed = 0;
    let warned = 0;
    let failed = 0;

    for (const gate of this.spec.qcGates) {
      let result: "pass" | "warn" | "fail";
      let detail: string;

      try {
        const passed_ = this.evaluateGateExpression(
          gate.check.expression,
          metrics,
        );

        if (passed_) {
          result = "pass";
          detail = gate.onPass;
          passed++;
        } else {
          // 根据 gate level 决定是 warn 还是 fail
          if (gate.level === "fail") {
            result = "fail";
            detail = gate.onFail;
            failed++;
          } else {
            result = "warn";
            detail = gate.onFail;
            warned++;
          }
        }
      } catch {
        result = "fail";
        detail = `Failed to evaluate expression: ${gate.check.expression}`;
        failed++;
      }

      const actualValue =
        gate.check.metric in metrics
          ? metrics[gate.check.metric]
          : undefined;

      gateResults.push({
        id: gate.id,
        name: gate.name,
        result,
        actualValue,
        expectedValue: gate.check.expression,
        detail,
      });
    }

    // 确定 overall
    let overall: QCReport["overall"];
    if (failed > 0) {
      overall = "fail";
    } else if (warned > 0) {
      overall = "warn";
    } else {
      overall = "pass";
    }

    return {
      overall,
      gates: gateResults,
      passed,
      warned,
      failed,
      total: gateResults.length,
    };
  }
}
