# Contributing to BioAgent

## Development Setup

```bash
pnpm install
cp .env.example .env
docker pull rnakato/shortcake_light:latest
pnpm dev
```

## Project Structure

See [README.md](README.md) and [Design Document](docs/design/bioagent-mvp-design.md).

## Adding a New Skill

1. Create `packages/skills/src/<category>/<name>.skill.ts`
2. Extend `BaseSkill`, implement all 6 abstract methods
3. Define `SkillSpec` with input schema, tool decision tree, QC gates, and troubleshooting
4. Register in `skill-registry.ts`
5. Write unit tests + integration test (with real Docker container)

## Adding a New Workflow

1. Create `packages/workflow/src/workflows/<name>.workflow.ts`
2. Define the DAG as `WorkflowDef` with nodes, edges, conditions, checkpoints
3. Register in `WorkflowRegistry`

## Code Style

- TypeScript strict mode
- zod for all external interfaces
- Structured logging with pino
- TDD: tests first, then implementation
