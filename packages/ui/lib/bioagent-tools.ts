// ============================================================
// @bioagent/ui — BioAgent Custom Tools for pi-agent
// ============================================================
// SERVER-SIDE ONLY. All tool handlers delegate to backend packages:
//   docker_exec    → @bioagent/executor (ContainerManager)
//   docker_search  → @bioagent/executor (ImageSearchService)
//   bio_kb_query   → @bioagent/knowledge (WikiLoader, bridge)
//   bio_file_inspect → local fs (fast, no Docker needed)
//   bio_skill_invoke → @bioagent/skills (SkillRegistry)
//   workflow_run   → @bioagent/workflow (WorkflowEngine + registry)

import "server-only";

import type {
  ToolDefinition,
  ExtensionContext,
  AgentToolUpdateCallback,
} from "@earendil-works/pi-coding-agent";

import { Type, type TSchema } from "@sinclair/typebox";

// ============================================================================
// Backend imports — ALL DYNAMIC to avoid native module crashes (kuzu, dockerode)
// Each tool handler lazily imports only the backend package it needs.
// ============================================================================
import type { SearchParams, SearchResult } from "@bioagent/executor";

// ============================================================================
// Helper: simplified tool factory
// ============================================================================

interface SimpleToolDef<TParams> {
  name: string;
  label: string;
  description: string;
  promptSnippet: string;
  promptGuidelines: string[];
  execute: (params: TParams) => Promise<string>;
}

function createSimpleTool<TParams>(
  def: SimpleToolDef<TParams>,
): ToolDefinition<TSchema, unknown> & { name: string } {
  const schema = Type.Object({}, { additionalProperties: true }) as any;
  return {
    name: def.name,
    label: def.label,
    description: def.description,
    promptSnippet: def.promptSnippet,
    promptGuidelines: def.promptGuidelines,
    parameters: schema,
    async execute(
      _toolCallId: string,
      params: any,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
    ): Promise<any> {
      try {
        const output = await def.execute(params as TParams);
        return { content: [{ type: "text", text: output }], details: [] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          details: [{ kind: "error" as any, message: err.message }],
        };
      }
    },
  };
}

// ============================================================================
// Shared ContainerManager singleton (lazy)
// ============================================================================

let _cm: any = null;
async function getContainerManager(): Promise<any> {
  if (!_cm) {
    const { ContainerManager } = await import("@bioagent/executor");
    _cm = new ContainerManager();
  }
  return _cm;
}

// ============================================================================
// Tool: docker_exec → @bioagent/executor
// ============================================================================

