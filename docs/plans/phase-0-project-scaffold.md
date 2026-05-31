# Phase 0: 项目搭建与验证

**目标:** 完成 monorepo 搭建，安装依赖，验证 Docker → ShortCake 可用
**前置:** 设计文档已批准
**预计:** 5 天 → 约 20 个任务

---

## 文件结构

```
MODIFY: packages/executor/package.json          # 添加 dockerode 依赖
MODIFY: packages/executor/src/index.ts          # 导出 executor 模块
NEW:    packages/executor/src/container-manager.ts
NEW:    packages/executor/src/image-manager.ts
NEW:    packages/executor/src/volume-manager.ts
NEW:    packages/executor/src/resource-probe.ts
NEW:    packages/executor/src/docker-executor.ts
NEW:    packages/executor/src/image-search.ts
NEW:    packages/executor/src/types.ts
NEW:    packages/executor/__tests__/container-manager.test.ts
NEW:    packages/executor/__tests__/image-manager.test.ts
NEW:    packages/executor/__tests__/docker-executor.test.ts
NEW:    packages/executor/vitest.config.ts
NEW:    packages/agent-core/vitest.config.ts
NEW:    packages/knowledge/vitest.config.ts
NEW:    packages/skills/vitest.config.ts
NEW:    packages/workflow/vitest.config.ts
```

---

## Task 0.1: pnpm install & 依赖验证

```bash
cd d:/AIAgent/BioAgent
pnpm install
pnpm typecheck  # 预期: 通过（目前只有占位文件）
```

---

## Task 0.2: 确认 Docker 可用 + ShortCake 镜像

```bash
docker ps
# 预期: Docker daemon 运行中

docker pull rnakato/shortcake_light:latest
# 预期: Pull complete

docker run --rm rnakato/shortcake_light:latest python -c "import scanpy; print(scanpy.__version__)"
# 预期: 1.10.x

docker run --rm rnakato/shortcake_light:latest python -c "import scrublet; print('scrublet OK')"
# 预期: scrublet OK

docker run --rm rnakato/shortcake_light:latest Rscript -e "library(Seurat); sessionInfo()"
# 预期: Seurat 5.x loaded
```

---

## Task 0.3: executor 包 — types.ts 核心类型

```typescript
// packages/executor/src/types.ts
// 从设计文档 §6 提取的所有接口，完整实现

export interface ContainerConfig {
  image: string;
  name: string;
  command: string[];
  volumes: VolumeMount[];
  env: Record<string, string>;
  gpu: boolean;
  network: "bridge" | "host" | "none";
  memoryLimit?: string;
  cpuLimit?: number;
}

export interface VolumeMount {
  host: string;
  container: string;
  mode: "ro" | "rw";
}

export interface ExecConfig {
  container: string;
  command: string;
  workdir: string;
  timeout: number;
  env: Record<string, string>;
  captureStderr: boolean;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
  duration: number;
  command: string;
}

export interface ContainerStatus {
  name: string;
  state: "running" | "paused" | "exited" | "dead" | "not_found";
  startedAt: string;
  imageUsed: string;
  memoryUsage: string;
  cpuUsagePercent: number;
  volumes: VolumeMount[];
}

export interface ResourceReport {
  hostname: string;
  os: { platform: string; distro?: string; kernelVersion?: string; wsl?: boolean };
  cpu: { model: string; cores: number; threads: number; architecture: "x86_64" | "arm64" };
  memory: { total_gb: number; available_gb: number };
  gpu: { available: boolean; models?: string[]; cuda_version?: string; memory_gb?: number };
  disk: { volumes: { mount: string; total_gb: number; available_gb: number; type: "ssd" | "hdd" }[] };
  docker: { installed: boolean; version?: string; running: boolean; compose_available: boolean; images_cached: string[] };
  python: { installed: boolean; version?: string };
  r: { installed: boolean; version?: string };
  network: { canReachInternet: boolean; canReachDockerHub: boolean; canReachQuayIO: boolean };
}

export interface PullProgress {
  status: string;
  id?: string;
  progress?: string;
  current?: number;
  total?: number;
}

export interface PullResult {
  image: string;
  totalSize: number;
  layers: number;
  digest: string;
}

export interface ImageInfo {
  Created: string;
  Size: number;
  Os: string;
  Architecture: string;
  Config?: { Entrypoint?: string[]; Cmd?: string[]; Env?: string[] };
  RootFS?: { Layers?: string[] };
}

export interface SearchParams {
  query: string;
  minStars: number;
  limit: number;
  includeOfficial: boolean;
  includeBiocontainers: boolean;
}

export interface SearchResult {
  name: string;
  namespace: string;
  repository: string;
  star_count: number;
  pull_count: number;
  last_updated: string;
  short_description: string;
  is_official: boolean;
  is_verified: boolean;
  architectures: string[];
  full_size: number;
  tags: string[];
}
```

