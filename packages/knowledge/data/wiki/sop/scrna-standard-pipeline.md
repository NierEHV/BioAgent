---
title: "Standard scRNA-seq Analysis SOP"
topic: "sop.scrna-standard"
version: 1
updated: 2026-05-31
sources:
  - doi: "10.15252/msb.20188746"
  - doi: "10.1038/s41576-023-00586-w"
tags: [sop, pipeline, standard, workflow, production]
related:
  - omics/scrna-seq/overview.md
  - omics/scrna-seq/qc-best-practices.md
  - omics/scrna-seq/normalization-methods.md
  - tools/scanpy.md
confidence: high
---

# Standard scRNA-seq Analysis SOP

This Standard Operating Procedure defines the BioAgent default pipeline for scRNA-seq analysis. It is the basis for the `scrna-seq-standard` workflow.

## Prerequisites

- Input: 10x Genomics `filtered_feature_bc_matrix/` directory or `.h5ad` file
- Docker image: `rnakato/shortcake_full:latest`
- Minimum: 500 cells, 2 samples recommended
- Hardware: 16 GB RAM minimum, 32 GB recommended

## Pipeline Steps

### Phase 1: Data Loading & Initial QC

**Decision gate:** Data format detection (`.h5ad`, `.h5`, `.mtx`)

```python
import scanpy as sc
import scrublet as scr

# Load data
adata = sc.read_10x_mtx('filtered_feature_bc_matrix/', var_names='gene_symbols', cache=True)
adata.var_names_make_unique()

# Initial gene filtering
sc.pp.filter_genes(adata, min_cells=3)

# MT% and QC metrics
adata.var['mt'] = adata.var_names.str.startswith('MT-')
adata.var['ribo'] = adata.var_names.str.startswith(('RPS', 'RPL'))
sc.pp.calculate_qc_metrics(adata, qc_vars=['mt', 'ribo'], percent_top=None, inplace=True)
```

**QC thresholds:**
- n_genes: 200 - 6000 (adjust max per tissue)
- pct_counts_mt: < 20%
- Doublet detection: Scrublet with `expected_doublet_rate=0.06`

### Phase 2: Normalization & HVG Selection

**Decision gate:** Cell count > 50k?

```python
# Normalization
sc.pp.normalize_total(adata, target_sum=1e4)
sc.pp.log1p(adata)

# Store raw counts
adata.raw = adata.copy()

# HVG selection
sc.pp.highly_variable_genes(adata, n_top_genes=2000, flavor='seurat_v3', batch_key='sample')
adata = adata[:, adata.var.highly_variable]
```

### Phase 3: Dimensionality Reduction

```python
# Scale to unit variance (clips values exceeding 10 SD)
sc.pp.scale(adata, max_value=10)

# PCA
sc.tl.pca(adata, n_comps=50, svd_solver='arpack')

# Determine optimal PCs from elbow plot
sc.pl.pca_variance_ratio(adata, n_pcs=50, log=True)
```

**Decision gate:** n_pcs determined by elbow (typically 20-40)

### Phase 4: Batch Correction (If Multi-Sample)

```python
# Only run if multiple batches present
if adata.obs['sample'].nunique() > 1:
    sc.external.pp.harmony_integrate(adata, key='sample', max_iter_harmony=20)
    use_rep = 'X_pca_harmony'
else:
    use_rep = 'X_pca'
```

### Phase 5: Clustering

```python
# Build graph and cluster
sc.pp.neighbors(adata, n_neighbors=15, n_pcs=30, use_rep=use_rep)
sc.tl.umap(adata, min_dist=0.3, spread=1.0)

# Resolution sweep
for res in [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0]:
    sc.tl.leiden(adata, resolution=res, key_added=f'leiden_{res}')

# Default: use 0.8; allow user to adjust
adata.obs['leiden'] = adata.obs['leiden_0.8']
```

**QC gate:** Number of clusters between 5 and 50. If outside range, warn and recommend resolution adjustment.

### Phase 6: Cell Annotation

```python
import celltypist
from celltypist import models

# Automated annotation
models.download_models(model='Human_Immune', force_update=False)
predictions = celltypist.annotate(adata, model='Human_Immune', majority_voting=True)
adata.obs['cell_type'] = predictions.predicted_labels['majority_voting']

# Low confidence to 'Uncertain'
low_mask = predictions.predicted_labels['conf_score'] < 0.5
adata.obs.loc[low_mask, 'cell_type'] = 'Uncertain'
```

**QC gate:** < 30% uncertain cells. If higher, flag for manual review.

### Phase 7: Marker Detection & DE

```python
# Cluster markers
sc.tl.rank_genes_groups(adata, groupby='leiden', method='wilcoxon', n_genes=100)

# Cell type markers (for manual validation)
sc.tl.rank_genes_groups(adata, groupby='cell_type', method='wilcoxon', n_genes=50)
```

**QC gate:** Each cluster must have at least 5 significant markers (p_adj < 0.05, logFC > 1). Clusters failing this are flagged as potentially low-quality.

### Phase 8: Output Generation

```python
# Save processed data
adata.write_h5ad('processed.h5ad')

# Generate summary report
summary = {
    'n_cells_after_qc': adata.n_obs,
    'n_genes_after_filtering': adata.n_vars,
    'n_clusters': adata.obs['leiden'].nunique(),
    'cell_type_counts': adata.obs['cell_type'].value_counts().to_dict(),
    'n_uncertain': (adata.obs['cell_type'] == 'Uncertain').sum(),
}

# QC visualizations
sc.pl.umap(adata, color=['cell_type', 'leiden', 'sample', 'pct_counts_mt'], save='_summary.png')
sc.pl.dotplot(adata, var_names=adata.uns['rank_genes_groups']['names'][adata.obs['cell_type'].cat.categories[0]], groupby='cell_type', save='_markers.png')
```

## Quality Gates Summary

| Gate | Step | Criterion | Action on Fail |
|------|------|-----------|----------------|
| QC1 | Cell filtering | > 50% cells retained | Adjust thresholds if < 50% |
| QC2 | Doublet removal | 3-10% doublets removed | Too high: check Scrublet params |
| QC3 | Clustering | 5-50 clusters | Outside range: adjust resolution |
| QC4 | Annotation | < 30% uncertain | Flag for manual review |
| QC5 | Marker detection | >= 5 markers per cluster | Clusters without markers are suspect |
| QC6 | Batch effect | ASW per batch > 0 | If significant, re-run integration |

## Expected Runtime

| Dataset Size | Estimated Time (32 GB RAM, 8 cores) |
|-------------|--------------------------------------|
| 5,000 cells | ~10 minutes |
| 20,000 cells | ~25 minutes |
| 50,000 cells | ~45 minutes |
| 100,000 cells | ~90 minutes |
| 200,000+ cells | 3-6 hours (consider downsampling) |

## Docker Execution

The entire SOP is executed inside the ShortCake container:

```bash
docker run --rm \
  -v $(pwd)/data:/data \
  -v $(pwd)/output:/output \
  rnakato/shortcake_full:latest \
  python /data/run_pipeline.py --input /data/input.h5ad --output /output
```
