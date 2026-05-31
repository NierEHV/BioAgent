---
title: 拟时间轨迹分析指南
topic: scrna-seq.trajectory-analysis
category: omics
omics: scrna-seq
tags: [trajectory, pseudotime, monocle3, scvelo, rna-velocity]
updated: 2026-05-31
---

# 拟时间轨迹分析指南

## 适用场景

- 发育过程中的细胞分化
- 疾病进展（如肿瘤演化）
- 免疫应答动态

## 主要方法

### 拟时间推断 (Pseudotime)
基于转录组相似性排列细胞，重建分化路径。

**Monocle3** (R):
- 学习细胞间的树形拓扑
- 需要指定根节点
- 适用: 树形分化（如造血分化）

**Slingshot** (R):
- 基于聚类的轨迹推断
- 自动检测谱系结构
- 适用: 简单分叉拓扑

### RNA Velocity
分析 spliced/unspliced mRNA 比例，推断转录动态的**方向性**。

**scVelo** (Python):
- 动力学模型 (dynamical model)
- 可推断转录速率和分化方向
- 输出: velocity 向量 + velocity pseudotime

## 分析流程

1. **预处理**: 归一化 + HVG + PCA
2. **构建邻居图**: `sc.pp.neighbors(adata, n_pcs=30)`
3. **降维**: UMAP
4. **轨迹推断**: 选择方法
5. **可视化**: 沿轨迹展示基因表达变化
6. **验证**: 检查拓扑合理性

## 常见陷阱

- ⚠️ **缺少起始细胞**: 需要生物学知识指定根节点
- ⚠️ **循环拓扑**: 细胞周期可能导致假循环轨迹
- ⚠️ **过度解释**: 轨迹推断是可视化工具，不代表真实的因果关系
