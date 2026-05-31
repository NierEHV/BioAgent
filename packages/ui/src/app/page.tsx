"use client";

// ============================================================
// @bioagent/ui — Main Page
// ============================================================
// Three-column layout: File Browser | Chat | Details Panel

import { useState, useCallback, useRef, useEffect } from "react";
import { useBioAgent, type BioAgentSession } from "@/hooks/useBioAgent";
import { useWorkflow, type WorkflowNodeState } from "@/hooks/useWorkflow";
import { useSSE } from "@/hooks/useSSE";
import { BioAgentEventType } from "@/lib/sse-client";
import FileBrowser from "@/components/bioagent/FileBrowser";
import FileInspector from "@/components/bioagent/FileInspector";
import ProgressTracker from "@/components/bioagent/ProgressTracker";
import QCReportCard, { type QCGateData } from "@/components/bioagent/QCReportCard";
import VizPanel from "@/components/bioagent/VizPanel";
import ThinkingPanel, { type ThinkingSection } from "@/components/bioagent/ThinkingPanel";
import KnowledgeRef, { type KnowledgeReference } from "@/components/bioagent/KnowledgeRef";
import ResourceMonitor from "@/components/bioagent/ResourceMonitor";
import WorkflowSelector from "@/components/bioagent/WorkflowSelector";
import type { FileNode } from "@/components/bioagent/FileBrowser";
import type { FileInspectionResult, ResourceStatus, WorkflowRunState } from "@/lib/bioagent-client";

// ---------------------------------------------------------------------------
// Types for chat state
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
}

interface RightPanelTab {
  id: string;
  label: string;
  icon: string;
}

