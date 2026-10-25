import {flashcardLanguageFallback} from '../../../server/src/lib/flashcard-language.js';
import SearchAnswer from './SearchAnswer.jsx';
import { useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import HotspotPlayer from "./HotspotPlayer.jsx";
import { clickLeft, clickRight, leftOwnerOf, pairColor, pairIndexOfLeft } from "../lib/match-pairs.js";

/* Renders non-MCQ exam questions authored by teachers, working with the RAW
   flashcard data_json shape. Supported: truefalse | fill | match | order |
   drawing | stepwise | kf | puzzle | hotspot | compare. Reports correctness once via onGraded(isRight, detail).
   Drawing is deliberately teacher-reviewed: it is submitted as pending and its
   proposed score is not counted until the instructor approves it. */
function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
function norm(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }
const arr = (x) => Array.isArray(x) ? x : String(x || "").split(/[,\n]/).map((v) => v.trim()).filter(Boolean);
const stepLabel = (s, k, fa) => fa ? (s[`${k}_fa`] || s[k] || "") : (s[`${k}_en`] || s[k] || "");

function LocalHints({ hints, showHints, fa }) {
  const [n, setN] = useState(0);
  const list = Array.isArray(hints) ? hints : [];
  if (!showHints || !list.length) return null;
  return <div className="local-hints">
    {Array.from({ length: n }).map((_, i) => <div className="ddle-question ddle-hint" key={i}><b>{fa ? "هینت" : "Hint"} {i + 1}:</b> {typeof list[i] === "object" ? (list[i].text || list[i].label || "") : String(list[i] || "")}</div>)}
    {n < list.length && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setN((x) => x + 1)}>💡 {fa ? "نمایش هینت" : "Show hint"}</button>}
  </div>;
}

