/* ================================================================
   db.js — Pure-JS SQLite via sql.js (WebAssembly).
   No native compilation, no Python, no build tools required.
   Exposes a small better-sqlite3-compatible synchronous API so the
   rest of the codebase is unchanged:
     db.prepare(sql).get(...args) / .all(...args) / .run(...args)
     db.exec(sql), db.pragma(...), db.transaction(fn)
   ================================================================ */
import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Persistent data (DB + uploads + backups) lives OUTSIDE the code in DATA_DIR
// so the site can be upgraded without losing data. See lib/paths.js.
import { DB_PATH, BACKUPS_DIR, ensureDataDirs } from "./lib/paths.js";
ensureDataDirs();

// sql.js ships its wasm inside node_modules; locate it for the loader.
// Works whether deps are installed in server/node_modules (dev) OR in the app
// root's node_modules (cPanel "Run NPM Install" installs at the app root).
function wasmPath() {
  const candidates = [
    path.join(__dirname, "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm"),        // server/node_modules
    path.join(__dirname, "..", "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm"),   // app-root/node_modules (cPanel)
  ];
  for (const p of candidates) { try { if (fs.existsSync(p)) return p; } catch { /* */ } }
  return candidates[0]; // sensible default
}

let SQL = null;      // the sql.js module
let rawDb = null;    // the underlying sql.js Database
let saveTimer = null;
let schemaReady = false;  // initSchema() is expensive; run it once per loaded DB

/* ---------------------------------------------------------------------------
   Persistence model (sql.js keeps the whole DB in WASM memory)
   ---------------------------------------------------------------------------
   The only way to write sql.js to disk is `export()` = a full image copy
   (~80 MB with the shipped question bank, ~200 ms). Two things made this
   expensive on a 1 GB shared host:
     • `persistNow()` was called from 260+ places, often several times per
       request, and each call exported EVEN WHEN NOTHING HAD CHANGED (e.g. a
       migration pass that altered zero rows) — so every boot / admin click
       paid 200 ms CPU + a transient 80 MB buffer;
     • the export buffer is allocated outside the V8 heap, and V8 does not
       hurry to release "external" memory → RSS climbed to 350-450 MB and
       stayed there, which is exactly the range where cPanel/LVE kills a
       process.
   Now: a dirty flag is set by every write path (`run`, `exec`, transactions)
   and `persistNow()` exports only when dirty; the buffer is dropped right
   after the write. Debounced writes coalesce as before. */
let dirty = false;
export function markDirty() { dirty = true; }

