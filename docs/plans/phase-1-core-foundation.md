# Phase 1: 核心基础 — Agent Core + Knowledge Base

**目标:** 实现 BioAgent 运行时、三层知识体系、知识种子注入
**前置:** Phase 0 完成
**预计:** 11 天

---

## 文件结构

```
NEW:    packages/agent-core/src/bio-agent.ts
NEW:    packages/agent-core/src/bio-agent.config.ts
NEW:    packages/agent-core/src/thinking-engine.ts
NEW:    packages/agent-core/src/thinking-template.ts
NEW:    packages/agent-core/src/types.ts
NEW:    packages/agent-core/src/events/event-types.ts
NEW:    packages/agent-core/src/session/session-manager.ts
NEW:    packages/agent-core/src/tools/docker-exec.tool.ts
NEW:    packages/agent-core/src/tools/docker-search.tool.ts
NEW:    packages/agent-core/src/tools/docker-pull.tool.ts
NEW:    packages/agent-core/src/tools/docker-inspect.tool.ts
NEW:    packages/agent-core/src/tools/docker-verify.tool.ts
NEW:    packages/agent-core/src/tools/skill-invoke.tool.ts
NEW:    packages/agent-core/src/tools/kb-query.tool.ts
NEW:    packages/agent-core/src/tools/file-inspect.tool.ts
NEW:    packages/agent-core/src/tools/workflow-run.tool.ts
NEW:    packages/agent-core/src/tools/index.ts
NEW:    packages/agent-core/src/hooks/validation.hook.ts
NEW:    packages/agent-core/src/hooks/qc.hook.ts
NEW:    packages/agent-core/src/hooks/thinking.hook.ts
NEW:    packages/agent-core/src/messages/thinking.message.ts
NEW:    packages/agent-core/src/messages/qc-report.message.ts
NEW:    packages/agent-core/src/messages/progress.message.ts
NEW:    packages/agent-core/src/messages/viz.message.ts

NEW:    packages/knowledge/src/bridge.ts
NEW:    packages/knowledge/src/bridge.types.ts
NEW:    packages/knowledge/src/vector-db/chroma-client.ts
NEW:    packages/knowledge/src/vector-db/collections.ts
NEW:    packages/knowledge/src/vector-db/embedder.ts
NEW:    packages/knowledge/src/graph-db/kuzu-client.ts
NEW:    packages/knowledge/src/graph-db/schema.ts
NEW:    packages/knowledge/src/graph-db/queries.ts
NEW:    packages/knowledge/src/wiki/wiki-loader.ts
NEW:    packages/knowledge/src/wiki/wiki-index.ts
NEW:    packages/knowledge/src/wiki/wiki-parser.ts
NEW:    packages/knowledge/src/seed/seed-runner.ts
NEW:    packages/knowledge/src/seed/scrna-seed.ts
NEW:    packages/knowledge/src/seed/biology-seed.ts
NEW:    packages/knowledge/src/seed/tool-seed.ts
NEW:    packages/knowledge/src/index.ts

NEW:    packages/knowledge/data/wiki/biology/molecular-biology.md
NEW:    packages/knowledge/data/wiki/biology/cell-biology.md
NEW:    packages/knowledge/data/wiki/biology/cancer-biology.md
NEW:    packages/knowledge/data/wiki/biology/immunology.md
NEW:    packages/knowledge/data/wiki/omics/scrna-seq/overview.md
NEW:    packages/knowledge/data/wiki/omics/scrna-seq/qc-best-practices.md
NEW:    packages/knowledge/data/wiki/omics/scrna-seq/normalization-methods.md
NEW:    packages/knowledge/data/wiki/omics/scrna-seq/clustering-guide.md
NEW:    packages/knowledge/data/wiki/omics/scrna-seq/cell-annotation.md
NEW:    packages/knowledge/data/wiki/omics/scrna-seq/trajectory-analysis.md
NEW:    packages/knowledge/data/wiki/omics/scrna-seq/cell-communication.md
NEW:    packages/knowledge/data/wiki/tools/scanpy.md
NEW:    packages/knowledge/data/wiki/tools/seurat.md
NEW:    packages/knowledge/data/wiki/tools/monocle3.md
NEW:    packages/knowledge/data/wiki/tools/cellchat.md
NEW:    packages/knowledge/data/wiki/sop/scrna-standard-pipeline.md
NEW:    packages/knowledge/data/wiki/failures/batch-effect-misdiagnosis.md
NEW:    packages/knowledge/data/wiki/failures/over-correction-warning.md
NEW:    packages/knowledge/data/graph/genes.csv
NEW:    packages/knowledge/data/graph/pathways.csv
NEW:    packages/knowledge/data/graph/cell_markers.csv
NEW:    packages/knowledge/data/graph/relations.csv

NEW:    packages/knowledge/__tests__/bridge.test.ts
NEW:    packages/knowledge/__tests__/chroma-client.test.ts
NEW:    packages/knowledge/__tests__/kuzu-client.test.ts
NEW:    packages/knowledge/__tests__/wiki-loader.test.ts
NEW:    packages/agent-core/__tests__/thinking-engine.test.ts
NEW:    packages/agent-core/__tests__/session-manager.test.ts
NEW:    packages/agent-core/__tests__/tools/docker-exec.tool.test.ts
```

