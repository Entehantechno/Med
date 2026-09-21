/* ================================================================
   exams.js — Scheduled exams (virtual patient + flashcards),
   assigned to specific students, visible only in a time window.
   ================================================================ */
import { Router } from "express";
import { db, persistNow } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";
import { isLearnContent, caseIsLearn } from "../lib/content-track.js";
import { hashPasswordSync } from "../lib/password.js";
import { createItemAnalysis, addFlashAnswer as iaAdd, noteTrend as iaTrend, finishItemAnalysis, answerTelemetry, itemAnalysisCsv } from "../lib/itemanalysis.js";
import { assessDrawing, drawingAssistEnabled } from "../lib/drawingassist.js";
import { validateBody, s as vs } from "../lib/validate.js";
import { normDigits } from "../lib/textsearch.js";
import { checkStudentLimit, effectiveFlashNoPenalty } from "../lib/orglimits.js";
import { sendPrivateJson, sqlInList } from "../lib/http-cache.js";

const r = Router();

function parseExamJson(s, fb) { try { return JSON.parse(s || ""); } catch { return fb; } }
const parseExam = (row) => ({
  id: row.id, title_fa: row.title_fa, title_en: row.title_en,
  desc_fa: row.desc_fa, desc_en: row.desc_en,
  case_ids: parseExamJson(row.case_ids, []),
  flashcard_ids: parseExamJson(row.flashcard_ids, []),
  use_flashcards: !!row.use_flashcards,
  starts_at: row.starts_at, ends_at: row.ends_at,
  duration_min: row.duration_min, max_attempts: row.max_attempts,
  lang: row.lang, active: !!row.active,
  shuffle: !!row.shuffle, anti_cheat: !!row.anti_cheat, competition: !!row.competition,
  show_correct: !!row.show_correct, show_hints: !!row.show_hints,
  show_ai: !!row.show_ai, show_micro: !!row.show_micro,
  log_transcript: !!row.log_transcript, study_id: row.study_id || null,
  university_id: row.university_id || null,
});

function windowState(exam, now = Date.now()) {
  const s = exam.starts_at ? new Date(exam.starts_at).getTime() : null;
  const e = exam.ends_at ? new Date(exam.ends_at).getTime() : null;
  if (s && now < s) return "upcoming";
  if (e && now > e) return "ended";
  return "open";
}


const uniIdMemo = new Map();
const currentUniversityId = (user) => {
  if (!user?.id) return null;
  if (uniIdMemo.has(user.id)) return uniIdMemo.get(user.id);
  const v = db.prepare("SELECT university_id FROM users WHERE id=?").get(user.id)?.university_id || null;
  uniIdMemo.set(user.id, v);
  return v;
};
const studentByNo = (sno) => {
  const sn = String(sno || "").trim();
  if (!sn) return null;
  const snNorm = normDigits(sn);
  return db.prepare("SELECT id, username, student_no, name_fa, name_en, university_id FROM users WHERE (student_no=? OR username=? OR student_no=? OR username=?) AND role='student'").get(sn, sn, snNorm, snNorm) || null;
};
function createStudentForUniversity({ sno, name = "", universityId }) {
  const sn = normDigits(String(sno || "").trim()) || String(sno || "").trim();
  if (!sn || !universityId) return null;
  const existing = studentByNo(sn);
  if (existing) return existing;
  // B2B license: a university that hit its student cap cannot grow past it.
  if (checkStudentLimit(universityId, 1)) return null;
  const info = db.prepare("INSERT INTO users (username,password_hash,name_fa,name_en,student_no,role,status,university_id) VALUES (?,?,?,?,?,'student','active',?)")
    .run(sn, hashPasswordSync(sn), name || sn, name || sn, sn, universityId);
  return { id: info.lastInsertRowid, username: sn, student_no: sn, name_fa: name || sn, name_en: name || sn, university_id: universityId };
}
function canManageExam(user, ex) {
  if (user.role === "admin") return true;
  return user.role === "teacher" && ex.university_id === currentUniversityId(user);
}

/* ---- List exams ----
   Staff: all. Students: only exams they're assigned to (with window state). */