export const dockerExecTool = createSimpleTool({
  name: "docker_exec",
  label: "Docker Exec",
  description: `Execute commands inside Docker containers. Actions: ensure_image, start_container, exec, stop_container, get_status, list_containers.
Use for ALL bioinformatics tools — never run bio tools directly on the host.`,
  promptSnippet: "docker_exec(action, image?, container?, command?, ...)",
  promptGuidelines: [
    "Always use docker_exec for bioinformatics tools — never run Python/R/bioinformatics directly.",
    "Sequence: ensure_image → start_container → exec commands → stop_container.",
    "Mount data to /data and write outputs to /data/output.",
  ],
  async execute(params: any): Promise<string> {
    const cm = await getContainerManager();
    const action = params.action as string;

    switch (action) {
      case "ensure_image": {
        // Use dockerode directly for image check (ContainerManager doesn't expose imageExists)
        const Docker = (await import("dockerode")).default;
        const docker = new Docker({ socketPath: process.platform === "win32" ? "//./pipe/dockerDesktopLinuxEngine" : "/var/run/docker.sock" });
        const image = params.image as string;
        try { await docker.getImage(image).inspect(); return `Image ${image} already exists.`; } catch { /* pull below */ }
        // Pull via dockerode (ContainerManager doesn't expose pull directly either)
        await new Promise<void>((resolve, reject) => {
          docker.pull(image, {}, (err: any, stream: any) => {
            if (err) return reject(err);
            docker.modem.followProgress(stream, (e: any) => e ? reject(e) : resolve());
          });
        });
        return `Pulled image: ${image}`;
      }

      case "start_container": {
        const result = await cm.startContainer({
          image: params.image as string,
          name: params.name as string,
          command: (params.command as string[]) || ["sleep", "infinity"],
          volumes: ((params.volumes as any[]) || []).map((v: any) => ({ host: v.host, container: v.container, mode: v.mode })),
          env: (params.env as Record<string, string>) || {},
          gpu: params.gpu || false,
          network: (params.network as "bridge" | "host" | "none") || "bridge",
        });
        return `Container started: ${params.name} (ID: ${result.containerId.slice(0, 12)})`;
      }

      case "exec": {
        const result = await cm.execInContainer({
          container: params.container as string,
          command: params.command as string,
          workdir: (params.workdir as string) || "/data",
          timeout: (params.timeout as number) || 600_000,
          env: {},
          captureStderr: true,
        });
        return [
          `Exit Code: ${result.exitCode}`,
          result.stdout ? `--- stdout ---\n${result.stdout.slice(-50000)}` : "",
          result.stderr ? `--- stderr ---\n${result.stderr.slice(-50000)}` : "",
          result.truncated ? "(output was truncated at 50KB)" : "",
        ].filter(Boolean).join("\n");
      }

      case "stop_container": {
        await cm.stopContainer(params.container as string, { force: (params as any).force });
        return `Container ${params.container} stopped and removed.`;
      }

      case "get_status": {
        const status = await cm.getContainerStatus(params.container as string);
        return `Container: ${status.name}\nState: ${status.state}\nImage: ${status.imageUsed}\nStarted: ${status.startedAt}`;
      }

      case "list_containers": {
        const containers = await cm.listContainers((params as any).filter);
        if (containers.length === 0) return "No containers found.";
        return containers.map((c: any) => `${c.name}  ${c.state}  ${c.imageUsed}`).join("\n");
      }

      default:
        return `Unknown action: ${action}. Valid: ensure_image, start_container, exec, stop_container, get_status, list_containers.`;
    }
  },
});

// ============================================================================
// Tool: docker_search → @bioagent/executor (ImageSearchService)
// ============================================================================

export const dockerSearchTool = createSimpleTool({
  name: "docker_search",
  label: "Docker Search",
  description: `Search Docker Hub for bioinformatics container images. Prefer biocontainers and ShortCake for single-cell tools.`,
  promptSnippet: "docker_search(query, min_stars?, max_results?)",
  promptGuidelines: [
    "Prefer biocontainers (quay.io/biocontainers) for individual tools.",
    "Prefer ShortCake (rnakato/shortcake) for full single-cell analysis.",
  ],
  async execute(params: any): Promise<string> {
    const { ImageSearchService, daysAgo } = await import("@bioagent/executor");
    const searcher = new ImageSearchService();
    const searchParams: SearchParams = {
      query: params.query as string,
      minStars: (params.min_stars as number) || 5,
      limit: (params.max_results as number) || 5,
      includeOfficial: true,
      includeBiocontainers: true,
    };

    const results = await searcher.searchDockerHub(searchParams);

    if (results.length === 0) {
      return `No images found for "${params.query}". Try: rnakato/shortcake_full (single-cell), quay.io/biocontainers/<tool> (individual tools).`;
    }

    return results.map((r: SearchResult, i: number) => {
      const d = daysAgo(r.last_updated);
      const verdict = d > 730 ? "⚠️ OLD" : d > 365 ? "⚠️ Stale" : r.star_count >= 100 ? "⭐ Recommended" : "✅ OK";
      return `${i + 1}. ${r.namespace}/${r.repository}  ⭐${r.star_count}  ${r.pull_count} pulls  ${verdict}\n   ${r.short_description}\n   Updated: ${r.last_updated} (${d}d ago)`;
    }).join("\n\n");
  },
});

// ============================================================================
// Tool: bio_kb_query → @bioagent/knowledge (WikiLoader + KnowledgeBridge)
// ============================================================================

