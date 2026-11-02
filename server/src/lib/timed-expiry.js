/* Round 64: finalize expired encounters and flashcard runs without the student.

   When a deadline passes and the student never came back, the attempt is recorded
   and graded as it stood: the saved snapshot is used, and the time is capped at the
   case limit. The same handlers as the HTTP routes are called, so the business logic
   is not copied. Failures are counted (expiry_attempts) and retried up to MAX_TRIES,
   never silently dropped. */
import { tryLease } from "./leases.js";
import { db } from "../db.js";
import exam, { evaluateRoute } from "../routes/exam.js";
import classes from "../routes/classes.js";
import { readFlashProgress, closeFlashProgress, SAVE_GRACE_MS } from "./timed-session.js";

const MAX_TRIES = 5;
const BATCH = 20;

/* The final handler of a route, looked up on the router itself. */
function handlerFor(router, method, path) {
  for (const layer of router.stack) {
    const rt = layer.route;
    if (!rt || rt.path !== path || !rt.methods[method]) continue;
    return rt.stack[rt.stack.length - 1].handle;
  }
  throw new Error(`route_missing:${method} ${path}`);
}

/* Invoke an Express handler with a synthetic request and capture its response. */
function callHandler(handler, req) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (status, body) => { if (!settled) { settled = true; resolve({ status, body }); } };
    const res = {
      statusCode: 200,
      headersSent: false,
      status(code) { this.statusCode = code; return this; },
      json(body) { done(this.statusCode, body); return this; },
      send(body) { done(this.statusCode, body); return this; },
      end() { done(this.statusCode, null); return this; },
      setHeader() { return this; },
      set() { return this; },
    };
    Promise.resolve()
      .then(() => handler(req, res))
      .then(() => done(500, { error: "no_response" }),
            (e) => done(500, { error: "handler_threw", message: String(e?.message || e).slice(0, 200) }));
  });
}

function ownerRow(userId) {
  const u = db.prepare("SELECT id, role, status, token_ver, university_id FROM users WHERE id=?").get(Number(userId));
  if (!u) return null;
  return { id: u.id, role: u.role, status: u.status, ver: Number(u.token_ver || 1), university_id: u.university_id };
}

function syntheticReq(user, body, params = {}) {
  return { user, body, params, query: {}, headers: {}, ip: "127.0.0.1" };
}

function recordFailure(table, id, error) {
  db.prepare(`UPDATE ${table} SET expiry_attempts = expiry_attempts + 1, expiry_error = ? WHERE id = ?`)
    .run(String(error || "unknown").slice(0, 200), Number(id));
}

const RETRY_LATER = new Set(["evaluation_in_progress"]);

/* Finalize one expired encounter as it stood. Returns { status: finalized | deferred | failed }. */
export async function finalizeVpRow(row) {
  const user = ownerRow(row.user_id);
  if (!user || user.status !== "active") { recordFailure("vp_sessions", row.id, "owner_inactive"); return { status: "failed", error: "owner_inactive" }; }
  // The stored snapshot is used by evaluateRoute once the deadline has passed.
  const body = {
    caseId: row.case_id, lang: row.lang, durationSec: row.limit_sec,
    classId: row.class_id, examId: row.exam_id, sessionId: row.id, events: [], session: {},
  };
  const res = await callHandler(evaluateRoute, syntheticReq(user, body));
  if (res.status === 200 && res.body?.attemptId) return { status: "finalized", attemptId: res.body.attemptId };
  if (res.status === 409 && (res.body?.retryable || RETRY_LATER.has(res.body?.error))) return { status: "deferred" };
  const error = res.body?.error || `status_${res.status}`;
  recordFailure("vp_sessions", row.id, error);
  return { status: "failed", error };
}

/* Encounters past their deadline that were never finished. */
export async function expireVpSessions(now = Date.now()) {
  const rows = db.prepare(
    `SELECT * FROM vp_sessions
      WHERE finished_at IS NULL AND attempt_id IS NULL AND deadline_ms IS NOT NULL
        AND deadline_ms < ? AND expiry_attempts < ?
      ORDER BY deadline_ms LIMIT ?`
  ).all(now - SAVE_GRACE_MS, MAX_TRIES, BATCH);
  const out = { finalized: 0, failed: 0, deferred: 0 };
  for (const row of rows) {
    const r = await finalizeVpRow(row);
    if (r.status === "finalized") out.finalized++;
    else if (r.status === "deferred") out.deferred++;
    else out.failed++;
  }
  return out;
}

/* Flashcard runs past their deadline. The saved answers are graded by the same
   finish handler the student would have used. */
function flashTarget(key) {
  const [kind, a, b] = key.split(":");
  if (kind === "exam") return { router: exam, path: "/flashcard-result", params: {}, body: (p) => ({ examId: Number(a), answers: p.answers, lang: p.lang || "fa" }) };
  if (kind === "classfc") return { router: classes, path: "/:id/flashcard/:fid/finish", params: { id: String(a), fid: String(b) }, body: (p) => ({ answers: p.answers }) };
  if (kind === "classcomb") return { router: classes, path: "/:id/flashcards/finish", params: { id: String(a) },
    body: (p) => ({ submissionId: p.submissionId, version: p.version, answers: p.answers }) };
  return null;
}

/* Finalize one expired flashcard run from its stored answers. */
export async function finalizeFlashRow(row) {
  const user = ownerRow(row.user_id);
  if (!user || user.status !== "active") { recordFailure("flash_progress", row.id, "owner_inactive"); return { status: "failed", error: "owner_inactive" }; }
  const target = flashTarget(row.context_key);
  if (!target) { recordFailure("flash_progress", row.id, "unknown_context"); return { status: "failed", error: "unknown_context" }; }
  const progress = readFlashProgress(row);
  const handler = handlerFor(target.router, "post", target.path);
  const body = { ...target.body(progress), durationSec: row.limit_sec || 0 };
  const res = await callHandler(handler, syntheticReq(user, body, target.params));
  if (res.status === 200) {
    closeFlashProgress(user.id, row.context_key, res.body?.attemptId ?? null);
    return { status: "finalized" };
  }
  if (res.status === 409 && (res.body?.retryable || RETRY_LATER.has(res.body?.error))) return { status: "deferred" };
  const error = res.body?.error || `status_${res.status}`;
  recordFailure("flash_progress", row.id, error);
  return { status: "failed", error };
}

export async function expireFlashProgress(now = Date.now()) {
  const rows = db.prepare(
    `SELECT * FROM flash_progress
      WHERE finished_at IS NULL AND deadline_ms IS NOT NULL
        AND deadline_ms < ? AND expiry_attempts < ?
      ORDER BY deadline_ms LIMIT ?`
  ).all(now - SAVE_GRACE_MS, MAX_TRIES, BATCH);
  const out = { finalized: 0, failed: 0 };
  for (const row of rows) {
    const r = await finalizeFlashRow(row);
    if (r.status === "finalized") out.finalized++; else out.failed++;
  }
  return out;
}

async function runTimedExpiry(now = Date.now()) {
  const vp = await expireVpSessions(now);
  const flash = await expireFlashProgress(now);
  return { vp, flash };
}

export function startTimedExpiry(intervalMs = 30_000) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      // One process settles expired sessions at a time (lease ttl < interval, so a crashed holder is replaced).
      if (!tryLease("timed-expiry", intervalMs - 5_000)) return;
      await runTimedExpiry();
    }
    catch (e) { console.error("timed-expiry:", e?.message || e); }
    finally { running = false; }
  }, intervalMs);
  timer.unref?.();
  return timer;
}

