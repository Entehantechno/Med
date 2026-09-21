import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db, persistNow } from "../db.js";
import { signToken, authRequired, authOptional, setAuthCookie, clearAuthCookie, bumpTokenVer, revokeJti } from "../lib/auth.js";
import { permsFor } from "../lib/rbac.js";
import { isEnabled } from "../lib/flags.js";
import { sendVerificationEmail, mailConfigured, APP_URL } from "../lib/mailer.js";
import { verifyGoogleToken, googleConfigured, googleClientId } from "../lib/google.js";
import { passwordPwned } from "../lib/security.js";
import { hashPassword, verifyPassword, needsRehash } from "../lib/password.js";
import { validateBody, s } from "../lib/validate.js";
import { normDigits } from "../lib/textsearch.js";

const r = Router();
const publicUser = (u) => ({ id: u.id, username: u.username, role: u.role, name_fa: u.name_fa, name_en: u.name_en, email: u.email, email_verified: !!u.email_verified, avatar: u.avatar, phone: u.phone, bio: u.bio, nickname: u.nickname, anon_mode: !!u.anon_mode, perms: permsFor(u.role) });
const emailValid = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || ""));
// Same bcrypt cost as real hashes so a missing username takes the same time.
const DUMMY_HASH = bcrypt.hashSync("timing-pad-not-a-password", 12);
function minPasswordLen() {
  return process.env.NODE_ENV === "production" ? 8 : 4;
}
const MAX_PASSWORD = 128;
// ASVS 6.2.4 / CWE-521: reject the most-abused passwords (and product-name variants).
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "passw0rd",
  "12345678", "123456789", "1234567890", "qwertyui", "qwerty123",
  "letmein1", "welcome1", "admin123", "adminadmin", "iloveyou",
  "abc12345", "11111111", "00000000", "1q2w3e4r", "zaq12wsx",
  "monkey12", "dragon12", "master12", "login123", "changeme",
  "medschool", "medschool1", "medlab123", "med-school",
]);
export function passwordRejected(pw) {
  const s = String(pw || "");
  if (s.length < minPasswordLen()) return "too_short";
  if (s.length > MAX_PASSWORD) return "too_long";
  const low = s.toLowerCase();
  if (COMMON_PASSWORDS.has(low) || /medschool|medlab/.test(low)) return "common";
  return null;
}

// Temporary per-account backoff (ASVS 6.1.1: do NOT permanently lock — that is a DoS).
const fails = new Map();
function failKey(id) { return String(id || "").trim().toLowerCase(); }
export function loginBlocked(id) {
  if (process.env.DISABLE_RATE_LIMIT === "1") return false;
  const e = fails.get(failKey(id));
  return !!(e && e.until && Date.now() < e.until);
}
function noteLoginFail(id) {
  if (process.env.DISABLE_RATE_LIMIT === "1") return;
  const k = failKey(id);
  const e = fails.get(k) || { n: 0, until: 0 };
  e.n += 1;
  if (e.n >= 10) e.until = Date.now() + Math.min(15 * 60 * 1000, 20 * 1000 * (2 ** Math.min(6, e.n - 10)));
  fails.set(k, e);
}
function noteLoginOk(id) { fails.delete(failKey(id)); }

function createLearnerProfile(id, province = "", program = "preint") {
  const prog = (program === "basic" || program === "preint") ? program : "preint";
  db.prepare("INSERT OR IGNORE INTO learner_profiles (user_id, week_key, hearts, hearts_updated, province, active_program) VALUES (?,?,?,?,?,?)")
    .run(id, "", 5, new Date().toISOString(), province || "", prog);
}

