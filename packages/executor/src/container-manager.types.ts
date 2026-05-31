// ============================================================
// @bioagent/executor — Container Manager Type Definitions
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
  /** 待执行的 shell 命令（在容器内由 sh -c 执行） */
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
