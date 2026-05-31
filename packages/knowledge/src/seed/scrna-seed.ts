// ============================================================
// @bioagent/knowledge — scRNA-seq Knowledge Seed Definitions
// ============================================================

/**
 * Authoritative reference sources for scRNA-seq analysis best practices.
 * These are the foundation of the knowledge base.
 */
export const SCRNA_SEED_SOURCES = [
  {
    name: "Luecken & Theis 2019 — Current best practices in single-cell RNA-seq analysis",
    type: "paper" as const,
    doi: "10.15252/msb.20188746",
    topic: "scrna-seq",
    year: 2019,
  },
  {
    name: "Heumos et al. 2023 — Best practices for single-cell analysis across modalities",
    type: "paper" as const,
    doi: "10.1038/s41576-023-00586-w",
    topic: "scrna-seq",
    year: 2023,
  },
  {
    name: "Scanpy Documentation",
    type: "docs" as const,
    url: "https://scanpy.readthedocs.io/",
    topic: "scrna-seq",
  },
  {
    name: "Seurat Vignettes",
    type: "docs" as const,
    url: "https://satijalab.org/seurat/",
    topic: "scrna-seq",
  },
  {
    name: "CellMarker 2.0",
    type: "database" as const,
    url: "http://bio-bigdata.hrbmu.edu.cn/CellMarker/",
    topic: "scrna-seq",
  },
  {
    name: "PanglaoDB",
    type: "database" as const,
    url: "https://panglaodb.se/",
    topic: "scrna-seq",
  },
  {
    name: "KEGG Pathway",
    type: "database" as const,
    url: "https://www.genome.jp/kegg/pathway.html",
    topic: "pathway",
  },
  {
    name: "Gene Ontology",
    type: "database" as const,
    url: "http://geneontology.org/",
    topic: "ontology",
  },
  {
    name: "Amezquita et al. 2020 — Orchestrating single-cell analysis with Bioconductor",
    type: "paper" as const,
    doi: "10.1038/s41592-019-0654-x",
    topic: "scrna-seq",
    year: 2020,
  },
  {
    name: "Saelens et al. 2019 — A comparison of single-cell trajectory inference methods",
    type: "paper" as const,
    doi: "10.1038/s41587-019-0071-9",
    topic: "trajectory",
    year: 2019,
  },
] as const;

// ---------------------------------------------------------------------------
// Graph seed: Common genes for scRNA-seq
// ---------------------------------------------------------------------------

