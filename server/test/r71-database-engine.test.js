/* R71 — database engine tests (better-sqlite3, WAL, verified snapshots).
   These replace the R56 write-behind tests: a commit is durable when it returns,
   so there is no flush window to test any more. Crash and upgrade cases run in a
   child process with their own DATA_DIR, so the shared test database is untouched. */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import { initDb, initSchema, db, durableTransaction, createSnapshot, DB_ENGINE_VERSION } from "../src/db.js";
import { DB_PATH } from "../src/lib/paths.js";

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_MODULE = pathToFileURL(path.join(SERVER_DIR, "src", "db.js")).href;
const mkTmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

// Runs `code` as an ES module in a fresh process with its own DATA_DIR.
function child(dataDir, code) {
  const src = `const db = await import(${JSON.stringify(DB_MODULE)});\n${code}`;
  return spawnSync(process.execPath, ["--input-type=module", "-e", src], {
    cwd: SERVER_DIR,
    env: { ...process.env, DATA_DIR: dataDir, DISABLE_RATE_LIMIT: "1" },
    encoding: "utf8",
    timeout: 120000,
  });
}
function openRo(file) { return new Database(file, { readonly: true, fileMustExist: true }); }

beforeAll(async () => {
  await initDb();
  initSchema();
});

describe("R71 engine settings", () => {
  it("runs in WAL mode with synchronous=FULL, foreign keys on, and a bounded cache", () => {
    expect(db.prepare("PRAGMA journal_mode").get().journal_mode).toBe("wal");
    expect(db.prepare("PRAGMA synchronous").get().synchronous).toBe(2);
    expect(db.prepare("PRAGMA foreign_keys").get().foreign_keys).toBe(1);
    expect(db.prepare("PRAGMA cache_size").get().cache_size).toBeLessThan(0); // KiB, bounded
  });

  it("records the engine generation in user_version after initSchema", () => {
    expect(db.prepare("PRAGMA user_version").get().user_version).toBe(DB_ENGINE_VERSION);
  });
});

describe("R71 commits are durable when they return", () => {
  it("a committed write is visible to a separate connection immediately (no flush step)", () => {
    db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .run("r71_probe", "visible");
    const ro = openRo(DB_PATH);
    try {
      expect(ro.prepare("SELECT value FROM settings WHERE key='r71_probe'").get().value).toBe("visible");
    } finally { ro.close(); }
  });

  it("a throwing durableTransaction rolls back every statement in it", () => {
    db.prepare("INSERT INTO settings (key,value) VALUES ('r71_tx','before') ON CONFLICT(key) DO UPDATE SET value='before'").run();
    expect(() => durableTransaction(() => {
      db.prepare("UPDATE settings SET value='after' WHERE key='r71_tx'").run();
      throw new Error("boom");
    })).toThrow("boom");
    expect(db.prepare("SELECT value FROM settings WHERE key='r71_tx'").get().value).toBe("before");
  });

  it("survives a hard crash (SIGKILL straight after the commit returns)", () => {
    const dir = mkTmp("med-r71-crash-");
    const r = child(dir, `
      await db.initDb(); db.initSchema();
      db.db.prepare("INSERT INTO settings (key,value) VALUES (?,?)").run("crash_probe", "kept");
      process.kill(process.pid, "SIGKILL");
    `);
    expect(r.signal === "SIGKILL" || r.status !== 0).toBe(true);
    const ro = openRo(path.join(dir, "medlab.db"));
    try {
      expect(ro.prepare("SELECT value FROM settings WHERE key='crash_probe'").get()?.value).toBe("kept");
    } finally { ro.close(); }
  });
});

describe("R71 statement wrapper compatibility", () => {
  it("binds booleans as 0/1 and undefined as NULL", () => {
    db.prepare("CREATE TABLE IF NOT EXISTS r71_bind (a INTEGER, b INTEGER, c TEXT)").run();
    db.prepare("DELETE FROM r71_bind").run();
    db.prepare("INSERT INTO r71_bind VALUES (?,?,?)").run(true, false, undefined);
    expect(db.prepare("SELECT a,b,c FROM r71_bind").get()).toEqual({ a: 1, b: 0, c: null });
  });

  it("run() on a SELECT and all() on a write do not throw (sql.js-compatible)", () => {
    expect(() => db.prepare("SELECT 1 AS x").run()).not.toThrow();
    expect(db.prepare("UPDATE settings SET value=value WHERE key='__none__'").all()).toEqual([]);
  });

  it("returns changes and lastInsertRowid from run()", () => {
    db.prepare("CREATE TABLE IF NOT EXISTS r71_ids (id INTEGER PRIMARY KEY, v TEXT)").run();
    const info = db.prepare("INSERT INTO r71_ids (v) VALUES (?)").run("x");
    expect(info.changes).toBe(1);
    expect(info.lastInsertRowid).toBeGreaterThan(0);
  });
});

