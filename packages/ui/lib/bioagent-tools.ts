"use client";

// ============================================================
// @bioagent/ui — BioAgent Custom Tools for pi-agent
// ============================================================
// Converts BioAgent backend tools into pi-agent ToolDefinition format.
// These are passed as `customTools` to createAgentSession().
//
// pi-agent integration point: createAgentSession({ customTools: [...bioagentTools] })

import type { ToolDefinition, ExtensionContext, AgentToolUpdateCallback } from "@earendil-works/pi-coding-agent";
import { Type, type TSchema, type Static } from "@sinclair/typebox";

// ============================================================================
// Helper: simplified tool factory — avoids full TypeBox schema for every tool
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
    ): Promise<any> {  // AgentToolResult<any> — use any to avoid type mismatch
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
// Thinking Template (injected as system prompt supplement)
// ============================================================================

export const BIOAGENT_SYSTEM_PROMPT = `
You are BioAgent — an AI Principal Bioinformatician with 15 years of experience.

Before every analysis, follow this 7-step reasoning framework:

## 1. Scientific Question Clarification
- What is the user's surface request? What is the underlying testable hypothesis?
- Restate the scientific question in precise terms.

## 2. Data Sufficiency Assessment
- What data does the user have? Format, scale, sample count?
- What data is missing? How does each gap affect conclusions?
- Can missing data be supplemented from public databases (GEO, TCGA, Human Cell Atlas)?

## 3. Analysis Path Enumeration (≥2 approaches)
- For each path: tools, statistical power, FDR control, compute requirements, interpretability
- Compare pros and cons explicitly.

## 4. Optimal Path Recommendation
- Recommend the best approach with reasons.
- Cite methodological literature (original tool papers, benchmark studies).
- Specify fallback if the primary approach fails.

## 5. Key Risk Assessment
- Technical risks: batch effects, sequencing depth variation, doublet rates
- Statistical risks: power, overfitting, multiple testing
- Biological risks: tissue heterogeneity, continuous cell states

## 6. Literature Support
- Reference original methods papers.
- Reference benchmark comparisons.
- Explicitly note uncertainty where literature support is limited.

## 7. Validation Strategy
- Internal: cross-validation, permutation tests, sensitivity analysis
- External: independent datasets, public atlases
- Experimental: which key findings should be confirmed by orthogonal experiments (FACS, IF, etc.)

## Available Bioinformatics Tools

You have access to bioinformatics-specific tools in addition to standard coding tools:

### \`docker_exec\` — Execute commands inside Docker containers
Use for ALL bioinformatics analysis. Never run bioinformatics tools directly — always use docker_exec inside a container.
- \`ensure_image\`: Check/pull a Docker image
- \`start_container\`: Start a container with volume mounts
- \`exec\`: Execute a command inside a running container
- \`stop_container\`: Stop and remove a container

### \`docker_search\` — Search DockerHub for bioinformatics images
Use when you don't know which Docker image contains a specific tool.

### \`bio_kb_query\` — Query the BioAgent knowledge base
Three-layer knowledge system: Vector DB (semantic search), Knowledge Graph (gene-pathway-disease relations), LLM Wiki (best practices).
Use this before making analysis decisions to get methodology references.

### \`bio_file_inspect\` — Inspect bioinformatics data files
Detect format (h5ad, h5, mtx, fastq, rds), show dimensions, sample metadata.

## Guidelines
- Always think through the 7-step framework before executing any analysis.
- Use \`docker_search\` when you need a tool not in your known image map.
- Use \`bio_kb_query\` to validate your methodology against established best practices.
- Use \`bio_file_inspect\` before starting any analysis to confirm data format and structure.
- Every analysis step should have explicit QC checks.
- When QC fails, diagnose the issue and suggest fixes.
- Cite specific literature and database sources in your reasoning.
`.trim();

// ============================================================================
// Tool: docker_exec
// ============================================================================

export const dockerExecTool = createSimpleTool({
  name: "docker_exec",
  label: "Docker Exec",
  description: `Execute commands inside Docker containers. Actions: ensure_image, start_container, exec, stop_container, get_status, list_containers.
Use this for ALL bioinformatics tool execution — never run bio tools directly on the host.

Examples:
- docker_exec(action: "ensure_image", image: "rnakato/shortcake_full:latest")
- docker_exec(action: "start_container", image: "bioagent-scrna:latest", name: "my-analysis", volumes: [{host:"/data", container:"/data", mode:"rw"}])
- docker_exec(action: "exec", container: "my-analysis", command: "python -c 'import scanpy; ...'", workdir: "/data", timeout: 600000)`,
  promptSnippet: "docker_exec(action, image?, container?, command?, ...) — manage Docker containers and execute bioinformatics commands inside them",
  promptGuidelines: [
    "Always use docker_exec for bioinformatics tools. Never run Python/R/bioinformatics tools directly on the host.",
    "First ensure_image, then start_container, then exec commands, finally stop_container.",
    "Mount user data to /data/input (read-only) and write outputs to /data/output.",
    "Set appropriate timeouts — some analyses can take 30+ minutes.",
  ],
  async execute(params: any): Promise<string> {
    const Docker = (await import("dockerode")).default;
    const docker = new Docker({ socketPath: process.platform === "win32" ? "//./pipe/dockerDesktopLinuxEngine" : "/var/run/docker.sock" });

    const action = params.action as string;

    switch (action) {
      case "ensure_image": {
        const image = params.image as string;
        try { await docker.getImage(image).inspect(); return `Image ${image} already exists locally.`; } catch { /* not found */ }
        await new Promise<void>((resolve, reject) => {
          docker.pull(image, {}, (err: any, stream: any) => {
            if (err) return reject(err);
            docker.modem.followProgress(stream, (err: any) => err ? reject(err) : resolve());
          });
        });
        return `Pulled image: ${image}`;
      }

      case "start_container": {
        const container = await docker.createContainer({
          Image: params.image as string,
          name: params.name as string,
          Cmd: (params.command as string[]) || ["sleep", "infinity"],
          HostConfig: {
            Binds: ((params.volumes as any[]) || []).map((v: any) => `${v.host}:${v.container}:${v.mode}`),
            NetworkMode: (params.network as string) || "bridge",
          },
        });
        await container.start();
        return `Container started: ${params.name} (ID: ${container.id.slice(0, 12)})`;
      }

      case "exec": {
        const container = docker.getContainer(params.container as string);
        const exec = await container.exec({
          Cmd: ["sh", "-c", params.command as string],
          WorkingDir: (params.workdir as string) || "/data",
          AttachStdout: true,
          AttachStderr: true,
        });
        const stream = await exec.start({ hijack: true, Detach: false });
        let stdout = "", stderr = "";
        const MAX = 50_000;

        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => { stdout += "\n[OUTPUT TRUNCATED — timeout]"; stream.destroy(); resolve(); }, (params.timeout as number) || 600_000);
          (docker.modem as any).demuxStream(stream,
            { write: (c: any) => { if (stdout.length < MAX) stdout += c.toString(); return true; } },
            { write: (c: any) => { if (stderr.length < MAX) stderr += c.toString(); return true; } },
          );
          stream.on("end", () => { clearTimeout(timer); resolve(); });
          stream.on("error", () => { clearTimeout(timer); resolve(); });
        });

        const inspect = await exec.inspect();
        const truncated = stdout.length >= MAX || stderr.length >= MAX;
        return [
          `Exit Code: ${inspect.ExitCode}`,
          stdout ? `--- stdout ---\n${stdout.slice(-MAX)}` : "",
          stderr && !truncated ? `--- stderr ---\n${stderr.slice(-MAX)}` : "",
          truncated ? "(output was truncated at 50KB)" : "",
        ].filter(Boolean).join("\n");
      }

      case "stop_container": {
        const container = docker.getContainer(params.container as string);
        await container.stop({ t: (params as any).force ? 0 : 10 }).catch(() => {});
        await container.remove({ v: (params as any).removeVolumes || false, force: true }).catch(() => {});
        return `Container ${params.container} stopped and removed.`;
      }

      case "get_status": {
        const container = docker.getContainer(params.container as string);
        try {
          const info = await container.inspect();
          return `Container: ${params.container}\nState: ${info.State.Status}\nImage: ${info.Config.Image}\nStarted: ${info.State.StartedAt}`;
        } catch {
          return `Container ${params.container} not found.`;
        }
      }

      case "list_containers": {
        const containers = await docker.listContainers({ all: true });
        const filtered = (params as any).filter
          ? containers.filter((c: any) => c.Names.some((n: string) => n.includes((params as any).filter)))
          : containers;
        if (filtered.length === 0) return "No containers found.";
        return filtered.map((c: any) => `${c.Names[0].replace(/^\//, "")}  ${c.State}  ${c.Image}`).join("\n");
      }

      default:
        return `Unknown action: ${action}. Valid actions: ensure_image, start_container, exec, stop_container, get_status, list_containers.`;
    }
  },
});

