"use client";

// ============================================================
// @bioagent/ui — FileBrowser
// ============================================================
// Left-sidebar tree file browser for project data files.
// GSAP drives file list stagger entry and new file slide-in.

import { useState, useMemo, useCallback, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  format?: string;
  sizeBytes?: number;
  children?: FileNode[];
}

interface FileBrowserProps {
  files: FileNode[];
  onSelectFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  selectedPath?: string;
  isLoading?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const fileFormatIcons: Record<string, string> = {
  h5ad: "📦",
  h5: "📦",
  mtx: "📊",
  csv: "📋",
  tsv: "📋",
  txt: "📄",
  json: "📋",
  yaml: "⚙️",
  yml: "⚙️",
  png: "🖼️",
  jpg: "🖼️",
  jpeg: "🖼️",
  svg: "🖼️",
  pdf: "📕",
  rds: "📦",
  rdata: "📦",
  log: "📝",
  html: "🌐",
  md: "📝",
  py: "🐍",
  r: "📊",
  ipynb: "📓",
  gz: "📦",
  tar: "📦",
  zip: "📦",
};

function getFileIcon(format?: string): string {
  if (!format) return "📄";
  return fileFormatIcons[format.toLowerCase()] || "📄";
}

function FileTreeItem({
  node,
  depth,
  onSelectFile,
  onDeleteFile,
  selectedPath,
}: {
  node: FileNode;
  depth: number;
  onSelectFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  selectedPath?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const isDir = node.type === "directory";
  const isSelected = node.path === selectedPath;

  return (
    <div>
      <div
        className={`group flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50
          ${isSelected ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300" : "text-gray-700 dark:text-gray-300"}
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (isDir) {
            setIsExpanded(!isExpanded);
          } else {
            onSelectFile(node.path);
          }
        }}
      >
        {/* Expand toggle */}
        {isDir ? (
          <svg
            className={`h-3 w-3 shrink-0 text-gray-400 transition-transform ${
              isExpanded ? "rotate-90" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Icon */}
        <span className="shrink-0 text-xs">
          {isDir ? (isExpanded ? "📂" : "📁") : getFileIcon(node.format)}
        </span>

        {/* Name */}
        <span className="flex-1 truncate">{node.name}</span>

        {/* Size */}
        {!isDir && node.sizeBytes !== undefined && (
          <span className="shrink-0 text-gray-400">
            {formatSize(node.sizeBytes)}
          </span>
        )}

        {/* Delete button */}
        {!isDir && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteFile(node.path);
            }}
            className="shrink-0 rounded p-0.5 text-gray-400 opacity-0 hover:bg-red-100 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-900/20"
            title="Delete file"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Children */}
      {isDir && isExpanded && node.children && (
        <div>
          {node.children.length === 0 && (
            <p
              className="py-0.5 text-xs text-gray-400"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              Empty directory
            </p>
          )}
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelectFile={onSelectFile}
              onDeleteFile={onDeleteFile}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileBrowser({
  files,
  onSelectFile,
  onDeleteFile,
  selectedPath,
  isLoading = false,
}: FileBrowserProps) {
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredFiles = useMemo(() => {
    if (!filter.trim()) return files;
    const lower = filter.toLowerCase();

    const filterTree = (nodes: FileNode[]): FileNode[] =>
      nodes
        .map((node) => {
          const matches =
            node.name.toLowerCase().includes(lower) ||
            (node.path.toLowerCase().includes(lower) as boolean);
          if (!node.children) {
            return matches ? node : null;
          }
          const filteredChildren = filterTree(node.children);
          if (matches || filteredChildren.length > 0) {
            return {
              ...node,
              children:
                filteredChildren.length > 0 ? filteredChildren : node.children,
            };
          }
          return null;
        })
        .filter((n): n is FileNode => n !== null);

    return filterTree(files);
  }, [files, filter]);

  const handleDelete = useCallback(
    (path: string) => {
      if (window.confirm(`Delete "${path}"?`)) {
        onDeleteFile(path);
      }
    },
    [onDeleteFile]
  );

  // GSAP: file list entry stagger on first load / new files
  const prevFileCountRef = useRef(files.length);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: reduce)", () => {});
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const itemEls =
          containerRef.current?.querySelectorAll<HTMLDivElement>(
            "[data-file-item]"
          );

        if (itemEls && itemEls.length > 0) {
          if (files.length > prevFileCountRef.current) {
            // New files added: animate only the new ones
            const newCount = files.length - prevFileCountRef.current;
            const newEls = Array.from(itemEls).slice(-newCount);
            gsap.from(newEls, {
              autoAlpha: 0,
              x: -10,
              stagger: 0.03,
              duration: 0.25,
              ease: "power2.out",
            });
          } else if (prevFileCountRef.current === 0 && files.length > 0) {
            // First load: animate all
            gsap.from(itemEls, {
              autoAlpha: 0,
              x: -10,
              stagger: 0.03,
              duration: 0.25,
              ease: "power2.out",
            });
          }
        }

        prevFileCountRef.current = files.length;
      });
      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [files.length] }
  );

  return (
    <div ref={containerRef} className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Files
        </h3>
        <span className="text-xs text-gray-400">
          {files.length} items
        </span>
      </div>

      {/* Filter */}
      <div className="px-2 py-1.5">
        <input
          type="text"
          className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 placeholder:text-gray-400
                     focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400
                     dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500"
          placeholder="Filter files..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
            <p className="text-xs text-gray-400">Loading files...</p>
          </div>
        )}

        {!isLoading && filteredFiles.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-gray-400">
            {filter ? "No matching files" : "No files uploaded yet"}
          </p>
        )}

        {!isLoading &&
          filteredFiles.map((node) => (
            <FileTreeItem
              key={node.path}
              node={node}
              depth={0}
              onSelectFile={onSelectFile}
              onDeleteFile={handleDelete}
              selectedPath={selectedPath}
            />
          ))}
      </div>
    </div>
  );
}
