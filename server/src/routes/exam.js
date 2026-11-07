import { sealEncounter, readEncounter } from "../lib/vp-encounter.js";
import { evaluationFingerprint, claimGrading, releaseGrading, markFinishRequested, recordGradingFailure, failureKind, accessRevoked, readDraft, writeDraft } from "../lib/vp-grading.js";
import { acquireCompletion, completionBusy, completionKey, publicEvaluation } from "../lib/vp-completion.js";
/* ================================================================
   exam.js — Virtual patient chat + evaluation + flashcard submit.
   All AI logic lives server-side; prompts pulled from DB.
   ================================================================ */
import { Router } from "express";
import { createHash } from "node:crypto";
import { effectiveFlashNoPenalty, effectiveFlashAllowChange } from "../lib/orglimits.js";
import { db, durableTransaction } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";
import { validateBody, s as vs } from "../lib/validate.js";
import { patientReply, evaluate, scoreChecklistWithLLM, enrichEvaluationWithLLM, labImagingResult, listAiProviders, asMessages, resolveAiConfig } from "../lib/ai-engine.js";
import { extractReportBundle, takeTranslationBudget } from "../lib/report-translate.js";
import { takeAiTurn } from "../lib/ai-budget.js";
import { getSetting, setSetting, canAccessCase, studentSafeCase } from "./content.js";
import { caseInLiveExam } from "../lib/live-exam-content.js";
import { caseIsLearn } from "../lib/content-track.js";
import { DEFAULT_LAB_TESTS, DEFAULT_IMAGING, DEFAULT_PARACLINIC, cleanOrderList, catalogContainsQuery } from "../data/order-catalog-defaults.js";
import { classAttemptInfo } from "./classes.js";
import { examAccess } from "./exams.js";
import { scoreSubmittedAnswers, gradeSubmittedDeck, gradeSubmittedDeckDetailed, changedCardCount } from "../lib/flashcard-grade.js";
import { getVpatientConfig, awardVpatientXp, getVpatientAiEffective, getVpatientPromptsEffective, vpatientAccess } from "../lib/vpatient.js";
import { isEnabled } from "../lib/flags.js";
import { audit } from "../lib/audit.js";
import { startSession, getSession, finishSession, loggingEnabledFor, serverElapsedSec, invalidStartRequestId, preserveEncounterLog } from "../lib/vplogging.js";
import { limitSecFor, deadlineOf, isExpired, savesOpen, expiredFlashRun, remainingSec, findOpenVpSession, findGradingPending, findOpenFlashSession, findExpiredOpenFlash, flashRemaining, readVpProgress, saveVpProgress, readFlashProgress, saveFlashProgress, closeFlashProgress } from "../lib/timed-session.js";
import { normalizeRubric, parseClassRubric } from "../lib/grading-rubric.js";
import { parseReferenceSnapshot, referenceSnapshotForPolicy, referencePromptContract, decorateMicrolearning, publicReferenceSnapshot, selectedReferenceSnapshot } from "../lib/reference-governance.js";

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
  // Competitive learners reach virtual patients through the gated learner feature, NOT class or
  // exam assignments: learn-track cases only, and only while the admin config grants access.
  // Learners are deliberately unlimited (the best-score XP policy handles farming).
  if (user.role === "learner") {
    if (classId || examId || !caseIsLearn(caseId)) return { allowed: false, reason: "university_only" };
    const vp = vpatientAccess(getProfile(user.id), user.role);
    if (!vp.ok) return { allowed: false, reason: vp.reason || "off" };
    return { allowed: true };
  }
  if (['content_manager', 'support'].includes(user.role)) return { allowed: false, reason: 'university_only' };
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

  const tenant = db.prepare("SELECT university_id FROM users WHERE id=?").get(user.id)?.university_id;
  const caseTenant = db.prepare("SELECT university_id FROM cases WHERE id=?").get(caseId)?.university_id;
  if (!tenant || (caseTenant != null && Number(caseTenant) !== Number(tenant))) return { allowed:false, reason:"wrong_university" };
  if (classId) {
    const classUni = db.prepare("SELECT university_id FROM classes WHERE id=?").get(classId)?.university_id;
    if (classUni != null && Number(classUni) !== Number(tenant)) return {allowed:false,reason:"wrong_university"};
  }
  if (examId) {
    const examUni = db.prepare("SELECT university_id FROM exams WHERE id=?").get(examId)?.university_id;
    if (examUni != null && Number(examUni) !== Number(tenant)) return {allowed:false,reason:"wrong_university"};
  }

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

/* R69: opaque, non-reversible key that pins one encounter to one upstream provider
   (OpenRouter session_id → prompt-cache hits across turns). Hashed so no user id,
   encounter id or case id is sent to the provider. */
