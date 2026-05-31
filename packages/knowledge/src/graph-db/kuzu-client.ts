// ============================================================
// @bioagent/knowledge — KuzuDB Embedded Graph Client
// ============================================================

import kuzu, { type Database, type Connection, type QueryResult } from "kuzu";
import { readFileSync } from "node:fs";
import { NODE_TABLES, REL_TABLES, type NodeTableDef, type RelTableDef } from "./schema.js";
import { getLogger } from "../logger.js";

const logger = getLogger("kuzu-client");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KuzuClientOptions {
  dbPath?: string;
  /** 0 means use Kuzu default (CPU cores). */
  numThreads?: number;
}

export interface GraphPath {
  nodes: string[];
  edges: string[];
  length: number;
  confidence: number;
  explanation: string;
}

export interface KnowledgeConflict {
  entity1: string;
  entity2: string;
  claim1: string;
  claim2: string;
  source1: string;
  source2: string;
  resolution?: string;
}

export interface KuzuStats {
  nodeCounts: Record<string, number>;
  relCounts: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class KuzuClient {
  private db: Database;
  private conn: Connection;
  private initialized = false;
  private readonly dbPath: string;

  constructor(options: KuzuClientOptions = {}) {
    this.dbPath = options.dbPath ?? process.env.KUZU_DB_PATH ?? "./data/kuzu";
    this.db = new kuzu.Database(this.dbPath);
    this.conn = new kuzu.Connection(this.db, options.numThreads ?? 0);
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Initialise database, create all node & relationship tables if missing. */
  async initialize(): Promise<void> {
    await this.db.init();
    await this.conn.init();
    logger.info({ path: this.dbPath }, "KuzuDB connection opened");

    for (const node of NODE_TABLES) {
      await this.ensureNodeTable(node);
    }
    for (const rel of REL_TABLES) {
      await this.ensureRelTable(rel);
    }

    this.initialized = true;
    logger.info("KuzuDB schema initialised");
  }

  async close(): Promise<void> {
    await this.conn.close();
    await this.db.close();
    this.initialized = false;
    logger.info("KuzuDB connection closed");
  }

  // -----------------------------------------------------------------------
  // Node operations
  // -----------------------------------------------------------------------

  /** Insert a single node (MERGE on PK, SET all properties). */
  async insertNode(table: string, data: Record<string, unknown>): Promise<void> {
    const def = NODE_TABLES.find((n) => n.name === table);
    if (!def) throw new Error(`Unknown node table: ${table}`);

    const pk = def.primaryKey;
    const pkVal = data[pk];
    if (pkVal === undefined) throw new Error(`Missing primary key "${pk}" for ${table}`);

    // KuzuDB MERGE + SET uses individual property assignment
    const setClauses = Object.entries(data)
      .filter(([k]) => k !== pk) // PK already set in MERGE
      .map(([k, v]) => `n.${k} = ${this.serializeVal(v)}`)
      .join(", ");

    const cypher = `MERGE (n:${table} {${pk}: ${this.serializeVal(pkVal)}})${setClauses ? ` SET ${setClauses}` : ""}`;
    await this.query(cypher);
    logger.debug({ table, pk: pkVal }, "Node inserted");
  }

  /** Batch insert nodes. */
  async insertNodes(table: string, rows: Record<string, unknown>[]): Promise<void> {
    for (const row of rows) {
      await this.insertNode(table, row);
    }
    logger.info({ table, count: rows.length }, "Batch nodes inserted");
  }

  // -----------------------------------------------------------------------
  // Relationship operations
  // -----------------------------------------------------------------------

  /** Insert a single relationship edge. */
  async insertRel(
    fromTable: string,
    fromKey: unknown,
    toTable: string,
    toKey: unknown,
    relTable: string,
    props?: Record<string, unknown>,
  ): Promise<void> {
    const fromDef = NODE_TABLES.find((n) => n.name === fromTable);
    const toDef = NODE_TABLES.find((n) => n.name === toTable);
    if (!fromDef) throw new Error(`Unknown node table: ${fromTable}`);
    if (!toDef) throw new Error(`Unknown node table: ${toTable}`);

    const fromPk = fromDef.primaryKey;
    const toPk = toDef.primaryKey;

    const relProps = props
      ? ", " +
        Object.entries(props)
          .map(([k, v]) => `${k}: ${this.serializeVal(v)}`)
          .join(", ")
      : "";

    const cypher = `
      MATCH (a:${fromTable} {${fromPk}: ${this.serializeVal(fromKey)}})
      MATCH (b:${toTable} {${toPk}: ${this.serializeVal(toKey)}})
      MERGE (a)-[:${relTable}${relProps ? " {" + relProps.slice(2) + "}" : ""}]->(b)
    `;
    await this.query(cypher);
    logger.debug({ fromTable, toTable, relTable }, "Relation inserted");
  }

  // -----------------------------------------------------------------------
  // Query execution
  // -----------------------------------------------------------------------

  /** Execute a raw Cypher query. */
  async query(cypher: string, params?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    this.ensureInit();
    logger.debug({ cypher: cypher.trim().slice(0, 120) }, "Executing query");
    try {
      let result: QueryResult;
      if (params) {
        const stmt = await this.conn.prepare(cypher);
        result = (await this.conn.execute(stmt, params as Record<string, import("kuzu").KuzuValue>)) as QueryResult;
      } else {
        result = (await this.conn.query(cypher)) as QueryResult;
      }
      return result.getAll();
    } catch (err) {
      logger.error({ err, cypher: cypher.trim().slice(0, 200) }, "Query failed");
      throw err;
    }
  }

  // -----------------------------------------------------------------------
  // Convenience queries
  // -----------------------------------------------------------------------

  /** Get pathways a gene participates in. */
  async getGenePathways(geneSymbol: string): Promise<Record<string, unknown>[]> {
    return this.query(
      `MATCH (g:Gene {symbol: $symbol})-[:PARTICIPATES_IN]->(p:Pathway) RETURN p`,
      { symbol: geneSymbol },
    );
  }

  /** Get markers for a given cell type. */
  async getCellTypeMarkers(cellType: string): Promise<Record<string, unknown>[]> {
    return this.query(
      `MATCH (g:Gene)-[:MARKER_OF]->(c:CellType {name: $name}) RETURN g, c`,
      { name: cellType },
    );
  }

  /** Multi-hop traversal between entity types. */
  async findMultiHopPaths(
    startEntity: string,
    startType: string,
    endType: string,
    maxHops = 3,
  ): Promise<GraphPath[]> {
    // Build a variable-length path query
    const cypher = `
      MATCH path = (a:${startType} {symbol: $start})-[:PARTICIPATES_IN|ASSOCIATED_WITH|TARGETS|MARKER_OF|LOCATED_IN|INTERACTS_WITH|UPREGULATED_IN|DOWNREGULATED_IN|BETTER_THAN|CITES*1..${maxHops}]->(b:${endType})
      RETURN a, b, path
      LIMIT 20
    `;
    try {
      const rows = await this.query(cypher, { start: startEntity });
      return rows.map((row, idx) => {
        const b = (row["b"] as Record<string, unknown> | null) ?? {};
        const pathData = (row["path"] as Record<string, unknown> | null) ?? {};
        return {
          nodes: [startEntity, String(b._label ?? "?")],
          edges: [String((pathData as Record<string, unknown>)?.["length"] ?? 1)],
          length: 1,
          confidence: 0.5,
          explanation: `Multi-hop path #${idx + 1} from ${startEntity} to ${endType}`,
        };
      });
    } catch {
      return [];
    }
  }

  /** Get disease-associated drugs via gene targets. */
  async getDiseaseDrugs(diseaseId: string): Promise<Record<string, unknown>[]> {
    return this.query(
      `
      MATCH (d:Disease {id: $diseaseId})<-[:ASSOCIATED_WITH]-(g:Gene)<-[:TARGETS]-(drug:Drug)
      RETURN drug
      `,
      { diseaseId },
    );
  }

  // -----------------------------------------------------------------------
  // Bulk import
  // -----------------------------------------------------------------------

  /**
   * Import nodes from a CSV file.
   * CSV must have a header row matching the table's property names.
   */
  async batchInsertFromCSV(table: string, csvPath: string): Promise<void> {
    const def = NODE_TABLES.find((n) => n.name === table);
    if (!def) throw new Error(`Unknown node table: ${table}`);

    const content = readFileSync(csvPath, "utf-8");
    const lines = content.trim().split("\n");
    if (lines.length < 2) {
      logger.warn({ table, csvPath }, "CSV is empty or header-only");
      return;
    }

    const headers = lines[0].split(",").map((h) => h.trim());
    const rows: Record<string, unknown>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row: Record<string, unknown> = {};
      for (let j = 0; j < headers.length; j++) {
        const h = headers[j];
        const defProp = def.properties[h];
        const rawVal = values[j] ?? "";
        // coerce types based on schema
        if (defProp === "INT64" || defProp === "INT32") {
          row[h] = parseInt(rawVal, 10) || 0;
        } else if (defProp === "DOUBLE" || defProp === "FLOAT") {
          row[h] = parseFloat(rawVal) || 0.0;
        } else if (defProp === "BOOLEAN") {
          row[h] = rawVal.toLowerCase() === "true";
        } else {
          row[h] = rawVal;
        }
      }
      rows.push(row);
    }

    await this.insertNodes(table, rows);
    logger.info({ table, count: rows.length, csvPath }, "CSV batch import done");
  }

  // -----------------------------------------------------------------------
  // Conflict detection
  // -----------------------------------------------------------------------

  /**
   * Check whether a new claim conflicts with existing graph edges.
   * Returns a list of conflicts, if any.
   */
  async detectConflicts(newClaim: {
    entity: string;
    relation: string;
    target: string;
  }): Promise<KnowledgeConflict[]> {
    const conflicts: KnowledgeConflict[] = [];

    // Check for contradictory relationships (e.g., UPREGULATED_IN vs DOWNREGULATED_IN)
    if (newClaim.relation === "UPREGULATED_IN") {
      const rows = await this.query(
        `MATCH (g:Gene {symbol: $symbol})-[r:DOWNREGULATED_IN]->(d:Disease {id: $disease}) RETURN r`,
        { symbol: newClaim.entity, disease: newClaim.target },
      );
      if (rows.length > 0) {
        conflicts.push({
          entity1: newClaim.entity,
          entity2: newClaim.target,
          claim1: `UPREGULATED_IN ${newClaim.target}`,
          claim2: `DOWNREGULATED_IN ${newClaim.target}`,
          source1: "new claim",
          source2: "existing graph",
          resolution: "Review literature — contradictory regulation evidence exists",
        });
      }
    }

    if (newClaim.relation === "DOWNREGULATED_IN") {
      const rows = await this.query(
        `MATCH (g:Gene {symbol: $symbol})-[r:UPREGULATED_IN]->(d:Disease {id: $disease}) RETURN r`,
        { symbol: newClaim.entity, disease: newClaim.target },
      );
      if (rows.length > 0) {
        conflicts.push({
          entity1: newClaim.entity,
          entity2: newClaim.target,
          claim1: `DOWNREGULATED_IN ${newClaim.target}`,
          claim2: `UPREGULATED_IN ${newClaim.target}`,
          source1: "new claim",
          source2: "existing graph",
          resolution: "Review literature — contradictory regulation evidence exists",
        });
      }
    }

    return conflicts;
  }

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------

  async stats(): Promise<KuzuStats> {
    const nodeCounts: Record<string, number> = {};
    const relCounts: Record<string, number> = {};

    for (const node of NODE_TABLES) {
      try {
        const rows = await this.query(`MATCH (n:${node.name}) RETURN count(n) AS cnt`);
        nodeCounts[node.name] = Number(rows[0]?.cnt ?? 0);
      } catch {
        nodeCounts[node.name] = 0;
      }
    }

    for (const rel of REL_TABLES) {
      try {
        const rows = await this.query(
          `MATCH (:${rel.from})-[r:${rel.name}]->(:${rel.to}) RETURN count(r) AS cnt`,
        );
        relCounts[rel.name] = Number(rows[0]?.cnt ?? 0);
      } catch {
        relCounts[rel.name] = 0;
      }
    }

    return { nodeCounts, relCounts };
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private ensureInit(): void {
    if (!this.initialized) {
      throw new Error("KuzuClient not initialised — call initialize() first");
    }
  }

  private async ensureNodeTable(def: NodeTableDef): Promise<void> {
    const propDefs = Object.entries(def.properties)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    const cypher = `CREATE NODE TABLE IF NOT EXISTS ${def.name} (${propDefs}, PRIMARY KEY (${def.primaryKey}))`;
    try {
      await this.conn.query(cypher);
    } catch (err) {
      logger.warn({ err, table: def.name }, "Cannot create node table (may already exist)");
    }
  }

  private async ensureRelTable(def: RelTableDef): Promise<void> {
    const propDefs = Object.entries(def.properties)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    const propClause = propDefs ? `, ${propDefs}` : "";
    const cypher = `CREATE REL TABLE IF NOT EXISTS ${def.name} (FROM ${def.from} TO ${def.to}${propClause})`;
    try {
      await this.conn.query(cypher);
    } catch (err) {
      logger.warn({ err, table: def.name }, "Cannot create rel table (may already exist)");
    }
  }

  private serializeVal(v: unknown): string {
    if (typeof v === "string") {
      // Escape single quotes by doubling them
      return `'${v.replace(/'/g, "''")}'`;
    }
    if (typeof v === "number") {
      return String(v);
    }
    if (typeof v === "boolean") {
      return v ? "true" : "false";
    }
    if (v === null || v === undefined) {
      return "null";
    }
    // Fallback: stringify
    return `'${String(v).replace(/'/g, "''")}'`;
  }
}
