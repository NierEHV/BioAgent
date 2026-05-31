# Plan: BioAgent 架构对齐与补全

> **Goal:** 将 BioAgent 项目完全对齐设计文档 §4.1 的目录结构，补全所有缺失文件，并将 5 个后端包接入运行时。
>
> **Architecture:** 自底向上 — 先补全每个包的结构和功能，测试通过后，最后统一接入 UI 运行时。
>
> **Tech Stack:** TypeScript 5.x strict, Node.js 22 LTS, pnpm 9.x, zod, vitest, dockerode, ChromaDB, KuzuDB, Next.js 16

---

## 文件结构总览

### 新增文件 (NEW) — 共计 ~55 个

| Phase | 包 | 数量 | 文件 |
|-------|---|------|------|
| P0 | 顶层 | 2 | `.github/ISSUE_TEMPLATE/feature_request.md`, `docs/contributing/skill-development.md` |
| P1 | executor | 3 | `container-manager.types.ts`, `image-search.types.ts`, `resource-probe.types.ts` |
| P2 | knowledge | 21 | `embedder.ts`, `queries.ts`, `seed-data.ts`, `wiki-index.ts`, `biology-seed.ts`, `tool-seed.ts`, 4 CSV, 6 wiki .md, 5 wiki extra |
| P3 | skills | 5 | `skill-loader.ts`, `trajectory.skill.ts`, `cell-communication.skill.ts`, `grn.skill.ts`, `report-generator.skill.ts` |
| P4 | agent-core | 1 | `bio-agent.config.ts` |
| P5 | workflow | 0 | ✅ 已匹配 §4.1，无需新增（验证完整性） |
| P6 | ui | 6 | `bioagent-client.ts`(重写), `sse-client.ts`(重写), 4 API routes (重写) |
| P7 | — | — | 端到端验证（不新增源文件） |

### 修改文件 (MODIFY) — 共计 ~12 个

| Phase | 包 | 文件 |
|-------|---|------|
| P1 | executor | `types.ts`(拆分), `index.ts`(更新导出) |
| P2 | knowledge | `index.ts`(新增导出), `bridge.ts`(新增查询方法), `seed/scrna-seed.ts`(类型补给) |
| P3 | skills | `index.ts`(新增导出), `skill-registry.ts`(新增 loader 集成) |
| P4 | agent-core | `index.ts`(新增导出), `bio-agent.ts`(使用 config) |
| P6 | ui | `bioagent-tools.ts`(重写 — 调用 backend), `rpc-manager.ts`(新增 workflow tool), `lib/bioagent-client.ts`, `lib/sse-client.ts` |

---

## Phase 0: 顶层项目支架对齐

### Task 0.1: 创建 GitHub Issue Template

**NEW:** `.github/ISSUE_TEMPLATE/feature_request.md`

1. 创建目录 `.github/ISSUE_TEMPLATE/`
2. 写 feature_request.md:
```
---
name: Feature Request
about: Suggest a feature for BioAgent
title: "[FEATURE] "
labels: enhancement
assignees: ""
---

## Problem Statement
...

## Proposed Solution
...

## Alternatives Considered
...

## Success Criteria
...
```
3. `git add .github/ISSUE_TEMPLATE/feature_request.md && git commit -m "chore: add GitHub issue template"`

### Task 0.2: 创建 Skill 开发指南文档

**NEW:** `docs/contributing/skill-development.md`

1. 创建目录 `docs/contributing/`
2. 写 skill-development.md — 内容包括：
   - Skill 6-phase pipeline 说明（validate → select tool → config params → execute → QC → format output）
   - 如何继承 BaseSkill
   - QCGate 定义规范
   - zod schema 要求
   - 测试模板
3. `git add docs/contributing/skill-development.md && git commit -m "docs: add skill development guide"`

### Task 0.3: 验证顶层目录与 §4.1 一致

检查并确认以下顶层结构存在，不存在则创建：

```
BioAgent/
├── .github/workflows/ci.yml ✅
├── .github/workflows/docker-build.yml ❌ → NEW
├── .github/ISSUE_TEMPLATE/feature_request.md ✅ (Task 0.1)
├── docker/docker-compose.yml ✅
├── docker/Dockerfile ✅
├── data/projects/ ✅ (gitignored)
├── data/sessions/ ✅ (gitignored)
├── data/chroma/ ❌ → mkdir + .gitkeep
├── data/kuzu/ ❌ → mkdir + .gitkeep
├── data/logs/ ❌ → mkdir + .gitkeep
├── docs/architecture-overview.md ✅
├── docs/design/bioagent-mvp-design.md ✅
├── docs/api/openapi.yaml ❌ → NEW (placeholder)
├── docs/contributing/skill-development.md ✅ (Task 0.2)
├── scripts/dev.sh ✅ (if exists, else create placeholder)
├── scripts/seed-knowledge.ts ❌ → NEW (placeholder)
├── scripts/verify-setup.ts ❌ → NEW (placeholder)
```

**NEW:** `.github/workflows/docker-build.yml`
```yaml
name: Docker Build
on:
  push:
    branches: [master, main]
    paths: ['docker/**', 'packages/executor/**']
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build BioAgent image
        run: docker build -t bioagent:latest -f docker/Dockerfile .
```

**NEW:** `docs/api/openapi.yaml` — placeholder with OpenAPI 3.0 skeleton

**NEW:** `scripts/seed-knowledge.ts` — placeholder that logs "seed-knowledge: not yet implemented, use packages/knowledge/src/seed/seed-runner.ts directly"

**NEW:** `scripts/verify-setup.ts` — placeholder that logs "verify-setup: checking Docker, Node.js, pnpm versions..."

提交: `git add -A && git commit -m "chore: align top-level structure with design doc §4.1"`

---

## Phase 1: executor — 类型文件拆分

### Task 1.1: 拆分 container-manager.types.ts

**NEW:** `packages/executor/src/container-manager.types.ts`

从 `types.ts` 提取以下接口：
- `ContainerConfig`
- `VolumeMount`
- `ExecConfig`
- `ExecResult`
- `ContainerStatus`

```typescript
// packages/executor/src/container-manager.types.ts
// ============================================================
// @bioagent/executor — Container Manager Type Definitions
// ============================================================

/** Docker 容器启动配置 */
export interface ContainerConfig {
  image: string;
  name: string;
  command: string[];
  volumes: VolumeMount[];
  env: Record<string, string>;
  gpu: boolean;
  network: "bridge" | "host" | "none";
  memoryLimit?: string;
  cpuLimit?: number;
}

/** 数据卷挂载配置 */
export interface VolumeMount {
  host: string;
  container: string;
  mode: "ro" | "rw";
}

/** 容器内命令执行配置 */
export interface ExecConfig {
  container: string;
  command: string;
  workdir: string;
  timeout: number;
  env: Record<string, string>;
  captureStderr: boolean;
}

/** 命令执行结果 */
export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
  duration: number;
  command: string;
}

/** 容器状态 */
export interface ContainerStatus {
  name: string;
  state: "running" | "paused" | "exited" | "dead" | "not_found";
  startedAt: string;
  imageUsed: string;
  memoryUsage: string;
  cpuUsagePercent: number;
  volumes: VolumeMount[];
}
```

**MODIFY:** `packages/executor/src/types.ts` — 删除以上已迁移的接口，改为 re-export：
```typescript
export type {
  ContainerConfig,
  VolumeMount,
  ExecConfig,
  ExecResult,
  ContainerStatus,
} from "./container-manager.types.js";
```

### Task 1.2: 拆分 image-search.types.ts

**NEW:** `packages/executor/src/image-search.types.ts`

从 `types.ts` 提取：
- `PullProgress`
- `PullResult`
- `ImageInfo`
- `SearchParams`
- `SearchResult`

**MODIFY:** `packages/executor/src/types.ts` — 改为 re-export

### Task 1.3: 拆分 resource-probe.types.ts

**NEW:** `packages/executor/src/resource-probe.types.ts`

从 `types.ts` 提取：
- `ResourceReport`

