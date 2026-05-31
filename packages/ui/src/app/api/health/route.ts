// ============================================================
// @bioagent/ui — API: Health
// ============================================================
// GET /api/health — health check endpoint

import { NextResponse } from "next/server";

const startTime = Date.now();

export async function GET() {
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  return NextResponse.json(
    {
      status: "healthy",
      version: "0.1.0",
      uptime,
      timestamp: new Date().toISOString(),
      services: {
        agent: "available",
        workflow: "available",
        knowledge: "available",
        executor: "available",
      },
    },
    {
      headers: {
        "Cache-Control": "no-cache",
      },
    }
  );
}
