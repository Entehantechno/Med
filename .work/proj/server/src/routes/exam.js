import { evaluationFingerprint, retryScoreGet, retryScorePut, retryScoreDrop } from "../lib/vp-evaluation-retry.js";
import { acquireCompletion, completionBusy, publicEvaluation } from "../lib/vp-completion.js";
/* ================================================================
   exam.js — Virtual patient chat + evaluation + flashcard submit.
   All AI logic lives server-side; prompts pulled from DB.
   ================================================================ */
import { Router } from "express";
import { db, persistNow } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";
import { validateBody, s as vs } from "../lib/validate.js";
import { patientReply, evaluate, scoreChecklistWithLLM, enrichEvaluationWithLLM, labImagingResult, listAiProviders, asMessages, resolveAiConfig } from "../lib/ai-engine.js";
import { getSetting, setSetting, canAccessCase } from "./content.js";
import { caseInLiveExam } from "../lib/live-exam-content.js";
import { caseIsLearn } from "../lib/content-track.js";
import { DEFAULT_LAB_TESTS, DEFAULT_IMAGING, DEFAULT_PARACLINIC, cleanOrderList, catalogContainsQuery } from "../data/order-catalog-defaults.js";
import { classAttemptInfo } from "./classes.js";
import { examAccess } from "./exams.js";
import { scoreSubmittedAnswers, gradeSubmittedDeck, gradeSubmittedDeckDetailed } from "../lib/flashcard-grade.js";
import { effectiveFlashNoPenalty, resolveVpUniversity, checkVpAllowance, bumpUsage, estimateTokens } from "../lib/orglimits.js";
import { getVpatientConfig, awardVpatientXp, getVpatientAiEffective, getVpatientPromptsEffective, vpatientAccess } from "../lib/vpatient.js";
import { isEnabled } from "../lib/flags.js";
import { audit } from "../lib/audit.js";
import { startSession, getSession, finishSession, loggingEnabledFor, serverElapsedSec } from "../lib/vplogging.js";
import { normalizeRubric, parseClassRubric } from "../lib/grading-rubric.js";

function resolveClassRubric(classId) {
  const global = normalizeRubric(getSetting("vp_grading", null));
  if (!classId) return global;
  const cl = db.prepare("SELECT grading_json FROM classes WHERE id=?").get(classId);
  return parseClassRubric(cl) || global;
}
import { assertConsent, studyForContext } from "../lib/consent.js";
import { recordStudyEvent } from "../lib/research-log.js";
import { getProfile } from "../lib/gamify.js";

// Access is granted by a scheduled exam, class enrollment, OR direct assignment.
//
// Returns { allowed, reason } where reason explains a refusal so the client can
// show something better than a generic 403.
//
// IMPORTANT: this also enforces the attempt BUDGET server-side. The UI disables
// the "start" button once attempts are used up, but a direct API call must be
// refused too — otherwise a student can replay the same scenario unlimited
// times, which pollutes the class gradebook and (for a research study) destroys
// the one-attempt-per-student guarantee the analysis relies on.
function hasAccess(user, caseId, classId, examId, acceptedAt = Date.now()) {
  // Competitive learners reach virtual patients through the gated learner
  // feature, NOT class/exam assignments — so check the vpatient access config.
  // Learners are deliberately unlimited (best-score XP policy handles farming).
  if (user.role === "learner") {
    try {
      if (!caseIsLearn(caseId)) return { allowed: false, reason: "university_only" };
      const p = getProfile(user.id);
      const vp = vpatientAccess(p, user.role);
      if (!vp.ok) return { allowed: false, reason: vp.reason || "off" };
      return { allowed: true };
    } catch {
      return { allowed: false, reason: "off" };
    }
  }
  if (user.role === "admin") return { allowed: true };
  if (user.role === "teacher") {
    if (caseIsLearn(caseId)) return { allowed: false, reason: "wrong_track" };
    if (!canAccessCase(user, caseId)) return { allowed: false, reason: "wrong_university" };
    return { allowed: true };
  }
  if (user.role === "content_manager" || user.role === "support") {
    if (!caseIsLearn(caseId)) return { allowed: false, reason: "university_only" };
    return { allowed: true };
  }
  if (user.role !== "student") return { allowed: false, reason: "not_assigned" };
  if (caseIsLearn(caseId)) return { allowed: false, reason: "wrong_track" };

  /* Research consent gates participation, not grading. If this class/exam
     belongs to a study that requires consent and this student has not given it,
     they cannot enter the encounter at all — which also means no conversation
     can be logged before consent exists. Checked here so every entry point
     (patient-reply, order, evaluate, session-start) inherits it. */
  const deny = (reason) => ({ allowed: false, reason });
  const budget = (info) => {
    if (!info?.allowed) return deny(info?.reason || "not_assigned");
    // Infinity means "not capped" (staff / learner paths); otherwise count down.
    if (info.remaining === Infinity || info.remaining == null) return { allowed: true };
    if (info.remaining <= 0) return deny("attempts_exhausted");
    return { allowed: true, remaining: info.remaining };
  };
  const withConsent = (resolved, ctx) => {
    if (!resolved?.allowed) return resolved;
    const consent = assertConsent(user, ctx);
    if (!consent.ok) {
      return { allowed: false, reason: consent.reason, studyId: consent.studyId,
               titleFa: consent.titleFa, titleEn: consent.titleEn,
               consentTextFa: consent.consentTextFa, consentTextEn: consent.consentTextEn,
               ethicsCode: consent.ethicsCode, protocolVersion: consent.protocolVersion };
    }
    return resolved;
  };

  if (examId) return withConsent(budget(examAccess(user.id, examId, caseId, acceptedAt)), { examId });
  if (classId) return withConsent(budget(classAttemptInfo(user.id, classId, caseId)), { classId });

  if (!canAccessCase(user, caseId)) return deny("not_assigned");

  /* No container was named in the request (the standalone case list). Omitting
     classId/examId must not become a way around the cap, the exam window, or
     research consent, so we work out the budget for EVERY path that grants
     access — classes, direct assignments, AND scheduled exams. */
  const cid = Number(caseId);
  const budgets = [];
  let windowBlocked = false;
  let examExhausted = false;

  // (a) every active class that both contains the case and has this student
  const grantingClasses = db.prepare(
    `SELECT c.id, c.max_attempts FROM class_cases cc
       JOIN classes c ON c.id = cc.class_id
       JOIN class_members m ON m.class_id = c.id
      WHERE cc.case_id=? AND m.user_id=? AND c.active=1`
  ).all(cid, user.id);
  for (const cl of grantingClasses) {
    const used = db.prepare(
      "SELECT COUNT(*) n FROM attempts WHERE user_id=? AND case_id=? AND class_id=?"
    ).get(user.id, cid, cl.id).n;
    budgets.push({ kind: "class", id: cl.id, remaining: (cl.max_attempts ?? 1) - used });
  }

  // (b) a direct assignment (this is what the standalone /cases list shows)
  const asg = db.prepare(
    "SELECT max_attempts FROM exam_assignments WHERE user_id=? AND case_id=? AND active=1"
  ).get(user.id, cid);
  if (asg) {
    const used = db.prepare(
      "SELECT COUNT(*) n FROM attempts WHERE user_id=? AND case_id=? AND class_id IS NULL AND exam_id IS NULL"
    ).get(user.id, cid).n;
    budgets.push({ kind: "assignment", id: null, remaining: (asg.max_attempts ?? 1) - used });
  }

  // (c) scheduled exams that contain this case. Previously omitting examId
  // fell through to allowed:true — unlimited attempts outside the window.
  const examRows = db.prepare(
    `SELECT e.id, e.case_ids FROM exams e
       JOIN exam_participants p ON p.exam_id = e.id
      WHERE p.user_id=? AND e.active=1`
  ).all(user.id);
  for (const row of examRows) {
    let ids = [];
    try { ids = JSON.parse(row.case_ids || "[]"); } catch { ids = []; }
    if (!Array.isArray(ids) || !ids.map(Number).includes(cid)) continue;
    const info = examAccess(user.id, row.id, cid, acceptedAt);
    if (!info.allowed) {
      if (info.reason === "window") windowBlocked = true;
      else if (info.reason === "attempts_exhausted") examExhausted = true;
      continue;
    }
    budgets.push({ kind: "exam", id: row.id, remaining: info.remaining ?? 1 });
  }

  if (!budgets.length) {
    if (examExhausted) return deny("attempts_exhausted");
    if (windowBlocked) return deny("window");
    return deny("not_assigned");
  }
  const best = budgets.reduce((a, b) => (b.remaining > a.remaining ? b : a));
  if (best.remaining <= 0) return deny("attempts_exhausted");
  /* Attribute the attempt to the container whose quota it is spending. Without
     this the attempt would be stored with class_id/exam_id NULL and would be
     invisible to every budget — i.e. the cap would never actually bite. */
  const resolved = { allowed: true, remaining: best.remaining,
    attributedClassId: best.kind === "class" ? best.id : null,
    attributedExamId: best.kind === "exam" ? best.id : null };
  return withConsent(resolved, {
    classId: resolved.attributedClassId,
    examId: resolved.attributedExamId,
  });
}

