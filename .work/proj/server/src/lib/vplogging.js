/* vplogging.js — Virtual-patient conversation logging for the research study.

   PRIVACY BY DEFAULT. Nothing about an encounter is written unless the teacher
   explicitly turned logging on for that class (or exam). The proposal's ethics
   section (code 10-2) requires that participants are told what is recorded, so
   the switch is per-class, visible in the admin UI, and snapshotted onto the
   session row at start time — flipping it later cannot retroactively change
   what an already-collected session means.

   What is logged when ON:  every chat turn, every lab/imaging order and its
   report, each differential added, the final diagnosis, and the finish event —
   each with a millisecond offset from session start. That is what turns "the
   student scored 70%" into analysable process data (where they hesitated, what
   they ordered first, how long the encounter actually took).

   What is logged when OFF: only timing metadata on the session row. No message
   text, no orders. The attempt still gets its score, because grading must keep
   working — but attempts.transcript_json stays NULL.

   All client-supplied event data is validated before it touches the database:
   a research dataset that can be polluted by a crafted request is worthless. */
import { db, persistNow } from "../db.js";

/* Event vocabulary. Anything outside this list is dropped. */
export const EVENT_KINDS = new Set([
  "student_msg", "patient_msg", "teacher_msg", "lab_order", "lab_result",
  "imaging_order", "imaging_result", "ddx_add", "ddx_remove", "final_dx",
  "problem_list", "exam_request", "auscultation",
  "tab_switch", "leave", "finish", "error", "consent_granted",
]);

const MAX_EVENTS = 2000;              // one encounter never legitimately exceeds this
const MAX_TEXT = 4000;                // per-message cap
const MAX_QUERY = 300;                // per-order cap
const MAX_PAYLOAD_BYTES = 16 * 1024;

/* Resolve whether this encounter should be logged, from the container it
   belongs to. Both toggles default to 0 (off) — see the migration in db.js. */
export function loggingEnabledFor(classId, examId) {
  if (classId) {
    const row = db.prepare("SELECT log_transcript FROM classes WHERE id=?").get(Number(classId));
    if (row) return !!row.log_transcript;
  }
  if (examId) {
    const row = db.prepare("SELECT log_transcript FROM exams WHERE id=?").get(Number(examId));
    if (row) return !!row.log_transcript;
  }
  return false;
}

/* Open a session. Called when the student enters the encounter, so the row
   exists (and the clock is server-side) even if they never finish. */
