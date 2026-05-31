"use client";

// ============================================================
// @bioagent/ui — ResourceMonitor
// ============================================================
// Real-time container/host resource monitoring (CPU / RAM / Disk).

import type { ResourceStatus } from "@/lib/bioagent-client";

interface ResourceMonitorProps {
  resources: ResourceStatus | null;
  isLoading?: boolean;
  error?: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function GaugeBar({
  label,
  used,
  total,
  percent,
  colorClass,
}: {
  label: string;
  used: number;
  total: number;
  percent: number;
  colorClass: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-gray-600 dark:text-gray-300">
          {label}
        </span>
        <span className="font-mono text-gray-400">
          {label === "CPU" ? `${percent.toFixed(1)}%` : `${formatBytes(used)} / ${formatBytes(total)}`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <p className="mt-0.5 text-right text-xs text-gray-400">
        {percent.toFixed(1)}%
      </p>
    </div>
  );
}

export default function ResourceMonitor({
  resources,
  isLoading = false,
  error = null,
}: ResourceMonitorProps) {
  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Resources
        </h3>
        {isLoading && (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {!isLoading && !error && !resources && (
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-gray-400">
            Resource monitoring not available
          </p>
        </div>
      )}

      {!isLoading && !error && resources && (
        <div className="space-y-4">
          {/* CPU */}
          <GaugeBar
            label="CPU"
            used={0}
            total={0}
            percent={resources.cpu.usage}
            colorClass={
              resources.cpu.usage > 80
                ? "bg-red-500"
                : resources.cpu.usage > 60
                  ? "bg-amber-500"
                  : "bg-green-500"
            }
          />
          <p className="-mt-3 text-xs text-gray-400">
            {resources.cpu.usage.toFixed(1)}% of {resources.cpu.cores} cores
          </p>

          {/* Memory */}
          <GaugeBar
            label="Memory"
            used={resources.memory.usedBytes}
            total={resources.memory.totalBytes}
            percent={resources.memory.usagePercent}
            colorClass={
              resources.memory.usagePercent > 80
                ? "bg-red-500"
                : resources.memory.usagePercent > 60
                  ? "bg-amber-500"
                  : "bg-green-500"
            }
          />

          {/* Disk */}
          <GaugeBar
            label="Disk"
            used={resources.disk.usedBytes}
            total={resources.disk.totalBytes}
            percent={resources.disk.usagePercent}
            colorClass={
              resources.disk.usagePercent > 85
                ? "bg-red-500"
                : resources.disk.usagePercent > 70
                  ? "bg-amber-500"
                  : "bg-green-500"
            }
          />

          {/* Containers */}
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">
                Containers
              </span>
              <span className="font-mono font-medium text-gray-700 dark:text-gray-200">
                {resources.containers.running} / {resources.containers.total} running
              </span>
            </div>
          </div>

          {/* Hostname */}
          <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
            <p className="text-xs text-gray-400 font-mono">
              Host: {resources.hostname}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
