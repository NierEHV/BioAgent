// ============================================================
// @bioagent/skills — FunctionalEnrichmentSkill
// ============================================================

import { BaseSkill } from "../base-skill";
import type {
  SkillSpec,
  SkillContext,
  SkillExecResult,
  QCReport,
  SkillOutput,
  ValidationResult,
  ToolChoice,
  DataContext,
} from "../base-skill.types";
import type { ResourceReport } from "@bioagent/executor";

/**
 * Functional Enrichment Analysis Skill.
 *
 * Performs gene set enrichment analysis on marker genes or DEGs using
 * Enrichr API via gseapy. Identifies over-represented pathways and
 * biological processes.
 *
 * Key features:
 * - Primary: gseapy.enrichr with KEGG_2021_Human and GO_Biological_Process_2023
 * - Optional: clusterProfiler (R-based, requires Seurat environment)
 * - Pathway overlap analysis to detect redundant enrichments
 * - Bar plot and network data for visualization
 *
 * QC gates validate:
 * - At least 1 significantly enriched pathway (padj < 0.05)
 * - Top 3 pathways gene overlap < 50% (avoid redundant enrichment)
 * - Enrichment scores follow expected distribution
 */
export class FunctionalEnrichmentSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "functional-enrichment",
    version: "1.0.0",
    description:
      "Functional enrichment analysis using gseapy Enrichr — identifies over-represented pathways and biological processes from gene lists",
    omicsType: "scrna",

    input: {
      acceptedFormats: ["h5ad", "json", "csv"],
      schema: {},
      minSamples: 1,
      maxSamples: 10,
      estimatedInputSize: "50MB-3GB",
    },

    tools: {
      primary: "gseapy.enrichr",
      alternatives: [
        "clusterProfiler (R)",
        "g:Profiler",
        "DAVID",
        "WebGestalt",
      ],
      decisionTree: [
        {
          condition: "Python environment with gseapy installed (recommended)",
          tool: "gseapy.enrichr(gene_set_libraries=['KEGG_2021_Human','GO_Biological_Process_2023'])",
          reason:
            "gseapy provides direct Python API to Enrichr with comprehensive gene set libraries covering KEGG pathways and GO terms",
        },
        {
          condition: "R environment with Seurat/clusterProfiler available",
          tool: "clusterProfiler::enrichKEGG / enrichGO",
          reason:
            "clusterProfiler provides richer visualization options and more statistical control for enrichment analysis",
        },
        {
          condition: "No Enrichr access (offline environment)",
          tool: "g:Profiler (Python API) or manual hypergeometric test",
          reason:
            "g:Profiler provides a Python API with multiple organism support as an alternative to Enrichr",
        },
      ],
      dockerImages: {
        gseapy: {
          image: "bioagent-scrna:latest",
          fallbackImage: "rnakato/shortcake_full:latest",
        },
      },
    },

    parameters: {
      defaults: {
        gene_set_libraries: "KEGG_2021_Human,GO_Biological_Process_2023",
        organism: "Human",
        max_padj: 0.05,
        top_n_pathways: 20,
        min_genes_per_term: 3,
        max_genes_per_term: 500,
        gene_list_source: "auto",
      },
      descriptions: {
        gene_set_libraries: "Comma-separated Enrichr gene set library names",
        organism: "Organism for gene set databases",
        max_padj: "Maximum adjusted p-value for significant enrichment",
        top_n_pathways: "Number of top pathways to report",
        min_genes_per_term: "Minimum number of overlapping genes per pathway term",
        max_genes_per_term: "Maximum number of genes in a pathway term (filter too broad terms)",
        gene_list_source: "Source of gene list: 'auto' (from marker/deg results), 'all_markers', 'deg_only'",
      },
      constraints: {
        max_padj: { min: 0.001, max: 0.1 },
        top_n_pathways: { min: 5, max: 100 },
        min_genes_per_term: { min: 1, max: 10 },
        max_genes_per_term: { min: 100, max: 2000 },
      },
    },

    qcGates: [
      {
        id: "significant_pathways",
        name: "Significant Pathway Count",
        description:
          "At least 1 pathway should be significantly enriched (padj < 0.05) — ensures the analysis yields biological insights",
        check: {
          type: "threshold",
          expression: "n_sig_pathways >= 1",
          metric: "sig_pathways",
        },
        level: "fail",
        onPass: ">=1 significantly enriched pathway found — biological interpretation is possible",
        onFail:
          "No significantly enriched pathways found. Gene list may be too small, or the biological signal is diffuse. Try relaxing thresholds or using a different gene set library",
        fixable: false,
      },
      {
        id: "pathway_redundancy",
        name: "Pathway Redundancy Check",
        description:
          "Top 3 pathways should have <50% gene overlap — excessive overlap indicates redundant/repetitive enrichment results",
        check: {
          type: "custom",
          expression: "top3_overlap < 50",
          metric: "redundancy",
        },
        level: "warn",
        onPass: "Top pathways have low gene overlap — diverse biological insights",
        onFail:
          "High gene overlap among top pathways (>50%) indicates redundant annotations. Consider grouping related terms or using a more specific gene set library",
        fixable: false,
      },
      {
        id: "enrichment_score_range",
        name: "Enrichment Score Range",
        description:
          "Combined enrichment scores should have reasonable variation — all identical scores suggest computation issues",
        check: {
          type: "custom",
          expression: "enrichment_score_std > 0.1",
          metric: "score_range",
        },
        level: "warn",
        onPass: "Enrichment scores show meaningful variation across pathways",
        onFail:
          "All enrichment scores are nearly identical, suggesting computation issues or very sparse data. Check input gene list",
        fixable: false,
      },
    ],

    outputs: {
      files: [
        {
          name: "enrichment_report.json",
          format: "json",
          description: "Full enrichment analysis report with pathway tables and statistics",
          required: true,
        },
        {
          name: "enrichment_table.csv",
          format: "csv",
          description: "Enrichment results as CSV table for external tools",
          required: true,
        },
        {
          name: "barplot_data.json",
          format: "json",
          description: "Data for enrichment bar plot visualization",
          required: false,
        },
        {
          name: "pathway_network.json",
          format: "json",
          description: "Pathway network data showing gene overlap relationships",
          required: false,
        },
      ],
      visualizations: [
        {
          type: "barplot",
          description: "Bar plot of top enriched pathways by -log10(padj) or combined score",
        },
        {
          type: "dotplot",
          description: "Dot plot showing enrichment ratio vs gene count for top pathways",
        },
      ],
      metrics: [
        { name: "n_genes_input", description: "Number of input genes", unit: "genes" },
        { name: "n_genes_mapped", description: "Number of genes successfully mapped", unit: "genes" },
        { name: "n_pathways_tested", description: "Total pathways tested" },
        { name: "n_sig_pathways", description: "Number of significantly enriched pathways" },
        { name: "top3_overlap", description: "Gene overlap among top 3 pathways", unit: "%" },
        { name: "enrichment_score_std", description: "Standard deviation of enrichment scores" },
        { name: "top_pathway", description: "Most significantly enriched pathway name" },
      ],
    },

    troubleshooting: {
      common_issues: [
        {
          symptom: "n_sig_pathways == 0",
          likely_cause:
            "Input gene list is too short, genes are not well-annotated in the database, or the biological signal is weak",
          diagnosis:
            "Check number of input genes. Enrichr requires a minimum number of mappable genes. Check organism matches the database",
          fix: "Increase the gene list size (use more DEGs/markers). Try different gene set libraries. Relax padj threshold to 0.1",
          severity: "warning",
        },
        {
          symptom: "n_genes_mapped < 50%",
          likely_cause:
            "Gene symbols do not match the database (different naming convention or organism)",
          diagnosis:
            "Check gene name format. Human genes should be uppercase (e.g., TP53 not Tp53). Mouse genes use Titlecase",
          fix: "Ensure gene symbols match the target organism convention. Use gene ID conversion tools if needed",
          severity: "warning",
        },
        {
          symptom: "top3_overlap > 80%",
          likely_cause:
            "Top pathways are closely related (e.g., multiple GO child terms of the same parent)",
          diagnosis:
            "Review overlapping genes. If pathways are semantically similar, this is expected for related biological processes",
          fix: "Use GO slim terms or KEGG pathways instead of full GO. Group redundant terms by semantic similarity",
          severity: "warning",
        },
        {
          symptom: "ConnectionError / HTTPError from Enrichr API",
          likely_cause:
            "Enrichr web service is unavailable or internet access is blocked in the container",
          diagnosis:
            "Check network connectivity from the Docker container. Enrichr requires internet access to query gene set libraries",
          fix: "Ensure container has internet access. Use offline alternatives like hypergeometric test with local gene sets",
          severity: "blocking",
        },
      ],
    },

    dependencies: {
      requires: ["marker-detection"],
      recommends: ["diff-expression"],
      conflicts: [],
    },

    resourceEstimate: {
      cpu: "2",
      ram: "4GB",
      disk: "500MB",
      time: "2-10 min",
      gpu: "not_needed",
    },
  };

  // -------------------------------------------------------------------------
  // ① validateInput
  // -------------------------------------------------------------------------

  async validateInput(data: DataContext): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.inputPath || data.inputPath.trim().length === 0) {
      errors.push("Input path is required (must point to an .h5ad file with marker/deg results, or a gene list file).");
      return { valid: false, errors, warnings };
    }

    if (!data.outputPath || data.outputPath.trim().length === 0) {
      errors.push("Output path is required.");
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // -------------------------------------------------------------------------
  // ② selectTool
  // -------------------------------------------------------------------------

  async selectTool(
    _data: DataContext,
    _resources: ResourceReport,
  ): Promise<ToolChoice> {
    return {
      tool: "gseapy.enrichr",
      reason:
        "gseapy.enrichr provides comprehensive functional enrichment via the Enrichr API — access to KEGG pathways, GO terms, and many other gene set libraries",
      image: this.spec.tools.dockerImages["gseapy"].image,
    };
  }

  // -------------------------------------------------------------------------
  // ③ configureParams
  // -------------------------------------------------------------------------

  async configureParams(
    data: DataContext,
    _tool: ToolChoice,
  ): Promise<Record<string, unknown>> {
    return {
      input_path: data.inputPath,
      output_path: data.outputPath,
      gene_set_libraries:
        this.spec.parameters.defaults["gene_set_libraries"] ??
        "KEGG_2021_Human,GO_Biological_Process_2023",
      organism: this.spec.parameters.defaults["organism"] ?? "Human",
      max_padj: this.spec.parameters.defaults["max_padj"] ?? 0.05,
      top_n_pathways:
        this.spec.parameters.defaults["top_n_pathways"] ?? 20,
      min_genes_per_term:
        this.spec.parameters.defaults["min_genes_per_term"] ?? 3,
      max_genes_per_term:
        this.spec.parameters.defaults["max_genes_per_term"] ?? 500,
      gene_list_source:
        this.spec.parameters.defaults["gene_list_source"] ?? "auto",
    };
  }

  // -------------------------------------------------------------------------
  // ④ run
  // -------------------------------------------------------------------------

  async run(context: SkillContext): Promise<SkillExecResult> {
    const { inputPath, outputPath } = context.data;
    const geneSetLibs =
      (context.params["gene_set_libraries"] as string) ??
      "KEGG_2021_Human,GO_Biological_Process_2023";
    const organism = (context.params["organism"] as string) ?? "Human";
    const maxPadj = (context.params["max_padj"] as number) ?? 0.05;
    const topNPathways = (context.params["top_n_pathways"] as number) ?? 20;
    const minGenesPerTerm =
      (context.params["min_genes_per_term"] as number) ?? 3;
    const maxGenesPerTerm =
      (context.params["max_genes_per_term"] as number) ?? 500;
    const geneListSource =
      (context.params["gene_list_source"] as string) ?? "auto";

    const pythonScript = `
import scanpy as sc
import numpy as np
import pandas as pd
import json
import os
import warnings
warnings.filterwarnings('ignore')

input_path = "${inputPath}"
output_path = "${outputPath}"
gene_set_libraries_str = "${geneSetLibs}"
gene_libraries = [lib.strip() for lib in gene_set_libraries_str.split(",") if lib.strip()]

# ======================================================================
# EXTRACT GENE LIST
# ======================================================================
gene_list = []
gene_list_method = ""

# Try loading from h5ad (extract top marker genes from all clusters)
if input_path.endswith('.h5ad'):
    adata = sc.read_h5ad(input_path)
    print(f"Loaded h5ad: {adata.n_obs} cells, {adata.n_vars} genes")

    # Try to get markers from rank_genes_groups results
    if 'rank_genes_markers' in adata.uns:
        print("Extracting marker genes from rank_genes_markers results...")
        result = adata.uns['rank_genes_markers']
        group_names = list(result['names'].dtype.names)
        all_marker_genes = set()
        for group in group_names:
            group_idx = list(result['names'].dtype.names).index(group)
            for i in range(min(10, len(result['names'][group_idx]))):
                gene = str(result['names'][group_idx][i])
                scores = result['scores'][group_idx][i]
                pvals_adj = result['pvals_adj'][group_idx][i]
                if pvals_adj < ${maxPadj} and scores > 0:
                    all_marker_genes.add(gene)
        gene_list = list(all_marker_genes)
        gene_list_method = "top_markers_per_cluster"
        print(f"Extracted {len(gene_list)} marker genes")

    elif 'rank_genes_condition' in adata.uns:
        print("Extracting DEGs from rank_genes_condition results...")
        result = adata.uns['rank_genes_condition']
        group_names = list(result['names'].dtype.names)
        all_deg_genes = set()
        for group in group_names:
            group_idx = list(result['names'].dtype.names).index(group)
            for i in range(min(100, len(result['names'][group_idx]))):
                gene = str(result['names'][group_idx][i])
                pvals_adj = result['pvals_adj'][group_idx][i]
                if pvals_adj < 0.05:
                    all_deg_genes.add(gene)
        gene_list = list(all_deg_genes)
        gene_list_method = "DEGs_from_condition_comparison"
        print(f"Extracted {len(gene_list)} DEGs")

    else:
        # Fallback: use highly variable genes
        print("No marker/DEG results found. Falling back to HVGs...")
        if 'highly_variable' in adata.var.columns:
            gene_list = list(adata.var_names[adata.var['highly_variable']])
        else:
            # Use top expressed genes
            gene_means = np.asarray(adata.X.mean(axis=0)).flatten()
            top_idx = np.argsort(gene_means)[-500:]  # top 500 expressed
            gene_list = list(adata.var_names[top_idx])
        gene_list_method = "top_expressed_or_hvg"
        print(f"Using {len(gene_list)} genes as fallback")

elif input_path.endswith('.json'):
    # Load gene list from JSON
    with open(input_path, 'r') as f:
        data = json.load(f)
    if isinstance(data, list):
        gene_list = [str(g) for g in data]
    elif isinstance(data, dict):
        # Try common keys
        for key in ['genes', 'gene_list', 'markers', 'upregulated_genes']:
            if key in data:
                gene_list = [str(g) for g in data[key]]
                break
    gene_list_method = "json_input"

elif input_path.endswith('.csv') or input_path.endswith('.txt'):
    # Load from CSV/TXT
    df = pd.read_csv(input_path)
    # Try to find gene column
    for col in ['gene', 'genes', 'Gene', 'symbol', 'SYMBOL', 'GeneSymbol']:
        if col in df.columns:
            gene_list = [str(g) for g in df[col].dropna().tolist()]
            break
    if not gene_list:
        gene_list = [str(g) for g in df.iloc[:, 0].dropna().tolist()]
    gene_list_method = "csv_input"

else:
    raise ValueError(f"Unsupported input format: {input_path}. Expected .h5ad, .json, or .csv")

# Deduplicate and clean
gene_list = sorted(set(g for g in gene_list if g and len(g) > 1))
n_genes_input = len(gene_list)

if n_genes_input < 5:
    print(f"WARNING: Very few genes ({n_genes_input}) for enrichment analysis. Results may be limited.")

print(f"Gene list: {n_genes_input} unique genes for enrichment")

# ======================================================================
# ENRICHMENT ANALYSIS
# ======================================================================
enrichment_available = False
enrichment_results_all = {}
n_pathways_tested = 0

try:
    import gseapy as gp
    enrichment_available = True
except ImportError:
    print("gseapy not available. Attempting fallback methods...")

if enrichment_available:
    print(f"Running Enrichr with libraries: {gene_libraries}")

    for library in gene_libraries:
        try:
            print(f"  Querying {library}...")
            enr = gp.enrichr(
                gene_list=gene_list,
                gene_sets=library,
                organism="${organism}",
                outdir=None,  # Don't write to disk — we'll capture results
                no_plot=True,
                cutoff=${maxPadj},
            )

            if enr.results is not None and len(enr.results) > 0:
                results_df = enr.results

                # Filter by gene count
                if 'Overlap' in results_df.columns:
                    # Parse overlap like "5/100"
                    def parse_overlap(ov_str):
                        parts = str(ov_str).split('/')
                        return int(parts[0]) if len(parts) == 2 else 0
                    results_df['n_overlap_genes'] = results_df['Overlap'].apply(parse_overlap)
                    results_df = results_df[
                        (results_df['n_overlap_genes'] >= ${minGenesPerTerm}) &
                        (results_df['n_overlap_genes'] <= ${maxGenesPerTerm})
                    ]

                enrichment_results_all[library] = results_df
                n_pathways_tested += len(results_df)
                n_sig = int((results_df['Adjusted P-value'] < ${maxPadj}).sum())
                print(f"  {library}: {n_sig} significant pathways out of {len(results_df)} tested")
            else:
                print(f"  {library}: No results returned")
                enrichment_results_all[library] = pd.DataFrame()

        except Exception as e:
            print(f"  {library}: Enrichment failed - {e}")
            enrichment_results_all[library] = pd.DataFrame()

else:
    # ==================================================================
    # FALLBACK: Simplified hypergeometric-based enrichment
    # using a small set of built-in pathway gene sets
    # ==================================================================
    print("Using fallback enrichment with built-in KEGG pathway definitions...")

    # Minimal built-in KEGG pathway gene sets for common pathways
    builtin_pathways = {
        "Immune system": ["CD3D", "CD3E", "CD4", "CD8A", "CD8B", "CD19", "CD79A", "MS4A1", "NKG7", "GNLY"],
        "Cytokine signaling": ["IL2", "IL4", "IL6", "IL10", "IFNG", "TNF", "CSF2", "IL7R", "CCR7", "CXCR4"],
        "T cell receptor signaling": ["CD3D", "CD3E", "LCK", "ZAP70", "LAT", "ITK", "NCK1", "VAV1", "NFATC2", "NFKB1"],
        "B cell receptor signaling": ["CD79A", "CD79B", "LYN", "SYK", "BTK", "BLNK", "PLCG2", "NFATC1", "NFKB1"],
        "Chemokine signaling": ["CCL5", "CCR7", "CXCR4", "CXCR5", "CCR6", "CXCL13", "CCL3", "CCL4", "CCL2"],
        "Apoptosis": ["BCL2", "BAX", "CASP3", "CASP8", "CASP9", "TP53", "BAD", "BID", "FAS", "FASLG"],
        "Cell cycle": ["CCND1", "CCNE1", "CDK1", "CDK2", "CDK4", "CDK6", "CDKN1A", "CDKN1B", "RB1", "E2F1"],
        "NF-kB signaling": ["NFKB1", "NFKB2", "RELA", "RELB", "IKBKB", "IKBKG", "CHUK", "TNF", "IL1B", "TLR4"],
        "JAK-STAT signaling": ["JAK1", "JAK2", "JAK3", "STAT1", "STAT3", "STAT5A", "STAT5B", "STAT6", "SOCS1", "SOCS3"],
        "MAPK signaling": ["MAPK1", "MAPK3", "MAP2K1", "MAP2K2", "BRAF", "RAF1", "RPS6KA1", "ELK1", "FOS", "JUN"],
        "Antigen processing": ["HLA-A", "HLA-B", "HLA-C", "B2M", "TAP1", "TAP2", "TAPBP", "CALR", "PDIA3", "HLA-DRA"],
        "Complement cascade": ["C1QA", "C1QB", "C1QC", "C2", "C3", "C4A", "C4B", "C5", "C6", "CFH"],
        "Oxidative phosphorylation": ["ND1", "ND2", "ND3", "ND4", "COX1", "COX2", "ATP6", "ATP8", "CYTB"],
        "Glycolysis": ["HK2", "GPI", "PFKL", "ALDOA", "GAPDH", "PGK1", "PGAM1", "ENO1", "PKM", "LDHA"],
        "p53 signaling": ["TP53", "MDM2", "CDKN1A", "BAX", "BBC3", "PMAIP1", "GADD45A", "RRM2B", "SESN1"],
    }

    from scipy.stats import hypergeom

    # Total number of protein-coding genes (approximate for human)
    N_total_genes = 20000  # background size

    enrichment_fallback = {}
    for pathway_name, pathway_genes in builtin_pathways.items():
        # Count overlap
        overlap_genes = [g for g in gene_list if g in pathway_genes]
        k = len(overlap_genes)  # overlap count
        K = len(pathway_genes)  # pathway size
        n = len(gene_list)  # query size

        if k < ${minGenesPerTerm}:
            continue

        # Hypergeometric test
        # P(X >= k) = 1 - P(X <= k-1)
        pval = hypergeom.sf(k - 1, N_total_genes, K, n)

        enrichment_fallback[pathway_name] = {
            "Term": pathway_name,
            "Overlap": f"{k}/{K}",
            "P-value": pval,
            "Adjusted P-value": min(pval * len(builtin_pathways), 1.0),
            "Odds Ratio": (k / (n - k + 1e-10)) / ((K - k) / (N_total_genes - K - n + k + 1e-10)),
            "Combined Score": -np.log10(max(pval, 1e-300)) * (k / K),
            "Genes": ",".join(overlap_genes),
            "n_overlap_genes": k,
        }

    # Build DataFrame
    fallback_results = pd.DataFrame(enrichment_fallback.values())
    if len(fallback_results) > 0:
        fallback_results = fallback_results.sort_values('P-value')
        fallback_results['Adjusted P-value'] = fallback_results['Adjusted P-value'].clip(upper=1.0)
        enrichment_results_all["KEGG_fallback"] = fallback_results
        n_pathways_tested = len(fallback_results)
        print(f"Fallback enrichment: {n_pathways_tested} pathways tested")
    else:
        enrichment_results_all["KEGG_fallback"] = pd.DataFrame()

# ======================================================================
# AGGREGATE & REPORT
# ======================================================================
all_sig_pathways = []

for library, results_df in enrichment_results_all.items():
    if len(results_df) == 0:
        continue

    sig_df = results_df[results_df['Adjusted P-value'] < ${maxPadj}].copy()

    if len(sig_df) == 0:
        # If no significant, take top 10 by p-value
        sig_df = results_df.nsmallest(10, 'P-value')

    sig_df = sig_df.sort_values('Adjusted P-value').head(${topNPathways})

    for _, row in sig_df.iterrows():
        pathway_entry = {
            "library": library,
            "term": str(row.get('Term', '')),
            "pval": float(row.get('P-value', 1)),
            "pval_adj": float(row.get('Adjusted P-value', 1)),
            "odds_ratio": float(row.get('Odds Ratio', 0)) if 'Odds Ratio' in row else 0,
            "combined_score": float(row.get('Combined Score', 0)) if 'Combined Score' in row else 0,
            "overlap": str(row.get('Overlap', '')),
            "n_overlap_genes": int(row.get('n_overlap_genes', 0)) if 'n_overlap_genes' in row else 0,
            "genes": str(row.get('Genes', '')) if 'Genes' in row else '',
        }
        all_sig_pathways.append(pathway_entry)

# Sort by combined score or p-value
if all_sig_pathways:
    all_sig_pathways.sort(
        key=lambda x: x.get('combined_score', -np.log10(max(x['pval_adj'], 1e-300))),
        reverse=True
    )
    all_sig_pathways = all_sig_pathways[:${topNPathways}]

n_sig_pathways = len([p for p in all_sig_pathways if p['pval_adj'] < ${maxPadj}])

# === Pathway redundancy (top 3 overlap) ===
top3_overlap = 0.0
if len(all_sig_pathways) >= 3:
    top3_genes = []
    for p in all_sig_pathways[:3]:
        genes_str = p.get('genes', '')
        if genes_str:
            top3_genes.append(set(genes_str.split(',')))
    if len(top3_genes) >= 2:
        # Average pairwise Jaccard overlap
        overlaps = []
        for i in range(len(top3_genes)):
            for j in range(i + 1, len(top3_genes)):
                intersection = len(top3_genes[i] & top3_genes[j])
                union = len(top3_genes[i] | top3_genes[j])
                if union > 0:
                    overlaps.append(100 * intersection / union)
        top3_overlap = round(float(np.mean(overlaps)), 2) if overlaps else 0.0

# === Enrichment score statistics ===
combined_scores = [p.get('combined_score', 0) for p in all_sig_pathways]
enrichment_score_std = round(float(np.std(combined_scores)), 4) if combined_scores else 0.0
enrichment_score_mean = round(float(np.mean(combined_scores)), 4) if combined_scores else 0.0

# === Mapped genes count (approximate) ===
all_overlap_genes = set()
for p in all_sig_pathways:
    genes_str = p.get('genes', '')
    if genes_str:
        for g in genes_str.split(','):
            all_overlap_genes.add(g.strip())
n_genes_mapped = len(all_overlap_genes)

# === Bar plot data ===
barplot_data = {
    "terms": [p['term'][:50] for p in all_sig_pathways[:20]],
    "neg_log10_pval_adj": [round(-np.log10(max(p['pval_adj'], 1e-300)), 2) for p in all_sig_pathways[:20]],
    "combined_score": [p['combined_score'] for p in all_sig_pathways[:20]],
    "n_overlap_genes": [p.get('n_overlap_genes', 0) for p in all_sig_pathways[:20]],
    "libraries": [p['library'] for p in all_sig_pathways[:20]],
}

# === Pathway network data (gene overlap between top pathways) ===
network_nodes = []
network_edges = []
top_pathways_for_net = all_sig_pathways[:15]

for i, p in enumerate(top_pathways_for_net):
    network_nodes.append({
        "id": str(i),
        "label": p['term'][:40],
        "library": p['library'],
        "combined_score": p['combined_score'],
        "n_genes": p.get('n_overlap_genes', 0),
    })

for i in range(len(top_pathways_for_net)):
    for j in range(i + 1, len(top_pathways_for_net)):
        genes_i = set(top_pathways_for_net[i].get('genes', '').split(','))
        genes_j = set(top_pathways_for_net[j].get('genes', '').split(','))
        overlap_count = len(genes_i & genes_j)
        if overlap_count > 0:
            network_edges.append({
                "source": str(i),
                "target": str(j),
                "weight": overlap_count,
            })

pathway_network = {
    "nodes": network_nodes,
    "edges": network_edges,
}

# === CSV export ===
csv_rows = []
for p in all_sig_pathways:
    csv_rows.append({
        "Library": p['library'],
        "Term": p['term'],
        "P-value": p['pval'],
        "Adjusted_P-value": p['pval_adj'],
        "Odds_Ratio": p['odds_ratio'],
        "Combined_Score": p['combined_score'],
        "Overlap": p['overlap'],
        "Genes": p.get('genes', ''),
    })

csv_df = pd.DataFrame(csv_rows)
csv_path = os.path.join(output_path, "enrichment_table.csv")
csv_df.to_csv(csv_path, index=False)
print(f"Written: {csv_path}")

# === Build report ===
report = {
    "n_genes_input": int(n_genes_input),
    "n_genes_mapped": int(n_genes_mapped),
    "n_pathways_tested": int(n_pathways_tested),
    "n_sig_pathways": int(n_sig_pathways),
    "max_padj": ${maxPadj},
    "gene_set_libraries": gene_libraries,
    "organism": "${organism}",
    "gene_list_source": gene_list_method,
    "top3_overlap": float(top3_overlap),
    "enrichment_score_std": float(enrichment_score_std),
    "enrichment_score_mean": float(enrichment_score_mean),
    "top_pathway": all_sig_pathways[0]['term'] if all_sig_pathways else "N/A",
    "significant_pathways": all_sig_pathways,
}

# Write outputs
with open(os.path.join(output_path, "enrichment_report.json"), "w") as f:
    json.dump(report, f, indent=2)

with open(os.path.join(output_path, "barplot_data.json"), "w") as f:
    json.dump(barplot_data, f)

with open(os.path.join(output_path, "pathway_network.json"), "w") as f:
    json.dump(pathway_network, f)

print(f"Enrichment complete: {n_sig_pathways} significant pathways")
print(f"Top pathway: {report['top_pathway']}")
print(f"Genes: {n_genes_input} input, {n_genes_mapped} mapped to pathways")
print(f"Top3 overlap: {top3_overlap:.1f}%")

print(json.dumps(report))
`.trim();

    const dockerResult = await this.execInContainer(context, pythonScript);

    const parsedData = this.parseJSONFromStdout(dockerResult.stdout);

    const metrics: Record<string, number> = {
      n_genes_input:
        typeof parsedData["n_genes_input"] === "number"
          ? (parsedData["n_genes_input"] as number)
          : 0,
      n_genes_mapped:
        typeof parsedData["n_genes_mapped"] === "number"
          ? (parsedData["n_genes_mapped"] as number)
          : 0,
      n_pathways_tested:
        typeof parsedData["n_pathways_tested"] === "number"
          ? (parsedData["n_pathways_tested"] as number)
          : 0,
      n_sig_pathways:
        typeof parsedData["n_sig_pathways"] === "number"
          ? (parsedData["n_sig_pathways"] as number)
          : 0,
      top3_overlap:
        typeof parsedData["top3_overlap"] === "number"
          ? (parsedData["top3_overlap"] as number)
          : 0,
      enrichment_score_std:
        typeof parsedData["enrichment_score_std"] === "number"
          ? (parsedData["enrichment_score_std"] as number)
          : 0,
    };

    return {
      exitCode: dockerResult.exitCode,
      stdout: dockerResult.stdout,
      stderr: dockerResult.stderr,
      parsedData,
      metrics,
    };
  }

  // -------------------------------------------------------------------------
  // ⑤ runQC
  // -------------------------------------------------------------------------

  async runQC(results: SkillExecResult): Promise<QCReport> {
    return this.runQCGates(results.metrics);
  }

  // -------------------------------------------------------------------------
  // ⑥ formatOutput
  // -------------------------------------------------------------------------

  async formatOutput(
    results: SkillExecResult,
    qc: QCReport,
  ): Promise<SkillOutput> {
    const logs: string[] = [];

    if (results.exitCode !== 0) {
      logs.push(`Python script exited with code ${results.exitCode}`);
    }
    if (results.stderr) {
      logs.push(`stderr: ${results.stderr.substring(0, 500)}`);
    }

    const nGenesIn = results.metrics["n_genes_input"] ?? 0;
    const nGenesMapped = results.metrics["n_genes_mapped"] ?? 0;
    const nSig = results.metrics["n_sig_pathways"] ?? 0;
    const topPathway = results.parsedData["top_pathway"] ?? "N/A";
    const top3Ov = results.metrics["top3_overlap"] ?? 0;
    const scoreStd = results.metrics["enrichment_score_std"] ?? 0;
    const geneLibraries = results.parsedData["gene_set_libraries"] ?? [];
    const source = results.parsedData["gene_list_source"] ?? "unknown";

    logs.push(
      `Functional enrichment: ${nSig} significant pathways found`,
    );
    logs.push(
      `Gene sets: ${Array.isArray(geneLibraries) ? geneLibraries.join(", ") : geneLibraries}`,
    );
    logs.push(
      `Gene source: ${source}. ${nGenesIn} input genes, ${nGenesMapped} mapped to pathways`,
    );
    logs.push(
      `Top pathway: ${topPathway}`,
    );
    logs.push(
      `Top 3 pathway overlap: ${top3Ov}% (score std: ${scoreStd})`,
    );
    logs.push(
      `QC overall: ${qc.overall} (${qc.passed}P/${qc.warned}W/${qc.failed}F)`,
    );

    const sigPathways = results.parsedData["significant_pathways"];
    if (Array.isArray(sigPathways) && sigPathways.length > 0) {
      logs.push("--- Top enriched pathways ---");
      for (let i = 0; i < Math.min(10, sigPathways.length); i++) {
        const p = sigPathways[i] as Record<string, unknown>;
        logs.push(
          `  ${i + 1}. ${p["term"]} (padj=${(p["pval_adj"] as number)?.toExponential(2)}, score=${p["combined_score"]})`,
        );
      }
    }

    return {
      files: [
        {
          path: `${results.parsedData["output_path"] ?? ""}/enrichment_report.json`,
          format: "json",
          size_bytes: 0,
        },
        ...(results.exitCode === 0
          ? [
              {
                path: `${results.parsedData["output_path"] ?? ""}/enrichment_table.csv`,
                format: "csv",
                size_bytes: 0,
              },
              {
                path: `${results.parsedData["output_path"] ?? ""}/barplot_data.json`,
                format: "json",
                size_bytes: 0,
              },
              {
                path: `${results.parsedData["output_path"] ?? ""}/pathway_network.json`,
                format: "json",
                size_bytes: 0,
              },
            ]
          : []),
      ],
      metrics: {
        n_genes_input: nGenesIn,
        n_genes_mapped: nGenesMapped,
        n_pathways_tested: results.metrics["n_pathways_tested"],
        n_sig_pathways: nSig,
        top3_overlap: top3Ov,
        enrichment_score_std: scoreStd,
        top_pathway: topPathway,
        gene_set_libraries: geneLibraries,
        gene_list_source: source,
        top_pathways: (sigPathways as unknown[] | undefined)?.slice(0, 10) ?? [],
      },
      logs,
    };
  }
}
