/* ================================================================
   research-opt-in.test.js — research dataset is opt-in only.
   Classes/exams without study_id never write research_events.
   University reports with ?research=1 hide non-study attempts.
   Studies and events can be deleted.
   ================================================================ */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";

let app;
async function token(u, p = "demo") {
  return (await request(app).post("/api/auth/login").send({ username: u, password: p })).body.token;
}
const A = (tk) => ({ Authorization: `Bearer ${tk}` });
const uid = async (tk, username) =>
  ((await request(app).get("/api/users").set(A(tk))).body).find((u) => u.username === username).id;

async function makeStudy(tk, patch = {}) {
  const res = await request(app).post("/api/research/studies").set(A(tk)).send({
    title_fa: "پژوهش آزمون", title_en: "Exam study",
    domain: "education", active: true, consent_required: false, ...patch,
  });
  return res.body;
}

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

describe("exam research opt-in", () => {
  it("saves studyId + logTranscript on an exam and returns them", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const created = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Research exam", title_fa: "آزمون پژوهش",
      case_ids: [1], starts_at: now, ends_at: end, duration_min: 20,
      studyId: study.id, logTranscript: true,
    });
    expect(created.status).toBe(200);
    const detail = await request(app).get(`/api/exams/${created.body.id}`).set(A(ttk));
    expect(detail.body.study_id).toBe(study.id);
    expect(detail.body.log_transcript).toBe(true);

    const bad = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Bad study", case_ids: [1], studyId: 999999,
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("study_not_found");
  });

  it("flashcard finish on a research exam writes an event; a plain exam does not", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const withStudy = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Flash research", case_ids: [1], use_flashcards: true,
      starts_at: now, ends_at: end, studyId: study.id, max_attempts: 5,
    });
    const plain = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Flash plain", case_ids: [1], use_flashcards: true,
      starts_at: now, ends_at: end, max_attempts: 5,
    });
    await request(app).put(`/api/exams/${withStudy.body.id}/participants`).set(A(ttk))
      .send({ studentNos: ["40012345"] });
    await request(app).put(`/api/exams/${plain.body.id}/participants`).set(A(ttk))
      .send({ studentNos: ["40012345"] });
    const stk = await token("40012345");
    const before = db.prepare("SELECT COUNT(*) n FROM research_events WHERE study_id=?").get(study.id).n;
    await request(app).post("/api/exam/flashcard-result").set(A(stk))
      .send({ examId: withStudy.body.id, score: 80, total: 4, correct: 3, wrong: 1 });
    await request(app).post("/api/exam/flashcard-result").set(A(stk))
      .send({ examId: plain.body.id, score: 50, total: 2, correct: 1, wrong: 1 });
    const after = db.prepare("SELECT COUNT(*) n FROM research_events WHERE study_id=?").get(study.id).n;
    expect(after).toBe(before + 1);
    const ev = db.prepare("SELECT event_type, context_type FROM research_events WHERE study_id=? ORDER BY id DESC").get(study.id);
    expect(ev.event_type).toBe("flashcard_finished");
    expect(ev.context_type).toBe("exam");
  });
});

describe("class sessions only log when a study is linked", () => {
  it("records session_started for a linked class and nothing for a plain class", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const stuId = await uid(ttk, "40012345");
    const linked = (await request(app).post("/api/classes").set(A(ttk))
      .send({ name_en: "Linked", name_fa: "وصل", maxAttempts: 5, studyId: study.id })).body.id;
    await request(app).put(`/api/classes/${linked}/members`).set(A(ttk)).send({ userIds: [stuId] });
    await request(app).put(`/api/classes/${linked}/cases`).set(A(ttk)).send({ cases: [{ case_id: 1, weight: 1 }] });
    const plain = (await request(app).post("/api/classes").set(A(ttk))
      .send({ name_en: "Plain", name_fa: "عادی", maxAttempts: 5 })).body.id;
    await request(app).put(`/api/classes/${plain}/members`).set(A(ttk)).send({ userIds: [stuId] });
    await request(app).put(`/api/classes/${plain}/cases`).set(A(ttk)).send({ cases: [{ case_id: 1, weight: 1 }] });
    const stk = await token("40012345");
    const before = db.prepare("SELECT COUNT(*) n FROM research_events WHERE study_id=?").get(study.id).n;
    expect((await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: linked })).status).toBe(200);
    expect((await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: plain })).status).toBe(200);
    const after = db.prepare("SELECT COUNT(*) n FROM research_events WHERE study_id=? AND event_type='session_started'").get(study.id).n;
    expect(after).toBeGreaterThanOrEqual(before + 1);
    expect(db.prepare("SELECT COUNT(*) n FROM research_events WHERE context_id=? AND context_type='class'").get(plain).n).toBe(0);
  });
});

