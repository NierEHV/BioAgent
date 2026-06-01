"use client";

import { useState } from "react";

type PanelTab = "terminal" | "docker" | "output";

export function BottomPanel() {
  const [activeTab, setActiveTab] = useState<PanelTab>("output");
  const [collapsed, setCollapsed] = useState(false);

  const tabs: { id: PanelTab; label: string; icon: string }[] = [
    { id: "output", label: "输出", icon: "📤" },
    { id: "docker", label: "docker logs", icon: "🐳" },
    { id: "terminal", label: "终端", icon: ">" },
  ];

  if (collapsed) {
    return (
      <div
        style={{
          height: 24,
          background: "var(--bg-panel)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setCollapsed(false)}
          style={{
            border: "none",
            background: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 10,
          }}
        >
          ▲ 面板
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        height: 160,
        flexShrink: 0,
        background: "var(--bg-panel)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 24,
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "0 12px",
              height: "100%",
              fontSize: 10,
              color: activeTab === tab.id ? "var(--text)" : "var(--text-muted)",
              border: "none",
              background: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer",
              transition: "color 0.12s",
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
        <button
          onClick={() => setCollapsed(true)}
          style={{
            marginLeft: "auto",
            marginRight: 6,
            border: "none",
            background: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 10,
          }}
        >
          ▼
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "4px 10px",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          lineHeight: 1.7,
          color: "var(--text-muted)",
        }}
      >
        {activeTab === "output" && (
          <div>
            <div>$ bioagent init</div>
            <div style={{ color: "var(--green)" }}>✓ Project initialized</div>
            <div style={{ color: "var(--muted)" }}>BioAgent 分析就绪 — 在对话面板中开始分析</div>
          </div>
        )}
        {activeTab === "docker" && (
          <div style={{ color: "var(--muted)" }}>
            暂无容器日志 — 执行 docker_exec 后将在此显示
          </div>
        )}
        {activeTab === "terminal" && (
          <div style={{ color: "var(--muted)" }}>
            $ _<span style={{ animation: "blink 1s step-end infinite" }}>|</span>
          </div>
        )}
      </div>
    </div>
  );
}
