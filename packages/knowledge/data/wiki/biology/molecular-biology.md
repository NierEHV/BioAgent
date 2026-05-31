---
title: 分子生物学基础
category: biology
tags: [dna, rna, transcription, translation, central-dogma, epigenetics]
updated: 2026-05-31
---

# 分子生物学基础

## 中心法则 (Central Dogma)

DNA → RNA → 蛋白质。这是分子生物学的核心框架。

在 scRNA-seq 中，我们测量的是 **mRNA（转录组）**，即基因组和蛋白质组之间的中间层。
需要注意 mRNA 水平不一定与蛋白质水平线性相关。

## 转录调控

- **启动子 (Promoter)**: RNA 聚合酶 II 结合位点，位于基因上游
- **增强子 (Enhancer)**: 远程调控元件，可位于基因上下游或内含子中
- **转录因子 (TF)**: 结合 DNA 特定序列调控转录的蛋白质

## 表观遗传修饰

- **DNA 甲基化**: CpG 岛的甲基化通常抑制转录
- **组蛋白修饰**: 乙酰化（激活）、甲基化（激活或抑制，取决于位点）
- **染色质可及性**: 开放的染色质区域允许 TF 结合

## 与 scRNA-seq 的关系

- mRNA 半衰期从数分钟到数小时不等，影响检测灵敏度
- 转录爆发 (transcriptional bursting) 导致 mRNA 计数的随机波动
- 这些因素导致 scRNA-seq 数据的 **dropout** 现象（真实表达的基因未被检测到）