---

## Part A: Knowledge Base (先做，agent-core 依赖它)

### Task 1.1: ChromaDB Client — collections.ts + chroma-client.ts

定义 3 个 Collection（literature_snippets / analysis_cases / debug_logs），实现 CRUD + query。

```typescript
// packages/knowledge/src/vector-db/collections.ts
export const COLLECTIONS = {
  literature_snippets: {
    name: "literature_snippets",
    metadata: ["source_type", "doi", "url", "title", "topic", "year", "tool", "omics_type"],
    distance: "cosine" as const,
  },
  analysis_cases: {
    name: "analysis_cases",
    metadata: ["project_id", "omics_type", "tissue", "species", "cell_count", "success", "workflow_used", "created_at"],
    distance: "cosine" as const,
  },
  debug_logs: {
    name: "debug_logs",
    metadata: ["error_type", "tool", "skill", "resolved", "resolution", "os", "docker_image"],
    distance: "cosine" as const,
  },
} as const;
```

```typescript
// packages/knowledge/src/vector-db/chroma-client.ts
import { ChromaClient as Chroma } from "chromadb";
import { COLLECTIONS } from "./collections";

export class ChromaClientWrapper {
  private client: Chroma;

  constructor(url?: string) {
    this.client = new Chroma({ path: url || "http://localhost:8000" });
  }

  async initialize(): Promise<void> {
    for (const [key, config] of Object.entries(COLLECTIONS)) {
      try { await this.client.getCollection({ name: config.name }); }
      catch {
        await this.client.createCollection({
          name: config.name,
          metadata: { "hnsw:space": config.distance },
        });
      }
    }
  }

  async add(collectionName: string, documents: string[], metadatas: Record<string, any>[], ids: string[]): Promise<void> {
    const col = await this.client.getCollection({ name: collectionName });
    await col.add({ documents, metadatas, ids });
  }

  async query(collectionName: string, queryText: string, opts?: {
    nResults?: number; where?: Record<string, any>; minScore?: number;
  }): Promise<{ ids: string[]; documents: string[]; metadatas: Record<string, any>[]; distances: number[] }> {
    const col = await this.client.getCollection({ name: collectionName });
    const results = await col.query({
      queryTexts: [queryText],
      nResults: opts?.nResults ?? 5,
      where: opts?.where,
    });
    return {
      ids: results.ids[0] as string[],
      documents: results.documents[0] as string[],
      metadatas: (results.metadatas[0] as any) || [],
      distances: results.distances?.[0] as number[] || [],
    };
  }

  async deleteByFilter(collectionName: string, where: Record<string, any>): Promise<void> {
    const col = await this.client.getCollection({ name: collectionName });
    const results = await col.get({ where });
    if (results.ids.length > 0) await col.delete({ ids: results.ids as string[] });
  }

  async count(collectionName: string): Promise<number> {
    const col = await this.client.getCollection({ name: collectionName });
    return (await col.count()) as number;
  }
}
```

### Task 1.2: KuzuDB — schema.ts + kuzu-client.ts

实现 9 种节点类型 + 10 种关系类型的表创建，Cypher 查询模板，种子数据批量插入。

