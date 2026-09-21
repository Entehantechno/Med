import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { Spinner, Modal } from "../../components/UI.jsx";
import { TYPE_MAP, MicroLesson } from "./QuestionTypes.jsx";
import Emphasis from "../../components/Emphasis.jsx";
import SearchBox, { Highlight, normFa } from "../../components/SearchBox.jsx";

/* Learner-facing question browser.
 *
 * The learning path decides what you SHOULD study next; this page is for when
 * you already know what you want — "headache questions from 1404", "every
 * negative-stem item in Neurology". It exposes the same classification the
 * admin has, with the two rules faceted search is expected to follow:
 * OR inside one facet, AND across facets.
 *
 * Counts next to each option come from the server, recomputed against the
 * other active filters, so the numbers stay honest as you drill down and an
 * option that would return nothing is never offered.
 */

const FACETS = [
  { key: "subject", label: "examSubjectLabel" },
  { key: "examType", label: "examTypeLabel" },
  { key: "chapter", label: "chapterLabel", dependsOn: "subject" },
  { key: "concept", label: "conceptLabel", dependsOn: "chapter" },
  { key: "year", label: "examYearLabel" },
  { key: "month", label: "examMonthLabel" },
  { key: "sitting", label: "sittingLabel", localize: true },
  { key: "scope", label: "scopeLabel" },
  { key: "exam", label: "examSittingLabel" },
  { key: "style", label: "styleLabel", localize: true },
  { key: "difficulty", label: "difficulty", localize: true },
];
const PRIMARY = ["subject", "examType", "chapter", "year"];   // open by default; the rest sit under "more"
const EMPTY = Object.fromEntries(FACETS.map((f) => [f.key, []]));

