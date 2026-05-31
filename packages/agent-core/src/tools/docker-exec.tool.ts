// ============================================================
// @bioagent/agent-core — docker-exec Tool
// ============================================================
// Discriminated union on action: ensure_image / start_container / exec /
// stop_container / get_status / list_containers

import { z } from "zod";
import type { DockerExecutor } from "@bioagent/executor";

// ---------------------------------------------------------------------------
// Zod schemas — discriminated union
// ---------------------------------------------------------------------------

const ensureImageSchema = z.object({
  action: z.literal("ensure_image"),
  image: z.string().min(1).describe("Docker image name with tag, e.g. 'python:3.11-slim'"),
  platform: z.string().optional().describe("Target platform, e.g. 'linux/amd64'"),
});

const startContainerSchema = z.object({
  action: z.literal("start_container"),
  image: z.string().min(1).describe("Docker image name"),
  name: z.string().min(1).max(128).describe("Container name (globally unique)"),
  command: z.array(z.string()).default(["tail", "-f", "/dev/null"]).describe("Container command"),
  volumes: z
    .array(
      z.object({
        host: z.string().min(1),
        container: z.string().min(1),
        mode: z.enum(["ro", "rw"]).default("rw"),
      }),
    )
    .default([])
    .describe("Volume mounts"),
  env: z.record(z.string(), z.string()).default({}).describe("Environment variables"),
  gpu: z.boolean().default(false).describe("Enable GPU (requires nvidia-container-toolkit)"),
  network: z.enum(["bridge", "host", "none"]).default("bridge"),
  memoryLimit: z.string().optional().describe("Memory limit, e.g. '64g' or '512m'"),
  cpuLimit: z.number().positive().optional().describe("CPU core limit"),
});

const execSchema = z.object({
  action: z.literal("exec"),
  container: z.string().min(1).describe("Target container name or ID"),
  command: z.string().min(1).describe("Shell command to execute inside container"),
  workdir: z.string().default("/data").describe("Working directory inside container"),
  timeout: z.number().positive().default(600_000).describe("Timeout in milliseconds"),
  env: z.record(z.string(), z.string()).default({}).describe("Environment overrides"),
  captureStderr: z.boolean().default(true).describe("Whether to capture stderr separately"),
});

const stopContainerSchema = z.object({
  action: z.literal("stop_container"),
  name: z.string().min(1).describe("Container name or ID"),
  force: z.boolean().default(false).describe("Force kill (SIGKILL)"),
  removeVolumes: z.boolean().default(false).describe("Also remove associated volumes"),
});

const getStatusSchema = z.object({
  action: z.literal("get_status"),
  name: z.string().min(1).describe("Container name or ID"),
});

const listContainersSchema = z.object({
  action: z.literal("list_containers"),
  namePrefix: z.string().optional().describe("Filter by name prefix"),
  state: z.enum(["running", "paused", "exited", "dead"]).optional().describe("Filter by state"),
});

// ---------------------------------------------------------------------------
// Combined schema
// ---------------------------------------------------------------------------

export const dockerExecToolSchema = z.discriminatedUnion("action", [
  ensureImageSchema,
  startContainerSchema,
  execSchema,
  stopContainerSchema,
  getStatusSchema,
  listContainersSchema,
]);

export type DockerExecToolParams = z.infer<typeof dockerExecToolSchema>;

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const dockerExecToolDef = {
  name: "docker_exec",
  description:
    "Manage Docker containers: ensure images, start/stop containers, execute commands, check status, and list containers. Use the 'action' field to select the operation.",
  schema: dockerExecToolSchema,
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function dockerExecHandler(
  params: DockerExecToolParams,
  executor: DockerExecutor,
): Promise<unknown> {
  switch (params.action) {
    case "ensure_image":
      return executor.containerManager.ensureImage(params.image, params.platform);

    case "start_container":
      return executor.containerManager.startContainer({
        image: params.image,
        name: params.name,
        command: params.command,
        volumes: params.volumes,
        env: params.env,
        gpu: params.gpu,
        network: params.network,
        memoryLimit: params.memoryLimit,
        cpuLimit: params.cpuLimit,
      });

    case "exec":
      return executor.containerManager.execInContainer({
        container: params.container,
        command: params.command,
        workdir: params.workdir,
        timeout: params.timeout,
        env: params.env,
        captureStderr: params.captureStderr,
      });

    case "stop_container":
      return executor.containerManager.stopContainer(params.name, {
        force: params.force,
        removeVolumes: params.removeVolumes,
      });

    case "get_status":
      return executor.containerManager.getContainerStatus(params.name);

    case "list_containers":
      return executor.containerManager.listContainers({
        namePrefix: params.namePrefix,
        state: params.state,
      });
  }
}
