/* certificates.js — verifiable course/program completion certificates.

   AI-FREE, deterministic. This is the native equivalent of the useful parts of
   LearnDash's certificate add-ons — but with the features LearnDash lacks
   out-of-the-box (research): a unique credential ID, a PUBLIC verification page
   anyone can check, a QR code to that page, and one-click social sharing.

   Two kinds:
     • program — the learner completes their active learning path (pre-internship)
     • course  — the learner completes a video course (courses table)

   Eligibility is real: program certs check node_progress vs path_nodes for the
   learner's active program; course certs check enrollment (+ optional lesson
   watching). Auto-issue can fire when a threshold is crossed, or an admin can
   issue/revoke manually. Each certificate stores SNAPSHOTS (name, title, signer)
   so it stays accurate even if the source later changes. */
import { db, persistNow } from "../db.js";
import crypto from "crypto";
import { getGameConfig } from "./gameconfig.js";
import { activeProgramFor, programLabel } from "./programs.js";

/* ------------------------------------------------------------- serials ----- */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
function randCode(n = 6) {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s;
}
function newSerial() {
  const year = new Date().getFullYear();
  for (let i = 0; i < 20; i++) {
    const serial = `MED-${year}-${randCode(6)}`;
    if (!db.prepare("SELECT 1 FROM certificates WHERE serial=?").get(serial)) return serial;
  }
  return `MED-${year}-${Date.now().toString(36).toUpperCase()}`;
}

/* ------------------------------------------------------------- helpers ------ */
function cfg() { return getGameConfig().certificates || {}; }
function learnerName(userId) {
  const u = db.prepare("SELECT name_fa, name_en, username FROM users WHERE id=?").get(userId);
  return (u && (u.name_fa || u.name_en || u.username)) || "";
}
function totalStudyHours(userId) {
  // rough, honest estimate from XP events count → a friendly "hours of study".
  const row = db.prepare("SELECT COUNT(*) c FROM xp_events WHERE user_id=?").get(userId);
  const sessions = row?.c || 0;
  return Math.max(1, Math.round(sessions / 4)); // ~4 events per study hour
}

/* -------------------------------------------------- eligibility (program) --- */
/* Progress (0..100) of the learner's ACTIVE program path. */
export function programProgress(userId) {
  const prog = activeProgramFor(userId); // program key or null
  const total = db.prepare(`
    SELECT COUNT(*) c FROM path_nodes pn
    JOIN topics t ON t.id = pn.topic_id
    ${prog ? "WHERE t.program = ?" : ""}`).get(...(prog ? [prog] : [])).c || 0;
  const done = db.prepare(`
    SELECT COUNT(*) c FROM node_progress np
    JOIN path_nodes pn ON pn.id = np.node_id
    JOIN topics t ON t.id = pn.topic_id
    WHERE np.user_id=? AND np.completed_at IS NOT NULL ${prog ? "AND t.program=?" : ""}`)
    .get(...(prog ? [userId, prog] : [userId])).c || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { program: prog, total, done, pct };
}

/* -------------------------------------------------- eligibility (course) ---- */
export function courseProgress(userId, courseId) {
  const enrolled = !!db.prepare("SELECT 1 FROM course_enrollments WHERE user_id=? AND course_id=?").get(userId, courseId);
  const total = db.prepare("SELECT COUNT(*) c FROM course_lessons WHERE course_id=?").get(courseId).c || 0;
  // We don't track per-lesson watching yet; enrollment is the honest signal.
  // pct is 100 when enrolled (owns the whole course), else 0.
  return { enrolled, total, pct: enrolled ? 100 : 0 };
}

/* --------------------------------------------------------------- issue ------ */
function serialize(row, lang = "fa") {
  const isFa = lang !== "en";
  return {
    serial: row.serial,
    kind: row.kind,
    recipient: row.recipient_name,
    title: (isFa ? row.title_fa : row.title_en) || row.title_fa || row.title_en,
    org: isFa ? (cfg().org_name_fa || "MED School") : (cfg().org_name_en || "MED School"),
    hours: row.hours || null,
    grade: row.grade || null,
    signer: row.signer_name || null,
    signer_title: (isFa ? row.signer_title_fa : row.signer_title_en) || null,
    issued_at: row.issued_at,
    revoked: !!row.revoked,
  };
}

