// ============================================================
// @bioagent/knowledge — Knowledge Bridge Type Definitions
// ============================================================

// ---------------------------------------------------------------------------
// Knowledge Bridge Configuration
// ---------------------------------------------------------------------------

export interface KnowledgeBridgeConfig {
  chromaUrl?: string;
  kuzuDbPath?: string;
  wikiPath?: string;
  embeddingModel?: string;
  embeddingDim?: number;
  maxResultsPerLayer: number;
  similarityThreshold: number;
}

// ---------------------------------------------------------------------------
// Knowledge Query
// ---------------------------------------------------------------------------

export interface KnowledgeQuery {
  question: string;
  context?: {
    omicsType?: string;
    species?: string;
    tissue?: string;
    currentSkill?: string;
    genesOfInterest?: string[];
    cellTypes?: string[];
  };
  layers?: ("vector" | "graph" | "wiki")[];
  maxResults?: number;
  minConfidence?: number;
}

// ---------------------------------------------------------------------------
// Knowledge Result
// ---------------------------------------------------------------------------

export interface KnowledgeResult {
  vectorResults: {
    snippets: VectorSnippet[];
    similarCases: SimilarCase[];
    queryTime: number;
  };
  graphResults: {
    entities: GraphEntity[];
    paths: GraphPath[];
    conflicts: KnowledgeConflict[];
    queryTime: number;
  };
  wikiResults: {
    documents: WikiDocument[];
    excerpts: string[];
    queryTime: number;
  };
  synthesis: string;
  confidence: number;
  totalQueryTime: number;
}

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

export interface VectorSnippet {
  text: string;
  metadata: {
    doi?: string;
    url?: string;
    title?: string;
    topic?: string;
    year?: number;
  };
  score: number;
  collection: string;
}

export interface SimilarCase {
  projectId: string;
  description: string;
  omicsType: string;
  tissue?: string;
  similarity: number;
  outcome: string;
}

export interface GraphEntity {
  id: string;
  type:
    | "Gene"
    | "Pathway"
    | "Disease"
    | "Drug"
    | "CellType"
    | "Tool"
    | "Tissue"
    | "GO_Term"
    | "Marker";
  name: string;
  properties: Record<string, unknown>;
}

export interface GraphPath {
  nodes: string[];
  edges: string[];
  length: number;
  confidence: number;
  explanation: string;
}

export interface KnowledgeConflict {
  entity1: string;
  entity2: string;
  claim1: string;
  claim2: string;
  source1: string;
  source2: string;
  resolution?: string;
}

export interface WikiDocument {
  title: string;
  topic: string;
  path: string;
  confidence: "high" | "medium" | "low" | "deprecated";
  version: number;
  updated: string;
  sources: { doi?: string; github?: string; url?: string }[];
  tags: string[];
  excerpt: string;
}
