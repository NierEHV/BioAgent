/**
 * BioAgent 环境验证脚本
 *
 * 用法: pnpm tsx scripts/verify-setup.ts
 *
 * 检查:
 * - Node.js 版本
 * - pnpm 版本
 * - Docker 是否可用
 * - 必要镜像是否存在
 * - 各包是否可 import
 * - 数据目录权限
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";

const ROOT = path.resolve(__dirname, "..");
let failures = 0;

function check(label: string, fn: () => boolean, detail?: string): void {
  try {
    const ok = fn();
    if (ok) {
      console.log(`  ✅ ${label}`);
    } else {
      console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
      failures++;
    }
  } catch (err: any) {
    console.log(`  ❌ ${label} — ${err.message}`);
    failures++;
  }
}

async function main() {
  console.log("🔍 BioAgent Environment Verification");
  console.log("====================================");
  console.log(`Platform: ${os.platform()} ${os.arch()}`);
  console.log(`Hostname: ${os.hostname()}`);
  console.log("");

  // ---- Node.js ----
  console.log("📦 Node.js:");
  check("Node.js >= 22", () => {
    const v = process.version.match(/^v(\d+)/);
    return v ? parseInt(v[1]) >= 22 : false;
  }, process.version);

  // ---- pnpm ----
  console.log("\n📦 pnpm:");
  check("pnpm available", () => {
    try { execSync("pnpm --version", { stdio: "pipe" }); return true; } catch { return false; }
  });

  // ---- Docker ----
  console.log("\n🐳 Docker:");
  check("Docker CLI available", () => {
    try { execSync("docker --version", { stdio: "pipe" }); return true; } catch { return false; }
  });

  check("Docker daemon running", () => {
    try { execSync("docker info", { stdio: "pipe", timeout: 5000 }); return true; } catch { return false; }
  });

  // ---- Images ----
  console.log("\n🖼️  Docker Images:");
  const images = ["bioagent-scrna:latest", "python:3.11-slim"];
  for (const img of images) {
    check(`Image: ${img}`, () => {
      try {
        const out = execSync(`docker image inspect ${img}`, { stdio: "pipe" });
        return out.length > 0;
      } catch {
        return false;
      }
    }, "run `docker build -f docker/test-image.Dockerfile -t bioagent-scrna:latest .`");
  }

  // ---- Data Directories ----
  console.log("\n📁 Data Directories:");
  const dataDirs = ["data/projects", "data/sessions", "data/chroma", "data/kuzu", "data/logs"];
  for (const dir of dataDirs) {
    const fullPath = path.join(ROOT, dir);
    check(`Directory: ${dir}`, () => {
      try {
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
        }
        fs.accessSync(fullPath, fs.constants.W_OK);
        return true;
      } catch {
        return false;
      }
    });
  }

  // ---- Packages ----
  console.log("\n📦 Packages:");
  const packages = ["agent-core", "executor", "knowledge", "skills", "workflow", "ui"];
  for (const pkg of packages) {
    const pkgPath = path.join(ROOT, "packages", pkg);
    check(`Package: ${pkg}`, () => {
      return fs.existsSync(pkgPath) && fs.existsSync(path.join(pkgPath, "package.json"));
    });
  }

  // ---- Summary ----
  console.log("");
  console.log("====================================");
  if (failures === 0) {
    console.log("✅ All checks passed! BioAgent is ready.");
  } else {
    console.log(`❌ ${failures} check(s) failed. Fix the issues above before running BioAgent.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Verification crashed:", err);
  process.exit(1);
});