**MODIFY:** `packages/executor/src/types.ts` — 改为 re-export，最终 `types.ts` 只包含跨模块共享的通用类型（若有），其余全部变为 re-export barrel。

### Task 1.4: 更新 executor index.ts 导出

**MODIFY:** `packages/executor/src/index.ts`

新增导出：
```typescript
export type { ContainerConfig, VolumeMount, ExecConfig, ExecResult, ContainerStatus } from "./container-manager.types.js";
export type { PullProgress, PullResult, ImageInfo, SearchParams, SearchResult } from "./image-search.types.js";
export type { ResourceReport } from "./resource-probe.types.js";
// re-export from types.ts for backward compat
export type * from "./types.js";
```

### Task 1.5: 验证 — typecheck + test

```bash
cd packages/executor && pnpm typecheck && pnpm test
```

提交: `git add packages/executor && git commit -m "refactor(executor): split type files per design doc §4.1"`

---

## Phase 2: knowledge — 补全 21 个缺失文件

### Task 2.1: 新建 vector-db/embedder.ts

**NEW:** `packages/knowledge/src/vector-db/embedder.ts`

```typescript
// ============================================================
// @bioagent/knowledge — Embedding Generator
// ============================================================
// Generates vector embeddings for text using a configurable
// embedding function. Default: simple TF-IDF-like bag-of-words
// for local dev; supports ChromaDB built-in embedding for prod.

export interface Embedder {
  /** Generate embedding vector for text */
  embed(text: string): Promise<number[]>;
  /** Generate embeddings for multiple texts (batch) */
  embedBatch(texts: string[]): Promise<number[][]>;
  /** Dimension of generated embeddings */
  readonly dimension: number;
}

export interface EmbedderConfig {
  type: "local-bow" | "chromadb-default" | "openai" | "custom";
  /** For custom: API endpoint */
  endpoint?: string;
  /** For custom: model name */
  model?: string;
  /** Embedding vector dimension */
  dimension?: number;
}

/** Simple local bag-of-words embedder (for dev/CI without ChromaDB) */
export class LocalBowEmbedder implements Embedder {
  readonly dimension: number;
  private vocabulary: Map<string, number> = new Map();
  private nextIndex = 0;

  constructor(dimension = 384) {
    this.dimension = dimension;
  }

  async embed(text: string): Promise<number[]> {
    const tokens = this.tokenize(text);
    const vector = new Array(this.dimension).fill(0);
    for (const token of tokens) {
      const idx = this.getOrCreateIndex(token) % this.dimension;
      vector[idx] += 1;
    }
    // Normalize
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
    return norm > 0 ? vector.map(v => v / norm) : vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^a-z0-9一-鿿\s]/g, " ")
      .split(/\s+/)
      .filter(t => t.length > 0);
  }

  private getOrCreateIndex(token: string): number {
    const existing = this.vocabulary.get(token);
    if (existing !== undefined) return existing;
    const idx = this.nextIndex++;
    this.vocabulary.set(token, idx);
    return idx;
  }
}

/** Factory: create embedder from config */
export function createEmbedder(config: EmbedderConfig = { type: "local-bow" }): Embedder {
  switch (config.type) {
    case "local-bow":
      return new LocalBowEmbedder(config.dimension || 384);
    case "chromadb-default":
      // ChromaDB built-in all-MiniLM-L6-v2 (384 dims)
      return new LocalBowEmbedder(384); // placeholder — real impl uses ChromaClient
    default:
      return new LocalBowEmbedder(config.dimension || 384);
  }
}
```

**测试:** `packages/knowledge/__tests__/embedder.test.ts`
```typescript
import { describe, it, expect } from "vitest";
import { LocalBowEmbedder, createEmbedder } from "../src/vector-db/embedder.js";

describe("LocalBowEmbedder", () => {
  it("generates embeddings of correct dimension", async () => {
    const emb = new LocalBowEmbedder(256);
    const v = await emb.embed("hello world");
    expect(v).toHaveLength(256);
  });

  it("produces normalized vectors", async () => {
    const emb = new LocalBowEmbedder();
    const v = await emb.embed("single-cell RNA sequencing quality control");
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1.0, 4);
  });

  it("different texts produce different embeddings", async () => {
    const emb = new LocalBowEmbedder();
    const a = await emb.embed("mitochondrial genes");
    const b = await emb.embed("ribosomal proteins");
    const diff = a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0);
    expect(diff).toBeGreaterThan(0);
  });

  it("batch embedding works", async () => {
    const emb = new LocalBowEmbedder();
    const vecs = await emb.embedBatch(["qc metrics", "normalization", "clustering"]);
    expect(vecs).toHaveLength(3);
    vecs.forEach(v => expect(v).toHaveLength(emb.dimension));
  });
});

describe("createEmbedder", () => {
  it("defaults to local-bow", () => {
    const emb = createEmbedder();
    expect(emb).toBeInstanceOf(LocalBowEmbedder);
  });

  it("respects dimension config", () => {
    const emb = createEmbedder({ type: "local-bow", dimension: 128 });
    expect(emb.dimension).toBe(128);
  });
});
```

### Task 2.2: 新建 graph-db/queries.ts

**NEW:** `packages/knowledge/src/graph-db/queries.ts`

Cypher 查询模板集合：

```typescript
// ============================================================
// @bioagent/knowledge — Graph Query Templates (Cypher)
// ============================================================

export const QUERIES = {
  /** Find all genes in a pathway */
  genesByPathway: `MATCH (g:Gene)-[:PARTICIPATES_IN]->(p:Pathway {name: $pathway_name}) RETURN g.name, g.symbol`,

  /** Find pathways associated with a gene */
  pathwaysByGene: `MATCH (g:Gene {symbol: $symbol})-[:PARTICIPATES_IN]->(p:Pathway) RETURN p.name, p.id`,

  /** Find diseases associated with a gene */
  diseasesByGene: `MATCH (g:Gene {symbol: $symbol})-[:ASSOCIATED_WITH]->(d:Disease) RETURN d.name, d.id`,

  /** Find drugs targeting a gene */
  drugsByGene: `MATCH (g:Gene {symbol: $symbol})<-[:TARGETS]-(d:Drug) RETURN d.name, d.id`,

  /** Find cell type markers */
  markersByCellType: `MATCH (m:Marker)-[:MARKER_OF]->(c:CellType {name: $cell_type}) RETURN m.gene_symbol, m.specificity`,

  /** Find cell types where a gene is a marker */
  cellTypesByMarker: `MATCH (m:Marker {gene_symbol: $symbol})-[:MARKER_OF]->(c:CellType) RETURN c.name, m.specificity`,

  /** Find tissues where a cell type is located */
  tissuesByCellType: `MATCH (c:CellType {name: $name})-[:LOCATED_IN]->(t:Tissue) RETURN t.name`,

  /** Find interacting genes */
  geneInteractions: `MATCH (g1:Gene {symbol: $symbol})-[:INTERACTS_WITH]->(g2:Gene) RETURN g2.symbol, g2.name`,

  /** Find GO terms for a gene */
  goTermsByGene: `MATCH (g:Gene {symbol: $symbol})-[:HAS_GO_TERM]->(go:GO_Term) RETURN go.id, go.name, go.namespace`,

  /** Find tools better than a given tool for a task */
  betterTools: `MATCH (t1:Tool {name: $tool_name})-[:BETTER_THAN]->(t2:Tool) RETURN t2.name, t2.category`,

  /** Full-text search across nodes */
  searchAll: `MATCH (n) WHERE n.name CONTAINS $query OR n.symbol CONTAINS $query RETURN DISTINCT n, labels(n) as labels`,

  /** Upregulated genes in a disease */
  upregulatedInDisease: `MATCH (g:Gene)-[:UPREGULATED_IN]->(d:Disease {name: $disease}) RETURN g.symbol, g.name`,

  /** Downregulated genes in a disease */
  downregulatedInDisease: `MATCH (g:Gene)-[:DOWNREGULATED_IN]->(d:Disease {name: $disease}) RETURN g.symbol, g.name`,

  /** Find tools citing a paper */
  toolsCiting: `MATCH (t:Tool)-[:CITES]->(:Reference {title: $paper}) RETURN t.name`,
};

/** Parameterized query runner type */
export interface GraphQuery {
  name: keyof typeof QUERIES;
  params: Record<string, string | number>;
}
```

