import { useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import HotspotPlayer from "./HotspotPlayer.jsx";

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
    {n < list.length && <button className="btn btn-ghost btn-sm" onClick={() => setN((x) => x + 1)}>💡 {fa ? "نمایش هینت" : "Show hint"}</button>}
  </div>;
}

export default function ExamOtherType({ card, lang, done, showCorrect, showHints = true, hints = [], onGraded }) {
  const { t } = useApp();
  const [sel, setSel] = useState(card.type === "match" ? { pairs: {}, activeLeft: null } : card.type === "order" ? [] : null);
  const [checked, setChecked] = useState(false);
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
            return <button key={String(o.v)} className={cls} disabled={checked} onClick={() => setSel(o.v)}>{o.l}</button>;
          })}
        </div>
      )}
      {card.type === "fill" && (
        <div>
          <input className="fill-input" value={sel || ""} disabled={checked} placeholder={fa ? "پاسخ را تایپ کنید…" : "Type your answer…"} onChange={(e) => setSel(e.target.value)} />
          {checked && !right && showCorrect && <div className="small mt8" style={{ color: "var(--danger)" }}>{fa ? "پاسخ درست" : "Answer"}: {fa ? (reveal?.fa || card.blank_fa) : (reveal?.en || card.blank_en)}</div>}
        </div>
      )}
      {card.type === "match" && (
        <div className="match-grid">
          <div className="match-col">{left.map((l) => {
            const connected = sel?.pairs?.[l.id] != null; let cls = "opt match-item";
            if (sel?.activeLeft === l.id) cls += " sel"; if (connected && !checked) cls += " connected"; if (checked) cls += right ? " ok" : " bad";
            return <button key={l.id} className={cls} disabled={checked} onClick={() => setSel((s) => ({ ...s, activeLeft: l.id }))}>{l.text}</button>;
          })}</div>
          <div className="match-col">{rightCol.map((rr) => {
            const used = Object.values(sel?.pairs || {}).includes(rr.id); let cls = "opt match-item"; if (used && !checked) cls += " connected";
            return <button key={rr.id} className={cls} disabled={checked || (used && sel?.activeLeft == null)} onClick={() => setSel((s) => (s.activeLeft == null ? s : { pairs: { ...s.pairs, [s.activeLeft]: rr.id }, activeLeft: null }))}>{rr.text}</button>;
          })}</div>
        </div>
      )}
      {card.type === "order" && (
        <div>
          <div className="order-slots">{(sel || []).map((c, i) => <span key={c.id} className={`chip order-chip ${checked ? (right ? "ok" : "bad") : ""}`}>{i + 1}. {c.text}</span>)}{!checked && (sel || []).length > 0 && <button className="chip order-undo" onClick={() => setSel((s) => s.slice(0, -1))}>↩</button>}</div>
          <div className="order-pool">{orderPool.map((it) => { const usedIt = (sel || []).find((c) => c.id === it.id); return <button key={it.id} className="opt order-word" disabled={checked || !!usedIt} style={{ opacity: usedIt ? .35 : 1 }} onClick={() => setSel((s) => [...(s || []), it])}>{it.text}</button>; })}</div>
        </div>
      )}
      {gradeErr && <div className="ddle-banner bad" style={{ marginTop: 12 }}>{gradeErr}</div>}
      {checked && <div className={`ddle-banner ${right ? "ok" : "bad"}`} style={{ marginTop: 12 }}>{right ? `✓ ${t("correct")}` : t("incorrect")}</div>}
      {!checked && <button className="btn btn-primary btn-block mt16" disabled={!canCheck() || busy} onClick={check}>{t("checkAns") || t("send")}</button>}
    </div>
  );
}

