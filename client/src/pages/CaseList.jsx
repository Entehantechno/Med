import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context.jsx";
import { api, loadFailKind, loadFailText } from "../api.js";
import { TopBar, Spinner, Pill, StarRating } from "../components/UI.jsx";
import { biField } from "../lib/bifield.js";
import { facetCounts, normalizeSearch, sortBy } from "../lib/catalog-filter.js";
import Icon from "../components/Icon.jsx";

const SORTS = [
  { id: "default", fa: "پیش‌فرض", en: "Default" },
  { id: "difficulty", fa: "دشواری", en: "Difficulty" },
  { id: "unattempted", fa: "حل‌نشده‌ها اول", en: "Not attempted first" },
  { id: "title", fa: "نام", en: "Name" },
];

export default function CaseList({ go, home }) {
  const { t, lang, user } = useApp();
  const fa = lang === "fa";
  const [cases, setCases] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [gate, setGate] = useState("");   // learner access: "" | "off" | "premium"
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [sort, setSort] = useState("default");

  // Learners get their list (and access state) from /learn/vpatient; staff use /cases.
  const learner = user?.role === "learner";
  const load = () => {
    setLoadErr("");
    setGate("");
    setCases(null);
    const opts = { timeoutMs: 20_000, stage: "boot" };
    if (learner) {
      api.get(`/learn/vpatient?lang=${lang}`, opts)
        .then((d) => {
          setGate(d.access ? "" : (d.reason === "premium" ? "premium" : "off"));
          setCases(Array.isArray(d.cases) ? d.cases : []);
        })
        .catch((e) => { setCases([]); setLoadErr(loadFailKind(e)); });
    } else {
      api.get("/cases", opts)
        .then((d) => setCases(Array.isArray(d) ? d : []))
        .catch((e) => { setCases([]); setLoadErr(loadFailKind(e)); });
    }
  };
  useEffect(() => { load(); }, [lang]);

  // Hooks stay above the early return. Search covers only what the card shows
  // (headline, chief complaint, specialty): students never see the internal title,
  // so matching on it would leak the diagnosis through which cases appear.
  const all = cases ?? [];
  const specialties = useMemo(() => facetCounts(all, (c) => biField(c, "specialty", lang)), [all, lang]);
  const visible = useMemo(() => {
    const needle = normalizeSearch(query);
    const list = all.filter((c) => {
      if (specialty && biField(c, "specialty", lang) !== specialty) return false;
      if (!needle) return true;
      const shown = [biField(c, "title", lang) || biField(c, "chief", lang), biField(c, "chief", lang), biField(c, "specialty", lang)].join(" ");
      return normalizeSearch(shown).includes(needle);
    });
    return sortBy(list, sort, {
      title: (c) => biField(c, "title", lang) || biField(c, "chief", lang) || "",
      difficulty: (c) => c.difficulty,
      unattempted: (c) => (c.attemptsUsed ?? 0) === 0,
    });
  }, [all, query, specialty, sort, lang]);

  if (!cases) return <div className="app"><TopBar onHome={home} /><Spinner /></div>;
  const filtered = Boolean(query.trim() || specialty);
  const resetFilters = () => { setQuery(""); setSpecialty(""); };

  return (
    <div className="app">
      <TopBar onHome={home} />
      <div className="container">
        <div className="section-title">
          <h2>{t("caseList")}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={home}>← {t("back")}</button>
        </div>

        {gate ? (
          <div className="card center" style={{ padding: 40 }} role="status">
            <div style={{ fontSize: 44 }}><Icon name="lock" size={30} /></div>
            <h3 className="mt8">{gate === "premium"
              ? (fa ? "این بخش ویژهٔ کاربران پریمیوم است" : "This section is for premium learners")
              : (fa ? "بیمار مجازی در حال حاضر فعال نیست" : "The virtual patient is not available right now")}</h3>
          </div>
        ) : loadErr ? (
          <div className="card center" style={{ padding: 40 }}>
            <div style={{ fontSize: 44 }}><Icon name="warn" size={30} /></div>
            <h3 className="mt8">{fa ? "«بارگذاری فهرست پرونده‌ها» قطع شد" : "[Loading the case list] failed"}</h3>
            <div className="muted small mt8">{loadFailText(loadErr, lang)}</div>
            <button type="button" className="btn btn-primary mt16" onClick={load}>{fa ? "تلاش دوباره" : "Try again"}</button>
          </div>
        ) : all.length === 0 ? (
          <div className="card center" style={{ padding: 40 }}>
            <div style={{ fontSize: 44 }}><Icon name="lock" size={30} /></div>
            <h3 className="mt8">{t("noExamsAssigned")}</h3>
            <div className="muted small mt8">{t("noExamsAssignedDesc")}</div>
          </div>
        ) : (
          <>
            <div className="case-toolbar" style={{ display: "grid", gap: 10, marginBottom: 14 }}>
              <div className="search-input-wrap">
                <span className="search-ico"><Icon name="search" size={16} /></span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={fa ? "جست‌وجوی شکایت یا تخصص…" : "Search complaint or specialty…"}
                  aria-label={fa ? "جست‌وجوی پرونده‌ها" : "Search cases"}
                  autoComplete="off"
                />
              </div>
              {specialties.length > 1 && (
                <div className="seg" role="radiogroup" aria-label={fa ? "فیلتر تخصص" : "Specialty filter"} style={{ flexWrap: "wrap" }}>
                  <button type="button" role="radio" aria-checked={!specialty} className={!specialty ? "on" : ""} onClick={() => setSpecialty("")}>
                    {fa ? "همه" : "All"} ({all.length})
                  </button>
                  {specialties.map((s) => (
                    <button key={s.value} type="button" role="radio" aria-checked={specialty === s.value}
                      className={specialty === s.value ? "on" : ""} onClick={() => setSpecialty(s.value)}>
                      {s.value} ({s.count})
                    </button>
                  ))}
                </div>
              )}
              <div className="seg seg-new" role="radiogroup" aria-label={fa ? "مرتب‌سازی" : "Sort"} style={{ flexWrap: "wrap" }}>
                {SORTS.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={sort === s.id} className={sort === s.id ? "on" : ""} onClick={() => setSort(s.id)}>
                    {fa ? s.fa : s.en}
                  </button>
                ))}
              </div>
              <div className="muted small" role="status" aria-live="polite">
                {filtered
                  ? (fa ? `${visible.length.toLocaleString("fa-IR")} از ${all.length.toLocaleString("fa-IR")} پرونده` : `${visible.length} of ${all.length} cases`)
                  : (fa ? `${all.length.toLocaleString("fa-IR")} پرونده` : `${all.length} cases`)}
              </div>
            </div>

            {visible.length === 0 ? (
              <div className="card center" style={{ padding: 32 }} role="status">
                <div style={{ fontWeight: 800 }}>{fa ? "پرونده‌ای با این فیلتر پیدا نشد." : "No case matches these filters."}</div>
                <button type="button" className="btn btn-ghost mt16" onClick={resetFilters}>{fa ? "پاک‌کردن فیلترها" : "Clear filters"}</button>
              </div>
            ) : (
              <div className="grid" style={{ gap: 12 }}>
                {visible.map((c) => {
                  const used = c.attemptsUsed ?? 0;
                  const max = c.maxAttempts ?? Infinity;
                  const exhausted = used >= max;
                  return (
                    <div className="case-item" key={c.id}>
                      <div>
                        {/* Students never see the internal title (it often names the
                            diagnosis) — the chief complaint is the card headline. */}
                        <strong>{biField(c, "title", lang) || biField(c, "chief", lang)}</strong> <span className="badge-ver">v{c.version}</span>
                        <StarRating score={c.best} lang={lang} />
                        <div className="case-meta">
                          <Pill kind={c.difficulty}>{t(c.difficulty)}</Pill>
                          <span className="tag">{t("specialty")}: {biField(c, "specialty", lang)}</span>
                          <span className="tag">{t("age")}: {c.age}</span>
                          <span className="tag">{t(c.sex)}</span>
                          {c.maxAttempts != null &&
                            <span className="tag">{t("attemptsUsedOf")}: {used}/{max}</span>}
                        </div>
                        {biField(c, "title", lang) && <div className="small muted mt8">{t("chief")}: {biField(c, "chief", lang)}</div>}
                      </div>
                      <button type="button" className="btn btn-primary" disabled={exhausted}
                        style={exhausted ? { opacity: .5, cursor: "not-allowed" } : {}}
                        onClick={() => !exhausted && go("exam", { caseId: c.id })}>
                        {t("startCase")}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
