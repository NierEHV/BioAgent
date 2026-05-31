# BioAgent 🧬

AI-powered bioinformatics agent. Ask biological questions in natural language — BioAgent automatically deploys, configures, and executes bioinformatics tools inside Docker containers.

用自然语言描述生物学问题，BioAgent 自动在 Docker 容器中部署和调度生信工具，完成端到端数据分析。

## Quick Start

```bash
# Prerequisites: Docker + Node.js 22+
git clone https://github.com/NierEHV/BioAgent.git
cd BioAgent
pnpm install
cp .env.example .env  # Add your ANTHROPIC_API_KEY

# Pull the analysis image (one-time, ~15GB)
docker pull rnakato/shortcake_full:latest

# Start BioAgent
pnpm dev
```

## How It Works

BioAgent doesn't install any bioinformatics tools locally. Instead, it:

1. **Understands** your research question in natural language
2. **Searches** Docker Hub for the right container image (or uses known ones)
3. **Deploys** containers (like ShortCake with 100+ single-cell tools)
4. **Executes** analysis commands inside the container via `docker exec`
5. **Monitors** quality at every step with automated QC gates
6. **Reports** results with interactive visualizations and publication-ready charts

## Architecture

```
User: "我有20例肺癌scRNA-seq数据，想鉴定免疫抑制亚群"
  → BioAgent Thinking Engine (structured reasoning)
  → Docker: ShortCake container (Scanpy, Seurat, CellTypist, ...)
  → Skill Pipeline: import → QC → normalize → cluster → annotate → ...
  → Knowledge Base: Vector DB + Knowledge Graph + Wiki
  → Output: Report + Visualizations + Knowledge Archive
```

## MVP Features

- 🔬 **scRNA-seq end-to-end analysis** — 13 automated Skills from raw data to report
- 🐳 **Docker-based execution** — No local tool installation, everything runs in containers
- 🧠 **Structured reasoning** — 7-step thinking template before every analysis
- 📚 **Three-layer knowledge system** — Vector DB (ChromaDB) + Knowledge Graph (KuzuDB) + LLM Wiki
- 🔍 **Docker Hub search** — Agent finds the right image when it doesn't know a tool
- 📊 **Real-time QC reports** — Every Skill has pass/warn/fail gates
- 🎨 **Interactive visualizations** — UMAP, volcano plots, heatmaps, dotplots
- 📄 **Automatic report generation** — Methods + Results + Discussion draft

## Documentation

- [Design Document](docs/design/bioagent-mvp-design.md) — Complete technical specification
- [Architecture Overview](docs/architecture-overview.md) — System diagrams
- [API Reference](docs/api/openapi.yaml) — REST + SSE endpoints

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Agent Framework | pi-agent-core (TypeScript) |
| LLM | Claude Sonnet 4.6 (via pi-ai multi-provider) |
| Frontend | Next.js 15 + TailwindCSS 4 (forked pi-web) |
| Container Engine | dockerode (Node.js Docker API) |
| Vector Database | ChromaDB |
| Graph Database | KuzuDB (embedded) |
| Embedding | text-embedding-3-small |
| Bioinformatics | ShortCake (100+ scRNA tools) + BioContainers |
| Package Manager | pnpm workspace monorepo |

## Project Structure

```
BioAgent/
├── packages/
│   ├── agent-core/     # BioAgent core (extends pi agent)
│   ├── executor/       # Docker container lifecycle
│   ├── skills/         # Skill library (atomic analysis units)
│   ├── knowledge/      # 3-layer knowledge base
│   ├── workflow/       # DAG workflow engine
│   └── ui/             # Forked pi-web + bioinformatics panels
├── docs/
│   └── design/         # Design documents
├── docker/             # Docker Compose & Dockerfiles
└── data/               # Runtime data (gitignored)
```

## Development

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev

# Run tests
pnpm test:unit
pnpm test:integration   # Requires Docker

# Type check
pnpm typecheck

# Seed knowledge base
pnpm seed:knowledge
```

## License

MIT
