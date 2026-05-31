"use client";

// ============================================================
// @bioagent/ui — useSSE Hook
// ============================================================
// Manages the SSE connection lifecycle and exposes event subscription.

import { useEffect, useRef, useState, useCallback } from "react";
import {
  BioAgentSSEClient,
  SSEClientState,
  type SSEEventHandler,
} from "@/lib/sse-client";

export function useSSE(baseUrl: string = "") {
  const clientRef = useRef<BioAgentSSEClient | null>(null);
  const [state, setState] = useState<SSEClientState>(
    SSEClientState.DISCONNECTED
  );
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef<SSEClientState>(SSEClientState.DISCONNECTED);

  // Lazy initialize client
  if (!clientRef.current) {
    clientRef.current = new BioAgentSSEClient(baseUrl);
  }

  const client = clientRef.current;

  const connect = useCallback(
    (sessionId: string) => {
      setError(null);
      client.connect(sessionId);
    },
    [client]
  );

  const disconnect = useCallback(() => {
    client.disconnect();
  }, [client]);

  const subscribe = useCallback(
    (eventType: string, handler: SSEEventHandler) => {
      client.on(eventType, handler);
      return () => {
        client.off(eventType, handler);
      };
    },
    [client]
  );

  const subscribeOnce = useCallback(
    (eventType: string, handler: SSEEventHandler) => {
      client.once(eventType, handler);
    },
    [client]
  );

  useEffect(() => {
    // Poll state changes (SSEClient state is synchronous after events fire)
    const interval = setInterval(() => {
      const currentState = client.state;
      if (currentState !== stateRef.current) {
        stateRef.current = currentState;
        setState(currentState);
      }
    }, 100);

    // Listen for error events
    const unsubError = subscribe("__internal:error", (data: unknown) => {
      const err = data as { sessionId: string; attempt: number };
      setError(`SSE connection error (attempt ${err.attempt + 1})`);
    });

    const unsubConnected = subscribe(
      "__internal:connected",
      () => {
        setError(null);
      }
    );

    return () => {
      clearInterval(interval);
      unsubError();
      unsubConnected();
    };
  }, [client, subscribe]);

  return {
    connect,
    disconnect,
    subscribe,
    subscribeOnce,
    state,
    error,
    isConnected: state === SSEClientState.CONNECTED,
    isConnecting: state === SSEClientState.CONNECTING,
  };
}
