// ============================================================
// @bioagent/executor — ImageManager
// ============================================================

import Docker from "dockerode";
import type { PullProgress, PullResult, ImageInfo } from "./types";

// ---------------------------------------------------------------------------
// ImageManager
// ---------------------------------------------------------------------------

export class ImageManager {
  private docker: Docker;

  constructor(docker?: Docker) {
    if (docker) {
      this.docker = docker;
    } else {
      const defaultSocket =
        process.platform === "win32"
          ? "//./pipe/dockerDesktopLinuxEngine"
          : "/var/run/docker.sock";
      this.docker = new Docker({ socketPath: defaultSocket });
    }
  }

  /**
   * 拉取镜像，带进度回调。
   *
   * @param image - 镜像名称（含 tag），如 "python:3.11-slim"
   * @param opts - 可选配置：platform、auth、onProgress
   * @returns 拉取结果（总大小、层数、digest）
   */
  async pull(
    image: string,
    opts?: {
      platform?: string;
      auth?: { username?: string; password?: string; registry?: string };
      onProgress?: (event: PullProgress) => void;
    },
  ): Promise<PullResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pullOptions: any = {};
    if (opts?.platform) {
      pullOptions.platform = opts.platform;
    }
    if (opts?.auth) {
      // Convert to Docker authconfig format if credentials provided
      const authObj = {
        ...(opts.auth.username ? { username: opts.auth.username } : {}),
        ...(opts.auth.password ? { password: opts.auth.password } : {}),
        ...(opts.auth.registry
          ? { serveraddress: opts.auth.registry }
          : {}),
      };
      if (Object.keys(authObj).length > 0) {
        pullOptions.authconfig = authObj;
      }
    }

