// ============================================================
// @bioagent/executor — VolumeManager
// ============================================================

import { mkdirSync, existsSync, rmSync, statfsSync } from "node:fs";
import { join } from "node:path";
import type { VolumeMount } from "./types.js";

// ---------------------------------------------------------------------------
// VolumeManager
// ---------------------------------------------------------------------------

export class VolumeManager {
  constructor(private basePath: string = "./data") {}

  /**
   * 为项目创建标准数据卷配置。
   *
   * 返回三个挂载点：
   * - /data/input   — 原始数据（只读）
   * - /data/intermediate — 中间数据（读写）
   * - /data/output  — 最终结果（读写）
   *
   * @param projectId - 项目唯一标识
   * @returns 数据卷挂载配置数组
   */
  createProjectVolumes(projectId: string): VolumeMount[] {
    const projectPath = join(this.basePath, "projects", projectId);
    return [
      {
        host: join(projectPath, "raw"),
        container: "/data/input",
        mode: "ro",
      },
      {
        host: join(projectPath, "intermediate"),
        container: "/data/intermediate",
        mode: "rw",
      },
      {
        host: join(projectPath, "output"),
        container: "/data/output",
        mode: "rw",
      },
    ];
  }

  /**
   * 确保项目所需的所有子目录存在。
   *
   * 创建 raw、intermediate、output、checkpoints 四个子目录。
   *
   * @param projectId - 项目唯一标识
   */
  ensureDirectories(projectId: string): void {
    const dirs = ["raw", "intermediate", "output", "checkpoints"];
    const projectPath = join(this.basePath, "projects", projectId);

    for (const dir of dirs) {
      const fullPath = join(projectPath, dir);
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
      }
    }
  }

  /**
   * 磁盘空间检查。
   *
   * 通过 Node.js fs.statfsSync（如果可用）或系统命令检查项目目录所在磁盘的可用空间。
   *
   * @param projectId - 项目唯一标识
   * @param estimatedNeededGB - 预估所需空间（GB）
   * @returns 磁盘空间报告
   */
  async checkDiskSpace(
    projectId: string,
    estimatedNeededGB: number,
  ): Promise<{
    sufficient: boolean;
    available_gb: number;
    needed_gb: number;
    recommendation: string;
  }> {
    const projectPath = join(this.basePath, "projects", projectId);

    // Ensure the directory exists so we can stat it
    if (!existsSync(projectPath)) {
      mkdirSync(projectPath, { recursive: true });
    }

    let availableGB = 0;

    // Try statfsSync first (available in Node 18+)
    try {
      const stats = statfsSync(projectPath);
      availableGB = Math.round((stats.bavail * stats.bsize) / 1e9 * 100) / 100;
    } catch {
      // Fallback: use a platform-specific command
      try {
        const { execSync } = await import("node:child_process");
        if (process.platform === "win32") {
          // Windows: use wmic
          const drive = projectPath[0]?.toUpperCase() ?? "C";
          const output = execSync(
            `wmic logicaldisk where "DeviceID='${drive}:'" get FreeSpace /value`,
            { encoding: "utf-8", timeout: 5000 },
          );
          const match = output.match(/FreeSpace=(\d+)/);
          if (match) {
            availableGB = Math.round((Number(match[1]) / 1e9) * 100) / 100;
          }
        } else {
          // Linux/macOS: use df
          const output = execSync(`df -BG "${projectPath}"`, {
            encoding: "utf-8",
            timeout: 5000,
          });
          const lines = output.trim().split("\n");
          if (lines.length >= 2) {
            const cols = lines[1].split(/\s+/);
            // "Available" is typically the 4th column in df -BG output
            const availStr = cols[3]?.replace("G", "");
            if (availStr) {
              availableGB = Number(availStr);
            }
          }
        }
      } catch {
        // If everything fails, estimate 10 GB as a safe floor
        availableGB = 10;
      }
    }

    const sufficient = availableGB >= estimatedNeededGB * 1.2; // 20% buffer

    let recommendation: string;
    if (sufficient) {
      recommendation = `磁盘空间充足：可用 ${availableGB.toFixed(1)} GB，需要 ${estimatedNeededGB} GB`;
    } else if (availableGB >= estimatedNeededGB) {
      recommendation = `磁盘空间紧张：可用 ${availableGB.toFixed(1)} GB，需要 ${estimatedNeededGB} GB。建议清理中间数据`;
    } else {
      recommendation = `磁盘空间不足：可用 ${availableGB.toFixed(1)} GB，需要 ${estimatedNeededGB} GB。请清理磁盘或选择其他目录`;
    }

    return {
      sufficient,
      available_gb: availableGB,
      needed_gb: estimatedNeededGB,
      recommendation,
    };
  }

  /**
   * 清理指定项目的中间数据。
   *
   * 删除 intermediate 目录下的所有内容，但保留目录本身。
   *
   * @param projectId - 项目唯一标识
   */
  async cleanIntermediate(projectId: string): Promise<void> {
    const intermediatePath = join(
      this.basePath,
      "projects",
      projectId,
      "intermediate",
    );

    if (!existsSync(intermediatePath)) {
      return; // Nothing to clean
    }

    // Read directory contents and remove
    const { readdirSync } = await import("node:fs");
    const entries = readdirSync(intermediatePath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(intermediatePath, entry.name);
      try {
        rmSync(fullPath, { recursive: true, force: true });
      } catch {
        // Skip files that can't be removed
      }
    }
  }

  /**
   * 获取项目的绝对路径。
   *
   * @param projectId - 项目唯一标识
   * @returns 项目根目录的绝对路径
   */
  getProjectPath(projectId: string): string {
    return join(this.basePath, "projects", projectId);
  }

  /**
   * 移除整个项目目录（包括所有数据卷）。
   *
   * @param projectId - 项目唯一标识
   */
  removeProject(projectId: string): void {
    const projectPath = join(this.basePath, "projects", projectId);
    if (existsSync(projectPath)) {
      rmSync(projectPath, { recursive: true, force: true });
    }
  }
}