export default function ExamOtherType({ card, lang, done, showCorrect, showHints = true, hints = [], onGraded, editing = false }) {
  card=useMemo(()=>flashcardLanguageFallback(card),[card]);
  const { t } = useApp();
  const [sel, setSel] = useState(card.type === "match" ? { pairs: {}, activeLeft: null } : card.type === "order" ? [] : null);
  const [checked, setChecked] = useState(false);
  // "Change answer" (R60): the parent sets editing=true to reopen a graded card
  // with the student's previous answer still in place. Leaving edit mode either
  // follows a fresh grade (which already set checked) or cancels — both end in
  // the locked view, so one effect covers both paths.
  const wasEditing = useRef(false);
  useEffect(() => {
    if (editing) { wasEditing.current = true; setChecked(false); }
    else if (wasEditing.current) { wasEditing.current = false; setChecked(true); }
  }, [editing]);
  const [right, setRight] = useState(false);
  const [reveal, setReveal] = useState(null);
  const [gradeErr, setGradeErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fa = lang === "fa";

  const pairs = card.pairs || [];
  const left = useMemo(() => {
    if (Array.isArray(card.matchLeft) && card.matchLeft.length) {
      return card.matchLeft.map((x) => ({ id: x.id, text: fa ? x.fa : x.en }));
    }
    return pairs.map((p, i) => ({ id: i, text: fa ? p[0] : p[1] }));
  }, [card.id, fa]);
  const rightCol = useMemo(() => {
    if (Array.isArray(card.matchRight) && card.matchRight.length) {
      return card.matchRight.map((x) => ({ id: x.id, text: fa ? x.fa : x.en }));
    }
    return shuffle(pairs.map((p, i) => ({ id: i, text: fa ? p[2] : p[3] })));
  }, [card.id, fa]);
  const orderItems = fa ? (card.items_fa || []) : (card.items_en || []);
  const orderPool = useMemo(() => {
    const bank = fa ? card.orderBank_fa : card.orderBank_en;
    if (Array.isArray(bank) && bank.length) return bank.map((x) => ({ id: x.id, text: x.text }));
    return shuffle(orderItems.map((text, i) => ({ id: i, text })));
  }, [card.id, fa]);
  const orderCount = orderPool.length || orderItems.length;

  const canCheck = () => {
    if (card.type === "truefalse") return sel != null;
    if (card.type === "fill") return !!(sel && String(sel).trim());
    if (card.type === "match") return sel && Object.keys(sel.pairs || {}).length === left.length;
    if (card.type === "order") return (sel || []).length === orderCount;
    return false;
  };
  const check = async () => {
    if (busy) return;
    setBusy(true); setGradeErr("");
    try {
      const payload = { cardId: card.id, type: card.type, reveal: !!showCorrect, lang };
      if (card.type === "truefalse") payload.value = sel;
      else if (card.type === "fill") payload.text = sel;
      else if (card.type === "match") payload.pairs = sel?.pairs || {};
      else if (card.type === "order") payload.order = (sel || []).map((c) => c.id);
      const r = await api.post("/flashcards/check", payload, { timeoutMs: 15000, stage: "evaluate" });
      setRight(!!r.ok); setChecked(true); setReveal(r.reveal || null);
      onGraded(!!r.ok, { answer: sel, pointsFrac: r.pointsFrac == null ? (r.ok ? 1 : 0) : r.pointsFrac });
    } catch (e) {
      setGradeErr(String(e.message || e));
    } finally { setBusy(false); }
  };

  if (card.type === "drawing") return <DrawingQuestion card={card} lang={lang} checked={checked} setChecked={setChecked} onGraded={onGraded} hints={hints} showHints={showHints} />;
  if (card.type === "stepwise") return <StepwiseQuestion card={card} lang={lang} showCorrect={showCorrect} checked={checked} setChecked={setChecked} onGraded={onGraded} hints={hints} showHints={showHints} />;
  if (card.type === "kf") return <KfQuestion card={card} lang={lang} showCorrect={showCorrect} checked={checked} setChecked={setChecked} onGraded={onGraded} hints={hints} showHints={showHints} />;
  if (card.type === "puzzle") return <PuzzleQuestion card={card} lang={lang} showCorrect={showCorrect} checked={checked} setChecked={setChecked} onGraded={onGraded} hints={hints} showHints={showHints} />;
  if (card.type === "compare") return <CompareQuestion card={card} lang={lang} showCorrect={showCorrect} checked={checked} setChecked={setChecked} onGraded={onGraded} hints={hints} showHints={showHints} />;
  if (card.type === "hotspot") return <HotspotExam card={card} lang={lang} showCorrect={showCorrect} checked={checked} setChecked={setChecked} onGraded={onGraded} hints={hints} showHints={showHints} />;

  return (
    <div>
      <LocalHints hints={hints} showHints={showHints && !checked} fa={fa} />
      {card.type === "truefalse" && (
        <div className="mc-options">
          {[{ v: true, l: fa ? "درست" : "True" }, { v: false, l: fa ? "نادرست" : "False" }].map((o) => {
            let cls = "mc-opt";
            if (checked) { if (o.v === !!(reveal?.answer ?? card.answer)) cls += " correct"; else if (o.v === sel) cls += " wrong"; }
            else if (o.v === sel) cls += " sel";
            return <button type="button" key={String(o.v)} className={cls} disabled={checked} onClick={() => setSel(o.v)}>{o.l}</button>;
          })}
        </div>
      )}
      {card.type === "fill" && (
        <div>
          {card.answerMode==='search'&&card.options_fa?.length?<><SearchAnswer options={card.options_fa.map((fa,i)=>({fa,en:card.options_en?.[i]||fa}))} lang={lang} disabled={checked} onPick={i=>setSel((fa?card.options_fa:card.options_en)[i])}/>{sel&&<p role="status">{fa?'پاسخ انتخاب‌شده: ':'Selected answer: '}{sel}</p>}</>:<input className="fill-input" value={sel || ""} disabled={checked} placeholder={fa ? "پاسخ را تایپ کنید…" : "Type your answer…"} onChange={(e) => setSel(e.target.value)} />}
          {checked && !right && showCorrect && <div className="small mt8" style={{ color: "var(--danger)" }}>{fa ? "پاسخ درست" : "Answer"}: {fa ? (reveal?.fa || card.blank_fa) : (reveal?.en || card.blank_en)}</div>}
        </div>
      )}
      {card.type === "match" && (
        <div>
          <div className="small muted mb8">{fa
            ? "یک مورد سمت چپ و سپس مورد راست مربوط به آن را بزنید. برای تغییر اتصال، روی همان مورد سمت چپ بزنید و دوباره جفت کنید. رنگ هر جفت یکسان است."
            : "Tap a left item, then its match on the right. To change a link, tap the left item again and re-pair. Each pair shares one colour."}</div>
          <div className="match-grid">
            <div className="match-col">{left.map((l, i) => {
              const linked = sel?.pairs?.[l.id] != null;
              const c = linked ? pairColor(i) : null;
              let cls = "opt match-item";
              if (sel?.activeLeft === l.id) cls += " sel";
              if (linked && !checked) cls += " connected";
              if (checked) cls += right ? " ok" : " bad";
              return <button type="button" key={l.id} className={cls} disabled={checked}
                style={c && !checked ? { borderColor: c, background: `${c}1f`, boxShadow: `inset 4px 0 0 ${c}` } : undefined}
                aria-pressed={sel?.activeLeft === l.id} onClick={() => setSel((s) => clickLeft(s, l.id))}>
                {linked && !checked && <span className="pair-no" style={{ background: c }}>{i + 1}</span>}
                {l.text}
              </button>;
            })}</div>
            <div className="match-col">{rightCol.map((rr) => {
              const owner = leftOwnerOf(sel, rr.id);
              const linked = owner != null;
              const c = linked ? pairColor(pairIndexOfLeft(left.map((x) => x.id), owner)) : null;
              let cls = "opt match-item";
              if (linked && !checked) cls += " connected";
              return <button type="button" key={rr.id} className={cls} disabled={checked}
                style={c && !checked ? { borderColor: c, background: `${c}1f`, boxShadow: `inset 4px 0 0 ${c}` } : undefined}
                onClick={() => setSel((s) => clickRight(s, rr.id))}>
                {linked && !checked && <span className="pair-no" style={{ background: c }}>{pairIndexOfLeft(left.map((x) => x.id), owner) + 1}</span>}
                {rr.text}
              </button>;
            })}</div>
          </div>
        </div>
      )}
      {card.type === "order" && (
        <div>
          <div className="order-slots">{(sel || []).map((c, i) => <span key={c.id} className={`chip order-chip ${checked ? (right ? "ok" : "bad") : ""}`}>{i + 1}. {c.text}</span>)}{!checked && (sel || []).length > 0 && <button type="button" className="chip order-undo" onClick={() => setSel((s) => s.slice(0, -1))}>↩</button>}</div>
          <div className="order-pool">{orderPool.map((it) => { const usedIt = (sel || []).find((c) => c.id === it.id); return <button type="button" key={it.id} className="opt order-word" disabled={checked || !!usedIt} style={{ opacity: usedIt ? .35 : 1 }} onClick={() => setSel((s) => [...(s || []), it])}>{it.text}</button>; })}</div>
        </div>
      )}
      {gradeErr && <div className="ddle-banner bad" style={{ marginTop: 12 }}>{gradeErr}</div>}
      {checked && <div className={`ddle-banner ${right ? "ok" : "bad"}`} style={{ marginTop: 12 }}>{right ? `✓ ${t("correct")}` : t("incorrect")}</div>}
      {!checked && <button type="button" className="btn btn-primary btn-block mt16" disabled={!canCheck() || busy} onClick={check}>{t("checkAns") || t("send")}</button>}
    </div>
  );
}

function DrawingQuestion({ card, lang, checked, setChecked, onGraded, hints, showHints }) {
  const fa = lang === "fa";
  /* Two stacked layers (R60).
     - baseRef: background + the traced reference image. Painted once, never edited.
     - inkRef:  transparent. The pen, highlighter, shapes AND the eraser all paint
       here, so the eraser (destination-out) removes only the student's own ink,
       never the reference or the background. Undo/redo snapshots hold ink only. */
  const baseRef = useRef(null);
  const inkRef = useRef(null);
  const wrapRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef(null);
  const shapeStart = useRef(null);
  const [strokeCount, setStrokeCount] = useState(0);   // ink strokes only; eraser strokes do not count
  const [history, setHistory] = useState([]);          // undo steps: { src, strokes, labels }
  const [redoStack, setRedoStack] = useState([]);
  const [rubricDone, setRubricDone] = useState({});
  const drawing = card.drawing || {};
  const [brush, setBrush] = useState({
    color: drawing.background === "dark" ? "#f8fafc" : "#111827",
    size: 3, tool: "pen", grid: !!drawing.gridDefault,
  });
  const [labels, setLabels] = useState([]);
  const rubric = (fa ? (drawing.rubric_fa || []) : (drawing.rubric_en || [])).filter(Boolean);
  const prompt = (fa ? drawing.prompt_fa : drawing.prompt_en) || (fa ? card.questionText_fa : card.questionText_en) || "";
  const bg = drawing.background === "dark" ? "#111827" : drawing.background === "cream" ? "#f6f1e7" : "#ffffff";
  const minStrokes = Math.max(1, Number(drawing.minStrokes) || 1);
  const ratio = ({ "16:9": 9 / 16, "4:3": 3 / 4, "1:1": 1, "3:4": 4 / 3 }[drawing.aspect] || 0.62);

  const cssSize = () => {
    const c = inkRef.current; if (!c) return { w: 0, h: 0 };
    const r = c.getBoundingClientRect(); return { w: r.width, h: r.height };
  };

  /* ---- ink mask for the teacher's advisory coverage score ----
     Reads the ink layer's alpha only. The base layer is never part of the mask,
     so the traced slide cannot count as drawing. */
  const MASK_W = 32;
  const maskDims = () => ({ w: MASK_W, h: Math.max(12, Math.round(MASK_W * ratio)) });
  const maskCanvasRef = useRef(null);
  const packInkMask = () => {
    const ink = inkRef.current; if (!ink) return null;
    const { w, h } = maskDims();
    let off = maskCanvasRef.current;
    if (!off) { off = document.createElement("canvas"); maskCanvasRef.current = off; }
    off.width = w; off.height = h;
    const ctx = off.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, w, h);
    let px;
    try { ctx.drawImage(ink, 0, 0, w, h); px = ctx.getImageData(0, 0, w, h).data; }
    catch { return null; }
    const bytes = new Uint8Array(Math.ceil((w * h) / 8));
    for (let i = 0; i < w * h; i++) if (px[i * 4 + 3] > 20) bytes[i >> 3] |= 1 << (7 - (i & 7));
    let bin = "";
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    let data = "";
    try { data = btoa(bin); } catch { data = ""; }
    return data ? { w, h, data } : null;
  };

  // Ink-only snapshot of the current step (undo/redo never touches the base layer).
  const pushHistory = (strokes, nextLabels) => {
    const ink = inkRef.current; if (!ink) return;
    setHistory((h) => [...h.slice(-12), { src: ink.toDataURL("image/png"), strokes, labels: nextLabels }]);
    setRedoStack([]);
  };
  // Replace the ink layer with a snapshot (null = blank). Sync clear, async draw.
  const paintInk = (src) => {
    const ink = inkRef.current; if (!ink) return;
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = cssSize();
    const apply = (img) => {
      const c = inkRef.current; if (!c) return;
      const cx = c.getContext("2d");
      cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, c.width, c.height); cx.scale(dpr, dpr);
      if (img) cx.drawImage(img, 0, 0, w, h);
    };
    if (!src) return apply(null);
    const img = new Image();
    img.onload = () => apply(img);
    img.src = src;
  };
  const paintBase = (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    if (drawing.traceReference && drawing.referenceImageUrl) {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(w / img.width, h / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.globalAlpha = 0.92;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        ctx.globalAlpha = 1;
      };
      img.src = drawing.referenceImageUrl;
    }
  };

  useEffect(() => {
    const base = baseRef.current, ink = inkRef.current; if (!base || !ink) return;
    const cssW = Math.min(760, Math.max(300, wrapRef.current?.clientWidth || base.parentElement?.clientWidth || 520));
    const cssH = Math.round(cssW * ratio), dpr = window.devicePixelRatio || 1;
    for (const c of [base, ink]) { c.width = cssW * dpr; c.height = cssH * dpr; c.style.height = `${cssH}px`; }
    const bctx = base.getContext("2d"); bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.scale(dpr, dpr);
    paintBase(bctx, cssW, cssH);
    const ictx = ink.getContext("2d"); ictx.setTransform(1, 0, 0, 1, 0, 0); ictx.scale(dpr, dpr);
    ictx.lineCap = "round"; ictx.lineJoin = "round";
    setHistory([{ src: null, strokes: 0, labels: [] }]);
    setRedoStack([]); setStrokeCount(0); setLabels([]);
  }, [card.id]);

  const pos = (e) => { const c = inkRef.current, r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const strokeStyle = (ctx) => {
    const tool = brush.tool;
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.globalAlpha = tool === "highlighter" ? 0.32 : 1;
    ctx.strokeStyle = tool === "eraser" ? "rgba(0,0,0,1)" : brush.color;
    ctx.lineWidth = tool === "eraser" ? brush.size * 3 : tool === "highlighter" ? brush.size * 4 : brush.size;
  };
  const drawFree = (from, to) => {
    const ctx = inkRef.current.getContext("2d"); strokeStyle(ctx);
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  };
  const commitShape = (from, to) => {
    const ctx = inkRef.current.getContext("2d"); strokeStyle(ctx);
    if (brush.tool === "line") { ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke(); }
    else if (brush.tool === "rect") { ctx.strokeRect(Math.min(from.x, to.x), Math.min(from.y, to.y), Math.abs(to.x - from.x), Math.abs(to.y - from.y)); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  };
  const down = (e) => {
    if (checked) return; e.preventDefault();
    const p = pos(e);
    if (brush.tool === "label") {
      const { w, h } = cssSize();
      const nl = [...labels, { x: (p.x / w) * 100, y: (p.y / h) * 100, text: String(labels.length + 1) }];
      setLabels(nl); setStrokeCount((n) => n + 1);
      pushHistory(strokeCount + 1, nl);
      return;
    }
    drawingRef.current = true; lastRef.current = p; shapeStart.current = p;
    inkRef.current.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!drawingRef.current || checked) return; e.preventDefault();
    if (brush.tool === "line" || brush.tool === "rect" || brush.tool === "label") return;
    const p = pos(e); drawFree(lastRef.current, p); lastRef.current = p;
  };
  const up = (e) => {
    if (!drawingRef.current) return; drawingRef.current = false;
    if (brush.tool === "line" || brush.tool === "rect") commitShape(shapeStart.current, pos(e));
    const isEraser = brush.tool === "eraser";
    const strokes = isEraser ? strokeCount : strokeCount + 1;
    if (!isEraser) setStrokeCount(strokes);
    pushHistory(strokes, labels);
    try { inkRef.current.releasePointerCapture?.(e.pointerId); } catch { /* */ }
  };
  const clear = () => {
    paintInk(null);
    setStrokeCount(0); setLabels([]); setRedoStack([]);
    setHistory([{ src: null, strokes: 0, labels: [] }]);
  };
  const undo = () => {
    if (history.length <= 1) return;
    const cur = history[history.length - 1], prev = history[history.length - 2];
    setRedoStack((r) => [cur, ...r].slice(0, 12));
    setHistory(history.slice(0, -1));
    paintInk(prev.src); setStrokeCount(prev.strokes); setLabels(prev.labels);
  };
  const redoStroke = () => {
    if (!redoStack.length) return;
    const [first, ...rest] = redoStack;
    setRedoStack(rest); setHistory((h) => [...h, first]);
    paintInk(first.src); setStrokeCount(first.strokes); setLabels(first.labels);
  };
  // Preview = base + ink. A cross-origin reference image taints the canvas; then no preview.
  const compositePreview = () => {
    const base = baseRef.current, ink = inkRef.current; if (!base || !ink) return "";
    try {
      const off = document.createElement("canvas");
      off.width = base.width; off.height = base.height;
      const ctx = off.getContext("2d");
      ctx.drawImage(base, 0, 0); ctx.drawImage(ink, 0, 0);
      return off.toDataURL("image/jpeg", 0.55);
    } catch { return ""; }
  };
  const finish = () => {
    const checkedCount = Object.values(rubricDone).filter(Boolean).length;
    const total = rubric.length || 1;
    const pointsFrac = rubric.length ? checkedCount / total : (strokeCount > 0 ? 1 : 0);
    const preview = compositePreview();
    // The ink mask exists only for the teacher's optional score assist; when the
    // teacher switched it off (plain canvas + manual review), don't send it.
    const mask = drawing.assistEnabled === false ? null : packInkMask();
    setChecked(true);
    onGraded(true, { requiresApproval: true, pointsFrac, drawing: { strokeCount, labels, rubricChecked: checkedCount, rubricTotal: rubric.length, pointsFrac, preview, ...(mask ? { mask } : {}), approval: { status: "pending" } } });
  };
  const tools = [
    ["pen", fa ? "قلم" : "Pen"],
    ["highlighter", fa ? "هایلایت" : "Highlight"],
    ["line", fa ? "خط" : "Line"],
    ["rect", fa ? "مستطیل" : "Rect"],
    ["label", fa ? "برچسب" : "Label"],
    ["eraser", fa ? "پاک‌کن" : "Eraser"],
  ];
  return <div className="drawing-q pro-drawing">
    <div className="ddle-question ddle-hint"><b>{fa ? "تکلیف نقاشی:" : "Drawing task:"}</b> {prompt}</div>
    <LocalHints hints={hints} showHints={showHints && !checked} fa={fa} />
    {drawing.referenceImageUrl && !drawing.traceReference && <div className="drawing-ref"><img src={drawing.referenceImageUrl} alt="" /></div>}
    <div className="drawing-toolbar">
      {tools.map(([id, lab]) => <button key={id} type="button" className={`chip-btn ${brush.tool === id ? "on" : ""}`} onClick={() => setBrush((b) => ({ ...b, tool: id }))} disabled={checked}>{lab}</button>)}
      {["#111827", "#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#ffffff"].map((c) => <button key={c} type="button" aria-label={c} className={`draw-color ${brush.color === c ? "on" : ""}`} style={{ background: c }} onClick={() => setBrush((b) => ({ ...b, color: c, tool: b.tool === "eraser" ? "pen" : b.tool }))} disabled={checked} />)}
      <label className="small muted">{fa ? "ضخامت" : "Size"}<input type="range" min="2" max="16" value={brush.size} onChange={(e) => setBrush((b) => ({ ...b, size: +e.target.value }))} disabled={checked} /></label>
      <button type="button" className={`chip-btn ${brush.grid ? "on" : ""}`} onClick={() => setBrush((b) => ({ ...b, grid: !b.grid }))} disabled={checked}>{fa ? "شبکه" : "Grid"}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={undo} disabled={checked || history.length <= 1}>{fa ? "برگشت" : "Undo"}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={redoStroke} disabled={checked || !redoStack.length}>{fa ? "دوباره" : "Redo"}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={clear} disabled={checked}>{fa ? "پاک کردن همه" : "Clear all"}</button>
    </div>
    <div className="drawing-stage" ref={wrapRef}>
      <canvas ref={baseRef} className="drawing-canvas drawing-base" style={{ background: bg }} aria-hidden="true" />
      <canvas ref={inkRef} className="drawing-canvas drawing-ink" style={{ background: "transparent" }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} aria-label={fa ? "بوم نقاشی پاسخ" : "Drawing answer canvas"} />
      {brush.grid && <div className="drawing-grid-overlay" aria-hidden="true" />}
      {labels.map((lb, i) => <span key={i} className="draw-label" style={{ left: `${lb.x}%`, top: `${lb.y}%` }}>{lb.text}</span>)}
    </div>
    {rubric.length > 0 && <div className="drawing-rubric"><div className="small muted">{fa ? "پس از کشیدن، معیارهایی را که رعایت کرده‌اید علامت بزنید. نمره نهایی بعد از تأیید استاد ثبت می‌شود." : "Check the criteria you met. Final score is recorded after teacher approval."}</div>{rubric.map((r, i) => <label className="toggle-row" key={i}><span>{r}</span><input type="checkbox" checked={!!rubricDone[i]} disabled={checked} onChange={(e) => setRubricDone((s) => ({ ...s, [i]: e.target.checked }))} /></label>)}</div>}
    {checked ? <div className="ddle-banner ok">✓ {fa ? "نقاشی ثبت شد و در انتظار تأیید استاد است" : "Drawing submitted and pending teacher approval"}</div> : <button type="button" className="btn btn-primary btn-block mt16" disabled={strokeCount < minStrokes} onClick={finish}>{fa ? "ثبت نقاشی برای بررسی استاد" : "Submit for teacher review"}</button>}
  </div>;
}

