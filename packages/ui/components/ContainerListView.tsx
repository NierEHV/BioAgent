"use client";

import { useState, useEffect } from "react";

interface ContainerListViewProps {
  cwd?: string;
}

export function ContainerListView({ cwd }: ContainerListViewProps) {
  const [containers, setContainers] = useState<any[]>([]);

  useEffect(() => {
    const poll = () => {
      fetch("/api/resources")
        .then((r) => r.json())
        .then((data) => {
          // For now show mock containers scoped to project
          const all: any[] = [];
          if (data.docker?.running) {
            // Mock containers that would be project-specific
            all.push(
              { name: "scrna-qc-001", image: "bioagent-scrna", status: "running", memory: "1.2GB", uptime: "12min" },
              { name: "fastqc-batch", image: "staphb/fastqc", status: "running", memory: "679MB", uptime: "3min" },
              { name: "bulk-rna-test", image: "bioagent-scrna", status: "exited", memory: "-", uptime: "2h ago" },
            );
          }
          setContainers(all);
        })
        .catch(() => {});
    };
    poll();
    const i = setInterval(poll, 5000);
    return () => clearInterval(i);
  }, [cwd]);

  if (containers.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: "center", color: "var(--text-dim)", fontSize: 11 }}>
        暂无运行中的容器
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {containers.map((c, i) => (
        <div
          key={i}
          style={{
            padding: "6px 8px",
            borderRadius: 6,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            fontSize: 11,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: c.status === "running" ? "var(--green)" : "var(--red)",
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 600 }}>{c.name}</span>
          </div>
          <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2, paddingLeft: 13 }}>
            {c.image} · {c.memory} · {c.uptime}
          </div>
          {c.status === "running" && (
            <div style={{ display: "flex", gap: 4, marginTop: 4, paddingLeft: 13 }}>
              <button style={{ padding: "1px 6px", border: "1px solid var(--border)", background: "none", color: "var(--muted)", borderRadius: 3, fontSize: 9, cursor: "pointer" }}>
                📋 日志
              </button>
              <button style={{ padding: "1px 6px", border: "1px solid var(--border)", background: "none", color: "var(--red)", borderRadius: 3, fontSize: 9, cursor: "pointer" }}>
                ⏹ 停止
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
