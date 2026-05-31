// ============================================================
// @bioagent/skills — ScrnaQCSkill
// ============================================================

import { BaseSkill } from "../base-skill.js";
import type {
  SkillSpec,
  SkillContext,
  SkillExecResult,
  QCReport,
  SkillOutput,
  ValidationResult,
  ToolChoice,
  DataContext,
} from "../base-skill.types.js";
import type { ResourceReport } from "@bioagent/executor";

/**
 * 单细胞 RNA-seq 质量控制 Skill。
 *
 * 实现自适应 MAD 阈值过滤（3x MAD），包括：
 * - 基于 median absolute deviation 的基因数异常检测
 * - 线粒体基因百分比（pctMT）过滤
 * - 核糖体基因百分比监控
 * - UMI 计数分布检查
 * - 双峰检测（通过分布形状分析）
 * - 自动生成 QC 报告 JSON 和小提琴图数据
 */
export class ScrnaQCSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "scrna-qc",
    version: "1.0.0",
    description:
      "scRNA-seq 质量控制：自适应 MAD 阈值过滤、MT% 检测、基因计数过滤、doulet score 计算",
    omicsType: "scrna",

    input: {
      acceptedFormats: ["h5ad"],
      schema: {},
      minSamples: 1,
      maxSamples: 10,
      requiredMetadataColumns: ["mt", "ribo"],
      estimatedInputSize: "50MB-2GB",
    },

    tools: {
      primary: "scanpy.pp.calculate_qc_metrics",
      alternatives: ["scanpy.pp.filter_cells", "scanpy.pp.filter_genes"],
      decisionTree: [
        {
          condition: "输入为 h5ad 文件",
          tool: "scanpy.pp.calculate_qc_metrics",
          reason: "标准 Scanpy QC 流程，计算全指标",
        },
      ],
      dockerImages: {
        scanpy: {
          image: "bioagent-scrna:latest",
          fallbackImage: "rnakato/shortcake_full:latest",
        },
      },
    },

    parameters: {
      defaults: {
        min_genes: 200,
        max_pct_mt: 20,
        mad_multiplier: 3,
        min_cells_per_gene: 3,
      },
      descriptions: {
        min_genes: "每个细胞最少检测到的基因数",
        max_pct_mt: "最大线粒体基因百分比（%）",
        mad_multiplier: "MAD 倍数阈值（默认 3，即 3*MAD）",
        min_cells_per_gene: "基因至少在多少个细胞中表达才保留",
      },
      constraints: {
        min_genes: { min: 50, max: 1000 },
        max_pct_mt: { min: 5, max: 50 },
        mad_multiplier: { min: 1, max: 5 },
        min_cells_per_gene: { min: 1, max: 100 },
      },
    },

    qcGates: [
      {
        id: "gene_count_filter",
        name: "基因数过滤",
        description: "每个细胞至少表达 200 个基因",
        check: {
          type: "threshold",
          expression: "n_cells_after > 0 && pct_cells_retained > 30",
          metric: "gene_count",
        },
        level: "fail",
        onPass: "基因数过滤正常，保留足够细胞",
        onFail:
          "大量细胞基因数过低（<200），可能数据质量差或测序深度不足",
        fixable: false,
      },
      {
        id: "mt_percent_filter",
        name: "线粒体含量过滤",
        description: "线粒体基因占比不超过 20%，排除死细胞",
        check: {
          type: "threshold",
          expression: "pct_cells_retained > 50 && median_pct_mt < 20",
          metric: "mt_percent",
        },
        level: "fail",
        onPass: "线粒体含量在正常范围内",
        onFail:
          "线粒体含量过高（>20%）或保留细胞过少（<50%），可能存在大量死细胞或裂解不完全",
        fixable: false,
      },
      {
        id: "umi_distribution",
        name: "UMI 分布检查",
        description: "UMI 分布不应出现异常双峰",
        check: {
          type: "distribution",
          expression:
            "median_umi > 500 && median_umi < 50000",
          metric: "umi_dist",
        },
        level: "warn",
        onPass: "UMI 分布中位数在正常范围",
        onFail:
          "UMI 分布中位数异常，可能测序深度不均匀或存在批次效应",
        fixable: false,
      },
      {
        id: "double_peak_check",
        name: "双峰检测",
        description: "基因数/UMI分布不应出现明显双峰（可能指示空滴+细胞混合）",
        check: {
          type: "distribution",
          expression: "is_bimodal == 0",
          metric: "double_peak",
        },
        level: "warn",
        onPass: "分布正常，未检测到双峰",
        onFail:
          "检测到双峰分布，可能存在空滴/细胞混合。建议运行 doublet-detection 进一步排查",
        fixable: false,
      },
      {
        id: "ribo_content",
        name: "核糖体含量检查",
        description: "核糖体基因占比在合理范围内",
        check: {
          type: "range",
          expression:
            "median_pct_ribo >= 1 && median_pct_ribo <= 50",
          metric: "ribo_content",
        },
        level: "warn",
        onPass: "核糖体含量正常",
        onFail:
          "核糖体含量异常，可能影响下游分析（极端值提示细胞状态异常）",
        fixable: false,
      },
    ],

    outputs: {
      files: [
        {
          name: "qc_filtered.h5ad",
          format: "h5ad",
          description: "QC过滤后的 AnnData",
          required: true,
        },
        {
          name: "qc_report.json",
          format: "json",
          description: "QC 指标 JSON 报告",
          required: true,
        },
        {
          name: "qc_violin_data.json",
          format: "json",
          description: "小提琴图原始数据（n_genes, pct_mt, total_counts per cell）",
          required: false,
        },
      ],
      visualizations: [
        {
          type: "violin",
          description: "QC 指标小提琴图：n_genes_by_counts, total_counts, pct_counts_mt",
        },
        {
          type: "scatter",
          description: "n_genes vs total_counts 散点图，按 pct_mt 着色",
        },
      ],
      metrics: [
        { name: "n_cells_before", description: "过滤前细胞数", unit: "cells" },
        { name: "n_cells_after", description: "过滤后细胞数", unit: "cells" },
        { name: "n_genes_before", description: "过滤前基因数", unit: "genes" },
        { name: "n_genes_after", description: "过滤后基因数", unit: "genes" },
        { name: "median_n_genes", description: "过滤后中位基因数", unit: "genes" },
        { name: "median_umi", description: "过滤后中位 UMI 数", unit: "UMI" },
        { name: "median_pct_mt", description: "过滤后中位线粒体含量", unit: "%" },
        { name: "median_pct_ribo", description: "过滤后中位核糖体含量", unit: "%" },
        { name: "pct_cells_retained", description: "保留细胞百分比", unit: "%" },
      ],
    },

    troubleshooting: {
      common_issues: [
        {
          symptom: "n_cells_after == 0",
          likely_cause: "所有细胞被 QC 过滤掉，数据质量极差",
          diagnosis:
            "检查 raw data 是否为空、基因名格式是否包含 MT-/RPS/RPL 前缀、过滤阈值是否过严",
          fix: "降低 min_genes 阈值（默认 200 → 100），检查输入文件是否有效 h5ad",
          severity: "blocking",
        },
        {
          symptom: "pct_mt > 50%",
          likely_cause: "样本存在大量死细胞或细胞裂解不彻底",
          diagnosis:
            "检查原始 UMI 和基因分布。若 pct_mt 整体偏高，可能是组织或细胞类型特性",
          fix: "检查样本制备流程。调整 max_pct_mt 阈值（如 30%）。确认基因名包含 'MT-' 前缀",
          severity: "warning",
        },
        {
          symptom: "median_n_genes < 200",
          likely_cause: "测序深度不足或样本质量差",
          diagnosis:
            "检查测序饱和度报告。对于某些特殊细胞类型（如红细胞），低基因数是正常的",
          fix: "使用更深的测序深度，或针对特定细胞类型调整 min_genes 阈值",
          severity: "warning",
        },
        {
          symptom: "bimodal distribution detected",
          likely_cause: "数据中包含空滴/死细胞与活细胞的混合",
          diagnosis:
            "检查 n_genes 和 total_counts 的分布直方图，寻找两个明显峰值",
          fix: "运行 doublet-detection Skill 确认双细胞比例。使用更严格的过滤参数或 EmptyDrops 方法",
          severity: "warning",
        },
      ],
    },

    dependencies: {
      requires: ["data-import"],
      recommends: ["doublet-detection", "scrna-normalize"],
      conflicts: [],
    },

    resourceEstimate: {
      cpu: "4",
      ram: "8GB",
      disk: "2GB",
      time: "2-10 min",
      gpu: "not_needed",
    },
  };

  // -------------------------------------------------------------------------
  // ① validateInput
  // -------------------------------------------------------------------------

  async validateInput(data: DataContext): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.inputPath || data.inputPath.trim().length === 0) {
      errors.push("Input path is required (must point to a .h5ad file).");
      return { valid: false, errors, warnings };
    }

    if (!data.inputPath.toLowerCase().endsWith(".h5ad")) {
      errors.push(
        `Input must be an .h5ad file. Got: ${data.inputPath}. Run data-import first.`,
      );
    }

    if (!data.outputPath || data.outputPath.trim().length === 0) {
      errors.push("Output path is required.");
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // -------------------------------------------------------------------------
  // ② selectTool
  // -------------------------------------------------------------------------

  async selectTool(
    _data: DataContext,
    _resources: ResourceReport,
  ): Promise<ToolChoice> {
    return {
      tool: "scanpy.pp.calculate_qc_metrics",
      reason: "Standard Scanpy QC pipeline — comprehensive metrics",
      image: this.spec.tools.dockerImages["scanpy"].image,
    };
  }

  // -------------------------------------------------------------------------
  // ③ configureParams
  // -------------------------------------------------------------------------

  async configureParams(
    data: DataContext,
    _tool: ToolChoice,
  ): Promise<Record<string, unknown>> {
    return {
      input_path: data.inputPath,
      output_path: data.outputPath,
      min_genes:
        this.spec.parameters.defaults["min_genes"] ?? 200,
      max_pct_mt:
        this.spec.parameters.defaults["max_pct_mt"] ?? 20,
      mad_multiplier:
        this.spec.parameters.defaults["mad_multiplier"] ?? 3,
      min_cells_per_gene:
        this.spec.parameters.defaults["min_cells_per_gene"] ?? 3,
    };
  }

  // -------------------------------------------------------------------------
  // ④ run
  // -------------------------------------------------------------------------

  async run(context: SkillContext): Promise<SkillExecResult> {
    const { inputPath, outputPath } = context.data;
    const minGenes = (context.params["min_genes"] as number) ?? 200;
    const maxPctMt = (context.params["max_pct_mt"] as number) ?? 20;
    const madMultiplier = (context.params["mad_multiplier"] as number) ?? 3;
    const minCellsPerGene =
      (context.params["min_cells_per_gene"] as number) ?? 3;

    const pythonScript = `
import scanpy as sc
import numpy as np
import json
import os
from scipy import stats

input_path = "${inputPath}"
output_path = "${outputPath}"

# Load data
adata = sc.read_h5ad(input_path)
n_cells_before = adata.n_obs
n_genes_before = adata.n_vars

# Tag mitochondrial and ribosomal genes
adata.var['mt'] = adata.var_names.str.startswith('MT-')
adata.var['ribo'] = adata.var_names.str.startswith(('RPS', 'RPL'))

# Calculate QC metrics
sc.pp.calculate_qc_metrics(adata, qc_vars=['mt', 'ribo'], inplace=True)

# ---------- Adaptive MAD filtering ----------
# Outlier detection using median absolute deviation (MAD)
def is_outlier_mad(series, n_mads=${madMultiplier}):
    median = np.median(series)
    mad = stats.median_abs_deviation(series)
    if mad == 0:
        mad = np.std(series) / 1.4826  # fallback to SD-based MAD estimate
    lower = median - n_mads * mad
    upper = median + n_mads * mad
    return (series < lower) | (series > upper), median, mad, lower, upper

# Gene count outliers (both low and high)
n_genes = adata.obs['n_genes_by_counts'].to_numpy()
gene_outliers, gene_median, gene_mad, gene_lower, gene_upper = is_outlier_mad(n_genes, n_mads=${madMultiplier})

# UMI count outliers
total_counts = adata.obs['total_counts'].to_numpy()
umi_outliers, umi_median, umi_mad, umi_lower, umi_upper = is_outlier_mad(total_counts, n_mads=${madMultiplier})

# MT percentage outliers (high only — low MT is fine)
pct_mt = adata.obs['pct_counts_mt'].to_numpy()
mt_median = np.median(pct_mt)
mt_mad = stats.median_abs_deviation(pct_mt)
mt_upper = mt_median + ${madMultiplier} * mt_mad
mt_outliers = pct_mt > mt_upper

# Combined filter
keep = (
    (n_genes > ${minGenes}) &
    (pct_mt < ${maxPctMt}) &
    (~gene_outliers) &
    (~umi_outliers) &
    (~mt_outliers)
)

n_low_genes = int(np.sum(n_genes <= ${minGenes}))
n_high_mt = int(np.sum(pct_mt >= ${maxPctMt}))
n_mad_gene_out = int(np.sum(gene_outliers))
n_mad_umi_out = int(np.sum(umi_outliers))
n_mad_mt_out = int(np.sum(mt_outliers))

adata = adata[keep, :].copy()

# Filter genes: keep genes expressed in at least min_cells
sc.pp.filter_genes(adata, min_cells=${minCellsPerGene})

n_cells_after = adata.n_obs
n_genes_after = adata.n_vars
pct_retained = round(100 * n_cells_after / n_cells_before, 2) if n_cells_before > 0 else 0

# ---------- Bimodality detection ----------
# Use histogram dip test heuristic: check if density has two peaks above a threshold
def detect_bimodality(data, min_peak_ratio=0.1):
    hist, bin_edges = np.histogram(data, bins=min(50, len(data)//10))
    if len(hist) < 3:
        return 0, ""
    # Simple peak detection: find local maxima
    peaks = []
    for i in range(1, len(hist)-1):
        if hist[i] > hist[i-1] and hist[i] > hist[i+1] and hist[i] > np.mean(hist) * 0.5:
            peaks.append(i)
    if len(peaks) >= 2:
        peak_heights = [hist[p] for p in peaks]
        peak_heights.sort(reverse=True)
        if peak_heights[1] / (peak_heights[0] + 1e-10) > min_peak_ratio:
            return 1, f"bimodal_{len(peaks)}_peaks"
    return 0, "unimodal"

is_bimodal, bimodal_detail = detect_bimodality(n_genes)

# ---------- Violin plot data ----------
violin_data = {
    "n_genes_by_counts": adata.obs['n_genes_by_counts'].tolist(),
    "total_counts": adata.obs['total_counts'].tolist(),
    "pct_counts_mt": adata.obs['pct_counts_mt'].tolist(),
    "pct_counts_ribo": adata.obs.get('pct_counts_ribo', pd.Series([0]*len(adata))).tolist(),
}

with open(os.path.join(output_path, "qc_violin_data.json"), "w") as f:
    json.dump(violin_data, f)

# ---------- Build QC report ----------
qc_report = {
    "n_cells_before": int(n_cells_before),
    "n_cells_after": int(n_cells_after),
    "n_genes_before": int(n_genes_before),
    "n_genes_after": int(n_genes_after),
    "median_n_genes": float(np.median(adata.obs['n_genes_by_counts'])) if n_cells_after > 0 else 0,
    "median_umi": float(np.median(adata.obs['total_counts'])) if n_cells_after > 0 else 0,
    "median_pct_mt": float(np.median(adata.obs['pct_counts_mt'])) if n_cells_after > 0 else 0,
    "median_pct_ribo": float(np.median(adata.obs.get('pct_counts_ribo', [0]))) if n_cells_after > 0 else 0,
    "pct_cells_retained": float(pct_retained),
    "filter_stats": {
        "low_genes_removed": int(n_low_genes),
        "high_mt_removed": int(n_high_mt),
        "mad_gene_outliers_removed": int(n_mad_gene_out),
        "mad_umi_outliers_removed": int(n_mad_umi_out),
        "mad_mt_outliers_removed": int(n_mad_mt_out),
        "mad_params": {
            "gene_median": float(gene_median), "gene_mad": float(gene_mad),
            "gene_lower": float(gene_lower), "gene_upper": float(gene_upper),
            "umi_median": float(umi_median), "umi_mad": float(umi_mad),
            "umi_lower": float(umi_lower), "umi_upper": float(umi_upper),
            "mt_median": float(mt_median), "mt_mad": float(mt_mad),
            "mt_upper": float(mt_upper),
        }
    },
    "bimodality": {
        "is_bimodal": int(is_bimodal),
        "detail": bimodal_detail,
    },
}

# Write outputs
with open(os.path.join(output_path, "qc_report.json"), "w") as f:
    json.dump(qc_report, f, indent=2)

output_file = os.path.join(output_path, "qc_filtered.h5ad")
adata.write(output_file)
print(f"Written: {output_file}")

# Print final JSON (add pandas import above was needed)
import pandas as pd
print(json.dumps(qc_report))
`.trim();

    const dockerResult = await this.execInContainer(context, pythonScript);

    const parsedData = this.parseJSONFromStdout(dockerResult.stdout);

    // Extract metrics from parsed JSON
    const metrics: Record<string, number> = {
      n_cells_before:
        typeof parsedData["n_cells_before"] === "number"
          ? (parsedData["n_cells_before"] as number)
          : 0,
      n_cells_after:
        typeof parsedData["n_cells_after"] === "number"
          ? (parsedData["n_cells_after"] as number)
          : 0,
      n_genes_before:
        typeof parsedData["n_genes_before"] === "number"
          ? (parsedData["n_genes_before"] as number)
          : 0,
      n_genes_after:
        typeof parsedData["n_genes_after"] === "number"
          ? (parsedData["n_genes_after"] as number)
          : 0,
      median_n_genes:
        typeof parsedData["median_n_genes"] === "number"
          ? (parsedData["median_n_genes"] as number)
          : 0,
      median_umi:
        typeof parsedData["median_umi"] === "number"
          ? (parsedData["median_umi"] as number)
          : 0,
      median_pct_mt:
        typeof parsedData["median_pct_mt"] === "number"
          ? (parsedData["median_pct_mt"] as number)
          : 0,
      median_pct_ribo:
        typeof parsedData["median_pct_ribo"] === "number"
          ? (parsedData["median_pct_ribo"] as number)
          : 0,
      pct_cells_retained:
        typeof parsedData["pct_cells_retained"] === "number"
          ? (parsedData["pct_cells_retained"] as number)
          : 0,
    };

    // Extract bimodality flag
    const filterStats = parsedData["filter_stats"] as Record<string, unknown> | undefined;
    const bimodality = (parsedData["bimodality"] as Record<string, unknown>) ?? {};
    metrics["is_bimodal"] =
      typeof bimodality["is_bimodal"] === "number"
        ? (bimodality["is_bimodal"] as number)
        : 0;

    return {
      exitCode: dockerResult.exitCode,
      stdout: dockerResult.stdout,
      stderr: dockerResult.stderr,
      parsedData,
      metrics,
    };
  }

  // -------------------------------------------------------------------------
  // ⑤ runQC
  // -------------------------------------------------------------------------

  async runQC(results: SkillExecResult): Promise<QCReport> {
    return this.runQCGates(results.metrics);
  }

  // -------------------------------------------------------------------------
  // ⑥ formatOutput
  // -------------------------------------------------------------------------

  async formatOutput(
    results: SkillExecResult,
    qc: QCReport,
  ): Promise<SkillOutput> {
    const logs: string[] = [];

    if (results.exitCode !== 0) {
      logs.push(`Python script exited with code ${results.exitCode}`);
    }
    if (results.stderr) {
      logs.push(`stderr: ${results.stderr.substring(0, 500)}`);
    }

    const before = results.metrics["n_cells_before"] ?? 0;
    const after = results.metrics["n_cells_after"] ?? 0;
    const removed = before - after;
    const pctRetained = results.metrics["pct_cells_retained"] ?? 0;
    const isBimodal = results.metrics["is_bimodal"] ?? 0;

    logs.push(
      `QC filtering: ${before} cells → ${after} cells (${removed} removed, ${pctRetained}% retained)`,
    );
    logs.push(
      `Median genes: ${results.metrics["median_n_genes"] ?? 0}, Median UMI: ${results.metrics["median_umi"] ?? 0}`,
    );
    logs.push(
      `Median MT%: ${(results.metrics["median_pct_mt"] ?? 0).toFixed(1)}%, Median Ribo%: ${(results.metrics["median_pct_ribo"] ?? 0).toFixed(1)}%`,
    );
    logs.push(
      `QC overall: ${qc.overall} (${qc.passed}P/${qc.warned}W/${qc.failed}F)`,
    );

    if (isBimodal === 1) {
      logs.push(
        "WARNING: Bimodal distribution detected. Consider running doublet-detection.",
      );
    }

    return {
      files: [
        {
          path: `${results.parsedData["output_path"] ?? ""}/qc_filtered.h5ad`,
          format: "h5ad",
          size_bytes: 0,
        },
        ...(results.exitCode === 0
          ? [
              {
                path: `${results.parsedData["output_path"] ?? ""}/qc_report.json`,
                format: "json",
                size_bytes: 0,
              },
              {
                path: `${results.parsedData["output_path"] ?? ""}/qc_violin_data.json`,
                format: "json",
                size_bytes: 0,
              },
            ]
          : []),
      ],
      metrics: {
        n_cells_before: results.metrics["n_cells_before"],
        n_cells_after: results.metrics["n_cells_after"],
        n_genes_before: results.metrics["n_genes_before"],
        n_genes_after: results.metrics["n_genes_after"],
        median_n_genes: results.metrics["median_n_genes"],
        median_umi: results.metrics["median_umi"],
        median_pct_mt: results.metrics["median_pct_mt"],
        median_pct_ribo: results.metrics["median_pct_ribo"],
        pct_cells_retained: results.metrics["pct_cells_retained"],
        is_bimodal: results.metrics["is_bimodal"],
      },
      logs,
    };
  }
}
