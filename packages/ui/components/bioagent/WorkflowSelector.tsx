"use client";

// ============================================================
// @bioagent/ui — WorkflowSelector
// ============================================================
// Dropdown to select and start a workflow.
// GSAP drives dropdown open/close and list stagger entry.

import { useState, useEffect, useCallback, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { BioAgentClient } from "@/lib/bioagent-client";

gsap.registerPlugin(useGSAP);

export interface WorkflowInfo {
  name: string;
  description: string;
  version: string;
}

interface WorkflowSelectorProps {
  client: BioAgentClient | null;
  onSelect: (workflowName: string) => void;
  selected?: string;
  disabled?: boolean;
}

export default function WorkflowSelector({
  client,
  onSelect,
  selected,
  disabled = false,
}: WorkflowSelectorProps) {
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!client) return;

    setIsLoading(true);
    client
      .listWorkflows()
      .then((data) => {
        setWorkflows(data);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load workflows");
      })
      .finally(() => setIsLoading(false));
  }, [client]);

  const handleSelect = useCallback(
    (name: string) => {
      onSelect(name);
      setIsOpen(false);
    },
    [onSelect]
  );

  // GSAP: dropdown open/close animation
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: reduce)", () => {});
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (isOpen && dropdownRef.current) {
          // Stagger list items
          const items =
            dropdownRef.current.querySelectorAll<HTMLLIElement>("li");
          if (items.length > 0) {
            gsap.from(items, {
              autoAlpha: 0,
              y: 8,
              stagger: 0.04,
              duration: 0.25,
              ease: "power2.out",
            });
          }
        }
      });
      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [isOpen] }
  );

  const selectedWorkflow = workflows.find((w) => w.name === selected);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
        Workflow
      </label>
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm
                   hover:bg-gray-50 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500
                   disabled:cursor-not-allowed disabled:opacity-50
                   dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
      >
        {isLoading ? (
          <span className="text-gray-400">Loading workflows...</span>
        ) : selectedWorkflow ? (
          <span>
            <span className="font-medium">{selectedWorkflow.name}</span>
            <span className="ml-2 text-xs text-gray-400">
              v{selectedWorkflow.version}
            </span>
          </span>
        ) : (
          <span className="text-gray-400">Select a workflow</span>
        )}
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
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

      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}

      {isOpen && !disabled && (
        <div
          ref={dropdownRef}
          className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          <ul className="max-h-60 overflow-auto py-1">
            {workflows.length === 0 && !isLoading && (
              <li className="px-3 py-2 text-sm text-gray-400">No workflows available</li>
            )}
            {workflows.map((wf) => (
              <li key={wf.name}>
                <button
                  type="button"
                  onClick={() => handleSelect(wf.name)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700
                    ${selected === wf.name ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300" : "text-gray-700 dark:text-gray-200"}
                  `}
                >
                  <div className="font-medium">{wf.name}</div>
                  <div className="truncate text-xs text-gray-400">{wf.description}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
