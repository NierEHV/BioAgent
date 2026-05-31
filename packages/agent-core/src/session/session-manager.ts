// ============================================================
// @bioagent/agent-core — Session Manager (JSONL-based)
// ============================================================

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, renameSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 单条会话消息 */
export interface SessionMessage {
  /** 消息类型 */
  type: "user" | "thinking" | "agent" | "tool_call" | "qc_report" | "progress" | "viz";
  /** 消息内容（任意 JSON 可序列化值） */
  content: unknown;
  /** ISO 8601 时间戳 */
  timestamp: string;
  /** 消息在会话中的序号（从 0 开始） */
  index: number;
}

// ---------------------------------------------------------------------------
// SessionManager
// ---------------------------------------------------------------------------

/**
 * 基于 JSONL 格式的会话管理器。
 *
 * 每条消息占一行 JSON，sessionId 为目录名，messages.jsonl 为实际文件。
 * Fork 时复制历史消息到新文件；Compress 时保留头部 5% 和尾部 20% 的消息。
 */
export class SessionManager {
  private sessionsDir: string;

  constructor(sessionsDir: string) {
    this.sessionsDir = sessionsDir;
    this.ensureDirectory();
  }

  // -----------------------------------------------------------------------
  // Session lifecycle
  // -----------------------------------------------------------------------

  /**
   * 创建一个新会话，返回生成的 sessionId（UUID v4）。
   *
   * @param projectId - 项目标识（用于组织目录结构）
   * @returns 新会话的唯一 ID
   */
  async create(projectId: string): Promise<string> {
    const sessionId = randomUUID();

    // Create session directory under sessionsDir/<projectId>/
    const sessionPath = this.getSessionDir(sessionId, projectId);
    mkdirSync(sessionPath, { recursive: true });

    // Create empty messages.jsonl
    const messagesFile = this.getMessagesFile(sessionId, projectId);
    writeFileSync(messagesFile, "", { encoding: "utf-8", flag: "wx" });

    // Write session metadata
    const metaFile = join(sessionPath, "meta.json");
    writeFileSync(
      metaFile,
      JSON.stringify(
        {
          sessionId,
          projectId,
          createdAt: new Date().toISOString(),
          messageCount: 0,
        },
        null,
        2,
      ),
      { encoding: "utf-8" },
    );

    return sessionId;
  }

  // -----------------------------------------------------------------------
  // Message operations
  // -----------------------------------------------------------------------

  /**
   * 向会话追加一条消息。
   *
   * @param sessionId - 会话 UUID
   * @param msg - 消息体（不含 index，由管理器自动分配）
   * @param projectId - 可选的 projectId 用于查找会话目录
   */
  async appendMessage(
    sessionId: string,
    msg: Omit<SessionMessage, "index">,
    projectId?: string,
  ): Promise<void> {
    const messagesFile = this.locateMessagesFile(sessionId, projectId);

    // Count existing messages to determine index
    const existing = await this.countLines(messagesFile);
    const fullMsg: SessionMessage = {
      ...msg,
      index: existing,
    };

    const line = JSON.stringify(fullMsg) + "\n";
    writeFileSync(messagesFile, line, { encoding: "utf-8", flag: "a" });
  }

  /**
   * 获取会话中的所有消息。
   *
   * @param sessionId - 会话 UUID
   * @param projectId - 可选的 projectId
   * @returns 消息数组（按 index 升序）
   */
  async getMessages(
    sessionId: string,
    projectId?: string,
  ): Promise<SessionMessage[]> {
    const messagesFile = this.locateMessagesFile(sessionId, projectId);
    return this.readMessages(messagesFile);
  }

  // -----------------------------------------------------------------------
  // Fork
  // -----------------------------------------------------------------------

