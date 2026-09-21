import { useState, useEffect, useRef, useCallback } from "react";

/* ================================================================
   VirtualList — tiny zero-dependency fixed-row windowing list.

   Renders only the rows intersecting the scroll viewport (plus an
   overscan band), so a leaderboard or answer feed with thousands of
   entries stays a few-dozen DOM nodes. Used in place of
   @tanstack/react-virtual to keep the offline bundle dependency-free;
   the API is intentionally a subset of that library's.

   Props:
     itemCount, itemHeight (px), children({index, style}),
     overscan? (default 8), className, style, maxHeight, onReachedEnd?
   ================================================================ */
export default function VirtualList({
  itemCount,
  itemHeight,
  children,
  overscan = 8,
  className = "",
  style,
  maxHeight = 460,
  onReachedEnd,
  innerRef,
}) {
  const ref = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(maxHeight);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setViewport(el.clientHeight || maxHeight);
    update();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxHeight]);

  const onScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
    if (onReachedEnd) {
      const el = e.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - itemHeight * 4) onReachedEnd();
    }
  }, [itemHeight, onReachedEnd]);

  const total = Math.max(0, itemCount) * itemHeight;
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visible = Math.ceil(viewport / itemHeight) + overscan * 2;
  const end = Math.min(itemCount, start + visible);
  const rows = [];
  for (let i = start; i < end; i++) {
    rows.push(children({ index: i, style: { position: "absolute", top: i * itemHeight, left: 0, right: 0, height: itemHeight } }));
  }
  return (
    <div ref={(el) => { ref.current = el; if (typeof innerRef === "function") innerRef(el); }}
      className={className}
      onScroll={onScroll}
      style={{ overflowY: "auto", WebkitOverflowScrolling: "touch", position: "relative", maxHeight, willChange: "transform", ...(style || {}) }}>
      <div style={{ height: total, position: "relative" }}>{rows}</div>
    </div>
  );
}
