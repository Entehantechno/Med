/* r96-flashcard-track-index.test.js — R96 performance.
   /api/flashcards split the bank (track 'learn') from university cards with a JSON
   predicate that was evaluated over all ~11.7k rows on every request (~100 ms of
   synchronous work). The fix is an expression index on (active, track) plus a
   query that repeats the exact same expression. These tests pin three things:
     1. the index exists and the planner uses it (no full table scan);
     2. the new predicates select exactly the same rows as the old ones, including
        corrupt JSON, a missing track and a non-string track;
     3. no column was added, so SELECT * rows and their parsers are unchanged. */
import { describe, it, expect, beforeAll } from "vitest";
import { initDb, initSchema, db } from "../src/db.js";
import { TRACK_EXPR, BANK_SQL, NON_BANK_SQL, FLASHCARDS_BY_TRACK, BANK_SIG_SQL } from "../src/lib/flashcard-track.js";

// The exact predicates the list used before R96 (kept here as the reference).
const OLD_BANK = "CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.track') = 'learn' ELSE 0 END";
const oldBankIds = () => db.prepare(`SELECT id FROM flashcards WHERE active=1 AND COALESCE(${OLD_BANK}, 0) ORDER BY id`).all().map((r) => r.id);
const oldNonBankIds = () => db.prepare(`SELECT id FROM flashcards WHERE active=1 AND NOT COALESCE(${OLD_BANK}, 0) ORDER BY id`).all().map((r) => r.id);
const newBankIds = () => db.prepare(`SELECT id FROM flashcards WHERE active=1 AND ${BANK_SQL} ORDER BY id`).all().map((r) => r.id);
const newNonBankIds = () => db.prepare(`SELECT id FROM flashcards WHERE active=1 AND ${NON_BANK_SQL} ORDER BY id`).all().map((r) => r.id);

beforeAll(async () => {
  await initDb();
  initSchema();
});

describe("flashcard track expression index (R96)", () => {
  it("creates idx_flashcards_active_track on (active, track expression)", () => {
    const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='flashcards' AND name='idx_flashcards_active_track'").get();
    expect(idx).toBeTruthy();
  });

  it("the browse cache key is served by the covering index idx_flashcards_sig", () => {
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${BANK_SIG_SQL}`).all().map((r) => r.detail).join(" | ");
    expect(plan).toMatch(/COVERING INDEX idx_flashcards_sig/);
  });

  it("adds no column to flashcards (SELECT * rows keep their shape)", () => {
    const cols = db.prepare("PRAGMA table_info(flashcards)").all().map((c) => c.name);
    expect(cols.some((c) => /track/i.test(c))).toBe(false);
  });

  it("the planner uses the index for both the bank and the non-bank split", () => {
    for (const where of [BANK_SQL, NON_BANK_SQL]) {
      const plan = db.prepare(`EXPLAIN QUERY PLAN SELECT id FROM ${FLASHCARDS_BY_TRACK} WHERE active=1 AND ${where}`).all().map((r) => r.detail).join(" | ");
      expect(plan).toMatch(/USING (COVERING )?INDEX idx_flashcards_active_track/);
      expect(plan).not.toMatch(/SCAN flashcards(?! USING)/);
    }
  });

  it("the new predicates select exactly the same rows as the old ones (fixtures for every case)", () => {
    // Fixtures: one row per tricky case, inserted inside a transaction that is rolled back.
    const fixtures = {
      learn: "{\"track\":\"learn\"}",
      uni: "{\"track\":\"uni\"}",
      missing: "{\"prompt\":\"no track\"}",
      corrupt: "{not json",
      numeric: "{\"track\":42}",
      nullTrack: "{\"track\":null}",
    };
    db.exec("BEGIN");
    try {
      const ins = db.prepare("INSERT INTO flashcards (data_json, active) VALUES (?, 1)");
      const ids = {};
      for (const [k, json] of Object.entries(fixtures)) ids[k] = Number(ins.run(json).lastInsertRowid);
      const bank = newBankIds(), nonBank = newNonBankIds();
      expect(bank).toEqual(oldBankIds());
      expect(nonBank).toEqual(oldNonBankIds());
      // Each category must really be present, otherwise the equality above proves nothing.
      expect(bank).toContain(ids.learn);
      for (const k of ["uni", "missing", "corrupt", "numeric", "nullTrack"]) expect(nonBank).toContain(ids[k]);
      expect(bank).not.toContain(ids.uni);
      // Inactive rows never appear, whatever their track.
      db.prepare("UPDATE flashcards SET active=0 WHERE id=?").run(ids.learn);
      expect(newBankIds()).toEqual(oldBankIds());
      expect(newBankIds()).not.toContain(ids.learn);
    } finally {
      db.exec("ROLLBACK");
    }
  });

  it("keeps the same answer when an existing row turns corrupt or changes track", () => {
    const sample = db.prepare("SELECT id FROM flashcards ORDER BY id LIMIT 1").get();
    const seeded = db.prepare("SELECT COUNT(*) c FROM flashcards WHERE active=1").get().c;
    if (!sample) return; // no seeded card in this database: the fixture test above covers it
    db.exec("BEGIN");
    try {
      for (const json of ["{not json", "{\"track\":\"learn\"}", "{\"track\":\"uni\"}"]) {
        db.prepare("UPDATE flashcards SET data_json=? WHERE id=?").run(json, sample.id);
        expect(newBankIds()).toEqual(oldBankIds());
        expect(newNonBankIds()).toEqual(oldNonBankIds());
      }
      expect(seeded).toBeGreaterThan(0);
    } finally {
      db.exec("ROLLBACK");
    }
  });

  it("uses one shared expression text so SQLite can match the index", () => {
    expect(BANK_SQL).toContain(TRACK_EXPR);
    expect(NON_BANK_SQL).toContain(TRACK_EXPR);
  });
});
