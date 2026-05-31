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
} from "./engine.types";

// ---------------------------------------------------------------------------
// WorkflowRegistry
// ---------------------------------------------------------------------------
export { WorkflowRegistry } from "./registry";

// ---------------------------------------------------------------------------
// WorkflowScheduler
// ---------------------------------------------------------------------------
export { WorkflowScheduler } from "./scheduler";

// ---------------------------------------------------------------------------
// CheckpointManager
// ---------------------------------------------------------------------------
export { CheckpointManager } from "./checkpoint";

// ---------------------------------------------------------------------------
// Condition Evaluator
// ---------------------------------------------------------------------------
export { evaluateCondition, flattenContext } from "./condition";

// ---------------------------------------------------------------------------
// Error Policy
// ---------------------------------------------------------------------------
export { applyErrorPolicy, buildWarningNotification } from "./error-policy";
export type { ErrorPolicyResult } from "./error-policy";

// ---------------------------------------------------------------------------
// WorkflowEngine
// ---------------------------------------------------------------------------
export { WorkflowEngine } from "./engine";

// ---------------------------------------------------------------------------
// Pre-built Workflow Definitions
// ---------------------------------------------------------------------------
export { SCRNA_SEQ_STANDARD } from "./workflows/scrna-seq.workflow";
