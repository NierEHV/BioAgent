"use client";

export function KnowledgeView({ cwd: _cwd }: { cwd?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, padding: "0 4px" }}>
        📚 知识库
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", padding: "0 4px", lineHeight: 1.8 }}>
        <div>📄 scRNA-seq QC 最佳实践</div>
        <div>📄 归一化方法对比</div>
        <div>📄 聚类参数选择指南</div>
        <div>📄 细胞注释最佳实践</div>
        <div>📄 批次效应校正指南</div>
        <div>📄 拟时间轨迹分析</div>
        <div>📄 细胞间通讯分析</div>
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-dim)" }}>
          共 19 篇 Wiki 文档
        </div>
      </div>
    </div>
  );
}