// ============================================================================
// Tool: docker_search
// ============================================================================

export const dockerSearchTool = createSimpleTool({
  name: "docker_search",
  label: "Docker Search",
  description: `Search Docker Hub for bioinformatics container images. Use when you don't know which Docker image contains a specific bioinformatics tool.`,
  promptSnippet: "docker_search(query, tool_name?, min_stars?, max_results?) — find bioinformatics Docker images on Docker Hub",
  promptGuidelines: [
    "Prefer biocontainers images (quay.io/biocontainers) for individual tools.",
    "Prefer ShortCake (rnakato/shortcake) for full single-cell analysis pipeline.",
    "Always verify the image's last update date and star count before recommending it.",
  ],
  async execute(params: any): Promise<string> {
    const query = encodeURIComponent((params.query as string) + " bioinformatics");
    const minStars = (params.min_stars as number) || 5;
    const limit = (params.max_results as number) || 5;

    try {
      const res = await fetch(`https://hub.docker.com/v2/search/repositories/?query=${query}&ordering=stars&page_size=${limit}`);
      const data = await res.json() as any;
      const results = (data.results || []).filter((r: any) => r.star_count >= minStars);

      if (results.length === 0) return `No images found for "${params.query}" with ≥${minStars} stars.`;
      return results.map((r: any, i: number) => {
        const daysAgo = Math.floor((Date.now() - new Date(r.last_updated).getTime()) / 86400000);
        const verdict = daysAgo > 730 ? "⚠️ OLD" : daysAgo > 365 ? "⚠️ Stale" : r.star_count >= 100 ? "⭐ Recommended" : "✅ OK";
        return `${i + 1}. ${r.namespace}/${r.name}  ⭐${r.star_count}  ${r.pull_count} pulls  ${verdict}\n   ${r.short_description}\n   Updated: ${r.last_updated} (${daysAgo}d ago)`;
      }).join("\n\n");
    } catch (err: any) {
      return `Docker Hub search failed: ${err.message}. Try using known images: rnakato/shortcake_full for single-cell analysis, quay.io/biocontainers/<tool> for individual tools.`;
    }
  },
});