  /**
   * Fork 会话：从指定消息序号处创建分支会话。
   *
   * 新会话包含原会话中 0 到 atIndex（含）的所有历史消息。
   * Fork 会话保存在原会话目录旁边，meta.json 中记录 forkParent。
   *
   * @param sessionId - 原会话 UUID
   * @param atIndex - 分叉点（新会话包含此序号及之前的所有消息）
   * @param projectId - 可选的 projectId
   * @returns 新会话的 UUID
   */
  async fork(
    sessionId: string,
    atIndex: number,
    projectId?: string,
  ): Promise<string> {
    const messagesFile = this.locateMessagesFile(sessionId, projectId);
    const messages = await this.readMessages(messagesFile);

    // Take messages up to and including atIndex
    const forkMessages = messages.filter((m) => m.index <= atIndex);

    const newSessionId = randomUUID();
    const newSessionPath = this.getSessionDir(newSessionId, projectId ?? "unknown");
    mkdirSync(newSessionPath, { recursive: true });

    const newMessagesFile = join(newSessionPath, "messages.jsonl");
    const lines = forkMessages.map((m) => JSON.stringify(m) + "\n").join("");
    writeFileSync(newMessagesFile, lines, { encoding: "utf-8" });

    // Write fork metadata
    const originalMeta = this.readMeta(sessionId, projectId);
    const metaFile = join(newSessionPath, "meta.json");
    writeFileSync(
      metaFile,
      JSON.stringify(
        {
          sessionId: newSessionId,
          projectId: originalMeta?.projectId ?? projectId ?? "unknown",
          createdAt: new Date().toISOString(),
          messageCount: forkMessages.length,
          forkParent: sessionId,
          forkAtIndex: atIndex,
        },
        null,
        2,
      ),
      { encoding: "utf-8" },
    );

    return newSessionId;
  }

  // -----------------------------------------------------------------------
  // Compress
  // -----------------------------------------------------------------------

