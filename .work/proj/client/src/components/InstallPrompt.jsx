import { useEffect, useState, useCallback } from "react";
import { useApp } from "../context.jsx";
import { getToken } from "../api.js";
import { safeLocal } from "../lib/storage.js";

/* Fire-and-forget PWA funnel event (works logged-out too). */
function track(event) {
  try {
    const headers = { "Content-Type": "application/json" };
    const tok = getToken();
    if (tok) headers.Authorization = `Bearer ${tok}`;
    fetch("/api/pwa/event", {
      method: "POST", credentials: "same-origin",
      headers,
      body: JSON.stringify({ event, platform: platformName(), standalone: isStandalone() }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* ignore */ }
}
function platformName() {
  if (isIOS()) return "ios";
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/Android/.test(ua)) return "android";
  if (/Windows|Macintosh|Linux|CrOS/.test(ua)) return "desktop";
  return "other";
}

/* ============================================================================
   InstallPrompt — "Add to home screen" experience for the PWA.
   ----------------------------------------------------------------------------
   • Android / Chromium: captures the `beforeinstallprompt` event and shows a
     custom, on-brand install card. Clicking "Install" fires the native prompt.
   • iOS / Safari: no beforeinstallprompt exists, so we show step-by-step
     "Share → Add to Home Screen" instructions (research-backed; iOS never
     shows an automatic prompt).
   • Already installed (standalone) → renders nothing.
   • Respects the user: if dismissed, we remember it (localStorage) and don't
     nag again for 14 days.
   • App updates are NOT surfaced here: lib/sw-update.js applies a new build
     automatically at a safe moment (no toast, no button).
   AI-free, zero external deps. Admin can disable via the `pwa_install` flag.
   ========================================================================== */

const SNOOZE_KEY = "medlab_install_snooze";
const SNOOZE_DAYS = 14;

function isStandalone() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}
function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac; detect touch Macs too.
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iDevice || iPadOS;
}
function isSnoozed() {
  try {
    const v = Number(safeLocal.getItem(SNOOZE_KEY) || 0);
    return v && Date.now() < v;
  } catch { return false; }
}
function snooze() {
  try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 864e5)); } catch {}
}

export default function InstallPrompt() {
  const { t, lang, flag } = useApp();
  const [deferred, setDeferred] = useState(null); // Android beforeinstallprompt event
  const [show, setShow] = useState(false);        // show the install card
  const [iosOpen, setIosOpen] = useState(false);  // iOS instructions modal
  const [cfg, setCfg] = useState({ enabled: true, show_prompt: true });

  const enabled = (flag ? flag("pwa_install") : true) && cfg.enabled !== false && cfg.show_prompt !== false;

  // Load admin-tunable PWA config (best-effort; defaults keep the prompt on).
  useEffect(() => {
    let alive = true;
    fetch("/api/pwa/config", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setCfg(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // 1) Capture Android/Chromium install prompt.
  useEffect(() => {
    if (!enabled || isStandalone()) return;
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      if (!isSnoozed()) { setShow(true); track("prompt_shown"); }
    };
    const onInstalled = () => {
      setShow(false); setDeferred(null);
      track("installed");
      window.dispatchEvent(new CustomEvent("medlab-toast", { detail: t("installDone") }));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [enabled, t]);

  // 2) iOS has no event — show a gentle hint after a short delay if not snoozed.
  useEffect(() => {
    if (!enabled || isStandalone() || !isIOS() || isSnoozed()) return;
    const id = setTimeout(() => { setShow(true); track("prompt_shown"); }, 3500);
    return () => clearTimeout(id);
  }, [enabled]);

  // 3) Service-worker updates are applied silently — see lib/sw-update.js.
  //    (The old "Update & reload" toast was removed: sw.js already calls
  //    skipWaiting() on install, so by the time the toast rendered there was
  //    usually no waiting worker and the button had nothing to do.)

  const doInstall = useCallback(async () => {
    if (isIOS()) { setIosOpen(true); return; }
    if (!deferred) { setShow(false); return; }
    try {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") track("accepted");
      else { track("dismissed"); snooze(); }
    } catch { /* ignore */ }
    setDeferred(null); setShow(false);
  }, [deferred]);

  const dismiss = useCallback(() => { track("dismissed"); snooze(); setShow(false); }, []);

  const fa = lang !== "en";

  return (
    <>
      {/* Install card (bottom sheet) */}
      {show && (
        <div className="pwa-install" role="dialog" aria-label={t("installTitle")}>
          <div className="pwa-install-icon" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 8l10-4 10 4-10 4L2 8Z" />
              <path d="M6 10.5V15c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-4.5M22 8v5" />
            </svg>
          </div>
          <div className="pwa-install-body">
            <div className="pwa-install-title">{t("installTitle")}</div>
            <div className="pwa-install-desc">{t("installDesc")}</div>
            <ul className="pwa-install-benefits">
              <li>⚡ {t("installBenefit1")}</li>
              <li>📶 {t("installBenefit2")}</li>
              <li>🔔 {t("installBenefit3")}</li>
            </ul>
            <div className="pwa-install-actions">
              <button className="pwa-btn-primary" onClick={doInstall}>{t("installNow")}</button>
              <button className="pwa-btn-ghost" onClick={dismiss}>{t("installLater")}</button>
            </div>
          </div>
        </div>
      )}

      {/* iOS step-by-step instructions */}
      {iosOpen && (
        <div className="pwa-ios-overlay" onClick={() => { setIosOpen(false); dismiss(); }}>
          <div className="pwa-ios-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="pwa-ios-title">{t("installIosTitle")}</div>
            <ol className="pwa-ios-steps">
              <li>
                <span className="pwa-ios-num">1</span>
                <span>{t("installIosStep1")}</span>
                <svg className="pwa-ios-share" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#26527a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4M8 8l4-4 4 4" />
                  <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
                </svg>
              </li>
              <li><span className="pwa-ios-num">2</span><span>{t("installIosStep2")}</span> <span className="pwa-ios-plus">＋</span></li>
              <li><span className="pwa-ios-num">3</span><span>{t("installIosStep3")}</span></li>
            </ol>
            <div className="pwa-ios-note">{t("installIosOnlySafari")}</div>
            <button className="pwa-btn-primary pwa-ios-close" onClick={() => { setIosOpen(false); dismiss(); }}>
              {fa ? "متوجه شدم" : "Got it"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
