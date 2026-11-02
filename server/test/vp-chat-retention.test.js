// A virtual-patient chat must never disappear because grading failed.
// Before the fix, an expired encounter whose settlement failed stayed open, and the next
// start opened a NEW encounter: the saved chat vanished from the student's view, and no
// interaction log was written for the teacher.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { execSync } from "node:child_process";
import request from "supertest";
import { db, initDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { signToken } from "../src/lib/auth.js";
import { expireVpSessions, MAX_SETTLE_TRIES } from "../src/lib/timed-expiry.js";

let app, student, teacher;
const A = () => ({ Authorization: `Bearer ${student.token}` });
const row = (sid) => db.prepare("SELECT * FROM vp_sessions WHERE id=?").get(sid);
const logCount = (sid) => db.prepare("SELECT COUNT(*) n FROM vp_session_events WHERE session_id=?").get(sid).n;
const newClass = (tag) => db.prepare("INSERT INTO classes(name_en,code,owner_id,university_id,max_attempts,log_transcript,timer_enabled,timer_minutes) VALUES (?,?,?,?,100,1,1,1)")
  .run(`Retention ${tag}`, `ret-${tag}-${Date.now()}`, teacher.id, teacher.university_id).lastInsertRowid;

async function start(classId) {
  return request(app).post("/api/exam/session-start").set(A()).send({ caseId: 1, classId });
}
const save = (sid, marker) => request(app).put("/api/exam/session-progress").set(A()).send({
  sessionId: sid,
  events: [{ kind: "student_msg", atMs: 1000, text: `${marker} سلام` }],
  progress: { messages: [{ role: "student", text: `${marker} سلام` }], tests: [] },
});
const expire = (sid, attempts = 0) => db.prepare("UPDATE vp_sessions SET deadline_ms=?, expiry_attempts=? WHERE id=?")
  .run(Date.now() - 60000, attempts, sid);

beforeAll(async () => {
  execSync("node src/seed.js --force", { stdio: "ignore" });
  await initDb();
  app = createApp();
  const template = db.prepare("SELECT * FROM users WHERE username='40012345'").get();
  const id = db.prepare("INSERT INTO users(username,password_hash,role,name_en,university_id) VALUES (?,?,'student',?,?)")
    .run("retention-student", template.password_hash, "Retention Student", template.university_id).lastInsertRowid;
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(id);
  student = { ...u, token: signToken(u) };
  teacher = db.prepare("SELECT id,university_id FROM users WHERE username='teacher'").get();
});

describe("virtual-patient chat survives a failed settlement", () => {
  // Production requires AI grading. Without a provider key the settlement returns 503,
  // which the expiry sweeper counts as a failed attempt.
  beforeEach(() => { vi.stubEnv("VP_REQUIRE_AI_EVALUATION", "1"); vi.stubEnv("AI_API_KEY", ""); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("keeps the chat as a log and does not open a new encounter over it", async () => {
    const classId = newClass("a");
    db.prepare("INSERT INTO class_members(class_id,user_id) VALUES (?,?)").run(classId, student.id);
    db.prepare("INSERT INTO class_cases(class_id,case_id) VALUES (?,?)").run(classId, 1);
    const first = (await start(classId)).body;
    expect((await save(first.sessionId, "KEEP-ME")).status).toBe(200);
    expire(first.sessionId);

    const sweep = await expireVpSessions();
    expect(sweep.failed).toBeGreaterThanOrEqual(1);
    // The chat is preserved as a log right away, before any retry is spent.
    expect(logCount(first.sessionId)).toBe(1);
    expect(row(first.sessionId).finished_at).toBeNull();          // still eligible for grading

    // The student is told to wait; no second encounter is created.
    const again = await start(classId);
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("evaluation_in_progress");
    expect(again.body.retryable).toBe(true);
    const open = db.prepare("SELECT COUNT(*) n FROM vp_sessions WHERE user_id=? AND class_id=? AND finished_at IS NULL").get(student.id, classId).n;
    expect(open).toBe(1);
  });

  it("closes an encounter once its retries are spent, keeping the log", async () => {
    const classId = newClass("b");
    db.prepare("INSERT INTO class_members(class_id,user_id) VALUES (?,?)").run(classId, student.id);
    db.prepare("INSERT INTO class_cases(class_id,case_id) VALUES (?,?)").run(classId, 1);
    const first = (await start(classId)).body;
    expect((await save(first.sessionId, "LOG-ME")).status).toBe(200);
    expire(first.sessionId, MAX_SETTLE_TRIES - 1);
    await expireVpSessions();                                      // the last allowed try fails
    const r = row(first.sessionId);
    expect(r.finished_at).toBeTruthy();                            // closed: no longer an open orphan
    expect(r.attempt_id).toBeNull();                               // unscored, but kept
    expect(logCount(first.sessionId)).toBe(1);
    // After closing, the student may start a fresh encounter in the same class.
    expect((await start(classId)).status).toBe(200);
  });

  it("grades later without duplicating the log when the provider recovers", async () => {
    const classId = newClass("c");
    db.prepare("INSERT INTO class_members(class_id,user_id) VALUES (?,?)").run(classId, student.id);
    db.prepare("INSERT INTO class_cases(class_id,case_id) VALUES (?,?)").run(classId, 1);
    const first = (await start(classId)).body;
    expect((await save(first.sessionId, "LATER-OK")).status).toBe(200);
    expire(first.sessionId);
    await expireVpSessions();                                     // provider down: preserved, not graded
    expect(logCount(first.sessionId)).toBe(1);

    vi.stubEnv("VP_REQUIRE_AI_EVALUATION", "0");                  // provider back
    const sweep = await expireVpSessions();
    expect(sweep.finalized).toBeGreaterThanOrEqual(1);
    const r = row(first.sessionId);
    expect(r.attempt_id).toBeTruthy();
    expect(r.finished_at).toBeTruthy();
    expect(logCount(first.sessionId)).toBe(1);                    // replaced, not appended
  });

  it("lists an unsettled chat in the teacher inbox and records attempt deletions", async () => {
    const classId = newClass("d");
    db.prepare("INSERT INTO class_members(class_id,user_id) VALUES (?,?)").run(classId, student.id);
    db.prepare("INSERT INTO class_cases(class_id,case_id) VALUES (?,?)").run(classId, 1);
    const first = (await start(classId)).body;
    expect((await save(first.sessionId, "INBOX-ME")).status).toBe(200);
    expire(first.sessionId);
    await expireVpSessions();

    const teacherRow = db.prepare("SELECT * FROM users WHERE username='teacher'").get();
    const T = { Authorization: `Bearer ${signToken(teacherRow)}` };
    const inbox = await request(app).get("/api/classes/conversations").set(T);
    expect(inbox.status).toBe(200);
    const hit = inbox.body.unsettled.find((x) => x.session_id === first.sessionId);
    expect(hit).toBeTruthy();
    expect(hit.events).toBe(1);
    expect(hit.closed).toBe(false);

    // Deleting a graded attempt leaves a named trace in the audit log.
    const attemptId = db.prepare("INSERT INTO attempts (user_id,type,case_id,class_id,score,eval_json) VALUES (?,?,?,?,?,?)")
      .run(student.id, "vp", 1, classId, 10, "{}").lastInsertRowid;
    const del = await request(app).delete(`/api/reports/attempts/${attemptId}`).set(T);
    expect(del.status).toBe(200);
    const trace = db.prepare("SELECT action FROM audit_log WHERE action='attempt.delete' AND resource=?").get(`attempts:${attemptId}`);
    expect(trace).toBeTruthy();
  });
});
