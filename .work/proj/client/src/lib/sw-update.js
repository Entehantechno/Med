/* ============================================================================
   sw-update — silent, safe application updates for the PWA.
   ----------------------------------------------------------------------------
   Why this exists
   • Previously an "A new version is ready — Update & reload" toast was shown.
     sw.js already calls skipWaiting() during install, so by the time the toast
     rendered there was usually no *waiting* worker any more and the button did
     nothing. Users saw a dead button on every visit. (Reported in v70.)
   • Research-backed pattern (web.dev "service-worker lifecycle", Workbox
     "advanced recipes", Chrome DevRel): new SW → skipWaiting + clients.claim,
     then the page reloads ONCE on `controllerchange` — but never in the middle
     of user work (typing, an exam, a lesson step, an open dialog).

   What it does
   1. Registers /sw.js with updateViaCache:"none" so the browser always fetches
      a fresh sw.js (our server also sends Cache-Control: no-cache for it).
   2. Checks for updates on start, whenever the tab becomes visible again and
      every 30 minutes — long-lived tabs (kiosk mode, "add to home screen")
      would otherwise never notice a deploy.
   3. When a new worker takes control, reload at the first SAFE moment:
        - not while an exam / lesson / virtual patient / immersive page is active
          (document.body.dataset.busy === "1", set by those screens), or
        - a form control is focused, or a modal is open.
      If unsafe now, we retry on visibilitychange / focus / every 20 s.
   4. Vite "vite:preloadError" (a lazy chunk 404s because the hashes changed
      after a deploy) → reload once (guarded by sessionStorage) instead of a
      broken page.
   Nothing is shown to the user. The reload is the same as pressing F5; all
   state is in the DB/localStorage so nothing is lost.
   ========================================================================== */
import { safeSession } from "./storage.js";

const CHECK_EVERY_MS = 30 * 60 * 1000;
const RETRY_MS = 20 * 1000;
const PRELOAD_KEY = "medlab_preload_reload";

let pendingReload = false;
let reloading = false;
let firstControllerSeen = typeof navigator !== "undefined" && !!navigator.serviceWorker?.controller;

/* Is it OK to blow the page away right now? */
export function isSafeToReload() {
  if (typeof document === "undefined") return false;
  if (document.visibilityState !== "visible") return true;       // background tab: nobody is looking
  if (document.body?.dataset?.busy === "1") return false;         // exam/lesson/VP marked busy
  if (document.querySelector(".modal-back, [role=dialog][aria-modal=true]")) return false;
  const ae = document.activeElement;
  if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return false;
  if (ae && ae.isContentEditable) return false;
  return true;
}

function doReload() {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}

function tryReload() {
  if (!pendingReload) return;
  if (isSafeToReload()) doReload();
}

/* Screens with in-progress work call markBusy(true) on mount and markBusy(false)
   on unmount; the reload waits until they are gone. */
export function markBusy(on) {
  try {
    if (on) document.body.dataset.busy = "1";
    else delete document.body.dataset.busy;
    if (!on) setTimeout(tryReload, 400);   // leaving the busy screen = good moment
  } catch { /* ignore */ }
}

export function initSwUpdate() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  // 4) stale lazy chunks after a deploy → one reload
  window.addEventListener("vite:preloadError", (e) => {
    if (safeSession.getItem(PRELOAD_KEY)) return;   // avoid a reload loop
    safeSession.setItem(PRELOAD_KEY, "1");
    e.preventDefault?.();
    doReload();
  });
  // clear the guard once a page rendered fine
  setTimeout(() => safeSession.removeItem(PRELOAD_KEY), 15000);

  const register = async () => {
    let reg;
    try { reg = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }); }
    catch { return; }
    if (!reg) return;   // registration blocked (privacy mode / automation) → nothing to manage

    const check = () => { reg.update().catch(() => {}); };
    setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { check(); tryReload(); } });
    window.addEventListener("focus", tryReload);
    setInterval(tryReload, RETRY_MS);

    // A worker already waiting (e.g. a previous tab was closed mid-update)
    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener("statechange", () => {
        if (nw.state === "installed" && navigator.serviceWorker.controller) {
          nw.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
  };

  // controllerchange fires (a) on the very first install — do NOT reload then,
  // the page is already the freshest build — and (b) when a new build took over.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!firstControllerSeen) { firstControllerSeen = true; return; }
    pendingReload = true;
    tryReload();
  });

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
