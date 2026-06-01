"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export type ActivityId = "files" | "containers" | "knowledge";

interface ActivityBarProps {
  active: ActivityId;
  onChange: (id: ActivityId) => void;
}

const activities: { id: ActivityId; icon: string; label: string }[] = [
  { id: "files", icon: "📁", label: "文件浏览器" },
  { id: "containers", icon: "🐳", label: "容器管理" },
  { id: "knowledge", icon: "📚", label: "知识库" },
];

export function ActivityBar({ active, onChange }: ActivityBarProps) {
  const barRef = React.useRef<HTMLDivElement>(null);

  return (
    <div
      ref={barRef}
      style={{
        width: 44,
        flexShrink: 0,
        background: "var(--bg-panel)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 4,
      }}
    >
      {activities.map((a) => (
        <button
          key={a.id}
          onClick={() => onChange(a.id)}
          title={a.label}
          style={{
            width: 36,
            height: 36,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            color: active === a.id ? "var(--accent)" : "var(--text-muted)",
            cursor: "pointer",
            border: "none",
            background: "none",
            marginBottom: 2,
            position: "relative",
            transition: "color 0.12s",
            opacity: active === a.id ? 1 : 0.5,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            if (active !== a.id) e.currentTarget.style.opacity = "0.5";
          }}
        >
          {active === a.id && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 8,
                bottom: 8,
                width: 2,
                background: "var(--accent)",
                borderRadius: "0 2px 2px 0",
              }}
            />
          )}
          <span>{a.icon}</span>
        </button>
      ))}

      <div style={{ flex: 1 }} />

      {/* Settings at bottom */}
      <button
        onClick={() => {/* settings modal — TODO */}}
        title="设置"
        style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          color: "var(--text-muted)",
          cursor: "pointer",
          border: "none",
          background: "none",
          marginBottom: 4,
          opacity: 0.5,
          transition: "opacity 0.12s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; }}
      >
        ⚙️
      </button>
    </div>
  );
}

import React from "react";
