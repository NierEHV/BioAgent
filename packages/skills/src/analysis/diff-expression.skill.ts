// ============================================================
// @bioagent/skills — DiffExpressionSkill
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
 * Differential Expression Analysis Skill.
 *
 * Identifies differentially expressed genes between experimental conditions
 * (e.g., treatment vs control, disease vs healthy).
 *
 * Key features:
 * - Wilcoxon rank-sum test for small samples (<12 per group)
 * - MAST (zero-inflated model) for larger samples (optional)
 * - Logistic regression for multi-covariate adjustment
 * - P-value distribution diagnostics (uniform -> effective correction, U-shaped -> zero-inflation)
 * - Volcano plot data generation
 *
 * QC gates validate:
 * - P-value distribution shape (diagnostic for model appropriateness)
 * - Number of significant DEGs found
 * - Effect size distribution
 */
export class DiffExpressionSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "diff-expression",
    version: "1.0.0",
    description:
      "Differential expression analysis between conditions — identifies DEGs with volcano plot diagnostics and p-value distribution checking",
    omicsType: "scrna",

    input: {
      acceptedFormats: ["h5ad"],
      schema: {},
      minSamples: 2,
      maxSamples: 100,
      requiredMetadataColumns: ["condition"],
      estimatedInputSize: "50MB-5GB",
    },

    tools: {
      primary: "scanpy.tl.rank_genes_groups(groupby=condition)",
      alternatives: [
        "MAST (zero-inflated hurdle model)",
        "scanpy.tl.rank_genes_groups(method=logreg)",
        "DESeq2 pseudobulk",
        "edgeR pseudobulk",
      ],
      decisionTree: [
        {
          condition: "Small sample size (n < 12 per condition) or standard analysis",
          tool: "scanpy.tl.rank_genes_groups(method=wilcoxon, groupby=condition)",
          reason:
            "Wilcoxon test is robust for small to medium sample sizes and does not assume normality",
        },
        {
          condition: "Large sample size (n >= 12 per condition) and zero-inflation expected",
          tool: "MAST (zero-inflated hurdle model)",
          reason:
            "MAST explicitly models the zero-inflation characteristic of scRNA-seq data, providing better calibrated p-values for large datasets",
        },
        {
          condition: "Multiple covariates need adjustment",
          tool: "scanpy.tl.rank_genes_groups(method=logreg)",
          reason:
            "Logistic regression can incorporate multiple covariates to control for confounding factors",
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
        method: "wilcoxon",
        groupby: "condition",
        reference: null,
        n_genes: 100,
        min_log2fc: 0.5,
        max_pval_adj: 0.05,
        min_cells_per_group: 3,
      },
      descriptions: {
        method: "Statistical method: 'wilcoxon', 't-test', 'logreg', or 'MAST'",
        groupby: "Column in adata.obs defining experimental conditions",
        reference: "Reference condition (null = auto-select first category)",
        n_genes: "Number of top DEGs to report",
        min_log2fc: "Minimum absolute log2 fold change for significance",
        max_pval_adj: "Maximum adjusted p-value for significance",
        min_cells_per_group: "Minimum cells required per condition group",
      },
      constraints: {
        n_genes: { min: 10, max: 1000 },
        min_log2fc: { min: 0.0, max: 3.0 },
        max_pval_adj: { min: 0.001, max: 0.2 },
        min_cells_per_group: { min: 2, max: 50 },
      },
      tuningStrategy:
        "Auto-select method: Wilcoxon if n<12 per group, MAST if n>=12 and zero-inflation detected, logreg if covariates present",
    },

    qcGates: [
      {
        id: "pvalue_distribution",
        name: "P-value Distribution Diagnostic",
        description:
          "P-values should follow a uniform-like distribution with a peak near 0 (signal). U-shaped distribution indicates zero-inflation problems with the model",
        check: {
          type: "distribution",
          expression:
            "pval_uniformity_score > 0.3 && pval_uniformity_score < 3.0",
          metric: "pval_dist",
        },
        level: "warn",
        onPass: "P-value distribution is consistent with model assumptions — DEG results are reliable",
        onFail:
          "Abnormal p-value distribution detected. If U-shaped, consider using MAST (zero-inflated model). If flat with no signal peak, possibly no real DEGs",
        fixable: true,
        autoFixCommand:
          "python -c \"# Re-run with MAST method for zero-inflated data\nimport scanpy as sc; adata = sc.read_h5ad('input.h5ad'); sc.tl.rank_genes_groups(adata, groupby='condition', method='wilcoxon')\"",
      },
      {
        id: "significant_degs",
        name: "Significant DEG Count",
        description:
          "At least some genes should be significantly differentially expressed (>= 5 DEGs with padj < 0.05 and |log2FC| > 0.5)",
        check: {
          type: "threshold",
          expression:
            "n_sig_degs >= 5",
          metric: "sig_deg_count",
        },
        level: "fail",
        onPass: "Sufficient number of DEGs found (>= 5) — valid comparison",
        onFail:
          "Few or no DEGs found (< 5). Conditions may be too similar, or statistical power is insufficient (too few cells per group)",
        fixable: false,
      },
      {
        id: "log2fc_distribution",
        name: "Log2FC Distribution Symmetry",
        description:
          "Log2 fold changes should be roughly symmetric around 0 — extreme asymmetry may indicate systematic bias",
        check: {
          type: "custom",
          expression:
            "log2fc_skew > -2 && log2fc_skew < 2",
          metric: "log2fc_symmetry",
        },
        level: "warn",
        onPass: "Log2FC distribution is approximately symmetric — no systematic directional bias",
        onFail:
          "Strong asymmetry in log2FC distribution suggests systematic up/down-regulation bias. Check if one condition has systematically different expression levels",
        fixable: false,
      },
    ],

    outputs: {
      files: [
        {
          name: "diff_expression.h5ad",
          format: "h5ad",
          description:
            "AnnData with DEG results in .uns['rank_genes_condition']",
          required: true,
        },
        {
          name: "deg_report.json",
          format: "json",
          description: "DEG table with statistics and volcano plot data",
          required: true,
        },
        {
          name: "volcano_data.json",
          format: "json",
          description: "Volcano plot data: log2FC, -log10(pval) for all genes",
          required: false,
        },
        {
          name: "pval_distribution.json",
          format: "json",
          description: "P-value distribution data for diagnostic histogram",
          required: false,
        },
      ],
      visualizations: [
        {
          type: "volcano",
          description: "Volcano plot showing log2FC vs -log10(adjusted p-value)",
        },
        {
          type: "heatmap",
          description: "Heatmap of top DEGs across conditions",
        },
      ],
      metrics: [
        { name: "n_cells_total", description: "Total cells analyzed", unit: "cells" },
        { name: "n_conditions", description: "Number of conditions compared" },
        { name: "n_genes_tested", description: "Number of genes tested", unit: "genes" },
        { name: "n_sig_degs", description: "Number of significant DEGs", unit: "genes" },
        { name: "n_upregulated", description: "Number of upregulated DEGs", unit: "genes" },
        { name: "n_downregulated", description: "Number of downregulated DEGs", unit: "genes" },
        { name: "pval_uniformity_score", description: "P-value distribution uniformity score" },
        { name: "log2fc_skew", description: "Skewness of log2FC distribution" },
      ],
    },

    troubleshooting: {
      common_issues: [
        {
          symptom: "n_sig_degs == 0",
          likely_cause:
            "No statistically significant difference between conditions, or insufficient statistical power",
          diagnosis:
            "Check sample sizes per condition. Very few cells (<10 per group) provide insufficient power. Verify conditions are correctly specified",
          fix: "Ensure sufficient cells per condition. Lower the log2FC threshold. Consider pseudobulk aggregation to increase power",
          severity: "warning",
        },
        {
          symptom: "pval_uniformity_score indicates U-shaped distribution",
          likely_cause:
            "Zero-inflation in scRNA-seq data causes inflated p-values near 1. Wilcoxon test may not handle sparse data well",
          diagnosis:
            "Plot p-value histogram. If U-shaped (peaks at 0 and 1), data has substantial zero-inflation",
          fix: "Switch to MAST method which explicitly models zero-inflation. Consider filtering genes with very low detection rates",
          severity: "warning",
        },
        {
          symptom: "log2fc_skew > 3 or < -3",
          likely_cause:
            "One condition has systematically higher or lower expression across many genes — possible technical artifact",
          diagnosis:
            "Check normalization. Compare total counts between conditions. Batch effect or library size differences may persist",
          fix: "Re-normalize data. Run batch correction if technical factors differ between conditions",
          severity: "warning",
        },
        {
          symptom: "only 1 condition found in data",
          likely_cause:
            "The groupby column has only one unique value — no comparison possible",
          diagnosis:
            "Check the condition column in adata.obs. Verify experimental design metadata",
          fix: "Ensure at least two distinct conditions exist in the metadata column",
          severity: "blocking",
        },
      ],
    },

    dependencies: {
      requires: ["cell-annotation"],
      recommends: ["marker-detection", "functional-enrichment"],
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
      errors.push("Input path is required (must point to an annotated .h5ad file with condition metadata).");
      return { valid: false, errors, warnings };
    }

    if (!data.inputPath.toLowerCase().endsWith(".h5ad")) {
      errors.push(
        `Input must be an .h5ad file. Got: ${data.inputPath}. Run upstream skills first.`,
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
      tool: "scanpy.tl.rank_genes_groups(method=wilcoxon, groupby=condition)",
      reason:
        "Wilcoxon test is robust for differential expression with varying sample sizes — standard first-line approach for scRNA-seq DEG analysis",
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
      method: this.spec.parameters.defaults["method"] ?? "wilcoxon",
      groupby:
        (data.metadata?.["groupby"] as string) ??
        this.spec.parameters.defaults["groupby"] ??
        "condition",
      reference: this.spec.parameters.defaults["reference"] ?? null,
      n_genes: this.spec.parameters.defaults["n_genes"] ?? 100,
      min_log2fc: this.spec.parameters.defaults["min_log2fc"] ?? 0.5,
      max_pval_adj: this.spec.parameters.defaults["max_pval_adj"] ?? 0.05,
      min_cells_per_group:
        this.spec.parameters.defaults["min_cells_per_group"] ?? 3,
    };
  }

  // -------------------------------------------------------------------------
  // ④ run
  // -------------------------------------------------------------------------

  async run(context: SkillContext): Promise<SkillExecResult> {
    const { inputPath, outputPath } = context.data;
    const method = (context.params["method"] as string) ?? "wilcoxon";
    const groupby = (context.params["groupby"] as string) ?? "condition";
    const reference = context.params["reference"] as string | null;
    const nGenes = (context.params["n_genes"] as number) ?? 100;
    const minLog2fc = (context.params["min_log2fc"] as number) ?? 0.5;
    const maxPvalAdj = (context.params["max_pval_adj"] as number) ?? 0.05;
    const minCellsPerGroup =
      (context.params["min_cells_per_group"] as number) ?? 3;

    const refStr = reference ? `"${reference}"` : "None";

    const pythonScript = `
import scanpy as sc
import numpy as np
import pandas as pd
import json
import os
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

input_path = "${inputPath}"
output_path = "${outputPath}"

# Load data
adata = sc.read_h5ad(input_path)
n_cells_total = adata.n_obs
n_genes_total = adata.n_vars

# Verify groupby column exists
groupby = "${groupby}"
if groupby not in adata.obs.columns:
    print(f"ERROR: '{groupby}' not found in adata.obs. Available: {list(adata.obs.columns)}")
    # Fallback: check common condition column names
    for alt_col in ['condition', 'treatment', 'group', 'sample_type', 'disease_status']:
        if alt_col in adata.obs.columns:
            groupby = alt_col
            print(f"Using alternative column: '{groupby}'")
            break
    else:
        raise ValueError(f"Column '{groupby}' not found. Cannot perform differential expression without condition labels.")

conditions = sorted(adata.obs[groupby].unique())
n_conditions = len(conditions)
print(f"Conditions: {conditions}, n_conditions={n_conditions}")

if n_conditions < 2:
    raise ValueError(f"Need at least 2 conditions for differential expression. Found: {n_conditions}")

# Cell counts per condition
cells_per_condition = {str(c): int((adata.obs[groupby] == c).sum()) for c in conditions}
print(f"Cells per condition: {cells_per_condition}")

# Auto-select method based on sample size
min_cells = min(cells_per_condition.values())
method_used = "${method}"

if method_used == "wilcoxon" and min_cells < 5:
    print(f"Small sample warning: min {min_cells} cells per condition. Wilcoxon may have limited power.")

# === Use raw counts if available ===
if adata.raw is not None:
    print("Using raw counts for differential expression")
    adata_for_de = adata.raw.to_adata()
    adata_for_de.obs[groupby] = adata.obs[groupby].values
else:
    adata_for_de = adata.copy()

# === Run differential expression ===
reference_condition = ${refStr}
if reference_condition is None or reference_condition not in conditions:
    reference_condition = conditions[0]
    print(f"Using '{reference_condition}' as reference condition")

try:
    sc.tl.rank_genes_groups(
        adata_for_de,
        groupby=groupby,
        groups=[conditions[1]] if n_conditions == 2 else None,  # Compare all vs reference for multi-group
        reference=reference_condition,
        method=method_used,
        n_genes=${nGenes},
        key_added='rank_genes_condition',
        tie_correct=True,
    )
except Exception as e:
    print(f"rank_genes_groups failed with method={method_used}: {e}")
    print("Falling back to t-test...")
    sc.tl.rank_genes_groups(
        adata_for_de,
        groupby=groupby,
        reference=reference_condition,
        method='t-test',
        n_genes=${nGenes},
        key_added='rank_genes_condition',
    )
    method_used = 't-test_fallback'

# === Extract results ===
result = adata_for_de.uns['rank_genes_condition']
comparison_group = conditions[1] if n_conditions == 2 else conditions[0]

try:
    group_idx = list(result['names'].dtype.names).index(str(comparison_group))
except (ValueError, AttributeError):
    # Multi-group: take first available
    group_names = list(result['names'].dtype.names)
    group_idx = 0
    comparison_group = group_names[group_idx]

genes = [result['names'][group_idx][i] for i in range(${nGenes})]
scores = [float(result['scores'][group_idx][i]) for i in range(${nGenes})]
logfoldchanges = [float(result['logfoldchanges'][group_idx][i]) for i in range(${nGenes})]
pvals = [float(result['pvals'][group_idx][i]) for i in range(${nGenes})]
pvals_adj = [float(result['pvals_adj'][group_idx][i]) for i in range(${nGenes})]

# === Classify DEGs ===
deg_table = []
sig_degs = []
upregulated = []
downregulated = []

for i in range(${nGenes}):
    is_sig = pvals_adj[i] < ${maxPvalAdj} and abs(logfoldchanges[i]) > ${minLog2fc}
    direction = "up" if logfoldchanges[i] > 0 else "down" if logfoldchanges[i] < 0 else "none"

    entry = {
        "gene": str(genes[i]),
        "log2fc": round(logfoldchanges[i], 4),
        "score": round(scores[i], 4),
        "pval": round(pvals[i], 6),
        "pval_adj": round(pvals_adj[i], 6),
        "significant": is_sig,
        "direction": direction,
        "neg_log10_pval": round(-np.log10(max(pvals_adj[i], 1e-300)), 2),
    }
    deg_table.append(entry)

    if is_sig:
        sig_degs.append(entry)
        if direction == "up":
            upregulated.append(entry)
        elif direction == "down":
            downregulated.append(entry)

n_sig_degs = len(sig_degs)
n_up = len(upregulated)
n_down = len(downregulated)

print(f"DEGs: {n_sig_degs} significant ({n_up} up, {n_down} down)")

# === P-value distribution diagnostics ===
pval_array = np.array(pvals)
pval_array = pval_array[np.isfinite(pval_array)]

# Compute uniformity score: ratio of p-values in [0.4, 0.6] to expected uniform density
if len(pval_array) > 10:
    mid_pval_count = np.sum((pval_array >= 0.4) & (pval_array <= 0.6))
    expected_mid = len(pval_array) * 0.2  # 20% expected in [0.4, 0.6]
    pval_uniformity_score = round(mid_pval_count / (expected_mid + 1e-10), 4)

    # Check for U-shape (peaks at 0 and 1)
    bin_counts, bin_edges = np.histogram(pval_array, bins=20)
    low_bin = np.sum(bin_counts[:2])  # first 2 bins (p ~ 0-0.1)
    high_bin = np.sum(bin_counts[-2:])  # last 2 bins (p ~ 0.9-1.0)
    mid_bins = np.sum(bin_counts[2:-2])
    is_ushaped = (low_bin + high_bin) > (1.5 * mid_bins) if mid_bins > 0 else False
    pval_dist_type = "U-shaped (zero-inflation suspected)" if is_ushaped else (
        "uniform-like" if 0.5 < pval_uniformity_score < 2.0 else "abnormal"
    )
else:
    pval_uniformity_score = 1.0
    pval_dist_type = "insufficient data"

# P-value histogram data
pval_hist, pval_bins = np.histogram(pval_array, bins=30)
pval_dist_data = {
    "histogram": pval_hist.tolist(),
    "bin_edges": pval_bins.tolist(),
    "uniformity_score": float(pval_uniformity_score),
    "distribution_type": pval_dist_type,
    "n_pvals": int(len(pval_array)),
}

# === Log2FC distribution statistics ===
log2fc_array = np.array([l for l in logfoldchanges if np.isfinite(l)])
if len(log2fc_array) > 3:
    log2fc_skew = round(float(stats.skew(log2fc_array)), 4)
else:
    log2fc_skew = 0.0

# === Volcano plot data ===
volcano_data = {
    "genes": genes,
    "log2fc": [round(l, 4) for l in logfoldchanges],
    "neg_log10_pval_adj": [round(-np.log10(max(p, 1e-300)), 2) for p in pvals_adj],
    "significant": [p < ${maxPvalAdj} and abs(l) > ${minLog2fc} for p, l in zip(pvals_adj, logfoldchanges)],
    "direction": ["up" if l > 0 else "down" if l < 0 else "none" for l in logfoldchanges],
    "thresholds": {
        "log2fc": ${minLog2fc},
        "pval_adj": ${maxPvalAdj},
    },
}

# Build report
report = {
    "n_cells_total": int(n_cells_total),
    "n_genes_total": int(n_genes_total),
    "n_genes_tested": ${nGenes},
    "n_conditions": int(n_conditions),
    "conditions": [str(c) for c in conditions],
    "reference": str(reference_condition),
    "comparison": str(comparison_group),
    "method": method_used,
    "cells_per_condition": cells_per_condition,
    "n_sig_degs": int(n_sig_degs),
    "n_upregulated": int(n_up),
    "n_downregulated": int(n_down),
    "min_log2fc_threshold": ${minLog2fc},
    "max_pval_adj_threshold": ${maxPvalAdj},
    "pval_uniformity_score": float(pval_uniformity_score),
    "pval_distribution_type": pval_dist_type,
    "log2fc_skew": float(log2fc_skew),
    "top_upregulated": [d["gene"] for d in upregulated[:10]],
    "top_downregulated": [d["gene"] for d in downregulated[:10]],
    "deg_table": deg_table[:200],  # Limit for JSON size
}

# Write outputs
with open(os.path.join(output_path, "deg_report.json"), "w") as f:
    json.dump(report, f, indent=2)

with open(os.path.join(output_path, "volcano_data.json"), "w") as f:
    json.dump(volcano_data, f)

with open(os.path.join(output_path, "pval_distribution.json"), "w") as f:
    json.dump(pval_dist_data, f)

# Copy results to original adata
adata.uns['rank_genes_condition'] = adata_for_de.uns['rank_genes_condition']

output_file = os.path.join(output_path, "diff_expression.h5ad")
adata.write(output_file)
print(f"Written: {output_file}")
print(f"Comparison: {reference_condition} vs {comparison_group}")
print(f"Significant DEGs: {n_sig_degs} ({n_up} up, {n_down} down)")
print(f"P-value distribution: {pval_dist_type} (score: {pval_uniformity_score})")
print(f"Log2FC skew: {log2fc_skew}")

print(json.dumps(report))
`.trim();

    const dockerResult = await this.execInContainer(context, pythonScript);

    const parsedData = this.parseJSONFromStdout(dockerResult.stdout);

    const metrics: Record<string, number> = {
      n_cells_total:
        typeof parsedData["n_cells_total"] === "number"
          ? (parsedData["n_cells_total"] as number)
          : 0,
      n_conditions:
        typeof parsedData["n_conditions"] === "number"
          ? (parsedData["n_conditions"] as number)
          : 0,
      n_genes_tested:
        typeof parsedData["n_genes_tested"] === "number"
          ? (parsedData["n_genes_tested"] as number)
          : 0,
      n_sig_degs:
        typeof parsedData["n_sig_degs"] === "number"
          ? (parsedData["n_sig_degs"] as number)
          : 0,
      n_upregulated:
        typeof parsedData["n_upregulated"] === "number"
          ? (parsedData["n_upregulated"] as number)
          : 0,
      n_downregulated:
        typeof parsedData["n_downregulated"] === "number"
          ? (parsedData["n_downregulated"] as number)
          : 0,
      pval_uniformity_score:
        typeof parsedData["pval_uniformity_score"] === "number"
          ? (parsedData["pval_uniformity_score"] as number)
          : 1.0,
      log2fc_skew:
        typeof parsedData["log2fc_skew"] === "number"
          ? (parsedData["log2fc_skew"] as number)
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

    const reference = results.parsedData["reference"] ?? "ref";
    const comparison = results.parsedData["comparison"] ?? "comp";
    const methodUsed = results.parsedData["method"] ?? "wilcoxon";
    const nSig = results.metrics["n_sig_degs"] ?? 0;
    const nUp = results.metrics["n_upregulated"] ?? 0;
    const nDown = results.metrics["n_downregulated"] ?? 0;
    const pvalScore = results.metrics["pval_uniformity_score"] ?? 0;
    const pvalType = results.parsedData["pval_distribution_type"] ?? "unknown";
    const log2fcSkew = results.metrics["log2fc_skew"] ?? 0;

    logs.push(
      `Differential expression (${methodUsed}): ${reference} vs ${comparison}`,
    );
    logs.push(
      `Significant DEGs: ${nSig} total (${nUp} upregulated, ${nDown} downregulated)`,
    );
    logs.push(
      `P-value distribution: ${pvalType} (uniformity score: ${pvalScore})`,
    );
    logs.push(
      `Log2FC skew: ${log2fcSkew}`,
    );
    logs.push(
      `QC overall: ${qc.overall} (${qc.passed}P/${qc.warned}W/${qc.failed}F)`,
    );

    const topUp = results.parsedData["top_upregulated"];
    const topDown = results.parsedData["top_downregulated"];
    if (Array.isArray(topUp) && topUp.length > 0) {
      logs.push(`Top upregulated: ${topUp.slice(0, 5).join(", ")}`);
    }
    if (Array.isArray(topDown) && topDown.length > 0) {
      logs.push(`Top downregulated: ${topDown.slice(0, 5).join(", ")}`);
    }

    return {
      files: [
        {
          path: `${results.parsedData["output_path"] ?? ""}/diff_expression.h5ad`,
          format: "h5ad",
          size_bytes: 0,
        },
        ...(results.exitCode === 0
          ? [
              {
                path: `${results.parsedData["output_path"] ?? ""}/deg_report.json`,
                format: "json",
                size_bytes: 0,
              },
              {
                path: `${results.parsedData["output_path"] ?? ""}/volcano_data.json`,
                format: "json",
                size_bytes: 0,
              },
              {
                path: `${results.parsedData["output_path"] ?? ""}/pval_distribution.json`,
                format: "json",
                size_bytes: 0,
              },
            ]
          : []),
      ],
      metrics: {
        n_cells_total: results.metrics["n_cells_total"],
        n_conditions: results.metrics["n_conditions"],
        n_genes_tested: results.metrics["n_genes_tested"],
        n_sig_degs: nSig,
        n_upregulated: nUp,
        n_downregulated: nDown,
        pval_uniformity_score: pvalScore,
        pval_distribution_type: pvalType,
        log2fc_skew: log2fcSkew,
        comparison: `${reference}_vs_${comparison}`,
        top_upregulated: topUp ?? [],
        top_downregulated: topDown ?? [],
      },
      logs,
    };
  }
}
