import { useEffect, useState, useMemo, useRef } from "react";
import { useApp } from "../../context.jsx";
import { api, getToken } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { Spinner, Modal, useToast } from "../../components/UI.jsx";
import DataTable from "../../components/DataTable.jsx";
import { Highlight, highlightLocal } from "../../components/SearchBox.jsx";
import { SUBJECTS } from "../../data/subject-catalog.js";
import { MicroLesson } from "../learn/QuestionTypes.jsx";
import ImportModal from "./ImportModal.jsx";
import ImageUpload from "../../components/ImageUpload.jsx";
import MediaUpload from "../../components/MediaUpload.jsx";

/* Competitive-track content management (single merged tab):
   create ANY question type (mcq / true-false / fill / match / order), with
   progressive hints, autocomplete answer mode, an editable QB-style lesson
   (درسنامه) WITH a live preview of exactly how the learner will see it,
   premium/category flags, bulk import, and enable/disable. */
const EMPTY_FILTERS = {
  subject: "", section: "", type: "", difficulty: "", media: "", content: "",
  premium: "", active: "", used: "", category: "", from: "", to: "",
  // --- exam provenance (imported past-exam questions) ---
  origin: "", examSubject: "", chapter: "", concept: "", year: "", month: "",
  sitting: "", style: "", exam: "",
  // --- modification tracking ---
  changedFrom: "", changedTo: "", lastAction: "",
};
// Sort keys mirror the server's SORTS map so a deep link and the table agree.
const SORT_KEYS = ["id_desc", "newest_exam", "oldest_exam", "last_modified", "first_modified", "newest_added", "most_revised"];

/* Human labels for the exam-provenance vocabulary. Values themselves stay in
   the machine form the API returns, so deep links keep working. */
const originLabel = (v, t) => ({ official_exam: t("originOfficial"), demo_seed: t("originDemo"), authored: t("originAuthored") }[v] || v);
const sittingLabel = (v, t) => ({ main: t("sittingMain"), midterm: t("sittingMid") }[v] || v);
const styleLabel = (v, t) => ({ case: t("styleCase"), recall: t("styleRecall"), negative: t("styleNegative"), image: t("styleImage") }[v] || v);
const actionLabel = (v, t) => ({ created: t("actCreated"), imported: t("actImported"), edited: t("actEdited"), activated: t("actActivated"), deactivated: t("actDeactivated") }[v] || v);

