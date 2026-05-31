"use client";

// ============================================================
// @bioagent/ui — useWorkflow Hook
// ============================================================
// Manages workflow state: start, pause, resume, abort, and
// tracks node-level progress from SSE events.

import { useState, useCallback, useRef, useEffect } from "react";
import { useSSE } from "@/hooks/useSSE";
import { BioAgentEventType } from "@/lib/sse-client";
import { BioAgentClient } from "@/lib/bioagent-client";

export interface WorkflowNodeState {
  nodeId: string;
  skill: string;
  status:
    | "pending"
    | "ready"
    | "running"
    | "completed"
    | "failed"
    | "skipped"
    | "paused";
  startedAt: string | null;
  endedAt: string | null;
  error: string | null;
  retryCount: number;
}

export interface WorkflowUIState {
  runId: string | null;
  workflowName: string | null;
  status: "idle" | "running" | "paused" | "completed" | "failed" | "aborted";
  nodes: WorkflowNodeState[];
  progress: number;
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

const initialState: WorkflowUIState = {
  runId: null,
  workflowName: null,
  status: "idle",
  nodes: [],
  progress: 0,
  totalNodes: 0,
  completedNodes: 0,
  failedNodes: 0,
  startedAt: null,
  completedAt: null,
  error: null,
};

export function useWorkflow(client: BioAgentClient | null) {
  const { subscribe, isConnected } = useSSE();
  const [workflow, setWorkflow] = useState<WorkflowUIState>(initialState);
  const workflowRef = useRef<WorkflowUIState>(initialState);

  // Helper to update workflow state immutably
  const updateWorkflow = useCallback(
    (patch: Partial<WorkflowUIState>) => {
      workflowRef.current = { ...workflowRef.current, ...patch };
      setWorkflow(workflowRef.current);
    },
    []
  );

  const startWorkflow = useCallback(
    async (
      sessionId: string,
      workflowName: string,
      dataPath: string
    ): Promise<string | null> => {
      if (!client) return null;

      try {
        const { runId } = await client.startWorkflow(
          sessionId,
          workflowName,
          dataPath
        );

        updateWorkflow({
          ...initialState,
          runId,
          workflowName,
          status: "running",
          startedAt: new Date().toISOString(),
        });

        return runId;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to start workflow";
        updateWorkflow({ error: message, status: "failed" });
        return null;
      }
    },
    [client, updateWorkflow]
  );

  const pauseWorkflow = useCallback(async () => {
    if (!client || !workflowRef.current.runId) return;
    try {
      await client.pauseWorkflow(workflowRef.current.runId);
      updateWorkflow({ status: "paused" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to pause workflow";
      updateWorkflow({ error: message });
    }
  }, [client, updateWorkflow]);

  const resumeWorkflow = useCallback(
    async (decisions?: Record<string, unknown>) => {
      if (!client || !workflowRef.current.runId) return;
      try {
        await client.resumeWorkflow(workflowRef.current.runId, decisions);
        updateWorkflow({ status: "running" });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to resume workflow";
        updateWorkflow({ error: message });
      }
    },
    [client, updateWorkflow]
  );

  const abortWorkflow = useCallback(async () => {
    if (!client || !workflowRef.current.runId) return;
    try {
      await client.abortWorkflow(workflowRef.current.runId);
      updateWorkflow({ status: "aborted" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to abort workflow";
      updateWorkflow({ error: message });
    }
  }, [client, updateWorkflow]);

  // Subscribe to workflow SSE events
  useEffect(() => {
    if (!isConnected) return;

    const unsubs: (() => void)[] = [];

    unsubs.push(
      subscribe(BioAgentEventType.WORKFLOW_STARTED, (data: unknown) => {
        const d = data as { runId: string; workflowName: string; totalNodes: number };
        updateWorkflow({
          runId: d.runId,
          workflowName: d.workflowName,
          totalNodes: d.totalNodes,
          status: "running",
          startedAt: new Date().toISOString(),
        });
      })
    );

    unsubs.push(
      subscribe(BioAgentEventType.WORKFLOW_NODE_START, (data: unknown) => {
        const d = data as { nodeId: string; skill: string };
        const nodes = workflowRef.current.nodes.map((n) =>
          n.nodeId === d.nodeId
            ? { ...n, status: "running" as const, startedAt: new Date().toISOString() }
            : n
        );
        const exists = nodes.some((n) => n.nodeId === d.nodeId);
        if (!exists) {
          nodes.push({
            nodeId: d.nodeId,
            skill: d.skill,
            status: "running",
            startedAt: new Date().toISOString(),
            endedAt: null,
            error: null,
            retryCount: 0,
          });
        }
        updateWorkflow({ nodes });
      })
    );

    unsubs.push(
      subscribe(BioAgentEventType.WORKFLOW_NODE_END, (data: unknown) => {
        const d = data as {
          nodeId: string;
          status: "completed" | "failed" | "skipped";
          error?: string;
        };
        const nodes = workflowRef.current.nodes.map((n) =>
          n.nodeId === d.nodeId
            ? {
                ...n,
                status: d.status === "failed" ? ("failed" as const) : d.status === "skipped" ? ("skipped" as const) : ("completed" as const),
                endedAt: new Date().toISOString(),
                error: d.error || null,
              }
            : n
        );
        const completed = nodes.filter(
          (n) => n.status === "completed" || n.status === "skipped"
        ).length;
        const failed = nodes.filter((n) => n.status === "failed").length;
        const progress =
          workflowRef.current.totalNodes > 0
            ? (completed + failed) / workflowRef.current.totalNodes
            : 0;
        updateWorkflow({ nodes, completedNodes: completed, failedNodes: failed, progress });
      })
    );

    unsubs.push(
      subscribe(BioAgentEventType.WORKFLOW_PAUSED, () => {
        updateWorkflow({ status: "paused" });
      })
    );

    unsubs.push(
      subscribe(BioAgentEventType.WORKFLOW_RESUMED, () => {
        updateWorkflow({ status: "running" });
      })
    );

    unsubs.push(
      subscribe(BioAgentEventType.WORKFLOW_COMPLETED, () => {
        updateWorkflow({
          status: "completed",
          progress: 1,
          completedAt: new Date().toISOString(),
        });
      })
    );

    unsubs.push(
      subscribe(BioAgentEventType.WORKFLOW_FAILED, (data: unknown) => {
        const d = data as { error?: string };
        updateWorkflow({
          status: "failed",
          error: d.error || "Workflow execution failed",
          completedAt: new Date().toISOString(),
        });
      })
    );

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [isConnected, subscribe, updateWorkflow]);

  const reset = useCallback(() => {
    updateWorkflow(initialState);
  }, [updateWorkflow]);

  return {
    workflow,
    startWorkflow,
    pauseWorkflow,
    resumeWorkflow,
    abortWorkflow,
    reset,
  };
}
