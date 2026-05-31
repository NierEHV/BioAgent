// ============================================================
// @bioagent/agent-core — docker-search Tool
// ============================================================

import { z } from "zod";
import type { DockerExecutor } from "@bioagent/executor";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

export const dockerSearchToolSchema = z.object({
  query: z.string().min(1).max(200).describe("Search keyword (e.g. tool name like 'seurat')"),
  tool_name: z.string().optional().describe("Specific tool name for BioContainers search on quay.io"),
  min_stars: z.number().int().min(0).default(5).describe("Minimum star count filter"),
  max_results: z.number().int().min(1).max(100).default(20).describe("Maximum number of results"),
  include_official: z.boolean().default(true).describe("Include Docker official images"),
  include_biocontainers: z.boolean().default(true).describe("Include BioContainers community images"),
});

export type DockerSearchToolParams = z.infer<typeof dockerSearchToolSchema>;

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const dockerSearchToolDef = {
  name: "docker_search",
  description:
    "Search Docker Hub and Quay.io for bioinformatics Docker images. Returns images sorted by stars, with quality evaluations. Searches both Docker Hub and BioContainers on quay.io.",
  schema: dockerSearchToolSchema,
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function dockerSearchHandler(
  params: DockerSearchToolParams,
  executor: DockerExecutor,
): Promise<{
  dockerHubResults: unknown[];
  bioContainersResults: unknown[];
  evaluations: { name: string; verdict: string; reasons: string[] }[];
}> {
  const [dockerHubResults, bioContainersResults] = await Promise.all([
    executor.imageSearch.searchDockerHub({
      query: params.query,
      minStars: params.min_stars,
      limit: params.max_results,
      includeOfficial: params.include_official,
      includeBiocontainers: params.include_biocontainers,
    }),
    params.tool_name
      ? executor.imageSearch.searchBioContainers(params.tool_name)
      : Promise.resolve([]),
  ]);

  // Evaluate each result
  const evaluations = dockerHubResults.map((r) => {
    const evalResult = executor.imageSearch.evaluateImage(r);
    return {
      name: r.name,
      verdict: evalResult.verdict,
      reasons: evalResult.reasons,
    };
  });

  return {
    dockerHubResults,
    bioContainersResults,
    evaluations,
  };
}
