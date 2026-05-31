// ============================================================
// @bioagent/knowledge — ChromaDB Client Wrapper
// ============================================================

import { ChromaClient, type Collection } from "chromadb";
import { COLLECTIONS, type CollectionName } from "./collections.js";
import { getLogger } from "../logger.js";

const logger = getLogger("chroma-client");

// ---------------------------------------------------------------------------
// Minimal embedding function interface (matches chromadb's EmbeddingFunction)
// ---------------------------------------------------------------------------

export interface SimpleEmbeddingFunction {
  generate(texts: string[]): Promise<number[][]>;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ChromaClientOptions {
  url?: string;
  embeddingFunction?: SimpleEmbeddingFunction | null;
}

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export interface QueryOptions {
  nResults?: number;
  where?: Record<string, unknown>;
  whereDocument?: Record<string, unknown>;
  minScore?: number;
}

export interface QueryResponse {
  ids: string[];
  documents: string[];
  metadatas: Record<string, unknown>[];
  distances: number[];
}

// ---------------------------------------------------------------------------
// Wrapper class
// ---------------------------------------------------------------------------

export class ChromaClientWrapper {
  private client: ChromaClient;
  private collections: Map<string, Collection> = new Map();
  private embedFn: SimpleEmbeddingFunction | null;

  constructor(options: ChromaClientOptions = {}) {
    this.client = new ChromaClient({
      path: options.url ?? "http://localhost:8000",
    });
    this.embedFn = options.embeddingFunction ?? null;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Create (or get) all three collections defined in COLLECTIONS.
   */
  async initialize(): Promise<void> {
    logger.info("Initializing ChromaDB collections...");
    for (const [, def] of Object.entries(COLLECTIONS)) {
      try {
        const col = await this.client.getOrCreateCollection({
          name: def.name,
          embeddingFunction: null, // we handle embedding externally
          metadata: { distance: def.distance },
        });
        this.collections.set(def.name, col);
        logger.info({ name: def.name }, "Collection ready");
      } catch (err) {
        logger.error({ err, name: def.name }, "Failed to ensure collection");
        throw err;
      }
    }
    logger.info("All ChromaDB collections initialized");
  }

  /**
   * Delete all three collections — dev / testing only.
   */
  async reset(): Promise<void> {
    for (const [, def] of Object.entries(COLLECTIONS)) {
      try {
        await this.client.deleteCollection({ name: def.name });
      } catch {
        // ignore — collection may not exist
      }
    }
    this.collections.clear();
    logger.info("ChromaDB collections reset");
  }

  // -----------------------------------------------------------------------
  // CRUD
  // -----------------------------------------------------------------------

  /**
   * Add documents to a collection. Documents are embedded on-the-fly if an
   * embedding function was supplied at construction time.
   */
  async add(
    collectionName: CollectionName,
    documents: string[],
    metadatas: Record<string, unknown>[],
    ids: string[],
  ): Promise<void> {
    const col = await this.getCollection(collectionName);
    const payload: {
      ids: string[];
      documents: string[];
      metadatas: Record<string, unknown>[];
      embeddings?: number[][];
    } = { ids, documents, metadatas };

    if (this.embedFn) {
      payload.embeddings = await this.embedFn.generate(documents);
    }

    // chromadb v3 uses Metadata type which is stricter; we cast through unknown
    await col.add(payload as unknown as Parameters<typeof col.add>[0]);
    logger.info({ collection: collectionName, count: ids.length }, "Documents added");
  }

  /**
   * Semantic search against a collection.
   * - If an embedding function is available, `queryText` is embedded on the fly.
   * - Otherwise pass `embeddings` via opts.
   */
  async query(
    collectionName: CollectionName,
    queryText: string,
    opts?: QueryOptions,
  ): Promise<QueryResponse> {
    const col = await this.getCollection(collectionName);

    const queryArgs: Record<string, unknown> = {
      nResults: opts?.nResults ?? 10,
      include: ["documents", "metadatas", "distances"],
    };

    if (this.embedFn) {
      const queryEmbeddings = await this.embedFn.generate([queryText]);
      queryArgs.queryEmbeddings = queryEmbeddings;
    } else {
      // Fallback: use queryTexts — Chroma will embed if the collection has
      // a default embedding function configured server-side.
      queryArgs.queryTexts = [queryText];
    }

    if (opts?.where) {
      queryArgs.where = opts.where;
    }
    if (opts?.whereDocument) {
      queryArgs.whereDocument = opts.whereDocument;
    }

    const result = await col.query(queryArgs as any);

    // chromadb v3 returns columnar arrays-of-arrays (one inner array per query)
    const ids: string[] = (result.ids?.[0] ?? []) as string[];
    const documents: string[] = ((result.documents?.[0] ?? []) as (string | null)[]).map(
      (d) => d ?? "",
    );
    const metadatas: Record<string, unknown>[] = ((result.metadatas?.[0] ??
      []) as (Record<string, unknown> | null)[]).map((m) => m ?? {});
    const distances: number[] = (result.distances?.[0] ?? []) as number[];

    // Apply minScore filter (cosine distance: 0=identical, 2=opposite)
    if (opts?.minScore !== undefined) {
      const threshold = 1 - opts.minScore;
      const filtered: QueryResponse = { ids: [], documents: [], metadatas: [], distances: [] };
      for (let i = 0; i < ids.length; i++) {
        if (distances[i] <= threshold) {
          filtered.ids.push(ids[i]);
          filtered.documents.push(documents[i]);
          filtered.metadatas.push(metadatas[i]);
          filtered.distances.push(distances[i]);
        }
      }
      return filtered;
    }

    return { ids, documents, metadatas, distances };
  }

  /**
   * Delete records that match a metadata filter.
   */
  async deleteByFilter(
    collectionName: CollectionName,
    where: Record<string, unknown>,
  ): Promise<void> {
    const col = await this.getCollection(collectionName);
    await col.delete({ where: where as any });
    logger.info({ collection: collectionName }, "Filtered delete executed");
  }

  /**
   * Return the number of documents in a collection.
   */
  async count(collectionName: CollectionName): Promise<number> {
    const col = await this.getCollection(collectionName);
    return col.count();
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /** Resolve a collection handle, caching it in memory. */
  private async getCollection(name: string): Promise<Collection> {
    let col = this.collections.get(name);
    if (!col) {
      col = await this.client.getCollection({ name, embeddingFunction: undefined });
      this.collections.set(name, col);
    }
    return col;
  }

  /** Expose underlying chroma client for advanced usage. */
  getClient(): ChromaClient {
    return this.client;
  }
}
