// ============================================================
// @bioagent/ui — API: Sessions
// ============================================================
// GET  /api/agent/sessions?projectId= — list sessions
// POST /api/agent/sessions — create session
// DELETE /api/agent/sessions?sessionId= — delete session

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mock data store (in-memory, resets on dev server restart)
// ---------------------------------------------------------------------------

interface MockSession {
  sessionId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "compressed" | "completed";
  messageCount: number;
  description: string;
}

const sessionsMap = new Map<string, MockSession>();

function generateId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// GET — List sessions for a project
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "Missing projectId query parameter" },
      { status: 400 }
    );
  }

  const sessions = Array.from(sessionsMap.values()).filter(
    (s) => s.projectId === projectId
  );

  return NextResponse.json(sessions);
}

// ---------------------------------------------------------------------------
// POST — Create a new session
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: { projectId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.projectId) {
    return NextResponse.json(
      { error: "Missing projectId in request body" },
      { status: 400 }
    );
  }

  const sessionId = generateId();
  const now = new Date().toISOString();

  const session: MockSession = {
    sessionId,
    projectId: body.projectId,
    createdAt: now,
    updatedAt: now,
    status: "active",
    messageCount: 0,
    description: `Session for project ${body.projectId}`,
  };

  sessionsMap.set(sessionId, session);

  return NextResponse.json({ sessionId });
}

// ---------------------------------------------------------------------------
// DELETE — Delete a session
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing sessionId query parameter" },
      { status: 400 }
    );
  }

  if (!sessionsMap.has(sessionId)) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  sessionsMap.delete(sessionId);

  return NextResponse.json({ success: true });
}