function StepwiseQuestion({ card, lang, showCorrect, checked, setChecked, onGraded, hints, showHints }) {
  const { t } = useApp();
  const fa = lang === "fa";
  const steps = card.steps || [];
  const mediaUrl = card.media?.url || card.image || card.imageUrl || null;
  const [answers, setAnswers] = useState({});
  const [stepResults, setStepResults] = useState(null);
  const renderInput = (s, i) => {
    const type = s.answerType || s.type || "autocomplete";
    if (type === "truefalse") return <div className="mc-options compact"><button type="button" className={`mc-opt ${answers[i] === "true" ? "sel" : ""}`} disabled={checked} onClick={() => setAnswers((a)=>({...a,[i]:"true"}))}>{fa ? "درست" : "True"}</button><button type="button" className={`mc-opt ${answers[i] === "false" ? "sel" : ""}`} disabled={checked} onClick={() => setAnswers((a)=>({...a,[i]:"false"}))}>{fa ? "نادرست" : "False"}</button></div>;
    if (type === "mcq" || type === "autocomplete") return <StepChoiceInput step={s} lang={lang} value={answers[i] || ""} disabled={checked} onChange={value=>setAnswers(a=>({...a,[i]:value}))} />;
    return <textarea rows="2" value={answers[i] || ""} disabled={checked} onChange={(e)=>setAnswers((a)=>({...a,[i]:e.target.value}))} placeholder={fa ? "پاسخ این مرحله…" : "Answer this step…"}/>;
  };
  const canCheck = steps.length && steps.every((_, i) => String(answers[i] || "").trim());
  const [gradeErr, setGradeErr] = useState("");
  const [busy, setBusy] = useState(false);
  const finish = async () => {
    if (busy) return;
    setBusy(true); setGradeErr("");
    try {
      const payloadAnswers = {};
      steps.forEach((_, i) => { payloadAnswers[i] = answers[i]; });
      const r = await api.post("/flashcards/check", { cardId: card.id, type: "stepwise", answers: payloadAnswers, lang, reveal: !!showCorrect }, { timeoutMs: 15000, stage: "evaluate" });
      const res = (r.stepResults || []).map((row, i) => {
        const s = steps[i] || {};
        return { index: row.index || i + 1, prompt: stepLabel(s, "prompt", fa), answer: answers[i] || "", correct: !!row.correct, expected: row.expected || "", answerType: s.answerType || s.type || "autocomplete" };
      });
      setStepResults(res); setChecked(true); onGraded(!!r.ok, { stepResults: res, pointsFrac: r.pointsFrac == null ? 0 : r.pointsFrac });
    } catch (e) { setGradeErr(String(e.message || e)); }
    finally { setBusy(false); }
  };
  return <div className="stepwise-q">
    {mediaUrl && <div className="stepwise-media" style={{ marginBottom: 14, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}><img src={mediaUrl} alt="" style={{ width: "100%", display: "block", maxHeight: 320, objectFit: "contain", background: "#fff" }} /></div>}
    <LocalHints hints={hints} showHints={showHints && !checked} fa={fa} />
    {steps.length === 0 ? <div className="ddle-banner bad">{fa ? "برای این سؤال مرحله‌ای هنوز مرحله‌ای ثبت نشده است." : "No steps are configured for this stepwise question."}</div> : steps.map((s, i) => {
      const res = stepResults?.[i];
      return <div key={i} className={`step-card ${res ? (res.correct ? 'ok' : 'bad') : ''}`}><div className="step-no">{fa ? `مرحله ${i+1}` : `Step ${i+1}`} · {(s.answerType || s.type || "autocomplete")}</div><div className="step-prompt">{stepLabel(s, "prompt", fa)}</div>{stepLabel(s, "hint", fa) && !checked && <div className="small muted">💡 {stepLabel(s, "hint", fa)}</div>}{renderInput(s, i)}{checked && showCorrect && !res?.correct && <div className="small" style={{color:'var(--danger)'}}>{fa ? "پاسخ مورد انتظار:" : "Expected:"} {res?.expected}</div>}{checked && stepLabel(s, "explanation", fa) && <div className="small muted">{stepLabel(s, "explanation", fa)}</div>}</div>;
    })}
    {checked && <div className={`ddle-banner ${stepResults?.every((x)=>x.correct)?'ok':'bad'}`} style={{marginTop:12}}>{stepResults?.filter((x)=>x.correct).length || 0}/{steps.length} {fa ? "مرحله درست" : "steps correct"}</div>}
    {gradeErr && <div className="ddle-banner bad" style={{ marginTop: 12 }}>{gradeErr}</div>}
    {!checked && <button type="button" className="btn btn-primary btn-block mt16" disabled={!canCheck || busy} onClick={finish}>{t("checkAns") || t("send")}</button>}
  </div>;
}

function KfQuestion({ card, lang, showCorrect, checked, setChecked, onGraded, hints, showHints }) {
  const { t } = useApp();
  const fa = lang === "fa";
  const kf = card.kf || {};
  const items = Array.isArray(kf.items) ? kf.items : [];
  const vignette = fa ? (kf.vignette_fa || "") : (kf.vignette_en || kf.vignette_fa || "");
  const [answers, setAnswers] = useState({});
  const [itemResults, setItemResults] = useState(null);
  const letters = fa ? ["الف", "ب", "ج", "د"] : ["A", "B", "C", "D"];
  const judgeItem = (it, val) => {
    if ((it.kind || "short") === "mcq") return Number(val) === Number(it.correct || 0);
    const accepted = arr(fa ? (it.accept_fa || it.answer_fa) : (it.accept_en || it.answer_en));
    const extra = fa ? it.answer_fa : it.answer_en;
    const list = accepted.length ? accepted : (extra ? [extra] : []);
    return list.some((a) => norm(a) === norm(val));
  };
  const canCheck = items.length && items.every((it, i) => String(answers[i] ?? "").trim() !== "" || answers[i] === 0);
  const [gradeErr, setGradeErr] = useState("");
  const [busy, setBusy] = useState(false);
  const finish = async () => {
    if (busy) return;
    setBusy(true); setGradeErr("");
    try {
      const payloadAnswers = {};
      items.forEach((_, i) => { payloadAnswers[i] = answers[i]; });
      const r = await api.post("/flashcards/check", { cardId: card.id, type: "kf", answers: payloadAnswers, lang, reveal: !!showCorrect }, { timeoutMs: 15000, stage: "evaluate" });
      const res = (r.kfResults || items.map((_, i) => ({ index: i + 1, answer: answers[i], correct: false }))).map((row, i) => {
        const it = items[i] || {};
        return { index: row.index || i + 1, prompt: fa ? it.prompt_fa : it.prompt_en, answer: answers[i], correct: !!row.correct, expected: row.expected || "" };
      });
      setItemResults(res); setChecked(true); onGraded(!!r.ok, { kfResults: res, pointsFrac: r.pointsFrac == null ? 0 : r.pointsFrac });
    } catch (e) { setGradeErr(String(e.message || e)); }
    finally { setBusy(false); }
  };
  return <div className="kf-q">
    {vignette && <div className="kf-vignette">{vignette}</div>}
    <LocalHints hints={hints} showHints={showHints && !checked} fa={fa} />
    {items.length === 0 ? <div className="ddle-banner bad">{fa ? "برای این کی‌اف هنوز موردی ثبت نشده است." : "No KF items are configured."}</div> : items.map((it, i) => {
      const res = itemResults?.[i];
      const opts = fa ? (it.options_fa || []) : (it.options_en || []);
      return <div key={i} className={`step-card ${res ? (res.correct ? "ok" : "bad") : ""}`}>
        <div className="step-no">{fa ? `کی‌اف ${i + 1}` : `KF ${i + 1}`}</div>
        <div className="step-prompt">{fa ? it.prompt_fa : it.prompt_en}</div>
        {(it.kind || "short") === "mcq" ? (
          <div className="mc-options compact">{opts.map((o, j) => o ? <button type="button" key={j} className={`mc-opt ${answers[i] === j ? "sel" : ""} ${checked && it.correct != null && j === Number(it.correct) ? "correct" : ""} ${checked && answers[i] === j && (it.correct == null || j !== Number(it.correct)) ? "wrong" : ""}`} disabled={checked} onClick={() => setAnswers((a) => ({ ...a, [i]: j }))}><span className="mc-letter">{letters[j]}</span><span>{o}</span></button> : null)}</div>
        ) : (
          <input className="fill-input" value={answers[i] || ""} disabled={checked} placeholder={fa ? "پاسخ کوتاه…" : "Short answer…"} onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))} />
        )}
        {checked && showCorrect && !res?.correct && <div className="small" style={{ color: "var(--danger)" }}>{fa ? "پاسخ مورد انتظار:" : "Expected:"} {res?.expected}</div>}
      </div>;
    })}
    {checked && <div className={`ddle-banner ${itemResults?.every((x) => x.correct) ? "ok" : "bad"}`} style={{ marginTop: 12 }}>{itemResults?.filter((x) => x.correct).length || 0}/{items.length} {fa ? "مورد درست" : "items correct"}</div>}
    {gradeErr && <div className="ddle-banner bad" style={{ marginTop: 12 }}>{gradeErr}</div>}
    {!checked && <button type="button" className="btn btn-primary btn-block mt16" disabled={!canCheck || busy} onClick={finish}>{t("checkAns") || t("send")}</button>}
  </div>;
}

