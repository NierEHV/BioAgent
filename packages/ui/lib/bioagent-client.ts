// ============================================================
// @bioagent/ui — BioAgent API Client (frontend → backend bridge)
// ============================================================

export interface SessionListItem {
  sessionId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "compressed" | "completed";
  messageCount: number;
  description: string;
}

export interface WorkflowRunState {
  runId: string;
  workflowName: string;
  status: string;
  progress: number;
  currentNodes: string[];
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  startedAt: string;
  completedAt: string | null;
}

export interface FileInfo {
  path: string;
  name: string;
  format: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface FileInspectionResult {
  path: string;
  format: string;
  shape: { rows: number; cols: number } | null;
  columns: string[];
  sampleRows: Record<string, unknown>[];
  metadata: Record<string, unknown>;
}

export interface KnowledgeQueryResult {
  answer: string;
  references: {
    title: string;
    doi?: string;
    url?: string;
    type: "paper" | "docs" | "database";
    relevance: number;
  }[];
  confidence: number;
}

export interface VisualizationResponse {
  type: "umap" | "volcano" | "heatmap" | "violin" | "dotplot";
  url: string;
  metadata: Record<string, unknown>;
}

export interface ResourceStatus {
  cpu: { usage: number; cores: number };
  memory: { usedBytes: number; totalBytes: number; usagePercent: number };
  disk: { usedBytes: number; totalBytes: number; usagePercent: number };
  containers: { running: number; total: number };
  hostname: string;
}

export class BioAgentClient {
  constructor(private baseUrl: string = "") {}

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      let detail = body;
      try {
        const parsed = JSON.parse(body);
        detail = parsed.error || parsed.message || body;
      } catch {
        // use raw text
      }
      throw new Error(`BioAgent API error ${res.status}: ${detail}`);
    }

    if (res.headers.get("content-type")?.includes("application/json")) {
      return res.json() as Promise<T>;
    }

    return undefined as unknown as T;
  }

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  async createSession(projectId: string): Promise<{ sessionId: string }> {
    return this.request<{ sessionId: string }>(
      `/api/agent/sessions`,
      {
        method: "POST",
        body: JSON.stringify({ projectId }),
      }
    );
  }

  async listSessions(projectId: string): Promise<SessionListItem[]> {
    const params = new URLSearchParams({ projectId });
    return this.request<SessionListItem[]>(
      `/api/agent/sessions?${params.toString()}`
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.request(`/api/agent/sessions?sessionId=${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
  }

  // ---------------------------------------------------------------------------
  // Messages (SSE streaming)
  // ---------------------------------------------------------------------------

  async sendMessage(
    sessionId: string,
    message: string,
    attachments?: File[]
  ): Promise<ReadableStream<Uint8Array> | null> {
    const formData = new FormData();
    formData.append("sessionId", sessionId);
    formData.append("message", message);

    if (attachments) {
      for (const file of attachments) {
        formData.append("attachments", file);
      }
    }

    const url = `${this.baseUrl}/api/agent`;
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`BioAgent API error ${res.status}: ${body}`);
    }

    return res.body;
  }

  // ---------------------------------------------------------------------------
  // Workflow
  // ---------------------------------------------------------------------------

  async startWorkflow(
    sessionId: string,
    workflowName: string,
    dataPath: string
  ): Promise<{ runId: string }> {
    return this.request<{ runId: string }>("/api/workflow", {
      method: "POST",
      body: JSON.stringify({ sessionId, workflowName, dataPath }),
    });
  }

  async getWorkflowState(runId: string): Promise<WorkflowRunState> {
    return this.request<WorkflowRunState>(
      `/api/workflow/${encodeURIComponent(runId)}`
    );
  }

  async pauseWorkflow(runId: string): Promise<void> {
    await this.request(`/api/workflow/${encodeURIComponent(runId)}`, {
      method: "POST",
      body: JSON.stringify({ action: "pause" }),
    });
  }

  async resumeWorkflow(
    runId: string,
    decisions?: Record<string, unknown>
  ): Promise<void> {
    await this.request(`/api/workflow/${encodeURIComponent(runId)}`, {
      method: "POST",
      body: JSON.stringify({ action: "resume", decisions }),
    });
  }

  async abortWorkflow(runId: string): Promise<void> {
    await this.request(`/api/workflow/${encodeURIComponent(runId)}`, {
      method: "POST",
      body: JSON.stringify({ action: "abort" }),
    });
  }

  async listWorkflows(): Promise<{ name: string; description: string; version: string }[]> {
    return this.request("/api/workflow");
  }

  // ---------------------------------------------------------------------------
  // Files
  // ---------------------------------------------------------------------------

  async uploadFile(projectId: string, file: File): Promise<{ path: string }> {
    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("file", file);

    const url = `${this.baseUrl}/api/files`;
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`File upload error ${res.status}: ${body}`);
    }

    return res.json();
  }

  async listFiles(projectId: string): Promise<FileInfo[]> {
    const params = new URLSearchParams({ projectId });
    return this.request<FileInfo[]>(`/api/files?${params.toString()}`);
  }

  async inspectFile(path: string): Promise<FileInspectionResult> {
    const params = new URLSearchParams({ path });
    return this.request<FileInspectionResult>(
      `/api/files?${params.toString()}`
    );
  }

  async deleteFile(path: string): Promise<void> {
    await this.request(`/api/files?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
    });
  }

  async getFileDownloadUrl(path: string): Promise<string> {
    return `${this.baseUrl}/api/files?download=1&path=${encodeURIComponent(path)}`;
  }

  // ---------------------------------------------------------------------------
  // Knowledge Base
  // ---------------------------------------------------------------------------

  async queryKnowledge(
    question: string,
    context?: Record<string, unknown>
  ): Promise<KnowledgeQueryResult> {
    return this.request<KnowledgeQueryResult>("/api/knowledge", {
      method: "GET",
      body: JSON.stringify({ question, context }),
    });
  }

  // ---------------------------------------------------------------------------
  // Visualization
  // ---------------------------------------------------------------------------

  async getVisualization(path: string): Promise<Blob> {
    const url = `${this.baseUrl}/api/files?viz=1&path=${encodeURIComponent(path)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Visualization error ${res.status}`);
    }
    return res.blob();
  }

  async getVisualizationList(sessionId: string): Promise<VisualizationResponse[]> {
    const params = new URLSearchParams({ sessionId, list: "visualizations" });
    return this.request<VisualizationResponse[]>(`/api/files?${params.toString()}`);
  }

  // ---------------------------------------------------------------------------
  // Resources
  // ---------------------------------------------------------------------------

  async getResourceStatus(): Promise<ResourceStatus> {
    return this.request<ResourceStatus>("/api/resources");
  }

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  async healthCheck(): Promise<{ status: string; version: string; uptime: number }> {
    return this.request("/api/health");
  }
}