function DrawingQuestion({ card, lang, checked, setChecked, onGraded, hints, showHints }) {
  const fa = lang === "fa";
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef(null);
  const shapeStart = useRef(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [snapshots, setSnapshots] = useState([]);
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
    const c = canvasRef.current; if (!c) return { w: 0, h: 0 };
    const r = c.getBoundingClientRect(); return { w: r.width, h: r.height };
  };
  /* ---- ink-mask capture for the teacher's advisory coverage/IoU score ----
     We rasterise the PRISTINE canvas (reference image included) once, then
     at submit rasterise the final canvas; any cell that changed is ink.
     Erased strokes and the traced slide therefore never count as drawing. */
  const MASK_W = 32;
  const maskDims = () => ({ w: MASK_W, h: Math.max(12, Math.round(MASK_W * ratio)) });
  const baseGridRef = useRef(null);
  const gridCanvasRef = useRef(null);
  const readGrid = () => {
    const c = canvasRef.current; if (!c) return null;
    const { w, h } = maskDims();
    let off = gridCanvasRef.current;
    if (!off) { off = document.createElement("canvas"); gridCanvasRef.current = off; }
    off.width = w; off.height = h;
    const ctx = off.getContext("2d", { willReadFrequently: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    try { ctx.drawImage(c, 0, 0, w, h); return ctx.getImageData(0, 0, w, h).data; }
    catch { return null; }   // tainted canvas (cross-origin image) → no mask
  };
  const captureBase = () => { try { baseGridRef.current = readGrid(); } catch { baseGridRef.current = null; } };
  const packInkMask = () => {
    const base = baseGridRef.current, now = readGrid();
    if (!now) return null;
    const { w, h } = maskDims();
    const cells = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const j = i * 4;
      if (!base) { cells[i] = now[j + 3] > 20 ? 1 : 0; continue; }
      const d = Math.abs(now[j] - base[j]) + Math.abs(now[j + 1] - base[j + 1]) + Math.abs(now[j + 2] - base[j + 2]);
      cells[i] = d > 60 ? 1 : 0;
    }
    const bytes = new Uint8Array(Math.ceil((w * h) / 8));
    for (let i = 0; i < w * h; i++) if (cells[i]) bytes[i >> 3] |= 1 << (7 - (i & 7));
    let bin = "";
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    let data = "";
    try { data = btoa(bin); } catch { data = ""; }
    return data ? { w, h, data } : null;
  };
  const saveSnap = () => setSnapshots((s) => [...s.slice(-12), canvasRef.current.toDataURL("image/png")]);
  const restore = (src) => {
    const c = canvasRef.current, ctx = c.getContext("2d"), { w, h } = cssSize(), img = new Image();
    img.onload = () => { ctx.setTransform(1, 0, 0, 1, 0, 0); const dpr = window.devicePixelRatio || 1; ctx.scale(dpr, dpr); ctx.drawImage(img, 0, 0, w, h); };
    img.src = src;
  };
  const paintBase = (ctx, w, h, then) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    if (drawing.traceReference && drawing.referenceImageUrl) {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(w / img.width, h / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.globalAlpha = 0.92;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        ctx.globalAlpha = 1;
        then?.();
      };
      img.onerror = () => then?.();
      img.src = drawing.referenceImageUrl;
    } else then?.();
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const cssW = Math.min(760, Math.max(300, wrapRef.current?.clientWidth || canvas.parentElement?.clientWidth || 520));
    const cssH = Math.round(cssW * ratio), dpr = window.devicePixelRatio || 1;
    canvas.width = cssW * dpr; canvas.height = cssH * dpr; canvas.style.width = "100%"; canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext("2d"); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr); ctx.lineCap = "round"; ctx.lineJoin = "round";
    paintBase(ctx, cssW, cssH, () => { setSnapshots([canvas.toDataURL("image/png")]); setRedoStack([]); setStrokeCount(0); setLabels([]); baseGridRef.current = null; captureBase(); });
  }, [card.id]);

  const pos = (e) => { const c = canvasRef.current, r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const strokeStyle = (ctx) => {
    const tool = brush.tool;
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.globalAlpha = tool === "highlighter" ? 0.32 : 1;
    ctx.strokeStyle = tool === "eraser" ? "rgba(0,0,0,1)" : brush.color;
    ctx.lineWidth = tool === "eraser" ? brush.size * 3 : tool === "highlighter" ? brush.size * 4 : brush.size;
  };
  const drawFree = (from, to) => {
    const ctx = canvasRef.current.getContext("2d"); strokeStyle(ctx);
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  };
  const commitShape = (from, to) => {
    const ctx = canvasRef.current.getContext("2d"); strokeStyle(ctx);
    if (brush.tool === "line") { ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke(); }
    else if (brush.tool === "rect") { ctx.strokeRect(Math.min(from.x, to.x), Math.min(from.y, to.y), Math.abs(to.x - from.x), Math.abs(to.y - from.y)); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  };
  const down = (e) => {
    if (checked) return; e.preventDefault();
    const p = pos(e);
    if (brush.tool === "label") {
      const { w, h } = cssSize();
      setLabels((ls) => [...ls, { x: (p.x / w) * 100, y: (p.y / h) * 100, text: String(ls.length + 1) }]);
      setStrokeCount((n) => n + 1);
      return;
    }
    drawingRef.current = true; lastRef.current = p; shapeStart.current = p;
    canvasRef.current.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!drawingRef.current || checked) return; e.preventDefault();
    if (brush.tool === "line" || brush.tool === "rect" || brush.tool === "label") return;
    const p = pos(e); drawFree(lastRef.current, p); lastRef.current = p;
  };
  const up = (e) => {
    if (!drawingRef.current) return; drawingRef.current = false;
    if (brush.tool === "line" || brush.tool === "rect") commitShape(shapeStart.current, pos(e));
    setStrokeCount((n) => n + 1); setRedoStack([]); saveSnap();
    try { canvasRef.current.releasePointerCapture?.(e.pointerId); } catch {}
  };
  const clear = () => {
    const c = canvasRef.current, ctx = c.getContext("2d"), { w, h } = cssSize();
    const dpr = window.devicePixelRatio || 1; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr);
    paintBase(ctx, w, h, () => { setStrokeCount(0); setRedoStack([]); setSnapshots([c.toDataURL("image/png")]); setLabels([]); baseGridRef.current = null; captureBase(); });
  };
  const undo = () => { if (snapshots.length <= 1) return; const next = snapshots.slice(0, -1); setRedoStack((r) => [snapshots[snapshots.length - 1], ...r].slice(0, 12)); setSnapshots(next); restore(next[next.length - 1]); setStrokeCount((n) => Math.max(0, n - 1)); };
  const redo = () => { if (!redoStack.length) return; const [first, ...rest] = redoStack; setRedoStack(rest); setSnapshots((s) => [...s, first]); restore(first); setStrokeCount((n) => n + 1); };
  const finish = () => {
    const checkedCount = Object.values(rubricDone).filter(Boolean).length;
    const total = rubric.length || 1;
    const pointsFrac = rubric.length ? checkedCount / total : (strokeCount > 0 ? 1 : 0);
    const preview = canvasRef.current?.toDataURL("image/jpeg", 0.55) || "";
    // The ink mask exists only for the teacher's optional score assist; when
    // the teacher switched it off (plain canvas + manual review), don't
    // capture/send anything extra.
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
      {tools.map(([id, lab]) => <button key={id} type="button" className={`chip-btn ${brush.tool === id ? "on" : ""}`} onClick={() => setBrush((b)=>({...b,tool:id}))} disabled={checked}>{lab}</button>)}
      {["#111827", "#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#ffffff"].map((c) => <button key={c} type="button" aria-label={c} className={`draw-color ${brush.color===c?"on":""}`} style={{ background: c }} onClick={() => setBrush((b)=>({...b,color:c,tool:b.tool==="eraser"?"pen":b.tool}))} disabled={checked} />)}
      <label className="small muted">{fa ? "ضخامت" : "Size"}<input type="range" min="2" max="16" value={brush.size} onChange={(e)=>setBrush((b)=>({...b,size:+e.target.value}))} disabled={checked}/></label>
      <button type="button" className={`chip-btn ${brush.grid ? "on" : ""}`} onClick={() => setBrush((b)=>({...b,grid:!b.grid}))} disabled={checked}>{fa ? "شبکه" : "Grid"}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={undo} disabled={checked || snapshots.length<=1}>{fa ? "برگشت" : "Undo"}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={redo} disabled={checked || !redoStack.length}>{fa ? "بازگشت" : "Redo"}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={clear} disabled={checked}>{fa ? "پاک کردن" : "Clear"}</button>
    </div>
    <div className="drawing-stage" ref={wrapRef}>
      <canvas ref={canvasRef} className="drawing-canvas" style={{ background: bg }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} aria-label={fa ? "بوم نقاشی پاسخ" : "Drawing answer canvas"} />
      {brush.grid && <div className="drawing-grid-overlay" aria-hidden="true" />}
      {labels.map((lb, i) => <span key={i} className="draw-label" style={{ left: `${lb.x}%`, top: `${lb.y}%` }}>{lb.text}</span>)}
    </div>
    {rubric.length > 0 && <div className="drawing-rubric"><div className="small muted">{fa ? "پس از کشیدن، معیارهایی را که رعایت کرده‌اید علامت بزنید. نمره نهایی بعد از تأیید استاد ثبت می‌شود." : "Check the criteria you met. Final score is recorded after teacher approval."}</div>{rubric.map((r, i) => <label className="toggle-row" key={i}><span>{r}</span><input type="checkbox" checked={!!rubricDone[i]} disabled={checked} onChange={(e)=>setRubricDone((s)=>({...s,[i]:e.target.checked}))}/></label>)}</div>}
    {checked ? <div className="ddle-banner ok">✓ {fa ? "نقاشی ثبت شد و در انتظار تأیید استاد است" : "Drawing submitted and pending teacher approval"}</div> : <button className="btn btn-primary btn-block mt16" disabled={strokeCount < minStrokes} onClick={finish}>{fa ? "ثبت نقاشی برای بررسی استاد" : "Submit for teacher review"}</button>}
  </div>;
}