```typescript
// packages/knowledge/src/graph-db/schema.ts
export const NODE_TABLES = [
  { name: "Gene", schema: "(symbol STRING, ensembl_id STRING, full_name STRING, chromosome STRING, biotype STRING, PRIMARY KEY(symbol))" },
  { name: "Pathway", schema: "(id STRING, name STRING, source_db STRING, category STRING, PRIMARY KEY(id))" },
  { name: "Disease", schema: "(id STRING, name STRING, source STRING, category STRING, PRIMARY KEY(id))" },
  { name: "Drug", schema: "(name STRING, drugbank_id STRING, type STRING, approval_status STRING, PRIMARY KEY(name))" },
  { name: "CellType", schema: "(name STRING, ontology_id STRING, category STRING, species STRING, PRIMARY KEY(name))" },
  { name: "Tool", schema: "(name STRING, version STRING, language STRING, category STRING, docker_image STRING, PRIMARY KEY(name))" },
  { name: "Tissue", schema: "(name STRING, uberon_id STRING, PRIMARY KEY(name))" },
  { name: "GO_Term", schema: "(id STRING, name STRING, namespace STRING, PRIMARY KEY(id))" },
  { name: "Marker", schema: "(gene_symbol STRING, cell_type STRING, specificity STRING, source_db STRING, evidence STRING, PRIMARY KEY(gene_symbol))" },
];

export const REL_TABLES = [
  { name: "PARTICIPATES_IN", schema: "FROM Gene TO Pathway(confidence DOUBLE)" },
  { name: "ASSOCIATED_WITH", schema: "FROM Gene TO Disease(association_type STRING, evidence STRING, pmid STRING)" },
  { name: "TARGETS", schema: "FROM Drug TO Gene(mechanism STRING, affinity STRING)" },
  { name: "MARKER_OF", schema: "FROM Gene TO CellType(specificity STRING, source_db STRING)" },
  { name: "LOCATED_IN", schema: "FROM CellType TO Tissue(frequency STRING)" },
  { name: "INTERACTS_WITH", schema: "FROM Gene TO Gene(interaction_type STRING, source_db STRING, score DOUBLE)" },
  { name: "UPREGULATED_IN", schema: "FROM Gene TO Disease(fold_change DOUBLE, pmid STRING)" },
  { name: "DOWNREGULATED_IN", schema: "FROM Gene TO Disease(fold_change DOUBLE, pmid STRING)" },
  { name: "BETTER_THAN", schema: "FROM Tool TO Tool(benchmark STRING, metric STRING, margin STRING)" },
  { name: "CITES", schema: "FROM Tool TO Gene(doi STRING, year INT64)" },
];
```

KuzuClient 实现：`initialize()` 创建所有表、`insertNodes/insertRel/query/batchInsertFromCSV`。

### Task 1.3: Wiki Loader — wiki-loader.ts + wiki-parser.ts

```typescript
// packages/knowledge/src/wiki/wiki-parser.ts
import matter from "gray-matter";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

export interface WikiDocFrontmatter {
  title: string;
  topic: string;
  version: number;
  updated: string;
  sources: { doi?: string; github?: string; url?: string }[];
  tags: string[];
  related: string[];
  confidence: "high" | "medium" | "low" | "deprecated";
}

export interface WikiDocFull extends WikiDocFrontmatter {
  path: string;
  content: string;
  excerpt: string;
}

export function parseWikiFile(filePath: string): WikiDocFull {
  const raw = readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  return {
    ...(data as WikiDocFrontmatter),
    path: filePath,
    content,
    excerpt: content.slice(0, 300).replace(/\n/g, " "),
  };
}

export function loadAllWikiFiles(wikiDir: string): Map<string, WikiDocFull> {
  const docs = new Map<string, WikiDocFull>();
  
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (extname(entry) === ".md") {
        const doc = parseWikiFile(fullPath);
        docs.set(doc.topic, doc);
      }
    }
  }
  
  walk(wikiDir);
  return docs;
}

export function searchWiki(docs: Map<string, WikiDocFull>, keyword: string): WikiDocFull[] {
  const lower = keyword.toLowerCase();
  return Array.from(docs.values()).filter(
    d => d.title.toLowerCase().includes(lower) ||
         d.content.toLowerCase().includes(lower) ||
         d.tags.some(t => t.toLowerCase().includes(lower))
  );
}
```

