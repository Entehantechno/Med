import { routingSettings } from "../lib/ai-routing.js";
/* ================================================================
   content.js — Cases, flashcards, checklists, users, prompts,
   settings CRUD (with content versioning on cases & flashcards).
   ================================================================ */
import { Router } from "express";
import { hashPassword, hashPasswordSync } from "../lib/password.js";
import { db, persistNow } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";
import { toCSV, parseCSV } from "../lib/csv.js";
import { checkStudentLimit } from "../lib/orglimits.js";
import { normalizeRubric } from "../lib/grading-rubric.js";
import { resolveAiConfig } from "../lib/ai-engine.js";
import { DEFAULT_LAB_TESTS, DEFAULT_IMAGING, DEFAULT_PARACLINIC, cleanOrderList } from "../data/order-catalog-defaults.js";
import { studentSafeFlashcard, gradeFlashcard } from "../lib/flashcard-grade.js";
import { studentMaySeeFlashcard, studentFlashcardAccess, caseInLiveExam } from "../lib/live-exam-content.js";
import { sqlInList } from "../lib/http-cache.js";
import { isLearnContent, caseIsLearn } from "../lib/content-track.js";
import { policyRow, policyReadiness, referenceSnapshotForPolicy, publicReferenceSnapshot } from "../lib/reference-governance.js";

const r = Router();
const parse = (row, extra = {}) => ({ ...JSON.parse(row.data_json), id: row.id, version: row.version, difficulty: row.difficulty, university_id: row.university_id || null, ...extra });
function tenantFilterFor(user) {
  if (user.role === "teacher" || user.role === "student") return currentUniversityId(user) || -1;
  return null;
}
/* A case owns an immutable reference snapshot. Editing a policy later never
   retroactively changes a student's encounter; a case author must deliberately
   select/rebaseline a policy in the case update endpoint. */
function legacyReferencePolicy(universityId) {
  return db.prepare("SELECT id FROM course_reference_policies WHERE university_id=? AND course_code='legacy-unverified'").get(universityId)?.id || null;
}
function approvedReferenceForCase(universityId, policyId) {
  const p = policyRow(policyId);
  if (!p || Number(p.university_id) !== Number(universityId)) return { error: "reference_policy_wrong_university" };
  const ready = policyReadiness(p);
  if (!ready.ready) return { error: "reference_policy_not_ready", readiness: ready };
  return { policy: p, snapshot: referenceSnapshotForPolicy(p) };
}
function caseReferenceExtra(row) {
  if (!row) return {};
  const raw = row.reference_snapshot_json || (row.reference_policy_id ? JSON.stringify(referenceSnapshotForPolicy(row.reference_policy_id)) : null);
  return raw ? { reference_policy_id: row.reference_policy_id || null, reference: publicReferenceSnapshot(raw) } : { reference_policy_id: null, reference: publicReferenceSnapshot(null) };
}

/* BUGFIX (answer leak): case payloads returned to students/learners used to be
   the FULL data_json — diagnosis, teaching objectives, exam findings, lab and
   imaging answers were sitting in the student's browser (devtools-readable).
   The UI only ever needs the card fields + the medical images, so for those
   roles we whitelist exactly those. Teachers/admins still get the full record
   (they author the cases). */
const STUDENT_SAFE_CASE_FIELDS = [
  "id", "version", "difficulty",
  "specialty_fa", "specialty_en", "age", "sex",
  "chief_fa", "chief_en", "history_form",
  // NOTE: `images` and `title_*` are intentionally NOT sent to students:
  // pictures are delivered only when the matching study is ordered, and the
  // internal case title (often the diagnosis) is replaced by the chief complaint.
];
const STUDENT_SAFE_EXTRAS = new Set(["maxAttempts", "attemptsUsed", "best", "university_id", "active"]);
function studentSafeCase(full) {
  const safe = {};
  for (const k of STUDENT_SAFE_CASE_FIELDS) if (full?.[k] !== undefined) safe[k] = full[k];
  // keep any caller-added non-data values (maxAttempts, attemptsUsed, ...)
  // but NEVER copy numeric answer-key fields such as checklist_id.
  for (const [k, v] of Object.entries(full || {})) {
    if (STUDENT_SAFE_CASE_FIELDS.includes(k)) continue;
    if (STUDENT_SAFE_EXTRAS.has(k) && typeof v !== "string" && typeof v !== "object") safe[k] = v;
  }
  return safe;
}
function isUniversityExpert(user) {
  if (!user || user.role !== "teacher") return false;
  try {
    const row = db.prepare("SELECT is_expert FROM users WHERE id=?").get(user.id);
    return row && Number(row.is_expert) === 1;
  } catch { return false; }
}
function canManageUniResource(user, row) {
  if (isLearnContent(row?.data_json)) return user.role === "admin";
  if (user.role === "admin") return true;
  if (user.role !== "teacher") return false;
  if ((row.university_id || 1) !== currentUniversityId(user)) return false;
  if (isUniversityExpert(user)) return true;
  if (row.created_by == null) return true;
  return Number(row.created_by) === Number(user.id);
}
function canManageStudentAccount(actor, target) {
  if (!target) return false;
  if (actor.role === "admin") return true;
  if (actor.role !== "teacher") return false;
  if (target.role !== "student") return false;
  return (target.university_id || 1) === currentUniversityId(actor);
}
function caseIdsForUniversity(ids, universityId) {
  const uni = universityId || 1;
  const want = sqlInList(ids);
  if (!want.length) return [];
  const ph = want.map(() => "?").join(",");
  const ok = new Set();
  for (const row of db.prepare(`SELECT id, data_json, university_id FROM cases WHERE id IN (${ph}) AND active=1`).all(...want)) {
    if (isLearnContent(row.data_json)) continue;
    if ((row.university_id || 1) !== uni) continue;
    ok.add(row.id);
  }
  return want.filter((id) => ok.has(id));
}

/* ---------------- Exam access helpers ---------------- */
// Returns the set of case_ids a student is allowed to access.
export function assignedCaseIds(userId) {
  const rows = db.prepare(
    "SELECT case_id FROM exam_assignments WHERE user_id=? AND active=1"
  ).all(userId);
  return new Set(rows.map((r) => r.case_id));
}
export function canAccessCase(user, caseId) {
  if (user.role === "admin") return true;
  if (user.role === "teacher") {
    const row = db.prepare("SELECT university_id, data_json FROM cases WHERE id=?").get(caseId);
    if (!row || isLearnContent(row.data_json)) return false;
    return (row.university_id || 1) === currentUniversityId(user);
  }
  if (user.role === "learner") return caseIsLearn(caseId);
  if (user.role === "content_manager" || user.role === "support") return caseIsLearn(caseId);
  if (user.role !== "student") return false;
  if (caseIsLearn(caseId)) return false;
  const tenant = currentUniversityId(user);
  const caseTenant = db.prepare("SELECT university_id FROM cases WHERE id=?").get(caseId)?.university_id;
  if (!tenant || Number(caseTenant) !== Number(tenant)) return false;
  const cid = Number(caseId);
  // (1) directly assigned via exam_assignments
  if (assignedCaseIds(user.id).has(cid)) return true;
  // (2) case attached to an ACTIVE class the student is enrolled in.
  //     Deactivating a class must revoke its students' access to the class's
  //     cases (otherwise a student could keep reaching them by case id).
  const viaClass = db.prepare(
    `SELECT 1 FROM class_cases cc
       JOIN classes c ON c.id = cc.class_id
       JOIN class_members m ON m.class_id = cc.class_id
      WHERE cc.case_id=? AND m.user_id=? AND c.active=1 AND c.university_id=? LIMIT 1`
  ).get(cid, user.id, tenant);
  if (viaClass) return true;
  // (3) case belongs to a scheduled exam the student is a participant of.
  //     Exam cases are stored as a JSON array column, so scan the participant's
  //     exams and check their case_ids.
  const examRows = db.prepare(
    `SELECT e.case_ids, e.starts_at, e.ends_at FROM exams e
       JOIN exam_participants p ON p.exam_id = e.id
      WHERE p.user_id=? AND e.active=1 AND e.university_id=?`
  ).all(user.id, tenant);
  const now = Date.now();
  for (const row of examRows) {
    const s = row.starts_at ? new Date(row.starts_at).getTime() : null;
    if (s && now < s) continue;          // upcoming: do not leak the case card
    try {
      const ids = JSON.parse(row.case_ids || "[]");
      if (Array.isArray(ids) && ids.map(Number).includes(cid)) return true;
    } catch { /* ignore malformed */ }
  }
  return false;
}

