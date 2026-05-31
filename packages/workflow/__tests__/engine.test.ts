// ============================================================
// @bioagent/workflow — WorkflowEngine Tests
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { WorkflowEngine } from "../src/engine";
import { WorkflowRegistry } from "../src/registry";
import { CheckpointManager } from "../src/checkpoint";
import { WorkflowScheduler } from "../src/scheduler";
import { evaluateCondition } from "../src/condition";
import { applyErrorPolicy } from "../src/error-policy";
import type {
  WorkflowDef,
  WorkflowNode,
  WorkflowState,
  NodeState,
  ErrorPolicy,
} from "../src/engine.types";
import type { SkillResult, SkillContext } from "@bioagent/skills";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWorkflowNode(
  id: string,
  opts: Partial<WorkflowNode> = {},
): WorkflowNode {
  return {
    id,
    skill: `skill-${id}`,
    dependsOn: [],
    dependsOnMode: "all",
    optional: false,
    checkpoint: false,
    pauseAfter: false,
    ...opts,
  };
}

function makeErrorPolicy(overrides: Partial<ErrorPolicy> = {}): ErrorPolicy {
  return {
    maxRetries: 2,
    retryDelayMs: 100,
    onExhausted: "abort",
    skipOptional: true,
    notifyOnWarning: true,
    ...overrides,
  };
}

