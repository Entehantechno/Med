import { useEffect, useRef, useState } from "react";
import { eventToPct, normalizeHotspot } from "../lib/hotspot.js";
import HotspotStage, { RegionOverlay } from "./HotspotStage.jsx";

const emptyHs = () => ({
  shape: "circle", x: 50, y: 50, r: 10, w: 22, h: 16, points: [],
  label_fa: "", label_en: "", confirm: true, regions: [{ shape: "circle", x: 50, y: 50, r: 10 }],
});

export default function HotspotEditor({ imageUrl, value, onChange, lang }) {
  const fa = lang === "fa";
  const imgRef = useRef(null);
  const drag = useRef(null);
  const hs = normalizeHotspot(value || emptyHs());
  const [tool, setTool] = useState(hs.shape || "circle");
  const [draftPts, setDraftPts] = useState([]);
  const [adding, setAdding] = useState(false);

  const commit = (patch) => {
    const next = normalizeHotspot({ ...hs, ...patch });
    onChange(next);
  };

  const setRegions = (regions) => {
    const list = regions.length ? regions : [{ shape: "circle", x: 50, y: 50, r: 10 }];
    commit({ regions: list, shape: list[0].shape, ...list[0] });
  };

  const replaceOrPush = (region) => {
    const list = [...hs.regions];
    let idx = 0;
    if (adding && list.length) { list.push(region); idx = list.length - 1; }
    else { list[0] = region; idx = 0; }
    setRegions(list.slice(0, 6));
    return idx;
  };

  const down = (e) => {
    if (!imageUrl || !imgRef.current) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const pt = eventToPct(e, imgRef.current);
    if (!pt) return;
    if (tool === "polygon") {
      setDraftPts((p) => [...p, pt].slice(0, 24));
      return;
    }
    const region = tool === "circle"
      ? { shape: "circle", x: pt.x, y: pt.y, r: 4 }
      : { shape: "rect", x: pt.x, y: pt.y, w: 2, h: 2 };
    const idx = replaceOrPush(region);
    drag.current = { start: pt, tool, idx };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const move = (e) => {
    if (!drag.current || !imgRef.current) return;
    e.preventDefault();
    const pt = eventToPct(e, imgRef.current);
    if (!pt) return;
    const s = drag.current.start;
    const list = [...hs.regions];
    const idx = Math.min(drag.current.idx ?? 0, Math.max(0, list.length - 1));
    if (drag.current.tool === "circle") {
      const r = Math.max(2, Math.sqrt((pt.x - s.x) ** 2 + (pt.y - s.y) ** 2));
      list[idx] = { shape: "circle", x: s.x, y: s.y, r: Math.min(r, 50) };
    } else {
      const x = Math.min(s.x, pt.x), y = Math.min(s.y, pt.y);
      const w = Math.max(1, Math.abs(pt.x - s.x)), h = Math.max(1, Math.abs(pt.y - s.y));
      list[idx] = { shape: "rect", x, y, w, h };
    }
    setRegions(list);
  };

  const up = (e) => {
    if (!drag.current) return;
    drag.current = null;
    setAdding(false);
    try { e.currentTarget?.releasePointerCapture?.(e.pointerId); } catch { /* */ }
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

  const closePoly = () => {
    if (draftPts.length < 3) return;
    replaceOrPush({ shape: "polygon", points: draftPts });
    setAdding(false);
    setDraftPts([]);
  };

  const pickTool = (t) => {
    setTool(t);
    setDraftPts([]);
    setAdding(false);
  };

  const clearAll = () => {
    setDraftPts([]);
    setAdding(false);
    const fallback = tool === "rect"
      ? { shape: "rect", x: 40, y: 40, w: 22, h: 16 }
      : { shape: "circle", x: 50, y: 50, r: 10 };
    setRegions([fallback]);
  };

  const shown = [
    ...hs.regions,
    ...(tool === "polygon" && draftPts.length ? [{ shape: "polygon", points: draftPts }] : []),
  ];

  if (!imageUrl) {
    return <div className="small muted">{fa ? "اول تصویر سؤال را بارگذاری کنید، بعد محدودهٔ کلیک را روی آن بکشید." : "Upload the question image first, then draw the click region on it."}</div>;
  }

  return (
    <div className="hotspot-editor">
      <div className="small muted mb8">{fa
        ? "محدوده را روی تصویر بکشید (دانشجو آن را نمی‌بیند تا بعد از پاسخ). دایره و مستطیل با کشیدن؛ چندضلعی با چند کلیک و «بستن شکل». ساختارهای بافت/آناتومی معمولاً چندضلعی می‌خواهند."
        : "Draw the accepted region on the image (hidden from the learner until after they answer). Circle/rect = drag; polygon = click vertices then Close. Histology/anatomy structures usually need a polygon."}</div>
      <div className="drawing-toolbar" style={{ marginBottom: 8 }}>
        {[["circle", fa ? "دایره" : "Circle"], ["rect", fa ? "مستطیل" : "Rectangle"], ["polygon", fa ? "چندضلعی" : "Polygon"]].map(([id, lab]) => (
          <button type="button" key={id} className={`chip-btn ${tool === id ? "on" : ""}`} onClick={() => pickTool(id)}>{lab}</button>
        ))}
        {tool === "polygon" && (
          <>
            <button type="button" className="btn btn-sm btn-primary" disabled={draftPts.length < 3} onClick={closePoly}>{fa ? "بستن شکل" : "Close shape"}</button>
            <button type="button" className="btn btn-sm btn-ghost" disabled={!draftPts.length} onClick={() => setDraftPts((p) => p.slice(0, -1))}>{fa ? "برگشت رأس" : "Undo vertex"}</button>
          </>
        )}
        <button type="button" className={`chip-btn ${adding ? "on" : ""}`} onClick={() => { setAdding(true); setDraftPts([]); }}>{fa ? "+ محدودهٔ قابل‌قبول دیگر" : "+ Extra accepted region"}</button>
        <button type="button" className="btn btn-sm btn-danger" onClick={clearAll}>{fa ? "پاک کردن" : "Clear"}</button>
      </div>
      <HotspotStage
        src={imageUrl}
        imgRef={imgRef}
        className="hotspot-admin-preview author"
        cursor="crosshair"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
      >
        <RegionOverlay regions={shown} mode="author" />
        {draftPts.map((p, i) => <span key={i} className="hotspot-vertex" style={{ left: `${p.x}%`, top: `${p.y}%` }}>{i + 1}</span>)}
      </HotspotStage>
      <div className="small muted mt8">{fa
        ? `${hs.regions.length} محدودهٔ قابل‌قبول. ${adding ? "محدودهٔ بعدی را بکشید." : (tool === "polygon" ? "روی تصویر کلیک کنید تا رأس اضافه شود." : "کلیک کنید و بکشید.")}`
        : `${hs.regions.length} accepted region(s). ${adding ? "Draw the extra region." : (tool === "polygon" ? "Click to add vertices." : "Click and drag.")}`}</div>
      {hs.regions.length > 1 && (
        <div className="hotspot-region-list">
          {hs.regions.map((r, i) => (
            <span className="tag" key={i}>
              {i + 1}. {r.shape}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRegions(hs.regions.filter((_, j) => j !== i))}>✕</button>
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-2 mt8">
        <div className="field"><label>{fa ? "برچسب هدف (FA) — بعد از پاسخ" : "Target label FA — after answer"}</label>
          <input value={hs.label_fa || ""} onChange={(e) => commit({ label_fa: e.target.value })} placeholder={fa ? "مثلاً کپسول بومن" : "Bowman's capsule"} /></div>
        <div className="field"><label>{fa ? "برچسب هدف (EN) — بعد از پاسخ" : "Target label EN — after answer"}</label>
          <input value={hs.label_en || ""} onChange={(e) => commit({ label_en: e.target.value })} /></div>
      </div>
      <label className="toggle-row"><span>{fa ? "دانشجو اول پین بگذارد، بعد تأیید کند (پیشنهادی برای آزمون)" : "Learner places a pin, then confirms (recommended for exams)"}</span>
        <input type="checkbox" checked={hs.confirm !== false} onChange={(e) => commit({ confirm: e.target.checked })} /></label>
    </div>
  );
}