export default function LearnCards({ jump, onJumpConsumed } = {}) {
  const { t, lang } = useApp();
  const toast = useToast();
  const [cards, setCards] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [facets, setFacets] = useState({});     // exam-provenance dropdowns with counts
  const [sort, setSort] = useState("id_desc");
  const [demoInfo, setDemoInfo] = useState(null);
  const [edit, setEdit] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [importing, setImporting] = useState(false);
  const [bundleImport, setBundleImport] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [fil, setFil] = useState(EMPTY_FILTERS);
  const [sel, setSel] = useState(() => new Set());   // selected card ids (bulk)
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = () => api.get(`/admin/learn-cards?lang=${lang}`)
    .then((d) => { setCards(d.cards); setSubjects(d.subjects || []); setCategories(d.categories || []); setFacets(d.facets || {}); setSel(new Set()); })
    .catch(() => setCards([]));
  // How many seeded sample questions are still in the bank (0 once purged).
  const loadDemo = () => api.get("/admin/demo-cards").then(setDemoInfo).catch(() => setDemoInfo(null));
  useEffect(() => { load(); loadDemo(); }, [lang]);

  // Apply an incoming cross-tab jump (e.g. from the content dashboard): open the
  // filter bar and pre-select the requested subject, then clear the request.
  useEffect(() => {
    if (!jump) return;
    setFil({ ...EMPTY_FILTERS, ...(jump.subject ? { subject: jump.subject } : {}), ...(jump.section ? { section: jump.section } : {}), ...(jump.media ? { media: jump.media } : {}) });
    setShowFilters(true);
    onJumpConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump]);

  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const setF = (k, v) => setFil((s) => ({ ...s, [k]: v }));
  const activeFilterCount = Object.values(fil).filter(Boolean).length;

  // day-only compare against updatedAt ("YYYY-MM-DD HH:MM:SS")
  const cardDay = (c) => (c.updatedAt || "").slice(0, 10);

  const filtered = useMemo(() => {
    if (!cards) return [];
    return cards.filter((c) => {
      if (fil.subject && c.subjectSlug !== fil.subject) return false;
      if (fil.section && c.section !== fil.section) return false;
      if (fil.type && c.type !== fil.type) return false;
      if (fil.difficulty && c.difficulty !== fil.difficulty) return false;
      if (fil.category && c.category !== fil.category) return false;
      if (fil.premium === "yes" && !c.premium) return false;
      if (fil.premium === "no" && c.premium) return false;
      if (fil.active === "yes" && !c.active) return false;
      if (fil.active === "no" && c.active) return false;
      if (fil.used === "yes" && !(c.usedIn && c.usedIn.length)) return false;
      if (fil.used === "no" && (c.usedIn && c.usedIn.length)) return false;
      // media presence
      if (fil.media === "any" && !c.hasMedia) return false;
      if (fil.media === "none" && c.hasMedia) return false;
      if (fil.media === "image" && !c.hasImage) return false;
      if (fil.media === "video" && !c.hasVideo) return false;
      if (fil.media === "embed" && !c.hasEmbed) return false;
      // content block presence
      if (fil.content === "micro" && !c.hasMicro) return false;
      if (fil.content === "explain" && !c.hasExplain) return false;
      if (fil.content === "mnemonic" && !c.hasMnemonic) return false;
      if (fil.content === "hints" && !c.hasHints) return false;
      // date range (inclusive, day granularity)
      if (fil.from && cardDay(c) < fil.from) return false;
      if (fil.to && cardDay(c) > fil.to) return false;

      // ---- exam provenance: subject → chapter → concept, year, sitting, style ----
      const f = c.facets || {};
      if (fil.origin && f.origin !== fil.origin) return false;
      if (fil.examSubject && f.subject !== fil.examSubject) return false;
      if (fil.chapter && f.chapter !== fil.chapter) return false;
      if (fil.concept && f.concept !== fil.concept) return false;
      if (fil.year && f.year !== fil.year) return false;
      if (fil.month && f.month !== fil.month) return false;
      if (fil.sitting && f.sitting !== fil.sitting) return false;
      if (fil.style && f.style !== fil.style) return false;
      if (fil.exam && f.examLabel !== fil.exam) return false;

      // ---- modification window: uses content_updated_at, not any write ----
      const chDay = (c.contentUpdatedAt || c.updatedAt || "").slice(0, 10);
      if (fil.changedFrom && chDay < fil.changedFrom) return false;
      if (fil.changedTo && chDay > fil.changedTo) return false;
      if (fil.lastAction && c.lastAction !== fil.lastAction) return false;
      return true;
    });
  }, [cards, fil]);

  // Apply the chosen ordering after filtering (same keys the API understands).
  const sorted = useMemo(() => {
    const by = {
      id_desc: (a, b) => b.id - a.id,
      newest_exam: (a, b) => ((b.facets?.sittingKey || 0) - (a.facets?.sittingKey || 0)) || (a.id - b.id),
      oldest_exam: (a, b) => ((a.facets?.sittingKey || 0) - (b.facets?.sittingKey || 0)) || (a.id - b.id),
      last_modified: (a, b) => String(b.contentUpdatedAt || "").localeCompare(String(a.contentUpdatedAt || "")) || (b.id - a.id),
      first_modified: (a, b) => String(a.contentUpdatedAt || "").localeCompare(String(b.contentUpdatedAt || "")) || (a.id - b.id),
      newest_added: (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")) || (b.id - a.id),
      most_revised: (a, b) => ((b.revision || 0) - (a.revision || 0)) || (a.id - b.id),
    };
    return [...filtered].sort(by[sort] || by.id_desc);
  }, [filtered, sort]);

  const filteredIds = sorted.map((c) => c.id);
  const selInView = filteredIds.filter((id) => sel.has(id));
  const allInViewSelected = filteredIds.length > 0 && selInView.length === filteredIds.length;
  const selectAllInView = () => setSel((s) => {
    const n = new Set(s);
    if (allInViewSelected) filteredIds.forEach((id) => n.delete(id));
    else filteredIds.forEach((id) => n.add(id));
    return n;
  });
  const bulkAction = async (action) => {
    const ids = [...sel];
    if (!ids.length) return;
    if (action === "delete" && !confirm(t("bulkConfirmDelete").replace("{n}", ids.length))) return;
    setBulkBusy(true);
    try {
      const r = await api.post("/admin/learn-cards/bulk-action", { ids, action });
      toast(t("bulkDone").replace("{n}", r.affected));
      load();
    } catch (e) { toast(e.message); }
    finally { setBulkBusy(false); }
  };

  // Export the CURRENT view (all cards, or only the filtered subset) as a
  // media-faithful JSON bundle. Uses fetch to receive the file as a blob.
  const exportBundle = async () => {
    const isFiltered = activeFilterCount > 0 && filtered.length < cards.length;
    const qs = isFiltered ? `?ids=${filtered.map((c) => c.id).join(",")}` : "";
    try {
      const res = await fetch(`/api/admin/learn-cards/export${qs}`, { credentials: "same-origin", headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `med-school-cards-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast(t("exportDone").replace("{n}", isFiltered ? filtered.length : cards.length));
    } catch (e) { toast(e.message); }
  };

  if (!cards) return <Spinner />;

  const del = async (id) => { if (confirm(t("confirmDelete"))) { await api.del(`/admin/learn-cards/${id}`); toast(t("saved")); load(); } };
  const togglePremium = async (c) => { await api.put(`/admin/learn-cards/${c.id}`, { premium: !c.premium }); load(); };
  const toggleActive = async (c) => { await api.put(`/admin/learn-cards/${c.id}`, { active: !c.active }); load(); };

  const typeLabel = (ty) => ({ mcq: t("qtMcq"), truefalse: t("qtTruefalse"), fill: t("qtFill"), match: t("qtMatch"), order: t("qtOrder"), compare: "تمایز بالینی" }[ty] || ty);
  const sectionLabel = (s) => ({ internal: "دروس داخلی", major: "دروس ماژور", minor: "دروس مینور", floating: "دروس شناور", basic: "علوم پایه" }[s] || s || "—");
  const mediaChips = (c) => (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {c.hasImage && <span className="lc-badge media" title={t("hasImageF")}>🖼️</span>}
      {c.hasVideo && <span className="lc-badge media" title={t("hasVideoF")}>🎞️</span>}
      {c.hasEmbed && <span className="lc-badge media" title={t("hasEmbedF")}>▶️</span>}
      {!c.hasMedia && <span className="muted small">—</span>}
    </span>
  );

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="flask" size={22} /> {t("learnCards")}</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className={`btn btn-sm ${showFilters || activeFilterCount ? "btn-primary" : "btn-ghost"}`} onClick={() => setShowFilters((v) => !v)}>
            <Icon name="settings" size={14} /> {t("filters")}{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={exportBundle}><Icon name="download" size={14} /> {t("exportBundle")}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setBundleImport(true)}><Icon name="upload" size={14} /> {t("importBundle")}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setImporting(true)}><Icon name="upload" size={14} /> {t("bulkImport")}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setBulk(true)}><Icon name="download" size={14} /> {t("bulkCreate")}</button>
          <button className="btn btn-primary btn-sm" onClick={() => setEdit({})}><Icon name="edit" size={14} /> {t("newCard")}</button>
        </div>
      </div>
      <div className="muted small mb16">{t("learnCardsHint")}</div>
      <div className="mb16">
        <button className="btn btn-sm btn-ghost" onClick={async () => {
          if (!window.confirm(lang === "fa"
            ? "در هر درسی که سؤال شناسنامه‌دار رسمی دارد، کارت‌های دمو و بدون مرجع حذف شوند؟"
            : "In every subject that has official identified questions, delete demo and unsigned cards?")) return;
          const r = await api.post("/admin/demo-cards/purge-unsigned", {});
          toast(lang === "fa" ? `حذف شد: ${r.deleted || 0}` : `Deleted: ${r.deleted || 0}`);
          load(); loadDemo();
        }}>{lang === "fa" ? "حذف دمو و بدون شناسنامه در دروس رسمی" : "Purge demo/unsigned in official subjects"}</button>
      </div>

      {/* ---------- seeded demo content notice ----------
          A fresh install ships sample questions so the app is not an empty
          shell. Once real past-exam questions are imported they are just
          noise, so we surface them here with a one-click, reversible cleanup
          rather than leaving admins to hunt them down by hand. */}
      {demoInfo?.count > 0 && (
        <div className="card lc-demo-banner mb16">
          <div className="lc-demo-text">
            <strong><Icon name="alert" size={14} /> {t("demoCardsTitle")}</strong>
            <span className="muted small">
              {t("demoCardsBody").replace("{n}", demoInfo.count).replace("{k}", demoInfo.usedInNodes)}
            </span>
          </div>
          <div className="lc-demo-actions">
            <button className="btn btn-sm btn-ghost" onClick={() => { setFil({ ...EMPTY_FILTERS, origin: "demo_seed" }); setShowFilters(true); }}>
              {t("demoCardsShow")}
            </button>
            <button className="btn btn-sm" onClick={async () => {
              if (!window.confirm(t("demoCardsHideConfirm"))) return;
              await api.post("/admin/demo-cards/purge", { mode: "deactivate" });
              toast(t("demoCardsDone")); load(); loadDemo();
            }}>{t("demoCardsHide")}</button>
            <button className="btn btn-sm btn-danger" onClick={async () => {
              if (!window.confirm(t("demoCardsDeleteConfirm").replace("{n}", demoInfo.count))) return;
              const r = await api.post("/admin/demo-cards/purge", { mode: "delete" });
              toast(t("demoCardsDeleted").replace("{n}", r.affected)); load(); loadDemo();
            }}><Icon name="trash" size={13} /> {t("demoCardsDelete")}</button>
            <button className="btn btn-sm btn-danger" onClick={async () => {
              if (!window.confirm(lang === "fa"
                ? "در هر درسی که سؤال شناسنامه‌دار رسمی دارد، کارت‌های دمو و بدون مرجع حذف شوند؟"
                : "In every subject that has official identified questions, delete demo and unsigned cards?")) return;
              const r = await api.post("/admin/demo-cards/purge-unsigned", {});
              toast(lang === "fa" ? `حذف شد: ${r.deleted}` : `Deleted: ${r.deleted}`); load(); loadDemo();
            }}>{lang === "fa" ? "حذف دمو/بدون شناسنامه" : "Purge unsigned"}</button>
          </div>
        </div>
      )}

      {/* ---------- comprehensive filter bar (every attribute) ---------- */}
      {showFilters && (
        <div className="card lc-filters mb16">
          <div className="lc-filter-grid">
            <label className="field"><span>{t("subjectLabel")}</span>
              <select value={fil.subject} onChange={(e) => setF("subject", e.target.value)}>
                <option value="">{t("allSubjects")}</option>
                {subjects.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              </select></label>
            <label className="field"><span>{t("sectionLabel")}</span>
              <select value={fil.section} onChange={(e) => setF("section", e.target.value)}>
                <option value="">{t("allSections")}</option>
                {["internal", "major", "minor", "floating", "basic"].map((s) => <option key={s} value={s}>{sectionLabel(s)}</option>)}
              </select></label>
            <label className="field"><span>{t("questionTypeLabel")}</span>
              <select value={fil.type} onChange={(e) => setF("type", e.target.value)}>
                <option value="">{t("allTypes")}</option>
                {["mcq", "truefalse", "fill", "match", "order", "compare"].map((ty) => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
              </select></label>
            <label className="field"><span>{t("difficulty")}</span>
              <select value={fil.difficulty} onChange={(e) => setF("difficulty", e.target.value)}>
                <option value="">{t("allDifficulties")}</option>
                <option value="easy">{t("easy")}</option><option value="medium">{t("medium")}</option><option value="hard">{t("hard")}</option>
              </select></label>
            <label className="field"><span>{t("mediaCol")}</span>
              <select value={fil.media} onChange={(e) => setF("media", e.target.value)}>
                <option value="">{t("anyValue")}</option>
                <option value="any">{t("hasMediaF")}</option>
                <option value="none">{t("noMediaF")}</option>
                <option value="image">{t("filterMediaImage")}</option>
                <option value="video">{t("filterMediaVideo")}</option>
                <option value="embed">{t("filterMediaEmbed")}</option>
              </select></label>
            <label className="field"><span>{t("microLesson")} / {t("answerKey")}</span>
              <select value={fil.content} onChange={(e) => setF("content", e.target.value)}>
                <option value="">{t("anyValue")}</option>
                <option value="micro">{t("hasMicroF")}</option>
                <option value="explain">{t("hasExplainF")}</option>
                <option value="mnemonic">{t("hasMnemonicF")}</option>
                <option value="hints">{t("hasHintsF")}</option>
              </select></label>
            {categories.length > 0 && (
              <label className="field"><span>{t("category")}</span>
                <select value={fil.category} onChange={(e) => setF("category", e.target.value)}>
                  <option value="">{t("anyValue")}</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select></label>
            )}
            <label className="field"><span>{t("premiumCard")}</span>
              <select value={fil.premium} onChange={(e) => setF("premium", e.target.value)}>
                <option value="">{t("anyValue")}</option>
                <option value="yes">{t("premiumOnlyShort")}</option><option value="no">{t("freeOnly")}</option>
              </select></label>
            <label className="field"><span>{t("status")}</span>
              <select value={fil.active} onChange={(e) => setF("active", e.target.value)}>
                <option value="">{t("anyStatus")}</option>
                <option value="yes">{t("activeOnly")}</option><option value="no">{t("inactiveOnly")}</option>
              </select></label>
            <label className="field"><span>{t("usedIn")}</span>
              <select value={fil.used} onChange={(e) => setF("used", e.target.value)}>
                <option value="">{t("anyValue")}</option>
                <option value="yes">{t("usedInPath")}</option><option value="no">{t("notUsedInPath")}</option>
              </select></label>
            <label className="field"><span>{t("dateFrom")}</span>
              <input type="date" value={fil.from} onChange={(e) => setF("from", e.target.value)} /></label>
            <label className="field"><span>{t("dateTo")}</span>
              <input type="date" value={fil.to} onChange={(e) => setF("to", e.target.value)} /></label>
          </div>

          {/* ---------- exam provenance: where the question came from ----------
              These only exist for imported past-exam questions, so the whole
              block is hidden until the bank actually contains some. Options
              carry their result count and an option that would return nothing
              is never rendered. */}
          {(facets.subject?.length > 0 || facets.year?.length > 0) && (
            <>
              <div className="lc-filter-sep"><Icon name="book" size={13} /> {t("examProvenance")}</div>
              <div className="lc-filter-grid">
                <label className="field"><span>{t("originLabel")}</span>
                  <select value={fil.origin} onChange={(e) => setF("origin", e.target.value)}>
                    <option value="">{t("anyValue")}</option>
                    {(facets.origin || []).map((o) => <option key={o.value} value={o.value}>{originLabel(o.value, t)} ({o.count})</option>)}
                  </select></label>
                <label className="field"><span>{t("examSubjectLabel")}</span>
                  <select value={fil.examSubject} onChange={(e) => { setF("examSubject", e.target.value); setF("chapter", ""); setF("concept", ""); }}>
                    <option value="">{t("anyValue")}</option>
                    {(facets.subject || []).map((o) => <option key={o.value} value={o.value}>{o.label} ({o.count})</option>)}
                  </select></label>
                <label className="field"><span>{t("chapterLabel")}</span>
                  <select value={fil.chapter} onChange={(e) => { setF("chapter", e.target.value); setF("concept", ""); }}>
                    <option value="">{t("anyValue")}</option>
                    {(facets.chapter || []).filter((o) => !fil.examSubject || o.subject === fil.examSubject)
                      .map((o) => <option key={o.value} value={o.value}>{o.label} ({o.count})</option>)}
                  </select></label>
                <label className="field"><span>{t("conceptLabel")}</span>
                  <select value={fil.concept} onChange={(e) => setF("concept", e.target.value)}>
                    <option value="">{t("anyValue")}</option>
                    {(facets.concept || []).filter((o) => (!fil.examSubject || o.subject === fil.examSubject) && (!fil.chapter || o.chapter === fil.chapter))
                      .map((o) => <option key={o.value} value={o.value}>{o.label} ({o.count})</option>)}
                  </select></label>
                <label className="field"><span>{t("examYearLabel")}</span>
                  <select value={fil.year} onChange={(e) => setF("year", e.target.value)}>
                    <option value="">{t("anyValue")}</option>
                    {(facets.year || []).map((o) => <option key={o.value} value={o.value}>{o.label} ({o.count})</option>)}
                  </select></label>
                <label className="field"><span>{t("examMonthLabel")}</span>
                  <select value={fil.month} onChange={(e) => setF("month", e.target.value)}>
                    <option value="">{t("anyValue")}</option>
                    {(facets.month || []).map((o) => <option key={o.value} value={o.value}>{o.label} ({o.count})</option>)}
                  </select></label>
                <label className="field"><span>{t("sittingLabel")}</span>
                  <select value={fil.sitting} onChange={(e) => setF("sitting", e.target.value)}>
                    <option value="">{t("anyValue")}</option>
                    {(facets.sitting || []).map((o) => <option key={o.value} value={o.value}>{sittingLabel(o.value, t)} ({o.count})</option>)}
                  </select></label>
                <label className="field"><span>{t("styleLabel")}</span>
                  <select value={fil.style} onChange={(e) => setF("style", e.target.value)}>
                    <option value="">{t("anyValue")}</option>
                    {(facets.style || []).map((o) => <option key={o.value} value={o.value}>{styleLabel(o.value, t)} ({o.count})</option>)}
                  </select></label>
                <label className="field lc-wide"><span>{t("examSittingLabel")}</span>
                  <select value={fil.exam} onChange={(e) => setF("exam", e.target.value)}>
                    <option value="">{t("anyValue")}</option>
                    {(facets.exam || []).map((o) => <option key={o.value} value={o.value}>{o.label} ({o.count})</option>)}
                  </select></label>
              </div>
            </>
          )}

          {/* ---------- modification tracking ---------- */}
          <div className="lc-filter-sep"><Icon name="clock" size={13} /> {t("modificationLabel")}</div>
          <div className="lc-filter-grid">
            <label className="field"><span>{t("changedFrom")}</span>
              <input type="date" value={fil.changedFrom} onChange={(e) => setF("changedFrom", e.target.value)} /></label>
            <label className="field"><span>{t("changedTo")}</span>
              <input type="date" value={fil.changedTo} onChange={(e) => setF("changedTo", e.target.value)} /></label>
            <label className="field"><span>{t("lastActionLabel")}</span>
              <select value={fil.lastAction} onChange={(e) => setF("lastAction", e.target.value)}>
                <option value="">{t("anyValue")}</option>
                {["created", "imported", "edited", "activated", "deactivated"].map((a) => <option key={a} value={a}>{actionLabel(a, t)}</option>)}
              </select></label>
            <label className="field"><span>{t("sortByLabel")}</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORT_KEYS.map((k) => <option key={k} value={k}>{t(`sort_${k}`)}</option>)}
              </select></label>
          </div>
          <div className="lc-filter-foot">
            <span className="muted small">{t("showingOf").replace("{n}", filtered.length).replace("{total}", cards.length)}</span>
            {activeFilterCount > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setFil(EMPTY_FILTERS)}><Icon name="close" size={13} /> {t("clearFilters")}</button>}
          </div>
        </div>
      )}

      {/* ---------- bulk-action bar (operates on the current selection) ---------- */}
      {sel.size > 0 && (
        <div className="card lc-bulkbar mb16">
          <span className="lc-bulk-count"><Icon name="check" size={14} /> {t("bulkSelected").replace("{n}", sel.size)}</span>
          <div className="lc-bulk-actions">
            <button className="btn btn-sm btn-ghost" disabled={bulkBusy} onClick={() => bulkAction("activate")}><Icon name="check" size={13} /> {t("bulkActivate")}</button>
            <button className="btn btn-sm btn-ghost" disabled={bulkBusy} onClick={() => bulkAction("deactivate")}><Icon name="lock" size={13} /> {t("bulkDeactivate")}</button>
            <button className="btn btn-sm btn-ghost" disabled={bulkBusy} onClick={() => bulkAction("premium")}><Icon name="crown" size={13} /> {t("bulkPremium")}</button>
            <button className="btn btn-sm btn-ghost" disabled={bulkBusy} onClick={() => bulkAction("free")}>{t("bulkFree")}</button>
            <button className="btn btn-sm btn-danger" disabled={bulkBusy} onClick={() => bulkAction("delete")}><Icon name="trash" size={13} /> {t("bulkDelete")}</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setSel(new Set())}><Icon name="close" size={13} /> {t("bulkClear")}</button>
          </div>
        </div>
      )}

      <DataTable
        rows={sorted}
        initialSort={{ key: "id", dir: "desc" }}
        searchKeys={[(c) => `#${c.id}`, (c) => c.q, (c) => c.category, (c) => c.subject, (c) => c.facets?.chapter, (c) => c.facets?.concept, (c) => c.facets?.examLabel, (c) => c.type]}
        storageKey="admin-bank"
        hotkey
        rowKey={(c) => c.id}
        columns={[
          { key: "_sel", label: (
              <input type="checkbox" checked={allInViewSelected} onChange={selectAllInView}
                title={t("bulkSelectAll")} aria-label={t("bulkSelectAll")} />
            ), sortable: false, thStyle: { width: 34 }, render: (c) => (
              <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggleSel(c.id)}
                onClick={(e) => e.stopPropagation()} aria-label={`select ${c.id}`} />
            ) },
          { key: "q", label: t("questionText"), sortValue: (c) => c.q, render: (c, q) => (
            <div className="lc-qcell" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", opacity: c.active ? 1 : .5 }}>
              <span>{q ? <Highlight text={c.q} ranges={highlightLocal(c.q, q)} /> : c.q}</span>
              {c.premium ? <span className="lc-badge prem">👑</span> : null}
              {c.hasHints ? <span className="lc-badge cat" title={t("hasHintsF")}>💡</span> : null}
              {c.hasMicro ? <span className="lc-badge cat" title={t("hasMicroF")}>📖</span> : null}
              {c.hasExplain ? <span className="lc-badge cat" title={t("hasExplainF")}>🗝️</span> : null}
              {c.category ? <span className="lc-badge cat">{c.category}</span> : null}
            </div>) },
          { key: "subject", label: t("subjectCol"), sortValue: (c) => c.subject, render: (c) => c.subject || <span className="muted small">—</span> },
          // Chapter + exam sitting make the provenance readable at a glance:
          // an admin scanning the table can see WHICH exam a question is from
          // without opening it.
          { key: "chapter", label: t("chapterLabel"), sortValue: (c) => c.facets?.chapter || "",
            render: (c, q) => c.facets?.chapter ? <span className="small">{q ? <Highlight text={c.facets.chapter} ranges={highlightLocal(c.facets.chapter, q)} /> : c.facets.chapter}</span> : <span className="muted small">—</span> },
          { key: "exam", label: t("examSittingLabel"), sortValue: (c) => c.facets?.sittingKey || 0,
            render: (c) => c.facets?.examLabel
              ? <span className="small chip-exam">{c.facets.year} {c.facets.month}</span>
              : <span className="muted small">—</span> },
          { key: "type", label: t("questionTypeLabel"), sortValue: (c) => c.type, render: (c) => typeLabel(c.type) },
          { key: "media", label: t("mediaCol"), sortValue: (c) => (c.hasVideo ? 3 : c.hasEmbed ? 2 : c.hasImage ? 1 : 0), render: mediaChips },
          // Last CONTENT change (not "any write"), with the revision number and
          // what the change was, so the modification history is visible inline.
          { key: "updatedAt", label: t("lastChangeCol"), sortValue: (c) => c.contentUpdatedAt || c.updatedAt,
            render: (c) => (
              <span className="muted small" dir="ltr" title={`${actionLabel(c.lastAction, t)}${c.lastEditor ? " — " + c.lastEditor : ""}`}>
                {(c.contentUpdatedAt || c.updatedAt || "").slice(0, 10) || "—"}
                {c.revision > 1 && <span className="chip-rev"> v{c.revision}</span>}
              </span>
            ) },
          { key: "usedIn", label: t("usedIn"), sortable: false, render: (c) => c.usedIn.length ? c.usedIn.join("، ") : <span className="muted small">—</span> },
          { key: "actions", label: "", sortable: false, thStyle: { textAlign: "end" }, render: (c) => (
            <span style={{ display: "flex", gap: 4, justifyContent: "flex-end", whiteSpace: "nowrap" }}>
              <button className={`btn btn-sm ${c.premium ? "btn-accent" : "btn-ghost"}`} onClick={() => togglePremium(c)} title={t("premiumCard")}><Icon name="crown" size={13} /></button>
              <button className="btn btn-sm btn-ghost" onClick={() => setEdit(c)} title={t("edit")}><Icon name="edit" size={13} /></button>
              <button className="btn btn-sm btn-ghost" onClick={() => toggleActive(c)} title={c.active ? t("disable") : t("enable")}>{c.active ? <Icon name="lock" size={13} /> : <Icon name="check" size={13} />}</button>
              <button className="btn btn-sm btn-danger" onClick={() => del(c.id)} title={t("delete")}><Icon name="trash" size={13} /></button>
            </span>) },
        ]}
      />

      {edit && <CardModal card={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast(t("saved")); load(); }} />}
      {bulk && <BulkModal onClose={() => setBulk(false)} onDone={() => { setBulk(false); toast(t("saved")); load(); }} />}
      {importing && <ImportModal onClose={() => setImporting(false)} onDone={() => { setImporting(false); toast(t("saved")); load(); }} />}
      {bundleImport && <BundleImportModal onClose={() => setBundleImport(false)} onDone={() => { setBundleImport(false); toast(t("saved")); load(); }} />}
    </div>
  );
}

const BLANK_OPTS = () => [{ fa: "", en: "", correct: true }, { fa: "", en: "", correct: false }, { fa: "", en: "", correct: false }, { fa: "", en: "", correct: false }];

/* Media <-> editor-state helpers. A card block's media is stored as
   { url, kind, caption_fa }. Empty url → omitted from the payload. */
function mediaState(m) {
  if (!m) return { url: "", kind: null, caption_fa: "" };
  if (typeof m === "string") return { url: m, kind: null, caption_fa: "" };
  return { url: m.url || "", kind: m.kind || null, caption_fa: m.caption_fa || m.caption_en || "" };
}
function mediaPayload(ms) {
  if (!ms || !ms.url || !ms.url.trim()) return undefined;
  return { url: ms.url.trim(), kind: ms.kind || undefined, caption_fa: ms.caption_fa || "", caption_en: ms.caption_fa || "" };
}

/* The list rows are light (no card body). When an existing card is opened,
   fetch its full body first, then mount the editor with it. */
function CardModal({ card, onClose, onSaved }) {
  const { t } = useApp();
  const needsFetch = !!card.id && !card.data;
  const [full, setFull] = useState(needsFetch ? null : card);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!needsFetch) return;
    let alive = true;
    api.get(`/admin/learn-cards/${card.id}`).then((r) => { if (alive) setFull({ ...card, ...r.card }); }).catch((e) => { if (alive) setErr(e.message || "error"); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);
  if (!full) {
    return (
      <Modal title={t("edit")} onClose={onClose}>
        <div style={{ textAlign: "center", padding: 28 }}>
          {err ? <div className="muted">{err}</div> : <Spinner />}
        </div>
      </Modal>
    );
  }
  return <CardModalInner card={full} onClose={onClose} onSaved={onSaved} />;
}

function CardModalInner({ card, onClose, onSaved }) {
  const { t, lang } = useApp();
  const isNew = !card.id;
  const d = card.data || {};
  const [f, setF] = useState({
    type: d.type || "mcq",
    q_fa: d.q_fa || d.title_fa || "", q_en: d.q_en || d.title_en || "",
    difficulty: card.difficulty || "medium", premium: !!d.premium, category: d.category || "",
    answerMode: d.answerMode || "choice", subject: d.subject || "",
    options: (d.options && d.options.length ? d.options.map((o) => ({ fa: o.fa || "", en: o.en || "", correct: !!o.correct })) : BLANK_OPTS()),
    answer: d.answer !== undefined ? !!d.answer : true,
    blank_fa: d.blank_fa || "", accept_fa: (d.accept_fa || []).join("، "),
    pairs: (d.pairs && d.pairs.length ? d.pairs.map((p) => ({ l: p[0] || "", r: p[2] || "" })) : [{ l: "", r: "" }, { l: "", r: "" }]),
    entityA_fa: d.entityA_fa || "", entityA_en: d.entityA_en || "",
    entityB_fa: d.entityB_fa || "", entityB_en: d.entityB_en || "",
    features: (d.features && d.features.length ? d.features.map((x) => ({ fa: x.fa || "", en: x.en || "", belongs: x.belongs || "A" })) : [{ fa: "", en: "", belongs: "A" }, { fa: "", en: "", belongs: "B" }]),
    items_fa: (d.items_fa || []).join("\n"),
    hints_fa: (d.hints_fa || []).join("\n"),
    // rich media on the QUESTION itself (image / uploaded video / Aparat|YouTube)
    media: mediaState(d.media || (d.image ? { url: d.image, kind: "image" } : null)),
    micro: {
      lead_fa: d.micro?.lead_fa || "", golden_fa: d.micro?.golden_fa || "",
      points_fa: (d.micro?.points_fa || []).join("\n"), source_fa: d.micro?.source_fa || "",
      media: mediaState(d.micro?.media),         // درسنامه media
    },
    // پاسخنامه — dedicated answer explanation (text + media)
    explain: {
      text_fa: d.explain?.text_fa || "",
      media: mediaState(d.explain?.media),
    },
    mnemonic: {
      title_fa: d.mnemonic?.title_fa || "", scene_fa: d.mnemonic?.scene_fa || "",
      hooks_fa: (d.mnemonic?.hooks_fa || []).join("\n"), image: d.mnemonic?.image || "",
      media: mediaState(d.mnemonic?.media),      // mnemonic can be a short clip
    },
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setOpt = (i, k, v) => setF((s) => { const o = [...s.options]; o[i] = { ...o[i], [k]: v }; return { ...s, options: o }; });
  const setCorrect = (i) => setF((s) => ({ ...s, options: s.options.map((o, j) => ({ ...o, correct: j === i })) }));
  const setPair = (i, k, v) => setF((s) => { const p = [...s.pairs]; p[i] = { ...p[i], [k]: v }; return { ...s, pairs: p }; });
  // when a subject is picked for autocomplete, prefill the option list from its catalog
  const onSubject = (slug) => {
    const list = SUBJECTS[slug]?.list || [];
    setF((s) => ({ ...s, subject: slug, answerMode: "search", options: list.slice(0, 12).map((o, i) => ({ fa: o.fa, en: o.en, correct: i === 0 })) }));
  };

  const save = async () => {
    const qMedia = mediaPayload(f.media);
    const microMedia = mediaPayload(f.micro.media);
    const explainMedia = mediaPayload(f.explain.media);
    const mnemMedia = mediaPayload(f.mnemonic.media);
    const payload = {
      type: f.type, q_fa: f.q_fa, q_en: f.q_en, difficulty: f.difficulty, premium: f.premium, category: f.category,
      hints_fa: f.hints_fa ? f.hints_fa.split("\n").filter(Boolean) : [],
      // question media (image / video / embed). Also mirror into legacy `image`
      // when it's a plain image so older renderers keep working.
      media: qMedia,
      // keep the legacy `image` in sync only when the question media is a plain image
      image: (qMedia && (qMedia.kind === "image" || !qMedia.kind)) ? qMedia.url : "",
      micro: (f.micro.lead_fa || f.micro.golden_fa || f.micro.points_fa || microMedia) ? {
        lead_fa: f.micro.lead_fa, lead_en: f.micro.lead_fa, golden_fa: f.micro.golden_fa, golden_en: f.micro.golden_fa,
        points_fa: f.micro.points_fa.split("\n").filter(Boolean), points_en: f.micro.points_fa.split("\n").filter(Boolean),
        source_fa: f.micro.source_fa, source_en: f.micro.source_fa, options_fa: [], options_en: [],
        media: microMedia,
      } : undefined,
      // پاسخنامه (answer explanation)
      explain: (f.explain.text_fa || explainMedia) ? {
        text_fa: f.explain.text_fa, text_en: f.explain.text_fa, media: explainMedia,
      } : undefined,
      mnemonic: (f.mnemonic.scene_fa || f.mnemonic.hooks_fa || f.mnemonic.image || mnemMedia) ? {
        title_fa: f.mnemonic.title_fa, title_en: f.mnemonic.title_fa,
        scene_fa: f.mnemonic.scene_fa, scene_en: f.mnemonic.scene_fa,
        hooks_fa: f.mnemonic.hooks_fa.split("\n").filter(Boolean), hooks_en: f.mnemonic.hooks_fa.split("\n").filter(Boolean),
        image: f.mnemonic.image || "",
        media: mnemMedia,
      } : undefined,
    };
    if (f.type === "mcq") {
      payload.options = f.options.filter((o) => o.fa.trim());
      if (f.answerMode === "search") { payload.answerMode = "search"; payload.subject = f.subject || undefined; }
    } else if (f.type === "truefalse") payload.answer = f.answer;
    else if (f.type === "fill") { payload.blank_fa = f.blank_fa; payload.accept_fa = f.accept_fa.split(/[،,\n]/).map((x) => x.trim()).filter(Boolean); }
    else if (f.type === "match") payload.pairs = f.pairs.filter((p) => p.l && p.r).map((p) => [p.l, p.l, p.r, p.r]);
    else if (f.type === "order") payload.items_fa = f.items_fa.split("\n").filter(Boolean);
    if (isNew) await api.post("/admin/learn-cards", payload);
    else await api.put(`/admin/learn-cards/${card.id}`, payload);
    onSaved();
  };

  // live preview micro object (mirrors what the learner sees)
  const previewMicro = {
    lead: f.micro.lead_fa, golden: f.micro.golden_fa,
    points: f.micro.points_fa.split("\n").filter(Boolean), source: f.micro.source_fa,
  };

  return (
    <Modal title={isNew ? t("newCard") : t("edit")} onClose={onClose} onSave={save} wide>
      <div className="grid grid-2">
        <div className="field"><label>{t("questionTypeLabel")}</label>
          <select value={f.type} onChange={(e) => set("type", e.target.value)}>
            <option value="mcq">{t("qtMcq")}</option>
            <option value="truefalse">{t("qtTruefalse")}</option>
            <option value="fill">{t("qtFill")}</option>
            <option value="match">{t("qtMatch")}</option>
            <option value="order">{t("qtOrder")}</option>
            <option value="compare">{typeLabel("compare")}</option>
          </select></div>
        <div className="field"><label>{t("difficulty")}</label>
          <select value={f.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
            <option value="easy">{t("easy")}</option><option value="medium">{t("medium")}</option><option value="hard">{t("hard")}</option></select></div>
      </div>
      <div className="field"><label>{t("questionText")} (FA)</label><textarea value={f.q_fa} onChange={(e) => set("q_fa", e.target.value)} /></div>
      <div className="field"><label>{t("questionText")} (EN)</label><textarea value={f.q_en} onChange={(e) => set("q_en", e.target.value)} /></div>

      {/* rich media on the question (image / uploaded video / Aparat|YouTube) */}
      <MediaUpload value={f.media} onChange={(v) => set("media", v)} label={`${t("lessonMedia")} (${t("optional")})`} />

      {f.type === "mcq" && (<>
        <div className="grid grid-2">
          <div className="field"><label>{t("answerMode")}</label>
            <select value={f.answerMode} onChange={(e) => set("answerMode", e.target.value)}>
              <option value="choice">{t("modeChoice")}</option><option value="search">{t("modeSearch")}</option></select></div>
          {f.answerMode === "search" && (
            <div className="field"><label>{t("autocompleteSubject")}</label>
              <select value={f.subject} onChange={(e) => onSubject(e.target.value)}>
                <option value="">{t("customList")}</option>
                {Object.entries(SUBJECTS).map(([k, v]) => <option key={k} value={k}>{lang === "fa" ? v.fa : v.en}</option>)}
              </select></div>
          )}
        </div>
        <div className="field"><label>{t("options")} ({t("tapCorrect")})</label>
          {f.options.map((o, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <input type="radio" checked={o.correct} onChange={() => setCorrect(i)} style={{ width: 18, height: 18 }} />
              <input value={o.fa} onChange={(e) => setOpt(i, "fa", e.target.value)} placeholder={`${t("option")} ${i + 1} (FA)`} style={{ flex: 1 }} />
              <input value={o.en} onChange={(e) => setOpt(i, "en", e.target.value)} placeholder="EN" style={{ flex: 1 }} />
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => set("options", [...f.options, { fa: "", en: "", correct: false }])}>+ {t("option")}</button>
        </div>
      </>)}

      {f.type === "truefalse" && (
        <div className="field"><label>{t("correctAnswer")}</label>
          <select value={f.answer ? "t" : "f"} onChange={(e) => set("answer", e.target.value === "t")}>
            <option value="t">{t("true")}</option><option value="f">{t("false")}</option></select></div>
      )}
      {f.type === "fill" && (<>
        <div className="field"><label>{t("fillAnswer")}</label><input value={f.blank_fa} onChange={(e) => set("blank_fa", e.target.value)} /></div>
        <div className="field"><label>{t("fillAccepted")}</label><input value={f.accept_fa} onChange={(e) => set("accept_fa", e.target.value)} placeholder={t("commaSeparated")} /></div>
      </>)}
      {f.type === "match" && (
        <div className="field"><label>{t("matchPairs")}</label>
          {f.pairs.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <input value={p.l} onChange={(e) => setPair(i, "l", e.target.value)} placeholder={t("left")} style={{ flex: 1 }} />
              <span style={{ alignSelf: "center" }}>↔</span>
              <input value={p.r} onChange={(e) => setPair(i, "r", e.target.value)} placeholder={t("right")} style={{ flex: 1 }} />
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => set("pairs", [...f.pairs, { l: "", r: "" }])}>+ {t("pair")}</button>
        </div>
      )}
      {f.type === "order" && (
        <div className="field"><label>{t("orderItems")}</label>
          <textarea value={f.items_fa} onChange={(e) => set("items_fa", e.target.value)} placeholder={t("orderHint")} /></div>
      )}
      {f.type === "compare" && (
        <div className="field">
          <label>تمایز بالینی</label>
          <div className="grid grid-2" style={{ marginBottom: 8 }}>
            <input value={f.entityA_fa} onChange={(e) => set("entityA_fa", e.target.value)} placeholder="A (FA)" />
            <input value={f.entityB_fa} onChange={(e) => set("entityB_fa", e.target.value)} placeholder="B (FA)" />
            <input value={f.entityA_en} onChange={(e) => set("entityA_en", e.target.value)} placeholder="A (EN)" />
            <input value={f.entityB_en} onChange={(e) => set("entityB_en", e.target.value)} placeholder="B (EN)" />
          </div>
          {(f.features || []).map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
              <input value={row.fa} onChange={(e) => set("features", f.features.map((x, j) => j === i ? { ...x, fa: e.target.value } : x))} placeholder="ویژگی FA" style={{ flex: 1 }} />
              <input value={row.en} onChange={(e) => set("features", f.features.map((x, j) => j === i ? { ...x, en: e.target.value } : x))} placeholder="EN" style={{ flex: 1 }} />
              <select value={row.belongs || "A"} onChange={(e) => set("features", f.features.map((x, j) => j === i ? { ...x, belongs: e.target.value } : x))}>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="both">هر دو</option>
              </select>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => set("features", [...(f.features || []), { fa: "", en: "", belongs: "A" }])}>+ ویژگی</button>
        </div>
      )}

      <div className="divider" />
      <div className="small muted mb8"><Icon name="bulb" size={15} /> <b>{t("hintQuestion")}</b> — {t("hintQuestionNote")}</div>
      <div className="field"><textarea value={f.hints_fa} onChange={(e) => set("hints_fa", e.target.value)} placeholder={t("hintsPlaceholder")} /></div>

      <div className="divider" />
      <div className="small muted mb8"><Icon name="book" size={15} /> <b>{t("microLesson")}</b> — {t("microLessonNote")}</div>
      <div className="field"><label>{t("microLead")}</label><textarea value={f.micro.lead_fa} onChange={(e) => set("micro", { ...f.micro, lead_fa: e.target.value })} /></div>
      <div className="field"><label>{t("microGolden")}</label><input value={f.micro.golden_fa} onChange={(e) => set("micro", { ...f.micro, golden_fa: e.target.value })} /></div>
      <div className="field"><label>{t("microPoints")}</label><textarea value={f.micro.points_fa} onChange={(e) => set("micro", { ...f.micro, points_fa: e.target.value })} placeholder={t("onePerLine")} /></div>
      <div className="field"><label>{t("microSource")}</label><input value={f.micro.source_fa} onChange={(e) => set("micro", { ...f.micro, source_fa: e.target.value })} /></div>
      <MediaUpload value={f.micro.media} onChange={(v) => set("micro", { ...f.micro, media: v })} label={`${t("microMedia")} (${t("optional")})`} />

      <div className="divider" />
      <div className="small muted mb8"><Icon name="check" size={15} /> <b>{t("answerKey")}</b> — {t("answerKeyNote")}</div>
      <div className="field"><label>{t("answerKey")}</label><textarea value={f.explain.text_fa} onChange={(e) => set("explain", { ...f.explain, text_fa: e.target.value })} placeholder={t("answerKeyPlaceholder")} /></div>
      <MediaUpload value={f.explain.media} onChange={(v) => set("explain", { ...f.explain, media: v })} label={`${t("explainMedia")} (${t("optional")})`} />

      <div className="divider" />
      <div className="small muted mb8">🧠 <b>{t("mnemonicEditor")}</b> — {t("mnemonicEditorNote")}</div>
      <div className="field"><label>{t("mnemonicTitle")}</label><input value={f.mnemonic.title_fa} onChange={(e) => set("mnemonic", { ...f.mnemonic, title_fa: e.target.value })} /></div>
      <div className="field"><label>{t("mnemonicScene")}</label><textarea value={f.mnemonic.scene_fa} onChange={(e) => set("mnemonic", { ...f.mnemonic, scene_fa: e.target.value })} placeholder={t("mnemonicScenePlaceholder")} /></div>
      <div className="field"><label>{t("mnemonicHooks")}</label><textarea value={f.mnemonic.hooks_fa} onChange={(e) => set("mnemonic", { ...f.mnemonic, hooks_fa: e.target.value })} placeholder={t("onePerLine")} /></div>
      <MediaUpload value={f.mnemonic.media?.url ? f.mnemonic.media : mediaState(f.mnemonic.image)}
        onChange={(v) => set("mnemonic", { ...f.mnemonic, media: v, image: v.kind === "image" ? v.url : "" })}
        label={`${t("mnemonicImage")} / ${lang === "fa" ? "ویدیو" : "video"} (${t("optional")})`} />

      {/* LIVE PREVIEW — exactly how the learner sees the lesson */}
      {(previewMicro.lead || previewMicro.golden || previewMicro.points.length) ? (
        <>
          <div className="divider" />
          <div className="small muted mb8"><Icon name="target" size={15} /> <b>{t("livePreview")}</b></div>
          <div className="preview-box"><MicroLesson micro={previewMicro} defaultOpen /></div>
        </>
      ) : null}

      <div className="divider" />
      <div className="grid grid-2">
        <div className="field"><label>{t("category")}</label><input value={f.category} onChange={(e) => set("category", e.target.value)} placeholder={t("categoryPlaceholder")} /></div>
        <label className="toggle-row" style={{ marginTop: 22 }}><span><Icon name="crown" size={15} /> {t("premiumCard")}</span>
          <input type="checkbox" checked={f.premium} onChange={(e) => set("premium", e.target.checked)} /></label>
      </div>
    </Modal>
  );
}

/* Bulk create: paste lines "question | opt1* | opt2 | opt3" (star = correct). */
function BulkModal({ onClose, onDone }) {
  const { t } = useApp();
  const toast = useToast();
  const [text, setText] = useState("");
  const [premium, setPremium] = useState(false);
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);

  const parse = () => text.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const parts = line.split("|").map((s) => s.trim());
    const q = parts[0];
    const opts = parts.slice(1).map((p) => ({ fa: p.replace(/\*$/, "").trim(), correct: p.endsWith("*") }));
    if (!opts.some((o) => o.correct) && opts.length) opts[0].correct = true;
    return { type: "mcq", q_fa: q, options: opts, premium, category };
  });
  const submit = async () => {
    const cards = parse().filter((c) => c.q_fa && c.options.length >= 2);
    if (!cards.length) return toast(t("noData"));
    setBusy(true);
    try { const r = await api.post("/admin/learn-cards/bulk", { cards }); toast(`${t("importedCount")}: ${r.created}`); onDone(); }
    finally { setBusy(false); }
  };
  const example = "شایع‌ترین علت... کدام است؟ | گزینه درست* | گزینه ب | گزینه ج | گزینه د";
  return (
    <Modal title={t("bulkCreate")} onClose={onClose}>
      <div className="small muted mb8">{t("bulkCreateHint")}</div>
      <div className="micro-box small mb16" style={{ padding: "10px 12px", direction: "rtl" }}>{example}</div>
      <div className="grid grid-2">
        <div className="field"><label>{t("category")}</label><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("categoryPlaceholder")} /></div>
        <label className="toggle-row"><span><Icon name="crown" size={15} /> {t("allPremium")}</span>
          <input type="checkbox" checked={premium} onChange={(e) => setPremium(e.target.checked)} /></label>
      </div>
      <div className="field"><label>{t("pasteOrEdit")}</label>
        <textarea style={{ minHeight: 180, direction: "rtl" }} value={text} onChange={(e) => setText(e.target.value)} placeholder={example} /></div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t("close")}</button>
        <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? t("loading") : t("import")}</button>
      </div>
    </Modal>
  );
}

/* Import a media-faithful JSON bundle (produced by "Export"). Reads the file,
   previews what will import, then commits. Media (image/video/embed), درسنامه,
   پاسخنامه and mnemonic are all preserved. */
function BundleImportModal({ onClose, onDone }) {
  const { t, lang } = useApp();
  const toast = useToast();
  const fileRef = useRef(null);
  const [bundle, setBundle] = useState(null);
  const [preview, setPreview] = useState(null);
  const [attach, setAttach] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setErr(""); setPreview(null); setBundle(null);
    try {
      const text = await f.text();
      const parsed = JSON.parse(text);
      if (parsed.format !== "med-school/cards" || !Array.isArray(parsed.cards)) throw new Error(t("bundleInvalid"));
      setBundle(parsed);
      const p = await api.post("/admin/learn-cards/import-bundle/preview", { bundle: parsed });
      setPreview(p);
    } catch (e2) { setErr(e2.message === "HTTP 400" ? t("bundleInvalid") : String(e2.message)); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  const commit = async () => {
    if (!bundle) return;
    setBusy(true);
    try {
      const r = await api.post("/admin/learn-cards/import-bundle", { bundle, attachToPath: attach });
      toast(t("bundleImported").replace("{n}", r.imported));
      onDone();
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={t("importBundle")} onClose={onClose}>
      <div className="small muted mb8">{t("importBundleHint")}</div>
      <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={onFile} />
      <button className="btn btn-ghost btn-block" onClick={() => fileRef.current?.click()}>
        <Icon name="upload" size={15} /> {t("chooseBundleFile")}
      </button>
      {err && <div className="err-banner mt8" style={{ margin: "8px 0 0" }}>{err}</div>}
      {preview && (
        <div className="bundle-preview mt16">
          <div className="grid grid-3">
            <div className="cs-kpi card"><div className="cs-kpi-v">{preview.valid}</div><div className="cs-kpi-l">{t("bundleValid")}</div></div>
            <div className="cs-kpi card"><div className="cs-kpi-v">{preview.withMedia}</div><div className="cs-kpi-l">{t("bundleWithMedia")}</div></div>
            <div className="cs-kpi card"><div className="cs-kpi-v">{preview.total}</div><div className="cs-kpi-l">{t("bundleTotal")}</div></div>
          </div>
          <div className="small muted mt8">{t("bundleTypes")}: {Object.entries(preview.byType).map(([k, v]) => `${k}×${v}`).join(" · ")}</div>
          {preview.errors?.length > 0 && <div className="err-banner mt8">{preview.errors.slice(0, 5).join(" / ")}</div>}
          <label className="toggle-row mt8"><span>{t("bundleAttachToPath")}</span>
            <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} /></label>
        </div>
      )}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t("close")}</button>
        <button className="btn btn-primary" disabled={busy || !bundle || !preview?.valid} onClick={commit}>
          {busy ? t("loading") : t("import")}
        </button>
      </div>
    </Modal>
  );
}
