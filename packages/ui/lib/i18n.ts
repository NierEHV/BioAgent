// ============================================================
// @bioagent/ui — i18n 中文/English translations
// ============================================================

export type Lang = "zh" | "en";

export const translations = {
  // App shell
  appTitle: { zh: "BioAgent", en: "BioAgent" },
  appDescription: {
    zh: "AI驱动的生物信息学Agent — 自然语言驱动自动化生信分析",
    en: "AI-Powered Bioinformatics Agent — Automate omics analysis with natural language",
  },

  // Header
  project: { zh: "项目", en: "Project" },
  settings: { zh: "设置", en: "Settings" },
  language: { zh: "语言", en: "Language" },

  // Session sidebar
  sessions: { zh: "会话", en: "Sessions" },
  newSession: { zh: "新建会话", en: "New Session" },
  noSessions: { zh: "暂无会话", en: "No sessions" },
  searchSessions: { zh: "搜索会话...", en: "Search sessions..." },

  // Chat
  welcomeTitle: { zh: "欢迎使用 BioAgent", en: "Welcome to BioAgent" },
  welcomeDesc: {
    zh: "上传您的单细胞数据，用自然语言描述分析需求。AI Agent 将规划、执行并监控整个分析流程。",
    en: "Upload your single-cell data and describe your analysis in natural language. The AI agent will plan, execute, and monitor the workflow.",
  },
  inputPlaceholder: {
    zh: "用自然语言描述您的分析需求...",
    en: "Describe your analysis in natural language...",
  },
  send: { zh: "发送", en: "Send" },
  uploadFile: { zh: "上传文件", en: "Upload File" },
  runWorkflow: { zh: "▶ 运行工作流", en: "▶ Run Workflow" },
  streaming: { zh: "正在生成回复...", en: "Generating response..." },

  // Quick actions
  quickActions: { zh: "快速操作", en: "Quick Actions" },
  actionScrnaQc: { zh: "scRNA-seq 质控", en: "scRNA-seq QC" },
  actionScrnaQcDesc: { zh: "对原始计数矩阵进行质量控制", en: "Run quality control on raw count matrix" },
  actionDiffExpr: { zh: "差异表达分析", en: "Differential Expression" },
  actionDiffExprDesc: { zh: "发现差异表达基因", en: "Find differentially expressed genes" },
  actionClustering: { zh: "细胞聚类", en: "Cell Clustering" },
  actionClusteringDesc: { zh: "聚类并注释细胞群体", en: "Cluster and annotate cell populations" },
  actionEnrichment: { zh: "功能富集分析", en: "Functional Enrichment" },
  actionEnrichmentDesc: { zh: "GO/KEGG 通路富集分析", en: "GO/KEGG pathway enrichment analysis" },

  // File browser
  projectFiles: { zh: "项目文件", en: "Project Files" },
  noFiles: { zh: "暂无文件", en: "No files" },
  deleteFile: { zh: "删除", en: "Delete" },
  fileInspecting: { zh: "探测中...", en: "Inspecting..." },
  fileShape: { zh: "维度", en: "Shape" },
  fileFormat: { zh: "格式", en: "Format" },
  fileColumns: { zh: "列名", en: "Columns" },
  filePreview: { zh: "预览", en: "Preview" },

  // Right panel tabs
  tabThinking: { zh: "思考", en: "Thinking" },
  tabProgress: { zh: "进度", en: "Progress" },
  tabQC: { zh: "质控", en: "QC" },
  tabViz: { zh: "可视化", en: "Viz" },
  tabKnowledge: { zh: "知识", en: "Knowledge" },
  tabResources: { zh: "资源", en: "Resources" },

  // Tab tooltips
  thinkingTabTip: { zh: "Agent 思考过程", en: "Agent Thinking Process" },
  progressTabTip: { zh: "工作流执行进度", en: "Workflow Progress" },
  qcTabTip: { zh: "质量控制报告", en: "Quality Control Reports" },
  vizTabTip: { zh: "分析可视化", en: "Analysis Visualizations" },
  knowledgeTabTip: { zh: "知识库引用", en: "Knowledge References" },
  resourcesTabTip: { zh: "系统资源监控", en: "System Resources" },

  // Thinking panel
  thinkingTitle: { zh: "思考过程", en: "Thinking Process" },
  noThinking: { zh: "暂无思考数据。发送分析请求后，Agent 的思考过程将在这里展示。", en: "No thinking data yet. Send an analysis request and the agent's reasoning will appear here." },
  thinkingStep: { zh: "步骤", en: "Step" },

  // Progress tracker
  progressTitle: { zh: "工作流进度", en: "Workflow Progress" },
  runId: { zh: "运行ID", en: "Run ID" },
  noProgress: { zh: "等待工作流启动...", en: "Waiting for workflow to start..." },
  estimatedRemaining: { zh: "预计剩余", en: "Est. remaining" },
  nodesCompleted: { zh: "节点完成", en: "nodes done" },
  pause: { zh: "暂停", en: "Pause" },
  resume: { zh: "恢复", en: "Resume" },
  abort: { zh: "中止", en: "Abort" },
  done: { zh: "已完成", en: "Done" },

  // QC report
  qcTitle: { zh: "质量控制", en: "Quality Control" },
  noQc: { zh: "暂无QC报告。运行工作流后，每个步骤的质控结果将在这里展示。", en: "No QC reports yet. Run a workflow to see quality control results." },
  passed: { zh: "通过", en: "Passed" },
  warning: { zh: "警告", en: "Warning" },
  failed: { zh: "失败", en: "Failed" },
  autoFix: { zh: "自动修复", en: "Auto-fix" },
  ignore: { zh: "忽略", en: "Ignore" },
  customThreshold: { zh: "自定义阈值", en: "Custom threshold" },
  apply: { zh: "应用", en: "Apply" },

  // Viz panel
  vizTitle: { zh: "可视化", en: "Visualizations" },
  noViz: { zh: "暂无可视化。分析完成后图表将在这里展示。", en: "No visualizations yet. Charts will appear after analysis completes." },
  downloadSvg: { zh: "下载 SVG", en: "Download SVG" },
  downloadPng: { zh: "下载 PNG", en: "Download PNG" },

  // Knowledge panel
  knowledgeTitle: { zh: "知识引用", en: "Knowledge References" },
  noKnowledge: { zh: "暂无知识引用。Agent 在分析时会自动查询知识库并展示引用来源。", en: "No references yet. Agent queries the knowledge base during analysis." },
  aiAnswer: { zh: "AI 综合回答", en: "AI Synthesis" },
  relevance: { zh: "相关度", en: "Relevance" },
  sourcePaper: { zh: "论文", en: "Paper" },
  sourceDocs: { zh: "文档", en: "Docs" },
  sourceDatabase: { zh: "数据库", en: "Database" },

  // Resource monitor
  resourceTitle: { zh: "系统资源", en: "System Resources" },
  cpu: { zh: "CPU", en: "CPU" },
  memory: { zh: "内存", en: "Memory" },
  disk: { zh: "磁盘", en: "Disk" },
  containers: { zh: "容器", en: "Containers" },
  hostname: { zh: "主机", en: "Host" },
  uptime: { zh: "运行时间", en: "Uptime" },

  // Model config
  modelConfig: { zh: "模型配置", en: "Model Config" },
  skillsConfig: { zh: "技能配置", en: "Skills Config" },

  // Theme
  theme: { zh: "主题", en: "Theme" },
  lightTheme: { zh: "浅色", en: "Light" },
  darkTheme: { zh: "深色", en: "Dark" },
  systemTheme: { zh: "跟随系统", en: "System" },

  // Branch navigator
  branches: { zh: "分支", en: "Branches" },

  // Status
  online: { zh: "在线", en: "Online" },
  offline: { zh: "离线", en: "Offline" },
  connected: { zh: "已连接", en: "Connected" },
  reconnecting: { zh: "重连中...", en: "Reconnecting..." },
  session: { zh: "会话", en: "Session" },

  // Notifications
  sessionCreated: { zh: "会话已创建", en: "Session created" },
  sessionDeleted: { zh: "会话已删除", en: "Session deleted" },
  fileUploaded: { zh: "文件已上传", en: "File uploaded" },
  fileDeleted: { zh: "文件已删除", en: "File deleted" },
  workflowStarted: { zh: "工作流已启动", en: "Workflow started" },
  workflowPaused: { zh: "工作流已暂停", en: "Workflow paused" },
  workflowResumed: { zh: "工作流已恢复", en: "Workflow resumed" },
  workflowAborted: { zh: "工作流已中止", en: "Workflow aborted" },
  workflowCompleted: { zh: "工作流已完成", en: "Workflow completed" },
  errorOccurred: { zh: "发生错误", en: "An error occurred" },

  // File viewer
  fileViewer: { zh: "文件查看器", en: "File Viewer" },
  closeFile: { zh: "关闭", en: "Close" },
  fileSaved: { zh: "文件已保存", en: "File saved" },
  fileNotSaved: { zh: "文件未保存", en: "File not saved" },

  // Tab bar
  tabChat: { zh: "对话", en: "Chat" },
  tabFiles: { zh: "文件", en: "Files" },
  tabModels: { zh: "模型", en: "Models" },
  tabSkills: { zh: "技能", en: "Skills" },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Lang): string {
  return translations[key]?.[lang] ?? key;
}