// ============================================================================
// Tool: bio_kb_query
// ============================================================================

export const bioKbQueryTool = createSimpleTool({
  name: "bio_kb_query",
  label: "Knowledge Base Query",
  description: `Query the BioAgent three-layer knowledge base for bioinformatics methodology, best practices, and biological background knowledge.
Layers: vector (semantic search), graph (gene-pathway-disease relations), wiki (structured best practice documents).`,
  promptSnippet: "bio_kb_query(question, layers?, max_results?) — search bioinformatics knowledge base",
  promptGuidelines: [
    "Query the knowledge base BEFORE making methodology decisions.",
    "Use for: QC thresholds, parameter recommendations, tool selection criteria, biological interpretation.",
    "Default layers: vector + wiki (graph is queried automatically from vector results).",
  ],
  async execute(params: any): Promise<string> {
    const question = params.question as string;
    // Walk the wiki documents directory for relevant content
    const fs = await import("fs");
    const path = await import("path");
    const wikiDir = path.join(process.cwd(), "..", "knowledge", "data", "wiki");

    try {
      // Simple local search in wiki docs
      const results: string[] = [];
      const keywords = question.toLowerCase().split(/\s+/);

      function walk(dir: string) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir)) {
          const full = path.join(dir, entry);
          if (fs.statSync(full).isDirectory()) { walk(full); continue; }
          if (!entry.endsWith(".md")) continue;
          const content = fs.readFileSync(full, "utf-8");
          const matches = keywords.filter(k => content.toLowerCase().includes(k));
          if (matches.length > 0) {
            const title = content.split("\n")[0].replace(/^#\s*/, "");
            results.push(`📄 ${title} (${path.relative(wikiDir, full)}) — matched: ${matches.join(", ")}`);
          }
          if (results.length >= 5) return;
        }
      }
      walk(wikiDir);

      if (results.length === 0) {
        return `No wiki documents found for "${question}". The wiki covers: scRNA-seq QC, normalization, clustering, cell annotation, trajectory analysis, cell communication, Scanpy/Seurat tool guides, and standard SOP. Try rephrasing your query with specific terms.`;
      }

      return `Knowledge base results for "${question}":\n\n${results.join("\n")}\n\n💡 Use these documents for methodology guidance and parameter recommendations.`;
    } catch (err: any) {
      return `Knowledge base query failed: ${err.message}. The knowledge base is available at packages/knowledge/data/wiki/.`;
    }
  },
});

