// Round 67: a conversation export must never be a header-only file.
// A started session with no recorded events produces no data rows, so both the
// per-class and the all-classes export answer 409 no_recorded_conversations
// (the client already shows a "nothing to export" message for 409). Once a real
// encounter is finished with logging on, the same export returns the rows.
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb } from "../src/db.js";
import { createApp } from "../src/app.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
async function token(u, p = "demo") { return (await login(u, p)).body.token; }
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

const vpEvents = [
  { kind: "student_msg", atMs: 1000, text: "درد قفسه سینه دارید؟" },
  { kind: "patient_msg", atMs: 2500, text: "بله", source: "mock" },
  { kind: "finish", atMs: 10000 },
];
const vpSession = { messages: [{ role: "student", text: "hi" }], tests: [], imaging: [], ddx: [], finalDx: "" };

let teacherTk, studentTk, stuId, cid;

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
  teacherTk = await token("teacher");
  studentTk = await token("40012345");
  const users = (await request(app).get("/api/users").set(A(teacherTk))).body;
  stuId = users.find((u) => u.username === "40012345").id;
  cid = (await request(app).post("/api/classes").set(A(teacherTk))
    .send({ name_en: "Empty export", name_fa: "خروجی خالی", maxAttempts: 5, logTranscript: true })).body.id;
  await request(app).put(`/api/classes/${cid}/members`).set(A(teacherTk)).send({ userIds: [stuId] });
  await request(app).put(`/api/classes/${cid}/cases`).set(A(teacherTk)).send({ cases: [{ case_id: 1, weight: 1 }] });
});

describe("R67 conversation export has no header-only files", () => {
  it("a started but unfinished session (no events) gives 409 for the class export", async () => {
    const sess = await request(app).post("/api/exam/session-start").set(A(studentTk))
      .send({ caseId: 1, classId: cid, lang: "fa" });
    expect(sess.status).toBe(200);
    expect(sess.body.loggingEnabled).toBe(true);
    const r = await request(app).get(`/api/classes/${cid}/conversation-log.csv`).set(A(teacherTk));
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("no_recorded_conversations");
  });

  it("the all-classes export gives 409 too when nothing has events", async () => {
    const r = await request(app).get("/api/classes/conversation-log.csv").set(A(teacherTk));
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("no_recorded_conversations");
  });

  it("after a finished, logged encounter the export returns the event rows", async () => {
    const stuSess = await request(app).post("/api/exam/session-start").set(A(studentTk))
      .send({ caseId: 1, classId: cid, lang: "fa" });
    const ev = await request(app).post("/api/exam/evaluate").set(A(studentTk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 300, sessionId: stuSess.body.sessionId, events: vpEvents, session: vpSession });
    expect(ev.status).toBe(200);
    const r = await request(app).get(`/api/classes/${cid}/conversation-log.csv`).set(A(teacherTk));
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/csv/);
    const lines = String(r.text).replace(/^\uFEFF/, "").split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0]).toMatch(/^session_id,/);
    expect(lines.some((l) => l.includes("student_msg"))).toBe(true);
  });
});
