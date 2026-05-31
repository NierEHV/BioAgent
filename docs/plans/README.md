# BioAgent MVP 实现计划

基于 [BioAgent MVP 详细设计文档](../design/bioagent-mvp-design.md)，按 4 个 Phase 分批实现。

## 计划总览

| Phase | 文档 | 天数 | 任务数 | 关键交付 |
|-------|------|------|--------|---------|
| **0** | [phase-0-project-scaffold.md](phase-0-project-scaffold.md) | 5 天 | 15 | Monorepo + Docker + ContainerManager 测试通过 |
| **1** | [phase-1-core-foundation.md](phase-1-core-foundation.md) | 11 天 | 20 | Agent Core(9 tools+3 hooks) + 三层知识体系 + 18 篇 Wiki 文档 + 种子注入 |
| **2** | [phase-2-skills-workflow.md](phase-2-skills-workflow.md) | 24 天 | 23 | 13 个 P0 Skill + Workflow DAG 引擎 + scrna-seq-standard 18 节点定义 |
| **3** | [phase-3-frontend.md](phase-3-frontend.md) | 17 天 | 15 | Fork pi-web + 9 个生信组件 + 24 个 API Route |
| **4** | [phase-4-integration.md](phase-4-integration.md) | 10 天 | 7 | E2E PBMC 3k 测试 + Bug 修复 + v0.1 Docker 镜像 + GitHub Release |
| **合计** | | **67 天 (~10 周)** | **~80** | BioAgent v0.1.0 |

## 依赖关系

```
Phase 0 (项目搭建)
  └── Phase 1 (核心基础)
        └── Phase 2 (Skill + Workflow)
              └── Phase 3 (前端 UI)
                    └── Phase 4 (集成 & 发布)
```

## 执行方式

每个 Phase 内部的任务按依赖顺序排列，同文件内编号即为执行顺序。

推荐通过 `subagent-driven-development` 执行：每个 Task 起一个 agent，独立完成 → 验证 → 提交。

## 关键约定

1. **TDD 先行** — 每个 Task 先写测试，红-绿-重构循环
2. **提交原子化** — 一个 Task 一个 commit
3. **类型安全** — 所有接口 zod schema，`pnpm typecheck` 必须通过
4. **无占位符** — 不接受 TODO/TBD，每步都是完整实现
