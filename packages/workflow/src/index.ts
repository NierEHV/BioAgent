// ============================================================
// @bioagent/workflow — Public API
// ============================================================

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------
export type {
  WorkflowDef,
  WorkflowNode,
  WorkflowInput,
  WorkflowOutput,
  WorkflowOutputFile,
  WorkflowState,
  WorkflowStatus,
  NodeState,
  NodeExecutionStatus,
  NodeCondition,
  NodeRetryConfig,
  ErrorPolicy,
  ResourceEstimate,
  CheckpointData,
} from "./engine.types.js";

// ---------------------------------------------------------------------------
// WorkflowRegistry
// ---------------------------------------------------------------------------
export { WorkflowRegistry } from "./registry.js";

// ---------------------------------------------------------------------------
// WorkflowScheduler
// ---------------------------------------------------------------------------
export { WorkflowScheduler } from "./scheduler.js";

// ---------------------------------------------------------------------------
// CheckpointManager
// ---------------------------------------------------------------------------
export { CheckpointManager } from "./checkpoint.js";

// ---------------------------------------------------------------------------
// Condition Evaluator
// ---------------------------------------------------------------------------
export { evaluateCondition, flattenContext } from "./condition.js";

// ---------------------------------------------------------------------------
// Error Policy
// ---------------------------------------------------------------------------
export { applyErrorPolicy, buildWarningNotification } from "./error-policy.js";
export type { ErrorPolicyResult } from "./error-policy.js";

// ---------------------------------------------------------------------------
// WorkflowEngine
// ---------------------------------------------------------------------------
export { WorkflowEngine } from "./engine.js";

// ---------------------------------------------------------------------------
// Pre-built Workflow Definitions
// ---------------------------------------------------------------------------
export { SCRNA_SEQ_STANDARD } from "./workflows/scrna-seq.workflow.js";
