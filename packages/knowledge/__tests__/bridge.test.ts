// ============================================================
// @bioagent/knowledge — Knowledge Bridge Unit Tests
// ============================================================

import { describe, it, expect } from "vitest";
import {
  type KnowledgeQuery,
  type KnowledgeResult,
  type VectorSnippet,
  type SimilarCase,
  type GraphEntity,
  type GraphPath,
  type KnowledgeConflict,
  type WikiDocument,
} from "../src/bridge.types";

// ---------------------------------------------------------------------------
// Type conformance tests (compile-time + runtime shape checks)
// ---------------------------------------------------------------------------

describe("KnowledgeQuery", () => {
  it("accepts minimal query", () => {
    const q: KnowledgeQuery = { question: "How to normalize scRNA-seq data?" };
    expect(q.question).toBeTruthy();
  });

  it("accepts query with full context", () => {
    const q: KnowledgeQuery = {
      question: "What markers identify T cells in lung tissue?",
      context: {
        omicsType: "scrna-seq",
        species: "Homo sapiens",
        tissue: "lung",
        genesOfInterest: ["CD3E", "CD4", "CD8A"],
        cellTypes: ["T cell", "NK cell"],
        currentSkill: "cell-annotation",
      },
      layers: ["vector", "graph", "wiki"],
      maxResults: 10,
      minConfidence: 0.6,
    };
    expect(q.context?.genesOfInterest).toHaveLength(3);
    expect(q.layers).toHaveLength(3);
    expect(q.minConfidence).toBe(0.6);
  });

  it("has optional fields that default properly", () => {
    const q: KnowledgeQuery = { question: "test" };
    expect(q.context).toBeUndefined();
    expect(q.layers).toBeUndefined();
    expect(q.maxResults).toBeUndefined();
    expect(q.minConfidence).toBeUndefined();
  });
});

describe("KnowledgeResult shape", () => {
  it("has the expected structure", () => {
    const result: KnowledgeResult = {
      vectorResults: { snippets: [], similarCases: [], queryTime: 0 },
      graphResults: { entities: [], paths: [], conflicts: [], queryTime: 0 },
      wikiResults: { documents: [], excerpts: [], queryTime: 0 },
      synthesis: "No relevant knowledge found across the three layers.",
      confidence: 0,
      totalQueryTime: 0,
    };

    expect(result.vectorResults).toBeDefined();
    expect(result.graphResults).toBeDefined();
    expect(result.wikiResults).toBeDefined();
    expect(typeof result.synthesis).toBe("string");
    expect(typeof result.confidence).toBe("number");
    expect(typeof result.totalQueryTime).toBe("number");
  });

  it("can hold populated vector snippets", () => {
    const snippet: VectorSnippet = {
      text: "Normalization methods: log-normalize, scran, SCTranform...",
      metadata: {
        doi: "10.1038/s41576-023-00586-w",
        title: "Best Practices 2023",
        topic: "scrna-seq.normalization",
        year: 2023,
      },
      score: 0.92,
      collection: "literature_snippets",
    };
    expect(snippet.score).toBeGreaterThan(0);
    expect(snippet.collection).toBe("literature_snippets");
  });

  it("can hold populated graph entities", () => {
    const entity: GraphEntity = {
      id: "TP53",
      type: "Gene",
      name: "TP53",
      properties: {
        chromosome: "17",
        biotype: "protein_coding",
      },
    };
    expect(entity.type).toBe("Gene");
    expect(entity.name).toBe("TP53");
  });

  it("can hold graph paths", () => {
    const path: GraphPath = {
      nodes: ["TP53", "hsa04110", "Cell cycle"],
      edges: ["PARTICIPATES_IN"],
      length: 2,
      confidence: 0.85,
      explanation: "TP53 participates in cell cycle pathway",
    };
    expect(path.nodes).toHaveLength(3);
    expect(path.confidence).toBeGreaterThan(0);
  });

  it("can hold knowledge conflicts", () => {
    const conflict: KnowledgeConflict = {
      entity1: "MYC",
      entity2: "DOID:1612",
      claim1: "MYC is UPREGULATED_IN breast cancer",
      claim2: "MYC is DOWNREGULATED_IN breast cancer",
      source1: "new claim",
      source2: "existing graph",
      resolution: "Review literature",
    };
    expect(conflict.claim1).not.toBe(conflict.claim2);
  });

  it("can hold wiki documents", () => {
    const doc: WikiDocument = {
      title: "QC Best Practices",
      topic: "scrna-seq.qc",
      path: "omics/scrna-seq/qc-best-practices.md",
      confidence: "high",
      version: 1,
      updated: "2026-05-31",
      sources: [{ doi: "10.15252/msb.20188746" }],
      tags: ["qc", "quality-control"],
      excerpt: "Quality control is the most critical step...",
    };
    expect(doc.confidence).toBe("high");
    expect(doc.tags).toContain("qc");
  });

  it("can hold similar cases", () => {
    const case_: SimilarCase = {
      projectId: "proj-001",
      description: "PBMC 10k cells QC analysis",
      omicsType: "scrna-seq",
      tissue: "blood",
      similarity: 0.88,
      outcome: "Scrublet + MAD filtering retained 85% of cells",
    };
    expect(case_.similarity).toBeGreaterThan(0.7);
    expect(case_.omicsType).toBe("scrna-seq");
  });
});

