---
title: CellChat 使用指南
topic: tools.cellchat
category: tools
tool: cellchat
language: R
omics: [scrna-seq, spatial]
updated: 2026-05-31
---

# CellChat 使用指南

## 概述

CellChat 是用于从 scRNA-seq 数据推断细胞间通讯的 R 包。
它基于配体-受体 (LR) 相互作用数据库和质量作用模型。

- **版本**: ≥ 1.6
- **数据库**: CellChatDB (包含分泌信号、ECM-受体、细胞接触)
- **安装**: `devtools::install_github("sqjin/CellChat")`

## 标准流程

```r
library(CellChat)

# 1. 创建 CellChat 对象
cellchat <- createCellChat(object = seurat_obj, group.by = "cell_type")

# 2. 设置 LR 数据库
CellChatDB <- CellChatDB.human
cellchat@DB <- CellChatDB

# 3. 预处理
cellchat <- subsetData(cellchat)
cellchat <- identifyOverExpressedGenes(cellchat)
cellchat <- identifyOverExpressedInteractions(cellchat)

# 4. 计算通讯概率
cellchat <- computeCommunProb(cellchat)

# 5. 过滤低质量通讯
cellchat <- filterCommunication(cellchat, min.cells = 10)

# 6. 聚合网络
cellchat <- aggregateNet(cellchat)

# 7. 可视化
netVisual_bubble(cellchat, sources.use = 1:3, targets.use = 4:8)
```

## 关键可视化

- **Circle plot**: `netVisual_circle()` — 细胞类型间通讯强度
- **Bubble plot**: `netVisual_bubble()` — LR 对表达分布
- **Heatmap**: `netVisual_heatmap()` — 信号通路强度

## 局限性

- 仅基于**表达量**推断，不验证功能结合
- 依赖数据库的**完整性**和**准确性**
- 空间信息缺失（新版支持空间转录组）

## 输出解读

- **通讯概率 > 0.01** 通常视为有意义
- 关注**高强度和高度特异的通讯**
- 与生物学知识交叉验证
