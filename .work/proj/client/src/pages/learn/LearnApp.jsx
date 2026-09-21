import { lazy, Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useApp } from "../../context.jsx";
import { useScrollLock } from "../../utils/useScrollLock.js";
import { api } from "../../api.js";
import { TopBar, Spinner } from "../../components/UI.jsx";
import Icon from "../../components/Icon.jsx";
import { GemIcon, HeartIcon, XpIcon, StreakIcon } from "../../components/StatIcons.jsx";
import LearnHome from "./LearnHome.jsx";
import { NotificationBell } from "./NotificationBell.jsx";

const LearnPath = lazy(() => import("./LearnPath.jsx"));
const Lesson = lazy(() => import("./Lesson.jsx"));
const LeagueView = lazy(() => import("./LeagueView.jsx"));
const RankingView = lazy(() => import("./RankingView.jsx"));
const Achievements = lazy(() => import("./Achievements.jsx"));
const Premium = lazy(() => import("./Premium.jsx"));
const Challenge = lazy(() => import("./Challenge.jsx"));
const Review = lazy(() => import("./Review.jsx"));
const MyCards = lazy(() => import("./MyCards.jsx"));
const Certificates = lazy(() => import("./Certificates.jsx"));
const Checkpoint = lazy(() => import("./Checkpoint.jsx"));
const Quests = lazy(() => import("./Quests.jsx"));
const RampEvent = lazy(() => import("./RampEvent.jsx"));
const Legendary = lazy(() => import("./Legendary.jsx"));
const Practice = lazy(() => import("./Practice.jsx"));
const Browse = lazy(() => import("./Browse.jsx"));
const Placement = lazy(() => import("./Placement.jsx"));
const DailyChallenge = lazy(() => import("./DailyChallenge.jsx"));
const InviteFriends = lazy(() => import("./InviteFriends.jsx"));
const Friends = lazy(() => import("./Friends.jsx"));
const Library = lazy(() => import("./Library.jsx"));
const Store = lazy(() => import("./Store.jsx"));
const Progress = lazy(() => import("./Progress.jsx"));
const Mistakes = lazy(() => import("./Mistakes.jsx"));
const FlaggedReview = lazy(() => import("./FlaggedReview.jsx"));
const Mastery = lazy(() => import("./Mastery.jsx"));
const Notes = lazy(() => import("./Notes.jsx"));
const ExamSim = lazy(() => import("./ExamSim.jsx"));
const CustomTest = lazy(() => import("./CustomTest.jsx"));
const VirtualPatient = lazy(() => import("./VirtualPatient.jsx"));
const Flashcards = lazy(() => import("../Flashcards.jsx"));
const Mindmap = lazy(() => import("./Mindmap.jsx"));
const StudyPlan = lazy(() => import("./StudyPlan.jsx"));
const Community = lazy(() => import("./Community.jsx"));
const Mnemonics = lazy(() => import("./Mnemonics.jsx"));
const CrowdInsights = lazy(() => import("./CrowdInsights.jsx"));
const Settings = lazy(() => import("./Settings.jsx"));
const Summaries = lazy(() => import("./Summaries.jsx"));

/* HUD shows XP / streak / hearts / gems — the shared currency signals. */
export function Hud({ profile, hideStreak = false }) {
  const { t } = useApp();
  if (!profile) return null;
  return (
    <div className="hud">
      {!hideStreak && <span className="hud-chip flame" title={t("streak")}><StreakIcon size={18} /> {profile.streak}</span>}
      <span className="hud-chip xp" title={t("xp")}><XpIcon size={18} /> {profile.xp}</span>
      <span className="hud-chip gem" title={t("gems")}><GemIcon size={18} /> {profile.gems}</span>
      <span className="hud-chip heart" title={t("hearts")}>
        <HeartIcon size={18} /> {(profile.premium_effective ?? profile.premium) ? "∞" : `${profile.hearts}${profile.hearts_max ? "/" + profile.hearts_max : ""}`}
      </span>
    </div>
  );
}

