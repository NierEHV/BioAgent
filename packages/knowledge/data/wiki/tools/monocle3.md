---
title: Monocle3 使用指南
category: tools
tool: monocle3
language: R
omics: [scrna-seq, snRNA-seq]
updated: 2026-05-31
---

# Monocle3 使用指南

## 概述

Monocle3 是用于单细胞转录组拟时间轨迹分析的 R 包。
它学习细胞间的树形拓扑结构，将细胞排列在拟时间轴上。

- **版本**: ≥ 1.3
- **作者**: Cole Trapnell Lab
- **安装**: `BiocManager::install("monocle3")`

## 输入格式

- **cell_data_set (cds)** 对象
- 可从 Seurat 对象转换: `as.cell_data_set(seurat_obj)`
- 可从 Scanpy h5ad 转换: `load_cell_data_set("file.h5ad")`

## 标准流程

```r
library(monocle3)

# 1. 加载数据
cds <- load_cell_data_set("input.h5ad")

# 2. 预处理
cds <- preprocess_cds(cds, num_dim = 50)

# 3. 降维
cds <- reduce_dimension(cds, reduction_method = "UMAP")

# 4. 聚类
cds <- cluster_cells(cds, resolution = 1e-4)

# 5. 学习轨迹图
cds <- learn_graph(cds)

# 6. 排序细胞
cds <- order_cells(cds)

# 7. 可视化
plot_cells(cds, color_cells_by = "pseudotime")
```

## 关键参数

| 参数 | 默认值 | 建议 |
|------|--------|------|
| `num_dim` | 50 | PCA 维度数，数据量大时增加到 100 |
| `resolution` | 1e-4 | 聚类分辨率，越小聚类越多 |
| `reduction_method` | "UMAP" | 也可选 "tSNE" |

## 局限性

- 假定**树形拓扑**，不适用于循环过程
- 需要**手动指定根节点**（起始细胞）
- 对低质量细胞敏感

## Docker 使用

```bash
docker run --rm -v /data:/data rnakato/shortcake_full:latest \
  Rscript -e 'library(monocle3); ...'
```
