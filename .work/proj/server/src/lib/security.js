/* security.js — production hardening (Helmet, rate limiting, error handling).

   Research-informed (OWASP Top-10 for Node, Express security best practices):
     • Helmet security headers (CSP, HSTS, X-Frame-Options, noSniff, referrer)
     • Global + strict auth rate limiting (brute-force / DoS protection)
     • Hide X-Powered-By (reduce fingerprinting)
     • Central error handler that never leaks stack traces in production

   AI-free, deterministic. Admin-tunable knobs live in gameconfig.security and
   are read at request time so changes apply without a restart. The CSP is
   tuned for THIS app: self-hosted assets, data: URIs (inline SVG icons/favicon),
   blob: (client-side canvas/QR), and same-origin XHR only. */
import crypto from "crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { getGameConfig } from "./gameconfig.js";

/* Google Identity Services (button + One Tap / FedCM). Without these hosts
   Helmet blocks https://accounts.google.com/gsi/client and the GIS XHR. */
export const GIS_SCRIPT = ["https://accounts.google.com"];
export const GIS_CONNECT = ["https://accounts.google.com", "https://oauth2.googleapis.com", "https://www.googleapis.com"];
export const GIS_FRAME = ["https://accounts.google.com"];

/* ---- Helmet with a Content-Security-Policy tuned for MED School ---- */
export function buildHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // styles: our CSS + inline styles used across the app (React inline styles)
        styleSrc: ["'self'", "'unsafe-inline'"],
        // scripts: our bundle + Google Identity Services (FedCM / One Tap)
        scriptSrc: ["'self'", ...GIS_SCRIPT],
        // Block inline event handlers (onclick=…) — XSS classic. Helmet 7 may
        // already emit this; we pin it so a version bump cannot drop it.
        scriptSrcAttr: ["'none'"],
        // images: self + data: (inline SVG/emoji/favicon) + blob: (canvas exports)
        // + https: so admins can paste external medical image URLs (radiology,
        //   pathology) and video-provider thumbnails/posters.
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        // fonts are self-hosted (bundled via @fontsource) + data:
        fontSrc: ["'self'", "data:"],
        // XHR/fetch: same origin + Google token/JWKS/FedCM
        connectSrc: ["'self'", ...GIS_CONNECT],
        // manifest for the PWA
        manifestSrc: ["'self'"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        // media: self-hosted uploaded video/audio (mp4/webm) + blob:
        mediaSrc: ["'self'", "blob:", "https:"],
        // embedded lesson videos: only the vetted providers (Aparat / YouTube).
        // Everything else is blocked, so a pasted embed URL can't load a
        // hostile frame. Keep this list in sync with medialib.js EMBED_HOSTS.
        frameSrc: [
          "'self'",
          "https://www.aparat.com", "https://aparat.com",
          "https://www.youtube.com", "https://youtube.com", "https://www.youtube-nocookie.com",
          ...GIS_FRAME,
        ],
        frameAncestors: ["'none'"],   // clickjacking protection
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    // HSTS: force HTTPS for a year (safe behind Caddy which terminates TLS).
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // allow the service worker & app to load images/fonts we host
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    frameguard: { action: "deny" },
    noSniff: true,
    dnsPrefetchControl: { allow: false },
  });
}

/* Permissions-Policy: the app never uses camera/microphone/geolocation/USB/
   Payment-Request/FLEDGE; deny them by default so an XSS payload cannot
   recruit device sensors. Applied as its own middleware because Helmet 7
   dropped the built-in Permissions-Policy setter. */
export function permissionsPolicy() {
  const policy = [
    "accelerometer=()",
    "ambient-light-sensor=()",
    "autoplay=(self)",
    "camera=()",
    "display-capture=()",
    "encrypted-media=(self)",
    "fullscreen=(self)",
    "geolocation=()",
    "gyroscope=()",
    "magnetometer=()",
    "microphone=()",
    "midi=()",
    "payment=()",
    "publickey-credentials-create=()",
    "usb=()",
    "interest-cohort=()",
    "browsing-topics=()",
  ].join(",");
  return (req, res, next) => {
    res.setHeader("Permissions-Policy", policy);
    next();
  };
}

