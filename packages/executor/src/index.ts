// ============================================================
// @bioagent/executor — Public API
// ============================================================

// ---------------------------------------------------------------------------
// Container Manager
// ---------------------------------------------------------------------------
export { ContainerManager } from "./container-manager.js";
export type {
  DockerClientConfig,
  ContainerStopOptions,
  ContainerListFilter,
} from "./container-manager.js";

export {
  parseMemoryLimit,
  formatBytes,
  calculateCPUPercent,
} from "./container-manager.js";

// ---------------------------------------------------------------------------
// Image Manager
// ---------------------------------------------------------------------------
export { ImageManager } from "./image-manager.js";

// ---------------------------------------------------------------------------
// Volume Manager
// ---------------------------------------------------------------------------
export { VolumeManager } from "./volume-manager.js";

// ---------------------------------------------------------------------------
// Resource Probe
// ---------------------------------------------------------------------------
export { ResourceProbe } from "./resource-probe.js";

// ---------------------------------------------------------------------------
// Image Search
// ---------------------------------------------------------------------------
export { ImageSearchService, daysAgo } from "./image-search.js";

// ---------------------------------------------------------------------------
// Docker Executor (high-level API)
// ---------------------------------------------------------------------------
export { DockerExecutor } from "./docker-executor.js";

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
} from "./container-manager.types.js";

// Image search types (§4.1: image-search.types.ts)
export type {
  PullProgress,
  PullResult,
  ImageInfo,
  SearchParams,
  SearchResult,
} from "./image-search.types.js";

// Resource probe types (§4.1: resource-probe.types.ts)
export type {
  ResourceReport,
} from "./resource-probe.types.js";

// Backward-compat barrel re-exports
export type * from "./types.js";