export const SEED_GENES = [
  { symbol: "PTPRC", ensembl_id: "ENSG00000081237", full_name: "protein tyrosine phosphatase receptor type C", chromosome: "1", biotype: "protein_coding" },
  { symbol: "CD3E", ensembl_id: "ENSG00000198851", full_name: "CD3 epsilon subunit of T-cell receptor complex", chromosome: "11", biotype: "protein_coding" },
  { symbol: "CD4", ensembl_id: "ENSG00000010610", full_name: "CD4 molecule", chromosome: "12", biotype: "protein_coding" },
  { symbol: "CD8A", ensembl_id: "ENSG00000153563", full_name: "CD8a molecule", chromosome: "2", biotype: "protein_coding" },
  { symbol: "CD19", ensembl_id: "ENSG00000177455", full_name: "CD19 molecule", chromosome: "16", biotype: "protein_coding" },
  { symbol: "MS4A1", ensembl_id: "ENSG00000156738", full_name: "membrane spanning 4-domains A1 (CD20)", chromosome: "11", biotype: "protein_coding" },
  { symbol: "NKG7", ensembl_id: "ENSG00000105374", full_name: "natural killer cell granule protein 7", chromosome: "19", biotype: "protein_coding" },
  { symbol: "CD14", ensembl_id: "ENSG00000170458", full_name: "CD14 molecule", chromosome: "5", biotype: "protein_coding" },
  { symbol: "FCGR3A", ensembl_id: "ENSG00000203747", full_name: "Fc fragment of IgG receptor IIIa", chromosome: "1", biotype: "protein_coding" },
  { symbol: "PPBP", ensembl_id: "ENSG00000163736", full_name: "pro-platelet basic protein", chromosome: "4", biotype: "protein_coding" },
  { symbol: "EPCAM", ensembl_id: "ENSG00000119888", full_name: "epithelial cell adhesion molecule", chromosome: "2", biotype: "protein_coding" },
  { symbol: "KRT18", ensembl_id: "ENSG00000111057", full_name: "keratin 18", chromosome: "12", biotype: "protein_coding" },
  { symbol: "COL1A1", ensembl_id: "ENSG00000108821", full_name: "collagen type I alpha 1 chain", chromosome: "17", biotype: "protein_coding" },
  { symbol: "PECAM1", ensembl_id: "ENSG00000261371", full_name: "platelet and endothelial cell adhesion molecule 1", chromosome: "17", biotype: "protein_coding" },
  { symbol: "MKI67", ensembl_id: "ENSG00000148773", full_name: "marker of proliferation Ki-67", chromosome: "10", biotype: "protein_coding" },
  { symbol: "TP53", ensembl_id: "ENSG00000141510", full_name: "tumor protein p53", chromosome: "17", biotype: "protein_coding" },
  { symbol: "MYC", ensembl_id: "ENSG00000136997", full_name: "MYC proto-oncogene", chromosome: "8", biotype: "protein_coding" },
  { symbol: "EGFR", ensembl_id: "ENSG00000146648", full_name: "epidermal growth factor receptor", chromosome: "7", biotype: "protein_coding" },
  { symbol: "VEGFA", ensembl_id: "ENSG00000112715", full_name: "vascular endothelial growth factor A", chromosome: "6", biotype: "protein_coding" },
  { symbol: "GAPDH", ensembl_id: "ENSG00000111640", full_name: "glyceraldehyde-3-phosphate dehydrogenase", chromosome: "12", biotype: "protein_coding" },
];

// ---------------------------------------------------------------------------
// Graph seed: Cell types
// ---------------------------------------------------------------------------

export const SEED_CELL_TYPES = [
  { name: "T cell", ontology_id: "CL:0000084", category: "lymphocyte", species: "Homo sapiens" },
  { name: "CD4+ T cell", ontology_id: "CL:0000624", category: "lymphocyte", species: "Homo sapiens" },
  { name: "CD8+ T cell", ontology_id: "CL:0000625", category: "lymphocyte", species: "Homo sapiens" },
  { name: "B cell", ontology_id: "CL:0000236", category: "lymphocyte", species: "Homo sapiens" },
  { name: "NK cell", ontology_id: "CL:0000623", category: "lymphocyte", species: "Homo sapiens" },
  { name: "Monocyte", ontology_id: "CL:0000576", category: "myeloid", species: "Homo sapiens" },
  { name: "Macrophage", ontology_id: "CL:0000235", category: "myeloid", species: "Homo sapiens" },
  { name: "Dendritic cell", ontology_id: "CL:0000451", category: "myeloid", species: "Homo sapiens" },
  { name: "Neutrophil", ontology_id: "CL:0000775", category: "myeloid", species: "Homo sapiens" },
  { name: "Fibroblast", ontology_id: "CL:0000057", category: "stromal", species: "Homo sapiens" },
  { name: "Endothelial cell", ontology_id: "CL:0000115", category: "stromal", species: "Homo sapiens" },
  { name: "Epithelial cell", ontology_id: "CL:0000066", category: "epithelial", species: "Homo sapiens" },
];

// ---------------------------------------------------------------------------
// Graph seed: Pathways
// ---------------------------------------------------------------------------

