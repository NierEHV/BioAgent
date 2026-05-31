// ============================================================
// @bioagent/agent-core — QC Hook (afterToolCall)
// ============================================================
// Parses exit codes from tool results; on QC failure, auto-queries knowledge.

import type { KnowledgeBridge } from "@bioagent/knowledge";

// ---------------------------------------------------------------------------
// QC result types
// ---------------------------------------------------------------------------

export interface QCResult {
  /** Overall QC pass/fail */
  passed: boolean;
  /** Individual check results */
  checks: QCCheck[];
  /** Warnings that don't fail QC */
  warnings: string[];
  /** Summary message */
  summary: string;
  /** Whether knowledge base was consulted */
  knowledgeConsulted: boolean;
  /** Knowledge-based recommendation if consulted */
  knowledgeRecommendation?: string;
}

export interface QCCheck {
  /** Check name */
  name: string;
  /** Whether this check passed */
  passed: boolean;
  /** Actual value observed */
  value: number | string;
  /** Expected threshold */
  threshold: number | string;
  /** Human-readable message */
  message: string;
}

// ---------------------------------------------------------------------------
// QC thresholds for scRNA-seq
// ---------------------------------------------------------------------------

const SCRNA_QC_THRESHOLDS = {
  minUmiCount: 500,
  maxUmiCount: 50000,
  minGeneCount: 200,
  maxGeneCount: 6000,
  maxMitoPercent: 20,
  minCellsPerGene: 3,
};

// ---------------------------------------------------------------------------
// QC Hook
// ---------------------------------------------------------------------------

/**
 * After-tool-call QC hook.
 *
 * Parses exit codes from exec results and performs quality control checks.
 * On QC failure, automatically queries the knowledge base for remediation guidance.
 *
 * @param toolName - Name of the tool that was called
 * @param result - Tool execution result
 * @param knowledgeBridge - Optional knowledge bridge for auto-remediation
 * @returns QC result
 */
