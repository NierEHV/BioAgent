// ============================================================
// @bioagent/skills — BaseSkill Unit Tests
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import { BaseSkill } from "../src/base-skill";
import type {
  SkillSpec,
  SkillContext,
  SkillExecResult,
  QCReport,
  SkillOutput,
  ValidationResult,
  ToolChoice,
  DataContext,
} from "../src/base-skill.types";
import type { ResourceReport } from "@bioagent/executor";

// ---------------------------------------------------------------------------
// Mock Skill — 用于测试 BaseSkill 的 6 步管线
// ---------------------------------------------------------------------------

class MockSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "mock-skill",
    version: "1.0.0",
    description: "Mock skill for testing",
    omicsType: "scrna",
    input: {
      acceptedFormats: ["h5ad"],
      schema: {},
    },
    tools: {
      primary: "mock.tool",
      alternatives: [],
      decisionTree: [],
      dockerImages: {
        mock: { image: "mock-image:latest" },
      },
    },
    parameters: {
      defaults: {},
      descriptions: {},
      constraints: {},
    },
    qcGates: [
      {
        id: "mock_gate",
        name: "Mock Gate",
        description: "A mock QC gate",
        check: {
          type: "threshold",
          expression: "value > 0",
          metric: "value",
        },
        level: "fail",
        onPass: "Passed",
        onFail: "Failed",
        fixable: false,
      },
      {
        id: "mock_warn_gate",
        name: "Mock Warn Gate",
        description: "A mock warning gate",
        check: {
          type: "threshold",
          expression: "value > 5",
          metric: "value",
        },
        level: "warn",
        onPass: "Value is good",
        onFail: "Value is low",
        fixable: false,
      },
    ],
    outputs: {
      files: [],
      visualizations: [],
      metrics: [],
    },
    troubleshooting: {
      common_issues: [],
    },
    dependencies: {
      requires: [],
      recommends: [],
      conflicts: [],
    },
    resourceEstimate: {
      cpu: "1",
      ram: "1GB",
      disk: "100MB",
      time: "1s",
      gpu: "not_needed",
    },
  };

  // Controllable return values for testing
  mockValidateInput: ValidationResult = { valid: true, errors: [], warnings: [] };
  mockToolChoice: ToolChoice = {
    tool: "mock.tool",
    reason: "test",
    image: "mock-image:latest",
  };
  mockParams: Record<string, unknown> = {};
  mockExecResult: SkillExecResult = {
    exitCode: 0,
    stdout: '{"value": 10}',
    stderr: "",
    parsedData: { value: 10 },
    metrics: { value: 10 },
  };

  async validateInput(_data: DataContext): Promise<ValidationResult> {
    return this.mockValidateInput;
  }

  async selectTool(
    _data: DataContext,
    _resources: ResourceReport,
  ): Promise<ToolChoice> {
    return this.mockToolChoice;
  }

  async configureParams(
    _data: DataContext,
    _tool: ToolChoice,
  ): Promise<Record<string, unknown>> {
    return this.mockParams;
  }

  async run(_context: SkillContext): Promise<SkillExecResult> {
    return this.mockExecResult;
  }

  async runQC(results: SkillExecResult): Promise<QCReport> {
    return this.runQCGates(results.metrics);
  }

  async formatOutput(
    results: SkillExecResult,
    qc: QCReport,
  ): Promise<SkillOutput> {
    return {
      files: [],
      metrics: results.metrics,
      logs: [`QC: ${qc.overall}`],
    };
  }
}

// ---------------------------------------------------------------------------
// Minimal Skill Context factory
// ---------------------------------------------------------------------------

