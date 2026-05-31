// ============================================================
// @bioagent/knowledge — Wiki Document Loader
// ============================================================

import { resolve } from "node:path";
import {
  loadAllWikiFiles,
  parseWikiFile,
  searchWiki,
  type WikiDocFull,
} from "./wiki-parser.js";
import { getLogger } from "../logger.js";

const logger = getLogger("wiki-loader");

// ---------------------------------------------------------------------------
// WikiLoader
// ---------------------------------------------------------------------------

export class WikiLoader {
  private wikiPath: string;
  private docs: Map<string, WikiDocFull> = new Map();

  constructor(wikiPath: string) {
    this.wikiPath = resolve(wikiPath);
  }

  // -----------------------------------------------------------------------
  // Indexing
  // -----------------------------------------------------------------------

  /** Load all wiki documents into memory. */
  async loadIndex(): Promise<Map<string, WikiDocFull>> {
    this.docs = loadAllWikiFiles(this.wikiPath);
    logger.info({ count: this.docs.size }, "Wiki index loaded");
    return this.docs;
  }

  // -----------------------------------------------------------------------
  // Lookup
  // -----------------------------------------------------------------------

  /** Get a document by its topic field. */
  getByTopic(topic: string): WikiDocFull | null {
    for (const doc of this.docs.values()) {
      if (doc.topic === topic) return doc;
    }
    return null;
  }

  /** Get all documents that have a specific tag. */
  getByTag(tag: string): WikiDocFull[] {
    const results: WikiDocFull[] = [];
    for (const doc of this.docs.values()) {
      if (doc.tags.includes(tag)) results.push(doc);
    }
    return results;
  }

  /** Full-text search across titles, tags, and content. */
  search(keyword: string): WikiDocFull[] {
    return searchWiki(this.docs, keyword);
  }

  // -----------------------------------------------------------------------
  // Related documents
  // -----------------------------------------------------------------------

  /**
   * Follow the `related` references of a document up to a given depth.
   * Returns a deduplicated list of related documents.
   */
  getRelated(doc: WikiDocFull, depth = 1): WikiDocFull[] {
    const visited = new Set<string>();
    const results: WikiDocFull[] = [];
    const queue: { doc: WikiDocFull; level: number }[] = [{ doc, level: 0 }];

    while (queue.length > 0) {
      const { doc: current, level } = queue.shift()!;
      if (visited.has(current.path) || level > depth) continue;
      visited.add(current.path);

      if (level > 0) {
        results.push(current);
      }

      for (const relPath of current.related) {
        const relDoc = this.resolveRelPath(relPath);
        if (relDoc && !visited.has(relDoc.path)) {
          queue.push({ doc: relDoc, level: level + 1 });
        }
      }
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Topic tree
  // -----------------------------------------------------------------------

  /**
   * Get all documents under a topic prefix.
   * E.g., `"scrna-seq"` matches `"scrna-seq.qc"`, `"scrna-seq.clustering"`, etc.
   */
  getTopicTree(topic: string): WikiDocFull[] {
    const results: WikiDocFull[] = [];
    for (const doc of this.docs.values()) {
      if (doc.topic === topic || doc.topic.startsWith(topic + ".")) {
        results.push(doc);
      }
    }
    return results;
  }

  // -----------------------------------------------------------------------
  // Hot-reload
  // -----------------------------------------------------------------------

  /** Parse and reload a single file by path. Updates in-memory index. */
  reload(path: string): WikiDocFull {
    const doc = parseWikiFile(path);
    // Replace in the map (keyed by relative path derived from the absolute path)
    const relPath = path
      .replace(this.wikiPath, "")
      .replace(/\\/g, "/")
      .replace(/^\//, "");
    this.docs.set(relPath, doc);
    logger.info({ path: relPath, title: doc.title }, "Wiki document reloaded");
    return doc;
  }

  /** Return all loaded documents. */
  getAllDocs(): WikiDocFull[] {
    return [...this.docs.values()];
  }

  /** Number of loaded documents. */
  size(): number {
    return this.docs.size;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private resolveRelPath(relPath: string): WikiDocFull | null {
    // Try exact match first
    let doc = this.docs.get(relPath);
    if (doc) return doc;
    // Try appending .md
    doc = this.docs.get(relPath + ".md");
    if (doc) return doc;
    // Search by suffix
    for (const [key, value] of this.docs) {
      if (key.endsWith("/" + relPath) || key.endsWith("\\" + relPath)) {
        return value;
      }
    }
    return null;
  }
}
