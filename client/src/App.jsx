import { useState, useEffect, lazy, Suspense } from "react";
import { useApp } from "./context.jsx";
import { Toast, Spinner } from "./components/UI.jsx";
import { AppBootSkeleton } from "./components/Skeleton.jsx";
import ConnectionBanner from "./components/ConnectionBanner.jsx";
// Landing + Login stay eager — they're the first paint for logged-out visitors.
import Landing from "./pages/Landing.jsx";
// Everything else is code-split (React.lazy) so each audience downloads only
// the JavaScript it actually uses. Big win: the huge Admin bundle is never
// shipped to learners/visitors, and the learner app isn't shipped to admins.
import { routeChunks, intentProps } from "./lib/routes-prefetch.js";
const Login = lazy(routeChunks.login);
const Blog = lazy(routeChunks.blog);
const PublicStore = lazy(routeChunks.store);
const VerifyCertificate = lazy(routeChunks.verify);
const VirtualPatientPage = lazy(routeChunks.vp);
const StudentHome = lazy(routeChunks.studentHome);
const CaseList = lazy(routeChunks.caseList);
const Exam = lazy(routeChunks.exam);
const Flashcards = lazy(routeChunks.flashcards);
const Classes = lazy(routeChunks.classes);
const StudentExams = lazy(routeChunks.studentExams);
const Profile = lazy(routeChunks.profile);
const Admin = lazy(routeChunks.admin);
const LearnApp = lazy(routeChunks.learnApp);
const Maintenance = lazy(routeChunks.maintenance);
const InstallPrompt = lazy(routeChunks.installPrompt);
const SupportWidget = lazy(routeChunks.supportWidget);
const DrTutorChat = lazy(routeChunks.drTutor);
const QuestionnairePrompt = lazy(routeChunks.questionnaire);
import { api } from "./api.js";
import { safeSession } from "./lib/storage.js";
import PasswordNudge from "./components/PasswordNudge.jsx";

/* A lightweight, full-screen fallback shown while a lazy route chunk loads.
   Kept minimal to avoid layout shift; it inherits the theme background. */
function RouteFallback() {
  return <div className="route-fallback"><AppBootSkeleton /></div>;
}

/* Public wrapper: provides a single <Suspense> boundary so any lazily-loaded
   page can stream in without crashing, then renders the real app. */
export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <AppInner />
    </Suspense>
  );
}

