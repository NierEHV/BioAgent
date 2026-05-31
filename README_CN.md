# BioAgent 🧬

> AI 驱动的生物信息学 Agent — 用自然语言自动化多组学数据分析

[![Version](https://img.shields.io/badge/版本-0.1.0-blue)](https://github.com/NierEHV/BioAgent/releases/tag/v0.1.0)
[![Tests](https://img.shields.io/badge/测试-408%2F409%20通过-green)](https://github.com/NierEHV/BioAgent)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-必需-2496ED?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-brightgreen)](LICENSE)

📖 [English Documentation](README.md)

---

## 目录

- [项目使命](#项目使命)
- [核心执行范式](#核心执行范式)
- [系统架构](#系统架构)
- [快速开始](#快速开始)
- [功能特性](#功能特性)
- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [配置说明](#配置说明)
- [开发指南](#开发指南)
- [API 概览](#api-概览)
- [测试策略](#测试策略)
- [路线图](#路线图)
- [文档索引](#文档索引)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

---

## 项目使命

BioAgent 的使命是 **降低生命科学研究的技术门槛**，使任何研究人员都能够获得接近顶级生物信息学团队的分析能力。

当前生命科学研究已进入数据驱动时代。高通量技术产生的数据量呈指数级增长：

- **测序技术** — 成本持续下降，单个实验室即可产出全基因组、全转录组数据
- **单细胞技术** — 10x Genomics、Parse Biosciences、华大智造等快速普及，单次实验百万级细胞
- **空间组学** — Visium、MERFISH、Xenium、Stereo-seq 等可在组织原位获取空间坐标与转录组信息
- **蛋白组学与代谢组学** — DIA、TMT、LFQ 趋于标准化，修饰组学进入常规研究
- **多组学联合** — scRNA+scATAC、空间+单细胞、蛋白+代谢等成为主流研究范式

然而，**数据分析能力却成为科研进展的主要瓶颈**。尽管数据产出能力大幅提高，数据处理和解读能力并未同步扩散：

- 大量实验室拥有数据，却缺乏专业生物信息学人员
- 大量科研人员有明确的生物学问题，却无法转化为合理的分析方案
- 大量文献中沉淀着高价值的方法学知识，却无法被快速学习和复用

**BioAgent 要填补"数据"与"科学发现"之间的分析鸿沟**，让科研人员不再需要学习 Linux 命令行、Docker 编排、Python/R 包管理、工具安装排错 — 只需用自然语言描述科学问题，Agent 负责设计、执行、解释和归档整个分析过程。

### BioAgent 是什么

- **AI 首席生信科学家** — 掌握生信知识体系，像资深科学家一样引用领域共识、识别知识盲点
- **AI 科研科学家** — 设计研究方案，选择分析策略，评估结果可信度与生物合理性
- **AI 知识管理者** — 管理项目/用户/方法学知识，形成持续积累的知识资产

### BioAgent 不是什么

- ❌ 不是聊天机器人 — 它会实际执行分析，不是只给文字建议
- ❌ 不是简单的 RAG 系统 — 检索只是手段，执行和验证才是核心
- ❌ 不是单纯代码生成器 — 生成的代码只是执行链的一部分
- ❌ 不是传统分析平台 — 无需拖拽模块，Agent 自主决策全流程
- ❌ 不预装任何生信工具 — 所有分析在 Docker 容器中运行

---

## 核心执行范式

BioAgent 本体只包含 Node.js + TypeScript 逻辑。**所有生信工具都在 Docker 容器中运行**。

```
                  ┌──────────────────────┐
                  │      BioAgent        │
                  │   (Node.js 运行时)    │
                  │                      │
                  │  能力:                │
                  │  • 理解科学问题       │
                  │  • 搜索/选择镜像      │
                  │  • 部署容器           │
                  │  • 调度分析命令       │
                  │  • QC 质量监控        │
                  │  • 解读结果           │
                  └──────────┬───────────┘
                             │ docker exec
                             ▼
                  ┌──────────────────────┐
                  │   Docker 容器         │
                  │  (ShortCake 等)       │
                  │                      │
                  │  包含:                │
                  │  Python 3.10+        │
                  │  R 4.x               │
                  │  Scanpy, Seurat      │
                  │  Monocle3, scVelo    │
                  │  CellChat, SCENIC    │
                  │  CellTypist, Harmony │
                  │  100+ 生信工具        │
                  └──────────────────────┘
```

### 六步统一执行模式

```
用户: "我有20例肺癌scRNA-seq数据，想鉴定肿瘤微环境中的免疫抑制亚群"
          │
          ▼
  第一步 — 组学识别    (file_inspect → 判断数据格式和组学类型)
  第二步 — 镜像选择    (Skill映射表 → DockerHub搜索 → 评估质量)
  第三步 — 镜像就绪    (docker pull → 验证工具可用性)
  第四步 — 容器启动    (docker run -v {数据}:/data --name {名称} {镜像})
  第五步 — 分析执行    (循环 docker exec → QC 关卡 → 检查点保存)
  第六步 — 结果清理    (docker stop → 输出结果 → 报告 → 知识归档)
```

### 镜像决策表

| 组学类型 | 首选镜像 | 覆盖工具 |
|---------|---------|---------|
| 单细胞 RNA-seq | `rnakato/shortcake_full` | Scanpy, Seurat, Monocle3, scVelo, CellChat, SCENIC... 100+ |
| 单细胞 RNA-seq (轻量) | `bioagent-scrna` (本地) | Scanpy + Scrublet (快速测试) |
| Bulk RNA-seq | `quay.io/biocontainers/*` | STAR, Salmon, DESeq2, edgeR... |
| 单细胞 ATAC-seq | `rnakato/shortcake_full` | Signac, ArchR, MACS2... |
| 空间转录组 | `rnakato/shortcake_full` | Seurat Spatial, Giotto... |
| 全基因组/外显子 | `broadinstitute/gatk` | GATK, BWA, Samtools... |
| 未知工具 | Docker Hub 动态搜索 | `docker_search` 工具自动评估 |

---

## 系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│                         BioAgent UI                               │
│              Next.js 15 + TailwindCSS 4 + SSE                     │
│    对话面板 | 进度追踪 | QC报告 | 可视化面板 | 文件浏览器           │
└──────────────────────────────┬───────────────────────────────────┘
                               │ REST + SSE
┌──────────────────────────────▼───────────────────────────────────┐
│                      BioAgent Core                                │
│                   (基于 pi-agent-core 扩展)                        │
│                                                                   │
│  思考引擎 ─► 7步结构化推理                                         │
│  会话管理 ─► JSONL 格式对话持久化                                   │
│  9 个自定义工具 ─► docker_exec/search/pull/inspect/verify,         │
│                    skill_invoke, kb_query, file_inspect,          │
│                    workflow_run                                   │
│  3 个 Hooks ─► validation (安全校验), qc (质量判定), thinking      │
│  4 种消息类型 ─► Thinking, QCReport, Progress, Viz                │
│  22 个 SSE 事件 ─► 完整生命周期流式推送                             │
└──────────────────────────────┬───────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Skill 库 (13个) │  │   Workflow      │  │   知识库 (三层)  │
│                  │  │   引擎           │  │                  │
│ 数据导入          │  │                 │  │ ChromaDB (向量)  │
│ 单细胞QC         │  │ DAG 调度器       │  │ KuzuDB (图谱)    │
│ 双细胞检测        │  │ 检查点管理器     │  │ LLM Wiki (结构化)│
│ 归一化           │  │ 条件评估器       │  │                  │
│ 高变基因选择      │  │ 错误策略         │  │ 8 篇 Wiki 文档   │
│ PCA降维          │  │ Workflow注册     │  │ 4 个 CSV 种子    │
│ 批次校正          │  │                 │  │ 知识桥接         │
│ UMAP嵌入         │  │ 18节点 DAG:     │  │                  │
│ 聚类             │  │ scrna-seq       │  └─────────────────┘
│ 细胞注释          │  │ standard        │
│ Marker检测       │  └─────────────────┘
│ 差异表达          │
│ 功能富集          │
└────────┬────────┘
         │ docker exec
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Docker 执行器                                │
│                                                                   │
│  容器管理器 ─► 启动/执行/停止/列表/一次性运行                      │
│  镜像管理器 ─► 拉取/检查/验证工具/清理                              │
│  镜像搜索服务 ─► DockerHub API + Quay.io + 质量评估                │
│  卷管理器 ─► 项目数据卷 + 目录管理                                  │
│  资源探测器 ─► CPU/内存/GPU/磁盘/Docker/Python/R/网络              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 快速开始

### 前置要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥ 22 LTS | JavaScript 运行时 |
| pnpm | ≥ 9.x | 包管理器 (安装: `npm install -g pnpm@9`) |
| Docker Desktop | 最新版 | 容器运行环境 |
| Git | 最新版 | 版本控制 |

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/NierEHV/BioAgent.git
cd BioAgent

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 ANTHROPIC_API_KEY
```

### 准备分析镜像

```bash
# 方案 A: 使用 ShortCake 官方镜像 (推荐, 约 15GB)
docker pull rnakato/shortcake_full:latest

# 方案 B: Docker Hub 不可用时，本地构建轻量测试镜像 (约 1GB)
docker build -f docker/test-image.Dockerfile -t bioagent-scrna:latest .
```

### 初始化知识库

```bash
# 注入种子知识 (scRNA-seq 最佳实践、Marker数据库、通路数据)
pnpm seed:knowledge
```

### 启动

```bash
# 开发模式
pnpm dev

# 生产构建
pnpm build && pnpm start
```

浏览器访问 `http://localhost:3000`。

---

## 功能特性

### 🧠 七步结构化思考引擎

每次分析前，BioAgent 严格按照以下结构进行推理：

```
第一步: 科学问题还原 — 剥离表面需求，还原可检验的科学假设
第二步: 数据充分性评估 — 数据格式、规模、缺口、公共数据补充可能性
第三步: 分析路径枚举 — ≥2 种方案对比（工具链、统计效力、假阳性控制）
第四步: 最优路径推荐 — 给出理由 + 文献支撑
第五步: 关键风险点 — 技术/统计/生物风险 + 缓解措施
第六步: 文献支撑 — 方法学原始论文、Benchmark 评测、社区共识
第七步: 验证策略 — 内部验证 + 外部数据验证 + 实验验证建议
```

### 🔬 十三个 P0 单细胞 RNA-seq Skill

每个 Skill 是独立原子分析单元，包含 **输入校验→工具决策→参数配置→执行→QC关卡→输出格式化** 六步管线：

| # | Skill 名称 | 主工具 | QC 门槛 |
|---|-----------|--------|---------|
| 1 | `data-import` | Scanpy | 维度检查 (n_cells>0, n_genes>0) |
| 2 | `scrna-qc` | Scanpy | n_genes>200, pctMT<20%, 自适应MAD阈值 |
| 3 | `doublet-detection` | Scrublet | doublet_rate<15%, 分数分离度>0.1 |
| 4 | `scrna-normalize` | Scanpy | 归一化分布无极端值 |
| 5 | `hvg-selection` | Scanpy | HVG 2000-5000, mean-variance关系统计 |
| 6 | `scrna-pca` | Scanpy | 前30个PC解释方差>80%, 肘部图检测 |
| 7 | `batch-correction` | Harmony | 批次混合度>0.8, ARI稳定性 |
| 8 | `umap-tsne` | Scanpy | UMAP拓扑保持度>0.8 |
| 9 | `clustering` | Scanpy/Leiden | 轮廓系数>0.3, 多分辨率ARI扫描 |
| 10 | `cell-annotation` | CellTypist | 注释置信度>80%, marker特异性 ⚠️ 强制用户确认 |
| 11 | `marker-detection` | Scanpy | top marker log2FC>1, 每cluster≥3个marker |
| 12 | `diff-expression` | Scanpy/MAST | P值分布诊断, BH多重检验校正 |
| 13 | `functional-enrichment` | GSEApy | 至少1个显著通路(padj<0.05), 基因重叠率<50% |

### 📚 三层知识体系

```
外部信息源 ─► 向量数据库 (ChromaDB)       ← 语义检索 + 模式识别 + 相似案例
                  │
                  ▼
              图数据库 (KuzuDB)           ← 知识推理 + 多跳关联 + 矛盾检测
                  │
                  ▼
              LLM Wiki (Markdown + YAML)  ← 结构化长程记忆 + 权威知识
```

**知识流向:** 外源信息 → Vector 暂存与检索 → Graph 关联与推理验证 → Wiki 沉淀为长程记忆 → 供 Agent 调用

| 层级 | 技术 | 数据规模 |
|------|------|---------|
| **向量层** | ChromaDB, text-embedding-3-small (1024维) | 3 个 Collection: 文献片段、分析案例、调试日志 |
| **图谱层** | KuzuDB (嵌入式，Cypher 查询) | 9 种节点类型 + 10 种关系类型，支持多跳推理 |
| **Wiki层** | Markdown + YAML frontmatter | 8 篇专业文档，涵盖 scRNA-seq 全流程 |

### ⚙️ DAG Workflow 编排引擎

- **拓扑排序** — Kahn 算法，自动识别可并行的节点批次
- **条件分支** — QC 失败自动降级，批次检测动态选择路径
- **检查点恢复** — 关键节点后自动保存 JSON 检查点，失败可从中断处继续
- **错误处理** — 自动重试 (指数退避) → 降级方案 → 人工确认
- **18 节点 scRNA-seq 标准流程** — 从原始数据到最终报告

```
数据导入 → QC → 双细胞检测 → 归一化 → HVG选择 → PCA
                                                  │
                         ┌────────────────────────┤
                         ▼                        ▼
                    批次校正                     UMAP
                         │                        │
                         └───────────┬────────────┘
                                     ▼
                                  聚类
                                     │
                                     ▼
                               细胞注释 ⏸ (用户确认)
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
                Marker检测       差异表达          拟时序分析
                    │                │
                    └───────┬────────┘
                            ▼
                        功能富集
                            │
                            ▼
                         报告生成
```

### 🎨 九个生信专业 UI 组件

| 组件 | 功能 |
|------|------|
| `ProgressTracker` | DAG 垂直时间轴，实时节点状态 (⏳🔄✅⚠️❌⏸)，耗时显示，暂停/恢复/中止控件 |
| `QCReportCard` | 单 Skill QC 报告卡片，绿/黄/红三级评级 + 交互式建议按钮 (应用建议/自定义阈值/忽略) |
| `VizPanel` | Tab 切换可视化面板 (UMAP/火山图/热图/点图/小提琴图)，SVG/PNG 下载 |
| `ThinkingPanel` | 七步思考过程折叠手风琴，逐段颜色编码，加载动画 |
| `FileBrowser` | 递归树形文件浏览器，格式图标，文件大小，上传/探测/删除操作 |
| `FileInspector` | 文件格式探测结果 (维度/列名/数据类型/样本预览) |
| `KnowledgeRef` | Agent 知识引用来源展示 (Vector/Graph/Wiki 分层，相关度条) |
| `ResourceMonitor` | 容器 CPU/RAM/Disk 实时仪表盘，颜色阈值，容器计数 |
| `WorkflowSelector` | 下拉选择可用 Workflow，展示步骤数、资源预估和时间范围 |

### 🔧 九个自定义 Agent 工具

| 工具 | 功能 |
|------|------|
| `docker_exec` | 容器内命令执行 (6 种 action: ensure_image/start/exec/stop/status/list) |
| `docker_search` | Docker Hub + Quay.io 搜索 + 镜像质量自动评估 (recommended/try/avoid) |
| `docker_pull` | 镜像拉取 + 进度回调 |
| `docker_inspect` | 镜像元数据 + 层结构检查 |
| `docker_verify` | 工具可用性验证 (临时容器 + which/--version 双重检测) |
| `skill_invoke` | Skill 调用 (含容器生命周期管理) |
| `kb_query` | 三层知识库统一查询 (Vector + Graph + Wiki + 综合摘要) |
| `file_inspect` | 文件格式自动探测 (h5ad/h5/mtx/fastq/rds/csv 等) |
| `workflow_run` | Workflow 启动 + 检查点恢复 |

---

## 项目结构

```
BioAgent/
├── packages/
│   ├── agent-core/          # 🧠 BioAgent 核心运行时
│   │   ├── src/
│   │   │   ├── bio-agent.ts           # 主类，全流程编排
│   │   │   ├── thinking-engine.ts     # 七步结构化思考
│   │   │   ├── thinking-template.ts   # 思考模板定义
│   │   │   ├── session-manager.ts     # JSONL 会话管理 (CRUD+压缩+分支)
│   │   │   ├── tools/                 # 9 个自定义工具 (docker/skill/kb/file/workflow)
│   │   │   ├── hooks/                 # 3 个 Hooks (安全校验/QC判定/思考注入)
│   │   │   ├── messages/              # 4 种自定义消息类型
│   │   │   └── events/                # 22 个 SSE 事件类型枚举
│   │   └── __tests__/                 # 116 个测试
│   │
│   ├── executor/            # 🐳 Docker 执行环境管理
│   │   ├── src/
│   │   │   ├── container-manager.ts   # 容器生命周期 (12 个方法)
│   │   │   ├── image-manager.ts       # 镜像管理 (10 个方法)
│   │   │   ├── image-search.ts        # Docker Hub + Quay.io 搜索 + 质量评估
│   │   │   ├── volume-manager.ts      # 数据卷管理 (6 个方法)
│   │   │   ├── resource-probe.ts      # 宿主机资源探测 (CPU/RAM/GPU/磁盘/Python/R)
│   │   │   ├── docker-executor.ts     # 统一入口
│   │   │   └── types.ts               # 14 个核心接口
│   │   └── __tests__/                 # 37 个测试
│   │
│   ├── skills/              # 🔧 标准化 Skill 库
│   │   ├── src/
│   │   │   ├── base-skill.ts          # 六步管线抽象基类 + 辅助方法
│   │   │   ├── base-skill.types.ts    # SkillSpec/QCGate/SkillResult 等核心类型
│   │   │   ├── skill-registry.ts      # 注册/查询/依赖链分析/循环检测/导出
│   │   │   ├── skill-executor.ts      # 执行器 (资源检查 + QC处理 + 故障排除)
│   │   │   ├── io/           data-import
│   │   │   ├── qc/           scrna-qc, doublet-detection
│   │   │   ├── preprocess/   normalize, hvg, pca, batch-correction
│   │   │   ├── embed/        umap-tsne
│   │   │   ├── cluster/      clustering
│   │   │   ├── annotate/     cell-annotation (强制确认节点)
│   │   │   └── analysis/     marker, de, enrich
│   │   └── __tests__/                 # 70 个测试
│   │
│   ├── knowledge/           # 📚 三层知识体系
│   │   ├── src/
│   │   │   ├── bridge.ts             # 三层统一查询 + 综合摘要
│   │   │   ├── bridge.types.ts       # KnowledgeQuery/Result 类型
│   │   │   ├── vector-db/            # ChromaDB (3 个 Collection, 语义搜索)
│   │   │   ├── graph-db/             # KuzuDB (9 节点 + 10 关系, 多跳推理)
│   │   │   ├── wiki/                 # LLM Wiki 加载/解析/搜索
│   │   │   └── seed/                 # 知识种子注入
│   │   ├── data/
│   │   │   ├── wiki/                 # 8 篇 Wiki 文档
│   │   │   └── graph/                # CSV 种子数据 (基因/通路/Marker)
│   │   └── __tests__/                 # 65 个测试
│   │
│   ├── workflow/            # ⚙️ DAG 编排引擎
│   │   ├── src/
│   │   │   ├── engine.ts             # DAG 执行引擎 (启动/暂停/恢复/中止)
│   │   │   ├── engine.types.ts       # WorkflowDef/State/Node/Checkpoint
│   │   │   ├── scheduler.ts          # Kahn 拓扑排序 + 并行批次识别
│   │   │   ├── checkpoint.ts         # JSON 检查点管理 (保存/恢复/校验)
│   │   │   ├── condition.ts          # 安全表达式评估器
│   │   │   ├── error-policy.ts       # 重试/降级/跳过策略
│   │   │   ├── registry.ts           # Workflow 注册 (含重复检测)
│   │   │   └── workflows/
│   │   │       └── scrna-seq.workflow.ts  # 18 节点 scRNA-seq 标准 DAG
│   │   └── __tests__/                 # 71 个测试
│   │
│   └── ui/                  # 🖥️ 前端 Web 界面
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx         # 三栏主布局 (Header + Sidebar + Main + Panel)
│       │   │   ├── page.tsx           # 对话主界面 + 快速操作卡片
│       │   │   ├── projects/[id]/     # 项目详情页
│       │   │   └── api/               # 24 个 API Routes
│       │   │       ├── agent/         # 消息 (POST→SSE流) + 会话 (CRUD)
│       │   │       ├── workflow/      # Workflow 控制 (启动/暂停/恢复/中止)
│       │   │       ├── files/         # 文件管理 (上传/列表/探测/下载/删除)
│       │   │       ├── knowledge/     # 知识库查询
│       │   │       ├── resources/     # 资源监控
│       │   │       └── health/        # 健康检查
│       │   ├── components/bioagent/   # 9 个生信专业组件
│       │   ├── hooks/                 # 3 个 React Hooks (useSSE/useWorkflow/useBioAgent)
│       │   └── lib/                   # BioAgentClient + SSEClient
│       └── __tests__/                 # 50 个测试
│
├── docker/
│   ├── Dockerfile                       # BioAgent 生产镜像 (node:22-slim + pnpm)
│   ├── test-image.Dockerfile            # 本地 scRNA 测试镜像 (scanpy + scrublet)
│   └── docker-compose.yml               # 开发环境编排 (bioagent + chromadb)
│
├── docs/
│   ├── design/
│   │   └── bioagent-mvp-design.md       # 2856 行完整技术设计文档 (17 章)
│   ├── architecture-overview.md         # Mermaid 架构图 (5 张)
│   └── plans/                           # 4 Phase 80+ TDD 实现计划
│       ├── README.md                    # 计划总览
│       ├── phase-0-project-scaffold.md  # Phase 0: 项目搭建 (15 任务)
│       ├── phase-1-core-foundation.md   # Phase 1: 核心基础 (20 任务)
│       ├── phase-2-skills-workflow.md   # Phase 2: Skill + Workflow (23 任务)
│       ├── phase-3-frontend.md          # Phase 3: 前端 UI (15 任务)
│       └── phase-4-integration.md       # Phase 4: 集成测试 (7 任务)
│
├── data/                                # 运行时数据 (gitignored)
│   ├── projects/                        # 项目原始数据 + 中间结果 + 输出
│   ├── sessions/                        # Agent 对话记录 (JSONL 格式)
│   ├── chroma/                          # ChromaDB 向量持久化
│   ├── kuzu/                            # KuzuDB 图数据库持久化
│   └── logs/                            # 结构化运行日志 (pino JSON)
│
├── scripts/                             # 工具脚本 (dev/verify/setup)
├── .env.example                         # 环境变量模板 (30+ 配置项)
├── pnpm-workspace.yaml                  # Monorepo 工作区配置
├── tsconfig.base.json                   # TypeScript 基础配置
├── CLAUDE.md                            # Claude Code 项目开发指南
├── CONTRIBUTING.md                      # 贡献者指南
├── README.md                            # 英文文档
└── README_CN.md                         # 本文档 (中文)
```

---

## 技术栈

| 层级 | 技术选型 | 版本 | 选型理由 |
|------|---------|------|---------|
| **编程语言** | TypeScript | 5.x | 与 pi agent 生态一致，全栈类型安全 |
| **运行时** | Node.js | 22 LTS | 最新 LTS，ESM 原生支持 |
| **Agent 框架** | `@earendil-works/pi-agent-core` | 0.78.x | 需求文档指定，支持多轮工具调用 + 事件流 |
| **大语言模型** | Claude Sonnet 4.6 (via pi-ai) | — | 生物推理能力业界最强 |
| **LLM Provider** | `@earendil-works/pi-ai` | 0.78.x | 统一 20+ Provider 抽象层 |
| **前端框架** | Next.js 15 (App Router) | 15.x | Fork pi-web 技术栈，React SSR + API Routes |
| **样式方案** | TailwindCSS | 4.x | Utility-first CSS，pi-web 原生技术栈 |
| **Docker SDK** | dockerode | 4.x | Node.js Docker API 封装，容器全生命周期管理 |
| **向量数据库** | ChromaDB | 3.4.x | 轻量嵌入，Node.js SDK 成熟，支持 metadata 过滤 |
| **Embedding 模型** | text-embedding-3-small (OpenAI) | — | 1024 维向量，性价比最优 |
| **图数据库** | KuzuDB | 0.11.x | 嵌入式图数据库，零运维，Cypher 查询语法 |
| **文档解析** | gray-matter + unified + remark-parse | latest | YAML frontmatter 解析 + Markdown 处理 |
| **运行时校验** | zod | 3.23.x | 所有外部接口运行时 schema 校验 |
| **结构化日志** | pino | 9.x | 高性能 JSON 日志 |
| **测试框架** | vitest | 2.x | 快速 TypeScript 原生测试 |
| **包管理器** | pnpm | 9.x | Workspace monorepo 最佳支持 |
| **CI/CD** | GitHub Actions | — | typecheck + lint + test 自动化 |

---

## 配置说明

### 环境变量完整参考

```bash
# ========== BioAgent Core ==========
BIOAGENT_MODEL=claude-sonnet-4-6        # LLM 模型选择
BIOAGENT_MAX_TOKENS=4096                # 最大 token 数
BIOAGENT_THINKING_BUDGET=high           # 思考预算: off/low/medium/high/xhigh
BIOAGENT_TEMPERATURE=0.1                # 温度参数 (生信分析需要低温度确保一致性)

# ========== LLM Provider (pi-ai 多 provider) ==========
ANTHROPIC_API_KEY=sk-ant-...            # Anthropic API Key (必须填写)
OPENAI_API_KEY=sk-...                   # OpenAI API Key (用于 text-embedding-3-small)
PI_AI_DEFAULT_PROVIDER=anthropic        # 默认 LLM Provider

# ========== 路径配置 ==========
BIOAGENT_DATA_DIR=./data                # 运行时数据根目录
BIOAGENT_PROJECTS_DIR=./data/projects   # 项目数据存储路径
BIOAGENT_SESSIONS_DIR=./data/sessions   # 会话 JSONL 存储路径
BIOAGENT_LOGS_DIR=./data/logs           # 运行日志存储路径
BIOAGENT_KNOWLEDGE_DIR=./packages/knowledge/data  # 知识库 Wiki 文档路径

# ========== Docker 配置 ==========
DOCKER_HOST=unix:///var/run/docker.sock # Docker daemon 地址 (Windows: //./pipe/dockerDesktopLinuxEngine)
DOCKER_DEFAULT_PLATFORM=linux/amd64     # 默认容器平台
DOCKER_PULL_TIMEOUT=3600000             # 镜像拉取超时 (毫秒, 默认 1 小时)
DOCKER_EXEC_DEFAULT_TIMEOUT=600000      # 命令执行超时 (毫秒, 默认 10 分钟)

# ========== ChromaDB ==========
CHROMA_URL=http://localhost:8000        # ChromaDB 服务地址
CHROMA_PERSIST_DIR=./data/chroma        # 向量数据持久化目录

# ========== KuzuDB ==========
KUZU_DB_PATH=./data/kuzu                # 图数据库持久化目录

# ========== 执行控制 ==========
REQUIRE_USER_CONFIRMATION=true          # 关键节点 (如细胞注释) 是否强制用户确认
MAX_PARALLEL_SKILLS=4                   # 最大并行 Skill 数量
MAX_SESSION_LENGTH=200                  # 会话最大轮次 (超长自动压缩)
AUTO_COMPRESS_SESSION=true              # 是否自动压缩超长会话
SESSION_COMPRESS_THRESHOLD=150          # 触发压缩的轮次阈值

# ========== 日志 ==========
LOG_LEVEL=info                          # 日志级别: trace/debug/info/warn/error
LOG_FORMAT=json                         # 日志格式: json/pretty
```

---

## 开发指南

### 目录约定

| 目录 | 说明 |
|------|------|
| `data/` | 运行时数据目录，已加入 .gitignore |
| `packages/*/src/` | 各包源代码 |
| `packages/*/__tests__/` | 测试文件 |
| `packages/knowledge/data/` | 种子知识数据 (受版本控制) |
| `packages/workflow/src/workflows/` | 预定义 Workflow 定义 |

### 常用命令

```bash
# ====== 环境准备 ======
pnpm install                     # 安装所有依赖

# ====== 开发运行 ======
pnpm dev                         # 启动开发服务器 (Next.js dev server on :3000)
pnpm build                       # 构建所有包
pnpm start                       # 生产模式启动

# ====== 类型检查 ======
pnpm typecheck                   # 所有包类型检查
pnpm --filter @bioagent/executor typecheck   # 单包类型检查

# ====== 测试 ======
pnpm test:unit                   # 运行全部单元测试
pnpm --filter @bioagent/skills test:unit     # 单包单元测试
pnpm test:integration            # 运行集成测试 (需要 Docker 运行中)

# ====== 知识库 ======
pnpm seed:knowledge              # 注入种子知识数据
pnpm --filter @bioagent/knowledge seed       # 同上

# ====== 清理 ======
pnpm clean                       # 清理所有构建产物
```

### 添加新 Skill

1. 创建文件 `packages/skills/src/<category>/<name>.skill.ts`
2. 继承 `BaseSkill` 抽象类，实现全部 6 个抽象方法
3. 定义完整的 `SkillSpec`（输入规范、工具决策树、QC 门槛、故障排除）
4. 在 `SkillRegistry` 中注册
5. 编写单元测试 + 集成测试

```typescript
import { BaseSkill } from "../base-skill";

export class MyNewSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "my-new-skill",
    version: "1.0.0",
    description: "我的新分析步骤",
    omicsType: "scrna",
    // ... 完整 spec 定义 (input/tools/parameters/qcGates/outputs/troubleshooting)
  };

  async validateInput(data: DataContext): Promise<ValidationResult> {
    // 检查输入文件存在性、格式、最小样本量
  }
  async selectTool(data: DataContext, resources: ResourceReport): Promise<ToolChoice> {
    // 根据数据特征和资源选择最优工具
  }
  async configureParams(data: DataContext, tool: ToolChoice): Promise<Record<string, any>> {
    // 生成参数配置 (初始建议 + 数据驱动调优)
  }
  async run(context: SkillContext): Promise<SkillExecResult> {
    // 生成完整 Python/R 脚本，通过 this.execInContainer() 在容器内执行
  }
  async runQC(results: SkillExecResult): Promise<QCReport> {
    // 运行 QC 关卡，返回 pass/warn/fail + 具体指标
  }
  async formatOutput(results: SkillExecResult, qc: QCReport): Promise<SkillOutput> {
    // 格式化为用户友好输出 + 文件路径 + 可视化数据
  }
}
```

### 添加新 Workflow

```typescript
import type { WorkflowDef } from "../engine.types";

export const MY_NEW_WORKFLOW: WorkflowDef = {
  name: "my-new-workflow",
  version: "1.0.0",
  description: "我的新分析流程",
  resourceEstimate: { cpu: "8 cores", ram: "32GB", disk: "50GB", time: "2-4 hours", gpu: "optional" },
  input: { dataFormat: ["h5ad"], required: ["expression_data"], optional: ["batch_info"] },
  output: { directory: "bioagent_output/{project_id}/my-workflow/", files: [
    { name: "01_report.html", description: "最终报告" },
  ]},
  nodes: [
    {
      id: "step1", skill: "my-skill", dependsOn: [], dependsOnMode: "all",
      optional: false, checkpoint: true, pauseAfter: false,
      retry: { maxAttempts: 3, delayMs: 30000, backoff: "fixed" },
    },
    {
      id: "step2", skill: "another-skill", dependsOn: ["step1"], dependsOnMode: "all",
      optional: false, checkpoint: false, pauseAfter: true,  // 强制确认
    },
  ],
  errorPolicy: {
    maxRetries: 3, retryDelayMs: 30000,
    onExhausted: "pause_and_ask",   // 重试耗尽 → 暂停询问用户
    skipOptional: true,             // 可选节点失败自动跳过
    notifyOnWarning: true,          // QC 警告通知用户
  },
};
```

---

## API 概览

### REST 端点 (24 个)

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/agent/message` | 发送消息，返回 SSE 事件流 |
| `GET` | `/api/agent/sessions` | 获取会话列表 |
| `POST` | `/api/agent/sessions` | 创建新会话 |
| `DELETE` | `/api/agent/sessions/:id` | 删除会话 |
| `POST` | `/api/agent/sessions/:id/fork` | 从指定消息处 Fork 会话 |
| `POST` | `/api/agent/sessions/:id/compress` | 压缩超长会话 |
| `POST` | `/api/workflow` | 启动 Workflow |
| `GET` | `/api/workflow/:runId` | 获取 Workflow 运行状态 |
| `POST` | `/api/workflow/:runId/pause` | 暂停 Workflow |
| `POST` | `/api/workflow/:runId/resume` | 恢复 Workflow |
| `POST` | `/api/workflow/:runId/abort` | 中止 Workflow |
| `GET` | `/api/workflow/:runId/events` | Workflow SSE 事件流 |
| `POST` | `/api/files/upload` | 上传数据文件 |
| `GET` | `/api/files/list` | 文件列表 (?project_id=) |
| `GET` | `/api/files/inspect` | 探测文件格式 (?path=) |
| `GET` | `/api/files/download` | 下载文件 (?path=) |
| `DELETE` | `/api/files` | 删除文件 (?path=) |
| `GET` | `/api/knowledge/query` | 知识库查询 (?q=&context=) |
| `GET` | `/api/viz/:type/:projectId/*` | 可视化图片 (type=svg/png) |
| `GET` | `/api/resources` | 宿主机资源状态 |
| `GET` | `/api/health` | 系统健康检查 |
| `GET` | `/api/projects` | 项目列表 |
| `POST` | `/api/projects` | 创建项目 |
| `DELETE` | `/api/projects/:id` | 删除项目 |

### SSE 事件类型 (22 个)

```
thinking:started      思考阶段开始
thinking:section      思考分段输出
thinking:completed    思考完成 (含结构化结果)
message:start         消息开始
message:chunk         流式文本块
message:end           消息结束
tool:start            工具开始执行
tool:progress         工具执行进度 (如 docker pull)
tool:end              工具执行完毕
workflow:started      Workflow 启动
workflow:node:start   节点开始
workflow:node:end     节点完成
workflow:paused       等待用户确认
workflow:resumed      用户确认后恢复
workflow:completed    全部完成
workflow:failed       执行失败
qc:report             QC 报告
qc:warning            QC 警告
qc:failed             QC 失败
viz:ready             可视化已生成
knowledge:reference   Agent 引用了知识库
error                 错误
error:recoverable     可恢复错误
error:fatal           致命错误
```

---

## 测试策略

```
         ┌──────────┐
         │ E2E (1)  │  端到端 scRNA 迷你工作流 (真实 Docker 容器)
         ├──────────┤
         │ 集成 (3) │  Skill + Docker + 知识库集成
         ├──────────┤
         │ 单元 (25)│  纯函数 / Mock 测试
         └──────────┘
```

| 包 | 测试文件数 | 测试数 | 覆盖范围 |
|----|-----------|--------|---------|
| `agent-core` | 4 | 116 | Thinking (19), Session (17), Hooks (28), Tools (52) |
| `executor` | 3 | 37 | Container integration (10), Image (13), Helpers (14) |
| `knowledge` | 4 | 65 | Wiki (19), Chroma (15), Kuzu (17), Bridge (14) |
| `skills` | 3 | 70 | BaseSkill (25), Registry (30), Executor (15) |
| `workflow` | 3 | 71 | Scheduler (25), Checkpoint (19), Engine (27) |
| `ui` | 2 | 50 | SSE Client (34), QCReportCard (16) |
| **合计** | **19** | **409** | |

```bash
# 运行全部测试
pnpm test:unit                    # 408/409 通过 (99.7%)

# 运行集成测试 (需要 Docker)
pnpm test:integration
```

---

## 路线图

| 版本 | 范围 | 状态 |
|------|------|------|
| **v0.1.0** | scRNA-seq MVP: 13 Skill, 三层知识库, DAG 引擎, Web UI | ✅ 已发布 |
| **v0.2.0** | P1 Skill (拟时序/细胞通讯/调控网络), HPC/SSH 远程桥接, 用户自定义 Workflow 编辑器 | 📋 计划中 |
| **v0.3.0** | Bulk RNA-seq + scATAC-seq + 空间转录组 Workflow, 文献学习系统 v1 | 📋 计划中 |
| **v1.0.0** | 全组学覆盖, 云端部署 (AWS/GCP/Azure/Aliyun), 100+ Skill, 社区 Skill 市场 | 📋 计划中 |

---

## 文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| 技术设计 | [docs/design/bioagent-mvp-design.md](docs/design/bioagent-mvp-design.md) | 2856 行, 17 章完整技术规格 |
| 架构总览 | [docs/architecture-overview.md](docs/architecture-overview.md) | 5 张 Mermaid 架构图 |
| 实现计划 | [docs/plans/](docs/plans/) | 4 Phase 80+ TDD 任务详细拆解 |
| 贡献指南 | [CONTRIBUTING.md](CONTRIBUTING.md) | Skill 开发规范 + 代码风格 |
| 英文文档 | [README.md](README.md) | English documentation |

---

## 贡献指南

欢迎贡献！请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

### 提交规范

- `feat(scope): 描述` — 新功能
- `fix(scope): 描述` — Bug 修复
- `docs(scope): 描述` — 文档
- `test(scope): 描述` — 测试
- `chore(scope): 描述` — 杂项

---

## 许可证

MIT © 2026 BioAgent

---

**BioAgent — AI 首席生信科学家 + AI 科研科学家 + AI 知识管理者。三位一体的数字科研人员。**
