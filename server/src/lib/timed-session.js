/* Round 64: timed, resumable encounters and flashcard runs.

   Rules
   - The server sets the deadline (started_ms + limit). The browser clock is never
     trusted for it. A class with its timer disabled has no deadline.
   - A student who leaves may come back and continue until the deadline. Resuming
     reuses the same open row, so it never starts a new attempt or a new clock.
   - Each autosave stores the latest transcript (progress_json). Once the deadline
     has passed, the stored snapshot is what gets graded, as it stood.
   - Expired rows are finalized by lib/timed-expiry.js, without the student. */
import { db, durableTransaction } from "../db.js";

const MAX_PROGRESS_BYTES = 1024 * 1024;   // 1 MB stored snapshot
const MAX_ITEMS = 2000;                          // per list, bounded
const MAX_ITEM_CHARS = 20000;                    // per item, bounded

/* Seconds the student is allowed for this encounter. 0 = untimed. */
export function limitSecFor({ classId = null, examId = null, fallbackMin = 15 }) {
  if (classId) {
    const c = db.prepare("SELECT timer_enabled, timer_minutes FROM classes WHERE id=?").get(Number(classId));
    if (c) return c.timer_enabled ? Math.max(1, Math.round(Number(c.timer_minutes) || 30)) * 60 : 0;
  }
  if (examId) {
    const e = db.prepare("SELECT duration_min FROM exams WHERE id=?").get(Number(examId));
    if (e && Number(e.duration_min) > 0) return Math.round(Number(e.duration_min)) * 60;
  }
  return Math.max(1, Math.round(Number(fallbackMin) || 15)) * 60;
}

/* A browser save that was already in flight when the clock ran out is still stored for
   this many ms, so the transcript is complete. Chat and other interaction stay refused
   at the deadline itself; the sweeper finalizes only after the grace has passed. */
export const SAVE_GRACE_MS = 5000;
export const savesOpen = (row, now = Date.now()) => {
  const d = deadlineOf(row);
  return d == null || now <= d + SAVE_GRACE_MS;
};

export const deadlineOf = (row) => (row && row.deadline_ms != null ? Number(row.deadline_ms) : null);

export function isExpired(row, now = Date.now()) {
  const d = deadlineOf(row);
  return d != null && now > d;
}

export function remainingSec(row, now = Date.now()) {
  const d = deadlineOf(row);
  return d == null ? null : Math.max(0, Math.ceil((d - now) / 1000));
}

/* The open, unexpired encounter for this student, case and container. */
export function findOpenVpSession({ userId, caseId, classId = null, examId = null, studyId = null, lang = "fa", now = Date.now() }) {
  const row = db.prepare(
    `SELECT * FROM vp_sessions
      WHERE user_id=? AND case_id=? AND IFNULL(class_id,0)=? AND IFNULL(exam_id,0)=?
        AND IFNULL(study_id,0)=? AND lang=? AND finished_at IS NULL AND attempt_id IS NULL
      ORDER BY id DESC LIMIT 1`
  ).get(Number(userId), Number(caseId), Number(classId || 0), Number(examId || 0),
        Number(studyId || 0), lang === "en" ? "en" : "fa");
  if (!row || isExpired(row, now)) return null;
  return row;
}

/* The open encounter whose deadline has passed but which no sweep has finalized yet.
   Settled before a new start, so a quick return never opens a second attempt. */
export function findExpiredOpenVp({ userId, caseId, classId = null, examId = null, studyId = null, lang = "fa", now = Date.now() }) {
  const row = db.prepare(
    `SELECT * FROM vp_sessions
      WHERE user_id=? AND case_id=? AND IFNULL(class_id,0)=? AND IFNULL(exam_id,0)=?
        AND IFNULL(study_id,0)=? AND lang=? AND finished_at IS NULL AND attempt_id IS NULL
      ORDER BY id DESC LIMIT 1`
  ).get(Number(userId), Number(caseId), Number(classId || 0), Number(examId || 0),
        Number(studyId || 0), lang === "en" ? "en" : "fa");
  return row && isExpired(row, now) ? row : null;
}

export function findExpiredOpenFlash({ userId, contextKey, now = Date.now() }) {
  const row = db.prepare(
    `SELECT * FROM flash_progress
      WHERE user_id=? AND context_key=? AND finished_at IS NULL
      ORDER BY id DESC LIMIT 1`
  ).get(Number(userId), String(contextKey));
  return row && isExpired(row, now) ? row : null;
}

