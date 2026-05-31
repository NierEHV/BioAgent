// ============================================================
// @bioagent/knowledge — Wiki Index
// ============================================================
// In-memory index mapping wiki document titles to file paths.
// Enables fast lookup and search across all wiki documents.

export interface WikiIndexEntry {
  /** Document title (from frontmatter or first heading) */
  title: string;
  /** File path relative to data/wiki/ */
  filePath: string;
  /** Category: biology, omics, tools, sop, failures */
  category: "biology" | "omics" | "tools" | "sop" | "failures";
  /** Tags for search filtering */
  tags: string[];
  /** Last modification timestamp (ISO 8601) */
  lastModified: string;
}

export class WikiIndex {
  private entries: WikiIndexEntry[] = [];

  /** Add or update an index entry (deduplicates by filePath) */
  add(entry: WikiIndexEntry): void {
    const existing = this.entries.findIndex(e => e.filePath === entry.filePath);
    if (existing >= 0) {
      this.entries[existing] = entry;
    } else {
      this.entries.push(entry);
    }
  }

  /** Remove an entry by file path */
  remove(filePath: string): boolean {
    const idx = this.entries.findIndex(e => e.filePath === filePath);
    if (idx >= 0) {
      this.entries.splice(idx, 1);
      return true;
    }
    return false;
  }

  /** Get entry by exact title */
  getByTitle(title: string): WikiIndexEntry | undefined {
    return this.entries.find(e => e.title === title);
  }

  /** Get entry by file path */
  getByPath(filePath: string): WikiIndexEntry | undefined {
    return this.entries.find(e => e.filePath === filePath);
  }

  /** Search entries by query (matches title, tags, category) */
  search(query: string): WikiIndexEntry[] {
    const lower = query.toLowerCase();
    return this.entries.filter(e =>
      e.title.toLowerCase().includes(lower) ||
      e.tags.some(t => t.toLowerCase().includes(lower)) ||
      e.category.toLowerCase().includes(lower),
    );
  }

  /** Get all entries in a category */
  getByCategory(category: WikiIndexEntry["category"]): WikiIndexEntry[] {
    return this.entries.filter(e => e.category === category);
  }

  /** List all indexed entries */
  listAll(): WikiIndexEntry[] {
    return [...this.entries];
  }

  /** Number of indexed documents */
  get size(): number {
    return this.entries.length;
  }

  /** Clear all entries */
  clear(): void {
    this.entries = [];
  }
}
