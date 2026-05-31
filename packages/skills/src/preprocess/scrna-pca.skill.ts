// ============================================================
// @bioagent/skills — ScrnaPCASkill
// ============================================================

import { BaseSkill } from "../base-skill";
import type {
  SkillSpec,
  SkillContext,
  SkillExecResult,
  QCReport,
  SkillOutput,
  ValidationResult,
  ToolChoice,
  DataContext,
} from "../base-skill.types";
import type { ResourceReport } from "@bioagent/executor";

/**
 * scRNA-seq PCA Dimensionality Reduction Skill.
 *
 * Performs PCA on the HVG-selected expression matrix to reduce dimensionality
 * prior to neighborhood graph construction and UMAP/tSNE embedding.
 *
 * Key features:
 * - SVD-based PCA with arpack solver (default: 50 PCs)
 * - Optional randomized SVD for large datasets
 * - Elbow plot diagnostics for optimal PC selection
 * - Variance explained monitoring
 *
 * QC gates check that the top PCs explain sufficient variance (>80% in first 30 PCs)
 * and that no single PC dominates excessively.
 */
export class ScrnaPCASkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "scrna-pca",
    version: "1.0.0",
    description:
      "scRNA-seq PCA dimensionality reduction with automated elbow diagnostics and variance explained tracking",
    omicsType: "scrna",

    input: {
      acceptedFormats: ["h5ad"],
      schema: {},
      minSamples: 1,
      maxSamples: 20,
      estimatedInputSize: "50MB-2GB",
    },

    tools: {
      primary: "scanpy.tl.pca(svd_solver=arpack)",
      alternatives: [
        "scanpy.tl.pca(svd_solver=randomized)",
        "scanpy.tl.pca(svd_solver=auto)",
      ],
      decisionTree: [
        {
          condition: "Standard dataset (< 50k cells)",
          tool: "scanpy.tl.pca(svd_solver=arpack)",
          reason:
            "arpack provides exact SVD with high numerical precision for small to medium datasets",
        },
        {
          condition: "Large dataset (> 50k cells)",
          tool: "scanpy.tl.pca(svd_solver=randomized)",
          reason:
            "Randomized SVD is faster and more memory-efficient for large datasets with acceptable precision trade-off",
        },
        {
          condition: "Unknown dataset size (auto-select)",
          tool: "scanpy.tl.pca(svd_solver=auto)",
          reason:
            "Auto solver selects optimal method based on data matrix dimensions",
        },
      ],
      dockerImages: {
        scanpy: {
          image: "bioagent-scrna:latest",
          fallbackImage: "rnakato/shortcake_full:latest",
        },
      },
    },

    parameters: {
      defaults: {
        n_comps: 50,
        svd_solver: "arpack",
        zero_center: true,
        use_highly_variable: true,
        random_state: 42,
      },
      descriptions: {
        n_comps: "Number of principal components to compute",
        svd_solver: "SVD solver: 'arpack' (exact), 'randomized' (fast), 'auto' (adaptive)",
        zero_center: "Whether to zero-center the data before PCA",
        use_highly_variable: "Only use HVGs for PCA (recommended for scRNA-seq)",
        random_state: "Random seed for reproducibility",
      },
      constraints: {
        n_comps: { min: 10, max: 200 },
      },
    },

    qcGates: [
      {
        id: "variance_explained_30",
        name: "Top 30 PCs Variance Explained",
        description:
          "First 30 PCs should explain at least 80% of total variance, indicating strong signal structure",
        check: {
          type: "threshold",
          expression:
            "var_explained_30 > 80",
          metric: "var30",
        },
        level: "fail",
        onPass: "Top 30 PCs capture >80% variance — strong signal structure",
        onFail:
          "Top 30 PCs explain <80% variance. Data may be noisy or n_comps insufficient. Consider checking HVG selection or data quality",
        fixable: false,
      },
      {
        id: "pc1_dominance",
        name: "PC1 Dominance Check",
        description:
          "PC1 should not explain an excessive fraction of variance (indicates strong batch/technical effect)",
        check: {
          type: "threshold",
          expression:
            "pc1_variance_pct < 50",
          metric: "pc1_dominance",
        },
        level: "warn",
        onPass: "PC1 explains reasonable variance fraction — no single dimension dominates",
        onFail:
          "PC1 explains >50% variance, indicating a strong dominant effect (likely batch, library size, or MT%). Verify upstream normalization and QC",
        fixable: false,
      },
      {
        id: "elbow_detected",
        name: "Elbow Point Detection",
        description: "An elbow point should be detectable in the variance explained curve",
        check: {
          type: "custom",
          expression:
            "elbow_pc >= 2 && elbow_pc <= 50",
          metric: "elbow",
        },
        level: "warn",
        onPass: "Elbow point detected in variance explained curve — dimensionality is adequate",
        onFail:
          "No clear elbow detected. May suggest insufficient n_comps or highly continuous data structure. Consider increasing n_comps",
        fixable: true,
        autoFixCommand:
          "python -c \"import scanpy as sc; adata = sc.read_h5ad('input.h5ad'); sc.tl.pca(adata, n_comps=100)\"",
      },
    ],

    outputs: {
      files: [
        {
          name: "pca_result.h5ad",
          format: "h5ad",
          description:
            "AnnData with PCA coordinates in .obsm['X_pca'] and variance ratios in .uns['pca']",
          required: true,
        },
        {
          name: "pca_report.json",
          format: "json",
          description: "PCA variance explained report and elbow data",
          required: true,
        },
        {
          name: "elbow_plot_data.json",
          format: "json",
          description: "Variance explained per PC for elbow plot generation",
          required: false,
        },
      ],
      visualizations: [
        {
          type: "scatter",
          description: "PCA scatter plot (PC1 vs PC2) colored by optional metadata",
        },
        {
          type: "barplot",
          description: "Elbow plot of variance explained per PC",
        },
      ],
      metrics: [
        { name: "n_comps", description: "Number of PCs computed" },
        { name: "n_cells", description: "Number of cells", unit: "cells" },
        { name: "n_genes_used", description: "Number of genes used for PCA", unit: "genes" },
        { name: "var_explained_10", description: "Cumulative variance explained by top 10 PCs", unit: "%" },
        { name: "var_explained_30", description: "Cumulative variance explained by top 30 PCs", unit: "%" },
        { name: "var_explained_all", description: "Cumulative variance explained by all PCs", unit: "%" },
        { name: "pc1_variance_pct", description: "Variance explained by PC1 alone", unit: "%" },
        { name: "elbow_pc", description: "Estimated elbow point (PC index)" },
        { name: "svd_solver", description: "SVD solver used" },
      ],
    },

    troubleshooting: {
      common_issues: [
        {
          symptom: "var_explained_30 < 50%",
          likely_cause:
            "Data is very noisy or contains many low-quality cells. HVG selection may also be too liberal",
          diagnosis:
            "Check upstream QC metrics. Verify HVG selection used appropriate parameters",
          fix: "Re-run HVG selection with stricter parameters (n_top_genes=2000). Check QC filtering is adequate",
          severity: "warning",
        },
        {
          symptom: "pc1_variance_pct > 70%",
          likely_cause:
            "Dominant batch effect or unnormalized library size driving PC1",
          diagnosis:
            "Color PCA plot by total_counts and batch. If strongly correlated, normalization/batch correction needed",
          fix: "Run batch-correction skill if multiple batches exist. Verify normalization was performed correctly",
          severity: "blocking",
        },
        {
          symptom: "elbow_pc not detected",
          likely_cause:
            "n_comps too low, or data has smooth eigenvalue decay (common in very heterogeneous samples)",
          diagnosis:
            "Plot cumulative variance explained curve. If smooth decay, increase n_comps",
          fix: "Increase n_comps to 100 and re-run. Data may require more dimensions to capture biological variation",
          severity: "warning",
        },
        {
          symptom: "ArpackError or convergence failure",
          likely_cause:
            "arpack SVD solver fails to converge on this dataset (rare, typically with very sparse matrices)",
          diagnosis:
            "Check if zero_center=True and matrix is not all-zero. May need randomized solver",
          fix: "Switch to svd_solver='randomized' and re-run",
          severity: "blocking",
        },
      ],
    },

    dependencies: {
      requires: ["hvg-selection"],
      recommends: ["batch-correction", "umap-tsne"],
      conflicts: [],
    },

    resourceEstimate: {
      cpu: "4",
      ram: "8GB",
      disk: "2GB",
      time: "2-10 min",
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
      errors.push("Input path is required (must point to an HVG-selected .h5ad file).");
      return { valid: false, errors, warnings };
    }

    if (!data.inputPath.toLowerCase().endsWith(".h5ad")) {
      errors.push(
        `Input must be an .h5ad file. Got: ${data.inputPath}. Run data-import, scrna-normalize, and hvg-selection first.`,
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
      tool: "scanpy.tl.pca(svd_solver=arpack)",
      reason:
        "ARPACK SVD solver provides exact PCA with high numerical precision — recommended for standard scRNA-seq datasets",
      image: this.spec.tools.dockerImages["scanpy"].image,
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
      n_comps: this.spec.parameters.defaults["n_comps"] ?? 50,
      svd_solver: this.spec.parameters.defaults["svd_solver"] ?? "arpack",
      zero_center: this.spec.parameters.defaults["zero_center"] ?? true,
      use_highly_variable:
        this.spec.parameters.defaults["use_highly_variable"] ?? true,
      random_state: this.spec.parameters.defaults["random_state"] ?? 42,
    };
  }

  // -------------------------------------------------------------------------
  // ④ run
  // -------------------------------------------------------------------------

  async run(context: SkillContext): Promise<SkillExecResult> {
    const { inputPath, outputPath } = context.data;
    const nComps = (context.params["n_comps"] as number) ?? 50;
    const svdSolver = (context.params["svd_solver"] as string) ?? "arpack";
    const zeroCenter = (context.params["zero_center"] as boolean) ?? true;
    const useHighlyVariable =
      (context.params["use_highly_variable"] as boolean) ?? true;
    const randomState = (context.params["random_state"] as number) ?? 42;

    const pythonScript = `
import scanpy as sc
import numpy as np
import json
import os
import warnings
warnings.filterwarnings('ignore')

input_path = "${inputPath}"
output_path = "${outputPath}"

# Load data
adata = sc.read_h5ad(input_path)
n_cells = adata.n_obs

# Count genes used
if ${useHighlyVariable === true ? "True" : "False"} and 'highly_variable' in adata.var.columns:
    n_genes_used = int(adata.var['highly_variable'].sum())
    if n_genes_used == 0:
        print("WARNING: No HVGs found in adata.var['highly_variable']. Using all genes.")
        n_genes_used = adata.n_vars
else:
    n_genes_used = adata.n_vars

print(f"Running PCA: {n_cells} cells, {n_genes_used} genes, {${nComps}} PCs")

# Run PCA
try:
    sc.tl.pca(
        adata,
        n_comps=${nComps},
        svd_solver="${svdSolver}",
        zero_center=${zeroCenter === true ? "True" : "False"},
        use_highly_variable=${useHighlyVariable === true ? "True" : "False"},
        random_state=${randomState},
    )
except Exception as e:
    # Fallback to randomized SVD if arpack fails
    if "${svdSolver}" == "arpack":
        print(f"ARPACK failed ({e}), falling back to randomized SVD")
        sc.tl.pca(
            adata,
            n_comps=${nComps},
            svd_solver="randomized",
            zero_center=${zeroCenter === true ? "True" : "False"},
            use_highly_variable=${useHighlyVariable === true ? "True" : "False"},
            random_state=${randomState},
        )
        svd_solver_used = "randomized"
    else:
        raise

svd_solver_used = "${svdSolver}"

# Extract variance ratios
variance_ratios = adata.uns['pca']['variance_ratio']
cumulative_variance = np.cumsum(variance_ratios) * 100  # in percent

n_actual_comps = len(variance_ratios)

# Cumulative variances at key points
var_explained_10 = float(cumulative_variance[min(9, n_actual_comps - 1)]) if n_actual_comps >= 10 else float(cumulative_variance[-1])
var_explained_30 = float(cumulative_variance[min(29, n_actual_comps - 1)]) if n_actual_comps >= 30 else float(cumulative_variance[-1])
var_explained_all = float(cumulative_variance[-1])

# PC1 variance
pc1_variance_pct = round(float(variance_ratios[0] * 100), 2) if n_actual_comps > 0 else 0

# Elbow detection: find point of maximum curvature in cumulative variance curve
# Using the "kneedle" algorithm simplified:
# For each point i, compute the distance from the line connecting first and last points
def find_elbow_pc(cum_var):
    if len(cum_var) < 3:
        return 1
    n = len(cum_var)
    # Normalize to [0, 1]
    x = np.arange(n)
    y = cum_var
    # Line from first to last
    x_line = np.array([x[0], x[-1]])
    y_line = np.array([y[0], y[-1]])
    # Distance from each point to the line
    distances = np.abs(
        (y_line[1] - y_line[0]) * (x - x_line[0]) -
        (x_line[1] - x_line[0]) * (y - y_line[0])
    ) / np.sqrt((y_line[1] - y_line[0])**2 + (x_line[1] - x_line[0])**2)
    # Find index of maximum distance (elbow point)
    elbow_idx = int(np.argmax(distances))
    return elbow_idx + 1  # 1-indexed PC

# For elbow detection, use the first min(50, n_actual_comps) PCs
n_for_elbow = min(50, n_actual_comps)
elbow_pc = find_elbow_pc(cumulative_variance[:n_for_elbow])

# Build elbow plot data
elbow_data = {
    "pcs": list(range(1, n_actual_comps + 1)),
    "variance_ratio": [float(v * 100) for v in variance_ratios],
    "cumulative_variance": [float(v) for v in cumulative_variance],
    "elbow_pc": int(elbow_pc),
}

# Build report
report = {
    "n_comps": int(n_actual_comps),
    "n_cells": int(n_cells),
    "n_genes_used": int(n_genes_used),
    "var_explained_10": round(var_explained_10, 2),
    "var_explained_30": round(var_explained_30, 2),
    "var_explained_all": round(var_explained_all, 2),
    "pc1_variance_pct": float(pc1_variance_pct),
    "elbow_pc": int(elbow_pc),
    "svd_solver": svd_solver_used,
    "top5_variances": [round(float(v * 100), 2) for v in variance_ratios[:5].tolist()],
}

# Write outputs
with open(os.path.join(output_path, "pca_report.json"), "w") as f:
    json.dump(report, f, indent=2)

with open(os.path.join(output_path, "elbow_plot_data.json"), "w") as f:
    json.dump(elbow_data, f)

output_file = os.path.join(output_path, "pca_result.h5ad")
adata.write(output_file)
print(f"Written: {output_file}")
print(f"Variance explained (top 10): {var_explained_10:.1f}%")
print(f"Variance explained (top 30): {var_explained_30:.1f}%")
print(f"Elbow PC: {elbow_pc}")
print(f"PC1 variance: {pc1_variance_pct:.1f}%")

print(json.dumps(report))
`.trim();

    const dockerResult = await this.execInContainer(context, pythonScript);

    const parsedData = this.parseJSONFromStdout(dockerResult.stdout);

    const metrics: Record<string, number> = {
      n_comps:
        typeof parsedData["n_comps"] === "number"
          ? (parsedData["n_comps"] as number)
          : 0,
      n_cells:
        typeof parsedData["n_cells"] === "number"
          ? (parsedData["n_cells"] as number)
          : 0,
      n_genes_used:
        typeof parsedData["n_genes_used"] === "number"
          ? (parsedData["n_genes_used"] as number)
          : 0,
      var_explained_10:
        typeof parsedData["var_explained_10"] === "number"
          ? (parsedData["var_explained_10"] as number)
          : 0,
      var_explained_30:
        typeof parsedData["var_explained_30"] === "number"
          ? (parsedData["var_explained_30"] as number)
          : 0,
      var_explained_all:
        typeof parsedData["var_explained_all"] === "number"
          ? (parsedData["var_explained_all"] as number)
          : 0,
      pc1_variance_pct:
        typeof parsedData["pc1_variance_pct"] === "number"
          ? (parsedData["pc1_variance_pct"] as number)
          : 0,
      elbow_pc:
        typeof parsedData["elbow_pc"] === "number"
          ? (parsedData["elbow_pc"] as number)
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

    const nComps = results.metrics["n_comps"] ?? 0;
    const var30 = results.metrics["var_explained_30"] ?? 0;
    const varAll = results.metrics["var_explained_all"] ?? 0;
    const pc1Var = results.metrics["pc1_variance_pct"] ?? 0;
    const elbow = results.metrics["elbow_pc"] ?? 0;
    const solverUsed = results.parsedData["svd_solver"] ?? "arpack";

    logs.push(
      `PCA: ${nComps} PCs computed, ${var30}% variance in top 30 PCs, ${varAll}% total`,
    );
    logs.push(
      `PC1 explains ${pc1Var}% variance. Elbow at PC${elbow}. Solver: ${solverUsed}`,
    );
    logs.push(
      `QC overall: ${qc.overall} (${qc.passed}P/${qc.warned}W/${qc.failed}F)`,
    );

    if (pc1Var > 50) {
      logs.push(
        "WARNING: PC1 dominates variance. Consider batch correction or check normalization.",
      );
    }

    return {
      files: [
        {
          path: `${results.parsedData["output_path"] ?? ""}/pca_result.h5ad`,
          format: "h5ad",
          size_bytes: 0,
        },
        ...(results.exitCode === 0
          ? [
              {
                path: `${results.parsedData["output_path"] ?? ""}/pca_report.json`,
                format: "json",
                size_bytes: 0,
              },
              {
                path: `${results.parsedData["output_path"] ?? ""}/elbow_plot_data.json`,
                format: "json",
                size_bytes: 0,
              },
            ]
          : []),
      ],
      metrics: {
        n_comps: nComps,
        n_cells: results.metrics["n_cells"],
        n_genes_used: results.metrics["n_genes_used"],
        var_explained_10: results.metrics["var_explained_10"],
        var_explained_30: var30,
        var_explained_all: varAll,
        pc1_variance_pct: pc1Var,
        elbow_pc: elbow,
        svd_solver: solverUsed,
      },
      logs,
    };
  }
}
