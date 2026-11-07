/* vp-grading.js — durable grading state of one virtual-patient encounter (R82).

   An encounter is graded by the server, never by the student's browser staying open.
   The state lives in vp_sessions, so it survives restarts and works across processes:

   - finish_requested_ms  the student pressed finish. The encounter is frozen: its
                          snapshot is saved once and the chat is locked from then on.
   - grading_lease_until  compare-and-set claim. One grader at a time per encounter,
                          in any process. A crashed holder's claim simply expires.
   - next_try_ms          next automatic retry after a transient failure (exponential
                          backoff, capped at 15 minutes, plus up to 25% jitter).
   - review_required      a permanent failure (the student no longer has access, the
                          encounter no longer fits its class). Nothing is retried; the
                          chat stays on record for staff.
   - grading_draft_json   AI outputs (checklist score, lesson) kept as soon as they
                          exist, so a retry never pays for them twice.

   A failure never closes an encounter. It only ends when an attempt is written.
   An AI outage never restricts the student: a pending encounter does not block a new one,
   does not take the student's lock, and does not use up an attempt until it is scored
   (the scoring path re-checks the budget, so the first scored encounter takes it). */
import { createHash } from "node:crypto";
import { db, durableTransaction } from "../db.js";

export const LEASE_MS = 10 * 60 * 1000;
const BASE_BACKOFF_MS = 30 * 1000;
const MAX_BACKOFF_MS = 15 * 60 * 1000;
const MAX_DRAFT_BYTES = 512 * 1024;

export const evaluationFingerprint = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

/* Seconds-scale first retry, doubling, never more than 15 minutes apart. */
export function backoffMs(tries) {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, Number(tries) - 1));
}

/* R101: the next retry, with up to 25% extra jitter. Encounters that failed in the same
   outage would otherwise all retry on the same schedule and hit the provider in waves
   when it comes back (the thundering herd). The jitter only ever adds delay, so a retry
   is never earlier than backoffMs(tries). */
export function retryDelayMs(tries, random = Math.random) {
  const base = backoffMs(tries);
  return base + Math.floor(random() * base * 0.25);
}

/* "transient": retry later. "permanent": staff must look. "busy": another grader holds
   it, so nothing is recorded. 401 is transient because a password change or token
   refresh can clear it; the grader re-reads the live account on each try. */
/* Access was withdrawn while grading (consent, membership, account, study pause). The student
   must not be graded or logged any further, so the encounter goes to staff review and its
   events are not written. */
export function accessRevoked(status, error) {
  return status === 401 || status === 403 || error === "study_context_changed";
}

export function failureKind(status, error) {
  if (status === 409 && error === "evaluation_in_progress") return "busy";
  if (accessRevoked(status, error)) return "permanent";
  if (!status || status === 408 || status === 429 || status >= 500) return "transient";
  return "permanent";
}

/* Claim the encounter for one grading run. Returns the lease token, or null when another
   run holds it, the encounter is closed, or it is under staff review. */
export function claimGrading(sessionId, now = Date.now()) {
  const until = now + LEASE_MS;
  const info = db.prepare(
    `UPDATE vp_sessions SET grading_lease_until=?
      WHERE id=? AND finished_at IS NULL AND attempt_id IS NULL AND review_required=0
        AND (grading_lease_until IS NULL OR grading_lease_until < ?)`
  ).run(until, Number(sessionId), now);
  return info.changes === 1 ? until : null;
}

/* Release only our own claim. If the lease expired and another run took over, it stays. */
export function releaseGrading(sessionId, token) {
  if (token == null) return;
  db.prepare("UPDATE vp_sessions SET grading_lease_until=NULL WHERE id=? AND grading_lease_until=?")
    .run(Number(sessionId), token);
}

/* First press wins. Later presses keep the original time and the frozen snapshot. */
export function markFinishRequested(sessionId, now = Date.now()) {
  db.prepare(
    "UPDATE vp_sessions SET finish_requested_ms=COALESCE(finish_requested_ms, ?) WHERE id=? AND finished_at IS NULL AND attempt_id IS NULL"
  ).run(now, Number(sessionId));
}

export function recordGradingFailure(sessionId, { error, kind, now = Date.now() }) {
  const message = String(error || "unknown").slice(0, 200);
  durableTransaction(() => {
    if (kind === "permanent") {
      db.prepare("UPDATE vp_sessions SET review_required=1, next_try_ms=NULL, expiry_error=? WHERE id=?")
        .run(message, Number(sessionId));
      return;
    }
    const row = db.prepare("SELECT expiry_attempts FROM vp_sessions WHERE id=?").get(Number(sessionId));
    if (!row) return;
    const tries = Number(row.expiry_attempts) + 1;
    db.prepare("UPDATE vp_sessions SET expiry_attempts=?, expiry_error=?, next_try_ms=? WHERE id=?")
      .run(tries, message, now + retryDelayMs(tries), Number(sessionId));
  });
}

/* AI outputs. Only what a provider actually produced is kept (the caller decides). */
export function readDraft(row) {
  try {
    const draft = row?.grading_draft_json ? JSON.parse(row.grading_draft_json) : null;
    return draft && typeof draft === "object" ? draft : null;
  } catch { return null; }
}

export function writeDraft(sessionId, draft) {
  const json = JSON.stringify(draft);
  if (Buffer.byteLength(json, "utf8") > MAX_DRAFT_BYTES) return false;
  db.prepare("UPDATE vp_sessions SET grading_draft_json=? WHERE id=? AND finished_at IS NULL")
    .run(json, Number(sessionId));
  return true;
}
