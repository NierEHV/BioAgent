// ============================================================
// @bioagent/skills — SkillExecutor Unit Tests
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BaseSkill } from "../src/base-skill";
import { SkillRegistry } from "../src/skill-registry";
import { SkillExecutor } from "../src/skill-executor";
import type {
  SkillSpec,
  SkillContext,
  SkillExecResult,
  QCReport,
  SkillOutput,
  ValidationResult,
  ToolChoice,
  DataContext,
  SkillResult,
} from "../src/base-skill.types";
import type { ResourceReport, ContainerManager } from "@bioagent/executor";

// ---------------------------------------------------------------------------
// Helper: create a minimal mock skill
// ---------------------------------------------------------------------------

function createMockSkill(
  name: string,
  requires: string[] = [],
  resourceEstimate: SkillSpec["resourceEstimate"] = {
    cpu: "1",
    ram: "1GB",
    disk: "100MB",
    time: "1s",
    gpu: "not_needed",
  },
): BaseSkill {
  class TestSkill extends BaseSkill {
    readonly spec: SkillSpec = {
      name,
      version: "1.0.0",
      description: `${name} description`,
      omicsType: "scrna",
      input: { acceptedFormats: ["h5ad"], schema: {} },
      tools: {
        primary: `${name}.tool`,
        alternatives: [],
        decisionTree: [],
        dockerImages: { [name]: { image: `${name}-image:latest` } },
      },
      parameters: { defaults: {}, descriptions: {}, constraints: {} },
      qcGates: [
        {
          id: `${name}_gate`,
          name: `${name} Gate`,
          description: "Test gate",
          check: { type: "threshold", expression: "ok > 0", metric: "ok" },
          level: "fail",
          onPass: "ok",
          onFail: "not ok",
          fixable: false,
        },
      ],
      outputs: { files: [], visualizations: [], metrics: [] },
      troubleshooting: {
        common_issues: [
          {
            symptom: "not ok",
            likely_cause: "Bad data",
            diagnosis: "Check input",
            fix: "Provide valid input",
            severity: "blocking",
          },
        ],
      },
      dependencies: { requires, recommends: [], conflicts: [] },
      resourceEstimate,
    };

    async validateInput(_: DataContext): Promise<ValidationResult> {
      return { valid: true, errors: [], warnings: [] };
    }
    async selectTool(_d: DataContext, _r: ResourceReport): Promise<ToolChoice> {
      return { tool: `${name}.tool`, reason: "test", image: `${name}-image:latest` };
    }
    async configureParams(_d: DataContext, _t: ToolChoice): Promise<Record<string, unknown>> {
      return {};
    }
    async run(_c: SkillContext): Promise<SkillExecResult> {
      return { exitCode: 0, stdout: '{"ok": 1}', stderr: "", parsedData: { ok: 1 }, metrics: { ok: 1 } };
    }
    async runQC(r: SkillExecResult): Promise<QCReport> {
      return this.runQCGates(r.metrics);
    }
    async formatOutput(r: SkillExecResult, q: QCReport): Promise<SkillOutput> {
      return { files: [], metrics: r.metrics, logs: [`QC: ${q.overall}`] };
    }
  }
  return new TestSkill();
}

// ---------------------------------------------------------------------------
// Helper: build SkillContext
// ---------------------------------------------------------------------------

