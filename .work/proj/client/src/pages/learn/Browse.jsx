import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { Spinner, Modal } from "../../components/UI.jsx";
import { TYPE_MAP, MicroLesson } from "./QuestionTypes.jsx";
import Emphasis from "../../components/Emphasis.jsx";
import SearchBox, { Highlight, normFa } from "../../components/SearchBox.jsx";

/* Learner-facing question browser — beautiful redesign 2026-10.
 * Baymard/NNg: OR inside facet, AND across, honest counts, hash-state,
 * glass cards, system gradients, sticky toolbar.
 */

const FACETS = [
  { key: "subject", label: "examSubjectLabel", icon: "book" },
  { key: "examType", label: "examTypeLabel", icon: "exam" },
  { key: "chapter", label: "chapterLabel", dependsOn: "subject", icon: "layers" },
  { key: "concept", label: "conceptLabel", dependsOn: "chapter", icon: "bulb" },
  { key: "year", label: "examYearLabel", icon: "calendar" },
  { key: "month", label: "examMonthLabel", icon: "clock" },
  { key: "sitting", label: "sittingLabel", localize: true, icon: "clock" },
  { key: "scope", label: "scopeLabel", icon: "target" },
  { key: "exam", label: "examSittingLabel", icon: "exam" },
  { key: "style", label: "styleLabel", localize: true, icon: "edit" },
  { key: "difficulty", label: "difficulty", localize: true, icon: "zap" },
  { key: "qtype", label: "questionTypeLabel", localize: true, icon: "list" },
  { key: "origin", label: "originLabel", localize: true, icon: "shield" },
];
const PRIMARY = ["subject", "examType", "chapter", "year"];
const EMPTY = Object.fromEntries(FACETS.map((f) => [f.key, []]));

const SUBJECT_GRAD = {
  "داخلی": "from-emerald-500 to-teal-600",
  "جراحی": "from-rose-500 to-pink-600",
  "کودکان": "from-sky-500 to-blue-600",
  "زنان": "from-fuchsia-500 to-purple-600",
  "اعصاب": "from-amber-500 to-orange-600",
  "روان": "from-violet-500 to-indigo-600",
  "پوست": "from-lime-500 to-emerald-600",
  "چشم": "from-cyan-500 to-sky-600",
  "گوش": "from-slate-500 to-gray-600",
  "ارتوپدی": "from-orange-500 to-red-600",
  "رادیو": "from-zinc-500 to-neutral-600",
  "پاتولوژی": "from-pink-500 to-rose-600",
  "فارما": "from-indigo-500 to-violet-600",
  "بهداشت": "from-teal-500 to-cyan-600",
  "default": "from-slate-500 to-slate-600",
};
function subjGrad(s) {
  if (!s) return SUBJECT_GRAD.default;
  for (const k of Object.keys(SUBJECT_GRAD)) if (s.includes(k)) return SUBJECT_GRAD[k];
  return SUBJECT_GRAD.default;
}
const DIFF_COLOR = { easy: "emerald", medium: "amber", hard: "rose" };

function readHash() {
  try {
    const h = window.location.hash || "";
    const i = h.indexOf("?");
    if (!h.startsWith("#browse") || i < 0) return null;
    const p = new URLSearchParams(h.slice(i + 1));
    const fil = { ...EMPTY };
    for (const f of FACETS) { const v = p.get(f.key); if (v) fil[f.key] = v.split(",").filter(Boolean); }
    return { fil, term: p.get("q") || "", sort: p.get("sort") || "", page: Number(p.get("page")) || 1 };
  } catch { return null; }
}
function writeHash(fil, term, sort, page) {
  try {
    const p = new URLSearchParams();
    for (const f of FACETS) if (fil[f.key]?.length) p.set(f.key, fil[f.key].join(","));
    if (term) p.set("q", term);
    if (sort) p.set("sort", sort);
    if (page > 1) p.set("page", String(page));
    const next = `#browse${p.toString() ? "?" + p.toString() : ""}`;
    if (window.location.hash !== next) window.history.replaceState(null, "", next);
  } catch { /* */ }
}

