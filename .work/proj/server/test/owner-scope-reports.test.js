/* Owner-only research and reports (R51).
   A teacher sees only attempts / student records / research studies that belong
   to their own classes, exams and studies. A colleague in the same university
   gets nothing of theirs; admin keeps full access. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { createApp } from "../src/app.js";
import { initDb, db } from "../src/db.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
const token = async (u, p = "demo") => (await login(u, p)).body.token;
const A = (tk) => ({ Authorization: `Bearer ${tk}` });
const vpEvents = [{ kind: "student_msg", atMs: 10, text: "سلام" }, { kind: "finish", atMs: 20 }];
const vpSession = { messages: [{ role: "student", text: "سلام" }], tests: [], imaging: [], ddx: [], finalDx: "" };

let adm, tA, tB, stk, sid, cid, attemptId, studyId;

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
  adm = await token("admin");
  tA = await token("teacher");
  const pw = "Colleague-R51-pass";
  const u = `colleague_r51_${Date.now()}`;
  const made = await request(app).post("/api/users").set(A(adm))
    .send({ username: u, password: pw, role: "teacher", name_fa: "همکار", name_en: "Colleague", university_id: 1 });
  expect(made.status).toBe(200);
  tB = await token(u, pw);
  stk = await token("40055667");
  sid = db.prepare("SELECT id FROM users WHERE username='40055667'").get().id;
});

describe("reports are owner-only", () => {
  it("a class attempt is visible to its owner and admin, not to a same-university colleague", async () => {
    const cls = await request(app).post("/api/classes").set(A(tA)).send({ name_en: "R51 report", name_fa: "گزارش", maxAttempts: 8, logTranscript: true });
    expect(cls.status).toBe(200);
    cid = cls.body.id;
    expect((await request(app).put(`/api/classes/${cid}/members`).set(A(tA)).send({ userIds: [sid] })).status).toBe(200);
    expect((await request(app).put(`/api/classes/${cid}/cases`).set(A(tA)).send({ cases: [{ case_id: 1, weight: 1 }] })).status).toBe(200);
    const sess = await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid });
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 30, sessionId: sess.body.sessionId, events: vpEvents, session: vpSession });
    expect(ev.status).toBe(200);
    attemptId = db.prepare("SELECT id FROM attempts WHERE class_id=? AND user_id=? ORDER BY id DESC LIMIT 1").get(cid, sid)?.id;
    expect(attemptId).toBeTruthy();

    const ownList = await request(app).get("/api/reports/attempts").set(A(tA));
    expect(ownList.status).toBe(200);
    expect(JSON.stringify(ownList.body)).toContain(`"id":${attemptId}`);

    const peerList = await request(app).get("/api/reports/attempts").set(A(tB));
    expect(peerList.status).toBe(200);
    expect(JSON.stringify(peerList.body)).not.toContain(`"id":${attemptId}`);

    expect((await request(app).get(`/api/reports/attempts/${attemptId}`).set(A(tB))).status).toBe(403);
    expect((await request(app).get(`/api/reports/attempts/${attemptId}`).set(A(tA))).status).toBe(200);
    expect((await request(app).get(`/api/reports/attempts/${attemptId}`).set(A(adm))).status).toBe(200);
  });

  it("a colleague cannot open the record of a student who is only in the owner's class", async () => {
    expect((await request(app).get(`/api/reports/student/${sid}`).set(A(tB))).status).toBe(403);
    expect((await request(app).get(`/api/reports/student/${sid}`).set(A(tA))).status).toBe(200);
  });

  it("the dashboard counts only the teacher's own exams", async () => {
    const dashB = await request(app).get("/api/reports/summary").set(A(tB));
    expect(dashB.status).toBe(200);
    expect(dashB.body.attempts).toBe(0);
  });
});

describe("research studies are owner-only", () => {
  it("a colleague does not list, read or edit another teacher's study", async () => {
    const created = await request(app).post("/api/research/studies").set(A(tA)).send({
      title_fa: "پژوهش مالک", title_en: "Owner study", domain: "education", active: true, consent_required: false,
      consent_modes: "online,paper,verbal", consent_text_fa: "متن", consent_text_en: "text",
    });
    expect(created.status).toBe(200);
    studyId = created.body.id || created.body.study?.id;
    expect(studyId).toBeTruthy();

    const ownList = await request(app).get("/api/research/studies").set(A(tA));
    expect(JSON.stringify(ownList.body)).toContain("Owner study");
    const peerList = await request(app).get("/api/research/studies").set(A(tB));
    expect(JSON.stringify(peerList.body)).not.toContain("Owner study");
    expect((await request(app).put(`/api/research/studies/${studyId}`).set(A(tB)).send({ title_en: "stolen" })).status).toBe(403);
    expect((await request(app).get(`/api/research/events`).set(A(tB))).body.events.every((e) => e.study_id !== studyId)).toBe(true);
  });

  it("a colleague cannot attach the owner's study to a class", async () => {
    const cl = await request(app).post("/api/classes").set(A(tB)).send({ name_en: "peer class", name_fa: "کلاس همکار", maxAttempts: 2 });
    const put = await request(app).put(`/api/classes/${cl.body.id}`).set(A(tB)).send({ name_en: "peer class", name_fa: "کلاس همکار", studyId });
    expect(put.status).toBe(403);
  });
});
