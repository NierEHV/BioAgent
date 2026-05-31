// ============================================================
// @bioagent/skills — DataImportSkill
// ============================================================

import { BaseSkill } from "../base-skill";
import type {
  SkillSpec,
  SkillContext,
  SkillExecResult,
  QCReport,
  SkillOutput,
  ValidationResult,
  ToolChoice,
  DataContext,
} from "../base-skill.types";
import type { ResourceReport } from "@bioagent/executor";

/**
 * 数据导入 Skill。
 *
 * 导入 scRNA-seq 数据，支持 10x mtx/h5/h5ad/rds 格式。
 * 根据文件扩展名自动选择合适的 Scanpy 读取方法。
 */
export class DataImportSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "data-import",
    version: "1.0.0",
    description:
      "导入 scRNA-seq 数据（10x mtx/h5/h5ad/rds），统一转换为 h5ad 格式",
    omicsType: "scrna",

    input: {
      acceptedFormats: ["h5ad", "h5", "mtx", "rds"],
      schema: {},
      minSamples: 1,
      maxSamples: 10,
      estimatedInputSize: "100MB-5GB",
    },

    tools: {
      primary: "scanpy.read_10x_mtx",
      alternatives: ["scanpy.read_10x_h5", "scanpy.read_h5ad"],
      decisionTree: [
        {
          condition: "文件为 .h5ad",
          tool: "scanpy.read_h5ad",
          reason: "AnnData 原生格式，直接读取无需转换",
        },
        {
          condition: "文件为 .h5 (10x)",
          tool: "scanpy.read_10x_h5",
          reason: "10x HDF5 格式，直接读取基因表达矩阵",
        },
        {
          condition: "目录含 mtx + barcodes + features/genes",
          tool: "scanpy.read_10x_mtx",
          reason: "10x mtx 稀疏矩阵格式，需搭配条形码和特征文件",
        },
        {
          condition: "文件为 .rds",
          tool: "pyreadr.read_rds",
          reason: "R 序列化格式，需通过 pyreadr 转换后构建 AnnData",
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
        output_format: "h5ad",
        compression: "gzip",
      },
      descriptions: {
        output_format: "输出文件格式（固定为 h5ad）",
        compression: "h5ad 内部压缩方式（gzip/lzf/none）",
      },
      constraints: {
        output_format: { allowedValues: ["h5ad"] },
        compression: { allowedValues: ["gzip", "lzf", "none"] },
      },
    },

    qcGates: [
      {
        id: "shape_check",
        name: "数据维度检查",
        description: "确保导入的数据包含有效的细胞和基因",
        check: {
          type: "threshold",
          expression: "n_cells > 0 && n_genes > 0",
          metric: "shape",
        },
        level: "fail",
        onPass: "数据导入成功，包含有效细胞和基因",
        onFail: "数据为空（0 细胞或 0 基因），请检查输入文件格式和完整性",
        fixable: false,
      },
      {
        id: "size_sanity",
        name: "数据量合理性检查",
        description: "检查细胞数和基因数是否在合理范围内",
        check: {
          type: "range",
          expression:
            "n_cells >= 100 && n_cells <= 100000 && n_genes >= 1000 && n_genes <= 60000",
          metric: "size",
        },
        level: "warn",
        onPass: "数据量在合理范围内",
        onFail:
          "数据量异常（过少可能样本质量差，过多可能包含多个批次），请核实",
        fixable: false,
      },
    ],

    outputs: {
      files: [
        {
          name: "imported.h5ad",
          format: "h5ad",
          description: "导入的 AnnData 对象",
          required: true,
        },
        {
          name: "import_metrics.json",
          format: "json",
          description: "导入指标 JSON（细胞数、基因数、格式信息）",
          required: true,
        },
      ],
      visualizations: [],
      metrics: [
        { name: "n_cells", description: "细胞数量", unit: "cells" },
        { name: "n_genes", description: "基因数量", unit: "genes" },
        { name: "format", description: "检测到的输入格式" },
      ],
    },

    troubleshooting: {
      common_issues: [
        {
          symptom: "FileNotFoundError",
          likely_cause: "输入路径错误或文件未挂载到容器",
          diagnosis:
            "检查 inputPath 是否正确，确认文件存在于容器的 /data/input/ 目录下",
          fix: "使用绝对路径，确认数据卷挂载正确。在容器内执行 ls -la /data/input/ 验证文件存在性",
          severity: "blocking",
        },
        {
          symptom: "ValueError: Unknown format",
          likely_cause: "文件格式不识别或文件已损坏",
          diagnosis:
            "检查文件扩展名和内部结构。对于 mtx 目录，确认包含 matrix.mtx(.gz)、barcodes.tsv(.gz)、features.tsv.gz（或 genes.tsv.gz）",
          fix: "确认输入文件格式为 h5ad/h5/mtx/rds 之一。使用 file 命令检查文件类型，或尝试用 scanpy 的其他读取函数",
          severity: "blocking",
        },
        {
          symptom: "OSError: No space left",
          likely_cause: "输出磁盘空间不足",
          diagnosis:
            "检查 /data/output/ 所在卷的可用空间。h5ad 文件可能比原始 mtx 文件大",
          fix: "清理磁盘空间，或设置更大的输出目录挂载卷",
          severity: "blocking",
        },
        {
          symptom: "ImportError: No module named",
          likely_cause: "Docker 镜像缺少必要的 Python 包",
          diagnosis:
            "检查 Docker 镜像是否包含 scanpy 和 pyreadr 包",
          fix: "使用正确的 Docker 镜像（bioagent-scrna 或 shortcake_full）。确认镜像已 pull 到本地",
          severity: "blocking",
        },
      ],
    },

    dependencies: {
      requires: [],
      recommends: ["scrna-qc"],
      conflicts: [],
    },

    resourceEstimate: {
      cpu: "2",
      ram: "4GB",
      disk: "1GB",
      time: "1-5 min",
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
      errors.push("Input path is required.");
      return { valid: false, errors, warnings };
    }

    // Check if the input path has a recognizable extension
    const inputLower = data.inputPath.toLowerCase();
    const hasRecognizedExtension = this.spec.input.acceptedFormats.some(
      (fmt) => inputLower.endsWith(`.${fmt}`) || inputLower.includes(`.${fmt}`),
    );

    if (!hasRecognizedExtension) {
      // mtx directories don't have an extension
      const isMtxDir =
        inputLower.includes("mtx") ||
        inputLower.includes("filtered_feature_bc_matrix");

      if (!isMtxDir) {
        warnings.push(
          `Input path "${data.inputPath}" does not have a recognized extension (.${this.spec.input.acceptedFormats.join(", .")}). ` +
            `Will attempt to auto-detect format.`,
        );
      }
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
    data: DataContext,
    _resources: ResourceReport,
  ): Promise<ToolChoice> {
    const inputLower = data.inputPath.toLowerCase();

    // Decision tree evaluation
    if (inputLower.endsWith(".h5ad")) {
      return {
        tool: "scanpy.read_h5ad",
        reason: "h5ad is native AnnData format — direct read, no conversion needed",
        image: this.spec.tools.dockerImages["scanpy"].image,
      };
    }

    if (inputLower.endsWith(".h5")) {
      return {
        tool: "scanpy.read_10x_h5",
        reason: ".h5 file detected — using 10x HDF5 reader",
        image: this.spec.tools.dockerImages["scanpy"].image,
      };
    }

    if (inputLower.endsWith(".rds")) {
      return {
        tool: "pyreadr.read_rds",
        reason: ".rds file detected — converting from R serialized format via pyreadr",
        image: this.spec.tools.dockerImages["scanpy"].image,
      };
    }

    // Default: assume mtx directory
    return {
      tool: "scanpy.read_10x_mtx",
      reason:
        "No h5ad/h5/rds extension detected — treating as 10x mtx directory",
      image: this.spec.tools.dockerImages["scanpy"].image,
    };
  }

  // -------------------------------------------------------------------------
  // ③ configureParams
  // -------------------------------------------------------------------------

  async configureParams(
    data: DataContext,
    tool: ToolChoice,
  ): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = {
      input_path: data.inputPath,
      output_path: data.outputPath,
      output_file: `${data.outputPath}/imported.h5ad`,
      metrics_file: `${data.outputPath}/import_metrics.json`,
      tool: tool.tool,
      compression: this.spec.parameters.defaults["compression"],
    };
    return params;
  }

  // -------------------------------------------------------------------------
  // ④ run
  // -------------------------------------------------------------------------

  async run(context: SkillContext): Promise<SkillExecResult> {
    const { inputPath, outputPath } = context.data;
    const compression = (context.params["compression"] as string) ?? "gzip";
    const tool = (context.params["tool"] as string) ?? "scanpy.read_10x_mtx";

    // Build Python script based on selected tool
    let pythonScript: string;

    if (tool === "scanpy.read_h5ad") {
      pythonScript = `
import scanpy as sc
import json
import os

input_path = "${inputPath}"
output_path = "${outputPath}"

adata = sc.read_h5ad(input_path)

result = {
    "n_cells": adata.n_obs,
    "n_genes": adata.n_vars,
    "format": "h5ad",
    "method": "read_h5ad"
}

output_file = os.path.join(output_path, "imported.h5ad")
adata.write(output_file, compression="${compression}")
print(f"Written: {output_file}")

metrics_file = os.path.join(output_path, "import_metrics.json")
with open(metrics_file, "w") as f:
    json.dump(result, f)

print(json.dumps(result))
`.trim();
    } else if (tool === "scanpy.read_10x_h5") {
      pythonScript = `
import scanpy as sc
import json
import os

input_path = "${inputPath}"
output_path = "${outputPath}"

adata = sc.read_10x_h5(input_path)
adata.var_names_make_unique()

result = {
    "n_cells": adata.n_obs,
    "n_genes": adata.n_vars,
    "format": "10x_h5",
    "method": "read_10x_h5"
}

output_file = os.path.join(output_path, "imported.h5ad")
adata.write(output_file, compression="${compression}")
print(f"Written: {output_file}")

metrics_file = os.path.join(output_path, "import_metrics.json")
with open(metrics_file, "w") as f:
    json.dump(result, f)

print(json.dumps(result))
`.trim();
    } else if (tool === "scanpy.read_10x_mtx") {
      pythonScript = `
import scanpy as sc
import json
import os

input_path = "${inputPath}"
output_path = "${outputPath}"

adata = sc.read_10x_mtx(
    input_path,
    var_names="gene_symbols",
    cache=True,
    gex_only=True
)
adata.var_names_make_unique()

result = {
    "n_cells": adata.n_obs,
    "n_genes": adata.n_vars,
    "format": "10x_mtx",
    "method": "read_10x_mtx"
}

output_file = os.path.join(output_path, "imported.h5ad")
adata.write(output_file, compression="${compression}")
print(f"Written: {output_file}")

metrics_file = os.path.join(output_path, "import_metrics.json")
with open(metrics_file, "w") as f:
    json.dump(result, f)

print(json.dumps(result))
`.trim();
    } else if (tool === "pyreadr.read_rds") {
      pythonScript = `
import pyreadr
import scanpy as sc
import pandas as pd
import json
import os
import numpy as np

input_path = "${inputPath}"
output_path = "${outputPath}"

# Read RDS file
rdata = pyreadr.read_r(input_path)
# Convert to AnnData (assume first DataFrame is the count matrix)
adata = None
for key, df in rdata.items():
    if isinstance(df, pd.DataFrame):
        adata = sc.AnnData(df.values, obs=pd.DataFrame(index=df.index), var=pd.DataFrame(index=df.columns))
        break

if adata is None:
    raise ValueError("No DataFrame found in RDS file")

adata.var_names_make_unique()

result = {
    "n_cells": adata.n_obs,
    "n_genes": adata.n_vars,
    "format": "rds",
    "method": "pyreadr.read_rds"
}

output_file = os.path.join(output_path, "imported.h5ad")
adata.write(output_file, compression="${compression}")
print(f"Written: {output_file}")

metrics_file = os.path.join(output_path, "import_metrics.json")
with open(metrics_file, "w") as f:
    json.dump(result, f)

print(json.dumps(result))
`.trim();
    } else {
      throw new Error(`Unknown tool: ${tool}`);
    }

    // Execute in container
    const dockerResult = await this.execInContainer(context, pythonScript);

    // Parse the JSON output from stdout
    const parsedData = this.parseJSONFromStdout(dockerResult.stdout);

    const metrics: Record<string, number> = {};
    if (typeof parsedData["n_cells"] === "number") {
      metrics["n_cells"] = parsedData["n_cells"] as number;
    }
    if (typeof parsedData["n_genes"] === "number") {
      metrics["n_genes"] = parsedData["n_genes"] as number;
    }

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

    logs.push(
      `Import completed: ${results.metrics["n_cells"] ?? 0} cells, ${results.metrics["n_genes"] ?? 0} genes`,
    );
    logs.push(`QC overall: ${qc.overall} (${qc.passed}P/${qc.warned}W/${qc.failed}F)`);

    return {
      files: [
        {
          path: `${this.spec.parameters.defaults["output_path"] || ""}/imported.h5ad`,
          format: "h5ad",
          size_bytes: 0,
        },
        ...(results.exitCode === 0
          ? [
              {
                path: `${this.spec.parameters.defaults["output_path"] || ""}/import_metrics.json`,
                format: "json",
                size_bytes: 0,
              },
            ]
          : []),
      ],
      metrics: {
        ...results.metrics,
        format: results.parsedData["format"] ?? "unknown",
        method: results.parsedData["method"] ?? "unknown",
      },
      logs,
    };
  }
}
