/* learn-topic-links.test.js (R88) — the learner routes expose the shared topic key that links
   flashcards to virtual-patient cases of the same subject. Route-level checks only; the
   mapping itself is covered by topic-key.test.js. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import { TOPIC_KEY_SET } from "../src/lib/topic-key.js";
import { universityOnlyCases } from "../src/lib/content-identity.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
async function token(u, p = "demo") { return (await login(u, p)).body.token; }
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
  // Learner-track cases come from the admin VP library (the seed alone has none).
  const atk = await token("admin");
  await request(app).post("/api/admin/vpatient/import-cases").set(A(atk)).send({ ids: [1, 2, 3, 4, 5] });
  const n = db.prepare("SELECT COUNT(*) n FROM cases WHERE json_extract(data_json,'$.track')='learn'").get().n;
  if (!n) throw new Error("test setup: no learner-track cases were imported");
});

describe("learner virtual-patient list carries the topic key", () => {
  it("every playable case has a topic key (known or empty) and a label", async () => {
    const atk = await token("admin");
    await request(app).put("/api/admin/vpatient").set(A(atk))
      .send({ config: { enabled: true, premium_only: false, in_path: true, in_daily: true, daily_gems: 15 } });
    const res = await request(app).get("/api/learn/vpatient?lang=en").set(A(await token("learner")));
    expect(res.status).toBe(200);
    expect(res.body.cases.length).toBeGreaterThan(0);
    expect(res.body.cases.some((c) => c.topic)).toBe(true);   // at least one case links to a subject
    for (const c of res.body.cases) {
      expect(typeof c.topic).toBe("string");
      expect(c.topic === "" || TOPIC_KEY_SET.has(c.topic)).toBe(true);
      expect(typeof c.topic_label).toBe("string");
      if (!c.topic) expect(c.topic_label).toBe("");
    }
    // The seeded cardiology case must link to the cardiology subject, not stay unlinked.
    const cardio = res.body.cases.find((c) => /cardio|heart|قلب/i.test(`${c.specialty} ${c.chief}`));
    if (cardio) expect(cardio.topic).toBe("cardio");
  });
});

describe("learner flashcard list carries the topic key", () => {
  it("every learner card has a topic key field, and some cards are linked to a subject", async () => {
    const res = await request(app).get("/api/flashcards").set(A(await token("learner")));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const c of res.body) {
      expect(typeof c.topic).toBe("string");
      expect(c.topic === "" || TOPIC_KEY_SET.has(c.topic)).toBe(true);
    }
    expect(res.body.some((c) => c.topic)).toBe(true);
  });

  it("the topic key never carries answers", async () => {
    const res = await request(app).get("/api/flashcards").set(A(await token("learner")));
    for (const c of res.body) {
      expect(c.correct_index).toBeUndefined();
      expect(c.answer).toBeUndefined();
    }
  });
});

// Self-contained fixtures: the shared test DATA_DIR is not reset between files, so these
// tests insert their own learner-track rows instead of relying on what a seed left behind.
function insertLearnCase(extra = {}) {
  const d = {
    track: "learn", specialty_en: "Internal Medicine - Emergency", specialty_fa: "طب داخلی - اورژانس",
    chief_en: "Chest pain", chief_fa: "درد قفسه سینه", age: 58, sex: "male", difficulty: "medium",
    topic: "cardio", ...extra,
  };
  return Number(db.prepare("INSERT INTO cases (difficulty, checklist_id, data_json, active, university_id) VALUES ('medium', NULL, ?, 1, NULL)")
    .run(JSON.stringify(d)).lastInsertRowid);
}
const learnerId = () => db.prepare("SELECT id FROM users WHERE username='learner'").get().id;

describe("a generic-specialty case reveals its topic only after a scored attempt (R88)", () => {
  it("hides the topic before any attempt, and fails closed without a user", async () => {
    const { playableCases } = await import("../src/lib/vpatient.js");
    const caseId = insertLearnCase();
    const uid = learnerId();
    const generic = playableCases("en", uid).find((c) => c.id === caseId);
    expect(generic.specialty).toBe("Internal Medicine - Emergency");
    expect(generic.topic).toBe("");
    expect(generic.topic_label).toBe("");
    expect(playableCases("en", null).find((c) => c.id === caseId).topic).toBe("");
  });

  it("shows the topic once the learner has a scored attempt, and never for an unscored one", async () => {
    const { playableCases } = await import("../src/lib/vpatient.js");
    const caseId = insertLearnCase();
    const uid = learnerId();
    // An unscored row (a started session, no evaluation) must not reveal the topic.
    db.prepare("INSERT INTO attempts (user_id,type,case_id,score) VALUES (?,?,?,NULL)").run(uid, "vp", caseId);
    expect(playableCases("en", uid).find((c) => c.id === caseId).topic).toBe("");
    // A scored attempt (written when evaluation finishes) reveals it.
    db.prepare("INSERT INTO attempts (user_id,type,case_id,score) VALUES (?,?,?,?)").run(uid, "vp", caseId, 70);
    const after = playableCases("en", uid).find((c) => c.id === caseId);
    expect(after.topic).toBe("cardio");
    expect(after.topic_label).toBe("Cardiology");
  });

  it("a case whose specialty already names the subject is shown at once", async () => {
    const { playableCases } = await import("../src/lib/vpatient.js");
    const caseId = insertLearnCase({ specialty_en: "Cardiology", specialty_fa: "قلب" });
    expect(playableCases("en", learnerId()).find((c) => c.id === caseId).topic).toBe("cardio");
  });
});

// R88: a competitive clone (track=learn) must survive a boot. Kept in this file, the only one
// that seeds and imports this flow: a second seeding file breaks the shared DATA_DIR setup.
describe("competitive clones survive a boot", () => {
  it("a learn-track clone keeps its track and tenant when the boot-time pass runs", () => {
    const caseId = insertLearnCase({ competitive: true });
    universityOnlyCases(db);     // what initDb() does on every start
    const row = db.prepare("SELECT data_json, university_id, active FROM cases WHERE id=?").get(caseId);
    expect(JSON.parse(row.data_json).track).toBe("learn");
    expect(row.university_id).toBeNull();
    expect(row.active).toBe(1);
  });

  it("the pass only runs when explicitly enabled", () => {
    const caseId = insertLearnCase({ competitive: true });
    db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('university_only_cases_v1','1')").run();
    try {
      universityOnlyCases(db);
      expect(JSON.parse(db.prepare("SELECT data_json FROM cases WHERE id=?").get(caseId).data_json).track).toBe("uni");
    } finally {
      db.prepare("DELETE FROM settings WHERE key='university_only_cases_v1'").run();
    }
  });
});
