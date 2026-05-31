# Phase 2: Skill 系统 + Workflow 引擎

**目标:** 实现 BaseSkill 管线、13 个 P0 Skill、Workflow DAG 引擎、scRNA-seq 标准流程
**前置:** Phase 1 完成
**预计:** 24 天

---

## 文件结构

```
NEW:    packages/skills/src/base-skill.ts
NEW:    packages/skills/src/base-skill.types.ts
NEW:    packages/skills/src/skill-registry.ts
NEW:    packages/skills/src/skill-loader.ts
NEW:    packages/skills/src/skill-executor.ts

NEW:    packages/skills/src/io/data-import.skill.ts
NEW:    packages/skills/src/qc/scrna-qc.skill.ts
NEW:    packages/skills/src/qc/doublet-detection.skill.ts
NEW:    packages/skills/src/preprocess/scrna-normalize.skill.ts
NEW:    packages/skills/src/preprocess/hvg-selection.skill.ts
NEW:    packages/skills/src/preprocess/scrna-pca.skill.ts
NEW:    packages/skills/src/preprocess/batch-correction.skill.ts
NEW:    packages/skills/src/embed/umap-tsne.skill.ts
NEW:    packages/skills/src/cluster/clustering.skill.ts
NEW:    packages/skills/src/annotate/cell-annotation.skill.ts
NEW:    packages/skills/src/analysis/marker-detection.skill.ts
NEW:    packages/skills/src/analysis/diff-expression.skill.ts
NEW:    packages/skills/src/analysis/functional-enrichment.skill.ts
NEW:    packages/skills/src/analysis/trajectory.skill.ts
NEW:    packages/skills/src/analysis/cell-communication.skill.ts
NEW:    packages/skills/src/network/grn.skill.ts
NEW:    packages/skills/src/report/report-generator.skill.ts

NEW:    packages/skills/__tests__/base-skill.test.ts
NEW:    packages/skills/__tests__/skill-registry.test.ts
NEW:    packages/skills/__tests__/skill-executor.test.ts
NEW:    packages/skills/__tests__/qc/scrna-qc.test.ts
NEW:    packages/skills/__tests__/qc/doublet-detection.test.ts
NEW:    packages/skills/__tests__/annotate/cell-annotation.test.ts
NEW:    packages/skills/__tests__/analysis/diff-expression.test.ts

NEW:    packages/workflow/src/engine.ts
NEW:    packages/workflow/src/engine.types.ts
NEW:    packages/workflow/src/scheduler.ts
NEW:    packages/workflow/src/checkpoint.ts
NEW:    packages/workflow/src/checkpoint.types.ts
NEW:    packages/workflow/src/registry.ts
NEW:    packages/workflow/src/condition.ts
NEW:    packages/workflow/src/error-policy.ts

NEW:    packages/workflow/src/workflows/scrna-seq.workflow.ts

NEW:    packages/workflow/__tests__/engine.test.ts
NEW:    packages/workflow/__tests__/scheduler.test.ts
NEW:    packages/workflow/__tests__/checkpoint.test.ts
NEW:    packages/workflow/__tests__/scrna-seq.workflow.test.ts
```

---

## Part A: Skill 系统基础

### Task 2.1: base-skill.types.ts — 完整类型定义

从设计文档 §8.1 完整复制 `SkillSpec`, `QCGate`, `SkillResult`, `SkillContext`, `ToolChoice`, `ValidationResult` 等全部接口。使用 zod schema 做运行时校验。

### Task 2.2: base-skill.ts — 抽象基类

实现 6 步管线编排：`validateInput → selectTool → configureParams → run → runQC → formatOutput`。完成 `buildDockerCommand()`, `buildNextSteps()`, `buildFailureResult()`, `buildErrorResult()` 辅助方法。

### Task 2.3: skill-registry.ts

