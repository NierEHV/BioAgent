// ============================================================
// @bioagent/agent-core — VizMessage
// ============================================================

/**
 * Visualization message — communicates that a visualization artifact is ready.
 * Supports multiple plot types common in bioinformatics (UMAP, volcano, heatmap, etc.)
 * with both inline base64 and file-path delivery.
 */
export interface VizMessage {
  /** Message type discriminator */
  type: "viz";

  /** Unique message ID */
  id: string;

  /** Session ID */
  sessionId: string;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** The tool or workflow node that generated this visualization */
  source: string;

  /** Plot metadata */
  plot: VizPlot;

  /** Delivery method */
  delivery: VizDelivery;
}

/** Visualization plot metadata */
export interface VizPlot {
  /** Plot title */
  title: string;

  /** Plot type */
  plotType: VizPlotType;

  /** Short description of what the plot shows */
  description: string;

  /** Width in pixels */
  width: number;

  /** Height in pixels */
  height: number;

  /** Image format */
  format: "png" | "svg" | "pdf" | "jpeg" | "webp";

  /** DPI (for raster formats) */
  dpi?: number;

  /** Data source file(s) used to generate the plot */
  dataSource?: string;

  /** Parameters used to generate the plot */
  parameters?: Record<string, unknown>;
}

/** Supported visualization plot types */
export type VizPlotType =
  | "umap"
  | "tsne"
  | "volcano"
  | "heatmap"
  | "dotplot"
  | "violin"
  | "bubble"
  | "bar"
  | "scatter"
  | "line"
  | "pathway_network"
  | "trajectory"
  | "qc_dashboard"
  | "other";

/** Visualization delivery options */
export type VizDelivery =
  | {
      /** Deliver as a file path on disk */
      method: "file";
      /** Absolute path to the image file */
      path: string;
    }
  | {
      /** Deliver as inline base64 data */
      method: "inline";
      /** Base64-encoded image data */
      data: string;
      /** MIME type */
      mimeType: string;
    }
  | {
      /** Deliver as a URL (e.g. from a local server or object storage) */
      method: "url";
      /** Accessible URL */
      url: string;
    };

/**
 * Create a file-based visualization message.
 */
export function createVizFile(
  sessionId: string,
  source: string,
  plot: VizPlot,
  filePath: string,
): VizMessage {
  return {
    type: "viz",
    id: `viz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    timestamp: new Date().toISOString(),
    source,
    plot,
    delivery: { method: "file", path: filePath },
  };
}

/**
 * Create an inline (base64) visualization message.
 */
export function createVizInline(
  sessionId: string,
  source: string,
  plot: VizPlot,
  data: string,
  mimeType: string = "image/png",
): VizMessage {
  return {
    type: "viz",
    id: `viz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    timestamp: new Date().toISOString(),
    source,
    plot,
    delivery: { method: "inline", data, mimeType },
  };
}

/**
 * Create a URL-based visualization message.
 */
export function createVizUrl(
  sessionId: string,
  source: string,
  plot: VizPlot,
  url: string,
): VizMessage {
  return {
    type: "viz",
    id: `viz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    timestamp: new Date().toISOString(),
    source,
    plot,
    delivery: { method: "url", url },
  };
}
