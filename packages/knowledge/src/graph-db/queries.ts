// ============================================================
// @bioagent/knowledge — Graph Query Templates (Cypher)
// ============================================================
// Pre-built Cypher queries for the KuzuDB knowledge graph.
// Schema: Gene, Pathway, Disease, Drug, CellType, Tool, Tissue, GO_Term, Marker
// Relations: PARTICIPATES_IN, ASSOCIATED_WITH, TARGETS, MARKER_OF,
//            LOCATED_IN, INTERACTS_WITH, UPREGULATED_IN, DOWNREGULATED_IN,
//            BETTER_THAN, CITES, HAS_GO_TERM

export const QUERIES = {
  /** Find all genes participating in a given pathway */
  genesByPathway: `MATCH (g:Gene)-[:PARTICIPATES_IN]->(p:Pathway {name: $pathway_name}) RETURN g.name, g.symbol`,

  /** Find all pathways a gene participates in */
  pathwaysByGene: `MATCH (g:Gene {symbol: $symbol})-[:PARTICIPATES_IN]->(p:Pathway) RETURN p.name, p.id`,

  /** Find diseases associated with a gene */
  diseasesByGene: `MATCH (g:Gene {symbol: $symbol})-[:ASSOCIATED_WITH]->(d:Disease) RETURN d.name, d.id`,

  /** Find drugs targeting a gene */
  drugsByGene: `MATCH (d:Drug)-[:TARGETS]->(g:Gene {symbol: $symbol}) RETURN d.name, d.id`,

  /** Find markers for a given cell type */
  markersByCellType: `MATCH (m:Marker)-[:MARKER_OF]->(c:CellType {name: $cell_type}) RETURN m.gene_symbol, m.specificity`,

  /** Find all cell types where a gene is a known marker */
  cellTypesByMarker: `MATCH (m:Marker {gene_symbol: $symbol})-[:MARKER_OF]->(c:CellType) RETURN c.name, m.specificity`,

  /** Find tissues where a cell type is located */
  tissuesByCellType: `MATCH (c:CellType {name: $name})-[:LOCATED_IN]->(t:Tissue) RETURN t.name`,

  /** Find genes that interact with a given gene */
  geneInteractions: `MATCH (g1:Gene {symbol: $symbol})-[:INTERACTS_WITH]->(g2:Gene) RETURN g2.symbol, g2.name`,

  /** Find GO terms for a gene */
  goTermsByGene: `MATCH (g:Gene {symbol: $symbol})-[:HAS_GO_TERM]->(go:GO_Term) RETURN go.id, go.name, go.namespace`,

  /** Find tools that are better than a given tool for some task */
  betterTools: `MATCH (t1:Tool {name: $tool_name})-[:BETTER_THAN]->(t2:Tool) RETURN t2.name, t2.category`,

  /** Full-text-like search across all node labels */
  searchAll: `MATCH (n) WHERE n.name CONTAINS $query OR n.symbol CONTAINS $query RETURN DISTINCT n, labels(n) as labels`,

  /** Genes upregulated in a disease */
  upregulatedInDisease: `MATCH (g:Gene)-[:UPREGULATED_IN]->(d:Disease {name: $disease}) RETURN g.symbol, g.name`,

  /** Genes downregulated in a disease */
  downregulatedInDisease: `MATCH (g:Gene)-[:DOWNREGULATED_IN]->(d:Disease {name: $disease}) RETURN g.symbol, g.name`,

  /** Tools that cite a specific reference/paper */
  toolsCiting: `MATCH (t:Tool)-[:CITES]->(r {title: $paper}) RETURN t.name`,

  /** Count nodes by label */
  nodeCounts: `MATCH (n) RETURN labels(n) as label, count(*) as cnt`,

  /** Find all relationships between two nodes */
  pathBetween: `MATCH path = (a {name: $from})-[*1..3]-(b {name: $to}) RETURN path LIMIT 10`,
} as const;

export type QueryName = keyof typeof QUERIES;

/** Parameterized graph query */
export interface GraphQuery {
  name: QueryName;
  params: Record<string, string | number>;
}
