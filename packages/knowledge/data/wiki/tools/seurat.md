---
title: "Seurat Usage Guide for scRNA-seq"
topic: "tools.seurat"
version: 1
updated: 2026-05-31
sources:
  - url: "https://satijalab.org/seurat/"
  - doi: "10.1016/j.cell.2021.04.048"
tags: [seurat, r, toolkit, preprocessing, integration]
related:
  - omics/scrna-seq/overview.md
  - omics/scrna-seq/normalization-methods.md
  - tools/scanpy.md
  - sop/scrna-standard-pipeline.md
confidence: high
---

# Seurat Usage Guide for scRNA-seq

[Seurat](https://satijalab.org/seurat/) (Hao et al. 2021, v5) is the leading R toolkit for single-cell analysis, particularly strong in data integration and multimodal analysis.

## Installation & Docker

Seurat is available in `bontix77/sc_rna:latest` and `rnakato/shortcake_full:latest`.

```r
# Verify Seurat installation inside container
library(Seurat)
packageVersion("Seurat")  # Should be >= 5.0
```

## Core Workflow

### 1. Create Seurat Object
```r
library(Seurat)

# From 10x data
counts <- Read10X("filtered_feature_bc_matrix/")
obj <- CreateSeuratObject(counts = counts, project = "project_name",
                          min.cells = 3, min.features = 200)
```

### 2. QC & Filtering
```r
# Calculate QC metrics
obj[["percent.mt"]] <- PercentageFeatureSet(obj, pattern = "^MT-")
obj[["percent.ribo"]] <- PercentageFeatureSet(obj, pattern = "^RP[SL]")

# Filter
obj <- subset(obj, subset = nFeature_RNA > 200 & nFeature_RNA < 6000 & percent.mt < 20)

# Visualize
VlnPlot(obj, features = c("nFeature_RNA", "nCount_RNA", "percent.mt"), ncol = 3)
FeatureScatter(obj, feature1 = "nCount_RNA", feature2 = "nFeature_RNA")
```

### 3. Normalization & HVG
```r
# Option A: Standard log-normalize
obj <- NormalizeData(obj, normalization.method = "LogNormalize", scale.factor = 10000)
obj <- FindVariableFeatures(obj, selection.method = "vst", nfeatures = 2000)
obj <- ScaleData(obj, vars.to.regress = c("percent.mt"))

# Option B: SCTranform (preferred for large datasets)
obj <- SCTransform(obj, vst.flavor = "v2", vars.to.regress = c("percent.mt"))
```

### 4. Dimensionality Reduction
```r
obj <- RunPCA(obj, npcs = 50, features = VariableFeatures(obj))
ElbowPlot(obj, ndims = 50)  # Choose PCs

obj <- RunUMAP(obj, dims = 1:30, min.dist = 0.3, spread = 1)
obj <- FindNeighbors(obj, dims = 1:30)

# Clustering (Leiden)
obj <- FindClusters(obj, resolution = 0.8, algorithm = 4)  # algorithm=4 is Leiden
```

### 5. Integration (Multiple Samples)
```r
# Split by sample, SCTranform each, then integrate
obj.list <- SplitObject(obj, split.by = "sample")
obj.list <- lapply(obj.list, SCTransform)

# Select integration features
features <- SelectIntegrationFeatures(object.list = obj.list, nfeatures = 3000)
obj.list <- PrepSCTIntegration(object.list = obj.list, anchor.features = features)

# Find anchors and integrate
anchors <- FindIntegrationAnchors(object.list = obj.list,
                                   normalization.method = "SCT",
                                   anchor.features = features)
obj.integrated <- IntegrateData(anchorset = anchors, normalization.method = "SCT")
```

### 6. Differential Expression
```r
# Find cluster markers
markers <- FindAllMarkers(obj, only.pos = TRUE, min.pct = 0.25,
                          logfc.threshold = 0.25, test.use = "wilcox")

# Top markers per cluster
top5 <- markers %>% group_by(cluster) %>% top_n(n = 5, wt = avg_log2FC)
```

## Key Differences: Seurat v4 vs. v5

| Feature | v4 | v5 |
|---------|----|----|
| Normalization | SCTransform v1 | SCTransform v2 (glmGamPoi) |
| Integration | CCA-based | CCA or Harmony via `RunHarmony()` |
| Layers | `@assays$RNA@counts` | `@layers$counts` |
| DIM reduction | `@reductions` | `@reductions` (same) |
| Multi-modal | Bridge integration | `FindMultiModalNeighbors` |

## Common Parameter Recommendations

| Function | Parameter | Recommended | Notes |
|----------|-----------|-------------|-------|
| `CreateSeuratObject` | min.features | 200 | Cells must express >=200 genes |
| `SCTransform` | vst.flavor | `"v2"` | Uses glmGamPoi |
| `FindVariableFeatures` | nfeatures | 2000 | Default is sufficient |
| `RunPCA` | npcs | 50 | Use elbow plot to refine |
| `FindNeighbors` | dims | 1:30 | Based on elbow |
| `FindClusters` | resolution | 0.8 | Sweep 0.2-2.0 |
| `FindAllMarkers` | only.pos | TRUE | Positive markers only |
| `FindAllMarkers` | min.pct | 0.25 | Expressed in >=25% cells in cluster |

## Common Errors & Fixes

1. **`Error: cannot find "counts"`** — Seurat v5 changed `@assays$RNA@counts` to `Layers(obj, assay="RNA")`
2. **Memory crash on large integration** — Use `cca` reduction with `dims=1:30` (not 1:50)
3. **SCTransform fails** — Install `glmGamPoi` for v2 speed improvements
4. **Slow FindAllMarkers** — Set `test.use = "wilcox"` (fastest); avoid `test.use = "negbinom"`
5. **No UMAP structure** — Too many PCs used in dims; stick to elbow recommendation
