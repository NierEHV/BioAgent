// ============================================================
// @bioagent/ui — API: Resources
// ============================================================
// GET /api/resources — get host machine resource status

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mock resource reader
// ---------------------------------------------------------------------------

let startTime = Date.now();

function getMockResources() {
  const elapsed = (Date.now() - startTime) / 1000;

  // Simulate fluctuating usage
  const cpuUsage = 25 + Math.sin(elapsed * 0.5) * 10 + Math.random() * 5;
  const memUsed = 8589934592 + Math.sin(elapsed * 0.2) * 2147483648;
  const diskUsed = 53687091200 + elapsed * 1048576; // slowly grows

  return {
    cpu: {
      usage: Math.round(cpuUsage * 10) / 10,
      cores: 16,
    },
    memory: {
      usedBytes: Math.round(memUsed),
      totalBytes: 34359738368, // 32 GB
      usagePercent: Math.round((memUsed / 34359738368) * 1000) / 10,
    },
    disk: {
      usedBytes: Math.round(diskUsed),
      totalBytes: 214748364800, // 200 GB
      usagePercent: Math.round((Math.round(diskUsed) / 214748364800) * 1000) / 10,
    },
    containers: {
      running: 3,
      total: 5,
    },
    hostname: process.env.HOSTNAME || "bioagent-workstation",
  };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  const resources = getMockResources();

  return NextResponse.json(resources, {
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
