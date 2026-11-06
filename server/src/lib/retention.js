/* ================================================================
   retention.js — how long stored chats, logs and archived classes or exams are
   kept, and how they are deleted.

   Nothing is deleted automatically unless an admin turns a period on. The
   defaults keep everything (rum_vitals keeps its long-standing 45 days: it is
   monitoring data, not learner content).

   Categories and what a purge removes:
   - vp_chats: a FINISHED and GRADED virtual-patient encounter. Its event log,
     the chat text (attempts.transcript_json of that VP attempt), the saved
     progress, the case snapshot and the grading draft are removed. The grade,
     the evaluation (درسنامه) and the reference snapshot stay. An encounter that
     is still open, not yet graded, in staff review, or linked to a research
     study is never touched.
   - academic_items: an ARCHIVED class or exam (active = 0) whose last activity
     is older than its period. Removing it removes its roster, cases, flashcard
     settings, VP chats, questionnaire forms and responses, AND its grades
     (attempts). Nothing of this is kept. It is blocked while the item is linked
     to research, while a still-active exam uses it, or while a grading job runs.
   - tutor_chats: AI tutor messages (rows).
   - security_events: sign-in and permission events (they hold IP and path).
   - rum_vitals: page performance samples.

   Periods: the global policy per category, plus per class and per exam
   overrides (classes.retention_days, exams.retention_days): NULL = inherit,
   0 = keep, N = days. For a VP chat the class period wins, then the exam period,
   then the global one. A class or exam uses its own period, then the global one.

   Automatic runs happen at most once a day, in one process at a time (job
   lease), in batches, each batch one transaction. Each run writes one audit row
   with COUNTS only, never content.
   ================================================================ */
import fs from "node:fs";
import { db, durableTransaction } from "../db.js";
import { DB_PATH } from "./paths.js";
import { makeLeases } from "./leases.js";
import { audit } from "./audit.js";

export const CATEGORIES = ["vp_chats", "academic_items", "tutor_chats", "security_events", "rum_vitals"];
/* Categories whose per-item overrides apply even when the global period is off. */
const OVERRIDABLE = new Set(["vp_chats", "academic_items"]);
export const MIN_DAYS = 30;
export const MAX_DAYS = 3650;
export const PRESET_DAYS = [0, 90, 180, 365, 730];
const DEFAULT_POLICY = { vp_chats: 0, academic_items: 0, tutor_chats: 0, security_events: 0, rum_vitals: 45 };

const BATCH = 200;
const ACADEMIC_BATCH = 20;
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

/* ---------- virtual-patient chats ---------- */

/* R90: an encounter of a student under an open per-student inspection request is never purged. */
const STUDENT_NOT_HELD_VP = `NOT EXISTS (SELECT 1 FROM inspection_requests ir WHERE ir.closed_at IS NULL AND ir.user_id=s.user_id)`;

/* A purge needs a settled, graded encounter outside research. */
const VP_SETTLED = `s.finished_at IS NOT NULL AND s.attempt_id IS NOT NULL AND s.study_id IS NULL
  AND s.review_required=0 AND s.purged_ms IS NULL
  AND COALESCE(c.inspection_hold,0)=0 AND COALESCE(e.inspection_hold,0)=0
  AND ${STUDENT_NOT_HELD_VP}`;
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

/* ---------- archived classes and exams (with their grades) ---------- */

/* Last activity as julian days: the item's own date, or its newest attempt. */
const CLASS_LAST = `MAX(julianday(c.created_at), COALESCE((SELECT MAX(julianday(a.created_at)) FROM attempts a WHERE a.class_id=c.id), 0))`;
const EXAM_LAST = `MAX(COALESCE(julianday(e.ends_at), julianday(e.created_at), 0), COALESCE((SELECT MAX(julianday(a.created_at)) FROM attempts a WHERE a.exam_id=e.id), 0))`;
/* A class is still in use while one of its attempts or chats belongs to an active exam. */
const CLASS_USED_BY_ACTIVE_EXAM = `(EXISTS (SELECT 1 FROM attempts a JOIN exams x ON x.id=a.exam_id WHERE a.class_id=c.id AND x.active=1)
  OR EXISTS (SELECT 1 FROM vp_sessions s JOIN exams x ON x.id=s.exam_id WHERE s.class_id=c.id AND x.active=1))`;

