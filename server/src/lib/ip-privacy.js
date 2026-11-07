/* ip-privacy.js — data minimisation for client IP addresses.
   Raw IPs are needed only for live rate limiting (kept in memory / keyed in the rate
   store). Anything PERSISTED for security review (security_events, audit_log) stores a
   keyed HMAC-SHA256 digest instead: the same client maps to the same token, so
   "many failures from one client" can still be detected, but the address itself is not
   kept. The key comes from IP_HASH_SECRET; if it is absent a random per-process key is
   used, so tokens stop being linkable across restarts (privacy over continuity). */
import crypto from "node:crypto";

const SECRET = process.env.IP_HASH_SECRET
  ? String(process.env.IP_HASH_SECRET)
  : crypto.randomBytes(32).toString("hex");

export function clientIp(req) {
  const raw = req?.ip || req?.socket?.remoteAddress || "";
  return String(raw).replace(/^::ffff:/, "");
}

/** Keyed digest of an IP for storage. Empty input gives "". */
export function storedIp(ip) {
  const v = String(ip || "").replace(/^::ffff:/, "").trim();
  if (!v) return "";
  return "h:" + crypto.createHmac("sha256", SECRET).update(v).digest("hex").slice(0, 24);
}

/** Digest for the request's client address, safe to persist. */
export function storedIpFromReq(req) {
  return storedIp(clientIp(req));
}
