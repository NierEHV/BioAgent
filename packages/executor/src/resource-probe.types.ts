// ============================================================
// @bioagent/executor — Resource Probe Type Definitions
// ============================================================

/** 宿主机资源探测报告 */
export interface ResourceReport {
  /** 主机名 */
  hostname: string;
  /** 操作系统信息 */
  os: {
    platform: string;
    distro?: string;
    kernelVersion?: string;
    wsl?: boolean;
  };
  /** CPU 信息 */
  cpu: {
    model: string;
    cores: number;
    threads: number;
    architecture: "x86_64" | "arm64";
  };
  /** 内存信息 */
  memory: {
    total_gb: number;
    available_gb: number;
  };
  /** GPU 信息 */
  gpu: {
    available: boolean;
    models?: string[];
    cuda_version?: string;
    memory_gb?: number;
  };
  /** 磁盘信息 */
  disk: {
    volumes: Array<{
      mount: string;
      total_gb: number;
      available_gb: number;
      type: "ssd" | "hdd";
    }>;
  };
  /** Docker 环境信息 */
  docker: {
    installed: boolean;
    version?: string;
    running: boolean;
    compose_available: boolean;
    images_cached: string[];
  };
  /** Python 环境 */
  python: {
    installed: boolean;
    version?: string;
  };
  /** R 环境 */
  r: {
    installed: boolean;
    version?: string;
  };
  /** 网络连通性 */
  network: {
    canReachInternet: boolean;
    canReachDockerHub: boolean;
    canReachQuayIO: boolean;
  };
}
