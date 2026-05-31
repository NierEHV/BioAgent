// ============================================================
// @bioagent/skills — SkillRegistry Unit Tests
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import { BaseSkill } from "../src/base-skill.js";
import { SkillRegistry } from "../src/skill-registry.js";
import type {
  SkillSpec,
  SkillContext,
  SkillExecResult,
  QCReport,
  SkillOutput,
  ValidationResult,
  ToolChoice,
  DataContext,
} from "../src/base-skill.types.js";
import type { ResourceReport } from "@bioagent/executor";

// ---------------------------------------------------------------------------
// Helper: create a minimal mock skill
// ---------------------------------------------------------------------------

function createMockSkill(name: string, requires: string[] = [], recommends: string[] = [], conflicts: string[] = [], omicsType: string = "scrna"): BaseSkill {
  class TestSkill extends BaseSkill {
    readonly spec: SkillSpec = {
      name,
      version: "1.0.0",
      description: `${name} description`,
      omicsType: omicsType as any,
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
      troubleshooting: { common_issues: [] },
      dependencies: { requires, recommends, conflicts },
      resourceEstimate: {
        cpu: "1",
        ram: "1GB",
        disk: "100MB",
        time: "1s",
        gpu: "not_needed",
      },
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
// Tests
// ---------------------------------------------------------------------------

describe("SkillRegistry", () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  describe("register()", () => {
    it("should register a skill", () => {
      const skill = createMockSkill("test-a");
      registry.register(skill);
      expect(registry.has("test-a")).toBe(true);
      expect(registry.get("test-a")).toBe(skill);
    });

    it("should throw on duplicate registration", () => {
      const skill1 = createMockSkill("test-a");
      const skill2 = createMockSkill("test-a");
      registry.register(skill1);
      expect(() => registry.register(skill2)).toThrow(/Duplicate/);
    });
  });

  describe("registerAll()", () => {
    it("should register multiple skills", () => {
      const skills = [
        createMockSkill("test-a"),
        createMockSkill("test-b"),
        createMockSkill("test-c"),
      ];
      registry.registerAll(skills);
      expect(registry.getAll()).toHaveLength(3);
      expect(registry.has("test-a")).toBe(true);
      expect(registry.has("test-b")).toBe(true);
      expect(registry.has("test-c")).toBe(true);
    });
  });

  describe("get()", () => {
    it("should return undefined for unregistered skill", () => {
      expect(registry.get("nonexistent")).toBeUndefined();
    });
  });

  describe("getByOmicsType()", () => {
    it("should filter by omics type", () => {
      registry.register(createMockSkill("scrna-1", [], [], [], "scrna"));
      registry.register(createMockSkill("scrna-2", [], [], [], "scrna"));
      registry.register(createMockSkill("atac-1", [], [], [], "atac"));

      const scrna = registry.getByOmicsType("scrna");
      expect(scrna).toHaveLength(2);
      expect(scrna.map((s) => s.spec.name)).toEqual(
        expect.arrayContaining(["scrna-1", "scrna-2"]),
      );

      const atac = registry.getByOmicsType("atac");
      expect(atac).toHaveLength(1);
    });
  });

  describe("getAll()", () => {
    it("should return all registered skills", () => {
      registry.register(createMockSkill("a"));
      registry.register(createMockSkill("b"));
      expect(registry.getAll()).toHaveLength(2);
    });
  });

  describe("listNames()", () => {
    it("should return all skill names", () => {
      registry.register(createMockSkill("a"));
      registry.register(createMockSkill("b"));
      expect(registry.listNames()).toEqual(
        expect.arrayContaining(["a", "b"]),
      );
    });
  });

  describe("getDependencyChain()", () => {
    it("should return empty for skill with no deps", () => {
      registry.register(createMockSkill("leaf"));
      expect(registry.getDependencyChain("leaf")).toEqual([]);
    });

    it("should collect transitive dependencies", () => {
      // A -> B -> C (A depends on B, B depends on C)
      registry.register(createMockSkill("c"));
      registry.register(createMockSkill("b", ["c"]));
      registry.register(createMockSkill("a", ["b"]));

      const chain = registry.getDependencyChain("a");
      expect(chain).toContain("b");
      expect(chain).toContain("c");
    });

    it("should return empty for unregistered skill", () => {
      expect(registry.getDependencyChain("ghost")).toEqual([]);
    });

    it("should handle diamond dependencies (dedup)", () => {
      // A -> B, C; B -> D; C -> D
      registry.register(createMockSkill("d"));
      registry.register(createMockSkill("c", ["d"]));
      registry.register(createMockSkill("b", ["d"]));
      registry.register(createMockSkill("a", ["b", "c"]));

      const chain = registry.getDependencyChain("a");
      // D should appear only once
      const dCount = chain.filter((x) => x === "d").length;
      expect(dCount).toBe(1);
    });
  });

  describe("getDownstream()", () => {
    it("should find skills that depend on the given skill", () => {
      registry.register(createMockSkill("base"));
      registry.register(createMockSkill("derived", ["base"]));
      registry.register(createMockSkill("unrelated"));

      const downstream = registry.getDownstream("base");
      expect(downstream).toContain("derived");
      expect(downstream).not.toContain("unrelated");
    });

    it("should find skills that recommend the given skill", () => {
      registry.register(createMockSkill("base"));
      registry.register(createMockSkill("recommender", [], ["base"]));

      const downstream = registry.getDownstream("base");
      expect(downstream).toContain("recommender");
    });
  });

  describe("checkCircularDependency()", () => {
    it("should return null for acyclic graph", () => {
      registry.register(createMockSkill("a", ["b"]));
      registry.register(createMockSkill("b", ["c"]));
      registry.register(createMockSkill("c"));
      expect(registry.checkCircularDependency()).toBeNull();
    });

    it("should detect direct cycle", () => {
      registry.register(createMockSkill("a", ["b"]));
      registry.register(createMockSkill("b", ["a"]));
      const result = registry.checkCircularDependency();
      expect(result).not.toBeNull();
      expect(result).toContain("a");
      expect(result).toContain("b");
    });

    it("should detect indirect cycle (3 nodes)", () => {
      registry.register(createMockSkill("a", ["b"]));
      registry.register(createMockSkill("b", ["c"]));
      registry.register(createMockSkill("c", ["a"]));
      const result = registry.checkCircularDependency();
      expect(result).not.toBeNull();
    });

    it("should return null for empty registry", () => {
      expect(registry.checkCircularDependency()).toBeNull();
    });
  });

  describe("validateSkill()", () => {
    it("should pass a valid skill", () => {
      const skill = createMockSkill("valid-skill");
      const result = registry.validateSkill(skill);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject empty name", () => {
      const skill = createMockSkill("");
      const result = registry.validateSkill(skill);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("name"))).toBe(true);
    });

    it("should reject invalid name format", () => {
      const skill = createMockSkill("Invalid_Name!");
      const result = registry.validateSkill(skill);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("name"))).toBe(true);
    });

    it("should reject invalid semver", () => {
      const skill = createMockSkill("bad-ver");
      // Override version
      (skill as any).spec.version = "not-semver";
      const result = registry.validateSkill(skill);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("version"))).toBe(true);
    });

    it("should warn when QC gates are empty", () => {
      const skill = createMockSkill("no-qc");
      (skill as any).spec.qcGates = [];
      const result = registry.validateSkill(skill);
      expect(result.warnings.some((w) => w.includes("QC"))).toBe(true);
    });

    it("should warn when decision tree is empty", () => {
      const skill = createMockSkill("no-tree");
      (skill as any).spec.tools.decisionTree = [];
      const result = registry.validateSkill(skill);
      expect(result.warnings.some((w) => w.includes("decisionTree"))).toBe(true);
    });

    it("should error on self-dependency", () => {
      const skill = createMockSkill("self-dep", ["self-dep"]);
      const result = registry.validateSkill(skill);
      expect(result.errors.some((e) => e.includes("requires itself"))).toBe(true);
    });
  });

  describe("search()", () => {
    it("should find skills by name", () => {
      registry.register(createMockSkill("import-data"));
      registry.register(createMockSkill("qc-filter"));
      const results = registry.search("import");
      expect(results).toHaveLength(1);
      expect(results[0].spec.name).toBe("import-data");
    });

    it("should find skills by description", () => {
      registry.register(createMockSkill("data-import"));
      const results = registry.search("description");
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it("should find skills by tool name", () => {
      registry.register(createMockSkill("normalize"));
      const results = registry.search("normalize.tool");
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it("should return empty for no matches", () => {
      const results = registry.search("xyz-abc-nonexistent");
      expect(results).toHaveLength(0);
    });
  });

  describe("export()", () => {
    it("should export skill spec as JSON", () => {
      registry.register(createMockSkill("data-import"));
      const json = registry.export("data-import");
      expect(json).toBeTruthy();
      const parsed = JSON.parse(json!);
      expect(parsed.name).toBe("data-import");
    });

    it("should return null for unregistered skill", () => {
      expect(registry.export("ghost")).toBeNull();
    });
  });
});
