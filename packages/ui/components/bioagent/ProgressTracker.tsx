"use client";

// ============================================================
// @bioagent/ui — ProgressTracker
// ============================================================
// DAG progress vertical timeline showing workflow node execution.

import { useRef, useCallback } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { type WorkflowNodeState } from "@/hooks/useWorkflow";

gsap.registerPlugin(useGSAP);

interface ProgressTrackerProps {
  workflowRunId: string;
  nodes: WorkflowNodeState[];
  currentProgress: number;
  estimatedRemaining: string;
  onPause: () => void;
  onResume: () => void;
  onAbort: () => void;
}

const statusEmoji: Record<string, string> = {
  pending: "⏳",
  ready: "🔵",
  running: "🔄",
  completed: "✅",
  failed: "❌",
  warning: "⚠️",
  skipped: "⏭️",
  paused: "⏸️",
};

const statusColor: Record<string, string> = {
  pending: "bg-gray-200 dark:bg-gray-700",
  ready: "bg-blue-300 dark:bg-blue-600",
  running: "bg-blue-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
  skipped: "bg-gray-400",
  paused: "bg-amber-500",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

function getNodeDuration(
  startedAt: string | null,
  endedAt: string | null
): string {
  if (!startedAt) return "-";
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  return formatDuration(end - start);
}

function NodeItem({
  node,
  isLast,
  nodeRefFn,
}: {
  node: WorkflowNodeState;
  isLast: boolean;
  nodeRefFn: (nodeId: string, el: HTMLDivElement | null) => void;
}) {
  const dotRef = useRef<HTMLDivElement>(null);

  const setDotRef = useCallback(
    (el: HTMLDivElement | null) => {
      (dotRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      if (el) {
        // Animate completed dot bounce
        if (node.status === "completed") {
          gsap.fromTo(el, { scale: 0.8 }, { scale: 1.2, duration: 0.2, ease: "back.out", yoyo: true, repeat: 1 });
        }
      }
    },
    // Only run on mount / status change to completed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.nodeId]
  );

  // Running node pulse
  useGSAP(
    () => {
      if (node.status === "running" && dotRef.current) {
        gsap.to(dotRef.current, {
          scale: 1.05,
          duration: 1.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }
    },
    { dependencies: [node.status], scope: undefined }
  );

  return (
    <div
      ref={(el) => nodeRefFn(node.nodeId, el)}
      className="flex gap-3"
      style={{ willChange: "transform, opacity" }}
    >
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div
          ref={setDotRef}
          className={`h-5 w-5 rounded-full border-2 border-white dark:border-gray-800 ${statusColor[node.status]}`}
        />
        {!isLast && (
          <div
            className={`w-0.5 flex-1 ${
              node.status === "completed"
                ? "bg-green-400"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
          />
        )}
      </div>

      {/* Node content */}
      <div className={`pb-4 flex-1`}>
        <div className="flex items-center gap-2">
          <span className="text-sm">{statusEmoji[node.status] || "❓"}</span>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {node.skill}
          </span>
          <span
            className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${
              node.status === "completed"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                : node.status === "running"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : node.status === "failed"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            }`}
          >
            {node.status}
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
          <span>{getNodeDuration(node.startedAt, node.endedAt)}</span>
          {node.retryCount > 0 && (
            <span>Retries: {node.retryCount}</span>
          )}
          {node.status === "paused" && (
            <span className="text-amber-500">Checkpoint saved</span>
          )}
        </div>

        {node.error && (
          <p className="mt-1 text-xs text-red-500">{node.error}</p>
        )}
      </div>
    </div>
  );
}

export default function ProgressTracker({
  workflowRunId,
  nodes,
  currentProgress,
  estimatedRemaining,
  onPause,
  onResume,
  onAbort,
}: ProgressTrackerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const setNodeRef = useCallback(
    (nodeId: string, el: HTMLDivElement | null) => {
      if (el) {
        nodeRefs.current.set(nodeId, el);
      } else {
        nodeRefs.current.delete(nodeId);
      }
    },
    []
  );

  const prevNodesLengthRef = useRef(nodes.length);
  const prevCompletedIdsRef = useRef(new Set<string>());

  // GSAP: progress bar + node entry animations
  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Reduced motion fallback
      mm.add("(prefers-reduced-motion: reduce)", () => {
        // No animation for reduced-motion users
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Progress bar: scaleX
        gsap.to(barRef.current, {
          scaleX: currentProgress,
          duration: 0.6,
          ease: "power2.out",
          transformOrigin: "left center",
        });

        // New nodes entry animation
        if (nodes.length > prevNodesLengthRef.current) {
          const newNodeIds = nodes
            .slice(prevNodesLengthRef.current)
            .map((n) => n.nodeId);

          newNodeIds.forEach((id) => {
            const el = nodeRefs.current.get(id);
            if (el) {
              gsap.from(el, {
                autoAlpha: 0,
                x: -20,
                duration: 0.3,
                ease: "power2.out",
              });
            }
          });
        }

        // Completed node dot bounce
        const currentCompletedIds = new Set(
          nodes
            .filter((n) => n.status === "completed")
            .map((n) => n.nodeId)
        );
        currentCompletedIds.forEach((id) => {
          if (!prevCompletedIdsRef.current.has(id)) {
            // Newly completed node — find the dot inside
            const nodeEl = nodeRefs.current.get(id);
            if (nodeEl) {
              const dot = nodeEl.querySelector<HTMLDivElement>(
                "div.flex.flex-col.items-center > div.rounded-full"
              );
              if (dot) {
                gsap.fromTo(
                  dot,
                  { scale: 0.8 },
                  { scale: 1.2, duration: 0.2, ease: "back.out", yoyo: true, repeat: 1 }
                );
              }
            }
          }
        });

        prevNodesLengthRef.current = nodes.length;
        prevCompletedIdsRef.current = currentCompletedIds;
      });

      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [currentProgress, nodes.length] }
  );

  // Completeness percentage text
  const completedCount = nodes.filter(
    (n) => n.status === "completed" || n.status === "skipped"
  ).length;

  return (
    <div ref={containerRef} className="card">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Workflow Progress
          </h3>
          <p className="text-xs text-gray-400">
            Run: {workflowRunId.slice(0, 8)}...
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onPause}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-amber-600 dark:hover:bg-gray-700"
            title="Pause"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            onClick={onResume}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-green-600 dark:hover:bg-gray-700"
            title="Resume"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            onClick={onAbort}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"
            title="Abort"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">
            {completedCount} / {nodes.length} nodes
          </span>
          <span className="text-gray-400">
            Est. remaining: {estimatedRemaining}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            ref={barRef}
            className="h-full rounded-full bg-brand-600"
            style={{ transformOrigin: "left center", width: "100%", transform: `scaleX(${currentProgress})` }}
          />
        </div>
        <p className="mt-1 text-right text-xs text-gray-400">
          {Math.round(currentProgress * 100)}%
        </p>
      </div>

      {/* Node timeline */}
      <div className="relative">
        {nodes.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400">
            Waiting for workflow to start...
          </p>
        )}
        {nodes.map((node, idx) => (
          <NodeItem
            key={node.nodeId}
            node={node}
            isLast={idx === nodes.length - 1}
            nodeRefFn={setNodeRef}
          />
        ))}
      </div>

      {/* Run ID footer */}
      <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
        <p className="truncate text-xs text-gray-400 font-mono">
          Run ID: {workflowRunId}
        </p>
      </div>
    </div>
  );
}
