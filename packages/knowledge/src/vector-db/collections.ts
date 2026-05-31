// ============================================================
// @bioagent/knowledge — ChromaDB Collection Definitions
// ============================================================

export const COLLECTIONS = {
  literature_snippets: {
    name: "literature_snippets",
    metadata: [
      "source_type",
      "doi",
      "url",
      "title",
      "topic",
      "year",
      "tool",
      "omics_type",
    ],
    distance: "cosine" as const,
  },
  analysis_cases: {
    name: "analysis_cases",
    metadata: [
      "project_id",
      "omics_type",
      "tissue",
      "species",
      "cell_count",
      "success",
      "workflow_used",
      "created_at",
    ],
    distance: "cosine" as const,
  },
  debug_logs: {
    name: "debug_logs",
    metadata: [
      "error_type",
      "tool",
      "skill",
      "resolved",
      "resolution",
      "os",
      "docker_image",
    ],
    distance: "cosine" as const,
  },
} as const;

export type CollectionName = keyof typeof COLLECTIONS;