const rightPanelTabs: RightPanelTab[] = [
  { id: "progress", label: "Progress", icon: "📊" },
  { id: "thinking", label: "Thinking", icon: "🧠" },
  { id: "qc", label: "QC", icon: "✅" },
  { id: "viz", label: "Viz", icon: "📈" },
  { id: "knowledge", label: "Knowledge", icon: "📚" },
  { id: "resources", label: "Resources", icon: "💻" },
];

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function HomePage() {
  // BioAgent client
  const { client, api, session, createSession, isLoading: clientLoading } =
    useBioAgent();

  // SSE connection
  const { connect, disconnect, subscribe, isConnected, state: sseState } = useSSE();

  // Workflow state
  const { workflow, startWorkflow, pauseWorkflow, resumeWorkflow, abortWorkflow } =
    useWorkflow(client);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // File state
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileInspection, setFileInspection] = useState<FileInspectionResult | null>(null);
  const [fileInspecting, setFileInspecting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Thinking state
  const [thinkingSections, setThinkingSections] = useState<ThinkingSection[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  // QC state
  const [qcReports, setQcReports] = useState<
    { skillName: string; overall: "pass" | "warn" | "fail"; gates: QCGateData[] }[]
  >([]);

  // Viz state
  const [visualizations, setVisualizations] = useState<
    { type: "umap" | "volcano" | "heatmap" | "dotplot" | "violin"; url: string; metadata: Record<string, unknown> }[]
  >([]);

  // Knowledge state
  const [knowledgeRefs, setKnowledgeRefs] = useState<KnowledgeReference[]>([]);
  const [knowledgeAnswer, setKnowledgeAnswer] = useState<string | undefined>();
  const [knowledgeConfidence, setKnowledgeConfidence] = useState<number | undefined>();

  // Resources state
  const [resources, setResources] = useState<ResourceStatus | null>(null);

  // Right panel state
  const [activeRightTab, setActiveRightTab] = useState("progress");

  // Workflow selector
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>("");

  // Sidebar collapsed
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize project session on mount
  useEffect(() => {
    createSession("default-project");
  }, [createSession]);

  // Subscribe to SSE events when connected
  useEffect(() => {
    if (!isConnected) return;

    const unsubs: (() => void)[] = [];

    // Thinking events
    unsubs.push(
      subscribe(BioAgentEventType.THINKING_STARTED, (data: unknown) => {
        const d = data as { totalSections: number };
        setIsThinking(true);
        setThinkingSections(
          Array.from({ length: d.totalSections }, (_, i) => ({
            index: i + 1,
            title: `Step ${i + 1}`,
            content: "",
            completed: false,
            isLoading: i === 0,
          }))
        );
      })
    );

    unsubs.push(
      subscribe(BioAgentEventType.THINKING_SECTION, (data: unknown) => {
        const d = data as { index: number; title: string; content: string };
        setThinkingSections((prev) =>
          prev.map((s) =>
            s.index === d.index
              ? { ...s, title: d.title, content: d.content, completed: true, isLoading: false }
              : s.index === d.index + 1
                ? { ...s, isLoading: true }
                : s
          )
        );
      })
    );

    unsubs.push(
      subscribe(BioAgentEventType.THINKING_COMPLETED, () => {
        setIsThinking(false);
        setThinkingSections((prev) =>
          prev.map((s) => ({ ...s, isLoading: false, completed: true }))
        );
      })
    );

    // Message events
    unsubs.push(
      subscribe(BioAgentEventType.MESSAGE_CHUNK, (data: unknown) => {
        const d = data as { content: string; index: number };
        setIsStreaming(true);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "agent") {
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + d.content + "\n" },
            ];
          }
          return [
            ...prev,
            {
              id: `agent-${Date.now()}`,
              role: "agent",
              content: d.content + "\n",
              timestamp: new Date().toISOString(),
            },
          ];
        });
      })
    );

    unsubs.push(
      subscribe(BioAgentEventType.MESSAGE_END, () => {
        setIsStreaming(false);
      })
    );

    // QC events
    unsubs.push(
      subscribe(BioAgentEventType.QC_REPORT, (data: unknown) => {
        const d = data as {
          skillName: string;
          overall: "pass" | "warn" | "fail";
          gates: QCGateData[];
        };
        setQcReports((prev) => [...prev, d]);
        // Auto-switch to QC tab
        setActiveRightTab("qc");
      })
    );

    // Viz events
    unsubs.push(
      subscribe(BioAgentEventType.VIZ_READY, (data: unknown) => {
        const d = data as {
          type: "umap" | "volcano" | "heatmap" | "dotplot" | "violin";
          url: string;
          metadata: Record<string, unknown>;
        };
        setVisualizations((prev) => [...prev, d]);
      })
    );

    // Knowledge events
    unsubs.push(
      subscribe(BioAgentEventType.KNOWLEDGE_REF, (data: unknown) => {
        const d = data as {
          answer: string;
          references: KnowledgeReference[];
          confidence: number;
        };
        setKnowledgeAnswer(d.answer);
        setKnowledgeRefs(d.references);
        setKnowledgeConfidence(d.confidence);
      })
    );

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [isConnected, subscribe]);

  // Load files when session ready
  useEffect(() => {
    if (!session) return;
    api.listFiles(session.projectId).then((fileList) => {
      const nodes: FileNode[] = fileList.map((f) => ({
        name: f.name,
        path: f.path,
        type: "file" as const,
        format: f.format,
        sizeBytes: f.sizeBytes,
      }));
      setFiles(nodes);
    });
  }, [session, api]);

  // Poll resources
  useEffect(() => {
    const interval = setInterval(() => {
      api.getResourceStatus().then(setResources).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [api]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || !session) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputValue,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsStreaming(true);

    // Connect SSE if not connected
    if (!isConnected) {
      connect(session.sessionId);
    }

    // Send message
    try {
      await api.sendMessage(session.sessionId, inputValue);
    } catch {
      setIsStreaming(false);
    }
  }, [inputValue, session, isConnected, connect, api]);

  const handleFileSelect = useCallback(
    async (path: string) => {
      setSelectedFilePath(path);
      setFileInspecting(true);
      setFileError(null);
      try {
        const result = await api.inspectFile(path);
        setFileInspection(result);
      } catch (err) {
        setFileError(err instanceof Error ? err.message : "Failed to inspect file");
        setFileInspection(null);
      } finally {
        setFileInspecting(false);
      }
    },
    [api]
  );

  const handleFileDelete = useCallback(
    async (path: string) => {
      try {
        await api.deleteFile(path);
        setFiles((prev) => prev.filter((f) => f.path !== path));
        if (selectedFilePath === path) {
          setSelectedFilePath(null);
          setFileInspection(null);
        }
      } catch {
        // ignore
      }
    },
    [api, selectedFilePath]
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !session) return;
      try {
        const { path } = await api.uploadFile(session.projectId, file);
        const newNode: FileNode = {
          name: file.name,
          path,
          type: "file",
          format: file.name.split(".").pop() || "unknown",
          sizeBytes: file.size,
        };
        setFiles((prev) => [...prev, newNode]);
      } catch {
        // ignore
      }
      e.target.value = "";
    },
    [session, api]
  );

  const handleTriggerWorkflow = useCallback(async () => {
    if (!session || !selectedWorkflow) return;
    const runId = await startWorkflow(
      session.sessionId,
      selectedWorkflow,
      `/data/${session.projectId}`
    );
    if (runId) {
      setActiveRightTab("progress");
    }
  }, [session, selectedWorkflow, startWorkflow]);

  const handleQCApplySuggestion = useCallback((gateId: string) => {
    // Bridge to backend auto-fix
    console.log("Apply suggestion for gate:", gateId);
  }, []);

  const handleQCIgnore = useCallback((gateId: string) => {
    console.log("Ignore suggestion for gate:", gateId);
  }, []);

  const handleQCCustomThreshold = useCallback((gateId: string, value: number) => {
    console.log("Custom threshold for gate:", gateId, value);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Left Sidebar — File Browser */}
      <aside
        className={`shrink-0 border-r border-gray-200 bg-gray-50/50 transition-all duration-300 dark:border-gray-800 dark:bg-gray-900/50 ${
          sidebarCollapsed ? "w-10" : "w-[260px]"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-800">
            {!sidebarCollapsed && (
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Project Files
              </span>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg
                className={`h-4 w-4 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </button>
          </div>

          {!sidebarCollapsed && (
            <>
              {/* Upload button */}
              <div className="px-3 py-2">
                <label className="btn-secondary inline-flex w-full cursor-pointer text-xs">
                  <svg className="mr-1.5 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Upload File
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              {/* File tree */}
              <div className="flex-1 overflow-hidden">
                <FileBrowser
                  files={files}
                  onSelectFile={handleFileSelect}
                  onDeleteFile={handleFileDelete}
                  selectedPath={selectedFilePath || undefined}
                  isLoading={clientLoading}
                />
              </div>

              {/* File inspector at bottom */}
              {selectedFilePath && (
                <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 max-h-[200px] overflow-auto">
                  <FileInspector
                    result={fileInspection}
                    isLoading={fileInspecting}
                    error={fileError}
                    onClose={() => {
                      setSelectedFilePath(null);
                      setFileInspection(null);
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Center — Main Chat */}
      <section className="flex flex-1 flex-col">
        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !isStreaming && (
            <div className="flex h-full flex-col items-center justify-center px-4">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 dark:bg-brand-900/30">
                <span className="text-3xl">🧬</span>
              </div>
              <h2 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-200">
                Welcome to BioAgent
              </h2>
              <p className="mb-8 max-w-md text-center text-sm text-gray-500 dark:text-gray-400">
                Upload your single-cell data and describe your analysis in natural
                language. The AI agent will plan, execute, and monitor the workflow.
              </p>

              {/* Quick actions */}
              <div className="grid w-full max-w-lg grid-cols-2 gap-3">
                {[
                  { title: "scRNA-seq QC", desc: "Run quality control on raw count matrix" },
                  { title: "Differential Expression", desc: "Find differentially expressed genes" },
                  { title: "Cell Clustering", desc: "Cluster and annotate cell populations" },
                  { title: "Functional Enrichment", desc: "GO/KEGG pathway enrichment analysis" },
                ].map((action) => (
                  <button
                    key={action.title}
                    type="button"
                    onClick={() => setInputValue(`Run ${action.title.toLowerCase()} analysis on the uploaded data`)}
                    className="rounded-xl border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
                  >
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {action.title}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">{action.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.length > 0 && (
            <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-brand-600 text-white"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    <p
                      className={`mt-1 text-right text-xs ${
                        msg.role === "user"
                          ? "text-brand-200"
                          : "text-gray-400"
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}

              {/* Streaming indicator */}
              {isStreaming && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-3 dark:bg-gray-800">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Chat input area */}
        <div className="shrink-0 border-t border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="mx-auto max-w-3xl">
            {/* Workflow selector + trigger */}
            <div className="mb-3 flex items-end gap-3">
              <div className="flex-1">
                <WorkflowSelector
                  client={client}
                  onSelect={setSelectedWorkflow}
                  selected={selectedWorkflow}
                />
              </div>
              <button
                type="button"
                onClick={handleTriggerWorkflow}
                disabled={!selectedWorkflow || !session}
                className="btn-primary h-10 text-xs"
              >
                ▶ Run Workflow
              </button>
            </div>

            {/* Message input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Describe your analysis in natural language..."
                className="input-field flex-1"
                disabled={isStreaming}
              />
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isStreaming || !session}
                className="btn-primary h-10 w-10 p-0"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>

            {/* Session status */}
            <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
              {session && (
                <span>
                  Session: {session.sessionId.slice(0, 12)}...
                </span>
              )}
              {workflow.runId && (
                <span>
                  Run: {workflow.runId.slice(0, 12)}...
                </span>
              )}
              <span>
                SSE: {sseState}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Right Panel — Details */}
      <aside
        className={`shrink-0 border-l border-gray-200 bg-white transition-all duration-300 dark:border-gray-800 dark:bg-gray-950 ${
          rightPanelCollapsed ? "w-10" : "w-[380px]"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Panel header + tabs */}
          {!rightPanelCollapsed && (
            <>
              <div className="shrink-0 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between px-2">
                  <div className="flex overflow-x-auto">
                    {rightPanelTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveRightTab(tab.id)}
                        className={`flex items-center gap-1 whitespace-nowrap px-3 py-2 text-xs font-medium transition-colors ${
                          activeRightTab === tab.id
                            ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400"
                            : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        }`}
                      >
                        <span>{tab.icon}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRightPanelCollapsed(true)}
                    className="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {activeRightTab === "progress" && (
                  <ProgressTracker
                    workflowRunId={workflow.runId || "no-active-run"}
                    nodes={workflow.nodes as WorkflowNodeState[]}
                    currentProgress={workflow.progress}
                    estimatedRemaining={
                      workflow.status === "running"
                        ? "~5-10 min"
                        : workflow.status === "completed"
                          ? "Done"
                          : "-"
                    }
                    onPause={pauseWorkflow}
                    onResume={resumeWorkflow}
                    onAbort={abortWorkflow}
                  />
                )}

                {activeRightTab === "thinking" && (
                  <ThinkingPanel
                    sections={thinkingSections}
                    isThinking={isThinking}
                  />
                )}

                {activeRightTab === "qc" && (
                  <>
                    {qcReports.length === 0 && (
                      <div className="card">
                        <p className="py-8 text-center text-sm text-gray-400">
                          No QC reports yet. Run a workflow to see quality control results.
                        </p>
                      </div>
                    )}
                    {qcReports.map((report, idx) => (
                      <QCReportCard
                        key={`${report.skillName}-${idx}`}
                        skillName={report.skillName}
                        overall={report.overall}
                        gates={report.gates}
                        onApplySuggestion={handleQCApplySuggestion}
                        onIgnoreSuggestion={handleQCIgnore}
                        onCustomThreshold={handleQCCustomThreshold}
                      />
                    ))}
                  </>
                )}

                {activeRightTab === "viz" && (
                  <VizPanel
                    visualizations={visualizations}
                    isLoading={false}
                  />
                )}

                {activeRightTab === "knowledge" && (
                  <KnowledgeRef
                    references={knowledgeRefs}
                    answer={knowledgeAnswer}
                    confidence={knowledgeConfidence}
                  />
                )}

                {activeRightTab === "resources" && (
                  <ResourceMonitor
                    resources={resources}
                    isLoading={false}
                  />
                )}
              </div>
            </>
          )}

          {/* Collapsed panel toggle */}
          {rightPanelCollapsed && (
            <div className="flex h-full flex-col items-center pt-3">
              <button
                type="button"
                onClick={() => setRightPanelCollapsed(false)}
                className="rounded p-0.5 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <div className="mt-4 flex flex-col gap-3">
                {rightPanelTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setRightPanelCollapsed(false);
                      setActiveRightTab(tab.id);
                    }}
                    className="rounded p-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                    title={tab.label}
                  >
                    {tab.icon}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
