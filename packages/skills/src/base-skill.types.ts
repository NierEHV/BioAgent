// ============================================================
// @bioagent/skills — Core Type Definitions
// ============================================================

import type { ContainerManager, ResourceReport } from "@bioagent/executor";

// ---------------------------------------------------------------------------
// DataContext — 输入/输出路径上下文
// ---------------------------------------------------------------------------

/**
 * Skill 执行时传入的数据上下文，描述输入数据位置和输出目标位置。
 */
export interface DataContext {
  /** 输入文件或目录的绝对路径（容器内路径） */
  inputPath: string;
  /** 输出目录的绝对路径（容器内路径） */
  outputPath: string;
  /** 中间结果目录的绝对路径（容器内路径），用于存放中间 h5ad 等文件 */
  intermediatePath: string;
  /** 附加元数据，如样本名称、实验条件等 */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// SkillContext — Skill 执行的完整上下文
// ---------------------------------------------------------------------------

/**
 * Skill 执行的完整运行时上下文，包含容器管理、数据路径和资源信息。
 */
export interface SkillContext {
  /** 要执行的 Skill 名称 */
  skillName: string;
  /** 传给 Skill 的额外参数 */
  params: Record<string, unknown>;
  /** 数据上下文 */
  data: DataContext;
  /** 目标 Docker 容器名称 */
  containerName: string;
  /** 容器管理器实例，用于在容器内执行命令 */
  containerManager: ContainerManager;
  /** 宿主机资源探测报告 */
  resources: ResourceReport;
  /** 是否强制执行（跳过某些安全确认） */
  force: boolean;
}

// ---------------------------------------------------------------------------
// SkillSpec — Skill 静态元数据描述
// ---------------------------------------------------------------------------

/**
 * JSON Schema 简化类型（用于输入校验）。
 */
export type JSONSchema = Record<string, unknown>;

/**
 * Skill 规格描述，定义 Skill 的元数据、输入约束、工具选择、QC 关卡等。
 * 设计文档 §8.1。
 */
export interface SkillSpec {
  /** Skill 唯一名称，如 "data-import"、"scrna-qc" */
  name: string;
  /** 语义版本号，如 "1.0.0" */
  version: string;
  /** Skill 功能的人类可读描述 */
  description: string;
  /** 目标组学类型（MVP 仅 scRNA-seq） */
  omicsType:
    | "scrna"
    | "bulk-rna"
    | "atac"
    | "chipseq"
    | "wgs"
    | "proteomics"
    | "metabolomics"
    | "microbiome";

  /** 输入定义 */
  input: {
    /** 输入数据的 JSON Schema，用于校验输入结构 */
    schema: JSONSchema;
    /** 最小样本数 */
    minSamples?: number;
    /** 最大样本数 */
    maxSamples?: number;
    /** 接受的文件格式列表，如 ["h5ad", "h5", "mtx", "rds"] */
    acceptedFormats: string[];
    /** 必需的元数据列名 */
    requiredMetadataColumns?: string[];
    /** 预估输入大小（人类可读），如 "100MB" */
    estimatedInputSize?: string;
  };

  /** 工具定义 */
  tools: {
    /** 首选工具名称 */
    primary: string;
    /** 备选工具列表 */
    alternatives: string[];
    /** 工具选择决策树 */
    decisionTree: {
      /** 触发条件（人类可读），如 "文件为 .h5ad" */
      condition: string;
      /** 满足条件时选择的工具 */
      tool: string;
      /** 选择理由 */
      reason: string;
    }[];
    /** 工具所需的 Docker 镜像映射 */
    dockerImages: Record<
      string,
      {
        /** 镜像名称（含 tag） */
        image: string;
        /** 备用镜像（主镜像不可用时） */
        fallbackImage?: string;
        /** 最低版本要求 */
        minVersion?: string;
      }
    >;
  };