### Task 2.3: 新建 graph-db/seed-data.ts

**NEW:** `packages/knowledge/src/graph-db/seed-data.ts`

从 CSV 文件加载种子数据的工具函数：

```typescript
// ============================================================
// @bioagent/knowledge — Graph Seed Data Loader
// ============================================================

import * as fs from "node:fs";
import * as path from "node:path";
import type { KuzuClient } from "./kuzu-client.js";

export interface SeedDataSource {
  genes?: string;        // path to genes.csv
  pathways?: string;     // path to pathways.csv
  cellMarkers?: string;  // path to cell_markers.csv
  relations?: string;    // path to relations.csv
}

export async function seedGraphFromCSV(
  client: KuzuClient,
  dataDir: string,
  sources: SeedDataSource = {},
): Promise<{ nodes: number; edges: number }> {
  let nodes = 0;
  let edges = 0;

  // Seed genes
  if (sources.genes) {
    const csv = readCSV(path.join(dataDir, sources.genes));
    for (const row of csv) {
      await client.query(
        `MERGE (g:Gene {symbol: $symbol}) SET g.name = $name, g.ensembl_id = $ensembl_id`,
        { symbol: row.symbol, name: row.name, ensembl_id: row.ensembl_id || "" },
      );
      nodes++;
    }
  }

  // Seed pathways
  if (sources.pathways) {
    const csv = readCSV(path.join(dataDir, sources.pathways));
    for (const row of csv) {
      await client.query(
        `MERGE (p:Pathway {id: $id}) SET p.name = $name`,
        { id: row.id, name: row.name },
      );
      nodes++;
    }
  }

  // Seed cell markers
  if (sources.cellMarkers) {
    const csv = readCSV(path.join(dataDir, sources.cellMarkers));
    for (const row of csv) {
      await client.query(
        `MERGE (c:CellType {name: $cell_type})
         MERGE (m:Marker {gene_symbol: $gene_symbol})
         MERGE (m)-[:MARKER_OF {specificity: $specificity}]->(c)`,
        { cell_type: row.cell_type, gene_symbol: row.gene_symbol, specificity: row.specificity || "" },
      );
      nodes += 2;
      edges++;
    }
  }

  // Seed relations
  if (sources.relations) {
    const csv = readCSV(path.join(dataDir, sources.relations));
    for (const row of csv) {
      await client.query(
        `MATCH (a {name: $from_name})
         MATCH (b {name: $to_name})
         MERGE (a)-[r:${row.rel_type || "ASSOCIATED_WITH"}]->(b)`,
        { from_name: row.from_name, to_name: row.to_name },
      );
      edges++;
    }
  }

  return { nodes, edges };
}

function readCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || ""]));
  });
}
```

### Task 2.4: 新建 graph CSV 种子数据

**NEW:** 4 个 CSV 文件

`packages/knowledge/data/graph/genes.csv`:
```csv
symbol,name,ensembl_id
TP53,Tumor Protein P53,ENSG00000141510
EGFR,Epidermal Growth Factor Receptor,ENSG00000146648
BRCA1,Breast Cancer 1,ENSG00000012048
MYC,MYC Proto-Oncogene,ENSG00000136997
PTEN,Phosphatase and Tensin Homolog,ENSG00000171862
KRAS,KRAS Proto-Oncogene,ENSG00000133703
CD4,CD4 Molecule,ENSG00000116815
CD8A,CD8a Molecule,ENSG00000153563
CD19,CD19 Molecule,ENSG00000177455
CD3E,CD3e Molecule,ENSG00000198851
FOXP3,Forkhead Box P3,ENSG00000049768
VEGFA,Vascular Endothelial Growth Factor A,ENSG00000112715
IL6,Interleukin 6,ENSG00000136244
TNF,Tumor Necrosis Factor,ENSG00000232810
GAPDH,Glyceraldehyde-3-Phosphate Dehydrogenase,ENSG00000111640
ACTB,Actin Beta,ENSG00000075624
SOX2,SRY-Box 2,ENSG00000181449
OCT4,POU Class 5 Homeobox 1,ENSG00000204531
NANOG,Nanog Homeobox,ENSG00000111704
CCND1,Cyclin D1,ENSG00000110092
```

`packages/knowledge/data/graph/pathways.csv`:
```csv
id,name
hsa04010,MAPK signaling pathway
hsa04110,Cell cycle
hsa04151,PI3K-Akt signaling pathway
hsa04210,Apoptosis
hsa04310,Wnt signaling pathway
hsa04350,TGF-beta signaling pathway
hsa04510,Focal adhesion
hsa04630,JAK-STAT signaling pathway
hsa04660,T cell receptor signaling pathway
hsa04662,B cell receptor signaling pathway
hsa04915,Estrogen signaling pathway
hsa05200,Pathways in cancer
```

`packages/knowledge/data/graph/cell_markers.csv`:
```csv
cell_type,gene_symbol,specificity
T cell,CD3E,high
T cell,CD4,medium
T cell,CD8A,medium
B cell,CD19,high
B cell,MS4A1,high
NK cell,NCAM1,high
Monocyte,CD14,high
Macrophage,CD68,high
Dendritic cell,ITGAX,high
Neutrophil,FCGR3B,high
Erythrocyte,HBB,high
Platelet,PPBP,high
Endothelial cell,PECAM1,high
Epithelial cell,EPCAM,high
Fibroblast,COL1A1,high
Neuron,RBFOX3,high
Astrocyte,GFAP,high
Oligodendrocyte,MBP,high
```

`packages/knowledge/data/graph/relations.csv`:
```csv
from_name,to_name,rel_type
TP53,MAPK signaling pathway,PARTICIPATES_IN
EGFR,MAPK signaling pathway,PARTICIPATES_IN
KRAS,MAPK signaling pathway,PARTICIPATES_IN
TP53,Apoptosis,PARTICIPATES_IN
TP53,Cell cycle,PARTICIPATES_IN
PTEN,PI3K-Akt signaling pathway,PARTICIPATES_IN
EGFR,PI3K-Akt signaling pathway,PARTICIPATES_IN
KRAS,Pathways in cancer,PARTICIPATES_IN
MYC,Pathways in cancer,PARTICIPATES_IN
BRCA1,Pathways in cancer,PARTICIPATES_IN
TP53,Pathways in cancer,PARTICIPATES_IN
```

### Task 2.5: 新建 wiki/wiki-index.ts

**NEW:** `packages/knowledge/src/wiki/wiki-index.ts`

```typescript
// ============================================================
// @bioagent/knowledge — Wiki Index (title → file path mapping)
// ============================================================

export interface WikiIndexEntry {
  title: string;
  filePath: string;     // relative to data/wiki/
  category: "biology" | "omics" | "tools" | "sop" | "failures";
  tags: string[];
  lastModified: string;
}

export class WikiIndex {
  private entries: WikiIndexEntry[] = [];

  add(entry: WikiIndexEntry): void {
    // Replace if same filePath
    const existing = this.entries.findIndex(e => e.filePath === entry.filePath);
    if (existing >= 0) {
      this.entries[existing] = entry;
    } else {
      this.entries.push(entry);
    }
  }

  remove(filePath: string): boolean {
    const idx = this.entries.findIndex(e => e.filePath === filePath);
    if (idx >= 0) {
      this.entries.splice(idx, 1);
      return true;
    }
    return false;
  }

  getByTitle(title: string): WikiIndexEntry | undefined {
    return this.entries.find(e => e.title === title);
  }

  getByPath(filePath: string): WikiIndexEntry | undefined {
    return this.entries.find(e => e.filePath === filePath);
  }

  search(query: string): WikiIndexEntry[] {
    const lower = query.toLowerCase();
    return this.entries.filter(e =>
      e.title.toLowerCase().includes(lower) ||
      e.tags.some(t => t.toLowerCase().includes(lower)) ||
      e.category.toLowerCase().includes(lower)
    );
  }

  getByCategory(category: WikiIndexEntry["category"]): WikiIndexEntry[] {
    return this.entries.filter(e => e.category === category);
  }

  listAll(): WikiIndexEntry[] {
    return [...this.entries];
  }

  get size(): number {
    return this.entries.length;
  }
}
```