export async function qcAfterToolCall(
  toolName: string,
  result: unknown,
  knowledgeBridge?: KnowledgeBridge,
): Promise<QCResult> {
  const checks: QCCheck[] = [];
  const warnings: string[] = [];
  let knowledgeConsulted = false;
  let knowledgeRecommendation: string | undefined;

  // ------------------------------------------------------------------
  // 1. Parse exit code from exec results
  // ------------------------------------------------------------------
  const exitCode = extractExitCode(result);

  if (exitCode !== undefined) {
    if (exitCode === 0) {
      checks.push({
        name: "Exit Code",
        passed: true,
        value: exitCode,
        threshold: 0,
        message: "Command executed successfully (exit code 0)",
      });
    } else {
      checks.push({
        name: "Exit Code",
        passed: false,
        value: exitCode,
        threshold: 0,
        message: `Command failed with exit code ${exitCode}. Check stderr for details.`,
      });
    }
  }

  // ------------------------------------------------------------------
  // 2. Check if output was truncated
  // ------------------------------------------------------------------
  if (isRecord(result) && result["truncated"] === true) {
    warnings.push("Output was truncated — results may be incomplete");
  }

  // ------------------------------------------------------------------
  // 3. QC-specific result parsing
  // ------------------------------------------------------------------
  if (toolName === "skill_invoke") {
    const skillName = isRecord(result) ? String(result["skillName"] ?? "") : "";

    if (skillName.includes("qc")) {
      // Parse QC output for key metrics
      const stdout = isRecord(result) ? String(result["stdout"] ?? "") : "";
      const stderr = isRecord(result) ? String(result["stderr"] ?? "") : "";

      const combined = stdout + "\n" + stderr;

      // Extract UMI/cell metrics
      const umiMatch = combined.match(/(?:median|mean)\s*(?:UMI|umi)\s*(?:count)?[=:]\s*([\d,.]+)/i);
      if (umiMatch) {
        const umiCount = Number.parseFloat(umiMatch[1]!.replace(/,/g, ""));
        checks.push({
          name: "Median UMI Count",
          passed: umiCount >= SCRNA_QC_THRESHOLDS.minUmiCount,
          value: umiCount,
          threshold: SCRNA_QC_THRESHOLDS.minUmiCount,
          message:
            umiCount >= SCRNA_QC_THRESHOLDS.minUmiCount
              ? `Median UMI count ${umiCount} meets minimum threshold ${SCRNA_QC_THRESHOLDS.minUmiCount}`
              : `Median UMI count ${umiCount} is below minimum threshold ${SCRNA_QC_THRESHOLDS.minUmiCount}`,
        });
      }

      // Extract gene count
      const geneMatch = combined.match(/(?:median|mean)\s*(?:gene|genes)[=:]\s*([\d,.]+)/i);
      if (geneMatch) {
        const geneCount = Number.parseFloat(geneMatch[1]!.replace(/,/g, ""));
        checks.push({
          name: "Median Gene Count",
          passed:
            geneCount >= SCRNA_QC_THRESHOLDS.minGeneCount &&
            geneCount <= SCRNA_QC_THRESHOLDS.maxGeneCount,
          value: geneCount,
          threshold: `${SCRNA_QC_THRESHOLDS.minGeneCount}-${SCRNA_QC_THRESHOLDS.maxGeneCount}`,
          message:
            geneCount >= SCRNA_QC_THRESHOLDS.minGeneCount &&
            geneCount <= SCRNA_QC_THRESHOLDS.maxGeneCount
              ? `Median gene count ${geneCount} within acceptable range`
              : `Median gene count ${geneCount} outside acceptable range`,
        });
      }

      // Extract mitochondrial percentage
      const mitoMatch = combined.match(/(?:mito(?:chondrial)?\s*(?:fraction|percent|%))[=:]\s*([\d.]+)/i);
      if (mitoMatch) {
        const mitoPercent = Number.parseFloat(mitoMatch[1]!);
        checks.push({
          name: "Mitochondrial Fraction",
          passed: mitoPercent <= SCRNA_QC_THRESHOLDS.maxMitoPercent,
          value: mitoPercent,
          threshold: `${SCRNA_QC_THRESHOLDS.maxMitoPercent}%`,
          message:
            mitoPercent <= SCRNA_QC_THRESHOLDS.maxMitoPercent
              ? `Mitochondrial fraction ${mitoPercent}% within acceptable range`
              : `Mitochondrial fraction ${mitoPercent}% exceeds maximum ${SCRNA_QC_THRESHOLDS.maxMitoPercent}%`,
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // 4. Duration check
  // ------------------------------------------------------------------
  if (isRecord(result) && typeof result["duration"] === "number") {
    const durationMs = result["duration"] as number;
    if (durationMs > 300_000) {
      warnings.push(`Execution took ${(durationMs / 1000).toFixed(1)}s — consider optimization`);
    }
  }

  // ------------------------------------------------------------------
  // 5. On QC failure, auto-query knowledge base for remediation
  // ------------------------------------------------------------------
  const hasFailures = checks.some((c) => !c.passed);
  if (hasFailures && knowledgeBridge) {
    try {
      const failedChecks = checks.filter((c) => !c.passed);
      const question = `Quality control failed for ${toolName}. Failures: ${failedChecks.map((c) => `${c.name}: ${c.message}`).join("; ")}. What are the recommended troubleshooting steps?`;

      const kbResult = await knowledgeBridge.query({
        question,
        layers: ["vector", "wiki"],
        maxResults: 3,
      });

      knowledgeConsulted = true;
      knowledgeRecommendation = kbResult.synthesis;
    } catch {
      // Knowledge query failed silently — not critical
      knowledgeRecommendation = "Unable to consult knowledge base for remediation guidance.";
    }
  }

  const passed = checks.every((c) => c.passed) && exitCode === 0;

  return {
    passed,
    checks,
    warnings,
    summary: passed
      ? "All QC checks passed"
      : `QC failed: ${checks.filter((c) => !c.passed).map((c) => c.name).join(", ")}`,
    knowledgeConsulted,
    knowledgeRecommendation,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractExitCode(result: unknown): number | undefined {
  if (!isRecord(result)) return undefined;

  if (typeof result["exitCode"] === "number") return result["exitCode"];
  if (typeof result["exit_code"] === "number") return result["exit_code"];
  if (typeof result["code"] === "number") return result["code"];
  if (typeof result["status"] === "number") return result["status"];

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
