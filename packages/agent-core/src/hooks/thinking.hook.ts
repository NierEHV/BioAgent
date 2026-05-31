// ============================================================
// @bioagent/agent-core — Thinking Hook
// ============================================================
// Injects the 7-step structured thinking template into the agent's system prompt.

import { ThinkingEngine } from "../thinking-engine.js";
import type { ThinkingContext } from "../thinking-engine.js";

// ---------------------------------------------------------------------------
// Thinking Hook
// ---------------------------------------------------------------------------

/**
 * System prompt augmentation hook that injects the BioAgent 7-step structured
 * thinking template into the agent conversation.
 *
 * This hook should be called before the agent processes each user message.
 *
 * Usage:
 * ```ts
 * const hook = createThinkingHook(engine);
 * const systemPrompt = hook.augmentSystemPrompt(context);
 * ```
 */
export function createThinkingHook(engine?: ThinkingEngine) {
  const thinkingEngine = engine ?? new ThinkingEngine();

  return {
    /**
     * Build an augmented system prompt that includes the thinking template.
     *
     * @param context - The thinking context (user question + optional enrichment)
     * @returns The complete system prompt string
     */
    augmentSystemPrompt(context: ThinkingContext): string {
      return thinkingEngine.buildPrompt(context);
    },

    /**
     * Parse the LLM's thinking output into structured sections.
     *
     * @param output - Raw LLM response text
     * @returns Array of 7 ThinkingSection objects
     */
    parseOutput(output: string) {
      return thinkingEngine.parseThinkingOutput(output);
    },

    /**
     * Get the underlying thinking engine instance.
     */
    getEngine(): ThinkingEngine {
      return thinkingEngine;
    },
  };
}

export type ThinkingHook = ReturnType<typeof createThinkingHook>;