describe("R71 verified snapshots", () => {
  it("VACUUM INTO snapshot includes committed rows that are still in the WAL", () => {
    db.prepare("INSERT INTO settings (key,value) VALUES ('r71_snap','in-wal') ON CONFLICT(key) DO UPDATE SET value='in-wal'").run();
    const dir = mkTmp("med-r71-snap-");
    const file = createSnapshot(dir, "medlab");
    const ro = openRo(file);
    try {
      expect(ro.pragma("quick_check", { simple: true })).toBe("ok");
      expect(ro.prepare("SELECT value FROM settings WHERE key='r71_snap'").get().value).toBe("in-wal");
      expect(ro.pragma("journal_mode", { simple: true })).toBe("delete"); // a single self-contained file
    } finally { ro.close(); }
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });

  it("refuses to overwrite an existing snapshot destination", () => {
    const dir = mkTmp("med-r71-snap2-");
    const file = createSnapshot(dir, "medlab");
    expect(() => db.prepare("VACUUM INTO ?").run(file)).toThrow();
  });
});

describe("R71 upgrade of an existing (sql.js-era) database", () => {
  // A database written before R71: rollback journal, user_version 0, real data.
  function legacyCopy() {
    const dir = mkTmp("med-r71-legacy-");
    const snap = createSnapshot(dir, "src");
    const file = path.join(dir, "medlab.db");
    fs.renameSync(snap, file);
    const d = new Database(file);
    d.pragma("journal_mode = DELETE");
    d.pragma("user_version = 0");
    d.close();
    return { dir, file };
  }

  it("takes a verified pre-upgrade snapshot, migrates, keeps every row, and sets user_version", () => {
    const { dir, file } = legacyCopy();
    const before = openRo(file);
    const users = before.prepare("SELECT COUNT(*) n FROM users").get().n;
    before.close();
    const r = child(dir, `
      await db.initDb(); db.initSchema(); db.closeDatabase();
    `);
    expect(r.status, r.stderr).toBe(0);
    const backups = fs.readdirSync(path.join(dir, "backups"));
    expect(backups.some((f) => f.startsWith(`pre-upgrade-r${DB_ENGINE_VERSION}-`))).toBe(true);
    const ro = openRo(file);
    try {
      expect(ro.prepare("SELECT COUNT(*) n FROM users").get().n).toBe(users);
      expect(ro.pragma("user_version", { simple: true })).toBe(DB_ENGINE_VERSION);
    } finally { ro.close(); }
    // A second start must not take another pre-upgrade snapshot.
    const count = () => fs.readdirSync(path.join(dir, "backups")).filter((f) => /^pre-upgrade-/.test(f)).length;
    const first = count();
    expect(child(dir, `await db.initDb(); db.initSchema(); db.closeDatabase();`).status).toBe(0);
    expect(count()).toBe(first);
  });

  it("if the pre-upgrade snapshot cannot be written, startup stops and the file is NOT migrated", () => {
    if (typeof process.getuid === "function" && process.getuid() === 0) return; // root ignores chmod
    const { dir, file } = legacyCopy();
    fs.mkdirSync(path.join(dir, "backups"), { recursive: true });
    fs.chmodSync(path.join(dir, "backups"), 0o500);
    try {
      const r = child(dir, `await db.initDb(); db.initSchema();`);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/upgrade_snapshot_failed/);
      const ro = openRo(file);
      try {
        expect(ro.pragma("journal_mode", { simple: true })).toBe("delete");
        expect(ro.pragma("user_version", { simple: true })).toBe(0);
      } finally { ro.close(); }
    } finally {
      fs.chmodSync(path.join(dir, "backups"), 0o700);
    }
  });
});

describe("R71 student-facing copies on disk", () => {
  it("tenant and learning files are placeholders, not copies of the live database", async () => {
    const { syncLearningDomainDatabase } = await import("../src/lib/domain-storage.js");
    const { LEARNING_DB_PATH } = await import("../src/lib/paths.js");
    const res = await syncLearningDomainDatabase();
    expect(res.size).toBeGreaterThan(1000);
    const ro = openRo(LEARNING_DB_PATH);
    try {
      const names = ro.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
      expect(names).toEqual(["placeholder"]);
    } finally { ro.close(); }
  });
});
