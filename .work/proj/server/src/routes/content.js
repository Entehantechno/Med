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
import { normalizeRubric } from "../lib/grading-rubric.js";
import { resolveAiConfig } from "../lib/ai-engine.js";
import { DEFAULT_LAB_TESTS, DEFAULT_IMAGING, DEFAULT_PARACLINIC, cleanOrderList } from "../data/order-catalog-defaults.js";
import { studentSafeFlashcard, gradeFlashcard } from "../lib/flashcard-grade.js";
import { studentMaySeeFlashcard, studentFlashcardAccess, caseInLiveExam } from "../lib/live-exam-content.js";
import { sqlInList } from "../lib/http-cache.js";
import { isLearnContent, caseIsLearn } from "../lib/content-track.js";
import { checkStudentLimit } from "../lib/orglimits.js";

const r = Router();
const parse = (row, extra = {}) => ({ ...JSON.parse(row.data_json), id: row.id, version: row.version, difficulty: row.difficulty, university_id: row.university_id || null, ...extra });
function tenantFilterFor(user) {
  if (user.role === "teacher" || user.role === "student") return currentUniversityId(user) || -1;
  return null;
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
function canManageUniResource(user, row) {
  if (isLearnContent(row?.data_json)) return user.role === "admin";
  return user.role === "admin" || (user.role === "teacher" && (row.university_id || 1) === currentUniversityId(user));
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
      WHERE cc.case_id=? AND m.user_id=? AND c.active=1 LIMIT 1`
  ).get(cid, user.id);
  if (viaClass) return true;
  // (3) case belongs to a scheduled exam the student is a participant of.
  //     Exam cases are stored as a JSON array column, so scan the participant's
  //     exams and check their case_ids.
  const examRows = db.prepare(
    `SELECT e.case_ids, e.starts_at, e.ends_at FROM exams e
       JOIN exam_participants p ON p.exam_id = e.id
      WHERE p.user_id=? AND e.active=1`
  ).all(user.id);
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
  let list = [];
  for (const row of rows) {
    try { list.push(parse(row, { checklist_id: row.checklist_id })); }
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
    try { full = parse(row, { checklist_id: row.checklist_id }); }
    catch { return res.status(404).json({ error: "not found", stage: "case" }); }
    res.json((req.user.role === "student" || req.user.role === "learner") ? studentSafeCase(full) : full);
  } catch (e) {
    res.status(500).json({ error: "case_load_failed", stage: "case", message: String(e.message || e).slice(0, 200) });
  }
});
r.post("/cases", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const { difficulty = "medium", checklist_id = 1, ...data } = req.body || {};
  const wantLearn = req.user.role === "admin" && data.track === "learn";
  data.track = wantLearn ? "learn" : "university";
  const uni = wantLearn ? null : (currentUniversityId(req.user) || Number(req.body?.university_id || 0) || 1);
  const info = db.prepare(
    "INSERT INTO cases (version,difficulty,checklist_id,data_json,university_id) VALUES (1,?,?,?,?)"
  ).run(difficulty, checklist_id, JSON.stringify(data), uni);
  res.json({ id: info.lastInsertRowid, version: 1, track: data.track });
});
r.put("/cases/:id", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const row = db.prepare("SELECT * FROM cases WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  if (!canManageUniResource(req.user, row)) return res.status(403).json({ error: "wrong_university" });
  // archive current version (versioning)
  db.prepare("INSERT INTO case_versions (case_id,version,data_json) VALUES (?,?,?)")
    .run(row.id, row.version, row.data_json);
  const { difficulty = row.difficulty, checklist_id = row.checklist_id, ...data } = req.body || {};
  const prevLearn = isLearnContent(row.data_json);
  if (req.user.role !== "admin") data.track = "university";
  else data.track = (data.track === "learn" || prevLearn) ? "learn" : "university";
  const newVersion = row.version + 1;
  db.prepare("UPDATE cases SET version=?,difficulty=?,checklist_id=?,data_json=?,updated_at=datetime('now') WHERE id=?")
    .run(newVersion, difficulty, checklist_id, JSON.stringify(data), row.id);
  res.json({ id: row.id, version: newVersion });
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
    }
    res.json(gradeFlashcard(full, req.body || {}, { allowLegacy }));
  } catch (e) {
    res.status(500).json({ error: "flashcard_check_failed", stage: "evaluate", message: String(e.message || e).slice(0, 200) });
  }
});
r.get("/flashcards/:id", authRequired, requireRole("teacher", "admin", "content_manager"), (req, res) => {
  const row = db.prepare("SELECT * FROM flashcards WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found", stage: "fetch" });
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
  const uni = wantLearn ? null : (currentUniversityId(req.user) || Number(req.body?.university_id || 0) || 1);
  const info = db.prepare("INSERT INTO flashcards (version,difficulty,data_json,university_id) VALUES (1,?,?,?)")
    .run(difficulty, JSON.stringify(data), uni);
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
  db.prepare("UPDATE flashcards SET version=?,difficulty=?,data_json=?,updated_at=datetime('now') WHERE id=?")
    .run(newVersion, difficulty, JSON.stringify(data), row.id);
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
  let uni = currentUniversityId(req.user) || Number(req.body?.university_id || 0) || 1;
  if (req.user.role === "teacher") {
    uni = currentUniversityId(req.user);
    if (!uni) return res.status(400).json({ error: "university_required" });
  }
  let rows;
  try { rows = parseCSV(csv); } catch { return res.status(400).json({ error: "invalid csv" }); }
  const ins = db.prepare("INSERT INTO cases (version,difficulty,checklist_id,data_json,university_id) VALUES (1,?,1,?,?)");
  let count = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      if (!row.title_en && !row.title_fa) continue;
      const { difficulty = "medium", age, ...rest } = row;
      const data = { ...rest, age: +age || 0,
        vitals: { bp: "120/80", hr: "75", rr: "16", temp: "37", spo2: "98%" }, images: [] };
      ins.run(difficulty, JSON.stringify(data), uni);
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
  let uni = currentUniversityId(req.user) || Number(req.body?.university_id || 0) || 1;
  if (req.user.role === "teacher") {
    uni = currentUniversityId(req.user);
    if (!uni) return res.status(400).json({ error: "university_required" });
  }
  const ins = db.prepare("INSERT INTO flashcards (version,difficulty,data_json,university_id) VALUES (1,?,?,?)");
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
      ins.run(row.difficulty || "medium", JSON.stringify(data), uni);
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

const uniIdMemo = new Map();
function currentUniversityId(user) {
  if (!user?.id) return null;
  if (uniIdMemo.has(user.id)) return uniIdMemo.get(user.id);
  let v = null;
  try { v = db.prepare("SELECT university_id FROM users WHERE id=?").get(user.id)?.university_id || null; }
  catch { v = null; }
  uniIdMemo.set(user.id, v);
  return v;
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
  // Licence enforcement: refuse to grow a capped university's student roster.
  if (role === "student") {
    const hit = checkStudentLimit(university_id, 1);
    if (hit) return res.status(403).json({ error: "university_student_limit", ...hit,
      message_fa: `سقف دانشجویان این دانشگاه (${hit.max}) تکمیل است.` });
  }
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

// Bulk-import students from a CSV/pasted text.
// Accepts columns: name (or first name), family (or last name), student_no (or studentNo/id).
// Header row optional. For each student: username = student number, password = student number.
r.post("/users/import", authRequired, requireRole("teacher", "admin"), (req, res) => {
  let { csv = "", university_id } = req.body || {};
  // a teacher's imported students are pinned to the teacher's own university.
  if (req.user.role === "teacher") {
    const me = db.prepare("SELECT university_id FROM users WHERE id=?").get(req.user.id);
    university_id = me?.university_id || university_id || null;
  }
  const lines = String(csv).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return res.status(400).json({ error: "empty" });

  // Detect and skip a header row if present.
  const headerRe = /(name|نام|family|خانوادگ|student|شماره|no|id)/i;
  const first = lines[0].split(/[,;\t]/).map((s) => s.trim().toLowerCase());
  const hasHeader = first.some((c) => headerRe.test(c));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const insUser = db.prepare(
    "INSERT INTO users (username,password_hash,name_fa,name_en,student_no,role,status,university_id) VALUES (?,?,?,?,?, 'student','active', ?)"
  );
  const findByNo = db.prepare("SELECT id FROM users WHERE student_no=? OR username=?");

  let created = 0, skipped = 0;
  const errors = [], duplicates = [], limitBlocked = [];
  // Licence enforcement: bulk import must stop exactly at the university's
  // student cap, and the operator needs to know which rows were blocked.
  let capHit = checkStudentLimit(university_id, 0);
  const tx = db.transaction(() => {
    dataLines.forEach((line, i) => {
      const cols = line.split(/[,;\t]/).map((s) => s.trim());
      // Flexible: [name, family, student_no]  OR  [full name, student_no]  OR  [student_no]
      let name = "", family = "", sno = "";
      if (cols.length >= 3) { [name, family, sno] = cols; }
      else if (cols.length === 2) { [name, sno] = cols; }
      else { sno = cols[0]; }
      sno = String(sno || "").trim();
      if (!sno) { errors.push(`${t_line(i, hasHeader)}: ${req_no_sno()}`); skipped++; return; }
      const fullName = [name, family].filter(Boolean).join(" ").trim() || sno;
      const existing = findByNo.get(sno, sno);
      if (existing) { duplicates.push({ student_no: sno, id: existing.id }); skipped++; return; } // already exists
      if (capHit) {
        // Once the cap is reached, every remaining NEW number is blocked at it.
        limitBlocked.push({ student_no: sno });
        skipped++;
        return;
      }
      try {
        insUser.run(sno, hashPasswordSync(sno), fullName, fullName, sno, university_id || null);
        created++;
        capHit = checkStudentLimit(university_id, 1); // re-check for the NEXT row
      } catch (e) { errors.push(`${sno}: ${e.message}`); skipped++; }
    });
  });
  try { tx(); } catch (e) { return res.status(400).json({ error: e.message }); }
  res.json({ created, skipped, total: dataLines.length, duplicates, limitBlocked: limitBlocked.slice(0, 50),
    limitBlockedCount: limitBlocked.length, studentLimit: capHit && limitBlocked.length ? capHit : null,
    errors: errors.slice(0, 20) });
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