function buildSkillContext(overrides: Partial<SkillContext> = {}): SkillContext {
  return {
    skillName: "test-skill",
    params: {},
    data: {
      inputPath: "/data/input/test.h5ad",
      outputPath: "/data/output",
      intermediatePath: "/data/intermediate",
    },
    containerName: "bioagent-test",
    containerManager: {} as ContainerManager,
    resources: {
      hostname: "test",
      os: { platform: "linux" },
      cpu: { model: "test", cores: 8, threads: 16, architecture: "x86_64" },
      memory: { total_gb: 32, available_gb: 16 },
      gpu: { available: false },
      disk: {
        volumes: [{ mount: "/", total_gb: 100, available_gb: 50, type: "ssd" }],
      },
      docker: {
        installed: true,
        running: true,
        compose_available: true,
        images_cached: [],
      },
      python: { installed: true },
      r: { installed: false },
      network: {
        canReachInternet: true,
        canReachDockerHub: true,
        canReachQuayIO: true,
      },
    },
    force: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock logger
// ---------------------------------------------------------------------------

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SkillExecutor", () => {
  let registry: SkillRegistry;
  let executor: SkillExecutor;
  let containerManager: ContainerManager;
  let logger: ReturnType<typeof createMockLogger>;
  let context: SkillContext;

  beforeEach(() => {
    registry = new SkillRegistry();
    containerManager = {} as ContainerManager;
    logger = createMockLogger();
    executor = new SkillExecutor(registry, containerManager, logger);
    context = buildSkillContext();
  });

  describe("execute()", () => {
    it("should execute a registered skill successfully", async () => {
      const skill = createMockSkill("test-skill");
      registry.register(skill);
      context.skillName = "test-skill";

      const result = await executor.execute("test-skill", context);

      expect(result.status).toBe("success");
      expect(result.skillName).toBe("test-skill");
      expect(logger.info).toHaveBeenCalled();
    });

    it("should throw on unregistered skill", async () => {
      await expect(
        executor.execute("ghost-skill", context),
      ).rejects.toThrow(/Unknown skill/);
    });

    it("should warn about missing dependencies", async () => {
      // test-skill requires "missing-dep" which is not registered
      const skill = createMockSkill("test-skill", ["missing-dep"]);
      registry.register(skill);
      context.skillName = "test-skill";

      // Non-force mode should throw
      await expect(
        executor.execute("test-skill", context),
      ).rejects.toThrow(/unregistered dependencies/);

      expect(logger.warn).toHaveBeenCalled();
    });

    it("should continue with force flag despite missing deps", async () => {
      const skill = createMockSkill("test-skill", ["missing-dep"]);
      registry.register(skill);
      context.skillName = "test-skill";
      context.force = true;

      const result = await executor.execute("test-skill", context);
      expect(result.status).toBe("success");
    });

    it("should log completion with status and QC info", async () => {
      const skill = createMockSkill("test-skill");
      registry.register(skill);
      context.skillName = "test-skill";

      const result = await executor.execute("test-skill", context);

      const completionLog = logger.info.mock.calls.find((call: any[]) => {
        const arg = call[0];
        return typeof arg === "object" && arg.msg && arg.msg.includes("completed");
      });
      expect(completionLog).toBeTruthy();
      expect(completionLog[0].status).toBe("success");
    });

    it("should add troubleshooting suggestions on QC fail", async () => {
      // Create a skill that returns failing metrics
      class FailingSkill extends BaseSkill {
        readonly spec: SkillSpec = {
          name: "failing-skill",
          version: "1.0.0",
          description: "Always fails",
          omicsType: "scrna",
          input: { acceptedFormats: ["h5ad"], schema: {} },
          tools: {
            primary: "fail.tool",
            alternatives: [],
            decisionTree: [],
            dockerImages: { fail: { image: "fail-image:latest" } },
          },
          parameters: { defaults: {}, descriptions: {}, constraints: {} },
          qcGates: [
            {
              id: "fail_gate",
              name: "Fail Gate",
              description: "Always fails",
              check: { type: "threshold", expression: "ok > 0", metric: "ok" },
              level: "fail",
              onPass: "ok",
              onFail: "not ok",
              fixable: false,
            },
          ],
          outputs: { files: [], visualizations: [], metrics: [] },
          troubleshooting: {
            common_issues: [
              {
                symptom: "not ok",
                likely_cause: "Failed data",
                diagnosis: "Check",
                fix: "Fix it",
                severity: "blocking",
              },
            ],
          },
          dependencies: { requires: [], recommends: [], conflicts: [] },
          resourceEstimate: {
            cpu: "1", ram: "1GB", disk: "100MB", time: "1s", gpu: "not_needed",
          },
        };

        async validateInput(_: DataContext): Promise<ValidationResult> {
          return { valid: true, errors: [], warnings: [] };
        }
        async selectTool(_d: DataContext, _r: ResourceReport): Promise<ToolChoice> {
          return { tool: "fail.tool", reason: "test", image: "fail-image:latest" };
        }
        async configureParams(_d: DataContext, _t: ToolChoice): Promise<Record<string, unknown>> {
          return {};
        }
        async run(_c: SkillContext): Promise<SkillExecResult> {
          // Return metrics that will fail the gate
          return { exitCode: 0, stdout: '{"ok": 0}', stderr: "", parsedData: { ok: 0 }, metrics: { ok: 0 } };
        }
        async runQC(r: SkillExecResult): Promise<QCReport> {
          return this.runQCGates(r.metrics);
        }
        async formatOutput(r: SkillExecResult, q: QCReport): Promise<SkillOutput> {
          return { files: [], metrics: r.metrics, logs: [`QC: ${q.overall}`] };
        }
      }

      const skill = new FailingSkill();
      registry.register(skill);
      context.skillName = "failing-skill";

      const result = await executor.execute("failing-skill", context);
      expect(result.status).toBe("failed");
      // Should have troubleshooting suggestions in nextSteps
      expect(
        result.nextSteps.some((s) => s.includes("Troubleshoot") || s.includes("Fix")),
      ).toBe(true);
    });

    it("should log error on skill error", async () => {
      class ErrorSkill extends BaseSkill {
        readonly spec = createMockSkill("error-skill").spec;
        async validateInput(_: DataContext): Promise<ValidationResult> {
          return { valid: true, errors: [], warnings: [] };
        }
        async selectTool(_d: DataContext, _r: ResourceReport): Promise<ToolChoice> {
          return { tool: "e.tool", reason: "t", image: "img" };
        }
        async configureParams(_d: DataContext, _t: ToolChoice): Promise<Record<string, unknown>> {
          return {};
        }
        async run(_c: SkillContext): Promise<SkillExecResult> {
          throw new Error("Simulated failure");
        }
        async runQC(_r: SkillExecResult): Promise<QCReport> {
          return { overall: "fail", gates: [], passed: 0, warned: 0, failed: 0, total: 0 };
        }
        async formatOutput(_r: SkillExecResult, _q: QCReport): Promise<SkillOutput> {
          return { files: [], metrics: {}, logs: [] };
        }
      }

      registry.register(new ErrorSkill());
      context.skillName = "error-skill";

      const result = await executor.execute("error-skill", context);
      expect(result.status).toBe("error");
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("checkResources()", () => {
    it("should warn if CPU is insufficient", () => {
      const available: ResourceReport = {
        ...buildSkillContext().resources,
        cpu: { model: "test", cores: 1, threads: 2, architecture: "x86_64" },
      };
      const needed = { cpu: "8", ram: "1GB", disk: "100MB", time: "1s", gpu: "not_needed" as const };
      const result = executor.checkResources(available, needed);
      expect(result.warnings.some((w) => w.includes("CPU"))).toBe(true);
    });

    it("should warn if RAM is insufficient", () => {
      const available: ResourceReport = {
        ...buildSkillContext().resources,
        memory: { total_gb: 32, available_gb: 0.5 },
      };
      const needed = { cpu: "1", ram: "16GB", disk: "100MB", time: "1s", gpu: "not_needed" as const };
      const result = executor.checkResources(available, needed);
      expect(result.warnings.some((w) => w.includes("RAM"))).toBe(true);
    });

    it("should warn if disk is insufficient", () => {
      const available: ResourceReport = {
        ...buildSkillContext().resources,
        disk: {
          volumes: [{ mount: "/", total_gb: 100, available_gb: 0.5, type: "ssd" }],
        },
      };
      const needed = { cpu: "1", ram: "1GB", disk: "10GB", time: "1s", gpu: "not_needed" as const };
      const result = executor.checkResources(available, needed);
      expect(result.warnings.some((w) => w.includes("Disk"))).toBe(true);
    });

    it("should warn if GPU is required but not available", () => {
      const available = buildSkillContext().resources;
      const needed = { cpu: "1", ram: "1GB", disk: "100MB", time: "1s", gpu: "required" as const };
      const result = executor.checkResources(available, needed);
      expect(result.warnings.some((w) => w.includes("GPU"))).toBe(true);
    });

    it("should warn if GPU is optional but not available", () => {
      const available = buildSkillContext().resources;
      const needed = { cpu: "1", ram: "1GB", disk: "100MB", time: "1s", gpu: "optional" as const };
      const result = executor.checkResources(available, needed);
      expect(result.warnings.some((w) => w.includes("GPU"))).toBe(true);
    });

    it("should pass when resources are sufficient", () => {
      const available = buildSkillContext().resources;
      const needed = { cpu: "2", ram: "4GB", disk: "10GB", time: "5 min", gpu: "not_needed" as const };
      const result = executor.checkResources(available, needed);
      expect(result.warnings).toHaveLength(0);
    });

    it("should handle MB and TB units in resource estimate", () => {
      const available = buildSkillContext().resources;
      const needed = { cpu: "1", ram: "512MB", disk: "50MB", time: "1s", gpu: "not_needed" as const };
      const result = executor.checkResources(available, needed);
      // 512MB < 16GB available, 50MB < 50GB available — should pass
      expect(result.warnings).toHaveLength(0);
    });

    it("should always return ok:true (advisory only)", () => {
      const available: ResourceReport = {
        ...buildSkillContext().resources,
        cpu: { model: "test", cores: 1, threads: 1, architecture: "x86_64" },
        memory: { total_gb: 1, available_gb: 0.1 },
      };
      const needed = { cpu: "64", ram: "256GB", disk: "1TB", time: "1h", gpu: "required" as const };
      const result = executor.checkResources(available, needed);
      expect(result.ok).toBe(true); // Never blocking
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
