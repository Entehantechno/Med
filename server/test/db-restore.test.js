/* Boot-time durability: a corrupt primary DB must never crash the server into an
   empty database. It is restored from a verified backup and the bad file is kept
   aside (R71: engine-neutral; a file is validated with PRAGMA quick_check). */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import Database from "better-sqlite3";
import { initDb, createSnapshot, loadImageWithFallback } from "../src/db.js";

const quiet = { log: () => {} };
function mkTmp() { return fs.mkdtempSync(path.join(os.tmpdir(), "med-restore-")); }
describe("loadImageWithFallback (never crash on a corrupt medlab.db)", () => {
  let valid;
  beforeAll(async () => {
    await initDb();
    // A consistent, verified image of the live test database (WAL content included).
    const dir = mkTmp();
    valid = fs.readFileSync(createSnapshot(dir, "image"));
    expect(valid.length).toBeGreaterThan(1000);
  });

  it("loads a healthy primary straight through", () => {
    const dir = mkTmp();
    const primary = path.join(dir, "medlab.db");
    fs.writeFileSync(primary, valid);
    const res = loadImageWithFallback(primary, { ...quiet, backupsDir: path.join(dir, "backups") });
    expect(res.restoredFrom).toBe(null);
    expect(res.quarantined).toBe(false);
    expect(fs.readFileSync(primary).equals(valid)).toBe(true);
  });

  it("corrupt primary → restores the newest verified backup and keeps the bad file aside", () => {
    const dir = mkTmp();
    const bdir = path.join(dir, "backups");
    fs.mkdirSync(bdir, { recursive: true });
    fs.writeFileSync(path.join(bdir, "medlab-2026-09-20T10-00-00-000Z.db"), valid);
    const primary = path.join(dir, "medlab.db");
    fs.writeFileSync(primary, Buffer.from("totally not sqlite bytes ~~~~".repeat(100)));
    const res = loadImageWithFallback(primary, { ...quiet, backupsDir: bdir });
    expect(res.restoredFrom).toContain("medlab-2026-09-20");
    expect(res.quarantined).toBe(true);
    expect(fs.readdirSync(dir).some((f) => f.startsWith("medlab.db.corrupt-"))).toBe(true);
    expect(fs.readFileSync(primary).equals(valid)).toBe(true);   // restored byte-for-byte
  });

  it("skips backups that ALSO fail validation and uses the newest healthy one", () => {
    const dir = mkTmp();
    const bdir = path.join(dir, "backups");
    fs.mkdirSync(bdir, { recursive: true });
    fs.writeFileSync(path.join(bdir, "medlab-2026-09-21T10-00-00-000Z.db"), Buffer.from("garbage".repeat(300)));
    fs.writeFileSync(path.join(bdir, "medlab-2026-09-19T10-00-00-000Z.db"), valid);
    const primary = path.join(dir, "medlab.db");
    fs.writeFileSync(primary, Buffer.from("corrupt".repeat(300)));
    const res = loadImageWithFallback(primary, { ...quiet, backupsDir: bdir });
    expect(res.restoredFrom).toContain("2026-09-19");
  });

  it("corrupt primary with NO valid backup → throws and leaves the file byte-identical", () => {
    const dir = mkTmp();
    const primary = path.join(dir, "medlab.db");
    const bytes = Buffer.from("not a database at all ".repeat(200));
    fs.writeFileSync(primary, bytes);
    expect(() => loadImageWithFallback(primary, { ...quiet, backupsDir: path.join(dir, "backups") }))
      .toThrow(/database_corrupt_no_valid_backup/);
    expect(fs.readFileSync(primary).equals(bytes)).toBe(true);
  });

  it("a WAL left without its main file is set aside, not replayed into a new database", () => {
    const dir = mkTmp();
    const primary = path.join(dir, "medlab.db");
    fs.writeFileSync(primary + "-wal", Buffer.from("orphan wal"));
    const res = loadImageWithFallback(primary, { ...quiet, backupsDir: path.join(dir, "backups") });
    expect(res.restoredFrom).toBe(null);
    expect(fs.existsSync(primary + "-wal")).toBe(false);
    expect(fs.readdirSync(dir).some((f) => f.startsWith("medlab.db.orphan-"))).toBe(true);
  });

  it("missing primary + no backups → fresh start path", () => {
    const dir = mkTmp();
    const res = loadImageWithFallback(path.join(dir, "absent.db"), { ...quiet, backupsDir: path.join(dir, "backups") });
    expect(res.restoredFrom).toBe(null);
    expect(res.quarantined).toBe(false);
  });
});
