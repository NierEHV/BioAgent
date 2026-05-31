// ============================================================
// @bioagent/executor — ResourceProbe
// ============================================================

import { execSync } from "node:child_process";
import * as os from "node:os";
import Docker from "dockerode";
import type { ResourceReport } from "./types.js";

// ---------------------------------------------------------------------------
// ResourceProbe
// ---------------------------------------------------------------------------

export class ResourceProbe {
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
   * 执行全面的宿主机资源探测。
   *
   * 收集 CPU、内存、GPU、磁盘、Docker、Python、R、网络连通性等信息。
   *
   * @returns 完整资源报告
   */
  async probe(): Promise<ResourceReport> {
    const [hostname, cpuModel, distro, kernelVersion, isWsl, cpuCores, cpuThreads, memory, diskVolumes, dockerInfo, pythonInfo, rInfo, networkInfo] =
      await Promise.all([
        this.getHostname(),
        this.getCpuModel(),
        this.getDistro(),
        this.getKernelVersion(),
        this.isWsl(),
        this.getCpuCores(),
        this.getCpuThreads(),
        this.getMemory(),
        this.getDiskVolumes(),
        this.probeDocker(),
        this.probePython(),
        this.probeR(),
        this.probeNetwork(),
      ]);

    return {
      hostname,
      os: {
        platform: process.platform,
        distro: distro ?? undefined,
        kernelVersion: kernelVersion ?? undefined,
        wsl: isWsl,
      },
      cpu: {
        model: cpuModel,
        cores: cpuCores,
        threads: cpuThreads,
        architecture: process.arch as "x86_64" | "arm64",
      },
      memory,
      gpu: await this.probeGpu(),
      disk: { volumes: diskVolumes },
      docker: dockerInfo,
      python: pythonInfo,
      r: rInfo,
      network: networkInfo,
    };
  }

  /**
   * 快速探测：仅返回 Docker 是否运行、可用内存、GPU 是否可用。
   *
   * @returns 快速探测结果
   */
  async probeQuick(): Promise<{
    dockerRunning: boolean;
    availableGB: number;
    gpuAvailable: boolean;
  }> {
    let dockerRunning = false;
    try {
      const info = await this.docker.info();
      dockerRunning = true;
    } catch {
      dockerRunning = false;
    }

    const availableGB = Math.round((os.freemem() / 1e9) * 10) / 10;

    const gpuAvailable = this.hasGpuSync();

    return { dockerRunning, availableGB, gpuAvailable };
  }

  // ---- Private helpers ----

  private async getHostname(): Promise<string> {
    try {
      return execSync("hostname", { encoding: "utf-8", timeout: 3000 }).trim();
    } catch {
      return os.hostname();
    }
  }

  private async getCpuModel(): Promise<string> {
    const cpus = os.cpus();
    if (cpus.length > 0 && cpus[0].model) {
      return cpus[0].model;
    }
    return "Unknown";
  }

  private async getCpuCores(): Promise<number> {
    return os.cpus().length;
  }

  private async getCpuThreads(): Promise<number> {
    return os.cpus().length; // Node.js os.cpus() returns logical cores (threads)
  }

  private async getMemory(): Promise<{ total_gb: number; available_gb: number }> {
    const total = os.totalmem();
    const free = os.freemem();
    return {
      total_gb: Math.round((total / 1e9) * 10) / 10,
      available_gb: Math.round((free / 1e9) * 10) / 10,
    };
  }

  private async getDistro(): Promise<string | null> {
    try {
      if (process.platform === "win32") {
        const output = execSync(
          'powershell -Command "(Get-CimInstance Win32_OperatingSystem).Caption"',
          { encoding: "utf-8", timeout: 5000 },
        );
        return output.trim() || null;
      }
      // Linux
      const output = execSync("cat /etc/os-release 2>/dev/null || lsb_release -d 2>/dev/null", {
        encoding: "utf-8",
        timeout: 5000,
      });
      const match = output.match(/PRETTY_NAME="(.+?)"/);
      if (match) return match[1];
      const lsbMatch = output.match(/Description:\s*(.+)/);
      if (lsbMatch) return lsbMatch[1].trim();
      return null;
    } catch {
      return null;
    }
  }