/* Keep one stored snapshot bounded. Oversized items are dropped, never truncated,
   so a half-written clinical entry is never presented as complete. */
function boundedList(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const item of v.slice(0, MAX_ITEMS)) {
    let json;
    try { json = JSON.stringify(item); } catch { continue; }
    if (json && json.length <= MAX_ITEM_CHARS) out.push(item);
  }
  return out;
}

function sanitizeVpProgress(input) {
  const p = input && typeof input === "object" ? input : {};
  const { events, ...rest } = p;
  const session = {};
  for (const [k, v] of Object.entries(rest)) {
    if (Array.isArray(v)) session[k] = boundedList(v);
    else if (v == null || typeof v !== "object") session[k] = typeof v === "string" ? v.slice(0, MAX_ITEM_CHARS) : v;
    else session[k] = v;   // nested objects (e.g. flags) are kept; the byte cap below bounds them
  }
  return { ...session, events: boundedList(events) };
}

/* Stored snapshot for a session: { session, events }. Empty when none saved yet. */
export function readVpProgress(row) {
  let p = {};
  try { p = row?.progress_json ? JSON.parse(row.progress_json) : {}; } catch { p = {}; }
  const { events, ...session } = sanitizeVpProgress(p);
  return { session, events };
}

/* Flashcard finish guard. A run whose time has run out takes its answers from the stored
   snapshot, never from a late browser copy. Returns null when no rule applies. */
export function expiredFlashRun({ userId, contextKey, now = Date.now() }) {
  const row = db.prepare(
    "SELECT * FROM flash_progress WHERE user_id=? AND context_key=? ORDER BY id DESC LIMIT 1"
  ).get(Number(userId), String(contextKey));
  const d = row ? deadlineOf(row) : null;
  if (d == null || now <= d + SAVE_GRACE_MS) return null;   // untimed, or still inside the grace window
  if (row.finished_at) return { verdict: "closed", row };
  return { verdict: "stored", row, answers: Array.isArray(readFlashProgress(row).answers) ? readFlashProgress(row).answers : [] };
}

/* One UPDATE statement, so it is atomic. Returns ok:false when too large. */
export function saveVpProgress(sessionId, progress, now = Date.now()) {
  const json = JSON.stringify(sanitizeVpProgress(progress));
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes > MAX_PROGRESS_BYTES) return { ok: false, error: "progress_too_large" };
  // Durable before it is acknowledged: a disk failure throws, so the route answers 500 and the browser keeps its copy.
  durableTransaction(() => db.prepare("UPDATE vp_sessions SET progress_json=?, progress_ms=? WHERE id=?").run(json, now, Number(sessionId)));
  return { ok: true, bytes };
}

/* ---------- Flashcard runs ---------- */

export function saveFlashProgress(row, progress, now = Date.now()) {
  const json = JSON.stringify(progress && typeof progress === "object" ? progress : {});
  if (Buffer.byteLength(json, "utf8") > MAX_PROGRESS_BYTES) return { ok: false, error: "progress_too_large" };
  durableTransaction(() => db.prepare("UPDATE flash_progress SET progress_json=?, progress_ms=? WHERE id=?").run(json, now, Number(row.id)));
  return { ok: true };
}

export function readFlashProgress(row) {
  try { return row?.progress_json ? JSON.parse(row.progress_json) : {}; } catch { return {}; }
}

export function findOpenFlashSession({ userId, contextKey, now = Date.now() }) {
  const row = db.prepare(
    `SELECT * FROM flash_progress
      WHERE user_id=? AND context_key=? AND finished_at IS NULL
      ORDER BY id DESC LIMIT 1`
  ).get(Number(userId), String(contextKey));
  if (!row || isExpired(row, now)) return null;
  return row;
}

export const flashRemaining = remainingSec;

/* Close the open run for this student and context once a finish route has
   recorded the attempt. Idempotent. */
export function closeFlashProgress(userId, contextKey, attemptId = null) {
  db.prepare(
    `UPDATE flash_progress SET finished_at=datetime('now'), attempt_id=?
      WHERE user_id=? AND context_key=? AND finished_at IS NULL`
  ).run(attemptId == null ? null : Number(attemptId), Number(userId), String(contextKey));
}
