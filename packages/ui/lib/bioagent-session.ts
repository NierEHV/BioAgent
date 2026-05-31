// ============================================================
// @bioagent/ui — BioAgentSession Factory
// ============================================================
// Creates a pi-agent-core Agent configured as BioAgent:
// - BioAgent tools + pi coding tools
// - 7-step thinking system prompt (primary)
// - beforeToolCall: safety validation
// - afterToolCall: QC analysis
// - transformContext: knowledge base injection
//
// This replaces the pi-coding-agent approach — BioAgent uses
// pi-agent-core directly as its agent framework.

import "server-only";
// Inline type declarations matching pi-agent-core (not exported by pi-coding-agent)
interface BeforeToolCallContext {
  toolCall: { name: string; args: unknown };
  args: unknown;
  assistantMessage: unknown;
  context: unknown;
}
interface AfterToolCallContext {
  toolCall: { name: string; args: unknown };
  args: unknown;
  assistantMessage: unknown;
  result: { content?: Array<{ type: string; text?: string }> };
  isError: boolean;
  context: unknown;
}
interface BeforeToolCallResult {
  block?: boolean;
  reason?: string;
}
interface AfterToolCallResult {
  content?: Array<{ type: string; text?: string }>;
  details?: unknown;
  isError?: boolean;
  terminate?: boolean;
}
interface AgentMessageLike { role: string; content: any };

// ============================================================================
// System Prompt — BioAgent 7-step thinking as primary
// ============================================================================

export const BIOAGENT_SYSTEM_PROMPT = `You are BioAgent — an AI Principal Bioinformatician powered by the pi agent framework.

## Your Identity
You have 15 years of experience in bioinformatics. You think like a principal scientist:
rigorous, first-principles reasoning, collegial but firm on scientific standards.

## Core Workflow: 7-Step Reasoning
Before executing any analysis, ALWAYS work through this framework:

### 1. Scientific Question Clarification
- What is the user's surface request?
- What is the underlying testable hypothesis?
- Restate the scientific question in precise, testable terms.

### 2. Data Sufficiency Assessment
- What data does the user have? Format, scale, quality?
- What data is missing? How does each gap affect conclusions?
- Can missing data be supplemented from public databases (GEO, TCGA, Human Cell Atlas)?

### 3. Analysis Path Enumeration (≥2 approaches)
- For each path: tools, statistical power, FDR control, compute requirements, interpretability.
- Compare pros and cons explicitly.

### 4. Optimal Path Recommendation
- Recommend the best approach with clear reasons.
- Cite methodological literature (original tool papers, benchmark studies).
- Specify a fallback if the primary approach fails.

### 5. Key Risk Assessment
- Technical risks: batch effects, sequencing depth, doublet rates, platform differences.
- Statistical risks: insufficient power, overfitting, multiple testing burden.
- Biological risks: tissue heterogeneity, continuous cell states, sampling bias.

### 6. Literature Support
- Reference original methods papers.
- Reference benchmark comparisons (e.g., which tool performs best for this dataset size).
- Explicitly note uncertainty where literature support is limited.

### 7. Validation Strategy
- Internal: cross-validation, permutation tests, sensitivity analysis.
- External: independent datasets, public atlases (Human Cell Atlas, TCGA).
- Experimental: which key findings should be confirmed by orthogonal experiments.

## Available Tools

You have access to standard file/code tools AND bioinformatics-specific tools:

### Bioinformatics Tools
- **docker_exec** — Execute commands inside Docker containers. Use for ALL bioinformatics tool execution (Scanpy, Seurat, etc.). Never run bio tools directly on the host.
- **docker_search** — Search Docker Hub for bioinformatics container images.
- **bio_kb_query** — Query the BioAgent knowledge base (vector DB + knowledge graph + best practice wiki).
- **bio_file_inspect** — Detect file format and structure for bioinformatics data files (h5ad, h5, mtx, fastq, etc.).
- **bio_skill_invoke** — Invoke standardized bioinformatics analysis skills with built-in QC gates.

### Standard Tools
- **read** — Read file contents.
- **bash** — Execute shell commands (for non-bioinformatics tasks).
- **edit** / **write** — Modify/create files.
- **grep** / **find** / **ls** — Search and navigate files.

## Guidelines

### Analysis Execution
1. ALWAYS use docker_exec for bioinformatics tools — never install or run them directly.
2. Before any analysis, use bio_file_inspect to confirm data format and structure.
3. Use bio_kb_query to validate methodology against established best practices.
4. Use docker_search when you need a tool not in your known image map.
5. Every analysis step should have explicit QC checks.
6. When QC fails, diagnose the issue and suggest fixes.

### Communication Style
- Use professional but approachable academic language.
- Give the analysis outline and rationale BEFORE the specific steps.
- When users request unreasonable analyses, gently point out issues and offer alternatives like a responsible colleague.
- Cite specific literature and database sources.
- Be explicit about uncertainty and confidence levels.
- Never pretend to be certain about obviously flawed data.

### Image Reference
- For scRNA-seq: rnakato/shortcake_full (100+ tools, R+Python)
- For individual bio tools: quay.io/biocontainers/<tool-name>
- Lightweight local: bioagent-scrna:latest`.trim();

