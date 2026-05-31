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

  // SessionSidebar
  collapseSidebar: { zh: "收起侧栏", en: "Collapse sidebar" },
  expandSidebar: { zh: "展开侧栏", en: "Expand sidebar" },
  loadingSessions: { zh: "加载中...", en: "Loading..." },
  confirmDelete: { zh: "确认删除", en: "Confirm Delete" },
  deleteSessionConfirm: { zh: "确定要删除此会话吗？此操作不可撤销。", en: "Are you sure you want to delete this session? This cannot be undone." },
  selectProject: { zh: "选择项目…", en: "Select project…" },
  selectProjectFirst: { zh: "请先选择项目", en: "Select a project first" },
  refreshSessions: { zh: "刷新", en: "Refresh" },
  rename: { zh: "重命名", en: "Rename" },
  explorer: { zh: "文件浏览器", en: "Explorer" },
  refreshExplorer: { zh: "刷新文件浏览器", en: "Refresh explorer" },
  useDefaultDir: { zh: "使用默认目录", en: "Use default directory" },
  customPath: { zh: "自定义路径…", en: "Custom path…" },
  open: { zh: "打开", en: "Open" },
  newSessionIn: { zh: "新建会话于", en: "New session in" },

  // ChatInput
  typeMessage: { zh: "输入消息...", en: "Type a message..." },
  stopGenerating: { zh: "停止生成", en: "Stop generating" },
  attachFile: { zh: "附加文件", en: "Attach file" },
  compressSession: { zh: "压缩会话", en: "Compress session" },
  forkSession: { zh: "分支会话", en: "Fork session" },
  steerInject: { zh: "打断 Agent 当前运行，立即注入消息", en: "Interrupt agent and inject message immediately" },
  followUpQueue: { zh: "在 Agent 完成后排队发送", en: "Queue message after agent completes" },
  steerPlaceholder: { zh: "Steer 立即注入 / Follow-up 排队…", en: "Steer inject / Follow-up queue…" },
  agentRunning: { zh: "Agent 运行中…", en: "Agent is running…" },
  message: { zh: "消息…", en: "Message…" },
  compactContext: { zh: "压缩上下文", en: "Compact context" },
  stopCompact: { zh: "停止压缩", en: "Stop compact" },
  switchModel: { zh: "切换模型", en: "Switch model" },
  switchThinking: { zh: "切换推理强度", en: "Switch thinking level" },
  switchTools: { zh: "切换工具预设", en: "Switch tools preset" },
  soundOff: { zh: "关闭完成提示音", en: "Disable completion sound" },
  soundOn: { zh: "开启完成提示音", en: "Enable completion sound" },
  stopAgent: { zh: "停止 Agent", en: "Stop agent" },
  steer: { zh: "引导", en: "Steer" },
  followUp: { zh: "排队", en: "Follow-up" },
  compacting: { zh: "压缩中…", en: "Compacting…" },
  compact: { zh: "压缩", en: "Compact" },
  stop: { zh: "停止", en: "Stop" },
  retrying: { zh: "重试中", en: "Retrying" },

  // ChatWindow
  newChat: { zh: "新对话", en: "New Chat" },
  selectSession: { zh: "选择一个会话开始对话", en: "Select a session to start chatting" },
  emptyChat: { zh: "在左侧选择或创建一个会话。", en: "Select or create a session from the sidebar." },
  loadingSession: { zh: "正在加载会话...", en: "Loading session..." },
  runningTool: { zh: "运行工具", en: "Running tool" },
  waitingModel: { zh: "等待模型响应...", en: "Waiting for model..." },
  thinkingDot: { zh: "思考中...", en: "Thinking..." },
  gettingStarted: { zh: "快速上手", en: "Get Started" },
  gettingStartedStep1: { zh: "从侧栏选择一个项目目录", en: "Select a project directory from the sidebar" },
  gettingStartedStep2: { zh: "通过底部的 Models 按钮添加模型", en: "Add models via the Models button at the bottom" },

  // ModelsConfig
  modelsConfigTitle: { zh: "模型配置", en: "Model Configuration" },
  selectProviderOrModel: { zh: "选择一个服务商或模型", en: "Select a provider or model" },
  saveConfig: { zh: "保存配置", en: "Save Config" },
  testConnection: { zh: "测试连接", en: "Test Connection" },
  apiKey: { zh: "API 密钥", en: "API Key" },
  provider: { zh: "服务商", en: "Provider" },
  model: { zh: "模型", en: "Model" },
  modelsTab: { zh: "模型", en: "Models" },
  newModel: { zh: "新模型", en: "new model" },
  addModel: { zh: "+ 模型", en: "+ model" },
  addProvider: { zh: "+ 添加服务商", en: "+ Add provider" },
  customProvider: { zh: "OpenAI / Anthropic 兼容", en: "OpenAI / Anthropic compatible" },
  customEndpoint: { zh: "自定义端点格式", en: "Custom endpoint format" },
  subscriptions: { zh: "订阅", en: "Subscriptions" },
  searchProviders: { zh: "搜索服务商…", en: "Search providers…" },
  noProvidersMatch: { zh: "未找到匹配的服务商", en: "No providers match" },
  providerName: { zh: "服务商名称", en: "Provider name" },
  baseUrl: { zh: "Base URL", en: "Base URL" },
  testing: { zh: "测试中…", en: "Testing…" },
  testingConnection: { zh: "正在测试连接...", en: "Testing model connection..." },
  testFailed: { zh: "连接失败", en: "Failed" },
  testOk: { zh: "成功", en: "OK" },
  remove: { zh: "移除", en: "Remove" },
  login: { zh: "登录", en: "Login" },
  reLogin: { zh: "重新登录", en: "Re-login" },
  disconnect: { zh: "断开", en: "Disconnect" },
  submit: { zh: "提交", en: "Submit" },
  saving: { zh: "保存中…", en: "Saving…" },
  saved: { zh: "已保存", en: "Saved" },
  saveBtn: { zh: "保存", en: "Save" },
  removeModel: { zh: "移除模型", en: "Remove" },
  removing: { zh: "移除中…", en: "Removing…" },
  notConfigured: { zh: "未配置", en: "not configured" },
  configured: { zh: "已配置", en: "configured" },
  clearAll: { zh: "清除全部", en: "clear all" },
  default_: { zh: "默认", en: "Default" },
  disabled: { zh: "禁用", en: "Disabled" },
  custom: { zh: "自定义", en: "Custom" },

  // SkillsConfig
  skillsConfigTitle: { zh: "技能管理", en: "Skills Management" },
  installSkill: { zh: "安装技能", en: "Install Skill" },
  searchSkills: { zh: "搜索技能...", en: "Search skills..." },
  installedSkills: { zh: "已安装", en: "Installed" },
  availableSkills: { zh: "可用技能", en: "Available" },
  noSkillsFound: { zh: "未找到技能", en: "No skills found" },
  addSkill: { zh: "添加技能", en: "Add skill" },
  selectSkill: { zh: "选择一个技能", en: "Select a skill" },

  // FileExplorer
  noFilesFound: { zh: "未找到文件", en: "No files found" },
  loadingFiles: { zh: "加载文件中...", en: "Loading files..." },
  emptyDir: { zh: "空目录", en: "empty" },
  mention: { zh: "提及", en: "mention" },

  // BranchNavigator
  noBranches: { zh: "无分支", en: "No branches" },
  mainBranch: { zh: "主分支", en: "Main" },
  noActiveSession: { zh: "无活跃会话", en: "No active session" },
  sessionNoBranches: { zh: "当前会话没有分支", en: "This session has no branches" },

  // MessageView
  userRole: { zh: "用户", en: "User" },
  agentRole: { zh: "助手", en: "Agent" },
  copyBtn: { zh: "复制", en: "Copy" },
  copied: { zh: "已复制", en: "Copied" },
  retry: { zh: "重试", en: "Retry" },
  editMsg: { zh: "编辑", en: "Edit" },
  copyMessage: { zh: "复制消息", en: "Copy message" },
  editFromHere: { zh: "从此处编辑", en: "Edit from here" },
  editFromHereTitle: { zh: "从该消息处编辑 — 在当前会话内创建分支", en: "Edit from here — branches within this session" },
  newSessionTitle: { zh: "新建会话 — 从该处创建独立副本", en: "New session — creates an independent copy from here" },
  creating: { zh: "创建中…", en: "Creating…" },
  newSessionBtn: { zh: "新建会话", en: "New session" },
  noOutput: { zh: "（无输出）", en: "(no output)" },

  // ChatMinimap
  jumpToBottom: { zh: "跳到底部", en: "Jump to bottom" },

  // System prompt
  systemPrompt: { zh: "系统提示", en: "System Prompt" },
  systemPromptEmpty: { zh: "系统提示为空（工具已禁用）", en: "System prompt is empty (tools are disabled)" },
  loadSystemPrompt: { zh: "发送消息以加载系统提示", en: "Send a message to load the system prompt" },

  // General UI
  confirm: { zh: "确认", en: "Confirm" },
  cancel: { zh: "取消", en: "Cancel" },
  close: { zh: "关闭", en: "Close" },
  loading: { zh: "加载中...", en: "Loading..." },
  error: { zh: "错误", en: "Error" },
  success: { zh: "成功", en: "Success" },
  back: { zh: "返回", en: "Back" },
  refresh: { zh: "刷新", en: "Refresh" },
  editConfig: { zh: "编辑配置", en: "Edit Config" },
  search: { zh: "搜索", en: "Search" },
  delete: { zh: "删除", en: "Delete" },
  install: { zh: "安装", en: "Install" },
  installed: { zh: "已安装", en: "Installed" },
  installing: { zh: "安装中…", en: "Installing…" },
  searching: { zh: "搜索中…", en: "Searching…" },

  // Bio panel header
  bioPanelTitle: { zh: "生信面板", en: "Bio Panel" },
  showBioPanel: { zh: "显示生信面板", en: "Show bioinformatics panel" },
  hideBioPanel: { zh: "隐藏生信面板", en: "Hide bioinformatics panel" },
  showFilePanel: { zh: "显示文件面板", en: "Show file panel" },
  hideFilePanel: { zh: "隐藏文件面板", en: "Hide file panel" },
  closeBioPanel: { zh: "关闭生信面板", en: "Close bio panel" },
  closeRightPanel: { zh: "关闭文件面板", en: "Close file panel" },

  // Start workflow
  startSessionWorkflow: { zh: "启动会话以跟踪工作流进度", en: "Start a session to track workflow progress" },
  sendMsgWorkflow: { zh: "发送消息以启动工作流", en: "Send a message to start a workflow" },
  qcReportsAppear: { zh: "工作流执行后 QC 报告将在这里展示", en: "QC reports will appear here after workflow execution" },

  // File viewer
  noFileOpen: { zh: "未打开文件", en: "No file open" },
  liveSync: { zh: "实时同步", en: "live" },
  staticFile: { zh: "静态", en: "static" },
  notWatching: { zh: "未监听", en: "Not watching" },
  liveSyncActive: { zh: "实时监听中", en: "Live sync active" },
  liveSyncTitle: { zh: "实时监听中", en: "Live sync active" },
  source: { zh: "源码", en: "Source" },
  diff: { zh: "差异", en: "Diff" },
  preview: { zh: "预览", en: "Preview" },
  raw: { zh: "原始", en: "Raw" },
  code: { zh: "代码", en: "Code" },
  wrap: { zh: "换行", en: "wrap" },
  noChanges: { zh: "无更改", en: "No changes" },
  unchangedLines: { zh: "未更改行", en: "unchanged lines" },
  lines: { zh: "行", en: "lines" },
  name: { zh: "名称", en: "Name" },
  description: { zh: "描述", en: "Description" },

  // ToolPanel
  toolPresetOff: { zh: "关闭", en: "Off" },
  toolPresetLow: { zh: "低", en: "Low" },
  toolPresetHigh: { zh: "高", en: "High" },
  noToolsEnabled: { zh: "不使用工具", en: "No tools" },
  defaultTools: { zh: "read · bash · edit · write", en: "read · bash · edit · write" },
  fullTools: { zh: "read · bash · edit · write · grep · find · ls", en: "read · bash · edit · write · grep · find · ls" },
  toolsNextTurn: { zh: "下次对话生效", en: "takes effect on next turn" },
  toolsOffDesc: { zh: "Agent 不使用任何工具", en: "agent will not use any tools" },

  // Thinking level descriptions
  thinkingAutoDesc: { zh: "沿用 pi 默认设置", en: "Follow pi default" },
  thinkingOffDesc: { zh: "关闭推理", en: "Disable reasoning" },
  thinkingMinimalDesc: { zh: "最少推理", en: "Minimal reasoning" },
  thinkingLowDesc: { zh: "低强度推理", en: "Low reasoning" },
  thinkingMediumDesc: { zh: "中等推理", en: "Medium reasoning" },
  thinkingHighDesc: { zh: "高强度推理", en: "High reasoning" },
  thinkingXhighDesc: { zh: "最高强度推理", en: "Maximum reasoning" },

  // Image / attachment
  attachImage: { zh: "附加图片", en: "Attach image" },

  // OAuth
  subscriptionTab: { zh: "订阅", en: "Subscription" },

  // Payment
  cost: { zh: "费用", en: "Cost" },

  // Forks
  expandForks: { zh: "展开分支", en: "Expand forks" },
  collapseForks: { zh: "收起分支", en: "Collapse forks" },

  // Notifications
  justNow: { zh: "刚刚", en: "just now" },
  minutesAgo: { zh: "分钟前", en: "m ago" },
  hoursAgo: { zh: "小时前", en: "h ago" },
  daysAgo: { zh: "天前", en: "d ago" },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Lang): string {
  return translations[key]?.[lang] ?? key;
}
