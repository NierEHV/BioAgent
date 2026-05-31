# Phase 3: 前端 UI — Fork pi-web + 生信面板

**目标:** Fork `@agegr/pi-web`，新增 9 个生信专业组件，对接 BioAgent API
**前置:** Phase 2 完成
**预计:** 17 天

---

## 文件结构

```
NEW:    packages/ui/src/app/layout.tsx
NEW:    packages/ui/src/app/page.tsx
NEW:    packages/ui/src/app/projects/[id]/page.tsx

NEW:    packages/ui/src/app/api/agent/route.ts
NEW:    packages/ui/src/app/api/agent/sessions/route.ts
NEW:    packages/ui/src/app/api/workflow/route.ts
NEW:    packages/ui/src/app/api/workflow/[id]/route.ts
NEW:    packages/ui/src/app/api/files/route.ts
NEW:    packages/ui/src/app/api/knowledge/route.ts
NEW:    packages/ui/src/app/api/resources/route.ts
NEW:    packages/ui/src/app/api/health/route.ts

NEW:    packages/ui/src/components/bioagent/ProgressTracker.tsx
NEW:    packages/ui/src/components/bioagent/ProgressNode.tsx
NEW:    packages/ui/src/components/bioagent/QCReportCard.tsx
NEW:    packages/ui/src/components/bioagent/QCReportList.tsx
NEW:    packages/ui/src/components/bioagent/VizPanel.tsx
NEW:    packages/ui/src/components/bioagent/VizTabs.tsx
NEW:    packages/ui/src/components/bioagent/FileBrowser.tsx
NEW:    packages/ui/src/components/bioagent/FileInspector.tsx
NEW:    packages/ui/src/components/bioagent/KnowledgeRef.tsx
NEW:    packages/ui/src/components/bioagent/ThinkingPanel.tsx
NEW:    packages/ui/src/components/bioagent/WorkflowSelector.tsx
NEW:    packages/ui/src/components/bioagent/ResourceMonitor.tsx

NEW:    packages/ui/src/lib/bioagent-client.ts
NEW:    packages/ui/src/lib/sse-client.ts
NEW:    packages/ui/src/lib/utils.ts

NEW:    packages/ui/src/hooks/useSSE.ts
NEW:    packages/ui/src/hooks/useWorkflow.ts
NEW:    packages/ui/src/hooks/useBioAgent.ts

NEW:    packages/ui/__tests__/components/ProgressTracker.test.tsx
NEW:    packages/ui/__tests__/components/QCReportCard.test.tsx
NEW:    packages/ui/__tests__/lib/sse-client.test.ts
```

---

## Part A: API Routes

### Task 3.1: API Routes — agent + sessions

```typescript
// packages/ui/src/app/api/agent/route.ts
// POST: 接收用户消息 → 桥接到 agent-core → 返回 SSE 流
export async function POST(req: Request) {
  const { session_id, message, attachments } = await req.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // 1. file_inspect（如有附件）
        // 2. kb_query
        // 3. thinking → emit thinking:* events
        // 4. 调用 pi agent（含 BioAgent 工具）
        // 5. 工具调用 → emit tool:* events
        // 6. Agent 回复 → emit message:* events
        emit("done", { status: "completed" });
      } catch (err) {
        emit("error", { message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
}
```

其他 Route：`sessions/route.ts`（GET 列表 + POST 创建 + DELETE），`workflow/route.ts`（POST 启动 + GET 状态），`files/route.ts`（上传/列表/探测/下载），`knowledge/route.ts`（查询），`resources/route.ts`（宿主机资源），`health/route.ts`（健康检查）。

### Task 3.2: API Client — bioagent-client.ts

完整实现设计文档 §10.4 中的 `BioAgentClient` 类，包含所有 API 方法。

---

## Part B: 前端组件

### Task 3.3: SSE Client — sse-client.ts + useSSE.ts

