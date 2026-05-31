---
title: 细胞间通讯分析指南
topic: scrna-seq.cell-communication
category: omics
omics: scrna-seq
tags: [cell-communication, ligand-receptor, cellchat, nichenet, cellphonedb]
updated: 2026-05-31
---

# 细胞间通讯分析指南

## 基本原理

基于配体-受体 (Ligand-Receptor, LR) 共表达推断细胞间通讯。
如果细胞类型 A 高表达某配体，细胞类型 B 高表达其受体，则推断 A→B 存在通讯。

## 主流工具

### CellChat (R)
- 基于质量作用模型
- 考虑多亚基复合物和共因子
- 丰富的可视化（circle plot, heatmap, 网络图）

### NicheNet (R)
- 从受体表达反推上游配体
- 整合信号通路和转录因子信息
- 适用于: "哪些配体驱动了目标基因表达？"

### CellPhoneDB (Python)
- 最大的手动 curated LR 数据库
- 考虑多亚基结构
- 支持空间转录组数据

### iTALK (R)
- 快速筛选差异表达的 LR 对
- 较轻量级

## 分析流程

1. **准备输入**: 归一化的基因表达矩阵 + 细胞类型标签
2. **筛选 LR 对**: 限定在数据库中存在的 LR 对
3. **统计检验**: 置换检验评估通讯是否显著高于随机
4. **可视化**: 网络图、热图、气泡图

## 局限性

- ⚠️ **共表达 ≠ 功能通讯**: 需要蛋白质水平验证
- ⚠️ **空间信息缺失**: scRNA-seq 缺少空间关系
- ⚠️ **假阳性率**: 多重检验后需严格 FDR 控制

## 后续验证

- 空间转录组 (Visium, MERFISH) 验证空间邻近性
- 蛋白质水平验证 (免疫组化, 流式)
- 功能性实验 (共培养, 配体阻断)
