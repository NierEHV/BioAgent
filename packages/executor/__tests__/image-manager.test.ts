// ============================================================
// @bioagent/executor — ImageManager unit tests
// ============================================================

import { describe, it, expect, beforeAll } from "vitest";
import { ImageManager } from "../src/image-manager.js";

describe("ImageManager", () => {
  const mgr = new ImageManager();

  // Verify Docker connectivity once before all tests
  let dockerAvailable = false;

  beforeAll(async () => {
    try {
      await mgr.isImageCached("python:3.11-slim");
      dockerAvailable = true;
    } catch {
      dockerAvailable = false;
    }
  });

  it("isImageCached returns true for existing image (python:3.11-slim)", async () => {
    if (!dockerAvailable) {
      console.warn("Docker not available — skipping isImageCached test");
      return;
    }
    const cached = await mgr.isImageCached("python:3.11-slim");
    expect(cached).toBe(true);
  });

  it("isImageCached returns false for nonexistent image", async () => {
    if (!dockerAvailable) {
      console.warn("Docker not available — skipping isImageCached test");
      return;
    }
    const cached = await mgr.isImageCached(
      "nonexistent-image-that-does-not-exist-xyz-12345:latest",
    );
    expect(cached).toBe(false);
  });

  it("getCachedImages returns an array", async () => {
    if (!dockerAvailable) {
      console.warn("Docker not available — skipping getCachedImages test");
      return;
    }
    const images = await mgr.getCachedImages();
    expect(Array.isArray(images)).toBe(true);
  });

  it("getCachedImages includes python:3.11-slim", async () => {
    if (!dockerAvailable) {
      console.warn("Docker not available — skipping getCachedImages test");
      return;
    }
    const images = await mgr.getCachedImages();
    expect(images.some((img) => img.includes("python"))).toBe(true);
  });

  it("inspect returns info for existing image", async () => {
    if (!dockerAvailable) {
      console.warn("Docker not available — skipping inspect test");
      return;
    }
    const info = await mgr.inspect("python:3.11-slim");
    expect(info).toBeDefined();
    expect(info.Os).toBe("linux");
    expect(info.Size).toBeGreaterThan(0);
    expect(info.Architecture).toBeDefined();
    expect(info.Created).toBeDefined();
    expect(typeof info.Created).toBe("string");
  });

  it("inspect throws for nonexistent image", async () => {
    if (!dockerAvailable) {
      console.warn("Docker not available — skipping inspect test");
      return;
    }
    await expect(
      mgr.inspect("nonexistent-image-that-does-not-exist-xyz-12345:latest"),
    ).rejects.toThrow();
  });

  it("getImageSize returns positive number for existing image", async () => {
    if (!dockerAvailable) {
      console.warn("Docker not available — skipping getImageSize test");
      return;
    }
    const size = await mgr.getImageSize("python:3.11-slim");
    expect(size).toBeGreaterThan(0);
    expect(typeof size).toBe("number");
  });

  it("getImageSize returns 0 for nonexistent image", async () => {
    if (!dockerAvailable) {
      console.warn("Docker not available — skipping getImageSize test");
      return;
    }
    const size = await mgr.getImageSize(
      "nonexistent-image-that-does-not-exist-xyz-12345:latest",
    );
    expect(size).toBe(0);
  });

  it("verifyTools detects python in python:3.11-slim", async () => {
    if (!dockerAvailable) {
      console.warn("Docker not available — skipping verifyTools test");
      return;
    }
    const results = await mgr.verifyTools("python:3.11-slim", [
      "python",
      "pip",
      "nonexistent-tool-xyz",
    ]);
    expect(results).toBeDefined();
    expect(results["python"]).toBe(true);
    expect(results["pip"]).toBe(true);
    expect(results["nonexistent-tool-xyz"]).toBe(false);
  });

  it("getToolVersion returns version for python", async () => {
    if (!dockerAvailable) {
      console.warn("Docker not available — skipping getToolVersion test");
      return;
    }
    const version = await mgr.getToolVersion("python:3.11-slim", "python");
    expect(version).toBeDefined();
    expect(version).not.toBeNull();
    // Python version looks like "3.11.x"
    if (version !== null) {
      expect(version).toMatch(/3\.\d+/);
    }
  });

  it("getToolVersion returns null for nonexistent tool", async () => {
    if (!dockerAvailable) {
      console.warn("Docker not available — skipping getToolVersion test");
      return;
    }
    const version = await mgr.getToolVersion(
      "python:3.11-slim",
      "nonexistent-tool-xyz",
    );
    expect(version).toBeNull();
  });

  it("pruneImages returns an array (even if empty)", async () => {
    if (!dockerAvailable) {
      console.warn("Docker not available — skipping pruneImages test");
      return;
    }
    const pruned = await mgr.pruneImages();
    expect(Array.isArray(pruned)).toBe(true);
  });

  it("removeImage throws for nonexistent image", async () => {
    if (!dockerAvailable) {
      console.warn("Docker not available — skipping removeImage test");
      return;
    }
    await expect(
      mgr.removeImage(
        "nonexistent-image-that-does-not-exist-xyz-12345:latest",
      ),
    ).rejects.toThrow();
  });
});