```typescript
// packages/ui/src/lib/sse-client.ts
export class BioAgentSSEClient {
  private eventSource: EventSource | null = null;
  private handlers = new Map<string, Set<(data: any) => void>>();

  constructor(private baseUrl: string) {}

  connect(sessionId: string): void {
    this.eventSource = new EventSource(`${this.baseUrl}/api/agent?session=${sessionId}`);
    
    for (const eventType of [
      "thinking:started", "thinking:section", "thinking:completed",
      "tool:start", "tool:end", "tool:progress",
      "message:start", "message:chunk", "message:end",
      "workflow:started", "workflow:node:start", "workflow:node:end",
      "workflow:paused", "workflow:completed", "workflow:failed",
      "qc:report", "qc:warning", "qc:failed",
      "viz:ready", "knowledge:reference", "error",
    ]) {
      this.eventSource.addEventListener(eventType, (e) => {
        const data = JSON.parse(e.data);
        this.handlers.get(eventType)?.forEach(h => h(data));
      });
    }
  }

  disconnect(): void { this.eventSource?.close(); }

  on(eventType: string, handler: (data: any) => void): void {
    if (!this.handlers.has(eventType)) this.handlers.set(eventType, new Set());
    this.handlers.get(eventType)!.add(handler);
  }

  off(eventType: string, handler: (data: any) => void): void {
    this.handlers.get(eventType)?.delete(handler);
  }
}
```

### Task 3.4: ThinkingPanel — 思考过程可视化

折叠手风琴组件，用不同颜色标识 7 个思考阶段，支持流式逐段展示。

### Task 3.5: ProgressTracker — DAG 进度视图

垂直时间轴组件，每个节点显示：
- 状态图标（⏳/🔄/✅/⚠️/❌/⏸）
- 节点名称 + Skill 名称
- 耗时
- 检查点标记
- 展开显示 QC 结果摘要

### Task 3.6: QCReportCard — QC 报告卡片

单个 Skill 的 QC 报告，顶部显示 overall（绿/黄/红），下方展开各 gate 结果：
```
✅ 基因数分布正常  (median: 2,458 genes/cell)
✅ UMI 计数正常     (median: 8,200 UMI/cell)
⚠️ 线粒体比例偏高   (8.2% 细胞 pctMT > 20%)
   [应用建议: 阈值 20%] [自定义阈值] [忽略]
```

### Task 3.7: VizPanel — 可视化面板

Tab 切换：UMAP / 火山图 / 热图 / 点图 / 小提琴图，SVG/PNG 图片展示，支持下载和微调配色。

### Task 3.8: FileBrowser + FileInspector

左侧树形视图展示项目文件结构，点击文件弹出 Inspect 面板显示格式、维度、预览。

### Task 3.9: KnowledgeRef + ResourceMonitor + WorkflowSelector

- **KnowledgeRef:** 展示 Agent 当前引用的知识来源（Vector/Graph/Wiki 分层显示）
- **ResourceMonitor:** 实时显示容器 CPU/RAM/Disk 使用率
- **WorkflowSelector:** 下拉选择可用 Workflow（MVP 仅 scrna-seq-standard），展示预估资源和步骤数

### Task 3.10: 主布局 — layout.tsx + page.tsx

```
┌──────────────────────────────────────┐
│  BioAgent                 [项目] [⚙] │   ← Header
├─────────┬──────────────┬─────────────┤
│ 侧边栏   │   对话区      │  右侧面板    │   ← 三栏布局 (260px / flex / 380px)
│ - 文件   │              │ - 进度       │
│ - 知识   │              │ - QC         │
│         │              │ - 可视化     │
└─────────┴──────────────┴─────────────┘
```

---

## Phase 3 验收标准

- [ ] 所有 API Routes 返回正确格式
- [ ] SSE 客户端正确连接/断开/事件路由
- [ ] ThinkingPanel 可展开/折叠 7 个思考阶段
- [ ] ProgressTracker 实时展示 DAG 节点状态变化
- [ ] QCReportCard 三态（pass/warn/fail）+ 可交互建议按钮
- [ ] VizPanel Tab 切换 + 图片加载正常
- [ ] 三栏布局响应式（大屏三栏，小屏堆叠）
- [ ] `pnpm --filter @bioagent/ui dev` 启动成功
- [ ] 组件单元测试通过
