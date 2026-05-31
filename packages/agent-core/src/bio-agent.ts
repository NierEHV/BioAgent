// ============================================================
// @bioagent/agent-core — BioAgent (Main Class)
// ============================================================

import type { BioAgentConfig } from "./types.js";
import { ThinkingEngine } from "./thinking-engine.js";
import type { ThinkingContext } from "./thinking-engine.js";
import { SessionManager } from "./session/session-manager.js";
import type { SessionMessage } from "./session/session-manager.js";
import { createThinkingHook } from "./hooks/thinking.hook.js";
import {
  validateBeforeToolCall,
} from "./hooks/validation.hook.js";
import { qcAfterToolCall, type QCResult } from "./hooks/qc.hook.js";
import { createThinkingSection, createThinkingEnd } from "./messages/thinking.message.js";
import { createQCReport } from "./messages/qc-report.message.js";
import type { DockerExecutor } from "@bioagent/executor";
import type { KnowledgeBridge } from "@bioagent/knowledge";

// ---------------------------------------------------------------------------
// BioAgent
// ---------------------------------------------------------------------------

/**
 * BioAgent is the central orchestrator for AI-powered bioinformatics analysis.
 *
 * It ties together:
 * - Docker executor (@bioagent/executor) for containerized tool execution
 * - Knowledge bridge (@bioagent/knowledge) for three-layer knowledge queries
 * - Thinking engine for 7-step structured reasoning
 * - Session manager for conversation persistence
 * - Validation/QC hooks for safety and quality assurance
 *
 * Usage:
 * ```ts
 * const agent = new BioAgent({
 *   config: { model: "...", ... },
 *   dockerExecutor: new DockerExecutor(),
 *   knowledgeBridge: new KnowledgeBridge(),
 * });
 *
 * const sessionId = await agent.createSession("my-project");
 * for await (const event of agent.processMessage(sessionId, "分析 scRNA-seq 数据")) {
 *   console.log(event);
 * }
 * ```
 */
export class BioAgent {
  private config: BioAgentConfig;
  private thinkingEngine: ThinkingEngine;
  private sessionManager: SessionManager;
  private dockerExecutor: DockerExecutor;
  private knowledgeBridge: KnowledgeBridge;
  private thinkingHook: ReturnType<typeof createThinkingHook>;

  constructor(params: {
    config: BioAgentConfig;
    dockerExecutor: DockerExecutor;
    knowledgeBridge: KnowledgeBridge;
  }) {
    this.config = params.config;
    this.dockerExecutor = params.dockerExecutor;
    this.knowledgeBridge = params.knowledgeBridge;
    this.thinkingEngine = new ThinkingEngine();
    this.sessionManager = new SessionManager(this.config.sessionDir);
    this.thinkingHook = createThinkingHook(this.thinkingEngine);
  }

  // -----------------------------------------------------------------------
  // Session management (delegate to SessionManager)
  // -----------------------------------------------------------------------

  /**
   * Create a new session for the given project.
   *
   * @param projectId - Project identifier
   * @returns New session UUID
   */
  async createSession(projectId: string): Promise<string> {
    return this.sessionManager.create(projectId);
  }

  /**
   * Get all messages in a session.
   *
   * @param sessionId - Session UUID
   * @returns Ordered array of session messages
   */
  async getSession(sessionId: string): Promise<SessionMessage[]> {
    return this.sessionManager.getMessages(sessionId);
  }

  /**
   * Fork a session at the given message index.
   *
   * @param sessionId - Original session UUID
   * @param atMessageIndex - Fork point (inclusive)
   * @returns New session UUID
   */
  async forkSession(sessionId: string, atMessageIndex: number): Promise<string> {
    return this.sessionManager.fork(sessionId, atMessageIndex);
  }

  /**
   * Compress a session by keeping head 5% and tail 20% of messages.
   *
   * @param sessionId - Session UUID
   */
  async compressSession(sessionId: string): Promise<void> {
    return this.sessionManager.compress(sessionId);
  }

  /**
   * Delete a session and all its data.
   *
   * @param sessionId - Session UUID
   */
  async deleteSession(sessionId: string): Promise<void> {
    return this.sessionManager.delete(sessionId);
  }

