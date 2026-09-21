/* ================================================================
   classes.js — Classrooms: teacher creates a class, adds cases,
   enrolls students. Students take the class cases to earn a class
   grade (replacing the traditional logbook).
   ================================================================ */
import { Router } from "express";
import { safeFilename } from "../lib/csv.js";
import crypto from "crypto";
import { db, persistNow } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";
import { hashPasswordSync } from "../lib/password.js";
import { audit } from "../lib/audit.js";
import { sessionsForAttempt } from "../lib/vplogging.js";
import { getSetting } from "./content.js";
import { normalizeRubric, parseClassRubric, csvScopeLabel } from "../lib/grading-rubric.js";
import { createItemAnalysis, addFlashAnswer as iaAdd, noteTrend as iaTrend, finishItemAnalysis, answerTelemetry, itemAnalysisCsv } from "../lib/itemanalysis.js";
import { assessDrawing, drawingAssistEnabled } from "../lib/drawingassist.js";
import { validateBody, s as vs } from "../lib/validate.js";
import { recordStudyEvent, studyIdForClass } from "../lib/research-log.js";
import { scoreSubmittedAnswers, gradeSubmittedDeckDetailed, formatFlashAnswer } from "../lib/flashcard-grade.js";
import { effectiveFlashNoPenalty, effectiveLiveBoardSpeed, checkStudentLimit, triInput } from "../lib/orglimits.js";
import { isLearnContent } from "../lib/content-track.js";
import { normDigits } from "../lib/textsearch.js";
import { sendPrivateJson } from "../lib/http-cache.js";

const r = Router();

// Class codes gate enrolment → unpredictable (CSPRNG) rather than Math.random.
const genCode = () =>
  "MED-" + crypto.randomInt(1000, 10000);


const uniIdMemo = new Map();
const currentUniversityId = (user) => {
  if (!user?.id) return null;
  if (uniIdMemo.has(user.id)) return uniIdMemo.get(user.id);
  const v = db.prepare("SELECT university_id FROM users WHERE id=?").get(user.id)?.university_id || null;
  uniIdMemo.set(user.id, v);
  return v;
};
function forInChunks(ids, fn, size = 400) {
  const clean = [];
  const seen = new Set();
  for (const raw of ids || []) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    clean.push(n);
  }
  for (let i = 0; i < clean.length; i += size) fn(clean.slice(i, i + size));
  return clean;
}
function decorateClass(cl, { forStudent = false } = {}) {
  if (!cl) return cl;
  let gradingRubric = null;
  try { if (cl.grading_json) gradingRubric = JSON.parse(cl.grading_json); } catch { /* */ }
  const out = { ...cl, gradingRubric };
  // Resolved feature flags (class override → university → global default).
  out.flashNoPenalty = effectiveFlashNoPenalty(cl);
  out.liveBoardSpeed = effectiveLiveBoardSpeed(cl);
  if (forStudent) {
    delete out.grading_json;
    delete out.gradingRubric;
    delete out.tutor_prompt;
    delete out.code;
  }
  return out;
}
const studentByNo = (sno) => {
  const sn = String(sno || "").trim();
  if (!sn) return null;
  const snNorm = normDigits(sn);
  return db.prepare("SELECT id, username, student_no, name_fa, name_en, university_id FROM users WHERE (student_no=? OR username=? OR student_no=? OR username=?) AND role='student'").get(sn, sn, snNorm, snNorm) || null;
};
function createStudentForUniversity({ sno, name = "", universityId, createdBy }) {
  const sn = normDigits(String(sno || "").trim()) || String(sno || "").trim();
  if (!sn || !universityId) return null;
  const existing = studentByNo(sn);
  if (existing) return existing;
  // B2B license: a university that hit its student cap cannot grow past it.
  if (checkStudentLimit(universityId, 1)) return null;
  const info = db.prepare("INSERT INTO users (username,password_hash,name_fa,name_en,student_no,role,status,university_id) VALUES (?,?,?,?,?,'student','active',?)")
    .run(sn, hashPasswordSync(sn), name || sn, name || sn, sn, universityId);
  return { id: info.lastInsertRowid, username: sn, student_no: sn, name_fa: name || sn, name_en: name || sn, university_id: universityId, createdBy };
}

function caseTitle(row, forStudent = false) {
  if (!row?.data_json) return {};
  try {
    const cd = JSON.parse(row.data_json);
    // Students get the chief complaint instead of the internal title (which
    // usually names the diagnosis). Staff keep the title for selection.
    if (forStudent) return { chief_fa: cd.chief_fa, chief_en: cd.chief_en, difficulty: row.difficulty, version: row.version };
    return { title_fa: cd.title_fa, title_en: cd.title_en, chief_fa: cd.chief_fa, chief_en: cd.chief_en, difficulty: row.difficulty, version: row.version };
  } catch {
    return { difficulty: row.difficulty, version: row.version };
  }
}
function flashTitle(row) {
  if (!row?.data_json) return {};
  let cd = {}; try { cd = JSON.parse(row.data_json); } catch { /* */ }
  // title_* = the teacher/admin-facing LABEL (never shown to students).
  // q_* = the actual QUESTION shown to students (question text preferred).
  const q_fa = cd.questionText_fa || cd.q_fa || cd.front_fa || cd.title_fa || "";
  const q_en = cd.questionText_en || cd.q_en || cd.front_en || cd.title_en || "";
  return {
    title_fa: cd.title_fa || q_fa, title_en: cd.title_en || q_en,
    q_fa, q_en,
    difficulty: row.difficulty, version: row.version,
  };
}

/* ---- List classes ----
   Teachers/admins see all; students see only their enrolled classes. */
