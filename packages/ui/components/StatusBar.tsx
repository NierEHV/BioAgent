"use client";

interface StatusBarProps {
  containerCount?: number;
  contextUsage?: { percent: number | null; contextWindow: number; tokens: number | null } | null;
  modelName?: string;
  cost?: number;
  proxyUrl?: string;
}

export function StatusBar({
  containerCount = 0,
  contextUsage,
  modelName,
  cost,
  proxyUrl,
}: StatusBarProps) {
  const fmt = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1000
        ? `${(n / 1000).toFixed(0)}k`
        : String(n);

  const ctxStr = contextUsage?.contextWindow
    ? `${contextUsage.percent?.toFixed(0) ?? "?"}% / ${fmt(contextUsage.contextWindow)}`
    : null;

  const costStr = cost !== undefined && cost > 0
    ? cost >= 0.01
      ? `$${cost.toFixed(2)}`
      : "<$0.01"
    : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 22,
        padding: "0 8px",
        background: "var(--accent)",
        fontSize: 10,
        flexShrink: 0,
        gap: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {containerCount > 0 && (
          <span style={{ color: "rgba(0,0,0,.75)", cursor: "pointer" }}>
            🐳 {containerCount} containers
          </span>
        )}
        {ctxStr && (
          <span style={{ color: "rgba(0,0,0,.75)", cursor: "pointer" }}>
            📊 {ctxStr}
          </span>
        )}
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        {proxyUrl && (
          <span style={{ color: "rgba(0,0,0,.5)", cursor: "pointer" }} title={proxyUrl}>
            🔗 代理
          </span>
        )}
        {modelName && (
          <span style={{ color: "rgba(0,0,0,.75)", cursor: "pointer" }}>
            {modelName}
          </span>
        )}
        {costStr && (
          <span style={{ color: "rgba(0,0,0,.75)", cursor: "pointer" }}>
            {costStr}
          </span>
        )}
      </div>
    </div>
  );
}
