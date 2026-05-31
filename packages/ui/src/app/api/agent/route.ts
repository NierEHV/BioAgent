// ============================================================
// @bioagent/ui — API: Agent (Message + SSE)
// ============================================================
// POST /api/agent — send a message and receive SSE stream
// GET  /api/agent?sessionId= — establish SSE connection

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mock thinking sections
// ---------------------------------------------------------------------------

const mockThinkingSections = [
  { index: 1, title: "Scientific Question Reduction", content: "The user is asking about scRNA-seq quality control. The core biological question is to assess data quality before downstream analysis." },
  { index: 2, title: "Data Assessment & Exploration", content: "The input data is an h5ad file with 3,500 cells and 20,000 genes. The data appears to be from 10x Genomics platform." },
  { index: 3, title: "Analysis Path Design", content: "Standard scRNA-seq QC pipeline: filtering low-quality cells, doublet detection, and normalization." },
  { index: 4, title: "Risk Identification", content: "Risks identified: over-filtering may remove biologically relevant cells. Mitigation: use adaptive thresholds." },
  { index: 5, title: "Cross-Validation Logic", content: "QC metrics will be cross-referenced against known scRNA-seq QC benchmarks from the knowledge base." },
  { index: 6, title: "Output Structure Design", content: "Output: filtered h5ad file, QC report with per-metric statistics, and visualization of QC metrics." },
  { index: 7, title: "Execution & Monitoring Plan", content: "Workflow: scrna-qc node. Monitoring: track cell count, gene count, mitochondrial fraction distributions." },
];

// ---------------------------------------------------------------------------
// GET — SSE connection for receiving events
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing sessionId query parameter" },
      { status: 400 }
    );
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: message:start\ndata: {"sessionId":"${sessionId}"}\n\n`)
      );

      // Simulate sending thinking events with delays
      let sectionIdx = 0;

      function sendNextSection() {
        if (closed || sectionIdx >= mockThinkingSections.length) {
          if (!closed) {
            controller.enqueue(
              encoder.encode(
                `event: thinking:completed\ndata: {"totalSections":${mockThinkingSections.length}}\n\n`
              )
            );
            controller.enqueue(
              encoder.encode(
                `event: message:end\ndata: {"sessionId":"${sessionId}"}\n\n`
              )
            );
            controller.close();
          }
          return;
        }

        const section = mockThinkingSections[sectionIdx];

        // Send thinking:started for first section
        if (sectionIdx === 0) {
          controller.enqueue(
            encoder.encode(
              `event: thinking:started\ndata: {"totalSections":${mockThinkingSections.length}}\n\n`
            )
          );
        }

        // Send thinking:section
        controller.enqueue(
          encoder.encode(
            `event: thinking:section\ndata: ${JSON.stringify(section)}\n\n`
          )
        );

        // Send a message chunk
        controller.enqueue(
          encoder.encode(
            `event: message:chunk\ndata: {"content":"Processing step ${section.index}: ${section.title}...","index":${section.index}}\n\n`
          )
        );

        sectionIdx++;
        setTimeout(sendNextSection, 500 + Math.random() * 1000);
      }

      setTimeout(sendNextSection, 300);

      // Heartbeat
      const heartbeat = setInterval(() => {
        if (!closed) {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }
      }, 15000);

      // Cleanup on close
      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
      });
    },
    cancel() {
      closed = true;
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ---------------------------------------------------------------------------
// POST — Send a message (returns SSE stream)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Accept both JSON and FormData
  const contentType = req.headers.get("content-type") || "";

  let sessionId: string | null = null;
  let message: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    sessionId = formData.get("sessionId") as string;
    message = formData.get("message") as string;
  } else {
    try {
      const body = await req.json();
      sessionId = body.sessionId;
      message = body.message;
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
  }

  if (!sessionId || !message) {
    return NextResponse.json(
      { error: "Missing sessionId or message" },
      { status: 400 }
    );
  }

  // Reuse the GET SSE logic
  const url = new URL(req.url);
  url.searchParams.set("sessionId", sessionId);
  return GET(new NextRequest(url, { signal: req.signal }));
}
