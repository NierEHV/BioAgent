// ============================================================
// @bioagent/knowledge — Graph Seed Data Loader
// ============================================================
// Loads seed data from CSV files into KuzuDB knowledge graph.

import * as fs from "node:fs";
import * as path from "node:path";
import type { KuzuClient } from "./kuzu-client";

export interface SeedDataSource {
  genes?: string;
  pathways?: string;
  cellMarkers?: string;
  relations?: string;
}

export interface SeedResult {
  genesInserted: number;
  pathwaysInserted: number;
  markersInserted: number;
  relationsInserted: number;
  errors: string[];
}

/**
 * Seed the graph database from CSV files in the data directory.
 * Uses MERGE to avoid duplicate nodes on re-seeding.
 */
export async function seedGraphFromCSV(
  client: KuzuClient,
  dataDir: string,
  sources: SeedDataSource = {},
): Promise<SeedResult> {
  const result: SeedResult = {
    genesInserted: 0,
    pathwaysInserted: 0,
    markersInserted: 0,
    relationsInserted: 0,
    errors: [],
  };

  // --- Seed Genes ---
  if (sources.genes) {
    try {
      const csv = readCSV(path.join(dataDir, sources.genes));
      for (const row of csv) {
        await client.query(
          `MERGE (g:Gene {symbol: $symbol}) SET g.name = $name, g.ensembl_id = $ensembl_id`,
          { symbol: row.symbol, name: row.name, ensembl_id: row.ensembl_id || "" },
        );
        result.genesInserted++;
      }
    } catch (err: any) {
      result.errors.push(`genes: ${err.message}`);
    }
  }

  // --- Seed Pathways ---
  if (sources.pathways) {
    try {
      const csv = readCSV(path.join(dataDir, sources.pathways));
      for (const row of csv) {
        await client.query(
          `MERGE (p:Pathway {id: $id}) SET p.name = $name`,
          { id: row.id, name: row.name },
        );
        result.pathwaysInserted++;
      }
    } catch (err: any) {
      result.errors.push(`pathways: ${err.message}`);
    }
  }

  // --- Seed Cell Markers ---
  if (sources.cellMarkers) {
    try {
      const csv = readCSV(path.join(dataDir, sources.cellMarkers));
      for (const row of csv) {
        await client.query(
          `MERGE (c:CellType {name: $cell_type})
           MERGE (m:Marker {gene_symbol: $gene_symbol})
           MERGE (m)-[:MARKER_OF {specificity: $specificity}]->(c)`,
          {
            cell_type: row.cell_type,
            gene_symbol: row.gene_symbol,
            specificity: row.specificity || "",
          },
        );
        result.markersInserted++;
      }
    } catch (err: any) {
      result.errors.push(`cellMarkers: ${err.message}`);
    }
  }

  // --- Seed Relations ---
  if (sources.relations) {
    try {
      const csv = readCSV(path.join(dataDir, sources.relations));
      for (const row of csv) {
        const relType = row.rel_type || "ASSOCIATED_WITH";
        try {
          await client.query(
            `MATCH (a {name: $from_name})
             MATCH (b {name: $to_name})
             MERGE (a)-[:${relType}]->(b)`,
            { from_name: row.from_name, to_name: row.to_name },
          );
          result.relationsInserted++;
        } catch {
          // skip relations where nodes don't exist (yet)
        }
      }
    } catch (err: any) {
      result.errors.push(`relations: ${err.message}`);
    }
  }

  return result;
}

/** Simple CSV parser — no external dependencies */
function readCSV(filePath: string): Array<Record<string, string>> {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || ""]));
  });
}
