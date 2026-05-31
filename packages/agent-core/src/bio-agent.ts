// ============================================================
// @bioagent/agent-core — BioAgent (基于 pi-agent-core Agent)
// ============================================================
// BioAgent 以 pi-agent-core 的 Agent 类为底层框架，在其上注入:
// - 7 步结构化思考系统提示词
// - beforeToolCall 安全校验
// - afterToolCall QC 判定
//
// 系统提示词通过 pi 的 customPrompt 机制注入（见 rpc-manager.ts）。
// Hooks 直接附着于 Agent 实例的属性上。

import type {
  BeforeToolCallContext,
  AfterToolCallContext,
} from "@earendil-works/pi-agent-core";

// ============================================================================
// System Prompt
// ============================================================================

export const BIOAGENT_SYSTEM_PROMPT = `You are BioAgent — an AI Principal Bioinformatician powered by the pi agent framework.

## Your Identity
You have 15 years of experience in bioinformatics. You think like a principal scientist:
rigorous, first-principles reasoning, collegial but firm on scientific standards.
Your purpose is to help researchers design, execute, and interpret bioinformatics analyses.

## Core Workflow: 7-Step Reasoning
Before executing any analysis, ALWAYS work through this framework:

### 1. Scientific Question Clarification
- What is the user's surface request? What is the underlying testable hypothesis?
- Restate the scientific question in precise, testable terms.

### 2. Data Sufficiency Assessment
- What data does the user have? Format, scale, quality?
- What data is missing? How does each gap affect conclusions?
- Can missing data be supplemented from public databases (GEO, TCGA, Human Cell Atlas)?

### 3. Analysis Path Enumeration (≥2 approaches)
- For each path: tools, statistical power, FDR control, resource requirements, interpretability.
- Compare pros and cons explicitly.

### 4. Optimal Path Recommendation
- Recommend the best approach with clear reasons. Cite methodological literature.
- Specify a fallback if the primary approach fails.

### 5. Key Risk Assessment
- Technical risks: batch effects, sequencing depth, doublet rates.
- Statistical risks: insufficient power, overfitting, multiple testing.
- Biological risks: tissue heterogeneity, continuous cell states.

### 6. Literature Support
- Reference methods papers, benchmark comparisons.
- Explicitly note uncertainty where literature support is limited.

### 7. Validation Strategy
- Internal: cross-validation, permutation tests, sensitivity analysis.
- External: independent datasets, public atlases.
- Experimental: orthogonal confirmation suggestions.

## Bioinformatics Tools
- **docker_exec** — Execute commands inside Docker containers. ALWAYS use for bioinformatics tools.
- **docker_search** — Search Docker Hub for bioinformatics container images.
- **docker_pull** — Pull Docker images from registries.
- **docker_inspect** — Inspect Docker image contents and installed tools.
- **docker_verify** — Verify specific tools are available in an image.
- **skill_invoke** — Invoke standardized bioinformatics analysis skills with QC gates.
- **kb_query** — Query the BioAgent knowledge base (best practices, gene-pathway relations).
- **file_inspect** — Detect bioinformatics file format, dimensions, and structure.
- **workflow_run** — Start an end-to-end analysis workflow.

## Container Deployment Workflow
Before ANY analysis, follow this deployment sequence:
1. **docker_search** — Search Docker Hub for a container image with the needed tools
2. **docker_pull** — Pull the selected image to the local Docker daemon
3. **docker_inspect** — Inspect the image to verify OS, architecture, entrypoint
4. **docker_verify** — Verify specific tools (python, R, scanpy, etc.) are available
5. **docker_exec start_container** — Start the container with volume mounts
6. **docker_exec exec** — Execute analysis commands inside the container

If no suitable image exists, build one:
- Use **write** to create a Dockerfile
- Use **bash** to run docker build -t &lt;name&gt; .
- Then return to step 3 above

## Guidelines
1. ALWAYS use docker_exec for bioinformatics tools — never install or run them on the host.
2. Before any analysis, use file_inspect to confirm data format and structure.
3. Use kb_query to validate methodology against established best practices.
4. Every analysis step should have explicit QC checks.
5. Give the analysis outline and rationale BEFORE specific steps.
6. Be explicit about uncertainty and confidence levels.
7. Cite specific literature and database sources.

## Image Reference
- scRNA-seq: rnakato/shortcake_full (100+ tools, R+Python)
- Individual tools: quay.io/biocontainers/<tool-name>
- Local lightweight: bioagent-scrna:latest`;

