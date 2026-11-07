import { useEffect, useRef, useState } from "react";
import { overlayBox, regionPath } from "../lib/hotspot.js";

/* Image + overlay aligned to the letterboxed content box (inside the border). */
export default function HotspotStage({
  src, className = "", imgRef, children,
  onPointerDown, onPointerMove, onPointerUp, cursor,
}) {
  const wrapRef = useRef(null);
  const localImg = useRef(null);
  const img = imgRef || localImg;
  const [box, setBox] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const sync = () => {
    const el = img.current, wrap = wrapRef.current;
    setBox(overlayBox(el, wrap));
  };

  useEffect(() => {
    setBox({ left: 0, top: 0, width: 0, height: 0 });
    const el = img.current;
    const wrap = wrapRef.current;
    if (!el) return;
    const onLoad = () => sync();
    el.addEventListener("load", onLoad);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    ro?.observe(el);
    if (wrap) ro?.observe(wrap);
    if (el.complete && el.naturalWidth) sync();
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("load", onLoad);
      ro?.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [src]);

  return (
    <div
      className={`hotspot-stage ${className}`}
      ref={wrapRef}
      style={{ cursor: cursor || undefined }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <img ref={img} src={src} alt="" draggable={false} />
      <div className="hotspot-layer" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
        {children}
      </div>
    </div>
  );
}

export function RegionOverlay({ regions, mode = "author" }) {
  const list = Array.isArray(regions) ? regions : [];
  return (
    <svg className={`hotspot-svg ${mode}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {list.map((r, i) => {
        if (r.shape === "circle") {
          return <circle key={i} cx={r.x} cy={r.y} r={r.r} />;
        }
        if (r.shape === "rect") {
          return <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />;
        }
        const d = regionPath(r);
        return d ? <path key={i} d={d} /> : null;
      })}
    </svg>
  );
}

export function Pin({ x, y, ok, pending }) {
  let cls = "hotspot-click";
  if (pending) cls += " pending";
  else if (ok) cls += " ok";
  else cls += " bad";
  return <span className={cls} style={{ left: `${x}%`, top: `${y}%` }}>{pending ? "●" : (ok ? "✓" : "×")}</span>;
}
