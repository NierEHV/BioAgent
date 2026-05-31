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
} from "./base-skill.types";

// ---------------------------------------------------------------------------
// BaseSkill
// ---------------------------------------------------------------------------
export { BaseSkill } from "./base-skill";

// ---------------------------------------------------------------------------
// SkillRegistry
// ---------------------------------------------------------------------------
export { SkillRegistry } from "./skill-registry";
export type { SkillValidationResult } from "./skill-registry";

// ---------------------------------------------------------------------------
// SkillExecutor
// ---------------------------------------------------------------------------
export { SkillExecutor } from "./skill-executor";
export type { ResourceCheckResult } from "./skill-executor";

// ---------------------------------------------------------------------------
// P0 Skills — I/O
// ---------------------------------------------------------------------------
export { DataImportSkill } from "./io/data-import.skill";

// ---------------------------------------------------------------------------
// P0 Skills — QC
// ---------------------------------------------------------------------------
export { ScrnaQCSkill } from "./qc/scrna-qc.skill";
export { DoubletDetectionSkill } from "./qc/doublet-detection.skill";

// ---------------------------------------------------------------------------
// P0 Skills — Preprocess
// ---------------------------------------------------------------------------
export { ScrnaNormalizeSkill } from "./preprocess/scrna-normalize.skill";
export { HvgSelectionSkill } from "./preprocess/hvg-selection.skill";
export { ScrnaPCASkill } from "./preprocess/scrna-pca.skill";
export { BatchCorrectionSkill } from "./preprocess/batch-correction.skill";

// ---------------------------------------------------------------------------
// P0 Skills — Embedding
// ---------------------------------------------------------------------------
export { UmapTsneSkill } from "./embed/umap-tsne.skill";

// ---------------------------------------------------------------------------
// P0 Skills — Clustering
// ---------------------------------------------------------------------------
export { ClusteringSkill } from "./cluster/clustering.skill";

// ---------------------------------------------------------------------------
// P0 Skills — Annotation
// ---------------------------------------------------------------------------
export { CellAnnotationSkill } from "./annotate/cell-annotation.skill";

// ---------------------------------------------------------------------------
// P0 Skills — Analysis
// ---------------------------------------------------------------------------
export { MarkerDetectionSkill } from "./analysis/marker-detection.skill";
export { DiffExpressionSkill } from "./analysis/diff-expression.skill";
export { FunctionalEnrichmentSkill } from "./analysis/functional-enrichment.skill";
export { TrajectorySkill } from "./analysis/trajectory.skill";
export { CellCommunicationSkill } from "./analysis/cell-communication.skill";

// ---------------------------------------------------------------------------
// P0 Skills — Network
// ---------------------------------------------------------------------------
export { GRNSkill } from "./network/grn.skill";

// ---------------------------------------------------------------------------
// P0 Skills — Report
// ---------------------------------------------------------------------------
export { ReportGeneratorSkill } from "./report/report-generator.skill";

// ---------------------------------------------------------------------------
// Skill Loader
// ---------------------------------------------------------------------------
export { SkillLoader } from "./skill-loader";
export type { SkillLoaderOptions } from "./skill-loader";
