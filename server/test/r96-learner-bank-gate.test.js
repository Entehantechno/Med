/* r96-learner-bank-gate.test.js — R96 security + performance.
   GET /api/flashcards returned the whole competitive bank (~11.6k cards, ~91 MB) to a learner
   who is not premium, while /api/learn/browse/:id returned 402 for the same cards. Round 5 rule:
   browsing the whole bank is a premium perk, and a non-subscriber previews the three newest cards
   (lockedTeaserIds). Decision (owner, R96): a free learner's flashcard list is the three teasers
   only. The gate is conditional on the full_bank flag and the learner's premium state, exactly as
   /api/learn/browse is. Staff roles and students are not changed. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, initSchema, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import { setFlag } from "../src/lib/flags.js";
import { lockedTeaserIds, browsePoolSignature } from "../src/lib/bank-pool.js";

let app, learnerTk, studentTk;
const inserted = [];

const bankCard = (n) => JSON.stringify({
  track: "learn", type: "mcq", premium: true, q_fa: `سؤال آزمایشی ${n}`, q_en: `Fixture question ${n}`,
  title_fa: `عنوان ${n}`, title_en: `Title ${n}`, difficulty: "medium",
  options: [{ fa: "الف", en: "A", correct: true }, { fa: "ب", en: "B" }],
  explain: `توضیح ${n}`,
  source_meta: { kind: "past_exam_import", subject_fa: "داخلی", subject_en: "Internal Medicine", chapter_fa: "قلب", chapter_en: "Cardiology", year: "1400", sitting: "1", question_no: n },
});

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  initSchema();
  app = createApp();
  learnerTk = (await request(app).post("/api/auth/login").send({ username: "learner", password: "demo" })).body.token;
  studentTk = (await request(app).post("/api/auth/login").send({ username: "40012345", password: "demo" })).body.token;
  // Make sure the bank has more than three learn-track cards, so the gate is observable.
  const ins = db.prepare("INSERT INTO flashcards (data_json, active) VALUES (?, 1)");
  for (let i = 1; i <= 6; i++) inserted.push(Number(ins.run(bankCard(i)).lastInsertRowid));
});

afterAll(() => { setFlag("full_bank", true); });

const flashcards = (tk, qs = "") => request(app).get(`/api/flashcards${qs}`).set("Authorization", `Bearer ${tk}`);

describe("free learner flashcard list (R96)", () => {
  it("precondition: the learner is not premium and the bank has more than three cards", async () => {
    const browse = await request(app).get("/api/learn/browse?lang=fa&per=5").set("Authorization", `Bearer ${learnerTk}`);
    expect(browse.status).toBe(200);
    expect(browse.body.premiumRequired).toBe(true);
    setFlag("full_bank", false);
    const open = await flashcards(learnerTk);
    setFlag("full_bank", true);
    expect(open.status).toBe(200);
    expect(open.body.length).toBeGreaterThan(3);
  });

  it("returns only the three teaser cards to a free learner", async () => {
    const res = await flashcards(learnerTk);
    expect(res.status).toBe(200);
    const teasers = lockedTeaserIds();
    expect(teasers.length).toBe(3);
    expect(res.body.length).toBeLessThanOrEqual(3);
    for (const card of res.body) expect(teasers).toContain(card.id);
  });

  it("does not serve a non-teaser bank card by id to a free learner", async () => {
    const teasers = new Set(lockedTeaserIds());
    const other = inserted.find((id) => !teasers.has(id));
    expect(other).toBeTruthy();
    const res = await flashcards(learnerTk, `?ids=${other}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("is open again when the full_bank flag is off (same condition as /learn/browse)", async () => {
    setFlag("full_bank", false);
    const res = await flashcards(learnerTk);
    setFlag("full_bank", true);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(3);
  });

  it("keeps student lists free of bank cards (they still get the university list)", async () => {
    const res = await flashcards(studentTk);
    expect(res.status).toBe(200);
    for (const card of res.body) expect(card.track).not.toBe("learn");
  });

  it("keeps the bank signature stable for the teaser pool (browse cache key exists)", () => {
    expect(typeof browsePoolSignature()).toBe("string");
  });
});
