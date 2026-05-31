// ============================================================
// @bioagent/workflow — Error Policy Application
// ============================================================

import type {
  WorkflowNode,
  WorkflowState,
  ErrorPolicy,
} from "./engine.types.js";

/**
 * 应用错误策略的结果。
 */
export interface ErrorPolicyResult {
  /** 推荐动作 */
  action: "retry" | "skip" | "pause" | "abort";
  /** 描述消息 */
  message: string;
}

/**
 * 根据节点配置、错误信息和全局策略决定下一步动作。
 *
 * 决策逻辑：
 * 1. 如果节点有自己的 retry 配置，优先使用节点配置
 * 2. 如果节点重试次数未耗尽 → retry
 * 3. 如果节点是 optional 且 skipOptional 为 true → skip
 * 4. 如果 onExhausted 为 "skip" → skip
 * 5. 如果 onExhausted 为 "pause_and_ask" → pause
 * 6. 否则 → abort
 *
 * @param node - 失败的节点
 * @param error - 错误对象
 * @param state - 当前工作流状态
 * @param policy - 全局错误策略
 * @returns 错误策略结果
 */
export function applyErrorPolicy(
  node: WorkflowNode,
  error: Error,
  state: WorkflowState,
  policy: ErrorPolicy,
): ErrorPolicyResult {
  const nodeState = state.nodeStates.get(node.id);
  const currentRetries = nodeState?.retryCount ?? 0;

  // 确定节点的有效重试配置
  const maxRetries = node.retry?.maxAttempts ?? policy.maxRetries;
  const retryDelayMs = node.retry?.delayMs ?? policy.retryDelayMs;

  // 1. 如果还可以重试
  if (currentRetries < maxRetries) {
    const backoff = node.retry?.backoff ?? "fixed";
    const waitMs =
      backoff === "exponential"
        ? retryDelayMs * Math.pow(2, currentRetries)
        : retryDelayMs;

    return {
      action: "retry",
      message: [
        `Node "${node.id}" failed (attempt ${currentRetries + 1}/${maxRetries}).`,
        `Error: ${error.message}`,
        `Retrying in ${(waitMs / 1000).toFixed(1)}s with ${backoff} backoff...`,
      ].join(" "),
    };
  }

  // 2. 重试已耗尽 — 根据 onExhausted 策略决定

  // 可选节点优先跳过
  if (node.optional && policy.skipOptional) {
    return {
      action: "skip",
      message: [
        `Optional node "${node.id}" failed after ${maxRetries} retries.`,
        `Error: ${error.message}`,
        "Skipping (skipOptional is enabled).",
      ].join(" "),
    };
  }

  // 根据全局策略
  switch (policy.onExhausted) {
    case "skip":
      return {
        action: "skip",
        message: [
          `Node "${node.id}" failed after ${maxRetries} retries.`,
          `Error: ${error.message}`,
          "Skipping (onExhausted policy is 'skip').",
        ].join(" "),
      };

    case "pause_and_ask":
      return {
        action: "pause",
        message: [
          `Node "${node.id}" failed after ${maxRetries} retries.`,
          `Error: ${error.message}`,
          "Workflow paused. Waiting for user decision.",
        ].join(" "),
      };

    case "abort":
    default:
      return {
        action: "abort",
        message: [
          `Node "${node.id}" failed after ${maxRetries} retries.`,
          `Error: ${error.message}`,
          "Aborting workflow (onExhausted policy is 'abort').",
        ].join(" "),
      };
  }
}

/**
 * 检查是否需要发送警告通知。
 *
 * @param policy - 错误策略
 * @param message - 警告消息
 * @returns 格式化的通知消息，不需要通知时返回 null
 */
export function buildWarningNotification(
  policy: ErrorPolicy,
  message: string,
): string | null {
  if (!policy.notifyOnWarning) return null;
  return `[WARNING] ${message}`;
}