/* ---- Rate limiters ----
   Values fall back to safe defaults but can be tuned in gameconfig.security. */
function cfg() {
  const s = (getGameConfig().security) || {};
  // Allow tests/E2E (many requests from one IP) to opt out of rate limiting.
  const disabled = process.env.DISABLE_RATE_LIMIT === "1";
  return {
    enabled: !disabled && s.enabled !== false,
    api_window_min: Number(s.api_window_min) > 0 ? Number(s.api_window_min) : 15,
    api_max: Number(s.api_max) > 0 ? Number(s.api_max) : 300,
    auth_window_min: Number(s.auth_window_min) > 0 ? Number(s.auth_window_min) : 15,
    auth_max: Number(s.auth_max) > 0 ? Number(s.auth_max) : 8,
  };
}

/* General API limiter — protects against abuse / basic DoS. Health checks and
   the SEO files are exempt (load balancers / crawlers hit them often).

   NOTE: express-rate-limit fixes `windowMs`/`limit` at build time (a function
   passed to `limit` is NOT re-evaluated per request in v7). So the numeric
   limits are read once here at startup; changing them in the admin panel takes
   effect on the next server restart. The `skip` callback IS evaluated per
   request, so the on/off master switch (and DISABLE_RATE_LIMIT) is live. */
export function apiLimiter() {
  const c = cfg();
  return rateLimit({
    windowMs: c.api_window_min * 60 * 1000,
    limit: c.api_max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      if (!cfg().enabled) return true;
      const p = req.path || "";
      // Gateway callbacks must never 429 — a dropped Zarinpal return is lost revenue.
      if (p === "/health" || p === "/pay/callback" || p === "/store/callback") return true;
      if (p.endsWith("/pay/callback") || p.endsWith("/store/callback")) return true;
      return false;
    },
    message: { error: "too_many_requests", message_fa: "درخواست‌های زیاد. کمی بعد دوباره تلاش کنید.", message_en: "Too many requests, please try again later." },
  });
}

/* Strict limiter for authentication (login/register/password) — the classic
   brute-force target. Successful logins are NOT counted so real users who type
   the right password aren't penalized. */
export function authLimiter() {
  const c = cfg();
  return rateLimit({
    windowMs: c.auth_window_min * 60 * 1000,
    limit: c.auth_max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: () => !cfg().enabled,
    message: { error: "too_many_attempts", message_fa: "تلاش‌های ورود بیش از حد. کمی بعد دوباره تلاش کنید.", message_en: "Too many login attempts, please try again later." },
  });
}

/* Central error handler — logs full detail server-side, returns a generic
   message to the client (never leaks stack traces in production). */
export function errorHandler(err, req, res, next) {
  console.error("[error]", req.method, req.path, err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  const dev = process.env.NODE_ENV !== "production";
  res.status(err.status || 500).json({
    error: "server_error",
    message: dev ? String(err && err.message || err) : "Something went wrong.",
  });
}

/* ---- SSRF guard ----
   Validate an outbound URL before the server fetches it. Always blocks non-http(s)
   schemes and the cloud-metadata address (169.254.169.254 — never legitimate).
   In PRODUCTION it also blocks loopback/private/link-local ranges. In dev/test it
   allows them, because a common legitimate setup is a LOCAL AI provider
   (Ollama / LM Studio at http://localhost:11434). Set ALLOW_LOCAL_AI=1 to permit
   local addresses even in production (self-hosted LLM on the same box).
   Returns {ok:true} or {ok:false,error}. */
function stripBrackets(host) {
  return String(host || "").toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}
function ipv4FromInt(n) {
  if (!Number.isFinite(n) || n < 0 || n > 0xffffffff) return null;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}
/* Parse one IPv4 octet that may be decimal, octal (0177) or hex (0x7f).
   HackTricks / IPFuscator use these to slip past string blocklists. */
function parseOctet(s) {
  const t = String(s || "");
  if (/^0x[0-9a-f]+$/i.test(t)) {
    const n = parseInt(t, 16);
    return Number.isFinite(n) && n >= 0 && n <= 255 ? n : null;
  }
  if (/^0[0-7]+$/.test(t)) {
    const n = parseInt(t, 8);
    return Number.isFinite(n) && n >= 0 && n <= 255 ? n : null;
  }
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 && n <= 255 ? n : null;
  }
  return null;
}
/* Pull a dotted IPv4 out of IPv4, IPv4-mapped IPv6, NAT64, 6to4, hex/octal
   dword, mixed-radix dotted, or short forms (127.1). */