---

## Task 0.4: executor 包 — ContainerManager 实现

```typescript
// packages/executor/src/container-manager.ts

import Docker from "dockerode";
import type { ContainerConfig, ExecConfig, ExecResult, ContainerStatus, VolumeMount } from "./types";

export class ContainerManager {
  private docker: Docker;

  constructor(dockerConfig?: { host?: string; socketPath?: string }) {
    this.docker = new Docker(dockerConfig);
  }

  /** 确保镜像在本地存在，不存在则拉取 */
  async ensureImage(image: string, platform?: string): Promise<void> {
    const exists = await this.imageExists(image);
    if (!exists) {
      await new Promise<void>((resolve, reject) => {
        this.docker.pull(image, { platform }, (err: any, stream: any) => {
          if (err) return reject(err);
          this.docker.modem.followProgress(stream, (err: any) => {
            if (err) return reject(err);
            resolve();
          });
        });
      });
    }
  }

  /** 检查镜像是否存在 */
  async imageExists(image: string): Promise<boolean> {
    try {
      await this.docker.getImage(image).inspect();
      return true;
    } catch {
      return false;
    }
  }

  /** 启动容器并保持运行 */
  async startContainer(config: ContainerConfig): Promise<{ containerId: string; startedAt: string }> {
    await this.ensureImage(config.image);

    const container = await this.docker.createContainer({
      Image: config.image,
      name: config.name,
      Cmd: config.command,
      HostConfig: {
        Binds: config.volumes.map(v => `${v.host}:${v.container}:${v.mode}`),
        Memory: config.memoryLimit ? parseMemoryLimit(config.memoryLimit) : undefined,
        NanoCpus: config.cpuLimit ? config.cpuLimit * 1e9 : undefined,
        NetworkMode: config.network,
      },
      Env: Object.entries(config.env).map(([k, v]) => `${k}=${v}`),
    });

    await container.start();
    const inspect = await container.inspect();

    return {
      containerId: container.id,
      startedAt: inspect.State.StartedAt,
    };
  }

  /** 在运行中的容器内执行命令 */
  async execInContainer(config: ExecConfig): Promise<ExecResult> {
    const container = this.docker.getContainer(config.container);
    const startTime = Date.now();

    const exec = await container.exec({
      Cmd: ["sh", "-c", config.command],
      WorkingDir: config.workdir,
      Env: Object.entries(config.env).map(([k, v]) => `${k}=${v}`),
      AttachStdout: true,
      AttachStderr: config.captureStderr,
    });

    const stream = await exec.start({ Detach: false, Tty: false });

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let truncated = false;
      const MAX_OUTPUT = 50_000; // 50KB limit

      const timeout = setTimeout(() => {
        stream.destroy();
        truncated = true;
        resolve({
          exitCode: -1,
          stdout: stdout.slice(-MAX_OUTPUT),
          stderr: stderr.slice(-MAX_OUTPUT),
          truncated: true,
          duration: Date.now() - startTime,
          command: config.command,
        });
      }, config.timeout);

      container.modem.demuxStream(stream, {
        write: (chunk: Buffer) => {
          if (stdout.length < MAX_OUTPUT) stdout += chunk.toString();
        },
      }, {
        write: (chunk: Buffer) => {
          if (stderr.length < MAX_OUTPUT) stderr += chunk.toString();
        },
      });

      stream.on("end", async () => {
        clearTimeout(timeout);
        const inspect = await exec.inspect();
        resolve({
          exitCode: inspect.ExitCode ?? -1,
          stdout: stdout.slice(-MAX_OUTPUT),
          stderr: stderr.slice(-MAX_OUTPUT),
          truncated: stdout.length > MAX_OUTPUT || stderr.length > MAX_OUTPUT,
          duration: Date.now() - startTime,
          command: config.command,
        });
      });

      stream.on("error", (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /** 停止并删除容器 */
  async stopContainer(name: string, opts: { force: boolean; removeVolumes: boolean }): Promise<void> {
    const container = this.docker.getContainer(name);
    await container.stop({ t: opts.force ? 0 : 10 });
    await container.remove({ v: opts.removeVolumes });
  }

  /** 获取容器状态 */
  async getContainerStatus(name: string): Promise<ContainerStatus> {
    try {
      const container = this.docker.getContainer(name);
      const inspect = await container.inspect();
      const stats = await container.stats({ stream: false });

      return {
        name,
        state: inspect.State.Status as ContainerStatus["state"],
        startedAt: inspect.State.StartedAt,
        imageUsed: inspect.Config.Image,
        memoryUsage: formatBytes(stats.memory_stats?.usage ?? 0),
        cpuUsagePercent: calculateCPUPercent(stats),
        volumes: inspect.Mounts.map(m => ({
          host: m.Source,
          container: m.Destination,
          mode: m.Mode as "ro" | "rw",
        })),
      };
    } catch (err: any) {
      if (err.statusCode === 404) {
        return { name, state: "not_found", startedAt: "", imageUsed: "", memoryUsage: "", cpuUsagePercent: 0, volumes: [] };
      }
      throw err;
    }
  }

  /** 列出所有 BioAgent 管理的容器 */
  async listContainers(filter?: string): Promise<ContainerStatus[]> {
    const containers = await this.docker.listContainers({ all: true });
    const filtered = filter
      ? containers.filter(c => c.Names.some(n => n.includes(filter)))
      : containers;

    return Promise.all(
      filtered.map(c => this.getContainerStatus(c.Names[0].replace(/^\//, "")))
    );
  }

  /** 一次性运行命令（用完即删） */
  async runOnce(config: { image: string; command: string; timeout: number; volumes?: VolumeMount[] }): Promise<ExecResult> {
    const randomName = `bioagent-once-${Date.now()}`;
    const container = await this.docker.createContainer({
      Image: config.image,
      name: randomName,
      Cmd: ["sh", "-c", config.command],
      HostConfig: {
        AutoRemove: true,
        Binds: config.volumes?.map(v => `${v.host}:${v.container}:${v.mode}`) ?? [],
      },
    });

    await container.start();
    const startTime = Date.now();
    
    try {
      const result = await this.execInContainer({
        container: randomName,
        command: config.command,
        workdir: "/data",
        timeout: config.timeout,
        env: {},
        captureStderr: true,
      });
      return result;
    } finally {
      try { await container.stop({ t: 0 }); } catch {}
      try { await container.remove({ force: true }); } catch {}
    }
  }

  /** 批量检查容器状态 */
  async checkAll(): Promise<Map<string, ContainerStatus>> {
    const all = await this.listContainers("bioagent-");
    return new Map(all.map(s => [s.name, s]));
  }

  /** 清理旧容器 */
  async pruneContainers(olderThanHours: number): Promise<string[]> {
    const containers = await this.docker.listContainers({ all: true });
    const cutoff = Date.now() - olderThanHours * 3600_000;
    const removed: string[] = [];

    for (const c of containers) {
      const created = new Date(c.Created).getTime();
      if (created < cutoff && c.Names.some(n => n.includes("bioagent-"))) {
        const name = c.Names[0].replace(/^\//, "");
        await this.stopContainer(name, { force: true, removeVolumes: true });
        removed.push(name);
      }
    }
    return removed;
  }

  /** 停止所有 BioAgent 容器 */
  async stopAllBioAgentContainers(): Promise<void> {
    const containers = await this.docker.listContainers({ all: true });
    const bioContainers = containers.filter(c => c.Names.some(n => n.includes("bioagent-")));
    await Promise.all(
      bioContainers.map(c => {
        const name = c.Names[0].replace(/^\//, "");
        return this.stopContainer(name, { force: true, removeVolumes: false });
      })
    );
  }
}

// 辅助函数
function parseMemoryLimit(mem: string): number {
  const match = mem.match(/^(\d+)\s*(g|gb|m|mb)?$/i);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  const unit = (match[2] || "b").toLowerCase();
  if (unit.startsWith("g")) return value * 1024 * 1024 * 1024;
  if (unit.startsWith("m")) return value * 1024 * 1024;
  return value;
}

function formatBytes(bytes: number): string {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function calculateCPUPercent(stats: any): number {
  const cpuDelta = stats.cpu_stats?.cpu_usage?.total_usage - stats.precpu_stats?.cpu_usage?.total_usage;
  const systemDelta = stats.cpu_stats?.system_cpu_usage - stats.precpu_stats?.system_cpu_usage;
  if (!cpuDelta || !systemDelta) return 0;
  return (cpuDelta / systemDelta) * stats.cpu_stats?.online_cpus * 100;
}
```

