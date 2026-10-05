/* ================================================================
   reports.js — Research analytics, exam results & CSV export.
   ================================================================ */
import { Router } from "express";
import { db, persistNow } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";
import { toCSV, safeFilename } from "../lib/csv.js";
import { isLearnContent, caseIsLearn } from "../lib/content-track.js";

const r = Router();

const attemptsQuery = `
  SELECT a.*, u.name_fa AS student_fa, u.name_en AS student_en, u.student_no AS student_no,
         u.university_id AS student_university_id, u.role AS student_role,
         c.data_json AS case_json,
         e.title_fa AS exam_fa, e.title_en AS exam_en,
         e.study_id AS exam_study_id, cl.study_id AS class_study_id
  FROM attempts a
  LEFT JOIN users u ON u.id = a.user_id
  LEFT JOIN cases c ON c.id = a.case_id
  LEFT JOIN exams e ON e.id = a.exam_id
  LEFT JOIN classes cl ON cl.id = a.class_id
  ORDER BY a.created_at DESC`;

function currentUniversityId(user) {
  if (!user?.id) return null;
  return db.prepare("SELECT university_id FROM users WHERE id=?").get(user.id)?.university_id || null;
}
function teacherOwnsStudent(user, studentUniversityId, studentRole) {
  if (user.role === "admin") return true;
  if (user.role !== "teacher") return false;
  if (studentRole && studentRole !== "student") return false;
  const uni = currentUniversityId(user);
  return uni != null && (Number(studentUniversityId) || 1) === uni;
}
function scopedAttemptRows(user) {
  const rows = rowsWithNames();
  if (user.role === "admin") return rows;
  return rows.filter((a) => teacherOwnsStudent(user, a.student_university_id, a.student_role));
}

function mapRow(a) {
  let caseTitleFa = "فلش‌کارت", caseTitleEn = "Flashcards";
  if (a.case_json) {
    try {
      const cd = JSON.parse(a.case_json);
      caseTitleFa = cd.title_fa; caseTitleEn = cd.title_en;
    } catch { /* corrupt case payload must not 500 the student's home */ }
  }
  return {
    id: a.id, user_id: a.user_id, type: a.type, score: a.score,
    turns: a.turns, tests: a.tests, imaging_count: a.imaging_count, ddx_count: a.ddx_count,
    hints: a.hints, total_questions: a.total_questions, correct_count: a.correct_count,
    wrong_count: a.wrong_count, duration_sec: a.duration_sec, lang: a.lang,
    content_version: a.content_version, created_at: a.created_at,
    student_fa: a.student_fa, student_en: a.student_en, student_no: a.student_no,
    student_university_id: a.student_university_id, student_role: a.student_role,
    case_fa: caseTitleFa, case_en: caseTitleEn,
    exam_id: a.exam_id, exam_fa: a.exam_fa, exam_en: a.exam_en,
    study_id: a.exam_study_id || a.class_study_id || null,
    research: !!(a.exam_study_id || a.class_study_id),
    // teacher review of the AI score
    teacher_status: a.teacher_status || null, teacher_score: a.teacher_score ?? null,
    teacher_feedback: a.teacher_feedback || "", reviewed_at: a.reviewed_at || null,
    // the score that "counts": teacher override when adjusted, else AI score
    final_score: (a.teacher_status === "adjusted" && a.teacher_score != null) ? a.teacher_score
               : (a.teacher_status === "rejected" ? 0 : a.score),
  };
}
function rowsWithNames() {
  return db.prepare(attemptsQuery).all().map(mapRow);
}
function filterRows(rows, q = {}) {
  let out = rows;
  if (q.type) out = out.filter((a) => a.type === q.type);
  if (q.examId && q.examId !== "all") {
    if (q.examId === "none") out = out.filter((a) => !a.exam_id);
    else out = out.filter((a) => String(a.exam_id) === String(q.examId));
  }
  if (q.research === "1" || q.research === "true") out = out.filter((a) => a.research);
  return out;
}
const J = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };

/* Dashboard summary */
r.get("/summary", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  const uni = req.user.role === "teacher" ? currentUniversityId(req.user) : null;
  const countUniBank = (table, universityId) => {
    const bankSql = "CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.track') = 'learn' ELSE 0 END";
    if (universityId) {
      return db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE active=1 AND COALESCE(university_id,1)=? AND NOT COALESCE(${bankSql}, 0)`).get(universityId).n;
    }
    return db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE active=1 AND NOT COALESCE(${bankSql}, 0)`).get().n;
  };
  const students = uni
    ? db.prepare("SELECT COUNT(*) n FROM users WHERE role='student' AND COALESCE(university_id,1)=?").get(uni).n
    : db.prepare("SELECT COUNT(*) n FROM users WHERE role='student'").get().n;
  const cases = countUniBank("cases", uni);
  const cards = countUniBank("flashcards", uni);
  const scoped = scopedAttemptRows(req.user);
  const attempts = scoped.length;
  const exams = uni
    ? db.prepare("SELECT COUNT(*) n FROM exams WHERE active=1 AND COALESCE(university_id,1)=?").get(uni).n
    : db.prepare("SELECT COUNT(*) n FROM exams WHERE active=1").get().n;
  const avg = scoped.length ? scoped.reduce((s, a) => s + Number(a.score || 0), 0) / scoped.length : 0;
  const recent = scoped.slice(0, 6);
  res.json({ students, cases, cards, attempts, exams, avgScore: Math.round(avg), recent });
  } catch (e) {
    res.status(500).json({ error: "summary_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* Full attempts list (optionally filtered by type: vp | flash) */
r.get("/attempts", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try { res.json(filterRows(scopedAttemptRows(req.user), req.query)); }
  catch (e) { res.status(500).json({ error: "attempts_failed", stage: "boot", message: String(e.message || e).slice(0, 200) }); }
});

/* CSV export (optionally by type) */
r.get("/export.csv", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  let rows = filterRows(scopedAttemptRows(req.user), req.query);
  const flat = rows.map((a) => ({
    id: a.id, student: a.student_en, student_no: a.student_no,
    exam: a.exam_en || "-", case: a.case_en, type: a.type, score: a.score,
    turns: a.turns, tests: a.tests, imaging: a.imaging_count, ddx: a.ddx_count,
    total_questions: a.total_questions, correct: a.correct_count, wrong: a.wrong_count,
    hints: a.hints, duration_sec: a.duration_sec, lang: a.lang,
    content_version: a.content_version, created_at: a.created_at,
  }));
  const cols = ["id","student","student_no","exam","case","type","score","turns","tests","imaging","ddx",
    "total_questions","correct","wrong","hints","duration_sec","lang","content_version","created_at"];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  const suffix = safeFilename(req.query.examId && req.query.examId !== "all" ? `exam_${req.query.examId}` : (req.query.type || "all"), "all");
  res.setHeader("Content-Disposition", `attachment; filename="results_${suffix}.csv"`);
  res.send(toCSV(flat, cols));
  } catch (e) {
    res.status(500).json({ error: "export_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* Student's own progress (detailed) */
r.get("/my", authRequired, (req, res) => {
  try {
  let rows = db.prepare(
    `SELECT a.*, c.data_json AS case_json, e.title_fa AS exam_fa, e.title_en AS exam_en
       FROM attempts a
       LEFT JOIN cases c ON c.id = a.case_id
       LEFT JOIN exams e ON e.id = a.exam_id
     WHERE a.user_id=? ORDER BY a.created_at DESC`
  ).all(req.user.id);
  if (req.user.role === "learner") {
    rows = rows.filter((a) => !a.class_id && !a.exam_id);
  } else if (req.user.role === "student") {
    rows = rows.filter((a) => !isLearnContent(a.case_json));
  }
  const out = rows.map(mapRow);
  if (req.user.role === "learner") {
    for (const m of out) {
      m.exam_id = null; m.exam_fa = null; m.exam_en = null;
      m.study_id = null; m.research = false;
    }
  }
  res.json(out);
  } catch (e) {
    res.status(500).json({ error: "progress_load_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Single attempt: full log (transcript + evaluation) for teacher review ---- */
r.get("/attempts/:id", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  const a = db.prepare(`
    SELECT a.*, u.name_fa AS student_fa, u.name_en AS student_en, u.student_no,
           u.university_id AS student_university_id, u.role AS student_role,
           c.data_json AS case_json, e.title_fa AS exam_fa, e.title_en AS exam_en
      FROM attempts a
      LEFT JOIN users u ON u.id=a.user_id
      LEFT JOIN cases c ON c.id=a.case_id
      LEFT JOIN exams e ON e.id=a.exam_id
     WHERE a.id=?`).get(req.params.id);
  if (!a) return res.status(404).json({ error: "not found" });
  if (!teacherOwnsStudent(req.user, a.student_university_id, a.student_role)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  const base = mapRow(a);
  res.json({
    ...base,
    transcript: J(a.transcript_json, {}),   // { messages, tests, imaging, ddx, finalDx }
    eval: J(a.eval_json, {}),                // { score, score10, results[], strengths[], ... }
    reviewed_by: a.reviewed_by || null,
  });
  } catch (e) {
    res.status(500).json({ error: "attempt_load_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Delete a report/attempt (teacher/admin) ---- */
r.delete("/attempts/:id", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  const a = db.prepare(`
    SELECT a.id, u.university_id AS student_university_id, u.role AS student_role
      FROM attempts a LEFT JOIN users u ON u.id=a.user_id WHERE a.id=?`).get(req.params.id);
  if (!a) return res.status(404).json({ error: "not found" });
  if (!teacherOwnsStudent(req.user, a.student_university_id, a.student_role)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  db.prepare("DELETE FROM attempts WHERE id=?").run(req.params.id);
  persistNow();
  res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "attempt_delete_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Teacher reviews the AI score: approve | adjust (with score) | reject + feedback ---- */
r.put("/attempts/:id/review", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  const a = db.prepare(`
    SELECT a.*, u.university_id AS student_university_id, u.role AS student_role
      FROM attempts a LEFT JOIN users u ON u.id=a.user_id WHERE a.id=?`).get(req.params.id);
  if (!a) return res.status(404).json({ error: "not found" });
  if (!teacherOwnsStudent(req.user, a.student_university_id, a.student_role)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  const b = req.body || {};
  const status = ["approved", "adjusted", "rejected"].includes(b.status) ? b.status : "approved";
  let teacherScore = null;
  if (status === "adjusted") teacherScore = Math.max(0, Math.min(100, parseInt(b.teacher_score, 10) || 0));
  const feedback = String(b.teacher_feedback || "").slice(0, 4000);
  db.prepare(`UPDATE attempts SET teacher_status=?, teacher_score=?, teacher_feedback=?,
    reviewed_by=?, reviewed_at=datetime('now') WHERE id=?`)
    .run(status, teacherScore, feedback, req.user.id, a.id);
  persistNow();
  res.json({ ok: true, status, teacher_score: teacherScore });
  } catch (e) {
    res.status(500).json({ error: "review_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Per-student progress series for radar + line charts ----
   Radar: average score per checklist criterion across the student's VP attempts.
   Line:  score over time. Teacher/admin can query any student; a learner/student
   can only query themselves. */
r.get("/progress/:userId", authRequired, (req, res) => {
  try {
  const uid = parseInt(req.params.userId, 10);
  const isStaff = ["teacher", "admin"].includes(req.user.role);
  if (!isStaff && req.user.id !== uid) return res.status(403).json({ error: "forbidden" });
  if (req.user.role === "teacher") {
    const target = db.prepare("SELECT university_id, role FROM users WHERE id=?").get(uid);
    if (!target || !teacherOwnsStudent(req.user, target.university_id, target.role)) {
      return res.status(403).json({ error: "wrong_university", stage: "access" });
    }
  }
  let rows = db.prepare(
    "SELECT id, score, eval_json, teacher_status, teacher_score, created_at, type, case_id, class_id, exam_id FROM attempts WHERE user_id=? AND type='vp' ORDER BY created_at ASC"
  ).all(uid);
  if (req.user.role === "learner") {
    rows = rows.filter((a) => !a.class_id && !a.exam_id && caseIsLearn(a.case_id));
  } else if (req.user.role === "student") {
    rows = rows.filter((a) => !caseIsLearn(a.case_id));
  }
  const J = (s) => { try { return JSON.parse(s); } catch { return null; } };
  // line series: the score that counts, over time
  const line = rows.map((a) => ({
    at: a.created_at,
    score: (a.teacher_status === "adjusted" && a.teacher_score != null) ? a.teacher_score
         : (a.teacher_status === "rejected" ? 0 : a.score),
    aiScore: a.score,
  }));
  // radar: aggregate per-criterion pass-rate across attempts
  const agg = {};   // label -> { done, total }
  for (const a of rows) {
    const ev = J(a.eval_json); if (!ev || !Array.isArray(ev.results)) continue;
    for (const it of ev.results) {
      const key = it.label || it.id;
      if (!key) continue;
      agg[key] = agg[key] || { done: 0, total: 0 };
      agg[key].total += 1;
      if (it.done) agg[key].done += 1;
    }
  }
  const radar = isStaff ? Object.entries(agg).map(([label, v]) => ({
    label, value: v.total ? Math.round((v.done / v.total) * 100) : 0,
  })) : [];
  res.json({ line, radar, attempts: rows.length });
  } catch (e) {
    res.status(500).json({ error: "progress_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* A specific student's full record (teacher/admin) — for the report card */
r.get("/student/:userId", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  const u = db.prepare("SELECT id,name_fa,name_en,student_no,role,university_id FROM users WHERE id=?").get(req.params.userId);
  if (!u) return res.status(404).json({ error: "not found" });
  if (!teacherOwnsStudent(req.user, u.university_id, u.role)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  const rows = db.prepare(
    `SELECT a.*, c.data_json AS case_json, e.title_fa AS exam_fa, e.title_en AS exam_en
       FROM attempts a
       LEFT JOIN cases c ON c.id = a.case_id
       LEFT JOIN exams e ON e.id = a.exam_id
     WHERE a.user_id=? ORDER BY a.created_at ASC`
  ).all(req.params.userId).map((a) => ({
    ...mapRow(a),
    transcript: J(a.transcript_json, {}),
    eval: J(a.eval_json, {}),
  }));
  res.json({ student: u, attempts: rows });
  } catch (e) {
    res.status(500).json({ error: "student_report_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

export default r;