/* ---------------- CASES ---------------- */
r.get("/cases", authRequired, (req, res) => {
  try {
  let rows = db.prepare("SELECT * FROM cases WHERE active=1 ORDER BY id").all();
  const uni = tenantFilterFor(req.user);
  if (uni) rows = rows.filter((row) => (row.university_id || 1) === uni);
  if (req.user.role === "teacher" && !isUniversityExpert(req.user)) {
    rows = rows.filter((row) => isLearnContent(row.data_json) || row.created_by == null || Number(row.created_by) === Number(req.user.id));
  }
  let list = [];
  for (const row of rows) {
    try { list.push(parse(row, { checklist_id: row.checklist_id, ...caseReferenceExtra(row) })); }
    catch { /* skip a corrupt row so one bad case cannot 500 the whole list */ }
  }
  if (req.user.role === "teacher" || req.user.role === "student") {
    list = list.filter((c) => c.track !== "learn");
  }
  if (req.user.role === "content_manager" || req.user.role === "support") {
    list = list.filter((c) => c.track === "learn");
  }
  // Never ship answer data to the student/learner side of the app.
  if (req.user.role === "student" || req.user.role === "learner") list = list.map(studentSafeCase);
  // Learners use GET /learn/vpatient — do not dump either bank here.
  if (req.user.role === "learner") return res.json([]);
  // Students only see cases the admin/teacher assigned to them.
  if (req.user.role === "student") {
    const allowed = assignedCaseIds(req.user.id);
    const maxBy = new Map();
    for (const a of db.prepare(
      "SELECT case_id, max_attempts FROM exam_assignments WHERE user_id=? AND active=1"
    ).all(req.user.id)) maxBy.set(a.case_id, a.max_attempts);
    const usedBy = new Map();
    for (const r of db.prepare(
      "SELECT case_id, COUNT(*) n FROM attempts WHERE user_id=? AND class_id IS NULL AND exam_id IS NULL GROUP BY case_id"
    ).all(req.user.id)) usedBy.set(r.case_id, r.n);
    const bestBy = new Map();
    for (const r of db.prepare(
      "SELECT case_id, MAX(score) best FROM attempts WHERE user_id=? GROUP BY case_id"
    ).all(req.user.id)) bestBy.set(r.case_id, r.best);
    list = list
      .filter((c) => allowed.has(c.id))
      .map((c) => ({
        ...c,
        maxAttempts: maxBy.get(c.id) ?? 1,
        attemptsUsed: usedBy.get(c.id) ?? 0,
        best: bestBy.get(c.id) ?? null,
      }));
  }
  res.json(list);
  } catch (e) {
    res.status(500).json({ error: "case_list_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});
r.get("/cases/:id", authRequired, async (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM cases WHERE id=?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "not found", stage: "case" });
    if (!row.active && (req.user.role === "student" || req.user.role === "learner")) {
      return res.status(404).json({ error: "not found", stage: "case" });
    }
    if ((req.user.role === "student" || req.user.role === "teacher") && isLearnContent(row.data_json)) {
      return res.status(403).json({ error: "wrong_track", reason: "wrong_track", stage: "access" });
    }
    if (req.user.role === "teacher" && !canManageUniResource(req.user, row)) {
      return res.status(403).json({ error: "wrong_university", stage: "access" });
    }
    if ((req.user.role === "learner" || req.user.role === "content_manager" || req.user.role === "support")
        && !isLearnContent(row.data_json)) {
      return res.status(403).json({ error: "university_only", reason: "university_only", stage: "access" });
    }
    if (!canAccessCase(req.user, req.params.id)) {
      return res.status(403).json({ error: "not assigned to this exam", stage: "access" });
    }
    if (req.user.role === "learner") {
      const { vpatientAccess } = await import("../lib/vpatient.js");
      const { getProfile } = await import("../lib/gamify.js");
      const vp = vpatientAccess(getProfile(req.user.id), "learner");
      if (!vp.ok) {
        return res.status(403).json({
          error: vp.reason === "premium" ? "premium required" : "virtual patient is off",
          reason: vp.reason || "off",
          stage: "access",
        });
      }
    }
    let full;
    try { full = parse(row, { checklist_id: row.checklist_id, ...caseReferenceExtra(row) }); }
    catch { return res.status(404).json({ error: "not found", stage: "case" }); }
    res.json((req.user.role === "student" || req.user.role === "learner") ? studentSafeCase(full) : full);
  } catch (e) {
    res.status(500).json({ error: "case_load_failed", stage: "case", message: String(e.message || e).slice(0, 200) });
  }
});
r.post("/cases", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const { difficulty = "medium", checklist_id = 1, reference_policy_id = null, ...data } = req.body || {};
  const wantLearn = req.user.role === "admin" && data.track === "learn";
  data.track = wantLearn ? "learn" : "university";
  const uni = wantLearn ? null : (req.user.role === "admin" ? (Number(req.body?.university_id) || currentUniversityId(req.user) || 1) : currentUniversityId(req.user));
  if (!wantLearn && (!uni || !db.prepare("SELECT id FROM universities WHERE id=? AND active=1").get(uni))) return res.status(422).json({error:"university_required"});
  delete data.university_id; delete data.reference; delete data.reference_snapshot; delete data.reference_snapshot_json;
  let policyId = null, snapshot = null;
  if (!wantLearn) {
    // Legacy API clients can still create a case, but it is explicitly blocked
    // from attributed microlearning until an educator chooses an approved policy.
    policyId = Number(reference_policy_id) || legacyReferencePolicy(uni);
    if (reference_policy_id) {
      const ref = approvedReferenceForCase(uni, policyId);
      if (ref.error) return res.status(422).json({ error: ref.error, readiness: ref.readiness });
      snapshot = ref.snapshot;
    } else if (policyId) snapshot = referenceSnapshotForPolicy(policyId);
  }
  const info = db.prepare(
    "INSERT INTO cases (version,difficulty,checklist_id,data_json,university_id,created_by,reference_policy_id,reference_snapshot_json) VALUES (1,?,?,?, ?,?,?,?)"
  ).run(difficulty, checklist_id, JSON.stringify(data), uni, req.user.id, policyId, snapshot ? JSON.stringify(snapshot) : null);
  persistNow();
  res.json({ id: info.lastInsertRowid, version: 1, track: data.track, reference: snapshot ? publicReferenceSnapshot(snapshot) : null,
    warning: !wantLearn && !reference_policy_id ? "reference_policy_required_before_microlearning" : undefined });
});
r.put("/cases/:id", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const row = db.prepare("SELECT * FROM cases WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  if (!canManageUniResource(req.user, row)) return res.status(403).json({ error: "wrong_university" });
  const { difficulty = row.difficulty, checklist_id = row.checklist_id, reference_policy_id, refresh_reference_snapshot = false, ...data } = req.body || {};
  const prevLearn = isLearnContent(row.data_json);
  if (req.user.role !== "admin") data.track = "university";
  else data.track = (data.track === "learn" || prevLearn) ? "learn" : "university";
  let policyId = row.reference_policy_id || null, snapshotJson = row.reference_snapshot_json || null;
  const policyChanged = reference_policy_id !== undefined && Number(reference_policy_id || 0) !== Number(policyId || 0);
  if (!prevLearn && (policyChanged || refresh_reference_snapshot)) {
    const target = policyChanged ? Number(reference_policy_id) : policyId;
    const ref = approvedReferenceForCase(row.university_id || 1, target);
    if (ref.error) return res.status(422).json({ error: ref.error, readiness: ref.readiness });
    policyId = target; snapshotJson = JSON.stringify(ref.snapshot);
  }
  delete data.reference; delete data.reference_snapshot; delete data.reference_snapshot_json;
  delete data.university_id;
  db.prepare("INSERT INTO case_versions (case_id,version,data_json) VALUES (?,?,?)")
    .run(row.id, row.version, row.data_json);
  const newVersion = row.version + 1;
  db.prepare("UPDATE cases SET version=?,difficulty=?,checklist_id=?,data_json=?,reference_policy_id=?,reference_snapshot_json=?,updated_at=datetime('now') WHERE id=?")
    .run(newVersion, difficulty, checklist_id, JSON.stringify(data), policyId, snapshotJson, row.id);
  res.json({ id: row.id, version: newVersion, reference: snapshotJson ? publicReferenceSnapshot(snapshotJson) : null });
});
r.delete("/cases/:id", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const row = db.prepare("SELECT * FROM cases WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  if (!canManageUniResource(req.user, row)) return res.status(403).json({ error: "wrong_university" });
  db.prepare("UPDATE cases SET active=0 WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});
r.get("/cases/:id/versions", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const caseRow = db.prepare("SELECT * FROM cases WHERE id=?").get(req.params.id);
  if (!caseRow) return res.status(404).json({ error: "not found", stage: "case" });
  if (isLearnContent(caseRow.data_json) && req.user.role !== "admin") {
    return res.status(403).json({ error: "wrong_track", reason: "wrong_track", stage: "access" });
  }
  if (!canManageUniResource(req.user, caseRow)) return res.status(403).json({ error: "wrong_university", stage: "access" });
  const rows = db.prepare("SELECT version,data_json,archived_at FROM case_versions WHERE case_id=? ORDER BY version DESC").all(req.params.id);
  res.json(rows.map((v) => {
    let data = {};
    try { data = JSON.parse(v.data_json || "{}"); } catch { data = {}; }
    return { version: v.version, archived_at: v.archived_at, data };
  }));
});

/* ---------------- SITE-BANK (global learn VP) ----------------
   The global bank is the platform-wide collection of VP cases with track=learn
   (university_id NULL). Any authenticated user can browse it; teachers can
   clone a bank case into their own university (tenant-isolated copy) and
   request promotion of a university case to the global bank.
   - GET /site-bank/cases           : list all active site-bank VP cases (track=learn) for any authed user
   - GET /site-bank/cases/:id       : fetch single site-bank case
   - POST /site-bank/cases/:id/clone: teacher clones a site-bank case into own university (tenant-isolated copy)
   - POST /cases/:id/request-promotion: teacher requests promotion of own uni case to global bank
   - GET  /site-bank/promotion-requests: list promotion requests (teacher: own uni, admin: all)
-------------------------------------------------------------------- */
r.get("/site-bank/cases", authRequired, (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM cases WHERE active=1").all().filter((row) => isLearnContent(row.data_json));
    res.json(rows.map((row) => parse(row, caseReferenceExtra(row))));
  } catch (e) {
    res.status(500).json({ error: "site_bank_list_failed", message: String(e.message || e).slice(0, 200) });
  }
});
r.get("/site-bank/cases/:id", authRequired, (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM cases WHERE id=? AND active=1").get(req.params.id);
    if (!row || !isLearnContent(row.data_json)) return res.status(404).json({ error: "not_found" });
    const full = parse(row, caseReferenceExtra(row));
    // students get safe view without diagnosis etc., teachers/admins get full
    if (req.user.role === "student" || req.user.role === "learner") return res.json(studentSafeCase(full));
    return res.json(full);
  } catch (e) {
    res.status(500).json({ error: "site_bank_fetch_failed", message: String(e.message || e).slice(0, 200) });
  }
});
r.post("/site-bank/cases/:id/clone", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
    const src = db.prepare("SELECT * FROM cases WHERE id=? AND active=1").get(req.params.id);
    if (!src || !isLearnContent(src.data_json)) return res.status(404).json({ error: "not_found" });
    const uni = req.user.role === "admin" && req.body?.university_id ? Number(req.body.university_id) : currentUniversityId(req.user);
    if (!uni || !db.prepare("SELECT id FROM universities WHERE id=? AND active=1").get(uni)) return res.status(422).json({ error: "university_required" });
    let data = {};
    try { data = JSON.parse(src.data_json || "{}"); } catch { data = {}; }
    data.track = "university";
    // keep source reference snapshot if present, but re-validate for target uni?
    let policyId = src.reference_policy_id || null;
    let snapshotJson = src.reference_snapshot_json || null;
    // If source had no policy but target has legacy, attach it so clone is usable
    if (!policyId) {
      policyId = legacyReferencePolicy(uni);
      if (policyId) snapshotJson = JSON.stringify(referenceSnapshotForPolicy(policyId));
    }
    const info = db.prepare("INSERT INTO cases (version,difficulty,checklist_id,data_json,university_id,created_by,reference_policy_id,reference_snapshot_json) VALUES (1,?,?,?, ?,?,?,?)")
      .run(src.difficulty, src.checklist_id, JSON.stringify(data), uni, req.user.id, policyId, snapshotJson);
    persistNow();
    res.json({ ok: true, id: info.lastInsertRowid, university_id: uni });
  } catch (e) {
    res.status(500).json({ error: "clone_failed", message: String(e.message || e).slice(0, 200) });
  }
});
r.post("/cases/:id/request-promotion", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM cases WHERE id=? AND active=1").get(req.params.id);
    if (!row) return res.status(404).json({ error: "not_found" });
    if (isLearnContent(row.data_json)) return res.status(422).json({ error: "already_global" });
    if (!canManageUniResource(req.user, row)) return res.status(403).json({ error: "wrong_university" });
    const existing = db.prepare("SELECT * FROM case_promotion_requests WHERE case_id=? AND status='pending'").get(row.id);
    if (existing) return res.status(409).json({ error: "already_pending", request: existing });
    const approved = db.prepare("SELECT * FROM case_promotion_requests WHERE case_id=? AND status='approved'").get(row.id);
    if (approved) return res.status(409).json({ error: "already_approved", request: approved });
    const uni = row.university_id || currentUniversityId(req.user) || 1;
    const reason = String(req.body?.reason || "").slice(0, 2000);
    const info = db.prepare("INSERT INTO case_promotion_requests (case_id, university_id, requested_by, reason) VALUES (?,?,?,?)")
      .run(row.id, uni, req.user.id, reason);
    res.json({ ok: true, id: info.lastInsertRowid, status: "pending" });
  } catch (e) {
    res.status(500).json({ error: "promotion_request_failed", message: String(e.message || e).slice(0, 200) });
  }
});
r.get("/site-bank/promotion-requests", authRequired, (req, res) => {
  try {
    if (req.user.role === "admin") {
      const rows = db.prepare("SELECT * FROM case_promotion_requests ORDER BY id DESC LIMIT 200").all();
      return res.json(rows);
    }
    const uni = currentUniversityId(req.user) || -1;
    const rows = db.prepare("SELECT * FROM case_promotion_requests WHERE university_id=? ORDER BY id DESC LIMIT 200").all(uni);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "promotion_list_failed", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---------------- FLASHCARDS ---------------- */
r.get("/flashcards", authRequired, (req, res) => {
  try {
  /* Two separate worlds share the `flashcards` table:
       • university cards (teacher/admin-authored, assigned to classes) — this
         endpoint, the "Flashcards" page in the university area;
       • the competitive question bank (track:"learn", ~11 600 official exam
         questions) — served ONLY by /learn/* and managed in Admin → Learn cards.
     The bank must never leak into the university list: for students it is a
     different product, and for admins listing 11 600 full cards (50 MB JSON)
     froze the page. The split is done in SQL so the bank rows are never even
     parsed here. */
  const learnRole = req.user.role === "learner" || req.user.role === "content_manager" || req.user.role === "support";
  // json_valid() guard: json_extract() on a corrupt row would throw and 500
  // the whole list — a corrupt card is treated as a university card and then
  // skipped by the parse try/catch below.
  const bankSql = "CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.track') = 'learn' ELSE 0 END";
  const wantIds = req.query.ids == null ? null : sqlInList(String(req.query.ids).split(/[,\s]+/));
  if (wantIds && !wantIds.length) return res.json([]);
  let rows;
  if (wantIds) {
    const ph = wantIds.map(() => "?").join(",");
    rows = db.prepare(
      `SELECT * FROM flashcards WHERE active=1 AND id IN (${ph}) AND ${learnRole ? "" : "NOT "}COALESCE(${bankSql}, 0) ORDER BY id`
    ).all(...wantIds);
  } else {
    rows = db.prepare(
      `SELECT * FROM flashcards WHERE active=1 AND ${learnRole ? "" : "NOT "}COALESCE(${bankSql}, 0) ORDER BY id`
    ).all();
  }
  const uniId = tenantFilterFor(req.user);
  if (uniId) rows = rows.filter((row) => (row.university_id || 1) === uniId);
  if (req.user.role === "teacher" && !isUniversityExpert(req.user)) {
    rows = rows.filter((row) => isLearnContent(row.data_json) || row.created_by == null || Number(row.created_by) === Number(req.user.id));
  }
  const list = [];
  if (req.user.role === "learner") {
    for (const row of rows) {
      try {
        const card = parse(row);
        // Path demo cards stay on /learn/*; the competitive Flashcards player
        // only lists curated university-type cards (hotspot, drawing, MCQ, …).
        if (card.content_origin === "demo_seed") continue;
        list.push(studentSafeFlashcard(card));
      } catch { /* skip corrupt */ }
    }
    return res.json(list);
  }
  if (learnRole) {
    for (const row of rows) {
      try { list.push(parse(row)); } catch { /* skip corrupt */ }
    }
    return res.json(list);
  }
  const strip = req.user.role === "student";
  const access = strip ? studentFlashcardAccess(req.user.id) : null;
  for (const row of rows) {
    try {
      const card = parse(row);
      if (strip) {
        const cid = Number(row.id);
        if (access.reserved.has(cid) && !access.allowedReserved.has(cid)) continue;
      }
      list.push(strip ? studentSafeFlashcard(card) : card);
    }
    catch { /* skip a corrupt card so one bad row cannot 500 the whole bank */ }
  }
  res.json(list);
  } catch (e) {
    res.status(500).json({ error: "flashcard_list_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});
r.post("/flashcards/check", authRequired, (req, res) => {
  try {
    const id = parseInt(req.body?.cardId, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_card", stage: "evaluate" });
    const row = db.prepare("SELECT * FROM flashcards WHERE id=? AND active=1").get(id);
    if (!row) return res.status(404).json({ error: "not_found", stage: "evaluate" });
    let full;
    try { full = parse(row); } catch { return res.status(404).json({ error: "not_found", stage: "evaluate" }); }
    const allowLegacy = ["teacher", "admin", "content_manager", "support"].includes(req.user.role);
    if (req.user.role === "learner") {
      if (full.track !== "learn") return res.status(403).json({ error: "university_only", stage: "evaluate" });
      return res.json(gradeFlashcard(full, req.body || {}, { allowLegacy }));
    }
    if (req.user.role === "student") {
      const uni = currentUniversityId(req.user);
      if ((row.university_id || 1) !== uni) return res.status(403).json({ error: "wrong_university", stage: "evaluate" });
      if (!studentMaySeeFlashcard(req.user.id, id)) return res.status(403).json({ error: "not_in_window", stage: "evaluate" });
      if (full.track === "learn") return res.status(403).json({ error: "wrong_track", stage: "evaluate" });
    }
    if (req.user.role === "content_manager" || req.user.role === "support") {
      if (full.track !== "learn") return res.status(403).json({ error: "university_only", stage: "evaluate" });
      return res.json(gradeFlashcard(full, req.body || {}, { allowLegacy }));
    }
    if (req.user.role === "teacher") {
      if (full.track === "learn") return res.status(403).json({ error: "wrong_track", stage: "evaluate" });
      const uni = currentUniversityId(req.user);
      if ((row.university_id || 1) !== uni) return res.status(403).json({ error: "wrong_university", stage: "evaluate" });
      if (!isUniversityExpert(req.user) && row.created_by != null && Number(row.created_by) !== Number(req.user.id)) {
        return res.status(403).json({ error: "wrong_owner", stage: "evaluate" });
      }
    }
    res.json(gradeFlashcard(full, req.body || {}, { allowLegacy }));
  } catch (e) {
    res.status(500).json({ error: "flashcard_check_failed", stage: "evaluate", message: String(e.message || e).slice(0, 200) });
  }
});
r.get("/flashcards/:id", authRequired, requireRole("teacher", "admin", "content_manager"), (req, res) => {
  const row = db.prepare("SELECT * FROM flashcards WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found", stage: "fetch" });
  if (req.user.role === "teacher" && !canManageUniResource(req.user, row)) return res.status(403).json({error:"wrong_university"});
  if (req.user.role === "content_manager" && !isLearnContent(row.data_json)) return res.status(403).json({error:"wrong_track"});
  try {
    res.json(parse(row));
  } catch (e) {
    res.status(500).json({ error: "card_parse_failed", message: e.message });
  }
});
r.post("/flashcards", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const { difficulty = "medium", ...data } = req.body || {};
  const wantLearn = req.user.role === "admin" && data.track === "learn";
  data.track = wantLearn ? "learn" : "uni";
  const uni = wantLearn ? null : (req.user.role === "admin" ? (Number(req.body?.university_id) || currentUniversityId(req.user) || 1) : currentUniversityId(req.user));
  const info = db.prepare("INSERT INTO flashcards (version,difficulty,data_json,university_id,created_by,last_editor_id,last_action,created_at,content_updated_at) VALUES (1,?,?,?, ?,?, 'created', datetime('now'), datetime('now'))")
    .run(difficulty, JSON.stringify(data), uni, req.user.id, req.user.id);
  persistNow();
  res.json({ id: info.lastInsertRowid, version: 1 });
});
r.put("/flashcards/:id", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const row = db.prepare("SELECT * FROM flashcards WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  if (!canManageUniResource(req.user, row)) return res.status(403).json({ error: "wrong_university" });
  db.prepare("INSERT INTO flashcard_versions (flashcard_id,version,data_json) VALUES (?,?,?)")
    .run(row.id, row.version, row.data_json);
  const { difficulty = row.difficulty, ...data } = req.body || {};
  const prevLearn = isLearnContent(row.data_json);
  if (req.user.role !== "admin") data.track = "uni";
  else data.track = (data.track === "learn" || prevLearn) ? "learn" : "uni";
  const newVersion = row.version + 1;
  db.prepare("UPDATE flashcards SET version=?,difficulty=?,data_json=?,updated_at=datetime('now'),content_updated_at=datetime('now'),last_editor_id=?,last_action='edited',revision=COALESCE(revision,1)+1 WHERE id=?")
    .run(newVersion, difficulty, JSON.stringify(data), req.user.id, row.id);
  persistNow();
  res.json({ id: row.id, version: newVersion });
});
r.delete("/flashcards/:id", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const row = db.prepare("SELECT * FROM flashcards WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  if (!canManageUniResource(req.user, row)) return res.status(403).json({ error: "wrong_university" });
  db.prepare("UPDATE flashcards SET active=0 WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

/* ---------------- CSV IMPORT / EXPORT ---------------- */
const CASE_COLS = ["title_fa","title_en","specialty_fa","specialty_en","age","sex","difficulty",
  "chief_fa","chief_en","history_fa","history_en","pmh_fa","pmh_en","meds_fa","meds_en",
  "diagnosis_fa","diagnosis_en","objectives_fa","objectives_en"];
const CARD_COLS = ["title_fa","title_en","category_fa","category_en","difficulty","questionType",
  "answerMode","questionText_fa","questionText_en","correct_fa","correct_en","options_fa","options_en",
  "hints_fa","hints_en"];

// Export cases → CSV
r.get("/cases-export.csv", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  let raw = db.prepare("SELECT * FROM cases WHERE active=1 ORDER BY id").all();
  const uni = tenantFilterFor(req.user);
  if (uni) raw = raw.filter((row) => (row.university_id || 1) === uni);
  if (req.user.role === "teacher" && !isUniversityExpert(req.user)) raw = raw.filter((row) => row.created_by == null || Number(row.created_by) === Number(req.user.id));
  const rows = raw
    .map((row) => { try { const d = JSON.parse(row.data_json); return { ...d, difficulty: row.difficulty }; } catch { return null; } })
    .filter(Boolean)
    .filter((d) => d.track !== "learn");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=cases.csv");
  res.send(toCSV(rows, CASE_COLS));
  } catch (e) {
    res.status(500).json({ error: "cases_export_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

// Import cases from CSV (bulk create)
r.post("/cases-import", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const { csv } = req.body || {};
  if (!csv) return res.status(400).json({ error: "no csv" });
  let uni = (req.user.role === "admin" ? (Number(req.body?.university_id) || currentUniversityId(req.user) || 1) : currentUniversityId(req.user));
  if (req.user.role === "teacher") {
    uni = currentUniversityId(req.user);
    if (!uni) return res.status(400).json({ error: "university_required" });
  }
  let rows;
  try { rows = parseCSV(csv); } catch { return res.status(400).json({ error: "invalid csv" }); }
  const ins = db.prepare("INSERT INTO cases (version,difficulty,checklist_id,data_json,university_id,created_by) VALUES (1,?,1,?,?,?)");
  let count = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      if (!row.title_en && !row.title_fa) continue;
      const { difficulty = "medium", age, ...rest } = row;
      const data = { ...rest, age: +age || 0,
        vitals: { bp: "120/80", hr: "75", rr: "16", temp: "37", spo2: "98%" }, images: [] };
      ins.run(difficulty, JSON.stringify(data), uni, req.user.id);
      count++;
    }
  });
  tx();
  persistNow();
  res.json({ ok: true, imported: count });
});

// Export flashcards → CSV (options as "|"-separated)
r.get("/flashcards-export.csv", authRequired, requireRole("teacher", "admin"), (req, res) => {
  let raw = db.prepare("SELECT * FROM flashcards WHERE active=1 ORDER BY id").all();
  const uni = tenantFilterFor(req.user);
  if (uni) raw = raw.filter((row) => (row.university_id || 1) === uni);
  if (req.user.role === "teacher" && !isUniversityExpert(req.user)) raw = raw.filter((row) => row.created_by == null || Number(row.created_by) === Number(req.user.id));
  const rows = raw
    .filter((row) => { try { return JSON.parse(row.data_json).track !== "learn"; } catch { return true; } })
    .map((row) => {
    let d;
    try { d = JSON.parse(row.data_json); } catch { return null; }
    const correct = (d.options || []).find((o) => o.correct) || {};
    return {
      title_fa: d.title_fa, title_en: d.title_en, category_fa: d.category_fa, category_en: d.category_en,
      difficulty: row.difficulty, questionType: d.questionType || "image", answerMode: d.answerMode || "choice",
      questionText_fa: d.questionText_fa || "", questionText_en: d.questionText_en || "",
      correct_fa: correct.fa || "", correct_en: correct.en || "",
      options_fa: (d.options || []).map((o) => o.fa).join(" | "),
      options_en: (d.options || []).map((o) => o.en).join(" | "),
      hints_fa: (d.hints_fa || []).join(" | "), hints_en: (d.hints_en || []).join(" | "),
    };
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=flashcards.csv");
  res.send(toCSV(rows.filter(Boolean), CARD_COLS));
});

// Import flashcards from CSV
r.post("/flashcards-import", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const { csv } = req.body || {};
  if (!csv) return res.status(400).json({ error: "no csv" });
  let rows;
  try { rows = parseCSV(csv); } catch { return res.status(400).json({ error: "invalid csv" }); }
  let uni = (req.user.role === "admin" ? (Number(req.body?.university_id) || currentUniversityId(req.user) || 1) : currentUniversityId(req.user));
  if (req.user.role === "teacher") {
    uni = currentUniversityId(req.user);
    if (!uni) return res.status(400).json({ error: "university_required" });
  }
  const ins = db.prepare("INSERT INTO flashcards (version,difficulty,data_json,university_id,created_by,last_editor_id,last_action,created_at,content_updated_at) VALUES (1,?,?,?, ?,?, 'created', datetime('now'), datetime('now'))");
  let count = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      if (!row.title_en && !row.title_fa) continue;
      const fa = (row.options_fa || "").split("|").map((s) => s.trim()).filter(Boolean);
      const en = (row.options_en || "").split("|").map((s) => s.trim()).filter(Boolean);
      const n = Math.max(fa.length, en.length);
      const options = [];
      for (let i = 0; i < n; i++) {
        const of = fa[i] || en[i] || "", oe = en[i] || fa[i] || "";
        options.push({ fa: of, en: oe,
          correct: (row.correct_fa && of === row.correct_fa) || (row.correct_en && oe === row.correct_en) });
      }
      if (options.length && !options.some((o) => o.correct)) options[0].correct = true;
      const data = {
        track: "uni",
        title_fa: row.title_fa, title_en: row.title_en,
        category_fa: row.category_fa, category_en: row.category_en,
        questionType: row.questionType || "image", answerMode: row.answerMode || "choice",
        questionText_fa: row.questionText_fa || "", questionText_en: row.questionText_en || "",
        color: "#bcd7f0", imageUrl: "", options,
        hints_fa: (row.hints_fa || "").split("|").map((s) => s.trim()).filter(Boolean),
        hints_en: (row.hints_en || "").split("|").map((s) => s.trim()).filter(Boolean),
      };
      ins.run(row.difficulty || "medium", JSON.stringify(data), uni, req.user.id, req.user.id);
      count++;
    }
  });
  tx();
  persistNow();
  res.json({ ok: true, imported: count });
});

/* ---------------- CUSTOM CATALOGS (teacher/admin) ---------------- */
function catalogRow(id) { return db.prepare("SELECT * FROM catalogs WHERE id=?").get(id); }
function canManageCatalog(user, row) {
  if (!row) return false;
  if (user.role === "admin") return true;
  return user.role === "teacher" && row.owner_id === user.id;
}
r.get("/catalogs", authRequired, requireRole("teacher", "admin"), (req, res) => {
  let rows = db.prepare("SELECT * FROM catalogs ORDER BY id DESC").all();
  if (req.user.role === "teacher") rows = rows.filter((c) => c.owner_id === req.user.id);
  res.json(rows.map((c) => {
    let items = [];
    try { items = JSON.parse(c.items_json || "[]"); } catch { items = []; }
    return { id: c.id, name_fa: c.name_fa, name_en: c.name_en, items, owner_id: c.owner_id || null };
  }));
});
r.post("/catalogs", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const { name_fa, name_en, items = [] } = req.body || {};
  const info = db.prepare("INSERT INTO catalogs (name_fa,name_en,items_json,owner_id) VALUES (?,?,?,?)")
    .run(name_fa, name_en, JSON.stringify(items), req.user.id);
  res.json({ id: info.lastInsertRowid });
});
r.put("/catalogs/:id", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const row = catalogRow(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found", stage: "access" });
  if (!canManageCatalog(req.user, row)) return res.status(403).json({ error: "forbidden", stage: "access" });
  const { name_fa, name_en, items = [] } = req.body || {};
  db.prepare("UPDATE catalogs SET name_fa=?,name_en=?,items_json=? WHERE id=?")
    .run(name_fa, name_en, JSON.stringify(items), req.params.id);
  res.json({ ok: true });
});
r.delete("/catalogs/:id", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const row = catalogRow(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found", stage: "access" });
  if (!canManageCatalog(req.user, row)) return res.status(403).json({ error: "forbidden", stage: "access" });
  db.prepare("DELETE FROM catalogs WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

/* ---------------- CHECKLISTS ---------------- */
function checklistUniversityIds(id) {
  const rows = db.prepare("SELECT university_id, data_json FROM cases WHERE checklist_id=?").all(id);
  const unis = new Set();
  for (const row of rows) {
    if (isLearnContent(row.data_json)) continue;
    unis.add(row.university_id || 1);
  }
  return unis;
}
function checklistUsedByLearn(id) {
  const rows = db.prepare("SELECT data_json FROM cases WHERE checklist_id=?").all(id);
  return rows.some((row) => isLearnContent(row.data_json));
}
function checklistOwnerId(id) {
  return db.prepare("SELECT owner_id FROM checklists WHERE id=?").get(id)?.owner_id || null;
}
function teacherSeesChecklist(user, id) {
  if (user.role === "admin" || user.role === "content_manager") return true;
  if (user.role !== "teacher") return false;
  const unis = checklistUniversityIds(id);
  if (!unis.size) {
    // NULL owner = a SHIPPED system template (seed); every teacher may use it
    // when authoring cases. Only admin can edit/delete those (see
    // teacherManagesChecklist). Teacher-authored checklists carry owner_id.
    const owner = checklistOwnerId(id);
    return owner == null || owner === user.id;
  }
  return unis.has(currentUniversityId(user));
}
function teacherManagesChecklist(user, id) {
  if (user.role === "admin") return true;
  if (user.role !== "teacher") return false;
  const unis = checklistUniversityIds(id);
  if (!unis.size) return checklistOwnerId(id) === user.id;
  const mine = currentUniversityId(user);
  return unis.size === 1 && unis.has(mine);
}
r.get("/checklists", authRequired, requireRole("teacher", "admin", "content_manager"), (req, res) => {
  try {
  let rows = db.prepare("SELECT * FROM checklists ORDER BY id").all();
  if (req.user.role === "teacher" || req.user.role === "content_manager") {
    const uniBy = new Map();
    const learnBy = new Set();
    for (const row of db.prepare("SELECT checklist_id, university_id, data_json FROM cases WHERE checklist_id IS NOT NULL").all()) {
      if (isLearnContent(row.data_json)) { learnBy.add(row.checklist_id); continue; }
      const s = uniBy.get(row.checklist_id) || new Set();
      s.add(row.university_id || 1);
      uniBy.set(row.checklist_id, s);
    }
    if (req.user.role === "teacher") {
      const mine = currentUniversityId(req.user);
      rows = rows.filter((row) => {
        const unis = uniBy.get(row.id);
        if (!unis || !unis.size) {
          const owner = checklistOwnerId(row.id);
          return owner == null || owner === req.user.id;
        }
        return unis.has(mine);
      });
    }
    if (req.user.role === "content_manager") {
      rows = rows.filter((row) => !(uniBy.get(row.id) && uniBy.get(row.id).size) && learnBy.has(row.id));
    }
  }
  res.json(rows.map((row) => {
    let items = [];
    try { items = JSON.parse(row.items_json || "[]"); } catch { items = []; }
    return { id: row.id, name_fa: row.name_fa, name_en: row.name_en, items };
  }));
  } catch (e) {
    res.status(500).json({ error: "checklists_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});
// Scoring sections + the internal-medicine complete-history template (so the
// admin checklist editor can label items by section and one-click insert the
// full internal history form). Deterministic, no cost.
r.get("/checklists-meta", authRequired, requireRole("teacher", "admin", "content_manager"), async (req, res) => {
  try {
  const { SECTIONS, HISTORY_FORMS, buildHistoryItems, buildInternalHistoryItems } = await import("../lib/history-sections.js");
  // forms: [{ key, fa, en, items:[...] }] so the editor can one-click insert any
  // specialty history form; internalHistory kept for backward-compat.
  const forms = HISTORY_FORMS.map((f) => ({ key: f.key, fa: f.fa, en: f.en, items: buildHistoryItems(f.key) }));
  res.json({ sections: SECTIONS, forms, internalHistory: buildInternalHistoryItems() });
  } catch (e) {
    res.status(500).json({ error: "checklists_meta_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});
r.put("/checklists/:id", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const row = db.prepare("SELECT id FROM checklists WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found", stage: "access" });
  if (!teacherManagesChecklist(req.user, req.params.id)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  const { name_fa, name_en, items } = req.body || {};
  db.prepare("UPDATE checklists SET name_fa=?,name_en=?,items_json=? WHERE id=?")
    .run(name_fa, name_en, JSON.stringify(items || []), req.params.id);
  persistNow();
  res.json({ ok: true });
});
r.post("/checklists", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const { name_fa, name_en, items } = req.body || {};
  const info = db.prepare("INSERT INTO checklists (name_fa,name_en,items_json,owner_id) VALUES (?,?,?,?)")
    .run(name_fa || "چک‌لیست جدید", name_en || "New checklist", JSON.stringify(items || []), req.user.id);
  persistNow();
  res.json({ id: info.lastInsertRowid });
});
r.delete("/checklists/:id", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const row = db.prepare("SELECT id FROM checklists WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found", stage: "access" });
  if (!teacherManagesChecklist(req.user, req.params.id)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  const used = db.prepare("SELECT id FROM cases WHERE checklist_id=? LIMIT 1").get(req.params.id);
  if (used) return res.status(409).json({ error: "checklist_in_use", stage: "access", case_id: used.id });
  db.prepare("DELETE FROM checklists WHERE id=?").run(req.params.id);
  persistNow();
  res.json({ ok: true });
});

/* ---------------- USERS ---------------- */

function currentUniversityId(user) {
  if (!user?.id) return null;
  return db.prepare("SELECT university_id FROM users WHERE id=? AND status='active'").get(user.id)?.university_id || null;
}
function studentByNo(sno) {
  const sn = String(sno || "").trim();
  if (!sn) return null;
  return db.prepare("SELECT id, username, student_no, name_fa, name_en, university_id FROM users WHERE (student_no=? OR username=?) AND role='student'").get(sn, sn) || null;
}
function publicExistingStudent(u) { return u ? { id: u.id, username: u.username, student_no: u.student_no, name_fa: u.name_fa, name_en: u.name_en, university_id: u.university_id } : null; }

r.get("/users", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  let rows = db.prepare("SELECT id,username,student_no,name_fa,name_en,role,status,university_id FROM users ORDER BY id").all();
  if (req.user.role === "teacher") {
    const uni = currentUniversityId(req.user);
    rows = rows.filter((u) => u.university_id === uni && (u.role === "student" || u.role === "teacher"));
  }
  // Optional ?role= filter (used by the student search box in exams/classes).
  if (req.query.role) rows = rows.filter((u) => u.role === req.query.role);
  // attach assigned case ids for students (one query, not N+1)
  const asgBy = new Map();
  for (const a of db.prepare("SELECT user_id, case_id FROM exam_assignments WHERE active=1").all()) {
    const arr = asgBy.get(a.user_id);
    if (arr) arr.push(a.case_id);
    else asgBy.set(a.user_id, [a.case_id]);
  }
  res.json(rows.map((u) => u.role === "student"
    ? { ...u, caseIds: asgBy.get(u.id) || [] }
    : u));
  } catch (e) {
    res.status(500).json({ error: "users_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---------------- EXAM ASSIGNMENTS ---------------- */
// List assignments for one student
r.get("/assignments/:userId", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  const target = db.prepare("SELECT id, role, university_id FROM users WHERE id=?").get(req.params.userId);
  if (!target) return res.status(404).json({ error: "not found", stage: "access" });
  if (!canManageStudentAccount(req.user, target)) return res.status(403).json({ error: "wrong_university", stage: "access" });
  const rows = db.prepare(
    `SELECT ea.*, c.data_json FROM exam_assignments ea
       LEFT JOIN cases c ON c.id = ea.case_id
     WHERE ea.user_id=? AND ea.active=1`
  ).all(req.params.userId);
  res.json(rows.map((a) => {
    let cd = {};
    try { if (a.data_json) cd = JSON.parse(a.data_json); } catch { cd = {}; }
    return { id: a.id, case_id: a.case_id, max_attempts: a.max_attempts,
             title_fa: cd.title_fa, title_en: cd.title_en };
  }));
  } catch (e) {
    res.status(500).json({ error: "assignments_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});
// Replace the full set of a student's assignments (case IDs)
r.put("/assignments/:userId", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const { caseIds = [], maxAttempts = 1 } = req.body || {};
  const uid = req.params.userId;
  const target = db.prepare("SELECT id, role, university_id FROM users WHERE id=?").get(uid);
  if (!target) return res.status(404).json({ error: "not found", stage: "access" });
  if (!canManageStudentAccount(req.user, target)) return res.status(403).json({ error: "wrong_university", stage: "access" });
  const allowed = caseIdsForUniversity(caseIds, target.university_id);
  const tx = db.transaction(() => {
    db.prepare("UPDATE exam_assignments SET active=0 WHERE user_id=?").run(uid);
    const up = db.prepare(
      `INSERT INTO exam_assignments (user_id,case_id,assigned_by,max_attempts,active)
       VALUES (?,?,?,?,1)
       ON CONFLICT(user_id,case_id) DO UPDATE SET active=1, max_attempts=excluded.max_attempts`
    );
    for (const cid of allowed) up.run(uid, cid, req.user.id, maxAttempts);
  });
  tx();
  persistNow();
  res.json({ ok: true, added: allowed.length, skipped: (Array.isArray(caseIds) ? caseIds.length : 0) - allowed.length });
});
// Create a user. For students, the student number is the username.
// Optionally assign the new student to one or more exams (case IDs) in one step.
r.post("/users", authRequired, requireRole("teacher", "admin"), async (req, res) => {
  const { studentNo, username, password, name_fa, name_en, role = "student", caseIds = [], maxAttempts = 1 } = req.body || {};
  if (req.user.role === "teacher" && role !== "student") return res.status(403).json({ error: "teachers can only add students" });
  if (role === "learner") return res.status(403).json({ error: "role_track_locked", reason: "role_track_locked", stage: "access" });
  const uname = role === "student" ? String(studentNo || username || "").trim() : String(username || "").trim();
  if (!uname) return res.status(400).json({ error: "username/student number required" });
  if (role === "student") {
    const exists = studentByNo(uname);
    if (exists) return res.status(409).json({ error: "student_no_exists", message_fa: "این شماره دانشجویی قبلاً در سامانه وجود دارد.", existing: publicExistingStudent(exists) });
  }
  let university_id = req.body?.university_id ? Number(req.body.university_id) : null;
  if (req.user.role === "teacher") university_id = currentUniversityId(req.user);
  if ((role === "student" || role === "teacher") && !university_id) return res.status(400).json({ error: "university_required", message_fa: "برای استاد و دانشجو انتخاب دانشگاه الزامی است." });
  const pwd = password && String(password).trim() ? password : uname; // default password = student number
  const pwdHash = await hashPassword(pwd);
  const tx = db.transaction(() => {
    const info = db.prepare(
      "INSERT INTO users (username,password_hash,name_fa,name_en,student_no,role,status,university_id) VALUES (?,?,?,?,?,?, 'active',?)"
    ).run(uname, pwdHash, name_fa, name_en, role === "student" ? uname : null, role, university_id);
    const uid = info.lastInsertRowid;
    if (role === "student" && Array.isArray(caseIds)) {
      const ins = db.prepare(
        "INSERT OR IGNORE INTO exam_assignments (user_id,case_id,assigned_by,max_attempts) VALUES (?,?,?,?)"
      );
      for (const cid of caseIdsForUniversity(caseIds, university_id)) ins.run(uid, cid, req.user.id, maxAttempts);
    }
    return uid;
  });
  try {
    const id = tx();
    res.json({ id, username: uname, defaultPassword: pwd });
  } catch (e) { res.status(400).json({ error: "username / student number already exists" }); }
});

// ── CSV template for bulk import (downloadable) ──
r.get("/users/import/template.csv", authRequired, requireRole("teacher","admin"), (req,res)=>{
  const lang = req.query.lang==="en" ? "en" : "fa";
  const headerFa = "نام,نام خانوادگی,شماره دانشجویی,ایمیل (اختیاری),کد دانشگاه (اختیاری),کد کلاس (اختیاری)";
  const headerEn = "name,family,student_no,email,university_code,class_code";
  const header = lang==="en" ? headerEn : headerFa;
  const sample = [
    header,
    lang==="en" ? "Ali,Rezaei,40012345,ali@example.com,TUMS,CLS-101" : "علی,رضایی,40012345,ali@example.com,TUMS,CLS-101",
    lang==="en" ? "Maryam,Karimi,40067890,,SBMU," : "مریم,کریمی,40067890,,SBMU,",
    lang==="en" ? "Reza,Ahmadi,40011223,reza@example.com,," : "رضا,احمدی,40011223,reza@example.com,,",
  ].join("\n");
  res.setHeader("Content-Type","text/csv; charset=utf-8");
  res.setHeader("Content-Disposition","attachment; filename=\"students-template.csv\"");
  res.send("\uFEFF"+sample);
});

// Bulk-import students from a CSV/pasted text.
// Robust parser: BOM-aware, quoted-field aware, delimiter auto-detected (comma, semicolon, tab, Persian comma)،
 // header optional and normalized. Columns: نام / name, نام خانوادگی / family, شماره دانشجویی / student_no (الزامی), ایمیل / email, کد دانشگاه / university_code, کد کلاس / class_code.
// Header row optional and auto-detected by column names. For each student: username=student_no, password=student_no.
// Optional: university_code per row (admin only; teacher rows forced to teacher's university), class_code per row or class_id query/body to auto-enroll.
r.post("/users/import", authRequired, requireRole("teacher", "admin"), (req, res) => {
  let { csv = "", university_id, class_id, class_code, university_code } = req.body || {};
  if (!class_id && req.query.class_id) class_id = Number(req.query.class_id);
  if (!class_code && req.query.class_code) class_code = String(req.query.class_code);
  if (!university_code && req.query.university_code) university_code = String(req.query.university_code);
  if (req.user.role === "teacher") {
    const me = db.prepare("SELECT university_id FROM users WHERE id=?").get(req.user.id);
    university_id = me?.university_id || university_id || null;
  } else if (university_code) {
    const uByCode = db.prepare("SELECT id FROM universities WHERE code=?").get(String(university_code).trim().toUpperCase());
    if (uByCode) university_id = uByCode.id;
  }
  let rawCsv = String(csv || "").replace(/^\uFEFF/, "");
  if (!rawCsv.trim()) return res.status(400).json({ error: "empty", message_fa: "فایل خالی است" });
  // --- robust CSV split: detect delimiter, respect quotes ---
  const rawLines = rawCsv.split(/\r?\n/);
  const nonEmptyLines = rawLines.map(l=>l.trimEnd()).filter(l=>l.trim()!=="");
  if (!nonEmptyLines.length) return res.status(400).json({ error: "empty" });
  function detectDelim(sample){
    const cands = [",", ";", "\t", "،"];
    let best=",", bestCount=-1;
    for(const d of cands){
      let cnt=0, inQ=false;
      for(let i=0;i<sample.length;i++){
        const ch=sample[i];
        if(ch=='"'){ if(sample[i+1]=='"'){ i++; } else inQ=!inQ; }
        else if(!inQ && ch===d) cnt++;
      }
      if(cnt>bestCount){ bestCount=cnt; best=d; }
    }
    return best;
  }
  const delim = detectDelim(nonEmptyLines.slice(0,5).join("\n"));
  function splitLine(line){
    const out=[]; let cur="", inQ=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i], nxt=line[i+1];
      if(inQ){
        if(ch=='"' && nxt=='"'){ cur+='"'; i++; }
        else if(ch=='"'){ inQ=false; }
        else cur+=ch;
      } else {
        if(ch=='"'){ inQ=true; }
        else if(ch===delim){ out.push(cur); cur=""; }
        else cur+=ch;
      }
    }
    out.push(cur);
    return out.map(s=>String(s).trim());
  }
  // Normalize header token: remove BOM/zero-width, lower, remove parenthetical, collapse spaces
  function normHeader(h){
    let s=String(h||"").replace(/^\uFEFF/, "").trim().toLowerCase();
    s=s.replace(/[\u200c\u200f\u202a-\u202e]/g, "");
    s=s.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").trim();
    s=s.replace(/\s+/g, " ").replace(/[\/\-_\.]+/g, " ").trim();
    return s;
  }
  const firstColsRaw = splitLine(nonEmptyLines[0]);
  const firstNorm = firstColsRaw.map(normHeader);
  // header detection: if any token looks like a column name, treat as header
  const headerTests = [
    /(^|\s)(name|first|given)(\s|$)/, /(نام)(\s|$)/,
    /(family|last|surname|خانوادگ)/,
    /(student|شماره|student\s*no|شماره\s*دانش)/,
    /(email|ایمیل)/,
    /(university|دانشگاه)/,
    /(class|کلاس)/
  ];
  const headerScore = firstNorm.filter(h=> headerTests.some(re=>re.test(h))).length;
  const hasHeader = headerScore>=1 && firstNorm.some(h=> headerTests.some(re=>re.test(h)));
  let colMap=null;
  let headerRowIdx=-1;
  if(hasHeader){
    headerRowIdx=0;
    colMap={};
    firstNorm.forEach((h,i)=>{
      if(/(student|شماره|student\s*no|شماره\s*دانش)/.test(h) && colMap.sno==null) colMap.sno=i;
      else if(/(email|ایمیل)/.test(h) && colMap.email==null) colMap.email=i;
      else if(/(university.*code|کد\s*دانشگاه)/.test(h) && colMap.u_code==null) colMap.u_code=i;
      else if(/(class.*code|کد\s*کلاس)/.test(h) && colMap.c_code==null) colMap.c_code=i;
      else if(/(family|last|surname|خانوادگ)/.test(h) && colMap.family==null) colMap.family=i;
      else if(/(^name$|نام$|first|given)/.test(h) && colMap.name==null) {
        // careful: "نام خانوادگی" already captured as family, don't reassign name
        if(!/(خانوادگ|family|last)/.test(h)) colMap.name=i;
      }
    });
    // also support English header "name,family" vs Persian "نام,نام خانوادگی": if family not found but there are two name-like cols, assume second is family
    if(colMap.family==null){
      const nameIdxs = firstNorm.map((h,i)=> /(name|نام)/.test(h) ? i : -1).filter(i=>i>=0);
      if(nameIdxs.length>=2){ colMap.name = nameIdxs[0]; colMap.family = nameIdxs[1]; }
    }
    if(colMap.sno==null){
      // last resort: assume last column is sno
      colMap.sno = firstColsRaw.length-1;
    }
  }
  const dataLinesRaw = hasHeader ? nonEmptyLines.slice(1) : nonEmptyLines;
  // Resolve optional global class to enroll into (admin may choose class before import)
  let globalClassId = null; let globalClassUni=null;
  if (class_id) {
    const c = db.prepare("SELECT id, university_id, code FROM classes WHERE id=?").get(Number(class_id));
    if (c) {
      if (req.user.role==="teacher") {
        const me = db.prepare("SELECT university_id FROM users WHERE id=?").get(req.user.id);
        if (c.university_id && me?.university_id && c.university_id!==me.university_id) {
        } else { globalClassId = c.id; globalClassUni=c.university_id; }
      } else { globalClassId = c.id; globalClassUni=c.university_id; }
    }
  } else if (class_code) {
    const c = db.prepare("SELECT id, university_id FROM classes WHERE code=?").get(String(class_code).trim());
    if (c) { globalClassId = c.id; globalClassUni=c.university_id; }
  }
  const insUser = db.prepare(
    "INSERT INTO users (username,password_hash,name_fa,name_en,student_no,email,role,status,university_id) VALUES (?,?,?,?,?,?, 'student','active', ?)"
  );
  const findByNo = db.prepare("SELECT id, university_id, name_fa FROM users WHERE student_no=? OR username=?");
  const insMember = db.prepare("INSERT OR IGNORE INTO class_members (class_id,user_id) VALUES (?,?)");
  const updUni = db.prepare("UPDATE users SET university_id=? WHERE id=? AND (university_id IS NULL OR university_id='')");
  let created = 0, skipped = 0;
  const failures = []; // detailed per-row failures
  const duplicates = []; // for compatibility
  const enrolled = [];
  const seenInFile = new Map(); // sno(lower) -> line
  // student_no validation: allow 3-20 chars, must contain at least 2 alphanumerics/digits
  function isValidSno(s){
    s=String(s||"").trim();
    if(!s) return false;
    if(s.length<2 || s.length>30) return false;
    // must not be just header words
    if(/^(نام|family|student|شماره|ایمیل|email|university|class|کد)/i.test(s)) return false;
    // allow digits, letters, .,_,-, but at least 2 chars that are alnum
    if(!/[A-Za-z0-9\u0600-\u06FF]{2}/.test(s)) return false;
    // Persian header words like "شماره دانشجویی" should be rejected as valid sno
    if(/شماره|دانشجو/i.test(s) && s.length>15) return false;
    return true;
  }
  const tx = db.transaction(() => {
    dataLinesRaw.forEach((line, idx) => {
      const lineNo = idx + 1 + (hasHeader ? 1 : 0) + 1; // 1-based, header is line 1 if present? Actually rawLines 1-based
      // For accurate lineNo, use index in nonEmptyLines
      const actualLineNo = hasHeader ? idx+2 : idx+1;
      const cols = splitLine(line);
      // If line was empty after split (all empty), skip silently
      if(!cols.some(c=>String(c).trim()!=="")) { return; }
      let name = "", family = "", sno = "", email="", rowUcode="", rowCcode="";
      if (colMap) {
        name = colMap.name!=null ? (cols[colMap.name]??"") : "";
        family = colMap.family!=null ? (cols[colMap.family]??"") : "";
        sno = colMap.sno!=null ? (cols[colMap.sno]??"") : (cols[cols.length-1]??"");
        email = colMap.email!=null ? (cols[colMap.email]??"") : "";
        rowUcode = colMap.u_code!=null ? (cols[colMap.u_code]??"") : "";
        rowCcode = colMap.c_code!=null ? (cols[colMap.c_code]??"") : "";
        // If cols shorter than header (e.g., 3-col data with 6-col header), fallback positions may be empty; try positional fallback for sno
        if(!String(sno||"").trim() && cols.length>=1){
          // guess: last non-empty col that looks like sno
          for(let k=cols.length-1;k>=0;k--){
            const cand=String(cols[k]||"").trim();
            if(cand && /[0-9]/.test(cand) && !/(نام|family|ایمیل|@)/.test(cand)){ sno=cand; break; }
          }
          if(!String(sno||"").trim()) sno = cols[cols.length-1]??"";
        }
      } else {
        if (cols.length >= 3) { [name, family, sno] = cols; if(cols[3]) email=cols[3]; if(cols[4]) rowUcode=cols[4]; if(cols[5]) rowCcode=cols[5]; }
        else if (cols.length === 2) { [name, sno] = cols; }
        else { sno = cols[0] ?? ""; }
      }
      sno = String(sno ?? "").trim().replace(/\u200c/g, "");
      name = String(name ?? "").trim();
      family = String(family ?? "").trim();
      email = String(email ?? "").trim() || null;
      rowUcode = String(rowUcode ?? "").trim();
      rowCcode = String(rowCcode ?? "").trim();
      const raw = cols.join(delim);
      if (!sno) {
        failures.push({ line: actualLineNo, sno: "", name: [name,family].filter(Boolean).join(" "), reason_fa: "شماره دانشجویی خالی است", reason_en: "missing student number", raw });
        skipped++; return;
      }
      sno = sno.replace(/\s+/g, "");
      if (!isValidSno(sno)) {
        failures.push({ line: actualLineNo, sno, name: [name,family].filter(Boolean).join(" "), reason_fa: `شماره «${sno}» نامعتبر است (باید ۳-۳۰ نویسه شامل حروف/عدد باشد)`, reason_en: `invalid student number: ${sno}`, raw });
        skipped++; return;
      }
      const lower = sno.toLowerCase();
      if (seenInFile.has(lower)) {
        const prevLine = seenInFile.get(lower);
        failures.push({ line: actualLineNo, sno, name: [name,family].filter(Boolean).join(" "), reason_fa: `تکراری در همین فایل (سطر ${prevLine} هم همین شماره را دارد)`, reason_en: `duplicate in file (also line ${prevLine})`, raw });
        duplicates.push({ student_no: sno, line: actualLineNo, reason: "duplicate_in_file" });
        skipped++; return;
      }
      seenInFile.set(lower, actualLineNo);
      const existing = findByNo.get(sno, sno);
      let uid = existing?.id || null;
      let rowUniId = university_id || null;
      if (req.user.role!=="teacher" && rowUcode) {
        const uByCode = db.prepare("SELECT id FROM universities WHERE code=?").get(rowUcode.toUpperCase());
        if (uByCode) rowUniId = uByCode.id;
        else {
          failures.push({ line: actualLineNo, sno, name: [name,family].filter(Boolean).join(" "), reason_fa: `کد دانشگاه «${rowUcode}» یافت نشد — از دانشگاه انتخابی استفاده شد`, reason_en: `university_code ${rowUcode} not found`, raw, warning:true });
          // not skipping, just warning
        }
      }
      // licence cap check before insert
      if (!existing && rowUniId) {
        const hit = checkStudentLimit(rowUniId, 1);
        if (hit) {
          failures.push({ line: actualLineNo, sno, name: [name,family].filter(Boolean).join(" "), reason_fa: `سقف دانشجویان دانشگاه پر است (${hit.current}/${hit.max})`, reason_en: `university student limit reached`, raw });
          skipped++; return;
        }
      }
      const fullName = [name, family].filter(Boolean).join(" ").trim() || sno;
      if (existing) {
        duplicates.push({ student_no: sno, id: existing.id, line: actualLineNo });
        // existing user: try to heal missing university and enroll
        if (existing.university_id==null && rowUniId) {
          try{ updUni.run(rowUniId, existing.id); }catch{}
        } else if (existing.university_id==null && globalClassUni) {
          try{ updUni.run(globalClassUni, existing.id); }catch{}
        }
      } else {
        // enforce university required for student
        let finalUni = rowUniId;
        if(!finalUni && globalClassUni) finalUni = globalClassUni;
        // if still null and teacher, it's already teacher's uni; if admin and no uni, keep null but warn
        try {
          const info = insUser.run(sno, hashPasswordSync(sno), fullName, fullName, sno, email, finalUni);
          uid = info.lastInsertRowid;
          created++;
        } catch (e) {
          const msg = String(e.message||"");
          if(/UNIQUE|unique/i.test(msg)){
            failures.push({ line: actualLineNo, sno, name: fullName, reason_fa: "شماره تکراری در سامانه", reason_en: "duplicate in system", raw });
            duplicates.push({ student_no: sno, line: actualLineNo });
          } else {
            failures.push({ line: actualLineNo, sno, name: fullName, reason_fa: e.message, reason_en: e.message, raw });
          }
          skipped++; return;
        }
      }
      // auto-enroll to class (global or per-row) + heal university if needed
      let targetClassId = globalClassId; let targetClassUni = globalClassUni;
      if (!targetClassId && rowCcode) {
        const c = db.prepare("SELECT id, university_id FROM classes WHERE code=?").get(rowCcode.trim());
        if (c) { targetClassId = c.id; targetClassUni=c.university_id; }
        else {
          failures.push({ line: actualLineNo, sno, name: fullName, reason_fa: `کد کلاس «${rowCcode}» یافت نشد — عضویت انجام نشد`, reason_en: `class_code ${rowCcode} not found`, raw, warning:true });
        }
      }
      if (targetClassId && uid) {
        // heal university if user has none
        const curUni = db.prepare("SELECT university_id FROM users WHERE id=?").get(uid)?.university_id;
        if((curUni==null || curUni==="") && targetClassUni){
          try{ updUni.run(targetClassUni, uid); }catch{}
        }
        // check same-university before enrol
        const curUni2 = db.prepare("SELECT university_id FROM users WHERE id=?").get(uid)?.university_id;
        const classRow = db.prepare("SELECT university_id FROM classes WHERE id=?").get(targetClassId);
        if(classRow && curUni2!=null && classRow.university_id!=null && curUni2!==classRow.university_id){
          failures.push({ line: actualLineNo, sno, name: fullName, reason_fa: `دانشگاه دانشجو (${curUni2}) با دانشگاه کلاس متفاوت است — افزوده نشد`, reason_en: `wrong university for class`, raw, warning:true });
        } else {
          try { insMember.run(targetClassId, uid); enrolled.push({ student_no: sno, class_id: targetClassId, line: actualLineNo }); } catch {}
        }
      }
      if (existing) skipped++;
    });
  });
  try { tx(); } catch (e) { return res.status(400).json({ error: e.message, message_fa: String(e.message).slice(0,200) }); }
  // Build warnings vs errors separation
  const warnings = failures.filter(f=>f.warning).map(f=> `${t_line(f.line- (hasHeader?1:0), hasHeader)}: ${f.reason_fa}`);
  const realFailures = failures.filter(f=>!f.warning);
  const errors = realFailures.map(f=> `${t_line(f.line- (hasHeader?1:0), hasHeader)}: ${f.sno||""} — ${f.reason_fa}`);
  res.json({ created, skipped: realFailures.length + duplicates.filter(d=>d.line).length, total: dataLinesRaw.length, duplicates, enrolled: enrolled.length, failures: realFailures, warnings, errors: errors.slice(0,50), hasHeader, delim });
});
function t_line(i, hasHeader) { return `line ${i + 1 + (hasHeader ? 1 : 0)}`; }
function req_no_sno() { return "missing student number"; }

// Reset a user's password (admin/teacher)
r.put("/users/:id/password", authRequired, requireRole("teacher", "admin"), async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "password required" });
  const target = db.prepare("SELECT id, role, university_id FROM users WHERE id=?").get(req.params.id);
  if (!target) return res.status(404).json({ error: "not found", stage: "access" });
  if (!canManageStudentAccount(req.user, target)) return res.status(403).json({ error: "wrong_university", stage: "access" });
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(await hashPassword(String(password)), req.params.id);
  persistNow();
  res.json({ ok: true });
});
r.put("/users/:id/status", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const target = db.prepare("SELECT id, role, university_id FROM users WHERE id=?").get(req.params.id);
  if (!target) return res.status(404).json({ error: "not found", stage: "access" });
  if (!canManageStudentAccount(req.user, target)) return res.status(403).json({ error: "wrong_university", stage: "access" });
  // Only the two account states the login check understands are accepted; an
  // empty/unknown status used to hit the NOT NULL constraint (HTTP 500).
  const status = req.body?.status === "active" ? "active" : req.body?.status === "inactive" ? "inactive" : null;
  if (!status) return res.status(400).json({ error: "invalid_status", stage: "access" });
  if (target.role === "admin" && target.id === req.user.id) return res.status(400).json({ error: "cannot ban yourself" });
  db.prepare("UPDATE users SET status=? WHERE id=?").run(status, target.id);
  persistNow();
  res.json({ ok: true });
});

/* ---------------- PROMPTS (admin only) ---------------- */
r.get("/prompts", authRequired, requireRole("admin"), (req, res) => {
  try {
  const rows = db.prepare("SELECT * FROM prompts").all();
  const out = {}; rows.forEach((p) => (out[p.key] = p.value));
  res.json(out);
  } catch (e) {
    res.status(500).json({ error: "prompts_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});
r.put("/prompts", authRequired, requireRole("admin"), (req, res) => {
  try {
  const body = req.body || {};
  const keys = Object.keys(body).filter((k) => k !== "__err");
  if (!keys.length) return res.status(400).json({ error: "prompts_required", stage: "boot" });
  const up = db.prepare("INSERT INTO prompts (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  for (const k of keys) up.run(k, String(body[k] ?? ""));
  persistNow();
  res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "prompts_save_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---------------- SETTINGS ---------------- */
const settingMemo = new Map();
const SETTING_MISS = Symbol("miss");
export function getSetting(key, fallback) {
  if (settingMemo.has(key)) {
    const v = settingMemo.get(key);
    return v === SETTING_MISS ? fallback : v;
  }
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key);
  if (!row) { settingMemo.set(key, SETTING_MISS); return fallback; }
  try {
    const parsed = JSON.parse(row.value);
    settingMemo.set(key, parsed);
    return parsed;
  } catch { settingMemo.set(key, SETTING_MISS); return fallback; }
}
export function setSetting(key, obj) {
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(key, JSON.stringify(obj));
  settingMemo.set(key, obj);
  persistNow();
  return obj;
}
// keys that hold provider/API-key config → admin-only (never leak the key)
const ADMIN_ONLY_SETTINGS = new Set(["ai", "blog_image_ai"]);
function canReadSetting(role, key) {
  if (role === "admin") return true;
  if (ADMIN_ONLY_SETTINGS.has(key)) return false;
  if (key === "vp_grading") return role === "teacher";
  if (key === "exam") return role === "teacher" || role === "student" || role === "content_manager";
  return false;
}
r.get("/settings/:key", authRequired, (req, res) => {
  try {
  const key = req.params.key;
  if (!canReadSetting(req.user.role, key)) {
    const err = ADMIN_ONLY_SETTINGS.has(key) ? "admin only" : "forbidden";
    return res.status(403).json({ error: err, stage: "boot" });
  }
  if (key === "vp_grading") {
    return res.json(normalizeRubric(getSetting("vp_grading", null)));
  }
  if (key === "ai") {
    const raw = getSetting("ai", {});
    return res.json({ ...resolveAiConfig({ ...raw, routingEnabled: false }), ...routingSettings(raw) });
  }
  const s = getSetting(key, {});
  res.json(s);
  } catch (e) {
    res.status(500).json({ error: "settings_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});
r.put("/settings/:key", authRequired, (req, res) => {
  try {
  const key = req.params.key;
  if (ADMIN_ONLY_SETTINGS.has(key)) {
    // AI / image-provider configuration: admin only
    if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  } else {
    // other settings (exam, etc.): teacher or admin
    if (!["teacher", "admin"].includes(req.user.role)) return res.status(403).json({ error: "forbidden" });
  }
  let body = key === "vp_grading" ? normalizeRubric(req.body || {}) : (req.body || {});
  if (key === "ai") {
    const prev = getSetting("ai", {}) || {};
    const incoming = body && typeof body === "object" ? body : {};
    const keepKey = !incoming.clearApiKey && !String(incoming.apiKey || "").trim();
    body = {
      ...routingSettings(incoming, prev),
      provider: String(incoming.provider ?? prev.provider ?? "").trim(),
      model: String(incoming.model ?? prev.model ?? "").trim(),
      apiKey: keepKey ? String(prev.apiKey || "").trim() : String(incoming.apiKey || "").trim(),
      baseUrl: String(incoming.baseUrl ?? prev.baseUrl ?? "").trim(),
      connected: false, // A saved edit is not a successful connection test.
    };
  }
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(key, JSON.stringify(body));
  settingMemo.set(key, body);
  persistNow();
  res.json({ ok: true, ...(key === "vp_grading" ? body : {}) });
  } catch (e) {
    res.status(String(e.message).startsWith("AI routing:") ? 400 : 500).json({ error: "settings_save_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---------------- VP ORDER CATALOG (labs + imaging) ----------------
   Students pick from these options when ordering; teachers pick the same
   list when attaching results to a case. Admin/teacher can add/remove. */
function readOrderCatalog() {
  const labs = cleanOrderList(getSetting("order_catalog_lab", null), DEFAULT_LAB_TESTS);
  const imaging = cleanOrderList(getSetting("order_catalog_imaging", null), DEFAULT_IMAGING);
  const paraclinic = cleanOrderList(getSetting("order_catalog_paraclinic", null), DEFAULT_PARACLINIC);
  return { labs, imaging, paraclinic };
}
r.get("/order-catalog", authRequired, (req, res) => {
  try {
  const role = req.user.role;
  if (!["student", "teacher", "admin", "learner", "content_manager"].includes(role)) {
    return res.status(403).json({ error: "forbidden", stage: "order" });
  }
  res.json(readOrderCatalog());
  } catch (e) { res.status(500).json({ error: "order_catalog_failed", stage: "boot", message: String(e.message || e).slice(0, 200) }); }
});
r.put("/order-catalog", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  const labs = cleanOrderList(req.body?.labs, []);
  const imaging = cleanOrderList(req.body?.imaging, []);
  if (!labs.length) return res.status(400).json({ error: "labs_required" });
  if (!imaging.length) return res.status(400).json({ error: "imaging_required" });
  const paraclinic = cleanOrderList(req.body?.paraclinic, DEFAULT_PARACLINIC);
  setSetting("order_catalog_lab", labs);
  setSetting("order_catalog_imaging", imaging);
  setSetting("order_catalog_paraclinic", paraclinic);
  res.json({ ok: true, labs, imaging, paraclinic });
  } catch (e) {
    res.status(500).json({ error: "order_catalog_save_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

export default r;