export default function Browse() {
  const { t, lang, flag } = useApp();
  const fa = lang !== "en";
  const init = useMemo(readHash, []);
  const [fil, setFil] = useState(init?.fil || EMPTY);
  const [term, setTerm] = useState(init?.term || "");
  const [query, setQuery] = useState(init?.term || "");
  const [sort, setSort] = useState(init?.sort || "");
  const [page, setPage] = useState(init?.page || 1);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const [showFil, setShowFil] = useState(false);
  const [more, setMore] = useState(false);
  const [facetQ, setFacetQ] = useState({});
  const cache = useRef(new Map());

  const vLabel = (facet, v) => {
    const map = {
      sitting: { main: t("sittingMain"), midterm: t("sittingMid") },
      style: { case: t("styleCase"), recall: t("styleRecall"), negative: t("styleNegative"), image: t("styleImage") },
      difficulty: { easy: t("easy"), medium: t("medium"), hard: t("hard") },
      examType: { "دستیاری": t("examTypeResidency"), "پره‌انترنی": t("examTypePreint") },
      qtype: { mcq: t("qtMcq"), truefalse: t("qtTruefalse"), fill: t("qtFill"), match: t("qtMatch"), order: t("qtOrder"), compare: t("qtCompare"), image: t("qtMcq") },
      origin: { official_exam: t("originOfficial"), demo_seed: t("originDemo"), authored: t("originAuthored") },
    };
    return map[facet]?.[v] || v;
  };

  const qs = useMemo(() => {
    const p = new URLSearchParams({ lang, page: String(page), per: "20" });
    if (sort) p.set("sort", sort);
    for (const [k, v] of Object.entries(fil)) if (v?.length) p.set(k, v.join(","));
    if (query.trim()) p.set("q", query.trim());
    return p.toString();
  }, [fil, query, sort, page, lang]);

  useEffect(() => { writeHash(fil, query, sort, page); }, [fil, query, sort, page]);

  useEffect(() => {
    let alive = true;
    const hit = cache.current.get(qs);
    if (hit) setData(hit);
    setBusy(!hit);
    api.get(`/learn/browse?${qs}`)
      .then((d) => { if (!alive) return; cache.current.set(qs, d); setData(d); })
      .catch(() => { if (alive && !hit) setData({ cards: [], total: 0, facets: {} }); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [qs]);

  useEffect(() => {
    if (!data || busy) return;
    const pages = Math.max(1, Math.ceil((data.total || 0) / 20));
    if (page >= pages) return;
    const p = new URLSearchParams(qs); p.set("page", String(page + 1));
    const nq = p.toString();
    if (cache.current.has(nq)) return;
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 400));
    const h = idle(() => api.get(`/learn/browse?${nq}`).then((d) => cache.current.set(nq, d)).catch(() => {}));
    return () => (window.cancelIdleCallback || clearTimeout)(h);
  }, [data, busy, page, qs]);

  const toggle = (k, v) => {
    setPage(1);
    setFil((s) => {
      const cur = s[k] || [];
      const next = { ...s, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
      if (k === "subject") { next.chapter = []; next.concept = []; }
      if (k === "chapter") next.concept = [];
      return next;
    });
  };
  const resetAll = () => { setFil(EMPTY); setTerm(""); setQuery(""); setSort(""); setPage(1); };

  const suggest = useCallback((q) => api.get(`/learn/browse/suggest?lang=${lang}&q=${encodeURIComponent(q)}`).then((d) => d.suggestions || []).catch(() => []), [lang]);
  const onPick = (sug) => {
    if (sug.kind === "card") { setOpen(sug.id); return; }
    if (["subject", "chapter", "concept", "exam"].includes(sug.kind)) {
      setTerm(""); setQuery("");
      setPage(1);
      setFil((s) => ({ ...s, [sug.kind]: [sug.value] }));
      return;
    }
    setTerm(sug.label); setQuery(sug.label);
  };

  const activeChips = [];
  for (const f of FACETS) for (const v of (fil[f.key] || [])) activeChips.push({ key: f.key, value: v, label: f.localize || f.key === "examType" ? vLabel(f.key, v) : (facetLabel(data?.facets, f.key, v) || v), facet: t(f.label), icon: f.icon });
  const active = activeChips.length + (query.trim() ? 1 : 0);
  const facets = data?.facets || {};
  const total = data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / 20));
  const ranked = !!data?.query;
  const effSort = sort || (ranked ? "relevance" : "newest_exam");

  const facetOptions = (f) => {
    let opts = facets[f.key] || [];
    if (f.key === "chapter" && fil.subject.length) opts = opts.filter((o) => fil.subject.includes(o.subject));
    if (f.key === "concept") {
      if (fil.subject.length) opts = opts.filter((o) => fil.subject.includes(o.subject));
      if (fil.chapter.length) opts = opts.filter((o) => fil.chapter.includes(o.chapter));
    }
    const fq = normFa((facetQ[f.key] || "").trim());
    if (fq) opts = opts.filter((o) => normFa(o.label || o.value).includes(fq) || normFa(vLabel(f.key, o.value)).includes(fq));
    const sel = new Set(fil[f.key] || []);
    return [...opts].sort((a, b) => (sel.has(b.value) - sel.has(a.value)) || (b.count - a.count));
  };

  return (
    <div className="browse-page" style={{ maxWidth: 980, margin: "0 auto", padding: "0 4px" }}>
      {/* ===== Beautiful header — glass + gradient ===== */}
      <div className="browse-hero">
        <div className="browse-hero-glow" aria-hidden="true" />
        <div className="browse-hero-inner">
          <div className="browse-hero-icon">
            <Icon name="search" size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="browse-hero-title">{t("browseTitle")}</h2>
            <p className="browse-hero-sub">{t("browseDesc")}</p>
          </div>
          <div className="browse-hero-actions">
            {flag("custom_test") && (
              <button type="button" className="btn btn-ghost browse-hero-cta" onClick={() => window.dispatchEvent(new CustomEvent("medlab-go", { detail: "customTest" }))}>
                <Icon name="exam" size={15} /> {fa ? "آزمون‌ساز" : "Create test"}
              </button>
            )}
            <button type="button" className={`browse-filter-btn ${showFil || activeChips.length ? "on" : ""}`} onClick={() => setShowFil((v) => !v)} aria-expanded={showFil}>
              <Icon name="settings" size={15} />
              <span>{t("browseFilters")}</span>
              {activeChips.length > 0 && <span className="browse-filter-badge">{activeChips.length}</span>}
            </button>
          </div>
        </div>
        {/* stats pills */}
        <div className="browse-hero-stats">
          <span className="browse-stat-pill">
            <span className="browse-stat-dot" style={{ background: "#0ea5e9" }} />
            {busy && !data ? <Spinner /> : <><b>{total.toLocaleString(fa ? "fa-IR" : "en-US")}</b> {fa ? "سؤال" : "questions"}</>}
          </span>
          {data?.bankTotal != null && data.bankTotal !== total && (
            <span className="browse-stat-pill muted">{fa ? "از" : "of"} {data.bankTotal.toLocaleString(fa ? "fa-IR" : "en-US")} {fa ? "کل بانک" : "total"}</span>
          )}
          {active > 0 && <span className="browse-stat-pill accent">{active} {fa ? "فیلتر فعال" : "active filters"}</span>}
          {ranked && <span className="browse-stat-pill" style={{ background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" }}>✨ {fa ? "مرتبط‌ترین" : "ranked"}</span>}
        </div>
      </div>

      {/* ===== Search — glass card ===== */}
      <div className="browse-search-card browse-search-card--glass">
        <SearchBox
          value={term}
          onChange={setTerm}
          onSearch={(q) => { setQuery(q); setPage(1); }}
          suggest={suggest}
          onPick={onPick}
          placeholder={t("browseSearch")}
          storageKey="bank"
        />
      </div>

      {/* Quick filters — AMBOSS/UWorld inspired: system pills + hammer difficulty (instant) */}
      <div className="browse-quick browse-quick--glass">
        <div className="browse-quick-row">
          <span className="browse-quick-label"><Icon name="layers" size={12} /> {fa?"سیستم":"System"}</span>
          <div className="browse-quick-chips">
            {(facets.subject || []).slice().sort((a,b)=>b.count-a.count).slice(0,9).map(o=>{
              const on = (fil.subject||[]).includes(o.value);
              const grad = subjGrad(o.value || o.label);
              return (
                <button key={o.value} type="button" onClick={()=>toggle("subject", o.value)} className={`browse-quick-chip ${on?"on":""}`} style={on?{}:{}}>
                  <span className={`browse-quick-chip-grad bg-gradient-to-r ${grad}`} aria-hidden="true" style={on?{opacity:.18}:{}} />
                  <span className="bqc-label">{o.label || o.value}</span>
                  <span className="bqc-count">{o.count}</span>
                </button>
              );
            })}
            {(facets.subject||[]).length===0 && <span className="small muted">{fa?"در حال بارگذاری…":"Loading systems…"}</span>}
          </div>
          <button type="button" className="browse-quick-more" onClick={()=>setShowFil(true)}><Icon name="settings" size={12} /> {fa?"همهٔ فیلترها":"All filters"} {activeChips.length?`· ${activeChips.length}`:""}</button>
        </div>
        <div className="browse-quick-row">
          <span className="browse-quick-label">🔨 {fa?"سختی":"Hammers"}</span>
          <div className="browse-quick-chips">
            {["easy","medium","hard"].map(lvl=>{
              const on = (fil.difficulty||[]).includes(lvl);
              const map = { easy:{ fa:"آسان", en:"Easy", h:"🔨", c:"#10b981", bg:"#ecfdf5", bd:"#a7f3d0" }, medium:{ fa:"متوسط", en:"Medium", h:"🔨🔨", c:"#f59e0b", bg:"#fffbeb", bd:"#fde68a" }, hard:{ fa:"سخت", en:"Hard", h:"🔨🔨🔨", c:"#ef4444", bg:"#fef2f2", bd:"#fecaca" } }[lvl];
              return (
                <button key={lvl} type="button" onClick={()=>toggle("difficulty", lvl)} className={`browse-quick-chip browse-quick-hammer ${on?"on":""}`} style={on?{ background: map.c, color:"#fff", borderColor: map.c, boxShadow:`0 6px 14px ${map.c}33` }:{ background: map.bg, color: map.c, borderColor: map.bd }}>
                  <span>{map.h}</span> {fa?map.fa:map.en} <span className="bqc-count" style={{ background: on?"rgba(255,255,255,.22)":"#fff", color: on?"#fff":map.c, border:`1px solid ${on?"rgba(255,255,255,.4)":map.bd}` }}>{(facets.difficulty||[]).find(x=>x.value===lvl)?.count ?? ""}</span>
                </button>
              );
            })}
            <span className="small muted" style={{ marginInlineStart:6, fontSize:".72rem" }}>{fa?"OR درون، AND بینِ فاست‌ها":"OR inside, AND across"}</span>
          </div>
        </div>
      </div>

      {/* ===== Active chips — colorful pills ===== */}
      {(activeChips.length > 0 || query.trim()) && (
        <div className="fchips browse-active-chips" aria-label={fa ? "فیلترهای فعال" : "Active filters"}>
          {query.trim() && (
            <span className="fchip fchip-query">
              <Icon name="search" size={12} />
              <small>{fa ? "متن:" : "text:"}</small> {query}
              <button type="button" onClick={() => { setTerm(""); setQuery(""); setPage(1); }} aria-label={fa ? "حذف" : "remove"}><Icon name="close" size={11} /></button>
            </span>
          )}
          {activeChips.map((c) => (
            <span className="fchip" key={`${c.key}:${c.value}`}>
              <Icon name={c.icon || "tag"} size={11} style={{ opacity: .7 }} />
              <small>{c.facet}:</small> {c.label}
              <button type="button" onClick={() => toggle(c.key, c.value)} aria-label={fa ? "حذف" : "remove"}><Icon name="close" size={11} /></button>
            </span>
          ))}
          <button type="button" className="fchip-clear" onClick={resetAll}><Icon name="close" size={12} /> {t("browseReset")}</button>
        </div>
      )}

      {/* ===== Filter sheet — beautiful glass ===== */}
      {showFil && <div className="fsheet-back" onClick={() => setShowFil(false)} aria-hidden="true" />}
      {showFil && (
        <div className="card browse-filters browse-filters-new" role="dialog" aria-label={t("browseFilters")}>
          <div className="browse-filters-head">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#0ea5e9,#6366f1)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><Icon name="settings" size={16} /></span>
              <div>
                <div style={{ fontWeight: 800, fontSize: ".92rem" }}>{t("browseFilters")}</div>
                <div className="small muted">{active} {fa ? "فیلتر فعال" : "active"} · {total.toLocaleString(fa ? "fa-IR" : "en-US")} {fa ? "نتیجه" : "results"}</div>
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowFil(false)}><Icon name="close" size={14} /></button>
          </div>
          <div className="facet-panel">
            {FACETS.filter((f) => more || PRIMARY.includes(f.key) || fil[f.key]?.length).map((f) => {
              const opts = facetOptions(f);
              const allOpts = facets[f.key] || [];
              if (!allOpts.length && !fil[f.key]?.length) return null;
              const n = fil[f.key]?.length || 0;
              return (
                <details className="facet facet-new" key={f.key} open={PRIMARY.includes(f.key) || n > 0}>
                  <summary>
                    <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span className="facet-ico"><Icon name={f.icon} size={13} /></span>
                      {t(f.label)}
                    </span>
                    {n > 0 ? <span className="cnt facet-cnt-on">{n}</span> : <span className="facet-count-muted">{allOpts.length}</span>}
                  </summary>
                  {allOpts.length > 8 && (
                    <input className="facet-search" value={facetQ[f.key] || ""} onChange={(e) => setFacetQ((s) => ({ ...s, [f.key]: e.target.value }))}
                      placeholder={fa ? "فیلتر گزینه‌ها…" : "Filter options…"} aria-label={`${t(f.label)} ${fa ? "جست‌وجو" : "search"}`} />
                  )}
                  <div className="facet-opts" role="group" aria-label={t(f.label)}>
                    {opts.slice(0, 60).map((o) => {
                      const on = (fil[f.key] || []).includes(o.value);
                      return (
                        <label className={`facet-opt ${!o.count && !on ? "zero" : ""} ${on ? "on" : ""}`} key={o.value}>
                          <input type="checkbox" checked={on} onChange={() => toggle(f.key, o.value)} />
                          <span className="lbl">{(f.localize || f.key === "examType") ? vLabel(f.key, o.value) : o.label}</span>
                          <span className="n">{o.count}</span>
                        </label>
                      );
                    })}
                    {!opts.length && <div className="muted small" style={{ padding: 6 }}>{fa ? "گزینه‌ای نیست" : "No options"}</div>}
                  </div>
                </details>
              );
            })}
          </div>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setMore((v) => !v)}>
              <Icon name={more ? "chevronUp" : "chevronDown"} size={13} /> {more ? (fa ? "فیلترهای کمتر" : "Fewer filters") : (fa ? "فیلترهای بیشتر +" : "More filters")}
            </button>
            {active > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={resetAll}>
                <Icon name="close" size={13} /> {t("browseReset")}
              </button>
            )}
          </div>
          <div className="fsheet-foot">
            {activeChips.length > 0 && <button type="button" className="btn btn-ghost" onClick={() => { setFil(EMPTY); setPage(1); }}>{t("browseReset")}</button>}
            <button type="button" className="btn btn-primary" onClick={() => setShowFil(false)}>
              {busy ? <Spinner /> : (fa ? `نمایش ${total.toLocaleString("fa-IR")} سؤال` : `Show ${total.toLocaleString()} results`)}
            </button>
          </div>
        </div>
      )}

      {data?.premiumRequired && (
        <div className="browse-premium-gate-new">
          <div className="browse-premium-glow" aria-hidden="true" />
          <div style={{ position: "relative", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#f59e0b,#f97316)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, flex: "none", boxShadow: "0 8px 20px rgba(245,158,11,.35)" }}>👑</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 900, fontSize: "1rem" }}>{t("browsePremiumTitle")}</div>
              <p className="muted small" style={{ margin: "4px 0 0", lineHeight: 1.7 }}>{t("browsePremiumBody")}</p>
            </div>
            <button className="btn btn-accent" type="button" onClick={() => window.dispatchEvent(new CustomEvent("medlab-go", { detail: "premium" }))} style={{ boxShadow: "0 8px 20px rgba(245,158,11,.3)" }}>
              <Icon name="crown" size={15} /> {t("browseGoPremium")}
            </button>
          </div>
        </div>
      )}

      {/* ===== Toolbar — glass segmented ===== */}
      <div className="browse-toolbar browse-toolbar-new">
        <div className="muted small" role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {busy && !data ? <Spinner /> : (
            <>
              <span className="browse-toolbar-count"><b>{total.toLocaleString(fa ? "fa-IR" : "en-US")}</b> {fa ? "سؤال" : "results"}</span>
              {data?.bankTotal != null && data.bankTotal !== total && <span className="muted">· {fa ? "از" : "of"} {data.bankTotal.toLocaleString(fa ? "fa-IR" : "en-US")}</span>}
              {busy && <span className="muted"> …</span>}
            </>
          )}
        </div>
        <div className="seg seg-new" role="radiogroup" aria-label={t("sortByLabel")}>
          {ranked && <button type="button" role="radio" aria-checked={effSort === "relevance"} className={effSort === "relevance" ? "on" : ""} onClick={() => setSort("relevance")}>✨ {fa ? "مرتبط‌ترین" : "Relevance"}</button>}
          <button type="button" role="radio" aria-checked={effSort === "newest_exam"} className={effSort === "newest_exam" ? "on" : ""} onClick={() => setSort("newest_exam")}>{t("sort_newest_exam")}</button>
          <button type="button" role="radio" aria-checked={effSort === "oldest_exam"} className={effSort === "oldest_exam" ? "on" : ""} onClick={() => setSort("oldest_exam")}>{t("sort_oldest_exam")}</button>
          <button type="button" role="radio" aria-checked={effSort === "last_modified"} className={effSort === "last_modified" ? "on" : ""} onClick={() => setSort("last_modified")}>{t("sort_last_modified")}</button>
        </div>
      </div>

      {busy && !data && <div aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <div className="browse-sk" key={i} />)}</div>}

      {!busy && !total && (
        <div className="card browse-empty-new" role="status">
          <div style={{ fontSize: 42, lineHeight: 1, marginBottom: 10 }}>🔍</div>
          <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>{t("browseEmpty")}</div>
          <p className="muted small" style={{ margin: "6px 0 0", maxWidth: 420, marginInline: "auto", lineHeight: 1.7 }}>{fa ? "فیلترها را کم کنید یا عبارت دیگری جست‌وجو کنید." : "Try fewer filters or a different query."}</p>
          {(activeChips.length > 0 || query.trim()) && (
            <div className="browse-empty-tips" style={{ marginTop: 14 }}>
              {query.trim() && <button type="button" onClick={() => { setTerm(""); setQuery(""); setPage(1); }}>{fa ? "حذف متن جست‌وجو" : "Remove search text"}</button>}
              {activeChips.slice(-2).reverse().map((c) => (
                <button type="button" key={`${c.key}:${c.value}`} onClick={() => toggle(c.key, c.value)}>{fa ? `حذف «${c.label}»` : `Remove "${c.label}"`}</button>
              ))}
              <button type="button" onClick={resetAll} className="browse-empty-reset">{t("browseReset")}</button>
            </div>
          )}
        </div>
      )}

      <ul className="browse-list browse-list-new">
        {(data?.cards || []).map((c) => {
          const grad = subjGrad(c.subject);
          const diff = c.difficulty ? DIFF_COLOR[c.difficulty] : null;
          return (
            <li key={c.id} className="browse-item browse-item-new card">
              <div className={`browse-item-accent bg-gradient-to-r ${grad}`} aria-hidden="true" />
              <button type="button" className="browse-item-main" onClick={() => setOpen(c.id)}>
                <div className="browse-item-top">
                  <Highlight className="browse-q" text={c.q} ranges={c.hl} />
                  <span className="browse-go"><Icon name="chevronDown" size={14} style={{ transform: "rotate(-90deg)" }} /></span>
                </div>
                <div className="browse-meta browse-meta-new">
                  {c.subject && !fil.subject.length && <span className="chip chip-subject">{c.subject}</span>}
                  {c.chapter && <span className="chip chip-chapter">{c.chapter}</span>}
                  {c.concept && <span className="chip chip-soft">{c.concept}</span>}
                  {c.examType && <span className="chip chip-examtype">{vLabel("examType", c.examType)}</span>}
                  {c.exam && <span className="chip chip-exam" dir="auto">{c.exam}</span>}
                  {c.difficulty && <span className={`chip chip-diff chip-diff-${c.difficulty}`}>{vLabel("difficulty", c.difficulty)}</span>}
                  {c.keyless && <span className="chip chip-keyless" title={t("keylessTitle")}>🔑 {t("keylessBadge")}</span>}
                  {c.style && <span className="chip chip-soft">{vLabel("style", c.style)}</span>}
                  {c.saved && <span className="chip chip-soft" title={fa ? "ذخیره‌شده" : "saved"}>★</span>}
                  {c.attempted && <span className="chip chip-done"><Icon name="check" size={11} /> {fa ? "حل‌شده" : "done"}</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {pages > 1 && (
        <div className="browse-pager browse-pager-new">
          <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label={t("prev")}>‹ {fa ? "قبلی" : "Prev"}</button>
          <span className="browse-pager-info" dir="ltr" aria-live="polite"><b>{page}</b> / {pages}</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label={t("next")}>{fa ? "بعدی" : "Next"} ›</button>
        </div>
      )}

      {open != null && <BrowseCard id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function facetLabel(facets, key, value) {
  const o = (facets?.[key] || []).find((x) => x.value === value);
  return o ? o.label : "";
}

function BrowseCard({ id, onClose }) {
  const { t, lang } = useApp();
  const fa = lang !== "en";
  const [card, setCard] = useState(null);
  const [err, setErr] = useState(null);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    setSel(null); setChecked(false); setCard(null); setErr(null);
    api.get(`/learn/browse/${id}`).then((d) => setCard(d.card)).catch((e) => {
      const msg = e?.message || "";
      if (/402|premium/i.test(msg) || e?.status === 402) setErr("premium");
      else if (/404|not found/i.test(msg)) setErr("notfound");
      else setErr(msg || "error");
    });
  }, [id]);

  const Body = card ? (TYPE_MAP[card.type] || TYPE_MAP.mcq) : null;
  const keyless = !!(card?.source_meta && (card.source_meta.keyless || card.source_meta.key_available === false));
  const canCheck = card && Body && !keyless && (Body.canCheck ? Body.canCheck({ sel }, card) : sel != null);

  return (
    <Modal onClose={onClose} title={t("browseStudy")} wide>
      {err === "premium" ? (
        <div className="browse-preview-premium">
          <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 10 }}>👑</div>
          <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>{t("browsePremiumTitle")}</div>
          <p className="muted small" style={{ margin: "8px 0 16px", lineHeight: 1.8, maxWidth: 420, marginInline: "auto" }}>{t("browsePremiumBody")}</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn btn-accent" type="button" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent("medlab-go", { detail: "premium" })); }}>
              <Icon name="crown" size={15} /> {t("browseGoPremium")}
            </button>
            <button className="btn btn-ghost" type="button" onClick={onClose}>{t("close") || (fa ? "بستن" : "Close")}</button>
          </div>
        </div>
      ) : err ? (
        <div className="card empty-state">
          <div className="ico">⚠️</div>
          <h3>{err === "notfound" ? (fa ? "سؤال یافت نشد" : "Not found") : err}</h3>
          <button type="button" className="btn btn-ghost mt16" onClick={onClose}>{t("close") || (fa ? "بستن" : "Close")}</button>
        </div>
      ) : !card ? (
        <div style={{ padding: 24, display: "flex", justifyContent: "center" }}><Spinner /></div>
      ) : (
        <div className="browse-preview browse-preview-new">
          {card.subject && <div className="browse-preview-meta"><span className="chip chip-subject">{card.subject}</span>{card.chapter && <span className="chip chip-chapter">{card.chapter}</span>}{card.exam && <span className="chip chip-exam">{card.exam}</span>}</div>}
          <p className="browse-preview-q">{card.q}</p>
          <Body card={card} checked={checked} sel={sel} setSel={setSel} isCorrect={checked && Body.judge?.(card, { sel })} />
          {keyless && (
            <div className="explain-box mt12" style={{ background: "rgba(213,160,27,.10)", borderColor: "#fde68a" }}>
              <b>🔑 {t("keylessTitle")}</b>
              <Emphasis as="p" text={t("keylessNotice")} />
            </div>
          )}
          {!checked && !keyless && (
            <button type="button" className="btn btn-primary mt12" disabled={!canCheck} onClick={() => setChecked(true)}>
              {t("checkAnswer") || "بررسی"} <Icon name="check" size={14} />
            </button>
          )}
          {keyless && card.explain?.text && (
            <div className="explain-box mt12"><b>{t("answerKey")}</b><Emphasis as="p" text={card.explain.text} /></div>
          )}
          {checked && card.explain?.text && (
            <div className="explain-box mt12"><b>{t("answerKey")}</b><Emphasis as="p" text={card.explain.text} /></div>
          )}
          {checked && <MicroLesson micro={card.micro} defaultOpen />}
        </div>
      )}
    </Modal>
  );
}
