// Round 64: flashcard runs resume prior progress instead of restarting, and an expired
// run is settled as it stood before a new run opens (never two runs for one clock).
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import request from "supertest";
import { db, initDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { signToken } from "../src/lib/auth.js";
import { expireFlashProgress } from "../src/lib/timed-expiry.js";

let app, student, classId;
const A = () => ({ Authorization: `Bearer ${student.token}` });
const key = () => `classcomb:${classId}`;
const rowOf = (runId) => db.prepare("SELECT * FROM flash_progress WHERE id=?").get(runId);
const expireRun = (runId) => db.prepare("UPDATE flash_progress SET deadline_ms=? WHERE id=?").run(Date.now() - 60000, runId);

beforeAll(async () => {
  execSync("node src/seed.js --force", { stdio: "ignore" });
  await initDb();
  app = createApp();
  const template = db.prepare("SELECT * FROM users WHERE username='40012345'").get();
  const id = db.prepare("INSERT INTO users(username,password_hash,role,name_en,university_id) VALUES (?,?,'student',?,?)")
    .run("flash-student", template.password_hash, "Flash Student", template.university_id).lastInsertRowid;
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(id);
  student = { ...u, token: signToken(u) };
  const teacher = db.prepare("SELECT id,university_id FROM users WHERE username='teacher'").get();
  classId = db.prepare("INSERT INTO classes(name_en,code,owner_id,university_id,max_attempts,log_transcript,timer_enabled,timer_minutes) VALUES (?,?,?,?,100,1,1,1)")
    .run("Flash resume", `flash-${Date.now()}`, teacher.id, teacher.university_id).lastInsertRowid;
  db.prepare("INSERT INTO class_members(class_id,user_id) VALUES (?,?)").run(classId, student.id);
});

describe("R64 flashcard resume", () => {
  it("opens a timed run with a server deadline", async () => {
    const r = await request(app).post("/api/exam/flash-session").set(A()).send({ contextKey: key() });
    expect(r.status).toBe(200);
    expect(r.body.resumed).toBe(false);
    expect(r.body.deadlineMs).toBeGreaterThan(Date.now());
    expect(r.body.remainingSec).toBeGreaterThan(0);
  });

  it("returns the saved progress on resume, not a restarted run", async () => {
    const first = await request(app).post("/api/exam/flash-session").set(A()).send({ contextKey: key() });
    const runId = first.body.runId;
    const saved = await request(app).put("/api/exam/flash-progress").set(A())
      .send({ runId, progress: { idx: 3, order: [7, 2, 9, 4], answers: [{ card_id: 7, solved: true }] } });
    expect(saved.status).toBe(200);

    const again = await request(app).post("/api/exam/flash-session").set(A()).send({ contextKey: key() });
    expect(again.body.runId).toBe(runId);
    expect(again.body.resumed).toBe(true);
    expect(again.body.progress.idx).toBe(3);
    expect(again.body.progress.order).toEqual([7, 2, 9, 4]);
  });

  it("refuses progress saves after the deadline", async () => {
    const r = await request(app).post("/api/exam/flash-session").set(A()).send({ contextKey: key() });
    expireRun(r.body.runId);
    const late = await request(app).put("/api/exam/flash-progress").set(A()).send({ runId: r.body.runId, progress: { idx: 9 } });
    expect(late.status).toBe(409);
    expect(late.body.error).toBe("session_expired");
  });

  it("settles an expired, unswept run before a new run opens, and records a failed settle", async () => {
    const old = await request(app).post("/api/exam/flash-session").set(A()).send({ contextKey: key() });
    expireRun(old.body.runId);
    const fresh = await request(app).post("/api/exam/flash-session").set(A()).send({ contextKey: key() });
    expect(fresh.status).toBe(200);
    expect(fresh.body.runId).not.toBe(old.body.runId);
    expect(fresh.body.resumed).toBe(false);
    // The old run is still open: its settle failed (no finish payload), so it is counted, not dropped.
    const oldRow = rowOf(old.body.runId);
    expect(oldRow.finished_at).toBeNull();
    expect(oldRow.expiry_attempts).toBeGreaterThanOrEqual(1);
    expect(oldRow.expiry_error).toBeTruthy();
  });

  it("the sweeper counts a failure and never silently drops the run", async () => {
    const r = await request(app).post("/api/exam/flash-session").set(A()).send({ contextKey: `classfc:${classId}:999999` });
    expect(r.status).toBe(200);
    expireRun(r.body.runId);
    const out = await expireFlashProgress();
    expect(out.failed).toBeGreaterThanOrEqual(1);
    expect(rowOf(r.body.runId).expiry_attempts).toBeGreaterThanOrEqual(1);
  });

  it("refuses a context key it does not understand", async () => {
    const r = await request(app).post("/api/exam/flash-session").set(A()).send({ contextKey: "drop table" });
    expect(r.status).toBe(400);
  });
});

// Successful settle of an expired, unswept run, and the stored-answer guard on finish.
function insertGradedCard() {
  const uni = db.prepare("SELECT university_id FROM classes WHERE id=?").get(classId).university_id;
  const data = {
    type: "mcq", title_en: "Settle", title_fa: "تسویه", questionText_en: "Q", questionText_fa: "پ",
    options: [{ en: "A", fa: "الف", correct: true }, { en: "B", fa: "ب", correct: false }],
  };
  const id = db.prepare("INSERT INTO flashcards(data_json,active,university_id) VALUES (?,1,?)")
    .run(JSON.stringify(data), uni).lastInsertRowid;
  db.prepare("INSERT INTO class_flashcards(class_id,flashcard_id,weight,graded) VALUES (?,?,1,1)").run(classId, id);
  return Number(id);
}
const attemptsFor = (cardId) => db.prepare(
  "SELECT score FROM class_flashcard_attempts WHERE class_id=? AND flashcard_id=? AND user_id=? ORDER BY id"
).all(classId, cardId, student.id);

describe("R64 flashcard settle on expiry (successful path)", () => {
  it("settles an expired, unswept run from its saved answers and records the graded attempt", async () => {
    const cardId = insertGradedCard();
    const ctx = `classfc:${classId}:${cardId}`;
    const first = await request(app).post("/api/exam/flash-session").set(A()).send({ contextKey: ctx });
    expect(first.status).toBe(200);
    const saved = await request(app).put("/api/exam/flash-progress").set(A())
      .send({ runId: first.body.runId, progress: { idx: 0, answers: [{ card_id: cardId, selectedIdx: 0 }] } });
    expect(saved.status).toBe(200);
    expireRun(first.body.runId);

    const fresh = await request(app).post("/api/exam/flash-session").set(A()).send({ contextKey: ctx });
    expect(fresh.status).toBe(200);
    expect(fresh.body.runId).not.toBe(first.body.runId);
    const oldRow = rowOf(first.body.runId);
    expect(oldRow.finished_at).not.toBeNull();
    expect(oldRow.expiry_error).toBeNull();
    const got = attemptsFor(cardId);
    expect(got.length).toBe(1);
    expect(got[0].score).toBe(100);
  });

  it("after expiry, a late finish is graded from the stored answers, not the browser copy", async () => {
    const cardId = insertGradedCard();
    const ctx = `classfc:${classId}:${cardId}`;
    const run = await request(app).post("/api/exam/flash-session").set(A()).send({ contextKey: ctx });
    await request(app).put("/api/exam/flash-progress").set(A())
      .send({ runId: run.body.runId, progress: { idx: 0, answers: [{ card_id: cardId, selectedIdx: 0 }] } });
    expireRun(run.body.runId);
    // The browser copy claims the wrong option; the stored correct answer must win.
    const late = await request(app).post(`/api/classes/${classId}/flashcard/${cardId}/finish`).set(A())
      .send({ answers: [{ card_id: cardId, selectedIdx: 1 }] });
    expect(late.status).toBe(200);
    expect(late.body.score).toBe(100);
    expect(attemptsFor(cardId).at(-1).score).toBe(100);
  });
});
