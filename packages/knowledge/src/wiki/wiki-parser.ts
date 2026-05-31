// ============================================================
// @bioagent/knowledge — Wiki Markdown Parser
// ============================================================

import matter from "gray-matter";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { z } from "zod";
import { getLogger } from "../logger.js";

const logger = getLogger("wiki-parser");

// ---------------------------------------------------------------------------
// Frontmatter schema (zod-validated)
// ---------------------------------------------------------------------------

const wikiSourceSchema = z.object({
  doi: z.string().optional(),
  github: z.string().optional(),
  url: z.string().optional(),
});

// gray-matter auto-parses date-like strings to Date objects via js-yaml.
// We coerce them back to ISO strings.
const dateToString = z.preprocess((val) => {
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val ?? "");
}, z.string().min(1));

const wikiFrontmatterSchema = z.object({
  title: z.string().min(1),
  topic: z.string().min(1),
  version: z.number().int().positive().default(1),
  updated: dateToString,
  sources: z.array(wikiSourceSchema).default([]),
  tags: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  confidence: z.enum(["high", "medium", "low", "deprecated"]).default("medium"),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WikiDocFrontmatter = z.infer<typeof wikiFrontmatterSchema>;

export interface WikiDocFull extends WikiDocFrontmatter {
  path: string;
  content: string;
  excerpt: string;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

/**
 * Parse a single markdown wiki file and return its frontmatter + content.
 * Throws if the frontmatter fails zod validation.
 */
export function parseWikiFile(filePath: string): WikiDocFull {
  const raw = readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  const frontmatter = wikiFrontmatterSchema.parse(data);
  const excerpt = generateExcerpt(content);

  logger.debug({ path: filePath, title: frontmatter.title }, "Wiki file parsed");

  return {
    ...frontmatter,
    path: filePath,
    content: content.trim(),
    excerpt,
  };
}

/**
 * Recursively load all markdown files from a directory.
 * Returns a Map keyed by the relative path (from wikiDir root).
 */
export function loadAllWikiFiles(wikiDir: string): Map<string, WikiDocFull> {
  const docs = new Map<string, WikiDocFull>();

  if (!existsSync(wikiDir)) {
    logger.warn({ wikiDir }, "Wiki directory does not exist");
    return docs;
  }

  walkDir(wikiDir, wikiDir, docs);
  logger.info({ count: docs.size }, "Wiki files loaded");
  return docs;
}

/**
 * Search a loaded wiki index by keyword (matches title, tags, and content).
 */
export function searchWiki(
  docs: Map<string, WikiDocFull>,
  keyword: string,
): WikiDocFull[] {
  const lower = keyword.toLowerCase();
  const results: WikiDocFull[] = [];

  for (const doc of docs.values()) {
    if (
      doc.title.toLowerCase().includes(lower) ||
      doc.tags.some((t) => t.toLowerCase().includes(lower)) ||
      doc.content.toLowerCase().includes(lower)
    ) {
      results.push(doc);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walkDir(
  root: string,
  current: string,
  docs: Map<string, WikiDocFull>,
): void {
  const entries = readdirSync(current);
  for (const entry of entries) {
    const fullPath = join(current, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walkDir(root, fullPath, docs);
    } else if (extname(entry) === ".md") {
      try {
        const doc = parseWikiFile(fullPath);
        // Key: relative path from wiki root, forward-slash normalised
        const relPath = fullPath
          .replace(root, "")
          .replace(/\\/g, "/")
          .replace(/^\//, "");
        docs.set(relPath, doc);
      } catch (err) {
        logger.warn({ err, path: fullPath }, "Skipping invalid wiki file");
      }
    }
  }
}

/** Create a brief excerpt (first ~200 chars of first real paragraph). */
function generateExcerpt(content: string): string {
  // Strip heading markers and code fences for cleaner excerpts
  const cleaned = content
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .trim();

  const firstPara = cleaned.split("\n\n")[0] ?? cleaned;
  if (firstPara.length <= 200) return firstPara;

  return firstPara.slice(0, 200).replace(/\s+\S*$/, "") + "...";
}
