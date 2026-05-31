// ============================================================
// @bioagent/skills — HvgSelectionSkill
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
 * Highly Variable Gene (HVG) Selection Skill.
 *
 * Identifies highly variable genes for downstream dimensionality reduction
 * and clustering. Uses either seurat_v3 or seurat flavor.
 *
 * Key parameters:
 * - n_top_genes: number of top variable genes to select (default 3000)
 * - flavor: 'seurat_v3' (default, expects raw counts) or 'seurat'
 * - batch_key: optional batch column for batch-aware HVG selection
 *
 * QC gates verify HVG count is in the expected range (2000-5000) and that
 * the mean-variance relationship follows the expected pattern.
 */
export class HvgSelectionSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "hvg-selection",
    version: "1.0.0",
    description:
      "Highly variable gene selection using scanpy.pp.highly_variable_genes — identifies informative genes for dimensionality reduction",
    omicsType: "scrna",

    input: {
      acceptedFormats: ["h5ad"],
      schema: {},
      minSamples: 1,
      maxSamples: 10,
      estimatedInputSize: "50MB-2GB",
    },

    tools: {
      primary: "scanpy.pp.highly_variable_genes",
      alternatives: [
        "scanpy.pp.highly_variable_genes(flavor=seurat)",
        "scanpy.experimental.pp.highly_variable_genes(flavor=seurat_v3_paper)",
      ],
      decisionTree: [
        {
          condition: "Standard scRNA-seq with raw counts (recommended)",
          tool: "scanpy.pp.highly_variable_genes(flavor=seurat_v3)",
          reason:
            "seurat_v3 flavor is the current standard — expects raw counts and uses variance-stabilizing transformation",
        },
        {
          condition: "Data already log-normalized",
          tool: "scanpy.pp.highly_variable_genes(flavor=seurat)",
          reason:
            "seurat flavor works with log-normalized data using mean-dispersion relationship",
        },
        {
          condition: "Multiple batches present (batch_key provided)",
          tool: "scanpy.pp.highly_variable_genes(flavor=seurat_v3, batch_key=batch)",
          reason:
            "Batch-aware HVG selection ensures genes are variable across batches, not driven by batch effects",
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
        n_top_genes: 3000,
        flavor: "seurat_v3",
        n_bins: 20,
        min_mean: 0.0125,
        max_mean: 3,
        min_disp: 0.5,
      },
      descriptions: {
        n_top_genes: "Number of highly variable genes to select",
        flavor: "HVG selection method: 'seurat_v3' (raw counts) or 'seurat' (log-normalized)",
        n_bins: "Number of bins for mean expression binning (seurat flavor)",
        min_mean: "Minimum mean expression cutoff",
        max_mean: "Maximum mean expression cutoff",
        min_disp: "Minimum dispersion cutoff",
      },
      constraints: {
        n_top_genes: { min: 500, max: 8000 },
        n_bins: { min: 5, max: 50 },
        min_mean: { min: 0.001, max: 1.0 },
        max_mean: { min: 1, max: 10 },
        min_disp: { min: 0.1, max: 2.0 },
      },
    },

    qcGates: [
      {
        id: "hvg_count_range",
        name: "HVG Count Range",
        description:
          "Number of HVGs should be between 2000 and 5000 for robust downstream analysis",
        check: {
          type: "range",
          expression: "n_hvgs >= 2000 && n_hvgs <= 5000",
          metric: "hvg_count",
        },
        level: "fail",
        onPass: "HVG count within optimal range (2000-5000)",
        onFail:
          "HVG count outside [2000, 5000] range. Too few HVGs reduces dimensionality resolution; too many introduces noise",
        fixable: true,
        autoFixCommand:
          "python -c \"import scanpy as sc; adata = sc.read_h5ad('input.h5ad'); sc.pp.highly_variable_genes(adata, n_top_genes=3000)\"",
      },
      {
        id: "mean_variance_relationship",
        name: "Mean-Variance Relationship",
        description:
          "Ensure the relationship between mean expression and dispersion follows expected pattern (positive correlation)",
        check: {
          type: "custom",
          expression:
            "mean_var_correlation > 0.3",
          metric: "mean_var_relationship",
        },
        level: "warn",
        onPass: "Mean-variance relationship is consistent with expected pattern",
        onFail:
          "Weak correlation between mean and variance suggests unusual data distribution. Check input data quality or consider different flavor",
        fixable: false,
      },
      {
        id: "hvg_pct_check",
        name: "HVG Percentage",
        description:
          "HVGs should represent 5-25% of all genes — ensures sufficient signal without over-filtering",
        check: {
          type: "range",
          expression: "hvg_pct >= 5 && hvg_pct <= 25",
          metric: "hvg_pct",
        },
        level: "warn",
        onPass: "HVG percentage within reasonable range",
        onFail:
          "HVG percentage outside 5-25% range. May indicate very low or very high gene variability in dataset",
        fixable: true,
        autoFixCommand:
          "python -c \"import scanpy as sc; adata = sc.read_h5ad('input.h5ad'); sc.pp.highly_variable_genes(adata, n_top_genes=3000)\"",
      },
    ],

    outputs: {
      files: [
        {
          name: "hvg_selected.h5ad",
          format: "h5ad",
          description:
            "AnnData with highly_variable and highly_variable_* columns in .var",
          required: true,
        },
        {
          name: "hvg_report.json",
          format: "json",
          description: "HVG selection statistics and QC report",
          required: true,
        },
        {
          name: "hvg_mean_dispersion.json",
          format: "json",
          description: "Mean vs dispersion data for diagnostic scatter plot",
          required: false,
        },
      ],
      visualizations: [
        {
          type: "scatter",
          description:
            "Mean expression vs dispersion scatter plot, colored by HVG selection",
        },
      ],
      metrics: [
        { name: "n_genes_total", description: "Total number of genes", unit: "genes" },
        { name: "n_hvgs", description: "Number of highly variable genes", unit: "genes" },
        { name: "hvg_pct", description: "Percentage of genes marked as HVG", unit: "%" },
        { name: "mean_var_correlation", description: "Correlation between mean expression and dispersion" },
        { name: "n_batches_considered", description: "Number of batches considered (1 if no batch_key)" },
      ],
    },

    troubleshooting: {
      common_issues: [
        {
          symptom: "n_hvgs < 500",
          likely_cause:
            "Data may be over-filtered or contain very few cells, reducing gene variability",
          diagnosis:
            "Check upstream QC filtering. Verify that input contains adequate cell diversity",
          fix: "Reduce n_top_genes or relax upstream QC filtering. Verify input data quality",
          severity: "blocking",
        },
        {
          symptom: "n_hvgs > 8000",
          likely_cause:
            "Dataset is very heterogeneous or n_top_genes was set too high",
          diagnosis: "Check if large n_top_genes is appropriate for dataset size",
          fix: "Reduce n_top_genes (recommend 2000-4000 for most datasets)",
          severity: "warning",
        },
        {
          symptom: "mean_var_correlation < 0.1",
          likely_cause:
            "Data may already be normalized or transformed before HVG selection",
          diagnosis:
            "seurat_v3 expects raw counts. If data is already log-normalized, switch to seurat flavor",
          fix: "Switch flavor to 'seurat' and re-run, or use raw counts as input",
          severity: "warning",
        },
        {
          symptom: "batch_key not found",
          likely_cause: "The specified batch column does not exist in adata.obs",
          diagnosis: "Check adata.obs.columns for available metadata columns",
          fix: "Verify batch_key name matches exactly (case-sensitive). Run data-import to add metadata",
          severity: "blocking",
        },
      ],
    },

    dependencies: {
      requires: ["scrna-normalize"],
      recommends: ["scrna-pca"],
      conflicts: [],
    },

    resourceEstimate: {
      cpu: "4",
      ram: "8GB",
      disk: "2GB",
      time: "2-5 min",
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
      errors.push("Input path is required (must point to a normalized .h5ad file).");
      return { valid: false, errors, warnings };
    }

    if (!data.inputPath.toLowerCase().endsWith(".h5ad")) {
      errors.push(
        `Input must be an .h5ad file. Got: ${data.inputPath}. Run data-import and scrna-normalize first.`,
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
      tool: "scanpy.pp.highly_variable_genes(flavor=seurat_v3)",
      reason:
        "seurat_v3 flavor is the gold standard for HVG selection — expects raw counts and applies variance-stabilizing transformation for robust gene selection",
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
      n_top_genes: this.spec.parameters.defaults["n_top_genes"] ?? 3000,
      flavor: this.spec.parameters.defaults["flavor"] ?? "seurat_v3",
      n_bins: this.spec.parameters.defaults["n_bins"] ?? 20,
      min_mean: this.spec.parameters.defaults["min_mean"] ?? 0.0125,
      max_mean: this.spec.parameters.defaults["max_mean"] ?? 3,
      min_disp: this.spec.parameters.defaults["min_disp"] ?? 0.5,
      batch_key: (data.metadata?.["batch_key"] as string) ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // ④ run
  // -------------------------------------------------------------------------

  async run(context: SkillContext): Promise<SkillExecResult> {
    const { inputPath, outputPath } = context.data;
    const nTopGenes = (context.params["n_top_genes"] as number) ?? 3000;
    const flavor = (context.params["flavor"] as string) ?? "seurat_v3";
    const nBins = (context.params["n_bins"] as number) ?? 20;
    const minMean = (context.params["min_mean"] as number) ?? 0.0125;
    const maxMean = (context.params["max_mean"] as number) ?? 3;
    const minDisp = (context.params["min_disp"] as number) ?? 0.5;
    const batchKey = context.params["batch_key"] as string | null | undefined;

    const batchKeyStr = batchKey ? `"${batchKey}"` : "None";

    const pythonScript = `
import scanpy as sc
import numpy as np
import json
import os

input_path = "${inputPath}"
output_path = "${outputPath}"

# Load data
adata = sc.read_h5ad(input_path)
n_genes_total = adata.n_vars
n_cells = adata.n_obs
n_batches_considered = 1

print(f"Loaded: {n_cells} cells, {n_genes_total} genes")

# Run HVG selection
# If raw counts available in adata.raw, use them for seurat_v3 (which expects counts)
use_raw_for_hvg = adata.raw is not None and "${flavor}" == "seurat_v3"

if use_raw_for_hvg:
    print("Using adata.raw for HVG selection (raw counts required by seurat_v3)")
    adata_raw = adata.raw.to_adata()

    hvg_kwargs = {
        "n_top_genes": ${nTopGenes},
        "flavor": "${flavor}",
        "n_bins": ${nBins},
        "min_mean": ${minMean},
        "max_mean": ${maxMean},
        "min_disp": ${minDisp},
    }
    if ${batchKeyStr} is not None:
        hvg_kwargs["batch_key"] = ${batchKeyStr}
        if ${batchKeyStr} in adata.obs.columns:
            n_batches_considered = int(adata.obs[${batchKeyStr}].nunique())

    sc.pp.highly_variable_genes(adata_raw, **hvg_kwargs)
    # Copy HVG annotations back
    adata.var['highly_variable'] = adata_raw.var['highly_variable']
    for col in ['means', 'dispersions', 'dispersions_norm', 'highly_variable_nbatches', 'highly_variable_intersection']:
        if col in adata_raw.var.columns:
            adata.var[col] = adata_raw.var[col]
else:
    hvg_kwargs = {
        "n_top_genes": ${nTopGenes},
        "flavor": "${flavor}",
        "n_bins": ${nBins},
        "min_mean": ${minMean},
        "max_mean": ${maxMean},
        "min_disp": ${minDisp},
    }
    if ${batchKeyStr} is not None:
        hvg_kwargs["batch_key"] = ${batchKeyStr}
        if ${batchKeyStr} in adata.obs.columns:
            n_batches_considered = int(adata.obs[${batchKeyStr}].nunique())

    sc.pp.highly_variable_genes(adata, **hvg_kwargs)

# Count HVGs
n_hvgs = int(adata.var['highly_variable'].sum())
hvg_pct = round(100 * n_hvgs / n_genes_total, 2) if n_genes_total > 0 else 0

# Compute mean-variance correlation
means = adata.var['means'].values if 'means' in adata.var.columns else np.zeros(n_genes_total)
dispersions = adata.var['dispersions'].values if 'dispersions' in adata.var.columns else np.zeros(n_genes_total)

# Remove NaN/Inf for correlation computation
valid_mask = np.isfinite(means) & np.isfinite(dispersions) & (means > 0) & (dispersions > 0)
mean_var_correlation = 0.0
if np.sum(valid_mask) > 10:
    mean_var_correlation = round(float(np.corrcoef(np.log1p(means[valid_mask]), np.log1p(dispersions[valid_mask]))[0, 1]), 4)

# Extract mean-dispersion data for scatter plot
hvgs_mask = adata.var['highly_variable'].values.astype(bool)
mean_dispersion_data = {
    "means": means[valid_mask].tolist(),
    "dispersions": dispersions[valid_mask].tolist(),
    "is_hvg": hvgs_mask[valid_mask].tolist(),
}

# Build report
report = {
    "n_cells": int(n_cells),
    "n_genes_total": int(n_genes_total),
    "n_hvgs": int(n_hvgs),
    "hvg_pct": float(hvg_pct),
    "flavor": "${flavor}",
    "n_top_genes": ${nTopGenes},
    "batch_key": ${batchKeyStr} if ${batchKeyStr} is not None else "None",
    "n_batches_considered": int(n_batches_considered),
    "mean_var_correlation": float(mean_var_correlation),
    "top_hvgs": list(adata.var_names[adata.var['highly_variable']][:20]) if n_hvgs > 0 else [],
}

# Write outputs
with open(os.path.join(output_path, "hvg_report.json"), "w") as f:
    json.dump(report, f, indent=2)

with open(os.path.join(output_path, "hvg_mean_dispersion.json"), "w") as f:
    json.dump(mean_dispersion_data, f)

output_file = os.path.join(output_path, "hvg_selected.h5ad")
adata.write(output_file)
print(f"Written: {output_file}")
print(f"HVGs selected: {n_hvgs}/{n_genes_total} ({hvg_pct}%)")
print(f"Mean-variance correlation: {mean_var_correlation}")

print(json.dumps(report))
`.trim();

    const dockerResult = await this.execInContainer(context, pythonScript);

    const parsedData = this.parseJSONFromStdout(dockerResult.stdout);

    const metrics: Record<string, number> = {
      n_genes_total:
        typeof parsedData["n_genes_total"] === "number"
          ? (parsedData["n_genes_total"] as number)
          : 0,
      n_hvgs:
        typeof parsedData["n_hvgs"] === "number"
          ? (parsedData["n_hvgs"] as number)
          : 0,
      hvg_pct:
        typeof parsedData["hvg_pct"] === "number"
          ? (parsedData["hvg_pct"] as number)
          : 0,
      mean_var_correlation:
        typeof parsedData["mean_var_correlation"] === "number"
          ? (parsedData["mean_var_correlation"] as number)
          : 0,
      n_batches_considered:
        typeof parsedData["n_batches_considered"] === "number"
          ? (parsedData["n_batches_considered"] as number)
          : 1,
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

    const total = results.metrics["n_genes_total"] ?? 0;
    const hvgs = results.metrics["n_hvgs"] ?? 0;
    const pct = results.metrics["hvg_pct"] ?? 0;
    const corr = results.metrics["mean_var_correlation"] ?? 0;

    logs.push(
      `HVG selection: ${hvgs}/${total} genes (${pct}%)`,
    );
    logs.push(`Mean-variance correlation: ${corr}`);
    logs.push(
      `QC overall: ${qc.overall} (${qc.passed}P/${qc.warned}W/${qc.failed}F)`,
    );

    if ((results.metrics["n_batches_considered"] ?? 1) > 1) {
      logs.push(
        `Batch-aware HVG: ${results.metrics["n_batches_considered"]} batches considered`,
      );
    }

    return {
      files: [
        {
          path: `${results.parsedData["output_path"] ?? ""}/hvg_selected.h5ad`,
          format: "h5ad",
          size_bytes: 0,
        },
        ...(results.exitCode === 0
          ? [
              {
                path: `${results.parsedData["output_path"] ?? ""}/hvg_report.json`,
                format: "json",
                size_bytes: 0,
              },
              {
                path: `${results.parsedData["output_path"] ?? ""}/hvg_mean_dispersion.json`,
                format: "json",
                size_bytes: 0,
              },
            ]
          : []),
      ],
      metrics: {
        n_genes_total: total,
        n_hvgs: hvgs,
        hvg_pct: pct,
        mean_var_correlation: corr,
        n_batches_considered: results.metrics["n_batches_considered"],
        flavor: results.parsedData["flavor"] ?? "seurat_v3",
        top_hvgs: results.parsedData["top_hvgs"] ?? [],
      },
      logs,
    };
  }
}
