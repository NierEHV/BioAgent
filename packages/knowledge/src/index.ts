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
