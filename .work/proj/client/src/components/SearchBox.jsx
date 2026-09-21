import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useApp } from "../context.jsx";
import Icon from "./Icon.jsx";
import { safeLocal } from "../lib/storage.js";

/* SearchBox — the one search field used by the premium bank browser and every
 * admin table. Research-backed behaviours (Baymard autocomplete study, NN/g
 * search UX, Material/Atlassian chips):
 *   • debounced input (250 ms) — nothing fires per keystroke except the local
 *     suggestion filter; the network/heavy filter runs when typing pauses;
 *   • autocomplete list below the field: recent searches when empty, then
 *     scoped suggestions ("in chapter …") styled apart from stems; ↑/↓ moves,
 *     Enter picks, Esc closes; the active row is visibly highlighted and the
 *     list never scrolls (≤ 8 rows);
 *   • the search *grammar* is discoverable: a ? button opens a tiny cheat
 *     sheet ("phrase", -exclude, سال:1399, #id) — power without a manual;
 *   • "/" focuses the box from anywhere on the page, Esc clears it;
 *   • recent searches (last 8, localStorage, per box key) are removable;
 *   • a11y: role=combobox / listbox / option, aria-activedescendant, live
 *     result count is the caller's job (aria-live in the results header).
 *
 * Props:
 *   value, onChange(text)          — controlled text (debounced → onSearch)
 *   onSearch(text)                 — fired after debounce / Enter / suggestion
 *   suggest?(text) → Promise<[{kind,label,value?,key?,id?,count?}]>
 *   onPick?(suggestion)            — when a scoped suggestion is chosen
 *                                    (default: put its label into the box)
 *   placeholder, storageKey, autoFocus, compact, right (extra controls slot)
 */
const DEBOUNCE_MS = 250;

