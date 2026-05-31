// ============================================================
// @bioagent/knowledge — Knowledge Bridge (Three-Layer Unified Query)
// ============================================================

import { ChromaClientWrapper } from "./vector-db/chroma-client";
import { KuzuClient } from "./graph-db/kuzu-client";
import { WikiLoader } from "./wiki/wiki-loader";
import {
  type KnowledgeBridgeConfig,
  type KnowledgeQuery,
  type KnowledgeResult,
  type VectorSnippet,
  type SimilarCase,
  type GraphEntity,
  type GraphPath,
  type KnowledgeConflict,
  type WikiDocument,
} from "./bridge.types";
import { COLLECTIONS } from "./vector-db/collections";
import { getLogger } from "./logger";

const logger = getLogger("bridge");

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: KnowledgeBridgeConfig = {
  chromaUrl: "http://localhost:8000",
  kuzuDbPath: "./data/kuzu",
  wikiPath: "./data/wiki",
  embeddingModel: "text-embedding-3-small",
  embeddingDim: 1024,
  maxResultsPerLayer: 5,
  similarityThreshold: 0.7,
};

// ---------------------------------------------------------------------------
// KnowledgeBridge
// ---------------------------------------------------------------------------

export class KnowledgeBridge {
  private chroma: ChromaClientWrapper;
  private kuzu: KuzuClient;
  private wikiLoader: WikiLoader;
  private config: KnowledgeBridgeConfig;

  constructor(config: Partial<KnowledgeBridgeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.chroma = new ChromaClientWrapper({ url: this.config.chromaUrl });
    this.kuzu = new KuzuClient({ dbPath: this.config.kuzuDbPath });
    this.wikiLoader = new WikiLoader(this.config.wikiPath ?? "./data/wiki");
  }

  /** Initialise all three layers. */
  async initialize(): Promise<void> {
    logger.info("Initialising Knowledge Bridge...");
    await Promise.all([
      this.chroma.initialize(),
      this.kuzu.initialize(),
      this.wikiLoader.loadIndex(),
    ]);
    logger.info("Knowledge Bridge initialised");
  }

  /** Close graph DB connection. */
  async close(): Promise<void> {
    await this.kuzu.close();
    logger.info("Knowledge Bridge closed");
  }

  // -----------------------------------------------------------------------
  // Main unified query entry point
  // -----------------------------------------------------------------------

  async query(q: KnowledgeQuery): Promise<KnowledgeResult> {
    const startTime = Date.now();
    const layers = q.layers ?? ["vector", "graph", "wiki"];
    const maxResults = q.maxResults ?? this.config.maxResultsPerLayer;

    // 1. Parallel query across layers
    const [vectorResults, graphResults, wikiResults] = await Promise.all([
      layers.includes("vector") ? this.queryVector(q.question, q.context, maxResults) : null,
      layers.includes("graph") ? this.queryGraph(q.question, q.context) : null,
      layers.includes("wiki") ? this.queryWiki(q.question, q.context, maxResults) : null,
    ]);

    // 2. Graph inference: extract entities from vector results → traverse graph
    let graphPaths: GraphPath[] = [];
    if (graphResults && q.context?.genesOfInterest) {
      for (const gene of q.context.genesOfInterest) {
        try {
          const hops = await this.kuzu.findMultiHopPaths(gene, "Gene", "Pathway", 2);
          for (const p of hops) {
            graphPaths.push({ ...p, confidence: 0.7 });
          }
        } catch {
          // skip failures for individual gene lookups
        }
      }
    }

    // 3. Conflict detection
    let conflicts: KnowledgeConflict[] = [];
    if (graphResults) {
      // Check vector snippets against graph for contradictions
      const snippetEntities = this.extractEntities(q.question);
      for (const entity of snippetEntities) {
        try {
          const c = await this.kuzu.detectConflicts({
            entity,
            relation: "UPREGULATED_IN",
            target: entity,
          });
          conflicts.push(...c);
        } catch {
          // skip
        }
      }
    }

    // 4. Synthesis — assemble a natural-language summary
    const synthesis = this.buildSynthesis(vectorResults, graphResults, wikiResults);

    // 5. Confidence calculation
    const confidence = this.computeConfidence(vectorResults, graphResults, wikiResults);

    const totalQueryTime = Date.now() - startTime;

    return {
      vectorResults: vectorResults ?? { snippets: [], similarCases: [], queryTime: 0 },
      graphResults: graphResults ?? {
        entities: [],
        paths: graphPaths,
        conflicts,
        queryTime: 0,
      },
      wikiResults: wikiResults ?? { documents: [], excerpts: [], queryTime: 0 },
      synthesis,
      confidence,
      totalQueryTime,
    };
  }