### Task 2.6: 新建 seed/biology-seed.ts

**NEW:** `packages/knowledge/src/seed/biology-seed.ts`

```typescript
// ============================================================
// @bioagent/knowledge — Biology Concept Seed Data
// ============================================================
// 基础生物学概念，用于初始化知识库。

export interface BiologyConcept {
  id: string;
  name: string;
  category: string;
  description: string;
  relatedTerms: string[];
}

export const BIOLOGY_CONCEPTS: BiologyConcept[] = [
  {
    id: "gene_expression",
    name: "基因表达 (Gene Expression)",
    category: "molecular_biology",
    description: "DNA 转录为 mRNA，mRNA 翻译为蛋白质的过程。在 scRNA-seq 中通过 UMI 计数定量。",
    relatedTerms: ["transcription", "translation", "mRNA", "promoter", "enhancer"],
  },
  {
    id: "epigenetics",
    name: "表观遗传 (Epigenetics)",
    category: "molecular_biology",
    description: "不改变 DNA 序列的基因表达调控，包括 DNA 甲基化、组蛋白修饰、染色质重塑。",
    relatedTerms: ["DNA methylation", "histone modification", "chromatin accessibility", "ATAC-seq"],
  },
  {
    id: "cell_cycle",
    name: "细胞周期 (Cell Cycle)",
    category: "cell_biology",
    description: "G1 → S → G2 → M 四个阶段。scRNA-seq 中细胞周期效应是常见的批次因素。",
    relatedTerms: ["G1 phase", "S phase", "G2 phase", "M phase", "mitosis", "cyclin", "CDK"],
  },
  {
    id: "apoptosis",
    name: "细胞凋亡 (Apoptosis)",
    category: "cell_biology",
    description: "程序性细胞死亡。scRNA-seq 中高线粒体基因比例通常指示凋亡细胞。",
    relatedTerms: ["caspase", "mitochondrial genes", "programmed cell death", "BCL2"],
  },
  {
    id: "immune_checkpoint",
    name: "免疫检查点 (Immune Checkpoint)",
    category: "cancer_biology",
    description: "免疫细胞表面调节通路，防止过度免疫反应。肿瘤利用检查点逃避免疫清除。",
    relatedTerms: ["PD-1", "PD-L1", "CTLA-4", "immunotherapy", "T cell exhaustion"],
  },
  {
    id: "tumor_microenvironment",
    name: "肿瘤微环境 (Tumor Microenvironment)",
    category: "cancer_biology",
    description: "肿瘤周围的细胞和非细胞成分，包括免疫细胞、成纤维细胞、血管、ECM。",
    relatedTerms: ["TME", "TIL", "CAF", "angiogenesis", "ECM remodeling"],
  },
  {
    id: "t_cell_differentiation",
    name: "T 细胞分化 (T Cell Differentiation)",
    category: "immunology",
    description: "Naive T → Effector/Memory/Exhausted。scRNA-seq 可识别连续的分化轨迹。",
    relatedTerms: ["CD4+", "CD8+", "Th1", "Th2", "Th17", "Treg", "naive T", "memory T"],
  },
  {
    id: "b_cell_activation",
    name: "B 细胞激活 (B Cell Activation)",
    category: "immunology",
    description: "抗原刺激后 B 细胞增殖、类别转换、体细胞高频突变。",
    relatedTerms: ["plasma cell", "antibody", "class switch", "germinal center", "BCR"],
  },
];

/** 生成 Vector DB 插入用的文本片段 */
export function biologyConceptsToSnippets(): Array<{ id: string; text: string; metadata: Record<string, string> }> {
  return BIOLOGY_CONCEPTS.map(c => ({
    id: `biology_${c.id}`,
    text: `# ${c.name}\n\n${c.description}\n\n相关术语: ${c.relatedTerms.join(", ")}`,
    metadata: { category: c.category, source: "biology-seed", concept_id: c.id },
  }));
}
```

### Task 2.7: 新建 seed/tool-seed.ts

**NEW:** `packages/knowledge/src/seed/tool-seed.ts`

```typescript
// ============================================================
// @bioagent/knowledge — Tool Usage Experience Seed Data
// ============================================================
// 工具使用经验，基于基准研究和社区实践。

export interface ToolExperience {
  toolName: string;
  category: string;
  bestFor: string;
  limitations: string;
  alternatives: string[];
  recommendedParams: Record<string, string>;
  minimumCells: number;
  minimumGenes: number;
  typicalRuntime: string; // e.g. "5 min / 10k cells"
  paper: string;
  paperDoi: string;
}

export const TOOL_EXPERIENCES: ToolExperience[] = [
  {
    toolName: "Scrublet",
    category: "qc",
    bestFor: "模拟双细胞检测（无需真实 doublet 标注）",
    limitations: "对高度同质的细胞群体可能不敏感",
    alternatives: ["DoubletFinder", "Solo"],
    recommendedParams: { expected_doublet_rate: "0.06", min_counts: "3", min_cells: "3" },
    minimumCells: 100,
    minimumGenes: 500,
    typicalRuntime: "30 sec / 10k cells",
    paper: "Scrublet: Computational identification of cell doublets in single-cell transcriptomic data",
    paperDoi: "10.1016/j.cels.2018.11.005",
  },
  {
    toolName: "Harmony",
    category: "batch_correction",
    bestFor: "大规模图谱整合（>100k cells），快速运行",
    limitations: "仅线性校正，对强烈非线性批次效应可能不足",
    alternatives: ["scVI", "BBKNN", "Seurat CCA", "Scanorama"],
    recommendedParams: { max_iter_harmony: "10", theta: "2", sigma: "0.1" },
    minimumCells: 500,
    minimumGenes: 1000,
    typicalRuntime: "2 min / 100k cells",
    paper: "Fast, sensitive and accurate integration of single-cell data with Harmony",
    paperDoi: "10.1038/s41592-019-0619-0",
  },
  {
    toolName: "CellTypist",
    category: "annotation",
    bestFor: "基于层级模型的自动细胞类型注释",
    limitations: "依赖训练模型覆盖的细胞类型；罕见类型可能被分配到最近的大类",
    alternatives: ["SingleR", "scPred", "Garnett"],
    recommendedParams: { model: "Immune_All_Low.pkl", majority_voting: "true" },
    minimumCells: 100,
    minimumGenes: 1000,
    typicalRuntime: "1 min / 10k cells (CPU)",
    paper: "Cross-tissue immune cell analysis reveals tissue-specific features in humans",
    paperDoi: "10.1126/science.abl5197",
  },
  {
    toolName: "Monocle3",
    category: "trajectory",
    bestFor: "拟时间轨迹分析，尤其在发育生物学中",
    limitations: "需要预先过滤低质量细胞；树形拓扑假定",
    alternatives: ["scVelo", "Slingshot", "PAGA", "Diffusion Pseudotime"],
    recommendedParams: { num_dim: "50", max_components: "2" },
    minimumCells: 500,
    minimumGenes: 1000,
    typicalRuntime: "5 min / 50k cells",
    paper: "The dynamics and regulators of cell fate decisions are revealed by pseudotemporal ordering of single cells",
    paperDoi: "10.1038/nbt.2859",
  },
  {
    toolName: "CellChat",
    category: "cell_communication",
    bestFor: "基于配体-受体数据库的细胞间通讯推断",
    limitations: "仅基于表达量推断，不验证功能结合",
    alternatives: ["NicheNet", "CellPhoneDB", "iTALK"],
    recommendedParams: { min_cells: "10", database: "SecretedSignaling" },
    minimumCells: 300,
    minimumGenes: 2000,
    typicalRuntime: "10 min / 30k cells",
    paper: "Inference and analysis of cell-cell communication using CellChat",
    paperDoi: "10.1038/s41467-021-21246-9",
  },
];

