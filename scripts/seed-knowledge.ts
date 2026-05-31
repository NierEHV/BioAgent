/**
 * BioAgent 知识库种子注入脚本
 *
 * 用法: pnpm tsx scripts/seed-knowledge.ts [--vector] [--graph] [--wiki]
 *
 * 默认注入全部三层知识库。
 * 实际注入逻辑委托给 @bioagent/knowledge 包的 seed-runner。
 */

import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const KNOWLEDGE_SRC = path.join(ROOT, "packages", "knowledge", "src");

async function main() {
  const args = process.argv.slice(2);
  const seedAll = args.length === 0;
  const seedVector = seedAll || args.includes("--vector");
  const seedGraph = seedAll || args.includes("--graph");
  const seedWiki = seedAll || args.includes("--wiki");

  console.log("🌱 BioAgent Knowledge Seeding");
  console.log("=============================");
  console.log(`Vector DB: ${seedVector ? "✅" : "⏭️"}`);
  console.log(`Graph DB:  ${seedGraph ? "✅" : "⏭️"}`);
  console.log(`Wiki:      ${seedWiki ? "✅" : "⏭️"}`);
  console.log("");

  // Dynamic import to avoid bundling issues
  const { seedRunner } = await import(
    path.join(KNOWLEDGE_SRC, "seed", "seed-runner.js")
  );

  const result = await seedRunner({
    dataDir: path.join(ROOT, "packages", "knowledge", "data"),
    chromaUrl: process.env.CHROMA_URL || "http://localhost:8000",
    kuzuDir: process.env.KUZU_DIR || path.join(ROOT, "data", "kuzu"),
    seedVector,
    seedGraph,
    seedWiki,
  });

  console.log(`✅ Seeding complete: ${result.snippetsInserted} vectors, ${result.graphNodes} nodes, ${result.graphEdges} edges, ${result.wikiFiles} wiki files`);
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
