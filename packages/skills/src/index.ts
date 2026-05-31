// ============================================================
// @bioagent/skills — Public API
// ============================================================

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------
export type {
  SkillSpec,
  SkillContext,
  SkillResult,
  SkillOutput,
  SkillOutputFile,
  SkillExecResult,
  QCReport,
  QCGate,
  QCGateResult,
  ValidationResult,
  ToolChoice,
  DataContext,
  JSONSchema,
  TroubleshootingIssue,
} from "./base-skill.types.js";

// ---------------------------------------------------------------------------
// BaseSkill
// ---------------------------------------------------------------------------
export { BaseSkill } from "./base-skill.js";

// ---------------------------------------------------------------------------
// SkillRegistry
// ---------------------------------------------------------------------------
export { SkillRegistry } from "./skill-registry.js";
export type { SkillValidationResult } from "./skill-registry.js";

// ---------------------------------------------------------------------------
// SkillExecutor
// ---------------------------------------------------------------------------
export { SkillExecutor } from "./skill-executor.js";
export type { ResourceCheckResult } from "./skill-executor.js";

// ---------------------------------------------------------------------------
// P0 Skills — I/O
// ---------------------------------------------------------------------------
export { DataImportSkill } from "./io/data-import.skill.js";

// ---------------------------------------------------------------------------
// P0 Skills — QC
// ---------------------------------------------------------------------------
export { ScrnaQCSkill } from "./qc/scrna-qc.skill.js";
export { DoubletDetectionSkill } from "./qc/doublet-detection.skill.js";

// ---------------------------------------------------------------------------
// P0 Skills — Preprocess
// ---------------------------------------------------------------------------
export { ScrnaNormalizeSkill } from "./preprocess/scrna-normalize.skill.js";
