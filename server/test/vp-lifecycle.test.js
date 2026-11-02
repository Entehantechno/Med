// R82: the lifecycle of one virtual-patient encounter, end to end.
// Promise under test: a chat that the student finished, or whose time ran out, is graded by
// the server and kept on record, whether the student stays, leaves, or never returns.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { execSync } from "node:child_process";
import request from "supertest";
import { db, initDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { signToken } from "../src/lib/auth.js";
import { expireVpSessions } from "../src/lib/timed-expiry.js";
import { backoffMs } from "../src/lib/vp-grading.js";

let app, student, teacher;
const A = () => ({ Authorization: `Bearer ${student.token}` });
const row = (sid) => db.prepare("SELECT * FROM vp_sessions WHERE id=?").get(sid);
const eventCount = (sid) => db.prepare("SELECT COUNT(*) n FROM vp_session_events WHERE session_id=?").get(sid).n;
const aiDown = () => { vi.stubEnv("VP_REQUIRE_AI_EVALUATION", "1"); vi.stubEnv("AI_API_KEY", ""); };
const aiUp = () => { vi.stubEnv("VP_REQUIRE_AI_EVALUATION", "0"); };
// Backoff would otherwise keep a failed encounter out of the next sweep; tests advance the clock.
const due = (sid) => db.prepare("UPDATE vp_sessions SET next_try_ms=NULL WHERE id=?").run(sid);
const expire = (sid) => db.prepare("UPDATE vp_sessions SET deadline_ms=? WHERE id=?").run(Date.now() - 60000, sid);

function setup(tag, logging) {
  const classId = db.prepare("INSERT INTO classes(name_en,code,owner_id,university_id,max_attempts,log_transcript,timer_enabled,timer_minutes) VALUES (?,?,?,?,100,?,1,1)")
    .run(`Lifecycle ${tag}`, `lc-${tag}-${Date.now()}`, teacher.id, teacher.university_id, logging ? 1 : 0).lastInsertRowid;
  db.prepare("INSERT INTO class_members(class_id,user_id) VALUES (?,?)").run(classId, student.id);
  db.prepare("INSERT INTO class_cases(class_id,case_id) VALUES (?,?)").run(classId, 1);
  return classId;
}
const start = (classId) => request(app).post("/api/exam/session-start").set(A()).send({ caseId: 1, classId });
const save = (sid, text) => request(app).put("/api/exam/session-progress").set(A()).send({
  sessionId: sid, events: [{ kind: "student_msg", atMs: 1000, text }],
  progress: { messages: [{ role: "student", text }], tests: [] },
});
// The student presses finish with the latest transcript in the body.
const finish = (classId, sid, text) => request(app).post("/api/exam/evaluate").set(A()).send({
  caseId: 1, classId, sessionId: sid, lang: "fa", durationSec: 60,
  session: { messages: [{ role: "student", text }], tests: [] },
  events: [{ kind: "student_msg", atMs: 1000, text }],
});

beforeAll(async () => {
  execSync("node src/seed.js --force", { stdio: "ignore" });
  await initDb();
  app = createApp();
  const t = db.prepare("SELECT * FROM users WHERE username='40012345'").get();
  const id = db.prepare("INSERT INTO users(username,password_hash,role,name_en,university_id) VALUES (?,?,'student',?,?)")
    .run("lifecycle-student", t.password_hash, "Lifecycle Student", t.university_id).lastInsertRowid;
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(id);
  student = { ...u, token: signToken(u) };
  teacher = db.prepare("SELECT id,university_id FROM users WHERE username='teacher'").get();
});

describe("finish is a commitment: the server completes it", () => {
  beforeEach(() => aiDown());
  afterEach(() => vi.unstubAllEnvs());

  it("freezes the chat when finish is pressed while AI is down, and says it is queued", async () => {
    const c = setup("freeze", true);
    const s = (await start(c)).body.sessionId;
    const res = await finish(c, s, "FREEZE-ME");
    expect(res.status).toBe(503);
    expect(res.body.queued).toBe(true);
    expect(res.body.message_en).toMatch(/queued/);
    const r = row(s);
    expect(r.finish_requested_ms).toBeTruthy();
    expect(r.finished_at).toBeNull();
    expect(r.attempt_id).toBeNull();
    // The body sent with finish is the record, even though no autosave ran.
    expect(String(r.progress_json)).toContain("FREEZE-ME");
    expect(eventCount(s)).toBe(1);
  });

  it("refuses further chat, autosave and abandon-saves once finish was pressed", async () => {
    const c = setup("locked", true);
    const s = (await start(c)).body.sessionId;
    await finish(c, s, "LOCK-ME");
    const before = row(s).progress_json;
    const chat = await request(app).post("/api/exam/patient-reply").set(A()).send({ caseId: 1, classId: c, sessionId: s, userText: "one more", lang: "fa" });
    expect(chat.status).toBe(409);
    expect(chat.body.error).toBe("finish_requested");
    const saved = await save(s, "AFTER-FINISH");
    expect(saved.status).toBe(409);
    expect(saved.body.error).toBe("finish_requested");
    const abandon = await request(app).post("/api/exam/session-abandon").set(A()).send({ sessionId: s, events: [{ kind: "student_msg", atMs: 5, text: "LEFT" }] });
    expect(abandon.body.resumable).toBe(false);
    expect(row(s).progress_json).toBe(before);   // the frozen snapshot did not change
  });

  it("grades the frozen chat later without the student, once AI is back", async () => {
    const c = setup("background", true);
    const s = (await start(c)).body.sessionId;
    await finish(c, s, "GRADE-LATER");
    // The student leaves. The sweep runs on the server alone.
    aiUp();
    due(s);
    const sweep = await expireVpSessions();
    expect(sweep.finalized).toBe(1);
    const r = row(s);
    expect(r.attempt_id).toBeTruthy();
    expect(r.finished_at).toBeTruthy();
    const attempt = db.prepare("SELECT transcript_json, eval_json FROM attempts WHERE id=?").get(r.attempt_id);
    expect(attempt.transcript_json).toContain("GRADE-LATER");   // logging on: the chat is kept
    expect(attempt.eval_json).toMatch(/microlearning/);
    expect(eventCount(s)).toBe(1);                               // logged once, not duplicated
    expect(r.grading_draft_json).toBeNull();
    expect(r.grading_lease_until).toBeNull();
  });

  it("keeps trying with backoff and never closes the chat", async () => {
    const c = setup("backoff", true);
    const s = (await start(c)).body.sessionId;
    await finish(c, s, "KEEP-TRYING");
    for (let i = 1; i <= 7; i++) {
      due(s);
      await expireVpSessions();
      const r = row(s);
      expect(r.finished_at).toBeNull();
      expect(r.attempt_id).toBeNull();
      // The student's own finish was the first failure; each sweep adds one more.
      expect(r.expiry_attempts).toBe(i + 1);
      expect(r.next_try_ms - Date.now()).toBeGreaterThan(backoffMs(i + 1) - 5000);
    }
    expect(row(s).review_required).toBe(0);
    // A student who opens the case again is told it is still being recorded, not sent a new encounter.
    const again = await start(c);
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("evaluation_in_progress");
    expect(db.prepare("SELECT COUNT(*) n FROM vp_sessions WHERE user_id=? AND class_id=? AND finished_at IS NULL").get(student.id, c).n).toBe(1);
  });

  it("keeps the chat of a logging-off class on record too (the teacher's list shows it)", async () => {
    const c = setup("nolog", false);
    const s = (await start(c)).body.sessionId;
    await finish(c, s, "NO-LOG-KEPT");
    for (let i = 0; i < 3; i++) { due(s); await expireVpSessions(); }
    const r = row(s);
    expect(r.finished_at).toBeNull();
    expect(String(r.progress_json)).toContain("NO-LOG-KEPT");
    const teacherRow = db.prepare("SELECT * FROM users WHERE username='teacher'").get();
    const T = { Authorization: `Bearer ${signToken(teacherRow)}` };
    const inbox = await request(app).get("/api/classes/conversations").set(T);
    const hit = inbox.body.unsettled.find((x) => x.session_id === s);
    expect(hit).toBeTruthy();
    expect(hit.status).toBe("queued");
    expect(hit.logging).toBe(false);
    expect(hit.events).toBeNull();
  });
});

describe("staff review and access", () => {
  beforeEach(() => aiDown());
  afterEach(() => vi.unstubAllEnvs());

  it("moves a permanent failure to staff review without closing it", async () => {
    const c = setup("review", true);
    const s = (await start(c)).body.sessionId;
    await finish(c, s, "NEEDS-REVIEW");
    // The student leaves the class: access is gone, which is not something a retry fixes.
    db.prepare("DELETE FROM class_members WHERE class_id=? AND user_id=?").run(c, student.id);
    aiUp();
    due(s);
    await expireVpSessions();
    const r = row(s);
    expect(r.review_required).toBe(1);
    expect(r.finished_at).toBeNull();
    expect(r.next_try_ms).toBeNull();
    expect(eventCount(s)).toBe(1);
    // Review rows are not retried, and the student is told plainly that nothing needs resending.
    const sweep = await expireVpSessions();
    expect(sweep.finalized + sweep.failed + sweep.deferred).toBe(0);
    const again = await finish(c, s, "RESEND");
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("under_staff_review");
    expect(again.body.retryable).toBe(false);
  });
});

describe("leaving and returning", () => {
  beforeEach(() => aiUp());
  afterEach(() => vi.unstubAllEnvs());

  it("returns to the same encounter with its chat, before the deadline", async () => {
    const c = setup("return", true);
    const s = (await start(c)).body.sessionId;
    await save(s, "BEFORE-LEAVE");
    await request(app).post("/api/exam/session-abandon").set(A()).send({ sessionId: s, events: [] });
    const back = await start(c);
    expect(back.status).toBe(200);
    expect(back.body.sessionId).toBe(s);
    expect(back.body.resumed).toBe(true);
    expect(JSON.stringify(back.body.progress)).toContain("BEFORE-LEAVE");
  });

  it("grades a timed-out encounter the student never came back to, with the chat kept", async () => {
    const c = setup("timeout", true);
    const s = (await start(c)).body.sessionId;
    await save(s, "TIMED-OUT");
    expire(s);
    const sweep = await expireVpSessions();
    expect(sweep.finalized).toBe(1);
    const r = row(s);
    expect(r.attempt_id).toBeTruthy();
    const attempt = db.prepare("SELECT transcript_json FROM attempts WHERE id=?").get(r.attempt_id);
    expect(attempt.transcript_json).toContain("TIMED-OUT");
  });

  it("a pending timed-out encounter is graded once, even when two sweeps overlap", async () => {
    const c = setup("overlap", true);
    const s = (await start(c)).body.sessionId;
    await save(s, "ONCE");
    expire(s);
    const [a, b] = await Promise.all([expireVpSessions(), expireVpSessions()]);
    expect(a.finalized + b.finalized).toBe(1);
    const n = db.prepare("SELECT COUNT(*) n FROM attempts WHERE id=?").get(row(s).attempt_id).n;
    expect(n).toBe(1);
  });
});