const loginSchema = { username: s.str({ min: 1, max: 200 }), password: s.str({ min: 1, max: 128, trim: false }) };
r.post("/login", validateBody(loginSchema), async (req, res) => {
  const { username, password } = req.body || {};
  const id = String(username || "").trim();
  const idNorm = normDigits(id);
  if (loginBlocked(id) || (idNorm && loginBlocked(idNorm))) {
    return res.status(429).json({ error: "too_many_attempts", message_fa: "تلاش‌های ورود بیش از حد. کمی بعد دوباره تلاش کنید.", message_en: "Too many login attempts, please try again later." });
  }
  // allow login with either username, student_no, OR email (supporting Persian & English digits)
  const user = db.prepare("SELECT * FROM users WHERE username = ? OR username = ? OR student_no = ? OR student_no = ? OR lower(email) = lower(?)").get(id, idNorm, id, idNorm, id);
  const hash = (user && user.password_hash) ? user.password_hash : DUMMY_HASH;
  const match = await verifyPassword(password || "", hash);
  if (!user || !user.password_hash || !match) {
    noteLoginFail(id);
    if (idNorm && idNorm !== id) noteLoginFail(idNorm);
    return res.status(401).json({ error: "invalid credentials" });
  }
  if (user.status !== "active")
    return res.status(403).json({ error: "account inactive" });
  noteLoginOk(id);
  if (idNorm && idNorm !== id) noteLoginOk(idNorm);
  // Lazy bcrypt → argon2id migration: transparently upgrade this user's hash
  // after a successful login (one UPDATE per legacy user, then never again).
  try {
    if (await needsRehash(user.password_hash)) {
      const upgraded = await hashPassword(password || "");
      db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(upgraded, user.id);
      persistNow();
    }
  } catch { /* migration must never block login */ }
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ token, user: publicUser(user) });
});

// Public self sign-up for competitive learners (pre-internship track), by EMAIL.
// Always creates role='learner'. Sends a verification email (if SMTP configured);
// otherwise auto-verifies so local/dev signup still works.
const registerSchema = {
  email: s.str({ email: true, max: 200 }),
  password: s.str({ min: 1, max: 128, trim: false }),
  name_fa: s.str({ optional: true, max: 120 }),
  name_en: s.str({ optional: true, max: 120 }),
  province: s.str({ optional: true, max: 80 }),
  program: s.oneOf(["basic", "preint"], { optional: true }),
  lang: s.oneOf(["fa", "en"], { optional: true }),
  ref: s.str({ optional: true, max: 40, pattern: /^[A-Za-z0-9_-]+$/ }),
};
// The signup-enabled gate runs BEFORE body validation so a disabled sign-up
// always answers 403 even for a malformed/legacy body (security posture must
// not depend on payload validity).
const signupGate = (req, res, next) => {
  if (!isEnabled("learner_signup")) return res.status(403).json({ error: "signup disabled" });
  next();
};
r.post("/register", signupGate, validateBody(registerSchema), async (req, res) => {
  const { email, password, name_fa, name_en, province, program, lang, ref } = req.body || {};
  const mail = String(email || "").trim().toLowerCase();
  if (!emailValid(mail)) return res.status(400).json({ error: "invalid email" });
  const badPw = passwordRejected(password);
  if (badPw) return res.status(400).json({ error: "weak password" });
  if (await passwordPwned(password)) return res.status(400).json({ error: "weak password" });
  const exists = db.prepare("SELECT id FROM users WHERE lower(email)=? OR username=?").get(mail, mail);
  if (exists) return res.status(409).json({ error: "email taken" });

  const name = name_fa || name_en || mail.split("@")[0];
  const willVerifyByEmail = mailConfigured();
  const info = db.prepare(
    "INSERT INTO users (username, email, password_hash, name_fa, name_en, role, status, email_verified) VALUES (?,?,?,?,?,'learner','active',?)"
  ).run(mail, mail, await hashPassword(password), name, name_en || name, willVerifyByEmail ? 0 : 1);
  const id = info.lastInsertRowid;
  createLearnerProfile(id, province, program);

  // attach a referral if a valid invite code was supplied (double-sided rewards)
  if (ref && isEnabled("referral")) {
    try { const { attachReferral } = await import("../lib/referral.js"); attachReferral(id, ref); } catch { /* ignore */ }
  }

  let emailSent = false;
  if (willVerifyByEmail) {
    const rawTok = crypto.randomBytes(24).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawTok).digest("hex");
    db.prepare("INSERT INTO email_verifications (token, user_id, email) VALUES (?,?,?)").run(tokenHash, id, mail);
    const token = rawTok;
    const r2 = await sendVerificationEmail(mail, token, lang || "fa");
    emailSent = r2.sent;
    if (!emailSent) { // fallback: couldn't send → auto-verify so the user isn't stuck
      db.prepare("UPDATE users SET email_verified=1 WHERE id=?").run(id);
      db.prepare("DELETE FROM email_verifications WHERE user_id=?").run(id);
    }
  }
  persistNow();
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(id);
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ token, user: publicUser(user), emailSent });
});

