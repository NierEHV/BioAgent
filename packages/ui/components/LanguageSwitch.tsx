"use client";

// ============================================================
// @bioagent/ui — LanguageSwitch (GSAP-animated zh↔en toggle)
// ============================================================

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useLanguage } from "@/hooks/useLanguage";

gsap.registerPlugin(useGSAP);

export default function LanguageSwitch() {
  const { lang, toggleLang } = useLanguage();
  const containerRef = useRef<HTMLButtonElement>(null);
  const zhRef = useRef<HTMLSpanElement>(null);
  const enRef = useRef<HTMLSpanElement>(null);

  // GSAP: animate indicator position + label crossfade on lang change
  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(zhRef.current, { autoAlpha: lang === "zh" ? 1 : 0 });
      gsap.set(enRef.current, { autoAlpha: lang === "en" ? 1 : 0 });
    });

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      if (lang === "zh") {
        // Switch to Chinese: EN fades out, 中 fades in
        gsap.to(enRef.current, { autoAlpha: 0, scale: 0.8, duration: 0.12, ease: "power2.in" });
        gsap.fromTo(zhRef.current, { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.25, ease: "back.out(1.7)", delay: 0.08 });
      } else {
        // Switch to English: 中 fades out, EN fades in
        gsap.to(zhRef.current, { autoAlpha: 0, scale: 0.8, duration: 0.12, ease: "power2.in" });
        gsap.fromTo(enRef.current, { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.25, ease: "back.out(1.7)", delay: 0.08 });
      }
    });

    return () => mm.revert();
  }, { scope: containerRef, dependencies: [lang] });

  // Button hover: gentle scale pulse
  useGSAP(() => {
    if (!containerRef.current) return;
    const btn = containerRef.current;

    const onEnter = () => gsap.to(btn, { scale: 1.05, duration: 0.2, ease: "power2.out" });
    const onLeave = () => gsap.to(btn, { scale: 1, duration: 0.2, ease: "power2.out" });

    btn.addEventListener("mouseenter", onEnter);
    btn.addEventListener("mouseleave", onLeave);

    return () => {
      btn.removeEventListener("mouseenter", onEnter);
      btn.removeEventListener("mouseleave", onLeave);
    };
  }, { scope: containerRef });

  const handleClick = () => {
    // Quick press animation
    if (containerRef.current) {
      gsap.fromTo(containerRef.current, { scale: 1 }, { scale: 0.92, duration: 0.08, yoyo: true, repeat: 1, ease: "power2.inOut" });
    }
    toggleLang();
  };

  return (
    <button
      ref={containerRef}
      type="button"
      onClick={handleClick}
      className="language-switch"
      title={lang === "zh" ? "Switch to English" : "切换到中文"}
      aria-label={lang === "zh" ? "Switch to English" : "切换到中文"}
    >
      <span ref={zhRef} className="lang-label" style={lang === "zh" ? activeStyle : inactiveStyle}>中</span>
      <span ref={enRef} className="lang-label" style={lang === "en" ? activeStyle : inactiveStyle}>EN</span>

      <style jsx>{`
        .language-switch {
          position: relative;
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 2px 4px;
          height: 28px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--bg-panel);
          cursor: pointer;
          flex-shrink: 0;
          will-change: transform;
        }
        .language-switch:hover {
          border-color: var(--accent);
        }
        .lang-label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 22px;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 600;
          line-height: 1;
          user-select: none;
          will-change: transform, opacity;
        }
      `}</style>
    </button>
  );
}

const activeStyle: React.CSSProperties = {
  color: "#fff",
  background: "var(--accent, #6366f1)",
};

const inactiveStyle: React.CSSProperties = {
  color: "var(--text-muted, #9ca3af)",
  background: "transparent",
};