  // -----------------------------------------------------------------------
  // Layer-specific queries
  // -----------------------------------------------------------------------

  async queryVector(
    question: string,
    context?: KnowledgeQuery["context"],
    maxResults?: number,
  ): Promise<KnowledgeResult["vectorResults"]> {
    const start = Date.now();
    const n = maxResults ?? this.config.maxResultsPerLayer;
    const snippets: VectorSnippet[] = [];
    const similarCases: SimilarCase[] = [];

    // Build filter from context
    const where: Record<string, unknown> = {};
    if (context?.omicsType) where.omics_type = context.omicsType;
    if (context?.tissue) where.tissue = context.tissue;

    try {
      // Query literature snippets
      const litResult = await this.chroma.query(
        "literature_snippets",
        question,
        {
          nResults: n,
          where,
          minScore: this.config.similarityThreshold,
        },
      );

      for (let i = 0; i < litResult.ids.length; i++) {
        const md = litResult.metadatas[i] ?? {};
        snippets.push({
          text: litResult.documents[i] ?? "",
          metadata: {
            doi: typeof md.doi === "string" ? md.doi : undefined,
            url: typeof md.url === "string" ? md.url : undefined,
            title: typeof md.title === "string" ? md.title : undefined,
            topic: typeof md.topic === "string" ? md.topic : undefined,
            year: typeof md.year === "number" ? md.year : undefined,
          },
          score: 1 - (litResult.distances[i] ?? 0),
          collection: "literature_snippets",
        });
      }

      // Query analysis cases
      const caseResult = await this.chroma.query(
        "analysis_cases",
        question,
        {
          nResults: n,
          where,
          minScore: this.config.similarityThreshold,
        },
      );

      for (let i = 0; i < caseResult.ids.length; i++) {
        const md = caseResult.metadatas[i] ?? {};
        similarCases.push({
          projectId: String(md.project_id ?? caseResult.ids[i]),
          description: caseResult.documents[i] ?? "",
          omicsType: String(md.omics_type ?? "unknown"),
          tissue: typeof md.tissue === "string" ? md.tissue : undefined,
          similarity: 1 - (caseResult.distances[i] ?? 0),
          outcome: String(md.workflow_used ?? "unknown"),
        });
      }
    } catch (err) {
      logger.warn({ err }, "Vector query degraded — returning empty results");
    }

    return { snippets, similarCases, queryTime: Date.now() - start };
  }

  async queryGraph(
    question: string,
    context?: KnowledgeQuery["context"],
  ): Promise<KnowledgeResult["graphResults"]> {
    const start = Date.now();
    const entities: GraphEntity[] = [];
    const paths: GraphPath[] = [];
    const conflicts: KnowledgeConflict[] = [];

    try {
      // Extract potential gene names from question and context
      const genes = context?.genesOfInterest ?? [];
      const cellTypes = context?.cellTypes ?? [];

      for (const gene of genes) {
        try {
          const rows = await this.kuzu.query(
            "MATCH (g:Gene {symbol: $symbol}) RETURN g",
            { symbol: gene },
          );
          for (const row of rows) {
            const g = row["g"] as Record<string, unknown>;
            entities.push({
              id: String(g.symbol ?? gene),
              type: "Gene",
              name: String(g.symbol ?? gene),
              properties: g,
            });
          }
          // Also get pathways for each gene
          const pRows = await this.kuzu.getGenePathways(gene);
          for (const pRow of pRows) {
            const p = pRow["p"] as Record<string, unknown>;
            entities.push({
              id: String(p.id ?? "?"),
              type: "Pathway",
              name: String(p.name ?? p.id ?? "?"),
              properties: p,
            });
          }
        } catch {
          // skip
        }
      }

      for (const ct of cellTypes) {
        try {
          const rows = await this.kuzu.getCellTypeMarkers(ct);
          for (const row of rows) {
            const g = row["g"] as Record<string, unknown>;
            entities.push({
              id: String(g.symbol ?? "?"),
              type: "Gene",
              name: String(g.symbol ?? "?"),
              properties: g,
            });
          }
        } catch {
          // skip
        }
      }
    } catch (err) {
      logger.warn({ err }, "Graph query degraded");
    }

    return { entities, paths, conflicts, queryTime: Date.now() - start };
  }