export default function LearnApp() {
  const { t, lang, flag } = useApp();
  const [tab, setTabState] = useState(() => (typeof window !== "undefined" && /^#browse(\?|$)/.test(window.location.hash) ? "browse" : "home"));
  const [navOpen, setNavOpen] = useState({});   // collapsible nav groups (cleaner menu)
  const [moreOpen, setMoreOpen] = useState(false);
  const [badges, setBadges] = useState({ due: 0, quests: 0 });
  const moreStartY = useRef(0);
  const [history, setHistory] = useState([]);   // previous tabs for the Back button
  const [lessonNode, setLessonNode] = useState(null);
  const [pathFocus, setPathFocus] = useState(null);   // topic slug to scroll to + highlight on the path
  const [profile, setProfile] = useState(null);
  const [calm, setCalm] = useState(null);   // Calm Mode flags (hide streak, etc.)
  const [programs, setPrograms] = useState([]);        // Duolingo-style courses
  const [activeProgram, setActiveProgram] = useState("preint");
  const [vpatientOn, setVpatientOn] = useState(false); // admin-enabled virtual patient (competitive)

  // navigate while remembering where we came from
  const setTab = (next) => { setMoreOpen(false); if (next !== "browse" && /^#browse/.test(window.location.hash)) window.history.replaceState(null, "", window.location.pathname); setTabState((cur) => { if (next !== cur) setHistory((h) => [...h, cur]); return next; }); };
  // jump straight to a specific topic on the learning path (e.g. from the
  // placement "start here" recommendation) — the path scrolls to + highlights it.
  const goToTopic = (slug) => { setPathFocus(slug || null); setTab("path"); };
  const goBack = () => setHistory((h) => {
    if (h.length === 0) { setTabState("home"); return h; }
    const prev = h[h.length - 1]; setTabState(prev); return h.slice(0, -1);
  });

  const loadProfile = useCallback(async () => {
    try { const r = await api.get(`/learn/profile?lang=${lang}`); setProfile(r.profile); setCalm(r.calm || null); } catch { /* */ }
  }, [lang]);
  useEffect(() => { loadProfile(); }, [loadProfile]);
  // Home already loads /learn/home. Skip a second copy on the home tab (LCP/INP).
  const applyHomeStats = useCallback((d) => {
    if (!d) return;
    setBadges({ due: d.dueReviews || 0, quests: d.questsClaimable || 0 });
  }, []);
  useEffect(() => {
    if (tab === "home") return;
    api.get(`/learn/home?lang=${lang}`)
      .then(applyHomeStats)
      .catch(() => {});
  }, [lang, tab, profile?.xp, profile?.hearts, applyHomeStats]);

  // Idle prefetching for core high-frequency interactive chunks (0ms navigation)
  useEffect(() => {
    const prefetch = () => {
      import("./LearnPath.jsx").catch(() => {});
      import("./Lesson.jsx").catch(() => {});
      import("./Browse.jsx").catch(() => {});
      import("./CustomTest.jsx").catch(() => {});
    };
    if (typeof window !== "undefined") {
      if ("requestIdleCallback" in window) {
        const id = window.requestIdleCallback(prefetch, { timeout: 3500 });
        return () => window.cancelIdleCallback(id);
      } else {
        const id = setTimeout(prefetch, 1800);
        return () => clearTimeout(id);
      }
    }
  }, []);

  // Hide the tab bar when the software keyboard covers the thumb zone.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0)) > 90;
      document.documentElement.classList.toggle("kb-open", covered);
    };
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
      document.documentElement.classList.remove("kb-open");
    };
  }, []);

  useScrollLock(moreOpen);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setMoreOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); };
  }, [moreOpen]);

  // load the learner's programs (courses) + which one is active
  const loadPrograms = useCallback(async () => {
    try { const d = await api.get(`/learn/programs?lang=${lang}`); setPrograms(d.programs || []); setActiveProgram(d.active || "preint"); }
    catch { /* */ }
  }, [lang]);
  useEffect(() => { loadPrograms(); }, [loadPrograms]);

  // is the competitive virtual patient turned on (feature flag + admin switch)?
  useEffect(() => {
    api.get("/learn/vpatient", { timeoutMs: 20_000, stage: "boot" })
      .then((d) => setVpatientOn(!!d.enabled))
      .catch(() => setVpatientOn(true));
  }, []);

  const switchProgram = async (slug) => {
    if (slug === activeProgram) return;
    try {
      await api.post("/learn/program", { program: slug });
      setActiveProgram(slug);
      loadProfile();
      setHistory([]); setTabState("path");   // land on the new course's path
      window.dispatchEvent(new CustomEvent("medlab-toast", { detail: t("programSwitched") }));
    } catch { /* */ }
  };

  // Deep-link from gated banks ("upgrade to Plus") and other in-app CTAs.
  useEffect(() => {
    const onGo = (e) => { if (e.detail) setTab(String(e.detail)); };
    window.addEventListener("medlab-go", onGo);
    return () => window.removeEventListener("medlab-go", onGo);
  }, []);

  // Handle return from the payment gateway (?pay=... for premium, ?buy=... for courses).
  // Also reconcile once on every login so a closed bank tab still grants Plus / course.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pay = params.get("pay");
    const buy = params.get("buy");
    const code = pay || buy;
    const msg = {
      success: buy ? t("buySuccess") : t("paySuccess"), canceled: t("payCanceled"),
      failed: t("payFailed"), notfound: t("payFailed"),
      group: t("groupPaySuccess"),
    }[code] || "";
    if (msg) window.dispatchEvent(new CustomEvent("medlab-toast", { detail: msg }));
    api.post("/pay/reconcile").then((r) => {
      if (r?.profile) setProfile(r.profile);
      else loadProfile();
      if (r?.recovered && (!code || code === "failed")) {
        window.dispatchEvent(new CustomEvent("medlab-toast", { detail: t("payRecovered") }));
      }
    }).catch(() => loadProfile());
    if (code === "success" || code === "group") setTabState(buy ? "store" : "premium");
    if (code) window.history.replaceState({}, "", window.location.pathname);
  }, [t, loadProfile]);

  // Nav grouped into scannable sections (19 flat items were overwhelming):
  //  • یادگیری (learn/daily habit) • ابزارها (study tools) • رقابت (compete)
  //  • من (personal) • فروشگاه (store/premium). Each item: [id, icon, label, show].
  const navSections = [
    { title: t("navLearn"), items: [
      ["home", "dashboard", t("learnHome"), true],
      ["path", "book", t("learnPath"), true],
      ["dxChallenge", "target", t("dxTitle"), flag("dx_challenge")],
      ["review", "repeat", t("review"), flag("srs_review")],
      ["quests", "target", t("questsHub"), flag("quests")],
    ] },
    { title: t("navTools"), items: [
      ["placement", "compass", t("placementTitle"), flag("placement")],
      ["practice", "target", t("smartPractice"), flag("smart_practice")],
      // Look-up mode: filter the official question bank by subject/chapter/year.
      ["browse", "search", t("browseTitle"), flag("bank_browse")],
      ["customTest", "exam", lang === "fa" ? "آزمون‌ساز 👑" : "Create test 👑", flag("custom_test")],
      ["summaries", "book", t("summariesTitle"), flag("summaries")],
      ["examSim", "exam", t("examSim"), flag("exam_sim")],
      ["vpatient", "patient", t("vpTitle"), flag("virtual_patient") && vpatientOn],
      ["flashcards", "flask", t("learnFlashNav"), true],
      ["checkpoint", "medal", t("checkpointNav"), flag("checkpoint")],
      ["studyPlan", "book", t("studyPlan"), flag("study_plan")],
      ["mindmap", "chart", t("mindmaps"), flag("mindmap")],
      ["mnemonics", "bulb", t("mnemonics"), flag("mnemonics")],
      ["crowd", "activity", t("crowdInsights"), flag("crowd_insights")],
    ] },
    { title: t("navCompete"), items: [
      ["friends", "users", t("friends"), flag("friends")],
      ["invite", "users", t("inviteTitle"), flag("referral")],
      ["league", "medal", t("league"), flag("leagues")],
      ["ranking", "chart", t("ranking"), flag("ranking")],
      ["rampEvent", "bolt", t("rampEvent"), flag("ramp_event")],
      ["challenge", "trophy", t("challenges"), flag("challenges")],
      ["community", "users", t("community"), flag("community")],
      ["achievements", "trophy", t("achievements"), flag("achievements")],
    ] },
    { title: t("navMine"), items: [
      ["progress", "chart", t("myProgress"), flag("progress")],
      ["mastery", "medal", t("masteryTitle"), flag("mastery")],
      ["flagged", "target", t("flaggedReview"), flag("flagged_review")],
      ["certificates", "medal", t("myCertificates"), flag("certificates")],
      ["notes", "edit", t("myNotes"), flag("notes")],
      ["mycards", "edit", t("myCards"), flag("learner_cards")],
      ["library", "crown", t("premiumLibrary"), flag("premium") && (profile?.premium_effective ?? profile?.premium)],
      ["settings", "settings", t("settings"), true],
    ] },
    { title: t("navStore"), items: [
      ["store", "store", t("store"), flag("store")],
      ["premium", "crown", t("premium"), flag("premium")],
    ] },
  ].map((sec) => ({ ...sec, items: sec.items.filter((n) => n[3]) })).filter((sec) => sec.items.length);
  const nav = navSections.flatMap((s) => s.items);

  const openLesson = (nodeId) => { setLessonNode(nodeId); setTab("lesson"); };
  const openLegendary = (nodeId) => { setLessonNode(nodeId); setTab("legendary"); };

  // Admin kill-switch: a tab whose feature flag is OFF (filtered out of the nav
  // above) never renders its page — deep links get a friendly notice instead.
  const allTabIds = new Set(["home", "path", "lesson", "legendary", "settings", ...(flag("premium") ? ["premium"] : []), ...nav.map((n) => n[0])]);
  const knownTab = ["premium","dxChallenge","review","quests","placement","practice","browse","customTest","summaries","examSim","vpatient","flashcards","checkpoint","studyPlan","mindmap","mnemonics","crowd","friends","invite","league","ranking","rampEvent","challenge","community","achievements","progress","mastery","flagged","certificates","notes","mycards","library","store"].includes(tab);
  const tabDisabled = knownTab && !allTabIds.has(tab);
  let page;
  if (tabDisabled)
    page = (
      <div className="page"><div className="card empty-state">
        <div className="ico">🔒</div>
        <h3>{lang === "fa" ? "این قابلیت فعلاً غیرفعال است" : "This feature is currently off"}</h3>
        <div className="muted small">{lang === "fa" ? "مدیر سایت این بخش را خاموش کرده است." : "The site admin has switched this section off."}</div>
        <button className="btn btn-primary mt16" onClick={() => setTab("home")}>{t("learnHome")}</button>
      </div></div>
    );
  else if (tab === "lesson" && lessonNode)
    page = <Lesson nodeId={lessonNode} onDone={() => { setTab("path"); loadProfile(); }} onProfile={setProfile} onContinueLesson={(id) => { setLessonNode(id); loadProfile(); }} onPremiumWanted={() => { setLessonNode(null); setTab("premium"); }} />;
  else if (tab === "legendary" && lessonNode)
    page = <Legendary nodeId={lessonNode} onProfile={setProfile} onDone={() => { setTab("path"); loadProfile(); }} />;
  else if (tab === "home") page = <LearnHome go={setTab} goToTopic={goToTopic} openLesson={openLesson} profile={profile} onProfile={setProfile} onHomeStats={applyHomeStats} />;
  else if (tab === "path") page = <LearnPath openLesson={openLesson} openLegendary={openLegendary} focusSlug={pathFocus} onFocused={() => setPathFocus(null)} onProfile={setProfile} />;
  else if (tab === "dxChallenge") page = <DailyChallenge onProfile={loadProfile} />;
  else if (tab === "league") page = <LeagueView />;
  else if (tab === "ranking") page = <RankingView />;
  else if (tab === "challenge") page = <Challenge />;
  else if (tab === "quests") page = <Quests onProfile={setProfile} />;
  else if (tab === "rampEvent") page = <RampEvent onProfile={setProfile} onBack={goBack} />;
  else if (tab === "friends") page = <Friends onProfile={setProfile} />;
  else if (tab === "practice") page = <Practice onProfile={setProfile} onBack={goBack} />;
  else if (tab === "browse") page = <Browse />;
  else if (tab === "summaries") page = <Summaries />;
  else if (tab === "placement") page = <Placement onProfile={setProfile} onBack={() => setTab("home")} />;
  else if (tab === "library") page = <Library />;
  else if (tab === "store") page = <Store />;
  else if (tab === "progress") page = <Progress go={setTab} onProgramChange={(slug) => { setActiveProgram(slug); loadProfile(); }} />;
  else if (tab === "mistakes") page = <Mistakes onProfile={setProfile} onBack={goBack} />;
  else if (tab === "flagged") page = <FlaggedReview onProfile={setProfile} onBack={goBack} />;
  else if (tab === "mastery") page = <Mastery onBack={goBack} />;
  else if (tab === "examSim") page = <ExamSim onProfile={setProfile} onBack={goBack} onPremium={() => setTab("premium")} />;
  else if (tab === "customTest") page = <CustomTest onProfile={setProfile} onBack={goBack} onPremium={() => setTab("premium")} />;
  else if (tab === "vpatient") page = <VirtualPatient onProfile={setProfile} onBack={goBack} />;
    else if (tab === "flashcards") page = <Flashcards home={goBack} embedded />;
  else if (tab === "checkpoint") page = <Checkpoint onProfile={setProfile} />;
  else if (tab === "studyPlan") page = <StudyPlan onBack={goBack} openMindmap={() => setTab("mindmap")} />;
  else if (tab === "mindmap") page = <Mindmap onBack={goBack} />;
  else if (tab === "mnemonics") page = <Mnemonics onBack={goBack} />;
  else if (tab === "community") page = <Community onBack={goBack} />;
  else if (tab === "crowd") page = <CrowdInsights onBack={goBack} />;
  else if (tab === "notes") page = <Notes onBack={goBack} />;
  else if (tab === "review") page = <Review onProfile={setProfile} go={setTab} />;
  else if (tab === "mycards") page = <MyCards />;
  else if (tab === "certificates") page = <Certificates />;
  else if (tab === "achievements") page = <Achievements />;
  else if (tab === "invite") page = <InviteFriends onProfile={loadProfile} />;
  else if (tab === "premium") page = <Premium onProfile={(p) => { setProfile(p); }} />;
  else if (tab === "settings") page = <Settings />;

  const tabbarIds = ["home", "path", "review", "browse"];
  const immersive = tab === "lesson" || tab === "legendary";
  const tabbarActive = (id) => tab === id || (id === "path" && immersive);
  const moreActive = !tabbarIds.includes(tab) && !immersive;

  return (
    <div className={`app has-mobile-tabbar${immersive ? " is-immersive-lesson" : ""}${moreOpen ? " more-open" : ""}`}>
      <a className="skip-link" href="#learn-main">{lang === "fa" ? "پرش به محتوای اصلی" : "Skip to main content"}</a>
      <TopBar onHome={() => setTab("home")} />
      <div className="learn-shell" style={{ paddingTop: 14, paddingBottom: 40 }}>
        <div className={`learn-topline${tab === "home" ? " on-home" : ""}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div className="learn-topline-main" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {history.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={goBack} title={t("back")}>
                <Icon name={lang === "fa" ? "chevronRight" : "chevronLeft"} size={16} /> {t("back")}
              </button>
            )}
            <Hud profile={profile} hideStreak={calm?.enabled && calm?.hideStreak} />
          </div>
          <NotificationBell onNavigate={(link) => setTab(link)} />
        </div>
        <div className="learn-layout">
          <div className="learn-nav">
            {/* Program (course) selector — Duolingo-style. Shown only when there
                is more than one program available. */}
            {programs.length > 1 && (
              <div className="program-switch">
                <div className="learn-nav-title">{t("program")}</div>
                {programs.map((p) => (
                  <button key={p.slug} className={`program-opt ${activeProgram === p.slug ? "active" : ""}`}
                    onClick={() => switchProgram(p.slug)} title={p.label}>
                    <span className="program-emoji">{p.emoji}</span>
                    <span className="program-label">{p.label}</span>
                  </button>
                ))}
              </div>
            )}
            {navSections.map((sec) => {
              // Groups are open by default (nothing hidden); the learner can
              // collapse any group to declutter, and that choice persists. A group
              // holding the active tab is always shown.
              const hasActive = sec.items.some(([id]) => tab === id || (id === "path" && tab === "lesson"));
              const open = hasActive ? true : (navOpen[sec.title] ?? true);
              return (
                <div className={`learn-nav-group ${open ? "open" : "collapsed"}`} key={sec.title}>
                  <button className="learn-nav-title" onClick={() => setNavOpen((o) => ({ ...o, [sec.title]: !open }))} aria-expanded={open}>
                    <span>{sec.title}</span>
                    <Icon name={open ? "chevronUp" : "chevronDown"} size={14} />
                  </button>
                  {/* Items are always in the DOM (so mobile's horizontal bar shows
                      them all); on desktop a collapsed group hides them via CSS. */}
                  {sec.items.map(([id, ico, label]) => (
                    <button key={id} className={`nav-item ${tab === id || (id === "path" && tab === "lesson") ? "active" : ""}`} onClick={() => setTab(id)}>
                      <Icon name={ico} size={18} /> {label}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          {/* key includes the active program so every program-scoped page
              (path, home, exam-sim, mind-map, study-plan, crowd, mnemonics)
              remounts and re-fetches fresh data when the course is switched. */}
          <div id="learn-main" tabIndex="-1" style={{ minWidth: 0 }} key={`${tab}:${activeProgram}`}>
            <Suspense fallback={<div className="route-fallback" role="status" aria-live="polite"><Spinner /></div>}>
              {page}
            </Suspense>
          </div>
        </div>
      </div>
      {!immersive && (
      <nav className="learn-tabbar" aria-label={t("navLearn")}>
        <button type="button" className={tabbarActive("home") ? "active" : ""} aria-current={tabbarActive("home") ? "page" : undefined} onClick={() => setTab("home")}>
          <Icon name="dashboard" size={22} /><span>{t("navTabHome")}</span>
        </button>
        <button type="button" className={tabbarActive("path") ? "active" : ""} aria-current={tabbarActive("path") ? "page" : undefined} onClick={() => setTab("path")}>
          <Icon name="book" size={22} /><span>{t("navTabPath")}</span>
        </button>
        {flag("srs_review") && <button type="button" className={tabbarActive("review") ? "active" : ""} aria-current={tabbarActive("review") ? "page" : undefined} onClick={() => setTab("review")}>
          <Icon name="repeat" size={22} /><span>{t("navTabReview")}</span>
          {badges.due > 0 && <i className="tab-badge">{badges.due > 99 ? "99+" : badges.due}</i>}
        </button>}
        {flag("bank_browse") && <button type="button" className={tabbarActive("browse") ? "active" : ""} aria-current={tabbarActive("browse") ? "page" : undefined} onClick={() => setTab("browse")}>
          <Icon name="search" size={22} /><span>{t("navTabBrowse")}</span>
        </button>}
        <button type="button" className={moreActive || moreOpen ? "active" : ""} aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
          <Icon name="menu" size={22} /><span>{t("navMore")}</span>
          {badges.quests > 0 && <i className="tab-badge">{badges.quests > 9 ? "9+" : badges.quests}</i>}
        </button>
      </nav>
      )}
      {moreOpen && (
        <div className="learn-more-overlay" onClick={() => setMoreOpen(false)}>
          <div className="learn-more-sheet" role="dialog" aria-modal="true" aria-label={t("navMoreTitle")} onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => { moreStartY.current = e.touches[0].clientY; }}
            onTouchEnd={(e) => { if (e.changedTouches[0].clientY - moreStartY.current > 72) setMoreOpen(false); }}>
            <div className="learn-more-handle" />
            <div className="learn-more-head">
              <b>{t("navMoreTitle")}</b>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMoreOpen(false)}>{t("navCloseMore")}</button>
            </div>
            {programs.length > 1 && (
              <div className="learn-more-sec">
                <div className="learn-nav-title">{t("program")}</div>
                <div className="learn-more-grid">
                  {programs.map((p) => (
                    <button key={p.slug} type="button" className={`learn-more-item ${activeProgram === p.slug ? "active" : ""}`}
                      onClick={() => switchProgram(p.slug)}>
                      <span>{p.emoji}</span> {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {navSections.map((sec) => (
              <div className="learn-more-sec" key={sec.title}>
                <div className="learn-nav-title">{sec.title}</div>
                <div className="learn-more-grid">
                  {sec.items.map(([id, ico, label]) => (
                    <button key={id} type="button" className={`learn-more-item ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
                      <Icon name={ico} size={18} /> {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
