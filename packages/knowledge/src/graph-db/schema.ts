// ============================================================
// @bioagent/knowledge — KuzuDB Graph Schema Definitions
// ============================================================

export interface NodeTableDef {
  name: string;
  properties: Record<string, string>;
  primaryKey: string;
}

export interface RelTableDef {
  name: string;
  from: string;
  to: string;
  properties: Record<string, string>;
}

/** 9 node tables */
export const NODE_TABLES: NodeTableDef[] = [
  {
    name: "Gene",
    primaryKey: "symbol",
    properties: {
      symbol: "STRING",
      ensembl_id: "STRING",
      full_name: "STRING",
      chromosome: "STRING",
      biotype: "STRING",
    },
  },
  {
    name: "Pathway",
    primaryKey: "id",
    properties: {
      id: "STRING",
      name: "STRING",
      source_db: "STRING",
      category: "STRING",
    },
  },
  {
    name: "Disease",
    primaryKey: "id",
    properties: {
      id: "STRING",
      name: "STRING",
      source: "STRING",
      category: "STRING",
    },
  },
  {
    name: "Drug",
    primaryKey: "name",
    properties: {
      name: "STRING",
      drugbank_id: "STRING",
      type: "STRING",
      approval_status: "STRING",
    },
  },
  {
    name: "CellType",
    primaryKey: "name",
    properties: {
      name: "STRING",
      ontology_id: "STRING",
      category: "STRING",
      species: "STRING",
    },
  },
  {
    name: "Tool",
    primaryKey: "name",
    properties: {
      name: "STRING",
      version: "STRING",
      language: "STRING",
      category: "STRING",
      docker_image: "STRING",
    },
  },
  {
    name: "Tissue",
    primaryKey: "name",
    properties: {
      name: "STRING",
      uberon_id: "STRING",
    },
  },
  {
    name: "GO_Term",
    primaryKey: "id",
    properties: {
      id: "STRING",
      name: "STRING",
      namespace: "STRING",
    },
  },
  {
    name: "Marker",
    primaryKey: "gene_symbol",
    properties: {
      gene_symbol: "STRING",
      cell_type: "STRING",
      specificity: "STRING",
      source_db: "STRING",
      evidence: "STRING",
    },
  },
];

/** 10 relationship tables */
export const REL_TABLES: RelTableDef[] = [
  {
    name: "PARTICIPATES_IN",
    from: "Gene",
    to: "Pathway",
    properties: { confidence: "DOUBLE" },
  },
  {
    name: "ASSOCIATED_WITH",
    from: "Gene",
    to: "Disease",
    properties: {
      association_type: "STRING",
      evidence: "STRING",
      pmid: "STRING",
    },
  },
  {
    name: "TARGETS",
    from: "Drug",
    to: "Gene",
    properties: {
      mechanism: "STRING",
      affinity: "STRING",
    },
  },
  {
    name: "MARKER_OF",
    from: "Gene",
    to: "CellType",
    properties: {
      specificity: "STRING",
      source_db: "STRING",
    },
  },
  {
    name: "LOCATED_IN",
    from: "CellType",
    to: "Tissue",
    properties: { frequency: "STRING" },
  },
  {
    name: "INTERACTS_WITH",
    from: "Gene",
    to: "Gene",
    properties: {
      interaction_type: "STRING",
      source_db: "STRING",
      score: "DOUBLE",
    },
  },
  {
    name: "UPREGULATED_IN",
    from: "Gene",
    to: "Disease",
    properties: {
      fold_change: "DOUBLE",
      pmid: "STRING",
    },
  },
  {
    name: "DOWNREGULATED_IN",
    from: "Gene",
    to: "Disease",
    properties: {
      fold_change: "DOUBLE",
      pmid: "STRING",
    },
  },
  {
    name: "BETTER_THAN",
    from: "Tool",
    to: "Tool",
    properties: {
      benchmark: "STRING",
      metric: "STRING",
      margin: "STRING",
    },
  },
  {
    name: "CITES",
    from: "Tool",
    to: "Gene",
    properties: {
      doi: "STRING",
      year: "INT64",
    },
  },
];
