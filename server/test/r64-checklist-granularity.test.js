/* ================================================================
   r64-checklist-granularity.test.js — Round 64 checklist tests.

     1. Checklist totals are unchanged (CL1 24, CL2 20, CL3 16).
     2. Every criterion has at least two evidence groups, except the ECG criterion,
        which is deliberately a single criterion with no timing facet (user decision).
     3. The R64 migration replaces only exact, untouched R63 criteria and runs once.
   ================================================================ */
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { DEFAULT_CHECKLIST_1, DEFAULT_CHECKLIST_2, DEFAULT_CHECKLIST_3, R64_ECG } from "../src/data/default-checklists.js";
import { migrateR64, R64_FLAG, R64_GRANULAR_FLAG, R63_ECG, R63_CL1_I3, R63_CL1_I_ROS, R63_CL1_I_EXAM, R63_CL2_I4, R63_CL3_C7 } from "../src/lib/r64-migration.js";
import { keyedCredit } from "../src/lib/ai-engine.js";

// node:sqlite is loaded through createRequire (see r63 test).
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");

const sum = (list) => list.reduce((s, i) => s + i.weight, 0);

describe("R64 checklist granularity", () => {
  it("keeps the checklist totals unchanged", () => {
    expect(sum(DEFAULT_CHECKLIST_1)).toBe(24);
    expect(sum(DEFAULT_CHECKLIST_2)).toBe(20);
    expect(sum(DEFAULT_CHECKLIST_3)).toBe(16);
  });

  it("gives every criterion at least two evidence groups, except the ECG criterion", () => {
    for (const list of [DEFAULT_CHECKLIST_1, DEFAULT_CHECKLIST_2, DEFAULT_CHECKLIST_3]) {
      for (const item of list) {
        if (item.id === "i4" && item.fa.includes("ECG")) continue;
        expect(item.keys.length, `${item.id} groups`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("the ECG criterion is one criterion with no urgency or timing words", () => {
    expect(R64_ECG.keys).toHaveLength(1);
    expect(R64_ECG.keys[0]).not.toMatch(/فوری|stat|urgent|soon|immediate|اولویت/i);
    expect(keyedCredit("نوار قلب می‌گیرم", R64_ECG.keys)).toBe(1);
    expect(keyedCredit("فوراً نوار قلب بگیرید", R64_ECG.keys)).toBe(1);
  });

  it("splits the history and exam criteria with partial credit", () => {
    const i3a = DEFAULT_CHECKLIST_1.find((i) => i.id === "i3a");
    expect(keyedCredit("دیابت دارید؟", i3a.keys)).toBe(0.5);
    expect(keyedCredit("دیابت دارید و فشار خون بالاست؟", i3a.keys)).toBe(1);
  });
});

function makeDb() {
  const raw = new DatabaseSync(":memory:");
  raw.exec(`CREATE TABLE checklists (id INTEGER PRIMARY KEY, owner_id INTEGER, name_en TEXT, items_json TEXT);
            CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);`);
  return {
    raw,
    prepare: (sql) => raw.prepare(sql),
    transaction: (fn) => () => {
      raw.exec("BEGIN");
      try { const out = fn(); raw.exec("COMMIT"); return out; } catch (e) { raw.exec("ROLLBACK"); throw e; }
    },
  };
}

describe("R64 migration", () => {
  it("replaces exact untouched R63 criteria, keeps edited ones, and runs once", () => {
    const db = makeDb();
    const r63Acs = [DEFAULT_CHECKLIST_1[0], DEFAULT_CHECKLIST_1[1], R63_CL1_I3, R63_CL1_I_ROS, R63_CL1_I_EXAM, R63_ECG];
    const edited = { ...R63_CL3_C7, fa: "متن ویرایش‌شده توسط مدرس" };
    db.raw.prepare("INSERT INTO checklists(id, name_en, items_json) VALUES (1, 'ACS', ?)").run(JSON.stringify(r63Acs));
    db.raw.prepare("INSERT INTO checklists(id, name_en, items_json) VALUES (2, 'Edited', ?)").run(JSON.stringify([edited]));

    const stats = migrateR64(db);
    expect(stats.ecg.checklists).toBe(1);
    expect(stats.granular.items).toBe(3);

    const acs = JSON.parse(db.raw.prepare("SELECT items_json FROM checklists WHERE id=1").get().items_json);
    expect(acs.map((i) => i.id)).toEqual(["i1", "i2", "i3a", "i3b", "i_ros_a", "i_ros_b", "i_exam_a", "i_exam_b", "i4"]);
    expect(acs.find((i) => i.id === "i4")).toEqual(R64_ECG);

    const kept = JSON.parse(db.raw.prepare("SELECT items_json FROM checklists WHERE id=2").get().items_json);
    expect(kept).toEqual([edited]);

    expect(migrateR64(db)).toEqual({ skipped: true });
    expect(db.raw.prepare("SELECT value FROM settings WHERE key=?").get(R64_FLAG)).toBeTruthy();
    expect(db.raw.prepare("SELECT value FROM settings WHERE key=?").get(R64_GRANULAR_FLAG)).toBeTruthy();
  });
});
