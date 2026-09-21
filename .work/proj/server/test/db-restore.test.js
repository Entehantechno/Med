/* Boot-time durability: corrupt primary DB must never crash the server —
   it auto-restores from a verified backup and quarantines the bad file. */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { db, persistNow, loadImageWithFallback, initDb } from "../src/db.js";
import { DB_PATH } from "../src/lib/paths.js";

function validImageCopy() {
  persistNow({ force: true });
  const buf = fs.readFileSync(DB_PATH);
  expect(buf.length).toBeGreaterThan(1000);
  return buf;
}

function mkTmp() { return fs.mkdtempSync(path.join(os.tmpdir(), "med-restore-")); }

describe("loadImageWithFallback (B1: never crash on corrupt medlab.db)", () => {
  let valid;
  beforeAll(async () => { await initDb(); valid = validImageCopy(); });

  it("loads the healthy primary image straight through", () => {
    const dir = mkTmp();
    const primary = path.join(dir, "medlab.db");
    fs.writeFileSync(primary, valid);
    const res = loadImageWithFallback(primary, { log: () => {}, backupsDir: path.join(dir, "backups") });
    expect(res.restoredFrom).toBe(null);
    expect(res.quarantined).toBe(false);
    expect(res.db).toBeTruthy();
    expect(res.db.exec("SELECT count(*) FROM users")[0].values[0][0]).toBeGreaterThan(0);
    res.db.close();
  });

  it("corrupt primary → auto-restores newest verified backup + quarantines the bad file", () => {
    const dir = mkTmp();
    const bdir = path.join(dir, "backups");
    fs.mkdirSync(bdir, { recursive: true });
    fs.writeFileSync(path.join(bdir, "medlab-2026-09-20T10-00-00-000Z.db"), valid);
    const primary = path.join(dir, "medlab.db");
    fs.writeFileSync(primary, Buffer.from("totally not sqlite bytes ~~~~")); // corrupt
    const res = loadImageWithFallback(primary, { log: () => {}, backupsDir: bdir });
    expect(res.db).toBeTruthy();
    expect(res.restoredFrom).toContain("medlab-2026-09-20");
    expect(res.quarantined).toBe(true);
    expect(fs.existsSync(primary)).toBe(false);                       // renamed aside
    expect(fs.readdirSync(dir).some((f) => f.startsWith("medlab.db.corrupt-"))).toBe(true);
    expect(res.db.exec("SELECT count(*) FROM users")[0].values[0][0]).toBeGreaterThan(0);
    res.db.close();
  });

  it("skips backups that ALSO fail validation and prefers the newest healthy one", () => {
    const dir = mkTmp();
    const bdir = path.join(dir, "backups");
    fs.mkdirSync(bdir, { recursive: true });
    fs.writeFileSync(path.join(bdir, "medlab-2026-09-21T10-00-00-000Z.db"), Buffer.from("garbage"));
    fs.writeFileSync(path.join(bdir, "medlab-2026-09-19T10-00-00-000Z.db"), valid);
    const primary = path.join(dir, "medlab.db");
    fs.writeFileSync(primary, Buffer.from("corrupt"));
    const res = loadImageWithFallback(primary, { log: () => {}, backupsDir: bdir });
    expect(res.restoredFrom).toContain("2026-09-19"); // newest valid wins, even after a bad newer one
    res.db.close();
  });

  it("missing primary + no backups → { db: null } (fresh start path)", () => {
    const dir = mkTmp();
    const res = loadImageWithFallback(path.join(dir, "absent.db"), { log: () => {}, backupsDir: path.join(dir, "backups") });
    expect(res.db).toBe(null);
    expect(res.restoredFrom).toBe(null);
  });
});
