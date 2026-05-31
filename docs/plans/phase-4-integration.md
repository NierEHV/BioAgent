# Phase 4: 集成测试 & v0.1 发布

**目标:** 端到端测试、Bug 修复、文档完善、Docker 镜像发布
**前置:** Phase 3 完成
**预计:** 10 天

---

## 文件结构

```
NEW:    packages/agent-core/__tests__/integration/e2e-scrna.test.ts
NEW:    packages/agent-core/__tests__/integration/error-recovery.test.ts
NEW:    packages/agent-core/__tests__/integration/docker-search.test.ts
NEW:    scripts/verify-setup.ts
NEW:    scripts/dev.sh
NEW:    docs/api/openapi.yaml
NEW:    docs/contributing/skill-development.md
MODIFY: README.md
```

---

## Task 4.1: 端到端测试 — PBMC 3k 完整流程

```typescript
// packages/agent-core/__tests__/integration/e2e-scrna.test.ts
describe("E2E: PBMC 3k scRNA-seq analysis", () => {
  const TEST_DATA = "https://cf.10xgenomics.com/samples/cell/pbmc3k/pbmc3k_filtered_gene_bc_matrices.tar.gz";

  beforeAll(async () => {
    // 1. 下载 PBMC 3k 测试数据（如本地不存在）
    // 2. 解压到 data/projects/e2e-test/raw/
    // 3. 确保 ShortCake 镜像已缓存
    // 4. 种子知识库
  }, 600_000);

  it("runs full scRNA-seq standard workflow", async () => {
    // 1. 启动 ShortCake 容器
    const cm = new ContainerManager();
    await cm.startContainer({
      image: "rnakato/shortcake_full:latest",
      name: "bioagent-e2e-test",
      command: ["tail", "-f", "/dev/null"],
      volumes: [
        { host: "data/projects/e2e-test/raw", container: "/data/input", mode: "ro" },
        { host: "data/projects/e2e-test/output", container: "/data/output", mode: "rw" },
      ],
      env: {}, gpu: false, network: "bridge",
    });

    // 2. 依次执行 13 个 Skill
    const results: string[] = [];
    for (const skillName of [
      "data-import", "scrna-qc", "doublet-detection", "scrna-normalize",
      "hvg-selection", "scrna-pca", "umap-tsne", "clustering",
      "cell-annotation", "marker-detection", "diff-expression",
      "functional-enrichment", "report-generator",
    ]) {
      const result = await skillExecutor.execute(skillName, {
        skillName, params: {},
        container: "bioagent-e2e-test",
        dataContext: {
          inputPath: "/data/input",
          outputPath: `/data/output/${skillName}`,
          intermediatePath: "/data/output",
        },
        resources: {} as any, force: false,
      });

      expect(result.status).not.toBe("failed");
      console.log(`✅ ${skillName}: ${result.qcReport.overall} (${result.duration}ms)`);
      results.push(`${skillName}: ${result.qcReport.overall}`);
    }

    // 3. 验证输出
    expect(existsSync("data/projects/e2e-test/output/report-generator/final_report.html")).toBe(true);
    expect(existsSync("data/projects/e2e-test/output/cell-annotation/annotated.h5ad")).toBe(true);

    // 4. 验证细胞注释
    // 检查是否能识别出 T cell, B cell, Monocyte
    const annotationResult = results[9]; // cell-annotation
    expect(annotationResult).toContain("pass");

    // 5. 清理
    await cm.stopContainer("bioagent-e2e-test", { force: true, removeVolumes: false });
  }, 3_600_000); // 1 hour timeout
});
```

---

## Task 4.2: 错误恢复测试

```typescript
describe("Error recovery", () => {
  it("detects Docker daemon unavailability", async () => {
    // Mock dockerode 抛出连接错误
    // 验证 Agent 返回正确的用户消息: "Docker 未运行"
  });

  it("handles QC failure gracefully", async () => {
    // 用伪造数据触发 scrna-qc 的 pctMT 超标 QC 失败
    // 验证: Agent 展示 QC 报告 + 修复建议 + 选项按钮
  });

  it("handles container exec timeout", async () => {
    // 执行一个 sleep 700s 的命令，timeout 设为 5s
    // 验证: 返回超时状态 + 截断输出
  });

  it("workflow checkpoint recovery", async () => {
    // 模拟在第 5 个 Skill 后失败
    // 验证: 能从检查点恢复，跳过后重新执行后续 Skill
  });
});
```

