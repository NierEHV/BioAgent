// ============================================================
// @bioagent/skills — DoubletDetectionSkill
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
 * 双细胞检测 Skill（Scrublet）。
 *
 * 使用 Scrublet 算法检测 scRNA-seq 数据中的 doublet（双细胞液滴）。
 * Scrublet 通过模拟随机 doublet 并与真实细胞比较来识别潜在的 doublet。
 *
 * 关键参数：
 * - expected_doublet_rate: 期望的双细胞比例（通常 0.05-0.08）
 * - sim_doublet_ratio: 模拟 doublet 数量与真实细胞的比例
 */
export class DoubletDetectionSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "doublet-detection",
    version: "1.0.0",
    description:
      "使用 Scrublet 检测 scRNA-seq 数据中的 doublet（双细胞），输出 doublet score 和预测标签",
    omicsType: "scrna",

    input: {
      acceptedFormats: ["h5ad"],
      schema: {},
      minSamples: 1,
      maxSamples: 5,
      estimatedInputSize: "50MB-2GB",
    },

    tools: {
      primary: "scrublet.Scrublet",
      alternatives: ["scanpy.external.pp.scrublet", "DoubletFinder"],
      decisionTree: [
        {
          condition: "输入为 h5ad 且细胞数 < 50000",
          tool: "scrublet.Scrublet",
          reason: "Scrublet 对小到中等规模数据效果好，速度快",
        },
        {
          condition: "输入为 h5ad 且细胞数 > 50000",
          tool: "scrublet.Scrublet",
          reason: "Scrublet 可处理大数据集，但需更多内存",
        },
      ],
      dockerImages: {
        scrublet: {
          image: "bioagent-scrna:latest",
          fallbackImage: "rnakato/shortcake_full:latest",
        },
      },
    },

    parameters: {
      defaults: {
        expected_doublet_rate: 0.06,
        sim_doublet_ratio: 2.0,
        n_neighbors: undefined,
        min_counts: 3,
        min_cells: 3,
        min_gene_variability_pctl: 85,
        n_prin_comps: 30,
      },
      descriptions: {
        expected_doublet_rate:
          "期望的双细胞比例（默认 0.06 = 6%，基于 10x 官方指南：~0.8%/1000 cells）",
        sim_doublet_ratio: "模拟 doublet 数量与真实细胞的比例",
        n_neighbors: "构建 kNN 图的邻居数（默认自动计算：sqrt(n_cells)）",
        min_counts: "过滤低表达细胞的最小 UMI 数",
        min_cells: "基因至少在其中表达的细胞数",
        min_gene_variability_pctl: "高变基因百分位阈值",
        n_prin_comps: "PCA 主成分数",
      },
      constraints: {
        expected_doublet_rate: { min: 0.01, max: 0.30 },
        sim_doublet_ratio: { min: 0.5, max: 5.0 },
        min_gene_variability_pctl: { min: 50, max: 99 },
        n_prin_comps: { min: 10, max: 100 },
      },
    },

    qcGates: [
      {
        id: "doublet_rate_check",
        name: "双细胞率检查",
        description: "预测的双细胞比例应在合理范围内（<15%）",
        check: {
          type: "threshold",
          expression:
            "predicted_doublet_rate >= 0 && predicted_doublet_rate < 15",
          metric: "doublet_rate",
        },
        level: "fail",
        onPass: "双细胞率在正常范围内",
        onFail:
          "双细胞率过高（>=15%），可能细胞制备质量差或参数设置不当",
        fixable: false,
      },
      {
        id: "score_separation",
        name: "Score 分离度检查",
        description: "doublet score 应能有效区分 singlet 和 doublet",
        check: {
          type: "threshold",
          expression:
            "score_separation > 0.1",
          metric: "score_separation",
        },
        level: "warn",
        onPass: "Scrublet score 能有效区分 singlet/doublet",
        onFail:
          "Scrublet score 分离度不足，doublet 与 singlet 难以区分。考虑调整 expected_doublet_rate 参数",
        fixable: true,
        autoFixCommand:
          "python -c \"import scrublet as scr; print('Try adjusting expected_doublet_rate')\"",
      },
      {
        id: "cell_count_sanity",
        name: "细胞数合理性检查",
        description: "过滤后的细胞数应在合理范围",
        check: {
          type: "threshold",
          expression:
            "n_singlets > 100",
          metric: "cell_count",
        },
        level: "fail",
        onPass: "保留足够数量的 singlet 细胞用于下游分析",
        onFail:
          "singlet 细胞数过少（<=100），可能数据质量差或 doublet 率过高",
        fixable: false,
      },
    ],

    outputs: {
      files: [
        {
          name: "doublet_annotated.h5ad",
          format: "h5ad",
          description:
            "添加了 doublet_score 和 predicted_doublet 标注的 AnnData",
          required: true,
        },
        {
          name: "doublet_report.json",
          format: "json",
          description: "doublet 检测报告 JSON",
          required: true,
        },
        {
          name: "scrublet_histogram_data.json",
          format: "json",
          description: "Scrublet score 直方图原始数据",
          required: false,
        },
      ],
      visualizations: [
        {
          type: "violin",
          description: "doublet score 分布直方图，标注阈值线",
        },
      ],
      metrics: [
        { name: "n_total_cells", description: "总细胞数", unit: "cells" },
        { name: "n_singlets", description: "预测的 singlet 数", unit: "cells" },
        { name: "n_doublets", description: "预测的 doublet 数", unit: "cells" },
        {
          name: "predicted_doublet_rate",
          description: "预测双细胞比例",
          unit: "%",
        },
        { name: "threshold", description: "自动或手动设定的 doublet score 阈值" },
        { name: "score_separation", description: "singlet/doublet score 分离度" },
      ],
    },

    troubleshooting: {
      common_issues: [
        {
          symptom: "predicted_doublet_rate > 15%",
          likely_cause:
            "期望双细胞率设置过高，或数据确实含有大量 doublet",
          diagnosis:
            "检查 expected_doublet_rate 参数。如果使用 10x 官方公式，约 0.8%/1000 cells",
          fix: "降低 expected_doublet_rate（如 0.04）。检查原始测序质量和细胞悬液制备",
          severity: "blocking",
        },
        {
          symptom: "score_separation < 0.1",
          likely_cause:
            "数据异质性高或 doublet 与 singlet 转录组差异小",
          diagnosis:
            "查看 score 分布直方图。如果只有一个峰，可能所有细胞都是 singlet（或无 doublet）",
          fix: "调整 sim_doublet_ratio 和 min_gene_variability_pctl。考虑使用 DoubletFinder（基于 pN-pK）作为替代",
          severity: "warning",
        },
        {
          symptom: "n_singlets < 100",
          likely_cause: "过滤后细胞数极少，可能 QC 阶段过度过滤",
          diagnosis:
            "检查上游 QC 过滤是否过于激进。确认输入数据是有 QC 过滤后的结果",
          fix: "放宽上游 QC 过滤阈值（如 min_genes 从 200 → 100）。检查是否误将正常细胞当作 doublet",
          severity: "blocking",
        },
        {
          symptom: "MemoryError",
          likely_cause: "数据量过大（>50000 cells）导致内存不足",
          diagnosis:
            "Scrublet 的 kNN 图构建在内存中完成，大数据集需更多 RAM",
          fix: "增加容器内存限制。对超大样本进行随机下采样预处理",
          severity: "blocking",
        },
      ],
    },

    dependencies: {
      requires: ["scrna-qc"],
      recommends: ["scrna-normalize"],
      conflicts: [],
    },

    resourceEstimate: {
      cpu: "4",
      ram: "8GB",
      disk: "2GB",
      time: "5-30 min",
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
      tool: "scrublet.Scrublet",
      reason:
        "Scrublet is the standard doublet detection tool for scRNA-seq — fast and reliable for datasets up to 100k cells",
      image: this.spec.tools.dockerImages["scrublet"].image,
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
      expected_doublet_rate:
        this.spec.parameters.defaults["expected_doublet_rate"] ?? 0.06,
      sim_doublet_ratio:
        this.spec.parameters.defaults["sim_doublet_ratio"] ?? 2.0,
      min_counts:
        this.spec.parameters.defaults["min_counts"] ?? 3,
      min_cells:
        this.spec.parameters.defaults["min_cells"] ?? 3,
      min_gene_variability_pctl:
        this.spec.parameters.defaults["min_gene_variability_pctl"] ?? 85,
      n_prin_comps:
        this.spec.parameters.defaults["n_prin_comps"] ?? 30,
    };
  }

  // -------------------------------------------------------------------------
  // ④ run
  // -------------------------------------------------------------------------

  async run(context: SkillContext): Promise<SkillExecResult> {
    const { inputPath, outputPath } = context.data;
    const expectedDoubletRate =
      (context.params["expected_doublet_rate"] as number) ?? 0.06;
    const simDoubletRatio =
      (context.params["sim_doublet_ratio"] as number) ?? 2.0;
    const minCounts = (context.params["min_counts"] as number) ?? 3;
    const minCells = (context.params["min_cells"] as number) ?? 3;
    const minGeneVariabilityPctl =
      (context.params["min_gene_variability_pctl"] as number) ?? 85;
    const nPrinComps = (context.params["n_prin_comps"] as number) ?? 30;

    const pythonScript = `
import scrublet as scr
import scanpy as sc
import numpy as np
import json
import os
import warnings
warnings.filterwarnings('ignore')

input_path = "${inputPath}"
output_path = "${outputPath}"

# Load data
adata = sc.read_h5ad(input_path)

# Basic filtering if not already done
sc.pp.filter_cells(adata, min_counts=${minCounts})
sc.pp.filter_genes(adata, min_cells=${minCells})

n_total_cells = adata.n_obs
print(f"Total cells loaded: {n_total_cells}")

# Initialize Scrublet
# expected_doublet_rate based on 10x guideline: ~0.8% per 1000 cells recovered
scrub = scr.Scrublet(
    adata.X.toarray() if hasattr(adata.X, 'toarray') else adata.X,
    expected_doublet_rate=${expectedDoubletRate},
    sim_doublet_ratio=${simDoubletRatio},
    n_neighbors=None,  # auto-compute: round(0.5 * sqrt(n_cells))
    n_prin_comps=${nPrinComps}
)

# Run doublet prediction
doublet_scores, predicted_doublets = scrub.scrub_doublets(
    min_counts=${minCounts},
    min_cells=${minCells},
    min_gene_variability_pctl=${minGeneVariabilityPctl},
    n_prin_comps=${nPrinComps}
)

# Get threshold
threshold = scrub.threshold_ if scrub.threshold_ is not None else 0.0

# Store results in AnnData
adata.obs['doublet_score'] = doublet_scores
adata.obs['predicted_doublet'] = predicted_doublets.astype(bool)

n_singlets = int(np.sum(~predicted_doublets))
n_doublets = int(np.sum(predicted_doublets))
predicted_doublet_rate = round(100 * n_doublets / n_total_cells, 2) if n_total_cells > 0 else 0

# Compute score separation (difference between median scores of singlet vs doublet)
singlet_scores = doublet_scores[~predicted_doublets]
doublet_scores_only = doublet_scores[predicted_doublets]

if len(singlet_scores) > 0 and len(doublet_scores_only) > 0:
    singlet_median = float(np.median(singlet_scores))
    doublet_median = float(np.median(doublet_scores_only))
    score_separation = round(doublet_median - singlet_median, 4)
else:
    singlet_median = float(np.median(singlet_scores)) if len(singlet_scores) > 0 else 0
    doublet_median = 0
    score_separation = 0

# Build histogram data for visualization
hist_counts, hist_bins = np.histogram(doublet_scores, bins=50)
histogram_data = {
    "counts": hist_counts.tolist(),
    "bins": hist_bins.tolist(),
    "threshold": float(threshold),
}

# Build report
report = {
    "n_total_cells": int(n_total_cells),
    "n_singlets": int(n_singlets),
    "n_doublets": int(n_doublets),
    "predicted_doublet_rate": float(predicted_doublet_rate),
    "threshold": float(threshold),
    "score_separation": float(score_separation),
    "singlet_median_score": float(singlet_median),
    "doublet_median_score": float(doublet_median),
    "parameters": {
        "expected_doublet_rate": ${expectedDoubletRate},
        "sim_doublet_ratio": ${simDoubletRatio},
        "n_prin_comps": ${nPrinComps},
    }
}

# Write outputs
with open(os.path.join(output_path, "doublet_report.json"), "w") as f:
    json.dump(report, f, indent=2)

with open(os.path.join(output_path, "scrublet_histogram_data.json"), "w") as f:
    json.dump(histogram_data, f)

output_file = os.path.join(output_path, "doublet_annotated.h5ad")
adata.write(output_file)
print(f"Written: {output_file}")
print(f"Doublets: {n_doublets}/{n_total_cells} ({predicted_doublet_rate}%)")

print(json.dumps(report))
`.trim();

    const dockerResult = await this.execInContainer(context, pythonScript);

    const parsedData = this.parseJSONFromStdout(dockerResult.stdout);

    const metrics: Record<string, number> = {
      n_total_cells:
        typeof parsedData["n_total_cells"] === "number"
          ? (parsedData["n_total_cells"] as number)
          : 0,
      n_singlets:
        typeof parsedData["n_singlets"] === "number"
          ? (parsedData["n_singlets"] as number)
          : 0,
      n_doublets:
        typeof parsedData["n_doublets"] === "number"
          ? (parsedData["n_doublets"] as number)
          : 0,
      predicted_doublet_rate:
        typeof parsedData["predicted_doublet_rate"] === "number"
          ? (parsedData["predicted_doublet_rate"] as number)
          : 0,
      threshold:
        typeof parsedData["threshold"] === "number"
          ? (parsedData["threshold"] as number)
          : 0,
      score_separation:
        typeof parsedData["score_separation"] === "number"
          ? (parsedData["score_separation"] as number)
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

    const total = results.metrics["n_total_cells"] ?? 0;
    const singlets = results.metrics["n_singlets"] ?? 0;
    const doublets = results.metrics["n_doublets"] ?? 0;
    const rate = results.metrics["predicted_doublet_rate"] ?? 0;
    const separation = results.metrics["score_separation"] ?? 0;

    logs.push(
      `Doublet detection: ${total} cells → ${singlets} singlets, ${doublets} doublets (${rate}%)`,
    );
    logs.push(`Score separation: ${separation.toFixed(4)}`);
    logs.push(
      `QC overall: ${qc.overall} (${qc.passed}P/${qc.warned}W/${qc.failed}F)`,
    );

    return {
      files: [
        {
          path: `${results.parsedData["output_path"] ?? ""}/doublet_annotated.h5ad`,
          format: "h5ad",
          size_bytes: 0,
        },
        ...(results.exitCode === 0
          ? [
              {
                path: `${results.parsedData["output_path"] ?? ""}/doublet_report.json`,
                format: "json",
                size_bytes: 0,
              },
              {
                path: `${results.parsedData["output_path"] ?? ""}/scrublet_histogram_data.json`,
                format: "json",
                size_bytes: 0,
              },
            ]
          : []),
      ],
      metrics: {
        n_total_cells: total,
        n_singlets: singlets,
        n_doublets: doublets,
        predicted_doublet_rate: rate,
        threshold: results.metrics["threshold"],
        score_separation: separation,
      },
      logs,
    };
  }
}
