// ============================================================
// @bioagent/knowledge — Biology Concept Seed Data
// ============================================================
// 基础生物学概念，用于初始化知识库 Vector DB 层。

export interface BiologyConcept {
  id: string;
  name: string;
  nameEn: string;
  category: "molecular_biology" | "cell_biology" | "cancer_biology" | "immunology";
  description: string;
  relatedTerms: string[];
}

export const BIOLOGY_CONCEPTS: BiologyConcept[] = [
  {
    id: "central_dogma",
    name: "中心法则 (Central Dogma)",
    nameEn: "Central Dogma",
    category: "molecular_biology",
    description: "DNA → RNA → 蛋白质。在 scRNA-seq 中测量 mRNA（转录组），它是基因组和蛋白质组之间的中间层。mRNA 的半衰期和转录爆发影响测量结果。",
    relatedTerms: ["transcription", "translation", "mRNA", "ribosome", "reverse transcription"],
  },
  {
    id: "gene_expression",
    name: "基因表达 (Gene Expression)",
    nameEn: "Gene Expression",
    category: "molecular_biology",
    description: "DNA 转录为 mRNA，mRNA 翻译为蛋白质的过程。在 scRNA-seq 中通过 UMI 计数定量。",
    relatedTerms: ["transcription factor", "promoter", "enhancer", "RNA polymerase", "UMI"],
  },
  {
    id: "epigenetics",
    name: "表观遗传 (Epigenetics)",
    nameEn: "Epigenetics",
    category: "molecular_biology",
    description: "不改变 DNA 序列的基因表达调控，包括 DNA 甲基化、组蛋白修饰、染色质重塑。scATAC-seq 可测量染色质可及性。",
    relatedTerms: ["DNA methylation", "histone modification", "chromatin accessibility", "ATAC-seq", "CpG island"],
  },
  {
    id: "cell_cycle",
    name: "细胞周期 (Cell Cycle)",
    nameEn: "Cell Cycle",
    category: "cell_biology",
    description: "G1 → S → G2 → M 四个阶段。scRNA-seq 中细胞周期效应是常见的混杂因素，通常通过 regress_out 或分类后分别分析来处理。",
    relatedTerms: ["G1/S/G2/M phase", "cyclin", "CDK", "mitosis", "cell cycle scoring"],
  },
  {
    id: "apoptosis",
    name: "细胞凋亡 (Apoptosis)",
    nameEn: "Apoptosis",
    category: "cell_biology",
    description: "程序性细胞死亡。scRNA-seq 中高线粒体基因比例（>20%）通常指示凋亡或受损细胞，应在 QC 中过滤。",
    relatedTerms: ["caspase", "mitochondrial genes", "programmed cell death", "BCL2", "annexin V"],
  },
  {
    id: "cell_differentiation",
    name: "细胞分化 (Cell Differentiation)",
    nameEn: "Cell Differentiation",
    category: "cell_biology",
    description: "干细胞逐步转化为特化细胞的过程。scRNA-seq 通过拟时间轨迹分析（pseudotime）重建分化路径。",
    relatedTerms: ["stem cell", "progenitor", "lineage", "pseudotime", "RNA velocity"],
  },
  {
    id: "tumor_microenvironment",
    name: "肿瘤微环境 (Tumor Microenvironment)",
    nameEn: "Tumor Microenvironment",
    category: "cancer_biology",
    description: "肿瘤周围的细胞和非细胞成分，包括免疫浸润细胞、癌相关成纤维细胞 (CAF)、血管、ECM。scRNA-seq 可解析 TME 的细胞组成和状态。",
    relatedTerms: ["TME", "TIL", "CAF", "angiogenesis", "ECM remodeling", "immune evasion"],
  },
  {
    id: "oncogene_tsg",
    name: "癌基因与抑癌基因 (Oncogenes & TSGs)",
    nameEn: "Oncogenes & Tumor Suppressors",
    category: "cancer_biology",
    description: "癌基因（如 MYC, KRAS）促进肿瘤发生；抑癌基因（如 TP53, PTEN）抑制肿瘤。scRNA-seq 可检测其在单细胞水平的表达模式。",
    relatedTerms: ["TP53", "MYC", "KRAS", "PTEN", "BRCA1", "mutation", "CNV"],
  },
  {
    id: "immune_checkpoint",
    name: "免疫检查点 (Immune Checkpoint)",
    nameEn: "Immune Checkpoint",
    category: "immunology",
    description: "免疫细胞表面调节通路（PD-1/PD-L1, CTLA-4），防止过度免疫反应。肿瘤利用检查点逃避免疫清除。scRNA-seq 可检测检查点分子在 T 细胞亚群中的表达。",
    relatedTerms: ["PD-1", "PD-L1", "CTLA-4", "immunotherapy", "T cell exhaustion"],
  },
  {
    id: "t_cell_subset",
    name: "T 细胞亚群 (T Cell Subsets)",
    nameEn: "T Cell Subsets",
    category: "immunology",
    description: "CD4+ (Th1, Th2, Th17, Treg) 和 CD8+ (细胞毒性, 记忆, 耗竭) 亚群。通过 marker 基因表达在 scRNA-seq 中鉴定。",
    relatedTerms: ["CD4", "CD8", "FOXP3", "IFNG", "IL4", "IL17A", "GZMB", "PDCD1"],
  },
  {
    id: "b_cell_activation",
    name: "B 细胞激活 (B Cell Activation)",
    nameEn: "B Cell Activation",
    category: "immunology",
    description: "抗原刺激后 B 细胞增殖、类别转换（IgM→IgG/IgA/IgE）、体细胞高频突变。scRNA-seq 可追踪 B 细胞克隆演化和浆细胞分化。",
    relatedTerms: ["plasma cell", "antibody", "class switch", "germinal center", "BCR", "CD19", "MS4A1"],
  },
];

/** Convert biology concepts to vector DB snippets */
export function biologyConceptsToSnippets(): Array<{
  id: string;
  text: string;
  metadata: Record<string, string>;
}> {
  return BIOLOGY_CONCEPTS.map(c => ({
    id: `biology_${c.id}`,
    text: [
      `# ${c.name}`,
      `## Category: ${c.category}`,
      "",
      c.description,
      "",
      `Related terms: ${c.relatedTerms.join(", ")}`,
    ].join("\n"),
    metadata: {
      category: c.category,
      source: "biology-seed",
      concept_id: c.id,
      name_en: c.nameEn,
    },
  }));
}