r.get("/", authRequired, (req, res) => {
  try {
  if (req.user.role === "student") {
    const rows = db.prepare(
      `SELECT e.* FROM exams e
         JOIN exam_participants p ON p.exam_id = e.id
       WHERE p.user_id=? AND e.active=1 ORDER BY e.id DESC`
    ).all(req.user.id);
    const ids = rows.map((row) => row.id);
    const vpUsedBy = new Map(), flashUsedBy = new Map();
    if (ids.length) {
      const ph = ids.map(() => "?").join(",");
      for (const r of db.prepare(`SELECT exam_id, COUNT(*) n FROM attempts WHERE user_id=? AND exam_id IN (${ph}) AND type='vp' GROUP BY exam_id`).all(req.user.id, ...ids)) vpUsedBy.set(r.exam_id, r.n);
      for (const r of db.prepare(`SELECT exam_id, COUNT(*) n FROM attempts WHERE user_id=? AND exam_id IN (${ph}) AND type='flash' GROUP BY exam_id`).all(req.user.id, ...ids)) flashUsedBy.set(r.exam_id, r.n);
    }
    const out = rows.map((row) => {
      const ex = parseExam(row);
      const maxA = ex.max_attempts ?? 1;
      const vpUsed = vpUsedBy.get(ex.id) || 0;
      const flashUsed = flashUsedBy.get(ex.id) || 0;
      const used = Math.max(vpUsed, flashUsed);
      const hasCases = (ex.case_ids || []).length > 0;
      const hasFlash = !!ex.use_flashcards;
      const exhausted = (hasCases || hasFlash)
        && (!hasCases || vpUsed >= maxA)
        && (!hasFlash || flashUsed >= maxA);
      const { case_ids, flashcard_ids, ...pub } = ex;
      return { ...pub, state: windowState(ex), attemptsUsed: used, vpAttemptsUsed: vpUsed, flashAttemptsUsed: flashUsed, exhausted };
    });
    return res.json(out);
  }
  if (req.user.role === "learner") {
    return res.status(403).json({ error: "university_only", reason: "university_only", stage: "access" });
  }
  if (req.user.role !== "teacher" && req.user.role !== "admin") {
    return res.status(403).json({ error: "forbidden", stage: "access" });
  }
  const rows = req.user.role === "teacher"
    ? db.prepare("SELECT * FROM exams WHERE active=1 AND university_id=? ORDER BY id DESC").all(currentUniversityId(req.user) || -1)
    : db.prepare("SELECT * FROM exams WHERE active=1 ORDER BY id DESC").all();
  const nBy = new Map();
  if (rows.length) {
    const ids = rows.map((row) => row.id);
    const ph = ids.map(() => "?").join(",");
    for (const r of db.prepare(`SELECT exam_id, COUNT(*) n FROM exam_participants WHERE exam_id IN (${ph}) GROUP BY exam_id`).all(...ids)) nBy.set(r.exam_id, r.n);
  }
  res.json(rows.map((row) => {
    const ex = parseExam(row);
    const nStudents = nBy.get(ex.id) || 0;
    return { ...ex, nStudents, state: windowState(ex) };
  }));
  } catch (e) {
    res.status(500).json({ error: "exam_list_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Exam detail ---- */
r.get("/:id", authRequired, (req, res) => {
  try {
  const row = db.prepare("SELECT * FROM exams WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found", stage: "exam" });
  const ex = parseExam(row);
  if (req.user.role === "learner") {
    return res.status(403).json({ error: "university_only", reason: "university_only", stage: "access" });
  }

  if (req.user.role === "student") {
    if (!ex.active) return res.status(404).json({ error: "not found", stage: "exam" });
    const member = db.prepare("SELECT 1 FROM exam_participants WHERE exam_id=? AND user_id=?")
      .get(ex.id, req.user.id);
    if (!member) return res.status(403).json({ error: "not assigned", stage: "access" });
    const state = windowState(ex);
    const maxA = ex.max_attempts ?? 1;
    const vpUsed = examKindUsed(req.user.id, ex.id, "vp");
    const flashUsed = examKindUsed(req.user.id, ex.id, "flash");
    const used = Math.max(vpUsed, flashUsed);
    // No-penalty flashcards for this exam come from its university's licence
    // settings (classes are not involved in scheduled exams).
    const flashNoPenalty = effectiveFlashNoPenalty(null, row.university_id);
    if (state !== "open") {
      const { case_ids, flashcard_ids, ...safe } = ex;
      return res.json({ ...safe, case_ids: [], flashcard_ids: [], state, attemptsUsed: used, vpAttemptsUsed: vpUsed, flashAttemptsUsed: flashUsed, cases: [], locked: true, flashNoPenalty });
    }
    const caseWant = sqlInList(ex.case_ids || []);
    const caseBy = new Map();
    if (caseWant.length) {
      const ph = caseWant.map(() => "?").join(",");
      for (const c of db.prepare(`SELECT * FROM cases WHERE id IN (${ph}) AND active=1`).all(...caseWant)) caseBy.set(c.id, c);
    }
    const cases = (ex.case_ids || []).map((cid) => {
      const c = caseBy.get(Number(cid));
      if (!c || isLearnContent(c.data_json)) return null;
      let cd = {};
      try { cd = JSON.parse(c.data_json || "{}"); } catch { cd = {}; }
      return { case_id: c.id, title_fa: cd.title_fa, title_en: cd.title_en, difficulty: c.difficulty, version: c.version };
    }).filter(Boolean);
    const flashWant = sqlInList(ex.flashcard_ids || []);
    const flashOk = new Set();
    if (flashWant.length) {
      const ph = flashWant.map(() => "?").join(",");
      for (const row of db.prepare(`SELECT id, data_json FROM flashcards WHERE id IN (${ph}) AND active=1`).all(...flashWant)) {
        if (!isLearnContent(row.data_json)) flashOk.add(row.id);
      }
    }
    const flashcard_ids = (ex.flashcard_ids || []).filter((fid) => flashOk.has(Number(fid)));
    const hasCases = cases.length > 0;
    const hasFlash = !!ex.use_flashcards;
    const vpExhausted = hasCases && vpUsed >= maxA;
    const flashExhausted = hasFlash && flashUsed >= maxA;
    if ((!hasCases || vpExhausted) && (!hasFlash || flashExhausted) && (hasCases || hasFlash)) {
      const { case_ids, flashcard_ids, ...safe } = ex;
      return res.json({ ...safe, case_ids: [], flashcard_ids: [], state, attemptsUsed: used, vpAttemptsUsed: vpUsed, flashAttemptsUsed: flashUsed, cases: [], locked: true, lockReason: "attempts", flashNoPenalty });
    }
    return res.json({
      ...ex,
      flashcard_ids: flashExhausted ? [] : flashcard_ids,
      state, attemptsUsed: used, vpAttemptsUsed: vpUsed, flashAttemptsUsed: flashUsed,
      cases: vpExhausted ? [] : cases, locked: false,
      vpLocked: vpExhausted, flashLocked: flashExhausted, flashNoPenalty,
    });
  }

  // staff: include participant list + gradebook
  if (!canManageExam(req.user, ex)) return res.status(403).json({ error: "wrong_university" });
  const bestBy = new Map();
  for (const r of db.prepare("SELECT user_id, MAX(score) s, COUNT(*) n FROM attempts WHERE exam_id=? GROUP BY user_id").all(ex.id)) {
    bestBy.set(r.user_id, r);
  }
  const participants = db.prepare(
    `SELECT u.id,u.name_fa,u.name_en,u.student_no
       FROM exam_participants p JOIN users u ON u.id=p.user_id
     WHERE p.exam_id=? ORDER BY u.id`
  ).all(ex.id).map((u) => {
    const best = bestBy.get(u.id) || { s: null, n: 0 };
    return { ...u, best: best.s, attempts: best.n };
  });
  res.json({ ...ex, state: windowState(ex), participants });
  } catch (e) {
    res.status(500).json({ error: "exam_load_failed", stage: "exam", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Create / update / delete (staff) ---- */
const bit = (v, d = 0) => (v === undefined || v === null ? d : (v ? 1 : 0));
function filterContentForUniversity(b, universityId) {
  const uni = universityId || 1;
  const caseWant = sqlInList(b.case_ids);
  const flashWant = sqlInList(b.flashcard_ids);
  const caseOk = new Set();
  if (caseWant.length) {
    const ph = caseWant.map(() => "?").join(",");
    for (const row of db.prepare(`SELECT id, data_json, university_id FROM cases WHERE id IN (${ph}) AND active=1`).all(...caseWant)) {
      if (isLearnContent(row.data_json)) continue;
      if ((row.university_id || 1) === uni) caseOk.add(row.id);
    }
  }
  const flashOk = new Set();
  if (flashWant.length) {
    const ph = flashWant.map(() => "?").join(",");
    for (const row of db.prepare(`SELECT id, data_json, university_id FROM flashcards WHERE id IN (${ph}) AND active=1`).all(...flashWant)) {
      if (isLearnContent(row.data_json)) continue;
      if ((row.university_id || 1) === uni) flashOk.add(row.id);
    }
  }
  return { caseIds: caseWant.filter((id) => caseOk.has(id)), flashcardIds: flashWant.filter((id) => flashOk.has(id)) };
}
function resolveStudyId(v) {
  const id = Number(v) || 0;
  if (!id) return null;
  return db.prepare("SELECT id FROM research_studies WHERE id=?").get(id)?.id || null;
}
function teacherMayAttachStudy(user, studyId) {
  if (!studyId) return true;
  if (user.role === "admin") return true;
  if (user.role !== "teacher") return false;
  const st = db.prepare("SELECT created_by FROM research_studies WHERE id=?").get(studyId);
  if (!st) return false;
  const uni = currentUniversityId(user) || -1;
  const creator = db.prepare("SELECT university_id, role FROM users WHERE id=?").get(st.created_by);
  if (!creator) return false;
  if (creator.role === "admin") return false;
  return (creator.university_id || 1) === uni;
}
function saveBody(b, universityId = 1, prev = {}) {
  const filtered = filterContentForUniversity(b || {}, universityId);
  const studyRaw = b.studyId !== undefined ? b.studyId : (b.study_id !== undefined ? b.study_id : prev.study_id);
  const study = resolveStudyId(studyRaw);
  const logRaw = b.logTranscript !== undefined ? b.logTranscript : (b.log_transcript !== undefined ? b.log_transcript : prev.log_transcript);
  const logOn = logRaw === true || logRaw === 1 || logRaw === "1";
  return [
    b.title_fa, b.title_en, b.desc_fa, b.desc_en,
    JSON.stringify(filtered.caseIds), JSON.stringify(filtered.flashcardIds),
    b.use_flashcards ? 1 : 0, b.starts_at || null, b.ends_at || null,
    b.duration_min || 30, b.max_attempts || 1, b.lang || "both",
    bit(b.shuffle, 0), bit(b.anti_cheat, 1), bit(b.competition, 0),
    bit(b.show_correct, 1), bit(b.show_hints, 1), bit(b.show_ai, 1), bit(b.show_micro, 1),
    logOn ? 1 : 0, study,
  ];
}
r.post("/", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const uni = currentUniversityId(req.user) || Number(req.body?.university_id || 0) || 1;
  if (req.user.role === "teacher" && !uni) return res.status(400).json({ error: "university_required", message_fa: "برای استاد انتخاب دانشگاه الزامی است." });
  const b = req.body || {};
  if ((b.studyId || b.study_id) && !resolveStudyId(b.studyId ?? b.study_id)) return res.status(400).json({ error: "study_not_found" });
  const attachStudy = resolveStudyId(b.studyId ?? b.study_id);
  if (attachStudy && req.user.role === "teacher" && !teacherMayAttachStudy(req.user, attachStudy)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  const info = db.prepare(
    `INSERT INTO exams (title_fa,title_en,desc_fa,desc_en,case_ids,flashcard_ids,use_flashcards,
       starts_at,ends_at,duration_min,max_attempts,lang,shuffle,anti_cheat,competition,show_correct,show_hints,show_ai,show_micro,log_transcript,study_id,owner_id,university_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(...saveBody(b, uni), req.user.id, uni);
  persistNow();
  res.json({ id: info.lastInsertRowid });
});
r.put("/:id", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const row = db.prepare("SELECT * FROM exams WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (!canManageExam(req.user, parseExam(row))) return res.status(403).json({ error: "wrong_university" });
  const b = req.body || {};
  if ((b.studyId || b.study_id) && !resolveStudyId(b.studyId ?? b.study_id)) return res.status(400).json({ error: "study_not_found" });
  const attachStudy = resolveStudyId(b.studyId ?? b.study_id);
  if (attachStudy && req.user.role === "teacher" && !teacherMayAttachStudy(req.user, attachStudy)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  db.prepare(
    `UPDATE exams SET title_fa=?,title_en=?,desc_fa=?,desc_en=?,case_ids=?,flashcard_ids=?,
       use_flashcards=?,starts_at=?,ends_at=?,duration_min=?,max_attempts=?,lang=?,
       shuffle=?,anti_cheat=?,competition=?,show_correct=?,show_hints=?,show_ai=?,show_micro=?,log_transcript=?,study_id=? WHERE id=?`
  ).run(...saveBody(b, parseExam(row).university_id || 1, row), req.params.id);
  persistNow();
  res.json({ ok: true });
});
r.delete("/:id", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const row = db.prepare("SELECT * FROM exams WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found", stage: "exam" });
  if (!canManageExam(req.user, parseExam(row))) return res.status(403).json({ error: "wrong_university", stage: "access" });
  db.prepare("UPDATE exams SET active=0 WHERE id=?").run(req.params.id);
  persistNow();
  res.json({ ok: true });
});

/* ---- Assign participants by student number ---- */
// Body: { studentNos: ["40012345", ...] }  → resolves to user ids
r.put("/:id/participants", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const row = db.prepare("SELECT * FROM exams WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  const ex = parseExam(row);
  if (!canManageExam(req.user, ex)) return res.status(403).json({ error: "wrong_university" });
  const { studentNos = [], userIds = [], createMissing = false, names = {} } = req.body || {};
  const eid = req.params.id;
  const ids = new Set();
  const notFound = [], wrongUniversity = [], created = [], limitBlocked = [];
  let studentLimit = null;
  for (const uid of userIds) {
    const u = db.prepare("SELECT id, university_id FROM users WHERE id=? AND role='student'").get(uid);
    if (u && u.university_id === ex.university_id) ids.add(u.id); else if (u) wrongUniversity.push({ id: uid });
  }
  for (const sn of studentNos) {
    const key = String(sn).trim(); if (!key) continue;
    let u = studentByNo(key);
    if (!u && createMissing) {
      // Licence: a full university can't mint more students — report, don't pretend missing.
      const lim = checkStudentLimit(ex.university_id, 1);
      if (lim) { studentLimit = lim; limitBlocked.push({ student_no: key }); continue; }
      u = createStudentForUniversity({ sno: key, name: names[key] || key, universityId: ex.university_id });
      if (u) created.push(u);
    }
    if (!u) { notFound.push(key); continue; }
    if (u.university_id !== ex.university_id) { wrongUniversity.push({ student_no: key, existing: u }); continue; }
    ids.add(u.id);
  }
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM exam_participants WHERE exam_id=?").run(eid);
    const ins = db.prepare("INSERT OR IGNORE INTO exam_participants (exam_id,user_id) VALUES (?,?)");
    for (const uid of ids) ins.run(eid, uid);
  });
  tx(); persistNow();
  res.json({ ok: true, added: ids.size, notFound, wrongUniversity, created, limitBlocked, studentLimit });
});

r.post("/:id/participants/resolve", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const row = db.prepare("SELECT * FROM exams WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  const ex = parseExam(row);
  if (!canManageExam(req.user, ex)) return res.status(403).json({ error: "wrong_university" });
  const raw = Array.isArray(req.body?.studentNos) ? req.body.studentNos : String(req.body?.studentNos || "").split(/[\s,;]+/);
  const existing = [], missing = [], wrongUniversity = [];
  for (const x of raw.map((v) => String(v).trim()).filter(Boolean)) {
    const u = studentByNo(x);
    if (!u) missing.push(x); else if (u.university_id !== ex.university_id) wrongUniversity.push({ student_no: x, existing: u }); else existing.push(u);
  }
  res.json({ existing: [...new Map(existing.map((u)=>[u.id,u])).values()], missing, wrongUniversity });
});

const parseJson = (s, fb) => { try { return JSON.parse(s || ""); } catch { return fb; } };
function drawingStatus(ans) { return ans?.drawing?.approval?.status || (ans?.pendingApproval ? "pending" : "none"); }
function examDrawingCard(cardId) {
  if (cardId == null) return null;
  const row = db.prepare("SELECT data_json FROM flashcards WHERE id=?").get(cardId);
  try { return row ? JSON.parse(row.data_json) : null; } catch { return null; }
}
function listDrawingReviewsForExam(examId) {
  const rows = db.prepare(`SELECT a.id attempt_id,a.user_id,a.score,a.transcript_json,a.created_at,u.name_fa,u.name_en,u.student_no
    FROM attempts a LEFT JOIN users u ON u.id=a.user_id
    WHERE a.exam_id=? AND a.type='flash' ORDER BY a.id DESC`).all(examId);
  const out=[];
  for (const row of rows) {
    const tr=parseJson(row.transcript_json,{}), answers=Array.isArray(tr.answers)?tr.answers:[];
    answers.forEach((ans, idx)=>{ if(ans?.type==='drawing' && ans.drawing?.preview) {
      const card = examDrawingCard(ans.card_id);
      const cd = card?.drawing || {};
      const enabled = drawingAssistEnabled(cd);
      let assist = null;
      try { assist = assessDrawing(ans.drawing, cd, { proposedPoints: ans.proposedPoints || 100, minStrokes: cd.minStrokes || 1, enabled }); } catch { assist = null; }
      out.push({ source:'exam', examId, attemptId: row.attempt_id, answerIndex: idx, card_id: ans.card_id, order: ans.order, student: { id: row.user_id, name_fa: row.name_fa, name_en: row.name_en, student_no: row.student_no }, score: row.score, question_fa: ans.question_fa, question_en: ans.question_en, proposedPoints: ans.proposedPoints||0, points: ans.points||0, status: drawingStatus(ans), drawing: ans.drawing, created_at: row.created_at, zones: enabled ? (cd.zones || []) : [], assist });
    } });
  }
  return out;
}
r.get("/:id/drawing-reviews", authRequired, requireRole("teacher", "admin"), (req,res)=>{
  const row=db.prepare("SELECT * FROM exams WHERE id=?").get(req.params.id); if(!row) return res.status(404).json({error:"not_found"});
  const ex=parseExam(row); if(!canManageExam(req.user,ex)) return res.status(403).json({error:"wrong_university"});
  res.json({ reviews: listDrawingReviewsForExam(ex.id) });
});
const examDrawingReviewSchema = {
  status: vs.oneOf(["approved", "rejected"]),
  feedback: vs.str({ optional: true, max: 2000 }),
  points: vs.num({ optional: true, min: 0, max: 100 }),
};
r.post("/:id/drawing-reviews/:attemptId/:answerIndex", authRequired, requireRole("teacher", "admin"), validateBody(examDrawingReviewSchema), (req,res)=>{
  const row=db.prepare("SELECT * FROM exams WHERE id=?").get(req.params.id); if(!row) return res.status(404).json({error:"not_found"});
  const ex=parseExam(row); if(!canManageExam(req.user,ex)) return res.status(403).json({error:"wrong_university"});
  const at=db.prepare("SELECT * FROM attempts WHERE id=? AND exam_id=?").get(req.params.attemptId, ex.id); if(!at) return res.status(404).json({error:"attempt_not_found"});
  const tr=parseJson(at.transcript_json,{}), answers=Array.isArray(tr.answers)?tr.answers:[]; const idx=Number(req.params.answerIndex); const ans=answers[idx];
  if(!ans || ans.type!=="drawing") return res.status(404).json({error:"drawing_not_found"});
  const prev=Number(ans.points||0), proposed=Math.max(0, Number(req.body?.points ?? ans.proposedPoints ?? (ans.drawing?.pointsFrac ?? 0) * 100)||0);
  const status=req.body?.status === "approved" ? "approved" : "rejected";
  ans.points = status === "approved" ? proposed : 0;
  ans.solved = status === "approved";
  ans.pendingApproval = false;
  ans.drawing = { ...(ans.drawing||{}), approval: { status, feedback: req.body?.feedback||"", reviewer_id: req.user.id, reviewed_at: new Date().toISOString(), points: ans.points } };
  answers[idx]=ans; tr.answers=answers;
  const newScore=Math.max(0, Math.min(100, Math.round((Number(at.score)||0) - prev + Number(ans.points||0))));
  db.prepare("UPDATE attempts SET score=?, transcript_json=? WHERE id=?").run(newScore, JSON.stringify(tr), at.id);
  persistNow();
  res.json({ ok:true, score:newScore, review: ans.drawing.approval });
});

// helper for exam.js access checks
function examKindUsed(userId, examId, kind) {
  const type = kind === "flash" ? "flash" : "vp";
  return db.prepare("SELECT COUNT(*) n FROM attempts WHERE user_id=? AND exam_id=? AND type=?").get(userId, examId, type).n;
}

export function examAccess(userId, examId, caseId, acceptedAt = Date.now()) {
  const row = db.prepare("SELECT * FROM exams WHERE id=? AND active=1").get(examId);
  if (!row) return { allowed: false };
  const ex = parseExam(row);
  const member = db.prepare("SELECT 1 FROM exam_participants WHERE exam_id=? AND user_id=?").get(examId, userId);
  if (!member) return { allowed: false };
  if (windowState(ex, acceptedAt) !== "open") return { allowed: false, reason: "window" };
  if (caseId != null) {
    if (caseIsLearn(caseId)) return { allowed: false };
    const ids = (ex.case_ids || []).map(Number);
    if (!ids.includes(Number(caseId))) return { allowed: false };
  } else if (!ex.use_flashcards) {
    return { allowed: false };
  }
  /* VP cases and flashcard decks share one exam but are separate sittings.
     Counting every attempt type together meant finishing the case locked the
     flashcards (and the reverse) on a max_attempts=1 "both" exam. */
  const kind = caseId == null ? "flash" : "vp";
  const used = examKindUsed(userId, examId, kind);
  if (used >= (ex.max_attempts ?? 1)) return { allowed: false, reason: "attempts_exhausted" };
  return { allowed: true, exam: ex, remaining: Math.max(0, (ex.max_attempts ?? 1) - used) };
}


function examPct(n, d) { return d ? Math.round((Number(n || 0) / Number(d || 1)) * 100) : 0; }
function examParse(s, fb) { try { return JSON.parse(s || ""); } catch { return fb; } }
function examAddAgg(map, key, label_fa, label_en, score, total = 100) {
  if (!key) return;
  const it = map[key] ||= { key, label_fa: label_fa || key, label_en: label_en || label_fa || key, sum: 0, total: 0, n: 0 };
  it.sum += Number(score || 0); it.total += Number(total || 100); it.n++;
}
function examAggRows(map) { return Object.values(map).map((x) => ({ ...x, avg: examPct(x.sum, x.total) })).sort((a, b) => a.avg - b.avg); }
function examAnalyticsPayload(ex, { allItems = false } = {}) {
  const participants = db.prepare(`SELECT u.id,u.name_fa,u.name_en,u.student_no FROM exam_participants p JOIN users u ON u.id=p.user_id WHERE p.exam_id=?`).all(ex.id);
  const byStudent = [];
  const topicAgg = {}, itemAgg = {}, criterionAgg = {};
  const ia = createItemAnalysis();
  let totalAttempts = 0, pendingDrawings = 0;
  const attBy = new Map();
  for (const a of db.prepare("SELECT * FROM attempts WHERE exam_id=?").all(ex.id)) {
    const arr = attBy.get(a.user_id); if (arr) arr.push(a); else attBy.set(a.user_id, [a]);
  }
  for (const u of participants) {
    const attempts = attBy.get(u.id) || [];
    totalAttempts += attempts.length;
    const scores = [];
    for (const a of attempts) {
      scores.push(Number(a.score || 0));
      if (a.type === 'vp') {
        iaTrend(ia, a.created_at, a.score);
        const ev = examParse(a.eval_json, {});
        if (ev.sectionScores) for (const [k, v] of Object.entries(ev.sectionScores)) examAddAgg(criterionAgg, `vp:${k}`, k, k, v, 100);
        if (Array.isArray(ev.results)) for (const r of ev.results) examAddAgg(criterionAgg, `crit:${r.label || r.id}`, r.label || r.id, r.label || r.id, r.done ? 100 : 0, 100);
      } else {
        iaTrend(ia, a.created_at, a.score);
        const tr = examParse(a.transcript_json, {}), answers = Array.isArray(tr.answers) ? tr.answers : [];
        for (const ans of answers) {
          const topic = ans.category_fa || ans.title_fa || "فلش‌کارت";
          const label = ans.question_fa || ans.title_fa || topic;
          const labelEn = ans.question_en || ans.title_en || ans.category_en || topic;
          const itemKey = `card:${ans.card_id}:${ans.order || 0}`;
          examAddAgg(topicAgg, topic, topic, ans.category_en || topic, ans.points || 0, ans.proposedPoints || 100);
          examAddAgg(itemAgg, itemKey, label, labelEn, ans.points || 0, ans.proposedPoints || 100);
          if (ans.pendingApproval || ans.drawing?.approval?.status === 'pending') pendingDrawings++;
          const { hints, ms } = answerTelemetry(ans);
          const proposed = Number(ans.proposedPoints || 100);
          iaAdd(ia, { studentId: u.id, itemKey, topic, label_fa: label, label_en: labelEn,
            fraction: proposed > 0 ? Number(ans.points || 0) / proposed : 0,
            solved: !!ans.solved, hints, ms, createdAt: a.created_at });
        }
      }
    }
    const avg = scores.length ? Math.round(scores.reduce((x,y)=>x+y,0)/scores.length) : null;
    byStudent.push({ ...u, attempts: scores.length, avg });
  }
  const topics = examAggRows(topicAgg), itemsAggRows = examAggRows(itemAgg), criteria = examAggRows(criterionAgg);
  const students = byStudent.sort((a,b)=>(a.avg ?? -1)-(b.avg ?? -1));
  const finished = finishItemAnalysis(ia, byStudent);
  const byKey = new Map(finished.items.map((x) => [x.key, x]));
  const items = itemsAggRows.map((x) => ({ ...x, ...(byKey.get(x.key) || {}) }))
    .map((x) => ({ ...x, avg: x.avgPct ?? x.avg, avgHints: x.avgHints ?? 0 }));
  const supportNeeded = finished.studentCtx.size ? students
    .filter((s) => finished.studentCtx.has(s.id))
    .map((s) => ({ ...s, ...finished.studentCtx.get(s.id) })).slice(0, 10)
    : students.filter((s)=>s.avg!=null && s.avg<70).slice(0,10);
  return {
    exam: { id: ex.id, title_fa: ex.title_fa, title_en: ex.title_en },
    summary: {
      students: participants.length, attempts: totalAttempts, pendingDrawings, ...finished.summary,
    },
    strengths: topics.filter((x)=>x.avg>=75).sort((a,b)=>b.avg-a.avg).slice(0,8),
    weaknesses: topics.filter((x)=>x.avg<70).slice(0,8),
    itemWeaknesses: items.slice(0,12),
    slowItems: items.filter((x)=>x.avgSec!=null).sort((a,b)=>(b.avgSec||0)-(a.avgSec||0)).slice(0,10),
    hardItems: items.filter((x) => x.hard).sort((a, b) => a.facility - b.facility).slice(0, 10),
    poorDiscriminationItems: items.filter((x) => x.poorDiscrimination).slice(0, 10),
    hintEffectiveness: items.filter((x) => x.withHintSuccess != null && x.noHintSuccess != null)
      .map((x) => ({ key: x.key, label_fa: x.label_fa, label_en: x.label_en,
        noHintSuccess: x.noHintSuccess, withHintSuccess: x.withHintSuccess,
        gain: x.withHintSuccess - x.noHintSuccess }))
      .sort((a, b) => b.gain - a.gain).slice(0, 10),
    criterionWeaknesses: criteria.slice(0,12),
    items: allItems ? items.sort((a, b) => a.facility - b.facility) : undefined,
    trend: finished.trend,
    supportNeeded,
    topStudents: [...byStudent].filter((s)=>s.avg!=null).sort((a,b)=>b.avg-a.avg).slice(0,10),
  };
}
r.get("/:id/analytics", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  const row = db.prepare("SELECT * FROM exams WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found", stage: "boot" });
  const ex = parseExam(row);
  if (!canManageExam(req.user, ex)) return res.status(403).json({ error: "wrong_university", stage: "access" });
  res.json(examAnalyticsPayload(ex));
  } catch (e) {
    res.status(500).json({ error: "exam_analytics_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* Classical item-analysis CSV export (facility P, discrimination D, hint
   effectiveness and response time per question). */
r.get("/:id/analytics.csv", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM exams WHERE id=?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "not_found", stage: "boot" });
    const ex = parseExam(row);
    if (!canManageExam(req.user, ex)) return res.status(403).json({ error: "wrong_university", stage: "access" });
    const fa = (req.query.lang || "fa") !== "en";
    const payload = examAnalyticsPayload(ex, { allItems: true });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="exam-item-analysis-${ex.id}.csv"`);
    res.send("﻿" + itemAnalysisCsv(payload.items, fa));
  } catch (e) {
    res.status(500).json({ error: "exam_item_analysis_failed", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Leaderboard (competition mode) ----
   Ranks participants by their best score in this exam. */
r.get("/:id/leaderboard", authRequired, (req, res) => {
  try {
  const row = db.prepare("SELECT * FROM exams WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found", stage: "exam" });
  const ex = parseExam(row);
  if (!ex.competition) return res.status(400).json({ error: "competition not enabled", stage: "exam" });
  if (req.user.role === "learner") {
    return res.status(403).json({ error: "university_only", reason: "university_only", stage: "access" });
  }

  if (req.user.role === "student") {
    const member = db.prepare("SELECT 1 FROM exam_participants WHERE exam_id=? AND user_id=?").get(ex.id, req.user.id);
    if (!member) return res.status(403).json({ error: "not assigned", stage: "access" });
    if (windowState(ex) === "upcoming") {
      return res.status(403).json({ error: "exam window closed", reason: "window", stage: "exam" });
    }
  } else if (!canManageExam(req.user, ex)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }

  // Rank by the parts this exam actually has. Mixing MAX(vp, flash) let a
  // student skip the flashcard sitting (or the case) and still sit on top of
  // a mixed competition exam.
  const hasCases = (ex.case_ids || []).length > 0;
  const hasFlash = !!ex.use_flashcards;
  const rows = db.prepare(
    `SELECT u.id AS user_id, u.name_fa, u.name_en, u.student_no,
            MAX(CASE WHEN a.type='vp' THEN a.score END) AS best_vp,
            MAX(CASE WHEN a.type='flash' THEN a.score END) AS best_flash,
            COUNT(a.id) AS attempts,
            MIN(a.duration_sec) AS fastest
       FROM exam_participants p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN attempts a ON a.exam_id = p.exam_id AND a.user_id = p.user_id
      WHERE p.exam_id = ?
      GROUP BY u.id, u.name_fa, u.name_en, u.student_no`
  ).all(ex.id);

  const combined = (vp, flash) => {
    const parts = [];
    if (hasCases) parts.push(vp);
    if (hasFlash) parts.push(flash);
    if (!parts.length) return vp != null ? vp : flash;
    if (parts.every((x) => x == null)) return null;
    const nums = parts.map((x) => (x == null ? 0 : Number(x)));
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  };

  const ranked = rows
    .map((r) => ({
      user_id: r.user_id, name_fa: r.name_fa, name_en: r.name_en, student_no: r.student_no,
      score: combined(r.best_vp, r.best_flash),
      vp: r.best_vp == null ? null : r.best_vp,
      flash: r.best_flash == null ? null : r.best_flash,
      attempts: r.attempts || 0, fastest: r.fastest,
    }))
    .sort((x, y) => {
      // completed first, then higher score, then fewer attempts, then faster
      const xs = x.score == null ? -1 : x.score, ys = y.score == null ? -1 : y.score;
      if (ys !== xs) return ys - xs;
      if ((x.attempts || 0) !== (y.attempts || 0)) return (x.attempts || 0) - (y.attempts || 0);
      return (x.fastest || 1e9) - (y.fastest || 1e9);
    })
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const payload = { exam: { id: ex.id, title_fa: ex.title_fa, title_en: ex.title_en, competition: ex.competition, state: windowState(ex) }, ranked };
  sendPrivateJson(req, res, payload, {
    id: ex.id, state: windowState(ex),
    ranks: ranked.map((r) => [r.user_id, r.rank, r.score, r.vp, r.flash, r.attempts, r.fastest]),
  });
  } catch (e) {
    res.status(500).json({ error: "exam_leaderboard_failed", stage: "exam", message: String(e.message || e).slice(0, 200) });
  }
});

export default r;
