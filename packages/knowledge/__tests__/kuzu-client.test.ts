// ============================================================
// @bioagent/knowledge — KuzuDB Client Unit Tests
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { KuzuClient } from "../src/graph-db/kuzu-client";
import { NODE_TABLES, REL_TABLES } from "../src/graph-db/schema";

let tmpDir: string;
let client: KuzuClient;

describe("KuzuClient", () => {
  beforeAll(async () => {
    // KuzuDB requires the path to NOT exist — it creates the directory itself.
    // So we use the temp dir as a base and create a sub-path.
    tmpDir = mkdtempSync(join(tmpdir(), "kuzu-base-"));
    const dbPath = join(tmpDir, "kuzu-data");
    client = new KuzuClient({ dbPath });
    await client.initialize();
  });

  afterAll(async () => {
    await client.close();
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  // -----------------------------------------------------------------------
  // Schema
  // -----------------------------------------------------------------------

  describe("schema", () => {
    it("has 9 node tables defined", () => {
      expect(NODE_TABLES.length).toBe(9);
      const names = NODE_TABLES.map((n) => n.name);
      expect(names).toContain("Gene");
      expect(names).toContain("Pathway");
      expect(names).toContain("Disease");
      expect(names).toContain("Drug");
      expect(names).toContain("CellType");
      expect(names).toContain("Tool");
      expect(names).toContain("Tissue");
      expect(names).toContain("GO_Term");
      expect(names).toContain("Marker");
    });

    it("has 10 relationship tables defined", () => {
      expect(REL_TABLES.length).toBe(10);
      const names = REL_TABLES.map((r) => r.name);
      expect(names).toContain("PARTICIPATES_IN");
      expect(names).toContain("ASSOCIATED_WITH");
      expect(names).toContain("TARGETS");
      expect(names).toContain("MARKER_OF");
      expect(names).toContain("LOCATED_IN");
      expect(names).toContain("INTERACTS_WITH");
      expect(names).toContain("UPREGULATED_IN");
      expect(names).toContain("DOWNREGULATED_IN");
      expect(names).toContain("BETTER_THAN");
      expect(names).toContain("CITES");
    });

    it("each node table has a primary key", () => {
      for (const node of NODE_TABLES) {
        expect(node.primaryKey).toBeTruthy();
        expect(Object.keys(node.properties)).toContain(node.primaryKey);
      }
    });

    it("each relationship table references valid node tables", () => {
      const nodeNames = new Set(NODE_TABLES.map((n) => n.name));
      for (const rel of REL_TABLES) {
        expect(nodeNames.has(rel.from)).toBeTruthy();
        expect(nodeNames.has(rel.to)).toBeTruthy();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Node operations
  // -----------------------------------------------------------------------

  describe("insertNode", () => {
    it("inserts a Gene node", async () => {
      await client.insertNode("Gene", {
        symbol: "TP53",
        ensembl_id: "ENSG00000141510",
        full_name: "tumor protein p53",
        chromosome: "17",
        biotype: "protein_coding",
      });

      const rows = await client.query(
        "MATCH (g:Gene {symbol: $symbol}) RETURN g",
        { symbol: "TP53" },
      );
      expect(rows.length).toBe(1);
      const gene = rows[0]["g"] as Record<string, unknown>;
      expect(gene.symbol).toBe("TP53");
    });

    it("inserts a CellType node", async () => {
      await client.insertNode("CellType", {
        name: "T cell",
        ontology_id: "CL:0000084",
        category: "lymphocyte",
        species: "Homo sapiens",
      });

      const rows = await client.query(
        "MATCH (c:CellType {name: $name}) RETURN c",
        { name: "T cell" },
      );
      expect(rows.length).toBe(1);
    });

    it("inserts a Pathway node", async () => {
      await client.insertNode("Pathway", {
        id: "hsa04612",
        name: "Antigen processing and presentation",
        source_db: "KEGG",
        category: "immune",
      });

      const rows = await client.query(
        "MATCH (p:Pathway {id: $id}) RETURN p",
        { id: "hsa04612" },
      );
      expect(rows.length).toBe(1);
    });
  });

  describe("insertNodes (batch)", () => {
    it("inserts multiple gene nodes at once", async () => {
      await client.insertNodes("Gene", [
        {
          symbol: "BRCA1",
          ensembl_id: "ENSG00000012048",
          full_name: "BRCA1 DNA repair associated",
          chromosome: "17",
          biotype: "protein_coding",
        },
        {
          symbol: "MYC",
          ensembl_id: "ENSG00000136997",
          full_name: "MYC proto-oncogene",
          chromosome: "8",
          biotype: "protein_coding",
        },
      ]);

      const rows = await client.query(
        "MATCH (g:Gene) WHERE g.symbol IN ['BRCA1', 'MYC'] RETURN g",
      );
      expect(rows.length).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Relationship operations
  // -----------------------------------------------------------------------

  describe("insertRel", () => {
    beforeAll(async () => {
      // Ensure both nodes exist
      await client.insertNode("Gene", {
        symbol: "CD3E",
        ensembl_id: "ENSG00000198851",
        full_name: "CD3 epsilon",
        chromosome: "11",
        biotype: "protein_coding",
      });
    });

    it("creates a relationship between two existing nodes", async () => {
      await client.insertRel("Gene", "CD3E", "CellType", "T cell", "MARKER_OF", {
        specificity: "canonical",
        source_db: "PanglaoDB",
      });

      const rows = await client.query(
        "MATCH (g:Gene {symbol: 'CD3E'})-[r:MARKER_OF]->(c:CellType {name: 'T cell'}) RETURN g, c, r",
      );
      expect(rows.length).toBe(1);
    });

    it("creates a PARTICIPATES_IN relationship", async () => {
      await client.insertRel("Gene", "TP53", "Pathway", "hsa04612", "PARTICIPATES_IN", {
        confidence: 0.9,
      });

      const rows = await client.query(
        "MATCH (g:Gene {symbol: 'TP53'})-[r:PARTICIPATES_IN]->(p:Pathway {id: 'hsa04612'}) RETURN g, p, r",
      );
      expect(rows.length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Convenience queries
  // -----------------------------------------------------------------------

  describe("getGenePathways", () => {
    it("returns pathways for a gene", async () => {
      const rows = await client.getGenePathways("TP53");
      expect(rows.length).toBeGreaterThanOrEqual(1);
      const pathway = rows[0]["p"] as Record<string, unknown>;
      expect(pathway.id).toBe("hsa04612");
    });
  });

  describe("getCellTypeMarkers", () => {
    it("returns markers for a cell type", async () => {
      const rows = await client.getCellTypeMarkers("T cell");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getDiseaseDrugs", () => {
    beforeAll(async () => {
      await client.insertNode("Disease", {
        id: "DOID:1612",
        name: "breast cancer",
        source: "DO",
        category: "cancer",
      });

      await client.insertNode("Drug", {
        name: "Trastuzumab",
        drugbank_id: "DB00072",
        type: "monoclonal antibody",
        approval_status: "approved",
      });

      await client.insertRel("Gene", "TP53", "Disease", "DOID:1612", "ASSOCIATED_WITH", {
        association_type: "causal",
        evidence: "genetic",
      });

      await client.insertRel("Drug", "Trastuzumab", "Gene", "TP53", "TARGETS", {
        mechanism: "antagonist",
      });
    });

    it("finds drugs targeting genes associated with a disease", async () => {
      const rows = await client.getDiseaseDrugs("DOID:1612");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Conflicts
  // -----------------------------------------------------------------------

  describe("detectConflicts", () => {
    it("detects no conflict when no contradictory edges exist", async () => {
      const conflicts = await client.detectConflicts({
        entity: "BRCA1",
        relation: "UPREGULATED_IN",
        target: "DOID:0000", // non-existent disease
      });
      expect(conflicts).toEqual([]);
    });

    it("detects conflict when opposing regulation edge exists", async () => {
      // First create a DOWNREGULATED_IN edge for MYC -> breast cancer
      await client.insertRel("Gene", "MYC", "Disease", "DOID:1612", "DOWNREGULATED_IN", {
        fold_change: -2.5,
      });

      const conflicts = await client.detectConflicts({
        entity: "MYC",
        relation: "UPREGULATED_IN",
        target: "DOID:1612",
      });
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].claim1).toContain("UPREGULATED_IN");
      expect(conflicts[0].claim2).toContain("DOWNREGULATED_IN");
    });
  });

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------

  describe("stats", () => {
    it("returns node and relationship counts", async () => {
      const stats = await client.stats();
      expect(stats.nodeCounts).toBeDefined();
      expect(stats.relCounts).toBeDefined();
      expect(typeof stats.nodeCounts.Gene).toBe("number");
      expect(stats.nodeCounts.Gene).toBeGreaterThanOrEqual(4); // TP53, BRCA1, MYC, CD3E
      expect(typeof stats.relCounts.PARTICIPATES_IN).toBe("number");
    });
  });

  // -----------------------------------------------------------------------
  // Multi-hop paths
  // -----------------------------------------------------------------------

  describe("findMultiHopPaths", () => {
    it("finds paths from gene to pathway", async () => {
      const paths = await client.findMultiHopPaths("TP53", "Gene", "Pathway", 2);
      expect(Array.isArray(paths)).toBeTruthy();
    });
  });
});