export const SEED_PATHWAYS = [
  { id: "hsa04612", name: "Antigen processing and presentation", source_db: "KEGG", category: "immune" },
  { id: "hsa04620", name: "Toll-like receptor signaling pathway", source_db: "KEGG", category: "immune" },
  { id: "hsa04630", name: "JAK-STAT signaling pathway", source_db: "KEGG", category: "signaling" },
  { id: "hsa04010", name: "MAPK signaling pathway", source_db: "KEGG", category: "signaling" },
  { id: "hsa04110", name: "Cell cycle", source_db: "KEGG", category: "cellular_process" },
  { id: "hsa04151", name: "PI3K-Akt signaling pathway", source_db: "KEGG", category: "signaling" },
  { id: "hsa04210", name: "Apoptosis", source_db: "KEGG", category: "cellular_process" },
  { id: "hsa04310", name: "Wnt signaling pathway", source_db: "KEGG", category: "signaling" },
  { id: "hsa04512", name: "ECM-receptor interaction", source_db: "KEGG", category: "cellular_process" },
  { id: "hsa04640", name: "Hematopoietic cell lineage", source_db: "KEGG", category: "immune" },
];

// ---------------------------------------------------------------------------
// Graph seed: Tools
// ---------------------------------------------------------------------------

export const SEED_TOOLS = [
  {
    name: "Scanpy",
    version: "1.10.x",
    language: "Python",
    category: "scRNA-seq",
    docker_image: "rnakato/shortcake_full:latest",
  },
  {
    name: "Seurat",
    version: "5.x",
    language: "R",
    category: "scRNA-seq",
    docker_image: "bontix77/sc_rna:latest",
  },
  {
    name: "Harmony",
    version: "1.2.x",
    language: "R/Python",
    category: "batch_correction",
    docker_image: "rnakato/shortcake_full:latest",
  },
  {
    name: "scVI",
    version: "1.1.x",
    language: "Python",
    category: "batch_correction",
    docker_image: "rnakato/shortcake_full:latest",
  },
  {
    name: "CellTypist",
    version: "1.6.x",
    language: "Python",
    category: "cell_annotation",
    docker_image: "rnakato/shortcake_full:latest",
  },
];

// ---------------------------------------------------------------------------
// Literature snippets (text chunks for embedding)
// ---------------------------------------------------------------------------

