// Round 65: the admin or a teacher can export every saved conversation, or the
// conversations of one class, as one CSV to hand to the instructors.
// Access: admin sees all classes; a teacher sees only the classes they own; a
// student never. Only sessions whose logging was ON are exported.
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
async function token(u, p = "demo") { return (await login(u, p)).body.token; }
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

const vpEvents = [
  { kind: "student_msg", atMs: 1000, text: "سلام، درد قفسه سینه دارید؟" },
  { kind: "patient_msg", atMs: 2500, text: "بله دکتر، از یک ساعت پیش", source: "mock" },
  { kind: "lab_order", atMs: 4000, query: "ecg" },
  { kind: "finish", atMs: 10000 },
];
const vpSession = { messages: [{ role: "student", text: "hi" }], tests: [], imaging: [], ddx: [], finalDx: "" };

async function makeClass(tk, stuId, caseId, { logTranscript = true } = {}) {
  const cid = (await request(app).post("/api/classes").set(A(tk))
    .send({ name_en: `Export ${Math.random()}`, name_fa: "خروجی", maxAttempts: 5, logTranscript })).body.id;
  await request(app).put(`/api/classes/${cid}/members`).set(A(tk)).send({ userIds: [stuId] });
  await request(app).put(`/api/classes/${cid}/cases`).set(A(tk)).send({ cases: [{ case_id: caseId, weight: 1 }] });
  return cid;
}
async function runEncounter(stk, cid, caseId = 1) {
  const sess = await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId, classId: cid, lang: "fa" });
  const ev = await request(app).post("/api/exam/evaluate").set(A(stk))
    .send({ caseId, classId: cid, lang: "fa", durationSec: 300, sessionId: sess.body.sessionId, events: vpEvents, session: vpSession });
  return ev;
}
function csvRows(text) {
  return String(text).replace(/^\uFEFF/, "").split("\n").filter(Boolean);
}

let teacherTk, adminTk, studentTk, stuId, ownClass, otherClass, teacherId, adminId;

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
  teacherTk = await token("teacher");
  adminTk = await token("admin");
  studentTk = await token("40012345");
  const users = (await request(app).get("/api/users").set(A(teacherTk))).body;
  stuId = users.find((u) => u.username === "40012345").id;
  teacherId = db.prepare("SELECT id FROM users WHERE username='teacher'").get().id;
  adminId = db.prepare("SELECT id FROM users WHERE username='admin'").get().id;

  // The teacher's own logged class.
  ownClass = await makeClass(teacherTk, stuId, 1, { logTranscript: true });
  const evOwn = await runEncounter(studentTk, ownClass);
  expect(evOwn.body.logging.enabled).toBe(true);

  // A logged class owned by someone else (the admin): the teacher must not see it.
  otherClass = await makeClass(adminTk, stuId, 1, { logTranscript: true });
  db.prepare("UPDATE classes SET owner_id=? WHERE id=?").run(adminId, otherClass);
  await runEncounter(studentTk, otherClass);
});

describe("R65 export all saved conversations", () => {
  it("the admin gets every logged conversation in one CSV, with class columns", async () => {
    const res = await request(app).get("/api/classes/conversation-log.csv").set(A(adminTk));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/conversation-log-all-\d{4}-\d{2}-\d{2}\.csv/);
    const rows = csvRows(res.text);
    expect(rows[0].split(",").slice(0, 3)).toEqual(["class_id", "class_code", "session_id"]);
    const classIds = new Set(rows.slice(1).map((r) => r.split(",")[0]));
    expect(classIds.has(String(ownClass))).toBe(true);
    expect(classIds.has(String(otherClass))).toBe(true);
    expect(res.text).toMatch(/درد قفسه سینه/);
  });

  it("a teacher gets only the conversations of the classes they own", async () => {
    const res = await request(app).get("/api/classes/conversation-log.csv").set(A(teacherTk));
    expect(res.status).toBe(200);
    const classIds = new Set(csvRows(res.text).slice(1).map((r) => r.split(",")[0]));
    expect(classIds.has(String(ownClass))).toBe(true);
    expect(classIds.has(String(otherClass))).toBe(false);
  });

  it("a student cannot export", async () => {
    const res = await request(app).get("/api/classes/conversation-log.csv").set(A(studentTk));
    expect([401, 403]).toContain(res.status);
  });
});

describe("R65 export one class", () => {
  it("?classId= returns only that class's rows", async () => {
    const res = await request(app).get(`/api/classes/conversation-log.csv?classId=${ownClass}`).set(A(teacherTk));
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(/conversation-log-/);
    const ids = new Set(csvRows(res.text).slice(1).map((r) => r.split(",")[0]));
    expect([...ids]).toEqual([String(ownClass)]);
  });

  it("a teacher cannot export another teacher's class", async () => {
    const res = await request(app).get(`/api/classes/conversation-log.csv?classId=${otherClass}`).set(A(teacherTk));
    expect(res.status).toBe(403);
  });

  it("an unknown class is 404", async () => {
    const res = await request(app).get("/api/classes/conversation-log.csv?classId=999999").set(A(adminTk));
    expect(res.status).toBe(404);
  });

  it("a class with nothing recorded answers 409 instead of an empty file", async () => {
    const quiet = await makeClass(teacherTk, stuId, 1, { logTranscript: false });
    const res = await request(app).get(`/api/classes/conversation-log.csv?classId=${quiet}`).set(A(teacherTk));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("no_recorded_conversations");
  });

  it("the per-class endpoint still works with the same columns", async () => {
    const res = await request(app).get(`/api/classes/${ownClass}/conversation-log.csv`).set(A(teacherTk));
    expect(res.status).toBe(200);
    expect(csvRows(res.text)[0].split(",")[0]).toBe("session_id");
  });
});