// Verify an email via the link (GET, so it works when clicked in an email client).
r.get("/verify", (req, res) => {
  const raw = String(req.query.token || "");
  const hashed = crypto.createHash("sha256").update(raw).digest("hex");
  // Look up the hashed token first; fall back to the raw value so older rows
  // issued before this hardening still verify once.
  const row = db.prepare("SELECT * FROM email_verifications WHERE token=?").get(hashed)
    || db.prepare("SELECT * FROM email_verifications WHERE token=?").get(raw);
  if (!row) return res.status(400).send("<h3>لینک نامعتبر یا منقضی است / Invalid or expired link</h3>");
  db.prepare("UPDATE users SET email_verified=1 WHERE id=?").run(row.user_id);
  db.prepare("DELETE FROM email_verifications WHERE user_id=?").run(row.user_id);
  persistNow();
  res.redirect("/?verified=1");
});

// Google Sign-In: verify the ID token, then log in or create a learner account.
r.post("/google", async (req, res) => {
  if (!googleConfigured()) return res.status(503).json({ error: "google not configured" });
  let profile;
  try { profile = await verifyGoogleToken(req.body?.credential, { nonce: req.body?.nonce }); }
  catch (e) { return res.status(401).json({ error: "google auth failed" }); }
  if (!profile.email) return res.status(401).json({ error: "google auth failed" });

  // find by google_id, then by email; else create a new learner
  let user = db.prepare("SELECT * FROM users WHERE google_id=?").get(profile.google_id)
    || db.prepare("SELECT * FROM users WHERE lower(email)=?").get(profile.email);
  if (user) {
    // Account-takeover via Google: an attacker who registered first with the
    // victim's email (unverified) must not inherit the Google identity.
    // ASVS 2.2 / OWASP A07:2025 — only link if the mailbox is already proven.
    if (!user.google_id && !user.email_verified) {
      return res.status(409).json({ error: "email exists unverified" });
    }
    db.prepare("UPDATE users SET google_id=?, email_verified=1, avatar=COALESCE(NULLIF(avatar,''),?) WHERE id=?")
      .run(profile.google_id, profile.picture, user.id);
  } else {
    // Existing Google users may sign in even when public signup is off.
    // Brand-new accounts still honour the learner_signup flag.
    if (!isEnabled("learner_signup")) return res.status(403).json({ error: "signup disabled" });
    const info = db.prepare(
      "INSERT INTO users (username, email, google_id, password_hash, name_fa, name_en, avatar, role, status, email_verified) VALUES (?,?,?,?,?,?,?,'learner','active',1)"
    ).run(profile.email, profile.email, profile.google_id, "", profile.name, profile.name, profile.picture);
    createLearnerProfile(info.lastInsertRowid, req.body?.province, req.body?.program);
  }
  persistNow();
  user = db.prepare("SELECT * FROM users WHERE google_id=?").get(profile.google_id);
  if (user.status !== "active") return res.status(403).json({ error: "account inactive" });
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ token, user: publicUser(user) });
});

