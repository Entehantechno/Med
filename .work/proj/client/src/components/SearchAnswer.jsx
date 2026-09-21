import { useState, useRef, useEffect, useMemo } from "react";
import { useApp } from "../context.jsx";
import Icon from "./Icon.jsx";

/* Professional autocomplete answer box for flashcards.
   - Filters a provided list of options (bilingual) as the student types.
   - Fuzzy/substring matching, keyboard navigation (↑ ↓ Enter Esc).
   - Returns the chosen option index via onPick. */
function norm(s) {
  return (s || "").toString().toLowerCase()
    .replace(/[ي]/g, "ی").replace(/[ك]/g, "ک")
    .replace(/[ًٌٍَُِّْ]/g, "").replace(/\s+/g, " ").trim();
}

export default function SearchAnswer({ options, lang, disabled, onPick, placeholder, clearOnPick, withSubmit }) {
  const { t } = useApp();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  // In withSubmit mode, selecting from autocomplete should NOT grade/submit yet.
  // The user's answer is committed only when they press the explicit submit button.
  const [pending, setPending] = useState(null);
  const boxRef = useRef(null);

  // Each option carries BOTH languages: `label` (primary, chosen language) and
  // `sub` (the other language, shown as a subtitle). Matching works on both.
  const items = useMemo(() => (Array.isArray(options) ? options : []).map((o, i) => ({
    i, label: lang === "fa" ? o.fa : o.en, sub: lang === "fa" ? o.en : o.fa, alt: lang === "fa" ? o.en : o.fa,
  })), [options, lang]);

  const results = useMemo(() => {
    const nq = norm(q);
    if (!nq) return items;
    const scored = items
      .map((it) => {
        const a = norm(it.label), b = norm(it.alt);
        let score = -1;
        if (a === nq || b === nq) score = 100;
        else if (a.startsWith(nq) || b.startsWith(nq)) score = 80;
        else if (a.includes(nq) || b.includes(nq)) score = 60;
        else {
          // loose subsequence match (handles minor typos / partial words)
          const sub = (hay) => { let j = 0; for (const ch of hay) if (ch === nq[j]) j++; return j === nq.length; };
          if (sub(a) || sub(b)) score = 30;
        }
        return { ...it, score };
      })
      .filter((x) => x.score >= 0)
      .sort((x, y) => y.score - x.score);
    return scored;
  }, [q, items]);

  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => { setPending(null); setQ(""); }, [options, lang]);
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (it) => {
    if (!it) return;
    setQ(clearOnPick && !withSubmit ? "" : it.label);
    setOpen(false);
    if (withSubmit) setPending(it);
    else onPick(it.i);
  };

  const onKey = (e) => {
    if (disabled) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(results[hi]); }
    else if (e.key === "Escape") setOpen(false);
  };

  const highlight = (label) => {
    const nq = norm(q);
    if (!nq) return label;
    const idx = norm(label).indexOf(nq);
    if (idx < 0) return label;
    return (<>{label.slice(0, idx)}<mark style={{ background: "var(--primaryGlow)", color: "inherit", borderRadius: 4 }}>{label.slice(idx, idx + q.length)}</mark>{label.slice(idx + q.length)}</>);
  };

  const submitTop = () => {
    const chosen = pending || results[hi];
    if (!chosen) return;
    onPick(chosen.i);
    if (clearOnPick) setQ("");
    setPending(null);
    setOpen(false);
  };

  return (
    <div className={`search-answer ${withSubmit ? "with-submit" : ""}`} ref={boxRef}>
      <div className="search-row">
        <div className="search-input-wrap">
          <span className="search-ico"><Icon name="search" size={16} /></span>
          <input
            value={q} disabled={disabled}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            placeholder={placeholder || t("searchAnswerPh")}
            autoComplete="off"
          />
        </div>
        {withSubmit && <button type="button" className="btn btn-accent" disabled={disabled} onClick={submitTop}>{t("submit")}</button>}
      </div>
      {open && !disabled && (
        <div className="search-list">
          {results.length ? results.map((it, k) => (
            <button key={it.i} type="button"
              className={`search-opt ${k === hi ? "hi" : ""}`}
              onMouseEnter={() => setHi(k)}
              onClick={() => pick(it)}>
              <span className="opt-main">{highlight(it.label)}</span>
              {it.sub && <span className="opt-sub">{it.sub}</span>}
            </button>
          )) : <div className="search-empty">{t("noMatch")}</div>}
        </div>
      )}
    </div>
  );
}
