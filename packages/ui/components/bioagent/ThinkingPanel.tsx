"use client";

// ============================================================
// @bioagent/ui — ThinkingPanel
// ============================================================
// 7-step thinking process collapsible accordion.
// Displays each section with title, content, and completion status.
// GSAP drives section entry stagger and completion pulse animations.

import { useState, useCallback, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

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
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionsListRef = useRef<HTMLDivElement>(null);
  const spinnerRef = useRef<HTMLDivElement>(null);
  const thinkingBadgeRef = useRef<HTMLSpanElement>(null);

  const [expandedSections, setExpandedSections] = useState<
    Set<number>
  >(new Set());

  const prevSectionsLenRef = useRef(sections.length);
  const prevCompletedRef = useRef<Set<number>>(new Set());

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

  // GSAP: section entry stagger on first display / new sections
  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {});

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (!sectionsListRef.current) return;

        // Section entry animation
        const sectionEls =
          sectionsListRef.current.querySelectorAll<HTMLDivElement>(
            "[data-thinking-section]"
          );

        if (sections.length > prevSectionsLenRef.current && sectionEls.length > 0) {
          // Animate only new sections
          const newCount = sections.length - prevSectionsLenRef.current;
          const newEls = Array.from(sectionEls).slice(-newCount);
          gsap.from(newEls, {
            autoAlpha: 0,
            y: 20,
            stagger: 0.08,
            duration: 0.35,
            ease: "power2.out",
          });
        } else if (sections.length > 0 && prevSectionsLenRef.current === 0) {
          // First time: animate all sections
          gsap.from(sectionEls, {
            autoAlpha: 0,
            y: 20,
            stagger: 0.08,
            duration: 0.35,
            ease: "power2.out",
          });
        }

        // Section completed pulse
        const currentCompleted = new Set(
          sections.filter((s) => s.completed).map((s) => s.index)
        );
        currentCompleted.forEach((idx) => {
          if (!prevCompletedRef.current.has(idx)) {
            // Newly completed section
            const el = sectionsListRef.current?.querySelector<HTMLDivElement>(
              `[data-thinking-section="${idx}"]`
            );
            if (el) {
              gsap.fromTo(
                el,
                { scale: 0 },
                { scale: 1, duration: 0.4, ease: "back.out(1.7)" }
              );
            }
          }
        });

        prevSectionsLenRef.current = sections.length;
        prevCompletedRef.current = currentCompleted;
      });

      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [sections.length] }
  );

  // GSAP: loading spinner pulse
  useGSAP(
    () => {
      if (!isThinking || !spinnerRef.current) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to(spinnerRef.current, {
          rotation: 360,
          duration: 1,
          repeat: -1,
          ease: "none",
        });
        gsap.to(spinnerRef.current, {
          scale: 1.15,
          duration: 0.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });
      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [isThinking] }
  );

  // GSAP: thinking badge pulse
  useGSAP(
    () => {
      if (!isThinking || !thinkingBadgeRef.current) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          thinkingBadgeRef.current,
          { autoAlpha: 0.6 },
          { autoAlpha: 1, duration: 1, repeat: -1, yoyo: true, ease: "sine.inOut" }
        );
      });
      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [isThinking] }
  );

  return (
    <div ref={containerRef} className="card">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          {isThinking && (
            <span
              ref={thinkingBadgeRef}
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
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
              className={`${
                section.completed
                  ? "bg-green-500"
                  : section.isLoading
                    ? "bg-blue-400"
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
          <div
            ref={spinnerRef}
            className="h-5 w-5 rounded-full border-2 border-gray-300 border-t-brand-600"
          />
          <p className="text-sm text-gray-400">Agent is thinking...</p>
        </div>
      )}

      <div ref={sectionsListRef} className="space-y-1">
        {sections.map((section) => (
          <div
            key={section.index}
            data-thinking-section={section.index}
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
              <div className="px-3 pb-3 pt-1">
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
