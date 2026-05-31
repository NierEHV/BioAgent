"use client";

// ============================================================
// @bioagent/ui — QCReportCard
// ============================================================
// Single Skill QC report card with overall badge and expandable gates.

import { useState } from "react";

export interface QCGateData {
  id: string;
  name: string;
  result: "pass" | "warn" | "fail";
  detail: string;
  suggestion?: string;
  canAutoFix: boolean;
}

interface QCReportCardProps {
  skillName: string;
  overall: "pass" | "warn" | "fail";
  gates: QCGateData[];
  onApplySuggestion: (gateId: string) => void;
  onIgnoreSuggestion: (gateId: string) => void;
  onCustomThreshold: (gateId: string, value: number) => void;
}

const overallBadge = {
  pass: {
    emoji: "✅",
    className: "badge-pass",
    label: "Pass",
  },
  warn: {
    emoji: "⚠️",
    className: "badge-warn",
    label: "Warning",
  },
  fail: {
    emoji: "❌",
    className: "badge-fail",
    label: "Fail",
  },
};

const gateEmoji = {
  pass: "✅",
  warn: "⚠️",
  fail: "❌",
};

const gateResultColor = {
  pass: "border-l-green-500 bg-green-50/50 dark:bg-green-900/10",
  warn: "border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/10",
  fail: "border-l-red-500 bg-red-50/50 dark:bg-red-900/10",
};

export default function QCReportCard({
  skillName,
  overall,
  gates,
  onApplySuggestion,
  onIgnoreSuggestion,
  onCustomThreshold,
}: QCReportCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [thresholdInputs, setThresholdInputs] = useState<
    Record<string, string>
  >({});

  const badge = overallBadge[overall];

  return (
    <div className="card animate-fade-in">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {skillName}
          </span>
          <span className={badge.className}>
            {badge.emoji} {badge.label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>
            {gates.filter((g) => g.result === "pass").length}/{gates.length} passed
          </span>
          <svg
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
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
        </div>
      </button>

      {/* Gate summary bar */}
      <div className="mt-2 flex gap-1">
        <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          {gates.length > 0 && (() => {
            const passCount = gates.filter((g) => g.result === "pass").length;
            const warnCount = gates.filter((g) => g.result === "warn").length;
            const failCount = gates.filter((g) => g.result === "fail").length;
            return (
              <>
                {passCount > 0 && (
                  <div
                    className="bg-green-500"
                    style={{
                      width: `${(passCount / gates.length) * 100}%`,
                    }}
                  />
                )}
                {warnCount > 0 && (
                  <div
                    className="bg-amber-500"
                    style={{
                      width: `${(warnCount / gates.length) * 100}%`,
                    }}
                  />
                )}
                {failCount > 0 && (
                  <div
                    className="bg-red-500"
                    style={{
                      width: `${(failCount / gates.length) * 100}%`,
                    }}
                  />
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Expanded gates */}
      {expanded && (
        <div className="mt-3 space-y-2">
          {gates.map((gate) => (
            <div
              key={gate.id}
              className={`rounded-lg border-l-4 p-3 ${gateResultColor[gate.result]}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{gateEmoji[gate.result]}</span>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {gate.name}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      gate.result === "pass"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : gate.result === "warn"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    }`}
                  >
                    {gate.result}
                  </span>
                </div>

                {gate.result !== "pass" && (
                  <div className="flex items-center gap-1">
                    {gate.canAutoFix && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onApplySuggestion(gate.id);
                        }}
                        className="rounded px-2 py-0.5 text-xs font-medium text-brand-600 hover:bg-brand-50
                                   dark:text-brand-400 dark:hover:bg-brand-900/20"
                      >
                        Auto-fix
                      </button>
                    )}
                    {gate.suggestion && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onIgnoreSuggestion(gate.id);
                        }}
                        className="rounded px-2 py-0.5 text-xs font-medium text-gray-500 hover:bg-gray-100
                                   dark:text-gray-400 dark:hover:bg-gray-700"
                      >
                        Ignore
                      </button>
                    )}
                  </div>
                )}
              </div>

              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {gate.detail}
              </p>

              {gate.suggestion && (
                <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">
                  💡 {gate.suggestion}
                </p>
              )}

              {/* Custom threshold input */}
              {gate.result === "warn" && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    Custom threshold:
                  </span>
                  <input
                    type="number"
                    className="w-20 rounded border border-gray-300 px-2 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-700"
                    placeholder="Value"
                    value={thresholdInputs[gate.id] || ""}
                    onChange={(e) =>
                      setThresholdInputs({
                        ...thresholdInputs,
                        [gate.id]: e.target.value,
                      })
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const val = parseFloat(thresholdInputs[gate.id]);
                      if (!isNaN(val)) {
                        onCustomThreshold(gate.id, val);
                      }
                    }}
                    className="rounded px-2 py-0.5 text-xs font-medium text-brand-600 hover:bg-brand-50
                               dark:text-brand-400 dark:hover:bg-brand-900/20"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