/* 403 with a machine-readable reason so the client can say WHY (out of attempts
   vs. never assigned) instead of a generic "not assigned". */
function denyAccess(res, acc, stage = "access") {
  const reason = acc?.reason || "not_assigned";
  const msg = reason === "attempts_exhausted" ? "attempts exhausted"
    : (reason === "consent_required" || reason === "consent_withdrawn" || reason === "consent_stale") ? "consent required"
    : reason === "off" ? "virtual patient is off"
    : reason === "premium" ? "premium required"
    : reason === "window" ? "exam window closed"
    : reason === "wrong_university" ? "wrong university"
    : reason === "university_only" ? "university content is not on the competitive track"
    : reason === "wrong_track" ? "competitive content is not on the university track"
    : "not assigned to this exam";
  // Carrying the study id lets the client jump straight to the consent screen
  // instead of showing a dead-end error. `stage` names the step that refused
  // so the UI can say WHERE the path stopped (session / chat / order / evaluate).
  const extra = acc?.studyId ? {
    studyId: acc.studyId, titleFa: acc.titleFa || "", titleEn: acc.titleEn || "",
    consentTextFa: acc.consentTextFa || "", consentTextEn: acc.consentTextEn || "",
    ethicsCode: acc.ethicsCode || "", protocolVersion: acc.protocolVersion || "",
  } : {};
  const stageOut = (reason === "consent_required" || reason === "consent_withdrawn" || reason === "consent_stale") ? "consent" : stage;
  return res.status(403).json({ error: msg, reason, stage: stageOut, ...extra });
}

/* Whether a competitive learner may use the virtual patient right now (feature
   flag + admin switch + optional premium-only). Best-effort require to avoid a
   hard import cycle. */
function learnerVpatientAllowed(user) {
  try {
    const cfg = getVpatientConfig();
    if (!isEnabled("virtual_patient") || !cfg.enabled) return false;
    if (!cfg.premium_only) return true;
    const p = db.prepare("SELECT premium, premium_until FROM learner_profiles WHERE user_id=?").get(user.id);
    if (!p) return false;
    const active = p.premium && (!p.premium_until || new Date(p.premium_until).getTime() >= Date.now());
    return !!active;
  } catch { return false; }
}

// Duration is client-reported, so it is never trusted blindly: it is coerced to
// a finite number of seconds and clamped to a sane window. A negative, NaN or
// absurd value would otherwise flow straight into the research dataset.
const MAX_SESSION_SEC = 6 * 60 * 60;   // 6h hard ceiling for one encounter
function clampDuration(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(MAX_SESSION_SEC, Math.round(n));
}

const r = Router();

function loadPrompts() {
  const rows = db.prepare("SELECT * FROM prompts").all();
  const out = {}; rows.forEach((p) => (out[p.key] = p.value));
  return out;
}

/* Pick the AI config + prompts for THIS request. Competitive learners (free
   virtual patient, not a class/exam) use the SEPARATE vpatient config; everyone
   else (students, teachers, admins, scheduled exams) uses the shared university
   config. This keeps the two flows fully independent yet code-shared. */
