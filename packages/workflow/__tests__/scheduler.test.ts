// ============================================================
// @bioagent/workflow — WorkflowScheduler Tests
// ============================================================

import { describe, it, expect } from "vitest";
import { WorkflowScheduler } from "../src/scheduler";
import type { WorkflowNode, NodeState } from "../src/engine.types";

function makeNode(
  id: string,
  deps: string[] = [],
  opts: Partial<WorkflowNode> = {},
): WorkflowNode {
  return {
    id,
    skill: `skill-${id}`,
    dependsOn: deps,
    dependsOnMode: "all" as const,
    optional: false,
    checkpoint: false,
    pauseAfter: false,
    ...opts,
  };
}

function makeNodeState(
  nodeId: string,
  status: NodeState["status"] = "pending",
): NodeState {
  return {
    nodeId,
    skill: `skill-${nodeId}`,
    status,
    startedAt: null,
    endedAt: null,
    retryCount: 0,
    result: null,
    error: null,
  };
}

function makeStateMap(nodes: WorkflowNode[], statuses: Record<string, NodeState["status"]> = {}): Map<string, NodeState> {
  const map = new Map<string, NodeState>();
  for (const node of nodes) {
    const status = statuses[node.id] ?? "pending";
    map.set(node.id, makeNodeState(node.id, status));
  }
  return map;
}

const scheduler = new WorkflowScheduler();

