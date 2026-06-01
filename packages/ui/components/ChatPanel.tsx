"use client";

import { ChatWindow } from "./ChatWindow";
import type { SessionInfo, SessionTreeNode } from "@/lib/types";
import type { ChatInputHandle } from "./ChatInput";

interface ChatPanelProps {
  session: SessionInfo | null;
  newSessionCwd: string | null;
  sessionKey: number;
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
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 30,
          padding: "0 12px",
          background: "var(--bg-panel)",
          borderBottom: "1px solid var(--border)",
          fontSize: 11,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        💬 对话
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
