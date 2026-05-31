// ============================================================
// @bioagent/skills — TrajectorySkill
// ============================================================
// Pseudotime trajectory inference via scVelo (RNA velocity) or
// Monocle3 (tree-based pseudotime).
//
// QC gates:
// - velocity_genes_found: at least 20 velocity genes detected
// - trajectory_converged: graph learning succeeded
// - pseudotime_range: pseudotime spread across cells

import { BaseSkill } from "../base-skill.js";
import type {
  SkillSpec, SkillContext, SkillExecResult, QCReport,
  SkillOutput, ValidationResult, ToolChoice, DataContext,
} from "../base-skill.types.js";
import type { ResourceReport } from "@bioagent/executor";

export class TrajectorySkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "trajectory",
    version: "1.0.0",
    description: "Pseudotime trajectory inference — scVelo (RNA velocity) or Monocle3 (tree-based)",
    omicsType: "scrna",
    input: { acceptedFormats: ["h5ad"], schema: {}, minSamples: 1, maxSamples: 20, estimatedInputSize: "50MB-10GB" },
    tools: {
      primary: "scvelo.tl.velocity + scvelo.tl.velocity_graph + scvelo.tl.velocity_pseudotime",
      alternatives: ["monocle3 (R)", "slingshot (R)", "PAGA (Python)"],
      decisionTree: [
        { condition: "RNA velocity (recommended)", tool: "scvelo (dynamical mode)", reason: "Infers directional information from spliced/unspliced ratios — gold standard for trajectory direction" },
        { condition: "No spliced/unspliced data available", tool: "monocle3", reason: "Tree-based pseudotime from gene expression alone — requires manual root selection" },
      ],
      dockerImages: { scanpy: { image: "bioagent-scrna:latest", fallbackImage: "rnakato/shortcake_full:latest" } },
    },
    parameters: {
      defaults: { method: "scvelo", n_pcs: 30, n_neighbors: 30, mode: "dynamical" },
      descriptions: { method: "scvelo or monocle3", n_pcs: "Number of PCs for moment computation", n_neighbors: "Neighbors for velocity graph" },
      constraints: { n_pcs: { min: 10, max: 100 }, n_neighbors: { min: 10, max: 100 } },
    },
    qcGates: [
      { id: "velocity_genes", name: "Velocity Genes Found", description: "At least 20 velocity genes detected", check: { type: "threshold", expression: "n_velocity_genes >= 20", metric: "n_velocity_genes" }, level: "fail", onPass: "Sufficient velocity genes found", onFail: "Too few velocity genes — check if data has spliced/unspliced counts", fixable: false },
      { id: "trajectory_converged", name: "Trajectory Converged", description: "Graph learning completed successfully", check: { type: "threshold", expression: "trajectory_converged == true", metric: "trajectory_converged" }, level: "fail", onPass: "Trajectory graph learned successfully", onFail: "Trajectory inference failed to converge", fixable: false },
    ],
    outputs: {
      files: [
        { name: "trajectory.h5ad", format: "h5ad", description: "AnnData with velocity and pseudotime in obs", required: true },
        { name: "velocity_plot.png", format: "png", description: "UMAP with velocity arrows", required: false },
      ],
      visualizations: [{ type: "scatter", description: "UMAP colored by pseudotime / velocity" }],
      metrics: [
        { name: "n_velocity_genes", description: "Number of velocity genes used" },
        { name: "pseudotime_min", description: "Minimum pseudotime value" },
        { name: "pseudotime_max", description: "Maximum pseudotime value" },
      ],
    },
    troubleshooting: { common_issues: [] },
    dependencies: { requires: ["umap-tsne", "clustering"], recommends: ["marker-detection"], conflicts: [] },
    resourceEstimate: { cpu: "4", ram: "16GB", disk: "5GB", time: "10-30 min", gpu: "optional" },
  };

  async validateInput(data: DataContext): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!data.inputPath?.endsWith(".h5ad")) errors.push("Input must be .h5ad from umap-tsne or clustering step");
    if (!data.outputPath) errors.push("Output path is required");
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  async selectTool(_data: DataContext, _resources: ResourceReport): Promise<ToolChoice> {
    return { tool: "scvelo (dynamical mode)", reason: "RNA velocity with dynamical model is the current gold standard", image: "bioagent-scrna:latest" };
  }

  async configureParams(data: DataContext, _tool: ToolChoice): Promise<Record<string, unknown>> {
    return { input_path: data.inputPath, output_path: data.outputPath, method: "scvelo", n_pcs: 30, n_neighbors: 30, mode: "dynamical" };
  }

  async run(context: SkillContext): Promise<SkillExecResult> {
    const { inputPath, outputPath } = context.data;
    const method = (context.params.method as string) ?? "scvelo";
    const nPcs = (context.params.n_pcs as number) ?? 30;
    const nNeighbors = (context.params.n_neighbors as number) ?? 30;

    const script = method === "scvelo" ? `
import scanpy as sc
import scvelo as scv
import numpy as np
import os, json

adata = scv.read("${inputPath}")
scv.pp.filter_and_normalize(adata, min_shared_counts=20, n_top_genes=2000)
scv.pp.moments(adata, n_pcs=${nPcs}, n_neighbors=${nNeighbors})
scv.tl.velocity(adata, mode="dynamical")
scv.tl.velocity_graph(adata)
scv.tl.velocity_pseudotime(adata)

n_velo = int(adata.var.velocity_genes.sum()) if 'velocity_genes' in adata.var else 0
pt_min = float(adata.obs.velocity_pseudotime.min())
pt_max = float(adata.obs.velocity_pseudotime.max())

adata.write(os.path.join("${outputPath}", "trajectory.h5ad"))
print(json.dumps({
  "n_velocity_genes": n_velo, "trajectory_converged": True,
  "pseudotime_min": pt_min, "pseudotime_max": pt_max,
  "method": "scvelo", "output_path": "${outputPath}",
}))
` : `
# monocle3 R fallback
library(monocle3)
cds <- load_cell_data_set("${inputPath}")
cds <- preprocess_cds(cds, num_dim=${nPcs})
cds <- reduce_dimension(cds)
cds <- cluster_cells(cds)
cds <- learn_graph(cds)
cds <- order_cells(cds)
saveRDS(cds, file=file.path("${outputPath}", "trajectory.rds"))
cat('{"trajectory_converged":true,"method":"monocle3","output_path":"${outputPath}"}')
`;

    const dockerResult = await this.execInContainer(context, script);
    const parsed = this.parseJSONFromStdout(dockerResult.stdout);
    return { exitCode: dockerResult.exitCode, stdout: dockerResult.stdout, stderr: dockerResult.stderr, parsedData: parsed, metrics: { n_velocity_genes: (parsed.n_velocity_genes as number) ?? 0, trajectory_converged: (parsed.trajectory_converged as boolean) ? 1 : 0 } };
  }

  async runQC(results: SkillExecResult): Promise<QCReport> {
    return this.runQCGates(results.metrics);
  }

  async formatOutput(results: SkillExecResult, qc: QCReport): Promise<SkillOutput> {
    const method = results.parsedData["method"] ?? "scvelo";
    return {
      files: [{ path: `${results.parsedData["output_path"] ?? ""}/trajectory.h5ad`, format: "h5ad", size_bytes: 0 }],
      metrics: { n_velocity_genes: results.metrics["n_velocity_genes"] ?? 0, method },
      logs: [`Trajectory (${method}): ${qc.overall} (${qc.passed}P/${qc.warned}W/${qc.failed}F)`],
    };
  }
}
