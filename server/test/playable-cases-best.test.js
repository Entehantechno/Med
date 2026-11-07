/* R89: playableCases() now reads every learner's best score per case in ONE grouped query
   (it used to run one query per case). This test pins the result to the old per-case
   reference for every playable case, including NULL scores and repeated attempts. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import { initDb, db } from "../src/db.js";

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  // Three learner-track cases (the seed alone has none).
  for (const [chief, topic] of [["Chest pain", "cardio"], ["Polyuria", "endo"], ["Dyspnea", "pulmo"]]) {
    const d = { track: "learn", chief_en: chief, chief_fa: chief, age: 50, sex: "male", difficulty: "medium", topic, specialty_en: "Cardiology", specialty_fa: "قلب", title_en: "t", title_fa: "t" };
    db.prepare("INSERT INTO cases (difficulty, checklist_id, data_json, active, university_id) VALUES ('medium', NULL, ?, 1, NULL)").run(JSON.stringify(d));
  }
});

describe("playableCases best-score batching (R89)", () => {
  it("matches the per-case MAX(score) reference for every case", async () => {
    const { playableCases } = await import("../src/lib/vpatient.js");
    const uid = db.prepare("SELECT id FROM users WHERE username='40012345'").get().id;
    const cases = playableCases("en", null);
    expect(cases.length).toBeGreaterThan(2);

    const ins = db.prepare("INSERT INTO attempts (user_id,type,case_id,score) VALUES (?,?,?,?)");
    const a = cases[0].id, b = cases[1].id;
    ins.run(uid, "case", a, 40);
    ins.run(uid, "case", a, 75);      // best for a = 75
    ins.run(uid, "case", b, null);    // unscored attempt only: best stays null
    const rows = playableCases("en", uid);
    const ref = db.prepare("SELECT MAX(score) AS best FROM attempts WHERE user_id=? AND case_id=?");
    for (const c of rows) {
      expect(c.best, `case ${c.id}`).toBe(ref.get(uid, c.id)?.best ?? null);
    }
    expect(rows.find((c) => c.id === a).best).toBe(75);
    expect(rows.find((c) => c.id === b).best).toBeNull();
  });

  it("anonymous calls return no personal best", async () => {
    const { playableCases } = await import("../src/lib/vpatient.js");
    expect(playableCases("fa", null).every((c) => c.best === null)).toBe(true);
  });

  it("the composite attempts index exists", () => {
    const idx = db.prepare("PRAGMA index_list(attempts)").all().map((r) => r.name);
    expect(idx).toContain("idx_attempts_user_case");
  });
});
