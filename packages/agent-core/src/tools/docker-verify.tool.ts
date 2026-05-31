// ============================================================
// @bioagent/agent-core — docker-verify Tool
// ============================================================

import { z } from "zod";
import type { DockerExecutor } from "@bioagent/executor";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

export const dockerVerifyToolSchema = z.object({
  image: z.string().min(1).describe("Docker image name with tag, e.g. 'biocontainers/seurat:v4.3.0'"),
  tools: z
    .array(z.string().min(1))
    .min(1)
    .max(50)
    .describe("List of tool names to verify (e.g. ['R', 'Rscript', 'python3'])"),
});

export type DockerVerifyToolParams = z.infer<typeof dockerVerifyToolSchema>;

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const dockerVerifyToolDef = {
  name: "docker_verify",
  description:
    "Verify whether specified bioinformatics tools are available inside a Docker image. For each tool, tries 'which <tool>' and '<tool> --version', returning a boolean map of availability.",
  schema: dockerVerifyToolSchema,
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function dockerVerifyHandler(
  params: DockerVerifyToolParams,
  executor: DockerExecutor,
): Promise<{
  image: string;
  tools: Record<string, boolean>;
  allAvailable: boolean;
  versions: Record<string, string | null>;
}> {
  const toolsAvailable = await executor.imageManager.verifyTools(params.image, params.tools);

  // Get versions for available tools
  const versions: Record<string, string | null> = {};
  for (const tool of params.tools) {
    if (toolsAvailable[tool]) {
      versions[tool] = await executor.imageManager.getToolVersion(params.image, tool);
    } else {
      versions[tool] = null;
    }
  }

  const allAvailable = Object.values(toolsAvailable).every((v) => v);

  return {
    image: params.image,
    tools: toolsAvailable,
    allAvailable,
    versions,
  };
}
