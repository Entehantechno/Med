import AiRoutesEditor from "../components/AiRoutesEditor.jsx";
import { useEffect, useState, useRef, useMemo, lazy, Suspense } from "react";
import { useApp } from "../context.jsx";
import { api, getToken } from "../api.js";
import { TopBar, Spinner, Pill, Modal, useToast } from "../components/UI.jsx";
import ImageUpload from "../components/ImageUpload.jsx";
import AudioUpload from "../components/AudioUpload.jsx";
import MediaLibraryPicker from "../components/MediaLibraryPicker.jsx";
import { BarChart, LineChart, Donut, RadarChart } from "../components/Charts.jsx";
import { biField } from "../lib/bifield.js";
import { fmtDate, fmtDateTime, fmtDuration,
  todayJalali, jalaliMonthDays, jalaliTimeToIso, isoToJalaliParts, fmtDateLong } from "../utils/date.js";
import { SUBJECTS } from "../data/subject-catalog.js";
import SearchAnswer from "../components/SearchAnswer.jsx";
import OrderSearch from "../components/OrderSearch.jsx";
import OrderCatalogAdmin from "../components/OrderCatalogAdmin.jsx";
import DataTable from "../components/DataTable.jsx";
import ShamsiDatePicker from "../components/ShamsiDatePicker.jsx";
import { SITE_CONTENT_SCHEMA } from "../data/site-content-schema.js";
import Leaderboard from "../components/Leaderboard.jsx";
import StatNum from "../components/StatNum.jsx";
import Icon from "../components/Icon.jsx";
import { VpGradingPanel, VpGradingRubric, mergeRubric, emptyRubric } from "../components/VpGradingRubric.jsx";
import { SkeletonCards, SkeletonTable } from "../components/Skeleton.jsx";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import VirtualList from "../components/VirtualList.jsx";
import HotspotEditor from "../components/HotspotEditor.jsx";
import { safeLocal } from "../lib/storage.js";

// Heavy admin sections are lazy-loaded so the initial admin panel appears much
// faster after login. The visible UI of each section is unchanged; only when a
// user opens that section do we download its code.
const PathManager = lazy(() => import("./admin/PathManager.jsx"));
const RoleEditor = lazy(() => import("./admin/RoleEditor.jsx"));
const StoreManager = lazy(() => import("./admin/StoreManager.jsx"));
const PricingEditor = lazy(() => import("./admin/PricingEditor.jsx"));
const LearnCards = lazy(() => import("./admin/LearnCards.jsx"));
const MediaLibrary = lazy(() => import("./admin/MediaLibrary.jsx"));
const ContentStats = lazy(() => import("./admin/ContentStats.jsx"));
const ImportModal = lazy(() => import("./admin/ImportModal.jsx"));
const CommunityModeration = lazy(() => import("./admin/CommunityModeration.jsx"));
function LazyAdminChunk({ children }) {
  return <Suspense fallback={<Spinner />}>{children}</Suspense>;
}

/* Reusable CSV import/export toolbar. `kind` = "cases" | "flashcards" */
function CsvTools({ kind, onImported }) {
  const { t } = useApp();
  const toast = useToast();
  const fileRef = useRef(null);
  const download = async () => {
    const res = await fetch(`/api/${kind}-export.csv`, { credentials: "same-origin", headers: { Authorization: `Bearer ${getToken()}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${kind}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  const upload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const csv = await file.text();
    try {
      const res = await api.post(`/${kind}-import`, { csv });
      toast(`${t("imported")}: ${res.imported}`);
      onImported && onImported();
    } catch { toast(t("importError")); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={upload} style={{ display: "none" }} />
      <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} /> {t("importCsv")}</button>
      <button className="btn btn-ghost btn-sm" onClick={download}><Icon name="download" size={16} /> {t("exportCsv")}</button>
    </div>
  );
}

/* Admin notification bell — analytics alerts + weekly digests, with an unseen
   badge. Polls the admin feed and lets the admin mark all as seen. */
function AdminBell() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({ notifications: [], unseen: 0 });
  const load = () => api.get("/admin/notifications").then(setD).catch(() => {});
  useEffect(() => { load(); const id = setInterval(load, 120000); return () => clearInterval(id); }, []);
  const toggle = async () => {
    const next = !open; setOpen(next);
    if (next && d.unseen > 0) { try { await api.post("/admin/notifications/seen", {}); setD((x) => ({ ...x, unseen: 0 })); } catch { /* */ } }
  };
  const kindIcon = (k) => (k === "admin_digest" ? "📊" : k === "admin_alert" ? "⚠️" : "🔔");
  return (
    <div style={{ position: "relative" }}>
      <button className="btn btn-ghost btn-sm" onClick={toggle} title={t("adminNotifs")} style={{ position: "relative" }}>
        <Icon name="bell" size={18} />
        {d.unseen > 0 && <span style={{ position: "absolute", top: -4, insetInlineEnd: -4, background: "var(--flame,#e0533d)", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, lineHeight: "16px", textAlign: "center", padding: "0 3px" }}>{d.unseen}</span>}
      </button>
      {open && (
        <div className="card" style={{ position: "absolute", insetInlineEnd: 0, top: "110%", zIndex: 50, width: 340, maxWidth: "88vw", maxHeight: 420, overflowY: "auto", boxShadow: "0 10px 30px rgba(0,0,0,.18)" }}>
          <div className="section-title" style={{ marginBottom: 8 }}><h4 style={{ fontSize: ".95rem" }}>{t("adminNotifs")}</h4>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}><Icon name="close" size={13} /></button></div>
          {d.notifications.length === 0 ? <div className="small muted center" style={{ padding: 14 }}>{t("adminNoNotifs")}</div> :
            d.notifications.map((n) => (
              <div key={n.id} className="small" style={{ padding: "8px 6px", borderBottom: "1px solid var(--border,#eee)", opacity: n.seen ? 0.7 : 1 }}>
                <div style={{ fontWeight: 700 }}>{kindIcon(n.kind)} {fa ? n.title_fa : n.title_en}</div>
                <div className="muted" style={{ marginTop: 2 }}>{fa ? n.body_fa : n.body_en}</div>
                <div className="muted" style={{ fontSize: ".7rem", marginTop: 2 }}>{(n.created_at || "").slice(0, 16).replace("T", " ")}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default function Admin({ home }) {
  const { t, user, can } = useApp();
  const isAdmin = user.role === "admin";

  // Admin nav is organised into labelled SECTIONS so each role sees a tidy,
  // categorised, uncluttered sidebar (only the sections they have access to).
  // Each item: [id, icon, permission].
  // ── THREE top-level universes ──────────────────────────────────────────
  // 1) General (کلیات): all-users view + all shared/system settings gathered here.
  // 2) University (دانشگاهی): teaching, uni users, uni content.
  // 3) Competitive (رقابتی): learner users, learner content, marketing, support.
  const generalSections = [
    { title: t("navGroupOverview"), items: [["overview", "dashboard", "learn.view"], ["siteAnalytics", "chart", "learn.view"], ["dailyUsers", "chart", "learn.view"], ["adAnalytics", "target", "learn.view"], ["productHealth", "activity", "learn.view"], ["growthAdmin", "users", "learn.view"]] },
    { title: t("navGroupPeople"), items: [["usersAll", "users", "learn.users"]] },
    { title: t("navGroupPublicSite"), items: [["siteContent", "edit", "learn.settings"], ["landingManager", "medal", "learn.content"]] },
    { title: t("navGroupSettings"), items: [["globalSettings", "settings", "learn.settings"], ["siteControl", "settings", "learn.settings"], ["securityAdmin", "shield", "learn.settings"], ["featureFlags", "settings", "learn.flags"], ["roleEditor", "shield", "learn.settings"], ["dataTools", "download", "learn.data"], ["researchAdmin", "book", "learn.data"], ["externalAdsAdmin", "image", "learn.ads"], ["tutorSettings", "ai", "learn.settings"], ["auditLog", "clock", "learn.audit"]] },
  ];
  const uniSections = [
    { title: t("navGroupOverview"), items: [["dashboard", "dashboard", "uni.view"], ["reports", "chart", "uni.reports"]] },
    { title: t("navGroupTeaching"), items: [["classes", "class", "uni.classes"], ["vpConversations", "chat", "uni.classes"], ["classResults", "chart", "uni.classes"], ["drawingReviews", "image", "uni.classes"], ["vpGrading", "target", "uni.content"], ["exams", "exam", "uni.exams"], ["results", "trophy", "uni.exams"], ["researchAdmin", "book", "uni.classes"]] },
    { title: t("navGroupPeople"), items: [["users", "users", "uni.users"], ["universities", "class", "uni.users"]] },
    { title: t("navGroupContent"), items: [["cases", "patient", "uni.content"], ["flashcards", "flask", "uni.content"], ["catalogs", "catalog", "uni.content"], ["checklists", "check", "uni.content"], ["questionnairesAdmin", "check", "uni.content"], ["aiConfig", "ai", "uni.ai"]] },
  ];
  const competitiveSections = [
    { title: t("navGroupPeople"), items: [["learnerMgmt", "users", "learn.users"], ["placementReport", "compass", "learn.view"], ["certificatesAdmin", "medal", "learn.users"], ["premiumAccounts", "crown", "learn.users"]] },
    { title: t("navGroupContent"), items: [["learnCards", "flask", "learn.content"], ["contentStats", "chart", "learn.content"], ["mediaLibrary", "image", "learn.content"], ["pathManager", "book", "learn.content"], ["mascotsAdmin", "star", "learn.content"], ["vpatientAdmin", "patient", "learn.settings"], ["dxAdmin", "target", "learn.content"], ["blogAdmin", "book", "learn.content"], ["communityMod", "users", "learn.content"]] },
    { title: t("navGroupMarketing"), items: [["adsMgmt", "image", "learn.ads"], ["storeManager", "store", "store.manage"], ["pricingEditor", "crown", "learn.settings"], ["groupPurchase", "users", "learn.settings"], ["payments", "crown", "learn.settings"]] },
    { title: t("navGroupSupport"), items: [["supportInbox", "chat", "learn.support"], ["helpCenter", "book", "learn.content"]] },
    { title: t("navGroupSystem"), items: [["remindersAdmin", "clock", "learn.settings"], ["pwaAdmin", "download", "learn.view"], ["twaAdmin", "download", "learn.settings"], ["seoAdmin", "settings", "learn.settings"], ["gamification", "bolt", "learn.settings"], ["fsrsOptimizer", "brain", "learn.settings"]] },
  ];
  // Build visible nav sections and de-duplicate by tab id. This is a safety net
  // so future additions cannot accidentally show the same admin tab twice.
  const buildSections = (secs) => {
    const seen = new Set();
    return secs
      .map((s) => ({
        ...s,
        items: s.items.filter(([id, , perm]) => {
          if (!can(perm) || seen.has(id)) return false;
          seen.add(id);
          return true;
        }),
      }))
      .filter((s) => s.items.length);
  };
  const generalNavSections = buildSections(generalSections);
  const uniNavSections = buildSections(uniSections);
  const competitiveNavSections = buildSections(competitiveSections);
  const generalNav = generalNavSections.flatMap((s) => s.items);
  const uniNav = uniNavSections.flatMap((s) => s.items);
  const competitiveNav = competitiveNavSections.flatMap((s) => s.items);

  const sectionsFor = (m) => m === "general" ? generalNavSections : m === "uni" ? uniNavSections : competitiveNavSections;
  const navFor = (m) => m === "general" ? generalNav : m === "uni" ? uniNav : competitiveNav;

  const hasGeneral = generalNav.length > 0;
  const hasUni = uniNav.length > 0;
  const hasLearn = competitiveNav.length > 0;
  const firstMode = hasGeneral ? "general" : hasUni ? "uni" : "learn";
  const [mode, setMode] = useState(firstMode);
  const nav = navFor(mode);
  const navSections = sectionsFor(mode);
  const [tab, setTab] = useState((nav[0] || ["dashboard"])[0]);
  useEffect(() => {
    const onSwitch = (e) => { if (e.detail?.tab) setTab(e.detail.tab); };
    window.addEventListener("admin-switch-tab", onSwitch);
    return () => window.removeEventListener("admin-switch-tab", onSwitch);
  }, []);

  const switchMode = (m) => { setMode(m); const n = navFor(m); setTab((n[0] || ["dashboard"])[0]); };

  // cross-tab jump: e.g. the content dashboard asks to open "مدیریت محتوا"
  // pre-filtered to one subject. { subject } is consumed once by LearnCards.
  const [cardsJump, setCardsJump] = useState(null);
  const [navQuery, setNavQuery] = useState("");      // admin sidebar quick-search
  const [secOpen, setSecOpen] = useState({});        // collapsible admin nav groups
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false); // command palette / Ctrl+K
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === "k") { e.preventDefault(); setCmdOpen(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // pick a tab AND close the mobile dropdown so the content is shown immediately.
  // The picker is cross-universe: overview cards and Ctrl+K can jump from
  // کلیات to دانشگاهی/رقابتی without leaving the user on a hidden tab.
  const findModeForTab = (id) => generalNav.some(([x]) => x === id) ? "general" : uniNav.some(([x]) => x === id) ? "uni" : competitiveNav.some(([x]) => x === id) ? "learn" : null;
  const pickTab = (id) => { const m = findModeForTab(id); if (m) setMode(m); setTab(id); setMobileNavOpen(false); };
  const jumpToCards = (filter) => { setCardsJump(filter); setMode("learn"); setTab("learnCards"); setMobileNavOpen(false); };
  const paletteNav = (() => {
    const seen = new Set();
    const rows = [];
    [["general", generalNav], ["uni", uniNav], ["learn", competitiveNav]].forEach(([m, items]) => {
      items.forEach(([id, ic]) => { if (!seen.has(id)) { seen.add(id); rows.push([id, ic, m]); } });
    });
    return rows;
  })();

  // guard: never render a tab the user lacks permission for
  const allowedTabs = nav.map(([id]) => id);
  if (!allowedTabs.includes(tab) && allowedTabs.length) setTab(allowedTabs[0]);

  return (
    <div className="app">
      <TopBar onHome={home} />
      <div className="container">
        <div className="section-title">
          <h2>{t("adminPanel")}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setCmdOpen(true)} title="Ctrl+K"><Icon name="search" size={14}/> Ctrl+K</button>
            <AdminBell />
            <Pill kind={isAdmin ? "active" : "medium"}>{t(user.role)}</Pill>
          </div>
        </div>

        {/* Top-level universe switcher — کلیات / دانشگاهی / رقابتی. */}
        {[hasGeneral, hasUni, hasLearn].filter(Boolean).length > 1 && (
          <div className="admin-mode-panel">
            <div className="mode-switch">
              {hasGeneral && (
                <button className={mode === "general" ? "active" : ""} onClick={() => switchMode("general")}>
                  <Icon name="settings" size={18} /> {t("generalTab")}
                </button>
              )}
              {hasUni && (
                <button className={mode === "uni" ? "active" : ""} onClick={() => switchMode("uni")}>
                  <Icon name="class" size={18} /> {t("uniTab")}
                </button>
              )}
              {hasLearn && (
                <button className={mode === "learn" ? "active" : ""} onClick={() => switchMode("learn")}>
                  <Icon name="medal" size={18} /> {t("competitiveTab")}
                </button>
              )}
            </div>
            <div className="small muted admin-mode-hint">
              {mode === "general" ? t("adminModeGeneralHint") : mode === "uni" ? t("adminModeUniHint") : t("adminModeCompetitiveHint")}
            </div>
          </div>
        )}

        {cmdOpen && <AdminCommandPalette nav={paletteNav} t={t} pick={(id)=>{pickTab(id);setCmdOpen(false)}} onClose={()=>setCmdOpen(false)} />}

        <div className="admin-layout">
          {/* Mobile: the long admin menu becomes a tidy dropdown. This button
              shows the current section and toggles the full list open/closed. */}
          <button className="sidenav-mobile-toggle" aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((o) => !o)}>
            <span><Icon name="menu" size={16} /> {t(tab) || t("adminPanel")}</span>
            <Icon name={mobileNavOpen ? "chevronUp" : "chevronDown"} size={15} />
          </button>
          <div className={`card sidenav ${mobileNavOpen ? "mobile-open" : ""}`}>
            {/* quick search across all admin tabs — declutters a long menu */}
            <div className="dt-search sidenav-search">
              <Icon name="search" size={15} />
              <input value={navQuery} onChange={(e) => setNavQuery(e.target.value)}
                placeholder={t("searchPlaceholder") || "جستجو…"} />
              {navQuery && <button className="dt-clear" onClick={() => setNavQuery("")}><Icon name="close" size={13} /></button>}
            </div>
            {navSections.map((sec) => {
              const nq = navQuery.trim().toLowerCase();
              const visItems = sec.items.filter(([id]) => !nq || (t(id) || "").toLowerCase().includes(nq));
              if (nq && visItems.length === 0) return null;
              // a group is OPEN by default (nothing hidden); the admin can
              // collapse any group to declutter, and a group holding the active
              // tab is always shown. Search forces everything open.
              const hasActive = sec.items.some(([id]) => id === tab);
              const open = nq || hasActive ? true : (secOpen[sec.title] ?? true);
              return (
                <div className={`sidenav-group ${open ? "open" : "collapsed"}`} key={sec.title}>
                  <button className="sidenav-title" onClick={() => setSecOpen((o) => ({ ...o, [sec.title]: !open }))} aria-expanded={open}>
                    <span>{sec.title}</span>
                    <Icon name={open ? "chevronUp" : "chevronDown"} size={13} />
                  </button>
                  {/* items stay in the DOM (mobile shows them in a scroller); on
                      desktop a collapsed group hides them via CSS */}
                  {visItems.map(([id, ic]) => (
                    <button key={id} className={`nav-tab-btn ${tab === id ? "active" : ""}`} onClick={() => pickTab(id)}><Icon name={ic} size={18} /> {t(id)}</button>
                  ))}
                </div>
              );
            })}
          </div>
          <div style={{ minWidth: 0 }}>
            <ErrorBoundary key={tab} compact>
            {tab === "dashboard" && <Dashboard />}
            {tab === "exams" && <Exams />}
            {tab === "classes" && <Classes />}
            {tab === "classResults" && <ClassResults />}
            {tab === "users" && <Users />}
            {tab === "usersAll" && <UsersManager scope="all" />}
            {tab === "universities" && <Universities />}
            {tab === "cases" && <Cases />}
            {tab === "flashcards" && <Flashcards />}
            {tab === "catalogs" && <Catalogs />}
            {tab === "checklists" && <Checklists />}
            {tab === "vpGrading" && <VpGradingPanel />}
            {tab === "questionnairesAdmin" && <QuestionnairesAdmin />}
            {tab === "aiConfig" && <AiSection />}
            {tab === "results" && <ExamResults />}
            {tab === "reports" && <Reports />}
            {tab === "adsMgmt" && <AdsManager />}
            {tab === "gamification" && <GamificationConfig />}
            {tab === "supportInbox" && <SupportInbox />}
            {tab === "helpCenter" && <HelpCenterAdmin />}
            {tab === "landingManager" && <LandingManager />}
            {tab === "dxAdmin" && <DxAdmin />}
            {tab === "productHealth" && <ProductHealth />}
            {tab === "growthAdmin" && <GrowthAdmin />}
            {tab === "siteAnalytics" && <SiteAnalytics />}
            {tab === "dailyUsers" && <DailyUsersAdmin />}
            {tab === "adAnalytics" && <AdAnalytics />}
            {tab === "remindersAdmin" && <RemindersAdmin />}
            {tab === "pwaAdmin" && <PwaAdmin />}
            {tab === "twaAdmin" && <TwaAdmin />}
            {tab === "seoAdmin" && <SeoAdmin />}
            {tab === "securityAdmin" && <SecurityAdmin />}
            {tab === "researchAdmin" && <ResearchAdmin />}
            {tab === "externalAdsAdmin" && <ExternalAdsAdmin />}
            {tab === "tutorSettings" && <TutorSettingsAdmin />}
            {tab === "fsrsOptimizer" && <FsrsOptimizer />}
            {tab === "siteContent" && <SiteContent />}
            {tab === "overview" && <SystemOverview onJump={pickTab} />}
            {tab === "learnerMgmt" && <LearnerManagement />}
            {tab === "placementReport" && <PlacementReport />}
            {tab === "learnCards" && <LazyAdminChunk><LearnCards jump={cardsJump} onJumpConsumed={() => setCardsJump(null)} /></LazyAdminChunk>}
            {tab === "mediaLibrary" && <LazyAdminChunk><MediaLibrary /></LazyAdminChunk>}
            {tab === "contentStats" && <LazyAdminChunk><ContentStats onJump={jumpToCards} /></LazyAdminChunk>}
            {tab === "blogAdmin" && <BlogAdmin />}
            {tab === "certificatesAdmin" && <CertificatesAdmin />}
            {tab === "communityMod" && <LazyAdminChunk><CommunityModeration /></LazyAdminChunk>}
            {tab === "pathManager" && <LazyAdminChunk><PathManager /></LazyAdminChunk>}
            {tab === "mascotsAdmin" && <MascotsAdmin />}
            {tab === "vpatientAdmin" && <VpatientAdmin />}
            {tab === "roleEditor" && <LazyAdminChunk><RoleEditor /></LazyAdminChunk>}
            {tab === "storeManager" && <LazyAdminChunk><StoreManager /></LazyAdminChunk>}
            {tab === "pricingEditor" && <LazyAdminChunk><PricingEditor /></LazyAdminChunk>}
            {tab === "premiumAccounts" && <PremiumAccounts />}
            {tab === "groupPurchase" && <GroupPurchaseAdmin />}
            {tab === "payments" && <PaymentsAdmin />}
            {tab === "siteControl" && <SiteControl />}
            {tab === "featureFlags" && <FeatureFlags />}
            {tab === "auditLog" && <AuditLog />}
            {tab === "globalSettings" && <GlobalSettings />}
            {tab === "dataTools" && <DataTools />}
            {tab === "drawingReviews" && <DrawingReviewsInbox />}
            {tab === "vpConversations" && <VpConversations />}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Dashboard ---- */
function Dashboard() {
  const { t, lang } = useApp();
  const [s, setS] = useState(null);
  const [attempts, setAttempts] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  useEffect(() => {
    setLoadErr("");
    api.get("/reports/summary").then(setS).catch((e) => { setLoadErr(String(e.message || e)); setS({ __err: true }); });
    api.get("/reports/attempts").then((d) => setAttempts(Array.isArray(d) ? d : [])).catch((e) => { setLoadErr(String(e.message || e)); setAttempts({ __err: true }); });
  }, []);
  if (s?.__err || attempts?.__err || loadErr) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{loadErr || (lang === "fa" ? "بارگذاری داشبورد شکست خورد" : "Could not load the dashboard")}</h3></div>;
  if (!s || !attempts) return (<><div className="grid grid-4">{[0,1,2,3].map(i=><div className="card" key={i}><div className="skeleton sk-card"/></div>)}</div><div className="mt16"><SkeletonTable rows={4} /></div></>);

  // chronological order for the trend line
  const chrono = [...attempts].reverse();
  const trend = chrono.map((a) => a.score).slice(-12);
  // score distribution buckets
  const buckets = [
    { label: "0–59", value: 0 }, { label: "60–74", value: 0 },
    { label: "75–89", value: 0 }, { label: "90–100", value: 0 },
  ];
  attempts.forEach((a) => {
    const sc = a.score || 0;
    if (sc < 60) buckets[0].value++; else if (sc < 75) buckets[1].value++;
    else if (sc < 90) buckets[2].value++; else buckets[3].value++;
  });
  const vp = attempts.filter((a) => a.type === "vp").length;
  const fl = attempts.filter((a) => a.type === "flash").length;

  return (
    <>
      <div className="grid grid-4">
        <Stat num={s.students} label={t("totalStudents")} />
        <Stat num={s.cases} label={t("totalCases")} />
        <Stat num={s.cards} label={t("totalCards")} />
        <Stat num={s.avgScore} label={t("avgScore")} />
      </div>

      <div className="grid grid-2 mt16">
        <div className="card chart-card">
          <h4 className="mb8"><Icon name="chart" size={16} /> {t("scoreTrend")}</h4>
          <div className="small muted mb8">{t("last7")}</div>
          <LineChart values={trend.length >= 2 ? trend : [0, 0]} />
        </div>
        <div className="card chart-card">
          <h4 className="mb8"><Icon name="pie" size={16} /> {t("activityByType")}</h4>
          <Donut parts={[
            { label: t("vpExams"), value: vp, color: "var(--primary)" },
            { label: t("flashPractice"), value: fl, color: "var(--accent)" },
          ]} />
        </div>
      </div>

      <div className="card chart-card mt16">
        <h4 className="mb16"><Icon name="chart" size={16} /> {t("scoreDistribution")}</h4>
        <BarChart data={buckets} max={Math.max(1, ...buckets.map((b) => b.value))} />
      </div>

      <div className="card mt16"><h4 className="mb8"><Icon name="clock" size={16} /> {t("recentActivity")}</h4>
        {(s.recent || []).map((a) => (
          <div className="info-row" key={a.id}>
            <span>{lang === "fa" ? a.student_fa : a.student_en} — {lang === "fa" ? a.case_fa : a.case_en}</span>
            <span><b>{a.score}</b> · {fmtDateTime(a.created_at, lang)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
const Stat = ({ num, label }) => (
  <div className="card stat-card"><div className="num"><StatNum value={num} /></div><div className="lbl">{label}</div></div>
);

/* ---- Users + student enrollment & exam access ---- */
/* ============================================================================
   Unified Users manager — a single component used by all THREE admin universes:
     scope="all"          → every user (uni students/teachers, learners, admins…)
     scope="uni"          → university users only  (student, teacher, + staff)
     scope="competitive"  → competitive users only (learner)
   It carries the FULL super-set of features from both legacy panels:
   search, role filter, create, edit, impersonate, ban/activate, delete,
   reset-password, detail view + XP/gem/streak adjust, bulk student import,
   and per-student exam-access management.
   ========================================================================== */
const SCOPE_ROLES = {
  all: ["student", "teacher", "admin", "learner", "content_manager", "support"],
  // university tab: students, teachers and university managers (admins that
  // belong to a university) — the server enforces the "admin with university"
  // part via ?scope=uni.
  uni: ["student", "teacher", "admin"],
  competitive: ["learner"],
};
function UsersManager({ scope = "all" }) {
  const { t, lang, impersonate: doImpersonate } = useApp();
  const toast = useToast();
  const scopeRoles = SCOPE_ROLES[scope] || SCOPE_ROLES.all;
  const showUniTools = scope === "all" || scope === "uni";      // import + exam access
  const [users, setUsers] = useState(null);
  const [cases, setCases] = useState([]);
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [access, setAccess] = useState(null);
  const [pwUser, setPwUser] = useState(null);
  const [casesErr, setCasesErr] = useState("");
  const [loadErr, setLoadErr] = useState("");

  const load = () => {
    setLoadErr("");
    api.get(`/admin/users?scope=${scope}&roles=${scopeRoles.join(",")}&role=${role}&q=${encodeURIComponent(q)}`)
      .then((d) => setUsers(d.users || [])).catch((e) => { setUsers([]); setLoadErr(String(e.message || e)); });
  };
  useEffect(() => { load(); }, [role, scope]);
  useEffect(() => {
    if (!showUniTools) return;
    setCasesErr("");
    api.get("/cases").then((d) => setCases(Array.isArray(d) ? d : [])).catch((e) => { setCases([]); setCasesErr(String(e.message || e)); });
  }, [showUniTools]);

  const setStatus = async (u, status) => { await api.post(`/admin/users/${u.id}/status`, { status }); toast(t("saved")); load(); };
  const del = async (u) => { if (confirm(t("confirmDeleteUser"))) { try { await api.del(`/admin/users/${u.id}`); toast(t("saved")); load(); } catch (e) { toast(e.message); } } };
  const impersonate = async (u) => {
    try { const r = await api.post(`/admin/users/${u.id}/impersonate`); await doImpersonate(r.token); }
    catch (e) { toast(e.message); }
  };
  const caseTitle = (id) => { const c = cases.find((x) => x.id === id); return c ? biField(c, "title", lang) : `#${id}`; };

  if (detail) return <UserDetail id={detail} onBack={() => { setDetail(null); load(); }} />;
  if (!users) return <Spinner />;
  if (loadErr) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{loadErr}</h3><button className="btn btn-ghost mt16" onClick={load}>{lang === "fa" ? "تلاش دوباره" : "Retry"}</button></div>;

  const heading = scope === "uni" ? t("uniUsersScope") : scope === "competitive" ? t("competitiveUsersScope") : t("allUsersScope");
  const showAssignments = showUniTools;

  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="users" size={18} /> {t("usersTab")}</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {showUniTools && <button className="btn btn-ghost btn-sm" onClick={() => setImporting(true)}><Icon name="download" size={14} /> {t("importStudents")}</button>}
          {showUniTools && <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}><Icon name="user" size={14} /> {t("addStudent")}</button>}
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Icon name="user" size={14} /> {t("newUser")}</button>
        </div>
      </div>
      <div className="small muted mb8">{heading}</div>
      {casesErr && <div className="err-banner mb8">{casesErr}</div>}
      {scopeRoles.length > 1 && (
        <div className="inline-form mb16" style={{ flexWrap: "wrap", gap: 8 }}>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">{t("allRoles")}</option>
            {scopeRoles.map((r) => <option key={r} value={r}>{t(r)}</option>)}
          </select>
        </div>
      )}
      <DataTable
        rows={users}
        initialSort={{ key: "name", dir: "asc" }}
        searchPlaceholder={t("searchByNameOrNo")}
        searchKeys={[(u) => u.name_fa, (u) => u.name_en, (u) => u.username, (u) => u.student_no]}
        rowKey={(u) => u.id}
        columns={[
          { key: "name", label: t("name"), sortValue: (u) => lang === "fa" ? u.name_fa : u.name_en,
            render: (u) => (<><button className="btn-link" onClick={() => setDetail(u.id)} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontWeight: 700, padding: 0 }}>{lang === "fa" ? u.name_fa : u.name_en}</button><div className="small muted">{u.username}</div></>) },
          { key: "student_no", label: t("studentNo"), render: (u) => u.student_no || "—" },
          { key: "role", label: t("role"), sortValue: (u) => u.role, render: (u) => <Pill kind={u.role === "admin" ? "active" : "medium"}>{t(u.role)}</Pill> },
          ...(showAssignments ? [{ key: "assignments", label: t("assignments"), sortable: false, render: (u) => u.role === "student"
              ? ((u.caseIds || []).length ? (u.caseIds || []).map(caseTitle).join("، ") : <span className="muted small">{t("noStudentsExams")}</span>)
              : "—" }] : [{ key: "xp", label: t("xp"), sortValue: (u) => u.role === "learner" ? (u.xp ?? 0) : -1, render: (u) => <>{u.role === "learner" ? (u.xp ?? 0) : "—"}{u.premium ? " 👑" : ""}</> }]),
          { key: "status", label: t("statusCol"), sortValue: (u) => u.status, render: (u) => <span className={`pill pill-${u.status === "active" ? "active" : "danger"}`}>{t(u.status === "active" ? "active" : "inactive")}</span> },
          { key: "actions", label: "", sortable: false, thStyle: { textAlign: "end" },
            render: (u) => (<span style={{ display: "flex", gap: 4, justifyContent: "flex-end", whiteSpace: "nowrap" }}>
              {showUniTools && u.role === "student" && <button className="btn btn-sm btn-ghost" onClick={() => setAccess(u)} title={t("manageAccess")}><Icon name="key" size={13} /></button>}
              <button className="btn btn-sm btn-ghost" onClick={() => setEditing(u)} title={t("editUser")}><Icon name="edit" size={13} /></button>
              <button className="btn btn-sm btn-ghost" onClick={() => impersonate(u)} title={t("impersonate")}><Icon name="user" size={13} /></button>
              {u.status === "active"
                ? <button className="btn btn-sm btn-warn" onClick={() => setStatus(u, "inactive")} title={t("ban")}><Icon name="lock" size={13} /></button>
                : <button className="btn btn-sm btn-accent" onClick={() => setStatus(u, "active")} title={t("activate")}><Icon name="check" size={13} /></button>}
              <button className="btn btn-sm btn-danger" onClick={() => del(u)} title={t("deleteUser")}><Icon name="trash" size={13} /></button>
            </span>) },
        ]}
      />
      {editing && <UserEditModal user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {creating && <UserCreateModal defaultRole={scope === "uni" ? "student" : scope === "competitive" ? "learner" : "learner"} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {adding && <AddStudentModal cases={cases} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />}
      {importing && <StudentImportModal onClose={() => setImporting(false)} onDone={() => { setImporting(false); load(); }} />}
      {access && <AccessModal user={access} cases={cases} onClose={() => setAccess(null)} onDone={() => { setAccess(null); load(); }} />}
      {pwUser && <PasswordModal user={pwUser} onClose={() => setPwUser(null)} />}
    </div>
  );
}

// Legacy entry points now delegate to the unified manager, scoped per universe.
function Users() { return <UsersManager scope="uni" />; }

function AddStudentModal({ cases, onClose, onDone }) {
  const { t, lang } = useApp();
  const toast = useToast();
  const [f, setF] = useState({ studentNo: "", name_fa: "", name_en: "", password: "", maxAttempts: 1 });
  const [caseIds, setCaseIds] = useState([]);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleCase = (id) => setCaseIds((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const submit = async () => {
    if (!f.studentNo.trim()) return toast(t("studentNo"));
    try {
      const res = await api.post("/users", { ...f, role: "student", caseIds });
      toast(`${t("createdUser")} · ${t("defaultPasswordIs")}: ${res.defaultPassword}`);
      onDone();
    } catch (e) { toast(String(e.message)); }
  };
  return (
    <Modal title={t("addStudent")} onClose={onClose} onSave={submit}>
      <div className="field"><label>{t("studentNo")} *</label>
        <input value={f.studentNo} onChange={(e) => set("studentNo", e.target.value)} placeholder="e.g. 40012345" />
        <div className="small muted mt8">{t("studentNoAsUser")}</div>
      </div>
      <div className="grid grid-2">
        <div className="field"><label>{t("name")} (FA)</label><input value={f.name_fa} onChange={(e) => set("name_fa", e.target.value)} /></div>
        <div className="field"><label>{t("name")} (EN)</label><input value={f.name_en} onChange={(e) => set("name_en", e.target.value)} /></div>
      </div>
      <div className="field"><label>{t("passwordOptional")}</label>
        <input type="text" value={f.password} onChange={(e) => set("password", e.target.value)} />
        <div className="small muted mt8">{t("passwordHint")}</div>
      </div>
      <div className="divider" />
      <label className="small muted">{t("assignExams")}</label>
      <div className="small muted mb8">{t("assignExamsHint")}</div>
      {cases.map((c) => (
        <label key={c.id} className="toggle-row" style={{ cursor: "pointer" }}>
          <span>{biField(c, "title", lang)} <span className="badge-ver">v{c.version}</span></span>
          <input type="checkbox" checked={caseIds.includes(c.id)} onChange={() => toggleCase(c.id)} style={{ width: 18, height: 18 }} />
        </label>
      ))}
      <div className="field mt16"><label>{t("maxAttemptsField")}</label>
        <input type="number" min="1" value={f.maxAttempts} onChange={(e) => set("maxAttempts", +e.target.value || 1)} /></div>
    </Modal>
  );
}

/* Bulk-import students from an Excel/CSV file (name, family, student number).
   Each imported student logs in with their student number as both username and password. */
function StudentImportModal({ onClose, onDone }) {
  const { t } = useApp();
  const toast = useToast();
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // .csv (and Excel saved-as-CSV) are plain text; read directly.
    const content = await file.text();
    setText(content);
  };

  const submit = async () => {
    if (!text.trim()) return toast(t("noData"));
    setBusy(true);
    try {
      const r = await api.post("/users/import", { csv: text });
      setResult(r);
      toast(`${t("importedCount")}: ${r.created}`);
    } catch (e) { toast(String(e.message)); }
    finally { setBusy(false); }
  };

  const template = "نام,نام خانوادگی,شماره دانشجویی\nعلی,رضایی,40012345\nمریم,کریمی,40067890";

  return (
    <Modal title={t("importStudents")} onClose={onClose}>
      <div className="small muted mb8">{t("studentImportHint")}</div>
      <div className="micro-box small mb16" style={{ padding: "12px 14px" }}>
        <Icon name="key" size={14} /> {t("studentImportLogin")}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
          <Icon name="download" size={14} /> {t("chooseFile")}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setText(template)}>{t("useTemplate")}</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv,.txt" onChange={onFile} style={{ display: "none" }} />
      </div>

      <div className="field"><label>{t("pasteOrEdit")}</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 140, fontFamily: "monospace", direction: "ltr" }}
          placeholder={template} /></div>

      {result && (
        <div className="micro-box small mb8" style={{ padding: "12px 14px" }}>
          ✅ {t("importedCount")}: <b>{result.created}</b> · {t("skipped")}: {result.skipped}
          {result.errors?.length > 0 && (
            <ul style={{ margin: "8px 0 0", paddingInlineStart: 18 }}>
              {result.errors.map((e, i) => <li key={i} className="small">{e}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t("close")}</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? t("loading") : t("import")}
        </button>
        {result && <button className="btn btn-accent" onClick={onDone}>{t("done")}</button>}
      </div>
    </Modal>
  );
}

function AccessModal({ user, cases, onClose, onDone }) {
  const { t, lang } = useApp();
  const toast = useToast();
  const [caseIds, setCaseIds] = useState(user.caseIds || []);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const toggleCase = (id) => setCaseIds((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const save = async () => {
    await api.put(`/assignments/${user.id}`, { caseIds, maxAttempts });
    toast(t("saved")); onDone();
  };
  return (
    <Modal title={`${t("manageAccess")} — ${lang === "fa" ? user.name_fa : user.name_en} (${user.student_no})`}
      onClose={onClose} onSave={save} saveLabel={t("saveAccess")}>
      <label className="small muted">{t("assignExams")}</label>
      <div className="small muted mb8">{t("assignExamsHint")}</div>
      {cases.map((c) => (
        <label key={c.id} className="toggle-row" style={{ cursor: "pointer" }}>
          <span>{biField(c, "title", lang)} <span className="badge-ver">v{c.version}</span></span>
          <input type="checkbox" checked={caseIds.includes(c.id)} onChange={() => toggleCase(c.id)} style={{ width: 18, height: 18 }} />
        </label>
      ))}
      <div className="field mt16"><label>{t("maxAttemptsField")}</label>
        <input type="number" min="1" value={maxAttempts} onChange={(e) => setMaxAttempts(+e.target.value || 1)} /></div>
    </Modal>
  );
}

function PasswordModal({ user, onClose }) {
  const { t, lang } = useApp();
  const toast = useToast();
  const [pw, setPw] = useState("");
  const save = async () => {
    if (!pw.trim()) return;
    await api.put(`/users/${user.id}/password`, { password: pw });
    toast(t("passwordReset")); onClose();
  };
  return (
    <Modal title={`${t("resetPassword")} — ${lang === "fa" ? user.name_fa : user.name_en}`} onClose={onClose} onSave={save}>
      <div className="field"><label>{t("newPassword")}</label>
        <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></div>
    </Modal>
  );
}

/* ---- Cases ---- */
function Cases() {
  const { t, lang } = useApp();
  const [cases, setCases] = useState(null);
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    api.get("/cases").then((d) => setCases(Array.isArray(d) ? d : [])).catch((e) => { setLoadErr(String(e.message || e)); setCases({ __err: true }); });
  };
  useEffect(() => { load(); }, []);
  if (cases?.__err || loadErr) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{loadErr || (lang === "fa" ? "بارگذاری کیس‌ها شکست خورد" : "Could not load cases")}</h3><button className="btn btn-ghost mt16" onClick={() => { setCases(null); load(); }}>{lang === "fa" ? "تلاش دوباره" : "Retry"}</button></div>;
  if (!cases) return <Spinner />;
  const del = async (id) => { if (confirm(t("confirmDelete"))) { await api.del(`/cases/${id}`); load(); } };
  const save = async (data, id) => {
    if (id) await api.put(`/cases/${id}`, data); else await api.post("/cases", data);
    setEditing(null); toast(t("saved")); load();
  };
  return (
    <div className="card">
      <div className="section-title"><h4>{t("cases")}</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <CsvTools kind="cases" onImported={load} />
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>+ {t("newCase")}</button>
        </div></div>
      <div className="small muted mb16"><Icon name="bookmark" size={16} /> {t("versionNote")}</div>
      <DataTable
        rows={cases}
        initialSort={{ key: "title", dir: "asc" }}
        searchKeys={[(c) => c.title_fa, (c) => c.title_en, (c) => c.specialty_fa, (c) => c.specialty_en]}
        rowKey={(c) => c.id}
        columns={[
          { key: "title", label: t("caseTitle"), sortValue: (c) => biField(c, "title", lang), render: (c) => <>{biField(c, "title", lang)} <span className="badge-ver">v{c.version}</span></> },
          { key: "specialty", label: t("specialty"), sortValue: (c) => biField(c, "specialty", lang), render: (c) => biField(c, "specialty", lang) },
          { key: "difficulty", label: t("difficulty"), sortValue: (c) => c.difficulty, render: (c) => <Pill kind={c.difficulty}>{t(c.difficulty)}</Pill> },
          { key: "actions", label: "", sortable: false, thStyle: { textAlign: "end" }, render: (c) => (
            <span style={{ display: "flex", gap: 4, justifyContent: "flex-end", whiteSpace: "nowrap" }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setEditing(c)}>{t("edit")}</button>
              <button className="btn btn-sm btn-danger" onClick={() => del(c.id)}>{t("delete")}</button>
            </span>) },
        ]}
      />
      {editing && <CaseModal caseObj={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

/* One orderable lab/imaging result row: name (bi-lingual) + search aliases +
   the result text the student sees when they order it, and an optional image. */
function ResultEditor({ r, i, ops, t, withImage }) {
  return (
    <div className="card mb8" style={{ background: "var(--panel2)", padding: 12 }}>
      <div className="grid grid-2">
        <div className="field"><label>{t("resultName")} (FA)</label>
          <input value={r.name_fa || ""} readOnly={!!(r.name_fa || r.name_en)} onChange={(e) => ops.setField(i, "name_fa", e.target.value)} /></div>
        <div className="field"><label>{t("resultName")} (EN)</label>
          <input value={r.name_en || ""} readOnly={!!(r.name_fa || r.name_en)} onChange={(e) => ops.setField(i, "name_en", e.target.value)} /></div>
      </div>
      <div className="field"><label>{t("resultAliases")} <span className="small muted">— {t("resultAliasesHint")}</span></label>
        <input value={(r.aliases || []).join(", ")} onChange={(e) => ops.setAliases(i, e.target.value)} placeholder="troponin, trop, تروپونین" /></div>
      <div className="grid grid-2">
        <div className="field"><label>{t("resultValue")} (FA)</label>
          <input value={r.result_fa || ""} onChange={(e) => ops.setField(i, "result_fa", e.target.value)} /></div>
        <div className="field"><label>{t("resultValue")} (EN)</label>
          <input value={r.result_en || ""} onChange={(e) => ops.setField(i, "result_en", e.target.value)} /></div>
      </div>
      {withImage && <ImageUpload value={r.imageUrl} onChange={(v) => ops.setField(i, "imageUrl", v)} label={t("resultImage")} />}
      <button type="button" className="btn btn-sm btn-danger" onClick={() => ops.del(i)}><Icon name="trash" size={13} /> {t("delete")}</button>
    </div>
  );
}

function CaseModal({ caseObj, onClose, onSave }) {
  const { t, lang } = useApp();
  const [f, setF] = useState({
    title_fa: "", title_en: "", age: "", sex: "male", difficulty: "medium", history_form: "internal",
    specialty_fa: "", specialty_en: "", chief_fa: "", chief_en: "", history_fa: "", history_en: "",
    pmh_fa: "", pmh_en: "", meds_fa: "", meds_en: "", allergies_fa: "", allergies_en: "",
    family_fa: "", family_en: "", social_fa: "", social_en: "", ros_fa: "", ros_en: "", exam_fa: "", exam_en: "",
    // Auscultation recordings (URLs) + the teacher's expected problem list
    // and expected differentials (used to score those boxes).
    lungSound: "", heartSound: "", problem_list_fa: "", problem_list_en: "", ddx_fa: "", ddx_en: "",
    diagnosis_fa: "", diagnosis_en: "", objectives_fa: "", objectives_en: "",
    vitals: { bp: "120/80", hr: "75", rr: "16", temp: "37", spo2: "98%" },
    images: [], labResults: [], imagingResults: [], paraclinicResults: [], checklist_id: 1, ...caseObj,
  });
  // load the editable OSCE checklists so the author can pick which rubric scores this case
  const [checklists, setChecklists] = useState([]);
  const [chkErr, setChkErr] = useState("");
  const [orderCat, setOrderCat] = useState({ labs: [], imaging: [] });
  const [catErr, setCatErr] = useState("");
  useEffect(() => {
    api.get("/checklists").then((d) => setChecklists(Array.isArray(d) ? d : [])).catch((e) => { setChkErr(String(e.message || e)); setChecklists([]); });
    api.get("/order-catalog").then((d) => setOrderCat(d && (d.labs || d.imaging) ? d : { labs: [], imaging: [] })).catch((e) => { setCatErr(String(e.message || e)); setOrderCat({ __err: true, labs: [], imaging: [] }); });
  }, []);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setVital = (k, v) => set("vitals", { ...(f.vitals || {}), [k]: v });
  // Medical images: array of { url, label_fa, label_en }
  const images = f.images || [];
  const addImage = () => set("images", [...images, { url: "", label_fa: "", label_en: "" }]);
  const setImage = (i, key, v) => set("images", images.map((im, j) => j === i ? { ...im, [key]: v } : im));
  const delImage = (i) => set("images", images.filter((_, j) => j !== i));
  // Structured orderable results: array of { name_fa, name_en, aliases[], result_fa, result_en, imageUrl? }
  const mkResultOps = (key) => {
    const list = f[key] || [];
    return {
      list,
      add: () => set(key, [...list, { name_fa: "", name_en: "", aliases: [], result_fa: "", result_en: "", imageUrl: "" }]),
      addFrom: (item) => {
        const name_fa = item?.fa || item?.name_fa || "";
        const name_en = item?.en || item?.name_en || "";
        if (!name_fa && !name_en) return;
        if (list.some((r) => (name_fa && r.name_fa === name_fa) || (name_en && r.name_en === name_en))) return;
        const aliases = [...new Set([...(item.aliases || []), name_fa, name_en].filter(Boolean))];
        set(key, [...list, { name_fa, name_en, aliases, result_fa: "", result_en: "", imageUrl: "" }]);
      },
      setField: (i, k, v) => set(key, list.map((r, j) => j === i ? { ...r, [k]: v } : r)),
      setAliases: (i, v) => set(key, list.map((r, j) => j === i ? { ...r, aliases: v.split(",").map((s) => s.trim()).filter(Boolean) } : r)),
      del: (i) => set(key, list.filter((_, j) => j !== i)),
    };
  };
  const labs = mkResultOps("labResults");
  const imgResults = mkResultOps("imagingResults");
  const paraResults = mkResultOps("paraclinicResults");

  const F = ({ k, label, area }) => area
    ? <div className="field"><label>{label}</label><textarea value={f[k] || ""} onChange={(e) => set(k, e.target.value)} /></div>
    : <div className="field"><label>{label}</label><input value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} /></div>;

  return (
    <Modal title={caseObj.id ? t("edit") : t("newCase")} onClose={onClose} onSave={() => onSave({ ...f, age: +f.age || 0 }, caseObj.id)}>
      <div className="grid grid-2">
        <F k="title_fa" label={`${t("caseTitle")} (FA)`} />
        <F k="title_en" label={`${t("caseTitle")} (EN)`} />
        <F k="age" label={t("age")} />
        <div className="field"><label>{t("sex")}</label>
          <select value={f.sex} onChange={(e) => set("sex", e.target.value)}>
            <option value="male">{t("male")}</option><option value="female">{t("female")}</option></select></div>
        <F k="specialty_fa" label={`${t("specialty")} (FA)`} />
        <F k="specialty_en" label={`${t("specialty")} (EN)`} />
        <div className="field"><label>{t("difficulty")}</label>
          <select value={f.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
            {["easy", "medium", "hard"].map((d) => <option key={d} value={d}>{t(d)}</option>)}</select></div>
        <div className="field"><label><Icon name="patient" size={14} /> {t("historyForm")}</label>
          <select value={f.history_form || "internal"} onChange={(e) => set("history_form", e.target.value)}>
            <option value="internal">{t("formInternal")}</option>
            <option value="obgyn">{t("formObgyn")}</option>
            <option value="cardio">{t("formCardio")}</option>
            <option value="peds">{t("formPeds")}</option>
            <option value="psych">{t("formPsych")}</option>
          </select>
          <div className="small muted mt4">{t("historyFormHint")}</div>
        </div>
        <div className="field"><label><Icon name="check" size={14} /> {lang === "fa" ? "چک‌لیست ارزیابی (OSCE)" : "Assessment checklist (OSCE)"}</label>
          {chkErr && <div className="err-banner mb8">{chkErr}</div>}
          <select value={f.checklist_id} onChange={(e) => set("checklist_id", +e.target.value)}>
            {checklists.map((c) => <option key={c.id} value={c.id}>{lang === "fa" ? c.name_fa : c.name_en}</option>)}
          </select>
          <div className="small muted mt4">{lang === "fa" ? "این چک‌لیست معیارِ نمره‌دهیِ این کیس است." : "This checklist is the scoring rubric for this case."}</div>
        </div>
      </div>
      <F k="chief_fa" label={`${t("chief")} (FA)`} /><F k="chief_en" label={`${t("chief")} (EN)`} />
      <F k="history_fa" label={`${t("history")} (FA)`} area /><F k="history_en" label={`${t("history")} (EN)`} area />

      {/* Full patient history fields (the patient AI answers from these) */}
      <div className="divider" />
      <div className="small muted mb8"><Icon name="patient" size={15} /> {t("caseFullHistory")}</div>
      <div className="grid grid-2">
        <F k="pmh_fa" label={`${t("pmh")} (FA)`} /><F k="pmh_en" label={`${t("pmh")} (EN)`} />
        <F k="meds_fa" label={`${t("meds")} (FA)`} /><F k="meds_en" label={`${t("meds")} (EN)`} />
        <F k="allergies_fa" label={`${t("allergies")} (FA)`} /><F k="allergies_en" label={`${t("allergies")} (EN)`} />
        <F k="family_fa" label={`${t("familyHx")} (FA)`} /><F k="family_en" label={`${t("familyHx")} (EN)`} />
      </div>
      <F k="social_fa" label={`${t("socialHx")} (FA)`} area /><F k="social_en" label={`${t("socialHx")} (EN)`} area />
      <F k="ros_fa" label={`${t("rosHx")} (FA)`} area /><F k="ros_en" label={`${t("rosHx")} (EN)`} area />
      <F k="exam_fa" label={`${t("physicalExam")} (FA)`} area /><F k="exam_en" label={`${t("physicalExam")} (EN)`} area />
      <div className="small muted mt4">
        {lang === "fa"
          ? "وقتی دانشجو در چت معاینه بیمار را بخواهد، هوش مصنوعی در نقش استاد بر اساس همین یافته‌ها و علائم حیاتی پاسخ می‌دهد."
          : "When the student asks in chat for the examination, the AI answers as the supervising teacher using exactly these findings and vital signs."}
      </div>

      {/* Auscultation recordings — lung & heart sounds the student can play in chat */}
      <div className="divider" />
      <div className="section-title"><label className="small muted"><Icon name="volume" size={16} /> {t("auscultationSounds")}</label></div>
      <div className="small muted mb8">{t("auscultationSoundsHint")}</div>
      <AudioUpload value={f.lungSound || ""} onChange={(v) => set("lungSound", v)} label={t("lungSound")} />
      <AudioUpload value={f.heartSound || ""} onChange={(v) => set("heartSound", v)} label={t("heartSound")} />

      {/* Expected problem list + expected differentials (used to score the
          student's problem list & ddx boxes — both are extern-criterion items) */}
      <div className="divider" />
      <F k="problem_list_fa" label={`${t("expectedProblemList")} (FA)`} area />
      <F k="problem_list_en" label={`${t("expectedProblemList")} (EN)`} area />
      <div className="small muted mb8">{t("expectedProblemListHint")}</div>
      <F k="ddx_fa" label={`${t("expectedDdx")} (FA)`} area />
      <F k="ddx_en" label={`${t("expectedDdx")} (EN)`} area />
      <div className="small muted mb8">{t("expectedDdxHint")}</div>

      {/* Vital signs */}
      <div className="small muted mb8 mt8"><Icon name="activity" size={15} /> {t("vitals")}</div>
      <div className="grid grid-2">
        {[["bp", "BP"], ["hr", "HR"], ["rr", "RR"], ["temp", "Temp"], ["spo2", "SpO₂"]].map(([k, lbl]) => (
          <div className="field" key={k}><label>{lbl}</label>
            <input value={(f.vitals || {})[k] || ""} onChange={(e) => setVital(k, e.target.value)} /></div>
        ))}
      </div>

      <F k="diagnosis_fa" label={`${t("diagnosis")} (FA)`} /><F k="diagnosis_en" label={`${t("diagnosis")} (EN)`} />
      <F k="objectives_fa" label={`${t("objectives")} (FA)`} area /><F k="objectives_en" label={`${t("objectives")} (EN)`} area />

      {/* Orderable LAB results — pick from the shared catalog, then fill the result */}
      <div className="divider" />
      <div className="section-title"><label className="small muted"><Icon name="flask" size={16} /> {t("labResultsTitle")}</label></div>
      {catErr && <div className="err-banner mb8">{catErr}</div>}
      <div className="small muted mb8">{t("labResultsHint")}</div>
      <div className="field"><label>{t("pickFromCatalog")}</label>
        <OrderSearch catalog={orderCat.labs} lang={lang} onAdd={labs.addFrom} allowCustom={false} /></div>
      {labs.list.map((r, i) => <ResultEditor key={i} r={r} i={i} ops={labs} t={t} withImage={false} />)}
      {!labs.list.length && <div className="small muted">{t("noneYet")}</div>}

      {/* Orderable PARACLINICAL results (ECG, PFT, EEG…) — with optional image */}
      <div className="divider" />
      <div className="section-title"><label className="small muted"><Icon name="flask" size={16} /> {t("paraclinicResultsTitle")}</label></div>
      <div className="small muted mb8">{t("paraclinicResultsHint")}</div>
      <div className="field"><label>{t("pickFromCatalog")}</label>
        <OrderSearch catalog={orderCat.paraclinic || []} lang={lang} onAdd={paraResults.addFrom} allowCustom={false} /></div>
      {paraResults.list.map((r, i) => <ResultEditor key={i} r={r} i={i} ops={paraResults} t={t} withImage={true} />)}
      {!paraResults.list.length && <div className="small muted">{t("noneYet")}</div>}

      {/* Orderable IMAGING results */}
      <div className="divider" />
      <div className="section-title"><label className="small muted"><Icon name="xray" size={16} /> {t("imagingResultsTitle")}</label></div>
      <div className="small muted mb8">{t("imagingResultsHint")}</div>
      <div className="field"><label>{t("pickFromCatalog")}</label>
        <OrderSearch catalog={orderCat.imaging} lang={lang} onAdd={imgResults.addFrom} allowCustom={false} /></div>
      {imgResults.list.map((r, i) => <ResultEditor key={i} r={r} i={i} ops={imgResults} t={t} withImage={true} />)}
      {!imgResults.list.length && <div className="small muted">{t("noneYet")}</div>}

      <div className="divider" />
      <div className="section-title"><label className="small muted"><Icon name="xray" size={16} /> {t("medicalImages")}</label>
        <button type="button" className="btn btn-sm btn-primary" onClick={addImage}>+ {t("addImage")}</button></div>
      {images.map((im, i) => (
        <div key={i} className="card mb8" style={{ background: "var(--panel2)", padding: 12 }}>
          <ImageUpload value={im.url} onChange={(v) => setImage(i, "url", v)} />
          <div className="grid grid-2">
            <div className="field"><label>{t("imgLabel")} (FA)</label>
              <input value={im.label_fa} onChange={(e) => setImage(i, "label_fa", e.target.value)} /></div>
            <div className="field"><label>{t("imgLabel")} (EN)</label>
              <input value={im.label_en} onChange={(e) => setImage(i, "label_en", e.target.value)} /></div>
          </div>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => delImage(i)}>{t("removeImage")}</button>
        </div>
      ))}
      {!images.length && <div className="small muted">{t("noImages")}</div>}
    </Modal>
  );
}

/* ---- Flashcards (multiple choice editor) ---- */
const FLASH_TYPES = [
  { id: "mcq", ico: "check", fa: "چهارگزینه‌ای", en: "4-option MCQ", hintFa: "الف ب ج د", hintEn: "A B C D" },
  { id: "kf", ico: "brain", fa: "کی‌اف (KF)", en: "Key Feature", hintFa: "شرح‌حال + چند سؤال", hintEn: "Vignette + items" },
  { id: "truefalse", ico: "circleCheck", fa: "درست / نادرست", en: "True / False", hintFa: "", hintEn: "" },
  { id: "fill", ico: "edit", fa: "جای‌خالی", en: "Fill blank", hintFa: "", hintEn: "" },
  { id: "match", ico: "puzzle", fa: "پازل تطبیق", en: "Match puzzle", hintFa: "", hintEn: "" },
  { id: "compare", ico: "puzzle", fa: "مقایسه دو موجودیت", en: "Compare two entities", hintFa: "A / B / هر دو", hintEn: "A / B / both" },
  { id: "puzzle", ico: "target", fa: "پازل نام‌گذاری تصویر", en: "Image-label puzzle", hintFa: "پین روی بافت/آناتومی", hintEn: "Pins on histology/anatomy" },
  { id: "order", ico: "list", fa: "مرتب‌سازی", en: "Order", hintFa: "", hintEn: "" },
  { id: "hotspot", ico: "target", fa: "کلیک روی تصویر", en: "Hotspot", hintFa: "محدوده روی بافت/رادیولوژی", hintEn: "Region on histology/CXR" },
  { id: "drawing", ico: "image", fa: "نقاشی / رسم بافت", en: "Drawing", hintFa: "تأیید استاد", hintEn: "Teacher approval" },
  { id: "stepwise", ico: "book", fa: "مرحله‌به‌مرحله", en: "Stepwise", hintFa: "", hintEn: "" },
];
function flashTypeLabel(type, lang) {
  const row = FLASH_TYPES.find((x) => x.id === (type || "mcq"));
  if (!row) return type || "mcq";
  return lang === "fa" ? row.fa : row.en;
}

function Flashcards() {
  const { t, lang } = useApp();
  const [cards, setCards] = useState(null);
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    api.get("/flashcards").then((d) => setCards(Array.isArray(d) ? d : [])).catch((e) => { setLoadErr(String(e.message || e)); setCards({ __err: true }); });
  };
  useEffect(() => { load(); }, []);
  if (cards?.__err || loadErr) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{loadErr || (lang === "fa" ? "بارگذاری فلش‌کارت‌ها شکست خورد" : "Could not load flashcards")}</h3><button className="btn btn-ghost mt16" onClick={() => { setCards(null); load(); }}>{lang === "fa" ? "تلاش دوباره" : "Retry"}</button></div>;
  if (!cards) return <Spinner />;
  const del = async (id) => { if (confirm(t("confirmDelete"))) { await api.del(`/flashcards/${id}`); load(); } };
  const save = async (data, id) => {
    if (id) await api.put(`/flashcards/${id}`, data); else await api.post("/flashcards", data);
    setEditing(null); toast(t("saved")); load();
  };
  return (
    <div className="card">
      <div className="section-title"><h4>{t("flashcards")}</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <CsvTools kind="flashcards" onImported={load} />
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>+ {t("newFlashcard")}</button>
        </div></div>
      <div className="small muted mb16"><Icon name="bookmark" size={16} /> {t("versionNote")}</div>
      <DataTable
        rows={cards}
        initialSort={{ key: "title", dir: "asc" }}
        searchKeys={[(c) => c.title_fa, (c) => c.title_en]}
        rowKey={(c) => c.id}
        columns={[
          { key: "title", label: t("title"), sortValue: (c) => biField(c, "title", lang), render: (c) => <>{biField(c, "title", lang)} <span className="badge-ver">v{c.version}</span></> },
          { key: "type", label: lang === "fa" ? "نوع" : "Type", sortValue: (c) => flashTypeLabel(c.type, lang), render: (c) => <span className="tag">{flashTypeLabel(c.type, lang)}</span> },
          { key: "options", label: t("options"), sortValue: (c) => (c.options || []).length, render: (c) => (c.options || []).length },
          { key: "hints", label: t("hints"), sortValue: (c) => ((lang === "fa" ? c.hints_fa : c.hints_en) || []).length, render: (c) => ((lang === "fa" ? c.hints_fa : c.hints_en) || []).length },
          { key: "actions", label: "", sortable: false, thStyle: { textAlign: "end" }, render: (c) => (
            <span style={{ display: "flex", gap: 4, justifyContent: "flex-end", whiteSpace: "nowrap" }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setEditing(c)}>{t("edit")}</button>
              <button className="btn btn-sm btn-danger" onClick={() => del(c.id)}>{t("delete")}</button>
            </span>) },
        ]}
      />
      {editing && <CardModal card={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

/* Teacher-authored expected zones on a drawing task. Drag rectangles over
   the reference image (or blank canvas); the server measures student ink
   coverage/IoU against them as an ADVISORY score only. Coordinates are
   normalized 0..100 so they match any rendered canvas size. */
function DrawingZoneEditor({ drawing, onChange, lang }) {
  const fa = lang === "fa";
  const zones = Array.isArray(drawing?.zones) ? drawing.zones : [];
  const ratio = ({ "16:9": 9 / 16, "4:3": 3 / 4, "1:1": 1, "3:4": 4 / 3 }[drawing?.aspect] || 0.62);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const [, force] = useState(0);
  const norm = (e) => {
    const r = stageRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };
  const down = (e) => {
    e.preventDefault();
    const p = norm(e);
    dragRef.current = { x: p.x, y: p.y, w: 0, h: 0, label: String(zones.length + 1), _start: { x: p.x, y: p.y } };
    force((n) => n + 1);
  };
  const move = (e) => {
    const z = dragRef.current;
    if (!z) return;
    const p = norm(e);
    z.x = Math.min(z._start.x, p.x); z.y = Math.min(z._start.y, p.y);
    z.w = Math.abs(p.x - z._start.x); z.h = Math.abs(p.y - z._start.y);
    force((n) => n + 1);
  };
  const up = () => {
    const z = dragRef.current; dragRef.current = null;
    if (z && z.w >= 3 && z.h >= 3) {
      const next = [...zones, { x: Math.round(z.x * 10) / 10, y: Math.round(z.y * 10) / 10, w: Math.round(z.w * 10) / 10, h: Math.round(z.h * 10) / 10, label: z.label }];
      onChange(next);
    } else force((n) => n + 1);
  };
  const setLabel = (i, v) => onChange(zones.map((z, j) => j === i ? { ...z, label: v } : z));
  const remove = (i) => onChange(zones.filter((_, j) => j !== i));
  const preview = dragRef.current ? [...zones, dragRef.current] : zones;
  return <div className="micro-box mt8" style={{ padding: 10 }}>
    <div className="small muted mb8">{fa ? "نواحی مورد انتظار برای پیشنهاد خودکار امتیاز (پوشش/IoU): روی تصویر بکشید تا مستطیل اضافه شود. عدد هر ناحیه با شمارهٔ برچسب دانشجو مطابقت دارد. این عدد فقط پیشنهاد است و استاد تصمیم نهایی را می‌گیرد." : "Expected zones for the advisory coverage/IoU score: drag rectangles on the image. Zone numbers match the student's label numbers. Suggested only — you always decide."}</div>
    <div ref={stageRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
      style={{ position: "relative", width: "100%", aspectRatio: `1 / ${ratio}`, marginBottom: 8,
        background: drawing?.referenceImageUrl ? `center/cover no-repeat url(${drawing.referenceImageUrl})` : (drawing?.background === "dark" ? "#111827" : "#f6f1e7"),
        border: "2px dashed var(--primary)", borderRadius: 8, touchAction: "none", cursor: "crosshair", overflow: "hidden" }}>
      {preview.map((z, i) => <div key={i} style={{ position: "absolute", left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%`, border: "2px solid #2563eb", background: "rgba(37,99,235,.15)" }}><b style={{ position: "absolute", top: 0, insetInlineStart: 2, color: "#1d4ed8", background: "rgba(255,255,255,.85)", borderRadius: 4, padding: "0 4px", fontSize: 12 }}>{z.label || i + 1}</b></div>)}
    </div>
    {zones.length === 0 && <div className="small muted">{fa ? "هنوز ناحیه‌ای تعریف نشده؛ بدون ناحیه فقط معیار تلاش (تعداد خط/پوشش) پیشنهاد می‌شود." : "No zones yet; without them only an effort estimate is suggested."}</div>}
    {zones.map((z, i) => <div className="inline-form mt8" key={i} style={{ alignItems: "center" }}>
      <span className="tag">#{i + 1}</span>
      <input style={{ maxWidth: 120 }} value={z.label || ""} onChange={(e) => setLabel(i, e.target.value)} placeholder={fa ? "شماره برچسب" : "Label #"} />
      <span className="small muted">{Math.round(z.w)}٪ × {Math.round(z.h)}٪</span>
      <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(i)}>✕</button>
    </div>)}
  </div>;
}

function CardModal({ card, onClose, onSave }) {
  const { t, lang } = useApp();
  const [f, setF] = useState({
    title_fa: "", title_en: "", questionText_fa: "", questionText_en: "",
    q_fa: "", q_en: "",
    imageUrl: "", category_fa: "", category_en: "", difficulty: "medium",
    questionType: "image", answerMode: "choice", color: "#bcd7f0",
    type: "mcq",
    hotspot: { x: 50, y: 50, r: 10, label_fa: "", label_en: "", confirm: true, shape: "circle", regions: [{ shape: "circle", x: 50, y: 50, r: 10 }] },
    drawing: { prompt_fa: "", prompt_en: "", referenceImageUrl: "", rubric_fa: [""], rubric_en: [""], aspect: "16:9", background: "white", traceReference: true, gridDefault: false, minStrokes: 1 },
    kf: { vignette_fa: "", vignette_en: "", items: [
      { kind: "short", prompt_fa: "", prompt_en: "", answer_fa: "", answer_en: "", accept_fa: "", accept_en: "", options_fa: ["", "", "", ""], options_en: ["", "", "", ""], correct: 0 },
      { kind: "short", prompt_fa: "", prompt_en: "", answer_fa: "", answer_en: "", accept_fa: "", accept_en: "", options_fa: ["", "", "", ""], options_en: ["", "", "", ""], correct: 0 },
    ] },
    puzzle: { imageUrl: "", pins: [{ x: 30, y: 35, label_fa: "", label_en: "" }, { x: 65, y: 55, label_fa: "", label_en: "" }], distractors_fa: [""], distractors_en: [""] },
    steps: [{ answerType: "autocomplete", prompt_fa: "", prompt_en: "", answer_fa: "", answer_en: "", accept_fa: "", accept_en: "", options_fa: [], options_en: [], hint_fa: "", hint_en: "", explanation_fa: "", explanation_en: "" }],
    answer: true,                                    // truefalse
    blank_fa: "", blank_en: "", accept_fa: [], accept_en: [], // fill
    pairs: [["", "", "", ""], ["", "", "", ""]],     // match: [left_fa,left_en,right_fa,right_en]
    entityA_fa: "", entityA_en: "", entityB_fa: "", entityB_en: "",
    features: [{ fa: "", en: "", belongs: "A" }, { fa: "", en: "", belongs: "B" }],
    items_fa: ["", ""], items_en: ["", ""],          // order
    options: [{ fa: "", en: "", correct: true }, { fa: "", en: "", correct: false },
              { fa: "", en: "", correct: false }, { fa: "", en: "", correct: false }],
    hints_fa: [], hints_en: [], hint_images_fa: [], hint_images_en: [],
    // AMBOSS-style teaching aids
    attending_fa: "", attending_en: "", highlights_fa: [], highlights_en: [],
    // QB-style micro fields
    micro_lead_fa: "", micro_lead_en: "", micro_golden_fa: "", micro_golden_en: "",
    micro_source_fa: "", micro_source_en: "",
    ...card,
    // pre-fill micro fields from an existing card's stored micro object
    ...(card.micro ? {
      micro_lead_fa: card.micro.lead_fa || "", micro_lead_en: card.micro.lead_en || "",
      micro_golden_fa: card.micro.golden_fa || "", micro_golden_en: card.micro.golden_en || "",
      micro_source_fa: card.micro.source_fa || "", micro_source_en: card.micro.source_en || "",
    } : {}),
  });
  const [subject, setSubject] = useState(card.subject || "");
  const [customCats, setCustomCats] = useState([]);
  useEffect(() => { api.get("/catalogs").then(setCustomCats).catch(() => setCustomCats([])); }, []);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setHotspot = (k, v) => setF((s) => ({ ...s, hotspot: { ...(s.hotspot || { x: 50, y: 50, r: 8 }), [k]: v } }));
  const setDrawing = (k, v) => setF((s) => ({ ...s, drawing: { ...(s.drawing || {}), [k]: v } }));
  const setRubric = (langKey, i, v) => setF((s) => { const d = { ...(s.drawing || {}) }; const a = Array.isArray(d[langKey]) ? [...d[langKey]] : []; a[i] = v; d[langKey] = a; return { ...s, drawing: d }; });
  const addRubric = () => setF((s) => ({ ...s, drawing: { ...(s.drawing || {}), rubric_fa: [...((s.drawing||{}).rubric_fa || []), ""], rubric_en: [...((s.drawing||{}).rubric_en || []), ""] } }));
  const delRubric = (i) => setF((s) => ({ ...s, drawing: { ...(s.drawing || {}), rubric_fa: ((s.drawing||{}).rubric_fa || []).filter((_,j)=>j!==i), rubric_en: ((s.drawing||{}).rubric_en || []).filter((_,j)=>j!==i) } }));
  const setStep = (i, k, v) => setF((s) => ({ ...s, steps: (s.steps || []).map((st,j)=>j===i?{...st,[k]:v}:st) }));
  const addStep = () => setF((s) => ({ ...s, steps: [...(s.steps || []), { answerType: "autocomplete", prompt_fa: "", prompt_en: "", answer_fa: "", answer_en: "", accept_fa: "", accept_en: "", options_fa: [], options_en: [], hint_fa: "", hint_en: "", explanation_fa: "", explanation_en: "" }] }));
  const delStep = (i) => setF((s) => ({ ...s, steps: (s.steps || []).filter((_,j)=>j!==i) }));
  const setOpt = (i, key, v) => setF((s) => ({ ...s, options: s.options.map((o, j) => j === i ? { ...o, [key]: v } : o) }));
  const setCorrect = (i) => setF((s) => ({ ...s, options: s.options.map((o, j) => ({ ...o, correct: j === i })) }));
  const addOpt = () => setF((s) => ({ ...s, options: [...s.options, { fa: "", en: "", correct: false }] }));
  const delOpt = (i) => setF((s) => {
    const options = s.options.filter((_, j) => j !== i);
    if (!options.some((o) => o.correct) && options[0]) options[0].correct = true;
    return { ...s, options };
  });
  // match-pair helpers
  const setPair = (i, k, v) => setF((s) => ({ ...s, pairs: s.pairs.map((p, j) => j === i ? p.map((x, m) => m === k ? v : x) : p) }));
  const addPair = () => setF((s) => ({ ...s, pairs: [...s.pairs, ["", "", "", ""]] }));
  const delPair = (i) => setF((s) => ({ ...s, pairs: s.pairs.filter((_, j) => j !== i) }));
  const setFeature = (i, k, v) => setF((s) => ({ ...s, features: (s.features || []).map((row, j) => j === i ? { ...row, [k]: v } : row) }));
  const addFeature = () => setF((s) => ({ ...s, features: [...(s.features || []), { fa: "", en: "", belongs: "A" }] }));
  const delFeature = (i) => setF((s) => ({ ...s, features: (s.features || []).filter((_, j) => j !== i) }));
  // order-item helpers
  const setItem = (i, langKey, v) => setF((s) => ({ ...s, [langKey]: s[langKey].map((x, j) => j === i ? v : x) }));
  const addItem = () => setF((s) => ({ ...s, items_fa: [...s.items_fa, ""], items_en: [...s.items_en, ""] }));
  const delItem = (i) => setF((s) => ({ ...s, items_fa: s.items_fa.filter((_, j) => j !== i), items_en: s.items_en.filter((_, j) => j !== i) }));
  const setHintImage = (key, i, v) => setF((s) => {
    const arr = Array.isArray(s[key]) ? [...s[key]] : [];
    arr[i] = v;
    return { ...s, [key]: arr };
  });
  const addHintLine = (textKey, imgKey) => setF((s) => ({
    ...s,
    [textKey]: [...(Array.isArray(s[textKey]) ? s[textKey] : []), ""],
    [imgKey]: [...(Array.isArray(s[imgKey]) ? s[imgKey] : []), ""],
  }));
  const emptyKfItem = () => ({ kind: "short", prompt_fa: "", prompt_en: "", answer_fa: "", answer_en: "", accept_fa: "", accept_en: "", options_fa: ["", "", "", ""], options_en: ["", "", "", ""], correct: 0 });
  const emptyPuzzle = () => ({ imageUrl: "", pins: [{ x: 30, y: 35, label_fa: "", label_en: "" }, { x: 65, y: 55, label_fa: "", label_en: "" }], distractors_fa: [""], distractors_en: [""] });
  const pickType = (type) => setF((s) => {
    const next = { ...s, type };
    if (type === "kf" && !(s.kf?.items?.length)) next.kf = { vignette_fa: "", vignette_en: "", items: [emptyKfItem(), emptyKfItem()] };
    if (type === "puzzle") {
      const p = s.puzzle || {};
      next.puzzle = Array.isArray(p.pins) && p.pins.length ? p : { ...emptyPuzzle(), imageUrl: p.imageUrl || s.imageUrl || "" };
    }
    if (type === "compare" && !(Array.isArray(s.features) && s.features.length)) {
      next.features = [{ fa: "", en: "", belongs: "A" }, { fa: "", en: "", belongs: "B" }];
    }
    return next;
  });
  const setPuzzle = (k, v) => setF((s) => ({ ...s, puzzle: { ...(s.puzzle || emptyPuzzle()), [k]: v } }));
  const setPin = (i, k, v) => setF((s) => {
    const pins = [...((s.puzzle || {}).pins || [])];
    pins[i] = { ...(pins[i] || { x: 50, y: 50, label_fa: "", label_en: "" }), [k]: v };
    return { ...s, puzzle: { ...(s.puzzle || {}), pins } };
  });
  const addPin = (xy) => setF((s) => ({ ...s, puzzle: { ...(s.puzzle || emptyPuzzle()), pins: [...((s.puzzle || {}).pins || []), { x: xy?.x ?? 50, y: xy?.y ?? 50, label_fa: "", label_en: "" }] } }));
  const delPin = (i) => setF((s) => ({ ...s, puzzle: { ...(s.puzzle || {}), pins: ((s.puzzle || {}).pins || []).filter((_, j) => j !== i) } }));
  const setKf = (k, v) => setF((s) => ({ ...s, kf: { ...(s.kf || {}), [k]: v } }));
  const setKfItem = (i, k, v) => setF((s) => {
    const items = [...((s.kf || {}).items || [])];
    items[i] = { ...(items[i] || emptyKfItem()), [k]: v };
    return { ...s, kf: { ...(s.kf || {}), items } };
  });
  const setKfOpt = (i, key, j, v) => setF((s) => {
    const items = [...((s.kf || {}).items || [])];
    const it = { ...(items[i] || emptyKfItem()) };
    const arr = Array.isArray(it[key]) ? [...it[key]] : ["", "", "", ""];
    arr[j] = v;
    it[key] = arr;
    items[i] = it;
    return { ...s, kf: { ...(s.kf || {}), items } };
  });
  const addKfItem = () => setF((s) => ({ ...s, kf: { ...(s.kf || {}), items: [...((s.kf || {}).items || []), emptyKfItem()] } }));
  const delKfItem = (i) => setF((s) => ({ ...s, kf: { ...(s.kf || {}), items: ((s.kf || {}).items || []).filter((_, j) => j !== i) } }));

  // build the payload with the right type-specific fields + micro
  const buildPayload = () => {
    const base = {
      ...f,
      q_fa: f.q_fa || f.questionText_fa || f.title_fa,
      q_en: f.q_en || f.questionText_en || f.title_en,
      hints_fa: Array.isArray(f.hints_fa) ? f.hints_fa : String(f.hints_fa).split("\n").filter(Boolean),
      hints_en: Array.isArray(f.hints_en) ? f.hints_en : String(f.hints_en).split("\n").filter(Boolean),
      hint_images_fa: Array.isArray(f.hint_images_fa) ? f.hint_images_fa : [],
      hint_images_en: Array.isArray(f.hint_images_en) ? f.hint_images_en : [],
      // AMBOSS-style key clues — clean, drop empty lines
      highlights_fa: (Array.isArray(f.highlights_fa) ? f.highlights_fa : String(f.highlights_fa || "").split("\n")).map((x) => x.trim()).filter(Boolean),
      highlights_en: (Array.isArray(f.highlights_en) ? f.highlights_en : String(f.highlights_en || "").split("\n")).map((x) => x.trim()).filter(Boolean),
      micro: {
        lead_fa: f.micro_lead_fa, lead_en: f.micro_lead_en,
        golden_fa: f.micro_golden_fa, golden_en: f.micro_golden_en,
        points_fa: [], points_en: [], options_fa: [], options_en: [],
        source_fa: f.micro_source_fa, source_en: f.micro_source_en,
      },
    };
    if (f.type === "fill") {
      base.accept_fa = String(f.accept_fa || "").split(",").map((x) => x.trim()).filter(Boolean);
      base.accept_en = String(f.accept_en || "").split(",").map((x) => x.trim()).filter(Boolean);
    }
    if (f.type === "match") base.pairs = f.pairs.filter((p) => p[0] || p[2]);
    if (f.type === "compare") {
      const belongsOf = (v) => (v === "B" || v === "both" ? v : "A");
      base.entityA_fa = f.entityA_fa || "";
      base.entityA_en = f.entityA_en || "";
      base.entityB_fa = f.entityB_fa || "";
      base.entityB_en = f.entityB_en || "";
      base.features = (Array.isArray(f.features) ? f.features : [])
        .filter((row) => row && (row.fa || row.en))
        .map((row) => ({ fa: row.fa || row.en || "", en: row.en || row.fa || "", belongs: belongsOf(row.belongs) }));
    }
    if (f.type === "order") {
      base.items_fa = f.items_fa.filter(Boolean);
      base.items_en = f.items_en.filter((_, i) => f.items_fa[i]);
    }
    if (f.type === "drawing") {
      const d = f.drawing || {};
      base.drawing = {
        ...d,
        rubric_fa: (d.rubric_fa || []).map((x) => String(x).trim()).filter(Boolean),
        rubric_en: (d.rubric_en || []).filter((_, i) => ((d.rubric_fa || [])[i] || (d.rubric_en || [])[i])),
        aspect: ["16:9", "4:3", "1:1", "3:4"].includes(d.aspect) ? d.aspect : "16:9",
        background: ["white", "cream", "dark"].includes(d.background) ? d.background : "white",
        traceReference: d.traceReference !== false,
        // Score assist defaults ON; a teacher who wants canvas + manual
        // review only sets this false per card (global admin flag also gates it).
        assistEnabled: d.assistEnabled !== false,
        gridDefault: !!d.gridDefault,
        minStrokes: Math.max(1, Number(d.minStrokes) || 1),
        zones: Array.isArray(d.zones) ? d.zones.slice(0, 30).map((z) => ({
          x: Math.max(0, Math.min(100, Number(z.x) || 0)),
          y: Math.max(0, Math.min(100, Number(z.y) || 0)),
          w: Math.max(0, Math.min(100, Number(z.w) || 0)),
          h: Math.max(0, Math.min(100, Number(z.h) || 0)),
          label: String(z.label ?? "").slice(0, 6),
        })).filter((z) => z.w > 1 && z.h > 1) : [],
      };
    }
    if (f.type === "stepwise") {
      base.steps = (f.steps || []).filter((st) => st.prompt_fa || st.prompt_en).map((st) => ({
        ...st,
        accept_fa: Array.isArray(st.accept_fa) ? st.accept_fa : String(st.accept_fa || st.answer_fa || "").split(",").map((x)=>x.trim()).filter(Boolean),
        accept_en: Array.isArray(st.accept_en) ? st.accept_en : String(st.accept_en || st.answer_en || "").split(",").map((x)=>x.trim()).filter(Boolean),
        options_fa: Array.isArray(st.options_fa) ? st.options_fa : String(st.options_fa || "").split(/[\n,]/).map((x)=>x.trim()).filter(Boolean),
        options_en: Array.isArray(st.options_en) ? st.options_en : String(st.options_en || "").split(/[\n,]/).map((x)=>x.trim()).filter(Boolean),
      }));
    }
    if (f.type === "kf") {
      base.kf = {
        vignette_fa: (f.kf || {}).vignette_fa || "",
        vignette_en: (f.kf || {}).vignette_en || "",
        items: ((f.kf || {}).items || []).filter((it) => it.prompt_fa || it.prompt_en).map((it) => ({
          kind: it.kind === "mcq" ? "mcq" : "short",
          prompt_fa: it.prompt_fa || "", prompt_en: it.prompt_en || "",
          answer_fa: it.answer_fa || "", answer_en: it.answer_en || "",
          accept_fa: Array.isArray(it.accept_fa) ? it.accept_fa : String(it.accept_fa || "").split(",").map((x) => x.trim()).filter(Boolean),
          accept_en: Array.isArray(it.accept_en) ? it.accept_en : String(it.accept_en || "").split(",").map((x) => x.trim()).filter(Boolean),
          options_fa: Array.isArray(it.options_fa) ? it.options_fa : [],
          options_en: Array.isArray(it.options_en) ? it.options_en : [],
          correct: Number(it.correct || 0) || 0,
        })),
      };
    }
    if (f.type === "puzzle") {
      const p = f.puzzle || {};
      const pins = (Array.isArray(p.pins) ? p.pins : []).filter((pin) => pin.label_fa || pin.label_en).map((pin) => ({
        x: Math.max(0, Math.min(100, Number(pin.x) || 50)),
        y: Math.max(0, Math.min(100, Number(pin.y) || 50)),
        label_fa: pin.label_fa || pin.label_en || "",
        label_en: pin.label_en || pin.label_fa || "",
      }));
      const splitLines = (v) => (Array.isArray(v) ? v : String(v || "").split(/[\n,]/)).map((s) => String(s).trim()).filter(Boolean);
      base.puzzle = {
        imageUrl: p.imageUrl || f.imageUrl || "",
        pins,
        distractors_fa: splitLines(p.distractors_fa),
        distractors_en: splitLines(p.distractors_en),
      };
      if (base.puzzle.imageUrl && !base.imageUrl) base.imageUrl = base.puzzle.imageUrl;
    }
    if (f.type === "hotspot") {
      const h = f.hotspot || {};
      const regions = (Array.isArray(h.regions) && h.regions.length ? h.regions : [h]).filter((r) => r && typeof r === "object");
      const first = regions[0] || { shape: "circle", x: 50, y: 50, r: 10 };
      base.hotspot = {
        label_fa: h.label_fa || "",
        label_en: h.label_en || "",
        confirm: h.confirm !== false,
        shape: first.shape || "circle",
        x: first.x, y: first.y, r: first.r, w: first.w, h: first.h, points: first.points,
        regions,
      };
    }
    return base;
  };

  // resolve a subject key to its item list (built-in SUBJECTS or a custom "cat:ID")
  const resolveList = (key) => {
    if (key && SUBJECTS[key]) return SUBJECTS[key].list;
    if (key && key.startsWith("cat:")) {
      const c = customCats.find((x) => String(x.id) === key.slice(4));
      return c ? c.items : null;
    }
    return null;
  };

  // When a subject is picked, auto-fill the full option catalog (teacher only marks the correct one).
  const pickSubject = (key) => {
    setSubject(key);
    const list = resolveList(key);
    if (list) {
      setF((s) => ({ ...s, subject: key, options: list.map((o) => ({ ...o, correct: false })), answerMode: "search" }));
    } else {
      setF((s) => ({ ...s, subject: "" }));
    }
  };

  const correctIdx = f.options.findIndex((o) => o.correct);

  return (
    <Modal title={card.id ? t("edit") : t("newFlashcard")} onClose={onClose}
      onSave={() => onSave(buildPayload(), card.id)}>
      <div className="field">
        <label><Icon name="puzzle" size={16} /> {t("questionTypeLabel")}</label>
        <div className="qtype-grid">
          {FLASH_TYPES.map((tp) => (
            <button type="button" key={tp.id} className={`qtype-chip ${f.type === tp.id ? "on" : ""}`} onClick={() => pickType(tp.id)}>
              <span className="qt-name"><Icon name={tp.ico} size={14} /> {lang === "fa" ? tp.fa : tp.en}</span>
              {(lang === "fa" ? tp.hintFa : tp.hintEn) ? <span className="qt-hint">{lang === "fa" ? tp.hintFa : tp.hintEn}</span> : null}
            </button>
          ))}
        </div>
        <div className="small muted mt8">{lang === "fa"
          ? "نوع را با یک کلیک انتخاب کنید. چهارگزینه‌ای پیش‌فرض ۴ گزینه دارد. نقاشی تا تأیید استاد نمره نمی‌گیرد. راهنما و درسنامه اختیاری‌اند و پایین فرم جمع شده‌اند."
          : "Pick a type with one tap. MCQ defaults to 4 options. Drawings stay unscored until the teacher approves them. Hints and micro-lessons are optional and collapsed below."}</div>
      </div>

      <div className="field"><label>{t("title")} (FA)</label><input value={f.title_fa} onChange={(e) => set("title_fa", e.target.value)} /></div>
      <div className="field"><label>{t("title")} (EN)</label><input value={f.title_en} onChange={(e) => set("title_en", e.target.value)} /></div>

      {f.type === "hotspot" && (
        <div className="micro-box mb16" style={{ padding: 12 }}>
          <ImageUpload value={f.imageUrl} onChange={(v) => set("imageUrl", v)} label={lang === "fa" ? "تصویر بافت / آناتومی / رادیولوژی" : "Histology / anatomy / radiology image"} />
          <HotspotEditor imageUrl={f.imageUrl} value={f.hotspot} lang={lang} onChange={(h) => set("hotspot", h)} />
        </div>
      )}

      {f.type === "drawing" && (
        <div className="micro-box mb16" style={{ padding: 12 }}>
          <div className="small muted mb8">{lang === "fa" ? "بوم حرفه‌ای بافت‌شناسی/آناتومی: دانشجو روی تصویر مرجع ردیابی می‌کند، ابزار خط/برچسب دارد، و نمره تا تأیید استاد صفر می‌ماند." : "Pro histology/anatomy canvas: the learner traces on the reference, uses line/label tools, and the score stays 0 until you approve."}</div>
          <div className="grid grid-2">
            <div className="field"><label>{lang === "fa" ? "دستور نقاشی (FA)" : "Drawing prompt FA"}</label><textarea value={f.drawing?.prompt_fa || ""} onChange={(e)=>setDrawing("prompt_fa", e.target.value)} placeholder={lang === "fa" ? "مثلاً بافت پوششی سنگفرشی مطبق را بکشید و لایه‌ها را برچسب بزنید" : "Draw stratified squamous epithelium and label the layers"}/></div>
            <div className="field"><label>{lang === "fa" ? "Drawing prompt (EN)" : "Drawing prompt EN"}</label><textarea value={f.drawing?.prompt_en || ""} onChange={(e)=>setDrawing("prompt_en", e.target.value)}/></div>
          </div>
          <ImageUpload value={f.drawing?.referenceImageUrl || ""} onChange={(v)=>setDrawing("referenceImageUrl", v)} label={lang === "fa" ? "تصویر مرجع / اسلاید (ردیابی روی آن)" : "Reference / slide (traced on the canvas)"} />
          <div className="grid grid-2 mt8">
            <div className="field"><label>{lang === "fa" ? "نسبت بوم" : "Canvas ratio"}</label>
              <select value={f.drawing?.aspect || "16:9"} onChange={(e)=>setDrawing("aspect", e.target.value)}>
                <option value="16:9">16:9</option><option value="4:3">4:3</option><option value="1:1">1:1</option><option value="3:4">3:4 {lang === "fa" ? "(پرتره)" : "(portrait)"}</option>
              </select></div>
            <div className="field"><label>{lang === "fa" ? "پس‌زمینه" : "Background"}</label>
              <select value={f.drawing?.background || "white"} onChange={(e)=>setDrawing("background", e.target.value)}>
                <option value="white">{lang === "fa" ? "سفید" : "White"}</option>
                <option value="cream">{lang === "fa" ? "کرم (اسلاید)" : "Cream (slide)"}</option>
                <option value="dark">{lang === "fa" ? "تیره (فلورسانس)" : "Dark (fluorescence)"}</option>
              </select></div>
            <div className="field"><label>{lang === "fa" ? "حداقل تعداد خط" : "Min. strokes"}</label>
              <input type="number" min="1" value={f.drawing?.minStrokes ?? 1} onChange={(e)=>setDrawing("minStrokes", Number(e.target.value) || 1)} /></div>
          </div>
          <label className="toggle-row"><span>{lang === "fa" ? "ردیابی روی تصویر مرجع (ترسیم روی اسلاید)" : "Trace on the reference image"}</span>
            <input type="checkbox" checked={f.drawing?.traceReference !== false} onChange={(e)=>setDrawing("traceReference", e.target.checked)} /></label>
          <label className="toggle-row" title={lang === "fa" ? "پیشنهاد خودکار نمره بر اساس پوشش نواحی و برچسب‌ها؛ فقط پیشنهاد است و تصمیم نهایی با شماست. اگر خاموش باشد، صرفاً بوم نقاشی و تأیید/رد دستی خواهید داشت." : "Advisory coverage/IoU score suggestion; you still decide every point. Off = plain canvas and manual approve/reject only."}><span>🤖 {lang === "fa" ? "دستیار پیشنهاد نمره (تحلیل پوشش/IoU) برای این سؤال" : "Drawing score assist (coverage/IoU) for this question"}</span>
            <input type="checkbox" checked={f.drawing?.assistEnabled !== false} onChange={(e)=>setDrawing("assistEnabled", e.target.checked)} /></label>
          <label className="toggle-row"><span>{lang === "fa" ? "شبکه راهنما به‌صورت پیش‌فرض" : "Show grid by default"}</span>
            <input type="checkbox" checked={!!f.drawing?.gridDefault} onChange={(e)=>setDrawing("gridDefault", e.target.checked)} /></label>
          <div className="section-title" style={{ marginTop: 8 }}><label className="small muted">{lang === "fa" ? "Rubric / معیار ارزیابی استاد" : "Teacher assessment rubric"}</label><button type="button" className="btn btn-sm btn-ghost" onClick={addRubric}>+ {t("add")}</button></div>
          {((f.drawing?.rubric_fa || []).length ? f.drawing.rubric_fa : [""]).map((_, i) => (
            <div className="inline-form mt8" key={i} style={{ alignItems: "center" }}>
              <input placeholder={lang === "fa" ? "معیار فارسی" : "Criterion FA"} value={(f.drawing?.rubric_fa || [])[i] || ""} onChange={(e)=>setRubric("rubric_fa", i, e.target.value)} />
              <input placeholder="Criterion EN" value={(f.drawing?.rubric_en || [])[i] || ""} onChange={(e)=>setRubric("rubric_en", i, e.target.value)} />
              <button type="button" className="btn btn-sm btn-danger" onClick={()=>delRubric(i)}>✕</button>
            </div>
          ))}
          {f.drawing?.assistEnabled !== false && <DrawingZoneEditor drawing={f.drawing} lang={lang} onChange={(zones)=>setDrawing("zones", zones)} />}
        </div>
      )}

      {f.type === "stepwise" && (
        <div className="micro-box mb16" style={{ padding: 12 }}>
          <div className="section-title"><label className="small muted">{lang === "fa" ? "مراحل سؤال scaffolded" : "Scaffolded steps"}</label><button type="button" className="btn btn-sm btn-ghost" onClick={addStep}>+ {t("add")}</button></div>
          <div className="small muted mb8">{lang === "fa" ? "هر مرحله یک prompt و پاسخ مورد انتظار دارد. چند پاسخ قابل قبول را با ویرگول جدا کنید." : "Each step has a prompt and expected answers. Separate acceptable answers with commas."}</div>
          {(f.steps || []).map((st, i) => (
            <div className="card mt8" key={i} style={{ padding: 10, background: "var(--panel2)" }}>
              <div className="section-title"><b>{lang === "fa" ? `مرحله ${i+1}` : `Step ${i+1}`}</b>{(f.steps||[]).length>1&&<button type="button" className="btn btn-sm btn-danger" onClick={()=>delStep(i)}>✕</button>}</div>
              <div className="field"><label>{lang === "fa" ? "نوع پاسخ این مرحله" : "Step answer type"}</label><select value={st.answerType || "autocomplete"} onChange={(e)=>setStep(i,"answerType",e.target.value)}><option value="autocomplete">{lang==="fa"?"اتوکامپلیت/متنی":"Autocomplete/text"}</option><option value="mcq">{lang==="fa"?"چندگزینه‌ای":"Multiple choice"}</option><option value="truefalse">{lang==="fa"?"درست/غلط":"True/False"}</option><option value="fill">{lang==="fa"?"جای‌خالی":"Fill"}</option></select></div>
              <div className="grid grid-2">
                <div className="field"><label>Prompt FA</label><textarea value={st.prompt_fa || ""} onChange={(e)=>setStep(i,"prompt_fa",e.target.value)} /></div>
                <div className="field"><label>Prompt EN</label><textarea value={st.prompt_en || ""} onChange={(e)=>setStep(i,"prompt_en",e.target.value)} /></div>
                <div className="field"><label>{lang === "fa" ? "پاسخ/پاسخ‌های قابل قبول FA" : "Accepted answers FA"}</label><input value={Array.isArray(st.accept_fa)?st.accept_fa.join(", "):(st.accept_fa || st.answer_fa || "")} onChange={(e)=>setStep(i,"accept_fa",e.target.value)} /></div>
                <div className="field"><label>Accepted answers EN</label><input value={Array.isArray(st.accept_en)?st.accept_en.join(", "):(st.accept_en || st.answer_en || "")} onChange={(e)=>setStep(i,"accept_en",e.target.value)} /></div>
                {st.answerType === "mcq" && <div className="field"><label>{lang === "fa" ? "گزینه‌های FA (هر خط/ویرگول)" : "Options FA"}</label><textarea value={Array.isArray(st.options_fa)?st.options_fa.join("\n"):(st.options_fa||"")} onChange={(e)=>setStep(i,"options_fa",e.target.value)} /></div>}
                {st.answerType === "mcq" && <div className="field"><label>Options EN</label><textarea value={Array.isArray(st.options_en)?st.options_en.join("\n"):(st.options_en||"")} onChange={(e)=>setStep(i,"options_en",e.target.value)} /></div>}
                <div className="field"><label>{lang === "fa" ? "هینت FA" : "Hint FA"}</label><input value={st.hint_fa || ""} onChange={(e)=>setStep(i,"hint_fa",e.target.value)} /></div>
                <div className="field"><label>Hint EN</label><input value={st.hint_en || ""} onChange={(e)=>setStep(i,"hint_en",e.target.value)} /></div>
              </div>
              <div className="grid grid-2">
                <div className="field"><label>{lang === "fa" ? "توضیح بعد از پاسخ FA" : "Explanation FA"}</label><textarea value={st.explanation_fa || ""} onChange={(e)=>setStep(i,"explanation_fa",e.target.value)} /></div>
                <div className="field"><label>Explanation EN</label><textarea value={st.explanation_en || ""} onChange={(e)=>setStep(i,"explanation_en",e.target.value)} /></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {f.type === "kf" && (
        <div className="micro-box mb16" style={{ padding: 12 }}>
          <div className="small muted mb8">{lang === "fa" ? "کی‌اف: یک شرح‌حال کوتاه و چند سؤال مستقل (پاسخ کوتاه یا چهارگزینه‌ای). هر مورد جداگانه نمره می‌گیرد." : "Key Feature: a short vignette plus independent items (short answer or 4-option). Each item is scored separately."}</div>
          <div className="grid grid-2">
            <div className="field"><label>{t("kfVignette")} (FA)</label><textarea value={f.kf?.vignette_fa || ""} onChange={(e) => setKf("vignette_fa", e.target.value)} placeholder={lang === "fa" ? "آقای ۴۵ ساله با درد قفسه سینه از یک ساعت پیش…" : ""} /></div>
            <div className="field"><label>{t("kfVignette")} (EN)</label><textarea value={f.kf?.vignette_en || ""} onChange={(e) => setKf("vignette_en", e.target.value)} /></div>
          </div>
          <div className="section-title"><label className="small muted">{t("kfItems")}</label><button type="button" className="btn btn-sm btn-ghost" onClick={addKfItem}>+ {t("add")}</button></div>
          {(f.kf?.items || []).map((it, i) => (
            <div className="card mt8" key={i} style={{ padding: 10, background: "var(--panel2)" }}>
              <div className="section-title"><b>{lang === "fa" ? `مورد ${i + 1}` : `Item ${i + 1}`}</b>{(f.kf?.items || []).length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => delKfItem(i)}>✕</button>}</div>
              <div className="field"><label>{lang === "fa" ? "نوع این مورد" : "Item type"}</label>
                <select value={it.kind || "short"} onChange={(e) => setKfItem(i, "kind", e.target.value)}>
                  <option value="short">{lang === "fa" ? "پاسخ کوتاه" : "Short answer"}</option>
                  <option value="mcq">{t("qtMcq")}</option>
                </select></div>
              <div className="grid grid-2">
                <div className="field"><label>{lang === "fa" ? "صورت سؤال FA" : "Prompt FA"}</label><textarea value={it.prompt_fa || ""} onChange={(e) => setKfItem(i, "prompt_fa", e.target.value)} /></div>
                <div className="field"><label>Prompt EN</label><textarea value={it.prompt_en || ""} onChange={(e) => setKfItem(i, "prompt_en", e.target.value)} /></div>
              </div>
              {(it.kind || "short") === "short" ? (
                <div className="grid grid-2">
                  <div className="field"><label>{t("correctAns")} (FA)</label><input value={it.answer_fa || ""} onChange={(e) => setKfItem(i, "answer_fa", e.target.value)} /></div>
                  <div className="field"><label>{t("correctAns")} (EN)</label><input value={it.answer_en || ""} onChange={(e) => setKfItem(i, "answer_en", e.target.value)} /></div>
                  <div className="field"><label>{t("acceptAlt")} (FA)</label><input value={Array.isArray(it.accept_fa) ? it.accept_fa.join(", ") : (it.accept_fa || "")} onChange={(e) => setKfItem(i, "accept_fa", e.target.value)} placeholder={t("commaSep")} /></div>
                  <div className="field"><label>{t("acceptAlt")} (EN)</label><input value={Array.isArray(it.accept_en) ? it.accept_en.join(", ") : (it.accept_en || "")} onChange={(e) => setKfItem(i, "accept_en", e.target.value)} placeholder={t("commaSep")} /></div>
                </div>
              ) : (
                <>
                  {[0, 1, 2, 3].map((j) => (
                    <div className="inline-form mt8" key={j} style={{ alignItems: "center" }}>
                      <input type="radio" name={`kf-correct-${i}`} checked={Number(it.correct || 0) === j} onChange={() => setKfItem(i, "correct", j)} />
                      <input placeholder={`FA ${["الف", "ب", "ج", "د"][j]}`} value={(it.options_fa || [])[j] || ""} onChange={(e) => setKfOpt(i, "options_fa", j, e.target.value)} />
                      <input placeholder={`EN ${["A", "B", "C", "D"][j]}`} value={(it.options_en || [])[j] || ""} onChange={(e) => setKfOpt(i, "options_en", j, e.target.value)} />
                    </div>
                  ))}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {f.type === "puzzle" && (
        <div className="micro-box mb16" style={{ padding: 12 }}>
          <div className="small muted mb8">{lang === "fa" ? "پازل نام‌گذاری تصویر (بافت‌شناسی / آناتومی / رادیولوژی): روی ساختارها پین بزنید و برچسب درست را بنویسید. دانشجو برچسب‌های درهم را به شماره‌ها وصل می‌کند. تطبیق جفت‌ها نوع جداگانه‌ای است." : "Image-label puzzle (histology / anatomy / CXR): drop pins on structures and type the correct labels. The learner assigns shuffled labels to numbered pins. Pair-matching is a separate type."}</div>
          <ImageUpload value={f.puzzle?.imageUrl || f.imageUrl} onChange={(v) => { setPuzzle("imageUrl", v); set("imageUrl", v); }} label={lang === "fa" ? "تصویر پازل" : "Puzzle image"} />
          {(f.puzzle?.imageUrl || f.imageUrl) && (
            <div className="hotspot-admin-preview" onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              addPin({ x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10 });
            }}>
              <img src={f.puzzle?.imageUrl || f.imageUrl} alt="" />
              {((f.puzzle || {}).pins || []).map((p, i) => (
                <span key={i} className="label-pin admin" style={{ left: `${p.x}%`, top: `${p.y}%` }}>{i + 1}</span>
              ))}
            </div>
          )}
          <div className="small muted mt8 mb8">{t("puzzleClickHint")}</div>
          <div className="section-title"><label className="small muted">{t("puzzlePins")}</label>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => addPin()}>+ {t("add")}</button></div>
          {((f.puzzle || {}).pins || []).map((p, i) => (
            <div className="inline-form mt8" key={i} style={{ alignItems: "center" }}>
              <span className="tag">{i + 1}</span>
              <input type="number" min="0" max="100" step="0.1" value={p.x} onChange={(e) => setPin(i, "x", Number(e.target.value))} style={{ width: 72 }} />
              <input type="number" min="0" max="100" step="0.1" value={p.y} onChange={(e) => setPin(i, "y", Number(e.target.value))} style={{ width: 72 }} />
              <input placeholder="FA" value={p.label_fa || ""} onChange={(e) => setPin(i, "label_fa", e.target.value)} />
              <input placeholder="EN" value={p.label_en || ""} onChange={(e) => setPin(i, "label_en", e.target.value)} />
              <button type="button" className="btn btn-sm btn-danger" onClick={() => delPin(i)}>✕</button>
            </div>
          ))}
          <div className="grid grid-2 mt8">
            <div className="field"><label>{t("puzzleDistractors")} (FA)</label>
              <textarea value={Array.isArray(f.puzzle?.distractors_fa) ? f.puzzle.distractors_fa.join("\n") : (f.puzzle?.distractors_fa || "")} onChange={(e) => setPuzzle("distractors_fa", e.target.value.split("\n"))} /></div>
            <div className="field"><label>{t("puzzleDistractors")} (EN)</label>
              <textarea value={Array.isArray(f.puzzle?.distractors_en) ? f.puzzle.distractors_en.join("\n") : (f.puzzle?.distractors_en || "")} onChange={(e) => setPuzzle("distractors_en", e.target.value.split("\n"))} /></div>
          </div>
        </div>
      )}

      {f.type === "mcq" && (
        <div className="field"><label>{t("answerMode")}</label>
          <select value={f.answerMode} onChange={(e) => set("answerMode", e.target.value)}>
            <option value="choice">{t("modeChoice")}</option>
            <option value="search">{t("modeSearch")}</option>
          </select></div>
      )}

      {/* Image is optional and independent — a teacher can add it to ANY card. Hotspot has its own image field above. */}
      {f.type !== "hotspot" && <ImageUpload value={f.imageUrl} onChange={(v) => set("imageUrl", v)} label={`${t("imageUrl")} (${t("optional")})`} />}

      {/* Question text is also independent of the image */}
      <div className="field"><label>{t("questionText")} (FA)</label>
        <textarea value={f.questionText_fa} onChange={(e) => set("questionText_fa", e.target.value)} placeholder={t("optional")} /></div>
      <div className="field"><label>{t("questionText")} (EN)</label>
        <textarea value={f.questionText_en} onChange={(e) => set("questionText_en", e.target.value)} placeholder={t("optional")} /></div>

      <div className="grid grid-2">
        <div className="field"><label>{t("category")} (FA)</label><input value={f.category_fa} onChange={(e) => set("category_fa", e.target.value)} /></div>
        <div className="field"><label>{t("category")} (EN)</label><input value={f.category_en} onChange={(e) => set("category_en", e.target.value)} /></div>
      </div>
      <div className="field"><label>{t("difficulty")}</label>
        <select value={f.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
          {["easy", "medium", "hard"].map((d) => <option key={d} value={d}>{t(d)}</option>)}</select></div>

      <div className="divider" />
      {/* ===== TRUE / FALSE ===== */}
      {f.type === "truefalse" && (
        <div className="field"><label><Icon name="check" size={16} /> {t("correctAns")}</label>
          <select value={f.answer ? "1" : "0"} onChange={(e) => set("answer", e.target.value === "1")}>
            <option value="1">{lang === "fa" ? "درست" : "True"}</option>
            <option value="0">{lang === "fa" ? "نادرست" : "False"}</option>
          </select></div>
      )}

      {/* ===== FILL IN THE BLANK ===== */}
      {f.type === "fill" && (
        <>
          <div className="small muted mb8">{t("fillHint")}</div>
          <div className="grid grid-2">
            <div className="field"><label>{t("correctAns")} (FA)</label><input value={f.blank_fa} onChange={(e) => set("blank_fa", e.target.value)} /></div>
            <div className="field"><label>{t("correctAns")} (EN)</label><input value={f.blank_en} onChange={(e) => set("blank_en", e.target.value)} /></div>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>{t("acceptAlt")} (FA)</label><input value={Array.isArray(f.accept_fa) ? f.accept_fa.join(", ") : f.accept_fa} onChange={(e) => set("accept_fa", e.target.value)} placeholder={t("commaSep")} /></div>
            <div className="field"><label>{t("acceptAlt")} (EN)</label><input value={Array.isArray(f.accept_en) ? f.accept_en.join(", ") : f.accept_en} onChange={(e) => set("accept_en", e.target.value)} placeholder={t("commaSep")} /></div>
          </div>
        </>
      )}

      {/* ===== MATCH PAIRS ===== */}
      {f.type === "match" && (
        <>
          <div className="section-title"><label className="small muted">{t("matchPairs")}</label>
            <button type="button" className="btn btn-sm btn-ghost" onClick={addPair}>+ {t("add")}</button></div>
          {f.pairs.map((p, i) => (
            <div key={i} className="inline-form mt8" style={{ alignItems: "center", flexWrap: "wrap" }}>
              <input style={{ minWidth: 90 }} placeholder={`چپ FA`} value={p[0]} onChange={(e) => setPair(i, 0, e.target.value)} />
              <input style={{ minWidth: 90 }} placeholder={`Left EN`} value={p[1]} onChange={(e) => setPair(i, 1, e.target.value)} />
              <span style={{ fontWeight: 800 }}>↔</span>
              <input style={{ minWidth: 90 }} placeholder={`راست FA`} value={p[2]} onChange={(e) => setPair(i, 2, e.target.value)} />
              <input style={{ minWidth: 90 }} placeholder={`Right EN`} value={p[3]} onChange={(e) => setPair(i, 3, e.target.value)} />
              {f.pairs.length > 2 && <button type="button" className="btn btn-sm btn-danger" onClick={() => delPair(i)}>✕</button>}
            </div>
          ))}
        </>
      )}

      {/* ===== COMPARE TWO ENTITIES ===== */}
      {f.type === "compare" && (
        <>
          <div className="small muted mb8">{lang === "fa" ? "دو موجودیت و ویژگی‌هایی که به A، B یا هر دو تعلق دارند." : "Two entities and features that belong to A, B, or both."}</div>
          <div className="grid grid-2">
            <div className="field"><label>A (FA)</label><input value={f.entityA_fa || ""} onChange={(e) => set("entityA_fa", e.target.value)} /></div>
            <div className="field"><label>A (EN)</label><input value={f.entityA_en || ""} onChange={(e) => set("entityA_en", e.target.value)} /></div>
            <div className="field"><label>B (FA)</label><input value={f.entityB_fa || ""} onChange={(e) => set("entityB_fa", e.target.value)} /></div>
            <div className="field"><label>B (EN)</label><input value={f.entityB_en || ""} onChange={(e) => set("entityB_en", e.target.value)} /></div>
          </div>
          <div className="section-title"><label className="small muted">{lang === "fa" ? "ویژگی‌ها" : "Features"}</label>
            <button type="button" className="btn btn-sm btn-ghost" onClick={addFeature}>+ {t("add")}</button></div>
          {(f.features || []).map((row, i) => (
            <div key={i} className="inline-form mt8" style={{ alignItems: "center", flexWrap: "wrap" }}>
              <input style={{ minWidth: 90 }} placeholder="FA" value={row.fa || ""} onChange={(e) => setFeature(i, "fa", e.target.value)} />
              <input style={{ minWidth: 90 }} placeholder="EN" value={row.en || ""} onChange={(e) => setFeature(i, "en", e.target.value)} />
              <select value={row.belongs || "A"} onChange={(e) => setFeature(i, "belongs", e.target.value)}>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="both">{lang === "fa" ? "هر دو" : "both"}</option>
              </select>
              {(f.features || []).length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => delFeature(i)}>✕</button>}
            </div>
          ))}
        </>
      )}

      {/* ===== ORDER (word bank) ===== */}
      {f.type === "order" && (
        <>
          <div className="section-title"><label className="small muted">{t("orderItems")}</label>
            <button type="button" className="btn btn-sm btn-ghost" onClick={addItem}>+ {t("add")}</button></div>
          <div className="small muted mb8">{t("orderHint")}</div>
          {f.items_fa.map((it, i) => (
            <div key={i} className="inline-form mt8" style={{ alignItems: "center" }}>
              <span style={{ fontWeight: 800, width: 22 }}>{i + 1}.</span>
              <input placeholder={`FA #${i + 1}`} value={it} onChange={(e) => setItem(i, "items_fa", e.target.value)} />
              <input placeholder={`EN #${i + 1}`} value={f.items_en[i] || ""} onChange={(e) => setItem(i, "items_en", e.target.value)} />
              {f.items_fa.length > 2 && <button type="button" className="btn btn-sm btn-danger" onClick={() => delItem(i)}>✕</button>}
            </div>
          ))}
        </>
      )}

      {/* ===== MCQ (subject catalog + options) ===== */}
      {f.type === "mcq" && <>
      {/* Smart subject catalog: pick a subject to auto-fill all options */}
      <div className="field"><label><Icon name="book" size={16} /> {t("subjectCatalog")}</label>
        <select value={subject} onChange={(e) => pickSubject(e.target.value)}>
          <option value="">{t("manualOptions")}</option>
          {/* All catalogs (including the built-in Histology/Anatomy/… which are now
              editable rows) come from the Catalogs section — a single source of truth. */}
          {customCats.map((c) => <option key={c.id} value={`cat:${c.id}`}>{lang === "fa" ? c.name_fa : c.name_en}</option>)}
        </select>
        <div className="small muted mt8">{t("subjectCatalogHint")}</div>
      </div>

      {subject ? (
        /* Catalog mode: teacher just picks the correct answer via smart search */
        <div className="field">
          <label><Icon name="check" size={16} /> {t("markCorrect")}</label>
          <div className="small muted mb8">
            {correctIdx >= 0
              ? <>{t("correctAns")}: <b style={{ color: "var(--accent)" }}>{lang === "fa" ? f.options[correctIdx].fa : f.options[correctIdx].en}</b></>
              : t("noCorrectYet")}
          </div>
          <SearchAnswer options={f.options} lang={lang} disabled={false}
            placeholder={t("searchCorrectPh")} onPick={(i) => setCorrect(i)} />
          <div className="small muted mt8">{t("catalogCount")}: {f.options.length}</div>
        </div>
      ) : (
        /* Manual mode: enter each option */
        <>
          <div className="section-title"><label className="small muted">{t("options")} — {t("markCorrect")}</label>
            <button type="button" className="btn btn-sm btn-ghost" onClick={addOpt}>+ {t("add")}</button></div>
          {f.options.map((o, i) => (
            <div key={i} className="opt-editor mt8" style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
              <div className="inline-form" style={{ alignItems: "center" }}>
                <input type="radio" name="correct" checked={!!o.correct} onChange={() => setCorrect(i)} style={{ width: 18, flexShrink: 0 }} title={t("markCorrect")} />
                <input placeholder={`FA #${i + 1}`} value={o.fa} onChange={(e) => setOpt(i, "fa", e.target.value)} />
                <input placeholder={`EN #${i + 1}`} value={o.en} onChange={(e) => setOpt(i, "en", e.target.value)} />
                {f.options.length > 2 && <button type="button" className="btn btn-sm btn-danger" onClick={() => delOpt(i)}>✕</button>}
              </div>
              {/* per-option rationale — WHY this option is right/wrong (UWorld-style) */}
              <div className="grid grid-2 mt8" style={{ gap: 8 }}>
                <input className="small" placeholder={lang === "fa" ? `چرا؟ (FA) — ${o.correct ? "چرا درست است" : "چرا غلط است"}` : `Why? (FA)`}
                  value={o.why_fa || ""} onChange={(e) => setOpt(i, "why_fa", e.target.value)} />
                <input className="small" placeholder={lang === "fa" ? "چرا؟ (EN)" : `Why? (EN) — ${o.correct ? "why correct" : "why wrong"}`}
                  value={o.why_en || ""} onChange={(e) => setOpt(i, "why_en", e.target.value)} />
              </div>
              <ImageUpload compact value={o.imageUrl || ""} onChange={(v) => setOpt(i, "imageUrl", v)}
                label={lang === "fa" ? "تصویر این گزینه (اختیاری)" : "Option image (optional)"} />
            </div>
          ))}
          <div className="small muted mt8"><Icon name="bulb" size={14} /> {lang === "fa"
            ? "نکتهٔ حرفه‌ای (سبک UWorld): برای هر گزینه بنویس چرا درست یا غلط است — این «چرا»ها بعد از پاسخ به کاربر نشان داده می‌شوند و استدلال بالینی را می‌سازند. (اختیاری)"
            : "Pro tip (UWorld-style): write why each option is right/wrong — shown after answering to build clinical reasoning. (optional)"}</div>
        </>
      )}
      <div className="small muted mt8">{t("answerMode")}: {f.answerMode === "search" ? t("modeSearch") : t("modeChoice")}</div>
      </>}

      <details className="card-adv">
      <summary><Icon name="bulb" size={14} /> {t("hintQuestion")} — {lang === "fa" ? "اختیاری" : "optional"}</summary>
      <div className="small muted mb8">{t("hintQuestionNote")}</div>
      <div className="field"><label>{t("hints")} (FA)</label>
        <textarea placeholder={t("hintsPlaceholder")} value={Array.isArray(f.hints_fa) ? f.hints_fa.join("\n") : f.hints_fa}
          onChange={(e) => set("hints_fa", e.target.value.split("\n"))} />
        <div className="small muted mt8">{lang === "fa" ? "برای هر راهنما می‌توانید یک تصویر اختیاری اضافه کنید." : "Optional image per hint."}</div>
        {(Array.isArray(f.hints_fa) ? f.hints_fa : []).map((h, i) => (
          <div className="card mt8" key={`hfa-${i}`} style={{ background: "var(--panel2)", padding: 10 }}>
            <div className="small muted mb8">{t("hint")} {i + 1}: {h || "—"}</div>
            <ImageUpload value={(f.hint_images_fa || [])[i] || ""} onChange={(v) => setHintImage("hint_images_fa", i, v)} label={lang === "fa" ? "تصویر راهنما (اختیاری)" : "Hint image (optional)"} />
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm mt8" onClick={() => addHintLine("hints_fa", "hint_images_fa")}>+ {t("hint")}</button>
      </div>
      <div className="field"><label>{t("hints")} (EN)</label>
        <textarea placeholder={t("hintsPlaceholder")} value={Array.isArray(f.hints_en) ? f.hints_en.join("\n") : f.hints_en}
          onChange={(e) => set("hints_en", e.target.value.split("\n"))} />
        {(Array.isArray(f.hints_en) ? f.hints_en : []).map((h, i) => (
          <div className="card mt8" key={`hen-${i}`} style={{ background: "var(--panel2)", padding: 10 }}>
            <div className="small muted mb8">{t("hint")} {i + 1}: {h || "—"}</div>
            <ImageUpload value={(f.hint_images_en || [])[i] || ""} onChange={(v) => setHintImage("hint_images_en", i, v)} label="Hint image (optional)" />
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm mt8" onClick={() => addHintLine("hints_en", "hint_images_en")}>+ {t("hint")}</button>
      </div>

      </details>

      <details className="card-adv">
      <summary><Icon name="patient" size={14} /> {lang === "fa" ? "کمک‌های آموزشی (سبک AMBOSS) — اختیاری" : "Teaching aids (AMBOSS-style) — optional"}</summary>
      <div className="small muted mb8">{lang === "fa"
        ? "نکتهٔ استاد و سرنخ‌های کلیدیِ صورت‌سؤال."
        : "Attending tip + key clue highlights."}</div>
      <div className="grid grid-2">
        <div className="field"><label>{t("attendingTipAdmin")} (FA)</label>
          <textarea value={f.attending_fa || ""} onChange={(e) => set("attending_fa", e.target.value)} /></div>
        <div className="field"><label>{t("attendingTipAdmin")} (EN)</label>
          <textarea value={f.attending_en || ""} onChange={(e) => set("attending_en", e.target.value)} /></div>
      </div>
      <div className="grid grid-2">
        <div className="field"><label>{t("highlightsAdmin")} (FA)</label>
          <textarea placeholder={lang === "fa" ? "درد فشارنده\nانتشار به بازوی چپ" : ""}
            value={Array.isArray(f.highlights_fa) ? f.highlights_fa.join("\n") : (f.highlights_fa || "")}
            onChange={(e) => set("highlights_fa", e.target.value.split("\n"))} /></div>
        <div className="field"><label>{t("highlightsAdmin")} (EN)</label>
          <textarea value={Array.isArray(f.highlights_en) ? f.highlights_en.join("\n") : (f.highlights_en || "")}
            onChange={(e) => set("highlights_en", e.target.value.split("\n"))} /></div>
      </div>

      </details>

      <details className="card-adv">
      <summary><Icon name="book" size={14} /> {t("microTitle")}</summary>
      <div className="small muted mb8">{t("microLessonNote")}</div>
      <div className="grid grid-2">
        <div className="field"><label>{t("microLead")} (FA)</label><input value={f.micro_lead_fa} onChange={(e) => set("micro_lead_fa", e.target.value)} /></div>
        <div className="field"><label>{t("microLead")} (EN)</label><input value={f.micro_lead_en} onChange={(e) => set("micro_lead_en", e.target.value)} /></div>
      </div>
      <div className="grid grid-2">
        <div className="field"><label>{t("microGolden")} (FA)</label><input value={f.micro_golden_fa} onChange={(e) => set("micro_golden_fa", e.target.value)} /></div>
        <div className="field"><label>{t("microGolden")} (EN)</label><input value={f.micro_golden_en} onChange={(e) => set("micro_golden_en", e.target.value)} /></div>
      </div>
      <div className="grid grid-2">
        <div className="field"><label>{t("microSource")} (FA)</label><input value={f.micro_source_fa} onChange={(e) => set("micro_source_fa", e.target.value)} /></div>
        <div className="field"><label>{t("microSource")} (EN)</label><input value={f.micro_source_en} onChange={(e) => set("micro_source_en", e.target.value)} /></div>
      </div>
      </details>
    </Modal>
  );
}

/* ---- Checklists (fully editable OSCE rubrics) ----
   Each checklist is a list of scored items. The AI examiner scores each item by
   reading the whole encounter; the optional keywords are the AI-free fallback. */
function Checklists() {
  const { lang } = useApp();
  const fa = lang === "fa";
  const [lists, setLists] = useState(null);
  const [meta, setMeta] = useState({ sections: [], internalHistory: [] });
  const toast = useToast();
  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    api.get("/checklists").then((d) => setLists(Array.isArray(d) ? d : [])).catch((e) => { setLoadErr(String(e.message || e)); setLists({ __err: true }); });
  };
  useEffect(() => { load(); api.get("/checklists-meta").then(setMeta).catch(() => {}); }, []);
  if (lists?.__err || loadErr) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{loadErr || (fa ? "بارگذاری چک‌لیست‌ها شکست خورد" : "Could not load checklists")}</h3><button className="btn btn-ghost mt16" onClick={() => { setLists(null); load(); }}>{fa ? "تلاش دوباره" : "Retry"}</button></div>;
  if (!lists) return <Spinner />;

  const addChecklist = async () => {
    await api.post("/checklists", { name_fa: "چک‌لیست جدید", name_en: "New checklist", items: [] });
    toast(fa ? "ساخته شد" : "Created"); load();
  };

  return (
    <div>
      <div className="section-title">
        <h4><Icon name="check" size={16} /> {fa ? "چک‌لیست‌های ارزیابی (OSCE)" : "Assessment checklists (OSCE)"}</h4>
        <button className="btn btn-primary btn-sm" onClick={addChecklist}>+ {fa ? "چک‌لیست جدید" : "New checklist"}</button>
      </div>
      <div className="small muted mb16">
        {fa
          ? "هر مورد یک معیارِ نمره‌دهی است. هوشِ مصنوعی بر اساسِ کلِ گفت‌وگو هر مورد را «انجام‌شده/نشده» قضاوت می‌کند. «وزن» اهمیتِ نسبیِ مورد است. «بخش» تعیین می‌کند این مورد جزء کدام دستهٔ نمره‌دهی است (شرح‌حال، معاینه، تشخیص افتراقی، تشخیص...) — نمرهٔ هر بخش جداگانه و یک نمرهٔ کلی هم محاسبه می‌شود. ملاک اکسترن = بخش‌های تا تشخیص افتراقی (شرح‌حال + معاینه + پرابلم لیست + تشخیص افتراقی) و ملاک اینترن = همه بخش‌ها. «کلیدواژه‌ها» فقط برای حالتِ بدونِ هوشِ مصنوعی به‌کار می‌روند (با کاما جدا کنید)."
          : "Each row is a scored criterion. The AI judges each as done/not-done from the whole encounter. \"Weight\" is its relative importance. \"Section\" groups the item for scoring (history, exam, differential dx, diagnosis...) — each section is scored separately plus an overall score. The extern criterion = sections up to the differential dx (history + exam + problem list + differential dx); the intern criterion = all sections. \"Keywords\" are only used in the AI-free fallback (comma-separated)."}
      </div>
      {lists.map((ch) => <ChecklistEditor key={ch.id} ch={ch} meta={meta} onSaved={load} />)}
    </div>
  );
}

function ChecklistEditor({ ch, meta = { sections: [], internalHistory: [] }, onSaved }) {
  const { lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [name_fa, setNameFa] = useState(ch.name_fa || "");
  const [name_en, setNameEn] = useState(ch.name_en || "");
  const [items, setItems] = useState(() => (ch.items || []).map((i) => ({ section: "history", ...i })));
  const [busy, setBusy] = useState(false);
  const sections = meta.sections?.length ? meta.sections : [{ key: "history", fa: "شرح‌حال", en: "History-taking" }];

  const setItem = (idx, k, v) => setItems((arr) => arr.map((it, i) => i === idx ? { ...it, [k]: v } : it));
  const addItem = () => setItems((arr) => [...arr, { id: `i${Date.now()}`, section: "history", weight: 1, fa: "", en: "", keys: [] }]);
  // Insert the full internal-medicine history form (all fields as history items).
  // insert ANY specialty history form (internal/obgyn/cardio/peds/psych)
  const forms = meta.forms?.length ? meta.forms
    : (meta.internalHistory?.length ? [{ key: "internal", fa: "داخلی", en: "Internal medicine", items: meta.internalHistory }] : []);
  const addHistoryForm = (formKey) => {
    const form = forms.find((f) => f.key === formKey);
    const tpl = (form?.items || []).map((t) => ({ ...t, id: `${t.id}_${Math.random().toString(36).slice(2, 5)}` }));
    if (!tpl.length) { toast(fa ? "قالب در دسترس نیست" : "Template unavailable"); return; }
    setItems((arr) => [...arr, ...tpl]);
    toast(fa ? `${tpl.length} مورد شرح‌حالِ «${fa ? form.fa : form.en}» اضافه شد` : `${tpl.length} ${form.en} history items added`);
  };
  const removeItem = (idx) => setItems((arr) => arr.filter((_, i) => i !== idx));
  const move = (idx, dir) => setItems((arr) => {
    const n = [...arr]; const j = idx + dir;
    if (j < 0 || j >= n.length) return n;
    [n[idx], n[j]] = [n[j], n[idx]]; return n;
  });

  const save = async () => {
    setBusy(true);
    try {
      // normalize keys: allow comma/؛/newline separated text → array
      const clean = items.map((it) => ({
        id: it.id || `i${Math.random().toString(36).slice(2, 8)}`,
        section: it.section || "history",
        weight: Math.max(1, Number(it.weight) || 1),
        fa: (it.fa || "").trim(), en: (it.en || "").trim(),
        keys: Array.isArray(it.keys) ? it.keys
          : String(it.keys || "").split(/[,،؛\n]+/).map((s) => s.trim()).filter(Boolean),
      }));
      await api.put(`/checklists/${ch.id}`, { name_fa, name_en, items: clean });
      toast(fa ? "ذخیره شد" : "Saved"); onSaved?.();
    } catch (e) { toast(e.message || "error"); }
    finally { setBusy(false); }
  };
  const del = async () => {
    if (!confirm(fa ? "این چک‌لیست حذف شود؟" : "Delete this checklist?")) return;
    await api.del(`/checklists/${ch.id}`); toast(fa ? "حذف شد" : "Deleted"); onSaved?.();
  };

  const keysText = (it) => Array.isArray(it.keys) ? it.keys.join("، ") : (it.keys || "");

  return (
    <div className="card mb16">
      <div className="grid grid-2">
        <div className="field"><label>{fa ? "نام چک‌لیست (FA)" : "Name (FA)"}</label>
          <input value={name_fa} onChange={(e) => setNameFa(e.target.value)} /></div>
        <div className="field"><label>{fa ? "نام چک‌لیست (EN)" : "Name (EN)"}</label>
          <input dir="ltr" value={name_en} onChange={(e) => setNameEn(e.target.value)} /></div>
      </div>

      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table>
          <thead><tr>
            <th style={{ width: 30 }}>#</th>
            <th style={{ width: 130 }}>{fa ? "بخش" : "Section"}</th>
            <th>{fa ? "معیار (فارسی)" : "Criterion (FA)"}</th>
            <th>{fa ? "معیار (انگلیسی)" : "Criterion (EN)"}</th>
            <th style={{ width: 70 }}>{fa ? "وزن" : "Weight"}</th>
            <th>{fa ? "کلیدواژه‌ها (فقط حالت بدون AI)" : "Keywords (AI-free only)"}</th>
            <th style={{ width: 90 }}></th>
          </tr></thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id || idx}>
                <td className="small muted">{idx + 1}</td>
                <td>
                  <select value={it.section || "history"} onChange={(e) => setItem(idx, "section", e.target.value)} style={{ minWidth: 120 }}>
                    {sections.map((s) => <option key={s.key} value={s.key}>{fa ? s.fa : s.en}</option>)}
                  </select>
                </td>
                <td><input value={it.fa || ""} onChange={(e) => setItem(idx, "fa", e.target.value)} style={{ minWidth: 180 }} /></td>
                <td><input dir="ltr" value={it.en || ""} onChange={(e) => setItem(idx, "en", e.target.value)} style={{ minWidth: 160 }} /></td>
                <td><input type="number" min="1" value={it.weight} onChange={(e) => setItem(idx, "weight", e.target.value)} style={{ width: 60 }} /></td>
                <td><input value={keysText(it)} onChange={(e) => setItem(idx, "keys", e.target.value)} placeholder={fa ? "مثال: درد، بازو، pain" : "e.g. pain, arm"} style={{ minWidth: 150 }} /></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-sm btn-ghost" title={fa ? "بالا" : "Up"} onClick={() => move(idx, -1)}><Icon name="chevronUp" size={13} /></button>
                  <button className="btn btn-sm btn-ghost" title={fa ? "پایین" : "Down"} onClick={() => move(idx, 1)}><Icon name="chevronDown" size={13} /></button>
                  <button className="btn btn-sm btn-danger" title={fa ? "حذف" : "Delete"} onClick={() => removeItem(idx)}><Icon name="close" size={13} /></button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={7} className="small muted center" style={{ padding: 14 }}>{fa ? "موردی نیست — یک مورد اضافه کنید." : "No items — add one."}</td></tr>}
          </tbody>
        </table>
      </div>

      {/* per-section weight summary so the author sees how much each section counts */}
      {items.length > 0 && (() => {
        const agg = {}; let tot = 0;
        for (const it of items) { const s = it.section || "history"; const w = Math.max(1, Number(it.weight) || 1); agg[s] = (agg[s] || 0) + w; tot += w; }
        return (
          <div className="small muted" style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span>{fa ? "سهم بخش‌ها از نمره:" : "Section weight split:"}</span>
            {sections.filter((s) => agg[s.key]).map((s) => (
              <span key={s.key} className="tag small">{fa ? s.fa : s.en}: {Math.round((agg[s.key] / tot) * 100)}٪</span>
            ))}
          </div>
        );
      })()}

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button className="btn btn-sm btn-ghost" onClick={addItem}>+ {fa ? "افزودن مورد" : "Add item"}</button>
        <select className="btn btn-sm btn-ghost" defaultValue="" onChange={(e) => { if (e.target.value) { addHistoryForm(e.target.value); e.target.value = ""; } }}
          title={fa ? "افزودن فرم کامل شرح‌حالِ یک تخصص (همه به بخش شرح‌حال)" : "Insert a specialty's full history form"}
          style={{ maxWidth: 220 }}>
          <option value="">➕ {fa ? "افزودن فرم شرح‌حال…" : "Add history form…"}</option>
          {forms.map((f) => <option key={f.key} value={f.key}>{fa ? f.fa : f.en} ({f.items?.length})</option>)}
        </select>
        <button className="btn btn-sm btn-primary" disabled={busy} onClick={save}><Icon name="check" size={14} /> {fa ? "ذخیره" : "Save"}</button>
        <button className="btn btn-sm btn-danger" onClick={del} style={{ marginInlineStart: "auto" }}><Icon name="close" size={14} /> {fa ? "حذف چک‌لیست" : "Delete checklist"}</button>
      </div>
    </div>
  );
}

/* ---- AI provider form (university + competitive virtual patient) ---- */
const FALLBACK_AI_PROVIDERS = [
  { key: "", label: "— (mock / no key) —", base: "", group: "off", hint: "" },
  { key: "GapGPT", label: "GapGPT (گپ‌جی‌پی‌تی)", base: "https://api.gapgpt.app/v1", group: "iran", hint: "gpt-4o-mini", models: ["gpt-4o-mini", "chatgpt", "gpt-4o", "gemini", "gemini-pro", "gemini-2-flash", "claude"] },
  { key: "AvalAI", label: "AvalAI (اول‌ای‌آی)", base: "https://api.avalai.ir/v1", group: "iran", hint: "gpt-4o-mini", models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1", "gemini-1.5-flash", "gemini-1.5-pro"] },
  { key: "MetisAI", label: "MetisAI (متیس)", base: "https://api.metisai.ir/openai/v1", group: "iran", hint: "gpt-4o-mini", models: ["gpt-4o-mini", "gpt-4o"] },
  { key: "Liara AI", label: "Liara AI (لیارا)", base: "https://ai.liara.ir/api/v1", group: "iran", hint: "openai/gpt-4o-mini", models: ["openai/gpt-4o-mini", "openai/gpt-4o"] },
  { key: "Google", label: "Google (Gemini, OpenAI-compat)", base: "https://generativelanguage.googleapis.com/v1beta/openai", group: "intl", hint: "gemini-1.5-flash", models: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-flash", "gemini-1.5-flash-8b"] },
  { key: "OpenAI", label: "OpenAI", base: "https://api.openai.com/v1", group: "intl", hint: "gpt-4o", models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1"] },
  { key: "OpenRouter", label: "OpenRouter", base: "https://openrouter.ai/api/v1", group: "intl", hint: "openai/gpt-4o-mini" },
  { key: "Groq", label: "Groq", base: "https://api.groq.com/openai/v1", group: "intl", hint: "llama-3.3-70b-versatile" },
  { key: "DeepSeek", label: "DeepSeek", base: "https://api.deepseek.com/v1", group: "intl", hint: "deepseek-chat" },
  { key: "Custom", label: "Custom (set Base URL)", base: "", group: "local", hint: "" },
];
const AI_GROUP_ORDER = ["off", "iran", "intl", "local"];
function aiGroupLabel(group, t) {
  return ({ off: t("aiProvidersOff"), iran: t("aiProvidersIran"), intl: t("aiProvidersIntl"), local: t("aiProvidersLocal") })[group] || group;
}
function normalizeAiProviders(list) {
  const src = Array.isArray(list) && list.length ? list : FALLBACK_AI_PROVIDERS;
  return src.map((p) => ({
    key: p.key ?? "",
    label: p.label || p.key || "—",
    base: p.base || "",
    group: p.group || (p.key === "" ? "off" : "intl"),
    hint: p.hint || (Array.isArray(p.models) ? p.models[0] : "") || "",
    models: Array.isArray(p.models) ? p.models : [],
  }));
}
function applyAiProvider(cfg, providers, key) {
  const p = providers.find((x) => x.key === key);
  const custom = key === "Azure OpenAI" || key === "Custom";
  const defModel = (p && (p.hint || (Array.isArray(p.models) ? p.models[0] : ""))) || (key === "Google" ? "gemini-1.5-flash" : "gpt-4o-mini");
  return { ...cfg, provider: key, baseUrl: p && p.base ? p.base : (custom ? (cfg.baseUrl || "") : ""), model: defModel };
}
function AiProviderSelect({ value, providers, onChange, t, extraOption }) {
  const groups = {};
  for (const p of providers) (groups[p.group] ||= []).push(p);
  const known = new Set(providers.map((p) => p.key));
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {extraOption}
      {value && !known.has(value) && <option value={value}>{value}</option>}
      {AI_GROUP_ORDER.filter((g) => groups[g]?.length).map((g) => (
        <optgroup key={g} label={aiGroupLabel(g, t)}>
          {groups[g].map((p) => <option key={p.key || "mock"} value={p.key}>{p.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

/* ---- AI section: config + prompts in one tab (internal sub-tabs) ---- */
function AiSection() {
  const { t } = useApp();
  const [sub, setSub] = useState("config"); // config | prompts
  return (
    <div>
      <div className="subtabs mb16" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={`btn btn-sm ${sub === "config" ? "btn-primary" : "btn-ghost"}`} onClick={() => setSub("config")}>
          <Icon name="ai" size={15} /> {t("aiConfig")}
        </button>
        <button className={`btn btn-sm ${sub === "prompts" ? "btn-primary" : "btn-ghost"}`} onClick={() => setSub("prompts")}>
          <Icon name="brain" size={15} /> {t("prompts")}
        </button>
      </div>
      {sub === "config" ? <AiConfig /> : <Prompts />}
    </div>
  );
}

/* ---- AI Config ---- */
export function AiConfig() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [cfg, setCfg] = useState(null);
  const [providers, setProviders] = useState(FALLBACK_AI_PROVIDERS);
  const [testMsg, setTestMsg] = useState("");
  const [testDetail, setTestDetail] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [aiLoadErr, setAiLoadErr] = useState("");
  const loadAi = () => {
    setAiLoadErr("");
    api.get("/settings/ai").then(setCfg).catch((e) => { setAiLoadErr(String(e.message || e)); setCfg({ __err: true }); });
    api.get("/exam/ai-providers").then((d) => setProviders(normalizeAiProviders(d))).catch(() => setProviders(FALLBACK_AI_PROVIDERS));
  };
  useEffect(() => { loadAi(); }, []);
  if (cfg?.__err || aiLoadErr) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{aiLoadErr || (fa ? "بارگذاری تنظیمات هوش مصنوعی شکست خورد" : "Could not load AI settings")}</h3><button className="btn btn-ghost mt16" onClick={() => { setCfg(null); loadAi(); }}>{fa ? "تلاش دوباره" : "Retry"}</button></div>;
  if (!cfg) return <Spinner />;
  const editCfg = (update) => {
    setTestMsg(""); setTestDetail(null);
    setCfg((s) => ({ ...(typeof update === "function" ? update(s) : update), connected: false }));
  };
  const set = (k, v) => editCfg((s) => ({ ...s, [k]: v }));
  const onProvider = (key) => editCfg((s) => applyAiProvider(s, providers, key));
  const payload = () => ({ provider: cfg.provider || "", model: cfg.model || "", apiKey: cfg.apiKey || "", baseUrl: cfg.baseUrl || "", routingEnabled: !!cfg.routingEnabled, routes: cfg.routes || [] });
  const save = async (extra = {}) => {
    setSaving(true); setTestMsg(""); setTestDetail(null);
    try { await api.put("/settings/ai", { ...payload(), ...extra }); toast(t("saved")); }
    catch (e) { toast(`${t("aiSaveFailed")}: ${e.message || e}`); }
    finally { setSaving(false); }
  };
  const clearKey = async () => {
    if (!confirm(t("aiClearKeyConfirm"))) return;
    setCfg((s) => ({ ...s, apiKey: "" }));
    await save({ clearApiKey: true, apiKey: "" });
  };
  const test = async () => {
    setTesting(true); setTestMsg(""); setTestDetail(null);
    try {
      await api.put("/settings/ai", payload());
      const r = await api.post("/exam/ai-test", { lang });
      setTestMsg(r.connected ? t("connectionOk") : t("usingMock"));
      setCfg((s) => ({ ...s, connected: r.connected }));
      setTestDetail(r);
    } catch (e) { setTestMsg(String(e.message)); }
    finally { setTesting(false); }
  };
  const selected = providers.find((p) => p.key === (cfg.provider || "")) || null;
  const modelHint = selected?.hint || (selected?.models || [])[0] || "";
  const needsBase = cfg.provider === "Azure OpenAI" || cfg.provider === "Custom";
  return (
    <div className="card">
      <h4 className="mb16"><Icon name="ai" size={16} /> {t("aiConfig")}</h4>
      <div className="micro-box small mb16" style={{ padding: "12px 14px" }}><Icon name="globe" size={15} /> {t("aiIranHint")}</div>
      <fieldset disabled={saving || testing} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <AiRoutesEditor cfg={cfg} onChange={editCfg} providers={providers} fa={fa} />
      <div hidden={!!cfg.routingEnabled}>
      <div className="grid grid-2">
        <div className="field"><label>{t("apiProvider")}</label>
          <AiProviderSelect value={cfg.provider || ""} providers={providers} onChange={onProvider} t={t} /></div>
        <div className="field"><label>{t("apiModel")}</label>
          <input value={cfg.model || ""} onChange={(e) => set("model", e.target.value)} placeholder={modelHint || "gpt-4o-mini"} list="ai-model-hints" />
          {modelHint && <div className="small muted mt8">e.g. {modelHint}{(selected?.models || []).length > 1 ? `  ·  ${(selected.models || []).slice(0, 4).join("  ·  ")}` : ""}</div>}
          <datalist id="ai-model-hints">{(selected?.models || []).map((m) => <option key={m} value={m} />)}</datalist>
        </div>
      </div>
      <div className="field"><label>{t("apiKey")}</label>
        <input dir="ltr" type="password" autoComplete="off" value={cfg.apiKey || ""} onChange={(e) => set("apiKey", e.target.value)} placeholder="sk-… / gap-…" />
        <div className="small muted mt8">{t("aiKeyKept")}</div></div>
      <div className="field"><label>{t("apiBaseUrl")}</label>
        <input value={cfg.baseUrl || ""} onChange={(e) => set("baseUrl", e.target.value)} placeholder={selected?.base || "https://…/v1"} dir="ltr" />
        {needsBase && !String(cfg.baseUrl || "").trim() && <div className="small mt8" style={{ color: "#b45309" }}>{t("aiNeedBaseUrl")}</div>}</div>
      </div>
      </fieldset>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => save()} disabled={saving || testing}>{saving ? "…" : t("save")}</button>
        <button className="btn btn-accent" onClick={test} disabled={testing || saving}>
          {testing ? (fa ? "در حال آزمایش…" : "Testing…") : (fa ? "آزمایش بیمار مجازی با API" : "Test virtual patient with API")}
        </button>
        {!cfg.routingEnabled && !!cfg.apiKey && <button className="btn btn-ghost" onClick={clearKey} disabled={saving || testing}>{t("aiClearKey")}</button>}
        {testMsg && <span className={`pill ${testDetail?.connected ? "pill-active" : "pill-medium"}`}>● {testMsg}</span>}
      </div>
      {/* live sample so the admin SEES the AI working before activating */}
      {testDetail && (
        <div className="card mt16" style={{ background: "var(--panel3, #f7fafd)", borderInlineStart: `4px solid ${testDetail.connected ? "#22a06b" : "#e0a400"}` }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>
            {testDetail.connected
              ? (fa ? "✅ اتصال به API برقرار است — پاسخ زندهٔ بیمار مجازی:" : "✅ Connected to the API — live virtual-patient reply:")
              : (fa ? "⚠️ از موتور آفلاین (mock) استفاده می‌شود:" : "⚠️ Using the offline (mock) engine:")}
          </div>
          {testDetail.connected && (
            <div className="small muted mb8">{fa ? "ارائه‌دهنده:" : "Provider:"} {testDetail.provider || "—"} · {fa ? "مدل:" : "Model:"} {testDetail.model || "—"}</div>
          )}
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", lineHeight: 1.8 }}>
            <span className="small muted">🧑‍⚕️ {fa ? "پزشک: سلام، چه مشکلی دارید؟" : "Doctor: Hello, what brings you in?"}</span><br />
            <span>🤒 {testDetail.sample || testDetail.message || "—"}</span>
          </div>
          {!testDetail.connected && testDetail.message && <div className="small mt8" style={{ color: "#dc2626", fontWeight: 700, lineHeight: 1.6 }}>{fa ? "علت عدم اتصال:" : "Connection issue:"} {testDetail.message}</div>}
        </div>
      )}
      <div className="small muted mt16"><Icon name="bulb" size={16} /> {t("modelAgnostic")}</div>
      <div className="small muted mt8"><Icon name="globe" size={16} /> {t("aiUsageNote")}</div>
    </div>
  );
}

/* ---- Prompts (main admin — full access & editable) ---- */
function Prompts() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [p, setP] = useState(null);
  const toast = useToast();
  const [loadErr, setLoadErr] = useState("");
  const loadP = () => {
    setLoadErr("");
    api.get("/prompts").then(setP).catch((e) => { setLoadErr(String(e.message || e)); setP({ __err: true }); });
  };
  useEffect(() => { loadP(); }, []);
  if (p?.__err || loadErr) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{loadErr || (fa ? "بارگذاری پرامپت‌ها شکست خورد" : "Could not load prompts")}</h3><button className="btn btn-ghost mt16" onClick={() => { setP(null); loadP(); }}>{fa ? "تلاش دوباره" : "Retry"}</button></div>;
  if (!p) return <Spinner />;
  const set = (k, v) => setP((s) => ({ ...s, [k]: v }));
  const save = async () => { await api.put("/prompts", p); toast(t("saved")); };
  return (
    <div className="card">
      <h4 className="mb8"><Icon name="brain" size={16} /> {t("prompts")}</h4>
      <div className="small muted mb8">{t("promptEditNote")}</div>
      <div className="micro-box small mb16" style={{ padding: "12px 14px" }}>{t("promptSafety")}</div>
      <div className="small muted mb8"><Icon name="chat" size={16} /> {t("promptInfoPatient")}</div>
      <div className="field"><label>{t("promptPatient")} (FA)</label>
        <textarea style={{ minHeight: 90 }} value={p.patient_fa || ""} onChange={(e) => set("patient_fa", e.target.value)} /></div>
      <div className="field"><label>{t("promptPatient")} (EN)</label>
        <textarea style={{ minHeight: 90 }} value={p.patient_en || ""} onChange={(e) => set("patient_en", e.target.value)} /></div>
      {/* Operating rules — previously hard-coded inside the engine and NOT editable.
          Now fully admin-controlled. */}
      <div className="micro-box small mb8" style={{ padding: "10px 12px" }}>{t("promptRulesNote")}</div>
      <div className="field"><label>{t("promptPatientRules")} (FA)</label>
        <textarea style={{ minHeight: 70 }} value={p.patient_rules_fa || ""} onChange={(e) => set("patient_rules_fa", e.target.value)} /></div>
      <div className="field"><label>{t("promptPatientRules")} (EN)</label>
        <textarea style={{ minHeight: 70 }} value={p.patient_rules_en || ""} onChange={(e) => set("patient_rules_en", e.target.value)} /></div>

      {/* Supervising teacher — exam findings & auscultation responder */}
      <div className="small muted mb8 mt8"><Icon name="stethoscope" size={15} /> {t("promptInfoExamTeacher")}</div>
      <div className="field"><label>{t("promptExamTeacher")} (FA)</label>
        <textarea style={{ minHeight: 70 }} value={p.exam_teacher_fa || ""} onChange={(e) => set("exam_teacher_fa", e.target.value)} /></div>
      <div className="field"><label>{t("promptExamTeacher")} (EN)</label>
        <textarea style={{ minHeight: 70 }} value={p.exam_teacher_en || ""} onChange={(e) => set("exam_teacher_en", e.target.value)} /></div>

      {/* Lab / radiology reporter */}
      <div className="small muted mb8 mt8"><Icon name="flask" size={16} /> {t("promptInfoLab")}</div>
      <div className="field"><label>{t("promptLabRules")} (FA)</label>
        <textarea style={{ minHeight: 60 }} value={p.labresult_rules_fa || ""} onChange={(e) => set("labresult_rules_fa", e.target.value)} /></div>
      <div className="field"><label>{t("promptLabRules")} (EN)</label>
        <textarea style={{ minHeight: 60 }} value={p.labresult_rules_en || ""} onChange={(e) => set("labresult_rules_en", e.target.value)} /></div>
      <div className="field"><label>{t("promptLabNormal")} (FA) <span className="small muted">— {t("promptLabNormalHint")}</span></label>
        <input value={p.lab_normal_fa || ""} onChange={(e) => set("lab_normal_fa", e.target.value)} /></div>
      <div className="field"><label>{t("promptLabNormal")} (EN)</label>
        <input value={p.lab_normal_en || ""} onChange={(e) => set("lab_normal_en", e.target.value)} /></div>

      <div className="small muted mb8 mt8"><Icon name="brain" size={16} /> {t("promptInfoEval")}</div>
      <div className="field"><label>{t("promptEvaluator")} (FA)</label>
        <textarea style={{ minHeight: 90 }} value={p.evaluator_fa || ""} onChange={(e) => set("evaluator_fa", e.target.value)} /></div>
      <div className="field"><label>{t("promptEvaluator")} (EN)</label>
        <textarea style={{ minHeight: 90 }} value={p.evaluator_en || ""} onChange={(e) => set("evaluator_en", e.target.value)} /></div>
      <div className="field"><label>{t("promptMicro")} (FA)</label>
        <textarea style={{ minHeight: 90 }} value={p.micro_fa || ""} onChange={(e) => set("micro_fa", e.target.value)} /></div>
      <div className="field"><label>{t("promptMicro")} (EN)</label>
        <textarea style={{ minHeight: 90 }} value={p.micro_en || ""} onChange={(e) => set("micro_en", e.target.value)} /></div>
      <button className="btn btn-primary" onClick={save}>{t("save")}</button>
    </div>
  );
}

/* ---- Reports ---- */
function Reports() {
  const { t, lang } = useApp();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    api.get("/reports/attempts?research=1").then((d) => setRows(Array.isArray(d) ? d : [])).catch((e) => { setLoadErr(String(e.message || e)); setRows({ __err: true }); });
  };
  useEffect(() => { load(); }, []);
  if (rows?.__err || loadErr) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{loadErr || (lang === "fa" ? "بارگذاری گزارش پژوهشی شکست خورد" : "Could not load research reports")}</h3><button className="btn btn-ghost mt16" onClick={() => { setRows(null); load(); }}>{lang === "fa" ? "تلاش دوباره" : "Retry"}</button></div>;
  if (!rows) return <Spinner />;
  const exportCsv = async () => {
    const res = await fetch("/api/reports/export.csv?research=1", { credentials: "same-origin", headers: { Authorization: `Bearer ${getToken()}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "research_data.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const del = async (id) => {
    if (!confirm(t("confirmDelete"))) return;
    await api.del(`/reports/attempts/${id}`); toast(t("deleted") || t("saved")); load();
  };
  return (
    <div className="card">
      <div className="section-title"><h4><Icon name="chart" size={16} /> {t("reports")}</h4>
        <button className="btn btn-accent btn-sm" onClick={exportCsv}><Icon name="download" size={16} /> {t("exportResearchCsv")}</button></div>
      <div className="small muted mb16"><Icon name="flask" size={16} /> {t("researchNote")}</div>
      <div className="table-wrap"><table><thead><tr>
        <th>{t("name")}</th><th>{t("caseTitle")}</th><th>Type</th><th>{t("finalScore")}</th>
        <th>Turns</th><th>Tests</th><th>{t("hintsUsed")}</th><th>{t("version")}</th><th>Date</th><th></th></tr></thead>
        <tbody>{rows.map((a) => (
          <tr key={a.id}>
            <td>{lang === "fa" ? a.student_fa : a.student_en}</td>
            <td>{lang === "fa" ? a.case_fa : a.case_en}</td>
            <td>{a.type === "vp" ? <Icon name="patient" size={16} /> : <Icon name="flask" size={16} />}</td>
            <td><b>{a.score}</b></td><td>{a.turns}</td><td>{a.tests}</td><td>{a.hints}</td>
            <td>{a.content_version}</td><td>{fmtDateTime(a.created_at, lang)}</td>
            <td style={{ textAlign: "end" }}><button className="btn btn-sm btn-danger" onClick={() => del(a.id)}>{t("delete")}</button></td>
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={10} className="small muted center" style={{ padding: 18 }}>{lang === "fa" ? "فقط داده‌های کلاس/آزمون‌هایی که به پژوهش وصل شده‌اند اینجا می‌آید." : "Only attempts from research-linked classes/exams appear here."}</td></tr>}
        </tbody></table></div>
    </div>
  );
}

/* ================= CLASSROOMS (admin) ================= */
function Classes() {
  const { t, lang } = useApp();
  const [classes, setClasses] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    api.get("/classes").then((d) => setClasses(Array.isArray(d) ? d : [])).catch((e) => { setClasses([]); setLoadErr(String(e.message || e)); });
  };
  useEffect(() => { load(); }, []);
  if (!classes) return <Spinner />;

  if (openId) return <ClassManage classId={openId} back={() => { setOpenId(null); load(); }} />;

  const del = async (id) => { if (confirm(t("confirmDelete"))) { await api.del(`/classes/${id}`); load(); } };
  const save = async (data, id) => {
    if (id) await api.put(`/classes/${id}`, data);
    else { const r = await api.post("/classes", data); toast(`${t("classCode")}: ${r.code}`); }
    setEditing(null); load();
  };

  return (
    <div className="card">
      <div className="section-title"><h4><Icon name="class" size={16} /> {t("classes")}</h4>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>+ {t("newClass")}</button></div>
      {loadErr && <div className="err-banner mb8">{loadErr} <button className="btn btn-ghost btn-sm" onClick={load}>{lang === "fa" ? "تلاش دوباره" : "Retry"}</button></div>}
      <div className="table-wrap"><table>
        <thead><tr><th>{t("className")}</th><th>{t("classCode")}</th><th>{t("casesCount")}</th><th>{t("students")}</th><th></th></tr></thead>
        <tbody>{classes.map((c) => (
          <tr key={c.id}>
            <td>{biField(c, "name", lang)}</td>
            <td><span className="tag">{c.code}</span></td>
            <td>{c.nCases}</td><td>{c.nStudents}</td>
            <td style={{ textAlign: "end", whiteSpace: "nowrap" }}>
              <button className="btn btn-sm btn-primary" onClick={() => setOpenId(c.id)}>{t("classSettings")}</button>
              <button className="btn btn-sm btn-danger" onClick={() => del(c.id)}>{t("delete")}</button>
            </td>
          </tr>
        ))}</tbody></table></div>
      {editing && <ClassModal cls={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function ClassStudyField({ value, onChange }) {
  const { lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [studies, setStudies] = useState([]);
  const [studiesErr, setStudiesErr] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title_fa: "", ethics_code: "", consent_text_fa: "", consent_required: true });
  const load = () => {
    setStudiesErr("");
    api.get("/research/studies").then((d) => setStudies(d.studies || [])).catch((e) => { setStudies([]); setStudiesErr(String(e.message || e)); });
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!String(draft.title_fa || "").trim()) { toast(fa ? "عنوان پژوهش را بنویسید." : "Enter a study title."); return; }
    try {
      const title = String(draft.title_fa).trim();
      const s = await api.post("/research/studies", {
        title_fa: title, title_en: title, domain: "education",
        active: true, consent_required: !!draft.consent_required,
        ethics_code: String(draft.ethics_code || "").trim(),
        protocol_version: "v1",
        consent_text_fa: String(draft.consent_text_fa || "").trim(),
        consent_text_en: String(draft.consent_text_fa || "").trim(),
        consent_modes: ["online"],
      });
      await load();
      onChange(s.id);
      setCreating(false);
      setDraft({ title_fa: "", ethics_code: "", consent_text_fa: "", consent_required: true });
      toast(fa ? "پژوهش ساخته و به کلاس وصل شد." : "Study created and linked to the class.");
    } catch (e) { toast(e.message || "error"); }
  };
  const selected = studies.find((st) => String(st.id) === String(value));
  return (
    <div className="field" style={{ marginTop: 10 }}>
      <label><Icon name="book" size={14} /> {fa ? "پژوهش مرتبط (اختیاری)" : "Research study (optional)"}</label>
      {studiesErr && <div className="err small mb8">{studiesErr}</div>}
      <select value={value || ""} onChange={(e) => onChange(e.target.value === "" ? "" : +e.target.value)}>
        <option value="">{fa ? "— بدون پژوهش —" : "— none —"}</option>
        {studies.map((st) => (
          <option key={st.id} value={st.id}>
            {st.title_fa || st.title_en}{st.active ? "" : (fa ? " · خاموش" : " · off")}
          </option>
        ))}
      </select>
      {selected && !selected.active && (
        <div className="err-banner mt8" style={{ fontSize: ".85rem" }}>
          {fa ? "این پژوهش خاموش است؛ رویداد پژوهشی ثبت نمی‌شود تا آن را در تب پژوهش فعال کنید." : "This study is inactive; research events will not be stored until you activate it."}
        </div>
      )}
      {selected && selected.consent_admin_managed === false && selected.consent_required && !(selected.consent_text_fa || selected.consent_text_en) && (
        <div className="err-banner mt8" style={{ fontSize: ".85rem" }}>
          {fa ? "نیاز به رضایت روشن است ولی متن رضایت‌نامه خالی است — دانشجو نمی‌تواند وارد شود تا متن را در تب پژوهش بنویسید." : "Consent is required but no wording is saved — students cannot enter until you add the consent text."}
        </div>
      )}
      <div className="small muted mt4">
        {fa ? "اگر پژوهش نیاز به رضایت داشته باشد، دانشجو پیش از ورود به بیمار مجازی باید رضایت بدهد. اگر فهرستی نیست، از دکمهٔ زیر یک پژوهش بسازید." : "If the study requires consent, students must agree before the virtual patient. If the list is empty, create a study below."}
      </div>
      {!creating ? (
        <button type="button" className="btn btn-ghost btn-sm mt8" onClick={() => setCreating(true)}>
          + {fa ? "ساخت پژوهش جدید و اتصال به این کلاس" : "Create a new study and link it"}
        </button>
      ) : (
        <div className="card mt8" style={{ background: "var(--panel2)" }}>
          <div className="field"><label>{fa ? "عنوان پژوهش" : "Study title"}</label>
            <input value={draft.title_fa} onChange={(e) => setDraft((d) => ({ ...d, title_fa: e.target.value }))} /></div>
          <div className="field"><label>{fa ? "کد اخلاق (اختیاری)" : "Ethics code (optional)"}</label>
            <input value={draft.ethics_code} onChange={(e) => setDraft((d) => ({ ...d, ethics_code: e.target.value }))} placeholder="IR.…REC.…" /></div>
          <div className="field"><label>{fa ? "متن رضایت‌نامه" : "Consent wording"}</label>
            <textarea rows={3} value={draft.consent_text_fa} onChange={(e) => setDraft((d) => ({ ...d, consent_text_fa: e.target.value }))} /></div>
          <label className="toggle-row">
            <span>{fa ? "نیاز به رضایت دانشجو" : "Require student consent"}</span>
            <input type="checkbox" checked={!!draft.consent_required} onChange={(e) => setDraft((d) => ({ ...d, consent_required: e.target.checked }))} />
          </label>
          <div className="row gap8 mt8">
            <button type="button" className="btn btn-primary btn-sm" onClick={create}>{fa ? "ساخت و اتصال" : "Create & link"}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>{fa ? "انصراف" : "Cancel"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ClassModal({ cls, onClose, onSave }) {
  const { t, lang } = useApp();
  const inherited = cls.gradingRubric || (cls.grading_json ? (() => { try { return JSON.parse(cls.grading_json); } catch { return null; } })() : null);
  const [f, setF] = useState(() => {
    const logDefault = cls.id ? !!cls.log_transcript : true;
    return {
      name_fa: cls.name_fa || "", name_en: cls.name_en || "",
      desc_fa: cls.desc_fa || "", desc_en: cls.desc_en || "",
      maxAttempts: cls.maxAttempts || cls.max_attempts || 1,
      gradingRole: cls.grading_role || "both",
      historyForm: cls.history_form || "general",
      logTranscript: logDefault,
      studyId: cls.study_id || cls.studyId || "",
      useCustomRubric: !!inherited,
      gradingRubric: mergeRubric(inherited),
    };
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Modal title={cls.id ? t("edit") : t("newClass")} onClose={onClose} onSave={() => onSave({ ...f, logTranscript: !!f.logTranscript, studyId: f.studyId === "" ? null : +f.studyId, gradingRubric: f.useCustomRubric ? f.gradingRubric : null }, cls.id)}>
      <div className="grid grid-2">
        <div className="field"><label>{t("className")} (FA)</label><input value={f.name_fa} onChange={(e) => set("name_fa", e.target.value)} /></div>
        <div className="field"><label>{t("className")} (EN)</label><input value={f.name_en} onChange={(e) => set("name_en", e.target.value)} /></div>
      </div>
      <div className="field"><label>{t("classDesc")} (FA)</label><textarea value={f.desc_fa} onChange={(e) => set("desc_fa", e.target.value)} /></div>
      <div className="field"><label>{t("classDesc")} (EN)</label><textarea value={f.desc_en} onChange={(e) => set("desc_en", e.target.value)} /></div>
      <div className="grid grid-2">
        <div className="field"><label>{t("maxAttemptsField")}</label>
          <input type="number" min="1" value={f.maxAttempts} onChange={(e) => set("maxAttempts", +e.target.value || 1)} /></div>
        <div className="field"><label>{t("gradingCriterion")}</label>
          <select value={f.gradingRole || "both"} onChange={(e) => set("gradingRole", e.target.value)}>
            <option value="both">{t("gradeBoth")}</option>
            <option value="history">{t("gradeExtern")}</option>
            <option value="overall">{t("gradeIntern")}</option>
          </select>
          <div className="small muted mt4">{lang === "fa"
            ? "ملاک نمرهٔ نهایی بیمار مجازی در این کلاس: اکسترن یا اینترن. جزئیات بخش‌ها و وزن‌ها را پایین‌تر می‌توانید سفارشی کنید."
            : "Final virtual-patient score for this class: extern or intern. Customise which sections count — and their weights — below."}</div>
        </div>
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label className="toggle-row">
          <span><Icon name="target" size={14} /> {t("vpGradingOverride")}</span>
          <input type="checkbox" checked={!!f.useCustomRubric} onChange={(e) => set("useCustomRubric", e.target.checked)} />
        </label>
        <div className="small muted mt4">{t("vpGradingInherit")}</div>
        {!!f.useCustomRubric && (
          <div className="mt8"><VpGradingRubric value={f.gradingRubric} onChange={(r) => set("gradingRubric", r)} /></div>
        )}
      </div>
      <div className="field"><label><Icon name="patient" size={14} /> {t("classHistoryForm")}</label>
        <select value={f.historyForm || "general"} onChange={(e) => set("historyForm", e.target.value)}>
          <option value="general">{t("formGeneral")}</option>
          <option value="internal">{t("formInternal")}</option>
          <option value="obgyn">{t("formObgyn")}</option>
          <option value="cardio">{t("formCardio")}</option>
          <option value="peds">{t("formPeds")}</option>
          <option value="psych">{t("formPsych")}</option>
        </select>
        <div className="small muted mt4">{lang === "fa" ? "برچسب/دستهٔ فرم شرح‌حال این کلاس (برای سازماندهی). نمره‌دهی بر اساس فرمِ خودِ کیس است." : "History-form label for this class (organization). Scoring uses each case's own form."}</div>
      </div>

      <div className="field" style={{ marginTop: 8 }}>
        <label className="toggle-row">
          <span><Icon name="chat" size={14} /> {lang === "fa" ? "ثبت گفت‌وگوها برای بازبینی استاد" : "Record conversations for teacher review"}</span>
          <input type="checkbox" checked={!!f.logTranscript} onChange={(e) => set("logTranscript", e.target.checked)} />
        </label>
        <div className="small muted mt4">
          {lang === "fa"
            ? "پیش‌فرض روشن است. متن گفت‌وگو، پاسخ بیمار و استاد مجازی، درخواست‌ها و درسنامه ذخیره می‌شود تا در «گفتگوهای ذخیره‌شده» ببینید."
            : "On by default. The chat, virtual patient, supervising teacher, orders and microlearning are stored under Saved conversations."}
        </div>
        <ClassStudyField value={f.studyId} onChange={(id) => set("studyId", id)} />
      </div>
    </Modal>
  );
}

/* Full class SETTINGS view: basic info, virtual-patient cases, flashcard sets
   (graded or practice), and enrolled students. The gradebook/results moved to
   its own "نتایج و کارنامه" tab. */
/* ================================================================
   ClassProgress — the professor's view of every student in one class.
   The protocol requires the supervisor to see each student's progress
   profile (radar + line) and to hand a remedial scenario to anyone
   scoring below 6/10.
   ================================================================ */
function ClassProgress({ classId, cases = [] }) {
  const { lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [d, setD] = useState(null);
  const [pick, setPick] = useState(null);       // student whose profile is open
  const [remCase, setRemCase] = useState("");
  const [busy, setBusy] = useState(false);

  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    api.get(`/classes/${classId}/progress`).then((x) => { setD(x); }).catch((e) => { setLoadErr(String(e.message || e)); setD({ __err: true }); });
  };
  useEffect(() => { load(); }, [classId]);
  if (d?.__err || loadErr) return <div className="card mb16"><div className="err-banner">{loadErr || (fa ? "بارگذاری پیشرفت شکست خورد" : "Could not load progress")}<button className="btn btn-ghost btn-sm" onClick={() => { setD(null); load(); }}>{fa ? "تلاش دوباره" : "Retry"}</button></div></div>;
  if (!d) return <div className="card mb16"><div className="skeleton" style={{ height: 80 }} /></div>;

  const assignRemedial = async (userIds) => {
    if (!remCase) { toast(fa ? "اول سناریوی جبرانی را انتخاب کنید." : "Pick a remedial scenario first."); return; }
    setBusy(true);
    try {
      const r = await api.post(`/classes/${classId}/remedial`, { caseId: +remCase, ...(userIds ? { userIds } : {}) });
      toast(fa ? `${r.assigned} دانشجو سناریوی جبرانی گرفت.` : `${r.assigned} student(s) assigned a remedial scenario.`);
      load();
    } catch (e) { toast(e?.message || String(e)); }
    finally { setBusy(false); }
  };

  const row = pick ? d.students.find((x) => x.userId === pick) : null;
  const low = d.students.filter((x) => x.needsRemedial);

  return (
    <div className="card mb16">
      <div className="section-title" style={{ marginBottom: 10 }}>
        <h4><Icon name="chart" size={15} /> {fa ? "پیشرفت دانشجویان" : "Student progress"}</h4>
        <span className="tag">{fa ? `آستانهٔ جبرانی: ${d.threshold} از ۱۰` : `Remedial below ${d.threshold}/10`}</span>
      </div>

      <div className="row gap8 mb12" style={{ flexWrap: "wrap" }}>
        <span className="tag">{fa ? "دانشجویان" : "Students"}: {d.totals.students}</span>
        <span className="tag">{fa ? "شروع نکرده" : "Not started"}: {d.totals.notStarted}</span>
        <span className="tag">{fa ? "میانگین" : "Mean"}: {d.totals.mean ?? "—"}</span>
        {d.totals.needsRemedial > 0 && (
          <span className="tag" style={{ background: "var(--bad,#c0392b)", color: "#fff" }}>
            {fa ? `${d.totals.needsRemedial} نیاز به جبرانی` : `${d.totals.needsRemedial} need remedial`}
          </span>
        )}
      </div>

      <DataTable rows={d.students} columns={[
        { key: "studentNo", label: fa ? "شمارهٔ دانشجویی" : "Student no." },
        { key: "name", label: fa ? "نام" : "Name" },
        { key: "attempts", label: fa ? "تلاش‌ها" : "Attempts" },
        { key: "latest", label: fa ? "آخرین نمره (از ۱۰)" : "Latest /10" },
        { key: "best", label: fa ? "بهترین" : "Best" },
        { key: "needsRemedial", label: fa ? "جبرانی" : "Remedial",
          render: (x) => x.needsRemedial
            ? <span className="tag" style={{ background: "var(--bad,#c0392b)", color: "#fff" }}>{fa ? "بله" : "yes"}</span>
            : <span className="small muted">—</span> },
        { key: "actions", label: "", sortable: false, render: (x) => (
          <button className="btn btn-ghost btn-sm" onClick={() => setPick(pick === x.userId ? null : x.userId)}>
            {fa ? "نمایش پروفایل" : "Profile"}
          </button>) },
      ]} />

      {/* Remedial assignment for everyone below the threshold. */}
      <div className="row gap8 mt12" style={{ flexWrap: "wrap", alignItems: "center" }}>
        <select value={remCase} onChange={(e) => setRemCase(e.target.value)} style={{ minWidth: 200 }}>
          <option value="">{fa ? "— سناریوی جبرانی —" : "— remedial scenario —"}</option>
          {cases.map((c) => <option key={c.id} value={c.id}>{c.title_fa || c.title_en || `#${c.id}`}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => assignRemedial(null)} disabled={busy || !low.length}>
          {fa ? `انتساب جبرانی به ${low.length} دانشجو` : `Assign remedial to ${low.length}`}
        </button>
        {!low.length && <span className="small muted">{fa ? "هیچ دانشجویی زیر آستانه نیست." : "Nobody is below the threshold."}</span>}
      </div>

      {/* One student's radar + line. */}
      {row && (
        <div className="card mt12" style={{ background: "var(--panel2)" }}>
          <div className="section-title" style={{ marginBottom: 8 }}>
            <h4>{row.name} <span className="tag">{row.studentNo}</span></h4>
            {row.needsRemedial && (
              <button className="btn btn-ghost btn-sm" onClick={() => assignRemedial([row.userId])} disabled={busy}>
                {fa ? "جبرانی برای همین دانشجو" : "Remedial for this student"}
              </button>
            )}
          </div>
          <div className="grid grid-2">
            <div>
              <div className="small muted mb4">{fa ? "روند نمره (از ۱۰)" : "Score trend (/10)"}</div>
              <LineChart values={row.line.map((p2) => p2.score10)} />
            </div>
            <div>
              <div className="small muted mb4">{fa ? "نرخ انجام هر معیار چک‌لیست" : "Checklist criterion pass rate"}</div>
              <RadarChart data={row.radar} size={220} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClassManage({ classId, back }) {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [data, setData] = useState(null);
  const [allCases, setAllCases] = useState([]);
  const [allFlash, setAllFlash] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [editCases, setEditCases] = useState(false);
  const [editFlash, setEditFlash] = useState(false);
  const [editMembers, setEditMembers] = useState(false);
  const [info, setInfo] = useState(null);   // basic-info form
  const toast = useToast();
  const [loadErr, setLoadErr] = useState("");
  const [bankErr, setBankErr] = useState("");
  const load = () => {
    setLoadErr("");
    api.get(`/classes/${classId}`).then((d) => { setData(d); setInfo({
    name_fa: d.class.name_fa || "", name_en: d.class.name_en || "",
    desc_fa: d.class.desc_fa || "", desc_en: d.class.desc_en || "", maxAttempts: d.class.max_attempts ?? 1,
    liveBoardEnabled: d.class.live_board_enabled !== 0, liveBoardAnonymous: !!d.class.live_board_anonymous,
    logTranscript: !!d.class.log_transcript,
    studyId: d.class.study_id || "",
    gradingRole: d.class.grading_role || "both",
    useCustomRubric: !!d.class.gradingRubric,
    gradingRubric: mergeRubric(d.class.gradingRubric),
    // Tri-state class feature overrides: "inherit" follows university → global.
    flashNoPenalty: d.class.flash_no_penalty == null ? "inherit" : (d.class.flash_no_penalty ? "on" : "off"),
    liveBoardSpeed: d.class.live_board_speed == null ? "inherit" : (d.class.live_board_speed ? "on" : "off"),
    effNoPenalty: !!d.class.flashNoPenalty,
    effLiveSpeed: !!d.class.liveBoardSpeed,
  }); }).catch((e) => setLoadErr(String(e.message || e)));
  };
  useEffect(() => {
    load();
    setBankErr("");
    api.get("/cases").then((d) => setAllCases(Array.isArray(d) ? d : [])).catch((e) => { setAllCases([]); setBankErr(String(e.message || e)); });
    api.get("/flashcards").then((d) => setAllFlash(Array.isArray(d) ? d : [])).catch((e) => { setAllFlash([]); setBankErr(String(e.message || e)); });
    api.get("/users").then((u) => setAllStudents((Array.isArray(u) ? u : []).filter((x) => x.role === "student"))).catch((e) => { setAllStudents([]); setBankErr(String(e.message || e)); });
  }, [classId]);
  if (loadErr) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{loadErr}</h3><button className="btn btn-ghost mt16" onClick={() => { setData(null); setInfo(null); load(); }}>{fa ? "تلاش دوباره" : "Retry"}</button> <button className="btn btn-ghost mt16" onClick={back}>{fa ? "بازگشت" : "Back"}</button></div>;
  if (!data || !info) return <Spinner />;
  const { class: cl, cases, flashcards = [], members } = data;
  const setF = (k, v) => setInfo((s) => ({ ...s, [k]: v }));
  const saveInfo = async () => { await api.put(`/classes/${classId}`, { ...info, gradingRubric: info.useCustomRubric ? info.gradingRubric : null }); toast(t("saved")); load(); };

  return (
    <div className="card">
      <div className="section-title">
        <h4><Icon name="settings" size={16} /> {t("classSettings")} — {biField(cl, "name", lang)} <span className="tag">{cl.code}</span></h4>
        <button className="btn btn-ghost btn-sm" onClick={back}>← {t("back")}</button>
      </div>
      {bankErr && <div className="err-banner mb8">{bankErr}</div>}

      {/* Basic info */}
      <div className="card mb16" style={{ background: "var(--panel2)" }}>
        <div className="section-title" style={{ marginBottom: 10 }}>
          <h4><Icon name="edit" size={15} /> {t("classInfo")}</h4>
          {/* Export every logged conversation in this class. Only meaningful
              when logging is on; the server answers 409 otherwise. */}
          <a className="btn btn-ghost btn-sm" href={`/api/classes/${classId}/conversation-log.csv?lang=${lang}`}
               onClick={async (e) => {
                 e.preventDefault();
                 const r = await fetch(`/api/classes/${classId}/conversation-log.csv?lang=${lang}`,
                   { credentials: "same-origin", headers: { Authorization: `Bearer ${getToken()}` } });
                 if (r.status === 409) { toast(fa ? "هیچ گفت‌وگوی ثبت‌شده‌ای برای خروجی وجود ندارد." : "No recorded conversations to export."); return; }
                 if (!r.ok) { toast(fa ? "خروجی گفت‌وگو در دسترس نیست." : "Conversation log is not available."); return; }
                 const blob = await r.blob();
                 const a = document.createElement("a");
                 a.href = URL.createObjectURL(blob); a.download = `conversation-log-${cl.code || classId}.csv`; a.click();
                 URL.revokeObjectURL(a.href);
               }}>
              <Icon name="download" size={14} /> {fa ? "خروجی گفت‌وگوها (CSV)" : "Conversation log (CSV)"}
            </a>
        </div>
        <div className="grid grid-2">
          <div className="field"><label>{t("className")} (FA)</label><input value={info.name_fa} onChange={(e) => setF("name_fa", e.target.value)} /></div>
          <div className="field"><label>{t("className")} (EN)</label><input value={info.name_en} onChange={(e) => setF("name_en", e.target.value)} /></div>
        </div>
        <div className="grid grid-2">
          <div className="field"><label>{t("classDesc")} (FA)</label><textarea value={info.desc_fa} onChange={(e) => setF("desc_fa", e.target.value)} /></div>
          <div className="field"><label>{t("classDesc")} (EN)</label><textarea value={info.desc_en} onChange={(e) => setF("desc_en", e.target.value)} /></div>
        </div>
        <ClassStudyField value={info.studyId} onChange={(id) => setF("studyId", id)} />
        <div className="field" style={{ marginTop: 10 }}>
          <label className="toggle-row">
            <span><Icon name="chat" size={14} /> {fa ? "ثبت گفت‌وگوهای بیمار مجازی این کلاس" : "Record this class's virtual-patient conversations"}</span>
            <input type="checkbox" checked={!!info.logTranscript} onChange={(e) => setF("logTranscript", e.target.checked)} />
          </label>
          <div className="small muted mt4">
            {fa
              ? "روشن = متن کامل گفت‌وگو (بیمار، استاد مجازی، دانشجو)، درخواست‌ها و درسنامه در «گفتگوهای ذخیره‌شده» می‌ماند."
              : "On = full chat (patient, supervising teacher, student), orders and microlearning stay in Saved conversations."}
          </div>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>{t("gradingCriterion")}</label>
          <select value={info.gradingRole || "both"} onChange={(e) => setF("gradingRole", e.target.value)}>
            <option value="both">{t("gradeBoth")}</option>
            <option value="history">{t("gradeExtern")}</option>
            <option value="overall">{t("gradeIntern")}</option>
          </select>
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label className="toggle-row">
            <span><Icon name="target" size={14} /> {t("vpGradingOverride")}</span>
            <input type="checkbox" checked={!!info.useCustomRubric} onChange={(e) => setF("useCustomRubric", e.target.checked)} />
          </label>
          {!!info.useCustomRubric && (
            <div className="mt8"><VpGradingRubric value={info.gradingRubric} onChange={(r) => setF("gradingRubric", r)} /></div>
          )}
        </div>
        <div className="grid grid-2" style={{ alignItems: "end" }}>
          <div className="field"><label>{t("maxAttemptsField")}</label>
            <input type="number" min="1" value={info.maxAttempts} onChange={(e) => setF("maxAttempts", +e.target.value || 1)} /></div>
          <div className="field"><button className="btn btn-primary" onClick={saveInfo}>{t("save")}</button></div>
        </div>
        <div className="grid grid-2">
          <label className="toggle-row"><span>{lang === "fa" ? "صفحه زنده رقابت کلاس" : "Live classroom competition board"}</span><input type="checkbox" checked={!!info.liveBoardEnabled} onChange={(e)=>setF("liveBoardEnabled", e.target.checked)} /></label>
          <label className="toggle-row"><span>{lang === "fa" ? "نمایش ناشناس روی تخته" : "Anonymous board display"}</span><input type="checkbox" checked={!!info.liveBoardAnonymous} onChange={(e)=>setF("liveBoardAnonymous", e.target.checked)} /></label>
        </div>
        <div className="grid grid-2" style={{ marginTop: 10 }}>
          <div className="field">
            <label>🎯 {lang === "fa" ? "فلش‌کارت بدون کسر نمره (راهنما / پاسخ غلط مرحله‌ای)" : "No-penalty flashcards (hints / wrong stage answers)"}</label>
            <select value={info.flashNoPenalty} onChange={(e) => setF("flashNoPenalty", e.target.value)}>
              <option value="inherit">{lang === "fa" ? "پیروی از دانشگاه/پیش‌فرض" : "Inherit (university / global)"}</option>
              <option value="on">{lang === "fa" ? "فعال — هینت و خطا نمره کم نمی‌کند" : "On — hints & mistakes never deduct"}</option>
              <option value="off">{lang === "fa" ? "غیرفعال — هینت و خطا نمره کم می‌کند" : "Off — hints & mistakes deduct"}</option>
            </select>
            <div className="small muted mt4">
              {lang === "fa"
                ? `وضعیت مؤثر فعلی: ${info.effNoPenalty ? "«فعال»" : "«غیرفعال»"} ${info.flashNoPenalty === "inherit" ? "(از دانشگاه/پیش‌فرض به ارث رسیده)" : "(تنظیم همین کلاس)"}`
                : `Currently effective: ${info.effNoPenalty ? "ON" : "OFF"} ${info.flashNoPenalty === "inherit" ? "(inherited)" : "(this class)"}`}
            </div>
          </div>
          <div className="field">
            <label>⏱ {lang === "fa" ? "در تخته رقابت، با نمره برابر کسی جلوتر است که زمان کمتری گذاشته" : "Leaderboard tie-break: less total time wins"}</label>
            <select value={info.liveBoardSpeed} onChange={(e) => setF("liveBoardSpeed", e.target.value)}>
              <option value="inherit">{lang === "fa" ? "پیروی از دانشگاه/پیش‌فرض" : "Inherit (university / global)"}</option>
              <option value="on">{lang === "fa" ? "فعال — زمان کمتر در تساوی جلو" : "On — less time wins ties"}</option>
              <option value="off">{lang === "fa" ? "غیرفعال — مرتب‌سازی عادی" : "Off — default ordering"}</option>
            </select>
            <div className="small muted mt4">
              {lang === "fa"
                ? `وضعیت مؤثر فعلی: ${info.effLiveSpeed ? "«فعال»" : "«غیرفعال»"} ${info.liveBoardSpeed === "inherit" ? "(از دانشگاه/پیش‌فرض به ارث رسیده)" : "(تنظیم همین کلاس)"}`
                : `Currently effective: ${info.effLiveSpeed ? "ON" : "OFF"} ${info.liveBoardSpeed === "inherit" ? "(inherited)" : "(this class)"}`}
            </div>
          </div>
        </div>
      </div>

      <ClassProgress classId={classId} cases={allCases} />

      {/* Content: cases + flashcards + members */}
      <div className="grid grid-3 mb16">
        <div className="card" style={{ background: "var(--panel2)" }}>
          <div className="section-title"><h4><Icon name="patient" size={16} /> {t("classCases")}</h4>
            <button className="btn btn-sm btn-primary" onClick={() => {
              if (bankErr) { toast(fa ? "بانک کیس بارگذاری نشد." : "Could not load the case bank."); return; }
              setEditCases(true);
            }}>{t("manage")}</button></div>
          {cases.length ? cases.map((c) => (
            <div className="info-row" key={c.case_id}><span>{biField(c, "title", lang)}</span><span className="tag">{t("weightField")} {c.weight}</span></div>
          )) : <div className="small muted">{t("classNoCases")}</div>}
        </div>
        <div className="card" style={{ background: "var(--panel2)" }}>
          <div className="section-title"><h4><Icon name="flask" size={16} /> {t("classFlashcards")}</h4>
            <button className="btn btn-sm btn-primary" onClick={() => setEditFlash(true)}>{t("manage")}</button></div>
          {flashcards.length ? flashcards.map((f) => (
            <div className="info-row" key={f.flashcard_id}><span>{biField(f, "title", lang) || `#${f.flashcard_id}`}</span>
              <span className={`tag ${f.graded ? "" : "muted"}`}>{f.graded ? `${t("gradedShort")} · ${t("weightField")} ${f.weight}` : t("practiceShort")}</span></div>
          )) : <div className="small muted">{t("classNoFlashcards")}</div>}
        </div>
        <div className="card" style={{ background: "var(--panel2)" }}>
          <div className="section-title"><h4><Icon name="users" size={16} /> {t("classMembers")}</h4>
            <button className="btn btn-sm btn-primary" onClick={() => setEditMembers(true)}>{t("manage")}</button></div>
          <div className="small muted">{members.length} {t("students")}</div>
        </div>
      </div>

      <div className="small muted">{t("classSettingsHint")}</div>

      {editCases && <PickModal title={t("selectCases")} items={allCases}
        labelFn={(c) => biField(c, "title", lang)} idFn={(c) => c.id}
        selected={cases.map((c) => c.case_id)} withWeight
        initialWeights={Object.fromEntries(cases.map((c) => [c.case_id, c.weight]))}
        onClose={() => setEditCases(false)}
        onSave={async (ids, weights) => {
          await api.put(`/classes/${classId}/cases`, { cases: ids.map((id) => ({ case_id: id, weight: weights[id] || 1 })) });
          setEditCases(false); toast(t("saved")); load();
        }} />}
      {editFlash && <FlashPickModal items={allFlash}
        selected={flashcards} lang={lang}
        onClose={() => setEditFlash(false)}
        onSave={async (rows) => {
          await api.put(`/classes/${classId}/flashcards`, { flashcards: rows });
          setEditFlash(false); toast(t("saved")); load();
        }} />}
      {editMembers && <MemberManageModal classId={classId} items={allStudents} selected={members.map((m) => m.id)} lang={lang}
        onClose={() => setEditMembers(false)}
        onSaved={() => { setEditMembers(false); toast(t("saved")); load(); }} />}
    </div>
  );
}

/* Flashcard picker with per-set graded/practice + weight (teacher choice). */
function FlashPickModal({ items, selected, lang, onClose, onSave }) {
  const { t } = useApp();
  const init = Object.fromEntries((selected || []).map((f) => [f.flashcard_id, { on: true, graded: !!f.graded, weight: f.weight || 1 }]));
  const [rows, setRows] = useState(init);
  const set = (id, patch) => setRows((s) => ({ ...s, [id]: { on: true, graded: true, weight: 1, ...(s[id] || {}), ...patch } }));
  const toggle = (id) => setRows((s) => { const cur = s[id]; if (cur?.on) { const n = { ...s }; delete n[id]; return n; } return { ...s, [id]: { on: true, graded: true, weight: 1 } }; });
  return (
    <Modal title={t("selectFlashcards")} onClose={onClose}
      onSave={() => onSave(Object.entries(rows).filter(([, v]) => v.on).map(([id, v]) => ({ flashcard_id: +id, graded: !!v.graded, weight: v.weight || 1 })))}>
      <div className="small muted mb8">{t("classFlashHint")}</div>
      {items.map((it) => {
        const r = rows[it.id];
        return (
          <div key={it.id} className="fp-row">
            <label style={{ cursor: "pointer", flex: 1, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <input type="checkbox" checked={!!r?.on} onChange={() => toggle(it.id)} style={{ width: 18, height: 18 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{biField(it, "title", lang) || `#${it.id}`}</span>
            </label>
            {r?.on && (
              <div className="fp-opts">
                <button type="button" className={`chip-btn ${r.graded ? "on" : ""}`} onClick={() => set(it.id, { graded: true })}>{t("gradedShort")}</button>
                <button type="button" className={`chip-btn ${!r.graded ? "on" : ""}`} onClick={() => set(it.id, { graded: false })}>{t("practiceShort")}</button>
                {r.graded && <input type="number" min="1" className="fp-weight" value={r.weight} title={t("weightField")}
                  onChange={(e) => set(it.id, { weight: +e.target.value || 1 })} />}
              </div>
            )}
          </div>
        );
      })}
      {items.length === 0 && <div className="small muted center" style={{ padding: 16 }}>{t("noFlashcardsAvail")}</div>}
    </Modal>
  );
}

/* ===== نتایج و کارنامهٔ کلاس‌ها — the class gradebook/results tab ===== */
function ClassResults() {
  const { t, lang } = useApp();
  const [classes, setClasses] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  useEffect(() => {
    setLoadErr("");
    api.get("/classes").then((d) => setClasses(Array.isArray(d) ? d : [])).catch((e) => { setClasses([]); setLoadErr(String(e.message || e)); });
  }, []);
  if (!classes) return <Spinner />;
  if (openId != null) return <ClassGradebook classId={openId} back={() => setOpenId(null)} />;
  return (
    <div className="card">
      <div className="section-title"><h4><Icon name="chart" size={16} /> {t("classResults")}</h4></div>
      <div className="small muted mb16">{t("classResultsHint")}</div>
      {loadErr && <div className="err-banner mb8">{loadErr}</div>}
      {classes.length === 0 ? <div className="small muted center" style={{ padding: 20 }}>{loadErr ? (lang === "fa" ? "بارگذاری کلاس‌ها شکست خورد" : "Could not load classes") : t("noClassesYet")}</div> : (
        <div className="grid grid-2">
          {classes.map((c) => (
            <button key={c.id} className="card mod-card mod-card-row" onClick={() => setOpenId(c.id)}>
              <div className="mod-ico" style={{ background: "var(--grad-primary)" }}><Icon name="class" size={22} /></div>
              <div className="mod-card-body">
                <h3>{biField(c, "name", lang)}</h3>
                <p>{c.nStudents} {t("students")} · {c.nCases} {t("casesCount")} · <span className="tag">{c.code}</span></p>
              </div>
              <Icon name={lang === "fa" ? "chevronLeft" : "chevronRight"} size={18} className="mod-card-go" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


function TeachingAnalyticsPanel({ kind, id }) {
  const { lang } = useApp();
  const fa = lang === "fa";
  const [d, setD] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  useEffect(() => {
    setLoadErr("");
    api.get(`/${kind === "class" ? "classes" : "exams"}/${id}/analytics`).then(setD).catch((e) => { setLoadErr(String(e.message || e)); setD({ __err: true }); });
  }, [kind, id]);
  if (d?.__err || loadErr) return <div className="card empty-state"><h3>{loadErr || (fa ? "بارگذاری تحلیل آموزشی شکست خورد" : "Could not load teaching analytics")}</h3></div>;
  if (!d) return <div className="card"><div className="skeleton" style={{ height: 120 }} /></div>;
  const nameOf = (x) => fa ? (x.label_fa || x.name_fa || x.key) : (x.label_en || x.name_en || x.label_fa || x.key);
  const reasonText = {
    low_score: fa ? "نمره پایین" : "low score",
    hint_dependent: fa ? "وابستگی به راهنما" : "hint-dependent",
    slow: fa ? "پاسخ کند" : "slow",
  };
  const StudentList = ({ rows }) => !rows?.length ? <div className="small muted">{fa ? "موردی نیست" : "None"}</div> : rows.map((s) => <div className="weak-row" key={s.id}><div style={{ flex: 1, minWidth: 0 }}><b>{fa ? s.name_fa : s.name_en}</b> <span className="small muted">{s.student_no}</span>{Array.isArray(s.reasons) && !!s.reasons.length && <div className="small" style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>{s.reasons.map((r) => <span className="tag" key={r} style={{ background: "var(--danger-bg, #fdecec)", color: "var(--flame)" }}>{reasonText[r] || r}</span>)}</div>}{s.avgHints != null && <div className="small muted">{fa ? `راهنما: ${s.avgHints} · زمان: ${s.avgSec ?? "—"} ثانیه` : `Hints: ${s.avgHints} · Time: ${s.avgSec ?? "—"}s`}</div>}</div><span className="tag">{s.avg ?? "—"}</span></div>);
  const MetricList = ({ rows, good }) => !rows?.length ? <div className="small muted">{fa ? "داده کافی نیست" : "Not enough data"}</div> : rows.map((x) => <div className="weak-row" key={x.key}><div style={{ flex: 1, minWidth: 0 }}><b>{nameOf(x)}</b>{(x.avgHints != null || x.avgSec != null) && <div className="small muted">{fa ? `راهنما: ${x.avgHints ?? 0} · زمان: ${x.avgSec ?? "—"} ثانیه` : `Hints: ${x.avgHints ?? 0} · Time: ${x.avgSec ?? "—"}s`}</div>}<div className="pbar sm"><span style={{ width: `${Math.max(0, Math.min(100, x.avg || 0))}%`, background: good ? "var(--green)" : ((x.avg||0)<50?"var(--flame)":"var(--gold)") }} /></div></div><span className="tag">{x.avg}%</span></div>);
  /* Classical item analysis: P facility, D discrimination, hint effect. */
  const dTag = (v) => v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(2);
  const dColor = (v) => (v == null ? "var(--text-3, #888)" : v >= 0.3 ? "var(--green)" : v >= 0.2 ? "var(--gold)" : "var(--flame)");
  const ItemAnalysisList = ({ rows }) => !rows?.length ? <div className="small muted">{fa ? "داده کافی نیست" : "Not enough data"}</div> : rows.map((x) => <div className="weak-row" key={x.key}><div style={{ flex: 1, minWidth: 0 }}><b>{nameOf(x)}</b><div className="small" style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>{x.hard && <span className="tag" style={{ background: "var(--danger-bg, #fdecec)", color: "var(--flame)" }}>{fa ? "دشوار" : "hard"}</span>}{x.poorDiscrimination && <span className="tag" style={{ background: "#fff4dc", color: "var(--gold)" }}>{fa ? "تمییز ضعیف" : "weak D"}</span>}</div><div className="small muted">{fa ? `راهنما: ${x.avgHints ?? 0} · زمان: ${x.avgSec ?? "—"} ثانیه` : `Hints: ${x.avgHints ?? 0} · Time: ${x.avgSec ?? "—"}s`}{x.noHintSuccess != null && x.withHintSuccess != null ? (fa ? ` · بدون راهنما ${x.noHintSuccess}٪ / با راهنما ${x.withHintSuccess}٪` : ` · no-hint ${x.noHintSuccess}% / hinted ${x.withHintSuccess}%`) : ""}</div></div><span className="tag" title={fa ? "P دشواری / D تمییز" : "P facility / D discrimination"}>P {x.facility ?? x.avg}٪ <b style={{ color: dColor(x.discrimination) }}>D {dTag(x.discrimination)}</b></span></div>);
  const HintEffectList = ({ rows }) => !rows?.length ? <div className="small muted">{fa ? "داده کافی نیست" : "Not enough data"}</div> : rows.map((x) => <div className="weak-row" key={x.key}><div style={{ flex: 1, minWidth: 0 }}><b>{nameOf(x)}</b><div className="small muted">{fa ? `درستی بدون راهنما ${x.noHintSuccess ?? "—"}٪ ← با راهنما ${x.withHintSuccess ?? "—"}٪` : `Correct no-hint ${x.noHintSuccess ?? "—"}% → hinted ${x.withHintSuccess ?? "—"}%`}</div></div><span className="tag" style={{ color: x.gain >= 0 ? "var(--green)" : "var(--flame)" }}>{x.gain > 0 ? "+" : ""}{x.gain}٪</span></div>);
  const exportItemsCsv = async () => {
    try {
      const base = `/${kind === "class" ? "classes" : "exams"}/${id}/analytics.csv?lang=${lang}`;
      const res = await fetch(`/api${base}`, { credentials: "same-origin", headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `${kind}-item-analysis-${id}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert(e.message); }
  };
  const trend = Array.isArray(d.trend) ? d.trend : [];
  const trendMax = Math.max(1, ...trend.map((x) => x.attempts || 0));
  return <div className="card teaching-analytics mb16">
    <div className="section-title"><h4><Icon name="chart" size={16} /> {fa ? "تحلیل آموزشی برای تصمیم‌گیری استاد" : "Teaching analytics for instructor decisions"}</h4><button className="btn btn-ghost btn-sm" onClick={exportItemsCsv}><Icon name="download" size={14} /> {fa ? "خروجی CSV تحلیل سؤال‌ها" : "Item analysis CSV"}</button></div>
    <div className="grid grid-3 mb16">
      <div className="card stat-card"><div className="num">{d.summary?.students || 0}</div><div className="lbl">{fa ? "دانشجو" : "Students"}</div></div>
      <div className="card stat-card"><div className="num">{d.summary?.attempts || 0}</div><div className="lbl">{fa ? "تلاش ثبت‌شده" : "Attempts"}</div></div>
      <div className="card stat-card"><div className="num">{d.summary?.pendingDrawings || 0}</div><div className="lbl">{fa ? "نقاشی در انتظار" : "Pending drawings"}</div></div>
      <div className="card stat-card"><div className="num">{d.summary?.avgHintsPerAnswer ?? 0}</div><div className="lbl">{fa ? "میانگین راهنما/پاسخ" : "Avg hints/answer"}</div></div>
      <div className="card stat-card"><div className="num">{d.summary?.pctAnswersWithHints ?? 0}٪</div><div className="lbl">{fa ? "پاسخ‌های با راهنما" : "Answers using hints"}</div></div>
      <div className="card stat-card"><div className="num">{d.summary?.avgSecPerAnswer ?? "—"}</div><div className="lbl">{fa ? "میانگین زمان پاسخ (ثانیه)" : "Avg answer time (s)"}</div></div>
    </div>
    {trend.length > 1 && <div className="card mb16">
      <h4>{fa ? "روند پیشرفت هفتگی (تعداد تلاش و میانگین نمره)" : "Weekly trend (attempts & average score)"}</h4>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 110, paddingTop: 8 }}>
        {trend.slice(-12).map((w) => <div key={w.week} title={`${w.week} · ${w.attempts} · ${w.avg}%`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", minWidth: 18 }}>
          <div className="small muted">{w.avg}٪</div>
          <div style={{ width: "70%", minHeight: 2, height: `${Math.max(3, (w.attempts / trendMax) * 70)}px`, background: "var(--primary)" }} />
        </div>)}
      </div>
    </div>}
    <div className="grid grid-2">
      <div className="card"><h4>{fa ? "نقاط قوت کلاس/آزمون" : "Strengths"}</h4><MetricList rows={d.strengths} good /></div>
      <div className="card"><h4>{fa ? "نقاط ضعف موضوعی" : "Topic weaknesses"}</h4><MetricList rows={d.weaknesses} /></div>
      <div className="card"><h4>{fa ? "تحلیل سؤال: دشواری P و تمییز D" : "Item analysis: facility P & discrimination D"}</h4><ItemAnalysisList rows={[...(d.hardItems || []), ...(d.poorDiscriminationItems || []), ...(d.itemWeaknesses || [])].filter((v, i, arr) => arr.findIndex((q) => q.key === v.key) === i).slice(0, 14)} /></div>
      <div className="card"><h4>{fa ? "اثربخشی راهنماها" : "Hint effectiveness"}</h4><HintEffectList rows={d.hintEffectiveness} /></div>
      <div className="card"><h4>{fa ? "آیتم‌های زمان‌بر" : "Slowest items"}</h4><MetricList rows={d.slowItems} /></div>
      <div className="card"><h4>{fa ? "دانشجویان در معرض خطر (نمره/راهنما/سرعت)" : "At-risk learners (score / hints / speed)"}</h4><StudentList rows={d.supportNeeded} /></div>
    </div>
    <div className="small muted mt8">{fa ? "P = درصد پاسخ درست به هر سؤال (هرچه کمتر، دشوارتر)؛ D = تفاوت عملکرد گروه بالا و پایین دانشجویان (زیر ۰٫۲۰ نشانهٔ تمییز ضعیف سؤال است)." : "P = % correct on the item (lower = harder); D = top-vs-bottom group gap (below 0.20 flags poor discrimination)."}</div>
  </div>;
}

/* Full gradebook for ONE class: per-student cases done, flashcards done, and
   overall grade — plus a class average. */
function ClassGradebook({ classId, back }) {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [data, setData] = useState(null);
  const [review, setReview] = useState(null);   // { member } → conversation review modal
  const [liveOpen, setLiveOpen] = useState(false);
  const [drawingOpen, setDrawingOpen] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  useEffect(() => {
    setLoadErr("");
    api.get(`/classes/${classId}`).then(setData).catch((e) => { setLoadErr(String(e.message || e)); setData({ __err: true }); });
  }, [classId]);
  if (data?.__err || loadErr) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{loadErr || (fa ? "بارگذاری کارنامه شکست خورد" : "Could not load the gradebook")}</h3><button className="btn btn-ghost mt16" onClick={() => { setData(null); setLoadErr(""); api.get(`/classes/${classId}`).then(setData).catch((e) => { setLoadErr(String(e.message || e)); setData({ __err: true }); }); }}>{fa ? "تلاش دوباره" : "Retry"}</button><button className="btn btn-ghost mt16" onClick={back}>{fa ? "بازگشت" : "Back"}</button></div>;
  if (!data) return <Spinner />;
  const { class: cl, cases = [], flashcards = [], members = [] } = data;
  const avg = members.length ? Math.round(members.reduce((s, m) => s + (m.grade || 0), 0) / members.length) : 0;
  const num = (n) => (n || 0).toLocaleString(fa ? "fa-IR" : "en-US");
  const roleLabel = { history: t("gradeExtern"), overall: t("gradeIntern"), both: t("gradeBoth") }[cl.grading_role || "both"];

  const exportCsv = async () => {
    try {
      const res = await fetch(`/api/classes/${classId}/gradebook.csv?lang=${lang}`, { credentials: "same-origin", headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `gradebook-${cl.code || classId}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="card">
      <div className="section-title">
        <h4><Icon name="chart" size={16} /> {t("gradebook")} — {biField(cl, "name", lang)} <span className="tag">{cl.code}</span></h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-sm" onClick={()=>setLiveOpen(true)}><Icon name="trophy" size={14} /> {fa ? "صفحه زنده رقابت" : "Live board"}</button>
          <button className="btn btn-accent btn-sm" onClick={()=>setDrawingOpen(true)}><Icon name="image" size={14} /> {fa ? "بررسی تصاویر" : "Review drawings"}</button>
          <button className="btn btn-ghost btn-sm" onClick={exportCsv}><Icon name="download" size={14} /> {fa ? "خروجی CSV" : "Export CSV"}</button>
          <button className="btn btn-ghost btn-sm" onClick={back}>← {t("back")}</button>
        </div>
      </div>
      <div className="small muted mb16">{t("gradingCriterion")}: <b>{roleLabel}</b></div>
      <div className="grid grid-3 mb16">
        <div className="card stat-card"><div className="num">{num(members.length)}</div><div className="lbl">{t("students")}</div></div>
        <div className="card stat-card"><div className="num">{num(cases.length + flashcards.length)}</div><div className="lbl">{t("classItems")}</div></div>
        <div className="card stat-card"><div className="num">{num(avg)}</div><div className="lbl">{t("classAvg")}</div></div>
      </div>
      <TeachingAnalyticsPanel kind="class" id={classId} />
      {members.length === 0 ? <div className="small muted center" style={{ padding: 20 }}>{t("noStudentsYet")}</div> : (
        <div className="table-wrap"><table>
          <thead><tr>
            <th>{t("name")}</th><th>{t("studentNo")}</th>
            <th>{t("classCasesShort")}</th><th>{t("classFlashShort")}</th>
            <th>{t("progress")}</th><th>{t("classGrade")}</th><th></th>
          </tr></thead>
          <tbody>{members.map((m) => {
            const totalItems = (m.totalCases || 0) + (m.totalFlash || 0);
            const doneItems = (m.caseDone || 0) + (m.flashDone || 0);
            return (
              <tr key={m.id}>
                <td>{lang === "fa" ? m.name_fa : m.name_en}</td>
                <td>{m.student_no}</td>
                <td>{num(m.caseDone || 0)}/{num(m.totalCases || 0)}</td>
                <td>{num(m.flashDone || 0)}/{num(m.totalFlash || 0)}</td>
                <td style={{ minWidth: 130 }}>
                  <div className="pbar"><span style={{ width: `${totalItems ? (doneItems / totalItems) * 100 : 0}%` }} /></div>
                  <div className="small muted mt8">{num(doneItems)}/{num(totalItems)} {t("completed")}</div>
                </td>
                <td><b style={{ color: "var(--accent)", fontSize: "1.05rem" }}>{num(m.grade)}</b></td>
                <td><button className="btn btn-sm btn-ghost" onClick={() => setReview(m)} title={t("reviewAiScoring")}><Icon name="chat" size={13} /> {t("viewConversations")}</button></td>
              </tr>
            );
          })}</tbody></table></div>
      )}
      {liveOpen && <ClassLiveBoard classId={classId} onClose={() => setLiveOpen(false)} />}
      {drawingOpen && <DrawingReviewsModal scope="class" id={classId} title={fa ? "بررسی تصاویر کلاس" : "Class drawing review"} onClose={() => setDrawingOpen(false)} />}
      {review && <ConversationReview classId={classId} member={review} onClose={() => setReview(null)} />}
    </div>
  );
}


function DrawingReviewsPanel({ scope, id, inbox }) {
  const { lang } = useApp();
  const fa = lang === "fa";
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState({});
  const base = scope === "exam" ? `/exams/${id}/drawing-reviews` : `/classes/${id}/drawing-reviews`;
  const [drawErr, setDrawErr] = useState("");
  const load = () => {
    setDrawErr("");
    api.get(inbox ? "/classes/drawing-inbox" : base).then((d) => setRows(d.reviews || [])).catch((e) => { setRows([]); setDrawErr(String(e.message || e)); });
  };
  useEffect(() => { load(); const tid = setInterval(load, 6000); return () => clearInterval(tid); }, [inbox ? "inbox" : base]);
  const decide = async (r, status) => {
    const key = `${r.attemptId}:${r.answerIndex}`;
    setBusy(key);
    try {
      const path = r.source === "exam"
        ? `/exams/${r.examId}/drawing-reviews/${r.attemptId}/${r.answerIndex}`
        : `/classes/${r.classId || id}/drawing-reviews/${r.attemptId}/${r.answerIndex}`;
      await api.post(path, { status, feedback: feedback[key] || "", points: status === "approved" ? pointsFor(r, key) : 0 });
      await load();
    } finally { setBusy(""); }
  };
  const statusLabel = (s) => s === "approved" ? (fa ? "تأیید شده" : "Approved") : s === "rejected" ? (fa ? "رد شده" : "Rejected") : (fa ? "در انتظار بررسی" : "Pending");
  const [scoreOverrides, setScoreOverrides] = useState({});
  const noteText = {
    blank_canvas: fa ? "بوم خالی" : "blank canvas",
    mostly_outside_zones: fa ? "بیشتر ترسیم خارج ناحیه است" : "mostly outside zones",
    missing_or_misplaced_labels: fa ? "برچسب‌ها ناقص یا جابه‌جا" : "labels missing/misplaced",
    no_zones_defined: fa ? "ناحیهٔ هدف تعریف نشده؛ فقط برآورد تلاش" : "no target zones; effort estimate only",
    no_mask: fa ? "نسخهٔ مرورگر دانشجو ماسک ارسال نکرده" : "student client sent no mask",
  };
  const pointsFor = (r, key) => {
    if (scoreOverrides[key] != null) return scoreOverrides[key];
    if (r.assist?.suggestedPct != null) return r.assist.suggestedPct;
    return Math.round(r.proposedPoints || 0);
  };
  return <>
    <div className="small muted mb8">{fa ? "این صفحه هر چند ثانیه تازه می‌شود. نمره نقاشی فقط بعد از تأیید استاد به نمره دانشجو اضافه می‌شود." : "This page auto-refreshes. Drawing points are added only after teacher approval."}</div>
    {drawErr ? <div className="card empty-state"><div className="ico">⚠️</div><h3>{drawErr}</h3><button className="btn btn-ghost mt16" onClick={load}>{fa ? "تلاش دوباره" : "Retry"}</button></div> : !rows ? <Spinner /> : rows.length === 0 ? <div className="card empty-state"><div className="ico">🖼️</div><h3>{fa ? "هنوز نقاشی‌ای ثبت نشده است" : "No drawings submitted yet"}</h3></div> : <div className="drawing-review-list">
      {rows.map((r) => {
        const key = `${r.attemptId}:${r.answerIndex}`;
        const pending = r.status !== "approved" && r.status !== "rejected";
        return <div className="card drawing-review-card" key={key}>
          <div className="section-title"><h4>{r.student?.name_fa || r.student?.name_en || "—"} <span className="tag">{r.student?.student_no || ""}</span></h4><span className={`tag ${r.status === "approved" ? "ok" : r.status === "rejected" ? "bad" : ""}`}>{statusLabel(r.status)}</span></div>
          {(r.class_fa || r.class_en || r.code) && <div className="small muted mb8">{fa ? r.class_fa : r.class_en} {r.code ? <span className="tag">{r.code}</span> : null}</div>}
          <div className="small muted mb8">{fa ? r.question_fa : r.question_en}</div>
          {r.drawing?.preview && <div style={{ position: "relative" }}>
            <img className="drawing-review-img" src={r.drawing.preview} alt="drawing submission" />
            {Array.isArray(r.zones) && r.zones.length > 0 && <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>{r.zones.map((z, i) => <rect key={i} x={z.x} y={z.y} width={z.w} height={z.h} fill="rgba(37,99,235,.12)" stroke="#2563eb" strokeWidth=".7" vectorEffect="non-scaling-stroke" />)}</svg>}
          </div>}
          {r.assist && <div className="micro-box mt8" style={{ padding: 8 }}>
            <div className="small muted mb4">🤖 {fa ? "تحلیل پوشش نقشه (صرفاً پیشنهاد — تصمیم با شماست)" : "Mask coverage assist (suggested only — you decide)"}</div>
            <div className="case-meta">
              {r.assist.basis === "zones" ? <>
                <span className="tag" title={fa ? "پوشش ناحیه هدف" : "target coverage"}>{fa ? "پوشش" : "Coverage"}: {r.assist.coveragePct}٪</span>
                <span className="tag" title={fa ? "ترسیم داخل ناحیه" : "ink inside zones"}>{fa ? "دقت" : "Precision"}: {r.assist.precisionPct}٪</span>
                <span className="tag">IoU: {r.assist.iouPct}٪</span>
                {r.assist.labelsTotal > 0 && <span className="tag">{fa ? "برچسب" : "Labels"}: {r.assist.labelsMatched}/{r.assist.labelsTotal}</span>}
              </> : <span className="tag">{fa ? "پوشش بوم" : "Canvas ink"}: {r.assist.inkPct ?? "—"}٪</span>}
              {Array.isArray(r.assist.notes) && r.assist.notes.map((n) => <span className="tag" key={n} style={{ background: "#fff4dc" }}>{noteText[n] || n}</span>)}
            </div>
            {r.assist.basis === "zones" && Array.isArray(r.assist.zones) && r.assist.zones.length > 1 && <div className="small muted mt4">{r.assist.zones.map((z, i) => `${z.label || i + 1}:${z.coveragePct}٪`).join(" · ")}</div>}
          </div>}
          <div className="case-meta mt8"><span className="tag">{fa ? "امتیاز پیشنهادی دانشجو" : "Student proposed"}: {Math.round(r.proposedPoints || 0)}</span><span className="tag">{fa ? "امتیاز فعلی" : "Current"}: {Math.round(r.points || 0)}</span><span className="tag">{fa ? "خطوط" : "Strokes"}: {r.drawing?.strokeCount || 0}</span></div>
          <textarea rows="2" value={feedback[key] || ""} onChange={(e) => setFeedback((f) => ({ ...f, [key]: e.target.value }))} placeholder={fa ? "بازخورد اختیاری برای دانشجو/ثبت داخلی" : "Optional feedback"} />
          <div className="inline-form mt8" style={{ alignItems: "center" }}>
            <label className="small muted">{fa ? "نمره برای ثبت:" : "Score to award:"}
              <input type="number" min="0" max={Math.round(r.proposedPoints || 100)} style={{ width: 90, marginInlineStart: 6 }} value={pointsFor(r, key)} onChange={(e) => setScoreOverrides((o) => ({ ...o, [key]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} />
            </label>
            {r.assist?.suggestedPct != null && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setScoreOverrides((o) => ({ ...o, [key]: r.assist.suggestedPct }))}>🤖 {fa ? `پیشنهاد ${r.assist.suggestedPct}` : `Suggest ${r.assist.suggestedPct}`}</button>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button className="btn btn-accent btn-sm" disabled={busy === key || !pending} onClick={() => decide(r, "approved")}>✅ {fa ? "تأیید و ثبت نمره" : "Approve & score"}</button>
            <button className="btn btn-danger btn-sm" disabled={busy === key || !pending} onClick={() => decide(r, "rejected")}>✕ {fa ? "رد نقاشی" : "Reject"}</button>
          </div>
        </div>;
      })}
    </div>}
  </>;
}
function DrawingReviewsModal({ scope, id, title, onClose }) {
  return <Modal title={title} onClose={onClose} wide><DrawingReviewsPanel scope={scope} id={id} /></Modal>;
}
function DrawingReviewsInbox() {
  const { lang } = useApp();
  const fa = lang === "fa";
  return <div className="card">
    <div className="section-title"><h4><Icon name="image" size={16} /> {fa ? "بررسی نقاشی‌ها — تأیید / رد" : "Drawing reviews — approve / reject"}</h4></div>
    <DrawingReviewsPanel inbox />
  </div>;
}

function ClassLiveBoard({ classId, onClose }) {
  const { lang } = useApp();
  const fa = lang === "fa";
  const [data, setData] = useState(null);
  const [full, setFull] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailFor, setDetailFor] = useState(null);
  const [boardErr, setBoardErr] = useState("");
  const load = () => {
    if (typeof document !== "undefined" && document.hidden) return;
    setBoardErr("");
    api.get(`/classes/${classId}/live-board`, { revalidate: true }).then((d) => { if (d) setData(d); }).catch((e) => { setBoardErr(String(e.message || e)); setData({ __err: true, ranked: [] }); });
  };
  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [classId]);
  const openDetail = async (row) => { setDetailFor(row); setDetail(null); try { setDetail(await api.get(`/classes/${classId}/live-board/${row.user_id}/details`)); } catch (e) { setDetail({ __err: true, message: String(e.message || e), attempts: [] }); } };
  const shell = (content) => full ? <div className="live-board-full">{content}</div> : <Modal title={fa ? "صفحه زنده رقابت کلاس" : "Live classroom board"} onClose={onClose} wide>{content}</Modal>;
  if (!data) return shell(<Spinner />);
  if (data.__err || boardErr) return shell(<div className="card empty-state"><div className="ico">⚠️</div><h3>{boardErr || (fa ? "بارگذاری صفحه زنده شکست خورد" : "Live board failed")}</h3><button className="btn btn-ghost mt16" onClick={load}>{fa ? "تلاش دوباره" : "Retry"}</button></div>);
  const cl = data.class || {}, rows = data.ranked || [];
  const medal = (r) => r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : r;
  const content = <div className="live-board">
    <div className="live-board-header">
      <div className="live-board-title"><h2 style={{ margin: 0 }}>{fa ? cl.name_fa : cl.name_en}</h2><div className="small muted">{fa ? "به‌روزرسانی خودکار هر ۵ ثانیه؛ برای دیدن پاسخ‌ها روی نام دانشجو بزنید." : "Auto-refreshes every 5 seconds; click a student name to see answers."} · {(data.updatedAt || "").slice(11,19)}</div></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn btn-ghost btn-sm" onClick={load}>{fa ? "به‌روزرسانی" : "Refresh"}</button><button className="btn btn-primary btn-sm" onClick={()=>setFull(!full)}>{full ? (fa ? "خروج از تمام‌صفحه" : "Exit full") : (fa ? "تمام‌صفحه برای تخته" : "Full screen")}</button>{full && <button className="btn btn-ghost btn-sm" onClick={onClose}>{fa ? "بستن" : "Close"}</button>}</div>
    </div>
    <div className="grid grid-3 mb16"><div className="card stat-card"><div className="num">{data.totals?.students || 0}</div><div className="lbl">{fa ? "دانشجو" : "Students"}</div></div><div className="card stat-card"><div className="num">{data.totals?.items || 0}</div><div className="lbl">{fa ? "فعالیت" : "Activities"}</div></div><div className="card stat-card"><div className="num">{rows.filter(r=>r.score!=null).length}</div><div className="lbl">{fa ? "شرکت‌کننده" : "Participants"}</div></div></div>
    <div className="live-board-grid">
            <VirtualList className="live-board-ranks" itemCount={rows.length} itemHeight={full ? 88 : 76} maxHeight={full ? 720 : 520}>{({ index, style }) => { const r = rows[index]; return <div style={style} className={`live-rank-row ${r.rank===1?'top1':''} ${detailFor?.user_id===r.user_id?'selected':''}`} key={r.user_id}><div className="live-rank-medal">{medal(r.rank)}</div><div><button className="live-rank-name" onClick={()=>openDetail(r)}>{r.displayName}</button><div className="small muted">{fa ? "پیشرفت" : "Progress"}: {r.done}/{r.total}{cl.live_board_speed && r.timeSec != null && (<span> · ⏱ {Math.floor(r.timeSec / 60)}:{String(r.timeSec % 60).padStart(2, "0")}</span>)}</div></div><div className="live-score">{r.score==null ? "—" : r.score}</div><div className="live-progress"><div className="pbar"><span style={{ width: `${r.progress || 0}%` }} /></div><div className="small muted">{r.progress || 0}%</div></div></div>; }}</VirtualList>
      {detailFor && <LiveStudentDetail detail={detail} displayName={detailFor.displayName} fa={fa} onClose={()=>{setDetailFor(null);setDetail(null)}} />}
    </div>
    {rows.length===0 && <div className="small muted center" style={{padding:20}}>{fa ? "هنوز دانشجویی در این کلاس نیست." : "No students yet."}</div>}
  </div>;
  return shell(content);
}

function LiveStudentDetail({ detail, displayName, fa, onClose }) {
  const answerText = (a) => {
    if (fa && a.answerText) return a.answerText;
    if (!fa && a.answerText_en) return a.answerText_en;
    if (a.type === "truefalse") {
      if (a.answer === true || a.answer === "true") return fa ? "درست" : "True";
      if (a.answer === false || a.answer === "false") return fa ? "نادرست" : "False";
    }
    if (a.selected?.length) return a.selected.map((x)=>fa?x.fa:x.en).filter(Boolean).join(fa ? "، " : ", ");
    if (a.kfResults?.length) return a.kfResults.map((s)=>`${s.index}. ${s.answer ?? "—"}${s.correct ? " ✓" : " ✗"}`).join(" | ");
    if (a.stepResults?.length) return a.stepResults.map((s)=>`${s.index}. ${s.answer || "—"}${s.correct ? " ✓" : " ✗"}`).join(" | ");
    if (a.type === "compare" && a.answers) return Object.values(a.answers).join(fa ? "، " : ", ");
    if (a.type === "hotspot" && a.hotspotClicks?.length) {
      const last = a.hotspotClicks[a.hotspotClicks.length - 1];
      return `(${last.x}, ${last.y})${last.ok ? " ✓" : " ✗"}`;
    }
    if (a.type === "puzzle" && a.assign) return fa ? `${Object.keys(a.assign).length} برچسب` : `${Object.keys(a.assign).length} labels`;
    if (a.type === "match" && (a.pairs || a.answer?.pairs)) {
      const n = Object.keys(a.pairs || a.answer.pairs).length;
      return fa ? `${n} جفت` : `${n} pairs`;
    }
    if (a.type === "order" && (a.orderIds || Array.isArray(a.answer))) {
      const raw = a.orderIds || a.answer;
      return raw.map((x) => (x && typeof x === "object" ? (x.text || x.id) : x)).join(" → ");
    }
    if (a.drawing?.preview) return fa ? "نقاشی ثبت شده" : "Drawing submitted";
    if (a.answer != null && typeof a.answer !== "object") return String(a.answer);
    return "—";
  };
  const status = (a) => a.pendingApproval ? (fa ? "در انتظار تأیید" : "Pending approval") : a.solved ? (fa ? "درست" : "Correct") : (fa ? "نادرست/رد" : "Wrong/rejected");
  return <aside className="live-student-detail card">
    <div className="section-title"><h4>{fa ? "پاسخ‌های" : "Answers"} {displayName}</h4><button className="btn btn-ghost btn-sm" onClick={onClose}>×</button></div>
    {!detail ? <Spinner /> : detail.__err ? <div className="card empty-state"><div className="ico">⚠️</div><h4>{detail.message || (fa ? "بارگذاری پاسخ‌ها شکست خورد" : "Could not load answers")}</h4></div> : (detail.attempts || []).length === 0 ? <div className="small muted center" style={{padding:12}}>{fa ? "هنوز پاسخی ثبت نشده است." : "No answers yet."}</div> : <div className="live-answer-list">
      {(detail.attempts || []).map((att)=><div className="live-attempt" key={`${att.kind}-${att.attemptId}`}>
        <div className="live-attempt-head"><b>{fa ? (att.title_fa || "فلش‌کارت") : (att.title_en || "Flashcard")}</b><span className="tag">{att.score ?? "—"}</span></div>
        {att.kind === "vp" && <div className="small muted">{fa ? "بیمار مجازی/کیس" : "Virtual patient/case"} · {(att.created_at||"").slice(0,16).replace("T"," ")}</div>}
        {att.kind === "flashcard" && (att.answers || []).map((a,i)=><div className="live-answer" key={i}>
          <div><b>{a.order || i+1}. {fa ? (a.question_fa || a.title_fa) : (a.question_en || a.title_en)}</b></div>
          <div className="small muted">{fa ? "نوع" : "Type"}: {a.type || "mcq"} · {status(a)} · {fa ? "امتیاز" : "Points"}: {Math.round(a.points || 0)}{a.proposedPoints ? ` / ${fa ? "پیشنهادی" : "proposed"}: ${Math.round(a.proposedPoints)}` : ""}</div>
          <div className="small">{fa ? "پاسخ:" : "Answer:"} {answerText(a)}</div>
          {a.correct && <div className="small muted">{fa ? "پاسخ درست:" : "Correct:"} {fa ? a.correct.fa : a.correct.en}</div>}
          {a.drawing?.preview && <img className="live-answer-drawing" src={a.drawing.preview} alt="drawing" />}
          {a.drawing?.approval && <div className="small muted">{fa ? "وضعیت بررسی:" : "Review:"} {a.drawing.approval.status}</div>}
        </div>)}
      </div>)}
    </div>}
  </aside>;
}

/* Teacher/admin review of a student's virtual-patient conversations in a class:
   list of attempts → open one → full transcript + section-by-section scores.
   Lets them verify the AI's grading + the student's history-taking. */
function ConversationReview({ classId, member, onClose }) {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [attempts, setAttempts] = useState(null);
  const [detail, setDetail] = useState(null);   // opened attempt detail
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  useEffect(() => {
    setLoadErr("");
    api.get(`/classes/${classId}/members/${member.id}/attempts`).then((d) => setAttempts(Array.isArray(d?.attempts) ? d.attempts : [])).catch((e) => { setLoadErr(String(e.message || e)); setAttempts({ __err: true }); });
  }, [classId, member.id]);
  const open = async (id) => {
    setBusy(true);
    try { setDetail(await api.get(`/classes/${classId}/attempts/${id}`)); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  const name = fa ? member.name_fa : member.name_en;
  const num = (n) => (n || 0).toLocaleString(fa ? "fa-IR" : "en-US");

  return (
    <Modal title={`${t("conversation")} — ${name}`} onClose={onClose} wide>
      {!detail ? (
        attempts?.__err || loadErr ? <div className="empty-state"><h3>{loadErr || (fa ? "بارگذاری گفت‌وگوها شکست خورد" : "Could not load conversations")}</h3></div> :
        attempts == null ? <Spinner /> :
        attempts.length === 0 ? <div className="small muted center" style={{ padding: 20 }}>{t("noAttemptsYet")}</div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{t("caseTitle") || "کیس"}</th><th>{t("classGrade")}</th><th>{fa ? "تاریخ" : "Date"}</th><th></th></tr></thead>
            <tbody>{attempts.map((a) => (
              <tr key={a.id}>
                <td>{fa ? a.caseTitle_fa : a.caseTitle_en}</td>
                <td><b>{num(a.score)}</b></td>
                <td className="small muted">{(a.created_at || "").slice(0, 16).replace("T", " ")}</td>
                <td><button className="btn btn-sm btn-primary" disabled={busy} onClick={() => open(a.id)}>{fa ? "مشاهده" : "Open"}</button></td>
              </tr>
            ))}</tbody></table></div>
        )
      ) : (
        <ConversationDetail detail={detail} onBack={() => setDetail(null)} />
      )}
    </Modal>
  );
}

function speakerLabel(m, t) {
  if (m.role === "student") return t("studentDoctor");
  if (m.role === "teacher" || m.mode === "exam") return t("teacherVoice");
  if (m.role === "lab") return t("tabTests");
  return t("virtualPatient");
}

function ConversationDetail({ detail, onBack }) {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const a = detail.attempt || {};
  const ss = detail.eval?.sectionScores;
  const msgs = detail.transcript?.messages || [];
  const num = (n) => (n || 0).toLocaleString(fa ? "fa-IR" : "en-US");
  const [status, setStatus] = useState(a.teacher_status || "approved");
  const [tScore, setTScore] = useState(a.teacher_score ?? a.score ?? 0);
  const [feedback, setFeedback] = useState(a.teacher_feedback || "");
  const [busy, setBusy] = useState(false);
  const saveReview = async () => {
    setBusy(true);
    try {
      await api.put(`/reports/attempts/${a.id}/review`, { status, teacher_score: tScore, teacher_feedback: feedback });
      toast(fa ? "فیدبک ثبت شد" : "Feedback saved");
    } catch (e) { toast(e.message || "error"); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <button className="btn btn-ghost btn-sm mb8" onClick={onBack}>← {fa ? "فهرست آزمون‌ها" : "Back to attempts"}</button>
      <div className="small muted mb8">{fa ? a.caseTitle_fa : a.caseTitle_en} · {(a.created_at || "").slice(0, 16).replace("T", " ")}</div>

      {/* section scores (verify AI grading) — the extern card uses the scoped
          extern score (history + exam + problem list + ddx), not the legacy
          history-only score. */}
      {ss && (
        <div className="grid grid-3 mb16">
          <div className="card center" style={{ borderInlineStart: "4px solid var(--primary)" }}>
            <div className="big" style={{ fontSize: "1.4rem" }}>{ss.extern ?? ss.history ?? "—"}%</div>
            <div className="small muted">{fa ? "ملاک اکسترن (تا تشخیص افتراقی)" : "Extern (up to the differential dx)"}</div>
          </div>
          {ss.other != null && <div className="card center" style={{ borderInlineStart: "4px solid var(--gold)" }}>
            <div className="big" style={{ fontSize: "1.4rem" }}>{ss.other}%</div><div className="small muted">{fa ? "سایر" : "Other"}</div></div>}
          <div className="card center" style={{ borderInlineStart: "4px solid var(--green)" }}>
            <div className="big" style={{ fontSize: "1.4rem" }}>{ss.intern ?? ss.overall}%</div><div className="small muted">{fa ? "ملاک اینترن" : "Intern"}</div>
          </div>
        </div>
      )}

      {/* the conversation transcript */}
      <div className="section-title"><h4><Icon name="chat" size={15} /> {t("conversation")}</h4></div>
      <div className="chat-review" style={{ maxHeight: 420, overflowY: "auto", background: "var(--panel2)", borderRadius: 12, padding: 12 }}>
        {msgs.length === 0 ? <div className="small muted center">{fa ? "متن گفت‌وگویی ثبت نشده." : "No transcript recorded."}</div> :
          msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "student" ? "flex-end" : "flex-start", marginBottom: 6 }}>
              <div style={{ maxWidth: "80%", padding: "6px 10px", borderRadius: 10, fontSize: ".9rem",
                background: m.role === "student" ? "var(--primary)" : (m.role === "teacher" || m.mode === "exam" ? "#e8f1fb" : (m.role === "lab" || m.role === "system" ? "var(--panel2, #eef3f9)" : "var(--panel)")),
                color: m.role === "student" ? "#fff" : "var(--text)",
                border: (m.role === "lab" || m.role === "system") ? "1px dashed var(--border)" : undefined }}>
                <div className="small" style={{ opacity: .7, marginBottom: 2 }}>{speakerLabel(m, t)}</div>
                {m.text}
                {m.audio?.map((a, j) => (
                  <audio key={j} controls src={a.url} preload="metadata" style={{ width: "100%", height: 32, marginTop: 6 }} />
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* what the student wrote + ordered (context for the grade) */}
      {(detail.transcript?.problemList?.length > 0 || detail.transcript?.ddx?.length > 0 ||
        detail.transcript?.tests?.length > 0 || detail.transcript?.imaging?.length > 0 || detail.transcript?.finalDx) && (
        <div className="small muted mt8">
          {detail.transcript?.problemList?.length > 0 && <div>📋 {fa ? "پرابلم لیست دانشجو" : "Student's problem list"}: {detail.transcript.problemList.join("؛ ")}</div>}
          {detail.transcript?.ddx?.length > 0 && <div>🔀 {fa ? "تشخیص‌های افتراقی دانشجو" : "Student's differentials"}: {detail.transcript.ddx.join("؛ ")}</div>}
          {detail.transcript?.tests?.length > 0 && <div>🧪 {fa ? "آزمایش‌ها" : "Tests"}: {detail.transcript.tests.join("، ")}</div>}
          {detail.transcript?.imaging?.length > 0 && <div>🩻 {fa ? "تصویربرداری" : "Imaging"}: {detail.transcript.imaging.join("، ")}</div>}
          {detail.transcript?.finalDx && <div>🎯 {fa ? "تشخیص نهایی دانشجو" : "Student's final Dx"}: {detail.transcript.finalDx}</div>}
        </div>
      )}

      {/* per-item checklist judgment (verify AI's per-criterion decision) */}
      {detail.eval?.results?.length > 0 && (
        <div className="mt16">
          <div className="section-title"><h4><Icon name="check" size={15} /> {t("checklist")}</h4></div>
          {detail.eval.results.map((r) => (
            <div className="check-item" key={r.id}>
              <div className={`status ${r.done ? "st-done" : "st-miss"}`}>{r.done ? "✓" : "✕"}</div>
              <div style={{ flex: 1 }}>{r.label}{r.reason && <div className="small muted">{r.reason}</div>}</div>
              <span className="tag">{t("weight")} {num(r.weight)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card mt16" style={{ background: "var(--panel2)" }}>
        <div className="section-title"><h4><Icon name="edit" size={15} /> {fa ? "فیدبک و اعتبارسنجی استاد" : "Teacher feedback & validation"}</h4></div>
        <div className="field"><label>{fa ? "تصمیم استاد" : "Your decision"}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="approved">{fa ? "تأیید امتیاز هوش مصنوعی" : "Approve AI score"}</option>
            <option value="adjusted">{fa ? "اصلاح امتیاز (دستی)" : "Adjust score (manual)"}</option>
            <option value="rejected">{fa ? "رد کردن" : "Reject"}</option>
          </select>
        </div>
        {status === "adjusted" && (
          <div className="field"><label>{fa ? "امتیاز اصلاح‌شده (۰ تا ۱۰۰)" : "Adjusted score (0–100)"}</label>
            <input type="number" min="0" max="100" value={tScore} onChange={(e) => setTScore(Math.max(0, Math.min(100, +e.target.value || 0)))} /></div>
        )}
        <div className="field"><label>{fa ? "فیدبک برای دانشجو" : "Feedback for the student"}</label>
          <textarea rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} /></div>
        <button className="btn btn-primary" disabled={busy || !a.id} onClick={saveReview}>{busy ? "…" : (fa ? "ثبت فیدبک" : "Save feedback")}</button>
      </div>
    </div>
  );
}

function VpConversations() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [rows, setRows] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    api.get("/classes/conversations").then((d) => setRows(Array.isArray(d?.attempts) ? d.attempts : [])).catch((e) => { setLoadErr(String(e.message || e)); setRows({ __err: true }); });
  };
  useEffect(() => { load(); }, []);
  const open = async (row) => {
    setBusy(true);
    try { setDetail(await api.get(`/classes/${row.class_id}/attempts/${row.id}`)); }
    catch (e) { alert(e.message); }
    finally { setBusy(false); }
  };
  const num = (n) => (n || 0).toLocaleString(fa ? "fa-IR" : "en-US");
  if (detail) {
    return (
      <div className="card">
        <ConversationDetail detail={detail} onBack={() => { setDetail(null); load(); }} />
      </div>
    );
  }
  return (
    <div className="card">
      <div className="section-title">
        <h4><Icon name="chat" size={16} /> {t("vpConversations")}</h4>
        <button className="btn btn-ghost btn-sm" onClick={load}>{fa ? "بروزرسانی" : "Refresh"}</button>
      </div>
      <div className="small muted mb16">
        {fa
          ? "اینجا همه گفت‌وگوهای ذخیره‌شدهٔ کلاس‌هاست: حرف دانشجو، بیمار مجازی، استاد مجازی (معاینه)، درخواست آزمایش/تصویربرداری و درسنامه. برای اعتبارسنجی نمره باز کنید."
          : "Every saved class conversation: student, virtual patient, supervising teacher (exam), lab/imaging orders and microlearning. Open one to validate the grade."}
      </div>
      {rows?.__err || loadErr ? <div className="empty-state"><div className="ico">⚠️</div><h3>{loadErr || (fa ? "بارگذاری گفت‌وگوها شکست خورد" : "Could not load conversations")}</h3><button className="btn btn-ghost mt16" onClick={() => { setRows(null); load(); }}>{fa ? "تلاش دوباره" : "Retry"}</button></div> : rows == null ? <Spinner /> : rows.length === 0 ? (
        <div className="small muted center" style={{ padding: 24 }}>{fa ? "هنوز گفت‌وگوی ذخیره‌شده‌ای نیست. ثبت گفت‌وگو را در تنظیمات کلاس روشن بگذارید." : "No saved conversations yet. Keep conversation logging on in the class settings."}</div>
      ) : (
        <div className="table-wrap"><table>
          <thead><tr>
            <th>{fa ? "دانشجو" : "Student"}</th>
            <th>{t("classes")}</th>
            <th>{t("caseTitle") || (fa ? "کیس" : "Case")}</th>
            <th>{t("classGrade")}</th>
            <th>{fa ? "متن" : "Log"}</th>
            <th>{fa ? "تاریخ" : "Date"}</th>
            <th></th>
          </tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td>{fa ? r.name_fa : r.name_en}<div className="small muted">{r.student_no}</div></td>
              <td>{fa ? r.class_fa : r.class_en} <span className="tag">{r.code}</span></td>
              <td>{fa ? r.title_fa : r.title_en}</td>
              <td><b>{num(r.score)}</b></td>
              <td>{r.has_transcript ? <span className="pill pill-active">{fa ? "ثبت شده" : "Saved"}</span> : <span className="pill pill-medium">{fa ? "بدون متن" : "No text"}</span>}</td>
              <td className="small muted">{(r.created_at || "").slice(0, 16).replace("T", " ")}</td>
              <td><button className="btn btn-sm btn-primary" disabled={busy} onClick={() => open(r)}>{fa ? "مشاهده" : "Open"}</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

function PickModal({ title, items, labelFn, idFn, selected, withWeight, initialWeights = {}, searchable = true, searchPlaceholder, onClose, onSave }) {
  const { t, lang } = useApp();
  const [sel, setSel] = useState(selected || []);
  const [weights, setWeights] = useState(initialWeights);
  const [q, setQ] = useState("");
  const toggle = (id) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const needle = q.trim().toLowerCase();
  // Show a search box for lists where scanning by eye gets slow. Real classes
  // have many students, so keep the threshold low (still hidden for tiny lists).
  const showSearch = searchable && items.length > 3;
  const visible = !needle ? items : items.filter((it) => String(labelFn(it) ?? "").toLowerCase().includes(needle));
  return (
    <Modal title={title} onClose={onClose} onSave={() => onSave(sel, weights)}>
      {showSearch && (
        <div className="dt-search pick-search" style={{ maxWidth: "100%", marginBottom: 10 }}>
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder || t("searchByName")} />
          {q && <button className="dt-clear" onClick={() => setQ("")}><Icon name="close" size={14} /></button>}
        </div>
      )}
      {showSearch && <div className="small muted mb8">{faDigits(String(sel.length), lang)} {t("selectedCount")}</div>}
      {visible.map((it) => {
        const id = idFn(it);
        return (
          <div key={id} className="toggle-row">
            <label style={{ cursor: "pointer", flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" checked={sel.includes(id)} onChange={() => toggle(id)} style={{ width: 18, height: 18 }} />
              <span>{labelFn(it)}</span>
            </label>
            {withWeight && sel.includes(id) &&
              <input type="number" min="1" value={weights[id] || 1} style={{ width: 70 }}
                onChange={(e) => setWeights((w) => ({ ...w, [id]: +e.target.value || 1 }))} />}
          </div>
        );
      })}
      {!items.length && <div className="small muted">—</div>}
      {items.length > 0 && !visible.length && <div className="small muted center" style={{ padding: 12 }}>{t("noResults")}</div>}
    </Modal>
  );
}


function MemberManageModal({ classId, items, selected, lang, onClose, onSaved }) {
  const { t } = useApp();
  const [sel, setSel] = useState(selected || []);
  const [bulk, setBulk] = useState("");
  const [result, setResult] = useState(null);
  const label = (u) => `${lang === "fa" ? u.name_fa : u.name_en} (${u.student_no})`;
  const saveIds = async () => { await api.put(`/classes/${classId}/members`, { userIds: sel }); onSaved(); };
  const resolve = async (createMissing = false) => {
    const studentNos = bulk.split(/[\n,;\s]+/).map((x) => x.trim()).filter(Boolean);
    const r = await api.post(`/classes/${classId}/members/resolve`, { studentNos, createMissing, attach: true });
    setResult(r);
    const ids = (r.existing || []).map((u) => u.id);
    setSel((s) => [...new Set([...s, ...ids])]);
    if (createMissing || ids.length) onSaved();
  };
  return <Modal title={t("selectStudents")} onClose={onClose}>
    <div className="grid grid-2">
      <div>
        <div className="small muted mb8">{lang === "fa" ? "انتخاب انفرادی از فهرست دانشجویان همان دانشگاه" : "Pick existing students from the same university"}</div>
        <div style={{ maxHeight: 360, overflow: "auto" }}>
          {items.map((u) => <label key={u.id} className="toggle-row" style={{ cursor: "pointer" }}>
            <span>{label(u)}</span><input type="checkbox" checked={sel.includes(u.id)} onChange={() => setSel((s)=>s.includes(u.id)?s.filter(x=>x!==u.id):[...s,u.id])}/>
          </label>)}
        </div>
      </div>
      <div>
        <div className="small muted mb8">{lang === "fa" ? "افزودن دسته‌جمعی با شماره دانشجویی؛ شماره‌های ثبت‌نشده نمایش داده می‌شوند و می‌توانید با یک دکمه بسازید." : "Bulk add by student numbers. Missing students are shown and can be created with one click."}</div>
        <textarea value={bulk} onChange={(e)=>setBulk(e.target.value)} style={{ width: "100%", minHeight: 130 }} placeholder="40012345\n40067890" />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>resolve(false)}>{lang === "fa" ? "بررسی و افزودن موجودها" : "Check & add existing"}</button>
          <button className="btn btn-accent btn-sm" onClick={()=>resolve(true)}>{lang === "fa" ? "ساخت missingها و افزودن" : "Create missing & add"}</button>
        </div>
        {result && <div className="card mt8" style={{ background: "var(--panel2)", padding: 10 }}>
          <div className="small">{lang === "fa" ? "اضافه‌شده" : "Attached"}: {result.attached || 0}</div>
          {!!result.missing?.length && <div className="small" style={{ color: "var(--flame)" }}>{lang === "fa" ? "ثبت‌نام‌نشده" : "Missing"}: {result.missing.join(", ")}</div>}
          {!!result.wrongUniversity?.length && <div className="small" style={{ color: "var(--flame)" }}>{lang === "fa" ? "دانشگاه متفاوت" : "Different university"}: {result.wrongUniversity.map(x=>x.student_no).join(", ")}</div>}
        </div>}
      </div>
    </div>
    <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:12 }}><button className="btn btn-primary" onClick={saveIds}>{t("save")}</button></div>
  </Modal>;
}

/* ================= SCHEDULED EXAMS (admin/teacher) ================= */
function Exams() {
  const { t, lang } = useApp();
  const [exams, setExams] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    api.get("/exams").then((d) => setExams(Array.isArray(d) ? d : [])).catch((e) => { setExams([]); setLoadErr(String(e.message || e)); });
  };
  useEffect(() => { load(); }, []);
  if (!exams) return <Spinner />;
  if (openId) return <ExamManage examId={openId} back={() => { setOpenId(null); load(); }} />;

  const del = async (id) => { if (confirm(t("confirmDelete"))) { await api.del(`/exams/${id}`); load(); } };
  const save = async (data, id) => {
    if (id) await api.put(`/exams/${id}`, data); else await api.post("/exams", data);
    setEditing(null); toast(t("saved")); load();
  };
  const stateLabel = (s) => s === "open" ? t("stateOpen") : s === "upcoming" ? t("stateUpcoming") : t("stateEnded");
  const stateKind = (s) => s === "open" ? "active" : s === "upcoming" ? "medium" : "inactive";

  return (
    <div className="card">
      <div className="section-title"><h4><Icon name="exam" size={16} /> {t("exams")}</h4>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>+ {t("newExam")}</button></div>
      {loadErr && <div className="err-banner mb8">{loadErr} <button className="btn btn-ghost btn-sm" onClick={load}>{lang === "fa" ? "تلاش دوباره" : "Retry"}</button></div>}
      <DataTable
        rows={exams}
        initialSort={{ key: "title", dir: "asc" }}
        searchKeys={[(e) => e.title_fa, (e) => e.title_en]}
        rowKey={(e) => e.id}
        empty={<div className="empty-state" style={{ padding: 8 }}>
          <div className="ico"><Icon name="exam" size={36} /></div>
          <h3>{t("examsEmptyTitle")}</h3>
          <div className="small muted">{t("examsEmptyHint")}</div>
          <button className="btn btn-primary btn-sm mt8" onClick={() => setEditing({})}>+ {t("newExam")}</button>
        </div>}
        columns={[
          { key: "title", label: t("examTitle"), sortValue: (e) => biField(e, "title", lang), render: (e) => biField(e, "title", lang) },
          { key: "window", label: t("examWindow"), sortable: false, render: (e) => <span className="small muted">{fmtDT(e.starts_at, lang)} → {fmtDT(e.ends_at, lang)}</span> },
          { key: "participants", label: t("participants"), sortValue: (e) => e.nStudents || 0, render: (e) => e.nStudents },
          { key: "status", label: t("status"), sortValue: (e) => e.state, render: (e) => <Pill kind={stateKind(e.state)}>{stateLabel(e.state)}</Pill> },
          { key: "actions", label: "", sortable: false, thStyle: { textAlign: "end" }, render: (e) => (
            <span style={{ display: "flex", gap: 4, justifyContent: "flex-end", whiteSpace: "nowrap" }}>
              <button className="btn btn-sm btn-primary" onClick={() => setOpenId(e.id)}>{t("manageStudents")}</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setEditing(e)}>{t("edit")}</button>
              <button className="btn btn-sm btn-danger" onClick={() => del(e.id)}>{t("delete")}</button>
            </span>) },
        ]}
      />
      {editing && <ExamModal exam={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function fmtDT(s, lang) { return fmtDateTime(s, lang || "fa"); }
// Convert ASCII digits in a string (e.g. "09:30") to Persian digits when fa.
function faDigits(s, lang) {
  if (lang !== "fa" || s == null) return s;
  return String(s).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
}
/* Reusable flashcard picker for teachers/admins: searchable + grouped by the
   card's category (درس/موضوع) so a large bank is easy to navigate. Shows the
   teacher-facing TITLE (never shown to students). */

function cardTitle(c, lang) { return biField(c, "title", lang) || biField(c, "questionText", lang) || biField(c, "q", lang) || `#${c.id}`; }
function cardCat(c, lang, t) { return biField(c, "category", lang) || biField(c, "course", lang) || t("uncategorized") || "—"; }
function cardCourse(c, lang, t) { return biField(c, "course", lang) || t("uncategorized") || "—"; }
function cardType(c) { return c.type || c.questionType || "mcq"; }
function cardSearchText(c) { return [c.id,c.title_fa,c.title_en,c.q_fa,c.q_en,c.questionText_fa,c.questionText_en,c.category_fa,c.category_en,c.course_fa,c.course_en,c.difficulty,c.type,c.questionType,c.answerMode].join(" ").toLowerCase(); }
function uniqSorted(arr) { return [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"fa")); }

/* Professional question-bank picker: search + filters + grouped selection.
   Used when building exams so teachers can find cards quickly in large banks. */
function CardPicker({ cards, selected, onToggle, onSelectAll }) {
  const { t, lang } = useApp();
  const [q, setQ] = useState("");
  const [course, setCourse] = useState("");
  const [cat, setCat] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [type, setType] = useState("");
  const sel = new Set(selected || []);
  const courses = uniqSorted(cards.map((c) => cardCourse(c, lang, t)));
  const cats = uniqSorted(cards.map((c) => cardCat(c, lang, t)));
  const diffs = uniqSorted(cards.map((c) => c.difficulty || "medium"));
  const types = uniqSorted(cards.map(cardType));
  const needle = q.trim().toLowerCase();
  const visible = cards.filter((c) => {
    if (course && cardCourse(c, lang, t) !== course) return false;
    if (cat && cardCat(c, lang, t) !== cat) return false;
    if (difficulty && (c.difficulty || "medium") !== difficulty) return false;
    if (type && cardType(c) !== type) return false;
    return !needle || cardSearchText(c).includes(needle);
  });
  const groups = {};
  for (const c of visible) { const k = `${cardCourse(c, lang, t)} / ${cardCat(c, lang, t)}`; (groups[k] = groups[k] || []).push(c); }
  const groupNames = Object.keys(groups).sort((a,b)=>a.localeCompare(b,"fa"));
  const visibleIds = visible.map((c) => c.id);
  const allVisibleOn = visibleIds.length && visibleIds.every((id) => sel.has(id));
  const setAllVisible = () => onSelectAll(allVisibleOn ? (selected || []).filter((id) => !visibleIds.includes(id)) : [...new Set([...(selected || []), ...visibleIds])]);
  const toggleGroup = (name) => {
    const ids = groups[name].map((c) => c.id);
    const allOn = ids.every((id) => sel.has(id));
    onSelectAll(allOn ? (selected || []).filter((id) => !ids.includes(id)) : [...new Set([...(selected || []), ...ids])]);
  };
  return (
    <div className="card-picker pro-picker">
      <div className="dt-search mb8" style={{ maxWidth: "100%" }}>
        <Icon name="search" size={15} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchFlashcardsPh") || (lang === "fa" ? "جستجو در عنوان، سؤال، دسته، ID…" : "Search title, question, category, ID…")} />
        {q && <button className="dt-clear" onClick={() => setQ("")}><Icon name="close" size={13} /></button>}
      </div>
      <div className="picker-filters">
        <select value={course} onChange={(e)=>setCourse(e.target.value)}><option value="">{lang==="fa"?"همه دوره‌ها":"All courses"}</option>{courses.map(x=><option key={x} value={x}>{x}</option>)}</select>
        <select value={cat} onChange={(e)=>setCat(e.target.value)}><option value="">{lang==="fa"?"همه دسته‌ها":"All categories"}</option>{cats.map(x=><option key={x} value={x}>{x}</option>)}</select>
        <select value={difficulty} onChange={(e)=>setDifficulty(e.target.value)}><option value="">{lang==="fa"?"همه سختی‌ها":"All difficulties"}</option>{diffs.map(x=><option key={x} value={x}>{x}</option>)}</select>
        <select value={type} onChange={(e)=>setType(e.target.value)}><option value="">{lang==="fa"?"همه نوع‌ها":"All types"}</option>{types.map(x=><option key={x} value={x}>{x}</option>)}</select>
      </div>
      <div className="picker-toolbar small muted">
        <span>{(selected || []).length} {t("selectedCount") || (lang==="fa"?"انتخاب‌شده":"selected")} · {visible.length} {lang==="fa"?"نتیجه":"results"}</span>
        <button type="button" className="chip-btn" disabled={!visible.length} onClick={setAllVisible}>{allVisibleOn ? (t("deselectAll")||"Deselect") : (t("selectAll")||"Select all")}</button>
      </div>
      {groupNames.length === 0 && <div className="small muted center" style={{ padding: 14 }}>{t("noFlashcardsAvail")}</div>}
      {groupNames.map((name) => {
        const ids = groups[name].map((c) => c.id); const allOn = ids.every((id) => sel.has(id));
        return <div className="cp-group" key={name}>
          <div className="cp-group-head"><span className="cp-cat">📚 {name} <span className="cp-count">({groups[name].length})</span></span><button type="button" className="chip-btn" onClick={() => toggleGroup(name)}>{allOn ? t("deselectAll") : t("selectAll")}</button></div>
          <div className="picker-list">
            {groups[name].map((c) => <label key={c.id} className="toggle-row picker-card" style={{ cursor: "pointer" }}>
              <span className="picker-card-text"><b>{cardTitle(c, lang)}</b><small>#{c.id} · {c.difficulty || "medium"} · {cardType(c)}</small></span>
              <input type="checkbox" checked={sel.has(c.id)} onChange={() => onToggle(c.id)} style={{ width: 18, height: 18 }} />
            </label>)}
          </div>
        </div>;
      })}
    </div>
  );
}


/* Flashcard picker with search/filter/grouping + per-set graded/practice + weight. */
function ExamModal({ exam, onClose, onSave }) {
  const { t, lang } = useApp();
  const [cases, setCases] = useState([]);
  const [cards, setCards] = useState([]);
  const [f, setF] = useState({
    title_fa: "", title_en: "", desc_fa: "", desc_en: "",
    case_ids: [], flashcard_ids: [], use_flashcards: false,
    duration_min: 30, max_attempts: 1, lang: "both",
    shuffle: false, anti_cheat: true, competition: false, show_correct: true, show_hints: true, show_ai: true, show_micro: true,
    ...exam,
    logTranscript: !!exam.log_transcript, studyId: exam.study_id || exam.studyId || "",
  });
  // Shamsi schedule: one date + a start/end time window (Iran time). Derived
  // from the exam's stored ISO start/end, defaulting to today 10:00–11:00.
  const sStart = exam.starts_at ? isoToJalaliParts(exam.starts_at) : null;
  const sEnd = exam.ends_at ? isoToJalaliParts(exam.ends_at) : null;
  const [tj, tm, td] = todayJalali();
  const [sched, setSched] = useState({
    jy: sStart?.jy ?? tj, jm: sStart?.jm ?? tm, jd: sStart?.jd ?? td,
    fromTime: sStart?.time ?? "10:00", toTime: sEnd?.time ?? "11:00",
  });
  const setSched2 = (k, v) => setSched((s) => ({ ...s, [k]: v }));
  // derive the exam "type" from existing data (edit) or default to null (new)
  const initialType = exam.id
    ? (exam.use_flashcards && (exam.case_ids || []).length ? "both" : exam.use_flashcards ? "flash" : "vp")
    : null;
  const [type, setType] = useState(initialType);

  const [bankErr, setBankErr] = useState("");
  useEffect(() => {
    setBankErr("");
    api.get("/cases").then((d) => setCases(Array.isArray(d) ? d : [])).catch((e) => { setCases([]); setBankErr(String(e.message || e)); });
    api.get("/flashcards").then((d) => setCards(Array.isArray(d) ? d : [])).catch((e) => { setCards([]); setBankErr(String(e.message || e)); });
  }, []);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleIn = (key, id) => setF((s) => ({
    ...s, [key]: s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id],
  }));
  const submit = () => onSave({
    ...f,
    use_flashcards: type === "flash" || type === "both",
    case_ids: type === "flash" ? [] : f.case_ids,
    flashcard_ids: (type === "vp") ? [] : f.flashcard_ids,
    logTranscript: !!f.logTranscript,
    studyId: f.studyId === "" ? null : +f.studyId,
    starts_at: jalaliTimeToIso(sched.jy, sched.jm, sched.jd, sched.fromTime),
    ends_at: jalaliTimeToIso(sched.jy, sched.jm, sched.jd, sched.toTime),
  }, exam.id);

  // STEP 1 — choose exam type (only for a brand-new exam)
  if (!type) {
    return (
      <Modal title={t("newExam")} onClose={onClose}>
        <div className="small muted mb16">{t("chooseExamType")}</div>
        {bankErr && <div className="err-banner mb8">{bankErr}</div>}
        <div className="grid grid-3">
          <div className="card mod-card center" onClick={() => setType("vp")}>
            <div className="mod-ico" style={{ background: "var(--grad-primary)", margin: "0 auto 12px" }}><Icon name="patient" size={30} /></div>
            <h3 style={{ fontSize: "1rem" }}>{t("modVirtualPatient")}</h3>
          </div>
          <div className="card mod-card center" onClick={() => setType("flash")}>
            <div className="mod-ico" style={{ background: "var(--grad-green)", margin: "0 auto 12px" }}><Icon name="flask" size={30} /></div>
            <h3 style={{ fontSize: "1rem" }}>{t("modFlashcard")}</h3>
          </div>
          <div className="card mod-card center" onClick={() => setType("both")}>
            <div className="mod-ico" style={{ background: "var(--grad-purple)", margin: "0 auto 12px" }}><Icon name="puzzle" size={30} /></div>
            <h3 style={{ fontSize: "1rem" }}>{t("examBoth")}</h3>
          </div>
        </div>
      </Modal>
    );
  }

  const showVp = type === "vp" || type === "both";
  const showFlash = type === "flash" || type === "both";
  const typeLabel = type === "vp" ? t("modVirtualPatient") : type === "flash" ? t("modFlashcard") : t("examBoth");

  return (
    <Modal title={`${exam.id ? t("edit") : t("newExam")} — ${typeLabel}`} onClose={onClose} onSave={submit}>
      {bankErr && <div className="err-banner mb8">{bankErr}</div>}
      {!exam.id && <button className="btn btn-sm btn-ghost mb16" onClick={() => setType(null)}>← {t("changeType")}</button>}
      <div className="grid grid-2">
        <div className="field"><label>{t("examTitle")} (FA)</label><input value={f.title_fa} onChange={(e) => set("title_fa", e.target.value)} /></div>
        <div className="field"><label>{t("examTitle")} (EN)</label><input value={f.title_en} onChange={(e) => set("title_en", e.target.value)} /></div>
      </div>
      <div className="field"><label>{t("examDescField")} (FA)</label><textarea value={f.desc_fa} onChange={(e) => set("desc_fa", e.target.value)} /></div>
      <div className="field"><label>{t("examDescField")} (EN)</label><textarea value={f.desc_en} onChange={(e) => set("desc_en", e.target.value)} /></div>

      {showVp && (<>
        <div className="divider" />
        <label className="small muted"><Icon name="patient" size={16} /> {t("selectVpCases")}</label>
        {cases.map((c) => (
          <label key={c.id} className="toggle-row" style={{ cursor: "pointer" }}>
            <span>{biField(c, "title", lang)}</span>
            <input type="checkbox" checked={f.case_ids.includes(c.id)} onChange={() => toggleIn("case_ids", c.id)} style={{ width: 18, height: 18 }} />
          </label>
        ))}
      </>)}

      {showFlash && (<>
        <div className="divider" />
        <label className="small muted"><Icon name="flask" size={16} /> {t("selectFlashcards")}</label>
        <div className="small muted mb8">{t("flashAllHint")}</div>
        <CardPicker cards={cards} selected={f.flashcard_ids} onToggle={(id) => toggleIn("flashcard_ids", id)}
          onSelectAll={(ids) => set("flashcard_ids", ids)} />
      </>)}

      <div className="divider" />
      {/* Shamsi date + a start/end time WINDOW (Iran time). e.g. 1405/05/10,
          from 10:00 to 11:00, duration 30 min. No Gregorian picker anywhere. */}
      <label className="small muted"><Icon name="clock" size={16} /> {t("examSchedule")} <span className="small muted">({lang === "fa" ? "به وقت ایران" : "Iran time"})</span></label>
      <ShamsiDatePicker jy={sched.jy} jm={sched.jm} jd={sched.jd}
        onChange={(p) => setSched((s) => ({ ...s, ...p }))} />
      <div className="grid grid-3 mt8">
        <div className="field"><label>{t("examFromTime")}</label>
          <input type="time" value={sched.fromTime} onChange={(e) => setSched2("fromTime", e.target.value)} /></div>
        <div className="field"><label>{t("examToTime")}</label>
          <input type="time" value={sched.toTime} onChange={(e) => setSched2("toTime", e.target.value)} /></div>
        <div className="field"><label>{t("examDurationMin")}</label>
          <input type="number" min="1" value={f.duration_min} onChange={(e) => set("duration_min", +e.target.value || 30)} /></div>
      </div>
      <div className="small muted mt4">📅 {fmtDateLong(jalaliTimeToIso(sched.jy, sched.jm, sched.jd, sched.fromTime), lang)} · {faDigits(sched.fromTime, lang)}–{faDigits(sched.toTime, lang)} · {faDigits(String(f.duration_min), lang)} {t("min")}</div>
      <div className="field mt8"><label>{t("examMaxAttempts")}</label>
        <input type="number" min="1" value={f.max_attempts} onChange={(e) => set("max_attempts", +e.target.value || 1)} /></div>
      <div className="field"><label>{t("examLang")}</label>
        <select value={f.lang} onChange={(e) => set("lang", e.target.value)}>
          <option value="both">FA + EN</option><option value="fa">فارسی</option><option value="en">English</option></select></div>

      <div className="divider" />
      <label className="small muted"><Icon name="settings" size={16} /> {t("examSettings")}</label>
      <label className="toggle-row" style={{ cursor: "pointer" }}>
        <span><Icon name="dice" size={16} /> {t("shuffleQuestions")}</span>
        <div className={`switch ${f.shuffle ? "on" : ""}`} onClick={() => set("shuffle", !f.shuffle)} /></label>
      <label className="toggle-row" style={{ cursor: "pointer" }}>
        <span><Icon name="shield" size={16} /> {t("antiCheat")}</span>
        <div className={`switch ${f.anti_cheat ? "on" : ""}`} onClick={() => set("anti_cheat", !f.anti_cheat)} /></label>
      <label className="toggle-row" style={{ cursor: "pointer" }}>
        <span><Icon name="trophy" size={16} /> {t("competitionMode")}</span>
        <div className={`switch ${f.competition ? "on" : ""}`} onClick={() => set("competition", !f.competition)} /></label>
      <label className="toggle-row" style={{ cursor: "pointer" }}>
        <span>{t("showCorrect")}</span>
        <div className={`switch ${f.show_correct ? "on" : ""}`} onClick={() => set("show_correct", !f.show_correct)} /></label>
      <label className="toggle-row" style={{ cursor: "pointer" }}>
        <span>{t("showHints")}</span>
        <div className={`switch ${f.show_hints ? "on" : ""}`} onClick={() => set("show_hints", !f.show_hints)} /></label>
      <label className="toggle-row" style={{ cursor: "pointer" }}>
        <span>{t("showAiAnalysis")}</span>
        <div className={`switch ${f.show_ai ? "on" : ""}`} onClick={() => set("show_ai", !f.show_ai)} /></label>
      <label className="toggle-row" style={{ cursor: "pointer" }}>
        <span>{t("showMicro")}</span>
        <div className={`switch ${f.show_micro ? "on" : ""}`} onClick={() => set("show_micro", !f.show_micro)} /></label>
      <div className="small muted mt8">{t("antiCheatHint")}</div>
      <div className="divider" />
      <label className="toggle-row" style={{ cursor: "pointer" }}>
        <span><Icon name="flask" size={16} /> {lang === "fa" ? "ثبت گفت‌وگو برای پژوهش" : "Log encounter for research"}</span>
        <div className={`switch ${f.logTranscript ? "on" : ""}`} onClick={() => set("logTranscript", !f.logTranscript)} /></label>
      <ClassStudyField value={f.studyId} onChange={(id) => set("studyId", id)} />
    </Modal>
  );
}

/* Search students by name or student number and add them by clicking. */
function StudentSearchAdd({ onAdd }) {
  const { t, lang } = useApp();
  const [all, setAll] = useState([]);
  const [stuErr, setStuErr] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    setStuErr("");
    api.get("/users?role=student").then((d) => setAll(Array.isArray(d) ? d : [])).catch((e) => { setAll([]); setStuErr(String(e.message || e)); });
  }, []);
  const needle = q.trim().toLowerCase();
  const matches = !needle ? [] : all.filter((u) =>
    [u.name_fa, u.name_en, u.student_no, u.username].some((v) => String(v ?? "").toLowerCase().includes(needle))
  ).slice(0, 8);
  return (
    <div className="stu-search mb8">
      {stuErr && <div className="err small mb8">{stuErr}</div>}
      <div className="dt-search" style={{ maxWidth: "100%" }}>
        <Icon name="search" size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchByNameOrNo")} />
        {q && <button className="dt-clear" onClick={() => setQ("")}><Icon name="close" size={14} /></button>}
      </div>
      {matches.length > 0 && (
        <div className="stu-results">
          {matches.map((u) => (
            <button key={u.id} className="stu-result-item" onClick={() => { if (u.student_no) onAdd(u.student_no); setQ(""); }}>
              <span>{lang === "fa" ? u.name_fa : u.name_en}</span>
              <span className="small muted">{u.student_no || "—"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ExamManage({ examId, back }) {
  const { t, lang } = useApp();
  const [data, setData] = useState(null);
  const [nos, setNos] = useState("");
  const [msg, setMsg] = useState("");
  const [missingNos, setMissingNos] = useState([]);
  const [wrongUni, setWrongUni] = useState([]);
  const [drawingOpen, setDrawingOpen] = useState(false);
  const toast = useToast();
  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    api.get(`/exams/${examId}`).then((d) => {
    setData(d);
    setNos((d.participants || []).map((p) => p.student_no).join("\n"));
  }).catch((e) => setLoadErr(String(e.message || e)));
  };
  useEffect(() => { load(); }, [examId]);
  if (loadErr) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{loadErr}</h3><button className="btn btn-ghost mt16" onClick={() => { setData(null); load(); }}>{lang === "fa" ? "تلاش دوباره" : "Retry"}</button><button className="btn btn-ghost mt16" onClick={back}>{lang === "fa" ? "بازگشت" : "Back"}</button></div>;
  if (!data) return <Spinner />;

  const save = async () => {
    const studentNos = nos.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    const res = await api.put(`/exams/${examId}/participants`, { studentNos });
    toast(t("saved"));
    setMissingNos(res.notFound || []);
    setWrongUni(res.wrongUniversity || []);
    setMsg(res.notFound && res.notFound.length ? `${t("notFoundNos")}: ${res.notFound.join(", ")}` : "");
    load();
  };
  const createMissing = async () => {
    const studentNos = nos.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    const res = await api.put(`/exams/${examId}/participants`, { studentNos, createMissing: true });
    setMissingNos(res.notFound || []); setWrongUni(res.wrongUniversity || []);
    toast(t("saved")); load();
  };

  return (
    <div className="card">
      <div className="section-title"><h4><Icon name="exam" size={16} /> {biField(data, "title", lang)}</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-sm" onClick={() => setDrawingOpen(true)}>{lang === "fa" ? "بررسی تصاویر" : "Review drawings"}</button>
          <button className="btn btn-ghost btn-sm" onClick={back}>← {t("back")}</button>
        </div></div>

      <div className="card mb16" style={{ background: "var(--panel2)" }}>
        <h4 className="mb8"><Icon name="users" size={16} /> {t("assignByStudentNo")}</h4>
        <StudentSearchAdd onAdd={(sn) => setNos((prev) => {
          const list = prev.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
          if (list.includes(sn)) return prev;
          return [...list, sn].join("\n");
        })} />
        <div className="small muted mb8 mt8">{t("studentNosHint")}</div>
        <textarea value={nos} onChange={(e) => setNos(e.target.value)} style={{ width: "100%", minHeight: 90 }}
          placeholder="40012345, 40067890 ..." />
        {msg && <div className="err-banner mt8" style={{ margin: "8px 0" }}>{msg}</div>}
        {wrongUni.length > 0 && <div className="err-banner mt8" style={{ margin: "8px 0" }}>{lang === "fa" ? "دانشگاه متفاوت:" : "Different university:"} {wrongUni.map((x)=>x.student_no).join(", ")}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary mt8" onClick={save}>{t("saveParticipants")}</button>
          {missingNos.length > 0 && <button className="btn btn-accent mt8" onClick={createMissing}>{lang === "fa" ? "ساخت دانشجویان ثبت‌نشده و افزودن" : "Create missing students & add"}</button>}
        </div>
      </div>

      <TeachingAnalyticsPanel kind="exam" id={examId} />

      {data.competition && (
        <div className="mb16"><Leaderboard examId={examId} /></div>
      )}

      <h4 className="mb8"><Icon name="chart" size={16} /> {t("gradebook")}</h4>
      <div className="table-wrap"><table>
        <thead><tr><th>{t("name")}</th><th>{t("studentNo")}</th><th>{t("attemptsUsedShort")}</th><th>{t("bestScore")}</th></tr></thead>
        <tbody>{(data.participants || []).map((p) => (
          <tr key={p.id}>
            <td>{lang === "fa" ? p.name_fa : p.name_en}</td>
            <td>{p.student_no}</td>
            <td>{p.attempts || 0}</td>
            <td><b style={{ color: "var(--accent)" }}>{p.best ?? "—"}</b></td>
          </tr>
        ))}</tbody></table></div>
      {drawingOpen && <DrawingReviewsModal scope="exam" id={examId} title={lang === "fa" ? "بررسی تصاویر آزمون" : "Exam drawing review"} onClose={() => setDrawingOpen(false)} />}
    </div>
  );
}

/* ================= EXAM RESULTS (admin/teacher) ================= */
function ExamResults() {
  const { t, lang } = useApp();
  const [type, setType] = useState("vp");            // vp | flash
  const [rows, setRows] = useState(null);
  const [exams, setExams] = useState([]);
  const [viewStudent, setViewStudent] = useState(null); // user_id for report card
  const [reviewId, setReviewId] = useState(null);       // attempt id for teacher review
  const [examFilter, setExamFilter] = useState("all"); // "all" | "none" | exam id
  const [sort, setSort] = useState({ key: "created_at", dir: "desc" });
  const [showChart, setShowChart] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [examsErr, setExamsErr] = useState("");
  const reloadRows = () => {
    setLoadErr("");
    api.get(`/reports/attempts?type=${type}`).then((d) => setRows(Array.isArray(d) ? d : [])).catch((e) => { setRows([]); setLoadErr(String(e.message || e)); });
  };

  useEffect(() => { setRows(null); reloadRows(); }, [type]);
  useEffect(() => { setExamsErr(""); api.get("/exams").then(setExams).catch((e) => { setExams([]); setExamsErr(String(e.message || e)); }); }, []);

  const setSortKey = (key) =>
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });

  // apply exam filter first
  const filtered = useMemo(() => {
    if (!rows) return [];
    if (examFilter === "all") return rows;
    if (examFilter === "none") return rows.filter((a) => !a.exam_id);
    return rows.filter((a) => String(a.exam_id) === String(examFilter));
  }, [rows, examFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      let av = a[key], bv = b[key];
      if (key === "student") { av = lang === "fa" ? a.student_fa : a.student_en; bv = lang === "fa" ? b.student_fa : b.student_en; }
      if (key === "created_at") { av = a.created_at || ""; bv = b.created_at || ""; }
      if (typeof av === "string" || typeof bv === "string") {
        return dir === "asc" ? String(av || "").localeCompare(String(bv || "")) : String(bv || "").localeCompare(String(av || ""));
      }
      return dir === "asc" ? (av || 0) - (bv || 0) : (bv || 0) - (av || 0);
    });
    return arr;
  }, [filtered, sort, lang]);

  // Comparison chart: average score per student (best-effort readable) among filtered rows
  const comparison = useMemo(() => {
    const byStudent = {};
    for (const a of filtered) {
      const name = (lang === "fa" ? a.student_fa : a.student_en) || a.student_no || "?";
      (byStudent[name] = byStudent[name] || []).push(a.score || 0);
    }
    return Object.entries(byStudent)
      .map(([name, arr]) => ({
        label: name.length > 10 ? name.slice(0, 9) + "…" : name,
        value: Math.round(arr.reduce((x, y) => x + y, 0) / arr.length),
      }))
      .sort((x, y) => y.value - x.value)
      .slice(0, 12);
  }, [filtered, lang]);

  const exportCsv = async () => {
    const qs = new URLSearchParams({ type });
    if (examFilter !== "all") qs.set("examId", examFilter);
    const res = await fetch(`/api/reports/export.csv?${qs.toString()}`, { credentials: "same-origin", headers: { Authorization: `Bearer ${getToken()}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const suffix = examFilter !== "all" ? `exam_${examFilter}` : type;
    const a = document.createElement("a"); a.href = url; a.download = `results_${suffix}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  const deleteAttempt = async (id) => {
    if (!confirm(lang === "fa" ? "این کارنامه حذف شود؟" : "Delete this report?")) return;
    await api.del(`/reports/attempts/${id}`);
    reloadRows();
  };

  const vpCols = [
    ["student", t("name")], ["student_no", t("studentNo")], ["case", t("caseTitle")],
    ["score", t("finalScore")], ["turns", t("questionsAnswered")], ["tests", t("testsOrdered")],
    ["imaging_count", t("imagingOrdered")], ["ddx_count", t("ddx")],
    ["duration_sec", t("duration")], ["created_at", t("dateTime")],
    ["review", lang === "fa" ? "بررسی استاد" : "Teacher review"],
    ["delete", ""],
  ];
  const flashCols = [
    ["student", t("name")], ["student_no", t("studentNo")],
    ["score", t("finalScore")], ["total_questions", t("totalQ")], ["correct_count", t("correctA")],
    ["wrong_count", t("wrongA")], ["hints", t("hintsUsed")],
    ["duration_sec", t("duration")], ["created_at", t("dateTime")], ["delete", ""],
  ];
  const cols = type === "vp" ? vpCols : flashCols;
  const arrow = (k) => sort.key === k ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
  const cell = (a, key) => {
    if (key === "student") return (
      <button className="linklike" onClick={() => setViewStudent(a.user_id)}>
        {lang === "fa" ? a.student_fa : a.student_en}
      </button>
    );
    if (key === "case") return lang === "fa" ? a.case_fa : a.case_en;
    if (key === "created_at") return fmtDateTime(a.created_at, lang);
    if (key === "duration_sec") return fmtDuration(a.duration_sec);
    if (key === "score") {
      const st = a.teacher_status;
      const badge = st === "approved" ? { txt: lang === "fa" ? "تأییدشده" : "approved", c: "var(--ok)" }
        : st === "adjusted" ? { txt: lang === "fa" ? "اصلاح‌شده" : "adjusted", c: "#c98a00" }
        : st === "rejected" ? { txt: lang === "fa" ? "ردشده" : "rejected", c: "var(--danger)" } : null;
      return (
        <span style={{ whiteSpace: "nowrap" }}>
          <b style={{ color: "var(--primary)" }}>{a.final_score ?? a.score}</b>
          {st === "adjusted" && a.score != null && <span className="small muted"> (AI: {a.score})</span>}
          {badge && <span className="tag" style={{ marginInlineStart: 6, color: badge.c, borderColor: badge.c }}>{badge.txt}</span>}
        </span>
      );
    }
    if (key === "review") return (
      <button className="btn btn-sm btn-ghost" onClick={() => setReviewId(a.id)}>
        <Icon name="edit" size={13} /> {lang === "fa" ? "بررسی" : "Review"}
      </button>
    );
    if (key === "delete") return (
      <button className="btn btn-sm btn-danger" onClick={() => deleteAttempt(a.id)} title={lang === "fa" ? "حذف کارنامه" : "Delete report"}>
        <Icon name="trash" size={13} />
      </button>
    );
    return a[key] ?? 0;
  };

  return (
    <div className="card">
      <div className="section-title"><h4><Icon name="trophy" size={16} /> {t("examResults")}</h4>
        <button className="btn btn-accent btn-sm" onClick={exportCsv}><Icon name="download" size={16} /> {t("exportCsv")}</button></div>
      {(loadErr || examsErr) && <div className="err-banner mb8">{loadErr || examsErr} <button className="btn btn-ghost btn-sm" onClick={reloadRows}>{lang === "fa" ? "تلاش دوباره" : "Retry"}</button></div>}

      <div className="tabs mb16">
        <button className={`tab ${type === "vp" ? "active" : ""}`} onClick={() => setType("vp")}><Icon name="patient" size={16} /> {t("vpExams")}</button>
        <button className={`tab ${type === "flash" ? "active" : ""}`} onClick={() => setType("flash")}><Icon name="flask" size={16} /> {t("flashPractice")}</button>
      </div>

      {/* filter by exam + toggle chart */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
        <div className="field" style={{ margin: 0, minWidth: 220 }}>
          <label>{t("filterByExam")}</label>
          <select value={examFilter} onChange={(e) => setExamFilter(e.target.value)}>
            <option value="all">{t("allResults")}</option>
            <option value="none">{t("freePractice")}</option>
            {exams.map((e) => <option key={e.id} value={e.id}>{biField(e, "title", lang)}</option>)}
          </select>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowChart((v) => !v)}>
          <Icon name="chart" size={16} /> {showChart ? t("hideChart") : t("showChart")}
        </button>
        <div className="small muted" style={{ marginInlineStart: "auto" }}>
          {t("recordsCount")}: {filtered.length}
        </div>
      </div>

      {/* comparison chart */}
      {showChart && comparison.length > 0 && (
        <div className="card mb16" style={{ background: "var(--panel2)" }}>
          <h4 style={{ border: "none", padding: 0, marginBottom: 12 }}><Icon name="chart" size={16} /> {t("studentComparison")}</h4>
          <BarChart data={comparison} max={100} unit="" />
        </div>
      )}

      {!rows ? <Spinner /> : sorted.length === 0 ? (
        <div className="small muted center" style={{ padding: 30 }}>{t("noData")}</div>
      ) : (
        <div className="table-wrap"><table>
          <thead><tr>{cols.map(([k, label]) => (
            <th key={k} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
              onClick={() => setSortKey(k)}>{label}{arrow(k)}</th>
          ))}</tr></thead>
          <tbody>{sorted.map((a) => (
            <tr key={a.id}>{cols.map(([k]) => <td key={k} style={{ whiteSpace: "nowrap" }}>{cell(a, k)}</td>)}</tr>
          ))}</tbody>
        </table></div>
      )}
      <div className="small muted mt8">{t("clickToSort")} · {t("clickNameForCard")}</div>
      {viewStudent && <StudentReportCard userId={viewStudent} onClose={() => setViewStudent(null)} />}
      {reviewId && <AttemptReviewModal attemptId={reviewId} onClose={() => setReviewId(null)} onSaved={() => { setReviewId(null); reloadRows(); }} />}
    </div>
  );
}

/* ---- Teacher review of a single attempt: full log + approve/adjust/reject ---- */
function AttemptReviewModal({ attemptId, onClose, onSaved }) {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [d, setD] = useState(null);
  const [status, setStatus] = useState("approved");
  const [tScore, setTScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get(`/reports/attempts/${attemptId}`).then((x) => {
      setD(x);
      setStatus(x.teacher_status || "approved");
      setTScore(x.teacher_score ?? x.score ?? 0);
      setFeedback(x.teacher_feedback || "");
    }).catch((e) => setD({ __err: true, message: String(e.message || e) }));
  }, [attemptId]);

  if (d?.__err) return <Modal title={t("error")} onClose={onClose}><div className="empty-state"><h3>{d.message || (fa ? "بارگذاری بررسی شکست خورد" : "Could not load the review")}</h3></div></Modal>;
  if (!d) return <Modal title={fa ? "بررسی" : "Review"} onClose={onClose}><Spinner /></Modal>;

  const ev = d.eval || {};
  const tr = d.transcript || {};
  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/reports/attempts/${attemptId}/review`, { status, teacher_score: tScore, teacher_feedback: feedback });
      toast(fa ? "ثبت شد" : "Saved"); onSaved?.();
    } catch (e) { toast(e.message || "error"); } finally { setBusy(false); }
  };

  return (
    <Modal title={`${fa ? "بررسی عملکرد" : "Review"} — ${fa ? d.student_fa : d.student_en}`} onClose={onClose} onSave={save} saveLabel={busy ? "…" : (fa ? "ثبت بررسی" : "Save review")}>
      {/* AI score summary */}
      <div className="grid grid-2 mb8">
        <div className="tag">{fa ? "امتیاز هوش مصنوعی" : "AI score"}: <b>{ev.score ?? d.score}</b> {ev.score10 != null && <>({ev.score10}/10)</>}</div>
        <div className="tag">{fa ? "تاریخ" : "Date"}: {fmtDateTime(d.created_at, lang)}</div>
      </div>

      {/* checklist results with per-item reason */}
      {Array.isArray(ev.results) && ev.results.length > 0 && (
        <div className="card mb8" style={{ background: "var(--panel2)" }}>
          <div className="small muted mb8">{fa ? "چک‌لیست ارزیابی" : "Checklist"}</div>
          {ev.results.map((r) => (
            <div key={r.id} className="info-row">
              <span>{r.done ? "✅" : "❌"} {r.label}{r.reason ? ` — ${r.reason}` : ""}</span>
              <span className="tag">{t("weight")} {r.weight}</span>
            </div>
          ))}
        </div>
      )}

      {/* full transcript log */}
      <details className="mb8">
        <summary className="small muted" style={{ cursor: "pointer" }}>{fa ? "متن کامل گفت‌وگو" : "Full transcript"} ({(tr.messages || []).length})</summary>
        <div className="card mt8" style={{ background: "var(--panel2)", maxHeight: 220, overflow: "auto" }}>
          {(tr.messages || []).map((m, i) => (
            <div key={i} className="small" style={{ marginBottom: 4 }}>
              <b>{m.role === "student" ? (fa ? "دانشجو" : "Student") : (m.role === "teacher" || m.mode === "exam" ? (fa ? "استاد (معاینه)" : "Teacher (exam)") : (fa ? "بیمار" : "Patient"))}:</b> {m.text}
            </div>
          ))}
          {(tr.tests || []).length > 0 && <div className="small mt8"><b>{fa ? "آزمایش‌ها" : "Tests"}:</b> {(tr.tests || []).join("، ")}</div>}
          {(tr.imaging || []).length > 0 && <div className="small"><b>{fa ? "تصویربرداری" : "Imaging"}:</b> {(tr.imaging || []).join("، ")}</div>}
          {tr.finalDx && <div className="small"><b>{fa ? "تشخیص نهایی" : "Final Dx"}:</b> {tr.finalDx}</div>}
        </div>
      </details>

      {/* teacher decision */}
      <div className="field"><label>{fa ? "تصمیم استاد" : "Your decision"}</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="approved">{fa ? "تأیید امتیاز هوش مصنوعی" : "Approve AI score"}</option>
          <option value="adjusted">{fa ? "اصلاح امتیاز (دستی)" : "Adjust score (manual)"}</option>
          <option value="rejected">{fa ? "رد کردن" : "Reject"}</option>
        </select>
      </div>
      {status === "adjusted" && (
        <div className="field"><label>{fa ? "امتیاز اصلاح‌شده (۰ تا ۱۰۰)" : "Adjusted score (0–100)"}</label>
          <input type="number" min="0" max="100" value={tScore} onChange={(e) => setTScore(Math.max(0, Math.min(100, +e.target.value || 0)))} /></div>
      )}
      <div className="field"><label>{fa ? "بازخورد برای دانشجو" : "Feedback to the student"}</label>
        <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder={fa ? "نکات، نقاط قوت و ضعف…" : "Notes, strengths, weaknesses…"} /></div>
    </Modal>
  );
}

/* ---- Student report card (trend chart + printable / PDF) ---- */
function StudentReportCard({ userId, onClose }) {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [data, setData] = useState(null);
  const [prog, setProg] = useState(null);   // { line[], radar[] } for the charts
  const [loadErr, setLoadErr] = useState("");
  useEffect(() => {
    setLoadErr("");
    api.get(`/reports/student/${userId}`).then(setData).catch((e) => { setLoadErr(String(e.message || e)); setData({ __err: true }); });
  }, [userId]);
  useEffect(() => { api.get(`/reports/progress/${userId}`).then(setProg).catch(() => setProg(null)); }, [userId]);

  const printCard = () => {
    const el = document.getElementById("report-card-print");
    if (!el) return;
    const w = window.open("", "_blank");
    const dir = lang === "fa" ? "rtl" : "ltr";
    w.document.write(`<!DOCTYPE html><html dir="${dir}"><head><meta charset="utf-8">
      <title>${t("reportCard")}</title>
      <style>
        body{font-family:${lang === "fa" ? "Tahoma,'Vazirmatn'" : "Arial"},sans-serif;padding:28px;color:#1e2b3d}
        h1{color:#26527a;font-size:20px;margin-bottom:4px}
        h2{color:#2f7fd1;font-size:15px;border-bottom:2px solid #eaeff6;padding-bottom:6px;margin:18px 0 10px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
        th,td{border:1px solid #dbe3ee;padding:7px 9px;text-align:${dir === "rtl" ? "right" : "left"}}
        th{background:#f4f7fb;color:#647184}
        .meta{color:#647184;font-size:13px} .kpi{display:flex;gap:24px;margin:12px 0}
        .kpi div{background:#f4f7fb;border:1px solid #dbe3ee;border-radius:10px;padding:10px 16px;text-align:center}
        .kpi b{display:block;font-size:20px;color:#2f7fd1}
        @media print{button{display:none}}
      </style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  };

  const name = (data && !data.__err) ? (lang === "fa" ? data.student.name_fa : data.student.name_en) : "";
  const attempts = data?.__err ? [] : (data?.attempts || []);
  const vp = attempts.filter((a) => a.type === "vp");
  const flash = attempts.filter((a) => a.type === "flash");
  const scores = attempts.map((a) => a.score || 0);
  const avg = scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : 0;
  const best = scores.length ? Math.max(...scores) : 0;

  return (
    <div className="modal-back" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: "min(760px,96vw)" }}>
        {data?.__err || loadErr ? <div className="empty-state"><h3>{loadErr || (fa ? "بارگذاری کارنامه شکست خورد" : "Could not load the report card")}</h3></div> : !data ? <Spinner /> : (<>
          <div className="section-title">
            <h3><Icon name="cap" size={16} /> {t("reportCard")}</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={printCard}><Icon name="download" size={16} /> {t("printPdf")}</button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>{t("close")}</button>
            </div>
          </div>

          <div id="report-card-print">
            <h1>MED School — {t("reportCard")}</h1>
            <div className="meta">{name} · {t("studentNo")}: {data.student.student_no || "—"}</div>

            <div className="kpi" style={{ display: "flex", gap: 16, margin: "14px 0", flexWrap: "wrap" }}>
              <div className="stat-card" style={{ flex: 1, minWidth: 120 }}><div className="num">{attempts.length}</div><div className="lbl">{t("totalActivities")}</div></div>
              <div className="stat-card" style={{ flex: 1, minWidth: 120 }}><div className="num">{avg}</div><div className="lbl">{t("avgMyScore")}</div></div>
              <div className="stat-card" style={{ flex: 1, minWidth: 120 }}><div className="num">{best}</div><div className="lbl">{t("bestMyScore")}</div></div>
            </div>

            {scores.length >= 2 && (
              <div className="mt16">
                <h2 style={{ color: "var(--primary)" }}><Icon name="chart" size={16} /> {t("scoreTrend")}</h2>
                <LineChart values={scores} color="var(--primary)" />
              </div>
            )}

            {/* Progress charts (radar = per-criterion mastery, line = VP score over time) */}
            {prog && (prog.radar?.length >= 3 || (prog.line?.length || 0) >= 2) && (
              <div className="mt16">
                <h2 style={{ color: "var(--primary)" }}><Icon name="chart" size={16} /> {fa ? "نمودارهای پیشرفت" : "Progress charts"}</h2>
                <div className="grid grid-2" style={{ gap: 16, alignItems: "start" }}>
                  {prog.radar?.length >= 3 && (
                    <div className="card" style={{ background: "var(--panel2)" }}>
                      <div className="small muted mb8">{fa ? "تسلط بر معیارها (میانگین ٪ در بیمار مجازی)" : "Mastery per criterion (avg % in VP)"}</div>
                      <RadarChart data={prog.radar} />
                    </div>
                  )}
                  {(prog.line?.length || 0) >= 2 && (
                    <div className="card" style={{ background: "var(--panel2)" }}>
                      <div className="small muted mb8">{fa ? "روند نمرهٔ بیمار مجازی" : "VP score over time"}</div>
                      <LineChart values={prog.line.map((p) => p.score)} color="var(--accent, #22a06b)" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {vp.length > 0 && (<>
              <h2><Icon name="patient" size={16} /> {t("vpExams")}</h2>
              <div className="table-wrap"><table>
                <thead><tr><th>{t("caseTitle")}</th><th>{t("finalScore")}</th><th>{t("questionsAnswered")}</th>
                  <th>{t("testsOrdered")}</th><th>{t("dateTime")}</th></tr></thead>
                <tbody>{vp.map((a) => (
                  <tr key={a.id}><td>{lang === "fa" ? a.case_fa : a.case_en}</td><td><b>{a.score}</b></td>
                    <td>{a.turns}</td><td>{a.tests}</td><td>{fmtDateTime(a.created_at, lang)}</td></tr>
                ))}</tbody></table></div>
            </>)}

            {flash.length > 0 && (<>
              <h2><Icon name="flask" size={16} /> {t("flashPractice")}</h2>
              <div className="table-wrap"><table>
                <thead><tr><th>{t("finalScore")}</th><th>{t("totalQ")}</th><th>{t("correctA")}</th>
                  <th>{t("wrongA")}</th><th>{t("dateTime")}</th></tr></thead>
                <tbody>{flash.map((a) => (
                  <tr key={a.id}><td><b>{a.score}</b></td><td>{a.total_questions}</td><td>{a.correct_count}</td>
                    <td>{a.wrong_count}</td><td>{fmtDateTime(a.created_at, lang)}</td></tr>
                ))}</tbody></table></div>
              {flash.some((a) => Array.isArray(a.transcript?.answers) && a.transcript.answers.length > 0) && (
                <div className="mt16">
                  <h2><Icon name="check" size={16} /> {fa ? "پاسخ‌های ثبت‌شدهٔ دانشجو" : "Recorded student answers"}</h2>
                  {flash.map((a) => Array.isArray(a.transcript?.answers) && a.transcript.answers.length > 0 ? (
                    <details key={`ans-${a.id}`} className="card mb8" style={{ background: "var(--panel2)" }}>
                      <summary style={{ cursor: "pointer", fontWeight: 800 }}>{fmtDateTime(a.created_at, lang)} — {t("finalScore")}: {a.score}</summary>
                      <div className="table-wrap mt8"><table>
                        <thead><tr><th>#</th><th>{t("title")}</th><th>{t("questionText")}</th><th>{fa ? "پاسخ دانشجو" : "Student answer"}</th><th>{fa ? "پاسخ صحیح" : "Correct answer"}</th><th>{t("status")}</th></tr></thead>
                        <tbody>{a.transcript.answers.map((ans) => {
                          const selected = (ans.selected || []).map((x) => lang === "fa" ? x.fa : x.en).filter(Boolean).join("، ") || "—";
                          const correct = ans.correct ? (lang === "fa" ? ans.correct.fa : ans.correct.en) : "—";
                          return <tr key={`${a.id}-${ans.order}`}>
                            <td>{ans.order}</td>
                            <td>{lang === "fa" ? ans.title_fa : ans.title_en}</td>
                            <td style={{ whiteSpace: "normal", minWidth: 220 }}>{lang === "fa" ? ans.question_fa : ans.question_en}</td>
                            <td style={{ whiteSpace: "normal" }}>{selected}</td>
                            <td style={{ whiteSpace: "normal" }}>{correct}</td>
                            <td>{ans.solved ? "✅" : "❌"}</td>
                          </tr>;
                        })}</tbody>
                      </table></div>
                    </details>
                  ) : null)}
                </div>
              )}
            </>)}

            {attempts.length === 0 && <div className="small muted center" style={{ padding: 20 }}>{t("noData")}</div>}
          </div>
        </>)}
      </div>
    </div>
  );
}

/* ================= CUSTOM CATALOGS (teacher/admin) ================= */
function Catalogs() {
  const { t, lang } = useApp();
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    api.get("/catalogs").then((d) => setList(Array.isArray(d) ? d : [])).catch((e) => { setLoadErr(String(e.message || e)); setList({ __err: true }); });
  };
  useEffect(() => { load(); }, []);
  if (list?.__err || loadErr) return <><div className="card empty-state"><div className="ico">⚠️</div><h3>{loadErr || (lang === "fa" ? "بارگذاری کاتالوگ‌ها شکست خورد" : "Could not load catalogs")}</h3><button className="btn btn-ghost mt16" onClick={() => { setList(null); load(); }}>{lang === "fa" ? "تلاش دوباره" : "Retry"}</button></div><OrderCatalogAdmin /></>;
  if (!list) return <><Spinner /><OrderCatalogAdmin /></>;
  const del = async (id) => { if (confirm(t("confirmDelete"))) { await api.del(`/catalogs/${id}`); load(); } };
  const save = async (data, id) => {
    if (id) await api.put(`/catalogs/${id}`, data); else await api.post("/catalogs", data);
    setEditing(null); toast(t("saved")); load();
  };
  return (
    <>
    <div className="card">
      <div className="section-title"><h4><Icon name="catalog" size={16} /> {t("customCatalogs")}</h4>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>+ {t("newCatalog")}</button></div>
      <div className="small muted mb16">{t("catalogsHint")}</div>
      {list.length === 0 ? <div className="small muted center" style={{ padding: 20 }}>{t("noData")}</div> : (
        <div className="table-wrap"><table>
          <thead><tr><th>{t("name")}</th><th>{t("catalogCount")}</th><th></th></tr></thead>
          <tbody>{list.map((c) => (
            <tr key={c.id}>
              <td>{lang === "fa" ? c.name_fa : c.name_en}</td>
              <td>{c.items.length}</td>
              <td style={{ textAlign: "end" }}>
                <button className="btn btn-sm btn-ghost" onClick={() => setEditing(c)}>{t("edit")}</button>
                <button className="btn btn-sm btn-danger" onClick={() => del(c.id)}>{t("delete")}</button>
              </td>
            </tr>
          ))}</tbody></table></div>
      )}
      {editing && <CatalogModal cat={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
    <OrderCatalogAdmin />
    </>
  );
}

function CatalogModal({ cat, onClose, onSave }) {
  const { t } = useApp();
  const [name_fa, setNameFa] = useState(cat.name_fa || "");
  const [name_en, setNameEn] = useState(cat.name_en || "");
  // items entered as lines "fa | en"
  const [text, setText] = useState((cat.items || []).map((o) => `${o.fa} | ${o.en}`).join("\n"));
  const submit = () => {
    const items = text.split("\n").map((line) => {
      const [fa, en] = line.split("|").map((s) => (s || "").trim());
      return fa || en ? { fa: fa || en, en: en || fa } : null;
    }).filter(Boolean);
    onSave({ name_fa, name_en, items }, cat.id);
  };
  return (
    <Modal title={cat.id ? t("edit") : t("newCatalog")} onClose={onClose} onSave={submit}>
      <div className="grid grid-2">
        <div className="field"><label>{t("name")} (FA)</label><input value={name_fa} onChange={(e) => setNameFa(e.target.value)} /></div>
        <div className="field"><label>{t("name")} (EN)</label><input value={name_en} onChange={(e) => setNameEn(e.target.value)} /></div>
      </div>
      <div className="field"><label>{t("catalogItems")}</label>
        <textarea style={{ minHeight: 220 }} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={"غضروف هیالن | Hyaline cartilage\nعضله قلبی | Cardiac muscle"} />
        <div className="small muted mt8">{t("catalogItemsHint")}</div>
      </div>
    </Modal>
  );
}

/* ---- Ads management (admin-only, simulated monetization) ---- */
/* ---- Site Content CMS: edit all landing-page copy (per language) ---- */
function SiteContent() {
  const { t, lang, reloadSiteContent } = useApp();
  const toast = useToast();
  const [draft, setDraft] = useState(null);     // { "fa:key": value, ... }
  const [openSec, setOpenSec] = useState(SITE_CONTENT_SCHEMA[0]?.id || null);
  const [editLang, setEditLang] = useState(lang === "en" ? "en" : "fa");
  const [q, setQ] = useState("");

  const [I18N, setI18N] = useState(null);      // full dictionary, lazy (keeps Admin chunk small)
  useEffect(() => { api.get("/site-content").then((d) => setDraft(d.content || {})).catch(() => setDraft({})); }, []);
  useEffect(() => { let on = true; import("../i18n.js").then((m) => { if (on) setI18N(m.I18N || {}); }).catch(() => { if (on) setI18N({}); }); return () => { on = false; }; }, []);
  if (!draft || !I18N) return <Spinner />;

  const i18nDefault = (key, l) => (I18N?.[l] && I18N[l][key]) || "";
  const set = (key, l, v) => setDraft((s) => ({ ...s, [`${l}:${key}`]: v }));

  const save = async () => {
    // drop empty overrides so they fall back to defaults
    const clean = {};
    for (const [k, v] of Object.entries(draft)) if (typeof v === "string" && v.trim() !== "") clean[k] = v;
    await api.put("/site-content", { content: clean });
    await reloadSiteContent();
    toast(t("saved"));
  };
  const resetAll = async () => {
    if (!confirm(t("cmsResetConfirm"))) return;
    await api.del("/site-content"); setDraft({}); await reloadSiteContent(); toast(t("saved"));
  };

  const needle = q.trim().toLowerCase();
  const sections = SITE_CONTENT_SCHEMA.map((sec) => ({
    ...sec,
    keys: !needle ? sec.keys : sec.keys.filter((f) =>
      [f.key, f.label_fa, f.label_en, i18nDefault(f.key, "fa"), i18nDefault(f.key, "en")]
        .some((v) => String(v).toLowerCase().includes(needle))),
  })).filter((sec) => sec.keys.length > 0);

  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="edit" size={18} /> {t("siteContent")}</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={resetAll}><Icon name="trash" size={13} /> {t("cmsResetAll")}</button>
          <button className="btn btn-primary btn-sm" onClick={save}><Icon name="check" size={14} /> {t("cmsPublish")}</button>
        </div>
      </div>
      <div className="muted small mb16">{t("cmsHint")}</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div className="lang-switch">
          <button className={`btn btn-sm ${editLang === "fa" ? "btn-primary" : "btn-ghost"}`} onClick={() => setEditLang("fa")}>فارسی</button>
          <button className={`btn btn-sm ${editLang === "en" ? "btn-primary" : "btn-ghost"}`} onClick={() => setEditLang("en")}>English</button>
        </div>
        <div className="dt-search" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} />
          {q && <button className="dt-clear" onClick={() => setQ("")}><Icon name="close" size={14} /></button>}
        </div>
      </div>

      {sections.map((sec) => {
        const open = needle ? true : openSec === sec.id;
        return (
          <div className="card mb8" key={sec.id}>
            <div className="cms-sec-head" onClick={() => !needle && setOpenSec(open ? null : sec.id)}
              style={{ cursor: needle ? "default" : "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{lang === "fa" ? sec.title_fa : sec.title_en}</strong>
              {!needle && <Icon name={open ? "chevronUp" : "chevronDown"} size={16} />}
            </div>
            {open && (
              <div className="mt8">
                {sec.keys.map((f) => {
                  const dkey = `${editLang}:${f.key}`;
                  const def = i18nDefault(f.key, editLang);
                  const val = draft[dkey] ?? "";
                  return (
                    <div className="field" key={f.key}>
                      <label>{editLang === "fa" ? f.label_fa : f.label_en}
                        {val.trim() !== "" && <span className="cms-overridden">● {t("cmsEdited")}</span>}</label>
                      {f.multiline
                        ? <textarea style={{ minHeight: 70 }} value={val} placeholder={def} onChange={(e) => set(f.key, editLang, e.target.value)} />
                        : <input value={val} placeholder={def} onChange={(e) => set(f.key, editLang, e.target.value)} />}
                      <div className="small muted" style={{ marginTop: 4 }}>{t("cmsDefault")}: {def || "—"}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const AD_SLOTS = [
  { slot: "home", fa: "صفحه‌ی خانه‌ی مسیر", en: "Learner home" },
  { slot: "path", fa: "داخل مسیر یادگیری", en: "Inside the path" },
  { slot: "lesson-intro", fa: "قبل از شروع درس (قبل از سوالات)", en: "Before a lesson starts" },
  { slot: "between-lessons", fa: "بین درس‌ها", en: "Between lessons" },
  { slot: "sidebar", fa: "نوار کناری", en: "Sidebar" },
  { slot: "review", fa: "صفحه‌ی مرور", en: "Review page" },
  { slot: "leaderboard", fa: "صفحه‌ی لیگ/رتبه‌بندی", en: "Leaderboard" },
];

/* ---- Payments & revenue (admin) ---- */
function PaymentsAdmin() {
  const { t, lang } = useApp();
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/pay/admin/all").then(setData).catch(() => setData({ transactions: [], revenue: {} })); }, []);
  if (!data) return <Spinner />;
  const rev = data.revenue || {};
  const num = (n) => (n || 0).toLocaleString(lang === "fa" ? "fa-IR" : "en-US");
  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="crown" size={22} /> {t("payments")}</h2>
        {!data.real && <span className="tag">{t("testGateway")}</span>}</div>
      <div className="kpi-row mb16">
        <div className="kpi accent"><Icon name="crown" size={18} /><div><b>{num(rev.activeSubs)}</b><div className="small muted">{t("activeSubs")}</div></div></div>
        <div className="kpi"><Icon name="check" size={18} /><div><b>{num(rev.paidCount)}</b><div className="small muted">{t("paidCount")}</div></div></div>
        <div className="kpi"><Icon name="chart" size={18} /><div><b>{num(rev.totalToman)}</b><div className="small muted">{t("toman")}</div></div></div>
      </div>
      <div className="card">
        <DataTable
          rows={data.transactions}
          initialSort={{ key: "id", dir: "desc" }}
          searchKeys={[(x) => x.name_fa, (x) => x.name_en, (x) => x.username, (x) => x.ref_id]}
          rowKey={(x) => x.id}
          columns={[
            { key: "user", label: t("name"), sortValue: (x) => x.name_fa || x.username, render: (x) => lang === "fa" ? (x.name_fa || x.username) : (x.name_en || x.username) },
            { key: "plan", label: t("plan"), sortValue: (x) => x.plan, render: (x) => x.plan === "yearly" ? t("yearly") : t("monthly") },
            { key: "amount", label: t("amount"), sortValue: (x) => x.amount, render: (x) => `${num(x.amount / 10)} ${t("toman")}` },
            { key: "status", label: t("status"), sortValue: (x) => x.status, render: (x) => <span className={`pill pill-${x.status === "paid" ? "active" : x.status === "pending" ? "medium" : "danger"}`}>{t("pay_" + x.status)}</span> },
            { key: "gateway", label: t("slot"), sortValue: (x) => x.gateway, render: (x) => x.gateway },
            { key: "created_at", label: t("dateTime"), sortValue: (x) => x.created_at, render: (x) => <span className="small muted">{fmtDateTime(x.paid_at || x.created_at, lang)}</span> },
          ]}
        />
      </div>
    </div>
  );
}

function AdsManager() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [ads, setAds] = useState(null);
  const [edit, setEdit] = useState(null);
  const [filter, setFilter] = useState("");   // "" = all slots
  const [lessons, setLessons] = useState([]); // targetable lessons for per-lesson ads
  const [stats, setStats] = useState(null);   // aggregate ad performance
  const [master, setMaster] = useState(null); // { enabled, ... } global on/off

  const load = () => api.get("/ads").then((d) => { setAds(d.ads); if (d.master) setMaster(d.master); }).catch(() => setAds([]));
  useEffect(() => {
    load();
    api.get("/ads/lessons").then((d) => setLessons(d.lessons || [])).catch(() => setLessons([]));
    api.get("/ads/stats").then(setStats).catch(() => {});
  }, []);

  const toggleMaster = async () => {
    const next = !(master?.enabled);
    try { const r = await api.put("/ads/master", { ...master, enabled: next }); setMaster(r.master); toast(t("saved")); }
    catch (e) { toast(e.message); }
  };
  const toggleAd = async (a) => { try { await api.put(`/ads/${a.id}/toggle`, {}); load(); } catch (e) { toast(e.message); } };

  const slotLabel = (slot) => { const s = AD_SLOTS.find((x) => x.slot === slot); return s ? (lang === "fa" ? s.fa : s.en) : slot; };
  const blank = { slot: filter || "home", title_fa: "", title_en: "", body_fa: "", body_en: "", cta_fa: "", cta_en: "", url: "", bg: "#2f7fd1", active: 1, format: "banner", sponsor: "", reward_gems: 0, skippable_after: 5, duration_s: 15, weight: 1, start_at: "", end_at: "", daily_cap: 0, audience: "all" };
  const save = async () => {
    try {
      if (edit.id) await api.put(`/ads/${edit.id}`, edit);
      else await api.post("/ads", edit);
      setEdit(null); toast(t("save")); load();
    } catch { toast("Error"); }
  };
  const remove = async (id) => { if (confirm(t("confirmDelete"))) { await api.del(`/ads/${id}`); load(); } };

  if (!ads) return <Spinner />;
  const shown = filter ? ads.filter((a) => a.slot === filter) : ads;
  const countBySlot = (slot) => ads.filter((a) => a.slot === slot).length;
  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="image" size={18} /> {t("adsMgmt")}</h4>
        <button className="btn btn-primary btn-sm" onClick={() => setEdit({ ...blank })}><Icon name="edit" size={14} /> {t("newAd")}</button>
      </div>
      <div className="muted small mb16">{lang === "fa" ? "برای هر صفحه (جایگاه) به‌صورت جداگانه تبلیغ بسازید و مدیریت کنید. این تبلیغات به کاربران رقابتی غیرپریمیوم نمایش داده می‌شوند." : "Create and manage ads per page (slot). Shown to non-premium learners."}</div>

      {/* MASTER SWITCH — one global on/off. While OFF, no user sees any ad. */}
      {master && (
        <div className="card mb16" style={{ display: "flex", alignItems: "center", gap: 16, borderInlineStart: `5px solid ${master.enabled ? "var(--green)" : "var(--flame,#e0533d)"}` }}>
          <div style={{ fontSize: 34 }}>{master.enabled ? "📣" : "🔕"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>{t("adsMaster")} — {master.enabled ? t("adsMasterOn") : t("adsMasterOff")}</div>
            <div className="small muted">{master.enabled ? t("adsMasterHintOn") : t("adsMasterHintOff")}</div>
          </div>
          <button className={`btn ${master.enabled ? "btn-danger" : "btn-primary"}`} onClick={toggleMaster}>
            {master.enabled ? (fa ? "خاموش کردن همه تبلیغات" : "Turn ALL ads off") : (fa ? "روشن کردن تبلیغات" : "Turn ads on")}
          </button>
        </div>
      )}
      {master && !master.enabled && (
        <div className="small muted mb16" style={{ opacity: .8 }}>{fa ? "توجه: تا وقتی کلید اصلی خاموش است، تبلیغاتی که پایین می‌سازید ذخیره می‌شوند اما به هیچ کاربری نمایش داده نمی‌شوند." : "Note: while the master switch is off, ads you create below are saved but shown to no one."}</div>
      )}

      {/* Ad performance summary (impressions/clicks + rewarded gems paid) */}
      {stats && (
        <div className="grid grid-3 mb16">
          <div className="card center"><div className="stat-num">{stats.totals?.imp ?? 0}</div><div className="small muted">{t("impressions")}</div></div>
          <div className="card center"><div className="stat-num">{stats.totals?.clk ?? 0}</div><div className="small muted">{t("clicks")}</div></div>
          <div className="card center"><div className="stat-num">{stats.rewardsPaidGems ?? 0} 💉</div><div className="small muted">{lang === "fa" ? "جم پرداختی (جایزه‌دار)" : "Gems paid (rewarded)"}</div></div>
        </div>
      )}

      {/* Slot filter: manage ads page-by-page */}
      <div className="ad-slot-tabs mb16">
        <button className={`btn btn-sm ${filter === "" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter("")}>
          {lang === "fa" ? "همه" : "All"} ({ads.length})
        </button>
        {AD_SLOTS.map((s) => (
          <button key={s.slot} className={`btn btn-sm ${filter === s.slot ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(s.slot)}>
            {lang === "fa" ? s.fa : s.en} ({countBySlot(s.slot)})
          </button>
        ))}
      </div>

      {shown.length === 0 && <div className="card empty-state"><div className="ico"><Icon name="image" size={40} /></div><h3>{t("noData")}</h3></div>}
      <div className="grid grid-2">
        {shown.map((a) => (
          <div key={a.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 800 }}>{lang === "fa" ? a.title_fa : a.title_en}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {a.format && a.format !== "banner" && <span className="tag" style={{ background: "var(--accentGlow)" }}>{a.format}</span>}
                <span className="tag">{slotLabel(a.slot)}</span>
              </div>
            </div>
            <div className="small muted mt8">{lang === "fa" ? a.body_fa : a.body_en}</div>
            <div className="case-meta mt8">
              <span className="tag"><Icon name="chart" size={12} /> {t("impressions")}: {a.impressions}</span>
              <span className="tag"><Icon name="target" size={12} /> {t("clicks")}: {a.clicks}</span>
              {a.impressions > 0 && <span className="tag">CTR: {Math.round((a.clicks / a.impressions) * 1000) / 10}%</span>}
              {a.weight > 1 && <span className="tag">⚖ {a.weight}</span>}
              {a.audience && a.audience !== "all" && <span className="tag">{a.audience === "free" ? t("audFree") : t("audNew")}</span>}
              {a.daily_cap > 0 && <span className="tag">≤{a.daily_cap}/{fa ? "روز" : "day"}</span>}
              <span className="tag" style={{ background: a.active ? "var(--accentGlow)" : "var(--panel3)" }}>{a.active ? (fa ? "● فعال" : "● on") : (fa ? "○ خاموش" : "○ off")}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleAd(a)} title={t("adToggle")}><Icon name={a.active ? "eye" : "eyeOff"} size={13} /> {a.active ? (fa ? "خاموش" : "Off") : (fa ? "روشن" : "On")}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit(a)}><Icon name="edit" size={13} /> {t("edit")}</button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(a.id)}><Icon name="trash" size={13} /> {t("delete")}</button>
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <Modal title={edit.id ? t("edit") : t("newAd")} onClose={() => setEdit(null)} onSave={save}>
          <div className="field"><label>{t("slot")}</label>
            <select value={edit.slot} onChange={(e) => setEdit({ ...edit, slot: e.target.value })}>
              {AD_SLOTS.map((s) => <option key={s.slot} value={s.slot}>{lang === "fa" ? s.fa : s.en}</option>)}
            </select>
          </div>
          {/* Duolingo-Ads format: banner (card) / interstitial (skippable) / rewarded (watch→gems) / prelesson */}
          <div className="grid grid-2">
            <div className="field"><label>{t("adFormat")}</label>
              <select value={edit.format || "banner"} onChange={(e) => setEdit({ ...edit, format: e.target.value })}>
                <option value="banner">{lang === "fa" ? "بنر (کارت)" : "Banner (card)"}</option>
                <option value="native">{lang === "fa" ? "نیتیو (هم‌شکل محتوا)" : "Native (in-feed)"}</option>
                <option value="interstitial">{lang === "fa" ? "میان‌برنامه‌ای (قابل رد شدن)" : "Interstitial (skippable)"}</option>
                <option value="rewarded">{lang === "fa" ? "ویدیوی جایزه‌دار" : "Rewarded video"}</option>
                <option value="app_open">{lang === "fa" ? "بازگشایی برنامه" : "App-open"}</option>
                <option value="prelesson">{lang === "fa" ? "اسپانسر پیش‌درس" : "Pre-lesson sponsor"}</option>
                <option value="sponsored">{lang === "fa" ? "محتوای اسپانسری" : "Sponsored content"}</option>
              </select>
            </div>
            <div className="field"><label>{t("adSponsor")}</label><input value={edit.sponsor || ""} onChange={(e) => setEdit({ ...edit, sponsor: e.target.value })} /></div>
          </div>
          {(edit.format === "rewarded" || edit.format === "prelesson") && (
            <div className="grid grid-2">
              <div className="field"><label>{t("adRewardGems")}</label><input type="number" min="0" value={edit.reward_gems ?? 0} onChange={(e) => setEdit({ ...edit, reward_gems: Number(e.target.value) || 0 })} /></div>
              <div className="field"><label>{t("adDuration")}</label><input type="number" min="3" value={edit.duration_s ?? 15} onChange={(e) => setEdit({ ...edit, duration_s: Number(e.target.value) || 15 })} /></div>
            </div>
          )}
          {edit.format === "interstitial" && (
            <div className="field"><label>{t("adSkippableAfter")}</label><input type="number" min="0" value={edit.skippable_after ?? 5} onChange={(e) => setEdit({ ...edit, skippable_after: Number(e.target.value) || 0 })} /></div>
          )}

          {/* Scheduling, frequency capping, audience targeting & rotation weight */}
          <div className="divider" />
          <div className="small muted mb8">🎛️ {t("adSchedulingCap")}</div>
          <div className="grid grid-2">
            <div className="field"><label>{t("adAudience")}</label>
              <select value={edit.audience || "all"} onChange={(e) => setEdit({ ...edit, audience: e.target.value })}>
                <option value="all">{t("audAll")}</option>
                <option value="free">{t("audFree")}</option>
                <option value="new">{t("audNew")}</option>
              </select>
            </div>
            <div className="field"><label>{t("adWeight")}</label><input type="number" min="1" value={edit.weight ?? 1} onChange={(e) => setEdit({ ...edit, weight: Number(e.target.value) || 1 })} /></div>
            <div className="field"><label>{t("adDailyCap")}</label><input type="number" min="0" value={edit.daily_cap ?? 0} onChange={(e) => setEdit({ ...edit, daily_cap: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>{t("adStartAt")}</label><input type="datetime-local" value={edit.start_at ? String(edit.start_at).slice(0, 16) : ""} onChange={(e) => setEdit({ ...edit, start_at: e.target.value })} /></div>
            <div className="field"><label>{t("adEndAt")}</label><input type="datetime-local" value={edit.end_at ? String(edit.end_at).slice(0, 16) : ""} onChange={(e) => setEdit({ ...edit, end_at: e.target.value })} /></div>
          </div>

          {/* per-lesson targeting: only relevant for the "before a lesson starts" slot */}
          {edit.slot === "lesson-intro" && (
            <div className="field"><label>{t("adTargetLesson")}</label>
              <select value={edit.node_id || ""} onChange={(e) => setEdit({ ...edit, node_id: e.target.value || null })}>
                <option value="">{t("adAllLessons")}</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {(lang === "fa" ? l.topic_fa : l.topic_en) ? `${lang === "fa" ? l.topic_fa : l.topic_en} — ` : ""}{lang === "fa" ? l.title_fa : l.title_en}
                  </option>
                ))}
              </select>
              <div className="small muted mt8">{t("adTargetHint")}</div>
            </div>
          )}
          {/* Live preview of how the ad card will look */}
          <div className="ad-preview mb8" style={{ background: edit.bg || "#2f7fd1" }}>
            <div className="ad-preview-title">{(lang === "fa" ? edit.title_fa : edit.title_en) || (lang === "fa" ? "عنوان تبلیغ" : "Ad title")}</div>
            <div className="ad-preview-body">{(lang === "fa" ? edit.body_fa : edit.body_en) || "…"}</div>
            {(edit.cta_fa || edit.cta_en) && <span className="ad-preview-cta">{lang === "fa" ? edit.cta_fa : edit.cta_en}</span>}
          </div>
          <div className="grid grid-2">
            <div className="field"><label>عنوان (فا)</label><input value={edit.title_fa} onChange={(e) => setEdit({ ...edit, title_fa: e.target.value })} /></div>
            <div className="field"><label>Title (en)</label><input value={edit.title_en} onChange={(e) => setEdit({ ...edit, title_en: e.target.value })} /></div>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>متن (فا)</label><input value={edit.body_fa} onChange={(e) => setEdit({ ...edit, body_fa: e.target.value })} /></div>
            <div className="field"><label>Body (en)</label><input value={edit.body_en} onChange={(e) => setEdit({ ...edit, body_en: e.target.value })} /></div>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>دکمه (فا)</label><input value={edit.cta_fa} onChange={(e) => setEdit({ ...edit, cta_fa: e.target.value })} /></div>
            <div className="field"><label>CTA (en)</label><input value={edit.cta_en} onChange={(e) => setEdit({ ...edit, cta_en: e.target.value })} /></div>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>URL</label><input value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} /></div>
            <div className="field"><label>{lang === "fa" ? "رنگ پس‌زمینه" : "Background"}</label><input type="color" value={edit.bg} onChange={(e) => setEdit({ ...edit, bg: e.target.value })} /></div>
          </div>
          {/* ad image — supports full image ads */}
          <ImageUpload value={edit.image} onChange={(v) => setEdit({ ...edit, image: v })} label={`${t("adImage")} (${t("optional")})`} />
          <label className="toggle-row" style={{ marginTop: 10 }}>
            <span><Icon name="check" size={15} /> {lang === "fa" ? "تبلیغ فعال باشد" : "Ad active"}</span>
            <input type="checkbox" checked={!!edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked ? 1 : 0 })} />
          </label>
        </Modal>
      )}
    </div>
  );
}

/* ---- Support & feedback inbox: two-pane ticket list + conversation thread.
   Agents reply, change category and resolve. Full context (user, role) shown. */
const SUPPORT_CAT = {
  question: { emoji: "❓", fa: "پرسش", en: "Question" },
  bug: { emoji: "🐞", fa: "باگ", en: "Bug" },
  feedback: { emoji: "💡", fa: "پیشنهاد", en: "Feedback" },
  account: { emoji: "👤", fa: "حساب", en: "Account" },
};
function SupportInbox() {
  const { t, lang } = useApp();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("");     // "" | open | answered | resolved
  const [active, setActive] = useState(null);   // open ticket thread
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);

  const load = () => api.get(`/admin/support?lang=${lang}${filter ? `&status=${filter}` : ""}`).then(setData).catch(() => setData({ tickets: [], stats: {} }));
  useEffect(() => { load(); }, [lang, filter]);
  useEffect(() => { if (active && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [active]);

  const openTicket = (id) => api.get(`/admin/support/${id}?lang=${lang}`).then((d) => { setActive(d); load(); }).catch(() => {});
  const sendReply = async () => {
    const b = reply.trim(); if (!b || busy) return;
    setBusy(true);
    try { const d = await api.post(`/admin/support/${active.ticket.id}/reply?lang=${lang}`, { body: b }); setActive(d); setReply(""); load(); }
    catch { toast("Error"); } finally { setBusy(false); }
  };
  const setStatus = async (s) => { await api.put(`/admin/support/${active.ticket.id}/status`, { status: s }); await openTicket(active.ticket.id); toast(t("saved")); };
  const setCat = async (c) => { await api.put(`/admin/support/${active.ticket.id}/category`, { category: c }); await openTicket(active.ticket.id); };

  if (!data) return <Spinner />;
  const s = data.stats || {};
  const catLabel = (c) => (SUPPORT_CAT[c] ? `${SUPPORT_CAT[c].emoji} ${lang === "fa" ? SUPPORT_CAT[c].fa : SUPPORT_CAT[c].en}` : c);
  const statusPill = (st) => st === "resolved" ? "active" : st === "answered" ? "medium" : "danger";

  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="chat" size={18} /> {t("supportInbox")}</h4></div>
      <div className="grid grid-3 mb16">
        <div className="card center"><div className="stat-num">{s.open ?? 0}</div><div className="small muted">{t("supportOpen")}</div></div>
        <div className="card center"><div className="stat-num" style={{ color: s.unread ? "var(--danger)" : undefined }}>{s.unread ?? 0}</div><div className="small muted">{t("supportUnread")}</div></div>
        <div className="card center"><div className="stat-num">{s.resolved ?? 0}</div><div className="small muted">{t("supportResolvedCount")}</div></div>
      </div>

      <div className="ad-slot-tabs mb16">
        {["", "open", "answered", "resolved"].map((f) => (
          <button key={f || "all"} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f)}>
            {f === "" ? (lang === "fa" ? "همه" : "All") : t("supportStatus_" + f)}
          </button>
        ))}
      </div>

      <div className="support-admin">
        {/* ticket list */}
        <div className="support-list card">
          {(data.tickets || []).length === 0 && <div className="empty-state" style={{ padding: 24 }}><div className="small muted">{t("noData")}</div></div>}
          {(data.tickets || []).map((tk) => (
            <button key={tk.id} className={`support-list-item ${active?.ticket?.id === tk.id ? "active" : ""} ${tk.admin_unread > 0 ? "unread" : ""}`} onClick={() => openTicket(tk.id)}>
              <div className="sli-top">
                <span className="sli-name">{tk.user}</span>
                <span className={`pill pill-${statusPill(tk.status)}`}>{t("supportStatus_" + tk.status)}</span>
              </div>
              <div className="sli-cat small muted">{catLabel(tk.category)} · <Pill kind="medium">{t(tk.role)}</Pill></div>
              <div className="sli-last small">{tk.lastBody}</div>
              {tk.admin_unread > 0 && <span className="sli-dot" />}
            </button>
          ))}
        </div>

        {/* conversation thread */}
        <div className="support-thread card">
          {!active ? (
            <div className="empty-state" style={{ padding: 40 }}><div className="ico"><Icon name="chat" size={40} /></div><h3>{t("supportPickTicket")}</h3></div>
          ) : (
            <>
              <div className="st-head">
                <div>
                  <div style={{ fontWeight: 800 }}>{active.ticket.user} <span className="small muted">· {active.ticket.username}{active.ticket.email ? ` · ${active.ticket.email}` : ""}</span></div>
                  <div className="small muted">{t(active.ticket.role)}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <select value={active.ticket.category} onChange={(e) => setCat(e.target.value)} className="st-select">
                    {Object.keys(SUPPORT_CAT).map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
                  </select>
                  {active.ticket.status !== "resolved"
                    ? <button className="btn btn-ghost btn-sm" onClick={() => setStatus("resolved")}><Icon name="check" size={13} /> {t("supportMarkResolved")}</button>
                    : <button className="btn btn-ghost btn-sm" onClick={() => setStatus("open")}><Icon name="repeat" size={13} /> {t("supportReopen")}</button>}
                </div>
              </div>
              <div className="st-body" ref={bodyRef}>
                {active.messages.map((m) => (
                  <div key={m.id} className={`support-msg ${m.sender === "admin" ? "mine" : "theirs"}`}>
                    {m.sender === "admin" && m.sender_name && <div className="support-msg-name">{m.sender_name}</div>}
                    <div className="support-bubble">{m.body}</div>
                    <div className="support-time">{supFmtTime(m.created_at, lang)}</div>
                  </div>
                ))}
              </div>
              <div className="support-compose">
                <textarea rows={1} value={reply} onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                  placeholder={t("supportReplyPlaceholder")} />
                <button className="support-send" disabled={busy || !reply.trim()} onClick={sendReply}><Icon name="send" size={18} /></button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function supFmtTime(iso, lang) {
  if (!iso) return "";
  try {
    const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
    return new Intl.DateTimeFormat(lang === "fa" ? "fa-IR-u-ca-persian" : "en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" }).format(d);
  } catch { return ""; }
}

/* ---- Help center / FAQ management: create, edit, order, publish articles that
   users see (searchable) inside the support widget to deflect tickets. */
const HELP_CATS = { general: "عمومی", account: "حساب", learning: "یادگیری", billing: "پرداخت", technical: "فنی" };
const HELP_CATS_EN = { general: "General", account: "Account", learning: "Learning", billing: "Billing", technical: "Technical" };
function HelpCenterAdmin() {
  const { t, lang } = useApp();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = () => api.get("/admin/help").then((d) => setItems(d.articles)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  const blank = { category: "general", title_fa: "", title_en: "", body_fa: "", body_en: "", ord: 0, published: 1 };
  const save = async () => {
    try { if (edit.id) await api.put(`/admin/help/${edit.id}`, edit); else await api.post("/admin/help", edit); setEdit(null); toast(t("save")); load(); }
    catch { toast("Error"); }
  };
  const remove = async (id) => { if (confirm(t("confirmDelete"))) { await api.del(`/admin/help/${id}`); load(); } };
  if (!items) return <Spinner />;
  const catLabel = (c) => (lang === "fa" ? HELP_CATS[c] : HELP_CATS_EN[c]) || c;
  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="book" size={18} /> {t("helpCenter")}</h4>
        <button className="btn btn-primary btn-sm" onClick={() => setEdit({ ...blank })}><Icon name="edit" size={14} /> {t("helpNewArticle")}</button>
      </div>
      <div className="muted small mb16">{lang === "fa" ? "این مقاله‌ها در بخش «راهنما»ی چت پشتیبانی به کاربران نمایش داده می‌شوند تا خودشان جواب سوال‌ها را پیدا کنند." : "These articles appear in the Help tab of the support chat so users can self-serve answers."}</div>
      {items.length === 0 && <div className="card empty-state"><div className="ico"><Icon name="book" size={40} /></div><h3>{t("noData")}</h3></div>}
      <div className="grid grid-2">
        {items.map((a) => (
          <div key={a.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 800 }}>{lang === "fa" ? a.title_fa : a.title_en}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <span className="tag">{catLabel(a.category)}</span>
                <span className="tag" style={{ background: a.published ? "var(--accentGlow)" : "var(--panel3)" }}>{a.published ? (lang === "fa" ? "منتشر" : "Live") : (lang === "fa" ? "پیش‌نویس" : "Draft")}</span>
              </div>
            </div>
            <div className="small muted mt8" style={{ maxHeight: 40, overflow: "hidden" }}>{lang === "fa" ? a.body_fa : a.body_en}</div>
            <div className="case-meta mt8"><span className="tag"><Icon name="chart" size={12} /> {t("views") || "بازدید"}: {a.views}</span></div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit(a)}><Icon name="edit" size={13} /> {t("edit")}</button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(a.id)}><Icon name="trash" size={13} /> {t("delete")}</button>
            </div>
          </div>
        ))}
      </div>
      {edit && (
        <Modal title={edit.id ? t("edit") : t("helpNewArticle")} onClose={() => setEdit(null)} onSave={save}>
          <div className="grid grid-2">
            <div className="field"><label>{t("category") || "دسته"}</label>
              <select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                {Object.keys(HELP_CATS).map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
              </select>
            </div>
            <div className="field"><label>{lang === "fa" ? "ترتیب" : "Order"}</label><input type="number" value={edit.ord} onChange={(e) => setEdit({ ...edit, ord: Number(e.target.value) || 0 })} /></div>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>عنوان (فا)</label><input value={edit.title_fa} onChange={(e) => setEdit({ ...edit, title_fa: e.target.value })} /></div>
            <div className="field"><label>Title (en)</label><input value={edit.title_en} onChange={(e) => setEdit({ ...edit, title_en: e.target.value })} /></div>
          </div>
          <div className="field"><label>متن (فا)</label><textarea style={{ minHeight: 90 }} value={edit.body_fa} onChange={(e) => setEdit({ ...edit, body_fa: e.target.value })} /></div>
          <div className="field"><label>Body (en)</label><textarea style={{ minHeight: 90 }} value={edit.body_en} onChange={(e) => setEdit({ ...edit, body_en: e.target.value })} /></div>
          <label className="toggle-row" style={{ marginTop: 10 }}>
            <span><Icon name="check" size={15} /> {lang === "fa" ? "منتشر شود" : "Published"}</span>
            <input type="checkbox" checked={!!edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked ? 1 : 0 })} />
          </label>
        </Modal>
      )}
    </div>
  );
}

/* ---- Premium accounts management: overview of subscribers + manual
   grant/extend/revoke. Also surfaces the "premium program" on/off state so the
   admin knows whether premium is visible to users at all. */
function PremiumAccounts() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [d, setD] = useState(null);
  const [q, setQ] = useState("");
  const [grant, setGrant] = useState(null); // { search, results, days, lifetime }
  const load = (query = "") => api.get(`/admin/premium?q=${encodeURIComponent(query)}`).then(setD).catch(() => setD(false));
  useEffect(() => { load(); }, []);

  const doGrant = async (userId, days, lifetime) => {
    try { await api.post("/admin/premium/grant", { userId, days, lifetime }); toast(fa ? "پریمیوم اعطا شد" : "Granted"); setGrant(null); load(q); }
    catch { toast("Error"); }
  };
  const doRevoke = async (userId) => {
    if (!confirm(fa ? "پریمیوم این کاربر لغو شود؟" : "Revoke premium for this user?")) return;
    try { await api.post("/admin/premium/revoke", { userId }); toast(fa ? "لغو شد" : "Revoked"); load(q); }
    catch { toast("Error"); }
  };
  const searchLearners = async (term) => {
    const r = await api.get(`/admin/premium/find?q=${encodeURIComponent(term)}`).catch(() => ({ results: [] }));
    setGrant((g) => ({ ...g, results: r.results || [] }));
  };
  if (d === false) return <div className="page"><div className="card empty-state"><h3>{t("noData")}</h3></div></div>;
  if (!d) return <Spinner />;
  const o = d.overview;
  const toman = (rial) => (rial / 10).toLocaleString(fa ? "fa-IR" : "en-US");
  const fmtDate = (iso) => iso ? fmtDateTime(iso, fa ? "fa" : "en") : (fa ? "بدون انقضا" : "no expiry");

  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="crown" size={18} /> {fa ? "مدیریت اکانت‌های پریمیوم" : "Premium accounts"}</h4>
        <button className="btn btn-primary btn-sm" onClick={() => setGrant({ search: "", results: [], days: 30, lifetime: false })}><Icon name="crown" size={14} /> {fa ? "اعطای پریمیوم" : "Grant premium"}</button>
      </div>

      {/* program on/off notice (the kill switch) */}
      <div className="card mb16" style={{ borderInlineStart: `4px solid ${o.programOn ? "#22a06b" : "#e0a400"}` }}>
        <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name={o.programOn ? "check" : "lock"} size={16} />
          {o.programOn
            ? (fa ? "برنامهٔ پریمیوم روشن است — به کاربران نمایش داده می‌شود." : "Premium program is ON — visible to users.")
            : (fa ? "برنامهٔ پریمیوم خاموش است — هیچ اثری برای کاربران دیده نمی‌شود." : "Premium program is OFF — invisible to users.")}
        </div>
        <div className="small muted mt8">
          {fa
            ? "برای روشن/خاموش کردن کامل برنامهٔ پریمیوم (تب پریمیوم، خرید گروهی، بنرها و قفل‌ها) به «کلیدهای ویژگی» → «فروش پریمیوم» بروید. وقتی خاموش است، کاربران قلب نامحدود دارند و هیچ تبلیغ یا پیشنهاد ارتقایی نمی‌بینند."
            : "To fully turn the premium program on/off (premium tab, group purchase, banners, locks), use Feature Flags → “Premium plans”. While off, users get unlimited hearts and see no ads or upgrade prompts."}
        </div>
      </div>

      {/* overview */}
      <div className="grid grid-4 mb16">
        <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--primary)" }}>{o.active}</div><div className="small">{fa ? "مشترک فعال" : "Active subscribers"}</div></div>
        <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.6rem", fontWeight: 900, color: o.expiringSoon ? "#e0a400" : undefined }}>{o.expiringSoon}</div><div className="small">{fa ? "رو به انقضا (۷ روز)" : "Expiring (7d)"}</div></div>
        <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.6rem", fontWeight: 900 }}>{toman(o.revenue.total)}</div><div className="small">{fa ? "درآمد کل (تومان)" : "Total revenue (T)"}</div></div>
        <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.3rem", fontWeight: 900 }}>{toman(o.revenue.subscriptions)} / {toman(o.revenue.group)}</div><div className="small">{fa ? "اشتراک / گروهی" : "Subs / Group"}</div></div>
      </div>

      {/* search + list */}
      <div className="card">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(q)} placeholder={fa ? "جستجوی مشترک…" : "Search subscribers…"} style={{ flex: 1 }} />
          <button className="btn btn-ghost btn-sm" onClick={() => load(q)}><Icon name="search" size={14} /></button>
        </div>
        {d.subscribers.length === 0
          ? <div className="empty-state"><div className="ico"><Icon name="crown" size={40} /></div><h3>{fa ? "هنوز مشترک پریمیومی نیست" : "No premium subscribers yet"}</h3></div>
          : <div className="table-wrap"><table>
            <thead><tr><th>{fa ? "کاربر" : "User"}</th><th>{fa ? "سطح" : "Tier"}</th><th>{fa ? "انقضا" : "Expires"}</th><th>{fa ? "روز باقی" : "Days left"}</th><th></th></tr></thead>
            <tbody>{d.subscribers.map((s) => (
              <tr key={s.id}>
                <td>{s.name} <span className="small muted">@{s.username}</span></td>
                <td>{s.tier}</td>
                <td className="small">{s.lifetime ? (fa ? "مادام‌العمر" : "Lifetime") : fmtDate(s.premium_until)}</td>
                <td>{s.lifetime ? "∞" : (s.daysLeft === 0 ? <span className="pill pill-danger">{fa ? "منقضی" : "expired"}</span> : s.daysLeft)}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => doGrant(s.id, 30, false)} title={fa ? "+۳۰ روز" : "+30 days"}>+30</button>
                  <button className="btn btn-danger btn-sm" onClick={() => doRevoke(s.id)}><Icon name="close" size={12} /></button>
                </td>
              </tr>
            ))}</tbody></table></div>}
      </div>

      {grant && (
        <Modal title={fa ? "اعطای پریمیوم" : "Grant premium"} onClose={() => setGrant(null)}>
          <div className="field"><label>{fa ? "جستجوی کاربر (نام/یوزرنیم/ایمیل)" : "Find learner (name/username/email)"}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={grant.search} onChange={(e) => setGrant({ ...grant, search: e.target.value })} onKeyDown={(e) => e.key === "Enter" && searchLearners(grant.search)} style={{ flex: 1 }} />
              <button className="btn btn-ghost btn-sm" onClick={() => searchLearners(grant.search)}><Icon name="search" size={14} /></button>
            </div>
          </div>
          <div className="grid grid-2 mb16">
            <div className="field"><label>{fa ? "تعداد روز" : "Days"}</label><input type="number" min="1" value={grant.days} disabled={grant.lifetime} onChange={(e) => setGrant({ ...grant, days: Math.max(1, Number(e.target.value) || 30) })} /></div>
            <label className="toggle-row" style={{ alignSelf: "end" }}>
              <span>{fa ? "مادام‌العمر" : "Lifetime"}</span>
              <input type="checkbox" checked={grant.lifetime} onChange={(e) => setGrant({ ...grant, lifetime: e.target.checked })} />
            </label>
          </div>
          {(grant.results || []).length > 0 && (
            <div style={{ display: "grid", gap: 6 }}>
              {grant.results.map((r) => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: "var(--panel3, #f4f7fb)", borderRadius: 8, padding: "6px 10px" }}>
                  <span>{r.name} <span className="small muted">@{r.username}</span> {r.premium && <span className="tag">{fa ? "پریمیوم" : "premium"}</span>}</span>
                  <button className="btn btn-primary btn-sm" onClick={() => doGrant(r.id, grant.days, grant.lifetime)}><Icon name="crown" size={13} /> {fa ? "اعطا" : "Grant"}</button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ---- Group purchase (volume discount) admin: define seat packs (each seat =
   an independent account) and view orders + redemption stats. Buyers get one
   code per seat to hand to friends; friends redeem on their own accounts. ---- */
function GroupPurchaseAdmin() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [d, setD] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = () => api.get("/admin/group").then(setD).catch(() => setD(false));
  useEffect(() => { load(); }, []);
  const blank = { title_fa: "", title_en: "", seats: 3, days: 30, price: 0, ord: 0, active: 1 };
  const save = async () => {
    try {
      if (edit.id) await api.put(`/admin/group/packs/${edit.id}`, edit);
      else await api.post("/admin/group/packs", edit);
      setEdit(null); toast(t("save")); load();
    } catch { toast("Error"); }
  };
  const remove = async (id) => { if (confirm(t("confirmDelete"))) { await api.del(`/admin/group/packs/${id}`); load(); } };
  if (d === false) return <div className="page"><div className="card empty-state"><h3>{t("noData")}</h3></div></div>;
  if (!d) return <Spinner />;
  const toman = (rial) => (rial / 10).toLocaleString(fa ? "fa-IR" : "en-US");

  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="users" size={18} /> {fa ? "خرید گروهی (تخفیف حجمی)" : "Group purchase (volume discount)"}</h4>
        <button className="btn btn-primary btn-sm" onClick={() => setEdit({ ...blank })}><Icon name="edit" size={14} /> {fa ? "بستهٔ جدید" : "New pack"}</button>
      </div>
      <div className="muted small mb16">
        {fa
          ? "هر «صندلی» یک اکانت کاملاً مستقل است (هیچ داده‌ای قاطی نمی‌شود). خریدار یک بسته می‌خرد و به‌ازای هر صندلی یک کد دعوت می‌گیرد تا به دوستانش بدهد؛ هر دوست کد را روی حساب خودش فعال می‌کند. قیمت هر صندلی را پایین‌تر از پلن تکی بگذارید تا خرید گروهی جذاب شود."
          : "Each 'seat' is a fully independent account (no data mixing). The buyer purchases a pack and receives one invite code per seat to hand to friends; each friend redeems it on their own account. Price seats below the single plan to make group buying attractive."}
      </div>

      {/* stats */}
      <div className="grid grid-4 mb16">
        <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--primary)" }}>{d.stats.paidOrders}</div><div className="small">{fa ? "سفارش پرداخت‌شده" : "Paid orders"}</div></div>
        <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.5rem", fontWeight: 900 }}>{toman(d.stats.revenue)}</div><div className="small">{fa ? "درآمد (تومان)" : "Revenue (T)"}</div></div>
        <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.5rem", fontWeight: 900 }}>{d.stats.seatsSold}</div><div className="small">{fa ? "صندلی فروخته‌شده" : "Seats sold"}</div></div>
        <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.5rem", fontWeight: 900 }}>{d.stats.redeemRate}%</div><div className="small">{fa ? "نرخ استفاده از کد" : "Redeem rate"}</div></div>
      </div>

      {/* packs */}
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{fa ? "بسته‌ها" : "Packs"}</div>
      {d.packs.length === 0 && <div className="card empty-state"><div className="ico"><Icon name="users" size={40} /></div><h3>{t("noData")}</h3></div>}
      <div className="grid grid-2">
        {d.packs.map((p) => (
          <div key={p.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 800 }}>{(fa ? p.title_fa : p.title_en) || p.title_fa}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {p.savedPct > 0 && <span className="tag" style={{ color: "#12805a" }}>{p.savedPct}% {fa ? "تخفیف" : "off"}</span>}
                <span className="tag" style={{ background: p.active ? "var(--accentGlow)" : "var(--panel3)" }}>{p.active ? (fa ? "فعال" : "Live") : (fa ? "غیرفعال" : "Off")}</span>
              </div>
            </div>
            <div className="small muted mt8">{fa ? `${p.seats} صندلی مستقل · ${p.days} روز` : `${p.seats} independent seats · ${p.days} days`}</div>
            <div className="kv mt8">
              <span className="tag">{fa ? "قیمت کل" : "Total"}: <b>{toman(p.price)} {fa ? "ت" : "T"}</b></span>
              <span className="tag">{fa ? "هر صندلی" : "Per seat"}: <b>{toman(p.perSeat)} {fa ? "ت" : "T"}</b></span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...p })}><Icon name="edit" size={13} /> {t("edit")}</button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}><Icon name="trash" size={13} /> {t("delete")}</button>
            </div>
          </div>
        ))}
      </div>

      {/* orders */}
      {d.orders.length > 0 && (
        <div className="card mt16">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>{fa ? "سفارش‌های اخیر" : "Recent orders"}</div>
          <div className="table-wrap"><table>
            <thead><tr><th>{fa ? "خریدار" : "Buyer"}</th><th>{fa ? "صندلی" : "Seats"}</th><th>{fa ? "مبلغ" : "Amount"}</th><th>{fa ? "کدهای استفاده‌شده" : "Redeemed"}</th><th>{fa ? "وضعیت" : "Status"}</th></tr></thead>
            <tbody>{d.orders.map((o) => (
              <tr key={o.id}>
                <td>{o.buyer}</td>
                <td>{o.seats}</td>
                <td className="small">{toman(o.amount)} {fa ? "ت" : "T"}</td>
                <td>{o.redeemed_codes}/{o.total_codes}</td>
                <td><span className={`pill pill-${o.status === "paid" ? "active" : o.status === "pending" ? "medium" : "danger"}`}>{o.status}</span></td>
              </tr>
            ))}</tbody></table></div>
        </div>
      )}

      {edit && (
        <Modal title={edit.id ? t("edit") : (fa ? "بستهٔ جدید" : "New pack")} onClose={() => setEdit(null)} onSave={save}>
          <div className="grid grid-2">
            <div className="field"><label>{fa ? "عنوان (فا)" : "Title (fa)"}</label><input value={edit.title_fa} onChange={(e) => setEdit({ ...edit, title_fa: e.target.value })} placeholder={fa ? "مثلاً: بستهٔ کلاسی ۵ نفره" : ""} /></div>
            <div className="field"><label>Title (en)</label><input value={edit.title_en} onChange={(e) => setEdit({ ...edit, title_en: e.target.value })} /></div>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>{fa ? "تعداد صندلی (اکانت مستقل)" : "Seats (independent accounts)"}</label><input type="number" min="2" value={edit.seats} onChange={(e) => setEdit({ ...edit, seats: Math.max(2, Number(e.target.value) || 2) })} /></div>
            <div className="field"><label>{fa ? "روز پریمیوم هر صندلی" : "Premium days per seat"}</label><input type="number" min="1" value={edit.days} onChange={(e) => setEdit({ ...edit, days: Math.max(1, Number(e.target.value) || 30) })} /></div>
          </div>
          <div className="field"><label>{fa ? "قیمت کل بسته (ریال)" : "Total pack price (Rial)"}</label>
            <input type="number" min="0" value={edit.price} onChange={(e) => setEdit({ ...edit, price: Math.max(0, Number(e.target.value) || 0) })} />
            <div className="small muted mt8">
              {edit.seats > 0 && `${fa ? "هر صندلی" : "Per seat"}: ${toman(Math.round(edit.price / edit.seats))} ${fa ? "تومان" : "T"}`}
              {" · "}{fa ? "پلن تکی ماهانه" : "Single monthly"}: {toman(d.singleMonthly || 990000)} {fa ? "تومان" : "T"}
            </div>
          </div>
          <div className="field"><label>{fa ? "ترتیب" : "Order"}</label><input type="number" value={edit.ord} onChange={(e) => setEdit({ ...edit, ord: Number(e.target.value) || 0 })} /></div>
          <label className="toggle-row" style={{ marginTop: 8 }}>
            <span><Icon name="check" size={15} /> {fa ? "فعال (نمایش به کاربران)" : "Active (shown to users)"}</span>
            <input type="checkbox" checked={!!edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked ? 1 : 0 })} />
          </label>
        </Modal>
      )}
    </div>
  );
}

/* ---- Daily Diagnosis Challenge admin: author the original cases used by the
   Wordle-style daily game. Each case = vignette + progressive clues + a diagnosis
   picklist + the answer (with accepted aliases) + an explanation. All content is
   written here by the admin. */
/* ---- Path characters (mascots) admin ----
   Full control over the learning-path character cast: on/off, animation speed,
   per-character image (upload), and the rotating speech lines per phase. Reads
   /site-content/mascots and saves via PUT. All copy is bilingual (fa/en). */
function MascotsAdmin() {
  const { t, lang } = useApp();
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const fa = lang !== "en";

  useEffect(() => { api.get("/site-content/mascots").then((d) => setCfg(d.mascots)).catch(() => setCfg(null)); }, []);
  if (!cfg) return <div className="card"><div className="skeleton sk-card" /></div>;

  // helpers to edit nested line arrays as newline-separated textareas
  const linesToText = (arr) => (Array.isArray(arr) ? arr.join("\n") : "");
  const textToLines = (txt) => txt.split("\n").map((s) => s.trim()).filter(Boolean);

  const setDrLines = (phase, lg, txt) => setCfg((c) => ({
    ...c, dr: { ...c.dr, lines: { ...c.dr.lines, [phase]: { ...c.dr.lines[phase], [lg]: textToLines(txt) } } },
  }));
  const setMbLines = (lg, txt) => setCfg((c) => ({
    ...c, microbe: { ...c.microbe, lines: { ...c.microbe.lines, [lg]: textToLines(txt) } },
  }));

  const save = async () => {
    setBusy(true);
    try { const d = await api.put("/site-content/mascots", { mascots: cfg }); setCfg(d.mascots); toast(t("saved")); }
    catch (e) { toast(String(e.message)); } finally { setBusy(false); }
  };
  const reset = async () => {
    if (!confirm(fa ? "بازگرداندن به حالت پیش‌فرض؟" : "Reset to defaults?")) return;
    setBusy(true);
    try { const d = await api.del("/site-content/mascots"); setCfg(d.mascots); toast(t("saved")); }
    catch (e) { toast(String(e.message)); } finally { setBusy(false); }
  };

  const SEGS = [["slow", fa ? "آهسته" : "Slow"], ["normal", fa ? "معمولی" : "Normal"], ["fast", fa ? "سریع" : "Fast"]];
  const PHASES = [["start", fa ? "شروع بخش" : "Section start"], ["mid", fa ? "در حال پیشرفت" : "In progress"], ["done", fa ? "کامل‌شده" : "Completed"]];

  return (
    <div>
      <div className="section-title"><h3>🎭 {t("mascotsAdmin")}</h3></div>
      <p className="muted mb16" style={{ maxWidth: 640 }}>
        {fa ? "کاراکترهای مسیر یادگیری را کنترل کن: روشن/خاموش، سرعت حرکت، تصویر، و متن‌های گفتار (هر خط یک جمله؛ کاراکتر بین آن‌ها می‌چرخد)."
            : "Control the learning-path characters: on/off, animation speed, image, and speech lines (one per line; the character rotates through them)."}
      </p>

      {/* global toggles */}
      <div className="card mb16">
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
          <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
          {fa ? "نمایش کاراکترها در مسیر" : "Show characters on the path"}
        </label>
        <div className="field mt16">
          <label>{fa ? "سرعت حرکت" : "Animation speed"}</label>
          <div className="set-seg set-seg-wrap" role="group">
            {SEGS.map(([v, lbl]) => (
              <button key={v} type="button" className={`set-seg-btn ${cfg.speed === v ? "active" : ""}`}
                onClick={() => setCfg({ ...cfg, speed: v })}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Dr. Med */}
      <div className="card mb16">
        <div className="section-title"><h4>🩺 {fa ? "دکتر مِد (راهنما)" : "Dr. Med (guide)"}</h4></div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, marginBottom: 12 }}>
          <input type="checkbox" checked={cfg.dr.enabled} onChange={(e) => setCfg({ ...cfg, dr: { ...cfg.dr, enabled: e.target.checked } })} />
          {fa ? "فعال" : "Enabled"}
        </label>
        <ImageUpload value={cfg.dr.img} onChange={(url) => setCfg({ ...cfg, dr: { ...cfg.dr, img: url } })}
          label={fa ? "تصویر اصلی کاراکتر" : "Primary character image"} />

        {/* Guide POOL — extra characters that rotate per section (variety) */}
        <div className="mt16">
          <div style={{ fontWeight: 800, marginBottom: 6 }}>
            {fa ? "گالریِ راهنماها (بین بخش‌ها می‌چرخند)" : "Guide gallery (rotate per section)"}
          </div>
          <p className="small muted" style={{ marginTop: 0 }}>
            {fa ? "چند کاراکترِ راهنما بگذار تا هر بخش یکی را نشان دهد — مثل دکتر خانم، قلب یا مغزِ بامزه."
                : "Add several guide characters so each section shows a different one — e.g. a female doctor, or cute heart/brain."}
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            {(cfg.dr.guides || []).map((g, i) => (
              <div key={i} style={{ position: "relative", width: 92, height: 92, borderRadius: 12,
                border: "1px solid var(--border2)", background: "var(--bg2)", overflow: "hidden",
                display: "grid", placeItems: "center" }}>
                <img src={g} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                <button type="button" className="btn btn-sm btn-danger" title={fa ? "حذف" : "Remove"}
                  style={{ position: "absolute", top: 2, insetInlineEnd: 2, padding: "0 7px", lineHeight: 1.6 }}
                  onClick={() => setCfg({ ...cfg, dr: { ...cfg.dr, guides: cfg.dr.guides.filter((_, j) => j !== i) } })}>×</button>
              </div>
            ))}
          </div>
          <div className="mt8">
            <ImageUpload value="" onChange={(url) => setCfg({ ...cfg, dr: { ...cfg.dr, guides: [...(cfg.dr.guides || []), url] } })}
              label={fa ? "افزودن راهنمای جدید به گالری" : "Add a guide to the gallery"} />
          </div>
        </div>

        {PHASES.map(([ph, lbl]) => (
          <div key={ph} className="mt16">
            <div style={{ fontWeight: 800, marginBottom: 6 }}>{lbl}</div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="field"><label>فارسی</label>
                <textarea rows={3} value={linesToText(cfg.dr.lines[ph]?.fa)} onChange={(e) => setDrLines(ph, "fa", e.target.value)} /></div>
              <div className="field"><label>English</label>
                <textarea rows={3} value={linesToText(cfg.dr.lines[ph]?.en)} onChange={(e) => setDrLines(ph, "en", e.target.value)} /></div>
            </div>
          </div>
        ))}
      </div>

      {/* Microbe */}
      <div className="card mb16">
        <div className="section-title"><h4>🦠 {fa ? "میکروب (حریف باس)" : "Microbe (boss rival)"}</h4></div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, marginBottom: 12 }}>
          <input type="checkbox" checked={cfg.microbe.enabled} onChange={(e) => setCfg({ ...cfg, microbe: { ...cfg.microbe, enabled: e.target.checked } })} />
          {fa ? "فعال" : "Enabled"}
        </label>
        <ImageUpload value={cfg.microbe.img} onChange={(url) => setCfg({ ...cfg, microbe: { ...cfg.microbe, img: url } })}
          label={fa ? "تصویر کاراکتر" : "Character image"} />
        <div className="grid grid-2 mt16" style={{ gap: 12 }}>
          <div className="field"><label>فارسی</label>
            <textarea rows={3} value={linesToText(cfg.microbe.lines?.fa)} onChange={(e) => setMbLines("fa", e.target.value)} /></div>
          <div className="field"><label>English</label>
            <textarea rows={3} value={linesToText(cfg.microbe.lines?.en)} onChange={(e) => setMbLines("en", e.target.value)} /></div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "…" : t("save")}</button>
        <button className="btn btn-ghost" onClick={reset} disabled={busy}>{fa ? "بازنشانی به پیش‌فرض" : "Reset to defaults"}</button>
      </div>
    </div>
  );
}

function DxAdmin() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [d, setD] = useState(null);
  const [edit, setEdit] = useState(null);
  const [importing, setImporting] = useState(false);
  const [csv, setCsv] = useState("");
  const [importResult, setImportResult] = useState(null);
  const doImport = async () => {
    try {
      const r = await api.post("/admin/dx/import", { csv });
      setImportResult(r); load();
    } catch { toast("Error"); }
  };
  const load = () => api.get("/admin/dx").then(setD).catch(() => setD(false));
  useEffect(() => { load(); }, []);
  const blank = {
    category_fa: "", category_en: "", vignette_fa: "", vignette_en: "",
    clues: [{ fa: "", en: "" }], answer_fa: "", answer_en: "", aliases: [],
    options: [{ fa: "", en: "" }], explanation_fa: "", explanation_en: "",
    difficulty: "medium", max_guesses: 6, scheduled_day: "", active: 1, ord: 0,
  };
  const save = async () => {
    try {
      const body = { ...edit, aliases: typeof edit.aliases === "string" ? edit.aliases.split(",").map((s) => s.trim()).filter(Boolean) : edit.aliases };
      if (edit.id) await api.put(`/admin/dx/${edit.id}`, body); else await api.post("/admin/dx", body);
      setEdit(null); toast(t("save")); load();
    } catch { toast("Error"); }
  };
  const remove = async (id) => { if (confirm(t("confirmDelete"))) { await api.del(`/admin/dx/${id}`); load(); } };
  if (d === false) return <div className="page"><div className="card empty-state"><h3>{t("noData")}</h3></div></div>;
  if (!d) return <Spinner />;

  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="target" size={18} /> {fa ? "چالش تشخیص روز" : "Daily Diagnosis Challenge"}</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="btn btn-ghost btn-sm" href="/api/admin/dx/import/template.csv" download><Icon name="download" size={14} /> {fa ? "قالب CSV" : "CSV template"}</a>
          <button className="btn btn-ghost btn-sm" onClick={() => setImporting(true)}><Icon name="upload" size={14} /> {fa ? "ورود دسته‌جمعی" : "Bulk import"}</button>
          <button className="btn btn-primary btn-sm" onClick={() => setEdit({ ...blank })}><Icon name="edit" size={14} /> {fa ? "کیس جدید" : "New case"}</button>
        </div>
      </div>
      <div className="muted small mb16">
        {fa
          ? "کیس‌های اصیلِ خودتان را اینجا بنویسید. بازیکن وینیت را می‌بیند، تشخیص را از فهرست انتخاب می‌کند و هر حدس اشتباه یک سرنخ جدید باز می‌کند. کیس امروز به‌صورت خودکار از میان کیس‌های فعال انتخاب می‌شود (یا می‌توانید تاریخی مشخص کنید)."
          : "Author your own original cases. Players see the vignette, pick a diagnosis from the list, and each wrong guess reveals a new clue. Today's case is auto-picked from active cases (or pin a date)."}
      </div>
      <div className="grid grid-4 mb16">
        <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--primary)" }}>{d.stats.active}</div><div className="small">{fa ? "کیس فعال" : "Active cases"}</div></div>
        <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.5rem", fontWeight: 900 }}>{d.stats.played}</div><div className="small">{fa ? "دفعات بازی" : "Plays"}</div></div>
        <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.5rem", fontWeight: 900 }}>{d.stats.solveRate}%</div><div className="small">{fa ? "نرخ حل" : "Solve rate"}</div></div>
        <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.5rem", fontWeight: 900 }}>{d.stats.total}</div><div className="small">{fa ? "کل کیس‌ها" : "Total"}</div></div>
      </div>
      {d.cases.length === 0 && <div className="card empty-state"><div className="ico"><Icon name="target" size={40} /></div><h3>{t("noData")}</h3></div>}
      <div className="grid grid-2">
        {d.cases.map((c) => (
          <div key={c.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 800 }}>{(fa ? c.answer_fa : c.answer_en) || c.answer_fa}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {c.id === d.todayId && <span className="tag" style={{ background: "var(--accentGlow)" }}>{fa ? "امروز" : "Today"}</span>}
                <span className="tag">{t(c.difficulty)}</span>
                <span className="tag" style={{ background: c.active ? "var(--accentGlow)" : "var(--panel3)" }}>{c.active ? (fa ? "فعال" : "Live") : (fa ? "غیرفعال" : "Off")}</span>
              </div>
            </div>
            <div className="small muted mt8">{(fa ? c.category_fa : c.category_en)} · {(fa ? c.vignette_fa : c.vignette_en)}</div>
            <div className="small muted mt8">{fa ? "سرنخ‌ها:" : "Clues:"} {(c.clues || []).length} · {fa ? "گزینه‌ها:" : "Options:"} {(c.options || []).length}{c.scheduled_day ? ` · 📅 ${c.scheduled_day}` : ""}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...c, aliases: (c.aliases || []).join(", ") })}><Icon name="edit" size={13} /> {t("edit")}</button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(c.id)}><Icon name="trash" size={13} /> {t("delete")}</button>
            </div>
          </div>
        ))}
      </div>
      {edit && <DxEditor edit={edit} setEdit={setEdit} save={save} t={t} fa={fa} />}
      {importing && (
        <Modal title={fa ? "ورود دسته‌جمعی کیس‌ها" : "Bulk import cases"} onClose={() => { setImporting(false); setCsv(""); setImportResult(null); }} onSave={doImport} wide>
          <div className="muted small mb8">
            {fa
              ? "فقط محتوایی را وارد کنید که حق استفاده از آن را دارید. هر ردیف یک کیس است. سرنخ‌ها/گزینه‌ها/معادل‌ها را با علامت | جدا کنید. قالب نمونه را از دکمهٔ «قالب CSV» بگیرید."
              : "Only import content you have the rights to use. One case per row. Separate clues/options/aliases with |. Get the sample from the CSV template button."}
          </div>
          <textarea style={{ minHeight: 180, fontFamily: "monospace", direction: "ltr", textAlign: "left" }}
            value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="category_fa,vignette_fa,clues_fa,answer_fa,options_fa,..." />
          {importResult && (
            <div className={importResult.errors?.length ? "note-warn" : "note-ok"} style={{ marginTop: 10, borderRadius: 8, padding: "8px 12px", background: importResult.errors?.length ? "#fff8e6" : "#e7f7ef", color: importResult.errors?.length ? "#7a5b00" : "#12805a" }}>
              {fa ? `${importResult.imported} کیس وارد شد.` : `${importResult.imported} cases imported.`}
              {importResult.errors?.length > 0 && (fa ? ` — ${importResult.errors.length} خطا (ردیف‌های ${importResult.errors.map((e) => e.row).join("، ")})` : ` — ${importResult.errors.length} errors (rows ${importResult.errors.map((e) => e.row).join(", ")})`)}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function DxEditor({ edit, setEdit, save, t, fa }) {
  const setClue = (i, k, v) => setEdit({ ...edit, clues: edit.clues.map((c, j) => j === i ? { ...c, [k]: v } : c) });
  const addClue = () => setEdit({ ...edit, clues: [...edit.clues, { fa: "", en: "" }] });
  const delClue = (i) => setEdit({ ...edit, clues: edit.clues.filter((_, j) => j !== i) });
  const setOpt = (i, k, v) => setEdit({ ...edit, options: edit.options.map((c, j) => j === i ? { ...c, [k]: v } : c) });
  const addOpt = () => setEdit({ ...edit, options: [...edit.options, { fa: "", en: "" }] });
  const delOpt = (i) => setEdit({ ...edit, options: edit.options.filter((_, j) => j !== i) });
  return (
    <Modal title={edit.id ? t("edit") : (fa ? "کیس جدید" : "New case")} onClose={() => setEdit(null)} onSave={save} wide>
      <div className="grid grid-2">
        <div className="field"><label>{fa ? "دسته (فا)" : "Category (fa)"}</label><input value={edit.category_fa} onChange={(e) => setEdit({ ...edit, category_fa: e.target.value })} /></div>
        <div className="field"><label>Category (en)</label><input value={edit.category_en} onChange={(e) => setEdit({ ...edit, category_en: e.target.value })} /></div>
      </div>
      <div className="field"><label>{fa ? "وینیت آغازین (فا)" : "Opening vignette (fa)"}</label><textarea value={edit.vignette_fa} onChange={(e) => setEdit({ ...edit, vignette_fa: e.target.value })} /></div>
      <div className="field"><label>Opening vignette (en)</label><textarea value={edit.vignette_en} onChange={(e) => setEdit({ ...edit, vignette_en: e.target.value })} /></div>

      <div className="section-title"><label className="small muted"><Icon name="bulb" size={15} /> {fa ? "سرنخ‌های پلکانی (یکی پس از هر حدس اشتباه)" : "Progressive clues (one per wrong guess)"}</label>
        <button type="button" className="btn btn-sm btn-primary" onClick={addClue}>+ {fa ? "سرنخ" : "Clue"}</button></div>
      {edit.clues.map((c, i) => (
        <div key={i} className="card mb8" style={{ background: "var(--panel2)", padding: 10 }}>
          <div className="grid grid-2">
            <div className="field"><label>{fa ? `سرنخ ${i + 1} (فا)` : `Clue ${i + 1} (fa)`}</label><input value={c.fa} onChange={(e) => setClue(i, "fa", e.target.value)} /></div>
            <div className="field"><label>{fa ? `سرنخ ${i + 1} (en)` : `Clue ${i + 1} (en)`}</label><input value={c.en} onChange={(e) => setClue(i, "en", e.target.value)} /></div>
          </div>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => delClue(i)}><Icon name="trash" size={12} /></button>
        </div>
      ))}

      <div className="grid grid-2">
        <div className="field"><label>{fa ? "تشخیص درست (فا)" : "Correct diagnosis (fa)"}</label><input value={edit.answer_fa} onChange={(e) => setEdit({ ...edit, answer_fa: e.target.value })} /></div>
        <div className="field"><label>Correct diagnosis (en)</label><input value={edit.answer_en} onChange={(e) => setEdit({ ...edit, answer_en: e.target.value })} /></div>
      </div>
      <div className="field"><label>{fa ? "املاهای پذیرفته‌شده (با ویرگول)" : "Accepted aliases (comma-separated)"}</label>
        <input value={typeof edit.aliases === "string" ? edit.aliases : (edit.aliases || []).join(", ")} onChange={(e) => setEdit({ ...edit, aliases: e.target.value })} placeholder="mi, stemi, سکته قلبی" /></div>

      <div className="section-title"><label className="small muted"><Icon name="check" size={15} /> {fa ? "گزینه‌های تشخیص (شامل پاسخ درست)" : "Diagnosis options (include the answer)"}</label>
        <button type="button" className="btn btn-sm btn-primary" onClick={addOpt}>+ {fa ? "گزینه" : "Option"}</button></div>
      {edit.options.map((o, i) => (
        <div key={i} className="card mb8" style={{ background: "var(--panel2)", padding: 10 }}>
          <div className="grid grid-2">
            <div className="field"><label>{fa ? `گزینه ${i + 1} (فا)` : `Option ${i + 1} (fa)`}</label><input value={o.fa} onChange={(e) => setOpt(i, "fa", e.target.value)} /></div>
            <div className="field"><label>{fa ? `گزینه ${i + 1} (en)` : `Option ${i + 1} (en)`}</label><input value={o.en} onChange={(e) => setOpt(i, "en", e.target.value)} /></div>
          </div>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => delOpt(i)}><Icon name="trash" size={12} /></button>
        </div>
      ))}

      <div className="field"><label>{fa ? "توضیح پایانی (فا)" : "Explanation (fa)"}</label><textarea value={edit.explanation_fa} onChange={(e) => setEdit({ ...edit, explanation_fa: e.target.value })} /></div>
      <div className="field"><label>Explanation (en)</label><textarea value={edit.explanation_en} onChange={(e) => setEdit({ ...edit, explanation_en: e.target.value })} /></div>

      <div className="grid grid-2">
        <div className="field"><label>{fa ? "سختی" : "Difficulty"}</label>
          <select value={edit.difficulty} onChange={(e) => setEdit({ ...edit, difficulty: e.target.value })}>
            {["easy", "medium", "hard"].map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></div>
        <div className="field"><label>{fa ? "حداکثر حدس" : "Max guesses"}</label><input type="number" min="2" max="10" value={edit.max_guesses} onChange={(e) => setEdit({ ...edit, max_guesses: Number(e.target.value) || 6 })} /></div>
      </div>
      <div className="grid grid-2">
        <div className="field"><label>{fa ? "تاریخ ثابت (اختیاری) YYYY-MM-DD" : "Pin to date (optional) YYYY-MM-DD"}</label><input value={edit.scheduled_day} onChange={(e) => setEdit({ ...edit, scheduled_day: e.target.value })} placeholder="2026-07-15" /></div>
        <div className="field"><label>{fa ? "ترتیب" : "Order"}</label><input type="number" value={edit.ord} onChange={(e) => setEdit({ ...edit, ord: Number(e.target.value) || 0 })} /></div>
      </div>
      <label className="toggle-row" style={{ marginTop: 8 }}>
        <span><Icon name="check" size={15} /> {fa ? "فعال" : "Active"}</span>
        <input type="checkbox" checked={!!edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked ? 1 : 0 })} />
      </label>
    </Modal>
  );
}

/* ---- Landing page manager: real social proof for logged-out visitors.
   Manage testimonials (with optional photo, else initials avatar), trust badges
   shown near the CTA, an objection-handling FAQ, and the live-stats display
   floor (so a fresh install's numbers still look appealing without lying —
   the real number is shown as soon as it passes the floor). */
const BADGE_ICONS = ["check", "globe", "download", "lock", "shield", "medal", "bolt", "star", "crown", "book", "target", "clock"];

function LandingManager() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [sub, setSub] = useState("testimonials");
  const subs = [
    ["testimonials", "medal", fa ? "نظرات کاربران" : "Testimonials"],
    ["badges", "shield", fa ? "نشان‌های اعتماد" : "Trust badges"],
    ["faqs", "book", fa ? "سوالات پرتکرار" : "FAQ"],
    ["stats", "chart", fa ? "آمار صفحهٔ فرود" : "Landing stats"],
  ];
  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="medal" size={18} /> {fa ? "مدیریت صفحهٔ فرود (اثبات اجتماعی)" : "Landing page (social proof)"}</h4></div>
      <div className="muted small mb16">
        {fa
          ? "این‌ها همان چیزهایی هستند که یک بازدیدکنندهٔ جدید (قبل از ورود) روی صفحهٔ اول می‌بیند. نظرات واقعی و مشخص (نام + نقش + نتیجه) بیشترین اعتماد را می‌سازند."
          : "This is what a brand-new visitor sees before signing in. Real, specific testimonials (name + role + result) build the most trust."}
      </div>
      <div className="subtabs mb16" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {subs.map(([id, ic, label]) => (
          <button key={id} className={`btn btn-sm ${sub === id ? "btn-primary" : "btn-ghost"}`} onClick={() => setSub(id)}>
            <Icon name={ic} size={14} /> {label}
          </button>
        ))}
      </div>
      {sub === "testimonials" && <TestimonialsAdmin />}
      {sub === "badges" && <BadgesAdmin />}
      {sub === "faqs" && <LandingFaqAdmin />}
      {sub === "stats" && <StatsFloorAdmin />}
    </div>
  );
}

function TestimonialsAdmin() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = () => api.get("/admin/landing").then((d) => setItems(d.testimonials)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  const blank = { name_fa: "", name_en: "", role_fa: "", role_en: "", quote_fa: "", quote_en: "", photo: "", rating: 5, featured: 0, ord: 0, published: 1 };
  const save = async () => {
    try {
      if (edit.id) await api.put(`/admin/landing/testimonials/${edit.id}`, edit);
      else await api.post("/admin/landing/testimonials", edit);
      setEdit(null); toast(t("save")); load();
    } catch { toast("Error"); }
  };
  const remove = async (id) => { if (confirm(t("confirmDelete"))) { await api.del(`/admin/landing/testimonials/${id}`); load(); } };
  if (!items) return <Spinner />;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setEdit({ ...blank })}><Icon name="edit" size={14} /> {fa ? "نظر جدید" : "New testimonial"}</button>
      </div>
      {items.length === 0 && <div className="card empty-state"><div className="ico"><Icon name="medal" size={40} /></div><h3>{t("noData")}</h3></div>}
      <div className="grid grid-2">
        {items.map((a) => (
          <div key={a.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 800 }}>{(fa ? a.name_fa : a.name_en) || a.name_fa}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {!!a.featured && <span className="tag"><Icon name="pin" size={11} /> {fa ? "برجسته" : "Pinned"}</span>}
                <span className="tag" style={{ color: "#f5b301" }}>{"★".repeat(a.rating || 5)}</span>
                <span className="tag" style={{ background: a.published ? "var(--accentGlow)" : "var(--panel3)" }}>{a.published ? (fa ? "منتشر" : "Live") : (fa ? "پیش‌نویس" : "Draft")}</span>
              </div>
            </div>
            <div className="small muted">{(fa ? a.role_fa : a.role_en) || a.role_fa}</div>
            <div className="small mt8" style={{ maxHeight: 60, overflow: "hidden", lineHeight: 1.7 }}>{(fa ? a.quote_fa : a.quote_en) || a.quote_fa}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...a })}><Icon name="edit" size={13} /> {t("edit")}</button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(a.id)}><Icon name="trash" size={13} /> {t("delete")}</button>
            </div>
          </div>
        ))}
      </div>
      {edit && (
        <Modal title={edit.id ? t("edit") : (fa ? "نظر جدید" : "New testimonial")} onClose={() => setEdit(null)} onSave={save}>
          <div className="grid grid-2">
            <div className="field"><label>{fa ? "نام (فا)" : "Name (fa)"}</label><input value={edit.name_fa} onChange={(e) => setEdit({ ...edit, name_fa: e.target.value })} /></div>
            <div className="field"><label>Name (en)</label><input value={edit.name_en} onChange={(e) => setEdit({ ...edit, name_en: e.target.value })} /></div>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>{fa ? "نقش/عنوان (فا)" : "Role (fa)"}</label><input value={edit.role_fa} onChange={(e) => setEdit({ ...edit, role_fa: e.target.value })} placeholder={fa ? "مثلاً: داوطلب پره‌انترنی" : ""} /></div>
            <div className="field"><label>Role (en)</label><input value={edit.role_en} onChange={(e) => setEdit({ ...edit, role_en: e.target.value })} /></div>
          </div>
          <div className="field"><label>{fa ? "متن نظر (فا)" : "Quote (fa)"}</label><textarea style={{ minHeight: 80 }} value={edit.quote_fa} onChange={(e) => setEdit({ ...edit, quote_fa: e.target.value })} /></div>
          <div className="field"><label>Quote (en)</label><textarea style={{ minHeight: 80 }} value={edit.quote_en} onChange={(e) => setEdit({ ...edit, quote_en: e.target.value })} /></div>
          <ImageUpload value={edit.photo} onChange={(url) => setEdit({ ...edit, photo: url })} label={fa ? "عکس (اختیاری — اگر نگذاری، آواتار حروف اول نام ساخته می‌شود)" : "Photo (optional — falls back to initials avatar)"} />
          <div className="grid grid-2">
            <div className="field"><label>{fa ? "امتیاز (۱ تا ۵ ستاره)" : "Rating (1-5)"}</label>
              <select value={edit.rating} onChange={(e) => setEdit({ ...edit, rating: Number(e.target.value) })}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
              </select>
            </div>
            <div className="field"><label>{fa ? "ترتیب" : "Order"}</label><input type="number" value={edit.ord} onChange={(e) => setEdit({ ...edit, ord: Number(e.target.value) || 0 })} /></div>
          </div>
          <label className="toggle-row" style={{ marginTop: 8 }}>
            <span><Icon name="pin" size={15} /> {fa ? "برجسته (بالای لیست)" : "Feature (pin to front)"}</span>
            <input type="checkbox" checked={!!edit.featured} onChange={(e) => setEdit({ ...edit, featured: e.target.checked ? 1 : 0 })} />
          </label>
          <label className="toggle-row" style={{ marginTop: 8 }}>
            <span><Icon name="check" size={15} /> {fa ? "منتشر شود" : "Published"}</span>
            <input type="checkbox" checked={!!edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked ? 1 : 0 })} />
          </label>
        </Modal>
      )}
    </div>
  );
}

function BadgesAdmin() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = () => api.get("/admin/landing").then((d) => setItems(d.badges)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  const blank = { icon: "check", label_fa: "", label_en: "", ord: 0, published: 1 };
  const save = async () => {
    try {
      if (edit.id) await api.put(`/admin/landing/badges/${edit.id}`, edit);
      else await api.post("/admin/landing/badges", edit);
      setEdit(null); toast(t("save")); load();
    } catch { toast("Error"); }
  };
  const remove = async (id) => { if (confirm(t("confirmDelete"))) { await api.del(`/admin/landing/badges/${id}`); load(); } };
  if (!items) return <Spinner />;
  return (
    <div>
      <div className="muted small mb16">{fa ? "نشان‌های کوتاهی که زیر دکمهٔ «شروع رایگان» نمایش داده می‌شوند تا نگرانی‌های کاربر را رفع کنند (مثل «بدون نیاز به کارت بانکی»)." : "Short reassurance badges shown under the primary CTA (e.g. \"No credit card required\")."}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setEdit({ ...blank })}><Icon name="edit" size={14} /> {fa ? "نشان جدید" : "New badge"}</button>
      </div>
      {items.length === 0 && <div className="card empty-state"><div className="ico"><Icon name="shield" size={40} /></div><h3>{t("noData")}</h3></div>}
      <div className="grid grid-2">
        {items.map((b) => (
          <div key={b.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name={b.icon} size={20} />
              <div>
                <div style={{ fontWeight: 700 }}>{(fa ? b.label_fa : b.label_en) || b.label_fa}</div>
                {!b.published && <span className="tag">{fa ? "پیش‌نویس" : "Draft"}</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...b })}><Icon name="edit" size={13} /></button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(b.id)}><Icon name="trash" size={13} /></button>
            </div>
          </div>
        ))}
      </div>
      {edit && (
        <Modal title={edit.id ? t("edit") : (fa ? "نشان جدید" : "New badge")} onClose={() => setEdit(null)} onSave={save}>
          <div className="field"><label>{fa ? "آیکون" : "Icon"}</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {BADGE_ICONS.map((ic) => (
                <button key={ic} type="button" className={`btn btn-sm ${edit.icon === ic ? "btn-primary" : "btn-ghost"}`} onClick={() => setEdit({ ...edit, icon: ic })} style={{ padding: "8px 10px" }}>
                  <Icon name={ic} size={18} />
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>{fa ? "متن (فا)" : "Label (fa)"}</label><input value={edit.label_fa} onChange={(e) => setEdit({ ...edit, label_fa: e.target.value })} /></div>
            <div className="field"><label>Label (en)</label><input value={edit.label_en} onChange={(e) => setEdit({ ...edit, label_en: e.target.value })} /></div>
          </div>
          <div className="field"><label>{fa ? "ترتیب" : "Order"}</label><input type="number" value={edit.ord} onChange={(e) => setEdit({ ...edit, ord: Number(e.target.value) || 0 })} /></div>
          <label className="toggle-row" style={{ marginTop: 8 }}>
            <span><Icon name="check" size={15} /> {fa ? "منتشر شود" : "Published"}</span>
            <input type="checkbox" checked={!!edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked ? 1 : 0 })} />
          </label>
        </Modal>
      )}
    </div>
  );
}

function LandingFaqAdmin() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = () => api.get("/admin/landing").then((d) => setItems(d.faqs)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  const blank = { q_fa: "", q_en: "", a_fa: "", a_en: "", ord: 0, published: 1 };
  const save = async () => {
    try {
      if (edit.id) await api.put(`/admin/landing/faqs/${edit.id}`, edit);
      else await api.post("/admin/landing/faqs", edit);
      setEdit(null); toast(t("save")); load();
    } catch { toast("Error"); }
  };
  const remove = async (id) => { if (confirm(t("confirmDelete"))) { await api.del(`/admin/landing/faqs/${id}`); load(); } };
  if (!items) return <Spinner />;
  return (
    <div>
      <div className="muted small mb16">{fa ? "این سوال‌ها روی صفحهٔ فرود (متفاوت از مرکز راهنمای درون‌برنامه‌ای) نمایش داده می‌شوند تا اعتراض‌های احتمالی بازدیدکننده را قبل از ثبت‌نام رفع کنند." : "Shown on the landing page (separate from the in-app help center) to handle a visitor's objections before signup."}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setEdit({ ...blank })}><Icon name="edit" size={14} /> {fa ? "سوال جدید" : "New FAQ"}</button>
      </div>
      {items.length === 0 && <div className="card empty-state"><div className="ico"><Icon name="book" size={40} /></div><h3>{t("noData")}</h3></div>}
      <div className="grid grid-2">
        {items.map((f) => (
          <div key={f.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 800 }}>{(fa ? f.q_fa : f.q_en) || f.q_fa}</div>
              {!f.published && <span className="tag">{fa ? "پیش‌نویس" : "Draft"}</span>}
            </div>
            <div className="small muted mt8" style={{ maxHeight: 50, overflow: "hidden" }}>{(fa ? f.a_fa : f.a_en) || f.a_fa}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...f })}><Icon name="edit" size={13} /> {t("edit")}</button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(f.id)}><Icon name="trash" size={13} /> {t("delete")}</button>
            </div>
          </div>
        ))}
      </div>
      {edit && (
        <Modal title={edit.id ? t("edit") : (fa ? "سوال جدید" : "New FAQ")} onClose={() => setEdit(null)} onSave={save}>
          <div className="field"><label>{fa ? "سوال (فا)" : "Question (fa)"}</label><input value={edit.q_fa} onChange={(e) => setEdit({ ...edit, q_fa: e.target.value })} /></div>
          <div className="field"><label>Question (en)</label><input value={edit.q_en} onChange={(e) => setEdit({ ...edit, q_en: e.target.value })} /></div>
          <div className="field"><label>{fa ? "پاسخ (فا)" : "Answer (fa)"}</label><textarea style={{ minHeight: 90 }} value={edit.a_fa} onChange={(e) => setEdit({ ...edit, a_fa: e.target.value })} /></div>
          <div className="field"><label>Answer (en)</label><textarea style={{ minHeight: 90 }} value={edit.a_en} onChange={(e) => setEdit({ ...edit, a_en: e.target.value })} /></div>
          <div className="field"><label>{fa ? "ترتیب" : "Order"}</label><input type="number" value={edit.ord} onChange={(e) => setEdit({ ...edit, ord: Number(e.target.value) || 0 })} /></div>
          <label className="toggle-row" style={{ marginTop: 8 }}>
            <span><Icon name="check" size={15} /> {fa ? "منتشر شود" : "Published"}</span>
            <input type="checkbox" checked={!!edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked ? 1 : 0 })} />
          </label>
        </Modal>
      )}
    </div>
  );
}

function StatsFloorAdmin() {
  const { lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [data, setData] = useState(null);
  const [floor, setFloor] = useState(null);
  const load = () => api.get("/admin/landing").then((d) => { setData(d); setFloor({ ...(d.floor || {}) }); }).catch(() => setData({ stats: null }));
  useEffect(() => { load(); }, []);
  const save = async () => {
    try { const d = await api.put("/admin/landing/floor", { floor }); setData((p) => ({ ...p, stats: d.stats })); toast(fa ? "ذخیره شد" : "Saved"); }
    catch { toast("Error"); }
  };
  if (!data || !floor) return <Spinner />;
  const raw = data.stats?.raw || {};
  const fields = [
    ["learners", fa ? "کل کاربران سایت" : "Total site users", raw.users ?? raw.learners],
    ["questions", fa ? "سوال و فلش‌کارت" : "Questions & cards", raw.questions],
    ["topics", fa ? "درس/موضوع" : "Topics", raw.topics],
    ["xp", fa ? "مجموع امتیاز (XP)" : "Total XP", raw.xp],
    ["accuracy", fa ? "درصد پاسخ درست (٪)" : "Accuracy (%)", raw.accuracy],
  ];
  return (
    <div>
      <div className="muted small mb16">
        {fa
          ? "آمار صفحهٔ فرود همیشه عددِ واقعیِ سایت را نشان می‌دهد (هرگز عددِ ساختگی نشان داده نمی‌شود). عددی که این‌جا می‌گذاری «آستانهٔ نمایش» است: تا وقتی عددِ واقعی به آن نرسیده، آن آمار روی صفحهٔ فرود کاملاً پنهان می‌شود؛ به‌محضِ اینکه عددِ واقعی به آستانه رسید، خودِ عددِ واقعی نمایش داده می‌شود. برای همیشه‌پنهان‌ماندن یک عددِ خیلی بزرگ بگذار؛ برای همیشه‌نمایش، صفر بگذار."
          : "Landing stats always show the REAL site number (never a fake one). The value here is a \"visibility threshold\": the stat stays hidden until the real number reaches it, then the real number is shown. Set a very large number to keep a stat hidden, or 0 to always show it."}
      </div>
      <div className="card mb16">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{fa ? "آنچه اکنون روی صفحهٔ فرود نشان داده می‌شود:" : "Currently shown on the landing page:"}</div>
        <div className="grid grid-2">
          <div className="tag">{fa ? "کل کاربران" : "Total users"}: <b>{data.stats?.learners ?? (fa ? "پنهان" : "hidden")}</b></div>
          <div className="tag">{fa ? "سوال‌ها" : "Questions"}: <b>{data.stats?.questions ?? (fa ? "پنهان" : "hidden")}</b></div>
          <div className="tag">{fa ? "موضوعات" : "Topics"}: <b>{data.stats?.topics ?? (fa ? "پنهان" : "hidden")}</b></div>
          <div className="tag">XP: <b>{data.stats?.xp ?? (fa ? "پنهان" : "hidden")}</b></div>
        </div>
      </div>
      <div className="grid grid-2">
        {fields.map(([k, label, real]) => (
          <div className="field" key={k}>
            <label>{label} <span className="muted small">({fa ? "واقعی الان" : "real now"}: {real ?? 0})</span></label>
            <input type="number" min="0" value={floor[k] ?? 0} onChange={(e) => setFloor({ ...floor, [k]: Math.max(0, Number(e.target.value) || 0) })} />
          </div>
        ))}
      </div>
      <button className="btn btn-primary mt16" onClick={save}><Icon name="check" size={15} /> {fa ? "ذخیرهٔ آستانهٔ نمایش" : "Save visibility threshold"}</button>
    </div>
  );
}

/* ---- Product-health dashboard: engagement (DAU/WAU/MAU + stickiness), the
   activation funnel, day-7 retention, and open support tickets as a bug signal.
   Read-only aggregates that help the admin see how healthy the product is. */
/* ---- Growth dashboard: referral + social-share analytics. Reward amounts are
   tuned in the gamification config (referral / social groups); this view shows
   the results: referrals, viral coefficient, top referrers, and share channels. */
/* ---- Smart reminders: preview reach + send now. Reward/timing rules are tuned
   in the gamification config (reminders group); this shows who currently
   qualifies and lets the admin fire a run. */
function RemindersAdmin() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [pv, setPv] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const load = () => api.get("/admin/reminders/preview").then(setPv).catch(() => setPv(false));
  useEffect(() => { load(); }, []);
  const run = async () => {
    setBusy(true); setResult(null);
    try { const r = await api.post("/admin/reminders/run", {}); setResult(r); toast(fa ? "ارسال شد" : "Sent"); load(); }
    catch { toast("Error"); } finally { setBusy(false); }
  };
  if (pv === false) return <div className="page"><div className="card empty-state"><h3>{t("noData")}</h3></div></div>;
  if (!pv) return <Spinner />;
  const KPI = ({ n, l, c }) => (
    <div className="card" style={{ textAlign: "center" }}>
      <div style={{ fontSize: "1.6rem", fontWeight: 900, color: c || "var(--primary)" }}>{n}</div>
      <div className="small">{l}</div>
    </div>
  );
  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="clock" size={18} /> {fa ? "یادآورهای هوشمند" : "Smart reminders"}</h4></div>
      <div className="muted small mb16">
        {fa
          ? "یادآورها بر اساس رفتار کاربر ساخته می‌شوند (نه ساعت ثابت): «حفظ استریک» وقتی استریک در خطر است، «هدف روزانه» برای کسانی که هنوز هدف امروز را کامل نکرده‌اند، و «بازگشت» برای کاربران غایب چند روز اخیر. زمان‌بندی بر اساس پنجرهٔ عادت هر کاربر است و سقف روزانه رعایت می‌شود. تنظیمات (سقف، بازهٔ بازگشت و...) در «گیمیفیکیشن» است و روشن/خاموش‌کردن در «کلیدهای ویژگی»."
          : "Reminders are behavior-based (not a fixed clock): a streak-save when a streak is at risk, a daily-goal nudge for those who haven't hit today's goal, and win-back for recently-lapsed users. Timing respects each learner's habit window and a daily cap. Tune it in Gamification; toggle it in Feature Flags."}
      </div>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{fa ? "همین حالا واجد شرایط:" : "Currently eligible:"}</div>
      <div className="grid grid-4 mb16">
        <KPI n={pv.streak} l={fa ? "🔥 حفظ استریک" : "🔥 Streak save"} c="#e0533d" />
        <KPI n={pv.goal} l={fa ? "🎯 هدف روزانه" : "🎯 Daily goal"} />
        <KPI n={pv.winback} l={fa ? "👋 بازگشت" : "👋 Win-back"} c="#8b5cf6" />
        <KPI n={pv.eligible} l={fa ? "مجموع قابل‌ارسال" : "Total to send"} c="#12805a" />
      </div>
      <div className="card">
        <div className="kv mb8">
          <span className="tag">{fa ? "کل کاربران" : "Total learners"}: <b>{pv.total}</b></span>
          <span className="tag">{fa ? "به سقف روزانه رسیده" : "Hit daily cap"}: <b>{pv.capped}</b></span>
          <span className="tag">{fa ? "ساعت فعلی (تهران)" : "Now (Tehran)"}: <b>{pv.now?.hour}:00</b></span>
        </div>
        <button className="btn btn-primary" onClick={run} disabled={busy || pv.eligible === 0}>
          {busy ? (fa ? "در حال ارسال…" : "Sending…") : <><Icon name="send" size={15} /> {fa ? `ارسال یادآور به ${pv.eligible} کاربر` : `Send to ${pv.eligible} learners`}</>}
        </button>
        {pv.eligible === 0 && <div className="small muted mt8">{fa ? "الان کسی واجد شرایط نیست (یا همه امروز یادآور گرفته‌اند)." : "No one is eligible right now."}</div>}
        {result && (
          <div className="note-ok" style={{ marginTop: 12, borderRadius: 8, padding: "8px 12px", background: "#e7f7ef", color: "#12805a" }}>
            {fa ? `✅ ${result.sent} یادآور ارسال شد` : `✅ Sent ${result.sent} reminders`}
            {" — "}🔥 {result.byKind.streak} · 🎯 {result.byKind.goal} · 👋 {result.byKind.winback}
          </div>
        )}
      </div>
      <div className="small muted mt16">
        {fa ? "توجه: این کار هزینهٔ هوش مصنوعی ندارد؛ پیام‌ها از یک مجموعهٔ آماده و منطق قطعی انتخاب می‌شوند." : "Note: AI-free — messages are chosen from a fixed pool with deterministic logic."}
      </div>
    </div>
  );
}

/* ---- Virtual Patient (competitive side) admin ----
   Turn the feature on/off for learners, restrict to premium, and control its
   path / daily-challenge integration + daily reward. The engine is shared with
   the university exam flow, so no case content is duplicated. */
/* ---- Virtual patient admin (competitive) — container with sub-tabs ---- */
function VpatientAdmin() {
  const { t, lang } = useApp();
  const fa = lang !== "en";
  const [sub, setSub] = useState("settings"); // settings | ai | prompts
  return (
    <div>
      <div className="subtabs mb16" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={`btn btn-sm ${sub === "settings" ? "btn-primary" : "btn-ghost"}`} onClick={() => setSub("settings")}>
          <Icon name="settings" size={15} /> {fa ? "تنظیمات" : "Settings"}
        </button>
        <button className={`btn btn-sm ${sub === "ai" ? "btn-primary" : "btn-ghost"}`} onClick={() => setSub("ai")}>
          <Icon name="ai" size={15} /> {fa ? "API هوش مصنوعی" : "AI / API"}
        </button>
        <button className={`btn btn-sm ${sub === "prompts" ? "btn-primary" : "btn-ghost"}`} onClick={() => setSub("prompts")}>
          <Icon name="brain" size={15} /> {fa ? "پرامپت‌ها" : "Prompts"}
        </button>
        <button className={`btn btn-sm ${sub === "library" ? "btn-primary" : "btn-ghost"}`} onClick={() => setSub("library")}>
          <Icon name="download" size={15} /> {fa ? "ایمپورت از دانشگاهی" : "Import from university"}
        </button>
      </div>
      {sub === "settings" && <VpatientSettings />}
      {sub === "ai" && <VpatientAiConfig />}
      {sub === "prompts" && <VpatientPrompts />}
      {sub === "library" && <VpatientLibrary />}
    </div>
  );
}

/* ---- Import cards & virtual patients from the university library ---- */
function VpatientLibrary() {
  const { t, lang } = useApp();
  const fa = lang !== "en";
  const toast = useToast();
  const [lib, setLib] = useState(null);
  const [selCases, setSelCases] = useState(new Set());
  const [selCards, setSelCards] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("cases");

  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    api.get(`/admin/vpatient/library?lang=${lang}`).then(setLib).catch((e) => { setLoadErr(String(e.message || e)); setLib({ __err: true }); });
  };
  useEffect(() => { load(); }, [lang]);
  if (lib?.__err || loadErr) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{loadErr || (fa ? "بارگذاری کتابخانه شکست خورد" : "Could not load the library")}</h3><button className="btn btn-ghost mt16" onClick={() => { setLib(null); load(); }}>{fa ? "تلاش دوباره" : "Retry"}</button></div>;
  if (!lib) return <div className="card"><div className="skeleton sk-card" /></div>;

  const toggle = (set, setter, id) => { const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setter(n); };
  const importCases = async () => {
    if (!selCases.size) return; setBusy(true);
    try { const r = await api.post("/admin/vpatient/import-cases", { ids: [...selCases] }); toast(`${fa ? "ایمپورت شد:" : "Imported:"} ${r.imported}`); setSelCases(new Set()); load(); }
    catch (e) { toast(String(e.message)); } finally { setBusy(false); }
  };
  const importCards = async () => {
    if (!selCards.size) return; setBusy(true);
    try { const r = await api.post("/admin/vpatient/import-cards", { ids: [...selCards] }); toast(`${fa ? "ایمپورت شد:" : "Imported:"} ${r.imported}`); setSelCards(new Set()); load(); }
    catch (e) { toast(String(e.message)); } finally { setBusy(false); }
  };
  const token = getToken?.() || safeLocal.getItem("medlab_token");

  return (
    <div>
      <div className="card mb16">
        <div className="section-title"><h4>📤 {fa ? "ایمپورت از کتابخانهٔ دانشگاهی" : "Import from university library"}</h4></div>
        <p className="small muted" style={{ marginTop: 0 }}>
          {fa ? "کیس‌ها و کارت‌های بخش دانشگاهی را انتخاب کن تا یک نسخهٔ مستقلِ رقابتی از آن‌ها ساخته شود (اصل دانشگاهی دست‌نخورده می‌ماند). خروجی/ورودی CSV هم در دسترس است."
              : "Select university cases & cards to clone into an independent competitive copy (the university original is untouched). CSV export/import is also available."}
        </p>
        <div className="subtabs mb16" style={{ display: "flex", gap: 8 }}>
          <button className={`btn btn-sm ${tab === "cases" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("cases")}>🩺 {fa ? "بیماران مجازی" : "Virtual patients"} ({lib.cases.length})</button>
          <button className={`btn btn-sm ${tab === "cards" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("cards")}>🃏 {fa ? "فلش‌کارت‌ها" : "Flashcards"} ({lib.cards.length})</button>
        </div>

        {tab === "cases" ? (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={importCases} disabled={busy || !selCases.size}>
                {fa ? `ایمپورت ${selCases.size} بیمار` : `Import ${selCases.size} cases`}
              </button>
              <a className="btn btn-ghost btn-sm" href={`/api/content/cases-export.csv`} onClick={(e) => { e.preventDefault(); downloadWithAuth("/api/content/cases-export.csv", "cases.csv", token); }}>
                <Icon name="download" size={14} /> {fa ? "خروجی CSV" : "Export CSV"}
              </a>
            </div>
            <div style={{ maxHeight: 380, overflow: "auto" }}>
              <table className="cs-table" style={{ width: "100%" }}>
                <thead><tr><th></th><th>{fa ? "بیمار" : "Case"}</th><th>{fa ? "تخصص" : "Specialty"}</th><th>{fa ? "دشواری" : "Difficulty"}</th><th></th></tr></thead>
                <tbody>
                  {lib.cases.map((c) => (
                    <tr key={c.id}>
                      <td><input type="checkbox" checked={selCases.has(c.id)} onChange={() => toggle(selCases, setSelCases, c.id)} /></td>
                      <td>{c.title}</td><td className="muted">{c.specialty}</td>
                      <td><Pill kind={c.difficulty}>{t(c.difficulty)}</Pill></td>
                      <td>{c.competitive && <span className="tag" style={{ background: "rgba(34,160,107,.14)", color: "#178053" }}>{fa ? "رقابتی" : "competitive"}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={importCards} disabled={busy || !selCards.size}>
                {fa ? `ایمپورت ${selCards.size} کارت` : `Import ${selCards.size} cards`}
              </button>
              <a className="btn btn-ghost btn-sm" href={`/api/content/flashcards-export.csv`} onClick={(e) => { e.preventDefault(); downloadWithAuth("/api/content/flashcards-export.csv", "flashcards.csv", token); }}>
                <Icon name="download" size={14} /> {fa ? "خروجی CSV" : "Export CSV"}
              </a>
            </div>
            <div style={{ maxHeight: 380, overflow: "auto" }}>
              <table className="cs-table" style={{ width: "100%" }}>
                <thead><tr><th></th><th>{fa ? "سؤال" : "Question"}</th><th>{fa ? "موضوع" : "Topic"}</th><th>{fa ? "دشواری" : "Difficulty"}</th></tr></thead>
                <tbody>
                  {lib.cards.map((c) => (
                    <tr key={c.id}>
                      <td><input type="checkbox" checked={selCards.has(c.id)} onChange={() => toggle(selCards, setSelCards, c.id)} /></td>
                      <td>{c.q}</td><td className="muted">{c.topic}</td>
                      <td><Pill kind={c.difficulty}>{t(c.difficulty)}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* Download a protected CSV endpoint with the auth header (anchor can't send it). */
function downloadWithAuth(url, filename, token) {
  fetch(url, { credentials: "same-origin", headers: { Authorization: `Bearer ${token}` } })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.blob();
    })
    .then((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }).catch((e) => { window.alert(e.message || "download failed"); });
}

function VpatientSettings() {
  const { t, lang } = useApp();
  const toast = useToast();
  const fa = lang !== "en";
  const [cfg, setCfg] = useState(null);
  const [flagOn, setFlagOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cases, setCases] = useState(null);   // per-case XP caps
  const [loadErr, setLoadErr] = useState("");
  const [casesErr, setCasesErr] = useState("");

  const loadVp = () => {
    setLoadErr("");
    setCasesErr("");
    api.get("/admin/vpatient").then((d) => { setCfg(d.config); setFlagOn(d.flagOn); }).catch((e) => { setLoadErr(String(e.message || e)); setCfg({ __err: true }); });
    api.get(`/admin/vpatient/cases?lang=${lang}`).then((d) => setCases(Array.isArray(d.cases) ? d.cases : [])).catch((e) => { setCasesErr(String(e.message || e)); setCases({ __err: true }); });
  };
  useEffect(() => { loadVp(); }, [lang]);
  if (cfg?.__err || loadErr) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{loadErr || (fa ? "بارگذاری تنظیمات بیمار مجازی شکست خورد" : "Could not load virtual-patient settings")}</h3><button className="btn btn-ghost mt16" onClick={() => { setCfg(null); loadVp(); }}>{fa ? "تلاش دوباره" : "Retry"}</button></div>;
  if (!cfg) return <div className="card"><div className="skeleton sk-card" /></div>;

  const save = async () => {
    setBusy(true);
    try { const d = await api.put("/admin/vpatient", { config: cfg }); setCfg(d.config); toast(t("saved")); }
    catch (e) { toast(String(e.message)); } finally { setBusy(false); }
  };

  const saveCaseXp = async (id, value) => {
    const xp_max = value === "" ? null : Math.max(0, parseInt(value, 10) || 0);
    try {
      await api.put(`/admin/vpatient/cases/${id}`, { xp_max });
      setCases((cs) => cs.map((c) => c.id === id
        ? { ...c, xp_max, effective: xp_max == null ? cfg.default_xp_max : xp_max } : c));
      toast(t("saved"));
    } catch (e) { toast(String(e.message)); }
  };

  const Row = ({ k, label, hint }) => (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontWeight: 700, marginTop: 14 }}>
      <input type="checkbox" checked={!!cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.checked })} style={{ marginTop: 3 }} />
      <span>{label}{hint && <span className="small muted" style={{ display: "block", fontWeight: 400 }}>{hint}</span>}</span>
    </label>
  );

  return (
    <div>
      <div className="section-title"><h3>🩺 {t("vpatientAdmin")}</h3></div>
      <p className="muted mb16" style={{ maxWidth: 660 }}>
        {fa ? "بیمار مجازی را برای کاربران رقابتی کنترل کن. موتور آن با آزمون‌های دانشگاهی مشترک است (کیس‌ها را از «مدیریت محتوا» بساز). بدون کلید هوش مصنوعی، بیمارِ قطعی (بدون هزینه) کار می‌کند؛ با کلید، چت زندهٔ AI فعال می‌شود."
            : "Control the virtual patient for competitive learners. It shares the engine with university exams (author cases under Content). Without an AI key the deterministic (free) patient is used; with a key, live AI chat is enabled."}
      </p>

      {!flagOn && (
        <div className="card mb16" style={{ borderInlineStart: "4px solid var(--warn)", background: "rgba(224,145,46,.1)" }}>
          {fa ? "⚠️ فلگ کلی «بیمار مجازی» در «کلیدهای ویژگی» خاموش است. حتی اگر اینجا فعال کنی، تا آن فلگ روشن نشود نمایش داده نمی‌شود."
              : "⚠️ The global 'virtual_patient' flag is OFF in Feature Flags. Even if enabled here, it won't show until that flag is on."}
        </div>
      )}

      <div className="card mb16">
        <Row k="enabled" label={fa ? "فعال‌سازی بیمار مجازی برای کاربران رقابتی" : "Enable virtual patient for competitive learners"}
          hint={fa ? "با روشن‌کردن، یک تبِ «بیمار مجازی» به کاربران اضافه می‌شود." : "Adds a 'Virtual patient' tab for learners."} />
        <Row k="premium_only" label={fa ? "فقط برای کاربران پریمیوم" : "Premium members only"}
          hint={fa ? "اگر خاموش باشد، همهٔ کاربران رقابتی دسترسی دارند." : "If off, all competitive learners get access."} />
        <hr style={{ border: "none", borderTop: "1px dashed var(--border)", margin: "16px 0" }} />
        <Row k="in_path" label={fa ? "نمایش در مسیر یادگیری" : "Show in the learning path"}
          hint={fa ? "اجازهٔ قراردادن کیس به‌عنوان گرهٔ مسیر." : "Allow surfacing a case as a path node."} />
        <Row k="in_daily" label={fa ? "بیمارِ امروز در چالش روزانه" : "Case of the day in the daily challenge"}
          hint={fa ? "یک کیسِ ثابت در روز که با پاداش جم کامل می‌شود." : "A daily rotating case rewarded with gems."} />
        <div className="field mt16" style={{ maxWidth: 220 }}>
          <label>{fa ? "پاداش جمِ بیمارِ امروز" : "Case-of-the-day gem reward"}</label>
          <input type="number" min="0" value={cfg.daily_gems}
            onChange={(e) => setCfg({ ...cfg, daily_gems: Math.max(0, parseInt(e.target.value || "0", 10)) })} />
        </div>
      </div>

      {/* ---- Ranking XP (auto-evaluator score → XP) ---- */}
      <div className="card mb16">
        <div className="section-title"><h4>🏆 {fa ? "امتیاز و رنکینگ" : "Score & ranking"}</h4></div>
        <p className="small muted" style={{ marginTop: 0 }}>
          {fa ? "ارزیابِ خودکار (هوش مصنوعیِ بیمار مجازی) به عملکرد کاربر یک درصد می‌دهد. آن درصد در «سقف XP» ضرب می‌شود و XP حاصل به رنکینگ کاربر اضافه می‌شود. سیاست «بهترین امتیاز»: تکرار یک کیس فقط اگر بهتر شوی XP بیشتری می‌دهد (قابل تقلب نیست)."
              : "The auto-evaluator (the virtual patient's AI examiner) grades performance as a percentage. That percent × the XP cap = ranking XP added to the learner. Best-score policy: replaying a case only adds XP if you improve (no farming)."}
        </p>
        <Row k="award_xp" label={fa ? "افزودن XP به رنکینگ پس از اتمام کیس" : "Award ranking XP on case completion"} />
        <div className="field mt16" style={{ maxWidth: 260 }}>
          <label>{fa ? "سقف XP پیش‌فرض (برای ۱۰۰٪)" : "Default XP cap (for 100%)"}</label>
          <input type="number" min="0" value={cfg.default_xp_max}
            onChange={(e) => setCfg({ ...cfg, default_xp_max: Math.max(0, parseInt(e.target.value || "0", 10)) })} />
          <div className="small muted mt8">{fa ? "برای کیس‌هایی که سقف اختصاصی ندارند استفاده می‌شود." : "Used for cases without their own cap."}</div>
        </div>
      </div>

      {/* ---- Per-case XP cap ---- */}
      <div className="card mb16">
        <div className="section-title"><h4>{fa ? "سقف XP هر کیس" : "Per-case XP cap"}</h4></div>
        <p className="small muted" style={{ marginTop: 0 }}>
          {fa ? "برای هر بیمار، سقف XP یک عملکرد ۱۰۰٪ را تعیین کن. خالی = استفاده از پیش‌فرض." : "Set the XP for a 100% performance per patient. Blank = use the default."}
        </p>
        {cases?.__err || casesErr ? (
          <div className="err-banner">{casesErr || (fa ? "بارگذاری سقف XP کیس‌ها شکست خورد" : "Could not load per-case XP caps")}</div>
        ) : cases == null ? <div className="skeleton sk-card" /> : cases.length === 0 ? (
          <div className="muted small">{fa ? "هنوز کیسی ساخته نشده است." : "No cases yet."}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="cs-table" style={{ width: "100%" }}>
              <thead><tr>
                <th>{fa ? "بیمار" : "Case"}</th>
                <th>{fa ? "دشواری" : "Difficulty"}</th>
                <th>{fa ? "سقف XP" : "XP cap"}</th>
                <th>{fa ? "مؤثر" : "Effective"}</th>
              </tr></thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td>{c.title}</td>
                    <td><Pill kind={c.difficulty}>{t(c.difficulty)}</Pill></td>
                    <td>
                      <input type="number" min="0" defaultValue={c.xp_max ?? ""} placeholder={String(cfg.default_xp_max)}
                        style={{ width: 90 }}
                        onBlur={(e) => { if (String(e.target.value) !== String(c.xp_max ?? "")) saveCaseXp(c.id, e.target.value); }} />
                    </td>
                    <td className="muted">{c.effective} XP</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "…" : t("save")}</button>
    </div>
  );
}

/* ---- Separate AI config for the competitive virtual patient ---- */
export function VpatientAiConfig() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  const [providers, setProviders] = useState(FALLBACK_AI_PROVIDERS);
  const [testMsg, setTestMsg] = useState("");
  const [testDetail, setTestDetail] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const loadAi = () => {
    setLoadErr("");
    api.get("/admin/vpatient/ai").then((d) => setCfg(d.config)).catch((e) => { setLoadErr(String(e.message || e)); setCfg({ __err: true }); });
    api.get("/exam/ai-providers").then((d) => setProviders(normalizeAiProviders(d))).catch(() => setProviders(FALLBACK_AI_PROVIDERS));
  };
  useEffect(() => { loadAi(); }, []);
  if (cfg?.__err || loadErr) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{loadErr || (fa ? "بارگذاری تنظیمات API شکست خورد" : "Could not load AI settings")}</h3><button className="btn btn-ghost mt16" onClick={() => { setCfg(null); loadAi(); }}>{fa ? "تلاش دوباره" : "Retry"}</button></div>;
  if (!cfg) return <Spinner />;
  const listed = providers.filter((p) => p.key !== "");
  const editCfg = (update) => {
    setTestMsg(""); setTestDetail(null);
    setCfg((s) => ({ ...(typeof update === "function" ? update(s) : update), connected: false }));
  };
  const set = (k, v) => editCfg((s) => ({ ...s, [k]: v }));
  const onProvider = (key) => editCfg((s) => applyAiProvider(s, providers, key));
  const payload = () => ({ provider: cfg.provider || "", model: cfg.model || "", apiKey: cfg.apiKey || "", baseUrl: cfg.baseUrl || "", routingEnabled: !!cfg.routingEnabled, routes: cfg.routes || [] });
  const save = async (extra = {}) => {
    setSaving(true); setTestMsg(""); setTestDetail(null);
    try { const d = await api.put("/admin/vpatient/ai", { ...payload(), ...extra }); setCfg(d.config); toast(t("saved")); }
    catch (e) { toast(`${t("aiSaveFailed")}: ${e.message || e}`); }
    finally { setSaving(false); }
  };
  const clearKey = async () => {
    if (!confirm(t("aiClearKeyConfirm"))) return;
    setCfg((s) => ({ ...s, apiKey: "" }));
    await save({ clearApiKey: true, apiKey: "" });
  };
  const test = async () => {
    setTesting(true); setTestMsg(""); setTestDetail(null);
    try {
      await api.put("/admin/vpatient/ai", payload());
      const r = await api.post("/admin/vpatient/ai-test", { lang });
      setTestMsg(r.connected ? t("connectionOk") : t("usingMock"));
      setTestDetail(r);
    } catch (e) { setTestMsg(String(e.message)); }
    finally { setTesting(false); }
  };
  const selected = providers.find((p) => p.key === (cfg.provider || "")) || null;
  const modelHint = selected?.hint || (selected?.models || [])[0] || "";
  return (
    <div className="card">
      <h4 className="mb8"><Icon name="ai" size={16} /> {fa ? "API هوش مصنوعیِ بیمار مجازی رقابتی" : "Competitive virtual-patient AI / API"}</h4>
      <div className="small muted mb16">
        {fa ? "این تنظیمات مستقل از بخش دانشگاهی است. هر فیلدی را که خالی بگذاری، از تنظیمات دانشگاهی استفاده می‌شود. بدون کلید، بیمارِ قطعی (رایگان) کار می‌کند."
            : "Independent from the university section. Any field left blank falls back to the university config. Without a key, the free deterministic patient is used."}
      </div>
      <div className="micro-box small mb16" style={{ padding: "12px 14px" }}><Icon name="globe" size={15} /> {t("aiIranHint")}</div>
      <fieldset disabled={saving || testing} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <AiRoutesEditor cfg={cfg} onChange={editCfg} providers={providers} fa={fa} />
      <div hidden={!!cfg.routingEnabled}>
      <div className="grid grid-2">
        <div className="field"><label>{t("apiProvider")}</label>
          <AiProviderSelect value={cfg.provider || ""} providers={listed} onChange={onProvider} t={t}
            extraOption={<option value="">{fa ? "— (استفاده از دانشگاهی)" : "— (use university)"}</option>} /></div>
        <div className="field"><label>{t("apiModel")}</label>
          <input value={cfg.model || ""} onChange={(e) => set("model", e.target.value)} placeholder={modelHint || "gpt-4o-mini"} />
          {modelHint && <div className="small muted mt8">e.g. {modelHint}</div>}</div>
      </div>
      <div className="field"><label>{t("apiKey")}</label>
        <input dir="ltr" type="password" autoComplete="off" value={cfg.apiKey || ""} onChange={(e) => set("apiKey", e.target.value)} placeholder="sk-… / gap-…" />
        <div className="small muted mt8">{t("aiKeyKept")}</div></div>
      <div className="field"><label>{t("apiBaseUrl")}</label>
        <input value={cfg.baseUrl || ""} onChange={(e) => set("baseUrl", e.target.value)} placeholder={selected?.base || "https://…/v1"} dir="ltr" /></div>
      </div>
      </fieldset>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => save()} disabled={saving || testing}>{saving ? "…" : t("save")}</button>
        <button className="btn btn-accent" onClick={test} disabled={testing || saving}>
          {testing ? (fa ? "در حال آزمایش…" : "Testing…") : (fa ? "آزمایش با API" : "Test with API")}
        </button>
        {!cfg.routingEnabled && !!cfg.apiKey && <button className="btn btn-ghost" onClick={clearKey} disabled={saving || testing}>{t("aiClearKey")}</button>}
        {testMsg && <span className={`pill ${testDetail?.connected ? "pill-active" : "pill-medium"}`}>● {testMsg}</span>}
      </div>
      {testDetail && (
        <div className="card mt16" style={{ background: "var(--panel3, #f7fafd)", borderInlineStart: `4px solid ${testDetail.connected ? "#22a06b" : "#e0a400"}` }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>
            {testDetail.connected
              ? (fa ? "✅ اتصال برقرار است — پاسخ زندهٔ بیمار:" : "✅ Connected — live patient reply:")
              : (fa ? "⚠️ از موتور آفلاین (mock) استفاده می‌شود:" : "⚠️ Using the offline (mock) engine:")}
          </div>
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", lineHeight: 1.8 }}>
            <span className="small muted">🧑‍⚕️ {fa ? "پزشک: سلام، چه مشکلی دارید؟" : "Doctor: Hello, what brings you in?"}</span><br />
            <span>🤒 {testDetail.sample || "—"}</span>
          </div>
          {!testDetail.connected && testDetail.message && (
            <div className="small mt8" style={{ color: "#dc2626", fontWeight: 700, lineHeight: 1.6 }}>
              {fa ? "علتِ عدم اتصال: " : "Connection error: "}<span dir="ltr">{testDetail.message}</span>
              <div className="small muted mt4" style={{ fontWeight: 400 }}>
                {fa
                  ? "راهنمایی: مطمئن شوید کلید API معتبر و دارای اعتبار است. برای گپ‌جی‌پی‌تی از مدل gpt-4o-mini یا gemini و برای گوگل از gemini-1.5-flash استفاده کنید."
                  : "Tip: Ensure API key is valid with sufficient balance. For GapGPT use gpt-4o-mini or gemini, for Google use gemini-1.5-flash."}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Separate prompts for the competitive virtual patient ---- */
function VpatientPrompts() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [p, setP] = useState(null);
  const toast = useToast();
  const [loadErr, setLoadErr] = useState("");
  const loadP = () => {
    setLoadErr("");
    api.get("/admin/vpatient/prompts").then((d) => setP(d.prompts)).catch((e) => { setLoadErr(String(e.message || e)); setP({ __err: true }); });
  };
  useEffect(() => { loadP(); }, []);
  if (p?.__err || loadErr) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{loadErr || (fa ? "بارگذاری پرامپت‌ها شکست خورد" : "Could not load prompts")}</h3><button className="btn btn-ghost mt16" onClick={() => { setP(null); loadP(); }}>{fa ? "تلاش دوباره" : "Retry"}</button></div>;
  if (!p) return <Spinner />;
  const set = (k, v) => setP((s) => ({ ...s, [k]: v }));
  const save = async () => { const d = await api.put("/admin/vpatient/prompts", { prompts: p }); setP(d.prompts); toast(t("saved")); };
  const Field = ({ k, label }) => (
    <div className="field"><label>{label}</label>
      <textarea style={{ minHeight: 70 }} value={p[k] || ""} onChange={(e) => set(k, e.target.value)}
        placeholder={fa ? "خالی = استفاده از پرامپت دانشگاهی" : "blank = use university prompt"} /></div>
  );
  return (
    <div className="card">
      <h4 className="mb8"><Icon name="brain" size={16} /> {fa ? "پرامپت‌های بیمار مجازی رقابتی" : "Competitive virtual-patient prompts"}</h4>
      <div className="micro-box small mb16" style={{ padding: "12px 14px" }}>
        {fa ? "مستقل از بخش دانشگاهی. هر پرامپتی که خالی بماند، از نسخهٔ دانشگاهی استفاده می‌شود." : "Independent from the university section. Any blank prompt falls back to the university version."}
      </div>
      <div className="small muted mb8"><Icon name="chat" size={16} /> {fa ? "نقش بیمار" : "Patient role"}</div>
      <Field k="patient_fa" label={`${t("promptPatient")} (FA)`} />
      <Field k="patient_en" label={`${t("promptPatient")} (EN)`} />
      <Field k="patient_rules_fa" label={`${t("promptPatientRules")} (FA)`} />
      <Field k="patient_rules_en" label={`${t("promptPatientRules")} (EN)`} />
      <div className="small muted mb8 mt8"><Icon name="flask" size={16} /> {fa ? "گزارش آزمایش/تصویربرداری" : "Lab / imaging reporter"}</div>
      <Field k="labresult_rules_fa" label={`${t("promptLabRules")} (FA)`} />
      <Field k="labresult_rules_en" label={`${t("promptLabRules")} (EN)`} />
      <Field k="lab_normal_fa" label={`${t("promptLabNormal")} (FA)`} />
      <Field k="lab_normal_en" label={`${t("promptLabNormal")} (EN)`} />
      <div className="small muted mb8 mt8"><Icon name="check" size={16} /> {fa ? "ارزیاب و ریزآموزش" : "Evaluator & microlearning"}</div>
      <Field k="evaluator_fa" label={`${fa ? "ارزیاب" : "Evaluator"} (FA)`} />
      <Field k="evaluator_en" label={`${fa ? "ارزیاب" : "Evaluator"} (EN)`} />
      <Field k="micro_fa" label={`${fa ? "ریزآموزش" : "Microlearning"} (FA)`} />
      <Field k="micro_en" label={`${fa ? "ریزآموزش" : "Microlearning"} (EN)`} />
      <button className="btn btn-primary mt8" onClick={save}>{t("save")}</button>
    </div>
  );
}

/* ---- TWA / Android app (Cafe Bazaar & Google Play) ----
   Admin enters the app package name + signing-cert SHA-256 fingerprint(s); the
   server then publishes /.well-known/assetlinks.json so the installed app runs
   full-screen (no browser bar). Shows a live preview of the generated file. */
function TwaAdmin() {
  const { t, lang } = useApp();
  const toast = useToast();
  const fa = lang !== "en";
  const [cfg, setCfg] = useState(null);
  const [assetlinks, setAssetlinks] = useState([]);
  const [fpText, setFpText] = useState("");
  const [busy, setBusy] = useState(false);
  const appUrl = (typeof window !== "undefined" ? window.location.origin : "https://medschool.ir");

  useEffect(() => {
    api.get("/admin/twa").then((d) => {
      setCfg(d.config);
      setAssetlinks(d.assetlinks || []);
      setFpText((d.config.sha256_fingerprints || []).join("\n"));
    }).catch(() => setCfg(null));
  }, []);
  if (!cfg) return <div className="card"><div className="skeleton sk-card" /></div>;

  const save = async () => {
    setBusy(true);
    try {
      const body = { config: { ...cfg, sha256_fingerprints: fpText } };
      const d = await api.put("/admin/twa", body);
      setCfg(d.config); setAssetlinks(d.assetlinks || []);
      setFpText((d.config.sha256_fingerprints || []).join("\n"));
      toast(t("saved"));
    } catch (e) { toast(String(e.message)); } finally { setBusy(false); }
  };

  const assetlinksJson = JSON.stringify(assetlinks, null, 2);
  const copyJson = () => { navigator.clipboard?.writeText(assetlinksJson).then(() => toast(fa ? "کپی شد" : "Copied")); };
  const fpCount = (cfg.sha256_fingerprints || []).length;

  return (
    <div>
      <div className="section-title"><h3>📱 {t("twaAdmin")}</h3></div>
      <p className="muted mb16" style={{ maxWidth: 680 }}>
        {fa
          ? "اپ اندروید شما (TWA) همین سایت را داخل یک پوستهٔ اندرویدی واقعی اجرا می‌کند و روی کافه‌بازار/گوگل‌پلی قابل انتشار است. برای اینکه اپ بدون نوار مرورگر باز شود، باید «نام پکیج» و «اثرانگشتِ گواهی امضا (SHA-256)» را اینجا وارد کنی تا فایل تأیید (assetlinks.json) منتشر شود. راهنمای کامل ساخت APK در پوشهٔ docs در فایل «راهنمای-اپ-اندروید.md» است."
          : "Your Android app (TWA) runs this site inside a real Android shell, publishable to Cafe Bazaar / Google Play. To make it open without a browser bar, enter the app package name + signing-cert SHA-256 fingerprint(s) here so the verification file (assetlinks.json) is published. See 'docs/راهنمای-اپ-اندروید.md' for the full APK build guide."}
      </p>

      <div className="card mb16">
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
          <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
          {fa ? "فعال‌سازی تأیید اپ (انتشار assetlinks.json)" : "Enable app verification (publish assetlinks.json)"}
        </label>

        <div className="field mt16">
          <label>{fa ? "نام پکیج اپ (Package name)" : "App package name"}</label>
          <input value={cfg.package_name} onChange={(e) => setCfg({ ...cfg, package_name: e.target.value })}
            placeholder="ir.medschool.twa" dir="ltr" />
          <div className="small muted mt8">{fa ? "مثال: ir.medschool.twa — همان چیزی که موقع ساخت اپ تعیین می‌کنی." : "e.g. ir.medschool.twa — the same id you set when building the app."}</div>
        </div>

        <div className="field mt16">
          <label>{fa ? "اثرانگشت‌های SHA-256 (هر خط یکی)" : "SHA-256 fingerprints (one per line)"}</label>
          <textarea rows={4} value={fpText} onChange={(e) => setFpText(e.target.value)} dir="ltr"
            placeholder={"AA:BB:CC:...:99  (95 characters)\n(Cafe Bazaar and Google Play each have their own key — add both)"} />
          <div className="small muted mt8">
            {fa ? "کافه‌بازار و گوگل‌پلی هرکدام کلید امضای خودشان را دارند — اگر در هر دو منتشر می‌کنی، هر دو اثرانگشت را اضافه کن. اثرانگشتِ نامعتبر خودکار حذف می‌شود."
                : "Cafe Bazaar and Google Play each sign with their own key — if you publish to both, add both fingerprints. Invalid ones are dropped automatically."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "…" : t("save")}</button>
        </div>
      </div>

      {/* Live preview of the published file */}
      <div className="card mb16">
        <div className="section-title"><h4>🔗 {fa ? "پیش‌نمایش فایل تأیید" : "Verification file preview"}</h4></div>
        <div className="small muted mb8">
          {fa ? "این فایل به‌صورت زنده در این آدرس منتشر می‌شود:" : "This file is served live at:"}{" "}
          <code dir="ltr">{appUrl}/.well-known/assetlinks.json</code>
        </div>
        {cfg.enabled && fpCount > 0
          ? <>
              <pre style={{ background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: 10,
                padding: 12, overflow: "auto", fontSize: ".78rem", direction: "ltr", textAlign: "left" }}>{assetlinksJson}</pre>
              <button className="btn btn-sm btn-ghost mt8" onClick={copyJson}><Icon name="download" size={14} /> {fa ? "کپی JSON" : "Copy JSON"}</button>
            </>
          : <div className="note-warn" style={{ padding: 12, borderRadius: 10, background: "rgba(224,145,46,.12)", border: "1px solid rgba(224,145,46,.3)" }}>
              {fa ? "⚠️ هنوز منتشر نشده — «فعال‌سازی» را بزن و حداقل یک اثرانگشت معتبر وارد کن." : "⚠️ Not published yet — enable it and add at least one valid fingerprint."}
            </div>}
      </div>

      <div className="card">
        <div className="section-title"><h4>📖 {fa ? "مراحل ساخت اپ (خلاصه)" : "Build steps (summary)"}</h4></div>
        <ol style={{ paddingInlineStart: 20, lineHeight: 2 }}>
          <li>{fa ? "سایت را روی دامنهٔ HTTPS خودت مستقر کن (مثلاً medschool.ir)." : "Deploy the site on your HTTPS domain (e.g. medschool.ir)."}</li>
          <li>{fa ? "با Bubblewrap اپ را بساز: " : "Build the app with Bubblewrap: "}<code dir="ltr">npx @bubblewrap/cli init --manifest {appUrl}/manifest.webmanifest</code></li>
          <li>{fa ? "APK/AAB را بساز و کلیدِ امضا را نگه دار: " : "Build APK/AAB and keep the signing key: "}<code dir="ltr">npx @bubblewrap/cli build</code></li>
          <li>{fa ? "اثرانگشت SHA-256 کلید را همین‌جا وارد و ذخیره کن." : "Enter the key's SHA-256 fingerprint here and save."}</li>
          <li>{fa ? "APK را در کافه‌بازار و AAB را در گوگل‌پلی بارگذاری کن." : "Upload the APK to Cafe Bazaar and AAB to Google Play."}</li>
        </ol>
        <div className="small muted mt8">{fa ? "جزئیات کامل و دستورها در پوشهٔ docs در فایل «راهنمای-اپ-اندروید.md» هست." : "Full details + commands are in 'docs/راهنمای-اپ-اندروید.md'."}</div>
      </div>
    </div>
  );
}

function PwaAdmin() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/pwa").then(setD).catch(() => setD(false)); }, []);
  if (d === false) return <div className="page"><div className="card empty-state"><h3>{t("noData")}</h3></div></div>;
  if (!d) return <Spinner />;
  const KPI = ({ n, l, c, sfx }) => (
    <div className="card" style={{ textAlign: "center" }}>
      <div style={{ fontSize: "1.6rem", fontWeight: 900, color: c || "var(--primary)" }}>{n}{sfx || ""}</div>
      <div className="small">{l}</div>
    </div>
  );
  const platLabel = (p) => ({ android: "🤖 اندروید", ios: "🍎 آیفون", desktop: "💻 دسکتاپ", other: "سایر" }[p] || p);
  const platLabelEn = (p) => ({ android: "🤖 Android", ios: "🍎 iOS", desktop: "💻 Desktop", other: "Other" }[p] || p);
  const maxTrend = Math.max(1, ...d.trend.map((x) => Math.max(x.shown, x.installed)));
  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="download" size={18} /> {fa ? "اپ موبایلی (نصب روی گوشی)" : "Mobile app (install)"}</h4></div>
      <div className="muted small mb16">
        {fa
          ? "سامانه به‌صورت «اپ نصب‌شدنی» (PWA) در دسترس است: کاربران می‌توانند آن را روی صفحهٔ اصلی گوشی نصب کنند، تمام‌صفحه اجرا کنند و از کارکرد آفلاین بهره ببرند. این داشبورد قیف نصب و میزان استفادهٔ واقعی از اپ نصب‌شده را نشان می‌دهد. تنظیمات ظاهری (نمایش پیشنهاد نصب، بازهٔ یادآوری، راهنمای آیفون، آفلاین) در «گیمیفیکیشن» بخش pwa است و روشن/خاموش‌کردن کلی در «کلیدهای ویژگی» با کلید pwa_install."
          : "The platform ships as an installable app (PWA): learners can add it to their home screen, run it full-screen and use it offline. This dashboard shows the install funnel and real installed-app usage. Tune the experience under Gamification → pwa; toggle it in Feature Flags via pwa_install."}
      </div>

      <div style={{ fontWeight: 800, marginBottom: 8 }}>{fa ? "قیف نصب:" : "Install funnel:"}</div>
      <div className="grid grid-4 mb16">
        <KPI n={d.funnel.shown} l={fa ? "👀 پیشنهاد نمایش‌داده‌شده" : "👀 Prompt shown"} />
        <KPI n={d.funnel.accepted} l={fa ? "✅ پذیرفته‌شده" : "✅ Accepted"} c="#12805a" />
        <KPI n={d.funnel.installed} l={fa ? "📲 نصب‌شده (تأییدشده)" : "📲 Installed (confirmed)"} c="#26527a" />
        <KPI n={d.installRate} sfx="٪" l={fa ? "نرخ تبدیل نصب" : "Install conversion"} c="#8b5cf6" />
      </div>

      <div style={{ fontWeight: 800, marginBottom: 8 }}>{fa ? "استفادهٔ واقعی از اپ نصب‌شده:" : "Real installed-app usage:"}</div>
      <div className="grid grid-4 mb16">
        <KPI n={d.standaloneUsers} l={fa ? "👤 کاربران فعال اپ" : "👤 Active app users"} c="#12805a" />
        <KPI n={d.reach} sfx="٪" l={fa ? "پوشش (از کل کاربران)" : "Reach (of all learners)"} />
        <KPI n={d.standaloneLaunches} l={fa ? "🚀 اجراهای تمام‌صفحه" : "🚀 Standalone launches"} />
        <KPI n={d.launches} l={fa ? "بازدید کل" : "Total launches"} />
      </div>

      <div className="grid grid-2 mb16">
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>{fa ? "نصب بر اساس پلتفرم" : "Installs by platform"}</div>
          {d.platform.length === 0
            ? <div className="small muted">{fa ? "هنوز نصبی ثبت نشده است." : "No installs recorded yet."}</div>
            : d.platform.map((p) => (
                <div key={p.platform} className="kv mb8" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{fa ? platLabel(p.platform) : platLabelEn(p.platform)}</span>
                  <b>{p.c}</b>
                </div>
              ))}
        </div>
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>{fa ? "روند ۱۴ روز اخیر" : "Last 14 days"}</div>
          {d.trend.length === 0
            ? <div className="small muted">{fa ? "داده‌ای برای نمایش نیست." : "No data yet."}</div>
            : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 90 }}>
                {d.trend.map((x) => (
                  <div key={x.day} title={`${x.day} · ${fa ? "نمایش" : "shown"} ${x.shown} · ${fa ? "نصب" : "installed"} ${x.installed}`}
                    style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 2 }}>
                    <div style={{ height: `${(x.installed / maxTrend) * 70}px`, background: "#12805a", borderRadius: "3px 3px 0 0", minHeight: x.installed ? 3 : 0 }} />
                    <div style={{ height: `${(x.shown / maxTrend) * 70}px`, background: "#cbd5e1", borderRadius: "0 0 3px 3px", minHeight: x.shown ? 3 : 0 }} />
                  </div>
                ))}
              </div>
            )}
          <div className="small muted mt8">🟩 {fa ? "نصب" : "installed"} · ⬜ {fa ? "نمایش پیشنهاد" : "prompt shown"}</div>
        </div>
      </div>

      <div className="card">
        <div className="kv" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="tag">{fa ? "پیشنهاد نصب" : "Install prompt"}: <b>{d.config.show_prompt ? (fa ? "روشن" : "on") : (fa ? "خاموش" : "off")}</b></span>
          <span className="tag">{fa ? "کارکرد آفلاین" : "Offline"}: <b>{d.config.offline_enabled ? (fa ? "روشن" : "on") : (fa ? "خاموش" : "off")}</b></span>
          <span className="tag">{fa ? "راهنمای آیفون" : "iOS hint"}: <b>{d.config.ios_hint ? (fa ? "روشن" : "on") : (fa ? "خاموش" : "off")}</b></span>
          <span className="tag">{fa ? "بازهٔ یادآوری مجدد" : "Snooze"}: <b>{d.config.snooze_days} {fa ? "روز" : "days"}</b></span>
        </div>
      </div>

      <div className="small muted mt16">
        {fa ? "توجه: کاملاً بدون هزینهٔ هوش مصنوعی — اپ نصب‌شدنی از فناوری استاندارد مرورگر (PWA) استفاده می‌کند و نیاز به فروشگاه اپ ندارد." : "Note: fully AI-free — the installable app uses standard browser (PWA) technology and needs no app store."}
      </div>
    </div>
  );
}

function SeoAdmin() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pvRoute, setPvRoute] = useState("home");
  const [pvLang, setPvLang] = useState(fa ? "fa" : "en");
  useEffect(() => { api.get("/admin/seo").then((d) => setCfg(d.config)).catch(() => setCfg(false)); }, []);
  const loadPreview = () => api.get(`/admin/seo/preview?route=${pvRoute}&lang=${pvLang}`).then(setPreview).catch(() => setPreview(null));
  useEffect(() => { if (cfg) loadPreview(); }, [pvRoute, pvLang, cfg]);
  if (cfg === false) return <div className="page"><div className="card empty-state"><h3>{t("noData")}</h3></div></div>;
  if (!cfg) return <Spinner />;
  const set = (k, v) => setCfg({ ...cfg, [k]: v });
  const save = async () => {
    try { const d = await api.put("/admin/seo", { config: cfg }); setCfg(d.config); toast(t("save")); loadPreview(); }
    catch { toast("Error"); }
  };
  const Field = (label, k, ph, textarea) => (
    <div className="field"><label>{label}</label>
      {textarea
        ? <textarea rows={2} value={cfg[k] ?? ""} placeholder={ph || ""} onChange={(e) => set(k, e.target.value)} />
        : <input value={cfg[k] ?? ""} placeholder={ph || ""} onChange={(e) => set(k, e.target.value)} />}
    </div>
  );
  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="settings" size={18} /> {fa ? "بهینه‌سازی موتور جستجو (SEO)" : "Search engine optimization (SEO)"}</h4>
        <button className="btn btn-primary btn-sm" onClick={save}><Icon name="check" size={14} /> {t("save")}</button></div>
      <div className="muted small mb16">
        {fa
          ? "معادل بومی افزونه‌های Yoast/RankMath — کاملاً بدون هوش مصنوعی. این بخش، متا تگ‌های قابل‌خواندن برای گوگل، پیش‌نمایش زیبا در تلگرام/واتساپ (Open Graph)، دادهٔ ساختاریافته (Schema)، و فایل‌های sitemap.xml و robots.txt را می‌سازد. برای روشن/خاموش کامل از «کلیدهای ویژگی» کلید seo استفاده کنید."
          : "A native equivalent of Yoast/RankMath — fully AI-free. It generates crawlable meta tags for Google, rich social previews (Open Graph), structured data (Schema), and sitemap.xml/robots.txt. Toggle it fully via Feature Flags → seo."}
      </div>

      <label className="toggle-row"><span><Icon name="check" size={15} /> {fa ? "SEO فعال باشد" : "SEO enabled"}</span>
        <input type="checkbox" checked={cfg.enabled !== false} onChange={(e) => set("enabled", e.target.checked)} /></label>
      <label className="toggle-row"><span>🚫 {fa ? "به موتورهای جستجو بگو ایندکس نکنند (noindex — برای محیط آزمایشی)" : "Tell search engines not to index (noindex — for staging)"}</span>
        <input type="checkbox" checked={!!cfg.noindex} onChange={(e) => set("noindex", e.target.checked)} /></label>

      <div className="card mt16">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>{fa ? "تنظیمات پایه" : "Basics"}</div>
        <div className="grid grid-2">
          {Field(fa ? "نام سایت" : "Site name", "site_name")}
          {Field(fa ? "آدرس سایت (دامنه)" : "Site URL", "site_url", "https://medschool.ir")}
        </div>
        <div className="grid grid-2">
          {Field(fa ? "قالب عنوان (فارسی)" : "Title template (FA)", "title_template_fa", "%title% | MED School")}
          {Field(fa ? "قالب عنوان (انگلیسی)" : "Title template (EN)", "title_template_en", "%title% | MED School")}
        </div>
        <div className="small muted mb8">{fa ? "«%title%» با عنوان هر صفحه جایگزین می‌شود." : "\"%title%\" is replaced by each page's title."}</div>
        <div className="grid grid-2">
          {Field(fa ? "توضیح پیش‌فرض (فارسی)" : "Default description (FA)", "description_fa", "", true)}
          {Field(fa ? "توضیح پیش‌فرض (انگلیسی)" : "Default description (EN)", "description_en", "", true)}
        </div>
        <div className="grid grid-2">
          {Field(fa ? "کلمات کلیدی (فارسی)" : "Keywords (FA)", "keywords_fa")}
          {Field(fa ? "کلمات کلیدی (انگلیسی)" : "Keywords (EN)", "keywords_en")}
        </div>
        <div className="grid grid-2">
          {Field(fa ? "تصویر اشتراک اجتماعی (Open Graph)" : "Social share image (Open Graph)", "og_image", "/icon-512.png")}
          {Field(fa ? "شناسهٔ توییتر/ایکس" : "Twitter/X handle", "twitter_handle", "@medschool")}
        </div>
      </div>

      <div className="card mt16">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>{fa ? "پیش‌نمایش زنده (آنچه گوگل و تلگرام می‌بینند)" : "Live preview (what Google & Telegram see)"}</div>
        <div className="kv mb8" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={pvRoute} onChange={(e) => setPvRoute(e.target.value)}>
            {Object.keys(cfg.routes || { home: 1 }).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={pvLang} onChange={(e) => setPvLang(e.target.value)}>
            <option value="fa">فارسی</option><option value="en">English</option>
          </select>
        </div>
        {preview && (
          <>
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ color: "#1a0dab", fontSize: "1.05rem", fontWeight: 700 }}>{preview.meta.title}</div>
              <div style={{ color: "#006621", fontSize: ".82rem" }}>{preview.meta.canonical}</div>
              <div style={{ color: "#545454", fontSize: ".88rem", marginTop: 3 }}>{preview.meta.description}</div>
              <div className="small muted mt8">robots: <b>{preview.meta.noindex ? "noindex, nofollow" : "index, follow"}</b></div>
            </div>
            <details>
              <summary className="small" style={{ cursor: "pointer" }}>{fa ? "کد متا و دادهٔ ساختاریافته (JSON-LD)" : "Raw meta & structured data (JSON-LD)"}</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: ".72rem", background: "var(--bg2,#f6f8fb)", padding: 10, borderRadius: 8, overflowX: "auto", direction: "ltr" }}>{preview.html}</pre>
            </details>
          </>
        )}
      </div>

      <div className="card mt16">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{fa ? "فایل‌های ساخته‌شدهٔ خودکار" : "Auto-generated files"}</div>
        <div className="kv" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="tag" href="/sitemap.xml" target="_blank" rel="noreferrer">🗺️ sitemap.xml</a>
          <a className="tag" href="/robots.txt" target="_blank" rel="noreferrer">🤖 robots.txt</a>
        </div>
        <div className="small muted mt8">{fa ? "این آدرس‌ها را می‌توانید مستقیماً در Google Search Console ثبت کنید." : "Submit these URLs directly to Google Search Console."}</div>
      </div>
    </div>
  );
}

function GoogleClientIdField({ initial }) {
  const { lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [v, setV] = useState(initial || "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.put("/admin/security/google", { client_id: v.trim() });
      toast(fa ? "شناسه کلاینت گوگل ذخیره شد" : "Google Client ID saved");
    } catch (e) { toast(e.message || "error"); }
    finally { setBusy(false); }
  };
  return (
    <div className="card mt16">
      <div style={{ fontWeight: 800, marginBottom: 10 }}>🔑 {fa ? "ورود با گوگل (GIS)" : "Google Sign-In (GIS)"}</div>
      <div className="small muted mb8">{fa
        ? "در Google Cloud یک OAuth Client از نوع Web بسازید. Authorized JavaScript origins باید دقیقاً مبدأ سایت باشد (مثلاً https://medschool.ir بدون مسیر). شناسه را اینجا یا در GOOGLE_CLIENT_ID فایل env بگذارید."
        : "Create a Web OAuth client in Google Cloud. Authorized JavaScript origins must be the exact site origin (e.g. https://medschool.ir, no path). Paste the Client ID here or in GOOGLE_CLIENT_ID."}</div>
      <div className="field"><label>GOOGLE_CLIENT_ID</label>
        <input dir="ltr" value={v} onChange={(e) => setV(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" /></div>
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{fa ? "ذخیره" : "Save"}</button>
    </div>
  );
}

function SecurityAdmin() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [d, setD] = useState(null);
  const [rum, setRum] = useState(null);
  useEffect(() => { api.get("/admin/security").then(setD).catch(() => setD(false)); api.get("/admin/rum/summary?days=14").then(setRum).catch(() => setRum(null)); }, []);
  if (d === false) return <div className="page"><div className="card empty-state"><h3>{t("noData")}</h3></div></div>;
  if (!d) return <Spinner />;
  const Row = ({ label, on, val }) => (
    <div className="kv mb8" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span>{label}</span>
      {val != null
        ? <b>{val}</b>
        : <span className="tag" style={{ background: on ? "#e7f7ef" : "#fde8e8", color: on ? "#12805a" : "#c0392b" }}>{on ? (fa ? "فعال ✓" : "on ✓") : (fa ? "خاموش" : "off")}</span>}
    </div>
  );
  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="check" size={18} /> {fa ? "امنیت و مقاوم‌سازی" : "Security hardening"}</h4></div>
      <div className="muted small mb16">
        {fa
          ? "وضعیت مقاوم‌سازی سایت برای استقرار امن. هدرهای امنیتی (Helmet)، محدودیت نرخ درخواست (ضد حملهٔ brute-force)، رمزنگاری قوی رمز عبور و مدیریت خطای امن. اعداد محدودیت نرخ را می‌توانید در «گیمیفیکیشن» بخش security تنظیم کنید."
          : "Security-hardening status for a safe deployment: security headers (Helmet), rate limiting (brute-force protection), strong password hashing, and safe error handling. Tune rate-limit numbers in Gamification → security."}
      </div>
      <GoogleClientIdField initial={d.google_client_id || ""} />
      <div className="card mt16">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>🛡️ {fa ? "هدرهای امنیتی و محافظت" : "Headers & protection"}</div>
        <Row label={fa ? "محدودیت نرخ درخواست (rate limiting)" : "Rate limiting"} on={d.enabled} />
        <Row label={fa ? "هدرهای امنیتی Helmet" : "Helmet security headers"} on={d.helmet} />
        <Row label={fa ? "اجبار HTTPS (HSTS)" : "Force HTTPS (HSTS)"} on={d.hsts} />
        <Row label={fa ? "سیاست امنیت محتوا (CSP)" : "Content-Security-Policy (CSP)"} on={d.csp} />
        <Row label={fa ? "مخفی‌کردن اثر انگشت سرور (X-Powered-By)" : "Hide server fingerprint (X-Powered-By)"} on={d.hide_powered_by} />
      </div>
      <div className="card mt16">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>⏱️ {fa ? "محدودیت نرخ درخواست" : "Rate limits"}</div>
        <Row label={fa ? "درخواست‌های عمومی API (در هر پنجره / هر IP)" : "General API (per window / IP)"} val={`${d.rate_limit.api.max} / ${d.rate_limit.api.window_min}${fa ? " دقیقه" : "m"}`} />
        <Row label={fa ? "تلاش‌های ورود (ضد brute-force)" : "Auth attempts (brute-force)"} val={`${d.rate_limit.auth.max} / ${d.rate_limit.auth.window_min}${fa ? " دقیقه" : "m"}`} />
        <div className="small muted">{fa ? "ورودهای موفق شمرده نمی‌شوند، پس کاربران واقعی جریمه نمی‌شوند." : "Successful logins aren't counted, so real users aren't penalized."}</div>
      </div>
      <div className="card mt16">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>🔐 {fa ? "رمز عبور و محیط" : "Passwords & environment"}</div>
        <Row label={fa ? "قدرت رمزنگاری رمز عبور (bcrypt cost)" : "Password hashing strength (bcrypt cost)"} val={d.bcrypt_cost} />
        <Row label={fa ? "الگوریتم توکن (قفل‌شده)" : "Token algorithm (pinned)"} val={d.jwt_algorithm} />
        <Row label={fa ? "انقضای توکن ورود" : "Login token expiry"} val={d.jwt_expiry} />
        <Row label={fa ? "ابطال نشست (نسخه + jti)" : "Session revocation (ver + jti)"} val={d.jwt_revocation} />
        <Row label={fa ? "بررسی رمزهای افشاشده (HIBP k-anonymity)" : "Breached-password check (HIBP k-anonymity)"} on={d.hibp_k_anonymity} />
        <Row label={fa ? "محافظت SSRF (درخواست‌های خروجی)" : "SSRF guard (outbound)"} on={d.ssrf_guard} />
        <Row label={fa ? "بررسی محتوای واقعی فایل آپلودی" : "Upload content/magic-byte checks"} on={d.upload_magic_check} />
        <Row label={fa ? "CORS هم‌مبدأ به‌صورت پیش‌فرض" : "Same-origin CORS by default"} on={d.cors_default_same_origin} />
        <Row label={fa ? "گزارش CSP بدون شکستن سایت" : "CSP report-only monitoring"} on={d.csp_report_only} />
        <Row label={fa ? "عدم کش پاسخ‌های حساس API" : "No-store for sensitive API responses"} on={d.api_no_store} />
        <Row label={fa ? "محیط اجرا" : "Runtime environment"} val={d.node_env} />
        {d.node_env !== "production" && (
          <div className="note-ok" style={{ marginTop: 8, borderRadius: 8, padding: "8px 12px", background: "#fff6e5", color: "#9a6a00" }}>
            {fa ? "⚠️ برای استقرار نهایی، متغیر NODE_ENV را روی production تنظیم کنید تا جزئیات خطا به کاربر نشت نکند." : "⚠️ For production, set NODE_ENV=production so error details aren't leaked to clients."}
          </div>
        )}
      </div>
      <div className="card mt16">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>📈 {fa ? "پایش واقعی سرعت و امنیت" : "Real-user speed & security monitoring"}</div>
        {!rum ? <div className="small muted">{fa ? "هنوز داده‌ای ثبت نشده یا در حال بارگذاری است." : "No data yet or loading."}</div> : (
          <>
            <div className="small muted mb8">{fa ? `داده‌های ${rum.days} روز اخیر · ${rum.total} رکورد سرعت` : `Last ${rum.days} days · ${rum.total} performance records`}</div>
            <div className="table-wrap"><table><thead><tr><th>Metric</th><th>P75</th><th>P95</th><th>{fa ? "خوب" : "Good"}</th><th>{fa ? "ضعیف" : "Poor"}</th></tr></thead>
              <tbody>{(rum.metrics || []).map((m) => <tr key={m.metric}><td><b>{m.metric}</b></td><td>{m.p75 ?? "—"}</td><td>{m.p95 ?? "—"}</td><td>{m.good}</td><td>{m.poor}</td></tr>)}</tbody></table></div>
            <div className="small muted mt8">{fa ? "رخدادهای امنیتی:" : "Security events:"} {(rum.security || []).map((s) => `${s.kind}:${s.count}`).join(" · ") || "—"}</div>
          </>
        )}
      </div>
      <div className="small muted mt16">
        {fa ? "توجه: کاملاً بدون هزینهٔ هوش مصنوعی — مقاوم‌سازی با کتابخانه‌های استاندارد و منطق قطعی انجام شده است." : "Note: fully AI-free — hardening uses standard libraries and deterministic logic."}
      </div>
    </div>
  );
}

function BlogAdmin() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [d, setD] = useState(null);
  const [editing, setEditing] = useState(null); // post object or "new"
  const load = () => api.get("/admin/blog").then(setD).catch(() => setD(false));
  useEffect(() => { load(); }, []);
  if (editing) return <BlogEditor id={editing === "new" ? null : editing} categories={d?.categories || []} onBack={() => { setEditing(null); load(); }} />;
  if (d === false) return <div className="page"><div className="card empty-state"><h3>{t("noData")}</h3></div></div>;
  if (!d) return <Spinner />;
  const s = d.stats;
  const KPI = ({ n, l }) => (<div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--primary)" }}>{n}</div><div className="small">{l}</div></div>);
  return <BlogAdminList d={d} stats={s} fa={fa} t={t} toast={toast} load={load} setEditing={setEditing} KPI={KPI} />;
}

function BlogAdminList({ d, stats: s, fa, t, toast, load, setEditing, KPI }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(""); // "" | published | draft
  const nq = q.trim().toLowerCase();
  const posts = (d.posts || []).filter((p) => {
    if (status === "published" && !p.published) return false;
    if (status === "draft" && p.published) return false;
    if (nq && ![p.title_fa, p.title_en, p.slug, p.category, p.tags].some((x) => (x || "").toLowerCase().includes(nq))) return false;
    return true;
  });
  return (
    <div className="page">
      <div className="section-title"><h4>📝 {fa ? "وبلاگ و مقالات پزشکی" : "Medical blog"}</h4>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}><Icon name="edit" size={14} /> {fa ? "مقالهٔ جدید" : "New post"}</button></div>
      <div className="muted small mb16">
        {fa ? "مقالات آموزشی برای جذب ترافیک از گوگل. هر مقاله به‌طور خودکار در sitemap و با متا تگ و Schema مناسب منتشر می‌شود. برای روشن/خاموش کامل، پرچم «وبلاگ» را در «کلیدهای ویژگی» تنظیم کنید."
             : "Educational articles to attract Google traffic. Each post is auto-added to the sitemap with proper meta tags & schema. Toggle it via Feature Flags → blog."}
      </div>
      <div className="grid grid-4 mb16">
        <KPI n={s.total} l={fa ? "کل مقالات" : "Total posts"} />
        <KPI n={s.published} l={fa ? "منتشرشده" : "Published"} />
        <KPI n={s.drafts} l={fa ? "پیش‌نویس" : "Drafts"} />
        <KPI n={s.views} l={fa ? "کل بازدید" : "Total views"} />
      </div>
      <div className="inline-form mb16" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div className="dt-search" style={{ flex: 1, minWidth: 180 }}>
          <Icon name="search" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={fa ? "جستجوی مقاله…" : "Search posts…"} />
          {q && <button className="dt-clear" onClick={() => setQ("")}><Icon name="close" size={13} /></button>}
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{fa ? "همه" : "All"}</option>
          <option value="published">{fa ? "منتشرشده" : "Published"}</option>
          <option value="draft">{fa ? "پیش‌نویس" : "Draft"}</option>
        </select>
      </div>
      <div className="card">
        {posts.length === 0 && <div className="small muted">{fa ? "مقاله‌ای یافت نشد." : "No posts found."}</div>}
        {posts.map((p) => (
          <div key={p.id} className="kv" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{fa ? p.title_fa : (p.title_en || p.title_fa)}
                {p.featured ? " ⭐" : ""} {p.reviewed ? " ✓" : ""}</div>
              <div className="small muted">/{p.slug} · {p.category} · 👁 {p.views}
                {" · "}<span style={{ color: p.published ? "#12805a" : (p.scheduled_at ? "#b8860b" : "#c0392b") }}>
                  {p.published ? (fa ? "منتشرشده" : "published") : (p.scheduled_at ? (fa ? "زمان‌بندی‌شده ⏱️" : "scheduled ⏱️") : (fa ? "پیش‌نویس" : "draft"))}
                </span></div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-sm" onClick={() => setEditing(p.id)}>{t("edit")}</button>
              <button className="btn btn-sm btn-danger" onClick={async () => { if (confirm(fa ? "حذف شود؟" : "Delete?")) { await api.del(`/admin/blog/${p.id}`); toast(t("delete")); load(); } }}>{t("delete")}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Markdown toolbar: wraps/inserts markdown around the current textarea selection.
   Works on whichever body field (FA/EN) is being edited. */
function MdToolbar({ fa, onApply }) {
  const btns = [
    { l: fa ? "درشت" : "B", t: "b", title: fa ? "درشت (bold)" : "Bold", w: "**", w2: "**" },
    { l: fa ? "کج" : "I", t: "i", title: fa ? "کج (italic)" : "Italic", w: "*", w2: "*" },
    { l: "H2", t: "h2", title: fa ? "سرتیتر" : "Heading 2", pre: "## " },
    { l: "H3", t: "h3", title: fa ? "زیرتیتر" : "Heading 3", pre: "### " },
    { l: "•", t: "ul", title: fa ? "فهرست" : "Bullet list", pre: "- " },
    { l: "1.", t: "ol", title: fa ? "فهرست عددی" : "Numbered list", pre: "1. " },
    { l: "❝", t: "q", title: fa ? "نقل‌قول" : "Quote", pre: "> " },
    { l: fa ? "پیوند" : "Link", t: "a", title: fa ? "پیوند" : "Link", w: "[", w2: "](https://)" },
    { l: fa ? "تصویر" : "Img", t: "img", title: fa ? "تصویر" : "Image", ins: "![توضیح تصویر](URL)" },
    { l: fa ? "کد" : "Code", t: "code", title: fa ? "قطعه کد" : "Code block", ins: "\n```\n\n```\n" },
    { l: fa ? "جدول" : "Table", t: "tbl", title: fa ? "جدول" : "Table", ins: "\n| ستون ۱ | ستون ۲ |\n|---|---|\n| مقدار | مقدار |\n" },
    { l: "―", t: "hr", title: fa ? "خط جداکننده" : "Divider", ins: "\n---\n" },
  ];
  return (
    <div className="md-toolbar" style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
      {btns.map((b) => (
        <button key={b.t} type="button" className="btn btn-ghost btn-sm" title={b.title}
          style={{ padding: "4px 9px", fontWeight: 700 }}
          onMouseDown={(e) => { e.preventDefault(); onApply(b); }}>{b.l}</button>
      ))}
    </div>
  );
}

function BlogEditor({ id, categories, onBack }) {
  const { lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [f, setF] = useState(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [bodyLang, setBodyLang] = useState(fa ? "fa" : "en"); // which body is being edited
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("write"); // write | seo | meta
  const bodyRef = useRef(null);
  const slugTouched = useRef(false);
  const [addingCat, setAddingCat] = useState(false); // custom category input open?
  const [aiTopic, setAiTopic] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [rewBusy, setRewBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [pickLib, setPickLib] = useState(false);       // media-library picker for COVER
  const [pickBodyImg, setPickBodyImg] = useState(false); // media picker to insert INTO body
  const [showRevs, setShowRevs] = useState(false);     // revisions history modal open?
  const [imgCfg, setImgCfg] = useState(null);          // blog_image_ai settings
  const [imgCfgOpen, setImgCfgOpen] = useState(false); // image-provider settings open?
  useEffect(() => { api.get("/settings/blog_image_ai").then((c) => setImgCfg(c && c.provider ? c : { provider: "pollinations", model: "", apiKey: "", baseUrl: "" })).catch(() => setImgCfg({ provider: "pollinations", model: "", apiKey: "", baseUrl: "" })); }, []);
  const saveImgCfg = async () => { try { await api.put("/settings/blog_image_ai", imgCfg); toast(fa ? "تنظیمات تصویر ذخیره شد" : "Image settings saved"); setImgCfgOpen(false); } catch { toast(fa ? "خطا" : "Error"); } };

  useEffect(() => {
    if (id) api.get(`/admin/blog/${id}`).then((p) => { setF(p); slugTouched.current = !!p.slug; }).catch(() => setF(false));
    else setF({ category: "general", title_fa: "", title_en: "", excerpt_fa: "", excerpt_en: "", body_fa: "", body_en: "", cover: "", tags: "", author_name: "", author_credentials: "", reviewed: 0, published: 0, featured: 0, slug: "", meta_title_fa: "", meta_title_en: "", meta_desc_fa: "", meta_desc_en: "", canonical: "", scheduled_at: "" });
  }, [id]);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  // auto-slug from the FA (or EN) title until the author edits the slug manually
  const onTitle = (k, v) => {
    setF((s) => {
      const next = { ...s, [k]: v };
      if (!slugTouched.current) {
        const base = next.title_en || next.title_fa || "";
        next.slug = base.toLowerCase().trim().replace(/[^\w\u0600-\u06FF\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 70);
      }
      return next;
    });
  };

  const bodyField = bodyLang === "fa" ? "body_fa" : "body_en";
  const bodyText = f?.[bodyField] ?? "";

  // live preview (debounced) whenever the active body changes
  useEffect(() => {
    if (!f) return;
    const md = bodyText;
    const h = setTimeout(() => {
      api.post("/admin/blog/preview", { markdown: md }).then((r) => setPreviewHtml(r.html)).catch(() => setPreviewHtml(""));
    }, 350);
    return () => clearTimeout(h);
  }, [bodyText]);

  const applyMd = (b) => {
    const ta = bodyRef.current; if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const val = bodyText;
    const sel = val.slice(start, end);
    let insert, caret;
    if (b.ins) { insert = b.ins; caret = start + insert.length; }
    else if (b.pre) { insert = b.pre + (sel || (fa ? "متن" : "text")); caret = start + insert.length; }
    else { insert = (b.w || "") + (sel || (fa ? "متن" : "text")) + (b.w2 || ""); caret = start + insert.length; }
    const next = val.slice(0, start) + insert + val.slice(end);
    set(bodyField, next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(caret, caret); });
  };

  // Insert a markdown image at the cursor in the active body (from library).
  const insertImageIntoBody = (url) => {
    const ta = bodyRef.current;
    const md = `\n![${fa ? "توضیح تصویر" : "image"}](${url})\n`;
    if (!ta) { set(bodyField, (bodyText || "") + md); return; }
    const start = ta.selectionStart, end = ta.selectionEnd, val = bodyText;
    const next = val.slice(0, start) + md + val.slice(end);
    set(bodyField, next);
    const caret = start + md.length;
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(caret, caret); });
  };

  const save = async (overrides = {}) => {
    setSaving(true);
    try {
      const payload = { ...f, ...overrides };
      if (id) await api.put(`/admin/blog/${id}`, payload); else await api.post("/admin/blog", payload);
      toast(fa ? "ذخیره شد" : "Saved"); onBack();
    } catch { toast(fa ? "خطا در ذخیره" : "Error"); } finally { setSaving(false); }
  };

  // AI draft: fills the fields for the CURRENTLY-edited body language. The admin
  // always reviews & edits before publishing (a doctor must verify accuracy).
  const genDraft = async () => {
    if (!aiTopic.trim()) { toast(fa ? "موضوع را وارد کنید" : "Enter a topic"); return; }
    setAiBusy(true);
    try {
      const r = await api.post("/admin/blog/ai-draft", { topic: aiTopic.trim(), lang: bodyLang });
      if (!r.ok) { toast(r.message || (fa ? "تولید ناموفق بود" : "Failed")); return; }
      const dft = r.draft;
      setF((s) => {
        const next = { ...s };
        const suf = bodyLang === "fa" ? "_fa" : "_en";
        next["title" + suf] = dft.title || next["title" + suf];
        next["excerpt" + suf] = dft.excerpt || next["excerpt" + suf];
        next["body" + suf] = dft.body_markdown || next["body" + suf];
        next["meta_title" + suf] = dft.meta_title || next["meta_title" + suf];
        next["meta_desc" + suf] = dft.meta_desc || next["meta_desc" + suf];
        if (dft.tags && !next.tags) next.tags = dft.tags;
        if (!slugTouched.current) {
          const base = next.title_en || next.title_fa || "";
          next.slug = base.toLowerCase().trim().replace(/[^\w\u0600-\u06FF\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 70);
        }
        return next;
      });
      toast(fa ? "پیش‌نویس ساخته شد — بازبینی کنید" : "Draft generated — please review");
    } catch (e) { toast(String(e.message || e)); } finally { setAiBusy(false); }
  };

  // Rewrite the SELECTED passage in the active body with AI (or whole body if
  // nothing is selected). mode = improve | shorten | expand | simplify | fix.
  const rewrite = async (mode) => {
    const ta = bodyRef.current; if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const whole = bodyText;
    const hasSel = end > start;
    const target = hasSel ? whole.slice(start, end) : whole;
    if (!target.trim()) { toast(fa ? "ابتدا متنی بنویسید یا انتخاب کنید" : "Write or select some text first"); return; }
    setRewBusy(true);
    try {
      const r = await api.post("/admin/blog/ai-rewrite", { text: target, mode, lang: bodyLang });
      if (!r.ok) { toast(r.message || (fa ? "بازنویسی ناموفق بود" : "Failed")); return; }
      const next = hasSel ? (whole.slice(0, start) + r.text + whole.slice(end)) : r.text;
      set(bodyField, next);
      toast(fa ? "بازنویسی شد — بازبینی کنید" : "Rewritten — please review");
    } catch (e) { toast(String(e.message || e)); } finally { setRewBusy(false); }
  };

  // Generate a cover image with AI (free keyless service) from the title/topic.
  const genCover = async () => {
    const prompt = (bodyLang === "fa" ? f.title_fa : f.title_en) || f.title_fa || f.title_en || aiTopic;
    if (!String(prompt).trim()) { toast(fa ? "ابتدا عنوان مقاله را بنویسید" : "Write a title first"); return; }
    setCoverBusy(true);
    try {
      const r = await api.post("/admin/blog/ai-cover", { prompt, lang: bodyLang });
      if (!r.ok) { toast(r.message || (fa ? "تولید تصویر ناموفق بود" : "Failed")); return; }
      set("cover", r.url);
      toast(fa ? "تصویر کاور ساخته شد" : "Cover generated");
    } catch (e) { toast(String(e.message || e)); } finally { setCoverBusy(false); }
  };

  if (f === false) return <div className="page"><div className="card empty-state"><h3>404</h3></div></div>;
  if (!f) return <Spinner />;

  const words = (bodyText.trim().match(/\S+/g) || []).length;
  const readMin = Math.max(1, Math.round(words / 200));
  const metaTitleVal = (bodyLang === "fa" ? f.meta_title_fa : f.meta_title_en) || (bodyLang === "fa" ? f.title_fa : f.title_en) || "";
  const metaDescVal = (bodyLang === "fa" ? f.meta_desc_fa : f.meta_desc_en) || (bodyLang === "fa" ? f.excerpt_fa : f.excerpt_en) || "";

  const Fld = (label, k, textarea, ph) => (
    <div className="field"><label>{label}</label>
      {textarea ? <textarea rows={textarea} value={f[k] ?? ""} placeholder={ph || ""} onChange={(e) => set(k, e.target.value)} />
                : <input value={f[k] ?? ""} placeholder={ph || ""} onChange={(e) => set(k, e.target.value)} />}</div>
  );

  return (
    <div className="page">
      <div className="section-title"><h4>📝 {id ? (fa ? "ویرایش مقاله" : "Edit post") : (fa ? "مقالهٔ جدید" : "New post")}</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="chevronRight" size={14} /> {fa ? "بازگشت" : "Back"}</button>
          {id && <button className="btn btn-ghost btn-sm" onClick={() => setShowRevs(true)} title={fa ? "تاریخچهٔ ویرایش‌ها" : "Edit history"}><Icon name="clock" size={14} /> {fa ? "تاریخچه" : "History"}</button>}
          <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => save({ published: 0 })}>{fa ? "ذخیرهٔ پیش‌نویس" : "Save draft"}</button>
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => save({ published: 1 })}><Icon name="check" size={14} /> {f.published ? (fa ? "ذخیره و انتشار" : "Save & publish") : (fa ? "انتشار" : "Publish")}</button>
        </div>
      </div>

      {/* sub-tabs: Write | SEO | Settings */}
      <div className="mode-switch" style={{ marginBottom: 12 }}>
        <button className={tab === "write" ? "active" : ""} onClick={() => setTab("write")}>{fa ? "نوشتن" : "Write"}</button>
        <button className={tab === "seo" ? "active" : ""} onClick={() => setTab("seo")}>{fa ? "سئو (SEO)" : "SEO"}</button>
        <button className={tab === "meta" ? "active" : ""} onClick={() => setTab("meta")}>{fa ? "تنظیمات" : "Settings"}</button>
      </div>

      {tab === "write" && (<>
        {/* AI draft assistant (opt-in): writes a full first draft from a topic. */}
        <div className="card mb16" style={{ borderInlineStart: "3px solid var(--accent)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Icon name="ai" size={16} /> <span style={{ fontWeight: 800 }}>{fa ? "دستیار نگارش هوش مصنوعی" : "AI writing assistant"}</span>
            <span className="small muted">{fa ? `(زبانِ ${bodyLang === "fa" ? "فارسی" : "انگلیسی"})` : `(${bodyLang} body)`}</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input style={{ flex: 1, minWidth: 220 }} value={aiTopic} onChange={(e) => setAiTopic(e.target.value)}
              placeholder={fa ? "موضوع مقاله؛ مثلاً: تشخیص افتراقی درد قفسه سینه" : "Topic, e.g. differential diagnosis of chest pain"} />
            <button type="button" className="btn btn-accent btn-sm" disabled={aiBusy} onClick={genDraft}>
              <Icon name="bulb" size={14} /> {aiBusy ? (fa ? "در حال نوشتن…" : "Writing…") : (fa ? "تولید پیش‌نویس" : "Generate draft")}
            </button>
          </div>
          <div className="small muted mt8">{fa ? "پیش‌نویس را حتماً بازبینی و ویرایش کنید؛ صحت پزشکی بر عهدهٔ شماست. نیاز به کلید هوش مصنوعی در «تنظیمات هوش مصنوعی»." : "Always review the draft — you own medical accuracy. Requires an AI key in AI settings."}</div>
        </div>

        <div className="card mb16">
          <div className="grid grid-2">
            <div className="field"><label>{fa ? "عنوان (فارسی)" : "Title (FA)"}</label>
              <input value={f.title_fa ?? ""} onChange={(e) => onTitle("title_fa", e.target.value)} placeholder={fa ? "مثلاً: تشخیص سریع STEMI" : ""} /></div>
            <div className="field"><label>{fa ? "عنوان (انگلیسی)" : "Title (EN)"}</label>
              <input dir="ltr" value={f.title_en ?? ""} onChange={(e) => onTitle("title_en", e.target.value)} /></div>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>{fa ? "دسته‌بندی" : "Category"}</label>
              {addingCat ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input autoFocus dir="ltr" value={f.category} placeholder={fa ? "نام دستهٔ جدید" : "new category"} onChange={(e) => set("category", e.target.value)} />
                  <button type="button" className="btn btn-ghost btn-sm" title={fa ? "انتخاب از فهرست" : "pick from list"} onClick={() => setAddingCat(false)}><Icon name="close" size={13} /></button>
                </div>
              ) : (
                <select value={f.category} onChange={(e) => { if (e.target.value === "__new__") { setAddingCat(true); set("category", ""); } else set("category", e.target.value); }}>
                  {(categories.length ? categories : ["general"]).map((c) => <option key={c} value={c}>{c}</option>)}
                  {f.category && !categories.includes(f.category) && <option value={f.category}>{f.category}</option>}
                  <option value="__new__">➕ {fa ? "دستهٔ جدید…" : "New category…"}</option>
                </select>
              )}</div>
            <div className="field"><label>{fa ? "نشانی (slug)" : "Slug"}</label>
              <input dir="ltr" value={f.slug ?? ""} onChange={(e) => { slugTouched.current = true; set("slug", e.target.value); }} placeholder="auto" />
              <div className="small muted mt4">/blog/{f.slug || "…"}</div></div>
          </div>
          <div className="grid grid-2">
            {Fld(fa ? "خلاصه (فارسی)" : "Excerpt (FA)", "excerpt_fa", 2, fa ? "یک جملهٔ کوتاه برای فهرست و گوگل" : "")}
            {Fld(fa ? "خلاصه (انگلیسی)" : "Excerpt (EN)", "excerpt_en", 2)}
          </div>
        </div>

        {/* cover image (upload / paste URL / pick from library / generate with AI) */}
        <div className="card mb16">
          <ImageUpload value={f.cover} onChange={(v) => set("cover", v)} label={fa ? "تصویر کاور (اختیاری)" : "Cover image (optional)"} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPickLib(true)}>
              <Icon name="image" size={14} /> {fa ? "انتخاب از کتابخانه" : "Pick from library"}
            </button>
            <button type="button" className="btn btn-accent btn-sm" disabled={coverBusy} onClick={genCover}>
              <Icon name="ai" size={14} /> {coverBusy ? (fa ? "در حال ساخت تصویر…" : "Generating…") : (fa ? "تولید تصویر با هوش مصنوعی" : "Generate with AI")}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImgCfgOpen((o) => !o)} title={fa ? "تنظیمات سرویس تصویر" : "Image provider settings"}>
              <Icon name="settings" size={14} /> {fa ? "سرویس تصویر" : "Image provider"}
            </button>
          </div>
          {imgCfgOpen && imgCfg && (
            <div className="micro-box mt8" style={{ padding: "12px 14px" }}>
              <div className="small muted mb8">{fa ? "پیش‌فرض: Pollinations (رایگان و بدون کلید). برای کیفیت بالاتر می‌توانید OpenAI یا OpenRouter را با کلید انتخاب کنید." : "Default: Pollinations (free, no key). Choose OpenAI/OpenRouter with a key for higher quality."}</div>
              <div className="grid grid-2">
                <div className="field"><label>{fa ? "سرویس" : "Provider"}</label>
                  <select value={imgCfg.provider} onChange={(e) => setImgCfg({ ...imgCfg, provider: e.target.value })}>
                    <option value="pollinations">Pollinations ({fa ? "رایگان" : "free"})</option>
                    <option value="openai">OpenAI Images</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="custom">{fa ? "سفارشی (Base URL)" : "Custom (Base URL)"}</option>
                  </select></div>
                {imgCfg.provider !== "pollinations" && (
                  <div className="field"><label>{fa ? "مدل" : "Model"}</label>
                    <input dir="ltr" value={imgCfg.model || ""} placeholder="gpt-image-1" onChange={(e) => setImgCfg({ ...imgCfg, model: e.target.value })} /></div>
                )}
              </div>
              {imgCfg.provider !== "pollinations" && (<>
                <div className="field"><label>{fa ? "کلید API" : "API key"}</label>
                  <input dir="ltr" type="password" value={imgCfg.apiKey || ""} onChange={(e) => setImgCfg({ ...imgCfg, apiKey: e.target.value })} placeholder="sk-…" /></div>
                {imgCfg.provider === "custom" && (
                  <div className="field"><label>{fa ? "آدرس پایه" : "Base URL"}</label>
                    <input dir="ltr" value={imgCfg.baseUrl || ""} onChange={(e) => setImgCfg({ ...imgCfg, baseUrl: e.target.value })} placeholder="https://…/v1" /></div>
                )}
              </>)}
              <button type="button" className="btn btn-primary btn-sm mt8" onClick={saveImgCfg}><Icon name="check" size={13} /> {fa ? "ذخیرهٔ تنظیمات تصویر" : "Save image settings"}</button>
            </div>
          )}
          <div className="small muted mt8">{fa ? "می‌توانید تصویر را بارگذاری کنید، از کتابخانه انتخاب کنید، یا با هوش مصنوعی بسازید." : "Upload, pick from the library, or generate with AI."}</div>
        </div>

        {/* body: toolbar + editor + LIVE preview side by side */}
        <div className="card mb16">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            <div style={{ fontWeight: 800 }}>{fa ? "متن مقاله (Markdown)" : "Body (Markdown)"}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className="small muted">{words} {fa ? "کلمه" : "words"} · {readMin} {fa ? "دقیقه مطالعه" : "min read"}</span>
              <div className="mode-switch" style={{ margin: 0 }}>
                <button className={bodyLang === "fa" ? "active" : ""} onClick={() => setBodyLang("fa")} style={{ padding: "4px 12px" }}>فارسی</button>
                <button className={bodyLang === "en" ? "active" : ""} onClick={() => setBodyLang("en")} style={{ padding: "4px 12px" }}>EN</button>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <MdToolbar fa={fa} onApply={applyMd} />
            <button type="button" className="btn btn-ghost btn-sm" title={fa ? "درج تصویر از کتابخانه" : "Insert image from library"}
              style={{ padding: "4px 9px" }} onClick={() => setPickBodyImg(true)}>
              <Icon name="image" size={14} /> {fa ? "درج تصویر" : "Insert image"}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginInlineStart: "auto" }}>
              <Icon name="ai" size={14} />
              <select disabled={rewBusy} defaultValue="" onChange={(e) => { const m = e.target.value; e.target.value = ""; if (m) rewrite(m); }}
                title={fa ? "بازنویسی متنِ انتخاب‌شده با هوش مصنوعی" : "Rewrite selection with AI"} style={{ fontSize: ".82rem", padding: "4px 8px" }}>
                <option value="">{rewBusy ? (fa ? "در حال بازنویسی…" : "Rewriting…") : (fa ? "✨ بازنویسی با AI…" : "✨ AI rewrite…")}</option>
                <option value="improve">{fa ? "روان‌تر و حرفه‌ای‌تر" : "Improve"}</option>
                <option value="shorten">{fa ? "کوتاه‌تر کن" : "Shorten"}</option>
                <option value="expand">{fa ? "بسط بده" : "Expand"}</option>
                <option value="simplify">{fa ? "ساده‌تر کن" : "Simplify"}</option>
                <option value="fix">{fa ? "اصلاح نگارش" : "Fix grammar"}</option>
              </select>
            </div>
          </div>
          <div className="blog-editor-split" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <textarea ref={bodyRef} rows={20} value={bodyText} dir={bodyLang === "fa" ? "rtl" : "ltr"}
              onChange={(e) => set(bodyField, e.target.value)}
              placeholder={fa ? "## عنوان بخش\nمتن مقاله را اینجا بنویسید…\n\n- نکتهٔ اول\n- نکتهٔ دوم" : "## Heading\nWrite here…"}
              style={{ fontFamily: "inherit", lineHeight: 1.8 }} />
            <div className="blog-content blog-preview-pane" style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)", maxHeight: 460, overflow: "auto" }}
              dir={bodyLang === "fa" ? "rtl" : "ltr"}
              dangerouslySetInnerHTML={{ __html: previewHtml || `<p class="muted">${fa ? "پیش‌نمایش زنده اینجا نمایش داده می‌شود…" : "Live preview appears here…"}</p>` }} />
          </div>
        </div>
      </>)}

      {tab === "seo" && (
        <div className="card mb16">
          <div style={{ fontWeight: 800, marginBottom: 4 }}>{fa ? "بهینه‌سازی برای گوگل (SEO)" : "Search engine optimization"}</div>
          <div className="small muted mb16">{fa ? "اگر خالی بگذارید، از عنوان و خلاصهٔ مقاله استفاده می‌شود." : "Leave blank to use the post title & excerpt."}</div>
          {/* Google result preview */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16, background: "var(--panel2,#f7f9fc)" }}>
            <div className="small muted">{fa ? "پیش‌نمایش نتیجهٔ گوگل" : "Google result preview"}</div>
            <div style={{ color: "#1a0dab", fontSize: "1.05rem", fontWeight: 600, marginTop: 6 }} dir={fa ? "rtl" : "ltr"}>{metaTitleVal || (fa ? "عنوان مقاله" : "Post title")}</div>
            <div style={{ color: "#006621", fontSize: ".82rem" }} dir="ltr">medschool.ir/blog/{f.slug || "…"}</div>
            <div style={{ color: "#545454", fontSize: ".88rem", marginTop: 3 }} dir={fa ? "rtl" : "ltr"}>{metaDescVal || (fa ? "توضیح متا اینجا نمایش داده می‌شود…" : "Meta description shows here…")}</div>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>{fa ? "عنوان متا (فارسی)" : "Meta title (FA)"} <span className="small muted">{(f.meta_title_fa || "").length}/60</span></label>
              <input value={f.meta_title_fa ?? ""} onChange={(e) => set("meta_title_fa", e.target.value)} maxLength={70} /></div>
            <div className="field"><label>{fa ? "عنوان متا (انگلیسی)" : "Meta title (EN)"} <span className="small muted">{(f.meta_title_en || "").length}/60</span></label>
              <input dir="ltr" value={f.meta_title_en ?? ""} onChange={(e) => set("meta_title_en", e.target.value)} maxLength={70} /></div>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>{fa ? "توضیح متا (فارسی)" : "Meta description (FA)"} <span className="small muted">{(f.meta_desc_fa || "").length}/160</span></label>
              <textarea rows={2} value={f.meta_desc_fa ?? ""} onChange={(e) => set("meta_desc_fa", e.target.value)} maxLength={180} /></div>
            <div className="field"><label>{fa ? "توضیح متا (انگلیسی)" : "Meta description (EN)"} <span className="small muted">{(f.meta_desc_en || "").length}/160</span></label>
              <textarea rows={2} dir="ltr" value={f.meta_desc_en ?? ""} onChange={(e) => set("meta_desc_en", e.target.value)} maxLength={180} /></div>
          </div>
          <div className="field"><label>{fa ? "آدرس canonical (اختیاری)" : "Canonical URL (optional)"}</label>
            <input dir="ltr" value={f.canonical ?? ""} onChange={(e) => set("canonical", e.target.value)} placeholder="https://…" />
            <div className="small muted mt4">{fa ? "فقط اگر همین مطلب جای دیگری هم منتشر شده پر کنید." : "Only if this content is also published elsewhere."}</div></div>
        </div>
      )}

      {tab === "meta" && (
        <div className="card mb16">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>{fa ? "نویسنده و اعتبار (E-E-A-T)" : "Author & trust (E-E-A-T)"}</div>
          <div className="grid grid-2">
            {Fld(fa ? "نام نویسنده" : "Author name", "author_name")}
            {Fld(fa ? "مدرک/تخصص" : "Credentials", "author_credentials", 0, fa ? "متخصص قلب" : "MD, cardiology")}
          </div>
          {Fld(fa ? "برچسب‌ها (با کاما جدا کن)" : "Tags (comma-separated)", "tags", 0, fa ? "قلب, ECG, اورژانس" : "cardiology, ECG")}
          <div className="divider" />
          {/* scheduled publishing */}
          <div className="field"><label>⏱️ {fa ? "زمان‌بندی انتشار (اختیاری)" : "Schedule publish (optional)"}</label>
            <input type="datetime-local" value={f.scheduled_at ? String(f.scheduled_at).slice(0, 16) : ""}
              onChange={(e) => set("scheduled_at", e.target.value ? new Date(e.target.value).toISOString() : "")} />
            <div className="small muted mt4">{fa ? "اگر تاریخ آینده بگذارید و «پیش‌نویس» ذخیره کنید، مقاله خودکار در آن زمان منتشر می‌شود." : "Set a future time and save as draft — it auto-publishes then."}</div></div>
          <div className="divider" />
          <label className="toggle-row"><span>✓ {fa ? "بازبینی پزشکی شده" : "Medically reviewed"}</span>
            <input type="checkbox" checked={!!f.reviewed} onChange={(e) => set("reviewed", e.target.checked ? 1 : 0)} /></label>
          <label className="toggle-row"><span>⭐ {fa ? "مقالهٔ ویژه" : "Featured"}</span>
            <input type="checkbox" checked={!!f.featured} onChange={(e) => set("featured", e.target.checked ? 1 : 0)} /></label>
          <label className="toggle-row"><span>🌐 {fa ? "منتشر شده" : "Published"}</span>
            <input type="checkbox" checked={!!f.published} onChange={(e) => set("published", e.target.checked ? 1 : 0)} /></label>
        </div>
      )}

      {pickLib && <MediaLibraryPicker onClose={() => setPickLib(false)} onPick={({ url, kind }) => { if (kind !== "video") set("cover", url); }} />}
      {pickBodyImg && <MediaLibraryPicker onClose={() => setPickBodyImg(false)} onPick={({ url, kind }) => { if (kind !== "video") insertImageIntoBody(url); }} />}
      {showRevs && id && <BlogRevisions postId={id} fa={fa} onClose={() => setShowRevs(false)}
        onRestored={(p) => { setShowRevs(false); setF(p); toast(fa ? "نسخهٔ قبلی بازگردانی شد" : "Revision restored"); }} />}
    </div>
  );
}

/* Edit-history modal: lists saved revisions with preview + one-click restore. */
function BlogRevisions({ postId, fa, onClose, onRestored }) {
  const toast = useToast();
  const [list, setList] = useState(null);
  const [sel, setSel] = useState(null);   // selected revision detail
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`/admin/blog/${postId}/revisions`).then((d) => setList(d.revisions || [])).catch(() => setList([])); }, [postId]);
  const view = async (revId) => { try { const d = await api.get(`/admin/blog/${postId}/revisions/${revId}`); setSel(d); } catch { setSel(null); } };
  const restore = async (revId) => {
    if (!confirm(fa ? "این نسخه بازگردانی شود؟ نسخهٔ فعلی هم در تاریخچه ذخیره می‌ماند." : "Restore this version?")) return;
    setBusy(true);
    try { const p = await api.post(`/admin/blog/${postId}/revisions/${revId}/restore`); onRestored(p); }
    catch (e) { toast(String(e.message || e)); } finally { setBusy(false); }
  };
  const fmt = (s) => { try { return new Date(s).toLocaleString(fa ? "fa-IR" : "en-US"); } catch { return s; } };
  return (
    <Modal title={fa ? "تاریخچهٔ ویرایش‌ها" : "Edit history"} onClose={onClose} wide>
      {!list ? <Spinner /> : list.length === 0 ? (
        <div className="card empty-state"><div className="ico"><Icon name="clock" size={34} /></div>
          <h3>{fa ? "هنوز نسخهٔ قبلی‌ای نیست" : "No revisions yet"}</h3>
          <div className="small muted">{fa ? "با هر بار ذخیره، نسخهٔ قبلی اینجا نگه داشته می‌شود." : "Each save keeps the previous version here."}</div></div>
      ) : (
        <div className="grid grid-2" style={{ gap: 12 }}>
          <div style={{ maxHeight: 420, overflow: "auto" }}>
            {list.map((r) => (
              <div key={r.id} className={`kv ${sel?.id === r.id ? "active" : ""}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 8px", borderBottom: "1px solid var(--border)", gap: 8, borderRadius: 8, background: sel?.id === r.id ? "var(--panel2,#eef2f8)" : "transparent" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: ".9rem" }}>{fmt(r.created_at)}</div>
                  <div className="small muted">{r.editor || "—"} · {r.words_fa} {fa ? "کلمه" : "words"} · {r.published ? (fa ? "منتشرشده" : "published") : (fa ? "پیش‌نویس" : "draft")}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => view(r.id)}>{fa ? "نمایش" : "View"}</button>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => restore(r.id)}>{fa ? "بازگردانی" : "Restore"}</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ maxHeight: 420, overflow: "auto", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
            {sel ? (<>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>{fa ? sel.snapshot.title_fa : (sel.snapshot.title_en || sel.snapshot.title_fa)}</div>
              <div className="small muted mb8">{fmt(sel.created_at)}</div>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: ".85rem", lineHeight: 1.7, margin: 0 }} dir={fa ? "rtl" : "ltr"}>
                {(fa ? sel.snapshot.body_fa : (sel.snapshot.body_en || sel.snapshot.body_fa) || "").slice(0, 3000)}
              </pre>
            </>) : <div className="small muted">{fa ? "برای دیدن محتوا، یک نسخه را «نمایش» بزنید." : "Select a revision to preview."}</div>}
          </div>
        </div>
      )}
    </Modal>
  );
}

function CertificatesAdmin() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [d, setD] = useState(null);
  const [uname, setUname] = useState("");
  const load = () => api.get(`/admin/certificates?lang=${fa ? "fa" : "en"}`).then(setD).catch(() => setD(false));
  useEffect(() => { load(); }, []);
  if (d === false) return <div className="page"><div className="card empty-state"><h3>{t("noData")}</h3></div></div>;
  if (!d) return <Spinner />;
  const s = d.stats;
  const issue = async () => {
    if (!uname.trim()) return;
    try { const r = await api.post("/admin/certificates/issue", { username: uname.trim(), kind: "program" });
      if (r.ok) { toast(fa ? "صادر شد 🎓" : "Issued 🎓"); setUname(""); load(); } else toast(fa ? "کاربر یافت نشد یا خطا" : "User not found / error"); }
    catch { toast("Error"); }
  };
  const toggle = async (id, revoked) => { await api.post(`/admin/certificates/${id}/revoke`, { revoked }); toast(t("save")); load(); };
  const KPI = ({ n, l }) => (<div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--primary)" }}>{n}</div><div className="small">{l}</div></div>);
  return (
    <div className="page">
      <div className="section-title"><h4>🎓 {fa ? "گواهی‌نامه‌های پایان دوره" : "Completion certificates"}</h4></div>
      <div className="muted small mb16">
        {fa ? "گواهی‌نامه‌ها با تکمیل دوره به‌طور خودکار صادر می‌شوند و هرکس می‌تواند از صفحهٔ /verify اصالتشان را استعلام کند. تنظیمات (نام صادرکننده، امضاکننده، آستانه) در «گیمیفیکیشن → گواهی‌نامه» و روشن/خاموش در «کلیدهای ویژگی» است."
             : "Certificates are auto-issued on completion; anyone can confirm them at /verify. Configure issuer/signer/threshold in Gamification → Certificates; toggle via Feature Flags."}
      </div>
      <div className="grid grid-3 mb16">
        <KPI n={s.total} l={fa ? "کل گواهی‌ها" : "Total"} />
        <KPI n={s.active} l={fa ? "معتبر" : "Active"} />
        <KPI n={s.revoked} l={fa ? "باطل‌شده" : "Revoked"} />
      </div>
      <div className="card mb16">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{fa ? "صدور دستی (برای یک کاربر)" : "Manual issue (by user)"}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder={fa ? "نام کاربری یا ایمیل" : "username or email"} value={uname} onChange={(e) => setUname(e.target.value)} style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={issue}>{fa ? "صدور گواهی دوره" : "Issue program cert"}</button>
        </div>
      </div>
      <div className="card">
        {d.list.length === 0 && <div className="small muted">{fa ? "هنوز گواهی‌ای صادر نشده." : "No certificates issued yet."}</div>}
        {d.list.map((c) => (
          <div key={c.id} className="kv" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{c.recipient} <span className="small muted">({c.username})</span></div>
              <div className="small muted">{c.title} · <a href={`/verify/${c.serial}`} target="_blank" rel="noreferrer">{c.serial}</a>
                {c.revoked ? <span style={{ color: "#c0392b" }}> · {fa ? "باطل" : "revoked"}</span> : ""}</div>
            </div>
            <button className={`btn btn-sm ${c.revoked ? "" : "btn-danger"}`} onClick={() => toggle(c.id, !c.revoked)}>
              {c.revoked ? (fa ? "بازگردانی" : "Restore") : (fa ? "ابطال" : "Revoke")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Small reusable inline-SVG bar chart (no external lib → renders in preview). */
/* Download a CSV/file behind admin auth (blob), or open a printable HTML/PDF. */
async function downloadAuthed(path, filename) {
  try {
    const res = await fetch(path, { credentials: "same-origin", headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  } catch (e) { alert(e.message); }
}
function openPrintable(path) {
  // open the server-rendered printable HTML in a new tab (has a Print/Save-PDF button)
  const w = window.open("", "_blank");
  fetch(path, { credentials: "same-origin", headers: { Authorization: `Bearer ${getToken()}` } })
    .then((r) => r.text()).then((html) => { if (w) { w.document.write(html); w.document.close(); } })
    .catch((e) => { if (w) w.close(); alert(e.message); });
}

/* Automatic health-alert banner + editable thresholds (shared by dashboards). */
function HealthAlerts({ endpoint = "/admin/analytics/alerts", canEditThresholds = true }) {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [d, setD] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = () => api.get(endpoint).then(setD).catch(() => setD(false));
  useEffect(() => { load(); }, []);
  if (!d) return null;
  const alerts = d.alerts || [];
  const th = d.thresholds || {};
  const labels = {
    stickiness_min: fa ? "حداقل چسبندگی٪" : "Min stickiness%", retention_d1_min: fa ? "حداقل ماندگاری روز۱٪" : "Min D1 ret%",
    retention_d30_min: fa ? "حداقل ماندگاری روز۳۰٪" : "Min D30 ret%", premium_conv_min: fa ? "حداقل تبدیل پریمیوم٪" : "Min premium conv%",
    ctr_min: fa ? "حداقل CTR٪" : "Min CTR%", frequency_max: fa ? "حداکثر فراوانی" : "Max frequency", fill_rate_min: fa ? "حداقل نرخ پرشدن٪" : "Min fill%",
  };
  const saveTh = async () => { try { const r = await api.put("/admin/analytics/alerts", edit); toast(t("saved")); setEdit(null); setD((x) => ({ ...x, thresholds: r.thresholds })); load(); } catch (e) { toast(e.message); } };
  const runAlerts = async () => { try { const r = await api.post("/admin/analytics/run-alerts", {}); toast(`${t("saved")} (${r.sent})`); } catch (e) { toast(e.message); } };
  const sendDigest = async () => { try { const r = await api.post("/admin/analytics/weekly-digest", {}); toast(`${t("saved")} (${r.sent})`); } catch (e) { toast(e.message); } };
  return (
    <div className="card mb16" style={{ borderInlineStart: `5px solid ${alerts.length ? "var(--flame,#e0533d)" : "var(--green)"}` }}>
      <div className="section-title"><h4>{alerts.length ? "⚠️" : "✅"} {t("healthAlerts")} {alerts.length > 0 && <span className="tag">{alerts.length}</span>}</h4>
        {canEditThresholds && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={runAlerts}><Icon name="bell" size={13} /> {t("runAlertsNow")}</button>
          <button className="btn btn-ghost btn-sm" onClick={sendDigest}><Icon name="chart" size={13} /> {t("sendDigestNow")}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...th })}><Icon name="settings" size={13} /> {t("alertThresholds")}</button>
        </div>}</div>
      {alerts.length === 0 ? <div className="small muted">{t("noAlerts")}</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {alerts.map((a) => (
            <div key={a.id} className="small" style={{ padding: "6px 10px", borderRadius: 8, background: a.severity === "warn" ? "rgba(224,83,61,.1)" : "rgba(240,180,0,.1)" }}>
              {a.severity === "warn" ? "🔴" : "🟡"} {fa ? a.fa : a.en}
            </div>
          ))}
        </div>
      )}
      {edit && (
        <Modal title={t("alertThresholds")} onClose={() => setEdit(null)} onSave={saveTh}>
          <div className="small muted mb8">{t("alertsSaveHint")}</div>
          <div className="grid grid-2">
            {Object.keys(labels).map((k) => (
              <div className="field" key={k}><label>{labels[k]}</label>
                <input type="number" min="0" value={edit[k] ?? 0} onChange={(e) => setEdit({ ...edit, [k]: Number(e.target.value) || 0 })} /></div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function MiniBars({ data, valueKey, labelKey = "day", color = "var(--primary,#3b6cff)", suffix = "", height = 130 }) {
  if (!data || !data.length) return <div className="small muted center" style={{ padding: 16 }}>—</div>;
  const W = Math.max(260, data.length * 42 + 30), padB = 34, padT = 12, chartH = height - padB - padT;
  const max = Math.max(1, ...data.map((d) => d[valueKey] || 0));
  const gap = (W - 20) / data.length, barW = Math.min(26, gap - 6);
  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={height} style={{ display: "block" }}>
        {data.map((d, i) => {
          const v = d[valueKey] || 0;
          const bh = Math.round((v / max) * chartH);
          const x = 20 + i * gap + (gap - barW) / 2, y = padT + chartH - bh;
          const lbl = String(d[labelKey] || "").slice(5); // MM-DD
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={Math.max(0, bh)} rx="3" fill={color} />
              <text x={x + barW / 2} y={y - 3} fontSize="8.5" textAnchor="middle" fill="var(--fg,#333)">{v}{suffix}</text>
              <text x={x + barW / 2} y={height - 20} fontSize="8" textAnchor="middle" fill="var(--muted,#8a93a5)">{lbl}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ===== Deep SITE analytics: DAU/WAU/MAU, stickiness, retention, trends ===== */
function SiteAnalytics() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [d, setD] = useState(null);
  const [seg, setSeg] = useState(null);
  useEffect(() => {
    api.get("/admin/analytics").then(setD).catch(() => setD(false));
    api.get(`/admin/analytics/segments?lang=${lang}`).then(setSeg).catch(() => {});
  }, [lang]);
  if (d === false) return <div className="page"><div className="card empty-state"><h3>{t("noData")}</h3></div></div>;
  if (!d) return <Spinner />;
  const KPI = ({ n, l, c, sub }) => (
    <div className="card" style={{ textAlign: "center" }}>
      <div style={{ fontSize: "1.7rem", fontWeight: 900, color: c || "var(--primary)" }}>{n}</div>
      <div className="small">{l}</div>{sub != null && <div className="small muted">{sub}</div>}
    </div>
  );
  const rt = d.retention || {};
  const num = (n) => (n || 0).toLocaleString(fa ? "fa-IR" : "en-US");
  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="chart" size={18} /> {t("siteAnalytics")}</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => downloadAuthed(`/api/admin/analytics.csv?lang=${lang}`, "site-analytics.csv")}><Icon name="download" size={13} /> CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={() => openPrintable(`/api/admin/analytics.pdf?lang=${lang}`)}><Icon name="download" size={13} /> {t("exportPdf")}</button>
        </div></div>
      <div className="muted small mb16">{fa ? "شاخص‌های کلیدی محصول بر اساس استانداردهای ۲۰۲۶ (کاربر فعال، چسبندگی، ماندگاری، تبدیل)." : "Product KPIs per 2026 standards (active users, stickiness, retention, conversion)."}</div>

      <HealthAlerts endpoint="/admin/analytics/alerts" />

      <div className="grid grid-4 mb16">
        <KPI n={num(d.active.dau)} l={t("mDau")} />
        <KPI n={num(d.active.wau)} l={t("mWau")} c="#0f766e" />
        <KPI n={num(d.active.mau)} l={t("mMau")} c="#178053" />
        <KPI n={`${d.active.stickiness}%`} l={t("mStickiness")} c={d.active.stickiness >= 20 ? "#12805a" : "var(--flame,#e0533d)"} sub={fa ? "خوب: ۲۰٪+" : "good: 20%+"} />
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>{t("mRetention")}</h4></div>
        <div className="small muted mb8">{fa ? `بر اساس ${num(rt.cohortSize || 0)} کوهورت ثبت‌نامی. معیار خوب برای اپ آموزشی: روز ۱ حدود ۱۵٪، روز ۳۰ حدود ۳٪.` : `From ${num(rt.cohortSize || 0)} signup cohorts. Education benchmark: D1 ~15%, D30 ~3%.`}</div>
        <div className="grid grid-3">
          <KPI n={rt.d1 == null ? "—" : `${rt.d1}%`} l={t("mD1")} />
          <KPI n={rt.d7 == null ? "—" : `${rt.d7}%`} l={t("mD7")} c="#0f766e" />
          <KPI n={rt.d30 == null ? "—" : `${rt.d30}%`} l={t("mD30")} c="#178053" />
        </div>
      </div>

      <div className="grid grid-2 mb16">
        <div className="card"><div className="section-title"><h4>{t("activityTrend")} ({fa ? "کاربر فعال" : "active"})</h4></div>
          <MiniBars data={d.activityTrend} valueKey="active" color="var(--primary,#3b6cff)" /></div>
        <div className="card"><div className="section-title"><h4>{fa ? "ثبت‌نام روزانه" : "Daily signups"}</h4></div>
          <MiniBars data={d.signupTrend} valueKey="n" color="#12805a" /></div>
      </div>

      <div className="grid grid-4 mb16">
        <KPI n={`${d.premium.convPct}%`} l={t("mConvPct")} c="#b8860b" sub={`${num(d.premium.premium)}/${num(d.premium.learners)}`} />
        <KPI n={num(d.engagement.lessonsCompleted)} l={t("mLessonsDone")} />
        <KPI n={num(d.engagement.activeStreaks)} l={t("mActiveStreaks")} sub={`${fa ? "رکورد" : "best"}: ${num(d.engagement.bestStreak)}`} />
        <KPI n={`${d.engagement.avgVpScore}%`} l={t("mAvgVp")} sub={`${num(d.engagement.vpAttempts)} ${fa ? "آزمون" : "attempts"}`} />
      </div>

      {/* Segmentation: per-university & per-class breakdown */}
      {seg && (
        <>
          <div className="section-title mt16"><h4><Icon name="class" size={16} /> {t("bySegment")}</h4></div>
          {seg.universities?.length > 0 && (
            <div className="card mb16">
              <div className="small muted mb8">{t("byUniversity")}</div>
              <div className="table-wrap"><table><thead><tr>
                <th>{fa ? "دانشگاه" : "University"}</th><th>{t("colTeachers")}</th><th>{t("colStudents")}</th><th>{t("colClasses")}</th><th>{fa ? "آزمون" : "Attempts"}</th><th>{t("colAvgScore")}</th>
              </tr></thead><tbody>{seg.universities.map((u) => (
                <tr key={u.id}><td>{u.name}</td><td>{num(u.teachers)}</td><td>{num(u.students)}</td><td>{num(u.classes)}</td><td>{num(u.attempts)}</td><td><b>{u.avgScore}</b></td></tr>
              ))}</tbody></table></div>
            </div>
          )}
          <div className="card">
            <div className="small muted mb8">{t("byClassTitle")}</div>
            {(!seg.classes || seg.classes.length === 0) ? <div className="small muted center" style={{ padding: 12 }}>{t("noData")}</div> :
              <div className="table-wrap"><table><thead><tr>
                <th>{fa ? "کلاس" : "Class"}</th><th>{fa ? "کد" : "Code"}</th><th>{t("colMembers")}</th><th>{t("colCases")}</th><th>{t("colAvgScore")}</th>
              </tr></thead><tbody>{seg.classes.map((c) => (
                <tr key={c.id}><td>{c.name}</td><td className="small muted">{c.code}</td><td>{num(c.members)}</td><td>{num(c.cases)}</td><td><b>{c.avgScore}</b></td></tr>
              ))}</tbody></table></div>}
          </div>
        </>
      )}
    </div>
  );
}

/* ===== Deep AD analytics: CTR, eCPM, fill, reach, frequency, RPM, revenue ===== */
function AdAnalytics() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [d, setD] = useState(null);
  const [ecpm, setEcpm] = useState(null);
  const load = () => api.get("/ads/analytics").then(setD).catch(() => setD(false));
  useEffect(() => { load(); api.get("/ads/ecpm").then(setEcpm).catch(() => {}); }, []);
  const saveEcpm = async () => { try { const r = await api.put("/ads/ecpm", ecpm); setEcpm(r.ecpm); toast(t("saved")); load(); } catch (e) { toast(e.message); } };
  if (d === false) return <div className="page"><div className="card empty-state"><h3>{t("noData")}</h3></div></div>;
  if (!d) return <Spinner />;
  const T = d.totals; const num = (n) => (n || 0).toLocaleString(fa ? "fa-IR" : "en-US");
  const cur = T.currency || "";
  const KPI = ({ n, l, c, sub }) => (
    <div className="card" style={{ textAlign: "center" }}>
      <div style={{ fontSize: "1.5rem", fontWeight: 900, color: c || "var(--primary)" }}>{n}</div>
      <div className="small">{l}</div>{sub != null && <div className="small muted">{sub}</div>}
    </div>
  );
  const fmtLabel = (f) => ({ banner: fa ? "بنر" : "Banner", native: fa ? "نیتیو" : "Native", interstitial: fa ? "میان‌برنامه‌ای" : "Interstitial", rewarded: fa ? "جایزه‌دار" : "Rewarded", app_open: fa ? "بازگشایی" : "App-open", prelesson: fa ? "پیش‌درس" : "Pre-lesson", sponsored: fa ? "اسپانسری" : "Sponsored" }[f] || f);

  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="target" size={18} /> {t("adAnalytics")}</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => downloadAuthed(`/api/ads/analytics.csv?lang=${lang}`, "ad-analytics.csv")}><Icon name="download" size={13} /> CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={() => openPrintable(`/api/ads/analytics.pdf?lang=${lang}`)}><Icon name="download" size={13} /> {t("exportPdf")}</button>
        </div></div>
      <div className="muted small mb16">{fa ? "شاخص‌های استاندارد تبلیغات (۲۰۲۶): CTR، eCPM، نرخ پرشدن، دسترسی، فراوانی، RPM و درآمد تخمینی." : "Standard ad KPIs (2026): CTR, eCPM, fill rate, reach, frequency, RPM & estimated revenue."}</div>

      <HealthAlerts endpoint="/admin/analytics/alerts" canEditThresholds={false} />

      <div className="grid grid-4 mb16">
        <KPI n={num(T.impressions)} l={t("impressions")} />
        <KPI n={num(T.clicks)} l={t("clicks")} />
        <KPI n={`${T.ctr}%`} l={t("mCtr")} c="#0f766e" />
        <KPI n={num(T.reach)} l={t("mReach")} />
        <KPI n={T.frequency} l={t("mFrequency")} sub={fa ? "نمایش/کاربر" : "imp/user"} />
        <KPI n={T.fillRate == null ? "—" : `${T.fillRate}%`} l={t("mFillRate")} />
        <KPI n={`${num(T.estRevenue)} ${cur}`} l={t("mEstRevenue")} c="#b8860b" />
        <KPI n={`${num(T.rpm)} ${cur}`} l={t("mRpm")} sub={fa ? "درآمد/۱۰۰۰نمایش" : "rev/1000 imp"} />
      </div>

      {/* eCPM benchmarks (admin-set) */}
      {ecpm && (
        <div className="card mb16">
          <div className="section-title"><h4>💰 {t("ecpmSettings")}</h4>
            <button className="btn btn-primary btn-sm" onClick={saveEcpm}><Icon name="check" size={14} /> {t("save")}</button></div>
          <div className="small muted mb8">{t("ecpmHint")}</div>
          <div className="grid grid-4">
            {["banner", "native", "interstitial", "rewarded", "app_open", "prelesson", "sponsored"].map((f) => (
              <div className="field" key={f}><label>{fmtLabel(f)}</label>
                <input type="number" min="0" value={ecpm[f] ?? 0} onChange={(e) => setEcpm({ ...ecpm, [f]: Number(e.target.value) || 0 })} /></div>
            ))}
            <div className="field"><label>{fa ? "واحد پول" : "Currency"}</label>
              <input value={ecpm.currency || ""} onChange={(e) => setEcpm({ ...ecpm, currency: e.target.value })} /></div>
          </div>
        </div>
      )}

      <div className="grid grid-2 mb16">
        <div className="card"><div className="section-title"><h4>{t("activityTrend")} ({t("impressions")})</h4></div>
          <MiniBars data={d.trend} valueKey="imp" color="var(--primary,#3b6cff)" /></div>
        <div className="card"><div className="section-title"><h4>{fa ? "درآمد تخمینی روزانه" : "Daily est. revenue"}</h4></div>
          <MiniBars data={d.trend} valueKey="rev" color="#b8860b" /></div>
      </div>

      <div className="grid grid-2">
        <div className="card"><div className="section-title"><h4>{t("byFormat")}</h4></div>
          <div className="table-wrap"><table><thead><tr><th>{t("adFormat")}</th><th>{t("impressions")}</th><th>{t("mCtr")}</th><th>{t("mEcpm")}</th><th>{t("mEstRevenue")}</th></tr></thead>
            <tbody>{d.byFormat.map((f) => (<tr key={f.format}><td>{fmtLabel(f.format)}</td><td>{num(f.imp)}</td><td>{f.ctr}%</td><td>{num(f.ecpm)}</td><td>{num(f.estRevenue)} {cur}</td></tr>))}</tbody></table></div>
        </div>
        <div className="card"><div className="section-title"><h4>{t("topAdsTitle")}</h4></div>
          {d.topAds.length === 0 ? <div className="small muted center" style={{ padding: 14 }}>{t("noData")}</div> :
            <div className="table-wrap"><table><thead><tr><th>{fa ? "عنوان" : "Title"}</th><th>{t("impressions")}</th><th>{t("clicks")}</th><th>{t("mCtr")}</th></tr></thead>
              <tbody>{d.topAds.map((a) => (<tr key={a.id}><td>{fa ? a.title_fa : a.title_en}</td><td>{num(a.imp)}</td><td>{num(a.clk)}</td><td>{a.ctr}%</td></tr>))}</tbody></table></div>}
        </div>
      </div>
    </div>
  );
}

function GrowthAdmin() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/growth").then(setD).catch(() => setD(false)); }, []);
  if (d === false) return <div className="page"><div className="card empty-state"><h3>{t("noData")}</h3></div></div>;
  if (!d) return <Spinner />;
  const s = d.stats;
  const KPI = ({ n, l, c }) => (
    <div className="card" style={{ textAlign: "center" }}>
      <div style={{ fontSize: "1.6rem", fontWeight: 900, color: c || "var(--primary)" }}>{n}</div>
      <div className="small">{l}</div>
    </div>
  );
  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="users" size={18} /> {fa ? "رشد و وایرال (دعوت + اشتراک‌گذاری)" : "Growth (referrals + sharing)"}</h4></div>
      <div className="muted small mb16">
        {fa
          ? "مقدار پاداش‌ها را در «گیمیفیکیشن» (بخش دعوت و اشتراک‌گذاری) تنظیم کنید و روشن/خاموش‌کردن کل امکانات در «کلیدهای ویژگی» است."
          : "Tune reward amounts in Gamification (referral & social groups); toggle the whole features in Feature Flags."}
      </div>
      <div className="grid grid-4 mb16">
        <KPI n={s.total} l={fa ? "کل دعوت‌ها" : "Total referrals"} />
        <KPI n={s.qualified} l={fa ? "دعوت موفق" : "Qualified"} c="#12805a" />
        <KPI n={s.viralK} l={fa ? "ضریب وایرال (K)" : "Viral coeff. (K)"} c={s.viralK >= 1 ? "#12805a" : undefined} />
        <KPI n={s.shares} l={fa ? "اشتراک‌گذاری‌ها" : "Shares"} />
      </div>
      <div className="grid grid-2">
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>👑 {fa ? "برترین دعوت‌کنندگان" : "Top referrers"}</div>
          {(!s.topReferrers || s.topReferrers.length === 0) && <div className="small muted">{t("noData")}</div>}
          {(s.topReferrers || []).map((r, i) => (
            <div key={i} className="invite-lb-row">
              <span className="ilb-rank">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
              <span className="ilb-name">{r.name}</span>
              <span className="ilb-count">{r.count} 🎓</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>📣 {fa ? "کانال‌های اشتراک‌گذاری" : "Share channels"}</div>
          {(!s.byChannel || s.byChannel.length === 0) && <div className="small muted">{t("noData")}</div>}
          {(s.byChannel || []).map((c) => (
            <div key={c.channel} className="invite-lb-row">
              <span className="ilb-name">{c.channel}</span>
              <span className="ilb-count">{c.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="small muted mt16">
        {fa ? "ضریب وایرال (K) = میانگین دعوت موفق به‌ازای هر کاربر. اگر K به ۱ برسد، رشد خودکار (وایرال) اتفاق می‌افتد." : "Viral K = qualified referrals per learner. K ≥ 1 means self-sustaining viral growth."}
      </div>
    </div>
  );
}

function ProductHealth() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/product-health").then(setD).catch(() => setD(false)); }, []);
  if (d === false) return <div className="page"><div className="card empty-state"><h3>{t("noData")}</h3></div></div>;
  if (!d) return <Spinner />;

  const e = d.engagement;
  const stickHealth = e.stickiness >= 20 ? "#22a06b" : e.stickiness >= 10 ? "#e0a400" : "#d1495b";
  const funnelLabels = {
    signup: fa ? "ثبت‌نام" : "Signed up",
    firstLesson: fa ? "اولین درس" : "First lesson",
    streak3: fa ? "استریک ۳ روزه" : "3-day streak",
    return7: fa ? "بازگشت بعد ۷ روز" : "Returned (7d)",
  };
  const catLabels = { general: fa ? "عمومی" : "General", account: fa ? "حساب" : "Account", learning: fa ? "یادگیری" : "Learning", billing: fa ? "پرداخت" : "Billing", technical: fa ? "فنی" : "Technical", bug: fa ? "باگ" : "Bug", feedback: fa ? "بازخورد" : "Feedback" };

  const KPI = ({ label, value, sub, color }) => (
    <div className="card" style={{ textAlign: "center", padding: 16 }}>
      <div style={{ fontSize: "1.8rem", fontWeight: 900, color: color || "var(--primary)" }}>{value}</div>
      <div style={{ fontWeight: 700 }}>{label}</div>
      {sub && <div className="small muted">{sub}</div>}
    </div>
  );

  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="activity" size={18} /> {fa ? "داشبورد سلامت محصول" : "Product health"}</h4>
        <span className="small muted">{fa ? "تاریخ:" : "As of:"} {d.generatedAt}</span>
      </div>

      {/* engagement KPIs */}
      <div className="grid grid-4">
        <KPI label={fa ? "کاربر فعال امروز (DAU)" : "DAU"} value={e.dau} />
        <KPI label={fa ? "کاربر فعال هفته (WAU)" : "WAU"} value={e.wau} />
        <KPI label={fa ? "کاربر فعال ماه (MAU)" : "MAU"} value={e.mau} />
        <KPI label={fa ? "چسبندگی (DAU/MAU)" : "Stickiness"} value={e.stickiness + "%"} color={stickHealth}
          sub={fa ? "۲۰٪+ سالم است" : "20%+ is healthy"} />
      </div>

      {/* trend */}
      <div className="card mt16">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{fa ? "روند کاربران فعال (۱۴ روز اخیر)" : "Active users (last 14 days)"}</div>
        <LineChart values={e.trend.map((x) => x.active)} height={130} />
        <div className="small muted" style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span>{fmtDate(e.trend[0]?.day, lang)}</span><span>WAU/MAU: {e.wauMau}%</span><span>{fmtDate(e.trend[e.trend.length - 1]?.day, lang)}</span>
        </div>
      </div>

      <div className="grid grid-2 mt16">
        {/* activation funnel */}
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>{fa ? "قیف فعال‌سازی" : "Activation funnel"}</div>
          {d.funnel.map((f) => (
            <div key={f.key} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".88rem", marginBottom: 3 }}>
                <span style={{ fontWeight: 700 }}>{funnelLabels[f.key] || f.key}</span>
                <span className="muted">{f.count} · {f.pct}%</span>
              </div>
              <div style={{ background: "var(--panel3, #eef3f9)", borderRadius: 6, height: 12, overflow: "hidden" }}>
                <div style={{ width: `${f.pct}%`, height: "100%", background: "var(--grad-primary, var(--primary))" }} />
              </div>
            </div>
          ))}
          <div className="small muted mt8">{fa ? "هرجا افت شدید دیدی، همان‌جا را بهبود بده." : "Fix wherever the biggest drop-off is."}</div>
        </div>

        {/* retention + activity */}
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>{fa ? "ماندگاری و فعالیت" : "Retention & activity"}</div>
          <div className="kv">
            <span className="tag">{fa ? "ماندگاری روز ۷" : "Day-7 retention"}: <b>{d.retention.day7}%</b></span>
            <span className="tag">{fa ? "استریک فعال" : "Active streaks"}: <b>{d.activity.activeStreaks}</b></span>
            <span className="tag">{fa ? "میانگین استریک" : "Avg streak"}: <b>{d.activity.avgStreak}</b></span>
          </div>
          <div className="kv mt8">
            <span className="tag">{fa ? "درس‌های امروز" : "Lessons today"}: <b>{d.activity.lessonsToday}</b></span>
            <span className="tag">{fa ? "پاسخ‌های امروز" : "Answers today"}: <b>{d.activity.answersToday}</b></span>
          </div>
          <div className="kv mt8">
            <span className="tag">{fa ? "کل کاربران" : "Total learners"}: <b>{d.population.totalLearners}</b></span>
            <span className="tag">{fa ? "جدید (۷ روز)" : "New (7d)"}: <b>{d.population.newLearners7}</b></span>
            <span className="tag">{fa ? "پریمیوم" : "Premium"}: <b>{d.population.premium}</b></span>
          </div>
        </div>
      </div>

      {/* close-the-loop: open support tickets */}
      <div className="card mt16">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 800 }}><Icon name="chat" size={15} /> {fa ? "بستن حلقه: تیکت‌های باز پشتیبانی" : "Close the loop: open support tickets"}</div>
          <span className="tag" style={{ background: d.support.open ? "#fdecec" : "var(--panel3)", color: d.support.open ? "#d1495b" : "inherit" }}>{d.support.open} {fa ? "باز" : "open"}</span>
        </div>
        {d.support.byCategory.length > 0 && (
          <div className="kv mb8">
            {d.support.byCategory.map((c) => <span key={c.category} className="tag">{catLabels[c.category] || c.category}: {c.count}</span>)}
          </div>
        )}
        {d.support.recent.length === 0
          ? <div className="small muted">{fa ? "تیکت بازی وجود ندارد 🎉" : "No open tickets 🎉"}</div>
          : d.support.recent.map((tk) => (
            <div key={tk.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: "1px solid var(--border)" }}>
              <span style={{ fontWeight: 600 }}>{tk.subject || (fa ? "(بدون موضوع)" : "(no subject)")}</span>
              <span className="small muted">{tk.who} · {catLabels[tk.category] || tk.category}</span>
            </div>
          ))}
        <div className="small muted mt8">{fa ? "برای پاسخ به تیکت‌ها به «صندوق پشتیبانی» بروید." : "Reply to tickets in the Support inbox."}</div>
      </div>
    </div>
  );
}

/* ---- FSRS optimizer: fit the spaced-repetition scheduler to REAL review
   history. Analyze (dry-run) → Optimize (compute+compare) → Apply (save params). */
function FsrsOptimizer() {
  const { lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const load = () => api.get("/admin/fsrs/analyze").then(setInfo).catch(() => setInfo(false));
  useEffect(() => { load(); }, []);

  const optimize = async () => {
    setBusy(true); setResult(null);
    try { setResult(await api.post("/admin/fsrs/optimize")); }
    catch (e) { toast(fa ? "دادهٔ کافی برای بهینه‌سازی نیست" : "Not enough data"); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    if (!result?.proposed) return;
    try { await api.post("/admin/fsrs/apply", { params: result.proposed }); toast(fa ? "پارامترها اعمال شد ✅" : "Applied ✅"); load(); setResult(null); }
    catch { toast("Error"); }
  };

  if (info === false) return <div className="page"><div className="card empty-state"><h3>{fa ? "خطا" : "Error"}</h3></div></div>;
  if (!info) return <Spinner />;

  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="brain" size={18} /> {fa ? "بهینه‌سازی خودکار الگوریتم مرور (FSRS)" : "FSRS auto-optimizer"}</h4></div>
      <div className="muted small mb16">
        {fa
          ? "این ابزار پارامترهای الگوریتم تکرار فاصله‌دار (FSRS) را از روی «تاریخچهٔ واقعی مرور» کاربران تنظیم می‌کند تا زمان‌بندی مرورها با نحوهٔ فراموشیِ واقعی کاربران شما هماهنگ شود. معیار سنجش «log-loss» است (هرچه کمتر، دقیق‌تر). این کار دوره‌ای است (مثلاً ماهی یک‌بار)، نه هر لحظه."
          : "This fits the FSRS spaced-repetition parameters to your users' real review history so scheduling matches how they actually forget. The metric is log-loss (lower = better-calibrated). Run it periodically (e.g. monthly), not constantly."}
      </div>

      <div className="grid grid-4">
        <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--primary)" }}>{info.totalReviews}</div><div className="small">{fa ? "مرور ثبت‌شده" : "Reviews logged"}</div></div>
        <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--primary)" }}>{info.trainableCards}</div><div className="small">{fa ? "کارت قابل‌آموزش" : "Trainable cards"}</div></div>
        <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.6rem", fontWeight: 900 }}>{info.current.logloss ?? "—"}</div><div className="small">{fa ? "log-loss فعلی" : "Current log-loss"}</div></div>
        <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: "1.6rem", fontWeight: 900 }}>{info.current.rmse ?? "—"}</div><div className="small">RMSE</div></div>
      </div>

      <div className="card mt16">
        {!info.ready && (
          <div className="note-warn" style={{ background: "#fff8e6", border: "1px solid #ffe4a3", color: "#7a5b00", borderRadius: 10, padding: 12, marginBottom: 12 }}>
            {fa
              ? `برای بهینه‌سازی مطمئن، حداقل ${info.minReviews} مرور لازم است. تا آن زمان بهتر است از پارامترهای پیش‌فرض (میانگین جمعیتی) استفاده شود. می‌توانید امتحان کنید ولی نتیجه با دادهٔ کم قابل‌اعتماد نیست.`
              : `For a reliable fit you need at least ${info.minReviews} reviews. Until then the population-default parameters are recommended. You can still try, but results are unreliable with little data.`}
          </div>
        )}
        <button className="btn btn-primary" onClick={optimize} disabled={busy}>
          {busy ? (fa ? "در حال محاسبه…" : "Computing…") : <><Icon name="brain" size={15} /> {fa ? "محاسبهٔ پارامترهای بهینه" : "Compute optimized parameters"}</>}
        </button>
      </div>

      {result && (
        <div className="card mt16">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>{fa ? "نتیجهٔ بهینه‌سازی" : "Optimization result"}</div>
          <div className="grid grid-2">
            <div className="tag" style={{ padding: 10 }}>{fa ? "log-loss فعلی" : "Current log-loss"}: <b>{result.currentEval.logloss}</b></div>
            <div className="tag" style={{ padding: 10, background: result.improved ? "#e7f7ef" : undefined }}>{fa ? "log-loss پیشنهادی" : "Proposed log-loss"}: <b>{result.proposedEval.logloss}</b> {result.improved && <span style={{ color: "#12805a" }}>✓ {fa ? "بهتر" : "better"}</span>}</div>
          </div>
          <div className="small muted mt8">{fa ? "پارامترهای پیشنهادی:" : "Proposed parameters:"}</div>
          <code style={{ display: "block", background: "var(--panel3, #f4f7fb)", borderRadius: 8, padding: 10, fontSize: ".72rem", overflowX: "auto", direction: "ltr", textAlign: "left", marginTop: 4 }}>
            [{result.proposed.join(", ")}]
          </code>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" onClick={apply} disabled={!result.improved && false}>
              <Icon name="check" size={15} /> {fa ? "اعمال این پارامترها" : "Apply these parameters"}
            </button>
            <button className="btn btn-ghost" onClick={() => setResult(null)}>{fa ? "انصراف" : "Cancel"}</button>
          </div>
          {!result.improved && <div className="small muted mt8">{fa ? "توجه: پارامترهای پیشنهادی بهتر از فعلی نبودند؛ می‌توانید همان فعلی را نگه دارید." : "Note: the proposal wasn't better than current; you may keep the current parameters."}</div>}
        </div>
      )}
    </div>
  );
}

/* ---- Gamification config: tune Streak Wager, Monthly Quest, XP Ramp-Up
   event, Streak Revival, and rewarded-ad rewards. Every knob is admin-editable. */
function GamificationConfig() {
  const { t, lang } = useApp();
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  useEffect(() => { api.get("/admin/game-config").then((d) => setCfg(d.config)).catch(() => setCfg(null)); }, []);
  if (!cfg) return <Spinner />;
  const set = (group, key, val) => setCfg({ ...cfg, [group]: { ...cfg[group], [key]: val } });
  const num = (group, key) => (v) => set(group, key, Number(v) || 0);
  const save = async () => { try { await api.put("/admin/game-config", { config: cfg }); toast(t("save")); } catch { toast("Error"); } };

  const F = (label, group, key, type = "number") => (
    <div className="field"><label>{label}</label>
      <input type={type} value={cfg[group][key] ?? ""} onChange={(e) => type === "number" ? num(group, key)(e.target.value) : set(group, key, e.target.value)} /></div>
  );
  const Toggle = (label, group) => (
    <label className="toggle-row"><span><Icon name="check" size={15} /> {label}</span>
      <input type="checkbox" checked={!!cfg[group].enabled} onChange={(e) => set(group, "enabled", e.target.checked)} /></label>
  );

  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="bolt" size={18} /> {t("gamification")}</h4>
        <button className="btn btn-primary btn-sm" onClick={save}><Icon name="check" size={14} /> {t("save")}</button></div>
      <div className="muted small mb16">{lang === "fa" ? "این تنظیمات، مکانیزم‌های انگیزشی سایت را کنترل می‌کنند. هر مقدار را می‌توانید تغییر دهید یا هر مکانیزم را خاموش کنید." : "Control the platform's motivation mechanics. Every value is editable and each mechanic can be turned off."}</div>

      <div className="card mb16">
        <div className="section-title"><h4>❤️ {lang === "fa" ? "قلب‌ها (جان کاربران معمولی)" : "Hearts (lives for free learners)"}</h4></div>
        <div className="muted small mb8">{lang === "fa" ? "کاربر پریمیوم قلب نامحدود دارد. تغییرات بلافاصله اعمال می‌شود؛ اگر سقف را بالا ببرید، نوار کاربران پر می‌شود." : "Premium learners have unlimited hearts. Changes apply immediately; raising the cap tops everyone up."}</div>
        <div className="grid grid-3 mt8">
          {F(lang === "fa" ? "حداکثر قلب" : "Max hearts", "hearts", "max")}
          {F(lang === "fa" ? "هر چند دقیقه یک قلب" : "Minutes per heart", "hearts", "refill_minutes")}
          {F(lang === "fa" ? "هزینهٔ پرکردن فوری (جم)" : "Instant refill cost (gems)", "hearts", "refill_gems")}
        </div>
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>🎲 {t("streakWager")}</h4></div>
        {Toggle(lang === "fa" ? "فعال باشد" : "Enabled", "wager")}
        <div className="grid grid-3 mt8">
          {F(lang === "fa" ? "تعداد روز هدف" : "Target days", "wager", "target_days")}
          {F(lang === "fa" ? "جم شرط" : "Stake (gems)", "wager", "stake")}
          {F(lang === "fa" ? "جایزه (جم)" : "Reward (gems)", "wager", "reward")}
        </div>
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>🏅 {t("monthlyQuest")}</h4></div>
        {Toggle(lang === "fa" ? "فعال باشد" : "Enabled", "monthly")}
        <div className="grid grid-2 mt8">
          {F(lang === "fa" ? "تعداد کوئست ماهانه" : "Quests per month", "monthly", "goal")}
          {F(lang === "fa" ? "جایزه (جم)" : "Reward (gems)", "monthly", "reward_gems")}
        </div>
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>⚡ {t("rampEvent")}</h4></div>
        {Toggle(lang === "fa" ? "فعال باشد" : "Enabled", "event")}
        <div className="grid grid-2 mt8">
          {F(lang === "fa" ? "عنوان (فا)" : "Title (fa)", "event", "title_fa", "text")}
          {F(lang === "fa" ? "عنوان (en)" : "Title (en)", "event", "title_en", "text")}
        </div>
        <div className="grid grid-2">
          {F(lang === "fa" ? "تعداد سوال" : "Questions", "event", "questions")}
          {F(lang === "fa" ? "مدت (ثانیه)" : "Duration (s)", "event", "duration_s")}
        </div>
        <div className="grid grid-2">
          {F(lang === "fa" ? "XP هر پاسخ درست" : "XP per correct", "event", "xp_per_correct")}
          {F(lang === "fa" ? "پاداش بی‌نقص" : "Flawless bonus", "event", "bonus_all_correct")}
        </div>
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>💫 {t("revivalTitle")}</h4></div>
        {Toggle(lang === "fa" ? "فعال باشد" : "Enabled", "revival")}
        <div className="grid grid-2 mt8">
          {F(lang === "fa" ? "حداقل استریک ازدست‌رفته" : "Min lost streak", "revival", "min_streak")}
          {F(lang === "fa" ? "تعداد درس برای احیا" : "Lessons to revive", "revival", "lessons_required")}
        </div>
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>🎁 {lang === "fa" ? "جایزهٔ تبلیغ ویدیویی" : "Rewarded ad rewards"}</h4></div>
        <div className="grid grid-3 mt8">
          {F(lang === "fa" ? "جم هر تماشا" : "Gems per view", "ads", "rewarded_gems")}
          {F(lang === "fa" ? "سقف روزانه" : "Daily cap", "ads", "daily_reward_cap")}
          {F(lang === "fa" ? "جم اسپانسر پیش‌درس" : "Pre-lesson gems", "ads", "prelesson_gems")}
        </div>
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>📊 {lang === "fa" ? "مقایسه با همتایان و امکانات ویژهٔ پرمیوم (دور ۹)" : "Peer benchmark & premium extras (round 9)"}</h4></div>
        <div className="small muted mb8">{lang === "fa"
          ? "الگو: UWorld / AMBOSS / مدوفست / Duolingo. آمار گزینه‌ها برای همه رایگان است (آموزشی است)؛ صدک، گزارش روزانه، راهنمایی و فلش‌کارت یک‌ضربه‌ای ویژهٔ پرمیوم‌اند. هر قابلیت را می‌توانید جداگانه خاموش کنید."
          : "Modelled on UWorld / AMBOSS / Medofast / Duolingo. Option stats are free for everyone (they teach); percentile, daily report, hints and one-tap flashcards are premium. Each feature can be switched off separately."}</div>
        {(() => {
          const T = (label, key, hint) => (
            <label className="toggle-row"><span><Icon name="check" size={15} /> {label}{hint && <span className="small muted"> — {hint}</span>}</span>
              <input type="checkbox" checked={cfg.peer?.[key] !== false} onChange={(e) => set("peer", key, e.target.checked)} /></label>
          );
          const fa = lang === "fa";
          return (
            <>
              {T(fa ? "شناسنامهٔ سؤال (درصد انتخاب هر گزینه + میانگین زمان)" : "Question stats (option pick % + avg time)", "option_stats", fa ? "رایگان" : "free")}
              {T(fa ? "صدک و مقایسهٔ زمان با همتایان در کارنامهٔ شبیه‌ساز/آزمون‌ساز" : "Percentile & time-vs-peers on exam-sim / custom-test result", "percentile", "👑")}
              {T(fa ? "گزارش روزانهٔ عملکرد در صفحهٔ اصلی" : "Daily performance report on home", "daily_report", "👑")}
              {T(fa ? "راهنمایی استاد قبل از پاسخ" : "Pre-answer Attending hint", "hint", fa ? "👑 (کاربر رایگان با جم)" : "👑 (free users pay gems)")}
              {T(fa ? "ذخیرهٔ یک‌ضربه‌ای سؤال به‌عنوان فلش‌کارت شخصی" : "One-tap save question as personal flashcard", "save_flashcard", "👑")}
              {T(fa ? "پرش از واحد (آزمون کوتاه برای باز کردن کل واحد)" : "Jump ahead (short quiz unlocks the whole unit)", "jump_ahead")}
              <label className="toggle-row"><span><Icon name="crown" size={15} /> {fa ? "پرش از واحد فقط برای پرمیوم" : "Jump ahead premium-only"}</span>
                <input type="checkbox" checked={!!cfg.peer?.jump_premium_only} onChange={(e) => set("peer", "jump_premium_only", e.target.checked)} /></label>
              <div className="grid grid-3 mt8">
                {F(fa ? "حداقل پاسخ برای نمایش آمار گزینه‌ها" : "Min answers for option stats", "peer", "option_stats_min")}
                {F(fa ? "حداقل شرکت‌کننده برای صدک" : "Min peers for percentile", "peer", "percentile_min")}
                {F(fa ? "هزینهٔ راهنمایی برای کاربر رایگان (جم؛ ۰ = فقط پرمیوم)" : "Hint cost for free users (gems; 0 = premium only)", "peer", "hint_gems")}
              </div>
              <div className="grid grid-3">
                {F(fa ? "تعداد سؤال آزمون پرش" : "Jump quiz questions", "peer", "jump_questions")}
                {F(fa ? "حداقل درصد قبولی پرش" : "Jump pass %", "peer", "jump_pass")}
                {F(fa ? "روزهای پرمیوم هدیه در نقاط عطف استریک (۰ = خاموش)" : "Free premium days at streak milestones (0 = off)", "peer", "trial_days")}
              </div>
              <div className="field"><label>{fa ? "نقاط عطف استریک برای هدیهٔ پرمیوم (با ویرگول)" : "Streak milestones for the premium gift (comma-separated)"}</label>
                <input type="text" value={(cfg.peer?.trial_milestones || []).join(",")} onChange={(e) => set("peer", "trial_milestones", e.target.value.split(/[,، ]+/).map((x) => parseInt(x, 10)).filter((n) => n > 0))} /></div>
            </>
          );
        })()}
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>🤝 {lang === "fa" ? "چالش دوستانه" : "Friend Quest"}</h4></div>
        <div className="small muted mb8">{lang === "fa" ? "برای فعال/غیرفعال‌کردن کل سیستم دوستان، به «پرچم‌های قابلیت» بروید." : "To turn the whole friends system on/off, use Feature Flags → Friends."}</div>
        <div className="grid grid-3">
          {F(lang === "fa" ? "هدف XP هفتگی" : "Weekly XP goal", "friends", "quest_goal")}
          {F(lang === "fa" ? "جایزهٔ هر نفر (جم)" : "Reward each (gems)", "friends", "quest_reward")}
          {F(lang === "fa" ? "حداکثر استریک دوستانه" : "Max friend streaks", "friends", "max_streaks")}
        </div>
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>👑 {lang === "fa" ? "درس‌های افسانه‌ای" : "Legendary levels"}</h4></div>
        {Toggle(lang === "fa" ? "فعال باشد" : "Enabled", "legendary")}
        <div className="grid grid-3 mt8">
          {F(lang === "fa" ? "هزینهٔ جم (رایگان برای پریمیوم)" : "Gem cost (free for premium)", "legendary", "cost_gems")}
          {F(lang === "fa" ? "درصد قبولی لازم" : "Pass ratio (%)", "legendary", "pass_ratio")}
          {F(lang === "fa" ? "XP جایزه" : "XP reward", "legendary", "xp_reward")}
        </div>
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>💎 {lang === "fa" ? "تورنمنت الماس" : "Diamond Tournament"}</h4></div>
        {Toggle(lang === "fa" ? "فعال باشد" : "Enabled", "tournament")}
        <div className="grid grid-2 mt8">
          {F(lang === "fa" ? "تعداد صعودکننده هر مرحله" : "Advance per stage", "tournament", "advance")}
          {F(lang === "fa" ? "دقیقهٔ بوست فینالیست‌ها" : "Finalist boost (min)", "tournament", "boost_minutes")}
        </div>
        <div className="small muted">{lang === "fa" ? "جوایز جم سکوی فینال (رتبهٔ ۱، ۲، ۳) در تنظیمات پیشرفته قابل ویرایش است." : "Finals podium gems (ranks 1,2,3) are set in advanced config."}</div>
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>🧠 {lang === "fa" ? "الگوریتم مرور (FSRS)" : "Review algorithm (FSRS)"}</h4></div>
        <div className="small muted mb8">{lang === "fa" ? "FSRS-۶ مدل حافظهٔ سه‌مؤلفه‌ای (سختی/پایداری/بازیابی) است و نسبت به SM-2 حدود ۲۰ تا ۳۰٪ مرور کمتر برای همان سطح ماندگاری لازم دارد." : "FSRS-6 is a three-component memory model (difficulty/stability/retrievability) needing ~20–30% fewer reviews than SM-2 for the same retention."}</div>
        <div className="field"><label>{lang === "fa" ? "الگوریتم زمان‌بندی" : "Scheduler"}</label>
          <select value={cfg.srs.scheduler} onChange={(e) => set("srs", "scheduler", e.target.value)}>
            <option value="fsrs">{lang === "fa" ? "FSRS-۶ (پیشنهادی)" : "FSRS-6 (recommended)"}</option>
            <option value="sm2">{lang === "fa" ? "SM-2 (قدیمی)" : "SM-2 (legacy)"}</option>
          </select>
        </div>
        <div className="grid grid-2">
          <div className="field"><label>{lang === "fa" ? "ماندگاری هدف (۰.۸ تا ۰.۹۷)" : "Desired retention (0.8–0.97)"}</label>
            <input type="number" step="0.01" min="0.8" max="0.97" value={cfg.srs.desired_retention}
              onChange={(e) => set("srs", "desired_retention", Math.min(0.97, Math.max(0.8, Number(e.target.value) || 0.9)))} /></div>
          {F(lang === "fa" ? "حداکثر فاصله (روز)" : "Maximum interval (days)", "srs", "maximum_interval")}
        </div>
        <div className="small muted">{lang === "fa" ? "ماندگاری بالاتر = مرور بیشتر (رابطه غیرخطی؛ نقطهٔ بهینه ۸۵ تا ۹۲٪). ۲۱ پارامتر FSRS با مقادیر پیش‌فرض Anki تنظیم شده و در تنظیمات پیشرفته قابل تغییر است." : "Higher retention = more reviews (nonlinear; sweet spot 85–92%). The 21 FSRS parameters use Anki's defaults and are editable in advanced config."}</div>

        <div className="section-title mt16"><h4>🔄 {lang === "fa" ? "مرور تجمعی در درس (درهم‌آمیزی)" : "Cumulative in-lesson review (interleaving)"}</h4></div>
        <div className="small muted mb8">{lang === "fa" ? "هنگام شروع هر درس، چند سوال از درس‌های قبلیِ همان دوره که موعد مرورشان رسیده، به‌صورت درهم‌آمیخته اضافه می‌شود. این کار مبتنی بر شواهد آموزش پزشکی است: تمایز بین بیماری‌های شبیه را تقویت می‌کند و با منحنی فراموشی مبارزه می‌کند. ۰ = خاموش." : "When a lesson starts, a few DUE questions from earlier lessons of the same course are blended in. This is evidence-based for medical education: it strengthens discrimination between similar diseases and fights the forgetting curve. 0 = off."}</div>
        <div className="grid grid-2">
          {F(lang === "fa" ? "حداکثر سوال مرور در هر درس" : "Max review cards per lesson", "srs", "interleave_max")}
          <div className="field"><label>{lang === "fa" ? "جایگاه سوالات مرور" : "Review card position"}</label>
            <select value={cfg.srs.interleave_position || "spread"} onChange={(e) => set("srs", "interleave_position", e.target.value)}>
              <option value="spread">{lang === "fa" ? "پخش‌شده (درهم‌آمیخته)" : "Spread (interleaved)"}</option>
              <option value="end">{lang === "fa" ? "در انتهای درس" : "At the end"}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>🎯 {lang === "fa" ? "کالیبراسیون خودکار دشواری + دکتر مِد" : "Adaptive difficulty + Dr. Med guide"}</h4></div>
        {Toggle(lang === "fa" ? "فعال باشد" : "Enabled", "calibration")}
        <div className="small muted mb8">{lang === "fa"
          ? "بر پایهٔ «چارچوب نقطهٔ چالش» (Challenge Point Framework) در آموزش پزشکی: سطح مهارت هر کاربر از دقت و سرعت پاسخ‌هایش تخمین زده می‌شود و کارت‌های هر درس طوری مرتب می‌شوند که کاربر در «منطقهٔ چالش بهینه» بماند (نه خیلی آسان، نه طاقت‌فرسا). راهنمای پزشکی «دکتر مِد» هم بر همین اساس پیام‌های دلگرم‌کننده و تطبیقی می‌دهد. کاملاً بدون هوش مصنوعی. برای خاموش‌کردن کامل، پرچم «کالیبراسیون خودکار» را هم تنظیم کنید."
          : "Based on the Challenge Point Framework in medical education: each learner's ability is estimated from their answer accuracy + speed, and lesson cards are ordered to keep them in their optimal challenge zone (not too easy, not overwhelming). The 'Dr. Med' guide gives adaptive encouragement on the same basis. Fully AI-free. Also toggle the Calibration feature flag for a full on/off."}</div>
        <div className="grid grid-3">
          <div className="field"><label>{lang === "fa" ? "هدف موفقیت (٪)" : "Target success (%)"}</label>
            <input type="number" min="50" max="95" value={Math.round((cfg.calibration?.target_success ?? 0.78) * 100)}
              onChange={(e) => set("calibration", "target_success", Math.min(0.95, Math.max(0.5, (Number(e.target.value) || 78) / 100)))} /></div>
          <div className="field"><label>{lang === "fa" ? "پهنای منطقه (٪)" : "Zone width (%)"}</label>
            <input type="number" min="3" max="25" value={Math.round((cfg.calibration?.zone_width ?? 0.12) * 100)}
              onChange={(e) => set("calibration", "zone_width", Math.min(0.25, Math.max(0.03, (Number(e.target.value) || 12) / 100)))} /></div>
          {F(lang === "fa" ? "تعداد پاسخ اخیر (پنجره)" : "Recent answers (window)", "calibration", "window_answers")}
        </div>
        <div className="grid grid-3 mt8">
          {F(lang === "fa" ? "حداقل پاسخ برای کالیبره" : "Min answers to calibrate", "calibration", "min_answers")}
          {F(lang === "fa" ? "آستانهٔ پاسخ کند (میلی‌ثانیه)" : "Slow-answer threshold (ms)", "calibration", "slow_ms")}
          <label className="toggle-row" style={{ alignSelf: "end" }}><span>{lang === "fa" ? "گرم‌کردن (شروع آسان‌تر)" : "Ease-in (start easier)"}</span>
            <input type="checkbox" checked={cfg.calibration?.ease_in !== false} onChange={(e) => set("calibration", "ease_in", e.target.checked)} /></label>
        </div>
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>🎓 {lang === "fa" ? "آزمون Checkpoint بخش (تجمعی)" : "Section Checkpoint exam (cumulative)"}</h4></div>
        {Toggle(lang === "fa" ? "فعال باشد" : "Enabled", "checkpoint")}
        <div className="small muted mb8">{lang === "fa"
          ? "آزمون جامعِ هر بخش (گروه والدِ موضوعات، مثل «دروس داخلی»): سوال‌ها از همهٔ درس‌های آن بخش با هم ترکیب می‌شوند تا مثل آزمون جامع (Shelf) توانایی تمایز بین بیماری‌های مشابه سنجیده شود. مبتنی بر شواهد: آزمون تجمعی، ماندگاری بلندمدت را افزایش می‌دهد. برای خاموش‌کردن کامل، پرچم «آزمون Checkpoint» را هم تنظیم کنید."
          : "A comprehensive exam per section (topic parent group, e.g. 'Internal Medicine') that mixes questions from every lesson in that section — like an NBME subject/shelf exam — to test discrimination between similar diseases. Evidence-based: cumulative testing lifts long-term retention. Also toggle the Checkpoint feature flag for a full on/off."}</div>
        <div className="grid grid-3">
          {F(lang === "fa" ? "تعداد سوال" : "Questions", "checkpoint", "question_count")}
          <div className="field"><label>{lang === "fa" ? "حد قبولی (٪)" : "Pass threshold (%)"}</label>
            <input type="number" min="30" max="100" value={Math.round((cfg.checkpoint?.pass_ratio ?? 0.7) * 100)}
              onChange={(e) => set("checkpoint", "pass_ratio", Math.min(1, Math.max(0.3, (Number(e.target.value) || 70) / 100)))} /></div>
          <div className="field"><label>{lang === "fa" ? "درصد باز شدن (٪)" : "Unlock at (%)"}</label>
            <input type="number" min="0" max="100" value={Math.round((cfg.checkpoint?.unlock_ratio ?? 0.6) * 100)}
              onChange={(e) => set("checkpoint", "unlock_ratio", Math.min(1, Math.max(0, (Number(e.target.value) || 60) / 100)))} /></div>
        </div>
        <div className="grid grid-3 mt8">
          {F(lang === "fa" ? "حداقل درس کامل‌شده" : "Min lessons done", "checkpoint", "min_nodes")}
          {F(lang === "fa" ? "سقف سوال از هر موضوع" : "Max Qs per topic", "checkpoint", "per_topic_cap")}
          {F(lang === "fa" ? "زمان هر سوال (ثانیه، ۰=بی‌زمان)" : "Sec/question (0=untimed)", "checkpoint", "time_per_q")}
        </div>
        <div className="grid grid-3 mt8">
          {F(lang === "fa" ? "XP قبولی" : "Pass XP", "checkpoint", "xp_reward")}
          {F(lang === "fa" ? "XP تلاش ناموفق" : "Retry XP", "checkpoint", "xp_retry")}
          {F(lang === "fa" ? "فاصلهٔ بین آزمون‌ها (ساعت)" : "Cooldown (hours)", "checkpoint", "cooldown_hours")}
        </div>
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>🏅 {lang === "fa" ? "نشان‌های تسلط بر مبحث" : "Topic Mastery Badges"}</h4></div>
        {Toggle(lang === "fa" ? "فعال باشد" : "Enabled", "mastery")}
        <div className="small muted mb8">{lang === "fa"
          ? "بر پایهٔ «یادگیری تسلط‌محورِ بلوم» (Bloom's Mastery Learning): کاربر وقتی روی یک مبحث «نشان تسلط» می‌گیرد که هم دقتِ بالا (پیش‌فرض ۹۰٪، معیار کلاسیک) روی کارت‌های آن مبحث داشته باشد و هم حافظه‌اش پایدار باشد (بخشی از کارت‌ها در تکرار فاصله‌دار به بلوغ رسیده باشند) — تا یک نمرهٔ لحظه‌ای/حفظِ موقت نشان ندهد. کاملاً قطعی و بدون هوش مصنوعی. برای خاموش‌کردن کامل، پرچم «نشان‌های تسلط» را هم تنظیم کنید."
          : "Based on Bloom's Mastery Learning: a learner earns a topic's mastery badge only when they show BOTH high accuracy (default 90%, the classic criterion) on that topic's cards AND durable memory (a share of the cards are SRS-mature) — so a lucky quiz or a fresh cram won't grant it. Fully deterministic, AI-free. Also toggle the Mastery feature flag for a full on/off."}</div>
        <div className="grid grid-3">
          <div className="field"><label>{lang === "fa" ? "دقت لازم (٪)" : "Accuracy required (%)"}</label>
            <input type="number" min="50" max="100" value={cfg.mastery?.accuracy ?? 90}
              onChange={(e) => set("mastery", "accuracy", Math.min(100, Math.max(50, Number(e.target.value) || 90)))} /></div>
          {F(lang === "fa" ? "حداقل کارت پاسخ‌داده" : "Min answered cards", "mastery", "min_answers")}
          <label className="toggle-row" style={{ alignSelf: "end" }}><span>{lang === "fa" ? "نیاز به حافظهٔ پایدار" : "Require durable memory"}</span>
            <input type="checkbox" checked={cfg.mastery?.require_retention !== false} onChange={(e) => set("mastery", "require_retention", e.target.checked)} /></label>
        </div>
        <div className="grid grid-3 mt8">
          {F(lang === "fa" ? "بلوغ کارت (روز پایداری)" : "Card maturity (stability days)", "mastery", "mature_days")}
          <div className="field"><label>{lang === "fa" ? "سهم کارت‌های بالغ (٪)" : "Mature cards share (%)"}</label>
            <input type="number" min="0" max="100" value={Math.round((cfg.mastery?.mature_ratio ?? 0.6) * 100)}
              onChange={(e) => set("mastery", "mature_ratio", Math.min(1, Math.max(0, (Number(e.target.value) || 60) / 100)))} /></div>
          <div />
        </div>
        <div className="grid grid-3 mt8">
          {F(lang === "fa" ? "پاداش XP (یک‌بار)" : "Reward XP (once)", "mastery", "reward_xp")}
          {F(lang === "fa" ? "پاداش جم (یک‌بار)" : "Reward gems (once)", "mastery", "reward_gems")}
          <div />
        </div>
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>🌿 {lang === "fa" ? "حالت آرام (ضدِ فرسودگی)" : "Calm Mode (anti-burnout)"}</h4></div>
        {Toggle(lang === "fa" ? "فعال باشد" : "Enabled", "calm")}
        <div className="small muted mb8">{lang === "fa"
          ? "فرسودگیِ دانشجوی پزشکی شایع است و «اضطرابِ استریک» و انبوه‌شدنِ صفِ مرور از عواملِ اصلی آن‌اند. «حالت آرام» یک انتخابِ کاربر است که محافظ‌های انسانی را روشن می‌کند: سقفِ روزانهٔ مرور، روزهای استراحتِ بدونِ ازدست‌دادنِ استریک، پنهان‌کردنِ استریک و انصراف از لیگ. این‌ها پیش‌فرض‌هایی هستند که کاربر می‌تواند برای خودش تنظیم کند. قطعی و بدون هوش مصنوعی. برای خاموش‌کردن کامل، پرچم «حالت آرام» را هم تنظیم کنید."
          : "Medical-student burnout is common, driven partly by streak anxiety and an overwhelming review pile. Calm Mode is a learner opt-in that turns on humane guardrails: a daily review cap, guilt-free rest days that keep the streak, a hidden streak, and opting out of leagues. These are the defaults a learner can set for themselves. Deterministic, AI-free. Also toggle the Calm Mode feature flag for a full on/off."}</div>
        <div className="grid grid-3">
          {F(lang === "fa" ? "سقف پیش‌فرض مرور/روز" : "Default review cap/day", "calm", "default_review_cap")}
          {F(lang === "fa" ? "کمینهٔ سقف مرور" : "Min review cap", "calm", "min_review_cap")}
          {F(lang === "fa" ? "بیشینهٔ سقف مرور" : "Max review cap", "calm", "max_review_cap")}
        </div>
        <div className="grid grid-3 mt8">
          {F(lang === "fa" ? "روز استراحت در هفته" : "Rest days per week", "calm", "rest_days_per_week")}
          <label className="toggle-row" style={{ alignSelf: "end" }}><span>{lang === "fa" ? "نمایش پیام سلامت روان" : "Show wellbeing tips"}</span>
            <input type="checkbox" checked={cfg.calm?.show_wellbeing_tips !== false} onChange={(e) => set("calm", "show_wellbeing_tips", e.target.checked)} /></label>
          <div />
        </div>
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>🕶️ {lang === "fa" ? "حالت ناشناس در رتبه‌بندی" : "Anonymous ranking"}</h4></div>
        {Toggle(lang === "fa" ? "فعال باشد" : "Enabled", "anon")}
        <div className="small muted mb8">{lang === "fa"
          ? "پژوهش‌ها نشان می‌دهند نمایشِ نامِ مستعار، اضطرابِ رتبه‌بندی را کم می‌کند و درعین‌حال انگیزهٔ رقابت را حفظ می‌کند (به‌ویژه برای کاربرانِ رتبه‌پایین که «حفظِ آبرو» برایشان مهم است). کاربر با روشن‌کردنِ این حالت، برای دیگران با نامِ مستعار دیده می‌شود ولی رتبه و نامِ واقعیِ خودش را می‌بیند. پایین، «مخزنِ نام‌های مستعار» را که وقتی کاربر نامی انتخاب نکند به‌صورتِ خودکار تخصیص می‌یابد ویرایش کنید (با کاما جدا کنید). برای خاموش‌کردن کامل، پرچمِ «حالت ناشناس در رتبه‌بندی» را هم تنظیم کنید."
          : "Research shows pseudonyms reduce leaderboard anxiety while keeping the motivation to compete (especially for lower-ranked learners who value 'saving face'). When a learner turns this on, they appear under a pseudonym to others but still see their own rank and real name. Below, edit the alias pool auto-assigned when a learner doesn't pick a name (comma-separated). Also toggle the Anonymous ranking feature flag for a full on/off."}</div>
        <div className="field"><label>{lang === "fa" ? "مخزن نام‌های مستعار (فارسی)" : "Alias pool (Persian)"}</label>
          <input value={(cfg.anon?.alias_pool_fa || []).join("، ")}
            onChange={(e) => set("anon", "alias_pool_fa", e.target.value.split(/[،,]/).map((x) => x.trim()).filter(Boolean))} /></div>
        <div className="field"><label>{lang === "fa" ? "مخزن نام‌های مستعار (انگلیسی)" : "Alias pool (English)"}</label>
          <input value={(cfg.anon?.alias_pool_en || []).join(", ")}
            onChange={(e) => set("anon", "alias_pool_en", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /></div>
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>🧭 {lang === "fa" ? "آزمون تعیین سطح ورودی" : "Entry placement test"}</h4></div>
        {Toggle(lang === "fa" ? "فعال باشد" : "Enabled", "placement")}
        <div className="small muted mb8">{lang === "fa" ? "یک آزمون کوتاه و کم‌استرس که به کاربرِ آشنا کمک می‌کند از جای درست شروع کند. اختیاری است و کاربر می‌تواند ردش کند. برای خاموش‌کردن کامل، پرچم «آزمون تعیین سطح» را هم تنظیم کنید." : "A short, low-stakes quiz that helps a knowledgeable learner start at the right place. Optional and skippable."}</div>

        {/* how it's OFFERED */}
        <div className="field"><label>{lang === "fa" ? "نحوهٔ نمایش" : "Offer mode"}</label>
          <select value={cfg.placement?.mode || "optional"} onChange={(e) => set("placement", "mode", e.target.value)}>
            <option value="optional">{lang === "fa" ? "پیشنهاد ملایم (کارت قابل‌رد در خانه)" : "Soft offer (dismissible card)"}</option>
            <option value="prompt">{lang === "fa" ? "یک‌بار پرسیده شود (قابل رد)" : "Prompt once (skippable)"}</option>
            <option value="off">{lang === "fa" ? "نمایش داده نشود" : "Do not offer"}</option>
          </select></div>

        <div className="grid grid-2">
          {F(lang === "fa" ? "تعداد سوال" : "Questions", "placement", "questions")}
          {F(lang === "fa" ? "آستانهٔ «قوی» (٪)" : "Strong threshold (%)", "placement", "strong_accuracy")}
        </div>

        {/* what happens on a STRONG topic */}
        <div className="field"><label>{lang === "fa" ? "رفتار در موضوع قوی (پرش به جلو)" : "On a strong topic"}</label>
          <select value={cfg.placement?.skip_behavior || "unlock"} onChange={(e) => set("placement", "skip_behavior", e.target.value)}>
            <option value="unlock">{lang === "fa" ? "فقط قفلش را باز کن (صادقانه‌تر)" : "Unlock the topic (honest)"}</option>
            <option value="mark_done">{lang === "fa" ? "اولین درس را تکمیل‌شده ثبت کن" : "Auto-complete first lesson"}</option>
            <option value="off">{lang === "fa" ? "کاری نکن (فقط گزارش سطح)" : "Do nothing (report only)"}</option>
          </select>
          <div className="small muted mt4">{lang === "fa" ? "«فقط بازکردن» درس‌های موضوع را باز می‌کند بدون ستارهٔ جعلی؛ کاربر خودش انجام می‌دهد." : "\"Unlock\" opens the topic's lessons without fake stars — the learner still does them."}</div>
        </div>

        <label className="toggle-row"><span>{lang === "fa" ? "کاربر بتواند پیشنهاد را رد/مخفی کند" : "Learner can dismiss the offer"}</span>
          <input type="checkbox" checked={cfg.placement?.dismissible !== false} onChange={(e) => set("placement", "dismissible", e.target.checked)} /></label>
        <label className="toggle-row"><span>{lang === "fa" ? "اجازهٔ آزمون مجدد" : "Allow retake"}</span>
          <input type="checkbox" checked={cfg.placement?.allow_retake !== false} onChange={(e) => set("placement", "allow_retake", e.target.checked)} /></label>

        {/* --- Adaptive mode --- */}
        <div className="divider" />
        <label className="toggle-row"><span>{lang === "fa" ? "آزمون تطبیقی (سختی بر اساس پاسخ‌ها)" : "Adaptive (difficulty follows answers)"}</span>
          <input type="checkbox" checked={!!cfg.placement?.adaptive} onChange={(e) => set("placement", "adaptive", e.target.checked)} /></label>
        <div className="small muted mb8">{lang === "fa" ? "وقتی روشن باشد، سوال‌ها یکی‌یکی می‌آیند و بعد از پاسخ درست سخت‌تر و بعد از پاسخ غلط آسان‌تر می‌شوند تا سطح دقیق‌تر سنجیده شود." : "When on, questions come one at a time; harder after a correct answer, easier after a wrong one — for a sharper level estimate."}</div>
        {cfg.placement?.adaptive && (
          <div className="field"><label>{lang === "fa" ? "سختی سوال اول" : "Starting difficulty"}</label>
            <select value={cfg.placement?.adaptive_start || "medium"} onChange={(e) => set("placement", "adaptive_start", e.target.value)}>
              <option value="easy">{lang === "fa" ? "آسان" : "Easy"}</option>
              <option value="medium">{lang === "fa" ? "متوسط" : "Medium"}</option>
              <option value="hard">{lang === "fa" ? "سخت" : "Hard"}</option>
            </select></div>
        )}

        {/* editable copy (tone control) */}
        <div className="divider" />
        <div className="small muted mb8">{lang === "fa" ? "متنِ دعوت و مقدمه (خالی = متن پیش‌فرض). لحن را خودتان تعیین کنید." : "Offer & intro copy (blank = default)."}</div>
        <div className="grid grid-2">
          {F(lang === "fa" ? "متن دعوت (فارسی)" : "Offer text (FA)", "placement", "offer_fa", "text")}
          {F(lang === "fa" ? "متن دعوت (انگلیسی)" : "Offer text (EN)", "placement", "offer_en", "text")}
        </div>
        <div className="grid grid-2">
          {F(lang === "fa" ? "متن مقدمه (فارسی)" : "Intro text (FA)", "placement", "intro_fa", "text")}
          {F(lang === "fa" ? "متن مقدمه (انگلیسی)" : "Intro text (EN)", "placement", "intro_en", "text")}
        </div>
      </div>

      <div className="card mb16">
        <div className="section-title"><h4>🚀 {lang === "fa" ? "چک‌لیست شروع (آنبوردینگ)" : "Onboarding checklist"}</h4></div>
        {Toggle(lang === "fa" ? "فعال باشد" : "Enabled", "onboarding")}
        <div className="small muted mb8">{lang === "fa" ? "چک‌لیست کوتاه برای کاربران تازه؛ با تکمیل کامل، جایزهٔ جم می‌گیرند. برای روشن/خاموش کامل، پرچم «آنبوردینگ» را هم تنظیم کنید." : "A short getting-started checklist for new learners; completing it grants gems. Also toggle the Onboarding feature flag for a full on/off."}</div>
        {F(lang === "fa" ? "جایزهٔ تکمیل (جم)" : "Completion reward (gems)", "onboarding", "reward_gems")}
        <div className="grid grid-2 mt8">
          {["first_lesson", "set_goal", "first_review", "explore"].map((k) => (
            <label key={k} className="toggle-row">
              <span>{lang === "fa"
                ? { first_lesson: "اولین درس", set_goal: "انتخاب هدف روزانه", first_review: "اولین مرور", explore: "کشف یک ابزار" }[k]
                : { first_lesson: "First lesson", set_goal: "Set daily goal", first_review: "First review", explore: "Explore a tool" }[k]}</span>
              <input type="checkbox" checked={cfg.onboarding?.steps?.[k] !== false}
                onChange={(e) => setCfg({ ...cfg, onboarding: { ...cfg.onboarding, steps: { ...(cfg.onboarding?.steps || {}), [k]: e.target.checked } } })} />
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-title"><h4>🎯 {lang === "fa" ? "تمرین هوشمند نقاط ضعف" : "Smart weak-area practice"}</h4></div>
        {Toggle(lang === "fa" ? "فعال باشد" : "Enabled", "practice")}
        <div className="small muted mb8">{lang === "fa" ? "برای روشن/خاموش‌کردن کامل، پرچم «هاب تمرین هوشمند» را در «پرچم‌های قابلیت» تنظیم کنید." : "To fully enable/disable, use Feature Flags → Smart practice hub."}</div>
        <div className="grid grid-3 mt8">
          {F(lang === "fa" ? "تعداد سوال هر جلسه" : "Questions per session", "practice", "session_size")}
          {F(lang === "fa" ? "حداقل پاسخ برای «ضعیف»" : "Min answers for weak", "practice", "min_answers")}
          {F(lang === "fa" ? "آستانهٔ دقت ضعف (٪)" : "Weak accuracy (%)", "practice", "weak_accuracy")}
        </div>
        {F(lang === "fa" ? "XP هر پاسخ درست" : "XP per correct", "practice", "xp_per_correct")}
      </div>

      <div className="card mt16">
        <div className="section-title"><h4>📲 {lang === "fa" ? "اپ موبایلی (نصب روی گوشی / PWA)" : "Mobile app (install / PWA)"}</h4></div>
        {Toggle(lang === "fa" ? "فعال باشد" : "Enabled", "pwa")}
        <div className="small muted mb8">{lang === "fa" ? "کنترل تجربهٔ «نصب اپ روی گوشی». برای روشن/خاموش کامل، پرچم «پیشنهاد نصب اپ» را در «پرچم‌های قابلیت» هم تنظیم کنید." : "Control the install-to-home-screen experience. For a full on/off, also set the App-install feature flag."}</div>
        <label className="toggle-row"><span>{lang === "fa" ? "نمایش خودکار پیشنهاد نصب" : "Auto-show install prompt"}</span>
          <input type="checkbox" checked={cfg.pwa?.show_prompt !== false} onChange={(e) => set("pwa", "show_prompt", e.target.checked)} /></label>
        <label className="toggle-row"><span>{lang === "fa" ? "راهنمای نصب آیفون (Safari)" : "iOS install hint (Safari)"}</span>
          <input type="checkbox" checked={cfg.pwa?.ios_hint !== false} onChange={(e) => set("pwa", "ios_hint", e.target.checked)} /></label>
        <label className="toggle-row"><span>{lang === "fa" ? "کارکرد آفلاین (کش سرویس‌ورکر)" : "Offline support (service worker cache)"}</span>
          <input type="checkbox" checked={cfg.pwa?.offline_enabled !== false} onChange={(e) => set("pwa", "offline_enabled", e.target.checked)} /></label>
        <div className="grid grid-2 mt8">
          {F(lang === "fa" ? "بازهٔ یادآوری مجدد (روز)" : "Snooze after Later (days)", "pwa", "snooze_days")}
        </div>
      </div>

      <div className="card mt16">
        <div className="section-title"><h4>🎓 {lang === "fa" ? "گواهی‌نامهٔ پایان دوره" : "Completion certificates"}</h4></div>
        {Toggle(lang === "fa" ? "فعال باشد" : "Enabled", "certificates")}
        <div className="small muted mb8">{lang === "fa" ? "برای روشن/خاموش کامل، پرچم «گواهی‌نامه» را هم در «کلیدهای ویژگی» تنظیم کنید." : "For a full on/off, also set the Certificates feature flag."}</div>
        <div className="grid grid-2">
          {F(lang === "fa" ? "نام صادرکننده (فارسی)" : "Issuer name (FA)", "certificates", "org_name_fa", "text")}
          {F(lang === "fa" ? "نام صادرکننده (انگلیسی)" : "Issuer name (EN)", "certificates", "org_name_en", "text")}
        </div>
        <div className="grid grid-2">
          {F(lang === "fa" ? "نام امضاکننده (فارسی)" : "Signer name (FA)", "certificates", "signer_name_fa", "text")}
          {F(lang === "fa" ? "عنوان امضاکننده (فارسی)" : "Signer title (FA)", "certificates", "signer_title_fa", "text")}
        </div>
        <div className="grid grid-2">
          {F(lang === "fa" ? "آستانهٔ دوره (٪)" : "Program threshold (%)", "certificates", "program_threshold")}
          {F(lang === "fa" ? "آستانهٔ کلاس (٪)" : "Course threshold (%)", "certificates", "course_threshold")}
        </div>
        <label className="toggle-row"><span>{lang === "fa" ? "صدور خودکار هنگام تکمیل" : "Auto-issue on completion"}</span>
          <input type="checkbox" checked={cfg.certificates?.auto_issue !== false} onChange={(e) => set("certificates", "auto_issue", e.target.checked)} /></label>
        <label className="toggle-row"><span>{lang === "fa" ? "نمایش ساعت مطالعه روی گواهی" : "Show study hours on certificate"}</span>
          <input type="checkbox" checked={cfg.certificates?.show_hours !== false} onChange={(e) => set("certificates", "show_hours", e.target.checked)} /></label>
      </div>
    </div>
  );
}

/* ================================================================
   SUPER-ADMIN CONTROL PANEL SECTIONS
   ================================================================ */

/* ---- System overview: KPIs, signup trend, ad perf, recent actions ---- */
function SystemOverview({ onJump }) {
  const { t, lang } = useApp();
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/overview").then(setD).catch(() => setD({})); }, []);
  if (!d) return <Spinner />;
  const c = d.counts || {};
  const kpis = [
    ["users", c.users, "users"], ["learners", c.learners, "medal"], ["students", c.students, "patient"],
    ["premiumOn", c.premium, "crown"], ["flashcards", c.flashcards, "flask"], ["challenges", c.challenges, "trophy"],
  ];
  const fa = lang === "fa";
  const quick = [
    ["siteContent", "edit", fa ? "متن‌ها و نظرات لندینگ" : "Landing texts & testimonials", fa ? "متن‌های عمومی، بخش کاربران چه می‌گویند و محتوای صفحه اصلی را از اینجا کنترل کنید." : "Control public texts, testimonials, and homepage copy here."],
    ["landingManager", "medal", fa ? "اعداد و بخش‌های صفحه اصلی" : "Homepage stats & sections", fa ? "عدد کل کاربران، کف آمار نمایشی و محتوای لندینگ اینجاست." : "Homepage counters, stats floor, and landing sections live here."],
    ["securityAdmin", "shield", fa ? "امنیت و ضد هک" : "Security hardening", fa ? "رویدادهای امنیتی، تنظیمات محافظتی و سلامت امنیتی سایت را بررسی کنید." : "Review security events, hardening controls, and site protection."],
    ["dailyUsers", "chart", fa ? "آمار روزانه کاربران" : "Daily user analytics", fa ? "روند ثبت‌نام و رشد کاربران دانشجو، استاد و رقابتی را ببینید." : "Track daily signups and growth across roles."],
    ["tutorSettings", "ai", fa ? "Dr Tutor / دکتر راهنما" : "Dr Tutor controls", fa ? "پیش‌فرض خاموش؛ فعال‌سازی کلی و تنظیمات راهنما از این بخش انجام می‌شود." : "Off by default; manage global tutor guidance controls here."],
    ["externalAdsAdmin", "image", fa ? "تبلیغات خارجی و AdSense" : "External ads & AdSense", fa ? "تبلیغات پیش‌فرض خاموش است و فقط با کنترل ادمین فعال می‌شود." : "Ads are off by default and only enabled by admin control."],
    ["questionnairesAdmin", "check", fa ? "پرسشنامه پایان کلاس/آزمون" : "Class/exam questionnaires", fa ? "فرم‌های بازخورد آموزشی را برای کلاس یا آزمون مدیریت کنید." : "Manage educational feedback forms for classes and exams."],
    ["blogAdmin", "book", fa ? "وبلاگ و مقالات علمی" : "Blog & academic articles", fa ? "مقالات دانشگاهی، SEO و محتوای آموزشی سایت را کنترل کنید." : "Control academic posts, SEO content, and educational articles."],
    ["storeManager", "store", fa ? "فروشگاه مستقل" : "Independent store", fa ? "محصولات و فروشگاه جداگانه /store را مدیریت کنید." : "Manage products and the independent /store page."],
  ];
  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="dashboard" size={18} /> {t("overview")}</h4></div>
      <div className="grid grid-3 mb16">
        {kpis.map(([k, v, ic]) => (
          <div className="card stat-card" key={k}>
            <div className="mod-ico" style={{ width: 40, height: 40, marginBottom: 8, background: "var(--grad-primary)" }}><Icon name={ic} size={20} /></div>
            <div className="num"><StatNum value={v || 0} /></div>
            <div className="lbl">{t(k) || k}</div>
          </div>
        ))}
      </div>
      <div className="card admin-control-hub mb16">
        <div className="section-title" style={{ marginBottom: 8 }}>
          <h4><Icon name="settings" size={16} /> {fa ? "مرکز کنترل سریع ادمین" : "Admin quick control center"}</h4>
          <span className="small muted">{fa ? "همه قابلیت‌های حساس باید از این مسیرها کنترل شوند." : "Sensitive features stay under admin control from these shortcuts."}</span>
        </div>
        <div className="admin-hub-grid">
          {quick.map(([id, ic, title, desc]) => (
            <button key={id} className="admin-hub-card" onClick={() => onJump?.(id)}>
              <span className="admin-hub-icon"><Icon name={ic} size={18} /></span>
              <span className="admin-hub-copy"><b>{title}</b><small>{desc}</small></span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-2 mb16">
        <div className="card">
          <h4 className="mb8"><Icon name="chart" size={16} /> {t("signupsChart")}</h4>
          {d.signups?.length ? <LineChart values={d.signups.map((s) => s.n)} /> : <div className="muted small">{t("noData")}</div>}
        </div>
        <div className="card">
          <h4 className="mb8"><Icon name="image" size={16} /> {t("adPerf")}</h4>
          <div className="case-meta"><span className="tag">{t("impressions")}: {d.ads?.imp || 0}</span><span className="tag">{t("clicks")}: {d.ads?.clk || 0}</span></div>
          <div className="mt16"><div className="small muted">{t("totalXpLabel")}</div><div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--xp)" }}>{c.totalXp || 0}</div></div>
        </div>
      </div>
      <div className="card">
        <h4 className="mb8"><Icon name="clock" size={16} /> {t("recentActions")}</h4>
        {(d.recent || []).length === 0 && <div className="muted small">{t("noAudit")}</div>}
        {(d.recent || []).map((a) => (
          <div key={a.id} className="case-item" style={{ marginTop: 6 }}>
            <div style={{ minWidth: 0 }}><b>{a.action}</b> <span className="small muted">{a.resource}</span></div>
            <span className="small muted">{a.actor_name} · {fmtDateTime(a.created_at, lang)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Full learner/user management: search, filter, ban, impersonate, XP, delete ---- */
function LearnerManagement() { return <UsersManager scope="competitive" />; }

/* ---- Placement analytics report (admin) ----
   Aggregate view of all learners' placement results: participation, level
   distribution, average score, and per-topic average accuracy (weakest first)
   so the admin sees where learners arrive strong/weak. */
/* Monthly trend chart for the placement report: a bar per month showing the
   average entry score, with a tiny stacked level-split bar + test count under
   each. Pure inline SVG (no external chart lib) so it renders in the preview. */
function PlacementTrend({ trend, fa, levelName }) {
  const W = Math.max(280, trend.length * 64 + 40);
  const H = 160, padB = 46, padT = 10, chartH = H - padB - padT;
  const barW = 30, gap = (W - 40) / trend.length;
  const yFor = (v) => padT + chartH - (v / 100) * chartH;
  const lvlColor = { beginner: "var(--flame)", intermediate: "var(--gold)", advanced: "var(--green)" };
  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={H} role="img" aria-label={fa ? "نمودار روند سطح ورودی" : "Entry level trend chart"} style={{ display: "block" }}>
        {/* gridlines at 0/50/100 */}
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line x1={30} x2={W - 6} y1={yFor(g)} y2={yFor(g)} stroke="var(--border,#e2e6ee)" strokeWidth="1" />
            <text x={4} y={yFor(g) + 4} fontSize="9" fill="var(--muted,#8a93a5)">{g}</text>
          </g>
        ))}
        {trend.map((m, i) => {
          const cx = 30 + i * gap + gap / 2;
          const bx = cx - barW / 2;
          const by = yFor(m.avgScore);
          const bh = padT + chartH - by;
          return (
            <g key={i}>
              {/* avg-score bar */}
              <rect x={bx} y={by} width={barW} height={Math.max(0, bh)} rx="4" fill="var(--primary,#3b6cff)" />
              <text x={cx} y={by - 4} fontSize="10" fontWeight="700" textAnchor="middle" fill="var(--fg,#222)">{m.avgScore}%</text>
              {/* tiny stacked level split just below the axis */}
              {(() => {
                const total = m.count || 1; let ox = bx;
                const segW = barW;
                return ["beginner", "intermediate", "advanced"].map((lv) => {
                  const w = (m.levels[lv] / total) * segW;
                  const el = <rect key={lv} x={ox} y={padT + chartH + 6} width={Math.max(0, w)} height="5" fill={lvlColor[lv]} />;
                  ox += w; return el;
                });
              })()}
              {/* month label + count */}
              <text x={cx} y={padT + chartH + 24} fontSize="9" textAnchor="middle" fill="var(--muted,#8a93a5)">{m.label}</text>
              <text x={cx} y={padT + chartH + 36} fontSize="9" textAnchor="middle" fill="var(--muted,#8a93a5)">{fa ? `${m.count} آزمون` : `${m.count} tests`}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: ".72rem", marginTop: 6 }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: lvlColor.beginner, borderRadius: 2, marginInlineEnd: 4 }} />{levelName.beginner}</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: lvlColor.intermediate, borderRadius: 2, marginInlineEnd: 4 }} />{levelName.intermediate}</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: lvlColor.advanced, borderRadius: 2, marginInlineEnd: 4 }} />{levelName.advanced}</span>
      </div>
    </div>
  );
}

function PlacementReport() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [range, setRange] = useState("all");   // time window for the trend/aggregate
  const load = () => { setErr(""); api.get(`/admin/placement/analytics?lang=${lang}&range=${range}`).then(setData).catch((e) => setErr(e.message)); };
  useEffect(() => { load(); }, [lang, range]);
  const exportCsv = async () => {
    try {
      const res = await fetch(`/api/admin/placement/analytics.csv?lang=${lang}`, { credentials: "same-origin", headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "placement-results.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setErr(e.message); }
  };

  if (err) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{err}</h3><button className="btn btn-ghost mt16" onClick={load}>{t("retry") || (fa ? "تلاش دوباره" : "Retry")}</button></div>;
  if (!data) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;

  const levelName = { beginner: fa ? "مبتدی" : "Beginner", intermediate: fa ? "متوسط" : "Intermediate", advanced: fa ? "پیشرفته" : "Advanced" };
  const diffName = { easy: fa ? "آسان" : "Easy", medium: fa ? "متوسط" : "Medium", hard: fa ? "سخت" : "Hard" };
  const Stat = ({ label, value, sub }) => (
    <div className="card" style={{ flex: 1, minWidth: 140, textAlign: "center" }}>
      <div className="big" style={{ fontSize: "1.8rem" }}>{value}</div>
      <div className="small muted">{label}</div>
      {sub != null && <div className="small" style={{ opacity: .8 }}>{sub}</div>}
    </div>
  );
  const Bar = ({ label, count, total, color }) => {
    const pct = total ? Math.round((count / total) * 100) : 0;
    return (
      <div className="weak-row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{label}</div>
          <div className="pbar sm"><span style={{ width: `${pct}%`, background: color }} /></div>
        </div>
        <span className="tag">{count} · {pct}%</span>
      </div>
    );
  };

  return (
    <div>
      <div className="section-title"><h3>🧭 {fa ? "گزارش آزمون تعیین سطح" : "Placement report"}</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select className="input-sm" value={range} onChange={(e) => setRange(e.target.value)} style={{ fontSize: ".82rem", padding: "4px 8px" }}
            title={fa ? "بازهٔ زمانی" : "Time range"}>
            <option value="all">{fa ? "کل زمان" : "All time"}</option>
            <option value="3m">{fa ? "۳ ماه اخیر" : "Last 3 months"}</option>
            <option value="6m">{fa ? "۶ ماه اخیر" : "Last 6 months"}</option>
            <option value="12m">{fa ? "۱۲ ماه اخیر" : "Last 12 months"}</option>
          </select>
          {data.taken > 0 && <button className="btn btn-ghost btn-sm" onClick={exportCsv}><Icon name="download" size={14} /> {fa ? "خروجی CSV" : "Export CSV"}</button>}
          <button className="btn btn-ghost btn-sm" onClick={load}><Icon name="refresh" size={14} /> {fa ? "به‌روزرسانی" : "Refresh"}</button>
        </div></div>
      <div className="small muted mb16">{fa
        ? "خلاصهٔ نتایج آزمون تعیین سطحِ همهٔ کاربرانِ رقابتی. برای دیدن اینکه کاربران در کدام موضوعات ضعیف/قوی وارد می‌شوند."
        : "Summary of all competitive learners' placement results — see which topics learners arrive weak/strong in."}</div>

      {!data.enabled && <div className="card" style={{ background: "rgba(240,180,0,.1)", marginBottom: 16 }}>
        <div className="small">{fa ? "⚠️ آزمون تعیین سطح در حال حاضر خاموش است (بخش گیمیفیکیشن)." : "⚠️ The placement test is currently disabled (Gamification section)."}</div></div>}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Stat label={fa ? "کل کاربران" : "Total learners"} value={data.totalLearners} />
        <Stat label={fa ? "آزمون داده" : "Took the test"} value={data.taken} sub={`${data.takenPct}%`} />
        <Stat label={fa ? "میانگین نمره" : "Average score"} value={`${data.avgScore}%`} />
        <Stat label={fa ? "رد کرده‌اند" : "Dismissed"} value={data.dismissed} />
      </div>

      {data.taken === 0 ? (
        <div className="card empty-state"><div className="ico">📊</div><h3>{fa ? "هنوز کسی آزمون تعیین سطح را کامل نکرده است." : "No one has completed the placement test yet."}</h3></div>
      ) : (
        <>
          <div className="card mb16">
            <div className="section-title"><h4>{fa ? "توزیع سطح" : "Level distribution"}</h4></div>
            <Bar label={levelName.beginner} count={data.levels.beginner} total={data.taken} color="var(--flame)" />
            <Bar label={levelName.intermediate} count={data.levels.intermediate} total={data.taken} color="var(--gold)" />
            <Bar label={levelName.advanced} count={data.levels.advanced} total={data.taken} color="var(--green)" />
          </div>

          {data.adaptiveCount > 0 && (
            <div className="card mb16">
              <div className="section-title"><h4>{fa ? "سقف سختی (حالت تطبیقی)" : "Ceiling difficulty (adaptive)"}</h4></div>
              <div className="small muted mb8">{fa ? `از ${data.adaptiveCount} آزمونِ تطبیقی: بالاترین سختی که کاربر درست پاسخ داده.` : `Of ${data.adaptiveCount} adaptive runs: highest difficulty answered correctly.`}</div>
              <Bar label={diffName.easy} count={data.ceilings.easy} total={data.adaptiveCount} color="var(--flame)" />
              <Bar label={diffName.medium} count={data.ceilings.medium} total={data.adaptiveCount} color="var(--gold)" />
              <Bar label={diffName.hard} count={data.ceilings.hard} total={data.adaptiveCount} color="var(--green)" />
            </div>
          )}

          {data.trend?.length > 0 && (
            <div className="card mb16">
              <div className="section-title"><h4>{fa ? "روند سطح ورودی در طول زمان" : "Entry level over time"}</h4></div>
              <div className="small muted mb8">{fa ? "میانگین نمرهٔ ورودی و تعداد آزمون در هر ماه؛ ببینید کاربران تازه‌وارد قوی‌تر می‌شوند یا نه." : "Average entry score & test count per month — see if incoming learners are getting stronger."}</div>
              <PlacementTrend trend={data.trend} fa={fa} levelName={levelName} />
            </div>
          )}

          {data.outcomeByLevel?.some((o) => o.learners > 0) && (
            <div className="card mb16">
              <div className="section-title"><h4>{fa ? "سطح ورودی در برابر پیشرفت فعلی" : "Entry level vs. current progress"}</h4></div>
              <div className="small muted mb8">{fa
                ? "آیا آزمون تعیین سطح پیش‌بینی خوبی بوده؟ به‌طور معمول باید کاربرانِ «پیشرفته» تا الان درس‌های بیشتری تمام کرده باشند."
                : "Was the placement a good predictor? Typically \"advanced\" learners should have completed more lessons by now."}</div>
              {(() => {
                const maxNodes = Math.max(1, ...data.outcomeByLevel.map((o) => o.avgDoneNodes));
                return data.outcomeByLevel.filter((o) => o.learners > 0).map((o) => {
                  const pct = Math.round((o.avgDoneNodes / maxNodes) * 100);
                  const color = o.level === "advanced" ? "var(--green)" : o.level === "intermediate" ? "var(--gold)" : "var(--flame)";
                  return (
                    <div className="weak-row" key={o.level}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>{levelName[o.level]}
                          <span className="small muted" style={{ marginInlineStart: 8 }}>({o.learners} {fa ? "نفر" : "learners"} · {o.avgXp} XP)</span></div>
                        <div className="pbar sm"><span style={{ width: `${pct}%`, background: color }} /></div>
                      </div>
                      <span className="tag">{o.avgDoneNodes} {fa ? "درس" : "lessons"}</span>
                    </div>
                  );
                });
              })()}
              {data.predictive != null && (
                <div className="small mt8" style={{ color: data.predictive ? "var(--green)" : "var(--flame)" }}>
                  {data.predictive
                    ? (fa ? "✅ ترتیب پیشرفت با سطح ورودی هم‌خوان است — آزمون پیش‌بینی خوبی داشته." : "✅ Progress order matches entry level — the test predicts well.")
                    : (fa ? "⚠️ ترتیب پیشرفت با سطح ورودی کاملاً هم‌خوان نیست (می‌تواند به‌خاطر داده کم یا رفتار کاربران باشد)." : "⚠️ Progress order doesn't fully match entry level (could be low data or learner behavior).")}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <div className="section-title"><h4>{fa ? "میانگین دقت به تفکیک موضوع (ضعیف‌ترین اول)" : "Average accuracy by topic (weakest first)"}</h4></div>
            <div className="small muted mb8">{fa ? "موضوعاتی که کاربران با دقتِ پایین‌تری وارد می‌شوند، فرصت‌های آموزشی مهم‌ترند." : "Topics learners arrive with lower accuracy in are your biggest teaching opportunities."}</div>
            {data.byTopic.map((tp) => (
              <div className="weak-row" key={tp.slug}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{tp.name}
                    <span className="small muted" style={{ marginInlineStart: 8 }}>({tp.learners} {fa ? "نفر" : "learners"} · {tp.strongPct}% {fa ? "قوی" : "strong"})</span></div>
                  <div className="pbar sm"><span style={{ width: `${tp.avgAccuracy}%`, background: tp.avgAccuracy >= 70 ? "var(--green)" : tp.avgAccuracy < 40 ? "var(--flame)" : "var(--gold)" }} /></div>
                </div>
                <span className="tag">{tp.avgAccuracy}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UserDetail({ id, onBack }) {
  const { t, lang } = useApp();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [xp, setXp] = useState(""); const [gems, setGems] = useState(""); const [streak, setStreak] = useState("");
  const load = () => api.get(`/admin/users/${id}`).then((r) => { setD(r); setXp(r.profile?.xp ?? ""); setGems(r.profile?.gems ?? ""); setStreak(r.profile?.streak ?? ""); }).catch(() => {});
  useEffect(() => { load(); }, [id]);
  if (!d) return <Spinner />;
  const u = d.user;
  const saveLearner = async (extra = {}) => { await api.post(`/admin/users/${id}/learner`, { xp: +xp, gems: +gems, streak: +streak, ...extra }); toast(t("saved")); load(); };
  const resetPw = async () => { const pw = prompt(t("resetPass")); if (pw) { await api.post(`/admin/users/${id}/password`, { password: pw }); toast(t("saved")); } };
  const resetPlacement = async () => { if (confirm(t("resetPlacementConfirm"))) { try { await api.post(`/admin/users/${id}/reset-placement`, {}); toast(t("saved")); load(); } catch (e) { toast(e.message); } } };

  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="user" size={18} /> {lang === "fa" ? u.name_fa : u.name_en}</h4>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← {t("back")}</button></div>
      <div className="grid grid-2 mb16">
        <div className="card">
          <div className="small muted">{t("username")}</div><div style={{ fontWeight: 700, marginBottom: 8 }}>{u.username}</div>
          <div className="case-meta"><span className="tag">{t(u.role)}</span><span className="tag">{u.status}</span>{u.student_no && <span className="tag">{u.student_no}</span>}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="btn btn-ghost btn-sm mt16" onClick={resetPw}><Icon name="key" size={13} /> {t("resetPass")}</button>
            {u.role === "learner" && <button className="btn btn-ghost btn-sm mt16" onClick={resetPlacement}><Icon name="compass" size={13} /> {t("resetPlacement")}</button>}
          </div>
        </div>
        <div className="card">
          <div className="small muted mb8">{t("systemStats")}</div>
          <div className="case-meta"><span className="tag">{t("totalActivities")}: {d.stats.attempts}</span><span className="tag">{t("completed")}: {d.stats.nodes}</span><span className="tag">{t("myCards")}: {d.stats.cards}</span></div>
        </div>
      </div>
      {d.profile && (
        <div className="card">
          <h4 className="mb8"><Icon name="medal" size={16} /> {t("adjustXp")}</h4>
          <div className="grid grid-3">
            <div className="field"><label>{t("newXp")}</label><input type="number" value={xp} onChange={(e) => setXp(e.target.value)} /></div>
            <div className="field"><label>{t("newGems")}</label><input type="number" value={gems} onChange={(e) => setGems(e.target.value)} /></div>
            <div className="field"><label>{t("newStreak")}</label><input type="number" value={streak} onChange={(e) => setStreak(e.target.value)} /></div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm" onClick={() => saveLearner()}><Icon name="check" size={13} /> {t("save")}</button>
            {d.profile.premium
              ? <button className="btn btn-ghost btn-sm" onClick={() => saveLearner({ premium: false })}>{t("revokePremium")}</button>
              : <button className="btn btn-accent btn-sm" onClick={() => saveLearner({ premium: true })}><Icon name="crown" size={13} /> {t("grantPremium")}</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function useUniversities() {
  const [unis, setUnis] = useState([]);
  useEffect(() => { api.get("/universities").then((d) => setUnis(d.universities || [])).catch(() => setUnis([])); }, []);
  return unis;
}

function UserEditModal({ user, onClose, onSaved }) {
  const { t, lang } = useApp();
  const unis = useUniversities();
  const [f, setF] = useState({ name_fa: user.name_fa || "", name_en: user.name_en || "", role: user.role, student_no: user.student_no || "", email: user.email || "", province: user.province || "", university_id: user.university_id || "", phone: user.phone || "", bio: user.bio || "" });
  const save = async () => { await api.put(`/admin/users/${user.id}`, f); onSaved(); };
  const isUni = f.role === "teacher" || f.role === "student";
  return (
    <Modal title={t("editUser")} onClose={onClose} onSave={save}>
      <div className="grid grid-2">
        <div className="field"><label>{t("fullName")} (FA)</label><input value={f.name_fa} onChange={(e) => setF({ ...f, name_fa: e.target.value })} /></div>
        <div className="field"><label>{t("fullName")} (EN)</label><input value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} /></div>
      </div>
      <div className="grid grid-2">
        <div className="field"><label>{t("email")} ({t("optional")})</label><input dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label>{t("phone")} ({t("optional")})</label><input dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      </div>
      <div className="field"><label>{t("bio")} ({t("optional")})</label><textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
      <div className="field"><label>{t("role")}</label>
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          {["student", "teacher", "admin", "learner", "content_manager", "support"].map((r) => <option key={r} value={r}>{t(r)}</option>)}
        </select></div>
      {isUni && (
        <div className="field"><label><Icon name="class" size={14} /> {t("university")}</label>
          <select value={f.university_id} onChange={(e) => setF({ ...f, university_id: e.target.value })}>
            <option value="">{t("noUniversity")} *</option>
            {unis.map((u) => <option key={u.id} value={u.id}>{lang === "fa" ? u.name_fa : u.name_en}</option>)}
          </select></div>
      )}
      <div className="grid grid-2">
        {f.role === "student" && <div className="field"><label>{t("studentNo") || "Student No"}</label><input value={f.student_no} onChange={(e) => setF({ ...f, student_no: e.target.value })} /></div>}
        {f.role === "learner" && <div className="field"><label>{t("province")}</label><input value={f.province} onChange={(e) => setF({ ...f, province: e.target.value })} /></div>}
      </div>
    </Modal>
  );
}

function UserCreateModal({ onClose, onSaved, defaultRole = "learner" }) {
  const { t, lang, user } = useApp();
  const unis = useUniversities();
  const isTeacher = user.role === "teacher";
  // a teacher may only add students; an admin may add any role.
  const roleOptions = isTeacher ? ["student"] : ["learner", "student", "teacher", "admin", "content_manager", "support"];
  const [f, setF] = useState({ username: "", email: "", password: "", name_fa: "", role: isTeacher ? "student" : defaultRole, student_no: "", province: "", university_id: "", phone: "", bio: "" });
  const [err, setErr] = useState("");
  const save = async () => { try { await api.post("/admin/users", { ...f, name_en: f.name_fa }); onSaved(); } catch (e) { const ex=e.data?.existing; setErr(ex ? `${e.message} — ${ex.name_fa || ex.username} (${ex.student_no})` : e.message); } };
  const isUni = f.role === "teacher" || f.role === "student";
  return (
    <Modal title={t("newUser")} onClose={onClose} onSave={save}>
      {err && <div className="err-banner mb8">{err}</div>}
      <div className="field"><label>{t("username")}</label><input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></div>
      <div className="field"><label>{t("password")}</label><input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
      <div className="field"><label>{t("fullName")}</label><input value={f.name_fa} onChange={(e) => setF({ ...f, name_fa: e.target.value })} /></div>
      <div className="grid grid-2">
        <div className="field"><label>{t("email")} ({t("optional")})</label><input dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label>{t("phone")} ({t("optional")})</label><input dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      </div>
      <div className="field"><label>{t("bio")} ({t("optional")})</label><textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
      <div className="field"><label>{t("role")}</label>
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} disabled={isTeacher}>
          {roleOptions.map((r) => <option key={r} value={r}>{t(r)}</option>)}
        </select></div>
      {isUni && (
        <div className="field"><label><Icon name="class" size={14} /> {t("university")}</label>
          <select value={f.university_id} onChange={(e) => setF({ ...f, university_id: e.target.value })}>
            <option value="">{t("noUniversity")} *</option>
            {unis.map((u) => <option key={u.id} value={u.id}>{lang === "fa" ? u.name_fa : u.name_en}</option>)}
          </select></div>
      )}
      {f.role === "student" && <div className="field"><label>{t("studentNo") || "Student No"}</label><input value={f.student_no} onChange={(e) => setF({ ...f, student_no: e.target.value })} /></div>}
    </Modal>
  );
}

/* ---- Universities management (admin) ---- */
function Universities() {
  const { t, lang, user } = useApp();
  const toast = useToast();
  const isAdmin = user.role === "admin";
  const [unis, setUnis] = useState(null);
  const [defaults, setDefaults] = useState(null);   // global feature defaults
  const [editing, setEditing] = useState(null);
  const [uniQ, setUniQ] = useState("");
  const [members, setMembers] = useState({});   // uniId -> {teachers, students} (expanded)
  const [addingTo, setAddingTo] = useState(null);   // university to add existing members to
  const load = () => api.get("/universities").then((d) => { setUnis(d.universities); setDefaults(d.defaults || null); }).catch(() => setUnis([]));
  const saveDefaults = async (patch) => {
    try { const d = await api.put("/universities/defaults", patch); setDefaults(d); toast(t("saved")); }
    catch (e) { toast(e.message); }
  };
  const refreshMembers = async (uid) => { try { const d = await api.get(`/universities/${uid}/members?lang=${lang}`); setMembers((m) => ({ ...m, [uid]: d })); } catch { /* */ } };
  const removeMember = async (uid, userId) => {
    if (!confirm(t("removeFromUni") + "؟")) return;
    try { await api.del(`/universities/${uid}/members/${userId}`); toast(t("saved")); refreshMembers(uid); load(); } catch (e) { toast(e.message); }
  };
  useEffect(() => { load(); }, []);
  const toggleMembers = async (uid) => {
    if (members[uid]) { setMembers((m) => { const n = { ...m }; delete n[uid]; return n; }); return; }
    try { const d = await api.get(`/universities/${uid}/members?lang=${lang}`); setMembers((m) => ({ ...m, [uid]: d })); } catch { /* */ }
  };
  const del = async (u) => {
    if (!confirm(t("confirmDelete"))) return;
    try { await api.del(`/universities/${u.id}`); toast(t("saved")); load(); }
    catch (e) { toast(e.message === "university has members" ? t("uniHasMembers") : e.message); }
  };
  if (!unis) return <Spinner />;
  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="class" size={18} /> {t("universities")}</h4>
        {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}><Icon name="class" size={14} /> {t("newUniversity")}</button>}
      </div>
      {unis.length === 0 && <div className="card empty-state"><div className="ico"><Icon name="class" size={40} /></div><h3>{t("noUniversities")}</h3></div>}
      {isAdmin && defaults && (
        <div className="card mb16" style={{ background: "var(--panel2)" }}>
          <div className="small" style={{ fontWeight: 800, marginBottom: 6 }}>
            {lang === "fa" ? "⚙️ پیش‌فرض سراسری قابلیت‌های دانشگاهی (برای همه دانشگاه‌ها مگر آن‌که لغو شود)" : "⚙️ Global university defaults (unless overridden per university/class)"}
          </div>
          <div className="grid grid-2">
            <label className="toggle-row">
              <span>🎯 {lang === "fa" ? "فلش‌کارت بدون کسر نمره" : "No-penalty flashcards"}</span>
              <input type="checkbox" checked={!!defaults.flash_no_penalty} onChange={(e) => saveDefaults({ flash_no_penalty: e.target.checked })} />
            </label>
            <label className="toggle-row">
              <span>⏱ {lang === "fa" ? "تساوی جدول رقابت با زمان کمتر" : "Leaderboard tie-break by less time"}</span>
              <input type="checkbox" checked={!!defaults.live_board_speed} onChange={(e) => saveDefaults({ live_board_speed: e.target.checked })} />
            </label>
          </div>
          <div className="small muted mt4">
            {lang === "fa" ? "پیش‌فرض هر دو «خاموش» است. خاموش: استفاده از راهنما و پاسخ غلط مرحله‌ای از نمره کم می‌کند؛ جدول رقابت فقط با نمره و پیشرفت مرتب می‌شود." : "Both default OFF. Off: hints and wrong stage answers deduct points; the board sorts by grade and progress only."}
          </div>
        </div>
      )}
      {unis.length > 0 && (
        <div className="dt-search">
          <Icon name="search" size={16} />
          <input value={uniQ} onChange={(e) => setUniQ(e.target.value)} placeholder={t("searchPlaceholder")} />
          {uniQ && <button className="dt-clear" onClick={() => setUniQ("")}><Icon name="close" size={14} /></button>}
        </div>
      )}
      <div className="grid grid-2">
        {unis.filter((u) => {
          const n = uniQ.trim().toLowerCase();
          if (!n) return true;
          return [u.name_fa, u.name_en, u.city_fa, u.city_en, u.code].some((v) => String(v ?? "").toLowerCase().includes(n));
        }).map((u) => (
          <div key={u.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 800 }}>{lang === "fa" ? u.name_fa : u.name_en}</div>
              <span className="tag">{u.code}</span>
            </div>
            <div className="small muted mt8">{lang === "fa" ? u.city_fa : u.city_en}</div>
            <div className="case-meta mt8">
              <span className="tag"><Icon name="user" size={12} /> {t("teacher")}: {u.teachers}</span>
              <span className="tag"><Icon name="users" size={12} /> {t("student")}: {u.students}{u.limits_enabled && u.max_students != null ? `/${u.max_students}` : ""}</span>
              <span className="tag" style={{ opacity: .85 }}>
                📄 {{ trial: lang === "fa" ? "آزمایشی" : "Trial", standard: lang === "fa" ? "استاندارد" : "Standard", enterprise: lang === "fa" ? "سازمانی" : "Enterprise" }[u.license_plan || "standard"]}
                {u.license_expires_at ? ` · ${u.license_expires_at}` : ""}
              </span>
              {!!u.limits_enabled && <span className="tag" style={{ color: "var(--warn,#b45309)", borderColor: "var(--warn,#b45309)" }}>{lang === "fa" ? "محدودیت‌ها: فعال" : "limits: on"}</span>}
            </div>
            {(u.limits_enabled && (u.max_vp_msgs_month != null || u.max_vp_tokens_month != null)) && u.usage && (
              <div className="mt8" style={{ display: "grid", gap: 6 }}>
                {u.max_vp_msgs_month != null && (
                  <div>
                    <div className="small muted">{lang === "fa" ? "چت VP این ماه" : "VP messages this month"}: {u.usage.vp_msgs} / {u.max_vp_msgs_month}</div>
                    <div className="pbar"><span style={{ width: `${Math.min(100, Math.round((u.usage.vp_msgs / Math.max(1, u.max_vp_msgs_month)) * 100))}%` }} /></div>
                  </div>
                )}
                {u.max_vp_tokens_month != null && (
                  <div>
                    <div className="small muted">{lang === "fa" ? "توکن VP این ماه" : "VP tokens this month"}: {u.usage.vp_tokens} / {u.max_vp_tokens_month}</div>
                    <div className="pbar"><span style={{ width: `${Math.min(100, Math.round((u.usage.vp_tokens / Math.max(1, u.max_vp_tokens_month)) * 100))}%` }} /></div>
                  </div>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleMembers(u.id)}>
                <Icon name="users" size={13} /> {members[u.id] ? t("hideMembers") : t("viewMembers")}
              </button>
              {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => setAddingTo(u)}><Icon name="user" size={13} /> {t("addExistingMembers")}</button>}
              {isAdmin && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(u)}><Icon name="edit" size={13} /> {t("edit")}</button>}
              {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => del(u)}><Icon name="trash" size={13} /> {t("delete")}</button>}
            </div>
            {members[u.id] && (
              <div className="uni-members mt8">
                <div className="small" style={{ fontWeight: 800, marginBottom: 4 }}>👨‍🏫 {t("teacher")}</div>
                {members[u.id].teachers.length === 0 && <div className="small muted">—</div>}
                {members[u.id].teachers.map((m) => (
                  <div key={m.id} className="uni-member-row" style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ flex: 1 }}>{m.name}</span><span className="small muted">{m.email}</span>
                    {isAdmin && <button className="btn btn-ghost btn-sm" title={t("removeFromUni")} onClick={() => removeMember(u.id, m.id)}><Icon name="close" size={12} /></button>}</div>
                ))}
                <div className="small" style={{ fontWeight: 800, margin: "8px 0 4px" }}>🎓 {t("student")}</div>
                {members[u.id].students.length === 0 && <div className="small muted">—</div>}
                {members[u.id].students.slice(0, 8).map((m) => (
                  <div key={m.id} className="uni-member-row" style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ flex: 1 }}>{m.name}</span><span className="small muted">{m.student_no || ""}</span>
                    {isAdmin && <button className="btn btn-ghost btn-sm" title={t("removeFromUni")} onClick={() => removeMember(u.id, m.id)}><Icon name="close" size={12} /></button>}</div>
                ))}
                {members[u.id].students.length > 8 && <div className="small muted">+{members[u.id].students.length - 8}…</div>}
              </div>
            )}
          </div>
        ))}
      </div>
      {editing && <UniversityModal uni={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); toast(t("saved")); load(); }} />}
      {addingTo && <AddUniMembersModal uni={addingTo} onClose={() => setAddingTo(null)}
        onSaved={() => { const uid = addingTo.id; setAddingTo(null); toast(t("saved")); if (members[uid]) refreshMembers(uid); load(); }} />}
    </div>
  );
}

/* Admin: add EXISTING teachers/students to a university (bulk), with search. */
function AddUniMembersModal({ uni, onClose, onSaved }) {
  const { t, lang } = useApp();
  const [q, setQ] = useState("");
  const [list, setList] = useState(null);
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState(false);
  const search = () => api.get(`/universities/${uni.id}/candidates?lang=${lang}&q=${encodeURIComponent(q)}`).then((d) => setList(d.candidates || [])).catch(() => setList([]));
  useEffect(() => { search(); }, []);
  const toggle = (id) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const save = async () => {
    if (!sel.length) return;
    setBusy(true);
    try { await api.post(`/universities/${uni.id}/members`, { userIds: sel }); onSaved(); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={`${t("addExistingMembers")} — ${lang === "fa" ? uni.name_fa : uni.name_en}`} onClose={onClose} onSave={save} saveLabel={busy ? "…" : t("save")}>
      <div className="small muted mb8">{t("addMembersHint")}</div>
      <div className="dt-search mb8" style={{ maxWidth: "100%" }}>
        <Icon name="search" size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder={t("searchUsers")} />
        <button className="btn btn-ghost btn-sm" onClick={search}>{t("search") || "🔍"}</button>
      </div>
      {list == null ? <Spinner /> : list.length === 0 ? <div className="small muted center" style={{ padding: 16 }}>{t("noCandidates")}</div> : (
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {list.map((u) => (
            <label key={u.id} className="toggle-row" style={{ cursor: "pointer" }}>
              <span style={{ flex: 1 }}>{u.name} <span className="tag small">{t(u.role)}</span> {u.student_no ? <span className="small muted">{u.student_no}</span> : ""} {u.hasUni && <span className="small muted">({lang === "fa" ? "دانشگاه دیگر" : "another uni"})</span>}</span>
              <input type="checkbox" checked={sel.includes(u.id)} onChange={() => toggle(u.id)} />
            </label>
          ))}
        </div>
      )}
      {sel.length > 0 && <div className="small muted mt8">{sel.length} {lang === "fa" ? "انتخاب شد" : "selected"}</div>}
    </Modal>
  );
}

function UniversityModal({ uni, onClose, onSaved }) {
  const { t, lang } = useApp();
  const [f, setF] = useState({
    name_fa: uni.name_fa || "", name_en: uni.name_en || "", city_fa: uni.city_fa || "", city_en: uni.city_en || "",
    // Licensing / sales (B2B) — everything optional & nullable on the server.
    license_plan: uni.license_plan || "standard",
    license_expires_at: uni.license_expires_at || "",
    sales_method: uni.sales_method || "",
    limits_enabled: !!uni.limits_enabled,
    max_students: uni.max_students ?? "", max_vp_msgs_month: uni.max_vp_msgs_month ?? "", max_vp_tokens_month: uni.max_vp_tokens_month ?? "",
    flash_no_penalty: uni.flash_no_penalty == null ? "inherit" : (uni.flash_no_penalty ? "on" : "off"),
    live_board_speed: uni.live_board_speed == null ? "inherit" : (uni.live_board_speed ? "on" : "off"),
  });
  const [err, setErr] = useState("");
  const save = async () => {
    const emptyToNull = (v) => (v === "" ? null : v);
    const numOrNull = (v) => (v === "" || v == null ? null : (+v));
    const body = {
      ...f,
      license_expires_at: emptyToNull(f.license_expires_at),
      sales_method: emptyToNull(f.sales_method),
      max_students: numOrNull(f.max_students),
      max_vp_msgs_month: numOrNull(f.max_vp_msgs_month),
      max_vp_tokens_month: numOrNull(f.max_vp_tokens_month),
    };
    try { if (uni.id) await api.put(`/universities/${uni.id}`, body); else await api.post("/universities", body); onSaved(); }
    catch (e) { setErr(e.message); }
  };
  const planLabel = { trial: lang === "fa" ? "آزمایشی" : "Trial", standard: lang === "fa" ? "استاندارد" : "Standard", enterprise: lang === "fa" ? "سازمانی" : "Enterprise" };
  return (
    <Modal title={uni.id ? t("edit") : t("newUniversity")} onClose={onClose} onSave={save} wide>
      {err && <div className="err-banner mb8">{err}</div>}
      <div className="grid grid-2">
        <div className="field"><label>{t("uniName")} (FA)</label><input value={f.name_fa} onChange={(e) => setF({ ...f, name_fa: e.target.value })} /></div>
        <div className="field"><label>{t("uniName")} (EN)</label><input dir="ltr" value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} /></div>
      </div>
      <div className="grid grid-2">
        <div className="field"><label>{t("uniCity")} (FA)</label><input value={f.city_fa} onChange={(e) => setF({ ...f, city_fa: e.target.value })} /></div>
        <div className="field"><label>{t("uniCity")} (EN)</label><input dir="ltr" value={f.city_en} onChange={(e) => setF({ ...f, city_en: e.target.value })} /></div>
      </div>

      {/* ---- Licensing & sales (per-university B2B) ---- */}
      <div className="card mt8" style={{ background: "var(--panel2)" }}>
        <div className="small" style={{ fontWeight: 800, marginBottom: 8 }}>
          {lang === "fa" ? "📄 لایسنس و فروش سازمانی این دانشگاه" : "📄 Institutional licence & sale"}
        </div>
        <div className="grid grid-3">
          <div className="field"><label>{lang === "fa" ? "پلن" : "Plan"}</label>
            <select value={f.license_plan} onChange={(e) => setF({ ...f, license_plan: e.target.value })}>
              <option value="trial">{planLabel.trial}</option>
              <option value="standard">{planLabel.standard}</option>
              <option value="enterprise">{planLabel.enterprise}</option>
            </select></div>
          <div className="field"><label>{lang === "fa" ? "انقضای لایسنس" : "Licence expiry"}</label>
            <input dir="ltr" type="date" value={f.license_expires_at} onChange={(e) => setF({ ...f, license_expires_at: e.target.value })} /></div>
          <div className="field"><label>{lang === "fa" ? "روش فروش/قرارداد" : "Sale method"}</label>
            <input value={f.sales_method} placeholder={lang === "fa" ? "مثل: سازمانی، معرف، فاکتور رسمی…" : "e.g. institutional, referral, invoice…"}
              onChange={(e) => setF({ ...f, sales_method: e.target.value })} /></div>
        </div>

        <label className="toggle-row mt8">
          <span>{lang === "fa" ? "اعمال محدودیت‌ها (سقف دانشجو / سهمیه‌ی بیمار مجازی)" : "Enforce limits (students cap / virtual-patient quota)"}</span>
          <input type="checkbox" checked={!!f.limits_enabled} onChange={(e) => setF({ ...f, limits_enabled: e.target.checked })} />
        </label>
        <div className="small muted mt4">
          {lang === "fa"
            ? "فقط وقتی روشن است، سقف‌های زیر اجرا می‌شوند؛ خالی = نامحدود. با روشن‌بودن، دانشجوی بیش از سقف ساخته نمی‌شود و پس از اتمام سهمیه‌ی ماهانه، چت بیمار مجازی با پیام محدودیت قطع می‌شود."
            : "Caps below are enforced only while this is on; empty = unlimited. When on, creating students beyond the cap fails and VP chat stops with a limit notice once the monthly quota is exhausted."}
        </div>
        <div className="grid grid-3 mt8">
          <div className="field"><label>{lang === "fa" ? "سقف تعداد دانشجو" : "Max students"}</label>
            <input type="number" min="0" value={f.max_students} placeholder="∞"
              disabled={!f.limits_enabled} onChange={(e) => setF({ ...f, max_students: e.target.value })} /></div>
          <div className="field"><label>{lang === "fa" ? "سقف چت VP در ماه" : "VP messages / month"}</label>
            <input type="number" min="0" value={f.max_vp_msgs_month} placeholder="∞"
              disabled={!f.limits_enabled} onChange={(e) => setF({ ...f, max_vp_msgs_month: e.target.value })} /></div>
          <div className="field"><label>{lang === "fa" ? "سقف توکن VP در ماه" : "VP tokens / month"}</label>
            <input type="number" min="0" value={f.max_vp_tokens_month} placeholder="∞"
              disabled={!f.limits_enabled} onChange={(e) => setF({ ...f, max_vp_tokens_month: e.target.value })} /></div>
        </div>
        {uni.id && uni.usage && (
          <div className="small muted mt4">
            {lang === "fa"
              ? `مصرف ماه جاری (${uni.usage.period}): چت ${uni.usage.vp_msgs} • توکن ${uni.usage.vp_tokens} • جلسه ${uni.usage.vp_sessions}`
              : `This month (${uni.usage.period}): ${uni.usage.vp_msgs} messages • ${uni.usage.vp_tokens} tokens • ${uni.usage.vp_sessions} sessions`}
          </div>
        )}
      </div>

      {/* ---- Per-university feature flags (override global defaults) ---- */}
      <div className="grid grid-2 mt8">
        <div className="field">
          <label>🎯 {lang === "fa" ? "فلش‌کارت بدون کسر نمره" : "No-penalty flashcards"}</label>
          <select value={f.flash_no_penalty} onChange={(e) => setF({ ...f, flash_no_penalty: e.target.value })}>
            <option value="inherit">{lang === "fa" ? "پیروی از پیش‌فرض سراسری" : "Follow global default"}</option>
            <option value="on">{lang === "fa" ? "فعال برای این دانشگاه" : "On for this university"}</option>
            <option value="off">{lang === "fa" ? "غیرفعال برای این دانشگاه" : "Off for this university"}</option>
          </select>
        </div>
        <div className="field">
          <label>⏱ {lang === "fa" ? "تساوی جدول رقابت با زمان کمتر" : "Leaderboard tie-break by less time"}</label>
          <select value={f.live_board_speed} onChange={(e) => setF({ ...f, live_board_speed: e.target.value })}>
            <option value="inherit">{lang === "fa" ? "پیروی از پیش‌فرض سراسری" : "Follow global default"}</option>
            <option value="on">{lang === "fa" ? "فعال برای این دانشگاه" : "On for this university"}</option>
            <option value="off">{lang === "fa" ? "غیرفعال برای این دانشگاه" : "Off for this university"}</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}

/* ---- Feature flags ---- */
/* Site Control — maintenance mode, landing promo banner, program (course)
   on/off, and quick store toggle. One tidy place for the "big switches". */
function SiteControl() {
  const { t, lang } = useApp();
  const toast = useToast();
  const [m, setM] = useState(null);          // maintenance
  const [banner, setBanner] = useState(null);
  const [programs, setPrograms] = useState(null);
  const [storeOn, setStoreOn] = useState(true);

  const load = () => {
    api.get("/admin/maintenance").then(setM).catch(() => setM({ on: false }));
    api.get("/admin/banner").then(setBanner).catch(() => setBanner({ on: false }));
    api.get("/admin/programs").then((d) => setPrograms(d.programs || [])).catch(() => setPrograms([]));
    api.get("/admin/flags").then((d) => { const s = (d.flags || []).find((f) => f.key === "store"); setStoreOn(s ? !!s.enabled : true); }).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  if (!m || !banner || !programs) return <Spinner />;

  const saveMaintenance = async () => { await api.put("/admin/maintenance", m); toast(t("saved")); };
  const saveBanner = async () => { await api.put("/admin/banner", banner); toast(t("saved")); };
  const toggleStore = async () => { await api.put("/admin/flags/store", { enabled: !storeOn }); setStoreOn(!storeOn); toast(t("saved")); };
  const toggleProgram = async (slug) => {
    const next = programs.map((p) => p.slug === slug ? { ...p, active: p.active === false ? true : false } : p);
    setPrograms(next);
    await api.put("/admin/programs", { programs: next.map(({ topics, ...p }) => p) });
    toast(t("saved"));
  };

  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="settings" size={18} /> {t("siteControl")}</h4></div>
      <div className="muted small mb16">{t("siteControlHint")}</div>

      {/* Maintenance mode */}
      <div className="card mb16" style={m.on ? { borderColor: "var(--danger)" } : {}}>
        <label className="toggle-row" style={{ cursor: "pointer" }}>
          <span style={{ fontWeight: 800 }}>🛠️ {t("maintenanceMode")}</span>
          <input type="checkbox" checked={!!m.on} onChange={(e) => setM({ ...m, on: e.target.checked })} style={{ width: 20, height: 20 }} />
        </label>
        <div className="small muted mb8">{t("maintenanceHint")}</div>
        <div className="grid grid-2">
          <div className="field"><label>{t("maintTitle")} (FA)</label><input value={m.title_fa || ""} onChange={(e) => setM({ ...m, title_fa: e.target.value })} placeholder="سایت در حال تعمیر است" /></div>
          <div className="field"><label>{t("maintTitle")} (EN)</label><input value={m.title_en || ""} onChange={(e) => setM({ ...m, title_en: e.target.value })} placeholder="Under maintenance" /></div>
        </div>
        <div className="grid grid-2">
          <div className="field"><label>{t("maintBody")} (FA)</label><input value={m.body_fa || ""} onChange={(e) => setM({ ...m, body_fa: e.target.value })} /></div>
          <div className="field"><label>{t("maintBody")} (EN)</label><input value={m.body_en || ""} onChange={(e) => setM({ ...m, body_en: e.target.value })} /></div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={saveMaintenance}><Icon name="check" size={14} /> {t("save")}</button>
      </div>

      {/* Landing promo banner */}
      <div className="card mb16">
        <label className="toggle-row" style={{ cursor: "pointer" }}>
          <span style={{ fontWeight: 800 }}>📣 {t("landingBanner")}</span>
          <input type="checkbox" checked={!!banner.on} onChange={(e) => setBanner({ ...banner, on: e.target.checked })} style={{ width: 20, height: 20 }} />
        </label>
        <div className="small muted mb8">{t("landingBannerHint")}</div>
        {(banner.text_fa || banner.text_en) && (
          <div className="lp-banner mb8" style={{ background: banner.bg || "#2f7fd1", borderRadius: 10 }}>
            <span className="lp-banner-text">📣 {lang === "fa" ? banner.text_fa : banner.text_en}</span>
            {(banner.cta_fa || banner.cta_en) && <span className="lp-banner-cta">{lang === "fa" ? banner.cta_fa : banner.cta_en} →</span>}
          </div>
        )}
        <div className="grid grid-2">
          <div className="field"><label>{t("bannerText")} (FA)</label><input value={banner.text_fa || ""} onChange={(e) => setBanner({ ...banner, text_fa: e.target.value })} /></div>
          <div className="field"><label>{t("bannerText")} (EN)</label><input value={banner.text_en || ""} onChange={(e) => setBanner({ ...banner, text_en: e.target.value })} /></div>
        </div>
        <div className="grid grid-2">
          <div className="field"><label>{t("bannerCta")} (FA)</label><input value={banner.cta_fa || ""} onChange={(e) => setBanner({ ...banner, cta_fa: e.target.value })} /></div>
          <div className="field"><label>{t("bannerCta")} (EN)</label><input value={banner.cta_en || ""} onChange={(e) => setBanner({ ...banner, cta_en: e.target.value })} /></div>
        </div>
        <div className="grid grid-2">
          <div className="field"><label>{t("bannerUrl")}</label><input value={banner.url || ""} onChange={(e) => setBanner({ ...banner, url: e.target.value })} placeholder="/store" style={{ direction: "ltr" }} /></div>
          <div className="field"><label>{t("bannerColor")}</label><input type="color" value={banner.bg || "#2f7fd1"} onChange={(e) => setBanner({ ...banner, bg: e.target.value })} /></div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={saveBanner}><Icon name="check" size={14} /> {t("save")}</button>
      </div>

      {/* Learning programs (courses) on/off */}
      <div className="card mb16">
        <div style={{ fontWeight: 800, marginBottom: 4 }}>📚 {t("programsControl")}</div>
        <div className="small muted mb8">{t("programsControlHint")}</div>
        {programs.map((p) => (
          <label key={p.slug} className="toggle-row" style={{ cursor: "pointer" }}>
            <span>{p.emoji} {lang === "fa" ? p.fa : p.en} <span className="muted small">({p.topics} {t("lessons")})</span></span>
            <input type="checkbox" checked={p.active !== false} onChange={() => toggleProgram(p.slug)} style={{ width: 20, height: 20 }} />
          </label>
        ))}
      </div>

      {/* Store on/off */}
      <div className="card">
        <label className="toggle-row" style={{ cursor: "pointer" }}>
          <span style={{ fontWeight: 800 }}>🛍️ {t("storeToggle")}</span>
          <input type="checkbox" checked={storeOn} onChange={toggleStore} style={{ width: 20, height: 20 }} />
        </label>
        <div className="small muted">{t("storeToggleHint")}</div>
      </div>
    </div>
  );
}

function FeatureFlags() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [flags, setFlags] = useState(null);
  const [q, setQ] = useState("");
  const load = () => api.get("/admin/flags").then((d) => setFlags(d.flags)).catch(() => setFlags([]));
  useEffect(() => { load(); }, []);
  const toggle = async (f, val) => { await api.put(`/admin/flags/${f.key}`, { enabled: val ?? !f.enabled }); toast(t("saved")); load(); };
  const setMany = async (list, val) => { for (const f of list) if (!!f.enabled !== val) await api.put(`/admin/flags/${f.key}`, { enabled: val }); toast(t("saved")); load(); };
  if (!flags) return <Spinner />;
  // Grouped so ~70 switches stay scannable. Unknown keys fall into «سایر».
  const GROUPS = [
    [fa ? "یادگیری و مسیر" : "Learning & path", ["placement", "srs_review", "smart_practice", "checkpoint", "mastery", "legendary", "jump_ahead", "calibration", "confidence_assess", "calm_mode", "study_plan", "certificates", "onboarding"]],
    [fa ? "بانک و ابزارهای مطالعه" : "Bank & study tools", ["bank_browse", "full_bank", "custom_test", "summaries", "summaries_free", "exam_sim", "mindmap", "mnemonics", "virtual_patient", "drawing_assist", "learner_cards", "notes", "flagged_review", "library", "mistakes_hub", "crowd_insights", "progress", "help_center"]],
    [fa ? "مقایسه با همتایان (دور ۹)" : "Peer benchmark (round 9)", ["option_stats", "peer_percentile", "daily_report", "hint", "save_flashcard", "premium_trial"]],
    [fa ? "انگیزش و رقابت" : "Motivation & competition", ["quests", "achievements", "leagues", "ranking", "anon_ranking", "ramp_event", "streak_wager", "monthly_quest", "streak_revival", "challenges", "friends", "community", "dx_challenge", "referral", "social_share", "smart_reminders"]],
    [fa ? "درآمد و تبلیغات" : "Revenue & ads", ["premium", "ads", "store", "group_purchase"]],
    [fa ? "سیستم" : "System", ["learner_signup", "push", "pwa_install", "seo", "blog", "support"]],
  ];
  const known = new Set(GROUPS.flatMap(([, k]) => k));
  const rest = flags.filter((f) => !known.has(f.key)).map((f) => f.key);
  if (rest.length) GROUPS.push([fa ? "سایر" : "Other", rest]);
  const ql = q.trim().toLowerCase();
  const on = flags.filter((f) => f.enabled).length;
  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="settings" size={18} /> {t("featureFlags")}</h4>
        <span className="tag">{on}/{flags.length} {fa ? "روشن" : "on"}</span></div>
      <div className="muted small mb8">{fa ? "هر قابلیت سایت یک کلید دارد. خاموش‌کردن، هم رابط کاربری و هم API آن قابلیت را می‌بندد (سرور ۴۰۳ می‌دهد). تنظیمات ریزتر هر قابلیت در «گیمیفیکیشن» است." : "Every feature has a switch. Turning one off hides its UI and closes its API (server returns 403). Fine-grained knobs live under Gamification."}</div>
      <input className="mb16" placeholder={fa ? "جست‌وجوی قابلیت…" : "Search features…"} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%" }} />
      {GROUPS.map(([title, keys]) => {
        const list = keys.map((k) => flags.find((f) => f.key === k)).filter(Boolean)
          .filter((f) => !ql || f.key.includes(ql) || (f.label_fa || "").toLowerCase().includes(ql) || (f.label_en || "").toLowerCase().includes(ql));
        if (!list.length) return null;
        const allOn = list.every((f) => f.enabled);
        return (
          <div className="card mb16" key={title}>
            <div className="section-title"><h4>{title} <span className="small muted">({list.filter((f) => f.enabled).length}/{list.length})</span></h4>
              <button className="btn btn-ghost btn-sm" onClick={() => setMany(list, !allOn)}>{allOn ? (fa ? "خاموش‌کردن همه" : "All off") : (fa ? "روشن‌کردن همه" : "All on")}</button></div>
            {list.map((f) => (
              <div key={f.key} className="ff-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border, rgba(127,127,127,.15))" }}>
                <div><div style={{ fontWeight: 700 }}>{fa ? f.label_fa : f.label_en}</div><div className="small muted">{f.key}</div></div>
                <label className="switch">
                  <input type="checkbox" checked={!!f.enabled} onChange={() => toggle(f)} />
                  <span className="slider" />
                </label>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ---- Audit log ---- */
function AuditLog() {
  const { t, lang } = useApp();
  const [items, setItems] = useState(null);
  const [action, setAction] = useState("");
  const load = () => api.get(`/admin/audit?action=${encodeURIComponent(action)}`).then((d) => setItems(d.items)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  if (!items) return <Spinner />;
  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="clock" size={18} /> {t("auditLog")}</h4>
        <div className="inline-form" style={{ gap: 8 }}><input placeholder={t("action")} value={action} onChange={(e) => setAction(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} style={{ maxWidth: 160 }} /><button className="btn btn-ghost btn-sm" onClick={load}><Icon name="search" size={14} /></button></div>
      </div>
      {items.length === 0 && <div className="card empty-state"><div className="ico"><Icon name="clock" size={40} /></div><h3>{t("noAudit")}</h3></div>}
      <div className="table-wrap"><table><thead><tr><th>{t("actor")}</th><th>{t("action")}</th><th>{t("resource")}</th><th>{t("when")}</th></tr></thead><tbody>
        {items.map((a) => (
          <tr key={a.id}><td>{a.actor_name}</td><td><b>{a.action}</b></td><td className="small muted">{a.resource}</td><td className="small muted">{fmtDateTime(a.created_at, lang)}</td></tr>
        ))}
      </tbody></table></div>
    </div>
  );
}

/* ---- Content (microlearning) management ---- */
function ContentManagement() {
  const { t, lang } = useApp();
  const toast = useToast();
  const [cards, setCards] = useState(null);
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const load = () => api.get(`/admin/content/cards?lang=${lang}`).then((d) => setCards(d.cards)).catch(() => setCards([]));
  useEffect(() => { load(); }, []);
  const toggleActive = async (c) => { await api.post(`/admin/content/cards/${c.id}/active`, { active: !c.active }); load(); };
  if (!cards) return <Spinner />;
  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="book" size={18} /> {t("contentMgmt")}</h4>
        <button className="btn btn-primary btn-sm" onClick={() => setImporting(true)}>
          <Icon name="upload" size={14} /> {t("bulkImport")}
        </button>
      </div>
      <div className="small muted mb16">{cards.length} {t("flashcards")}</div>
      {importing && <LazyAdminChunk><ImportModal onClose={() => setImporting(false)} onDone={() => { setImporting(false); toast(t("saved")); load(); }} /></LazyAdminChunk>}
      <div className="table-wrap"><table><thead><tr><th>#</th><th>{t("title")}</th><th>{t("questionTypeLabel")}</th><th>{t("hasMicro")}</th><th></th></tr></thead><tbody>
        {cards.slice(0, 200).map((c) => (
          <tr key={c.id} style={{ opacity: c.active ? 1 : .5 }}>
            <td>{c.id}</td>
            <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.q}</td>
            <td><span className="tag">{t("qt" + c.type.charAt(0).toUpperCase() + c.type.slice(1)) || c.type}</span></td>
            <td>{c.hasMicro ? "✓" : "—"}</td>
            <td style={{ textAlign: "end", whiteSpace: "nowrap" }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setEditing(c)}><Icon name="edit" size={13} /> {t("editMicro")}</button>
              <button className="btn btn-sm btn-ghost" onClick={() => toggleActive(c)}>{c.active ? <Icon name="lock" size={13} /> : <Icon name="check" size={13} />}</button>
            </td>
          </tr>
        ))}
      </tbody></table></div>
      {editing && <MicroEditModal card={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); toast(t("saved")); load(); }} />}
    </div>
  );
}

/* Bulk import of pre-internship questions (CSV, all types + QB micro). */
function MicroEditModal({ card, onClose, onSaved }) {
  const { t } = useApp();
  const [f, setF] = useState({ lead_fa: "", lead_en: "", golden_fa: "", golden_en: "", source_fa: "", source_en: "" });
  const save = async () => { await api.put(`/admin/content/cards/${card.id}/micro`, f); onSaved(); };
  return (
    <Modal title={`${t("editMicro")} — #${card.id}`} onClose={onClose} onSave={save}>
      <div className="small muted mb8">{card.q}</div>
      <div className="grid grid-2">
        <div className="field"><label>{t("microLead")} (FA)</label><input value={f.lead_fa} onChange={(e) => setF({ ...f, lead_fa: e.target.value })} /></div>
        <div className="field"><label>{t("microLead")} (EN)</label><input value={f.lead_en} onChange={(e) => setF({ ...f, lead_en: e.target.value })} /></div>
      </div>
      <div className="grid grid-2">
        <div className="field"><label>{t("microGolden")} (FA)</label><input value={f.golden_fa} onChange={(e) => setF({ ...f, golden_fa: e.target.value })} /></div>
        <div className="field"><label>{t("microGolden")} (EN)</label><input value={f.golden_en} onChange={(e) => setF({ ...f, golden_en: e.target.value })} /></div>
      </div>
      <div className="grid grid-2">
        <div className="field"><label>{t("microSource")} (FA)</label><input value={f.source_fa} onChange={(e) => setF({ ...f, source_fa: e.target.value })} /></div>
        <div className="field"><label>{t("microSource")} (EN)</label><input value={f.source_en} onChange={(e) => setF({ ...f, source_en: e.target.value })} /></div>
      </div>
    </Modal>
  );
}

/* ---- Global settings ---- */
function GlobalSettings() {
  const { t } = useApp();
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/admin/settings").then((d) => { setSettings(d.settings); setRows(Object.entries(d.settings).map(([k, v]) => ({ k, v }))); }).catch(() => setSettings({})); }, []);
  const save = async (k, v) => { await api.put(`/admin/settings/${k}`, { value: v }); toast(t("saved")); };
  const [nk, setNk] = useState(""); const [nv, setNv] = useState("");
  if (!settings) return <Spinner />;
  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="settings" size={18} /> {t("globalSettings")}</h4></div>
      <div className="small muted mb16">{t("promptEditNote")}</div>
      {rows.map((row, i) => (
        <div key={row.k} className="inline-form mt8" style={{ alignItems: "center" }}>
          <input value={row.k} disabled style={{ maxWidth: 200, fontWeight: 700 }} />
          <input value={row.v} onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, v: e.target.value } : r))} />
          <button className="btn btn-sm btn-primary" onClick={() => save(row.k, row.v)}>{t("save")}</button>
        </div>
      ))}
      <div className="divider" />
      <div className="inline-form mt8" style={{ alignItems: "center" }}>
        <input placeholder="key" value={nk} onChange={(e) => setNk(e.target.value)} style={{ maxWidth: 200 }} />
        <input placeholder="value" value={nv} onChange={(e) => setNv(e.target.value)} />
        <button className="btn btn-sm btn-accent" onClick={async () => { if (nk) { await save(nk, nv); setRows([...rows, { k: nk, v: nv }]); setNk(""); setNv(""); } }}>+ {t("add")}</button>
      </div>
    </div>
  );
}

/* ---- Data tools: JSON export of key tables ---- */
function DataTools() {
  const { t } = useApp();
  const tables = ["users", "flashcards", "topics", "path_nodes", "learner_profiles", "audit_log", "ads", "challenges"];
  const download = (table) => {
    const token = getToken();
    fetch(`/api/admin/export/${table}`, { credentials: "same-origin", headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob()).then((b) => {
        const url = URL.createObjectURL(b); const a = document.createElement("a");
        a.href = url; a.download = `${table}.json`; a.click(); URL.revokeObjectURL(url);
      });
  };
  return (
    <div className="page">
      <div className="section-title"><h4><Icon name="download" size={18} /> {t("dataTools")}</h4></div>
      {/* Full database backup — the safe way to keep your data across upgrades */}
      <BackupCard />
      <div className="small muted mb16">{t("exportData")}</div>
      <div className="grid grid-3">
        {tables.map((tb) => (
          <button key={tb} className="card" style={{ cursor: "pointer", textAlign: "start", border: "none" }} onClick={() => download(tb)}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Icon name="download" size={18} /> <b>{tb}</b></div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* Database backup card: shows where the persistent data lives (DATA_DIR), lets
   the admin download the whole DB before an upgrade, and take on-server
   snapshots. This is the user's safety net for "upgrade the site without losing
   my data". */
function BackupCard() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/admin/backup/status").then(setSt).catch(() => setSt(null));
  useEffect(() => { load(); }, []);
  const kb = (n) => `${(Math.max(0, n || 0) / 1024).toFixed(0)} KB`;

  const downloadDb = () => {
    const token = getToken();
    fetch("/api/admin/backup/download", { credentials: "same-origin", headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob()).then((b) => {
        const url = URL.createObjectURL(b); const a = document.createElement("a");
        a.href = url; a.download = `medlab-backup-${new Date().toISOString().slice(0, 10)}.db`; a.click(); URL.revokeObjectURL(url);
      }).catch(() => toast(fa ? "خطا در دانلود" : "Download failed"));
  };
  const snapshot = async () => {
    setBusy(true);
    try { const r = await api.post("/admin/backup/create", {}); if (r.ok) { toast(fa ? "نسخهٔ پشتیبان ساخته شد ✅" : "Backup created ✅"); load(); } }
    catch { toast(fa ? "خطا" : "Failed"); } finally { setBusy(false); }
  };

  return (
    <div className="card mb16" style={{ borderInlineStart: "4px solid var(--ok, #22a06b)" }}>
      <div className="section-title" style={{ marginBottom: 8 }}>
        <h4 style={{ border: "none", padding: 0 }}>🛟 {fa ? "پشتیبان‌گیری از داده‌ها" : "Data backup"}</h4>
      </div>
      <div className="small muted mb8">{fa
        ? "همهٔ داده‌های شما (پایگاه‌داده + فایل‌های آپلودی) در پوشهٔ مستقلِ «data» بیرون از کدِ سایت نگه‌داری می‌شود؛ پس هنگام ارتقای سایت، فقط کد را جایگزین کنید و پوشهٔ data را نگه دارید تا داده‌ها از دست نروند. پیش از هر ارتقا، یک نسخهٔ پشتیبان بگیرید."
        : "All your data (database + uploaded files) is stored in a separate 'data' folder OUTSIDE the app code. To upgrade, replace only the code and keep the data folder. Take a backup before any upgrade."}</div>
      {st && (
        <div className="small muted mb8" style={{ lineHeight: 1.9 }}>
          📁 <b>{fa ? "پوشهٔ داده:" : "Data folder:"}</b> <code style={{ direction: "ltr", unicodeBidi: "embed" }}>{st.dataDir}</code><br />
          🗄️ {fa ? "حجم پایگاه‌داده:" : "DB size:"} {kb(st.dbSize)} · 🖼️ {fa ? "فایل‌های آپلودی:" : "uploads:"} {st.uploadCount} · 💾 {fa ? "نسخه‌های پشتیبان:" : "snapshots:"} {st.backups?.length || 0}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary btn-sm" onClick={downloadDb}><Icon name="download" size={15} /> {fa ? "دانلود نسخهٔ کامل پایگاه‌داده" : "Download full database"}</button>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={snapshot}>💾 {fa ? "ساخت نسخهٔ پشتیبان روی سرور" : "Create server snapshot"}</button>
      </div>
    </div>
  );
}


function DailyUsersAdmin(){const {t}=useApp();const[d,setD]=useState(null);useEffect(()=>{api.get('/admin/analytics/daily-users').then(setD).catch(()=>setD({rows:[]}))},[]);if(!d)return <Spinner/>;return <div className="card"><div className="section-title"><h4>{t('dailyUsers')}</h4><a className="btn btn-ghost btn-sm" href="/api/admin/analytics/daily-users.csv" target="_blank">CSV</a></div><DataTable rows={d.rows||[]} columns={[{key:'day',label:'day'},{key:'total',label:'total'}]}/></div>}

function JsonHint({ children }) { return <div className="small muted" style={{ lineHeight: 1.8 }}>{children}</div>; }

function QuestionnairesAdmin(){
  const {t, lang}=useApp();
  const toast=useToast();
  const fa=lang==="fa";
  const empty={title_fa:"",title_en:"",description_fa:"",description_en:"",scope:"general",class_id:"",exam_id:"",active:true,anonymous:true,require_after_finish:true,questions:[{type:"rating",label_fa:"امتیاز کلی",label_en:"Overall rating",required:true}]};
  const[forms,setForms]=useState(null);
  const[responses,setResponses]=useState([]);
  const[edit,setEdit]=useState(empty);
  const[err,setErr]=useState("");
  const load=()=>{setErr("");Promise.all([
    api.get('/questionnaires/admin/forms').catch(()=>({forms:[]})),
    api.get('/questionnaires/admin/responses').catch(()=>({responses:[]})),
  ]).then(([f,r])=>{setForms(f.forms||[]);setResponses(r.responses||[])}).catch(e=>setErr(e.message||String(e)))};
  useEffect(()=>{ load(); },[]);
  const startEdit=(f)=>setEdit({...empty,...f,questions:Array.isArray(f.questions)?f.questions:[],class_id:f.class_id||"",exam_id:f.exam_id||""});
  const addQ=()=>setEdit(e=>({...e,questions:[...(e.questions||[]),{type:"text",label_fa:"سؤال جدید",label_en:"New question",required:false}]}));
  const setQ=(i,k,v)=>setEdit(e=>({...e,questions:(e.questions||[]).map((q,idx)=>idx===i?{...q,[k]:v}:q)}));
  const delQ=(i)=>setEdit(e=>({...e,questions:(e.questions||[]).filter((_,idx)=>idx!==i)}));
  const save=async()=>{try{const body={...edit,class_id:edit.scope==='class'?edit.class_id:null,exam_id:edit.scope==='exam'?edit.exam_id:null};const out=edit.id?await api.put(`/questionnaires/admin/forms/${edit.id}`,body):await api.post('/questionnaires/admin/forms',body);toast(t('saved'));setEdit(empty);load();return out}catch(e){setErr(e.message||String(e));toast(t('error')||'Error')}};
  const toggle=async(f)=>{await api.put(`/questionnaires/admin/forms/${f.id}`,{...f,active:!f.active});load()};
  if(!forms)return <Spinner/>;
  const responseCount=responses.reduce((m,r)=>{m[r.form_id]=(m[r.form_id]||0)+1;return m;},{});
  return <div className="page">
    <div className="section-title"><h4><Icon name="check" size={18}/>{t('questionnairesAdmin')}</h4><button className="btn btn-ghost btn-sm" onClick={()=>setEdit(empty)}>{fa?"فرم جدید":"New form"}</button></div>
    {err&&<div className="ddle-banner bad mb16">{err}</div>}
    <div className="grid grid-2 mb16">
      <div className="card">
        <h4 className="mb8">{fa?"ساخت/ویرایش پرسشنامه":"Create/edit questionnaire"}</h4>
        <div className="grid grid-2">
          <label className="field"><span>{fa?"عنوان فارسی":"FA title"}</span><input value={edit.title_fa||""} onChange={e=>setEdit({...edit,title_fa:e.target.value})}/></label>
          <label className="field"><span>{fa?"عنوان انگلیسی":"EN title"}</span><input value={edit.title_en||""} onChange={e=>setEdit({...edit,title_en:e.target.value})}/></label>
        </div>
        <label className="field"><span>{fa?"توضیح فارسی":"FA description"}</span><textarea rows="2" value={edit.description_fa||""} onChange={e=>setEdit({...edit,description_fa:e.target.value})}/></label>
        <div className="grid grid-3">
          <label className="field"><span>{fa?"محدوده":"Scope"}</span><select value={edit.scope||"general"} onChange={e=>setEdit({...edit,scope:e.target.value})}><option value="general">general</option><option value="class">class</option><option value="exam">exam</option></select></label>
          <label className="field"><span>class_id</span><input disabled={edit.scope!=="class"} value={edit.class_id||""} onChange={e=>setEdit({...edit,class_id:e.target.value})}/></label>
          <label className="field"><span>exam_id</span><input disabled={edit.scope!=="exam"} value={edit.exam_id||""} onChange={e=>setEdit({...edit,exam_id:e.target.value})}/></label>
        </div>
        <div className="grid grid-3">
          <label className="toggle-row"><span>{t('active')}</span><input type="checkbox" checked={!!edit.active} onChange={e=>setEdit({...edit,active:e.target.checked})}/></label>
          <label className="toggle-row"><span>{fa?"ناشناس":"Anonymous"}</span><input type="checkbox" checked={!!edit.anonymous} onChange={e=>setEdit({...edit,anonymous:e.target.checked})}/></label>
          <label className="toggle-row"><span>{fa?"بعد از پایان نمایش بده":"After finish"}</span><input type="checkbox" checked={!!edit.require_after_finish} onChange={e=>setEdit({...edit,require_after_finish:e.target.checked})}/></label>
        </div>
        <div className="section-title" style={{marginTop:12}}><h4>{fa?"سؤال‌ها":"Questions"}</h4><button className="btn btn-ghost btn-sm" onClick={addQ}>+ {fa?"سؤال":"Question"}</button></div>
        {(edit.questions||[]).map((q,i)=><div className="card" key={i} style={{padding:10,marginTop:8}}>
          <div className="grid grid-3">
            <label className="field"><span>type</span><select value={q.type||"text"} onChange={e=>setQ(i,'type',e.target.value)}><option value="text">text</option><option value="rating">rating</option><option value="choice">choice</option></select></label>
            <label className="field"><span>{fa?"برچسب فارسی":"FA label"}</span><input value={q.label_fa||""} onChange={e=>setQ(i,'label_fa',e.target.value)}/></label>
            <label className="field"><span>{fa?"برچسب انگلیسی":"EN label"}</span><input value={q.label_en||""} onChange={e=>setQ(i,'label_en',e.target.value)}/></label>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}><label className="toggle-row" style={{flex:1}}><span>{fa?"اجباری":"Required"}</span><input type="checkbox" checked={!!q.required} onChange={e=>setQ(i,'required',e.target.checked)}/></label><button className="btn btn-ghost btn-sm" onClick={()=>delQ(i)}>{t('delete')||'Delete'}</button></div>
        </div>)}
        <div style={{display:'flex',gap:8,marginTop:12}}><button className="btn btn-primary" onClick={save}>{t('save')}</button>{edit.id&&<button className="btn btn-ghost" onClick={()=>setEdit(empty)}>{fa?"لغو و فرم جدید":"Cancel / new"}</button>}</div>
        <JsonHint>{fa?"نکته: برای فرم مخصوص کلاس یا آزمون، class_id یا exam_id را وارد کنید؛ فرم عمومی برای همه contextها قابل نمایش است.":"Tip: for a class/exam form, enter class_id or exam_id. General forms can show across contexts."}</JsonHint>
      </div>
      <div className="card">
        <h4 className="mb8">{fa?"فرم‌های موجود و پاسخ‌ها":"Existing forms & responses"}</h4>
        <DataTable rows={forms.map(f=>({...f,responses:responseCount[f.id]||0,status:f.active?(fa?'فعال':'Active'):(fa?'خاموش':'Off')}))} columns={[{key:'title_fa',label:t('title')},{key:'scope',label:'scope'},{key:'responses',label:fa?'پاسخ‌ها':'Responses'},{key:'status',label:t('status')},{key:'actions',label:'',sortable:false,render:(f)=><div style={{display:'flex',gap:6}}><button className="btn btn-ghost btn-sm" onClick={()=>startEdit(f)}>{t('edit')}</button><button className="btn btn-ghost btn-sm" onClick={()=>toggle(f)}>{f.active?(fa?'خاموش':'Disable'):(fa?'فعال':'Enable')}</button></div>}]}/>
      </div>
    </div>
    <div className="card"><h4 className="mb8">{fa?"آخرین پاسخ‌ها":"Latest responses"}</h4><DataTable rows={responses.slice(0,100)} columns={[{key:'title_fa',label:t('title')},{key:'user_name',label:t('users')},{key:'context_type',label:'context'},{key:'created_at',label:t('dateTime')}]}/></div>
  </div>
}

export function ResearchAdmin(){
  const {t, lang, user}=useApp();
  const toast=useToast();
  const fa=lang==="fa";
  const empty={title_fa:"",title_en:"",description_fa:"",description_en:"",domain:"education",active:false,consent_required:true,consent_admin_managed:true,
    ethics_code:"",protocol_version:"",consent_text_fa:"",consent_text_en:"",consent_modes:["online","paper","verbal"],anonymize:false};
  const[d,setD]=useState(null);const[events,setEvents]=useState([]);const[edit,setEdit]=useState(empty);const[err,setErr]=useState("");
  const[roster,setRoster]=useState(null);const[rosterId,setRosterId]=useState(null);
  const[decision,setDecision]=useState({user_id:"",blocked:true,note:""});
  const applyDecision=async()=>{
    if(!confirm(fa?"این دستور وضعیت مشارکت و ثبت گفت‌وگوی این فرد را تغییر می‌دهد. ادامه؟":"Change this participant's collection status?"))return;
    try {await api.post(`/research/studies/${rosterId}/participation`,{...decision,user_id:Number(decision.user_id)});toast(t('saved'));loadRoster(rosterId);load();}
    catch(e){setErr(e?.data?.error||e.message);}
  };
  const[rec,setRec]=useState(null);   // { user_id, mode, note } for the paper-consent dialog
  const[forms,setForms]=useState([]);   // questionnaire forms (protocol instruments)
  const[an,setAn]=useState(null);       // analysis of the selected instrument
  const load=()=>Promise.all([api.get('/research/studies').catch(()=>({studies:[]})),api.get('/research/events').catch(()=>({events:[]})),api.get('/questionnaires/admin/forms').catch(()=>({forms:[]}))]).then(([s,e,f])=>{setD(s);setEvents(e.events||[]);setForms(f.forms||[])}).catch(e=>setErr(e.message||String(e)));
  useEffect(() => { load(); }, []);
  const loadRoster=(id)=>{ setRosterId(id); api.get(`/research/studies/${id}/consents`).then(setRoster).catch(e=>setErr(e.message||String(e))); };
  const save=async()=>{try{edit.id?await api.put(`/research/studies/${edit.id}`,edit):await api.post('/research/studies',edit);toast(t('saved'));setEdit(empty);load()}catch(e){setErr(e.message||String(e));toast(t('error')||'Error')}};
  const toggle=async(s)=>{await api.put(`/research/studies/${s.id}`,{...s,active:!s.active});load()};
  const delStudy=async(s)=>{ if(!confirm(t('confirmDelete'))) return; await api.del(`/research/studies/${s.id}`); toast(t('deleted')||t('saved')); if(rosterId===s.id){setRoster(null);setRosterId(null);} load(); };
  const delEvent=async(ev)=>{ if(!confirm(t('confirmDelete'))) return; await api.del(`/research/events/${ev.id}`); load(); };
  const recordConsent=async()=>{
    try{ await api.post(`/research/studies/${rosterId}/consents/record`,rec); toast(t('saved')); setRec(null); loadRoster(rosterId); }
    catch(e){ setErr(e?.data?.error||e.message||String(e)); }
  };
  const exportConsents=async(anon)=>{
    try{ const res=await fetch(`/api/research/studies/${rosterId}/consents.csv${anon?"?anonymize=1":""}`,{headers:{Authorization:`Bearer ${getToken()}`}});
      if(!res.ok) throw new Error(String(res.status));
      const blob=await res.blob(); const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
      a.download=`consents-${rosterId}${anon?'-anonymized':''}.csv`; a.click(); URL.revokeObjectURL(a.href);
    }catch(e){ setErr(e.message||String(e)); }
  };
  const openAnalysis=(id)=>api.get(`/questionnaires/admin/forms/${id}/analysis`).then(setAn).catch(e=>setErr(e.message||String(e)));
  const exportResponses=async(id,anon)=>{
    try{ const res=await fetch(`/api/questionnaires/admin/forms/${id}/responses.csv${anon?"?anonymize=1":""}`,{headers:{Authorization:`Bearer ${getToken()}`}});
      if(!res.ok) throw new Error(String(res.status));
      const blob=await res.blob(); const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
      a.download=`instrument-${id}${anon?'-deidentified':''}.csv`; a.click(); URL.revokeObjectURL(a.href);
    }catch(e){ setErr(e.message||String(e)); }
  };
  const setMode=(m,on)=>{ const cur=Array.isArray(edit.consent_modes)?edit.consent_modes:(edit.consent_modes||'online').split(',');
    setEdit({...edit,consent_modes:on?[...new Set([...cur,m])]:cur.filter(x=>x!==m)}); };
  if(!d)return <Spinner/>;
  const eventCount=events.reduce((m,e)=>{m[e.study_id]=(m[e.study_id]||0)+1;return m;},{});
  return <div className="page">
    <div className="section-title"><h4><Icon name="book" size={18}/>{t('researchAdmin')}</h4><button className="btn btn-ghost btn-sm" onClick={()=>setEdit(empty)}>{fa?"مطالعه جدید":"New study"}</button></div>
    {err&&<div className="ddle-banner bad mb16">{err}</div>}
    <div className="grid grid-2 mb16">
      <div className="card">
        <h4 className="mb8">{fa?"ساخت/ویرایش مطالعه آموزشی":"Create/edit educational study"}</h4>
        <div className="grid grid-2"><label className="field"><span>{fa?"عنوان فارسی":"FA title"}</span><input value={edit.title_fa||""} onChange={e=>setEdit({...edit,title_fa:e.target.value})}/></label><label className="field"><span>{fa?"عنوان انگلیسی":"EN title"}</span><input value={edit.title_en||""} onChange={e=>setEdit({...edit,title_en:e.target.value})}/></label></div>
        <label className="field"><span>{fa?"توضیح فارسی":"FA description"}</span><textarea rows="3" value={edit.description_fa||""} onChange={e=>setEdit({...edit,description_fa:e.target.value})}/></label>
        <label className="field"><span>{fa?"دامنه پژوهش":"Domain"}</span><input value={edit.domain||""} onChange={e=>setEdit({...edit,domain:e.target.value})}/></label>
        <div className="grid grid-2"><label className="toggle-row"><span>{t('active')}</span><input type="checkbox" checked={!!edit.active} onChange={e=>setEdit({...edit,active:e.target.checked})}/></label><label className="toggle-row"><span>{fa?"نیاز به رضایت":"Consent required"}</span><input type="checkbox" checked={!!edit.consent_required} onChange={e=>setEdit({...edit,consent_required:e.target.checked})}/></label></div>

        <label className="toggle-row"><span>{fa?"مدیریت حضوری توسط ادمین — بدون الزام تأیید در سایت":"Admin-managed consent — no website confirmation required"}</span>
          <input type="checkbox" disabled={user?.role!=="admin"} checked={edit.consent_admin_managed!==false} onChange={e=>setEdit({...edit,consent_admin_managed:e.target.checked})}/></label>
        <div className="small muted">{fa?"پیش‌فرض: مدیریت حضوری. نبود رضایت آنلاین و تغییر متن مانع ثبت گفت‌وگو نیست. توقف یا ازسرگیری هر فرد از بخش رضایت‌های مطالعه، فقط با دستور ادمین انجام می‌شود. خاموش‌کردن این گزینه همراه با «نیاز به رضایت»، دروازهٔ رضایت سایت را فعال می‌کند.":"Default: admin-managed. Missing online consent and changed wording do not stop recording. Only an admin can pause/resume a participant below. Turn this off with Consent required on to enable the website consent gate."}</div>
        {/* ---- Informed-consent configuration ---- */}
        <div className="field mt8"><span><b>{fa?"اطلاعات اخلاقی":"Ethics details"}</b></span>
          <div className="grid grid-2">
            <label className="field"><span>{fa?"کد اخلاق":"Ethics code"}</span><input value={edit.ethics_code||""} placeholder="IR.ARUMS.REC.1404.118" onChange={e=>setEdit({...edit,ethics_code:e.target.value})}/></label>
            <label className="field"><span>{fa?"نسخهٔ پروتکل":"Protocol version"}</span><input value={edit.protocol_version||""} placeholder="v1.0" onChange={e=>setEdit({...edit,protocol_version:e.target.value})}/></label>
          </div>
        </div>
        <label className="field"><span>{fa?"متن رضایت‌نامه (فارسی)":"Consent wording (FA)"}</span><textarea rows="4" value={edit.consent_text_fa||""} onChange={e=>setEdit({...edit,consent_text_fa:e.target.value})}/></label>
        <label className="field"><span>{fa?"متن رضایت‌نامه (انگلیسی)":"Consent wording (EN)"}</span><textarea rows="3" value={edit.consent_text_en||""} onChange={e=>setEdit({...edit,consent_text_en:e.target.value})}/></label>
        <div className="field"><span>{fa?"روش‌های مجاز کسب رضایت":"Permitted collection methods"}</span>
          <div className="row gap8" style={{flexWrap:'wrap'}}>
            {[['online',fa?'آنلاین (خود دانشجو)':'Online (self-granted)'],['paper',fa?'کاغذی (پژوهشگر ثبت می‌کند)':'Paper (recorded by researcher)'],['verbal',fa?'شفاهی':'Verbal']].map(([m,lab])=>
              <label key={m} className="toggle-row"><span>{lab}</span><input type="checkbox" checked={(Array.isArray(edit.consent_modes)?edit.consent_modes:String(edit.consent_modes||'online').split(',')).includes(m)} onChange={e=>setMode(m,e.target.checked)}/></label>)}
          </div>
        </div>
        <label className="toggle-row"><span>{fa?"بی‌نام‌سازی در خروجی پژوهش":"De-identify research exports"}</span><input type="checkbox" checked={!!edit.anonymize} onChange={e=>setEdit({...edit,anonymize:e.target.checked})}/></label>
        <div className="small muted">{fa?"خاموش = شمارهٔ دانشجویی در خروجی می‌ماند. روشن = فقط کد مستعار. پیش‌فرض خاموش است.":"Off = student numbers stay in the export. On = pseudonym only. Off by default."}</div>
        {edit.consent_admin_managed===false && edit.consent_required && !(edit.consent_text_fa||'').trim() && !(edit.consent_text_en||'').trim() &&
          <div className="err-banner mt8">{fa?"نیاز به رضایت روشن است ولی متنی ثبت نشده. تا متن نباشد، دانشجو نمی‌تواند رضایت بدهد و ورودش بسته می‌ماند.":"Consent is required but no wording is recorded. Until it is, participants cannot consent and entry stays blocked."}</div>}
        <button className="btn btn-primary" onClick={save}>{t('save')}</button>
        <JsonHint>{fa?"پژوهش‌ها پیش‌فرض خاموش‌اند؛ فقط وقتی فعال شوند event آموزشی ثبت می‌شود.":"Studies are off by default; activate only when educational event collection is intended."}</JsonHint>
      </div>
      <div className="card">
        <h4 className="mb8">{fa?"مطالعات":"Studies"}</h4>
        <DataTable rows={(d.studies||[]).map(s=>({...s,events:eventCount[s.id]||0,status:s.active?(fa?'فعال':'Active'):(fa?'خاموش':'Off')}))} columns={[{key:'title_fa',label:t('title')},{key:'domain',label:'domain'},{key:'events',label:fa?'رویدادها':'Events'},{key:'status',label:t('status')},{key:'actions',label:'',sortable:false,render:(s)=><div style={{display:'flex',gap:6,flexWrap:'wrap'}}><button className="btn btn-ghost btn-sm" onClick={()=>setEdit({...empty,...s})}>{t('edit')}</button><button className="btn btn-ghost btn-sm" onClick={()=>loadRoster(s.id)}>{fa?'رضایت‌ها':'Consents'}</button><button className="btn btn-ghost btn-sm" onClick={()=>toggle(s)}>{s.active?(fa?'خاموش':'Disable'):(fa?'فعال':'Enable')}</button><button className="btn btn-sm btn-danger" onClick={()=>delStudy(s)}>{t('delete')}</button></div>}]}/>
      </div>
    </div>
    {/* ---- Protocol instruments (Tables 1/2/3) ---- */}
    <div className="card mb16">
      <div className="section-title"><h4><Icon name="book" size={16}/> {fa?"ابزارهای پروپوزال":"Protocol instruments"}</h4>
        <span className="tag">{fa?"جدول ۱/۲/۳":"Tables 1/2/3"}</span></div>
      <DataTable rows={forms.filter(f=>f.template_key)} columns={[
        {key:'title_fa',label:t('title')},
        {key:'template_key',label:'key'},
        {key:'active',label:t('status'),render:(f)=>f.active?(fa?'فعال':'Active'):(fa?'خاموش':'Off')},
        {key:'anonymous',label:fa?'بی‌نام':'Anon',render:(f)=>f.anonymous?(fa?'بله':'yes'):(fa?'خیر':'no')},
        {key:'actions',label:'',sortable:false,render:(f)=><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>openAnalysis(f.id)}>{fa?'تحلیل':'Analysis'}</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>exportResponses(f.id,false)}>CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>exportResponses(f.id,true)}>{fa?'CSV بی‌نام':'CSV de-id'}</button>
        </div>}
      ]}/>
      <JsonHint>{fa?"این سه ابزار از متن پروپوزال seed شده‌اند و مثل هر فرم دیگری قابل ویرایش‌اند. پیش‌فرض خاموش‌اند تا پیش از اجرای پژوهش داده‌ای جمع نشود.":"These three are seeded from the protocol text and are editable like any other form. They start inactive so no data is collected before the study runs."}</JsonHint>
      {an && <div className="card mt12" style={{background:'var(--panel2)'}}>
        <h4>{an.form.titleFa||an.form.titleEn}</h4>
        <div className="row gap8 mt8" style={{flexWrap:'wrap'}}>
          <span className="tag">{fa?'پاسخ‌ها':'Responses'}: {an.overall.n}</span>
          <span className="tag">{fa?'میانگین':'Mean'}: {an.overall.mean ?? '—'}</span>
          {an.overall.min!=null && <span className="tag">{fa?'کمترین':'Min'}: {an.overall.min}</span>}
          {an.overall.max!=null && <span className="tag">{fa?'بیشترین':'Max'}: {an.overall.max}</span>}
          {an.nps && <span className="tag">NPS: {an.nps.nps ?? '—'} ({an.nps.promoters}/{an.nps.passives}/{an.nps.detractors})</span>}
          {an.form.anonymized && <span className="tag">{fa?'بی‌نام':'de-identified'}</span>}
        </div>
        <DataTable rows={an.perItem} columns={[
          {key:'fa',label:fa?'معیار':'Criterion'},
          {key:'answered',label:fa?'پاسخ‌داده':'Answered'},
          {key:'mean',label:fa?'میانگین':'Mean'},
          {key:'passRate',label:fa?'نرخ انجام ٪':'Pass %',render:(x)=>x.passRate==null?'—':`${x.passRate}%`},
          {key:'nps',label:'',sortable:false,render:(x)=>x.nps?<span className="tag">NPS</span>:null}
        ]}/>
      </div>}
    </div>
    {roster && <div className="card mb16">
      {user?.role==="admin" && <div className="card mb16">
        <h4>{fa?"دستور ادمین برای مشارکت پژوهشی":"Admin participation decision"}</h4>
        <p className="small">{fa?"شناسهٔ داخلی کاربر (نه شماره دانشجویی) را وارد کنید. توقف، داده‌های قبلی را حذف نمی‌کند. ثبت رضایت کاغذی یا شفاهی به‌تنهایی توقف ادمین را لغو نمی‌کند.":"Use the internal user ID, not the student number. Pausing preserves existing records. Recording paper/verbal consent does not override an admin hold."}</p>
        <label className="field"><span>{fa?"شناسه کاربر":"User ID"}</span><input type="number" min="1" value={decision.user_id} onChange={e=>setDecision({...decision,user_id:e.target.value})}/></label>
        <label className="field"><span>{fa?"دستور":"Decision"}</span><select value={String(decision.blocked)} onChange={e=>setDecision({...decision,blocked:e.target.value==='true'})}>
          <option value="true">{fa?"ثبت انصراف / توقف مشارکت و ثبت گفت‌وگو":"Record withdrawal / pause participation and recording"}</option>
          <option value="false">{fa?"رفع توقف / اجازهٔ ادامه":"Lift hold / allow continuation"}</option>
        </select></label>
        <label className="field"><span>{fa?"توضیح الزامی (مثلاً انصراف حضوری)":"Required note (e.g. in-person withdrawal)"}</span><input value={decision.note} onChange={e=>setDecision({...decision,note:e.target.value})}/></label>
        <button className="btn btn-primary" disabled={!decision.user_id||!decision.note.trim()} onClick={applyDecision}>{fa?"اعمال دستور":"Apply decision"}</button>
        <DataTable rows={roster.participationControls||[]} columns={[{key:'user_id',label:fa?'شناسه کاربر':'User ID'},{key:'blocked',label:fa?'وضعیت':'Status',render:r=>r.blocked?(fa?'متوقف به دستور ادمین':'Paused by admin'):(fa?'مجاز به ادامه':'Allowed')},{key:'note',label:fa?'توضیح':'Note'},{key:'updated_at',label:t('dateTime')}]}/>
      </div>}
      <div className="section-title"><h4><Icon name="shield" size={16}/> {fa?"رضایت‌های مطالعه":"Study consents"} — {roster.study.titleFa||roster.study.titleEn}</h4>
        <div className="row gap8"><button className="btn btn-ghost btn-sm" onClick={()=>exportConsents(false)}>CSV</button>
        <button className="btn btn-ghost btn-sm" onClick={()=>exportConsents(true)}>CSV {fa?'بی‌نام':'de-identified'}</button>
        <button className="btn btn-primary btn-sm" onClick={()=>setRec({user_id:"",mode:"paper",note:""})}>{fa?"ثبت رضایت کاغذی/شفاهی":"Record paper/verbal consent"}</button></div></div>
      <div className="row gap8 small mb8" style={{flexWrap:'wrap'}}>
        <span className="tag">{fa?"کل":"Total"}: {roster.counts.total}</span>
        <span className="tag">{fa?"رضایت داده":"Granted"}: {roster.counts.granted}</span>
        <span className="tag">{fa?"انصراف":"Withdrawn"}: {roster.counts.withdrawn}</span>
        {Object.entries(roster.counts.byMode||{}).filter(([,n])=>n>0).map(([m,n])=><span key={m} className="tag">{m}: {n}</span>)}
        {roster.counts.stale>0 && <span className="tag" style={{background:'var(--bad,#c0392b)',color:'#fff'}}>{fa?`${roster.counts.stale} رضایت مربوط به متن قدیمی`:`${roster.counts.stale} consent(s) cover superseded wording`}</span>}
        {roster.study.ethicsCode && <span className="tag">{roster.study.ethicsCode}</span>}
        {roster.study.protocolVersion && <span className="tag">{roster.study.protocolVersion}</span>}
      </div>
      <DataTable rows={roster.consents} columns={[
        {key:'userId',label:fa?'شناسه داخلی کاربر':'Internal user ID'},
        {key:'pseudonym',label:fa?'کد مستعار':'Pseudonym'},
        {key:'studentNo',label:fa?'شمارهٔ دانشجویی':'Student no.'},
        {key:'mode',label:fa?'روش':'Mode'},
        {key:'status',label:t('status')},
        {key:'protocolVersion',label:fa?'پروتکل':'Protocol'},
        {key:'recorder',label:fa?'ثبت‌کننده':'Recorded by'},
        {key:'note',label:fa?'یادداشت':'Note'},
        {key:'grantedAt',label:t('dateTime')},
        {key:'stale',label:'',sortable:false,render:(c)=>c.stale?<span className="tag" style={{background:'var(--bad,#c0392b)',color:'#fff'}}>{fa?'متن قدیمی':'stale'}</span>:null}
      ]}/>
    </div>}
    {rec && <Modal title={fa?"ثبت رضایت کسب‌شده در بیرون از سامانه":"Record consent collected offline"} onClose={()=>setRec(null)} onSave={recordConsent}>
      <div className="err-banner mb12">{fa?"این ثبت، ارجاع به رضایت حضوری است و جای اصل فرم یا مستندات را نمی‌گیرد. نام ثبت‌کننده و یادداشت نگهداری می‌شود.":"This record references the in-person consent; retain the original form or documentation. The recorder and a required note are kept."}</div>
      <label className="field"><span>{fa?"دانشجو (user_id) — یا خالی بگذارید تا فقط کد مستعار ثبت شود":"Participant user_id — leave blank to record a pseudonym only"}</span><input value={rec.user_id} onChange={e=>setRec({...rec,user_id:e.target.value})}/></label>
      <label className="field"><span>{fa?"روش":"Method"}</span>
        <select value={rec.mode} onChange={e=>setRec({...rec,mode:e.target.value})}>
          {(roster?.study.consentModes||['paper']).filter(m=>m!=='online').map(m=><option key={m} value={m}>{m}</option>)}
        </select></label>
      <label className="field"><span>{fa?"یادداشت (شمارهٔ فرم، تاریخ، محل) — الزامی":"Note (form number, date, place) — required"}</span><textarea rows="3" value={rec.note} onChange={e=>setRec({...rec,note:e.target.value})}/></label>
    </Modal>}
    <div className="card"><h4 className="mb8">{fa?"آخرین رویدادهای پژوهشی":"Latest research events"}</h4>
      <div className="small muted mb8">{fa?"فقط رویداد کلاس/آزمون‌هایی که به یک مطالعه وصل شده‌اند.":"Only events from classes/exams linked to a study."}</div>
      <DataTable rows={events.slice(0,100)} columns={[{key:'title_fa',label:t('title')},{key:'event_type',label:'event'},{key:'context_type',label:'context'},{key:'user_name',label:t('users')},{key:'created_at',label:t('dateTime')},{key:'actions',label:'',sortable:false,render:(ev)=><button className="btn btn-sm btn-danger" onClick={()=>delEvent(ev)}>{t('delete')}</button>}]}/>
    </div>
  </div>
}

function TutorSettingsAdmin(){
  const {t, lang}=useApp();
  const toast=useToast();
  const fa=lang==="fa";
  const[f,setF]=useState(null);const[ctx,setCtx]=useState({classes:[],exams:[]});const[err,setErr]=useState("");
  const load=()=>Promise.all([api.get('/tutor/settings').catch(()=>({enabled:0,ai_enabled:0,default_prompt:''})),api.get('/tutor/context-settings').catch(()=>({classes:[],exams:[]}))]).then(([a,b])=>{setF(a);setCtx(b)}).catch(e=>setErr(e.message||String(e)));
  useEffect(() => { load(); }, []);
  const saveGlobal=async()=>{await api.put('/tutor/settings',f);toast(t('saved'));load()};
  const saveCtx=async(type,row,patch={})=>{const body={contextType:type,contextId:row.id,enabled:patch.enabled??!!row.tutor_enabled,prompt:patch.prompt??row.tutor_prompt??''};await api.put('/tutor/context-settings',body);toast(t('saved'));load()};
  if(!f)return <Spinner/>;
  const Row=({type,row})=><div className="case-item" style={{alignItems:'stretch'}}><div style={{minWidth:0,flex:1}}><b>{row.name_fa||row.title_fa||row.name_en||row.title_en||`#${row.id}`}</b><div className="small muted">{type} #{row.id}</div><textarea rows="2" placeholder={fa?"راهنمای اختصاصی این کلاس/آزمون":"Context-specific tutor prompt"} defaultValue={row.tutor_prompt||""} onBlur={e=>{if(e.target.value!== (row.tutor_prompt||'')) saveCtx(type,row,{prompt:e.target.value})}}/></div><label className="toggle-row" style={{minWidth:120}}><span>{row.tutor_enabled?(fa?'فعال':'On'):(fa?'خاموش':'Off')}</span><input type="checkbox" checked={!!row.tutor_enabled} onChange={e=>saveCtx(type,row,{enabled:e.target.checked})}/></label></div>;
  return <div className="page">
    <div className="section-title"><h4><Icon name="ai" size={18}/>{t('tutorSettings')}</h4></div>
    {err&&<div className="ddle-banner bad mb16">{err}</div>}
    <div className="card mb16"><h4>{fa?"کنترل کلی دکتر راهنما":"Global Dr Tutor control"}</h4><div className="grid grid-2"><label className="toggle-row"><span>{fa?"فعال‌سازی کلی":"Global enabled"}</span><input type="checkbox" checked={!!f.enabled} onChange={e=>setF({...f,enabled:e.target.checked})}/></label><label className="toggle-row"><span>{fa?"استفاده از AI خارجی":"External AI"}</span><input type="checkbox" checked={!!f.ai_enabled} onChange={e=>setF({...f,ai_enabled:e.target.checked})}/></label></div><label className="field"><span>{fa?"پرامپت پیش‌فرض":"Default prompt"}</span><textarea rows="4" value={f.default_prompt||""} onChange={e=>setF({...f,default_prompt:e.target.value})}/></label><button className="btn btn-primary" onClick={saveGlobal}>{t('save')}</button><JsonHint>{fa?"پیشنهاد ایمن: پیش‌فرض خاموش بماند و فقط در کلاس/آزمون‌های منتخب فعال شود. در آزمون‌ها پاسخ نهایی نباید مستقیم لو برود.":"Safe default: keep off by default and enable only in selected classes/exams. In exams, it should guide reasoning, not reveal final answers."}</JsonHint></div>
    <div className="grid grid-2"><div className="card"><h4>{fa?"کلاس‌ها":"Classes"}</h4>{(ctx.classes||[]).length?ctx.classes.map(r=><Row key={`c${r.id}`} type="class" row={r}/>):<div className="small muted">{t('noData')}</div>}</div><div className="card"><h4>{fa?"آزمون‌ها":"Exams"}</h4>{(ctx.exams||[]).length?ctx.exams.map(r=><Row key={`e${r.id}`} type="exam" row={r}/>):<div className="small muted">{t('noData')}</div>}</div></div>
  </div>
}

function ExternalAdsAdmin(){
  const {t, lang}=useApp();
  const toast=useToast();
  const fa=lang==="fa";
  const[d,setD]=useState(null);const[cfg,setCfg]=useState({enabled:0,provider:'none',client_id:'',slot_id:'',placement:'blog',legal_note:''});const[err,setErr]=useState("");
  const load=()=>api.get('/ads/external-config').then(x=>{setD(x);setCfg(x.config||{enabled:0,provider:'none',placement:'blog'})}).catch(e=>setErr(e.message||String(e)));
  useEffect(() => { load(); }, []);
  const save=async()=>{try{const out=await api.put('/ads/external-config',cfg);setCfg(out.config);toast(t('saved'));load()}catch(e){setErr(e.message||String(e));toast(t('error')||'Error')}};
  if(!d)return <Spinner/>;
  const stats=d.stats||[];
  return <div className="page">
    <div className="section-title"><h4><Icon name="image" size={18}/>{t('externalAdsAdmin')}</h4><Pill kind={cfg.enabled?'active':'medium'}>{cfg.enabled?(fa?'فعال':'Enabled'):(fa?'خاموش پیش‌فرض':'Off by default')}</Pill></div>
    {err&&<div className="ddle-banner bad mb16">{err}</div>}
    <div className="grid grid-2 mb16">
      <div className="card"><h4>{fa?"تنظیمات AdSense / تبلیغات خارجی":"AdSense / external ads settings"}</h4><label className="toggle-row"><span>{fa?"فعال‌سازی تبلیغات خارجی":"Enable external ads"}</span><input type="checkbox" checked={!!cfg.enabled} onChange={e=>setCfg({...cfg,enabled:e.target.checked?1:0})}/></label><div className="grid grid-2"><label className="field"><span>provider</span><select value={cfg.provider||'none'} onChange={e=>setCfg({...cfg,provider:e.target.value})}><option value="none">none</option><option value="adsense">adsense</option><option value="custom">custom</option></select></label><label className="field"><span>placement</span><select value={cfg.placement||'blog'} onChange={e=>setCfg({...cfg,placement:e.target.value})}><option value="blog">blog</option><option value="store">store</option><option value="landing">landing</option><option value="learn">learn</option></select></label></div><label className="field"><span>client_id</span><input value={cfg.client_id||""} onChange={e=>setCfg({...cfg,client_id:e.target.value})} placeholder="ca-pub-..."/></label><label className="field"><span>slot_id</span><input value={cfg.slot_id||""} onChange={e=>setCfg({...cfg,slot_id:e.target.value})}/></label><label className="field"><span>{fa?"یادداشت قانونی/حریم خصوصی":"Legal/privacy note"}</span><textarea rows="3" value={cfg.legal_note||""} onChange={e=>setCfg({...cfg,legal_note:e.target.value})}/></label><button className="btn btn-primary" onClick={save}>{t('save')}</button><JsonHint>{fa?"برای حفظ تجربه کاربر و سرعت، پیش‌فرض خاموش است. فقط بعد از تنظیم دامنه، حریم خصوصی و قوانین Google فعال کنید.":"To protect UX and speed, this stays off by default. Enable only after domain, privacy, and Google policy checks."}</JsonHint></div>
      <div className="card"><h4>{fa?"آمار رویدادهای تبلیغ خارجی":"External ad event stats"}</h4>{stats.length?<DataTable rows={stats} columns={[{key:'provider',label:'provider'},{key:'event',label:'event'},{key:'count',label:fa?'تعداد':'Count'}]}/>:<div className="small muted">{t('noData')}</div>}</div>
    </div>
  </div>
}

function AdminCommandPalette({nav,t,pick,onClose}){
  const [q,setQ]=useState('');
  const modeLabel=(m)=>m==="general"?t("generalTab"):m==="uni"?t("uniTab"):t("competitiveTab");
  const rows=nav.filter(([id,,m])=>`${t(id)||id} ${modeLabel(m)}`.toLowerCase().includes(q.toLowerCase()));
  return <Modal title="Command Palette" onClose={onClose}>
    <div className="field"><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Ctrl+K…"/></div>
    <div className="admin-command-list">
      {rows.map(([id,ic,m])=><button key={id} className="btn btn-ghost" onClick={()=>pick(id)}><Icon name={ic} size={14}/><span>{t(id)}</span><small className="muted">{modeLabel(m)}</small></button>)}
      {rows.length===0&&<div className="small muted center" style={{padding:12}}>{t("noData")}</div>}
    </div>
  </Modal>
}
