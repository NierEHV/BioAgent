// ============================================================
// @bioagent/knowledge — Public API
// ============================================================

// ---------------------------------------------------------------------------
// Vector DB (ChromaDB)
// ---------------------------------------------------------------------------
export { COLLECTIONS } from "./vector-db/collections.js";
export type { CollectionName } from "./vector-db/collections.js";

export {
  ChromaClientWrapper,
  type ChromaClientOptions,
  type QueryOptions,
  type QueryResponse,
  type SimpleEmbeddingFunction,
} from "./vector-db/chroma-client.js";

// ---------------------------------------------------------------------------
// Graph DB (KuzuDB)
// ---------------------------------------------------------------------------
export {
  NODE_TABLES,
  REL_TABLES,
  type NodeTableDef,
  type RelTableDef,
} from "./graph-db/schema.js";

export {
  KuzuClient,
  type KuzuClientOptions,
  type KuzuStats,
  type GraphPath,
  type KnowledgeConflict,
} from "./graph-db/kuzu-client.js";

// ---------------------------------------------------------------------------
// Wiki
// ---------------------------------------------------------------------------
export {
  WikiLoader,
} from "./wiki/wiki-loader.js";

export {
  parseWikiFile,
  loadAllWikiFiles,
  searchWiki,
  type WikiDocFull,
  type WikiDocFrontmatter,
} from "./wiki/wiki-parser.js";

// ---------------------------------------------------------------------------
// Knowledge Bridge
// ---------------------------------------------------------------------------
export { KnowledgeBridge } from "./bridge.js";

export type {
  KnowledgeBridgeConfig,
  KnowledgeQuery,
  KnowledgeResult,
  VectorSnippet,
  SimilarCase,
  GraphEntity,
  WikiDocument,
} from "./bridge.types.js";

// ---------------------------------------------------------------------------
// Embedder (§4.1: vector-db/embedder.ts)
// ---------------------------------------------------------------------------
export {
  LocalBowEmbedder,
  createEmbedder,
} from "./vector-db/embedder.js";
export type { Embedder, EmbedderConfig } from "./vector-db/embedder.js";

// ---------------------------------------------------------------------------
// Graph Queries (§4.1: graph-db/queries.ts)
// ---------------------------------------------------------------------------
export { QUERIES } from "./graph-db/queries.js";
export type { QueryName, GraphQuery } from "./graph-db/queries.js";

// ---------------------------------------------------------------------------
// Graph Seed Data Loader (§4.1: graph-db/seed-data.ts)
// ---------------------------------------------------------------------------
export { seedGraphFromCSV } from "./graph-db/seed-data.js";
export type { SeedDataSource, SeedResult } from "./graph-db/seed-data.js";

// ---------------------------------------------------------------------------
// Wiki Index (§4.1: wiki/wiki-index.ts)
// ---------------------------------------------------------------------------
export { WikiIndex } from "./wiki/wiki-index.js";
export type { WikiIndexEntry } from "./wiki/wiki-index.js";

// ---------------------------------------------------------------------------
// Seed Data
// ---------------------------------------------------------------------------
export {
  SCRNA_SEED_SOURCES,
  SEED_GENES,
  SEED_CELL_TYPES,
  SEED_PATHWAYS,
  SEED_TOOLS,
  LITERATURE_SNIPPETS,
} from "./seed/scrna-seed.js";

// ---------------------------------------------------------------------------
// Biology Seed (§4.1: seed/biology-seed.ts)
// ---------------------------------------------------------------------------
export {
  BIOLOGY_CONCEPTS,
  biologyConceptsToSnippets,
} from "./seed/biology-seed.js";
export type { BiologyConcept } from "./seed/biology-seed.js";

// ---------------------------------------------------------------------------
// Tool Seed (§4.1: seed/tool-seed.ts)
// ---------------------------------------------------------------------------
export {
  TOOL_EXPERIENCES,
  toolExperiencesToSnippets,
} from "./seed/tool-seed.js";
export type { ToolExperience } from "./seed/tool-seed.js";
