/* hardening.js — R70 security helpers: HTTPS enforcement, admin IP allow-list,
   environment audit at boot, and a suspicious-login detector.

   Every helper reads process.env at call time so tests and operators can change
   settings without a restart-only code path. */

const TRUE = new Set(["1", "true", "yes", "on"]);
const FALSE = new Set(["0", "false", "no", "off"]);

export function isProduction(env = process.env) { return env.NODE_ENV === "production"; }

/* HTTPS is enforced in production unless FORCE_HTTPS=0. FORCE_HTTPS=1 forces it
   in any environment (useful for staging). */
export function forceHttpsEnabled(env = process.env) {
  const v = String(env.FORCE_HTTPS ?? "").trim().toLowerCase();
  if (TRUE.has(v)) return true;
  if (FALSE.has(v)) return false;
  return isProduction(env);
}

/* Cookies get the Secure flag whenever the deployment is HTTPS-only. */
export function secureCookies(env = process.env) { return forceHttpsEnabled(env); }

const HOST_RE = /^[a-z0-9.-]+(:\d{1,5})?$/i;
/* Host used for the redirect. Prefer APP_URL so a spoofed Host header cannot
   turn the redirect into an open redirect. */
export function redirectHost(reqHost, env = process.env) {
  try {
    if (env.APP_URL) return new URL(env.APP_URL).host;
  } catch { /* fall through */ }
  const h = String(reqHost || "");
  return HOST_RE.test(h) ? h : "";
}

export function httpsRedirect() {
  return (req, res, next) => {
    if (!forceHttpsEnabled() || req.secure) return next();
    if (req.path === "/api/health") return next();
    const host = redirectHost(req.headers.host);
    if (!host) return res.status(400).json({ error: "bad_host" });
    return res.redirect(308, `https://${host}${req.originalUrl || req.url || "/"}`);
  };
}

export function normalizeIp(ip) {
  return String(ip || "").replace(/^::ffff:/i, "").trim();
}

/* ADMIN_IP_ALLOWLIST=1.2.3.4,5.6.7.8 — when set, /api/admin is reachable only
   from these addresses. Empty (default) = no restriction. */
export function adminAllowlist(env = process.env) {
  return String(env.ADMIN_IP_ALLOWLIST || "").split(",").map((s) => normalizeIp(s)).filter(Boolean);
}
export function adminIpAllowlist() {
  return (req, res, next) => {
    const list = adminAllowlist();
    if (!list.length) return next();
    const ip = normalizeIp(req.ip);
    if (list.includes(ip)) return next();
    console.warn(`[security] admin route refused for ${ip} (${req.method} ${req.path})`);
    return res.status(403).json({ error: "admin_ip_not_allowed" });
  };
}

/* Boot-time environment audit. Returns findings; never throws. */
export function checkEnvironment(env = process.env) {
  const findings = [];
  const add = (level, key, message) => findings.push({ level, key, message });
  const prod = isProduction(env);
  const truthy = (v) => TRUE.has(String(v || "").trim().toLowerCase());

  const jwt = String(env.JWT_SECRET || "");
  if (jwt.length < 32) add(prod ? "error" : "warn", "JWT_SECRET", "JWT_SECRET is missing or shorter than 32 characters");
  if (prod && !env.SETTINGS_ENCRYPTION_KEY) add("warn", "SETTINGS_ENCRYPTION_KEY", "not set: API keys are encrypted with a key derived from JWT_SECRET (rotating JWT_SECRET will make stored keys unreadable)");
  const appUrl = String(env.APP_URL || "");
  if (prod && !/^https:\/\//i.test(appUrl)) add("error", "APP_URL", "APP_URL must be an https:// address in production");
  if (prod && truthy(env.DISABLE_RATE_LIMIT)) add("error", "DISABLE_RATE_LIMIT", "rate limiting is disabled in production");
  if (prod && truthy(env.ALLOW_MOCK_PAY)) add("error", "ALLOW_MOCK_PAY", "mock payments are allowed in production (free premium)");
  if (prod && String(env.FORCE_HTTPS ?? "").trim() === "0") add("error", "FORCE_HTTPS", "HTTPS enforcement is turned off in production");
  if (prod && !env.ZARINPAL_MERCHANT_ID) add("warn", "ZARINPAL_MERCHANT_ID", "no merchant id: payments use the offline mock gateway, which is refused in production");
  const cors = String(env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (cors.includes("*")) add(prod ? "error" : "warn", "CORS_ORIGIN", "CORS_ORIGIN must not be \"*\" when credentials are used");
  if (prod && cors.some((o) => /^http:\/\//i.test(o))) add("warn", "CORS_ORIGIN", "an http:// origin is allowed");
  if (prod && String(env.TRUST_PROXY ?? "") === "true") add("warn", "TRUST_PROXY", "TRUST_PROXY=true lets clients spoof their IP; use the number of proxy hops");
  if (prod && truthy(env.DEBUG) ) add("warn", "DEBUG", "debug output is enabled in production");
  if (prod && String(env.ZARINPAL_SANDBOX || "").toLowerCase() === "true") add("warn", "ZARINPAL_SANDBOX", "sandbox payment gateway is enabled in production");
  if (prod && !env.SMTP_HOST) add("warn", "SMTP_HOST", "no SMTP: verification and password-reset e-mails cannot be sent");
  if (prod && !env.ADMIN_IP_ALLOWLIST) add("info", "ADMIN_IP_ALLOWLIST", "admin routes are protected by login and role only; set an IP allow-list if the admin team has fixed addresses");
  return findings;
}

export function logEnvironmentFindings(findings, log = console) {
  for (const f of findings) {
    const line = `[env-check] ${f.level.toUpperCase()} ${f.key}: ${f.message}`;
    if (f.level === "error") log.error(line); else if (f.level === "warn") log.warn(line); else log.log(line);
  }
  return findings.filter((f) => f.level === "error").length;
}

/* Suspicious-login detector: IPs with many failed logins/401/403s in a window. */
export function suspiciousIps(db, { windowMinutes = 60, threshold = 25 } = {}) {
  const rows = db.prepare(
    `SELECT ip, COUNT(*) AS n, MAX(created_at) AS last_seen
       FROM security_events
      WHERE status IN (401, 403, 429) AND created_at >= datetime('now', ?)
      GROUP BY ip HAVING COUNT(*) >= ?
      ORDER BY n DESC LIMIT 50`
  ).all(`-${Number(windowMinutes)} minutes`, Number(threshold));
  return rows.map((r) => ({ ip: r.ip, failures: r.n, last_seen: r.last_seen }));
}
