// ============================================================
// @bioagent/ui — API: Workflow
// ============================================================
// GET  /api/workflow — list available workflows
// POST /api/workflow — start a workflow

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mock workflow registry
// ---------------------------------------------------------------------------

const mockWorkflows = [
  {
    name: "scrna-seq-standard",
    version: "1.0.0",
    description: "Standard scRNA-seq analysis pipeline: QC → normalization → HVG → PCA → clustering → UMAP → marker detection → annotation",
  },
  {
    name: "scrna-seq-qc-only",
    version: "1.0.0",
    description: "QC-only pipeline: data import → QC filtering → doublet detection",
  },
  {
    name: "scrna-seq-diff-expression",
    version: "1.0.0",
    description: "Differential expression analysis pipeline with functional enrichment",
  },
];

// ---------------------------------------------------------------------------
// Mock workflow runs (in-memory store)
// ---------------------------------------------------------------------------

interface MockWorkflowRun {
  runId: string;
  workflowName: string;
  status: string;
  progress: number;
  currentNodes: string[];
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  startedAt: string;
  completedAt: string | null;
  sessionId: string;
}

const workflowRuns = new Map<string, MockWorkflowRun>();

function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// GET — List available workflows
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");

  // Return specific workflow run state
  if (runId) {
    const run = workflowRuns.get(runId);
    if (!run) {
      return NextResponse.json(
        { error: "Workflow run not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(run);
  }

  // Return list of available workflows
  return NextResponse.json(mockWorkflows);
}

// ---------------------------------------------------------------------------
// POST — Start a workflow
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: {
    sessionId?: string;
    workflowName?: string;
    dataPath?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.sessionId || !body.workflowName || !body.dataPath) {
    return NextResponse.json(
      { error: "Missing required fields: sessionId, workflowName, dataPath" },
      { status: 400 }
    );
  }

  const workflow = mockWorkflows.find(
    (w) => w.name === body.workflowName
  );
  if (!workflow) {
    return NextResponse.json(
      { error: `Workflow "${body.workflowName}" not found` },
      { status: 404 }
    );
  }

  const runId = generateRunId();
  const totalNodes =
    body.workflowName === "scrna-seq-standard"
      ? 9
      : body.workflowName === "scrna-seq-qc-only"
        ? 3
        : 5;

  const run: MockWorkflowRun = {
    runId,
    workflowName: body.workflowName,
    status: "running",
    progress: 0,
    currentNodes: [],
    totalNodes,
    completedNodes: 0,
    failedNodes: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    sessionId: body.sessionId,
  };

  workflowRuns.set(runId, run);

  return NextResponse.json({ runId });
}
