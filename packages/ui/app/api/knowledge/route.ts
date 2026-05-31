// ============================================================
// @bioagent/ui — API: Knowledge
// ============================================================
// GET /api/knowledge?question= — query the 3-layer knowledge base
// Real implementation using @bioagent/knowledge (WikiLoader).

import { NextRequest, NextResponse } from "next/server";
import { resolve, join } from "node:path";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const question = searchParams.get("question");

  if (!question) {
    return NextResponse.json(
      { error: "Missing question parameter" },
      { status: 400 },
    );
  }

  try {
    // Load wiki from the knowledge package data directory
    const wikiPath = resolve(
      join(process.cwd(), "..", "knowledge", "data", "wiki"),
    );
    const { WikiLoader } = await import("@bioagent/knowledge");
    const loader = new WikiLoader(wikiPath);
    await loader.loadIndex();

    // Search wiki documents
    const docs = loader.search(question);

    if (docs.length === 0) {
      return NextResponse.json({
        answer:
          "No matching documents found. The knowledge base covers: scRNA-seq QC, normalization, clustering, cell annotation, trajectory analysis, cell communication, Scanpy/Seurat guides, biology concepts, and failure case studies.",
        references: [],
        confidence: 0,
        source: "wiki",
      });
    }

    // Format results as references
    const references = docs.slice(0, 8).map((doc) => ({
      title: doc.title || "Untitled",
      snippet: (doc.content || "").slice(0, 300),
      path: doc.path || "",
      type: "wiki" as const,
      relevance: 0.8,
      tags: doc.tags || [],
    }));

    // Build a concise answer from the top result
    const topDoc = docs[0];
    const answer = topDoc.content
      ? topDoc.content.slice(0, 800)
      : `Found ${docs.length} document(s) matching "${question}". See references below.`;

    return NextResponse.json({
      answer,
      references,
      confidence: Math.min(0.7 + docs.length * 0.05, 0.95),
      totalResults: docs.length,
      source: "wiki",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: `Knowledge query failed: ${err.message}`,
        answer: "Knowledge base is temporarily unavailable. Try again later.",
        references: [],
        confidence: 0,
      },
      { status: 500 },
    );
  }
}
