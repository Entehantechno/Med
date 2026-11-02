/* ================================================================
   retention.js — how long stored chats and logs are kept, and how they are deleted.

   Nothing is deleted automatically unless an admin has set a period for that
   category. The default policy keeps every chat and log (rum_vitals keeps its
   long-standing 45 days: it is monitoring data, not learner content).

   Categories and what a purge removes:
   - vp_chats: a FINISHED and GRADED virtual-patient encounter. Its event log,
     the chat text (attempts.transcript_json of that VP attempt), the saved
     progress, the case snapshot and the grading draft are removed. The grade,
     the evaluation (درسنامه) and the reference snapshot stay. An encounter that
     is still open, not yet graded, in staff review, or linked to a research
     study is never touched.
   - tutor_chats: AI tutor messages (rows).
   - security_events: sign-in and permission events (they hold IP and path).
   - rum_vitals: page performance samples.

   Scope per class and exam: classes.retention_days and exams.retention_days
   override the vp_chats period for their encounters. NULL = inherit, 0 = keep,
   N = days. A class value wins over an exam value, and an exam over the policy.

   Automatic runs happen at most once a day, in one process at a time (job
   lease), in batches, each batch one transaction. Each run writes one audit row
   with COUNTS only, never content.
   ================================================================ */
import fs from "node:fs";
import { db, durableTransaction } from "../db.js";
import { DB_PATH } from "./paths.js";
import { makeLeases } from "./leases.js";
import { audit } from "./audit.js";

export const CATEGORIES = ["vp_chats", "tutor_chats", "security_events", "rum_vitals"];
export const MIN_DAYS = 30;
export const MAX_DAYS = 3650;
export const PRESET_DAYS = [0, 90, 180, 365, 730];
export const DEFAULT_POLICY = { vp_chats: 0, tutor_chats: 0, security_events: 0, rum_vitals: 45 };

const BATCH = 200;
const DAY_MS = 24 * 60 * 60 * 1000;   // the automatic run waits at least this long
const LAST_RUN_KEY = "retention_last_run_ms";
const POLICY_KEY = "retention_policy";
const leases = makeLeases(db);

/* A period is 0 (keep) or a whole number of days from MIN_DAYS to MAX_DAYS. */
export function cleanDays(v) {
  if (v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n)) return undefined;
  if (n === 0) return 0;
  if (n < MIN_DAYS || n > MAX_DAYS) return undefined;
  return n;
}

const getKv = (k) => db.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value ?? null;
const setKv = (k, v) => db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(k, v);

/* The stored policy, merged over the defaults. Anything invalid falls back to the default. */
export function readPolicy() {
  let raw = {};
  try { raw = JSON.parse(getKv(POLICY_KEY) || "{}") || {}; } catch { raw = {}; }
  const out = {};
  for (const c of CATEGORIES) {
    const d = cleanDays(raw[c]);
    out[c] = d === undefined || d === null ? DEFAULT_POLICY[c] : d;
  }
  return out;
}

/* Validates a full policy from the admin. A category going from keep (0) to a
   period is "enabling" and needs `confirmed`; the caller returns 409 otherwise. */
export function savePolicy(input, { confirmed = false, req = null } = {}) {
  const current = readPolicy();
  const next = {};
  for (const c of CATEGORIES) {
    if (!(c in (input || {}))) { next[c] = current[c]; continue; }
    const d = cleanDays(input[c]);
    if (d === undefined || d === null) return { error: "retention_days_range", category: c };
    next[c] = d;
  }
  const enabling = CATEGORIES.filter((c) => current[c] === 0 && next[c] > 0);
  if (enabling.length && !confirmed) return { error: "confirmation_required", categories: enabling };
  setKv(POLICY_KEY, JSON.stringify(next));
  audit(req, "retention.policy", "settings:retention_policy", { before: current, after: next });
  return { policy: next };
}

/* SQL shared by the VP rules. A purge needs a settled, graded encounter outside research. */
const VP_SETTLED = `s.finished_at IS NOT NULL AND s.attempt_id IS NOT NULL AND s.study_id IS NULL
  AND s.review_required=0 AND s.purged_ms IS NULL`;
const VP_PERIOD = "COALESCE(c.retention_days, e.retention_days, ?)";
const VP_FROM = `FROM vp_sessions s LEFT JOIN classes c ON c.id=s.class_id LEFT JOIN exams e ON e.id=s.exam_id`;
const VP_DUE = `${VP_SETTLED} AND ${VP_PERIOD} > 0 AND julianday(s.finished_at) < julianday('now') - ${VP_PERIOD}`;

const ageSince = (days) => `-${Number(days)} days`;

