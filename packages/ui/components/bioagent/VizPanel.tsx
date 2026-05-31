"use client";

// ============================================================
// @bioagent/ui — VizPanel
// ============================================================
// Tab-switching visualization panel (UMAP / Volcano / Heatmap / Dotplot / Violin).
// GSAP drives tab content crossfade and image load animation.

import { useState, useCallback, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

type VizType = "umap" | "volcano" | "heatmap" | "dotplot" | "violin";

interface VizPanelProps {
  visualizations: {
    type: VizType;
    url: string;
    metadata: Record<string, unknown>;
  }[];
  isLoading?: boolean;
  error?: string | null;
}

const vizLabels: Record<VizType, { label: string; icon: string }> = {
  umap: { label: "UMAP", icon: "🔵" },
  volcano: { label: "Volcano", icon: "🌋" },
  heatmap: { label: "Heatmap", icon: "🔥" },
  dotplot: { label: "Dotplot", icon: "🟢" },
  violin: { label: "Violin", icon: "🎻" },
};

const vizTabs: VizType[] = ["umap", "volcano", "heatmap", "dotplot", "violin"];

export default function VizPanel({
  visualizations,
  isLoading = false,
  error = null,
}: VizPanelProps) {
  const [activeTab, setActiveTab] = useState<VizType>("umap");

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const activeViz = visualizations.find((v) => v.type === activeTab);

  const hasViz = useCallback(
    (type: VizType) => visualizations.some((v) => v.type === type),
    [visualizations]
  );

  // GSAP: tab content crossfade on activeTab change
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: reduce)", () => {});
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (contentRef.current && activeViz) {
          gsap.fromTo(
            contentRef.current,
            { autoAlpha: 0, y: 10 },
            { autoAlpha: 1, y: 0, duration: 0.25, ease: "power2.out" }
          );
        }
      });
      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [activeTab] }
  );

  // GSAP: image load animation
  useGSAP(
    () => {
      if (!imgRef.current || !activeViz) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(imgRef.current, {
          autoAlpha: 0,
          scale: 0.95,
          duration: 0.4,
          ease: "power2.out",
        });
      });
      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [activeViz?.url] }
  );

  return (
    <div ref={containerRef} className="card">
      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
        Visualizations
      </h3>

      {/* Tab bar */}
      <div className="mb-3 flex border-b border-gray-200 dark:border-gray-700">
        {vizTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors
              ${
                activeTab === tab
                  ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }
              ${!hasViz(tab) && !isLoading ? "opacity-40" : ""}
            `}
          >
            <span>{vizLabels[tab].icon}</span>
            <span>{vizLabels[tab].label}</span>
            {hasViz(tab) && (
              <span className="ml-0.5 inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
            )}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="relative min-h-[200px] rounded-lg bg-gray-50 dark:bg-gray-900">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
              <p className="text-xs text-gray-400">Loading visualization...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {!isLoading && !error && activeViz && (
          <div ref={contentRef} className="p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={activeViz.url}
              alt={`${vizLabels[activeTab].label} visualization`}
              className="h-auto w-full rounded-lg"
            />
            {activeViz.metadata && Object.keys(activeViz.metadata).length > 0 && (
              <div className="mt-3 border-t border-gray-200 pt-2 dark:border-gray-700">
                <p className="mb-1 text-xs font-medium text-gray-500">Details</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {Object.entries(activeViz.metadata).map(([key, value]) => (
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
        )}

        {!isLoading && !error && !activeViz && (
          <div className="flex min-h-[200px] items-center justify-center">
            <p className="text-sm text-gray-400">
              No {vizLabels[activeTab].label} visualization available yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
