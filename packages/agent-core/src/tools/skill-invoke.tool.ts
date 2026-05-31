// ============================================================
// @bioagent/agent-core — skill-invoke Tool
// ============================================================

import { z } from "zod";
import type { DockerExecutor } from "@bioagent/executor";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

export const skillInvokeToolSchema = z.object({
  skill_name: z
    .string()
    .min(1)
    .describe(
      "Name of the skill to invoke, e.g. 'scrna_qc', 'scrna_clustering', 'scrna_de_analysis'",
    ),
  params: z
    .record(z.string(), z.unknown())
    .default({})
    .describe("Key-value parameters passed to the skill"),
  container: z
    .string()
    .optional()
    .describe(
      "Existing container name or ID to execute the skill in. If not provided, a temporary container will be used.",
    ),
  data_context: z
    .object({
      input_dir: z.string().optional().describe("Path to input data directory"),
      output_dir: z.string().optional().describe("Path to output data directory"),
      project_id: z.string().optional().describe("Project identifier"),
      omics_type: z.string().optional().describe("Omics data type, e.g. 'scRNA-seq'"),
    })
    .optional()
    .describe("Data context for the skill execution"),
});

export type SkillInvokeToolParams = z.infer<typeof skillInvokeToolSchema>;

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const skillInvokeToolDef = {
  name: "skill_invoke",
  description:
    "Invoke a bioinformatics analysis skill inside a Docker container. Skills encapsulate common analysis workflows like quality control, clustering, differential expression, etc. Each skill corresponds to a specific analysis step.",
  schema: skillInvokeToolSchema,
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function skillInvokeHandler(
  params: SkillInvokeToolParams,
  executor: DockerExecutor,
): Promise<{
  skillName: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
  duration: number;
  container: string;
}> {
  const containerName =
    params.container ||
    `bioagent-skill-${params.skill_name}-${Date.now()}`;

  // Build the command to invoke the skill
  // Skills are invoked via a CLI interface inside the container
  const cliArgs = Object.entries(params.params)
    .map(([k, v]) => {
      if (typeof v === "boolean" && v) return `--${k}`;
      if (typeof v === "boolean" && !v) return "";
      return `--${k} ${String(v)}`;
    })
    .filter(Boolean)
    .join(" ");

  const command = `bioagent-skill ${params.skill_name} ${cliArgs}`.trim();

  // If no existing container, use runOnce for a temporary execution
  if (!params.container) {
    const result = await executor.containerManager.runOnce({
      image: "bioagent-scrna:latest",
      name: containerName,
      command: ["tail", "-f", "/dev/null"],
      volumes: [],
      env: {
        INPUT_DIR: params.data_context?.input_dir ?? "/data/input",
        OUTPUT_DIR: params.data_context?.output_dir ?? "/data/output",
        PROJECT_ID: params.data_context?.project_id ?? "",
        OMICS_TYPE: params.data_context?.omics_type ?? "",
        ...Object.fromEntries(
          Object.entries(params.params).map(([k, v]) => [
            `SKILL_${k.toUpperCase()}`,
            String(v),
          ]),
        ),
      },
      gpu: false,
      network: "bridge",
      command: command,
      workdir: "/data",
      timeout: 600_000,
    });

    return {
      skillName: params.skill_name,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      truncated: result.truncated,
      duration: result.duration,
      container: containerName,
    };
  }

  // Execute in existing container
  const result = await executor.containerManager.execInContainer({
    container: params.container,
    command,
    workdir: "/data",
    timeout: 600_000,
    env: {},
    captureStderr: true,
  });

  return {
    skillName: params.skill_name,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    truncated: result.truncated,
    duration: result.duration,
    container: params.container,
  };
}