// ---------------------------------------------------------------------------
// Integration tests — verify types compose into full result objects
// ---------------------------------------------------------------------------

describe("KnowledgeResult composition", () => {
  it("builds a realistic vector result", () => {
    const snippets: VectorSnippet[] = [
      {
        text: "Filter cells with < 200 genes and > 20% MT",
        metadata: { doi: "10.15252/msb.20188746", topic: "scrna-seq.qc" },
        score: 0.95,
        collection: "literature_snippets",
      },
    ];
    const cases: SimilarCase[] = [
      {
        projectId: "proj-001",
        description: "Similar project",
        omicsType: "scrna-seq",
        similarity: 0.82,
        outcome: "success",
      },
    ];
    const vec = { snippets, similarCases: cases, queryTime: 42 };
    expect(vec.snippets).toHaveLength(1);
    expect(vec.similarCases).toHaveLength(1);
    expect(vec.queryTime).toBeGreaterThan(0);
  });

  it("builds a realistic graph result", () => {
    const entities: GraphEntity[] = [
      { id: "TP53", type: "Gene", name: "TP53", properties: {} },
      { id: "hsa04110", type: "Pathway", name: "Cell cycle", properties: {} },
    ];
    const paths: GraphPath[] = [
      {
        nodes: ["TP53", "hsa04110"],
        edges: ["PARTICIPATES_IN"],
        length: 1,
        confidence: 0.9,
        explanation: "TP53 participates in cell cycle",
      },
    ];
    const conflicts: KnowledgeConflict[] = [];
    const graph = { entities, paths, conflicts, queryTime: 15 };
    expect(graph.entities).toHaveLength(2);
    expect(graph.paths).toHaveLength(1);
  });

  it("builds a realistic wiki result", () => {
    const documents: WikiDocument[] = [
      {
        title: "QC Best Practices",
        topic: "scrna-seq.qc",
        path: "omics/scrna-seq/qc-best-practices.md",
        confidence: "high",
        version: 1,
        updated: "2026-05-31",
        sources: [],
        tags: ["qc"],
        excerpt: "...",
      },
    ];
    const excerpts = documents.map((d) => d.excerpt);
    const wiki = { documents, excerpts, queryTime: 8 };
    expect(wiki.documents).toHaveLength(1);
    expect(wiki.excerpts).toHaveLength(1);
  });

  it("combines all three layers into a full KnowledgeResult", () => {
    const result: KnowledgeResult = {
      vectorResults: {
        snippets: [
          {
            text: "data",
            metadata: {},
            score: 1.0,
            collection: "literature_snippets",
          },
        ],
        similarCases: [],
        queryTime: 10,
      },
      graphResults: {
        entities: [],
        paths: [],
        conflicts: [],
        queryTime: 5,
      },
      wikiResults: {
        documents: [],
        excerpts: [],
        queryTime: 3,
      },
      synthesis: "Found 1 relevant snippet. No graph or wiki results.",
      confidence: 0.33,
      totalQueryTime: 18,
    };

    expect(result.vectorResults.snippets).toHaveLength(1);
    expect(result.vectorResults.queryTime).toBe(10);
    expect(result.graphResults.queryTime).toBe(5);
    expect(result.wikiResults.queryTime).toBe(3);
    expect(result.totalQueryTime).toBe(18);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.synthesis.length).toBeGreaterThan(0);
  });
});
