// ============================================================
// @bioagent/executor — Image Search Type Definitions
// ============================================================

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
