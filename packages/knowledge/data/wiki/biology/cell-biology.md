---
title: 细胞生物学基础
topic: biology.cell-biology
category: biology
tags: [cell-cycle, apoptosis, differentiation, cell-types]
updated: 2026-05-31
---

# 细胞生物学基础

## 细胞周期 (Cell Cycle)

G1 → S (DNA 复制) → G2 → M (有丝分裂) → G1

- **G1 期**: 细胞生长，蛋白质合成
- **S 期**: DNA 复制，基因组加倍
- **G2 期**: 准备分裂，检查 DNA 损伤
- **M 期**: 染色体分离，胞质分裂

### scRNA-seq 中的细胞周期效应

细胞周期是 scRNA-seq 分析中**最常见的混杂因素**之一。不同细胞处于不同周期阶段时，
其转录组差异可能掩盖真正的生物学差异。

**处理方法**:
1. 使用 `scanpy.pp.score_genes_cell_cycle` 计算 S 和 G2M 评分
2. 使用 `scanpy.pp.regress_out` 回归掉 S_score 和 G2M_score
3. 或者将细胞周期基因从 HVG 中排除

## 细胞凋亡 (Apoptosis)

程序性细胞死亡。线粒体基因高表达是凋亡细胞的典型特征。

- **scRNA-seq 中**: 线粒体基因比例 >20% 通常指示受损/凋亡细胞
- **QC 过滤**: `pct_counts_mt < 20` 是标准过滤条件

## 细胞分化 (Cell Differentiation)

干细胞逐步转化为特化细胞的过程。在转录组水平表现为**连续的基因表达变化**。

- **拟时间分析 (Pseudotime)**: 重建分化轨迹的计算方法
- **RNA velocity**: 通过 spliced/unspliced 比例推断转录动态的方向性
