"use client";

import { useRef, useState, useCallback } from "react";
import { ChatWindow } from "./ChatWindow";
import type { SessionInfo, SessionTreeNode } from "@/lib/types";
import type { ChatInputHandle } from "./ChatInput";

interface ChatPanelProps {
  session: SessionInfo | null;
  newSessionCwd: string | null;
  sessionKey: number;
  sessions?: SessionInfo[];
  projectCwd?: string | null;
  onSelectSession?: (session: SessionInfo) => void;
  onNewSession?: () => void;
  modelsRefreshKey?: number;
  chatInputRef?: React.RefObject<ChatInputHandle | null>;
  onAgentEnd?: () => void;
  onSessionCreated?: (session: SessionInfo) => void;
  onSessionForked?: (newSessionId: string) => void;
  onBranchDataChange?: (tree: SessionTreeNode[], activeLeafId: string | null, onLeafChange: (leafId: string | null) => void) => void;
  onSystemPromptChange?: (prompt: string | null) => void;
  onSessionStatsChange?: (stats: { tokens: { input: number; output: number; cacheRead: number; cacheWrite: number }; cost?: number } | null) => void;
  onContextUsageChange?: (usage: { percent: number | null; contextWindow: number; tokens: number | null } | null) => void;
}

export function ChatPanel({
  session,
  newSessionCwd,
  sessionKey,
  sessions = [],
  projectCwd,
  onSelectSession,
  onNewSession,
  modelsRefreshKey,
  chatInputRef,
  onAgentEnd,
  onSessionCreated,
  onSessionForked,
  onBranchDataChange,
  onSystemPromptChange,
  onSessionStatsChange,
  onContextUsageChange,
}: ChatPanelProps) {
  const showChat = session !== null || newSessionCwd !== null;
  const selectRef = useRef<HTMLSelectElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const handleRename = useCallback(async () => {
    const name = renameValue.trim();
    if (!name || !session) return;
    try {
      await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    } catch {}
    setRenaming(false);
    setRenameValue("");
  }, [renameValue, session]);

  const handleSelectChange = () => {
    const id = selectRef.current?.value;
    if (id && onSelectSession) {
      const s = sessions.find((s) => s.id === id);
      if (s) onSelectSession(s);
    }
  };

  const filteredSessions = projectCwd
    ? sessions.filter((s) => s.cwd === projectCwd)
    : [];

  return (
    <div
      style={{
        width: 400,
        flexShrink: 0,
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
      }}
    >
      {/* Header with session selector */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 30,
          padding: "0 8px",
          background: "var(--bg-panel)",
          borderBottom: "1px solid var(--border)",
          fontSize: 11,
          flexShrink: 0,
          gap: 6,
        }}
      >
        <span>💬</span>
        {renaming ? (
          <>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false); }}
              placeholder="会话名称..."
              autoFocus
              style={{
                flex: 1,
                padding: "2px 4px",
                background: "var(--bg)",
                border: "1px solid var(--accent)",
                color: "var(--text)",
                fontSize: 10,
                borderRadius: 4,
                maxWidth: 160,
              }}
            />
            <button
              onClick={handleRename}
              style={{ border: "none", background: "none", color: "var(--green)", cursor: "pointer", fontSize: 12 }}
            >✓</button>
            <button
              onClick={() => setRenaming(false)}
              style={{ border: "none", background: "none", color: "var(--muted)", cursor: "pointer", fontSize: 12 }}
            >✕</button>
          </>
        ) : (
          <>
            {filteredSessions.length > 0 ? (
              <select
                ref={selectRef}
                value={session?.id ?? ""}
                onChange={handleSelectChange}
                style={{
                  flex: 1,
                  padding: "2px 4px",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontSize: 10,
                  borderRadius: 4,
                  maxWidth: 180,
                  cursor: "pointer",
                }}
              >
                <option value="" disabled>选择会话...</option>
                {filteredSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstMessage?.slice(0, 50) || s.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ flex: 1, fontSize: 10, color: "var(--muted)" }}>对话</span>
            )}
            {session && (
              <button
                onClick={() => { setRenameValue(session.firstMessage?.slice(0, 50) || ""); setRenaming(true); }}
                title="重命名会话"
                style={{
                  width: 20, height: 20,
                  border: "none", background: "none",
                  color: "var(--muted)", cursor: "pointer",
                  fontSize: 12, borderRadius: 3,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✏️</button>
            )}
            {onNewSession && (
          <button
            onClick={onNewSession}
            title="新建会话"
            style={{
              width: 22,
              height: 22,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--muted)",
              borderRadius: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            +
          </button>
        )}
          </>
        )}
      </div>

      {/* Chat content */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {showChat ? (
          <ChatWindow
            key={sessionKey}
            session={session}
            newSessionCwd={newSessionCwd}
            onAgentEnd={onAgentEnd}
            onSessionCreated={onSessionCreated}
            onSessionForked={onSessionForked}
            modelsRefreshKey={modelsRefreshKey}
            chatInputRef={chatInputRef}
            onBranchDataChange={onBranchDataChange}
            onSystemPromptChange={onSystemPromptChange}
            onSessionStatsChange={onSessionStatsChange}
            onContextUsageChange={onContextUsageChange}
          />
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 13,
              flexDirection: "column",
              gap: 8,
              padding: 20,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 36, opacity: 0.3 }}>💬</div>
            <div>选择会话开始分析</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
              在左侧选择项目，新建会话开始生信分析
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
