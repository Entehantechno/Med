/* ZIP 98: flashcard ?ids=, ETag 304 on live-board + exam LB, class/exam list batch. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { createApp } from "../src/app.js";
import { initDb } from "../src/db.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
async function token(u, p = "demo") { return (await login(u, p)).body.token; }
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

describe("GET /flashcards ids filter (keep full-bank default)", () => {
  it("student full GET still returns an array; ?ids= filters; junk → []", async () => {
    const ttk = await token("teacher");
    const created = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "SpeedIds", title_fa: "سرعت‌آیدی",
      questionText_en: "q", questionText_fa: "س",
      options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }],
    });
    expect(created.status).toBe(200);
    const stk = await token("40012345");
    const full = await request(app).get("/api/flashcards").set(A(stk));
    expect(full.status).toBe(200);
    expect(Array.isArray(full.body)).toBe(true);
    expect(full.body.length).toBeGreaterThan(0);
    const one = await request(app).get(`/api/flashcards?ids=${created.body.id}`).set(A(stk));
    expect(one.status).toBe(200);
    expect(one.body.every((c) => c.id === created.body.id)).toBe(true);
    const empty = await request(app).get("/api/flashcards?ids=").set(A(stk));
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual([]);
    const junk = await request(app).get("/api/flashcards?ids=nope,0,-1").set(A(stk));
    expect(junk.status).toBe(200);
    expect(junk.body).toEqual([]);
  });
});

describe("live-board and exam leaderboard ETag 304", () => {
  it("class live-board sends ETag and honors If-None-Match", async () => {
    const ttk = await token("teacher");
    const cls = await request(app).post("/api/classes").set(A(ttk))
      .send({ name_fa: "کلاس etag", name_en: "etag class", maxAttempts: 2 });
    expect(cls.status).toBe(200);
    const users = await request(app).get("/api/users?role=student").set(A(ttk));
    const list = Array.isArray(users.body) ? users.body : (users.body.users || []);
    const stu = list.find((u) => u.student_no === "40012345") || list[0];
    await request(app).put(`/api/classes/${cls.body.id}/members`).set(A(ttk)).send({ userIds: [stu.id] });
    const first = await request(app).get(`/api/classes/${cls.body.id}/live-board`).set(A(ttk));
    expect(first.status).toBe(200);
    const etag = first.headers.etag;
    expect(etag).toBeTruthy();
    expect(first.body.ranked).toBeTruthy();
    const again = await request(app).get(`/api/classes/${cls.body.id}/live-board`)
      .set(A(ttk)).set("If-None-Match", etag);
    expect(again.status).toBe(304);
  });

  it("exam competition leaderboard sends ETag and honors If-None-Match", async () => {
    const ttk = await token("teacher");
    const card = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "EtagFlash", title_fa: "etagفلش",
      questionText_en: "q", questionText_fa: "س",
      options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }],
    });
    expect(card.status).toBe(200);
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Etag LB", title_fa: "لیدربورد etag",
      use_flashcards: true, flashcard_ids: [card.body.id],
      competition: true, starts_at: now, ends_at: end, duration_min: 20, max_attempts: 4,
    });
    expect(exam.status).toBe(200);
    await request(app).put(`/api/exams/${exam.body.id}/participants`).set(A(ttk))
      .send({ studentNos: ["40012345"] });
    const first = await request(app).get(`/api/exams/${exam.body.id}/leaderboard`).set(A(ttk));
    expect(first.status).toBe(200);
    const etag = first.headers.etag;
    expect(etag).toBeTruthy();
    expect(Array.isArray(first.body.ranked)).toBe(true);
    const again = await request(app).get(`/api/exams/${exam.body.id}/leaderboard`)
      .set(A(ttk)).set("If-None-Match", etag);
    expect(again.status).toBe(304);
  });
});

describe("batched class list still reports nCases / nStudents", () => {
  it("GET /classes includes counts after IN-batch", async () => {
    const ttk = await token("teacher");
    const cse = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "CountCase", title_fa: "کیس‌شمار", chief_en: "x", chief_fa: "x" });
    expect(cse.status).toBe(200);
    const cls = await request(app).post("/api/classes").set(A(ttk))
      .send({ name_fa: "کلاس شمارش", name_en: "count class", maxAttempts: 2 });
    expect(cls.status).toBe(200);
    await request(app).put(`/api/classes/${cls.body.id}/cases`).set(A(ttk))
      .send({ cases: [{ case_id: cse.body.id, weight: 1 }] });
    const users = await request(app).get("/api/users?role=student").set(A(ttk));
    const list = Array.isArray(users.body) ? users.body : (users.body.users || []);
    const stu = list.find((u) => u.student_no === "40012345") || list[0];
    await request(app).put(`/api/classes/${cls.body.id}/members`).set(A(ttk)).send({ userIds: [stu.id] });
    const all = await request(app).get("/api/classes").set(A(ttk));
    expect(all.status).toBe(200);
    const row = (all.body || []).find((c) => c.id === cls.body.id);
    expect(row).toBeTruthy();
    expect(row.nCases).toBe(1);
    expect(row.nStudents).toBe(1);
  });
});
