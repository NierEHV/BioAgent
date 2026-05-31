// ============================================================
// @bioagent/ui — API: Workflow [id]
// ============================================================
// GET  /api/workflow/[id] — get workflow run state
// POST /api/workflow/[id] — pause / resume / abort
// Real implementation using @bioagent/workflow engine.

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Shared store accessor
// ---------------------------------------------------------------------------

interface RunEntry {
  engine: { getState(runId: string): Promise<any>; pause(runId: string): Promise<void>; resume(runId: string): Promise<void>; abort(runId: string, reason?: string): Promise<void> };
  runId: string;
  workflowName: string;
}

function getRunStore(): Map<string, RunEntry> {
  if (!(globalThis as any).__bioagentWorkflowRuns) {
    (globalThis as any).__bioagentWorkflowRuns = new Map();
  }
  return (globalThis as any).__bioagentWorkflowRuns;
}

// ---------------------------------------------------------------------------
// GET — Get workflow run state
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const store = getRunStore();
  const entry = store.get(id);

  if (!entry) {
    return NextResponse.json(
      { error: "Workflow run not found" },
      { status: 404 },
    );
  }

  try {
    const state = await entry.engine.getState(id);
    return NextResponse.json(state);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to get state: ${err.message}` },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Control workflow (pause / resume / abort)
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const store = getRunStore();
  const entry = store.get(id);

  if (!entry) {
    return NextResponse.json(
      { error: "Workflow run not found" },
      { status: 404 },
    );
  }

  let body: { action?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  try {
    switch (body.action) {
      case "pause":
        await entry.engine.pause(id);
        return NextResponse.json({ success: true, status: "paused", runId: id });

      case "resume":
        await entry.engine.resume(id);
        return NextResponse.json({ success: true, status: "running", runId: id });

      case "abort":
        await entry.engine.abort(id, body.reason || "User requested abort");
        return NextResponse.json({ success: true, status: "aborted", runId: id });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${body.action}. Use pause, resume, or abort.` },
          { status: 400 },
        );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to ${body.action}: ${err.message}` },
      { status: 500 },
    );
  }
}
