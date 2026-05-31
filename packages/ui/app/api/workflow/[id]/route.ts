// ============================================================
// @bioagent/ui — API: Workflow [id]
// ============================================================
// GET  /api/workflow/[id] — get workflow run state
// POST /api/workflow/[id] — pause/resume/abort

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// In-memory workflow state store (shared with ../route.ts via module scope)
// ---------------------------------------------------------------------------

// We maintain a shared store accessible across route modules
const workflowRuns = (globalThis as Record<string, unknown>).__workflowRuns as
  | Map<string, MockWorkflowRun>
  | undefined;

interface MockWorkflowRun {
  runId: string;
  workflowName: string;
  status: "running" | "paused" | "completed" | "failed" | "aborted";
  progress: number;
  currentNodes: string[];
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  skippedNodes: number;
  startedAt: string;
  completedAt: string | null;
  sessionId: string;
  abortReason?: string;
}

// Initialize global store if not exists
const store = workflowRuns || new Map<string, MockWorkflowRun>();
if (!(globalThis as Record<string, unknown>).__workflowRuns) {
  (globalThis as Record<string, unknown>).__workflowRuns = store;
}

// ---------------------------------------------------------------------------
// GET — Get workflow run state
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = store.get(id);

  if (!run) {
    return NextResponse.json(
      { error: "Workflow run not found" },
      { status: 404 }
    );
  }

  // Simulate progress for running workflows
  if (run.status === "running" && run.progress < 1) {
    run.progress = Math.min(
      run.progress + Math.random() * 0.05,
      0.99
    );
    run.completedNodes = Math.floor(run.progress * run.totalNodes);
  }

  return NextResponse.json(run);
}

// ---------------------------------------------------------------------------
// POST — Control workflow (pause / resume / abort)
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = store.get(id);

  if (!run) {
    return NextResponse.json(
      { error: "Workflow run not found" },
      { status: 404 }
    );
  }

  let body: {
    action?: string;
    decisions?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  switch (body.action) {
    case "pause":
      if (run.status !== "running") {
        return NextResponse.json(
          { error: "Can only pause a running workflow" },
          { status: 409 }
        );
      }
      run.status = "paused";
      return NextResponse.json({
        success: true,
        status: "paused",
        runId: id,
      });

    case "resume":
      if (run.status !== "paused") {
        return NextResponse.json(
          { error: "Can only resume a paused workflow" },
          { status: 409 }
        );
      }
      run.status = "running";
      return NextResponse.json({
        success: true,
        status: "running",
        runId: id,
      });

    case "abort":
      if (run.status === "completed" || run.status === "aborted") {
        return NextResponse.json(
          { error: "Workflow already terminated" },
          { status: 409 }
        );
      }
      run.status = "aborted";
      run.abortReason = "User requested abort";
      run.completedAt = new Date().toISOString();
      return NextResponse.json({
        success: true,
        status: "aborted",
        runId: id,
      });

    default:
      return NextResponse.json(
        { error: `Unknown action: ${body.action}. Use pause, resume, or abort.` },
        { status: 400 }
      );
  }
}