  async queryWiki(
    question: string,
    _context?: KnowledgeQuery["context"],
    maxResults?: number,
  ): Promise<KnowledgeResult["wikiResults"]> {
    const start = Date.now();
    const n = maxResults ?? this.config.maxResultsPerLayer;

    try {
      const docs = this.wikiLoader.search(question);
      const sliced = docs.slice(0, n);

      const wikiDocs: WikiDocument[] = sliced.map((d) => ({
        title: d.title,
        topic: d.topic,
        path: d.path,
        confidence: d.confidence,
        version: d.version,
        updated: d.updated,
        sources: d.sources,
        tags: d.tags,
        excerpt: d.excerpt,
      }));

      const excerpts = sliced.map((d) => d.excerpt);

      return { documents: wikiDocs, excerpts, queryTime: Date.now() - start };
    } catch (err) {
      logger.warn({ err }, "Wiki query degraded");
      return { documents: [], excerpts: [], queryTime: Date.now() - start };
    }
  }

  // -----------------------------------------------------------------------
  // Ingestion
  // -----------------------------------------------------------------------

  async embed(text: string): Promise<number[]> {
    // If an external embedding function is configured on the chroma client,
    // it is used; otherwise fall back to a simple hash-based placeholder.
    // Note: real embedding would require an embedding API.
    return this.hashEmbed(text, this.config.embeddingDim ?? 1024);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /** Extract capitalised gene-name-like tokens from a question. */
  private extractEntities(question: string): string[] {
    const genePattern = /\b[A-Z][A-Z0-9]{1,8}\b/g;
    const matches = question.match(genePattern) ?? [];
    return [...new Set(matches)];
  }

  /** Build a human-readable synthesis from the three layers. */
  private buildSynthesis(
    vectorResults: KnowledgeResult["vectorResults"] | null,
    graphResults: KnowledgeResult["graphResults"] | null,
    wikiResults: KnowledgeResult["wikiResults"] | null,
  ): string {
    const parts: string[] = [];

    if (vectorResults?.snippets?.length) {
      parts.push(
        `Found ${vectorResults.snippets.length} relevant literature snippets. ` +
          (vectorResults.similarCases?.length
            ? `Also found ${vectorResults.similarCases.length} similar analysis cases.`
            : ""),
      );
    }

    if (graphResults?.entities?.length) {
      const geneEntities = graphResults.entities.filter((e) => e.type === "Gene");
      const pathwayEntities = graphResults.entities.filter((e) => e.type === "Pathway");
      if (geneEntities.length || pathwayEntities.length) {
        parts.push(
          `Knowledge graph contains ${geneEntities.length} genes and ${pathwayEntities.length} pathways related to the query.`,
        );
      }
    }

    if (wikiResults?.documents?.length) {
      const topics = wikiResults.documents.map((d) => d.topic).join(", ");
      parts.push(`Relevant wiki topics: ${topics}.`);
    }

    if (graphResults?.conflicts?.length) {
      parts.push(
        `Warning: ${graphResults.conflicts.length} potential knowledge conflicts detected.`,
      );
    }

    if (parts.length === 0) {
      return "No relevant knowledge found across the three layers.";
    }

    return parts.join(" ");
  }

  /** Compute an aggregate confidence score (0-1). */
  private computeConfidence(
    vectorResults: KnowledgeResult["vectorResults"] | null,
    graphResults: KnowledgeResult["graphResults"] | null,
    wikiResults: KnowledgeResult["wikiResults"] | null,
  ): number {
    const scores: number[] = [];

    // Vector confidence: average snippet score, capped
    if (vectorResults?.snippets?.length) {
      const avgScore =
        vectorResults.snippets.reduce((sum, s) => sum + s.score, 0) /
        vectorResults.snippets.length;
      scores.push(avgScore);
    }

    // Graph confidence: number of entities found
    if (graphResults?.entities?.length) {
      scores.push(Math.min(1, graphResults.entities.length / 10));
    }

    // Wiki confidence: based on average document confidence level
    if (wikiResults?.documents?.length) {
      const confMap: Record<string, number> = {
        high: 1.0,
        medium: 0.6,
        low: 0.3,
        deprecated: 0.1,
      };
      const avgConf =
        wikiResults.documents.reduce(
          (sum, d) => sum + (confMap[d.confidence] ?? 0.5),
          0,
        ) / wikiResults.documents.length;
      scores.push(avgConf);
    }

    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * Simple deterministic hash-based embedding (placeholder for real embedding API).
   * Produces a normalised pseudo-random vector of the given dimension.
   */
  private hashEmbed(text: string, dim: number): number[] {
    const vec = new Array(dim).fill(0);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const idx = (code * 2654435761) % dim;
      vec[idx] += (code / 255) * 2 - 1;
    }
    // Normalise
    const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (mag > 0) {
      for (let i = 0; i < dim; i++) vec[i] /= mag;
    }
    return vec;
  }

  // Expose underlying clients for advanced usage
  getChromaClient(): ChromaClientWrapper {
    return this.chroma;
  }

  getKuzuClient(): KuzuClient {
    return this.kuzu;
  }

  getWikiLoader(): WikiLoader {
    return this.wikiLoader;
  }
}