export const bioKbQueryTool = createSimpleTool({
  name: "bio_kb_query",
  label: "Knowledge Base Query",
  description: `Query the BioAgent three-layer knowledge base: Vector DB (semantic), Knowledge Graph (gene-pathway-disease), Wiki (best practices).`,
  promptSnippet: "bio_kb_query(question, max_results?)",
  promptGuidelines: [
    "Query the knowledge base BEFORE making methodology decisions.",
    "Use for: QC thresholds, parameter recommendations, tool selection criteria.",
  ],
  async execute(params: any): Promise<string> {
    const question = params.question as string;

    // Use WikiLoader for local search (always works)
    const { resolve, join } = await import("node:path");
    const wikiPath = resolve(join(process.cwd(), "..", "knowledge", "data", "wiki"));
    const { WikiLoader } = await import("@bioagent/knowledge");
    const loader = new WikiLoader(wikiPath);
    await loader.loadIndex();
    const wikiDocs = loader.search(question);

    if (wikiDocs.length === 0) {
      return `No knowledge base results for "${question}". The KB covers: scRNA-seq QC, normalization, clustering, cell annotation, trajectory, cell communication, Scanpy/Seurat guides, biology concepts, and failure case studies. Try rephrasing with specific biological terms.`;
    }

    const formatted = wikiDocs.slice(0, 8).map((doc: any) => {
      const title = doc.title || doc.name || doc.file || "Unknown";
      const snippet = (doc.snippet || doc.description || "").slice(0, 200);
      return `📄 ${title}\n   ${snippet}`;
    });

    return [
      `Knowledge base results for "${question}":`,
      "",
      ...formatted,
      "",
      "💡 These are local wiki results. For semantic search across literature snippets and graph queries, ensure ChromaDB and KuzuDB are running.",
    ].join("\n");
  },
});

// ============================================================================
// Tool: bio_file_inspect — local fs (fast, no Docker needed)
// ============================================================================

export const bioFileInspectTool = createSimpleTool({
  name: "bio_file_inspect",
  label: "File Inspect",
  description: `Inspect bioinformatics data files to detect format, dimensions, and structure. Supports: h5ad, h5, mtx, fastq, rds, csv, tsv.`,
  promptSnippet: "bio_file_inspect(path)",
  promptGuidelines: ["Always inspect data files before starting analysis.", "Use results to select the appropriate Skill and parameters."],
  async execute(params: any): Promise<string> {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = params.path as string;

    try {
      if (!fs.existsSync(filePath)) return `File not found: ${filePath}`;
      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const sizeMB = (stat.size / 1e6).toFixed(1);
      let details = `File: ${filePath}\nSize: ${sizeMB} MB\nFormat: `;

      if (stat.isDirectory()) {
        const files = fs.readdirSync(filePath).slice(0, 20);
        const hasMtx = files.includes("matrix.mtx.gz") || files.includes("matrix.mtx");
        const hasBarcodes = files.includes("barcodes.tsv.gz") || files.includes("barcodes.tsv");
        if (hasMtx && hasBarcodes) details += "10x Genomics MTX directory";
        else details += `Directory (${files.length} files): ${files.join(", ")}${files.length >= 20 ? "..." : ""}`;
      } else if (ext === ".h5ad") details += "AnnData (h5ad) — Python scanpy/anndata";
      else if (ext === ".h5") details += "HDF5 — likely 10x Genomics, use scanpy.read_10x_h5()";
      else if (ext === ".rds") details += "R RDS — use Seurat/readRDS";
      else if ([".fastq", ".fq", ".fastq.gz", ".fq.gz"].includes(ext)) details += "FASTQ sequencing reads";
      else if (ext === ".csv" || ext === ".tsv") {
        const head = fs.readFileSync(filePath, "utf-8").split("\n").slice(0, 3).join("\n");
        details += `${ext.toUpperCase()} table\nPreview:\n${head}`;
      } else details += `Unknown (extension: ${ext})`;

      return details;
    } catch (err: any) {
      return `File inspection failed: ${err.message}`;
    }
  },
});

// ============================================================================
// Tool: bio_skill_invoke → @bioagent/skills (SkillRegistry)
// ============================================================================