/* Archived, not research-linked, old enough. Blocked items are filtered again in JS. */
function academicIdsDue(days) {
  const cls = db.prepare(`SELECT c.id FROM classes c
    WHERE c.active=0 AND c.study_id IS NULL AND COALESCE(c.retention_days, ?) > 0
      AND ${CLASS_LAST} < julianday('now') - COALESCE(c.retention_days, ?)
      AND NOT ${CLASS_USED_BY_ACTIVE_EXAM}`).all(days, days).map((r) => ({ kind: "class", id: r.id }));
  const exm = db.prepare(`SELECT e.id FROM exams e
    WHERE e.active=0 AND e.study_id IS NULL AND COALESCE(e.retention_days, ?) > 0
      AND ${EXAM_LAST} < julianday('now') - COALESCE(e.retention_days, ?)`).all(days, days).map((r) => ({ kind: "exam", id: r.id }));
  return [...cls, ...exm];
}

/* R90: a student under an open per-student request keeps every class and exam they are on,
   because the records of that student sit in them. Other students' rows there are kept too
   until redaction exists (34 CFR 99.12 allows limiting access to records about several people). */
const HELD_STUDENT_IN_CLASS = `EXISTS (SELECT 1 FROM inspection_requests r WHERE r.closed_at IS NULL AND r.user_id IN (
    SELECT user_id FROM class_members WHERE class_id=@id UNION SELECT user_id FROM attempts WHERE class_id=@id UNION SELECT user_id FROM vp_sessions WHERE class_id=@id))`;
const HELD_STUDENT_IN_EXAM = `EXISTS (SELECT 1 FROM inspection_requests r WHERE r.closed_at IS NULL AND r.user_id IN (
    SELECT user_id FROM exam_participants WHERE exam_id=@id UNION SELECT user_id FROM attempts WHERE exam_id=@id UNION SELECT user_id FROM vp_sessions WHERE exam_id=@id))`;

/* Why this item must not be deleted now, or null when it may be. */
/* Held when the item, or anything of it that is shared with the other kind, is under an open inspection request. */
const HOLD_SQL = {
  class: `SELECT 1 WHERE EXISTS (SELECT 1 FROM classes WHERE id=@id AND inspection_hold=1)
    OR EXISTS (SELECT 1 FROM attempts a JOIN exams x ON x.id=a.exam_id WHERE a.class_id=@id AND x.inspection_hold=1)
    OR EXISTS (SELECT 1 FROM vp_sessions s JOIN exams x ON x.id=s.exam_id WHERE s.class_id=@id AND x.inspection_hold=1)
    OR ${HELD_STUDENT_IN_CLASS}`,
  exam: `SELECT 1 WHERE EXISTS (SELECT 1 FROM exams WHERE id=@id AND inspection_hold=1)
    OR EXISTS (SELECT 1 FROM attempts a JOIN classes x ON x.id=a.class_id WHERE a.exam_id=@id AND x.inspection_hold=1)
    OR EXISTS (SELECT 1 FROM vp_sessions s JOIN classes x ON x.id=s.class_id WHERE s.exam_id=@id AND x.inspection_hold=1)
    OR ${HELD_STUDENT_IN_EXAM}`,
};

export function blockReason(kind, id, now = Date.now()) {
  const table = kind === "exam" ? "exams" : "classes";
  const row = db.prepare(`SELECT id, active, study_id FROM ${table} WHERE id=?`).get(id);
  if (!row) return "not_found";
  if (db.prepare(HOLD_SQL[kind === "exam" ? "exam" : "class"]).get({ id })) return "inspection_hold";
  if (row.active !== 0) return "not_archived";
  if (row.study_id != null) return "research_linked";
  if (kind === "class") {
    const used = db.prepare(`SELECT 1 FROM classes c WHERE c.id=? AND ${CLASS_USED_BY_ACTIVE_EXAM} LIMIT 1`).get(id);
    if (used) return "used_by_active_exam";
  }
  const col = kind === "exam" ? "exam_id" : "class_id";
  const leased = db.prepare(`SELECT 1 FROM vp_sessions WHERE ${col}=? AND grading_lease_until > ? LIMIT 1`).get(id, now);
  if (leased) return "grading_in_progress";
  return null;
}

