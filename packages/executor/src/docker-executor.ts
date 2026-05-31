// ============================================================
// @bioagent/executor — DockerExecutor (unified entry point)
// ============================================================

import { ContainerManager } from "./container-manager.js";
import { ImageManager } from "./image-manager.js";
import { ImageSearchService } from "./image-search.js";
import { VolumeManager } from "./volume-manager.js";
import { ResourceProbe } from "./resource-probe.js";
import type { ResourceReport, VolumeMount } from "./types.js";

// ---------------------------------------------------------------------------
// DockerExecutor
// ---------------------------------------------------------------------------

export class DockerExecutor {
  readonly containerManager: ContainerManager;
  readonly imageManager: ImageManager;
  readonly imageSearch: ImageSearchService;
  readonly volumeManager: VolumeManager;
  readonly resourceProbe: ResourceProbe;

  constructor(config?: { dockerHost?: string; dataPath?: string }) {
    this.containerManager = new ContainerManager(
      config?.dockerHost ? { host: config.dockerHost } : undefined,
    );
    this.imageManager = new ImageManager();
    this.imageSearch = new ImageSearchService();
    this.volumeManager = new VolumeManager(config?.dataPath || "./data");
    this.resourceProbe = new ResourceProbe();
  }

  /**
   * 健康检查：验证 Docker 是否可用、是否能拉取镜像、推荐镜像状态。
   *
   * @returns 健康检查结果
   */
  async healthCheck(): Promise<{
    dockerAvailable: boolean;
    canPull: boolean;
    recommendedImages: { image: string; status: "cached" | "need_pull" }[];
  }> {
    try {
      // Check Docker daemon reachable
      const info = await this.containerManager.docker.info();

      // Check cached images
      const cachedImages = await this.imageManager.getCachedImages();

      const recommendedImages: {
        image: string;
        status: "cached" | "need_pull";
      }[] = [
        {
          image: "bioagent-scrna:latest",
          status: cachedImages.some((i) => i.includes("bioagent-scrna"))
            ? "cached"
            : "need_pull",
        },
      ];

      return {
        dockerAvailable: true,
        canPull: true,
        recommendedImages,
      };
    } catch {
      return {
        dockerAvailable: false,
        canPull: false,
        recommendedImages: [],
      };
    }
  }

  /**
   * 为 scRNA-seq 分析准备环境。
   *
   * 检查 bioagent-scrna 镜像是否已缓存。
   *
   * @returns 镜像就绪状态
   */
  async prepareForScRNA(): Promise<{
    imageReady: boolean;
    imageName: string;
  }> {
    const imageName = "bioagent-scrna:latest";
    const cached = await this.imageManager.isImageCached(imageName);

    return { imageReady: cached, imageName };
  }

  /**
   * 初始化项目：创建目录结构、配置数据卷。
   *
   * @param projectId - 项目唯一标识
   * @returns 初始化结果
   */
  async initProject(projectId: string): Promise<{
    directoriesReady: boolean;
    volumesConfigured: VolumeMount[];
  }> {
    this.volumeManager.ensureDirectories(projectId);

    return {
      directoriesReady: true,
      volumesConfigured:
        this.volumeManager.createProjectVolumes(projectId),
    };
  }

  /**
   * 宿主机资源探测（完整报告）。
   *
   * @returns 资源探测报告
   */
  async probe(): Promise<ResourceReport> {
    return this.resourceProbe.probe();
  }

  /**
   * 快速资源探测。
   *
   * @returns 快速探测结果
   */
  async probeQuick(): Promise<{
    dockerRunning: boolean;
    availableGB: number;
    gpuAvailable: boolean;
  }> {
    return this.resourceProbe.probeQuick();
  }

  /**
   * 清理：停止所有 bioagent- 容器，可选清理项目中间数据。
   *
   * @param projectId - 可选的项目 ID，传入则清理该项目中间数据
   */
  async cleanup(projectId?: string): Promise<void> {
    await this.containerManager.stopAllBioAgentContainers();

    if (projectId) {
      await this.volumeManager.cleanIntermediate(projectId);
    }
  }

  /**
   * 完整清理：停止容器、清理中间数据、移除项目目录。
   *
   * @param projectId - 项目唯一标识
   */
  async fullCleanup(projectId: string): Promise<void> {
    await this.containerManager.stopAllBioAgentContainers();
    await this.volumeManager.cleanIntermediate(projectId);
    this.volumeManager.removeProject(projectId);
  }
}