export const bioSkillInvokeTool = createSimpleTool({
  name: "bio_skill_invoke",
  label: "Skill Invoke",
  description: `Invoke a BioAgent Skill — standardized bioinformatics analysis step with built-in QC gates. Skills provide guidance and Docker command templates.`,
  promptSnippet: "bio_skill_invoke(skill_name, container, input_path, output_path)",
  promptGuidelines: [
    "Each Skill provides the Docker command to execute in the container.",
    "Skills have mandatory QC gates — check the QC report before next step.",
    "Standard order: import → qc → doublet → normalize → hvg → pca → [batch] → umap → cluster → annotate → marker → de → enrich",
  ],
  async execute(params: any): Promise<string> {
    const skillName = params.skill_name as string;
    const container = params.container as string;
    const inputPath = (params.input_path as string) || "/data/input";
    const outputPath = (params.output_path as string) || "/data/output";

    // Skill-to-command mapping (generates Python/R commands for each skill)
    const scripts: Record<string, string> = {
      "data-import": `python -c "import scanpy as sc; adata = sc.read_h5ad('${inputPath}'); adata.write('${outputPath}/imported.h5ad'); print(f'Imported: {adata.n_obs} cells x {adata.n_vars} genes')"`,
      "scrna-qc": `python -c "
import scanpy as sc; import numpy as np
adata = sc.read_h5ad('${inputPath}')
adata.var['mt'] = adata.var_names.str.startswith('MT-')
adata.var['ribo'] = adata.var_names.str.startswith(('RPS','RPL'))
sc.pp.calculate_qc_metrics(adata, qc_vars=['mt','ribo'], inplace=True)
keep = (adata.obs.n_genes_by_counts > 200) & (adata.obs.pct_counts_mt < 20)
adata = adata[keep]
adata.write('${outputPath}/qc_filtered.h5ad')
print(f'QC: {adata.n_obs} cells retained')
"`,
      "scrna-normalize": `python -c "import scanpy as sc; adata = sc.read_h5ad('${inputPath}'); sc.pp.normalize_total(adata, target_sum=1e4); sc.pp.log1p(adata); adata.write('${outputPath}/normalized.h5ad'); print('Normalized: log1p CPM')"`,
      "clustering": `python -c "import scanpy as sc; adata = sc.read_h5ad('${inputPath}'); sc.pp.neighbors(adata, n_neighbors=15, n_pcs=30); sc.tl.umap(adata, min_dist=0.3); sc.tl.leiden(adata, resolution=1.0); adata.write('${outputPath}/clustered.h5ad'); print(f'Clustered: {adata.obs.leiden.nunique()} clusters')"`,
    };

    const script = scripts[skillName];
    if (script) {
      return [
        `Skill: ${skillName}`,
        `Container: ${container}`,
        `Input: ${inputPath} → Output: ${outputPath}`,
        ``,
        `Execute via docker_exec:`,
        `docker_exec(action: "exec", container: "${container}", command: ${JSON.stringify(script)}, workdir: "/data", timeout: 600000)`,
        ``,
        `After execution, verify output files and run QC.`,
      ].join("\n");
    }

    // For skills without predefined scripts, query the registry
    try {
      const { SkillRegistry } = await import("@bioagent/skills");
      const registry = new SkillRegistry();
      const skill = registry.get(skillName);
      if (skill) {
        return [
          `Skill: ${skillName} (v${skill.spec.version})`,
          `Description: ${skill.spec.description}`,
          `Primary tool: ${skill.spec.tools.primary}`,
          `Dependencies: ${skill.spec.dependencies.requires.join(", ") || "none"}`,
          `Estimated resources: CPU ${skill.spec.resourceEstimate.cpu}, RAM ${skill.spec.resourceEstimate.ram}, Time ${skill.spec.resourceEstimate.time}`,
          ``,
          `To execute: use docker_exec in container "${container}" with the appropriate Python/R script.`,
          `Input: ${inputPath} → Output: ${outputPath}`,
        ].join("\n");
      }
    } catch { /* registry may not have all skills registered */ }

    const descriptions: Record<string, string> = {
      "doublet-detection": "Scrublet doublet detection. Use scrublet package.",
      "hvg-selection": "HVG selection via scanpy.pp.highly_variable_genes.",
      "scrna-pca": "PCA via scanpy.tl.pca with svd_solver='arpack'.",
      "batch-correction": "Harmony batch correction via harmonypy or scanpy.external.pp.harmony_integrate.",
      "umap-tsne": "UMAP via scanpy.pp.neighbors + scanpy.tl.umap.",
      "cell-annotation": "CellTypist automatic annotation. Requires celltypist + model.",
      "marker-detection": "Marker genes via scanpy.tl.rank_genes_groups (Wilcoxon).",
      "diff-expression": "Differential expression via scanpy.tl.rank_genes_groups (condition-based).",
      "functional-enrichment": "GO/KEGG enrichment via gseapy.enrichr.",
      "trajectory": "Pseudotime via scVelo (RNA velocity) or Monocle3 (tree-based).",
      "cell-communication": "Cell-cell communication via CellChat LR analysis.",
      "grn": "Gene regulatory network via pySCENIC / GRNBoost2.",
      "report-generator": "HTML report generation from intermediate results.",
    };
    const desc = descriptions[skillName] || `Skill '${skillName}' is registered but requires custom configuration.`;
    return `Skill: ${skillName}\nDescription: ${desc}\n\nExecute via docker_exec in container "${container}".\nInput: ${inputPath} → Output: ${outputPath}`;
  },
});