WikiLoader：加载全部 Wiki 文档到内存索引，支持 `getByTopic(topic)`, `getByTag(tag)`, `search(keyword)`, `getRelated(doc, depth)`, `getTopicTree(topic)`。

### Task 1.4: Knowledge Bridge — bridge.ts

统一查询接口，内部并行查询三层后融合：

```typescript
// packages/knowledge/src/bridge.ts
export class KnowledgeBridge {
  constructor(
    private chroma: ChromaClientWrapper,
    private kuzu: KuzuClient,
    private wikiLoader: WikiLoader,
  ) {}

  async query(q: KnowledgeQuery): Promise<KnowledgeResult> {
    const results: any = {};
    const tasks: Promise<any>[] = [];

    // 并行查询三层
    if (!q.layers || q.layers.includes("vector")) {
      tasks.push(this.chroma.query("literature_snippets", q.question, { nResults: q.maxResults ?? 5 })
        .then(r => results.vectorResults = { ...r, queryTime: Date.now() }));
    }
    if (!q.layers || q.layers.includes("wiki")) {
      tasks.push(Promise.resolve(this.wikiLoader.search(q.question))
        .then(r => results.wikiResults = { documents: r.slice(0, q.maxResults ?? 5), excerpts: [], queryTime: Date.now() }));
    }
    if (!q.layers || q.layers.includes("graph")) {
      tasks.push(this.queryGraph(q).then(r => results.graphResults = r));
    }

    await Promise.all(tasks);

    // 综合摘要（使用简单的模板拼接，后续可由 LLM 生成）
    results.synthesis = this.synthesize(results);
    results.confidence = this.calculateConfidence(results);
    results.totalQueryTime = Date.now();

    return results;
  }

  private synthesize(results: any): string {
    const parts: string[] = [];
    if (results.wikiResults?.documents?.length) {
      parts.push(`Wiki 找到 ${results.wikiResults.documents.length} 篇相关文档: ${results.wikiResults.documents.map((d: any) => d.title).join(", ")}`);
    }
    if (results.vectorResults?.ids?.length) {
      parts.push(`向量检索找到 ${results.vectorResults.ids.length} 条相关片段`);
    }
    return parts.join("。") || "未找到相关知识";
  }

  private calculateConfidence(results: any): number {
    // 简单的加权平均（MVP 版本）
    let score = 0;
    let count = 0;
    if (results.wikiResults?.documents?.length) { score += 0.9; count++; }
    if (results.vectorResults?.ids?.length) { score += 0.5; count++; }
    return count > 0 ? score / count : 0.3;
  }
}
```

### Task 1.5: 编写第 1 篇 Wiki 文档 — qc-best-practices.md

```markdown
---
title: "单细胞 RNA-seq 质控最佳实践"
topic: "scrna-seq.qc"
version: 1
updated: 2026-05-31
sources:
  - doi: "10.15252/msb.20188746"
  - github: "scverse/scanpy-tutorials"
tags: [qc, quality-control, mitochondria, doublet]
related:
  - biology/cell-biology.md
  - tools/scanpy.md
  - failures/batch-effect-misdiagnosis.md
confidence: high
---

# 单细胞 RNA-seq 质控最佳实践

## 核心指标

单细胞 RNA-seq 质控的三个核心指标：

| 指标 | 正常范围 | 异常含义 |
|------|---------|---------|
| n_genes | 500-5000 | <200: 空液滴/死细胞; >5000: 可能的双细胞 |
| n_counts (UMI) | 1000-25000 | <500: 捕获失败; >50000: 双细胞 |
| pct_mitochondrial | <20% (大多数组织) | >20%: 死细胞/破损细胞 |

## 自适应阈值策略

**不要硬编码阈值**。使用 MAD（中位数绝对偏差）方法：

```python
mad_n_genes = 3 * stats.median_abs_deviation(adata.obs.n_genes_by_counts)
low_threshold = max(200, median_n_genes - mad_n_genes)
```

## 不同组织的特殊考量

- 心肌/骨骼肌: MT% 可高达 30%（线粒体丰富的组织）
- 脑组织: 基因数通常较低，MT% 较低
- 肿瘤: 基因数和 MT% 均可能偏高

## 常见陷阱

1. 一刀切的 MT% 阈值 → 对心肌组织会丢失大量健康细胞
2. 忽略核糖体蛋白比例 → 高 ribo% 可能是细胞裂解不充分
3. 只过滤低 n_genes → 也要过滤过高 n_genes（双细胞）
```

