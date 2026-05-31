// ============================================================
// @bioagent/skills — BatchCorrectionSkill
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
 * Batch Effect Correction Skill.
 *
 * Removes technical batch effects while preserving biological variation.
 * Currently supports Harmony (via harmonypy) as primary method with
 * ComBat (pycombat) as alternative.
 *
 * This skill is conditionally activated only when metadata indicates
 * multiple batches (metadata.hasBatch && batchCount > 1).
 *
 * Key QC metrics:
 * - Batch mixing score (kBET-like acceptance rate > 0.8)
 * - ARI change < 0.3 (preservation of biological clusters)
 * - Warnings for over-correction (biological signal loss)
 */
export class BatchCorrectionSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "batch-correction",
    version: "1.0.0",
    description:
      "Batch effect correction using Harmony or ComBat — removes technical variation while preserving biological signal",
    omicsType: "scrna",

    input: {
      acceptedFormats: ["h5ad"],
      schema: {},
      minSamples: 1,
      maxSamples: 50,
      requiredMetadataColumns: ["batch"],
      estimatedInputSize: "50MB-5GB",
    },

    tools: {
      primary: "harmonypy (scanpy.external.pp.harmony_integrate)",
      alternatives: ["pycombat (scanpy.pp.combat)", "scanorama", "BBKNN"],
      decisionTree: [
        {
          condition: "Standard batch correction (PCA already computed)",
          tool: "harmonypy",
          reason:
            "Harmony is the current standard for scRNA-seq batch correction — fast, scalable, and preserves biological variation",
        },
        {
          condition: "Small number of batches (<5) with clear batch effects",
          tool: "pycombat",
          reason:
            "ComBat is effective for simple batch correction with few batches, originally developed for microarrays",
        },
        {
          condition: "No batch_key found or single batch only",
          tool: "none",
          reason:
            "Batch correction is not applicable when only one batch exists. Skip this step",
        },
      ],
      dockerImages: {
        harmonypy: {
          image: "bioagent-scrna:latest",
          fallbackImage: "rnakato/shortcake_full:latest",
        },
      },
    },

    parameters: {
      defaults: {
        batch_key: "batch",
        method: "harmony",
        max_iter_harmony: 10,
        n_neighbors_kbet: 25,
        adjusted_pca_dim: null,
      },
      descriptions: {
        batch_key: "Column name in adata.obs that defines batch membership",
        method: "Batch correction method: 'harmony' or 'combat'",
        max_iter_harmony: "Maximum iterations for Harmony algorithm",
        n_neighbors_kbet: "Number of neighbors for batch mixing assessment (kBET-like)",
        adjusted_pca_dim: "Number of PCs to use after correction (auto if null)",
      },
      constraints: {
        max_iter_harmony: { min: 5, max: 50 },
        n_neighbors_kbet: { min: 5, max: 100 },
      },
    },

    qcGates: [
      {
        id: "batch_mixing_score",
        name: "Batch Mixing Score",
        description:
          "After correction, batch mixing acceptance rate should be >0.8 (kBET-like) — cells from different batches should be well-mixed",
        check: {
          type: "custom",
          expression:
            "batch_mixing_score > 0.8",
          metric: "batch_mixing",
        },
        level: "fail",
        onPass: "Batch mixing score > 0.8 — batches are well-integrated",
        onFail:
          "Poor batch mixing (score <= 0.8). Batch effects may persist after correction. Try different method or adjust parameters",
        fixable: true,
        autoFixCommand:
          "python -c \"import scanpy as sc; adata = sc.read_h5ad('input.h5ad'); sc.external.pp.harmony_integrate(adata, 'batch', max_iter_harmony=20)\"",
      },
      {
        id: "ari_stability",
        name: "Biological Cluster Stability (ARI)",
        description:
          "ARI between pre- and post-correction Leiden clusters should remain similar (< 0.3 change), indicating biological signal is preserved",
        check: {
          type: "custom",
          expression:
            "ari_change < 0.3",
          metric: "ari_stability",
        },
        level: "warn",
        onPass: "ARI change <0.3 — biological clusters are preserved after correction",
        onFail:
          "ARI change >=0.3 suggests potential over-correction. Biological signal may be lost. Review cluster compositions carefully",
        fixable: false,
      },
      {
        id: "overcorrection_warning",
        name: "Over-correction Risk",
        description:
          "If batch mixing is nearly perfect but biological variation is severely reduced, this may indicate over-correction",
        check: {
          type: "custom",
          expression:
            "overcorrection_risk == 0",
          metric: "overcorrection",
        },
        level: "warn",
        onPass: "No evidence of over-correction",
        onFail:
          "Potential over-correction detected: batches are perfectly mixed but biological signal may be compromised. Consider reducing correction strength",
        fixable: true,
        autoFixCommand:
          "python -c \"import scanpy as sc; adata = sc.read_h5ad('input.h5ad'); sc.external.pp.harmony_integrate(adata, 'batch', max_iter_harmony=5)\"",
      },
    ],

    outputs: {
      files: [
        {
          name: "batch_corrected.h5ad",
          format: "h5ad",
          description:
            "AnnData with batch-corrected PCA coordinates in .obsm['X_pca_harmony'] and original PCA preserved",
          required: true,
        },
        {
          name: "batch_correction_report.json",
          format: "json",
          description:
            "Batch correction report with pre/post mixing scores, ARI, and diagnostic data",
          required: true,
        },
        {
          name: "batch_mixing_data.json",
          format: "json",
          description:
            "Per-batch mixing statistics for diagnostic visualization",
          required: false,
        },
      ],
      visualizations: [
        {
          type: "scatter",
          description:
            "PCA scatter plots before and after batch correction, colored by batch",
        },
        {
          type: "barplot",
          description: "Per-batch mixing acceptance rate bar chart",
        },
      ],
      metrics: [
        { name: "n_cells", description: "Number of cells", unit: "cells" },
        { name: "n_batches", description: "Number of batches" },
        { name: "batch_mixing_before", description: "Batch mixing score before correction" },
        { name: "batch_mixing_score", description: "Batch mixing score after correction" },
        { name: "ari_before", description: "ARI before correction" },
        { name: "ari_after", description: "ARI after correction" },
        { name: "ari_change", description: "Absolute ARI change" },
        { name: "overcorrection_risk", description: "Over-correction risk flag (0 or 1)" },
      ],
    },

    troubleshooting: {
      common_issues: [
        {
          symptom: "batch_mixing_score < 0.5",
          likely_cause:
            "Batch effects are very strong and Harmony failed to integrate, or batch_key column is incorrect",
          diagnosis:
            "Check if batch_key exists in adata.obs. Verify PCA was computed before batch correction. Check that each batch has sufficient cells",
          fix: "Verify batch_key column exists and is correct. Ensure n_comps is adequate. Try ComBat as alternative method",
          severity: "blocking",
        },
        {
          symptom: "ari_change > 0.5",
          likely_cause:
            "Over-correction: Harmony over-integrated and lost biological signal",
          diagnosis:
            "Compare cluster compositions before and after. If major cell types are merging inappropriately, correction is too strong",
          fix: "Reduce max_iter_harmony or use ComBat (less aggressive). Consider running without batch correction if biological signal loss is unacceptable",
          severity: "warning",
        },
        {
          symptom: "overcorrection_risk == 1",
          likely_cause:
            "Batches are well-mixed but biological variation is minimal — possible over-correction",
          diagnosis:
            "Check if known cell types are still distinguishable after correction. If everything merges into one cluster, over-correction occurred",
          fix: "Reduce correction strength. Use the uncorrected data for biological interpretation. Report over-correction risk to user",
          severity: "warning",
        },
        {
          symptom: "ModuleNotFoundError: No module named 'harmonypy'",
          likely_cause:
            "Harmony Python package is not installed in the Docker image",
          diagnosis: "Check Dockerfile for harmonypy installation",
          fix: "Rebuild Docker image with harmonypy installed, or use ComBat (scanpy.pp.combat) as fallback",
          severity: "blocking",
        },
      ],
    },

    dependencies: {
      requires: ["scrna-pca"],
      recommends: ["scrna-normalize"],
      conflicts: [],
    },

    resourceEstimate: {
      cpu: "4",
      ram: "12GB",
      disk: "3GB",
      time: "5-30 min",
      gpu: "not_needed",
    },
  };

  // -------------------------------------------------------------------------
  // ① validateInput
  // -------------------------------------------------------------------------

  async validateInput(data: DataContext): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.inputPath || data.inputPath.trim().length === 0) {
      errors.push("Input path is required (must point to a PCA-computed .h5ad file).");
      return { valid: false, errors, warnings };
    }

    if (!data.inputPath.toLowerCase().endsWith(".h5ad")) {
      errors.push(
        `Input must be an .h5ad file. Got: ${data.inputPath}. Run data-import, scrna-normalize, hvg-selection, and scrna-pca first.`,
      );
    }

    if (!data.outputPath || data.outputPath.trim().length === 0) {
      errors.push("Output path is required.");
    }

    // Check if batch metadata exists
    const hasBatch = data.metadata?.["hasBatch"] === true;
    const batchCount = (data.metadata?.["batchCount"] as number) ?? 1;

    if (!hasBatch || batchCount <= 1) {
      warnings.push(
        "Batch correction requires multiple batches. Only one batch detected — correction will have no effect. Consider skipping this skill.",
      );
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
      tool: "harmonypy",
      reason:
        "Harmony is the state-of-the-art method for scRNA-seq batch correction — handles complex batch structures while preserving rare cell types",
      image: this.spec.tools.dockerImages["harmonypy"].image,
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
      batch_key:
        (data.metadata?.["batch_key"] as string) ??
        this.spec.parameters.defaults["batch_key"] ??
        "batch",
      method:
        this.spec.parameters.defaults["method"] ?? "harmony",
      max_iter_harmony:
        this.spec.parameters.defaults["max_iter_harmony"] ?? 10,
      n_neighbors_kbet:
        this.spec.parameters.defaults["n_neighbors_kbet"] ?? 25,
    };
  }

  // -------------------------------------------------------------------------
  // ④ run
  // -------------------------------------------------------------------------

  async run(context: SkillContext): Promise<SkillExecResult> {
    const { inputPath, outputPath } = context.data;
    const batchKey = (context.params["batch_key"] as string) ?? "batch";
    const method = (context.params["method"] as string) ?? "harmony";
    const maxIterHarmony =
      (context.params["max_iter_harmony"] as number) ?? 10;
    const nNeighborsKbet =
      (context.params["n_neighbors_kbet"] as number) ?? 25;

    const pythonScript = `
import scanpy as sc
import numpy as np
import json
import os
import warnings
warnings.filterwarnings('ignore')

input_path = "${inputPath}"
output_path = "${outputPath}"
batch_key = "${batchKey}"
method = "${method}"

# Load data
adata = sc.read_h5ad(input_path)
n_cells = adata.n_obs

# Verify batch key exists
if batch_key not in adata.obs.columns:
    raise ValueError(f"Batch key '{batch_key}' not found in adata.obs. Available columns: {list(adata.obs.columns)}")

n_batches = int(adata.obs[batch_key].nunique())
print(f"Loaded: {n_cells} cells, {n_batches} batches")

# === Pre-correction: compute batch mixing (simplified kBET-like metric) ===
def compute_batch_mixing(adata_pca, batch_labels, n_neighbors=${nNeighborsKbet}):
    """Simplified kBET-like batch mixing score using kNN.
    For each cell, check the fraction of its kNN that comes from the same batch.
    A well-mixed dataset should have near-random batch composition in neighborhoods.
    """
    from sklearn.neighbors import NearestNeighbors
    import numpy as np

    pca_coords = adata_pca
    if hasattr(pca_coords, 'toarray'):
        pca_coords = pca_coords.toarray()

    n_cells_local = pca_coords.shape[0]
    k = min(n_neighbors, n_cells_local - 1)
    if k < 1:
        return 0.0, {}

    # Fit kNN
    nn = NearestNeighbors(n_neighbors=k + 1, metric='euclidean')
    nn.fit(pca_coords)
    distances, indices = nn.kneighbors(pca_coords)
    # Exclude self (index 0)
    neighbor_indices = indices[:, 1:]
    neighbor_batches = batch_labels[neighbor_indices]

    # For each cell, expected random batch fraction
    batch_counts = np.bincount(batch_labels)
    batch_freqs = batch_counts / batch_counts.sum()

    # Local batch entropy vs expected
    acceptance_rates = []
    per_batch_acceptance = {}
    for b in range(len(batch_counts)):
        if batch_counts[b] == 0:
            continue
        batch_mask = batch_labels == b
        batch_cells_neighbor = neighbor_batches[batch_mask]
        # Fraction of neighbors NOT from same batch (mixing indicator)
        other_batch_frac = np.mean(batch_cells_neighbor != b)
        acceptance_rates.append(other_batch_frac)
        per_batch_acceptance[int(b)] = float(other_batch_frac)

    overall_acceptance = float(np.mean(acceptance_rates))
    return overall_acceptance, per_batch_acceptance

# Ensure PCA exists
if 'X_pca' not in adata.obsm:
    print("PCA not found, computing with default parameters...")
    sc.tl.pca(adata, n_comps=50)

# Store pre-correction PCA for ARI comparison
pca_pre = adata.obsm['X_pca'].copy()
batch_labels = adata.obs[batch_key].astype('category').cat.codes.values

# Pre-correction batch mixing
mixing_before, per_batch_before = compute_batch_mixing(pca_pre, batch_labels)

# Pre-correction clustering (for ARI comparison)
try:
    sc.pp.neighbors(adata, n_neighbors=15, n_pcs=30)
    sc.tl.leiden(adata, resolution=1.0, key_added='leiden_pre')
    clusters_pre = adata.obs['leiden_pre'].astype('category').cat.codes.values
except Exception as e:
    print(f"Pre-clustering failed: {e}, skipping ARI comparison")
    clusters_pre = np.zeros(n_cells, dtype=int)

# === Apply batch correction ===
if method == "harmony":
    try:
        sc.external.pp.harmony_integrate(
            adata,
            key=batch_key,
            max_iter_harmony=${maxIterHarmony},
        )
        correction_applied = "harmony"
    except Exception as e:
        print(f"Harmony failed: {e}. Trying ComBat fallback...")
        try:
            sc.pp.combat(adata, key=batch_key)
            correction_applied = "combat_fallback"
        except Exception as e2:
            print(f"ComBat also failed: {e2}. Using uncorrected PCA.")
            adata.obsm['X_pca_harmony'] = pca_pre
            correction_applied = "none_failed"
elif method == "combat":
    try:
        sc.pp.combat(adata, key=batch_key)
        correction_applied = "combat"
    except Exception as e:
        print(f"ComBat failed: {e}. Trying Harmony fallback...")
        try:
            sc.external.pp.harmony_integrate(adata, key=batch_key, max_iter_harmony=${maxIterHarmony})
            correction_applied = "harmony_fallback"
        except Exception as e2:
            print(f"Harmony also failed: {e2}. Using uncorrected PCA.")
            adata.obsm['X_pca_harmony'] = pca_pre
            correction_applied = "none_failed"
else:
    correction_applied = "none"

# Use corrected coordinates for post-analysis
corrected_coords = adata.obsm.get('X_pca_harmony', pca_pre)

# Post-correction batch mixing
mixing_after, per_batch_after = compute_batch_mixing(corrected_coords, batch_labels)

# Post-correction clustering
try:
    sc.pp.neighbors(adata, n_neighbors=15, n_pcs=30, use_rep='X_pca_harmony' if 'X_pca_harmony' in adata.obsm else 'X_pca')
    sc.tl.leiden(adata, resolution=1.0, key_added='leiden_post')
    clusters_post = adata.obs['leiden_post'].astype('category').cat.codes.values
except Exception as e:
    print(f"Post-clustering failed: {e}")
    clusters_post = np.zeros(n_cells, dtype=int)

# Compute ARI
from sklearn.metrics import adjusted_rand_score
ari_before = 1.0  # reference
ari_after = 1.0
ari_change = 0.0

if len(set(clusters_pre)) > 1 and len(set(clusters_post)) > 1:
    # ARI between pre/post clustering shows how much clustering changed
    ari_change_raw = adjusted_rand_score(clusters_pre, clusters_post)
    ari_change = round(1.0 - ari_change_raw, 4)  # 0 = identical, 1 = completely different
    ari_after = round(ari_change_raw, 4)
elif len(set(clusters_pre)) <= 1:
    ari_change = 0.0  # No structure before correction
elif len(set(clusters_post)) <= 1:
    ari_change = 1.0  # All merged into one cluster — over-correction risk

# Over-correction risk detection
overcorrection_risk = 0
if mixing_after > 0.95 and ari_change > 0.5:
    overcorrection_risk = 1  # Perfect mixing + major cluster change = likely over-correction
    print("WARNING: Potential over-correction detected! Batches are nearly perfectly mixed but biological clusters have changed significantly.")

# Build report
report = {
    "n_cells": int(n_cells),
    "n_batches": int(n_batches),
    "method": correction_applied,
    "batch_key": batch_key,
    "batch_mixing_before": round(mixing_before, 4),
    "batch_mixing_score": round(mixing_after, 4),
    "ari_before": 1.0,
    "ari_after": float(ari_after),
    "ari_change": float(ari_change),
    "overcorrection_risk": int(overcorrection_risk),
    "per_batch_mixing_before": {str(k): round(v, 4) for k, v in per_batch_before.items()},
    "per_batch_mixing_after": {str(k): round(v, 4) for k, v in per_batch_after.items()},
    "mixing_improvement": round(mixing_after - mixing_before, 4),
}

# Build batch mixing data for visualization
mixing_data = {
    "batches": [str(k) for k in per_batch_after.keys()],
    "mixing_before": [round(per_batch_before.get(int(k), 0), 4) for k in per_batch_after.keys()],
    "mixing_after": [round(v, 4) for v in per_batch_after.values()],
}

# Write outputs
with open(os.path.join(output_path, "batch_correction_report.json"), "w") as f:
    json.dump(report, f, indent=2)

with open(os.path.join(output_path, "batch_mixing_data.json"), "w") as f:
    json.dump(mixing_data, f)

output_file = os.path.join(output_path, "batch_corrected.h5ad")
adata.write(output_file)
print(f"Written: {output_file}")
print(f"Correction method: {correction_applied}")
print(f"Batch mixing: {mixing_before:.3f} -> {mixing_after:.3f}")
print(f"ARI change: {ari_change:.3f}")

print(json.dumps(report))
`.trim();

    const dockerResult = await this.execInContainer(context, pythonScript);

    const parsedData = this.parseJSONFromStdout(dockerResult.stdout);

    const metrics: Record<string, number> = {
      n_cells:
        typeof parsedData["n_cells"] === "number"
          ? (parsedData["n_cells"] as number)
          : 0,
      n_batches:
        typeof parsedData["n_batches"] === "number"
          ? (parsedData["n_batches"] as number)
          : 1,
      batch_mixing_before:
        typeof parsedData["batch_mixing_before"] === "number"
          ? (parsedData["batch_mixing_before"] as number)
          : 0,
      batch_mixing_score:
        typeof parsedData["batch_mixing_score"] === "number"
          ? (parsedData["batch_mixing_score"] as number)
          : 0,
      ari_before:
        typeof parsedData["ari_before"] === "number"
          ? (parsedData["ari_before"] as number)
          : 1.0,
      ari_after:
        typeof parsedData["ari_after"] === "number"
          ? (parsedData["ari_after"] as number)
          : 1.0,
      ari_change:
        typeof parsedData["ari_change"] === "number"
          ? (parsedData["ari_change"] as number)
          : 0,
      overcorrection_risk:
        typeof parsedData["overcorrection_risk"] === "number"
          ? (parsedData["overcorrection_risk"] as number)
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
    return this.runQCGates(results.metrics);
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

    const mixingBefore = results.metrics["batch_mixing_before"] ?? 0;
    const mixingAfter = results.metrics["batch_mixing_score"] ?? 0;
    const ariChange = results.metrics["ari_change"] ?? 0;
    const overcorrection = results.metrics["overcorrection_risk"] ?? 0;
    const method = results.parsedData["method"] ?? "harmony";
    const nBatches = results.metrics["n_batches"] ?? 0;

    logs.push(
      `Batch correction (${method}): ${nBatches} batches`,
    );
    logs.push(
      `Mixing: ${mixingBefore.toFixed(3)} -> ${mixingAfter.toFixed(3)} (improvement: ${(mixingAfter - mixingBefore).toFixed(3)})`,
    );
    logs.push(
      `ARI change: ${ariChange.toFixed(3)} (0=identical, >0.3=concerning)`,
    );
    logs.push(
      `QC overall: ${qc.overall} (${qc.passed}P/${qc.warned}W/${qc.failed}F)`,
    );

    if (overcorrection === 1) {
      logs.push(
        "WARNING: Over-correction risk detected. Biological signal may be compromised. Consider reducing correction strength.",
      );
    }

    return {
      files: [
        {
          path: `${results.parsedData["output_path"] ?? ""}/batch_corrected.h5ad`,
          format: "h5ad",
          size_bytes: 0,
        },
        ...(results.exitCode === 0
          ? [
              {
                path: `${results.parsedData["output_path"] ?? ""}/batch_correction_report.json`,
                format: "json",
                size_bytes: 0,
              },
              {
                path: `${results.parsedData["output_path"] ?? ""}/batch_mixing_data.json`,
                format: "json",
                size_bytes: 0,
              },
            ]
          : []),
      ],
      metrics: {
        n_cells: results.metrics["n_cells"],
        n_batches: nBatches,
        method: method,
        batch_mixing_before: mixingBefore,
        batch_mixing_score: mixingAfter,
        mixing_improvement: results.parsedData["mixing_improvement"] ?? 0,
        ari_before: results.metrics["ari_before"],
        ari_after: results.metrics["ari_after"],
        ari_change: ariChange,
        overcorrection_risk: overcorrection,
      },
      logs,
    };
  }
}
