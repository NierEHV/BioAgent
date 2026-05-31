---
title: "Scanpy Best Practices & Usage Guide"
topic: "tools.scanpy"
version: 1
updated: 2026-05-31
sources:
  - url: "https://scanpy.readthedocs.io/"
  - doi: "10.1186/s13059-017-1382-0"
tags: [scanpy, python, toolkit, api]
related:
  - omics/scrna-seq/overview.md
  - omics/scrna-seq/qc-best-practices.md
  - omics/scrna-seq/clustering-guide.md
  - tools/seurat.md
  - sop/scrna-standard-pipeline.md
confidence: high
---

# Scanpy Best Practices & Usage Guide

[Scanpy](https://scanpy.readthedocs.io/) (Wolf et al. 2018) is the primary Python toolkit for single-cell RNA-seq analysis. It handles AnnData objects with integrated visualization.

## Installation & Docker

Scanpy is included in the `rnakato/shortcake_full:latest` Docker image (Python 3.11, Scanpy 1.10.x). No local installation needed.

**Inside Docker container:**
```bash
docker run -it --rm rnakato/shortcake_full:latest python -c "import scanpy; print(scanpy.__version__)"
```

## Core API Summary

### Data I/O
```python
import scanpy as sc

# Read 10x data
adata = sc.read_10x_mtx('filtered_feature_bc_matrix/')
# Read AnnData
adata = sc.read_h5ad('data.h5ad')
# Write AnnData
adata.write_h5ad('processed.h5ad')
```

### Preprocessing
```python
# QC filtering
sc.pp.filter_cells(adata, min_genes=200)
sc.pp.filter_genes(adata, min_cells=3)
adata = adata[adata.obs.pct_counts_mt < 20, :]

# Normalization
sc.pp.normalize_total(adata, target_sum=1e4)
sc.pp.log1p(adata)

# HVG selection
sc.pp.highly_variable_genes(adata, n_top_genes=2000, flavor='seurat_v3')
adata = adata[:, adata.var.highly_variable]

# PCA
sc.tl.pca(adata, n_comps=50, svd_solver='arpack')
```

### Integration & Clustering
```python
# Batch correction with Harmony
sc.external.pp.harmony_integrate(adata, key='batch')

# Build neighborhood graph
sc.pp.neighbors(adata, n_neighbors=15, n_pcs=30)

# UMAP
sc.tl.umap(adata, min_dist=0.3, spread=1.0)

# Clustering
sc.tl.leiden(adata, resolution=0.8)
```

### Differential Expression
```python
# Rank genes per cluster
sc.tl.rank_genes_groups(adata, groupby='leiden', method='wilcoxon')
sc.pl.rank_genes_groups_dotplot(adata, n_genes=4)

# Filter to significant markers
result = adata.uns['rank_genes_groups']
markers = {}
for group in result['names'].dtype.names:
    genes = result['names'][group]
    pvals = result['pvals_adj'][group]
    logfcs = result['logfoldchanges'][group]
    sig = genes[(pvals < 0.05) & (logfcs > 1.0)]
    markers[group] = sig.tolist()
```

## Key Parameter Recommendations

| Function | Parameter | Recommended Value | Notes |
|----------|-----------|-------------------|-------|
| `filter_cells` | min_genes | 200 | Adjust per tissue |
| `filter_cells` | max_genes | 6000 | Use MAD-based for robustness |
| `normalize_total` | target_sum | 1e4 (10,000) | Default CPM |
| `highly_variable_genes` | n_top_genes | 2000 | Standard for most analyses |
| `highly_variable_genes` | flavor | `'seurat_v3'` | Better variance stabilization |
| `pca` | n_comps | 50 | Use elbow plot to refine |
| `pca` | svd_solver | `'arpack'` | More stable for scRNA-seq |
| `neighbors` | n_neighbors | 15 | 10-30 range |
| `neighbors` | n_pcs | 30 | Based on variance explained |
| `umap` | min_dist | 0.3 | Lower = tighter clusters |
| `leiden` | resolution | 0.8 | Sweep 0.2-2.0 |

## Memory Management

Scanpy operations on large datasets (>100k cells) can be memory-intensive. Tips:

```python
# Use sparse matrices
adata.X = scipy.sparse.csr_matrix(adata.X)

# Layer-based workflow (keep raw counts separate)
adata.raw = adata.copy()

# In-memory subsetting before heavy operations
adata_sub = adata[adata.obs.sample == 'sample1', :].copy()
```

## Integration with Other Tools

- **scVI:** `scvi.model.SCVI` — use `adata.obsm['X_scVI']` as PCA replacement
- **CellTypist:** `celltypist.annotate(adata)` — direct AnnData support
- **scVelo:** `scv.pp.moments(adata)` — requires spliced/unspliced layers
- **cellxgene:** `sc.write('data.cxg', adata)` — export for interactive exploration

## Common Errors & Fixes

1. **`KeyError: 'X_pca'`** — forgot to run `sc.tl.pca()` before neighbors
2. **MemoryError on large data** — convert to sparse matrix; subset to HVGs first
3. **`ValueError: zero-size array`** — all cells failed QC; relax thresholds
4. **UMAP with no structure** — check that PCA captured variance; may need batch correction first
