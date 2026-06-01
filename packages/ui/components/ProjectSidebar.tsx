"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FileExplorer } from "./FileExplorer";
import type { SessionInfo } from "@/lib/types";
import { useLanguage } from "@/hooks/useLanguage";

interface ProjectSidebarProps {
  selectedCwd: string | null;
  onCwdChange: (cwd: string | null) => void;
  onOpenFile?: (filePath: string, fileName: string) => void;
  onAtMention?: (relativePath: string) => void;
  explorerRefreshKey?: number;
}

function shortenCwd(cwd: string): string {
  const sep = cwd.includes("/") ? "/" : "\\";
  const parts = cwd.split(sep).filter(Boolean);
  if (parts.length <= 2) return cwd;
  return "…/" + parts.slice(-2).join(sep);
}

export function ProjectSidebar({
  selectedCwd,
  onCwdChange,
  onOpenFile,
  onAtMention,
  explorerRefreshKey,
}: ProjectSidebarProps) {
  const { t } = useLanguage();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [customPath, setCustomPath] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [recentCwds, setRecentCwds] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load recent CWDs
  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((d) => {
        const sessions: SessionInfo[] = d.sessions || (Array.isArray(d) ? d : []);
        const cwds = [...new Set(sessions.map((s) => s.cwd).filter(Boolean))] as string[];
        setRecentCwds(cwds.slice(0, 8));
      })
      .catch(() => {});
  }, [selectedCwd]);

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleCreateProject = useCallback(async () => {
    const name = newProjectName.trim();
    if (!name) return;
    const parent = selectedCwd || "d:/AIAgent/BioAgent/data/projects";
    const projectPath = parent.replace(/[/\\]$/, "") + "/" + name;
    try {
      const res = await fetch("/api/projects/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: projectPath }),
      });
      if (res.ok) {
        onCwdChange(projectPath);
        setNewProjectOpen(false);
        setNewProjectName("");
      }
    } catch {}
  }, [newProjectName, selectedCwd, onCwdChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Title */}
      <div style={{ padding: "12px 10px 8px", flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 15, fontFamily: "var(--font-mono)", color: "var(--text)" }}>BioAgent</span>
      </div>

      {/* Project selector */}
      <div ref={dropdownRef} style={{ position: "relative", padding: "0 10px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            style={{
              flex: 1, display: "flex", alignItems: "center", gap: 6,
              padding: "5px 8px", background: "var(--bg-hover)", border: "1px solid var(--border)",
              borderRadius: 6, cursor: "pointer", fontSize: 12, color: "var(--text)", textAlign: "left" as const,
            }}
          >
            <span style={{ fontSize: 14, flexShrink: 0 }}>🧬</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              {selectedCwd ? shortenCwd(selectedCwd) : t("selectProject")}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>▾</span>
          </button>
          <button
            onClick={() => setNewProjectOpen(true)}
            title={t("newProject")}
            style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", cursor: "pointer", flexShrink: 0, fontSize: 16 }}
          >+</button>
        </div>

        {/* Dropdown */}
        {dropdownOpen && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 10, right: 10, zIndex: 100, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.3)", overflow: "hidden" }}>
            {recentCwds.map((cwd) => (
              <button
                key={cwd}
                onClick={() => { onCwdChange(cwd); setDropdownOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "8px 10px", background: cwd === selectedCwd ? "var(--bg-selected)" : "none", border: "none", borderBottom: "1px solid var(--border)", color: cwd === selectedCwd ? "var(--text)" : "var(--text-muted)", cursor: "pointer", fontSize: 11, fontFamily: "var(--font-mono)", textAlign: "left" as const }}
              >
                🧬 {shortenCwd(cwd)}
              </button>
            ))}
            {customOpen ? (
              <div style={{ display: "flex", gap: 4, padding: 6 }}>
                <input
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { onCwdChange(customPath); setDropdownOpen(false); setCustomOpen(false); } }}
                  placeholder="输入路径..."
                  autoFocus
                  style={{ flex: 1, padding: "4px 6px", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", fontSize: 11, fontFamily: "var(--font-mono)" }}
                />
              </div>
            ) : (
              <button
                onClick={() => setCustomOpen(true)}
                style={{ width: "100%", padding: "8px 10px", background: "none", border: "none", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontSize: 11, textAlign: "left" as const }}
              >
                📂 自定义路径…
              </button>
            )}
          </div>
        )}
      </div>

      {/* File tree */}
      {selectedCwd && (
        <div style={{ flex: 1, overflow: "hidden", marginTop: 8, borderTop: "1px solid var(--border)" }}>
          <FileExplorer
            cwd={selectedCwd}
            onOpenFile={onOpenFile ?? (() => {})}
            onAtMention={onAtMention}
            key={explorerRefreshKey}
          />
        </div>
      )}

      {/* New project modal */}
      {newProjectOpen && (
        <>
          <div onClick={() => { setNewProjectOpen(false); setNewProjectName(""); }} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.3)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 401, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 20, width: 360, boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>🧬 {t("newProject")}</div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>项目名称</div>
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateProject(); }}
                placeholder="例如: scrna-lung-tme"
                autoFocus
                style={{ width: "100%", padding: "8px 12px", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontSize: 13, fontFamily: "inherit" }}
              />
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>创建于: {selectedCwd || "data/projects"}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => { setNewProjectOpen(false); setNewProjectName(""); }} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}>取消</button>
              <button onClick={handleCreateProject} disabled={!newProjectName.trim()} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: newProjectName.trim() ? "var(--accent)" : "var(--bg-selected)", color: newProjectName.trim() ? "#000" : "var(--text-dim)", cursor: newProjectName.trim() ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600 }}>创建</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