```typescript
export class SkillRegistry {
  private skills = new Map<string, BaseSkill>();

  register(skill: BaseSkill): void {
    if (this.skills.has(skill.spec.name)) throw new Error(`Duplicate skill: ${skill.spec.name}`);
    this.skills.set(skill.spec.name, skill);
  }

  get(name: string): BaseSkill | undefined { return this.skills.get(name); }
  getByOmicsType(type: string): BaseSkill[] { return [...this.skills.values()].filter(s => s.spec.omicsType === type); }
  getAll(): BaseSkill[] { return [...this.skills.values()]; }
  has(name: string): boolean { return this.skills.has(name); }

  getDependencyChain(name: string): string[] {
    const skill = this.get(name);
    if (!skill) return [];
    const chain = new Set<string>();
    for (const dep of skill.spec.dependencies.requires) {
      chain.add(dep);
      this.getDependencyChain(dep).forEach(d => chain.add(d));
    }
    return [...chain];
  }

  checkCircularDependency(): string | null {
    for (const [name, skill] of this.skills) {
      const visited = new Set<string>();
      const stack = [name];
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) return current; // cycle detected
        visited.add(current);
        const s = this.get(current);
        if (s) stack.push(...s.spec.dependencies.requires);
      }
    }
    return null;
  }
}
```

### Task 2.4: skill-executor.ts

```typescript
export class SkillExecutor {
  constructor(
    private registry: SkillRegistry,
    private containerManager: ContainerManager,
    private logger?: any,
  ) {}

  async execute(skillName: string, context: SkillContext): Promise<SkillResult> {
    const skill = this.registry.get(skillName);
    if (!skill) throw new Error(`Skill not found: ${skillName}`);

    // 检查前置依赖是否已完成
    for (const dep of this.registry.getDependencyChain(skillName)) {
      this.logger?.info(`Skill ${skillName} depends on ${dep}`);
    }

    return skill.execute(context);
  }
}
```

---

## Part B: 13 个 P0 Skill 实现

每个 Skill 遵循相同模式，以 `scrna-qc` 为例：

### Task 2.5: data-import.skill.ts

```typescript
import { BaseSkill } from "../base-skill";
import type { SkillSpec } from "../base-skill.types";

export class DataImportSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "data-import", version: "1.0.0",
    description: "导入 scRNA-seq 数据（10x mtx/h5/h5ad/rds）",
    omicsType: "scrna",
    input: {
      acceptedFormats: ["h5ad", "h5", "mtx", "rds"],
      schema: {},
    },
    tools: {
      primary: "scanpy.read_10x_mtx", alternatives: ["scanpy.read_10x_h5", "scanpy.read_h5ad"],
      decisionTree: [
        { condition: "文件为 .h5ad", tool: "scanpy.read_h5ad", reason: "AnnData 原生格式" },
        { condition: "文件为 .h5", tool: "scanpy.read_10x_h5", reason: "10x HDF5" },
        { condition: "目录含 mtx+barcodes+features", tool: "scanpy.read_10x_mtx", reason: "10x mtx" },
      ],
      dockerImages: { "scanpy": { image: "rnakato/shortcake_full:latest" } },
    },
    parameters: { defaults: {}, descriptions: {}, constraints: {} },
    qcGates: [{ id: "shape_check", name: "数据维度检查", description: "确保导入了有效数据", check: { type: "threshold", expression: "n_cells > 0 && n_genes > 0", metric: "shape" }, level: "fail", onPass: "数据导入成功", onFail: "数据为空，检查文件格式", fixable: false }],
    outputs: { files: [{ name: "imported.h5ad", format: "h5ad", description: "导入的 AnnData", required: true }], visualizations: [], metrics: [{ name: "n_cells", description: "细胞数" }, { name: "n_genes", description: "基因数" }] },
    troubleshooting: { common_issues: [{ symptom: "FileNotFoundError", likely_cause: "路径错误", diagnosis: "检查文件路径", fix: "使用绝对路径", severity: "blocking" }] },
    dependencies: { requires: [], recommends: [], conflicts: [] },
    resourceEstimate: { cpu: "2", ram: "4GB", disk: "1GB", time: "1-5 minutes", gpu: "not_needed" },
  };

  async validateInput(data: any) { /* 检查文件存在性 */ return { valid: true, errors: [] }; }
  async selectTool(data: any, resources: any) { /* 根据扩展名选择工具 */ return { tool: "scanpy.read_h5ad", reason: "h5ad format", image: "rnakato/shortcake_full:latest" }; }
  async configureParams(data: any, tool: any) { return {}; }
  async run(context: any) { /* docker exec scanpy.read_h5ad + write to output */ return { exitCode: 0, stdout: "", stderr: "" }; }
  async runQC(results: any) { return { overall: "pass" as const, gates: [], passed: 1, warned: 0, failed: 0, total: 1 }; }
  async formatOutput(results: any, qc: any) { return { files: [{ path: "/data/output/imported.h5ad", format: "h5ad", size_bytes: 0 }], metrics: { n_cells: 0, n_genes: 0 }, logs: [] }; }
}
```

