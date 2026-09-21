/* ================================================================
   auth.js — JWT helpers + middleware
   ================================================================ */
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db } from "../db.js";

// JWT signing secret. In production a strong secret MUST be provided; falling
// back to a public default would let anyone forge tokens. We refuse to boot
// with the dev default when NODE_ENV=production so a misconfigured host fails
// loudly instead of shipping an insecure server.
const SECRET = process.env.JWT_SECRET || "dev-secret";
const WEAK_SECRETS = [
  "dev-secret", "change-me-in-production", "change-this-secret-in-production", "change-this-to-a-long-random-string",
  // the fixed secret that shipped in every zip up to v67 (public → forgeable)
  "529a1c5a1a1bc2f60cb6e1cdb8eca545ff12f6bbd41fc4c46f967821c3f5e6b4e0d8fd52a0e98f14679432bf08bc9762",
];
if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || WEAK_SECRETS.includes(process.env.JWT_SECRET))) {
  console.error("\n❌ FATAL: JWT_SECRET is not set (or uses the default) in production.\n   Set a strong, random JWT_SECRET environment variable before starting.\n   Generate one with:  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"\n");
  process.exit(1);
}

export const JWT_ISS = "medschool";
export const JWT_AUD = "medschool-api";

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      username: user.username,
      ver: Number(user.token_ver) || 1,
      jti: crypto.randomBytes(16).toString("hex"),
    },
    SECRET,
    { expiresIn: "12h", algorithm: "HS256", issuer: JWT_ISS, audience: JWT_AUD }
  );
}

export function bumpTokenVer(userId) {
  if (!userId) return 1;
  const cur = db.prepare("SELECT token_ver FROM users WHERE id=?").get(userId);
  const next = (Number(cur?.token_ver) || 1) + 1;
  db.prepare("UPDATE users SET token_ver=? WHERE id=?").run(next, userId);
  return next;
}

/* Per-token denylist (ASVS 3.3.1 / OWASP WSTG logout). Logout of THIS device
   revokes only that jti; logout-everywhere bumps token_ver. Rows expire with
   the JWT so the table stays small. */
export function revokeJti(jti, userId, exp) {
  if (!jti) return;
  try {
    const until = Number(exp) > 0 ? Number(exp) : Math.floor(Date.now() / 1000) + 12 * 3600;
    db.prepare("INSERT OR IGNORE INTO revoked_tokens (jti, user_id, exp) VALUES (?,?,?)")
      .run(String(jti), userId || null, until);
    if (Math.random() < 0.05) {
      db.prepare("DELETE FROM revoked_tokens WHERE exp < ?").run(Math.floor(Date.now() / 1000));
    }
  } catch { /* table created in initSchema */ }
}
export function isJtiRevoked(jti) {
  if (!jti) return false;
  try {
    return !!db.prepare("SELECT jti FROM revoked_tokens WHERE jti=?").get(String(jti));
  } catch { return false; }
}

function cookieValue(req, name) {
  const raw = req.headers.cookie || "";
  const parts = raw.split(/;\s*/);
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i < 0) continue;
    if (p.slice(0, i) === name) return decodeURIComponent(p.slice(i + 1));
  }
  return null;
}
function tokenFromRequest(req) {
  const header = req.headers.authorization || "";
  const h = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (h && h !== "null" && h !== "undefined") return h;
  return cookieValue(req, "medlab_token");
}

export function setAuthCookie(res, token) {
  const secure = process.env.NODE_ENV === "production";
  res.cookie("medlab_token", token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60 * 1000,
  });
}
export function clearAuthCookie(res) {
  res.clearCookie("medlab_token", { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
}

function attachUser(token) {
  const payload = jwt.verify(token, SECRET, { algorithms: ["HS256"], issuer: JWT_ISS, audience: JWT_AUD });
  // Server-side revocation: password change / admin reset bumps token_ver.
  try {
    const row = db.prepare("SELECT token_ver, status, role FROM users WHERE id=?").get(payload.id);
    if (!row) throw new Error("gone");
    if (row.status && row.status !== "active") throw new Error("inactive");
    const live = Number(row.token_ver);
    const claimed = Number(payload.ver);
    if ((Number.isFinite(live) ? live : 1) !== (Number.isFinite(claimed) ? claimed : 1)) throw new Error("revoked");
    if (payload.jti && isJtiRevoked(payload.jti)) throw new Error("revoked");
    if (row.role) payload.role = row.role;
  } catch (e) {
    const msg = String(e && e.message || e);
    if (msg === "revoked" || msg === "gone" || msg === "inactive") throw e;
    if (/no such column/i.test(msg)) return payload;
    throw e;
  }
  return payload;
}

export function authRequired(req, res, next) {
  const token = tokenFromRequest(req);
  if (!token) return res.status(401).json({ error: "no token" });
  try {
    req.user = attachUser(token);
    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}

export function authOptional(req, res, next) {
  const token = tokenFromRequest(req);
  if (token) { try { req.user = attachUser(token); } catch { /* ignore */ } }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role))
      return res.status(403).json({ error: "forbidden" });
    next();
  };
}
