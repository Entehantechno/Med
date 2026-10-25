/* ================================================================
   mindmap-schema.test.js — R55 regression.

   Root cause that this guards against: mindmapBank.js used to run
   `db.exec(CREATE TABLE …)` at module import time. The db wrapper only
   gets its sql.js handle inside initDb(), so the call threw and a
   `catch {}` hid it. On a live install the mindmap tables never existed,
   GET /api/learn/mindmap-bank answered 500 ("no such table: mindmap_bank"),
   and the free-tier daily quota silently stopped counting.

   The fix defers schema work through onDbReady() (db.js), which runs
   inside initDb() once the database is open.
   Run with: npx vitest run test/mindmap-schema.test.js
   ================================================================ */
import { describe, it, expect, beforeAll } from "vitest";
import { initDb, db, onDbReady } from "../src/db.js";
import { searchMindmaps, mindmapDailyInfo, recordMindmapView, MINDMAP_FREE_DAILY_LIMIT } from "../src/lib/mindmapBank.js";

beforeAll(async () => {
  await initDb();
});

function tableNames() {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
}

describe("R55: mindmap schema is created once the database is open", () => {
  it("creates mindmap_bank, mindmap_daily_views and question_mindmap_links", () => {
    const names = tableNames();
    expect(names).toContain("mindmap_bank");
    expect(names).toContain("mindmap_daily_views");
    expect(names).toContain("question_mindmap_links");
  });

  it("the bank search no longer throws 'no such table'", () => {
    expect(() => searchMindmaps({ lang: "fa", q: "", page: 1 })).not.toThrow();
  });

  it("the free-tier daily quota is really counted (not silently 0)", () => {
    const userId = 999001;
    db.prepare("DELETE FROM mindmap_daily_views WHERE user_id=?").run(userId);
    expect(mindmapDailyInfo(userId).used).toBe(0);
    recordMindmapView(userId, false);
    recordMindmapView(userId, false);
    const info = mindmapDailyInfo(userId);
    expect(info.used).toBe(2);
    expect(info.remaining).toBe(MINDMAP_FREE_DAILY_LIMIT - 2);
    db.prepare("DELETE FROM mindmap_daily_views WHERE user_id=?").run(userId);
  });
});

describe("R55: onDbReady hook", () => {
  it("runs immediately when the database is already open", () => {
    let ran = false;
    onDbReady(() => { ran = true; });
    expect(ran).toBe(true);
  });
});
