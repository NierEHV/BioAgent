// ============================================================
// @bioagent/ui — API: Resources
// ============================================================
// GET /api/resources — real host machine resource status
// Uses @bioagent/executor ResourceProbe for actual metrics.

import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  try {
    const { ResourceProbe } = await import("@bioagent/executor");

    const probe = new ResourceProbe();
    const report = await probe.probe();

    // Transform ResourceReport to frontend-friendly format
    const resources = {
      cpu: {
        usage: 0, // ResourceReport doesn't have real-time usage (that needs polling)
        cores: report.cpu.cores,
        threads: report.cpu.threads,
        model: report.cpu.model,
      },
      memory: {
        totalBytes: report.memory.total_gb * 1024 * 1024 * 1024,
        availableBytes: report.memory.available_gb * 1024 * 1024 * 1024,
        total_gb: report.memory.total_gb,
        available_gb: report.memory.available_gb,
      },
      disk: {
        volumes: report.disk.volumes.map((v) => ({
          mount: v.mount,
          total_gb: v.total_gb,
          available_gb: v.available_gb,
          type: v.type,
        })),
      },
      docker: {
        installed: report.docker.installed,
        version: report.docker.version,
        running: report.docker.running,
        compose_available: report.docker.compose_available,
        images_cached: report.docker.images_cached,
      },
      gpu: {
        available: report.gpu.available,
        models: report.gpu.models,
        cuda_version: report.gpu.cuda_version,
      },
      hostname: report.hostname,
      platform: report.os.platform,
      network: report.network,
    };

    return NextResponse.json(resources, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: any) {
    // Fallback: return basic info even if probe fails
    return NextResponse.json(
      {
        error: `Resource probe failed: ${err.message}`,
        cpu: { cores: 1 },
        memory: { total_gb: 0, available_gb: 0 },
        docker: { installed: false, running: false },
        hostname: "unknown",
        platform: process.platform,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-cache",
          "X-Resource-Probe-Error": err.message,
        },
      },
    );
  }
}
