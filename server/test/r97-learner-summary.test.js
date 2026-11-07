/* r97-learner-summary.test.js — R97 payload for learners (owner approved, 2026-11-07).
   A learner's Flashcards deck picker needs only id, topic and the category/course labels for every
   card. Full bodies (about 6 KB each) are needed only for the deck the learner starts, and that is
   already served by GET /api/flashcards?ids=. So GET /api/flashcards?summary=1 returns the light
   rows for learners, with exactly the same set of cards as the full list (teaser gate, demo cards
   excluded, corrupt rows skipped). Other roles ignore the parameter. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, initSchema, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import { setFlag } from "../src/lib/flags.js";

let app, learnerTk, learnerId, studentTk;
const bankCard = (n, extra = {}) => JSON.stringify({
  track: "learn", type: "mcq", premium: true, q_fa: `سؤال ${n}`, q_en: `Summary question ${n}`,
  title_fa: `عنوان ${n}`, title_en: `Title ${n}`, difficulty: "medium", topic: `topic-${n % 3}`,
  options: [{ fa: "الف", en: "A", correct: true }, { fa: "ب", en: "B" }], explain: `توضیح ${n}`,
  source_meta: { kind: "past_exam_import", subject_fa: "داخلی", subject_en: "Internal Medicine", year: "1400", sitting: "1", question_no: n },
  ...extra,
});

const SUMMARY_KEYS = new Set(["id", "topic", "category", "category_fa", "category_en", "course", "course_fa", "course_en"]);

const list = (tk, qs = "") => request(app).get(`/api/flashcards${qs}`).set("Authorization", `Bearer ${tk}`);

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  initSchema();
  app = createApp();
  learnerTk = (await request(app).post("/api/auth/login").send({ username: "learner", password: "demo" })).body.token;
  studentTk = (await request(app).post("/api/auth/login").send({ username: "40012345", password: "demo" })).body.token;
  learnerId = db.prepare("SELECT id FROM users WHERE username='learner'").get().id;
  const ins = db.prepare("INSERT INTO flashcards (data_json, active) VALUES (?, 1)");
  for (let i = 1; i <= 6; i++) ins.run(bankCard(i, i === 2 ? { category_fa: "نوار قلب", category_en: "ECG", course_fa: "قلب و عروق", course_en: "Cardiology" } : {}));
  // A demo seed card in the bank must stay out of the learner list, the summary included.
  ins.run(bankCard(90, { content_origin: "demo_seed" }));
});

function setPremium(on) {
  db.prepare("INSERT OR IGNORE INTO learner_profiles (user_id) VALUES (?)").run(learnerId);
  db.prepare(on
    ? "UPDATE learner_profiles SET premium=1, premium_until=datetime('now','+30 days') WHERE user_id=?"
    : "UPDATE learner_profiles SET premium=0, premium_until=NULL WHERE user_id=?").run(learnerId);
}

describe("learner deck summary (R97)", () => {
  it("premium learner: summary items carry only the picker fields, no card bodies", async () => {
    setPremium(true);
    setFlag("full_bank", true);
    const res = await list(learnerTk, "?summary=1");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(3);
    for (const item of res.body) {
      for (const k of Object.keys(item)) expect(SUMMARY_KEYS.has(k), `unexpected key ${k}`).toBe(true);
      expect(item).not.toHaveProperty("questionText_fa");
      expect(item).not.toHaveProperty("options");
      expect(item).not.toHaveProperty("data_json");
    }
  });

  it("premium learner: summary lists exactly the same cards as the full list, in the same order", async () => {
    setPremium(true);
    const full = await list(learnerTk);
    const summary = await list(learnerTk, "?summary=1");
    expect(summary.body.map((c) => c.id)).toEqual(full.body.map((c) => c.id));
  });

  it("summary carries the topic and the category/course labels the picker groups by", async () => {
    setPremium(true);
    const full = await list(learnerTk);
    const summary = await list(learnerTk, "?summary=1");
    for (const s of summary.body) {
      const f = full.body.find((c) => c.id === s.id);
      expect(s.topic).toBe(f.topic);
      expect(s.category_fa).toBe(f.category_fa);
      expect(s.course_en).toBe(f.course_en);
    }
    const ecg = summary.body.find((c) => c.category_en === "ECG");
    expect(ecg).toBeTruthy();
    expect(ecg.course_en).toBe("Cardiology");
  });

  it("demo seed cards are excluded from the summary, exactly as from the full list", async () => {
    setPremium(true);
    const demo = db.prepare("SELECT id FROM flashcards WHERE data_json LIKE '%demo_seed%' LIMIT 1").get();
    expect(demo).toBeTruthy();
    const summary = await list(learnerTk, "?summary=1");
    expect(summary.body.map((c) => c.id)).not.toContain(demo.id);
    const full = await list(learnerTk);
    expect(full.body.map((c) => c.id)).not.toContain(demo.id);
  });

  it("free learner: summary is the three teasers only, same as the full list", async () => {
    setPremium(false);
    setFlag("full_bank", true);
    const full = await list(learnerTk);
    const summary = await list(learnerTk, "?summary=1");
    expect(summary.status).toBe(200);
    expect(summary.body.length).toBeLessThanOrEqual(3);
    expect(summary.body.map((c) => c.id)).toEqual(full.body.map((c) => c.id));
  });

  it("the full body of a summary card is fetched by ids and matches the full list", async () => {
    setPremium(true);
    const summary = await list(learnerTk, "?summary=1");
    const ids = summary.body.slice(0, 3).map((c) => c.id);
    const bodies = await list(learnerTk, `?ids=${ids.join(",")}`);
    const full = await list(learnerTk);
    expect(bodies.body.map((c) => c.id)).toEqual(ids);
    for (const b of bodies.body) {
      expect(b).toEqual(full.body.find((c) => c.id === b.id));
    }
  });

  it("the summary follows a bank change (new card appears without a restart)", async () => {
    setPremium(true);
    const before = (await list(learnerTk, "?summary=1")).body.length;
    const id = Number(db.prepare("INSERT INTO flashcards (data_json, active) VALUES (?, 1)").run(bankCard(77)).lastInsertRowid);
    const after = await list(learnerTk, "?summary=1");
    expect(after.body.length).toBe(before + 1);
    expect(after.body.map((c) => c.id)).toContain(id);
  });

  it("other roles ignore summary=1 and keep the full list", async () => {
    const plain = await list(studentTk);
    const withFlag = await list(studentTk, "?summary=1");
    expect(withFlag.status).toBe(200);
    expect(withFlag.body.length).toBe(plain.body.length);
  });
});
