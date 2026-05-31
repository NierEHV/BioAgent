// ============================================================
// @bioagent/skills — CellAnnotationSkill
// ============================================================
//
// *** MANDATORY USER CONFIRMATION NODE ***
// This skill is the key decision point in the pipeline. All downstream
// biological interpretation depends on correct cell type annotation.
// The system MUST present results to the user for review before proceeding.
// ============================================================

import { BaseSkill } from "../base-skill.js";
import type {
  SkillSpec,
  SkillContext,
  SkillExecResult,
  QCReport,
  SkillOutput,
  ValidationResult,
  ToolChoice,
  DataContext,
} from "../base-skill.types.js";
import type { ResourceReport } from "@bioagent/executor";

/**
 * Cell Type Annotation Skill.
 *
 * The most critical skill in the scRNA-seq pipeline. Performs automated
 * cell type annotation using CellTypist with majority voting, falls back
 * to marker-based manual annotation when CellTypist is unavailable.
 *
 * Key features:
 * - Primary: CellTypist with Immune_All_Low.pkl model (majority voting)
 * - Fallback: Marker-based annotation using known canonical markers
 * - Confidence scoring per cell and per cluster
 * - Low-confidence cluster flagging (suggests subclustering)
 * - Marker expression specificity verification
 *
 * *** DESIGN NOTE ***
 * This skill is designated as a mandatory user confirmation node.
 * Results MUST be reviewed by the user before downstream analysis proceeds.
 * The system should present:
 *   1. Per-cluster predicted cell types with confidence scores
 *   2. Marker gene expression verification
 *   3. Suggestions for low-confidence clusters
 */