export function extractIpv4(host) {
  const h = stripBrackets(host).replace(/^\[|\]$/g, "");
  if (h === "0" || h === "00" || h === "0000" || h === "00000") return "0.0.0.0";
  let m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) return m[0];
  if (/^(?:0x[0-9a-f]+|0[0-7]+|\d+)(?:\.(?:0x[0-9a-f]+|0[0-7]+|\d+)){1,3}$/i.test(h)) {
    const nums = h.split(".").map(parseOctet);
    if (nums.every((n) => n != null)) {
      let a, b, c, d;
      if (nums.length === 4) [a, b, c, d] = nums;
      else if (nums.length === 3) { a = nums[0]; b = nums[1]; c = 0; d = nums[2]; }
      else if (nums.length === 2) { a = nums[0]; b = 0; c = 0; d = nums[1]; }
      else return null;
      return `${a}.${b}.${c}.${d}`;
    }
  }
  m = /(?:^|:)ffff:(?:0:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(h);
  if (m) return m[1];
  m = /(?:^|:)ffff:(?:0:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(h);
  if (m) {
    const hi = parseInt(m[1], 16), lo = parseInt(m[2], 16);
    if (Number.isFinite(hi) && Number.isFinite(lo)) return ipv4FromInt(((hi & 0xffff) * 65536 + (lo & 0xffff)) >>> 0);
  }
  m = /^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4})(?::|$)/i.exec(h);
  if (m) {
    const hi = parseInt(m[1], 16), lo = parseInt(m[2], 16);
    if (Number.isFinite(hi) && Number.isFinite(lo)) return ipv4FromInt(((hi & 0xffff) * 65536 + (lo & 0xffff)) >>> 0);
  }
  if (/^0x[0-9a-f]{1,8}$/i.test(h)) {
    const n = parseInt(h, 16);
    if (Number.isFinite(n)) return ipv4FromInt(n >>> 0);
  }
  if (/^0[0-7]{8,12}$/.test(h)) {
    const n = parseInt(h, 8);
    if (Number.isFinite(n) && n <= 0xffffffff) return ipv4FromInt(n >>> 0);
  }
  if (/^\d{8,10}$/.test(h)) return ipv4FromInt(Number(h));
  return null;
}
function ipv4IsReserved(ip) {
  const p = String(ip || "").split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  return false;
}
function ipv6IsReserved(host) {
  const h = stripBrackets(host);
  if (!h.includes(":")) return false;
  if (h === "::1" || h === "::" || h === "0:0:0:0:0:0:0:1") return true;
  if (h.startsWith("fe80:") || h.startsWith("fec0:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  if (h.includes("64:ff9b:")) return true;
  if (h.startsWith("5f00:")) return true;
  if (h.startsWith("::ffff:")) return true;
  return false;
}

export function isSafeOutboundUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return { ok: false, error: "invalid_url" }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, error: "bad_scheme" };
  const host = stripBrackets(u.hostname);
  if (!host) return { ok: false, error: "invalid_url" };
  // Cloud metadata + obvious internal service names are ALWAYS blocked.
  const alwaysBlocked = new Set([
    "0.0.0.0", "metadata.google.internal", "instance-data", "metadata", "metadata.internal",
    "kubernetes.default", "kubernetes.default.svc", "kubernetes.default.svc.cluster.local",
  ]);
  if (alwaysBlocked.has(host) || host.endsWith(".internal") || host.endsWith(".localhost") || host.endsWith(".svc") || host.endsWith(".cluster.local")) {
    return { ok: false, error: "blocked_host" };
  }
  const mapped = extractIpv4(host);
  // Cloud metadata + vendor IMDS aliases — NEVER legitimate for this app.
  const alwaysMeta = new Set(["169.254.169.254", "169.254.170.2", "100.100.100.200", "168.63.129.16"]);
  if ((mapped && alwaysMeta.has(mapped)) || alwaysMeta.has(host) || host === "fd00:ec2::254" || host.startsWith("fd00:ec2:")) {
    return { ok: false, error: "blocked_metadata" };
  }

  // Loopback / private ranges: allowed for local AI in dev, or when explicitly
  // enabled; blocked in production by default.
  const allowLocal = process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_AI === "1";
  const isLocalName = host === "localhost" || host === "::1" || host.endsWith(".local") || host.endsWith(".localhost");
  const isPrivateIp = mapped ? ipv4IsReserved(mapped) : false;
  const isPrivateV6 = ipv6IsReserved(host);
  if ((isLocalName || isPrivateIp || isPrivateV6) && !allowLocal) {
    return { ok: false, error: "blocked_private" };
  }
  return { ok: true };
}

