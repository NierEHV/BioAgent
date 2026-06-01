"use client";

import { useRef, useCallback } from "react";

interface ResizeHandleProps {
  /** "horizontal" | "vertical" */
  direction: "h" | "v";
  /** Called with delta (px) from drag start */
  onResize: (delta: number) => void;
  /** Called when drag ends */
  onResizeEnd?: () => void;
}

export function ResizeHandle({ direction, onResize, onResizeEnd }: ResizeHandleProps) {
  const startRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startRef.current = direction === "h" ? e.clientX : e.clientY;
      activeRef.current = true;

      const onMove = (ev: MouseEvent) => {
        if (!activeRef.current || startRef.current === null) return;
        const current = direction === "h" ? ev.clientX : ev.clientY;
        onResize(current - startRef.current);
      };

      const onUp = () => {
        activeRef.current = false;
        startRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        onResizeEnd?.();
      };

      document.body.style.cursor = direction === "h" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [direction, onResize, onResizeEnd],
  );

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        [direction === "h" ? "width" : "height"]: 4,
        [direction === "h" ? "height" : "width"]: "100%",
        cursor: direction === "h" ? "col-resize" : "row-resize",
        flexShrink: 0,
        background: "transparent",
        transition: "background 0.15s",
        zIndex: 10,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--accent)";
        e.currentTarget.style.opacity = "0.6";
      }}
      onMouseLeave={(e) => {
        if (!activeRef.current) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.opacity = "1";
        }
      }}
    />
  );
}