r.post("/logout", authOptional, (req, res) => {
  if (req.user?.jti) revokeJti(req.user.jti, req.user.id, req.user.exp);
  if ((req.body?.all || req.query?.all) && req.user?.id) bumpTokenVer(req.user.id);
  clearAuthCookie(res);
  // Clear client-side caches/storage on logout where supported. We intentionally
  // avoid clearing cookies via Clear-Site-Data because clearAuthCookie already
  // removes the auth cookie and some shared hosts/proxies handle that directive
  // inconsistently.
  res.setHeader("Clear-Site-Data", '"cache", "storage"');
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true });
});

// ASVS 3.3.4 — terminate every other device after re-auth is not required here
// because the caller already holds a live session; bumping token_ver kills all JWTs.
r.post("/logout-all", authRequired, (req, res) => {
  if (req.user?.jti) revokeJti(req.user.jti, req.user.id, req.user.exp);
  bumpTokenVer(req.user.id);
  clearAuthCookie(res);
  res.setHeader("Clear-Site-Data", '"cache", "storage"');
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true });
});

// Expose which social/email auth methods are available (for the login UI).
r.get("/methods", (req, res) => {
  res.json({ google: googleConfigured(), googleClientId: googleClientId(), emailVerify: mailConfigured() });
});

r.get("/me", authRequired, (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  if (!u) return res.status(404).json({ error: "not found" });
  res.json({ user: { ...publicUser(u), student_no: u.student_no, university_id: u.university_id } });
});

// Self-service profile edit: optional fields + identity-display preferences.
// Users can set a nickname and toggle anonymous mode (show nickname instead of
// real name in rankings/competition). Real name is the default (anon_mode=0).
r.put("/me", authRequired, (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  if (!u) return res.status(404).json({ error: "not found" });
  const b = req.body || {};
  const clean = (v, max) => v == null ? undefined : String(v).replace(/[<>]/g, "").trim().slice(0, max);
  const phone = "phone" in b ? (clean(b.phone, 32) || null) : u.phone;
  const bio = "bio" in b ? (clean(b.bio, 280) || null) : u.bio;
  const nickname = "nickname" in b ? (clean(b.nickname, 32) || null) : u.nickname;
  // anon_mode can only be turned ON if a nickname exists (else nothing to show)
  let anon = "anon_mode" in b ? (b.anon_mode ? 1 : 0) : (u.anon_mode || 0);
  if (anon && !nickname) anon = 0;
  db.prepare("UPDATE users SET phone=?, bio=?, nickname=?, anon_mode=? WHERE id=?")
    .run(phone, bio, nickname, anon, req.user.id);
  // Keep the learner competitive-ranking identity in sync (it reads
  // learner_profiles.anon_mode/alias) so one toggle governs both.
  if (u.role === "learner") {
    db.prepare("UPDATE learner_profiles SET anon_mode=?, alias=? WHERE user_id=?")
      .run(anon, nickname || null, req.user.id);
  }
  persistNow();
  const fresh = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  res.json({ user: { ...publicUser(fresh), student_no: fresh.student_no, university_id: fresh.university_id } });
});

// Change own password (verifies current password)
const changePwSchema = {
  currentPassword: s.str({ min: 1, max: 128, trim: false }),
  newPassword: s.str({ min: 1, max: 128, trim: false }),
};
r.put("/password", authRequired, validateBody(changePwSchema), async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (passwordRejected(newPassword))
    return res.status(400).json({ error: "password too short" });
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  if (!u || !u.password_hash || !(await verifyPassword(currentPassword || "", u.password_hash)))
    return res.status(400).json({ error: "wrong current password" });
  const nextVer = bumpTokenVer(u.id);
  db.prepare("UPDATE users SET password_hash=?, token_ver=? WHERE id=?")
    .run(await hashPassword(String(newPassword).slice(0, MAX_PASSWORD)), nextVer, req.user.id);
  persistNow();
  const fresh = db.prepare("SELECT * FROM users WHERE id=?").get(u.id);
  const token = signToken(fresh);
  setAuthCookie(res, token);
  res.json({ ok: true, token });
});

export default r;