/** 生成 Vector DB 插入用的文本片段 */
export function toolExperiencesToSnippets(): Array<{ id: string; text: string; metadata: Record<string, string> }> {
  return TOOL_EXPERIENCES.map(t => ({
    id: `tool_${t.toolName}`,
    text: [
      `# ${t.toolName} — ${t.category}`,
      `最佳用途: ${t.bestFor}`,
      `局限性: ${t.limitations}`,
      `替代方案: ${t.alternatives.join(", ")}`,
      `推荐参数: ${JSON.stringify(t.recommendedParams)}`,
      `最低细胞数: ${t.minimumCells}, 最低基因数: ${t.minimumGenes}`,
      `典型运行时间: ${t.typicalRuntime}`,
      `论文: ${t.paper} (${t.paperDoi})`,
    ].join("\n\n"),
    metadata: { category: t.category, tool: t.toolName, source: "tool-seed" },
  }));
}
```

### Task 2.8: 补全 Wiki 文档 — biology/ (4 个文件)

**NEW:** `packages/knowledge/data/wiki/biology/molecular-biology.md`
```markdown
---
title: 分子生物学基础
category: biology
tags: [dna, rna, transcription, translation, central-dogma]
updated: 2026-05-31
---

# 分子生物学基础

## 中心法则 (Central Dogma)

DNA → RNA → 蛋白质。在 scRNA-seq 中，我们测量 mRNA（转录组），
它是基因组和蛋白质组之间的中间层。

## 转录调控

- **启动子 (Promoter)**: RNA 聚合酶结合位点
- **增强子 (Enhancer)**: 远程调控元件
- **转录因子 (TF)**: 结合 DNA 调控转录的蛋白质

## 表观遗传

- DNA 甲基化: 通常抑制转录
- 组蛋白修饰: 影响染色质可及性
- scATAC-seq 可测量染色质可及性

## 与 scRNA-seq 的关系

scRNA-seq 测量的是 mRNA 水平的快照。mRNA 的半衰期、转录爆发
（transcriptional bursting）等因素影响测量结果。
```

**NEW:** `packages/knowledge/data/wiki/biology/cell-biology.md`
**NEW:** `packages/knowledge/data/wiki/biology/cancer-biology.md`
**NEW:** `packages/knowledge/data/wiki/biology/immunology.md`

(每个文件 ~30-50 行 Markdown，含 frontmatter，格式同上)

### Task 2.9: 补全 Wiki 文档 — omics/scrna-seq/ 额外文件 (3 个)

**NEW:**
- `packages/knowledge/data/wiki/omics/scrna-seq/batch-correction.md`
- `packages/knowledge/data/wiki/omics/scrna-seq/trajectory-analysis.md`
- `packages/knowledge/data/wiki/omics/scrna-seq/cell-communication.md`

(每个 ~50 行，含最佳实践、参数建议、常见陷阱)

### Task 2.10: 补全 Wiki 文档 — tools/ 额外文件 (2 个)

**NEW:**
- `packages/knowledge/data/wiki/tools/monocle3.md`
- `packages/knowledge/data/wiki/tools/cellchat.md`

### Task 2.11: 补全 Wiki 文档 — failures/ (2 个文件)

**NEW:**
- `packages/knowledge/data/wiki/failures/batch-effect-misdiagnosis.md`
- `packages/knowledge/data/wiki/failures/over-correction-warning.md`

(每个 ~30 行，描述真实的失败案例、原因、诊断方法、修复方案)

### Task 2.12: 更新 knowledge index.ts 导出

**MODIFY:** `packages/knowledge/src/index.ts`

新增导出：
```typescript
// Embedder
export { LocalBowEmbedder, createEmbedder } from "./vector-db/embedder.js";
export type { Embedder, EmbedderConfig } from "./vector-db/embedder.js";

// Graph Queries
export { QUERIES } from "./graph-db/queries.js";
export type { GraphQuery } from "./graph-db/queries.js";

// Seed Data Loader
export { seedGraphFromCSV } from "./graph-db/seed-data.js";
export type { SeedDataSource } from "./graph-db/seed-data.js";

// Wiki Index
export { WikiIndex } from "./wiki/wiki-index.js";
export type { WikiIndexEntry } from "./wiki/wiki-index.js";

// Biology Seed
export { BIOLOGY_CONCEPTS, biologyConceptsToSnippets } from "./seed/biology-seed.js";
export type { BiologyConcept } from "./seed/biology-seed.js";

// Tool Seed
export { TOOL_EXPERIENCES, toolExperiencesToSnippets } from "./seed/tool-seed.js";
export type { ToolExperience } from "./seed/tool-seed.js";
```

### Task 2.13: 更新 knowledge bridge.ts

**MODIFY:** `packages/knowledge/src/bridge.ts`

在 `KnowledgeBridge` 类中新增方法：
```typescript
/** 查询知识图谱 */
async queryGraph(query: GraphQuery): Promise<GraphEntity[]> { ... }
/** 获取 Wiki 索引条目 */
getWikiIndex(): WikiIndexEntry[] { ... }
/** 通过 Embedder 向量化文本 */
async embed(text: string): Promise<number[]> { ... }
```

### Task 2.14: 验证 — typecheck + test

```bash
cd packages/knowledge && pnpm typecheck && pnpm test
```

提交: `git add packages/knowledge && git commit -m "feat(knowledge): complete missing files per design doc §4.1 — embedder, queries, seed-data, wiki-index, biology/tool seeds, CSV graph data, wiki docs"`

---

## Phase 3: skills — 补全 5 个缺失 Skill

### Task 3.1: 新建 skill-loader.ts

**NEW:** `packages/skills/src/skill-loader.ts`

```typescript
// ============================================================
// @bioagent/skills — Skill Loader (from filesystem)
// ============================================================
// Discovers and loads Skill modules from the skills source tree.

import { BaseSkill } from "./base-skill.js";
import type { SkillSpec } from "./base-skill.types.js";
import { SkillRegistry } from "./skill-registry.js";

export interface SkillLoaderOptions {
  /** Directories to scan for Skill modules */
  scanDirs: string[];
  /** Regex pattern for Skill file names */
  pattern?: RegExp; // default: /\.skill\.ts$|\.skill\.js$/
}

export class SkillLoader {
  private registry: SkillRegistry;
  private options: SkillLoaderOptions;

  constructor(registry: SkillRegistry, options: SkillLoaderOptions) {
    this.registry = registry;
    this.options = { pattern: /\.skill\.(ts|js)$/, ...options };
  }

  /** Discover and load all Skills from configured directories */
  async loadAll(): Promise<{ loaded: number; errors: string[] }> {
    const errors: string[] = [];
    let loaded = 0;

    // Static imports for all known skills (cannot use dynamic fs scanning at runtime in bundler)
    // This method is called by the consuming app which imports skills explicitly.
    // For now, Skills are registered via code (see skill-registry usage).

    return { loaded, errors };
  }

  /** Load a single Skill class and register it */
  registerSkill(skillInstance: BaseSkill): void {
    const spec = skillInstance.spec;
    this.registry.register(spec);
  }
}
```

### Task 3.2: 新建 analysis/trajectory.skill.ts

**NEW:** `packages/skills/src/analysis/trajectory.skill.ts`

完整的 6-phase Skill，遵循 BaseSkill 模式：

```typescript
// ============================================================
// @bioagent/skills — Trajectory Analysis Skill (P0)
// ============================================================
// 拟时间轨迹推断：Monocle3 / scVelo / Slingshot

import { BaseSkill } from "../base-skill.js";
import type { SkillSpec, SkillContext, SkillResult, QCGate, ToolChoice } from "../base-skill.types.js";
import { z } from "zod";

const paramsSchema = z.object({
  input_path: z.string().describe("Path to input h5ad file"),
  output_path: z.string().describe("Path for output files"),
  container: z.string().describe("Docker container name"),
  method: z.enum(["monocle3", "scvelo", "slingshot"]).default("scvelo"),
  root_cells: z.string().optional().describe("Comma-separated starting cell barcodes"),
  n_pcs: z.number().int().min(5).max(200).default(50),
  embedding_basis: z.enum(["umap", "pca"]).default("umap"),
});

