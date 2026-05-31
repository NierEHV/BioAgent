// ============================================================
// @bioagent/skills — ScrnaNormalizeSkill
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
 * scRNA-seq 归一化 Skill（log-normalization）。
 *
 * 执行标准的文库大小归一化 + log1p 转换：
 * 1. normalize_total(target_sum=1e4) — 每个细胞归一化到 10,000 UMI
 * 2. log1p — log(x+1) 转换，稳定方差
 *
 * 可选：扩展到 CPM、TPM、SCTransform 等高级方法。
 * 输出归一化后的 AnnData，包含原始计数在 .raw 属性中。
 */
export class ScrnaNormalizeSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "scrna-normalize",
    version: "1.0.0",
    description:
      "scRNA-seq log-normalization：文库大小归一化（10,000 UMI）+ log1p 转换",
    omicsType: "scrna",

    input: {
      acceptedFormats: ["h5ad"],
      schema: {},
      minSamples: 1,
      maxSamples: 10,
      estimatedInputSize: "50MB-2GB",
    },

    tools: {
      primary: "scanpy.pp.normalize_total",
      alternatives: [
        "scanpy.pp.normalize_per_cell",
        "scanpy.experimental.pp.normalize_pearson_residuals",
      ],
      decisionTree: [
        {
          condition: "标准 scRNA-seq 数据（推荐）",
          tool: "scanpy.pp.normalize_total + scanpy.pp.log1p",
          reason:
            "文库大小归一化到 10,000 UMI 后 log1p 是 scRNA-seq 的标准做法",
        },
        {
          condition: "需要保留 counts 用于差异分析（如 DESeq2 风格）",
          tool: "scanpy.pp.normalize_total(target_sum=1e6) + log1p",
          reason: "归一化到 1e6 (CPM) 后 log1p 适用于某些差异分析方法",
        },
        {
          condition: "需要处理高度稀疏数据",
          tool: "scanpy.experimental.pp.normalize_pearson_residuals",
          reason: "Pearson residual normalization 对稀疏数据更鲁棒",
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
        target_sum: 10000,
        exclude_highly_expressed: false,
        max_fraction: 0.05,
        save_raw: true,
      },
      descriptions: {
        target_sum:
          "每个细胞归一化后的总 UMI 数（默认 10,000）",
        exclude_highly_expressed:
          "是否排除高表达基因（如核糖体基因）以避免主导归一化",
        max_fraction: "当 exclude_highly_expressed 为 true 时，某基因的最大表达占比阈值",
        save_raw: "是否将原始计数保存在 .raw 属性中",
      },
      constraints: {
        target_sum: { min: 1000, max: 1000000 },
        max_fraction: { min: 0.01, max: 0.5 },
      },
    },

    qcGates: [
      {
        id: "normalization_sanity",
        name: "归一化后分布检查",
        description: "归一化后表达值应在合理范围内（无极端值）",
        check: {
          type: "threshold",
          expression:
            "post_norm_max > 0 && post_norm_max < 20 && post_norm_mean > 0",
          metric: "norm_sanity",
        },
        level: "fail",
        onPass: "归一化后表达值在合理范围",
        onFail:
          "归一化后出现极端值（max > 20），可能数据异常或 target_sum 设置不当",
        fixable: true,
        autoFixCommand:
          "python -c \"import scanpy as sc; adata = sc.read_h5ad('output.h5ad'); print(adata.X.max())\"",
      },
      {
        id: "zeros_preserved",
        name: "零值保留检查",
        description: "归一化不应将真实零表达转换为非零值",
        check: {
          type: "threshold",
          expression: "pct_zeros_after >= 0 && pct_zeros_after <= 100",
          metric: "zeros",
        },
        level: "warn",
        onPass: "零值比例正常",
        onFail:
          "零值比例异常（可能归一化方法不当导致引入伪表达值）",
        fixable: false,
      },
      {
        id: "library_size_correlation",
        name: "文库大小相关性检查",
        description: "归一化后每个细胞的表达总和应高度一致（消除文库大小影响）",
        check: {
          type: "threshold",
          expression:
            "cv_total_counts_after < cv_total_counts_before",
          metric: "lib_corr",
        },
        level: "warn",
        onPass: "归一化成功消除文库大小差异",
        onFail:
          "归一化后文库大小仍有较大变异（CV 未显著减小），检查 target_sum 参数",
        fixable: false,
      },
    ],

    outputs: {
      files: [
        {
          name: "normalized.h5ad",
          format: "h5ad",
          description:
            "归一化后的 AnnData（.X 包含 log-normalized 值，.raw 包含原始计数）",
          required: true,
        },
        {
          name: "normalization_report.json",
          format: "json",
          description: "归一化报告 JSON（分布统计）",
          required: true,
        },
      ],
      visualizations: [
        {
          type: "violin",
          description: "归一化前后每个细胞总表达量的分布对比",
        },
      ],
      metrics: [
        { name: "n_cells", description: "细胞数", unit: "cells" },
        { name: "n_genes", description: "基因数", unit: "genes" },
        {
          name: "pre_norm_mean",
          description: "归一化前平均表达值",
        },
        {
          name: "post_norm_mean",
          description: "归一化后平均表达值",
        },
        {
          name: "post_norm_max",
          description: "归一化后最大表达值",
        },
        {
          name: "pct_zeros_after",
          description: "归一化后零值百分比",
          unit: "%",
        },
        {
          name: "cv_total_counts_before",
          description: "归一化前总表达 CV",
        },
        {
          name: "cv_total_counts_after",
          description: "归一化后总表达 CV",
        },
      ],
    },

    troubleshooting: {
      common_issues: [
        {
          symptom: "post_norm_max > 20",
          likely_cause:
            "某些基因表达量极高，主导了归一化过程",
          diagnosis:
            "检查高表达基因（如 MALAT1、MTRNR2L12）是否过度贡献",
          fix: "设置 exclude_highly_expressed=true，或先过滤高表达基因。将 target_sum 调整为 1e4",
          severity: "warning",
        },
        {
          symptom: "cv_total_counts_after > cv_total_counts_before",
          likely_cause:
            "归一化参数不当或原始数据极度异质",
          diagnosis:
            "比较归一化前后的 total_counts 分布。如果批次效应强，需要先做 batch-correction",
          fix: "尝试不同的 target_sum 值。如果不同样本间差异大，先运行 batch-correction",
          severity: "warning",
        },
        {
          symptom: "all zeros after normalization",
          likely_cause:
            "输入数据为空或所有表达值均为零",
          diagnosis: "检查输入 h5ad 文件是否有效，是否在上游 QC 中过度过滤",
          fix: "检查上游数据。使用 scanpy.read_h5ad() 验证文件完整性",
          severity: "blocking",
        },
      ],
    },

    dependencies: {
      requires: ["scrna-qc"],
      recommends: ["doublet-detection"],
      conflicts: [],
    },

    resourceEstimate: {
      cpu: "2",
      ram: "4GB",
      disk: "1GB",
      time: "1-3 min",
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
      errors.push("Input path is required (must point to a QC-filtered .h5ad file).");
      return { valid: false, errors, warnings };
    }

    if (!data.inputPath.toLowerCase().endsWith(".h5ad")) {
      errors.push(
        `Input must be an .h5ad file. Got: ${data.inputPath}`,
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
      tool: "scanpy.pp.normalize_total + scanpy.pp.log1p",
      reason:
        "Standard pipeline: library-size normalization to 10k UMI then log1p transformation",
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
      target_sum:
        this.spec.parameters.defaults["target_sum"] ?? 10000,
      exclude_highly_expressed:
        this.spec.parameters.defaults["exclude_highly_expressed"] ?? false,
      max_fraction:
        this.spec.parameters.defaults["max_fraction"] ?? 0.05,
      save_raw:
        this.spec.parameters.defaults["save_raw"] ?? true,
    };
  }

  // -------------------------------------------------------------------------
  // ④ run
  // -------------------------------------------------------------------------

  async run(context: SkillContext): Promise<SkillExecResult> {
    const { inputPath, outputPath } = context.data;
    const targetSum = (context.params["target_sum"] as number) ?? 10000;
    const excludeHighlyExpressed =
      (context.params["exclude_highly_expressed"] as boolean) ?? false;
    const maxFraction =
      (context.params["max_fraction"] as number) ?? 0.05;
    const saveRaw = (context.params["save_raw"] as boolean) ?? true;

    const pythonScript = `
import scanpy as sc
import numpy as np
import json
import os

input_path = "${inputPath}"
output_path = "${outputPath}"

# Load data
adata = sc.read_h5ad(input_path)

# Store raw counts
if ${saveRaw === true ? "True" : "False"}:
    adata.raw = adata.copy()

# Pre-normalization stats
pre_norm_total = adata.X.sum(axis=1)
if hasattr(pre_norm_total, 'A1'):
    pre_norm_total = pre_norm_total.A1
pre_norm_mean = float(np.mean(adata.X.sum(axis=1) if not hasattr(adata.X, 'A1') else np.asarray(adata.X.sum(axis=1)).flatten()))
pre_norm_cv = float(np.std(pre_norm_total) / (np.mean(pre_norm_total) + 1e-10))

# Normalize to target sum
${excludeHighlyExpressed ? `
sc.pp.normalize_total(adata, target_sum=${targetSum}, exclude_highly_expressed=True, max_fraction=${maxFraction})
` : `
sc.pp.normalize_total(adata, target_sum=${targetSum})
`}

# Log1p transform
sc.pp.log1p(adata)

# Post-normalization stats
adata_np = adata.X
if hasattr(adata_np, 'toarray'):
    adata_np = adata_np.toarray()

post_norm_mean = float(np.mean(adata_np))
post_norm_max = float(np.max(adata_np))
post_norm_min = float(np.min(adata_np))
post_norm_std = float(np.std(adata_np))

# Zero percentage
pct_zeros = round(100 * np.sum(adata_np == 0) / adata_np.size, 4)

# Post-norm total counts CV
post_norm_total = np.asarray(adata_np.sum(axis=1)).flatten()
post_norm_cv = float(np.std(post_norm_total) / (np.mean(post_norm_total) + 1e-10))

# Build report
report = {
    "n_cells": int(adata.n_obs),
    "n_genes": int(adata.n_vars),
    "method": "normalize_total(log1p)",
    "target_sum": ${targetSum},
    "pre_norm_mean": round(pre_norm_mean, 2),
    "post_norm_mean": round(post_norm_mean, 4),
    "post_norm_max": round(post_norm_max, 4),
    "post_norm_min": round(post_norm_min, 4),
    "post_norm_std": round(post_norm_std, 4),
    "pct_zeros_after": float(pct_zeros),
    "cv_total_counts_before": round(pre_norm_cv, 4),
    "cv_total_counts_after": round(post_norm_cv, 4),
    "raw_saved": ${saveRaw === true ? "True" : "False"},
}

# Write outputs
with open(os.path.join(output_path, "normalization_report.json"), "w") as f:
    json.dump(report, f, indent=2)

output_file = os.path.join(output_path, "normalized.h5ad")
adata.write(output_file)
print(f"Written: {output_file}")
print(f"Pre-norm mean: {pre_norm_mean:.1f}, Post-norm mean: {post_norm_mean:.4f}")
print(f"CV before: {pre_norm_cv:.4f}, CV after: {post_norm_cv:.4f}")

print(json.dumps(report))
`.trim();

    const dockerResult = await this.execInContainer(context, pythonScript);

    const parsedData = this.parseJSONFromStdout(dockerResult.stdout);

    const metrics: Record<string, number> = {
      n_cells:
        typeof parsedData["n_cells"] === "number"
          ? (parsedData["n_cells"] as number)
          : 0,
      n_genes:
        typeof parsedData["n_genes"] === "number"
          ? (parsedData["n_genes"] as number)
          : 0,
      pre_norm_mean:
        typeof parsedData["pre_norm_mean"] === "number"
          ? (parsedData["pre_norm_mean"] as number)
          : 0,
      post_norm_mean:
        typeof parsedData["post_norm_mean"] === "number"
          ? (parsedData["post_norm_mean"] as number)
          : 0,
      post_norm_max:
        typeof parsedData["post_norm_max"] === "number"
          ? (parsedData["post_norm_max"] as number)
          : 0,
      pct_zeros_after:
        typeof parsedData["pct_zeros_after"] === "number"
          ? (parsedData["pct_zeros_after"] as number)
          : 0,
      cv_total_counts_before:
        typeof parsedData["cv_total_counts_before"] === "number"
          ? (parsedData["cv_total_counts_before"] as number)
          : 0,
      cv_total_counts_after:
        typeof parsedData["cv_total_counts_after"] === "number"
          ? (parsedData["cv_total_counts_after"] as number)
          : 0,
    };

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

    const preMean = results.metrics["pre_norm_mean"] ?? 0;
    const postMean = results.metrics["post_norm_mean"] ?? 0;
    const postMax = results.metrics["post_norm_max"] ?? 0;
    const cvBefore = results.metrics["cv_total_counts_before"] ?? 0;
    const cvAfter = results.metrics["cv_total_counts_after"] ?? 0;
    const pctZeros = results.metrics["pct_zeros_after"] ?? 0;

    logs.push(
      `Normalization: pre-mean=${preMean.toFixed(1)}, post-mean=${postMean.toFixed(4)}`,
    );
    logs.push(
      `CV: ${cvBefore.toFixed(4)} → ${cvAfter.toFixed(4)} (reduction: ${((1 - cvAfter / (cvBefore + 1e-10)) * 100).toFixed(1)}%)`,
    );
    logs.push(
      `Post-norm max: ${postMax.toFixed(4)}, zeros: ${pctZeros}%`,
    );
    logs.push(
      `QC overall: ${qc.overall} (${qc.passed}P/${qc.warned}W/${qc.failed}F)`,
    );

    return {
      files: [
        {
          path: `${results.parsedData["output_path"] ?? ""}/normalized.h5ad`,
          format: "h5ad",
          size_bytes: 0,
        },
        ...(results.exitCode === 0
          ? [
              {
                path: `${results.parsedData["output_path"] ?? ""}/normalization_report.json`,
                format: "json",
                size_bytes: 0,
              },
            ]
          : []),
      ],
      metrics: {
        n_cells: results.metrics["n_cells"],
        n_genes: results.metrics["n_genes"],
        pre_norm_mean: preMean,
        post_norm_mean: postMean,
        post_norm_max: postMax,
        pct_zeros_after: pctZeros,
        cv_total_counts_before: cvBefore,
        cv_total_counts_after: cvAfter,
        method: results.parsedData["method"] ?? "normalize_total+log1p",
      },
      logs,
    };
  }
}
