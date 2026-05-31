---
title: "scRNA-seq Normalization Methods Comparison"
topic: "scrna-seq.normalization"
version: 1
updated: 2026-05-31
sources:
  - doi: "10.1038/s41576-023-00586-w"
  - doi: "10.1186/s13059-019-1874-1"
tags: [normalization, sctransform, scran, log-normalize, preprocessing]
related:
  - omics/scrna-seq/overview.md
  - omics/scrna-seq/qc-best-practices.md
confidence: high
---

# scRNA-seq Normalization Methods

Normalization corrects for differences in sequencing depth and library size between cells. Choosing the right method impacts all downstream analysis.

## Method Comparison

| Method | Type | Strengths | Weaknesses | Best For |
|--------|------|-----------|------------|----------|
| **Log-normalize** | Library-size | Simple, fast, widely understood | Does not handle zero-inflation well | Quick exploration |
| **scran** | Pool-based | Better variance stabilization | Requires clustering first | Medium datasets |
| **SCTranform** | Regularized NB regression | Handles zero-inflation, returns Pearson residuals | Memory intensive | Large datasets (>10k cells) |
| **SCnorm** | Quantile-based | Robust to varying sequencing depth | Assumes most genes not DE | Small datasets |
| **TF-IDF** | Frequency-based | Good for ATAC-seq and CITE-seq | Not ideal for RNA counts | Multi-modal data |

## Log-Normalize (CPM + log1p)

The most common approach. Simple but can leave depth-dependent artifacts.

```python
# Scanpy
sc.pp.normalize_total(adata, target_sum=1e4)  # CPM
sc.pp.log1p(adata)  # log(CPM + 1)
```

```r
# Seurat
obj <- NormalizeData(obj, normalization.method = "LogNormalize", scale.factor = 10000)
```

## scran (Pool-Based Deconvolution)

Uses pools of cells to estimate size factors. More statistically rigorous than simple library-size normalization.

```python
# Requires R via rpy2 or direct R execution
# In R:
library(scran)
sce <- computeSumFactors(sce, clusters = quickCluster(sce))
sce <- logNormCounts(sce)
```

**Note:** scran requires preliminary clustering (e.g., `quickCluster`), which adds computational overhead. Use the `min.mean=0.1` parameter to filter low-abundance genes from pool computation.

## SCTranform (Hafemeister & Satija 2019)

Regularized negative binomial regression that models the mean-variance relationship. Returns Pearson residuals that can be used directly for PCA.

```r
# Seurat v5
obj <- SCTransform(obj, vst.flavor = "v2", vars.to.regress = c("percent.mt"))
```

SCTranform v2 uses the `glmGamPoi` package for faster computation. Always regress out mitochondrial percentage and cell cycle scores if they are confounders.

## Which Method to Choose?

**Decision tree:**

```
Is dataset > 50k cells?
  YES → Use SCTranform v2 (glmGamPoi)
  NO → Is statistical rigor critical?
    YES → Use scran
    NO → Use log-normalize
```

## Validation

After normalization, verify:
1. Library size effects are removed (plot nUMI vs normalized expression of housekeeping genes — should be flat)
2. Gene variance is independent of mean expression (inspect mean-variance plot)
3. PCA is driven by biology, not depth (color PCA by nUMI — no gradient should be visible)

## Common Pitfalls

- **Normalizing before QC** — dead/dying cells distort normalization factors
- **Using CPM on UMI data** — UMI data does not need gene length correction
- **Over-normalizing** — regressing out too many variables removes biological signal
- **Not subsetting HVGs before normalization** — computational waste on noisy genes
