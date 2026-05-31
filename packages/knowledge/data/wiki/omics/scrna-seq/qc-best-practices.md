---
title: "Single-Cell RNA-seq QC Best Practices"
topic: "scrna-seq.qc"
version: 1
updated: 2026-05-31
sources:
  - doi: "10.15252/msb.20188746"
  - doi: "10.1038/s41576-023-00586-w"
tags: [qc, quality-control, filtering, doublets, mitochondrial]
related:
  - omics/scrna-seq/overview.md
  - tools/scanpy.md
confidence: high
---

# scRNA-seq Quality Control Best Practices

Quality control is the most critical step in scRNA-seq analysis. Poor QC leads to spurious clusters, false differential expression, and unreproducible results.

## Three Primary QC Metrics

### 1. Number of Detected Genes per Cell (n_gene)

- **Low-quality cells:** fewer than 200-500 genes detected (likely empty droplets or dead cells)
- **Doublets:** abnormally high gene counts (> 6000, but tissue-dependent)
- **Action:** Filter cells outside [200, 6000] range; adjust upper bound per tissue type

```python
# Scanpy
sc.pp.filter_cells(adata, min_genes=200)
sc.pp.filter_cells(adata, max_genes=6000)  # adjust per tissue
```

### 2. Total UMI Counts (n_counts)

- **Low UMI:** insufficient sequencing depth; threshold typically 500-1000 UMIs
- **High UMI:** potential doublets or ambient RNA contamination
- **Best practice:** Use MAD (median absolute deviation) based thresholds — 5 MADs below/above median

```python
import numpy as np

def mad_threshold(adata, metric, n_mads=5):
    """Filter cells using median absolute deviation."""
    values = adata.obs[metric].values
    median = np.median(values)
    mad = np.median(np.abs(values - median))
    lower = median - n_mads * mad
    upper = median + n_mads * mad
    return (values > lower) & (values < upper)
```

### 3. Mitochondrial Gene Percentage (pct_MT)

- **Standard cutoff:** < 20% for most tissues
- **Exceptions:** Cardiac tissue (up to 30%), kidney proximal tubule (up to 25%)
- **Warning:** Always inspect MT% distribution before applying a hard cutoff

```python
# Calculate MT percentage
adata.var['mt'] = adata.var_names.str.startswith('MT-')
sc.pp.calculate_qc_metrics(adata, qc_vars=['mt'], percent_top=None, log1p=False, inplace=True)
adata = adata[adata.obs.pct_counts_mt < 20, :]
```

## Doublet Detection

Doublets (two cells captured in one droplet) confound clustering and must be removed early.

- **Scrublet:** Run before filtering, `expected_doublet_rate=0.06` for standard 10x
- **DoubletFinder:** pK identification step required; use per-sample
- **Concordance approach:** Run 2 methods, keep cells flagged by both

```python
import scrublet as scr
scrub = scr.Scrublet(adata.X.todense())
doublet_scores, predicted_doublets = scrub.scrub_doublets()
adata.obs['doublet_score'] = doublet_scores
adata = adata[~predicted_doublets, :]
```

## Gene-Level Filtering

- Remove genes expressed in fewer than 3 cells
- Remove ribosomal protein genes (RP*) if they dominate variance
- Remove MALAT1 and other lncRNAs that reflect technical noise

```python
sc.pp.filter_genes(adata, min_cells=3)
```

## Common Pitfalls

1. **Applying uniform thresholds across tissues** — heart and kidney need higher MT% tolerance
2. **Filtering after normalization** — always filter before normalization to avoid artifacts
3. **Over-filtering** — removing too many cells can remove rare but real cell populations; inspect distribution plots before filtering
4. **Ignoring ambient RNA** — use CellBender or SoupX to remove background contamination before QC

## Validation Checklist

- [ ] MT% distribution visualized (violin plot per sample)
- [ ] n_gene vs n_counts scatter plot shows expected log-linear relationship
- [ ] Doublet scores checked (histogram with clear bimodal distribution)
- [ ] Post-QC cell count within expected range (70-90% retention)
