/* learn-topic-links.test.js (R88) — the learner routes expose the shared topic key that links
   flashcards to virtual-patient cases of the same subject. Route-level checks only; the
   mapping itself is covered by topic-key.test.js. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import { TOPIC_KEY_SET } from "../src/lib/topic-key.js";

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
