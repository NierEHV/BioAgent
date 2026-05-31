// ============================================================
// @bioagent/workflow — CheckpointManager Tests
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { CheckpointManager } from "../src/checkpoint";
import type { CheckpointData, NodeState } from "../src/engine.types";

function createTestCheckpoint(overrides: Partial<CheckpointData> = {}): CheckpointData {
  const runId = overrides.runId ?? randomUUID();
  return {
    runId,
    projectId: "test-project",
    workflowName: "test-workflow",
    status: "running",
    nodeStates: {
      import: {
        nodeId: "import",
        skill: "data-import",
        status: "completed",
        startedAt: "2024-01-01T00:00:00.000Z",
        endedAt: "2024-01-01T00:05:00.000Z",
        retryCount: 0,
        result: null,
        error: null,
      },
      qc: {
        nodeId: "qc",
        skill: "scrna-qc",
        status: "pending",
        startedAt: null,
        endedAt: null,
        retryCount: 0,
        result: null,
        error: null,
      },
    },
    completedNodes: ["import"],
    failedNodes: [],
    skippedNodes: [],
    intermediateData: { sampleCount: 1000 },
    containerName: "test-container",
    containerId: "abc123",
    dataPath: "/data/test-project",
    userDecisions: {},
    savedAt: "2024-01-01T00:05:00.000Z",
    agentState: {},
    ...overrides,
  };
}

