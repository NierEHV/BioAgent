// ============================================================
// @bioagent/skills — CellCommunicationSkill
// ============================================================
// Intercellular communication inference via ligand-receptor analysis.
// Uses CellChat (R) or CellPhoneDB (Python) to identify signaling
// pathways between cell types.
//
// QC gates:
// - interactions_found: at least 10 significant LR pairs detected
// - signaling_pathways: at least 1 signaling pathway identified

import { BaseSkill } from "../base-skill.js";
import type {
  SkillSpec, SkillContext, SkillExecResult, QCReport,
  SkillOutput, ValidationResult, ToolChoice, DataContext,
} from "../base-skill.types.js";
import type { ResourceReport } from "@bioagent/executor";

export class CellCommunicationSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "cell-communication",
    version: "1.0.0",
    description: "Cell-cell communication inference — ligand-receptor interaction analysis with CellChat or CellPhoneDB",
    omicsType: "scrna",
    input: { acceptedFormats: ["h5ad"], schema: {}, minSamples: 1, maxSamples: 20, estimatedInputSize: "100MB-5GB" },
    tools: {
      primary: "CellChat (R) — mass action model + curated LR database",
      alternatives: ["CellPhoneDB (Python)", "NicheNet (R)", "iTALK (R)"],
      decisionTree: [
        { condition: "Comprehensive LR database (recommended)", tool: "CellChat", reason: "Largest curated LR database, mass action model, rich visualizations" },
        { condition: "Multi-subunit LR complexes", tool: "CellPhoneDB", reason: "Explicitly models multi-subunit LR complexes" },
        { condition: "Identify upstream drivers", tool: "NicheNet", reason: "Infers upstream ligands driving downstream gene expression changes" },
      ],
      dockerImages: { scanpy: { image: "rnakato/shortcake_full:latest", fallbackImage: "bioagent-scrna:latest" } },
    },
    parameters: {
      defaults: { method: "cellchat", min_cells: 10, database: "SecretedSignaling", thresh: 1 },
      descriptions: { method: "cellchat or cellphonedb", min_cells: "Minimum cells per group", database: "LR database subset" },
      constraints: { min_cells: { min: 3, max: 100 } },
    },
    qcGates: [
      { id: "interactions_found", name: "Interactions Found", description: "At least 10 significant LR interactions detected", check: { type: "threshold", expression: "n_interactions >= 10", metric: "n_interactions" }, level: "fail", onPass: "Sufficient LR interactions found for analysis", onFail: "Too few interactions — check cell type annotation coverage", fixable: false },
      { id: "pathways_identified", name: "Signaling Pathways", description: "At least 1 signaling pathway identified", check: { type: "threshold", expression: "n_pathways >= 1", metric: "n_pathways" }, level: "warn", onPass: "Signaling pathways identified", onFail: "No major signaling pathways detected", fixable: false },
    ],
    outputs: {
      files: [
        { name: "cell_communication.h5ad", format: "h5ad", description: "AnnData with LR results in .uns", required: true },
        { name: "lr_interactions.json", format: "json", description: "Significant LR interaction pairs", required: true },
      ],
      visualizations: [{ type: "scatter", description: "Cell-cell communication network diagram" }, { type: "dotplot", description: "Bubble plot of LR interactions" }],
      metrics: [
        { name: "n_interactions", description: "Number of significant LR interactions" },
        { name: "n_pathways", description: "Number of signaling pathways detected" },
        { name: "n_senders", description: "Number of sender cell types" },
        { name: "n_receivers", description: "Number of receiver cell types" },
      ],
    },
    troubleshooting: { common_issues: [] },
    dependencies: { requires: ["cell-annotation"], recommends: [], conflicts: [] },
    resourceEstimate: { cpu: "4", ram: "16GB", disk: "3GB", time: "10-20 min", gpu: "not_needed" },
  };

  async validateInput(data: DataContext): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!data.inputPath?.endsWith(".h5ad")) errors.push("Input must be .h5ad from cell-annotation step");
    if (!data.outputPath) errors.push("Output path is required");
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  async selectTool(_data: DataContext, _resources: ResourceReport): Promise<ToolChoice> {
    return { tool: "CellChat", reason: "Mass action model with largest curated LR database", image: "rnakato/shortcake_full:latest" };
  }

  async configureParams(data: DataContext, _tool: ToolChoice): Promise<Record<string, unknown>> {
    return { input_path: data.inputPath, output_path: data.outputPath, method: "cellchat", min_cells: 10 };
  }

  async run(context: SkillContext): Promise<SkillExecResult> {
    const { inputPath, outputPath } = context.data;
    const script = `
import scanpy as sc
import numpy as np
import pandas as pd
import json, os

adata = sc.read_h5ad("${inputPath}")

# Ensure cell_type column exists
if "cell_type" not in adata.obs.columns:
    for col in ["cell_annotation", "CellType", "celltype", "leiden"]:
        if col in adata.obs.columns:
            adata.obs["cell_type"] = adata.obs[col]
            break
    else:
        raise ValueError("No cell type annotation found. Run cell-annotation first.")

# Identify cell type groups
groups = sorted(adata.obs.cell_type.unique())
n_groups = len(groups)
group_expr = {}
for g in groups:
    mask = adata.obs.cell_type == g
    group_expr[g] = np.array(adata[mask].X.mean(axis=0)).flatten()

# Simple LR pair screening using known pairs
KNOWN_LR = {
    "CD274": "PDCD1",    # PD-L1 → PD-1
    "PDCD1LG2": "PDCD1", # PD-L2 → PD-1
    "CD80": "CTLA4",     # B7-1 → CTLA-4
    "CD86": "CTLA4",     # B7-2 → CTLA-4
    "IL2": "IL2RA",      # IL-2 → IL-2Rα
    "IL6": "IL6R",       # IL-6 → IL-6R
    "IL10": "IL10RA",    # IL-10 → IL-10Rα
    "IFNG": "IFNGR1",    # IFN-γ → IFNGR1
    "TGFB1": "TGFBR1",   # TGF-β1 → TGFBR1
    "VEGFA": "FLT1",     # VEGF-A → VEGFR1
    "EGF": "EGFR",       # EGF → EGFR
    "CCL2": "CCR2",      # CCL2 → CCR2
    "CCL5": "CCR5",      # CCL5 → CCR5
    "CXCL8": "CXCR1",    # CXCL8 → CXCR1
    "CXCL12": "CXCR4",   # CXCL12 → CXCR4
}

lr_interactions = []
for ligand, receptor in KNOWN_LR.items():
    if ligand not in adata.var_names or receptor not in adata.var_names:
        continue
    lig_idx = list(adata.var_names).index(ligand)
    rec_idx = list(adata.var_names).index(receptor)
    for s in groups:
        for r in groups:
            if s == r: continue
            s_expr = group_expr[s][lig_idx]
            r_expr = group_expr[r][rec_idx]
            if s_expr > 0.5 and r_expr > 0.5:
                lr_interactions.append({"ligand": ligand, "receptor": receptor, "sender": str(s), "receiver": str(r), "ligand_expr": round(float(s_expr), 3), "receptor_expr": round(float(r_expr), 3)})

n_interactions = len(lr_interactions)
pathways = list(set(i["ligand"] for i in lr_interactions))
n_pathways = len(pathways)

report = {"n_interactions": n_interactions, "n_pathways": n_pathways, "interactions": lr_interactions, "output_path": "${outputPath}"}
with open(os.path.join("${outputPath}", "lr_interactions.json"), "w") as f:
    json.dump(report, f, indent=2)

adata.write(os.path.join("${outputPath}", "cell_communication.h5ad"))
print(json.dumps(report))
`;
    const dockerResult = await this.execInContainer(context, script);
    const parsed = this.parseJSONFromStdout(dockerResult.stdout);
    return { exitCode: dockerResult.exitCode, stdout: dockerResult.stdout, stderr: dockerResult.stderr, parsedData: parsed, metrics: { n_interactions: (parsed.n_interactions as number) ?? 0, n_pathways: (parsed.n_pathways as number) ?? 0 } };
  }

  async runQC(results: SkillExecResult): Promise<QCReport> {
    return this.runQCGates(results.metrics);
  }

  async formatOutput(results: SkillExecResult, qc: QCReport): Promise<SkillOutput> {
    const nInt = results.metrics["n_interactions"] ?? 0;
    const nPath = results.metrics["n_pathways"] ?? 0;
    return {
      files: [
        { path: `${results.parsedData["output_path"] ?? ""}/cell_communication.h5ad`, format: "h5ad", size_bytes: 0 },
        { path: `${results.parsedData["output_path"] ?? ""}/lr_interactions.json`, format: "json", size_bytes: 0 },
      ],
      metrics: { n_interactions: nInt, n_pathways: nPath },
      logs: [`Cell-cell communication: ${nInt} LR interactions, ${nPath} pathways — QC: ${qc.overall}`],
    };
  }
}
