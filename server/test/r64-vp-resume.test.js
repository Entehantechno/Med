// Round 64: a student who leaves a virtual-patient encounter can resume it within the
// case time limit. After the deadline, further interaction is refused and the attempt is
// graded from the snapshot saved while the student was still working.
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import request from "supertest";
import { db, initDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { signToken } from "../src/lib/auth.js";
import { expireVpSessions } from "../src/lib/timed-expiry.js";

let app, student, classId;
const A = () => ({ Authorization: `Bearer ${student.token}` });
const sessionRow = (sid) => db.prepare("SELECT * FROM vp_sessions WHERE id=?").get(sid);
const transcriptOf = (attemptId) => db.prepare("SELECT transcript_json FROM attempts WHERE id=?").get(attemptId)?.transcript_json || "";

async function start() {
  const r = await request(app).post("/api/exam/session-start").set(A()).send({ caseId: 1, classId });
  expect(r.status).toBe(200);
  return r.body;
}
const save = (sid, marker) => request(app).put("/api/exam/session-progress").set(A()).send({
  sessionId: sid,
  progress: { messages: [{ role: "student", text: `${marker} سلام، درد از کی شروع شد؟` }], tests: [] },
});
const expireNow = (sid) => db.prepare("UPDATE vp_sessions SET deadline_ms=? WHERE id=?").run(Date.now() - 60000, sid);

beforeAll(async () => {
  execSync("node src/seed.js --force", { stdio: "ignore" });
  await initDb();
  app = createApp();
  const template = db.prepare("SELECT * FROM users WHERE username='40012345'").get();
  const id = db.prepare("INSERT INTO users(username,password_hash,role,name_en,university_id) VALUES (?,?,'student',?,?)")
    .run("resume-student", template.password_hash, "Resume Student", template.university_id).lastInsertRowid;
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(id);
  student = { ...u, token: signToken(u) };
  const teacher = db.prepare("SELECT id,university_id FROM users WHERE username='teacher'").get();
  // A timed class: 1 minute limit, so the deadline is set by the server.
  classId = db.prepare("INSERT INTO classes(name_en,code,owner_id,university_id,max_attempts,log_transcript,timer_enabled,timer_minutes) VALUES (?,?,?,?,100,1,1,1)")
    .run("Resume", `resume-${Date.now()}`, teacher.id, teacher.university_id).lastInsertRowid;
  db.prepare("INSERT INTO class_members(class_id,user_id) VALUES (?,?)").run(classId, student.id);
  db.prepare("INSERT INTO class_cases(class_id,case_id) VALUES (?,?)").run(classId, 1);
});

describe("R64 virtual-patient resume and expiry", () => {
  it("resumes the same open encounter with its saved progress and the server deadline", async () => {
    const first = await start();
    expect(first.deadlineMs).toBeGreaterThan(Date.now());
    expect(first.remainingSec).toBeGreaterThan(0);
    expect((await save(first.sessionId, "RESUME-MARK")).status).toBe(200);
    const left = await request(app).post("/api/exam/session-abandon").set(A()).send({ sessionId: first.sessionId });
    expect(left.body.resumable).toBe(true);

    const again = await start();
    expect(again.sessionId).toBe(first.sessionId);
    expect(again.resumed).toBe(true);
    expect(again.progress.messages[0].text).toContain("RESUME-MARK");
  });

  it("after the deadline refuses further interaction and grades the snapshot as it stood", async () => {
    const { sessionId } = await start();
    expect((await save(sessionId, "STORED-MARK")).status).toBe(200);
    expireNow(sessionId);

    // Interaction is refused once the time is up...
    expect((await save(sessionId, "LATE-MARK")).status).toBe(409);
    // ...and a late submit is graded from the stored snapshot, not from the client body.
    const graded = await request(app).post("/api/exam/evaluate").set(A()).send({
      caseId: 1, classId, sessionId, lang: "fa", durationSec: 5, events: [],
      session: { messages: [{ role: "student", text: "SUBMITTED-ONLY-MARK" }], tests: [] },
    });
    expect(graded.status).toBe(200);
    expect(graded.body.attemptId).toBeTruthy();
    const row = sessionRow(sessionId);
    expect(row.attempt_id).toBe(graded.body.attemptId);
    expect(row.finished_at).toBeTruthy();
    expect(transcriptOf(graded.body.attemptId)).toContain("STORED-MARK");
    expect(transcriptOf(graded.body.attemptId)).not.toContain("SUBMITTED-ONLY-MARK");
    expect(transcriptOf(graded.body.attemptId)).not.toContain("LATE-MARK");
  });

  it("the expiry sweeper finalizes an abandoned, expired encounter without the student", async () => {
    const { sessionId } = await start();
    expect((await save(sessionId, "SWEEP-MARK")).status).toBe(200);
    await request(app).post("/api/exam/session-abandon").set(A()).send({ sessionId });
    expireNow(sessionId);

    const out = await expireVpSessions();
    expect(out.finalized).toBeGreaterThanOrEqual(1);
    const row = sessionRow(sessionId);
    expect(row.attempt_id).toBeTruthy();
    expect(row.finished_at).toBeTruthy();
    expect(transcriptOf(row.attempt_id)).toContain("SWEEP-MARK");
  });

  it("a finalized encounter cannot be resumed; the next start is a new encounter", async () => {
    const finished = await start();
    expireNow(finished.sessionId);
    await expireVpSessions();
    const fresh = await start();
    expect(fresh.sessionId).not.toBe(finished.sessionId);
    expect(fresh.resumed).toBeFalsy();
  });

  it("refuses a bad requestId before any resume", async () => {
    await start();
    const bad = await request(app).post("/api/exam/session-start").set(A()).send({ caseId: 1, classId, requestId: { bad: true } });
    expect(bad.status).toBe(400);
  });
});

describe("R64 grace window and quick return after expiry", () => {
  it("accepts a save already in flight just after the deadline, then refuses later ones", async () => {
    const { sessionId } = await start();
    db.prepare("UPDATE vp_sessions SET deadline_ms=? WHERE id=?").run(Date.now() - 2000, sessionId);
    expect((await save(sessionId, "GRACE-MARK")).status).toBe(200);
    expireNow(sessionId);
    expect((await save(sessionId, "LATE-2-MARK")).status).toBe(409);
  });

  it("a return after expiry is held while the old encounter is graded in the background, then a fresh one opens", async () => {
    // Earlier tests may leave expired encounters pending; the server grades them first, as its sweep would.
    db.prepare("UPDATE vp_sessions SET next_try_ms=NULL WHERE user_id=? AND finished_at IS NULL").run(student.id);
    await expireVpSessions();
    const old = await start();
    expect((await save(old.sessionId, "BEFORE-EXPIRY-MARK")).status).toBe(200);
    expireNow(old.sessionId);
    // R101: the return does not wait for the old chat. The old one is graded in the background, and a
    // fresh encounter opens at once (an AI outage must not hold the student back).
    const held = await request(app).post("/api/exam/session-start").set(A()).send({ caseId: 1, classId });
    expect(held.status).toBe(200);
    expect(held.body.sessionId).not.toBe(old.sessionId);
    const deadline = Date.now() + 8000;
    // The old encounter is graded in the background; the fresh one stays open and is not waited for.
    const pendingLeft = () => db.prepare("SELECT COUNT(*) n FROM vp_sessions WHERE id=? AND finished_at IS NULL AND attempt_id IS NULL AND review_required=0").get(old.sessionId).n;
    while (pendingLeft() > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
    const row = sessionRow(old.sessionId);
    expect(row.attempt_id).toBeTruthy();
    expect(transcriptOf(row.attempt_id)).toContain("BEFORE-EXPIRY-MARK");
    // The student returns to the encounter that was opened while the old one was graded: it resumes.
    const fresh = await start();
    expect(fresh.sessionId).toBe(held.body.sessionId);
    expect(fresh.sessionId).not.toBe(old.sessionId);
    expect(fresh.resumed).toBe(true);
  });
});