describe("university reports research filter + delete", () => {
  it("?research=1 returns only attempts from study-linked classes/exams", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const researchExam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "R-exam", case_ids: [1], starts_at: now, ends_at: end, studyId: study.id, max_attempts: 5,
    });
    const plainExam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "P-exam", case_ids: [1], starts_at: now, ends_at: end, max_attempts: 5,
    });
    await request(app).put(`/api/exams/${researchExam.body.id}/participants`).set(A(ttk)).send({ studentNos: ["40012345"] });
    await request(app).put(`/api/exams/${plainExam.body.id}/participants`).set(A(ttk)).send({ studentNos: ["40012345"] });
    const stk = await token("40012345");
    const session = { messages: [{ role: "student", text: "hello" }], tests: [], imaging: [], ddx: [], finalDx: "" };
    await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, examId: researchExam.body.id, lang: "en", session });
    await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, examId: plainExam.body.id, lang: "en", session });

    const all = await request(app).get("/api/reports/attempts").set(A(ttk));
    expect(all.status).toBe(200);
    expect(all.body.length).toBeGreaterThan(0);
    const filtered = await request(app).get("/api/reports/attempts?research=1").set(A(ttk));
    expect(filtered.status).toBe(200);
    expect(filtered.body.every((a) => a.research)).toBe(true);
    expect(filtered.body.some((a) => a.exam_id === researchExam.body.id)).toBe(true);
    expect(filtered.body.some((a) => a.exam_id === plainExam.body.id)).toBe(false);

    const row = filtered.body.find((a) => a.exam_id === researchExam.body.id);
    const del = await request(app).delete(`/api/reports/attempts/${row.id}`).set(A(ttk));
    expect(del.status).toBe(200);
    const after = await request(app).get("/api/reports/attempts?research=1").set(A(ttk));
    expect(after.body.some((a) => a.id === row.id)).toBe(false);
  });
});

describe("research study/event delete", () => {
  it("deletes an event, then a study (unlinking exams/classes)", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "To unlink", case_ids: [1], use_flashcards: true,
      starts_at: now, ends_at: end, studyId: study.id, max_attempts: 5,
    });
    await request(app).put(`/api/exams/${exam.body.id}/participants`).set(A(ttk)).send({ studentNos: ["40012345"] });
    const stk = await token("40012345");
    await request(app).post("/api/exam/flashcard-result").set(A(stk))
      .send({ examId: exam.body.id, score: 70, total: 2, correct: 1, wrong: 1 });
    const events = await request(app).get("/api/research/events").set(A(ttk));
    const mine = (events.body.events || []).find((e) => e.study_id === study.id);
    expect(mine).toBeTruthy();
    expect((await request(app).delete(`/api/research/events/${mine.id}`).set(A(ttk))).status).toBe(200);
    expect(db.prepare("SELECT id FROM research_events WHERE id=?").get(mine.id)).toBeUndefined();

    const gone = await request(app).delete(`/api/research/studies/${study.id}`).set(A(ttk));
    expect(gone.status).toBe(200);
    const detail = await request(app).get(`/api/exams/${exam.body.id}`).set(A(ttk));
    expect(detail.body.study_id).toBeNull();
    expect(db.prepare("SELECT id FROM research_studies WHERE id=?").get(study.id)).toBeUndefined();
  });
});