function PuzzleQuestion({ card, lang, showCorrect, checked, setChecked, onGraded, hints, showHints }) {
  const { t } = useApp();
  const fa = lang === "fa";
  const puzzle = card.puzzle || {};
  const pins = Array.isArray(puzzle.pins)
    ? puzzle.pins.filter((p) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
    : [];
  const img = puzzle.imageUrl || card.imageUrl || "";
  const bank = useMemo(() => {
    if (Array.isArray(puzzle.bank) && puzzle.bank.length) {
      return puzzle.bank.map((b) => ({
        id: b.id,
        text: fa ? (b.fa || b.en || b.text || "") : (b.en || b.fa || b.text || ""),
      })).filter((x) => x.id && x.text);
    }
    const correct = pins.map((p, i) => ({ id: `p${i}`, pin: i, text: fa ? (p.label_fa || p.label_en) : (p.label_en || p.label_fa) }));
    const distSrc = fa ? (puzzle.distractors_fa || []) : (puzzle.distractors_en || puzzle.distractors_fa || []);
    const extra = (Array.isArray(distSrc) ? distSrc : String(distSrc || "").split(/[\n,]/))
      .map((s) => String(s || "").trim()).filter(Boolean)
      .map((text, i) => ({ id: `d${i}`, pin: null, text }));
    return shuffle([...correct, ...extra].filter((x) => x.text));
  }, [card.id, fa, puzzle.bank]);
  const [assign, setAssign] = useState({});
  const [activePin, setActivePin] = useState(0);
  const [pinGrade, setPinGrade] = useState(null);
  const used = new Set(Object.values(assign));
  const pickLabel = (id) => {
    if (checked || activePin == null) return;
    const pin = Number(activePin);
    setAssign((s) => {
      const next = { ...s };
      for (const k of Object.keys(next)) if (next[k] === id) delete next[k];
      next[pin] = id;
      return next;
    });
    setActivePin((p) => Math.min(Number(p) + 1, Math.max(pins.length - 1, 0)));
  };
  const pinOk = (i) => {
    if (Array.isArray(pinGrade)) {
      const row = pinGrade.find((p) => Number(p?.i) === i) || pinGrade[i];
      return !!row?.ok;
    }
    const lab = bank.find((b) => b.id === assign[i]);
    return !!(lab && (lab.pin === i || lab.id === `p${i}`));
  };
  const allOk = pins.length > 0 && pins.every((_, i) => pinOk(i));
  const [gradeErr, setGradeErr] = useState("");
  const [busy, setBusy] = useState(false);
  const finish = async () => {
    if (busy) return;
    setBusy(true); setGradeErr("");
    try {
      const r = await api.post("/flashcards/check", { cardId: card.id, type: "puzzle", assign, lang }, { timeoutMs: 15000, stage: "evaluate" });
      setPinGrade(Array.isArray(r.pinResults) ? r.pinResults : null);
      setChecked(true);
      onGraded(!!r.ok, { assign, pointsFrac: r.pointsFrac == null ? 0 : r.pointsFrac });
    } catch (e) { setGradeErr(String(e.message || e)); }
    finally { setBusy(false); }
  };
  if (!pins.length) {
    return <div className="ddle-banner bad">{fa ? "برای این پازل هنوز نقطه‌ای روی تصویر ثبت نشده است." : "No labeled pins are configured for this image puzzle."}</div>;
  }
  return <div className="puzzle-q label-puzzle">
    <LocalHints hints={hints} showHints={showHints && !checked} fa={fa} />
    <div className="small muted">{fa ? "یک شماره را انتخاب کنید، بعد برچسب درست را از فهرست بزنید." : "Select a numbered pin, then tap the matching label."}</div>
    {img ? (
      <div className="label-puzzle-img">
        <img src={img} alt="" />
        {pins.map((p, i) => {
          let cls = "label-pin";
          if (activePin === i && !checked) cls += " on";
          if (checked) cls += pinOk(i) ? " ok" : " bad";
          return <button type="button" key={i} className={cls} style={{ left: `${p.x}%`, top: `${p.y}%` }} disabled={checked} onClick={() => setActivePin(i)}>{i + 1}</button>;
        })}
      </div>
    ) : null}
    <div className="label-pin-assign">
      {pins.map((p, i) => {
        const lab = bank.find((b) => b.id === assign[i]);
        return <div className={`label-pin-row ${activePin === i && !checked ? "on" : ""}`} key={i} onClick={() => !checked && setActivePin(i)}>
          <span className={`label-pin static ${checked ? (pinOk(i) ? "ok" : "bad") : ""}`}>{i + 1}</span>
          <span className="label-pin-slot">{lab ? lab.text : (fa ? "—" : "—")}</span>
          {checked && showCorrect && !pinOk(i) && <span className="small" style={{ color: "var(--danger)" }}>{fa ? (p.label_fa || p.label_en) : (p.label_en || p.label_fa)}</span>}
        </div>;
      })}
    </div>
    {!checked && <div className="label-pin-bank">{bank.map((b) => (
      <button key={b.id} type="button" className={`opt order-word ${used.has(b.id) ? "connected" : ""} ${assign[activePin] === b.id ? "sel" : ""}`}
        style={{ opacity: used.has(b.id) && assign[activePin] !== b.id ? 0.4 : 1 }}
        onClick={() => pickLabel(b.id)}>{b.text}</button>
    ))}</div>}
    {checked && <div className={`ddle-banner ${allOk ? "ok" : "bad"}`} style={{ marginTop: 12 }}>{allOk ? `✓ ${t("correct")}` : `${pins.filter((_, i) => pinOk(i)).length}/${pins.length} ${fa ? "برچسب درست" : "labels correct"}`}</div>}
    {gradeErr && <div className="ddle-banner bad" style={{ marginTop: 12 }}>{gradeErr}</div>}
    {!checked && <button type="button" className="btn btn-primary btn-block mt16" disabled={busy || Object.keys(assign).length < pins.length} onClick={finish}>{t("checkAns") || t("send")}</button>}
  </div>;
}

function CompareQuestion({ card, lang, showCorrect, checked, setChecked, onGraded, hints, showHints }) {
  const { t } = useApp();
  const fa = lang === "fa";
  const features = Array.isArray(card.features) ? card.features : [];
  const entityA = fa ? (card.entityA_fa || card.entityA_en || card.entityA || "A") : (card.entityA_en || card.entityA_fa || card.entityA || "A");
  const entityB = fa ? (card.entityB_fa || card.entityB_en || card.entityB || "B") : (card.entityB_en || card.entityB_fa || card.entityB || "B");
  const [picks, setPicks] = useState({});
  const [rows, setRows] = useState(null);
  const [gradeErr, setGradeErr] = useState("");
  const [busy, setBusy] = useState(false);
  const finish = async () => {
    if (busy) return;
    setBusy(true); setGradeErr("");
    try {
      const r = await api.post("/flashcards/check", { cardId: card.id, type: "compare", answers: picks, lang, reveal: !!showCorrect }, { timeoutMs: 15000, stage: "evaluate" });
      setRows(Array.isArray(r.featureResults) ? r.featureResults : []);
      setChecked(true);
      onGraded(!!r.ok, { answers: picks, pointsFrac: r.pointsFrac == null ? 0 : r.pointsFrac });
    } catch (e) { setGradeErr(String(e.message || e)); }
    finally { setBusy(false); }
  };
  const canCheck = features.length && features.every((_, i) => picks[i] === "A" || picks[i] === "B" || picks[i] === "both");
  const choices = [["A", entityA], ["B", entityB], ["both", fa ? "هر دو" : "Both"]];
  return <div className="compare-q">
    <LocalHints hints={hints} showHints={showHints && !checked} fa={fa} />
    {features.length === 0 ? <div className="ddle-banner bad">{fa ? "برای این مقایسه هنوز ویژگی‌ای ثبت نشده است." : "No compare features are configured."}</div> : features.map((f, i) => {
      const text = fa ? (f.fa || f.en || f.text || "") : (f.en || f.fa || f.text || "");
      const res = rows?.[i];
      const ok = !!(res?.ok);
      return <div key={i} className={`step-card ${res ? (ok ? "ok" : "bad") : ""}`}>
        <div className="step-prompt">{text}</div>
        <div className="mc-options compact">{choices.map(([v, lab]) => {
          let cls = "mc-opt";
          if (picks[i] === v) cls += " sel";
          if (checked && showCorrect && res?.belongs === v) cls += " correct";
          else if (checked && picks[i] === v && !ok) cls += " wrong";
          return <button type="button" key={v} className={cls} disabled={checked} onClick={() => setPicks((p) => ({ ...p, [i]: v }))}>{lab}</button>;
        })}</div>
      </div>;
    })}
    {checked && <div className={`ddle-banner ${rows?.every((x) => x.ok) ? "ok" : "bad"}`} style={{ marginTop: 12 }}>{rows?.filter((x) => x.ok).length || 0}/{features.length} {fa ? "ویژگی درست" : "features correct"}</div>}
    {gradeErr && <div className="ddle-banner bad" style={{ marginTop: 12 }}>{gradeErr}</div>}
    {!checked && <button type="button" className="btn btn-primary btn-block mt16" disabled={!canCheck || busy} onClick={finish}>{t("checkAns") || t("send")}</button>}
  </div>;
}

function HotspotExam({ card, lang, showCorrect, checked, setChecked, onGraded, hints, showHints }) {
  const { t } = useApp();
  const fa = lang === "fa";
  const [clicks, setClicks] = useState([]);
  const [overlayHs, setOverlayHs] = useState(null);
  const [gradeErr, setGradeErr] = useState("");
  const sent = useRef(false);
  // Re-opened for a changed answer (checked back to false): allow one new grade.
  useEffect(() => { if (!checked) sent.current = false; }, [checked]);
  const finish = async (pt) => {
    if (checked || sent.current) return;
    sent.current = true;
    setGradeErr("");
    try {
      const r = await api.post("/flashcards/check", { cardId: card.id, type: "hotspot", x: pt.x, y: pt.y, reveal: !!showCorrect }, { timeoutMs: 15000, stage: "evaluate" });
      const row = { x: Math.round(pt.x * 10) / 10, y: Math.round(pt.y * 10) / 10, ok: !!r.ok };
      setClicks([row]);
      if (r.reveal?.hotspot) setOverlayHs(r.reveal.hotspot);
      setChecked(true);
      onGraded(!!r.ok, { hotspotClicks: [row], pointsFrac: r.ok ? 1 : 0 });
    } catch (e) {
      sent.current = false;
      setGradeErr(String(e.message || e));
    }
  };
  return (
    <div>
      <LocalHints hints={hints} showHints={showHints && !checked} fa={fa} />
      <HotspotPlayer
        key={card.id}
        imageUrl={card.imageUrl}
        hotspot={overlayHs || card.hotspot}
        lang={lang}
        done={checked}
        showCorrect={showCorrect}
        clicks={clicks}
        onCommit={finish}
      />
      {gradeErr && <div className="ddle-banner bad" style={{ marginTop: 12 }}>{gradeErr}</div>}
      {checked && (
        <div className={`ddle-banner ${clicks[0]?.ok ? "ok" : "bad"}`} style={{ marginTop: 12 }}>
          {clicks[0]?.ok ? `✓ ${t("correct")}` : t("incorrect")}
        </div>
      )}
    </div>
  );
}

function StepChoiceInput({step,lang,value,disabled,onChange}) {
 const options=useMemo(()=>Array.from({length:Math.max(step.options_fa?.length||0,step.options_en?.length||0)},(_,i)=>({fa:step.options_fa?.[i]||step.options_en?.[i]||'',en:step.options_en?.[i]||step.options_fa?.[i]||''})).filter(o=>o.fa||o.en),[step]);
 const fa=lang==='fa';
 if((step.answerType||step.type)==='mcq'&&options.length)return <div className="mc-options compact">{options.map((o,i)=><button type="button" key={i} className={`mc-opt ${value===o[lang]?'sel':''}`} disabled={disabled} onClick={()=>onChange(o[lang])}>{o[lang]}</button>)}</div>;
 if(options.length)return <div><SearchAnswer options={options} lang={lang} disabled={disabled} onPick={i=>onChange(options[i][lang])} placeholder={fa?'جستجوی پاسخ…':'Search for an answer…'}/>{value&&<p role="status">{fa?'پاسخ انتخاب‌شده: ':'Selected answer: '}{value}</p>}</div>;
 return <textarea aria-label={fa?'پاسخ مرحله':'Step answer'} rows="2" value={value} disabled={disabled} onChange={e=>onChange(e.target.value)} placeholder={fa?'پاسخ این مرحله…':'Answer this step…'}/>;
}