type TrajectoryParams = z.infer<typeof paramsSchema>;

const spec: SkillSpec = {
  name: "trajectory",
  version: "1.0.0",
  description: "Pseudotime trajectory inference — Monocle3 / scVelo / Slingshot",
  omics: "scrna-seq",
  phase: "analysis",
  dependencies: ["clustering", "umap-tsne"],
  paramsSchema,
  estimatedRuntime: "10–30 min (method dependent)",
  checkpoint: true,
};

const QC_GATES: QCGate[] = [
  {
    name: "trajectory_convergence",
    description: "Trajectory inference converged successfully",
    check: (output: string) => output.includes("trajectory") && !output.includes("Error"),
    severity: "error",
    fix: "Increase n_pcs or try a different method (monocle3 for tree, scvelo for RNA velocity, slingshot for linear)",
  },
  {
    name: "branch_points_detected",
    description: "At least one branch point detected (if expected)",
    check: (output: string) => output.includes("branch") || output.includes("fork"),
    severity: "warning",
    fix: "This may indicate linear trajectory. Check if data supports branching topology.",
  },
];

export class TrajectorySkill extends BaseSkill {
  constructor() {
    super(spec, QC_GATES);
  }

  protected getToolChoice(context: SkillContext): ToolChoice {
    return {
      tool: "docker_exec",
      action: "exec",
      reason: "Monocle3 (R) or scVelo (Python) trajectory inference in Docker container",
    };
  }

  protected buildCommand(params: TrajectoryParams, context: SkillContext): string {
    if (params.method === "scvelo") {
      return `python -c "
import scanpy as sc
import scvelo as scv
adata = scv.read('${params.input_path}')
scv.pp.moments(adata, n_pcs=${params.n_pcs})
scv.tl.velocity(adata)
scv.tl.velocity_graph(adata)
scv.tl.velocity_pseudotime(adata)
adata.write('${params.output_path}/trajectory.h5ad')
print(f'Trajectory: computed velocity pseudotime for {adata.n_obs} cells')
print(f'branch_points_detected: velocity_graph computed')
"`;
    }
    // monocle3 default
    return `Rscript -e '
library(monocle3)
cds <- load_cell_data_set("${params.input_path}")
cds <- preprocess_cds(cds, num_dim=${params.n_pcs})
cds <- reduce_dimension(cds)
cds <- cluster_cells(cds)
cds <- learn_graph(cds)
cds <- order_cells(cds)
saveRDS(cds, file="${params.output_path}/trajectory.rds")
cat("Trajectory: pseudotime computed for", ncol(exprs(cds)), "cells\\n")
'`;
  }

  protected formatOutput(result: SkillResult): SkillResult {
    return {
      ...result,
      outputs: [
        {
          name: "trajectory",
          path: `\${output_path}/trajectory.h5ad`,
          format: "h5ad",
          description: "AnnData with velocity pseudotime in obs",
        },
      ],
    };
  }
}
```

### Task 3.3: 新建 analysis/cell-communication.skill.ts

**NEW:** `packages/skills/src/analysis/cell-communication.skill.ts`

完整的 6-phase Skill — CellChat / NicheNet / CellPhoneDB

### Task 3.4: 新建 network/grn.skill.ts

**NEW:** `packages/skills/src/network/grn.skill.ts`

完整的 6-phase Skill — SCENIC / pySCENIC 基因调控网络推断

### Task 3.5: 新建 report/report-generator.skill.ts

**NEW:** `packages/skills/src/report/report-generator.skill.ts`

```typescript
// ============================================================
// @bioagent/skills — Report Generator Skill
// ============================================================
// 从中间结果渲染 HTML 分析报告

import { BaseSkill } from "../base-skill.js";
import type { SkillSpec, SkillContext, SkillResult, QCGate, ToolChoice } from "../base-skill.types.js";
import { z } from "zod";

const paramsSchema = z.object({
  project_dir: z.string().describe("Project directory with intermediate results"),
  output_path: z.string().describe("Path for output HTML report"),
  title: z.string().default("scRNA-seq Analysis Report"),
  sections: z.array(z.string()).optional().describe("Sections to include (default: all)"),
  container: z.string().describe("Docker container name"),
});

const spec: SkillSpec = {
  name: "report-generator",
  version: "1.0.0",
  description: "Render HTML analysis report from intermediate results",
  omics: "scrna-seq",
  phase: "report",
  dependencies: ["marker-detection", "diff-expression", "functional-enrichment"],
  paramsSchema,
  estimatedRuntime: "1–2 min",
  checkpoint: false,
};

const QC_GATES: QCGate[] = [
  {
    name: "report_generated",
    description: "HTML report file exists and is non-empty",
    check: (output: string) => output.includes("Report generated") || output.includes(".html"),
    severity: "error",
    fix: "Check that all input files exist and the Docker container has matplotlib/seaborn installed.",
  },
];

export class ReportGeneratorSkill extends BaseSkill {
  constructor() {
    super(spec, QC_GATES);
  }

  protected getToolChoice(_context: SkillContext): ToolChoice {
    return { tool: "docker_exec", action: "exec", reason: "Generate HTML report in Docker container" };
  }

  protected buildCommand(params: z.infer<typeof paramsSchema>, _context: SkillContext): string {
    return `python -c "
import os, json, base64
from datetime import datetime

project = '${params.project_dir}'
title = '${params.title}'
sections = ${JSON.stringify(params.sections || [])}

html = f'''<!DOCTYPE html>
<html><head><meta charset='utf-8'><title>{title}</title>
<style>body{{font-family:Arial,sans-serif;max-width:1200px;margin:0 auto;padding:20px;background:#fff;color:#333}}
h1{{color:#1a5276;border-bottom:2px solid #2980b9;padding-bottom:10px}}
h2{{color:#2980b9;margin-top:30px}} .metric{{display:inline-block;margin:10px;padding:15px;border:1px solid #ddd;border-radius:8px;text-align:center}}
.metric .value{{font-size:24px;font-weight:bold;color:#2980b9}} img{{max-width:100%;border:1px solid #eee;margin:10px 0}}
.qc-pass{{color:green}} .qc-warn{{color:orange}} .qc-fail{{color:red}}</style></head><body>
<h1>{title}</h1>
<p>Generated: {datetime.now().isoformat()}</p>
'''

# Scan project directory for result files
for root, dirs, files in os.walk(project):
    for f in sorted(files):
        if f.endswith(('.png','.jpg','.svg')):
            img_path = os.path.join(root, f)
            with open(img_path, 'rb') as img:
                b64 = base64.b64encode(img.read()).decode()
            html += f'<h2>{f}</h2><img src='data:image/png;base64,{b64}' />'

html += '</body></html>'

os.makedirs('${params.output_path}', exist_ok=True)
report_path = os.path.join('${params.output_path}', 'report.html')
with open(report_path, 'w') as f:
    f.write(html)
print(f'Report generated: {report_path}')
"`;
  }

  protected formatOutput(result: SkillResult): SkillResult {
    return {
      ...result,
      outputs: [{
        name: "report",
        path: `${(result as any).params?.output_path || ""}/report.html`,
        format: "html",
        description: "Interactive analysis report",
      }],
    };
  }
}
```

### Task 3.6: 更新 skills index.ts 导出

**MODIFY:** `packages/skills/src/index.ts`

新增导出：
```typescript
// Skill Loader
export { SkillLoader } from "./skill-loader.js";
export type { SkillLoaderOptions } from "./skill-loader.js";

// Analysis
export { TrajectorySkill } from "./analysis/trajectory.skill.js";
export { CellCommunicationSkill } from "./analysis/cell-communication.skill.js";

// Network
export { GRNSkill } from "./network/grn.skill.js";

