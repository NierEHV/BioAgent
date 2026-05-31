// ============================================================
// @bioagent/skills — UmapTsneSkill
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
 * UMAP/tSNE Embedding Skill.
 *
 * Computes neighborhood graph and UMAP embedding for scRNA-seq visualization.
 * Supports parameter tuning based on dataset size and provides trustworthiness
 * diagnostics.
 *
 * Key parameters (auto-tuned by dataset size):
 * - n_neighbors: 15 default, decreases for small datasets, increases for large
 * - min_dist: 0.3 default, increases for large datasets to prevent over-clumping
 * - n_pcs: 30 default
 *
 * QC gates check UMAP topology preservation via trustworthiness metric.
 */
export class UmapTsneSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "umap-tsne",
    version: "1.0.0",
    description:
      "UMAP embedding with neighborhood graph construction — computes 2D visualization with trustworthiness diagnostics and topology preservation checks",
    omicsType: "scrna",

    input: {
      acceptedFormats: ["h5ad"],
      schema: {},
      minSamples: 1,
      maxSamples: 20,
      estimatedInputSize: "50MB-5GB",
    },

    tools: {
      primary: "scanpy.tl.umap",
      alternatives: [
        "scanpy.tl.tsne",
        "scanpy.external.tl.phate",
        "openTSNE",
      ],
      decisionTree: [
        {
          condition: "Standard scRNA-seq visualization (recommended)",
          tool: "scanpy.pp.neighbors + scanpy.tl.umap",
          reason:
            "UMAP is the standard for scRNA-seq visualization — preserves global structure better than tSNE and is faster",
        },
        {
          condition: "Small dataset (<1000 cells) or tSNE preference",
          tool: "scanpy.tl.tsne",
          reason:
            "tSNE can produce more interpretable local structure for very small datasets",
        },
        {
          condition: "Large dataset (>100k cells)",
          tool: "scanpy.tl.umap(min_dist=0.5, spread=1.5)",
          reason:
            "Larger min_dist prevents over-clumping in very large datasets",
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
        n_neighbors: 15,
        n_pcs: 30,
        min_dist: 0.3,
        spread: 1.0,
        method: "umap",
        random_state: 42,
      },
      descriptions: {
        n_neighbors: "Number of neighbors for neighborhood graph (auto-adjusted for small datasets)",
        n_pcs: "Number of PCs to use for neighbor graph",
        min_dist: "Minimum distance between points in UMAP embedding (higher = more spread)",
        spread: "Effective scale of embedded points",
        method: "Embedding method: 'umap' or 'tsne'",
        random_state: "Random seed for reproducibility",
      },
      constraints: {
        n_neighbors: { min: 5, max: 100 },
        n_pcs: { min: 5, max: 100 },
        min_dist: { min: 0.01, max: 1.0 },
        spread: { min: 0.1, max: 5.0 },
      },
      tuningStrategy:
        "n_neighbors auto-adjusted: sqrt(n_cells)/2 for small datasets (<500 cells), 15 for normal, 25 for large (>100k). min_dist: 0.3 for normal, 0.5 for large (>100k)",
    },

    qcGates: [
      {
        id: "umap_trustworthiness",
        name: "UMAP Trustworthiness Check",
        description:
          "UMAP embedding trustworthiness should be >0.8 — verifies that neighborhood relationships in high-D space are preserved in 2D",
        check: {
          type: "threshold",
          expression:
            "trustworthiness > 0.8",
          metric: "trustworthiness",
        },
        level: "fail",
        onPass: "UMAP trustworthiness > 0.8 — high-D topology is well preserved in 2D",
        onFail:
          "Low trustworthiness (<=0.8) indicates 2D embedding may distort cell relationships. Try adjusting n_neighbors or n_pcs",
        fixable: true,
        autoFixCommand:
          "python -c \"import scanpy as sc; adata = sc.read_h5ad('input.h5ad'); sc.tl.umap(adata, n_neighbors=30, min_dist=0.5)\"",
      },
      {
        id: "neighbors_sufficient",
        name: "Neighbor Count Sufficiency",
        description:
          "Number of neighbors should be adequate relative to dataset size",
        check: {
          type: "custom",
          expression:
            "n_neighbors_ratio > 0.01 && n_neighbors_ratio < 0.5",
          metric: "neighbor_ratio",
        },
        level: "warn",
        onPass: "Neighbor count is appropriate for dataset size",
        onFail:
          "n_neighbors is too small or too large relative to dataset size. This may result in fragmented or overly-blurred embeddings",
        fixable: true,
        autoFixCommand:
          "python -c \"import scanpy as sc; adata = sc.read_h5ad('input.h5ad'); sc.tl.umap(adata, n_neighbors=15)\"",
      },
      {
        id: "embedding_convergence",
        name: "UMAP Convergence",
        description:
          "UMAP optimization should converge (indicated by well-distributed embedding coordinates)",
        check: {
          type: "custom",
          expression:
            "embedding_std > 0.5 && embedding_std < 20",
          metric: "embedding_convergence",
        },
        level: "warn",
        onPass: "Embedding coordinates show good distribution — optimization likely converged",
        onFail:
          "Embedding shows extreme compression or dispersion. May indicate UMAP optimization issues. Try adjusting min_dist or n_neighbors",
        fixable: true,
      },
    ],

    outputs: {
      files: [
        {
          name: "umap_embedding.h5ad",
          format: "h5ad",
          description:
            "AnnData with UMAP coordinates in .obsm['X_umap'] and neighbor graph in .uns['neighbors']",
          required: true,
        },
        {
          name: "umap_report.json",
          format: "json",
          description:
            "UMAP embedding report with trustworthiness, parameter summary, and convergence diagnostics",
          required: true,
        },
        {
          name: "umap_coords.json",
          format: "json",
          description:
            "UMAP 2D coordinates for external visualization tools (CSV-compatible)",
          required: false,
        },
      ],
      visualizations: [
        {
          type: "scatter",
          description:
            "UMAP 2D scatter plot colored by metadata (cluster, batch, or marker gene expression)",
        },
      ],
      metrics: [
        { name: "n_cells", description: "Number of cells", unit: "cells" },
        { name: "n_neighbors", description: "Number of neighbors used" },
        { name: "n_pcs", description: "Number of PCs used" },
        { name: "min_dist", description: "UMAP min_dist parameter" },
        { name: "trustworthiness", description: "UMAP topology trustworthiness (0-1)" },
        { name: "n_neighbors_ratio", description: "Ratio of n_neighbors to n_cells" },
        { name: "embedding_std", description: "Standard deviation of UMAP coordinates" },
      ],
    },

    troubleshooting: {
      common_issues: [
        {
          symptom: "trustworthiness < 0.7",
          likely_cause:
            "UMAP parameters are suboptimal for this dataset, or PCA did not capture sufficient variation",
          diagnosis:
            "Check PCA variance explained. Adjust n_neighbors (fewer retains more local structure, more emphasizes global structure)",
          fix: "Adjust n_neighbors (lower for local, higher for global). Verify PCA uses sufficient PCs. Try n_pcs=50",
          severity: "warning",
        },
        {
          symptom: "embedding looks like a single blob",
          likely_cause:
            "No clear structure in data, min_dist too small, or all variation captured in one dimension",
          diagnosis:
            "Check if data has meaningful biological variation. Color UMAP by QC metrics and marker genes",
          fix: "Increase min_dist to 0.5-0.8. Check upstream QC and normalization",
          severity: "warning",
        },
        {
          symptom: "MemoryError during neighbor graph construction",
          likely_cause:
            "Too many cells (>200k) with too many neighbors causing quadratic memory usage",
          diagnosis:
            "Check dataset size. Nearest neighbor graph construction is O(n*k) in memory",
          fix: "Sub-sample cells for UMAP computation. Reduce n_neighbors. Use GPU-accelerated UMAP (cuml)",
          severity: "blocking",
        },
        {
          symptom: "No PCA coordinates found",
          likely_cause:
            "PCA was not computed before UMAP. Neighborhood graph requires PCA",
          diagnosis:
            "Check if 'X_pca' or 'X_pca_harmony' exists in adata.obsm",
          fix: "Run scrna-pca skill first. If batch correction was run, use corrected PCA",
          severity: "blocking",
        },
      ],
    },

    dependencies: {
      requires: ["scrna-pca"],
      recommends: ["batch-correction", "clustering"],
      conflicts: [],
    },

    resourceEstimate: {
      cpu: "4",
      ram: "10GB",
      disk: "2GB",
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
      errors.push("Input path is required (must point to a PCA-computed .h5ad file).");
      return { valid: false, errors, warnings };
    }

    if (!data.inputPath.toLowerCase().endsWith(".h5ad")) {
      errors.push(
        `Input must be an .h5ad file. Got: ${data.inputPath}. Run data-import, scrna-pca first.`,
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
      tool: "scanpy.pp.neighbors + scanpy.tl.umap",
      reason:
        "UMAP is the gold standard for scRNA-seq visualization — superior to tSNE in preserving global structure, enabling meaningful distance interpretation",
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
      n_neighbors: this.spec.parameters.defaults["n_neighbors"] ?? 15,
      n_pcs: this.spec.parameters.defaults["n_pcs"] ?? 30,
      min_dist: this.spec.parameters.defaults["min_dist"] ?? 0.3,
      spread: this.spec.parameters.defaults["spread"] ?? 1.0,
      method: this.spec.parameters.defaults["method"] ?? "umap",
      random_state: this.spec.parameters.defaults["random_state"] ?? 42,
    };
  }

  // -------------------------------------------------------------------------
  // ④ run
  // -------------------------------------------------------------------------

  async run(context: SkillContext): Promise<SkillExecResult> {
    const { inputPath, outputPath } = context.data;
    const nNeighbors = (context.params["n_neighbors"] as number) ?? 15;
    const nPcs = (context.params["n_pcs"] as number) ?? 30;
    const minDist = (context.params["min_dist"] as number) ?? 0.3;
    const spread = (context.params["spread"] as number) ?? 1.0;
    const method = (context.params["method"] as string) ?? "umap";
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

# Adaptive parameter tuning based on dataset size
n_neighbors_actual = ${nNeighbors}
min_dist_actual = ${minDist}

if n_cells < 500:
    # Small dataset: fewer neighbors for more local structure
    n_neighbors_actual = max(5, int(np.sqrt(n_cells) / 2))
    min_dist_actual = max(0.1, min_dist_actual * 0.7)
    print(f"Small dataset ({n_cells} cells): n_neighbors={n_neighbors_actual}, min_dist={min_dist_actual}")
elif n_cells > 100000:
    # Large dataset: more neighbors for global structure, larger min_dist
    n_neighbors_actual = min(50, ${nNeighbors} * 2)
    min_dist_actual = min(1.0, ${minDist} * 2)
    print(f"Large dataset ({n_cells} cells): n_neighbors={n_neighbors_actual}, min_dist={min_dist_actual}")

# Ensure PCA exists
if 'X_pca' not in adata.obsm:
    print("WARNING: PCA not found. Computing with default parameters...")
    sc.tl.pca(adata, n_comps=min(50, n_cells - 1))

# Determine which PCA representation to use
use_rep = 'X_pca'
if 'X_pca_harmony' in adata.obsm:
    use_rep = 'X_pca_harmony'
    print("Using Harmony-corrected PCA for neighbor graph")

# Actual n_pcs limited by available PCs
actual_n_pcs = min(${nPcs}, adata.obsm[use_rep].shape[1])
if actual_n_pcs < ${nPcs}:
    print(f"Only {actual_n_pcs} PCs available, using all")

# Build neighborhood graph
sc.pp.neighbors(
    adata,
    n_neighbors=n_neighbors_actual,
    n_pcs=actual_n_pcs,
    use_rep=use_rep,
    random_state=${randomState},
)

# Run embedding
if "${method}" == "tsne":
    sc.tl.tsne(
        adata,
        n_pcs=actual_n_pcs,
        use_rep=use_rep,
        random_state=${randomState},
    )
    embedding_key = 'X_tsne'
    print("Computed tSNE embedding")
else:
    sc.tl.umap(
        adata,
        min_dist=min_dist_actual,
        spread=${spread},
        random_state=${randomState},
    )
    embedding_key = 'X_umap'
    print("Computed UMAP embedding")

# Extract coordinates
coords = adata.obsm[embedding_key]
n_neighbors_ratio = round(n_neighbors_actual / n_cells, 4) if n_cells > 0 else 0

# Compute trustworthiness (simplified: check neighbor preservation between PCA and UMAP space)
def compute_trustworthiness(high_dim, low_dim, n_neighbors=10):
    """Simplified trustworthiness: fraction of kNN preserved from high-D to low-D.
    Trustworthiness = 1 - (unexpected neighbors in low-D) / (max possible).
    A score of 0.8 means 80% of neighbors are preserved."""
    from sklearn.neighbors import NearestNeighbors

    if hasattr(high_dim, 'toarray'):
        high_dim = high_dim.toarray()
    if hasattr(low_dim, 'toarray'):
        low_dim = low_dim.toarray()

    n = high_dim.shape[0]
    k = min(n_neighbors, n - 1)
    if k < 1:
        return 1.0

    # High-D neighbors
    nn_high = NearestNeighbors(n_neighbors=k + 1, metric='euclidean')
    nn_high.fit(high_dim)
    high_indices = nn_high.kneighbors(high_dim, return_distance=False)[:, 1:]

    # Low-D neighbors
    nn_low = NearestNeighbors(n_neighbors=k + 1, metric='euclidean')
    nn_low.fit(low_dim)
    low_indices = nn_low.kneighbors(low_dim, return_distance=False)[:, 1:]

    # Compute overlap
    overlap = 0
    for i in range(n):
        overlap += len(set(high_indices[i]) & set(low_indices[i]))
    max_overlap = n * k
    trust = overlap / max_overlap if max_overlap > 0 else 1.0

    return float(trust)

# Compute trustworthiness on a subset if dataset is large
n_sample = min(5000, n_cells)
if n_cells > 5000:
    idx = np.random.choice(n_cells, n_sample, replace=False)
    trust = compute_trustworthiness(
        adata.obsm[use_rep][idx],
        coords[idx],
        n_neighbors=min(10, n_sample - 1)
    )
else:
    trust = compute_trustworthiness(
        adata.obsm[use_rep],
        coords,
        n_neighbors=min(10, n_cells - 1)
    )

# Embedding statistics
embedding_std = round(float(np.std(coords)), 4)
coord_range = {
    "x_min": float(np.min(coords[:, 0])),
    "x_max": float(np.max(coords[:, 0])),
    "y_min": float(np.min(coords[:, 1])),
    "y_max": float(np.max(coords[:, 1])),
}

# Export UMAP coordinates
umap_coords = {
    "x": coords[:, 0].tolist(),
    "y": coords[:, 1].tolist(),
    "cell_barcodes": list(adata.obs_names),
}

# Build report
report = {
    "n_cells": int(n_cells),
    "n_neighbors": int(n_neighbors_actual),
    "n_pcs": int(actual_n_pcs),
    "min_dist": round(min_dist_actual, 3),
    "spread": ${spread},
    "method": "${method}",
    "embedding_key": embedding_key,
    "pca_rep_used": use_rep,
    "trustworthiness": round(trust, 4),
    "n_neighbors_ratio": float(n_neighbors_ratio),
    "embedding_std": float(embedding_std),
    "coord_range": coord_range,
    "random_state": ${randomState},
}

# Write outputs
with open(os.path.join(output_path, "umap_report.json"), "w") as f:
    json.dump(report, f, indent=2)

with open(os.path.join(output_path, "umap_coords.json"), "w") as f:
    json.dump(umap_coords, f)

output_file = os.path.join(output_path, "umap_embedding.h5ad")
adata.write(output_file)
print(f"Written: {output_file}")
print(f"Method: ${method}, n_neighbors={n_neighbors_actual}, min_dist={min_dist_actual}")
print(f"Trustworthiness: {trust:.4f}")
print(f"Embedding std: {embedding_std}")

print(json.dumps(report))
`.trim();

    const dockerResult = await this.execInContainer(context, pythonScript);

    const parsedData = this.parseJSONFromStdout(dockerResult.stdout);

    const metrics: Record<string, number> = {
      n_cells:
        typeof parsedData["n_cells"] === "number"
          ? (parsedData["n_cells"] as number)
          : 0,
      n_neighbors:
        typeof parsedData["n_neighbors"] === "number"
          ? (parsedData["n_neighbors"] as number)
          : 15,
      n_pcs:
        typeof parsedData["n_pcs"] === "number"
          ? (parsedData["n_pcs"] as number)
          : 30,
      min_dist:
        typeof parsedData["min_dist"] === "number"
          ? (parsedData["min_dist"] as number)
          : 0.3,
      trustworthiness:
        typeof parsedData["trustworthiness"] === "number"
          ? (parsedData["trustworthiness"] as number)
          : 0,
      n_neighbors_ratio:
        typeof parsedData["n_neighbors_ratio"] === "number"
          ? (parsedData["n_neighbors_ratio"] as number)
          : 0,
      embedding_std:
        typeof parsedData["embedding_std"] === "number"
          ? (parsedData["embedding_std"] as number)
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

    const method = (results.parsedData["method"] as string) ?? "umap";
    const nCells = results.metrics["n_cells"] ?? 0;
    const nNeighbors = results.metrics["n_neighbors"] ?? 0;
    const trust = results.metrics["trustworthiness"] ?? 0;
    const stdEmbed = results.metrics["embedding_std"] ?? 0;
    const repUsed = (results.parsedData["pca_rep_used"] as string) ?? "X_pca";

    logs.push(
      `${method.toUpperCase()}: ${nCells} cells, n_neighbors=${nNeighbors}, PCA from ${repUsed}`,
    );
    logs.push(
      `Trustworthiness: ${trust.toFixed(4)}, Embedding std: ${stdEmbed.toFixed(4)}`,
    );
    logs.push(
      `QC overall: ${qc.overall} (${qc.passed}P/${qc.warned}W/${qc.failed}F)`,
    );

    if (trust < 0.8) {
      logs.push(
        "WARNING: Low trustworthiness may indicate embedding distortion. Consider parameter tuning.",
      );
    }

    return {
      files: [
        {
          path: `${results.parsedData["output_path"] ?? ""}/umap_embedding.h5ad`,
          format: "h5ad",
          size_bytes: 0,
        },
        ...(results.exitCode === 0
          ? [
              {
                path: `${results.parsedData["output_path"] ?? ""}/umap_report.json`,
                format: "json",
                size_bytes: 0,
              },
              {
                path: `${results.parsedData["output_path"] ?? ""}/umap_coords.json`,
                format: "json",
                size_bytes: 0,
              },
            ]
          : []),
      ],
      metrics: {
        n_cells: nCells,
        n_neighbors: nNeighbors,
        n_pcs: results.metrics["n_pcs"],
        min_dist: results.metrics["min_dist"],
        method: method,
        pca_rep_used: repUsed,
        trustworthiness: trust,
        n_neighbors_ratio: results.metrics["n_neighbors_ratio"],
        embedding_std: stdEmbed,
      },
      logs,
    };
  }
}