然后继续写剩余的 16 篇 Wiki 文档（overview.md, normalization-methods.md, clustering-guide.md, cell-annotation.md, trajectory-analysis.md, cell-communication.md, scanpy.md, seurat.md, monocle3.md, cellchat.md, scrna-standard-pipeline.md, batch-effect-misdiagnosis.md, over-correction-warning.md 以及 biology/ 下的 4 篇基础生物学文档）。

### Task 1.6: 知识种子注入 — seed-runner.ts

```typescript
// packages/knowledge/src/seed/seed-runner.ts
// 编排所有种子数据的注入:
// 1. ChromaDB: 从 Wiki 文档分块 → embedding → 插入 literature_snippets
// 2. KuzuDB: 从 CSV 文件批量导入节点和关系
// 3. 验证: 查询确认数据已注入

async function main() {
  const chroma = new ChromaClientWrapper(process.env.CHROMA_URL);
  const kuzu = new KuzuClient(process.env.KUZU_DB_PATH!);
  const wikiLoader = new WikiLoader(process.env.BIOAGENT_KNOWLEDGE_DIR + "/wiki");

  await chroma.initialize();
  await kuzu.initialize();

  // 1. 注入 Wiki 文档到 ChromaDB
  const allDocs = wikiLoader.getAllDocs();
  for (const doc of allDocs) {
    const chunks = chunkText(doc.content, 500); // 500 字符分块
    await chroma.add("literature_snippets", chunks, chunks.map(() => ({
      source_type: "docs", title: doc.title, topic: doc.topic, confidence: doc.confidence,
    })), chunks.map((_, i) => `${doc.topic}-chunk-${i}`));
  }

  // 2. 导入图数据
  await kuzu.batchInsertFromCSV("Gene", "packages/knowledge/data/graph/genes.csv");
  await kuzu.batchInsertFromCSV("CellType", "packages/knowledge/data/graph/cell_markers.csv");
  await kuzu.batchInsertFromCSV("Pathway", "packages/knowledge/data/graph/pathways.csv");
  // ... 导入关系表

  console.log("✅ Knowledge base seeded successfully");
}

function chunkText(text: string, maxChars: number): string[] {
  const sentences = text.split(/(?<=[。.!?])\s*/);
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (current.length + s.length > maxChars && current.length > 0) {
      chunks.push(current.trim()); current = "";
    }
    current += s;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

main();
```

---

## Part B: Agent Core

### Task 1.7: types.ts — 核心类型定义

从设计文档 §5 提取全部类型：`BioAgentConfig`, `BioAgentEvent`, `ThinkingSection`, `AnalysisPath`, `Risk`, `Reference`。

```typescript
// packages/agent-core/src/types.ts
export interface BioAgentConfig {
  model: string;
  maxTokens: number;
  thinkingBudget: "off" | "low" | "medium" | "high" | "xhigh";
  temperature: number;
  sessionDir: string;
  projectDir: string;
  maxSessionLength: number;
  autoCompress: boolean;
  requireConfirmation: boolean;
  maxParallelSkills: number;
  defaultTimeout: number;
}
```

### Task 1.8: thinking-engine.ts + thinking-template.ts

```typescript
// packages/agent-core/src/thinking-template.ts
export const THINKING_TEMPLATE = `
你是一位拥有 15 年经验的资深生物信息学科学家。

## 分析前的系统思考

### 1. 科学问题还原
- 用户表面需求是什么？
- 底层科学假设是什么？

### 2. 数据充分性评估
- 现有数据格式和规模
- 样本量是否足够？

### 3. 分析路径枚举（至少 2 种）
### 4. 最优路径推荐
### 5. 关键风险点
### 6. 文献支撑
### 7. 验证策略

## 回复用户格式
**分析纲要** (3-5 句话)
**推荐流程** (步骤列表)
**预期结果**
**风险提示**
**是否继续？**
`.trim();
```