  /** 参数定义 */
  parameters: {
    /** 默认参数值键值对 */
    defaults: Record<string, unknown>;
    /** 参数说明映射 */
    descriptions: Record<string, string>;
    /** 参数约束 */
    constraints: Record<
      string,
      {
        /** 最小值 */
        min?: number;
        /** 最大值 */
        max?: number;
        /** 允许的值列表 */
        allowedValues?: unknown[];
      }
    >;
    /** 参数调优策略说明 */
    tuningStrategy?: string;
  };

  /** QC 关卡列表 */
  qcGates: QCGate[];

  /** 输出定义 */
  outputs: {
    /** 输出文件列表 */
    files: {
      /** 文件名 */
      name: string;
      /** 文件格式 */
      format: string;
      /** 文件说明 */
      description: string;
      /** 是否必须生成 */
      required: boolean;
    }[];
    /** 可视化输出类型 */
    visualizations: {
      /** 可视化类型 */
      type: "umap" | "volcano" | "heatmap" | "violin" | "dotplot" | "barplot" | "scatter";
      /** 可视化说明 */
      description: string;
    }[];
    /** 输出指标列表 */
    metrics: {
      /** 指标名称 */
      name: string;
      /** 指标说明 */
      description: string;
      /** 单位（可选） */
      unit?: string;
    }[];
  };

  /** 故障排除指南 */
  troubleshooting: {
    common_issues: TroubleshootingIssue[];
  };

  /** 依赖关系 */
  dependencies: {
    /** 必须前置运行的 Skill 名称列表（硬依赖） */
    requires: string[];
    /** 推荐前置运行的 Skill 名称列表（软依赖） */
    recommends: string[];
    /** 不可同时运行的 Skill 名称列表（冲突） */
    conflicts: string[];
  };

