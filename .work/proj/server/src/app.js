/* ================================================================
   app.js — Configures and exports the Express app (no listen()).
   index.js starts the server; tests import this directly.
   ================================================================ */
import "dotenv/config";
import express from "express";
import qs from "qs";
import cors from "cors";
import compression from "compression";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { initSchema, persistNow } from "./db.js";

import authRoutes from "./routes/auth.js";
import contentRoutes from "./routes/content.js";
import examRoutes from "./routes/exam.js";
import reportRoutes from "./routes/reports.js";
import classRoutes from "./routes/classes.js";
import examMgmtRoutes from "./routes/exams.js";
import uploadRoutes, { UPLOAD_DIR } from "./routes/upload.js";
import learnRoutes from "./routes/learn.js";
import challengeRoutes from "./routes/challenge.js";
import adsAdminRoutes from "./routes/ads.js";
import adminRoutes, { publicFlagsHandler } from "./routes/admin.js";
import universityRoutes from "./routes/universities.js";
import siteContentRoutes from "./routes/sitecontent.js";
import paymentRoutes from "./routes/payments.js";
import storeRoutes from "./routes/store.js";
import supportRoutes from "./routes/support.js";
import questionnaireRoutes from "./routes/questionnaires.js";
import tutorRoutes from "./routes/tutor.js";
import researchRoutes from "./routes/research.js";
import { authRequired, authOptional } from "./lib/auth.js";
import { buildHelmet, permissionsPolicy, apiLimiter, authLimiter, errorHandler, jsonReviver } from "./lib/security.js";
import { ensureFlags } from "./lib/flags.js";
import { setRolePermOverrides } from "./lib/rbac.js";
import { db as _db } from "./db.js";
import { hostAliases } from "./lib/publicurl.js";
import { renderMetaTags, routeNameForPath, renderBlogPostMeta, renderRobotsTxt, renderSitemapXml } from "./lib/seo.js";
import { pwaClientConfig, recordPwaEvent } from "./lib/pwa.js";
import { renderAssetLinks } from "./lib/twa.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Short-lived cache for the public maintenance flag. This avoids a SQLite read
// on every API request while still reflecting admin changes quickly.
const maintenanceCache = { value: null, expiresAt: 0 };
globalThis.__medschoolInvalidateMaintenanceCache = () => {
  maintenanceCache.value = null;
  maintenanceCache.expiresAt = 0;
};
function readMaintenanceCached() {
  const now = Date.now();
  if (maintenanceCache.value && maintenanceCache.expiresAt > now) return maintenanceCache.value;
  let m = null;
  try {
    const row = _db.prepare("SELECT value FROM settings WHERE key='maintenance'").get();
    m = row ? JSON.parse(row.value) : null;
  } catch { /* */ }
  maintenanceCache.value = m || { on: false };
  maintenanceCache.expiresAt = now + 30_000;
  return maintenanceCache.value;
}

