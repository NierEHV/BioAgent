// ============================================================
// @bioagent/executor — helper function unit tests
// ============================================================

import { describe, it, expect } from "vitest";
import { parseMemoryLimit, formatBytes, calculateCPUPercent } from "../src/container-manager.js";

describe("parseMemoryLimit", () => {
  it('parses "64g" as 64 GB in bytes', () => {
    expect(parseMemoryLimit("64g")).toBe(64 * 1024 * 1024 * 1024);
  });

  it('parses "512m" as 512 MB in bytes', () => {
    expect(parseMemoryLimit("512m")).toBe(512 * 1024 * 1024);
  });

  it('parses "2G" (uppercase) as 2 GB in bytes', () => {
    expect(parseMemoryLimit("2G")).toBe(2 * 1024 * 1024 * 1024);
  });

  it('parses "1024" (bare number) as bytes', () => {
    expect(parseMemoryLimit("1024")).toBe(1024);
  });

  it("handles whitespace", () => {
    expect(parseMemoryLimit(" 1g ")).toBe(1 * 1024 * 1024 * 1024);
  });

  it("throws on invalid format", () => {
    expect(() => parseMemoryLimit("abc")).toThrow("Invalid memory limit format");
  });
});

describe("formatBytes", () => {
  it("formats bytes range", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats KB range", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("formats MB range", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formats GB range", () => {
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2.00 GB");
  });

  it("handles negative as 0 B", () => {
    expect(formatBytes(-1)).toBe("0 B");
  });
});

describe("calculateCPUPercent", () => {
  it("returns 0 when systemDelta is 0", () => {
    expect(calculateCPUPercent(100, 0, 1000, 1000, 4)).toBe(0);
  });

  it("calculates correct percentage for a single core", () => {
    // cpuDelta = 100ms, systemDelta = 1000ms, onlineCpus = 4
    const result = calculateCPUPercent(100_000_000, 0, 1_000_000_000, 0, 4);
    // (100M / 1000M) * 4 * 100 = 40%
    expect(result).toBeCloseTo(40, 1);
  });

  it("returns 0 when cpuDelta is negative", () => {
    expect(calculateCPUPercent(50, 100, 200, 100, 1)).toBe(0);
  });
});