function StepwiseQuestion({ card, lang, showCorrect, checked, setChecked, onGraded, hints, showHints }) {
  const { t } = useApp();
  const fa = lang === "fa";
  const steps = card.steps || [];
  const [answers, setAnswers] = useState({});
  const [stepResults, setStepResults] = useState(null);
  const renderInput = (s, i) => {
    const type = s.answerType || s.type || "autocomplete";
    if (type === "truefalse") return <div className="mc-options compact"><button className={`mc-opt ${answers[i] === "true" ? "sel" : ""}`} disabled={checked} onClick={() => setAnswers((a)=>({...a,[i]:"true"}))}>{fa ? "درست" : "True"}</button><button className={`mc-opt ${answers[i] === "false" ? "sel" : ""}`} disabled={checked} onClick={() => setAnswers((a)=>({...a,[i]:"false"}))}>{fa ? "نادرست" : "False"}</button></div>;
    const opts = fa ? (s.options_fa || []) : (s.options_en || []);
    if (type === "mcq" && opts.length) return <div className="mc-options compact">{opts.map((o, j) => <button key={j} className={`mc-opt ${answers[i] === o ? "sel" : ""}`} disabled={checked} onClick={() => setAnswers((a)=>({...a,[i]:o}))}>{o}</button>)}</div>;
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
    <LocalHints hints={hints} showHints={showHints && !checked} fa={fa} />
    {steps.length === 0 ? <div className="ddle-banner bad">{fa ? "برای این سؤال مرحله‌ای هنوز مرحله‌ای ثبت نشده است." : "No steps are configured for this stepwise question."}</div> : steps.map((s, i) => {
      const res = stepResults?.[i];
      return <div key={i} className={`step-card ${res ? (res.correct ? 'ok' : 'bad') : ''}`}><div className="step-no">{fa ? `مرحله ${i+1}` : `Step ${i+1}`} · {(s.answerType || s.type || "autocomplete")}</div><div className="step-prompt">{stepLabel(s, "prompt", fa)}</div>{stepLabel(s, "hint", fa) && !checked && <div className="small muted">💡 {stepLabel(s, "hint", fa)}</div>}{renderInput(s, i)}{checked && showCorrect && !res?.correct && <div className="small" style={{color:'var(--danger)'}}>{fa ? "پاسخ مورد انتظار:" : "Expected:"} {res?.expected}</div>}{checked && stepLabel(s, "explanation", fa) && <div className="small muted">{stepLabel(s, "explanation", fa)}</div>}</div>;
    })}
    {checked && <div className={`ddle-banner ${stepResults?.every((x)=>x.correct)?'ok':'bad'}`} style={{marginTop:12}}>{stepResults?.filter((x)=>x.correct).length || 0}/{steps.length} {fa ? "مرحله درست" : "steps correct"}</div>}
    {gradeErr && <div className="ddle-banner bad" style={{ marginTop: 12 }}>{gradeErr}</div>}
    {!checked && <button className="btn btn-primary btn-block mt16" disabled={!canCheck || busy} onClick={finish}>{t("checkAns") || t("send")}</button>}
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
          <div className="mc-options compact">{opts.map((o, j) => o ? <button key={j} className={`mc-opt ${answers[i] === j ? "sel" : ""} ${checked && it.correct != null && j === Number(it.correct) ? "correct" : ""} ${checked && answers[i] === j && (it.correct == null || j !== Number(it.correct)) ? "wrong" : ""}`} disabled={checked} onClick={() => setAnswers((a) => ({ ...a, [i]: j }))}><span className="mc-letter">{letters[j]}</span><span>{o}</span></button> : null)}</div>
        ) : (
          <input className="fill-input" value={answers[i] || ""} disabled={checked} placeholder={fa ? "پاسخ کوتاه…" : "Short answer…"} onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))} />
        )}
        {checked && showCorrect && !res?.correct && <div className="small" style={{ color: "var(--danger)" }}>{fa ? "پاسخ مورد انتظار:" : "Expected:"} {res?.expected}</div>}
      </div>;
    })}
    {checked && <div className={`ddle-banner ${itemResults?.every((x) => x.correct) ? "ok" : "bad"}`} style={{ marginTop: 12 }}>{itemResults?.filter((x) => x.correct).length || 0}/{items.length} {fa ? "مورد درست" : "items correct"}</div>}
    {gradeErr && <div className="ddle-banner bad" style={{ marginTop: 12 }}>{gradeErr}</div>}
    {!checked && <button className="btn btn-primary btn-block mt16" disabled={!canCheck || busy} onClick={finish}>{t("checkAns") || t("send")}</button>}
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
    {!checked && <button className="btn btn-primary btn-block mt16" disabled={busy || Object.keys(assign).length < pins.length} onClick={finish}>{t("checkAns") || t("send")}</button>}
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
          return <button key={v} className={cls} disabled={checked} onClick={() => setPicks((p) => ({ ...p, [i]: v }))}>{lab}</button>;
        })}</div>
      </div>;
    })}
    {checked && <div className={`ddle-banner ${rows?.every((x) => x.ok) ? "ok" : "bad"}`} style={{ marginTop: 12 }}>{rows?.filter((x) => x.ok).length || 0}/{features.length} {fa ? "ویژگی درست" : "features correct"}</div>}
    {gradeErr && <div className="ddle-banner bad" style={{ marginTop: 12 }}>{gradeErr}</div>}
    {!checked && <button className="btn btn-primary btn-block mt16" disabled={!canCheck || busy} onClick={finish}>{t("checkAns") || t("send")}</button>}
  </div>;
}

function HotspotExam({ card, lang, showCorrect, checked, setChecked, onGraded, hints, showHints }) {
  const { t } = useApp();
  const fa = lang === "fa";
  const [clicks, setClicks] = useState([]);
  const [overlayHs, setOverlayHs] = useState(null);
  const [gradeErr, setGradeErr] = useState("");
  const sent = useRef(false);
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
