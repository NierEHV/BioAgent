// ============================================================
// @bioagent/agent-core — docker-inspect Tool
// ============================================================

import { z } from "zod";
import type { DockerExecutor } from "@bioagent/executor";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

export const dockerInspectToolSchema = z.object({
  image: z.string().min(1).describe("Docker image name with tag, e.g. 'biocontainers/seurat:v4.3.0'"),
});

export type DockerInspectToolParams = z.infer<typeof dockerInspectToolSchema>;

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const dockerInspectToolDef = {
  name: "docker_inspect",
  description:
    "Inspect a Docker image to get detailed metadata: creation date, size, OS, architecture, entry point, default command, environment variables, and root filesystem layers.",
  schema: dockerInspectToolSchema,
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function dockerInspectHandler(
  params: DockerInspectToolParams,
  executor: DockerExecutor,
): Promise<unknown> {
  const info = await executor.imageManager.inspect(params.image);

  // Format for readability
  return {
    image: params.image,
    created: info.Created,
    size: info.Size,
    sizeFormatted: formatBytes(info.Size),
    os: info.Os,
    architecture: info.Architecture,
    config: info.Config
      ? {
          entrypoint: info.Config.Entrypoint,
          cmd: info.Config.Cmd,
          env: info.Config.Env
            ? info.Config.Env.length > 50
              ? `${info.Config.Env.length} env vars (too many to list)`
              : info.Config.Env
            : undefined,
        }
      : undefined,
    rootFS: info.RootFS
      ? {
          layerCount: info.RootFS.Layers?.length ?? 0,
          layers: info.RootFS.Layers?.map((l: string) => l.slice(0, 60) + "..."),
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