function encounterRouteKey(req, caseId) {
  return createHash("sha256").update(`vp|${req.user?.id || ""}|${req.body?.sessionId || ""}|${caseId || ""}`).digest("hex").slice(0, 48);
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
    // A legacy row receives its first sealed snapshot here; current cases have
    // one persisted by the authoring/migration flow. Never derive a session
    // snapshot from a later policy edit when an existing case snapshot exists.
    // Admin-selected references (reference_ids) take precedence over a course policy.
    const referenceSnapshot = selectedReferenceSnapshot(JSON.parse(row.data_json)) || (row.reference_snapshot_json
      ? parseReferenceSnapshot(row.reference_snapshot_json)
      : referenceSnapshotForPolicy(row.reference_policy_id));
    return { ...JSON.parse(row.data_json), id: row.id, version: row.version, checklist_id: row.checklist_id,
      public_code: row.public_code, difficulty: row.difficulty, university_id: row.university_id, active: row.active,
      reference_policy_id: row.reference_policy_id || null, reference_snapshot: referenceSnapshot };
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
   itself meaningful for a study (dropout). Faculty-authored content is pinned;
   learner conversation remains unrecorded when logging is off. */
r.post("/session-start", authRequired, async (req, res) => {
  try {
  const { caseId, classId, examId, lang = "fa", requestId = null } = req.body || {};
  // Validated before any resume, so a bad requestId is refused even when an open encounter exists.
  if (invalidStartRequestId(requestId)) return res.status(400).json({ error: "invalid_start_request_id", stage: "session" });
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
  // Tell the UI which criterion this class grades on, so the student sees it
  // before finishing (extern = up to the differential dx, intern = all sections).
  let gradingScope = "overall";
  if (ownerClassId) {
    const role = db.prepare("SELECT grading_role FROM classes WHERE id=?").get(ownerClassId)?.grading_role;
    if (role === "history") gradingScope = "extern";
    else if (role === "overall") gradingScope = "intern";
  }
  // R64: resume the open, unexpired encounter instead of starting another. Resuming
  // keeps the same clock and the same attempt budget, and returns the saved transcript.
  // An encounter whose time ran out, but which no sweep has settled yet, is finalized
  // as it stood first. A quick return therefore never opens a second attempt.
  // R101: an encounter that is finished or timed out but not graded yet does NOT block a new
  // one. Grading is durable and runs in the background (retried with backoff while the AI is
  // down), so an AI outage must never stop a student from starting, resuming, or leaving. An
  // attempt is spent only when it is actually scored, and the budget check at scoring time
  // (see evaluateRoute) lets only the first scored encounter take it. The chat of every
  // encounter is kept as a log either way.
  const pending = findGradingPending({ userId: req.user.id, caseId: caseData.id, classId: ownerClassId, examId: ownerExamId, studyId, lang });
  if (pending && (pending.next_try_ms == null || Number(pending.next_try_ms) <= Date.now())) {
    // Nudge the grader without holding this request. The lease makes a repeat a no-op.
    const { kickGrading } = await import("../lib/timed-expiry.js");
    kickGrading(pending);
  }
  const resumable = findOpenVpSession({ userId: req.user.id, caseId: caseData.id, classId: ownerClassId, examId: ownerExamId, studyId, lang });
  if (resumable) {
    const pinnedResume = encounterOrDeny(res, resumable, "session");
    if (!pinnedResume) return;
    const now = Date.now();
    const snap = readVpProgress(resumable);
    const body = {
      sessionId: resumable.id, loggingEnabled: !!resumable.logging_enabled, lang: resumable.lang,
      serverNow: now, deadlineMs: deadlineOf(resumable), remainingSec: remainingSec(resumable, now), elapsedSec: Math.round(serverElapsedSec(resumable)), resumed: true,
      progress: snap.session, events: snap.events,
      gradingScope: pinnedResume.gradingScope, caseCard: studentSafeCase(pinnedResume.caseData),
    };
    if (req.user.role !== "student" && req.user.role !== "learner") body.gradingRubric = pinnedResume.gradingRubric;
    return res.json(body);
  }
  let gradingRubric = resolveClassRubric(ownerClassId);
  // R64: the time limit comes from the container (class timer, exam duration, or the
  // practice setting). The browser never supplies it.
  const limitSec = limitSecFor({ classId: ownerClassId, examId: ownerExamId,
    fallbackMin: req.user.role === "learner" ? 15 : (getSetting("exam", {}).duration || 15) });
  const s = startSession({
    limitSec, userId: req.user.id, caseId: caseData.id,
    classId: ownerClassId, examId: ownerExamId, lang,
    studyId, requestId, encounterSnapshotJson: sealEncounter({ caseData, checklist: loadChecklist(caseData.checklist_id), gradingScope, gradingRubric }), referenceSnapshotJson: JSON.stringify(caseData.reference_snapshot),
  });
  if (s.error) return res.status(s.status).json({ error: s.error, stage: "session" });
  const pinned = encounterOrDeny(res, getSession(s.sessionId), "session");
  if (!pinned) return;

  if (studyId && !s.replayed) {
    recordStudyEvent({
      studyId, userId: req.user.id, eventType: "session_started",
      contextType: ownerExamId ? "exam" : "class", contextId: ownerExamId || ownerClassId,
      data: { caseId: caseData.id, sessionId: s.sessionId },
    });
  }
  gradingRubric = pinned.gradingRubric;
  const payload = { ...s, remainingSec: remainingSec(getSession(s.sessionId)), gradingScope: pinned.gradingScope, caseCard: studentSafeCase(pinned.caseData) };
  if (req.user.role !== "student" && req.user.role !== "learner") payload.gradingRubric = gradingRubric;
  res.json(payload);
  } catch (e) {
    res.status(500).json({ error: "session_failed", stage: "session", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Leaving an encounter (R64) ----
   Fired when the student leaves (unload, navigation, dropped connection). It no
   longer closes the encounter: the student may come back and continue until the
   deadline. This call only saves what is known, and only while the encounter is
   still open. A finished encounter answers resumable:false. */
r.post("/session-abandon", authRequired, (req, res) => {
  try {
  const { sessionId, events = [] } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: "session_id_required", stage: "session" });
  const owned = getSession(sessionId);
  if (!owned) return res.status(404).json({ error: "session_not_found", stage: "session" });
  if (Number(owned.user_id) !== Number(req.user.id)) return res.status(403).json({ error: "not_your_session", stage: "session" });
  // A grading run in progress owns this encounter: leaving must not race it.
  if (completionBusy(completionKey({ sessionId: owned.id, userId: req.user.id, caseId: owned.case_id }))) return res.status(409).json({ error: "evaluation_in_progress", stage: "session", retryable: true });
  // Finished, or finish requested: the server grades it without the student. Nothing to keep open.
  if (owned.finished_at || owned.finish_requested_ms) return res.json({ ok: true, resumable: false, stored: 0 });
  const consent = assertConsent(req.user, { classId: owned.class_id, examId: owned.exam_id });
  if (!consent.ok) return denyAccess(res, { ...consent, allowed: false }, "session");
  const study = studyForContext({ classId: owned.class_id, examId: owned.exam_id });
  if (Number(owned.study_id || 0) !== Number(study?.id || 0)) return res.status(409).json({ error: "study_context_changed", stage: "session" });
  const expired = !savesOpen(owned);
  const prior = readVpProgress(owned);
  const withEvents = owned.logging_enabled && Array.isArray(events) ? { ...prior.session, events } : prior.session;
  const saved = expired ? { ok: false } : saveVpProgress(owned.id, withEvents);
  // Not acknowledged unless stored (e.g. too large): the browser keeps its copy.
  if (!expired && !saved.ok) return res.status(413).json({ error: saved.error || "progress_too_large", stage: "session" });
  res.json({ ok: true, resumable: !expired, stored: saved.ok ? 1 : 0, deadlineMs: deadlineOf(owned) });
  } catch (e) {
    res.status(500).json({ error: "session_failed", stage: "session", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Autosave the encounter so far (R64) ----
   Called after each change in the browser (debounced). Stored server-side so a
   reload or a dropped connection resumes the same transcript, and so an expired
   encounter can be finalized as it stood. Events are kept only when logging is on. */
r.put("/session-progress", authRequired, (req, res) => {
  try {
  const { sessionId, progress = {}, events = [] } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: "session_id_required", stage: "session" });
  const owned = getSession(sessionId);
  if (!owned) return res.status(404).json({ error: "session_not_found", stage: "session" });
  if (Number(owned.user_id) !== Number(req.user.id)) return res.status(403).json({ error: "not_your_session", stage: "session" });
  if (owned.finished_at) return res.status(409).json({ error: "session_closed", stage: "session" });
  if (owned.finish_requested_ms) return res.status(409).json({ error: "finish_requested", stage: "session", retryable: false });
  if (completionBusy(completionKey({ sessionId: owned.id, userId: req.user.id, caseId: owned.case_id }))) return res.status(409).json({ error: "evaluation_in_progress", stage: "session", retryable: true });
  if (!savesOpen(owned)) return res.status(409).json({ error: "session_expired", stage: "session", remainingSec: 0 });
  const study = studyForContext({ classId: owned.class_id, examId: owned.exam_id });
  if (Number(owned.study_id || 0) !== Number(study?.id || 0)) return res.status(409).json({ error: "study_context_changed", stage: "session" });
  const consent = assertConsent(req.user, { classId: owned.class_id, examId: owned.exam_id });
  if (!consent.ok) return denyAccess(res, { ...consent, allowed: false }, "session");
  const body = progress && typeof progress === "object" ? progress : {};
  const withEvents = owned.logging_enabled && Array.isArray(events) ? { ...body, events } : body;
  const saved = saveVpProgress(owned.id, withEvents);
  if (!saved.ok) return res.status(413).json({ error: saved.error, stage: "session" });
  res.json({ ok: true, remainingSec: remainingSec(owned) });
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
    if (req.body?.sessionId) {
      const session = getSession(req.body.sessionId);
      if (!session || session.finished_at) { res.status(409).json({ error: "session_closed", stage }); return false; }
      // R64: the deadline ends interaction. The attempt is graded from the saved snapshot.
      if (isExpired(session)) { res.status(409).json({ error: "session_expired", stage, remainingSec: 0 }); return false; }
    }
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

function encounterOrDeny(res, session, stage) {
  try { return readEncounter(session); }
  catch (error) {
    res.status(409).json({ error: error.message, stage, attemptStored: false,
      message_fa: "نسخهٔ ثابت این برخورد موجود یا معتبر نیست. بدون مصرف فرصت، یک برخورد جدید شروع کنید.",
      message_en: "This encounter has no valid saved clinical version. Start a new encounter; no attempt was consumed." });
    return null;
  }
}
function interactionContext(req, res, stage) {
  const { caseId, classId, examId, sessionId } = req.body || {};
  if (!sessionId) {
    if (process.env.VP_REQUIRE_AI_EVALUATION !== "0" && ["student", "learner"].includes(req.user.role)) {
      res.status(400).json({ error: "session_id_required", stage }); return null;
    }
    return { caseId, classId, examId, session: null, snapshot: null };
  }
  const session = getSession(sessionId);
  if (!session) { res.status(404).json({ error: "session_not_found", stage }); return null; }
  if (Number(session.user_id) !== Number(req.user.id)) { res.status(403).json({ error: "not_your_session", stage }); return null; }
  if (Number(session.case_id) !== Number(caseId) || (classId != null && Number(classId) !== Number(session.class_id)) || (examId != null && Number(examId) !== Number(session.exam_id))) {
    res.status(409).json({ error: "session_context_mismatch", stage }); return null;
  }
  if (session.finished_at) { res.status(409).json({ error: "session_closed", stage }); return null; }
  // Finish was pressed: the transcript is frozen and waiting for grading. No more turns.
  if (session.finish_requested_ms) { res.status(409).json({ error: "finish_requested", stage, retryable: false }); return null; }
  if (isExpired(session)) { res.status(409).json({ error: "session_expired", stage, remainingSec: 0 }); return null; }
  const context = { classId: session.class_id, examId: session.exam_id };
  if (Number(session.study_id || 0) !== Number(studyForContext(context)?.id || 0)) {
    res.status(409).json({ error: "study_context_changed", stage }); return null;
  }
  const snapshot = encounterOrDeny(res, session, stage);
  return snapshot ? { caseId, ...context, session, snapshot } : null;
}

/* ---- Patient chat turn ---- */
r.post("/patient-reply", authRequired, async (req, res) => {
  try {
    const { userText, history = [], lang = "fa" } = req.body || {};
    const context = interactionContext(req, res, "chat");
    if (!context) return;
    const { caseId, classId, examId } = context;
    const acc = hasAccess(req.user, caseId, classId, examId);
    if (!acc.allowed) return denyAccess(res, acc, "chat");
    const text = String(userText || "").trim();
    if (!text) return res.status(400).json({ error: "text_required", stage: "chat" });
    const caseData = context.snapshot?.caseData || loadCase(caseId);
    if (!caseData) return res.status(404).json({ error: "case not found", stage: "case" });
    if (refuseInactiveCase(res, req.user, caseId)) return;
    const { aiCfg, prompts } = engineContext(req, req.body);
    // R92: a model call per turn is counted per account (mock replies cost nothing and are not counted).
    if (aiCfg?.apiKey && !takeAiTurn("vp", req.user.id)) {
      return res.status(429).json({ error: "ai_rate_limited", stage: "chat",
        message_fa: "پیام‌های زیادی در چند دقیقهٔ اخیر فرستادی. کمی صبر کن.",
        message_en: "You sent many messages in the last few minutes. Wait a moment." });
    }
    const canDeliver = interactionAccessGuard(req, res, caseId, classId, examId, acc, "chat");
    // The encounter id fixes the patient's name for this encounter. The patient always says «دکتر».
    const seed = `${req.body?.sessionId || "none"}|${caseId}`;
    const result = await patientReply({ caseData, userText: text, history, lang, prompts, aiCfg },
      { seed, sessionKey: encounterRouteKey(req, caseId) });
    if (!canDeliver()) return;
    if (!String(result?.text || "").trim()) {
      return res.status(502).json({ error: "empty_reply", stage: "chat" });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "chat_failed", stage: "chat", message: String(e.message || e).slice(0, 200) });
  }
});

/* ---- Order a lab test / imaging study / paraclinical study -> report in the chat ----
   `kind` = "lab" | "imaging" | "paraclinic" (ECG, PFT, EEG, ...).
   If the case chart has a recorded result → return it (with an image if any).
   Otherwise the result is explicitly unavailable; no normal value is inferred. */
r.post("/order", authRequired, async (req, res) => {
  try {
    const { kind = "lab", query = "", lang = "fa" } = req.body || {};
    const context = interactionContext(req, res, "order");
    if (!context) return;
    const { caseId, classId, examId } = context;
    const caseData = context.snapshot?.caseData || loadCase(caseId);
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
/* The student's finish (POST /evaluate) and the background grader (lib/timed-expiry.js)
   both come through here. An open encounter is frozen at the student's finish, claimed by
   one run at a time, and a failed run is kept for retry: the chat is never closed by a
   failure, and the student does not have to stay on the page. */
const isDurableScore = (r) => r?.source === "llm" && !r?.scoreFallback;

function captureResponse(res, outcome) {
  const status = res.status.bind(res);
  res.status = (code) => { outcome.status = code; return status(code); };
  const json = res.json.bind(res);
  res.json = (body) => { outcome.body = body; return json(body); };
  return res;
}

async function evaluateRoute(req, res) {
  const session = req.body?.sessionId ? getSession(req.body.sessionId) : null;
  const open = !!session && !session.finished_at && Number(session.user_id) === Number(req.user.id);
  if (!open) return gradeEncounter(req, res);
  const now = Date.now();
  if (session.review_required) {
    // R101: an encounter that was scored after the attempt limit was already used (for example
    // a second encounter opened while the AI was down) is kept as a log, not scored again.
    if (session.expiry_error === "attempts exhausted") return res.status(409).json({
      error: "under_staff_review", stage: "evaluate", retryable: false, reason: "attempts_exhausted",
      message_fa: "این گفتگو به‌عنوان تلاش جدا نمره‌دهی نشد، چون سقف تلاش این کیس پر شده بود. تلاش ثبت‌شدهٔ قبلی شما نمره گرفته است و گفتگوی این بار حفظ شده است.",
      message_en: "This conversation was not scored as a separate attempt, because this case's attempt limit was already used. Your earlier recorded attempt was scored; this conversation is kept on record.",
    });
    return res.status(409).json({
      error: "under_staff_review", stage: "evaluate", retryable: false,
      message_fa: "این گفتگو برای بررسی مدیر ارسال شده است. گفتگوی شما حفظ شده و نیازی به ارسال دوباره نیست.",
      message_en: "This conversation was sent to staff for review. It is kept on record; no need to resend.",
    });
  }
  if (!req.systemGrading) {
    // The student's finish (or retry of it). While the time is open, the snapshot they send is the
    // one graded; after the deadline the snapshot kept at the first finish is frozen and graded.
    const body = req.body?.session && typeof req.body.session === "object" ? req.body.session : null;
    if (body && savesOpen(session, now)) {
      const events = session.logging_enabled && Array.isArray(req.body.events) ? req.body.events : null;
      const saved = saveVpProgress(session.id, events ? { ...body, events } : body);
      if (!saved.ok) return res.status(413).json({ error: saved.error, stage: "evaluate" });
    }
    if (!session.finish_requested_ms) markFinishRequested(session.id, now);
  }
  const token = claimGrading(session.id, now);
  if (!token) return res.status(409).json({
    error: "evaluation_in_progress", stage: "evaluate", retryable: true,
    message_fa: "ارزیابی این برخورد هنوز در حال انجام است؛ کمی صبر کنید و دوباره دریافت نتیجه را امتحان کنید.",
    message_en: "This encounter is still being evaluated. Wait briefly, then retry to retrieve the result.",
  });
  const outcome = { status: 200, body: null };
  try {
    await gradeEncounter(req, captureResponse(res, outcome));
  } finally {
    releaseGrading(session.id, token);
    if (outcome.status >= 400) {
      const error = outcome.body?.error || `status_${outcome.status}`;
      const kind = failureKind(outcome.status, outcome.body?.error);
      if (kind !== "busy") {
        const fresh = getSession(session.id);
        if (fresh && !fresh.finished_at && !accessRevoked(outcome.status, outcome.body?.error)) {
          preserveEncounterLog(fresh, readVpProgress(fresh).events);
        }
        recordGradingFailure(session.id, { error, kind });
      }
    }
  }
}

async function gradeEncounter(req, res) {
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
      response.reportLang = attempt.lang || stored.meta?.lang || "fa";
      return res.json({ attemptId: attempt.id, ...response, replayed: true });
    }
    if (vpSession.finished_at) return res.status(409).json({ error: "session_closed", stage: "evaluate" });
  } else if (process.env.VP_REQUIRE_AI_EVALUATION !== "0" && ["student", "learner"].includes(req.user.role)) {
    return res.status(400).json({ error: "session_id_required", stage: "evaluate" });
  }
  releaseCompletion = acquireCompletion(completionKey({ sessionId: vpSession?.id, userId: req.user.id, caseId }));
  if (!releaseCompletion) return res.status(409).json({
    error: "evaluation_in_progress", stage: "evaluate", retryable: true,
    message_fa: "ارزیابی این برخورد هنوز در حال انجام است؛ کمی صبر کنید و دوباره دریافت نتیجه را امتحان کنید.",
    message_en: "This encounter is still being evaluated. Wait briefly, then retry to retrieve the result."
  });
  // The saved snapshot is the graded record: frozen at the student's finish, or the last
  // autosave when the time ran out. After the deadline the server's time limit applies.
  const storedSnapshot = vpSession && !vpSession.finished_at ? readVpProgress(vpSession) : null;
  if (storedSnapshot) {
    events = storedSnapshot.events;
    if (isExpired(vpSession)) durationSec = vpSession.limit_sec || durationSec;
  }
  const session = storedSnapshot ? storedSnapshot.session
    : ((req.body?.session && typeof req.body.session === "object") ? req.body.session : {});
  const pinned = vpSession ? encounterOrDeny(res, vpSession, "evaluate") : null;
  if (vpSession && !pinned) return;
  const caseData = pinned?.caseData || loadCase(caseId);
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
  const checklist = pinned?.checklist || loadChecklist(caseData.checklist_id);
  // Pin educational provenance to the session start. A later policy/catalog edit
  // must never rewrite what this learner was taught or what is audited here.
  const referenceSnapshot = parseReferenceSnapshot(vpSession?.reference_snapshot_json || caseData.reference_snapshot);
  const referenceContract = referencePromptContract(referenceSnapshot, lang);
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
  if (pinned) gradingScope = pinned.gradingScope;
  const gradingRubric = pinned?.gradingRubric || resolveClassRubric(ownerClassId);

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
    retryable: true, attemptStored: false, queued: !!vpSession,
    message_fa: vpSession
      ? "گفتگوی شما ذخیره شد و در صف ارزیابی قرار گرفت. سیستم بدون نیاز به حضور شما ارزیابی را ادامه می‌دهد و نتیجه در کارنامه‌تان ظاهر می‌شود."
      : "ارزیابی هوش مصنوعی کامل نشد؛ نمره نهایی ثبت نشده و فرصتی کسر نشده است. پس از رفع مشکل دوباره ارزیابی کنید.",
    message_en: vpSession
      ? "Your conversation is saved and queued for evaluation. The system finishes it without you; the result appears in your record."
      : "AI evaluation is incomplete. No final grade was saved or attempt consumed. Retry after the issue is resolved.",
  });
  };
  if (requireAi && !aiCfg?.apiKey) return aiUnavailable("configuration");

  // Bind the stored draft to the owned session and every input
  // affecting judgment. A changed encounter, rubric, model or key re-grades.
  const fingerprint = evaluationFingerprint({ user: req.user.id, ver: req.user.ver, role: req.user.role,
    sessionId, caseData, checklist, session, lang, gradingScope, gradingRubric,
    classId, examId, studyId: acceptedStudyId, aiCfg, prompts });
  const scoringStartedAt = Date.now();
  const draft = vpSession ? readDraft(vpSession) : null;
  const cached = draft && draft.fingerprint === fingerprint ? draft : null;
  let evalResult = cached?.result || evaluate({ caseData, checklist, session, lang, scope: gradingScope, rubric: gradingRubric });
  if (!cached) evalResult = await scoreChecklistWithLLM({ base: evalResult, caseData, checklist, session, lang, aiCfg });
  if (!recheckEvaluationAccess()) return;
  const scoringRoute = cached?.scoringRoute || (aiCfg.lastRoute ? { ...aiCfg.lastRoute } : null);
  if (requireAi && (evalResult.source !== "llm" || evalResult.scoreFallback)) return aiUnavailable("checklist", evalResult.scoreFallback);
  // AI output is kept as soon as it exists, so a retry never pays for it twice.
  if (!cached && vpSession && isDurableScore(evalResult)) writeDraft(vpSession.id, { fingerprint, result: evalResult, scoringRoute });
  const checklistMs = Math.max(0, Date.now() - scoringStartedAt);
  const lessonStartedAt = Date.now();
  // 3) Enrich the qualitative feedback + personalized micro-lesson with the LLM.
  //    A retry after a failed write reuses the enriched result (no second paid call).
  const checklistResult = evalResult;
  if (cached?.enriched) {
    evalResult = cached.enriched;
  } else {
    evalResult = await enrichEvaluationWithLLM({
      base: evalResult, caseData, session, lang, prompts, aiCfg, scope: gradingScope,
      referenceSnapshot, referenceContract,
    });
    if (requireAi && (evalResult.feedbackSource !== "llm" || evalResult.feedbackFallback)) return aiUnavailable("lesson", evalResult.feedbackFallback);
    const checklistDurable = isDurableScore(cached?.result || checklistResult);
    if (vpSession && checklistDurable && evalResult.feedbackSource === "llm" && !evalResult.feedbackFallback) {
      writeDraft(vpSession.id, { fingerprint, result: cached?.result || checklistResult, scoringRoute, enriched: evalResult });
    }
  }
  if (requireAi && (evalResult.feedbackSource !== "llm" || evalResult.feedbackFallback)) return aiUnavailable("lesson", evalResult.feedbackFallback);
  if (!recheckEvaluationAccess()) return;
  evalResult.microlearning = decorateMicrolearning(evalResult.microlearning, referenceSnapshot, lang);
  evalResult.reference = publicReferenceSnapshot(referenceSnapshot);
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
  out.reportLang = lang;
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
  const info = durableTransaction(() => {
  const inserted = db.prepare(
    `INSERT INTO attempts (user_id,type,case_id,class_id,exam_id,content_version,score,transcript_json,eval_json,
       turns,tests,imaging_count,ddx_count,hints,duration_sec,lang,reference_snapshot_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    req.user.id, "vp", caseData.id, ownerClassId, ownerExamId, caseData.version, evalResult.score,
    transcriptObj ? JSON.stringify(transcriptObj) : null, JSON.stringify(evalResult),
    studentTurns,
    (session.tests || []).length, (session.imaging || []).length, (session.ddx || []).length,
    0, durationValidated, lang, JSON.stringify(referenceSnapshot)
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
    logResult = finishSession({ sessionId: vpSession.id, userId: req.user.id, events, durationSec: finalDuration, attemptId: inserted.lastInsertRowid });
    if (logResult.error || logResult.alreadyFinished) throw new Error("Session changed during evaluation");
    db.prepare("UPDATE attempts SET duration_sec=? WHERE id=?").run(finalDuration, inserted.lastInsertRowid);
    evalResult.meta.durationSecServer = Math.round(serverElapsed);
    // What actually landed in attempts.duration_sec, so an analyst never has to
    // guess which of the two candidate values the row holds.
    evalResult.meta.durationSecRecorded = finalDuration;
  }
  db.prepare("UPDATE attempts SET eval_json=? WHERE id=?").run(JSON.stringify(evalResult), inserted.lastInsertRowid);
  const studyId = studyForContext({ classId: ownerClassId, examId: ownerExamId })?.id || null;
  if (studyId) {
    recordStudyEvent({
      studyId, userId: req.user.id, eventType: "session_finished",
      contextType: ownerExamId ? "exam" : "class", contextId: ownerExamId || ownerClassId,
      data: { attemptId: inserted.lastInsertRowid, caseId: caseData.id, score: evalResult.score, type: "vp" },
    });
  }
  return inserted;
  });
  out.meta = evalResult.meta;
  out.logging = { enabled: logResult.loggingEnabled, eventsStored: logResult.stored, eventsDropped: logResult.dropped };

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

  res.json({ attemptId: info.lastInsertRowid, ...out });
  } catch (e) {
    res.status(500).json({ error: "evaluate_failed", stage: "evaluate", message: String(e.message || e).slice(0, 200) });
  } finally {
    releaseCompletion?.();
  }
}
r.post("/evaluate", authRequired, evaluateRoute);

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
/* ---- Flashcard runs (R64) ----
   A run is opened on the server, so the answers saved while the student works
   are kept and the run resumes after leaving. A finished run starts fresh. */
const FLASH_KEY = /^(exam:\d+|classfc:\d+:\d+|classcomb:\d+)$/;
r.post("/flash-session", authRequired, async (req, res) => {
  try {
    const key = String(req.body?.contextKey || "");
    if (!FLASH_KEY.test(key)) return res.status(400).json({ error: "invalid_context", stage: "flashcards" });
    if (!["student", "learner"].includes(req.user.role)) return res.status(403).json({ error: "students_only", stage: "flashcards" });
    const now = Date.now();
    // Same rule as /session-start: an expired run is settled as it stood before a new one opens.
    const stale = findExpiredOpenFlash({ userId: req.user.id, contextKey: key, now });
    if (stale) {
      const { finalizeFlashRow } = await import("../lib/timed-expiry.js");
      const settled = await finalizeFlashRow(stale);
      if (settled.status === "deferred") return res.status(409).json({ error: "evaluation_in_progress", stage: "flashcards", retryable: true });
    }
    const open = findOpenFlashSession({ userId: req.user.id, contextKey: key, now });
    if (open) {
      return res.json({ runId: open.id, resumed: true, remainingSec: flashRemaining(open, now), deadlineMs: deadlineOf(open), progress: readFlashProgress(open) });
    }
    const [kind, a] = key.split(":");
    const examId = kind === "exam" ? Number(a) : null;
    const classId = kind === "exam" ? null : Number(a);
    const limitSec = limitSecFor({ classId, examId, fallbackMin: 15 });
    const deadlineMs = limitSec > 0 ? now + limitSec * 1000 : null;
    const runId = durableTransaction(() => db.prepare(
      "INSERT INTO flash_progress (user_id, context_key, started_ms, limit_sec, deadline_ms, progress_json, progress_ms) VALUES (?,?,?,?,?,?,?)"
    ).run(req.user.id, key, now, limitSec, deadlineMs, "{}", now).lastInsertRowid);
    res.json({ runId: Number(runId), resumed: false, remainingSec: limitSec > 0 ? limitSec : null, deadlineMs, progress: {} });
  } catch (e) {
    res.status(500).json({ error: "flash_session_failed", stage: "flashcards", message: String(e.message || e).slice(0, 200) });
  }
});

r.put("/flash-progress", authRequired, (req, res) => {
  try {
    const runId = Number(req.body?.runId) || 0;
    const row = db.prepare("SELECT * FROM flash_progress WHERE id=? AND user_id=?").get(runId, req.user.id);
    if (!row) return res.status(404).json({ error: "run_not_found", stage: "flashcards" });
    if (row.finished_at) return res.status(409).json({ error: "run_closed", stage: "flashcards" });
    if (!savesOpen(row)) return res.status(409).json({ error: "session_expired", stage: "flashcards", remainingSec: 0 });
    const saved = saveFlashProgress(row, req.body?.progress || {});
    if (!saved.ok) return res.status(413).json({ error: saved.error, stage: "flashcards" });
    res.json({ ok: true, remainingSec: flashRemaining(row) });
  } catch (e) {
    res.status(500).json({ error: "flash_progress_failed", stage: "flashcards", message: String(e.message || e).slice(0, 200) });
  }
});

r.post("/flashcard-result", authRequired, validateBody(flashResultSchema), (req, res) => {
  try {
  let { score, hints = 0, durationSec = 0, lang = "fa", examId,
          total = 0, correct = 0, wrong = 0, answers = [] } = req.body || {};
  // Only enrolled students may attach a flash result to a university exam.
  // Learners/teachers sending examId would otherwise land in the gradebook.
  const examOwner = req.user.role === "student" ? (examId || null) : null;
  // R64: once the run's time is up, the stored answers are graded, and a closed run takes no more.
  if (examOwner) {
    const guard = expiredFlashRun({ userId: req.user.id, contextKey: `exam:${examOwner}` });
    if (guard?.verdict === "closed") return res.status(409).json({ error: "session_expired", stage: "flashcards" });
    if (guard?.verdict === "stored") answers = guard.answers;
  }
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
    if (changedCardCount(answers) && !effectiveFlashAllowChange(examDeck, examDeck.university_id)) {
      return res.status(403).json({ error: "answer_change_not_allowed", stage: "evaluate" });
    }
    const studentUni = db.prepare("SELECT university_id FROM users WHERE id=?").get(req.user.id)?.university_id;
    if (!studentUni || Number(studentUni) !== Number(examDeck.university_id)) {
      return res.status(403).json({ error: "wrong_university", stage: "access" });
    }
    for (const id of examDeck.flashcard_ids || []) {
      const card = db.prepare("SELECT university_id,active,data_json FROM flashcards WHERE id=?").get(id);
      let learn = false;
      try { learn = JSON.parse(card?.data_json || "{}").track === "learn"; } catch { /* grading handles corrupt content */ }
      if (!card || !card.active || learn || Number(card.university_id) !== Number(studentUni)) {
        return res.status(403).json({ error: "exam_card_unavailable", stage: "access" });
      }
    }
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
      const deck = examOwner
        ? gradeSubmittedDeckDetailed(loadFlash, answerRows, expectedIds, { noPenalty: effectiveFlashNoPenalty(null, examDeck.university_id) })
        : gradeSubmittedDeck(loadFlash, answerRows, expectedIds);
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
  const info = durableTransaction(() => {
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
    return info;
  });
  if (examOwner) closeFlashProgress(req.user.id, `exam:${examOwner}`, info.lastInsertRowid);   // R64
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
    }, { throwOnError: true, stage: "test" });   // surface the REAL provider error to the admin
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

/* ---- Translate a stored VP report into the other site language ----
   Owner-only. Translates exactly what the learner is allowed to see (same
   showAi/showMicro filter as the report). Browser caches the result, so this
   endpoint is only hit once per attempt, language pair and report text. */
r.post("/attempts/:id/translate", authRequired, async (req, res) => {
  try {
    const to = req.body?.to === "en" ? "en" : req.body?.to === "fa" ? "fa" : null;
    if (!to) return res.status(400).json({ error: "bad_language", stage: "translate" });
    const attempt = db.prepare("SELECT id, user_id, exam_id, eval_json, lang FROM attempts WHERE id=? AND user_id=? AND type='vp'")
      .get(Number(req.params.id) || 0, req.user.id);
    if (!attempt) return res.status(404).json({ error: "not_found", stage: "translate" });
    const from = attempt.lang === "en" ? "en" : "fa";
    if (from === to) return res.json({ attemptId: attempt.id, from, to, same: true, bundle: {} });
    let stored = null;
    try { stored = JSON.parse(attempt.eval_json || "null"); } catch { stored = null; }
    if (!stored) return res.status(409).json({ error: "report_missing", stage: "translate" });
    const settings = getSetting("exam", {});
    const ex = attempt.exam_id ? db.prepare("SELECT show_ai, show_micro FROM exams WHERE id=?").get(attempt.exam_id) : null;
    const showAi = (stored.meta?.showAi ?? true) && !!(ex ? ex.show_ai : settings.showAiAnalysis);
    const showMicro = (stored.meta?.showMicro ?? true) && !!(ex ? ex.show_micro : settings.showMicro);
    const visible = publicEvaluation(stored, req.user.role, showAi, showMicro);
    const bundle = extractReportBundle(visible);
    if (!Object.keys(bundle).length) return res.json({ attemptId: attempt.id, from, to, same: false, bundle: {} });
    const { aiCfg } = engineContext(req, {});
    if (!aiCfg?.apiKey) return res.status(503).json({ error: "translation_unavailable", stage: "translate", message_fa: "ترجمه در حال حاضر در دسترس نیست.", message_en: "Translation is unavailable right now." });
    if (!takeTranslationBudget(req.user.id)) return res.status(429).json({ error: "translation_rate_limited", stage: "translate", message_fa: "تعداد ترجمه‌های این ساعت به حد مجاز رسیده است.", message_en: "Too many translations this hour." });
    const { translateReportBundle } = await import("../lib/ai-engine.js");
    const out = await translateReportBundle({ bundle, from, to, aiCfg });
    if (!out.ok) return res.status(502).json({ error: "translation_failed", reason: out.reason, stage: "translate", message_fa: "ترجمه انجام نشد؛ متن اصلی نمایش داده می‌شود.", message_en: "Translation failed; the original text is shown." });
    res.json({ attemptId: attempt.id, from, to, same: false, bundle: out.bundle, model: out.model || "" });
  } catch (e) {
    res.status(500).json({ error: "translate_failed", stage: "translate", message: String(e?.message || e).slice(0, 200) });
  }
});

export { evaluateRoute };
export default r;
