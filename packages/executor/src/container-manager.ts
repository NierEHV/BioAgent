// ============================================================
// @bioagent/executor — ContainerManager
// ============================================================

import Docker from "dockerode";
import { Writable } from "node:stream";
import {
  ContainerConfig,
  ContainerStatus,
  ExecConfig,
  ExecResult,
  ImageInfo,
  PullProgress,
  PullResult,
  VolumeMount,
} from "./types.js";

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/** 解析内存限制字符串（如 "64g", "512m", "2G"）为字节数 */
export function parseMemoryLimit(input: string): number {
  const normalized = input.trim().toLowerCase();
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(g|m|k|b)?$/);
  if (!match) {
    throw new Error(`Invalid memory limit format: "${input}". Expected e.g. "64g", "512m".`);
  }
  const value = Number.parseFloat(match[1]);
  const unit = match[2] ?? "b";
  switch (unit) {
    case "g":
      return Math.round(value * 1024 * 1024 * 1024);
    case "m":
      return Math.round(value * 1024 * 1024);
    case "k":
      return Math.round(value * 1024);
    default:
      return Math.round(value);
  }
}

/** 将字节数格式化为人类可读字符串 */
export function formatBytes(bytes: number): string {
  if (bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * 根据两次 Docker stats 快照计算 CPU 使用百分比。
 *
 * 使用 Docker 官方公式：
 *   cpuDelta   = currentCpuUsage - previousCpuUsage
 *   systemDelta = currentSystemUsage - previousSystemUsage
 *   cpuPercent = (cpuDelta / systemDelta) * onlineCpus * 100
 *
 * 如果 systemDelta 为 0 则返回 0。
 */
export function calculateCPUPercent(
  currentCpuUsage: number,
  previousCpuUsage: number,
  currentSystemUsage: number,
  previousSystemUsage: number,
  onlineCpus: number,
): number {
  const cpuDelta = currentCpuUsage - previousCpuUsage;
  const systemDelta = currentSystemUsage - previousSystemUsage;
  if (systemDelta <= 0 || cpuDelta <= 0) return 0;
  return (cpuDelta / systemDelta) * onlineCpus * 100;
}

// ---------------------------------------------------------------------------
// Docker client configuration
// ---------------------------------------------------------------------------

export interface DockerClientConfig {
  /** Docker daemon host (e.g. "tcp://localhost:2375") */
  host?: string;
  /** Docker daemon socket path (e.g. "/var/run/docker.sock") */
  socketPath?: string;
}

export interface ContainerStopOptions {
  force?: boolean;
  removeVolumes?: boolean;
}

export interface ContainerListFilter {
  /** 按名称前缀筛选 */
  namePrefix?: string;
  /** 按状态筛选 */
  state?: "running" | "paused" | "exited" | "dead";
}

// ---------------------------------------------------------------------------
// ContainerManager
// ---------------------------------------------------------------------------

export class ContainerManager {
  readonly docker: Docker;

  constructor(dockerConfig?: DockerClientConfig) {
    const defaultSocket = process.platform === "win32"
      ? "//./pipe/dockerDesktopLinuxEngine"
      : "/var/run/docker.sock";
    this.docker = new Docker({
      host: dockerConfig?.host,
      socketPath: dockerConfig?.socketPath || defaultSocket,
    });
  }

  // ---- Image operations ----

  /**
   * 确保指定镜像在本地存在；若不存在则拉取。
   *
   * @param image - 镜像名称（含 tag），如 "rnakato/shortcake_light:latest"
   * @param platform - 可选的目标平台，如 "linux/amd64"
   * @returns 镜像拉取结果或 null（如果镜像已存在）
   */
  async ensureImage(image: string, platform?: string): Promise<PullResult | null> {
    const exists = await this.imageExists(image);
    if (exists) return null;

    const pullStream = await this.docker.pull(image, platform ? { platform } : {});
    let totalSize = 0;
    let layers = 0;
    let digest = "";
    const seenLayers = new Set<string>();

    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(
        pullStream,
        (err: Error | null, output: unknown[]) => {
          if (err) return reject(err);
          if (Array.isArray(output)) {
            for (const entry of output) {
              const e = entry as Record<string, unknown>;
              if (e.id && !seenLayers.has(e.id as string)) {
                seenLayers.add(e.id as string);
                layers++;
              }
              if (e.size) totalSize += Number(e.size);
              if (e.aux && (e.aux as Record<string, unknown>).Digest) {
                digest = (e.aux as Record<string, unknown>).Digest as string;
              }
            }
          }
          resolve();
        },
        (event: Record<string, unknown>) => {
          // progress callback — no-op for now; could emit PullProgress events
        },
      );
    });

    return { image, totalSize, layers, digest };
  }

  /**
   * 检查镜像是否已在本地存在。
   *
   * @param image - 镜像名称（含 tag）
   * @returns 存在则返回 true，否则返回 false
   */
  async imageExists(image: string): Promise<boolean> {
    try {
      await this.docker.getImage(image).inspect();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取镜像详细信息。
   *
   * @param image - 镜像名称（含 tag）
   * @returns 镜像详细信息，不存在时返回 null
   */
  async getImageInfo(image: string): Promise<ImageInfo | null> {
    try {
      const info = await this.docker.getImage(image).inspect();
      return {
        Created: info.Created,
        Size: info.Size,
        Os: info.Os,
        Architecture: info.Architecture,
        Config: info.Config
          ? {
              Entrypoint:
                typeof info.Config.Entrypoint === "string"
                  ? [info.Config.Entrypoint]
                  : info.Config.Entrypoint,
              Cmd: info.Config.Cmd ?? undefined,
              Env: info.Config.Env ?? undefined,
            }
          : undefined,
        RootFS: info.RootFS
          ? { Layers: info.RootFS.Layers }
          : undefined,
      };
    } catch {
      return null;
    }
  }

  // ---- Container operations ----

  /**
   * 创建并启动一个 Docker 容器。
   *
   * @param config - 容器启动配置
   * @returns 容器 ID 和启动时间
   */
  async startContainer(config: ContainerConfig): Promise<{ containerId: string; startedAt: string }> {
    const binds = config.volumes.map(
      (v) => `${v.host}:${v.container}:${v.mode}`,
    );
    const envArray = Object.entries(config.env).map(([k, v]) => `${k}=${v}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createOptions: any = {
      name: config.name,
      Image: config.image,
      Cmd: config.command,
      Env: envArray.length > 0 ? envArray : undefined,
      HostConfig: {
        Binds: binds.length > 0 ? binds : undefined,
        NetworkMode: config.network,
      },
    };

    // Memory limit
    if (config.memoryLimit) {
      createOptions.HostConfig.Memory = parseMemoryLimit(config.memoryLimit);
    }

    // CPU limit → NanoCpus (1 core = 1_000_000_000)
    if (config.cpuLimit && config.cpuLimit > 0) {
      createOptions.HostConfig.NanoCpus = config.cpuLimit * 1_000_000_000;
    }

    // GPU
    if (config.gpu) {
      createOptions.HostConfig.DeviceRequests = [
        {
          Driver: "nvidia",
          Count: -1,
          Capabilities: [["gpu"]],
        },
      ];
    }

    const container = await this.docker.createContainer(createOptions);
    await container.start();

    const inspect = await container.inspect();
    return {
      containerId: container.id,
      startedAt: inspect.State.StartedAt,
    };
  }

  /**
   * 在运行中的容器内执行命令。
   *
   * 收集标准输出和标准错误，单路最多保留 50 KB。超时后会截断输出并返回。
   *
   * @param config - 命令执行配置
   * @returns 执行结果，包含退出码、输出、耗时等
   */
  async execInContainer(config: ExecConfig): Promise<ExecResult> {
    const MAX_OUTPUT = 50 * 1024; // 50 KB
    const container = this.docker.getContainer(config.container);

    const envArray = Object.entries(config.env).map(([k, v]) => `${k}=${v}`);

    const execOpts: any = {
      Cmd: ["sh", "-c", config.command],
      AttachStdout: true,
      AttachStderr: config.captureStderr,
    };
    if (config.workdir) execOpts.WorkingDir = config.workdir;
    if (envArray.length > 0) execOpts.Env = envArray;

    const exec = await container.exec(execOpts);

    const startTime = Date.now();

    const stream = await exec.start({ hijack: true, stdin: false });

    let stdout = "";
    let stderr = "";
    let truncated = false;

    // Writeable that respects the 50 KB cap
    const stdoutWritable = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        if (stdout.length < MAX_OUTPUT) {
          const remaining = MAX_OUTPUT - stdout.length;
          stdout += chunk.toString("utf-8", 0, Math.min(chunk.length, remaining));
          if (stdout.length >= MAX_OUTPUT) truncated = true;
        }
        callback();
      },
    });

    const stderrWritable = config.captureStderr
      ? new Writable({
          write(chunk: Buffer, _encoding, callback) {
            if (stderr.length < MAX_OUTPUT) {
              const remaining = MAX_OUTPUT - stderr.length;
              stderr += chunk.toString("utf-8", 0, Math.min(chunk.length, remaining));
              if (stderr.length >= MAX_OUTPUT) truncated = true;
            }
            callback();
          },
        })
      : new Writable({
          write(_chunk, _encoding, callback) {
            callback();
          },
        });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (container.modem as any).demuxStream(stream, stdoutWritable, stderrWritable);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Timeout — destroy stream to stop reading; whatever we collected is returned
        truncated = true;
        stream.destroy();
        resolve();
      }, config.timeout);

      stream.on("end", () => {
        clearTimeout(timer);
        resolve();
      });
      stream.on("error", (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    // Get exit code via inspect
    let exitCode = -1;
    try {
      const execInspect = await exec.inspect();
      exitCode = execInspect.ExitCode ?? -1;
    } catch {
      // If inspect fails (e.g. container removed during exec), keep exitCode = -1
    }

    const duration = Date.now() - startTime;

    return {
      exitCode,
      stdout,
      stderr: config.captureStderr ? stderr : "",
      truncated,
      duration,
      command: config.command,
    };
  }

  /**
   * 停止并移除容器。
   *
   * @param name - 容器名称或 ID
   * @param opts - 可选：force（强制杀死）、removeVolumes（同时删除关联卷）
   */
  async stopContainer(name: string, opts: ContainerStopOptions = {}): Promise<void> {
    const container = this.docker.getContainer(name);
    try {
      if (opts.force) {
        await container.kill();
      } else {
        await container.stop({ t: 10 });
      }
    } catch {
      // Container may already be stopped — proceed to remove
    }
    await container.remove({ v: opts.removeVolumes ?? false, force: true });
  }

  /**
   * 获取单个容器的运行状态。
   *
   * 若容器不存在则返回 `{ state: "not_found" }`。
   *
   * @param name - 容器名称或 ID
   * @returns 容器状态快照
   */
  async getContainerStatus(name: string): Promise<ContainerStatus> {
    const container = this.docker.getContainer(name);

    let inspect;
    try {
      inspect = await container.inspect();
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404) {
        return {
          name,
          state: "not_found",
          startedAt: "",
          imageUsed: "",
          memoryUsage: "",
          cpuUsagePercent: 0,
          volumes: [],
        };
      }
      throw err;
    }

    // Map Docker state to our union
    const stateMap: Record<string, ContainerStatus["state"]> = {
      running: "running",
      paused: "paused",
      exited: "exited",
      dead: "dead",
    };
    const state: ContainerStatus["state"] =
      stateMap[(inspect.State.Status ?? "").toLowerCase()] ?? "not_found";

    // Extract volumes from mounts
    const volumes: VolumeMount[] = (inspect.Mounts ?? []).map((m) => ({
      host: m.Source ?? "",
      container: m.Destination ?? "",
      mode: m.RW ? "rw" : "ro",
    }));

    // Get stats (one-shot)
    let memoryUsage = "";
    let cpuUsagePercent = 0;
    try {
      const stats = await container.stats({ stream: false });
      const memUsage = stats.memory_stats?.usage ?? 0;
      memoryUsage = formatBytes(memUsage);

      const cpuDelta =
        stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta =
        stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const onlineCpus = stats.cpu_stats.online_cpus ?? 1;
      if (systemDelta > 0 && cpuDelta > 0) {
        cpuUsagePercent = (cpuDelta / systemDelta) * onlineCpus * 100;
      }
    } catch {
      // Stats may not be available — leave as empty/0
    }

    return {
      name,
      state,
      startedAt: inspect.State.StartedAt,
      imageUsed: inspect.Config?.Image ?? "",
      memoryUsage,
      cpuUsagePercent,
      volumes,
    };
  }

  /**
   * 列出所有容器（可筛选）。
   *
   * @param filter - 可选的名称前缀或筛选条件
   * @returns 容器状态数组
   */
  async listContainers(filter?: string | ContainerListFilter): Promise<ContainerStatus[]> {
    const listOpts: { all: boolean } = { all: true };

    const containers = await this.docker.listContainers(listOpts);

    const results: ContainerStatus[] = [];

    let namePrefix: string | undefined;
    let stateFilter: string | undefined;

    if (typeof filter === "string") {
      namePrefix = filter;
    } else if (filter) {
      namePrefix = filter.namePrefix;
      stateFilter = filter.state;
    }

    for (const info of containers) {
      const cName = (info.Names[0] ?? "").replace(/^\//, "");

      // Name prefix filter
      if (namePrefix && !cName.startsWith(namePrefix)) continue;
      // State filter
      if (stateFilter && info.State !== stateFilter) continue;

      results.push(await this.getContainerStatus(info.Id));
    }

    return results;
  }

  /**
   * 创建临时容器 → 启动 → 执行命令 → 停止 → 删除。
   *
   * 适合一次性分析任务。
   *
   * @param config - 容器 + 命令的联合配置（name 可选，不提供则自动生成）
   * @returns 命令执行结果
   */
  async runOnce(config: ContainerConfig & { command: string; workdir?: string; timeout?: number }): Promise<ExecResult> {
    const containerName = config.name || `bioagent-runonce-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const fullConfig: ContainerConfig = {
      image: config.image,
      name: containerName,
      command: config.command.length > 0 ? config.command : ["tail", "-f", "/dev/null"],
      volumes: config.volumes ?? [],
      env: config.env ?? {},
      gpu: config.gpu ?? false,
      network: config.network ?? "bridge",
      memoryLimit: config.memoryLimit,
      cpuLimit: config.cpuLimit,
    };

    try {
      await this.startContainer(fullConfig);
      const execConfig: ExecConfig = {
        container: containerName,
        command: config.command,
        workdir: config.workdir ?? "/data",
        timeout: config.timeout ?? 300_000, // 5 min default
        env: config.env ?? {},
        captureStderr: true,
      };
      return await this.execInContainer(execConfig);
    } finally {
      try {
        await this.stopContainer(containerName, { force: true, removeVolumes: true });
      } catch {
        // Best effort cleanup
      }
    }
  }

  /**
   * 列出所有 bioagent- 前缀的容器，返回 Map<容器名称, 状态>。
   *
   * @returns 名称到状态的映射
   */
  async checkAll(): Promise<Map<string, ContainerStatus>> {
    const list = await this.listContainers("bioagent-");
    const map = new Map<string, ContainerStatus>();
    for (const s of list) {
      map.set(s.name, s);
    }
    return map;
  }

  /**
   * 清理创建时间超过指定小时数的容器。
   *
   * @param olderThanHours - 超过该小时数的容器将被移除
   * @returns 清理的容器数量
   */
  async pruneContainers(olderThanHours: number): Promise<number> {
    const list = await this.listContainers("bioagent-");
    const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000;
    let removed = 0;

    for (const status of list) {
      const startedAt = new Date(status.startedAt).getTime();
      if (!isNaN(startedAt) && startedAt < cutoff) {
        try {
          await this.stopContainer(status.name, { force: true, removeVolumes: true });
          removed++;
        } catch {
          // Continue with next
        }
      }
    }

    return removed;
  }

  /**
   * 停止并移除所有 bioagent- 前缀的容器。
   *
   * @returns 停止的容器数量
   */
  async stopAllBioAgentContainers(): Promise<number> {
    const list = await this.listContainers("bioagent-");
    let stopped = 0;

    for (const status of list) {
      try {
        await this.stopContainer(status.name, { force: true, removeVolumes: true });
        stopped++;
      } catch {
        // Continue with next
      }
    }

    return stopped;
  }
}
