# BioAgent 🧬

> AI-powered bioinformatics agent — automate omics data analysis with natural language

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/NierEHV/BioAgent/releases/tag/v0.1.0)
[![Tests](https://img.shields.io/badge/tests-408%2F409%20passing-green)](https://github.com/NierEHV/BioAgent)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-required-2496ED?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-brightgreen)](LICENSE)

📖 [中文文档](README_CN.md)

---

## Table of Contents

- [Mission](#mission)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Features](#features)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Configuration](#configuration)
- [Development](#development)
- [API Overview](#api-overview)
- [Testing](#testing)
- [Roadmap](#roadmap)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Mission

BioAgent's mission is to **lower the technical barrier of life science research**, enabling any researcher to access analytical capabilities approaching those of top-tier bioinformatics teams.

Life science research has entered the data-driven era. High-throughput technologies (sequencing, single-cell, spatial omics, proteomics, metabolomics) generate data at an exponential rate. However, data analysis capability remains the primary bottleneck — many labs produce data but lack bioinformatics expertise.

**BioAgent bridges the gap between data and scientific discovery**, freeing researchers from learning Linux, Docker, Python/R package management, and tool installation — they simply describe their scientific question in natural language, and BioAgent designs, executes, interprets, and archives the entire analysis.

### What BioAgent Is

- **AI Principal Bioinformatician** — deep domain knowledge with experienced-scientist reasoning
- **AI Research Scientist** — designs studies, selects strategies, evaluates results
- **AI Knowledge Manager** — manages project/user/methodology knowledge for long-term accumulation

### What BioAgent Is Not

- ❌ Not a chatbot — it actually executes analyses, not just offers advice
- ❌ Not a RAG system — retrieval is a means; execution and validation are the core
- ❌ Not a code generator — generated code is just one part of the execution chain
- ❌ Not a traditional platform — no drag-and-drop modules; the Agent decides the pipeline autonomously

---

## How It Works

BioAgent installs **zero bioinformatics tools** locally. All analysis runs inside Docker containers.

```
                  ┌──────────────────────┐
                  │      BioAgent        │
                  │   (Node.js runtime)   │
                  │                      │
                  │  Capabilities:        │
                  │  • Understand question│
                  │  • Search/select image│
                  │  • Deploy container   │
                  │  • Schedule commands  │
                  │  • Monitor QC         │
                  │  • Interpret results  │
                  └──────────┬───────────┘
                             │ docker exec
                             ▼
                  ┌──────────────────────┐
                  │   Docker Container    │
                  │  (ShortCake etc.)    │
                  │                      │
                  │  Contains:            │
                  │  Python 3.10+        │
                  │  R 4.x               │
                  │  Scanpy, Seurat      │
                  │  Monocle3, scVelo    │
                  │  CellChat, SCENIC    │
                  │  CellTypist, Harmony │
                  │  100+ bioinformatics │
                  └──────────────────────┘
```

### Six-Step Execution Model

```
User: "I have scRNA-seq data from 20 lung cancer samples, find immunosuppressive subpopulations"
          │
          ▼
  Step 1 — Omics Identification  (file_inspect → detect format & omics type)
  Step 2 — Image Selection       (Skill mapping → DockerHub search → evaluate)
  Step 3 — Image Readiness       (docker pull → verify tools)
  Step 4 — Container Start       (docker run -v {data}:/data --name {name} {image})
  Step 5 — Analysis Execution    (loop docker exec → QC gates → checkpoint)
  Step 6 — Results & Cleanup     (docker stop → outputs → report → knowledge archive)
```

### Image Selection Table

| Omics | Primary Image | Coverage |
|-------|--------------|----------|
| scRNA-seq | `rnakato/shortcake_full` | Scanpy, Seurat, Monocle3, scVelo, CellChat, SCENIC... 100+ |
| scRNA-seq (lite) | `bioagent-scrna` (local) | Scanpy + Scrublet (fast testing) |
| Bulk RNA-seq | `quay.io/biocontainers/*` | STAR, Salmon, DESeq2, edgeR... |
| scATAC-seq | `rnakato/shortcake_full` | Signac, ArchR, MACS2... |
| Spatial | `rnakato/shortcake_full` | Seurat Spatial, Giotto... |
| WGS/WES | `broadinstitute/gatk` | GATK, BWA, Samtools... |
| Unknown tool | Docker Hub search | `docker_search` tool with auto-evaluation |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         BioAgent UI                               │
│              Next.js 15 + TailwindCSS 4 + SSE                     │
│    ChatView | ProgressPanel | QCReport | VizPanel | FileBrowser  │
└──────────────────────────────┬───────────────────────────────────┘
                               │ REST + SSE
┌──────────────────────────────▼───────────────────────────────────┐
│                      BioAgent Core                                │
│                   (extends pi-agent-core)                         │
│                                                                   │
│  ThinkingEngine ─► 7-step structured reasoning                    │
│  SessionManager ─► JSONL-based conversation persistence           │
│  9 Custom Tools ─► docker_exec/search/pull/inspect/verify,        │
│                    skill_invoke, kb_query, file_inspect,          │
│                    workflow_run                                   │
│  3 Hooks ─► validation (security), qc (quality), thinking        │
│  4 Message Types ─► Thinking, QCReport, Progress, Viz             │
│  22 SSE Event Types ─► Full lifecycle streaming                   │
└──────────────────────────────┬───────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Skills (13 P0)  │  │   Workflow      │  │   Knowledge     │
│                  │  │   Engine        │  │   Base (3-layer) │
│ import           │  │                 │  │                  │
│ scrna-qc         │  │ DAG Scheduler   │  │ ChromaDB (vector)│
│ doublet-detection│  │ Checkpoint Mgr  │  │ KuzuDB (graph)   │
│ scrna-normalize  │  │ Condition Eval  │  │ LLM Wiki (struct)│
│ hvg-selection    │  │ Error Policy    │  │                  │
│ scrna-pca        │  │ Workflow Registry│ │ 8 Wiki docs      │
│ batch-correction │  │                 │  │ 4 CSV seeds      │
│ umap-tsne        │  │ 18-Node DAG:    │  │ KnowledgeBridge  │
│ clustering       │  │ scrna-seq       │  │                  │
│ cell-annotation  │  │ standard        │  └─────────────────┘
│ marker-detection │  └─────────────────┘
│ diff-expression  │
│ enrich           │
└────────┬────────┘
         │ docker exec
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Docker Executor                              │
│                                                                   │
│  ContainerManager ─► start/exec/stop/list/runOnce                 │
│  ImageManager ─► pull/inspect/verifyTools/prune                   │
│  ImageSearchService ─► DockerHub API + Quay.io + evaluate         │
│  VolumeManager ─► project volumes + directory management          │
│  ResourceProbe ─► CPU/RAM/GPU/Disk/Docker/Python/R/Network        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

| Dependency | Version | Notes |
|------------|---------|-------|
| Node.js | ≥ 22 LTS | JavaScript runtime |
| pnpm | ≥ 9.x | Package manager |
| Docker Desktop | Latest | Container runtime |
| Git | Latest | Version control |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/NierEHV/BioAgent.git
cd BioAgent

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### Prepare Analysis Image

```bash
# Option A: Use official ShortCake image (recommended, ~15GB)
docker pull rnakato/shortcake_full:latest

# Option B: Build local lightweight test image (~1GB)
# Use this when Docker Hub is not accessible
docker build -f docker/test-image.Dockerfile -t bioagent-scrna:latest .
```

### Initialize Knowledge Base

```bash
pnpm seed:knowledge
```

### Launch

```bash
# Development mode
pnpm dev

# Production
pnpm build && pnpm start
```

Open `http://localhost:3000` in your browser.

---

## Features

### 🧠 7-Step Structured Reasoning

Before every analysis, BioAgent systematically reasons through:

```
1. Scientific Question — strip surface requirements, restore testable hypothesis
2. Data Sufficiency — format, scale, gaps, public data supplementation
3. Analysis Paths — ≥2 approaches compared (tools, power, FDR control)
4. Optimal Recommendation — rationale + literature support
5. Key Risks — technical/statistical/biological + mitigations
6. Literature Support — original methods papers, benchmarks, community consensus
7. Validation Strategy — internal validation + external validation + experimental suggestions
```

### 🔬 13 P0 scRNA-seq Skills

Each Skill is an independent atomic analysis unit with a **validate→decide→configure→execute→QC→output** six-phase pipeline:

| # | Skill | Primary Tool | QC Gates |
|---|-------|-------------|----------|
| 1 | `data-import` | Scanpy | Dimension check (n_cells>0, n_genes>0) |
| 2 | `scrna-qc` | Scanpy | n_genes>200, pctMT<20%, adaptive MAD |
| 3 | `doublet-detection` | Scrublet | doublet_rate<15%, score separation |
| 4 | `scrna-normalize` | Scanpy | Normalization distribution diagnostics |
| 5 | `hvg-selection` | Scanpy | HVG 2000-5000, mean-variance relationship |
| 6 | `scrna-pca` | Scanpy | Top 30 PCs >80% variance, elbow detection |
| 7 | `batch-correction` | Harmony | Mixing score>0.8, ARI stability |
| 8 | `umap-tsne` | Scanpy | Trustworthiness>0.8 |
| 9 | `clustering` | Scanpy/Leiden | Silhouette>0.3, multi-resolution ARI |
| 10 | `cell-annotation` | CellTypist | Confidence>80%, marker specificity ⚠️ confirmation required |
| 11 | `marker-detection` | Scanpy | log2FC>1, ≥3 markers/cluster |
| 12 | `diff-expression` | Scanpy/MAST | P-value distribution diagnostics, BH correction |
| 13 | `functional-enrichment` | GSEApy | ≥1 significant pathway, gene overlap<50% |

### 📚 Three-Layer Knowledge System

```
External Info ─► Vector DB (ChromaDB)         ← Semantic search + pattern matching
                     │
                     ▼
                 Graph DB (KuzuDB)             ← Knowledge reasoning + conflict detection
                     │
                     ▼
                 LLM Wiki (Markdown + YAML)    ← Structured long-term memory
```

| Layer | Technology | Scale |
|-------|-----------|-------|
| **Vector** | ChromaDB, text-embedding-3-small | 3 Collections, semantic search |
| **Graph** | KuzuDB (embedded) | 9 node types + 10 relationship types, multi-hop reasoning |
| **Wiki** | Markdown + YAML frontmatter | 8 documents covering full scRNA-seq pipeline |

### ⚙️ DAG Workflow Engine

- **Topological Sort** — Kahn algorithm, automatic parallel batch identification
- **Conditional Branching** — QC failure auto-fallback, batch detection dynamic routing
- **Checkpoint Recovery** — Auto-save after key nodes, resume from interruption
- **18-Node scRNA-seq Standard Pipeline** — from data import to final report

```
import → qc → doublet → normalize → hvg → pca
                                           │
                    ┌──────────────────────┤
                    ▼                      ▼
              batch_correct               umap
                    │                      │
                    └──────────┬───────────┘
                               ▼
                            cluster
                               │
                               ▼
                          annotate ⏸ (user confirmation)
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
                 marker       de     trajectory
                    │          │
                    └────┬─────┘
                         ▼
                      enrich
                         │
                         ▼
                      report
```

### 🎨 9 Bioinformatics UI Components

| Component | Function |
|-----------|----------|
| `ProgressTracker` | DAG vertical timeline, real-time node status (⏳🔄✅⚠️❌⏸) |
| `QCReportCard` | Per-skill QC report card, green/yellow/red levels + interactive suggestions |
| `VizPanel` | Visualization panel, tabs for UMAP/Volcano/Heatmap/Dotplot/Violin |
| `ThinkingPanel` | 7-step thinking accordion, streaming section-by-section |
| `FileBrowser` | Project file tree browser with upload/inspect/delete |
| `FileInspector` | File format detection results, dimensions/columns/preview |
| `KnowledgeRef` | Agent knowledge reference display (Vector/Graph/Wiki) |
| `ResourceMonitor` | Container CPU/RAM/Disk real-time monitoring |
| `WorkflowSelector` | Workflow picker showing step count and resource estimates |

---

## Project Structure

```
BioAgent/
├── packages/
│   ├── agent-core/          # 🧠 BioAgent Core (extends pi agent)
│   │   ├── src/
│   │   │   ├── bio-agent.ts           # Main class, full pipeline
│   │   │   ├── thinking-engine.ts     # 7-step structured reasoning
│   │   │   ├── session-manager.ts     # JSONL conversation persistence
│   │   │   ├── tools/                 # 9 custom tools
│   │   │   ├── hooks/                 # 3 hooks (validation/qc/thinking)
│   │   │   ├── messages/              # 4 custom message types
│   │   │   └── events/                # 22 SSE event types
│   │   └── __tests__/                 # 116 tests
│   │
│   ├── executor/            # 🐳 Docker execution environment
│   │   ├── src/
│   │   │   ├── container-manager.ts   # Container lifecycle (12 methods)
│   │   │   ├── image-manager.ts       # Image management (10 methods)
│   │   │   ├── image-search.ts        # DockerHub search + evaluation
│   │   │   ├── volume-manager.ts      # Volume management (6 methods)
│   │   │   ├── resource-probe.ts      # Host resource probing
│   │   │   └── types.ts               # 14 core interfaces
│   │   └── __tests__/                 # 37 tests
│   │
│   ├── skills/              # 🔧 Skill Library
│   │   ├── src/
│   │   │   ├── base-skill.ts          # 6-phase pipeline abstract class
│   │   │   ├── skill-registry.ts      # Registration, dependency, cycle detection
│   │   │   ├── skill-executor.ts      # Executor + resource checks
│   │   │   ├── io/                    # data-import
│   │   │   ├── qc/                    # scrna-qc, doublet-detection
│   │   │   ├── preprocess/            # normalize, hvg, pca, batch
│   │   │   ├── embed/                 # umap-tsne
│   │   │   ├── cluster/               # clustering
│   │   │   ├── annotate/              # cell-annotation
│   │   │   └── analysis/              # marker, de, enrich
│   │   └── __tests__/                 # 70 tests
│   │
│   ├── knowledge/           # 📚 Three-Layer Knowledge Base
│   │   ├── src/
│   │   │   ├── bridge.ts             # Unified three-layer query
│   │   │   ├── vector-db/            # ChromaDB (3 collections)
│   │   │   ├── graph-db/             # KuzuDB (9 nodes + 10 relations)
│   │   │   ├── wiki/                 # LLM Wiki management
│   │   │   └── seed/                 # Seed data injection
│   │   ├── data/
│   │   │   ├── wiki/                 # 8 Wiki documents
│   │   │   └── graph/                # CSV seed data
│   │   └── __tests__/                # 65 tests
│   │
│   ├── workflow/            # ⚙️ DAG Workflow Engine
│   │   ├── src/
│   │   │   ├── engine.ts             # DAG execution engine
│   │   │   ├── scheduler.ts          # Kahn topological sort
│   │   │   ├── checkpoint.ts         # JSON checkpoint management
│   │   │   ├── condition.ts          # Safe expression evaluator
│   │   │   ├── error-policy.ts       # Retry/fallback/skip
│   │   │   └── workflows/            # 18-node scRNA-seq DAG
│   │   └── __tests__/                 # 71 tests
│   │
│   └── ui/                  # 🖥️ Web Frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx         # Three-column layout
│       │   │   ├── page.tsx           # Chat interface
│       │   │   └── api/               # 24 API routes
│       │   ├── components/bioagent/   # 9 bioinformatics components
│       │   ├── hooks/                 # 3 React hooks
│       │   └── lib/                   # API + SSE clients
│       └── __tests__/                 # 50 tests
│
├── docker/                   # Dockerfiles + Compose
├── docs/                     # Design docs + Plans
├── data/                     # Runtime data (gitignored)
├── scripts/                  # Utility scripts
├── .env.example              # Environment template
├── pnpm-workspace.yaml       # Monorepo configuration
└── tsconfig.base.json        # TypeScript base configuration
```

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Language** | TypeScript | 5.x | Full-stack type safety |
| **Runtime** | Node.js | 22 LTS | Native ESM support |
| **Agent Framework** | `@earendil-works/pi-agent-core` | 0.78.x | Multi-turn tool calling + event streaming |
| **LLM** | Claude Sonnet 4.6 (via pi-ai) | — | Strong biological reasoning |
| **LLM Provider** | `@earendil-works/pi-ai` | 0.78.x | 20+ provider abstraction |
| **Frontend** | Next.js 15 (App Router) | 15.x | React SSR + API Routes |
| **Styling** | TailwindCSS | 4.x | Utility-first CSS |
| **Docker SDK** | dockerode | 4.x | Container lifecycle management |
| **Vector DB** | ChromaDB | 3.4.x | Semantic search + case matching |
| **Embedding** | text-embedding-3-small (OpenAI) | — | 1024 dimensions |
| **Graph DB** | KuzuDB | 0.11.x | Embedded, Cypher queries |
| **Document Parsing** | gray-matter + unified | latest | YAML frontmatter + MD |
| **Validation** | zod | 3.23.x | Runtime schema validation |
| **Logging** | pino | 9.x | Structured JSON logging |
| **Testing** | vitest | 2.x | Fast TypeScript testing |
| **Package Manager** | pnpm | 9.x | Workspace monorepo |
| **CI/CD** | GitHub Actions | — | typecheck + lint + test |

---

## Configuration

### Environment Variables

```bash
# === BioAgent Core ===
BIOAGENT_MODEL=claude-sonnet-4-6        # LLM model
BIOAGENT_MAX_TOKENS=4096                # Max tokens
BIOAGENT_THINKING_BUDGET=high           # Thinking depth: off/low/medium/high/xhigh
BIOAGENT_TEMPERATURE=0.1                # Low temperature for consistency

# === LLM Provider ===
ANTHROPIC_API_KEY=sk-ant-...            # Anthropic API Key (required)
PI_AI_DEFAULT_PROVIDER=anthropic        # Default provider

# === Paths ===
BIOAGENT_DATA_DIR=./data                # Data root directory
BIOAGENT_PROJECTS_DIR=./data/projects   # Project directory
BIOAGENT_SESSIONS_DIR=./data/sessions   # Session storage
BIOAGENT_LOGS_DIR=./data/logs           # Log directory

# === Docker ===
DOCKER_DEFAULT_PLATFORM=linux/amd64     # Default platform
DOCKER_PULL_TIMEOUT=3600000             # Image pull timeout 1h
DOCKER_EXEC_DEFAULT_TIMEOUT=600000      # Command execution timeout 10min

# === ChromaDB ===
CHROMA_URL=http://localhost:8000        # ChromaDB service URL
CHROMA_PERSIST_DIR=./data/chroma        # Persistence directory

# === KuzuDB ===
KUZU_DB_PATH=./data/kuzu                # KuzuDB data directory

# === Execution Control ===
REQUIRE_USER_CONFIRMATION=true          # Require user confirmation at key nodes
MAX_PARALLEL_SKILLS=4                   # Max parallel skills
MAX_SESSION_LENGTH=200                  # Max conversation turns
AUTO_COMPRESS_SESSION=true              # Auto-compress long sessions

# === Logging ===
LOG_LEVEL=info                          # trace/debug/info/warn/error
LOG_FORMAT=json                         # json/pretty
```

---

## Development

### Common Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Type check (all packages)
pnpm typecheck

# Type check (single package)
pnpm --filter @bioagent/executor typecheck

# Run unit tests (all packages)
pnpm test:unit

# Run unit tests (single package)
pnpm --filter @bioagent/skills test:unit

# Run integration tests (requires Docker)
pnpm test:integration

# Build
pnpm build

# Seed knowledge base
pnpm seed:knowledge

# Clean build artifacts
pnpm clean
```

### Adding a New Skill

1. Create `packages/skills/src/<category>/<name>.skill.ts`
2. Extend `BaseSkill`, implement all 6 abstract methods
3. Define `SkillSpec` with complete QC gates and troubleshooting
4. Register in `SkillRegistry`
5. Write unit tests + integration tests

```typescript
import { BaseSkill } from "../base-skill";

export class MyNewSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "my-new-skill", version: "1.0.0",
    description: "My new analysis step",
    omicsType: "scrna",
    // ... full spec definition
  };

  async validateInput(data: DataContext): Promise<ValidationResult> { /* ... */ }
  async selectTool(data: DataContext, resources: ResourceReport): Promise<ToolChoice> { /* ... */ }
  async configureParams(data: DataContext, tool: ToolChoice): Promise<Record<string, any>> { /* ... */ }
  async run(context: SkillContext): Promise<SkillExecResult> { /* ... */ }
  async runQC(results: SkillExecResult): Promise<QCReport> { /* ... */ }
  async formatOutput(results: SkillExecResult, qc: QCReport): Promise<SkillOutput> { /* ... */ }
}
```

### Adding a New Workflow

```typescript
import type { WorkflowDef } from "../engine.types";

export const MY_NEW_WORKFLOW: WorkflowDef = {
  name: "my-new-workflow", version: "1.0.0",
  description: "...",
  nodes: [
    { id: "step1", skill: "my-skill", dependsOn: [], ... },
    { id: "step2", skill: "another-skill", dependsOn: ["step1"], ... },
  ],
  errorPolicy: { maxRetries: 3, retryDelayMs: 30000, ... },
};
```

---

## API Overview

### REST Endpoints (24)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/agent/message` | Send message, receive SSE stream |
| `GET` | `/api/agent/sessions` | List sessions |
| `POST` | `/api/agent/sessions` | Create session |
| `DELETE` | `/api/agent/sessions/:id` | Delete session |
| `POST` | `/api/agent/sessions/:id/fork` | Fork session |
| `POST` | `/api/agent/sessions/:id/compress` | Compress session |
| `POST` | `/api/workflow` | Start workflow |
| `GET` | `/api/workflow/:runId` | Workflow status |
| `POST` | `/api/workflow/:runId/pause` | Pause |
| `POST` | `/api/workflow/:runId/resume` | Resume |
| `POST` | `/api/workflow/:runId/abort` | Abort |
| `GET` | `/api/workflow/:runId/events` | Workflow SSE stream |
| `POST` | `/api/files/upload` | Upload file |
| `GET` | `/api/files/list` | List files |
| `GET` | `/api/files/inspect` | Inspect file |
| `GET` | `/api/files/download` | Download file |
| `DELETE` | `/api/files` | Delete file |
| `GET` | `/api/knowledge/query` | Query knowledge base |
| `GET` | `/api/viz/:type/:projectId/*` | Visualization image |
| `GET` | `/api/resources` | Host resources |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/projects` | List projects |
| `POST` | `/api/projects` | Create project |
| `DELETE` | `/api/projects/:id` | Delete project |

### SSE Event Types (22)

```
thinking:started     thinking:section     thinking:completed
message:start        message:chunk        message:end
tool:start           tool:progress        tool:end
workflow:started     workflow:node:start  workflow:node:end
workflow:paused      workflow:resumed     workflow:completed
workflow:failed
qc:report            qc:warning           qc:failed
viz:ready            knowledge:reference
error                error:recoverable    error:fatal
```

---

## Testing

```
         ┌──────────┐
         │ E2E (1)  │  End-to-end scRNA mini workflow
         ├──────────┤
         │  Int (3) │  Skills + Docker + Knowledge integration
         ├──────────┤
         │ Unit (25)│  Pure function / Mock tests
         └──────────┘
```

| Package | Test Files | Tests | Coverage |
|---------|-----------|-------|----------|
| `agent-core` | 4 | 116 | Thinking, Session, Hooks, Tools |
| `executor` | 3 | 37 | Container, Image, Helpers |
| `knowledge` | 4 | 65 | Wiki, Chroma, Kuzu, Bridge |
| `skills` | 3 | 70 | BaseSkill, Registry, Executor |
| `workflow` | 3 | 71 | Scheduler, Checkpoint, Engine |
| `ui` | 2 | 50 | SSE Client, QCReportCard |
| **Total** | **19** | **409** | |

---

## Roadmap

| Version | Scope | Status |
|---------|-------|--------|
| **v0.1.0** | scRNA-seq MVP: 13 Skills, 3-layer KB, DAG engine, Web UI | ✅ Released |
| **v0.2.0** | P1 Skills (trajectory, communication, GRN), HPC/SSH bridge | 📋 Planned |
| **v0.3.0** | Bulk RNA-seq + scATAC-seq + Spatial workflows | 📋 Planned |
| **v1.0.0** | Full omics, cloud deployment, 100+ Skills, community Skill marketplace | 📋 Planned |

---

## Documentation

| Document | Path | Description |
|----------|------|-------------|
| Design Doc | [docs/design/bioagent-mvp-design.md](docs/design/bioagent-mvp-design.md) | 2,856 lines, 17 chapters complete technical design |
| Architecture | [docs/architecture-overview.md](docs/architecture-overview.md) | 5 Mermaid architecture diagrams |
| Implementation Plans | [docs/plans/](docs/plans/) | 4 Phase 80+ TDD tasks |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) | Skill development + code standards |

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Commit Convention

- `feat(scope): description` — New feature
- `fix(scope): description` — Bug fix
- `docs(scope): description` — Documentation
- `test(scope): description` — Tests
- `chore(scope): description` — Maintenance

---

## License

MIT © 2026 BioAgent

---

**BioAgent — AI Principal Bioinformatician, AI Research Scientist, AI Knowledge Manager. Three roles, one agent.**