function engineContext(req, body = {}) {
  const isCompetitive = req.user.role === "learner";
  if (isCompetitive) {
    return { aiCfg: getVpatientAiEffective(), prompts: getVpatientPromptsEffective(), competitive: true };
  }
  // For university accounts/admins, merge university AI settings with VP AI settings
  // so an API key saved in either section is automatically effective across the system.
  const uniAi = resolveAiConfig(getSetting("ai", {}));
  const vpAi = getVpatientAiEffective();
  const aiCfg = uniAi.routingEnabled || uniAi.apiKey ? uniAi : (vpAi.apiKey ? vpAi : uniAi);
  return { aiCfg, prompts: loadPrompts(), competitive: false };
}
function containersFor(user, classId, examId, acc) {
  // Only enrolled students may attach an attempt to a university class/exam.
  // Teachers/learners sending ids would otherwise land in the gradebook.
  // Exam and class are exclusive: a crafted body must not write both.
  if (user.role !== "student") return { ownerClassId: null, ownerExamId: null };
  if (examId) return { ownerClassId: null, ownerExamId: examId };
  if (classId) return { ownerClassId: classId, ownerExamId: null };
  return {
    ownerClassId: acc?.attributedClassId || null,
    ownerExamId: acc?.attributedExamId || null,
  };
}
function refuseInactiveCase(res, user, caseId) {
  if (user.role !== "student" && user.role !== "learner") return false;
  const row = db.prepare("SELECT active FROM cases WHERE id=?").get(caseId);
  if (row && !row.active) {
    res.status(404).json({ error: "case not found", stage: "case" });
    return true;
  }
  return false;
}
function loadCase(id) {
  const row = db.prepare("SELECT * FROM cases WHERE id=?").get(id);
  if (!row) return null;
  try {
    return { ...JSON.parse(row.data_json), id: row.id, version: row.version, checklist_id: row.checklist_id };
  } catch {
    return null;
  }
}
function loadChecklist(id) {
  const row = db.prepare("SELECT * FROM checklists WHERE id=?").get(id);
  if (!row) return { items: [] };
  try { return { id: row.id, items: JSON.parse(row.items_json) }; }
  catch { return { id: row.id, items: [] }; }
}

/* ---- Open an encounter ----
   Called the moment the student enters the case. The server stamps the start
   time here so the recorded duration does not depend on the client's clock, and
   resolves the privacy decision ONCE (snapshot of the class/exam logging
   switch) so a later toggle cannot reinterpret data already collected.
   The row exists even if the student never finishes — an abandoned session is
   itself meaningful for a study (dropout), and it holds no content when
   logging is off. */