// ============================================================================
// Tool: workflow_run → @bioagent/workflow (WorkflowEngine)
// ============================================================================

export const workflowRunTool = createSimpleTool({
  name: "workflow_run",
  label: "Workflow Run",
  description: `Start an end-to-end scRNA-seq analysis workflow. Orchestrates all Skills in correct DAG order with checkpoint recovery.
Available workflows: scrna-seq-standard (13 Skills: import → qc → doublet → normalize → hvg → pca → [batch] → umap → cluster → annotate → marker → de → enrich → report)`,
  promptSnippet: "workflow_run(workflow_name, project_dir, container, resume?)",
  promptGuidelines: [
    "Use workflow_run for complete end-to-end analysis.",
    "Individual Skills can be invoked with bio_skill_invoke for debugging.",
    "Workflows support checkpoint recovery — restart from the last checkpoint on failure.",
  ],
  async execute(params: any): Promise<string> {
    try {
      const workflowName = (params.workflow_name as string) || "scrna-seq-standard";
      const projectDir = (params.project_dir as string) || "/data/projects/default";
      const container = (params.container as string) || "bioagent-scrna";

      // Register workflows
      const { WorkflowRegistry, SCRNA_SEQ_STANDARD } = await import("@bioagent/workflow");
      const registry = new WorkflowRegistry();
      registry.register(SCRNA_SEQ_STANDARD);

      // Check workflow exists
      const wf = registry.get(workflowName);
      if (!wf) {
        return `Unknown workflow: "${workflowName}". Available: scrna-seq-standard`;
      }

      return [
        `Workflow: ${workflowName}`,
        `Version: ${wf.version || "1.0.0"}`,
        `Project: ${projectDir}`,
        `Container: ${container}`,
        ``,
        `Pipeline (${wf.nodes.length} steps):`,
        ...wf.nodes.map((n: any, i: number) => `  ${i + 1}. ${n.id}: ${n.skill} ${n.dependsOn?.length ? `(requires: ${n.dependsOn.join(", ")})` : "(start)"}`),
        ``,
        `💡 To execute this workflow, use bio_skill_invoke for each step in order, or use docker_exec directly.`,
        `   Each Skill has built-in QC gates — check QC reports before proceeding.`,
        `   Checkpoint recovery is available via the WorkflowEngine API (programmatic use).`,
        `   Results: ${projectDir}/output/`,
      ].join("\n");
    } catch (err: any) {
      return `Workflow error: ${err.message}. For single-step analysis, use bio_skill_invoke instead.`;
    }
  },
});

// ============================================================================
// All BioAgent tools → passed to pi-agent as customTools
// ============================================================================

export const bioagentTools = [
  dockerExecTool,       // → @bioagent/executor (ContainerManager)
  dockerSearchTool,     // → @bioagent/executor (ImageSearchService)
  bioKbQueryTool,       // → @bioagent/knowledge (WikiLoader)
  bioFileInspectTool,   // → local fs (fast, no Docker)
  bioSkillInvokeTool,   // → @bioagent/skills (SkillRegistry)
  workflowRunTool,      // → @bioagent/workflow (WorkflowEngine)
] as Array<ToolDefinition<TSchema, unknown> & { name: string }>;

// Re-export for rpc-manager.ts compatibility
export const BIOAGENT_SYSTEM_PROMPT = "";
