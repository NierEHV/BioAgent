"use client";

// ============================================================
// @bioagent/ui — Project Detail Page
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { BioAgentClient, type SessionListItem, type FileInfo } from "@/lib/bioagent-client";
import FileBrowser, { type FileNode } from "@/components/bioagent/FileBrowser";
import Link from "next/link";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const client = useState(() => new BioAgentClient())[0];

  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [sessionList, fileList] = await Promise.all([
        client.listSessions(projectId),
        client.listFiles(projectId),
      ]);
      setSessions(sessionList);
      setFiles(
        fileList.map((f: FileInfo) => ({
          name: f.name,
          path: f.path,
          type: "file" as const,
          format: f.format,
          sizeBytes: f.sizeBytes,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project data");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, client]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateSession = useCallback(async () => {
    try {
      const { sessionId } = await client.createSession(projectId);
      setActiveSessionId(sessionId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    }
  }, [projectId, client, loadData]);

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await client.deleteSession(sessionId);
        if (activeSessionId === sessionId) setActiveSessionId(null);
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete session");
      }
    },
    [client, activeSessionId, loadData]
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await client.uploadFile(projectId, file);
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
      e.target.value = "";
    },
    [projectId, client, loadData]
  );

  const handleFileDelete = useCallback(
    async (path: string) => {
      try {
        await client.deleteFile(path);
        if (selectedFile === path) setSelectedFile(null);
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    },
    [client, selectedFile, loadData]
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
          <p className="text-sm text-gray-400">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ← Back
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Project: {projectId}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {files.length} files · {sessions.length} sessions
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* File browser */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Files
              </h2>
              <label className="btn-secondary cursor-pointer text-xs">
                Upload
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <FileBrowser
                files={files}
                onSelectFile={(path) => setSelectedFile(path)}
                onDeleteFile={handleFileDelete}
                selectedPath={selectedFile || undefined}
              />
            </div>
          </div>
        </div>

        {/* Sessions */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Sessions
              </h2>
              <button
                type="button"
                onClick={handleCreateSession}
                className="btn-primary text-xs"
              >
                + New Session
              </button>
            </div>

            {sessions.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">
                No sessions yet. Create one to start analyzing.
              </p>
            )}

            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {sessions.map((s) => (
                <li
                  key={s.sessionId}
                  className={`flex items-center justify-between py-3 ${
                    activeSessionId === s.sessionId
                      ? "bg-brand-50 dark:bg-brand-900/10 -mx-4 px-4"
                      : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                        {s.sessionId.slice(0, 16)}...
                      </p>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.status === "active"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : s.status === "completed"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {s.messageCount} messages · Created{" "}
                      {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/?session=${s.sessionId}`}
                      className="rounded px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteSession(s.sessionId)}
                      className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