function persist() {
  // debounce writes so bursts of inserts don't thrash the disk
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { persistNow(); }, 1500);
}
function persistNow({ force = false, throwOnError = false } = {}) {
  try {
    clearTimeout(saveTimer);            // cancel any pending debounced write
    if (!rawDb) return;
    if (!dirty && !force && fs.existsSync(DB_PATH)) return;   // nothing new to write
    // Atomic save: write the whole image to a sibling temp file, fsync it, then
    // rename over the live file. A crash / power cut / disk-full in the middle
    // of a plain writeFileSync(DB_PATH) leaves a truncated, unloadable
    // medlab.db — the entire site's data. rename() is atomic on POSIX and on
    // NTFS within one volume, so the live file is always either the old or the
    // new complete image, never a partial one.
    //
    // The tmp name carries the PID: the first-boot seed runs in a CHILD process
    // that shares DB_PATH, and a shared "...medlab.db.tmp" used to be stolen by
    // whichever process renamed first — the loser saw ENOENT on rename and, in
    // the worst interleave, a stale pre-seed export could land AFTER the child's
    // seeded image. Per-process tmp names make concurrent exports race-free
    // (last complete writer wins, and the parent's reloadDb() then discards its
    // stale image).
    let buf = rawDb.export();           // Uint8Array over a fresh copy
    const tmp = `${DB_PATH}.tmp-${process.pid}`;
    const fd = fs.openSync(tmp, "w");
    try { fs.writeSync(fd, buf, 0, buf.length, 0); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    buf = null;
    fs.renameSync(tmp, DB_PATH);
    dirty = false;
  } catch (e) {
    // Never crash a request because the flush failed, but do not stay silent:
    // an operator must know the disk is full / read-only before data is lost.
    console.error("[db] persist failed:", e?.message || e);
    if (throwOnError) throw new Error("database_persistence_failed");
  }
}

// Durability: flush any pending write synchronously when the process exits, so a
// restart (e.g. after a code change) never loses a recently-saved record.
let flushed = false;
function flushOnExit() {
  if (flushed) return; flushed = true;
  persistNow();
}
process.on("exit", flushOnExit);
process.on("SIGINT", () => { flushOnExit(); process.exit(0); });
process.on("SIGTERM", () => { flushOnExit(); process.exit(0); });

// Statement wrapper mimicking better-sqlite3's prepared statement.
class Statement {
  constructor(sql) { this.sql = sql; }
  _bindRun(args) {
    const stmt = rawDb.prepare(this.sql);
    try { stmt.bind(normalizeArgs(args)); stmt.step(); }
    finally { stmt.free(); }
  }
  get(...args) {
    const stmt = rawDb.prepare(this.sql);
    try {
      stmt.bind(normalizeArgs(args));
      if (stmt.step()) return stmt.getAsObject();
      return undefined;
    } finally { stmt.free(); }
  }
  all(...args) {
    const stmt = rawDb.prepare(this.sql);
    const rows = [];
    try {
      stmt.bind(normalizeArgs(args));
      while (stmt.step()) rows.push(stmt.getAsObject());
    } finally { stmt.free(); }
    return rows;
  }
  run(...args) {
    this._bindRun(args);
    const changes = rawDb.getRowsModified();
    // last inserted id
    let lastInsertRowid = 0;
    const r = rawDb.exec("SELECT last_insert_rowid() AS id");
    if (r[0] && r[0].values[0]) lastInsertRowid = r[0].values[0][0];
    persist();
    return { changes, lastInsertRowid };
  }
}

// sql.js wants positional args as an array; support (a,b,c) and ([a,b,c]).
// Unlike better-sqlite3, sql.js rejects `undefined`, so coerce it to null.
// Also coerce booleans to 0/1 for SQLite compatibility.
function normalizeArgs(args) {
  let arr = (args.length === 1 && Array.isArray(args[0])) ? args[0] : args;
  return Array.from(arr).map((v) => {
    if (v === undefined) return null;
    if (typeof v === "boolean") return v ? 1 : 0;
    return v;
  });
}

function totalChanges() {
  try { const r = rawDb.exec("SELECT total_changes() AS n"); return r[0]?.values?.[0]?.[0] ?? 0; } catch { return 0; }
}
/* DDL does not bump total_changes(). Compare a cheap schema signature before
   and after, so a real ALTER/CREATE persists while an idempotent
   "CREATE TABLE IF NOT EXISTS" pass over an up-to-date database does not. */
function schemaSig() {
  try { const r = rawDb.exec("SELECT COUNT(*), COALESCE(SUM(LENGTH(sql)),0) FROM sqlite_master"); return String(r[0]?.values?.[0]); } catch { return ""; }
}

export const db = {
  prepare(sql) { return new Statement(sql); },
  exec(sql) {
    const isDdl = /\b(ALTER|CREATE|DROP)\s/i.test(sql);
    const before = totalChanges();
    const sigBefore = isDdl ? schemaSig() : null;
    rawDb.exec(sql);
    // Read-only pragmas / idempotent "CREATE TABLE IF NOT EXISTS" passes that
    // changed nothing must not schedule an 80 MB export.
    if (totalChanges() !== before || (isDdl && schemaSig() !== sigBefore)) persist();
    return this;
  },
  pragma(str) {
    // Support "foreign_keys = ON" / "journal_mode = WAL" style (best-effort).
    try { rawDb.exec("PRAGMA " + str + ";"); } catch (e) {}
  },
  transaction(fn) {
    // Returns a callable that runs fn inside BEGIN/COMMIT (rollback on error).
    return (...args) => {
      rawDb.exec("BEGIN");
      try {
        const out = fn(...args);
        rawDb.exec("COMMIT");
        dirty = true;
        persistNow();
        return out;
      } catch (e) {
        try { rawDb.exec("ROLLBACK"); } catch (_) {}
        throw e;
      }
    };
  },
};

// Must be called (and awaited) once before using `db`.
export async function initDb() {
  if (rawDb) return;
  SQL = await initSqlJs({ locateFile: () => wasmPath() });
  // Remove orphan temp exports left by crashed/killed processes (see persistNow
  // — tmp names carry the PID; a dead PID's tmp never gets renamed).
  try {
    for (const f of fs.readdirSync(path.dirname(DB_PATH))) {
      if (f.startsWith(path.basename(DB_PATH) + ".tmp-")) {
        const pid = Number(f.split("-").pop());
        if (!pid || pid === process.pid || !isProcessAlive(pid)) {
          try { fs.unlinkSync(path.join(path.dirname(DB_PATH), f)); } catch (_) {}
        }
      }
    }
  } catch (_) { /* best-effort */ }
  loadFromDisk();
  // Upgrade safety: snapshot the EXISTING database before any migrations run,
  // so a bad upgrade can always be rolled back. No-op on a brand-new DB.
  try { autoBackup(); } catch { /* best-effort, never block startup */ }
}

/* Copy the current medlab.db into DATA_DIR/backups with a timestamp, and keep
   only the most recent backups. Runs once per server start (before migrations).
   Skips when the DB file doesn't exist yet (first run) or is empty. */
export function snapshotDb({ keep = 3, force = false } = {}) { return autoBackup(keep, force); }
function autoBackup(keep = 3, force = false) {
  if (!fs.existsSync(DB_PATH)) return;
  const stat = fs.statSync(DB_PATH);
  if (!stat.size) return;
  const BACKUPS_DIR = path.join(path.dirname(DB_PATH), "backups");
  try { fs.mkdirSync(BACKUPS_DIR, { recursive: true }); } catch { /* */ }
  try {
    const existing = fs.readdirSync(BACKUPS_DIR)
      .filter((f) => /^medlab-.*\.db$/.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    // On cPanel, Passenger restarts can be frequent. Back up at most daily so
    // startup stays fast and small hosting disks are not filled by boot copies.
    // (force bypasses the cadence — used for the explicit post-seed snapshot.)
    if (!force && existing[0] && Date.now() - existing[0].t < 24 * 60 * 60 * 1000) return;
  } catch { /* */ }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(BACKUPS_DIR, `medlab-${stamp}.db`);
  try { fs.copyFileSync(DB_PATH, dest); } catch { return; }
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter((f) => /^medlab-.*\.db$/.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const { f } of files.slice(keep)) { try { fs.unlinkSync(path.join(BACKUPS_DIR, f)); } catch { /* */ } }
  } catch { /* */ }
}

// Force-reload the database from disk (e.g. after a seed subprocess wrote it).
export async function reloadDb() {
  if (!SQL) SQL = await initSqlJs({ locateFile: () => wasmPath() });
  if (rawDb) { try { rawDb.close(); } catch (e) { /* */ } rawDb = null; }
  schemaReady = false;
  loadFromDisk();
}

/* Try to open a database FILE and validate its structure. Returns a live
   sql.js Database on success, or null when the bytes are not a healthy
   SQLite image (truncated write, filesystem bit-rot, manual corruption…).
   PRAGMA quick_check is the fast structural scan; it answers "ok" for a
   healthy database. (Standing practice: integrity/quick_check before use,
   prefer a verified backup over salvaging. See docs/UPGRADE.md.) */
function tryOpenDbFile(file) {
  let db = null;
  try {
    let buf = fs.readFileSync(file);
    db = new SQL.Database(buf);      // throws on non-SQLite bytes
    buf = null;                      // release the Node-side copy promptly
    const rows = db.exec("PRAGMA quick_check;");
    const msg = rows?.[0]?.values?.[0]?.[0];
    if (String(msg).trim().toLowerCase() !== "ok") throw new Error("quick_check: " + msg);
    return db;
  } catch (e) {
    if (db) { try { db.close(); } catch (_) {} }
    return null;
  }
}

/* Load a DB image with verified backup fallback. Returns
   { db, restoredFrom, quarantined }. Never throws. Exported for tests. */
export function loadImageWithFallback(dbPath, { log = console.error, backupsDir = BACKUPS_DIR } = {}) {
  if (fs.existsSync(dbPath)) {
    const ok = tryOpenDbFile(dbPath);
    if (ok) return { db: ok, restoredFrom: null, quarantined: false };
    log(`[db] ❌ ${path.basename(dbPath)} is corrupt/unloadable — attempting automatic restore from backups/`);
  }
  // Look for recent verified backups (newest first).
  let candidates = [];
  try {
    candidates = fs.readdirSync(backupsDir)
      .filter((f) => /^medlab-.*\.db$/.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(backupsDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
      .map((x) => path.join(backupsDir, x.f));
  } catch (_) { /* no backups dir */ }
  for (const cand of candidates.slice(0, 3)) {
    const restored = tryOpenDbFile(cand);
    if (restored) {
      let quarantined = false;
      if (fs.existsSync(dbPath)) {
        // Keep the corrupt file for forensics — never silently destroy data.
        try { fs.renameSync(dbPath, `${dbPath}.corrupt-${Date.now()}`); quarantined = true; } catch (_) {}
      }
      log(`[db] ✓ automatically restored database from backup ${path.basename(cand)}`);
      return { db: restored, restoredFrom: cand, quarantined };
    }
    log(`[db] backup ${path.basename(cand)} also fails validation; trying older…`);
  }
  return { db: null, restoredFrom: null, quarantined: false };
}

function loadFromDisk() {
  // sql.js copies the image into its own WASM heap; the scoped buffer inside
  // tryOpenDbFile releases the Node-side copy (~80 MB for a full question
  // bank) promptly instead of lingering until the next major GC.
  const res = loadImageWithFallback(DB_PATH);
  if (res.db) {
    rawDb = res.db;
    if (res.restoredFrom) {
      dirty = true;
      persistNow({ force: true });    // write the restored image over the (quarantined) corrupt file
    } else {
      dirty = false;                  // in-memory image == file on disk
    }
  } else {
    rawDb = new SQL.Database();
    dirty = false;
  }
  rawDb.exec("PRAGMA foreign_keys = ON;");
}

export function initSchema() {
  if (schemaReady) return;
  schemaReady = true;
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name_fa TEXT, name_en TEXT,
    student_no TEXT,
    role TEXT NOT NULL CHECK(role IN ('student','teacher','admin','learner','content_manager','support')),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS exam_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    case_id INTEGER NOT NULL,
    assigned_by INTEGER,
    max_attempts INTEGER DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, case_id)
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_fa TEXT, name_en TEXT,
    desc_fa TEXT, desc_en TEXT,
    code TEXT UNIQUE,
    owner_id INTEGER,
    max_attempts INTEGER DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS class_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    case_id INTEGER NOT NULL,
    weight INTEGER DEFAULT 1,
    UNIQUE(class_id, case_id)
  );
  CREATE TABLE IF NOT EXISTS class_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TEXT DEFAULT (datetime('now')),
    UNIQUE(class_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS checklists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_fa TEXT, name_en TEXT,
    items_json TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version INTEGER NOT NULL DEFAULT 1,
    difficulty TEXT DEFAULT 'medium',
    checklist_id INTEGER,
    data_json TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS case_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    data_json TEXT NOT NULL,
    archived_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS flashcards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version INTEGER NOT NULL DEFAULT 1,
    difficulty TEXT DEFAULT 'medium',
    data_json TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS flashcard_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flashcard_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    data_json TEXT NOT NULL,
    archived_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prompts (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Teacher-authored custom answer catalogs (subject → list of options)
  CREATE TABLE IF NOT EXISTS catalogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_fa TEXT, name_en TEXT,
    items_json TEXT NOT NULL DEFAULT '[]',
    owner_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT NOT NULL,
    case_id INTEGER,
    class_id INTEGER,
    exam_id INTEGER,
    content_version INTEGER,
    score INTEGER,
    transcript_json TEXT,
    eval_json TEXT,
    turns INTEGER DEFAULT 0,
    tests INTEGER DEFAULT 0,
    imaging_count INTEGER DEFAULT 0,
    ddx_count INTEGER DEFAULT 0,
    hints INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    wrong_count INTEGER DEFAULT 0,
    duration_sec INTEGER DEFAULT 0,
    lang TEXT DEFAULT 'fa',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Scheduled exams: combine virtual-patient cases and/or flashcards,
  -- assigned to specific students, available only within a time window.
  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title_fa TEXT, title_en TEXT,
    desc_fa TEXT, desc_en TEXT,
    case_ids TEXT DEFAULT '[]',        -- JSON array of virtual-patient case ids
    flashcard_ids TEXT DEFAULT '[]',   -- JSON array of flashcard ids (empty = all)
    use_flashcards INTEGER DEFAULT 0,  -- include the flashcard module
    starts_at TEXT,                    -- ISO datetime (local) window start
    ends_at TEXT,                      -- ISO datetime window end
    duration_min INTEGER DEFAULT 30,
    max_attempts INTEGER DEFAULT 1,
    lang TEXT DEFAULT 'both',
    shuffle INTEGER DEFAULT 0,        -- randomize question order per student
    anti_cheat INTEGER DEFAULT 1,     -- tab-switch detection + no copy/paste
    competition INTEGER DEFAULT 0,    -- show ranked leaderboard at the end
    show_correct INTEGER DEFAULT 1,
    show_hints INTEGER DEFAULT 1,
    show_ai INTEGER DEFAULT 1,
    show_micro INTEGER DEFAULT 1,
    owner_id INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS exam_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    UNIQUE(exam_id, user_id)
  );

  /* =====================================================================
     GAMIFIED PRE-INTERNSHIP TRACK (Duolingo-style, role = 'learner')
     ===================================================================== */

  -- One profile row per learner: XP wallet, streak, hearts (energy), tier, premium
  CREATE TABLE IF NOT EXISTS learner_profiles (
    user_id INTEGER PRIMARY KEY,
    xp INTEGER NOT NULL DEFAULT 0,
    weekly_xp INTEGER NOT NULL DEFAULT 0,
    week_key TEXT,                       -- ISO week the weekly_xp belongs to
    streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    last_active TEXT,                    -- YYYY-MM-DD (Tehran) of last lesson
    freezes INTEGER NOT NULL DEFAULT 0, -- streak-freeze insurance count
    hearts INTEGER NOT NULL DEFAULT 5,  -- energy; wrong answer costs one
    hearts_updated TEXT,                -- ISO ts of last heart refill tick
    tier TEXT NOT NULL DEFAULT 'bronze',
    gems INTEGER NOT NULL DEFAULT 0,    -- soft currency
    premium INTEGER NOT NULL DEFAULT 0, -- 1 = MED School Plus (unlimited hearts, no ads)
    premium_until TEXT,
    province TEXT,                       -- for country/province ranking
    daily_goal INTEGER NOT NULL DEFAULT 30,  -- XP goal per day
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Append-only log of XP earned (for trends / audit)
  CREATE TABLE IF NOT EXISTS xp_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT,                         -- lesson, streak_bonus, achievement, ...
    node_id INTEGER,
    day TEXT,                            -- YYYY-MM-DD (Tehran)
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Pre-internship subjects (with question budget from the national exam)
  CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE,
    name_fa TEXT, name_en TEXT,
    parent TEXT,                         -- e.g. 'internal' groups its sub-specialties
    budget INTEGER DEFAULT 0,           -- number of questions in the real exam
    color TEXT DEFAULT '#2f7fd1',
    icon TEXT DEFAULT 'flask',
    ord INTEGER DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  -- Learning-path nodes (a lesson = a node on the map, ordered within a topic)
  CREATE TABLE IF NOT EXISTS path_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER NOT NULL,
    title_fa TEXT, title_en TEXT,
    ord INTEGER DEFAULT 0,
    kind TEXT DEFAULT 'lesson',          -- lesson | checkpoint | boss
    card_ids TEXT DEFAULT '[]',          -- JSON array of flashcard ids used in this lesson
    subtitle_fa TEXT DEFAULT '',          -- explicit list of concepts the stage tests
    subtitle_en TEXT DEFAULT '',
    curated INTEGER NOT NULL DEFAULT 0,   -- 1 = maintained by the automatic bank curator
    premium INTEGER NOT NULL DEFAULT 0,   -- 1 = locked «تمرین بیشتر» node (premium learners only)
    xp_reward INTEGER DEFAULT 20,
    active INTEGER NOT NULL DEFAULT 1
  );

  -- Per-learner progress on each node (crown levels 0..5 like Duolingo)
  CREATE TABLE IF NOT EXISTS node_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    node_id INTEGER NOT NULL,
    stars INTEGER NOT NULL DEFAULT 0,   -- best crowns earned (0..5)
    attempts INTEGER NOT NULL DEFAULT 0,
    last_score INTEGER DEFAULT 0,
    completed_at TEXT,
    UNIQUE(user_id, node_id)
  );

  -- Weekly competitive leagues (~30 learners per room, promotion/relegation)
  CREATE TABLE IF NOT EXISTS leagues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_key TEXT NOT NULL,              -- e.g. 2026-W27
    tier TEXT NOT NULL,                 -- bronze..diamond
    room INTEGER NOT NULL DEFAULT 1,    -- room number within the tier
    UNIQUE(week_key, tier, room)
  );
  CREATE TABLE IF NOT EXISTS league_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    UNIQUE(league_id, user_id)
  );

  -- Achievement catalog + per-user unlock state
  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE,
    name_fa TEXT, name_en TEXT,
    desc_fa TEXT, desc_en TEXT,
    icon TEXT DEFAULT 'medal',
    metric TEXT,                         -- streak | xp | nodes | perfect | league
    threshold INTEGER DEFAULT 1,
    ord INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_id INTEGER NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    unlocked_at TEXT,
    UNIQUE(user_id, achievement_id)
  );

  -- Daily quests: per-user, per-day set of small goals (Duolingo-style).
  CREATE TABLE IF NOT EXISTS user_quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    day TEXT NOT NULL,                    -- YYYY-MM-DD (Tehran)
    slug TEXT NOT NULL,                   -- xp | lessons | perfect | review | earlybird
    goal INTEGER NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    reward_gems INTEGER NOT NULL DEFAULT 0,
    claimed INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, day, slug)
  );

  -- Timed daily chests (Early Bird / Night Owl) — time-pressure retention.
  CREATE TABLE IF NOT EXISTS daily_chests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    slug TEXT NOT NULL,                   -- earlybird | nightowl
    opened_at TEXT,
    reward_gems INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, day, slug)
  );

  -- Streak day log (for the calendar + repair logic).
  CREATE TABLE IF NOT EXISTS streak_days (
    user_id INTEGER NOT NULL,
    day TEXT NOT NULL,                    -- YYYY-MM-DD active
    UNIQUE(user_id, day)
  );

  -- Per-card answer log (Duolingo-style granular telemetry): each answer with
  -- correctness and response time feeds analytics, weak-spot detection and the
  -- crowd difficulty model.
  CREATE TABLE IF NOT EXISTS card_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    card_id INTEGER NOT NULL,
    node_id INTEGER,                      -- lesson/topic grouping
    correct INTEGER NOT NULL DEFAULT 0,
    response_ms INTEGER DEFAULT 0,        -- time to answer (confidence proxy)
    day TEXT,                             -- YYYY-MM-DD (Tehran)
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Aggregated crowd difficulty per card (Birdbrain-style, computed from real
  -- user error rates rather than a fixed label).
  CREATE TABLE IF NOT EXISTS question_stats (
    card_id INTEGER PRIMARY KEY,
    seen INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    total_ms INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Personal notes + highlights the learner attaches to a card.
  CREATE TABLE IF NOT EXISTS user_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    card_id INTEGER NOT NULL,
    note TEXT DEFAULT '',
    highlight INTEGER NOT NULL DEFAULT 0, -- 1 = flagged/bookmarked
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, card_id)
  );

  -- Payment transactions (Zarinpal + mock gateway) for premium subscriptions.
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan TEXT NOT NULL,                   -- monthly | yearly | course:<id>
    amount INTEGER NOT NULL,              -- in Rial
    authority TEXT,                       -- gateway authority token
    ref_id TEXT,                          -- gateway reference (on success)
    status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed | canceled
    gateway TEXT NOT NULL DEFAULT 'mock', -- mock | zarinpal
    created_at TEXT DEFAULT (datetime('now')),
    paid_at TEXT
  );

  -- ===== Course store (sell video courses) =====
  -- A course = a sellable product with chapters of video lessons.
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title_fa TEXT, title_en TEXT,
    desc_fa TEXT, desc_en TEXT,
    cover TEXT,                           -- cover image url
    price INTEGER NOT NULL DEFAULT 0,     -- in Rial (0 = free)
    discount_price INTEGER,              -- optional sale price (Rial)
    instructor_fa TEXT, instructor_en TEXT,
    level TEXT DEFAULT 'all',            -- all | basic | pre-internship | residency
    published INTEGER NOT NULL DEFAULT 0, -- draft until published
    ord INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  -- A lesson (video) inside a course. free_preview=1 shows to everyone.
  CREATE TABLE IF NOT EXISTS course_lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    title_fa TEXT, title_en TEXT,
    video_url TEXT,                       -- uploaded file url or external link
    duration TEXT,                        -- e.g. "12:30"
    free_preview INTEGER NOT NULL DEFAULT 0, -- 1 = watchable before buying
    ord INTEGER DEFAULT 0
  );
  -- Which users own which courses (enrollment after purchase / free).
  CREATE TABLE IF NOT EXISTS course_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, course_id)
  );

  -- Ad slots (simulated monetization; admin-managed)
  CREATE TABLE IF NOT EXISTS ads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot TEXT NOT NULL,                  -- home | path | lesson-intro | between-lessons | sidebar
    node_id INTEGER,                     -- optional: target a single lesson (path_nodes.id); NULL = applies to all
    title_fa TEXT, title_en TEXT,
    body_fa TEXT, body_en TEXT,
    image TEXT,
    cta_fa TEXT, cta_en TEXT,
    url TEXT,
    bg TEXT DEFAULT '#2f7fd1',
    active INTEGER NOT NULL DEFAULT 1,
    impressions INTEGER NOT NULL DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- In-app notifications (bell icon feed) for learners
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    kind TEXT NOT NULL,                  -- streak | league | achievement | challenge | system
    title_fa TEXT, title_en TEXT,
    body_fa TEXT, body_en TEXT,
    icon TEXT DEFAULT 'clock',
    link TEXT,                           -- optional in-app tab to open
    seen INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Web Push subscriptions (browser push, one row per device/endpoint)
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT, auth TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- 1v1 asynchronous challenges (Duolingo-style match): same question set, compared scores
  CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,                    -- shareable join code
    topic_id INTEGER,
    card_ids TEXT DEFAULT '[]',          -- fixed question set both players face
    creator_id INTEGER NOT NULL,
    opponent_id INTEGER,
    status TEXT NOT NULL DEFAULT 'open', -- open | active | finished
    xp_stake INTEGER DEFAULT 20,
    winner_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS challenge_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    correct INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    time_ms INTEGER DEFAULT 0,
    finished_at TEXT,
    UNIQUE(challenge_id, user_id)
  );

  -- Spaced-repetition state (SM-2-lite) per learner per card
  CREATE TABLE IF NOT EXISTS srs_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    card_id INTEGER NOT NULL,
    ease REAL NOT NULL DEFAULT 2.5,      -- easiness factor
    interval_days INTEGER NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,     -- consecutive correct reviews
    lapses INTEGER NOT NULL DEFAULT 0,
    due TEXT,                            -- YYYY-MM-DD (Tehran) next review date
    last_reviewed TEXT,
    UNIQUE(user_id, card_id)
  );

  -- Learner-authored personal flashcards (with hints) made in the learn phase
  CREATE TABLE IF NOT EXISTS learner_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    flashcard_id INTEGER NOT NULL,       -- points to a row in flashcards
    topic_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Exam simulator sessions (timed, exam-like blocks). Powers pass-probability.
  CREATE TABLE IF NOT EXISTS exam_sims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    card_ids TEXT NOT NULL,              -- JSON array of flashcard ids in this sim
    n INTEGER NOT NULL,                  -- number of questions
    duration_s INTEGER NOT NULL,        -- allotted time in seconds
    topic_scope TEXT,                    -- 'all' or a comma list of topic slugs
    status TEXT NOT NULL DEFAULT 'active', -- active | finished
    correct INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    time_ms INTEGER DEFAULT 0,
    pass_prob INTEGER,                   -- 0-100 estimated probability of passing
    started_at TEXT DEFAULT (datetime('now')),
    finished_at TEXT
  );

  -- AI-assisted study plans (mostly deterministic; AI only writes a short note)
  CREATE TABLE IF NOT EXISTS study_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    exam_date TEXT,                      -- YYYY-MM-DD target exam date
    minutes_per_day INTEGER DEFAULT 60,
    plan_json TEXT,                      -- the generated day-by-day plan
    ai_note_fa TEXT, ai_note_en TEXT,   -- optional motivational note (AI or template)
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id)
  );

  -- Community decks: learner-shared cards (AnkiHub-style), moderated & votable.
  CREATE TABLE IF NOT EXISTS community_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flashcard_id INTEGER NOT NULL,       -- the shared flashcards row
    author_id INTEGER NOT NULL,
    topic_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
    score INTEGER NOT NULL DEFAULT 0,     -- cached net votes (up - down)
    imports INTEGER NOT NULL DEFAULT 0,   -- how many learners added it to their SRS
    created_at TEXT DEFAULT (datetime('now')),
    reviewed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS community_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    value INTEGER NOT NULL,               -- +1 or -1
    UNIQUE(community_id, user_id)
  );
  -- track which community cards a learner imported into their own SRS
  CREATE TABLE IF NOT EXISTS community_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    flashcard_id INTEGER NOT NULL,
    UNIQUE(community_id, user_id)
  );

  -- Immutable audit log of every admin write action (actor, action, resource, before/after)
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER,
    actor_name TEXT,
    action TEXT NOT NULL,                -- e.g. user.update, flashcard.delete, settings.change
    resource TEXT,                       -- e.g. users:12
    detail TEXT,                         -- JSON before/after or notes
    ip TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Global feature flags (toggle platform features on/off)
  CREATE TABLE IF NOT EXISTS feature_flags (
    key TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    label_fa TEXT, label_en TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Universities (institutions). Teachers & students belong to a university.
  CREATE TABLE IF NOT EXISTS universities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_fa TEXT, name_en TEXT,
    city_fa TEXT, city_en TEXT,
    code TEXT UNIQUE,
    active INTEGER NOT NULL DEFAULT 1,
    -- Per-university licensing / sales (B2B). All nullable limits = unlimited.
    limits_enabled INTEGER NOT NULL DEFAULT 0,  -- enforce max_* caps when 1
    max_students INTEGER,                       -- cap on students of this university
    max_vp_msgs_month INTEGER,                  -- cap on virtual-patient chat messages per month
    max_vp_tokens_month INTEGER,                -- cap on (estimated) VP AI tokens per month
    license_plan TEXT NOT NULL DEFAULT 'standard',  -- trial | standard | enterprise
    license_expires_at TEXT,                    -- ISO date / freeform expiry
    sales_method TEXT,                          -- سازمانی | معرف | فاکتور رسمی | آزمایشی...
    -- Per-university feature flags (NULL = inherit the global default)
    flash_no_penalty INTEGER,                   -- no-penalty flashcards (h / wrong-stage free)
    live_board_speed INTEGER,                   -- leaderboard tie-break by less time
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Monthly usage counters per university (enforcement + admin meters).
  CREATE TABLE IF NOT EXISTS university_usage (
    university_id INTEGER NOT NULL,
    period TEXT NOT NULL,                       -- "YYYY-MM" (UTC monthly bucket)
    vp_msgs INTEGER NOT NULL DEFAULT 0,
    vp_tokens INTEGER NOT NULL DEFAULT 0,
    vp_sessions INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (university_id, period)
  );

  -- Pending email-verification tokens (learner email signup)
  CREATE TABLE IF NOT EXISTS email_verifications (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  /* =====================================================================
     NEW DUOLINGO-2026 GAMIFICATION & AD MECHANICS
     ===================================================================== */

  -- Streak Wager: learner stakes gems to commit to N more streak days; on
  -- success the stake is returned multiplied. One active wager per learner.
  CREATE TABLE IF NOT EXISTS streak_wagers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    start_day TEXT NOT NULL,             -- YYYY-MM-DD when placed
    start_streak INTEGER NOT NULL,       -- streak count when placed
    target_days INTEGER NOT NULL,        -- extra days to reach (e.g. 7)
    stake INTEGER NOT NULL,              -- gems staked
    reward INTEGER NOT NULL,             -- gems paid out on success
    status TEXT NOT NULL DEFAULT 'active', -- active | won | lost
    settled_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Monthly quest progress: complete N daily quests in a calendar month to earn
  -- a collectible badge. One row per learner per month.
  CREATE TABLE IF NOT EXISTS monthly_quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    month TEXT NOT NULL,                 -- YYYY-MM (Tehran)
    progress INTEGER NOT NULL DEFAULT 0, -- daily quests completed this month
    goal INTEGER NOT NULL DEFAULT 30,
    badge_slug TEXT,                     -- collectible badge id for this month
    claimed INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, month)
  );

  -- Collectible badges the learner has earned (monthly quest, events, etc.)
  CREATE TABLE IF NOT EXISTS user_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    badge_slug TEXT NOT NULL,            -- e.g. month:2026-07 | event:ramp-xp
    label_fa TEXT, label_en TEXT,
    icon TEXT DEFAULT 'medal',
    earned_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, badge_slug)
  );

  -- Per-learner participation in a timed XP Ramp-Up challenge event session.
  CREATE TABLE IF NOT EXISTS event_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_slug TEXT NOT NULL,            -- which event definition (from settings)
    card_ids TEXT NOT NULL,              -- JSON array of flashcard ids in this run
    duration_s INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active | finished
    correct INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    started_at TEXT DEFAULT (datetime('now')),
    finished_at TEXT
  );

  -- Rewarded-ad view log: opt-in ad views that granted gems/hearts. Used to cap
  -- daily reward claims per learner and to report ad revenue to admins.
  CREATE TABLE IF NOT EXISTS ad_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ad_id INTEGER,
    format TEXT NOT NULL,                -- rewarded | interstitial | prelesson
    day TEXT NOT NULL,                   -- YYYY-MM-DD (Tehran)
    reward_kind TEXT,                    -- gems | hearts | energy | none
    reward_amount INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  /* =====================================================================
     FRIEND / SOCIAL SYSTEM (Duolingo-style: follow, friend streak,
     friend quest, activity feed with high-fives, nudges)
     ===================================================================== */

  -- Directed follow graph. A "friend" (for streaks/quests) = mutual follow.
  CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER NOT NULL,
    followee_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(follower_id, followee_id)
  );

  -- Pairwise friend streak: consecutive days BOTH friends did a lesson.
  -- user_lo < user_hi keeps one canonical row per pair.
  CREATE TABLE IF NOT EXISTS friend_streaks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_lo INTEGER NOT NULL,
    user_hi INTEGER NOT NULL,
    streak INTEGER NOT NULL DEFAULT 0,
    best INTEGER NOT NULL DEFAULT 0,
    lo_day TEXT,                          -- last day user_lo was active
    hi_day TEXT,                          -- last day user_hi was active
    last_day TEXT,                        -- last day the shared streak advanced
    UNIQUE(user_lo, user_hi)
  );

  -- Weekly friend quest: two friends share an XP goal within a time window.
  CREATE TABLE IF NOT EXISTS friend_quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_key TEXT NOT NULL,
    a_id INTEGER NOT NULL,               -- initiator
    b_id INTEGER NOT NULL,               -- partner
    goal INTEGER NOT NULL,               -- shared XP goal
    a_xp INTEGER NOT NULL DEFAULT 0,
    b_xp INTEGER NOT NULL DEFAULT 0,
    reward_gems INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active', -- active | complete | claimed
    a_claimed INTEGER NOT NULL DEFAULT 0,
    b_claimed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(week_key, a_id, b_id)
  );

  -- Activity feed: milestone events friends can high-five.
  CREATE TABLE IF NOT EXISTS feed_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,            -- who the event is about
    kind TEXT NOT NULL,                  -- streak | perfect_day | league | badge | join
    title_fa TEXT, title_en TEXT,
    icon TEXT DEFAULT 'medal',
    day TEXT,                            -- YYYY-MM-DD (Tehran)
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS feed_highfives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,            -- who gave the high-five
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(event_id, user_id)
  );

  /* =====================================================================
     ELITE PROGRESSION: Legendary levels + Diamond Tournament
     ===================================================================== */

  -- Record of Diamond-Tournament champions (finals top finishers) for the
  -- profile badge + leaderboard icon.
  CREATE TABLE IF NOT EXISTS tournament_champions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    week_key TEXT NOT NULL,
    rank INTEGER NOT NULL,               -- final placement (1..3 = podium)
    gems INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, week_key)
  );

  /* =====================================================================
     SUPPORT / FEEDBACK — in-app chat between any user and the admin team.
     A ticket is one conversation thread; messages are its chat bubbles.
     ===================================================================== */
  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL DEFAULT 'question', -- question | bug | feedback | account
    subject TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',   -- open | answered | resolved
    user_unread INTEGER NOT NULL DEFAULT 0, -- admin replies the user hasn't seen
    admin_unread INTEGER NOT NULL DEFAULT 1, -- messages the admin team hasn't seen
    last_message_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    sender TEXT NOT NULL,                  -- user | admin
    sender_id INTEGER,                     -- who wrote it
    sender_name TEXT,                      -- cached display name (admin agent)
    body TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  /* =====================================================================
     HELP CENTER — admin-editable FAQ / knowledge-base articles, shown
     in-app (searchable) to deflect support tickets before they're created.
     ===================================================================== */
  CREATE TABLE IF NOT EXISTS help_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL DEFAULT 'general', -- general | account | learning | billing | technical
    title_fa TEXT, title_en TEXT,
    body_fa TEXT, body_en TEXT,
    ord INTEGER DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    views INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Landing-page social proof: real, admin-managed testimonials shown to
  -- logged-out visitors. Photos are optional (avatar falls back to initials).
  CREATE TABLE IF NOT EXISTS testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_fa TEXT, name_en TEXT,      -- author display name
    role_fa TEXT, role_en TEXT,      -- author role / title (e.g. "Pre-int candidate")
    quote_fa TEXT, quote_en TEXT,    -- the testimonial text
    photo TEXT,                      -- optional uploaded photo path (else initials avatar)
    rating INTEGER NOT NULL DEFAULT 5, -- 1..5 stars
    featured INTEGER NOT NULL DEFAULT 0, -- pin to front
    ord INTEGER DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Landing-page FAQ (objection-handling), separate from the in-app help center
  -- so marketing copy can differ. Public read, admin write.
  CREATE TABLE IF NOT EXISTS landing_faqs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    q_fa TEXT, q_en TEXT,
    a_fa TEXT, a_en TEXT,
    ord INTEGER DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Landing-page trust badges (e.g. "No card required", "Bilingual", "PWA").
  -- Small icon + short label, admin-managed, shown near the CTA.
  CREATE TABLE IF NOT EXISTS trust_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    icon TEXT NOT NULL DEFAULT 'check', -- Icon.jsx name
    label_fa TEXT, label_en TEXT,
    ord INTEGER DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- FSRS review log: one row per graded spaced-repetition review. This is the
  -- raw training data the FSRS optimizer fits parameters against (each card's
  -- ordered sequence of {grade, elapsed_days} reconstructs its memory trace).
  -- grade is FSRS 1..4 (Again/Hard/Good/Easy); elapsed_days is days since the
  -- card's previous review (0 for the first/same-day review).
  CREATE TABLE IF NOT EXISTS srs_review_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    card_id INTEGER NOT NULL,
    grade INTEGER NOT NULL,           -- 1..4
    elapsed_days INTEGER NOT NULL DEFAULT 0,
    day TEXT,                         -- YYYY-MM-DD (Tehran)
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- ===== Group purchase (volume discount) =====
  -- Each buyer purchases a PACK of seats at a discounted per-seat price and
  -- gets one redemption CODE per seat. Everyone stays on their OWN independent
  -- account; redeeming a code just grants that redeemer their own premium time.
  -- (No shared accounts — data never gets mixed.)
  CREATE TABLE IF NOT EXISTS group_packs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title_fa TEXT, title_en TEXT,
    seats INTEGER NOT NULL DEFAULT 3,     -- how many independent accounts this pack covers
    days INTEGER NOT NULL DEFAULT 30,     -- premium days each redeemed seat grants
    price INTEGER NOT NULL DEFAULT 0,     -- TOTAL pack price in Rial (already discounted)
    ord INTEGER DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
  -- A completed (or pending) bulk purchase of one pack by a buyer.
  CREATE TABLE IF NOT EXISTS group_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_id INTEGER NOT NULL,
    pack_id INTEGER,
    seats INTEGER NOT NULL,
    days INTEGER NOT NULL,
    amount INTEGER NOT NULL,              -- Rial paid
    status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | canceled
    transaction_id INTEGER,              -- links to transactions.id
    created_at TEXT DEFAULT (datetime('now')),
    paid_at TEXT
  );
  -- One redemption code per seat. The buyer distributes these to friends; each
  -- friend redeems on their own account to activate their own premium.
  CREATE TABLE IF NOT EXISTS seat_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    code TEXT NOT NULL UNIQUE,
    days INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active | redeemed
    redeemed_by INTEGER,                 -- user_id who used it (their own account)
    redeemed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- ===== Daily Diagnosis Challenge (original, Wordle-style clinical reasoning) =====
  -- Admin-authored cases. The player reads an opening vignette, guesses the
  -- diagnosis, and each wrong guess reveals the NEXT clue (labs, exam, history,
  -- imaging). Fewer guesses = better score. All content is written by the admin;
  -- nothing is copied from any third-party game.
  CREATE TABLE IF NOT EXISTS dx_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_fa TEXT, category_en TEXT,           -- e.g. Cardiology / قلب
    vignette_fa TEXT, vignette_en TEXT,           -- opening one-liner (age, chief complaint)
    clues_json TEXT NOT NULL DEFAULT '[]',        -- [{fa,en}] progressive clues, revealed one per wrong guess
    answer_fa TEXT, answer_en TEXT,               -- the correct diagnosis (display)
    aliases_json TEXT NOT NULL DEFAULT '[]',      -- accepted spellings/synonyms (both langs)
    options_json TEXT NOT NULL DEFAULT '[]',      -- [{fa,en}] the picklist the player chooses from (incl. the answer)
    explanation_fa TEXT, explanation_en TEXT,     -- shown after the case (the "why")
    difficulty TEXT NOT NULL DEFAULT 'medium',
    max_guesses INTEGER NOT NULL DEFAULT 6,
    scheduled_day TEXT,                            -- optional YYYY-MM-DD to pin as that day's case
    active INTEGER NOT NULL DEFAULT 1,
    ord INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  -- One row per user per case: their guesses, whether solved, and how many tries.
  CREATE TABLE IF NOT EXISTS dx_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    case_id INTEGER NOT NULL,
    day TEXT,                                      -- YYYY-MM-DD (Tehran) the daily case belongs to
    guesses_json TEXT NOT NULL DEFAULT '[]',       -- [{text, correct}] ordered guesses
    revealed INTEGER NOT NULL DEFAULT 1,           -- how many clues are shown (starts at 1 = vignette)
    solved INTEGER NOT NULL DEFAULT 0,
    finished INTEGER NOT NULL DEFAULT 0,           -- solved OR out of guesses
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, case_id)
  );

  -- ===== Referral (invite-a-friend) program =====
  -- Each learner has a personal invite code (stored on learner_profiles.referral_code).
  -- A referral row records: who invited whom, the current status, and whether
  -- the double-sided rewards were paid. Milestone rewards (invite N friends) are
  -- tracked via learner_profiles.referral_count + a claimed-milestones list.
  CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL,      -- the inviter
    referred_id INTEGER NOT NULL,      -- the new user who signed up with the code
    code TEXT,                         -- the code used
    status TEXT NOT NULL DEFAULT 'pending', -- pending (signed up) | qualified (did first lesson) 
    referrer_rewarded INTEGER NOT NULL DEFAULT 0,
    referred_rewarded INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    qualified_at TEXT,
    UNIQUE(referred_id)                -- a user can only be referred once
  );
  -- Log of social-share actions (for the optional "share to earn" reward + admin analytics).
  CREATE TABLE IF NOT EXISTS share_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    kind TEXT NOT NULL,                -- streak | dx | achievement | invite | ...
    channel TEXT,                      -- instagram | telegram | whatsapp | copy | ...
    day TEXT,                          -- YYYY-MM-DD (Tehran)
    rewarded INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pwa_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,                   -- may be null (logged-out visitor)
    event TEXT NOT NULL,               -- prompt_shown | accepted | dismissed | installed | launch
    platform TEXT,                     -- android | ios | desktop | other
    standalone INTEGER NOT NULL DEFAULT 0, -- 1 if running as installed app
    day TEXT,                          -- YYYY-MM-DD (Tehran)
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Real-user performance monitoring (Core Web Vitals + navigation timing).
  -- Public endpoint writes here; admin analytics reads aggregates from it.
  CREATE TABLE IF NOT EXISTS rum_vitals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    session_id TEXT,
    metric TEXT NOT NULL,              -- LCP | CLS | INP | TTFB | FCP | app
    value REAL NOT NULL,
    rating TEXT,                       -- good | needs-improvement | poor
    delta REAL,
    path TEXT,
    page TEXT,
    navigation_type TEXT,
    device TEXT,
    connection TEXT,
    server_timing TEXT,
    payload_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_rum_metric_created ON rum_vitals(metric, created_at);
  CREATE INDEX IF NOT EXISTS idx_rum_path_created ON rum_vitals(path, created_at);

  -- Security-relevant response log (401/403/429/5xx) for early warning and audit.
  CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    kind TEXT NOT NULL,                -- unauthorized | forbidden | rate_limited | server_error
    status INTEGER,
    method TEXT,
    path TEXT,
    ip TEXT,
    user_agent TEXT,
    detail TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_security_kind_created ON security_events(kind, created_at);
  CREATE INDEX IF NOT EXISTS idx_security_path_created ON security_events(path, created_at);

  CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial TEXT UNIQUE NOT NULL,        -- public verification code, e.g. MED-2026-AB12CD
    user_id INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'program', -- program | course
    ref_id INTEGER,                     -- course id (for kind=course) or program key hash
    program_key TEXT,                   -- active program key snapshot (for kind=program)
    recipient_name TEXT,                -- learner display name at issue time (snapshot)
    title_fa TEXT, title_en TEXT,       -- course/program title snapshot
    hours TEXT,                         -- optional "X hours of study" text
    grade TEXT,                         -- optional grade/level
    signer_name TEXT,                   -- signer (e.g. academic head) snapshot
    signer_title_fa TEXT, signer_title_en TEXT,
    issued_at TEXT DEFAULT (datetime('now')),
    revoked INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, kind, ref_id, program_key)
  );

  CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,          -- URL-safe id (e.g. "stemi-diagnosis")
    category TEXT NOT NULL DEFAULT 'general',
    title_fa TEXT, title_en TEXT,
    excerpt_fa TEXT, excerpt_en TEXT,  -- short summary (list + meta description)
    body_fa TEXT, body_en TEXT,        -- markdown body
    cover TEXT,                         -- cover image URL (optional)
    meta_title_fa TEXT, meta_title_en TEXT,   -- SEO <title> override (blank = use title)
    meta_desc_fa TEXT, meta_desc_en TEXT,     -- SEO meta description (blank = use excerpt)
    canonical TEXT,                     -- canonical URL override (optional)
    scheduled_at TEXT,                  -- if set + not published, auto-publishes at this time
    tags TEXT,                          -- comma-separated tags
    author_name TEXT,                   -- E-E-A-T: named author
    author_credentials TEXT,            -- e.g. "MD, cardiology"
    reviewed INTEGER NOT NULL DEFAULT 0,-- "medically reviewed" trust badge
    published INTEGER NOT NULL DEFAULT 0,
    featured INTEGER NOT NULL DEFAULT 0,
    views INTEGER NOT NULL DEFAULT 0,
    ord INTEGER DEFAULT 0,
    published_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Blog post revisions: a snapshot of the post is saved BEFORE every edit so
  -- an admin can review the edit history and restore an earlier version.
  CREATE TABLE IF NOT EXISTS blog_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    data_json TEXT NOT NULL,             -- full snapshot of the post row
    editor TEXT,                         -- username who triggered the edit
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_blog_rev_post ON blog_revisions(post_id, id DESC);

  -- Placement "unlock": when a learner tests STRONG on a topic and the admin's
  -- skip_behavior is "unlock", we record it here. The learning path then treats
  -- that topic's lessons as unlocked (no fake stars) so the learner can jump in.
  CREATE TABLE IF NOT EXISTS placement_unlocks (
    user_id INTEGER NOT NULL,
    topic_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, topic_id)
  );

  -- Section Checkpoint exams (shelf-exam style): a cumulative test that MIXES
  -- questions drawn from every completed lesson across a whole section (the
  -- topic 'parent' group, e.g. all Internal-Medicine topics). Each attempt is
  -- recorded so we can show best score, gate a cooldown and drive analytics.
  CREATE TABLE IF NOT EXISTS checkpoint_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    program TEXT NOT NULL,               -- program key snapshot (preint | basic)
    section TEXT NOT NULL,               -- topic parent group (internal | major | ...)
    total INTEGER NOT NULL DEFAULT 0,    -- questions asked
    correct INTEGER NOT NULL DEFAULT 0,  -- questions answered correctly
    score INTEGER NOT NULL DEFAULT 0,    -- percentage 0..100 (scaled, shelf-style)
    passed INTEGER NOT NULL DEFAULT 0,   -- 1 if score >= pass threshold
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  `);

  // --- lightweight migrations for pre-existing databases ---
  const ucols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!ucols.includes("student_no")) db.exec("ALTER TABLE users ADD COLUMN student_no TEXT");
  if (!ucols.includes("email")) db.exec("ALTER TABLE users ADD COLUMN email TEXT");
  if (!ucols.includes("email_verified")) db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0");
  if (!ucols.includes("google_id")) db.exec("ALTER TABLE users ADD COLUMN google_id TEXT");
  if (!ucols.includes("avatar")) db.exec("ALTER TABLE users ADD COLUMN avatar TEXT");
  if (!ucols.includes("university_id")) db.exec("ALTER TABLE users ADD COLUMN university_id INTEGER");
  // Defense-in-depth for duplicate student numbers. We only add the unique
  // partial index when the existing database is clean, so old production data
  // with accidental duplicates never prevents the app from booting. App-level
  // duplicate prevention still blocks all new duplicates either way.
  try {
    const dupStudentNo = db.prepare("SELECT student_no FROM users WHERE student_no IS NOT NULL AND student_no<>'' GROUP BY student_no HAVING COUNT(*)>1 LIMIT 1").get();
    if (!dupStudentNo) db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_student_no_unique ON users(student_no) WHERE student_no IS NOT NULL AND student_no<>''");
  } catch { /* best-effort duplicate hardening */ }
  // Every university-side teacher/student must belong to a university. For legacy/demo
  // data, create one default institution and attach unscoped teachers/students.
  db.exec("INSERT OR IGNORE INTO universities (id,name_fa,name_en,city_fa,city_en,code,active) VALUES (1,'دانشگاه پیش‌فرض','Default University','','','DEFAULT',1)");
  db.exec("UPDATE users SET university_id=1 WHERE role IN ('teacher','student') AND university_id IS NULL");
  // Optional profile fields (self- or admin-editable) + identity display prefs.
  if (!ucols.includes("phone")) db.exec("ALTER TABLE users ADD COLUMN phone TEXT");
  if (!ucols.includes("bio")) db.exec("ALTER TABLE users ADD COLUMN bio TEXT");
  if (!ucols.includes("nickname")) db.exec("ALTER TABLE users ADD COLUMN nickname TEXT");
  // 0 = show real name (default), 1 = show nickname (anonymous in rankings/competition)
  if (!ucols.includes("anon_mode")) db.exec("ALTER TABLE users ADD COLUMN anon_mode INTEGER DEFAULT 0");
  // Bumped on password change / admin reset so stolen JWTs die (OWASP / NIST 2026).
  if (!ucols.includes("token_ver")) {
    db.exec("ALTER TABLE users ADD COLUMN token_ver INTEGER DEFAULT 1");
    try { db.exec("UPDATE users SET token_ver=1 WHERE token_ver IS NULL"); } catch { /* */ }
  }
  // Per-JWT denylist for single-session logout (ASVS 3.3.1).
  db.exec(`CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti TEXT PRIMARY KEY,
    user_id INTEGER,
    exp INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_revoked_tokens_exp ON revoked_tokens(exp)");
  // blog_posts: pro editor fields — dedicated SEO meta, canonical URL, and
  // scheduled publishing (publish automatically at a future date/time).
  const caseTenantCols = db.prepare("PRAGMA table_info(cases)").all().map((c) => c.name);
  if (!caseTenantCols.includes("university_id")) db.exec("ALTER TABLE cases ADD COLUMN university_id INTEGER");
  {
    const orphans = db.prepare("SELECT id, data_json FROM cases WHERE university_id IS NULL").all();
    const up = db.prepare("UPDATE cases SET university_id=1 WHERE id=?");
    for (const row of orphans) {
      let learn = false;
      try { learn = JSON.parse(row.data_json || "{}").track === "learn"; } catch { /* */ }
      if (!learn) up.run(row.id);
    }
  }
  const flashTenantCols = db.prepare("PRAGMA table_info(flashcards)").all().map((c) => c.name);
  if (!flashTenantCols.includes("university_id")) db.exec("ALTER TABLE flashcards ADD COLUMN university_id INTEGER");

  // --- question modification tracking ---------------------------------
  // Admins need to answer "what changed most recently, and in which subject
  // and chapter?". `updated_at` already existed but was never a reliable
  // audit trail: it is set on insert too, so a freshly imported card looked
  // "just edited". These columns separate the three moments that matter —
  // when a card entered the bank, when its content last actually changed,
  // and how many times it has been revised — plus who did it.
  if (!flashTenantCols.includes("created_at")) {
    db.exec("ALTER TABLE flashcards ADD COLUMN created_at TEXT");
    // Backfill: for existing rows the only timestamp we have is updated_at,
    // so treat that as the creation moment rather than leaving a null that
    // would sort unpredictably.
    db.exec("UPDATE flashcards SET created_at = COALESCE(created_at, updated_at, datetime('now'))");
  }
  if (!flashTenantCols.includes("content_updated_at")) {
    db.exec("ALTER TABLE flashcards ADD COLUMN content_updated_at TEXT");
    db.exec("UPDATE flashcards SET content_updated_at = COALESCE(content_updated_at, updated_at)");
  }
  if (!flashTenantCols.includes("revision")) {
    db.exec("ALTER TABLE flashcards ADD COLUMN revision INTEGER NOT NULL DEFAULT 1");
  }
  if (!flashTenantCols.includes("last_editor_id")) db.exec("ALTER TABLE flashcards ADD COLUMN last_editor_id INTEGER");
  if (!flashTenantCols.includes("last_action")) db.exec("ALTER TABLE flashcards ADD COLUMN last_action TEXT DEFAULT 'created'");

  // Per-card change log. Keeps the WHAT (which fields), the WHO and the WHEN
  // so the admin can open any question and read its history, and so the
  // "recently changed" view can be filtered by subject/chapter like any other
  // facet rather than being a separate one-off report.
  db.exec(`
    CREATE TABLE IF NOT EXISTS card_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      action TEXT NOT NULL,               -- created | edited | imported | activated | deactivated | deleted
      fields TEXT DEFAULT '[]',           -- JSON array of changed field names
      actor_id INTEGER,
      actor_name TEXT DEFAULT '',
      subject TEXT DEFAULT '',            -- denormalised so the log filters without a join
      chapter TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_card_revisions_card    ON card_revisions(card_id, revision);
    CREATE INDEX IF NOT EXISTS idx_card_revisions_time    ON card_revisions(created_at);
    CREATE INDEX IF NOT EXISTS idx_card_revisions_subject ON card_revisions(subject, chapter, created_at);
    CREATE INDEX IF NOT EXISTS idx_flashcards_content_upd ON flashcards(content_updated_at);
    CREATE INDEX IF NOT EXISTS idx_flashcards_created     ON flashcards(created_at);
  `);
  {
    // Learn-track cards legitimately keep university_id NULL, so "IS NULL"
    // alone matched all 11k bank cards and pulled ~70 MB of JSON through
    // JSON.parse on EVERY boot (~0.8 s, +200 MB RSS on a shared host). Let
    // SQLite exclude them first; the JSON check stays for the few remaining.
    const orphans = db.prepare("SELECT id, data_json FROM flashcards WHERE university_id IS NULL AND data_json NOT LIKE '%\"track\":\"learn\"%'").all();
    const up = db.prepare("UPDATE flashcards SET university_id=1 WHERE id=?");
    for (const row of orphans) {
      let learn = false;
      try { learn = JSON.parse(row.data_json || "{}").track === "learn"; } catch { /* */ }
      if (!learn) up.run(row.id);
    }
  }
  const bcols = db.prepare("PRAGMA table_info(blog_posts)").all().map((c) => c.name);
  if (!bcols.includes("meta_title_fa")) db.exec("ALTER TABLE blog_posts ADD COLUMN meta_title_fa TEXT");
  if (!bcols.includes("meta_title_en")) db.exec("ALTER TABLE blog_posts ADD COLUMN meta_title_en TEXT");
  if (!bcols.includes("meta_desc_fa")) db.exec("ALTER TABLE blog_posts ADD COLUMN meta_desc_fa TEXT");
  if (!bcols.includes("meta_desc_en")) db.exec("ALTER TABLE blog_posts ADD COLUMN meta_desc_en TEXT");
  if (!bcols.includes("canonical")) db.exec("ALTER TABLE blog_posts ADD COLUMN canonical TEXT");
  if (!bcols.includes("scheduled_at")) db.exec("ALTER TABLE blog_posts ADD COLUMN scheduled_at TEXT");

  // learner_profiles powerup / gamification columns
  // topics + path_nodes emoji (relevant emoji per subject / lesson)
  const tcols = db.prepare("PRAGMA table_info(topics)").all().map((c) => c.name);
  if (!tcols.includes("emoji")) db.exec("ALTER TABLE topics ADD COLUMN emoji TEXT DEFAULT ''");
  const pncols = db.prepare("PRAGMA table_info(path_nodes)").all().map((c) => c.name);
  if (!pncols.includes("emoji")) db.exec("ALTER TABLE path_nodes ADD COLUMN emoji TEXT DEFAULT ''");
  // Curated competitive-path stages carry an explicit subtitle listing the
  // exact concepts tested (learners must know what a stage quizzes), and a
  // marker so the automatic curator can maintain its own nodes without ever
  // touching a teacher-authored lesson.
  if (!pncols.includes("subtitle_fa")) db.exec("ALTER TABLE path_nodes ADD COLUMN subtitle_fa TEXT DEFAULT ''");
  if (!pncols.includes("subtitle_en")) db.exec("ALTER TABLE path_nodes ADD COLUMN subtitle_en TEXT DEFAULT ''");
  if (!pncols.includes("curated")) db.exec("ALTER TABLE path_nodes ADD COLUMN curated INTEGER DEFAULT 0");
  if (!pncols.includes("premium")) db.exec("ALTER TABLE path_nodes ADD COLUMN premium INTEGER DEFAULT 0");
  // Round 8: custom test builder sessions share exam_sims (kind='custom' + JSON config)
  const escols = db.prepare("PRAGMA table_info(exam_sims)").all().map((c) => c.name);
  if (!escols.includes("kind")) db.exec("ALTER TABLE exam_sims ADD COLUMN kind TEXT DEFAULT 'sim'");
  if (!escols.includes("config")) db.exec("ALTER TABLE exam_sims ADD COLUMN config TEXT DEFAULT ''");
  // Round 9 (peer benchmark): which option was picked, and whether a hint was used
  const cacols0 = db.prepare("PRAGMA table_info(card_attempts)").all().map((c) => c.name);
  if (!cacols0.includes("sel")) db.exec("ALTER TABLE card_attempts ADD COLUMN sel INTEGER");
  if (!cacols0.includes("hint_used")) db.exec("ALTER TABLE card_attempts ADD COLUMN hint_used INTEGER DEFAULT 0");
  // per-option pick counters («شناسنامهٔ سؤال» — % of learners choosing each option)
  db.exec(`CREATE TABLE IF NOT EXISTS option_stats (
    card_id INTEGER NOT NULL,
    opt INTEGER NOT NULL,
    n INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (card_id, opt)
  )`);
  // «پرش از واحد» (Duolingo jump-ahead): a passed quiz unlocks the whole topic
  db.exec(`CREATE TABLE IF NOT EXISTS jump_unlocks (
    user_id INTEGER NOT NULL,
    topic_id INTEGER NOT NULL,
    score INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, topic_id)
  )`);
  // card_attempts: per-answer study signals (UWorld-style) — a learner can FLAG
  // a question to revisit, and honestly mark a correct answer as a GUESS so it's
  // reviewed like a miss ("a lucky guess is a miss in disguise").
  const cacols = db.prepare("PRAGMA table_info(card_attempts)").all().map((c) => c.name);
  if (!cacols.includes("flagged")) db.exec("ALTER TABLE card_attempts ADD COLUMN flagged INTEGER DEFAULT 0");
  if (!cacols.includes("guessed")) db.exec("ALTER TABLE card_attempts ADD COLUMN guessed INTEGER DEFAULT 0");
  // Confidence-Based Assessment (medical-ed): before checking, the learner
  // declares how sure they are (1=low, 2=medium, 3=high; 0=not declared). This
  // powers a calibration report ("when you felt sure, how often were you right?")
  // and safer confidence scoring — a core clinical-reasoning skill.
  if (!cacols.includes("confidence")) db.exec("ALTER TABLE card_attempts ADD COLUMN confidence INTEGER DEFAULT 0");
  // Topic Mastery Badges (Bloom's Mastery Learning + durable memory): a one-time
  // record per (learner, topic) so the mastery reward is granted exactly once
  // and the earned badge (with the accuracy snapshot) persists for display.
  db.exec(`CREATE TABLE IF NOT EXISTS mastery_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    topic_id INTEGER NOT NULL,
    accuracy INTEGER DEFAULT 0,          -- accuracy % at the moment mastery was earned
    mature_ratio INTEGER DEFAULT 0,      -- % of the topic's cards that were SRS-mature
    earned_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, topic_id)
  )`);
  // Class flashcards: a teacher can attach flashcard sets to a class alongside
  // virtual-patient cases. `graded=1` = counts toward the class grade (weighted);
  // `graded=0` = practice-only (progress tracked but not graded).
  db.exec(`CREATE TABLE IF NOT EXISTS class_flashcards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    flashcard_id INTEGER NOT NULL,
    weight INTEGER DEFAULT 1,
    graded INTEGER DEFAULT 1,
    UNIQUE(class_id, flashcard_id)
  )`);
  // Per-student result of a class flashcard attempt (score 0..100 + best kept).
  db.exec(`CREATE TABLE IF NOT EXISTS class_flashcard_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    flashcard_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    score INTEGER DEFAULT 0,
    answers_json TEXT DEFAULT '[]',
    duration_sec INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  const cfAttemptCols = db.prepare("PRAGMA table_info(class_flashcard_attempts)").all().map((c) => c.name);
  if (!cfAttemptCols.includes("answers_json")) db.exec("ALTER TABLE class_flashcard_attempts ADD COLUMN answers_json TEXT DEFAULT '[]'");
  if (!cfAttemptCols.includes("duration_sec")) db.exec("ALTER TABLE class_flashcard_attempts ADD COLUMN duration_sec INTEGER DEFAULT 0");
  const liveClassCols = db.prepare("PRAGMA table_info(classes)").all().map((c) => c.name);
  if (!liveClassCols.includes("live_board_enabled")) db.exec("ALTER TABLE classes ADD COLUMN live_board_enabled INTEGER NOT NULL DEFAULT 1");
  if (!liveClassCols.includes("live_board_anonymous")) db.exec("ALTER TABLE classes ADD COLUMN live_board_anonymous INTEGER NOT NULL DEFAULT 0");
  if (!liveClassCols.includes("university_id")) db.exec("ALTER TABLE classes ADD COLUMN university_id INTEGER");
  // Per-class feature overrides (NULL = inherit university → global default):
  //   flash_no_penalty — using hints / wrong stage answers never deduct points
  //   live_board_speed — live-board tie-break by less total time
  if (!liveClassCols.includes("flash_no_penalty")) db.exec("ALTER TABLE classes ADD COLUMN flash_no_penalty INTEGER");
  if (!liveClassCols.includes("live_board_speed")) db.exec("ALTER TABLE classes ADD COLUMN live_board_speed INTEGER");
  // Existing deployments: backfill the university licensing / flag columns.
  const uniColMig = db.prepare("PRAGMA table_info(universities)").all().map((c) => c.name);
  if (!uniColMig.includes("limits_enabled")) db.exec("ALTER TABLE universities ADD COLUMN limits_enabled INTEGER NOT NULL DEFAULT 0");
  if (!uniColMig.includes("max_students")) db.exec("ALTER TABLE universities ADD COLUMN max_students INTEGER");
  if (!uniColMig.includes("max_vp_msgs_month")) db.exec("ALTER TABLE universities ADD COLUMN max_vp_msgs_month INTEGER");
  if (!uniColMig.includes("max_vp_tokens_month")) db.exec("ALTER TABLE universities ADD COLUMN max_vp_tokens_month INTEGER");
  if (!uniColMig.includes("license_plan")) db.exec("ALTER TABLE universities ADD COLUMN license_plan TEXT NOT NULL DEFAULT 'standard'");
  if (!uniColMig.includes("license_expires_at")) db.exec("ALTER TABLE universities ADD COLUMN license_expires_at TEXT");
  if (!uniColMig.includes("sales_method")) db.exec("ALTER TABLE universities ADD COLUMN sales_method TEXT");
  if (!uniColMig.includes("flash_no_penalty")) db.exec("ALTER TABLE universities ADD COLUMN flash_no_penalty INTEGER");
  if (!uniColMig.includes("live_board_speed")) db.exec("ALTER TABLE universities ADD COLUMN live_board_speed INTEGER");
  db.exec(`UPDATE classes SET university_id=(SELECT university_id FROM users WHERE users.id=classes.owner_id)
           WHERE university_id IS NULL AND owner_id IS NOT NULL`);
  db.exec("UPDATE classes SET university_id=1 WHERE university_id IS NULL");
  const examTenantCols = db.prepare("PRAGMA table_info(exams)").all().map((c) => c.name);
  if (!examTenantCols.includes("university_id")) db.exec("ALTER TABLE exams ADD COLUMN university_id INTEGER");
  db.exec(`UPDATE exams SET university_id=(SELECT university_id FROM users WHERE users.id=exams.owner_id)
           WHERE university_id IS NULL AND owner_id IS NOT NULL`);
  db.exec("UPDATE exams SET university_id=1 WHERE university_id IS NULL");
  const checklistCols = db.prepare("PRAGMA table_info(checklists)").all().map((c) => c.name);
  if (!checklistCols.includes("owner_id")) db.exec("ALTER TABLE checklists ADD COLUMN owner_id INTEGER");
  // ads: optional per-lesson targeting (node_id) so admins can attach/disable an ad on individual lessons
  const adcols = db.prepare("PRAGMA table_info(ads)").all().map((c) => c.name);
  if (!adcols.includes("node_id")) db.exec("ALTER TABLE ads ADD COLUMN node_id INTEGER");
  // ads: Duolingo-Ads 2026 formats. `format` = banner | interstitial | rewarded | prelesson.
  //   reward_gems = gems granted to a learner who watches a rewarded/prelesson ad.
  //   skippable_after = seconds before an interstitial can be skipped (Duolingo = 5).
  //   duration_s = simulated video length (the on-screen countdown).
  if (!adcols.includes("format")) db.exec("ALTER TABLE ads ADD COLUMN format TEXT NOT NULL DEFAULT 'banner'");
  if (!adcols.includes("reward_gems")) db.exec("ALTER TABLE ads ADD COLUMN reward_gems INTEGER NOT NULL DEFAULT 0");
  if (!adcols.includes("skippable_after")) db.exec("ALTER TABLE ads ADD COLUMN skippable_after INTEGER NOT NULL DEFAULT 5");
  if (!adcols.includes("duration_s")) db.exec("ALTER TABLE ads ADD COLUMN duration_s INTEGER NOT NULL DEFAULT 15");
  if (!adcols.includes("sponsor")) db.exec("ALTER TABLE ads ADD COLUMN sponsor TEXT DEFAULT ''");
  // --- richer ad management (research-backed): scheduling, frequency capping,
  // rotation weight, and per-audience targeting. All non-destructive. ---
  if (!adcols.includes("weight")) db.exec("ALTER TABLE ads ADD COLUMN weight INTEGER NOT NULL DEFAULT 1");
  if (!adcols.includes("start_at")) db.exec("ALTER TABLE ads ADD COLUMN start_at TEXT");   // ISO; null = always
  if (!adcols.includes("end_at")) db.exec("ALTER TABLE ads ADD COLUMN end_at TEXT");       // ISO; null = never expires
  if (!adcols.includes("daily_cap")) db.exec("ALTER TABLE ads ADD COLUMN daily_cap INTEGER NOT NULL DEFAULT 0"); // 0 = unlimited per user/day
  if (!adcols.includes("audience")) db.exec("ALTER TABLE ads ADD COLUMN audience TEXT NOT NULL DEFAULT 'all'");   // all | free | new
  // Per-user/day impression ledger for frequency capping (kept small; pruned by date).
  db.exec(`CREATE TABLE IF NOT EXISTS ad_impressions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(ad_id, user_id, day)
  );`);
  // Ad request ledger (per day) so we can compute fill rate = served / requested.
  db.exec(`CREATE TABLE IF NOT EXISTS ad_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    slot TEXT,
    count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(day, slot)
  );`);
  // multi-program (Duolingo-style courses): each topic belongs to a program
  // ('preint' = pre-internship & residency, 'basic' = basic sciences). Existing
  // topics default to 'preint'. Learners pick an active program on their profile.
  const topicCols = db.prepare("PRAGMA table_info(topics)").all().map((c) => c.name);
  if (!topicCols.includes("program")) db.exec("ALTER TABLE topics ADD COLUMN program TEXT NOT NULL DEFAULT 'preint'");
  const lpCols2 = db.prepare("PRAGMA table_info(learner_profiles)").all().map((c) => c.name);
  if (!lpCols2.includes("active_program")) db.exec("ALTER TABLE learner_profiles ADD COLUMN active_program TEXT NOT NULL DEFAULT 'preint'");
  // Duolingo-style streak upgrades: perfect streak (no freeze used) + society tier
  if (!lpCols2.includes("perfect_streak")) db.exec("ALTER TABLE learner_profiles ADD COLUMN perfect_streak INTEGER NOT NULL DEFAULT 0");
  if (!lpCols2.includes("society_tier")) db.exec("ALTER TABLE learner_profiles ADD COLUMN society_tier INTEGER NOT NULL DEFAULT 0");
  // mark which streak-calendar days were saved by a freeze (blue-snowflake vs check)
  const sdCols = db.prepare("PRAGMA table_info(streak_days)").all().map((c) => c.name);
  if (!sdCols.includes("frozen")) db.exec("ALTER TABLE streak_days ADD COLUMN frozen INTEGER NOT NULL DEFAULT 0");
  // Legendary levels (crown 6): a mastered node upgraded via a harder timed run.
  // Classroom default grading criterion for the virtual patient: which section
  // score a teacher grades on by default — "history" (extern), "overall"
  // (intern), or "both" (show both, teacher decides). Non-destructive.
  const classCols = db.prepare("PRAGMA table_info(classes)").all().map((c) => c.name);
  if (!classCols.includes("grading_role")) db.exec("ALTER TABLE classes ADD COLUMN grading_role TEXT DEFAULT 'both'");
  // Default history-form type for the class (a label/category — the case's own
  // history_form drives scoring). e.g. internal|obgyn|cardio|peds|psych|general.
  if (!classCols.includes("history_form")) db.exec("ALTER TABLE classes ADD COLUMN history_form TEXT DEFAULT 'general'");
  // Per-class override of the VP grading rubric (which sections count for
  // extern vs intern, and how much each is worth). NULL = inherit settings.vp_grading.
  if (!classCols.includes("grading_json")) db.exec("ALTER TABLE classes ADD COLUMN grading_json TEXT");

  const npCols = db.prepare("PRAGMA table_info(node_progress)").all().map((c) => c.name);
  if (!npCols.includes("legendary")) db.exec("ALTER TABLE node_progress ADD COLUMN legendary INTEGER NOT NULL DEFAULT 0");
  if (!npCols.includes("legendary_at")) db.exec("ALTER TABLE node_progress ADD COLUMN legendary_at TEXT");
  // Elite counters on the profile: legendary levels earned + tournament wins.
  const lpCols3 = db.prepare("PRAGMA table_info(learner_profiles)").all().map((c) => c.name);
  if (!lpCols3.includes("legendary_count")) db.exec("ALTER TABLE learner_profiles ADD COLUMN legendary_count INTEGER NOT NULL DEFAULT 0");
  if (!lpCols3.includes("tournament_wins")) db.exec("ALTER TABLE learner_profiles ADD COLUMN tournament_wins INTEGER NOT NULL DEFAULT 0");
  // onboarding checklist state: whether the learner set a daily goal, dismissed
  // the checklist, and already claimed its completion reward.
  if (!lpCols3.includes("goal_set")) db.exec("ALTER TABLE learner_profiles ADD COLUMN goal_set INTEGER NOT NULL DEFAULT 0");
  if (!lpCols3.includes("onboarding_dismissed")) db.exec("ALTER TABLE learner_profiles ADD COLUMN onboarding_dismissed INTEGER NOT NULL DEFAULT 0");
  if (!lpCols3.includes("onboarding_claimed")) db.exec("ALTER TABLE learner_profiles ADD COLUMN onboarding_claimed INTEGER NOT NULL DEFAULT 0");
  // placement test: whether the learner has taken the entry-level quiz + its result JSON
  if (!lpCols3.includes("placement_done")) db.exec("ALTER TABLE learner_profiles ADD COLUMN placement_done INTEGER NOT NULL DEFAULT 0");
  if (!lpCols3.includes("placement_json")) db.exec("ALTER TABLE learner_profiles ADD COLUMN placement_json TEXT");
  if (!lpCols3.includes("placement_dismissed")) db.exec("ALTER TABLE learner_profiles ADD COLUMN placement_dismissed INTEGER NOT NULL DEFAULT 0");
  // referral program columns
  if (!lpCols3.includes("referral_code")) db.exec("ALTER TABLE learner_profiles ADD COLUMN referral_code TEXT");
  if (!lpCols3.includes("referred_by")) db.exec("ALTER TABLE learner_profiles ADD COLUMN referred_by INTEGER");
  if (!lpCols3.includes("referral_count")) db.exec("ALTER TABLE learner_profiles ADD COLUMN referral_count INTEGER NOT NULL DEFAULT 0");
  if (!lpCols3.includes("referral_milestones")) db.exec("ALTER TABLE learner_profiles ADD COLUMN referral_milestones TEXT");
  // first-time welcome flow (shown once)
  if (!lpCols3.includes("welcome_seen")) db.exec("ALTER TABLE learner_profiles ADD COLUMN welcome_seen INTEGER NOT NULL DEFAULT 0");
  if (!lpCols3.includes("last_node_id")) db.exec("ALTER TABLE learner_profiles ADD COLUMN last_node_id INTEGER");
  db.exec(`CREATE TABLE IF NOT EXISTS premium_grants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    days INTEGER,
    until TEXT,
    kind TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  // Admin structural deletes (node/topic/card) must survive a restart and
  // a bank re-import, and they apply to BOTH languages — one path, one bank.
  db.exec(`CREATE TABLE IF NOT EXISTS admin_deleted (
    kind TEXT NOT NULL,
    key TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (kind, key)
  )`);
  // Diamond Tournament: a `tournament` stage tag on a league room.
  const lgCols = db.prepare("PRAGMA table_info(leagues)").all().map((c) => c.name);
  if (!lgCols.includes("tournament")) db.exec("ALTER TABLE leagues ADD COLUMN tournament TEXT");
  // FSRS scheduler columns on srs_state (DSR memory model). SM-2 columns kept
  // for backward compatibility; FSRS uses stability + difficulty + state.
  const srsCols = db.prepare("PRAGMA table_info(srs_state)").all().map((c) => c.name);
  if (!srsCols.includes("stability")) db.exec("ALTER TABLE srs_state ADD COLUMN stability REAL NOT NULL DEFAULT 0");
  if (!srsCols.includes("difficulty")) db.exec("ALTER TABLE srs_state ADD COLUMN difficulty REAL NOT NULL DEFAULT 0");
  if (!srsCols.includes("state")) db.exec("ALTER TABLE srs_state ADD COLUMN state TEXT NOT NULL DEFAULT 'new'"); // new|learning|review|relearning
  if (!srsCols.includes("last_grade")) db.exec("ALTER TABLE srs_state ADD COLUMN last_grade INTEGER DEFAULT 0");
  if (!srsCols.includes("scheduler")) db.exec("ALTER TABLE srs_state ADD COLUMN scheduler TEXT DEFAULT 'sm2'");
  const lpcols = db.prepare("PRAGMA table_info(learner_profiles)").all().map((c) => c.name);
  for (const [col, def] of [["daily_goal","30"],["xp_boost_until","NULL"],["timer_boosts","0"],["streak_repairs_used","0"],["last_league_result","NULL"],
    // --- Calm Mode (anti-burnout, opt-in) per-learner preferences ---
    ["calm_mode","0"],              // 1 = Calm Mode on
    ["calm_review_cap","0"],        // learner's chosen daily review cap (0 = use admin default)
    ["calm_hide_streak","0"],       // 1 = hide the streak flame / pressure
    ["calm_opt_out_leagues","0"],   // 1 = don't place the learner in weekly leagues
    ["rest_days_used","0"],         // rest days consumed in the current ISO week
    ["rest_week_key","NULL"],       // ISO week the rest_days_used counter belongs to
    ["last_rest_day","NULL"],       // YYYY-MM-DD (Tehran) of the last rest day taken
    // --- Anonymous / stealth ranking (opt-in privacy) ---
    ["anon_mode","0"],              // 1 = appear under a pseudonym to other learners
    ["alias","NULL"],
    // --- Round 9: premium taste granted at streak milestones (last milestone paid) ---
    ["trial_tier","0"]]) {            // the learner's chosen/assigned pseudonym
    if (!lpcols.includes(col)) db.exec(`ALTER TABLE learner_profiles ADD COLUMN ${col} ${def === "NULL" ? "TEXT" : "INTEGER DEFAULT " + def}`);
  }
  const acols = db.prepare("PRAGMA table_info(attempts)").all().map((c) => c.name);
  if (!acols.includes("class_id")) db.exec("ALTER TABLE attempts ADD COLUMN class_id INTEGER");
  if (!acols.includes("exam_id")) db.exec("ALTER TABLE attempts ADD COLUMN exam_id INTEGER");
  for (const col of ["imaging_count","ddx_count","total_questions","correct_count","wrong_count"]) {
    if (!acols.includes(col)) db.exec(`ALTER TABLE attempts ADD COLUMN ${col} INTEGER DEFAULT 0`);
  }
  // Teacher review of an attempt's AI score: approve / adjust / reject + feedback.
  if (!acols.includes("teacher_status")) db.exec("ALTER TABLE attempts ADD COLUMN teacher_status TEXT");   // NULL=pending | approved | adjusted | rejected
  if (!acols.includes("teacher_score")) db.exec("ALTER TABLE attempts ADD COLUMN teacher_score INTEGER"); // override % when adjusted
  if (!acols.includes("teacher_feedback")) db.exec("ALTER TABLE attempts ADD COLUMN teacher_feedback TEXT");
  if (!acols.includes("reviewed_by")) db.exec("ALTER TABLE attempts ADD COLUMN reviewed_by INTEGER");
  if (!acols.includes("reviewed_at")) db.exec("ALTER TABLE attempts ADD COLUMN reviewed_at TEXT");
  const ecols = db.prepare("PRAGMA table_info(exams)").all().map((c) => c.name);
  for (const [col, def] of [["shuffle","0"],["anti_cheat","1"],["competition","0"],["show_correct","1"],["show_hints","1"],["show_ai","1"],["show_micro","1"]]) {
    if (!ecols.includes(col)) db.exec(`ALTER TABLE exams ADD COLUMN ${col} INTEGER DEFAULT ${def}`);
  }

  // --- migrate the users role CHECK constraint to allow 'learner' ---
  try {
    const usersSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get()?.sql || "";
    if (usersSql && !usersSql.includes("'support'")) {
      db.exec(`
        PRAGMA foreign_keys=off;
        ALTER TABLE users RENAME TO users_old;
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name_fa TEXT, name_en TEXT,
          student_no TEXT,
          role TEXT NOT NULL CHECK(role IN ('student','teacher','admin','learner','content_manager','support')),
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO users (id,username,password_hash,name_fa,name_en,student_no,role,status,created_at)
          SELECT id,username,password_hash,name_fa,name_en,student_no,role,status,created_at FROM users_old;
        DROP TABLE users_old;
        PRAGMA foreign_keys=on;
      `);
    }
  } catch (e) { /* fresh DB already has the new constraint */ }


  // --- Restored optional modules: questionnaires / Dr Tutor / research / external ads ---
  const classColsRestored = db.prepare("PRAGMA table_info(classes)").all().map((c) => c.name);
  if (!classColsRestored.includes("tutor_enabled")) db.exec("ALTER TABLE classes ADD COLUMN tutor_enabled INTEGER DEFAULT 0");
  if (!classColsRestored.includes("tutor_prompt")) db.exec("ALTER TABLE classes ADD COLUMN tutor_prompt TEXT");
  const examColsRestored = db.prepare("PRAGMA table_info(exams)").all().map((c) => c.name);
  if (!examColsRestored.includes("tutor_enabled")) db.exec("ALTER TABLE exams ADD COLUMN tutor_enabled INTEGER DEFAULT 0");
  if (!examColsRestored.includes("tutor_prompt")) db.exec("ALTER TABLE exams ADD COLUMN tutor_prompt TEXT");
  try {
    const hasAll=(cols,req)=>req.every(c=>cols.includes(c));
    const dropIfBad=(name, req)=>{ const cols=db.prepare(`PRAGMA table_info(${name})`).all().map(c=>c.name); if(cols.length&&!hasAll(cols,req)) db.exec(`DROP TABLE IF EXISTS ${name}`); };
    dropIfBad('questionnaire_responses',["form_id","user_id","context_type","context_id","answers_json","created_at"]);
    dropIfBad('questionnaire_forms',["questions_json","active","anonymous","created_at"]);
    dropIfBad('tutor_chats',["context_type","context_id","role","message","created_at"]);
    dropIfBad('research_studies',["domain","active","consent_required","created_at"]);
    dropIfBad('research_events',["event_type","data_json","created_at"]);
    dropIfBad('external_ads_config',["provider","enabled","client_id","slot_id","updated_at"]);
    dropIfBad('external_ad_events',["provider","event","placement","created_at"]);
  } catch { /* ignore */ }
  db.exec(`
    CREATE TABLE IF NOT EXISTS questionnaire_forms (id INTEGER PRIMARY KEY AUTOINCREMENT,title_fa TEXT,title_en TEXT,description_fa TEXT,description_en TEXT,scope TEXT NOT NULL DEFAULT 'general',class_id INTEGER,exam_id INTEGER,questions_json TEXT NOT NULL DEFAULT '[]',active INTEGER NOT NULL DEFAULT 1,require_after_finish INTEGER NOT NULL DEFAULT 1,anonymous INTEGER NOT NULL DEFAULT 1,created_by INTEGER,created_at TEXT DEFAULT (datetime('now')),updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS questionnaire_responses (id INTEGER PRIMARY KEY AUTOINCREMENT,form_id INTEGER NOT NULL,user_id INTEGER,context_type TEXT,context_id INTEGER,answers_json TEXT NOT NULL DEFAULT '{}',created_at TEXT DEFAULT (datetime('now')),UNIQUE(form_id,user_id,context_type,context_id));
    CREATE TABLE IF NOT EXISTS research_studies (id INTEGER PRIMARY KEY AUTOINCREMENT,title_fa TEXT,title_en TEXT,description_fa TEXT,description_en TEXT,domain TEXT DEFAULT 'general',active INTEGER NOT NULL DEFAULT 0,consent_required INTEGER NOT NULL DEFAULT 1,created_by INTEGER,created_at TEXT DEFAULT (datetime('now')),updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS research_events (id INTEGER PRIMARY KEY AUTOINCREMENT,study_id INTEGER,user_id INTEGER,event_type TEXT NOT NULL,context_type TEXT,context_id INTEGER,data_json TEXT NOT NULL DEFAULT '{}',created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS tutor_settings (id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL DEFAULT 0,default_prompt TEXT DEFAULT '',ai_enabled INTEGER NOT NULL DEFAULT 0,updated_at TEXT DEFAULT (datetime('now')));
    INSERT OR IGNORE INTO tutor_settings (id,enabled,default_prompt,ai_enabled) VALUES (1,0,'تو دکتر راهنمای آموزشی MED School هستی. کوتاه، علمی و راهنما پاسخ بده؛ جواب نهایی آزمون را مستقیم لو نده.',0);
    CREATE TABLE IF NOT EXISTS tutor_chats (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,context_type TEXT NOT NULL DEFAULT 'general',context_id INTEGER,role TEXT NOT NULL,message TEXT NOT NULL,meta_json TEXT DEFAULT '{}',created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS external_ads_config (id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL DEFAULT 0,provider TEXT DEFAULT 'none',client_id TEXT DEFAULT '',slot_id TEXT DEFAULT '',placement TEXT DEFAULT 'blog',legal_note TEXT DEFAULT '',updated_at TEXT DEFAULT (datetime('now')));
    INSERT OR IGNORE INTO external_ads_config (id,enabled,provider,legal_note) VALUES (1,0,'none','تبلیغات خارجی/AdSense به‌صورت پیش‌فرض خاموش است و باید با قوانین محل فعالیت و محدودیت‌های سرویس بررسی شود.');
    CREATE TABLE IF NOT EXISTS external_ad_events (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,provider TEXT,event TEXT,placement TEXT,detail_json TEXT DEFAULT '{}',created_at TEXT DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS idx_questionnaire_forms_scope ON questionnaire_forms(scope,active);
    CREATE INDEX IF NOT EXISTS idx_tutor_chats_user_context ON tutor_chats(user_id,context_type,context_id,created_at);
  `);

  // ---- Additive migrations for research/anonymity support -------------------
  // Never destructive: existing responses are kept. `pseudonym` lets an
  // anonymous form deduplicate and pair one participant's rows without storing
  // their identity (see lib/pseudonym.js).
  {
    const qcols = db.prepare("PRAGMA table_info(questionnaire_responses)").all().map((c) => c.name);
    if (qcols.length) {
      if (!qcols.includes("pseudonym"))  db.exec("ALTER TABLE questionnaire_responses ADD COLUMN pseudonym TEXT");
      if (!qcols.includes("updated_at")) db.exec("ALTER TABLE questionnaire_responses ADD COLUMN updated_at TEXT");
    }
  }
  // One canonical row per (form, participant, context). The legacy UNIQUE index
  // could not enforce this once user_id became NULL for anonymous forms.
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_qresp_one_per_participant ON questionnaire_responses(form_id, pseudonym, context_type, context_id)");

  /* ---- Virtual-patient conversation logging (research data) --------------
     Privacy-by-default: nothing is recorded unless the teacher explicitly turns
     logging on for the class/exam. The toggle is snapshotted onto the session
     row at start time so a later change cannot retroactively re-interpret data
     that was already collected. */
  {
    const ccols = db.prepare("PRAGMA table_info(classes)").all().map((c) => c.name);
    if (ccols.length && !ccols.includes("log_transcript"))
      db.exec("ALTER TABLE classes ADD COLUMN log_transcript INTEGER NOT NULL DEFAULT 0");
    const ecols = db.prepare("PRAGMA table_info(exams)").all().map((c) => c.name);
    if (ecols.length && !ecols.includes("log_transcript"))
      db.exec("ALTER TABLE exams ADD COLUMN log_transcript INTEGER NOT NULL DEFAULT 0");
  }
  db.exec(`
    -- One row per encounter. Exists even when logging is OFF (so dropouts are
    -- still visible) — but then it holds no content, only timing metadata.
    CREATE TABLE IF NOT EXISTS vp_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      case_id INTEGER NOT NULL,
      class_id INTEGER,
      exam_id INTEGER,
      study_id INTEGER,
      logging_enabled INTEGER NOT NULL DEFAULT 0,
      started_at TEXT DEFAULT (datetime('now')),
      -- datetime('now') only has second precision, which is too coarse to
      -- cross-check a client-reported duration. Keep epoch millis alongside.
      started_ms INTEGER,
      finished_at TEXT,
      attempt_id INTEGER,
      duration_sec INTEGER DEFAULT 0,
      event_count INTEGER DEFAULT 0,
      lang TEXT DEFAULT 'fa'
    );
    -- Timestamped interaction log. Only written when logging_enabled = 1.
    CREATE TABLE IF NOT EXISTS vp_session_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      at_ms INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_vp_sessions_user   ON vp_sessions(user_id, case_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_vp_sessions_class  ON vp_sessions(class_id, case_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_vp_events_session  ON vp_session_events(session_id, seq);
  `);
  // Additive: databases created before started_ms existed still need the column.
  if (!db.prepare("PRAGMA table_info(vp_sessions)").all().some((c) => c.name === "started_ms")) {
    db.exec("ALTER TABLE vp_sessions ADD COLUMN started_ms INTEGER");
  }

  // Optional per-user idempotency key for retrying session creation.
  if (!db.prepare("PRAGMA table_info(vp_sessions)").all().some(c => c.name === "start_request_id")) {
    db.exec("ALTER TABLE vp_sessions ADD COLUMN start_request_id TEXT");
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_vp_start_request ON vp_sessions(user_id,start_request_id) WHERE start_request_id IS NOT NULL");

  /* ---- Phase 4: protocol instruments seeded as editable templates ----------
     `template_key` marks a form that came from the study protocol, so reseeding
     never duplicates it and the admin can still edit the wording freely. */
  {
    const fcols = db.prepare("PRAGMA table_info(questionnaire_forms)").all().map((c) => c.name);
    if (fcols.length && !fcols.includes("template_key"))
      db.exec("ALTER TABLE questionnaire_forms ADD COLUMN template_key TEXT");
  }

  /* ---- Phase 3: research consent (multi-mode) ------------------------------
     `research_studies.consent_required` existed but nothing enforced it: a
     student could take part in a study with no recorded consent at all. That is
     the one gap that makes human-subjects data unusable, so consent now has a
     real record with the text + protocol version it refers to.

     Multi-mode is required because in practice consent is often collected on
     paper by the researchers in the ward/clinic; the system must be able to
     record that fact rather than pretend every participant clicked a button. */
  {
    const scols = db.prepare("PRAGMA table_info(research_studies)").all().map((c) => c.name);
    if (scols.length) {
      const addStudyCol = (name, ddl) => { if (!scols.includes(name)) db.exec(`ALTER TABLE research_studies ADD COLUMN ${name} ${ddl}`); };
      addStudyCol("ethics_code",     "TEXT DEFAULT ''");
      addStudyCol("protocol_version","TEXT DEFAULT ''");
      addStudyCol("consent_text_fa", "TEXT DEFAULT ''");
      addStudyCol("consent_text_en", "TEXT DEFAULT ''");
      // CSV of the collection methods this study permits: online,paper,verbal
      addStudyCol("consent_admin_managed", "INTEGER NOT NULL DEFAULT 1");
      addStudyCol("consent_modes",   "TEXT DEFAULT 'online'");
      // Optional, OFF by default: only the pseudonym is kept in the research
      // export instead of the student number. Identity stays in `users`.
      addStudyCol("anonymize",       "INTEGER NOT NULL DEFAULT 0");
    }
    const ccols = db.prepare("PRAGMA table_info(classes)").all().map((c) => c.name);
    if (ccols.length && !ccols.includes("study_id")) db.exec("ALTER TABLE classes ADD COLUMN study_id INTEGER");
    const xcols = db.prepare("PRAGMA table_info(exams)").all().map((c) => c.name);
    if (xcols.length && !xcols.includes("study_id")) db.exec("ALTER TABLE exams ADD COLUMN study_id INTEGER");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS research_participation_controls (
      study_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
      blocked INTEGER NOT NULL DEFAULT 0, recorded_by INTEGER NOT NULL,
      note TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY(study_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS research_consents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      study_id INTEGER NOT NULL,
      -- NULL for participants who are only known by pseudonym.
      user_id INTEGER,
      pseudonym TEXT,
      mode TEXT NOT NULL DEFAULT 'online',          -- online | paper | verbal
      status TEXT NOT NULL DEFAULT 'granted',       -- granted | withdrawn
      consent_text_hash TEXT DEFAULT '',
      protocol_version TEXT DEFAULT '',
      -- The researcher who collected an offline consent. Never the participant.
      recorded_by INTEGER,
      note TEXT DEFAULT '',
      granted_at TEXT DEFAULT (datetime('now')),
      withdrawn_at TEXT
    );
    -- One live decision per identified participant. A partial index is needed
    -- because SQLite treats NULLs as distinct in a plain UNIQUE index.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_consent_one_per_user
      ON research_consents(study_id, user_id) WHERE user_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_consent_study_status ON research_consents(study_id, status);
    CREATE INDEX IF NOT EXISTS idx_consent_pseudonym    ON research_consents(study_id, pseudonym);
  `);

  // Hot-path indexes for dashboards, exam results, class membership, learner
  // progress and notifications. Idempotent and safe on existing databases.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_attempts_user        ON attempts(user_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_exam        ON attempts(exam_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_class       ON attempts(class_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_created     ON attempts(created_at);
    CREATE INDEX IF NOT EXISTS idx_class_members_user   ON class_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_exam_parts_user      ON exam_participants(user_id);
    CREATE INDEX IF NOT EXISTS idx_flashcards_active    ON flashcards(active);
    CREATE INDEX IF NOT EXISTS idx_cases_active         ON cases(active);
    CREATE INDEX IF NOT EXISTS idx_users_role           ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_student_no     ON users(student_no);
    CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_university     ON users(university_id);
    CREATE INDEX IF NOT EXISTS idx_card_attempts_user   ON card_attempts(user_id, card_id);
    CREATE INDEX IF NOT EXISTS idx_card_attempts_day    ON card_attempts(day);
    CREATE INDEX IF NOT EXISTS idx_xp_events_user       ON xp_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_node_progress_user   ON node_progress(user_id);
    CREATE INDEX IF NOT EXISTS idx_srs_due              ON srs_state(user_id, due);
    CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id, seen);
    CREATE INDEX IF NOT EXISTS idx_support_user         ON support_tickets(user_id, status);

    -- Tenant/university hot-path indexes: shared-schema multi-tenancy needs
    -- tenant-leading indexes so teacher/university filters are fast and safer.
    CREATE INDEX IF NOT EXISTS idx_users_uni_role_no       ON users(university_id, role, student_no);
    CREATE INDEX IF NOT EXISTS idx_users_uni_role_status   ON users(university_id, role, status);
    CREATE INDEX IF NOT EXISTS idx_classes_uni_active      ON classes(university_id, active, id DESC);
    CREATE INDEX IF NOT EXISTS idx_exams_uni_active        ON exams(university_id, active, id DESC);
    CREATE INDEX IF NOT EXISTS idx_cases_uni_active        ON cases(university_id, active, id);
    CREATE INDEX IF NOT EXISTS idx_flashcards_uni_active   ON flashcards(university_id, active, id);
    CREATE INDEX IF NOT EXISTS idx_class_members_class_user ON class_members(class_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_class_cases_class_case   ON class_cases(class_id, case_id);
    CREATE INDEX IF NOT EXISTS idx_class_flash_class_card   ON class_flashcards(class_id, flashcard_id);
    CREATE INDEX IF NOT EXISTS idx_class_flash_attempts_live ON class_flashcard_attempts(class_id, user_id, flashcard_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_attempts_class_live      ON attempts(class_id, user_id, type, created_at);
    CREATE INDEX IF NOT EXISTS idx_attempts_exam_live       ON attempts(exam_id, user_id, type, created_at);
    CREATE INDEX IF NOT EXISTS idx_exam_parts_exam_user     ON exam_participants(exam_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_questionnaire_resp_form  ON questionnaire_responses(form_id, user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_research_events_study    ON research_events(study_id, user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_external_ad_events_kind  ON external_ad_events(provider, event, placement, created_at);

    -- Learning path & node covering indexes
    CREATE INDEX IF NOT EXISTS idx_path_nodes_active_topic ON path_nodes(active, topic_id, ord, id);
    CREATE INDEX IF NOT EXISTS idx_topics_active_prog       ON topics(active, program, ord, id);
    CREATE INDEX IF NOT EXISTS idx_node_prog_user_node     ON node_progress(user_id, node_id, stars, completed_at, legendary);

    -- Custom test / exam simulation history index
    CREATE INDEX IF NOT EXISTS idx_exam_sims_user_kind_id  ON exam_sims(user_id, kind, id DESC);

    -- Mistakes & flagged attempt covering index
    CREATE INDEX IF NOT EXISTS idx_card_att_user_full      ON card_attempts(user_id, card_id, correct, flagged, guessed, created_at);
  `);
  try { db.exec("PRAGMA optimize"); } catch { /* best-effort SQLite planner stats */ }

  persistNow();
}

function isProcessAlive(pid) { try { process.kill(pid, 0); return true; } catch (_) { return false; } }

export { persist, persistNow };
