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
export { HvgSelectionSkill } from "./preprocess/hvg-selection.skill.js";
export { ScrnaPCASkill } from "./preprocess/scrna-pca.skill.js";
export { BatchCorrectionSkill } from "./preprocess/batch-correction.skill.js";

// ---------------------------------------------------------------------------
// P0 Skills — Embedding
// ---------------------------------------------------------------------------
export { UmapTsneSkill } from "./embed/umap-tsne.skill.js";

// ---------------------------------------------------------------------------
// P0 Skills — Clustering
// ---------------------------------------------------------------------------
export { ClusteringSkill } from "./cluster/clustering.skill.js";

// ---------------------------------------------------------------------------
// P0 Skills — Annotation
// ---------------------------------------------------------------------------
export { CellAnnotationSkill } from "./annotate/cell-annotation.skill.js";

// ---------------------------------------------------------------------------
// P0 Skills — Analysis
// ---------------------------------------------------------------------------
export { MarkerDetectionSkill } from "./analysis/marker-detection.skill.js";
export { DiffExpressionSkill } from "./analysis/diff-expression.skill.js";
export { FunctionalEnrichmentSkill } from "./analysis/functional-enrichment.skill.js";
