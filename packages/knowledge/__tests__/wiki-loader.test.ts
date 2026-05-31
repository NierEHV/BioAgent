// ============================================================
// @bioagent/knowledge — Wiki Loader & Parser Unit Tests
// ============================================================

import { describe, it, expect, beforeAll } from "vitest";
import { join } from "node:path";
import { WikiLoader } from "../src/wiki/wiki-loader.js";
import { parseWikiFile, loadAllWikiFiles, searchWiki } from "../src/wiki/wiki-parser.js";
import type { WikiDocFull } from "../src/wiki/wiki-parser.js";

const WIKI_DIR = join(import.meta.dirname ?? __dirname, "..", "data", "wiki");

describe("wiki-parser", () => {
  describe("parseWikiFile", () => {
    it("parses a wiki markdown file with valid frontmatter", () => {
      const filePath = join(WIKI_DIR, "omics", "scrna-seq", "overview.md");
      const doc = parseWikiFile(filePath);

      expect(doc.title).toBeTruthy();
      expect(doc.title).toBe("scRNA-seq Analysis Workflow Overview");
      expect(doc.topic).toBe("scrna-seq");
      expect(doc.version).toBeGreaterThanOrEqual(1);
      expect(doc.updated).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(Array.isArray(doc.sources)).toBeTruthy();
      expect(Array.isArray(doc.tags)).toBeTruthy();
      expect(Array.isArray(doc.related)).toBeTruthy();
      expect(["high", "medium", "low", "deprecated"]).toContain(doc.confidence);
      expect(doc.content.length).toBeGreaterThan(100);
      expect(doc.excerpt.length).toBeGreaterThan(0);
      expect(doc.path).toContain("overview.md");
    });

    it("parses the QC best practices document", () => {
      const filePath = join(WIKI_DIR, "omics", "scrna-seq", "qc-best-practices.md");
      const doc = parseWikiFile(filePath);

      expect(doc.topic).toBe("scrna-seq.qc");
      expect(doc.tags).toContain("qc");
      expect(doc.confidence).toBe("high");
      expect(doc.content).toContain("MAD");
      expect(doc.content).toContain("Scrublet");
    });

    it("parses all wiki files without errors", () => {
      const docs = loadAllWikiFiles(WIKI_DIR);
      expect(docs.size).toBeGreaterThanOrEqual(8);

      for (const [path, doc] of docs) {
        expect(doc.title).toBeTruthy();
        expect(doc.topic).toBeTruthy();
        expect(doc.version).toBeGreaterThanOrEqual(1);
        expect(doc.content.length).toBeGreaterThan(50);
        expect(doc.excerpt.length).toBeGreaterThan(0);
        // Normalise both sides to forward slashes for cross-platform compatibility
        expect(doc.path.replace(/\\/g, "/")).toContain(path);
      }
    });
  });

  describe("loadAllWikiFiles", () => {
    it("loads all markdown files recursively", () => {
      const docs = loadAllWikiFiles(WIKI_DIR);
      const paths = [...docs.keys()];

      // Expect at least our 8 wiki docs
      expect(docs.size).toBeGreaterThanOrEqual(8);

      // Check that omics/scrna-seq/ docs exist
      expect(paths.some((p) => p.includes("overview.md"))).toBeTruthy();
      expect(paths.some((p) => p.includes("qc-best-practices.md"))).toBeTruthy();
      expect(paths.some((p) => p.includes("normalization-methods.md"))).toBeTruthy();
      expect(paths.some((p) => p.includes("clustering-guide.md"))).toBeTruthy();
      expect(paths.some((p) => p.includes("cell-annotation.md"))).toBeTruthy();
      expect(paths.some((p) => p.includes("scanpy.md"))).toBeTruthy();
      expect(paths.some((p) => p.includes("seurat.md"))).toBeTruthy();
      expect(paths.some((p) => p.includes("scrna-standard-pipeline.md"))).toBeTruthy();
    });
  });

  describe("searchWiki", () => {
    it("finds documents by keyword in title", () => {
      const docs = loadAllWikiFiles(WIKI_DIR);
      const results = searchWiki(docs, "QC");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((d) => d.tags.includes("qc"))).toBeTruthy();
    });

    it("finds documents by keyword in content", () => {
      const docs = loadAllWikiFiles(WIKI_DIR);
      const results = searchWiki(docs, "Leiden");
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.content.toLowerCase().includes("leiden"))).toBeTruthy();
    });

    it("finds documents by tag", () => {
      const docs = loadAllWikiFiles(WIKI_DIR);
      const results = searchWiki(docs, "normalization");
      expect(results.length).toBeGreaterThan(0);
    });

    it("returns empty array for non-matching keyword", () => {
      const docs = loadAllWikiFiles(WIKI_DIR);
      const results = searchWiki(docs, "xyznonexistent12345");
      expect(results).toEqual([]);
    });
  });
});

