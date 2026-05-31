// ============================================================
// @bioagent/skills — MarkerDetectionSkill
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
 * Marker Gene Detection Skill.
 *
 * Identifies marker genes for each cluster using Wilcoxon rank-sum test.
 * For each cluster, ranks genes by their differential expression against
 * all other clusters combined.
 *
 * Key outputs:
 * - Per-cluster marker gene table (CSV-compatible JSON)
 * - Dotplot data for visualization
 * - Heatmap data for top markers
 *
 * QC gates validate:
 * - Top marker log2FC > 1
 * - Adjusted p-value < 0.05
 * - At least 3 significant markers per cluster
 */
export class MarkerDetectionSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "marker-detection",
    version: "1.0.0",
    description:
      "Marker gene detection using Wilcoxon rank-sum test — identifies cluster-specific marker genes with statistical rigor",
    omicsType: "scrna",

    input: {
      acceptedFormats: ["h5ad"],
      schema: {},
      minSamples: 1,
      maxSamples: 20,
      estimatedInputSize: "50MB-5GB",
    },

    tools: {
      primary: "scanpy.tl.rank_genes_groups(method=wilcoxon)",
      alternatives: [
        "scanpy.tl.rank_genes_groups(method=t-test)",
        "scanpy.tl.rank_genes_groups(method=logreg)",
        "scvi-tools differential expression",
      ],
      decisionTree: [
        {
          condition: "Standard marker detection (recommended)",
          tool: "scanpy.tl.rank_genes_groups(method=wilcoxon)",
          reason:
            "Wilcoxon rank-sum test is non-parametric and robust for scRNA-seq data — standard for marker gene detection",
        },
        {
          condition: "Very large dataset (>100k cells)",
          tool: "scanpy.tl.rank_genes_groups(method=t-test)",
          reason:
            "t-test is faster for very large datasets with acceptable statistical performance",
        },
        {
          condition: "Need multi-group comparison",
          tool: "scanpy.tl.rank_genes_groups(method=wilcoxon, tie_correct=True)",
          reason:
            "Tie correction improves accuracy when many cells have the same expression level (common in sparse scRNA-seq)",
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
        n_genes: 50,
        groupby: "leiden",
        min_log2fc: 1.0,
        max_pval_adj: 0.05,
        min_pct_in_group: 0.25,
        min_pct_out_group: 0.1,
      },
      descriptions: {
        method: "Statistical method: 'wilcoxon' (default), 't-test', 'logreg'",
        n_genes: "Number of top markers to report per cluster",
        groupby: "Column in adata.obs to group by (default: 'leiden' clusters)",
        min_log2fc: "Minimum log2 fold change for marker significance",
        max_pval_adj: "Maximum adjusted p-value for significance",
        min_pct_in_group: "Minimum fraction of cells in the cluster expressing the gene",
        min_pct_out_group: "Maximum fraction of cells outside the cluster expressing the gene",
      },
      constraints: {
        n_genes: { min: 10, max: 500 },
        min_log2fc: { min: 0.25, max: 5.0 },
        max_pval_adj: { min: 0.001, max: 0.1 },
        min_pct_in_group: { min: 0.1, max: 0.9 },
        min_pct_out_group: { min: 0.01, max: 0.5 },
      },
    },

    qcGates: [
      {
        id: "top_marker_log2fc",
        name: "Top Marker Log2FC",
        description:
          "At least 80% of clusters should have top marker with log2FC > 1 — ensures markers are biologically meaningful",
        check: {
          type: "threshold",
          expression: "pct_clusters_strong_markers > 80",
          metric: "log2fc",
        },
        level: "fail",
        onPass: ">80% of clusters have strong markers (log2FC > 1) — reliable cluster identification",
        onFail:
          "Insufficient strong markers found. Clusters may not be well-separated or may represent subtypes without clear markers",
        fixable: false,
      },
      {
        id: "significant_markers_per_cluster",
        name: "Significant Markers Per Cluster",
        description:
          "Every cluster should have at least 3 significant markers (adj p < 0.05, log2FC > 1)",
        check: {
          type: "threshold",
          expression: "min_markers_per_cluster >= 3",
          metric: "min_markers",
        },
        level: "fail",
        onPass: "All clusters have >= 3 significant markers — sufficient for biological interpretation",
        onFail:
          "Some clusters have <3 significant markers. These clusters may be poorly defined or represent noise. Consider merging or reviewing these clusters",
        fixable: false,
      },
      {
        id: "marker_specificity",
        name: "Marker Specificity Across Clusters",
        description:
          "Top markers should be specific (not shared across > 50% of clusters) to provide discriminative power",
        check: {
          type: "threshold",
          expression: "marker_uniqueness > 50",
          metric: "marker_specificity",
        },
        level: "warn",
        onPass: "Markers are sufficiently unique across clusters — good discriminative power",
        onFail:
          "Many markers are shared across clusters, reducing their discriminative value. Consider filtering for cluster-specific markers",
        fixable: false,
      },
    ],

    outputs: {
      files: [
        {
          name: "marker_detection.h5ad",
          format: "h5ad",
          description:
            "AnnData with marker gene results in .uns['rank_genes_groups']",
          required: true,
        },
        {
          name: "marker_report.json",
          format: "json",
          description: "Per-cluster marker gene table with statistics",
          required: true,
        },
        {
          name: "dotplot_data.json",
          format: "json",
          description: "Dotplot expression data for top markers visualization",
          required: false,
        },
        {
          name: "heatmap_data.json",
          format: "json",
          description: "Heatmap expression data for top markers across clusters",
          required: false,
        },
      ],
      visualizations: [
        {
          type: "dotplot",
          description: "Dotplot of top marker genes per cluster showing expression level and fraction expressing",
        },
        {
          type: "heatmap",
          description: "Heatmap of top marker expression across all clusters",
        },
      ],
      metrics: [
        { name: "n_clusters", description: "Number of clusters analyzed" },
        { name: "n_genes_total", description: "Total number of genes tested", unit: "genes" },
        { name: "pct_clusters_strong_markers", description: "Percentage of clusters with log2FC>1 top marker", unit: "%" },
        { name: "min_markers_per_cluster", description: "Minimum number of significant markers per cluster" },
        { name: "mean_markers_per_cluster", description: "Mean number of significant markers per cluster" },
        { name: "marker_uniqueness", description: "Percentage of markers unique to a single cluster", unit: "%" },
      ],
    },

    troubleshooting: {
      common_issues: [
        {
          symptom: "min_markers_per_cluster < 1",
          likely_cause:
            "Some clusters are too small or not well-separated from others. Wilcoxon test requires sufficient statistical power",
          diagnosis:
            "Check cluster sizes. Very small clusters (<20 cells) may not yield significant markers. Check if clustering resolution is too high",
          fix: "Merge small clusters with their nearest neighbors. Reduce clustering resolution. Consider using a less strict statistical test",
          severity: "warning",
        },
        {
          symptom: "pct_clusters_strong_markers < 50%",
          likely_cause:
            "Clusters may not be biologically distinct, or log2FC threshold is too stringent",
          diagnosis:
            "Check UMAP visualization — if clusters overlap heavily, biological separation is weak",
          fix: "Relax log2FC threshold to 0.5. Review if clustering captures meaningful biological variation",
          severity: "warning",
        },
        {
          symptom: "marker_uniqueness < 30%",
          likely_cause:
            "Many genes are shared markers across clusters, suggesting related cell types or over-clustering",
          diagnosis:
            "Compare marker sets between clusters. High overlap suggests clusters are subtypes of larger populations",
          fix: "Filter for cluster-specific markers using min_pct_out_group parameter. Consider hierarchical annotation",
          severity: "warning",
        },
        {
          symptom: "MemoryError during rank_genes_groups",
          likely_cause:
            "Dataset too large for pairwise comparison. Wilcoxon test requires loading full expression data",
          diagnosis:
            "Check memory usage. rank_genes_groups computes statistics for all genes against all clusters",
          fix: "Subset to HVGs only. Use t-test instead of Wilcoxon for faster computation. Downsample large clusters",
          severity: "blocking",
        },
      ],
    },

    dependencies: {
      requires: ["cell-annotation"],
      recommends: ["diff-expression", "functional-enrichment"],
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
      errors.push("Input path is required (must point to an annotated .h5ad file).");
      return { valid: false, errors, warnings };
    }

    if (!data.inputPath.toLowerCase().endsWith(".h5ad")) {
      errors.push(
        `Input must be an .h5ad file. Got: ${data.inputPath}. Run upstream skills (data-import through cell-annotation) first.`,
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
      tool: "scanpy.tl.rank_genes_groups(method=wilcoxon)",
      reason:
        "Wilcoxon rank-sum test is the standard for marker gene detection in scRNA-seq — non-parametric, robust to outliers, and widely validated",
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
      n_genes: this.spec.parameters.defaults["n_genes"] ?? 50,
      groupby: this.spec.parameters.defaults["groupby"] ?? "leiden",
      min_log2fc: this.spec.parameters.defaults["min_log2fc"] ?? 1.0,
      max_pval_adj: this.spec.parameters.defaults["max_pval_adj"] ?? 0.05,
      min_pct_in_group:
        this.spec.parameters.defaults["min_pct_in_group"] ?? 0.25,
      min_pct_out_group:
        this.spec.parameters.defaults["min_pct_out_group"] ?? 0.1,
    };
  }

  // -------------------------------------------------------------------------
  // ④ run
  // -------------------------------------------------------------------------

  async run(context: SkillContext): Promise<SkillExecResult> {
    const { inputPath, outputPath } = context.data;
    const method = (context.params["method"] as string) ?? "wilcoxon";
    const nGenes = (context.params["n_genes"] as number) ?? 50;
    const groupby = (context.params["groupby"] as string) ?? "leiden";
    const minLog2fc = (context.params["min_log2fc"] as number) ?? 1.0;
    const maxPvalAdj = (context.params["max_pval_adj"] as number) ?? 0.05;
    const minPctIn = (context.params["min_pct_in_group"] as number) ?? 0.25;
    const minPctOut = (context.params["min_pct_out_group"] as number) ?? 0.1;

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
n_genes_total = adata.n_vars

# Ensure group column exists
groupby = "${groupby}"
if groupby not in adata.obs.columns:
    print(f"WARNING: '{groupby}' not found. Falling back to 'leiden'.")
    if 'leiden' not in adata.obs.columns:
        # Run basic clustering
        if 'neighbors' not in adata.uns:
            sc.pp.neighbors(adata, n_neighbors=15, n_pcs=30)
        sc.tl.leiden(adata, resolution=1.0)
    groupby = 'leiden'

groups = sorted(adata.obs[groupby].unique())
n_groups = len(groups)

print(f"Running marker detection on {n_groups} groups, {n_cells} cells, {n_genes_total} genes")

# === Use raw counts if available (better for Wilcoxon) ===
if adata.raw is not None:
    print("Using raw counts for marker detection")
    adata_for_markers = adata.raw.to_adata()
    # Copy group labels
    adata_for_markers.obs[groupby] = adata.obs[groupby].values
else:
    adata_for_markers = adata.copy()

# === Run rank_genes_groups ===
sc.tl.rank_genes_groups(
    adata_for_markers,
    groupby=groupby,
    method="${method}",
    n_genes=${nGenes},
    key_added='rank_genes_markers',
    tie_correct=True,
)

# === Extract marker table ===
result = adata_for_markers.uns['rank_genes_markers']
all_markers = []

for group in groups:
    try:
        group_idx = list(result['names'].dtype.names).index(str(group))
        genes = [result['names'][group_idx][i] for i in range(${nGenes})]
        scores = [float(result['scores'][group_idx][i]) for i in range(${nGenes})]
        logfoldchanges = [float(result['logfoldchanges'][group_idx][i]) for i in range(${nGenes})]
        pvals = [float(result['pvals'][group_idx][i]) for i in range(${nGenes})]
        pvals_adj = [float(result['pvals_adj'][group_idx][i]) for i in range(${nGenes})]

        # Per-group significant markers
        sig_markers = []
        for i in range(${nGenes}):
            is_sig = pvals_adj[i] < ${maxPvalAdj} and logfoldchanges[i] > ${minLog2fc}
            marker_entry = {
                "gene": str(genes[i]),
                "score": round(scores[i], 4),
                "log2fc": round(logfoldchanges[i], 4),
                "pval": round(pvals[i], 6),
                "pval_adj": round(pvals_adj[i], 6),
                "significant": is_sig,
            }
            all_markers.append({**{"group": str(group)}, **marker_entry})
            if is_sig:
                sig_markers.append(marker_entry)

        n_sig = len(sig_markers)
        top_log2fc = round(logfoldchanges[0], 4) if logfoldchanges else 0
        print(f"  Group {group}: {n_sig} significant markers, top log2FC: {top_log2fc}")

    except Exception as e:
        print(f"  Group {group}: extraction failed - {e}")

# === Compute QC metrics ===
# Per-cluster significant marker counts
sig_counts_by_group = {}
top_log2fc_by_group = {}
for marker in all_markers:
    g = marker["group"]
    if g not in sig_counts_by_group:
        sig_counts_by_group[g] = 0
        top_log2fc_by_group[g] = marker["log2fc"]
    if marker["significant"]:
        sig_counts_by_group[g] += 1

# Top log2FC per group (first entry in each group)
for marker in all_markers:
    g = marker["group"]
    if g not in top_log2fc_by_group or top_log2fc_by_group[g] is None:
        top_log2fc_by_group[g] = marker["log2fc"]

sig_values = list(sig_counts_by_group.values())
min_markers_per_cluster = int(min(sig_values)) if sig_values else 0
mean_markers_per_cluster = round(float(np.mean(sig_values)), 1) if sig_values else 0

groups_strong = sum(1 for g in groups if top_log2fc_by_group.get(g, 0) > ${minLog2fc})
pct_clusters_strong = round(100 * groups_strong / n_groups, 2) if n_groups > 0 else 0

# === Marker uniqueness ===
all_top_genes = []  # top marker from each group
for g in groups:
    group_markers = [m["gene"] for m in all_markers if m["group"] == g]
    if group_markers:
        all_top_genes.append(group_markers[0])

# Count how many groups share the same top marker
gene_group_counts = {}
for gene in all_top_genes:
    gene_group_counts[gene] = gene_group_counts.get(gene, 0) + 1

unique_top_markers = sum(1 for g in gene_group_counts.values() if g == 1)
marker_uniqueness = round(100 * unique_top_markers / len(gene_group_counts), 2) if gene_group_counts else 0

# === Dotplot data ===
# Select top N markers per cluster for dotplot
top_n_for_dotplot = min(5, ${nGenes})
top_marker_genes = []
for g in groups:
    group_markers = [m["gene"] for m in all_markers if m["group"] == g and m["significant"]]
    for gm in group_markers[:top_n_for_dotplot]:
        if gm not in top_marker_genes:
            top_marker_genes.append(gm)

# Build dotplot data
dotplot_data = {
    "genes": top_marker_genes,
    "groups": [str(g) for g in groups],
    "mean_expression": [],
    "fraction_expressing": [],
}

for gene in top_marker_genes:
    if gene in adata.var_names:
        gene_idx = list(adata.var_names).index(gene)
        gene_expr = adata.X[:, gene_idx]
        if hasattr(gene_expr, 'toarray'):
            gene_expr = gene_expr.toarray().flatten()
        elif hasattr(gene_expr, 'A1'):
            gene_expr = gene_expr.A1

        mean_expr_per_group = []
        frac_per_group = []
        for g in groups:
            g_mask = (adata.obs[groupby] == g).values
            if g_mask.sum() > 0:
                g_expr = gene_expr[g_mask]
                mean_expr_per_group.append(round(float(np.mean(g_expr)), 4))
                frac_per_group.append(round(float(np.mean(g_expr > 0)), 4))
            else:
                mean_expr_per_group.append(0.0)
                frac_per_group.append(0.0)

        dotplot_data["mean_expression"].append(mean_expr_per_group)
        dotplot_data["fraction_expressing"].append(frac_per_group)

# === Heatmap data ===
# Select top 3 markers per cluster for heatmap
top_n_heatmap = 3
heatmap_genes = []
for g in groups:
    group_markers = [m["gene"] for m in all_markers if m["group"] == g and m["significant"]]
    for gm in group_markers[:top_n_heatmap]:
        if gm not in heatmap_genes:
            heatmap_genes.append(gm)

heatmap_data = {
    "genes": heatmap_genes,
    "groups": [str(g) for g in groups],
    "expression_matrix": [],
}

for gene in heatmap_genes:
    if gene in adata.var_names:
        gene_idx = list(adata.var_names).index(gene)
        gene_expr = adata.X[:, gene_idx]
        if hasattr(gene_expr, 'toarray'):
            gene_expr = gene_expr.toarray().flatten()
        elif hasattr(gene_expr, 'A1'):
            gene_expr = gene_expr.A1

        mean_expr_per_group = []
        for g in groups:
            g_mask = (adata.obs[groupby] == g).values
            if g_mask.sum() > 0:
                g_expr = gene_expr[g_mask]
                mean_expr_per_group.append(round(float(np.mean(g_expr)), 4))
            else:
                mean_expr_per_group.append(0.0)

        heatmap_data["expression_matrix"].append(mean_expr_per_group)

# === Build report ===
report = {
    "n_cells": int(n_cells),
    "n_genes_total": int(n_genes_total),
    "n_groups": int(n_groups),
    "groupby": groupby,
    "method": "${method}",
    "n_genes_tested": ${nGenes},
    "min_log2fc_threshold": ${minLog2fc},
    "max_pval_adj_threshold": ${maxPvalAdj},
    "pct_clusters_strong_markers": float(pct_clusters_strong),
    "min_markers_per_cluster": int(min_markers_per_cluster),
    "mean_markers_per_cluster": float(mean_markers_per_cluster),
    "marker_uniqueness": float(marker_uniqueness),
    "per_cluster_summary": {
        str(g): {
            "n_significant_markers": int(sig_counts_by_group.get(g, 0)),
            "top_log2fc": float(top_log2fc_by_group.get(g, 0)),
            "top_markers": [m["gene"] for m in all_markers if m["group"] == g][:5],
        }
        for g in groups
    },
    "all_markers": all_markers[:500],  # Limit to avoid huge JSON
}

# Write outputs
with open(os.path.join(output_path, "marker_report.json"), "w") as f:
    json.dump(report, f, indent=2)

with open(os.path.join(output_path, "dotplot_data.json"), "w") as f:
    json.dump(dotplot_data, f)

with open(os.path.join(output_path, "heatmap_data.json"), "w") as f:
    json.dump(heatmap_data, f)

# Copy marker results to original adata for output
adata.uns['rank_genes_markers'] = adata_for_markers.uns['rank_genes_markers']

output_file = os.path.join(output_path, "marker_detection.h5ad")
adata.write(output_file)
print(f"Written: {output_file}")
print(f"Strong marker clusters: {pct_clusters_strong:.1f}%")
print(f"Markers per cluster: min={min_markers_per_cluster}, mean={mean_markers_per_cluster}")
print(f"Marker uniqueness: {marker_uniqueness:.1f}%")

print(json.dumps(report))
`.trim();

    const dockerResult = await this.execInContainer(context, pythonScript);

    const parsedData = this.parseJSONFromStdout(dockerResult.stdout);

    const metrics: Record<string, number> = {
      n_clusters:
        typeof parsedData["n_groups"] === "number"
          ? (parsedData["n_groups"] as number)
          : 0,
      n_genes_total:
        typeof parsedData["n_genes_total"] === "number"
          ? (parsedData["n_genes_total"] as number)
          : 0,
      pct_clusters_strong_markers:
        typeof parsedData["pct_clusters_strong_markers"] === "number"
          ? (parsedData["pct_clusters_strong_markers"] as number)
          : 0,
      min_markers_per_cluster:
        typeof parsedData["min_markers_per_cluster"] === "number"
          ? (parsedData["min_markers_per_cluster"] as number)
          : 0,
      mean_markers_per_cluster:
        typeof parsedData["mean_markers_per_cluster"] === "number"
          ? (parsedData["mean_markers_per_cluster"] as number)
          : 0,
      marker_uniqueness:
        typeof parsedData["marker_uniqueness"] === "number"
          ? (parsedData["marker_uniqueness"] as number)
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

    const nGroups = results.metrics["n_clusters"] ?? 0;
    const pctStrong = results.metrics["pct_clusters_strong_markers"] ?? 0;
    const minM = results.metrics["min_markers_per_cluster"] ?? 0;
    const meanM = results.metrics["mean_markers_per_cluster"] ?? 0;
    const uniq = results.metrics["marker_uniqueness"] ?? 0;
    const methodUsed = results.parsedData["method"] ?? "wilcoxon";

    logs.push(
      `Marker detection (${methodUsed}): ${nGroups} groups analyzed`,
    );
    logs.push(
      `Strong marker clusters: ${pctStrong}% (mean ${meanM}/min ${minM} markers per cluster)`,
    );
    logs.push(
      `Marker uniqueness: ${uniq}% (cluster-specific top markers)`,
    );
    logs.push(
      `QC overall: ${qc.overall} (${qc.passed}P/${qc.warned}W/${qc.failed}F)`,
    );

    const summary = results.parsedData["per_cluster_summary"];
    if (summary && typeof summary === "object") {
      logs.push("--- Per-cluster marker summary ---");
      for (const [g, info] of Object.entries(summary)) {
        const s = info as Record<string, unknown>;
        logs.push(
          `  Group ${g}: ${s["n_significant_markers"] ?? 0} markers, top log2FC=${s["top_log2fc"] ?? 0}`,
        );
      }
    }

    return {
      files: [
        {
          path: `${results.parsedData["output_path"] ?? ""}/marker_detection.h5ad`,
          format: "h5ad",
          size_bytes: 0,
        },
        ...(results.exitCode === 0
          ? [
              {
                path: `${results.parsedData["output_path"] ?? ""}/marker_report.json`,
                format: "json",
                size_bytes: 0,
              },
              {
                path: `${results.parsedData["output_path"] ?? ""}/dotplot_data.json`,
                format: "json",
                size_bytes: 0,
              },
              {
                path: `${results.parsedData["output_path"] ?? ""}/heatmap_data.json`,
                format: "json",
                size_bytes: 0,
              },
            ]
          : []),
      ],
      metrics: {
        n_clusters: nGroups,
        n_genes_total: results.metrics["n_genes_total"],
        method: methodUsed,
        pct_clusters_strong_markers: pctStrong,
        min_markers_per_cluster: minM,
        mean_markers_per_cluster: meanM,
        marker_uniqueness: uniq,
        per_cluster_summary: summary ?? {},
      },
      logs,
    };
  }
}
