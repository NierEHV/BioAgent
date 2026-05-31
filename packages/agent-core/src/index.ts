// ============================================================
// @bioagent/agent-core — Public API
// ============================================================

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------
export type {
  BioAgentConfig,
  ThinkingSection,
  AnalysisPath,
  Risk,
  Reference,
} from "./types.js";

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export { BioAgentEventType } from "./events/event-types.js";

// ---------------------------------------------------------------------------
// Thinking Engine
// ---------------------------------------------------------------------------
export { ThinkingEngine } from "./thinking-engine.js";
export type { ThinkingContext } from "./thinking-engine.js";
export { THINKING_TEMPLATE, renderTemplate } from "./thinking-template.js";

// ---------------------------------------------------------------------------
// BioAgent Main Class
// ---------------------------------------------------------------------------
export { BioAgent } from "./bio-agent.js";
export type { BioAgentEvent } from "./bio-agent.js";

// ---------------------------------------------------------------------------
// Session Manager
// ---------------------------------------------------------------------------
export { SessionManager } from "./session/session-manager.js";
export type { SessionMessage } from "./session/session-manager.js";

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
export {
  dockerExecToolDef,
  dockerExecToolSchema,
  dockerExecHandler,
} from "./tools/docker-exec.tool.js";
export type { DockerExecToolParams } from "./tools/docker-exec.tool.js";

export {
  dockerSearchToolDef,
  dockerSearchToolSchema,
  dockerSearchHandler,
} from "./tools/docker-search.tool.js";
export type { DockerSearchToolParams } from "./tools/docker-search.tool.js";

export {
  dockerPullToolDef,
  dockerPullToolSchema,
  dockerPullHandler,
} from "./tools/docker-pull.tool.js";
export type { DockerPullToolParams } from "./tools/docker-pull.tool.js";

export {
  dockerInspectToolDef,
  dockerInspectToolSchema,
  dockerInspectHandler,
} from "./tools/docker-inspect.tool.js";
export type { DockerInspectToolParams } from "./tools/docker-inspect.tool.js";

export {
  dockerVerifyToolDef,
  dockerVerifyToolSchema,
  dockerVerifyHandler,
} from "./tools/docker-verify.tool.js";
export type { DockerVerifyToolParams } from "./tools/docker-verify.tool.js";

export {
  skillInvokeToolDef,
  skillInvokeToolSchema,
  skillInvokeHandler,
} from "./tools/skill-invoke.tool.js";
export type { SkillInvokeToolParams } from "./tools/skill-invoke.tool.js";

export {
  kbQueryToolDef,
  kbQueryToolSchema,
  kbQueryHandler,
} from "./tools/kb-query.tool.js";
export type { KbQueryToolParams } from "./tools/kb-query.tool.js";

export {
  fileInspectToolDef,
  fileInspectToolSchema,
  fileInspectHandler,
} from "./tools/file-inspect.tool.js";
export type { FileInspectToolParams } from "./tools/file-inspect.tool.js";

export {
  workflowRunToolDef,
  workflowRunToolSchema,
  workflowRunHandler,
} from "./tools/workflow-run.tool.js";
export type { WorkflowRunToolParams } from "./tools/workflow-run.tool.js";

export { ALL_TOOLS } from "./tools/index.js";

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export {
  validateBeforeToolCall,
  PATH_WHITELIST,
  MAX_TIMEOUT_MS,
} from "./hooks/validation.hook.js";
export type { ValidationResult } from "./hooks/validation.hook.js";

export { qcAfterToolCall } from "./hooks/qc.hook.js";
export type { QCResult, QCCheck } from "./hooks/qc.hook.js";

export { createThinkingHook } from "./hooks/thinking.hook.js";
export type { ThinkingHook } from "./hooks/thinking.hook.js";

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
export {
  createThinkingStart,
  createThinkingSection,
  createThinkingEnd,
} from "./messages/thinking.message.js";
export type { ThinkingMessage } from "./messages/thinking.message.js";

export { createQCReport } from "./messages/qc-report.message.js";
export type { QCReportMessage } from "./messages/qc-report.message.js";

export { createProgress } from "./messages/progress.message.js";
export type { ProgressMessage, ProgressStage } from "./messages/progress.message.js";

export {
  createVizFile,
  createVizInline,
  createVizUrl,
} from "./messages/viz.message.js";
export type { VizMessage, VizPlot, VizPlotType, VizDelivery } from "./messages/viz.message.js";