describe("WikiLoader", () => {
  let loader: WikiLoader;

  beforeAll(async () => {
    loader = new WikiLoader(WIKI_DIR);
    await loader.loadIndex();
  });

  it("loads all wiki docs into index", () => {
    expect(loader.size()).toBeGreaterThanOrEqual(8);
  });

  it("getByTopic finds document by exact topic", () => {
    const doc = loader.getByTopic("scrna-seq.qc");
    expect(doc).not.toBeNull();
    expect(doc!.title).toContain("QC");
    expect(doc!.tags).toContain("qc");
  });

  it("getByTopic returns null for non-existent topic", () => {
    const doc = loader.getByTopic("nonexistent.topic");
    expect(doc).toBeNull();
  });

  it("getByTag returns documents with a specific tag", () => {
    const docs = loader.getByTag("qc");
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every((d) => d.tags.includes("qc"))).toBeTruthy();
  });

  it("getByTag returns empty for non-existent tag", () => {
    const docs = loader.getByTag("nonexistent_tag");
    expect(docs).toEqual([]);
  });

  it("search returns relevant documents", () => {
    const docs = loader.search("clustering");
    expect(docs.length).toBeGreaterThan(0);
    expect(
      docs.some((d) => d.title.toLowerCase().includes("cluster")),
    ).toBeTruthy();
  });

  it("getRelated follows references", () => {
    const doc = loader.getByTopic("scrna-seq.qc");
    expect(doc).not.toBeNull();
    const related = loader.getRelated(doc!, 1);
    expect(related.length).toBeGreaterThan(0);
  });

  it("getTopicTree returns documents under a topic prefix", () => {
    const docs = loader.getTopicTree("scrna-seq");
    // Should include scrna-seq, scrna-seq.qc, scrna-seq.normalization, etc.
    expect(docs.length).toBeGreaterThanOrEqual(5);
    expect(docs.every((d) => d.topic.startsWith("scrna-seq"))).toBeTruthy();
  });

  it("getTopicTree returns single doc for exact leaf topic", () => {
    const docs = loader.getTopicTree("sop.scrna-standard");
    expect(docs.length).toBe(1);
    expect(docs[0].topic).toBe("sop.scrna-standard");
  });

  it("reload updates a single document", () => {
    const filePath = join(WIKI_DIR, "omics", "scrna-seq", "overview.md");
    const doc = loader.reload(filePath);
    expect(doc.title).toBe("scRNA-seq Analysis Workflow Overview");

    // Verify it's in the index
    const searchResult = loader.search("scRNA-seq Analysis Workflow Overview");
    expect(searchResult.length).toBeGreaterThan(0);
  });

  it("getAllDocs returns all loaded documents", () => {
    const docs = loader.getAllDocs();
    expect(docs.length).toBeGreaterThanOrEqual(8);
    expect(docs.every((d) => typeof d.title === "string")).toBeTruthy();
  });
});
