// ============================================================
// @bioagent/agent-core — Tool Zod Schema Tests
// ============================================================

import { describe, it, expect } from "vitest";

// Import all tool schemas
import { dockerExecToolSchema } from "../../src/tools/docker-exec.tool.js";
import { dockerSearchToolSchema } from "../../src/tools/docker-search.tool.js";
import { dockerPullToolSchema } from "../../src/tools/docker-pull.tool.js";
import { dockerInspectToolSchema } from "../../src/tools/docker-inspect.tool.js";
import { dockerVerifyToolSchema } from "../../src/tools/docker-verify.tool.js";
import { skillInvokeToolSchema } from "../../src/tools/skill-invoke.tool.js";
import { kbQueryToolSchema } from "../../src/tools/kb-query.tool.js";
import { fileInspectToolSchema } from "../../src/tools/file-inspect.tool.js";
import { workflowRunToolSchema } from "../../src/tools/workflow-run.tool.js";
import { ALL_TOOLS } from "../../src/tools/index.js";

// ---------------------------------------------------------------------------
// docker-exec (discriminated union)
// ---------------------------------------------------------------------------

describe("docker-exec schema", () => {
  it("should parse ensure_image action", () => {
    const result = dockerExecToolSchema.safeParse({
      action: "ensure_image",
      image: "python:3.11-slim",
    });
    expect(result.success).toBe(true);
  });

  it("should parse ensure_image with platform", () => {
    const result = dockerExecToolSchema.safeParse({
      action: "ensure_image",
      image: "python:3.11-slim",
      platform: "linux/amd64",
    });
    expect(result.success).toBe(true);
  });

  it("should parse start_container action", () => {
    const result = dockerExecToolSchema.safeParse({
      action: "start_container",
      image: "rnakato/shortcake_light:latest",
      name: "bioagent-scrna-1",
      command: ["tail", "-f", "/dev/null"],
      volumes: [
        { host: "/data/input", container: "/data/input", mode: "ro" },
      ],
      env: { VAR1: "value1" },
      gpu: true,
      network: "host",
      memoryLimit: "64g",
      cpuLimit: 8,
    });
    expect(result.success).toBe(true);
  });

  it("should parse start_container with defaults", () => {
    const result = dockerExecToolSchema.safeParse({
      action: "start_container",
      image: "ubuntu:latest",
      name: "test-container",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.command).toEqual(["tail", "-f", "/dev/null"]);
      expect(result.data.volumes).toEqual([]);
      expect(result.data.env).toEqual({});
      expect(result.data.gpu).toBe(false);
      expect(result.data.network).toBe("bridge");
    }
  });

  it("should parse exec action", () => {
    const result = dockerExecToolSchema.safeParse({
      action: "exec",
      container: "my-container",
      command: "Rscript /data/analysis.R",
      workdir: "/data",
      timeout: 300000,
      env: { DEBUG: "true" },
      captureStderr: true,
    });
    expect(result.success).toBe(true);
  });

  it("should parse exec with defaults", () => {
    const result = dockerExecToolSchema.safeParse({
      action: "exec",
      container: "my-container",
      command: "ls",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.workdir).toBe("/data");
      expect(result.data.timeout).toBe(600_000);
      expect(result.data.captureStderr).toBe(true);
    }
  });

  it("should parse stop_container action", () => {
    const result = dockerExecToolSchema.safeParse({
      action: "stop_container",
      name: "my-container",
      force: true,
      removeVolumes: false,
    });
    expect(result.success).toBe(true);
  });

  it("should parse get_status action", () => {
    const result = dockerExecToolSchema.safeParse({
      action: "get_status",
      name: "my-container",
    });
    expect(result.success).toBe(true);
  });

  it("should parse list_containers action", () => {
    const result = dockerExecToolSchema.safeParse({
      action: "list_containers",
      namePrefix: "bioagent-",
      state: "running",
    });
    expect(result.success).toBe(true);
  });

  it("should parse list_containers with no filters", () => {
    const result = dockerExecToolSchema.safeParse({
      action: "list_containers",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid action", () => {
    const result = dockerExecToolSchema.safeParse({
      action: "invalid_action",
    });
    expect(result.success).toBe(false);
  });

  it("should reject exec without command", () => {
    const result = dockerExecToolSchema.safeParse({
      action: "exec",
      container: "my-container",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid network mode", () => {
    const result = dockerExecToolSchema.safeParse({
      action: "start_container",
      image: "ubuntu",
      name: "test",
      network: "invalid_mode",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// docker-search
// ---------------------------------------------------------------------------

describe("docker-search schema", () => {
  it("should parse minimal params", () => {
    const result = dockerSearchToolSchema.safeParse({
      query: "seurat",
    });
    expect(result.success).toBe(true);
  });

  it("should parse full params", () => {
    const result = dockerSearchToolSchema.safeParse({
      query: "scanpy",
      tool_name: "scanpy-scripts",
      min_stars: 10,
      max_results: 15,
      include_official: false,
      include_biocontainers: true,
    });
    expect(result.success).toBe(true);
  });

  it("should apply defaults", () => {
    const result = dockerSearchToolSchema.safeParse({ query: "R" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.min_stars).toBe(5);
      expect(result.data.max_results).toBe(20);
      expect(result.data.include_official).toBe(true);
      expect(result.data.include_biocontainers).toBe(true);
    }
  });

  it("should reject empty query", () => {
    const result = dockerSearchToolSchema.safeParse({ query: "" });
    expect(result.success).toBe(false);
  });

  it("should reject max_results > 100", () => {
    const result = dockerSearchToolSchema.safeParse({
      query: "test",
      max_results: 200,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// docker-pull
// ---------------------------------------------------------------------------

describe("docker-pull schema", () => {
  it("should parse minimal params", () => {
    const result = dockerPullToolSchema.safeParse({
      image: "python:3.11-slim",
    });
    expect(result.success).toBe(true);
  });

  it("should parse with platform", () => {
    const result = dockerPullToolSchema.safeParse({
      image: "python:3.11-slim",
      platform: "linux/arm64",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty image", () => {
    const result = dockerPullToolSchema.safeParse({ image: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// docker-inspect
// ---------------------------------------------------------------------------

describe("docker-inspect schema", () => {
  it("should parse valid image name", () => {
    const result = dockerInspectToolSchema.safeParse({
      image: "biocontainers/seurat:v4.3.0",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty image", () => {
    const result = dockerInspectToolSchema.safeParse({ image: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// docker-verify
// ---------------------------------------------------------------------------

describe("docker-verify schema", () => {
  it("should parse valid params", () => {
    const result = dockerVerifyToolSchema.safeParse({
      image: "biocontainers/seurat:v4.3.0",
      tools: ["R", "Rscript", "seurat"],
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty tools array", () => {
    const result = dockerVerifyToolSchema.safeParse({
      image: "test",
      tools: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject more than 50 tools", () => {
    const result = dockerVerifyToolSchema.safeParse({
      image: "test",
      tools: Array.from({ length: 51 }, (_, i) => `tool-${i}`),
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty tool name", () => {
    const result = dockerVerifyToolSchema.safeParse({
      image: "test",
      tools: [""],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// skill-invoke
// ---------------------------------------------------------------------------

describe("skill-invoke schema", () => {
  it("should parse minimal params", () => {
    const result = skillInvokeToolSchema.safeParse({
      skill_name: "scrna_qc",
    });
    expect(result.success).toBe(true);
  });

  it("should parse full params", () => {
    const result = skillInvokeToolSchema.safeParse({
      skill_name: "scrna_clustering",
      params: {
        resolution: 0.8,
        n_neighbors: 15,
        method: "leiden",
      },
      container: "bioagent-scrna-container",
      data_context: {
        input_dir: "/data/input",
        output_dir: "/data/output",
        project_id: "project-123",
        omics_type: "scRNA-seq",
      },
    });
    expect(result.success).toBe(true);
  });

  it("should apply defaults for params", () => {
    const result = skillInvokeToolSchema.safeParse({
      skill_name: "scrna_de_analysis",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.params).toEqual({});
    }
  });

  it("should reject empty skill_name", () => {
    const result = skillInvokeToolSchema.safeParse({ skill_name: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// kb-query
// ---------------------------------------------------------------------------

describe("kb-query schema", () => {
  it("should parse minimal params", () => {
    const result = kbQueryToolSchema.safeParse({
      question: "How to normalize scRNA-seq data?",
    });
    expect(result.success).toBe(true);
  });

  it("should parse with full context", () => {
    const result = kbQueryToolSchema.safeParse({
      question: "Find markers for T cells in lung tissue",
      context: {
        omicsType: "scRNA-seq",
        species: "human",
        tissue: "lung",
        currentSkill: "scrna_clustering",
        genesOfInterest: ["CD3D", "CD4", "CD8A"],
        cellTypes: ["T cell", "B cell", "Macrophage"],
      },
      layers: ["vector", "graph"],
      max_results: 10,
    });
    expect(result.success).toBe(true);
  });

  it("should apply defaults", () => {
    const result = kbQueryToolSchema.safeParse({
      question: "test",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.layers).toEqual(["vector", "graph", "wiki"]);
      expect(result.data.max_results).toBe(5);
    }
  });

  it("should reject empty question", () => {
    const result = kbQueryToolSchema.safeParse({ question: "" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid layer name", () => {
    const result = kbQueryToolSchema.safeParse({
      question: "test",
      layers: ["invalid_layer"],
    });
    expect(result.success).toBe(false);
  });

  it("should reject max_results > 50", () => {
    const result = kbQueryToolSchema.safeParse({
      question: "test",
      max_results: 100,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// file-inspect
// ---------------------------------------------------------------------------

describe("file-inspect schema", () => {
  it("should parse minimal params", () => {
    const result = fileInspectToolSchema.safeParse({
      path: "/data/input/sample.h5ad",
    });
    expect(result.success).toBe(true);
  });

  it("should parse with options", () => {
    const result = fileInspectToolSchema.safeParse({
      path: "/data/input",
      recursive: true,
      sample_rows: 10,
    });
    expect(result.success).toBe(true);
  });

  it("should apply defaults", () => {
    const result = fileInspectToolSchema.safeParse({
      path: "/data/input",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recursive).toBe(false);
      expect(result.data.sample_rows).toBe(5);
    }
  });

  it("should reject empty path", () => {
    const result = fileInspectToolSchema.safeParse({ path: "" });
    expect(result.success).toBe(false);
  });

  it("should reject sample_rows > 100", () => {
    const result = fileInspectToolSchema.safeParse({
      path: "/data/test.txt",
      sample_rows: 200,
    });
    expect(result.success).toBe(false);
  });

  it("should allow sample_rows = 0 (skip reading)", () => {
    const result = fileInspectToolSchema.safeParse({
      path: "/data/test.h5ad",
      sample_rows: 0,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// workflow-run
// ---------------------------------------------------------------------------

describe("workflow-run schema", () => {
  it("should parse minimal params", () => {
    const result = workflowRunToolSchema.safeParse({
      workflow_name: "scrna_standard",
      project_id: "project-001",
    });
    expect(result.success).toBe(true);
  });

  it("should parse with all options", () => {
    const result = workflowRunToolSchema.safeParse({
      workflow_name: "scrna_integration",
      project_id: "project-002",
      container: "bioagent-scrna-container",
      params: {
        batch_key: "sample_id",
        n_hvg: 2000,
      },
      resume_from: "qc",
    });
    expect(result.success).toBe(true);
  });

  it("should apply defaults", () => {
    const result = workflowRunToolSchema.safeParse({
      workflow_name: "trajectory_inference",
      project_id: "p3",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.params).toEqual({});
    }
  });

  it("should reject empty workflow_name", () => {
    const result = workflowRunToolSchema.safeParse({
      workflow_name: "",
      project_id: "test",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty project_id", () => {
    const result = workflowRunToolSchema.safeParse({
      workflow_name: "scrna_standard",
      project_id: "",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ALL_TOOLS array
// ---------------------------------------------------------------------------

describe("ALL_TOOLS", () => {
  it("should contain exactly 9 tools", () => {
    expect(ALL_TOOLS).toHaveLength(9);
  });

  it("should have unique tool names", () => {
    const names = ALL_TOOLS.map((t) => t.name);
    expect(names.length).toBe(new Set(names).size);
  });

  it("should include all expected tool names", () => {
    const names = ALL_TOOLS.map((t) => t.name);
    expect(names).toContain("docker_exec");
    expect(names).toContain("docker_search");
    expect(names).toContain("docker_pull");
    expect(names).toContain("docker_inspect");
    expect(names).toContain("docker_verify");
    expect(names).toContain("skill_invoke");
    expect(names).toContain("kb_query");
    expect(names).toContain("file_inspect");
    expect(names).toContain("workflow_run");
  });

  it("should have description and schema for each tool", () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.description).toBeTruthy();
      expect(tool.schema).toBeDefined();
    }
  });
});