export default function SearchBox({
  value, onChange, onSearch, suggest, onPick, placeholder, storageKey = "search",
  autoFocus = false, compact = false, right = null, hotkey = true, helpKinds = null,
}) {
  const { t, lang } = useApp();
  const fa = lang !== "en";
  const id = useId();
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [sugs, setSugs] = useState([]);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState(() => readRecent(storageKey));
  const timer = useRef(null);
  const lastSent = useRef(value || "");
  const seq = useRef(0);

  // --- debounce → onSearch
  useEffect(() => {
    if (value === lastSent.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { lastSent.current = value; onSearch?.(value); }, DEBOUNCE_MS);
    return () => clearTimeout(timer.current);
  }, [value, onSearch]);

  // --- suggestions (async, latest wins)
  useEffect(() => {
    if (!suggest || !open) return;
    const q = String(value || "").trim();
    if (q.length < 2) { setSugs([]); return; }
    const mine = ++seq.current;
    const h = setTimeout(() => {
      Promise.resolve(suggest(q)).then((list) => { if (mine === seq.current) setSugs(Array.isArray(list) ? list.slice(0, 8) : []); }).catch(() => {});
    }, 150);
    return () => clearTimeout(h);
  }, [value, open, suggest]);

  // --- "/" focuses the box; Esc clears
  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable) return;
      e.preventDefault(); inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);

  const commit = (text) => {
    const q = String(text || "").trim();
    onChange?.(q);
    lastSent.current = q;
    onSearch?.(q);
    if (q) { const r = pushRecent(storageKey, q); setRecent(r); }
    setOpen(false); setActive(-1);
  };

  const rows = useMemo(() => {
    const q = String(value || "").trim();
    if (q.length < 2) return recent.map((r) => ({ kind: "recent", label: r }));
    return sugs;
  }, [value, sugs, recent]);

  const pick = (row) => {
    if (!row) return;
    if (row.kind === "recent") return commit(row.label);
    if (row.kind === "card") { onPick?.(row); setOpen(false); return; }
    if (onPick && row.kind !== "recent") { onPick(row); setOpen(false); setActive(-1); return; }
    commit(row.label);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => (rows.length ? (a + 1) % rows.length : -1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (rows.length ? (a - 1 + rows.length) % rows.length : -1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (open && active >= 0 && rows[active]) pick(rows[active]); else commit(value); }
    else if (e.key === "Escape") { if (open) { setOpen(false); setActive(-1); } else if (value) commit(""); }
  };

  const kindLabel = (k) => ({
    subject: fa ? "درس" : "subject", chapter: fa ? "فصل" : "chapter", concept: fa ? "مفهوم" : "concept",
    exam: fa ? "آزمون" : "exam", card: fa ? "سؤال" : "question", recent: fa ? "اخیر" : "recent",
    user: fa ? "کاربر" : "user", role: fa ? "نقش" : "role", university: fa ? "دانشگاه" : "university",
  }[k] || k);

  return (
    <div className={`sb ${compact ? "sb-compact" : ""}`} role="search">
      <div className={`sb-field ${open && rows.length ? "sb-open" : ""}`}>
        <Icon name="search" size={16} />
        <input
          ref={inputRef}
          id={id}
          type="search"
          role="combobox"
          aria-expanded={open && rows.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          autoFocus={autoFocus}
          value={value || ""}
          placeholder={placeholder || t("searchPlaceholder")}
          onChange={(e) => { onChange?.(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        {value ? (
          <button type="button" className="sb-icon" onClick={() => { commit(""); inputRef.current?.focus(); }} aria-label={fa ? "پاک کردن" : "Clear"}>
            <Icon name="close" size={14} />
          </button>
        ) : (
          hotkey && <kbd className="sb-kbd" aria-hidden="true">/</kbd>
        )}
        <button type="button" className={`sb-icon ${help ? "on" : ""}`} onClick={() => setHelp((v) => !v)} aria-label={fa ? "راهنمای جست‌وجو" : "Search syntax help"} aria-expanded={help} title={fa ? "راهنمای جست‌وجو" : "Search syntax"}>
          <span className="sb-q">?</span>
        </button>
        {right}
      </div>

      {open && rows.length > 0 && (
        <ul className="sb-list" id={`${id}-list`} role="listbox">
          {String(value || "").trim().length < 2 && (
            <li className="sb-list-head">{fa ? "جست‌وجوهای اخیر" : "Recent searches"}
              <button type="button" className="sb-mini" onMouseDown={(e) => e.preventDefault()} onClick={() => { writeRecent(storageKey, []); setRecent([]); }}>{fa ? "پاک کردن" : "clear"}</button>
            </li>
          )}
          {rows.map((r, i) => (
            <li
              key={`${r.kind}-${r.id ?? r.value ?? r.label}-${i}`}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`sb-opt sb-${r.kind} ${i === active ? "active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(r)}
            >
              <span className="sb-opt-ico">
                <Icon name={r.kind === "recent" ? "clock" : r.kind === "card" ? "book" : "bookmark"} size={13} />
              </span>
              <span className="sb-opt-label"><Prefix text={r.label} q={value} /></span>
              <span className="sb-opt-kind">{kindLabel(r.kind)}{r.count != null ? ` · ${r.count}` : ""}</span>
              {r.kind === "recent" && (
                <button type="button" className="sb-mini" aria-label={fa ? "حذف" : "remove"}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.stopPropagation(); const n = recent.filter((x) => x !== r.label); writeRecent(storageKey, n); setRecent(n); }}>
                  <Icon name="close" size={11} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {help && (
        <div className="sb-help card" role="note">
          <div className="sb-help-title">{fa ? "ترفندهای جست‌وجو" : "Search tips"}</div>
          <dl>
            <dt><code>آسم بارداری</code></dt><dd>{fa ? "هر دو واژه باید باشند" : "both words must appear"}</dd>
            <dt><code>"نارسایی قلب"</code></dt><dd>{fa ? "عبارت دقیق" : "exact phrase"}</dd>
            <dt><code>-کودکان</code></dt><dd>{fa ? "حذفِ نتایج شامل این واژه" : "exclude results with this word"}</dd>
            {(!helpKinds || helpKinds.includes("bank")) && (<>
              <dt><code>سال:1399</code> · <code>ماه:شهریور</code></dt><dd>{fa ? "فیلتر سال / ماهِ آزمون" : "exam year / month filter"}</dd>
              <dt><code>درس:گوارش</code> · <code>فصل:سیروز</code></dt><dd>{fa ? "فیلتر درس / فصل" : "subject / chapter filter"}</dd>
              <dt><code>آزمون:دستیاری</code></dt><dd>{fa ? "پره‌انترنی یا دستیاری" : "pre-internship or residency"}</dd>
            </>)}
            <dt><code>#1234</code></dt><dd>{fa ? "پرش به شناسه" : "jump to an id"}</dd>
          </dl>
          <div className="muted small">{fa ? "ی/ک عربی و فارسی، اعداد فارسی/انگلیسی و نیم‌فاصله یکسان در نظر گرفته می‌شوند." : "Arabic/Persian ي/ی ك/ک, Persian/Latin digits and ZWNJ are treated alike."}</div>
        </div>
      )}
    </div>
  );
}

/* Bold the part that the user has NOT typed yet (Baymard: emphasise the
   predictive portion, not the typed characters). */
function Prefix({ text, q }) {
  const s = String(text || ""), n = String(q || "").trim();
  if (!n) return s;
  const i = s.toLowerCase().indexOf(n.toLowerCase());
  if (i < 0) return s;
  return (<>{s.slice(0, i)}<span className="sb-typed">{s.slice(i, i + n.length)}</span><b>{s.slice(i + n.length)}</b></>);
}

/* <Highlight text ranges> — wraps server-provided [start,end] UTF-16 ranges in
   <mark>. Used by result lists so the learner sees WHY a row matched. */
export function Highlight({ text, ranges, className }) {
  const s = String(text || "");
  if (!ranges || !ranges.length) return <span className={className}>{s}</span>;
  const out = []; let last = 0;
  ranges.forEach(([a, b], i) => {
    if (a > last) out.push(s.slice(last, a));
    out.push(<mark key={i}>{s.slice(a, b)}</mark>);
    last = b;
  });
  if (last < s.length) out.push(s.slice(last));
  return <span className={className}>{out}</span>;
}

/* Client-side highlighter for tables that filter locally (no server ranges):
   marks every whole-word/term of the query, case- and Persian-insensitive. */
export function highlightLocal(text, query) {
  const s = String(text ?? "");
  const terms = String(query || "").trim().split(/\s+/).filter((x) => x && !x.startsWith("-") && x.length > 1).map((x) => x.replace(/^"|"$/g, ""));
  if (!terms.length) return [];
  const flat = normFa(s);
  const ranges = [];
  for (const t of terms) {
    const n = normFa(t); let from = 0, i;
    while (n && (i = flat.indexOf(n, from)) >= 0 && ranges.length < 30) { ranges.push([i, i + n.length]); from = i + n.length; }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) { const l = merged[merged.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push(r); }
  return merged;
}
/* Length-preserving Persian normalisation (char → char) so indices map 1:1. */
export function normFa(s) {
  return String(s ?? "").toLowerCase()
    .replace(/[ي]/g, "ی").replace(/[ك]/g, "ک").replace(/[ة]/g, "ه").replace(/[أإآ]/g, "ا").replace(/[ؤ]/g, "و").replace(/[ئ]/g, "ی")
    .replace(/[\u200c\u00a0]/g, " ")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function readRecent(key) {
  try { const v = JSON.parse(safeLocal.getItem(`sb_recent_${key}`) || "[]"); return Array.isArray(v) ? v.slice(0, 8) : []; } catch { return []; }
}
function writeRecent(key, list) { try { safeLocal.setItem(`sb_recent_${key}`, JSON.stringify(list.slice(0, 8))); } catch { /* */ } }
function pushRecent(key, q) {
  const list = [q, ...readRecent(key).filter((x) => x !== q)].slice(0, 8);
  writeRecent(key, list);
  return list;
}