---

## Task 0.5: executor 包 — ContainerManager 单元测试

```typescript
// packages/executor/__tests__/container-manager.test.ts

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ContainerManager } from "../src/container-manager";

const TEST_IMAGE = "rnakato/shortcake_light:latest";
const TEST_CONTAINER = "bioagent-test-cm";

describe("ContainerManager", () => {
  const cm = new ContainerManager();

  beforeAll(async () => {
    // 确保测试镜像存在
    await cm.ensureImage(TEST_IMAGE);
  }, 300_000);

  afterAll(async () => {
    // 清理
    try { await cm.stopContainer(TEST_CONTAINER, { force: true, removeVolumes: true }); } catch {}
  });

  it("imageExists returns true for pulled image", async () => {
    const exists = await cm.imageExists(TEST_IMAGE);
    expect(exists).toBe(true);
  });

  it("imageExists returns false for nonexistent image", async () => {
    const exists = await cm.imageExists("nonexistent/image:tag");
    expect(exists).toBe(false);
  });

  it("startContainer creates and runs a container", async () => {
    const result = await cm.startContainer({
      image: TEST_IMAGE,
      name: TEST_CONTAINER,
      command: ["tail", "-f", "/dev/null"],
      volumes: [],
      env: {},
      gpu: false,
      network: "bridge",
    });
    expect(result.containerId).toBeTruthy();
    expect(result.startedAt).toBeTruthy();
  }, 60_000);

  it("getContainerStatus returns running for running container", async () => {
    const status = await cm.getContainerStatus(TEST_CONTAINER);
    expect(status.state).toBe("running");
    expect(status.name).toBe(TEST_CONTAINER);
  });

  it("execInContainer runs a command and returns output", async () => {
    const result = await cm.execInContainer({
      container: TEST_CONTAINER,
      command: 'python -c "import scanpy; print(scanpy.__version__)"',
      workdir: "/data",
      timeout: 30_000,
      env: {},
      captureStderr: true,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+/);
  }, 60_000);

  it("execInContainer captures stderr", async () => {
    const result = await cm.execInContainer({
      container: TEST_CONTAINER,
      command: 'python -c "import sys; print(\'ok\'); print(\'err\', file=sys.stderr)"',
      workdir: "/data",
      timeout: 10_000,
      env: {},
      captureStderr: true,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ok");
    expect(result.stderr).toContain("err");
  });

  it("execInContainer handles command failure", async () => {
    const result = await cm.execInContainer({
      container: TEST_CONTAINER,
      command: "python -c 'raise SystemExit(1)'",
      workdir: "/data",
      timeout: 10_000,
      env: {},
      captureStderr: true,
    });
    expect(result.exitCode).toBe(1);
  });

  it("listContainers includes test container", async () => {
    const list = await cm.listContainers("bioagent-test");
    expect(list.some(c => c.name === TEST_CONTAINER)).toBe(true);
  });

  it("stopContainer stops and removes the container", async () => {
    await cm.stopContainer(TEST_CONTAINER, { force: true, removeVolumes: true });
    const status = await cm.getContainerStatus(TEST_CONTAINER);
    expect(status.state).toBe("not_found");
  });

  it("runOnce creates and destroys a temporary container", async () => {
    const result = await cm.runOnce({
      image: TEST_IMAGE,
      command: "echo 'hello one-shot'",
      timeout: 10_000,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hello one-shot");

    // 验证容器已被清理
    const list = await cm.listContainers("bioagent-once");
    expect(list.length).toBe(0);
  }, 60_000);
});
```

