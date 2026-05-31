// ============================================================
// @bioagent/knowledge — Seed Data Injector / Orchestrator
// ============================================================
//
// Usage: pnpm --filter @bioagent/knowledge seed
//
// 1. Initialise ChromaDB (3 collections)
// 2. Initialise KuzuDB (all Node + Rel tables)
// 3. Load all Wiki documents
// 4. Wiki chunks → embed → ChromaDB literature_snippets
// 5. Import CSV & hard-coded seed data → KuzuDB
// 6. Run verification queries
// ============================================================

import { ChromaClientWrapper } from "../vector-db/chroma-client";
import { KuzuClient } from "../graph-db/kuzu-client";
import { WikiLoader } from "../wiki/wiki-loader";
import {
  SCRNA_SEED_SOURCES,
  SEED_GENES,
  SEED_CELL_TYPES,
  SEED_PATHWAYS,
  SEED_TOOLS,
  LITERATURE_SNIPPETS,
} from "./scrna-seed";
import { COLLECTIONS } from "../vector-db/collections";
import { getLogger } from "../logger";

const logger = getLogger("seed-runner");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CHROMA_URL = process.env.CHROMA_URL ?? "http://localhost:8000";
const KUZU_DB_PATH = process.env.KUZU_DB_PATH ?? "./data/kuzu";
const WIKI_PATH = process.env.WIKI_PATH ?? "./data/wiki";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  logger.info("=== BioAgent Knowledge Seed Runner ===");

  // ---------- Step 1: Init ChromaDB ----------
  logger.info("Step 1: Initialising ChromaDB...");
  const chroma = new ChromaClientWrapper({ url: CHROMA_URL });
  try {
    await chroma.initialize();
  } catch (err) {
    logger.error({ err }, "ChromaDB init failed — is the server running?");
    logger.warn("Continuing without ChromaDB (seed data will be skipped for vector layer)");
  }

  // ---------- Step 2: Init KuzuDB ----------
  logger.info("Step 2: Initialising KuzuDB...");
  const kuzu = new KuzuClient({ dbPath: KUZU_DB_PATH });
  await kuzu.initialize();

  // ---------- Step 3: Load Wiki ----------
  logger.info("Step 3: Loading Wiki documents...");
  const wikiLoader = new WikiLoader(WIKI_PATH);
  await wikiLoader.loadIndex();
  logger.info({ count: wikiLoader.size() }, "Wiki documents loaded");

  // ---------- Step 4: Wiki chunks → ChromaDB ----------
  logger.info("Step 4: Indexing Wiki chunks to ChromaDB...");
  try {
    const wikiDocs = wikiLoader.getAllDocs();
    let chunkIdx = 0;

    for (const doc of wikiDocs) {
      // Split document into paragraphs (crude but effective chunking)
      const paragraphs = doc.content
        .split("\n\n")
        .filter((p) => p.trim().length > 50);

      const documents: string[] = [];
      const metadatas: Record<string, unknown>[] = [];
      const ids: string[] = [];

      for (const para of paragraphs) {
        documents.push(para.trim());
        metadatas.push({
          source_type: "wiki",
          title: doc.title,
          topic: doc.topic,
          url: doc.path,
          year: new Date(doc.updated).getFullYear(),
          omics_type: "scrna-seq",
        });
        ids.push(`wiki-${doc.topic.replace(/\./g, "-")}-${chunkIdx++}`);
      }

      if (documents.length > 0) {
        await chroma.add("literature_snippets", documents, metadatas, ids);
      }
    }

    // Also index hard-coded literature snippets
    {
      const docs = LITERATURE_SNIPPETS.map((s) => s.text);
      const metas = LITERATURE_SNIPPETS.map((s) => s.metadata);
      const ids = LITERATURE_SNIPPETS.map(
        (_, i) => `lit-seed-${i.toString().padStart(3, "0")}`,
      );

      await chroma.add("literature_snippets", docs, metas, ids);
    }

    logger.info("Wiki + literature chunks indexed to ChromaDB");
  } catch (err) {
    logger.warn({ err }, "ChromaDB indexing skipped (server may be unavailable)");
  }

  // ---------- Step 5: Graph seed data → KuzuDB ----------
  logger.info("Step 5: Seeding KuzuDB graph...");

  // 5a. Gene nodes
  logger.info("  - Inserting gene nodes...");
  await kuzu.insertNodes(
    "Gene",
    SEED_GENES.map((g) => ({ ...g }) as Record<string, unknown>),
  );

  // 5b. CellType nodes
  logger.info("  - Inserting cell type nodes...");
  await kuzu.insertNodes(
    "CellType",
    SEED_CELL_TYPES.map((ct) => ({ ...ct }) as Record<string, unknown>),
  );

  // 5c. Pathway nodes
  logger.info("  - Inserting pathway nodes...");
  await kuzu.insertNodes(
    "Pathway",
    SEED_PATHWAYS.map((p) => ({ ...p }) as Record<string, unknown>),
  );

  // 5d. Tool nodes
  logger.info("  - Inserting tool nodes...");
  await kuzu.insertNodes(
    "Tool",
    SEED_TOOLS.map((t) => ({ ...t }) as Record<string, unknown>),
  );

  // 5e. Marker relationships
  logger.info("  - Creating marker relationships...");
  const markerMap: [string, string][] = [
    ["PTPRC", "T cell"],
    ["CD3E", "T cell"],
    ["CD4", "CD4+ T cell"],
    ["CD8A", "CD8+ T cell"],
    ["CD19", "B cell"],
    ["MS4A1", "B cell"],
    ["NKG7", "NK cell"],
    ["CD14", "Monocyte"],
    ["FCGR3A", "Monocyte"],
    ["PPBP", "Neutrophil"],
    ["EPCAM", "Epithelial cell"],
    ["KRT18", "Epithelial cell"],
    ["COL1A1", "Fibroblast"],
    ["PECAM1", "Endothelial cell"],
    ["MKI67", "T cell"],
  ];

  for (const [gene, cellType] of markerMap) {
    try {
      await kuzu.insertRel("Gene", gene, "CellType", cellType, "MARKER_OF", {
        specificity: "canonical",
        source_db: "PanglaoDB",
      });
    } catch (err) {
      logger.debug({ gene, cellType, err }, "Marker rel skipped");
    }
  }

  // 5f. Gene-pathway relationships
  logger.info("  - Creating gene-pathway relationships...");
  const genePathwayMap: [string, string, number][] = [
    ["TP53", "hsa04110", 0.9],
    ["TP53", "hsa04210", 0.95],
    ["MYC", "hsa04110", 0.85],
    ["EGFR", "hsa04010", 0.95],
    ["EGFR", "hsa04151", 0.9],
    ["VEGFA", "hsa04151", 0.85],
    ["GAPDH", "hsa04010", 0.5],
  ];

  for (const [gene, pathway, confidence] of genePathwayMap) {
    try {
      await kuzu.insertRel(
        "Gene",
        gene,
        "Pathway",
        pathway,
        "PARTICIPATES_IN",
        { confidence },
      );
    } catch (err) {
      logger.debug({ gene, pathway, err }, "Gene-pathway rel skipped");
    }
  }

  // 5g. Tool-gene citations
  logger.info("  - Creating tool-gene citation relationships...");
  for (const gene of ["TP53", "EGFR", "MYC", "VEGFA"]) {
    try {
      await kuzu.insertRel("Tool", "Scanpy", "Gene", gene, "CITES", {
        doi: "10.1186/s13059-017-1382-0",
        year: 2018,
      });
    } catch (err) {
      logger.debug({ gene, err }, "Cite rel skipped");
    }
  }

  // ---------- Step 6: Verification ----------
  logger.info("Step 6: Running verification queries...");

  const stats = await kuzu.stats();
  logger.info({ nodeCounts: stats.nodeCounts, relCounts: stats.relCounts }, "KuzuDB stats");

  // Verify a gene pathway lookup
  const tp53Pathways = await kuzu.getGenePathways("TP53");
  logger.info({ count: tp53Pathways.length }, "TP53 pathways found");

  // Verify cell type markers
  const tCellMarkers = await kuzu.getCellTypeMarkers("T cell");
  logger.info({ count: tCellMarkers.length }, "T cell markers found");

  // Verify wiki search
  const qcDocs = wikiLoader.search("QC quality control");
  logger.info({ count: qcDocs.length }, "QC-related wiki docs found");

  // Verify ChromaDB counts (may fail if server not running)
  try {
    for (const colName of Object.keys(COLLECTIONS)) {
      const cnt = await chroma.count(colName as keyof typeof COLLECTIONS);
      logger.info({ collection: colName, count: cnt }, "ChromaDB collection count");
    }
  } catch (err) {
    logger.warn({ err }, "ChromaDB verification skipped");
  }

  // Cleanup
  await kuzu.close();
  logger.info("=== Seed completed successfully ===");
}

main().catch((err) => {
  logger.error({ err }, "Seed runner failed");
  process.exit(1);
});
