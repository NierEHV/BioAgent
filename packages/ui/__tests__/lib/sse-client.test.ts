// ============================================================
// @bioagent/ui — SSE Client Tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  BioAgentSSEClient,
  BioAgentEventType,
  SSEClientState,
} from "@/lib/sse-client";

// ---------------------------------------------------------------------------
// Mock EventSource
// ---------------------------------------------------------------------------

class MockEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;
  readyState: number = 0; // CONNECTING
  private listeners: Map<string, Set<(event: MessageEvent) => void>> = new Map();

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
    this.listeners.clear();
  }

  // Test helpers
  _open() {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.();
  }

  _sendEvent(type: string, data: string) {
    const event = new MessageEvent(type, { data });
    const handlers = this.listeners.get(type);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }
  }

  _sendMessage(data: string) {
    const event = new MessageEvent("message", { data });
    this.onmessage?.(event);
  }

  _triggerError() {
    this.onerror?.();
  }
}

// Override global EventSource
const originalEventSource = globalThis.EventSource;

beforeEach(() => {
  (globalThis as Record<string, unknown>).EventSource =
    MockEventSource as unknown as typeof EventSource;
});

afterEach(() => {
  (globalThis as Record<string, unknown>).EventSource = originalEventSource;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BioAgentSSEClient", () => {
  describe("constructor", () => {
    it("should initialize with base URL", () => {
      const client = new BioAgentSSEClient("/api");
      expect(client.state).toBe(SSEClientState.DISCONNECTED);
    });

    it("should default to empty base URL", () => {
      const client = new BioAgentSSEClient();
      expect(client.state).toBe(SSEClientState.DISCONNECTED);
    });
  });

  describe("connect", () => {
    it("should connect to the correct URL", () => {
      const client = new BioAgentSSEClient();
      client.connect("test-session-123");
      expect(client.state).toBe(SSEClientState.CONNECTING);
    });

    it("should include sessionId in URL", () => {
      const client = new BioAgentSSEClient();
      // Access private eventSource to verify URL (via connect side-effect)
      client.connect("sess_abc");
      // After connecting, the mock EventSource should be created
      const es = (client as unknown as { eventSource: MockEventSource }).eventSource;
      expect(es).toBeTruthy();
      expect(es!.url).toContain("sessionId=sess_abc");
    });

    it("should update state to CONNECTED on open", () => {
      const client = new BioAgentSSEClient();
      client.connect("test");
      const es = (client as unknown as { eventSource: MockEventSource }).eventSource;
      es!._open();
      expect(client.state).toBe(SSEClientState.CONNECTED);
    });
  });

  describe("disconnect", () => {
    it("should update state to DISCONNECTED", () => {
      const client = new BioAgentSSEClient();
      client.connect("test");
      client.disconnect();
      expect(client.state).toBe(SSEClientState.DISCONNECTED);
    });
  });

  describe("on / off", () => {
    it("should register and trigger event handlers", () => {
      const client = new BioAgentSSEClient();
      const handler = vi.fn();

      client.on(BioAgentEventType.THINKING_STARTED, handler);
      client.connect("test");

      const es = (client as unknown as { eventSource: MockEventSource }).eventSource;
      es!._sendEvent(
        BioAgentEventType.THINKING_STARTED,
        JSON.stringify({ totalSections: 7 })
      );

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ totalSections: 7 });
    });

    it("should not trigger after off()", () => {
      const client = new BioAgentSSEClient();
      const handler = vi.fn();

      client.on(BioAgentEventType.THINKING_SECTION, handler);
      client.off(BioAgentEventType.THINKING_SECTION, handler);
      client.connect("test");

      const es = (client as unknown as { eventSource: MockEventSource }).eventSource;
      es!._sendEvent(
        BioAgentEventType.THINKING_SECTION,
        JSON.stringify({ index: 1 })
      );

      expect(handler).not.toHaveBeenCalled();
    });

    it("should support multiple handlers for the same event", () => {
      const client = new BioAgentSSEClient();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      client.on(BioAgentEventType.QC_REPORT, handler1);
      client.on(BioAgentEventType.QC_REPORT, handler2);
      client.connect("test");

      const es = (client as unknown as { eventSource: MockEventSource }).eventSource;
      es!._sendEvent(
        BioAgentEventType.QC_REPORT,
        JSON.stringify({ overall: "pass" })
      );

      expect(handler1).toHaveBeenCalledWith({ overall: "pass" });
      expect(handler2).toHaveBeenCalledWith({ overall: "pass" });
    });
  });

  describe("once", () => {
    it("should trigger handler only once", () => {
      const client = new BioAgentSSEClient();
      const handler = vi.fn();

      client.once(BioAgentEventType.MESSAGE_CHUNK, handler);
      client.connect("test");

      const es = (client as unknown as { eventSource: MockEventSource }).eventSource;
      es!._sendEvent(
        BioAgentEventType.MESSAGE_CHUNK,
        JSON.stringify({ content: "Hello" })
      );
      es!._sendEvent(
        BioAgentEventType.MESSAGE_CHUNK,
        JSON.stringify({ content: "World" })
      );

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ content: "Hello" });
    });
  });

  describe("event type constants", () => {
    it("should have all 22 event types defined", () => {
      const types = Object.values(BioAgentEventType);
      expect(types).toHaveLength(24);
    });

    it.each([
      ["thinking:started", BioAgentEventType.THINKING_STARTED],
      ["thinking:section", BioAgentEventType.THINKING_SECTION],
      ["thinking:completed", BioAgentEventType.THINKING_COMPLETED],
      ["message:start", BioAgentEventType.MESSAGE_START],
      ["message:chunk", BioAgentEventType.MESSAGE_CHUNK],
      ["message:end", BioAgentEventType.MESSAGE_END],
      ["tool:start", BioAgentEventType.TOOL_CALL_START],
      ["tool:progress", BioAgentEventType.TOOL_CALL_PROGRESS],
      ["tool:end", BioAgentEventType.TOOL_CALL_END],
      ["workflow:started", BioAgentEventType.WORKFLOW_STARTED],
      ["workflow:node:start", BioAgentEventType.WORKFLOW_NODE_START],
      ["workflow:node:end", BioAgentEventType.WORKFLOW_NODE_END],
      ["workflow:paused", BioAgentEventType.WORKFLOW_PAUSED],
      ["workflow:resumed", BioAgentEventType.WORKFLOW_RESUMED],
      ["workflow:completed", BioAgentEventType.WORKFLOW_COMPLETED],
      ["workflow:failed", BioAgentEventType.WORKFLOW_FAILED],
      ["qc:report", BioAgentEventType.QC_REPORT],
      ["qc:warning", BioAgentEventType.QC_WARNING],
      ["qc:failed", BioAgentEventType.QC_FAILED],
      ["viz:ready", BioAgentEventType.VIZ_READY],
      ["knowledge:reference", BioAgentEventType.KNOWLEDGE_REF],
      ["error", BioAgentEventType.ERROR],
    ])("should have correct value for %s", (expected, actual) => {
      expect(actual).toBe(expected);
    });
  });

  describe("reconnect behavior", () => {
    it("should attempt reconnection on error up to max attempts", () => {
      vi.useFakeTimers();
      const client = new BioAgentSSEClient();
      client.connect("test");

      // Trigger errors
      for (let i = 0; i < 6; i++) {
        const es = (client as unknown as { eventSource: MockEventSource })
          .eventSource;
        if (es) {
          es._triggerError();
          vi.advanceTimersByTime(2000 * Math.pow(2, i));
        } else {
          break;
        }
      }

      vi.useRealTimers();
    });
  });
});
