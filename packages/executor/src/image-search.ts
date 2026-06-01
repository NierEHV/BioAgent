// ============================================================
// @bioagent/executor — ImageSearchService
// ============================================================

import type { SearchParams, SearchResult } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 计算给定日期字符串距今天数 */
export function daysAgo(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// ---------------------------------------------------------------------------
// ImageSearchService
// ---------------------------------------------------------------------------

export class ImageSearchService {
  private readonly dockerHubBase = "https://hub.docker.com/v2";
  private readonly quayBase = "https://quay.io/api/v1";
  private proxyUrl: string | undefined;

  constructor(proxyUrl?: string) {
    this.proxyUrl = proxyUrl || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
  }

  /**
   * 搜索 Docker Hub。
   *
   * 使用 Docker Hub v2 API 按关键词搜索，并附加 bioinformatics 限定词。
   * 返回结果按 Stars 降序排列、按 minStars 过滤。
   *
   * @param params - 搜索参数
   * @returns 搜索结果数组
   */
  async searchDockerHub(params: SearchParams): Promise<SearchResult[]> {
    const query = `${params.query} bioinformatics`;
    const pageSize = Math.min(params.limit, 100);
    const url = `${this.dockerHubBase}/search/repositories/?query=${encodeURIComponent(query)}&ordering=stars&page_size=${pageSize}`;

    const fetchOptions: any = {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
    };

    // Use proxy if configured
    if (this.proxyUrl) {
      try {
        const { ProxyAgent } = await import("undici");
        fetchOptions.dispatcher = new ProxyAgent(this.proxyUrl);
      } catch {
        // undici ProxyAgent not available, try without proxy
      }
    }

    let response: globalThis.Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch {
      return []; // Network error — return empty
    }

    if (!response.ok) {
      // If the API returns an error, try a simpler query without bioinformatics suffix
      if (params.query.length > 0) {
        return this.searchDockerHubSimple(params);
      }
      return [];
    }

    const data = (await response.json()) as {
      results?: DockerHubApiItem[];
      count?: number;
    };

    const results = (data.results || [])
      .map((item) => this.mapToSearchResult(item))
      .filter((r) => r.star_count >= params.minStars);

    // Apply additional filters
    return results.filter((r) => {
      if (!params.includeOfficial && r.is_official) return false;
      if (!params.includeBiocontainers && r.namespace === "biocontainers")
        return false;
      return true;
    });
  }

  /** Fallback search without bioinformatics suffix */
  private async searchDockerHubSimple(
    params: SearchParams,
  ): Promise<SearchResult[]> {
    const pageSize = Math.min(params.limit, 100);
    const url = `${this.dockerHubBase}/search/repositories/?query=${encodeURIComponent(params.query)}&ordering=stars&page_size=${pageSize}`;

    try {
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return [];

      const data = (await response.json()) as {
        results?: DockerHubApiItem[];
      };

      return (data.results || [])
        .map((item) => this.mapToSearchResult(item))
        .filter((r) => r.star_count >= params.minStars);
    } catch {
      return [];
    }
  }

  /**
   * 搜索 BioContainers (Quay.io)。
   *
   * 在 quay.io 上搜索 bioinformatics 工具镜像。
   *
   * @param toolName - 工具名
   * @returns 搜索结果数组
   */
  async searchBioContainers(toolName: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Query the quay.io repository list API
    try {
      const url = `${this.quayBase}/repository?popularity=true&namespace=biocontainers&public=true`;
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          repositories?: QuayRepoItem[];
        };

        if (data.repositories) {
          for (const repo of data.repositories) {
            if (
              repo.name &&
              repo.name.toLowerCase().includes(toolName.toLowerCase())
            ) {
              results.push(this.mapQuayToSearchResult(repo));
            }
          }
        }
      }
    } catch {
      // Network error — try fallback
    }

    // Fallback: also search by keyword using quay.io API
    if (results.length === 0) {
      try {
        const url = `${this.quayBase}/repository?public=true&namespace=biocontainers`;
        const response = await fetch(url, {
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          const data = (await response.json()) as {
            repositories?: QuayRepoItem[];
          };
          if (data.repositories) {
            for (const repo of data.repositories) {
              if (
                repo.name &&
                repo.name.toLowerCase().includes(toolName.toLowerCase())
              ) {
                results.push(this.mapQuayToSearchResult(repo));
              }
            }
          }
        }
      } catch {
        // Both attempts failed — return whatever we have
      }
    }

    return results;
  }

  /**
   * 获取镜像的可用标签列表。
   *
   * 查询 Docker Hub 的 tags API。
   *
   * @param imageName - 镜像名称（namespace/repository）
   * @param limit - 返回标签数量上限，默认 20
   * @returns 标签数组
   */
  async getTags(imageName: string, limit: number = 20): Promise<string[]> {
    // Normalize image name (remove tag if present)
    const repo = imageName.includes(":")
      ? imageName.split(":")[0]
      : imageName;

    // Handle cases where image might be on quay.io
    if (repo.includes("quay.io")) {
      return this.getQuayTags(repo.replace("quay.io/", ""), limit);
    }

    try {
      const pageSize = Math.min(limit, 100);
      const url = `${this.dockerHubBase}/repositories/${repo}/tags/?page_size=${pageSize}&ordering=last_updated`;

      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return [];

      const data = (await response.json()) as {
        results?: { name: string }[];
      };

      const tags = (data.results || []).map((t) => t.name);
      return tags.slice(0, limit);
    } catch {
      return [];
    }
  }

  /** Get tags from quay.io */
  private async getQuayTags(
    repo: string,
    limit: number,
  ): Promise<string[]> {
    try {
      const url = `${this.quayBase}/repository/${repo}/tag/?limit=${limit}`;
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return [];

      const data = (await response.json()) as {
        tags?: { name: string }[];
      };

      return (data.tags || []).map((t) => t.name).slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * 评估镜像质量。
   *
   * 基于更新频率、Stars 数、是否官方/社区镜像等因素，
   * 给出 "recommended" / "try" / "avoid" 的判断。
   *
   * @param image - 搜索结果条目
   * @returns 评估结论及理由
   */
  evaluateImage(image: SearchResult): {
    verdict: "recommended" | "try" | "avoid";
    reasons: string[];
  } {
    const daysSinceUpdate = daysAgo(image.last_updated);
    const reasons: string[] = [];
    let verdict: "recommended" | "try" | "avoid" = "try";

    // Avoid: more than 2 years without updates
    if (daysSinceUpdate > 730) {
      verdict = "avoid";
      reasons.push("超过2年未更新");
    }
    // Avoid: more than 1 year with low stars
    else if (daysSinceUpdate > 365 && image.star_count < 10) {
      verdict = "avoid";
      reasons.push("超过1年未更新且Stars不足");
    }
    // Recommended: official image with decent stars
    else if (image.is_official && image.star_count >= 10) {
      verdict = "recommended";
      reasons.push("官方镜像");
    }
    // Recommended: BioContainers community image
    else if (image.namespace === "biocontainers") {
      verdict = "recommended";
      reasons.push("BioContainers社区镜像");
    }
    // Recommended: high stars and actively maintained
    else if (image.star_count >= 100 && daysSinceUpdate < 180) {
      verdict = "recommended";
      reasons.push("高Stars且活跃维护");
    }
    // Recommended: verified publisher
    else if (image.is_verified && image.star_count >= 50) {
      verdict = "recommended";
      reasons.push("已验证发布者");
    }

    // Additional quality signals
    if (image.pull_count > 1_000_000 && verdict !== "avoid") {
      reasons.push("高下载量");
      if (verdict === "try") verdict = "recommended";
    }

    if (daysSinceUpdate < 30) {
      reasons.push("最近30天内有更新");
    }

    if (daysSinceUpdate > 365 && verdict !== "avoid") {
      reasons.push("超过1年未更新");
      verdict = "try";
    }

    // Not recommended or avoid? Add warning
    if (verdict === "try" && reasons.length === 0) {
      reasons.push("信息不足以判断");
    }

    return { verdict, reasons };
  }

  // ---- Private mappers ----

  private mapToSearchResult(item: DockerHubApiItem): SearchResult {
    return {
      name: `${item.namespace ?? "library"}/${item.name}`,
      namespace: item.namespace ?? "library",
      repository: item.name,
      star_count: item.star_count ?? 0,
      pull_count: item.pull_count ?? 0,
      last_updated: item.last_updated ?? new Date(0).toISOString(),
      short_description: item.description ?? "",
      is_official: item.is_official ?? false,
      is_verified: item.is_verified ?? false,
      architectures: item.architectures ?? [],
      full_size: item.full_size ?? 0,
      tags: [],
    };
  }

  private mapQuayToSearchResult(item: QuayRepoItem): SearchResult {
    return {
      name: `quay.io/${item.namespace ?? "biocontainers"}/${item.name}`,
      namespace: item.namespace ?? "biocontainers",
      repository: item.name,
      star_count: item.star_count ?? 0,
      pull_count: item.pull_count ?? 0,
      last_updated: item.last_modified
        ? new Date(item.last_modified * 1000).toISOString()
        : new Date(0).toISOString(),
      short_description: item.description ?? "",
      is_official: false,
      is_verified: item.is_verified ?? false,
      architectures: item.architectures ?? [],
      full_size: item.full_size ?? 0,
      tags: item.tags ?? [],
    };
  }
}

// ---------------------------------------------------------------------------
// Internal API response types
// ---------------------------------------------------------------------------

interface DockerHubApiItem {
  name: string;
  namespace?: string;
  description?: string;
  star_count?: number;
  pull_count?: number;
  last_updated?: string;
  is_official?: boolean;
  is_verified?: boolean;
  architectures?: string[];
  full_size?: number;
}

interface QuayRepoItem {
  name: string;
  namespace?: string;
  description?: string;
  star_count?: number;
  pull_count?: number;
  last_modified?: number;
  is_verified?: boolean;
  architectures?: string[];
  full_size?: number;
  tags?: string[];
}
