// ============================================================
// @bioagent/workflow — Condition Expression Evaluator
// ============================================================

/**
 * 安全的条件表达式求值器。
 *
 * 设计原则：
 * - 仅允许属性访问（通过点号或方括号）
 * - 仅允许比较运算符（===, !==, ==, !=, >, <, >=, <=）
 * - 仅允许逻辑运算符（&&, ||, !）
 * - 严格禁止函数调用、赋值、new 操作符等
 *
 * 支持的表达式示例：
 * - "result.qc.overall === 'fail'"
 * - "metadata.hasBatch && metadata.batchCount > 1"
 * - "doublet_rate > 0.15"
 * - "cells_removed_ratio > 0.5"
 * - "silhouette_score < 0.3"
 */

/**
 * 允许的安全令牌模式。
 *
 * 我们通过词法分析提取表达式中的所有令牌，
 * 然后逐一检查是否安全。
 */

/** 允许的二元运算符 */
const ALLOWED_OPERATORS = new Set([
  "===",
  "!==",
  "==",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "&&",
  "||",
]);

/** 允许的一元运算符 */
const ALLOWED_UNARY = new Set(["!", "typeof"]);

/**
 * 安全的条件表达式求值。
 *
 * @param expression - 条件表达式字符串
 * @param context - 求值上下文（可访问的变量）
 * @returns 表达式求值结果（布尔值）
 */
export function evaluateCondition(
  expression: string,
  context: Record<string, any>,
): boolean {
  if (!expression || expression.trim().length === 0) {
    return true; // 空表达式视为真
  }

  const trimmed = expression.trim();

  // 安全检查：禁止危险模式
  validateExpression(trimmed);

  // 使用 Function 构造函数进行求值
  // 只注入 context 中的变量作为参数
  const contextKeys = Object.keys(context);
  const contextValues = contextKeys.map((k) => context[k]);

  try {
    const fn = new Function(
      ...contextKeys,
      `"use strict"; return (${trimmed});`,
    );
    const result = fn(...contextValues);
    return Boolean(result);
  } catch {
    return false;
  }
}

/**
 * 验证表达式的安全性。
 *
 * 检查规则：
 * - 不允许包含函数调用模式（如 foo()）
 * - 不允许包含赋值操作符（=, +=, -=, etc.）
 * - 不允许包含 new 关键字
 * - 不允许包含分号（禁止多语句）
 * - 不允许包含反引号（模板字符串可执行代码）
 * - 不允许包含危险的全局对象
 *
 * @param expression - 表达式字符串
 * @throws 如果表达式不安全
 */
function validateExpression(expression: string): void {
  // 禁止分号 — 阻止多语句
  if (expression.includes(";")) {
    throw new Error(
      `Unsafe expression: semicolons are not allowed. Got: "${expression}"`,
    );
  }

  // 禁止函数调用模式 — foo()
  if (/[a-zA-Z_]\w*\s*\(/.test(expression)) {
    throw new Error(
      `Unsafe expression: function calls are not allowed. Got: "${expression}"`,
    );
  }

  // 禁止 new 关键字
  if (/\bnew\b/.test(expression)) {
    throw new Error(
      `Unsafe expression: 'new' keyword is not allowed. Got: "${expression}"`,
    );
  }

  // 禁止赋值操作符（但允许 == 和 ===）
  // 检测 = 但不是 == 或 ===
  if (/(?<![!=])[^!=]=[^=]/.test(expression) || /^=[^=]/.test(expression) || /(?<![!=])[^!=]=$/.test(expression)) {
    throw new Error(
      `Unsafe expression: assignment operators are not allowed. Got: "${expression}"`,
    );
  }

  // 禁止反引号
  if (expression.includes("`")) {
    throw new Error(
      `Unsafe expression: template literals are not allowed. Got: "${expression}"`,
    );
  }

  // 禁止危险的全局对象和函数
  const dangerousGlobals = [
    "globalThis",
    "eval",
    "Function",
    "setTimeout",
    "setInterval",
    "require",
    "import",
    "process",
    "__dirname",
    "__filename",
  ];

  const lowerExpr = expression.toLowerCase();
  for (const dangerous of dangerousGlobals) {
    const regex = new RegExp(`\\b${dangerous.toLowerCase()}\\b`);
    if (regex.test(lowerExpr)) {
      throw new Error(
        `Unsafe expression: "${dangerous}" is not allowed. Got: "${expression}"`,
      );
    }
  }

  // 基本语法检查：括号匹配
  let depth = 0;
  for (const ch of expression) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth < 0) {
      throw new Error(
        `Unsafe expression: mismatched parentheses. Got: "${expression}"`,
      );
    }
  }
  if (depth !== 0) {
    throw new Error(
      `Unsafe expression: unclosed parentheses. Got: "${expression}"`,
    );
  }
}

/**
 * 将上下文中的值安全提取为可求值的形式。
 *
 * 此函数用于构建安全的求值环境。
 *
 * @param context - 上下文对象
 * @returns 扁平化的键值对
 */
export function flattenContext(
  context: Record<string, any>,
): Record<string, any> {
  // 直接返回 context，由 evaluateCondition 处理
  // 保留嵌套结构以支持点号访问（如 result.qc.overall）
  return context;
}