function createSuccessResult(
  skillName: string,
  metrics: Record<string, number> = {},
): SkillResult {
  return {
    skillName,
    skillVersion: "1.0.0",
    status: "success",
    qcReport: {
      overall: "pass",
      gates: [],
      passed: 0,
      warned: 0,
      failed: 0,
      total: 0,
    },
    outputs: {
      files: [],
      metrics,
      logs: [],
    },
    nextSteps: [],
    duration: 100,
    executedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("WorkflowEngine", () => {
  let tmpDir: string;
  let registry: WorkflowRegistry;
  let checkpointMgr: CheckpointManager;
  let mockSkillExecutor: any;
  let engine: WorkflowEngine;
  let executedSkills: string[];

  beforeEach(() => {
    tmpDir = path.join(
      os.tmpdir(),
      `bioagent-engine-test-${randomUUID()}`,
    );
    registry = new WorkflowRegistry();
    checkpointMgr = new CheckpointManager(tmpDir);

    executedSkills = [];

    mockSkillExecutor = {
      execute: vi.fn(
        async (skillName: string, context: SkillContext) => {
          executedSkills.push(skillName);
          return createSuccessResult(skillName);
        },
      ),
    };

    engine = new WorkflowEngine(
      registry,
      mockSkillExecutor,
      checkpointMgr,
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // -----------------------------------------------------------------------
  // start / getState
  // -----------------------------------------------------------------------
  describe("start", () => {
    it("throws for unknown workflow", async () => {
      await expect(
        engine.start({
          workflowName: "nonexistent",
          projectId: "proj-1",
          dataPath: "/data",
          container: "test-container",
        }),
      ).rejects.toThrow(/nonexistent/);
    });

    it("returns a runId on successful start", async () => {
      const workflow: WorkflowDef = {
        name: "test-wf",
        version: "1.0.0",
        description: "Test workflow",
        resourceEstimate: {
          cpu: "1 core",
          ram: "1GB",
          disk: "1GB",
          time: "1 min",
          gpu: "not_needed",
        },
        input: {
          dataFormat: ["h5ad"],
          required: ["data"],
          optional: [],
        },
        output: {
          directory: "output/",
          files: [],
        },
        nodes: [
          makeWorkflowNode("step1"),
          makeWorkflowNode("step2", { dependsOn: ["step1"] }),
        ],
        errorPolicy: makeErrorPolicy(),
      };

      registry.register(workflow);

      const runId = await engine.start({
        workflowName: "test-wf",
        projectId: "proj-1",
        dataPath: "/data",
        container: "test-container",
      });

      expect(runId).toBeTruthy();
      expect(typeof runId).toBe("string");
      expect(runId.length).toBeGreaterThan(0);
    });

    it("creates an initial checkpoint on start", async () => {
      const workflow: WorkflowDef = {
        name: "test-wf",
        version: "1.0.0",
        description: "Test",
        resourceEstimate: {
          cpu: "1 core",
          ram: "1GB",
          disk: "1GB",
          time: "1 min",
          gpu: "not_needed",
        },
        input: {
          dataFormat: ["h5ad"],
          required: ["data"],
          optional: [],
        },
        output: {
          directory: "output/",
          files: [],
        },
        nodes: [makeWorkflowNode("step1")],
        errorPolicy: makeErrorPolicy(),
      };

      registry.register(workflow);

      const runId = await engine.start({
        workflowName: "test-wf",
        projectId: "proj-1",
        dataPath: "/data",
        container: "test-container",
      });

      // Small delay to allow execution loop to reach a checkpoint
      await new Promise((r) => setTimeout(r, 500));

      const checkpoints = await checkpointMgr.list("proj-1");
      expect(checkpoints.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // estimate
  // -----------------------------------------------------------------------
  describe("estimate", () => {
    it("returns resource estimates for a workflow", async () => {
      const workflow: WorkflowDef = {
        name: "test-wf",
        version: "1.0.0",
        description: "Test",
        resourceEstimate: {
          cpu: "8-16 cores",
          ram: "32-64GB",
          disk: "50-100GB",
          time: "2-8 hours",
          gpu: "optional",
        },
        input: {
          dataFormat: ["h5ad"],
          required: ["data"],
          optional: [],
        },
        output: {
          directory: "output/",
          files: [],
        },
        nodes: [makeWorkflowNode("step1")],
        errorPolicy: makeErrorPolicy(),
      };

      registry.register(workflow);

      const estimate = await engine.estimate("test-wf", "/data");

      expect(estimate.totalTimeMinutes.min).toBe(120);
      expect(estimate.totalTimeMinutes.max).toBe(480);
      expect(estimate.totalDiskGB).toBe(100);
      expect(estimate.peakRAMGB).toBe(64);
      expect(estimate.recommendedCPUCores).toBe(16);
      expect(estimate.gpuRecommended).toBe(true);
    });

    it("throws for unknown workflow", async () => {
      await expect(
        engine.estimate("nonexistent", "/data"),
      ).rejects.toThrow(/nonexistent/);
    });

    it("sets gpuRecommended to false when GPU is not needed", async () => {
      const workflow: WorkflowDef = {
        name: "test-wf",
        version: "1.0.0",
        description: "Test",
        resourceEstimate: {
          cpu: "1 core",
          ram: "1GB",
          disk: "1GB",
          time: "1 min",
          gpu: "not_needed",
        },
        input: {
          dataFormat: ["h5ad"],
          required: ["data"],
          optional: [],
        },
        output: {
          directory: "output/",
          files: [],
        },
        nodes: [makeWorkflowNode("step1")],
        errorPolicy: makeErrorPolicy(),
      };

      registry.register(workflow);

      const estimate = await engine.estimate("test-wf", "/data");
      expect(estimate.gpuRecommended).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // abort
  // -----------------------------------------------------------------------
  describe("abort", () => {
    it("aborts a running workflow", async () => {
      const workflow: WorkflowDef = {
        name: "test-wf",
        version: "1.0.0",
        description: "Test",
        resourceEstimate: {
          cpu: "1 core",
          ram: "1GB",
          disk: "1GB",
          time: "1 min",
          gpu: "not_needed",
        },
        input: {
          dataFormat: ["h5ad"],
          required: ["data"],
          optional: [],
        },
        output: {
          directory: "output/",
          files: [],
        },
        nodes: [makeWorkflowNode("step1")],
        errorPolicy: makeErrorPolicy(),
      };

      registry.register(workflow);

      const runId = await engine.start({
        workflowName: "test-wf",
        projectId: "proj-1",
        dataPath: "/data",
        container: "test-container",
      });

      // Small delay
      await new Promise((r) => setTimeout(r, 200));

      await engine.abort(runId, "User requested abort");

      const state = await engine.getState(runId);
      expect(state.status).toBe("aborted");
      expect(state.abortReason).toBe("User requested abort");
    });
  });

  // -----------------------------------------------------------------------
  // Condition evaluation (unit test of evaluateCondition)
  // -----------------------------------------------------------------------
  describe("evaluateCondition", () => {
    it("evaluates simple comparison", () => {
      expect(evaluateCondition("x > 5", { x: 10 })).toBe(true);
      expect(evaluateCondition("x > 5", { x: 3 })).toBe(false);
    });

    it("evaluates equality", () => {
      expect(
        evaluateCondition("status === 'fail'", { status: "fail" }),
      ).toBe(true);
      expect(
        evaluateCondition("status === 'fail'", { status: "pass" }),
      ).toBe(false);
    });

    it("evaluates compound conditions with &&", () => {
      expect(
        evaluateCondition("a > 0 && b > 0", { a: 1, b: 2 }),
      ).toBe(true);
      expect(
        evaluateCondition("a > 0 && b > 0", { a: 1, b: -1 }),
      ).toBe(false);
    });

    it("evaluates compound conditions with ||", () => {
      expect(
        evaluateCondition("a > 0 || b > 0", { a: -1, b: 2 }),
      ).toBe(true);
      expect(
        evaluateCondition("a > 0 || b > 0", { a: -1, b: -2 }),
      ).toBe(false);
    });

    it("handles nested property access", () => {
      const ctx = {
        result: { qc: { overall: "fail" } },
      };
      expect(
        evaluateCondition("result.qc.overall === 'fail'", ctx),
      ).toBe(true);
    });

    it("handles boolean context values", () => {
      expect(
        evaluateCondition("metadata.hasBatch", {
          metadata: { hasBatch: true },
        }),
      ).toBe(true);
      expect(
        evaluateCondition("metadata.hasBatch", {
          metadata: { hasBatch: false },
        }),
      ).toBe(false);
    });

    it("rejects function calls for safety", () => {
      expect(() =>
        evaluateCondition("alert('hack')", {}),
      ).toThrow(/function call/i);
    });

    it("rejects semicolons for safety", () => {
      expect(() =>
        evaluateCondition("x > 0; process.exit()", { x: 1 }),
      ).toThrow(/semicolon/i);
    });

    it("rejects dangerous globals", () => {
      expect(() =>
        evaluateCondition("eval('1+1')", {}),
      ).toThrow(/eval/i);
    });

    it("returns true for empty expression", () => {
      expect(evaluateCondition("", {})).toBe(true);
    });

    it("returns false for malformed expression", () => {
      expect(evaluateCondition("+++invalid+++", {})).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Error policy (unit test of applyErrorPolicy)
  // -----------------------------------------------------------------------
  describe("applyErrorPolicy", () => {
    function makeStateForTest(
      retryCount: number = 0,
      isOptional: boolean = false,
    ): WorkflowState {
      const nodeStates = new Map<string, NodeState>();
      nodeStates.set("test-node", {
        nodeId: "test-node",
        skill: "test-skill",
        status: "failed",
        startedAt: null,
        endedAt: null,
        retryCount,
        result: null,
        error: "Test error",
      });

      return {
        runId: "test-run",
        workflowName: "test-wf",
        status: "running",
        projectId: "proj-1",
        container: "test-container",
        dataPath: "/data",
        nodeStates,
        currentNodes: [],
        completedNodes: [],
        failedNodes: [],
        skippedNodes: [],
        totalNodes: 1,
        progress: 0,
        results: new Map(),
        startedAt: new Date().toISOString(),
        completedAt: null,
        intermediateData: {},
        userDecisions: {},
      };
    }

    it("returns retry when attempts remain", () => {
      const node = makeWorkflowNode("test-node");
      const state = makeStateForTest(0); // 0 retries so far
      const policy = makeErrorPolicy({ maxRetries: 3 });

      const result = applyErrorPolicy(
        node,
        new Error("test"),
        state,
        policy,
      );

      expect(result.action).toBe("retry");
    });

    it("returns skip for optional nodes when skipOptional is true", () => {
      const node = makeWorkflowNode("test-node", { optional: true });
      const state = makeStateForTest(3, true); // exceeded maxRetries
      const policy = makeErrorPolicy({
        maxRetries: 2,
        onExhausted: "abort",
        skipOptional: true,
      });

      const result = applyErrorPolicy(
        node,
        new Error("test"),
        state,
        policy,
      );

      expect(result.action).toBe("skip");
    });

    it("returns abort when onExhausted is abort", () => {
      const node = makeWorkflowNode("test-node");
      const state = makeStateForTest(3); // exceeded retries
      const policy = makeErrorPolicy({
        maxRetries: 2,
        onExhausted: "abort",
      });

      const result = applyErrorPolicy(
        node,
        new Error("test"),
        state,
        policy,
      );

      expect(result.action).toBe("abort");
    });

    it("returns pause when onExhausted is pause_and_ask", () => {
      const node = makeWorkflowNode("test-node");
      const state = makeStateForTest(3);
      const policy = makeErrorPolicy({
        maxRetries: 2,
        onExhausted: "pause_and_ask",
      });

      const result = applyErrorPolicy(
        node,
        new Error("test"),
        state,
        policy,
      );

      expect(result.action).toBe("pause");
    });

    it("returns skip when onExhausted is skip", () => {
      const node = makeWorkflowNode("test-node");
      const state = makeStateForTest(3);
      const policy = makeErrorPolicy({
        maxRetries: 2,
        onExhausted: "skip",
      });

      const result = applyErrorPolicy(
        node,
        new Error("test"),
        state,
        policy,
      );

      expect(result.action).toBe("skip");
    });
  });

  // -----------------------------------------------------------------------
  // WorkflowRegistry
  // -----------------------------------------------------------------------
  describe("WorkflowRegistry", () => {
    it("registers a workflow and retrieves it by name", () => {
      const wf: WorkflowDef = {
        name: "test-wf",
        version: "1.0.0",
        description: "Test",
        resourceEstimate: {
          cpu: "1 core",
          ram: "1GB",
          disk: "1GB",
          time: "1 min",
          gpu: "not_needed",
        },
        input: {
          dataFormat: ["h5ad"],
          required: ["data"],
          optional: [],
        },
        output: {
          directory: "output/",
          files: [],
        },
        nodes: [makeWorkflowNode("step1")],
        errorPolicy: makeErrorPolicy(),
      };

      registry.register(wf);

      expect(registry.has("test-wf")).toBe(true);
      expect(registry.get("test-wf")).toBe(wf);
      expect(registry.listNames()).toContain("test-wf");
    });

    it("throws on duplicate registration", () => {
      const wf: WorkflowDef = {
        name: "test-wf",
        version: "1.0.0",
        description: "Test",
        resourceEstimate: {
          cpu: "1 core",
          ram: "1GB",
          disk: "1GB",
          time: "1 min",
          gpu: "not_needed",
        },
        input: {
          dataFormat: ["h5ad"],
          required: ["data"],
          optional: [],
        },
        output: {
          directory: "output/",
          files: [],
        },
        nodes: [makeWorkflowNode("step1")],
        errorPolicy: makeErrorPolicy(),
      };

      registry.register(wf);
      expect(() => registry.register(wf)).toThrow(/Duplicate/);
    });

    it("validates node dependencies on registration", () => {
      const wf: WorkflowDef = {
        name: "test-wf",
        version: "1.0.0",
        description: "Test",
        resourceEstimate: {
          cpu: "1 core",
          ram: "1GB",
          disk: "1GB",
          time: "1 min",
          gpu: "not_needed",
        },
        input: {
          dataFormat: ["h5ad"],
          required: ["data"],
          optional: [],
        },
        output: {
          directory: "output/",
          files: [],
        },
        nodes: [
          makeWorkflowNode("step2", { dependsOn: ["nonexistent_node"] }),
        ],
        errorPolicy: makeErrorPolicy(),
      };

      expect(() => registry.register(wf)).toThrow(/unknown node/);
    });

    it("getAll returns all registered workflows", () => {
      const wf1: WorkflowDef = {
        name: "wf-1",
        version: "1.0.0",
        description: "WF 1",
        resourceEstimate: {
          cpu: "1 core",
          ram: "1GB",
          disk: "1GB",
          time: "1 min",
          gpu: "not_needed",
        },
        input: {
          dataFormat: ["h5ad"],
          required: ["data"],
          optional: [],
        },
        output: { directory: "out/", files: [] },
        nodes: [makeWorkflowNode("s1")],
        errorPolicy: makeErrorPolicy(),
      };
      const wf2: WorkflowDef = {
        name: "wf-2",
        version: "1.0.0",
        description: "WF 2",
        resourceEstimate: {
          cpu: "2 cores",
          ram: "2GB",
          disk: "2GB",
          time: "2 min",
          gpu: "not_needed",
        },
        input: {
          dataFormat: ["h5ad"],
          required: ["data"],
          optional: [],
        },
        output: { directory: "out/", files: [] },
        nodes: [makeWorkflowNode("s1")],
        errorPolicy: makeErrorPolicy(),
      };

      registry.register(wf1);
      registry.register(wf2);

      expect(registry.getAll().length).toBe(2);
    });
  });
});
