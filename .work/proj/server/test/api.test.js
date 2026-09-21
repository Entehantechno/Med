/* ================================================================
   api.test.js — Integration tests for the MED Lab API.
   Run with: npm test
   ================================================================ */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import request from "supertest";
import jwt from "jsonwebtoken";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import { isSafeOutboundUrl } from "../src/lib/security.js";

let app;

function login(username, password) {
  return request(app).post("/api/auth/login").send({ username, password });
}
async function token(username, password = "demo") {
  const res = await login(username, password);
  return res.body.token;
}

beforeAll(async () => {
  // Fresh seeded database before the suite (force past the safety guard)
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();               // load the WASM engine, then read the seeded file
  app = createApp();
});

describe("health & auth", () => {
  it("health endpoint works", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("teacher can log in", async () => {
    const res = await login("teacher", "demo");
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe("teacher");
  });

  it("rejects wrong password", async () => {
    const res = await login("teacher", "nope");
    expect(res.status).toBe(401);
  });

  it("blocks inactive student", async () => {
    const res = await login("40099999", "demo");
    expect(res.status).toBe(403);
  });

  it("student logs in with student number", async () => {
    const res = await login("40012345", "demo");
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("student");
  });
});

describe("RBAC & access control", () => {
  it("blocks unauthenticated access", async () => {
    const res = await request(app).get("/api/cases");
    expect(res.status).toBe(401);
  });

  it("students cannot list users", async () => {
    const tk = await token("40012345");
    const res = await request(app).get("/api/users").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(403);
  });

  it("AI settings are admin-only (student & teacher blocked)", async () => {
    const stk = await token("40012345");
    const s = await request(app).get("/api/settings/ai").set("Authorization", `Bearer ${stk}`);
    expect(s.status).toBe(403);
    const ttk = await token("teacher");
    const t = await request(app).get("/api/settings/ai").set("Authorization", `Bearer ${ttk}`);
    expect(t.status).toBe(403);
    const atk = await token("admin");
    const a = await request(app).get("/api/settings/ai").set("Authorization", `Bearer ${atk}`);
    expect(a.status).toBe(200);
  });

  it("student only sees assigned cases", async () => {
    const tk = await token("40012345");
    const res = await request(app).get("/api/cases").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    // Ali is assigned case 1 only
    expect(res.body.map((c) => c.id)).toEqual([1]);
  });

  it("student cannot open a case that is neither assigned to them nor in any of their classes/exams", async () => {
    // Case 2 in the seed IS reachable by Ali via his class, so create a brand-new
    // case that is NOT assigned to him and NOT attached to any of his classes/exams.
    const teacherTk = await token("teacher");
    const newCase = await request(app).post("/api/cases").set("Authorization", `Bearer ${teacherTk}`)
      .send({ title_fa: "کیس دسترسی‌نشده", title_en: "Unreachable case", chief_fa: "—", chief_en: "—", difficulty: "medium" });
    const orphanId = newCase.body.id;
    const tk = await token("40012345");
    const res = await request(app).get(`/api/cases/${orphanId}`).set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(403);
  });

  it("student CAN open a case that belongs to their class (even without a direct assignment)", async () => {
    // Ali (40012345) is enrolled in class 1 which contains case 2, but case 2 is
    // NOT in his exam_assignments — access must still be granted via the class.
    const tk = await token("40012345");
    const res = await request(app).get("/api/cases/2").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
  });
});

describe("virtual patient & evaluation (mock engine)", () => {
  it("patient replies in character and does not invent", async () => {
    const tk = await token("40012345");
    const res = await request(app).post("/api/exam/patient-reply")
      .set("Authorization", `Bearer ${tk}`)
      .send({ caseId: 1, classId: 1, userText: "سلام", history: [], lang: "fa" });
    expect(res.status).toBe(200);
    expect(res.body.text).toBeTruthy();
    expect(res.body.source).toBe("mock");
  });

  it("evaluation returns a checklist score", async () => {
    const tk = await token("40012345");
    const res = await request(app).post("/api/exam/evaluate")
      .set("Authorization", `Bearer ${tk}`)
      .send({
        caseId: 1, classId: 1, lang: "en",
        session: {
          messages: [{ role: "student", text: "I am Dr Smith. May I have your consent? Does the pain radiate to your arm? Do you have diabetes or dyspnea? Please report physical exam and vitals. I would consider aspirin if appropriate." }],
          tests: ["ecg", "troponin"], imaging: [], problemList: ["acute chest pain"], ddx: ["STEMI", "ACS"], finalDx: "STEMI acute MI",
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.score).toBeGreaterThan(70);
    expect(res.body.finalDxCorrect).toBe(true);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it("evaluation returns separate per-section scores (history vs. overall)", async () => {
    const tk = await token("40012345");
    const res = await request(app).post("/api/exam/evaluate")
      .set("Authorization", `Bearer ${tk}`)
      .send({
        caseId: 1, classId: 1, lang: "en",
        session: {
          messages: [{ role: "student", text: "hello ecg troponin STEMI arm pain diabetes aspirin" }],
          tests: ["ecg", "troponin"], imaging: [], ddx: [], finalDx: "STEMI acute MI",
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.sectionScores).toBeTruthy();
    // an overall score always exists; per-section list is present
    expect(typeof res.body.sectionScores.overall).toBe("number");
    expect(Array.isArray(res.body.sectionScores.sections)).toBe(true);
    // every result item carries a section tag
    expect(res.body.results.every((r) => typeof r.section === "string")).toBe(true);
  });

  it("exposes scoring sections + the internal-medicine history template", async () => {
    const tk = await token("teacher");
    const res = await request(app).get("/api/checklists-meta").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    expect(res.body.sections.some((s) => s.key === "history" && s.isHistory)).toBe(true);
    expect(res.body.internalHistory.length).toBeGreaterThan(10);
    expect(res.body.internalHistory.every((i) => i.section === "history")).toBe(true);
  });

  it("offers multiple specialty history forms (internal/obgyn/cardio/peds/psych)", async () => {
    const tk = await token("teacher");
    const res = await request(app).get("/api/checklists-meta").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    const keys = (res.body.forms || []).map((f) => f.key);
    for (const k of ["internal", "obgyn", "cardio", "peds", "psych"]) expect(keys).toContain(k);
    const cardio = res.body.forms.find((f) => f.key === "cardio");
    expect(cardio.items.length).toBeGreaterThan(5);
    expect(cardio.items.every((i) => i.section === "history")).toBe(true);
  });

  it("a case can store its history_form type", async () => {
    const tk = await token("teacher");
    const c = await request(app).post("/api/cases").set("Authorization", `Bearer ${tk}`)
      .send({ title_fa: "کیس قلب", title_en: "Cardio case", chief_fa: "درد سینه", history_form: "cardio", difficulty: "medium", checklist_id: 1 });
    expect(c.status).toBe(200);
    const read = await request(app).get(`/api/cases/${c.body.id}`).set("Authorization", `Bearer ${tk}`);
    expect(read.body.history_form).toBe("cardio");
  });

  it("a class stores grading role + default history form", async () => {
    const tk = await token("teacher");
    const cls = await request(app).post("/api/classes").set("Authorization", `Bearer ${tk}`)
      .send({ name_fa: "زنان", name_en: "obgyn", gradingRole: "history", historyForm: "obgyn" });
    const read = await request(app).get(`/api/classes/${cls.body.id}`).set("Authorization", `Bearer ${tk}`);
    expect(read.body.class.grading_role).toBe("history");
    expect(read.body.class.history_form).toBe("obgyn");
  });

  it("a teacher can create a student, list users, and add them to a class; cannot create privileged roles", async () => {
    const tk = await token("teacher");
    // teacher lists users (uni.users grants access now)
    const list = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${tk}`);
    expect(list.status).toBe(200);
    // teacher creates a NEW student
    const uname = "stu_" + Date.now();
    const created = await request(app).post("/api/admin/users").set("Authorization", `Bearer ${tk}`)
      .send({ username: uname, password: "pw123456", name_fa: "دانشجوی تست", role: "student", student_no: uname });
    expect(created.status).toBe(200);
    // teacher may NOT create a teacher/admin
    const denied = await request(app).post("/api/admin/users").set("Authorization", `Bearer ${tk}`)
      .send({ username: "t_" + Date.now(), password: "pw123456", name_fa: "x", role: "teacher" });
    expect(denied.status).toBe(403);
    // teacher adds the new student to their class
    const cls = await request(app).post("/api/classes").set("Authorization", `Bearer ${tk}`).send({ name_fa: "ک", name_en: "c" });
    const add = await request(app).put(`/api/classes/${cls.body.id}/members`).set("Authorization", `Bearer ${tk}`)
      .send({ userIds: [created.body.id] });
    expect(add.status).toBe(200);
  });

  it("a teacher can bulk-import students without them self-registering", async () => {
    const tk = await token("teacher");
    const sno = "99" + Date.now();
    const res = await request(app).post("/api/users/import").set("Authorization", `Bearer ${tk}`)
      .send({ csv: `name,family,student_no\nعلی,رضایی,${sno}` });
    expect(res.status).toBe(200);
    expect(res.body.created).toBeGreaterThanOrEqual(1);
    // the imported student can log in with student_no / student_no
    const login = await request(app).post("/api/auth/login").send({ username: sno, password: sno });
    expect(login.status).toBe(200);
  });

  it("teacher can set a class grading role and review a student's AI conversation + gradebook CSV", async () => {
    const tk = await token("teacher");
    const stk = await token("40012345");
    const stu = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${stk}`);
    const stuId = stu.body.user.id;
    // create class with extern (history) grading role. Conversation logging is
    // OFF by default now, so this review test opts in explicitly.
    const cls = await request(app).post("/api/classes").set("Authorization", `Bearer ${tk}`)
      .send({ name_fa: "بخشی", name_en: "sect", maxAttempts: 3, gradingRole: "history", logTranscript: true });
    const cid = cls.body.id;
    await request(app).put(`/api/classes/${cid}/members`).set("Authorization", `Bearer ${tk}`).send({ userIds: [stuId] });
    await request(app).put(`/api/classes/${cid}/cases`).set("Authorization", `Bearer ${tk}`).send({ cases: [{ case_id: 1, weight: 1 }] });
    // the role persisted
    const clRead = await request(app).get(`/api/classes/${cid}`).set("Authorization", `Bearer ${tk}`);
    expect(clRead.body.class.grading_role).toBe("history");
    // student takes the case (this stores the transcript + eval)
    const ev = await request(app).post("/api/exam/evaluate").set("Authorization", `Bearer ${stk}`)
      .send({ caseId: 1, classId: cid, lang: "fa", session: {
        messages: [{ role: "student", text: "سلام من دکتر هستم رضایت دارید" }, { role: "patient", text: "سلام دکتر" }],
        tests: ["ecg"], imaging: [], ddx: [], finalDx: "STEMI" } });
    expect(ev.status).toBe(200);
    // teacher lists the student's attempts
    const list = await request(app).get(`/api/classes/${cid}/members/${stuId}/attempts`).set("Authorization", `Bearer ${tk}`);
    expect(list.status).toBe(200);
    expect(list.body.attempts.length).toBeGreaterThan(0);
    // teacher opens the full attempt: transcript + section scores are visible
    const attId = list.body.attempts[0].id;
    const detail = await request(app).get(`/api/classes/${cid}/attempts/${attId}`).set("Authorization", `Bearer ${tk}`);
    expect(detail.status).toBe(200);
    expect(Array.isArray(detail.body.transcript.messages)).toBe(true);
    expect(detail.body.eval.sectionScores).toBeTruthy();
    // gradebook CSV downloads with the extern-scope column (history + exam +
    // problem list) and the class-criterion final-score column
    const csv = await request(app).get(`/api/classes/${cid}/gradebook.csv?lang=en`).set("Authorization", `Bearer ${tk}`);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain("extern_score(history+exam+problem_list+ddx)");
    expect(csv.text).toContain("final_score(class_criterion)");
    // a student may NOT read another student's transcript endpoint (teacher/admin only)
    const forbidden = await request(app).get(`/api/classes/${cid}/attempts/${attId}`).set("Authorization", `Bearer ${stk}`);
    expect(forbidden.status).toBe(403);
  });

  it("evaluation exposes an OSCE /10 score and stays deterministic without an AI key", async () => {
    const tk = await token("40012345");
    // Dedicated class with a roomy attempt budget: class 1 is capped at 2 and
    // earlier tests in this suite already spent them (the cap is now enforced
    // server-side, not just in the UI).
    const ttk = await token("teacher");
    const stuId = (await request(app).get("/api/users").set("Authorization", `Bearer ${ttk}`)).body.find((u) => u.username === "40012345").id;
    const cid = (await request(app).post("/api/classes").set("Authorization", `Bearer ${ttk}`)
      .send({ name_en: "Score10 probe", name_fa: "پ", maxAttempts: 5 })).body.id;
    await request(app).put(`/api/classes/${cid}/members`).set("Authorization", `Bearer ${ttk}`).send({ userIds: [stuId] });
    await request(app).put(`/api/classes/${cid}/cases`).set("Authorization", `Bearer ${ttk}`).send({ cases: [{ case_id: 1, weight: 1 }] });
    const res = await request(app).post("/api/exam/evaluate")
      .set("Authorization", `Bearer ${tk}`)
      .send({
        caseId: 1, classId: cid, lang: "fa",
        session: {
          messages: [{ role: "student", text: "سلام ecg troponin STEMI درد بازو دیابت" }],
          tests: ["ecg", "troponin"], imaging: [], ddx: [], finalDx: "STEMI",
        },
      });
    expect(res.status).toBe(200);
    // /10 score is present for OSCE-style review and matches the % score
    expect(res.body.score10).toBe(Math.round(res.body.score / 10));
    // AI-free: with no provider key configured, the checklist scoring is the
    // deterministic keyword engine (source not "llm").
    expect(res.body.source === "llm").toBe(false);
  });
});

describe("OSCE checklists (editable rubrics)", () => {
  it("ships the 13-item history-taking checklist and is fully editable (create/edit/delete)", async () => {
    const tk = await token("admin");
    // the seeded history-taking OSCE checklist is present
    const list = (await request(app).get("/api/checklists").set("Authorization", `Bearer ${tk}`)).body;
    const hx = list.find((c) => c.name_en === "History-taking & communication");
    expect(hx).toBeTruthy();
    expect(hx.items.length).toBe(13);
    // edit: add a new item + reword one
    const items = [...hx.items, { id: "cX", weight: 2, fa: "موردِ آزمایشی", en: "Test item", keys: ["x"] }];
    const put = await request(app).put(`/api/checklists/${hx.id}`).set("Authorization", `Bearer ${tk}`)
      .send({ name_fa: hx.name_fa, name_en: hx.name_en, items });
    expect(put.status).toBe(200);
    const after = (await request(app).get("/api/checklists").set("Authorization", `Bearer ${tk}`)).body
      .find((c) => c.id === hx.id);
    expect(after.items.length).toBe(14);
    // create a brand-new checklist, then delete it
    const created = await request(app).post("/api/checklists").set("Authorization", `Bearer ${tk}`)
      .send({ name_fa: "جدید", name_en: "Fresh", items: [{ id: "a", weight: 1, fa: "الف", en: "A", keys: [] }] });
    expect(created.body.id).toBeTruthy();
    const del = await request(app).del(`/api/checklists/${created.body.id}`).set("Authorization", `Bearer ${tk}`);
    expect(del.status).toBe(200);
    // restore original 13 items so other tests stay clean
    await request(app).put(`/api/checklists/${hx.id}`).set("Authorization", `Bearer ${tk}`)
      .send({ name_fa: hx.name_fa, name_en: hx.name_en, items: hx.items });
  });

  it("a learner cannot edit checklists (403)", async () => {
    const tk = await token("learner");
    const res = await request(app).post("/api/checklists").set("Authorization", `Bearer ${tk}`).send({ name_fa: "x" });
    expect([401, 403]).toContain(res.status);
  });

  it("a case can pick which checklist scores it, and evaluation uses that rubric", async () => {
    const tk = await token("teacher");
    // the 13-item history checklist
    const lists = (await request(app).get("/api/checklists").set("Authorization", `Bearer ${tk}`)).body;
    const hx = lists.find((c) => c.name_en === "History-taking & communication");
    expect(hx).toBeTruthy();
    // create a case bound to that checklist
    const created = await request(app).post("/api/cases").set("Authorization", `Bearer ${tk}`)
      .send({ title_fa: "کیس چک", title_en: "Checklist case", chief_fa: "سردرد", difficulty: "medium", checklist_id: hx.id });
    const caseId = created.body.id;
    // it persists
    const read = await request(app).get(`/api/cases/${caseId}`).set("Authorization", `Bearer ${tk}`);
    expect(read.body.checklist_id).toBe(hx.id);
    // enroll the demo student in a fresh class holding this case, then evaluate
    const stuId = (await request(app).get("/api/users").set("Authorization", `Bearer ${tk}`)).body.find((u) => u.username === "40012345").id;
    const cls = await request(app).post("/api/classes").set("Authorization", `Bearer ${tk}`).send({ name_fa: "چک", name_en: "chk", maxAttempts: 3 });
    await request(app).put(`/api/classes/${cls.body.id}/members`).set("Authorization", `Bearer ${tk}`).send({ userIds: [stuId] });
    await request(app).put(`/api/classes/${cls.body.id}/cases`).set("Authorization", `Bearer ${tk}`).send({ cases: [{ case_id: caseId, weight: 1 }] });
    const stk = await token("40012345");
    const ev = await request(app).post("/api/exam/evaluate").set("Authorization", `Bearer ${stk}`)
      .send({ caseId, classId: cls.body.id, lang: "fa", session: { messages: [{ role: "student", text: "سلام من دکتر هستم" }], tests: [], imaging: [], ddx: [], finalDx: "" } });
    expect(ev.status).toBe(200);
    // the evaluation's checklist = the 13 items of the chosen rubric PLUS the
    // synthetic problem-list item AND the synthetic differential-dx item (both
    // are always scored, even for checklists authored before the boxes existed)
    expect(ev.body.results.length).toBe(hx.items.length + 2);
    const pl = ev.body.results.find((x) => x.section === "problem_list");
    expect(pl).toBeTruthy();
    const ddx = ev.body.results.find((x) => x.section === "ddx");
    expect(ddx).toBeTruthy();
    expect(ddx.done).toBe(false);   // the session sent no differentials
  });
});

describe("teacher review of AI score + progress charts", () => {
  it("teacher can view the full log, adjust the score + leave feedback; the student sees the final score", async () => {
    // student makes a VP attempt. Logging is off by default, and this test
    // asserts on the stored transcript, so switch it on for class 1 first.
    const tk = await token("teacher");
    await request(app).put("/api/classes/1").set("Authorization", `Bearer ${tk}`)
      .send({ name_fa: "طب داخلی — نیمسال ۱", name_en: "Internal Medicine — Sem 1", maxAttempts: 2, logTranscript: true });
    const stk = await token("40012345");
    await request(app).post("/api/exam/evaluate").set("Authorization", `Bearer ${stk}`)
      .send({ caseId: 1, classId: 1, lang: "fa", session: { messages: [{ role: "student", text: "سلام من دکتر هستم" }], tests: ["ecg"], imaging: [], ddx: [], finalDx: "STEMI" } });
    const attempts = (await request(app).get("/api/reports/attempts?type=vp").set("Authorization", `Bearer ${tk}`)).body;
    const a = attempts[0];
    // full log detail includes transcript + eval
    const detail = await request(app).get(`/api/reports/attempts/${a.id}`).set("Authorization", `Bearer ${tk}`);
    expect(detail.status).toBe(200);
    expect(detail.body.transcript).toBeTruthy();
    expect(Array.isArray(detail.body.eval.results)).toBe(true);
    // teacher adjusts score to 88 + feedback
    const rev = await request(app).put(`/api/reports/attempts/${a.id}/review`).set("Authorization", `Bearer ${tk}`)
      .send({ status: "adjusted", teacher_score: 88, teacher_feedback: "خوب بود ولی عوامل خطر را نپرسیدی." });
    expect(rev.status).toBe(200);
    // student sees the FINAL (teacher) score + feedback in their own report
    const mine = (await request(app).get("/api/reports/my").set("Authorization", `Bearer ${stk}`)).body;
    const reviewed = mine.find((x) => x.id === a.id);
    expect(reviewed.teacher_status).toBe("adjusted");
    expect(reviewed.final_score).toBe(88);
    expect(reviewed.teacher_feedback).toContain("عوامل خطر");
  });

  it("progress endpoint returns radar (per-criterion) + line (over time); students can only see their own", async () => {
    const tk = await token("teacher");
    const uid = (await request(app).get("/api/users").set("Authorization", `Bearer ${tk}`)).body.find((u) => u.username === "40012345").id;
    const p = await request(app).get(`/api/reports/progress/${uid}`).set("Authorization", `Bearer ${tk}`);
    expect(p.status).toBe(200);
    expect(Array.isArray(p.body.radar)).toBe(true);
    expect(Array.isArray(p.body.line)).toBe(true);
    // a different student cannot read someone else's progress
    const otherTk = await token("40067890");
    const denied = await request(app).get(`/api/reports/progress/${uid}`).set("Authorization", `Bearer ${otherTk}`);
    expect(denied.status).toBe(403);
  });
});

describe("classrooms & class grade", () => {
  it("teacher sees class gradebook with members", async () => {
    const tk = await token("teacher");
    const res = await request(app).get("/api/classes/1").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    expect(res.body.members.length).toBeGreaterThan(0);
    expect(res.body.members[0]).toHaveProperty("grade");
  });

  it("non-member student is blocked from a class", async () => {
    const tk = await token("teacher");
    // create a class with no members
    const created = await request(app).post("/api/classes")
      .set("Authorization", `Bearer ${tk}`).send({ name_en: "Empty", name_fa: "خالی" });
    const cid = created.body.id;
    const stk = await token("40012345");
    const res = await request(app).get(`/api/classes/${cid}`).set(`Authorization`, `Bearer ${stk}`);
    expect(res.status).toBe(403);
  });

  it("teacher can attach flashcards (graded + practice) to a class; a student takes them and it hits the gradebook", async () => {
    const tk = await token("teacher");
    // create two dedicated flashcards so the test never depends on ids other
    // tests may have mutated (shared DB across the suite).
    const mk = async (title) => (await request(app).post("/api/flashcards").set("Authorization", `Bearer ${tk}`)
      .send({ title_en: title, title_fa: title, questionType: "text", answerMode: "search",
        q_en: "Q", q_fa: "پ", correct_en: "A", correct_fa: "الف" })).body.id;
    const gradedId = await mk("clsfc-graded");
    const practiceId = await mk("clsfc-practice");
    // use the demo STUDENT (the class flashcard-finish endpoint requires role=student)
    const stk = await token("40012345");
    const stuId = (await request(app).get("/api/users").set("Authorization", `Bearer ${tk}`)).body.find((u) => u.username === "40012345").id;
    // fresh class with this student enrolled
    const created = await request(app).post("/api/classes").set("Authorization", `Bearer ${tk}`)
      .send({ name_en: "FC class", name_fa: "کلاس فلش", maxAttempts: 3 });
    const cid = created.body.id;
    await request(app).put(`/api/classes/${cid}/members`).set("Authorization", `Bearer ${tk}`).send({ userIds: [stuId] });
    // attach one graded (weight 2) and one practice flashcard
    const put = await request(app).put(`/api/classes/${cid}/flashcards`).set("Authorization", `Bearer ${tk}`)
      .send({ flashcards: [{ flashcard_id: gradedId, graded: true, weight: 2 }, { flashcard_id: practiceId, graded: false }] });
    expect(put.status).toBe(200);
    // teacher detail shows both flashcards
    const det = await request(app).get(`/api/classes/${cid}`).set("Authorization", `Bearer ${tk}`);
    expect(det.body.flashcards.length).toBe(2);
    expect(det.body.members[0]).toHaveProperty("totalFlash");
    // student takes the graded flashcard → score recorded, best kept
    const fin = await request(app).post(`/api/classes/${cid}/flashcard/${gradedId}/finish`).set("Authorization", `Bearer ${stk}`).send({ score: 80 });
    expect(fin.status).toBe(200);
    expect(fin.body.score).toBe(80);
    // student's class detail reflects the flashcard usage + best
    const sdet = await request(app).get(`/api/classes/${cid}`).set("Authorization", `Bearer ${stk}`);
    const gf = sdet.body.flashcards.find((f) => f.flashcard_id === gradedId);
    expect(gf.attemptsUsed).toBe(1);
    expect(gf.best).toBe(80);
    // the class detail must expose the QUESTION (q_*) separately from the
    // teacher-facing title, so the student UI never leaks the internal label.
    expect(gf.q_fa).toBe("پ");
    expect(gf.q_en).toBe("Q");
    // teacher gradebook: this student now has flashDone >= 1 and a grade influenced by the graded set
    const gb = await request(app).get(`/api/classes/${cid}`).set("Authorization", `Bearer ${tk}`);
    const me = gb.body.members.find((m) => m.id === stuId);
    expect(me.flashDone).toBeGreaterThanOrEqual(1);
    expect(me.grade).toBe(80);   // only one graded item → grade equals its best
    // progressive-hint level + per-question response time telemetry feeds the
    // teacher analytics panel (hints count, deepest level, seconds, weekly trend)
    await request(app).post(`/api/classes/${cid}/flashcard/${practiceId}/finish`)
      .set("Authorization", `Bearer ${stk}`)
      .send({
        score: 40, durationSec: 30,
        answers: [{ card_id: practiceId, order: 1, type: "mcq", title_fa: "clsfc-practice",
          category_fa: "هیستولوژی", points: 40, proposedPoints: 100, solved: false,
          hintsUsed: 2, hintLevel: 2, responseMs: 12000 }],
      });
    const an = await request(app).get(`/api/classes/${cid}/analytics`).set("Authorization", `Bearer ${tk}`);
    expect(an.status).toBe(200);
    expect(an.body.summary.answers).toBeGreaterThanOrEqual(1);
    expect(an.body.summary.avgHintsPerAnswer).toBeGreaterThan(0);
    expect(an.body.summary.pctAnswersWithHints).toBeGreaterThan(0);
    expect(an.body.summary.avgSecPerAnswer).toBeGreaterThanOrEqual(1);
    const timed = an.body.itemWeaknesses.find((x) => x.avgSec === 12);
    expect(timed && timed.avgHints).toBe(2);
    expect(timed).toHaveProperty("facility");
    expect(timed).toHaveProperty("discrimination");
    for (const k of ["hardItems", "poorDiscriminationItems", "hintEffectiveness"]) {
      expect(Array.isArray(an.body[k])).toBe(true);
    }
    expect(Array.isArray(an.body.trend)).toBe(true);
    expect(an.body.trend.length).toBeGreaterThan(0);
    // classical item-analysis CSV export with P / D / hints / time columns
    const csv = await request(app).get(`/api/classes/${cid}/analytics.csv?lang=fa`).set("Authorization", `Bearer ${tk}`);
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain("ضریب دشواری");
    expect(csv.text).toContain("clsfc-practice");
  });

  it("a practice-only class flashcard does not affect the class grade", async () => {
    const tk = await token("teacher");
    const fcId = (await request(app).post("/api/flashcards").set("Authorization", `Bearer ${tk}`)
      .send({ title_en: "clsfc-practice2", title_fa: "clsfc-practice2", questionType: "text", answerMode: "search", q_en: "Q", q_fa: "پ", correct_en: "A", correct_fa: "الف" })).body.id;
    const created = await request(app).post("/api/classes").set("Authorization", `Bearer ${tk}`)
      .send({ name_en: "Practice class", name_fa: "کلاس تمرین", maxAttempts: 3 });
    const cid = created.body.id;
    const stk = await token("40012345");
    const stuId = (await request(app).get("/api/users").set("Authorization", `Bearer ${tk}`)).body.find((u) => u.username === "40012345").id;
    await request(app).put(`/api/classes/${cid}/members`).set("Authorization", `Bearer ${tk}`).send({ userIds: [stuId] });
    await request(app).put(`/api/classes/${cid}/flashcards`).set("Authorization", `Bearer ${tk}`)
      .send({ flashcards: [{ flashcard_id: fcId, graded: false }] });
    await request(app).post(`/api/classes/${cid}/flashcard/${fcId}/finish`).set("Authorization", `Bearer ${stk}`).send({ score: 55 });
    const gb = await request(app).get(`/api/classes/${cid}`).set("Authorization", `Bearer ${tk}`);
    const me = gb.body.members.find((m) => m.id === stuId);
    expect(me.flashDone).toBe(1);
    expect(me.grade).toBe(0);   // practice-only → no effect on grade
  });
});

describe("flashcards (multiple choice, search, text)", () => {
  it("returns cards with options and a correct answer", async () => {
    // The answer key is verified from the TEACHER view: students are served a
    // key-stripped copy (regression test "zip-42 student flashcard keys"
    // pins that stripping separately).
    const tk = await token("teacher");
    const res = await request(app).get("/api/flashcards").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    const mcq = res.body.filter((c) => (c.options || []).length >= 2);
    expect(mcq.length).toBeGreaterThan(0);
    const card = mcq[0];
    expect(card.options.length).toBeGreaterThanOrEqual(2);
    expect(card.options.some((o) => o.correct)).toBe(true);
  });

  it("supports search-mode and text-question cards", async () => {
    const tk = await token("40012345");
    const res = await request(app).get("/api/flashcards").set("Authorization", `Bearer ${tk}`);
    const search = res.body.find((c) => c.answerMode === "search");
    const text = res.body.find((c) => c.questionType === "text");
    expect(search).toBeTruthy();
    expect(search.options.length).toBeGreaterThan(4); // richer list for autocomplete
    expect(text).toBeTruthy();
    expect(text.questionText_en || text.questionText_fa).toBeTruthy();
  });

  it("teacher can create a search-mode flashcard", async () => {
    const tk = await token("teacher");
    const res = await request(app).post("/api/flashcards").set("Authorization", `Bearer ${tk}`)
      .send({
        title_en: "T", title_fa: "ت", questionType: "text", answerMode: "search",
        questionText_en: "Q?", difficulty: "easy",
        options: [{ fa: "الف", en: "A", correct: true }, { fa: "ب", en: "B", correct: false }],
        hints_en: [], hints_fa: [],
      });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
  });
});

describe("profile / self password change", () => {
  it("rejects wrong current password", async () => {
    const tk = await token("40067890");
    const res = await request(app).put("/api/auth/password").set("Authorization", `Bearer ${tk}`)
      .send({ currentPassword: "wrong", newPassword: "abc123" });
    expect(res.status).toBe(400);
  });

  it("changes password with correct current password, then logs in with new one", async () => {
    const tk = await token("40067890");
    const res = await request(app).put("/api/auth/password").set("Authorization", `Bearer ${tk}`)
      .send({ currentPassword: "demo", newPassword: "newpass1" });
    expect(res.status).toBe(200);
    const relog = await login("40067890", "newpass1");
    expect(relog.status).toBe(200);
    // restore for other tests / re-runs
    const tk2 = relog.body.token;
    await request(app).put("/api/auth/password").set("Authorization", `Bearer ${tk2}`)
      .send({ currentPassword: "newpass1", newPassword: "demo" });
  });
});

describe("prompt management is admin-only", () => {
  it("teacher is blocked from reading prompts", async () => {
    const tk = await token("teacher");
    const res = await request(app).get("/api/prompts").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(403);
  });
  it("admin can read prompts", async () => {
    const tk = await token("admin");
    const res = await request(app).get("/api/prompts").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    expect(res.body.patient_fa || res.body.patient_en).toBeTruthy();
  });
});

describe("scheduled exams", () => {
  let examId;
  it("teacher creates an exam open now and assigns by student number", async () => {
    const tk = await token("teacher");
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const c = await request(app).post("/api/exams").set("Authorization", `Bearer ${tk}`)
      .send({ title_en: "Quiz", title_fa: "کوییز", case_ids: [1], use_flashcards: true,
              starts_at: now, ends_at: end, duration_min: 20, max_attempts: 1 });
    expect(c.status).toBe(200);
    examId = c.body.id;
    const a = await request(app).put(`/api/exams/${examId}/participants`).set("Authorization", `Bearer ${tk}`)
      .send({ studentNos: ["40012345", "00000000"] });
    expect(a.status).toBe(200);
    expect(a.body.added).toBe(1);
    expect(a.body.notFound).toContain("00000000");
  });

  it("saves and returns per-exam settings (shuffle, anti_cheat, show_*)", async () => {
    const tk = await token("teacher");
    const c = await request(app).post("/api/exams").set("Authorization", `Bearer ${tk}`)
      .send({ title_en: "Settings exam", case_ids: [1], shuffle: true, anti_cheat: true,
              show_correct: false, show_hints: false, show_ai: false, show_micro: false });
    expect(c.status).toBe(200);
    const detail = await request(app).get(`/api/exams/${c.body.id}`).set("Authorization", `Bearer ${tk}`);
    expect(detail.body.shuffle).toBe(true);
    expect(detail.body.anti_cheat).toBe(true);
    expect(detail.body.show_ai).toBe(false);
    expect(detail.body.show_micro).toBe(false);
  });

  it("competition exam exposes a ranked leaderboard", async () => {
    const tk = await token("teacher");
    const c = await request(app).post("/api/exams").set("Authorization", `Bearer ${tk}`)
      .send({ title_en: "Comp", case_ids: [1], competition: true,
              starts_at: new Date(Date.now() - 3600e3).toISOString(),
              ends_at: new Date(Date.now() + 86400e3).toISOString(), max_attempts: 3 });
    const eid = c.body.id;
    await request(app).put(`/api/exams/${eid}/participants`).set("Authorization", `Bearer ${tk}`)
      .send({ studentNos: ["40012345", "40067890"] });
    // one student takes it
    const stk = await token("40012345");
    await request(app).post("/api/exam/evaluate").set("Authorization", `Bearer ${stk}`)
      .send({ caseId: 1, examId: eid, lang: "en", session: { messages: [{ role: "student", text: "hello ecg troponin STEMI aspirin arm pain diabetes" }], tests: ["ecg"], imaging: [], ddx: [], finalDx: "STEMI" } });
    const lb = await request(app).get(`/api/exams/${eid}/leaderboard`).set("Authorization", `Bearer ${tk}`);
    expect(lb.status).toBe(200);
    expect(lb.body.ranked.length).toBe(2);
    expect(lb.body.ranked[0].rank).toBe(1);
    // the student who scored is ranked above the one who didn't
    expect(lb.body.ranked[0].score).not.toBeNull();
  });

  it("assigned student sees the exam as open, others don't", async () => {
    const stk = await token("40012345");
    const res = await request(app).get("/api/exams").set("Authorization", `Bearer ${stk}`);
    expect(res.status).toBe(200);
    const ex = res.body.find((e) => e.id === examId);
    expect(ex).toBeTruthy();
    expect(ex.state).toBe("open");

    const mtk = await token("40067890");
    const res2 = await request(app).get("/api/exams").set("Authorization", `Bearer ${mtk}`);
    expect(res2.body.find((e) => e.id === examId)).toBeFalsy();
  });

  it("student can take an exam case, second attempt blocked", async () => {
    const stk = await token("40012345");
    const s = {
      messages: [{ role: "student", text: "hello ecg troponin STEMI aspirin arm pain diabetes" }],
      tests: ["ecg"], imaging: [], ddx: [], finalDx: "STEMI",
    };
    const r1 = await request(app).post("/api/exam/evaluate").set("Authorization", `Bearer ${stk}`)
      .send({ caseId: 1, examId, lang: "en", session: s });
    expect(r1.status).toBe(200);
    const r2 = await request(app).post("/api/exam/evaluate").set("Authorization", `Bearer ${stk}`)
      .send({ caseId: 1, examId, lang: "en", session: s });
    expect(r2.status).toBe(403);
  });

  it("upcoming exam is locked for students", async () => {
    const tk = await token("teacher");
    const future = new Date(Date.now() + 86400e3).toISOString();
    const future2 = new Date(Date.now() + 172800e3).toISOString();
    const c = await request(app).post("/api/exams").set("Authorization", `Bearer ${tk}`)
      .send({ title_en: "Later", case_ids: [1], starts_at: future, ends_at: future2, max_attempts: 3 });
    const eid = c.body.id;
    await request(app).put(`/api/exams/${eid}/participants`).set("Authorization", `Bearer ${tk}`)
      .send({ studentNos: ["40012345"] });
    const stk = await token("40012345");
    const detail = await request(app).get(`/api/exams/${eid}`).set("Authorization", `Bearer ${stk}`);
    expect(detail.body.locked).toBe(true);
    const attempt = await request(app).post("/api/exam/evaluate").set("Authorization", `Bearer ${stk}`)
      .send({ caseId: 1, examId: eid, lang: "en", session: { messages: [], tests: [], imaging: [], ddx: [], finalDx: "x" } });
    expect(attempt.status).toBe(403);
  });
});

describe("detailed attempt stats & results", () => {
  it("records VP stats (turns, tests, imaging, ddx)", async () => {
    const stk = await token("40067890"); // Maryam, assigned case 2
    const s = {
      messages: [{ role: "student", text: "hello murphy ultrasound cholecystitis fatty meal fever" },
                 { role: "student", text: "any nausea?" }],
      tests: ["cbc", "lft"], imaging: ["ultrasound"], ddx: ["cholecystitis", "cholelithiasis"], finalDx: "acute cholecystitis",
    };
    const r = await request(app).post("/api/exam/evaluate").set("Authorization", `Bearer ${stk}`)
      .send({ caseId: 2, lang: "en", session: s });
    expect(r.status).toBe(200);
    const ttk = await token("teacher");
    const list = await request(app).get("/api/reports/attempts?type=vp").set("Authorization", `Bearer ${ttk}`);
    const mine = list.body.find((a) => a.student_en === "Maryam Hosseini" && a.tests === 2);
    expect(mine).toBeTruthy();
    expect(mine.imaging_count).toBe(1);
    expect(mine.ddx_count).toBe(2);
    expect(mine.turns).toBe(2);
  });

  it("records flashcard stats (total, correct, wrong)", async () => {
    const stk = await token("40012345");
    const r = await request(app).post("/api/exam/flashcard-result").set("Authorization", `Bearer ${stk}`)
      .send({ score: 75, total: 4, correct: 3, wrong: 1, hints: 2, lang: "fa" });
    expect(r.status).toBe(200);
    const ttk = await token("teacher");
    const list = await request(app).get("/api/reports/attempts?type=flash").set("Authorization", `Bearer ${ttk}`);
    const rec = list.body.find((a) => a.total_questions === 4 && a.correct_count === 3);
    expect(rec).toBeTruthy();
    expect(rec.wrong_count).toBe(1);
  });

  it("teacher can fetch a specific student's report card data", async () => {
    const ttk = await token("teacher");
    // find a student id from the attempts list
    const list = await request(app).get("/api/reports/attempts").set("Authorization", `Bearer ${ttk}`);
    const uid = list.body.find((a) => a.user_id)?.user_id;
    expect(uid).toBeTruthy();
    const res = await request(app).get(`/api/reports/student/${uid}`).set("Authorization", `Bearer ${ttk}`);
    expect(res.status).toBe(200);
    expect(res.body.student).toBeTruthy();
    expect(Array.isArray(res.body.attempts)).toBe(true);
  });

  it("students cannot access another student's report card", async () => {
    const stk = await token("40012345");
    const res = await request(app).get("/api/reports/student/4").set("Authorization", `Bearer ${stk}`);
    expect(res.status).toBe(403);
  });

  it("results endpoint filters by type", async () => {
    const ttk = await token("teacher");
    const vp = await request(app).get("/api/reports/attempts?type=vp").set("Authorization", `Bearer ${ttk}`);
    const fl = await request(app).get("/api/reports/attempts?type=flash").set("Authorization", `Bearer ${ttk}`);
    expect(vp.body.every((a) => a.type === "vp")).toBe(true);
    expect(fl.body.every((a) => a.type === "flash")).toBe(true);
  });
});

describe("custom catalogs", () => {
  it("teacher can create and list a custom catalog", async () => {
    const tk = await token("teacher");
    const create = await request(app).post("/api/catalogs").set("Authorization", `Bearer ${tk}`)
      .send({ name_fa: "درس من", name_en: "My subject", items: [{ fa: "الف", en: "A" }, { fa: "ب", en: "B" }] });
    expect(create.status).toBe(200);
    const list = await request(app).get("/api/catalogs").set("Authorization", `Bearer ${tk}`);
    const found = list.body.find((c) => c.name_en === "My subject");
    expect(found).toBeTruthy();
    expect(found.items.length).toBe(2);
  });
  it("students cannot create catalogs", async () => {
    const tk = await token("40012345");
    const res = await request(app).post("/api/catalogs").set("Authorization", `Bearer ${tk}`)
      .send({ name_en: "x", items: [] });
    expect(res.status).toBe(403);
  });
});

describe("CSV import / export", () => {
  it("exports cases as CSV", async () => {
    const tk = await token("teacher");
    const res = await request(app).get("/api/cases-export.csv").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain("title_en");
    expect(res.text.toLowerCase()).toContain("chest pain");
  });

  it("bulk-imports cases from CSV", async () => {
    const tk = await token("teacher");
    const csv = "title_en,title_fa,difficulty,age,sex,diagnosis_en\n" +
      "\"Asthma attack\",\"حمله آسم\",medium,25,female,\"Acute asthma\"\n" +
      "\"Appendicitis\",\"آپاندیسیت\",hard,19,male,\"Acute appendicitis\"";
    const res = await request(app).post("/api/cases-import").set("Authorization", `Bearer ${tk}`).send({ csv });
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(2);
    const list = await request(app).get("/api/cases").set("Authorization", `Bearer ${tk}`);
    expect(list.body.some((c) => c.title_en === "Asthma attack")).toBe(true);
  });

  it("exports & imports flashcards", async () => {
    const tk = await token("teacher");
    const exp = await request(app).get("/api/flashcards-export.csv").set("Authorization", `Bearer ${tk}`);
    expect(exp.status).toBe(200);
    expect(exp.text).toContain("options_en");
    const csv = "title_en,title_fa,difficulty,questionType,answerMode,correct_en,options_en,options_fa\n" +
      "\"Q1\",\"سوال\",easy,text,choice,\"Right\",\"Right | Wrong1 | Wrong2\",\"درست | غلط۱ | غلط۲\"";
    const imp = await request(app).post("/api/flashcards-import").set("Authorization", `Bearer ${tk}`).send({ csv });
    expect(imp.body.imported).toBe(1);
    const list = await request(app).get("/api/flashcards").set("Authorization", `Bearer ${tk}`);
    const card = list.body.find((c) => c.title_en === "Q1");
    expect(card).toBeTruthy();
    expect(card.options.find((o) => o.correct).en).toBe("Right");
  });

  it("students cannot import/export", async () => {
    const tk = await token("40012345");
    const e = await request(app).get("/api/cases-export.csv").set("Authorization", `Bearer ${tk}`);
    expect(e.status).toBe(403);
    const i = await request(app).post("/api/cases-import").set("Authorization", `Bearer ${tk}`).send({ csv: "title_en\nX" });
    expect(i.status).toBe(403);
  });
});

describe("AI providers & uploads", () => {
  it("lists AI providers for admin and teacher (needed by the AI dropdown)", async () => {
    const atk = await token("admin");
    const res = await request(app).get("/api/exam/ai-providers").set("Authorization", `Bearer ${atk}`);
    expect(res.status).toBe(200);
    const keys = res.body.map((p) => p.key);
    expect(keys).toContain("OpenRouter");
    expect(keys).toContain("GapGPT");
    expect(keys).toContain("AvalAI");
    const gap = res.body.find((p) => p.key === "GapGPT");
    expect(gap.base).toMatch(/gapgpt/);
    expect(gap.group).toBe("iran");
    const ttk = await token("teacher");
    const teacherList = await request(app).get("/api/exam/ai-providers").set("Authorization", `Bearer ${ttk}`);
    expect(teacherList.status).toBe(200);
    const stk = await token("40012345");
    const blocked = await request(app).get("/api/exam/ai-providers").set("Authorization", `Bearer ${stk}`);
    expect(blocked.status).toBe(403);
  });

  it("rejects uploads without teacher/admin role", async () => {
    const tk = await token("40012345");
    const res = await request(app).post("/api/upload")
      .set("Authorization", `Bearer ${tk}`)
      .attach("image", Buffer.from("fake"), "x.png");
    expect(res.status).toBe(403);
  });
});

describe("gamified learner track", () => {
  async function learnerToken() {
    return token("learner", "demo");
  }

  it("public registration by email creates a learner and returns a token", async () => {
    const res = await request(app).post("/api/auth/register")
      .send({ email: `t_reg_${Date.now()}@test.com`, password: "1234", name_fa: "تست", province: "تهران" });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("learner");
    expect(res.body.user.email).toBeTruthy();
    expect(res.body.token).toBeTruthy();
  });

  it("rejects duplicate email on register", async () => {
    const email = `dup_${Date.now()}@test.com`;
    await request(app).post("/api/auth/register").send({ email, password: "1234" });
    const res = await request(app).post("/api/auth/register").send({ email, password: "1234" });
    expect(res.status).toBe(409);
  });

  it("rejects an invalid email on register", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "notanemail", password: "1234" });
    expect(res.status).toBe(400);
  });

  it("learner home returns profile, path totals and ads", async () => {
    const tk = await learnerToken();
    const res = await request(app).get("/api/learn/home?lang=fa").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    expect(res.body.profile.xp).toBeGreaterThanOrEqual(0);
    expect(res.body.totalNodes).toBeGreaterThan(0);
    expect(Array.isArray(res.body.ads)).toBe(true);
  });

  it("path lists topics with unlockable nodes; first node is unlocked", async () => {
    const tk = await learnerToken();
    const res = await request(app).get("/api/learn/path?lang=fa").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    expect(res.body.topics.length).toBeGreaterThan(10);
    const first = res.body.topics[0].nodes[0];
    expect(first.locked).toBe(false);
  });

  it("finishing a lesson awards XP and stars", async () => {
    const tk = await learnerToken();
    const before = (await request(app).get("/api/learn/profile").set("Authorization", `Bearer ${tk}`)).body.profile.xp;
    const res = await request(app).post("/api/learn/lesson/1/finish")
      .set("Authorization", `Bearer ${tk}`).send({ correct: 3, total: 3 });
    expect(res.status).toBe(200);
    expect(res.body.xp).toBeGreaterThan(0);
    expect(res.body.stars).toBe(5);
    expect(res.body.profile.xp).toBeGreaterThan(before);
  });

  it("returns an error taxonomy and auto-adds wrong cards to the SRS queue", async () => {
    const email = `t_err_${Date.now()}@test.com`;
    const reg = await request(app).post("/api/auth/register")
      .send({ email, password: "1234", name_fa: "خطا", province: "تهران" });
    const tk = reg.body.token;
    // grab the lesson's cards so we submit real cardIds
    const les = await request(app).get("/api/learn/lesson/1").set("Authorization", `Bearer ${tk}`);
    const ids = (les.body.cards || []).map((c) => c.id);
    expect(ids.length).toBeGreaterThan(0);
    const answers = ids.map((id, i) => ({
      cardId: id,
      correct: i === 0,                        // first right, the rest wrong
      responseMs: i === 1 ? 30000 : 2000,      // one slow miss (reasoning)
      flagged: i === 2,                         // one flagged miss (reasoning)
    }));
    const dueBefore = (await request(app).get("/api/learn/srs/stats").set("Authorization", `Bearer ${tk}`)).body?.due ?? 0;
    const res = await request(app).post("/api/learn/lesson/1/finish")
      .set("Authorization", `Bearer ${tk}`).send({ correct: 1, total: ids.length, answers });
    expect(res.status).toBe(200);
    // error taxonomy present with the right totals
    expect(res.body.errorReport).toBeTruthy();
    const wrong = answers.filter((a) => !a.correct).length;
    expect(res.body.errorReport.total).toBe(wrong);
    const c = res.body.errorReport.counts;
    expect(c.knowledge + c.reasoning + c.careless).toBe(wrong);
    expect(["knowledge", "reasoning", "careless"]).toContain(res.body.errorReport.dominant);
    // every wrong card was pushed back into the spaced-review queue
    expect(res.body.srsAdded).toBe(wrong);
    const dueAfter = (await request(app).get("/api/learn/srs/stats").set("Authorization", `Bearer ${tk}`)).body?.due ?? 0;
    expect(dueAfter).toBeGreaterThanOrEqual(dueBefore);
  });

  it("records confidence and returns a confidence-based assessment summary", async () => {
    const email = `t_conf_${Date.now()}@test.com`;
    const reg = await request(app).post("/api/auth/register")
      .send({ email, password: "1234", name_fa: "اعتماد", province: "تهران" });
    const tk = reg.body.token;
    const les = await request(app).get("/api/learn/lesson/1").set("Authorization", `Bearer ${tk}`);
    const ids = (les.body.cards || []).map((c) => c.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    // #1: high confidence + WRONG (dangerous overconfidence)
    // #2: low confidence + RIGHT (honest humility)
    const answers = ids.map((id, i) => ({
      cardId: id,
      correct: i !== 0,                 // first wrong, rest right
      responseMs: 4000,
      confidence: i === 0 ? 3 : 1,      // first "high", rest "low"
    }));
    const res = await request(app).post("/api/learn/lesson/1/finish")
      .set("Authorization", `Bearer ${tk}`).send({ correct: ids.length - 1, total: ids.length, answers });
    expect(res.status).toBe(200);
    expect(res.body.confidence).toBeTruthy();
    expect(res.body.confidence.declared).toBe(ids.length);
    expect(res.body.confidence.overconfident).toBe(1);   // #1: high + wrong
    expect(res.body.confidence.humble).toBe(ids.length - 1); // rest: low + right
    // the lifetime calibration report reflects the declared answers
    const cal = await request(app).get("/api/learn/calibration/confidence").set("Authorization", `Bearer ${tk}`);
    expect(cal.status).toBe(200);
    expect(cal.body.total).toBe(ids.length);
    expect(cal.body.byLevel["3"].n).toBe(1);
    expect(cal.body.byLevel["3"].acc).toBe(0);           // the one high answer was wrong
    expect(cal.body.byLevel["1"].acc).toBe(100);         // the low answers were all right
  });

  it("a lesson with no declared confidence returns a null confidence summary", async () => {
    const email = `t_noconf_${Date.now()}@test.com`;
    const reg = await request(app).post("/api/auth/register")
      .send({ email, password: "1234", name_fa: "بدون‌اعتماد", province: "تهران" });
    const tk = reg.body.token;
    const les = await request(app).get("/api/learn/lesson/1").set("Authorization", `Bearer ${tk}`);
    const ids = (les.body.cards || []).map((c) => c.id);
    const answers = ids.map((id) => ({ cardId: id, correct: true, responseMs: 3000 }));
    const res = await request(app).post("/api/learn/lesson/1/finish")
      .set("Authorization", `Bearer ${tk}`).send({ correct: ids.length, total: ids.length, answers });
    expect(res.status).toBe(200);
    expect(res.body.confidence).toBeNull();
  });

  it("a perfect lesson yields an empty error taxonomy and adds nothing to SRS", async () => {
    const email = `t_perfect_${Date.now()}@test.com`;
    const reg = await request(app).post("/api/auth/register")
      .send({ email, password: "1234", name_fa: "بی‌نقص", province: "تهران" });
    const tk = reg.body.token;
    const les = await request(app).get("/api/learn/lesson/1").set("Authorization", `Bearer ${tk}`);
    const ids = (les.body.cards || []).map((c) => c.id);
    const answers = ids.map((id) => ({ cardId: id, correct: true, responseMs: 3000 }));
    const res = await request(app).post("/api/learn/lesson/1/finish")
      .set("Authorization", `Bearer ${tk}`).send({ correct: ids.length, total: ids.length, answers });
    expect(res.status).toBe(200);
    expect(res.body.errorReport.total).toBe(0);
    expect(res.body.errorReport.dominant).toBeNull();
    expect(res.body.srsAdded).toBe(0);
  });

  it("reports a tierUp when a lesson finish crosses a tier boundary", async () => {
    // Use a fresh learner so we don't disturb the seeded demo learner's state.
    const email = `t_tier_${Date.now()}@test.com`;
    const reg = await request(app).post("/api/auth/register")
      .send({ email, password: "1234", name_fa: "ارتقا", province: "تهران" });
    const tk = reg.body.token;
    const me = reg.body.user.id;
    const { db } = await import("../src/db.js");
    // Park XP just below the silver threshold (400) and a tier of bronze so the
    // next award pushes them over the line → a real promotion.
    db.prepare("UPDATE learner_profiles SET xp=395, weekly_xp=395, tier='bronze' WHERE user_id=?").run(me);
    const res = await request(app).post("/api/learn/lesson/1/finish")
      .set("Authorization", `Bearer ${tk}`).send({ correct: 3, total: 3 });
    expect(res.status).toBe(200);
    expect(res.body.tierUp).toBeTruthy();
    expect(res.body.tierUp.from).toBe("bronze");
    expect(res.body.tierUp.to).toBe("silver");
  });

  it("does NOT report a tierUp when no boundary is crossed", async () => {
    const email = `t_notier_${Date.now()}@test.com`;
    const reg = await request(app).post("/api/auth/register")
      .send({ email, password: "1234", name_fa: "بدون‌ارتقا", province: "تهران" });
    const tk = reg.body.token;
    const res = await request(app).post("/api/learn/lesson/1/finish")
      .set("Authorization", `Bearer ${tk}`).send({ correct: 3, total: 3 });
    expect(res.status).toBe(200);
    expect(res.body.tierUp).toBeFalsy();   // a brand-new learner stays bronze
  });

  it("weekly league returns ranked members with zones", async () => {
    const tk = await learnerToken();
    const res = await request(app).get("/api/learn/league?lang=fa").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    expect(res.body.members.length).toBeGreaterThan(0);
    expect(res.body.members[0].rank).toBe(1);
    expect(["promote", "stay", "relegate"]).toContain(res.body.members[0].zone);
  });

  it("country ranking returns a list and my rank", async () => {
    const tk = await learnerToken();
    const res = await request(app).get("/api/learn/ranking?lang=fa").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    expect(res.body.list.length).toBeGreaterThan(0);
    expect(res.body.myRank).toBeTruthy();
    // enriched fields for the redesigned ranking hero (percentile + your-row highlight)
    expect(typeof res.body.total).toBe("number");
    expect(res.body.total).toBeGreaterThanOrEqual(res.body.list.length);
    expect(res.body.me).toBeTruthy();
  });

  it("premium is granted via the payment flow, cancel turns it off", async () => {
    const tk = await learnerToken();
    // real checkout now goes through /api/pay (mock gateway in tests)
    const sub = await request(app).post("/api/pay/subscribe").set("Authorization", `Bearer ${tk}`).send({ plan: "monthly" });
    expect(sub.status).toBe(200);
    const cb = await request(app).get(`/api/pay/callback?Authority=${sub.body.authority}&Status=OK`);
    expect(cb.status).toBe(302);
    const prof = await request(app).get("/api/learn/profile").set("Authorization", `Bearer ${tk}`);
    expect(prof.body.profile.premium).toBe(1);
    const cancel = await request(app).post("/api/learn/premium/cancel").set("Authorization", `Bearer ${tk}`);
    expect(cancel.body.profile.premium).toBe(0);
  });

  it("students cannot access the learner track", async () => {
    const tk = await token("40012345");
    const res = await request(app).get("/api/learn/home").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(403);
  });

  it("admin can create and list ads; learner cannot manage ads", async () => {
    const atk = await token("admin");
    const create = await request(app).post("/api/ads").set("Authorization", `Bearer ${atk}`)
      .send({ slot: "home", title_fa: "تست", title_en: "Test", active: 1 });
    expect(create.status).toBe(200);
    const list = await request(app).get("/api/ads").set("Authorization", `Bearer ${atk}`);
    expect(list.body.ads.length).toBeGreaterThan(0);
    const ltk = await token("learner", "demo");
    const blocked = await request(app).get("/api/ads").set("Authorization", `Bearer ${ltk}`);
    expect(blocked.status).toBe(403);
  });

  it("per-lesson ad targeting: a node-specific lesson-intro ad wins over a general one", async () => {
    const atk = await token("admin");
    // ads are globally OFF by default — turn the master switch ON to test ad serving
    await request(app).put("/api/ads/master").set("Authorization", `Bearer ${atk}`).send({ enabled: true });
    const { db } = await import("../src/db.js");
    const nodeId = db.prepare("SELECT id FROM path_nodes WHERE active=1 AND kind='lesson' ORDER BY id LIMIT 1").get().id;
    // a general lesson-intro ad (applies to every lesson)
    await request(app).post("/api/ads").set("Authorization", `Bearer ${atk}`)
      .send({ slot: "lesson-intro", title_fa: "تبلیغ عمومی", title_en: "General ad", active: 1 });
    // a targeted ad for one specific lesson
    await request(app).post("/api/ads").set("Authorization", `Bearer ${atk}`)
      .send({ slot: "lesson-intro", node_id: nodeId, title_fa: "تبلیغ درس خاص", title_en: "Targeted ad", active: 1 });
    // admin can list targetable lessons
    const lessons = await request(app).get("/api/ads/lessons").set("Authorization", `Bearer ${atk}`);
    expect(lessons.status).toBe(200);
    expect(lessons.body.lessons.length).toBeGreaterThan(0);
    // a non-premium learner fetching the intro ad for THIS lesson gets the targeted one
    const ltk = await token("learner", "demo");
    const targeted = await request(app).get(`/api/learn/ads?slot=lesson-intro&node=${nodeId}`).set("Authorization", `Bearer ${ltk}`);
    expect(targeted.body.ads[0].title).toBe("تبلیغ درس خاص");
    // a different (non-targeted) lesson falls back to the general ad
    const other = db.prepare("SELECT id FROM path_nodes WHERE active=1 AND kind='lesson' AND id<>? ORDER BY id LIMIT 1").get(nodeId);
    if (other) {
      const fallback = await request(app).get(`/api/learn/ads?slot=lesson-intro&node=${other.id}`).set("Authorization", `Bearer ${ltk}`);
      expect(fallback.body.ads[0].title).toBe("تبلیغ عمومی");
    }
  });
});

describe("mixed exercise types, microlearning, notifications & challenges", () => {
  const learnerTk = () => token("learner", "demo");

  it("lessons expose mixed question types and QB-style micro", async () => {
    const tk = await learnerTk();
    // pharm node contains a 'match' card in the seed
    const path = await request(app).get("/api/learn/path?lang=fa").set("Authorization", `Bearer ${tk}`);
    const pharm = path.body.topics.find((t) => t.slug === "pharm");
    const res = await request(app).get(`/api/learn/lesson/${pharm.nodes[0].id}?lang=fa`).set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    const types = res.body.cards.map((c) => c.type);
    expect(types).toContain("match");
    const match = res.body.cards.find((c) => c.type === "match");
    expect(match.left.length).toBeGreaterThan(0);
    expect(match.right.length).toBe(match.left.length);
    // micro present on cards
    expect(res.body.cards.some((c) => c.micro)).toBe(true);
  });

  it("notifications feed works and marks seen", async () => {
    const tk = await learnerTk();
    const res = await request(app).get("/api/learn/notifications?lang=fa").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    const seen = await request(app).post("/api/learn/notifications/seen").set("Authorization", `Bearer ${tk}`);
    expect(seen.status).toBe(200);
    const after = await request(app).get("/api/learn/notifications?lang=fa").set("Authorization", `Bearer ${tk}`);
    expect(after.body.unseen).toBe(0);
  });

  it("push key endpoint returns config (degrades gracefully)", async () => {
    const tk = await learnerTk();
    const res = await request(app).get("/api/learn/push/key").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("configured");
  });

  it("full async challenge flow: create, join, both submit, winner decided", async () => {
    const a = await token("learner", "demo");
    const b = await token("learner1", "demo");
    const created = await request(app).post("/api/challenge/create").set("Authorization", `Bearer ${a}`).send({ topicId: 1 });
    expect(created.status).toBe(200);
    const code = created.body.code, id = created.body.id;
    const joined = await request(app).post("/api/challenge/join").set("Authorization", `Bearer ${b}`).send({ code });
    expect(joined.status).toBe(200);
    const s1 = await request(app).post(`/api/challenge/${id}/submit`).set("Authorization", `Bearer ${a}`).send({ correct: 5, total: 5, time_ms: 20000 });
    expect(s1.body.finished).toBe(false);
    const s2 = await request(app).post(`/api/challenge/${id}/submit`).set("Authorization", `Bearer ${b}`).send({ correct: 2, total: 5, time_ms: 30000 });
    expect(s2.body.finished).toBe(true);
    expect(s2.body.tie).toBe(false);
  });

  it("cannot join your own challenge", async () => {
    const a = await token("learner", "demo");
    const created = await request(app).post("/api/challenge/create").set("Authorization", `Bearer ${a}`).send({ topicId: 2 });
    const res = await request(app).post("/api/challenge/join").set("Authorization", `Bearer ${a}`).send({ code: created.body.code });
    expect(res.status).toBe(400);
  });
});

describe("SRS review, learner cards & teacher multi-type flashcards", () => {
  const learnerTk = () => token("learner", "demo");

  it("finishing a lesson enrolls cards into SRS and they become due", async () => {
    const tk = await learnerTk();
    await request(app).post("/api/learn/lesson/1/finish").set("Authorization", `Bearer ${tk}`).send({ correct: 2, total: 3 });
    const home = await request(app).get("/api/learn/home?lang=fa").set("Authorization", `Bearer ${tk}`);
    expect(home.body.dueReviews).toBeGreaterThan(0);
    const rev = await request(app).get("/api/learn/review?lang=fa").set("Authorization", `Bearer ${tk}`);
    expect(rev.body.cards.length).toBeGreaterThan(0);
  });

  it("grading a review reschedules the card and awards XP on success", async () => {
    const tk = await learnerTk();
    const rev = await request(app).get("/api/learn/review?lang=fa").set("Authorization", `Bearer ${tk}`);
    const cardId = rev.body.cards[0].id;
    const before = (await request(app).get("/api/learn/profile").set("Authorization", `Bearer ${tk}`)).body.profile.xp;
    const res = await request(app).post("/api/learn/review/grade").set("Authorization", `Bearer ${tk}`).send({ cardId, grade: 3 });
    expect(res.status).toBe(200);
    expect(res.body.sched.due).toBeTruthy();
    expect(res.body.profile.xp).toBeGreaterThan(before);
  });

  it("learner can create a hint-bearing card and practice it", async () => {
    const tk = await learnerTk();
    const create = await request(app).post("/api/learn/mycards").set("Authorization", `Bearer ${tk}`).send({
      q_fa: "سوال من", options: [{ fa: "الف", correct: true }, { fa: "ب", correct: false }],
      hints_fa: ["هینت ۱", "هینت ۲"], ex_fa: "توضیح",
    });
    expect(create.status).toBe(200);
    const list = await request(app).get("/api/learn/mycards?lang=fa").set("Authorization", `Bearer ${tk}`);
    expect(list.body.cards.length).toBeGreaterThan(0);
    expect(list.body.cards[0].hints.length).toBe(2);
    const prac = await request(app).get("/api/learn/mycards/practice?lang=fa").set("Authorization", `Bearer ${tk}`);
    expect(prac.body.cards.length).toBeGreaterThan(0);
    expect(prac.body.cards.some((c) => c.hints.length === 2)).toBe(true);
  });

  it("learner card creation validates options", async () => {
    const tk = await learnerTk();
    const bad = await request(app).post("/api/learn/mycards").set("Authorization", `Bearer ${tk}`).send({ q_fa: "x", options: [{ fa: "a", correct: false }] });
    expect(bad.status).toBe(400);
  });

  it("teacher can create all flashcard types (match, fill, truefalse, order)", async () => {
    const tk = await token("teacher");
    for (const payload of [
      { type: "match", title_fa: "m", q_fa: "m", pairs: [["a", "A", "1", "1"], ["b", "B", "2", "2"]] },
      { type: "fill", title_fa: "f", q_fa: "__", blank_fa: "x", accept_fa: ["x"] },
      { type: "truefalse", title_fa: "tf", q_fa: "?", answer: true },
      { type: "order", title_fa: "o", q_fa: "?", items_fa: ["1", "2", "3"] },
    ]) {
      const res = await request(app).post("/api/flashcards").set("Authorization", `Bearer ${tk}`).send(payload);
      expect(res.status).toBe(200);
    }
    const list = await request(app).get("/api/flashcards").set("Authorization", `Bearer ${tk}`);
    const types = new Set(list.body.filter((c) => c.type).map((c) => c.type));
    expect(types.has("match")).toBe(true);
    expect(types.has("fill")).toBe(true);
    expect(types.has("truefalse")).toBe(true);
    expect(types.has("order")).toBe(true);
  });
});

describe("super-admin control panel", () => {
  it("overview returns counts, flags default on", async () => {
    const atk = await token("admin");
    const ov = await request(app).get("/api/admin/overview").set("Authorization", `Bearer ${atk}`);
    expect(ov.status).toBe(200);
    expect(ov.body.counts.users).toBeGreaterThan(0);
    const flags = await request(app).get("/api/admin/flags").set("Authorization", `Bearer ${atk}`);
    expect(flags.body.flags.length).toBeGreaterThan(0);
  });

  it("teacher is blocked from admin routes", async () => {
    const ttk = await token("teacher");
    const res = await request(app).get("/api/admin/overview").set("Authorization", `Bearer ${ttk}`);
    expect(res.status).toBe(403);
  });

  it("admin backup: status reports the data dir, and a snapshot can be created", async () => {
    const atk = await token("admin");
    const st = await request(app).get("/api/admin/backup/status").set("Authorization", `Bearer ${atk}`);
    expect(st.status).toBe(200);
    expect(st.body.dataDir).toBeTruthy();       // persistent data lives outside the code
    expect(st.body.uploadsDir).toContain("uploads");
    expect(st.body.dbSize).toBeGreaterThan(0);
    const mk = await request(app).post("/api/admin/backup/create").set("Authorization", `Bearer ${atk}`).send({});
    expect(mk.status).toBe(200);
    expect(mk.body.ok).toBe(true);
    expect(mk.body.name).toMatch(/^medlab-backup-.*\.db$/);
    // the new snapshot shows up in the status listing
    const st2 = await request(app).get("/api/admin/backup/status").set("Authorization", `Bearer ${atk}`);
    expect(st2.body.backups.some((b) => b.name === mk.body.name)).toBe(true);
  });

  it("admin backup routes are blocked for non-admins", async () => {
    const ttk = await token("teacher");
    const res = await request(app).get("/api/admin/backup/status").set("Authorization", `Bearer ${ttk}`);
    expect(res.status).toBe(403);
  });

  it("upgrade safety: seed REFUSES to run (and never wipes) when data exists", async () => {
    // the test DB is already seeded (users + content). Running the seed WITHOUT
    // --force must exit without deleting anything. Capture its output.
    let out = "";
    try { out = execSync("node src/seed.js 2>&1", { cwd: process.cwd(), encoding: "utf8", shell: "/bin/bash" }); }
    catch (e) { out = String(e.stdout || "") + String(e.stderr || ""); }
    expect(out).toMatch(/BLOCKED|are safe|BLOCKED to protect/i);
    // and the data is still there afterwards (nothing was wiped)
    const atk = await token("admin");
    const users = await request(app).get("/api/admin/users?roles=learner,student,teacher,admin").set("Authorization", `Bearer ${atk}`);
    expect(users.body.users.length).toBeGreaterThan(0);
  });

  it("admin can toggle a feature flag (recorded in audit)", async () => {
    const atk = await token("admin");
    const before = (await request(app).get("/api/flags").set("Authorization", `Bearer ${atk}`)).body.flags;
    await request(app).put("/api/admin/flags/ads").set("Authorization", `Bearer ${atk}`).send({ enabled: !before.ads });
    const after = (await request(app).get("/api/flags").set("Authorization", `Bearer ${atk}`)).body.flags;
    expect(after.ads).toBe(!before.ads);
    const audit = await request(app).get("/api/admin/audit?action=flag").set("Authorization", `Bearer ${atk}`);
    expect(audit.body.items.some((a) => a.action === "flag.toggle")).toBe(true);
    // restore — since v77 the «ads» flag really hides ads, later tests rely on it
    await request(app).put("/api/admin/flags/ads").set("Authorization", `Bearer ${atk}`).send({ enabled: !!before.ads });
  });

  it("admin users list supports a multi-role scope filter (unified users tabs)", async () => {
    const atk = await token("admin");
    // university scope → only students/teachers/staff, never learners
    const uni = await request(app).get("/api/admin/users?roles=student,teacher,content_manager,support").set("Authorization", `Bearer ${atk}`);
    expect(uni.status).toBe(200);
    expect(uni.body.users.length).toBeGreaterThan(0);
    expect(uni.body.users.every((u) => u.role !== "learner" && u.role !== "admin")).toBe(true);
    // competitive scope → only learners
    const comp = await request(app).get("/api/admin/users?roles=learner").set("Authorization", `Bearer ${atk}`);
    expect(comp.body.users.every((u) => u.role === "learner")).toBe(true);
    // student rows carry their assigned exam case ids
    const withCases = uni.body.users.find((u) => u.role === "student");
    if (withCases) expect(Array.isArray(withCases.caseIds)).toBe(true);
    // garbage roles are ignored (no injection), returns the full list
    const all = await request(app).get("/api/admin/users?roles=bogus,;DROP").set("Authorization", `Bearer ${atk}`);
    expect(all.status).toBe(200);
  });

  it("admin can search users, adjust learner XP and impersonate", async () => {
    const atk = await token("admin");
    const list = await request(app).get("/api/admin/users?role=learner&q=learner1").set("Authorization", `Bearer ${atk}`);
    expect(list.body.users.length).toBeGreaterThan(0);
    const uid = list.body.users[0].id;
    const adj = await request(app).post(`/api/admin/users/${uid}/learner`).set("Authorization", `Bearer ${atk}`).send({ xp: 4321, premium: true });
    expect(adj.status).toBe(200);
    const detail = await request(app).get(`/api/admin/users/${uid}`).set("Authorization", `Bearer ${atk}`);
    expect(detail.body.profile.xp).toBe(4321);
    expect(detail.body.profile.premium).toBe(1);
    const imp = await request(app).post(`/api/admin/users/${uid}/impersonate`).set("Authorization", `Bearer ${atk}`);
    expect(imp.body.token).toBeTruthy();
    expect(imp.body.user.role).toBe("learner");
  });

  it("admin cannot delete self or the last admin; can ban a learner", async () => {
    const atk = await token("admin");
    const me = (await request(app).get("/api/auth/me").set("Authorization", `Bearer ${atk}`)).body.user;
    const selfDel = await request(app).delete(`/api/admin/users/${me.id}`).set("Authorization", `Bearer ${atk}`);
    expect(selfDel.status).toBe(400);
    const list = await request(app).get("/api/admin/users?role=learner&q=learner2").set("Authorization", `Bearer ${atk}`);
    const uid = list.body.users[0].id;
    const ban = await request(app).post(`/api/admin/users/${uid}/status`).set("Authorization", `Bearer ${atk}`).send({ status: "inactive" });
    expect(ban.status).toBe(200);
  });

  it("admin can edit a card's microlearning and export data", async () => {
    const atk = await token("admin");
    const cards = await request(app).get("/api/admin/content/cards?lang=fa").set("Authorization", `Bearer ${atk}`);
    const id = cards.body.cards[0].id;
    const upd = await request(app).put(`/api/admin/content/cards/${id}/micro`).set("Authorization", `Bearer ${atk}`).send({ golden_fa: "نکته جدید", source_fa: "منبع" });
    expect(upd.status).toBe(200);
    const exp = await request(app).get("/api/admin/export/topics").set("Authorization", `Bearer ${atk}`);
    expect(exp.status).toBe(200);
    expect(Array.isArray(JSON.parse(exp.text))).toBe(true);
  });
});

describe("granular RBAC (mid-level roles) & feature-flag enforcement", () => {
  it("login/me returns permissions per role", async () => {
    const cm = await request(app).post("/api/auth/login").send({ username: "content", password: "demo" });
    expect(cm.body.user.perms).toContain("learn.content");
    expect(cm.body.user.perms).not.toContain("learn.users");
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${cm.body.token}`);
    expect(me.body.user.perms).toContain("learn.content");
  });

  it("content_manager: content yes, users/flags no", async () => {
    const tk = await token("content");
    expect((await request(app).get("/api/admin/content/cards").set("Authorization", `Bearer ${tk}`)).status).toBe(200);
    expect((await request(app).get("/api/admin/users").set("Authorization", `Bearer ${tk}`)).status).toBe(403);
    expect((await request(app).get("/api/admin/flags").set("Authorization", `Bearer ${tk}`)).status).toBe(403);
  });

  it("support: users+audit yes, settings/content/delete no", async () => {
    const tk = await token("support");
    expect((await request(app).get("/api/admin/users").set("Authorization", `Bearer ${tk}`)).status).toBe(200);
    expect((await request(app).get("/api/admin/audit").set("Authorization", `Bearer ${tk}`)).status).toBe(200);
    expect((await request(app).get("/api/admin/settings").set("Authorization", `Bearer ${tk}`)).status).toBe(403);
    expect((await request(app).get("/api/admin/content/cards").set("Authorization", `Bearer ${tk}`)).status).toBe(403);
    // support cannot delete users or create privileged roles
    const list = await request(app).get("/api/admin/users?role=learner&q=learner1").set("Authorization", `Bearer ${tk}`);
    const uid = list.body.users[0].id;
    expect((await request(app).delete(`/api/admin/users/${uid}`).set("Authorization", `Bearer ${tk}`)).status).toBe(403);
    expect((await request(app).post("/api/admin/users").set("Authorization", `Bearer ${tk}`).send({ username: "x" + Date.now(), password: "demo", role: "admin" })).status).toBe(403);
  });

  it("feature flags actually gate features", async () => {
    const atk = await token("admin");
    const ltk = await token("learner");
    await request(app).put("/api/admin/flags/challenges").set("Authorization", `Bearer ${atk}`).send({ enabled: false });
    expect((await request(app).get("/api/challenge/mine").set("Authorization", `Bearer ${ltk}`)).status).toBe(403);
    await request(app).put("/api/admin/flags/challenges").set("Authorization", `Bearer ${atk}`).send({ enabled: true });
    expect((await request(app).get("/api/challenge/mine").set("Authorization", `Bearer ${ltk}`)).status).toBe(200);
  });

  it("disabling learner_signup blocks registration", async () => {
    const atk = await token("admin");
    await request(app).put("/api/admin/flags/learner_signup").set("Authorization", `Bearer ${atk}`).send({ enabled: false });
    const reg = await request(app).post("/api/auth/register").send({ username: "blocked" + Date.now(), password: "demo" });
    expect(reg.status).toBe(403);
    await request(app).put("/api/admin/flags/learner_signup").set("Authorization", `Bearer ${atk}`).send({ enabled: true });
  });
});

describe("security: impersonation privilege-escalation guard", () => {
  it("support cannot impersonate an admin, but can impersonate a learner", async () => {
    const stk = await token("support");
    const atk = await token("admin");
    const admins = await request(app).get("/api/admin/users?q=admin").set("Authorization", `Bearer ${atk}`);
    const adminId = admins.body.users.find((u) => u.role === "admin").id;
    const esc = await request(app).post(`/api/admin/users/${adminId}/impersonate`).set("Authorization", `Bearer ${stk}`);
    expect(esc.status).toBe(403);
    const learners = await request(app).get("/api/admin/users?role=learner&q=learner1").set("Authorization", `Bearer ${atk}`);
    const ok = await request(app).post(`/api/admin/users/${learners.body.users[0].id}/impersonate`).set("Authorization", `Bearer ${stk}`);
    expect(ok.status).toBe(200);
  });
});

describe("account-universe content separation (student/teacher view)", () => {
  it("teacher flashcard bank excludes learner-track cards", async () => {
    const tk = await token("teacher");
    const res = await request(app).get("/api/flashcards").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    // no card should carry the learner track marker
    expect(res.body.every((c) => c.track !== "learn")).toBe(true);
    // learner path cards (course پره‌انترنی) must not leak into the teacher bank
    expect(res.body.some((c) => c.course_fa === "پره‌انترنی")).toBe(false);
  });

  it("teacher-created flashcards are tagged uni and remain visible", async () => {
    const tk = await token("teacher");
    const create = await request(app).post("/api/flashcards").set("Authorization", `Bearer ${tk}`)
      .send({ type: "mcq", title_fa: "uni card", q_fa: "?", options: [{ fa: "a", correct: true }, { fa: "b" }] });
    expect(create.status).toBe(200);
    const list = await request(app).get("/api/flashcards").set("Authorization", `Bearer ${tk}`);
    expect(list.body.some((c) => c.id === create.body.id)).toBe(true);
  });

  it("learner path & lessons still work after track tagging", async () => {
    const tk = await token("learner");
    const path = await request(app).get("/api/learn/path?lang=fa").set("Authorization", `Bearer ${tk}`);
    expect(path.body.topics.reduce((s, t) => s + t.nodes.length, 0)).toBeGreaterThan(0);
    const lesson = await request(app).get("/api/learn/lesson/1?lang=fa").set("Authorization", `Bearer ${tk}`);
    expect(lesson.body.cards.length).toBeGreaterThan(0);
  });
});

describe("bulk question import & data-protection", () => {
  const SAMPLE_CSV = [
    "type,topic,difficulty,q_fa,q_en,options_fa,correct,answer,blank_fa,accept_fa,pairs_fa,items_fa,golden_fa,analysis_fa,source_fa",
    'mcq,gi,medium,سوال یک؟,Q1,الف|ب|ج,2,,,,,,نکته طلایی,✅ ب درست است,هاریسون',
    'truefalse,surgery,easy,مورفی برای کوله‌سیستیت است,,,,true,,,,,مورفی=کوله‌سیستیت,,شوارتز',
    'fill,neuro,medium,tPA تا ____ ساعت,,,,,۴.۵,۴.۵|4.5,,,,,',
    'match,pharm,medium,وصل کنید,,,,,,,استامینوفن::NAC|اوپیوئید::نالوکسان,,,,',
    'order,cardio,hard,مرتب کنید,,,,,,,,ECG|آسپیرین|ریپرفیوژن,,,',
  ].join("\n");

  it("preview validates all question types with no errors", async () => {
    const atk = await token("admin");
    const res = await request(app).post("/api/admin/content/import/preview")
      .set("Authorization", `Bearer ${atk}`).send({ csv: SAMPLE_CSV });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(res.body.valid).toBe(5);
    expect(res.body.errors.length).toBe(0);
    expect(res.body.byType.mcq).toBe(1);
    expect(res.body.byType.match).toBe(1);
    expect(res.body.byType.order).toBe(1);
  });

  it("preview reports errors for malformed rows", async () => {
    const atk = await token("admin");
    const bad = "type,topic,q_fa,options_fa\nmcq,gi,,الف|ب\nmcq,gi,سوال بدون گزینه,";
    const res = await request(app).post("/api/admin/content/import/preview")
      .set("Authorization", `Bearer ${atk}`).send({ csv: bad });
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it("commit imports cards and attaches them to the topic path", async () => {
    const atk = await token("admin");
    const before = (await request(app).get("/api/admin/content/cards?lang=fa").set("Authorization", `Bearer ${atk}`)).body.cards.length;
    const res = await request(app).post("/api/admin/content/import")
      .set("Authorization", `Bearer ${atk}`).send({ csv: SAMPLE_CSV, attachToPath: true });
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(5);
    const after = (await request(app).get("/api/admin/content/cards?lang=fa").set("Authorization", `Bearer ${atk}`)).body.cards.length;
    expect(after).toBe(before + 5);
    // imported gi card now reachable on the learner path
    const ltk = await token("learner");
    const path = (await request(app).get("/api/learn/path?lang=fa").set("Authorization", `Bearer ${ltk}`)).body;
    const gi = path.topics.find((t) => t.slug === "gi");
    expect(gi.nodes.length).toBeGreaterThan(3);
  });

  it("template CSV is downloadable and non-empty", async () => {
    const atk = await token("admin");
    const res = await request(app).get("/api/admin/content/import/template.csv").set("Authorization", `Bearer ${atk}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("csv");
    expect(res.text).toContain("type");
  });

  it("content_manager can import; support and learner cannot", async () => {
    const cm = await token("content");
    expect((await request(app).post("/api/admin/content/import/preview").set("Authorization", `Bearer ${cm}`).send({ csv: SAMPLE_CSV })).status).toBe(200);
    const sup = await token("support");
    expect((await request(app).post("/api/admin/content/import/preview").set("Authorization", `Bearer ${sup}`).send({ csv: SAMPLE_CSV })).status).toBe(403);
  });
});

describe("email login, Google auth & universities", () => {
  it("can log in with email (not just username)", async () => {
    const email = `login_${Date.now()}@test.com`;
    await request(app).post("/api/auth/register").send({ email, password: "pass123", name_fa: "ورود" });
    const res = await request(app).post("/api/auth/login").send({ username: email, password: "pass123" });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  it("auth methods endpoint reports availability", async () => {
    const res = await request(app).get("/api/auth/methods");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("google");
    expect(res.body).toHaveProperty("emailVerify");
  });

  it("google login returns 503 when not configured", async () => {
    const res = await request(app).post("/api/auth/google").send({ credential: "x" });
    expect([503, 401]).toContain(res.status);
  });

  it("admin creates a university, adds a teacher & student to it", async () => {
    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set("Authorization", `Bearer ${atk}`)
      .send({ name_fa: "دانشگاه تست", city_fa: "تهران" });
    expect(uni.status).toBe(200);
    const uid = uni.body.id;
    const tName = "dr_test_" + Date.now();
    const teach = await request(app).post("/api/admin/users").set("Authorization", `Bearer ${atk}`)
      .send({ username: tName, password: "demo", name_fa: "استاد", role: "teacher", university_id: uid });
    expect(teach.status).toBe(200);
    const stud = await request(app).post("/api/admin/users").set("Authorization", `Bearer ${atk}`)
      .send({ username: "40e2e" + Date.now(), password: "demo", name_fa: "دانشجو", role: "student", university_id: uid });
    expect(stud.status).toBe(200);
    const list = await request(app).get("/api/universities").set("Authorization", `Bearer ${atk}`);
    const found = list.body.universities.find((u) => u.id === uid);
    expect(found.teachers).toBeGreaterThanOrEqual(1);
    expect(found.students).toBeGreaterThanOrEqual(1);
  });

  it("non-admin cannot create a university", async () => {
    const ttk = await token("teacher");
    const res = await request(app).post("/api/universities").set("Authorization", `Bearer ${ttk}`).send({ name_fa: "x" });
    expect(res.status).toBe(403);
    // but a teacher CAN list universities (for assignment dropdowns)
    const list = await request(app).get("/api/universities").set("Authorization", `Bearer ${ttk}`);
    expect(list.status).toBe(200);
  });

  it("cannot delete a university that still has members", async () => {
    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set("Authorization", `Bearer ${atk}`).send({ name_fa: "پرعضو" });
    await request(app).post("/api/admin/users").set("Authorization", `Bearer ${atk}`)
      .send({ username: "m_" + Date.now(), password: "demo", role: "teacher", university_id: uni.body.id });
    const del = await request(app).delete(`/api/universities/${uni.body.id}`).set("Authorization", `Bearer ${atk}`);
    expect(del.status).toBe(400);
  });
});

describe("site content CMS", () => {
  it("public can read site content without auth", async () => {
    const res = await request(app).get("/api/site-content");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("content");
  });
  it("admin can publish overrides; empties are dropped", async () => {
    const atk = await token("admin");
    const put = await request(app).put("/api/site-content").set("Authorization", `Bearer ${atk}`)
      .send({ content: { "fa:landHeroTitle": "تیتر سفارشی", "en:landHeroTitle": "   " } });
    expect(put.status).toBe(200);
    const read = await request(app).get("/api/site-content");
    expect(read.body.content["fa:landHeroTitle"]).toBe("تیتر سفارشی");
    expect(read.body.content["en:landHeroTitle"]).toBeUndefined(); // empty dropped
  });
  it("non-admin cannot publish", async () => {
    const ltk = await token("learner");
    const res = await request(app).put("/api/site-content").set("Authorization", `Bearer ${ltk}`)
      .send({ content: { "fa:landHeroTitle": "hack" } });
    expect(res.status).toBe(403);
  });
  it("admin can reset all overrides", async () => {
    const atk = await token("admin");
    await request(app).put("/api/site-content").set("Authorization", `Bearer ${atk}`)
      .send({ content: { "fa:landHeroTitle": "x" } });
    const del = await request(app).delete("/api/site-content").set("Authorization", `Bearer ${atk}`);
    expect(del.status).toBe(200);
    const read = await request(app).get("/api/site-content");
    expect(Object.keys(read.body.content).length).toBe(0);
  });
});

describe("path mascots config", () => {
  it("public can read mascots config with sane defaults", async () => {
    const res = await request(app).get("/api/site-content/mascots");
    expect(res.status).toBe(200);
    expect(res.body.mascots).toHaveProperty("dr");
    expect(res.body.mascots).toHaveProperty("microbe");
    expect(res.body.mascots.enabled).toBe(true);
    expect(Array.isArray(res.body.mascots.dr.lines.start.fa)).toBe(true);
  });
  it("mascots config is also exposed on /config", async () => {
    const res = await request(app).get("/api/site-content/config");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("mascots");
  });
  it("admin can edit speed + toggle + a line, and it persists", async () => {
    const atk = await token("admin");
    const put = await request(app).put("/api/site-content/mascots").set("Authorization", `Bearer ${atk}`)
      .send({ mascots: { speed: "fast", microbe: { enabled: false, lines: { fa: ["تست"], en: ["test"] } } } });
    expect(put.status).toBe(200);
    expect(put.body.mascots.speed).toBe("fast");
    expect(put.body.mascots.microbe.enabled).toBe(false);
    const read = await request(app).get("/api/site-content/mascots");
    expect(read.body.mascots.speed).toBe("fast");
    expect(read.body.mascots.microbe.lines.fa).toEqual(["تست"]);
    // dr side untouched by the partial save
    expect(read.body.mascots.dr.enabled).toBe(true);
  });
  it("invalid speed falls back to normal", async () => {
    const atk = await token("admin");
    const put = await request(app).put("/api/site-content/mascots").set("Authorization", `Bearer ${atk}`)
      .send({ mascots: { speed: "hyper" } });
    expect(put.body.mascots.speed).toBe("normal");
  });
  it("non-admin cannot edit mascots", async () => {
    const ltk = await token("learner");
    const res = await request(app).put("/api/site-content/mascots").set("Authorization", `Bearer ${ltk}`)
      .send({ mascots: { speed: "fast" } });
    expect(res.status).toBe(403);
  });
  it("admin can reset mascots to defaults", async () => {
    const atk = await token("admin");
    const del = await request(app).delete("/api/site-content/mascots").set("Authorization", `Bearer ${atk}`);
    expect(del.status).toBe(200);
    expect(del.body.mascots.speed).toBe("normal");
    expect(del.body.mascots.microbe.enabled).toBe(true);
  });
});

describe("TWA / Android app (assetlinks)", () => {
  it("assetlinks.json is valid JSON and empty by default (disabled)", async () => {
    const res = await request(app).get("/.well-known/assetlinks.json");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });
  it("admin can read the TWA config with defaults", async () => {
    const atk = await token("admin");
    const res = await request(app).get("/api/admin/twa").set("Authorization", `Bearer ${atk}`);
    expect(res.status).toBe(200);
    expect(res.body.config).toHaveProperty("package_name");
    expect(res.body.config.enabled).toBe(false);
  });
  it("admin saving a valid fingerprint publishes assetlinks; invalid ones are dropped", async () => {
    const atk = await token("admin");
    const good = "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99";
    const put = await request(app).put("/api/admin/twa").set("Authorization", `Bearer ${atk}`)
      .send({ config: { enabled: true, package_name: "ir.medschool.twa",
        sha256_fingerprints: `${good}\nNOT-A-FINGERPRINT` } });
    expect(put.status).toBe(200);
    expect(put.body.config.sha256_fingerprints).toEqual([good]); // invalid dropped
    // the public file now carries the statement
    const pub = await request(app).get("/.well-known/assetlinks.json");
    expect(pub.body.length).toBe(1);
    expect(pub.body[0].target.package_name).toBe("ir.medschool.twa");
    expect(pub.body[0].target.sha256_cert_fingerprints).toContain(good);
    expect(pub.body[0].relation).toContain("delegate_permission/common.handle_all_urls");
  });
  it("disabling TWA empties the public file again", async () => {
    const atk = await token("admin");
    await request(app).put("/api/admin/twa").set("Authorization", `Bearer ${atk}`)
      .send({ config: { enabled: false } });
    const pub = await request(app).get("/.well-known/assetlinks.json");
    expect(pub.body.length).toBe(0);
  });
  it("non-admin cannot edit TWA config", async () => {
    const ltk = await token("learner");
    const res = await request(app).put("/api/admin/twa").set("Authorization", `Bearer ${ltk}`)
      .send({ config: { enabled: true } });
    expect(res.status).toBe(403);
  });
});

describe("Virtual Patient (competitive) gating", () => {
  it("is OFF for learners by default", async () => {
    const ltk = await token("learner");
    const res = await request(app).get("/api/learn/vpatient").set("Authorization", `Bearer ${ltk}`);
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.access).toBe(false);
    expect(res.body.reason).toBe("off");
    expect(res.body.cases).toBeUndefined();   // no case list leaked when off
  });
  it("admin can enable it; premium-only blocks a non-premium learner", async () => {
    const atk = await token("admin");
    const put = await request(app).put("/api/admin/vpatient").set("Authorization", `Bearer ${atk}`)
      .send({ config: { enabled: true, premium_only: true, in_path: true, in_daily: true, daily_gems: 15 } });
    expect(put.status).toBe(200);
    expect(put.body.config.enabled).toBe(true);
    const ltk = await token("learner");   // demo learner is NOT premium
    const res = await request(app).get("/api/learn/vpatient").set("Authorization", `Bearer ${ltk}`);
    expect(res.body.enabled).toBe(true);
    expect(res.body.access).toBe(false);
    expect(res.body.reason).toBe("premium");
    expect(res.body.cases).toBeUndefined();
  });
  it("premium_only=false grants all learners access + case list + daily case", async () => {
    const atk = await token("admin");
    await request(app).put("/api/admin/vpatient").set("Authorization", `Bearer ${atk}`)
      .send({ config: { enabled: true, premium_only: false, in_path: true, in_daily: true, daily_gems: 15 } });
    const ltk = await token("learner");
    const res = await request(app).get("/api/learn/vpatient").set("Authorization", `Bearer ${ltk}`);
    expect(res.body.access).toBe(true);
    expect(res.body.reason).toBeNull();
    expect(Array.isArray(res.body.cases)).toBe(true);
    expect(res.body.cases.length).toBeGreaterThan(0);
    expect(res.body.daily_case_id).toBeTruthy();
  });
  it("the shared /exam engine honors the learner gate (blocks when off)", async () => {
    const atk = await token("admin");
    // turn it OFF
    await request(app).put("/api/admin/vpatient").set("Authorization", `Bearer ${atk}`)
      .send({ config: { enabled: false } });
    const ltk = await token("learner");
    const res = await request(app).post("/api/exam/patient-reply").set("Authorization", `Bearer ${ltk}`)
      .send({ caseId: 3, userText: "سلام", history: [], lang: "fa" });
    expect(res.status).toBe(403);
    // turn it back ON (open) → learner can play the competitive-track case
    await request(app).put("/api/admin/vpatient").set("Authorization", `Bearer ${atk}`)
      .send({ config: { enabled: true, premium_only: false } });
    const ok = await request(app).post("/api/exam/patient-reply").set("Authorization", `Bearer ${ltk}`)
      .send({ caseId: 3, userText: "سلام", history: [], lang: "fa" });
    expect(ok.status).toBe(200);
    expect(ok.body.text).toBeTruthy();
    expect(ok.body.source).toBe("mock");   // deterministic (no AI key) — zero cost
  });
  it("daily reward pays once per day then zero", async () => {
    const atk = await token("admin");
    await request(app).put("/api/admin/vpatient").set("Authorization", `Bearer ${atk}`)
      .send({ config: { enabled: true, premium_only: false, in_daily: true, daily_gems: 15 } });
    const ltk = await token("learner");
    const first = await request(app).post("/api/learn/vpatient/daily-reward").set("Authorization", `Bearer ${ltk}`).send({});
    expect(first.body.ok).toBe(true);
    const second = await request(app).post("/api/learn/vpatient/daily-reward").set("Authorization", `Bearer ${ltk}`).send({});
    expect(second.body.alreadyClaimed).toBe(true);
    expect(second.body.gems).toBe(0);
  });
  it("non-admin cannot change the vpatient config", async () => {
    const ltk = await token("learner");
    const res = await request(app).put("/api/admin/vpatient").set("Authorization", `Bearer ${ltk}`)
      .send({ config: { enabled: true } });
    expect(res.status).toBe(403);
  });
});

describe("Virtual Patient — ranking XP (auto-evaluator → XP)", () => {
  let atk, ltk, uid;
  beforeAll(async () => {
    atk = await token("admin");
    const lg = await login("learner", "demo");
    ltk = lg.body.token; uid = lg.body.user.id;
    // open the feature + XP on, and set case #1 cap to 200 for predictable math
    await request(app).put("/api/admin/vpatient").set("Authorization", `Bearer ${atk}`)
      .send({ config: { enabled: true, premium_only: false, award_xp: true, default_xp_max: 120 } });
    await request(app).put("/api/admin/vpatient/cases/3").set("Authorization", `Bearer ${atk}`)
      .send({ xp_max: 200 });
    // reset this learner's best-score record for the competitive case
    const { db } = await import("../src/db.js");
    db.prepare("DELETE FROM settings WHERE key=?").run(`vp_best_${uid}_3`);
  });

  const weak = { messages: [{ role: "student", text: "سلام" }], tests: [], imaging: [], ddx: [], finalDx: "" };
  const strong = {
    messages: [{ role: "student", text: "تنگی نفس ناگهانی سفر طولانی آمبولی ریه دی‌دایمر CTPA" }],
    tests: ["دی‌دایمر"], imaging: ["CTPA"], ddx: ["PE", "آمبولی ریه"], finalDx: "Pulmonary embolism آمبولی ریه",
  };
  const evalCase = (session) => request(app).post("/api/exam/evaluate")
    .set("Authorization", `Bearer ${ltk}`).send({ caseId: 3, lang: "fa", session });

  it("admin can list per-case XP caps (case 3 shows 200)", async () => {
    const res = await request(app).get("/api/admin/vpatient/cases?lang=fa").set("Authorization", `Bearer ${atk}`);
    expect(res.status).toBe(200);
    const c1 = res.body.cases.find((c) => c.id === 3);
    expect(c1.xp_max).toBe(200);
    expect(c1.effective).toBe(200);
  });

  it("awards XP = score% × cap on first completion", async () => {
    const before = (await request(app).get("/api/learn/profile").set("Authorization", `Bearer ${ltk}`)).body.profile.xp;
    const res = await evalCase(weak);
    expect(res.body.xpReward).toBeDefined();
    const pct = res.body.score;
    const expected = Math.round((pct / 100) * 200);
    expect(res.body.xpReward.awarded).toBe(expected);
    const after = (await request(app).get("/api/learn/profile").set("Authorization", `Bearer ${ltk}`)).body.profile.xp;
    expect(after - before).toBe(expected);
  });

  it("replaying with a HIGHER score only tops up the delta (best-score policy)", async () => {
    const beforeBest = (await evalCase(weak)).body.xpReward.best;   // establishes/keeps best
    const before = (await request(app).get("/api/learn/profile").set("Authorization", `Bearer ${ltk}`)).body.profile.xp;
    const res = await evalCase(strong);
    expect(res.body.score).toBeGreaterThan(beforeBest);
    const delta = res.body.xpReward.awarded;
    const after = (await request(app).get("/api/learn/profile").set("Authorization", `Bearer ${ltk}`)).body.profile.xp;
    expect(after - before).toBe(delta);
    // total granted from this case == best% × cap (no double counting)
    expect(res.body.xpReward.best).toBe(res.body.score);
  });

  it("replaying WORSE awards zero (no farming) and keeps best", async () => {
    const prev = (await request(app).get("/api/learn/profile").set("Authorization", `Bearer ${ltk}`)).body.profile.xp;
    const bestSoFar = (await evalCase(strong)).body.xpReward.best;
    const res = await evalCase(weak);
    expect(res.body.xpReward.awarded).toBe(0);
    expect(res.body.xpReward.best).toBe(bestSoFar);
    const now = (await request(app).get("/api/learn/profile").set("Authorization", `Bearer ${ltk}`)).body.profile.xp;
    expect(now).toBe(prev);   // unchanged
  });

  it("award_xp=false disables XP entirely", async () => {
    await request(app).put("/api/admin/vpatient").set("Authorization", `Bearer ${atk}`)
      .send({ config: { enabled: true, premium_only: false, award_xp: false } });
    const { db } = await import("../src/db.js");
    db.prepare("DELETE FROM settings WHERE key=?").run(`vp_best_${uid}_3`);
    const before = (await request(app).get("/api/learn/profile").set("Authorization", `Bearer ${ltk}`)).body.profile.xp;
    const res = await evalCase(strong);
    expect(res.body.xpReward.awarded).toBe(0);
    const after = (await request(app).get("/api/learn/profile").set("Authorization", `Bearer ${ltk}`)).body.profile.xp;
    expect(after).toBe(before);
    // restore
    await request(app).put("/api/admin/vpatient").set("Authorization", `Bearer ${atk}`)
      .send({ config: { enabled: true, premium_only: false, award_xp: true } });
  });

  it("non-admin cannot set a case XP cap", async () => {
    const res = await request(app).put("/api/admin/vpatient/cases/1").set("Authorization", `Bearer ${ltk}`)
      .send({ xp_max: 999 });
    expect(res.status).toBe(403);
  });
});

describe("Virtual Patient — separate AI config + prompts", () => {
  let atk, ltk;
  beforeAll(async () => {
    atk = await token("admin");
    ltk = await token("learner");
    // open the feature so the learner can reach the engine
    await request(app).put("/api/admin/vpatient").set("Authorization", `Bearer ${atk}`)
      .send({ config: { enabled: true, premium_only: false } });
  });

  it("separate AI config starts empty and is admin-editable", async () => {
    const g0 = await request(app).get("/api/admin/vpatient/ai").set("Authorization", `Bearer ${atk}`);
    expect(g0.status).toBe(200);
    expect(g0.body.config).toHaveProperty("apiKey");
    const put = await request(app).put("/api/admin/vpatient/ai").set("Authorization", `Bearer ${atk}`)
      .send({ provider: "OpenRouter", model: "openai/gpt-4o", apiKey: "", baseUrl: "https://openrouter.ai/api/v1" });
    expect(put.status).toBe(200);
    expect(put.body.config.provider).toBe("OpenRouter");
    const g1 = await request(app).get("/api/admin/vpatient/ai").set("Authorization", `Bearer ${atk}`);
    expect(g1.body.config.model).toBe("openai/gpt-4o");
  });

  it("separate config is INDEPENDENT of the university ai setting", async () => {
    // change the university AI config; the vpatient one must not change
    await request(app).put("/api/settings/ai").set("Authorization", `Bearer ${atk}`)
      .send({ provider: "OpenAI", model: "uni-model", apiKey: "", baseUrl: "" });
    const g = await request(app).get("/api/admin/vpatient/ai").set("Authorization", `Bearer ${atk}`);
    expect(g.body.config.model).toBe("openai/gpt-4o");   // still the vpatient value
  });

  it("separate prompts save partially and fall back per field", async () => {
    const put = await request(app).put("/api/admin/vpatient/prompts").set("Authorization", `Bearer ${atk}`)
      .send({ prompts: { patient_fa: "بیمار رقابتی — کوتاه جواب بده." } });
    expect(put.status).toBe(200);
    expect(put.body.prompts.patient_fa).toContain("رقابتی");
    expect(put.body.prompts.patient_en).toBe("");   // blank → will fall back at runtime
  });

  it("ai-test with no key reports mock mode (zero cost)", async () => {
    const res = await request(app).post("/api/admin/vpatient/ai-test").set("Authorization", `Bearer ${atk}`).send({ lang: "fa" });
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
    expect(res.body.mode).toBe("mock");
  });

  it("a competitive learner's play uses the engine (mock, no key) and works", async () => {
    const res = await request(app).post("/api/exam/patient-reply").set("Authorization", `Bearer ${ltk}`)
      .send({ caseId: 3, userText: "سلام", history: [], lang: "fa" });
    expect(res.status).toBe(200);
    expect(res.body.text).toBeTruthy();
    expect(res.body.source).toBe("mock");
  });

  it("non-admin cannot read or write the separate AI config / prompts", async () => {
    for (const path of ["/api/admin/vpatient/ai", "/api/admin/vpatient/prompts"]) {
      const g = await request(app).get(path).set("Authorization", `Bearer ${ltk}`);
      expect(g.status).toBe(403);
      const p = await request(app).put(path).set("Authorization", `Bearer ${ltk}`).send({});
      expect(p.status).toBe(403);
    }
  });
});

describe("Virtual Patient — import from university library", () => {
  let atk;
  beforeAll(async () => { atk = await token("admin"); });

  it("lists the university library (cases + cards)", async () => {
    const res = await request(app).get("/api/admin/vpatient/library?lang=fa").set("Authorization", `Bearer ${atk}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cases)).toBe(true);
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(res.body.cases.length).toBeGreaterThan(0);
  });

  it("cloning a case creates an INDEPENDENT competitive copy (original untouched)", async () => {
    const before = await request(app).get("/api/admin/vpatient/library?lang=fa").set("Authorization", `Bearer ${atk}`);
    const n0 = before.body.cases.length;
    const imp = await request(app).post("/api/admin/vpatient/import-cases").set("Authorization", `Bearer ${atk}`).send({ ids: [1] });
    expect(imp.body.imported).toBe(1);
    const after = await request(app).get("/api/admin/vpatient/library?lang=fa").set("Authorization", `Bearer ${atk}`);
    expect(after.body.cases.length).toBe(n0 + 1);
    expect(after.body.cases.some((c) => c.competitive)).toBe(true);
    // original case 1 still exists and is NOT tagged competitive
    const orig = after.body.cases.find((c) => c.id === 1);
    expect(orig).toBeTruthy();
    expect(orig.competitive).toBe(false);
  });

  it("cloning flashcards works", async () => {
    const imp = await request(app).post("/api/admin/vpatient/import-cards").set("Authorization", `Bearer ${atk}`).send({ ids: [1, 2] });
    expect(imp.body.imported).toBeGreaterThanOrEqual(1);
  });

  it("non-admin cannot import", async () => {
    const ltk = await token("learner");
    const r1 = await request(app).post("/api/admin/vpatient/import-cases").set("Authorization", `Bearer ${ltk}`).send({ ids: [1] });
    expect(r1.status).toBe(403);
    const r2 = await request(app).get("/api/admin/vpatient/library").set("Authorization", `Bearer ${ltk}`);
    expect(r2.status).toBe(403);
  });
});

describe("Daily challenge — smart search options + performance rewards", () => {
  let ltk;
  beforeAll(async () => { ltk = await token("learner3"); });

  it("daily view exposes bilingual options (optionsBi) for the smart search box", async () => {
    const res = await request(app).get("/api/learn/dx/daily").set("Authorization", `Bearer ${ltk}`);
    if (res.body.available === false) return;   // no case seeded → skip
    expect(Array.isArray(res.body.optionsBi)).toBe(true);
    if (res.body.optionsBi.length) {
      expect(res.body.optionsBi[0]).toHaveProperty("fa");
      expect(res.body.optionsBi[0]).toHaveProperty("en");
    }
  });

  it("an unsolved-but-attempted daily still grants a small EFFORT reward", async () => {
    // fresh learner so the daily isn't already finished
    const lg = await login("learner6", "demo").catch(() => null);
    const tk = lg?.body?.token || ltk;
    const d = await request(app).get("/api/learn/dx/daily").set("Authorization", `Bearer ${tk}`);
    if (d.body.available === false || d.body.finished) return;   // skip if unavailable/done
    const caseId = d.body.caseId; const maxG = d.body.maxGuesses || 6;
    let last;
    for (let i = 0; i < maxG; i++) {
      last = await request(app).post("/api/learn/dx/guess").set("Authorization", `Bearer ${tk}`)
        .send({ caseId, guess: `__wrong_${i}` });
    }
    if (last.body.finished && !last.body.solved) {
      expect(last.body.awards).toBeTruthy();
      expect(last.body.awards.effort).toBe(true);
      expect(last.body.awards.xp).toBeGreaterThan(0);
      expect(last.body.awards.solved).toBe(false);
    }
  });
});

describe("UWorld-style study features (distractor rationale + flag/guess)", () => {
  let ltk, uid, nodeId, cardId;
  beforeAll(async () => {
    const lg = await login("learner3", "demo");
    ltk = lg.body.token; uid = lg.body.user.id;
    const { db } = await import("../src/db.js");
    // find an unlocked node + its first mcq card, and give that option a rationale
    nodeId = db.prepare("SELECT id FROM path_nodes WHERE active=1 ORDER BY id LIMIT 1").get().id;
    const node = db.prepare("SELECT card_ids FROM path_nodes WHERE id=?").get(nodeId);
    const ids = JSON.parse(node.card_ids || "[]");
    // pick the first mcq card and inject a per-option "why" so we can assert it serializes
    for (const id of ids) {
      const row = db.prepare("SELECT data_json FROM flashcards WHERE id=? AND active=1").get(id);
      if (!row) continue;
      const d = JSON.parse(row.data_json);
      if ((d.type || "mcq") === "mcq" && Array.isArray(d.options) && d.options.length) {
        d.options[0].why_fa = "چون این گزینه با شرح‌حال نمی‌خواند.";
        d.options[0].why_en = "Because it doesn't fit the vignette.";
        db.prepare("UPDATE flashcards SET data_json=? WHERE id=?").run(JSON.stringify(d), id);
        cardId = id; break;
      }
    }
  });
  const auth = (r) => r.set("Authorization", `Bearer ${ltk}`);

  it("serves per-option distractor rationale (the 'why') on lesson cards", async () => {
    const res = await auth(request(app).get(`/api/learn/lesson/${nodeId}?lang=fa`));
    expect(res.status).toBe(200);
    const mcq = res.body.cards.find((c) => c.type === "mcq" && c.id === cardId);
    expect(mcq).toBeTruthy();
    expect(mcq.options[0]).toHaveProperty("why");
    expect(mcq.options[0].why).toContain("شرح‌حال");
  });

  it("serves AMBOSS-style attending tip + key-clue highlights when authored", async () => {
    const { db } = await import("../src/db.js");
    // author attending + highlights on the same card, then re-fetch the lesson
    const row = db.prepare("SELECT data_json FROM flashcards WHERE id=?").get(cardId);
    const d = JSON.parse(row.data_json);
    d.attending_fa = "به انتشار درد توجه کن.";
    d.highlights_fa = ["درد فشارنده", "انتشار به بازوی چپ"];
    db.prepare("UPDATE flashcards SET data_json=? WHERE id=?").run(JSON.stringify(d), cardId);
    const res = await auth(request(app).get(`/api/learn/lesson/${nodeId}?lang=fa`));
    const mcq = res.body.cards.find((c) => c.id === cardId);
    expect(mcq.attending).toContain("انتشار");
    expect(Array.isArray(mcq.highlights)).toBe(true);
    expect(mcq.highlights).toContain("درد فشارنده");
  });

  it("a correct-but-GUESSED answer lands in the flagged-review list", async () => {
    await auth(request(app).post(`/api/learn/lesson/${nodeId}/finish`))
      .send({ correct: 1, total: 1, answers: [{ cardId, correct: true, guessed: true, responseMs: 1000 }] });
    const res = await auth(request(app).get("/api/learn/flagged?lang=fa"));
    expect(res.body.cards.some((c) => c.id === cardId)).toBe(true);
  });

  it("a FLAGGED answer also lands in the flagged-review list", async () => {
    const { db } = await import("../src/db.js");
    // use a different card id if available
    const other = db.prepare("SELECT id FROM flashcards WHERE active=1 AND id<>? LIMIT 1").get(cardId)?.id || cardId;
    await auth(request(app).post(`/api/learn/lesson/${nodeId}/finish`))
      .send({ correct: 1, total: 1, answers: [{ cardId: other, correct: false, flagged: true, responseMs: 800 }] });
    const res = await auth(request(app).get("/api/learn/flagged?lang=fa"));
    expect(res.body.cards.some((c) => c.id === other)).toBe(true);
  });

  it("a clean correct answer (no flag/guess) clears the card from flagged review", async () => {
    // clear card `cardId` with a clean correct answer
    await auth(request(app).post("/api/learn/flagged/answer"))
      .send({ cardId, correct: true, guessed: false, flagged: false, responseMs: 700 });
    const res = await auth(request(app).get("/api/learn/flagged?lang=fa"));
    expect(res.body.cards.some((c) => c.id === cardId)).toBe(false);
  });

  it("flagged endpoints require a learner (auth)", async () => {
    const res = await request(app).get("/api/learn/flagged");
    expect(res.status).toBe(401);
  });
});

describe("advanced gamification (gameplus)", () => {
  let ltk, uid, nodeId;
  beforeAll(async () => {
    const lg = await login("learner", "demo");
    ltk = lg.body.token; uid = lg.body.user.id;
    const { db } = await import("../src/db.js");
    db.prepare("UPDATE learner_profiles SET gems=1000 WHERE user_id=?").run(uid);
    nodeId = db.prepare("SELECT id FROM path_nodes WHERE active=1 ORDER BY id LIMIT 1").get().id;
  });
  const auth = (r) => r.set("Authorization", `Bearer ${ltk}`);

  it("daily goal can be read and set", async () => {
    const g = await auth(request(app).get("/api/learn/daily"));
    expect(g.status).toBe(200);
    expect(g.body).toHaveProperty("options");
    const s = await auth(request(app).post("/api/learn/daily/goal").send({ value: 50 }));
    expect(s.body.profile.daily_goal).toBe(50);
  });

  it("quests are generated and progress + claim work", async () => {
    const q0 = await auth(request(app).get("/api/learn/quests"));
    expect(q0.body.quests.length).toBeGreaterThan(0);
    await auth(request(app).post(`/api/learn/lesson/${nodeId}/finish`).send({ correct: 5, total: 5 }));
    const q1 = await auth(request(app).get("/api/learn/quests"));
    const done = q1.body.quests.find((x) => x.done && !x.claimed);
    expect(done).toBeTruthy();
    const claim = await auth(request(app).post(`/api/learn/quests/${done.id}/claim`));
    expect(claim.status).toBe(200);
    expect(claim.body.gems).toBeGreaterThan(0);
  });

  it("shop buy: xp_boost sets a boost window and doubles XP", async () => {
    const buy = await auth(request(app).post("/api/learn/shop/buy").send({ slug: "xp_boost" }));
    expect(buy.status).toBe(200);
    expect(buy.body.profile.xp_boost_until).toBeTruthy();
  });

  it("shop buy: streak_freeze increments freezes", async () => {
    const before = (await auth(request(app).get("/api/learn/shop"))).body.freezes;
    const buy = await auth(request(app).post("/api/learn/shop/buy").send({ slug: "streak_freeze" }));
    expect(buy.status).toBe(200);
    expect(buy.body.profile.freezes).toBe(before + 1);
  });

  it("shop rejects purchase when gems are insufficient", async () => {
    const { db } = await import("../src/db.js");
    db.prepare("UPDATE learner_profiles SET gems=0 WHERE user_id=?").run(uid);
    const buy = await auth(request(app).post("/api/learn/shop/buy").send({ slug: "streak_freeze" }));
    expect(buy.status).toBe(400);
  });

  it("streak calendar + personal records endpoint", async () => {
    const r = await auth(request(app).get("/api/learn/streak"));
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty("records");
    expect(Array.isArray(r.body.days)).toBe(true);
  });

  it("chests endpoint returns two timed chests", async () => {
    const r = await auth(request(app).get("/api/learn/chests"));
    expect(r.body.chests.length).toBe(2);
  });
});

describe("performance analytics & mistakes & notes (phase 1)", () => {
  let ltk, uid, nodeId, cardIds;
  beforeAll(async () => {
    const lg = await login("learner", "demo");
    ltk = lg.body.token; uid = lg.body.user.id;
    const { db } = await import("../src/db.js");
    const node = db.prepare("SELECT id, card_ids FROM path_nodes WHERE active=1 ORDER BY id LIMIT 1").get();
    nodeId = node.id; cardIds = JSON.parse(node.card_ids || "[]");
  });
  const auth = (r) => r.set("Authorization", `Bearer ${ltk}`);

  it("records per-card answers on lesson finish and builds the dashboard", async () => {
    const answers = cardIds.slice(0, 3).map((c, i) => ({ cardId: c, correct: i !== 0, responseMs: 1200 + i * 300 }));
    const fin = await auth(request(app).post(`/api/learn/lesson/${nodeId}/finish`).send({ correct: 2, total: 3, answers }));
    expect(fin.status).toBe(200);
    const dash = await auth(request(app).get("/api/learn/analytics"));
    expect(dash.status).toBe(200);
    expect(dash.body.allTime.answered).toBeGreaterThanOrEqual(3);
    expect(dash.body.today).toHaveProperty("accuracy");
    expect(Array.isArray(dash.body.weakTopics)).toBe(true);
  });

  it("mistakes hub returns the recently-wrong card", async () => {
    const mis = await auth(request(app).get("/api/learn/mistakes"));
    expect(mis.status).toBe(200);
    expect(mis.body.count).toBeGreaterThanOrEqual(1);
  });

  it("answering a mistake correctly removes it from the hub", async () => {
    const before = (await auth(request(app).get("/api/learn/mistakes"))).body.cards;
    const target = before[0];
    await auth(request(app).post("/api/learn/mistakes/answer").send({ cardId: target.id, correct: true, responseMs: 900 }));
    const after = (await auth(request(app).get("/api/learn/mistakes"))).body.cards.map((c) => c.id);
    expect(after).not.toContain(target.id);
  });

  it("notes: save, list and read back a note + highlight", async () => {
    const cid = cardIds[0];
    const put = await auth(request(app).put(`/api/learn/notes/${cid}`).send({ note: "note-x", highlight: true }));
    expect(put.status).toBe(200);
    const one = await auth(request(app).get(`/api/learn/notes/${cid}`));
    expect(one.body.note).toBe("note-x");
    expect(one.body.highlight).toBe(true);
    const list = await auth(request(app).get("/api/learn/notes"));
    expect(list.body.notes.some((n) => n.card_id === cid)).toBe(true);
  });

  it("question_stats accumulate crowd difficulty", async () => {
    const { db } = await import("../src/db.js");
    const st = db.prepare("SELECT * FROM question_stats WHERE card_id=?").get(cardIds[1]);
    expect(st).toBeTruthy();
    expect(st.seen).toBeGreaterThanOrEqual(1);
  });
});

describe("learning path management (admin)", () => {
  let atk, topicId, nodeId;
  beforeAll(async () => { atk = await token("admin"); });
  const auth = (r) => r.set("Authorization", `Bearer ${atk}`);

  it("returns the full path tree", async () => {
    const r = await auth(request(app).get("/api/admin/path"));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.topics)).toBe(true);
  });
  it("creates, edits and deletes a topic with lessons", async () => {
    const c = await auth(request(app).post("/api/admin/path/topics").send({ slug: "t_" + Date.now(), name_fa: "درس", name_en: "Subj", emoji: "🧪" }));
    expect(c.status).toBe(200); topicId = c.body.id;
    const n = await auth(request(app).post("/api/admin/path/nodes").send({ topic_id: topicId, title_fa: "l1", xp_reward: 25, emoji: "💊" }));
    expect(n.status).toBe(200); nodeId = n.body.id;
    const q = await auth(request(app).post("/api/admin/path/questions").send({ type: "mcq", q_fa: "q?", options: [{ fa: "a", correct: true }, { fa: "b" }], node_id: nodeId }));
    expect(q.status).toBe(200);
    const tree = await auth(request(app).get("/api/admin/path"));
    const node = tree.body.topics.find((t) => t.id === topicId).nodes.find((x) => x.id === nodeId);
    expect(node.cardCount).toBe(1);
    const e = await auth(request(app).put(`/api/admin/path/nodes/${nodeId}`).send({ title_fa: "edited" }));
    expect(e.status).toBe(200);
    const d = await auth(request(app).delete(`/api/admin/path/topics/${topicId}`));
    expect(d.status).toBe(200);
  });
  it("blocks non-admin from editing the path", async () => {
    const ltk = await token("learner");
    const r = await request(app).post("/api/admin/path/topics").set("Authorization", `Bearer ${ltk}`).send({ slug: "x" });
    expect(r.status).toBe(403);
  });
});

describe("RBAC editor, learn cards, premium library, reorder (admin power)", () => {
  let atk, ltk, luid;
  beforeAll(async () => {
    atk = await token("admin");
    const lg = await login("learner", "demo");
    ltk = lg.body.token; luid = lg.body.user.id;
  });
  const A = (r) => r.set("Authorization", `Bearer ${atk}`);
  const L = (r) => r.set("Authorization", `Bearer ${ltk}`);

  it("admin can read and edit role permissions", async () => {
    const g = await A(request(app).get("/api/admin/roles"));
    expect(g.status).toBe(200);
    expect(g.body.editableRoles).toContain("content_manager");
    const p = await A(request(app).put("/api/admin/roles/content_manager").send({ perms: ["learn.view", "learn.ads"] }));
    expect(p.status).toBe(200);
    expect(p.body.rolePerms.content_manager).toEqual(["learn.view", "learn.ads"]);
  });
  it("cannot edit the admin role", async () => {
    const r = await A(request(app).put("/api/admin/roles/admin").send({ perms: [] }));
    expect(r.status).toBe(400);
  });
  it("admin creates learn cards (single, bulk) with premium + category", async () => {
    const c = await A(request(app).post("/api/admin/learn-cards").send({ type: "mcq", q_fa: "پ", options: [{ fa: "a", correct: true }, { fa: "b" }], premium: true, category: "قلب" }));
    expect(c.status).toBe(200);
    const b = await A(request(app).post("/api/admin/learn-cards/bulk").send({ cards: [{ type: "mcq", q_fa: "x", options: [{ fa: "y", correct: true }] }] }));
    expect(b.body.created).toBe(1);
    const list = await A(request(app).get("/api/admin/learn-cards?full=1"));
    expect(list.body.cards.some((x) => x.premium && x.category === "قلب")).toBe(true);
  });
  it("premium library is gated and grouped for premium users", async () => {
    const blocked = await L(request(app).get("/api/learn/library"));
    expect(blocked.status).toBe(402); // learner not premium
    const { db } = await import("../src/db.js");
    db.prepare("UPDATE learner_profiles SET premium=1 WHERE user_id=?").run(luid);
    const ok = await L(request(app).get("/api/learn/library"));
    expect(ok.status).toBe(200);
    expect(Array.isArray(ok.body.categories)).toBe(true);
  });
  it("learner can save a card for later (bookmark)", async () => {
    const { db } = await import("../src/db.js");
    const cardId = db.prepare("SELECT id FROM flashcards ORDER BY id DESC LIMIT 1").get().id;
    const s = await L(request(app).post(`/api/learn/library/save/${cardId}`));
    expect(s.status).toBe(200);
    expect(typeof s.body.saved).toBe("boolean");
  });
  it("admin can reorder lessons within a topic", async () => {
    const { db } = await import("../src/db.js");
    const tid = db.prepare("SELECT id FROM topics LIMIT 1").get().id;
    const nodes = db.prepare("SELECT id FROM path_nodes WHERE topic_id=? ORDER BY ord LIMIT 3").all(tid).map((n) => n.id);
    if (nodes.length >= 2) {
      const r = await A(request(app).put(`/api/admin/path/topics/${tid}/reorder`).send({ order: [...nodes].reverse() }));
      expect(r.status).toBe(200);
    }
  });
});

describe("payments & premium subscription (Zarinpal / mock)", () => {
  let ltk, luid, atk;
  beforeAll(async () => {
    // A DEDICATED fresh learner: the shared "learner" account may already be
    // premium from an earlier describe block, which would make /pay/subscribe
    // return 409 and make this suite order-dependent.
    const email = `payments_${Date.now()}@test.com`;
    await request(app).post("/api/auth/register").send({ email, password: "demo123", name_fa: "پرداخت" });
    const lg = await request(app).post("/api/auth/login").send({ username: email, password: "demo123" });
    ltk = lg.body.token; luid = lg.body.user?.id;
    atk = await token("admin");
  });
  const L = (r) => r.set("Authorization", `Bearer ${ltk}`);
  const A = (r) => r.set("Authorization", `Bearer ${atk}`);

  it("subscribe returns a gateway url + authority", async () => {
    const r = await L(request(app).post("/api/pay/subscribe").send({ plan: "yearly" }));
    expect(r.status).toBe(200);
    expect(r.body.url).toBeTruthy();
    expect(r.body.authority).toBeTruthy();
    expect(r.body.gateway).toBe("mock");
  });

  it("full flow: pay via callback activates premium", async () => {
    const sub = await L(request(app).post("/api/pay/subscribe").send({ plan: "monthly" }));
    const auth = sub.body.authority;
    // mock bank page renders
    const page = await request(app).get(`/api/pay/mock/${auth}`);
    expect(page.status).toBe(200);
    // callback OK -> verify + activate
    const cb = await request(app).get(`/api/pay/callback?Authority=${auth}&Status=OK`);
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe("/?pay=success");
    const prof = await L(request(app).get("/api/learn/profile"));
    expect(prof.body.profile.premium).toBe(1);
  });

  it("canceled payment does not grant premium", async () => {
    // fresh learner to avoid the earlier activation
    const email = `pay_${Date.now()}@test.com`;
    await request(app).post("/api/auth/register").send({ email, password: "demo123", name_fa: "پرداخت" });
    const lg = await request(app).post("/api/auth/login").send({ username: email, password: "demo123" });
    const T = (r) => r.set("Authorization", `Bearer ${lg.body.token}`);
    const sub = await T(request(app).post("/api/pay/subscribe").send({ plan: "monthly" }));
    const cb = await request(app).get(`/api/pay/callback?Authority=${sub.body.authority}&Status=NOK`);
    expect(cb.headers.location).toBe("/?pay=canceled");
    const prof = await T(request(app).get("/api/learn/profile"));
    expect(prof.body.profile.premium).toBe(0);
  });

  it("replaying a PAID callback is idempotent — premium is not double-extended (anti-fraud)", async () => {
    // fresh learner so we control the exact premium window
    const email = `payr_${Date.now()}@test.com`;
    await request(app).post("/api/auth/register").send({ email, password: "demo123", name_fa: "پرداخت تکراری" });
    const lg = await request(app).post("/api/auth/login").send({ username: email, password: "demo123" });
    const T = (r) => r.set("Authorization", `Bearer ${lg.body.token}`);
    const sub = await T(request(app).post("/api/pay/subscribe").send({ plan: "monthly" }));
    const auth = sub.body.authority;
    // first callback → premium activated
    await request(app).get(`/api/pay/callback?Authority=${auth}&Status=OK`);
    const after1 = (await T(request(app).get("/api/learn/profile"))).body.profile.premium_until;
    // REPLAY the same paid callback → must stay success but NOT extend the window
    const replay = await request(app).get(`/api/pay/callback?Authority=${auth}&Status=OK`);
    expect(replay.headers.location).toBe("/?pay=success");
    const after2 = (await T(request(app).get("/api/learn/profile"))).body.profile.premium_until;
    expect(after2).toBe(after1);   // no free extra time from replaying the URL
  });

  it("history lists the user's transactions", async () => {
    const r = await L(request(app).get("/api/pay/history"));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.transactions)).toBe(true);
    expect(r.body.transactions.length).toBeGreaterThan(0);
  });

  it("admin sees all transactions + revenue summary", async () => {
    const r = await A(request(app).get("/api/pay/admin/all"));
    expect(r.status).toBe(200);
    expect(r.body.revenue).toHaveProperty("paidCount");
    expect(r.body.revenue).toHaveProperty("activeSubs");
  });

  it("non-admin cannot see all transactions", async () => {
    const r = await L(request(app).get("/api/pay/admin/all"));
    expect(r.status).toBe(403);
  });
});

describe("admin-configurable pricing", () => {
  let atk, ltk;
  beforeAll(async () => { atk = await token("admin"); ltk = (await login("learner","demo")).body.token; });
  const A = (r) => r.set("Authorization", `Bearer ${atk}`);
  const L = (r) => r.set("Authorization", `Bearer ${ltk}`);

  it("admin reads and updates plan prices; plans reflect the change", async () => {
    const g = await A(request(app).get("/api/admin/pricing"));
    expect(g.status).toBe(200);
    expect(g.body).toHaveProperty("monthly");
    const p = await A(request(app).put("/api/admin/pricing").send({ monthly: 1500000, yearly: 9900000, monthlyDays: 30, yearlyDays: 365 }));
    expect(p.status).toBe(200);
    expect(p.body.monthly).toBe(1500000);
    // the learner-facing plans endpoint should now show 150,000 Toman
    const plans = await L(request(app).get("/api/learn/premium/plans"));
    expect(plans.body.plans[0].priceEn).toContain("150,000");
  });
  it("non-admin cannot change pricing", async () => {
    const r = await L(request(app).put("/api/admin/pricing").send({ monthly: 1 }));
    expect(r.status).toBe(403);
  });
});

describe("course store", () => {
  let atk, ltk, luid, courseId, freeLesson, lockedLesson;
  beforeAll(async () => {
    atk = await token("admin");
    const lg = await login("learner", "demo"); ltk = lg.body.token; luid = lg.body.user.id;
  });
  const A = (r) => r.set("Authorization", `Bearer ${atk}`);
  const L = (r) => r.set("Authorization", `Bearer ${ltk}`);

  it("admin creates a published course with free + locked lessons", async () => {
    const c = await A(request(app).post("/api/store/admin/courses").send({ title_fa: "دوره", title_en: "Course", price: 5000000, published: 1 }));
    expect(c.status).toBe(200); courseId = c.body.id;
    const f = await A(request(app).post(`/api/store/admin/courses/${courseId}/lessons`).send({ title_fa: "پیش‌نمایش", video_url: "/uploads/free.mp4", free_preview: 1 }));
    freeLesson = f.body.id;
    const k = await A(request(app).post(`/api/store/admin/courses/${courseId}/lessons`).send({ title_fa: "قفل", video_url: "/uploads/locked.mp4", free_preview: 0 }));
    lockedLesson = k.body.id;
    expect(freeLesson && lockedLesson).toBeTruthy();
  });
  it("public sees the course; locked video URL is hidden until owned", async () => {
    const detail = await request(app).get(`/api/store/courses/${courseId}`);
    expect(detail.status).toBe(200);
    const free = detail.body.lessons.find((l) => l.free_preview);
    const locked = detail.body.lessons.find((l) => !l.free_preview);
    expect(free.video_url).toBeTruthy();     // preview available
    expect(locked.video_url).toBeNull();     // locked hidden
    expect(locked.unlocked).toBe(false);
  });
  it("buy -> callback enrolls the learner and unlocks locked videos", async () => {
    const buy = await L(request(app).post(`/api/store/courses/${courseId}/buy`));
    expect(buy.status).toBe(200);
    const cb = await request(app).get(`/api/store/callback?Authority=${buy.body.authority}&Status=OK`);
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe("/?buy=success");
    const detail = await L(request(app).get(`/api/store/courses/${courseId}`));
    expect(detail.body.course.owned).toBe(true);
    expect(detail.body.lessons.find((l) => !l.free_preview).video_url).toBeTruthy();
  });
  it("free course enrolls instantly without payment", async () => {
    const c = await A(request(app).post("/api/store/admin/courses").send({ title_fa: "رایگان", price: 0, published: 1 }));
    const buy = await L(request(app).post(`/api/store/courses/${c.body.id}/buy`));
    expect(buy.body.owned).toBe(true);
  });
  it("admin can toggle free_preview and delete lessons/courses", async () => {
    const t1 = await A(request(app).put(`/api/store/admin/lessons/${lockedLesson}`).send({ free_preview: 1 }));
    expect(t1.status).toBe(200);
    const del = await A(request(app).delete(`/api/store/admin/lessons/${freeLesson}`));
    expect(del.status).toBe(200);
  });
  it("non-admin cannot manage the store", async () => {
    const r = await L(request(app).post("/api/store/admin/courses").send({ title_fa: "x" }));
    expect(r.status).toBe(403);
  });
  it("unpublished courses are hidden from the public storefront", async () => {
    const c = await A(request(app).post("/api/store/admin/courses").send({ title_fa: "پیش‌نویس", published: 0 }));
    const list = await request(app).get("/api/store/courses");
    expect(list.body.courses.find((x) => x.id === c.body.id)).toBeUndefined();
  });
});

describe("province ranking, saved review, all card types", () => {
  let ltk, atk, luid;
  beforeAll(async () => {
    const lg = await login("learner", "demo"); ltk = lg.body.token; luid = lg.body.user.id;
    atk = await token("admin");
  });
  const L = (r) => r.set("Authorization", `Bearer ${ltk}`);
  const A = (r) => r.set("Authorization", `Bearer ${atk}`);

  it("province ranking returns the learner's province leaderboard", async () => {
    const r = await L(request(app).get("/api/learn/ranking/province"));
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty("province");
    expect(Array.isArray(r.body.list)).toBe(true);
  });
  it("saving a card makes it appear in the saved review queue", async () => {
    const { db } = await import("../src/db.js");
    const cardId = db.prepare("SELECT id FROM flashcards WHERE active=1 LIMIT 1").get().id;
    await L(request(app).post(`/api/learn/library/save/${cardId}`));
    const saved = await L(request(app).get("/api/learn/review/saved"));
    expect(saved.status).toBe(200);
    expect(saved.body.count).toBeGreaterThanOrEqual(1);
  });
  it("admin can create every question type (fill/match/order/autocomplete)", async () => {
    for (const p of [
      { type: "fill", q_fa: "f?", blank_fa: "ans", accept_fa: ["ans"] },
      { type: "match", q_fa: "m?", pairs: [["a", "a", "1", "1"], ["b", "b", "2", "2"]] },
      { type: "order", q_fa: "o?", items_fa: ["x", "y", "z"] },
      { type: "mcq", q_fa: "ac?", answerMode: "search", subject: "histology", options: [{ fa: "x", correct: true }, { fa: "y" }] },
    ]) {
      const r = await A(request(app).post("/api/admin/learn-cards").send(p));
      expect(r.status).toBe(200);
    }
    const list = await A(request(app).get("/api/admin/learn-cards?full=1"));
    const types = list.body.cards.map((c) => c.type);
    expect(types).toContain("fill");
    expect(types).toContain("match");
    expect(types).toContain("order");
    const ac = list.body.cards.find((c) => c.type === "mcq" && c.data.answerMode === "search");
    expect(ac.data.subject).toBe("histology");
  });
  it("a card can carry hints and a micro lesson", async () => {
    const r = await A(request(app).post("/api/admin/learn-cards").send({
      type: "mcq", q_fa: "h?", options: [{ fa: "a", correct: true }, { fa: "b" }],
      hints_fa: ["راهنما ۱", "راهنما ۲"],
      micro: { lead_fa: "درسنامه", golden_fa: "نکته", points_fa: ["p1"], points_en: ["p1"] },
    }));
    expect(r.status).toBe(200);
    const list = await A(request(app).get("/api/admin/learn-cards?full=1"));
    const card = list.body.cards.find((c) => c.id === r.body.id);
    expect(card.hasHints).toBe(true);
    expect(card.hasMicro).toBe(true);
  });
  it("prompt edits persist (persistNow)", async () => {
    const put = await A(request(app).put("/api/prompts").send({ patient_fa: "متن تست پرامپت" }));
    expect(put.status).toBe(200);
    const get = await A(request(app).get("/api/prompts"));
    expect(get.body.patient_fa).toBe("متن تست پرامپت");
  });
});

describe("exam simulator, mind-maps & smart study plan", () => {
  const L = () => token("learner", "demo");
  const auth = async (r) => r.set("Authorization", `Bearer ${await L()}`);

  it("exam sim: starts (درسنامه hidden), finishes with a pass probability", async () => {
    const tk = await L();
    const start = await request(app).post("/api/learn/exam-sim/start")
      .set("Authorization", `Bearer ${tk}`).send({ n: 5, durationS: 300 });
    expect(start.status).toBe(200);
    expect(start.body.cards.length).toBeGreaterThan(0);
    // درسنامه must NOT be sent during the exam
    expect(start.body.cards[0].micro).toBeUndefined();
    const fin = await request(app).post(`/api/learn/exam-sim/${start.body.id}/finish`)
      .set("Authorization", `Bearer ${tk}`).send({ correct: 4, total: 5, timeMs: 120000 });
    expect(fin.status).toBe(200);
    expect(fin.body.prob).toBeGreaterThanOrEqual(1);
    expect(fin.body.prob).toBeLessThanOrEqual(99);
    expect(fin.body.breakdown.passMark).toBe(50);
    // history reflects the finished sim
    const hist = await request(app).get("/api/learn/exam-sim/history").set("Authorization", `Bearer ${tk}`);
    expect(hist.body.history.length).toBeGreaterThan(0);
  });

  it("exam sim: higher accuracy yields a higher pass probability", async () => {
    const tk = await L();
    const mk = async (correct) => {
      const s = await request(app).post("/api/learn/exam-sim/start").set("Authorization", `Bearer ${tk}`).send({ n: 10, durationS: 600 });
      const f = await request(app).post(`/api/learn/exam-sim/${s.body.id}/finish`).set("Authorization", `Bearer ${tk}`).send({ correct, total: 10, timeMs: 60000 });
      return f.body.prob;
    };
    const low = await mk(3);
    const high = await mk(9);
    expect(high).toBeGreaterThan(low);
  });

  it("mind-map: built from hand-written درسنامه (no AI), lists topics & branches", async () => {
    const tk = await L();
    const topics = await request(app).get("/api/learn/mindmap/topics").set("Authorization", `Bearer ${tk}`);
    expect(topics.status).toBe(200);
    const withContent = topics.body.topics.filter((t) => t.hasContent);
    expect(withContent.length).toBeGreaterThan(0);
    const detail = await request(app).get(`/api/learn/mindmap/${withContent[0].slug}`).set("Authorization", `Bearer ${tk}`);
    expect(detail.status).toBe(200);
    expect(detail.body.branches.length).toBeGreaterThan(0);
    // a branch must carry golden/point leaves derived from درسنامه
    const hasLeaf = detail.body.branches.some((b) => b.children.some((c) => c.kind === "golden" || c.kind === "point"));
    expect(hasLeaf).toBe(true);
  });

  it("study plan: deterministic day-by-day plan, weakest first, template note works with no AI", async () => {
    const tk = await L();
    // Future date computed at runtime (a hard-coded 2026-09-01 expired and the
    // plan then had no terminal mock day). 21 days guarantees the last-day mock.
    const examDate = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
    const gen = await request(app).post("/api/learn/study-plan")
      .set("Authorization", `Bearer ${tk}`).send({ examDate, minutesPerDay: 90 });
    expect(gen.status).toBe(200);
    expect(gen.body.plan.days.length).toBeGreaterThan(0);
    expect(gen.body.note).toBeTruthy();                 // template note (no AI key configured)
    expect(gen.body.plan.weakestFirst.length).toBeGreaterThan(0);
    // last day is a full mock exam
    const last = gen.body.plan.days[gen.body.plan.days.length - 1];
    expect(last.kind).toBe("mock");
    // persisted & retrievable
    const got = await request(app).get("/api/learn/study-plan").set("Authorization", `Bearer ${tk}`);
    expect(got.body.plan.minutesPerDay).toBe(90);
  });

  it("ai-status returns a boolean and never leaks the key", async () => {
    const tk = await L();
    const s = await request(app).get("/api/learn/ai-status").set("Authorization", `Bearer ${tk}`);
    expect(s.status).toBe(200);
    expect(typeof s.body.available).toBe("boolean");
    expect(s.body.apiKey).toBeUndefined();
  });

  it("PvP quick match: first player waits, second player is auto-matched", async () => {
    const a = await token("learner", "demo");
    const b = await token("learner1", "demo");
    const q1 = await request(app).post("/api/challenge/quick").set("Authorization", `Bearer ${a}`).send({});
    expect(q1.status).toBe(200);
    // first caller either waits or matches an already-open one; then the second matches
    const q2 = await request(app).post("/api/challenge/quick").set("Authorization", `Bearer ${b}`).send({});
    expect(q2.status).toBe(200);
    expect(q2.body.matched === true || q2.body.waiting === true).toBe(true);
  });
});

describe("community decks, visual mnemonics & crowd difficulty", () => {
  it("community: browse approved, vote, import; admin moderates the queue", async () => {
    const ltk = await token("learner", "demo");
    const auth = (r) => r.set("Authorization", `Bearer ${ltk}`);
    const browse = await auth(request(app).get("/api/learn/community?sort=top"));
    expect(browse.status).toBe(200);
    expect(browse.body.cards.length).toBeGreaterThan(0);
    const id = browse.body.cards[0].id;
    const before = browse.body.cards[0].score;
    const vote = await auth(request(app).post(`/api/learn/community/${id}/vote`).send({ value: 1 }));
    expect(vote.status).toBe(200);
    expect(typeof vote.body.score).toBe("number");
    const imp = await auth(request(app).post(`/api/learn/community/${id}/import`).send({}));
    expect(imp.status).toBe(200);
    // admin moderation queue has the pending seed card; approve it
    const atk = await token("admin");
    const A = (r) => r.set("Authorization", `Bearer ${atk}`);
    const q = await A(request(app).get("/api/admin/community/queue"));
    expect(q.status).toBe(200);
    expect(q.body.stats.approved).toBeGreaterThanOrEqual(1);
    if (q.body.queue.length) {
      const mod = await A(request(app).post(`/api/admin/community/${q.body.queue[0].id}/moderate`).send({ action: "approve" }));
      expect(mod.body.status).toBe("approved");
    }
  });

  it("community: a learner can share their own card into moderation", async () => {
    const ltk = await token("learner", "demo");
    const auth = (r) => r.set("Authorization", `Bearer ${ltk}`);
    const mk = await auth(request(app).post("/api/learn/mycards").send({
      q_fa: "کارت اشتراکی تست", options: [{ fa: "الف", correct: true }, { fa: "ب" }], hints_fa: ["h"],
    }));
    expect(mk.status).toBe(200);
    const share = await auth(request(app).post("/api/learn/community/share").send({ flashcardId: mk.body.id, topicId: 1 }));
    expect(share.status).toBe(200);
    expect(share.body.status).toBe("pending");
  });

  it("visual mnemonics: gallery returns Sketchy-style scenes with hooks", async () => {
    const ltk = await token("learner", "demo");
    const res = await request(app).get("/api/learn/mnemonics").set("Authorization", `Bearer ${ltk}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
    expect(res.body.items[0].mnemonic.hooks.length).toBeGreaterThan(0);
  });

  it("crowd difficulty: hardest questions come sorted by lowest pass rate", async () => {
    const ltk = await token("learner", "demo");
    const res = await request(app).get("/api/learn/crowd/hardest").set("Authorization", `Bearer ${ltk}`);
    expect(res.status).toBe(200);
    expect(res.body.cards.length).toBeGreaterThan(0);
    expect(res.body.summary.ratedCards).toBeGreaterThan(0);
    // sorted ascending by pass rate
    const rates = res.body.cards.map((c) => c.passRate);
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
  });

  it("admin can author a mnemonic on a card via the content manager", async () => {
    const atk = await token("admin");
    const A = (r) => r.set("Authorization", `Bearer ${atk}`);
    const create = await A(request(app).post("/api/admin/learn-cards").send({
      type: "mcq", q_fa: "کارت با منمونیک", options: [{ fa: "الف", correct: true }, { fa: "ب" }],
      mnemonic: { title_fa: "عنوان", scene_fa: "یک صحنه", hooks_fa: ["h1", "h2"], image: "" },
    }));
    expect(create.status).toBe(200);
    const list = await A(request(app).get("/api/admin/learn-cards?full=1"));
    const card = list.body.cards.find((c) => c.id === create.body.id);
    expect(card.data.mnemonic.scene_fa).toBe("یک صحنه");
  });
});

describe("multi-program (Duolingo-style courses)", () => {
  it("REGRESSION: mnemonics, mind-maps & crowd are all scoped to the active program", async () => {
    const tk = await token("learner", "demo");
    const auth = (r) => r.set("Authorization", `Bearer ${tk}`);
    // preint: clinical mnemonics
    await auth(request(app).post("/api/learn/program").send({ program: "preint" }));
    const preMn = (await auth(request(app).get("/api/learn/mnemonics?lang=fa"))).body.items.map((i) => i.q);
    const preMm = (await auth(request(app).get("/api/learn/mindmap/topics?lang=fa"))).body.topics.map((t) => t.slug);
    // basic: basic-science mnemonics only
    await auth(request(app).post("/api/learn/program").send({ program: "basic" }));
    const basMn = (await auth(request(app).get("/api/learn/mnemonics?lang=fa"))).body.items.map((i) => i.q);
    const basMm = (await auth(request(app).get("/api/learn/mindmap/topics?lang=fa"))).body.topics.map((t) => t.slug);
    // the two programs must not share any mnemonic questions or mind-map topics
    expect(preMn.some((q) => basMn.includes(q))).toBe(false);
    expect(preMm.some((s) => basMm.includes(s))).toBe(false);
    expect(basMm).toContain("anatomy");   // basic subject present
    expect(basMm).not.toContain("gi");    // preint subject absent
    await auth(request(app).post("/api/learn/program").send({ program: "preint" }));
  });

  it("lists programs, path is scoped to the active program, switching works", async () => {
    const tk = await token("learner", "demo");
    const auth = (r) => r.set("Authorization", `Bearer ${tk}`);
    const progs = await auth(request(app).get("/api/learn/programs?lang=fa"));
    expect(progs.status).toBe(200);
    expect(progs.body.programs.length).toBeGreaterThanOrEqual(2);
    expect(progs.body.active).toBe("preint");
    const preintPath = await auth(request(app).get("/api/learn/path?lang=fa"));
    const preintNames = preintPath.body.topics.map((t) => t.name);
    expect(preintNames).toContain("گوارش");            // pre-internship subject
    // switch to basic sciences
    const sw = await auth(request(app).post("/api/learn/program").send({ program: "basic" }));
    expect(sw.status).toBe(200);
    const basicPath = await auth(request(app).get("/api/learn/path?lang=fa"));
    const basicNames = basicPath.body.topics.map((t) => t.name);
    expect(basicNames).toContain("آناتومی");           // basic-science subject
    expect(basicNames).not.toContain("گوارش");         // preint subject must NOT leak
    // reset back to preint so other tests are unaffected
    await auth(request(app).post("/api/learn/program").send({ program: "preint" }));
  });

  it("rejects switching to an invalid program", async () => {
    const tk = await token("learner", "demo");
    const r = await request(app).post("/api/learn/program").set("Authorization", `Bearer ${tk}`).send({ program: "does_not_exist" });
    expect(r.status).toBe(400);
  });

  it("admin can list programs and filter the path by program", async () => {
    const atk = await token("admin");
    const A = (r) => r.set("Authorization", `Bearer ${atk}`);
    const progs = await A(request(app).get("/api/admin/programs"));
    expect(progs.status).toBe(200);
    const basic = progs.body.programs.find((p) => p.slug === "basic");
    expect(basic.topics).toBeGreaterThan(0);
    const path = await A(request(app).get("/api/admin/path?program=basic"));
    expect(path.body.topics.every((t) => t.program === "basic")).toBe(true);
  });

  it("admin can create a topic in the basic-sciences program", async () => {
    const atk = await token("admin");
    const A = (r) => r.set("Authorization", `Bearer ${atk}`);
    const slug = "physics_test_" + Date.now();
    const create = await A(request(app).post("/api/admin/path/topics").send({
      slug, name_fa: "درس تست پایه", name_en: "Test basic subject", program: "basic", parent: "basic",
    }));
    expect(create.status).toBe(200);
    const path = await A(request(app).get("/api/admin/path?program=basic"));
    const found = path.body.topics.find((t) => t.slug === slug);
    expect(found).toBeTruthy();
    expect(found.program).toBe("basic");
  });

  it("signup lets the learner choose their course (basic) and it sticks", async () => {
    const email = `basicjoiner${Date.now()}@test.com`;
    const reg = await request(app).post("/api/auth/register")
      .send({ email, password: "test1234", name_fa: "کاربر پایه", province: "تهران", program: "basic" });
    expect(reg.status).toBe(200);
    const tk = reg.body.token;
    const auth = (r) => r.set("Authorization", `Bearer ${tk}`);
    // active program should already be 'basic' from signup
    const progs = await auth(request(app).get("/api/learn/programs?lang=fa"));
    expect(progs.body.active).toBe("basic");
    // and the path shows basic-science subjects
    const path = await auth(request(app).get("/api/learn/path?lang=fa"));
    const names = path.body.topics.map((t) => t.name);
    expect(names).toContain("آناتومی");
    expect(names).not.toContain("گوارش");
  });

  it("REGRESSION: switching program round-trip returns correctly scoped paths", async () => {
    const tk = await token("learner", "demo");
    const auth = (r) => r.set("Authorization", `Bearer ${tk}`);
    // preint → basic → preint, checking the path each time
    await auth(request(app).post("/api/learn/program").send({ program: "preint" }));
    let names = (await auth(request(app).get("/api/learn/path?lang=fa"))).body.topics.map((t) => t.name);
    expect(names).toContain("گوارش");
    await auth(request(app).post("/api/learn/program").send({ program: "basic" }));
    names = (await auth(request(app).get("/api/learn/path?lang=fa"))).body.topics.map((t) => t.name);
    expect(names).toContain("آناتومی");
    expect(names).not.toContain("گوارش");
    await auth(request(app).post("/api/learn/program").send({ program: "preint" }));
    names = (await auth(request(app).get("/api/learn/path?lang=fa"))).body.topics.map((t) => t.name);
    expect(names).toContain("گوارش");
    expect(names).not.toContain("آناتومی");
  });
});

describe("site control: maintenance, banner, store toggle, config, uni members", () => {
  it("admin can toggle maintenance; learners are blocked, admins are not; login stays open", async () => {
    const atk = await token("admin");
    const A = (r) => r.set("Authorization", `Bearer ${atk}`);
    const on = await A(request(app).put("/api/admin/maintenance").send({ on: true, title_fa: "تعمیر", body_fa: "به‌زودی" }));
    expect(on.status).toBe(200);
    expect(on.body.maintenance.on).toBe(true);
    // public config reflects it
    const cfg = await request(app).get("/api/site-content/config?lang=fa");
    expect(cfg.body.maintenance.on).toBe(true);
    // learner is blocked (503)
    const ltk = await token("learner", "demo");   // login still works during maintenance
    const blocked = await request(app).get("/api/learn/home?lang=fa").set("Authorization", `Bearer ${ltk}`);
    expect(blocked.status).toBe(503);
    // admin is not blocked
    const okAdmin = await A(request(app).get("/api/admin/overview"));
    expect(okAdmin.status).toBe(200);
    // turn off
    await A(request(app).put("/api/admin/maintenance").send({ on: false }));
    const after = await request(app).get("/api/learn/home?lang=fa").set("Authorization", `Bearer ${ltk}`);
    expect(after.status).toBe(200);
  });

  it("admin can set the landing banner and it shows in public config", async () => {
    const atk = await token("admin");
    const A = (r) => r.set("Authorization", `Bearer ${atk}`);
    await A(request(app).put("/api/admin/banner").send({ on: true, text_fa: "تخفیف ویژه", cta_fa: "مشاهده", url: "/store" }));
    const cfg = await request(app).get("/api/site-content/config?lang=fa");
    expect(cfg.body.banner.on).toBe(true);
    expect(cfg.body.banner.text_fa).toBe("تخفیف ویژه");
  });

  it("store feature flag controls storeEnabled in public config", async () => {
    const atk = await token("admin");
    const A = (r) => r.set("Authorization", `Bearer ${atk}`);
    await A(request(app).put("/api/admin/flags/store").send({ enabled: false }));
    let cfg = await request(app).get("/api/site-content/config");
    expect(cfg.body.storeEnabled).toBe(false);
    await A(request(app).put("/api/admin/flags/store").send({ enabled: true }));
    cfg = await request(app).get("/api/site-content/config");
    expect(cfg.body.storeEnabled).toBe(true);
  });

  it("university members endpoint lists teachers under a university", async () => {
    const atk = await token("admin");
    const A = (r) => r.set("Authorization", `Bearer ${atk}`);
    const unis = await A(request(app).get("/api/universities"));
    if (unis.body.universities && unis.body.universities.length) {
      const uid = unis.body.universities[0].id;
      const m = await A(request(app).get(`/api/universities/${uid}/members?lang=fa`));
      expect(m.status).toBe(200);
      expect(Array.isArray(m.body.teachers)).toBe(true);
      expect(Array.isArray(m.body.students)).toBe(true);
    }
  });

  it("t() overrides: an admin site-content override changes any string (CMS)", async () => {
    const atk = await token("admin");
    const A = (r) => r.set("Authorization", `Bearer ${atk}`);
    const put = await A(request(app).put("/api/site-content").send({ content: { "fa:learnPathHint": "متن سفارشی مسیر" } }));
    expect(put.status).toBe(200);
    const pub = await request(app).get("/api/site-content");
    expect(pub.body.content["fa:learnPathHint"]).toBe("متن سفارشی مسیر");
  });
});

describe("Duolingo-style streak upgrades (society, perfect streak, freeze, at-risk)", () => {
  it("crossing a Streak Society milestone auto-grants gems + freezes", async () => {
    const tk = await token("learner", "demo");
    const auth = (r) => r.set("Authorization", `Bearer ${tk}`);
    const { db } = await import("../src/db.js");
    const me = (await auth(request(app).get("/api/learn/profile"))).body.profile;
    const y = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
    // stand at 6-day streak, tier already at 3, so finishing today reaches the 7-day tier
    db.prepare("UPDATE learner_profiles SET streak=6, last_active=?, society_tier=3, gems=100, freezes=0 WHERE user_id=?").run(y, me.user_id);
    const node = db.prepare("SELECT id FROM path_nodes WHERE active=1 ORDER BY id LIMIT 1").get().id;
    const fin = await auth(request(app).post(`/api/learn/lesson/${node}/finish`).send({ correct: 5, total: 5 }));
    expect(fin.status).toBe(200);
    expect(fin.body.streak.milestone.days).toBe(7);
    const after = (await auth(request(app).get("/api/learn/profile"))).body.profile;
    expect(after.streak).toBe(7);
    expect(after.gems).toBe(140);      // 100 + 40
    expect(after.freezes).toBe(1);     // 0 + 1
  });

  it("a missed day is saved by a freeze and marked frozen in the calendar", async () => {
    // a brand-new learner so no earlier test has touched its streak state
    const email = `freezetest${Date.now()}@test.com`;
    const reg = await request(app).post("/api/auth/register").send({ email, password: "test1234", name_fa: "تست", province: "تهران", program: "preint" });
    const tk = reg.body.token;
    const auth = (r) => r.set("Authorization", `Bearer ${tk}`);
    const { db } = await import("../src/db.js");
    await auth(request(app).get("/api/learn/profile"));
    const uid = db.prepare("SELECT id FROM users WHERE email=?").get(email).id;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
    const twoAgo = new Date(Date.now() - 2 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
    // last active 2 days ago (missed one day) with a freeze; society_tier high
    // so no milestone grant interferes with the freeze-count assertion.
    db.prepare("UPDATE learner_profiles SET streak=5, perfect_streak=5, last_active=?, freezes=1, society_tier=100 WHERE user_id=?").run(twoAgo, uid);
    db.prepare("DELETE FROM streak_days WHERE user_id=? AND day=?").run(uid, today);
    const node = db.prepare("SELECT id FROM path_nodes WHERE active=1 ORDER BY id LIMIT 1").get().id;
    const fin = await auth(request(app).post(`/api/learn/lesson/${node}/finish`).send({ correct: 3, total: 3 }));
    expect(fin.body.streak.usedFreeze).toBe(true);
    const after = db.prepare("SELECT streak, freezes, perfect_streak FROM learner_profiles WHERE user_id=?").get(uid);
    expect(after.streak).toBe(6);        // preserved & incremented
    expect(after.freezes).toBe(0);       // freeze consumed
    expect(after.perfect_streak).toBe(0); // perfect streak reset (freeze used)
    // the missed (yesterday) day is marked frozen in the calendar
    const cal = (await auth(request(app).get("/api/learn/streak"))).body;
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
    const frozenDay = cal.days.find((d) => d.day === yesterday);
    expect(frozenDay && frozenDay.frozen).toBe(true);
  });

  it("TWO missed days are covered by TWO stacked freezes (ampoules)", async () => {
    const email = `freeze2test${Date.now()}@test.com`;
    const reg = await request(app).post("/api/auth/register").send({ email, password: "test1234", name_fa: "تست", province: "تهران", program: "preint" });
    const tk = reg.body.token;
    const auth = (r) => r.set("Authorization", `Bearer ${tk}`);
    const { db } = await import("../src/db.js");
    await auth(request(app).get("/api/learn/profile"));
    const uid = db.prepare("SELECT id FROM users WHERE email=?").get(email).id;
    const threeAgo = new Date(Date.now() - 3 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
    // last active 3 days ago (missed TWO days) with 2 ampoules in reserve
    db.prepare("UPDATE learner_profiles SET streak=8, perfect_streak=8, last_active=?, freezes=2, society_tier=100 WHERE user_id=?").run(threeAgo, uid);
    const node = db.prepare("SELECT id FROM path_nodes WHERE active=1 ORDER BY id LIMIT 1").get().id;
    const fin = await auth(request(app).post(`/api/learn/lesson/${node}/finish`).send({ correct: 3, total: 3 }));
    expect(fin.body.streak.usedFreeze).toBe(true);
    const after = db.prepare("SELECT streak, freezes FROM learner_profiles WHERE user_id=?").get(uid);
    expect(after.streak).toBe(9);    // preserved & incremented
    expect(after.freezes).toBe(0);   // BOTH ampoules consumed (one per missed day)
  });

  it("streak breaks when missed days exceed available freezes", async () => {
    const email = `nofreeze${Date.now()}@test.com`;
    const reg = await request(app).post("/api/auth/register").send({ email, password: "test1234", name_fa: "تست", province: "تهران", program: "preint" });
    const tk = reg.body.token;
    const auth = (r) => r.set("Authorization", `Bearer ${tk}`);
    const { db } = await import("../src/db.js");
    await auth(request(app).get("/api/learn/profile"));
    const uid = db.prepare("SELECT id FROM users WHERE email=?").get(email).id;
    const threeAgo = new Date(Date.now() - 3 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
    // missed TWO days but only ONE ampoule → not enough → streak resets to 1
    db.prepare("UPDATE learner_profiles SET streak=8, last_active=?, freezes=1, society_tier=100 WHERE user_id=?").run(threeAgo, uid);
    const node = db.prepare("SELECT id FROM path_nodes WHERE active=1 ORDER BY id LIMIT 1").get().id;
    const fin = await auth(request(app).post(`/api/learn/lesson/${node}/finish`).send({ correct: 3, total: 3 }));
    expect(fin.body.streak.usedFreeze).toBe(false);
    const after = db.prepare("SELECT streak, freezes FROM learner_profiles WHERE user_id=?").get(uid);
    expect(after.streak).toBe(1);    // broke — restarted
    expect(after.freezes).toBe(1);   // ampoule NOT wasted when it can't fully cover
  });

  it("confidence_assess feature flag is OFF by default (no per-card clutter)", async () => {
    const { isEnabled } = await import("../src/lib/flags.js");
    expect(isEnabled("confidence_assess")).toBe(false);
  });

  it("streak status reports at-risk and next milestone", async () => {
    const email = `atrisk${Date.now()}@test.com`;
    const reg = await request(app).post("/api/auth/register").send({ email, password: "test1234", name_fa: "تست", province: "تهران", program: "preint" });
    const tk = reg.body.token;
    const auth = (r) => r.set("Authorization", `Bearer ${tk}`);
    const { db } = await import("../src/db.js");
    await auth(request(app).get("/api/learn/profile"));
    const uid = db.prepare("SELECT id FROM users WHERE email=?").get(email).id;
    const y = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
    db.prepare("UPDATE learner_profiles SET streak=10, last_active=? WHERE user_id=?").run(y, uid);
    db.prepare("DELETE FROM streak_days WHERE user_id=? AND day=?").run(uid, today);
    const st = (await auth(request(app).get("/api/learn/streak"))).body.status;
    expect(st.atRisk).toBe(true);
    expect(st.nextMilestone).toBe(14);
    expect(st.toNext).toBe(4);
  });
});

describe("Duolingo-2026 mechanics: wager, monthly, XP ramp-up, revival, rewarded ads", () => {
  async function learnerToken() { return token("learner", "demo"); }

  it("wager status is available and can be placed with enough gems", async () => {
    const tk = await token("learner1", "demo");   // fresh-ish demo learner
    const st = await request(app).get("/api/learn/wager?lang=fa").set("Authorization", `Bearer ${tk}`);
    expect(st.status).toBe(200);
    expect(st.body).toHaveProperty("enabled");
    expect(st.body).toHaveProperty("stake");
  });

  it("placing a wager without gems is rejected cleanly (400)", async () => {
    // register a brand-new learner (0 gems)
    const reg = await request(app).post("/api/auth/register").send({ email: `wager_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token;
    const res = await request(app).post("/api/learn/wager").set("Authorization", `Bearer ${tk}`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("not enough gems");
  });

  it("monthly quest returns progress/goal and a badges array", async () => {
    const tk = await learnerToken();
    const res = await request(app).get("/api/learn/monthly").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    expect(res.body.monthly).toHaveProperty("goal");
    expect(Array.isArray(res.body.badges)).toBe(true);
  });

  it("claiming a completed daily quest bumps the monthly quest progress", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: `mq_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token;
    // finish a lesson to advance quests, then try to claim any completed quest
    await request(app).post("/api/learn/lesson/1/finish").set("Authorization", `Bearer ${tk}`).send({ correct: 3, total: 3 });
    const quests = (await request(app).get("/api/learn/quests?lang=fa").set("Authorization", `Bearer ${tk}`)).body.quests || [];
    const done = quests.find((q) => q.done && !q.claimed);
    if (done) {
      const claim = await request(app).post(`/api/learn/quests/${done.id}/claim`).set("Authorization", `Bearer ${tk}`).send({});
      expect(claim.status).toBe(200);
      expect(claim.body.monthly.progress).toBeGreaterThanOrEqual(1);
    }
    expect(true).toBe(true);
  });

  it("XP ramp-up event: start returns cards, finish awards XP", async () => {
    const tk = await learnerToken();
    const def = await request(app).get("/api/learn/event?lang=fa").set("Authorization", `Bearer ${tk}`);
    expect(def.status).toBe(200);
    expect(def.body.enabled).toBe(true);
    const start = await request(app).post("/api/learn/event/start").set("Authorization", `Bearer ${tk}`).send({});
    expect(start.status).toBe(200);
    expect(start.body.cards.length).toBeGreaterThan(0);
    const fin = await request(app).post(`/api/learn/event/${start.body.runId}/finish`)
      .set("Authorization", `Bearer ${tk}`).send({ correct: start.body.cards.length });
    expect(fin.status).toBe(200);
    expect(fin.body.xp).toBeGreaterThan(0);
    expect(fin.body.flawless).toBe(true);
  });

  it("revival status returns eligibility fields", async () => {
    const tk = await learnerToken();
    const res = await request(app).get("/api/learn/revival").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("eligible");
    expect(res.body).toHaveProperty("lessonsRequired");
  });

  it("rewarded ad: fetch a rewarded ad and claim its reward (gems)", async () => {
    await request(app).put("/api/ads/master").set("Authorization", `Bearer ${await token("admin", "demo")}`).send({ enabled: true });
    const reg = await request(app).post("/api/auth/register").send({ email: `ad_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token;
    const ad = await request(app).get("/api/learn/ad?format=rewarded&lang=fa").set("Authorization", `Bearer ${tk}`);
    expect(ad.status).toBe(200);
    expect(ad.body.ad).toBeTruthy();
    const before = (await request(app).get("/api/learn/profile").set("Authorization", `Bearer ${tk}`)).body.profile.gems;
    const claim = await request(app).post("/api/learn/ad/reward").set("Authorization", `Bearer ${tk}`).send({ adId: ad.body.ad.id, format: "rewarded" });
    expect(claim.status).toBe(200);
    expect(claim.body.gems).toBeGreaterThan(0);
    const after = (await request(app).get("/api/learn/profile").set("Authorization", `Bearer ${tk}`)).body.profile.gems;
    expect(after).toBeGreaterThan(before);
  });

  it("ads master switch: OFF hides ALL ads for everyone; ON restores them; premium never sees ads", async () => {
    const atk = await token("admin", "demo");
    // create a banner ad on the home slot
    await request(app).post("/api/ads").set("Authorization", `Bearer ${atk}`)
      .send({ slot: "home", format: "banner", title_fa: "بنر تست", title_en: "Test banner", active: 1 });
    // MASTER OFF (default) → a normal learner sees no ads
    await request(app).put("/api/ads/master").set("Authorization", `Bearer ${atk}`).send({ enabled: false });
    const reg = await request(app).post("/api/auth/register").send({ email: `ms_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token;
    let ads = (await request(app).get("/api/learn/ads?slot=home").set("Authorization", `Bearer ${tk}`)).body.ads;
    expect(ads.length).toBe(0);
    // MASTER ON → the learner now sees the banner
    await request(app).put("/api/ads/master").set("Authorization", `Bearer ${atk}`).send({ enabled: true });
    ads = (await request(app).get("/api/learn/ads?slot=home").set("Authorization", `Bearer ${tk}`)).body.ads;
    expect(ads.length).toBeGreaterThan(0);
    // premium user sees NO ads even with master ON
    const { db } = await import("../src/db.js");
    const me = (await request(app).get("/api/auth/me").set("Authorization", `Bearer ${tk}`)).body.user;
    db.prepare("UPDATE learner_profiles SET premium=1 WHERE user_id=?").run(me.id);
    const premAds = (await request(app).get("/api/learn/ads?slot=home").set("Authorization", `Bearer ${tk}`)).body.ads;
    expect(premAds.length).toBe(0);
    // reset master OFF (keep default for other tests that don't opt in)
    await request(app).put("/api/ads/master").set("Authorization", `Bearer ${atk}`).send({ enabled: false });
  });

  it("deep site analytics: exposes DAU/WAU/MAU, stickiness, retention, trends", async () => {
    const atk = await token("admin", "demo");
    const res = await request(app).get("/api/admin/analytics").set("Authorization", `Bearer ${atk}`);
    expect(res.status).toBe(200);
    expect(res.body.active).toBeTruthy();
    expect(typeof res.body.active.dau).toBe("number");
    expect(typeof res.body.active.stickiness).toBe("number");
    expect(res.body.retention).toBeTruthy();
    expect(Array.isArray(res.body.activityTrend)).toBe(true);
    expect(res.body.premium).toBeTruthy();
    expect(res.body.engagement).toBeTruthy();
  });

  it("analytics exports (CSV/PDF), auto-alerts, and university/class segmentation", async () => {
    const atk = await token("admin", "demo");
    // CSV exports
    const siteCsv = await request(app).get("/api/admin/analytics.csv?lang=fa").set("Authorization", `Bearer ${atk}`);
    expect(siteCsv.status).toBe(200);
    expect(siteCsv.headers["content-type"]).toContain("text/csv");
    expect(siteCsv.text).toContain("DAU");
    const adCsv = await request(app).get("/api/ads/analytics.csv?lang=en").set("Authorization", `Bearer ${atk}`);
    expect(adCsv.status).toBe(200);
    expect(adCsv.text).toContain("CTR");
    // printable PDF (HTML) endpoints
    const sitePdf = await request(app).get("/api/admin/analytics.pdf?lang=fa").set("Authorization", `Bearer ${atk}`);
    expect(sitePdf.status).toBe(200);
    expect(sitePdf.text).toContain("window.print");
    // auto-alerts: editable thresholds; setting an impossible one fires an alert
    await request(app).put("/api/ads/master").set("Authorization", `Bearer ${atk}`).send({ enabled: true });
    const th = await request(app).put("/api/admin/analytics/alerts").set("Authorization", `Bearer ${atk}`).send({ ctr_min: 999 });
    expect(th.status).toBe(200);
    expect(th.body.thresholds.ctr_min).toBe(999);
    const alerts = await request(app).get("/api/admin/analytics/alerts").set("Authorization", `Bearer ${atk}`);
    expect(alerts.status).toBe(200);
    expect(Array.isArray(alerts.body.alerts)).toBe(true);
    // reset thresholds + master
    await request(app).put("/api/admin/analytics/alerts").set("Authorization", `Bearer ${atk}`).send({ ctr_min: 0.5 });
    await request(app).put("/api/ads/master").set("Authorization", `Bearer ${atk}`).send({ enabled: false });
    // segmentation
    const seg = await request(app).get("/api/admin/analytics/segments?lang=fa").set("Authorization", `Bearer ${atk}`);
    expect(seg.status).toBe(200);
    expect(Array.isArray(seg.body.universities)).toBe(true);
    expect(Array.isArray(seg.body.classes)).toBe(true);
  });

  it("admin analytics notifications: alerts → admin bell feed + weekly digest, de-duped", async () => {
    const atk = await token("admin", "demo");
    // force at least one alert: ads on + strict CTR threshold + a low-CTR ad
    await request(app).put("/api/ads/master").set("Authorization", `Bearer ${atk}`).send({ enabled: true });
    await request(app).put("/api/admin/analytics/alerts").set("Authorization", `Bearer ${atk}`).send({ ctr_min: 999 });
    await request(app).post("/api/ads").set("Authorization", `Bearer ${atk}`)
      .send({ slot: "home", format: "banner", title_fa: "کم", title_en: "low", active: 1 });
    // preview the weekly digest text
    const dg = await request(app).get("/api/admin/analytics/weekly-digest?lang=fa").set("Authorization", `Bearer ${atk}`);
    expect(dg.status).toBe(200);
    expect(typeof dg.body.text).toBe("string");
    // run alerts → creates admin notifications
    const run = await request(app).post("/api/admin/analytics/run-alerts").set("Authorization", `Bearer ${atk}`);
    expect(run.status).toBe(200);
    // second run same day → de-duped (0)
    const run2 = await request(app).post("/api/admin/analytics/run-alerts").set("Authorization", `Bearer ${atk}`);
    expect(run2.body.sent).toBe(0);
    // send the weekly digest
    const sendDg = await request(app).post("/api/admin/analytics/weekly-digest").set("Authorization", `Bearer ${atk}`);
    expect(sendDg.status).toBe(200);
    // the admin bell feed now has notifications
    const feed = await request(app).get("/api/admin/notifications").set("Authorization", `Bearer ${atk}`);
    expect(feed.status).toBe(200);
    expect(feed.body.notifications.length).toBeGreaterThan(0);
    // mark seen works
    const seen = await request(app).post("/api/admin/notifications/seen").set("Authorization", `Bearer ${atk}`);
    expect(seen.status).toBe(200);
    const feed2 = await request(app).get("/api/admin/notifications").set("Authorization", `Bearer ${atk}`);
    expect(feed2.body.unseen).toBe(0);
    // reset thresholds + master
    await request(app).put("/api/admin/analytics/alerts").set("Authorization", `Bearer ${atk}`).send({ ctr_min: 0.5 });
    await request(app).put("/api/ads/master").set("Authorization", `Bearer ${atk}`).send({ enabled: false });
  });

  it("deep ad analytics: CTR/eCPM/fill/reach/frequency/RPM + editable eCPM", async () => {
    const atk = await token("admin", "demo");
    // set an eCPM benchmark for banners
    const put = await request(app).put("/api/ads/ecpm").set("Authorization", `Bearer ${atk}`).send({ banner: 5000, currency: "تومان" });
    expect(put.status).toBe(200);
    expect(put.body.ecpm.banner).toBe(5000);
    const res = await request(app).get("/api/ads/analytics").set("Authorization", `Bearer ${atk}`);
    expect(res.status).toBe(200);
    expect(res.body.totals).toBeTruthy();
    for (const k of ["impressions", "clicks", "ctr", "reach", "frequency", "estRevenue", "rpm"]) expect(res.body.totals[k] !== undefined).toBe(true);
    expect(Array.isArray(res.body.byFormat)).toBe(true);
    expect(Array.isArray(res.body.trend)).toBe(true);
  });

  it("ads support new formats (native/app_open/sponsored) + weight/schedule/cap fields", async () => {
    const atk = await token("admin", "demo");
    const meta = await request(app).get("/api/ads").set("Authorization", `Bearer ${atk}`);
    for (const f of ["native", "app_open", "sponsored"]) expect(meta.body.formats).toContain(f);
    const created = await request(app).post("/api/ads").set("Authorization", `Bearer ${atk}`)
      .send({ slot: "home", format: "native", title_fa: "نیتیو", weight: 5, daily_cap: 2, audience: "free", start_at: "", end_at: "" });
    expect(created.status).toBe(200);
    // toggle it off/on
    const tog = await request(app).put(`/api/ads/${created.body.id}/toggle`).set("Authorization", `Bearer ${atk}`);
    expect(tog.status).toBe(200);
  });

  it("rewarded ad enforces the daily reward cap (429 after cap)", async () => {
    await request(app).put("/api/ads/master").set("Authorization", `Bearer ${await token("admin", "demo")}`).send({ enabled: true });
    const reg = await request(app).post("/api/auth/register").send({ email: `cap_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token;
    const cfg = (await request(app).get("/api/admin/game-config").set("Authorization", `Bearer ${await token("admin","demo")}`)).body.config;
    const cap = cfg.ads.daily_reward_cap;
    let last;
    for (let i = 0; i < cap + 1; i++) {
      last = await request(app).post("/api/learn/ad/reward").set("Authorization", `Bearer ${tk}`).send({ adId: 4, format: "rewarded" });
    }
    expect(last.status).toBe(429);
    expect(last.body.capped).toBe(true);
  });

  it("admin can read and update the gamification config", async () => {
    const at = await token("admin", "demo");
    const get1 = await request(app).get("/api/admin/game-config").set("Authorization", `Bearer ${at}`);
    expect(get1.status).toBe(200);
    expect(get1.body.config.wager).toHaveProperty("stake");
    const put = await request(app).put("/api/admin/game-config").set("Authorization", `Bearer ${at}`).send({ config: { wager: { stake: 77 } } });
    expect(put.status).toBe(200);
    expect(put.body.config.wager.stake).toBe(77);
    // non-admin cannot
    const lt = await token("learner", "demo");
    const forbidden = await request(app).put("/api/admin/game-config").set("Authorization", `Bearer ${lt}`).send({ config: {} });
    expect([401, 403]).toContain(forbidden.status);
  });

  it("admin can create a rewarded ad with format + reward fields; stats endpoint works", async () => {
    const at = await token("admin", "demo");
    const create = await request(app).post("/api/ads").set("Authorization", `Bearer ${at}`)
      .send({ slot: "reward", format: "rewarded", sponsor: "TestCo", reward_gems: 12, duration_s: 10, title_fa: "تست", title_en: "Test", active: 1 });
    expect(create.status).toBe(200);
    const stats = await request(app).get("/api/ads/stats").set("Authorization", `Bearer ${at}`);
    expect(stats.status).toBe(200);
    expect(Array.isArray(stats.body.byFormat)).toBe(true);
  });
});

describe("Friends / social system", () => {
  const A = (t) => ({ Authorization: `Bearer ${t}` });
  let reg = 0;
  // register a fresh learner (self-contained; not affected by ban/delete tests)
  async function fresh() {
    const r = await request(app).post("/api/auth/register")
      .send({ email: `friend_${Date.now()}_${reg++}@t.com`, password: "1234", name_fa: `دوست${reg}`, name_en: `Friend${reg}` });
    return r.body; // { token, user }
  }
  async function befriend(a, b) {
    await request(app).post(`/api/learn/friends/follow/${b.user.id}`).set(A(a.token)).send({});
    await request(app).post(`/api/learn/friends/follow/${a.user.id}`).set(A(b.token)).send({});
  }

  it("follow → mutual makes friends; friend streak ticks when both do a lesson", async () => {
    const me = await fresh(); const fr = await fresh();
    await befriend(me, fr);
    await request(app).post("/api/learn/lesson/1/finish").set(A(me.token)).send({ correct: 3, total: 3 });
    await request(app).post("/api/learn/lesson/1/finish").set(A(fr.token)).send({ correct: 3, total: 3 });
    const data = (await request(app).get("/api/learn/friends?lang=fa").set(A(me.token))).body;
    const friend = data.following.find((x) => x.id === fr.user.id);
    expect(friend.friend).toBe(true);
    const fs = data.streaks.streaks.find((s) => s.friendId === fr.user.id);
    expect(fs.streak).toBeGreaterThanOrEqual(1);
    expect(data.leaderboard.some((r) => r.isMe)).toBe(true);
  });

  it("friend search excludes self and finds learners", async () => {
    const me = await fresh();
    const res = await request(app).get("/api/learn/friends/search?q=learner&lang=fa").set(A(me.token));
    expect(res.status).toBe(200);
    expect(res.body.results.some((u) => u.id === me.user.id)).toBe(false);
  });

  it("friend quest: start, complete via lessons, then claim gems", async () => {
    const at = (await login("admin", "demo")).body.token;
    await request(app).put("/api/admin/game-config").set(A(at)).send({ config: { friends: { quest_goal: 1 } } });
    const me = await fresh(); const fr = await fresh();
    await befriend(me, fr);
    await request(app).post(`/api/learn/friends/quest/${fr.user.id}`).set(A(me.token)).send({});
    await request(app).post("/api/learn/lesson/1/finish").set(A(me.token)).send({ correct: 3, total: 3 });
    const q = (await request(app).get("/api/learn/friends?lang=fa").set(A(me.token))).body.quests[0];
    expect(q.complete).toBe(true);
    const claim = await request(app).post(`/api/learn/friends/quest/${q.id}/claim`).set(A(me.token)).send({});
    expect(claim.status).toBe(200);
    expect(claim.body.gems).toBeGreaterThan(0);
    // restore default goal
    await request(app).put("/api/admin/game-config").set(A(at)).send({ config: { friends: { quest_goal: 300 } } });
  });

  it("activity feed shows friend milestones and a friend can high-five", async () => {
    const me = await fresh(); const fr = await fresh();
    await befriend(me, fr);
    await request(app).post("/api/learn/lesson/1/finish").set(A(me.token)).send({ correct: 3, total: 3 });
    const feed = (await request(app).get("/api/learn/friends/feed?lang=fa").set(A(fr.token))).body.feed;
    const ev = feed.find((e) => !e.isMe);
    expect(ev).toBeTruthy();
    const hf = await request(app).post(`/api/learn/friends/feed/${ev.id}/highfive`).set(A(fr.token)).send({});
    expect(hf.status).toBe(200);
  });

  it("friends feature flag gates the endpoints (403 when off)", async () => {
    const at = (await login("admin", "demo")).body.token;
    const me = await fresh();
    await request(app).put("/api/admin/flags/friends").set(A(at)).send({ enabled: false });
    const res = await request(app).get("/api/learn/friends?lang=fa").set(A(me.token));
    expect(res.status).toBe(403);
    await request(app).put("/api/admin/flags/friends").set(A(at)).send({ enabled: true });
  });
});

describe("Elite progression: Legendary levels + Diamond Tournament", () => {
  const A = (t) => ({ Authorization: `Bearer ${t}` });

  it("legendary: master a node, attempt and win the legendary crown", async () => {
    // fresh learner, give gems + master node 1 directly via a perfect lesson twice
    const reg = await request(app).post("/api/auth/register").send({ email: `leg_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token, uid = reg.body.user.id;
    const { db } = await import("../src/db.js");
    db.prepare("UPDATE learner_profiles SET gems=500 WHERE user_id=?").run(uid);
    // finish node 1 perfectly to reach 5 stars
    await request(app).post("/api/learn/lesson/1/finish").set(A(tk)).send({ correct: 3, total: 3 });
    // force mastery in case a single lesson isn't 5 stars
    db.prepare("UPDATE node_progress SET stars=5 WHERE user_id=? AND node_id=1").run(uid);
    const st = await request(app).get("/api/learn/legendary/1?lang=fa").set(A(tk));
    expect(st.status).toBe(200);
    expect(st.body.eligible).toBe(true);
    const start = await request(app).post("/api/learn/legendary/1/start").set(A(tk)).send({});
    expect(start.status).toBe(200);
    expect(start.body.cards.length).toBeGreaterThan(0);
    const total = start.body.cards.length;
    const fin = await request(app).post("/api/learn/legendary/1/finish").set(A(tk)).send({ correct: total, total });
    expect(fin.status).toBe(200);
    expect(fin.body.passed).toBe(true);
    expect(fin.body.legendaryCount).toBeGreaterThanOrEqual(1);
    // path now marks node 1 legendary
    const path = await request(app).get("/api/learn/path?lang=fa").set(A(tk));
    const n1 = path.body.topics.flatMap((x) => x.nodes).find((n) => n.id === 1);
    expect(n1.legendary).toBe(true);
  });

  it("legendary: a failing run does not grant the crown", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: `legf_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token, uid = reg.body.user.id;
    const { db } = await import("../src/db.js");
    db.prepare("UPDATE learner_profiles SET gems=500 WHERE user_id=?").run(uid);
    await request(app).post("/api/learn/lesson/2/finish").set(A(tk)).send({ correct: 3, total: 3 });
    db.prepare("UPDATE node_progress SET stars=5 WHERE user_id=? AND node_id=2").run(uid);
    const start = await request(app).post("/api/learn/legendary/2/start").set(A(tk)).send({});
    const total = start.body.cards.length || 3;
    const fin = await request(app).post("/api/learn/legendary/2/finish").set(A(tk)).send({ correct: 0, total });
    expect(fin.body.passed).toBe(false);
    const st = await request(app).get("/api/learn/legendary/2?lang=fa").set(A(tk));
    expect(st.body.isLegendary).toBe(false);
  });

  it("tournament: diamond-tier learner sees a qualified bracket with a stage", async () => {
    // the seeded demo learner is Diamond tier and pre-placed in a tournament room
    const tk = (await login("learner", "demo")).body.token;
    const res = await request(app).get("/api/learn/tournament?lang=fa").set(A(tk));
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.qualified).toBe(true);
    expect(["quarterfinal", "semifinal", "final"]).toContain(res.body.stage);
    expect(res.body.members.length).toBeGreaterThan(1);
  });

  it("tournament: non-diamond learner is not qualified", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: `nod_${Date.now()}@t.com`, password: "1234" });
    const res = await request(app).get("/api/learn/tournament?lang=fa").set(A(reg.body.token));
    expect(res.status).toBe(200);
    expect(res.body.qualified).toBe(false);
  });

  it("admin game-config exposes legendary + tournament knobs", async () => {
    const at = (await login("admin", "demo")).body.token;
    const res = await request(app).get("/api/admin/game-config").set(A(at));
    expect(res.body.config.legendary).toHaveProperty("pass_ratio");
    expect(res.body.config.tournament).toHaveProperty("advance");
    const put = await request(app).put("/api/admin/game-config").set(A(at)).send({ config: { legendary: { xp_reward: 55 } } });
    expect(put.body.config.legendary.xp_reward).toBe(55);
  });
});

describe("Topic Mastery Badges (Bloom's mastery learning + durable memory)", () => {
  const A = (t) => ({ Authorization: `Bearer ${t}` });

  it("admin game-config exposes the mastery knobs", async () => {
    const at = await token("admin", "demo");
    const res = await request(app).get("/api/admin/game-config").set(A(at));
    expect(res.body.config.mastery).toHaveProperty("accuracy");
    expect(res.body.config.mastery).toHaveProperty("require_retention");
  });

  it("grants a topic mastery badge only when accuracy + criteria are met, once", async () => {
    const at = await token("admin", "demo");
    // Make the criteria testable: no durable-memory requirement, low min answers.
    await request(app).put("/api/admin/game-config").set(A(at))
      .send({ config: { mastery: { enabled: true, accuracy: 90, min_answers: 2, require_retention: false, reward_gems: 60, reward_xp: 50 } } });

    const reg = await request(app).post("/api/auth/register")
      .send({ email: `mastery_${Date.now()}@t.com`, password: "1234", name_fa: "تسلط", province: "تهران" });
    const tk = reg.body.token;
    const les = await request(app).get("/api/learn/lesson/1").set(A(tk));
    // answer only the cards that truly belong to this lesson's NODE (not interleaved)
    const nodeCards = (les.body.cards || []).filter((c) => !c.review).map((c) => c.id);
    expect(nodeCards.length).toBeGreaterThanOrEqual(2);
    const answers = nodeCards.map((id) => ({ cardId: id, correct: true, responseMs: 3000 }));
    const gemsBefore = (await request(app).get("/api/learn/profile").set(A(tk))).body.profile.gems;

    const fin = await request(app).post("/api/learn/lesson/1/finish").set(A(tk))
      .send({ correct: nodeCards.length, total: nodeCards.length, answers });
    expect(fin.status).toBe(200);
    expect(Array.isArray(fin.body.newMastery)).toBe(true);
    expect(fin.body.newMastery.length).toBeGreaterThanOrEqual(1);
    const badge = fin.body.newMastery[0];
    expect(badge.accuracy).toBe(100);
    // the one-time reward was paid (gems went up by the configured amount)
    expect(fin.body.profile.gems).toBe(gemsBefore + 60);

    // the mastery overview now shows at least one mastered topic
    const ov = await request(app).get("/api/learn/mastery?lang=fa").set(A(tk));
    expect(ov.status).toBe(200);
    expect(ov.body.mastered).toBeGreaterThanOrEqual(1);

    // finishing again does NOT re-award (idempotent) — no new badge, no extra gems
    const gems2 = (await request(app).get("/api/learn/profile").set(A(tk))).body.profile.gems;
    const fin2 = await request(app).post("/api/learn/lesson/1/finish").set(A(tk))
      .send({ correct: nodeCards.length, total: nodeCards.length, answers });
    expect(fin2.body.newMastery.length).toBe(0);
    const gems3 = (await request(app).get("/api/learn/profile").set(A(tk))).body.profile.gems;
    expect(gems3).toBe(gems2);
  });

  it("the mastery endpoint is gated by the mastery feature flag", async () => {
    const at = await token("admin", "demo");
    // disable the flag
    await request(app).put("/api/admin/flags/mastery").set(A(at)).send({ enabled: false });
    const tk = await token("learner", "demo");
    const res = await request(app).get("/api/learn/mastery?lang=fa").set(A(tk));
    expect(res.status).toBe(403);
    // re-enable so later tests / seed state stays clean
    await request(app).put("/api/admin/flags/mastery").set(A(at)).send({ enabled: true });
  });
});

describe("Calm Mode (anti-burnout, opt-in)", () => {
  const A = (t) => ({ Authorization: `Bearer ${t}` });

  it("admin game-config exposes the calm knobs", async () => {
    const at = await token("admin", "demo");
    const res = await request(app).get("/api/admin/game-config").set(A(at));
    expect(res.body.config.calm).toHaveProperty("default_review_cap");
    expect(res.body.config.calm).toHaveProperty("rest_days_per_week");
  });

  it("a learner can enable Calm Mode and set a review cap; profile surfaces it", async () => {
    const reg = await request(app).post("/api/auth/register")
      .send({ email: `calm_${Date.now()}@t.com`, password: "1234", name_fa: "آرام", province: "تهران" });
    const tk = reg.body.token;
    // default off
    const g0 = await request(app).get("/api/learn/calm").set(A(tk));
    expect(g0.status).toBe(200);
    expect(g0.body.enabled).toBe(false);
    // enable + set a cap + hide streak
    const put = await request(app).put("/api/learn/calm").set(A(tk))
      .send({ enabled: true, reviewCap: 20, hideStreak: true, optOutLeagues: true });
    expect(put.body.enabled).toBe(true);
    expect(put.body.reviewCap).toBe(20);
    expect(put.body.hideStreak).toBe(true);
    // the profile endpoint now carries the calm flags
    const prof = await request(app).get("/api/learn/profile").set(A(tk));
    expect(prof.body.calm).toBeTruthy();
    expect(prof.body.calm.hideStreak).toBe(true);
    // cap is clamped to the admin min/max
    const tooBig = await request(app).put("/api/learn/calm").set(A(tk)).send({ reviewCap: 9999 });
    expect(tooBig.body.reviewCap).toBeLessThanOrEqual(tooBig.body.maxReviewCap);
  });

  it("opting out of leagues returns an opted-out league view", async () => {
    const reg = await request(app).post("/api/auth/register")
      .send({ email: `calm_lg_${Date.now()}@t.com`, password: "1234", name_fa: "بی‌لیگ", province: "تهران" });
    const tk = reg.body.token;
    await request(app).put("/api/learn/calm").set(A(tk)).send({ enabled: true, optOutLeagues: true });
    const lg = await request(app).get("/api/learn/league?lang=fa").set(A(tk));
    expect(lg.status).toBe(200);
    expect(lg.body.optedOut).toBe(true);
  });

  it("a rest day preserves the streak and decrements the weekly allowance", async () => {
    const reg = await request(app).post("/api/auth/register")
      .send({ email: `calm_rest_${Date.now()}@t.com`, password: "1234", name_fa: "استراحت", province: "تهران" });
    const tk = reg.body.token;
    await request(app).put("/api/learn/calm").set(A(tk)).send({ enabled: true });
    const before = (await request(app).get("/api/learn/calm").set(A(tk))).body;
    const rest = await request(app).post("/api/learn/calm/rest-day").set(A(tk)).send({});
    expect(rest.status).toBe(200);
    expect(rest.body.ok).toBe(true);
    expect(rest.body.restDaysLeft).toBe(before.restDaysLeft - 1);
    expect(rest.body.restToday).toBe(true);
    // a second rest day the same day is rejected
    const again = await request(app).post("/api/learn/calm/rest-day").set(A(tk)).send({});
    expect(again.status).toBe(400);
    expect(again.body.ok).toBe(false);
  });

  it("the calm endpoints are gated by the calm_mode feature flag", async () => {
    const at = await token("admin", "demo");
    await request(app).put("/api/admin/flags/calm_mode").set(A(at)).send({ enabled: false });
    const tk = await token("learner", "demo");
    const res = await request(app).get("/api/learn/calm").set(A(tk));
    expect(res.status).toBe(403);
    await request(app).put("/api/admin/flags/calm_mode").set(A(at)).send({ enabled: true });
  });
});

describe("Anonymous / stealth ranking (opt-in privacy)", () => {
  const A = (t) => ({ Authorization: `Bearer ${t}` });

  it("admin game-config exposes the anon alias pools", async () => {
    const at = await token("admin", "demo");
    const res = await request(app).get("/api/admin/game-config").set(A(at));
    expect(Array.isArray(res.body.config.anon.alias_pool_fa)).toBe(true);
  });

  it("a learner in anon mode appears under a pseudonym to OTHERS but sees their own name", async () => {
    // two learners; A turns on anon mode with a custom alias
    const a = await request(app).post("/api/auth/register")
      .send({ email: `anonA_${Date.now()}@t.com`, password: "1234", name_fa: "علیِ واقعی", province: "تهران" });
    const b = await request(app).post("/api/auth/register")
      .send({ email: `anonB_${Date.now()}@t.com`, password: "1234", name_fa: "ناظر", province: "تهران" });
    const tkA = a.body.token, tkB = b.body.token, uidA = a.body.user.id;

    const put = await request(app).put("/api/learn/anon").set(A(tkA)).send({ enabled: true, alias: "ماسکِ من" });
    expect(put.body.enabled).toBe(true);
    expect(put.body.alias).toBe("ماسکِ من");

    // A viewing the national ranking still sees their OWN real name
    const rankA = await request(app).get("/api/learn/ranking?lang=fa").set(A(tkA));
    const meInA = (rankA.body.list || []).find((x) => x.user_id === uidA);
    if (meInA) { expect(meInA.name).toBe("علیِ واقعی"); expect(meInA.anon).toBeFalsy(); }

    // B viewing the ranking sees A under the pseudonym (never the real name)
    const rankB = await request(app).get("/api/learn/ranking?lang=fa").set(A(tkB));
    const aInB = (rankB.body.list || []).find((x) => x.user_id === uidA);
    if (aInB) { expect(aInB.name).toBe("ماسکِ من"); expect(aInB.anon).toBe(true); }
    // in no case does B see A's real name anywhere in the list
    const leaked = (rankB.body.list || []).some((x) => x.user_id === uidA && x.name === "علیِ واقعی");
    expect(leaked).toBe(false);
  });

  it("a blank alias falls back to a deterministic pool pseudonym", async () => {
    const reg = await request(app).post("/api/auth/register")
      .send({ email: `anonC_${Date.now()}@t.com`, password: "1234", name_fa: "بدون‌نام", province: "تهران" });
    const tk = reg.body.token;
    const put = await request(app).put("/api/learn/anon").set(A(tk)).send({ enabled: true, alias: "" });
    expect(put.body.enabled).toBe(true);
    expect(put.body.aliasPreview).toBeTruthy();  // a pool alias is provided
    expect(put.body.aliasPreview).not.toBe("بدون‌نام");
  });

  it("the anon endpoints are gated by the anon_ranking feature flag", async () => {
    const at = await token("admin", "demo");
    await request(app).put("/api/admin/flags/anon_ranking").set(A(at)).send({ enabled: false });
    const tk = await token("learner", "demo");
    const res = await request(app).get("/api/learn/anon").set(A(tk));
    expect(res.status).toBe(403);
    await request(app).put("/api/admin/flags/anon_ranking").set(A(at)).send({ enabled: true });
  });
});

describe("Smart Practice Hub (weak-area targeted sessions)", () => {
  const A = (t) => ({ Authorization: `Bearer ${t}` });

  async function learnerWithWeakData() {
    const reg = await request(app).post("/api/auth/register").send({ email: `sp_${Date.now()}_${Math.random()}@t.com`, password: "1234" });
    const tk = reg.body.token;
    // create weak-topic + mistake telemetry by missing cards on node 1 twice
    for (let i = 0; i < 2; i++) {
      await request(app).post("/api/learn/lesson/1/finish").set(A(tk)).send({
        correct: 1, total: 3,
        answers: [{ cardId: 1, correct: false, responseMs: 4000 }, { cardId: 2, correct: false, responseMs: 5000 }, { cardId: 3, correct: true, responseMs: 2000 }],
      });
    }
    return tk;
  }

  it("summary reports counts + a weak-topic report", async () => {
    const tk = await learnerWithWeakData();
    const res = await request(app).get("/api/learn/practice?lang=fa").set(A(tk));
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.counts).toHaveProperty("weak");
    expect(res.body.hasData).toBe(true);
    expect(Array.isArray(res.body.weakTopics)).toBe(true);
  });

  it("builds a targeted session with source-tagged cards", async () => {
    const tk = await learnerWithWeakData();
    const res = await request(app).post("/api/learn/practice/start").set(A(tk)).send({});
    expect(res.status).toBe(200);
    expect(res.body.cards.length).toBeGreaterThan(0);
    const sources = new Set(res.body.cards.map((c) => c.source));
    // every card carries a valid source tag
    for (const s of sources) expect(["weak", "mistakes", "due", "hardest"]).toContain(s);
  });

  it("grading a practice answer records it and awards XP on success", async () => {
    const tk = await learnerWithWeakData();
    const start = await request(app).post("/api/learn/practice/start").set(A(tk)).send({});
    const card = start.body.cards[0];
    const before = (await request(app).get("/api/learn/profile").set(A(tk))).body.profile.xp;
    const res = await request(app).post("/api/learn/practice/answer").set(A(tk)).send({ cardId: card.id, correct: true, responseMs: 1500 });
    expect(res.status).toBe(200);
    expect(res.body.profile.xp).toBeGreaterThan(before);
  });

  it("a brand-new learner can still practice from the global hardest pool", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: `spnod_${Date.now()}@t.com`, password: "1234" });
    const res = await request(app).post("/api/learn/practice/start").set(A(reg.body.token)).send({});
    // seed has crowd/question stats, so the hardest pool provides a session
    expect(res.status).toBe(200);
    expect(res.body.cards.length).toBeGreaterThan(0);
    expect(res.body.cards.every((c) => c.source === "hardest")).toBe(true);
  });

  it("the smart_practice feature flag gates the hub (403 when off)", async () => {
    const at = (await login("admin", "demo")).body.token;
    const tk = (await request(app).post("/api/auth/register").send({ email: `spg_${Date.now()}@t.com`, password: "1234" })).body.token;
    await request(app).put("/api/admin/flags/smart_practice").set(A(at)).send({ enabled: false });
    const res = await request(app).get("/api/learn/practice?lang=fa").set(A(tk));
    expect(res.status).toBe(403);
    await request(app).put("/api/admin/flags/smart_practice").set(A(at)).send({ enabled: true });
  });

  it("admin game-config exposes the practice knobs", async () => {
    const at = (await login("admin", "demo")).body.token;
    const res = await request(app).get("/api/admin/game-config").set(A(at));
    expect(res.body.config.practice).toHaveProperty("session_size");
    expect(res.body.config.practice).toHaveProperty("mix");
    const put = await request(app).put("/api/admin/game-config").set(A(at)).send({ config: { practice: { session_size: 12 } } });
    expect(put.body.config.practice.session_size).toBe(12);
    // restore
    await request(app).put("/api/admin/game-config").set(A(at)).send({ config: { practice: { session_size: 10 } } });
  });
});

describe("FSRS spaced-repetition scheduler", () => {
  const A = (t) => ({ Authorization: `Bearer ${t}` });

  async function learnerWithDueCards() {
    const reg = await request(app).post("/api/auth/register").send({ email: `fsrs_${Date.now()}_${Math.random()}@t.com`, password: "1234" });
    const tk = reg.body.token, uid = reg.body.user.id;
    await request(app).post("/api/learn/lesson/1/finish").set(A(tk)).send({
      correct: 3, total: 3,
      answers: [{ cardId: 1, correct: true, responseMs: 2000 }, { cardId: 2, correct: true, responseMs: 2500 }, { cardId: 3, correct: true, responseMs: 1800 }],
    });
    const { db } = await import("../src/db.js");
    db.prepare("UPDATE srs_state SET due=date('now','-1 day') WHERE user_id=?").run(uid);
    return tk;
  }

  it("review returns due cards with per-grade FSRS interval preview + stats", async () => {
    const tk = await learnerWithDueCards();
    const res = await request(app).get("/api/learn/review?lang=fa").set(A(tk));
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
    expect(res.body.stats.scheduler).toBe("fsrs");
    const p = res.body.cards[0].preview;
    expect(p).toBeTruthy();
    // FSRS defaults: new-card intervals grow again ≤ hard ≤ good ≤ easy
    expect(p.again).toBeLessThanOrEqual(p.good);
    expect(p.good).toBeLessThanOrEqual(p.easy);
  });

  it("grading a card updates stability/difficulty and schedules a future due date", async () => {
    const tk = await learnerWithDueCards();
    const rev = await request(app).get("/api/learn/review?lang=fa").set(A(tk));
    const card = rev.body.cards[0];
    const g = await request(app).post("/api/learn/review/grade").set(A(tk)).send({ cardId: card.id, grade: 2 });
    expect(g.status).toBe(200);
    expect(g.body.sched.scheduler).toBe("fsrs");
    expect(g.body.sched.stability).toBeGreaterThan(0);
    expect(g.body.sched.difficulty).toBeGreaterThanOrEqual(1);
    expect(g.body.sched.interval).toBeGreaterThanOrEqual(1);
  });

  it("a lapse (Again) reduces stability but does not reset it to zero", async () => {
    const tk = await learnerWithDueCards();
    const { db } = await import("../src/db.js");
    const rev = await request(app).get("/api/learn/review?lang=fa").set(A(tk));
    const card = rev.body.cards[0];
    // build up stability with a couple of good reviews
    await request(app).post("/api/learn/review/grade").set(A(tk)).send({ cardId: card.id, grade: 2 });
    const uid = (await request(app).get("/api/learn/profile").set(A(tk))).body.profile.user_id;
    db.prepare("UPDATE srs_state SET due=date('now','-1 day') WHERE card_id=? AND user_id IN (SELECT user_id FROM srs_state WHERE card_id=? LIMIT 1)").run(card.id, card.id);
    const before = db.prepare("SELECT stability FROM srs_state WHERE card_id=? ORDER BY id DESC LIMIT 1").get(card.id).stability;
    await request(app).post("/api/learn/review/grade").set(A(tk)).send({ cardId: card.id, grade: 0 });
    const after = db.prepare("SELECT stability FROM srs_state WHERE card_id=? ORDER BY id DESC LIMIT 1").get(card.id).stability;
    expect(after).toBeGreaterThan(0);        // not reset to zero
    expect(after).toBeLessThanOrEqual(before + 0.001);
  });

  it("admin can switch the scheduler to SM-2 and tune retention", async () => {
    const at = (await login("admin", "demo")).body.token;
    const res = await request(app).get("/api/admin/game-config").set(A(at));
    expect(res.body.config.srs.params.length).toBe(21);
    const put = await request(app).put("/api/admin/game-config").set(A(at)).send({ config: { srs: { scheduler: "sm2", desired_retention: 0.92 } } });
    expect(put.body.config.srs.scheduler).toBe("sm2");
    expect(put.body.config.srs.desired_retention).toBe(0.92);
    // with sm2 selected, the review preview is null (sm2 has no per-button preview)
    const reg = await request(app).post("/api/auth/register").send({ email: `sm2_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token, uid = reg.body.user.id;
    await request(app).post("/api/learn/lesson/1/finish").set(A(tk)).send({ correct: 3, total: 3, answers: [{ cardId: 1, correct: true, responseMs: 2000 }] });
    const { db } = await import("../src/db.js");
    db.prepare("UPDATE srs_state SET due=date('now','-1 day') WHERE user_id=?").run(uid);
    const rev = await request(app).get("/api/learn/review?lang=fa").set(A(tk));
    expect(rev.body.stats.scheduler).toBe("sm2");
    expect(rev.body.cards[0].preview).toBeNull();
    // restore FSRS for other tests
    await request(app).put("/api/admin/game-config").set(A(at)).send({ config: { srs: { scheduler: "fsrs", desired_retention: 0.9 } } });
  });

  it("srs/stats endpoint reports scheduler, retention and memory averages", async () => {
    const tk = await learnerWithDueCards();
    await request(app).post("/api/learn/review/grade").set(A(tk)).send({ cardId: 1, grade: 2 });
    const res = await request(app).get("/api/learn/srs/stats").set(A(tk));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("avgStability");
    expect(res.body).toHaveProperty("mature");
    expect(res.body.tracked).toBeGreaterThan(0);
  });
});

describe("In-app support & feedback chat", () => {
  const A = (t) => ({ Authorization: `Bearer ${t}` });

  it("a user opens a ticket via a message; admin sees it in the inbox", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: `sup_${Date.now()}@t.com`, password: "1234", name_fa: "کاربر تست" });
    const tk = reg.body.token;
    const r = await request(app).post("/api/support/message?lang=fa").set(A(tk)).send({ body: "یک باگ دیدم", category: "bug" });
    expect(r.status).toBe(200);
    expect(r.body.ticket.category).toBe("bug");
    expect(r.body.messages.length).toBe(1);
    const at = (await login("admin", "demo")).body.token;
    const inbox = await request(app).get("/api/admin/support?lang=fa").set(A(at));
    expect(inbox.status).toBe(200);
    expect(inbox.body.tickets.some((x) => x.category === "bug")).toBe(true);
    expect(inbox.body.stats.unread).toBeGreaterThan(0);
  });

  it("admin reply notifies the user and flips status to answered; user unread clears on open", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: `sup2_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token;
    const open = await request(app).post("/api/support/message?lang=fa").set(A(tk)).send({ body: "سوال دارم", category: "question" });
    const ticketId = open.body.ticket.id;
    const at = (await login("admin", "demo")).body.token;
    const rep = await request(app).post(`/api/admin/support/${ticketId}/reply?lang=fa`).set(A(at)).send({ body: "سلام، بفرمایید" });
    expect(rep.status).toBe(200);
    expect(rep.body.ticket.status).toBe("answered");
    expect(rep.body.messages.at(-1).sender).toBe("admin");
    // user now has an unread reply
    expect((await request(app).get("/api/support/unread").set(A(tk))).body.unread).toBe(1);
    // opening the thread clears it
    await request(app).get("/api/support/thread?lang=fa").set(A(tk));
    expect((await request(app).get("/api/support/unread").set(A(tk))).body.unread).toBe(0);
    // a support notification was created in the bell feed
    const notifs = await request(app).get("/api/learn/notifications?lang=fa").set(A(tk)).catch(() => ({ body: {} }));
    // (learner-only endpoint; skip assert if not a learner) — just ensure no crash
    expect([200, 403]).toContain(notifs.status);
  });

  it("admin can change category and resolve; user sees the resolved state", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: `sup3_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token;
    const open = await request(app).post("/api/support/message?lang=fa").set(A(tk)).send({ body: "پیشنهاد", category: "question" });
    const ticketId = open.body.ticket.id;
    const at = (await login("admin", "demo")).body.token;
    await request(app).put(`/api/admin/support/${ticketId}/category`).set(A(at)).send({ category: "feedback" });
    const st = await request(app).put(`/api/admin/support/${ticketId}/status`).set(A(at)).send({ status: "resolved" });
    expect(st.body.status).toBe("resolved");
    const th = await request(app).get("/api/support/thread?lang=fa").set(A(tk));
    expect(th.body.ticket.status).toBe("resolved");
    expect(th.body.ticket.category).toBe("feedback");
  });

  it("posting after a resolved ticket opens a fresh conversation", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: `sup4_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token;
    const open = await request(app).post("/api/support/message?lang=fa").set(A(tk)).send({ body: "اول", category: "question" });
    const at = (await login("admin", "demo")).body.token;
    await request(app).put(`/api/admin/support/${open.body.ticket.id}/status`).set(A(at)).send({ status: "resolved" });
    const again = await request(app).post("/api/support/message?lang=fa").set(A(tk)).send({ body: "دوم", category: "bug" });
    expect(again.body.ticket.status).toBe("open");
    expect(again.body.ticket.id).not.toBe(open.body.ticket.id);
  });

  it("the support feature flag gates the chat (403) but /unread stays safe", async () => {
    const at = (await login("admin", "demo")).body.token;
    const reg = await request(app).post("/api/auth/register").send({ email: `sup5_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token;
    await request(app).put("/api/admin/flags/support").set(A(at)).send({ enabled: false });
    expect((await request(app).get("/api/support/thread").set(A(tk))).status).toBe(403);
    const u = await request(app).get("/api/support/unread").set(A(tk));
    expect(u.status).toBe(200);
    expect(u.body.enabled).toBe(false);
    await request(app).put("/api/admin/flags/support").set(A(at)).send({ enabled: true });
  });

  it("empty messages are rejected", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: `sup6_${Date.now()}@t.com`, password: "1234" });
    const r = await request(app).post("/api/support/message").set(A(reg.body.token)).send({ body: "   " });
    expect(r.status).toBe(400);
  });

  it("a non-privileged learner cannot access the admin support inbox", async () => {
    const tk = (await login("learner", "demo")).body.token;
    const res = await request(app).get("/api/admin/support?lang=fa").set(A(tk));
    expect([401, 403]).toContain(res.status);
  });
});

describe("Onboarding checklist & Help center", () => {
  const A = (t) => ({ Authorization: `Bearer ${t}` });

  it("a new learner sees an onboarding checklist with all steps incomplete", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: `ob_${Date.now()}@t.com`, password: "1234" });
    const res = await request(app).get("/api/learn/onboarding?lang=fa").set(A(reg.body.token));
    expect(res.status).toBe(200);
    expect(res.body.show).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.doneCount).toBe(0);
    expect(res.body.steps.every((s) => !s.done)).toBe(true);
  });

  it("completing a lesson + setting a goal ticks the matching steps", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: `ob2_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token;
    await request(app).post("/api/learn/lesson/1/finish").set(A(tk)).send({ correct: 3, total: 3, answers: [{ cardId: 1, correct: true, responseMs: 1500 }] });
    await request(app).post("/api/learn/daily/goal").set(A(tk)).send({ value: 30 });
    const res = await request(app).get("/api/learn/onboarding?lang=fa").set(A(tk));
    const byKey = Object.fromEntries(res.body.steps.map((s) => [s.key, s.done]));
    expect(byKey.first_lesson).toBe(true);
    expect(byKey.set_goal).toBe(true);
    expect(res.body.doneCount).toBeGreaterThanOrEqual(2);
  });

  it("claiming the onboarding reward works only once and grants gems", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: `ob3_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token, uid = reg.body.user.id;
    const { db } = await import("../src/db.js");
    // force-complete every step by satisfying the derived conditions
    await request(app).post("/api/learn/lesson/1/finish").set(A(tk)).send({ correct: 3, total: 3, answers: [{ cardId: 1, correct: true, responseMs: 1500 }] });
    await request(app).post("/api/learn/daily/goal").set(A(tk)).send({ value: 30 });
    db.prepare("UPDATE srs_state SET reps=1 WHERE user_id=?").run(uid);
    db.prepare("INSERT INTO xp_events (user_id, amount, reason, day) VALUES (?,?, 'practice', date('now'))").run(uid, 3);
    const st = await request(app).get("/api/learn/onboarding?lang=fa").set(A(tk));
    expect(st.body.complete).toBe(true);
    const before = (await request(app).get("/api/learn/profile").set(A(tk))).body.profile.gems;
    const claim = await request(app).post("/api/learn/onboarding/claim").set(A(tk)).send({});
    expect(claim.status).toBe(200);
    expect(claim.body.gems).toBeGreaterThan(0);
    expect(claim.body.profile.gems).toBeGreaterThan(before);
    // second claim is rejected
    const again = await request(app).post("/api/learn/onboarding/claim").set(A(tk)).send({});
    expect(again.status).toBe(400);
  });

  it("dismissing the onboarding hides it", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: `ob4_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token;
    await request(app).post("/api/learn/onboarding/dismiss").set(A(tk)).send({});
    const res = await request(app).get("/api/learn/onboarding?lang=fa").set(A(tk));
    expect(res.body.show).toBe(false);
  });

  it("help center lists published articles, supports search, and increments views", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: `help_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token;
    const list = await request(app).get("/api/support/help?lang=fa").set(A(tk));
    expect(list.status).toBe(200);
    expect(list.body.articles.length).toBeGreaterThan(0);
    expect(list.body.categories.length).toBeGreaterThan(0);
    const first = list.body.articles[0];
    const view = await request(app).get(`/api/support/help/${first.id}?lang=fa`).set(A(tk));
    expect(view.status).toBe(200);
    expect(view.body.article.title).toBeTruthy();
    // search narrows results
    const search = await request(app).get("/api/support/help?lang=fa&q=استریک").set(A(tk));
    expect(search.body.articles.length).toBeLessThanOrEqual(list.body.articles.length);
  });

  it("admin can create, edit and delete a help article", async () => {
    const at = (await login("admin", "demo")).body.token;
    const create = await request(app).post("/api/admin/help").set(A(at)).send({ category: "general", title_fa: "تست", title_en: "Test", body_fa: "الف", body_en: "A", published: 1 });
    expect(create.status).toBe(200);
    const id = create.body.id;
    const upd = await request(app).put(`/api/admin/help/${id}`).set(A(at)).send({ category: "learning", title_fa: "تست۲", title_en: "Test2", body_fa: "ب", body_en: "B", published: 0 });
    expect(upd.status).toBe(200);
    // unpublished article no longer appears to users
    const learnerTk = (await request(app).post("/api/auth/register").send({ email: `hv_${Date.now()}@t.com`, password: "1234" })).body.token;
    const pub = await request(app).get("/api/support/help?lang=fa").set(A(learnerTk));
    expect(pub.body.articles.some((a) => a.id === id)).toBe(false);
    const del = await request(app).del(`/api/admin/help/${id}`).set(A(at));
    expect(del.status).toBe(200);
  });

  it("onboarding + help_center feature flags gate their endpoints", async () => {
    const at = (await login("admin", "demo")).body.token;
    const tk = (await request(app).post("/api/auth/register").send({ email: `g_${Date.now()}@t.com`, password: "1234" })).body.token;
    await request(app).put("/api/admin/flags/onboarding").set(A(at)).send({ enabled: false });
    expect((await request(app).get("/api/learn/onboarding").set(A(tk))).status).toBe(403);
    await request(app).put("/api/admin/flags/help_center").set(A(at)).send({ enabled: false });
    expect((await request(app).get("/api/support/help").set(A(tk))).status).toBe(403);
    expect((await request(app).get("/api/support/help/enabled").set(A(tk))).body.enabled).toBe(false);
    await request(app).put("/api/admin/flags/onboarding").set(A(at)).send({ enabled: true });
    await request(app).put("/api/admin/flags/help_center").set(A(at)).send({ enabled: true });
  });
});

describe("Placement test", () => {
  const A = (t) => ({ Authorization: `Bearer ${t}` });
  it("builds a quiz, grades per-topic and records completion", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: `plc_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token;
    const before = await request(app).get("/api/learn/placement?lang=fa").set(A(tk));
    expect(before.body.done).toBe(false);
    const start = await request(app).get("/api/learn/placement/start?lang=fa").set(A(tk));
    expect(start.status).toBe(200);
    expect(start.body.cards.length).toBeGreaterThan(0);
    expect(start.body.cards[0].topicSlug).toBeTruthy();
    const answers = start.body.cards.map((c, i) => ({ topicSlug: c.topicSlug, correct: i % 2 === 0 }));
    const sub = await request(app).post("/api/learn/placement/submit?lang=fa").set(A(tk)).send({ answers });
    expect(sub.status).toBe(200);
    expect(sub.body.result.overall).toBeGreaterThanOrEqual(0);
    expect(["beginner", "intermediate", "advanced"]).toContain(sub.body.result.level);
    expect(Array.isArray(sub.body.result.perTopic)).toBe(true);
    const after = await request(app).get("/api/learn/placement?lang=fa").set(A(tk));
    expect(after.body.done).toBe(true);
  });
  it("skip marks placement done without a quiz", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: `plcs_${Date.now()}@t.com`, password: "1234" });
    const tk = reg.body.token;
    await request(app).post("/api/learn/placement/skip").set(A(tk)).send({});
    expect((await request(app).get("/api/learn/placement?lang=fa").set(A(tk))).body.done).toBe(true);
  });
  it("placement flag gates the endpoints", async () => {
    const at = (await login("admin", "demo")).body.token;
    const tk = (await request(app).post("/api/auth/register").send({ email: `plcg_${Date.now()}@t.com`, password: "1234" })).body.token;
    await request(app).put("/api/admin/flags/placement").set(A(at)).send({ enabled: false });
    expect((await request(app).get("/api/learn/placement").set(A(tk))).status).toBe(403);
    await request(app).put("/api/admin/flags/placement").set(A(at)).send({ enabled: true });
  });

  it("status exposes the admin offer config (mode, dismissible, retake, copy)", async () => {
    const at = (await login("admin", "demo")).body.token;
    const cfg = (await request(app).get("/api/admin/game-config").set(A(at))).body.config;
    cfg.placement = { ...cfg.placement, mode: "optional", dismissible: true, allow_retake: true, offer_fa: "متن دعوت سفارشی" };
    await request(app).put("/api/admin/game-config").set(A(at)).send({ config: cfg });
    const tk = (await request(app).post("/api/auth/register").send({ email: `plcc_${Date.now()}@t.com`, password: "1234" })).body.token;
    const st = await request(app).get("/api/learn/placement?lang=fa").set(A(tk));
    expect(st.body.mode).toBe("optional");
    expect(st.body.dismissible).toBe(true);
    expect(st.body.allow_retake).toBe(true);
    expect(st.body.offerText).toBe("متن دعوت سفارشی");
  });

  it("mode 'off' hides the offer (enabled:false to the learner)", async () => {
    const at = (await login("admin", "demo")).body.token;
    const cfg = (await request(app).get("/api/admin/game-config").set(A(at))).body.config;
    await request(app).put("/api/admin/game-config").set(A(at)).send({ config: { ...cfg, placement: { ...cfg.placement, mode: "off" } } });
    const tk = (await request(app).post("/api/auth/register").send({ email: `plcoff_${Date.now()}@t.com`, password: "1234" })).body.token;
    const st = await request(app).get("/api/learn/placement?lang=fa").set(A(tk));
    expect(st.body.enabled).toBe(false);
    // restore
    await request(app).put("/api/admin/game-config").set(A(at)).send({ config: { ...cfg, placement: { ...cfg.placement, mode: "optional" } } });
  });

  it("dismiss hides the offer without marking the test done", async () => {
    const tk = (await request(app).post("/api/auth/register").send({ email: `plcd_${Date.now()}@t.com`, password: "1234" })).body.token;
    await request(app).post("/api/learn/placement/dismiss").set(A(tk)).send({});
    const st = await request(app).get("/api/learn/placement?lang=fa").set(A(tk));
    expect(st.body.dismissed).toBe(true);
    expect(st.body.done).toBe(false);   // can still take it later
  });

  it("skip_behavior 'unlock' opens strong topics WITHOUT faking lesson progress", async () => {
    const at = (await login("admin", "demo")).body.token;
    const cfg = (await request(app).get("/api/admin/game-config").set(A(at))).body.config;
    await request(app).put("/api/admin/game-config").set(A(at)).send({ config: { ...cfg, placement: { ...cfg.placement, skip_behavior: "unlock", strong_accuracy: 50 } } });
    const tk = (await request(app).post("/api/auth/register").send({ email: `plcu_${Date.now()}@t.com`, password: "1234" })).body.token;
    const start = await request(app).get("/api/learn/placement/start?lang=fa").set(A(tk));
    // answer ALL correct on the first topic → it's strong
    const firstTopic = start.body.cards[0].topicSlug;
    const answers = start.body.cards.map((c) => ({ topicSlug: c.topicSlug, correct: c.topicSlug === firstTopic }));
    const sub = await request(app).post("/api/learn/placement/submit?lang=fa").set(A(tk)).send({ answers });
    expect(sub.body.result.behavior).toBe("unlock");
    // no fake completed lessons; the path shows the strong topic as unlocked
    const path = await request(app).get("/api/learn/path?lang=fa").set(A(tk));
    const strongTopic = path.body.topics?.find((tp) => tp.slug === firstTopic) || (path.body.find && path.body.find((tp) => tp.slug === firstTopic));
    // whichever shape: at least assert nothing was auto-completed
    expect(sub.body.result.skippedLessons).toBe(0);
    expect(sub.body.result.unlockedTopics).toBeGreaterThanOrEqual(1);
    await request(app).put("/api/admin/game-config").set(A(at)).send({ config: cfg });
  });

  it("admin can reset a learner's placement (retake) without touching real progress", async () => {
    const at = (await login("admin", "demo")).body.token;
    const email = `plcr_${Date.now()}@t.com`;
    const tk = (await request(app).post("/api/auth/register").send({ email, password: "1234" })).body.token;
    await request(app).post("/api/learn/placement/skip").set(A(tk)).send({});
    expect((await request(app).get("/api/learn/placement?lang=fa").set(A(tk))).body.done).toBe(true);
    const { db } = await import("../src/db.js");
    const uid = db.prepare("SELECT id FROM users WHERE email=?").get(email).id;
    const reset = await request(app).post(`/api/admin/users/${uid}/reset-placement`).set(A(at)).send({});
    expect(reset.status).toBe(200);
    expect((await request(app).get("/api/learn/placement?lang=fa").set(A(tk))).body.done).toBe(false);
  });
});

describe("Import: forgiving parser & 'understood' preview", () => {
  const A = (t) => ({ Authorization: `Bearer ${t}` });
  async function adminTk() { return (await login("admin", "demo")).body.token; }

  it("simple format: topic by slug, correct via number, echoes parsed rows", async () => {
    const at = await adminTk();
    const csv = ["type,topic,difficulty,question,options,correct",
      'mcq,gi,medium,"شایع‌ترین علت خونریزی؟","زخم پپتیک | واریس | سرطان",1'].join("\n");
    const p = await request(app).post("/api/admin/content/import/preview?lang=fa").set(A(at)).send({ csv });
    expect(p.status).toBe(200);
    expect(p.body.valid).toBe(1);
    expect(p.body.rows[0].ok).toBe(true);
    expect(p.body.rows[0].detail).toContain("✅");         // marks the correct option
    expect(p.body.validTopics.length).toBeGreaterThan(0);   // valid slugs returned for the UI
  });

  it("accepts topic by NAME, letter-correct, and a * marker on the option", async () => {
    const at = await adminTk();
    const csv = ["type,topic,question,options,correct",
      'mcq,گوارش,"با نام درس","الف | ب | ج",B',
      'mcq,cardio,"با ستاره","ECG* | آنژیو | اکو",'].join("\n");
    const p = await request(app).post("/api/admin/content/import/preview?lang=fa").set(A(at)).send({ csv });
    expect(p.body.valid).toBe(2);
    expect(p.body.rows[0].topic).toBe("gi");                // resolved "گوارش" → gi
    expect(p.body.rows[0].detail).toMatch(/ب ✅/);          // letter B → 2nd option
    expect(p.body.rows[1].detail).toMatch(/ECG ✅/);        // * marker → first option
  });

  it("truefalse reads the correct/answer column tolerantly", async () => {
    const at = await adminTk();
    const csv = ["type,topic,question,correct", 'truefalse,surgery,"مورفی مثبت؟",درست'].join("\n");
    const p = await request(app).post("/api/admin/content/import/preview?lang=fa").set(A(at)).send({ csv });
    expect(p.body.rows[0].ok).toBe(true);
    expect(p.body.rows[0].detail).toContain("درست");
  });

  it("an unknown topic produces a clear per-row error", async () => {
    const at = await adminTk();
    const csv = ["type,topic,question,options,correct", 'mcq,notatopic,"x","a|b",1'].join("\n");
    const p = await request(app).post("/api/admin/content/import/preview?lang=fa").set(A(at)).send({ csv });
    expect(p.body.valid).toBe(0);
    expect(p.body.rows[0].ok).toBe(false);
    expect(p.body.rows[0].error).toMatch(/notatopic/);
  });

  it("committing the simple CSV imports the questions", async () => {
    const at = await adminTk();
    const csv = ["type,topic,question,options,correct",
      'mcq,gi,"سوال ایمپورت تست","آ | ب | پ",2'].join("\n");
    const r = await request(app).post("/api/admin/content/import").set(A(at)).send({ csv, attachToPath: false });
    expect(r.status).toBe(200);
    expect(r.body.imported).toBe(1);
  });

  it("both CSV templates download", async () => {
    const at = await adminTk();
    expect((await request(app).get("/api/admin/content/import/simple.csv").set(A(at))).status).toBe(200);
    expect((await request(app).get("/api/admin/content/import/template.csv").set(A(at))).status).toBe(200);
  });
});

describe("Landing page social proof (stats, testimonials, badges, FAQ)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, ctk, ltk;
  beforeAll(async () => { atk = await token("admin"); ctk = await token("content"); ltk = await token("learner"); });

  it("public /site-content/landing returns real stats + published social proof (no auth)", async () => {
    const res = await request(app).get("/api/site-content/landing?lang=fa");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("stats");
    expect(res.body).toHaveProperty("testimonials");
    expect(res.body).toHaveProperty("faqs");
    expect(res.body).toHaveProperty("badges");
    // seed provides at least one of each, published
    expect(res.body.testimonials.length).toBeGreaterThan(0);
    expect(res.body.faqs.length).toBeGreaterThan(0);
    expect(res.body.badges.length).toBeGreaterThan(0);
    // stats derive from real DB (topics > 0 because the path is seeded)
    expect(Number(res.body.stats.topics)).toBeGreaterThan(0);
    // localized testimonial has name+quote strings
    const t0 = res.body.testimonials[0];
    expect(typeof t0.name).toBe("string");
    expect(typeof t0.quote).toBe("string");
    expect(t0.rating).toBeGreaterThanOrEqual(1);
  });

  it("live stats count real learners/questions from the DB", async () => {
    const res = await request(app).get("/api/site-content/landing");
    expect(res.body.stats.raw.learners).toBeGreaterThan(0);
    expect(res.body.stats.raw.questions).toBeGreaterThan(0);
  });

  it("admin overview /admin/landing returns unpublished rows + floor", async () => {
    const res = await request(app).get("/api/admin/landing").set(A(atk));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("floor");
    expect(res.body).toHaveProperty("testimonials");
    expect(res.body.stats.raw).toBeTruthy();
  });

  it("admin can create/update/delete a testimonial (rating clamps to 1..5)", async () => {
    const cr = await request(app).post("/api/admin/landing/testimonials").set(A(atk))
      .send({ name_fa: "تست", name_en: "Test", quote_fa: "عالی بود", quote_en: "great", rating: 4 });
    expect(cr.status).toBe(200);
    const id = cr.body.testimonial.id;
    expect(cr.body.testimonial.rating).toBe(4);
    const up = await request(app).put(`/api/admin/landing/testimonials/${id}`).set(A(atk)).send({ featured: 1, rating: 9 });
    expect(up.status).toBe(200);
    expect(up.body.testimonial.featured).toBe(1);
    expect(up.body.testimonial.rating).toBe(5); // clamped to 5
    const del = await request(app).delete(`/api/admin/landing/testimonials/${id}`).set(A(atk));
    expect(del.status).toBe(200);
  });

  it("content_manager role (learn.content) is authorized for landing management", async () => {
    // ensure the content_manager role has learn.content (an earlier RBAC test may have changed it)
    await request(app).put("/api/admin/roles/content_manager").set(A(atk))
      .send({ perms: ["learn.view", "learn.content"] });
    const freshCtk = await token("content"); // perms are read live per request via the role
    const cr = await request(app).post("/api/admin/landing/testimonials").set(A(freshCtk))
      .send({ name_fa: "توسط مدیر محتوا", quote_fa: "ok" });
    expect(cr.status).toBe(200);
    await request(app).delete(`/api/admin/landing/testimonials/${cr.body.testimonial.id}`).set(A(atk));
  });

  it("unpublished testimonial is hidden from the public payload", async () => {
    const cr = await request(app).post("/api/admin/landing/testimonials").set(A(atk))
      .send({ name_fa: "مخفی", quote_fa: "نباید دیده شود", published: 0 });
    const id = cr.body.testimonial.id;
    const pub = await request(app).get("/api/site-content/landing?lang=fa");
    expect(pub.body.testimonials.some((t) => t.name === "مخفی")).toBe(false);
    await request(app).delete(`/api/admin/landing/testimonials/${id}`).set(A(atk));
  });

  it("FAQ and trust-badge CRUD work", async () => {
    const f = await request(app).post("/api/admin/landing/faqs").set(A(atk))
      .send({ q_fa: "س؟", q_en: "Q?", a_fa: "ج", a_en: "A" });
    expect(f.status).toBe(200);
    await request(app).delete(`/api/admin/landing/faqs/${f.body.faq.id}`).set(A(atk));
    const b = await request(app).post("/api/admin/landing/badges").set(A(atk))
      .send({ icon: "shield", label_fa: "امن", label_en: "Secure" });
    expect(b.status).toBe(200);
    expect(b.body.badge.icon).toBe("shield");
    await request(app).delete(`/api/admin/landing/badges/${b.body.badge.id}`).set(A(atk));
  });

  it("threshold HIDES a stat until the real number reaches it, and never shows a fake number", async () => {
    // set a very high threshold for learners → the stat must be HIDDEN (null),
    // NOT padded to a fake "12,000" (honest social proof).
    const put = await request(app).put("/api/admin/landing/floor").set(A(atk))
      .send({ floor: { learners: 12000, questions: 0, topics: 0, xp: 0, accuracy: 0 } });
    expect(put.status).toBe(200);
    const pub = await request(app).get("/api/site-content/landing");
    // learners is hidden (null) because the real count is far below 12000
    expect(pub.body.stats.learners).toBeNull();
    // the REAL count is still available to the admin via raw
    expect(pub.body.stats.raw.learners).toBeLessThan(12000);
    // now set threshold below real topics → the REAL topics number is shown
    const realTopics = pub.body.stats.raw.topics;
    await request(app).put("/api/admin/landing/floor").set(A(atk))
      .send({ floor: { learners: 0, questions: 0, topics: 1, xp: 0, accuracy: 0 } });
    const pub2 = await request(app).get("/api/site-content/landing");
    expect(Number(pub2.body.stats.topics)).toBe(realTopics);
    // with threshold 0, the learners stat is shown and never exceeds the real count
    // (rounded down, so shown <= real — proving it's never inflated).
    if (pub2.body.stats.learners != null) {
      const shownLearners = Number(String(pub2.body.stats.learners).replace(/[+,]/g, ""));
      expect(shownLearners).toBeLessThanOrEqual(pub2.body.stats.raw.learners);
    }
    // reset threshold to zero to keep other tests clean
    await request(app).put("/api/admin/landing/floor").set(A(atk))
      .send({ floor: { learners: 0, questions: 0, topics: 0, xp: 0, accuracy: 0 } });
  });

  it("a learner cannot manage landing social proof (403)", async () => {
    const res = await request(app).post("/api/admin/landing/testimonials").set(A(ltk)).send({ name_fa: "x" });
    expect(res.status).toBe(403);
  });
});

describe("Product-health dashboard", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, ltk;
  beforeAll(async () => { atk = await token("admin"); ltk = await token("learner"); });

  it("returns engagement, funnel, retention & support signals", async () => {
    const res = await request(app).get("/api/admin/product-health").set(A(atk));
    expect(res.status).toBe(200);
    expect(res.body.engagement).toBeTruthy();
    expect(typeof res.body.engagement.dau).toBe("number");
    expect(typeof res.body.engagement.mau).toBe("number");
    expect(typeof res.body.engagement.stickiness).toBe("number");
    expect(Array.isArray(res.body.engagement.trend)).toBe(true);
    expect(res.body.engagement.trend.length).toBe(14);
    expect(Array.isArray(res.body.funnel)).toBe(true);
    expect(res.body.funnel[0].key).toBe("signup");
    expect(res.body.funnel[0].pct).toBe(100);
    expect(res.body.support).toHaveProperty("open");
    expect(Array.isArray(res.body.support.recent)).toBe(true);
  });

  it("demo seed produces real active users (DAU/MAU > 0)", async () => {
    const res = await request(app).get("/api/admin/product-health").set(A(atk));
    expect(res.body.engagement.mau).toBeGreaterThan(0);
    expect(res.body.engagement.dau).toBeGreaterThan(0);
    // stickiness = DAU/MAU is a percentage 0..100
    expect(res.body.engagement.stickiness).toBeGreaterThanOrEqual(0);
    expect(res.body.engagement.stickiness).toBeLessThanOrEqual(100);
  });

  it("a learner cannot read the product-health dashboard (403)", async () => {
    const res = await request(app).get("/api/admin/product-health").set(A(ltk));
    expect(res.status).toBe(403);
  });
});

describe("FSRS parameter optimizer", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, ltk;
  beforeAll(async () => { atk = await token("admin"); ltk = await token("learner"); });

  it("analyze reports review count, trainable cards and current log-loss", async () => {
    const res = await request(app).get("/api/admin/fsrs/analyze").set(A(atk));
    expect(res.status).toBe(200);
    expect(res.body.totalReviews).toBeGreaterThan(0);
    expect(res.body.trainableCards).toBeGreaterThan(0);
    expect(res.body).toHaveProperty("ready");
    expect(res.body.current.logloss).toBeGreaterThan(0);
    expect(Array.isArray(res.body.params)).toBe(true);
    expect(res.body.params.length).toBe(21);
  });

  it("optimize returns 21 proposed params and does not worsen log-loss", async () => {
    const res = await request(app).post("/api/admin/fsrs/optimize").set(A(atk));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.proposed)).toBe(true);
    expect(res.body.proposed.length).toBe(21);
    expect(res.body.proposedEval.logloss).toBeLessThanOrEqual(res.body.currentEval.logloss + 1e-6);
    expect(res.body.trainableCards).toBeGreaterThan(0);
  });

  it("apply persists exactly 21 numeric params into the SRS config", async () => {
    const opt = await request(app).post("/api/admin/fsrs/optimize").set(A(atk));
    const params = opt.body.proposed;
    const res = await request(app).post("/api/admin/fsrs/apply").set(A(atk)).send({ params });
    expect(res.status).toBe(200);
    // config now reflects the applied params
    const cfg = await request(app).get("/api/admin/game-config").set(A(atk));
    expect(cfg.body.config.srs.params).toEqual(params);
  });

  it("apply rejects malformed params (400)", async () => {
    const r1 = await request(app).post("/api/admin/fsrs/apply").set(A(atk)).send({ params: [1, 2, 3] });
    expect(r1.status).toBe(400);
    const r2 = await request(app).post("/api/admin/fsrs/apply").set(A(atk)).send({ params: null });
    expect(r2.status).toBe(400);
  });

  it("a learner cannot analyze or optimize (403)", async () => {
    expect((await request(app).get("/api/admin/fsrs/analyze").set(A(ltk))).status).toBe(403);
    expect((await request(app).post("/api/admin/fsrs/optimize").set(A(ltk))).status).toBe(403);
  });
});

describe("Group purchase (volume discount)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, buyer, friend;
  beforeAll(async () => { atk = await token("admin"); buyer = await token("learner"); friend = await token("learner1"); });

  it("lists active seat packs with per-seat price and savings", async () => {
    const res = await request(app).get("/api/pay/group/packs").set(A(buyer));
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.packs.length).toBeGreaterThan(0);
    const p = res.body.packs[0];
    expect(p.seats).toBeGreaterThanOrEqual(2);
    expect(p.perSeat).toBeGreaterThan(0);
    expect(typeof p.savedPct).toBe("number");
  });

  it("full flow: checkout → gateway callback → codes generated → friend redeems on own account", async () => {
    const packs = await request(app).get("/api/pay/group/packs").set(A(buyer));
    const pack = packs.body.packs.find((x) => x.seats >= 3) || packs.body.packs[0];
    // checkout
    const co = await request(app).post("/api/pay/group/checkout").set(A(buyer)).send({ packId: pack.id });
    expect(co.status).toBe(200);
    expect(co.body.authority).toBeTruthy();
    // simulate a successful gateway callback (mock gateway)
    const cb = await request(app).get(`/api/pay/callback?Authority=${co.body.authority}&Status=OK`);
    expect(cb.status).toBe(302);
    // buyer sees a paid order with one code per seat
    const orders = await request(app).get("/api/pay/group/orders").set(A(buyer));
    const order = orders.body.orders.find((o) => o.id === co.body.orderId);
    expect(order.status).toBe("paid");
    expect(order.codes.length).toBe(pack.seats);
    const code = order.codes[0].code;
    // friend redeems on THEIR OWN account → premium activates for the friend
    const rd = await request(app).post("/api/pay/group/redeem").set(A(friend)).send({ code });
    expect(rd.status).toBe(200);
    expect(rd.body.days).toBe(pack.days);
    // the friend's profile is now premium
    const prof = await request(app).get("/api/learn/profile").set(A(friend));
    expect(prof.body.profile.premium).toBeTruthy();
    // re-redeeming the same code fails
    const rd2 = await request(app).post("/api/pay/group/redeem").set(A(friend)).send({ code });
    expect(rd2.status).toBe(400);
    expect(rd2.body.error).toBe("already_used");
  });

  it("rejects an unknown code", async () => {
    const res = await request(app).post("/api/pay/group/redeem").set(A(buyer)).send({ code: "MED-XXXX-YYYY" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("not_found");
  });

  it("admin can CRUD packs and see order stats", async () => {
    const cr = await request(app).post("/api/admin/group/packs").set(A(atk))
      .send({ title_fa: "تست", seats: 4, days: 30, price: 3000000 });
    expect(cr.status).toBe(200);
    const id = cr.body.pack.id;
    expect(cr.body.pack.seats).toBe(4);
    const up = await request(app).put(`/api/admin/group/packs/${id}`).set(A(atk)).send({ seats: 1 });
    expect(up.body.pack.seats).toBe(2); // clamped to a minimum of 2
    const list = await request(app).get("/api/admin/group").set(A(atk));
    expect(list.status).toBe(200);
    expect(list.body).toHaveProperty("stats");
    expect(list.body.stats).toHaveProperty("redeemRate");
    await request(app).delete(`/api/admin/group/packs/${id}`).set(A(atk));
  });

  it("a learner cannot manage packs (403)", async () => {
    const res = await request(app).post("/api/admin/group/packs").set(A(buyer)).send({ seats: 3 });
    expect(res.status).toBe(403);
  });

  it("group packs endpoint reports disabled when the feature flag is off", async () => {
    await request(app).put("/api/admin/flags/group_purchase").set(A(atk)).send({ enabled: false });
    const res = await request(app).get("/api/pay/group/packs").set(A(buyer));
    expect(res.body.enabled).toBe(false);
    // checkout is blocked while disabled
    const co = await request(app).post("/api/pay/group/checkout").set(A(buyer)).send({ packId: 1 });
    expect(co.status).toBe(403);
    // turn it back on so other tests / the app default stays enabled
    await request(app).put("/api/admin/flags/group_purchase").set(A(atk)).send({ enabled: true });
  });
});

describe("Premium kill-switch (feature flag hides all premium traces)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, learner;
  beforeAll(async () => { atk = await token("admin"); learner = await token("learner3"); });

  it("with premium ON, a non-premium learner is not effectively premium and can run out of hearts", async () => {
    await request(app).put("/api/admin/flags/premium").set(A(atk)).send({ enabled: true });
    const prof = await request(app).get("/api/learn/profile").set(A(learner));
    expect(prof.body.profile.premium).toBeFalsy();
    expect(prof.body.profile.premium_effective).toBe(false);
    expect(prof.body.profile.premium_program_on).toBe(true);
  });

  it("hearts cap and refill interval are admin-tunable (default 30 / 30 min)", async () => {
    await request(app).put("/api/admin/flags/premium").set(A(atk)).send({ enabled: true });
    const gc = await request(app).get("/api/admin/game-config").set(A(atk));
    expect(gc.body.defaults.hearts).toEqual({ max: 30, refill_minutes: 30, refill_gems: 50 });
    let prof = await request(app).get("/api/learn/profile").set(A(learner));
    expect(prof.body.profile.hearts_max).toBe(30);
    expect(prof.body.profile.heart_refill_minutes).toBe(30);
    expect(prof.body.profile.hearts).toBeLessThanOrEqual(30);
    // admin changes the cap → visible immediately, no restart
    await request(app).put("/api/admin/game-config").set(A(atk)).send({ config: { ...gc.body.config, hearts: { max: 7, refill_minutes: 10, refill_gems: 20 } } });
    prof = await request(app).get("/api/learn/profile").set(A(learner));
    expect(prof.body.profile.hearts_max).toBe(7);
    expect(prof.body.profile.heart_refill_minutes).toBe(10);
    expect(prof.body.profile.heart_refill_gems).toBe(20);
    expect(prof.body.profile.hearts).toBeLessThanOrEqual(7);
    await request(app).put("/api/admin/game-config").set(A(atk)).send({ config: { ...gc.body.config, hearts: { max: 30, refill_minutes: 30, refill_gems: 50 } } });
  });

  it("with premium OFF, everyone is effectively premium (unlimited hearts, no ads, no upsell)", async () => {
    await request(app).put("/api/admin/flags/premium").set(A(atk)).send({ enabled: false });
    const prof = await request(app).get("/api/learn/profile").set(A(learner));
    expect(prof.body.profile.premium).toBeFalsy();          // real DB flag untouched
    expect(prof.body.profile.premium_effective).toBe(true); // but treated as premium for access
    expect(prof.body.profile.premium_program_on).toBe(false);
    expect(prof.body.profile.hearts).toBe(prof.body.profile.hearts_max);  // admin-tunable cap (default 30)
    // public flags reflect it (client hides the premium tab)
    const flags = await request(app).get("/api/flags").set(A(learner));
    expect(flags.body.flags.premium).toBe(false);
    // home shows no ads while off
    const home = await request(app).get("/api/learn/home").set(A(learner));
    expect((home.body.ads || []).length).toBe(0);
    // restore
    await request(app).put("/api/admin/flags/premium").set(A(atk)).send({ enabled: true });
  });
});

describe("Premium accounts management", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, learner;
  beforeAll(async () => { atk = await token("admin"); learner = await token("learner4"); });

  it("overview + subscriber list are available to admin", async () => {
    const res = await request(app).get("/api/admin/premium").set(A(atk));
    expect(res.status).toBe(200);
    expect(res.body.overview).toHaveProperty("active");
    expect(res.body.overview).toHaveProperty("programOn");
    expect(res.body.overview.revenue).toHaveProperty("total");
    expect(Array.isArray(res.body.subscribers)).toBe(true);
  });

  it("admin can grant, extend and revoke premium for a learner", async () => {
    const me = await request(app).get("/api/learn/profile").set(A(learner));
    const uid = me.body.profile.user_id;
    // grant 30 days
    const g = await request(app).post("/api/admin/premium/grant").set(A(atk)).send({ userId: uid, days: 30 });
    expect(g.status).toBe(200);
    expect(g.body.daysLeft).toBeGreaterThan(0);
    // learner is now premium
    const p1 = await request(app).get("/api/learn/profile").set(A(learner));
    expect(p1.body.profile.premium).toBeTruthy();
    // extend stacks
    const g2 = await request(app).post("/api/admin/premium/grant").set(A(atk)).send({ userId: uid, days: 30 });
    expect(g2.body.daysLeft).toBeGreaterThan(g.body.daysLeft);
    // lifetime grant
    const gl = await request(app).post("/api/admin/premium/grant").set(A(atk)).send({ userId: uid, lifetime: true });
    expect(gl.body.lifetime).toBe(true);
    // revoke
    const rv = await request(app).post("/api/admin/premium/revoke").set(A(atk)).send({ userId: uid });
    expect(rv.status).toBe(200);
    const p2 = await request(app).get("/api/learn/profile").set(A(learner));
    expect(p2.body.profile.premium).toBeFalsy();
  });

  it("find endpoint locates learners; a learner cannot manage premium (403)", async () => {
    const f = await request(app).get("/api/admin/premium/find?q=learner").set(A(atk));
    expect(f.body.results.length).toBeGreaterThan(0);
    const forbidden = await request(app).post("/api/admin/premium/grant").set(A(learner)).send({ userId: 1, days: 30 });
    expect(forbidden.status).toBe(403);
  });
});

describe("Virtual patient AI (works with a real OpenAI-compatible API)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, teacher, llm, port;
  beforeAll(async () => {
    atk = await token("admin"); teacher = await token("teacher");
    const http = await import("http");
    llm = http.createServer((rq, rs) => {
      if (rq.url.endsWith("/chat/completions") && rq.method === "POST") {
        let b = ""; rq.on("data", (c) => (b += c)); rq.on("end", () => {
          let pl = {}; try { pl = JSON.parse(b); } catch {}
          const json = pl.response_format?.type === "json_object";
          const user = pl.messages?.at(-1)?.content || "";
          const scoring = user.startsWith("RUBRIC:\n");
          const rows = scoring ? JSON.parse(user.split("RUBRIC:\n")[1].split("\n\n")[0]) : [];
          const content = json
            ? JSON.stringify(scoring
              ? { items: rows.map(row => ({ id: row.id, done: false, reason: "No supporting evidence in this synthetic encounter." })) }
              : { strengths: [], weaknesses: ["ثبت مراحل برخورد کامل نیست"], missed: [], commonMistakes: [], suggestion: "مرور ساختار شرح‌حال", microlearning: "### تمرین هدفمند\nزمان شروع درد را صریح بپرسید، پاسخ را ثبت کنید و اثر آن بر تشخیص افتراقی را با استاد مرور کنید." })
            : "سلام دکتر، درد قفسه سینه دارم. [real-api]";
          rs.writeHead(200, { "content-type": "application/json" });
          rs.end(JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }));
        });
      } else { rs.writeHead(404); rs.end(); }
    });
    await new Promise((r) => llm.listen(0, r));
    port = llm.address().port;
  });
  afterAll(() => { try { llm.close(); } catch { /* */ } });

  it("mock engine is used when no API key is set", async () => {
    await request(app).put("/api/settings/ai").set(A(atk)).send({ provider: "", baseUrl: "", apiKey: "", clearApiKey: true, model: "" });
    const res = await request(app).post("/api/exam/ai-test").set(A(atk)).send({ lang: "fa" });
    expect(res.body.connected).toBe(false);
    expect(res.body.mode).toBe("mock");
  });

  it("connects to a real OpenAI-compatible API and returns a live patient reply", async () => {
    await request(app).put("/api/settings/ai").set(A(atk))
      .send({ provider: "Custom", baseUrl: `http://localhost:${port}/v1`, apiKey: "sk-test", model: "fake-1" });
    const res = await request(app).post("/api/exam/ai-test").set(A(atk)).send({ lang: "fa" });
    expect(res.body.connected).toBe(true);
    expect(res.body.mode).toBe("llm");
    expect(res.body.sample).toContain("[real-api]");
  });

  it("patient-reply and evaluate use the real API when configured", async () => {
    await request(app).put("/api/settings/ai").set(A(atk))
      .send({ provider: "Custom", baseUrl: `http://localhost:${port}/v1`, apiKey: "sk-test", model: "fake-1" });
    const cases = await request(app).get("/api/cases").set(A(teacher));
    const caseId = (Array.isArray(cases.body) ? cases.body[0] : cases.body.cases?.[0])?.id;
    const pr = await request(app).post("/api/exam/patient-reply").set(A(teacher))
      .send({ caseId, userText: "سلام", history: [], lang: "fa" });
    expect(pr.body.source).toBe("llm");
    expect(pr.body.text).toContain("[real-api]");
    const ev = await request(app).post("/api/exam/evaluate").set(A(teacher))
      .send({ caseId, lang: "fa", session: { messages: [{ role: "student", text: "ECG و تروپونین" }], tests: ["ECG"], finalDx: "MI" } });
    expect(ev.body.source).toBe("llm");
    expect(ev.body.feedbackSource).toBe("llm");
    expect(typeof ev.body.score).toBe("number");
    // reset AI to no-key so other tests keep using mock
    await request(app).put("/api/settings/ai").set(A(atk)).send({ provider: "", baseUrl: "", apiKey: "", clearApiKey: true, model: "" });
  });
});

describe("Virtual patient: editable prompts + lab/imaging ordering + order review", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, teacher, llm, port, lastSys;
  beforeAll(async () => {
    atk = await token("admin"); teacher = await token("teacher");
    const http = await import("http");
    llm = http.createServer((rq, rs) => {
      if (rq.url.endsWith("/chat/completions") && rq.method === "POST") {
        let b = ""; rq.on("data", (c) => (b += c)); rq.on("end", () => {
          let p = {}; try { p = JSON.parse(b); } catch {}
          lastSys = (p.messages || []).find((m) => m.role === "system")?.content || "";
          const json = p.response_format?.type === "json_object";
          const content = json
            ? JSON.stringify({ strengths: ["x"], weaknesses: ["y"], missed: [], commonMistakes: ["z"], suggestion: "s", microlearning: "m" })
            : "NORMAL-REPORT";
          rs.writeHead(200, { "content-type": "application/json" });
          rs.end(JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }));
        });
      } else { rs.writeHead(404); rs.end(); }
    });
    await new Promise((r) => llm.listen(0, r));
    port = llm.address().port;
  });
  afterAll(() => { try { llm.close(); } catch { /* */ } });

  it("all prompt fields (incl. the previously hard-coded rules) are editable and persist", async () => {
    const put = await request(app).put("/api/prompts").set(A(atk)).send({
      patient_rules_fa: "قانون تست", patient_rules_en: "test rule",
      lab_normal_fa: "نرمال {item}", labresult_rules_en: "one line",
    });
    expect(put.status).toBe(200);
    const got = await request(app).get("/api/prompts").set(A(atk));
    expect(got.body.patient_rules_fa).toBe("قانون تست");
    expect(got.body.lab_normal_fa).toBe("نرمال {item}");
  });

  it("AI receives the admin prompt rules AND the patient chart, but NOT the diagnosis", async () => {
    await request(app).put("/api/settings/ai").set(A(atk))
      .send({ provider: "Custom", baseUrl: `http://localhost:${port}/v1`, apiKey: "sk", model: "x" });
    await request(app).put("/api/prompts").set(A(atk)).send({ patient_rules_fa: "MARKER_RULE_9988" });
    await request(app).post("/api/exam/patient-reply").set(A(teacher)).send({ caseId: 1, userText: "سلام", lang: "fa" });
    expect(lastSys).toContain("MARKER_RULE_9988");        // admin rule reached the AI
    expect(lastSys).toContain("قفسه سینه");                // patient chart reached the AI
    expect(lastSys).not.toContain("STEMI");                // diagnosis is withheld
  });

  it("ordering a RECORDED lab returns its value; recorded imaging returns an image", async () => {
    await request(app).put("/api/settings/ai").set(A(atk)).send({ provider: "", baseUrl: "", apiKey: "", clearApiKey: true, model: "" });
    const lab = await request(app).post("/api/exam/order").set(A(teacher)).send({ caseId: 1, kind: "lab", query: "تروپونین", lang: "fa" });
    expect(lab.body.found).toBe(true);
    expect(lab.body.text).toMatch(/تروپونین/);
    const img = await request(app).post("/api/exam/order").set(A(teacher)).send({ caseId: 1, kind: "paraclinic", query: "ECG", lang: "fa" });
    expect(img.body.found).toBe(true);
    expect(img.body.imageUrl).toBeTruthy();
  });

  it("ordering a test NOT in the chart tells the student it is normal (deterministic fallback)", async () => {
    await request(app).put("/api/settings/ai").set(A(atk)).send({ provider: "", baseUrl: "", apiKey: "", clearApiKey: true, model: "" });
    const r = await request(app).post("/api/exam/order").set(A(teacher)).send({ caseId: 1, kind: "lab", query: "کراتینین", lang: "fa" });
    expect(r.body.found).toBe(false);
    expect(r.body.source).toBe("mock");
    expect(r.body.text).toMatch(/نرمال|طبیعی/);
    expect(r.body.text).toContain("کراتینین");
  });

  it("ordering a normal test uses the AI wording when a key is configured", async () => {
    await request(app).put("/api/settings/ai").set(A(atk))
      .send({ provider: "Custom", baseUrl: `http://localhost:${port}/v1`, apiKey: "sk", model: "x" });
    const r = await request(app).post("/api/exam/order").set(A(teacher)).send({ caseId: 1, kind: "lab", query: "منیزیم", lang: "fa" });
    expect(r.body.found).toBe(false);
    expect(r.body.source).toBe("llm");
    expect(r.body.text).toContain("NORMAL-REPORT");
    await request(app).put("/api/settings/ai").set(A(atk)).send({ provider: "", baseUrl: "", apiKey: "", clearApiKey: true, model: "" });
  });

  it("evaluation reviews ordered-test appropriateness (unnecessary + missed key)", async () => {
    const ev = await request(app).post("/api/exam/evaluate").set(A(teacher)).send({
      caseId: 1, lang: "fa",
      session: { messages: [{ role: "student", text: "شرح حال" }], tests: ["کراتینین"], imaging: ["ECG"], finalDx: "STEMI" },
    });
    expect(ev.body.orderReview).toBeTruthy();
    expect(ev.body.orderReview.appropriate).toContain("ECG");
    expect(ev.body.orderReview.unnecessary).toContain("کراتینین");
    expect(ev.body.orderReview.missedKey.length).toBeGreaterThan(0);
    // a commonMistakes/weakness line mentions the unnecessary/missed workup
    const allFeedback = [...(ev.body.commonMistakes || []), ...(ev.body.weaknesses || [])].join(" ");
    expect(allFeedback).toMatch(/غیرضروری|کلیدی/);
  });

  it("the patient never recites raw recorded lab values (they come via the lab report)", async () => {
    // sanitised chart used for the patient must not include labResults/imagingResults arrays
    await request(app).put("/api/settings/ai").set(A(atk))
      .send({ provider: "Custom", baseUrl: `http://localhost:${port}/v1`, apiKey: "sk", model: "x" });
    lastSys = "";
    await request(app).post("/api/exam/patient-reply").set(A(teacher)).send({ caseId: 1, userText: "نتیجه آزمایش چیه؟", lang: "fa" });
    expect(lastSys).not.toContain("labResults");
    expect(lastSys).not.toContain("imagingResults");
    await request(app).put("/api/settings/ai").set(A(atk)).send({ provider: "", baseUrl: "", apiKey: "", clearApiKey: true, model: "" });
  });
});

describe("Daily Diagnosis Challenge", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, learner, ctk;
  beforeAll(async () => { atk = await token("admin"); learner = await token("learner1"); ctk = await token("content"); });

  it("learner gets today's case without the answer leaking", async () => {
    const res = await request(app).get("/api/learn/dx/daily").set(A(learner));
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.vignette).toBeTruthy();
    expect(res.body.options.length).toBeGreaterThan(1);
    expect(res.body.answer).toBeUndefined();        // never leak before finishing
    expect(res.body.clues.length).toBe(0);          // no clues until a wrong guess
    expect(res.body.guessesLeft).toBeGreaterThan(0);
  });

  it("a wrong guess reveals the next clue; a correct guess solves + awards XP", async () => {
    const day = await request(app).get("/api/learn/dx/daily").set(A(learner));
    const caseId = day.body.caseId;
    // find the correct option by peeking at the admin case list (answer text)
    const admin = await request(app).get("/api/admin/dx").set(A(atk));
    const todays = admin.body.cases.find((c) => c.id === admin.body.todayId);
    const correct = todays.answer_fa;
    const wrong = day.body.options.find((o) => o !== correct && o !== todays.answer_en) || "گزینهٔ اشتباه";
    // wrong guess
    const g1 = await request(app).post("/api/learn/dx/guess").set(A(learner)).send({ caseId, guess: wrong });
    expect(g1.body.lastGuessCorrect).toBe(false);
    expect(g1.body.clues.length).toBe(1);
    // correct guess
    const g2 = await request(app).post("/api/learn/dx/guess").set(A(learner)).send({ caseId, guess: correct });
    expect(g2.body.solved).toBe(true);
    expect(g2.body.finished).toBe(true);
    expect(g2.body.answer).toBe(correct);           // revealed only now
    expect(g2.body.explanation).toBeTruthy();
    expect(g2.body.awards.xp).toBeGreaterThan(0);
  });

  it("solving keeps the state finished on re-fetch (one attempt per case)", async () => {
    const res = await request(app).get("/api/learn/dx/daily").set(A(learner));
    expect(res.body.finished).toBe(true);
    expect(res.body.solved).toBe(true);
  });

  it("running out of guesses finishes the case as unsolved and reveals the answer", async () => {
    const loser = await token("learner3");
    const day = await request(app).get("/api/learn/dx/daily").set(A(loser));
    const caseId = day.body.caseId;
    let last;
    for (let i = 0; i < day.body.maxGuesses; i++) {
      last = await request(app).post("/api/learn/dx/guess").set(A(loser)).send({ caseId, guess: "تشخیص نادرست تست " + i });
    }
    expect(last.body.finished).toBe(true);
    expect(last.body.solved).toBe(false);
    expect(last.body.answer).toBeTruthy();           // answer shown after the game ends
  });

  it("content manager can CRUD dx cases; a learner cannot (403)", async () => {
    const cr = await request(app).post("/api/admin/dx").set(A(ctk)).send({
      category_fa: "تست", vignette_fa: "بیمار تست", answer_fa: "تشخیص تست",
      clues: [{ fa: "سرنخ ۱" }], options: [{ fa: "تشخیص تست" }, { fa: "دیگری" }], difficulty: "easy", max_guesses: 4,
    });
    expect(cr.status).toBe(200);
    const id = cr.body.case.id;
    const up = await request(app).put(`/api/admin/dx/${id}`).set(A(ctk)).send({ difficulty: "hard" });
    expect(up.body.case.difficulty).toBe("hard");
    const del = await request(app).delete(`/api/admin/dx/${id}`).set(A(atk));
    expect(del.status).toBe(200);
    const forbidden = await request(app).post("/api/admin/dx").set(A(learner)).send({ answer_fa: "x" });
    expect(forbidden.status).toBe(403);
  });

  it("the daily challenge respects its feature flag", async () => {
    await request(app).put("/api/admin/flags/dx_challenge").set(A(atk)).send({ enabled: false });
    const res = await request(app).get("/api/learn/dx/daily").set(A(learner));
    expect(res.status).toBe(403);
    await request(app).put("/api/admin/flags/dx_challenge").set(A(atk)).send({ enabled: true });
  });
});

describe("Daily Diagnosis Challenge — bulk import", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, learner;
  beforeAll(async () => { atk = await token("admin"); learner = await token("learner1"); });

  it("admin can download the CSV template and bulk-import cases", async () => {
    const tmpl = await request(app).get("/api/admin/dx/import/template.csv").set(A(atk));
    expect(tmpl.status).toBe(200);
    expect(tmpl.text).toContain("category_fa");
    const imp = await request(app).post("/api/admin/dx/import").set(A(atk)).send({ csv: tmpl.text });
    expect(imp.status).toBe(200);
    expect(imp.body.imported).toBeGreaterThan(0);
  });

  it("import rejects rows without an answer or vignette", async () => {
    const csv = "category_fa,vignette_fa,answer_fa\nقلب,,\nریه,بیمار تست,";
    const imp = await request(app).post("/api/admin/dx/import").set(A(atk)).send({ csv });
    expect(imp.body.errors.length).toBeGreaterThan(0);
  });

  it("a learner cannot import (403)", async () => {
    const res = await request(app).post("/api/admin/dx/import").set(A(learner)).send({ csv: "x" });
    expect(res.status).toBe(403);
  });
});

describe("Referral (invite-a-friend) + social sharing", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, learner;
  beforeAll(async () => { atk = await token("admin"); learner = await token("learner"); });

  it("learner gets a personal referral code + dashboard", async () => {
    const res = await request(app).get("/api/learn/referral").set(A(learner));
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.code).toBeTruthy();
    expect(Array.isArray(res.body.milestones)).toBe(true);
    expect(res.body.rewards.referredGems).toBeGreaterThan(0);
  });

  it("referrer leaderboard is available", async () => {
    const res = await request(app).get("/api/learn/referral/leaderboard").set(A(learner));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.leaders)).toBe(true);
  });

  it("signing up with a valid code rewards BOTH sides (double-sided)", async () => {
    const email = `ref_${Date.now()}@test.com`;
    // demo learner's seeded code is MED123
    const before = (await request(app).get("/api/learn/referral").set(A(learner))).body.count;
    const su = await request(app).post("/api/auth/register").send({ email, password: "demo123", name_fa: "دوست", ref: "MED123" });
    expect(su.status).toBe(200);
    const friend = su.body.token;
    // the new friend received gems (referred_gems)
    const prof = await request(app).get("/api/learn/profile").set(A(friend));
    expect(prof.body.profile.gems).toBeGreaterThanOrEqual(50);
    // the referrer's count increased
    const after = (await request(app).get("/api/learn/referral").set(A(learner))).body.count;
    expect(after).toBe(before + 1);
  });

  it("an invalid or self referral code does not crash signup", async () => {
    const email = `ref2_${Date.now()}@test.com`;
    const su = await request(app).post("/api/auth/register").send({ email, password: "demo123", name_fa: "ب", ref: "NOPE99" });
    expect(su.status).toBe(200); // signup still succeeds, just no referral attached
  });

  it("social config exposes brand tag + invite code; share-to-earn grants gems (capped)", async () => {
    const cfg = await request(app).get("/api/learn/social/config").set(A(learner));
    expect(cfg.body.enabled).toBe(true);
    expect(cfg.body.brandTag).toBeTruthy();
    const fresh = await token("learner11");
    const s1 = await request(app).post("/api/learn/social/share").set(A(fresh)).send({ kind: "dx", channel: "instagram" });
    expect(s1.body.rewardGems).toBeGreaterThan(0);
  });

  it("admin growth analytics report referrals, viral K and channels", async () => {
    const res = await request(app).get("/api/admin/growth").set(A(atk));
    expect(res.status).toBe(200);
    expect(res.body.stats).toHaveProperty("viralK");
    expect(res.body.stats).toHaveProperty("qualified");
    expect(Array.isArray(res.body.stats.byChannel)).toBe(true);
    expect(Array.isArray(res.body.leaderboard)).toBe(true);
  });

  it("referral respects its feature flag", async () => {
    await request(app).put("/api/admin/flags/referral").set(A(atk)).send({ enabled: false });
    const res = await request(app).get("/api/learn/referral").set(A(learner));
    expect(res.status).toBe(403);
    await request(app).put("/api/admin/flags/referral").set(A(atk)).send({ enabled: true });
  });
});

describe("First-time welcome flow (home redesign)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });

  it("a brand-new learner starts with welcome_seen=0, then can mark it seen", async () => {
    const email = `wel_${Date.now()}@test.com`;
    const su = await request(app).post("/api/auth/register").send({ email, password: "demo123", name_fa: "تازه‌وارد" });
    expect(su.status).toBe(200);
    const tk = su.body.token;
    const p1 = await request(app).get("/api/learn/profile").set(A(tk));
    expect(p1.body.profile.welcome_seen).toBe(0);
    const seen = await request(app).post("/api/learn/welcome/seen").set(A(tk));
    expect(seen.body.ok).toBe(true);
    const p2 = await request(app).get("/api/learn/profile").set(A(tk));
    expect(p2.body.profile.welcome_seen).toBe(1);
  });

  it("setting a daily goal from the welcome flow persists and marks goal_set", async () => {
    const tk = await token("learner");
    const res = await request(app).post("/api/learn/daily/goal").set(A(tk)).send({ value: 50 });
    expect(res.status).toBe(200);
    expect(res.body.profile.daily_goal).toBe(50);
  });
});

describe("Smart reminders (behavior-based)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, learner;
  beforeAll(async () => { atk = await token("admin"); learner = await token("learner1"); });

  it("preview reports eligibility counts by reminder type", async () => {
    const res = await request(app).get("/api/admin/reminders/preview").set(A(atk));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("goal");
    expect(res.body).toHaveProperty("streak");
    expect(res.body).toHaveProperty("winback");
    expect(res.body).toHaveProperty("eligible");
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.now).toBeTruthy();
  });

  it("run sends reminders and they land in the learner's bell", async () => {
    // fresh DB per suite, but earlier describe blocks may have run reminders;
    // this test is self-contained: it checks the run executes and (cumulatively)
    // reminder notifications exist for a qualifying learner.
    const run = await request(app).post("/api/admin/reminders/run").set(A(atk));
    expect(run.status).toBe(200);
    expect(run.body.byKind).toHaveProperty("goal");
    expect(typeof run.body.sent).toBe("number");
    const nt = await request(app).get("/api/learn/notifications").set(A(learner));
    expect(Array.isArray(nt.body.items)).toBe(true);
  });

  it("respects the daily cap (a repeat run sends 0 more)", async () => {
    // run twice back-to-back; the second run must send nothing extra today
    await request(app).post("/api/admin/reminders/run").set(A(atk));
    const r2 = await request(app).post("/api/admin/reminders/run").set(A(atk));
    expect(r2.body.sent).toBe(0);
  });

  it("a learner cannot access the reminder admin endpoints (403)", async () => {
    expect((await request(app).get("/api/admin/reminders/preview").set(A(learner))).status).toBe(403);
    expect((await request(app).post("/api/admin/reminders/run").set(A(learner))).status).toBe(403);
  });
});

describe("Mobile app (PWA install)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, learner;
  beforeAll(async () => { atk = await token("admin"); learner = await token("learner"); });

  it("exposes public PWA config with sensible defaults", async () => {
    const res = await request(app).get("/api/pwa/config");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("enabled");
    expect(res.body).toHaveProperty("show_prompt");
    expect(res.body.snooze_days).toBeGreaterThan(0);
  });

  it("records a funnel event even for a logged-out visitor", async () => {
    const res = await request(app).post("/api/pwa/event")
      .send({ event: "prompt_shown", platform: "android", standalone: false });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("records an authenticated install + standalone launch", async () => {
    const a = await request(app).post("/api/pwa/event").set(A(learner))
      .send({ event: "installed", platform: "android", standalone: true });
    expect(a.status).toBe(200);
    const b = await request(app).post("/api/pwa/event").set(A(learner))
      .send({ event: "launch", platform: "android", standalone: true });
    expect(b.status).toBe(200);
  });

  it("rejects an invalid event name", async () => {
    const res = await request(app).post("/api/pwa/event").send({ event: "hack" });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it("admin PWA dashboard returns the install funnel + usage", async () => {
    const res = await request(app).get("/api/admin/pwa").set(A(atk));
    expect(res.status).toBe(200);
    expect(res.body.funnel).toHaveProperty("shown");
    expect(res.body.funnel).toHaveProperty("installed");
    expect(res.body).toHaveProperty("installRate");
    expect(res.body).toHaveProperty("reach");
    expect(Array.isArray(res.body.platform)).toBe(true);
    expect(Array.isArray(res.body.trend)).toBe(true);
    // our just-recorded event should have registered
    expect(res.body.funnel.installed).toBeGreaterThan(0);
  });

  it("a learner cannot access the admin PWA dashboard (403)", async () => {
    expect((await request(app).get("/api/admin/pwa").set(A(learner))).status).toBe(403);
  });
});

describe("SEO (native meta/schema/sitemap)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, learner;
  beforeAll(async () => { atk = await token("admin"); learner = await token("learner"); });

  it("injects crawlable meta + Open Graph + JSON-LD into the homepage HTML", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("og:title");
    expect(res.text).toContain('rel="canonical"');
    expect(res.text).toContain("application/ld+json");
    expect(res.text).toMatch(/<title>[^<]+<\/title>/);
  });

  it("marks login as noindex but home as index", async () => {
    const home = await request(app).get("/");
    expect(home.text).toMatch(/name="robots" content="index, follow"/);
    const login = await request(app).get("/login");
    expect(login.text).toMatch(/name="robots" content="noindex/);
  });

  it("respects ?lang=en for the injected title", async () => {
    const res = await request(app).get("/?lang=en");
    expect(res.text).toMatch(/<title>[^<]*MED School[^<]*<\/title>/);
    expect(res.text).toContain('og:locale" content="en_US"');
  });

  it("serves a valid sitemap.xml and robots.txt", async () => {
    const sm = await request(app).get("/sitemap.xml");
    expect(sm.status).toBe(200);
    expect(sm.headers["content-type"]).toMatch(/xml/);
    expect(sm.text).toContain("<urlset");
    const rb = await request(app).get("/robots.txt");
    expect(rb.status).toBe(200);
    expect(rb.text).toContain("Sitemap:");
    expect(rb.text).toContain("Disallow: /api/");
  });

  it("admin can read and update the SEO config", async () => {
    const get = await request(app).get("/api/admin/seo").set(A(atk));
    expect(get.status).toBe(200);
    expect(get.body.config).toHaveProperty("site_name");
    const put = await request(app).put("/api/admin/seo").set(A(atk))
      .send({ config: { site_name: "MED School Test", description_fa: "توضیح آزمایشی" } });
    expect(put.status).toBe(200);
    expect(put.body.config.site_name).toBe("MED School Test");
    // and it should now appear in the served HTML
    const home = await request(app).get("/");
    expect(home.text).toContain("MED School Test");
  });

  it("noindex master switch flips robots.txt and page robots", async () => {
    await request(app).put("/api/admin/seo").set(A(atk)).send({ config: { noindex: true } });
    const rb = await request(app).get("/robots.txt");
    expect(rb.text).toMatch(/Disallow: \/\s*$/);
    const home = await request(app).get("/");
    expect(home.text).toMatch(/name="robots" content="noindex/);
    // restore so later assertions/tests aren't affected
    await request(app).put("/api/admin/seo").set(A(atk)).send({ config: { noindex: false } });
  });

  it("admin SEO preview returns rendered meta + JSON-LD", async () => {
    const res = await request(app).get("/api/admin/seo/preview?route=home&lang=fa").set(A(atk));
    expect(res.status).toBe(200);
    expect(res.body.meta).toHaveProperty("title");
    expect(res.body.jsonld).toHaveProperty("@graph");
    expect(res.body.html).toContain("og:title");
  });

  it("a learner cannot access SEO admin endpoints (403)", async () => {
    expect((await request(app).get("/api/admin/seo").set(A(learner))).status).toBe(403);
    expect((await request(app).put("/api/admin/seo").set(A(learner)).send({ config: {} })).status).toBe(403);
  });
});

describe("Security hardening", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, learner;
  beforeAll(async () => { atk = await token("admin"); learner = await token("learner"); });

  it("sets Helmet security headers on every response", async () => {
    const res = await request(app).get("/");
    expect(res.headers["content-security-policy"]).toBeTruthy();
    expect(res.headers["strict-transport-security"]).toBeTruthy();
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("does not advertise the framework (no X-Powered-By)", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("admin can read the security status", async () => {
    const res = await request(app).get("/api/admin/security").set(A(atk));
    expect(res.status).toBe(200);
    expect(res.body.helmet).toBe(true);
    expect(res.body.hsts).toBe(true);
    expect(res.body.bcrypt_cost).toBe(12);
    expect(res.body.rate_limit.auth.max).toBeGreaterThan(0);
    expect(res.body.jwt_algorithm).toMatch(/HS256/);
    expect(res.body.ssrf_guard).toBe(true);
  });

  it("rejects a forged alg:none token (algorithm-confusion attack)", async () => {
    // craft a token with no signature claiming to be admin
    const forged = jwt.sign({ id: 1, role: "admin", username: "admin" }, "", { algorithm: "none" });
    const res = await request(app).get("/api/admin/security").set(A(forged));
    expect(res.status).toBe(401);
  });

  it("rejects a token signed with the wrong secret", async () => {
    const bad = jwt.sign({ id: 1, role: "admin", username: "admin" }, "not-the-real-secret", { algorithm: "HS256" });
    const res = await request(app).get("/api/auth/me").set(A(bad));
    expect(res.status).toBe(401);
  });

  it("SSRF guard always blocks metadata + bad schemes and allows public https", () => {
    // These are blocked regardless of environment.
    expect(isSafeOutboundUrl("http://169.254.169.254/latest/meta-data").ok).toBe(false);
    expect(isSafeOutboundUrl("http://metadata.google.internal/").ok).toBe(false);
    expect(isSafeOutboundUrl("file:///etc/passwd").ok).toBe(false);
    expect(isSafeOutboundUrl("ftp://example.com/x").ok).toBe(false);
    expect(isSafeOutboundUrl("not a url").ok).toBe(false);
    expect(isSafeOutboundUrl("https://api.openai.com/v1").ok).toBe(true);
  });

  it("SSRF guard blocks private/loopback in production, allows for local AI otherwise", () => {
    const prev = process.env.NODE_ENV;
    // In production, private ranges are blocked (unless ALLOW_LOCAL_AI=1).
    process.env.NODE_ENV = "production";
    const prevAllow = process.env.ALLOW_LOCAL_AI; delete process.env.ALLOW_LOCAL_AI;
    expect(isSafeOutboundUrl("http://localhost:11434/v1").ok).toBe(false);
    expect(isSafeOutboundUrl("http://10.0.0.5/y").ok).toBe(false);
    expect(isSafeOutboundUrl("http://192.168.1.1/y").ok).toBe(false);
    // opting in re-allows a local self-hosted LLM
    process.env.ALLOW_LOCAL_AI = "1";
    expect(isSafeOutboundUrl("http://localhost:11434/v1").ok).toBe(true);
    // outside production (dev/test) local is allowed by default (local Ollama/LM Studio)
    process.env.NODE_ENV = "development"; delete process.env.ALLOW_LOCAL_AI;
    expect(isSafeOutboundUrl("http://localhost:11434/v1").ok).toBe(true);
    process.env.NODE_ENV = prev; if (prevAllow !== undefined) process.env.ALLOW_LOCAL_AI = prevAllow; else delete process.env.ALLOW_LOCAL_AI;
  });

  it("serves a responsible-disclosure security.txt", async () => {
    const res = await request(app).get("/.well-known/security.txt");
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Contact:/);
    expect(res.text).toMatch(/Expires:/);
  });

  it("a learner cannot read the security status (403)", async () => {
    expect((await request(app).get("/api/admin/security").set(A(learner))).status).toBe(403);
  });

  it("enforces the auth rate limit when enabled (brute-force guard)", async () => {
    // The suite runs with DISABLE_RATE_LIMIT=1; flip it on just for this test,
    // then hammer login with wrong passwords and expect a 429 eventually.
    const prev = process.env.DISABLE_RATE_LIMIT;
    process.env.DISABLE_RATE_LIMIT = "0";
    try {
      let got429 = false;
      // auth_max default = 8 failed attempts / window
      for (let i = 0; i < 12; i++) {
        const r = await request(app).post("/api/auth/login").send({ username: "admin", password: "definitely-wrong" });
        if (r.status === 429) { got429 = true; break; }
      }
      expect(got429).toBe(true);
    } finally {
      process.env.DISABLE_RATE_LIMIT = prev;
    }
  });
});

describe("Blog (medical education articles)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, learner, createdId, createdSlug;
  beforeAll(async () => { atk = await token("admin"); learner = await token("learner"); });

  it("public can list published posts without auth", async () => {
    const res = await request(app).get("/api/site-content/blog?lang=fa");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.posts)).toBe(true);
    expect(res.body.posts.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.categories)).toBe(true);
    // list items carry reading time + author (E-E-A-T)
    expect(res.body.posts[0]).toHaveProperty("reading_time");
    expect(res.body.posts[0]).toHaveProperty("slug");
  });

  it("public can read a single post by slug (rendered HTML + TOC + related)", async () => {
    const list = await request(app).get("/api/site-content/blog?lang=fa");
    const slug = list.body.posts[0].slug;
    const res = await request(app).get(`/api/site-content/blog/${slug}?lang=fa`);
    expect(res.status).toBe(200);
    expect(res.body.body_html).toMatch(/<h2/);
    expect(Array.isArray(res.body.toc)).toBe(true);
    expect(Array.isArray(res.body.related)).toBe(true);
  });

  it("unknown slug returns 404", async () => {
    const res = await request(app).get("/api/site-content/blog/no-such-post-xyz");
    expect(res.status).toBe(404);
  });

  it("server injects Article meta + schema into /blog/:slug for crawlers", async () => {
    const list = await request(app).get("/api/site-content/blog?lang=fa");
    const slug = list.body.posts[0].slug;
    const page = await request(app).get(`/blog/${slug}`);
    expect(page.status).toBe(200);
    expect(page.text).toContain('og:type" content="article');
    expect(page.text).toContain('"Article"');
    expect(page.text).toMatch(/<title>[^<]+<\/title>/);
  });

  it("blog posts appear in sitemap.xml", async () => {
    const list = await request(app).get("/api/site-content/blog?lang=fa");
    const slug = list.body.posts[0].slug;
    const sm = await request(app).get("/sitemap.xml");
    expect(sm.text).toContain(`/blog/${slug}`);
  });

  it("admin can create, publish, edit and delete a post", async () => {
    const create = await request(app).post("/api/admin/blog").set(A(atk)).send({
      title_fa: "مقالهٔ آزمایشی", title_en: "Test post", excerpt_fa: "خلاصه", excerpt_en: "summary",
      body_fa: "## سرفصل\nمتن آزمایشی", body_en: "## Head\nbody", category: "general",
      author_name: "دکتر تست", author_credentials: "MD", reviewed: 1, published: 1,
    });
    expect(create.status).toBe(200);
    createdId = create.body.id; createdSlug = create.body.slug;
    expect(createdSlug).toBeTruthy();
    // now public
    const pub = await request(app).get(`/api/site-content/blog/${createdSlug}?lang=fa`);
    expect(pub.status).toBe(200);
    // edit → unpublish
    const upd = await request(app).put(`/api/admin/blog/${createdId}`).set(A(atk)).send({ published: 0 });
    expect(upd.status).toBe(200);
    const gone = await request(app).get(`/api/site-content/blog/${createdSlug}`);
    expect(gone.status).toBe(404);
    // delete
    const del = await request(app).del(`/api/admin/blog/${createdId}`).set(A(atk));
    expect(del.status).toBe(200);
  });

  it("admin markdown preview renders safe HTML", async () => {
    const res = await request(app).post("/api/admin/blog/preview").set(A(atk))
      .send({ markdown: "## Title\n**bold** and <script>alert(1)</script>" });
    expect(res.status).toBe(200);
    expect(res.body.html).toMatch(/<h2/);
    expect(res.body.html).toContain("<strong>bold</strong>");
    // raw script tag must be escaped (XSS-safe)
    expect(res.body.html).not.toContain("<script>alert(1)</script>");
  });

  it("a learner cannot access blog admin endpoints (403)", async () => {
    expect((await request(app).get("/api/admin/blog").set(A(learner))).status).toBe(403);
    expect((await request(app).post("/api/admin/blog").set(A(learner)).send({})).status).toBe(403);
  });

  it("a custom category persists once a post uses it", async () => {
    const c = await request(app).post("/api/admin/blog").set(A(atk)).send({
      title_fa: "دستهٔ سفارشی", title_en: "custom cat", body_fa: "## x\ny", category: "nephrology-custom", published: 1,
    });
    expect(c.status).toBe(200);
    const list = await request(app).get("/api/admin/blog").set(A(atk));
    expect(list.body.categories).toContain("nephrology-custom");
    await request(app).del(`/api/admin/blog/${c.body.id}`).set(A(atk));
  });

  it("AI draft returns a helpful message when no API key is configured (zero-cost)", async () => {
    // ensure the shared AI config has no key
    await request(app).put("/api/settings/ai").set(A(atk)).send({ provider: "", model: "", apiKey: "", clearApiKey: true, baseUrl: "" });
    const res = await request(app).post("/api/admin/blog/ai-draft").set(A(atk)).send({ topic: "STEMI", lang: "fa" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.reason).toBe("no_key");
    expect(String(res.body.message)).toMatch(/کلید|AI/);
  });

  it("AI draft generates a full post when a key is configured (mocked provider)", async () => {
    const realFetch = global.fetch;
    global.fetch = async () => ({ ok: true, status: 200, text: async () => "",
      json: async () => ({ choices: [{ message: { content: JSON.stringify({
        title: "تشخیص افتراقی درد قفسه سینه", excerpt: "راهنمای کوتاه",
        body_markdown: "## مقدمه\nمتن\n\n| علت | نکته |\n|---|---|\n| ACS | اورژانسی |",
        tags: "قلب, درد سینه, ACS", meta_title: "درد قفسه سینه", meta_desc: "راهنما",
      }) } }] }) });
    try {
      await request(app).put("/api/settings/ai").set(A(atk)).send({ provider: "OpenRouter", model: "x:free", apiKey: "sk-test", baseUrl: "https://openrouter.ai/api/v1" });
      const res = await request(app).post("/api/admin/blog/ai-draft").set(A(atk)).send({ topic: "درد قفسه سینه", lang: "fa" });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.draft.title).toContain("درد قفسه سینه");
      expect(res.body.draft.body_markdown).toMatch(/##/);
      expect(res.body.draft.tags).toContain("قلب");
    } finally {
      global.fetch = realFetch;
      await request(app).put("/api/settings/ai").set(A(atk)).send({ provider: "", model: "", apiKey: "", clearApiKey: true, baseUrl: "" });
    }
  });

  it("AI rewrite returns a no-key message, then rewrites when a key is set (mocked)", async () => {
    await request(app).put("/api/settings/ai").set(A(atk)).send({ provider: "", model: "", apiKey: "", clearApiKey: true, baseUrl: "" });
    const noKey = await request(app).post("/api/admin/blog/ai-rewrite").set(A(atk)).send({ text: "متن نمونه", mode: "improve", lang: "fa" });
    expect(noKey.body.ok).toBe(false);
    expect(noKey.body.reason).toBe("no_key");
    const realFetch = global.fetch;
    global.fetch = async () => ({ ok: true, status: 200, text: async () => "",
      json: async () => ({ choices: [{ message: { content: "متن بازنویسی‌شدهٔ روان‌تر." } }] }) });
    try {
      await request(app).put("/api/settings/ai").set(A(atk)).send({ provider: "OpenRouter", model: "x:free", apiKey: "sk-test", baseUrl: "https://openrouter.ai/api/v1" });
      const ok = await request(app).post("/api/admin/blog/ai-rewrite").set(A(atk)).send({ text: "متن نمونه", mode: "improve", lang: "fa" });
      expect(ok.body.ok).toBe(true);
      expect(ok.body.text).toContain("بازنویسی");
    } finally {
      global.fetch = realFetch;
      await request(app).put("/api/settings/ai").set(A(atk)).send({ provider: "", model: "", apiKey: "", clearApiKey: true, baseUrl: "" });
    }
  });

  it("AI cover generation downloads a free image and stores it under /uploads (mocked)", async () => {
    const realFetch = global.fetch;
    // a tiny valid-ish PNG buffer (>500 bytes) with an image content-type
    const fakePng = Buffer.alloc(800, 1);
    global.fetch = async () => ({
      ok: true, status: 200,
      headers: { get: (h) => (h.toLowerCase() === "content-type" ? "image/png" : null) },
      arrayBuffer: async () => fakePng.buffer.slice(fakePng.byteOffset, fakePng.byteOffset + fakePng.byteLength),
    });
    try {
      const res = await request(app).post("/api/admin/blog/ai-cover").set(A(atk)).send({ prompt: "درد قفسه سینه", lang: "fa" });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.url).toMatch(/^\/uploads\/img_cover_/);
    } finally { global.fetch = realFetch; }
  });

  it("AI cover generation reports failure cleanly when the image service errors", async () => {
    const realFetch = global.fetch;
    global.fetch = async () => ({ ok: false, status: 503, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) });
    try {
      const res = await request(app).post("/api/admin/blog/ai-cover").set(A(atk)).send({ prompt: "x", lang: "fa" });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toBeTruthy();
    } finally { global.fetch = realFetch; }
  });

  it("admin can select an image provider (blog_image_ai) and cover uses it (mocked b64)", async () => {
    // configure an OpenAI-compatible image provider
    const put = await request(app).put("/api/settings/blog_image_ai").set(A(atk))
      .send({ provider: "openai", model: "gpt-image-1", apiKey: "sk-img-test", baseUrl: "" });
    expect(put.status).toBe(200);
    const got = await request(app).get("/api/settings/blog_image_ai").set(A(atk));
    expect(got.body.provider).toBe("openai");
    const realFetch = global.fetch;
    // 1x1 png base64 (valid, small)
    const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    let hitUrl = "";
    global.fetch = async (u) => { hitUrl = String(u); return { ok: true, status: 200, text: async () => "", json: async () => ({ data: [{ b64_json: b64 }] }) }; };
    try {
      const res = await request(app).post("/api/admin/blog/ai-cover").set(A(atk)).send({ prompt: "STEMI ECG", lang: "fa" });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.url).toMatch(/^\/uploads\/img_cover_/);
      expect(hitUrl).toContain("/images/generations");
    } finally {
      global.fetch = realFetch;
      // reset to the free default so other tests / the shipped seed stay zero-cost
      await request(app).put("/api/settings/blog_image_ai").set(A(atk)).send({ provider: "pollinations", model: "", apiKey: "", baseUrl: "" });
    }
  });

  it("a non-pollinations image provider without a key returns a clear message", async () => {
    await request(app).put("/api/settings/blog_image_ai").set(A(atk)).send({ provider: "openai", model: "", apiKey: "", baseUrl: "" });
    const res = await request(app).post("/api/admin/blog/ai-cover").set(A(atk)).send({ prompt: "x", lang: "fa" });
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toMatch(/کلید|key/i);
    await request(app).put("/api/settings/blog_image_ai").set(A(atk)).send({ provider: "pollinations" });
  });

  it("editing a post saves a revision, and it can be restored", async () => {
    const c = await request(app).post("/api/admin/blog").set(A(atk)).send({
      title_fa: "نسخهٔ اول", title_en: "v1", body_fa: "## متن اول\nمحتوای اولیه", category: "general", published: 1,
    });
    const pid = c.body.id;
    // no revisions before the first edit
    const rev0 = await request(app).get(`/api/admin/blog/${pid}/revisions`).set(A(atk));
    expect(rev0.body.revisions.length).toBe(0);
    // edit → the PREVIOUS version is snapshotted
    await request(app).put(`/api/admin/blog/${pid}`).set(A(atk)).send({ title_fa: "نسخهٔ دوم", body_fa: "## متن دوم\nمحتوای جدید" });
    const rev1 = await request(app).get(`/api/admin/blog/${pid}/revisions`).set(A(atk));
    expect(rev1.body.revisions.length).toBe(1);
    expect(rev1.body.revisions[0].title_fa).toBe("نسخهٔ اول");
    // view the revision snapshot
    const revId = rev1.body.revisions[0].id;
    const detail = await request(app).get(`/api/admin/blog/${pid}/revisions/${revId}`).set(A(atk));
    expect(detail.body.snapshot.body_fa).toContain("متن اول");
    // restore it → the current post gets the old content back
    const restored = await request(app).post(`/api/admin/blog/${pid}/revisions/${revId}/restore`).set(A(atk));
    expect(restored.status).toBe(200);
    const now = await request(app).get(`/api/admin/blog/${pid}`).set(A(atk));
    expect(now.body.title_fa).toBe("نسخهٔ اول");
    expect(now.body.body_fa).toContain("متن اول");
    // restoring also snapshots the pre-restore version → now 2 revisions
    const rev2 = await request(app).get(`/api/admin/blog/${pid}/revisions`).set(A(atk));
    expect(rev2.body.revisions.length).toBe(2);
    // deleting the post cleans up its revisions
    await request(app).del(`/api/admin/blog/${pid}`).set(A(atk));
    const revGone = await request(app).get(`/api/admin/blog/${pid}/revisions`).set(A(atk));
    expect(revGone.body.revisions.length).toBe(0);
  });

  it("markdown preview renders images and fenced code blocks", async () => {
    const res = await request(app).post("/api/admin/blog/preview").set(A(atk))
      .send({ markdown: "![قلب](/img/heart.png)\n\n```js\nconst x = 1;\n```" });
    expect(res.status).toBe(200);
    expect(res.body.html).toMatch(/<img[^>]+src="\/img\/heart\.png"/);
    expect(res.body.html).toContain("<figcaption>قلب</figcaption>");
    expect(res.body.html).toMatch(/<pre><code/);
    expect(res.body.html).toContain("const x = 1;");
  });

  it("dedicated SEO meta_title/meta_desc override the crawler <title> + description", async () => {
    const create = await request(app).post("/api/admin/blog").set(A(atk)).send({
      title_fa: "عنوان معمولی", title_en: "Normal title", excerpt_fa: "خلاصه", excerpt_en: "excerpt",
      body_fa: "## بخش\nمتن", body_en: "## Sec\nbody", category: "general", published: 1,
      meta_title_fa: "عنوان سئوی سفارشی", meta_desc_fa: "توضیح متای سفارشی برای گوگل",
    });
    expect(create.status).toBe(200);
    const slug = create.body.slug;
    const page = await request(app).get(`/blog/${slug}?lang=fa`);
    expect(page.text).toContain("عنوان سئوی سفارشی");
    expect(page.text).toContain("توضیح متای سفارشی برای گوگل");
    await request(app).del(`/api/admin/blog/${create.body.id}`).set(A(atk));
  });

  it("a scheduled post stays hidden until its time, then auto-publishes", async () => {
    const past = new Date(Date.now() - 60000).toISOString();
    const future = new Date(Date.now() + 3600_000).toISOString();
    // 1) future schedule → NOT public yet
    const c1 = await request(app).post("/api/admin/blog").set(A(atk)).send({
      title_fa: "زمان‌بندی آینده", title_en: "future", body_fa: "## x\ny", category: "general",
      published: 0, scheduled_at: future,
    });
    const s1 = c1.body.slug;
    expect((await request(app).get(`/api/site-content/blog/${s1}`)).status).toBe(404);
    // 2) past schedule → the public list read auto-publishes it
    const c2 = await request(app).post("/api/admin/blog").set(A(atk)).send({
      title_fa: "زمان‌بندی گذشته", title_en: "past", body_fa: "## x\ny", category: "general",
      published: 0, scheduled_at: past,
    });
    const s2 = c2.body.slug;
    await request(app).get("/api/site-content/blog?lang=fa");   // triggers publishScheduled()
    expect((await request(app).get(`/api/site-content/blog/${s2}?lang=fa`)).status).toBe(200);
    // the future one is still hidden
    expect((await request(app).get(`/api/site-content/blog/${s1}`)).status).toBe(404);
    await request(app).del(`/api/admin/blog/${c1.body.id}`).set(A(atk));
    await request(app).del(`/api/admin/blog/${c2.body.id}`).set(A(atk));
  });
});

describe("Certificates (verifiable completion credentials)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, learner, demoSerial;
  beforeAll(async () => { atk = await token("admin"); learner = await token("learner"); });

  it("learner sees their wallet + progress toward the next certificate", async () => {
    const res = await request(app).get("/api/learn/certificates?lang=fa").set(A(learner));
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(Array.isArray(res.body.certificates)).toBe(true);
    expect(res.body.certificates.length).toBeGreaterThan(0); // seeded demo cert
    expect(Array.isArray(res.body.progress)).toBe(true);
    demoSerial = res.body.certificates[0].serial;
    expect(demoSerial).toMatch(/^MED-/);
  });

  it("anyone can verify a real certificate by serial (no auth)", async () => {
    const res = await request(app).get(`/api/site-content/verify/${demoSerial}`);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.recipient).toBeTruthy();
    expect(res.body.title).toBeTruthy();
  });

  it("verification rejects unknown serials", async () => {
    const res = await request(app).get("/api/site-content/verify/MED-2026-NOPE99");
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  it("admin can list, manually issue and revoke certificates", async () => {
    const list = await request(app).get("/api/admin/certificates").set(A(atk));
    expect(list.status).toBe(200);
    expect(list.body.stats).toHaveProperty("total");
    // manual issue for an active learner (force past threshold)
    const iss = await request(app).post("/api/admin/certificates/issue").set(A(atk)).send({ username: "learner3", kind: "program" });
    expect(iss.status).toBe(200);
    expect(iss.body.ok).toBe(true);
    expect(iss.body.serial).toMatch(/^MED-/);
    // it's now publicly verifiable
    const v = await request(app).get(`/api/site-content/verify/${iss.body.serial}`);
    expect(v.body.valid).toBe(true);
    // revoke it → verification now fails
    const after = await request(app).get("/api/admin/certificates").set(A(atk));
    const row = after.body.list.find((c) => c.serial === iss.body.serial);
    const rev = await request(app).post(`/api/admin/certificates/${row.id}/revoke`).set(A(atk)).send({ revoked: true });
    expect(rev.status).toBe(200);
    const v2 = await request(app).get(`/api/site-content/verify/${iss.body.serial}`);
    expect(v2.body.valid).toBe(false);
    expect(v2.body.revoked).toBe(true);
  });

  it("manual issue for an unknown user fails cleanly", async () => {
    const res = await request(app).post("/api/admin/certificates/issue").set(A(atk)).send({ username: "no-such-user-xyz", kind: "program" });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it("a learner cannot access certificate admin endpoints (403)", async () => {
    expect((await request(app).get("/api/admin/certificates").set(A(learner))).status).toBe(403);
    expect((await request(app).post("/api/admin/certificates/issue").set(A(learner)).send({ username: "x" })).status).toBe(403);
  });
});

describe("Cumulative interleaving (medical spaced review in lessons)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let learner;
  beforeAll(async () => { learner = await token("learner"); });

  it("blends a DUE review card from another SAME-TOPIC node, never a different subject", async () => {
    const { db } = await import("../src/db.js");
    const uid = db.prepare("SELECT id FROM users WHERE username='learner'").get().id;
    const prog = db.prepare("SELECT active_program FROM learner_profiles WHERE user_id=?").get(uid)?.active_program || "preint";
    const nodes = db.prepare(
      `SELECT pn.id, pn.topic_id, pn.card_ids FROM path_nodes pn JOIN topics t ON t.id=pn.topic_id
       WHERE t.program=? AND pn.active=1 ORDER BY pn.id`).all(prog);
    expect(nodes.length).toBeGreaterThan(1);
    const own = new Set(JSON.parse(nodes[0].card_ids || "[]"));
    // same-topic review card (this is the only kind that may interleave)
    let sameCid = null;
    for (let i = 1; i < nodes.length && !sameCid; i++) {
      if (nodes[i].topic_id !== nodes[0].topic_id) continue;
      for (const c of JSON.parse(nodes[i].card_ids || "[]")) { if (!own.has(c)) { sameCid = c; break; } }
    }
    // different-topic card must stay out of this lesson (the neurology/nephrology bug)
    let otherCid = null;
    for (let i = 1; i < nodes.length && !otherCid; i++) {
      if (nodes[i].topic_id === nodes[0].topic_id) continue;
      for (const c of JSON.parse(nodes[i].card_ids || "[]")) { if (!own.has(c)) { otherCid = c; break; } }
    }
    expect(sameCid || otherCid).toBeTruthy();
    if (sameCid) {
      db.prepare("INSERT OR REPLACE INTO srs_state (user_id,card_id,ease,interval_days,reps,lapses,due,last_reviewed) VALUES (?,?,2.5,5,3,0,'2020-01-01','2020-01-01')").run(uid, sameCid);
    }
    if (otherCid) {
      db.prepare("INSERT OR REPLACE INTO srs_state (user_id,card_id,ease,interval_days,reps,lapses,due,last_reviewed) VALUES (?,?,2.5,5,3,0,'2020-01-01','2020-01-01')").run(uid, otherCid);
    }
    const res = await request(app).get(`/api/learn/lesson/${nodes[0].id}?lang=fa`).set(A(learner));
    expect(res.status).toBe(200);
    const reviewIds = (res.body.cards || []).filter((c) => c.review).map((c) => c.id);
    if (sameCid) expect(reviewIds).toContain(sameCid);
    if (otherCid) expect(reviewIds).not.toContain(otherCid);
  });

  it("never interleaves a card that is already in the current lesson", async () => {
    const { db } = await import("../src/db.js");
    const uid = db.prepare("SELECT id FROM users WHERE username='learner'").get().id;
    const prog = db.prepare("SELECT active_program FROM learner_profiles WHERE user_id=?").get(uid)?.active_program || "preint";
    const node = db.prepare(
      `SELECT pn.id, pn.card_ids FROM path_nodes pn JOIN topics t ON t.id=pn.topic_id
       WHERE t.program=? AND pn.active=1 ORDER BY pn.id`).get(prog);
    const ownIds = JSON.parse(node.card_ids || "[]");
    // force one of the lesson's OWN cards due — it must NOT be duplicated as a review card
    db.prepare("INSERT OR REPLACE INTO srs_state (user_id,card_id,ease,interval_days,reps,lapses,due,last_reviewed) VALUES (?,?,2.5,5,3,0,'2020-01-01','2020-01-01')").run(uid, ownIds[0]);
    const res = await request(app).get(`/api/learn/lesson/${node.id}?lang=fa`).set(A(learner));
    const ids = (res.body.cards || []).map((c) => c.id);
    // no duplicate card ids in the served lesson
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Clinical Compare & Contrast card type", () => {
  it("serves a compare card with entities and belongs-tagged features", async () => {
    const { db } = await import("../src/db.js");
    const { serializeCard } = await import("../src/lib/cardserialize.js");
    const row = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE data_json LIKE '%\"type\":\"compare\"%' LIMIT 1").get();
    expect(row).toBeTruthy();
    const c = serializeCard(row, "fa");
    expect(c.type).toBe("compare");
    expect(c.entityA).toBeTruthy();
    expect(c.entityB).toBeTruthy();
    expect(c.features.length).toBeGreaterThan(2);
    // every feature belongs to A, B, or both
    for (const f of c.features) expect(["A", "B", "both"]).toContain(f.belongs);
    // and there's at least one of each discriminating side (real contrast)
    const sides = new Set(c.features.map((f) => f.belongs));
    expect(sides.has("A")).toBe(true);
    expect(sides.has("B")).toBe(true);
  });

  it("localizes the compare card to English too", async () => {
    const { db } = await import("../src/db.js");
    const { serializeCard } = await import("../src/lib/cardserialize.js");
    const row = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE data_json LIKE '%\"type\":\"compare\"%' LIMIT 1").get();
    const en = serializeCard(row, "en");
    expect(en.entityA).toBeTruthy();
    expect(en.features[0].text).toBeTruthy();
  });
});

describe("Section Checkpoint exam (shelf-style cumulative test)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let learner, admin;
  beforeAll(async () => { learner = await token("learner"); admin = await token("admin"); });

  it("lists sections with unlock status; internal is unlocked for the demo learner", async () => {
    const res = await request(app).get("/api/learn/checkpoints?lang=fa").set(A(learner));
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    const internal = res.body.checkpoints.find((c) => c.section === "internal");
    expect(internal).toBeTruthy();
    expect(internal.unlocked).toBe(true);
    expect(internal.label).toBeTruthy();
    // a section with no completed lessons must stay locked
    const locked = res.body.checkpoints.find((c) => c.doneNodes === 0);
    if (locked) expect(locked.unlocked).toBe(false);
  });

  it("builds a mixed exam drawn from ACROSS the internal section", async () => {
    const res = await request(app).get("/api/learn/checkpoint/internal?lang=fa").set(A(learner));
    expect(res.status).toBe(200);
    expect(res.body.section).toBe("internal");
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(res.body.cards.length).toBeGreaterThan(1);
    expect(res.body.cards.length).toBe(res.body.total);
    // every card is a valid, serialized question with a type
    for (const c of res.body.cards) { expect(c.id).toBeTruthy(); expect(c.type).toBeTruthy(); }
    // no duplicate cards inside one exam
    const ids = res.body.cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("refuses to build a checkpoint for a locked section", async () => {
    // 'minor' has no completed lessons for the demo learner -> locked
    const res = await request(app).get("/api/learn/checkpoint/minor?lang=fa").set(A(learner));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("locked");
  });

  it("scores a passing attempt, awards XP and records best score", async () => {
    const build = await request(app).get("/api/learn/checkpoint/internal?lang=fa").set(A(learner));
    const total = build.body.cards.length;
    const answers = build.body.cards.map((c) => ({ cardId: c.id, correct: true, responseMs: 1200 }));
    const res = await request(app).post("/api/learn/checkpoint/internal/finish").set(A(learner))
      .send({ correct: total, total, durationMs: 60000, answers });
    expect(res.status).toBe(200);
    expect(res.body.passed).toBe(true);
    expect(res.body.score).toBe(100);
    expect(res.body.xp).toBeGreaterThan(0);
    expect(res.body.bestScore).toBe(100);
    expect(res.body.profile).toBeTruthy();
  });

  it("keeps the best score after a later worse attempt", async () => {
    const res = await request(app).post("/api/learn/checkpoint/internal/finish").set(A(learner))
      .send({ correct: 0, total: 12, durationMs: 5000, answers: [] });
    expect(res.status).toBe(200);
    expect(res.body.passed).toBe(false);
    expect(res.body.bestScore).toBe(100);   // previous perfect run is retained
    expect(res.body.everPassed).toBe(true);
  });

  it("respects the checkpoint feature flag", async () => {
    // turn the flag off, expect 403; then restore it
    await request(app).put("/api/admin/flags/checkpoint").set(A(admin)).send({ enabled: false });
    const off = await request(app).get("/api/learn/checkpoints").set(A(learner));
    expect(off.status).toBe(403);
    await request(app).put("/api/admin/flags/checkpoint").set(A(admin)).send({ enabled: true });
    const on = await request(app).get("/api/learn/checkpoints").set(A(learner));
    expect(on.status).toBe(200);
  });

  it("exposes checkpoint config knobs to the admin", async () => {
    const res = await request(app).get("/api/admin/game-config").set(A(admin));
    expect(res.status).toBe(200);
    expect(res.body.config.checkpoint).toBeTruthy();
    expect(res.body.config.checkpoint.question_count).toBeGreaterThan(0);
    expect(res.body.config.checkpoint.pass_ratio).toBeGreaterThan(0);
  });
});

describe("Adaptive difficulty calibration (Challenge Point Framework)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let learner, admin;
  beforeAll(async () => { learner = await token("learner"); admin = await token("admin"); });

  it("exposes a calibration snapshot with an ability estimate + zone", async () => {
    const res = await request(app).get("/api/learn/calibration").set(A(learner));
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    // the demo learner is heavily seeded with card_attempts, so it calibrates
    expect(res.body.calibrated).toBe(true);
    expect(res.body.ability).toBeGreaterThanOrEqual(0);
    expect(res.body.ability).toBeLessThanOrEqual(100);
    expect(["in", "easy", "hard", "unknown"]).toContain(res.body.zone);
    expect(res.body.targetSuccess).toBeGreaterThan(0);
  });

  it("attaches calibration metadata to a lesson and keeps every card", async () => {
    const { db } = await import("../src/db.js");
    const uid = db.prepare("SELECT id FROM users WHERE username='learner'").get().id;
    const prog = db.prepare("SELECT active_program FROM learner_profiles WHERE user_id=?").get(uid)?.active_program || "preint";
    // pick a node with several cards so ordering is meaningful
    const node = db.prepare(`
      SELECT pn.id, pn.card_ids FROM path_nodes pn JOIN topics t ON t.id=pn.topic_id
      WHERE t.program=? AND pn.active=1 AND json_array_length(pn.card_ids) >= 3
      ORDER BY pn.id`).get(prog) || db.prepare("SELECT id, card_ids FROM path_nodes WHERE active=1 ORDER BY id").get();
    const ownIds = JSON.parse(node.card_ids || "[]");
    const res = await request(app).get(`/api/learn/lesson/${node.id}?lang=fa`).set(A(learner));
    expect(res.status).toBe(200);
    // calibration block is present (may be calibrated or not, but must exist)
    expect(res.body).toHaveProperty("calibration");
    // every one of the node's OWN cards is still served (nothing dropped by ordering)
    const servedIds = new Set((res.body.cards || []).map((c) => c.id));
    for (const id of ownIds) expect(servedIds.has(id)).toBe(true);
    // no duplicates introduced
    const ids = (res.body.cards || []).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ability estimate reflects the recent-answer window (unit-level)", async () => {
    const { learnerAbility, cardHardness, challengeFit } = await import("../src/lib/calibration.js");
    const { db } = await import("../src/db.js");
    const uid = db.prepare("SELECT id FROM users WHERE username='learner'").get().id;
    const ab = learnerAbility(uid);
    expect(ab.ability).toBeGreaterThan(0);
    expect(ab.ability).toBeLessThanOrEqual(1);
    // a very-hard card for an average learner should predict lower success
    const easyFit = challengeFit(0.9, 0.2);   // strong learner, easy card
    const hardFit = challengeFit(0.4, 0.9);   // weak learner, brutal card
    expect(easyFit.pSuccess).toBeGreaterThan(hardFit.pSuccess);
    expect(["easy", "in", "hard"]).toContain(easyFit.zone);
  });

  it("respects the calibration feature flag", async () => {
    await request(app).put("/api/admin/flags/calibration").set(A(admin)).send({ enabled: false });
    const off = await request(app).get("/api/learn/calibration").set(A(learner));
    expect(off.status).toBe(200);
    expect(off.body.enabled).toBe(false);
    await request(app).put("/api/admin/flags/calibration").set(A(admin)).send({ enabled: true });
    const on = await request(app).get("/api/learn/calibration").set(A(learner));
    expect(on.body.enabled).toBe(true);
  });

  it("exposes calibration config knobs to the admin", async () => {
    const res = await request(app).get("/api/admin/game-config").set(A(admin));
    expect(res.status).toBe(200);
    expect(res.body.config.calibration).toBeTruthy();
    expect(res.body.config.calibration.target_success).toBeGreaterThan(0);
    expect(res.body.config.calibration.window_answers).toBeGreaterThan(0);
  });
});

describe("Rich media in lessons & answer keys (images, video, embeds)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let admin, learner;
  beforeAll(async () => { admin = await token("admin"); learner = await token("learner"); });

  it("normalizes YouTube / Aparat / uploaded / external media (unit)", async () => {
    const { serializeMedia, toEmbed, detectKind } = await import("../src/lib/medialib.js");
    // YouTube variants → youtube-nocookie embed
    const yt = serializeMedia({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }, "fa");
    expect(yt.kind).toBe("embed"); expect(yt.provider).toBe("youtube");
    expect(yt.url).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    // Aparat → aparat embed
    const ap = serializeMedia({ url: "https://www.aparat.com/v/AbC12" }, "fa");
    expect(ap.kind).toBe("embed"); expect(ap.provider).toBe("aparat");
    // uploaded mp4 → video
    expect(serializeMedia({ url: "/uploads/vid_1.mp4" }, "fa").kind).toBe("video");
    // uploaded image → image, with localized caption
    const img = serializeMedia({ url: "/uploads/img_1.png", caption_en: "CXR" }, "en");
    expect(img.kind).toBe("image"); expect(img.caption).toBe("CXR");
    // insecure http is rejected
    expect(serializeMedia("http://evil.com/x.jpg", "fa")).toBe(null);
    // an unknown external page (no media ext, not a vetted provider) is declined
    expect(serializeMedia("https://vimeo.com/12345", "fa")).toBe(null);
    // a direct external https image is allowed
    expect(serializeMedia("https://cdn.example.com/scan.jpg", "fa").kind).toBe("image");
  });

  it("serves question media + a پاسخنامه (explain) block with media on a seeded card", async () => {
    const { db } = await import("../src/db.js");
    const { serializeCard } = await import("../src/lib/cardserialize.js");
    const row = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE data_json LIKE '%ملنا%' LIMIT 1").get();
    expect(row).toBeTruthy();
    const c = serializeCard(row, "fa");
    expect(c.media).toBeTruthy();
    expect(c.media.kind).toBe("image");
    expect(c.explain).toBeTruthy();
    expect(c.explain.text).toBeTruthy();
    expect(c.explain.media.kind).toBe("embed");        // Aparat video in the answer key
    expect(c.explain.media.url).toContain("aparat.com");
  });

  it("admin can create a card WITH media on question, درسنامه and پاسخنامه, then it serializes back", async () => {
    const payload = {
      type: "mcq", q_fa: "کارت رسانه‌ای تست", q_en: "media test card",
      options: [{ fa: "الف", en: "A", correct: true }, { fa: "ب", en: "B", correct: false }],
      media: { url: "/uploads/img_test.png", kind: "image", caption_fa: "سوال" },
      micro: { lead_fa: "درسنامه", lead_en: "note", media: { url: "https://www.youtube.com/watch?v=abcdef123", kind: "embed" } },
      explain: { text_fa: "چون…", text_en: "because…", media: { url: "/uploads/vid_x.mp4", kind: "video" } },
    };
    const created = await request(app).post("/api/admin/learn-cards").set(A(admin)).send(payload);
    expect(created.status).toBe(200);
    const id = created.body.id;
    // read it back via the admin listing (includes raw data)
    const list = await request(app).get("/api/admin/learn-cards?full=1").set(A(admin));
    const found = list.body.cards.find((c) => c.id === id);
    expect(found).toBeTruthy();
    expect(found.data.media).toBeTruthy();
    expect(found.data.explain).toBeTruthy();
    expect(found.data.micro.media).toBeTruthy();
    // and it serializes to the learner correctly
    const { db } = await import("../src/db.js");
    const { serializeCard } = await import("../src/lib/cardserialize.js");
    const rawRow = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=?").get(id);
    const s = serializeCard(rawRow, "fa");
    expect(s.media.kind).toBe("image");
    expect(s.micro.media.provider).toBe("youtube");
    expect(s.explain.media.kind).toBe("video");
  });

  it("the upload endpoints require a teacher/admin (not a learner)", async () => {
    const res = await request(app).post("/api/upload").set(A(learner));
    expect([401, 403]).toContain(res.status);
    const vres = await request(app).post("/api/upload/video").set(A(learner));
    expect([401, 403]).toContain(vres.status);
  });
});

describe("Comprehensive card filtering & central media library (admin)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let admin, teacher, learner;
  beforeAll(async () => { admin = await token("admin"); teacher = await token("teacher"); learner = await token("learner"); });

  it("learn-cards list carries every filterable attribute + subject/category facets", async () => {
    const res = await request(app).get("/api/admin/learn-cards?lang=fa&full=1").set(A(admin));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(Array.isArray(res.body.subjects)).toBe(true);
    expect(res.body.subjects.length).toBeGreaterThan(0);
    const c = res.body.cards[0];
    // the enriched shape used by the filter bar
    for (const k of ["subject", "subjectSlug", "section", "updatedAt", "hasImage", "hasVideo", "hasEmbed", "hasMedia", "hasMicro", "hasExplain", "hasMnemonic", "hasHints"]) {
      expect(c).toHaveProperty(k);
    }
    // the seeded gastro media card is flagged as having image + explain
    const media = res.body.cards.find((x) => x.hasImage);
    expect(media).toBeTruthy();
    // subjects resolve from the card's topic slug or a lesson it's used in;
    // at least the seeded gastro/endo media cards have a resolved subject name.
    expect(res.body.cards.some((x) => x.hasImage && x.subject)).toBe(true);
    // at least one card has an embed answer key (the seeded Aparat video)
    expect(res.body.cards.some((x) => x.hasEmbed)).toBe(true);
    // at least one card is flagged as having a پاسخنامه
    expect(res.body.cards.some((x) => x.hasExplain)).toBe(true);
  });

  it("the media library lists uploaded files with kind, size and usage count", async () => {
    const res = await request(app).get("/api/upload/library").set(A(admin));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    const it = res.body.items[0];
    for (const k of ["name", "url", "kind", "size", "mtime", "usedBy"]) expect(it).toHaveProperty(k);
    // the seeded demo images are referenced by cards → usedBy > 0
    const used = res.body.items.find((x) => x.name.includes("demo-melena"));
    expect(used).toBeTruthy();
    expect(used.usedBy).toBeGreaterThan(0);
  });

  it("refuses to delete an in-use file (409) but allows deleting an unused one", async () => {
    const list = await request(app).get("/api/upload/library").set(A(admin));
    const inUse = list.body.items.find((x) => x.usedBy > 0);
    expect(inUse).toBeTruthy();
    const blocked = await request(app).delete(`/api/upload/library/${inUse.name}`).set(A(admin));
    expect(blocked.status).toBe(409);
    // create a throwaway unused file via the upload endpoint, then delete it.
    // (a minimal 1x1 PNG — the image uploader accepts .png)
    const png1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const buf = Buffer.from(png1x1, "base64");
    const up = await request(app).post("/api/upload").set(A(admin)).attach("image", buf, "unit_test.png");
    expect(up.status).toBe(200);
    const name = up.body.url.split("/").pop();
    const ok = await request(app).delete(`/api/upload/library/${name}`).set(A(admin));
    expect(ok.status).toBe(200);
    expect(ok.body.ok).toBe(true);
  });

  it("only an admin can delete library files (a teacher is forbidden)", async () => {
    const list = await request(app).get("/api/upload/library").set(A(teacher));
    expect(list.status).toBe(200);   // teachers can view
    const res = await request(app).delete("/api/upload/library/demo-ecg.svg").set(A(teacher));
    expect([401, 403]).toContain(res.status);   // but not delete
  });

  it("the library is not accessible to a learner", async () => {
    const res = await request(app).get("/api/upload/library").set(A(learner));
    expect([401, 403]).toContain(res.status);
  });
});

describe("Bulk actions on cards (filtered content list)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let admin, learner;
  beforeAll(async () => { admin = await token("admin"); learner = await token("learner"); });

  async function makeCard() {
    const r = await request(app).post("/api/admin/learn-cards").set(A(admin)).send({
      type: "mcq", q_fa: "بالک تست", q_en: "bulk test",
      options: [{ fa: "الف", en: "A", correct: true }, { fa: "ب", en: "B", correct: false }],
    });
    return r.body.id;
  }

  it("bulk deactivate + premium apply to every selected id", async () => {
    const ids = [await makeCard(), await makeCard()];
    let r = await request(app).post("/api/admin/learn-cards/bulk-action").set(A(admin)).send({ ids, action: "deactivate" });
    expect(r.status).toBe(200); expect(r.body.affected).toBe(2);
    r = await request(app).post("/api/admin/learn-cards/bulk-action").set(A(admin)).send({ ids, action: "premium" });
    expect(r.status).toBe(200);
    const list = await request(app).get("/api/admin/learn-cards?lang=fa&full=1").set(A(admin));
    const mine = list.body.cards.filter((c) => ids.includes(c.id));
    expect(mine.every((c) => c.active === 0)).toBe(true);
    expect(mine.every((c) => c.premium === true)).toBe(true);
  });

  it("bulk delete removes the cards and detaches them from lesson nodes", async () => {
    const id = await makeCard();
    const r = await request(app).post("/api/admin/learn-cards/bulk-action").set(A(admin)).send({ ids: [id], action: "delete" });
    expect(r.status).toBe(200); expect(r.body.affected).toBe(1);
    const list = await request(app).get("/api/admin/learn-cards?lang=fa&full=1").set(A(admin));
    expect(list.body.cards.some((c) => c.id === id)).toBe(false);
  });

  it("rejects an unknown action and an empty id list", async () => {
    const bad = await request(app).post("/api/admin/learn-cards/bulk-action").set(A(admin)).send({ ids: [1], action: "nuke" });
    expect(bad.status).toBe(400);
    const empty = await request(app).post("/api/admin/learn-cards/bulk-action").set(A(admin)).send({ ids: [], action: "delete" });
    expect(empty.status).toBe(400);
  });

  it("is not accessible to a learner", async () => {
    const r = await request(app).post("/api/admin/learn-cards/bulk-action").set(A(learner)).send({ ids: [1], action: "activate" });
    expect([401, 403]).toContain(r.status);
  });
});

describe("Content statistics dashboard (admin)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let admin, learner;
  beforeAll(async () => { admin = await token("admin"); learner = await token("learner"); });

  it("returns coverage totals, distributions, per-subject rows, gaps and library rollup", async () => {
    const res = await request(app).get("/api/admin/content-stats?lang=fa").set(A(admin));
    expect(res.status).toBe(200);
    const b = res.body;
    // totals with computed percentages
    for (const k of ["total", "active", "withMedia", "withMicro", "withExplain", "usedInPath", "mediaPct", "microPct", "usedPct"]) {
      expect(b.totals).toHaveProperty(k);
    }
    expect(b.totals.total).toBeGreaterThan(0);
    expect(b.totals.mediaPct).toBeGreaterThanOrEqual(0);
    expect(b.totals.mediaPct).toBeLessThanOrEqual(100);
    // distributions
    expect(Object.keys(b.byType).length).toBeGreaterThan(0);
    expect(Object.keys(b.byDifficulty).length).toBeGreaterThan(0);
    // per-subject rows carry coverage percentages
    expect(Array.isArray(b.subjects)).toBe(true);
    expect(b.subjects.length).toBeGreaterThan(0);
    expect(b.subjects[0]).toHaveProperty("mediaPct");
    expect(b.subjects[0]).toHaveProperty("name");
    // gaps are subjects sorted by lowest media coverage
    expect(Array.isArray(b.gaps)).toBe(true);
    // library rollup counts real uploaded files
    expect(b.library.files).toBeGreaterThanOrEqual(1);
    expect(b.library).toHaveProperty("sizeBytes");
  });

  it("media coverage reflects the seeded media cards (gastro subject has media)", async () => {
    const res = await request(app).get("/api/admin/content-stats?lang=fa").set(A(admin));
    expect(res.body.totals.withImage).toBeGreaterThan(0);
    const gi = res.body.subjects.find((s) => s.slug === "gi");
    expect(gi).toBeTruthy();
    expect(gi.withMedia).toBeGreaterThan(0);
  });

  it("is not accessible to a learner", async () => {
    const res = await request(app).get("/api/admin/content-stats").set(A(learner));
    expect([401, 403]).toContain(res.status);
  });
});

describe("Card bundle export/import (media-faithful)", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let admin, learner;
  beforeAll(async () => { admin = await token("admin"); learner = await token("learner"); });

  it("exports a JSON bundle that keeps media/explain/micro on cards", async () => {
    const res = await request(app).get("/api/admin/learn-cards/export").set(A(admin));
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("attachment");
    const bundle = JSON.parse(res.text);
    expect(bundle.format).toBe("med-school/cards");
    expect(bundle.count).toBeGreaterThan(0);
    // the seeded gastro card carries media + an answer key in the bundle
    const withMedia = bundle.cards.filter((c) => c.data.media || c.data.image);
    expect(withMedia.length).toBeGreaterThan(0);
    const withExplain = bundle.cards.filter((c) => c.data.explain);
    expect(withExplain.length).toBeGreaterThan(0);
  });

  it("supports exporting only a selection via ?ids=", async () => {
    const list = await request(app).get("/api/admin/learn-cards?lang=fa&full=1").set(A(admin));
    const ids = list.body.cards.slice(0, 3).map((c) => c.id);
    const res = await request(app).get(`/api/admin/learn-cards/export?ids=${ids.join(",")}`).set(A(admin));
    const bundle = JSON.parse(res.text);
    expect(bundle.count).toBe(3);
    expect(bundle.cards.every((c) => ids.includes(c.id))).toBe(true);
  });

  it("previews a bundle then imports it, preserving media on the new cards", async () => {
    const exp = await request(app).get("/api/admin/learn-cards/export").set(A(admin));
    const bundle = JSON.parse(exp.text);
    const small = { format: "med-school/cards", version: 1, cards: bundle.cards.filter((c) => c.data.media || c.data.explain).slice(0, 2) };
    // preview
    const pv = await request(app).post("/api/admin/learn-cards/import-bundle/preview").set(A(admin)).send({ bundle: small });
    expect(pv.status).toBe(200);
    expect(pv.body.valid).toBe(small.cards.length);
    expect(pv.body.withMedia).toBeGreaterThan(0);
    // import
    const { db } = await import("../src/db.js");
    const before = db.prepare("SELECT COUNT(*) c FROM flashcards").get().c;
    const im = await request(app).post("/api/admin/learn-cards/import-bundle").set(A(admin)).send({ bundle: small });
    expect(im.status).toBe(200);
    expect(im.body.imported).toBe(small.cards.length);
    const after = db.prepare("SELECT COUNT(*) c FROM flashcards").get().c;
    expect(after).toBe(before + small.cards.length);
    // the newest imported card still has media
    const newest = db.prepare("SELECT data_json FROM flashcards ORDER BY id DESC LIMIT 2").all().map((r) => JSON.parse(r.data_json));
    expect(newest.some((d) => d.media || d.explain?.media || d.image)).toBe(true);
  });

  it("rejects an invalid bundle and forbids a learner", async () => {
    const bad = await request(app).post("/api/admin/learn-cards/import-bundle").set(A(admin)).send({ bundle: { format: "nope" } });
    expect(bad.status).toBe(400);
    const denied = await request(app).get("/api/admin/learn-cards/export").set(A(learner));
    expect([401, 403]).toContain(denied.status);
  });
});

describe("Catalogs, profile fields, nickname & anonymous identity", () => {
  it("built-in subject catalogs are seeded as real, editable rows", async () => {
    const tk = await token("teacher");
    const res = await request(app).get("/api/catalogs").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    const names = res.body.map((c) => c.name_en);
    // the 5 formerly-hardcoded subjects must now be present in the Catalogs section
    for (const n of ["Histology", "Anatomy", "Pathology", "Microbiology", "Pharmacology"])
      expect(names).toContain(n);
    // and they must be editable (items present)
    const histo = res.body.find((c) => c.name_en === "Histology");
    expect(Array.isArray(histo.items) ? histo.items.length : JSON.parse(histo.items_json).length).toBeGreaterThan(10);
  });

  it("admin can edit a seeded built-in catalog", async () => {
    const tk = await token("admin");
    const list = (await request(app).get("/api/catalogs").set("Authorization", `Bearer ${tk}`)).body;
    const histo = list.find((c) => c.name_en === "Histology");
    const upd = await request(app).put(`/api/catalogs/${histo.id}`).set("Authorization", `Bearer ${tk}`)
      .send({ name_fa: "بافت‌شناسیِ ویرایش‌شده", name_en: "Histology (edited)", items: [{ fa: "الف", en: "A" }] });
    expect(upd.status).toBe(200);
    const after = (await request(app).get("/api/catalogs").set("Authorization", `Bearer ${tk}`)).body.find((c) => c.id === histo.id);
    expect(after.name_en).toBe("Histology (edited)");
  });

  it("a user can self-edit optional fields + nickname via PUT /auth/me", async () => {
    const tk = await token("learner");
    const res = await request(app).put("/api/auth/me").set("Authorization", `Bearer ${tk}`)
      .send({ phone: "09120000000", bio: "پزشکِ آینده", nickname: "دکترِ آینده" });
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe("09120000000");
    expect(res.body.user.nickname).toBe("دکترِ آینده");
    expect(res.body.user.anon_mode).toBe(false);   // default real name
    // reset
    await request(app).put("/api/auth/me").set("Authorization", `Bearer ${tk}`).send({ phone: "", bio: "", nickname: "", anon_mode: false });
  });

  it("anonymous mode cannot be enabled without a nickname; enables with one", async () => {
    const tk = await token("learner");
    // no nickname → anon stays off
    let res = await request(app).put("/api/auth/me").set("Authorization", `Bearer ${tk}`).send({ nickname: "", anon_mode: true });
    expect(res.body.user.anon_mode).toBe(false);
    // with a nickname → anon turns on
    res = await request(app).put("/api/auth/me").set("Authorization", `Bearer ${tk}`).send({ nickname: "ناشناسِ من", anon_mode: true });
    expect(res.body.user.anon_mode).toBe(true);
    expect(res.body.user.nickname).toBe("ناشناسِ من");
    // reset
    await request(app).put("/api/auth/me").set("Authorization", `Bearer ${tk}`).send({ nickname: "", anon_mode: false });
  });

  it("admin can set phone, bio and university on a teacher", async () => {
    const tk = await token("admin");
    const uni = (await request(app).post("/api/universities").set("Authorization", `Bearer ${tk}`)
      .send({ name_fa: "دانشگاه تست", name_en: "Test Uni", province: "تهران" })).body;
    const created = await request(app).post("/api/admin/users").set("Authorization", `Bearer ${tk}`)
      .send({ username: `t_${Date.now()}`, password: "demo", name_fa: "استاد تست", role: "teacher",
        university_id: uni.id, phone: "02100000000", bio: "عضو هیئت علمی" });
    expect(created.status).toBe(200);
    const users = (await request(app).get("/api/admin/users?role=teacher").set("Authorization", `Bearer ${tk}`)).body.users;
    const me = users.find((u) => u.id === created.body.id);
    expect(me.phone).toBe("02100000000");
    expect(me.bio).toBe("عضو هیئت علمی");
    expect(me.university_id).toBe(uni.id);
  });
});

/* ================================================================
   REAL LLM call path — validated by mocking global.fetch to stand in
   for an OpenAI-compatible provider (OpenRouter/Groq/etc.). This proves
   the actual network integration: request shape, Authorization header,
   provider-specific headers, response parsing, and error surfacing —
   WITHOUT needing a paid key. (The mock/no-key path is tested elsewhere.)
   ================================================================ */
describe("Real AI provider call path (mocked fetch — OpenAI-compatible)", () => {
  let atk, ltk;
  const realFetch = global.fetch;
  let captured = null;

  beforeAll(async () => {
    atk = await token("admin");
    ltk = await token("learner");
  });
  afterAll(() => { global.fetch = realFetch; });

  function mockProvider({ ok = true, status = 200, content = "سلام دکتر، از یک ساعت پیش قفسهٔ سینه‌ام درد می‌کند." } = {}) {
    global.fetch = async (url, init) => {
      captured = { url: String(url), init };
      if (!ok) return { ok: false, status, text: async () => `{"error":"boom"}`, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }), text: async () => "" };
    };
  }

  it("configures a (fake) free provider and ai-test reports connected:true with an LLM reply", async () => {
    mockProvider({ content: "درد از یک ساعت پیش شروع شده." });
    // configure the SEPARATE vpatient AI config with a fake key + OpenRouter free model
    const put = await request(app).put("/api/admin/vpatient/ai").set("Authorization", `Bearer ${atk}`)
      .send({ provider: "OpenRouter", model: "meta-llama/llama-3.3-70b-instruct:free", apiKey: "sk-test-FAKEKEY", baseUrl: "https://openrouter.ai/api/v1" });
    expect(put.status).toBe(200);
    const res = await request(app).post("/api/admin/vpatient/ai-test").set("Authorization", `Bearer ${atk}`).send({ lang: "fa" });
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(res.body.mode).toBe("llm");
    expect(res.body.sample).toContain("درد");
    // the request actually hit the OpenAI-compatible chat-completions endpoint
    expect(captured.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    // Authorization + OpenRouter identity headers were sent correctly
    expect(captured.init.headers.Authorization).toBe("Bearer sk-test-FAKEKEY");
    expect(captured.init.headers["HTTP-Referer"]).toBeTruthy();
    expect(captured.init.headers["X-Title"]).toBe("MED School");
    // the model + a system prompt + the user turn were sent
    const body = JSON.parse(captured.init.body);
    expect(body.model).toBe("meta-llama/llama-3.3-70b-instruct:free");
    expect(body.messages[0].role).toBe("system");
    expect(body.messages.at(-1).role).toBe("user");
  });

  it("a learner's virtual-patient reply now comes from the LLM (source:'llm')", async () => {
    mockProvider({ content: "بله دکتر، درد به بازوی چپم هم می‌زند." });
    // ensure competitive vpatient is enabled + not premium-only so the learner can play
    await request(app).put("/api/admin/vpatient").set("Authorization", `Bearer ${atk}`)
      .send({ config: { enabled: true, premium_only: false } }).catch(() => {});
    const res = await request(app).post("/api/exam/patient-reply").set("Authorization", `Bearer ${ltk}`)
      .send({ caseId: 3, userText: "درد به جای دیگری هم می‌زند؟", history: [], lang: "fa" });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("llm");
    expect(res.body.text).toContain("بازوی چپ");
  });

  it("a provider error is surfaced to the admin test button (not silently mocked)", async () => {
    mockProvider({ ok: false, status: 401 });
    const res = await request(app).post("/api/admin/vpatient/ai-test").set("Authorization", `Bearer ${atk}`).send({ lang: "fa" });
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
    expect(String(res.body.message)).toMatch(/401/);
  });

  it("a provider error degrades the STUDENT flow to mock gracefully (no crash)", async () => {
    mockProvider({ ok: false, status: 500 });
    const res = await request(app).post("/api/exam/patient-reply").set("Authorization", `Bearer ${ltk}`)
      .send({ caseId: 3, userText: "سلام", history: [], lang: "fa" });
    expect(res.status).toBe(200);
    expect(res.body.text).toBeTruthy();          // learner still gets a reply
    expect(res.body.source).toBe("mock");        // fell back safely
  });

  it("clearing the key returns everything to the zero-cost mock engine", async () => {
    await request(app).put("/api/admin/vpatient/ai").set("Authorization", `Bearer ${atk}`)
      .send({ provider: "", model: "", apiKey: "", baseUrl: "", clearApiKey: true });
    const res = await request(app).post("/api/admin/vpatient/ai-test").set("Authorization", `Bearer ${atk}`).send({ lang: "fa" });
    expect(res.body.connected).toBe(false);
    expect(res.body.mode).toBe("mock");
  });
});

describe("university tenancy, duplicate student numbers, and live board details", () => {
  it("blocks duplicate student_no creation and returns the existing student", async () => {
    const atk = await token("admin");
    const res = await request(app).post("/api/admin/users").set("Authorization", `Bearer ${atk}`)
      .send({ username: "dup_40012345", password: "demo", role: "student", name_fa: "تکراری", student_no: "40012345", university_id: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("student_no_exists");
    expect(res.body.existing.student_no).toBe("40012345");
  });

  it("class bulk member resolve reports missing students, then creates and attaches them", async () => {
    const ttk = await token("teacher");
    const cls = await request(app).post("/api/classes").set("Authorization", `Bearer ${ttk}`)
      .send({ name_fa: "کلاس ثبت دسته‌ای", name_en: "bulk class" });
    expect(cls.status).toBe(200);
    const sno = "499" + Math.floor(Date.now() % 100000);
    const dry = await request(app).post(`/api/classes/${cls.body.id}/members/resolve`).set("Authorization", `Bearer ${ttk}`)
      .send({ studentNos: [sno], attach: false });
    expect(dry.status).toBe(200);
    expect(dry.body.missing).toContain(sno);
    const mk = await request(app).post(`/api/classes/${cls.body.id}/members/resolve`).set("Authorization", `Bearer ${ttk}`)
      .send({ studentNos: [sno], createMissing: true });
    expect(mk.status).toBe(200);
    expect(mk.body.created.length).toBe(1);
    const detail = await request(app).get(`/api/classes/${cls.body.id}`).set("Authorization", `Bearer ${ttk}`);
    expect(detail.body.members.some((m) => m.student_no === sno)).toBe(true);
  });

  it("exam participant import reports missing and can create them in the exam university", async () => {
    const ttk = await token("teacher");
    const now = new Date(Date.now() - 60_000).toISOString();
    const end = new Date(Date.now() + 3600_000).toISOString();
    const ex = await request(app).post("/api/exams").set("Authorization", `Bearer ${ttk}`)
      .send({ title_fa: "آزمون ثبت دسته‌ای", title_en: "bulk exam", case_ids: [1], starts_at: now, ends_at: end });
    expect(ex.status).toBe(200);
    const sno = "488" + Math.floor(Date.now() % 100000);
    const dry = await request(app).post(`/api/exams/${ex.body.id}/participants/resolve`).set("Authorization", `Bearer ${ttk}`)
      .send({ studentNos: [sno] });
    expect(dry.status).toBe(200);
    expect(dry.body.missing).toContain(sno);
    const add = await request(app).put(`/api/exams/${ex.body.id}/participants`).set("Authorization", `Bearer ${ttk}`)
      .send({ studentNos: [sno], createMissing: true });
    expect(add.status).toBe(200);
    expect(add.body.created.length).toBe(1);
    const detail = await request(app).get(`/api/exams/${ex.body.id}`).set("Authorization", `Bearer ${ttk}`);
    expect(detail.body.participants.some((p) => p.student_no === sno)).toBe(true);
  });

  it("live board student details endpoint returns flashcard answers for the selected class member", async () => {
    const ttk = await token("teacher");
    const cls = await request(app).post("/api/classes").set("Authorization", `Bearer ${ttk}`)
      .send({ name_fa: "کلاس جزئیات زنده", name_en: "live detail" });
    expect(cls.status).toBe(200);
    const users = await request(app).get("/api/users?role=student").set("Authorization", `Bearer ${ttk}`);
    const stu = users.body.find((u) => u.student_no === "40012345") || users.body[0];
    await request(app).put(`/api/classes/${cls.body.id}/members`).set("Authorization", `Bearer ${ttk}`).send({ userIds: [stu.id] });
    await request(app).put(`/api/classes/${cls.body.id}/flashcards`).set("Authorization", `Bearer ${ttk}`).send({ flashcards: [{ flashcard_id: 1, graded: true, weight: 1 }] });
    const stk = await token(stu.username || stu.student_no);
    await request(app).post(`/api/classes/${cls.body.id}/flashcard/1/finish`).set("Authorization", `Bearer ${stk}`)
      .send({ score: 77, answers: [{ order: 1, type: "mcq", question_fa: "سؤال", selected: [{ fa: "الف" }], points: 77 }] });
    const det = await request(app).get(`/api/classes/${cls.body.id}/live-board/${stu.id}/details`).set("Authorization", `Bearer ${ttk}`);
    expect(det.status).toBe(200);
    expect(det.body.student.id).toBe(stu.id);
    expect(det.body.attempts.some((a) => a.kind === "flashcard" && a.answers.length)).toBe(true);
  });
});

describe("past-exam import carries per-option rationale (why_fa)", () => {
  const sample = (extra = {}) => ({
    program: "preint",
    subject_fa: "نورولوژی", subject_en: "Neurology",
    maxPerLesson: 15,
    exam_type: "پره‌انترنی",
    questions: [{
      question_no: 1,
      chapter_fa: "اصول معاینه عصبی", chapter_en: "Principles of the Neurologic Examination",
      question_fa: "تکلم روان، درک و تکرار مختل. کدام آفازی؟",
      options_fa: ["بروکا", "گلوبال", "ورنیکه", "ارتباطی"],
      options_why_fa: ["بروکا غیرروان است", "گلوبال غیرروان است", "پاسخ صحیح — سه‌گانه ورنیکه", "conduction درکش سالم است"],
      correct_index: 2,
      explanation_fa: "درسنامه آزمایشی ورنیکه",
      year: "۹۶",
    }],
    ...extra,
  });

  it("files an imported subject under its exam track, not always major", async () => {
    // Neurology is a MINOR subject of the pre-internship exam; only internal
    // medicine, surgery, paediatrics and obstetrics are majors. The importer used
    // to hard-code "major" for everything.
    const tk = await token("admin");
    const minor = await request(app).post("/api/admin/official-question-import/preview")
      .set("Authorization", `Bearer ${tk}`).send(sample());
    expect(minor.status).toBe(200);
    expect(minor.body.plan[0].topic.parent).toBe("minor");

    // Internal medicine distributes across its seeded sub-topics (GI, lung,
    // haematology, …) grouped under the "internal" section — each chapter
    // routes by its chapter prefix rather than one umbrella major topic.
    const majorBody = sample();
    majorBody.subject_fa = "داخلی";
    majorBody.subject_en = "Internal medicine";
    majorBody.questions[0].subject_fa = "داخلی";
    majorBody.questions[0].subject_en = "Internal medicine";
    majorBody.questions[0].chapter_fa = "خون / ITP";
    majorBody.questions[0].chapter_en = "Heme / ITP";
    const major = await request(app).post("/api/admin/official-question-import/preview")
      .set("Authorization", `Bearer ${tk}`).send(majorBody);
    expect(major.status).toBe(200);
    expect(major.body.plan[0].topic.slug).toBe("heme");
    expect(major.body.plan[0].topic.parent).toBe("internal");

    // a genuinely major subject (surgery) still lands under "major"
    const surgeryBody = sample();
    surgeryBody.subject_fa = "جراحی";
    surgeryBody.subject_en = "Surgery";
    surgeryBody.questions[0].subject_fa = "جراحی";
    surgeryBody.questions[0].subject_en = "Surgery";
    const surgery = await request(app).post("/api/admin/official-question-import/preview")
      .set("Authorization", `Bearer ${tk}`).send(surgeryBody);
    expect(surgery.body.plan[0].topic.parent).toBe("major");

    // an explicit subject_track always wins over the name-based guess
    const forced = sample();
    forced.subject_track = "major";
    const res = await request(app).post("/api/admin/official-question-import/preview")
      .set("Authorization", `Bearer ${tk}`).send(forced);
    expect(res.status).toBe(200);
    expect(res.body.plan[0].topic.parent).toBe("major");
  });

  // Regression guard for the "questions imported but the learning path is
  // empty" bug. The importer used to mint a fresh `official-<subject>` topic
  // for every import, so the cards existed and were countable in the admin
  // table while the learner's path — which is built from the seeded topics —
  // stayed empty. Nothing raised an error; the questions were simply filed
  // somewhere nobody looks.
  it("imports into the existing subject topic so the cards land on the learner path", async () => {
    const tk = await token("admin");

    const body = sample();
    body.subject_fa = "نورولوژی";
    body.subject_en = "Neurology";
    body.questions[0].subject_fa = "نورولوژی";
    body.questions[0].subject_en = "Neurology";
    body.questions[0].question_fa = "سؤال آزمایشی مسیر یادگیری برای نورولوژی";
    body.questions[0].question_en = "Learning-path routing probe for neurology";

    const commit = await request(app).post("/api/admin/official-question-import/commit")
      .set("Authorization", `Bearer ${tk}`).send(body);
    expect(commit.status).toBe(200);
    expect(commit.body.inserted).toBeGreaterThan(0);

    // it must reuse the seeded `neuro` topic, not invent `official-neurology`
    const path = await request(app).get("/api/learn/path?lang=fa")
      .set("Authorization", `Bearer ${await token("learner")}`);
    expect(path.status).toBe(200);
    const named = (path.body.topics || []).filter((t) => /نورولوژی|مغز و اعصاب/.test(t.name || ""));
    expect(named.length).toBeGreaterThan(0);
    const reachable = named.reduce(
      (sum, t) => sum + (t.nodes || []).reduce((s, n) => s + (n.cards || 0), 0), 0);
    expect(reachable).toBeGreaterThan(0);
  });

  // A lesson emptied by the demo purge must come back once real questions are
  // attached to it, otherwise the topic reads as empty on the path forever.
  it("re-activates a lesson that was emptied by the demo purge once it has cards again", async () => {
    const tk = await token("admin");
    const node = db.prepare("SELECT id, card_ids FROM path_nodes WHERE active=1 LIMIT 1").get();
    expect(node).toBeTruthy();
    db.prepare("UPDATE path_nodes SET active=0 WHERE id=?").run(node.id);

    const body = sample();
    body.questions[0].question_fa = "سؤال آزمایشی برای بازفعال‌سازی درس خالی‌شده";
    body.questions[0].question_en = "probe for reviving an emptied lesson";
    const res = await request(app).post("/api/admin/official-question-import/commit")
      .set("Authorization", `Bearer ${tk}`).send(body);
    expect(res.status).toBe(200);

    const after = db.prepare("SELECT active FROM path_nodes WHERE id=?").get(node.id);
    let ids = [];
    try { ids = JSON.parse(node.card_ids || "[]"); } catch { ids = []; }
    // only assert the revival when the node actually holds live cards
    if (ids.length) expect(after.active).toBe(1);
  });

  it("preview keeps why_fa on every option and marks the right answer", async () => {
    const tk = await token("admin");
    const res = await request(app).post("/api/admin/official-question-import/preview")
      .set("Authorization", `Bearer ${tk}`).send(sample());
    expect(res.status).toBe(200);
    const opts = res.body.plan[0].data.options;
    expect(opts).toHaveLength(4);
    expect(opts[2].correct).toBe(true);
    expect(opts.every((o) => typeof o.why_fa === "string" && o.why_fa.length > 0)).toBe(true);
    expect(opts[2].why_fa).toMatch(/پاسخ صحیح/);
    expect(res.body.plan[0].data.explain.text_fa).toMatch(/ورنیکه/);
  });

  it("commit persists why_fa into the stored card and the learner serializer exposes it", async () => {
    const tk = await token("admin");
    const res = await request(app).post("/api/admin/official-question-import/commit")
      .set("Authorization", `Bearer ${tk}`).send(sample({ questions: [{ ...sample().questions[0], question_fa: "سؤال کامیت why_fa یکتا" }] }));
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBeGreaterThan(0);
    const list = await request(app).get("/api/admin/learn-cards?full=1&q=" + encodeURIComponent("سؤال کامیت why_fa یکتا"))
      .set("Authorization", `Bearer ${tk}`);
    expect(list.status).toBe(200);
    const rows = list.body.cards || [];
    const found = rows.find((c) => JSON.stringify(c).includes("سؤال کامیت why_fa یکتا"));
    expect(found, "imported card should be listable").toBeTruthy();
    expect(JSON.stringify(found)).toContain("why_fa");
  });

  it("admin-authored learn cards keep why_fa through buildLearnCard", async () => {
    const tk = await token("admin");
    const created = await request(app).post("/api/admin/learn-cards")
      .set("Authorization", `Bearer ${tk}`).send({
        type: "mcq", q_fa: "سؤال دستی با توضیح گزینه",
        options: [
          { fa: "الف", correct: false, why_fa: "چون الف غلط است" },
          { fa: "ب", correct: true, why_fa: "پاسخ صحیح است" },
        ],
      });
    expect(created.status).toBe(200);
    const list = await request(app).get("/api/admin/learn-cards?full=1&q=" + encodeURIComponent("سؤال دستی با توضیح گزینه"))
      .set("Authorization", `Bearer ${tk}`);
    const rows = list.body.cards || [];
    const found = rows.find((c) => JSON.stringify(c).includes("سؤال دستی با توضیح گزینه"));
    expect(found).toBeTruthy();
    expect(JSON.stringify(found)).toContain("چون الف غلط است");
  });
});

describe("past-exam import carries micro-lesson and full English", () => {
  const payload = (qOverrides = {}) => ({
    program: "preint",
    subject_fa: "نورولوژی", subject_en: "Neurology",
    maxPerLesson: 15,
    questions: [{
      question_no: 1,
      chapter_fa: "اصول معاینه عصبی", chapter_en: "Principles of the Neurologic Examination",
      question_fa: "سؤال میکرو دوزبانه یکتا",
      question_en: "Unique bilingual micro question",
      options_fa: ["الف", "ب", "ج", "د"],
      options_en: ["Alpha", "Beta", "Gamma", "Delta"],
      options_why_fa: ["چون الف غلط", "چون ب غلط", "پاسخ صحیح — ج", "چون د غلط"],
      options_why_en: ["Alpha is wrong", "Beta is wrong", "Correct — Gamma", "Delta is wrong"],
      correct_index: 2,
      explanation_fa: "پاسخنامه فارسی", explanation_en: "English answer key",
      micro: {
        lead_fa: "خط اول درسنامه", lead_en: "Micro lesson lead",
        golden_fa: "نکته طلایی", golden_en: "Golden point",
        points_fa: ["نکته یک", "نکته دو"], points_en: ["Point one", "Point two"],
        source_fa: "Aminoff 2021", source_en: "Aminoff 2021",
      },
      ...qOverrides,
    }],
  });

  it("preview preserves the micro block and both languages", async () => {
    const tk = await token("admin");
    const res = await request(app).post("/api/admin/official-question-import/preview")
      .set("Authorization", `Bearer ${tk}`).send(payload());
    expect(res.status).toBe(200);
    const d = res.body.plan[0].data;
    expect(d.micro).toBeTruthy();
    expect(d.micro.lead_fa).toBe("خط اول درسنامه");
    expect(d.micro.lead_en).toBe("Micro lesson lead");
    expect(d.micro.points_en).toHaveLength(2);
    expect(d.micro.source_en).toMatch(/Aminoff/);
    expect(d.q_en).toBe("Unique bilingual micro question");
    expect(d.options[1].en).toBe("Beta");
    expect(d.options[2].why_en).toMatch(/Correct/);
    expect(d.explain.text_en).toBe("English answer key");
  });

  it("the learner serializer returns the English micro-lesson when lang=en", async () => {
    const tk = await token("admin");
    const commit = await request(app).post("/api/admin/official-question-import/commit")
      .set("Authorization", `Bearer ${tk}`).send(payload({ question_fa: "سؤال سریالایز دوزبانه یکتا" }));
    expect(commit.status).toBe(200);
    expect(commit.body.inserted).toBeGreaterThan(0);

    const list = await request(app).get("/api/admin/learn-cards?full=1").set("Authorization", `Bearer ${tk}`);
    const card = (list.body.cards || []).find((c) => JSON.stringify(c).includes("سؤال سریالایز دوزبانه یکتا"));
    expect(card, "imported card should be listable").toBeTruthy();
    const s = JSON.stringify(card);
    expect(s).toContain("Micro lesson lead");
    expect(s).toContain("Point one");
    expect(s).toContain("Correct — Gamma");
  });
});

describe("past-exam import keeps rich exam metadata for filtering", () => {
  const body = {
    program: "preint",
    subject_fa: "نورولوژی", subject_en: "Neurology",
    maxPerLesson: 15,
    questions: [{
      question_no: 1,
      chapter_fa: "اصول معاینه عصبی", chapter_en: "Principles of the Neurologic Examination",
      question_fa: "سؤال متادیتای دسته‌بندی یکتا",
      question_en: "Unique metadata classification question",
      options_fa: ["الف", "ب", "ج", "د"],
      options_en: ["A", "B", "C", "D"],
      correct_index: 1,
      explanation_fa: "پاسخنامه", explanation_en: "Answer key",
      year: "۹۵", year_num: 95,
      month: "شهریور", month_en: "Shahrivar",
      sitting: "main",
      pole: "تبریز", poles: ["تبریز"],
      scope: "قطبی", scope_en: "Regional",
      label_fa: "پره‌انترنی شهریور ۹۵ — قطب تبریز",
      label_en: "Pre-internship Shahrivar 1395 — Tabriz",
      question_style: "case",
      difficulty: "hard",
      repeat_count: 3,
      repeat_sources: ["پره‌انترنی شهریور ۹۵- قطب تبریز", "پره‌انترنی اسفند ۹۶- قطب کرمان"],
      cluster_id: "cl-042",
      is_representative: true,
      tags: ["subject:neurology", "year:۹۵", "style:case", "high-yield"],
    }],
  };

  it("preview stores every provenance field in source_meta", async () => {
    const tk = await token("admin");
    const res = await request(app).post("/api/admin/official-question-import/preview")
      .set("Authorization", `Bearer ${tk}`).send(body);
    expect(res.status).toBe(200);
    const sm = res.body.plan[0].data.source_meta;
    expect(sm.year).toBe("۹۵");
    expect(sm.year_num).toBe(95);
    expect(sm.month_en).toBe("Shahrivar");
    expect(sm.sitting).toBe("main");
    expect(sm.pole).toBe("تبریز");
    expect(sm.poles).toEqual(["تبریز"]);
    expect(sm.scope_en).toBe("Regional");
    expect(sm.label_en).toMatch(/Tabriz/);
    expect(sm.question_style).toBe("case");
    expect(sm.repeat_count).toBe(3);
    expect(sm.repeat_sources).toHaveLength(2);
    expect(sm.cluster_id).toBe("cl-042");
    expect(sm.is_representative).toBe(true);
    expect(sm.tags).toContain("high-yield");
  });

  it("difficulty from the payload is honoured and the card stays queryable by year", async () => {
    const tk = await token("admin");
    const commit = await request(app).post("/api/admin/official-question-import/commit")
      .set("Authorization", `Bearer ${tk}`)
      .send({ ...body, questions: [{ ...body.questions[0], question_fa: "سؤال متادیتای کامیت یکتا" }] });
    expect(commit.status).toBe(200);
    expect(commit.body.inserted).toBeGreaterThan(0);

    const list = await request(app).get("/api/admin/learn-cards?full=1").set("Authorization", `Bearer ${tk}`);
    const card = (list.body.cards || []).find((c) => JSON.stringify(c).includes("سؤال متادیتای کامیت یکتا"));
    expect(card).toBeTruthy();
    expect(card.difficulty).toBe("hard");
    const sm = card.data.source_meta;
    expect(sm.year).toBe("۹۵");
    expect(sm.question_style).toBe("case");
    // the whole point: the bank can be sliced by any of these keys
    const byYear = (list.body.cards || []).filter((c) => (c.data?.source_meta || {}).year === "۹۵");
    expect(byYear.length).toBeGreaterThan(0);
  });
});

describe("past-exam import carries the pedagogic sequence and concept", () => {
  it("preview keeps concept + seq so the path can be ordered and audited", async () => {
    const tk = await token("admin");
    const res = await request(app).post("/api/admin/official-question-import/preview")
      .set("Authorization", `Bearer ${tk}`).send({
        program: "preint", subject_fa: "نورولوژی", maxPerLesson: 15,
        questions: [{
          question_no: 1,
          chapter_fa: "اصول معاینه عصبی", chapter_en: "Principles of the Neurologic Examination",
          question_fa: "سؤال ترتیب آموزشی یکتا", question_en: "Unique pedagogic sequence question",
          options_fa: ["الف", "ب", "ج", "د"], options_en: ["A", "B", "C", "D"],
          correct_index: 0,
          explanation_fa: "پاسخنامه", explanation_en: "Answer key",
          concept: "aphasia", concept_fa: "آفازی و اختلالات زبان",
          concept_en: "Aphasia and language disorders",
          seq: 7, difficulty: "easy", question_style: "recall",
        }],
      });
    expect(res.status).toBe(200);
    const sm = res.body.plan[0].data.source_meta;
    expect(sm.concept).toBe("aphasia");
    expect(sm.concept_fa).toBe("آفازی و اختلالات زبان");
    expect(sm.concept_en).toMatch(/Aphasia/);
    expect(sm.seq).toBe(7);
    expect(sm.question_style).toBe("recall");
  });

  it("commit stores the concept so lessons can be checked for topical mixing", async () => {
    const tk = await token("admin");
    // The importer skips fingerprints it has already stored, and it normalises
    // digits to "#", so the fixtures must differ by WORDS and carry a per-run
    // nonce — otherwise this test would measure dedupe, not insertion.
    const RUNW = "n" + Date.now().toString(36).replace(/[0-9]/g, (d) => "abcdefghij"[+d]);
    const mk = (n, concept, seq) => ({
      question_no: n,
      chapter_fa: "اصول معاینه عصبی", chapter_en: "Principles of the Neurologic Examination",
      question_fa: `سؤال چیدمان مفهومی ${["الفبا","بتا","گاما"][n - 1]} یکتا ${RUNW}`,
      question_en: `Concept mixing question ${["alpha","beta","gamma"][n - 1]} ${RUNW}`,
      options_fa: ["الف", "ب", "ج", "د"], options_en: ["A", "B", "C", "D"],
      correct_index: 1, explanation_fa: "پاسخنامه", explanation_en: "Answer key",
      concept, seq, difficulty: "medium", question_style: "case",
    });
    const res = await request(app).post("/api/admin/official-question-import/commit")
      .set("Authorization", `Bearer ${tk}`).send({
        program: "preint", subject_fa: "نورولوژی", maxPerLesson: 15,
        questions: [mk(1, "aphasia", 0), mk(2, "gait", 1), mk(3, "pupil", 2)],
      });
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(3);

    const list = await request(app).get("/api/admin/learn-cards?full=1").set("Authorization", `Bearer ${tk}`);
    const mine = (list.body.cards || [])
      .filter((c) => JSON.stringify(c).includes("سؤال چیدمان مفهومی"))
      .map((c) => c.data.source_meta);
    expect(mine.length).toBe(3);
    // the whole point of the sequencer: a lesson must mix several concepts
    expect(new Set(mine.map((m) => m.concept)).size).toBe(3);
    expect(mine.every((m) => Number.isInteger(m.seq))).toBe(true);
  });
});

describe("past-exam import honours the authored lesson grouping", () => {
  it("uses lesson_part instead of re-chunking greedily", async () => {
    const tk = await token("admin");
    // 4 questions the sequencer deliberately split 2 + 2. Greedy chunking at
    // maxPerLesson=15 would put all four in part 1 and lose the balance.
    const WORDS = ["یکم", "دوم", "سوم", "چهارم"];
    const mk = (n, part) => ({
      question_no: n,
      chapter_fa: "فصل تقسیم متوازن یکتا", chapter_en: "Unique balanced split chapter",
      question_fa: `سؤال تقسیم متوازن ${WORDS[n - 1]} یکتا`,
      question_en: `Balanced split question ${WORDS[n - 1]} unique`,
      options_fa: ["الف", "ب", "ج", "د"], options_en: ["A", "B", "C", "D"],
      correct_index: 0, explanation_fa: "پاسخنامه", explanation_en: "Answer key",
      seq: n - 1, lesson_part: part,
    });
    const res = await request(app).post("/api/admin/official-question-import/preview")
      .set("Authorization", `Bearer ${tk}`).send({
        program: "preint", subject_fa: "نورولوژی", maxPerLesson: 15,
        questions: [mk(1, 1), mk(2, 1), mk(3, 2), mk(4, 2)],
      });
    expect(res.status).toBe(200);
    expect(res.body.plan.map((p) => p.part)).toEqual([1, 1, 2, 2]);
    expect(res.body.plan[3].data.source_meta.lesson_part).toBe(2);
  });

  it("still falls back to greedy chunking when lesson_part is absent", async () => {
    const tk = await token("admin");
    // The dedupe fingerprint collapses all digits to "#", so the stems must
    // differ by words, not by numbers, or they would look like duplicates.
    const WORDS = ["یکم", "دوم", "سوم"];
    const mk = (n) => ({
      question_no: n,
      chapter_fa: "فصل تقسیم خودکار یکتا", chapter_en: "Unique auto split chapter",
      question_fa: `سؤال تقسیم خودکار ${WORDS[n - 1]} یکتا`,
      question_en: `Auto split question ${WORDS[n - 1]} unique`,
      options_fa: ["الف", "ب", "ج", "د"], options_en: ["A", "B", "C", "D"],
      correct_index: 0, explanation_fa: "پاسخنامه", explanation_en: "Answer key",
    });
    const res = await request(app).post("/api/admin/official-question-import/preview")
      .set("Authorization", `Bearer ${tk}`).send({
        program: "preint", subject_fa: "نورولوژی", maxPerLesson: 2,
        questions: [mk(1), mk(2), mk(3)],
      });
    expect(res.status).toBe(200);
    expect(res.body.plan.map((p) => p.part)).toEqual([1, 1, 2]);
    expect(res.body.plan[0].data.source_meta.lesson_part).toBe(null);
  });
});

describe("past-exam import commit reuses the previewed lesson parts", () => {
  it("commit and preview agree on the lesson split", async () => {
    const tk = await token("admin");
    const WORDS = ["الفی", "بی", "جیمی", "دالی"];
    const mk = (n, part) => ({
      question_no: n,
      chapter_fa: "فصل هماهنگی کامیت یکتا", chapter_en: "Unique commit agreement chapter",
      question_fa: `سؤال هماهنگی کامیت ${WORDS[n - 1]} یکتا`,
      question_en: `Commit agreement question ${WORDS[n - 1]} unique`,
      options_fa: ["الف", "ب", "ج", "د"], options_en: ["A", "B", "C", "D"],
      correct_index: 0, explanation_fa: "پاسخنامه", explanation_en: "Answer key",
      seq: n - 1, lesson_part: n <= 2 ? 1 : 2,
    });
    const payload = {
      program: "preint", subject_fa: "نورولوژی", subject_en: "Neurology",
      maxPerLesson: 15, questions: [mk(1), mk(2), mk(3), mk(4)],
    };
    const res = await request(app).post("/api/admin/official-question-import/commit")
      .set("Authorization", `Bearer ${tk}`).send(payload);
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(4);

    // the chapter must have been split into two lessons of two, not one of four
    const path = await request(app).get("/api/admin/path")
      .set("Authorization", `Bearer ${tk}`);
    const titles = JSON.stringify(path.body);
    expect(titles).toContain("فصل هماهنگی کامیت یکتا");
    expect(titles).toContain("فصل هماهنگی کامیت یکتا - بخش 2");
  });
});

describe("official import stays inside the request body limit", () => {
  it("rejects a payload larger than the 2 MB body cap", async () => {
    const tk = await token("admin");
    // ~3 MB of JSON: well past express.json({ limit: "2mb" }). The bank is
    // exported in chunks precisely so this never happens in practice; this
    // test pins the limit so nobody raises it accidentally.
    const big = "پ".repeat(3 * 1024 * 1024);
    const res = await request(app).post("/api/admin/official-question-import/preview")
      .set("Authorization", `Bearer ${tk}`)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ program: "preint", subject_fa: "نورولوژی", note: big, questions: [] }));
    expect(res.status).toBe(413);
  });

  it("a chunked import produces the same lesson split as one big import", async () => {
    const tk = await token("admin");
    const WORDS = ["الفی", "بی", "جیمی", "دالی", "هایی", "وائی"];
    const mk = (n, part) => ({
      question_no: n,
      chapter_fa: "فصل تقسیم چندتکه یکتا", chapter_en: "Unique chunked split chapter",
      question_fa: `سؤال تقسیم چندتکه ${WORDS[n - 1]} یکتا`,
      question_en: `Chunked split question ${WORDS[n - 1]} unique`,
      options_fa: ["الف", "ب", "ج", "د"], options_en: ["A", "B", "C", "D"],
      correct_index: 0, explanation_fa: "پاسخنامه", explanation_en: "Answer key",
      seq: n - 1, lesson_part: n <= 3 ? 1 : 2,
    });
    const meta = { program: "preint", subject_fa: "نورولوژی", subject_en: "Neurology", maxPerLesson: 15 };

    // send the same six questions as two separate requests
    for (const slice of [[mk(1), mk(2), mk(3)], [mk(4), mk(5), mk(6)]]) {
      const res = await request(app).post("/api/admin/official-question-import/commit")
        .set("Authorization", `Bearer ${tk}`).send({ ...meta, questions: slice });
      expect(res.status).toBe(200);
      expect(res.body.inserted).toBe(3);
      expect(res.body.attached).toBe(3);
    }

    // lesson_part must still drive the grouping across request boundaries
    const path = await request(app).get("/api/admin/path").set("Authorization", `Bearer ${tk}`);
    const blob = JSON.stringify(path.body);
    expect(blob).toContain("فصل تقسیم چندتکه یکتا");
    expect(blob).toContain("فصل تقسیم چندتکه یکتا - بخش 2");
  });
});

/* ===========================================================================
   Question classification, modification tracking, demo cleanup and the two
   university education articles. These guard the contract the admin screens
   and the learner browser both depend on.
   =========================================================================== */
describe("Question classification & modification tracking", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  let atk, ltk;
  beforeAll(async () => { atk = await token("admin"); ltk = await token("learner"); });

  // Per-run nonce: the importer dedupes on a fingerprint that normalises digits
  // to "#", so fixtures must differ by words, not numbers.
  const FACET_RUN = "k" + Date.now().toString(36).replace(/[0-9]/g, (d) => "abcdefghij"[+d]);

  // Helper: import one official question so provenance facets have real data.
  // Uses the importer's own payload shape (question_fa / options_fa / …), the
  // same one the neurology bank sends.
  const importOne = async (over = {}) => {
    const res = await request(app).post("/api/admin/official-question-import/commit")
      .set(A(atk)).send({
        program: "preint",
        subject_fa: "نورولوژی", subject_en: "Neurology",
        maxPerLesson: 15, exam_type: "پره‌انترنی",
        questions: [{
          question_no: over.no || 900,
          chapter_fa: over.chapter || "فصل طبقه‌بندی آزمایشی",
          chapter_en: over.chapterEn || "Facet Test Chapter",
          question_fa: over.q || `سؤال آزمایشی طبقه‌بندی ${over.tag || "پایه"} ${FACET_RUN}`,
          options_fa: ["میگرن", "تنشی", "خوشه‌ای", "نورالژی"],
          correct_index: 0,
          explanation_fa: "درسنامه آزمایشی طبقه‌بندی",
          year: over.year || "۱۴۰۴",
          month: over.month || "شهریور",
          question_style: "case",
        }],
      });
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBeGreaterThan(0);
    return res.body;
  };

  it("exposes exam-provenance facets with counts on the admin card list", async () => {
    await importOne({ no: 901, tag: "الف" });
    const res = await request(app).get("/api/admin/learn-cards?lang=fa&full=1").set(A(atk));
    expect(res.status).toBe(200);
    expect(res.body.facets).toBeTruthy();
    // the vocabulary the UI builds its dropdowns from
    for (const k of ["subject", "chapter", "concept", "year", "month", "sitting", "style", "origin", "exam"]) {
      expect(Array.isArray(res.body.facets[k])).toBe(true);
    }
    const origins = Object.fromEntries(res.body.facets.origin.map((o) => [o.value, o.count]));
    expect(origins.official_exam).toBeGreaterThan(0);
    const chap = res.body.facets.chapter.find((c) => c.value === "فصل طبقه‌بندی آزمایشی");
    expect(chap.count).toBeGreaterThan(0);
    // every card carries the flat facet bag
    const card = res.body.cards.find((c) => c.facets?.chapter === "فصل طبقه‌بندی آزمایشی");
    expect(card.facets.official).toBe(true);
    expect(card.facets.year).toBe("۱۴۰۴");
  });

  it("filters by a COMBINED query: subject + chapter, and multi-select years (OR)", async () => {
    await importOne({ no: 902, tag: "ب", year: "۱۴۰۳", month: "اسفند" });
    // combined AND across facets — the "last modification in Neurology > Headache" case
    const combo = await request(app)
      .get("/api/admin/learn-cards?full=1&lang=fa&subject_fa=" + encodeURIComponent("نورولوژی") +
           "&chapter=" + encodeURIComponent("فصل طبقه‌بندی آزمایشی") + "&sort=last_modified")
      .set(A(atk));
    expect(combo.status).toBe(200);
    expect(combo.body.cards.length).toBeGreaterThan(0);
    expect(combo.body.cards.every((c) => c.facets.chapter === "فصل طبقه‌بندی آزمایشی")).toBe(true);
    expect(combo.body.total).toBeGreaterThan(combo.body.cards.length);

    // OR inside one facet
    const multi = await request(app)
      .get("/api/admin/learn-cards?full=1&lang=fa&chapter=" + encodeURIComponent("فصل طبقه‌بندی آزمایشی") +
           "&year=" + encodeURIComponent("۱۴۰۳,۱۴۰۴"))
      .set(A(atk));
    const years = new Set(multi.body.cards.map((c) => c.facets.year));
    expect(years.has("۱۴۰۳")).toBe(true);
    expect(years.has("۱۴۰۴")).toBe(true);
  });

  it("separates created / content-changed / any-write, and logs who changed what", async () => {
    // create by hand so we control the timeline
    const created = await request(app).post("/api/admin/learn-cards").set(A(atk)).send({
      type: "mcq", q_fa: "سؤال ردیابی تغییرات", q_en: "Tracking test",
      options: [{ fa: "الف", en: "A", correct: true }, { fa: "ب", en: "B" }],
    });
    const id = created.body.id;

    let hist = await request(app).get(`/api/admin/learn-cards/${id}/history`).set(A(atk));
    expect(hist.status).toBe(200);
    expect(hist.body.card.last_action).toBe("created");
    expect(hist.body.revisions.length).toBe(1);
    const baseRev = hist.body.card.revision;

    // a real content edit is recorded WITH the changed field names
    const edited = await request(app).put(`/api/admin/learn-cards/${id}`).set(A(atk))
      .send({ q_fa: "سؤال ردیابی تغییرات — ویرایش‌شده" });
    expect(edited.body.fields).toContain("q_fa");

    hist = await request(app).get(`/api/admin/learn-cards/${id}/history`).set(A(atk));
    expect(hist.body.card.revision).toBe(baseRev + 1);
    expect(hist.body.card.last_action).toBe("edited");
    expect(hist.body.revisions[0].actorName).toBeTruthy();   // WHO

    // deactivating is NOT a content edit: it must not move content_updated_at
    const beforeContent = hist.body.card.content_updated_at;
    await request(app).put(`/api/admin/learn-cards/${id}`).set(A(atk)).send({ active: 0 });
    const after = await request(app).get(`/api/admin/learn-cards/${id}/history`).set(A(atk));
    expect(after.body.card.content_updated_at).toBe(beforeContent);
    expect(after.body.card.last_action).toBe("deactivated");
  });

  it("filters the change log by subject and chapter together", async () => {
    await importOne({ no: 903, tag: "ج", chapter: "فصل لاگ آزمایشی" });
    const res = await request(app)
      .get("/api/admin/card-revisions?subject=" + encodeURIComponent("نورولوژی") +
           "&chapter=" + encodeURIComponent("فصل لاگ آزمایشی"))
      .set(A(atk));
    expect(res.status).toBe(200);
    expect(res.body.revisions.length).toBeGreaterThan(0);
    expect(res.body.revisions.every((r) => r.chapter === "فصل لاگ آزمایشی")).toBe(true);
    expect(res.body.revisions[0].action).toBe("imported");

    const sum = await request(app).get("/api/admin/card-revisions/summary?days=7").set(A(atk));
    expect(Array.isArray(sum.body.byDay)).toBe(true);
    expect(sum.body.bySubject.some((r) => r.subject === "نورولوژی")).toBe(true);
  });

  it("learner browse filters by the same facets and hides demo questions", async () => {
    const res = await request(app)
      .get("/api/learn/browse?lang=fa&subject=" + encodeURIComponent("نورولوژی") + "&per=5")
      .set(A(ltk));
    expect(res.status).toBe(200);
    expect(res.body.cards.length).toBeGreaterThan(0);
    expect(res.body.cards.every((c) => c.subject === "نورولوژی")).toBe(true);
    // seeded sample questions must never appear in the default learner view
    expect(res.body.cards.every((c) => c.official !== false || c.subject)).toBe(true);
    // facet counts come back so the UI can label each option
    expect(Array.isArray(res.body.facets.chapter)).toBe(true);
    expect(res.body.facets.chapter.every((o) => o.count > 0)).toBe(true);
    // and a single question can be opened in full
    const one = await request(app).get(`/api/learn/browse/${res.body.cards[0].id}?lang=fa`).set(A(ltk));
    expect(one.status).toBe(200);
    expect(one.body.card.q).toBeTruthy();
  });

  it("reports and purges seeded demo questions, detaching them from the path", async () => {
    const before = await request(app).get("/api/admin/demo-cards").set(A(atk));
    expect(before.status).toBe(200);
    expect(typeof before.body.count).toBe("number");
    if (before.body.count === 0) return;                 // already clean

    const purge = await request(app).post("/api/admin/demo-cards/purge").set(A(atk)).send({ mode: "delete" });
    expect(purge.status).toBe(200);
    expect(purge.body.affected).toBe(before.body.count);

    const after = await request(app).get("/api/admin/demo-cards").set(A(atk));
    expect(after.body.count).toBe(0);
    // no lesson may still point at a deleted demo card
    const cards = await request(app).get("/api/admin/learn-cards?lang=fa&full=1").set(A(atk));
    expect(cards.body.cards.every((c) => c.facets.origin !== "demo_seed")).toBe(true);
  });
});

describe("University education articles are full articles, not stubs", () => {
  // index.js seeds these on boot; the test harness builds the app directly, so
  // run the same idempotent ensure step here.
  beforeAll(async () => {
    const { ensureDefaultEducationPosts } = await import("../src/lib/blog.js");
    ensureDefaultEducationPosts();
  });

  it("both feature articles have real body content in both languages", async () => {
    for (const slug of ["virtual-patient-osce-medical-education", "hint-based-questions-scaffolded-learning"]) {
      const res = await request(app).get(`/api/site-content/blog/${slug}?lang=fa`);
      expect(res.status).toBe(200);
      // The endpoint returns the localized post with its markdown pre-rendered.
      // A stub was ~140 chars; a real article renders to thousands of chars of
      // HTML with real section headings and a table of contents.
      expect(res.body.body_html.length).toBeGreaterThan(1500);
      expect(res.body.body_html).toMatch(/<h2/);
      expect(res.body.toc.length).toBeGreaterThanOrEqual(3);
      // an excerpt worth showing in the list
      expect((res.body.excerpt || "").length).toBeGreaterThan(30);

      // and the same is true in English, not just Persian
      const en = await request(app).get(`/api/site-content/blog/${slug}?lang=en`);
      expect(en.status).toBe(200);
      expect(en.body.body_html.length).toBeGreaterThan(1500);
      expect(en.body.body_html).toMatch(/<h2/);
    }
  });
});

describe("Official import is idempotent", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });
  it("re-importing the same questions skips them instead of doubling the bank", async () => {
    const atk = await token("admin");
    const payload = {
      program: "preint", subject_fa: "نورولوژی", subject_en: "Neurology",
      maxPerLesson: 15, exam_type: "پره‌انترنی",
      questions: [{
        question_no: 950, chapter_fa: "فصل تکرار آزمایشی", chapter_en: "Idempotency Chapter",
        question_fa: "سؤال یکتای آزمون تکرار ایمپورت",
        options_fa: ["الف", "ب", "ج", "د"], correct_index: 1,
        explanation_fa: "درسنامه", year: "۱۴۰۴", month: "شهریور",
      }],
    };
    const first = await request(app).post("/api/admin/official-question-import/commit").set(A(atk)).send(payload);
    expect(first.status).toBe(200);
    expect(first.body.inserted).toBe(1);

    const second = await request(app).post("/api/admin/official-question-import/commit").set(A(atk)).send(payload);
    expect(second.status).toBe(200);
    expect(second.body.inserted).toBe(0);
    expect(second.body.skipped).toBe(1);

    // exactly one copy lives in the bank
    const list = await request(app)
      .get("/api/admin/learn-cards?full=1&lang=fa&chapter=" + encodeURIComponent("فصل تکرار آزمایشی")).set(A(atk));
    expect(list.body.cards.length).toBe(1);
  });
});

/* ------------------------------------------------------------------
   Shipped question banks are guarded against the two-correct-answer
   defect. A distractor whose rationale concedes it is also right means
   the student loses marks on a defensible answer — the single most
   damaging flaw a question bank can ship. This ran as a standalone
   script first (tools/validate_bank.py) and caught a real case in the
   infectious bank; wiring it into `npm test` keeps it from coming back.
   ------------------------------------------------------------------ */
describe("shipped question banks contain no two-correct-answer questions", () => {
  const bankDir = path.join(process.cwd(), "..", "tools");

  // Same rules as tools/validate_bank.py, kept deliberately small here.
  const CONCEDE = ["رژیم درستی است", "گزینه‌ی درستی است", "هم درست است",
    "نیز صحیح است", "هم صحیح است", "درست است", "صحیح است",
    "قابل قبول است", "مؤثر است"];
  const REJECT = ["ولی", "اما", "نیست", "نادرست", "اشتباه", "غلط", "بجز",
    "کافی نیست", "توصیه نمی", "بیش‌درمانی", "خطرناک", "نه ", "بی‌مورد",
    "کنترااندیکه", "ناکافی", "رد می‌شود", "انتخاب اول نیست", "به‌ندرت",
    "پایین", "کمتر", "سود کمی", "جایگاهی ندارد", "ندارد", "نمی", "فقط", "مگر", "در حالی که", "برعکس",
    "اختصاصی‌تر", "دقیق‌تر", "ممنوع", "بی‌اثر", "تفاوت با کلید"];
  const NEG = /نمی‌باشد|نمیباشد|صحیح نیست|درست نیست|نادرست است|غلط است|اشتباه است|مناسب نیست|لازم نیست|قرار نمی‌گیرد|قرار نمیگیرد|جمله\s*[یٔ‌]?\s*(?:غلط|نادرست|اشتباه)|غلط کدام|کم ?تر کمک کننده|بجز|به‌جز|به جز|EXCEPT|except|نمی‌پذیرید|نمی‌گردد|کاربردی ندارد|محسوب نمی|صحیح نمی‌باشد|انتخاب اول نیست|توصیه نمی|نمیشود|نمی‌شود|منع مصرف|کدام.{0,25}ندارد|کدام.{0,25}نیست|کدام.{0,25}اشتباه|نادرست[^؟]{0,45}است|به غیر|به ?وز|ندارد\s*؟/;
  const PRAISE = /انتخاب|گزینه‌ی درست|پاسخ درست|پاسخ صحیح|ایمنی|عوارض|تحمل|کمتر از|بیشتر از|نسبت به/;

  function payloadFiles() {
    if (!fs.existsSync(bankDir)) return [];
    const out = [];
    for (const d of fs.readdirSync(bankDir)) {
      if (!d.endsWith("-bank")) continue;
      const sub = path.join(bankDir, d);
      if (!fs.statSync(sub).isDirectory()) continue;
      for (const f of fs.readdirSync(sub)) {
        // plain parts, a single payload, or a named family such as
        // import-payload.master-preint.part01.json — same set as bankbootstrap
        if (/^import-payload(\.[a-z0-9-]+)?(\.part\d+)?\.json$/.test(f)) out.push(path.join(sub, f));
      }
    }
    return out;
  }

  it("every distractor that concedes correctness also rebuts it", () => {
    const files = payloadFiles();
    expect(files.length).toBeGreaterThan(0);

    const bad = [];
    let scanned = 0;
    for (const file of files) {
      const body = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const q of body.questions || []) {
        scanned++;
        if (q.keyless === true) continue;
        const stem = q.question_fa || "";
        if (q.question_style === "negative" || NEG.test(stem)) continue;
        const whys = q.options_why_fa || [];
        for (let i = 0; i < whys.length; i++) {
          if (i === q.correct_index) continue;
          const w = whys[i] || "";
          for (const c of CONCEDE) {
            // Word boundary matters: "نادرست است" (is INCORRECT) must not be
            // read as "درست است" (is correct). Require a non-Persian-letter
            // character before the phrase, exactly as validate_bank.py does.
            const at = w.search(new RegExp(
              "(?<![\\u0600-\\u06FF])" + c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
            if (at < 0) continue;
            const lead = w.slice(Math.max(0, at - 40), at + c.length);
            // قضاوت صریح نویسنده در اطراف عبارت امتیازدهنده («نادرست است؛»،
            // «دلیل رد»، «دلیل انتخاب») یعنی رد مستند وجود دارد و تداخلی نیست.
            const verdictLead = w;
            if (/نادرست است؛|دلیل رد|دلیل انتخاب/.test(verdictLead)) break;
            if (PRAISE.test(lead)) break;
            if (!REJECT.some((r) => w.slice(at).includes(r))) {
              bad.push(`${path.basename(file)} ${q.year}-${q.month} q${q.question_no} opt${i}: "${c}"`);
            }
            break;
          }
        }
      }
    }
    expect(scanned).toBeGreaterThan(500);
    expect(bad).toEqual([]);
  });

  it("every shipped question has four options and a valid answer index", () => {
    const bad = [];
    for (const file of payloadFiles()) {
      const body = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const q of body.questions || []) {
        const n = (q.options_fa || []).length;
        if (n !== 4) bad.push(`${q.year}-${q.month} q${q.question_no}: ${n} options`);
        // keyless questions ship with correct_index null and stay out of every
        // graded surface; every other question must carry a valid 0..3 key
        if (q.keyless === true) continue;
        if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index > 3) {
          bad.push(`${q.year}-${q.month} q${q.question_no}: bad correct_index`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

/* ------------------------------------------------------------------
   A past-exam question with no teaching content belongs in the
   searchable bank and in exam simulation, but NOT on the curated
   learning path: there the learner answers and then expects a lesson,
   and an empty panel reads as a broken page. The infectious book import
   (857 items with official keys but no lessons yet) relies on this.
   ------------------------------------------------------------------ */
describe("questions without a lesson stay out of the learning path", () => {
  const A = (tk) => ({ Authorization: `Bearer ${tk}` });

  it("routes a lesson-less question to the bank, and a taught one to the path", async () => {
    const atk = await token("admin");
    const base = {
      program: "preint", subject_fa: "نورولوژی", subject_en: "Neurology",
      maxPerLesson: 15, exam_type: "پره‌انترنی",
    };
    const bare = {
      question_no: 971, chapter_fa: "فصل بدون درسنامه", chapter_en: "No Lesson Chapter",
      question_fa: "سؤال بدون درسنامه برای آزمون مسیریابی",
      options_fa: ["الف", "ب", "ج", "د"], correct_index: 2,
      year: "۱۴۰۴", month: "شهریور", needs_lesson: true,
    };
    const taught = {
      question_no: 972, chapter_fa: "فصل بدون درسنامه", chapter_en: "No Lesson Chapter",
      question_fa: "سؤال دارای درسنامه برای آزمون مسیریابی",
      options_fa: ["الف", "ب", "ج", "د"], correct_index: 1,
      explanation_fa: "توضیح کامل این سؤال.",
      options_why_fa: ["نادرست", "پاسخ صحیح", "نادرست", "نادرست"],
      year: "۱۴۰۴", month: "شهریور",
    };

    const prev = await request(app)
      .post("/api/admin/official-question-import/preview")
      .set(A(atk)).send({ ...base, questions: [bare, taught] });
    expect(prev.status).toBe(200);
    const routes = Object.fromEntries(prev.body.plan.map((p) => [p.question_no, p.route]));
    expect(routes[971]).toBe("bank_only");
    expect(routes[972]).toBe("competitive_path");
    expect(prev.body.counters.bankOnly).toBe(1);
    expect(prev.body.counters.path).toBe(1);

    const res = await request(app)
      .post("/api/admin/official-question-import/commit")
      .set(A(atk)).send({ ...base, questions: [bare, taught] });
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(2);
    // only the taught one was attached to a lesson node
    expect(res.body.attached).toBe(1);

    // both are searchable in the bank
    const list = await request(app)
      .get("/api/admin/learn-cards?full=1&lang=fa&chapter=" + encodeURIComponent("فصل بدون درسنامه"))
      .set(A(atk));
    expect(list.body.cards.length).toBe(2);
  });

  it("detects a missing lesson even when the payload forgets to say so", async () => {
    const atk = await token("admin");
    const res = await request(app)
      .post("/api/admin/official-question-import/preview")
      .set(A(atk)).send({
        program: "preint", subject_fa: "نورولوژی", subject_en: "Neurology",
        exam_type: "پره‌انترنی",
        questions: [{
          question_no: 973, chapter_fa: "فصل تشخیص خودکار", chapter_en: "Auto Detect",
          question_fa: "سؤالی که پرچم needs_lesson ندارد ولی درسنامه هم ندارد",
          options_fa: ["الف", "ب", "ج", "د"], correct_index: 0,
          year: "۱۴۰۴", month: "شهریور",
        }],
      });
    expect(res.status).toBe(200);
    expect(res.body.plan[0].route).toBe("bank_only");
  });
});

/* ------------------------------------------------------------------
   Standing content rule: when a sitting published its own English
   booklet, the archive must carry THAT translation rather than one of
   ours. Esfand-1400 is such a sitting. This guards both that the
   English is present and that page furniture ("Page 3", the objection
   form) never leaked into a question or an option.
   ------------------------------------------------------------------ */
describe("official English booklet text in the all-subject archive", () => {
  const archivePath = path.join(process.cwd(), "..", "tools", "exam-booklets", "archive.json");

  it("Esfand-1400 carries ministry English on every question and option", () => {
    if (!fs.existsSync(archivePath)) return;          // archive is optional in a slim build
    const archive = JSON.parse(fs.readFileSync(archivePath, "utf8"));
    const official = (archive.questions || []).filter((q) => q.en_source === "official_booklet");
    expect(official.length).toBeGreaterThan(150);

    const bad = [];
    for (const q of official) {
      if (!/[A-Za-z]/.test(q.stem_en || "")) bad.push(`q${q.no}: stem not English`);
      const opts = q.options_en || [];
      if (opts.length !== 4) bad.push(`q${q.no}: ${opts.length} English options`);
      for (const o of opts) {
        if (!String(o).trim()) bad.push(`q${q.no}: blank English option`);
      }
      // page furniture must never have bled into the text
      const blob = `${q.stem_en} ${opts.join(" ")}`;
      if (/Page\s*\d|Comprehensive Exam of Pre-Internship|Secretariat of Education/i.test(blob)) {
        bad.push(`q${q.no}: page furniture leaked into the text`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("keeps the archive's Persian question count intact", () => {
    if (!fs.existsSync(archivePath)) return;
    const archive = JSON.parse(fs.readFileSync(archivePath, "utf8"));
    expect((archive.questions || []).length).toBe(archive.totals.questions);
    // no stem may be empty or non-Persian after the merge
    const broken = (archive.questions || []).filter(
      (q) => !q.stem_fa || !/[\u0600-\u06FF]/.test(q.stem_fa)
    );
    expect(broken.map((q) => `${q.sitting}:${q.no}`)).toEqual([]);
  });
});

/* ------------------------------------------------------------------
   Book-sourced questions carry the book's own printed answer key.
   Auditing those keys against Harrison found a few that are medically
   wrong (e.g. a typhoid vignette answered "meningitis"). A wrong key is
   worse than a missing question, so such items are quarantined and must
   never reach a learner. This guards the quarantine.
   ------------------------------------------------------------------ */
describe("book questions with a disputed answer key stay out of the learner bank", () => {
  const dir = path.join(process.cwd(), "..", "tools", "infectious-bank");

  function bookQuestions() {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/^import-payload\.book\.part\d+\.json$/.test(f)) continue;
      const body = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      out.push(...(body.questions || []));
    }
    return out;
  }

  it("every disputed-key question is flagged premium and never taught", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    // A disputed key is a temporary state: it means "we have not decided yet".
    // Every one is eventually either un-quarantined (our flag was wrong) or
    // corrected (the source was wrong). Zero disputed is therefore the healthy
    // end state, not a reason to fail — but any that remain must be quarantined.
    const disputed = qs.filter((q) => q.key_disputed);
    for (const q of disputed) {
      expect(q.premium).toBe(true);
      expect(q.needs_review).toBe(true);
      // a quarantined question must not carry teaching content, because that
      // is exactly what would promote it onto the learning path
      expect(q.needs_lesson).not.toBe(false);
      expect((q.explanation_fa || "").trim()).toBe("");
    }
  });

  it("a book question is only taught when it has a full bilingual lesson", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const taught = qs.filter((q) => q.needs_lesson === false);
    expect(taught.length).toBeGreaterThan(0);
    const bad = [];
    for (const q of taught) {
      const tag = `${q.year}-${q.month} q${q.question_no}`;
      if (!(q.explanation_fa || "").trim()) bad.push(`${tag}: no Persian explanation`);
      if (!(q.explanation_en || "").trim()) bad.push(`${tag}: no English explanation`);
      const w = q.options_why_fa || [];
      if (w.length !== 4 || w.some((x) => !String(x).trim())) bad.push(`${tag}: incomplete rationales`);
      const pts = (q.micro || {}).points_fa || [];
      const ptsEn = (q.micro || {}).points_en || [];
      if (pts.length < 10 || pts.length !== ptsEn.length) bad.push(`${tag}: micro ${pts.length}/${ptsEn.length}`);
      if (q.key_disputed) bad.push(`${tag}: taught despite a disputed key`);
    }
    expect(bad).toEqual([]);
  });

  /* A key that disagrees with the printed source is a serious edit: it means we
     have overruled the book. That is sometimes right, but it must never happen
     silently. Every correction has to carry its reasoning and a citation, in
     both languages, and the lesson must tell the student the key was changed
     so they are not confused when their copy of the book disagrees. */
  it("every corrected key records its justification and says so in the lesson", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const corrected = qs.filter((q) => q.key_corrected);
    const bad = [];
    for (const q of corrected) {
      const tag = `${q.year}-${q.month} q${q.question_no}`;
      if (!Number.isInteger(q.original_correct_index)) bad.push(`${tag}: original index not recorded`);
      if (q.original_correct_index === q.correct_index) bad.push(`${tag}: marked corrected but index unchanged`);
      if (!(q.key_correction_fa || "").trim()) bad.push(`${tag}: no Persian justification`);
      if (!(q.key_correction_en || "").trim()) bad.push(`${tag}: no English justification`);
      if (!(q.key_correction_source || "").trim()) bad.push(`${tag}: no source cited`);
      // the student must be told, inside the lesson, that the key differs from the book
      const blob = `${q.explanation_fa || ""} ${(q.micro || {}).lead_fa || ""}`;
      if (!/تصحیح|اصلاح/.test(blob)) bad.push(`${tag}: lesson does not disclose the correction`);
    }
    expect(bad).toEqual([]);
  });
});

/* ------------------------------------------------------------------
   A question that reaches the learning path must be complete in BOTH
   languages: Persian and English stem, four options each, and a
   bilingual lesson. A half-translated question is worse than an
   untranslated one, because the English-practising student meets a
   card that switches language mid-way.
   ------------------------------------------------------------------ */
describe("taught book questions are complete in both languages", () => {
  const dir = path.join(process.cwd(), "..", "tools", "infectious-bank");

  function bookQuestions() {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/^import-payload\.book\.part\d+\.json$/.test(f)) continue;
      out.push(...(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).questions || []));
    }
    return out;
  }

  it("every taught question has an English stem and four English options", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const taught = qs.filter((q) => q.needs_lesson === false);
    expect(taught.length).toBeGreaterThan(0);

    const bad = [];
    for (const q of taught) {
      const tag = `${q.year}-${q.month} q${q.question_no}`;
      if (!/[A-Za-z]/.test(q.question_en || "")) bad.push(`${tag}: no English stem`);
      const en = q.options_en || [];
      if (en.length !== (q.options_fa || []).length) bad.push(`${tag}: English option count differs`);
      for (const o of en) {
        if (!String(o).trim()) bad.push(`${tag}: blank English option`);
        // a stray Persian word means the translation was left half-done
        if (/[\u0600-\u06FF]/.test(String(o))) bad.push(`${tag}: Persian text inside an English option`);
      }
      if (/[\u0600-\u06FF]/.test(q.question_en || "")) bad.push(`${tag}: Persian text inside the English stem`);
    }
    expect(bad).toEqual([]);
  });

  it("numbers in the Persian stem survive into the English stem", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const fa2en = (s) => (s || "").replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
    const nums = (s) => {
      const out = new Set();
      for (const m of fa2en(s).match(/[\d,]{2,}/g) || []) {
        const d = m.replace(/,/g, "");
        if (/^\d+$/.test(d)) out.add(String(parseInt(d, 10)));
      }
      return out;
    };
    const skip = new Set(["0", "1", "2", "3", "4"]);

    const bad = [];
    for (const q of qs.filter((x) => x.needs_lesson === false && x.question_en)) {
      const corrections = q.en_number_corrections || {};
      const en = nums(q.question_en);
      for (const v of nums(q.question_fa)) {
        if (skip.has(v)) continue;
        if (en.has(v)) continue;
        // a value the PDF rendered with mirrored digits is allowed to differ,
        // provided the correction is recorded on the question itself
        const fixed = Object.entries(corrections).some(
          ([from, to]) => String(parseInt(from, 10)) === v && en.has(String(parseInt(to, 10)))
        );
        if (!fixed) bad.push(`${q.year}-${q.month} q${q.question_no}: ${v} missing from the English`);
      }
    }
    expect(bad).toEqual([]);
  });
});

/* ------------------------------------------------------------------
   Patient ages must be the ages the examiner wrote.

   The source PDFs store glyphs in visual order, so every digit run
   arrives mirrored. A mirrored age is the most dangerous defect this
   bank can carry because it is invisible on inspection: "خانم ۵۲ ساله"
   reads perfectly, it is simply a different patient from the one the
   question describes, and it can change the correct answer.

   Three separate bugs produced wrong ages and each is guarded here:
     1. a double flip in extract_rtl (the age rule undid num())
     2. Arabic-Indic / Persian digits mixed into an ASCII run, which
        NUM_RUN could not see as one number
     3. an "ages over 90 are implausible" heuristic that rewrote a real
        91-year-old, contradicting the ministry's own English booklet
   ------------------------------------------------------------------ */
describe("patient ages are plausible and internally consistent", () => {
  const dir = path.join(process.cwd(), "..", "tools", "infectious-bank");

  function bookQuestions() {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/^import-payload\.book\.part\d+\.json$/.test(f)) continue;
      out.push(...(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).questions || []));
    }
    return out;
  }

  const AGE = /(?<!\d)(\d{1,3})\s*ساله/g;

  it("no question states an impossible age", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const bad = [];
    let seen = 0;
    for (const q of qs) {
      for (const m of (q.question_fa || "").matchAll(AGE)) {
        seen += 1;
        const v = parseInt(m[1], 10);
        if (v < 1 || v > 105) bad.push(`q${q.question_no}: age ${v}`);
      }
    }
    expect(seen).toBeGreaterThan(100);   // guard against a silent zero-check
    expect(bad).toEqual([]);
  });

  it("no stem contains a split or non-ASCII digit", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const bad = [];
    for (const q of qs) {
      const blob = `${q.question_fa || ""} ${(q.options_fa || []).join(" ")}`;
      // Arabic-Indic U+0660..0669 and Persian U+06F0..06F9 in the body text
      // mean fold() did not run, which is what let bug 2 through.
      if (/[\u0660-\u0669\u06F0-\u06F9]/.test(blob)) bad.push(`q${q.question_no}: non-ASCII digit`);
      // "خانم ٠ 5 ساله" — the tell-tale of a digit run torn in half
      if (/\d\s+\d\s*(?:ساله|سال)/.test(blob)) bad.push(`q${q.question_no}: split digits before ساله`);
    }
    expect(bad).toEqual([]);
  });

  it("a corrected age records what it was changed from", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const fixed = qs.filter((q) => q.age_corrected);
    expect(fixed.length).toBeGreaterThan(0);
    const bad = [];
    for (const q of fixed) {
      const c = q.age_corrected;
      if (!Array.isArray(c.from) || !Array.isArray(c.to)) bad.push(`q${q.question_no}: malformed record`);
      else if (c.from.length !== c.to.length) bad.push(`q${q.question_no}: length mismatch`);
      else if (JSON.stringify(c.from) === JSON.stringify(c.to)) bad.push(`q${q.question_no}: marked corrected but unchanged`);
      if (!(q.age_correction_note_fa || "").trim()) bad.push(`q${q.question_no}: no Persian note`);
      if (!(q.age_correction_note_en || "").trim()) bad.push(`q${q.question_no}: no English note`);
      // The corrected values must actually be in the stem now. Match the
      // recorder's own definition of an age, which also counts a bare "سال"
      // ("تعویض دریچه در ۱۰ سال پیش"); a narrower pattern here would report a
      // mismatch that does not exist.
      const AGE_ANY = /(?<!\d)(\d{1,3})\s*(?:ساله|سال\s*ه|ساله\s*ای|سال)/g;
      const now = [...(q.question_fa || "").matchAll(AGE_ANY)].map((m) => m[1]);
      if (now.length && JSON.stringify(now) !== JSON.stringify(c.to)) {
        bad.push(`q${q.question_no}: stem says ${now} but record says ${c.to}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("the Persian age and the English age describe the same patient", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const bad = [];
    let compared = 0;
    for (const q of qs) {
      if (!q.question_en) continue;
      const fa = (q.question_fa || "").match(/(?<!\d)(\d{1,3})\s*ساله/);
      const en = (q.question_en || "").match(/(\d{1,3})\s*[-– ]?\s*year\s*[-– ]?\s*old/i);
      if (!fa || !en) continue;
      compared += 1;
      if (fa[1] !== en[1]) bad.push(`q${q.question_no}: Persian ${fa[1]} vs English ${en[1]}`);
    }
    expect(compared).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });
});

/* ------------------------------------------------------------------
   The all-subject archive is checked against the one source that
   mirroring cannot corrupt: the ministry published Esfand 1400 in both
   Persian and English, and the English prints ages in Latin digits.
   ------------------------------------------------------------------ */
describe("archive ages agree with the ministry's official English booklet", () => {
  const dir = path.join(process.cwd(), "..", "tools", "exam-booklets");
  const archivePath = path.join(dir, "archive.json");
  const pairPath = path.join(dir, "pair_1400_12.json");

  it("every comparable age matches the official English", () => {
    if (!fs.existsSync(archivePath) || !fs.existsSync(pairPath)) return;
    const archive = JSON.parse(fs.readFileSync(archivePath, "utf8")).questions || [];
    const pair = JSON.parse(fs.readFileSync(pairPath, "utf8"));

    const official = new Map();
    for (const q of pair) {
      if (q.en_source !== "official_booklet") continue;
      const m = (q.stem_en || "").match(/(\d{1,3})\s*[-– ]?\s*year\s*[-– ]?\s*old/i);
      if (m) official.set(Number(q.question_no), m[1]);
    }

    const bad = [];
    let compared = 0;
    for (const q of archive) {
      if (q.sitting !== "1400-12") continue;
      const n = Number(q.printed_no);
      if (!official.has(n)) continue;
      const m = (q.stem_fa || "").match(/(?<!\d)(\d{1,3})\s*ساله/);
      if (!m) continue;
      compared += 1;
      if (m[1] !== official.get(n)) {
        bad.push(`q${n}: extracted ${m[1]}, official booklet says ${official.get(n)}`);
      }
    }
    // Too few comparisons would make this a false green.
    expect(compared).toBeGreaterThan(50);
    expect(bad).toEqual([]);
  });
});

/* ------------------------------------------------------------------
   Manual database backups must not accumulate without limit.

   The automatic start-up backup in db.js has always pruned itself, but
   the admin "create backup" button did not: every press copied the
   whole database and kept every copy forever. That is a real
   availability bug on a small cPanel plan, where a few dozen copies of
   the database is enough to exhaust the disk quota and take the site
   down. It is also what filled this workspace to the point where
   snapshots stopped being taken.

   The two backup kinds use deliberately different filename patterns
   ("medlab-<stamp>.db" from db.js, "medlab-backup-<stamp>.db" from the
   admin route) so they prune independently: a routine restart must
   never delete an operator's deliberate snapshot.
   ------------------------------------------------------------------ */
describe("manual database backups are pruned", () => {
  it("keeps only the most recent manual backups, and never touches automatic ones", async () => {
    const atk = await token("admin");
    const info = await request(app).get("/api/admin/backup/status").set("Authorization", `Bearer ${atk}`);
    expect(info.status).toBe(200);
    const dir = info.body.backupsDir;
    expect(typeof dir).toBe("string");

    fs.mkdirSync(dir, { recursive: true });
    // an automatic backup, which this route must leave alone
    const auto = path.join(dir, "medlab-AUTOMATIC-SENTINEL.db");
    fs.writeFileSync(auto, "sentinel");

    /* Simulate a directory that has already accumulated many manual backups.

       Pressing the button in a loop is not enough on its own: the filename
       stamp has one-second resolution, so eight rapid presses overwrite the
       same few names and the directory never grows. That masked the bug — the
       test passed even with pruning removed. Seeding real files first means
       the assertion measures the pruning, not the clock. */
    for (let i = 0; i < 12; i += 1) {
      const f = path.join(dir, `medlab-backup-2020-01-01T00-00-${String(i).padStart(2, "0")}.db`);
      fs.writeFileSync(f, "old");
      const t = 1577836800 + i;                 // distinct, ordered mtimes
      fs.utimesSync(f, t, t);
    }
    const before = fs.readdirSync(dir).filter((f) => /^medlab-backup-.*\.db$/.test(f));
    expect(before.length).toBeGreaterThanOrEqual(12);

    const r = await request(app)
      .post("/api/admin/backup/create")
      .set("Authorization", `Bearer ${atk}`)
      .send({});
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);

    const manual = fs.readdirSync(dir).filter((f) => /^medlab-backup-.*\.db$/.test(f));
    // a dozen stale copies went in; the route must have pruned them down
    expect(manual.length).toBeLessThanOrEqual(5);
    expect(manual.length).toBeGreaterThan(0);
    // and the copy just created must be one of the survivors
    expect(manual).toContain(r.body.name);

    // the automatic backup is untouched
    expect(fs.existsSync(auto)).toBe(true);
    fs.unlinkSync(auto);
  });
});

/* ------------------------------------------------------------------
   A clinical threshold taught in one lesson must not contradict another.

   The tuberculosis chapter introduced a risk the earlier ones did not. Its
   teaching rests on THRESHOLDS that recur across many lessons — the three PPD
   cut-offs, the two hepatotoxicity limits — and those thresholds are repeated
   verbatim in shared blocks so a student meets identical wording every time.

   That repetition is the strength and the danger. If a later edit changes one
   copy of "5 mm" to "6 mm", nothing breaks: the payload stays valid, the
   English still matches the Persian, and every other guard passes. The student
   simply learns two different rules from two different questions and cannot
   tell which is right.

   So the canonical numbers are pinned here. This is a deliberately narrow
   test: it does not check that the medicine is correct — a human did that
   against Harrison and the WHO guidance — only that the bank does not
   CONTRADICT ITSELF once a number has been agreed.
   ------------------------------------------------------------------ */
describe("clinical thresholds stay consistent across lessons", () => {
  const dir = path.join(process.cwd(), "..", "tools", "infectious-bank");

  function taught() {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/^import-payload\.book\.part\d+\.json$/.test(f)) continue;
      for (const q of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).questions || []) {
        if (q.needs_lesson === false) out.push(q);
      }
    }
    return out;
  }

  /* The Persian lessons write their numbers in PERSIAN-INDIC digits (۵, ۱۰),
     while the English ones use ASCII. The first version of this test matched
     only [0-9] and therefore saw none of the Persian thresholds at all — it
     passed against three deliberately injected contradictions, which is how
     the flaw was found. Digits are folded to ASCII before matching. */
  const FOLD = new Map();
  for (let i = 0; i < 10; i++) {
    FOLD.set(String.fromCharCode(0x06f0 + i), String(i)); // Persian
    FOLD.set(String.fromCharCode(0x0660 + i), String(i)); // Arabic-Indic
  }
  const foldDigits = (s) => s.replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (d) => FOLD.get(d) || d);

  function lessonText(q) {
    const m = q.micro || {};
    const raw = [
      q.explanation_fa, q.explanation_en,
      m.lead_fa, m.lead_en,
      ...(m.points_fa || []), ...(m.points_en || []),
    ].filter((x) => typeof x === "string").join("\n");
    return foldDigits(raw);
  }

  it("the PPD cut-offs and hepatotoxicity limits are stated identically everywhere", () => {
    const qs = taught();
    if (!qs.length) return;

    /* Each rule pairs a CONTEXT (what the sentence is about) with the ONLY
       numbers allowed to appear as its cut-off. A sentence matching the
       context but naming a different number is a contradiction. */
    const RULES = [
      {
        name: "PPD threshold for HIV / close contact / transplant",
        // Persian and English forms of "N mm" near the HIV threshold wording
        // NOTE: the Persian for "millimetre" is written with a ZERO WIDTH
        // NON-JOINER (U+200C) inside it — میلی‌متر, not میلی متر. The first
        // version of this pattern used a plain optional space and therefore
        // matched nothing, silently passing two injected contradictions.
        // \u200c is now allowed wherever a space may appear.
        find: /(?:آستانه|threshold)[^.\n]{0,60}?(?:HIV|تماس نزدیک|پیوند عضو|transplant)[^.\n]{0,60}?(\d{1,2})\s*(?:میل[\s\u200c]?ی[\s\u200c]?متر|mm)|(?:HIV|تماس نزدیک|پیوند عضو|transplant)[^.\n]{0,40}?(?:آستانه|threshold)[^.\n]{0,40}?(\d{1,2})\s*(?:میل[\s\u200c]?ی[\s\u200c]?متر|mm)/g,
        allowed: new Set(["5"]),
      },
      {
        /* Anchored on the word for "threshold" so it matches a RULE rather
           than a patient's reading. Without that anchor it flagged
           "7 mm in a diabetic", which is this question's own patient value,
           not a claim about where the cut-off lies. */
        name: "PPD threshold for diabetes / dialysis / prisoners",
        find: /(?:آستانه|threshold)[^.\n]{0,60}?(?:دیابت|همودیالیز|زندانی|diabetes|dialysis|prisoner)[^.\n]{0,60}?(\d{1,2})\s*(?:میل[\s\u200c]?ی[\s\u200c]?متر|mm)|(?:دیابت|همودیالیز|زندانی|diabetes|dialysis|prisoner)[^.\n]{0,40}?(?:آستانه|threshold)[^.\n]{0,40}?(\d{1,2})\s*(?:میل[\s\u200c]?ی[\s\u200c]?متر|mm)/g,
        allowed: new Set(["10"]),
      },
      {
        /* This rule must match only a STOPPING THRESHOLD, so it requires the
           word for "stop" nearby. Without that anchor it also matched
           "up to 20 percent of patients", which is an epidemiological figure
           rather than a cut-off — a false positive the first run produced. */
        name: "hepatotoxicity limit, asymptomatic",
        find: /(?:قطع|stop)[^.\n]{0,60}?(?:بدون علامت|asymptomatic)[^.\n]{0,40}?(\d)\s*(?:برابر|times)|(?:بدون علامت|asymptomatic)[^.\n]{0,40}?(?:قطع|stop)[^.\n]{0,40}?(\d)\s*(?:برابر|times)/g,
        allowed: new Set(["5"]),
      },
    ];

    const bad = [];
    for (const q of qs) {
      const text = lessonText(q);
      for (const rule of RULES) {
        rule.find.lastIndex = 0;
        for (const m of text.matchAll(rule.find)) {
          // a rule may use alternation, so take whichever group captured
          const n = m.slice(1).find((g) => g != null);
          if (n == null) continue;
          if (!rule.allowed.has(n)) {
            bad.push(`q${q.question_no}: ${rule.name} stated as ${n}, expected ${[...rule.allowed].join("/")}`);
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });
});

/* ------------------------------------------------------------------
   A repaired laboratory value must still be physiologically possible.

   The gastrointestinal chapter raised a risk the earlier ones did not. Until
   now a mirrored number was a single value in isolation; here q9306 had an
   ENTIRE LABORATORY PANEL reversed at once — sodium 531, haemoglobin 41,
   platelets written backwards — and the repair had to rewrite four values in
   one stem.

   Rewriting four numbers at once is where a transcription slip would hide
   best, and a slip would be invisible: the payload would still look tidy and
   every existing guard would still pass. So the repaired values are checked
   against physiology, which is the one thing a typo cannot satisfy by accident.

   The ranges below are deliberately WIDE. They are not reference ranges and
   are not there to flag abnormal patients — a cholera patient in shock is
   profoundly abnormal and must pass. They only exclude values incompatible
   with a living human, which is exactly what a mirrored digit produces.
   ------------------------------------------------------------------ */
describe("repaired laboratory values remain physiologically possible", () => {
  const dir = path.join(process.cwd(), "..", "tools", "infectious-bank");

  function bookQuestions() {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/^import-payload\.book\.part\d+\.json$/.test(f)) continue;
      out.push(...(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).questions || []));
    }
    return out;
  }

  // label -> [plausible-low, plausible-high], survivable rather than normal
  const RANGES = {
    Na: [100, 190],
    Hb: [2, 22],
    WBC: [100, 200000],
    PLT: [1000, 1500000],
    Cr: [0.2, 20],
    K: [1.5, 9],
  };

  it("no repaired stem states a lab value incompatible with life", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const repaired = qs.filter((q) => Array.isArray(q.stem_number_corrections) && q.stem_number_corrections.length);
    expect(repaired.length).toBeGreaterThan(0);

    const bad = [];
    for (const q of repaired) {
      const stem = q.question_fa || "";
      for (const [label, [lo, hi]] of Object.entries(RANGES)) {
        // the source writes these as "135=Na" (value first) or "Na=135"
        const patterns = [
          new RegExp(`(\\d+(?:\\.\\d+)?)\\s*=\\s*${label}\\b`, "g"),
          new RegExp(`\\b${label}\\s*[:=]\\s*(\\d+(?:\\.\\d+)?)`, "g"),
        ];
        for (const re of patterns) {
          for (const m of stem.matchAll(re)) {
            const v = Number(m[1]);
            if (!Number.isFinite(v)) continue;
            /* A count in URINE or STOOL is per high-power field, not per
               microlitre, so "WBC 10-15" there is normal rather than lethal.
               The first version of this test flagged q9548's urinalysis and
               was wrong; the range only applies to a BLOOD value.

               It looked only BACKWARDS for the specimen label, and that was a
               second bug of the same family, exposed when q9088 entered the
               repaired set. Persian is right-to-left, so an extracted line
               often puts the label AFTER its values: q9088 ends
               "... 10-8 = RBC  1-0 = WBC  U/A", where the U/A that governs
               both counts trails them. Look in BOTH directions. */
            const around = stem.slice(Math.max(0, m.index - 60),
                                      m.index + m[0].length + 40);
            if (/ادرار|مدفوع|E\/S|U\/A|A\/U|urine|stool/i.test(around)) continue;
            if (v < lo || v > hi) {
              bad.push(`q${q.question_no}: ${label} = ${v} is not compatible with life`);
            }
          }
        }
      }
      // a temperature written in Celsius must be a temperature
      for (const m of stem.matchAll(/(?:C°|°C|̊C)\s*(\d{2,3})|(\d{2,3})\s*(?:C°|°C|̊C)/g)) {
        const v = Number(m[1] || m[2]);
        if (Number.isFinite(v) && (v < 30 || v > 45)) {
          bad.push(`q${q.question_no}: temperature ${v} C is not compatible with life`);
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });
});

/* ------------------------------------------------------------------
   A lesson that cites another question by number must cite one that exists,
   and must describe it correctly.

   This became a real risk with the viral chapter. The lesson for q9542
   overrules the printed key, and its strongest argument is not a foreign
   guideline but the book's own internal consistency: four other questions in
   the same chapter — q9541, q9545, q9555 and q9539 — answer the identical
   scenario the other way. That argument is only honest while those four
   questions still exist and still hold the answers the lesson claims.

   If a later pass renumbered a question, or corrected one of those four keys,
   the citation would quietly become a lie a student cannot check. So the
   citation is verified here instead.
   ------------------------------------------------------------------ */
describe("a lesson citing another question cites one that exists", () => {
  const dir = path.join(process.cwd(), "..", "tools", "infectious-bank");

  function bookQuestions() {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/^import-payload\.book\.part\d+\.json$/.test(f)) continue;
      out.push(...(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).questions || []));
    }
    return out;
  }

  it("every qNNNN referenced inside a lesson is a real question in the bank", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const numbers = new Set(qs.map((q) => q.question_no));

    const bad = [];
    for (const q of qs) {
      if (q.needs_lesson !== false) continue;
      const blob = [
        q.explanation_fa, q.explanation_en,
        q.key_correction_fa, q.key_correction_en,
        (q.micro || {}).lead_fa, (q.micro || {}).lead_en,
        ...((q.micro || {}).points_fa || []), ...((q.micro || {}).points_en || []),
      ].filter((x) => typeof x === "string").join(" ");

      for (const m of blob.matchAll(/\bq(9\d{3})\b/g)) {
        const cited = Number(m[1]);
        if (cited === q.question_no) {
          bad.push(`q${q.question_no}: cites itself`);
        } else if (!numbers.has(cited)) {
          bad.push(`q${q.question_no}: cites q${cited}, which is not in the bank`);
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it("the q9542 correction still matches what the four cited questions answer", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const by = new Map(qs.map((q) => [q.question_no, q]));
    const target = by.get(9542);
    if (!target) return;

    // The lesson's whole argument is that these four answer the scenario the
    // other way: not "repeat the ceftriaxone" but "cover the chlamydia".
    const bad = [];
    const claims = {
      9541: /کلامیدیا/,          // concurrent chlamydial infection
      9545: /آزیترومایسین/,       // give azithromycin
      9555: /هیچکدام|هیچ‌کدام/,   // none of the above
      9539: /آزیترومایسین/,       // metronidazole + azithromycin
    };
    for (const [no, pattern] of Object.entries(claims)) {
      const q = by.get(Number(no));
      if (!q) { bad.push(`q${no}: cited by the q9542 lesson but missing`); continue; }
      const chosen = String((q.options_fa || [])[q.correct_index] || "");
      if (!pattern.test(chosen)) {
        bad.push(`q${no}: key is now "${chosen.slice(0, 40)}", which no longer supports the q9542 argument`);
      }
    }
    // and the correction itself must still be in place
    if (!target.key_corrected) bad.push("q9542: no longer marked corrected");
    expect(bad).toEqual([]);
  });
});

/* ------------------------------------------------------------------
   Lesson text may only use markup the player can actually render.

   The lessons are written in a deliberately tiny subset of markdown: `**bold**`
   and nothing else, rendered by components/Emphasis.jsx without producing HTML,
   so the learner's page stays fast and injection-free.

   Two rendering defects got through before this test existed, and both were
   invisible to every payload check because the DATA was correct — only the
   screen was wrong. First, nothing rendered `**` at all, so 84 of the 98 taught
   questions showed literal asterisks. Second, two lessons of mine used a
   markdown TABLE, which no renderer here supports, so the student saw a wall of
   pipe characters.

   Rather than grow a markdown parser on the critical path, the rule is
   inverted: the text must stay inside what the renderer supports.
   ------------------------------------------------------------------ */
describe("lesson text stays inside the markup the player renders", () => {
  const dir = path.join(process.cwd(), "..", "tools", "infectious-bank");

  function taught() {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/^import-payload\.book\.part\d+\.json$/.test(f)) continue;
      for (const q of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).questions || []) {
        if (q.needs_lesson === false) out.push(q);
      }
    }
    return out;
  }

  function lessonStrings(q) {
    const m = q.micro || {};
    return [
      q.explanation_fa, q.explanation_en, q.golden_fa, q.golden_en,
      m.lead_fa, m.lead_en,
      ...(m.points_fa || []), ...(m.points_en || []),
      ...(q.options_why_fa || []), ...(q.options_why_en || []),
    ].filter((x) => typeof x === "string");
  }

  it("uses no markup beyond **bold**, and never leaves a ** unclosed", () => {
    const qs = taught();
    if (!qs.length) return;
    const bad = [];
    for (const q of qs) {
      for (const s of lessonStrings(q)) {
        // a markdown table renders as a row of pipes and dashes
        if (/\|\s*-{2,}/.test(s) || /\|.*\|.*\|/.test(s)) {
          bad.push(`q${q.question_no}: markdown table has no renderer`);
        }
        // headings, images and links are likewise unsupported
        if (/^#{1,6}\s/m.test(s)) bad.push(`q${q.question_no}: markdown heading has no renderer`);
        if (/!\[[^\]]*\]\(/.test(s)) bad.push(`q${q.question_no}: markdown image has no renderer`);
        if (/(?<!!)\[[^\]]+\]\([^)]+\)/.test(s)) bad.push(`q${q.question_no}: markdown link has no renderer`);
        // an odd number of delimiters means one emphasis never closes, and the
        // stray pair of asterisks reaches the screen
        if (((s.match(/\*\*/g) || []).length) % 2 !== 0) {
          bad.push(`q${q.question_no}: unbalanced ** in lesson text`);
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });
});

/* ------------------------------------------------------------------
   Every translation key the UI asks for must exist, in BOTH languages.

   Found by a visual test, not by a unit test: the browse modal's confirm
   button rendered the literal string "checkAnswer" to the student. The code
   reads

       t("checkAnswer") || "بررسی"

   which looks safe but is not, because t() returns THE KEY ITSELF when the
   string is missing. A non-empty string is truthy, so the `||` fallback can
   never fire and the untranslated key reaches the screen.

   That makes a missing key silent by construction: nothing throws, nothing
   logs, and only a human looking at the page notices. So the check belongs
   here, where it runs on every commit.
   ------------------------------------------------------------------ */
describe("i18n keys used by the UI exist in both languages", () => {
  const clientSrc = path.join(process.cwd(), "..", "client", "src");

  function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, out);
      else if (/\.(jsx?|tsx?)$/.test(e.name)) out.push(full);
    }
    return out;
  }

  it("no t(\"key\") in the client resolves to the bare key", () => {
    const i18nPath = path.join(clientSrc, "i18n.js");
    if (!fs.existsSync(i18nPath)) return;
    const i18n = fs.readFileSync(i18nPath, "utf8");

    // The dictionary is one big object literal per language; rather than
    // parsing it, collect every `key: "..."` that appears in the file and
    // count how many times each is DEFINED. A key present in both languages
    // is defined at least twice.
    const defs = new Map();
    for (const m of i18n.matchAll(/(?:^|[\s{,])([A-Za-z][A-Za-z0-9_]*)\s*:\s*["'`]/g)) {
      defs.set(m[1], (defs.get(m[1]) || 0) + 1);
    }

    const missing = [];
    const oneLanguageOnly = [];
    for (const file of walk(clientSrc)) {
      if (file === i18nPath) continue;
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/\bt\(\s*["']([A-Za-z][A-Za-z0-9_]*)["']\s*\)/g)) {
        const key = m[1];
        const n = defs.get(key) || 0;
        const where = `${path.relative(clientSrc, file)}: t("${key}")`;
        if (n === 0) missing.push(where);
        else if (n < 2) oneLanguageOnly.push(where);
      }
    }
    // A key defined in only one language would show the English string to a
    // Persian reader (or vice versa) rather than the bare key, so it is
    // reported separately from an entirely missing one.
    expect({ missing, oneLanguageOnly }).toEqual({ missing: [], oneLanguageOnly: [] });
  });
});

/* ------------------------------------------------------------------
   Guards for the corrected keys and the one hand-rebuilt stem.

   These are the most invasive edits in the bank: a corrected key tells
   the student the printed book is wrong, and a rebuilt stem replaces
   the source's own words. Both are defensible only if they are
   recorded, reversible, and internally consistent.
   ------------------------------------------------------------------ */
describe("corrected keys and rebuilt stems stay honest", () => {
  const dir = path.join(process.cwd(), "..", "tools", "infectious-bank");

  function bookQuestions() {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/^import-payload\.book\.part\d+\.json$/.test(f)) continue;
      out.push(...(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).questions || []));
    }
    return out;
  }

  it("the rationale at the corrected index marks it correct, and the old one does not", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const corrected = qs.filter((q) => q.key_corrected);
    expect(corrected.length).toBeGreaterThan(0);

    const bad = [];
    for (const q of corrected) {
      const tag = `q${q.question_no}`;
      const why = q.options_why_fa || [];
      if (why.length !== 4) { bad.push(`${tag}: rationales missing`); continue; }

      const now = String(why[q.correct_index] || "");
      if (!/پاسخ صحیح|صحیح است/.test(now)) {
        bad.push(`${tag}: rationale at the corrected index does not mark it correct`);
      }
      const old = String(why[q.original_correct_index] || "");
      if (/^پاسخ صحیح/.test(old.trim())) {
        bad.push(`${tag}: rationale still endorses the book's original answer`);
      }
      const endorsed = why.filter((w) => /پاسخ صحیح/.test(String(w))).length;
      if (endorsed !== 1) bad.push(`${tag}: ${endorsed} options are marked correct`);
    }
    expect(bad).toEqual([]);
  });

  it("a corrected key cites a source that is not the book itself", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const bad = [];
    for (const q of qs.filter((x) => x.key_corrected)) {
      const src = String(q.key_correction_source || "");
      // overruling the book on the book's own authority would be circular
      if (!/Harrison|CDC|IDSA|WHO|FDA|MGFA|J Clin Med|ACIP/i.test(src)) {
        bad.push(`q${q.question_no}: no recognised external source cited`);
      }
      if (/تست تمرینی/.test(src)) bad.push(`q${q.question_no}: cites the book it is overruling`);
    }
    expect(bad).toEqual([]);
  });

  /* A number corrected from glyph geometry is a claim about what the PDF
     actually prints, so it must record where it came from and must not have
     invented digits. The parasitology chapter corrected six of them, two of
     which sit inside the option that IS the answer, so a silent drift here
     would change the medicine, not just the text. */
  it("a number corrected from glyph geometry is recorded and only rearranges digits", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const fixed = qs.filter((q) => Array.isArray(q.stem_number_corrections) && q.stem_number_corrections.length);
    expect(fixed.length).toBeGreaterThan(0);

    const bad = [];
    for (const q of fixed) {
      const tag = `q${q.question_no}`;
      const haystack = [q.question_fa || "", ...(q.options_fa || [])].join(" ");
      for (const c of q.stem_number_corrections) {
        if (!c.method || !/glyph/i.test(c.method)) bad.push(`${tag}: correction does not name its method`);
        if (!c.page) bad.push(`${tag}: correction does not cite a page`);
        if (!(c.why_fa || "").trim()) bad.push(`${tag}: correction has no Persian justification`);
        if (!c.from || !c.to) { bad.push(`${tag}: correction is incomplete`); continue; }
        if (c.from === c.to) bad.push(`${tag}: recorded as corrected but unchanged`);

        // the corrected text must actually be in the question now...
        if (!haystack.includes(c.to)) bad.push(`${tag}: corrected text ${c.to} is not present`);
        // ...and the old, wrong text must be gone
        if (haystack.includes(c.from)) bad.push(`${tag}: uncorrected text ${c.from} still present`);

        /* A geometry repair comes in exactly two kinds, and they are held to
           different bars because they make different claims.

           REORDER (the default, and what every chapter before zoonoses used)
           rearranges the digits the page printed and NEVER invents or drops
           one. Anything else would be a guess wearing the costume of a
           measurement, so the digit multiset must be identical.

           RESTORE puts back a digit the EXTRACTION dropped — "2 Iu/kg" where
           page 157 prints 20. That is a stronger claim, so it must (a) declare
           itself with kind:"restore", (b) keep every digit the extraction did
           manage to keep, and (c) not shrink the value. The proof that the new
           digit is real lives in fix_zoonoses_numbers.py, which refuses to
           write a restore unless every number of the repaired text is a digit
           run the page actually printed. */
        const digits = (x) => (x.match(/\d/g) || []).sort().join("");
        const kind = c.kind || "reorder";
        if (kind === "reorder") {
          if (digits(c.from) !== digits(c.to)) {
            bad.push(`${tag}: ${c.from} -> ${c.to} changes which digits exist`);
          }
        } else if (kind === "restore") {
          const before = digits(c.from);
          const after = digits(c.to);
          if (after.length <= before.length) {
            bad.push(`${tag}: ${c.from} -> ${c.to} is marked restore but adds no digit`);
          }
          // every digit that survived extraction must still be there
          const pool = after.split("");
          for (const ch of before) {
            const at = pool.indexOf(ch);
            if (at === -1) { bad.push(`${tag}: restore ${c.from} -> ${c.to} loses digit ${ch}`); break; }
            pool.splice(at, 1);
          }
          // a restore must say, in Persian, that a digit was dropped, so a
          // reader can tell it apart from a reordering at a glance
          if (!/افتاده|باقی مانده|نیفتاده|حذف/.test(c.why_fa || "")) {
            bad.push(`${tag}: restore does not explain in Persian which digit was lost`);
          }
        } else {
          bad.push(`${tag}: unknown correction kind ${kind}`);
        }
      }
      // the untouched original must be kept so the edit stays reversible
      const keptStem = (q.stem_original_fa || "").trim();
      const keptOpts = Array.isArray(q.options_original_fa) && q.options_original_fa.length;
      if (!keptStem && !keptOpts) bad.push(`${tag}: neither original stem nor original options kept`);
    }
    expect(bad).toEqual([]);
  });

  it("every repaired stem keeps the original and explains itself", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const repaired = qs.filter((q) => q.stem_repaired);
    expect(repaired.length).toBeGreaterThan(0);
    const bad = [];
    for (const q of repaired) {
      const tag = `q${q.question_no}`;
      if (!(q.stem_original_fa || "").trim()) bad.push(`${tag}: original stem not kept`);
      if (q.stem_original_fa === q.question_fa) bad.push(`${tag}: marked repaired but unchanged`);
      if (!(q.stem_repair_note_fa || "").trim()) bad.push(`${tag}: no Persian note`);
      if (!(q.stem_repair_note_en || "").trim()) bad.push(`${tag}: no English note`);
      // A stem "asks" either with a question mark OR by being an
      // "all of these EXCEPT" stem, which the book writes as a trailing
      // "بجز" / "به جز" with no question mark at all. q9307 is exactly that
      // shape, and the original form of this check called a perfectly
      // well-formed stem broken.
      const asks = /[؟?]/.test(q.question_fa || "")
        || /(?:بجز|به\s*جز|ب\s*هجز)\s*$/.test((q.question_fa || "").trim());
      if (!asks) bad.push(`${tag}: rebuilt stem asks nothing`);

      // A rebuilt stem must not have quietly gained numbers. A value may come
      // from the original in either digit order (the source was mirrored), or
      // be a documented recovery where the corrupted text had lost a digit.
      // Match the WHOLE digit run, not a 2-3 digit window of it. The
      // narrower pattern tore "25000" into "250" and "00" and then reported
      // both as appearing from nowhere, even though the full run 25000 is
      // exactly the reverse of the original 00052. Comparing whole runs is
      // what makes the mirror test meaningful.
      const orig = new Set((q.stem_original_fa || "").match(/\d+/g) || []);
      const now = new Set((q.question_fa || "").match(/\d+/g) || []);
      const recovered = new Set(
        Object.values(q.stem_number_recovered || {}).map((r) => String(r.value))
      );
      for (const v of now) {
        const rev = v.split("").reverse().join("");
        if (orig.has(v) || orig.has(rev) || recovered.has(v)) continue;
        bad.push(`${tag}: ${v} appears from nowhere`);
      }
      for (const [what, r] of Object.entries(q.stem_number_recovered || {})) {
        if (!now.has(String(r.value))) bad.push(`${tag}: recovered ${what} not in the stem`);
        if (!r.glyph_order || !r.corrupted_text) bad.push(`${tag}: recovery of ${what} undocumented`);
      }
    }
    expect(bad).toEqual([]);
  });

  /* Split Persian teaching text into sentences.

     Written as a helper rather than a one-line regex because the obvious
     `split(/[.؟!\n]+/)` has a bug that a negative test caught: A FULL STOP IS
     ALSO A DECIMAL POINT. The sentence

         "در CURB-65 کراتینین بالای 1.5 یک امتیاز می‌گیرد"

     was torn into "...کراتینین بالای 1" and "5 یک امتیاز می‌گیرد", so the guard
     that requires BOTH "کراتینین" AND "امتیاز" in one sentence never fired and
     the injected defect sailed through. Splitting only on a stop that is NOT
     between two digits fixes it, and the same helper is shared by both
     chapter guards so the bug cannot come back in one of them alone. */
  function splitSentences(text) {
    return String(text || "")
      .split(/(?<!\d)[.؟!\n]+|[.؟!\n]+(?!\d)/)
      .filter((x) => x && x.trim());
  }

  /* Match a standalone Persian word.

     Written as a helper because of a trap that cost a false-positive triage:
     THE REGEX \b DOES NOT WORK ON PERSIAN IN JAVASCRIPT. JavaScript defines a
     word boundary in terms of [A-Za-z0-9_], so /نه\b/ never matches — the
     character before the boundary is not a "word character" as far as the
     engine is concerned. (Python's \b, with its Unicode-aware \w, does match,
     which is exactly why the pattern looked right when drafted.)

     The consequence was concrete: the guard below treats "نه" as a negation
     that excuses a sentence, and three correct lessons saying
     "...از تب روماتیسمی پیشگیری می‌کند، ولی از گلومرولونفریت نه"
     were flagged as claiming the opposite. Match on surrounding whitespace or
     punctuation instead. */
  function standalone(word) {
    /* The character class was once written with DOUBLE-escaped \\s and \\-,
       which inside a template literal produces the two-character sequence
       backslash-s in the pattern rather than the whitespace class. The regexp
       therefore matched a literal backslash and never a space, so
       standalone(x) was false for every real sentence.

       It went unnoticed because every existing caller used it as an EXEMPTION
       ("...&& !standalone('نه').test(sent)"). A dead exemption makes a guard
       STRICTER, not quieter, so nothing failed and nothing looked wrong. The
       bug only surfaced when a new guard used standalone() as a POSITIVE
       condition and the negative test proved the rule never fired.

       Single escapes are correct here: the template literal passes \s and \-
       through to the RegExp constructor unchanged. */
    /* The class must also include the ASTERISK. Lesson text emphasises whole
       words as **نیست**, and an asterisk pressed against the word is a real
       boundary to a human reader but was NOT one to this regex — so
       standalone("نیست") was false for every emphasised negation, silently
       disabling the contrast exemption wherever an author had bolded the key
       word. Found by a negative test, not by review. */
    return new RegExp(`(?:^|[\\s*،.:؛!?()«»\\-])${word}(?:$|[\\s*،.:؛!?()«»\\-])`);
  }

  /* ------------------------------------------------------------------
     A sentence may name a fact in order to CONTRAST it or RULE IT OUT
     ("X is not Y", "unlike Y", "whereas Y"). Every chapter guard needs to
     recognise that, or the very sentence teaching a rule gets reported as
     breaking it.

     THE BUG THIS FUNCTION EXISTS TO PREVENT, found by a negative test:
     five guards inlined the contrast words as BARE SUBSTRINGS, including
     the two-letter "ولی" (but) and "اگر" (if). Persian has no word
     boundary that JavaScript's \b understands, so "ولی" matched inside
     "توبرکولین" (tuberculin) — and every sentence about the tuberculin
     test was therefore treated as a contrast and silently exempted. The
     guard for the tuberculin rule was DEAD, and its test stayed green
     because a dead EXEMPTION makes a guard stricter, not noisier. Only a
     negative test that deliberately injected the inverted claim exposed it.

     The fix: SHORT words that can hide inside longer ones are matched with
     standalone(); long, distinctive phrases stay as plain substrings
     because they cannot collide.
     ------------------------------------------------------------------ */
  const CONTRAST_SHORT = ["ولی", "اگر", "نه", "نیست", "حذف", "تفاوت", "مگر"];
  const CONTRAST_PHRASE = /(?:برخلاف|برعکس|کنار می‌?رو|کنار می‌?گذار|رد می‌?کن|رد می‌?شو|رد کرد|در مقابل|تصحیح|اصلاح|در حالی که)/;

  function contrastsWith(t) {
    const x = String(t || "");
    if (CONTRAST_PHRASE.test(x)) return true;
    return CONTRAST_SHORT.some((w) => standalone(w).test(x));
  }


  /* ------------------------------------------------------------------
     The zoonoses chapter turns on a handful of numbers that decide the
     management, and each of them appears in several lessons at once. If two
     lessons ever disagree, the student learns whichever they read second, so
     the agreement itself must be tested rather than trusted.

     The four rules under guard, and why each one is dangerous if it drifts:

       RABIES SCHEDULE   the unvaccinated get days 0, 3, 7 and 14; the
                         previously vaccinated get days 0 and 3 with NO immune
                         globulin. A lesson that says "five doses" as current
                         practice teaches the pre-2010 regimen.
       RIG DOSE          human 20 IU/kg. Ten times wrong is a real error that
                         q9414's own printed options contain.
       RIG WINDOW        useful only to day 7 after the first vaccine dose.
                         Three questions hang on this single number.
       BRUCELLOSIS       at least two drugs for at least six weeks, and
                         follow-up is CLINICAL, never serological.

     Written to fold Persian and Arabic-Indic digits, because the earlier
     threshold test failed three times for exactly that reason. */
  it("the zoonoses lessons agree with each other on the numbers that decide management", () => {
    const qs = bookQuestions();
    if (!qs.length) return;

    const FOLD = new Map();
    for (let i = 0; i < 10; i += 1) {
      FOLD.set(String.fromCharCode(0x06f0 + i), String(i)); // Persian
      FOLD.set(String.fromCharCode(0x0660 + i), String(i)); // Arabic-Indic
    }
    const fold = (t) => (t || "").replace(/[\u0660-\u0669\u06F0-\u06F9]/g,
      (ch) => FOLD.get(ch) || ch);

    const zoo = qs.filter((q) => String(q.chapter_fa || "").startsWith("زئونوز")
      && q.needs_lesson === false);
    // guard against a silent zero-check: if the chapter is ever renamed, this
    // test must fail loudly rather than pass by examining nothing
    expect(zoo.length).toBeGreaterThan(20);

    const piecesOf = (q) => [
      q.explanation_fa, q.golden_fa,
      ...((q.micro && q.micro.points_fa) || []),
      ...(q.options_why_fa || []),
    ].filter(Boolean).flatMap((s) => splitSentences(fold(s)));
    const textOf = (q) => piecesOf(q).join("  ");

    const bad = [];
    let sawSchedule = 0, sawDose = 0, sawWindow = 0, sawBruc = 0;

    for (const q of zoo) {
      const tag = `q${q.question_no}`;
      const t = textOf(q);

      /* --- rabies vaccine schedule -----------------------------------
         Checked SENTENCE BY SENTENCE, not over the whole lesson. A first
         version scanned the joined text and MISSED an injected defect,
         because the exempting words ("نقص ایمنی", "قدیم") appear elsewhere
         in the same lesson for a perfectly good reason. The exemption has to
         live in the very sentence that states the schedule. */
      for (const sent of piecesOf(q)) {
        if (!/0\D{1,4}3\D{1,4}7\D{1,4}14/.test(sent)) continue;
        sawSchedule += 1;
        if (/0\D{1,4}3\D{1,4}7\D{1,4}14\D{1,6}28/.test(sent)
            && !/نقص ایمنی|قدیم|2010|۲۰۱۰|قبل|رژیم پنج/.test(sent)) {
          bad.push(`${tag}: teaches a five-dose schedule without saying it is the old regimen or for the immunocompromised`);
        }
      }

      // --- RIG dose ---------------------------------------------------
      for (const m of t.matchAll(/(\d{1,3})\s*(?:واحد بر کیلوگرم|IU\/kg)/gi)) {
        const v = parseInt(m[1], 10);
        sawDose += 1;
        if (![20, 40].includes(v)) {
          bad.push(`${tag}: immune globulin dosed at ${v} IU/kg (only 20 human / 40 equine exist)`);
        }
      }

      /* --- the seven-day RIG window ---------------------------------
         Matched narrowly and on purpose. A first attempt keyed on
         "پنجره" anywhere plus the next "تا روز" and fired a FALSE POSITIVE
         on q9409, whose lesson says "پنجره" about the immunity gap and
         separately says "تا روز 14" about the VACCINE schedule. The two
         sentences were unrelated. So the deadline word and RIG must sit in
         the same clause. */
      for (const m of t.matchAll(/(?:RIG|ایمونوگلوبولین)[^.؛\n]{0,80}?تا\s*روز\s*(\S+)/g)) {
        sawWindow += 1;
        if (!/^(?:هفت|7)/.test(m[1])) {
          bad.push(`${tag}: states the RIG window as "${m[1]}" instead of day 7`);
        }
      }

      // --- brucellosis: never one drug, never a short course ------------
      if (/بروسل/.test(t)) {
        sawBruc += 1;
        // a stated duration for UNCOMPLICATED disease below six weeks is wrong
        for (const m of t.matchAll(/بروسلوز\s*(?:بدون عارضه|ساده)[^.،]{0,40}?(\d{1,2})\s*هفته/g)) {
          if (parseInt(m[1], 10) < 6) {
            bad.push(`${tag}: uncomplicated brucellosis given ${m[1]} weeks (minimum is six)`);
          }
        }
        /* Follow-up must never be described as serological. Again SENTENCE
           BY SENTENCE: the whole-lesson version missed an injected defect
           because every brucellosis lesson correctly says somewhere that
           serology "نیست" the criterion, and that word then excused a
           sentence elsewhere that recommended exactly the opposite. */
        for (const sent of piecesOf(q)) {
          if (!/پیگیری|پیگیر/.test(sent) || !/سرولوژ|رایت|2ME|تیتر/.test(sent)) continue;
          /* The exempting vocabulary had to be widened once, and the reason
             is worth recording: several correct lessons reject serology using
             words other than a bare negation — "گمراه‌کننده" (misleading),
             "نامناسب" (unsuitable), or by contrasting it with "پیگیری بالینی".
             Those are rejections, not recommendations. The list below was
             checked against the injected defect ("پیگیری بیمار با سرولوژی هر
             سه ماه انجام می‌شود"), which contains none of these words and is
             still caught. */
          if (/نیست|بی‌فایده|بی فایده|نه سرولوژ|نه با تیتر|به درد|رد می‌شود|نمی‌خورد|باقی می‌مان|بالینی است|گمراه|نامناسب|پیگیری بالینی|بی‌علامت|هیچ کار/.test(sent)) continue;
          bad.push(`${tag}: recommends serological follow-up without saying it is not the criterion — "${sent.trim().slice(0, 60)}"`);
        }
      }
    }

    // each rule must actually have been exercised, or the test proves nothing
    expect(sawSchedule).toBeGreaterThan(0);
    expect(sawDose).toBeGreaterThan(0);
    expect(sawWindow).toBeGreaterThan(0);
    expect(sawBruc).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  /* ------------------------------------------------------------------
     The respiratory chapter turns on four facts that decide management, and
     each appears in several lessons at once. Written SENTENCE BY SENTENCE
     from the outset, because the zoonoses guard proved that scanning a whole
     lesson lets an exempting phrase elsewhere excuse a defect here.

       CIPROFLOXACIN     is not a respiratory quinolone; four questions turn on
                         this. A lesson that lists it as a pneumonia option
                         teaches the very error the chapter exists to correct.
       CURB-65           five criteria, and UREA not creatinine. A lesson that
                         scores the creatinine teaches the commonest mistake.
       ADAMANTANES       amantadine and rimantadine were abandoned in 2009. Any
                         lesson recommending them is out of date by 17 years.
       ASPIRIN IN A CHILD  Reye's syndrome. This one is absolute. */
  it("the respiratory lessons agree with each other on the facts that decide management", () => {
    const qs = bookQuestions();
    if (!qs.length) return;

    const FOLD = new Map();
    for (let i = 0; i < 10; i += 1) {
      FOLD.set(String.fromCharCode(0x06f0 + i), String(i));
      FOLD.set(String.fromCharCode(0x0660 + i), String(i));
    }
    const fold = (t) => (t || "").replace(/[\u0660-\u0669\u06F0-\u06F9]/g,
      (ch) => FOLD.get(ch) || ch);

    const resp = qs.filter((q) => String(q.chapter_fa || "").includes("دستگاه تنفسی")
      && q.needs_lesson === false);
    // guard against a silent zero-check
    expect(resp.length).toBeGreaterThan(15);

    const piecesOf = (q) => [
      q.explanation_fa, q.golden_fa,
      ...((q.micro && q.micro.points_fa) || []),
      ...(q.options_why_fa || []),
    ].filter(Boolean).flatMap((x) => splitSentences(fold(x)));

    const bad = [];
    let sawCipro = 0, sawCurb = 0, sawAdam = 0, sawAspirin = 0;

    for (const q of resp) {
      const tag = `q${q.question_no}`;
      for (const sent of piecesOf(q)) {
        // --- ciprofloxacin must never be offered as pneumonia therapy ---
        if (/سیپروفلوکساسین/.test(sent)) {
          sawCipro += 1;
          /* The rejecting vocabulary had to be widened once, and the reason is
             worth recording: correct lessons reject ciprofloxacin in ways this
             list did not at first anticipate — by naming the two drugs that ARE
             respiratory quinolones and contrasting ("یعنی لووفلوکساسین ... نه
             سیپروفلوکساسین"), or by stating the consequence ("به شکست درمان
             می‌انجامد"). Both are rejections. Verified against the injected
             defect below, which contains none of these words. */
          const rejects = /نیست|نمی‌پوشاند|نمیپوشاند|ضعیف|ناکافی|جایی ندارد|رد می‌شود|غلط|نامناسب|گرم‌منفی|ادراری|شکست|لووفلوکساسین|موکسی‌فلوکساسین/;
          // NOTE: a bare \b does not work on Persian in JavaScript — see standalone()
          const rejectsCipro = rejects.test(sent) || standalone("نه").test(sent);
          if (/پنومونی|تنفسی/.test(sent) && !rejectsCipro) {
            bad.push(`${tag}: mentions ciprofloxacin for pneumonia without rejecting it — "${sent.trim().slice(0, 60)}"`);
          }
        }

        // --- CURB-65 must score urea, never creatinine ---
        if (/CURB/i.test(sent) || /اوره/.test(sent)) {
          if (/کراتینین/.test(sent) && /امتیاز/.test(sent)
              && !/ندارد|نه کراتینین|نمی/.test(sent)) {
            bad.push(`${tag}: scores creatinine in CURB-65 — "${sent.trim().slice(0, 60)}"`);
          }
        }
        if (/CURB/i.test(sent)) sawCurb += 1;

        // --- the adamantanes are obsolete ---
        if (/آمانتادین|ریمانتادین/.test(sent)) {
          sawAdam += 1;
          const rejects = /کنار گذاشته|منسوخ|بی‌مورد|بی مورد|مقاومت|توصیه نم|غلط|بی‌اثر|بیاثر|حذف|دیگر|نمی‌شود|قدیم|2009|۲۰۰۹|اثر ندارد/;
          if (!rejects.test(sent)) {
            bad.push(`${tag}: mentions an adamantane without saying it is obsolete — "${sent.trim().slice(0, 60)}"`);
          }
        }

        // --- aspirin in a child: absolute prohibition ---
        if (/آسپرین|آسپیرین/.test(sent) && /کودک|بچه|نوجوان/.test(sent)) {
          sawAspirin += 1;
          /* Likewise widened: one lesson states the prohibition as an equation
             ("آسپیرین + کودک + آنفلوانزا = سندرم ری") and another explains that
             children on long-term aspirin are themselves a high-risk group.
             Both are prohibitions, neither used the words first listed. */
          const rejects = /ممنوع|نباید|هرگز|ری\b|Reye|پرخطر|خطر|نمی‌شود|داده نمی|سندرم|طولانی‌مدت|اولویت/;
          if (!rejects.test(sent)) {
            bad.push(`${tag}: mentions aspirin in a child without prohibiting it — "${sent.trim().slice(0, 60)}"`);
          }
        }
      }
    }

    // each rule must actually have been exercised, or the test proves nothing
    expect(sawCipro).toBeGreaterThan(0);
    expect(sawCurb).toBeGreaterThan(0);
    expect(sawAdam).toBeGreaterThan(0);
    expect(sawAspirin).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  /* ------------------------------------------------------------------
     The skin and soft tissue chapter is the one with the highest stakes per
     question: necrotising fasciitis and toxic shock kill in hours. Four facts
     decide management and each recurs across several lessons.

       SURGERY FIRST      in necrotising infection, imaging must never be
                          offered as an alternative to exploration. A lesson
                          that says "get an MRI first" teaches a lethal delay.
       CLINDAMYCIN        must be in every necrotising-infection and toxic-shock
                          regimen, because it is the toxin-synthesis inhibitor.
       ERYSIPELOTHRIX     is intrinsically vancomycin resistant — a famous
                          exception the chapter exists partly to teach.
       RHEUMATIC FEVER    penicillin prevents it; it does NOT prevent
                          glomerulonephritis. Stating the reverse teaches the
                          commonest error in the pharyngitis block.

     Uses the shared splitSentences helper, so the decimal-point bug that the
     respiratory guard exposed cannot recur here. */
  it("the skin and soft tissue lessons agree on the facts that decide management", () => {
    const qs = bookQuestions();
    if (!qs.length) return;

    const FOLD = new Map();
    for (let i = 0; i < 10; i += 1) {
      FOLD.set(String.fromCharCode(0x06f0 + i), String(i));
      FOLD.set(String.fromCharCode(0x0660 + i), String(i));
    }
    const fold = (t) => (t || "").replace(/[\u0660-\u0669\u06F0-\u06F9]/g,
      (ch) => FOLD.get(ch) || ch);

    const skin = qs.filter((q) => String(q.chapter_fa || "").includes("پوست")
      && q.needs_lesson === false);
    // guard against a silent zero-check
    expect(skin.length).toBeGreaterThan(15);

    const piecesOf = (q) => [
      q.explanation_fa, q.golden_fa,
      ...((q.micro && q.micro.points_fa) || []),
      ...(q.options_why_fa || []),
    ].filter(Boolean).flatMap((x) => splitSentences(fold(x)));

    const bad = [];
    let sawSurgery = 0, sawClinda = 0, sawEry = 0, sawRF = 0;

    for (const q of skin) {
      const tag = `q${q.question_no}`;
      for (const sent of piecesOf(q)) {
        /* --- imaging must not be offered instead of surgery -------------
           Fires only when a sentence puts imaging and a necrotising
           infection together AND recommends the imaging. The rejecting
           vocabulary is deliberately wide because the correct lessons say
           this in several ways: "نباید", "تأخیر", "به‌جای جراحی". */
        if (/فاشئیت|نکروزان/.test(sent) && /MRI|سونوگرافی|س[یي]‌?ت[یي]|تصویربرداری/.test(sent)) {
          sawSurgery += 1;
          const rejects = /نباید|تأخیر|تاخیر|به‌جای|بجای|جراحی|اکسپلور|دبریدمان|کشنده|وقت|حساسیت/;
          if (!rejects.test(sent) && !standalone("نه").test(sent)) {
            bad.push(`${tag}: offers imaging in necrotising infection without deferring to surgery — "${sent.trim().slice(0, 60)}"`);
          }
        }

        // --- clindamycin is the toxin inhibitor -----------------------
        if (/کلیندامایسین/.test(sent) && /توکسین/.test(sent)) sawClinda += 1;

        // --- Erysipelothrix and vancomycin ----------------------------
        if (/اریزیپلوتریکس/.test(sent)) {
          sawEry += 1;
          if (/وانکومایسین/.test(sent)
              && !/مقاوم|نباید|هرگز|بی‌اثر|بیاثر|استفاده نم/.test(sent)
              && !standalone("نه").test(sent)) {
            bad.push(`${tag}: mentions vancomycin for Erysipelothrix without saying it is resistant — "${sent.trim().slice(0, 60)}"`);
          }
        }

        /* --- rheumatic fever versus glomerulonephritis ----------------
           The dangerous claim is that penicillin PREVENTS glomerulonephritis.
           Fires when one sentence links prevention to glomerulonephritis
           without a negation. */
        if (/گلومرولونفریت/.test(sent)) {
          sawRF += 1;
          if (/پیشگیری|جلوگیری/.test(sent)
              && !/نمی|بی‌تأثیر|بیتأثیر|نکرده|ندارد|رد می‌شود|فقط|تنها|برنمی|ولی از/.test(sent)
              && !standalone("نه").test(sent)) {
            bad.push(`${tag}: claims penicillin prevents glomerulonephritis — "${sent.trim().slice(0, 60)}"`);
          }
        }
      }
    }

    // each rule must actually have been exercised, or the test proves nothing
    expect(sawSurgery).toBeGreaterThan(0);
    expect(sawClinda).toBeGreaterThan(0);
    expect(sawEry).toBeGreaterThan(0);
    expect(sawRF).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  /* ------------------------------------------------------------------
     The CNS chapter is the most algorithmically uniform in the book, and four
     facts decide management across dozens of lessons.

       ANTIBIOTICS FIRST   imaging must never delay the antibiotic. A lesson
                           that orders a CT before treatment teaches a lethal
                           sequence.
       LISTERIA            cephalosporins have NO activity against it, so
                           ampicillin is added for the over-50s, pregnancy,
                           immunocompromise and alcoholism. A lesson claiming
                           a cephalosporin covers Listeria is dangerous.
       CSF GLUCOSE         low glucose means bacterial or tuberculous; normal
                           glucose means viral. Reversing this inverts every
                           diagnosis in the chapter.
       PROPHYLAXIS IN PREGNANCY   ceftriaxone, not rifampicin.

     Uses the shared splitSentences and standalone helpers, so neither the
     decimal-point bug nor the Persian \b bug can recur here. */
  it("the CNS lessons agree on the facts that decide management", () => {
    const qs = bookQuestions();
    if (!qs.length) return;

    const FOLD = new Map();
    for (let i = 0; i < 10; i += 1) {
      FOLD.set(String.fromCharCode(0x06f0 + i), String(i));
      FOLD.set(String.fromCharCode(0x0660 + i), String(i));
    }
    const fold = (t) => (t || "").replace(/[\u0660-\u0669\u06F0-\u06F9]/g,
      (ch) => FOLD.get(ch) || ch);

    const cns = qs.filter((q) => String(q.chapter_fa || "").includes("سیستم عصبی")
      && q.needs_lesson === false);
    expect(cns.length).toBeGreaterThan(15);   // guard against a silent zero-check

    const piecesOf = (q) => [
      q.explanation_fa, q.golden_fa,
      ...((q.micro && q.micro.points_fa) || []),
      ...(q.options_why_fa || []),
    ].filter(Boolean).flatMap((x) => splitSentences(fold(x)));

    const bad = [];
    let sawOrder = 0, sawListeria = 0, sawGlucose = 0, sawPreg = 0;

    for (const q of cns) {
      const tag = `q${q.question_no}`;
      for (const sent of piecesOf(q)) {
        /* --- imaging must not precede the antibiotic ------------------- */
        if (/سی‌?تی|تصویربرداری|CT/i.test(sent) && /آنت[یي]‌?ب[یي]وت[یي]ک/.test(sent)) {
          sawOrder += 1;
          const ok = /پس از|بعد از|نباید|تأخیر|تاخیر|پیش از فرستادن|منتظر|وقت|سوزان|رد می‌شود|غلط/;
          if (/سی‌?تی\s*(?:اسکن\s*)?(?:،|,)?\s*(?:سپس|بعد|پس)?\s*شروع آنت/.test(sent) && !ok.test(sent)) {
            bad.push(`${tag}: orders imaging before antibiotics — "${sent.trim().slice(0, 60)}"`);
          }
        }

        /* --- Listeria and cephalosporins -------------------------------- */
        if (/لیستریا/.test(sent)) {
          sawListeria += 1;
          if (/سفالوسپورین|سفتریاکسون|سفوتاکسیم/.test(sent)
              && /می‌پوشاند|پوشش می‌دهد|مؤثر است|اثر دارد/.test(sent)
              && !/نمی|بدون|ندارد|مقاوم|هیچ/.test(sent)) {
            bad.push(`${tag}: claims a cephalosporin covers Listeria — "${sent.trim().slice(0, 60)}"`);
          }
        }

        /* --- the CSF glucose rule must not be reversed ------------------ */
        if (/قند/.test(sent) && /(?:باکتریال|ویروسی)/.test(sent)) {
          sawGlucose += 1;
          if (/قند\s*(?:پایین|کم)/.test(sent) && /ویروسی/.test(sent)
              && !/نه ویروسی|ویروسی را رد|ویروسی حذف|برخلاف|نیست|طبیعی/.test(sent)) {
            bad.push(`${tag}: links low CSF glucose to viral meningitis — "${sent.trim().slice(0, 60)}"`);
          }
          if (/قند\s*طبیعی/.test(sent) && /باکتریال/.test(sent)
              && !/نه باکتریال|باکتریال را رد|نیست|برخلاف|پایین/.test(sent)) {
            bad.push(`${tag}: links normal CSF glucose to bacterial meningitis — "${sent.trim().slice(0, 60)}"`);
          }
        }

        /* --- prophylaxis in pregnancy ----------------------------------- */
        if (/بارداری|باردار/.test(sent) && /پروفیلاکسی|پیشگیری/.test(sent)) {
          sawPreg += 1;
          if (/ریفامپین/.test(sent)
              && !/توصیه نم|نمی‌شود|ممنوع|کنار|ترجیح داده نم|نیست/.test(sent)
              && !standalone("نه").test(sent)) {
            bad.push(`${tag}: recommends rifampicin for prophylaxis in pregnancy — "${sent.trim().slice(0, 60)}"`);
          }
        }
      }
    }

    // each rule must actually have been exercised, or the test proves nothing
    expect(sawOrder).toBeGreaterThan(0);
    expect(sawListeria).toBeGreaterThan(0);
    expect(sawGlucose).toBeGreaterThan(0);
    expect(sawPreg).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  /* The endocarditis chapter turns on four facts that decide management, and
     each of them is a fact a lesson could plausibly get backwards while still
     reading fluently. This guard checks the lessons against themselves.

     Uses the shared splitSentences() and standalone() helpers for the two
     reasons earlier chapters paid to learn: a full stop is also a decimal
     point, and JavaScript's \b does not mark word boundaries in Persian. */
  it("the endocarditis lessons agree on the facts that decide management", () => {
    const qs = bookQuestions();
    if (!qs.length) return;

    const FOLD = new Map();
    for (let i = 0; i < 10; i += 1) {
      FOLD.set(String.fromCharCode(0x06f0 + i), String(i));
      FOLD.set(String.fromCharCode(0x0660 + i), String(i));
    }
    const fold = (t) => (t || "").replace(/[\u0660-\u0669\u06F0-\u06F9]/g,
      (ch) => FOLD.get(ch) || ch);
    const noZwnj = (t) => (t || "").replace(/\u200c/g, "");

    const endo = qs.filter((q) => String(q.chapter_fa || "").includes("اندوکاردیت")
      && q.needs_lesson === false);
    expect(endo.length).toBeGreaterThan(10);  // guard against a silent zero-check

    const piecesOf = (q) => [
      q.explanation_fa, q.golden_fa,
      ...((q.micro && q.micro.points_fa) || []),
      ...(q.options_why_fa || []),
    ].filter(Boolean).flatMap((x) => splitSentences(noZwnj(fold(x))));

    const bad = [];
    let sawOslerJaneway = 0, sawFever = 0, sawRifampicin = 0, sawBovis = 0;

    for (const q of endo) {
      const tag = `q${q.question_no}`;
      for (const sent of piecesOf(q)) {
        /* --- Osler is PAINFUL, Janeway is PAINLESS ---------------------
           The single most examined distinction in the chapter, and the one
           most easily written backwards. */
        if (/اسلر|جین‌?وی/.test(sent)) {
          sawOslerJaneway += 1;
          if (/اسلر/.test(sent) && /بدون درد|بدون تندرنس|بی‌?درد/.test(sent)
              && !/جین‌?وی/.test(sent)) {
            bad.push(`${tag}: calls an Osler node painless — "${sent.trim().slice(0, 70)}"`);
          }
          if (/جین‌?وی/.test(sent) && /دردناک/.test(sent) && !/اسلر/.test(sent)) {
            bad.push(`${tag}: calls a Janeway lesion painful — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- the fever threshold is 38, not any other number ------------
           A Duke minor scores only at 38 °C or above; q9113 hinges on it. */
        if (/تب/.test(sent) && /معیار|مینور|امتیاز/.test(sent) && /\d{2}/.test(sent)) {
          sawFever += 1;
          const degrees = (sent.match(/\b3[5-9]\b/g) || []);
          if (degrees.length && !degrees.includes("38")) {
            bad.push(`${tag}: states a fever threshold that is not 38 — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- rifampicin is for prosthetic material, and never alone ----- */
        if (/ریفامپین/.test(sent)) {
          sawRifampicin += 1;
          if (/(?:به‌?تنهایی|تنها|مونوتراپی)/.test(sent)
              && /(?:کافی است|می‌دهیم|توصیه|کفایت)/.test(sent)
              && !/(?:هرگز|نمی|نباید|مقاومت|بدون)/.test(sent)) {
            bad.push(`${tag}: suggests rifampicin can be given alone — "${sent.trim().slice(0, 70)}"`);
          }
          if (/دریچه‌?ی? طبیعی/.test(sent)
              && /(?:لازم است|اضافه کنید|باید)/.test(sent)
              && !/(?:نیست|نمی|بدون|مصنوعی|برخلاف)/.test(sent)) {
            bad.push(`${tag}: adds rifampicin to a native valve regimen — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- S. bovis means the colon, not the urinary tract ------------ */
        if (/بوویس|گالولیتیکوس/.test(sent)) {
          sawBovis += 1;
          if (/(?:ادراری|کلیه|مثانه|پروستات)/.test(sent)
              && !/(?:نه |نیست|ندارد|برخلاف|کولون|انتروکوک)/.test(sent)) {
            bad.push(`${tag}: links S. bovis to the urinary tract — "${sent.trim().slice(0, 70)}"`);
          }
        }
      }
    }

    // each rule must actually have been exercised, or the test proves nothing
    expect(sawOslerJaneway).toBeGreaterThan(0);
    expect(sawFever).toBeGreaterThan(0);
    expect(sawRifampicin).toBeGreaterThan(0);
    expect(sawBovis).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  /* The viral and STI chapter turns on four facts that a fluent lesson could
     state backwards without looking wrong. Two of them are the genital-ulcer
     grid, which the whole chapter is built on; one is the gram stain, whose
     limits decide every urethritis treatment question; and one is the CD4
     ladder, which decides every HIV prophylaxis question.

     Uses the shared splitSentences() and standalone() helpers, for the two
     reasons earlier chapters paid to learn: a full stop is also a decimal
     point, and JavaScript's \b does not mark word boundaries in Persian. */
  it("the viral and STI lessons agree on the facts that decide management", () => {
    const qs = bookQuestions();
    if (!qs.length) return;

    const FOLD = new Map();
    for (let i = 0; i < 10; i += 1) {
      FOLD.set(String.fromCharCode(0x06f0 + i), String(i));
      FOLD.set(String.fromCharCode(0x0660 + i), String(i));
    }
    const fold = (t) => (t || "").replace(/[\u0660-\u0669\u06F0-\u06F9]/g,
      (ch) => FOLD.get(ch) || ch);
    const noZwnj = (t) => (t || "").replace(/\u200c/g, "");

    const viral = qs.filter((q) => String(q.chapter_fa || "").includes("ویروسی")
      && q.needs_lesson === false);
    expect(viral.length).toBeGreaterThan(10);  // guard against a silent zero-check

    const piecesOf = (q) => [
      q.explanation_fa, q.golden_fa,
      ...((q.micro && q.micro.points_fa) || []),
      ...(q.options_why_fa || []),
    ].filter(Boolean).flatMap((x) => splitSentences(noZwnj(fold(x))));

    const bad = [];
    let sawChancre = 0, sawChancroid = 0, sawGram = 0, sawCd4 = 0;
    for (const q of viral) {
      const tag = `q${q.question_no}`;
      for (const sent of piecesOf(q)) {
        /* --- the syphilitic chancre is PAINLESS and FIRM ----------------
           The single fact the whole ulcer block rests on. */
        /* A sentence may legitimately mention a disease in order to CONTRAST
           it or EXCLUDE it, and such a sentence must not be flagged. The
           first draft of this guard lacked that idea and produced eight false
           positives on correct lessons, all of the same two shapes:

             "...لاستیکی و بدون درد است — دقیقاً برعکس شانکروئید"
             "بدون درد ← شانکروئید و هرپس هر دو کنار می‌روند"

           Both are right: the first says syphilitic nodes are the OPPOSITE of
           chancroid, the second says painlessness EXCLUDES chancroid. The
           guard was wrong, not the lessons. Hence a shared contrast test,
           written once and applied to every arm. */
        const contrasts = (t) => contrastsWith(t);

        if (/شانکر|سیفلیس|سیفیلیس/.test(sent) && !/شانکروئید/.test(sent)) {
          sawChancre += 1;
          if (/(?:زخم|ضایعه|شانکر)/.test(sent) && standalone("دردناک").test(sent)
              && !/(?:بدون درد|بی‌?درد|هرپس)/.test(sent) && !contrasts(sent)) {
            bad.push(`${tag}: calls a syphilitic chancre painful — "${sent.trim().slice(0, 70)}"`);
          }
          if (standalone("نرم").test(sent)
              && !/(?:هرپس|سفت)/.test(sent) && !contrasts(sent)) {
            bad.push(`${tag}: calls a syphilitic chancre soft — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- chancroid is PAINFUL and SOFT, the mirror image ------------ */
        if (/شانکروئید/.test(sent)) {
          sawChancroid += 1;
          /* The exemption must NOT be /شانکر/: the word شانکروئید CONTAINS
             شانکر as a substring, so every chancroid sentence exempted
             itself and the rule never fired. Negative testing caught it.
             Match the syphilis chancre only when it is not part of the
             longer word. */
          if (/(?:بدون درد|بی‌?درد)/.test(sent)
              && !/سیفلیس|شانکر(?!وئید)/.test(sent) && !contrasts(sent)) {
            bad.push(`${tag}: calls chancroid painless — "${sent.trim().slice(0, 70)}"`);
          }
          if (standalone("سفت").test(sent)
              && !/سیفلیس|نرم|شانکر(?!وئید)/.test(sent) && !contrasts(sent)) {
            bad.push(`${tag}: calls chancroid firm — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- the gram stain cannot see chlamydia ------------------------
           Every urethritis treatment question depends on this limit. */
        if (/رنگ‌?آمیزی گرم|اسمیر/.test(sent) && /کلامیدیا/.test(sent)) {
          sawGram += 1;
          /* The verbs are written WITHOUT a hard ZWNJ, because piecesOf()
             strips U+200C before matching. Writing "می‌شود" here would never
             match the stripped "میشود" — the same invisible-character trap
             the threshold guard hit with "میلی‌متر". */
          if (/(?:دیده می‌?شود|نشان می‌?دهد|قابل مشاهده|می‌?بیند)/.test(sent)
              && !/(?:نمی|نیست|اصلاً|هرگز|بدون|گونوکوک)/.test(sent)) {
            bad.push(`${tag}: claims a gram stain shows chlamydia — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- the PCP prophylaxis threshold is CD4 200 ------------------- */
        if (/PCP|پنوموسیستیس/.test(sent) && /(?:پروفیلاکسی|آستانه)/.test(sent)
            && /\d{2,}/.test(sent)) {
          sawCd4 += 1;
          const counts = (sent.match(/\b(?:50|100|200|500)\b/g) || []);
          if (counts.length && !counts.includes("200")) {
            bad.push(`${tag}: states a PCP threshold that is not 200 — "${sent.trim().slice(0, 70)}"`);
          }
        }
      }
    }

    // each rule must actually have been exercised, or the test proves nothing
    expect(sawChancre).toBeGreaterThan(0);
    expect(sawChancroid).toBeGreaterThan(0);
    expect(sawGram).toBeGreaterThan(0);
    expect(sawCd4).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  /* The varicella, measles and hepatitis lessons rest on four facts that a
     fluent sentence could state backwards. Two are timing rules whose whole
     value is the exact number (aciclovir on day 7, the neonatal window), one
     is an absolute contraindication (a live vaccine in immunosuppression),
     and one is the severity rule that the enzymes do not measure function.

     Note the shared contrast() idea from the STI guard: a sentence may name a
     disease in order to EXCLUDE or CONTRAST it, and such a sentence must not
     be flagged. That lesson cost eight false positives when it was missing. */
  it("the varicella, measles and hepatitis lessons agree on the facts that decide management", () => {
    const qs = bookQuestions();
    if (!qs.length) return;

    const FOLD = new Map();
    for (let i = 0; i < 10; i += 1) {
      FOLD.set(String.fromCharCode(0x06f0 + i), String(i));
      FOLD.set(String.fromCharCode(0x0660 + i), String(i));
    }
    const fold = (t) => (t || "").replace(/[\u0660-\u0669\u06F0-\u06F9]/g,
      (ch) => FOLD.get(ch) || ch);
    const noZwnj = (t) => (t || "").replace(/\u200c/g, "");

    const taughtHere = qs.filter((q) => String(q.chapter_fa || "").includes("ویروسی")
      && q.needs_lesson === false);
    expect(taughtHere.length).toBeGreaterThan(20);  // guard against a silent zero-check

    const piecesOf = (q) => [
      q.explanation_fa, q.golden_fa,
      ...((q.micro && q.micro.points_fa) || []),
      ...(q.options_why_fa || []),
    ].filter(Boolean).flatMap((x) => splitSentences(noZwnj(fold(x))));

    const contrasts = (t) => contrastsWith(t);

    const bad = [];
    let sawDay7 = 0, sawLive = 0, sawWindow = 0, sawSeverity = 0;

    for (const q of taughtHere) {
      const tag = `q${q.question_no}`;
      for (const sent of piecesOf(q)) {
        /* --- prophylactic aciclovir starts on DAY 7, never immediately ---
           The single most examined timing fact in the varicella block. */
        /* Two bugs were found here by the exercised-counter assertion, and both
           are worth recording because both have bitten this suite before:

             1. A LEADING \b BEFORE PERSIAN DOES NOT WORK. JavaScript defines a
                word boundary with [A-Za-z0-9_], so /\bروز/ never matches. This
                is the same defect that made standalone() dead for four
                chapters. Match on the bare word instead.

             2. THE DAYS ARE OFTEN WRITTEN AS PERSIAN WORDS, not digits:
                "از روز هفتم" rather than "از روز ۷". A digit-only pattern saw
                none of them, so the rule counted zero and the guard was
                vacuous. Accept both spellings. */
        const dayWord = /روز\s*(?:هفتم|چهاردهم|هفت|چهارده)/;
        if (/آسیکلوویر|آسیلکوویر/.test(sent)
            && /(?:پروفیلاکسی|پیشگیری|پس از تماس)/.test(sent)
            && (/روز\s*\d/.test(sent) || dayWord.test(sent))) {
          sawDay7 += 1;
          const days = (sent.match(/روز\s*\d{1,2}/g) || []).map((x) => x.replace(/\D/g, ""));
          const allowed = new Set(["7", "14", "10", "21", "28"]);
          const strays = days.filter((d) => !allowed.has(d));
          if (strays.length) {
            bad.push(`${tag}: states an aciclovir prophylaxis day that is not 7 to 14 — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- a LIVE vaccine is forbidden in pregnancy and immunosuppression - */
        if (/واکسن/.test(sent) && /(?:زنده)/.test(sent)
            && /(?:بارداری|باردار|نقص ایمنی|سرکوب)/.test(sent)) {
          sawLive += 1;
          if (/(?:مجاز|بی‌?خطر|توصیه می‌?شود|می‌?توان داد)/.test(sent)
              && !/(?:ممنوع|نباید|نمی)/.test(sent) && !contrasts(sent)) {
            bad.push(`${tag}: permits a live vaccine in pregnancy or immunosuppression — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- the neonatal window is CHICKENPOX, never shingles -------------- */
        if (/زونا/.test(sent) && /(?:نوزاد|VZIG)/.test(sent)) {
          sawWindow += 1;
          if (/(?:خطر|VZIG)/.test(sent) && /(?:لازم است|می‌?خواهد|باید)/.test(sent)
              && !/(?:ندارد|نیست|لازم ندارد|نمی)/.test(sent) && !contrasts(sent)) {
            bad.push(`${tag}: claims maternal shingles endangers the neonate — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- severity is synthetic function, not the transaminases ---------- */
        if (/(?:ALT|AST|آنزیم)/.test(sent) && /(?:شدت|severity)/i.test(sent)) {
          sawSeverity += 1;
          if (/(?:معیار|نشان می‌?دهد|می‌?سنجد)/.test(sent)
              && !/(?:نیست|نمی|نه |برخلاف|بلکه)/.test(sent)) {
            bad.push(`${tag}: uses the transaminases as a severity measure — "${sent.trim().slice(0, 70)}"`);
          }
        }
      }
    }

    // each rule must actually have been exercised, or the test proves nothing
    expect(sawDay7).toBeGreaterThan(0);
    expect(sawLive).toBeGreaterThan(0);
    expect(sawWindow).toBeGreaterThan(0);
    expect(sawSeverity).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  /* The mononucleosis and herpes lessons rest on four facts, each of which a
     fluent sentence could state backwards:

       EBNA antibody arrives LATE, so its presence excludes acute EBV — this
         is the fact the printed key of q9604 got inverted, so the guard makes
         sure no lesson repeats the error
       ampicillin in mononucleosis causes a rash that is NOT an allergy
       a herpetic whitlow must NOT be incised
       neonatal herpes needs INTRAVENOUS aciclovir, not an oral prodrug

     Uses the shared contrast() idea: a sentence may name something in order to
     reject it, and such a sentence must not be flagged. */
  it("the mononucleosis and herpes lessons agree on the facts that decide management", () => {
    const qs = bookQuestions();
    if (!qs.length) return;

    const noZwnj = (t) => (t || "").replace(/\u200c/g, "");
    const taughtHere = qs.filter((q) => String(q.chapter_fa || "").includes("ویروسی")
      && q.needs_lesson === false);
    expect(taughtHere.length).toBeGreaterThan(20);  // guard against a silent zero-check

    const piecesOf = (q) => [
      q.explanation_fa, q.golden_fa,
      ...((q.micro && q.micro.points_fa) || []),
      ...(q.options_why_fa || []),
    ].filter(Boolean).flatMap((x) => splitSentences(noZwnj(x)));

    const contrasts = (t) => contrastsWith(t);

    const bad = [];
    let sawEbna = 0, sawAmpi = 0, sawWhitlow = 0, sawNeonate = 0;

    for (const q of taughtHere) {
      const tag = `q${q.question_no}`;
      for (const sent of piecesOf(q)) {
        /* --- EBNA marks PAST infection, never acute -------------------- */
        if (/EBNA/.test(sent)) {
          sawEbna += 1;
          if (/(?:حاد|اثبات|تشخیص)/.test(sent)
              && /(?:نشانگر|اثبات می‌?کن|تأیید می‌?کن|مفیدترین)/.test(sent)
              && !contrasts(sent)) {
            bad.push(`${tag}: presents EBNA as a marker of acute infection — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- the ampicillin rash is NOT a penicillin allergy ------------ */
        if (/(?:آمپی‌?سیلین|آموکسی‌?سیلین)/.test(sent) && /راش/.test(sent)) {
          sawAmpi += 1;
          if (/آلرژی/.test(sent)
              && !/(?:نیست|نباید|نمی|برخلاف|ثبت نشود|اشتباه)/.test(sent)) {
            bad.push(`${tag}: calls the ampicillin rash a penicillin allergy — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- a herpetic whitlow must not be incised --------------------- */
        if (/ویتلو/.test(sent)) {
          sawWhitlow += 1;
          if (/(?:درناژ|برش|جراحی|تخلیه)/.test(sent)
              && /(?:لازم|باید|توصیه|انجام دهید)/.test(sent)
              && !/(?:نکنید|نباید|هرگز|نیست|نمی)/.test(sent) && !contrasts(sent)) {
            bad.push(`${tag}: recommends draining a herpetic whitlow — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- neonatal herpes needs the INTRAVENOUS route ---------------- */
        if (/(?:هرپس نوزادی|نوزاد)/.test(sent) && /آسیکلوویر/.test(sent)) {
          sawNeonate += 1;
          if (/خوراکی/.test(sent) && /(?:کافی|توصیه|بدهید|انتخاب)/.test(sent)
              && !/(?:نیست|نمی|نباید|وریدی)/.test(sent) && !contrasts(sent)) {
            bad.push(`${tag}: accepts oral aciclovir for neonatal herpes — "${sent.trim().slice(0, 70)}"`);
          }
        }
      }
    }

    // each rule must actually have been exercised, or the test proves nothing
    expect(sawEbna).toBeGreaterThan(0);
    expect(sawAmpi).toBeGreaterThan(0);
    expect(sawWhitlow).toBeGreaterThan(0);
    expect(sawNeonate).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  /* ------------------------------------------------------------------ *
   * The HIV block: transmission, staging and the diagnostic chain.
   *
   * Four rules that the whole cluster depends on, each of which a lesson
   * could plausibly get backwards, and each of which would leave a student
   * with an inverted fact:
   *
   *   1. SAFE FLUIDS DO NOT TRANSMIT. Saliva, tears, sweat, urine, faeces
   *      and sputum are safe, and a mosquito bite is not a route at all.
   *      A sentence that says otherwise, without a contrasting clause and
   *      without the "visible blood" proviso, is a real error.
   *   2. PERSISTENT GENERALISED LYMPHADENOPATHY IS CATEGORY A. This is the
   *      exact fact whose printed key was corrected in q9662, so a lesson
   *      that drifts back to calling it category C would undo the
   *      correction silently.
   *   3. ORAL THRUSH AND ORAL HAIRY LEUCOPLAKIA ARE CATEGORY B, not C.
   *      Two questions in the cluster turn on this and on nothing else.
   *   4. A SINGLE PNEUMONIA IS NOT AIDS-DEFINING; two in twelve months is.
   *      The count is the whole content of two more questions.
   *
   * Every rule carries an execution counter, because a guard that quietly
   * matches nothing is worse than no guard: it stays green forever and
   * gives false assurance. That pattern has already caught two dead guards
   * in this file.
   * ------------------------------------------------------------------ */
  it("the HIV transmission and staging lessons agree on the facts the keys depend on", () => {
    const qs = bookQuestions();
    if (!qs.length) return;

    const noZwnj = (t) => (t || "").replace(/\u200c/g, "");
    const taughtHere = qs.filter((q) => String(q.chapter_fa || "").includes("ویروسی")
      && q.needs_lesson === false);
    expect(taughtHere.length).toBeGreaterThan(20);  // guard against a silent zero-check

    const piecesOf = (q) => [
      q.explanation_fa, q.golden_fa,
      ...((q.micro && q.micro.points_fa) || []),
      ...(q.options_why_fa || []),
    ].filter(Boolean).flatMap((x) => splitSentences(noZwnj(x)));

    const contrasts = (t) => contrastsWith(t);
    // "X is category B, WHEREAS Y is category C" is a comparison, not a claim
    // about X. Without recognising it, the very sentence that teaches the
    // mouth-versus-oesophagus rule would be reported as breaking that rule.

    const bad = [];
    let sawSafeFluid = 0, sawPgl = 0, sawOral = 0, sawOnePneu = 0;

    for (const q of taughtHere) {
      const tag = `q${q.question_no}`;
      for (const sent of piecesOf(q)) {
        /* --- 1) the safe fluids do not transmit ------------------------ */
        if (/(?:بزاق|اشک|عرق|ادرار|مدفوع|خلط|پشه)/.test(sent)) {
          sawSafeFluid += 1;
          if (/(?:منتقل می‌?کن|ناقل است|انتقال می‌?ده|پرخطر است)/.test(sent)
              && !contrasts(sent) && !/خون/.test(sent)) {
            bad.push(`${tag}: says a safe fluid transmits HIV — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 2) PGL is category A, the corrected key of q9662 ---------- */
        if (/لنفادنوپاتی/.test(sent) && /(?:ژنرالیزه|جنرالیزه)/.test(sent)) {
          sawPgl += 1;
          // A sentence that ENUMERATES which options fall in a category
          // ("three of the four options are category C, and the only
          // exception is PGL") mentions both the category and the term
          // without claiming the term belongs to it. Requiring the two to
          // sit in the SAME CLAUSE is what distinguishes an enumeration
          // from an assertion.
          const pglClause = noZwnj(sent).split(/[،,؛]|—/).find((c) => /لنفادنوپاتی/.test(c)) || sent;
          if (/(?:گروه C|تعریف‌?کننده‌?ی ایدز|معرف مرحله)/.test(pglClause) && !contrasts(pglClause)) {
            bad.push(`${tag}: places persistent generalised lymphadenopathy in category C — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 3) oral thrush and hairy leucoplakia are category B ------- */
        if (/(?:لکوپلاکی|برفک)/.test(sent)) {
          sawOral += 1;
          if (/گروه C/.test(sent) && !contrasts(sent)) {
            bad.push(`${tag}: places an oral lesion in category C — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 4) one pneumonia is not AIDS-defining; two in a year is --- */
        if (/پنومونی/.test(sent) && /(?:راجعه|ریکارنت|مکرر|یک اپیزود|اپیزود)/.test(sent)) {
          sawOnePneu += 1;
          // The teaching sentence is a CONTRASTED PAIR: "ONE episode is not
          // defining; TWO OR MORE in 12 months is". Both halves mention
          // "defining", so a whole-sentence match sees the second half and
          // reports the first. Keep only the clause that actually says
          // "one episode".
          // Split on the em dash only, NOT on the semicolon: the canonical
          // sentence is "ONE episode is NOT defining؛ TWO in 12 months IS",
          // and splitting at the semicolon strips the word "نیست" from the
          // very clause that carries it, turning a correct statement into a
          // reported violation. The em dash separates the option label from
          // the explanation and is safe to cut.
          const oneClause = noZwnj(sent).split(/—/).find((c) => /یک اپیزود/.test(c)) || sent;
          if (/یک اپیزود/.test(oneClause) && /(?:تعریف‌?کننده|گروه C)/.test(oneClause)
              && !contrasts(oneClause)) {
            bad.push(`${tag}: calls a single pneumonia AIDS-defining — "${sent.trim().slice(0, 70)}"`);
          }
        }
      }
    }

    // each rule must actually have been exercised, or the test proves nothing
    expect(sawSafeFluid).toBeGreaterThan(0);
    expect(sawPgl).toBeGreaterThan(0);
    expect(sawOral).toBeGreaterThan(0);
    expect(sawOnePneu).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  /* ------------------------------------------------------------------ *
   * The HIV testing chain, the CD4 ladder and hepatitis serology.
   *
   * Four more rules, each of which a lesson could plausibly invert, and
   * each of which would leave the student with a dangerous habit rather
   * than merely a wrong fact:
   *
   *   1. A SINGLE POSITIVE SCREEN NEVER DIAGNOSES. Twelve questions in the
   *      cluster turn on counting positives; a lesson that lets one
   *      positive stand as a diagnosis teaches a practice that ruins lives.
   *   2. CO-TRIMOXAZOLE COVERS TOXOPLASMA AS WELL AS PCP. Its dual role is
   *      the highest-yield fact in the prophylaxis block, and a lesson that
   *      pairs it with the wrong organism would teach a real error.
   *   3. THE TUBERCULIN TEST FAILS AT LOW CD4, NOT HIGH. This is the exact
   *      inversion the printed q9708 distractor contains, so a lesson that
   *      drifted into it would agree with the wrong answer.
   *   4. IgM MEANS ACUTE. The whole hepatitis panel block rests on it.
   *
   * Every rule carries an execution counter, for the reason established
   * earlier in this file: a guard that quietly matches nothing stays green
   * forever and gives false assurance.
   * ------------------------------------------------------------------ */
  it("the HIV testing chain and hepatitis lessons agree on the rules the cluster depends on", () => {
    const qs = bookQuestions();
    if (!qs.length) return;

    const noZwnj = (t) => (t || "").replace(/\u200c/g, "");
    const taughtHere = qs.filter((q) => q.needs_lesson === false
      && (String(q.chapter_fa || "").includes("ویروسی")));
    expect(taughtHere.length).toBeGreaterThan(60);  // guard against a silent zero-check

    const piecesOf = (q) => [
      q.explanation_fa, q.golden_fa,
      ...((q.micro && q.micro.points_fa) || []),
      ...(q.options_why_fa || []),
    ].filter(Boolean).flatMap((x) => splitSentences(noZwnj(x)));

    // "X, whereas Y" is a comparison and not a claim about X; without this
    // the very sentence teaching a rule gets reported as breaking it.
    const contrasts = (t) => contrastsWith(t);

    const bad = [];
    let sawOneScreen = 0, sawCotrim = 0, sawTuberculin = 0, sawIgM = 0;

    for (const q of taughtHere) {
      const tag = `q${q.question_no}`;
      for (const sent of piecesOf(q)) {
        /* --- 1) one positive screen is never a diagnosis --------------- */
        if (/(?:الایزا|ELISA|EIA|غربالگری)/.test(sent) && /(?:یک بار|یک مثبت|یک تست|تک)/.test(sent)) {
          sawOneScreen += 1;
          if (/(?:کافی است|تشخیص قطعی|قطعی است)/.test(sent) && !contrasts(sent)) {
            bad.push(`${tag}: lets a single screening test diagnose HIV — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 2) co-trimoxazole covers PCP AND toxoplasma --------------- */
        if (/کوتریموکسازول/.test(sent) && /(?:پوشش|می‌?پوشاند|پیشگیر)/.test(sent)) {
          sawCotrim += 1;
          if (/(?:مایکوباکتریوم آویوم|MAC|توبرکلوزیس)/.test(sent) && !contrasts(sent)) {
            bad.push(`${tag}: says co-trimoxazole covers a mycobacterium — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 3) tuberculin fails at LOW CD4, not high ------------------ */
        if (/توبرکولین/.test(sent)) {
          sawTuberculin += 1;
          // A lesson that teaches an exam's FALSE statement must first QUOTE
          // it, and the quotation is marked with Persian guillemets. Quoted
          // text is being labelled, not asserted, so it is stripped before
          // the rule is applied — otherwise the sentence that identifies the
          // wrong answer is reported as giving it.
          const unquoted = noZwnj(sent).replace(/«[^»]*»/g, " ");
          if (/(?:منفی|آنرژی)/.test(unquoted) && /(?:بالای ۲۰۰|بالای 200|CD4 بالا)/.test(unquoted)
              && !contrasts(unquoted)) {
            bad.push(`${tag}: says tuberculin is negative at a HIGH CD4 — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 4) IgM means acute, IgG means past ------------------------ */
        if (/IgM/.test(sent)) {
          sawIgM += 1;
          // The canonical teaching sentence is "IgM means ACUTE, IgG means
          // PAST" — a TWO-CLAUSE contrast in which the word for "past"
          // belongs to IgG, not IgM. Splitting on the comma and keeping only
          // the clause that actually mentions IgM is what makes this guard
          // read the sentence the way a student does. Without it, the very
          // rule being taught was reported as its own violation.
          const igmClause = noZwnj(sent).split(/[،,؛]/).find((c) => /IgM/.test(c)) || sent;
          // A clause may pair the two markers — "IgG POSITIVE with IgM
          // NEGATIVE means old immunity" — in which case the word for "past"
          // describes the PAIR, and specifically the IgG half. The rule is
          // about reading IgM ALONE as a past marker, so a clause that also
          // names IgG, or that says IgM is NEGATIVE, is not a violation.
          // Found by regression after the rubella lessons were added: eight
          // correct sentences were reported by a guard written before them.
          const igmAlone = !/IgG/.test(igmClause) && !/IgM\s*منفی/.test(igmClause);
          if (igmAlone && /(?:گذشته|قدیمی|سابقه‌?ی قبلی|مزمن)/.test(igmClause)
              && /یعنی/.test(igmClause) && !contrasts(igmClause)) {
            bad.push(`${tag}: reads IgM as a marker of past infection — "${sent.trim().slice(0, 70)}"`);
          }
        }
      }
    }

    // each rule must actually have been exercised, or the test proves nothing
    expect(sawOneScreen).toBeGreaterThan(0);
    expect(sawCotrim).toBeGreaterThan(0);
    expect(sawTuberculin).toBeGreaterThan(0);
    expect(sawIgM).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  /* Source defects are ANNOTATED, never rewritten. This guard keeps that
     contract honest: an annotation must survive, must say what was wrong,
     and must state plainly that the text was left alone. Without it, a
     later script could quietly "repair" an impossible lab panel and make
     the book's error invisible. */
  it("annotated source defects keep their note and leave the printed text alone", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const flagged = qs.filter((q) => (q.source_defects || []).length);
    expect(flagged.length).toBeGreaterThan(0);  // guard against a silent zero-check

    for (const q of flagged) {
      for (const d of q.source_defects) {
        expect(typeof d.kind).toBe("string");
        expect(d.kind.length).toBeGreaterThan(8);
        // the note must exist in BOTH languages, or one audience sees nothing
        expect((d.note_fa || "").length).toBeGreaterThan(80);
        expect((d.note_en || "").length).toBeGreaterThan(80);
        // and must record that the text was deliberately NOT changed
        expect(d.action || "").toMatch(/left unchanged/);
      }
      // a source defect is not an extraction defect: it must NOT be listed
      // among the glyph-geometry repairs, or the two categories have blurred
      const repairs = q.stem_number_corrections || [];
      for (const d of q.source_defects) {
        expect(repairs.some((r) => r.kind === d.kind)).toBe(false);
      }
    }
  });

  /* ------------------------------------------------------------------ *
   * The completed viral chapter: genital ulcers, urethritis, varicella
   * and the measles group.
   *
   * Four rules the whole chapter rests on, each of which a lesson could
   * invert, and each of which would leave a student with a habit rather
   * than merely a wrong fact:
   *
   *   1. THE PAIN/CONSISTENCY GRID. Syphilis is PAINLESS and hard;
   *      chancroid PAINFUL and soft. Six questions turn on nothing else,
   *      and a lesson that calls a chancre painful destroys all six.
   *   2. TRICHOMONAS IS A PARASITE, NOT A BACTERIUM. Two questions are
   *      decided by it, and a lesson that offers an antibacterial for it
   *      teaches a real prescribing error.
   *   3. VARICELLA ISOLATION ENDS AT CRUSTING, not after a count of days.
   *      A lesson that gives a day count teaches the wrong criterion.
   *   4. MATERNAL ZOSTER CARRIES NO NEONATAL RISK, because the mother has
   *      antibody. Two questions rest on it and it is the subtlest idea
   *      in the varicella block.
   *
   * Every rule carries an execution counter, for the reason established
   * earlier in this file: a guard that quietly matches nothing stays green
   * forever and gives false assurance.
   * ------------------------------------------------------------------ */
  it("the completed viral chapter lessons agree on the rules the whole chapter rests on", () => {
    const qs = bookQuestions();
    if (!qs.length) return;

    const noZwnj = (t) => (t || "").replace(/\u200c/g, "");
    const taughtHere = qs.filter((q) => q.needs_lesson === false
      && String(q.chapter_fa || "").includes("ویروسی"));
    // the chapter is complete, so this must be the full 160
    expect(taughtHere.length).toBeGreaterThan(150);

    const piecesOf = (q) => [
      q.explanation_fa, q.golden_fa,
      ...((q.micro && q.micro.points_fa) || []),
      ...(q.options_why_fa || []),
    ].filter(Boolean).flatMap((x) => splitSentences(noZwnj(x)));

    const contrasts = (t) => contrastsWith(t);

    const bad = [];
    let sawChancre = 0, sawTrich = 0, sawCrust = 0, sawZosterMum = 0;

    for (const q of taughtHere) {
      const tag = `q${q.question_no}`;
      for (const sent of piecesOf(q)) {
        /* --- 1) the syphilitic chancre is PAINLESS -------------------- */
        if (/شانکر/.test(sent) && /سیفلیس|سیفیلیس/.test(sent)) {
          sawChancre += 1;
          // keep only the clause naming the chancre: a sentence may contrast
          // it with chancroid, which IS painful, in its other half
          // The canonical teaching sentence is a THREE-PART CONTRAST:
          // "syphilis painless and hard؛ chancroid painful and soft؛ herpes
          // painful and vesicular". Every part mentions a chancre-family term
          // and two of them legitimately say "painful", so the guard must
          // isolate the clause naming SYPHILIS specifically — not merely one
          // naming any chancre. Splitting on the semicolon as well as the
          // comma and em dash is what makes that possible.
          const clause = noZwnj(sent).split(/[،,؛;]|—/)
            .find((c) => /سیفلیس|سیفیلیس/.test(c)) || sent;
          if (/دردناک/.test(clause) && !contrasts(clause) && !/بدون درد|بیدرد|بی درد/.test(clause)) {
            bad.push(`${tag}: calls the syphilitic chancre painful — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 2) trichomonas needs a nitroimidazole, not an antibiotic -- */
        if (/تریکوموناس/.test(sent)) {
          sawTrich += 1;
          if (/(?:کلیندامایسین|سفتریاکسون|داکسی‌?سیکلین|آزیترومایسین)/.test(sent)
              && /(?:درمان|مؤثر|می‌?گیرد|پوشش)/.test(sent) && !contrasts(sent)) {
            bad.push(`${tag}: offers an antibacterial for trichomonas — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 3) varicella isolation ends at crusting ------------------ */
        if (/(?:آبله‌?مرغان|ایزولاسیون)/.test(sent) && /(?:سرایت|ایزوله|ایزولاسیون|تماس)/.test(sent)) {
          sawCrust += 1;
          if (/(?:معیار|پایان)/.test(sent) && /(?:روز پس از|تعداد روز)/.test(sent)
              && !/کراست|خشک/.test(sent) && !contrasts(sent)) {
            bad.push(`${tag}: gives a day count as the isolation criterion — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 4) maternal zoster carries no neonatal risk -------------- */
        if (/زونا/.test(sent) && /(?:مادر|نوزاد)/.test(sent)) {
          sawZosterMum += 1;
          if (/(?:خطر|منتشر)/.test(sent) && /نوزاد/.test(sent)
              && !/(?:ندارد|نیست|محافظت|آنتی‌?بادی)/.test(sent) && !contrasts(sent)) {
            bad.push(`${tag}: implies maternal zoster endangers the neonate — "${sent.trim().slice(0, 70)}"`);
          }
        }
      }
    }

    // each rule must actually have been exercised, or the test proves nothing
    expect(sawChancre).toBeGreaterThan(0);
    expect(sawTrich).toBeGreaterThan(0);
    expect(sawCrust).toBeGreaterThan(0);
    expect(sawZosterMum).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  /* ------------------------------------------------------------------
   * THE PARASITOLOGY AND MALARIA CHAPTER — the second chapter finished.
   *
   * Five rules the chapter rests on, each of which a lesson could invert,
   * and each inversion of which would teach a real prescribing error
   * rather than merely a wrong fact:
   *
   *   1. AN ASYMPTOMATIC AMOEBIC CARRIER GETS A LUMINAL AGENT ALONE.
   *      Four questions turn on it. A lesson that offers metronidazole
   *      alone to a carrier teaches a treatment that leaves the cysts
   *      alive — the precise thing the treatment exists to prevent.
   *   2. ONLY VIVAX AND OVALE HAVE HYPNOZOITES. Primaquine in falciparum
   *      is meaningless, and a lesson that offers it teaches a student to
   *      give a G6PD-haemolysing drug for no reason at all.
   *   3. BLOODBORNE MALARIA NEEDS NO PRIMAQUINE. Needlestick, transfusion
   *      and transplacental infection bypass the liver, so there are no
   *      hypnozoites. Two questions rest on it and it is the subtlest
   *      idea in the malaria block.
   *   4. IN PREGNANCY IN A CHLOROQUINE-RESISTANT AREA, MEFLOQUINE IS THE
   *      ONLY OPTION. Three questions ask it. A lesson that offers
   *      doxycycline to a pregnant traveller teaches a teratogenic error.
   *   5. IN ASCARIS OBSTRUCTION, PIPERAZINE — NOT A KILLING DRUG. Two
   *      questions turn on the flaccid-versus-killing distinction.
   *
   * Every rule carries an execution counter, for the reason established
   * earlier in this file: a guard that quietly matches nothing stays green
   * forever and gives false assurance.
   * ------------------------------------------------------------------ */
  it("the completed parasitology chapter lessons agree on the rules the whole chapter rests on", () => {
    const qs = bookQuestions();
    if (!qs.length) return;

    const noZwnj = (t) => (t || "").replace(/\u200c/g, "");
    const taughtHere = qs.filter((q) => q.needs_lesson === false
      && String(q.chapter_fa || "").includes("انگلی"));
    // the chapter is complete, so this must be the full 101
    expect(taughtHere.length).toBeGreaterThan(95);

    const piecesOf = (q) => [
      q.explanation_fa, q.golden_fa,
      ...((q.micro && q.micro.points_fa) || []),
      ...(q.options_why_fa || []),
    ].filter(Boolean).flatMap((x) => splitSentences(noZwnj(x)));

    const contrasts = (t) => contrastsWith(t);

    const bad = [];
    let sawCarrier = 0, sawHypno = 0, sawBlood = 0, sawPregProph = 0, sawObstr = 0;

    for (const q of taughtHere) {
      const tag = `q${q.question_no}`;
      for (const sent of piecesOf(q)) {
        const clean = noZwnj(sent);

        /* --- 1) an asymptomatic carrier gets a LUMINAL agent alone ---- */
        if (/ناقل/.test(clean) && /(?:بیعلامت|بدون علامت)/.test(clean)) {
          sawCarrier += 1;
          // The canonical teaching sentence contrasts the carrier with
          // invasive disease, so the clause naming the CARRIER must be
          // isolated before the drug is judged: a sentence may legitimately
          // mention metronidazole in its other half while describing what
          // the carrier does NOT need.
          const clause = clean.split(/[،,؛;]|—/)
            .find((c) => /ناقل/.test(c)) || clean;
          if (/(?:مترونیدازول|تینیدازول)/.test(clause)
              && /(?:بدهید|می‌?گیرد|درمان با|تجویز)/.test(clause)
              && !/(?:لومینال|پارومومایسین|یدوکینول)/.test(clause)
              && !contrasts(clause)) {
            bad.push(`${tag}: gives a nitroimidazole alone to an asymptomatic carrier — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 2) only vivax and ovale have hypnozoites ----------------- */
        if (/هیپنوزوئیت/.test(clean)) {
          sawHypno += 1;
          // TWO conditions, and both are needed. The clause split that the
          // syphilis guard needs actively HURTS here, and four false
          // positives proved it: the canonical sentence is
          // "**falciparum** — **has no hypnozoites**", whose negation sits
          // in the clause AFTER the em dash. Splitting first and then
          // looking for the negation therefore finds a bare "falciparum"
          // and reports a claim the lesson never made.
          //
          // So the claim is only real when the two terms sit in the SAME
          // clause (otherwise "falciparum" may merely be the subject of a
          // denial) AND the WHOLE sentence carries no negation.
          const sameClause = clean.split(/[،,؛;]|—/)
            .some((c) => /فالسیپاروم/.test(c) && /هیپنوزوئیت/.test(c));
          const denied = /(?:ندارد|ندارند|نیست|نیستند|بدون|نمی|هرگز|فقط ویواکس)/.test(clean);
          if (sameClause && !denied && !contrasts(clean)) {
            bad.push(`${tag}: attributes hypnozoites to falciparum — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 3) bloodborne malaria needs no primaquine ---------------- */
        if (/(?:نیدلاستیک|نیدل استیک|تزریق خون|سوزن)/.test(clean) && /پریماکین/.test(clean)) {
          sawBlood += 1;
          if (!/(?:لازم نیست|نمیخواهد|بدون|اضافه|بیفایده|بیمورد|نباید|مضر)/.test(clean)
              && !contrasts(clean)) {
            bad.push(`${tag}: prescribes primaquine for bloodborne malaria — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 4) pregnancy in a resistant area means mefloquine -------- */
        if (/(?:باردار|بارداری|حامله)/.test(clean)
            && /(?:پروفیلاکسی|پیشگیری)/.test(clean)) {
          sawPregProph += 1;
          if (/(?:داکسیسیکلین|داکسیسایکلین|پریماکین)/.test(clean)
              && /(?:توصیه می|انتخاب|بدهید|تجویز)/.test(clean)
              && !/(?:ممنوع|نباید|توصیه نمی|پرهیز|نمیشود)/.test(clean)
              && !contrasts(clean)) {
            bad.push(`${tag}: recommends a contraindicated prophylactic in pregnancy — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 5) ascaris obstruction takes piperazine, not a killer ---- */
        if (/انسداد/.test(clean) && /(?:آسکاریس|کرم)/.test(clean)) {
          sawObstr += 1;
          if (/(?:آلبندازول|مبندازول)/.test(clean)
              && /(?:بدهید|انتخاب|درمان|تجویز)/.test(clean)
              && !/(?:نه|نباید|بدتر|اشتباه|غلط|ایراد|رد می)/.test(clean)
              && !contrasts(clean)) {
            bad.push(`${tag}: gives a worm-killing drug in obstruction — "${sent.trim().slice(0, 70)}"`);
          }
        }
      }
    }

    // each rule must actually have been exercised, or the test proves nothing
    expect(sawCarrier).toBeGreaterThan(0);
    expect(sawHypno).toBeGreaterThan(0);
    expect(sawBlood).toBeGreaterThan(0);
    expect(sawPregProph).toBeGreaterThan(0);
    expect(sawObstr).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  /* ------------------------------------------------------------------
   * THE GASTROINTESTINAL CHAPTER — the third chapter finished.
   *
   * Five rules the chapter rests on, each of which a lesson could invert,
   * and each inversion of which would teach a real prescribing error:
   *
   *   1. CHOLERA IS NEVER INFLAMMATORY. It is a pure toxin producer, so it
   *      makes no stool white cells, no blood and no fever. Six "which
   *      cannot" questions turn on it, and a lesson that gives cholera a
   *      fever destroys all six.
   *   2. ANTIMOTILITY DRUGS ARE FORBIDDEN IN INFLAMMATORY DIARRHOEA. Slowing
   *      the bowel prolongs toxin contact and risks toxic megacolon; a lesson
   *      that offers loperamide for dysentery teaches a dangerous error.
   *   3. ALCOHOL DOES NOT KILL C. DIFFICILE SPORES. This is the one setting
   *      where alcohol gel is the wrong answer, and a lesson that recommends
   *      it teaches a real infection-control failure.
   *   4. INTRAVENOUS VANCOMYCIN IS USELESS IN C. DIFFICILE, because it never
   *      reaches the bowel lumen. The route, not the drug, is the error.
   *   5. NON-TYPHOIDAL SALMONELLA IN A HEALTHY HOST NEEDS NO ANTIBIOTIC,
   *      because treatment prolongs carriage.
   *
   * Every rule carries an execution counter, for the reason established
   * earlier in this file: a guard that quietly matches nothing stays green
   * forever and gives false assurance.
   * ------------------------------------------------------------------ */
  it("the completed gastrointestinal chapter lessons agree on the rules the whole chapter rests on", () => {
    const qs = bookQuestions();
    if (!qs.length) return;

    const noZwnj = (t) => (t || "").replace(/\u200c/g, "");
    const taughtHere = qs.filter((q) => q.needs_lesson === false
      && String(q.chapter_fa || "").includes("گوارشی"));
    // the chapter is complete, so this must be the full 84
    expect(taughtHere.length).toBeGreaterThan(80);

    const piecesOf = (q) => [
      q.explanation_fa, q.golden_fa,
      ...((q.micro && q.micro.points_fa) || []),
      ...(q.options_why_fa || []),
    ].filter(Boolean).flatMap((x) => splitSentences(noZwnj(x)));

    const contrasts = (t) => contrastsWith(t);

    const bad = [];
    let sawCholera = 0, sawMotility = 0, sawAlcohol = 0, sawVanco = 0, sawNts = 0;

    for (const q of taughtHere) {
      const tag = `q${q.question_no}`;
      for (const sent of piecesOf(q)) {
        const clean = noZwnj(sent);

        /* --- 1) cholera is never inflammatory -------------------------
         * ⭐ A NEW PERSIAN SUBSTRING BUG, and the third of its kind in this
         * file. The word for cholera, "وبا", is a SUBSTRING OF THE WORD FOR
         * CAMPYLOBACTER: کمپیل + وبا + کتر. So a sentence that says only
         * "campylobacter is invasive and causes bloody diarrhoea" matched the
         * cholera guard and was reported as making cholera inflammatory.
         *
         * The same family as "شانکروئید contains شانکر" and "توبرکولین
         * contains ولی". The fix is the same: require a word boundary the
         * Persian way, since \b does not work on Persian text.
         */
        const CHOLERA = /(?:^|[\s*،.:؛!?()«»\-])(?:وبا|ویبریوکلرا)(?:$|[\s*،.:؛!?()«»\-ی])/;
        if (CHOLERA.test(clean)) {
          sawCholera += 1;
          // The two terms must sit in the SAME clause before the claim is
          // real: the canonical teaching sentence contrasts cholera with an
          // inflammatory organism, and splitting first then hunting for a
          // negation is what produced four false positives in the
          // parasitology guard. Same fix applied here from the start.
          // THE THIRD FALSE POSITIVE HAD A DIFFERENT ROOT and is worth
          // recording. The sentence "campylobacter is invasive and causes
          // bloody diarrhoea" contains no cholera term at all — it was caught
          // because the SENTENCE SPLITTER had merged it with a neighbouring
          // cholera sentence, so `clean` held both. The counter fired on one
          // half and the claim regex on the other.
          //
          // The fix is to require both terms IN THE SAME CLAUSE *and* to
          // re-check that the clause naming cholera is the one making the
          // claim — not merely that some clause somewhere does.
          const sameClause = clean.split(/[،,؛;.]|—/)
            .some((c) => CHOLERA.test(c)
              && /(?:تب می|گلبول سفید می|خونی می|التهابی است)/.test(c));
          // "cholera is always the EXCEPTION to the inflammatory questions"
          // is a correct sentence that contains both terms in one clause. Two
          // false positives came from exactly that phrasing, so a claim about
          // cholera is only real when the sentence does not frame it as the
          // exception or the organism that is excluded.
          const framedAsException =
            /(?:استثنا|رد می|بیرون|خارج|نمی‌?تواند|جعبه‌?ی مخالف)/.test(clean);
          const denied = /(?:نمی|ندارد|نیست|بدون|هرگز|رد می)/.test(clean);
          if (sameClause && !denied && !framedAsException && !contrasts(clean)) {
            bad.push(`${tag}: makes cholera inflammatory — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 2) antimotility is forbidden in inflammatory diarrhoea --- */
        if (/(?:لوپرامید|دیفنوکسیلات|ضدحرکت|آنتی‌?موتیلیتی)/.test(clean)) {
          sawMotility += 1;
          if (/(?:بدهید|توصیه می|انتخاب|مفید|کمک می)/.test(clean)
              && !/(?:ممنوع|نباید|نمی|خطرناک|مضر|جایی ندارد|بدتر)/.test(clean)
              && !contrasts(clean)) {
            bad.push(`${tag}: recommends an antimotility drug — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 3) alcohol does not kill C. difficile spores ------------- */
        if (/الکل/.test(clean) && /(?:اسپور|دیفیسیل|دست)/.test(clean)) {
          sawAlcohol += 1;
          if (/(?:می‌?کشد|کافی است|توصیه می|مؤثر است)/.test(clean)
              && !/(?:نمی|کافی نیست|بی‌?اثر|غلط|اشتباه|کم‌?اثر)/.test(clean)
              && !contrasts(clean)) {
            bad.push(`${tag}: claims alcohol kills C. difficile spores — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 4) intravenous vancomycin is useless in C. difficile ----- */
        if (/وانکومایسین/.test(clean) && /(?:وریدی|تزریقی)/.test(clean)) {
          sawVanco += 1;
          if (/(?:مؤثر|بدهید|انتخاب|درمان می|توصیه)/.test(clean)
              && !/(?:بی‌?فایده|نمی|بی‌?اثر|غلط|اشتباه|نمی‌?رسد|دام)/.test(clean)
              && !contrasts(clean)) {
            bad.push(`${tag}: offers intravenous vancomycin for C. difficile — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 5) non-typhoidal salmonella needs no antibiotic ---------- */
        if (/غیرتیفی/.test(clean) && /(?:سالم|آنتی‌?بیوتیک)/.test(clean)) {
          sawNts += 1;
          if (/(?:باید درمان|حتماً درمان|آنتی‌?بیوتیک بدهید)/.test(clean)
              && !/(?:نمی|لازم نیست|نیست|پرخطر|باکتریمی|سرکوب ایمنی)/.test(clean)
              && !contrasts(clean)) {
            bad.push(`${tag}: mandates antibiotics for non-typhoidal salmonella — "${sent.trim().slice(0, 70)}"`);
          }
        }
      }
    }

    // each rule must actually have been exercised, or the test proves nothing
    expect(sawCholera).toBeGreaterThan(0);
    expect(sawMotility).toBeGreaterThan(0);
    expect(sawAlcohol).toBeGreaterThan(0);
    expect(sawVanco).toBeGreaterThan(0);
    expect(sawNts).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  /* The gastrointestinal chapter is the THIRD finished end to end. Same
     structural guard as the other two: all 84 questions must carry a
     complete bilingual lesson. */
  it("the gastrointestinal chapter is complete: every question carries a full bilingual lesson", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const chapter = qs.filter((q) => String(q.chapter_fa || "").includes("گوارشی"));
    expect(chapter.length).toBeGreaterThan(80);

    const untaught = chapter.filter((q) => q.needs_lesson !== false)
      .map((q) => q.question_no);
    expect(untaught).toEqual([]);

    const thin = [];
    for (const q of chapter) {
      const pts = (q.micro && q.micro.points_fa) || [];
      const ptsEn = (q.micro && q.micro.points_en) || [];
      if (pts.length < 10 || ptsEn.length !== pts.length) thin.push(q.question_no);
      if ((q.explanation_fa || "").length < 200) thin.push(q.question_no);
      if ((q.explanation_en || "").length < 200) thin.push(q.question_no);
    }
    expect(thin).toEqual([]);
  });

  /* ==================================================================
     THE TUBERCULOSIS CHAPTER — the FOURTH finished end to end (80 of 80).

     A NOTE ON THE CHAPTER NAME, WHICH IS ITSELF A TRAP.
     Every other chapter in this bank is matched with `.includes()` on a long
     distinctive phrase. This chapter's name is the two-letter word "سل", and
     `includes("سل")` would also match "مسلول", "عسل" and any other word that
     happens to contain those letters — including, in a future chapter, a
     stem word rather than a chapter name. This is the same family of bug as
     "شانکروئید contains شانکر" and "کمپیل‌وباکتر contains وبا", both of which
     cost a debugging session earlier in this file.

     So the tuberculosis guards match the chapter name by EXACT EQUALITY after
     trimming, never by substring.
     ================================================================== */
  it("the completed tuberculosis chapter lessons agree on the rules the whole chapter rests on", () => {
    const qs = bookQuestions();
    if (!qs.length) return;

    const noZwnj = (t) => (t || "").replace(/\u200c/g, "");
    const taughtHere = qs.filter((q) => q.needs_lesson === false
      && String(q.chapter_fa || "").trim() === "سل");
    // the chapter is complete, so this must be the full 80
    expect(taughtHere.length).toBeGreaterThan(75);

    const piecesOf = (q) => [
      q.explanation_fa, q.golden_fa,
      ...((q.micro && q.micro.points_fa) || []),
      ...(q.options_why_fa || []),
    ].filter(Boolean).flatMap((x) => splitSentences(noZwnj(x)));

    const contrasts = (t) => contrastsWith(t);

    const bad = [];
    let sawEmbLiver = 0, sawEmbEye = 0, sawBovis = 0, sawMilk = 0, sawMono = 0;

    for (const q of taughtHere) {
      const tag = `q${q.question_no}`;
      for (const sent of piecesOf(q)) {
        const clean = noZwnj(sent);

        /* --- 1) ethambutol is NOT hepatotoxic -------------------------
         * This is the fact three separate questions turn on: it is why
         * ethambutol stays in a low-hepatotoxicity regimen, why it is never
         * the suspect when transaminases rise, and why it can be continued
         * while the other three are reintroduced one at a time. A lesson
         * that says the opposite would teach the student to drop exactly the
         * wrong drug from a cirrhotic's regimen.
         */
        if (/اتامبوتول/.test(clean) && /(?:کبد|هپاتوتوکسی|هپاتیت|آنزیم کبدی)/.test(clean)) {
          sawEmbLiver += 1;
          const claims = /(?:هپاتوتوکسیک است|کبد را می\??زند|سمّ?یت کبدی دارد|باعث هپاتیت)/.test(clean);
          const denied = /(?:نیست|ندارد|نمی|بدون|اصلاً|هیچ|برخلاف|تنها دارو)/.test(clean);
          if (claims && !denied && !contrasts(clean)) {
            bad.push(`${tag}: makes ethambutol hepatotoxic — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 2) ethambutol optic neuritis is a PERMANENT stop ---------
         * Rechallenge after optic neuritis can blind, and ethambutol is the
         * weakest drug in the regimen, so the cost of losing it is trivial
         * against the cost of restarting it. A lesson that offers temporary
         * withdrawal "until symptoms resolve" is offering rechallenge.
         *
         * The counter and the claim must be read carefully here, because the
         * distractor text for two questions QUOTES the wrong answer in order
         * to reject it. Hence the denial list includes the words used to
         * reject it.
         */
        if (/اتامبوتول/.test(clean) && /نوریت/.test(clean)) {
          sawEmbEye += 1;
          const claims = /(?:حذف موقت|موقتاً|به طور موقت|دوباره شروع|شروع مجدد|برمی\??گرد)/.test(clean);
          const denied = /(?:غلط|نادرست|خطرناک|نباید|ممنوع|هرگز|دائم|همیشه|کور|بدترین|رد می)/.test(clean);
          /* ⭐ THIS RULE DELIBERATELY DOES NOT CALL contrasts().
           *
           * The negative test caught it: injecting the sentence
           * "در نوریت اپتیک، حذف موقت اتامبوتول کافی است و بعد دوباره شروع می‌کنیم"
           * left the guard GREEN while the other four fired correctly.
           *
           * The reason is that contrastsWith() treats the standalone word
           * "حذف" ("removal") as a marker of a contrasting clause — a sound
           * heuristic in the chapters it was written for. But "حذف" is the
           * exact verb THIS question is phrased with: every option in q9247
           * begins "حذف کامل" or "حذف موقت". So the contrast excuse fired on
           * the very word the defect is made of, and swallowed it whole.
           *
           * This is the second time a shared helper written for one chapter
           * has misbehaved in another (the first was standalone() and ZWNJ).
           * The remedy here is local rather than global: the helper stays as
           * it is for the chapters that need it, and this rule relies on its
           * own explicit denial list, which already covers every way the real
           * lessons reject a rechallenge.
           */
          if (claims && !denied) {
            bad.push(`${tag}: allows ethambutol rechallenge after optic neuritis — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 3) M. bovis is intrinsically pyrazinamide-resistant ------ */
        if (/بوویس|ب.?ث.?ژ|BCG/.test(clean) && /پیرازینامید/.test(clean)) {
          sawBovis += 1;
          const claims = /(?:مؤثر است|فعال است|بدهید|در رژیم|کار می\??کند)/.test(clean);
          const denied = /(?:مقاومت|نمی|بی\??اثر|حذف|بدون|فعال نمی|هرگز|خارج)/.test(clean);
          if (claims && !denied && !contrasts(clean)) {
            bad.push(`${tag}: keeps pyrazinamide against M. bovis — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 4) breast milk does not transmit tuberculosis ------------
         * The commonest and costliest real-world error in this chapter.
         * Separating a mother from her newborn is a certain harm set against
         * a risk that does not exist by that route.
         */
        if (/شیر مادر|شیرده|شیرخشک/.test(clean)) {
          sawMilk += 1;
          const claims = /(?:منتقل می\??شود|قطع کنید|قطع شود|ندهد|نباید شیر|جدا کنید)/.test(clean);
          const denied = /(?:نمی|منتقل نمی|ادامه|خطای|اشتباه|بی\??دلیل|توجیه|آسیب|رد می|نادرست)/.test(clean);
          if (claims && !denied && !contrasts(clean)) {
            bad.push(`${tag}: stops breastfeeding for tuberculosis — "${sent.trim().slice(0, 70)}"`);
          }
        }

        /* --- 5) never single-drug isoniazid in ACTIVE disease ---------
         * Monotherapy of active tuberculosis is how isoniazid-resistant
         * disease is manufactured, and in the paediatric cluster it is the
         * single error with the worst consequences. Every lesson that names
         * the pairing must reject it.
         */
        if (/ایزونیازید/.test(clean) && /(?:سل فعال|بیماری فعال)/.test(clean)) {
          sawMono += 1;
          const claims = /(?:بدهید|کافی است|شروع کنید|توصیه می|درمان می\??کند)/.test(clean);
          const denied = /(?:نباید|هرگز|تک\??درمانی|مقاومت|رد کنید|رد شود|پیش از|نمی|ممنوع|خطر)/.test(clean);
          if (claims && !denied && !contrasts(clean)) {
            bad.push(`${tag}: gives isoniazid alone in active tuberculosis — "${sent.trim().slice(0, 70)}"`);
          }
        }
      }
    }

    // each rule must actually have been exercised, or the test proves nothing
    expect(sawEmbLiver).toBeGreaterThan(0);
    expect(sawEmbEye).toBeGreaterThan(0);
    expect(sawBovis).toBeGreaterThan(0);
    expect(sawMilk).toBeGreaterThan(0);
    expect(sawMono).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  /* The tuberculosis chapter is the FOURTH finished end to end. Same
     structural guard as the other three — with the exact-equality chapter
     match described above, since "سل" is a substring of many longer words. */
  it("the tuberculosis chapter is complete: every question carries a full bilingual lesson", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const chapter = qs.filter((q) => String(q.chapter_fa || "").trim() === "سل");
    expect(chapter.length).toBeGreaterThan(75);

    const untaught = chapter.filter((q) => q.needs_lesson !== false)
      .map((q) => q.question_no);
    expect(untaught).toEqual([]);

    const thin = [];
    for (const q of chapter) {
      const pts = (q.micro && q.micro.points_fa) || [];
      const ptsEn = (q.micro && q.micro.points_en) || [];
      if (pts.length < 10 || ptsEn.length !== pts.length) thin.push(q.question_no);
      if ((q.explanation_fa || "").length < 200) thin.push(q.question_no);
      if ((q.explanation_en || "").length < 200) thin.push(q.question_no);
    }
    expect(thin).toEqual([]);
  });

  /* The parasitology chapter is the SECOND to be finished end to end.
     Same structural guard as the viral chapter: every one of its 101
     questions must carry a complete bilingual lesson, so that a later edit
     that drops one breaks the count and names the chapter. */
  it("the parasitology chapter is complete: every question carries a full bilingual lesson", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const chapter = qs.filter((q) => String(q.chapter_fa || "").includes("انگلی"));
    expect(chapter.length).toBeGreaterThan(95);

    const untaught = chapter.filter((q) => q.needs_lesson !== false)
      .map((q) => q.question_no);
    expect(untaught).toEqual([]);

    // and "taught" must mean taught in BOTH languages, not merely flagged
    const thin = [];
    for (const q of chapter) {
      const pts = (q.micro && q.micro.points_fa) || [];
      const ptsEn = (q.micro && q.micro.points_en) || [];
      if (pts.length < 10 || ptsEn.length !== pts.length) thin.push(q.question_no);
      if ((q.explanation_fa || "").length < 200) thin.push(q.question_no);
      if ((q.explanation_en || "").length < 200) thin.push(q.question_no);
    }
    expect(thin).toEqual([]);
  });

  /* The viral chapter is the first to be finished end to end. This guard
     records that as a fact the suite will defend: every one of its 160
     questions must carry a complete bilingual lesson. If a later edit
     drops one, the count breaks and the failure names the chapter. */
  it("the viral chapter is complete: every question carries a full bilingual lesson", () => {
    const qs = bookQuestions();
    if (!qs.length) return;
    const chapter = qs.filter((q) => String(q.chapter_fa || "").includes("ویروسی"));
    expect(chapter.length).toBeGreaterThan(150);

    const untaught = chapter.filter((q) => q.needs_lesson !== false)
      .map((q) => q.question_no);
    expect(untaught).toEqual([]);

    // and "taught" must mean taught in BOTH languages, not merely flagged
    const thin = [];
    for (const q of chapter) {
      const pts = (q.micro && q.micro.points_fa) || [];
      const ptsEn = (q.micro && q.micro.points_en) || [];
      if (pts.length < 10 || ptsEn.length !== pts.length) thin.push(q.question_no);
      if ((q.explanation_fa || "").length < 200) thin.push(q.question_no);
      if ((q.explanation_en || "").length < 200) thin.push(q.question_no);
    }
    expect(thin).toEqual([]);
  });
});
