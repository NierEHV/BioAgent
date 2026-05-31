// ============================================================
// @bioagent/agent-core — file-inspect Tool
// ============================================================

import { z } from "zod";
import { statSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

export const fileInspectToolSchema = z.object({
  path: z.string().min(1).describe("File or directory path to inspect"),
  recursive: z.boolean().default(false).describe("Recursively list subdirectories"),
  sample_rows: z.number().int().min(0).max(100).default(5).describe("Number of sample rows to read from file (0 to skip)"),
});

export type FileInspectToolParams = z.infer<typeof fileInspectToolSchema>;

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const fileInspectToolDef = {
  name: "file_inspect",
  description:
    "Inspect a file or directory on the filesystem. For directories, lists contents with sizes and types. For files, shows metadata and optionally reads the first N sample rows. Supports common bioinformatics formats (.h5ad, .rds, .csv, .tsv, .txt, .json, .fastq, .fasta, .bam, .gtf, .gff).",
  schema: fileInspectToolSchema,
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function fileInspectHandler(
  params: FileInspectToolParams,
): Promise<unknown> {
  const targetPath = params.path;

  if (!existsSync(targetPath)) {
    return {
      exists: false,
      path: targetPath,
      error: `Path does not exist: ${targetPath}`,
    };
  }

  const stats = statSync(targetPath);

  if (stats.isDirectory()) {
    return inspectDirectory(targetPath, params.recursive);
  }

  return inspectFile(targetPath, stats, params.sample_rows);
}

// ---------------------------------------------------------------------------
// Directory inspection
// ---------------------------------------------------------------------------

interface DirEntry {
  name: string;
  type: "file" | "directory";
  size: number;
  sizeFormatted: string;
  extension: string;
  lastModified: string;
}

function inspectDirectory(
  dirPath: string,
  recursive: boolean,
): unknown {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const items: DirEntry[] = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    try {
      const entryStats = statSync(fullPath);
      items.push({
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
        size: entryStats.size,
        sizeFormatted: formatBytes(entryStats.size),
        extension: entry.isDirectory() ? "" : extname(entry.name).toLowerCase(),
        lastModified: entryStats.mtime.toISOString(),
      });
    } catch {
      items.push({
        name: entry.name,
        type: "directory",
        size: 0,
        sizeFormatted: "0 B",
        extension: "",
        lastModified: "",
      });
    }
  }

  // Sort: directories first, then by name
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const totalSize = items.reduce((sum, i) => sum + i.size, 0);
  const fileCount = items.filter((i) => i.type === "file").length;
  const dirCount = items.filter((i) => i.type === "directory").length;

  const result: Record<string, unknown> & { subdirectories?: Record<string, unknown> } = {
    type: "directory",
    path: dirPath,
    totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    fileCount,
    dirCount,
    items,
  };

  if (recursive) {
    result.subdirectories = {};
    for (const item of items) {
      if (item.type === "directory") {
        result.subdirectories![item.name] = inspectDirectory(
          join(dirPath, item.name),
          false,
        );
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// File inspection
// ---------------------------------------------------------------------------

function inspectFile(
  filePath: string,
  stats: { size: number; mtime: Date },
  sampleRows: number,
): unknown {
  const ext = extname(filePath).toLowerCase();
  const fileName = basename(filePath);

  const result: Record<string, unknown> = {
    type: "file",
    path: filePath,
    name: fileName,
    extension: ext,
    size: stats.size,
    sizeFormatted: formatBytes(stats.size),
    lastModified: stats.mtime.toISOString(),
    isBioFormat: isBioFormat(ext),
  };

  // Detect bioinformatics format hints
  const formatHints = getFormatHints(ext);
  if (formatHints) {
    result.formatHints = formatHints;
  }

  // Read sample rows for text-based formats
  if (sampleRows > 0 && isReadableFormat(ext)) {
    try {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      result.totalLines = lines.length;

      // Provide header + sample rows
      const header = lines[0] ?? "";
      const samples = lines.slice(1, sampleRows + 1).filter((l) => l.trim());

      result.header = header.slice(0, 2000); // Cap header length
      result.sampleRows = samples.map((l) => l.slice(0, 2000)); // Cap each sample row
      result.sampleRowCount = samples.length;
    } catch {
      result.sampleRows = ["(unable to read file content)"];
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const BIO_FORMATS = new Set([
  ".h5ad", ".h5", ".rds", ".rda", ".rdata", ".mtx", ".tsv", ".csv",
  ".txt", ".json", ".yaml", ".yml", ".fastq", ".fq", ".fasta", ".fa",
  ".bam", ".sam", ".cram", ".gtf", ".gff", ".gff3", ".bed", ".vcf",
  ".loom", ".zarr", ".parquet", ".arrow",
]);

function isBioFormat(ext: string): boolean {
  return BIO_FORMATS.has(ext);
}

function isReadableFormat(ext: string): boolean {
  const textFormats = new Set([
    ".csv", ".tsv", ".txt", ".json", ".yaml", ".yml", ".log",
    ".fastq", ".fq", ".fasta", ".fa", ".sam", ".gtf", ".gff", ".gff3",
    ".bed", ".vcf", ".mtx",
  ]);
  return textFormats.has(ext);
}

interface FormatHint {
  format: string;
  description: string;
  typicalTools: string[];
}

function getFormatHints(ext: string): FormatHint | null {
  const hints: Record<string, FormatHint> = {
    ".h5ad": {
      format: "AnnData (h5ad)",
      description: "Python AnnData object for single-cell data",
      typicalTools: ["scanpy", "muon", "scvelo", "cellxgene"],
    },
    ".rds": {
      format: "R Data Serialized (RDS)",
      description: "R serialized object, typically a Seurat object for single-cell data",
      typicalTools: ["Seurat", "SeuratObject", "SingleCellExperiment"],
    },
    ".h5": {
      format: "HDF5",
      description: "Hierarchical data format, may contain 10X Genomics or Cell Ranger output",
      typicalTools: ["cellranger", "scanpy", "Seurat"],
    },
    ".fastq": {
      format: "FASTQ",
      description: "Raw sequencing reads with quality scores",
      typicalTools: ["fastqc", "cellranger", "star", "kallisto"],
    },
    ".fasta": {
      format: "FASTA",
      description: "Nucleotide or protein sequences",
      typicalTools: ["blast", "star", "bowtie2"],
    },
    ".bam": {
      format: "BAM/SAM/CRAM",
      description: "Aligned sequencing reads",
      typicalTools: ["samtools", "picard", "featureCounts", "cellranger"],
    },
    ".gtf": {
      format: "GTF/GFF",
      description: "Gene annotation format",
      typicalTools: ["featureCounts", "cellranger", "star"],
    },
    ".mtx": {
      format: "Matrix Market",
      description: "Sparse matrix format, often used for 10X count matrices",
      typicalTools: ["scanpy", "Seurat"],
    },
    ".vcf": {
      format: "VCF",
      description: "Variant Call Format for genetic variants",
      typicalTools: ["bcftools", "gatk", "plink"],
    },
    ".bed": {
      format: "BED",
      description: "Browser Extensible Data for genomic intervals",
      typicalTools: ["bedtools", "macs2", "homer"],
    },
  };

  return hints[ext] ?? null;
}
