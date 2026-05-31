import type { Metadata } from "next";
import { Noto_Sans_Mono } from "next/font/google";
import { LanguageProvider } from "@/hooks/useLanguage";
import "./globals.css";

const notoSansMono = Noto_Sans_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-noto-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BioAgent",
  description: "AI-Powered Bioinformatics Agent — 自然语言驱动的自动化生信分析平台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={notoSansMono.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("pi-theme");if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}})();`,
          }}
        />
      </head>
      <body style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
