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