---

## Task 4.3: Docker Hub 搜索集成测试

```typescript
describe("Docker Hub search", () => {
  it("finds alphafold image", async () => {
    const search = new ImageSearchService();
    const results = await search.searchDockerHub({
      query: "alphafold protein structure",
      minStars: 10,
      limit: 5,
      includeOfficial: true,
      includeBiocontainers: true,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.name.includes("alphafold"))).toBe(true);
  });

  it("finds biocontainers scanpy image", async () => {
    const results = await search.searchBioContainers("scanpy");
    expect(results.length).toBeGreaterThan(0);
  });
});
```

---

## Task 4.4: Bug Bash & 修复

运行以下清单，记录并修复每个发现的问题：

1. [ ] 所有 API 端点 200/400/500 响应正确
2. [ ] SSE 流在各种网络条件下稳定（Chrome + Firefox + Safari）
3. [ ] Docker 镜像拉取失败时的错误消息对人类友好
4. [ ] 中文输入/输出无编码问题
5. [ ] 大文件（>1GB h5ad）处理不崩溃
6. [ ] 并发请求不冲突
7. [ ] 容器残留清理（异常退出也能清理）
8. [ ] 知识库查询超时时降级而非崩溃

---

## Task 4.5: 文档完善

- **README.md:** 添加实际运行截图、Demo 视频链接、快速开始指南
- **docs/api/openapi.yaml:** 完整 API 定义（所有 24 个端点）
- **docs/contributing/skill-development.md:** Skill 开发指南

```yaml
# docs/api/openapi.yaml (骨架)
openapi: "3.0.3"
info:
  title: BioAgent API
  version: "0.1.0"
  description: 生物信息学 AI Agent REST + SSE API
servers:
  - url: http://localhost:3000/api
    description: Local development
paths:
  /agent/message:
    post:
      summary: 发送消息并接收 SSE 流式响应
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [session_id, message]
              properties:
                session_id: { type: string }
                message: { type: string }
      responses:
        "200":
          description: SSE 事件流
          content:
            text/event-stream: {}
  # ... 其余 23 个端点
```

---

## Task 4.6: Docker 镜像发布

构建 BioAgent 自身镜像，推送到 Docker Hub：

```bash
# 在 d:/AIAgent/BioAgent 目录
docker build -f docker/Dockerfile -t nierhv/bioagent:0.1.0 .
docker tag nierhv/bioagent:0.1.0 nierhv/bioagent:latest
docker push nierhv/bioagent:0.1.0
docker push nierhv/bioagent:latest
```

准备 docker-compose.prod.yml（生产环境一键启动: bioagent + chromadb）。

---

## Task 4.7: GitHub Release v0.1.0

创建 GitHub Release，包含：

- **Tag:** v0.1.0
- **Title:** BioAgent v0.1.0 — scRNA-seq MVP
- **Release Notes:**

```markdown
## BioAgent v0.1.0 — scRNA-seq MVP

首个可用版本，支持单细胞 RNA-seq 端到端全自动分析。

### 核心功能
- 🔬 13 个标准化 Skill（从数据导入到报告生成）
- 🐳 基于 ShortCake Docker 镜像的全自动工具执行
- 🧠 7 步结构化思考引擎
- 📚 三层知识体系（ChromaDB + KuzuDB + LLM Wiki）
- 🔍 Docker Hub 智能搜索
- 📊 实时 QC 报告 + 交互式可视化
- 📄 自动分析报告生成

### 快速开始
```bash
docker pull nierhv/bioagent:0.1.0
docker pull rnakato/shortcake_full:latest
docker compose -f docker-compose.yml up
```

### 已知限制
- 仅支持 scRNA-seq 数据
- 仅支持本地 Docker 执行
- 文献学习系统未启用（知识种子手工注入）
```

---

## Phase 4 验收标准

- [ ] E2E PBMC 3k 测试通过（13 个 Skill 全部成功，识别出 T/B/Monocyte）
- [ ] 错误恢复测试通过（4 个场景）
- [ ] Docker Hub 搜索测试通过
- [ ] Bug Bash 清单全部打勾
- [ ] API 文档完整
- [ ] BioAgent Docker 镜像构建成功
- [ ] `docker compose up` 一键启动成功
- [ ] GitHub Release v0.1.0 发布
