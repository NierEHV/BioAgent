---
title: 癌症生物学基础
topic: biology.cancer-biology
category: biology
tags: [oncogene, tumor-suppressor, tme, metastasis, immunotherapy]
updated: 2026-05-31
---

# 癌症生物学基础

## 癌基因与抑癌基因

| 类型 | 功能 | 例子 |
|------|------|------|
| 癌基因 (Oncogene) | 促进细胞增殖 | MYC, KRAS, EGFR, CCND1 |
| 抑癌基因 (TSG) | 抑制肿瘤发生 | TP53, PTEN, BRCA1, RB1 |

## 肿瘤微环境 (TME)

肿瘤不是孤立的细胞团，而是包含多种细胞类型的复杂生态系统：

- **肿瘤细胞**: 携带驱动突变的恶性细胞
- **免疫浸润细胞**: T 细胞、B 细胞、NK 细胞、巨噬细胞、树突状细胞
- **基质细胞**: 癌相关成纤维细胞 (CAF)、内皮细胞、周细胞
- **细胞外基质 (ECM)**: 提供结构支持，影响细胞行为

### scRNA-seq 在 TME 研究中的应用

- 解析 TME 的细胞组成和比例
- 鉴定新的细胞亚群（如耗竭 T 细胞、免疫抑制性巨噬细胞）
- 发现细胞间通讯网络（配体-受体分析）
- 追踪免疫治疗前后的细胞状态变化

## 免疫逃逸机制

肿瘤通过多种机制逃避免疫系统：
1. **免疫检查点**: PD-L1 表达抑制 T 细胞活性
2. **免疫抑制细胞**: Treg、MDSC 招募到 TME
3. **抗原丢失**: 下调 MHC-I 避免被 CTL 识别