describe("CheckpointManager", () => {
  let tmpDir: string;
  let manager: CheckpointManager;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `bioagent-checkpoint-test-${randomUUID()}`);
    manager = new CheckpointManager(tmpDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("save", () => {
    it("saves checkpoint data as JSON file", async () => {
      const cp = createTestCheckpoint();
      await manager.save(cp);

      const dir = path.join(
        tmpDir,
        "test-project",
        "checkpoints",
        "test-workflow",
      );
      const filePath = path.join(dir, `${cp.runId}.json`);

      expect(fs.existsSync(filePath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      expect(content.runId).toBe(cp.runId);
      expect(content.workflowName).toBe("test-workflow");
      expect(content.projectId).toBe("test-project");
      expect(content.savedAt).toBeTruthy(); // Updated on save
    });

    it("creates nested directories automatically", async () => {
      const cp = createTestCheckpoint();
      await manager.save(cp);

      const dir = path.join(
        tmpDir,
        "test-project",
        "checkpoints",
        "test-workflow",
      );
      expect(fs.existsSync(dir)).toBe(true);
      expect(fs.statSync(dir).isDirectory()).toBe(true);
    });

    it("saves nodeStates correctly", async () => {
      const cp = createTestCheckpoint();
      await manager.save(cp);

      const saved = await manager.findLatest("test-workflow", "test-project");
      expect(saved).not.toBeNull();
      expect(saved!.nodeStates.import.status).toBe("completed");
      expect(saved!.nodeStates.qc.status).toBe("pending");
    });
  });

  describe("findLatest", () => {
    it("returns the most recent checkpoint", async () => {
      const cp1 = createTestCheckpoint();
      const cp2 = createTestCheckpoint();
      const cp3 = createTestCheckpoint();

      await manager.save(cp1);
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 50));
      await manager.save(cp2);
      await new Promise((r) => setTimeout(r, 50));
      await manager.save(cp3);

      const latest = await manager.findLatest("test-workflow", "test-project");
      expect(latest).not.toBeNull();
      // The most recently saved should be cp3's runId
      expect(latest!.runId).toBe(cp3.runId);
    });

    it("returns null when no checkpoints exist", async () => {
      const result = await manager.findLatest(
        "nonexistent",
        "test-project",
      );
      expect(result).toBeNull();
    });

    it("returns null when directory does not exist", async () => {
      const result = await manager.findLatest(
        "test-workflow",
        "nonexistent-project",
      );
      expect(result).toBeNull();
    });
  });

  describe("list", () => {
    it("lists all checkpoints for a project in reverse chronological order", async () => {
      const cp1 = createTestCheckpoint({ workflowName: "wf-a" });
      const cp2 = createTestCheckpoint({ workflowName: "wf-b" });
      const cp3 = createTestCheckpoint({ workflowName: "wf-a" });

      await manager.save(cp1);
      await new Promise((r) => setTimeout(r, 50));
      await manager.save(cp2);
      await new Promise((r) => setTimeout(r, 50));
      await manager.save(cp3);

      const list = await manager.list("test-project");
      expect(list.length).toBe(3);
      // Should be sorted by savedAt desc — most recent first (cp3)
      expect(list[0].runId).toBe(cp3.runId);
      expect(list[1].runId).toBe(cp2.runId);
      expect(list[2].runId).toBe(cp1.runId);
    });

    it("returns empty array for nonexistent project", async () => {
      const list = await manager.list("nonexistent");
      expect(list).toEqual([]);
    });
  });

  describe("prune", () => {
    it("keeps only the latest N checkpoints", async () => {
      const cps: ReturnType<typeof createTestCheckpoint>[] = [];
      for (let i = 0; i < 5; i++) {
        const cp = createTestCheckpoint();
        cps.push(cp);
        await manager.save(cp);
        // Small delay for distinct timestamps
        await new Promise((r) => setTimeout(r, 10));
      }

      await manager.prune("test-project", 2);

      const remaining = await manager.list("test-project");
      expect(remaining.length).toBe(2);
      // Should keep the most recent ones — last two saved (cps[3] and cps[4])
      expect(remaining.map((c) => c.runId)).toContain(cps[4].runId);
      expect(remaining.map((c) => c.runId)).toContain(cps[3].runId);
    });

    it("does nothing if checkpoints are within limit", async () => {
      const cp = createTestCheckpoint();
      await manager.save(cp);

      await manager.prune("test-project", 5);

      const remaining = await manager.list("test-project");
      expect(remaining.length).toBe(1);
    });

    it("does nothing for empty project", async () => {
      await expect(
        manager.prune("nonexistent", 2),
      ).resolves.toBeUndefined();
    });
  });

  describe("verify", () => {
    it("returns valid for a complete checkpoint", async () => {
      const cp = createTestCheckpoint();
      await manager.save(cp);

      const result = await manager.verify(cp);
      expect(result.valid).toBe(true);
      expect(result.missingFiles).toEqual([]);
      expect(result.corruptedFiles).toEqual([]);
    });

    it("detects missing required fields", async () => {
      const cp = createTestCheckpoint();
      (cp as any).runId = undefined;

      const result = await manager.verify(cp);
      expect(result.valid).toBe(false);
      expect(result.corruptedFiles.length).toBeGreaterThan(0);
    });

    it("detects when checkpoint file does not exist on disk", async () => {
      const cp = createTestCheckpoint();
      // Don't save it — just verify

      const result = await manager.verify(cp);
      expect(result.valid).toBe(false);
      expect(result.missingFiles.length).toBeGreaterThan(0);
    });
  });

  describe("restore", () => {
    it("restores WorkflowState from checkpoint data", async () => {
      const cp = createTestCheckpoint();
      await manager.save(cp);

      const state = await manager.restore(cp);
      expect(state.runId).toBe(cp.runId);
      expect(state.workflowName).toBe("test-workflow");
      expect(state.projectId).toBe("test-project");
      expect(state.status).toBe("running"); // Preserves checkpoint's status
      expect(state.container).toBe("test-container");
      expect(state.dataPath).toBe("/data/test-project");
      expect(state.completedNodes).toEqual(["import"]);
      expect(state.failedNodes).toEqual([]);
      expect(state.skippedNodes).toEqual([]);

      // nodeStates should be a Map
      expect(state.nodeStates instanceof Map).toBe(true);
      expect(state.nodeStates.get("import")!.status).toBe("completed");
      expect(state.nodeStates.get("qc")!.status).toBe("pending");
    });

    it("calculates progress correctly", async () => {
      const cp = createTestCheckpoint({
        completedNodes: ["import"],
        nodeStates: {
          import: {
            nodeId: "import",
            skill: "data-import",
            status: "completed",
            startedAt: null,
            endedAt: null,
            retryCount: 0,
            result: null,
            error: null,
          },
          qc: {
            nodeId: "qc",
            skill: "scrna-qc",
            status: "pending",
            startedAt: null,
            endedAt: null,
            retryCount: 0,
            result: null,
            error: null,
          },
        },
      });

      const state = await manager.restore(cp);
      // 1 completed out of 2 total = 0.5
      expect(state.progress).toBe(0.5);
    });
  });

  describe("delete", () => {
    it("deletes a checkpoint by runId", async () => {
      const cp = createTestCheckpoint();
      await manager.save(cp);

      // Verify it exists
      const before = await manager.findLatest("test-workflow", "test-project");
      expect(before).not.toBeNull();

      await manager.delete(cp.runId);

      // Verify it's gone
      const after = await manager.findLatest("test-workflow", "test-project");
      expect(after).toBeNull();
    });

    it("does not throw for nonexistent runId", async () => {
      await expect(
        manager.delete("nonexistent-run-id"),
      ).resolves.toBeUndefined();
    });
  });

  describe("end-to-end: save, find, restore, delete", () => {
    it("completes the full lifecycle", async () => {
      const cp = createTestCheckpoint();

      // Save
      await manager.save(cp);

      // Find
      const found = await manager.findLatest("test-workflow", "test-project");
      expect(found).not.toBeNull();
      expect(found!.runId).toBe(cp.runId);

      // Restore
      const state = await manager.restore(found!);
      expect(state.status).toBe("running");
      expect(state.completedNodes).toContain("import");

      // Delete
      await manager.delete(cp.runId);
      const afterDelete = await manager.findLatest(
        "test-workflow",
        "test-project",
      );
      expect(afterDelete).toBeNull();
    });
  });
});
