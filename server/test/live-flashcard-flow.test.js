/* Student flashcard path + real-time competition boards.
   - a student's class flashcard finish must change the live board at once
     (new ETag, 200 with the new score, 304 when nothing changed);
   - a student must not reach config/finish for a card that is not in their class;
   - the exam leaderboard reflects a new exam-flashcard result immediately. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { createApp } from "../src/app.js";
import { initDb, db } from "../src/db.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
async function token(u, p = "demo") { return (await login(u, p)).body.token; }
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

function mcqAnswer(card, idx) {
  return [{
    order: 1, card_id: card.id, type: "mcq", selectedIdx: idx,
    selected: [{ index: idx, fa: "", en: "" }], triedIdxs: [idx], solved: idx === card.options.findIndex((o) => o.correct),
    hintsUsed: 0, hintLevel: 0, correct: null, lang: "fa",
  }];
}

describe("student class flashcard path", () => {
  it("finish changes the live board immediately and the ETag follows", async () => {
    const ttk = await token("teacher");
    const stk = await token("40012345");
    const sid = db.prepare("SELECT id FROM users WHERE username='40012345'").get().id;
    const cls = await request(app).post("/api/classes").set(A(ttk)).send({ name_fa: "زنده", name_en: "live", maxAttempts: 3 });
    expect(cls.status).toBe(200);
    const cid = cls.body.id;
    expect((await request(app).put(`/api/classes/${cid}/members`).set(A(ttk)).send({ userIds: [sid] })).status).toBe(200);
    const uniCards = (await request(app).get("/api/flashcards").set(A(ttk))).body;
    const card = uniCards.find((c) => c.track === "uni" && Array.isArray(c.options) && c.options.length >= 2 && c.questionType !== "image");
    expect(card).toBeTruthy();
    expect((await request(app).put(`/api/classes/${cid}/flashcards`).set(A(ttk)).send({ flashcards: [{ flashcard_id: card.id }] })).status).toBe(200);

    const before = await request(app).get(`/api/classes/${cid}/live-board`).set(A(ttk));
    expect(before.status).toBe(200);
    const row0 = before.body.ranked.find((r) => r.user_id === sid);
    expect(row0.score).toBeNull();

    const wrong = card.options.findIndex((o) => !o.correct);
    const fin = await request(app).post(`/api/classes/${cid}/flashcard/${card.id}/finish`).set(A(stk))
      .send({ score: 0, durationSec: 5, answers: mcqAnswer(card, wrong) });
    expect(fin.status).toBe(200);
    expect(fin.body.score).toBe(0);

    const after = await request(app).get(`/api/classes/${cid}/live-board`).set(A(ttk)).set("If-None-Match", before.headers.etag);
    expect(after.status).toBe(200);
    expect(after.headers.etag).not.toBe(before.headers.etag);
    const row1 = after.body.ranked.find((r) => r.user_id === sid);
    expect(row1.done).toBe(1);
    expect(row1.score).toBe(0);

    const correct = card.options.findIndex((o) => o.correct);
    const fin2 = await request(app).post(`/api/classes/${cid}/flashcard/${card.id}/finish`).set(A(stk))
      .send({ score: 100, durationSec: 7, answers: mcqAnswer(card, correct) });
    expect(fin2.status).toBe(200);
    expect(fin2.body.score).toBe(100);
    const after2 = await request(app).get(`/api/classes/${cid}/live-board`).set(A(ttk));
    expect(after2.body.ranked.find((r) => r.user_id === sid).score).toBe(100);
    const same = await request(app).get(`/api/classes/${cid}/live-board`).set(A(ttk)).set("If-None-Match", after2.headers.etag);
    expect(same.status).toBe(304);
  });

  it("a student cannot read config or finish a card that is not in their class", async () => {
    const ttk = await token("teacher");
    const stk = await token("40067890");
    const cls = await request(app).post("/api/classes").set(A(ttk)).send({ name_fa: "خصوصی", name_en: "private", maxAttempts: 3 });
    const cid = cls.body.id;
    const uniCards = (await request(app).get("/api/flashcards").set(A(ttk))).body;
    const outside = uniCards.find((c) => c.track === "uni" && Array.isArray(c.options) && c.options.length >= 2);
    const cfg = await request(app).get(`/api/classes/${cid}/flashcard/${outside.id}/config`).set(A(stk));
    expect([403, 404]).toContain(cfg.status);
    const fin = await request(app).post(`/api/classes/${cid}/flashcard/${outside.id}/finish`).set(A(stk))
      .send({ score: 100, durationSec: 5, answers: mcqAnswer(outside, outside.options.findIndex((o) => o.correct)) });
    expect([403, 404]).toContain(fin.status);
  });

  it("exam leaderboard ranks a new exam-flashcard result immediately", async () => {
    const ttk = await token("teacher");
    const stk = await token("40022334");
    const sid = db.prepare("SELECT id FROM users WHERE username='40022334'").get().id;
    const card = (await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "LiveExamCard", title_fa: "کارت زنده آزمون",
      questionText_en: "q", questionText_fa: "س",
      options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }],
    })).body;
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Live LB", title_fa: "لیدربورد زنده", use_flashcards: true, flashcard_ids: [card.id],
      competition: true, starts_at: now, ends_at: end, duration_min: 20, max_attempts: 4,
    });
    expect(exam.status).toBe(200);
    expect((await request(app).put(`/api/exams/${exam.body.id}/participants`).set(A(ttk)).send({ studentNos: ["40022334"] })).status).toBe(200);
    const b0 = await request(app).get(`/api/exams/${exam.body.id}/leaderboard`).set(A(ttk));
    expect(b0.status).toBe(200);
    const r0 = b0.body.ranked.find((r) => r.user_id === sid);
    expect(r0.score).toBeNull();
    const res = await request(app).post("/api/exam/flashcard-result").set(A(stk)).send({
      examId: exam.body.id, score: 100, hints: 0, lang: "fa", total: 1, correct: 1, wrong: 0, durationSec: 5,
      answers: [{ order: 1, card_id: card.id, type: "mcq", selectedIdx: 0, selected: [{ index: 0, fa: "الف", en: "a" }],
        triedIdxs: [0], solved: true, hintsUsed: 0, hintLevel: 0, lang: "fa" }],
    });
    expect(res.status).toBe(200);
    const b1 = await request(app).get(`/api/exams/${exam.body.id}/leaderboard`).set(A(ttk)).set("If-None-Match", b0.headers.etag);
    expect(b1.status).toBe(200);
    expect(b1.body.ranked.find((r) => r.user_id === sid).score).toBe(100);
  });
});

describe("student answer reveal follows the show-correct policy", () => {
  it("honours reveal by default, refuses it when showCorrect is off, teachers keep it", async () => {
    const ttk = await token("teacher");
    const stk = await token("40033445");
    const atk = await token("admin");
    const card = (await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "RevealPolicy", title_fa: "سیاست پاسخ",
      questionText_en: "q", questionText_fa: "س",
      options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }],
    })).body;
    const ask = (tk) => request(app).post("/api/flashcards/check").set(A(tk))
      .send({ cardId: card.id, optionIndex: 1, type: "mcq", reveal: true });
    const dflt = await ask(stk);
    expect(dflt.status).toBe(200);
    expect(dflt.body.reveal).toEqual({ index: 0 });

    const put = await request(app).put("/api/settings/exam").set(A(atk)).send({ showCorrect: false, showHints: true });
    expect(put.status).toBe(200);
    const off = await ask(stk);
    expect(off.status).toBe(200);
    expect(off.body.reveal).toBeUndefined();
    const teacher = await ask(ttk);
    expect(teacher.body.reveal).toEqual({ index: 0 });

    await request(app).put("/api/settings/exam").set(A(atk)).send({ showCorrect: true, showHints: true });
    const back = await ask(stk);
    expect(back.body.reveal).toEqual({ index: 0 });
  });
});