---

## Task 0.6: executor 包 — ImageManager 实现

```typescript
// packages/executor/src/image-manager.ts

import Docker from "dockerode";
import type { PullProgress, PullResult, ImageInfo } from "./types";

export class ImageManager {
  private docker: Docker;

  constructor(dockerConfig?: { host?: string; socketPath?: string }) {
    this.docker = new Docker(dockerConfig);
  }

  /** 拉取镜像（带进度回调） */
  async pull(
    image: string,
    opts: { platform?: string; auth?: { username?: string; password?: string; registry?: string }; onProgress?: (event: PullProgress) => void }
  ): Promise<PullResult> {
    const auth = opts.auth ? {
      username: opts.auth.username,
      password: opts.auth.password,
      serveraddress: opts.auth.registry || "https://index.docker.io/v1/",
    } : undefined;

    return new Promise((resolve, reject) => {
      this.docker.pull(image, { platform: opts.platform, authconfig: auth as any }, (err: any, stream: any) => {
        if (err) return reject(err);

        let totalSize = 0;
        let layers = 0;

        this.docker.modem.followProgress(
          stream,
          (err: any, output: any[]) => {
            if (err) return reject(err);
            const lastOutput = output[output.length - 1];
            resolve({
              image,
              totalSize,
              layers,
              digest: lastOutput?.aux?.Digest || "",
            });
          },
          (event: any) => {
            if (event.progressDetail) {
              totalSize += event.progressDetail.total || 0;
              if (event.progressDetail.total === event.progressDetail.current) layers++;
            }
            opts.onProgress?.({
              status: event.status,
              id: event.id,
              progress: event.progress,
              current: event.progressDetail?.current,
              total: event.progressDetail?.total,
            });
          }
        );
      });
    });
  }

  /** 检查镜像信息 */
  async inspect(image: string): Promise<ImageInfo> {
    const img = this.docker.getImage(image);
    const info = await img.inspect();
    return {
      Created: info.Created,
      Size: info.Size,
      Os: info.Os,
      Architecture: info.Architecture,
      Config: info.Config ? {
        Entrypoint: info.Config.Entrypoint as string[] | undefined,
        Cmd: info.Config.Cmd as string[] | undefined,
        Env: info.Config.Env,
      } : undefined,
      RootFS: info.RootFS ? { Layers: info.RootFS.Layers } : undefined,
    };
  }

  /** 验证指定工具是否在镜像中可用 */
  async verifyTools(image: string, tools: string[]): Promise<Record<string, boolean>> {
    const container = await this.docker.createContainer({
      Image: image,
      Cmd: ["tail", "-f", "/dev/null"],
      HostConfig: { AutoRemove: true },
    });
    await container.start();

    const result: Record<string, boolean> = {};
    try {
      for (const tool of tools) {
        try {
          const exec = await container.exec({
            Cmd: ["which", tool],
            AttachStdout: true,
          });
          const stream = await exec.start({ Detach: false });
          let output = "";
          await new Promise<void>((resolve) => {
            stream.on("data", (chunk: Buffer) => { output += chunk.toString(); });
            stream.on("end", resolve);
          });
          result[tool] = output.trim().length > 0;
        } catch {
          result[tool] = false;
        }
      }
    } finally {
      await container.stop({ t: 0 }).catch(() => {});
      await container.remove({ force: true }).catch(() => {});
    }

    return result;
  }

  /** 获取工具版本 */
  async getToolVersion(image: string, tool: string): Promise<string | null> {
    try {
      const container = await this.docker.createContainer({
        Image: image,
        Cmd: ["sh", "-c", `${tool} --version 2>&1 || python -c "import ${tool}; print(${tool}.__version__)" 2>&1 || echo ''`],
        HostConfig: { AutoRemove: true },
      });
      await container.start();
      const logs = await container.logs({ stdout: true, stderr: true });
      await container.stop({ t: 0 }).catch(() => {});
      await container.remove({ force: true }).catch(() => {});

      const output = logs.toString().trim();
      return output.length > 0 ? output.split("\n")[0] : null;
    } catch {
      return null;
    }
  }

  /** 检查是否本地已缓存 */
  async isImageCached(image: string): Promise<boolean> {
    try {
      await this.docker.getImage(image).inspect();
      return true;
    } catch {
      return false;
    }
  }

  /** 获取所有已缓存的镜像 */
  async getCachedImages(): Promise<string[]> {
    const images = await this.docker.listImages();
    return images.flatMap(img => img.RepoTags || []).filter(t => t !== "<none>:<none>");
  }

  /** 删除镜像 */
  async removeImage(image: string): Promise<void> {
    const img = this.docker.getImage(image);
    await img.remove({ force: false });
  }

  /** 清理未使用的镜像 */
  async pruneImages(): Promise<string[]> {
    const result = await this.docker.pruneImages({});
    return result.ImagesDeleted?.map(i => i.Untagged || i.Deleted || "unknown") || [];
  }

  /** 获取镜像实际大小 */
  async getImageSize(image: string): Promise<number> {
    const info = await this.inspect(image);
    return info.Size;
  }
}
```

