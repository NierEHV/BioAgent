// ============================================================
// @bioagent/ui — API: Workflow
// ============================================================
// GET  /api/workflow — list available workflows
// POST /api/workflow — start a workflow (real engine)
// Real implementation using @bioagent/workflow + @bioagent/skills.

import { NextRequest, NextResponse } from "next/server";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// In-memory engine store (persists across hot-reload in dev)
// ---------------------------------------------------------------------------

interface RunEntry {
  engine: Awaited<ReturnType<typeof createEngine>>;
  runId: string;
  workflowName: string;
}

declare global {
  var __bioagentWorkflowRuns: Map<string, RunEntry> | undefined;
}

function getRunStore(): Map<string, RunEntry> {
  if (!globalThis.__bioagentWorkflowRuns) {
    globalThis.__bioagentWorkflowRuns = new Map();
  }
  return globalThis.__bioagentWorkflowRuns;
}

async function createEngine() {
  const { WorkflowEngine, WorkflowRegistry, SCRNA_SEQ_STANDARD } =
    await import("@bioagent/workflow");
  const { SkillRegistry, SkillExecutor } = await import("@bioagent/skills");
  const { ContainerManager } = await import("@bioagent/executor");
  const { CheckpointManager } = await import("@bioagent/workflow");

  const registry = new WorkflowRegistry();
  registry.register(SCRNA_SEQ_STANDARD);

  const skillRegistry = new SkillRegistry();
  const cm = new ContainerManager();
  const skillExecutor = new SkillExecutor(skillRegistry, cm);
  const checkpointMgr = new CheckpointManager(
    join(process.cwd(), "..", "..", "data", "projects"),
  );

  return new WorkflowEngine(registry, skillExecutor, checkpointMgr);
}

// ---------------------------------------------------------------------------
// GET — List available workflows
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");

  // Return specific workflow run state
  if (runId) {
    const store = getRunStore();
    const entry = store.get(runId);
    if (!entry) {
      return NextResponse.json(
        { error: "Workflow run not found" },
        { status: 404 },
      );
    }
    try {
      const state = await entry.engine.getState(runId);
      return NextResponse.json(state);
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message },
        { status: 500 },
      );
    }
  }

  // Return list of registered workflows
  try {
    const { WorkflowRegistry, SCRNA_SEQ_STANDARD } =
      await import("@bioagent/workflow");
    const registry = new WorkflowRegistry();
    registry.register(SCRNA_SEQ_STANDARD);

    const all = registry.getAll();
    const workflows = all.map((wf) => ({
      name: wf.name,
      version: wf.version,
      description: wf.description,
      nodes: wf.nodes.map((n) => ({
        id: n.id,
        skill: n.skill,
        dependsOn: n.dependsOn,
      })),
    }));

    return NextResponse.json(workflows);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to list workflows: ${err.message}` },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Start a workflow
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: {
    workflowName?: string;
    projectId?: string;
    dataPath?: string;
    container?: string;
    paramOverrides?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body.workflowName) {
    return NextResponse.json(
      { error: "Missing required field: workflowName" },
      { status: 400 },
    );
  }

  try {
    const engine = await createEngine();
    const projectId = body.projectId || "default";
    const dataPath =
      body.dataPath || join(process.cwd(), "..", "..", "data", "projects", projectId, "data");
    const container = body.container || "bioagent-scrna";

    const runId = await engine.start({
      workflowName: body.workflowName,
      projectId,
      dataPath,
      container,
      paramOverrides: body.paramOverrides,
    });

    // Store for later state queries
    const store = getRunStore();
    store.set(runId, { engine, runId, workflowName: body.workflowName });

    return NextResponse.json({ runId, workflowName: body.workflowName });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to start workflow: ${err.message}` },
      { status: 500 },
    );
  }
}