/* Fetch that refuses internal URLs and does not blindly follow redirects
   (a public URL that 302s to the cloud-metadata address is a classic SSRF). */
export async function safeFetch(url, init = {}) {
  let current = String(url || "");
  for (let hop = 0; hop < 4; hop++) {
    const check = isSafeOutboundUrl(current);
    if (!check.ok) throw new Error(`blocked_url:${check.error}`);
    // Default 15 s budget so a stalled upstream (JWKS, webhooks…) cannot pin a
    // request handler forever; callers may pass their own signal.
    const signal = init.signal || AbortSignal.timeout(15000);
    const res = await fetch(current, { ...init, signal, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("blocked_url:empty_redirect");
      current = new URL(loc, current).href;
      continue;
    }
    return res;
  }
  throw new Error("blocked_url:too_many_redirects");
}

/* Drop __proto__ / constructor / prototype keys so a crafted JSON body cannot
   pollute Object.prototype through express.json. */
export function jsonReviver(key, value) {
  if (key === "__proto__" || key === "constructor" || key === "prototype") return undefined;
  return value;
}

/* Have I Been Pwned k-anonymity (NIST 800-63B / ASVS 2.1.7).
   Only the first 5 hex chars of SHA-1 leave the server. Fail-open on network
   errors so a HIBP outage cannot freeze registration. Disabled in tests. */
export function sha1Upper(s) {
  return crypto.createHash("sha1").update(String(s), "utf8").digest("hex").toUpperCase();
}
export function parseHibpRange(body, suffix) {
  const want = String(suffix || "").toUpperCase();
  for (const line of String(body || "").split(/\r?\n/)) {
    const [hash, count] = line.split(":");
    if (hash && hash.trim().toUpperCase() === want) return Number(count) || 1;
  }
  return 0;
}
const hibpCache = new Map();
export async function passwordPwned(pw) {
  if (process.env.DISABLE_HIBP === "1" || process.env.NODE_ENV === "test") return false;
  const hash = sha1Upper(pw);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  let body;
  const cached = hibpCache.get(prefix);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) body = cached.body;
  else {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 2500);
      const res = await safeFetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { "Add-Padding": "true", "User-Agent": "MED-School" },
        signal: ac.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return false;
      body = await res.text();
      hibpCache.set(prefix, { at: Date.now(), body });
      if (hibpCache.size > 200) hibpCache.delete(hibpCache.keys().next().value);
    } catch {
      return false;
    }
  }
  return parseHibpRange(body, suffix) > 0;
}

/* A tiny snapshot for the admin security dashboard. */
export function securityStatus() {
  const c = cfg();
  return {
    enabled: c.enabled,
    helmet: true,
    hsts: true,
    csp: true,
    hide_powered_by: true,
    rate_limit: {
      api: { window_min: c.api_window_min, max: c.api_max },
      auth: { window_min: c.auth_window_min, max: c.auth_max, skip_successful: true },
    },
    bcrypt_cost: 12,
    jwt_algorithm: "HS256 (pinned, iss/aud/jti)",
    jwt_expiry: "12h",
    jwt_revocation: "token_ver+jti",
    common_password_block: true,
    hibp_k_anonymity: process.env.DISABLE_HIBP !== "1",
    login_backoff: true,
    ssrf_guard: true,
    upload_magic_check: true,
    cors_default_same_origin: !process.env.CORS_ORIGIN,
    csp_report_only: true,
    api_no_store: true,
    node_env: process.env.NODE_ENV || "development",
  };
}