### Task 2.6-2.17: 其余 12 个 P0 Skill

每个 Skill 的 spec 定义直接引用设计文档 §8.5 表中的 QC 门槛和工具选择。关键 Skill 的 Docker 命令：

**scrna-qc Skill:**
```python
import scanpy as sc; import numpy as np
adata = sc.read_h5ad("{input}")
adata.var['mt'] = adata.var_names.str.startswith('MT-')
adata.var['ribo'] = adata.var_names.str.startswith(('RPS','RPL'))
sc.pp.calculate_qc_metrics(adata, qc_vars=['mt','ribo'], inplace=True)
# 自适应过滤
from scipy import stats
mad_n_genes = 3 * stats.median_abs_deviation(adata.obs.n_genes_by_counts.to_numpy())
mad_pct_mt = 3 * stats.median_abs_deviation(adata.obs.pct_counts_mt.to_numpy())
keep = (adata.obs.n_genes_by_counts > 200) & (adata.obs.pct_counts_mt < 20)
adata = adata[keep, :]
adata.write("{output}/qc_filtered.h5ad")
# 输出 QC 报告 JSON
import json
qc_report = {
  "n_cells_before": {n_before}, "n_cells_after": adata.n_obs,
  "median_n_genes": float(np.median(adata.obs.n_genes_by_counts)),
  "median_pct_mt": float(np.median(adata.obs.pct_counts_mt)),
}
with open("{output}/qc_report.json", "w") as f: json.dump(qc_report, f)
```

**cell-annotation Skill:**
```python
import celltypist; import scanpy as sc
adata = sc.read_h5ad("{input}")
predictions = celltypist.annotate(adata, model='Immune_All_Low.pkl', majority_voting=True)
adata.obs['cell_type'] = predictions.predicted_labels
adata.obs['cell_type_confidence'] = predictions.confidence
adata.write("{output}/annotated.h5ad")
```

---

## Part C: Workflow 引擎

### Task 2.18: engine.types.ts — WorkflowDef + WorkflowState + CheckpointData

从设计文档 §9.1 完整复制所有类型定义。

### Task 2.19: scheduler.ts — DAG 拓扑排序

```typescript
export class WorkflowScheduler {
  topoSort(nodes: WorkflowNode[]): string[][] {
    const batches: string[][] = [];
    const remaining = new Set(nodes.map(n => n.id));
    const completed = new Set<string>();

    while (remaining.size > 0) {
      const batch: string[] = [];
      for (const id of remaining) {
        const node = nodes.find(n => n.id === id)!;
        const depsReady = node.dependsOn.length === 0 ||
          (node.dependsOnMode === "all" && node.dependsOn.every(d => completed.has(d))) ||
          (node.dependsOnMode === "any" && node.dependsOn.some(d => completed.has(d)));
        if (depsReady) batch.push(id);
      }
      if (batch.length === 0) throw new Error("Circular dependency detected");
      for (const id of batch) { remaining.delete(id); }
      batches.push(batch);
    }
    return batches;
  }

  getCriticalPath(nodes: WorkflowNode[]): string[] {
    const distances = new Map<string, number>();
    for (const n of nodes) distances.set(n.id, 0);
    // 计算每个节点的最长路径
    for (const batch of this.topoSort(nodes)) {
      for (const id of batch) {
        const node = nodes.find(n => n.id === id)!;
        for (const dep of node.dependsOn) {
          distances.set(id, Math.max(distances.get(id)!, (distances.get(dep) || 0) + 1));
        }
      }
    }
    // 回溯关键路径
    let maxDist = 0; let endNode = nodes[0].id;
    for (const [id, d] of distances) { if (d > maxDist) { maxDist = d; endNode = id; } }
    const path: string[] = [endNode];
    while (path.length <= maxDist) {
      const node = nodes.find(n => n.id === path[path.length - 1])!;
      const preds = node.dependsOn.filter(d => distances.get(d) === distances.get(path[path.length - 1])! - 1);
      if (preds.length > 0) path.push(preds[0]); else break;
    }
    return path.reverse();
  }

  detectCycle(nodes: WorkflowNode[]): string[] | null {
    try { this.topoSort(nodes); return null; }
    catch (e: any) { return []; }
  }
}
```

