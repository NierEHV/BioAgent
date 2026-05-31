// ============================================================
// @bioagent/knowledge — Tool Usage Experience Seed Data
// ============================================================
// 工具使用经验，基于基准研究和社区最佳实践。
// 用于初始化 Vector DB 层，辅助 Agent 选择工具和参数。

export interface ToolExperience {
  toolName: string;
  category: string;
  bestFor: string;
  limitations: string;
  alternatives: string[];
  recommendedParams: Record<string, string>;
  minimumCells: number;
  minimumGenes: number;
  typicalRuntime: string;
  paper: string;
  paperDoi: string;
}

export const TOOL_EXPERIENCES: ToolExperience[] = [
  {
    toolName: "Scrublet",
    category: "qc",
    bestFor: "模拟双细胞检测，无需真实 doublet 标注",
    limitations: "对高度同质的细胞群体可能不敏感；依赖 k-NN 图的质量",
    alternatives: ["DoubletFinder", "Solo", "scDblFinder"],
    recommendedParams: { expected_doublet_rate: "0.06", min_counts: "3", min_cells: "3", n_prin_comps: "30" },
    minimumCells: 100,
    minimumGenes: 500,
    typicalRuntime: "30 sec / 10k cells",
    paper: "Scrublet: Computational identification of cell doublets in single-cell transcriptomic data",
    paperDoi: "10.1016/j.cels.2018.11.005",
  },
  {
    toolName: "Harmony",
    category: "batch_correction",
    bestFor: "大规模图谱整合（>100k cells），速度快，内存效率高",
    limitations: "仅线性校正；对强烈非线性批次效应可能不足",
    alternatives: ["scVI", "BBKNN", "Seurat CCA", "Scanorama", "scGen"],
    recommendedParams: { max_iter_harmony: "10", theta: "2", sigma: "0.1", nclust: "50" },
    minimumCells: 500,
    minimumGenes: 1000,
    typicalRuntime: "2 min / 100k cells",
    paper: "Fast, sensitive and accurate integration of single-cell data with Harmony",
    paperDoi: "10.1038/s41592-019-0619-0",
  },
  {
    toolName: "scVI",
    category: "batch_correction",
    bestFor: "深度非线性批次校正，概率模型，可处理复杂实验设计",
    limitations: "需要 GPU 加速以获得最佳性能；训练时间较长",
    alternatives: ["Harmony", "BBKNN", "scanorama"],
    recommendedParams: { n_latent: "30", n_layers: "2", n_hidden: "128", max_epochs: "400" },
    minimumCells: 1000,
    minimumGenes: 1000,
    typicalRuntime: "30 min / 100k cells (GPU)",
    paper: "Deep generative modeling for single-cell transcriptomics",
    paperDoi: "10.1038/s41592-018-0229-2",
  },
  {
    toolName: "CellTypist",
    category: "annotation",
    bestFor: "基于层级模型的自动细胞类型注释，跨组织免疫细胞分析",
    limitations: "依赖训练模型覆盖的细胞类型；罕见类型可能被分配到最接近的大类",
    alternatives: ["SingleR", "scPred", "Garnett", "scCATCH"],
    recommendedParams: { model: "Immune_All_Low.pkl", majority_voting: "true", min_prop: "0.3" },
    minimumCells: 100,
    minimumGenes: 1000,
    typicalRuntime: "1 min / 10k cells (CPU)",
    paper: "Cross-tissue immune cell analysis reveals tissue-specific features in humans",
    paperDoi: "10.1126/science.abl5197",
  },
  {
    toolName: "SingleR",
    category: "annotation",
    bestFor: "基于相关性的自动注释，无需训练，使用参考数据集",
    limitations: "严重依赖参考数据集质量和覆盖度；对罕见细胞类型不敏感",
    alternatives: ["CellTypist", "scPred", "Garnett"],
    recommendedParams: { method: "cluster", quantile: "0.8", fine_tune: "true" },
    minimumCells: 100,
    minimumGenes: 500,
    typicalRuntime: "5 min / 10k cells",
    paper: "Reference-based analysis of lung single-cell sequencing reveals a transitional profibrotic macrophage",
    paperDoi: "10.1038/s41590-018-0276-y",
  },
  {
    toolName: "Monocle3",
    category: "trajectory",
    bestFor: "拟时间轨迹分析，树形拓扑，发育生物学",
    limitations: "需要预先过滤低质量细胞；假定树形拓扑",
    alternatives: ["scVelo", "Slingshot", "PAGA", "Diffusion Pseudotime"],
    recommendedParams: { num_dim: "50", max_components: "2", reduction_method: "UMAP" },
    minimumCells: 500,
    minimumGenes: 1000,
    typicalRuntime: "5 min / 50k cells",
    paper: "The dynamics and regulators of cell fate decisions are revealed by pseudotemporal ordering of single cells",
    paperDoi: "10.1038/nbt.2859",
  },
  {
    toolName: "scVelo",
    category: "trajectory",
    bestFor: "RNA velocity 分析，推断转录动态的方向性",
    limitations: "需要 spliced/unspliced 计数（需从 FASTQ 或 loom 文件重新计算）",
    alternatives: ["Monocle3", "Slingshot", "Dynamo", "velocyto"],
    recommendedParams: { mode: "dynamical", n_pcs: "30", n_neighbors: "30" },
    minimumCells: 500,
    minimumGenes: 1000,
    typicalRuntime: "10 min / 50k cells",
    paper: "Generalizing RNA velocity to transient cell states through dynamical modeling",
    paperDoi: "10.1038/s41587-020-0591-3",
  },
  {
    toolName: "CellChat",
    category: "cell_communication",
    bestFor: "基于配体-受体数据库的细胞间通讯推断",
    limitations: "仅基于表达量推断，不验证功能结合；假定配体-受体共表达即通讯",
    alternatives: ["NicheNet", "CellPhoneDB", "iTALK", "NATMI"],
    recommendedParams: { min_cells: "10", database: "SecretedSignaling", thresh: "1" },
    minimumCells: 300,
    minimumGenes: 2000,
    typicalRuntime: "10 min / 30k cells",
    paper: "Inference and analysis of cell-cell communication using CellChat",
    paperDoi: "10.1038/s41467-021-21246-9",
  },
  {
    toolName: "SCENIC",
    category: "grn",
    bestFor: "基因调控网络推断 + 转录因子活性评分",
    limitations: "计算密集（pySCENIC 更快）；需要高质量的基因表达矩阵",
    alternatives: ["pySCENIC", "GRNBoost2", "GENIE3", "SCENIC+", "Dorothea"],
    recommendedParams: { n_estimators: "100", num_workers: "4", method: "grnboost2" },
    minimumCells: 1000,
    minimumGenes: 2000,
    typicalRuntime: "2 hr / 50k cells (CPU)",
    paper: "SCENIC: single-cell regulatory network inference and clustering",
    paperDoi: "10.1038/nmeth.4463",
  },
  {
    toolName: "GSEApy",
    category: "enrichment",
    bestFor: "基因集富集分析，支持 GO/KEGG/Reactome/MSigDB",
    limitations: "结果受背景基因列表影响；多重检验校正后可能失去显著性",
    alternatives: ["clusterProfiler", "Enrichr", "DAVID", "fgsea"],
    recommendedParams: { gene_sets: "KEGG_2019_Human", cutoff: "0.05", min_size: "3", max_size: "500" },
    minimumCells: 50,
    minimumGenes: 100,
    typicalRuntime: "2 min / 1000 DE genes",
    paper: "GSEApy: a comprehensive package for performing gene set enrichment analysis in Python",
    paperDoi: "10.1093/bioinformatics/btac851",
  },
];

/** Convert tool experiences to vector DB snippets */
export function toolExperiencesToSnippets(): Array<{
  id: string;
  text: string;
  metadata: Record<string, string>;
}> {
  return TOOL_EXPERIENCES.map(t => ({
    id: `tool_${t.toolName}`,
    text: [
      `# ${t.toolName} — ${t.category}`,
      `## Best For`,
      t.bestFor,
      `## Limitations`,
      t.limitations,
      `## Alternatives`,
      t.alternatives.join(", "),
      `## Recommended Parameters`,
      Object.entries(t.recommendedParams).map(([k, v]) => `- ${k}: ${v}`).join("\n"),
      `## Requirements`,
      `- Minimum cells: ${t.minimumCells}`,
      `- Minimum genes: ${t.minimumGenes}`,
      `- Typical runtime: ${t.typicalRuntime}`,
      `## Reference`,
      `${t.paper} (DOI: ${t.paperDoi})`,
    ].join("\n"),
    metadata: {
      category: t.category,
      tool: t.toolName,
      source: "tool-seed",
    },
  }));
}