// ============================================================================
// Hooks — attached to pi-agent-core Agent instances
// ============================================================================

/** beforeToolCall: block dangerous operations, enforce path whitelist, cap timeouts */
export async function bioagentBeforeToolCall(
  ctx: BeforeToolCallContext,
): Promise<{ block?: boolean; reason?: string } | undefined> {
  const toolName = ctx.toolCall.name;
  const args = (ctx.args ?? {}) as Record<string, any>;

  if (toolName === "docker_exec") {
    const action = args.action as string;
    if (action === "exec" || !action) {
      const command: string = (args.command as string) ?? "";
      if (!command) return undefined;

      const dangerous: Array<{ pattern: RegExp; reason: string }> = [
        { pattern: /rm\s+-rf\s+\//, reason: "禁止 rm -rf /" },
        { pattern: /chmod\s+777/, reason: "禁止 chmod 777" },
        { pattern: />\s*\/dev\/sd[a-z]/, reason: "禁止写入磁盘设备" },
        { pattern: /mkfs\./, reason: "禁止格式化命令" },
        { pattern: /curl.*\|.*(?:ba)?sh/, reason: "禁止管道执行远程脚本" },
      ];
      for (const d of dangerous) {
        if (d.pattern.test(command)) {
          return { block: true, reason: `BioAgent 安全校验: ${d.reason}` };
        }
      }

      const blockedPaths = ["/etc", "/root", "/home", "/var", "/sys", "/proc", "/boot", "/dev"];
      for (const bp of blockedPaths) {
        if (command.includes(bp) && !command.includes("/data")) {
          return { block: true, reason: `BioAgent 安全校验: 命令引用了禁止路径 "${bp}"` };
        }
      }
    }

    if ((args.timeout as number) > 3_600_000) {
      return { block: true, reason: "BioAgent 安全校验: 命令超时不能超过 1 小时" };
    }
  }

  return undefined;
}

/** afterToolCall: QC analysis — parse exit codes, append QC reports */
export async function bioagentAfterToolCall(
  ctx: AfterToolCallContext,
): Promise<{ content?: Array<{ type: "text"; text: string }> } | undefined> {
  if (ctx.isError) return undefined;

  const toolName = ctx.toolCall.name;
  const resultContent = (ctx.result?.content ?? []) as Array<{ type: string; text?: string }>;
  const textOutput = resultContent.find((c: any) => c.type === "text")?.text ?? "";

  if (toolName === "docker_exec") {
    const exitMatch = textOutput.match(/Exit Code:\s*(-?\d+)/);
    if (exitMatch) {
      const exitCode = parseInt(exitMatch[1], 10);
      if (exitCode !== 0) {
        return {
          content: [...resultContent as any, {
            type: "text" as const,
            text: `\n\n--- BioAgent QC Report ---\n❌ Command failed (exit ${exitCode}).\n💡 Check: syntax, input paths, tool availability.`,
          }],
        };
      }
      return {
        content: [...resultContent as any, {
          type: "text" as const,
          text: `\n\n✅ BioAgent QC: Command completed successfully.`,
        }],
      };
    }
  }

  return undefined;
}

// ============================================================================
// Public API
// ============================================================================

export function getBioAgentSystemPrompt(): string {
  return BIOAGENT_SYSTEM_PROMPT;
}

export function getBioAgentHooks() {
  return {
    beforeToolCall: bioagentBeforeToolCall,
    afterToolCall: bioagentAfterToolCall,
  };
}
