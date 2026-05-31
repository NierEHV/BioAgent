---
title: "scRNA-seq Clustering Parameter Selection & Evaluation"
topic: "scrna-seq.clustering"
version: 1
updated: 2026-05-31
sources:
  - doi: "10.15252/msb.20188746"
  - doi: "10.1038/s41576-023-00586-w"
tags: [clustering, leiden, louvain, resolution, evaluation]
related:
  - omics/scrna-seq/overview.md
  - omics/scrna-seq/cell-annotation.md
  - tools/scanpy.md
confidence: high
---

# scRNA-seq Clustering Parameter Selection & Evaluation

Clustering groups cells by transcriptomic similarity. Parameter choices strongly influence the number and quality of clusters.

## Algorithm Selection: Leiden vs. Louvain

**Use Leiden** (Traag et al. 2019). It fixes the disconnected community problem in Louvain and is faster.

```python
# Scanpy with Leiden
sc.tl.leiden(adata, resolution=0.8, random_state=42)
```

Key parameters:
- `resolution`: Controls cluster granularity (0.2 = few clusters, 2.0 = many clusters)
- `random_state`: For reproducibility
- `n_iterations`: Default -1 (run until convergence)

## Resolution Selection

| Resolution | Typical Cluster Count (10k PBMCs) | Use Case |
|------------|----------------------------------|----------|
| 0.2 | 3-5 | Broad lineages only |
| 0.5 | 6-10 | Major cell types |
| 0.8 | 10-15 | Standard granularity |
| 1.2 | 15-20 | Fine subtypes |
| 2.0 | 25+ | Very fine (may over-split) |

### Resolution Selection Strategy

Run a resolution sweep and pick the value where:
1. Silhouette score is maximized
2. Cluster count stabilizes (derivative of cluster count vs. resolution is minimal)
3. Known marker genes cleanly separate clusters

```python
import scanpy as sc
from sklearn.metrics import silhouette_score

def sweep_resolution(adata, resolutions, use_rep='X_pca'):
    """Sweep Leiden resolution and return scores."""
    results = {}
    for res in resolutions:
        sc.tl.leiden(adata, resolution=res, key_added=f'leiden_{res}')
        score = silhouette_score(
            adata.obsm[use_rep],
            adata.obs[f'leiden_{res}']
        )
        results[res] = score
    return results
```

## KNN Graph Construction

Before clustering, build a k-nearest neighbors graph on PCA space.

```python
# Recommended parameters
sc.pp.neighbors(
    adata,
    n_neighbors=15,          # 10-30; higher = coarser structure
    n_pcs=30,                # usually 15-50 PCs
    metric='euclidean',      # or 'cosine' for large datasets
    random_state=42
)
```

**n_neighbors:** Use 15 for standard datasets. Increase to 30 for large heterogeneous datasets. Decrease to 10 for small homogeneous datasets.

**n_pcs:** Include PCs that explain 90% of variance. Typically 20-40 PCs for scRNA-seq. Check the elbow plot.

## Evaluation Metrics

### 1. Silhouette Score
Measures how similar cells are to their own cluster vs. other clusters. Range [-1, 1], higher is better.

### 2. Average Silhouette Width (ASW)
For batch-corrected data, ASW per batch compares cluster purity across batches.

### 3. Marker Gene Validation
Check that each cluster has clear, statistically significant marker genes.

```python
# Find markers for each cluster
sc.tl.rank_genes_groups(adata, groupby='leiden', method='wilcoxon', n_genes=50)

# Check top markers
sc.pl.rank_genes_groups_dotplot(adata, n_genes=4)
```

### 4. Dendrogram Inspection
Cluster similarity dendrograms help identify over-splitting.

```python
sc.tl.dendrogram(adata, groupby='leiden')
sc.pl.dendrogram(adata, groupby='leiden')
```

## Common Pitfalls

1. **Too few PCs** — missing biological signal; use elbow plot to determine
2. **Too many PCs** — including noisy dimensions; use `sc.pl.pca_variance_ratio` to check
3. **Default resolution** — 1.0 is not always optimal; always sweep
4. **Clustering on uncorrected data** — batch effects drive clustering instead of biology
5. **Over-interpreting small clusters** — clusters with <30 cells may be doublet artifacts

## Reproducibility Checklist

- [ ] Random seed set for all steps
- [ ] Resolution sweep performed and documented
- [ ] PCA elbow plot generated
- [ ] Silhouette scores calculated
- [ ] Cluster markers validated against known biology
- [ ] UMAP colored by cluster, sample, and key QC metrics