r.get("/", authRequired, (req, res) => {
  try {
  let classes;
  if (req.user.role === "student") {
    classes = db.prepare(
      `SELECT c.* FROM classes c
         JOIN class_members m ON m.class_id = c.id
       WHERE m.user_id=? AND c.active=1 ORDER BY c.id DESC`
    ).all(req.user.id);
  } else if (req.user.role === "teacher") {
    const uni = currentUniversityId(req.user);
    classes = db.prepare("SELECT * FROM classes WHERE active=1 AND university_id=? ORDER BY id DESC").all(uni || -1);
  } else if (req.user.role === "admin") {
    classes = db.prepare("SELECT * FROM classes WHERE active=1 ORDER BY id DESC").all();
  } else if (req.user.role === "learner") {
    return res.status(403).json({ error: "university_only", reason: "university_only", stage: "access" });
  } else {
    return res.status(403).json({ error: "forbidden", stage: "access" });
  }
  const nCasesBy = new Map(), nStudentsBy = new Map();
  forInChunks(classes.map((c) => c.id), (chunk) => {
    const ph = chunk.map(() => "?").join(",");
    for (const r of db.prepare(
      `SELECT cc.class_id, COUNT(*) n FROM class_cases cc JOIN cases c ON c.id = cc.case_id
        WHERE cc.class_id IN (${ph}) AND c.active=1 GROUP BY cc.class_id`
    ).all(...chunk)) nCasesBy.set(r.class_id, r.n);
    for (const r of db.prepare(
      `SELECT class_id, COUNT(*) n FROM class_members WHERE class_id IN (${ph}) GROUP BY class_id`
    ).all(...chunk)) nStudentsBy.set(r.class_id, r.n);
  });
  const out = classes.map((cl) => {
    const nCases = nCasesBy.get(cl.id) || 0;
    const nStudents = nStudentsBy.get(cl.id) || 0;
    const row = { ...cl, nCases, nStudents };
    if (req.user.role === "student") {
      delete row.grading_json;
      delete row.tutor_prompt;
      delete row.code;
    }
    return row;
  });
  res.json(out);
  } catch (e) {
    res.status(500).json({ error: "class_list_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* Inbox of saved virtual-patient chats for teacher/admin validation.
   MUST sit before /:id so "conversations" is not parsed as a class id. */
r.get("/conversations", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  const uni = req.user.role === "teacher" ? (currentUniversityId(req.user) || -1) : null;
  const rows = uni
    ? db.prepare(
      `SELECT a.id, a.user_id, a.case_id, a.class_id, a.score, a.created_at, a.duration_sec,
              a.turns, a.tests, a.imaging_count, a.ddx_count,
              (a.transcript_json IS NOT NULL AND a.transcript_json != '') AS has_transcript,
              u.name_fa, u.name_en, u.student_no,
              c.name_fa AS class_fa, c.name_en AS class_en, c.code,
              cs.data_json
         FROM attempts a
         JOIN classes c ON c.id = a.class_id
         JOIN users u ON u.id = a.user_id
         LEFT JOIN cases cs ON cs.id = a.case_id
        WHERE a.type='vp' AND c.university_id=? AND c.active=1
        ORDER BY a.id DESC LIMIT 250`
    ).all(uni)
    : db.prepare(
      `SELECT a.id, a.user_id, a.case_id, a.class_id, a.score, a.created_at, a.duration_sec,
              a.turns, a.tests, a.imaging_count, a.ddx_count,
              (a.transcript_json IS NOT NULL AND a.transcript_json != '') AS has_transcript,
              u.name_fa, u.name_en, u.student_no,
              c.name_fa AS class_fa, c.name_en AS class_en, c.code,
              cs.data_json
         FROM attempts a
         JOIN classes c ON c.id = a.class_id
         JOIN users u ON u.id = a.user_id
         LEFT JOIN cases cs ON cs.id = a.case_id
        WHERE a.type='vp' AND c.active=1
        ORDER BY a.id DESC LIMIT 250`
    ).all();
  const attempts = rows.map((row) => {
    let title_fa = "", title_en = "";
    try { const cd = row.data_json ? JSON.parse(row.data_json) : {}; title_fa = cd.title_fa || ""; title_en = cd.title_en || ""; } catch { /* */ }
    return {
      id: row.id, user_id: row.user_id, case_id: row.case_id, class_id: row.class_id,
      score: row.score, created_at: row.created_at, duration_sec: row.duration_sec,
      turns: row.turns, tests: row.tests, imaging: row.imaging_count, ddx: row.ddx_count,
      has_transcript: !!row.has_transcript,
      name_fa: row.name_fa, name_en: row.name_en, student_no: row.student_no,
      class_fa: row.class_fa, class_en: row.class_en, code: row.code,
      title_fa, title_en,
    };
  });
  res.json({ attempts });
  } catch (e) {
    res.status(500).json({ error: "conversations_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* Drawing coverage assist: load the authored drawing card (with optional
   expected zones) and compute the advisory coverage/IoU metrics. The result
   is ONLY displayed to the reviewer; scoring stays a human decision. */
const drawingCardCache = new Map();
function drawingCardFor(cardId) {
  const key = cardId == null ? "" : String(cardId);
  if (drawingCardCache.has(key)) return drawingCardCache.get(key);
  let card = null;
  if (cardId != null) {
    const row = db.prepare("SELECT data_json FROM flashcards WHERE id=?").get(cardId);
    try { card = row ? JSON.parse(row.data_json) : null; } catch { card = null; }
  }
  drawingCardCache.set(key, card);
  return card;
}
function assistFor(ans) {
  try {
    const card = drawingCardFor(ans.card_id) || {};
    const enabled = drawingAssistEnabled(card.drawing || {});
    return assessDrawing(ans.drawing, card.drawing || {}, {
      proposedPoints: ans.proposedPoints || 100,
      minStrokes: card.drawing?.minStrokes || 1,
      enabled,
    });
  } catch { return null; }
}
/* Zones are part of the assist feature: hide them entirely when the teacher
   (or the admin's global flag) has the assist switched off. */
function zonesFor(ans) {
  const d = drawingCardFor(ans.card_id)?.drawing || null;
  return d && drawingAssistEnabled(d) ? (d.zones || []) : [];
}

/* Inbox of student drawings awaiting teacher approve/reject.
   MUST sit before /:id so "drawing-inbox" is not parsed as a class id. */
r.get("/drawing-inbox", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const uni = req.user.role === "teacher" ? (currentUniversityId(req.user) || -1) : null;
  const classes = uni
    ? db.prepare("SELECT id, name_fa, name_en, code FROM classes WHERE university_id=? AND active=1").all(uni)
    : db.prepare("SELECT id, name_fa, name_en, code FROM classes WHERE active=1").all();
  const parseLocal = (s, fb) => { try { return JSON.parse(s || ""); } catch { return fb; } };
  const statusOf = (ans) => ans?.drawing?.approval?.status || (ans?.pendingApproval ? "pending" : "none");
  const reviews = [];
  const byClass = new Map(classes.map((c) => [c.id, c]));
  const attemptRows = [];
  forInChunks(classes.map((c) => c.id), (chunk) => {
    const ph = chunk.map(() => "?").join(",");
    attemptRows.push(...db.prepare(`SELECT a.*,u.name_fa,u.name_en,u.student_no FROM class_flashcard_attempts a LEFT JOIN users u ON u.id=a.user_id WHERE a.class_id IN (${ph}) ORDER BY a.id DESC`).all(...chunk));
  });
  attemptRows.sort((a, b) => (b.id || 0) - (a.id || 0));
  const perClass = new Map();
  for (const row of attemptRows) {
    const n = perClass.get(row.class_id) || 0;
    if (n >= 200) continue;
    perClass.set(row.class_id, n + 1);
    const cl = byClass.get(row.class_id);
    if (!cl) continue;
    const answers = parseLocal(row.answers_json, []);
    (Array.isArray(answers) ? answers : []).forEach((ans, idx) => {
      if (ans?.type === "drawing" && ans.drawing?.preview) {
        reviews.push({
          source: "class", attemptId: row.id, answerIndex: idx, classId: cl.id,
          class_fa: cl.name_fa, class_en: cl.name_en, code: cl.code,
          card_id: ans.card_id, order: ans.order,
          student: { id: row.user_id, name_fa: row.name_fa, name_en: row.name_en, student_no: row.student_no },
          score: row.score, question_fa: ans.question_fa, question_en: ans.question_en,
          proposedPoints: ans.proposedPoints || 0, points: ans.points || 0,
          status: statusOf(ans), drawing: ans.drawing, created_at: row.created_at,
          zones: zonesFor(ans), assist: assistFor(ans),
        });
      }
    });
  }
  reviews.sort((a, b) => {
    const rank = (s) => (s === "pending" || s === "none" ? 0 : 1);
    return rank(a.status) - rank(b.status) || (b.attemptId - a.attemptId);
  });
  res.json({ reviews });
});

/* ---- Class detail (cases + members + per-student grade) ---- */
r.get("/:id", authRequired, (req, res) => {
  try {
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id);
  if (!cl) return res.status(404).json({ error: "not found", stage: "boot" });
  if (req.user.role === "teacher" && cl.university_id !== currentUniversityId(req.user)) return res.status(403).json({ error: "wrong_university", stage: "access" });
  if (req.user.role === "learner") {
    return res.status(403).json({ error: "university_only", reason: "university_only", stage: "access" });
  }

  // student must be a member of an ACTIVE class (deactivated classes disappear
  // from the list; loading by id must not still offer start buttons).
  if (req.user.role === "student") {
    if (!cl.active) return res.status(404).json({ error: "not found", stage: "boot" });
    const mem = db.prepare("SELECT 1 FROM class_members WHERE class_id=? AND user_id=?").get(cl.id, req.user.id);
    if (!mem) return res.status(403).json({ error: "not enrolled", stage: "access" });
  }

  const allCases = db.prepare(
    `SELECT cc.case_id, cc.weight, c.data_json, c.difficulty, c.version, c.active
       FROM class_cases cc JOIN cases c ON c.id = cc.case_id
     WHERE cc.class_id=?`
  ).all(cl.id)
    .filter((row) => !isLearnContent(row.data_json))
    .map((row) => ({ case_id: row.case_id, weight: row.weight, active: !!row.active, ...caseTitle(row, req.user.role === "student") }));
  // Students must not see (or be graded against) a case the teacher deactivated.
  // Staff still see it so they know why the student cannot start.
  const cases = req.user.role === "student" ? allCases.filter((c) => c.active) : allCases;
  // Grade both views on ACTIVE cases only. Including a deactivated case in the
  // teacher's denominator made the gradebook disagree with what the student saw.
  const gradeCases = allCases.filter((c) => c.active);

  // Flashcard sets attached to the class (graded or practice-only).
  const allFlash = db.prepare(
    `SELECT cf.flashcard_id, cf.weight, cf.graded, f.data_json, f.difficulty, f.version, f.active
       FROM class_flashcards cf JOIN flashcards f ON f.id = cf.flashcard_id
     WHERE cf.class_id=?`
  ).all(cl.id)
    .filter((row) => !isLearnContent(row.data_json))
    .map((row) => ({ flashcard_id: row.flashcard_id, weight: row.weight, graded: row.graded, active: !!row.active, ...flashTitle(row) }));
  const flashcards = req.user.role === "student" ? allFlash.filter((f) => f.active) : allFlash;
  const gradeFlash = allFlash.filter((f) => f.active);

  // Best attempt per case for grade calculation (two queries for the whole class)
  const caseBestMap = new Map();
  for (const r of db.prepare("SELECT user_id, case_id, MAX(score) s FROM attempts WHERE class_id=? GROUP BY user_id, case_id").all(cl.id)) {
    caseBestMap.set(`${r.user_id}:${r.case_id}`, r.s);
  }
  const flashBestMap = new Map();
  for (const r of db.prepare("SELECT user_id, flashcard_id, MAX(score) s FROM class_flashcard_attempts WHERE class_id=? GROUP BY user_id, flashcard_id").all(cl.id)) {
    flashBestMap.set(`${r.user_id}:${r.flashcard_id}`, r.s);
  }
  const bestCase = (userId, caseId) => caseBestMap.get(`${userId}:${caseId}`);
  const bestFlash = (userId, fid) => flashBestMap.get(`${userId}:${fid}`);

  const gradedFlash = gradeFlash.filter((f) => f.graded);

  const computeGrade = (userId) => {
    let sum = 0, wsum = 0, caseDone = 0, flashDone = 0;
    const perCase = gradeCases.map((cc) => {
      const best = bestCase(userId, cc.case_id);
      if (best != null) { sum += best * cc.weight; caseDone++; }
      wsum += cc.weight;
      return { case_id: cc.case_id, best };
    });
    const perFlash = gradeFlash.map((cf) => {
      const best = bestFlash(userId, cf.flashcard_id);
      if (best != null) {
        flashDone++;
        if (cf.graded) { sum += best * cf.weight; }
      }
      if (cf.graded) wsum += cf.weight;   // only graded flashcards affect the grade
      return { flashcard_id: cf.flashcard_id, best, graded: !!cf.graded };
    });
    const grade = wsum ? Math.round(sum / wsum) : 0;
    return { grade, doneCount: caseDone + flashDone, caseDone, totalCases: gradeCases.length,
             flashDone, totalFlash: gradeFlash.length, gradedFlash: gradedFlash.length, perCase, perFlash };
  };

  if (req.user.role === "student") {
    const g = computeGrade(req.user.id);
    const usedCase = new Map();
    for (const r of db.prepare("SELECT case_id, COUNT(*) n FROM attempts WHERE user_id=? AND class_id=? GROUP BY case_id").all(req.user.id, cl.id)) usedCase.set(r.case_id, r.n);
    const usedFlash = new Map();
    for (const r of db.prepare("SELECT flashcard_id, COUNT(*) n FROM class_flashcard_attempts WHERE user_id=? AND class_id=? GROUP BY flashcard_id").all(req.user.id, cl.id)) usedFlash.set(r.flashcard_id, r.n);
    const withUsage = cases.map((cc) => {
      const used = usedCase.get(cc.case_id) || 0;
      const best = g.perCase.find((p) => p.case_id === cc.case_id)?.best;
      return { ...cc, attemptsUsed: used, best };
    });
    const flashUsage = flashcards.map((cf) => {
      const used = usedFlash.get(cf.flashcard_id) || 0;
      const best = g.perFlash.find((p) => p.flashcard_id === cf.flashcard_id)?.best;
      return { ...cf, attemptsUsed: used, best };
    });
    return res.json({ class: decorateClass(cl, { forStudent: true }), cases: withUsage, flashcards: flashUsage, grade: g.grade,
                      doneCount: g.doneCount, maxAttempts: cl.max_attempts });
  }

  if (req.user.role !== "teacher" && req.user.role !== "admin") {
    return res.status(403).json({ error: "forbidden", stage: "access" });
  }

  // teacher/admin view: members with grades + usage detail
  const members = db.prepare(
    `SELECT u.id,u.name_fa,u.name_en,u.student_no
       FROM class_members m JOIN users u ON u.id=m.user_id
     WHERE m.class_id=? ORDER BY u.id`
  ).all(cl.id).map((u) => ({ ...u, ...computeGrade(u.id) }));

  res.json({ class: decorateClass(cl), cases, flashcards, members });
  } catch (e) {
    res.status(500).json({ error: "class_load_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Create class ---- */
const GRADING_ROLES = ["history", "overall", "both"];
/* A class may be enrolled in a research study, which is what makes consent
   enforceable for it. Returns the study id only when the study really exists. */
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
const HISTORY_FORMS = ["general", "internal", "obgyn", "cardio", "peds", "psych"];
r.post("/", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const { name_fa, name_en, desc_fa, desc_en, maxAttempts = 1, gradingRole = "both",
          historyForm = "general", logTranscript, studyId = null, gradingRubric = null } = req.body || {};
  let code = genCode();
  for (let i = 0; i < 5; i++) {
    const exists = db.prepare("SELECT 1 FROM classes WHERE code=?").get(code);
    if (!exists) break; code = genCode();
  }
  const role = GRADING_ROLES.includes(gradingRole) ? gradingRole : "both";
  const hform = HISTORY_FORMS.includes(historyForm) ? historyForm : "general";
  const study = resolveStudyId(studyId);
  if (studyId && !study) return res.status(400).json({ error: "study_not_found" });
  if (study && req.user.role === "teacher" && !teacherMayAttachStudy(req.user, study)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  const uni = currentUniversityId(req.user) || Number(req.body?.university_id || 0) || 1;
  if (req.user.role === "teacher" && !uni) return res.status(400).json({ error: "university_required", message_fa: "برای استاد انتخاب دانشگاه الزامی است." });
  const gradingJson = gradingRubric ? JSON.stringify(normalizeRubric(gradingRubric)) : null;
  // Educational review is ON by default so the teacher can validate the chat.
  // Send logTranscript:false to keep a class private.
  const logOn = !(logTranscript === false || logTranscript === 0 || logTranscript === "0");
  const info = db.prepare(
    `INSERT INTO classes (name_fa,name_en,desc_fa,desc_en,code,owner_id,max_attempts,grading_role,history_form,university_id,log_transcript,study_id,grading_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(name_fa, name_en, desc_fa, desc_en, code, req.user.id, maxAttempts, role, hform, uni,
        logOn ? 1 : 0, study, gradingJson);
  audit(req, "class.create", "class", { id: info.lastInsertRowid, log_transcript: logOn, study_id: study });
  persistNow();
  res.json({ id: info.lastInsertRowid, code, logTranscript: logOn, studyId: study });
});

/* ---- Update class basic info ---- */
r.put("/:id", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const { name_fa, name_en, desc_fa, desc_en, maxAttempts, gradingRole, historyForm,
          liveBoardEnabled, liveBoardAnonymous, logTranscript, studyId, gradingRubric,
          flashNoPenalty, liveBoardSpeed } = req.body || {};
  const cur = db.prepare("SELECT grading_role, history_form, university_id, live_board_enabled, live_board_anonymous, log_transcript, study_id, grading_json, flash_no_penalty, live_board_speed FROM classes WHERE id=?").get(req.params.id);
  if (!cur) return res.status(404).json({ error: "not found" });
  if (req.user.role === "teacher" && cur.university_id !== currentUniversityId(req.user)) return res.status(403).json({ error: "wrong_university" });
  const role = GRADING_ROLES.includes(gradingRole) ? gradingRole : (cur?.grading_role || "both");
  const hform = HISTORY_FORMS.includes(historyForm) ? historyForm : (cur?.history_form || "general");
  /* A field the caller did not send keeps its stored value. The previous
     `liveBoardEnabled === false ? 0 : 1` flipped the live board ON whenever a
     caller omitted the key (e.g. the quick edit modal), which silently
     published the class leaderboard. */
  const liveOn  = liveBoardEnabled  === undefined ? !!cur.live_board_enabled  : !!liveBoardEnabled;
  const liveAnon = liveBoardAnonymous === undefined ? !!cur.live_board_anonymous : !!liveBoardAnonymous;
  const logOn   = logTranscript     === undefined ? !!cur.log_transcript      : logTranscript === true;
  // Enrolling a class in a study is what makes consent enforceable for it.
  if (studyId !== undefined && studyId !== null && studyId !== "" && !resolveStudyId(studyId)) {
    return res.status(400).json({ error: "study_not_found" });
  }
  const study = studyId === undefined ? (cur.study_id || null) : (resolveStudyId(studyId) || null);
  if (studyId !== undefined && study && req.user.role === "teacher" && !teacherMayAttachStudy(req.user, study)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  let gradingJson = cur.grading_json || null;
  if (gradingRubric !== undefined) {
    gradingJson = (gradingRubric === null || gradingRubric === false)
      ? null
      : JSON.stringify(normalizeRubric(gradingRubric));
  }
  // Tri-state class overrides: undefined = keep, "inherit"/null = follow the
  // university (then global) default, true/false/"on"/"off" = forced for this class.
  const npNext  = flashNoPenalty === undefined ? (cur.flash_no_penalty ?? null) : triInput(flashNoPenalty);
  const spdNext = liveBoardSpeed === undefined ? (cur.live_board_speed ?? null) : triInput(liveBoardSpeed);
  db.prepare(
    "UPDATE classes SET name_fa=?,name_en=?,desc_fa=?,desc_en=?,max_attempts=?,grading_role=?,history_form=?,live_board_enabled=?,live_board_anonymous=?,log_transcript=?,study_id=?,grading_json=?,flash_no_penalty=?,live_board_speed=? WHERE id=?"
  ).run(name_fa, name_en, desc_fa, desc_en, maxAttempts ?? 1, role, hform, liveOn ? 1 : 0, liveAnon ? 1 : 0, logOn ? 1 : 0, study, gradingJson, npNext ?? null, spdNext ?? null, req.params.id);
  audit(req, "class.update", "class", { id: Number(req.params.id), log_transcript: logOn, live_board_enabled: liveOn, study_id: study, flash_no_penalty: npNext, live_board_speed: spdNext });
  res.json({ ok: true, logTranscript: logOn, studyId: study, gradingRubric: gradingJson ? JSON.parse(gradingJson) : null,
    flashNoPenalty: npNext, liveBoardSpeed: spdNext });
});
r.delete("/:id", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id);
  if (!cl) return res.status(404).json({ error: "not found", stage: "access" });
  if (req.user.role === "teacher" && cl.university_id !== currentUniversityId(req.user)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  db.prepare("UPDATE classes SET active=0 WHERE id=?").run(req.params.id);
  persistNow();
  res.json({ ok: true });
});

/* ---- Set the class's cases (replace list) ---- */
r.put("/:id/cases", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const { cases = [] } = req.body || {}; // [{case_id, weight}]
  const cid = req.params.id;
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(cid);
  if (!cl) return res.status(404).json({ error: "not_found" });
  if (req.user.role === "teacher" && cl.university_id !== currentUniversityId(req.user)) return res.status(403).json({ error: "wrong_university" });
  const allowed = cases.filter((c) => {
    const row = db.prepare("SELECT data_json, university_id FROM cases WHERE id=? AND active=1").get(c.case_id);
    if (!row || isLearnContent(row.data_json)) return false;
    // Same-university only (SQL equivalent: COALESCE(university_id,1)).
    return (row.university_id || 1) === (cl.university_id || 1);
  });
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM class_cases WHERE class_id=?").run(cid);
    const ins = db.prepare("INSERT OR IGNORE INTO class_cases (class_id,case_id,weight) VALUES (?,?,?)");
    for (const c of allowed) ins.run(cid, c.case_id, c.weight || 1);
  });
  tx(); persistNow();
  res.json({ ok: true, added: allowed.length, skipped: cases.length - allowed.length });
});

/* ---- Set the class's flashcard sets (replace list) ---- */
r.put("/:id/flashcards", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const { flashcards = [] } = req.body || {}; // [{flashcard_id, weight, graded}]
  const cid = req.params.id;
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(cid);
  if (!cl) return res.status(404).json({ error: "not_found" });
  if (req.user.role === "teacher" && cl.university_id !== currentUniversityId(req.user)) return res.status(403).json({ error: "wrong_university" });
  const allowed = flashcards.filter((f) => {
    const row = db.prepare("SELECT data_json, university_id FROM flashcards WHERE id=? AND active=1").get(f.flashcard_id);
    if (!row || isLearnContent(row.data_json)) return false;
    return (row.university_id || 1) === (cl.university_id || 1);
  });
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM class_flashcards WHERE class_id=?").run(cid);
    const ins = db.prepare("INSERT OR IGNORE INTO class_flashcards (class_id,flashcard_id,weight,graded) VALUES (?,?,?,?)");
    for (const f of allowed) ins.run(cid, f.flashcard_id, f.weight || 1, f.graded === false ? 0 : 1);
  });
  tx();
  persistNow();
  res.json({ ok: true, added: allowed.length, skipped: flashcards.length - allowed.length });
});

/* ---- Student submits a class flashcard-set score (0..100). Best is kept. ---- */
const flashFinishSchema = {
  score: vs.num({ optional: true, min: 0, max: 100, clamp: true }),
  durationSec: vs.num({ optional: true, min: 0, max: 86400, clamp: true }),
  answers: vs.array((x, p) => (x && typeof x === "object" && !Array.isArray(x)
    ? { ok: true, value: x } : { ok: false, error: `${p} must be an object` }), { optional: true, max: 300 }),
};
r.post("/:id/flashcard/:fid/finish", authRequired, requireRole("student"), validateBody(flashFinishSchema), (req, res) => {
  try {
  const cid = parseInt(req.params.id, 10), fid = parseInt(req.params.fid, 10);
  const info = classFlashcardInfo(req.user.id, cid, fid);
  if (!info.allowed) return res.status(403).json({ error: "not allowed", stage: "access" });
  if (info.remaining <= 0) return res.status(429).json({ error: "no attempts left", remaining: 0, stage: "access" });
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const loadFlash = (id) => {
    const row = db.prepare("SELECT * FROM flashcards WHERE id=?").get(id);
    if (!row) return null;
    try { return { ...JSON.parse(row.data_json), id: row.id }; } catch { return null; }
  };
  // Prefer a server-regraded score whenever answer rows are present (anti-cheat:
  // the client score cannot be trusted for graded sets). When the client sends
  // NO answer rows (e.g. card types the server cannot regrade here, or older
  // clients), fall back to its reported score, clamped to 0–100. The attempt
  // keeps an empty answers_json, so an out-of-band score stays visible in the
  // teacher gradebook.
  // No-penalty policy for this deck: class override → university → global.
  const clsRow = db.prepare("SELECT * FROM classes WHERE id=?").get(cid);
  const noPenalty = effectiveFlashNoPenalty(clsRow);
  let score;
  if (answers.length) {
    const deck = gradeSubmittedDeckDetailed(loadFlash, answers, [fid], { noPenalty });
    if (deck.error === "duplicate_card") return res.status(400).json({ error: "duplicate_card", stage: "evaluate" });
    if (deck.error === "answers_out_of_deck") return res.status(400).json({ error: "answers_out_of_deck", stage: "evaluate" });
    score = deck.score == null
      ? Math.max(0, Math.min(100, Number(req.body?.score) || 0))
      : deck.score;
  } else {
    score = Math.max(0, Math.min(100, Number(req.body?.score) || 0));
  }
  const durationSec = Math.max(0, Math.min(24 * 3600, Number(req.body?.durationSec || 0) || 0));
  db.prepare("INSERT INTO class_flashcard_attempts (class_id,flashcard_id,user_id,score,answers_json,duration_sec) VALUES (?,?,?,?,?,?)")
    .run(cid, fid, req.user.id, score, JSON.stringify(answers), durationSec);
  persistNow();
  const studyId = studyIdForClass(cid);
  if (studyId) {
    recordStudyEvent({
      studyId, userId: req.user.id, eventType: "flashcard_finished",
      contextType: "class", contextId: cid,
      data: { flashcardId: fid, score, type: "flash" },
    });
  }
  res.json({ ok: true, score, noPenalty });
  } catch (e) {
    res.status(500).json({ error: "class_flashcard_finish_failed", stage: "evaluate", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Deck play config for the student: only what the UI needs to know
   BEFORE starting (no answers here). `noPenalty` tells the client whether
   hints / wrong stage attempts deduct points for this class. ---- */
r.get("/:id/flashcard/:fid/config", authRequired, requireRole("student"), (req, res) => {
  const cid = parseInt(req.params.id, 10), fid = parseInt(req.params.fid, 10);
  const info = classFlashcardInfo(req.user.id, cid, fid);
  if (!info.allowed) return res.status(403).json({ error: "not allowed", stage: "access" });
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(cid);
  res.json({ noPenalty: effectiveFlashNoPenalty(cl) });
});

/* ---- Set the class's members (replace list) ---- */
r.put("/:id/members", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const { userIds = [] } = req.body || {};
  const cid = req.params.id;
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(cid);
  if (!cl) return res.status(404).json({ error: "not_found" });
  if (req.user.role === "teacher" && cl.university_id !== currentUniversityId(req.user)) return res.status(403).json({ error: "wrong_university" });
  const allowed = userIds.filter((uid) => db.prepare("SELECT 1 FROM users WHERE id=? AND role='student' AND university_id=?").get(uid, cl.university_id));
  const skipped = userIds.length - allowed.length;
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM class_members WHERE class_id=?").run(cid);
    const ins = db.prepare("INSERT OR IGNORE INTO class_members (class_id,user_id) VALUES (?,?)");
    for (const uid of allowed) ins.run(cid, uid);
  });
  tx();
  persistNow();
  res.json({ ok: true, added: allowed.length, skipped });
});

r.post("/:id/members/resolve", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id);
  if (!cl) return res.status(404).json({ error: "not_found" });
  if (req.user.role === "teacher" && cl.university_id !== currentUniversityId(req.user)) return res.status(403).json({ error: "wrong_university" });
  const raw = Array.isArray(req.body?.studentNos) ? req.body.studentNos : String(req.body?.studentNos || "").split(/[\s,;]+/);
  const names = req.body?.names || {};
  const createMissing = !!req.body?.createMissing;
  const existing = [], missing = [], wrongUniversity = [], created = [], limitBlocked = [];
  let studentLimit = null;
  for (const x of raw.map((v) => String(v).trim()).filter(Boolean)) {
    let u = studentByNo(x);
    if (!u && createMissing) {
      // Licence: a full university can't mint more students — say so explicitly
      // instead of silently listing them as "not found".
      const lim = checkStudentLimit(cl.university_id, 1);
      if (lim) { studentLimit = lim; limitBlocked.push({ student_no: x }); continue; }
      u = createStudentForUniversity({ sno: x, name: names[x] || x, universityId: cl.university_id, createdBy: req.user.id });
      if (u) created.push(u);
    }
    if (!u) { missing.push(x); continue; }
    if (u.university_id !== cl.university_id) { wrongUniversity.push({ student_no: x, existing: u }); continue; }
    existing.push(u);
  }
  const unique = [...new Map(existing.map((u) => [u.id, u])).values()];
  if (req.body?.attach !== false) {
    const ins = db.prepare("INSERT OR IGNORE INTO class_members (class_id,user_id) VALUES (?,?)");
    for (const u of unique) ins.run(cl.id, u.id);
    persistNow();
  }
  res.json({ existing: unique, missing, wrongUniversity, created, attached: req.body?.attach === false ? 0 : unique.length,
             limitBlocked, studentLimit });
});

const parseJson = (s, fb) => { try { return JSON.parse(s || ""); } catch { return fb; } };
function drawingStatus(ans) { return ans?.drawing?.approval?.status || (ans?.pendingApproval ? "pending" : "none"); }
r.get("/:id/drawing-reviews", authRequired, requireRole("teacher", "admin"), (req,res)=>{
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id); if(!cl) return res.status(404).json({error:"not_found"});
  if (req.user.role === "teacher" && cl.university_id !== currentUniversityId(req.user)) return res.status(403).json({ error: "wrong_university" });
  const rows = db.prepare(`SELECT a.*,u.name_fa,u.name_en,u.student_no FROM class_flashcard_attempts a LEFT JOIN users u ON u.id=a.user_id WHERE a.class_id=? ORDER BY a.id DESC`).all(cl.id);
  const reviews=[];
  for(const row of rows){ const answers=parseJson(row.answers_json,[]); (Array.isArray(answers)?answers:[]).forEach((ans,idx)=>{ if(ans?.type==='drawing' && ans.drawing?.preview) reviews.push({source:'class', attemptId:row.id, answerIndex:idx, classId:cl.id, card_id:ans.card_id, order:ans.order, student:{id:row.user_id,name_fa:row.name_fa,name_en:row.name_en,student_no:row.student_no}, score:row.score, question_fa:ans.question_fa, question_en:ans.question_en, proposedPoints:ans.proposedPoints||0, points:ans.points||0, status:drawingStatus(ans), drawing:ans.drawing, created_at:row.created_at, zones:(()=>{const d=drawingCardFor(ans.card_id)?.drawing; return d&&drawingAssistEnabled(d)?(d.zones||[]):[];})(), assist:assistFor(ans)}); }); }
  res.json({ reviews });
});
const drawingReviewSchema = {
  status: vs.oneOf(["approved", "rejected"]),
  feedback: vs.str({ optional: true, max: 2000 }),
  points: vs.num({ optional: true, min: 0, max: 100 }),
};
r.post("/:id/drawing-reviews/:attemptId/:answerIndex", authRequired, requireRole("teacher", "admin"), validateBody(drawingReviewSchema), (req,res)=>{
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id); if(!cl) return res.status(404).json({error:"not_found"});
  if (req.user.role === "teacher" && cl.university_id !== currentUniversityId(req.user)) return res.status(403).json({ error: "wrong_university" });
  const at=db.prepare("SELECT * FROM class_flashcard_attempts WHERE id=? AND class_id=?").get(req.params.attemptId, cl.id); if(!at) return res.status(404).json({error:"attempt_not_found"});
  const answers=parseJson(at.answers_json,[]); const idx=Number(req.params.answerIndex), ans=answers[idx]; if(!ans||ans.type!=="drawing") return res.status(404).json({error:"drawing_not_found"});
  const prev=Number(ans.points||0), proposed=Math.max(0, Number(req.body?.points ?? ans.proposedPoints ?? (ans.drawing?.pointsFrac ?? 0) * 100)||0);
  const status=req.body?.status === "approved" ? "approved" : "rejected";
  ans.points=status==='approved'?proposed:0; ans.solved=status==='approved'; ans.pendingApproval=false; ans.drawing={...(ans.drawing||{}), approval:{status, feedback:req.body?.feedback||"", reviewer_id:req.user.id, reviewed_at:new Date().toISOString(), points:ans.points}}; answers[idx]=ans;
  const newScore=Math.max(0, Math.min(100, Math.round((Number(at.score)||0)-prev+Number(ans.points||0))));
  db.prepare("UPDATE class_flashcard_attempts SET score=?, answers_json=? WHERE id=?").run(newScore, JSON.stringify(answers), at.id);
  persistNow(); res.json({ok:true, score:newScore, review:ans.drawing.approval});
});


function pct(n, d) { return d ? Math.round((Number(n || 0) / Number(d || 1)) * 100) : 0; }
function addAgg(map, key, label_fa, label_en, score, total = 100) {
  if (!key) return;
  const it = map[key] ||= { key, label_fa: label_fa || key, label_en: label_en || label_fa || key, sum: 0, total: 0, n: 0 };
  it.sum += Number(score || 0); it.total += Number(total || 100); it.n++;
}
function aggRows(map) { return Object.values(map).map((x) => ({ ...x, avg: pct(x.sum, x.total) })).sort((a, b) => a.avg - b.avg); }
function parseSafe(s, fb) { try { return JSON.parse(s || ""); } catch { return fb; } }
function classAnalyticsPayload(cl, { allItems = false } = {}) {
  const members = db.prepare(`SELECT u.id,u.name_fa,u.name_en,u.student_no FROM class_members m JOIN users u ON u.id=m.user_id WHERE m.class_id=?`).all(cl.id);
  const byStudent = [];
  const topicAgg = {}, itemAgg = {}, criterionAgg = {};
  const ia = createItemAnalysis();
  let totalAttempts = 0, pendingDrawings = 0;
  const vpBy = new Map(), flBy = new Map();
  for (const a of db.prepare("SELECT * FROM attempts WHERE class_id=? AND type='vp'").all(cl.id)) {
    const arr = vpBy.get(a.user_id); if (arr) arr.push(a); else vpBy.set(a.user_id, [a]);
  }
  for (const a of db.prepare("SELECT a.*, f.data_json FROM class_flashcard_attempts a LEFT JOIN flashcards f ON f.id=a.flashcard_id WHERE a.class_id=?").all(cl.id)) {
    const arr = flBy.get(a.user_id); if (arr) arr.push(a); else flBy.set(a.user_id, [a]);
  }
  for (const u of members) {
    const vp = vpBy.get(u.id) || [];
    const fl = flBy.get(u.id) || [];
    totalAttempts += vp.length + fl.length;
    const scores = [];
    for (const a of vp) {
      iaTrend(ia, a.created_at, a.score);
      scores.push(Number(a.score || 0));
      const ev = parseSafe(a.eval_json, {});
      if (ev.sectionScores) {
        for (const [k, v] of Object.entries(ev.sectionScores)) addAgg(criterionAgg, `vp:${k}`, k, k, v, 100);
      }
      if (Array.isArray(ev.results)) for (const r of ev.results) addAgg(criterionAgg, `crit:${r.label || r.id}`, r.label || r.id, r.label || r.id, r.done ? 100 : 0, 100);
    }
    for (const a of fl) {
      scores.push(Number(a.score || 0));
      iaTrend(ia, a.created_at, a.score);
      const card = parseSafe(a.data_json, {});
      const answers = parseSafe(a.answers_json, []);
      for (const ans of (Array.isArray(answers) ? answers : [])) {
        const topic = ans.category_fa || ans.title_fa || card.category_fa || card.title_fa || "فلش‌کارت";
        const label = ans.question_fa || ans.title_fa || topic;
        const labelEn = ans.question_en || ans.title_en || ans.category_en || topic;
        addAgg(topicAgg, topic, topic, ans.category_en || card.category_en || topic, ans.points || 0, ans.proposedPoints || 100);
        const itemKey = `card:${ans.card_id || a.flashcard_id}:${ans.order || 0}`;
        addAgg(itemAgg, itemKey, label, labelEn, ans.points || 0, ans.proposedPoints || 100);
        if (ans.pendingApproval || ans.drawing?.approval?.status === 'pending') pendingDrawings++;
        const { hints, ms } = answerTelemetry(ans);
        const proposed = Number(ans.proposedPoints || 100);
        const fraction = proposed > 0 ? Number(ans.points || 0) / proposed : 0;
        iaAdd(ia, {
          studentId: u.id, itemKey, topic,
          label_fa: label, label_en: labelEn,
          fraction, solved: !!ans.solved, hints, ms,
          createdAt: a.created_at, score: a.score,
        });
      }
    }
    const avg = scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null;
    byStudent.push({ ...u, attempts: scores.length, avg });
  }
  const topics = aggRows(topicAgg), itemsAggRows = aggRows(itemAgg), criteria = aggRows(criterionAgg);
  const students = byStudent.sort((a,b)=>(a.avg ?? -1)-(b.avg ?? -1));
  const finished = finishItemAnalysis(ia, byStudent);
  // join classical aggregates (sum/total over ALL answers) with psychometric rows
  const byKey = new Map(finished.items.map((x) => [x.key, x]));
  const items = itemsAggRows.map((x) => ({ ...x, ...(byKey.get(x.key) || {}) }))
    .map((x) => ({ ...x, avg: x.avgPct ?? x.avg, avgHints: x.avgHints ?? 0 }));
  const topicHintsMap = {};
  for (const it of finished.items) {
    const t = it.topic || "—";
    const b = topicHintsMap[t] || (topicHintsMap[t] = { key: t, label_fa: t, label_en: t, hints: 0, n: 0 });
    b.hints += it.avgHints * it.n; b.n += it.n;
  }
  const hintHeavyTopics = Object.values(topicHintsMap)
    .map((x) => ({ ...x, avgHints: x.n ? +(x.hints / x.n).toFixed(2) : 0, answers: x.n }))
    .sort((a, b) => b.avgHints - a.avgHints).slice(0, 8);
  const supportNeeded = finished.studentCtx.size ? students
    .filter((s) => finished.studentCtx.has(s.id))
    .map((s) => ({ ...s, ...finished.studentCtx.get(s.id) })).slice(0, 10)
    : students.filter((s) => s.avg != null && s.avg < 70).slice(0, 10);
  return {
    class: { id: cl.id, name_fa: cl.name_fa, name_en: cl.name_en, code: cl.code },
    summary: { students: members.length, attempts: totalAttempts, pendingDrawings, ...finished.summary },
    strengths: topics.filter((x) => x.avg >= 75).sort((a,b)=>b.avg-a.avg).slice(0, 8),
    weaknesses: topics.filter((x) => x.avg < 70).slice(0, 8),
    itemWeaknesses: items.slice(0, 12),
    slowItems: items.filter((x) => x.avgSec != null).sort((a, b) => (b.avgSec || 0) - (a.avgSec || 0)).slice(0, 10),
    hardItems: items.filter((x) => x.hard).sort((a, b) => a.facility - b.facility).slice(0, 10),
    poorDiscriminationItems: items.filter((x) => x.poorDiscrimination).slice(0, 10),
    hintEffectiveness: items.filter((x) => x.withHintSuccess != null && x.noHintSuccess != null)
      .map((x) => ({ key: x.key, label_fa: x.label_fa, label_en: x.label_en,
        noHintSuccess: x.noHintSuccess, withHintSuccess: x.withHintSuccess,
        gain: x.withHintSuccess - x.noHintSuccess }))
      .sort((a, b) => b.gain - a.gain).slice(0, 10),
    items: allItems ? items.sort((a, b) => a.facility - b.facility) : undefined,
    hintHeavyTopics,
    criterionWeaknesses: criteria.slice(0, 12),
    trend: finished.trend,
    supportNeeded,
    topStudents: [...byStudent].filter((s)=>s.avg!=null).sort((a,b)=>b.avg-a.avg).slice(0, 10),
  };
}
r.get("/:id/analytics", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id);
  if (!cl) return res.status(404).json({ error: "not_found" });
  if (req.user.role === "teacher" && cl.university_id !== currentUniversityId(req.user)) return res.status(403).json({ error: "wrong_university" });
  res.json(classAnalyticsPayload(cl));
});

/* Classical item-analysis CSV: facility P, discrimination D, hint usage,
   response time and hint effectiveness per question — for departmental
   item-bank review meetings. */
r.get("/:id/analytics.csv", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
    const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id);
    if (!cl) return res.status(404).json({ error: "not_found" });
    if (req.user.role === "teacher" && cl.university_id !== currentUniversityId(req.user)) {
      return res.status(403).json({ error: "wrong_university" });
    }
    const fa = (req.query.lang || "fa") !== "en";
    const payload = classAnalyticsPayload(cl, { allItems: true });
    const merged = payload.items;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="item-analysis-${safeFilename(cl.code, String(cl.id))}.csv"`);
    res.send("﻿" + itemAnalysisCsv(merged, fa));
  } catch (e) {
    res.status(500).json({ error: "item_analysis_failed", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Teacher/admin: review a student's attempts in this class, INCLUDING the
   full AI conversation transcript + the section-by-section evaluation, so they
   can verify the AI's scoring and the student's history-taking. ---- */
function canManageClass(user, cl) {
  if (!cl) return false;
  if (user.role === "admin") return true;
  if (user.role !== "teacher") return false;
  // Same-university teachers with class access can review transcripts and
  // export logs — owner-only was blocking co-teachers from giving feedback.
  const uni = currentUniversityId(user);
  if (uni && cl.university_id === uni) return true;
  return cl.owner_id === user.id;
}

/* ---- Teacher display: live classroom competition board.
   Poll-friendly (no WebSocket dependency): teacher opens this on the projector;
   the client refreshes every few seconds. Optional anonymization protects
   students when the board is shown publicly. */
r.get("/:id/live-board", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id);
  if (!cl) return res.status(404).json({ error: "not found", stage: "class" });
  if (!canManageClass(req.user, cl)) return res.status(403).json({ error: "not your class", stage: "access" });

  const members = db.prepare(`SELECT u.id,u.name_fa,u.name_en,u.student_no
    FROM class_members m JOIN users u ON u.id=m.user_id WHERE m.class_id=?`).all(cl.id);
  const caseCount = db.prepare(
    `SELECT COUNT(*) n FROM class_cases cc JOIN cases c ON c.id = cc.case_id WHERE cc.class_id=? AND c.active=1`
  ).get(cl.id).n;
  const flashCount = db.prepare(
    `SELECT COUNT(*) n FROM class_flashcards cf JOIN flashcards f ON f.id = cf.flashcard_id WHERE cf.class_id=? AND f.active=1`
  ).get(cl.id).n;
  const cases = db.prepare(
    `SELECT cc.case_id, cc.weight FROM class_cases cc JOIN cases c ON c.id = cc.case_id
      WHERE cc.class_id=? AND c.active=1`
  ).all(cl.id);
  const flashes = db.prepare(
    `SELECT cf.flashcard_id, cf.weight, cf.graded FROM class_flashcards cf JOIN flashcards f ON f.id = cf.flashcard_id
      WHERE cf.class_id=? AND f.active=1`
  ).all(cl.id);
  const caseBest = new Map();
  for (const r of db.prepare(
    `SELECT user_id, case_id, MAX(score) best FROM attempts WHERE class_id=? AND type='vp' GROUP BY user_id, case_id`
  ).all(cl.id)) caseBest.set(`${r.user_id}:${r.case_id}`, r.best);
  const flashBest = new Map();
  for (const r of db.prepare(
    `SELECT user_id, flashcard_id, MAX(score) best FROM class_flashcard_attempts WHERE class_id=? GROUP BY user_id, flashcard_id`
  ).all(cl.id)) flashBest.set(`${r.user_id}:${r.flashcard_id}`, r.best);
  /* Duration of each user's BEST attempt per item (ties inside the best score
     take the fastest attempt). Summed per user this gives "total mastery
     time", the tie-break the admin/teacher can enable for the leader board. */
  const flashTime = new Map();
  for (const r of db.prepare(
    `SELECT user_id, flashcard_id, duration_sec FROM (
       SELECT user_id, flashcard_id, duration_sec,
              ROW_NUMBER() OVER (PARTITION BY user_id, flashcard_id ORDER BY score DESC, duration_sec ASC, id ASC) rn
       FROM class_flashcard_attempts WHERE class_id=?
     ) WHERE rn=1`
  ).all(cl.id)) flashTime.set(`${r.user_id}:${r.flashcard_id}`, r.duration_sec || 0);
  const caseTime = new Map();
  for (const r of db.prepare(
    `SELECT user_id, case_id, duration_sec FROM (
       SELECT user_id, case_id, duration_sec,
              ROW_NUMBER() OVER (PARTITION BY user_id, case_id ORDER BY score DESC, duration_sec ASC, id ASC) rn
       FROM attempts WHERE class_id=? AND type='vp'
     ) WHERE rn=1`
  ).all(cl.id)) caseTime.set(`${r.user_id}:${r.case_id}`, r.duration_sec || 0);
  const latestByUser = new Map();
  for (const r of db.prepare(
    `SELECT user_id, created_at, score, kind FROM (
      SELECT user_id, created_at, score, 'case' kind FROM attempts WHERE class_id=?
      UNION ALL
      SELECT user_id, created_at, score, 'flashcard' kind FROM class_flashcard_attempts WHERE class_id=?
    ) ORDER BY created_at DESC`
  ).all(cl.id, cl.id)) {
    if (!latestByUser.has(r.user_id)) latestByUser.set(r.user_id, r);
  }
  const anonymize = !!cl.live_board_anonymous || req.query.anon === "1";
  const alias = (i) => `MED-${String(i + 1).padStart(2, "0")}`;
  const speedTiebreak = effectiveLiveBoardSpeed(cl);

  const rows = members.map((u, i) => {
    let sum = 0, wsum = 0, done = 0, timeSec = 0;
    for (const cc of cases) {
      const best = caseBest.get(`${u.id}:${cc.case_id}`);
      if (best != null) { sum += Number(best) * (cc.weight || 1); done++; timeSec += caseTime.get(`${u.id}:${cc.case_id}`) || 0; }
      wsum += cc.weight || 1;
    }
    for (const cf of flashes) {
      const best = flashBest.get(`${u.id}:${cf.flashcard_id}`);
      if (best != null) {
        done++;
        if (cf.graded) sum += Number(best) * (cf.weight || 1);
        timeSec += flashTime.get(`${u.id}:${cf.flashcard_id}`) || 0;
      }
      if (cf.graded) wsum += cf.weight || 1;
    }
    const total = caseCount + flashCount;
    const score = done ? (wsum ? Math.round(sum / wsum) : 0) : null;
    const grade = score == null ? 0 : score;
    const latest = latestByUser.get(u.id) || null;
    return {
      user_id: u.id,
      displayName: anonymize ? alias(i) : (u.name_fa || u.name_en || alias(i)),
      name_fa: anonymize ? alias(i) : u.name_fa,
      name_en: anonymize ? alias(i) : u.name_en,
      student_no: anonymize ? "" : u.student_no,
      done, total, progress: total ? Math.round((done / total) * 100) : 0,
      // Students with nothing done must never win a "less time" tie-break.
      timeSec: done ? timeSec : null,
      score, grade, latest,
    };
  }).sort((a, b) => (b.grade - a.grade)
      || (speedTiebreak ? ((a.timeSec ?? Infinity) - (b.timeSec ?? Infinity)) : 0)
      || (b.progress - a.progress)
      || String(a.displayName).localeCompare(String(b.displayName)))
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const payload = { class: { id: cl.id, name_fa: cl.name_fa, name_en: cl.name_en, code: cl.code,
    live_board_enabled: !!cl.live_board_enabled, live_board_anonymous: !!cl.live_board_anonymous,
    live_board_speed: speedTiebreak },
    totals: { students: members.length, items: caseCount + flashCount, cases: caseCount, flashcards: flashCount },
    updatedAt: new Date().toISOString(), ranked: rows };
  sendPrivateJson(req, res, payload, {
    id: cl.id, anon: anonymize,
    totals: [members.length, caseCount, flashCount],
    ranks: rows.map((r) => [r.user_id, r.rank, r.grade, r.progress, r.done, r.score, r.timeSec, r.latest?.created_at, r.latest?.score, r.latest?.kind]),
  });
  } catch (e) {
    res.status(500).json({ error: "live_board_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Live-board drill-down: questions and answers for one student.
   Used when a teacher clicks a student on the classroom display. */
r.get("/:id/live-board/:userId/details", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id);
  if (!cl) return res.status(404).json({ error: "not found" });
  if (!canManageClass(req.user, cl)) return res.status(403).json({ error: "not your class" });
  const uid = Number(req.params.userId);
  const mem = db.prepare(`SELECT u.id,u.name_fa,u.name_en,u.student_no FROM class_members m JOIN users u ON u.id=m.user_id WHERE m.class_id=? AND u.id=?`).get(cl.id, uid);
  if (!mem) return res.status(404).json({ error: "not member" });

  const vpRows = db.prepare(`SELECT a.id, a.case_id, a.score, a.transcript_json, a.eval_json, a.duration_sec, a.created_at, c.data_json
    FROM attempts a LEFT JOIN cases c ON c.id=a.case_id
    WHERE a.class_id=? AND a.user_id=? AND a.type='vp'
    ORDER BY a.id DESC LIMIT 20`).all(cl.id, uid).map((a) => {
      const cd = parseJson(a.data_json, {});
      return { kind: "vp", attemptId: a.id, case_id: a.case_id, title_fa: cd.title_fa || "", title_en: cd.title_en || "", score: a.score, duration_sec: a.duration_sec, created_at: a.created_at, transcript: parseJson(a.transcript_json, {}), eval: parseJson(a.eval_json, {}) };
    });

  const flashRows = db.prepare(`SELECT a.id, a.flashcard_id, a.score, a.answers_json, a.duration_sec, a.created_at, f.data_json
    FROM class_flashcard_attempts a LEFT JOIN flashcards f ON f.id=a.flashcard_id
    WHERE a.class_id=? AND a.user_id=?
    ORDER BY a.id DESC LIMIT 30`).all(cl.id, uid).map((a) => {
      const fd = parseJson(a.data_json, {});
      const raw = parseJson(a.answers_json, []);
      const answers = (Array.isArray(raw) ? raw : []).map((ans) => ({
        ...ans,
        answerText: formatFlashAnswer(ans, true),
        answerText_en: formatFlashAnswer(ans, false),
      }));
      return { kind: "flashcard", attemptId: a.id, flashcard_id: a.flashcard_id, title_fa: fd.title_fa || "", title_en: fd.title_en || "", score: a.score, duration_sec: a.duration_sec, created_at: a.created_at, answers };
    });

  res.json({ student: mem, attempts: [...flashRows, ...vpRows].sort((x, y) => String(y.created_at || "").localeCompare(String(x.created_at || ""))) });
});

// list a member's attempts (summary) for a class
r.get("/:id/members/:userId/attempts", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id);
  if (!cl) return res.status(404).json({ error: "not found" });
  if (!canManageClass(req.user, cl)) return res.status(403).json({ error: "not your class" });
  const rows = db.prepare(
    `SELECT a.id, a.case_id, a.score, a.turns, a.tests, a.imaging_count, a.ddx_count,
            a.duration_sec, a.lang, a.created_at, c.data_json
       FROM attempts a LEFT JOIN cases c ON c.id = a.case_id
      WHERE a.user_id=? AND a.class_id=? AND a.type='vp'
      ORDER BY a.created_at DESC`
  ).all(req.params.userId, cl.id).map((row) => {
    let cd = {};
    try { if (row.data_json) cd = JSON.parse(row.data_json); } catch { cd = {}; }
    return {
      id: row.id, case_id: row.case_id, caseTitle_fa: cd.title_fa, caseTitle_en: cd.title_en,
      score: row.score, turns: row.turns, tests: row.tests, imaging: row.imaging_count,
      ddx: row.ddx_count, durationSec: row.duration_sec, lang: row.lang, created_at: row.created_at,
    };
  });
  res.json({ attempts: rows });
  } catch (e) {
    res.status(500).json({ error: "member_attempts_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

// full detail of a single attempt: transcript + evaluation (with section scores)
r.get("/:id/attempts/:attemptId", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id);
  if (!cl) return res.status(404).json({ error: "not found" });
  if (!canManageClass(req.user, cl)) return res.status(403).json({ error: "not your class" });
  const a = db.prepare("SELECT * FROM attempts WHERE id=? AND class_id=?").get(req.params.attemptId, cl.id);
  if (!a) return res.status(404).json({ error: "attempt not found" });
  const u = db.prepare("SELECT id, name_fa, name_en, student_no FROM users WHERE id=?").get(a.user_id);
  const cd = a.case_id ? db.prepare("SELECT data_json FROM cases WHERE id=?").get(a.case_id) : null;
  let caseData = {};
  try { if (cd?.data_json) caseData = JSON.parse(cd.data_json); } catch { caseData = {}; }
  let transcript = null, evalRes = null;
  try { transcript = JSON.parse(a.transcript_json || "null"); } catch { /* */ }
  try { evalRes = JSON.parse(a.eval_json || "null"); } catch { /* */ }
  res.json({
    attempt: {
      id: a.id, score: a.score, lang: a.lang, created_at: a.created_at,
      durationSec: a.duration_sec, turns: a.turns,
      caseTitle_fa: caseData.title_fa, caseTitle_en: caseData.title_en,
      teacher_status: a.teacher_status || null,
      teacher_score: a.teacher_score ?? null,
      teacher_feedback: a.teacher_feedback || "",
      reviewed_at: a.reviewed_at || null,
    },
    student: u, transcript, eval: evalRes,
  });
  } catch (e) {
    res.status(500).json({ error: "attempt_detail_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Conversation log for one attempt (teacher/admin only) ----
   Returns the timestamped interaction log when the class had logging ON. When
   logging was OFF the attempt has no transcript and this says so explicitly,
   rather than returning an empty array that could be mistaken for "the student
   said nothing". */
r.get("/:id/attempts/:attemptId/session-log", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id);
  if (!cl) return res.status(404).json({ error: "not found" });
  if (!canManageClass(req.user, cl)) return res.status(403).json({ error: "not your class" });
  const a = db.prepare("SELECT * FROM attempts WHERE id=? AND class_id=?").get(req.params.attemptId, cl.id);
  if (!a) return res.status(404).json({ error: "attempt not found" });
  const logs = sessionsForAttempt(a.id);
  const u = db.prepare("SELECT id, name_fa, name_en, student_no FROM users WHERE id=?").get(a.user_id);
  res.json({
    attempt: { id: a.id, score: a.score, duration_sec: a.duration_sec, created_at: a.created_at },
    student: u,
    loggingEnabled: logs.length ? logs[0].logging_enabled : !!cl.log_transcript,
    sessions: logs,
  });
});

/* ---- CSV export of every logged conversation in a class ----
   One row per event, so the file can be pivoted in any stats package. Columns
   are fixed-width ASCII so no encoding surprises in Excel/SPSS/R. */
r.get("/:id/conversation-log.csv", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id);
  if (!cl) return res.status(404).json({ error: "not found" });
  if (!canManageClass(req.user, cl)) return res.status(403).json({ error: "not your class" });
  const hasLogged = db.prepare(
    "SELECT 1 AS ok FROM vp_sessions WHERE class_id=? AND logging_enabled=1 LIMIT 1"
  ).get(cl.id);
  if (!cl.log_transcript && !hasLogged) return res.status(409).json({ error: "logging_disabled" });

  const esc = (v) => { const x = v == null ? "" : String(v); return /[,\n\r"]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
  const header = ["session_id","user_id","student_no","case_id","attempt_id","seq","at_ms","kind","text","detail","started_at"];
  const lines = [header.join(",")];

  const sessions = db.prepare(
    `SELECT s.*, u.student_no FROM vp_sessions s LEFT JOIN users u ON u.id=s.user_id
      WHERE s.class_id=? AND s.logging_enabled=1 ORDER BY s.id, 1`
  ).all(cl.id);
  for (const s of sessions) {
    const events = db.prepare("SELECT seq,at_ms,kind,payload_json FROM vp_session_events WHERE session_id=? ORDER BY seq").all(s.id);
    for (const e of events) {
      let p = {}; try { p = JSON.parse(e.payload_json); } catch { /* */ }
      const { text, query, tab, note, source, found, ...rest } = p;
      lines.push([
        s.id, s.user_id, s.student_no || "", s.case_id, s.attempt_id || "",
        e.seq, e.at_ms, e.kind,
        esc(text ?? ""), esc(JSON.stringify({ ...(query ? { query } : {}), ...(tab ? { tab } : {}), ...(note ? { note } : {}), ...(source ? { source } : {}), ...(found != null ? { found } : {}), ...rest })),
        esc(s.started_at),
      ].join(","));
    }
  }
  audit(req, "class.conversation_export", "class", { id: cl.id, sessions: sessions.length });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="conversation-log-${safeFilename(cl.code, String(cl.id))}.csv"`);
  res.send("\uFEFF" + lines.join("\n"));
  } catch (e) {
    res.status(500).json({ error: "conversation_export_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Teacher/admin: gradebook CSV including the SEPARATE history score
   (extern criterion), other-sections score, and overall — per student. Uses
   each student's best attempt per case. Deterministic, no cost. ---- */
r.get("/:id/gradebook.csv", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id);
  if (!cl) return res.status(404).json({ error: "not found" });
  if (!canManageClass(req.user, cl)) return res.status(403).json({ error: "not your class" });
  const fa = req.query.lang !== "en";
  const members = db.prepare(
    `SELECT u.id, u.name_fa, u.name_en, u.student_no
       FROM class_members m JOIN users u ON u.id = m.user_id
      WHERE m.class_id=? ORDER BY u.id`
  ).all(cl.id);

  const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  /* The EXTERN column uses the scoped extern score (history + physical exam +
     problem list + differential diagnosis) when present, falling back to the
     legacy history-only score for older attempts. The "final score" column is
     what the class's own criterion (grading_role) stored on the attempt. */
  const header = [
    fa ? "نام" : "name", fa ? "شمارهٔ‌دانشجویی" : "student_no",
    fa ? "ملاک‌اکسترن(شرح‌حال+معاینه+پرابلم‌لیست+تشخیص‌افتراقی)" : csvScopeLabel("extern", (parseClassRubric(cl) || normalizeRubric(getSetting("vp_grading", null))).roles.extern),
    fa ? "نمرهٔ‌سایر" : "other_score",
    fa ? "ملاک‌اینترن(همه‌بخش‌ها)" : csvScopeLabel("intern", (parseClassRubric(cl) || normalizeRubric(getSetting("vp_grading", null))).roles.intern),
    fa ? "نمرهٔ‌محاسبه‌شده(ملاک‌کلاس)" : "final_score(class_criterion)",
    fa ? "تعداد‌آزمون" : "attempts",
  ];
  const lines = [header.map(esc).join(",")];

  const bestBy = new Map();
  const nByUser = new Map();
  for (const a of db.prepare(
    `SELECT user_id, case_id, score, eval_json FROM attempts WHERE class_id=? AND type='vp' ORDER BY score DESC`
  ).all(cl.id)) {
    nByUser.set(a.user_id, (nByUser.get(a.user_id) || 0) + 1);
    const k = `${a.user_id}:${a.case_id}`;
    if (!bestBy.has(k)) bestBy.set(k, a);
  }
  const bestListByUser = new Map();
  for (const a of bestBy.values()) {
    const arr = bestListByUser.get(a.user_id); if (arr) arr.push(a); else bestListByUser.set(a.user_id, [a]);
  }
  for (const u of members) {
    const rows = bestListByUser.get(u.id) || [];
    let hSum = 0, hN = 0, oSum = 0, oN = 0, allSum = 0, allN = 0, finSum = 0, finN = 0, attempts = nByUser.get(u.id) || 0;
    for (const a of rows) {
      let ev = null; try { ev = JSON.parse(a?.eval_json || "null"); } catch { /* */ }
      const ss = ev?.sectionScores;
      const ext = ss?.extern ?? ss?.history;
      if (ext != null) { hSum += ext; hN++; }
      if (ss?.other != null) { oSum += ss.other; oN++; }
      const overall = ss?.intern != null ? ss.intern : (ss?.overall != null ? ss.overall : (a?.score ?? 0));
      allSum += overall; allN++;
      if (a?.score != null) { finSum += a.score; finN++; }
    }
    const avg = (s, n) => (n ? Math.round(s / n) : "");
    const line = [
      fa ? (u.name_fa || u.name_en || "") : (u.name_en || u.name_fa || ""), u.student_no || "",
      avg(hSum, hN), avg(oSum, oN), avg(allSum, allN), avg(finSum, finN), attempts,
    ];
    lines.push(line.map(esc).join(","));
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="gradebook-${safeFilename(cl.code, String(cl.id))}.csv"`);
  res.send("\uFEFF" + lines.join("\n"));
  } catch (e) {
    res.status(500).json({ error: "gradebook_export_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* ================================================================
   Teacher progress dashboard for a whole class.
   The protocol requires the professor to see every student's progress
   profile (radar + line) and to hand a remedial scenario to anyone
   scoring below 6/10.
   ================================================================ */
const REMEDIAL_THRESHOLD = 6;      // out of 10, per the protocol

/* The score that counts for an attempt. A teacher's review overrides the AI,
   and a rejected attempt counts as zero. This is the ONE definition used by
   both the dashboard and the remedial selection, so the two can never disagree
   about who is below the threshold. */
function effectiveScore100(a) {
  if (a.teacher_status === "adjusted" && a.teacher_score != null) return a.teacher_score;
  if (a.teacher_status === "rejected") return 0;
  return a.score;
}

/* Compute the whole class's progress profiles. Shared by GET /:id/progress and
   POST /:id/remedial. */
function classProgress(cl) {
  const members = db.prepare(
    `SELECT u.id, u.student_no, COALESCE(u.name_fa,u.name_en,u.username) AS name
       FROM class_members m JOIN users u ON u.id=m.user_id WHERE m.class_id=? ORDER BY u.student_no`
  ).all(cl.id);
  const J = (x) => { try { return JSON.parse(x); } catch { return null; } };

  const attBy = new Map();
  for (const a of db.prepare(
    `SELECT id, user_id, score, eval_json, teacher_status, teacher_score, created_at
       FROM attempts WHERE class_id=? AND type='vp' ORDER BY created_at ASC`
  ).all(cl.id)) {
    const arr = attBy.get(a.user_id); if (arr) arr.push(a); else attBy.set(a.user_id, [a]);
  }
  const students = members.map((u) => {
    const rows = attBy.get(u.id) || [];

    // Line: the score that counts, over time. The protocol reports out of 10;
    // attempts store a 0-100 percentage.
    const line = rows.map((a) => {
      const s100 = effectiveScore100(a);
      return { at: a.created_at, score: s100, aiScore: a.score,
               score10: Math.round(((s100 || 0) / 10) * 10) / 10 };
    });

    // Radar: pass rate per checklist criterion across this student's attempts.
    const agg = {};
    for (const a of rows) {
      const ev = J(a.eval_json); if (!ev || !Array.isArray(ev.results)) continue;
      for (const it of ev.results) {
        const key = it.label || it.id; if (!key) continue;
        agg[key] = agg[key] || { done: 0, total: 0 };
        agg[key].total += 1; if (it.done) agg[key].done += 1;
      }
    }
    const radar = Object.entries(agg).map(([label, v]) => ({
      label, value: v.total ? Math.round((v.done / v.total) * 100) : 0,
    }));

    const latest = line.length ? line[line.length - 1].score10 : null;
    const best = line.length ? Math.max(...line.map((p2) => p2.score10)) : null;
    return {
      userId: u.id, studentNo: u.student_no || "", name: u.name || "",
      attempts: rows.length, latest, best,
      needsRemedial: latest != null && latest < REMEDIAL_THRESHOLD,
      line, radar,
    };
  });

  const withScore = students.filter((x) => x.latest != null);
  return {
    classId: cl.id, threshold: REMEDIAL_THRESHOLD,
    totals: {
      students: students.length,
      notStarted: students.filter((x) => x.attempts === 0).length,
      needsRemedial: students.filter((x) => x.needsRemedial).length,
      mean: withScore.length
        ? Math.round((withScore.reduce((a, x) => a + x.latest, 0) / withScore.length) * 10) / 10
        : null,
    },
    students,
  };
}

r.get("/:id/progress", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id);
  if (!cl) return res.status(404).json({ error: "not found" });
  if (!canManageClass(req.user, cl)) return res.status(403).json({ error: "not your class" });
  res.json(classProgress(cl));
  } catch (e) {
    res.status(500).json({ error: "progress_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* Assign a remedial scenario to everyone below the threshold (or to an
   explicit list). Uses exam_assignments, which the standalone case list
   already reads, so the student sees it with no client change. */
r.post("/:id/remedial", authRequired, requireRole("teacher", "admin"), (req, res) => {
  try {
  const cl = db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id);
  if (!cl) return res.status(404).json({ error: "not found" });
  if (!canManageClass(req.user, cl)) return res.status(403).json({ error: "not your class" });

  const caseId = Number(req.body?.caseId || 0);
  if (!caseId) return res.status(400).json({ error: "case_required" });
  const caseRow = db.prepare("SELECT id, university_id, active, data_json FROM cases WHERE id=?").get(caseId);
  if (!caseRow || !caseRow.active) return res.status(404).json({ error: "case_not_found", stage: "case" });
  if (isLearnContent(caseRow.data_json)) {
    return res.status(403).json({ error: "wrong_track", reason: "wrong_track", stage: "access" });
  }
  if ((caseRow.university_id || 1) !== (cl.university_id || 1)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }

  const explicit = Array.isArray(req.body?.userIds) ? req.body.userIds.map(Number).filter(Boolean) : null;
  /* Derive the targets from the very same progress computation the dashboard
     shows. Reading `attempts.score` directly here (as an earlier version did)
     ignored a teacher's override, so the dashboard could flag a student as
     needing remedial while this endpoint selected nobody. */
  const targets = explicit
    || classProgress(cl).students.filter((x) => x.needsRemedial).map((x) => x.userId);

  const maxAttempts = Math.max(1, Number(req.body?.maxAttempts) || 2);
  const byUser = new Map(db.prepare("SELECT id, user_id FROM exam_assignments WHERE case_id=?")
    .all(caseId).map((e) => [e.user_id, e.id]));
  let created = 0, updated = 0;
  for (const uid of targets) {
    if (byUser.has(uid)) {
      db.prepare("UPDATE exam_assignments SET active=1, max_attempts=?, assigned_by=? WHERE id=?")
        .run(maxAttempts, req.user.id, byUser.get(uid));
      updated++;
    } else {
      db.prepare("INSERT INTO exam_assignments (user_id,case_id,assigned_by,max_attempts,active) VALUES (?,?,?,?,1)")
        .run(uid, caseId, req.user.id, maxAttempts);
      created++;
    }
  }
  persistNow();
  audit(req, "class.remedial_assigned", "class",
        { id: cl.id, caseId, students: targets.length, threshold: REMEDIAL_THRESHOLD });
  res.json({ ok: true, caseId, assigned: targets.length, created, updated,
             threshold: REMEDIAL_THRESHOLD, userIds: targets });
  } catch (e) {
    res.status(500).json({ error: "remedial_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

export default r;

/* ---- shared helper for exam.js: is this student allowed to take
        this case within this class, and how many attempts remain? ---- */
export function classAttemptInfo(userId, classId, caseId) {
  const cl = db.prepare("SELECT * FROM classes WHERE id=? AND active=1").get(classId);
  if (!cl) return { allowed: false };
  const caseRow = db.prepare("SELECT data_json FROM cases WHERE id=?").get(caseId);
  if (isLearnContent(caseRow?.data_json)) return { allowed: false };
  const member = db.prepare("SELECT 1 FROM class_members WHERE class_id=? AND user_id=?").get(classId, userId);
  const hasCase = db.prepare("SELECT 1 FROM class_cases WHERE class_id=? AND case_id=?").get(classId, caseId);
  if (!member || !hasCase) return { allowed: false };
  const used = db.prepare(
    "SELECT COUNT(*) n FROM attempts WHERE user_id=? AND case_id=? AND class_id=?"
  ).get(userId, caseId, classId).n;
  return { allowed: true, remaining: Math.max(0, (cl.max_attempts ?? 1) - used), maxAttempts: cl.max_attempts ?? 1 };
}

/* ---- Is this student allowed to take this flashcard set in this class,
        and how many attempts remain? ---- */
export function classFlashcardInfo(userId, classId, flashcardId) {
  const cl = db.prepare("SELECT * FROM classes WHERE id=? AND active=1").get(classId);
  if (!cl) return { allowed: false };
  const flash = db.prepare("SELECT active FROM flashcards WHERE id=?").get(flashcardId);
  if (!flash || !flash.active) return { allowed: false };
  const flashRow = db.prepare("SELECT data_json FROM flashcards WHERE id=?").get(flashcardId);
  if (isLearnContent(flashRow?.data_json)) return { allowed: false };
  const member = db.prepare("SELECT 1 FROM class_members WHERE class_id=? AND user_id=?").get(classId, userId);
  const has = db.prepare("SELECT 1 FROM class_flashcards WHERE class_id=? AND flashcard_id=?").get(classId, flashcardId);
  if (!member || !has) return { allowed: false };
  const used = db.prepare(
    "SELECT COUNT(*) n FROM class_flashcard_attempts WHERE user_id=? AND flashcard_id=? AND class_id=?"
  ).get(userId, flashcardId, classId).n;
  return { allowed: true, remaining: Math.max(0, (cl.max_attempts ?? 1) - used), maxAttempts: cl.max_attempts ?? 1 };
}
