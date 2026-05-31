// ============================================================
// @bioagent/executor — Project Initializer
// ============================================================
// 当用户打开或创建一个目录时，自动初始化为标准生信分析目录。
// 静默执行，不阻塞用户操作。

import * as fs from "node:fs";
import * as path from "node:path";

export interface ProjectInitResult {
  /** 已创建的目录列表 */
  createdDirs: string[];
  /** 是否创建了 project.yml */
  createdConfig: boolean;
  /** project.yml 的完整路径 */
  configPath: string;
}

const STANDARD_DIRS = ["raw", "intermediate", "output", "checkpoints"];

const DEFAULT_PROJECT_YML = `# BioAgent Project Configuration
# Auto-generated — edit via conversation with BioAgent

name: {NAME}
omics: unknown
species: unknown
created: "{DATE}"
`;

/**
 * 确保指定目录包含标准的生信分析目录结构和 project.yml。
 *
 * - 静默创建缺失的 raw/ intermediate/ output/ checkpoints/ 目录
 * - 如果 project.yml 不存在，创建默认模板
 * - 如果所有内容已存在，不做任何操作
 *
 * @param dirPath - 目标目录路径
 * @returns 初始化结果（创建了什么）
 */
export function ensureProjectDir(dirPath: string): ProjectInitResult {
  const result: ProjectInitResult = {
    createdDirs: [],
    createdConfig: false,
    configPath: path.join(dirPath, "project.yml"),
  };

  // Ensure base directory exists
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Create standard subdirectories
  for (const dir of STANDARD_DIRS) {
    const fullPath = path.join(dirPath, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      result.createdDirs.push(dir);
    }
  }

  // Create project.yml if missing
  if (!fs.existsSync(result.configPath)) {
    const dirName = path.basename(dirPath);
    const content = DEFAULT_PROJECT_YML
      .replace("{NAME}", dirName)
      .replace("{DATE}", new Date().toISOString().split("T")[0]);
    fs.writeFileSync(result.configPath, content, "utf-8");
    result.createdConfig = true;
  }

  return result;
}

/**
 * 仅检查目录是否已初始化（不创建任何内容）。
 */
export function isProjectDir(dirPath: string): boolean {
  for (const dir of STANDARD_DIRS) {
    if (!fs.existsSync(path.join(dirPath, dir))) return false;
  }
  return fs.existsSync(path.join(dirPath, "project.yml"));
}