  /** 资源估算 */
  resourceEstimate: {
    /** CPU 核心数，如 "2" */
    cpu: string;
    /** 内存，如 "4GB" */
    ram: string;
    /** 磁盘空间，如 "1GB" */
    disk: string;
    /** 预计耗时，如 "1-5 min" */
    time: string;
    /** GPU 需求 */
    gpu: "required" | "optional" | "not_needed";
  };
}

// ---------------------------------------------------------------------------
// QCGate — QC 关卡定义
// ---------------------------------------------------------------------------

/**
 * 单个 QC 关卡定义。
 * 每个 Skill 可包含 0 到多个 QC 关卡，按顺序执行。
 */
export interface QCGate {
  /** 关卡唯一 ID */
  id: string;
  /** 关卡名称（人类可读），如 "数据维度检查" */
  name: string;
  /** 关卡说明 */
  description: string;
  /** 检查规则 */
  check: {
    /** 检查类型 */
    type: "threshold" | "range" | "distribution" | "custom";
    /** 检查表达式（JS 可求值），如 "n_cells > 0 && n_genes > 0" */
    expression: string;
    /** 检查的指标名称 */
    metric: string;
  };
  /** 关卡严重级别 */
  level: "pass" | "warn" | "fail";
  /** 通过时的描述信息 */
  onPass: string;
  /** 失败时的描述信息 */
  onFail: string;
  /** 是否可自动修复 */
  fixable: boolean;
  /** 自动修复命令（容器内执行），仅 fixable 为 true 时有效 */
  autoFixCommand?: string;
  /** 关联的可视化 */
  visualization?: {
    /** 可视化类型 */
    type: string;
    /** 可视化说明 */
    description: string;
  };
}

// ---------------------------------------------------------------------------
// TroubleshootingIssue — 故障排除条目
// ---------------------------------------------------------------------------

/**
 * 常见问题及排除方案。
 */
export interface TroubleshootingIssue {
  /** 症状描述，如 "FileNotFoundError" */
  symptom: string;
  /** 可能原因 */
  likely_cause: string;
  /** 诊断方法 */
  diagnosis: string;
  /** 修复方案 */
  fix: string;
  /** 严重程度 */
  severity: "blocking" | "warning" | "info";
}

// ---------------------------------------------------------------------------
// ValidationResult — 输入校验结果
// ---------------------------------------------------------------------------

/**
 * validateInput() 的返回类型。
 */
export interface ValidationResult {
  /** 是否通过校验 */
  valid: boolean;
  /** 校验错误列表 */
  errors: string[];
  /** 校验警告列表 */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// ToolChoice — 工具选择结果
// ---------------------------------------------------------------------------

/**
 * selectTool() 的返回类型。
 * 表示决策树分析后选出的工具及相关 Docker 镜像。
 */
export interface ToolChoice {
  /** 选中的工具名称，如 "scanpy.read_h5ad" */
  tool: string;
  /** 选择理由 */
  reason: string;
  /** 需要使用的 Docker 镜像 */
  image: string;
}

// ---------------------------------------------------------------------------
// ExecResult — Skill 执行阶段的结果
// ---------------------------------------------------------------------------

/**
 * Skill run() 方法的返回类型。
 * 包含 Docker 命令执行结果和解析后的结构化数据。
 */
export interface SkillExecResult {
  /** Docker exec 退出码（0 = 成功） */
  exitCode: number;
  /** 标准输出原文 */
  stdout: string;
  /** 标准错误原文 */
  stderr: string;
  /** 解析后的输出数据（从 Python JSON 输出解析） */
  parsedData: Record<string, unknown>;
  /** 提取的指标 */
  metrics: Record<string, number>;
}

// ---------------------------------------------------------------------------
// QCGateResult — 单个 QC 关卡的执行结果
// ---------------------------------------------------------------------------

/**
 * 单个 QC 关卡检查后的结果。
 */
export interface QCGateResult {
  /** 关卡 ID */
  id: string;
  /** 关卡名称 */
  name: string;
  /** 检查结果 */
  result: "pass" | "warn" | "fail";
  /** 实际值 */
  actualValue?: unknown;
  /** 期望值 */
  expectedValue?: unknown;
  /** 详细信息 */
  detail: string;
}

// ---------------------------------------------------------------------------
// QCReport — QC 报告
// ---------------------------------------------------------------------------

/**
 * runQC() 的返回类型。
 * 聚合所有 QC 关卡的结果。
 */
export interface QCReport {
  /** 总体结论 */
  overall: "pass" | "warn" | "fail";
  /** 各关卡结果 */
  gates: QCGateResult[];
  /** 通过关卡数 */
  passed: number;
  /** 警告关卡数 */
  warned: number;
  /** 失败关卡数 */
  failed: number;
  /** 总关卡数 */
  total: number;
}

// ---------------------------------------------------------------------------
// SkillOutputFile — 输出文件描述
// ---------------------------------------------------------------------------

/**
 * Skill 输出的单个文件描述。
 */
export interface SkillOutputFile {
  /** 文件路径（容器内绝对路径） */
  path: string;
  /** 文件格式 */
  format: string;
  /** 文件大小（字节） */
  size_bytes: number;
}

// ---------------------------------------------------------------------------
// SkillOutput — Skill 格式化输出
// ---------------------------------------------------------------------------

/**
 * formatOutput() 的返回类型。
 */
export interface SkillOutput {
  /** 输出文件列表 */
  files: SkillOutputFile[];
  /** 输出指标键值对 */
  metrics: Record<string, unknown>;
  /** 执行日志 */
  logs: string[];
}

// ---------------------------------------------------------------------------
// SkillResult — Skill 执行的完整结果
// ---------------------------------------------------------------------------

/**
 * Skill execute() 的最终返回类型。
 * 包含执行状态、QC 报告、输出和后续建议。
 */
export interface SkillResult {
  /** Skill 名称 */
  skillName: string;
  /** Skill 版本 */
  skillVersion: string;
  /** 执行状态 */
  status: "success" | "partial" | "failed" | "error";
  /** QC 报告 */
  qcReport: QCReport;
  /** 格式化输出 */
  outputs: SkillOutput;
  /** 后续步骤建议 */
  nextSteps: string[];
  /** 执行耗时（毫秒） */
  duration: number;
  /** 执行时间（ISO 8601） */
  executedAt: string;
  /** 错误信息（仅在 status 为 error 时有值） */
  error?: string;
}