### Task 2.20: checkpoint.ts — 检查点管理

```typescript
export class CheckpointManager {
  constructor(private basePath: string) {}

  private checkpointPath(projectId: string, runId: string): string {
    return join(this.basePath, "projects", projectId, "checkpoints", `${runId}.json`);
  }

  async save(checkpoint: CheckpointData): Promise<void> {
    mkdirSync(dirname(this.checkpointPath(checkpoint.projectId, checkpoint.runId)), { recursive: true });
    writeFileSync(this.checkpointPath(checkpoint.projectId, checkpoint.runId), JSON.stringify(checkpoint, null, 2));
  }

  async findLatest(workflowName: string, projectId: string): Promise<CheckpointData | null> {
    const dir = join(this.basePath, "projects", projectId, "checkpoints");
    if (!existsSync(dir)) return null;
    const files = readdirSync(dir).filter(f => f.endsWith(".json")).sort().reverse();
    for (const f of files) {
      const data = JSON.parse(readFileSync(join(dir, f), "utf-8"));
      if (data.workflowName === workflowName) return data;
    }
    return null;
  }

  async verify(checkpoint: CheckpointData): Promise<{ valid: boolean; missingFiles: string[]; corruptedFiles: string[] }> {
    const missing: string[] = []; const corrupted: string[] = [];
    for (const [nodeId, data] of Object.entries(checkpoint.intermediateData)) {
      if (!existsSync(data.path)) { missing.push(data.path); continue; }
      // 简单的大小检查（MVP 不做完整 SHA256 对比）
      const stat = statSync(data.path);
      if (stat.size !== data.sizeBytes) corrupted.push(data.path);
    }
    return { valid: missing.length === 0 && corrupted.length === 0, missingFiles: missing, corruptedFiles: corrupted };
  }
}
```

### Task 2.21: engine.ts — DAG 执行引擎