function securityKind(status) {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return null;
}
function safeText(v, max = 500) {
  return String(v || "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max);
}

function flattenInput(value, out = [], path = "") {
  if (value == null) return out;
  if (typeof value === "string") { out.push({ path, value }); return out; }
  if (typeof value === "number" || typeof value === "boolean") return out;
  if (Array.isArray(value)) { value.slice(0, 80).forEach((v, i) => flattenInput(v, out, `${path}[${i}]`)); return out; }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value).slice(0, 120)) {
      out.push({ path: `${path}.${k}`, key: k, value: "" });
      flattenInput(v, out, path ? `${path}.${k}` : k);
    }
  }
  return out;
}
function suspiciousInput(items) {
  const badKey = /^(?:__proto__|prototype|constructor)$/i;
  const critical = [
    /<\s*script\b/i,
    /<\s*\/\s*script\s*>/i,
    /javascript\s*:/i,
    /data\s*:\s*text\/html/i,
    /<\s*(?:iframe|object|embed|svg|math|body|meta|link)\b/i,
    /<[^>]+\son[a-z]+\s*=/i,
    /<\?php|<%/i,
    /\bunion\s+select\b/i,
    /\bdrop\s+table\b/i,
    /\binformation_schema\b/i,
    /['\"]\s*or\s*['\"]?1['\"]?\s*=\s*['\"]?1/i,
    /;\s*(?:select|insert|update|delete|drop|alter)\b/i,
    /\/\*.*\*\//,
  ];
  for (const it of items) {
    if (it.key && badKey.test(it.key)) return { path: it.path, reason: "prototype_pollution_key" };
    const v = String(it.value || "");
    if (!v || v.length > 8000) continue;
    const hit = critical.find((re) => re.test(v));
    if (hit) return { path: it.path, reason: hit.source.slice(0, 80), sample: safeText(v, 160) };
  }
  return null;
}
function recordSuspiciousInput(req, hit) {
  try {
    _db.prepare(`INSERT INTO security_events (user_id, kind, status, method, path, ip, user_agent, detail)
      VALUES (?,?,?,?,?,?,?,?)`).run(
      req.user?.id || null,
      "suspicious_input",
      400,
      req.method,
      safeText(req.originalUrl || req.url, 300),
      safeText(req.ip || req.headers["x-forwarded-for"] || "", 120),
      safeText(req.headers["user-agent"] || "", 300),
      JSON.stringify(hit).slice(0, 1000)
    );
    persistNow();
  } catch { /* never break requests */ }
}
function recordSecurityEvent(req, res) {
  const kind = securityKind(res.statusCode);
  if (!kind || !req.path.startsWith("/api")) return;
  // Avoid noisy logging of monitoring itself unless it is being rate-limited.
  if (req.path.startsWith("/api/rum") && kind !== "rate_limited") return;
  try {
    _db.prepare(`INSERT INTO security_events (user_id, kind, status, method, path, ip, user_agent, detail)
      VALUES (?,?,?,?,?,?,?,?)`).run(
        req.user?.id || null,
        kind,
        res.statusCode,
        req.method,
        safeText(req.originalUrl || req.url, 300),
        safeText(req.ip || req.headers["x-forwarded-for"] || "", 120),
        safeText(req.headers["user-agent"] || "", 300),
        ""
      );
  } catch { /* monitoring must never break requests */ }
}
function recordRumMetric(req, body) {
  const metric = String(body?.name || body?.metric || "").toUpperCase().slice(0, 24);
  const value = Number(body?.value);
  if (!metric || !Number.isFinite(value) || value < 0 || value > 600000) return false;
  const allowed = new Set(["LCP", "CLS", "INP", "TTFB", "FCP", "APP"]);
  if (!allowed.has(metric)) return false;
  const payload = {
    id: body.id || "", entries: body.entries || undefined, screen: body.screen || undefined,
    serverTiming: body.serverTiming || undefined, visibility: body.visibility || undefined,
  };
  _db.prepare(`INSERT INTO rum_vitals
    (user_id, session_id, metric, value, rating, delta, path, page, navigation_type, device, connection, server_timing, payload_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      req.user?.id || null,
      safeText(body.sessionId, 80),
      metric,
      value,
      safeText(body.rating, 32),
      Number.isFinite(Number(body.delta)) ? Number(body.delta) : null,
      safeText(body.path || req.headers.referer || "", 300),
      safeText(body.page || "", 120),
      safeText(body.navigationType, 60),
      safeText(body.device, 60),
      safeText(body.connection, 80),
      safeText(JSON.stringify(body.serverTiming || []), 1000),
      JSON.stringify(payload).slice(0, 2000)
    );
  // Keep the monitoring tables bounded on small cPanel disks.
  if (Math.random() < 0.02) {
    try {
      _db.prepare("DELETE FROM rum_vitals WHERE created_at < datetime('now','-45 day')").run();
      _db.prepare("DELETE FROM security_events WHERE created_at < datetime('now','-90 day')").run();
    } catch { /* */ }
  }
  return true;
}

export function createApp() {
  const app = express();
  // Behind a reverse proxy (Caddy/Nginx) so req.protocol / secure cookies and
  // the express-rate-limit key use the REAL client address. The proxy hop
  // count is deployment-specific (one proxy = 1; behind Cloudflare+proxy = 2;
  // "false" for a direct host) and overridable via TRUST_PROXY so an operator
  // change needs no code edit. A wrong value either spoofs-able IPs (too many
  // hops trusted) or rate-limit buckets that all share the proxy IP (too few).
  const trustEnv = String(process.env.TRUST_PROXY ?? "1").trim();
  const trustProxy = trustEnv === "false" ? false
    : trustEnv === "true" ? true
    : Number.isFinite(Number(trustEnv)) ? Number(trustEnv)
    : trustEnv;
  app.set("trust proxy", trustProxy);
  // Reduce fingerprinting — don't advertise the framework.
  app.disable("x-powered-by");
  // Query-string hardening (Express 4 default "extended" parser accepts deep
  // nested objects / huge arrays → prototype-pollution & CPU-DoS surface).
  // Depth 2, ≤100 keys, ≤50 array items, __proto__/constructor keys dropped.
  app.set("query parser", (str) => {
    if (!str) return {};
    if (str.length > 4096) str = str.slice(0, 4096);
    const out = qs.parse(str, { depth: 2, parameterLimit: 100, arrayLimit: 50, allowPrototypes: false, plainObjects: false, ignoreQueryPrefix: true });
    for (const k of Object.keys(out)) if (k === "__proto__" || k === "constructor" || k === "prototype") delete out[k];
    return out;
  });

  // Lightweight security hardening: reject legacy/debug HTTP methods that can be
  // abused for cross-site tracing or proxy tunneling, and add defensive headers
  // not covered by every proxy/CDN. These are static headers, so they have no
  // measurable runtime cost.
  app.use((req, res, next) => {
    if (["TRACE", "TRACK", "CONNECT"].includes(req.method)) {
      res.setHeader("Allow", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
      return res.status(405).json({ error: "method_not_allowed" });
    }
    res.setHeader("Permissions-Policy", "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=(), browsing-topics=(), display-capture=(), fullscreen=(self)");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.setHeader("X-Download-Options", "noopen");
    res.setHeader("Origin-Agent-Cluster", "?1");
    res.setHeader("X-XSS-Protection", "0");
    // Host-header injection / cache poisoning: reject characters that never
    // belong in a Host (userinfo, path, whitespace). Do NOT hard-fail on an
    // unexpected hostname — cPanel and health checks often hit the raw IP.
    const host = String(req.headers.host || "");
    if (host && /[\s@\\/?#]/.test(host)) {
      return res.status(400).json({ error: "bad_host" });
    }
    next();
  });

  // Server-Timing: lets Chrome DevTools and RUM correlate browser speed with
  // backend processing time. Implemented by wrapping writeHead so the duration
  // is set just before headers are sent.
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    const writeHead = res.writeHead;
    res.writeHead = function (...args) {
      try {
        const dur = Number(process.hrtime.bigint() - start) / 1e6;
        if (!res.getHeader("Server-Timing")) res.setHeader("Server-Timing", `app;dur=${dur.toFixed(1)}`);
        if (!String(req.path || "").startsWith("/api")) res.setHeader("Timing-Allow-Origin", "same-origin");
      } catch { /* */ }
      return writeHead.apply(this, args);
    };
    res.on("finish", () => recordSecurityEvent(req, res));
    next();
  });

  initSchema();
  ensureFlags();
  // load admin-configured role→permission overrides (RBAC editor)
  try {
    const row = _db.prepare("SELECT value FROM settings WHERE key='role_perms'").get();
    if (row) setRolePermOverrides(JSON.parse(row.value));
  } catch { /* first run: no overrides */ }

  // Security headers (Helmet) — applied FIRST so every response (incl. errors)
  // carries CSP, HSTS, X-Frame-Options, noSniff, etc.
  app.use(buildHelmet());
  app.use(permissionsPolicy());

  // CSP report-only gives us visibility into blocked resources without breaking
  // production. The enforced CSP remains in Helmet; reports are stored as
  // security_events for admin review.
  app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy-Report-Only",
      "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' https://accounts.google.com; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com; frame-src 'self' https://accounts.google.com https://www.aparat.com https://aparat.com https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; report-uri /api/security/csp-report");
    next();
  });

  // CORS: same-origin by default (the API serves its own client). If you host
  // the client on a different domain, set CORS_ORIGIN to a comma-separated
  // allow-list (never "*" together with credentials in production).
  const corsOrigins = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  // Same-origin is the normal deployment (API and client on medschool.ir), so do
  // not emit a permissive Access-Control-Allow-Origin: * header by default.
  // If a separate frontend is ever used, set CORS_ORIGIN to an explicit allow-list.
  if (corsOrigins.length) app.use(cors({ origin: corsOrigins, credentials: true }));

  app.use(express.json({ limit: "2mb", reviver: jsonReviver }));

  // Compress HTML/JSON/CSS/JS responses. On cPanel this substantially reduces
  // transfer size for the React bundle and API payloads when the web server
  // does not already gzip Passenger responses.
  app.use(compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      const p = String(req.path || req.url || "");
      if (p.startsWith("/assets/")) return false;
      if (res.getHeader("Content-Encoding")) return false;
      return compression.filter(req, res);
    },
  }));

  // Sensitive API responses should not be stored by shared/browser caches. A
  // small allow-list of public read-only endpoints sets its own cache header.
  app.use("/api", (req, res, next) => {
    const p = req.path;
    const publicCacheable = p === "/health" || p === "/pwa/config" || p.startsWith("/site-content");
    if (publicCacheable) res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    else res.setHeader("Cache-Control", "no-store");
    next();
  });

  // CSRF defense for cookie-authenticated API writes: browsers include an Origin
  // or Referer on same-origin unsafe requests. If a cross-site host tries to
  // submit a POST/PUT/DELETE with the auth cookie, reject it before routes run.
  app.use("/api", (req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    if (req.path === "/security/csp-report" || req.path === "/rum/vitals") return next();
    const src = req.headers.origin || req.headers.referer || "";
    const hasBearer = /^Bearer\s+\S+/i.test(String(req.headers.authorization || ""));
    const allowedHosts = new Set();
    for (const h of hostAliases(req.headers.host)) allowedHosts.add(h);
    try {
      const appHost = new URL(process.env.APP_URL || "https://medschool.ir").host.toLowerCase();
      for (const h of hostAliases(appHost)) allowedHosts.add(h);
    } catch { /* */ }
    for (const h of hostAliases("medschool.ir")) allowedHosts.add(h);
    for (const o of corsOrigins) {
      try { allowedHosts.add(new URL(o).hostname.toLowerCase()); } catch { /* */ }
    }
    if (!src) {
      // Cookie-only browser posts without Origin/Referer are classic CSRF.
      // Bearer API clients and the test suite are allowed through.
      if (!hasBearer && process.env.NODE_ENV === "production") {
        return res.status(403).json({ error: "bad_origin" });
      }
      return next();
    }
    try {
      const u = new URL(src);
      // Compare HOSTNAMES (no port): hostAliases() strips the port, but
      // URL.host keeps it, so on any non-default port (local START script,
      // cPanel preview URL, :8080 behind a proxy) every browser POST — including
      // login — was rejected with bad_origin.
      if (!allowedHosts.has(u.hostname.toLowerCase())) return res.status(403).json({ error: "bad_origin" });
    } catch { return res.status(403).json({ error: "bad_origin" }); }
    next();
  });

  // Global API rate limiter (brute-force / basic DoS protection). Auth routes
  // get an additional, stricter limiter (see below). Health check is exempt.
  app.use("/api", apiLimiter());
  app.use("/api/auth/login", authLimiter());
  app.use("/api/auth/register", authLimiter());
  app.use("/api/auth/password", authLimiter());
  app.use("/api/auth/google", authLimiter());
  app.use("/api/auth/logout-all", authLimiter());

  app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  // Real-user Web Vitals collector. Public but rate-limited; accepts only a tiny
  // validated payload and never returns sensitive data.
  app.post("/api/rum/vitals", authOptional, (req, res) => {
    try {
      const ok = recordRumMetric(req, req.body || {});
      res.status(ok ? 204 : 400).end();
    } catch {
      res.status(204).end(); // monitoring must never break the app
    }
  });

  // CSP violation reports (Report-Only). Browsers may POST either application/csp-report
  // or JSON. Store only a compact summary; never trust or echo the payload.
  app.post("/api/security/csp-report", express.json({ type: ["application/csp-report", "application/json"], limit: "20kb" }), (req, res) => {
    try {
      const body = req.body || {};
      const r = body["csp-report"] || body;
      _db.prepare(`INSERT INTO security_events (user_id, kind, status, method, path, ip, user_agent, detail)
        VALUES (?,?,?,?,?,?,?,?)`).run(
          null, "csp_violation", 0, "REPORT", safeText(r["document-uri"] || "", 300),
          safeText(req.ip || "", 120), safeText(req.headers["user-agent"] || "", 300),
          JSON.stringify({ blocked: r["blocked-uri"], directive: r["violated-directive"] || r["effective-directive"], source: r["source-file"] }).slice(0, 1000)
        );
    } catch { /* */ }
    res.status(204).end();
  });

  // ---- Maintenance mode ----
  // When an admin turns it on (settings key "maintenance".on), all API calls
  // return 503 EXCEPT: health, login (so admins can get in), the public site
  // config (so the client can render the maintenance screen), and any request
  // from an authenticated admin (so admins keep full access to fix things).
  app.use("/api", authOptional, (req, res, next) => {
    const m = readMaintenanceCached();
    if (!m || !m.on) return next();
    const p = req.path;
    // always-allowed during maintenance so admins can log in & turn it off,
    // and the client can render the maintenance screen.
    if (p === "/health" || p.startsWith("/auth/login") || p.startsWith("/site-content")) return next();
    // Gateway returns must never 503 — a dropped Zarinpal bounce is lost revenue.
    if (p === "/pay/callback" || p === "/store/callback" || p.endsWith("/pay/callback") || p.endsWith("/store/callback")) return next();
    // authenticated admins keep full access to fix things
    if (req.user && req.user.role === "admin") return next();
    return res.status(503).json({ error: "maintenance", maintenance: m });
  });


  // Suspicious input guard: catches high-confidence XSS/SQLi/prototype-pollution
  // payloads in user-facing forms before they reach route handlers. Staff/admin
  // content-authoring routes are monitored but not blocked to avoid breaking
  // legitimate educational/security examples in blog/help content.
  app.use("/api", (req, res, next) => {
    if (!["POST", "PUT", "PATCH"].includes(req.method)) return next();
    if (req.path === "/security/csp-report" || req.path === "/rum/vitals") return next();
    const fields = [...flattenInput(req.body), ...flattenInput(req.query)];
    const hit = suspiciousInput(fields);
    if (!hit) return next();
    recordSuspiciousInput(req, hit);
    const staff = ["admin", "teacher", "content_manager", "support"].includes(req.user?.role);
    if (staff) return next();
    return res.status(400).json({ error: "suspicious_input", message_fa: "ورودی شامل کد یا الگوی مشکوک است.", message_en: "Input contains suspicious code-like content." });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api", contentRoutes);
  app.use("/api/exam", examRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/classes", classRoutes);
  app.use("/api/exams", examMgmtRoutes);
  app.use("/api/upload", uploadRoutes);
  app.use("/api/learn", learnRoutes);
  app.use("/api/challenge", challengeRoutes);
  app.use("/api/ads", adsAdminRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/universities", universityRoutes);
  app.use("/api/site-content", siteContentRoutes);
  app.use("/api/pay", paymentRoutes);
  // store: authOptional so public browsing works but shows "owned" when logged in
  app.use("/api/store", authOptional, storeRoutes);
  // in-app support chat (any authenticated user)
  app.use("/api/support", supportRoutes);
  app.use("/api/questionnaires", questionnaireRoutes);
  app.use("/api/tutor", tutorRoutes);
  app.use("/api/research", researchRoutes);
  // any authenticated user can read which features are enabled (to hide/show UI)
  app.get("/api/flags", authRequired, publicFlagsHandler);

  // PWA (installable app) — public: config for the install prompt + funnel tracking.
  // authOptional so logged-out visitors on the landing page can be prompted/tracked too.
  app.get("/api/pwa/config", authOptional, (req, res) => {
    res.json(pwaClientConfig());
  });
  app.post("/api/pwa/event", authOptional, (req, res) => {
    const { event, platform, standalone } = req.body || {};
    const out = recordPwaEvent({
      userId: req.user ? req.user.id : null,
      event, platform, standalone: !!standalone,
    });
    res.status(out.ok ? 200 : 400).json(out);
  });

  // Serve uploaded medical images/videos safely. Dotfiles are denied and MIME
  // sniffing stays disabled; uploaded files are not executable code.
  app.use("/uploads", express.static(UPLOAD_DIR, {
    dotfiles: "deny",
    index: false,
    maxAge: "30d",
    setHeaders(res) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      res.setHeader("Cache-Control", "public, max-age=2592000");
      res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'none'; script-src 'none'");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }));

  // --- Responsible disclosure: /.well-known/security.txt (RFC 9116) ---
  app.get("/.well-known/security.txt", (req, res) => {
    const appUrl = (process.env.APP_URL || "https://medschool.ir").replace(/\/+$/, "");
    const expires = new Date(Date.now() + 365 * 864e5).toISOString();
    res.type("text/plain").send(
      `Contact: mailto:security@medschool.ir\nExpires: ${expires}\nPreferred-Languages: fa, en\nCanonical: ${appUrl}/.well-known/security.txt\n`
    );
  });

  // --- TWA / Android app verification: Digital Asset Links ---
  // Lets the Trusted Web Activity (Cafe Bazaar / Google Play app) run without a
  // browser address bar by proving this site owns the Android package.
  app.get("/.well-known/assetlinks.json", (req, res) => {
    try {
      res.type("application/json").send(JSON.stringify(renderAssetLinks(), null, 2));
    } catch {
      res.type("application/json").send("[]");
    }
  });

  // --- SEO: sitemap.xml + robots.txt (native, no external plugin) ---
  app.get("/robots.txt", (req, res) => {
    res.type("text/plain").send(renderRobotsTxt());
  });
  app.get("/sitemap.xml", (req, res) => {
    res.type("application/xml").send(renderSitemapXml());
  });

  // Serve the built client in production (client/dist)
  const clientDist = path.join(__dirname, "..", "..", "client", "dist");

  // Serve precompressed static sidecars (.br/.gz) when available. This saves CPU
  // on small cPanel hosts because big hashed JS/CSS files are compressed once at
  // build time instead of on every request.
  const typeFor = (file) => {
    if (file.endsWith(".js")) return "application/javascript; charset=UTF-8";
    if (file.endsWith(".css")) return "text/css; charset=UTF-8";
    if (file.endsWith(".json") || file.endsWith(".webmanifest")) return "application/json; charset=UTF-8";
    if (file.endsWith(".svg")) return "image/svg+xml";
    if (file.endsWith(".wasm")) return "application/wasm";
    return "application/octet-stream";
  };
  app.get(/\.(js|css|json|svg|webmanifest|wasm)$/i, (req, res, next) => {
    try {
      const rel = decodeURIComponent(req.path).replace(/^\/+/, "");
      const raw = path.normalize(path.join(clientDist, rel));
      const root = clientDist.endsWith(path.sep) ? clientDist : clientDist + path.sep;
      if (!(raw === clientDist || raw.startsWith(root)) || !fs.existsSync(raw)) return next();
      const ae = req.headers["accept-encoding"] || "";
      const useBr = ae.includes("br") && fs.existsSync(raw + ".br");
      const useGz = !useBr && ae.includes("gzip") && fs.existsSync(raw + ".gz");
      if (!useBr && !useGz) return next();
      const file = raw + (useBr ? ".br" : ".gz");
      res.setHeader("Content-Encoding", useBr ? "br" : "gzip");
      res.setHeader("Content-Type", typeFor(raw));
      res.setHeader("Vary", "Accept-Encoding");
      if (req.path.startsWith("/assets/")) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      else res.setHeader("Cache-Control", "no-cache");
      const st = fs.statSync(file);
      res.setHeader("Content-Length", st.size);
      if (req.method === "HEAD") return res.end();
      return fs.createReadStream(file).pipe(res);
    } catch { return next(); }
  });

  // Serve static assets first (JS/CSS/images) — but NOT index.html directly, so
  // navigations fall through to the catch-all where we inject SEO meta tags.
  // Hashed Vite assets can be cached for a year; the SPA shell is revalidated.
  app.use(express.static(clientDist, {
    index: false,
    maxAge: "1y",
    immutable: true,
    setHeaders(res, filePath) {
      // Only Vite's content-hashed files under /assets/ are truly immutable.
      // Everything else at the root (sw.js, manifest.webmanifest, offline.html,
      // icons, defer-css.js, robots) keeps its name across releases — a
      // one-year "immutable" on sw.js meant browsers/CDNs could pin an old
      // service worker and keep serving a stale app after an upgrade.
      const rel = path.relative(clientDist, filePath).split(path.sep).join("/");
      if (filePath.endsWith(".html") || rel === "sw.js" || rel.endsWith(".webmanifest")) {
        res.setHeader("Cache-Control", "no-cache");
      } else if (!rel.startsWith("assets/")) {
        res.setHeader("Cache-Control", "public, max-age=86400");   // icons etc.: 1 day
      }
    },
  }));

  // Cache the built index.html once; we string-replace the SEO block per request.
  let indexHtmlCache = null;
  const readIndexHtml = () => {
    if (indexHtmlCache != null) return indexHtmlCache;
    try { indexHtmlCache = fs.readFileSync(path.join(clientDist, "index.html"), "utf8"); }
    catch { indexHtmlCache = null; }
    return indexHtmlCache;
  };

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "not found" });
    let html = readIndexHtml();
    if (html == null) return res.status(200).send("Client not built yet. Run `npm run build` in /client.");
    try {
      // language: ?lang= wins, else the medlab_lang cookie, else Persian.
      let lang = (req.query.lang === "en" || req.query.lang === "fa") ? req.query.lang : null;
      if (!lang && req.headers.cookie) {
        const m = /(?:^|;\s*)medlab_lang=(fa|en)/.exec(req.headers.cookie);
        if (m) lang = m[1];
      }
      lang = lang || "fa";
      // A single blog post gets its own crawlable meta + Article schema.
      const blogMatch = /^\/blog\/([^/?]+)/.exec(req.path);
      let metaBlock = "";
      if (blogMatch) metaBlock = renderBlogPostMeta(decodeURIComponent(blogMatch[1]), lang, req.path);
      if (!metaBlock) {
        const routeName = routeNameForPath(req.path);
        metaBlock = renderMetaTags(routeName, lang, req.path);
      }
      if (metaBlock) {
        // Replace everything between the SEO markers with fresh, crawlable tags.
        html = html.replace(
          /<!-- SEO_META_START -->[\s\S]*?<!-- SEO_META_END -->/,
          `<!-- SEO_META_START -->\n    ${metaBlock}\n    <!-- SEO_META_END -->`
        );
      }
    } catch (_) { /* fall back to the un-modified shell */ }
    res.setHeader("Cache-Control", "no-cache");
    res.status(200).type("html").send(html);
  });

  // Central error handler — logs full detail, never leaks stack traces to clients.
  app.use(errorHandler);

  return app;
}