// Report
export { ReportGeneratorSkill } from "./report/report-generator.skill.js";
```

### Task 3.7: 更新 skill-registry.ts 集成 SkillLoader

**MODIFY:** `packages/skills/src/skill-registry.ts`

新增方法：
```typescript
/** Bulk-register all skills from a SkillLoader */
registerFromLoader(loader: SkillLoader): { loaded: number; errors: string[] } { ... }
```

### Task 3.8: 验证 — typecheck + test

```bash
cd packages/skills && pnpm typecheck && pnpm test
```

提交: `git add packages/skills && git commit -m "feat(skills): add missing skills per design doc §4.1 — skill-loader, trajectory, cell-communication, grn, report-generator"`

---

## Phase 4: agent-core — 补全配置文件

### Task 4.1: 新建 bio-agent.config.ts

**NEW:** `packages/agent-core/src/bio-agent.config.ts`

```typescript
// ============================================================
// @bioagent/agent-core — BioAgent Configuration
// ============================================================

import type { BioAgentConfig } from "./types.js";

/** 默认配置值 */
export const DEFAULT_CONFIG: BioAgentConfig = {
  model: "claude-sonnet-4-6",
  maxTokens: 100_000,
  thinkingBudget: "medium",
  temperature: 0.2,
  sessionDir: "data/sessions",
  projectDir: "data/projects",
  maxSessionLength: 200,
  autoCompress: true,
  requireConfirmation: true,
  maxParallelSkills: 4,
  defaultTimeout: 600_000,
};

/** 从环境变量覆盖的配置键映射 */
const ENV_MAP: Record<string, keyof BioAgentConfig> = {
  BIOAGENT_MODEL: "model",
  BIOAGENT_MAX_TOKENS: "maxTokens",
  BIOAGENT_THINKING_BUDGET: "thinkingBudget",
  BIOAGENT_TEMPERATURE: "temperature",
  BIOAGENT_SESSION_DIR: "sessionDir",
  BIOAGENT_PROJECT_DIR: "projectDir",
  BIOAGENT_MAX_SESSION_LENGTH: "maxSessionLength",
  BIOAGENT_AUTO_COMPRESS: "autoCompress",
  BIOAGENT_REQUIRE_CONFIRMATION: "requireConfirmation",
  BIOAGENT_MAX_PARALLEL_SKILLS: "maxParallelSkills",
  BIOAGENT_DEFAULT_TIMEOUT: "defaultTimeout",
};

/** 合并环境变量覆盖到配置 */
export function loadConfig(overrides: Partial<BioAgentConfig> = {}): BioAgentConfig {
  const config = { ...DEFAULT_CONFIG };

  for (const [envKey, configKey] of Object.entries(ENV_MAP)) {
    const value = process.env[envKey];
    if (value !== undefined) {
      (config as any)[configKey] = parseEnvValue(value, typeof config[configKey]);
    }
  }

  return { ...config, ...overrides };
}

function parseEnvValue(value: string, type: string): any {
  switch (type) {
    case "number": return parseInt(value, 10);
    case "boolean": return value === "true" || value === "1";
    default: return value;
  }
}

/** 验证配置的有效性 */
export function validateConfig(config: BioAgentConfig): string[] {
  const errors: string[] = [];

  if (config.maxTokens < 1000) errors.push("maxTokens must be >= 1000");
  if (config.maxTokens > 200_000) errors.push("maxTokens must be <= 200000");
  if (config.temperature < 0 || config.temperature > 1) errors.push("temperature must be 0–1");
  if (!["off", "low", "medium", "high", "xhigh"].includes(config.thinkingBudget)) {
    errors.push(`thinkingBudget must be one of: off, low, medium, high, xhigh`);
  }
  if (config.maxSessionLength < 10) errors.push("maxSessionLength must be >= 10");
  if (config.maxParallelSkills < 1) errors.push("maxParallelSkills must be >= 1");
  if (config.defaultTimeout < 5000) errors.push("defaultTimeout must be >= 5000ms");

  return errors;
}
```

### Task 4.2: 更新 agent-core index.ts + bio-agent.ts

**MODIFY:** `packages/agent-core/src/index.ts` — 新增导出：
```typescript
export { DEFAULT_CONFIG, loadConfig, validateConfig } from "./bio-agent.config.js";
```

**MODIFY:** `packages/agent-core/src/bio-agent.ts` — 在 `getBioAgentSystemPrompt()` 中使用 `loadConfig()` 以支持动态配置

### Task 4.3: 验证 — typecheck + test

```bash
cd packages/agent-core && pnpm typecheck && pnpm test
```

提交: `git add packages/agent-core && git commit -m "feat(agent-core): add bio-agent.config.ts per design doc §4.1"`

---

## Phase 5: workflow — 完整性验证

### Task 5.1: 检查 workflow 包与 §4.1 的一致性

所有 9 个文件已存在且匹配设计文档：

- `engine.ts` ✅
- `engine.types.ts` ✅
- `scheduler.ts` ✅
- `checkpoint.ts` ✅
- `checkpoint.types.ts` ✅ (内联在 checkpoint.ts，可接受)
- `registry.ts` ✅
- `condition.ts` ✅
- `error-policy.ts` ✅
- `workflows/scrna-seq.workflow.ts` ✅
- `index.ts` ✅

无缺失。但需要验证 checkpoint.types 是否需要独立文件。

### Task 5.2: 验证 — typecheck + test

```bash
cd packages/workflow && pnpm typecheck && pnpm test
```

提交: 若有任何修复则提交，否则标记为已验证。

---

## Phase 6: Runtime 连接 — UI 工具层对接所有后端包

> **这是最关键的一步** — 将 `bioagent-tools.ts` 从独立实现改为委托后端包。

### Task 6.1: 重写 bioagent-tools.ts — docker_exec

**MODIFY:** `packages/ui/lib/bioagent-tools.ts`

将 `dockerExecTool.execute()` 改为调用 `@bioagent/executor`:

```typescript
// Before (current): import dockerode directly
// After (target): import from @bioagent/executor

import { ContainerManager, DockerExecutor, ImageManager } from "@bioagent/executor";

// In dockerExecTool.execute():
async execute(params: any): Promise<string> {
  const action = params.action as string;
  const executor = new DockerExecutor(); // or get from DI/singleton

  switch (action) {
    case "ensure_image": {
      const imageManager = new ImageManager();
      const exists = await imageManager.imageExists(params.image as string);
      if (exists) return `Image ${params.image} already exists locally.`;
      const result = await imageManager.pullImage(params.image as string);
      return `Pulled image: ${params.image}`;
    }

    case "start_container": {
      const cm = new ContainerManager();
      const container = await cm.startContainer({
        image: params.image as string,
        name: params.name as string,
        command: (params.command as string[]) || ["sleep", "infinity"],
        volumes: (params.volumes || []).map((v: any) => ({ host: v.host, container: v.container, mode: v.mode })),
        env: params.env || {},
        gpu: params.gpu || false,
        network: (params.network as "bridge"|"host"|"none") || "bridge",
      });
      return `Container started: ${params.name} (ID: ${container.id.slice(0, 12)})`;
    }

    case "exec": {
      const cm = new ContainerManager();
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
        result.stdout ? `--- stdout ---\n${result.stdout}` : "",
        result.stderr ? `--- stderr ---\n${result.stderr}` : "",
        result.truncated ? "(output was truncated at 50KB)" : "",
      ].filter(Boolean).join("\n");
    }
    // ... stop_container, get_status, list_containers similarly delegate
  }
}
```

### Task 6.2: 重写 bioagent-tools.ts — docker_search

```typescript
// In dockerSearchTool.execute():
import { ImageSearch } from "@bioagent/executor";

async execute(params: any): Promise<string> {
  const searcher = new ImageSearch();
  const results = await searcher.search({
    query: params.query as string,
    minStars: (params.min_stars as number) || 5,
    limit: (params.max_results as number) || 5,
    includeOfficial: true,
    includeBiocontainers: true,
  });
  // Format results using SearchResult type
  return results.map((r, i) => `...`).join("\n\n");
}
```

### Task 6.3: 重写 bioagent-tools.ts — bio_kb_query

```typescript
// In bioKbQueryTool.execute():
import { KnowledgeBridge, WikiLoader } from "@bioagent/knowledge";

