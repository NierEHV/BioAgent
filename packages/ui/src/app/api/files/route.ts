// ============================================================
// @bioagent/ui — API: Files
// ============================================================
// POST   /api/files — upload a file
// GET    /api/files?projectId= — list files for a project
// GET    /api/files?path= — inspect a file
// GET    /api/files?download=1&path= — download a file
// GET    /api/files?viz=1&path= — get visualization
// GET    /api/files?list=visualizations&sessionId= — list visualizations
// DELETE /api/files?path= — delete a file

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mock file store
// ---------------------------------------------------------------------------

interface MockFile {
  path: string;
  name: string;
  format: string;
  sizeBytes: number;
  modifiedAt: string;
  projectId: string;
}

const fileStore = new Map<string, MockFile>();

// Seed some mock files
function seedFiles(projectId: string) {
  const basePath = `/data/${projectId}`;
  const files: MockFile[] = [
    { path: `${basePath}/raw_counts.h5ad`, name: "raw_counts.h5ad", format: "h5ad", sizeBytes: 524288000, modifiedAt: new Date().toISOString(), projectId },
    { path: `${basePath}/metadata.csv`, name: "metadata.csv", format: "csv", sizeBytes: 12480, modifiedAt: new Date().toISOString(), projectId },
    { path: `${basePath}/qc_report.html`, name: "qc_report.html", format: "html", sizeBytes: 245000, modifiedAt: new Date().toISOString(), projectId },
    { path: `${basePath}/normalized.h5ad`, name: "normalized.h5ad", format: "h5ad", sizeBytes: 480000000, modifiedAt: new Date().toISOString(), projectId },
    { path: `${basePath}/umap_plot.png`, name: "umap_plot.png", format: "png", sizeBytes: 320000, modifiedAt: new Date().toISOString(), projectId },
    { path: `${basePath}/marker_genes.csv`, name: "marker_genes.csv", format: "csv", sizeBytes: 8500, modifiedAt: new Date().toISOString(), projectId },
  ];
  for (const f of files) {
    if (!fileStore.has(f.path)) {
      fileStore.set(f.path, f);
    }
  }
}

// ---------------------------------------------------------------------------
// GET — List, inspect, download, or get visualizations
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const path = searchParams.get("path");
  const download = searchParams.get("download");
  const viz = searchParams.get("viz");
  const listViz = searchParams.get("list");
  const sessionId = searchParams.get("sessionId");

  // List visualizations
  if (listViz === "visualizations" && sessionId) {
    const visualizations = [
      {
        type: "umap",
        url: "/api/files?viz=1&path=/data/demo/umap_plot.png",
        metadata: { cells: 3500, perplexity: 30, n_neighbors: 15 },
      },
      {
        type: "volcano",
        url: "/api/files?viz=1&path=/data/demo/volcano_plot.png",
        metadata: { log2fc_threshold: 1.0, pval_threshold: 0.05 },
      },
      {
        type: "heatmap",
        url: "/api/files?viz=1&path=/data/demo/heatmap.png",
        metadata: { genes: 50, clusters: 8 },
      },
      {
        type: "dotplot",
        url: "/api/files?viz=1&path=/data/demo/dotplot.png",
        metadata: { genes: 20, clusters: 8 },
      },
      {
        type: "violin",
        url: "/api/files?viz=1&path=/data/demo/violin_plot.png",
        metadata: { genes: 12, clusters: 8 },
      },
    ];
    return NextResponse.json(visualizations);
  }

  // Get visualization image
  if (viz === "1" && path) {
    // Return a simple SVG placeholder
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
      <rect width="600" height="400" fill="#f8fafc" rx="8"/>
      <text x="300" y="180" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#64748b">Visualization Placeholder</text>
      <text x="300" y="210" text-anchor="middle" font-family="monospace" font-size="12" fill="#94a3b8">${path}</text>
      <circle cx="150" cy="320" r="8" fill="#6366f1"/><circle cx="300" cy="280" r="12" fill="#818cf8"/>
      <circle cx="450" cy="310" r="10" fill="#a5b4fc"/><circle cx="200" cy="260" r="6" fill="#c7d2fe"/>
      <circle cx="400" cy="250" r="7" fill="#6366f1"/><circle cx="100" cy="290" r="9" fill="#818cf8"/>
      <circle cx="500" cy="270" r="5" fill="#a5b4fc"/>
    </svg>`;
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // Download file
  if (download === "1" && path) {
    const file = fileStore.get(path);
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return new NextResponse(
      `Mock file content for: ${file.name}\nFormat: ${file.format}\nSize: ${file.sizeBytes} bytes\n`,
      {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${file.name}"`,
        },
      }
    );
  }

  // Inspect a file
  if (path) {
    const file = fileStore.get(path);
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return NextResponse.json({
      path: file.path,
      format: file.format,
      shape: { rows: 3500, cols: 20000 },
      columns: [
        "barcode",
        "n_genes_by_counts",
        "total_counts",
        "pct_counts_mt",
        "n_counts",
        "cell_type",
        "condition",
      ],
      sampleRows: [
        {
          barcode: "AAACCCAAGAAACTCA-1",
          n_genes_by_counts: 2500,
          total_counts: 15000,
          pct_counts_mt: 3.2,
          n_counts: 15000.0,
          cell_type: "T cell",
          condition: "treated",
        },
        {
          barcode: "AAACCCAGTCGTTAGA-1",
          n_genes_by_counts: 3200,
          total_counts: 18000,
          pct_counts_mt: 2.1,
          n_counts: 18000.0,
          cell_type: "B cell",
          condition: "control",
        },
        {
          barcode: "AAACGAAGATCGATCA-1",
          n_genes_by_counts: 1800,
          total_counts: 9000,
          pct_counts_mt: 8.5,
          n_counts: 9000.0,
          cell_type: "Monocyte",
          condition: "treated",
        },
      ],
      metadata: {
        platform: "10x Genomics",
        chemistry: "3' v3",
        genome: "GRCh38",
        total_cells: 3500,
        total_genes: 20000,
      },
    });
  }

  // List files for a project
  if (projectId) {
    seedFiles(projectId);
    const files = Array.from(fileStore.values()).filter(
      (f) => f.projectId === projectId
    );
    return NextResponse.json(files);
  }

  return NextResponse.json(
    { error: "Missing projectId, path, download, or viz parameter" },
    { status: 400 }
  );
}

// ---------------------------------------------------------------------------
// POST — Upload a file
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let projectId: string | null = null;
  let fileName = "uploaded_file";
  let fileSize = 0;

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    projectId = formData.get("projectId") as string;
    const file = formData.get("file") as File | null;
    if (file) {
      fileName = file.name;
      fileSize = file.size;
    }
  } else {
    return NextResponse.json(
      { error: "File upload requires multipart/form-data" },
      { status: 400 }
    );
  }

  if (!projectId) {
    return NextResponse.json(
      { error: "Missing projectId" },
      { status: 400 }
    );
  }

  const path = `/data/${projectId}/${fileName}`;
  const mockFile: MockFile = {
    path,
    name: fileName,
    format: fileName.split(".").pop() || "unknown",
    sizeBytes: fileSize,
    modifiedAt: new Date().toISOString(),
    projectId,
  };

  fileStore.set(path, mockFile);

  return NextResponse.json({ path });
}

// ---------------------------------------------------------------------------
// DELETE — Delete a file
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json(
      { error: "Missing path parameter" },
      { status: 400 }
    );
  }

  if (!fileStore.has(path)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  fileStore.delete(path);

  return NextResponse.json({ success: true });
}
