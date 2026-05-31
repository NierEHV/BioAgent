// ============================================================
// @bioagent/agent-core — Core Type Definitions
// ============================================================

/** BioAgent 全局配置 */
export interface BioAgentConfig {
  /** 默认大模型 ID，例如 "claude-sonnet-4-6" */
  model: string;
  /** 每次生成的最大 token 数 */
  maxTokens: number;
  /** 思考预算级别 */
  thinkingBudget: "off" | "low" | "medium" | "high" | "xhigh";
  /** 模型温度（0-1），越低越确定 */
  temperature: number;
  /** 会话文件存储目录 */
  sessionDir: string;
  /** 项目根目录 */
  projectDir: string;
  /** 单次会话的最大消息条数 */
  maxSessionLength: number;
  /** 是否在达到阈值时自动压缩会话 */
  autoCompress: boolean;
  /** 是否需要对危险操作进行二次确认 */
  requireConfirmation: boolean;
  /** 最大并行 Skill 数量 */
  maxParallelSkills: number;
  /** 默认工具调用超时（毫秒） */
  defaultTimeout: number;
}

/** 7-step 思考模板中一个 Section 的结构 */
export interface ThinkingSection {
  /** Section 序号，1-7 */
  index: number;
  /** Section 标题，如 "科学问题还原" */
  title: string;
  /** Section 内容（Markdown 文本） */
  content: string;
}

/** 分析路径评估 */
export interface AnalysisPath {
  /** 分析路径名称 */
  name: string;
  /** 该路径需要用到的工具 */
  tools: string[];
  /** 优势列表 */
  pros: string[];
  /** 劣势列表 */
  cons: string[];
  /** 统计功效 */
  statisticalPower: string;
  /** 资源需求 */
  resourceRequirement: string;
  /** 适用场景 */
  applicability: string;
}

/** 分析风险 */
export interface Risk {
  /** 风险类别 */
  category: "technical" | "statistical" | "biological";
  /** 风险描述 */
  description: string;
  /** 缓解策略 */
  mitigation: string;
}

/** 参考文献 */
export interface Reference {
  /** 文献类型 */
  type: "paper" | "docs" | "database";
  /** 标题 */
  title: string;
  /** DOI */
  doi?: string;
  /** URL */
  url?: string;
}