```typescript
// packages/agent-core/src/thinking-engine.ts
export class ThinkingEngine {
  private template: string;

  constructor(template?: string) {
    this.template = template || THINKING_TEMPLATE;
  }

  /** 将数据注入思考模板 */
  buildPrompt(context: {
    userQuestion: string;
    fileInspectResult?: any;
    resourceReport?: any;
    knowledgeResult?: any;
  }): string {
    let prompt = this.template;
    prompt = prompt.replace("{user_question}", context.userQuestion);
    prompt = prompt.replace("{file_inspect_result}", JSON.stringify(context.fileInspectResult || {}, null, 2));
    prompt = prompt.replace("{resource_report}", JSON.stringify(context.resourceReport || {}, null, 2));
    return prompt;
  }

  /** 解析 LLM 从思考模板返回的结构化结果 */
  parseThinkingOutput(output: string): ThinkingSection[] {
    const sections: ThinkingSection[] = [];
    const sectionRegex = /###\s+(\d+)\.\s+(.+?)\n([\s\S]*?)(?=###\s+\d+\.|$)/g;
    let match;
    while ((match = sectionRegex.exec(output)) !== null) {
      sections.push({
        index: parseInt(match[1]),
        title: match[2].trim(),
        content: match[3].trim(),
      });
    }
    return sections;
  }
}

export interface ThinkingSection {
  index: number;
  title: string;
  content: string;
}
```

### Task 1.9: Session Manager

```typescript
// packages/agent-core/src/session/session-manager.ts
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export interface SessionMessage {
  type: "user" | "thinking" | "agent" | "tool_call" | "qc_report" | "progress" | "viz";
  content: any;
  timestamp: string;
  index: number;
}

export class SessionManager {
  constructor(private sessionsDir: string) {}

  private sessionPath(sessionId: string): string {
    return join(this.sessionsDir, sessionId + ".jsonl");
  }

  async create(projectId: string): Promise<string> {
    const sessionId = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    mkdirSync(dirname(this.sessionPath(sessionId)), { recursive: true });
    writeFileSync(this.sessionPath(sessionId), "");
    return sessionId;
  }

  async appendMessage(sessionId: string, msg: SessionMessage): Promise<void> {
    const line = JSON.stringify(msg) + "\n";
    appendFileSync(this.sessionPath(sessionId), line);
  }

  async getMessages(sessionId: string): Promise<SessionMessage[]> {
    if (!existsSync(this.sessionPath(sessionId))) return [];
    const content = readFileSync(this.sessionPath(sessionId), "utf-8");
    return content.trim().split("\n").map(l => JSON.parse(l));
  }

  async fork(sessionId: string, atIndex: number): Promise<string> {
    const msgs = await this.getMessages(sessionId);
    const newId = `${Date.now()}_fork_${crypto.randomUUID().slice(0, 8)}`;
    const forked = msgs.slice(0, atIndex + 1);
    for (const msg of forked) {
      await this.appendMessage(newId, msg);
    }
    return newId;
  }

  async compress(sessionId: string): Promise<void> {
    // 保留开头 5% + 结尾 20% 的消息，中间用摘要替换
    const msgs = await this.getMessages(sessionId);
    if (msgs.length < 50) return;
    const keep = Math.floor(msgs.length * 0.05);
    const tail = Math.floor(msgs.length * 0.2);
    const summary: SessionMessage = {
      type: "agent",
      content: `[会话压缩: ${msgs.length - keep - tail} 条消息已省略]`,
      timestamp: new Date().toISOString(),
      index: keep,
    };
    const compressed = [...msgs.slice(0, keep), summary, ...msgs.slice(-tail)];
    writeFileSync(this.sessionPath(sessionId), compressed.map(m => JSON.stringify(m)).join("\n") + "\n");
  }

  async delete(sessionId: string): Promise<void> {
    const fs = await import("fs/promises");
    await fs.unlink(this.sessionPath(sessionId));
  }
}
```

### Task 1.10: 9 个自定义工具

按设计文档 §5.2 中每个工具的完整接口定义 + handler 实现。

每个 tool 独立文件，全部从 `tools/index.ts` 导出为一个工具数组：