// ============================================================================
// Tool: bio_file_inspect
// ============================================================================

export const bioFileInspectTool = createSimpleTool({
  name: "bio_file_inspect",
  label: "File Inspect",
  description: `Inspect bioinformatics data files to detect format, dimensions, and structure.
Supports: h5ad, h5, mtx, fastq, rds, csv, tsv. Use this before starting any analysis.`,
  promptSnippet: "bio_file_inspect(path) — detect bioinformatics file format and structure",
  promptGuidelines: [
    "Always inspect data files before starting analysis.",
    "Use results to determine the appropriate Skill and tool selection.",
  ],
  async execute(params: any): Promise<string> {
    const filePath = params.path as string;
    const fs = await import("fs");
    const path = await import("path");

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
        const hasFeatures = files.includes("features.tsv.gz") || files.includes("genes.tsv");
        if (hasMtx && hasBarcodes && hasFeatures) {
          details += "10x Genomics MTX directory";
        } else {
          details += `Directory (${files.length} files): ${files.join(", ")}${files.length >= 20 ? "..." : ""}`;
        }
      } else if (ext === ".h5ad") {
        details += "AnnData (h5ad) — Python scanpy/anndata format";
      } else if (ext === ".h5") {
        details += "HDF5 (likely 10x Genomics) — use scanpy.read_10x_h5()";
      } else if (ext === ".rds") {
        details += "R RDS — use Seurat/readRDS in R environment";
      } else if ([".fastq", ".fq", ".fastq.gz", ".fq.gz"].includes(ext)) {
        details += "FASTQ sequencing reads";
      } else if (ext === ".csv" || ext === ".tsv") {
        const head = fs.readFileSync(filePath, "utf-8").split("\n").slice(0, 3).join("\n");
        details += `${ext.toUpperCase()} table\nPreview:\n${head}`;
      } else {
        details += `Unknown (extension: ${ext})`;
      }

      return details;
    } catch (err: any) {
      return `File inspection failed: ${err.message}`;
    }
  },
});

// ============================================================================
// Tool: bio_skill_invoke
// ============================================================================