**提交:** `git commit -m "feat(executor): add ContainerManager and ImageManager implementations"`

---

## Task 0.7: executor 包 — VolumeManager + ResourceProbe

详见设计文档 §6.4 和 §6.5 的接口定义，完整实现。

核心逻辑：
- `VolumeManager.createProjectVolumes(projectId)` → 返回标准 3 卷配置
- `VolumeManager.ensureDirectories(projectId)` → mkdir data/projects/{id}/raw, intermediate, output, checkpoints
- `VolumeManager.checkDiskSpace(projectId, estimatedGB)` → 检查可用空间
- `ResourceProbe.probe()` → 执行 `docker info`, `nproc`, `free`, `df`, `nvidia-smi` 等命令采集宿主机资源

---

## Task 0.8: executor 包 — ImageSearch 实现

从设计文档 §6.3 实现 Docker Hub 搜索：
- `searchDockerHub(params)` → 调用 Docker Hub v2 API 搜索
- `searchBioContainers(toolName)` → 调用 quay.io API
- `getTags(imageName)` → 获取镜像 tags
- `evaluateImage(result)` → 自动评估 verdict + reasons

搜索逻辑：query 自动追加 "bioinformatics" 关键词，结果按 stars desc 排序。对每个结果调用 `evaluateImage` 打分。

