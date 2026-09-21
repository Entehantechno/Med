/* routes-prefetch.js — one registry of lazy-route importers shared by App.jsx
   (React.lazy) and by intent/idle prefetchers.

   Why: a lazy chunk only starts downloading when the route first renders, so
   the FIRST click on «ورود» (or on a student nav card like Flashcards/VP)
   pays a full network round trip on slow connections. Dynamic import() calls
   with the same specifier are deduplicated by the module graph — calling the
   importer EARLY (hover / touchstart / browser idle) warms the HTTP cache and
   the module cache, so the later click renders instantly.

   Research basis: intent-based prefetch (pointerenter/touchstart/focus) plus
   requestIdleCallback warming of likely-next routes is the standard pattern
   for React.lazy waterfalls (web.dev / Next-style prefetch). */

export const routeChunks = {
  login: () => import("../pages/Login.jsx"),
  blog: () => import("../pages/Blog.jsx"),
  store: () => import("../pages/PublicStore.jsx"),
  verify: () => import("../pages/VerifyCertificate.jsx"),
  studentHome: () => import("../pages/StudentHome.jsx"),
  caseList: () => import("../pages/CaseList.jsx"),
  exam: () => import("../pages/Exam.jsx"),
  flashcards: () => import("../pages/Flashcards.jsx"),
  classes: () => import("../pages/Classes.jsx"),
  studentExams: () => import("../pages/StudentExams.jsx"),
  profile: () => import("../pages/Profile.jsx"),
  admin: () => import("../pages/Admin.jsx"),
  learnApp: () => import("../pages/learn/LearnApp.jsx"),
  maintenance: () => import("../pages/Maintenance.jsx"),
  installPrompt: () => import("../components/InstallPrompt.jsx"),
  supportWidget: () => import("../components/SupportWidget.jsx"),
  drTutor: () => import("../components/DrTutorChat.jsx"),
  questionnaire: () => import("../components/QuestionnairePrompt.jsx"),
};

const warmed = new Set();

/** Warm a route chunk (idempotent, never throws, never rejects). */
export function warm(name) {
  if (warmed.has(name)) return;
  const factory = routeChunks[name];
  if (!factory) return;
  warmed.add(name);
  try { Promise.resolve(factory()).catch(() => { warmed.delete(name); }); }
  catch { warmed.delete(name); }
}

/** Schedule a callback for browser idle time (falls back to a timeout). */
export function onIdle(fn, timeout = 1800) {
  try {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => fn(), { timeout });
      return () => window.cancelIdleCallback(id);
    }
  } catch { /* ignore */ }
  const t = setTimeout(fn, timeout);
  return () => clearTimeout(t);
}

/** Warm several chunks one-by-one during idle time (network-friendly). */
export function warmIdleSequence(names, gapMs = 350) {
  let cancelled = false;
  let cancelIdle = () => {};
  let i = 0;
  const step = () => {
    if (cancelled || i >= names.length) return;
    warm(names[i++]);
    if (i < names.length) cancelIdle = onIdle(step, gapMs);
  };
  cancelIdle = onIdle(step, gapMs);
  return () => { cancelled = true; cancelIdle(); };
}

/** Props to spread on a link/button so its route warms on the earliest intent
   signal (first pointer contact beats click by hundreds of ms). */
export function intentProps(name) {
  const go = () => warm(name);
  return { onPointerEnter: go, onPointerDown: go, onTouchStart: go, onFocus: go };
}
