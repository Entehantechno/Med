import { useState, useEffect, useMemo } from "react";
import { useApp } from "../../context.jsx";
import Icon from "../../components/Icon.jsx";
import { playTap } from "../../lib/feedback.js";
import { optionLetter, optionLetterAria } from "../../lib/optionLetter.js";
import MediaEmbed from "../../components/MediaEmbed.jsx";
import Emphasis from "../../components/Emphasis.jsx";
import GlossaryText from "../../components/GlossaryText.jsx";
import { normFa } from "../../components/SearchBox.jsx";

/* Each question type exposes: render UI + report whether the current answer is correct
   via onReady(canCheck) and, on check, the parent reads `getCorrect()`.
   To keep it simple, each type calls onResult(isCorrect) when the user "checks".
   We implement a controlled pattern: the parent owns `checked`; these render the body. */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* MCQ */
export function MCQ({ card, checked, sel, setSel, isCorrect, glossary }) {
  const { lang, t } = useApp();
  const correctIdx = card.options.findIndex((o) => o.correct);
  const [elim, setElim] = useState(() => new Set());
  useEffect(() => { setElim(new Set()); }, [card.id]);
  // Any per-option rationale present? (UWorld-style "why each option is right/wrong")
  const hasWhy = card.options.some((o) => o.why && o.why.trim());
  const toggleElim = (i, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (checked) return;
    playTap();
    setElim((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
    if (sel === i) setSel(null);
  };
  const selectOption = (i) => {
    if (checked) return;
    playTap();
    if (elim.has(i)) {
      setElim((prev) => {
        const next = new Set(prev);
        next.delete(i);
        return next;
      });
    }
    setSel(i);
  };
  return (
    <div className="opt-grid">
      {card.options.map((o, i) => {
        let cls = "opt";
        if (checked) { if (i === correctIdx) cls += " ok"; else if (i === sel) cls += " bad"; }
        else if (i === sel) cls += " sel";
        if (!checked && elim.has(i)) cls += " elim";
        // after checking, reveal WHY under each option: green for the correct one,
        // red for the one the learner wrongly picked, muted for the rest.
        const showWhy = checked && hasWhy && o.why && o.why.trim();
        const whyKind = i === correctIdx ? "why-ok" : (i === sel ? "why-bad" : "why-muted");
        const letter = optionLetter(i, lang);
        return (
          <div key={i} className={`opt-wrap ${showWhy ? "has-why" : ""}`}>
            <button
              className={cls}
              disabled={checked}
              onClick={() => selectOption(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                toggleElim(i, e);
              }}
              aria-label={optionLetterAria(i, lang)}
            >
              <span className="opt-letter">{letter}</span>
              <span className="opt-text">{o.text}</span>
              {!checked && (
                <span
                  role="button"
                  tabIndex={0}
                  className={`opt-strike-btn ${elim.has(i) ? "is-active" : ""}`}
                  title={lang === "fa" ? (elim.has(i) ? "بازگردانی گزینه (کلیک یا راست‌کلیک)" : "خط زدن گزینه (کلیک یا راست‌کلیک)") : (elim.has(i) ? "Restore choice" : "Strike out choice (click or right-click)")}
                  onClick={(e) => toggleElim(i, e)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleElim(i, e);
                    }
                  }}
                >
                  {elim.has(i) ? "↩" : "✕"}
                </span>
              )}
            </button>
            {showWhy && (
              <div className={`opt-why ${whyKind}`}>
                <span className="opt-why-mark">{letter} {i === correctIdx ? "✓" : "✕"}</span>
                <GlossaryText text={o.why} glossary={glossary} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
MCQ.canCheck = (st) => st.sel != null;
MCQ.judge = (card, st) => !!card.options[st.sel]?.correct;

/* True / False */
export function TrueFalse({ card, checked, sel, setSel }) {
  const { t, lang } = useApp();
  const opts = [{ v: true, label: lang === "fa" ? "درست" : "True" }, { v: false, label: lang === "fa" ? "نادرست" : "False" }];
  return (
    <div className="opt-grid">
      {opts.map((o) => {
        let cls = "opt";
        if (checked) { if (o.v === card.answer) cls += " ok"; else if (o.v === sel) cls += " bad"; }
        else if (o.v === sel) cls += " sel";
        return <button key={String(o.v)} className={cls} disabled={checked} onClick={() => { playTap(); setSel(o.v); }}>{o.label}</button>;
      })}
    </div>
  );
}
TrueFalse.canCheck = (st) => st.sel != null;
TrueFalse.judge = (card, st) => st.sel === card.answer;

/* Fill in the blank (typed) */
export function Fill({ card, checked, sel, setSel }) {
  const { lang } = useApp();
  const ok = checked && judgeFill(card, sel);
  return (
    <div>
      <input className="fill-input" value={sel || ""} disabled={checked}
        placeholder={lang === "fa" ? "پاسخ را تایپ کنید…" : "Type your answer…"}
        onChange={(e) => setSel(e.target.value)} autoFocus />
      {checked && (
        <div className={`small mt8 ${ok ? "" : ""}`} style={{ color: ok ? "var(--green2)" : "var(--danger)" }}>
          {ok ? "✓" : `${lang === "fa" ? "پاسخ درست" : "Correct answer"}: ${card.blank}`}
        </div>
      )}
    </div>
  );
}
function norm(s) { return normFa(String(s || "").trim().replace(/\s+/g, " ")); }
function judgeFill(card, val) { return (card.accept || [card.blank]).some((a) => norm(a) === norm(val)); }
Fill.canCheck = (st) => !!(st.sel && String(st.sel).trim());
Fill.judge = (card, st) => judgeFill(card, st.sel);

/* Match pairs: tap a left item then a right item to connect */
export function Match({ card, checked, sel, setSel }) {
  // sel = { pairs: {leftId: rightId}, activeLeft }
  const state = sel || { pairs: {}, activeLeft: null };
  const rightShuffled = useMemo(() => shuffle(card.right), [card.id]);
  const set = (s) => setSel({ ...state, ...s });

  const pickLeft = (id) => {
    if (checked) return;
    set({ activeLeft: state.activeLeft === id ? null : id });
  };
  const pickRight = (rid) => {
    if (checked || state.activeLeft == null) return;
    const nextPairs = { ...state.pairs };
    for (const [lid, r] of Object.entries(nextPairs)) {
      if (r === rid) delete nextPairs[lid];
    }
    nextPairs[state.activeLeft] = rid;
    set({ pairs: nextPairs, activeLeft: null });
  };
  const rightUsed = Object.values(state.pairs);
  return (
    <div className="match-grid">
      <div className="match-col">
        {card.left.map((l) => {
          const connected = state.pairs[l.id] != null;
          const isRight = checked && state.pairs[l.id] === l.id;
          let cls = "opt match-item";
          if (state.activeLeft === l.id) cls += " sel";
          if (connected && !checked) cls += " connected";
          if (checked) cls += isRight ? " ok" : " bad";
          return <button key={l.id} className={cls} disabled={checked} onClick={() => pickLeft(l.id)}>{l.text}</button>;
        })}
      </div>
      <div className="match-col">
        {rightShuffled.map((rr) => {
          const used = rightUsed.includes(rr.id);
          let cls = "opt match-item";
          if (used && !checked) cls += " connected";
          return <button key={rr.id} className={cls} disabled={checked || (used && state.activeLeft == null)} onClick={() => pickRight(rr.id)}>{rr.text}</button>;
        })}
      </div>
    </div>
  );
}
Match.canCheck = (st, card) => st?.sel?.pairs && (card?.left ? Object.keys(st.sel.pairs).length >= card.left.length : Object.keys(st.sel.pairs).length > 0);
Match.judge = (card, st) => card.left.every((l) => st.sel?.pairs?.[l.id] === l.id);

/* Order: tap items in the correct sequence (word-bank style) */
export function Order({ card, checked, sel, setSel }) {
  const pool = useMemo(() => shuffle(card.items), [card.id]);
  const chosen = sel || [];
  const add = (it) => { if (checked || chosen.find((c) => c.id === it.id)) return; setSel([...chosen, it]); };
  const removeLast = () => { if (checked) return; setSel(chosen.slice(0, -1)); };
  const correct = checked && chosen.every((c, i) => c.id === i);
  return (
    <div>
      <div className="order-slots">
        {chosen.map((c, i) => {
          const good = checked && c.id === i;
          return <span key={c.id} className={`chip order-chip ${checked ? (good ? "ok" : "bad") : ""}`}>{i + 1}. {c.text}</span>;
        })}
        {!checked && chosen.length > 0 && <button className="chip order-undo" onClick={removeLast}>↩</button>}
      </div>
      <div className="order-pool">
        {pool.map((it) => {
          const used = chosen.find((c) => c.id === it.id);
          return <button key={it.id} className="opt order-word" disabled={checked || !!used} style={{ opacity: used ? .35 : 1 }} onClick={() => add(it)}>{it.text}</button>;
        })}
      </div>
      {checked && !correct && (
        <div className="small mt8" style={{ color: "var(--danger)" }}>
          {card.items.map((it, i) => `${i + 1}. ${it.text}`).join(" → ")}
        </div>
      )}
    </div>
  );
}
Order.canCheck = (st, card) => Array.isArray(st?.sel) && (card?.items ? st.sel.length >= card.items.length : st.sel.length > 0);
Order.judge = (card, st) => (st.sel || []).length === card.items.length && (st.sel || []).every((c, i) => c.id === i);

/* Clinical Compare & Contrast — for each distinguishing feature, the learner
   assigns it to entity A, B, or both. This is the discrimination skill medical
   exams reward (e.g. "which finding tells DKA from HHS?"). On check, every row
   turns into a color-coded comparison table (corrective feedback). */
export function Compare({ card, checked, sel, setSel }) {
  const { t, lang } = useApp();
  const fa = lang !== "en";
  const answers = sel || {}; // { featureId: "A" | "B" | "both" }
  const choose = (fid, val) => { if (checked) return; setSel({ ...answers, [fid]: val }); };
  const cols = [
    { key: "A", label: card.entityA },
    { key: "B", label: card.entityB },
    { key: "both", label: fa ? "هر دو" : "Both" },
  ];
  return (
    <div className="cmp-wrap">
      <div className="cmp-head">
        <span className="cmp-ent cmp-ent-a">{card.entityA}</span>
        <span className="cmp-vs">{fa ? "در برابر" : "vs"}</span>
        <span className="cmp-ent cmp-ent-b">{card.entityB}</span>
      </div>
      <div className="cmp-hint small muted">{fa ? "هر ویژگی را به گزینهٔ درست نسبت بده:" : "Assign each feature to the correct option:"}</div>
      {card.features.map((f) => {
        const picked = answers[f.id];
        const right = checked && picked === f.belongs;
        return (
          <div key={f.id} className={`cmp-row ${checked ? (right ? "ok" : "bad") : ""}`}>
            <div className="cmp-feature">{f.text}</div>
            <div className="cmp-choices">
              {cols.map((c) => {
                let cls = "cmp-choice";
                if (checked) {
                  if (c.key === f.belongs) cls += " correct";       // always mark the right one
                  else if (c.key === picked) cls += " wrong";        // mark the wrong pick
                } else if (picked === c.key) cls += " sel";
                return (
                  <button key={c.key} className={cls} disabled={checked} onClick={() => choose(f.id, c.key)}>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
Compare.canCheck = (st, card) => st?.sel && (card?.features ? Object.keys(st.sel).length >= card.features.length : Object.keys(st.sel).length > 0);
Compare.judge = (card, st) => {
  const a = st.sel || {};
  // correct only if EVERY feature is assigned to its right entity
  return card.features.length > 0 && card.features.every((f) => a[f.id] === f.belongs);
};

export function UnsupportedType() {
  const { lang } = useApp();
  return (
    <div className="small muted" style={{ padding: "8px 0" }}>
      {lang === "fa"
        ? "این نوع سؤال در درس مسیر و آزمون‌ساز پشتیبانی نمی‌شود. از تب فلش‌کارت استفاده کنید."
        : "This question type is not supported in path lessons or the test builder. Use the Flashcards tab."}
    </div>
  );
}
UnsupportedType.canCheck = () => true;
UnsupportedType.judge = () => false;

const TYPE_VIEWS = { mcq: MCQ, image: MCQ, truefalse: TrueFalse, fill: Fill, match: Match, order: Order, compare: Compare };
export const TYPE_MAP = new Proxy(TYPE_VIEWS, {
  get(target, prop) {
    if (prop in target) return target[prop];
    return UnsupportedType;
  },
});

/* QB-style micro lesson ("درسنامه") shown after answering. */
export function MicroLesson({ micro, defaultOpen = false, glossary }) {
  const { lang } = useApp();
  const [open, setOpen] = useState(defaultOpen);
  if (!micro || (!micro.lead && !micro.golden && !(micro.points || []).length)) return null;
  return (
    <div className="micro-box">
      <button className="micro-toggle" onClick={() => setOpen((v) => !v)}>
        <Icon name="book" size={16} /> {lang === "fa" ? "درسنامهٔ کوتاه" : "Quick lesson"} <span style={{ marginInlineStart: "auto" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="micro-body">
          {micro.media && <MediaEmbed media={micro.media} className="micro-media" />}
          {micro.lead && <GlossaryText as="div" className="micro-lead" text={micro.lead} glossary={glossary} />}
          {micro.golden && (
            <div className="micro-golden"><Icon name="medal" size={15} /> <b>{lang === "fa" ? "نکتهٔ طلایی: " : "Golden point: "}</b><GlossaryText text={micro.golden} glossary={glossary} /></div>
          )}
          {micro.points?.length > 0 && (
            <ul className="micro-points">{micro.points.map((p, i) => <GlossaryText as="li" key={i} text={p} glossary={glossary} />)}</ul>
          )}
          {micro.options?.length > 0 && (
            <div className="micro-opts">
              <div className="micro-sub">{lang === "fa" ? "بررسی گزینه‌ها:" : "Option analysis:"}</div>
              {micro.options.map((o, i) => <GlossaryText as="div" key={i} className="micro-opt-line" text={o} glossary={glossary} />)}
            </div>
          )}
          {micro.source && <div className="micro-source"><Icon name="bookmark" size={12} /> {lang === "fa" ? "منبع: " : "Source: "}{micro.source}</div>}
        </div>
      )}
    </div>
  );
}
