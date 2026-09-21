import { useEffect, useRef, useState } from "react";
import { eventToPct, normalizeHotspot, pointHitsHotspot } from "../lib/hotspot.js";
import HotspotStage, { Pin, RegionOverlay } from "./HotspotStage.jsx";

export default function HotspotPlayer({
  imageUrl, hotspot, lang, done, showCorrect, clicks = [],
  onCommit, disabled,
}) {
  const fa = lang === "fa";
  const hs = normalizeHotspot(hotspot);
  const imgRef = useRef(null);
  const tap = useRef(null);
  const busy = useRef(false);
  const doneRef = useRef(done);
  const [pending, setPending] = useState(null);
  const [zoomed, setZoomed] = useState(false);
  const confirmMode = hs.confirm !== false && !done;
  doneRef.current = done;

  useEffect(() => {
    setPending(null);
    busy.current = false;
    tap.current = null;
    setZoomed(false);
  }, [imageUrl, hotspot]);

  useEffect(() => {
    busy.current = false;
  }, [done, clicks.length]);

  const placePending = (e) => {
    const pt = eventToPct(e, imgRef.current);
    if (pt) setPending(pt);
    return pt;
  };

  const commit = (pt) => {
    if (!pt || busy.current || doneRef.current || disabled) return;
    busy.current = true;
    onCommit?.(pt, pointHitsHotspot(pt, hs));
  };

  const down = (e) => {
    if (done || disabled || busy.current) return;
    if (!imgRef.current) return;
    tap.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
    if (hs.confirm !== false) {
      placePending(e);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
  };

  const move = (e) => {
    if (!tap.current || tap.current.id !== e.pointerId) return;
    const dx = e.clientX - tap.current.x, dy = e.clientY - tap.current.y;
    if (dx * dx + dy * dy > 36) tap.current.moved = true;
    if (hs.confirm !== false && !done && !disabled) {
      if (tap.current.moved) e.preventDefault?.();
      placePending(e);
    }
  };

  const up = (e) => {
    if (!tap.current || (e.pointerId != null && tap.current.id !== e.pointerId)) return;
    const start = tap.current;
    tap.current = null;
    try { e.currentTarget?.releasePointerCapture?.(e.pointerId); } catch { /* */ }
    if (done || disabled || busy.current) return;
    if (hs.confirm !== false) return;
    if (start.moved) return;
    const pt = eventToPct(e, imgRef.current);
    if (pt) commit(pt);
  };

  useEffect(() => {
    const end = (e) => up(e);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  });

  const confirm = () => {
    if (!pending || busy.current || done) return;
    const pt = pending;
    setPending(null);
    commit(pt);
  };

  if (!imageUrl) {
    return <div className="ddle-banner bad">{fa ? "برای این سؤال تصویری هنوز تصویری ثبت نشده است." : "No image is set for this hotspot question."}</div>;
  }

  return (
    <div className="hotspot-box">
      <div className="small muted mb8">{fa ? "روی ساختار خواسته‌شده در تصویر بزنید." : "Tap the requested structure on the image."}</div>
      <HotspotStage
        src={imageUrl}
        imgRef={imgRef}
        className={`${done ? "done" : "placing"} ${zoomed ? "zoomed" : ""}`}
        cursor={done ? "default" : "crosshair"}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
      >
        {clicks.map((p, i) => <Pin key={`c${i}`} x={p.x} y={p.y} ok={!!p.ok} />)}
        {pending && !done && <Pin x={pending.x} y={pending.y} pending />}
        {done && showCorrect && <RegionOverlay regions={hs.regions} mode="reveal" />}
      </HotspotStage>
      <div className="hotspot-toolbar">
        <button type="button" className={`chip-btn ${zoomed ? "on" : ""}`} onClick={() => setZoomed((z) => !z)}>
          {fa ? (zoomed ? "اندازهٔ عادی" : "بزرگ‌نمایی تصویر") : (zoomed ? "Normal size" : "Enlarge image")}
        </button>
      </div>
      {confirmMode && (
        <div className="hotspot-confirm">
          <button type="button" className="btn btn-primary btn-block mt8" disabled={!pending} onClick={confirm}>
            {fa ? (pending ? "ثبت این نقطه" : "اول روی تصویر بزنید") : (pending ? "Confirm this pin" : "Tap the image first")}
          </button>
          {pending && <button type="button" className="btn btn-ghost btn-sm mt8" onClick={() => setPending(null)}>{fa ? "جابه‌جایی پین" : "Move pin"}</button>}
        </div>
      )}
      {done && (hs.label_fa || hs.label_en) && showCorrect && (
        <div className="small muted mt8">{fa ? "هدف:" : "Target:"} {fa ? (hs.label_fa || hs.label_en) : (hs.label_en || hs.label_fa)}</div>
      )}
      {!done && <div className="small muted mt8">{fa
        ? "محدودهٔ درست تا بعد از پاسخ دیده نمی‌شود. می‌توانید پین را بکشید و بعد ثبت کنید. صفحه را هم می‌توانید بالا و پایین ببرید."
        : "The accepted region stays hidden until after you answer. Drag the pin, then confirm. You can still scroll the page."}</div>}
    </div>
  );
}