function buildSkillContext(overrides: Partial<SkillContext> = {}): SkillContext {
  return {
    skillName: "mock-skill",
    params: {},
    data: {
      inputPath: "/data/input/test.h5ad",
      outputPath: "/data/output",
      intermediatePath: "/data/intermediate",
    },
    containerName: "bioagent-test",
    containerManager: {} as any,
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
// Tests
// ---------------------------------------------------------------------------

describe("BaseSkill", () => {
  let skill: MockSkill;
  let context: SkillContext;

  beforeEach(() => {
    skill = new MockSkill();
    context = buildSkillContext();
  });

  describe("spec", () => {
    it("should have a valid spec", () => {
      expect(skill.spec.name).toBe("mock-skill");
      expect(skill.spec.version).toBe("1.0.0");
      expect(skill.spec.omicsType).toBe("scrna");
    });
  });

  describe("execute() — 6-step pipeline", () => {
    it("should return success when all gates pass", async () => {
      skill.mockExecResult = {
        exitCode: 0,
        stdout: '{"value": 10}',
        stderr: "",
        parsedData: { value: 10 },
        metrics: { value: 10 },
      };

      const result = await skill.execute(context);

      expect(result.status).toBe("success");
      expect(result.qcReport.overall).toBe("pass");
      expect(result.qcReport.passed).toBe(2);
      expect(result.qcReport.failed).toBe(0);
      expect(result.skillName).toBe("mock-skill");
      expect(result.skillVersion).toBe("1.0.0");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should return partial when some gates warn and none fail", async () => {
      skill.mockExecResult = {
        exitCode: 0,
        stdout: '{"value": 3}',
        stderr: "",
        parsedData: { value: 3 },
        metrics: { value: 3 },
      };

      const result = await skill.execute(context);

      expect(result.status).toBe("partial");
      expect(result.qcReport.overall).toBe("warn");
      expect(result.qcReport.warned).toBe(1);
      expect(result.qcReport.passed).toBe(1);
    });

    it("should return failed when a fail-level gate fails", async () => {
      skill.mockExecResult = {
        exitCode: 0,
        stdout: '{"value": 0}',
        stderr: "",
        parsedData: { value: 0 },
        metrics: { value: 0 },
      };

      const result = await skill.execute(context);

      expect(result.status).toBe("failed");
      expect(result.qcReport.overall).toBe("fail");
      expect(result.qcReport.failed).toBeGreaterThanOrEqual(1);
    });

    it("should return failed on input validation failure", async () => {
      skill.mockValidateInput = {
        valid: false,
        errors: ["Invalid input: file not found"],
        warnings: [],
      };

      const result = await skill.execute(context);

      expect(result.status).toBe("failed");
      expect(result.qcReport.overall).toBe("fail");
      expect(result.nextSteps).toContain("Input validation failed.");
      expect(result.outputs.files).toHaveLength(0);
    });

    it("should handle runtime errors gracefully", async () => {
      skill.run = async () => {
        throw new Error("Container connection refused");
      };

      skill.spec.troubleshooting.common_issues.push({
        symptom: "connection refused",
        likely_cause: "Docker not running",
        diagnosis: "Check docker daemon",
        fix: "Start Docker",
        severity: "blocking",
      });

      const result = await skill.execute(context);

      expect(result.status).toBe("error");
      expect(result.error).toContain("Container connection refused");
      expect(result.qcReport.overall).toBe("fail");
      expect(result.nextSteps.length).toBeGreaterThan(1);
    });

    it("should record duration", async () => {
      const result = await skill.execute(context);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe("number");
    });

    it("should record execution timestamp in ISO 8601", async () => {
      const result = await skill.execute(context);
      expect(() => new Date(result.executedAt)).not.toThrow();
    });
  });

  describe("runQCGates()", () => {
    it("should return pass when all gates pass", () => {
      const report = skill.runQCGates({ value: 10 });
      expect(report.overall).toBe("pass");
      expect(report.passed).toBe(2);
      expect(report.failed).toBe(0);
      expect(report.total).toBe(2);
    });

    it("should return warn for warn-level gate failures", () => {
      const report = skill.runQCGates({ value: 3 });
      expect(report.overall).toBe("warn");
      expect(report.warned).toBe(1);
      expect(report.passed).toBe(1);
    });

    it("should return fail for fail-level gate failures", () => {
      const report = skill.runQCGates({ value: 0 });
      expect(report.overall).toBe("fail");
      expect(report.failed).toBe(1);
    });

    it("should handle missing metrics gracefully", () => {
      const report = skill.runQCGates({});
      expect(report.overall).toBe("fail");
    });

    it("should include gate details in output", () => {
      const report = skill.runQCGates({ value: 10 });
      expect(report.gates).toHaveLength(2);
      expect(report.gates[0].id).toBe("mock_gate");
      expect(report.gates[0].result).toBe("pass");
      expect(report.gates[0].actualValue).toBe(10);
    });
  });

  describe("evaluateGateExpression()", () => {
    it("should evaluate simple comparisons", () => {
      expect(skill.evaluateGateExpression("x > 5", { x: 10 })).toBe(true);
      expect(skill.evaluateGateExpression("x > 5", { x: 3 })).toBe(false);
    });

    it("should evaluate compound expressions", () => {
      expect(
        skill.evaluateGateExpression("a > 0 && b > 0", { a: 1, b: 2 }),
      ).toBe(true);
      expect(
        skill.evaluateGateExpression("a > 0 && b > 0", { a: 1, b: 0 }),
      ).toBe(false);
    });

    it("should evaluate OR expressions", () => {
      expect(
        skill.evaluateGateExpression("a > 5 || b > 5", { a: 10, b: 2 }),
      ).toBe(true);
      expect(
        skill.evaluateGateExpression("a > 5 || b > 5", { a: 2, b: 2 }),
      ).toBe(false);
    });

    it("should handle expressions with percentage values", () => {
      expect(
        skill.evaluateGateExpression("pct > 30", { pct: 80 }),
      ).toBe(true);
      expect(
        skill.evaluateGateExpression("pct < 20", { pct: 25 }),
      ).toBe(false);
    });

    it("should return false for suspicious expressions", () => {
      expect(
        skill.evaluateGateExpression("while(true){}", { x: 1 }),
      ).toBe(false);
    });
  });

  describe("parseJSONFromStdout()", () => {
    it("should parse JSON from last line", () => {
      const stdout = 'Log line 1\nLog line 2\n{"key": "value"}';
      const result = skill.parseJSONFromStdout(stdout);
      expect(result).toEqual({ key: "value" });
    });

    it("should parse JSON array", () => {
      const stdout = 'prefix\n[1, 2, 3]';
      const result = skill.parseJSONFromStdout(stdout);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should return empty object for non-JSON stdout", () => {
      const stdout = "Just some text output";
      const result = skill.parseJSONFromStdout(stdout);
      expect(result).toEqual({});
    });

    it("should return empty object for empty stdout", () => {
      const result = skill.parseJSONFromStdout("");
      expect(result).toEqual({});
    });
  });

  describe("buildNextSteps()", () => {
    it("should suggest proceed on pass", () => {
      const qc: QCReport = {
        overall: "pass",
        gates: [],
        passed: 1,
        warned: 0,
        failed: 0,
        total: 1,
      };
      const steps = skill.buildNextSteps(qc);
      expect(steps.some((s) => s.includes("Proceed"))).toBe(true);
    });

    it("should warn on warn", () => {
      const qc: QCReport = {
        overall: "warn",
        gates: [
          {
            id: "test_gate",
            name: "Test",
            result: "warn",
            detail: "Value is low",
          },
        ],
        passed: 0,
        warned: 1,
        failed: 0,
        total: 1,
      };
      const steps = skill.buildNextSteps(qc);
      expect(steps.some((s) => s.includes("Review"))).toBe(true);
    });

    it("should suggest troubleshooting on fail", () => {
      const qc: QCReport = {
        overall: "fail",
        gates: [
          {
            id: "mock_gate",
            name: "Mock Gate",
            result: "fail",
            detail: "Failed",
          },
        ],
        passed: 0,
        warned: 0,
        failed: 1,
        total: 1,
      };
      const steps = skill.buildNextSteps(qc);
      expect(steps.some((s) => s.includes("Troubleshooting"))).toBe(true);
    });
  });
});
