import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioAgent — AI-Powered Bioinformatics",
  description:
    "Natural language-driven automated single-cell and multi-omics data analysis platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex h-screen flex-col overflow-hidden">{children}</body>
    </html>
  );
}