r.post("/session-start", authRequired, (req, res) => {
  try {
  const { caseId, classId, examId, lang = "fa", requestId = null } = req.body || {};
  const caseData = loadCase(caseId);
  if (!caseData) return res.status(404).json({ error: "case not found", stage: "case" });
  const caseRow = db.prepare("SELECT active FROM cases WHERE id=?").get(caseId);
  if (caseRow && !caseRow.active && (req.user.role === "student" || req.user.role === "learner")) {
    return res.status(404).json({ error: "case not found", stage: "case" });
  }
  const acc = hasAccess(req.user, caseId, classId, examId);
  if (!acc.allowed) return denyAccess(res, acc, "session");
  const { ownerClassId, ownerExamId } = containersFor(req.user, classId, examId, acc);
  const studyId = studyForContext({ classId: ownerClassId, examId: ownerExamId })?.id || null;
  const s = startSession({
    userId: req.user.id, caseId: caseData.id,
    classId: ownerClassId, examId: ownerExamId, lang,
    studyId, requestId,
  });
  if (s.error) return res.status(s.status).json({ error: s.error, stage: "session" });
  // Meter one VP session against the owning university's quota (if capped).
  bumpUsage(resolveVpUniversity({ classId: ownerClassId, examId: ownerExamId, userId: req.user.id }), { sessions: 1 });
  // Tell the UI which criterion this class grades on, so the student sees it
  // before finishing (extern = up to the differential dx, intern = all sections).
  let gradingScope = "overall";
  if (ownerClassId) {
    const role = db.prepare("SELECT grading_role FROM classes WHERE id=?").get(ownerClassId)?.grading_role;
    if (role === "history") gradingScope = "extern";
    else if (role === "overall") gradingScope = "intern";
  }
  const gradingRubric = resolveClassRubric(ownerClassId);
  if (studyId && !s.replayed) {
    recordStudyEvent({
      studyId, userId: req.user.id, eventType: "session_started",
      contextType: ownerExamId ? "exam" : "class", contextId: ownerExamId || ownerClassId,
      data: { caseId: caseData.id, sessionId: s.sessionId },
    });
  }
  const payload = { ...s, gradingScope };
  if (req.user.role !== "student" && req.user.role !== "learner") payload.gradingRubric = gradingRubric;
  res.json(payload);
  } catch (e) {
    res.status(500).json({ error: "session_failed", stage: "session", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Abandoned encounter ----
   Fired from the browser when the student leaves mid-session. Closes the
   session and stores whatever was logged so far. Ownership is enforced inside
   finishSession(), so one student cannot close another's session. */
r.post("/session-abandon", authRequired, (req, res) => {
  try {
  const { sessionId, events = [] } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: "session_id_required", stage: "session" });
  const owned = getSession(sessionId);
  if (!owned) return res.status(404).json({ error: "session_not_found", stage: "session" });
  if (Number(owned.user_id) !== Number(req.user.id)) return res.status(403).json({ error: "not_your_session", stage: "session" });
  if (completionBusy(req.user.id, owned.case_id)) return res.status(409).json({ error: "evaluation_in_progress", stage: "session", retryable: true });
  // Completed sessions are immutable: a late unload merely acknowledges the
  // already-closed record, without collecting any new content.
  if (!owned.finished_at) {
    const study = studyForContext({ classId: owned.class_id, examId: owned.exam_id });
    if (Number(owned.study_id || 0) !== Number(study?.id || 0)) return res.status(409).json({ error: "study_context_changed", stage: "session" });
    const consent = assertConsent(req.user, { classId: owned.class_id, examId: owned.exam_id });
    if (!consent.ok) return denyAccess(res, { ...consent, allowed: false }, "session");
  }
  const out = db.transaction(() => finishSession({ sessionId, userId: req.user.id, events, durationSec: 0, attemptId: null, persist: false }))();
  persistNow({ throwOnError: true });
  if (out.error) return res.status(out.error === "session_not_found" ? 404 : 403).json({ error: out.error, stage: "session" });
  res.json({ ok: true, stored: out.stored, loggingEnabled: out.loggingEnabled });
  } catch (e) {
    res.status(500).json({ error: "session_failed", stage: "session", message: String(e.message || e).slice(0, 200) });
  }
});

/* Capture the authorized interaction context before asynchronous work. A late
   provider response must not outlive an admin hold, enrollment or token.
   Pin inferred containers too, rather than silently switching to another class.
   Wording changes and withdrawal requests are NOT authorization changes. */
function interactionAccessGuard(req, res, caseId, classId, examId, acc, stage) {
  const acceptedAt = Date.now();
  const { ownerClassId, ownerExamId } = containersFor(req.user, classId, examId, acc);
  const ctx = { classId: ownerClassId, examId: ownerExamId };
  const studyId = studyForContext(ctx)?.id || null;
  return () => {
    const live = db.prepare("SELECT status,role,token_ver FROM users WHERE id=?").get(req.user.id);
    if (!live || live.status !== "active" || live.role !== req.user.role || Number(live.token_ver || 1) !== Number(req.user.ver || 1)) {
      res.status(401).json({ error: "authorization_changed", stage }); return false;
    }
    if (!loadCase(caseId)) { res.status(404).json({ error: "case not found", stage: "case" }); return false; }
    if (refuseInactiveCase(res, req.user, caseId)) return false;
    const current = hasAccess(req.user, caseId, ctx.classId, ctx.examId, acceptedAt);
    if (!current.allowed) { denyAccess(res, current, stage); return false; }
    const now = containersFor(req.user, ctx.classId, ctx.examId, current);
    if (Number(now.ownerClassId || 0) !== Number(ownerClassId || 0) ||
        Number(now.ownerExamId || 0) !== Number(ownerExamId || 0) ||
        (studyForContext(ctx)?.id || null) !== studyId) {
      res.status(409).json({ error: "study_context_changed", stage }); return false;
    }
    return true;
  };
}

/* ---- Patient chat turn ---- */
r.post("/patient-reply", authRequired, async (req, res) => {
  try {
    const { caseId, userText, history = [], lang = "fa", classId, examId } = req.body || {};
    const acc = hasAccess(req.user, caseId, classId, examId);
    if (!acc.allowed) return denyAccess(res, acc, "chat");
    const text = String(userText || "").trim();
    if (!text) return res.status(400).json({ error: "text_required", stage: "chat" });
    const caseData = loadCase(caseId);
    if (!caseData) return res.status(404).json({ error: "case not found", stage: "case" });
    if (refuseInactiveCase(res, req.user, caseId)) return;
    // University license: message & estimated-token budgets gate VP chat
    // (billed to the class/exam owner's university, else the caller's).
    const orgUni = resolveVpUniversity({ classId, examId, userId: req.user.id });
    const limitHit = checkVpAllowance(orgUni);
    if (limitHit) {
      return res.status(403).json({
        error: limitHit.kind === "messages" ? "university_vp_msg_limit" : "university_vp_token_limit",
        stage: "chat", limit: limitHit,
        message_fa: limitHit.kind === "messages"
          ? "سهمیه‌ی ماهانه‌ی گفت‌وگو با بیمار مجازی برای دانشگاه شما تمام شده است."
          : "سقف توکن ماهانه‌ی بیمار مجازی برای دانشگاه شما به پایان رسیده است.",
      });
    }
    const { aiCfg, prompts } = engineContext(req, req.body);
    const canDeliver = interactionAccessGuard(req, res, caseId, classId, examId, acc, "chat");
    const result = await patientReply({ caseData, userText: text, history, lang, prompts, aiCfg });
    if (!canDeliver()) return;
    if (!String(result?.text || "").trim()) {
      return res.status(502).json({ error: "empty_reply", stage: "chat" });
    }
    bumpUsage(orgUni, { msgs: 1, tokens: estimateTokens(text, history && history.length ? JSON.stringify(history) : "", result.text) });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "chat_failed", stage: "chat", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Order a lab test / imaging study / paraclinical study -> report in the chat ----
   `kind` = "lab" | "imaging" | "paraclinic" (ECG, PFT, EEG, ...).
   If the case chart has a recorded result → return it (with an image if any).
   Otherwise the student is told it's NORMAL (AI-worded when a key is set, else a
   deterministic template). `kind` = "lab" | "imaging". */
r.post("/order", authRequired, async (req, res) => {
  try {
    const { caseId, kind = "lab", query = "", lang = "fa", classId, examId } = req.body || {};
    const caseData = loadCase(caseId);
    if (!caseData) return res.status(404).json({ error: "case not found", stage: "case" });
    if (refuseInactiveCase(res, req.user, caseId)) return;
    // Access / attempt budget FIRST so an exhausted student still gets 403
    // (not 400 not_in_catalog) when they post a query that isn't in that kind.
    const acc = hasAccess(req.user, caseId, classId, examId);
    if (!acc.allowed) return denyAccess(res, acc, "order");
    const q = String(query || "").trim();
    if (!q) return res.status(400).json({ error: "query_required", stage: "order" });
    const kindN = kind === "imaging" ? "imaging" : kind === "paraclinic" ? "paraclinic" : "lab";
    const labs = cleanOrderList(getSetting("order_catalog_lab", null), DEFAULT_LAB_TESTS);
    const imaging = cleanOrderList(getSetting("order_catalog_imaging", null), DEFAULT_IMAGING);
    const paraclinic = cleanOrderList(getSetting("order_catalog_paraclinic", null), DEFAULT_PARACLINIC);
    const cat = kindN === "imaging" ? imaging : kindN === "paraclinic" ? paraclinic : labs;
    // ECG lives in the paraclinic catalog while many cases record it under imaging;
    // accept a hit in either non-lab catalog so the station does not 400 the key order.
    const allowed = catalogContainsQuery(cat, q)
      || (kindN !== "lab" && (catalogContainsQuery(imaging, q) || catalogContainsQuery(paraclinic, q)));
    if (!allowed) {
      return res.status(400).json({ error: "not_in_catalog", stage: "order" });
    }
    const { aiCfg, prompts } = engineContext(req, req.body);
    const canDeliver = interactionAccessGuard(req, res, caseId, classId, examId, acc, "order");
    const result = await labImagingResult({
      caseData, kind: kindN, query: q, lang, prompts, aiCfg,
    });
    if (!canDeliver()) return;
    if (!String(result?.text || "").trim()) {
      return res.status(502).json({ error: "empty_result", stage: "order" });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "order_failed", stage: "order", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Finish exam -> evaluate + store attempt ---- */
r.post("/evaluate", authRequired, async (req, res) => {
  let releaseCompletion;
  const acceptedAt = Date.now();
  try {
  let { caseId, lang = "fa", durationSec = 0, classId, examId,
          sessionId = null, events = [] } = req.body || {};
  const vpSession = sessionId ? getSession(sessionId) : null;
  if (sessionId && !vpSession) return res.status(404).json({ error: "session_not_found", stage: "evaluate" });
  if (vpSession) {
    if (Number(vpSession.user_id) !== Number(req.user.id)) return res.status(403).json({ error: "not_your_session", stage: "evaluate" });
    if (Number(vpSession.case_id) !== Number(caseId) ||
        (classId != null && Number(classId) !== Number(vpSession.class_id)) ||
        (examId != null && Number(examId) !== Number(vpSession.exam_id))) {
      return res.status(409).json({ error: "session_context_mismatch", stage: "evaluate" });
    }
    // Bind implicit class/exam attribution to the context chosen at session start.
    classId = vpSession.class_id; examId = vpSession.exam_id;
    if (Number(vpSession.study_id || 0) !== Number(studyForContext({ classId, examId })?.id || 0)) {
      return res.status(409).json({ error: "study_context_changed", stage: "evaluate", attemptStored: !!vpSession.attempt_id });
    }
    if (vpSession.attempt_id) {
      const attempt = db.prepare("SELECT * FROM attempts WHERE id=? AND user_id=? AND case_id=? AND type='vp'")
        .get(vpSession.attempt_id, req.user.id, caseId);
      if (!attempt) return res.status(409).json({ error: "session_result_missing", stage: "evaluate" });
      const consent = assertConsent(req.user, { classId, examId });
      if (!consent.ok) return denyAccess(res, { ...consent, allowed: false }, "evaluate");
      const stored = JSON.parse(attempt.eval_json);
      const settings = getSetting("exam", {});
      const ex = examId ? db.prepare("SELECT show_ai, show_micro FROM exams WHERE id=?").get(examId) : null;
      const showAi = (stored.meta?.showAi ?? true) && !!(ex ? ex.show_ai : settings.showAiAnalysis);
      const showMicro = (stored.meta?.showMicro ?? true) && !!(ex ? ex.show_micro : settings.showMicro);
      const response = publicEvaluation(stored, req.user.role, showAi, showMicro);
      response.logging = { enabled: !!vpSession.logging_enabled, eventsStored: vpSession.event_count || 0, eventsDropped: 0 };
      persistNow({ throwOnError: true });
      return res.json({ attemptId: attempt.id, ...response, replayed: true });
    }
    if (vpSession.finished_at) return res.status(409).json({ error: "session_closed", stage: "evaluate" });
  } else if (process.env.VP_REQUIRE_AI_EVALUATION !== "0" && ["student", "learner"].includes(req.user.role)) {
    return res.status(400).json({ error: "session_id_required", stage: "evaluate" });
  }
  releaseCompletion = acquireCompletion(req.user.id, caseId);
  if (!releaseCompletion) return res.status(409).json({
    error: "evaluation_in_progress", stage: "evaluate", retryable: true,
    message_fa: "ارزیابی این برخورد هنوز در حال انجام است؛ کمی صبر کنید و دوباره دریافت نتیجه را امتحان کنید.",
    message_en: "This encounter is still being evaluated. Wait briefly, then retry to retrieve the result."
  });
  const session = (req.body?.session && typeof req.body.session === "object") ? req.body.session : {};
  const caseData = loadCase(caseId);
  if (!caseData) return res.status(404).json({ error: "case not found", stage: "case" });
  if (refuseInactiveCase(res, req.user, caseId)) return;
  const acc = hasAccess(req.user, caseId, classId, examId);
  if (!acc.allowed) return denyAccess(res, acc, "evaluate");
  const acceptedStudyId = studyForContext({ classId, examId })?.id || null;
  const recheckEvaluationAccess = () => {
    const live = db.prepare("SELECT status,role,token_ver FROM users WHERE id=?").get(req.user.id);
    if (!live || live.status !== "active" || live.role !== req.user.role || Number(live.token_ver || 1) !== Number(req.user.ver || 1)) {
      res.status(401).json({ error: "authorization_changed", stage: "evaluate", attemptStored: false }); return false;
    }
    if (refuseInactiveCase(res, req.user, caseId)) return false;
    // Use submission time for the exam window, but current membership, budget
    // and consent. A slow model must not turn an on-time submission into a late one.
    const current = hasAccess(req.user, caseId, classId, examId, acceptedAt);
    if (!current.allowed) { denyAccess(res, current, "evaluate"); return false; }
    if ((studyForContext({ classId, examId })?.id || null) !== acceptedStudyId) {
      res.status(409).json({ error: "study_context_changed", stage: "evaluate", attemptStored: false }); return false;
    }
    return true;
  };
  const checklist = loadChecklist(caseData.checklist_id);
  const globalSettings = getSetting("exam", {});
  const { aiCfg, prompts } = engineContext(req, req.body);

  // Per-exam settings override the global defaults when this is a scheduled exam.
  let showAi = globalSettings.showAiAnalysis, showMicro = globalSettings.showMicro;

  /* Grading scope from the class the student took this in:
       grading_role "history"  → EXTERN  (score = history + exam + problem list + ddx)
       grading_role "overall"  → INTERN  (score = all sections)
       grading_role "both"/∅   → overall (report still shows both criteria).
     This is what the teacher selected when creating the class; before this
     existed the stored score was ALWAYS the overall one. */
  const { ownerClassId, ownerExamId } = containersFor(req.user, classId, examId, acc);
  if (ownerExamId) {
    const ex = db.prepare("SELECT show_ai, show_micro FROM exams WHERE id=?").get(ownerExamId);
    if (ex) { showAi = !!ex.show_ai; showMicro = !!ex.show_micro; }
  }
  let gradingScope = "overall";
  if (ownerClassId) {
    const cl = db.prepare("SELECT grading_role FROM classes WHERE id=?").get(ownerClassId);
    const role = cl?.grading_role;
    if (role === "history") gradingScope = "extern";
    else if (role === "overall") gradingScope = "intern";
  }
  const gradingRubric = resolveClassRubric(ownerClassId);

  // A final graded attempt must be AI-scored AND AI-taught by default.
  // Explicit offline mode is for diagnostics, never an implicit provider fallback.
  const requireAi = process.env.VP_REQUIRE_AI_EVALUATION !== "0";
  const aiUnavailable = (aiStage, failure = {}) => {
    const detail = String(failure.error || "");
    const known = new Set(["rate_limit", "credits", "credentials", "timeout", "cooldown", "provider_unavailable"]);
    const failureCode = known.has(failure.code) ? failure.code : aiStage === "configuration" ? "configuration"
      : /429/.test(detail) ? "rate_limit" : /402/.test(detail) ? "credits"
      : /401/.test(detail) ? "credentials" : /403/.test(detail) ? "access_denied"
      : /timed? ?out|aborted/i.test(detail) ? "timeout"
      : /cooling down/i.test(detail) ? "cooldown"
      : /Invalid|no final text|empty|JSON/i.test(detail) ? "invalid_output" : "provider_unavailable";
    // Only allow-listed diagnostics leave the server, never provider bodies/keys.
    return res.status(503).json({
    failureCode, elapsedMs: Math.max(0, Date.now() - acceptedAt),
    error: "ai_evaluation_unavailable", stage: "evaluate", aiStage,
    retryable: true, attemptStored: false,
    message_fa: "ارزیابی هوش مصنوعی کامل نشد؛ نمره نهایی ثبت نشده و فرصتی کسر نشده است. پس از رفع مشکل دوباره ارزیابی کنید.",
    message_en: "AI evaluation is incomplete. No final grade was saved or attempt consumed. Retry after the issue is resolved.",
  });
  };
  if (requireAi && !aiCfg?.apiKey) return aiUnavailable("configuration");

  // Bind the ephemeral retry checkpoint to the owned session and every input
  // affecting judgment. A changed encounter, rubric, model or key re-grades.
  const fingerprint = evaluationFingerprint({ user: req.user.id, ver: req.user.ver, role: req.user.role,
    sessionId, caseData, checklist, session, lang, gradingScope, gradingRubric,
    classId, examId, studyId: acceptedStudyId, aiCfg, prompts });
  const scoringStartedAt = Date.now();
  const cached = vpSession ? retryScoreGet(sessionId, req.user.id, fingerprint) : null;
  let evalResult = cached?.result || evaluate({ caseData, checklist, session, lang, scope: gradingScope, rubric: gradingRubric });
  if (!cached) {
    evalResult = await scoreChecklistWithLLM({ base: evalResult, caseData, checklist, session, lang, aiCfg });
    // Token metering: AI grading of the (often long) encounter transcript is
    // the second-largest VP cost after chat; count it against the org budget.
    bumpUsage(resolveVpUniversity({ classId: ownerClassId, examId: ownerExamId, userId: req.user.id }),
      { tokens: estimateTokens(JSON.stringify(session).slice(0, 40000), JSON.stringify(evalResult).slice(0, 20000)) });
  }
  if (!recheckEvaluationAccess()) { retryScoreDrop(sessionId, req.user.id); return; }
  const scoringRoute = cached?.scoringRoute || (aiCfg.lastRoute ? { ...aiCfg.lastRoute } : null);
  if (requireAi && (evalResult.source !== "llm" || evalResult.scoreFallback)) return aiUnavailable("checklist", evalResult.scoreFallback);
  if (!cached && vpSession) retryScorePut(sessionId, req.user.id, fingerprint, { result: evalResult, scoringRoute });
  const checklistMs = Math.max(0, Date.now() - scoringStartedAt);
  const lessonStartedAt = Date.now();
  // 3) Enrich the qualitative feedback + personalized micro-lesson with the LLM.
  evalResult = await enrichEvaluationWithLLM({
    base: evalResult, caseData, session, lang, prompts, aiCfg, scope: gradingScope,
  });
  if (requireAi && (evalResult.feedbackSource !== "llm" || evalResult.feedbackFallback)) return aiUnavailable("lesson", evalResult.feedbackFallback);
  if (!recheckEvaluationAccess()) { retryScoreDrop(sessionId, req.user.id); return; }
  const latestSettings = getSetting("exam", {});
  const latestExam = ownerExamId ? db.prepare("SELECT show_ai,show_micro FROM exams WHERE id=?").get(ownerExamId) : null;
  showAi = !!showAi && !!(latestExam ? latestExam.show_ai : latestSettings.showAiAnalysis);
  showMicro = !!showMicro && !!(latestExam ? latestExam.show_micro : latestSettings.showMicro);
  // 4) Apply the class's grading scope to the FINAL stored score. Externs are
  //    graded up to and including the problem list; interns on every section.
  //    (Fallbacks keep old checklists — without exam/problem-list items —
  //    scoring sanely: extern → history-only score, then overall.)
  const ss = evalResult.sectionScores || {};
  let finalScore = ss.overall ?? evalResult.score ?? 0;
  if (gradingScope === "extern") finalScore = ss.extern ?? ss.history ?? finalScore;
  else if (gradingScope === "intern") finalScore = ss.intern ?? ss.overall ?? finalScore;
  if (finalScore != null) {
    evalResult.score = finalScore;
    evalResult.score10 = Math.round(finalScore / 10);
  }
  // /10 score for OSCE-style review (kept alongside the % for the UI + teacher).
  if (evalResult.score10 == null) evalResult.score10 = Math.round((evalResult.score || 0) / 10);
  evalResult.meta = {
    ...(evalResult.meta || {}),
    gradingScope,
    scoringRoute,
    timings: { checklistMs, lessonMs: Math.max(0, Date.now() - lessonStartedAt), totalMs: Math.max(0, Date.now() - acceptedAt), checklistReused: !!cached },
    teachingRoute: aiCfg.lastRoute ? { ...aiCfg.lastRoute } : null,
    externScore: ss.extern ?? ss.history ?? null,
    internScore: ss.intern ?? ss.overall ?? null,
  };

  const studentTurns = asMessages(session.messages).filter((m) => m.role === "student").length;
  // Client-reported duration is validated, not trusted: coerce + clamp, and keep
  // the RAW value alongside so an analyst can spot tampering in the study data.
  const durationValidated = clampDuration(durationSec);
  evalResult.meta = {
    ...(evalResult.meta || {}),
    durationSecClient: Number.isFinite(Number(durationSec)) ? Number(durationSec) : null,
    durationSecUsed: durationValidated,
    scoredBy: evalResult.source || "mock",
    feedbackBy: evalResult.feedbackSource || "mock",
    ...(evalResult.feedbackFallback ? { feedbackFallback: evalResult.feedbackFallback } : {}),
  };
  // A research study must be able to tell WHICH attempts were LLM-scored and
  // which silently fell back to keyword scoring. Surface + audit it.
  if (evalResult.scoreFallback) {
    evalResult.meta.scoreFallback = evalResult.scoreFallback;
    try {
      audit(req, "vpatient.scoring_fallback", "attempt", {
        caseId: caseData.id, classId: ownerClassId, examId: ownerExamId,
        stage: evalResult.scoreFallback.stage, error: String(evalResult.scoreFallback.error || "").slice(0, 500),
        hadApiKey: !!aiCfg?.apiKey,
      });
    } catch { /* auditing must never break the exam */ }
  }

  // strip sections disabled by settings
  const out = { ...evalResult };
  out.showAi = !!showAi;
  out.showMicro = !!showMicro;
  if (!showAi) {
    out.strengths = out.weaknesses = out.missed = out.commonMistakes = [];
    out.suggestion = "";
    out.orderReview = { appropriate: [], unnecessary: [], missedKey: [] };
    out.results = [];
    delete out.finalDxCorrect;
    delete out.sectionScores;
  }
  if (!showMicro) out.microlearning = "";

  /* PRIVACY: the transcript is stored ONLY when logging is switched on for this
     class/exam. With logging off the attempt still gets its score (grading must
     keep working) but attempts.transcript_json stays NULL — "we did not record
     this conversation" is then literally true, not just a UI claim. */
  const logging = vpSession ? !!vpSession.logging_enabled : loggingEnabledFor(ownerClassId, ownerExamId);
  evalResult.meta.loggingEnabled = logging;
  evalResult.meta.showAi = !!showAi; evalResult.meta.showMicro = !!showMicro;

  const transcriptObj = logging ? {
    ...session,
    microlearning: out.microlearning || "",
    strengths: out.strengths || [],
    weaknesses: out.weaknesses || [],
    suggestion: out.suggestion || "",
  } : null;

  let logResult = { stored: 0, loggingEnabled: logging, dropped: 0 };
  const info = db.transaction(() => {
  const inserted = db.prepare(
    `INSERT INTO attempts (user_id,type,case_id,class_id,exam_id,content_version,score,transcript_json,eval_json,
       turns,tests,imaging_count,ddx_count,hints,duration_sec,lang)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    req.user.id, "vp", caseData.id, ownerClassId, ownerExamId, caseData.version, evalResult.score,
    transcriptObj ? JSON.stringify(transcriptObj) : null, JSON.stringify(evalResult),
    studentTurns,
    (session.tests || []).length, (session.imaging || []).length, (session.ddx || []).length,
    0, durationValidated, lang
  );

  /* Close the session and persist the timestamped interaction log (when on).
     The server-side start stamp also gives a duration the client cannot fake;
     we keep the smaller of the two so a tampered client value can only ever
     understate, never inflate, the recorded encounter length. */
  if (vpSession) {
    const serverElapsed = serverElapsedSec(vpSession);
    /* The server-measured wall clock is the honest number. A client may claim
       more than it actually spent, so take the smaller of the two; the raw
       client value stays in meta.durationSecClient so tampering is auditable. */
    const finalDuration = Math.max(0, Math.round(Math.min(durationValidated, serverElapsed)));
    logResult = finishSession({ sessionId: vpSession.id, userId: req.user.id, events, durationSec: finalDuration, attemptId: inserted.lastInsertRowid, persist: false });
    if (logResult.error || logResult.alreadyFinished) throw new Error("Session changed during evaluation");
    db.prepare("UPDATE attempts SET duration_sec=? WHERE id=?").run(finalDuration, inserted.lastInsertRowid);
    evalResult.meta.durationSecServer = Math.round(serverElapsed);
    // What actually landed in attempts.duration_sec, so an analyst never has to
    // guess which of the two candidate values the row holds.
    evalResult.meta.durationSecRecorded = finalDuration;
  }
  db.prepare("UPDATE attempts SET eval_json=? WHERE id=?").run(JSON.stringify(evalResult), inserted.lastInsertRowid);
  return inserted;
  })();
  out.meta = evalResult.meta;
  out.logging = { enabled: logResult.loggingEnabled, eventsStored: logResult.stored, eventsDropped: logResult.dropped };
  const studyId = studyForContext({ classId: ownerClassId, examId: ownerExamId })?.id || null;
  if (studyId) {
    recordStudyEvent({
      studyId, userId: req.user.id, eventType: "session_finished",
      contextType: ownerExamId ? "exam" : "class", contextId: ownerExamId || ownerClassId,
      data: { attemptId: info.lastInsertRowid, caseId: caseData.id, score: evalResult.score, type: "vp" },
    });
  }

  // ---- Competitive ranking XP (learners only) ----
  // The auto-evaluator's score% is converted to ranking XP via the admin-set
  // per-case cap. Best-score policy: replaying only tops up XP if you do better,
  // so ranking reflects best performance and can't be farmed. (No effect for
  // students/teachers/admins or for scheduled class exams.)
  if (req.user.role === "learner") {
    try {
      const award = awardVpatientXp(req.user.id, caseData, evalResult.score);
      out.xpReward = {
        awarded: award.awarded, xpMax: award.xpMax,
        best: award.best, prevBest: award.prevBest, scorePct: evalResult.score,
      };
      const { getProfile } = await import("../lib/gamify.js");
      out.profile = getProfile(req.user.id);
    } catch { /* XP is best-effort; the evaluation still returns */ }
  }

  // Students/learners get the score, not the teacher-authored rubric snapshot.
  // The snapshot stays in attempts.eval_json (INSERT above) for staff review.
  if (req.user.role === "student" || req.user.role === "learner") {
    if (out.meta) {
      const { rubric: _rubricSnap, ...metaPub } = out.meta;
      out.meta = metaPub;
    }
    if (out.sectionScores) {
      const { rubric: _ssRubric, ...ssPub } = out.sectionScores;
      out.sectionScores = ssPub;
    }
  }

  persistNow({ throwOnError: true });
  retryScoreDrop(sessionId, req.user.id);
  res.json({ attemptId: info.lastInsertRowid, ...out });
  } catch (e) {
    res.status(500).json({ error: "evaluate_failed", stage: "evaluate", message: String(e.message || e).slice(0, 200) });
  } finally {
    releaseCompletion?.();
  }
});

/* ---- Flashcard practice submit (multiple choice / search) ---- */
const flashResultSchema = {
  score: vs.num({ optional: true, min: 0, max: 100, clamp: true }),
  hints: vs.int({ optional: true, min: 0, max: 1000, clamp: true }),
  durationSec: vs.num({ optional: true, min: 0, max: 86400, clamp: true }),
  lang: vs.str({ optional: true, max: 5 }),
  examId: vs.int({ optional: true, min: 1 }),
  total: vs.int({ optional: true, min: 0, max: 10000, clamp: true }),
  correct: vs.int({ optional: true, min: 0, max: 10000, clamp: true }),
  wrong: vs.int({ optional: true, min: 0, max: 10000, clamp: true }),
  answers: vs.array((x, pp) => (x && typeof x === "object" && !Array.isArray(x)
    ? { ok: true, value: x } : { ok: false, error: `${pp} must be an object` }), { optional: true, max: 300 }),
};
r.post("/flashcard-result", authRequired, validateBody(flashResultSchema), (req, res) => {
  try {
  const { score, hints = 0, durationSec = 0, lang = "fa", examId,
          total = 0, correct = 0, wrong = 0, answers = [] } = req.body || {};
  // Only enrolled students may attach a flash result to a university exam.
  // Learners/teachers sending examId would otherwise land in the gradebook.
  const examOwner = req.user.role === "student" ? (examId || null) : null;
  let examDeck = null;
  if (examOwner) {
    const acc = examAccess(req.user.id, examOwner, null);
    if (!acc.allowed) {
      const reason = acc.reason || "not_assigned";
      const msg = reason === "window" ? "exam window closed"
        : reason === "attempts_exhausted" ? "attempts exhausted" : "not assigned to this exam";
      return res.status(403).json({ error: msg, reason, stage: "exam" });
    }
    examDeck = acc.exam;
  }
  let scoreN = Math.max(0, Math.min(100, Number(score) || 0));
  const answerRows = Array.isArray(answers) ? answers : [];
  if (req.user.role === "student" || req.user.role === "learner") {
    const loadFlash = (id) => {
      const row = db.prepare("SELECT * FROM flashcards WHERE id=?").get(id);
      if (!row) return null;
      try { return { ...JSON.parse(row.data_json), id: row.id }; } catch { return null; }
    };
    const expectedIds = examOwner && examDeck
      ? (examDeck.flashcard_ids || []).map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : null;
    if (answerRows.length || expectedIds) {
      // Same no-penalty policy as class decks; for scheduled exams the flag
      // comes from the exam's university (classes are not involved here).
      const orgUni = examDeck?.university_id || resolveVpUniversity({ userId: req.user.id });
      const noPenalty = effectiveFlashNoPenalty(null, orgUni);
      const deck = gradeSubmittedDeckDetailed(loadFlash, answerRows, expectedIds, { noPenalty });
      if (deck.error === "duplicate_card") return res.status(400).json({ error: "duplicate_card", stage: "evaluate" });
      if (deck.error === "answers_out_of_deck") return res.status(400).json({ error: "answers_out_of_deck", stage: "evaluate" });
      if (deck.score != null) scoreN = deck.score;
    } else if (examOwner) {
      scoreN = 0;
    }
  }
  const totalN = Math.max(0, Math.min(10000, Number(total) || 0));
  const correctN = Math.max(0, Math.min(totalN || 10000, Number(correct) || 0));
  const wrongN = Math.max(0, Math.min(totalN || 10000, Number(wrong) || 0));
  const hintsN = Math.max(0, Math.min(100, Number(hints) || 0));
  const durN = clampDuration(durationSec);
  const info = db.prepare(
    `INSERT INTO attempts (user_id,type,case_id,exam_id,content_version,score,transcript_json,
       turns,tests,hints,total_questions,correct_count,wrong_count,duration_sec,lang)
     VALUES (?,?,?,?,?,?,?,0,0,?,?,?,?,?,?)`
  ).run(req.user.id, "flash", null, examOwner, 1, scoreN,
        JSON.stringify({ answers: Array.isArray(answers) ? answers : [] }),
        hintsN, totalN, correctN, wrongN, durN, lang);
  if (examOwner) {
    const studyId = studyForContext({ examId: examOwner })?.id || null;
    if (studyId) {
      recordStudyEvent({
        studyId, userId: req.user.id, eventType: "flashcard_finished",
        contextType: "exam", contextId: examOwner,
        data: { attemptId: info.lastInsertRowid, score: scoreN, type: "flash" },
      });
    }
  }
  res.json({ attemptId: info.lastInsertRowid, score: scoreN });
  } catch (e) {
    res.status(500).json({ error: "flashcard_result_failed", stage: "evaluate", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- List available AI providers (admin only) ---- */
r.get("/ai-providers", authRequired, requireRole("admin", "teacher"), (req, res) => {
  try { res.json(listAiProviders()); }
  catch (e) { res.status(500).json({ error: "ai_providers_failed", stage: "boot", message: String(e.message || e).slice(0, 200) }); }
});

/* ---- Test AI connection (admin/teacher) — hits the SAME path the VP chat uses. ---- */
r.post("/ai-test", authRequired, requireRole("admin", "teacher"), async (req, res) => {
  const uniAi = resolveAiConfig(getSetting("ai", {}));
  const vpAi = getVpatientAiEffective();
  const aiCfg = uniAi.routingEnabled || uniAi.apiKey ? uniAi : (vpAi.apiKey ? vpAi : uniAi);
  if (!aiCfg.apiKey) return res.json({ connected: false, mode: "mock", message: "No API key — using mock engine." });
  try {
    const lang = req.body?.lang === "en" ? "en" : "fa";
    // Use a realistic mini-case so the admin sees a genuine patient-style reply.
    const result = await patientReply({
      caseData: lang === "fa"
        ? { chief_fa: "درد قفسه سینه", history_fa: "درد فشارنده از یک ساعت پیش، انتشار به بازوی چپ" }
        : { chief_en: "chest pain", history_en: "pressure-like pain for an hour, radiating to left arm" },
      userText: lang === "fa" ? "سلام، چه مشکلی دارید؟" : "Hello, what brings you in today?",
      lang, prompts: loadPrompts(), aiCfg,
    }, { throwOnError: true });   // surface the REAL provider error to the admin
    const ok = result.source === "llm";
    const cur = getSetting("ai", {});
    db.prepare("UPDATE settings SET value=? WHERE key='ai'").run(JSON.stringify({ ...cur, connected: ok }));
    res.json({
      connected: ok, mode: result.source,
      provider: aiCfg.lastRoute?.provider || aiCfg.provider || "", model: aiCfg.lastRoute?.model || aiCfg.model || "",
      route: aiCfg.lastRoute || null,
      sample: result.text || "",
    });
  } catch (e) {
    res.json({ connected: false, mode: "mock", message: String(e.message) });
  }
});

export default r;
