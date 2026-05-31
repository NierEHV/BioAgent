// ============================================================
// @bioagent/executor — Core Type Definitions
// ============================================================

/** Docker 容器启动配置 */
export interface ContainerConfig {
  /** Docker 镜像名称 (含 tag)，例如 "rnakato/shortcake_light:latest" */
  image: string;
  /** 容器名称，全局唯一 */
  name: string;
  /** 容器启动命令（ENTRYPOINT 之后的参数） */
  command: string[];
  /** 数据卷挂载列表 */
  volumes: VolumeMount[];
  /** 环境变量 */
  env: Record<string, string>;
  /** 是否启用 GPU（需要 nvidia-container-toolkit） */
  gpu: boolean;
  /** 网络模式 */
  network: "bridge" | "host" | "none";
  /** 内存限制，例如 "64g"、"512m" */
  memoryLimit?: string;
  /** CPU 核心数限制，例如 4 表示最多使用 4 核 */
  cpuLimit?: number;
}

/** 数据卷挂载配置 */
export interface VolumeMount {
  /** 宿主机路径 */
  host: string;
  /** 容器内路径 */
  container: string;
  /** 挂载模式：ro（只读）或 rw（读写） */
  mode: "ro" | "rw";
}

/** 容器内命令执行配置 */
export interface ExecConfig {
  /** 目标容器名称或 ID */
  container: string;
  /** 待执行的 shell 命令（在容器内由 /bin/sh -c 执行） */
  command: string;
  /** 工作目录 */
  workdir: string;
  /** 超时时间（毫秒），超时后返回已收集的输出并标记 truncated: true */
  timeout: number;
  /** 环境变量覆盖 */
  env: Record<string, string>;
  /** 是否单独捕获 stderr */
  captureStderr: boolean;
}

/** 命令执行结果 */
export interface ExecResult {
  /** 退出码，0 表示成功 */
  exitCode: number;
  /** 标准输出（上限 50 KB） */
  stdout: string;
  /** 标准错误（上限 50 KB），仅在 captureStderr 为 true 时收集 */
  stderr: string;
  /** 输出是否因超过 50 KB 上限而被截断 */
  truncated: boolean;
  /** 命令执行耗时（毫秒） */
  duration: number;
  /** 实际执行的命令字符串 */
  command: string;
}

/** 容器状态 */
export interface ContainerStatus {
  /** 容器名称 */
  name: string;
  /** 运行状态 */
  state: "running" | "paused" | "exited" | "dead" | "not_found";
  /** 容器启动时间 (ISO 8601) */
  startedAt: string;
  /** 使用的镜像 */
  imageUsed: string;
  /** 内存使用量（人类可读格式） */
  memoryUsage: string;
  /** CPU 使用百分比 */
  cpuUsagePercent: number;
  /** 当前挂载的数据卷 */
  volumes: VolumeMount[];
}

/** 宿主机资源探测报告 */
export interface ResourceReport {
  /** 主机名 */
  hostname: string;
  /** 操作系统信息 */
  os: { platform: string; distro?: string; kernelVersion?: string; wsl?: boolean };
  /** CPU 信息 */
  cpu: { model: string; cores: number; threads: number; architecture: "x86_64" | "arm64" };
  /** 内存信息 */
  memory: { total_gb: number; available_gb: number };
  /** GPU 信息 */
  gpu: { available: boolean; models?: string[]; cuda_version?: string; memory_gb?: number };
  /** 磁盘信息 */
  disk: { volumes: { mount: string; total_gb: number; available_gb: number; type: "ssd" | "hdd" }[] };
  /** Docker 环境信息 */
  docker: { installed: boolean; version?: string; running: boolean; compose_available: boolean; images_cached: string[] };
  /** Python 环境 */
  python: { installed: boolean; version?: string };
  /** R 环境 */
  r: { installed: boolean; version?: string };
  /** 网络连通性 */
  network: { canReachInternet: boolean; canReachDockerHub: boolean; canReachQuayIO: boolean };
}

/** 镜像拉取进度事件 */
export interface PullProgress {
  /** 当前阶段描述，例如 "Pulling from ..."、"Downloading"、"Extracting" */
  status: string;
  /** 层 ID */
  id?: string;
  /** 进度描述文本，例如 "[>                  ]" */
  progress?: string;
  /** 当前已下载/已提取字节数 */
  current?: number;
  /** 总字节数 */
  total?: number;
}

/** 镜像拉取结果 */
export interface PullResult {
  /** 镜像名称（含 tag） */
  image: string;
  /** 镜像总大小（字节） */
  totalSize: number;
  /** 镜像层数 */
  layers: number;
  /** 镜像摘要 (digest) */
  digest: string;
}

/** 镜像详细信息 */
export interface ImageInfo {
  /** 镜像创建时间 (ISO 8601) */
  Created: string;
  /** 镜像大小（字节） */
  Size: number;
  /** 操作系统 */
  Os: string;
  /** CPU 架构 */
  Architecture: string;
  /** 镜像配置（入口点、命令、环境变量等） */
  Config?: { Entrypoint?: string[]; Cmd?: string[]; Env?: string[] };
  /** 根文件系统层信息 */
  RootFS?: { Layers?: string[] };
}

/** Docker Hub 搜索参数 */
export interface SearchParams {
  /** 搜索关键词 */
  query: string;
  /** 最低 Star 数 */
  minStars: number;
  /** 返回结果数量上限 */
  limit: number;
  /** 是否包含官方镜像 */
  includeOfficial: boolean;
  /** 是否包含 Biocontainers 社区镜像 */
  includeBiocontainers: boolean;
}

/** Docker Hub 搜索结果条目 */
export interface SearchResult {
  /** 镜像全名 (namespace/repository) */
  name: string;
  /** 命名空间 */
  namespace: string;
  /** 仓库名 */
  repository: string;
  /** Star 数 */
  star_count: number;
  /** Pull 次数 */
  pull_count: number;
  /** 最后更新日期 (ISO 8601) */
  last_updated: string;
  /** 简短描述 */
  short_description: string;
  /** 是否为 Docker 官方镜像 */
  is_official: boolean;
  /** 是否为已验证发布者 */
  is_verified: boolean;
  /** 支持的 CPU 架构列表 */
  architectures: string[];
  /** 镜像完整大小（字节） */
  full_size: number;
  /** 可用标签列表 */
  tags: string[];
}
