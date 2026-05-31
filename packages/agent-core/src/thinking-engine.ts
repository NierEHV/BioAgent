// ============================================================
// @bioagent/agent-core — Thinking Engine
// ============================================================

import { THINKING_TEMPLATE, renderTemplate } from "./thinking-template";
import type { ThinkingSection } from "./types";

/** 思考引擎构建上下文 */
export interface ThinkingContext {
  /** 用户的自然语言问题 */
  userQuestion: string;
  /** 文件探测结果（JSON 字符串或对象） */
  fileInspectResult?: unknown;
  /** 宿主机资源报告（JSON 字符串或对象） */
  resourceReport?: unknown;
  /** 知识库查询结果（JSON 字符串或对象） */
  knowledgeResult?: unknown;
}

// ---------------------------------------------------------------------------
// ThinkingEngine
// ---------------------------------------------------------------------------

/**
 * 管理 7-step 结构化思考模板的填充与解析。
 *
 * 用法：
 * ```ts
 * const engine = new ThinkingEngine();
 * const prompt = engine.buildPrompt({ userQuestion: "如何做差异分析？" });
 * // 将 prompt 注入 System Prompt
 * const sections = engine.parseThinkingOutput(llmResponse);
 * ```
 */
export class ThinkingEngine {
  private template: string;

  constructor(template?: string) {
    this.template = template ?? THINKING_TEMPLATE;
  }

  /**
   * 根据上下文构建完整的思考提示词。
   *
   * @param context - 包含用户问题、文件探测、资源报告和知识库结果
   * @returns 完成变量替换后的 System Prompt 文本
   */
  buildPrompt(context: ThinkingContext): string {
    const fileInspectJson = context.fileInspectResult
      ? typeof context.fileInspectResult === "string"
        ? context.fileInspectResult
        : JSON.stringify(context.fileInspectResult, null, 2)
      : "";

    const resourceReportJson = context.resourceReport
      ? typeof context.resourceReport === "string"
        ? context.resourceReport
        : JSON.stringify(context.resourceReport, null, 2)
      : "";

    const knowledgeResultJson = context.knowledgeResult
      ? typeof context.knowledgeResult === "string"
        ? context.knowledgeResult
        : JSON.stringify(context.knowledgeResult, null, 2)
      : "";

    return renderTemplate(this.template, {
      USER_QUESTION: context.userQuestion,
      FILE_INSPECT_RESULT: fileInspectJson,
      RESOURCE_REPORT: resourceReportJson,
      KNOWLEDGE_RESULT: knowledgeResultJson,
    });
  }

  /**
   * 解析 LLM 返回的结构化思考输出，按 "---" 分隔符拆分为 7 个 ThinkingSection。
   *
   * 解析策略：
   * 1. 以 "---" 为分隔符切分文本
   * 2. 每个分段匹配 "第X步" 或 "## 第X步" 或 "Step X" 模式提取标题和序号
   * 3. 自动填充缺失的 section（最多 7 个）
   *
   * @param output - LLM 返回的原始文本
   * @returns 思考片段数组
   */
  parseThinkingOutput(output: string): ThinkingSection[] {
    const sections: ThinkingSection[] = [];

    // Split by "---" separator, which is the canonical section delimiter
    const rawParts = output.split(/\n---+\n/);

    // Step title patterns (Chinese and English)
    const stepPatterns: RegExp[] = [
      /第\s*([一二三四五六七1-7])\s*步[：:]\s*(.+)/,
      /##\s*第\s*([一二三四五六七1-7])\s*步[：:]?\s*(.*)/,
      /Step\s+(\d+)\s*[：:]\s*(.+)/i,
      /###\s*\d+[.、]\s*(.+)/,
    ];

    const chineseToNumber: Record<string, number> = {
      一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7,
    };

    for (const raw of rawParts) {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      let index = 0;
      let title = "";

      for (const pattern of stepPatterns) {
        const match = trimmed.match(pattern);
        if (match) {
          const idxStr = match[1]!.trim();
          index = chineseToNumber[idxStr] ?? Number.parseInt(idxStr, 10);
          title = (match[2] ?? "").trim().replace(/^[\s*#]+/, "").replace(/[\s*#]+$/, "");

          // If title is empty, use a generic one based on index
          if (!title) {
            title = `Step ${index}`;
          }
          break;
        }
      }

      // If no explicit step header found, try to infer from heading
      if (index === 0) {
        const headingMatch = trimmed.match(/^#{1,4}\s*(.+)/m);
        if (headingMatch) {
          title = headingMatch[1]!.trim();
          // Try to guess index from the heading content
          for (let i = 1; i <= 7; i++) {
            if (title.includes(`${i}`) || title.includes(chineseNumToChar(i))) {
              index = i;
              break;
            }
          }
        }

        // If still can't determine index, use auto-increment
        if (index === 0) {
          index = sections.length + 1;
          title = title || `Section ${index}`;
        }
      }

      if (index > 0 && index <= 7) {
        sections.push({
          index,
          title: title || `Step ${index}`,
          content: trimmed,
        });
      }
    }

    // Ensure we have exactly 7 sections — fill missing ones with empty content
    const result: ThinkingSection[] = [];
    const defaultTitles: Record<number, string> = {
      1: "科学问题还原",
      2: "数据需求与质控标准",
      3: "工具与镜像选择",
      4: "多分析路径评估",
      5: "风险识别与缓解",
      6: "执行计划",
      7: "结果解读与可视化计划",
    };

    for (let i = 1; i <= 7; i++) {
      const existing = sections.find((s) => s.index === i);
      if (existing) {
        result.push(existing);
      } else {
        result.push({
          index: i,
          title: defaultTitles[i] ?? `Step ${i}`,
          content: "",
        });
      }
    }

    return result;
  }
}

/** Convert index number to Chinese character (for matching). */
function chineseNumToChar(n: number): string {
  const map: Record<number, string> = {
    1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "七",
  };
  return map[n] ?? String(n);
}