function vpIdsDue(days, limit) {
  return db.prepare(`SELECT s.id ${VP_FROM} WHERE ${VP_DUE} ORDER BY s.id LIMIT ?`)
    .all(days, days, limit).map((r) => r.id);
}

function vpPreview(days) {
  const row = db.prepare(`SELECT COUNT(*) sessions FROM (SELECT s.id ${VP_FROM} WHERE ${VP_DUE})`).get(days, days);
  const events = db.prepare(`SELECT COUNT(*) n FROM vp_session_events WHERE session_id IN (SELECT s.id ${VP_FROM} WHERE ${VP_DUE})`).get(days, days);
  return { sessions: row?.sessions || 0, events: events?.n || 0 };
}

/* Removes the chat text and the event log of these encounters; keeps the grade. */
function purgeVpIds(ids, now) {
  const counts = { sessions: 0, events: 0, transcripts: 0 };
  if (!ids.length) return counts;
  durableTransaction(() => {
    for (const id of ids) {
      const ev = db.prepare("DELETE FROM vp_session_events WHERE session_id=?").run(id).changes;
      const tr = db.prepare(`UPDATE attempts SET transcript_json=NULL
        WHERE type='vp' AND transcript_json IS NOT NULL
          AND id=(SELECT attempt_id FROM vp_sessions WHERE id=?)`).run(id).changes;
      db.prepare(`UPDATE vp_sessions SET progress_json=NULL, encounter_snapshot_json=NULL,
        grading_draft_json=NULL, purged_ms=? WHERE id=?`).run(now, id);
      counts.sessions += 1; counts.events += ev; counts.transcripts += tr;
    }
  });
  return counts;
}

const TABLE_RULE = {
  tutor_chats: { table: "tutor_chats", col: "created_at" },
  security_events: { table: "security_events", col: "created_at" },
  rum_vitals: { table: "rum_vitals", col: "created_at" },
};

function previewTable(category, days) {
  const r = TABLE_RULE[category];
  const row = db.prepare(`SELECT COUNT(*) n FROM ${r.table} WHERE ${r.col} < datetime('now', ?)`).get(ageSince(days));
  return { rows: row?.n || 0 };
}

/* Count what a purge with this period would remove. Read-only. */
export function previewPurge(category, days) {
  if (!CATEGORIES.includes(category)) return null;
  const d = cleanDays(days);
  if (d === undefined || d === null) return null;
  if (category === "vp_chats") return { category, days: d, ...vpPreview(d) };
  if (d === 0) return { category, days: d, rows: 0 };
  return { category, days: d, ...previewTable(category, d) };
}

/* Deletes everything of one category older than `days` (vp_chats: class and exam
   overrides still apply). Returns counts. Runs in batches so a large table never
   holds the write lock for long. */
export async function purgeCategory(category, days, now = Date.now()) {
  const d = cleanDays(days);
  if (!CATEGORIES.includes(category) || d === undefined || d === null) throw new Error("bad_retention_request");
  const total = { sessions: 0, events: 0, transcripts: 0, rows: 0 };
  if (category === "vp_chats") {
    for (let guard = 0; guard < 100000; guard++) {
      const ids = vpIdsDue(d, BATCH);
      if (!ids.length) break;
      const c = purgeVpIds(ids, now);
      total.sessions += c.sessions; total.events += c.events; total.transcripts += c.transcripts;
      if (ids.length < BATCH) break;
      await new Promise((r) => setImmediate(r));
    }
    return total;
  }
  if (d === 0) return total;
  const r = TABLE_RULE[category];
  for (let guard = 0; guard < 100000; guard++) {
    const changes = durableTransaction(() => db.prepare(
      `DELETE FROM ${r.table} WHERE id IN (SELECT id FROM ${r.table} WHERE ${r.col} < datetime('now', ?) ORDER BY id LIMIT ?)`
    ).run(ageSince(d), BATCH).changes);
    total.rows += changes;
    if (changes < BATCH) break;
    await new Promise((res) => setImmediate(res));
  }
  return total;
}

