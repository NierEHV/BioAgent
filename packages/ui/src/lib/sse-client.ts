// ============================================================
// @bioagent/ui — SSE Client (Server-Sent Events)
// ============================================================
// Listens to all 22 BioAgentEventType events from the backend.
// Automatically parses `event:` and `data:` lines.

/** All BioAgent event types as string constants */
export const BioAgentEventType = {
  // Thinking
  THINKING_STARTED: "thinking:started",
  THINKING_SECTION: "thinking:section",
  THINKING_COMPLETED: "thinking:completed",

  // Message
  MESSAGE_START: "message:start",
  MESSAGE_CHUNK: "message:chunk",
  MESSAGE_END: "message:end",

  // Tool Call
  TOOL_CALL_START: "tool:start",
  TOOL_CALL_PROGRESS: "tool:progress",
  TOOL_CALL_END: "tool:end",

  // Workflow
  WORKFLOW_STARTED: "workflow:started",
  WORKFLOW_NODE_START: "workflow:node:start",
  WORKFLOW_NODE_END: "workflow:node:end",
  WORKFLOW_PAUSED: "workflow:paused",
  WORKFLOW_RESUMED: "workflow:resumed",
  WORKFLOW_COMPLETED: "workflow:completed",
  WORKFLOW_FAILED: "workflow:failed",

  // QC
  QC_REPORT: "qc:report",
  QC_WARNING: "qc:warning",
  QC_FAILED: "qc:failed",

  // Visualization
  VIZ_READY: "viz:ready",

  // Knowledge
  KNOWLEDGE_REF: "knowledge:reference",

  // Error
  ERROR: "error",
  ERROR_RECOVERABLE: "error:recoverable",
  ERROR_FATAL: "error:fatal",
} as const;

export type BioAgentEventType =
  (typeof BioAgentEventType)[keyof typeof BioAgentEventType];

export type SSEEventHandler = (data: unknown) => void;

export enum SSEClientState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  ERROR = "error",
}

export class BioAgentSSEClient {
  private eventSource: EventSource | null = null;
  private handlers = new Map<string, Set<SSEEventHandler>>();
  private baseUrl: string;
  private _state: SSEClientState = SSEClientState.DISCONNECTED;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelayMs = 2000;
  private activeSessionId: string | null = null;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }

  get state(): SSEClientState {
    return this._state;
  }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  connect(sessionId: string): void {
    if (this.eventSource) {
      this.disconnect();
    }

    this.activeSessionId = sessionId;
    this._state = SSEClientState.CONNECTING;
    this.reconnectAttempts = 0;

    const url = `${this.baseUrl}/api/agent?sessionId=${encodeURIComponent(sessionId)}`;
    this.eventSource = new EventSource(url);

    // Register handlers for all 22 event types
    for (const eventType of Object.values(BioAgentEventType)) {
      this.eventSource.addEventListener(eventType, (rawEvent: Event) => {
        const messageEvent = rawEvent as MessageEvent;
        try {
          const parsed = JSON.parse(messageEvent.data);
          this.dispatch(eventType, parsed);
        } catch {
          this.dispatch(eventType, messageEvent.data);
        }
      });
    }

    // Generic message handler for untyped events
    this.eventSource.onmessage = (rawEvent: MessageEvent) => {
      try {
        const parsed = JSON.parse(rawEvent.data);
        this.dispatch(rawEvent.type || "message", parsed);
      } catch {
        this.dispatch(rawEvent.type || "message", rawEvent.data);
      }
    };

    this.eventSource.onopen = () => {
      this._state = SSEClientState.CONNECTED;
      this.reconnectAttempts = 0;
      this.dispatch("__internal:connected", { sessionId });
    };

    this.eventSource.onerror = () => {
      this._state = SSEClientState.ERROR;
      this.dispatch("__internal:error", {
        sessionId,
        attempt: this.reconnectAttempts,
      });

      if (
        this.reconnectAttempts < this.maxReconnectAttempts &&
        this.eventSource
      ) {
        this.eventSource.close();
        this.eventSource = null;
        this.scheduleReconnect(sessionId);
      }
    };
  }

  disconnect(): void {
    this.cancelReconnect();
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this._state = SSEClientState.DISCONNECTED;
    this.activeSessionId = null;
    this.dispatch("__internal:disconnected", {});
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  on(eventType: string, handler: SSEEventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  off(eventType: string, handler: SSEEventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }

  once(eventType: string, handler: SSEEventHandler): void {
    const wrapper: SSEEventHandler = (data) => {
      this.off(eventType, wrapper);
      handler(data);
    };
    this.on(eventType, wrapper);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private dispatch(eventType: string, data: unknown): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`SSE handler error for event "${eventType}":`, err);
        }
      }
    }
  }

  private scheduleReconnect(sessionId: string): void {
    this.cancelReconnect();
    const delay =
      this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect(sessionId);
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
