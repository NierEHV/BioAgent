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
} from "./types";

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export { BioAgentEventType } from "./events/event-types";

// ---------------------------------------------------------------------------
// Thinking Engine
// ---------------------------------------------------------------------------
export { ThinkingEngine } from "./thinking-engine";
export type { ThinkingContext } from "./thinking-engine";
export { THINKING_TEMPLATE, renderTemplate } from "./thinking-template";

// ---------------------------------------------------------------------------
// BioAgent — pi-agent-core based Agent
// ---------------------------------------------------------------------------
export {
  getBioAgentSystemPrompt,
  getBioAgentHooks,
  BIOAGENT_SYSTEM_PROMPT,
} from "./bio-agent";

// ---------------------------------------------------------------------------
// Configuration (§4.1: bio-agent.config.ts)
// ---------------------------------------------------------------------------
export {
  DEFAULT_CONFIG,
  loadConfig,
  validateConfig,
} from "./bio-agent.config";


// ---------------------------------------------------------------------------
// Session Manager
// ---------------------------------------------------------------------------
export { SessionManager } from "./session/session-manager";
export type { SessionMessage } from "./session/session-manager";

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
export {
  dockerExecToolDef,
  dockerExecToolSchema,
  dockerExecHandler,
} from "./tools/docker-exec.tool";
export type { DockerExecToolParams } from "./tools/docker-exec.tool";

export {
  dockerSearchToolDef,
  dockerSearchToolSchema,
  dockerSearchHandler,
} from "./tools/docker-search.tool";
export type { DockerSearchToolParams } from "./tools/docker-search.tool";

export {
  dockerPullToolDef,
  dockerPullToolSchema,
  dockerPullHandler,
} from "./tools/docker-pull.tool";
export type { DockerPullToolParams } from "./tools/docker-pull.tool";

export {
  dockerInspectToolDef,
  dockerInspectToolSchema,
  dockerInspectHandler,
} from "./tools/docker-inspect.tool";
export type { DockerInspectToolParams } from "./tools/docker-inspect.tool";

export {
  dockerVerifyToolDef,
  dockerVerifyToolSchema,
  dockerVerifyHandler,
} from "./tools/docker-verify.tool";
export type { DockerVerifyToolParams } from "./tools/docker-verify.tool";

export {
  skillInvokeToolDef,
  skillInvokeToolSchema,
  skillInvokeHandler,
} from "./tools/skill-invoke.tool";
export type { SkillInvokeToolParams } from "./tools/skill-invoke.tool";

export {
  kbQueryToolDef,
  kbQueryToolSchema,
  kbQueryHandler,
} from "./tools/kb-query.tool";
export type { KbQueryToolParams } from "./tools/kb-query.tool";

export {
  fileInspectToolDef,
  fileInspectToolSchema,
  fileInspectHandler,
} from "./tools/file-inspect.tool";
export type { FileInspectToolParams } from "./tools/file-inspect.tool";

export {
  workflowRunToolDef,
  workflowRunToolSchema,
  workflowRunHandler,
} from "./tools/workflow-run.tool";
export type { WorkflowRunToolParams } from "./tools/workflow-run.tool";

export { ALL_TOOLS } from "./tools/index";

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export {
  validateBeforeToolCall,
  PATH_WHITELIST,
  MAX_TIMEOUT_MS,
} from "./hooks/validation.hook";
export type { ValidationResult } from "./hooks/validation.hook";

export { qcAfterToolCall } from "./hooks/qc.hook";
export type { QCResult, QCCheck } from "./hooks/qc.hook";

export { createThinkingHook } from "./hooks/thinking.hook";
export type { ThinkingHook } from "./hooks/thinking.hook";

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
export {
  createThinkingStart,
  createThinkingSection,
  createThinkingEnd,
} from "./messages/thinking.message";
export type { ThinkingMessage } from "./messages/thinking.message";

export { createQCReport } from "./messages/qc-report.message";
export type { QCReportMessage } from "./messages/qc-report.message";

export { createProgress } from "./messages/progress.message";
export type { ProgressMessage, ProgressStage } from "./messages/progress.message";

export {
  createVizFile,
  createVizInline,
  createVizUrl,
} from "./messages/viz.message";
export type { VizMessage, VizPlot, VizPlotType, VizDelivery } from "./messages/viz.message";
