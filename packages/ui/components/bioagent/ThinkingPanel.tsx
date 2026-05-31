"use client";

// ============================================================
// @bioagent/ui — ThinkingPanel
// ============================================================
// 7-step thinking process collapsible accordion.
// Displays each section with title, content, and completion status.

import { useState, useCallback } from "react";

export interface ThinkingSection {
  index: number;
  title: string;
  content: string;
  completed: boolean;
  isLoading: boolean;
}

interface ThinkingPanelProps {
  sections: ThinkingSection[];
  isThinking: boolean;
  title?: string;
}

const stepColors: Record<number, string> = {
  1: "border-l-pink-500",
  2: "border-l-purple-500",
  3: "border-l-indigo-500",
  4: "border-l-blue-500",
  5: "border-l-cyan-500",
  6: "border-l-teal-500",
  7: "border-l-emerald-500",
};

const stepBadgeColors: Record<number, string> = {
  1: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  2: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  3: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  4: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  5: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  6: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  7: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

export default function ThinkingPanel({
  sections,
  isThinking,
  title = "Thinking Process",
}: ThinkingPanelProps) {
  const [expandedSections, setExpandedSections] = useState<
    Set<number>
  >(new Set());

  const toggle = useCallback((index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedSections(new Set(sections.map((s) => s.index)));
  }, [sections]);

  const collapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  return (
    <div className="card">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          {isThinking && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
              Thinking...
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={expandAll}
            className="rounded px-2 py-0.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded px-2 py-0.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {sections.length > 0 && (
        <div className="mb-3 flex h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          {sections.map((section) => (
            <div
              key={section.index}
              className={`transition-all ${
                section.completed
                  ? "bg-green-500"
                  : section.isLoading
                    ? "bg-blue-400 animate-pulse"
                    : "bg-gray-300 dark:bg-gray-600"
              }`}
              style={{ width: `${100 / sections.length}%` }}
            />
          ))}
        </div>
      )}

      {/* Sections */}
      {sections.length === 0 && !isThinking && (
        <p className="py-4 text-center text-sm text-gray-400">
          No thinking data available
        </p>
      )}

      {sections.length === 0 && isThinking && (
        <div className="flex items-center justify-center gap-3 py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
          <p className="text-sm text-gray-400">Agent is thinking...</p>
        </div>
      )}

      <div className="space-y-1">
        {sections.map((section) => (
          <div
            key={section.index}
            className={`rounded-lg border-l-4 ${
              stepColors[section.index] || "border-l-gray-400"
            } ${
              section.completed
                ? "bg-gray-50 dark:bg-gray-800/50"
                : section.isLoading
                  ? "bg-blue-50 dark:bg-blue-900/10"
                  : ""
            }`}
          >
            <button
              type="button"
              onClick={() => toggle(section.index)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  stepBadgeColors[section.index] || "bg-gray-100 text-gray-600"
                }`}
              >
                {section.index}
              </span>
              <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                {section.title}
              </span>
              {section.isLoading && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
              )}
              {section.completed && (
                <span className="text-green-500">✅</span>
              )}
              <svg
                className={`h-4 w-4 text-gray-400 transition-transform ${
                  expandedSections.has(section.index) ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {expandedSections.has(section.index) && (
              <div className="animate-slide-down px-3 pb-3 pt-1">
                {section.content ? (
                  <div
                    className="prose prose-sm max-w-none text-xs text-gray-600 dark:text-gray-300"
                    dangerouslySetInnerHTML={{ __html: section.content }}
                  />
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    Waiting for content...
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