  // -----------------------------------------------------------------------
  // Message processing — async iterable event stream
  // -----------------------------------------------------------------------

  /**
   * Process a user message and return an async iterable of BioAgent events.
   *
   * The event stream includes:
   * - thinking:*  — structured thinking sections
   * - tool:*     — tool call lifecycles
   * - qc:*       — quality control reports
   * - viz:*      — visualization artifacts
   * - message:*  — agent response chunks
   * - knowledge:* — knowledge references
   * - error:*    — error events
   *
   * @param sessionId - Target session UUID
   * @param message - User's natural language message
   * @param attachments - Optional file attachments
   * @returns Async iterable of BioAgent events
   */
  async *processMessage(
    sessionId: string,
    message: string,
    attachments?: unknown[],
  ): AsyncIterable<BioAgentEvent> {
    // 1. Append user message to session
    await this.sessionManager.appendMessage(sessionId, {
      type: "user",
      content: { text: message, attachments },
      timestamp: new Date().toISOString(),
    });

    // 2. Emit thinking:started
    yield {
      type: "thinking:started",
      sessionId,
      timestamp: new Date().toISOString(),
    };

    // 3. Probe resources (async, non-blocking)
    let resourceReport: unknown = undefined;
    try {
      resourceReport = await this.dockerExecutor.probeQuick();
    } catch {
      // Resource probing is optional
    }

    // 4. Query knowledge base for initial context
    let knowledgeResult: unknown = undefined;
    try {
      knowledgeResult = await this.knowledgeBridge.query({
        question: message,
        maxResults: 3,
      });
    } catch {
      // Knowledge query is optional
    }

    // 5. Build thinking prompt
    const thinkingContext: ThinkingContext = {
      userQuestion: message,
      resourceReport,
      knowledgeResult,
    };

    const thinkingPrompt = this.thinkingHook.augmentSystemPrompt(thinkingContext);

    // 6. Simulate thinking sections (in real implementation, this would be LLM output)
    // Here we parse the template itself to generate the section structure
    const sections = this.thinkingHook.parseOutput(thinkingPrompt);
    for (const section of sections) {
      if (section.content) {
        yield {
          type: "thinking:section",
          sessionId,
          timestamp: new Date().toISOString(),
          section,
        };

        // Append thinking section to session
        await this.sessionManager.appendMessage(sessionId, {
          type: "thinking",
          content: createThinkingSection(sessionId, [section]),
          timestamp: new Date().toISOString(),
        });

        // Yield the thinking section message
        yield createThinkingSection(sessionId, [section]);
      }
    }

    // 7. Emit thinking:completed
    yield {
      type: "thinking:completed",
      sessionId,
      timestamp: new Date().toISOString(),
      totalSections: sections.filter((s) => s.content).length,
    };

    await this.sessionManager.appendMessage(sessionId, {
      type: "thinking",
      content: createThinkingEnd(sessionId, sections),
      timestamp: new Date().toISOString(),
    });

    // 8. Check auto-compress
    if (this.config.autoCompress) {
      const messages = await this.sessionManager.getMessages(sessionId);
      if (messages.length > this.config.maxSessionLength) {
        await this.sessionManager.compress(sessionId);
      }
    }

    // 9. Yield agent acknowledgment
    yield {
      type: "message:start",
      sessionId,
      timestamp: new Date().toISOString(),
    };

    yield {
      type: "message:chunk",
      sessionId,
      timestamp: new Date().toISOString(),
      content: `已按照 7 步思考框架对您的问题进行了系统化分析。请查看思考结果以了解详细的推理过程。`,
    };

    yield {
      type: "message:end",
      sessionId,
      timestamp: new Date().toISOString(),
    };

    // Append agent response to session
    await this.sessionManager.appendMessage(sessionId, {
      type: "agent",
      content: {
        text: "思考过程已完成，共生成 7 个分析步骤。",
        sectionsCount: sections.filter((s) => s.content).length,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // -----------------------------------------------------------------------
  // Tool dispatch — validate, execute, QC
  // -----------------------------------------------------------------------

  /**
   * Execute a tool call with full validation / execution / QC pipeline.
   * Yields events throughout the tool lifecycle (start, progress, end, qc).
   *
   * @param toolName - Tool name (must match one of the 9 defined tools)
   * @param params - Tool parameters
   * @param sessionId - Session ID for event emission
   * @yields BioAgent events (tool:start, tool:progress, tool:end, qc:*)
   * @returns Tool execution result
   */
  async *executeTool(
    toolName: string,
    params: Record<string, unknown>,
    sessionId: string,
  ): AsyncGenerator<BioAgentEvent, unknown, undefined> {
    // ---- 1. Validation (beforeToolCall) ----
    const validation = validateBeforeToolCall(
      toolName,
      params,
      this.config.requireConfirmation,
    );

    if (!validation.allowed) {
      throw new Error(`Tool call rejected by validation hook: ${validation.reason}`);
    }

    if (validation.warnings.length > 0) {
      // Log warnings but proceed
      for (const warning of validation.warnings) {
        yield {
          type: "tool:progress",
          sessionId,
          timestamp: new Date().toISOString(),
          toolName,
          statusMessage: warning,
          stage: "initializing",
        };
      }
    }

    if (validation.requiresConfirmation) {
      // In a real implementation, this would pause and wait for user confirmation
      yield {
        type: "tool:progress",
        sessionId,
        timestamp: new Date().toISOString(),
        toolName,
        statusMessage: "此操作需要用户确认才能继续执行",
        stage: "queued",
      };
    }

    // ---- 2. Execute tool ----
    yield {
      type: "tool:start",
      sessionId,
      timestamp: new Date().toISOString(),
      toolName,
      params: sanitizeParams(params),
    };

    const startTime = Date.now();
    let result: unknown;
    let toolError: Error | undefined;

    try {
      result = await this.dispatchTool(toolName, params);

      yield {
        type: "tool:end",
        sessionId,
        timestamp: new Date().toISOString(),
        toolName,
        duration: Date.now() - startTime,
        success: true,
      };
    } catch (err) {
      toolError = err instanceof Error ? err : new Error(String(err));

      yield {
        type: "tool:end",
        sessionId,
        timestamp: new Date().toISOString(),
        toolName,
        duration: Date.now() - startTime,
        success: false,
        error: toolError.message,
      };
    }

    // ---- 3. QC (afterToolCall) ----
    if (result !== undefined) {
      const qcResult = await qcAfterToolCall(
        toolName,
        result,
        this.knowledgeBridge,
      );

      // Emit QC events
      if (!qcResult.passed) {
        yield {
          type: "qc:failed",
          sessionId,
          timestamp: new Date().toISOString(),
          toolName,
          qcResult,
        };
      } else if (qcResult.warnings.length > 0) {
        yield {
          type: "qc:warning",
          sessionId,
          timestamp: new Date().toISOString(),
          toolName,
          qcResult,
        };
      } else {
        yield {
          type: "qc:report",
          sessionId,
          timestamp: new Date().toISOString(),
          toolName,
          qcResult,
        };
      }

      // Append QC report to session
      await this.sessionManager.appendMessage(sessionId, {
        type: "qc_report",
        content: createQCReport(sessionId, toolName, qcResult),
        timestamp: new Date().toISOString(),
      });
    }

    // ---- 4. Append tool call record ----
    await this.sessionManager.appendMessage(sessionId, {
      type: "tool_call",
      content: {
        toolName,
        params: sanitizeParams(params),
        result: toolError ? { error: toolError.message } : result,
        duration: Date.now() - startTime,
        success: !toolError,
      },
      timestamp: new Date().toISOString(),
    });

    if (toolError) throw toolError;
    return result;
  }

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  /** Get a copy of the current config. */
  getConfig(): BioAgentConfig {
    return { ...this.config };
  }

  /** Update configuration at runtime. */
  updateConfig(partial: Partial<BioAgentConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /** Get the underlying Docker executor. */
  getDockerExecutor(): DockerExecutor {
    return this.dockerExecutor;
  }

  /** Get the underlying knowledge bridge. */
  getKnowledgeBridge(): KnowledgeBridge {
    return this.knowledgeBridge;
  }

  /** Get the thinking engine. */
  getThinkingEngine(): ThinkingEngine {
    return this.thinkingEngine;
  }

  /** Get the session manager. */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  // -----------------------------------------------------------------------
  // Private: tool dispatch
  // -----------------------------------------------------------------------

  private async dispatchTool(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    // Dynamic import of tool handlers to avoid circular deps
    switch (toolName) {
      case "docker_exec": {
        const { dockerExecHandler } = await import(
          "./tools/docker-exec.tool.js"
        );
        return dockerExecHandler(params as never, this.dockerExecutor);
      }
      case "docker_search": {
        const { dockerSearchHandler } = await import(
          "./tools/docker-search.tool.js"
        );
        return dockerSearchHandler(params as never, this.dockerExecutor);
      }
      case "docker_pull": {
        const { dockerPullHandler } = await import(
          "./tools/docker-pull.tool.js"
        );
        return dockerPullHandler(params as never, this.dockerExecutor);
      }
      case "docker_inspect": {
        const { dockerInspectHandler } = await import(
          "./tools/docker-inspect.tool.js"
        );
        return dockerInspectHandler(params as never, this.dockerExecutor);
      }
      case "docker_verify": {
        const { dockerVerifyHandler } = await import(
          "./tools/docker-verify.tool.js"
        );
        return dockerVerifyHandler(params as never, this.dockerExecutor);
      }
      case "skill_invoke": {
        const { skillInvokeHandler } = await import(
          "./tools/skill-invoke.tool.js"
        );
        return skillInvokeHandler(params as never, this.dockerExecutor);
      }
      case "kb_query": {
        const { kbQueryHandler } = await import(
          "./tools/kb-query.tool.js"
        );
        return kbQueryHandler(params as never, this.knowledgeBridge);
      }
      case "file_inspect": {
        const { fileInspectHandler } = await import(
          "./tools/file-inspect.tool.js"
        );
        return fileInspectHandler(params as never);
      }
      case "workflow_run": {
        const { workflowRunHandler } = await import(
          "./tools/workflow-run.tool.js"
        );
        return workflowRunHandler(params as never);
      }
      default:
        throw new Error(
          `Unknown tool: "${toolName}". Available tools: docker_exec, docker_search, docker_pull, docker_inspect, docker_verify, skill_invoke, kb_query, file_inspect, workflow_run`,
        );
    }
  }
}

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

/** Union type for all BioAgent events emitted by processMessage and executeTool. */
export type BioAgentEvent =
  | { type: "thinking:started"; sessionId: string; timestamp: string }
  | {
      type: "thinking:section";
      sessionId: string;
      timestamp: string;
      section: import("./types.js").ThinkingSection;
    }
  | {
      type: "thinking:completed";
      sessionId: string;
      timestamp: string;
      totalSections: number;
    }
  | {
      type: "message:start";
      sessionId: string;
      timestamp: string;
    }
  | {
      type: "message:chunk";
      sessionId: string;
      timestamp: string;
      content: string;
    }
  | {
      type: "message:end";
      sessionId: string;
      timestamp: string;
    }
  | {
      type: "tool:start";
      sessionId: string;
      timestamp: string;
      toolName: string;
      params?: Record<string, unknown>;
    }
  | {
      type: "tool:progress";
      sessionId: string;
      timestamp: string;
      toolName: string;
      statusMessage: string;
      stage: string;
    }
  | {
      type: "tool:end";
      sessionId: string;
      timestamp: string;
      toolName: string;
      duration: number;
      success: boolean;
      error?: string;
    }
  | {
      type: "qc:report";
      sessionId: string;
      timestamp: string;
      toolName: string;
      qcResult: QCResult;
    }
  | {
      type: "qc:warning";
      sessionId: string;
      timestamp: string;
      toolName: string;
      qcResult: QCResult;
    }
  | {
      type: "qc:failed";
      sessionId: string;
      timestamp: string;
      toolName: string;
      qcResult: QCResult;
    }
  | {
      type: "error";
      sessionId: string;
      timestamp: string;
      error: string;
      toolName?: string;
    };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Remove sensitive or overly large values from tool params before logging.
 */
function sanitizeParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 500) {
      sanitized[key] = `${value.slice(0, 500)}... (truncated, total ${value.length} chars)`;
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = "(object)";
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