  /**
   * 压缩会话：保留头部 5% 和尾部 20% 的消息，中间替换为摘要占位符。
   *
   * 压缩策略保证核心上下文不丢失：
   * - 头部 5%：早期关键指令
   * - 尾部 20%：最近的对话上下文
   *
   * @param sessionId - 会话 UUID
   * @param projectId - 可选的 projectId
   */
  async compress(
    sessionId: string,
    projectId?: string,
  ): Promise<void> {
    const messagesFile = this.locateMessagesFile(sessionId, projectId);
    const messages = await this.readMessages(messagesFile);

    if (messages.length === 0) return;

    const total = messages.length;
    const headCount = Math.max(1, Math.floor(total * 0.05));
    const tailCount = Math.max(1, Math.floor(total * 0.20));

    // If total is small, don't compress
    if (headCount + tailCount >= total) return;

    const head = messages.slice(0, headCount);
    const tail = messages.slice(total - tailCount);

    // Build compression placeholder
    const compressedCount = total - headCount - tailCount;
    const placeholder: SessionMessage = {
      type: "agent",
      content: {
        __compressed: true,
        compressedCount,
        summary: `[压缩了 ${compressedCount} 条中间消息]`,
        compressedTypes: this.summarizeTypes(
          messages.slice(headCount, total - tailCount),
        ),
      },
      timestamp: new Date().toISOString(),
      index: headCount,
    };

    // Write back: head + placeholder + tail (re-index)
    const result: SessionMessage[] = [
      ...head.map((m, i) => ({ ...m, index: i })),
      placeholder,
      ...tail.map((m, i) => ({
        ...m,
        index: headCount + 1 + i,
      })),
    ];

    const backupFile = messagesFile + `.backup-${Date.now()}`;
    renameSync(messagesFile, backupFile);

    const lines = result.map((m) => JSON.stringify(m) + "\n").join("");
    writeFileSync(messagesFile, lines, { encoding: "utf-8" });

    // Clean up backup
    try {
      unlinkSync(backupFile);
    } catch {
      // Best effort
    }

    // Update meta
    const metaFile = join(this.getSessionDir(sessionId, projectId ?? "unknown"), "meta.json");
    if (existsSync(metaFile)) {
      const meta = JSON.parse(readFileSync(metaFile, "utf-8")) as Record<string, unknown>;
      meta.messageCount = result.length;
      meta.lastCompressedAt = new Date().toISOString();
      meta.originalCount = total;
      writeFileSync(metaFile, JSON.stringify(meta, null, 2), { encoding: "utf-8" });
    }
  }

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  /**
   * 删除会话及其所有历史数据。
   *
   * @param sessionId - 会话 UUID
   * @param projectId - 可选的 projectId
   */
  async delete(
    sessionId: string,
    projectId?: string,
  ): Promise<void> {
    const sessionDir = this.getSessionDir(sessionId, projectId ?? "unknown");

    if (existsSync(sessionDir)) {
      // Use simple synchronous recursive removal
      this.removeDirSync(sessionDir);
    }

    // Also try with explicit projectId
    if (projectId) {
      const altDir = this.getSessionDir(sessionId, projectId);
      if (altDir !== sessionDir && existsSync(altDir)) {
        this.removeDirSync(altDir);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Utility: find session directory when projectId is unknown
  // -----------------------------------------------------------------------

  /**
   * 查找 sessionId 对应的目录（当 projectId 不可知时遍历子目录）。
   *
   * @param sessionId - 会话 UUID
   * @returns 包含 messages.jsonl 的目录路径，未找到则抛出异常
   */
  async findSessionDir(sessionId: string): Promise<string> {
    // First try the sessionId itself as a subdirectory
    if (!existsSync(this.sessionsDir)) {
      throw new Error(`Sessions directory does not exist: ${this.sessionsDir}`);
    }

    // Try direct: <sessionsDir>/<sessionId>/messages.jsonl
    const directFile = join(this.sessionsDir, sessionId, "messages.jsonl");
    if (existsSync(directFile)) {
      return join(this.sessionsDir, sessionId);
    }

    // Walk all project subdirectories
    const projectDirs = readdirSync(this.sessionsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const projDir of projectDirs) {
      const candidate = join(this.sessionsDir, projDir, sessionId);
      if (existsSync(join(candidate, "messages.jsonl"))) {
        return candidate;
      }
    }

    throw new Error(`Session directory not found for sessionId: ${sessionId}`);
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private ensureDirectory(): void {
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  private getSessionDir(sessionId: string, projectId: string): string {
    return join(this.sessionsDir, projectId, sessionId);
  }

  private getMessagesFile(sessionId: string, projectId: string): string {
    return join(this.getSessionDir(sessionId, projectId), "messages.jsonl");
  }

  /**
   * Locate messages.jsonl file. Try with projectId first, then search if unknown.
   */
  private locateMessagesFile(sessionId: string, projectId?: string): string {
    if (projectId) {
      const file = this.getMessagesFile(sessionId, projectId);
      if (existsSync(file)) return file;
    }

    // Walk to find the session directory
    if (existsSync(this.sessionsDir)) {
      const projectDirs = readdirSync(this.sessionsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      for (const projDir of projectDirs) {
        const candidate = join(this.sessionsDir, projDir, sessionId, "messages.jsonl");
        if (existsSync(candidate)) return candidate;
      }
    }

    // As fallback, just construct the path (will be created on append)
    return this.getMessagesFile(
      sessionId,
      projectId ?? "default",
    );
  }

  private async readMessages(filePath: string): Promise<SessionMessage[]> {
    if (!existsSync(filePath)) return [];

    const content = readFileSync(filePath, "utf-8");
    if (!content.trim()) return [];

    const messages: SessionMessage[] = [];
    for (const line of content.trim().split("\n")) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as SessionMessage;
        messages.push(msg);
      } catch {
        // Skip malformed lines
      }
    }

    return messages.sort((a, b) => a.index - b.index);
  }

  private async countLines(filePath: string): Promise<number> {
    if (!existsSync(filePath)) return 0;

    const content = readFileSync(filePath, "utf-8");
    if (!content.trim()) return 0;

    return content.trim().split("\n").filter((l) => l.trim()).length;
  }

  private readMeta(
    sessionId: string,
    projectId?: string,
  ): Record<string, unknown> | null {
    try {
      const sessionDir = projectId
        ? this.getSessionDir(sessionId, projectId)
        : join(this.sessionsDir, sessionId);
      const metaFile = join(sessionDir, "meta.json");
      if (existsSync(metaFile)) {
        return JSON.parse(readFileSync(metaFile, "utf-8")) as Record<string, unknown>;
      }
    } catch {
      // Meta not critical
    }
    return null;
  }

  private summarizeTypes(
    messages: SessionMessage[],
  ): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const msg of messages) {
      counts[msg.type] = (counts[msg.type] ?? 0) + 1;
    }
    return counts;
  }

  private removeDirSync(dirPath: string): void {
    if (!existsSync(dirPath)) return;

    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        this.removeDirSync(fullPath);
      } else {
        unlinkSync(fullPath);
      }
    }
    unlinkSync(dirPath); // remove the directory itself
  }
}
