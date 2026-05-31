// ============================================================
// @bioagent/agent-core — Session Manager Tests
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SessionManager, type SessionMessage } from "../src/session/session-manager.js";

const TEST_SESSIONS_DIR = join(process.cwd(), "__tests__", "__tmp_sessions__");

function makeMsg(
  type: SessionMessage["type"],
  content: unknown,
  timestamp?: string,
): Omit<SessionMessage, "index"> {
  return {
    type,
    content,
    timestamp: timestamp ?? new Date().toISOString(),
  };
}

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    // Clean up before each test
    if (existsSync(TEST_SESSIONS_DIR)) {
      rmSync(TEST_SESSIONS_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_SESSIONS_DIR, { recursive: true });
    manager = new SessionManager(TEST_SESSIONS_DIR);
  });

  afterEach(() => {
    if (existsSync(TEST_SESSIONS_DIR)) {
      rmSync(TEST_SESSIONS_DIR, { recursive: true, force: true });
    }
  });

  // ---- Create ----

  describe("create", () => {
    it("should create a new session and return a UUID", async () => {
      const sessionId = await manager.create("test-project");
      expect(sessionId).toBeDefined();
      expect(sessionId.length).toBeGreaterThan(10);

      // Check directory exists
      const sessionDir = join(TEST_SESSIONS_DIR, "test-project", sessionId);
      expect(existsSync(sessionDir)).toBe(true);

      // Check messages.jsonl is created
      const messagesFile = join(sessionDir, "messages.jsonl");
      expect(existsSync(messagesFile)).toBe(true);

      // Check meta.json is created
      const metaFile = join(sessionDir, "meta.json");
      expect(existsSync(metaFile)).toBe(true);
      const meta = JSON.parse(readFileSync(metaFile, "utf-8"));
      expect(meta.sessionId).toBe(sessionId);
      expect(meta.projectId).toBe("test-project");
      expect(meta.messageCount).toBe(0);
    });

    it("should create unique session IDs", async () => {
      const id1 = await manager.create("project-a");
      const id2 = await manager.create("project-a");
      expect(id1).not.toBe(id2);
    });
  });

  // ---- Append + Get ----

  describe("appendMessage and getMessages", () => {
    it("should append and retrieve messages", async () => {
      const sessionId = await manager.create("test-project");

      await manager.appendMessage(sessionId, makeMsg("user", { text: "Hello" }), "test-project");
      await manager.appendMessage(sessionId, makeMsg("agent", { text: "Hi there!" }), "test-project");

      const messages = await manager.getMessages(sessionId, "test-project");
      expect(messages).toHaveLength(2);
      expect(messages[0]).toMatchObject({ type: "user", index: 0 });
      expect(messages[1]).toMatchObject({ type: "agent", index: 1 });
    });

    it("should auto-assign sequential indices", async () => {
      const sessionId = await manager.create("test-project");

      await manager.appendMessage(sessionId, makeMsg("user", { n: 1 }), "test-project");
      await manager.appendMessage(sessionId, makeMsg("user", { n: 2 }), "test-project");
      await manager.appendMessage(sessionId, makeMsg("user", { n: 3 }), "test-project");

      const messages = await manager.getMessages(sessionId, "test-project");
      expect(messages.map((m) => m.index)).toEqual([0, 1, 2]);
    });

    it("should return empty array for non-existent session", async () => {
      const messages = await manager.getMessages("nonexistent-id", "test-project");
      expect(messages).toEqual([]);
    });

    it("should persist messages to JSONL file", async () => {
      const sessionId = await manager.create("test-project");

      await manager.appendMessage(sessionId, makeMsg("user", { text: "persist me" }), "test-project");

      // Re-read the file directly
      const messagesFile = join(
        TEST_SESSIONS_DIR,
        "test-project",
        sessionId,
        "messages.jsonl",
      );
      const raw = readFileSync(messagesFile, "utf-8").trim();
      const parsed = JSON.parse(raw.split("\n")[0]!);
      expect(parsed.type).toBe("user");
      expect(parsed.content.text).toBe("persist me");
    });

    it("should handle all message types", async () => {
      const sessionId = await manager.create("test-project");
      const types: SessionMessage["type"][] = [
        "user", "thinking", "agent", "tool_call", "qc_report", "progress", "viz",
      ];

      for (const type of types) {
        await manager.appendMessage(sessionId, makeMsg(type, { test: type }), "test-project");
      }

      const messages = await manager.getMessages(sessionId, "test-project");
      expect(messages).toHaveLength(types.length);
      expect(messages.map((m) => m.type)).toEqual(types);
    });
  });

  // ---- Fork ----

  describe("fork", () => {
    it("should fork a session at a given index", async () => {
      const sessionId = await manager.create("test-project");

      // Add 10 messages
      for (let i = 0; i < 10; i++) {
        await manager.appendMessage(
          sessionId,
          makeMsg("user", { num: i }),
          "test-project",
        );
      }

      // Fork at index 4
      const forkedId = await manager.fork(sessionId, 4, "test-project");
      expect(forkedId).not.toBe(sessionId);

      // Forked session should have messages 0-4 (5 messages)
      const forkedMessages = await manager.getMessages(forkedId, "test-project");
      expect(forkedMessages).toHaveLength(5);
      expect(forkedMessages.map((m) => m.index)).toEqual([0, 1, 2, 3, 4]);

      // Original session should still have all 10 messages
      const originalMessages = await manager.getMessages(sessionId, "test-project");
      expect(originalMessages).toHaveLength(10);
    });

    it("should fork at index 0 (only first message)", async () => {
      const sessionId = await manager.create("test-project");
      await manager.appendMessage(sessionId, makeMsg("user", { num: 1 }), "test-project");
      await manager.appendMessage(sessionId, makeMsg("user", { num: 2 }), "test-project");

      const forkedId = await manager.fork(sessionId, 0, "test-project");
      const forkedMessages = await manager.getMessages(forkedId, "test-project");
      expect(forkedMessages).toHaveLength(1);
      expect(forkedMessages[0].index).toBe(0);
    });

    it("should write fork metadata", async () => {
      const sessionId = await manager.create("test-project");
      await manager.appendMessage(sessionId, makeMsg("user", { num: 1 }), "test-project");

      const forkedId = await manager.fork(sessionId, 0, "test-project");

      const metaFile = join(TEST_SESSIONS_DIR, "test-project", forkedId, "meta.json");
      const meta = JSON.parse(readFileSync(metaFile, "utf-8"));
      expect(meta.forkParent).toBe(sessionId);
      expect(meta.forkAtIndex).toBe(0);
    });
  });

  // ---- Compress ----

  describe("compress", () => {
    it("should compress a session keeping head 5% and tail 20%", async () => {
      const sessionId = await manager.create("test-project");

      // Add 100 messages
      for (let i = 0; i < 100; i++) {
        await manager.appendMessage(
          sessionId,
          makeMsg("user", { num: i }),
          "test-project",
        );
      }

      await manager.compress(sessionId, "test-project");

      const messages = await manager.getMessages(sessionId, "test-project");

      // head 5% of 100 = 5, tail 20% of 100 = 20, plus 1 compression placeholder
      expect(messages.length).toBeLessThan(100);
      expect(messages.length).toBeGreaterThan(20);

      // First message should be original
      expect(messages[0].type).toBe("user");
      expect(messages[0].content).toEqual({ num: 0 });

      // Should have a compression placeholder
      const placeholder = messages.find(
        (m) =>
          m.type === "agent" &&
          typeof m.content === "object" &&
          m.content !== null &&
          (m.content as Record<string, unknown>)["__compressed"] === true,
      );
      expect(placeholder).toBeDefined();

      // Indices should be sequential
      for (let i = 0; i < messages.length; i++) {
        expect(messages[i].index).toBe(i);
      }
    });

    it("should not compress small sessions", async () => {
      const sessionId = await manager.create("test-project");

      // Add only 3 messages
      for (let i = 0; i < 3; i++) {
        await manager.appendMessage(
          sessionId,
          makeMsg("user", { num: i }),
          "test-project",
        );
      }

      await manager.compress(sessionId, "test-project");
      const messages = await manager.getMessages(sessionId, "test-project");
      expect(messages).toHaveLength(3);
    });

    it("should handle empty session compress", async () => {
      const sessionId = await manager.create("test-project");
      await manager.compress(sessionId, "test-project");
      const messages = await manager.getMessages(sessionId, "test-project");
      expect(messages).toEqual([]);
    });
  });

  // ---- Delete ----

  describe("delete", () => {
    it("should delete a session directory", async () => {
      const sessionId = await manager.create("test-project");
      const sessionDir = join(TEST_SESSIONS_DIR, "test-project", sessionId);
      expect(existsSync(sessionDir)).toBe(true);

      await manager.delete(sessionId, "test-project");
      expect(existsSync(sessionDir)).toBe(false);
    });

    it("should handle deleting non-existent session", async () => {
      await expect(
        manager.delete("nonexistent", "test-project"),
      ).resolves.toBeUndefined();
    });
  });

  // ---- Edge cases ----

  describe("edge cases", () => {
    it("should handle JSONL with blank lines", async () => {
      const sessionId = await manager.create("test-project");

      await manager.appendMessage(sessionId, makeMsg("user", { text: "msg1" }), "test-project");
      await manager.appendMessage(sessionId, makeMsg("user", { text: "msg2" }), "test-project");

      const messagesFile = join(
        TEST_SESSIONS_DIR,
        "test-project",
        sessionId,
        "messages.jsonl",
      );
      // Append a blank line manually (simulating corruption)
      const current = readFileSync(messagesFile, "utf-8");
      // Re-write clean
      const { writeFileSync } = await import("node:fs");
      writeFileSync(messagesFile, current + "\n\n", "utf-8");

      const messages = await manager.getMessages(sessionId, "test-project");
      expect(messages).toHaveLength(2);
    });

    it("should find session without explicit projectId", async () => {
      const sessionId = await manager.create("some-project");
      await manager.appendMessage(sessionId, makeMsg("user", { text: "test" }), "some-project");

      // Try getMessages without projectId — should auto-discover
      const messages = await manager.getMessages(sessionId);
      expect(messages).toHaveLength(1);
    });
  });
});
