// ============================================================
// @bioagent/agent-core — QCReportMessage
// ============================================================

import type { QCCheck } from "../hooks/qc.hook";

/**
 * QC Report message — encapsulates a complete quality control report
 * including all checks, warnings, and recommendations.
 */
export interface QCReportMessage {
  /** Message type discriminator */
  type: "qc_report";

  /** Unique message ID */
  id: string;

  /** Session ID */
  sessionId: string;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** The tool or skill that produced this QC report */
  source: string;

  /** Whether all QC checks passed */
  passed: boolean;

  /** Individual check results */
  checks: QCCheck[];

  /** Non-fatal warnings */
  warnings: string[];

  /** Human-readable summary */
  summary: string;

  /** Whether knowledge base was consulted for remediation */
  knowledgeConsulted: boolean;

  /** Knowledge-based recommendation if consulted */
  knowledgeRecommendation?: string;

  /** Raw QC output from the tool */
  rawOutput?: string;
}

/**
 * Create a QC report from QC hook results.
 */
export function createQCReport(
  sessionId: string,
  source: string,
  qcResult: {
    passed: boolean;
    checks: QCCheck[];
    warnings: string[];
    summary: string;
    knowledgeConsulted: boolean;
    knowledgeRecommendation?: string;
  },
  rawOutput?: string,
): QCReportMessage {
  return {
    type: "qc_report",
    id: `qc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    timestamp: new Date().toISOString(),
    source,
    passed: qcResult.passed,
    checks: qcResult.checks,
    warnings: qcResult.warnings,
    summary: qcResult.summary,
    knowledgeConsulted: qcResult.knowledgeConsulted,
    knowledgeRecommendation: qcResult.knowledgeRecommendation,
    rawOutput,
  };
}
