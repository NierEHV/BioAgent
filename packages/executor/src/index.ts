// ============================================================
// @bioagent/executor — Public API
// ============================================================

// ---------------------------------------------------------------------------
// Container Manager
// ---------------------------------------------------------------------------
export { ContainerManager } from "./container-manager";
export type {
  DockerClientConfig,
  ContainerStopOptions,
  ContainerListFilter,
} from "./container-manager";

export {
  parseMemoryLimit,
  formatBytes,
  calculateCPUPercent,
} from "./container-manager";

// ---------------------------------------------------------------------------
// Image Manager
// ---------------------------------------------------------------------------
export { ImageManager } from "./image-manager";

// ---------------------------------------------------------------------------
// Volume Manager
// ---------------------------------------------------------------------------
export { VolumeManager } from "./volume-manager";

// ---------------------------------------------------------------------------
// Resource Probe
// ---------------------------------------------------------------------------
export { ResourceProbe } from "./resource-probe";

// ---------------------------------------------------------------------------
// Image Search
// ---------------------------------------------------------------------------
export { ImageSearchService, daysAgo } from "./image-search";

// ---------------------------------------------------------------------------
// Docker Executor (high-level API)
// ---------------------------------------------------------------------------
export { DockerExecutor } from "./docker-executor";

// ---------------------------------------------------------------------------
// Types — available from both barrel (types.ts) and individual files
// ---------------------------------------------------------------------------

// Container types (§4.1: container-manager.types.ts)
export type {
  ContainerConfig,
  VolumeMount,
  ExecConfig,
  ExecResult,
  ContainerStatus,
} from "./container-manager.types";

// Image search types (§4.1: image-search.types.ts)
export type {
  PullProgress,
  PullResult,
  ImageInfo,
  SearchParams,
  SearchResult,
} from "./image-search.types";

// Resource probe types (§4.1: resource-probe.types.ts)
export type {
  ResourceReport,
} from "./resource-probe.types";

// Backward-compat barrel re-exports
export type * from "./types";
