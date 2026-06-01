"use client";

import { useRef } from "react";
import { ChatWindow } from "./ChatWindow";
import type { SessionInfo, SessionTreeNode } from "@/lib/types";
import type { ChatInputHandle } from "./ChatInput";

interface ChatPanelProps {
  session: SessionInfo | null;
  newSessionCwd: string | null;
  sessionKey: number;
  sessions?: SessionInfo[];
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

  const handleSelectChange = () => {
    const id = selectRef.current?.value;
    if (id && onSelectSession) {
      const s = sessions.find((s) => s.id === id);
      if (s) onSelectSession(s);
    }
  };

  const filteredSessions = sessions.filter(
    (s) => !session || s.cwd === session.cwd,
  );

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
              maxWidth: 200,
              cursor: "pointer",
            }}
          >
            <option value="" disabled>
              选择会话...
            </option>
            {filteredSessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstMessage?.slice(0, 60) || s.id.slice(0, 8)}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ flex: 1, fontSize: 10, color: "var(--muted)" }}>
            对话
          </span>
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
