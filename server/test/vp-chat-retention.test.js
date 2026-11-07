// A virtual-patient chat must never disappear because grading failed.
// (The full lifecycle, including retries, staff review and leaving, is in vp-lifecycle.test.js.)
// Before the fix, an expired encounter whose settlement failed stayed open, and the next
// start opened a NEW encounter: the saved chat vanished from the student's view, and no
// interaction log was written for the teacher.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { execSync } from "node:child_process";
import request from "supertest";
import { db, initDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { signToken } from "../src/lib/auth.js";
import { expireVpSessions } from "../src/lib/timed-expiry.js";

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

    // R101: an AI outage never restricts the student. A new encounter opens at once, and the old
    // chat stays a log that is still graded in the background (no attempt is spent until scored).
    const again = await start(classId);
    expect(again.status).toBe(200);
    expect(again.body.sessionId).not.toBe(first.sessionId);
    expect(row(first.sessionId).finished_at).toBeNull();
    expect(logCount(first.sessionId)).toBe(1);
  });
});