/* Counts of what deleting this item would remove. Read-only. */
export function academicImpact(kind, id) {
  if (kind === "exam") {
    return {
      attempts: db.prepare("SELECT COUNT(*) n FROM attempts WHERE exam_id=?").get(id).n,
      chats: db.prepare("SELECT COUNT(*) n FROM vp_sessions WHERE exam_id=?").get(id).n,
      members: db.prepare("SELECT COUNT(*) n FROM exam_participants WHERE exam_id=?").get(id).n,
      responses: db.prepare(`SELECT COUNT(*) n FROM questionnaire_responses WHERE form_id IN (SELECT id FROM questionnaire_forms WHERE exam_id=?)`).get(id).n,
    };
  }
  return {
    attempts: db.prepare("SELECT COUNT(*) n FROM attempts WHERE class_id=?").get(id).n,
    chats: db.prepare("SELECT COUNT(*) n FROM vp_sessions WHERE class_id=?").get(id).n,
    members: db.prepare("SELECT COUNT(*) n FROM class_members WHERE class_id=?").get(id).n,
    responses: db.prepare(`SELECT COUNT(*) n FROM questionnaire_responses WHERE form_id IN (SELECT id FROM questionnaire_forms WHERE class_id=?)`).get(id).n,
  };
}

/* Deletes one archived item and everything that belongs to it, in ONE transaction:
   a crash leaves either the whole item or none of it. Returns the row counts. */
function deleteAcademicItem(kind, id) {
  const sid = kind === "exam" ? "exam_id" : "class_id";
  const formIds = `SELECT id FROM questionnaire_forms WHERE ${sid}=?`;
  return durableTransaction(() => {
    const run = (sql, ...args) => db.prepare(sql).run(...args).changes;
    const counts = { attempts: 0, chats: 0, members: 0, responses: 0 };
    counts.chats = db.prepare(`SELECT COUNT(*) n FROM vp_sessions WHERE ${sid}=?`).get(id).n;
    counts.responses = run(`DELETE FROM questionnaire_responses WHERE form_id IN (${formIds})`, id);
    run(`DELETE FROM questionnaire_forms WHERE ${sid}=?`, id);
    run(`DELETE FROM vp_session_events WHERE session_id IN (SELECT id FROM vp_sessions WHERE ${sid}=?)`, id);
    run(`DELETE FROM vp_sessions WHERE ${sid}=?`, id);
    counts.attempts = run(`DELETE FROM attempts WHERE ${sid}=?`, id);
    if (kind === "exam") {
      counts.members = run("DELETE FROM exam_participants WHERE exam_id=?", id);
      run("DELETE FROM exams WHERE id=?", id);
    } else {
      counts.members = run("DELETE FROM class_members WHERE class_id=?", id);
      for (const t of ["class_cases", "class_flashcards", "class_flashcard_attempts", "class_flash_submissions"]) {
        run(`DELETE FROM ${t} WHERE class_id=?`, id);
      }
      run("DELETE FROM classes WHERE id=?", id);
    }
    return counts;
  });
}

/* Deletes the given archived items, skipping any that is blocked. Returns counts and skips. */
function purgeAcademic(items, req = null, now = Date.now()) {
  const total = { items: 0, attempts: 0, chats: 0, members: 0, responses: 0 };
  const skipped = [];
  for (let i = 0; i < items.length; i += ACADEMIC_BATCH) {
    for (const { kind, id } of items.slice(i, i + ACADEMIC_BATCH)) {
      const why = blockReason(kind, id, now);
      if (why) { skipped.push({ kind, id, reason: why }); continue; }
      const c = deleteAcademicItem(kind, id);
      total.items += 1;
      for (const k of Object.keys(c)) total[k] += c[k];
    }
  }
  if (total.items) audit(req, "academic.purge", "classes_exams", { ...total, ids: items.map((x) => `${x.kind}:${x.id}`).slice(0, 100) });
  return { ...total, skipped };
}

/* ---------- counts for the admin ---------- */

function previewTable(category, days) {
  const r = TABLE_RULE[category];
  const row = db.prepare(`SELECT COUNT(*) n FROM ${r.table} WHERE ${r.col} < datetime('now', ?)${heldClause(r)}`).get(ageSince(days));
  return { rows: row?.n || 0 };
}

function heldClause(r) {
  return r.heldBy ? ` AND NOT EXISTS (SELECT 1 FROM inspection_requests ir WHERE ir.closed_at IS NULL AND ir.user_id=${r.table}.${r.heldBy})` : "";
}

const TABLE_RULE = {
  // R90: tutor chats of a student under an open inspection request are kept (heldBy = owner column).
  tutor_chats: { table: "tutor_chats", col: "created_at", heldBy: "user_id" },
  security_events: { table: "security_events", col: "created_at" },
  rum_vitals: { table: "rum_vitals", col: "created_at" },
};

