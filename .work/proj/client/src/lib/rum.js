/* Real-user monitoring (RUM) for Core Web Vitals.
   Sends tiny, non-blocking beacons to /api/rum/vitals:
   - LCP: largest contentful paint
   - CLS: cumulative layout shift
   - INP: interaction latency approximation (max event duration)
   - TTFB/FCP: navigation/paint timing
   No PII is collected; auth token is not needed. */
import { safeSession } from "./storage.js";

const METRIC_ENDPOINT = "/api/rum/vitals";
const SAMPLE_RATE = 0.5; // small-host friendly: enough field data without writing every visit.

function sessionId() {
  try {
    const k = "medlab_rum_sid";
    let v = safeSession.getItem(k);
    if (!v) {
      v = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      safeSession.setItem(k, v);
    }
    return v;
  } catch { return ""; }
}
function rating(name, value) {
  if (name === "LCP") return value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
  if (name === "CLS") return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
  if (name === "INP") return value <= 200 ? "good" : value <= 500 ? "needs-improvement" : "poor";
  if (name === "TTFB") return value <= 800 ? "good" : value <= 1800 ? "needs-improvement" : "poor";
  if (name === "FCP") return value <= 1800 ? "good" : value <= 3000 ? "needs-improvement" : "poor";
  return "";
}
function connectionLabel() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return "";
  return [c.effectiveType, c.downlink ? `${c.downlink}Mbps` : "", c.saveData ? "saveData" : ""].filter(Boolean).join(" ");
}
function deviceLabel() {
  try {
    const w = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
  } catch { return ""; }
}
function serverTiming() {
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    return (nav?.serverTiming || []).map((x) => ({ name: x.name, dur: x.duration, desc: x.description })).slice(0, 8);
  } catch { return []; }
}
function navType() {
  try { return performance.getEntriesByType("navigation")[0]?.type || ""; } catch { return ""; }
}
function sendMetric(name, value, extra = {}) {
  if (!Number.isFinite(value) || value < 0) return;
  const body = {
    name,
    value: Math.round(value * 10) / 10,
    rating: rating(name, value),
    delta: extra.delta == null ? undefined : Math.round(extra.delta * 10) / 10,
    id: extra.id || "",
    path: location.pathname + location.search,
    page: document.title || "",
    navigationType: navType(),
    sessionId: sessionId(),
    device: deviceLabel(),
    connection: connectionLabel(),
    visibility: document.visibilityState,
    screen: { w: window.innerWidth || 0, h: window.innerHeight || 0, dpr: window.devicePixelRatio || 1 },
    serverTiming: serverTiming(),
  };
  const json = JSON.stringify(body);
  try {
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(METRIC_ENDPOINT, new Blob([json], { type: "application/json" }));
      if (ok) return;
    }
  } catch { /* */ }
  try { fetch(METRIC_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: json, keepalive: true }).catch(() => {}); } catch { /* */ }
}

export function initRum() {
  if (typeof window === "undefined" || Math.random() > SAMPLE_RATE) return;
  const po = (type, cb, opts = {}) => {
    try {
      if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return null;
      const obs = new PerformanceObserver((list) => cb(list.getEntries()));
      obs.observe({ type, buffered: true, ...opts });
      return obs;
    } catch { return null; }
  };

  // TTFB + FCP after the browser has populated navigation/paint entries.
  window.addEventListener("load", () => {
    setTimeout(() => {
      try {
        const nav = performance.getEntriesByType("navigation")[0];
        if (nav) sendMetric("TTFB", nav.responseStart - nav.requestStart);
        const fcp = performance.getEntriesByName("first-contentful-paint")[0];
        if (fcp) sendMetric("FCP", fcp.startTime);
      } catch { /* */ }
    }, 0);
  }, { once: true });

  let lcp = null;
  po("largest-contentful-paint", (entries) => { lcp = entries[entries.length - 1] || lcp; });

  let cls = 0;
  po("layout-shift", (entries) => {
    for (const e of entries) if (!e.hadRecentInput) cls += e.value || 0;
  });

  // INP approximation: Event Timing entries expose duration for real interactions.
  let maxInteraction = 0;
  po("event", (entries) => {
    for (const e of entries) {
      if (e.interactionId || ["click", "keydown", "pointerdown", "touchstart"].includes(e.name)) {
        maxInteraction = Math.max(maxInteraction, e.duration || 0);
      }
    }
  }, { durationThreshold: 40 });

  const flush = () => {
    try {
      if (lcp) sendMetric("LCP", lcp.startTime, { id: lcp.id || "" });
      sendMetric("CLS", cls);
      if (maxInteraction > 0) sendMetric("INP", maxInteraction);
    } catch { /* */ }
  };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  window.addEventListener("pagehide", flush, { once: true });
  // Also send once shortly after load so short sessions are captured.
  window.addEventListener("load", () => setTimeout(flush, 3500), { once: true });
}
