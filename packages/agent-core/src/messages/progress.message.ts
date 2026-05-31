// ============================================================
// @bioagent/agent-core — ProgressMessage
// ============================================================

/**
 * Progress message — communicates the progress of long-running operations
 * such as workflow steps, image pulls, or data processing.
 */
export interface ProgressMessage {
  /** Message type discriminator */
  type: "progress";

  /** Unique message ID */
  id: string;

  /** Session ID */
  sessionId: string;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** The operation/tool producing progress updates */
  source: string;

  /** The specific task or node being executed */
  task: string;

  /** Current progress stage */
  stage: ProgressStage;

  /** Progress percentage (0-100), if quantifiable */
  percentage?: number;

  /** Current step number (if part of a sequence) */
  currentStep?: number;

  /** Total number of steps */
  totalSteps?: number;

  /** Human-readable status message */
  statusMessage: string;

  /** Estimated time remaining in seconds */
  estimatedRemaining?: number;

  /** Whether the operation can be cancelled */
  cancellable: boolean;
}

export type ProgressStage =
  | "queued"
  | "initializing"
  | "downloading"
  | "processing"
  | "writing"
  | "finalizing"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Create a progress message.
 */
export function createProgress(params: {
  sessionId: string;
  source: string;
  task: string;
  stage: ProgressStage;
  percentage?: number;
  currentStep?: number;
  totalSteps?: number;
  statusMessage: string;
  estimatedRemaining?: number;
  cancellable?: boolean;
}): ProgressMessage {
  return {
    type: "progress",
    id: `progress-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: params.sessionId,
    timestamp: new Date().toISOString(),
    source: params.source,
    task: params.task,
    stage: params.stage,
    percentage: params.percentage,
    currentStep: params.currentStep,
    totalSteps: params.totalSteps,
    statusMessage: params.statusMessage,
    estimatedRemaining: params.estimatedRemaining,
    cancellable: params.cancellable ?? false,
  };
}
