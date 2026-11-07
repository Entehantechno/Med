// R101 — an AI outage must never restrict a student.
// Promise under test (owner rule): when the AI is down, no student is blocked from starting,
// resuming, saving, or leaving, not even on the same case. A pending grade delays the score, never
// access. The attempt budget is still exact: an encounter spends an attempt only when it is scored,
// and the scoring path re-checks the budget, so the first scored encounter takes it and any surplus
// is kept on record for staff without a second AI call.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { execSync } from "node:child_process";
import request from "supertest";
import { db, initDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { signToken } from "../src/lib/auth.js";
import { expireVpSessions } from "../src/lib/timed-expiry.js";
import { backoffMs, retryDelayMs } from "../src/lib/vp-grading.js";
import { acquireCompletion, completionKey } from "../src/lib/vp-completion.js";

let app, student, teacher;
const A = () => ({ Authorization: `Bearer ${student.token}` });
const row = (sid) => db.prepare("SELECT * FROM vp_sessions WHERE id=?").get(sid);
// AI down: the lab/production path with no key and the grading requirement on.
const aiDown = () => { vi.stubEnv("VP_REQUIRE_AI_EVALUATION", "1"); vi.stubEnv("AI_API_KEY", ""); };
// AI back: the same handler grades (mock scoring, as in the other lifecycle tests).
const aiUp = () => { vi.stubEnv("VP_REQUIRE_AI_EVALUATION", "0"); };
const due = (sid) => db.prepare("UPDATE vp_sessions SET next_try_ms=NULL WHERE id=?").run(sid);
const expire = (sid) => db.prepare("UPDATE vp_sessions SET deadline_ms=? WHERE id=?").run(Date.now() - 60000, sid);

function setup(tag, maxAttempts = 100) {
  const classId = db.prepare("INSERT INTO classes(name_en,code,owner_id,university_id,max_attempts,log_transcript,timer_enabled,timer_minutes) VALUES (?,?,?,?,?,1,1,1)")
    .run(`R101 ${tag}`, `r101-${tag}-${Date.now()}`, teacher.id, teacher.university_id, maxAttempts).lastInsertRowid;
  db.prepare("INSERT INTO class_members(class_id,user_id) VALUES (?,?)").run(classId, student.id);
  db.prepare("INSERT INTO class_cases(class_id,case_id) VALUES (?,?)").run(classId, 1);
  return classId;
}
const start = (classId) => request(app).post("/api/exam/session-start").set(A()).send({ caseId: 1, classId });
const save = (sid, text) => request(app).put("/api/exam/session-progress").set(A()).send({
  sessionId: sid, events: [{ kind: "student_msg", atMs: 1000, text }],
  progress: { messages: [{ role: "student", text }], tests: [] },
});
const leave = (sid) => request(app).post("/api/exam/session-abandon").set(A()).send({ sessionId: sid, events: [] });
const finish = (classId, sid, text) => request(app).post("/api/exam/evaluate").set(A()).send({
  caseId: 1, classId, sessionId: sid, lang: "fa", durationSec: 60,
  session: { messages: [{ role: "student", text }], tests: [] },
  events: [{ kind: "student_msg", atMs: 1000, text }],
});
const attemptsIn = (classId) => db.prepare("SELECT COUNT(*) n FROM attempts WHERE user_id=? AND class_id=? AND case_id=1").get(student.id, classId).n;

beforeAll(async () => {
  execSync("node src/seed.js --force", { stdio: "ignore" });
  await initDb();
  app = createApp();
  const t = db.prepare("SELECT * FROM users WHERE username='40012345'").get();
  const id = db.prepare("INSERT INTO users(username,password_hash,role,name_en,university_id) VALUES (?,?,'student',?,?)")
    .run("r101-student", t.password_hash, "R101 Student", t.university_id).lastInsertRowid;
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(id);
  student = { ...u, token: signToken(u) };
  teacher = db.prepare("SELECT id,university_id FROM users WHERE username='teacher'").get();
});

afterEach(() => vi.unstubAllEnvs());

describe("AI outage: a pending encounter restricts nothing", () => {
  beforeEach(() => aiDown());

  it("a student whose finish is queued can start a new encounter on the same case and keep working", async () => {
    const c = setup("open-after-queue");
    const first = (await start(c)).body.sessionId;
    expect((await save(first, "FIRST")).status).toBe(200);
    const queued = await finish(c, first, "FIRST");
    expect(queued.status).toBe(503);
    expect(queued.body.queued).toBe(true);

    const second = await start(c);
    expect(second.status).toBe(200);
    expect(second.body.sessionId).not.toBe(first);
    expect((await save(second.body.sessionId, "SECOND")).status).toBe(200);
    expect((await leave(second.body.sessionId)).status).toBe(200);
    // The queued chat is still on record and still waiting for grading.
    expect(row(first).finished_at).toBeNull();
    expect(row(first).review_required).toBe(0);
  });

  it("a grading run in flight for one encounter does not block saves or leaving on another", async () => {
    const c = setup("lock");
    const first = (await start(c)).body.sessionId;
    expect((await finish(c, first, "LOCKED")).status).toBe(503);
    const second = (await start(c)).body.sessionId;
    // Simulate the first encounter's grading holding its lock while the AI is slow or down.
    const release = acquireCompletion(completionKey({ sessionId: first, userId: student.id, caseId: 1 }));
    try {
      expect((await save(second, "STILL-WORKING")).status).toBe(200);
      expect((await leave(second)).status).toBe(200);
      // The encounter that is being graded keeps its own protection.
      expect((await save(first, "TOO-LATE")).status).toBe(409);
    } finally {
      release();
    }
  });

  it("the locking key is per encounter, and falls back to student and case without a session", () => {
    expect(completionKey({ sessionId: 7, userId: 3, caseId: 1 })).toBe("s:7");
    expect(completionKey({ sessionId: null, userId: 3, caseId: 1 })).toBe("c:3:1");
  });
});

describe("AI outage with a one-attempt budget: the attempt is spent only when it is scored", () => {
  beforeEach(() => aiDown());

  it("the first encounter scored takes the attempt; the surplus is kept on record and never scored", async () => {
    const c = setup("budget", 1);
    const a = (await start(c)).body.sessionId;
    expect((await finish(c, a, "ENCOUNTER-A")).status).toBe(503);
    // AI outage: no attempt was spent, so the student may start again on the same case.
    const b = await start(c);
    expect(b.status).toBe(200);
    expect(b.body.sessionId).not.toBe(a);
    expect((await finish(c, b.body.sessionId, "ENCOUNTER-B")).status).toBe(503);
    expect(attemptsIn(c)).toBe(0);

    // AI back. A was submitted first, so it is scored first.
    aiUp();
    db.prepare("UPDATE vp_sessions SET finish_requested_ms=? WHERE id=?").run(Date.now() - 600000, a);
    db.prepare("UPDATE vp_sessions SET finish_requested_ms=? WHERE id=?").run(Date.now() - 300000, b.body.sessionId);
    due(a); due(b.body.sessionId);
    await expireVpSessions();

    expect(row(a).attempt_id).toBeTruthy();
    expect(attemptsIn(c)).toBe(1);
    // B is refused at scoring time, before any AI call: a permanent outcome kept for staff.
    expect(row(b.body.sessionId).attempt_id).toBeNull();
    expect(row(b.body.sessionId).review_required).toBe(1);
    expect(row(b.body.sessionId).expiry_error).toBe("attempts exhausted");
    expect(attemptsIn(c)).toBe(1);
    // The student is told plainly what happened, and the chat is not scored again.
    const again = await finish(c, b.body.sessionId, "ENCOUNTER-B-AGAIN");
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("under_staff_review");
    expect(again.body.reason).toBe("attempts_exhausted");
  });

  it("a second encounter cannot be opened once the attempt is actually scored", async () => {
    const c = setup("budget-after", 1);
    const a = (await start(c)).body.sessionId;
    expect((await finish(c, a, "SCORED-LATER")).status).toBe(503);
    aiUp();
    due(a);
    await expireVpSessions();
    expect(row(a).attempt_id).toBeTruthy();
    const next = await start(c);
    expect(next.status).toBe(403);
    expect(next.body.error).toBe("attempts exhausted");
  });

  it("a scored attempt's own finish is not counted against it (the grader never refuses its own encounter)", async () => {
    const c = setup("self", 1);
    const a = (await start(c)).body.sessionId;
    expect((await finish(c, a, "SELF")).status).toBe(503);
    aiUp();
    due(a);
    const sweep = await expireVpSessions();
    expect(sweep.finalized).toBeGreaterThanOrEqual(1);
    expect(row(a).attempt_id).toBeTruthy();
  });
});

describe("retry schedule (R101)", () => {
  it("jitter only adds delay, so a retry is never earlier than the base backoff", () => {
    for (const tries of [1, 2, 5, 20]) {
      expect(retryDelayMs(tries, () => 0)).toBe(backoffMs(tries));
      expect(retryDelayMs(tries, () => 0.999)).toBeLessThanOrEqual(Math.floor(backoffMs(tries) * 1.25));
      expect(retryDelayMs(tries, () => 0.999)).toBeGreaterThanOrEqual(backoffMs(tries));
    }
  });

  it("two encounters that failed together do not retry at the same instant", () => {
    const spread = new Set([0.1, 0.5, 0.9].map((r) => retryDelayMs(3, () => r)));
    expect(spread.size).toBe(3);
  });
});
