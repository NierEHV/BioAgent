"use client";

// ============================================================
// @bioagent/ui — KnowledgeRef
// ============================================================
// Display knowledge references from the knowledge base query results.
// GSAP drives reference list fade + slide up entry.

import { useState, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export interface KnowledgeReference {
  title: string;
  doi?: string;
  url?: string;
  type: "paper" | "docs" | "database";
  relevance: number;
}

interface KnowledgeRefProps {
  references: KnowledgeReference[];
  answer?: string;
  confidence?: number;
  isLoading?: boolean;
  error?: string | null;
}

const typeIcons: Record<string, string> = {
  paper: "📄",
  docs: "📖",
  database: "🗄️",
};

const typeLabels: Record<string, string> = {
  paper: "Paper",
  docs: "Documentation",
  database: "Database",
};

export default function KnowledgeRef({
  references,
  answer,
  confidence,
  isLoading = false,
  error = null,
}: KnowledgeRefProps) {
  const [showAnswer, setShowAnswer] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const refsListRef = useRef<HTMLUListElement>(null);

  // GSAP: reference list entry animation
  useGSAP(
    () => {
      if (!refsListRef.current || references.length === 0) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: reduce)", () => {});
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const items =
          refsListRef.current?.querySelectorAll<HTMLLIElement>(
            "[data-ref-item]"
          );
        if (items && items.length > 0) {
          gsap.from(items, {
            autoAlpha: 0,
            y: 8,
            stagger: 0.05,
            duration: 0.3,
            ease: "power2.out",
          });
        }
      });
      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [references.length] }
  );

  return (
    <div ref={containerRef} className="card">
      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
        Knowledge Reference
      </h3>

      {isLoading && (
        <div className="flex items-center justify-center gap-3 py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
          <p className="text-sm text-gray-400">Searching knowledge base...</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {/* Answer section */}
          {answer && (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setShowAnswer(!showAnswer)}
                className="flex w-full items-center justify-between rounded-lg bg-brand-50 p-3 text-left dark:bg-brand-900/20"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">💡</span>
                  <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
                    AI Answer
                  </span>
                  {confidence !== undefined && (
                    <span className="rounded bg-brand-200 px-1.5 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-800 dark:text-brand-200">
                      {Math.round(confidence * 100)}% confidence
                    </span>
                  )}
                </div>
                <svg
                  className={`h-4 w-4 text-brand-500 transition-transform ${
                    showAnswer ? "rotate-180" : ""
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
              {showAnswer && (
                <div className="mt-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {answer}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* References list */}
          {references.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">
              No knowledge references found
            </p>
          ) : (
            <ul ref={refsListRef} className="space-y-2">
              {references.map((ref, idx) => (
                <li key={`${ref.title}-${idx}`} data-ref-item={idx}>
                  <a
                    href={ref.url || `https://doi.org/${ref.doi || ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-sm">
                        {typeIcons[ref.type] || "🔗"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {typeLabels[ref.type] || ref.type}
                          </span>
                          {/* Relevance bar */}
                          <div className="flex h-1 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                            <div
                              className="bg-brand-500"
                              style={{
                                width: `${Math.round(ref.relevance * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <p className="mt-0.5 text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2">
                          {ref.title}
                        </p>
                        {ref.doi && (
                          <p className="mt-0.5 font-mono text-xs text-gray-400">
                            DOI: {ref.doi}
                          </p>
                        )}
                      </div>
                      {ref.url && (
                        <svg
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      )}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}

          {/* Footer stats */}
          {references.length > 0 && (
            <div className="mt-3 border-t border-gray-100 pt-2 dark:border-gray-700">
              <p className="text-xs text-gray-400">
                {references.length} reference{references.length !== 1 ? "s" : ""}
                {" · "}
                Avg relevance:{" "}
                {Math.round(
                  (references.reduce((s, r) => s + r.relevance, 0) /
                    references.length) *
                    100
                )}
                %
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
