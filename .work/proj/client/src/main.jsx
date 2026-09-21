import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AppProvider } from "./context.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
// Self-hosted fonts (bundled by Vite) — works offline / no external CDN:
// Vazirmatn for Persian body/UI (RTL), Inter for Latin. Both variable-weight.
import "@fontsource-variable/vazirmatn";
// Estedad — a modern, confident Persian display face used for headings only
// (Arabic subset carries the Persian glyphs). Heavy weights give titles punch.
import "./styles.css";
// 2025 visual polish — loaded last so it layers on top of styles.css.
import "./design-refresh.css";
import "./styles-speed-fixes.css";
import "./mobile-learn.css";
// Document-scroll restore — MUST be last. Nested overflow on html+body was
// freezing every page except the signup overlay (which has its own scroller).
import "./scroll-unlock.css";
import "./search.css";
import { initRum } from "./lib/rum.js";
import { safeLocal } from "./lib/storage.js";
import { initSwUpdate } from "./lib/sw-update.js";

/* Apply saved font-size (and theme) as early as possible to avoid a flash of
   the default size before React hydrates the context. Accessibility-friendly. */
try {
  const SCALES = { small: 15, normal: 16, large: 18, xl: 20 };
  const f = localStorage.getItem("medlab_font") || "normal";
  document.documentElement.style.setProperty("--fs", `${SCALES[f] || 16}px`);
  const th = localStorage.getItem("medlab_theme") || "light";
  document.documentElement.setAttribute("data-theme", th);
} catch (_) { /* ignore */ }

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

initRum();

const runWhenIdle = (fn, timeout = 3000) => {
  if ("requestIdleCallback" in window) window.requestIdleCallback(fn, { timeout });
  else window.setTimeout(fn, 1200);
};

/* Register the service worker for PWA/offline shell + push (best-effort).
   It is intentionally delayed until after first paint/idle so it never competes
   with the LCP-critical CSS/JS on the first visit. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    runWhenIdle(() => initSwUpdate());
  });
}

/* Record an app "launch" event once per load. This analytics request is not
   needed for rendering, so it is delayed until idle to keep the first view fast. */
runWhenIdle(() => {
  try {
    const standalone =
      window.matchMedia && window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    const ua = navigator.userAgent || "";
    const platform = /iPad|iPhone|iPod/.test(ua)
      ? "ios"
      : /Android/.test(ua)
      ? "android"
      : /Windows|Macintosh|Linux|CrOS/.test(ua)
      ? "desktop"
      : "other";
    const tok = safeLocal.getItem("medlab_token");
    const headers = { "Content-Type": "application/json" };
    if (tok) headers.Authorization = `Bearer ${tok}`;
    fetch("/api/pwa/event", {
      method: "POST", credentials: "same-origin",
      headers,
      body: JSON.stringify({ event: "launch", platform, standalone }),
      keepalive: true,
    }).catch(() => {});
  } catch (_) { /* ignore */ }
}, 5000);