/* Manual purge of chosen encounters (by attempt id). Overrides do not apply: the admin chose them. */
export function purgeVpAttempts(attemptIds, req = null, now = Date.now()) {
  const ids = [...new Set((attemptIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
  if (!ids.length) return { sessions: 0, events: 0, transcripts: 0 };
  const marks = ids.map(() => "?").join(",");
  const sessionIds = db.prepare(`SELECT s.id FROM vp_sessions s JOIN attempts a ON a.id=s.attempt_id
    WHERE a.type='vp' AND a.id IN (${marks}) AND s.finished_at IS NOT NULL AND s.study_id IS NULL AND s.purged_ms IS NULL`)
    .all(...ids).map((r) => r.id);
  const counts = purgeVpIds(sessionIds, now);
  audit(req, "vp_chat.purge", "attempts", { attempts: ids.length, ...counts });
  return counts;
}

/* Each category runs with the policy period. vp_chats always runs, because a class
   or exam can keep its own period even when the global one is off. */
export async function runAutomaticRetention({ now = Date.now(), policy = readPolicy() } = {}) {
  const counts = {};
  for (const c of CATEGORIES) {
    if (c !== "vp_chats" && policy[c] === 0) continue;
    counts[c] = await purgeCategory(c, policy[c], now);
  }
  const info = storageInfo();
  if (info.autoVacuum === "incremental" && info.freePages > 0) {
    db.exec("PRAGMA incremental_vacuum(5000)");
  }
  setKv(LAST_RUN_KEY, String(now));
  audit(null, "retention.auto", "retention", counts);
  return counts;
}

export function lastRunMs() {
  return Number(getKv(LAST_RUN_KEY)) || 0;
}

/* Runs at most once a day across all processes (the job lease keeps one process at a time). */
export function startRetention(checkEveryMs = 60 * 60 * 1000) {
  const timer = setInterval(async () => {
    try {
      if (Date.now() - lastRunMs() < DAY_MS) return;
      if (!leases.tryLease("retention", 2 * 60 * 60 * 1000)) return;
      await runAutomaticRetention();
    } catch (e) {
      console.error("retention:", e?.message || e);
    }
  }, checkEveryMs);
  timer.unref?.();
  return timer;
}

/* Size of the database file (with its WAL) and free space inside it. */
export function storageInfo() {
  const pageSize = Number(db.prepare("PRAGMA page_size").get()?.page_size) || 4096;
  const pageCount = Number(db.prepare("PRAGMA page_count").get()?.page_count) || 0;
  const freePages = Number(db.prepare("PRAGMA freelist_count").get()?.freelist_count) || 0;
  const mode = Number(db.prepare("PRAGMA auto_vacuum").get()?.auto_vacuum) || 0;
  let fileBytes = 0;
  for (const f of [DB_PATH, `${DB_PATH}-wal`]) {
    try { fileBytes += fs.statSync(f).size; } catch { /* no WAL yet */ }
  }
  return {
    fileBytes, pageSize, pageCount, freePages,
    freeBytes: freePages * pageSize,
    autoVacuum: mode === 2 ? "incremental" : mode === 1 ? "full" : "none",
  };
}

/* Gives free pages back to the file system. A database created without
   auto_vacuum is converted once with VACUUM (it needs free disk space about
   the size of the file). After that, `incremental_vacuum` is cheap. */
export function compactDatabase() {
  const before = storageInfo();
  if (before.autoVacuum !== "incremental") {
    db.exec("PRAGMA auto_vacuum = INCREMENTAL");
    db.exec("VACUUM");
  } else {
    db.exec("PRAGMA incremental_vacuum");
  }
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  const after = storageInfo();
  return { before, after };
}

/* Per-class and per-exam periods. kind is "class" or "exam". */
export function listItemPeriods(kind, limit = 500) {
  const table = kind === "exam" ? "exams" : "classes";
  const nameCol = kind === "exam" ? "title_fa" : "name_fa";
  const fk = kind === "exam" ? "exam_id" : "class_id";
  return db.prepare(`SELECT t.id, t.${nameCol} AS name_fa, ${kind === "exam" ? "t.title_en" : "t.name_en"} AS name_en,
      ${kind === "exam" ? "NULL" : "t.code"} AS code, t.retention_days,
      (SELECT COUNT(*) FROM vp_sessions s WHERE s.${fk}=t.id AND s.purged_ms IS NULL AND s.finished_at IS NOT NULL) AS chats
    FROM ${table} t ORDER BY t.id DESC LIMIT ?`).all(limit);
}

/* Sets the period for chosen classes or exams. days: null = inherit, 0 = keep, N = days. */
export function setItemPeriods(kind, ids, days, req = null) {
  const d = cleanDays(days);
  if (d === undefined) return { error: "retention_days_range" };
  const list = [...new Set((ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
  if (!list.length) return { changed: 0 };
  const table = kind === "exam" ? "exams" : "classes";
  const marks = list.map(() => "?").join(",");
  const changed = durableTransaction(() => db.prepare(`UPDATE ${table} SET retention_days=? WHERE id IN (${marks})`).run(d, ...list).changes);
  audit(req, "retention.items", `${table}:${list.length}`, { kind, days: d, count: changed });
  return { changed };
}