describe("WorkflowScheduler", () => {
  // -----------------------------------------------------------------------
  // topoSort
  // -----------------------------------------------------------------------
  describe("topoSort", () => {
    it("returns correct batch order for simple linear DAG", () => {
      // a -> b -> c
      const nodes = [
        makeNode("a"),
        makeNode("b", ["a"]),
        makeNode("c", ["b"]),
      ];

      const batches = scheduler.topoSort(nodes);
      expect(batches).toEqual([["a"], ["b"], ["c"]]);
    });

    it("allows parallel nodes in the same batch", () => {
      // a -> b, a -> c, b -> d, c -> d
      const nodes = [
        makeNode("a"),
        makeNode("b", ["a"]),
        makeNode("c", ["a"]),
        makeNode("d", ["b", "c"]),
      ];

      const batches = scheduler.topoSort(nodes);

      expect(batches[0]).toEqual(["a"]);
      // b and c can be in any order but must be in the same batch
      expect(batches[1]).toContain("b");
      expect(batches[1]).toContain("c");
      expect(batches[1].length).toBe(2);
      expect(batches[2]).toEqual(["d"]);
    });

    it("handles multiple independent roots", () => {
      // a -> c, b -> c
      const nodes = [
        makeNode("a"),
        makeNode("b"),
        makeNode("c", ["a", "b"]),
      ];

      const batches = scheduler.topoSort(nodes);

      expect(batches[0]).toContain("a");
      expect(batches[0]).toContain("b");
      expect(batches[1]).toEqual(["c"]);
    });

    it("handles any-mode dependencies (same topological treatment)", () => {
      // any-mode only affects getReadyNodes, not topoSort
      const nodes = [
        makeNode("a"),
        makeNode("b", ["a"], { dependsOnMode: "any" }),
      ];

      const batches = scheduler.topoSort(nodes);
      expect(batches).toEqual([["a"], ["b"]]);
    });

    it("returns empty array for empty nodes", () => {
      const batches = scheduler.topoSort([]);
      expect(batches).toEqual([]);
    });

    it("detects and returns cycle path for cyclic graph", () => {
      // a -> b -> c -> a
      const nodes = [
        makeNode("a", ["c"]),
        makeNode("b", ["a"]),
        makeNode("c", ["b"]),
      ];

      const cycle = scheduler.detectCycle(nodes);
      expect(cycle).not.toBeNull();
      expect(cycle!.length).toBeGreaterThan(1);
      // The cycle should contain a repeated element (the cycle closure)
      expect(cycle![0]).toBe(cycle![cycle!.length - 1]);
    });

    it("topoSort throws on cyclic graph", () => {
      const nodes = [
        makeNode("a", ["c"]),
        makeNode("b", ["a"]),
        makeNode("c", ["b"]),
      ];

      expect(() => scheduler.topoSort(nodes)).toThrow();
    });

    it("handles complex DAG with multiple parallel branches", () => {
      // a -> b -> d -> f
      // a -> c -> e -> f
      const nodes = [
        makeNode("a"),
        makeNode("b", ["a"]),
        makeNode("c", ["a"]),
        makeNode("d", ["b"]),
        makeNode("e", ["c"]),
        makeNode("f", ["d", "e"]),
      ];

      const batches = scheduler.topoSort(nodes);

      expect(batches[0]).toEqual(["a"]);
      expect(batches[1]).toContain("b");
      expect(batches[1]).toContain("c");
      expect(batches[2]).toContain("d");
      expect(batches[2]).toContain("e");
      expect(batches[3]).toEqual(["f"]);
    });
  });

  // -----------------------------------------------------------------------
  // getReadyNodes
  // -----------------------------------------------------------------------
  describe("getReadyNodes", () => {
    it("returns nodes with no dependencies when all are pending", () => {
      const nodes = [
        makeNode("a"),
        makeNode("b", ["a"]),
        makeNode("c"),
      ];

      const stateMap = makeStateMap(nodes);

      const ready = scheduler.getReadyNodes(nodes, stateMap);
      expect(ready.map((n) => n.id)).toEqual(["a", "c"]);
    });

    it("returns nodes with satisfied dependencies", () => {
      const nodes = [
        makeNode("a"),
        makeNode("b", ["a"]),
      ];

      const stateMap = makeStateMap(nodes, { a: "completed" });

      const ready = scheduler.getReadyNodes(nodes, stateMap);
      expect(ready.map((n) => n.id)).toEqual(["b"]);
    });

    it("does not return nodes whose dependencies are not met", () => {
      const nodes = [
        makeNode("a"),
        makeNode("b", ["a"]),
        makeNode("c", ["b"]),
      ];

      const stateMap = makeStateMap(nodes);

      const ready = scheduler.getReadyNodes(nodes, stateMap);
      expect(ready.map((n) => n.id)).toEqual(["a"]);
    });

    it("handles any-mode: ready when any dependency is completed", () => {
      const nodes = [
        makeNode("a"),
        makeNode("b"),
        makeNode("c", ["a", "b"], { dependsOnMode: "any" }),
      ];

      const stateMap = makeStateMap(nodes, { a: "completed" });

      const ready = scheduler.getReadyNodes(nodes, stateMap);
      expect(ready.map((n) => n.id)).toContain("c");
    });

    it("any-mode: not ready when no dependency is completed", () => {
      const nodes = [
        makeNode("a"),
        makeNode("b"),
        makeNode("c", ["a", "b"], { dependsOnMode: "any" }),
      ];

      const stateMap = makeStateMap(nodes);

      const ready = scheduler.getReadyNodes(nodes, stateMap);
      expect(ready.map((n) => n.id)).not.toContain("c");
    });

    it("all-mode: not ready when only some dependencies are completed", () => {
      const nodes = [
        makeNode("a"),
        makeNode("b"),
        makeNode("c", ["a", "b"]),
      ];

      const stateMap = makeStateMap(nodes, { a: "completed" });

      const ready = scheduler.getReadyNodes(nodes, stateMap);
      expect(ready.map((n) => n.id)).not.toContain("c");
    });

    it("all-mode: ready when all dependencies are completed", () => {
      const nodes = [
        makeNode("a"),
        makeNode("b"),
        makeNode("c", ["a", "b"]),
      ];

      const stateMap = makeStateMap(nodes, { a: "completed", b: "completed" });

      const ready = scheduler.getReadyNodes(nodes, stateMap);
      expect(ready.map((n) => n.id)).toContain("c");
    });

    it("skips already running nodes", () => {
      const nodes = [
        makeNode("a"),
        makeNode("b", ["a"]),
      ];

      const stateMap = makeStateMap(nodes, { a: "running" });

      const ready = scheduler.getReadyNodes(nodes, stateMap);
      expect(ready.map((n) => n.id)).toEqual([]);
    });

    it("skips completed nodes", () => {
      const nodes = [
        makeNode("a"),
        makeNode("b", ["a"]),
      ];

      const stateMap = makeStateMap(nodes, { a: "completed", b: "completed" });

      const ready = scheduler.getReadyNodes(nodes, stateMap);
      expect(ready).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // getCriticalPath
  // -----------------------------------------------------------------------
  describe("getCriticalPath", () => {
    it("returns the longest chain in the DAG", () => {
      // a -> b (short), a -> c -> d -> e (long)
      const nodes = [
        makeNode("a"),
        makeNode("b", ["a"]),
        makeNode("c", ["a"]),
        makeNode("d", ["c"]),
        makeNode("e", ["d"]),
      ];

      const path = scheduler.getCriticalPath(nodes);
      // Longest path should be a -> c -> d -> e (4 nodes)
      expect(path).toEqual(["a", "c", "d", "e"]);
    });

    it("returns the only path for linear DAG", () => {
      const nodes = [
        makeNode("a"),
        makeNode("b", ["a"]),
        makeNode("c", ["b"]),
      ];

      const path = scheduler.getCriticalPath(nodes);
      expect(path).toEqual(["a", "b", "c"]);
    });

    it("returns empty for empty nodes", () => {
      const path = scheduler.getCriticalPath([]);
      expect(path).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // detectCycle
  // -----------------------------------------------------------------------
  describe("detectCycle", () => {
    it("returns null for a valid DAG", () => {
      const nodes = [
        makeNode("a"),
        makeNode("b", ["a"]),
        makeNode("c", ["a", "b"]),
        makeNode("d", ["c"]),
      ];

      const cycle = scheduler.detectCycle(nodes);
      expect(cycle).toBeNull();
    });

    it("returns cycle path for a direct cycle (A -> B -> A)", () => {
      const nodes = [
        makeNode("a", ["b"]),
        makeNode("b", ["a"]),
      ];

      const cycle = scheduler.detectCycle(nodes);
      expect(cycle).not.toBeNull();
      expect(cycle![0]).toBe(cycle![cycle!.length - 1]); // closed cycle
    });

    it("returns cycle path for a three-node cycle", () => {
      const nodes = [
        makeNode("a", ["c"]),
        makeNode("b", ["a"]),
        makeNode("c", ["b"]),
      ];

      const cycle = scheduler.detectCycle(nodes);
      expect(cycle).not.toBeNull();
      expect(cycle![0]).toBe(cycle![cycle!.length - 1]);
    });

    it("returns cycle path for a self-loop", () => {
      const nodes = [
        makeNode("a", ["a"]),
      ];

      const cycle = scheduler.detectCycle(nodes);
      expect(cycle).not.toBeNull();
    });

    it("returns null for empty nodes", () => {
      const cycle = scheduler.detectCycle([]);
      expect(cycle).toBeNull();
    });
  });
});