---

## Task 0.9: executor 包 — DockerExecutor 统一入口

```typescript
// packages/executor/src/docker-executor.ts

export class DockerExecutor {
  readonly containerManager: ContainerManager;
  readonly imageManager: ImageManager;
  readonly imageSearch: ImageSearchService;
  readonly volumeManager: VolumeManager;
  readonly resourceProbe: ResourceProbe;

  constructor(config?: { dockerHost?: string }) {
    this.containerManager = new ContainerManager(config);
    this.imageManager = new ImageManager(config);
    this.imageSearch = new ImageSearchService();
    this.volumeManager = new VolumeManager();
    this.resourceProbe = new ResourceProbe();
  }

  async healthCheck() { /* Docker可用性 + 镜像缓存状态 */ }
  async prepareForScRNA() { /* 检查/拉取 shortcake_full */ }
  async initProject(projectId: string) { /* 创建目录结构 + 卷配置 */ }
  async cleanup(projectId?: string) { /* 停止容器 + 清理中间数据 */ }
}

export { ContainerManager, ImageManager, ImageSearchService, VolumeManager, ResourceProbe };
```

---

## Task 0.10: 运行全部测试，确认 executor 包通过

```bash
cd d:/AIAgent/BioAgent
pnpm --filter @bioagent/executor test:unit
```

预期：10 个 ContainerManager 测试 + ImageManager 测试 + ResourceProbe 测试 全部通过。

---

## Task 0.11-0.15: 后续 Phase 0 收尾

- **0.11:** 更新 `packages/executor/src/index.ts` 导出全部模块
- **0.12:** 创建 ChromaDB 种子验证脚本 `packages/knowledge/scripts/verify-chroma.ts`
- **0.13:** 初始化 KuzuDB schema 脚本（仅创建 node/rel tables，暂不注入数据）
- **0.14:** 检查所有 package 的 tsconfig 能正确编译：`pnpm typecheck`
- **0.15:** 最终验证：端到端 `docker run shortcake python -c "import scanpy"` 通过

---

## Phase 0 验收标准

- [ ] `pnpm install` 无错误
- [ ] `pnpm typecheck` 通过（所有包）
- [ ] `pnpm --filter @bioagent/executor test:unit` 全部通过
- [ ] `docker run rnakato/shortcake_light python -c "import scanpy"` 返回版本号
- [ ] `ContainerManager.startContainer` → `execInContainer` → `stopContainer` 生命周期正常
- [ ] `ImageManager.verifyTools` 能验证 scanpy/seurat/scrublet 存在
- [ ] GitHub Actions CI 配置就绪
