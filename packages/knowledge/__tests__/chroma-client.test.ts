// ============================================================
// @bioagent/knowledge — ChromaDB Client Unit Tests (Mocked)
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import { COLLECTIONS } from "../src/vector-db/collections";

// ---------------------------------------------------------------------------
// Mock chromadb module
// ---------------------------------------------------------------------------

vi.mock("chromadb", () => {
  const mockCollection = {
    add: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({
      ids: [["id-1", "id-2"]],
      documents: [["doc 1 text", "doc 2 text"]],
      metadatas: [[{ topic: "qc" }, { topic: "normalization" }]],
      distances: [[0.1, 0.3]],
    }),
    delete: vi.fn().mockResolvedValue({ deleted: 2 }),
    count: vi.fn().mockResolvedValue(42),
    peek: vi.fn().mockResolvedValue({
      ids: ["peek-1"],
      documents: ["peek doc"],
      metadatas: [{}],
    }),
  };

  return {
    ChromaClient: vi.fn().mockImplementation(() => ({
      getOrCreateCollection: vi.fn().mockResolvedValue(mockCollection),
      getCollection: vi.fn().mockResolvedValue(mockCollection),
      deleteCollection: vi.fn().mockResolvedValue(undefined),
      listCollections: vi.fn().mockResolvedValue([
        { name: "literature_snippets" },
        { name: "analysis_cases" },
        { name: "debug_logs" },
      ]),
      reset: vi.fn().mockResolvedValue(undefined),
      heartbeat: vi.fn().mockResolvedValue(Date.now()),
      version: vi.fn().mockResolvedValue("3.4.0"),
    })),
  };
});

import { ChromaClientWrapper } from "../src/vector-db/chroma-client";
import type { SimpleEmbeddingFunction } from "../src/vector-db/chroma-client";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("COLLECTIONS", () => {
  it("defines three collections", () => {
    const keys = Object.keys(COLLECTIONS);
    expect(keys).toContain("literature_snippets");
    expect(keys).toContain("analysis_cases");
    expect(keys).toContain("debug_logs");
  });

  it("each collection has a name, metadata array, and distance", () => {
    for (const [, def] of Object.entries(COLLECTIONS)) {
      expect(typeof def.name).toBe("string");
      expect(Array.isArray(def.metadata)).toBeTruthy();
      expect(def.metadata.length).toBeGreaterThan(0);
      expect(def.distance).toBe("cosine");
    }
  });

  it("literature_snippets has expected metadata fields", () => {
    const lit = COLLECTIONS.literature_snippets;
    expect(lit.metadata).toContain("source_type");
    expect(lit.metadata).toContain("doi");
    expect(lit.metadata).toContain("topic");
    expect(lit.metadata).toContain("year");
  });

  it("analysis_cases has expected metadata fields", () => {
    const ac = COLLECTIONS.analysis_cases;
    expect(ac.metadata).toContain("project_id");
    expect(ac.metadata).toContain("omics_type");
    expect(ac.metadata).toContain("workflow_used");
  });

  it("debug_logs has expected metadata fields", () => {
    const dl = COLLECTIONS.debug_logs;
    expect(dl.metadata).toContain("error_type");
    expect(dl.metadata).toContain("resolved");
    expect(dl.metadata).toContain("os");
  });
});

describe("ChromaClientWrapper", () => {
  let client: ChromaClientWrapper;

  const mockEmbedFn: SimpleEmbeddingFunction = {
    generate: vi.fn().mockImplementation(async (texts: string[]) =>
      texts.map(() => new Array(128).fill(0.1)),
    ),
  };

  beforeEach(() => {
    client = new ChromaClientWrapper({
      url: "http://localhost:8000",
      embeddingFunction: mockEmbedFn,
    });
  });

  describe("initialize", () => {
    it("creates or gets all three collections", async () => {
      await expect(client.initialize()).resolves.not.toThrow();
    });
  });

  describe("add", () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it("adds documents to a collection", async () => {
      await expect(
        client.add(
          "literature_snippets",
          ["Document 1 text", "Document 2 text"],
          [
            { topic: "qc", source_type: "paper" },
            { topic: "normalization", source_type: "docs" },
          ],
          ["id-1", "id-2"],
        ),
      ).resolves.not.toThrow();
    });

    it("embeds documents when embedding function is provided", async () => {
      await client.add(
        "literature_snippets",
        ["test document"],
        [{ topic: "test" }],
        ["test-id"],
      );
      expect(mockEmbedFn.generate).toHaveBeenCalled();
    });
  });

  describe("query", () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it("queries a collection and returns results", async () => {
      const result = await client.query("literature_snippets", "QC methods", {
        nResults: 5,
      });
      expect(result.ids).toBeDefined();
      expect(result.documents).toBeDefined();
      expect(result.metadatas).toBeDefined();
      expect(result.distances).toBeDefined();
      expect(Array.isArray(result.ids)).toBeTruthy();
      expect(Array.isArray(result.documents)).toBeTruthy();
    });

    it("filters by minScore", async () => {
      const result = await client.query("literature_snippets", "QC methods", {
        nResults: 5,
        minScore: 0.8,
      });
      expect(result.ids).toBeDefined();
    });

    it("passes where filter to query", async () => {
      await client.query("literature_snippets", "QC methods", {
        where: { topic: "qc" },
      });
      // The mock doesn't validate, but we expect the call to not throw
    });
  });

  describe("count", () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it("returns the count of documents in a collection", async () => {
      const cnt = await client.count("literature_snippets");
      expect(typeof cnt).toBe("number");
      expect(cnt).toBe(42); // mock returns 42
    });
  });

  describe("deleteByFilter", () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it("deletes records by where filter", async () => {
      await expect(
        client.deleteByFilter("literature_snippets", { topic: "qc" }),
      ).resolves.not.toThrow();
    });
  });

  describe("reset", () => {
    it("deletes all collections and clears cache", async () => {
      await client.initialize();
      await expect(client.reset()).resolves.not.toThrow();
    });
  });

  describe("getClient", () => {
    it("returns the underlying ChromaClient", () => {
      const underlying = client.getClient();
      expect(underlying).toBeDefined();
      expect(typeof underlying.heartbeat).toBe("function");
    });
  });
});
