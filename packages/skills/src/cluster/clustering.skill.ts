// ============================================================
// @bioagent/skills — ClusteringSkill
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
 * Leiden Clustering Skill.
 *
 * Performs graph-based clustering using the Leiden algorithm with multi-resolution
 * scanning for optimal cluster granularity.
 *
 * Key features:
 * - Leiden clustering with configurable resolution (default: 1.0)
 * - Multi-resolution scanning (1-10 steps) for stability analysis
 * - Silhouette score evaluation
 * - ARI stability between adjacent resolutions
 * - Fallback to Louvain for compatibility with older scanpy versions
 *
 * QC gates validate cluster quality via silhouette coefficient (>0.3 required)
 * and ARI stability between resolutions (<0.3 change per step).
 */
export class ClusteringSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "clustering",
    version: "1.0.0",
    description:
      "Leiden clustering with multi-resolution scanning — identifies cell populations with silhouette and ARI stability diagnostics",
    omicsType: "scrna",

    input: {
      acceptedFormats: ["h5ad"],
      schema: {},
      minSamples: 1,
      maxSamples: 20,
      estimatedInputSize: "50MB-5GB",
    },

    tools: {
      primary: "scanpy.tl.leiden",
      alternatives: ["scanpy.tl.louvain", "phenograph"],
      decisionTree: [
        {
          condition: "Standard scRNA-seq clustering (recommended)",
          tool: "scanpy.tl.leiden",
          reason:
            "Leiden algorithm improves upon Louvain with guaranteed well-connected communities and better resolution control",
        },
        {
          condition: "Older scanpy version (< 1.5) without Leiden",
          tool: "scanpy.tl.louvain",
          reason:
            "Louvain clustering is the predecessor — produces similar results but may create disconnected communities",
        },
        {
          condition: "Need for multi-resolution stability analysis",
          tool: "scanpy.tl.leiden(multiple resolutions)",
          reason:
            "Multi-resolution scanning identifies the most stable resolution range for clustering",
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
        resolution: 1.0,
        n_neighbors: 15,
        n_pcs: 30,
        resolution_range_start: 0.5,
        resolution_range_end: 2.0,
        n_resolution_steps: 7,
        random_state: 42,
      },
      descriptions: {
        resolution: "Leiden resolution parameter — higher = more clusters",
        n_neighbors: "Number of neighbors for rebuilding graph (if needed)",
        n_pcs: "Number of PCs for graph construction",
        resolution_range_start: "Start of resolution scan range",
        resolution_range_end: "End of resolution scan range",
        n_resolution_steps: "Number of resolution steps to scan",
        random_state: "Random seed for reproducibility",
      },
      constraints: {
        resolution: { min: 0.1, max: 10.0 },
        n_neighbors: { min: 5, max: 100 },
        n_pcs: { min: 5, max: 100 },
        n_resolution_steps: { min: 2, max: 20 },
      },
    },

    qcGates: [
      {
        id: "silhouette_score",
        name: "Silhouette Score",
        description:
          "Silhouette coefficient should be >0.3, indicating reasonable cluster separation. Values >0.5 are excellent",
        check: {
          type: "threshold",
          expression: "silhouette_score > 0.3",
          metric: "silhouette",
        },
        level: "fail",
        onPass: "Silhouette score > 0.3 — clusters have reasonable separation",
        onFail:
          "Silhouette score <= 0.3 suggests poor cluster separation. Consider adjusting resolution or checking PCA quality",
        fixable: true,
        autoFixCommand:
          "python -c \"import scanpy as sc; adata = sc.read_h5ad('input.h5ad'); sc.tl.leiden(adata, resolution=0.5)\"",
      },
      {
        id: "cluster_count_reasonable",
        name: "Cluster Count Reasonability",
        description:
          "Number of clusters should be 5-30 for a typical dataset — too few indicates under-clustering, too many suggests over-clustering",
        check: {
          type: "range",
          expression: "n_clusters >= 5 && n_clusters <= 30",
          metric: "cluster_count",
        },
        level: "warn",
        onPass: "Cluster count in reasonable range (5-30)",
        onFail:
          "Cluster count outside 5-30 range. May need resolution adjustment. Very few clusters can miss rare populations; too many fragments populations",
        fixable: true,
        autoFixCommand:
          "python -c \"import scanpy as sc; adata = sc.read_h5ad('input.h5ad'); sc.tl.leiden(adata, resolution=1.0)\"",
      },
      {
        id: "ari_stability",
        name: "ARI Stability Between Resolutions",
        description:
          "Adjacent resolutions should have stable ARI (>0.7), indicating the clustering is robust across resolution choices",
        check: {
          type: "threshold",
          expression: "ari_mean_stability > 0.7",
          metric: "ari_stability",
        },
        level: "warn",
        onPass: "Clusters are stable across adjacent resolutions — robust clustering",
        onFail:
          "Low ARI stability (<0.7) across resolutions suggests clustering is sensitive to resolution choice. Consider broader resolution scan",
        fixable: false,
      },
      {
        id: "min_cluster_size",
        name: "Minimum Cluster Size",
        description: "Each cluster should contain at least 10 cells to be biologically meaningful",
        check: {
          type: "threshold",
          expression: "min_cluster_size >= 10",
          metric: "min_cluster",
        },
        level: "warn",
        onPass: "All clusters have >=10 cells — no singleton/artifact clusters",
        onFail:
          "Some clusters are very small (<10 cells). These may be noise or rare cell types. Consider merging or flagging for manual review",
        fixable: false,
      },
    ],

    outputs: {
      files: [
        {
          name: "clustered.h5ad",
          format: "h5ad",
          description:
            "AnnData with clustering labels in .obs['leiden'] and multi-resolution results",
          required: true,
        },
        {
          name: "clustering_report.json",
          format: "json",
          description: "Clustering report with per-cluster statistics and stability metrics",
          required: true,
        },
        {
          name: "cluster_tree.json",
          format: "json",
          description: "Hierarchical cluster tree from multi-resolution analysis",
          required: false,
        },
      ],
      visualizations: [
        {
          type: "scatter",
          description: "UMAP colored by Leiden clusters",
        },
        {
          type: "barplot",
          description: "Per-cluster cell count bar chart",
        },
      ],
      metrics: [
        { name: "n_cells", description: "Number of cells", unit: "cells" },
        { name: "n_clusters", description: "Number of clusters found" },
        { name: "resolution", description: "Resolution parameter used" },
        { name: "silhouette_score", description: "Silhouette coefficient (cluster separation)" },
        { name: "ari_mean_stability", description: "Mean ARI between adjacent resolutions" },
        { name: "min_cluster_size", description: "Smallest cluster size", unit: "cells" },
        { name: "max_cluster_size", description: "Largest cluster size", unit: "cells" },
      ],
    },

    troubleshooting: {
      common_issues: [
        {
          symptom: "n_clusters < 3",
          likely_cause:
            "Resolution is too low, or data has very little biological variation",
          diagnosis:
            "Check the multi-resolution scan — if all resolutions produce few clusters, data may lack heterogeneity",
          fix: "Increase resolution (e.g., 2.0-5.0). Verify PCA captures meaningful variation. Check data quality",
          severity: "warning",
        },
        {
          symptom: "n_clusters > 50",
          likely_cause:
            "Resolution is too high, creating many small fragmented clusters",
          diagnosis:
            "Review cluster sizes — many singletons suggests over-clustering. Check ARI stability",
          fix: "Reduce resolution (e.g., 0.3-0.8). Consider merging clusters with <10 cells",
          severity: "warning",
        },
        {
          symptom: "silhouette_score < 0.1",
          likely_cause:
            "Clusters are not well-separated in the PCA/UMAP space. Data may not have clear clustering structure",
          diagnosis:
            "Visualize clusters on UMAP. If clusters appear random, PCA or neighbor graph may need adjustment",
          fix: "Re-compute PCA with more PCs. Adjust n_neighbors for neighborhood graph. Try different resolution",
          severity: "warning",
        },
        {
          symptom: "ari_mean_stability < 0.5",
          likely_cause:
            "Clustering is highly sensitive to resolution — unstable clustering structure",
          diagnosis:
            "Review the ARI matrix across resolutions. Identify resolution range with highest stability",
          fix: "Use the resolution with highest local stability. Consider using clustering ensemble methods",
          severity: "warning",
        },
      ],
    },

    dependencies: {
      requires: ["umap-tsne"],
      recommends: ["cell-annotation", "marker-detection"],
      conflicts: [],
    },

    resourceEstimate: {
      cpu: "4",
      ram: "8GB",
      disk: "2GB",
      time: "3-15 min",
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
      errors.push("Input path is required (must point to a UMAP-computed .h5ad file with neighbor graph).");
      return { valid: false, errors, warnings };
    }

    if (!data.inputPath.toLowerCase().endsWith(".h5ad")) {
      errors.push(
        `Input must be an .h5ad file. Got: ${data.inputPath}. Run upstream skills (data-import, scrna-pca, umap-tsne) first.`,
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
      tool: "scanpy.tl.leiden",
      reason:
        "Leiden algorithm is the current standard for scRNA-seq clustering — provides guaranteed well-connected communities with better resolution control than Louvain",
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
      resolution: this.spec.parameters.defaults["resolution"] ?? 1.0,
      n_neighbors: this.spec.parameters.defaults["n_neighbors"] ?? 15,
      n_pcs: this.spec.parameters.defaults["n_pcs"] ?? 30,
      resolution_range_start:
        this.spec.parameters.defaults["resolution_range_start"] ?? 0.5,
      resolution_range_end:
        this.spec.parameters.defaults["resolution_range_end"] ?? 2.0,
      n_resolution_steps:
        this.spec.parameters.defaults["n_resolution_steps"] ?? 7,
      random_state: this.spec.parameters.defaults["random_state"] ?? 42,
    };
  }

  // -------------------------------------------------------------------------
  // ④ run
  // -------------------------------------------------------------------------

  async run(context: SkillContext): Promise<SkillExecResult> {
    const { inputPath, outputPath } = context.data;
    const resolution = (context.params["resolution"] as number) ?? 1.0;
    const nNeighbors = (context.params["n_neighbors"] as number) ?? 15;
    const nPcs = (context.params["n_pcs"] as number) ?? 30;
    const resStart =
      (context.params["resolution_range_start"] as number) ?? 0.5;
    const resEnd =
      (context.params["resolution_range_end"] as number) ?? 2.0;
    const nResSteps =
      (context.params["n_resolution_steps"] as number) ?? 7;
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

print(f"Loaded: {n_cells} cells")

# Ensure neighbor graph exists
if 'neighbors' not in adata.uns:
    print("Neighbor graph not found, constructing...")
    use_rep = 'X_pca'
    if 'X_pca_harmony' in adata.obsm:
        use_rep = 'X_pca_harmony'
    sc.pp.neighbors(adata, n_neighbors=${nNeighbors}, n_pcs=${nPcs}, use_rep=use_rep)

# === Multi-resolution scanning ===
resolutions = np.linspace(${resStart}, ${resEnd}, ${nResSteps})
resolution_labels = {}

for res in resolutions:
    res_key = f"leiden_r{round(res, 3)}"
    try:
        sc.tl.leiden(adata, resolution=float(res), key_added=res_key, random_state=${randomState})
    except Exception:
        # Fallback to Louvain
        try:
            sc.tl.louvain(adata, resolution=float(res), key_added=res_key, random_state=${randomState})
        except Exception as e:
            print(f"Clustering failed at resolution {res}: {e}")
            continue
    resolution_labels[str(round(res, 3))] = res_key

# === Default resolution clustering ===
sc.tl.leiden(adata, resolution=${resolution}, key_added='leiden', random_state=${randomState})

clusters = adata.obs['leiden'].astype('category').cat.codes.values
n_clusters = int(adata.obs['leiden'].nunique())

cluster_counts = adata.obs['leiden'].value_counts().to_dict()
min_cluster_size = int(min(cluster_counts.values()))
max_cluster_size = int(max(cluster_counts.values()))

print(f"Default clustering (res=${resolution}): {n_clusters} clusters")
print(f"Cluster sizes: min={min_cluster_size}, max={max_cluster_size}")

# === Silhouette score ===
silhouette_score = -1.0
try:
    from sklearn.metrics import silhouette_score as sil_score

    # Use PCA or UMAP coordinates for silhouette
    if 'X_umap' in adata.obsm:
        coords = adata.obsm['X_umap']
    elif 'X_pca' in adata.obsm:
        coords = adata.obsm['X_pca']
    else:
        coords = adata.X
        if hasattr(coords, 'toarray'):
            coords = coords.toarray()

    # Compute on subsample if large
    n_sample_sil = min(10000, n_cells)
    if n_cells > 10000:
        idx = np.random.choice(n_cells, n_sample_sil, replace=False)
        sil = sil_score(coords[idx], clusters[idx])
    else:
        sil = sil_score(coords, clusters)
    silhouette_score = round(float(sil), 4)
    print(f"Silhouette score: {silhouette_score}")
except Exception as e:
    print(f"Silhouette computation failed: {e}")

# === ARI stability between adjacent resolutions ===
from sklearn.metrics import adjusted_rand_score

ari_stabilities = []
cluster_counts_by_res = {}
res_keys_sorted = sorted(resolution_labels.keys(), key=float)

for r_key in res_keys_sorted:
    cluster_counts_by_res[r_key] = int(adata.obs[resolution_labels[r_key]].nunique())

for i in range(len(res_keys_sorted) - 1):
    res_a = res_keys_sorted[i]
    res_b = res_keys_sorted[i + 1]
    labels_a = adata.obs[resolution_labels[res_a]].astype('category').cat.codes.values
    labels_b = adata.obs[resolution_labels[res_b]].astype('category').cat.codes.values
    ari = adjusted_rand_score(labels_a, labels_b)
    ari_stabilities.append(round(float(ari), 4))

ari_mean_stability = round(float(np.mean(ari_stabilities)), 4) if ari_stabilities else 0

# === Per-cluster statistics ===
cluster_stats = {}
for cluster_name in sorted(adata.obs['leiden'].unique()):
    mask = adata.obs['leiden'] == cluster_name
    n = int(mask.sum())
    pct = round(100 * n / n_cells, 2)
    cluster_stats[str(cluster_name)] = {
        "n_cells": n,
        "percentage": pct,
    }

# === Cluster tree (multi-resolution hierarchy) ===
cluster_tree = {
    "resolutions": [float(r) for r in res_keys_sorted],
    "n_clusters_per_resolution": [cluster_counts_by_res[r] for r in res_keys_sorted],
    "ari_stability": ari_stabilities,
}

# Build report
report = {
    "n_cells": int(n_cells),
    "n_clusters": int(n_clusters),
    "resolution": ${resolution},
    "silhouette_score": float(silhouette_score),
    "ari_mean_stability": float(ari_mean_stability),
    "ari_stabilities": ari_stabilities,
    "min_cluster_size": int(min_cluster_size),
    "max_cluster_size": int(max_cluster_size),
    "cluster_distribution": cluster_stats,
    "resolutions_scanned": {
        "start": ${resStart},
        "end": ${resEnd},
        "n_steps": ${nResSteps},
        "cluster_counts": {r: cluster_counts_by_res[r] for r in res_keys_sorted},
    },
}

# Write outputs
with open(os.path.join(output_path, "clustering_report.json"), "w") as f:
    json.dump(report, f, indent=2)

with open(os.path.join(output_path, "cluster_tree.json"), "w") as f:
    json.dump(cluster_tree, f)

output_file = os.path.join(output_path, "clustered.h5ad")
adata.write(output_file)
print(f"Written: {output_file}")
print(f"Clusters: {n_clusters} at resolution {${resolution}}")
print(f"Silhouette: {silhouette_score}, ARI stability: {ari_mean_stability}")

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
      resolution:
        typeof parsedData["resolution"] === "number"
          ? (parsedData["resolution"] as number)
          : 1.0,
      silhouette_score:
        typeof parsedData["silhouette_score"] === "number"
          ? (parsedData["silhouette_score"] as number)
          : -1.0,
      ari_mean_stability:
        typeof parsedData["ari_mean_stability"] === "number"
          ? (parsedData["ari_mean_stability"] as number)
          : 0,
      min_cluster_size:
        typeof parsedData["min_cluster_size"] === "number"
          ? (parsedData["min_cluster_size"] as number)
          : 0,
      max_cluster_size:
        typeof parsedData["max_cluster_size"] === "number"
          ? (parsedData["max_cluster_size"] as number)
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

    const nClusters = results.metrics["n_clusters"] ?? 0;
    const resolution = results.metrics["resolution"] ?? 1.0;
    const silhouette = results.metrics["silhouette_score"] ?? 0;
    const ariStability = results.metrics["ari_mean_stability"] ?? 0;
    const minSize = results.metrics["min_cluster_size"] ?? 0;
    const maxSize = results.metrics["max_cluster_size"] ?? 0;

    logs.push(
      `Clustering: ${nClusters} clusters at resolution ${resolution}`,
    );
    logs.push(
      `Silhouette: ${silhouette}, ARI stability: ${ariStability}`,
    );
    logs.push(
      `Cluster sizes: min=${minSize}, max=${maxSize}`,
    );
    logs.push(
      `QC overall: ${qc.overall} (${qc.passed}P/${qc.warned}W/${qc.failed}F)`,
    );

    if (nClusters >= 30) {
      logs.push(
        `NOTE: ${nClusters} clusters found. Consider reviewing if all clusters are biologically meaningful.`,
      );
    }

    return {
      files: [
        {
          path: `${results.parsedData["output_path"] ?? ""}/clustered.h5ad`,
          format: "h5ad",
          size_bytes: 0,
        },
        ...(results.exitCode === 0
          ? [
              {
                path: `${results.parsedData["output_path"] ?? ""}/clustering_report.json`,
                format: "json",
                size_bytes: 0,
              },
              {
                path: `${results.parsedData["output_path"] ?? ""}/cluster_tree.json`,
                format: "json",
                size_bytes: 0,
              },
            ]
          : []),
      ],
      metrics: {
        n_cells: results.metrics["n_cells"],
        n_clusters: nClusters,
        resolution: resolution,
        silhouette_score: silhouette,
        ari_mean_stability: ariStability,
        min_cluster_size: minSize,
        max_cluster_size: maxSize,
        cluster_distribution:
          results.parsedData["cluster_distribution"] ?? {},
        resolutions_scanned:
          results.parsedData["resolutions_scanned"] ?? {},
      },
      logs,
    };
  }
}
