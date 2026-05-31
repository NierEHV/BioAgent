// ============================================================
// @bioagent/ui — API: Initialize Project
// ============================================================
// POST /api/projects/init — ensure a directory has standard
// bioinformatics project structure (raw/, intermediate/,
// output/, checkpoints/, project.yml).

import { NextRequest, NextResponse } from "next/server";
import { ensureProjectDir } from "@bioagent/executor";

export async function POST(req: NextRequest) {
  let body: { path: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body.path || typeof body.path !== "string") {
    return NextResponse.json(
      { error: "Missing required field: path" },
      { status: 400 },
    );
  }

  try {
    const result = ensureProjectDir(body.path);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to initialize project: ${err.message}` },
      { status: 500 },
    );
  }
}