  private async getKernelVersion(): Promise<string | null> {
    try {
      return execSync("uname -r", { encoding: "utf-8", timeout: 3000 }).trim();
    } catch {
      return null;
    }
  }

  private async isWsl(): Promise<boolean> {
    try {
      const output = execSync("uname -r", { encoding: "utf-8", timeout: 3000 });
      return output.toLowerCase().includes("microsoft")
        || output.toLowerCase().includes("wsl");
    } catch {
      return false;
    }
  }

  private async getDiskVolumes(): Promise<
    { mount: string; total_gb: number; available_gb: number; type: "ssd" | "hdd" }[]
  > {
    const volumes: { mount: string; total_gb: number; available_gb: number; type: "ssd" | "hdd" }[] = [];

    try {
      if (process.platform === "win32") {
        // Windows: list logical drives
        const output = execSync("wmic logicaldisk get DeviceID,Size,FreeSpace /format:csv", {
          encoding: "utf-8",
          timeout: 5000,
        });
        const lines = output.trim().split("\n").slice(1); // Skip header
        for (const line of lines) {
          const parts = line.split(",");
          if (parts.length >= 4) {
            const mount = parts[1]?.trim();
            const size = Number(parts[3]?.trim() || "0");
            const free = Number(parts[2]?.trim() || "0");
            if (mount && size > 0) {
              volumes.push({
                mount: mount + "\\",
                total_gb: Math.round((size / 1e9) * 100) / 100,
                available_gb: Math.round((free / 1e9) * 100) / 100,
                type: "ssd", // Conservative default
              });
            }
          }
        }
      } else {
        // Linux/macOS
        const output = execSync("df -BG / /data 2>/dev/null || df -BG /", {
          encoding: "utf-8",
          timeout: 5000,
        });
        const lines = output.trim().split("\n").slice(1);
        for (const line of lines) {
          const cols = line.split(/\s+/);
          if (cols.length >= 5) {
            const total = Number(cols[1]?.replace("G", "") || "0");
            const avail = Number(cols[3]?.replace("G", "") || "0");
            volumes.push({
              mount: cols[5] || "/",
              total_gb: Math.round(total * 100) / 100,
              available_gb: Math.round(avail * 100) / 100,
              type: "ssd", // Conservative default
            });
          }
        }
      }
    } catch {
      // Fallback
      volumes.push({
        mount: "/",
        total_gb: 100,
        available_gb: 50,
        type: "ssd",
      });
    }

    return volumes;
  }

  private async probeDocker(): Promise<{
    installed: boolean;
    version?: string;
    running: boolean;
    compose_available: boolean;
    images_cached: string[];
  }> {
    let installed = false;
    let version: string | undefined;
    let running = false;
    let composeAvailable = false;
    const imagesCached: string[] = [];

    try {
      const info = await this.docker.info();
      installed = true;
      running = true;

      // Try getting version
      try {
        const ver = await this.docker.version();
        version = ver.Version;
      } catch {
        // Version not critical
      }

      // Try listing images
      try {
        const images = await this.docker.listImages();
        for (const img of images) {
          if (img.RepoTags) {
            for (const tag of img.RepoTags) {
              if (tag && tag !== "<none>:<none>") {
                imagesCached.push(tag);
              }
            }
          }
        }
      } catch {
        // Images not critical
      }

      // Check docker compose
      try {
        execSync("docker compose version 2>/dev/null || docker-compose --version 2>/dev/null", {
          encoding: "utf-8",
          timeout: 5000,
        });
        composeAvailable = true;
      } catch {
        composeAvailable = false;
      }
    } catch {
      // Docker daemon not reachable — check if binary exists
      try {
        execSync("docker --version", { encoding: "utf-8", timeout: 3000 });
        installed = true;
        version = execSync("docker --version", { encoding: "utf-8", timeout: 3000 })
          .trim()
          .match(/(\d+\.\d+\.\d+)/)?.[1];
      } catch {
        installed = false;
      }
    }

    return {
      installed,
      version,
      running,
      compose_available: composeAvailable,
      images_cached: imagesCached,
    };
  }

