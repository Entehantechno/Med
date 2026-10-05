/* publicurl.js — the URL Zarinpal (and email links) must bounce back to.

   Operators often leave APP_URL=http://localhost:4000 — or a placeholder like
   CHANGE-ME / example.com — on a live host. The gateway then redirects to a
   host that does not exist and the paid user never gets Plus.

   Canonical live domain: https://medschool.ir
   www.medschool.ir is treated as the same site (aliases). */

const PLACEHOLDER = /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|example\.(?:com|org|net)|yourdomain|change-?me|changeme|invalid|placeholder|medschool\.local(?:host)?\b/i;

export function isUsablePublicUrl(s) {
  const raw = String(s || "").trim();
  if (!raw) return false;
  if (PLACEHOLDER.test(raw)) return false;
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (!parsed.hostname || PLACEHOLDER.test(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Apex + www of a Host header so CSRF / callbacks treat them as one site. */
export function hostAliases(host) {
  const h = String(host || "").toLowerCase().split(":")[0].trim();
  if (!h) return [];
  const out = new Set([h]);
  if (h.startsWith("www.")) out.add(h.slice(4));
  else out.add(`www.${h}`);
  return [...out];
}

export function publicBaseUrl(req) {
  const env = String(process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (isUsablePublicUrl(env)) {
    try {
      const u = new URL(env);
      // Zarinpal only accepts https callbacks on a live merchant.
      if (process.env.NODE_ENV === "production" && u.protocol === "http:") u.protocol = "https:";
      return u.origin;
    } catch { /* fall through to the request host */ }
  }
  if (req) {
    const xfProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const proto = xfProto || req.protocol || (process.env.NODE_ENV === "production" ? "https" : "http");
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
    if (host) return `${proto}://${host}`;
  }
  if (process.env.NODE_ENV === "production") return "https://medschool.ir";
  return env || "http://localhost:4000";
}
