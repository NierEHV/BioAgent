"use client";

// ============================================================
// @bioagent/ui — FileInspector
// ============================================================
// Display file format detection/inspection results with preview.
// GSAP drives content fade + slide up entry animation.

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { FileInspectionResult } from "@/lib/bioagent-client";

gsap.registerPlugin(useGSAP);

interface FileInspectorProps {
  result: FileInspectionResult | null;
  isLoading?: boolean;
  error?: string | null;
  onClose?: () => void;
}

export default function FileInspector({
  result,
  isLoading = false,
  error = null,
  onClose,
}: FileInspectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // GSAP: content entry animation when result appears
  useGSAP(
    () => {
      if (!result || !containerRef.current) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: reduce)", () => {});
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const contentEl =
          containerRef.current?.querySelector<HTMLDivElement>(
            "[data-inspector-content]"
          );
        if (contentEl) {
          gsap.from(contentEl, {
            autoAlpha: 0,
            y: 8,
            duration: 0.3,
            ease: "power2.out",
          });
        }
      });
      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [result?.path] }
  );

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center gap-3 py-4 pl-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
          <p className="text-sm text-gray-400">Inspecting file...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
        <div className="flex items-center justify-between">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-red-400 hover:text-red-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="card">
        <p className="py-4 text-center text-sm text-gray-400">
          Select a file to inspect
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="card">
      <div data-inspector-content>
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              File Inspector
            </h3>
            <p className="truncate text-xs text-gray-400 font-mono">{result.path}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {result.format.toUpperCase()}
            </span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Shape info */}
        {result.shape && (
          <div className="mb-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-gray-400">Rows:</span>{" "}
                <span className="font-mono font-medium text-gray-700 dark:text-gray-200">
                  {result.shape.rows.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Columns:</span>{" "}
                <span className="font-mono font-medium text-gray-700 dark:text-gray-200">
                  {result.shape.cols.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Columns */}
        {result.columns.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-xs font-medium text-gray-500">Columns</p>
            <div className="flex flex-wrap gap-1">
              {result.columns.map((col: string) => (
                <span
                  key={col}
                  className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sample rows */}
        {result.sampleRows.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-xs font-medium text-gray-500">
              Preview (first {result.sampleRows.length} rows)
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <th className="px-2 py-1.5 text-left font-medium text-gray-500">#</th>
                    {Object.keys(result.sampleRows[0]).slice(0, 8).map((key) => (
                      <th
                        key={key}
                        className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-gray-500"
                      >
                        {key}
                      </th>
                    ))}
                    {Object.keys(result.sampleRows[0]).length > 8 && (
                      <th className="px-2 py-1.5 text-left font-medium text-gray-400">
                        +{Object.keys(result.sampleRows[0]).length - 8}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {result.sampleRows.map((row: Record<string, unknown>, idx: number) => (
                    <tr
                      key={idx}
                      className="border-t border-gray-100 dark:border-gray-800"
                    >
                      <td className="px-2 py-1 text-gray-400">{idx + 1}</td>
                      {Object.entries(row)
                        .slice(0, 8)
                        .map(([key, value]) => (
                          <td
                            key={key}
                            className="whitespace-nowrap px-2 py-1 font-mono text-gray-700 dark:text-gray-300"
                          >
                            {String(value).slice(0, 40)}
                            {String(value).length > 40 ? "..." : ""}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Metadata */}
        {result.metadata && Object.keys(result.metadata).length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">Metadata</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.entries(result.metadata).map(([key, value]) => (
                <div key={key} className="flex justify-between text-xs">
                  <dt className="text-gray-400">{key}</dt>
                  <dd className="font-mono text-gray-600 dark:text-gray-300">
                    {String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