```typescript
// packages/agent-core/src/tools/index.ts
export { DockerExecTool } from "./docker-exec.tool";
export { DockerSearchTool } from "./docker-search.tool";
export { DockerPullTool } from "./docker-pull.tool";
export { DockerInspectTool } from "./docker-inspect.tool";
export { DockerVerifyTool } from "./docker-verify.tool";
export { SkillInvokeTool } from "./skill-invoke.tool";
export { KbQueryTool } from "./kb-query.tool";
export { FileInspectTool } from "./file-inspect.tool";
export { WorkflowRunTool } from "./workflow-run.tool";

import { DockerExecTool } from "./docker-exec.tool";
// ...
export const ALL_TOOLS = [
  DockerExecTool, DockerSearchTool, DockerPullTool, DockerInspectTool,
  DockerVerifyTool, SkillInvokeTool, KbQueryTool, FileInspectTool, WorkflowRunTool,
];
```

### Task 1.11: 3 个 Hooks + 4 种自定义消息

Hooks：
- `validation.hook.ts` — beforeToolCall: 参数校验（禁止 `rm -rf /`, `chmod 777`, pipe-to-shell 等危险操作 + 路径白名单 `/data/` + 超时上限）
- `qc.hook.ts` — afterToolCall: 解析 exitCode + skill_invoke 的 QC 失败自动查知识库找修复建议
- `thinking.hook.ts` — 每轮消息前注入思考模板

Messages（通过 TypeScript 类型定义，用于 SSE 事件序列化）：
- `thinking.message.ts`: `{ type: "thinking", status, sections[] }`
- `qc-report.message.ts`: `{ type: "qc_report", skill_name, overall, gates[] }`
- `progress.message.ts`: `{ type: "progress", workflow_run_id, current_node, completed_nodes[], progress }`
- `viz.message.ts`: `{ type: "viz", skill_name, viz_type, format, path }`

### Task 1.12: BioAgent 主类

```typescript
// packages/agent-core/src/bio-agent.ts
export class BioAgent {
  private piAgent: any; // @earendil-works/pi-agent-core
  private config: BioAgentConfig;
  private thinkingEngine: ThinkingEngine;
  private sessionManager: SessionManager;
  private dockerExecutor: DockerExecutor;
  private knowledgeBridge: KnowledgeBridge;
  private skillEngine: any; // Phase 2 填充
  private workflowEngine: any; // Phase 2 填充

  constructor(config: BioAgentConfig & { dockerExecutor: DockerExecutor; knowledgeBridge: KnowledgeBridge }) {
    this.config = config;
    this.thinkingEngine = new ThinkingEngine();
    this.sessionManager = new SessionManager(config.sessionDir);
    this.dockerExecutor = config.dockerExecutor;
    this.knowledgeBridge = config.knowledgeBridge;
  }

  async processMessage(sessionId: string, message: string, attachments?: any[]): Promise<AsyncIterable<any>> {
    // 核心流程:
    // 1. 如用户有附件 → file_inspect
    // 2. kb_query 获取相关知识
    // 3. thinkingEngine.buildPrompt → 注入思考模板
    // 4. 调用 pi agent（含 9 个自定义工具）
    // 5. 返回 SSE 事件流
    // MVP 阶段: 返回 AsyncGenerator 模拟 SSE 事件流
  }
}
```

### Task 1.13: 测试

- `bridqe.test.ts` — mock 三层后的合成逻辑
- `wiki-loader.test.ts` — 加载测试 md 文件验证 frontmatter 解析
- `session-manager.test.ts` — 创建/追加/读取/压缩/删除会话
- `thinking-engine.test.ts` — 模板变量替换 + 结构化输出解析

---

## Phase 1 验收标准

- [ ] ChromaDB 3 个 Collection 创建成功
- [ ] KuzuDB 9+10 表创建成功，能执行 Cypher 查询
- [ ] Wiki Loader 加载全部 .md 文档，正确解析 frontmatter
- [ ] Knowledge Bridge 三层查询返回综合结果
- [ ] 种子数据注入成功（`pnpm seed:knowledge`）
- [ ] 9 个工具全部注册，zod schema 通过校验
- [ ] Session Manager CRUD 通过
- [ ] Thinking Engine 模板填充 + 结构化解析通过
- [ ] `pnpm typecheck` 通过（所有包）
- [ ] 单元测试全部通过