export const LITERATURE_SNIPPETS = [
  {
    text: "QC filtering: filter cells with < 200 or > 6000 detected genes; filter cells with > 20% mitochondrial reads. Adapt thresholds to tissue — heart tissue may have up to 30% MT reads normally. Use MAD-based (5 median absolute deviations) rather than fixed thresholds for nUMI and nGene.",
    metadata: { source_type: "paper", doi: "10.15252/msb.20188746", title: "scRNA Best Practices", topic: "scrna-seq.qc", year: 2019, tool: "Scanpy_Seurat", omics_type: "scrna-seq" },
  },
  {
    text: "Normalization: scran pooling-based size factors outperform basic library-size normalization for scRNA-seq. SCTranform (Hafemeister & Satija 2019) uses regularized negative binomial regression and is recommended for large datasets (>10k cells). For quick exploration, log(CPM+1) is acceptable.",
    metadata: { source_type: "paper", doi: "10.1038/s41576-023-00586-w", title: "Single-cell Best Practices 2023", topic: "scrna-seq.normalization", year: 2023, tool: "scran_SCT", omics_type: "scrna-seq" },
  },
  {
    text: "HVG selection: choose top 2000 highly variable genes using 'seurat_v3' flavor in Scanpy (sc.pp.highly_variable_genes with flavor='seurat_v3'). For data with strong batch effects, use 'cell_ranger' flavor or select HVGs per batch. Never use all genes — it introduces noise and increases computation.",
    metadata: { source_type: "docs", url: "https://scanpy.readthedocs.io/", title: "Scanpy HVG Guide", topic: "scrna-seq.hvg", tool: "Scanpy", omics_type: "scrna-seq" },
  },
  {
    text: "Batch correction: Harmony works well for scRNA-seq integration with reasonable runtime (<1h for 100k cells). scVI is more powerful when the dataset contains complex batch structures but requires GPU for large datasets. Avoid ComBat — it was designed for bulk data. Always visualize with UMAP before and after correction.",
    metadata: { source_type: "paper", doi: "10.1038/s41576-023-00586-w", title: "Batch Correction Guide", topic: "scrna-seq.batch", year: 2023, tool: "Harmony_scVI", omics_type: "scrna-seq" },
  },
  {
    text: "Clustering: Leiden algorithm (resolution 0.5-2.0) is preferred over Louvain. Lower resolution (0.4-0.6) for broad cell types, higher (1.2-2.0) for subtypes. Build KNN graph on 30-50 PCs. Validate clusters with silhouette score and differential expression of known markers. If >50 clusters found, consider increasing resolution gradually.",
    metadata: { source_type: "docs", url: "https://scanpy.readthedocs.io/", title: "Clustering Best Practices", topic: "scrna-seq.clustering", tool: "Scanpy", omics_type: "scrna-seq" },
  },
  {
    text: "Cell annotation: use CellTypist with 'Human_Immune' or 'Human_All' models for automated annotation. Validate automatically assigned labels by checking expression of canonical markers: PTPRC (immune), CD3E (T cells), CD19/MS4A1 (B cells), CD14/FCGR3A (monocytes), NKG7 (NK cells). Manual annotation should involve UMAP visualization with key marker dotplots.",
    metadata: { source_type: "docs", url: "https://www.celltypist.org/", title: "CellTypist Annotation Guide", topic: "scrna-seq.annotation", tool: "CellTypist", omics_type: "scrna-seq" },
  },
  {
    text: "Doublet detection: Scrublet (expect_doublet_rate=0.06 for 10x) and DoubletFinder are commonly used. For 10x Genomics data, expect 5-8% doublets at 5000-cell recovery. Run before QC filtering. Concordance of 2 methods >80% gives high confidence. Remove clusters with mixed lineage markers.",
    metadata: { source_type: "paper", doi: "10.1016/j.cels.2018.11.005", title: "Scrublet Doublet Detection", topic: "scrna-seq.qc.doublets", year: 2019, tool: "Scrublet", omics_type: "scrna-seq" },
  },
  {
    text: "Differential expression: use Wilcoxon rank-sum test (sc.tl.rank_genes_groups) for quick marker detection. MAST and DESeq2 provide more statistical rigor but are slower. For each cluster, report top 10 markers with logFC > 1 and adjusted p-value < 0.05. Avoid pseudobulk approaches for <3 replicates.",
    metadata: { source_type: "paper", doi: "10.15252/msb.20188746", title: "DE Best Practices", topic: "scrna-seq.de", year: 2019, tool: "Scanpy_MAST", omics_type: "scrna-seq" },
  },
  {
    text: "Trajectory inference: use scVelo (RNA velocity) for dynamic processes; use Monocle3/PAGA for static lineage reconstruction. RNA velocity requires unspliced/spliced count matrices. PAGA gives robust topology at coarse resolution. Diffusion pseudotime (DPT) works well for continuous processes with a clear start point.",
    metadata: { source_type: "paper", doi: "10.1038/s41587-019-0071-9", title: "Trajectory Methods Comparison", topic: "scrna-seq.trajectory", year: 2019, tool: "scVelo_Monocle3", omics_type: "scrna-seq" },
  },
  {
    text: "Mitochondrial gene filtering requires tissue-specific thresholds. While a 20% cutoff is standard for PBMCs, cardiac tissue and kidney proximal tubule cells naturally have higher MT content (up to 30%). Always plot MT% distribution before setting thresholds. Use MAD-based outlier detection rather than hard cutoffs.",
    metadata: { source_type: "paper", doi: "10.15252/msb.20188746", title: "MT Filtering Guidelines", topic: "scrna-seq.qc", year: 2019, tool: "Scanpy", omics_type: "scrna-seq" },
  },
];