/* Count what a purge with this period would remove. Read-only. */
export function previewPurge(category, days) {
  if (!CATEGORIES.includes(category)) return null;
  const d = cleanDays(days);
  if (d === undefined || d === null) return null;
  if (category === "vp_chats") return { category, days: d, ...vpPreview(d) };
  if (category === "academic_items") {
    const due = academicIdsDue(d).filter((x) => !blockReason(x.kind, x.id));
    const totals = { classes: 0, exams: 0, attempts: 0, chats: 0, members: 0, responses: 0 };
    for (const x of due) {
      x.kind === "exam" ? totals.exams++ : totals.classes++;
      const c = academicImpact(x.kind, x.id);
      for (const k of Object.keys(c)) totals[k] += c[k];
    }
    return { category, days: d, ...totals };
  }
  if (d === 0) return { category, days: d, rows: 0 };
  return { category, days: d, ...previewTable(category, d) };
}

/* Deletes everything of one category older than `days` (the per-item periods still
   apply). Returns counts. Runs in batches so a large table never holds the write
   lock for long. */
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
  if (category === "academic_items") {
    const due = academicIdsDue(d);
    const out = purgeAcademic(due, null, now);
    return { items: out.items, attempts: out.attempts, chats: out.chats, members: out.members, responses: out.responses, skipped: out.skipped.length };
  }
  if (d === 0) return total;
  const r = TABLE_RULE[category];
  for (let guard = 0; guard < 100000; guard++) {
    const changes = durableTransaction(() => db.prepare(
      `DELETE FROM ${r.table} WHERE id IN (SELECT id FROM ${r.table} WHERE ${r.col} < datetime('now', ?)${heldClause(r)} ORDER BY id LIMIT ?)`
    ).run(ageSince(d), BATCH).changes);
    total.rows += changes;
    if (changes < BATCH) break;
    await new Promise((res) => setImmediate(res));
  }
  return total;
}