function AppInner() {
  const { user, ready } = useApp();
  const [route, setRoute] = useState({ name: "home" });
  const [toast, setToast] = useState("");
  // logged-out view: "landing" (marketing) → "login" or "signup" (auth form)
  // If the visitor lands directly on a /blog URL, open the public blog first.
  const initialBlog = typeof window !== "undefined" && /^\/blog(\/|$)/.test(window.location.pathname);
  const initialVerify = typeof window !== "undefined" && /^\/verify(\/|$)/.test(window.location.pathname);
  const initialStore = typeof window !== "undefined" && /^\/store(\/|$)/.test(window.location.pathname);
  const initialAdmin = typeof window !== "undefined" && /^\/admin(\/|$)/.test(window.location.pathname);
  const [authView, setAuthView] = useState(initialVerify ? "verify" : initialAdmin ? "login" : initialStore ? "store" : initialBlog ? "blog" : "landing");
  const [maintenance, setMaintenance] = useState(null); // public site config: maintenance flag
  const [publicConfig, setPublicConfig] = useState(null);

  // Poll the public site config so maintenance mode reflects for everyone
  // (admins are exempt and keep full access). Pauses when tab is hidden to save battery.
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      api.get("/site-content/config").then((c) => {
        if (!alive) return;
        setPublicConfig(c);
        setMaintenance(c.maintenance || { on: false });
      }).catch(() => {});
    };
    load();
    const id = setInterval(load, 60000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
    // R64: the config is the same for every visitor (no auth dependence). Depending on
    // [user] refetched it once more after /auth/me, a duplicate first-load request.
  }, []);

  // Idle prefetch for the learner shell / student university routes when logged in
  useEffect(() => {
    if (!user?.role || typeof window === "undefined") return;
    const prefetch = () => {
      if (user.role === "learner") {
        import("./pages/learn/LearnApp.jsx").catch(() => {});
      } else if (user.role === "student") {
        import("./pages/Classes.jsx").catch(() => {});
        import("./pages/StudentExams.jsx").catch(() => {});
        import("./pages/Flashcards.jsx").catch(() => {});
        import("./pages/Exam.jsx").catch(() => {});
        import("./pages/CaseList.jsx").catch(() => {});
      }
    };
    // R94: start only after the window load event. A 1.5 s / 3 s timer fired inside the
    // dashboard's LCP window on slow phones (Lighthouse cold, Slow 4G: LCP ~3.9 s, prefetch
    // competing for the same bandwidth and main thread).
    let idleId = null;
    let timerId = null;
    const schedule = () => {
      if ("requestIdleCallback" in window) idleId = window.requestIdleCallback(prefetch, { timeout: 5000 });
      else timerId = setTimeout(prefetch, 2000);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (idleId !== null && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
      if (timerId !== null) clearTimeout(timerId);
    };
  }, [user]);

  useEffect(() => {
    const h = (e) => { setToast(e.detail); setTimeout(() => setToast(""), 2200); };
    const nav = (e) => { if (e.detail === "profile") setRoute({ name: "profile" }); };
    window.addEventListener("medlab-toast", h);
    window.addEventListener("medlab-nav", nav);
    return () => { window.removeEventListener("medlab-toast", h); window.removeEventListener("medlab-nav", nav); };
  }, []);

  // Reset in-app route when user changes. Staff/admin live under /admin so the
  // admin panel is a real, shareable page instead of being mounted on the public
  // home URL. Learners/students stay on the learning/student shell.
  useEffect(() => {
    setRoute({ name: "home" });
    if (typeof window === "undefined") return;
    if (user && !["student", "learner"].includes(user.role)) {
      if (!/^\/admin(\/|$)/.test(window.location.pathname)) window.history.replaceState({}, "", "/admin");
    } else if (user && /^\/(admin|vp)(\/|$)/i.test(window.location.pathname)) {
      window.history.replaceState({}, "", "/");
    }
  }, [user]);

  // A new screen (sign-in, sign-out, auth step, or route) starts at the top. The page
  // offset that remained after sign-in came from scroll anchoring, which is disabled in
  // styles.css (html{overflow-anchor:none}). Blur first so a restored focus does not scroll.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = document.activeElement;
    if (el && el !== document.body && typeof el.blur === "function") el.blur();
    window.scrollTo({ top: 0 });
  }, [user?.id, authView, route.name]);

  if (!ready) return <AppBootSkeleton />;

  // Public certificate verification is available to everyone (even logged-in
  // users) at /verify or /verify/:serial — a shareable, no-login trust page.
  if (typeof window !== "undefined" && /^\/verify(\/|$)/.test(window.location.pathname)) {
    const vser = (/^\/verify\/([^/?]+)/.exec(window.location.pathname) || [])[1];
    return (<><VerifyCertificate serial={vser ? decodeURIComponent(vser) : ""} onHome={() => { window.history.pushState({}, "", "/"); window.location.reload(); }} /><Toast msg={toast} /></>);
  }

  // Maintenance mode: everyone except admins sees the maintenance screen.
  // Logged-out visitors still get a way to the login form (so admins can sign
  // in and turn maintenance off) — the maintenance screen has an admin-login link.
  if (maintenance?.on && (!user || user.role !== "admin")) {
    if (!user && authView === "login") {
      return (<><ConnectionBanner /><Login initialMode="login" onBackHome={() => setAuthView("landing")} /><Toast msg={toast} /></>);
    }
    return (<><ConnectionBanner /><Maintenance info={maintenance} onAdminLogin={() => setAuthView("login")} /><Toast msg={toast} /></>);
  }

  if (!user) {
    const adminPath = typeof window !== "undefined" && /^\/admin(\/|$)/.test(window.location.pathname);
    // /VP is the public virtual-patient page with a student-number sign-in. It is
    // shown only to logged-out visitors; a successful sign-in moves to the app.
    if (typeof window !== "undefined" && /^\/vp(\/|$)/i.test(window.location.pathname)) {
      return (<><ConnectionBanner /><Suspense fallback={<Spinner />}><VirtualPatientPage /></Suspense><Toast msg={toast} /></>);
    }
    if (adminPath && authView === "login") {
      return (<><ConnectionBanner /><Login initialMode="login" onBackHome={() => { window.history.pushState({}, "", "/"); setAuthView("landing"); }} /><Toast msg={toast} /></>);
    }
    // Auth (login/signup) opens as a small MODAL over the still-visible landing,
    // so the marketing page stays behind it and the popover just opens/closes.
    const authOpen = authView === "login" || authView === "signup";
    return (
      <>
        <ConnectionBanner />
        {(authView === "landing" || authOpen) && <Landing publicConfig={publicConfig} authWarmProps={() => intentProps("login")} onGetStarted={() => setAuthView("signup")} onSignIn={() => setAuthView("login")} onStore={() => { window.history.pushState({}, "", "/store"); setAuthView("store"); }} onBlog={() => { window.history.pushState({}, "", "/blog"); setAuthView("blog"); }} />}
        {authView === "blog" && <Blog
          slug={(/^\/blog\/([^/?]+)/.exec(window.location.pathname) || [])[1] ? decodeURIComponent(/^\/blog\/([^/?]+)/.exec(window.location.pathname)[1]) : null}
          onHome={() => { window.history.pushState({}, "", "/"); setAuthView("landing"); }}
          onGetStarted={() => setAuthView("signup")} onSignIn={() => setAuthView("login")} />}
        {authView === "store" && <PublicStore
          onHome={() => { window.history.pushState({}, "", "/"); setAuthView("landing"); }}
          onRequireAuth={() => setAuthView("signup")} />}
        {authOpen &&
          <Login asModal initialMode={authView === "signup" ? "signup" : "login"} onBackHome={() => setAuthView("landing")} />}
        <Suspense fallback={null}><InstallPrompt suppressed={authOpen} waitForScroll /></Suspense>
        <Toast msg={toast} />
      </>
    );
  }

  const impersonating = safeSession.getItem("medlab_admin_token");
  const ImpBanner = impersonating ? <ImpersonationBanner /> : null;

  const go = (name, params = {}) => setRoute({ name, ...params });
  const home = () => setRoute({ name: "home" });

  let page;
  if (user.role === "learner") {
    page = <LearnApp />;
  } else if (route.name === "profile") {
    page = <Profile home={home} />;
  } else if (user.role === "student") {
    if (route.name === "classes") page = <Classes go={go} home={home} />;
    else if (route.name === "exams") page = <StudentExams go={go} home={home} />;
    else if (route.name === "caseList") page = <CaseList go={go} home={home} />;
    else if (route.name === "exam") page = <Exam caseId={route.caseId} classId={route.classId} examId={route.examId} examDuration={route.examDuration} untimed={route.untimed} antiCheat={route.antiCheat} go={go} home={home} />;
    else if (route.name === "flashcards") page = <Flashcards examId={route.examId} flashcardIds={route.flashcardIds} examDuration={route.examDuration} shuffle={route.shuffle} antiCheat={route.antiCheat} competition={route.competition} classId={route.classId} classFlashcardId={route.classFlashcardId} classCombined={route.classCombined} showCorrect={route.showCorrect} showHints={route.showHints} noPenalty={route.noPenalty} allowBack={route.allowBack} allowChange={route.allowChange} go={go} home={home} />;
    else page = <StudentHome go={go} />;
  } else {
    page = <Admin home={home} />;
  }

  // R95: the type and its id must match (exam -> examId, class -> classId); a list page with
  // nothing selected is "general". The old pairs ("exam" with a classId, "class"/"exam" with null)
  // made the server answer 403 on every classes and exams list visit.
  const isExam = route.name === "exam";
  const { contextType, contextId } = isExam && route.examId ? { contextType: "exam", contextId: route.examId }
    : isExam && route.classId ? { contextType: "class", contextId: route.classId }
    : { contextType: "general", contextId: null };
  const studentTools = user.role === "student"
    ? <Suspense fallback={null}><QuestionnairePrompt contextType={contextType} contextId={contextId} /><DrTutorChat contextType={contextType} contextId={contextId} /></Suspense>
    : user.role === "learner"
    ? <Suspense fallback={null}><QuestionnairePrompt contextType="general" contextId={null} /><DrTutorChat contextType="general" contextId={null} /></Suspense>
    : null;
  return <><ConnectionBanner />{ImpBanner}{route.name !== "profile" && <PasswordNudge />}{page}{studentTools}<Suspense fallback={null}><SupportWidget /></Suspense><Suspense fallback={null}><InstallPrompt /></Suspense><Toast msg={toast} /></>;
}

function ImpersonationBanner() {
  const { t, user, lang, exitImpersonation } = useApp();
  const exit = () => { exitImpersonation(); };
  return (
    <div className="imp-banner">
      <span>{t("impersonating")}: {lang === "fa" ? user.name_fa : user.name_en}</span>
      <button type="button" onClick={exit}>{t("exitImpersonate")}</button>
    </div>
  );
}