    const pullStream = await this.docker.pull(image, pullOptions);

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
          if (opts?.onProgress) {
            opts.onProgress({
              status: (event.status as string) ?? "",
              id: event.id as string | undefined,
              progress: event.progress as string | undefined,
              current: event.current as number | undefined,
              total: event.total as number | undefined,
            });
          }
        },
      );
    });

    return { image, totalSize, layers, digest };
  }

  /**
   * 检查镜像详细信息。
   *
   * @param image - 镜像名称（含 tag）
   * @returns 镜像详细信息，不存在时抛出异常
   */
  async inspect(image: string): Promise<ImageInfo> {
    const img = this.docker.getImage(image);
    const info = await img.inspect();

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
  }

  /**
   * 验证工具是否在镜像中可用。
   *
   * 启动临时容器，对每个工具依次执行 `which <tool>` 或 `<tool> --version`，
   * 根据退出码判断工具是否可用。
   *
   * @param image - 镜像名称
   * @param tools - 工具名称数组
   * @returns 工具名到是否可用的映射
   */
  async verifyTools(
    image: string,
    tools: string[],
  ): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};
    const containerName = `bioagent-verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Create and start container
    const container = await this.docker.createContainer({
      name: containerName,
      Image: image,
      Cmd: ["tail", "-f", "/dev/null"],
      HostConfig: { AutoRemove: false },
    });

    try {
      await container.start();

      for (const tool of tools) {
        try {
          // Try `which <tool>` first, fallback to `<tool> --version`
          let exitCode = -1;

          // First attempt: which
          try {
            const execWhich = await container.exec({
              Cmd: ["which", tool],
              AttachStdout: true,
              AttachStderr: true,
            });
            const stream = await execWhich.start({ hijack: true, stdin: false });
            await new Promise<void>((resolve) => {
              stream.on("end", resolve);
              stream.on("error", resolve);
              // Drain the stream
              stream.resume();
            });
            const inspectWhich = await execWhich.inspect();
            exitCode = inspectWhich.ExitCode ?? -1;
          } catch {
            exitCode = -1;
          }

          if (exitCode !== 0) {
            // Second attempt: tool --version
            try {
              const execVersion = await container.exec({
                Cmd: [tool, "--version"],
                AttachStdout: true,
                AttachStderr: true,
              });
              const stream = await execVersion.start({
                hijack: true,
                stdin: false,
              });
              await new Promise<void>((resolve) => {
                stream.on("end", resolve);
                stream.on("error", resolve);
                stream.resume();
              });
              const inspectVersion = await execVersion.inspect();
              exitCode = inspectVersion.ExitCode ?? -1;
            } catch {
              exitCode = -1;
            }
          }

          result[tool] = exitCode === 0;
        } catch {
          result[tool] = false;
        }
      }
    } finally {
      // Clean up
      try {
        await container.kill();
      } catch {
        // May already be stopped
      }
      try {
        await container.remove({ force: true });
      } catch {
        // Best effort
      }
    }

    return result;
  }

  /**
   * 获取镜像中指定工具的版本。
   *
   * @param image - 镜像名称
   * @param tool - 工具名
   * @returns 版本字符串，失败返回 null
   */
  async getToolVersion(image: string, tool: string): Promise<string | null> {
    const containerName = `bioagent-version-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const container = await this.docker.createContainer({
      name: containerName,
      Image: image,
      Cmd: [tool, "--version"],
      HostConfig: { AutoRemove: false },
    });

    try {
      // We need to attach to collect output. Run without auto-remove so we can read logs.
      await container.start();

      // Wait for container to exit (max 10s)
      await container.wait({ condition: "not-running" });

      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: 50,
      });

      // dockerode returns logs as Buffer; trim and take first line
      const text = Buffer.isBuffer(logs)
        ? logs.toString("utf-8").trim()
        : String(logs).trim();

      // Clean Docker log prefix (first 8 bytes are header)
      // The log format is: [STREAM_TYPE, 0, 0, 0, SIZE, 0, 0, 0] + data
      // We'll just extract all printable text
      const versionMatch = text.match(/version\s+([^\s]+)/i)
        ?? text.match(/(\d+\.\d+[^\s]*)/);

      if (versionMatch) {
        return versionMatch[1].replace(/[^a-zA-Z0-9._-]/g, "");
      }

      return text.slice(0, 200) || null;
    } catch {
      return null;
    } finally {
      try {
        await container.remove({ force: true });
      } catch {
        // Best effort
      }
    }
  }

  /**
   * 检查镜像是否已缓存（本地存在）。
   *
   * @param image - 镜像名称（含 tag）
   * @returns 存在则 true
   */
  async isImageCached(image: string): Promise<boolean> {
    try {
      await this.docker.getImage(image).inspect();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取所有已缓存的镜像名称列表。
   *
   * @returns 镜像名称数组（仅返回带 tag 的镜像名）
   */
  async getCachedImages(): Promise<string[]> {
    const images = await this.docker.listImages();
    const names: string[] = [];

    for (const img of images) {
      if (img.RepoTags) {
        for (const tag of img.RepoTags) {
          if (tag && tag !== "<none>:<none>") {
            names.push(tag);
          }
        }
      }
    }

    return names;
  }

  /**
   * 删除指定镜像。
   *
   * @param image - 镜像名称（含 tag）
   */
  async removeImage(image: string): Promise<void> {
    const img = this.docker.getImage(image);
    await img.remove({ force: true });
  }

  /**
   * 清理未使用的镜像（dangling images）。
   *
   * @returns 被清理的镜像 ID 列表
   */
  async pruneImages(): Promise<string[]> {
    const result = await this.docker.pruneImages();
    const deletedIds: string[] = [];

    if (result.ImagesDeleted) {
      for (const entry of result.ImagesDeleted) {
        if (entry.Deleted) {
          deletedIds.push(entry.Deleted);
        }
      }
    }

    // Also try the API prune
    try {
      const imagesBefore = await this.docker.listImages({
        filters: JSON.stringify({ dangling: ["true"] }),
      });
      for (const img of imagesBefore) {
        try {
          await this.docker.getImage(img.Id).remove();
          deletedIds.push(img.Id);
        } catch {
          // Skip images that can't be removed
        }
      }
    } catch {
      // Best effort
    }

    return deletedIds;
  }

  /**
   * 获取镜像大小（字节）。
   *
   * @param image - 镜像名称（含 tag）
   * @returns 镜像大小（字节），不存在时返回 0
   */
  async getImageSize(image: string): Promise<number> {
    try {
      const info = await this.docker.getImage(image).inspect();
      return info.Size ?? 0;
    } catch {
      return 0;
    }
  }
}
