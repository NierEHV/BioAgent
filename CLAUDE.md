# CLAUDE.md — BioAgent Development Guide

## Project Overview

BioAgent is an AI-powered bioinformatics agent that executes data analysis entirely inside Docker containers. It does NOT install any bioinformatics tools locally.

## Key Architecture

- **Monorepo**: pnpm workspace, 7 packages
- **Agent framework**: Extends `@earendil-works/pi-agent-core` — do NOT modify pi source
- **Execution**: All bioinformatics tools run inside Docker containers (ShortCake, BioContainers)
- **Extension points**: Custom tools, hooks, message types (pi agent extension mechanism)
- **Skills**: Each Skill is an independent TypeScript module with 6-phase pipeline (validate → select tool → config params → execute → QC → format output)
- **Workflow**: DAG of Skills with checkpoint recovery and conditional branching
- **Knowledge**: 3-layer — ChromaDB (vector) + KuzuDB (graph) + Markdown (wiki)

## Design Document

The authoritative design spec is `docs/design/bioagent-mvp-design.md`. Read it before making any architectural changes.

## Tech Stack

- TypeScript 5.x (strict), Node.js 22 LTS
- pnpm 9.x workspace
- `dockerode` for Docker API
- `zod` for all schema validation
- `pino` for structured logging
- `vitest` for testing
- Next.js 15 + TailwindCSS 4 for UI (forked pi-web)
- ChromaDB + KuzuDB for knowledge

## Rules

1. **All interfaces MUST have zod schemas** — validation at system boundaries
2. **Skills follow the 6-phase pipeline** — never skip QC gates
3. **Docker is the only execution environment** — never call subprocesses directly for bio tools
4. **Pi agent is extended, not modified** — use tools/hooks/messages
5. **TypeScript strict mode everywhere** — no `any` without explicit justification
6. **Write tests before implementation** — TDD red-green-refactor
7. **Commit messages in English**, comments in Chinese where domain-specific
