// ============================================================
// @bioagent/executor — ContainerManager unit tests
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ContainerManager } from "../src/container-manager.js";

const TEST_IMAGE = "rnakato/shortcake_light:latest";
const TEST_CONTAINER = "bioagent-test-cm";

describe("ContainerManager", () => {
  const cm = new ContainerManager();

  // ------------------------------------------------
  // Image operations
  // ------------------------------------------------
  describe("image operations", () => {
    beforeAll(async () => {
      await cm.ensureImage(TEST_IMAGE);
    }, 300_000);

    it("imageExists returns true for pulled image", async () => {
      expect(await cm.imageExists(TEST_IMAGE)).toBe(true);
    });

    it("imageExists returns false for nonexistent image", async () => {
      expect(await cm.imageExists("nonexistent/xyz:latest")).toBe(false);
    });
  });

  // ------------------------------------------------
  // Container lifecycle
  // ------------------------------------------------
  describe("container lifecycle", () => {
    afterAll(async () => {
      try {
        await cm.stopContainer(TEST_CONTAINER, { force: true, removeVolumes: true });
      } catch {
        // ignore
      }
    });

    it("startContainer creates and runs a container", async () => {
      const result = await cm.startContainer({
        image: TEST_IMAGE,
        name: TEST_CONTAINER,
        command: ["tail", "-f", "/dev/null"],
        volumes: [],
        env: {},
        gpu: false,
        network: "bridge",
      });
      expect(result.containerId).toBeTruthy();
      expect(result.startedAt).toBeTruthy();
    }, 60_000);

    it("getContainerStatus returns running", async () => {
      const status = await cm.getContainerStatus(TEST_CONTAINER);
      expect(status.state).toBe("running");
    });

    it("getContainerStatus returns not_found for nonexistent container", async () => {
      const status = await cm.getContainerStatus("nonexistent-container-xyz");
      expect(status.state).toBe("not_found");
    });

    it("execInContainer runs a command successfully", async () => {
      const result = await cm.execInContainer({
        container: TEST_CONTAINER,
        command: "echo hello world",
        workdir: "/data",
        timeout: 10_000,
        env: {},
        captureStderr: true,
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("hello world");
    });

    it("execInContainer handles command failure", async () => {
      const result = await cm.execInContainer({
        container: TEST_CONTAINER,
        command: "exit 1",
        workdir: "/data",
        timeout: 10_000,
        env: {},
        captureStderr: true,
      });
      expect(result.exitCode).toBe(1);
    });

    it("listContainers includes test container", async () => {
      const list = await cm.listContainers("bioagent-test");
      expect(list.some((c) => c.name === TEST_CONTAINER)).toBe(true);
    });

    it("stopContainer stops and removes", async () => {
      await cm.stopContainer(TEST_CONTAINER, { force: true, removeVolumes: true });
      const status = await cm.getContainerStatus(TEST_CONTAINER);
      expect(status.state).toBe("not_found");
    });
  });

  // ------------------------------------------------
  // checkAll
  // ------------------------------------------------
  describe("checkAll", () => {
    it("returns a Map of bioagent- containers", async () => {
      const map = await cm.checkAll();
      expect(map).toBeInstanceOf(Map);
    });
  });
});