export function startSession({ userId, caseId, classId, examId, studyId, lang, requestId = null }) {
  if (requestId != null && (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(requestId))) {
    return { error: "invalid_start_request_id", status: 400 };
  }
  if (requestId) {
    const existing = db.prepare("SELECT * FROM vp_sessions WHERE user_id=? AND start_request_id=?").get(Number(userId), requestId);
    if (existing) {
      if (Number(existing.case_id) !== Number(caseId) || Number(existing.class_id) !== Number(classId || 0) ||
          Number(existing.exam_id) !== Number(examId || 0) || Number(existing.study_id) !== Number(studyId || 0) || existing.lang !== (lang === "en" ? "en" : "fa")) {
        return { error: "start_request_context_mismatch", status: 409 };
      }
      persistNow({ throwOnError: true });
      return { sessionId: existing.id, loggingEnabled: !!existing.logging_enabled, serverNow: existing.started_ms, replayed: true };
    }
  }
  const logging = loggingEnabledFor(classId, examId) ? 1 : 0;
  const serverNow = Date.now();
  const info = db.prepare(
    `INSERT INTO vp_sessions (user_id,case_id,class_id,exam_id,study_id,logging_enabled,lang,started_ms,start_request_id)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(Number(userId), Number(caseId), classId ? Number(classId) : null,
        examId ? Number(examId) : null, studyId ? Number(studyId) : null, logging,
        lang === "en" ? "en" : "fa", serverNow, requestId);
  persistNow({ throwOnError: true });
  return { sessionId: info.lastInsertRowid, loggingEnabled: !!logging, serverNow };
}

export function getSession(sessionId) {
  return db.prepare("SELECT * FROM vp_sessions WHERE id=?").get(Number(sessionId) || 0) || null;
}

/* Seconds the server itself measured for this encounter. Sub-second precision
   matters: `started_at` is truncated to the second, so a short session would
   otherwise measure 0 and give a tampered client a free pass. Falls back to
   started_at only for rows written before started_ms existed. */
export function serverElapsedSec(session) {
  if (!session) return 0;
  const startedMs = Number(session.started_ms);
  if (Number.isFinite(startedMs) && startedMs > 0) {
    return Math.max(0, (Date.now() - startedMs) / 1000);
  }
  if (session.started_at) {
    const t = Date.parse(session.started_at.replace(" ", "T") + "Z");
    if (Number.isFinite(t)) return Math.max(0, (Date.now() - t) / 1000);
  }
  return 0;
}

/* Clip a string to a safe length; never let one message balloon the dataset. */
const clip = (v, n) => String(v == null ? "" : v).slice(0, n);

/* Normalise one client-sent event. Returns null when the event is unusable. */
function normaliseEvent(ev, index) {
  if (!ev || typeof ev !== "object") return null;
  const kind = String(ev.kind || "").slice(0, 40);
  if (!EVENT_KINDS.has(kind)) return null;
  const atMs = Number(ev.atMs);
  const payload = {};
  switch (kind) {
    case "student_msg":
    case "patient_msg":
    case "teacher_msg": {
      const text = clip(ev.text, MAX_TEXT).trim();
      if (!text) return null;
      payload.text = text;
      // An AI failure is research-relevant: mark mock replies so the analysis
      // can separate them from real model turns.
      if ((kind === "patient_msg" || kind === "teacher_msg") && ev.source) payload.source = clip(ev.source, 20);
      break;
    }
    case "lab_order":
    case "imaging_order": {
      const query = clip(ev.query, MAX_QUERY).trim();
      if (!query) return null;
      payload.query = query;
      break;
    }
    case "lab_result":
    case "imaging_result": {
      payload.query = clip(ev.query, MAX_QUERY);
      payload.text = clip(ev.text, MAX_TEXT);
      if (ev.found != null) payload.found = !!ev.found;
      break;
    }
    case "ddx_add":
    case "ddx_remove": {
      const text = clip(ev.text, MAX_QUERY).trim();
      if (!text) return null;
      payload.text = text;
      break;
    }
    case "consent_granted":
      if (ev.studyId != null) payload.studyId = Number(ev.studyId) || 0;
      break;
    case "problem_list": {
      const lines = Number(ev.lines) || 0;
      if (lines <= 0) return null;
      payload.lines = Math.min(500, Math.round(lines));
      if (ev.text) payload.text = clip(ev.text, MAX_TEXT);
      break;
    }
    case "exam_request": {
      const text = clip(ev.text, MAX_QUERY).trim();
      if (!text) return null;
      payload.text = text;
      break;
    }
    case "auscultation": {
      const organs = clip(ev.organs || "", 30);
      if (!organs) return null;
      payload.organs = organs;
      if (ev.hasAudio != null) payload.hasAudio = !!ev.hasAudio;
      break;
    }
    case "final_dx":
      payload.text = clip(ev.text, MAX_QUERY);
      break;
    case "tab_switch":
      payload.tab = clip(ev.tab, 30);
      break;
    case "leave":
    case "error":
      payload.note = clip(ev.note || ev.text, 300);
      break;
    case "finish":
      break;
    default:
      return null;
  }
  const json = JSON.stringify(payload);
  if (Buffer.byteLength(json, "utf8") > MAX_PAYLOAD_BYTES) return null;
  return {
    seq: index,
    at_ms: Number.isFinite(atMs) && atMs >= 0 ? Math.min(24 * 3600 * 1000, Math.round(atMs)) : 0,
    kind, payload_json: json,
  };
}

/* Persist the encounter's event log + close the session.

   Deliberately a no-op for content when logging is off: only the timing is
   written, so "we did not record this conversation" stays literally true.
   Returns { stored, loggingEnabled, dropped }. */
export function finishSession({ sessionId, userId, events, durationSec, attemptId, persist = true }) {
  const s = getSession(sessionId);
  if (!s) return { stored: 0, loggingEnabled: false, dropped: 0, error: "session_not_found" };
  if (Number(s.user_id) !== Number(userId)) return { stored: 0, loggingEnabled: !!s.logging_enabled, dropped: 0, error: "not_your_session" };

  // A duplicate abandon/finish must never erase an attempt link or append logs.
  if (s.finished_at) return { stored: s.event_count || 0, loggingEnabled: !!s.logging_enabled, dropped: 0, alreadyFinished: true };

  let stored = 0, dropped = 0;
  if (s.logging_enabled) {
    const list = Array.isArray(events) ? events.slice(0, MAX_EVENTS) : [];
    dropped = (Array.isArray(events) ? events.length : 0) - list.length;
    const ins = db.prepare(
      "INSERT INTO vp_session_events (session_id,seq,at_ms,kind,payload_json) VALUES (?,?,?,?,?)"
    );
    list.forEach((raw, i) => {
      const ev = normaliseEvent(raw, i);
      if (!ev) { dropped++; return; }
      ins.run(s.id, ev.seq, ev.at_ms, ev.kind, ev.payload_json);
      stored++;
    });
  } else {
    dropped = Array.isArray(events) ? events.length : 0;
  }

  const dur = Number.isFinite(Number(durationSec)) && Number(durationSec) > 0
    ? Math.min(6 * 3600, Math.round(Number(durationSec))) : 0;
  db.prepare(
    `UPDATE vp_sessions SET finished_at=datetime('now'), attempt_id=?, duration_sec=?, event_count=? WHERE id=?`
  ).run(attemptId ? Number(attemptId) : null, dur, stored, s.id);
  if (persist) persistNow();
  return { stored, loggingEnabled: !!s.logging_enabled, dropped };
}

/* Read back a session's log (teacher/admin only — enforced by the caller). */
export function sessionLog(sessionId) {
  const s = getSession(sessionId);
  if (!s) return null;
  const events = s.logging_enabled
    ? db.prepare("SELECT seq,at_ms,kind,payload_json FROM vp_session_events WHERE session_id=? ORDER BY seq").all(s.id)
        .map((e) => { let p = {}; try { p = JSON.parse(e.payload_json); } catch { /* */ } return { seq: e.seq, atMs: e.at_ms, kind: e.kind, ...p }; })
    : [];
  return {
    id: s.id, user_id: s.user_id, case_id: s.case_id, class_id: s.class_id,
    exam_id: s.exam_id, study_id: s.study_id, logging_enabled: !!s.logging_enabled,
    started_at: s.started_at, finished_at: s.finished_at, attempt_id: s.attempt_id,
    duration_sec: s.duration_sec, event_count: s.event_count, lang: s.lang,
    events,
  };
}

/* All sessions for one attempt, or for a class (for the export). */
export function sessionsForAttempt(attemptId) {
  return db.prepare("SELECT id FROM vp_sessions WHERE attempt_id=? ORDER BY id").all(Number(attemptId) || 0)
    .map((r) => sessionLog(r.id)).filter(Boolean);
}
