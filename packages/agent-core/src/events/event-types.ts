// ============================================================
// @bioagent/agent-core — BioAgent Event Types
// ============================================================

/** BioAgent 事件类型枚举 */
export enum BioAgentEventType {
  // ---- Thinking ----
  /** 思考过程开始 */
  THINKING_STARTED = "thinking:started",
  /** 思考过程中单个 section 完成 */
  THINKING_SECTION = "thinking:section",
  /** 思考过程结束 */
  THINKING_COMPLETED = "thinking:completed",

  // ---- Message ----
  /** 消息流开始 */
  MESSAGE_START = "message:start",
  /** 消息流中的一个 chunk */
  MESSAGE_CHUNK = "message:chunk",
  /** 消息流结束 */
  MESSAGE_END = "message:end",

  // ---- Tool Call ----
  /** 工具调用开始 */
  TOOL_CALL_START = "tool:start",
  /** 工具调用进度更新 */
  TOOL_CALL_PROGRESS = "tool:progress",
  /** 工具调用结束 */
  TOOL_CALL_END = "tool:end",

  // ---- Workflow ----
  /** 工作流启动 */
  WORKFLOW_STARTED = "workflow:started",
  /** 工作流中一个节点开始 */
  WORKFLOW_NODE_START = "workflow:node:start",
  /** 工作流中一个节点结束 */
  WORKFLOW_NODE_END = "workflow:node:end",
  /** 工作流暂停 */
  WORKFLOW_PAUSED = "workflow:paused",
  /** 工作流恢复 */
  WORKFLOW_RESUMED = "workflow:resumed",
  /** 工作流正常完成 */
  WORKFLOW_COMPLETED = "workflow:completed",
  /** 工作流失败 */
  WORKFLOW_FAILED = "workflow:failed",

  // ---- QC ----
  /** 质控报告 */
  QC_REPORT = "qc:report",
  /** 质控警告 */
  QC_WARNING = "qc:warning",
  /** 质控失败 */
  QC_FAILED = "qc:failed",

  // ---- Visualization ----
  /** 可视化结果就绪 */
  VIZ_READY = "viz:ready",

  // ---- Knowledge ----
  /** 知识引用 */
  KNOWLEDGE_REF = "knowledge:reference",

  // ---- Error ----
  /** 通用错误 */
  ERROR = "error",
  /** 可恢复错误 */
  ERROR_RECOVERABLE = "error:recoverable",
  /** 致命错误 */
  ERROR_FATAL = "error:fatal",
}
