---
title: 免疫学基础
category: biology
tags: [t-cell, b-cell, nk-cell, macrophage, innate-immunity, adaptive-immunity]
updated: 2026-05-31
---

# 免疫学基础

## 免疫系统两大分支

### 先天免疫 (Innate Immunity)
- 快速响应（数分钟到数小时）
- 无抗原特异性
- 主要细胞: 巨噬细胞、中性粒细胞、NK 细胞、树突状细胞

### 适应性免疫 (Adaptive Immunity)
- 延迟响应（数天）
- 高度抗原特异性
- 免疫记忆
- 主要细胞: T 细胞、B 细胞

## T 细胞亚群

| 亚群 | 转录因子 | 效应分子 | 功能 |
|------|---------|---------|------|
| CD8+ CTL | — | GZMB, PRF1, IFNG | 杀伤感染/肿瘤细胞 |
| CD4+ Th1 | TBX21 | IFNG | 细胞免疫 |
| CD4+ Th2 | GATA3 | IL4, IL5, IL13 | 体液免疫 |
| CD4+ Th17 | RORC | IL17A, IL22 | 抗真菌/细菌 |
| CD4+ Treg | FOXP3 | IL10, TGFB1 | 免疫抑制 |

## B 细胞

- **Naive B**: 未接触抗原
- **Germinal Center B**: 正在经历亲和力成熟
- **Plasma Cell**: 抗体工厂
- **Memory B**: 长期免疫记忆

## scRNA-seq 中的免疫细胞注释

典型 marker 基因：
- T 细胞: **CD3E**, CD3D
- CD8+ T: **CD8A**, CD8B
- CD4+ T: **CD4**
- Treg: **FOXP3**, IL2RA (CD25)
- B 细胞: **CD19**, MS4A1 (CD20)
- NK 细胞: **NCAM1** (CD56), NKG7
- 单核/巨噬细胞: **CD14**, CD68, LYZ
- 树突状细胞: **ITGAX** (CD11c), FCER1A
