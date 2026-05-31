// ============================================================
// @bioagent/agent-core — docker-pull Tool
// ============================================================

import { z } from "zod";
import type { DockerExecutor } from "@bioagent/executor";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

export const dockerPullToolSchema = z.object({
  image: z.string().min(1).describe("Docker image name with tag, e.g. 'rnakato/shortcake_light:latest'"),
  platform: z.string().optional().describe("Target platform, e.g. 'linux/amd64'"),
});

export type DockerPullToolParams = z.infer<typeof dockerPullToolSchema>;

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const dockerPullToolDef = {
  name: "docker_pull",
  description:
    "Pull a Docker image from a registry. Returns the image digest, total size, and number of layers after the pull completes.",
  schema: dockerPullToolSchema,
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function dockerPullHandler(
  params: DockerPullToolParams,
  executor: DockerExecutor,
): Promise<{
  image: string;
  totalSize: number;
  layers: number;
  digest: string;
  alreadyCached: boolean;
}> {
  // Check if already cached
  const alreadyCached = await executor.imageManager.isImageCached(params.image);
  if (alreadyCached) {
    const size = await executor.imageManager.getImageSize(params.image);
    return {
      image: params.image,
      totalSize: size,
      layers: 0,
      digest: "(cached)",
      alreadyCached: true,
    };
  }

  const result = await executor.imageManager.pull(params.image, {
    platform: params.platform,
  });

  return {
    ...result,
    alreadyCached: false,
  };
}