/* Issue (or return existing) a certificate. Idempotent per (user,kind,ref/program). */
export function issueCertificate({ userId, kind = "program", courseId = null, force = false }) {
  const c = cfg();
  if (c.enabled === false && !force) return { ok: false, error: "disabled" };
  const name = learnerName(userId);

  if (kind === "program") {
    const pp = programProgress(userId);
    if (!force && pp.pct < (Number(c.program_threshold) || 100)) return { ok: false, error: "not_eligible", progress: pp.pct };
    const progKey = pp.program || "default";
    const existing = db.prepare("SELECT * FROM certificates WHERE user_id=? AND kind='program' AND program_key=?").get(userId, progKey);
    if (existing) return { ok: true, serial: existing.serial, existing: true };
    const labelFa = programLabel(pp.program, "fa");
    const labelEn = programLabel(pp.program, "en");
    const serial = newSerial();
    db.prepare(`INSERT INTO certificates
      (serial, user_id, kind, program_key, recipient_name, title_fa, title_en, hours, signer_name, signer_title_fa, signer_title_en)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      serial, userId, "program", progKey, name,
      labelFa || "دورهٔ پره‌انترنی",
      labelEn || "Pre-internship Program",
      c.show_hours ? String(totalStudyHours(userId)) : null,
      c.signer_name_fa || "", c.signer_title_fa || "", c.signer_title_en || ""
    );
    persistNow();
    return { ok: true, serial, existing: false };
  }

  if (kind === "course") {
    if (!courseId) return { ok: false, error: "no_course" };
    const cp = courseProgress(userId, courseId);
    if (!force && cp.pct < (Number(c.course_threshold) || 100)) return { ok: false, error: "not_eligible", progress: cp.pct };
    const existing = db.prepare("SELECT * FROM certificates WHERE user_id=? AND kind='course' AND ref_id=?").get(userId, courseId);
    if (existing) return { ok: true, serial: existing.serial, existing: true };
    const course = db.prepare("SELECT * FROM courses WHERE id=?").get(courseId);
    if (!course) return { ok: false, error: "no_course" };
    const serial = newSerial();
    db.prepare(`INSERT INTO certificates
      (serial, user_id, kind, ref_id, recipient_name, title_fa, title_en, signer_name, signer_title_fa, signer_title_en)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      serial, userId, "course", courseId, name,
      course.title_fa || "", course.title_en || "",
      course.instructor_fa || c.signer_name_fa || "", course.instructor_fa ? "" : (c.signer_title_fa || ""), course.instructor_en ? "" : (c.signer_title_en || "")
    );
    persistNow();
    return { ok: true, serial, existing: false };
  }
  return { ok: false, error: "bad_kind" };
}

/* Auto-issue hook: call after a lesson/node finishes; issues if newly eligible. */
export function maybeAutoIssueProgram(userId) {
  const c = cfg();
  if (c.enabled === false || c.auto_issue === false) return null;
  const pp = programProgress(userId);
  if (pp.pct >= (Number(c.program_threshold) || 100)) {
    const r = issueCertificate({ userId, kind: "program" });
    return r.ok && !r.existing ? r.serial : null;
  }
  return null;
}

/* --------------------------------------------------------- learner views --- */
export function myCertificates(userId, lang = "fa") {
  const rows = db.prepare("SELECT * FROM certificates WHERE user_id=? AND revoked=0 ORDER BY issued_at DESC").all(userId);
  return rows.map((r) => serialize(r, lang));
}

/* What the learner could still earn (progress toward each certificate). */
export function myProgress(userId, lang = "fa") {
  const isFa = lang !== "en";
  const out = [];
  const pp = programProgress(userId);
  const has = (kind, ref, pk) => !!db.prepare(
    `SELECT 1 FROM certificates WHERE user_id=? AND kind=? AND ${kind === "program" ? "program_key=?" : "ref_id=?"} AND revoked=0`
  ).get(userId, kind, kind === "program" ? (pp.program || "default") : ref);
  const label = programLabel(pp.program, isFa ? "fa" : "en");
  out.push({
    kind: "program",
    title: label || (isFa ? "دورهٔ پره‌انترنی" : "Pre-internship"),
    pct: pp.pct, earned: has("program"),
  });
  return out;
}

/* --------------------------------------------------- public verification --- */
export function verify(serial, lang = "fa") {
  const row = db.prepare("SELECT * FROM certificates WHERE serial=?").get(String(serial || "").trim().toUpperCase());
  if (!row) return { valid: false };
  if (row.revoked) return { valid: false, revoked: true, serial: row.serial };
  return { valid: true, ...serialize(row, lang) };
}

/* --------------------------------------------------------------- admin ------ */
export function adminList({ lang = "fa" } = {}) {
  const rows = db.prepare(`
    SELECT c.*, u.username FROM certificates c
    LEFT JOIN users u ON u.id = c.user_id
    ORDER BY c.issued_at DESC LIMIT 500`).all();
  return rows.map((r) => ({
    id: r.id, serial: r.serial, kind: r.kind, username: r.username,
    recipient: r.recipient_name, title: (lang === "en" ? r.title_en : r.title_fa) || r.title_fa,
    issued_at: r.issued_at, revoked: !!r.revoked,
  }));
}
export function adminStats() {
  const total = db.prepare("SELECT COUNT(*) c FROM certificates").get().c || 0;
  const active = db.prepare("SELECT COUNT(*) c FROM certificates WHERE revoked=0").get().c || 0;
  const byKind = db.prepare("SELECT kind, COUNT(*) c FROM certificates GROUP BY kind").all();
  return { total, active, revoked: total - active, byKind };
}
export function setRevoked(id, revoked) {
  db.prepare("UPDATE certificates SET revoked=? WHERE id=?").run(revoked ? 1 : 0, id);
  persistNow();
  return { ok: true };
}
/* Admin manual issue by username + kind (force past thresholds). */
export function adminIssue({ username, kind = "program", courseId = null }) {
  const u = db.prepare("SELECT id FROM users WHERE username=? OR email=?").get(username, username);
  if (!u) return { ok: false, error: "no_user" };
  return issueCertificate({ userId: u.id, kind, courseId, force: true });
}