/* Filter state lives in the URL hash (#browse?subject=…&q=…) so back/forward,
   refresh and sharing a search all work — Baymard: "non-canonical URLs reset
   filters" is a top-3 filter complaint. */
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
  const [term, setTerm] = useState(init?.term || "");        // what is in the box
  const [query, setQuery] = useState(init?.term || "");      // what we search (debounced)
  const [sort, setSort] = useState(init?.sort || "");        // "" = smart default
  const [page, setPage] = useState(init?.page || 1);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);      // card being previewed
  const [showFil, setShowFil] = useState(false);
  const [more, setMore] = useState(false);
  const [facetQ, setFacetQ] = useState({});    // per-facet quick filter text
  const cache = useRef(new Map());             // qs → response (session SWR)

  // Localised label for the machine values the API returns.
  const vLabel = (facet, v) => {
    const map = {
      sitting: { main: t("sittingMain"), midterm: t("sittingMid") },
      style: { case: t("styleCase"), recall: t("styleRecall"), negative: t("styleNegative"), image: t("styleImage") },
      difficulty: { easy: t("easy"), medium: t("medium"), hard: t("hard") },
      examType: { "دستیاری": t("examTypeResidency"), "پره‌انترنی": t("examTypePreint") },
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
    if (hit) setData(hit);                      // instant paint from session cache …
    setBusy(!hit);
    api.get(`/learn/browse?${qs}`)              // … then revalidate
      .then((d) => { if (!alive) return; cache.current.set(qs, d); setData(d); })
      .catch(() => { if (alive && !hit) setData({ cards: [], total: 0, facets: {} }); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [qs]);

  // Prefetch the next page while the learner reads this one.
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

  // OR inside a facet (toggle a value), AND across facets. Changing a parent
  // clears its children so "Neurology + a Cardiology chapter" cannot happen.
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

  // Autocomplete: scoped facet values + a few stems (server-ranked).
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
  for (const f of FACETS) for (const v of (fil[f.key] || [])) activeChips.push({ key: f.key, value: v, label: f.localize || f.key === "examType" ? vLabel(f.key, v) : (facetLabel(data?.facets, f.key, v) || v), facet: t(f.label) });
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
    // selected values first, then by count
    const sel = new Set(fil[f.key] || []);
    return [...opts].sort((a, b) => (sel.has(b.value) - sel.has(a.value)) || (b.count - a.count));
  };

  return (
    <div className="browse-page">
      <div className="browse-head">
        <div>
          <h2 className="h2"><Icon name="search" size={18} /> {t("browseTitle")}</h2>
          <p className="muted small mb0">{t("browseDesc")}</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {flag("custom_test") && <button className="btn btn-sm btn-accent" onClick={() => window.dispatchEvent(new CustomEvent("medlab-go", { detail: "customTest" }))} title={lang === "fa" ? "از بانک، آزمون دلخواه بساز" : "Build a custom test from the bank"}>
            <Icon name="exam" size={14} /> {lang === "fa" ? "آزمون‌ساز" : "Create test"}
          </button>}
          <button className={`btn btn-sm ${showFil || activeChips.length ? "btn-primary" : "btn-ghost"}`} onClick={() => setShowFil((v) => !v)} aria-expanded={showFil}>
            <Icon name="settings" size={14} /> {t("browseFilters")}{activeChips.length ? ` (${activeChips.length})` : ""}
          </button>
        </div>
      </div>

      <SearchBox
        value={term}
        onChange={setTerm}
        onSearch={(q) => { setQuery(q); setPage(1); }}
        suggest={suggest}
        onPick={onPick}
        placeholder={t("browseSearch")}
        storageKey="bank"
      />

      {(activeChips.length > 0 || query.trim()) && (
        <div className="fchips" aria-label={fa ? "فیلترهای فعال" : "Active filters"}>
          {query.trim() && (
            <span className="fchip"><small>{fa ? "متن:" : "text:"}</small> {query}
              <button type="button" onClick={() => { setTerm(""); setQuery(""); setPage(1); }} aria-label={fa ? "حذف" : "remove"}><Icon name="close" size={11} /></button>
            </span>
          )}
          {activeChips.map((c) => (
            <span className="fchip" key={`${c.key}:${c.value}`}><small>{c.facet}:</small> {c.label}
              <button type="button" onClick={() => toggle(c.key, c.value)} aria-label={fa ? "حذف" : "remove"}><Icon name="close" size={11} /></button>
            </span>
          ))}
          <button type="button" className="fchip-clear" onClick={resetAll}>{t("browseReset")}</button>
        </div>
      )}

      {showFil && <div className="fsheet-back" onClick={() => setShowFil(false)} aria-hidden="true" />}
      {showFil && (
        <div className="card browse-filters" role="dialog" aria-label={t("browseFilters")}>
          <div className="facet-panel">
            {FACETS.filter((f) => more || PRIMARY.includes(f.key) || fil[f.key]?.length).map((f) => {
              const opts = facetOptions(f);
              const allOpts = facets[f.key] || [];
              if (!allOpts.length && !fil[f.key]?.length) return null;
              const n = fil[f.key]?.length || 0;
              return (
                <details className="facet" key={f.key} open={PRIMARY.includes(f.key) || n > 0}>
                  <summary>
                    <span>{t(f.label)}</span>
                    {n > 0 ? <span className="cnt">{n}</span> : <Icon name="menu" size={13} />}
                  </summary>
                  {allOpts.length > 8 && (
                    <input className="facet-search" value={facetQ[f.key] || ""} onChange={(e) => setFacetQ((s) => ({ ...s, [f.key]: e.target.value }))}
                      placeholder={fa ? "فیلتر گزینه‌ها…" : "Filter options…"} aria-label={`${t(f.label)} ${fa ? "جست‌وجو" : "search"}`} />
                  )}
                  <div className="facet-opts" role="group" aria-label={t(f.label)}>
                    {opts.slice(0, 60).map((o) => {
                      const on = (fil[f.key] || []).includes(o.value);
                      return (
                        <label className={`facet-opt ${!o.count && !on ? "zero" : ""}`} key={o.value}>
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
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setMore((v) => !v)}>
              {more ? (fa ? "فیلترهای کمتر" : "Fewer filters") : (fa ? "فیلترهای بیشتر" : "More filters")}
            </button>
            {active > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={resetAll}>
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
        <div className="card browse-premium-gate">
          <div style={{ fontWeight: 800 }}>{t("browsePremiumTitle")}</div>
          <p className="muted small">{t("browsePremiumBody")}</p>
          <button className="btn btn-accent" type="button" onClick={() => window.dispatchEvent(new CustomEvent("medlab-go", { detail: "premium" }))}>
            <Icon name="crown" size={15} /> {t("browseGoPremium")}
          </button>
        </div>
      )}

      <div className="browse-toolbar">
        <div className="muted small" role="status" aria-live="polite">
          {busy && !data ? <Spinner /> : (
            <>
              {t("browseResults").replace("{n}", total.toLocaleString(fa ? "fa-IR" : "en-US"))}
              {data?.bankTotal != null && data.bankTotal !== total && <> · <span title={fa ? "کل بانک" : "whole bank"}>{fa ? "از" : "of"} {data.bankTotal.toLocaleString(fa ? "fa-IR" : "en-US")}</span></>}
              {busy && <span className="muted"> …</span>}
            </>
          )}
        </div>
        <div className="seg" role="radiogroup" aria-label={t("sortByLabel")}>
          {ranked && <button type="button" role="radio" aria-checked={effSort === "relevance"} className={effSort === "relevance" ? "on" : ""} onClick={() => setSort("relevance")}>{fa ? "مرتبط‌ترین" : "Relevance"}</button>}
          <button type="button" role="radio" aria-checked={effSort === "newest_exam"} className={effSort === "newest_exam" ? "on" : ""} onClick={() => setSort("newest_exam")}>{t("sort_newest_exam")}</button>
          <button type="button" role="radio" aria-checked={effSort === "oldest_exam"} className={effSort === "oldest_exam" ? "on" : ""} onClick={() => setSort("oldest_exam")}>{t("sort_oldest_exam")}</button>
          <button type="button" role="radio" aria-checked={effSort === "last_modified"} className={effSort === "last_modified" ? "on" : ""} onClick={() => setSort("last_modified")}>{t("sort_last_modified")}</button>
        </div>
      </div>

      {busy && !data && <div aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <div className="browse-sk" key={i} />)}</div>}

      {!busy && !total && (
        <div className="card muted center pad24" role="status">
          <div>{t("browseEmpty")}</div>
          {/* zero-result recovery: offer the single removal most likely to help */}
          {(activeChips.length > 0 || query.trim()) && (
            <div className="browse-empty-tips">
              {query.trim() && <button type="button" onClick={() => { setTerm(""); setQuery(""); setPage(1); }}>{fa ? "حذف متن جست‌وجو" : "Remove search text"}</button>}
              {activeChips.slice(-2).reverse().map((c) => (
                <button type="button" key={`${c.key}:${c.value}`} onClick={() => toggle(c.key, c.value)}>{fa ? `حذف «${c.label}»` : `Remove "${c.label}"`}</button>
              ))}
              <button type="button" onClick={resetAll}>{t("browseReset")}</button>
            </div>
          )}
        </div>
      )}

      <ul className="browse-list">
        {(data?.cards || []).map((c) => (
          <li key={c.id} className="browse-item card">
            <button className="browse-item-main" onClick={() => setOpen(c.id)}>
              <Highlight className="browse-q" text={c.q} ranges={c.hl} />
              <div className="browse-meta">
                {c.subject && !fil.subject.length && <span className="chip">{c.subject}</span>}
                {c.chapter && <span className="chip">{c.chapter}</span>}
                {c.concept && <span className="chip chip-soft">{c.concept}</span>}
                {c.examType && <span className="chip chip-soft">{vLabel("examType", c.examType)}</span>}
                {c.exam && <span className="chip chip-exam" dir="auto">{c.exam}</span>}
                {c.keyless && <span className="chip" title={t("keylessTitle")}>🔑 {t("keylessBadge")}</span>}
                {c.style && <span className="chip chip-soft">{vLabel("style", c.style)}</span>}
                {c.saved && <span className="chip chip-soft" title={fa ? "ذخیره‌شده" : "saved"}>★</span>}
                {c.attempted && <span className="chip chip-done"><Icon name="check" size={11} /></span>}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <div className="browse-pager">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label={t("prev")}>‹</button>
          <span className="muted small" dir="ltr" aria-live="polite">{page} / {pages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label={t("next")}>›</button>
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

/* Preview one question with its answer key and micro-lesson.
 *
 * Deliberately read-only: browsing is for looking things up, so answering here
 * must not consume hearts, break a streak or disturb the SRS schedule that the
 * learning path depends on. The learner picks an option, reveals the answer,
 * and reads the same درسنامه they would see in a lesson — nothing is recorded.
 */
function BrowseCard({ id, onClose }) {
  const { t } = useApp();
  const [card, setCard] = useState(null);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    setSel(null); setChecked(false);
    api.get(`/learn/browse/${id}`).then((d) => setCard(d.card)).catch(() => setCard(null));
  }, [id]);

  const Body = card ? (TYPE_MAP[card.type] || TYPE_MAP.mcq) : null;
  const keyless = !!(card.source_meta && (card.source_meta.keyless || card.source_meta.key_available === false));
  const canCheck = card && Body && !keyless && (Body.canCheck ? Body.canCheck({ sel }, card) : sel != null);

  return (
    <Modal onClose={onClose} title={t("browseStudy")} wide>
      {!card ? <Spinner /> : (
        <div className="browse-preview">
          <p className="browse-preview-q">{card.q}</p>
          <Body card={card} checked={checked} sel={sel} setSel={setSel} isCorrect={checked && Body.judge?.(card, { sel })} />
          {keyless && (
            <div className="explain-box mt12" style={{ background: "rgba(213,160,27,.10)" }}>
              <b>🔑 {t("keylessTitle")}</b>
              <Emphasis as="p" text={t("keylessNotice")} />
            </div>
          )}
          {!checked && !keyless && (
            <button className="btn btn-primary mt12" disabled={!canCheck} onClick={() => setChecked(true)}>
              {t("checkAnswer") || "بررسی"}
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