export const bioSkillInvokeTool = createSimpleTool({
  name: "bio_skill_invoke",
  label: "Skill Invoke",
  description: `Invoke a BioAgent Skill — a standardized bioinformatics analysis step with built-in QC gates.
Available skills: data-import, scrna-qc, doublet-detection, scrna-normalize, hvg-selection, scrna-pca, batch-correction, umap-tsne, clustering, cell-annotation, marker-detection, diff-expression, functional-enrichment.

Skills execute Docker commands inside the specified container and return QC reports.`,
  promptSnippet: "bio_skill_invoke(skill_name, container, input_path, output_path) — run a bioinformatics Skill with built-in QC",
  promptGuidelines: [
    "Each Skill generates Python/R code that runs inside the specified Docker container.",
    "Skills have mandatory QC gates — check the QC report before proceeding to the next step.",
    "cell-annotation is a mandatory confirmation point — always review annotations before proceeding.",
    "Skills should be invoked in the standard pipeline order: import → qc → doublet → normalize → hvg → pca → [batch] → umap → cluster → annotate → marker → de → enrich",
  ],
  async execute(params: any): Promise<string> {
    const skillName = params.skill_name as string;
    const container = params.container as string;
    const inputPath = (params.input_path as string) || "/data/input";
    const outputPath = (params.output_path as string) || "/data/output";

    // Generate the Python command for this Skill
    const scripts: Record<string, string> = {
      "data-import": `python -c "import scanpy as sc; adata = sc.read_h5ad('${inputPath}'); adata.write('${outputPath}/imported.h5ad'); print(f'Imported: {adata.n_obs} cells x {adata.n_vars} genes')"`,
      "scrna-qc": `python -c "
import scanpy as sc; import numpy as np
adata = sc.read_h5ad('${inputPath}')
adata.var['mt'] = adata.var_names.str.startswith('MT-')
adata.var['ribo'] = adata.var_names.str.startswith(('RPS','RPL'))
sc.pp.calculate_qc_metrics(adata, qc_vars=['mt','ribo'], inplace=True)
from scipy import stats
mad_genes = 3 * stats.median_abs_deviation(adata.obs.n_genes_by_counts.to_numpy())
keep = (adata.obs.n_genes_by_counts > 200) & (adata.obs.pct_counts_mt < 20)
adata = adata[keep]
adata.write('${outputPath}/qc_filtered.h5ad')
print(f'QC: {adata.n_obs} cells retained ({adata.n_obs/(adata.n_obs+sum(~keep))*100:.1f}%)')
"`,
      "scrna-normalize": `python -c "import scanpy as sc; adata = sc.read_h5ad('${inputPath}'); sc.pp.normalize_total(adata, target_sum=1e4); sc.pp.log1p(adata); adata.write('${outputPath}/normalized.h5ad'); print('Normalized: log1p CPM')"`,
      "clustering": `python -c "import scanpy as sc; adata = sc.read_h5ad('${inputPath}'); sc.pp.neighbors(adata, n_neighbors=15, n_pcs=30); sc.tl.umap(adata, min_dist=0.3); sc.tl.leiden(adata, resolution=1.0); adata.write('${outputPath}/clustered.h5ad'); print(f'Clustered: {adata.obs.leiden.nunique()} clusters')"`,
    };

    const script = scripts[skillName];
    if (!script) {
      // For skills without predefined scripts, provide guidance
      const skillDescriptions: Record<string, string> = {
        "doublet-detection": "Scrublet doublet detection. Requires scrublet package.",
        "hvg-selection": "Highly variable gene selection via scanpy.pp.highly_variable_genes.",
        "scrna-pca": "PCA via scanpy.tl.pca.",
        "batch-correction": "Harmony batch correction via harmonypy or scanpy.external.pp.harmony_integrate.",
        "umap-tsne": "UMAP via scanpy.pp.neighbors + scanpy.tl.umap.",
        "cell-annotation": "CellTypist automatic annotation. Requires celltypist package and model file.",
        "marker-detection": "Marker gene detection via scanpy.tl.rank_genes_groups.",
        "diff-expression": "Differential expression via scanpy.tl.rank_genes_groups (condition-based).",
        "functional-enrichment": "GO/KEGG enrichment via gseapy.enrichr.",
      };
      const desc = skillDescriptions[skillName] || `Skill '${skillName}' is registered but requires custom setup.`;
      return `Skill: ${skillName}\nDescription: ${desc}\n\nTo execute this skill, use docker_exec to run the appropriate Python/R commands in container '${container}'.\nInput: ${inputPath} → Output: ${outputPath}`;
    }

    // Return the command to be executed via docker_exec
    return [
      `Skill: ${skillName}`,
      `Container: ${container}`,
      `Input: ${inputPath} → Output: ${outputPath}`,
      ``,
      `Execute this command via docker_exec:`,
      `docker_exec(action: "exec", container: "${container}", command: ${JSON.stringify(script)}, workdir: "/data", timeout: 600000)`,
      ``,
      `After execution, verify the output files and run QC if applicable.`,
    ].join("\n");
  },
});

// ============================================================================
// All BioAgent tools
// ============================================================================

export const bioagentTools = [
  dockerExecTool,
  dockerSearchTool,
  bioKbQueryTool,
  bioFileInspectTool,
  bioSkillInvokeTool,
] as Array<ToolDefinition<TSchema, unknown> & { name: string }>;
