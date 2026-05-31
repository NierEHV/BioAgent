// ============================================================
// @bioagent/ui — Root Layout
// ============================================================
// Three-column layout: Sidebar | Main Chat | Right Panel

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioAgent — AI-Powered Bioinformatics",
  description:
    "Natural language-driven automated single-cell and multi-omics data analysis platform. Upload your data, describe your analysis, and let the agent handle the rest.",
  keywords: [
    "bioinformatics",
    "single-cell",
    "scRNA-seq",
    "AI",
    "data analysis",
    "LLM",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex h-screen flex-col overflow-hidden bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        {/* Header */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                B
              </div>
              <span className="text-sm font-semibold tracking-tight">
                BioAgent
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Project
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Settings"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </header>

        {/* Main three-column area */}
        <main className="flex flex-1 overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