  private async probeGpu(): Promise<{
    available: boolean;
    models?: string[];
    cuda_version?: string;
    memory_gb?: number;
  }> {
    let available = false;
    const models: string[] = [];
    let cudaVersion: string | undefined;
    let memoryGb: number | undefined;

    // Try nvidia-smi
    try {
      const output = execSync(
        "nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits",
        { encoding: "utf-8", timeout: 10000 },
      );
      available = true;
      const lines = output.trim().split("\n");
      for (const line of lines) {
        const cols = line.split(",").map((c) => c.trim());
        if (cols[0]) models.push(cols[0]);
        if (cols[1] && !memoryGb) {
          // nvidia-smi reports memory in MiB
          memoryGb = Math.round((Number(cols[1]) / 1024) * 10) / 10;
        }
        if (cols[2] && !cudaVersion) cudaVersion = cols[2];
      }
    } catch {
      // No NVIDIA GPU detected
    }

    return {
      available,
      ...(models.length > 0 ? { models } : {}),
      ...(cudaVersion ? { cuda_version: cudaVersion } : {}),
      ...(memoryGb ? { memory_gb: memoryGb } : {}),
    };
  }

  private hasGpuSync(): boolean {
    try {
      execSync("nvidia-smi", { encoding: "utf-8", timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  private async probePython(): Promise<{
    installed: boolean;
    version?: string;
  }> {
    try {
      const output = execSync("python3 --version 2>/dev/null || python --version 2>/dev/null", {
        encoding: "utf-8",
        timeout: 5000,
      });
      const match = output.match(/(\d+\.\d+\.\d+)/);
      return {
        installed: true,
        version: match?.[1] ?? output.trim(),
      };
    } catch {
      return { installed: false };
    }
  }

  private async probeR(): Promise<{
    installed: boolean;
    version?: string;
  }> {
    try {
      const output = execSync("R --version 2>/dev/null | head -n 1", {
        encoding: "utf-8",
        timeout: 5000,
      });
      const match = output.match(/(\d+\.\d+\.\d+)/);
      return {
        installed: true,
        version: match?.[1] ?? output.trim(),
      };
    } catch {
      return { installed: false };
    }
  }

  private async probeNetwork(): Promise<{
    canReachInternet: boolean;
    canReachDockerHub: boolean;
    canReachQuayIO: boolean;
  }> {
    let canReachInternet = false;
    let canReachDockerHub = false;
    let canReachQuayIO = false;

    // Check internet via common DNS
    for (const host of ["8.8.8.8", "1.1.1.1"]) {
      try {
        execSync(
          process.platform === "win32"
            ? `ping -n 1 -w 3000 ${host}`
            : `ping -c 1 -W 3 ${host}`,
          { encoding: "utf-8", timeout: 5000 },
        );
        canReachInternet = true;
        break;
      } catch {
        // continue
      }
    }

    // Check Docker Hub
    try {
      execSync(
        process.platform === "win32"
          ? "ping -n 1 -w 3000 registry-1.docker.io"
          : "ping -c 1 -W 3 registry-1.docker.io",
        { encoding: "utf-8", timeout: 5000 },
      );
      canReachDockerHub = true;
    } catch {
      canReachDockerHub = false;
    }

    // Check Quay.io
    try {
      execSync(
        process.platform === "win32"
          ? "ping -n 1 -w 3000 quay.io"
          : "ping -c 1 -W 3 quay.io",
        { encoding: "utf-8", timeout: 5000 },
      );
      canReachQuayIO = true;
    } catch {
      canReachQuayIO = false;
    }

    return { canReachInternet, canReachDockerHub, canReachQuayIO };
  }
}
