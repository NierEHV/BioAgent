---
title: "scRNA-seq Analysis Workflow Overview"
topic: "scrna-seq"
version: 1
updated: 2026-05-31
sources:
  - doi: "10.15252/msb.20188746"
  - doi: "10.1038/s41576-023-00586-w"
tags: [scrna-seq, overview, workflow, pipeline]
related:
  - tools/scanpy.md
  - tools/seurat.md
  - sop/scrna-standard-pipeline.md
confidence: high
---

# scRNA-seq Analysis Workflow Overview

This document outlines the standard workflow for single-cell RNA-seq data analysis, from raw count matrices to biological interpretation.

## Standard Pipeline Steps

1. **Data Import** — Load 10x Genomics `matrix.mtx`, `barcodes.tsv`, `features.tsv` or `.h5ad` (AnnData) files. For Seurat users, `.rds` or `.h5seurat` formats.
2. **Quality Control** — Filter low-quality cells (high MT%, low gene count, high doublet scores) and low-expression genes.
3. **Normalization** — Correct for library size and sequencing depth differences.
4. **Highly Variable Gene Selection** — Identify informative genes that capture biological heterogeneity.
5. **Dimensionality Reduction** — PCA to reduce noise and accelerate downstream computations.
6. **Batch Correction** (if needed) — Integrate samples/conditions using Harmony, scVI, or BBKNN.
7. **Clustering** — Group cells by expression similarity using Leiden/Louvain algorithms.
8. **Cell Annotation** — Assign cell type labels using marker genes, reference atlases, or machine learning.
9. **Differential Expression** — Compare clusters or conditions to find marker genes.
10. **Downstream Analysis** — Trajectory inference, cell communication, gene regulatory network analysis.

## Technology Choices

| Step | Primary Tool | Alternative |
|------|-------------|-------------|
| QC | Scanpy `sc.pp.filter_cells` | Seurat `PercentageFeatureSet` |
| Normalization | scran / SCTranform | LogNormalize |
| HVG | `seurat_v3` flavor | `cell_ranger` flavor |
| PCA | `sc.tl.pca` | `irlba` in R |
| Batch Correction | Harmony | scVI, BBKNN |
| Clustering | Leiden (resolution 0.8) | Louvain |
| Annotation | CellTypist | SingleR, manual |
| DE | Wilcoxon rank-sum | MAST, DESeq2 |

## Minimum Cell/Feature Thresholds

- **Cells:** Minimum 200 genes detected; maximum 6000 genes (adjust per tissue)
- **Genes:** Expressed in at least 3 cells
- **MT%:** < 20% for most tissues; < 30% for cardiac/kidney
- **UMI counts:** Use MAD-based outlier detection rather than fixed thresholds

## Expected Output Structure

```
project/
  raw/          — raw count matrices
  filtered/     — QC-passed AnnData
  normalized/   — normalized AnnData
  clustered/    — AnnData with cluster labels
  annotated/    — AnnData with cell type labels
  results/      — DE tables, marker lists, figures
  reports/      — HTML analysis report
```

The entire pipeline can be executed in a single Docker container using `rnakato/shortcake_full:latest`, which includes all tools listed above.
