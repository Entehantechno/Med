import { useState, useRef, useEffect, useMemo } from "react";
import { useApp } from "../context.jsx";
import Icon from "./Icon.jsx";

/* Smart search box for ordering lab tests / imaging studies.
   Filters a bilingual catalog (plus aliases). Click a suggestion (or press
   Enter) to add the catalog item. Free-text custom orders are off by default
   so students and case authors pick from the shared option list. */
function norm(s) {
  return (s || "").toString().toLowerCase()
    .replace(/[ي]/g, "ی").replace(/[ك]/g, "ک")
    .replace(/[ًٌٍَُِّْ]/g, "").replace(/\s+/g, " ").trim();
}

export default function OrderSearch({ catalog, lang, onAdd, placeholder, allowCustom = false }) {
  const { t } = useApp();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);

  const items = useMemo(() => (catalog || []).map((o) => ({
    label: lang === "fa" ? (o.fa || o.name_fa || o.en || o.name_en || "") : (o.en || o.name_en || o.fa || o.name_fa || ""),
    sub: lang === "fa" ? (o.en || o.name_en || "") : (o.fa || o.name_fa || ""),
    aliases: Array.isArray(o.aliases) ? o.aliases : [],
    raw: o,
  })), [catalog, lang]);

  const results = useMemo(() => {
    const nq = norm(q);
    if (!nq) return items.slice(0, 40);
    return items
      .map((it) => {
        const a = norm(it.label), b = norm(it.sub);
        const als = (it.aliases || []).map(norm);
        let score = -1;
        if (a === nq || b === nq || als.includes(nq)) score = 100;
        else if (a.startsWith(nq) || b.startsWith(nq) || als.some((x) => x.startsWith(nq))) score = 80;
        else if (a.includes(nq) || b.includes(nq) || als.some((x) => x.includes(nq))) score = 60;
        else {
          const sub = (hay) => { let j = 0; for (const ch of hay) if (ch === nq[j]) j++; return j === nq.length; };
          if (sub(a) || sub(b) || als.some(sub)) score = 30;
        }
        return { ...it, score };
      })
      .filter((x) => x.score >= 0)
      .sort((x, y) => y.score - x.score);
  }, [q, items]);

  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const commitItem = (it) => {
    if (it?.raw) {
      onAdd(it.raw);
      setQ(""); setOpen(false);
      return true;
    }
    return false;
  };
  const commitCustom = () => {
    const v = q.trim();
    if (!allowCustom || !v) return;
    onAdd({ fa: v, en: v, aliases: [v], custom: true });
    setQ(""); setOpen(false);
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, Math.max(results.length - 1, 0))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") {
      if (e.nativeEvent?.isComposing || e.repeat) return;
      e.preventDefault();
      if (!q.trim()) { setOpen(true); return; }
      if (!commitItem(results[hi])) commitCustom();
    }
    else if (e.key === "Escape") setOpen(false);
  };

  const highlight = (label) => {
    const nq = norm(q); if (!nq) return label;
    const idx = norm(label).indexOf(nq);
    if (idx < 0) return label;
    return (<>{label.slice(0, idx)}<mark style={{ background: "rgba(47,127,209,.18)", color: "inherit", borderRadius: 4 }}>{label.slice(idx, idx + q.length)}</mark>{label.slice(idx + q.length)}</>);
  };

  return (
    <div className="search-answer" ref={boxRef}>
      <div className="search-input-wrap">
        <span className="search-ico"><Icon name="search" size={16} /></span>
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} onKeyDown={onKey}
          placeholder={placeholder || t("searchOrderPh")} autoComplete="off" />
        <button type="button" className="btn btn-green btn-sm" style={{ margin: "5px" }}
          onClick={() => { if (!q.trim()) { setOpen(true); return; } if (!commitItem(results[hi])) commitCustom(); }}>{t("add")}</button>
      </div>
      {open && (
        <div className="search-list">
          {results.length ? results.map((it, k) => (
            <button key={k} type="button" className={`search-opt ${k === hi ? "hi" : ""}`}
              onMouseEnter={() => setHi(k)} onClick={() => commitItem(it)}>
              <span className="opt-main">{highlight(it.label)}</span>
              {it.sub && <span className="opt-sub">{it.sub}</span>}
            </button>
          )) : (
            <div className="search-empty">
              {t("noMatch")}
              {allowCustom ? <> — <b onClick={commitCustom} style={{ cursor: "pointer", color: "var(--primary)" }}>{t("addCustom")}</b></> : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
