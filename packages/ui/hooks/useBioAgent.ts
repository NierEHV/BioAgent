"use client";

// ============================================================
// @bioagent/ui — useBioAgent Hook
// ============================================================
// Provides a singleton BioAgentClient via React context pattern.
// Manages session state and exposes API methods.

import { useState, useCallback, useRef, useMemo } from "react";
import { BioAgentClient } from "@/lib/bioagent-client";

export interface BioAgentSession {
  sessionId: string;
  projectId: string;
  createdAt: string;
  status: "active" | "compressed" | "completed";
}

export function useBioAgent(baseUrl: string = "") {
  const clientRef = useRef<BioAgentClient | null>(null);
  const [session, setSession] = useState<BioAgentSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!clientRef.current) {
    clientRef.current = new BioAgentClient(baseUrl);
  }

  const client = clientRef.current;

  const createSession = useCallback(
    async (projectId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const { sessionId } = await client.createSession(projectId);
        const newSession: BioAgentSession = {
          sessionId,
          projectId,
          createdAt: new Date().toISOString(),
          status: "active",
        };
        setSession(newSession);
        return newSession;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create session";
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      setError(null);
      try {
        await client.deleteSession(sessionId);
        if (session?.sessionId === sessionId) {
          setSession(null);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete session";
        setError(message);
      }
    },
    [client, session]
  );

  const clearError = useCallback(() => setError(null), []);

  const withErrorHandling = useCallback(
    <T extends (...args: unknown[]) => Promise<unknown>>(fn: T): T => {
      return (async (...args: unknown[]) => {
        setError(null);
        setIsLoading(true);
        try {
          return await fn(...args);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Operation failed";
          setError(message);
          throw err;
        } finally {
          setIsLoading(false);
        }
      }) as T;
    },
    []
  );

  const api = useMemo(
    () => ({
      // Session
      createSession,
      deleteSession,
      listSessions: (projectId: string) => client.listSessions(projectId),

      // Messages
      sendMessage: (sessionId: string, message: string, attachments?: File[]) =>
        client.sendMessage(sessionId, message, attachments),

      // Workflow
      startWorkflow: (
        sessionId: string,
        workflowName: string,
        dataPath: string
      ) => client.startWorkflow(sessionId, workflowName, dataPath),
      getWorkflowState: (runId: string) => client.getWorkflowState(runId),
      pauseWorkflow: (runId: string) => client.pauseWorkflow(runId),
      resumeWorkflow: (
        runId: string,
        decisions?: Record<string, unknown>
      ) => client.resumeWorkflow(runId, decisions),
      abortWorkflow: (runId: string) => client.abortWorkflow(runId),
      listWorkflows: () => client.listWorkflows(),

      // Files
      uploadFile: (projectId: string, file: File) =>
        client.uploadFile(projectId, file),
      listFiles: (projectId: string) => client.listFiles(projectId),
      inspectFile: (path: string) => client.inspectFile(path),
      deleteFile: (path: string) => client.deleteFile(path),
      getFileDownloadUrl: (path: string) => client.getFileDownloadUrl(path),

      // Knowledge
      queryKnowledge: (question: string, context?: Record<string, unknown>) =>
        client.queryKnowledge(question, context),

      // Visualization
      getVisualization: (path: string) => client.getVisualization(path),
      getVisualizationList: (sessionId: string) =>
        client.getVisualizationList(sessionId),

      // Resources
      getResourceStatus: () => client.getResourceStatus(),

      // Health
      healthCheck: () => client.healthCheck(),
    }),
    [client, createSession, deleteSession]
  );

  return {
    client,
    api,
    session,
    isLoading,
    error,
    clearError,
    withErrorHandling,
    createSession,
    deleteSession,
  };
}