```typescript
export class WorkflowEngine {
  constructor(
    private registry: WorkflowRegistry,
    private skillExecutor: SkillExecutor,
    private checkpointMgr: CheckpointManager,
  ) {}

  async start(config: { workflowName: string; projectId: string; dataPath: string; container: string }): Promise<string> {
    const workflow = this.registry.get(config.workflowName);
    if (!workflow) throw new Error(`Unknown workflow: ${config.workflowName}`);

    const runId = `wf_${Date.now()}`;
    const state: WorkflowState = {
      runId, workflowName: config.workflowName, workflowVersion: workflow.version,
      status: "running", projectId: config.projectId, container: config.container,
      nodeStates: new Map(workflow.nodes.map(n => [n.id, { status: "pending", retryCount: 0 }])),
      currentNodes: [], completedNodes: [], failedNodes: [], skippedNodes: [],
      totalNodes: workflow.nodes.length, progress: 0, lastCheckpoint: "",
      startedAt: new Date().toISOString(),
    };

    // 异步执行
    this.executeLoop(state, workflow).catch(err => {
      state.status = "failed";
      console.error("Workflow failed:", err);
    });

    return runId;
  }

  private async executeLoop(state: WorkflowState, workflow: WorkflowDef): Promise<void> {
    const scheduler = new WorkflowScheduler();
    const batches = scheduler.topoSort(workflow.nodes);

    for (const batch of batches) {
      if (state.status === "paused" || state.status === "aborted") break;

      const results = await Promise.allSettled(
        batch.map(async nodeId => {
          const node = workflow.nodes.find(n => n.id === nodeId)!;

          // 检查前置条件
          const depsReady = node.dependsOn.length === 0 ||
            (node.dependsOnMode === "all" && node.dependsOn.every(d => state.completedNodes.includes(d))) ||
            (node.dependsOnMode === "any" && node.dependsOn.some(d => state.completedNodes.includes(d)));

          if (!depsReady) return;

          state.currentNodes.push(nodeId);
          state.nodeStates.get(nodeId)!.status = "running";

          try {
            const result = await this.skillExecutor.execute(node.skill, {
              skillName: node.skill,
              params: {},
              container: state.container,
              dataContext: {
                inputPath: `/data/intermediate/${this.getInputNode(node)}`,
                outputPath: `/data/intermediate/${node.id}`,
                intermediatePath: "/data/intermediate",
              },
              resources: {} as any,
              force: false,
            });

            state.nodeStates.get(nodeId)!.status = "completed";
            state.nodeStates.get(nodeId)!.skillResult = result;
            state.completedNodes.push(nodeId);
            state.progress = state.completedNodes.length / state.totalNodes;

            // 条件分支处理
            if (node.condition && result.qcReport.overall === "fail") {
              if (node.condition.then === "ask_user") state.status = "paused";
              if (node.condition.then === "skip") state.skippedNodes.push(nodeId);
            }

            // 检查点
            if (node.checkpoint) {
              await this.checkpointMgr.save({
                runId: state.runId, projectId: state.projectId, workflowName: state.workflowName,
                nodeStates: Object.fromEntries(state.nodeStates),
                completedNodes: state.completedNodes, failedNodes: state.failedNodes,
                skippedNodes: state.skippedNodes,
                intermediateData: { [nodeId]: { path: `/data/intermediate/${node.id}`, hash: "", sizeBytes: 0, qcSummary: result.qcReport.overall } },
                containerName: state.container, containerId: "", savedAt: new Date().toISOString(), agentState: {},
              });
            }

          } catch (err) {
            state.nodeStates.get(nodeId)!.status = "failed";
            state.failedNodes.push(nodeId);
            if (!node.optional) throw err;
          } finally {
            state.currentNodes = state.currentNodes.filter(id => id !== nodeId);
          }
        })
      );
    }

    if (state.status === "running") state.status = "completed";
  }

  private getInputNode(node: WorkflowNode): string {
    return node.dependsOn[0] || "import";
  }
}
```

### Task 2.22: scrna-seq.workflow.ts — 18 节点 scRNA-seq DAG 定义

从设计文档 §9.5 完整复制 `SCRNA_SEQ_STANDARD` 常量。

### Task 2.23: 集成测试 — 3 节点迷你 Workflow

使用真实 Docker 容器运行 `import → qc → normalize` 三个 Skill 的端到端测试：

```typescript
// packages/workflow/__tests__/scrna-seq.workflow.test.ts
describe("scRNA-seq mini workflow", () => {
  it("runs import → qc → normalize on test data", async () => {
    // 准备测试: PBMC 3k 数据，启动 ShortCake 容器
    // 注册 3 个 Skill
    // 定义 3 节点迷你 Workflow
    // 执行
    // 验证: import 成功 → qc QC pass → normalize 输出 h5ad
  }, 300_000);
});
```

---

## Phase 2 验收标准

- [ ] BaseSkill 6 步管线单元测试通过
- [ ] SkillRegistry 依赖链分析无循环引用
- [ ] 13 个 P0 Skill 全部注册，每个 spec 通过 `validateSkill()` 校验
- [ ] WorkflowScheduler 拓扑排序输出正确批次
- [ ] CheckpointManager 保存/恢复/校验 通过
- [ ] 3 节点迷你 Workflow 在真实容器中成功执行
- [ ] 18 节点 scRNA-seq 标准 DAG 完整定义
- [ ] `pnpm typecheck` 通过
- [ ] 所有单元测试 + 集成测试通过