/* Manual purge of chosen encounters (by attempt id). Periods do not apply: the admin chose them. */
export function purgeVpAttempts(attemptIds, req = null, now = Date.now()) {
  const ids = [...new Set((attemptIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
  if (!ids.length) return { sessions: 0, events: 0, transcripts: 0 };
  const marks = ids.map(() => "?").join(",");
  const sessionIds = db.prepare(`SELECT s.id FROM vp_sessions s JOIN attempts a ON a.id=s.attempt_id
    LEFT JOIN classes c ON c.id=s.class_id LEFT JOIN exams e ON e.id=s.exam_id
    WHERE a.type='vp' AND a.id IN (${marks}) AND s.finished_at IS NOT NULL AND s.study_id IS NULL AND s.purged_ms IS NULL
      AND COALESCE(c.inspection_hold,0)=0 AND COALESCE(e.inspection_hold,0)=0 AND ${STUDENT_NOT_HELD_VP}`)
    .all(...ids).map((r) => r.id);
  const counts = purgeVpIds(sessionIds, now);
  audit(req, "vp_chat.purge", "attempts", { attempts: ids.length, ...counts });
  return counts;
}

/* Each category runs with the policy period. Overridable categories always run,
   because one class or exam can keep its own period while the global one is off. */
export async function runAutomaticRetention({ now = Date.now(), policy = readPolicy() } = {}) {
  const counts = {};
  for (const c of CATEGORIES) {
    if (!OVERRIDABLE.has(c) && policy[c] === 0) continue;
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

/* Per-class and per-exam periods and state. kind is "class" or "exam". */
export function listItemPeriods(kind, limit = 500) {
  if (kind === "exam") {
    return db.prepare(`SELECT e.id, e.title_fa AS name_fa, e.title_en AS name_en, NULL AS code,
        e.active, e.retention_days, e.study_id, e.inspection_hold,
        (SELECT COUNT(*) FROM vp_sessions s WHERE s.exam_id=e.id AND s.finished_at IS NOT NULL AND s.purged_ms IS NULL) AS chats,
        (SELECT COUNT(*) FROM attempts a WHERE a.exam_id=e.id) AS attempts
      FROM exams e ORDER BY e.id DESC LIMIT ?`).all(limit);
  }
  return db.prepare(`SELECT c.id, c.name_fa, c.name_en, c.code, c.active, c.retention_days, c.study_id, c.inspection_hold,
      (SELECT COUNT(*) FROM vp_sessions s WHERE s.class_id=c.id AND s.finished_at IS NOT NULL AND s.purged_ms IS NULL) AS chats,
      (SELECT COUNT(*) FROM attempts a WHERE a.class_id=c.id) AS attempts
    FROM classes c ORDER BY c.id DESC LIMIT ?`).all(limit);
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

/* Opens (hold = true) or releases (hold = false) the inspection hold on chosen classes or exams.
   While held, nothing of the item is deleted by any path. Audited with counts only. */
export function setInspectionHold(kind, ids, hold, req = null) {
  const list = [...new Set((ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
  if (!list.length) return { changed: 0 };
  const table = kind === "exam" ? "exams" : "classes";
  const marks = list.map(() => "?").join(",");
  const flag = hold ? 1 : 0;
  const changed = durableTransaction(() => db.prepare(`UPDATE ${table} SET inspection_hold=? WHERE id IN (${marks}) AND inspection_hold<>?`)
    .run(flag, ...list, flag).changes);
  audit(req, hold ? "inspection.hold" : "inspection.release", `${table}:${list.length}`, { kind, count: changed });
  return { changed };
}

/* R90: per-student inspection requests. Opening one is idempotent per student; closing one
   releases that student's protection (the class/exam holds are separate and stay as they are). */
export function studentOnInspectionHold(uid) {
  return !!db.prepare("SELECT 1 FROM inspection_requests WHERE user_id=? AND closed_at IS NULL LIMIT 1").get(Number(uid) || 0);
}
/* R90: how many students under an open request would lose their enrolment row if the roster
   of this class or exam were replaced by keepUserIds. A replace is refused when this is above 0. */
export function heldDropCount(kind, id, keepUserIds) {
  const table = kind === "exam" ? "exam_participants" : "class_members";
  const col = kind === "exam" ? "exam_id" : "class_id";
  const keep = new Set((keepUserIds || []).map(Number));
  const rows = db.prepare(`SELECT user_id FROM ${table} WHERE ${col}=? AND user_id IN (SELECT user_id FROM inspection_requests WHERE closed_at IS NULL)`).all(Number(id) || 0);
  return rows.filter((r) => !keep.has(Number(r.user_id))).length;
}
export function openStudentHold(userId, { reference = "" } = {}, req = null) {
  const uid = Number(userId) || 0;
  const u = db.prepare("SELECT id,role FROM users WHERE id=?").get(uid);
  if (!u) return { error: "not_found" };
  if (!["student", "learner"].includes(u.role)) return { error: "not_a_student" };
  const open = db.prepare("SELECT id FROM inspection_requests WHERE user_id=? AND closed_at IS NULL").get(uid);
  if (open) return { id: open.id, created: false };
  const ref = String(reference || "").trim().slice(0, 100);
  const id = durableTransaction(() => db.prepare("INSERT INTO inspection_requests (user_id,opened_by,reference) VALUES (?,?,?)")
    .run(uid, req?.user?.id ?? null, ref).lastInsertRowid);
  audit(req, "inspection.request.open", `user:${uid}`, { request: Number(id) });
  return { id: Number(id), created: true };
}
export function closeStudentHold(id, req = null) {
  const rid = Number(id) || 0;
  const changed = durableTransaction(() => db.prepare("UPDATE inspection_requests SET closed_at=datetime('now'),closed_by=? WHERE id=? AND closed_at IS NULL")
    .run(req?.user?.id ?? null, rid).changes);
  audit(req, "inspection.request.close", `inspection:${rid}`, { count: changed });
  return { changed };
}
export function listStudentHolds() {
  return db.prepare(`SELECT r.id, r.user_id, r.opened_at, r.reference, u.username, u.student_no, u.name_fa, u.name_en,
      (SELECT COUNT(*) FROM class_members m WHERE m.user_id=r.user_id) AS classes,
      (SELECT COUNT(*) FROM exam_participants p WHERE p.user_id=r.user_id) AS exams,
      (SELECT COUNT(*) FROM attempts a WHERE a.user_id=r.user_id) AS attempts,
      (SELECT COUNT(*) FROM vp_sessions v WHERE v.user_id=r.user_id AND v.purged_ms IS NULL) AS vp_sessions
    FROM inspection_requests r JOIN users u ON u.id=r.user_id
    WHERE r.closed_at IS NULL ORDER BY r.id DESC LIMIT 200`).all();
}

/* Admin deletes chosen archived classes or exams now (periods do not apply). Blocked items are reported. */
export function deleteAcademicNow(kind, ids, req = null) {
  const k = kind === "exam" ? "exam" : "class";
  const list = [...new Set((ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 100);
  return purgeAcademic(list.map((id) => ({ kind: k, id })), req);
}
