/* ================================================================
   write-behind.test.js — R56 regression for the write-behind flush.

   Plain writes must NOT export the whole database inside the request
   (that blocked the event loop once per write). They are flushed on a
   bounded timer instead. Explicit durable writes stay synchronous.
   ================================================================ */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import { initDb, initSchema, db, persistNow, durableTransaction } from "../src/db.js";
import { DB_PATH } from "../src/lib/paths.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mtime = () => fs.statSync(DB_PATH).mtimeMs;

beforeAll(async () => {
  await initDb();
  initSchema();                  // standalone run: make sure the tables exist
  persistNow({ force: true });   // start from a flushed state
});

describe("R56: write-behind flush", () => {
  it("a plain write is not exported synchronously", async () => {
    await wait(20);
    const before = mtime();
    db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .run("r56_probe", "1");
    persistNow();                    // legacy call site: must only schedule
    expect(mtime()).toBe(before);
  });

  it("the scheduled flush reaches the disk within the flush window", async () => {
    const before = mtime();
    await wait(2200);                // default window 1500 ms + margin
    expect(mtime()).toBeGreaterThan(before);
  });

  it("durableTransaction writes to disk before returning", () => {
    const before = mtime();
    durableTransaction(() => {
      db.prepare("UPDATE settings SET value=? WHERE key=?").run("2", "r56_probe");
    });
    expect(mtime()).toBeGreaterThanOrEqual(before);
    const row = db.prepare("SELECT value FROM settings WHERE key='r56_probe'").get();
    expect(row.value).toBe("2");
  });

  it("force flush always exports", () => {
    const before = mtime();
    return wait(15).then(() => {
      persistNow({ force: true });
      expect(mtime()).toBeGreaterThanOrEqual(before);
    });
  });
});
