// ============================================================
// @bioagent/ui — API: Knowledge
// ============================================================
// GET /api/knowledge?question=&context= — query the knowledge base

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mock knowledge references
// ---------------------------------------------------------------------------

const mockReferences = [
  {
    title: "Current best practices in single-cell RNA-seq analysis: a tutorial",
    doi: "10.15252/msb.20188746",
    type: "paper" as const,
    relevance: 0.95,
  },
  {
    title: "Scater: pre-processing, quality control, normalization and visualization of single-cell RNA-seq data in R",
    doi: "10.1093/bioinformatics/btw777",
    type: "paper" as const,
    relevance: 0.89,
  },
  {
    title: "Scanpy: large-scale single-cell gene expression data analysis",
    doi: "10.1186/s13059-017-1382-0",
    type: "paper" as const,
    relevance: 0.92,
  },
  {
    title: "DoubletFinder: Doublet Detection in Single-Cell RNA Sequencing Data Using Artificial Nearest Neighbors",
    doi: "10.1016/j.cels.2019.03.003",
    type: "paper" as const,
    relevance: 0.78,
  },
  {
    title: "scRNA-seq QC Guidelines — BioConductor",
    url: "https://bioconductor.org/packages/release/bioc/vignettes/scater/inst/doc/overview.html",
    type: "docs" as const,
    relevance: 0.85,
  },
  {
    title: "10x Genomics — Cell Ranger Pipeline Documentation",
    url: "https://support.10xgenomics.com/single-cell-gene-expression/software/pipelines/latest/what-is-cell-ranger",
    type: "docs" as const,
    relevance: 0.72,
  },
  {
    title: "Human Cell Atlas Data Portal",
    url: "https://data.humancellatlas.org/",
    type: "database" as const,
    relevance: 0.65,
  },
  {
    title: "GEO — Gene Expression Omnibus",
    url: "https://www.ncbi.nlm.nih.gov/geo/",
    type: "database" as const,
    relevance: 0.60,
  },
];

// ---------------------------------------------------------------------------
// Mock answers per question topic
// ---------------------------------------------------------------------------

const mockAnswers: Record<string, string> = {
  qc: "scRNA-seq quality control involves filtering low-quality cells based on three key metrics: (1) number of genes detected per cell (typically >200-500), (2) number of UMIs per cell (threshold depends on sequencing depth), and (3) mitochondrial gene percentage (typically <15-20%). Additional QC steps include doublet detection and ambient RNA removal.",
  normalization:
    "scRNA-seq normalization typically uses library-size normalization (counts per million) followed by log transformation. More advanced methods like SCTransform (Seurat) or scran pooling-based normalization can better handle the zero-inflation and variable library sizes inherent to scRNA-seq data.",
  clustering:
    "Cell clustering in scRNA-seq typically uses graph-based methods like the Louvain or Leiden algorithms on a k-nearest neighbor graph constructed from PCA-reduced data. Resolution parameter controls cluster granularity and should be tuned based on biological expectations.",
  default:
    "Based on current best practices in single-cell genomics, the recommended approach depends on your specific experimental design and biological questions. Consider data quality, sample size, and expected cell type diversity when choosing analysis parameters.",
};

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const question = searchParams.get("question");

  if (!question) {
    return NextResponse.json(
      { error: "Missing question parameter" },
      { status: 400 }
    );
  }

  // Select answer based on question keywords
  let answerKey = "default";
  const q = question.toLowerCase();
  if (q.includes("qc") || q.includes("quality") || q.includes("filter") || q.includes("mitochondrial")) {
    answerKey = "qc";
  } else if (q.includes("normaliz") || q.includes("transform")) {
    answerKey = "normalization";
  } else if (q.includes("cluster") || q.includes("louvain") || q.includes("leiden")) {
    answerKey = "clustering";
  }

  // Filter and sort references by relevance
  const relevantRefs = [...mockReferences]
    .sort(() => Math.random() - 0.5) // shuffle
    .slice(0, 4 + Math.floor(Math.random() * 3)) // 4-6 refs
    .sort((a, b) => b.relevance - a.relevance); // sort by relevance

  return NextResponse.json({
    answer: mockAnswers[answerKey],
    references: relevantRefs,
    confidence: 0.75 + Math.random() * 0.2,
  });
}
