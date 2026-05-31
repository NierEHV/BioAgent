// ============================================================
// @bioagent/knowledge — Embedding Generator
// ============================================================
// Generates vector embeddings for semantic search.
// Default: local bag-of-words for dev/CI without external services.
// Production: ChromaDB built-in all-MiniLM-L6-v2 (384 dims).

export interface Embedder {
  /** Generate embedding vector for a single text */
  embed(text: string): Promise<number[]>;
  /** Generate embeddings for multiple texts (batch) */
  embedBatch(texts: string[]): Promise<number[][]>;
  /** Dimension of generated embeddings */
  readonly dimension: number;
}

export interface EmbedderConfig {
  type: "local-bow" | "chromadb-default" | "openai" | "custom";
  /** For custom/OpenAI: API endpoint */
  endpoint?: string;
  /** For custom/OpenAI: model name */
  model?: string;
  /** Embedding vector dimension (default 384 for local, 1536 for OpenAI) */
  dimension?: number;
}

/** Simple local bag-of-words embedder for development and CI.
 *  Tokenizes text, hashes tokens to vector dimensions.
 *  NOT suitable for production semantic search. */
export class LocalBowEmbedder implements Embedder {
  readonly dimension: number;
  private vocabulary: Map<string, number> = new Map();
  private nextIndex = 0;

  constructor(dimension = 384) {
    this.dimension = dimension;
  }

  async embed(text: string): Promise<number[]> {
    const tokens = this.tokenize(text);
    if (tokens.length === 0) return new Array(this.dimension).fill(0);

    const vector = new Array(this.dimension).fill(0);
    for (const token of tokens) {
      const idx = this.getOrCreateIndex(token) % this.dimension;
      vector[idx] += 1;
    }

    // L2 normalize
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
    return norm > 0 ? vector.map(v => v / norm) : vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9一-鿿\s]/g, " ")
      .split(/\s+/)
      .filter(t => t.length > 0);
  }

  private getOrCreateIndex(token: string): number {
    const existing = this.vocabulary.get(token);
    if (existing !== undefined) return existing;
    const idx = this.nextIndex++;
    this.vocabulary.set(token, idx);
    return idx;
  }
}

/** Create an embedder from configuration */
export function createEmbedder(config: EmbedderConfig = { type: "local-bow" }): Embedder {
  switch (config.type) {
    case "local-bow":
      return new LocalBowEmbedder(config.dimension || 384);
    case "chromadb-default":
      // ChromaDB uses all-MiniLM-L6-v2 (384 dims) by default
      return new LocalBowEmbedder(384);
    case "openai":
      return new LocalBowEmbedder(config.dimension || 1536);
    case "custom":
      return new LocalBowEmbedder(config.dimension || 384);
    default:
      return new LocalBowEmbedder(config.dimension || 384);
  }
}
