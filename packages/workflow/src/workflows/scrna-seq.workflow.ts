// ============================================================
// @bioagent/workflow — scRNA-seq Standard Workflow Definition
// ============================================================

import type { WorkflowDef } from "../engine.types.js";

/**
 * 10x Genomics scRNA-seq 标准分析流程。
 *
 * 包含 18 个节点的完整 DAG，覆盖从数据导入到最终报告的
 * 整个单细胞转录组分析流程。
 *
 * Phase 1: 数据准备 (import, qc, doublet)
 * Phase 2: 预处理 (normalize, hvg, pca)
 * Phase 3: 批次校正 [条件分支] (batch_check, batch_correct)
 * Phase 4: 嵌入+聚类 (umap, cluster)
 * Phase 5: 注释 [强制确认点] (annotate)
 * Phase 6: 下游分析 [可并行] (marker, de, enrich)
 * Phase 7: 可选项 (trajectory, communication)
 * Phase 8: 报告 (report)
 */
export const SCRNA_SEQ_STANDARD: WorkflowDef = {
  name: "scrna-seq-standard",
  version: "1.0.0",
  description:
    "10x Genomics scRNA-seq 标准分析流程: 从数据导入到最终报告",

  resourceEstimate: {
    cpu: "8-16 cores",
    ram: "32-64GB",
    disk: "50-100GB",
    time: "2-8 hours",
    gpu: "optional",
  },

  input: {
    dataFormat: ["h5ad", "h5", "mtx", "fastq"],
    required: ["expression_data", "sample_metadata"],
    optional: ["batch_info", "reference_genome"],
  },

  output: {
    directory: "bioagent_output/{project_id}/scrna-seq-standard/",
    files: [
      { name: "01_qc_report.html", description: "QC报告" },
      { name: "02_normalized.h5ad", description: "归一化数据" },
      { name: "03_umap_clusters.png", description: "UMAP聚类图" },
      { name: "04_cell_annotation.csv", description: "细胞注释" },
      { name: "05_marker_genes.csv", description: "Marker基因" },
      { name: "06_diff_expression.csv", description: "差异表达" },
      { name: "07_enrichment.html", description: "富集报告" },
      { name: "08_final_report.html", description: "最终报告" },
    ],
  },

  nodes: [
    // ===== Phase 1: 数据准备 =====
    {
      id: "import",
      skill: "data-import",
      dependsOn: [],
      dependsOnMode: "all",
      optional: false,
      checkpoint: true,
      pauseAfter: false,
      retry: { maxAttempts: 2, delayMs: 10000, backoff: "fixed" },
      timeout: 300000,
    },

    {
      id: "qc",
      skill: "scrna-qc",
      dependsOn: ["import"],
      dependsOnMode: "all",
      optional: false,
      checkpoint: true,
      pauseAfter: false,
      condition: {
        if: "cells_removed_ratio > 0.5",
        then: "ask_user",
        message: "超过50%细胞将被过滤，请确认数据质量",
      },
      retry: { maxAttempts: 3, delayMs: 30000, backoff: "fixed" },
      timeout: 600000,
    },

    {
      id: "doublet",
      skill: "doublet-detection",
      dependsOn: ["qc"],
      dependsOnMode: "all",
      optional: false,
      checkpoint: false,
      pauseAfter: false,
      retry: { maxAttempts: 2, delayMs: 30000, backoff: "exponential" },
      timeout: 1800000,
    },

    // ===== Phase 2: 预处理 =====
    {
      id: "normalize",
      skill: "scrna-normalize",
      dependsOn: ["doublet"],
      dependsOnMode: "all",
      optional: false,
      checkpoint: false,
      pauseAfter: false,
      timeout: 300000,
    },
    {
      id: "hvg",
      skill: "hvg-selection",
      dependsOn: ["normalize"],
      dependsOnMode: "all",
      optional: false,
      checkpoint: false,
      pauseAfter: false,
      timeout: 300000,
    },
    {
      id: "pca",
      skill: "scrna-pca",
      dependsOn: ["hvg"],
      dependsOnMode: "all",
      optional: false,
      checkpoint: false,
      pauseAfter: false,
      timeout: 600000,
    },

    // ===== Phase 3: 批次校正 (条件分支) =====
    {
      id: "batch_check",
      skill: "__conditional__",
      dependsOn: ["pca"],
      dependsOnMode: "all",
      optional: true,
      checkpoint: false,
      pauseAfter: false,
      condition: {
        if: "metadata.hasBatch && metadata.batchCount > 1",
        then: "continue",
        message: "",
      },
    },
    {
      id: "batch_correct",
      skill: "batch-correction",
      dependsOn: ["batch_check"],
      dependsOnMode: "all",
      optional: true,
      checkpoint: true,
      pauseAfter: false,
      retry: { maxAttempts: 2, delayMs: 60000, backoff: "exponential" },
      timeout: 1800000,
    },

    // ===== Phase 4: 嵌入+聚类 =====
    {
      id: "umap",
      skill: "umap-tsne",
      dependsOn: ["batch_correct", "batch_check"],
      dependsOnMode: "any",
      optional: false,
      checkpoint: false,
      pauseAfter: false,
      timeout: 600000,
    },
    {
      id: "cluster",
      skill: "clustering",
      dependsOn: ["umap"],
      dependsOnMode: "all",
      optional: false,
      checkpoint: true,
      pauseAfter: false,
      condition: {
        if: "silhouette_score < 0.3",
        then: "warn_continue",
        message: "聚类质量较低(轮廓系数<0.3)",
      },
      timeout: 600000,
    },

    // ===== Phase 5: 注释 (强制确认点) =====
    {
      id: "annotate",
      skill: "cell-annotation",
      dependsOn: ["cluster"],
      dependsOnMode: "all",
      optional: false,
      checkpoint: true,
      pauseAfter: true,
      retry: { maxAttempts: 2, delayMs: 30000, backoff: "fixed" },
      timeout: 1200000,
    },

    // ===== Phase 6: 下游分析 (可部分并行) =====
    {
      id: "marker",
      skill: "marker-detection",
      dependsOn: ["annotate"],
      dependsOnMode: "all",
      optional: false,
      checkpoint: false,
      pauseAfter: false,
      timeout: 1800000,
    },
    {
      id: "de",
      skill: "diff-expression",
      dependsOn: ["annotate"],
      dependsOnMode: "all",
      optional: false,
      checkpoint: false,
      pauseAfter: false,
      timeout: 1800000,
    },
    {
      id: "enrich",
      skill: "functional-enrichment",
      dependsOn: ["de", "marker"],
      dependsOnMode: "all",
      optional: false,
      checkpoint: true,
      pauseAfter: false,
      timeout: 1200000,
    },

    // ===== Phase 7: 可选项 =====
    {
      id: "trajectory",
      skill: "trajectory",
      dependsOn: ["annotate"],
      dependsOnMode: "all",
      optional: true,
      checkpoint: false,
      pauseAfter: false,
      timeout: 3600000,
    },
    {
      id: "communication",
      skill: "cell-communication",
      dependsOn: ["annotate"],
      dependsOnMode: "all",
      optional: true,
      checkpoint: false,
      pauseAfter: false,
      timeout: 3600000,
    },

    // ===== Phase 8: 报告 =====
    {
      id: "report",
      skill: "report-generator",
      dependsOn: ["enrich", "trajectory", "communication"],
      dependsOnMode: "any",
      optional: false,
      checkpoint: false,
      pauseAfter: false,
      timeout: 600000,
    },
  ],

  errorPolicy: {
    maxRetries: 3,
    retryDelayMs: 30000,
    onExhausted: "pause_and_ask",
    skipOptional: true,
    notifyOnWarning: true,
  },
};
