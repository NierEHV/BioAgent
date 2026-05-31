// ============================================================
// @bioagent/agent-core — ThinkingMessage
// ============================================================

import type { ThinkingSection } from "../types.js";

/**
 * Thinking message — captures the structured thinking process output.
 *
 * Used to stream/serialize the 7-step structured thinking sections
 * from the BioAgent thinking engine. Each message contains one or more
 * sections emitted as the LLM generates them.
 */
export interface ThinkingMessage {
  /** Message type discriminator */
  type: "thinking";

  /** Unique message ID */
  id: string;

  /** Session ID this thinking belongs to */
  sessionId: string;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** The thinking sections emitted in this message */
  sections: ThinkingSection[];

  /** Whether this message represents the start of the thinking process */
  isStart: boolean;

  /** Whether this message represents the end of the thinking process */
  isEnd: boolean;

  /** Total number of sections expected (typically 7) */
  totalSections: number;

  /** Number of sections completed so far */
  completedSections: number;
}

/**
 * Create a thinking start message.
 */
export function createThinkingStart(
  sessionId: string,
  totalSections: number = 7,
): ThinkingMessage {
  return {
    type: "thinking",
    id: `thinking-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    timestamp: new Date().toISOString(),
    sections: [],
    isStart: true,
    isEnd: false,
    totalSections,
    completedSections: 0,
  };
}

/**
 * Create a thinking section message.
 */
export function createThinkingSection(
  sessionId: string,
  sections: ThinkingSection[],
  totalSections: number = 7,
): ThinkingMessage {
  return {
    type: "thinking",
    id: `thinking-section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    timestamp: new Date().toISOString(),
    sections,
    isStart: false,
    isEnd: sections.length >= totalSections,
    totalSections,
    completedSections: sections.length,
  };
}

/**
 * Create a thinking end message.
 */
export function createThinkingEnd(
  sessionId: string,
  allSections: ThinkingSection[],
): ThinkingMessage {
  return {
    type: "thinking",
    id: `thinking-end-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    timestamp: new Date().toISOString(),
    sections: allSections,
    isStart: false,
    isEnd: true,
    totalSections: allSections.length,
    completedSections: allSections.length,
  };
}