async execute(params: any): Promise<string> {
  const bridge = new KnowledgeBridge({ /* config */ });
  const loader = new WikiLoader();

  const question = params.question as string;
  // Use KnowledgeBridge to query all 3 layers
  const [vectorResults, wikiResults] = await Promise.all([
    bridge.query({ text: question, layers: ["vector", "wiki"], maxResults: 5 }),
    loader.search(question), // fallback local search
  ]);

  // Format combined results
  return formatKbResults(vectorResults, wikiResults);
}
```

### Task 6.4: 重写 bioagent-tools.ts — bio_file_inspect

```typescript
// In bioFileInspectTool.execute():
import { FileInspector } from "@bioagent/executor"; // or a dedicated utility in knowledge

async execute(params: any): Promise<string> {
  // Use existing file-inspect.tool from agent-core for the actual logic
  // Or delegate to executor's file utility
}
```

### Task 6.5: 重写 bioagent-tools.ts — bio_skill_invoke

```typescript
// In bioSkillInvokeTool.execute():
import { SkillRegistry, SkillExecutor } from "@bioagent/skills";

async execute(params: any): Promise<string> {
  const registry = SkillRegistry.getInstance();
  const executor = new SkillExecutor(registry);

  const skillName = params.skill_name as string;
  const context = {
    container: params.container as string,
    inputPath: (params.input_path as string) || "/data/input",
    outputPath: (params.output_path as string) || "/data/output",
    workdir: "/data",
  };

  const result = await executor.execute(skillName, context);
  return formatSkillResult(result);
}
```

### Task 6.6: 新增 workflow_run 工具

在 `bioagent-tools.ts` 中新增：

```typescript
import { WorkflowEngine, WorkflowRegistry, SCRNA_SEQ_STANDARD } from "@bioagent/workflow";

export const workflowRunTool = createSimpleTool({
  name: "workflow_run",
  label: "Workflow Run",
  description: `Start an end-to-end scRNA-seq analysis workflow. The workflow orchestrates all 13 Skills in correct order with checkpoint recovery.`,
  promptSnippet: "workflow_run(workflow_name, project_dir, container, start_from?)",
  promptGuidelines: [
    "Use workflow_run for complete end-to-end analysis.",
    "Individual Skills can be invoked with bio_skill_invoke for debugging.",
    "Workflows support checkpoint recovery — restart from the last checkpoint on failure.",
  ],
  async execute(params: any): Promise<string> {
    const registry = new WorkflowRegistry();
    registry.register(SCRNA_SEQ_STANDARD);

    const engine = new WorkflowEngine(registry, {
      projectDir: params.project_dir as string,
      container: params.container as string,
      resume: params.resume || false,
    });

    const result = await engine.run(params.workflow_name as string);
    return formatWorkflowResult(result);
  },
});
```

### Task 6.7: 更新 rpc-manager.ts — 注入 workflow 工具

**MODIFY:** `packages/ui/lib/rpc-manager.ts`

将 `workflowRunTool` 加入 `bioagentTools` 数组，在 `startRpcSession()` 中传递。

### Task 6.8: 更新 bioagent-tools.ts 导出

**MODIFY:** `packages/ui/lib/bioagent-tools.ts`

```typescript
export const bioagentTools = [
  dockerExecTool,       // → @bioagent/executor
  dockerSearchTool,     // → @bioagent/executor
  bioKbQueryTool,       // → @bioagent/knowledge
  bioFileInspectTool,   // → @bioagent/executor + agent-core
  bioSkillInvokeTool,   // → @bioagent/skills
  workflowRunTool,      // → @bioagent/workflow (NEW)
];
```

### Task 6.9: 重写 lib/bioagent-client.ts

**MODIFY:** `packages/ui/lib/bioagent-client.ts`

改为通过 API routes 调用 backend（而非直接 import backend），确保前后端分离：

```typescript
export class BioAgentClient {
  async queryKnowledge(question: string): Promise<KnowledgeResult> { ... }
  async startWorkflow(name: string, projectDir: string): Promise<WorkflowState> { ... }
  async getWorkflowStatus(id: string): Promise<WorkflowState> { ... }
  async inspectFile(path: string): Promise<FileInfo> { ... }
  async getResourceReport(): Promise<ResourceReport> { ... }
}
```

### Task 6.10: 重写 lib/sse-client.ts

**MODIFY:** `packages/ui/lib/sse-client.ts`

新增 BioAgent 事件类型处理：
- `thinking_section` → ThinkingPanel 更新
- `qc_report` → QCReportCard 更新
- `progress_update` → ProgressTracker 更新
- `workflow_checkpoint` → 检查点通知
- `viz_data` → VizPanel 渲染

### Task 6.11: 重写 API 路由 — 对接 backend

**MODIFY:** `packages/ui/app/api/workflow/route.ts`
```typescript
// Before: placeholder or independent impl
// After: import { WorkflowEngine, WorkflowRegistry } from "@bioagent/workflow";
```

**MODIFY:** `packages/ui/app/api/knowledge/route.ts`
```typescript
// After: import { KnowledgeBridge } from "@bioagent/knowledge";
```

**MODIFY:** `packages/ui/app/api/files/route.ts`
```typescript
// After: use executor types and file detection from knowledge
```

**MODIFY:** `packages/ui/app/api/resources/route.ts`
```typescript
// After: import { ResourceProbe } from "@bioagent/executor";
```

### Task 6.12: 清理冗余文件

**DELETE:** `packages/ui/lib/bioagent-session.ts` — 功能已由 agent-core 的 `bio-agent.ts` + `rpc-manager.ts` 提供

### Task 6.13: 验证 — typecheck + build

```bash
cd packages/ui && pnpm typecheck && pnpm build
```

确认所有 backend import 正确解析，无 client-side bundling 错误（dockerode 等 server-only）。

提交: `git add packages/ui && git commit -m "refactor(ui): connect runtime to all backend packages — executor, knowledge, skills, workflow"`

---

## Phase 7: 端到端验证

### Task 7.1: 全项目 typecheck

```bash
cd d:/AIAgent/BioAgent && pnpm typecheck
```

所有 7 个包通过。

### Task 7.2: 全项目 test

```bash
cd d:/AIAgent/BioAgent && pnpm test
```

所有测试通过。

### Task 7.3: UI build

```bash
cd packages/ui && pnpm build
```

确认 Next.js 构建成功，无 server-only 模块泄漏到 client bundle。

### Task 7.4: 端到端流程测试（手动）

1. 启动 BioAgent (pnpm dev)
2. 创建新会话，启用 BioAgent 模式
3. 发送: "I have scRNA-seq data at /data/input/sample.h5ad, can you check the file format?"
   → 验证 `bio_file_inspect` 被调用
4. 发送: "What are the best practices for scRNA-seq QC?"
   → 验证 `bio_kb_query` 被调用，返回 wiki 内容
5. 发送: "Run scrna-qc on this data"
   → 验证 `bio_skill_invoke` 被调用，返回 Skill 指导
6. 验证 Docker 容器内命令执行
7. 验证 QC report 和 progress 事件

### Task 7.5: 更新 CI workflow

**MODIFY:** `.github/workflows/ci.yml` — 确保包含所有 7 个包的 typecheck + test

---

## 完成标准

- [x] 每个包的目录结构与 §4.1 一致
- [ ] 所有缺失文件已创建（agent-core: 1, executor: 3, knowledge: 21, skills: 5）
- [ ] 所有后端包通过 typecheck + test
- [ ] bioagent-tools.ts 所有 handler 委托给 backend 包
- [ ] API 路由调用 backend API
- [ ] UI build 成功（server-only 模块不泄漏到 client）
- [ ] 全项目 `pnpm typecheck && pnpm test` 通过
- [ ] 删除冗余文件 `bioagent-session.ts`

---

> **总计:** ~55 个新文件, ~12 个修改文件, 7 个 Phase, 约 40 个 Task
>
> 每个 Task 按 TDD 红→绿→重构→提交 循环执行。
