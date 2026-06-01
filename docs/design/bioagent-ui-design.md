# BioAgent 前端 UI 设计文档

> 版本: 2.0 | 日期: 2026-06-01 | 状态: 设计中
>
> 取代基于 pi-web fork 的旧 UI，从 BioAgent 的实际需求出发重新设计。

---

## 目录

1. [设计哲学](#1-设计哲学)
2. [整体布局](#2-整体布局)
3. [Zone 1: Activity Bar](#3-zone-1-activity-bar)
4. [Zone 2: Primary Sidebar](#4-zone-2-primary-sidebar)
5. [Zone 3: Main Editor](#5-zone-3-main-editor)
6. [Zone 4: Chat Panel](#6-zone-4-chat-panel)
7. [Zone 5: Bottom Panel](#7-zone-5-bottom-panel)
8. [Zone 6: Status Bar](#8-zone-6-status-bar)
9. [数据流](#9-数据流)
10. [状态管理](#10-状态管理)
11. [主题系统](#11-主题系统)
12. [组件清单](#12-组件清单)
13. [实现计划](#13-实现计划)

---

## 1. 设计哲学

### 1.1 与 pi-web 的差异

| 维度 | pi-web | BioAgent |
|------|--------|----------|
| 定位 | 通用 AI 编码助手 | 生信分析专用 Agent |
| 主工作区 | 聊天对话 | 文件/结果查看 |
| 对话位置 | 占据中央 | 右侧辅助面板 |
| 项目概念 | 无 (只有工作目录) | 生信项目 (project.yml) |
| 特有功能 | 代码编辑、分支管理 | 容器管理、知识库、QC报告 |

### 1.2 核心原则

1. **对话是工具，不是主角** — 聊天面板在右侧，用户的主要注意力在数据和分析结果上
2. **项目即目录** — 打开目录就是打开项目，project.yml 记录元数据
3. **一切可拖拽调节** — 每个面板的尺寸用户可自由调整
4. **深色优先** — 生信人员长时间看屏幕，深色主题是默认
5. **信息在上下文中** — QC报告、进度条出现在消息流里，不跳出

---

## 2. 整体布局

```
┌───┬────────────────┬──────────────────────┬──────────────┐
│ A │ 2              │ 3                    │ 4            │
│ c │ PRIMARY        │ MAIN EDITOR          │ CHAT PANEL   │
│ t │ SIDEBAR        │                      │              │
│ i │                │ 项目概览 / 文件查看   │ 💬 对话面板   │
│ v │ 📁 项目选择器   │ 分析结果 / 可视化    │ 会话选择器    │
│ i │ 📂 文件树      │                      │ 消息列表      │
│ t │ 🐳 容器列表    │                      │ 输入框        │
│ y │ 📚 知识库      │                      │              │
│   │                │                      │              │
│ B │ 触底           │                      │ 触底         │
│ a │                ├──────────────────────│              │
│ r │                │ 5                    │              │
│   │                │ BOTTOM PANEL         │              │
│   │                │ 📤输出│🐳logs│>终端  │              │
├───┴────────────────┴──────────────────────┴──────────────┤
│ 6  STATUS BAR  🐳2容器 │ 📊ctx │ DeepSeek │ 🔗代理 ✅    │
└─────────────────────────────────────────────────────────┘
```

### 2.1 布局约束

| Zone | 默认尺寸 | 可调范围 | 触底 |
|------|---------|---------|------|
| 1. Activity Bar | 44px | 32-64px | ✅ |
| 2. Primary Sidebar | 260px | 160-500px | ✅ |
| 3. Main Editor | flex:1 | — | — |
| 4. Chat Panel | 400px | 280-600px | ✅ |
| 5. Bottom Panel | 160px | 60-400px | — |
| 6. Status Bar | 22px | 16-36px | 全宽 |

### 2.2 关键规则

- **Zone 1/2/4 触底** — Activity Bar、Primary Sidebar、Chat Panel 从顶部延伸到 Status Bar
- **Zone 5 仅在 Zone 3 下方** — Bottom Panel 不覆盖 Sidebar 和 Chat Panel
- **所有尺寸可拖拽** — 分隔线 hover 高亮，拖拽时改变光标

---

## 3. Zone 1: Activity Bar

```
┌───┐
│ 📁 │ ← 文件浏览器 (默认)
│ 🐳 │ ← 容器管理
│ 📚 │ ← 知识库
│   │
│   │
│   │
│ ⚙️ │ ← 设置 (底部固定)
└───┘
```

### 3.1 行为
- 点击切换 Primary Sidebar 的内容
- 当前活动项高亮 (左侧蓝色竖线 + 图标不透明)
- 非活动项半透明，hover 恢复不透明
- ⚙️ 始终在底部，点击打开设置面板

### 3.2 状态
```
activeActivity: "files" | "containers" | "knowledge"
```

---

## 4. Zone 2: Primary Sidebar

由 Activity Bar 控制显示哪种视图。

### 4.1 文件浏览器视图 (activeActivity = "files")

```
┌──────────────┐
│ BioAgent     │ ← 标题 (静态)
│ [🧬 项目名 ▾] [+] │ ← 项目选择器 + 新建按钮
├──────────────┤
│ 📁 raw/      │ ← FileExplorer
│ 📁 output/   │
│ 📄 project.yml│
│              │
│ (触底)       │
└──────────────┘
```

#### 项目选择器
- 显示当前项目名 (缩短路径)
- 点击展开下拉: 最近项目列表 + "自定义路径…"
- `[+]` 按钮: 弹出新建项目模态框
  - 输入: 项目名称
  - 自动调用 `/api/projects/init` → 创建标准目录 + project.yml
  - 创建后自动切换为当前项目

#### FileExplorer
- 复用 pi-web 的 FileExplorer 组件 (已验证可用)
- 点击文件 → 在 Main Editor 中打开
- 右键文件 → 在系统文件管理器中显示

### 4.2 容器管理视图 (activeActivity = "containers")

```
┌──────────────┐
│ 🐳 项目容器   │
├──────────────┤
│ 🟢 scrna-qc  │ ← 运行中
│    bioagent  │
│    1.2GB 12m │
│ [📋日志][⏹停止]│
│              │
│ 🔴 bulk-rna  │ ← 已停止
│    2h ago    │
│ [🔄重启][🗑删除]│
└──────────────┘
```

#### 数据来源
- `GET /api/resources` → Docker 容器列表
- 过滤: 仅显示当前项目相关的容器 (通过 volume mount 匹配 CWD)

#### 行为
- 📋 日志 → 在 Bottom Panel 的 docker logs tab 中显示
- ⏹ 停止 → `docker stop <container>`
- 🔄 重启 → `docker start <container>`
- 🗑 删除 → `docker rm <container>`

### 4.3 知识库视图 (activeActivity = "knowledge")

```
┌──────────────┐
│ 📚 知识库 (19)│
├──────────────┤
│ 🔍 [________]│ ← 搜索框
│              │
│ 📄 scRNA QC  │
│ 📄 归一化    │
│ 📄 聚类指南  │
│ 📄 细胞注释  │
│ 📄 批次校正  │
│ ...          │
└──────────────┘
```

#### 数据来源
- `GET /api/knowledge?question=` → WikiLoader 搜索结果

#### 行为
- 搜索框输入 → 实时过滤文档列表
- 点击文档 → 在 Main Editor 中打开预览
- 引用: 点击文档旁的 📎 → 插入到当前对话

---

## 5. Zone 3: Main Editor

### 5.1 状态机

```
没有项目选中:
┌──────────────────┐
│       🧬         │
│  BioAgent 分析   │
│  选择项目开始    │
└──────────────────┘

项目选中，无文件打开:
┌──────────────────┐
│   项目概览        │
│   最近文件        │
│   快速操作        │
└──────────────────┘

文件打开:
┌──────────────────┐
│ Tab: de.csv ×    │ ← 文件标签
├──────────────────┤
│                  │
│  文件内容        │ ← FileViewer
│                  │
└──────────────────┘
```

### 5.2 文件标签
- 支持多文件打开，标签式切换
- 每个标签可以关闭 (×)
- 拖拽标签可重新排序

### 5.3 FileViewer
- 复用 pi-web 的 FileViewer (已验证可用)
- 支持: 文本、CSV/TSV 表格、图片预览、Markdown 渲染

---

## 6. Zone 4: Chat Panel

```
┌──────────────┐
│ 💬 [会话▾] ✏️ [+]│ ← 会话选择器 + 重命名 + 新建
├──────────────┤
│              │
│  消息列表     │ ← ChatWindow (复用 pi-web)
│              │
│  ┌────────┐  │
│  │输入框   │  │ ← ChatInput (复用 pi-web)
│  └────────┘  │
└──────────────┘
```

### 6.1 会话管理
- 下拉: 当前项目的所有会话 (按 projectCwd 过滤)
- ✏️: 重命名当前会话 (PATCH /api/sessions/[id])
- [+]: 在当前项目中新建会话

### 6.2 消息渲染增强
pi-web 的消息渲染已有 thinking/tool/text 三种 content block。BioAgent 新增:

| Block 类型 | 渲染方式 |
|-----------|---------|
| `text` | Markdown 渲染 (已有) |
| `thinking` | 可折叠思考块 (已有) |
| `toolCall` | 工具调用卡片 (已有) |
| `qc_report` | 内联 QC 报告卡 (新增) |
| `progress` | 管线进度条 (新增) |
| `knowledge_ref` | 知识引用条 (新增) |

### 6.3 ChatWindow/Input 复用
pi-web 的 ChatWindow 和 ChatInput 组件功能完整 (流式 SSE、附件、模型切换、推理强度等)，直接复用。

---

## 7. Zone 5: Bottom Panel

```
┌──────────────────────────────────────┐
│ 📤 输出 │ 🐳 docker logs │ > 终端  │ ▼ │
├──────────────────────────────────────┤
│ [BioAgent] 开始执行: scrna-qc        │
│ $ docker run -d --name scrna-qc ...  │
│ ✅ Exit Code: 0 | Duration: 2.3s     │
│ Cells after filter: 2698 (99.9%)     │
└──────────────────────────────────────┘
```

### 7.1 三个 Tab

| Tab | 内容 |
|-----|------|
| 📤 输出 | Agent 的执行日志 (docker_exec stdout/stderr) |
| 🐳 docker logs | 容器实时日志流 |
| > 终端 | 当前项目目录下的交互式 shell |

### 7.2 行为
- 点击 ▼ 折叠面板 (只显示 tab 栏)
- 拖拽上边框调整高度
- Top Bar 有专用展开/收起按钮

---

## 8. Zone 6: Status Bar

```
🐳 2 containers │ 📊 45% / 1.0M ctx │ 🔗 代理:127.0.0.1:65532 │ DeepSeek V4 Pro │ $0.0012
```

### 8.1 内容

| 项目 | 数据来源 | 交互 |
|------|---------|------|
| 🐳 N containers | Docker API | 点击切换到容器管理 |
| 📊 ctx | ChatWindow contextUsage | hover 显示详情 |
| 🔗 代理 | process.env.HTTPS_PROXY | 点击打开设置 |
| 模型名 | ChatWindow model | hover 显示完整名称 |
| 费用 | ChatWindow sessionStats | 实时更新 |

---

## 9. 数据流

```
┌─────────────────────────────────────────────────────────┐
│                      AppShell                            │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌───────────┐ │
│  │ActivityBar│  │Sidebar  │  │Editor   │  │ChatPanel  │ │
│  │          │  │         │  │         │  │           │ │
│  │ onChange │  │project  │  │file     │  │session    │ │
│  │ ───────► │  │selector │  │viewer   │  │selector   │ │
│  │          │  │fileTree │  │tabs     │  │chatWindow │ │
│  └─────────┘  └─────────┘  └──────────┘  └───────────┘ │
│                                                         │
│  State: selectedCwd, selectedSession, activeActivity    │
│         sidebarWidth, chatWidth, panelHeight            │
│         allSessions, contextUsage, sessionStats         │
└─────────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
    /api/sessions    /api/files      /api/agent/[id]/events
    /api/projects    /api/resources  /api/knowledge
    /api/workflow    /api/projects/init
```

### 9.1 API 依赖

| API 端点 | 用途 | 调用方 |
|---------|------|-------|
| `/api/sessions` | 会话列表 | ChatPanel, ProjectSidebar |
| `/api/sessions/[id]` | 重命名/删除会话 | ChatPanel |
| `/api/agent/new` | 创建新对话 | ChatPanel |
| `/api/agent/[id]/events` | SSE 事件流 | ChatWindow |
| `/api/projects/init` | 初始化项目目录 | ProjectSidebar |
| `/api/resources` | 资源/容器状态 | ContainerListView, StatusBar |
| `/api/knowledge?question=` | 知识库查询 | KnowledgeView |
| `/api/workflow` | 工作流定义 | MainEditor (项目概览) |
| `/api/files?type=list` | 文件列表 | FileExplorer |

---

## 10. 状态管理

### 10.1 AppShell 全局状态

```typescript
// 项目
selectedCwd: string | null;           // 当前项目目录
activeActivity: "files" | "containers" | "knowledge";

// 会话
selectedSession: SessionInfo | null;
allSessions: SessionInfo[];

// 布局
sidebarWidth: number;   // 默认 260
chatWidth: number;      // 默认 400
panelHeight: number;    // 默认 160
sidebarOpen: boolean;   // 侧栏展开
bottomPanelOpen: boolean; // 底栏展开

// Agent 运行时 (来自 ChatWindow)
contextUsage: { percent, contextWindow, tokens } | null;
sessionStats: { tokens, cost } | null;
```

### 10.2 组件内部状态

| 组件 | 自有状态 |
|------|---------|
| ProjectSidebar | dropdownOpen, recentCwds, newProjectOpen |
| ChatPanel | renaming, renameValue |
| BottomPanel | activeTab, collapsed |
| ContainerListView | containers[] (polling) |
| KnowledgeView | searchQuery, results[] |

---

## 11. 主题系统

### 11.1 CSS 变量

```css
:root {
  /* 背景 */
  --bg: #0d1117;
  --bg-panel: #12171f;
  --bg-hover: #1c2840;
  --bg-selected: #1c2840;

  /* 文字 */
  --text: #e6edf3;
  --text-muted: #8b949e;
  --text-dim: #6e7681;

  /* 边框 */
  --border: #30363d;

  /* 强调 */
  --accent: #58a6ff;
  --green: #3fb950;
  --orange: #d29922;
  --red: #f85149;
}
```

### 11.2 浅色主题
通过 CSS 变量覆盖实现。用户在设置中切换，偏好保存到 localStorage。

---

## 12. 组件清单

### 12.1 新建组件

| 组件 | 文件 | 职责 |
|------|------|------|
| ActivityBar | `ActivityBar.tsx` | 左侧图标栏，切换侧栏视图 |
| ProjectSidebar | `ProjectSidebar.tsx` | 项目选择器 + 文件树 |
| ContainerListView | `ContainerListView.tsx` | 容器列表 (项目隔离) |
| KnowledgeView | `KnowledgeView.tsx` | 知识库搜索/浏览 |
| ChatPanel | `ChatPanel.tsx` | 会话管理 + ChatWindow 容器 |
| BottomPanel | `BottomPanel.tsx` | 输出/docker日志/终端 |
| StatusBar | `StatusBar.tsx` | 状态信息栏 |
| ResizeHandle | `ResizeHandle.tsx` | 面板拖拽调节 |
| AppShell | `AppShell.tsx` | 主布局编排 |

### 12.2 复用 pi-web 组件

| 组件 | 用途 |
|------|------|
| ChatWindow | 消息列表 + SSE 流处理 |
| ChatInput | 消息输入 + 附件 + 模型切换 |
| FileExplorer | 文件树浏览器 |
| FileViewer | 文件内容查看 (文本/CSV/图片) |
| MessageView | 消息渲染 (text/thinking/tool) |
| ModelsConfig | 模型配置面板 |
| BranchNavigator | 对话分支导航 |

### 12.3 废弃组件

| 组件 | 原因 |
|------|------|
| SessionSidebar | 被 ProjectSidebar 替代 |
| Bio Panel (9组件) | 内容已内联到消息流 |
| AppShell (旧) | 被新布局替代 |

---

## 13. 实现计划

### Phase 1: 核心布局 (已完成大部分)

- [x] ActivityBar — 图标栏 + 切换逻辑
- [x] ProjectSidebar — 项目选择 + 文件树
- [x] ChatPanel — 会话下拉 + ChatWindow 嵌入
- [x] BottomPanel — 三 tab 面板 + 折叠
- [x] StatusBar — 状态信息条
- [x] ResizeHandle — 拖拽调节
- [x] AppShell 重写 — VS Code 布局编排

### Phase 2: 内容增强

- [ ] ContainerListView — 真实 Docker API 对接 (目前 mock)
- [ ] KnowledgeView — 搜索输入 + WikiLoader 对接
- [ ] Main Editor 文件标签 — 多文件打开 + 切换
- [ ] StatusBar 实时数据 — 容器数/token/费用动态更新

### Phase 3: 废弃清理

- [ ] 删除 SessionSidebar.tsx
- [ ] 删除 9 个 bio panel 组件
- [ ] 删除旧 AppShell 残留代码
- [ ] 清理 i18n 无用 key

---

> **设计原则**: 不修改 pi-web 源码。复用通过 import 原有组件实现，新建通过创建独立文件实现。