export class CellAnnotationSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "cell-annotation",
    version: "1.0.0",
    description:
      "Automated cell type annotation using CellTypist with marker-based fallback — the critical decision node requiring user confirmation",
    omicsType: "scrna",

    input: {
      acceptedFormats: ["h5ad"],
      schema: {},
      minSamples: 1,
      maxSamples: 20,
      estimatedInputSize: "50MB-3GB",
    },

    tools: {
      primary: "celltypist.annotate",
      alternatives: [
        "marker-based manual annotation",
        "SingleR",
        "scPred",
        "Garnett",
      ],
      decisionTree: [
        {
          condition: "CellTypist available and immune-focused data (recommended)",
          tool: "celltypist.annotate(model='Immune_All_Low.pkl', majority_voting=True)",
          reason:
            "CellTypist with majority voting provides robust, reference-based cell type annotation with confidence scores",
        },
        {
          condition: "CellTypist not available or non-immune data",
          tool: "marker-based manual annotation",
          reason:
            "Marker-based annotation using canonical marker gene sets provides reliable annotation when reference-based tools are unavailable",
        },
        {
          condition: "Multi-tissue or organism-specific data",
          tool: "SingleR + custom reference",
          reason:
            "SingleR with a tissue-matched reference provides better annotation for non-standard datasets",
        },
      ],
      dockerImages: {
        celltypist: {
          image: "bioagent-scrna:latest",
          fallbackImage: "rnakato/shortcake_full:latest",
        },
      },
    },

    parameters: {
      defaults: {
        model: "Immune_All_Low.pkl",
        majority_voting: true,
        min_confidence: 0.5,
        annotation_method: "celltypist",
        n_top_markers: 5,
        subcluster_threshold: 0.5,
      },
      descriptions: {
        model: "CellTypist model file (default: 'Immune_All_Low.pkl' for human immune cells)",
        majority_voting: "Use majority voting to refine per-cell predictions by cluster consensus",
        min_confidence: "Minimum confidence score for reliable annotation (cells below are flagged)",
        annotation_method: "Annotation method: 'celltypist' or 'marker_based'",
        n_top_markers: "Number of top marker genes per cluster to report",
        subcluster_threshold: "Confidence threshold below which clusters are flagged for subclustering",
      },
      constraints: {
        min_confidence: { min: 0.1, max: 0.9 },
        n_top_markers: { min: 3, max: 20 },
        subcluster_threshold: { min: 0.2, max: 0.8 },
      },
    },

    qcGates: [
      {
        id: "annotation_coverage",
        name: "Annotation Coverage",
        description:
          "At least 80% of cells should have confident annotations (confidence >= 0.5)",
        check: {
          type: "threshold",
          expression: "confident_pct >= 80",
          metric: "coverage",
        },
        level: "fail",
        onPass: ">=80% cells confidently annotated — sufficient coverage for downstream analysis",
        onFail:
          "<80% cells confidently annotated. Many cells have uncertain cell types. Consider using a different reference model or adjusting confidence threshold",
        fixable: true,
        autoFixCommand:
          "python -c \"import celltypist; celltypist.annotate(adata, model='Immune_All_Low.pkl', majority_voting=True)\"",
      },
      {
        id: "marker_specificity",
        name: "Marker Gene Specificity",
        description:
          "At least half of the annotated cell types should have their canonical markers expressed specifically in the predicted cluster",
        check: {
          type: "threshold",
          expression: "marker_specificity_pct >= 50",
          metric: "marker_specificity",
        },
        level: "warn",
        onPass: ">50% of annotations supported by specific marker expression — annotation is biologically consistent",
        onFail:
          "<50% marker specificity suggests annotation may be inaccurate. Review cell types manually. The reference model may not match this dataset",
        fixable: false,
      },
      {
        id: "low_confidence_clusters",
        name: "Low-Confidence Cluster Detection",
        description:
          "No more than 30% of clusters should have mean confidence < 0.5 — too many uncertain clusters indicates annotation model mismatch",
        check: {
          type: "threshold",
          expression: "low_confidence_cluster_pct < 30",
          metric: "low_confidence",
        },
        level: "warn",
        onPass: "Few low-confidence clusters — annotations are reliable",
        onFail:
          ">30% of clusters have low confidence. These clusters may represent novel cell types or mixed populations. Consider subclustering these clusters",
        fixable: true,
        autoFixCommand:
          "python -c \"# Suggest subclustering for low-confidence clusters\nprint('Subcluster suggestion: re-cluster low-confidence cells with higher resolution')\"",
      },
      {
        id: "majority_voting_sanity",
        name: "Majority Voting Consistency",
        description:
          "After majority voting, per-cluster purity should be >70% (dominant cell type should represent >70% of cluster)",
        check: {
          type: "threshold",
          expression: "cluster_purity_mean > 70",
          metric: "majority_purity",
        },
        level: "fail",
        onPass: "Clusters have high cell type purity after majority voting — clear annotation",
        onFail:
          "Low cluster purity suggests mixed populations within clusters. Consider increasing clustering resolution or reviewing marker expression",
        fixable: false,
      },
    ],

    outputs: {
      files: [
        {
          name: "cell_annotated.h5ad",
          format: "h5ad",
          description:
            "AnnData with cell type labels in .obs['cell_type'], confidence scores in .obs['annotation_confidence'], and majority_voting result",
          required: true,
        },
        {
          name: "cell_annotation_report.json",
          format: "json",
          description:
            "Comprehensive annotation report with per-cluster cell types, confidences, marker support, and low-confidence flags",
          required: true,
        },
        {
          name: "cell_type_proportions.json",
          format: "json",
          description:
            "Cell type proportions for pie/bar chart visualization",
          required: false,
        },
        {
          name: "marker_validation.json",
          format: "json",
          description:
            "Per-cluster marker expression data for validation heatmap/dotplot",
          required: false,
        },
      ],
      visualizations: [
        {
          type: "scatter",
          description: "UMAP colored by predicted cell type",
        },
        {
          type: "barplot",
          description: "Cell type composition bar chart",
        },
        {
          type: "dotplot",
          description: "Marker gene expression dotplot for annotation validation",
        },
      ],
      metrics: [
        { name: "n_cells", description: "Number of cells", unit: "cells" },
        { name: "n_clusters", description: "Number of clusters" },
        { name: "n_cell_types", description: "Number of unique cell types identified" },
        { name: "confident_pct", description: "Percentage of cells with confidence >= 0.5", unit: "%" },
        { name: "mean_confidence", description: "Mean annotation confidence across all cells" },
        { name: "marker_specificity_pct", description: "Percentage of cell types with validated marker specificity", unit: "%" },
        { name: "low_confidence_cluster_pct", description: "Percentage of clusters with mean confidence < 0.5", unit: "%" },
        { name: "cluster_purity_mean", description: "Mean cluster purity after majority voting", unit: "%" },
        { name: "n_low_confidence_clusters", description: "Number of clusters flagged for subclustering" },
      ],
    },

    troubleshooting: {
      common_issues: [
        {
          symptom: "confident_pct < 50%",
          likely_cause:
            "CellTypist model does not match the dataset's cell types or species. Model may expect immune cells but data contains non-immune cells",
          diagnosis:
            "Check the predicted labels — if many cells map to 'Unknown' or low-confidence categories, model mismatch is likely",
          fix: "Try a different CellTypist model (e.g., 'Immune_All_High.pkl' or tissue-specific). Consider marker-based annotation as fallback",
          severity: "blocking",
        },
        {
          symptom: "marker_specificity_pct < 30%",
          likely_cause:
            "Annotated cell types are not supported by canonical marker expression. Annotation may be incorrect",
          diagnosis:
            "For each predicted cell type, check expression of known markers. If markers are absent, annotation is likely wrong",
          fix: "Use marker-based annotation instead. Manually curate cell type labels based on known marker gene expression",
          severity: "blocking",
        },
        {
          symptom: "n_low_confidence_clusters > 5",
          likely_cause:
            "Several clusters have uncertain annotations, possibly representing rare or novel cell types not in the reference",
          diagnosis:
            "Examine low-confidence clusters on UMAP. Check if they form distinct populations with unique marker expression",
          fix: "Subcluster these populations with higher resolution. Consider manual annotation based on differential expression",
          severity: "warning",
        },
        {
          symptom: "ModuleNotFoundError: No module named 'celltypist'",
          likely_cause:
            "CellTypist is not installed in the Docker container",
          diagnosis:
            "Check Docker image contents. CellTypist requires installation of the celltypist Python package",
          fix: "Fall back to marker-based annotation. Rebuild Docker image with: pip install celltypist",
          severity: "blocking",
        },
      ],
    },

    dependencies: {
      requires: ["clustering"],
      recommends: ["marker-detection", "diff-expression"],
      conflicts: [],
    },

    resourceEstimate: {
      cpu: "4",
      ram: "12GB",
      disk: "3GB",
      time: "5-20 min",
      gpu: "optional",
    },
  };

  // -------------------------------------------------------------------------
  // ① validateInput
  // -------------------------------------------------------------------------

  async validateInput(data: DataContext): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.inputPath || data.inputPath.trim().length === 0) {
      errors.push("Input path is required (must point to a clustered .h5ad file).");
      return { valid: false, errors, warnings };
    }

    if (!data.inputPath.toLowerCase().endsWith(".h5ad")) {
      errors.push(
        `Input must be an .h5ad file. Got: ${data.inputPath}. Run upstream skills (data-import through clustering) first.`,
      );
    }

    if (!data.outputPath || data.outputPath.trim().length === 0) {
      errors.push("Output path is required.");
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // -------------------------------------------------------------------------
  // ② selectTool
  // -------------------------------------------------------------------------

  async selectTool(
    _data: DataContext,
    _resources: ResourceReport,
  ): Promise<ToolChoice> {
    return {
      tool: "celltypist.annotate",
      reason:
        "CellTypist is the state-of-the-art reference-based cell type annotation tool with majority voting for robust cluster-level annotation",
      image: this.spec.tools.dockerImages["celltypist"].image,
    };
  }

  // -------------------------------------------------------------------------
  // ③ configureParams
  // -------------------------------------------------------------------------

  async configureParams(
    data: DataContext,
    _tool: ToolChoice,
  ): Promise<Record<string, unknown>> {
    return {
      input_path: data.inputPath,
      output_path: data.outputPath,
      model: this.spec.parameters.defaults["model"] ?? "Immune_All_Low.pkl",
      majority_voting:
        this.spec.parameters.defaults["majority_voting"] ?? true,
      min_confidence: this.spec.parameters.defaults["min_confidence"] ?? 0.5,
      annotation_method:
        this.spec.parameters.defaults["annotation_method"] ?? "celltypist",
      n_top_markers: this.spec.parameters.defaults["n_top_markers"] ?? 5,
      subcluster_threshold:
        this.spec.parameters.defaults["subcluster_threshold"] ?? 0.5,
    };
  }

  // -------------------------------------------------------------------------
  // ④ run
  // -------------------------------------------------------------------------

  async run(context: SkillContext): Promise<SkillExecResult> {
    const { inputPath, outputPath } = context.data;
    const model = (context.params["model"] as string) ?? "Immune_All_Low.pkl";
    const majorityVoting =
      (context.params["majority_voting"] as boolean) ?? true;
    const minConfidence =
      (context.params["min_confidence"] as number) ?? 0.5;
    const annotationMethod =
      (context.params["annotation_method"] as string) ?? "celltypist";
    const nTopMarkers = (context.params["n_top_markers"] as number) ?? 5;
    const subclusterThreshold =
      (context.params["subcluster_threshold"] as number) ?? 0.5;

    const pythonScript = `
import scanpy as sc
import numpy as np
import pandas as pd
import json
import os
import warnings
warnings.filterwarnings('ignore')

input_path = "${inputPath}"
output_path = "${outputPath}"

# Load data
adata = sc.read_h5ad(input_path)
n_cells = adata.n_obs

# Ensure cluster labels exist
if 'leiden' not in adata.obs.columns:
    print("WARNING: Leiden clusters not found. Running clustering first...")
    if 'neighbors' not in adata.uns:
        use_rep = 'X_pca'
        if 'X_pca_harmony' in adata.obsm:
            use_rep = 'X_pca_harmony'
        sc.pp.neighbors(adata, n_neighbors=15, n_pcs=30, use_rep=use_rep)
    sc.tl.leiden(adata, resolution=1.0)

n_clusters = int(adata.obs['leiden'].nunique())
annotation_method_used = "${annotationMethod}"

# ======================================================================
# ANNOTATION APPROACH 1: CellTypist
# ======================================================================
celltypist_available = False
try:
    import celltypist
    from celltypist import models
    celltypist_available = True
except ImportError:
    print("CellTypist not available. Falling back to marker-based annotation.")

if celltypist_available and annotation_method_used == "celltypist":
    try:
        # Load model
        model_name = "${model}"
        print(f"Using CellTypist model: {model_name}")

        # Ensure raw counts are available for CellTypist
        if adata.raw is not None:
            adata_for_pred = adata.raw.to_adata()
        else:
            adata_for_pred = adata.copy()
            # Attempt to use counts layer
            if 'counts' in adata.layers:
                adata_for_pred.X = adata.layers['counts']

        # Run CellTypist
        predictions = celltypist.annotate(
            adata_for_pred,
            model=model_name,
            majority_voting=${majorityVoting === true ? "True" : "False"},
            min_prop=0.0,
        )

        # Extract predictions
        pred_df = predictions.predicted_labels

        # Map predictions to adata
        if 'majority_voting' in pred_df.columns:
            adata.obs['cell_type'] = pred_df['majority_voting'].values
            adata.obs['annotation_confidence'] = pred_df['conf_score'].values.astype(float)
            adata.obs['predicted_labels_before_mv'] = pred_df['predicted_labels'].values
        else:
            adata.obs['cell_type'] = pred_df['predicted_labels'].values
            adata.obs['annotation_confidence'] = pred_df['conf_score'].values.astype(float)

        print(f"CellTypist annotation complete. Unique types: {adata.obs['cell_type'].nunique()}")
        annotation_method_used = "celltypist"

    except Exception as e:
        print(f"CellTypist failed: {e}")
        print("Falling back to marker-based annotation.")
        celltypist_available = False

# ======================================================================
# ANNOTATION APPROACH 2: Marker-Based Manual Annotation
# ======================================================================
if not celltypist_available or annotation_method_used == "marker_based":
    print("Running marker-based annotation...")

    # Canonical marker gene sets for common human immune cell types
    canonical_markers = {
        "CD4+ T cell": ["CD3D", "CD3E", "CD4", "IL7R", "TCF7"],
        "CD8+ T cell": ["CD3D", "CD3E", "CD8A", "CD8B", "NKG7", "GZMK"],
        "NK cell": ["NKG7", "GNLY", "KLRD1", "KLRF1", "PRF1"],
        "B cell": ["CD19", "CD79A", "CD79B", "MS4A1", "PAX5", "BANK1"],
        "Monocyte/CD14+": ["CD14", "LYZ", "VCAN", "S100A8", "S100A9", "FCN1"],
        "Monocyte/CD16+": ["FCGR3A", "CDKN1C", "LST1", "AIF1"],
        "Dendritic cell": ["FCER1A", "CLEC10A", "CD1C", "CLEC9A", "XCR1"],
        "Plasmacytoid DC": ["LILRA4", "IRF7", "TCF4", "GZMB", "IL3RA"],
        "Plasma cell": ["MZB1", "SDC1", "JCHAIN", "IGHG1", "XBP1"],
        "Erythrocyte": ["HBB", "HBA1", "HBA2", "HBD", "ALAS2"],
        "Megakaryocyte/Platelet": ["PPBP", "PF4", "ITGA2B", "GP9", "GP1BA"],
        "Mast cell": ["KIT", "CPA3", "TPSAB1", "HDC", "MS4A2"],
        "Neutrophil": ["CSF3R", "FCGR3B", "CXCR2", "ELANE", "MPO"],
        "Hematopoietic stem cell": ["CD34", "SPINK2", "AVP", "CRHBP", "ACY3"],
    }

    # For each cluster, compute enrichment of canonical markers
    cluster_labels = adata.obs['leiden'].values
    unique_clusters = sorted(adata.obs['leiden'].unique())

    # Get expression matrix (use log-normalized .X or raw)
    if adata.raw is not None:
        expr_matrix = adata.raw[:, :].X
        gene_names = adata.raw.var_names
        if hasattr(expr_matrix, 'toarray'):
            expr_matrix = expr_matrix.toarray()
    else:
        expr_matrix = adata.X
        gene_names = adata.var_names
        if hasattr(expr_matrix, 'toarray'):
            expr_matrix = expr_matrix.toarray()

    gene_to_idx = {g: i for i, g in enumerate(gene_names)}

    # Score each cluster for each cell type
    cluster_cell_types = {}
    cluster_confidences = {}
    cell_annotations = ["Unknown"] * n_cells
    cell_confidences = [0.0] * n_cells

    for cluster in unique_clusters:
        cluster_mask = cluster_labels == cluster
        cluster_cells = np.where(cluster_mask)[0]

        type_scores = {}
        for cell_type, markers in canonical_markers.items():
            # Check which markers are present
            present_markers = [m for m in markers if m in gene_to_idx]
            if len(present_markers) < 1:
                type_scores[cell_type] = 0.0
                continue

            # Compute mean expression of markers in this cluster
            marker_indices = [gene_to_idx[m] for m in present_markers]
            cluster_expr = expr_matrix[cluster_cells][:, marker_indices]

            # Score: fraction of cells expressing each marker above background
            if hasattr(cluster_expr, 'toarray'):
                cluster_expr = cluster_expr.toarray() if hasattr(cluster_expr, 'toarray') else cluster_expr

            # Binary: expressed if > 0.5 after log-normalization (or > 0 for raw)
            expressed_pct_per_marker = np.mean(cluster_expr > 0, axis=0)
            mean_expr_per_marker = np.mean(cluster_expr, axis=0) if cluster_expr.size > 0 else np.array([0])

            # Combined score: average of fraction expressing * mean expression
            score = float(np.mean(expressed_pct_per_marker) * np.mean(mean_expr_per_marker + 1e-10) * 100)
            type_scores[cell_type] = score

        # Best matching cell type
        best_type = max(type_scores, key=type_scores.get)
        best_score = type_scores[best_type]

        # Normalize confidence to 0-1 range
        max_possible_score = 100.0  # theoretical max
        confidence = min(1.0, best_score / (max_possible_score * 0.3 + 1e-10))

        cluster_cell_types[str(cluster)] = best_type
        cluster_confidences[str(cluster)] = round(float(confidence), 4)

        # Assign to all cells in cluster
        for idx in cluster_cells:
            cell_annotations[idx] = best_type
            cell_confidences[idx] = float(confidence)

    adata.obs['cell_type'] = cell_annotations
    adata.obs['annotation_confidence'] = cell_confidences

    print(f"Marker-based annotation complete. Unique types: {len(set(cell_annotations))}")
    annotation_method_used = "marker_based"

# ======================================================================
# POST-ANNOTATION QC & STATISTICS
# ======================================================================

# Overall confidence stats
confidences = adata.obs['annotation_confidence'].values.astype(float)
mean_confidence = round(float(np.mean(confidences)), 4)
confident_cells = np.sum(confidences >= ${minConfidence})
confident_pct = round(100 * confident_cells / n_cells, 2)

# Per-cluster statistics
cell_types = adata.obs['cell_type']
cluster_labels = adata.obs['leiden']

per_cluster_stats = {}
low_confidence_clusters = []

for cluster in sorted(cluster_labels.unique()):
    mask = cluster_labels == cluster
    n_cluster = int(mask.sum())
    types_in_cluster = cell_types[mask]
    confs_in_cluster = confidences[mask]

    # Dominant type and purity
    type_counts = types_in_cluster.value_counts()
    dominant_type = type_counts.index[0]
    purity = round(100 * type_counts.iloc[0] / n_cluster, 2)
    mean_cluster_conf = round(float(np.mean(confs_in_cluster)), 4)
    median_cluster_conf = round(float(np.median(confs_in_cluster)), 4)

    # Low-confidence flag
    is_low_confidence = mean_cluster_conf < ${subclusterThreshold}

    cluster_info = {
        "cluster": str(cluster),
        "n_cells": n_cluster,
        "predicted_cell_type": str(dominant_type),
        "purity_pct": float(purity),
        "mean_confidence": float(mean_cluster_conf),
        "median_confidence": float(median_cluster_conf),
        "low_confidence": is_low_confidence,
        "type_composition": {str(k): int(v) for k, v in type_counts.items()},
    }

    per_cluster_stats[str(cluster)] = cluster_info

    if is_low_confidence:
        low_confidence_clusters.append({
            "cluster": str(cluster),
            "predicted_type": str(dominant_type),
            "confidence": float(mean_cluster_conf),
            "suggestion": "Consider subclustering this population with higher resolution or manual annotation",
        })

# ======================================================================
# MARKER SPECIFICITY VALIDATION
# ======================================================================

# For each cell type, check if canonical markers are specifically expressed
canonical_markers = {
    "CD4+ T cell": ["CD4", "IL7R", "TCF7"],
    "CD8+ T cell": ["CD8A", "CD8B", "NKG7"],
    "NK cell": ["NKG7", "GNLY", "KLRD1"],
    "B cell": ["CD79A", "MS4A1", "PAX5"],
    "Monocyte": ["CD14", "LYZ", "S100A8"],
    "Dendritic cell": ["FCER1A", "CLEC10A", "CD1C"],
    "Plasma cell": ["MZB1", "SDC1", "JCHAIN"],
}

# Get expression matrix
if adata.raw is not None:
    expr_for_markers = adata.raw[:, :].X
    gene_names_for_markers = list(adata.raw.var_names)
    if hasattr(expr_for_markers, 'toarray'):
        expr_for_markers = expr_for_markers.toarray()
else:
    expr_for_markers = adata.X
    gene_names_for_markers = list(adata.var_names)
    if hasattr(expr_for_markers, 'toarray'):
        expr_for_markers = expr_for_markers.toarray()

gene_idx_map = {g.upper(): i for i, g in enumerate(gene_names_for_markers)}

marker_validation = []
cell_types_found = adata.obs['cell_type'].unique()

for ct in cell_types_found:
    # Find matching canonical marker set (fuzzy match)
    matched_markers = []
    for known_ct, markers in canonical_markers.items():
        if known_ct.lower() in ct.lower() or ct.lower() in known_ct.lower():
            matched_markers = markers
            break

    if not matched_markers:
        # Generic markers based on common patterns
        if "t cell" in ct.lower():
            matched_markers = ["CD3D", "CD3E"]
        elif "b cell" in ct.lower():
            matched_markers = ["CD79A", "MS4A1"]
        elif "nk" in ct.lower():
            matched_markers = ["NKG7", "GNLY"]
        elif "monocyte" in ct.lower() or "macro" in ct.lower():
            matched_markers = ["CD14", "LYZ"]
        else:
            marker_validation.append({
                "cell_type": str(ct),
                "markers_checked": [],
                "markers_found": [],
                "specificity_valid": None,
                "note": "No canonical markers defined for this cell type",
            })
            continue

    # Check expression of each marker
    markers_found = []
    markers_not_found = []
    for m in matched_markers:
        if m.upper() in gene_idx_map:
            idx = gene_idx_map[m.upper()]
            # Check if expressed in this cell type
            ct_mask = (cell_types == ct).values
            marker_expr_in_ct = expr_for_markers[ct_mask, idx]
            # Check if expressed in other cell types
            other_mask = ~ct_mask
            marker_expr_in_other = expr_for_markers[other_mask, idx] if other_mask.sum() > 0 else np.array([0])

            mean_in_ct = float(np.mean(marker_expr_in_ct))
            mean_in_other = float(np.mean(marker_expr_in_other))
            specificity_ratio = mean_in_ct / (mean_in_other + 1e-10)

            markers_found.append({
                "gene": m,
                "mean_expr_in_type": round(mean_in_ct, 4),
                "mean_expr_other": round(mean_in_other, 4),
                "specificity_ratio": round(specificity_ratio, 2),
            })
        else:
            markers_not_found.append(m)

    is_specific = len(markers_found) > 0 and all(
        mf["specificity_ratio"] > 1.5 for mf in markers_found
    )

    marker_validation.append({
        "cell_type": str(ct),
        "markers_checked": matched_markers,
        "markers_results": markers_found,
        "markers_not_in_data": markers_not_found,
        "specificity_valid": is_specific,
    })

# Compute marker specificity percentage
valid_specificity = sum(
    1 for mv in marker_validation if mv["specificity_valid"] is True
)
marker_specificity_pct = round(
    100 * valid_specificity / len(marker_validation), 2
) if marker_validation else 0

# Cluster purity
cluster_purities = [
    info["purity_pct"] for info in per_cluster_stats.values()
]
cluster_purity_mean = round(float(np.mean(cluster_purities)), 2) if cluster_purities else 0

# Low-confidence cluster metrics
low_conf_cluster_pct = round(
    100 * len(low_confidence_clusters) / len(per_cluster_stats), 2
) if per_cluster_stats else 0

# Cell type proportions
type_proportions = cell_types.value_counts().to_dict()
type_proportions_pct = {
    str(k): round(100 * v / n_cells, 2)
    for k, v in type_proportions.items()
}

# ======================================================================
# TOP MARKERS PER CLUSTER (via differential expression)
# ======================================================================
top_markers_per_cluster = {}
try:
    # Use raw counts if available
    adata_for_de = adata.raw.to_adata() if adata.raw is not None else adata.copy()

    sc.tl.rank_genes_groups(
        adata_for_de,
        groupby='leiden',
        method='wilcoxon',
        n_genes=${nTopMarkers},
        key_added='rank_genes_cluster'
    )

    for cluster in sorted(cluster_labels.unique()):
        try:
            result = adata_for_de.uns['rank_genes_cluster']
            cluster_idx = list(result['names'].dtype.names).index(str(cluster))
            top_genes = [result['names'][cluster_idx][i] for i in range(${nTopMarkers})]
            top_scores = [float(result['scores'][cluster_idx][i]) for i in range(${nTopMarkers})]
            top_markers_per_cluster[str(cluster)] = {
                "genes": top_genes,
                "scores": top_scores,
            }
        except Exception:
            top_markers_per_cluster[str(cluster)] = {"genes": [], "scores": []}
except Exception as e:
    print(f"Marker gene ranking failed: {e}")

# ======================================================================
# BUILD REPORT
# ======================================================================
report = {
    "n_cells": int(n_cells),
    "n_clusters": int(n_clusters),
    "n_cell_types": int(len(cell_types_found)),
    "annotation_method": annotation_method_used,
    "confident_pct": float(confident_pct),
    "mean_confidence": float(mean_confidence),
    "min_confidence_threshold": ${minConfidence},
    "marker_specificity_pct": float(marker_specificity_pct),
    "low_confidence_cluster_pct": float(low_conf_cluster_pct),
    "cluster_purity_mean": float(cluster_purity_mean),
    "n_low_confidence_clusters": int(len(low_confidence_clusters)),
    "cell_type_proportions": type_proportions_pct,
    "clusters": per_cluster_stats,
    "low_confidence_clusters": low_confidence_clusters,
    "marker_validation": marker_validation,
    "top_markers_per_cluster": top_markers_per_cluster,
}

# Write outputs
with open(os.path.join(output_path, "cell_annotation_report.json"), "w") as f:
    json.dump(report, f, indent=2)

with open(os.path.join(output_path, "cell_type_proportions.json"), "w") as f:
    json.dump({
        "cell_types": list(type_proportions_pct.keys()),
        "proportions": list(type_proportions_pct.values()),
        "counts": {str(k): int(v) for k, v in type_proportions.items()},
    }, f)

with open(os.path.join(output_path, "marker_validation.json"), "w") as f:
    json.dump(marker_validation, f)

output_file = os.path.join(output_path, "cell_annotated.h5ad")
adata.write(output_file)
print(f"Written: {output_file}")
print(f"Annotation method: {annotation_method_used}")
print(f"Cell types found: {len(cell_types_found)}")
print(f"Confident cells: {confident_pct:.1f}% (mean confidence: {mean_confidence:.3f})")
print(f"Marker specificity: {marker_specificity_pct:.1f}%")
print(f"Low-confidence clusters: {len(low_confidence_clusters)}/{n_clusters} ({low_conf_cluster_pct:.1f}%)")

print(json.dumps(report))
`.trim();

    const dockerResult = await this.execInContainer(context, pythonScript);

    const parsedData = this.parseJSONFromStdout(dockerResult.stdout);

    const metrics: Record<string, number> = {
      n_cells:
        typeof parsedData["n_cells"] === "number"
          ? (parsedData["n_cells"] as number)
          : 0,
      n_clusters:
        typeof parsedData["n_clusters"] === "number"
          ? (parsedData["n_clusters"] as number)
          : 0,
      n_cell_types:
        typeof parsedData["n_cell_types"] === "number"
          ? (parsedData["n_cell_types"] as number)
          : 0,
      confident_pct:
        typeof parsedData["confident_pct"] === "number"
          ? (parsedData["confident_pct"] as number)
          : 0,
      mean_confidence:
        typeof parsedData["mean_confidence"] === "number"
          ? (parsedData["mean_confidence"] as number)
          : 0,
      marker_specificity_pct:
        typeof parsedData["marker_specificity_pct"] === "number"
          ? (parsedData["marker_specificity_pct"] as number)
          : 0,
      low_confidence_cluster_pct:
        typeof parsedData["low_confidence_cluster_pct"] === "number"
          ? (parsedData["low_confidence_cluster_pct"] as number)
          : 0,
      cluster_purity_mean:
        typeof parsedData["cluster_purity_mean"] === "number"
          ? (parsedData["cluster_purity_mean"] as number)
          : 0,
      n_low_confidence_clusters:
        typeof parsedData["n_low_confidence_clusters"] === "number"
          ? (parsedData["n_low_confidence_clusters"] as number)
          : 0,
    };

    return {
      exitCode: dockerResult.exitCode,
      stdout: dockerResult.stdout,
      stderr: dockerResult.stderr,
      parsedData,
      metrics,
    };
  }

  // -------------------------------------------------------------------------
  // ⑤ runQC
  // -------------------------------------------------------------------------

  async runQC(results: SkillExecResult): Promise<QCReport> {
    const report = this.runQCGates(results.metrics);

    // Add user confirmation reminder
    report.gates.push({
      id: "user_confirmation_required",
      name: "MANDATORY: User Confirmation Required",
      result: "warn",
      actualValue: "Pending user review",
      expectedValue: "User must confirm cell type annotations before proceeding",
      detail:
        "This is a mandatory user confirmation node per design specification. All downstream biological interpretation depends on correct cell type annotation. Please review: (1) Per-cluster predicted cell types, (2) Confidence scores, (3) Marker gene validation results, (4) Low-confidence cluster suggestions. Confirm or adjust annotations before proceeding.",
    });
    report.warned += 1;
    report.total += 1;

    if (report.overall === "pass") {
      report.overall = "warn"; // Always at least warn due to confirmation requirement
    }

    return report;
  }

  // -------------------------------------------------------------------------
  // ⑥ formatOutput
  // -------------------------------------------------------------------------

  async formatOutput(
    results: SkillExecResult,
    qc: QCReport,
  ): Promise<SkillOutput> {
    const logs: string[] = [];

    if (results.exitCode !== 0) {
      logs.push(`Python script exited with code ${results.exitCode}`);
    }
    if (results.stderr) {
      logs.push(`stderr: ${results.stderr.substring(0, 500)}`);
    }

    const method = results.parsedData["annotation_method"] ?? "unknown";
    const nCellTypes = results.metrics["n_cell_types"] ?? 0;
    const confidentPct = results.metrics["confident_pct"] ?? 0;
    const meanConf = results.metrics["mean_confidence"] ?? 0;
    const markerSpec = results.metrics["marker_specificity_pct"] ?? 0;
    const lowConfPct = results.metrics["low_confidence_cluster_pct"] ?? 0;
    const nLowConf = results.metrics["n_low_confidence_clusters"] ?? 0;
    const purity = results.metrics["cluster_purity_mean"] ?? 0;

    logs.push(
      "=== CELL ANNOTATION RESULTS ===",
    );
    logs.push(
      `Method: ${method}. ${nCellTypes} cell types identified.`,
    );
    logs.push(
      `Confidence: ${confidentPct}% cells with high confidence (mean: ${meanConf})`,
    );
    logs.push(
      `Marker specificity: ${markerSpec}% of cell types validated`,
    );
    logs.push(
      `Cluster purity (post majority-voting): ${purity}%`,
    );
    logs.push(
      `Low-confidence clusters: ${nLowConf} (${lowConfPct}%)`,
    );
    logs.push(
      `QC overall: ${qc.overall} (${qc.passed}P/${qc.warned}W/${qc.failed}F)`,
    );
    logs.push(
      "=========================================",
    );
    logs.push(
      "*** MANDATORY USER ACTION REQUIRED ***",
    );
    logs.push(
      "Please review cell type annotations before proceeding to downstream analysis.",
    );
    logs.push(
      "Check per-cluster predictions, marker validation, and low-confidence clusters.",
    );

    // Add low-confidence cluster details
    const lowConfClusters =
      results.parsedData["low_confidence_clusters"];
    if (Array.isArray(lowConfClusters) && lowConfClusters.length > 0) {
      logs.push("--- Low-confidence clusters requiring review ---");
      for (const lc of lowConfClusters) {
        logs.push(
          `  Cluster ${lc["cluster"]}: ${lc["predicted_type"]} (confidence: ${lc["confidence"]}) — ${lc["suggestion"]}`,
        );
      }
    }

    return {
      files: [
        {
          path: `${results.parsedData["output_path"] ?? ""}/cell_annotated.h5ad`,
          format: "h5ad",
          size_bytes: 0,
        },
        ...(results.exitCode === 0
          ? [
              {
                path: `${results.parsedData["output_path"] ?? ""}/cell_annotation_report.json`,
                format: "json",
                size_bytes: 0,
              },
              {
                path: `${results.parsedData["output_path"] ?? ""}/cell_type_proportions.json`,
                format: "json",
                size_bytes: 0,
              },
              {
                path: `${results.parsedData["output_path"] ?? ""}/marker_validation.json`,
                format: "json",
                size_bytes: 0,
              },
            ]
          : []),
      ],
      metrics: {
        n_cells: results.metrics["n_cells"],
        n_clusters: results.metrics["n_clusters"],
        n_cell_types: nCellTypes,
        annotation_method: method,
        confident_pct: confidentPct,
        mean_confidence: meanConf,
        marker_specificity_pct: markerSpec,
        low_confidence_cluster_pct: lowConfPct,
        cluster_purity_mean: purity,
        n_low_confidence_clusters: nLowConf,
        cell_type_proportions:
          results.parsedData["cell_type_proportions"] ?? {},
        requires_user_confirmation: true,
      },
      logs,
    };
  }
}