// ============================================================================
// beforeToolCall — Safety Validation
// ============================================================================

export async function bioagentBeforeToolCall(
  ctx: BeforeToolCallContext,
  _signal?: AbortSignal,
): Promise<BeforeToolCallResult | undefined> {
  const toolName = ctx.toolCall.name;
  const args = ctx.args as Record<string, any>;

  // ---- docker_exec specific checks ----
  if (toolName === "docker_exec") {
    const action = (args as any)?.action as string;

    // Dangerous operations blacklist
    if (action === "exec" || action === undefined) {
      const command = (args.command || args.Cmd?.join(" ")) as string;
      if (command) {
        const dangerous = [
          { pattern: /rm\s+-rf\s+\//, reason: "禁止 rm -rf /" },
          { pattern: /chmod\s+777/, reason: "禁止 chmod 777" },
          { pattern: />\s*\/dev\/sd[a-z]/, reason: "禁止写入磁盘设备" },
          { pattern: /mkfs\./, reason: "禁止格式化命令" },
          { pattern: /curl.*\|.*sh/, reason: "禁止管道执行远程脚本" },
          { pattern: /:\(\)\s*\{.*:\|:.*&\}/, reason: "禁止 fork bomb" },
        ];
        for (const d of dangerous) {
          if (d.pattern.test(command)) {
            return { block: true, reason: `安全校验阻止: ${d.reason}. 命令: ${command.slice(0, 80)}` };
          }
        }

        // Path whitelist — only operate under /data/
        const forbiddenPaths = ["/etc", "/root", "/home", "/var", "/sys", "/proc", "/boot", "/dev"];
        for (const fp of forbiddenPaths) {
          if (command.includes(fp) && !command.includes("/data")) {
            return { block: true, reason: `安全校验阻止: 命令引用了禁止路径 "${fp}". 只允许操作 /data/ 目录。` };
          }
        }
      }
    }

    // Timeout cap
    if ((args as any)?.timeout > 3_600_000) {
      return { block: true, reason: "安全校验阻止: 单次命令超时不能超过 1 小时 (3600000ms)。" };
    }

    // Container name validation
    if (action === "start_container") {
      const name = (args as any)?.name as string;
      if (name && !/^[a-zA-Z0-9_-]+$/.test(name)) {
        return { block: true, reason: `安全校验阻止: 容器名 "${name}" 包含非法字符。只允许字母、数字、下划线、连字符。` };
      }
    }
  }

  // ---- bio_kb_query checks ----
  if (toolName === "bio_kb_query") {
    const question = (args as any)?.question as string;
    if (!question || question.trim().length < 3) {
      return { block: true, reason: "知识库查询的问题太短，至少需要 3 个字符。" };
    }
  }

  // Allow all other tools by default
  return undefined;
}

// ============================================================================
// afterToolCall — QC Analysis
// ============================================================================

export async function bioagentAfterToolCall(
  ctx: AfterToolCallContext,
  _signal?: AbortSignal,
): Promise<AfterToolCallResult | undefined> {
  const toolName = ctx.toolCall.name;
  const args = ctx.args as Record<string, any>;

  // Skip if the tool already errored
  if (ctx.isError) return undefined;

  // ---- docker_exec QC ----
  if (toolName === "docker_exec") {
    const action = (args as any)?.action as string;
    const resultContent = ctx.result.content as any[];
    const textOutput = resultContent?.find((c: any) => c.type === "text")?.text || "";

    // After exec: check exit code
    if (action === "exec") {
      const exitMatch = textOutput.match(/Exit Code:\s*(-?\d+)/);
      if (exitMatch) {
        const exitCode = parseInt(exitMatch[1], 10);
        if (exitCode !== 0) {
          // Append QC failure note
          return {
            content: [
              ...(resultContent || []),
              {
                type: "text" as const,
                text: `\n\n--- QC Report ---\n❌ Command failed with exit code ${exitCode}.\n💡 Troubleshooting suggestions:\n  1. Check the command syntax and argument order\n  2. Verify input files exist at the specified paths\n  3. Check container logs: docker logs <container>\n  4. Verify the tool is installed in the container (use docker_inspect)`,
              },
            ],
          };
        }
        // Success — append QC pass
        return {
          content: [
            ...(resultContent || []),
            { type: "text" as const, text: `\n\n✅ QC: Command completed successfully (exit code 0).` },
          ],
        };
      }
    }
  }

  // ---- bio_skill_invoke QC ----
  if (toolName === "bio_skill_invoke") {
    const skillName = (args as any)?.skill_name as string;
    const resultContent = ctx.result.content as any[];
    const textOutput = resultContent?.find((c: any) => c.type === "text")?.text || "";

    return {
      content: [
        ...(resultContent || []),
        {
          type: "text" as const,
          text: `\n\n⚠️  重要: Skill "${skillName}" 返回了指导信息。请使用 docker_exec 在指定容器中执行相应的 Python/R 命令来完成实际分析。每个 Skill 执行后必须检查输出文件并验证结果。`,
        },
      ],
    };
  }

  return undefined;
}

// ============================================================================
// transformContext — Knowledge Base Injection
// ============================================================================

export async function bioagentTransformContext(
  messages: AgentMessageLike[],
  signal?: AbortSignal,
): Promise<AgentMessageLike[]> {
  // This runs before messages are sent to the LLM.
  // In a full implementation, we would:
  // 1. Detect the user's latest question
  // 2. Query the knowledge base for relevant methodology/best practices
  // 3. Inject findings as context messages before the user's question

  // For now, ensure the first user message has the thinking framework
  // by checking if system prompt is already set via Agent initialization.

  if (signal?.aborted) return messages;

  // Future enhancement:
  // - Auto-detect omics type from message content
  // - Query wiki for relevant SOP/best practices
  // - Inject as context messages
  // - Apply context window management (trim old messages)

  return messages;
}

// ============================================================================
// Helper: merge pi coding tools + bio tools
// ============================================================================

/** pi coding tool names that we want to keep alongside BioAgent tools */
export const PI_CODING_TOOL_NAMES = [
  "read",
  "bash",
  "edit",
  "write",
  "grep",
  "find",
  "ls",
];

/** BioAgent-specific tool names */
export const BIOAGENT_TOOL_NAMES = [
  "docker_exec",
  "docker_search",
  "bio_kb_query",
  "bio_file_inspect",
  "bio_skill_invoke",
];

/** All tool names for BioAgent sessions */
export const ALL_BIOAGENT_TOOL_NAMES = [
  ...PI_CODING_TOOL_NAMES,
  ...BIOAGENT_TOOL_NAMES,
];
