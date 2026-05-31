// ============================================================
// @bioagent/agent-core — kb-query Tool
// ============================================================

import { z } from "zod";
import type { KnowledgeBridge } from "@bioagent/knowledge";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

export const kbQueryToolSchema = z.object({
  question: z.string().min(1).max(2000).describe("Natural language question for knowledge retrieval"),
  context: z
    .object({
      omicsType: z.string().optional().describe("Omics data type (e.g. 'scRNA-seq', 'scATAC-seq')"),
      species: z.string().optional().describe("Species (e.g. 'human', 'mouse')"),
      tissue: z.string().optional().describe("Tissue type (e.g. 'lung', 'brain')"),
      currentSkill: z.string().optional().describe("Currently active analysis skill"),
      genesOfInterest: z.array(z.string()).optional().describe("Genes of interest"),
      cellTypes: z.array(z.string()).optional().describe("Cell types of interest"),
    })
    .optional()
    .describe("Context to narrow the knowledge search"),
  layers: z
    .array(z.enum(["vector", "graph", "wiki"]))
    .default(["vector", "graph", "wiki"])
    .describe("Knowledge layers to query"),
  max_results: z.number().int().min(1).max(50).default(5).describe("Maximum results per layer"),
});

export type KbQueryToolParams = z.infer<typeof kbQueryToolSchema>;

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const kbQueryToolDef = {
  name: "kb_query",
  description:
    "Query the three-layer knowledge base (vector DB for literature snippets, graph DB for gene/pathway relationships, wiki for curated documentation). Returns structured results with synthesis and confidence score.",
  schema: kbQueryToolSchema,
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function kbQueryHandler(
  params: KbQueryToolParams,
  knowledgeBridge: KnowledgeBridge,
): Promise<unknown> {
  const result = await knowledgeBridge.query({
    question: params.question,
    context: params.context
      ? {
          omicsType: params.context.omicsType,
          species: params.context.species,
          tissue: params.context.tissue,
          currentSkill: params.context.currentSkill,
          genesOfInterest: params.context.genesOfInterest,
          cellTypes: params.context.cellTypes,
        }
      : undefined,
    layers: params.layers,
    maxResults: params.max_results,
  });

  return {
    synthesis: result.synthesis,
    confidence: result.confidence,
    totalQueryTime: result.totalQueryTime,
    vector: {
      snippetCount: result.vectorResults.snippets.length,
      caseCount: result.vectorResults.similarCases.length,
      snippets: result.vectorResults.snippets.slice(0, params.max_results).map((s) => ({
        text: s.text.slice(0, 300),
        score: s.score,
        collection: s.collection,
        metadata: s.metadata,
      })),
      similarCases: result.vectorResults.similarCases.map((c) => ({
        projectId: c.projectId,
        description: c.description.slice(0, 200),
        omicsType: c.omicsType,
        similarity: c.similarity,
        outcome: c.outcome,
      })),
    },
    graph: {
      entityCount: result.graphResults.entities.length,
      pathCount: result.graphResults.paths.length,
      conflictCount: result.graphResults.conflicts.length,
      entities: result.graphResults.entities.map((e) => ({
        id: e.id,
        type: e.type,
        name: e.name,
      })),
      paths: result.graphResults.paths.map((p) => ({
        nodes: p.nodes,
        length: p.length,
        explanation: p.explanation,
      })),
      conflicts: result.graphResults.conflicts.map((c) => ({
        entity1: c.entity1,
        entity2: c.entity2,
        claim1: c.claim1,
        claim2: c.claim2,
        resolution: c.resolution,
      })),
    },
    wiki: {
      documentCount: result.wikiResults.documents.length,
      documents: result.wikiResults.documents.map((d) => ({
        title: d.title,
        topic: d.topic,
        confidence: d.confidence,
        excerpt: d.excerpt,
        sources: d.sources,
      })),
    },
  };
}
