/* ================================================================
   vp-stability.test.js — durability / abuse cases for the virtual
   patient so a crafted client cannot 500 the exam or leak keys.
   ================================================================ */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import request from "supertest";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import { detectExamRequest, findRecordedResult } from "../src/lib/ai-engine.js";
import { catalogContainsQuery, DEFAULT_LAB_TESTS, DEFAULT_IMAGING, DEFAULT_PARACLINIC } from "../src/data/order-catalog-defaults.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
async function token(u, p = "demo") { return (await login(u, p)).body.token; }
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

async function studentId(tk, username) {
  const users = (await request(app).get("/api/users").set(A(tk))).body;
  return users.find((u) => u.username === username).id;
}

async function makeClass(tk, stuId, caseId, extra = {}) {
  const created = await request(app).post("/api/classes").set(A(tk))
    .send({ name_en: `Stab ${Math.random()}`, name_fa: "پایداری", gradingRole: extra.gradingRole || "both",
            maxAttempts: extra.maxAttempts ?? 8,
            logTranscript: extra.logTranscript === true, gradingRubric: extra.gradingRubric });
  const cid = created.body.id;
  await request(app).put(`/api/classes/${cid}/members`).set(A(tk)).send({ userIds: [stuId] });
  await request(app).put(`/api/classes/${cid}/cases`).set(A(tk)).send({ cases: [{ case_id: caseId, weight: 1 }] });
  return cid;
}

describe("detectExamRequest does not steal history questions", () => {
  it("station commands and explicit requests are exam-mode", () => {
    expect(detectExamRequest("معاینه")).toBe(true);
    expect(detectExamRequest("معاینه فیزیکی")).toBe(true);
    expect(detectExamRequest("لطفاً بیمار را معاینه کنید و یافته‌ها را بگویید")).toBe(true);
    expect(detectExamRequest("examine the patient")).toBe(true);
    expect(detectExamRequest("vital signs")).toBe(true);
    expect(detectExamRequest("علائم حیاتی را بگویید")).toBe(true);
    expect(detectExamRequest("شکم را معاینه می‌کنم")).toBe(true);
    expect(detectExamRequest("سمع قلب")).toBe(true);
    expect(detectExamRequest("فشار خون")).toBe(true);
    expect(detectExamRequest("listen to the heart")).toBe(true);
    expect(detectExamRequest("blood pressure")).toBe(true);
  });

  it("past-history and everyday language stay in the patient's voice", () => {
    expect(detectExamRequest("آیا قبلاً معاینه شده‌اید؟")).toBe(false);
    expect(detectExamRequest("قبلا معاینه شدید؟")).toBe(false);
    expect(detectExamRequest("Have you been examined before?")).toBe(false);
    expect(detectExamRequest("Did anyone examine you at the ER?")).toBe(false);
    expect(detectExamRequest("فعالیت فیزیکی دارید؟")).toBe(false);
    expect(detectExamRequest("I have an exam tomorrow")).toBe(false);
    expect(detectExamRequest("فشار خون دارید؟")).toBe(false);
    expect(detectExamRequest("سابقه فشار خون دارید؟")).toBe(false);
    expect(detectExamRequest("آیا فشار خون بالا دارید؟")).toBe(false);
    expect(detectExamRequest("Do you have high blood pressure?")).toBe(false);
    expect(detectExamRequest("Have you ever had hypertension?")).toBe(false);
    expect(detectExamRequest("داروی فشار خون می‌گیرید؟")).toBe(false);
    expect(detectExamRequest("فشار خون بیمار را بگیرید")).toBe(true);
  });
});

describe("findRecordedResult and order catalog matching", () => {
  it("empty query does not match the first recorded result", () => {
    const caseData = { labResults: [{ name_fa: "تروپونین", name_en: "Troponin", result_fa: "بالا" }] };
    expect(findRecordedResult(caseData, "lab", "")).toBeNull();
    expect(findRecordedResult(caseData, "lab", "   ")).toBeNull();
    expect(findRecordedResult(caseData, "lab", "تروپونین")?.name_en).toBe("Troponin");
  });

  it("catalog accepts real lab/imaging names and rejects unknowns", () => {
    expect(catalogContainsQuery(DEFAULT_LAB_TESTS, "تروپونین")).toBe(true);
    expect(catalogContainsQuery(DEFAULT_LAB_TESTS, "کراتینین")).toBe(true);
    expect(catalogContainsQuery(DEFAULT_LAB_TESTS, "منیزیم")).toBe(true);
    expect(catalogContainsQuery(DEFAULT_PARACLINIC, "ECG")).toBe(true);
    expect(catalogContainsQuery(DEFAULT_PARACLINIC, "PFT")).toBe(true);
    // ECG intentionally appears in BOTH the paraclinic list (functional
    // studies) and the imaging list, so either order route finds it.
    expect(catalogContainsQuery(DEFAULT_IMAGING, "ECG")).toBe(true);
    expect(catalogContainsQuery(DEFAULT_LAB_TESTS, "ECG")).toBe(false);
    expect(catalogContainsQuery(DEFAULT_LAB_TESTS, "")).toBe(false);
    expect(catalogContainsQuery(DEFAULT_LAB_TESTS, "zzzzz-not-a-lab")).toBe(false);
  });

  it("short recorded-result aliases do not reverse-match unrelated queries", () => {
    const caseData = { labResults: [{ name_fa: "پتاسیم", name_en: "Potassium", aliases: ["k"], result_fa: "بالا" }] };
    expect(findRecordedResult(caseData, "lab", "serum")).toBeNull();
    expect(findRecordedResult(caseData, "lab", "cbc")).toBeNull();
    expect(findRecordedResult(caseData, "lab", "پتاسیم")?.name_en).toBe("Potassium");
  });
});

describe("evaluate never 500s on abusive payloads", () => {
  it("null / empty session still returns a numeric score", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const cid = await makeClass(ttk, stuId, 1);
    const stk = await token("40012345");
    const r = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 10, session: null });
    expect(r.status).toBe(200);
    expect(typeof r.body.score).toBe("number");
  });

  it("huge message arrays and unicode do not crash", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40022334");
    const cid = await makeClass(ttk, stuId, 1);
    const stk = await token("40022334");
    const messages = [];
    for (let i = 0; i < 400; i++) {
      messages.push({ role: "student", text: "سلام 🙂 \u200f" + "س".repeat(200) });
      messages.push({ role: "patient", text: "درد قفسه سینه" });
    }
    const r = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 30,
              session: { messages, tests: ["ecg"], imaging: [], ddx: ["ACS"], finalDx: "ACS", problemList: "درد" } });
    expect(r.status).toBe(200);
    expect(typeof r.body.score).toBe("number");
  });

  it("SQL-looking chat text is stored as text, not executed", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40067890");
    const cid = await makeClass(ttk, stuId, 1, { logTranscript: true });
    const stk = await token("40067890");
    const poison = "درد قفسه سینه'; DROP TABLE users; --";
    const sess = await request(app).post("/api/exam/session-start").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa" });
    expect(sess.status).toBe(200);
    const reply = await request(app).post("/api/exam/patient-reply").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", userText: poison, history: [] });
    // Either the input filter rejects it (400) or the exam engine treats it as
    // ordinary text (200). In both cases the users table must still exist.
    expect([200, 400]).toContain(reply.status);
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 12,
              sessionId: sess.body.sessionId,
              events: [{ kind: "student_msg", atMs: 1, text: "سلام درد قفسه سینه" }],
              session: { messages: [{ role: "student", text: "سلام درد قفسه سینه" }], tests: [], imaging: [], ddx: [], finalDx: "" } });
    expect(ev.status).toBe(200);
    const still = await request(app).get("/api/users").set(A(ttk));
    expect(still.status).toBe(200);
    expect(Array.isArray(still.body)).toBe(true);
    expect(still.body.some((u) => u.username === "teacher")).toBe(true);
  });

  it("five parallel evaluates on the same class all succeed", async () => {
    const ttk = await token("teacher");
    const usernames = ["40011223", "40022334", "40033445", "40044556", "40055667"];
    const ids = [];
    for (const u of usernames) ids.push(await studentId(ttk, u));
    const created = await request(app).post("/api/classes").set(A(ttk))
      .send({ name_en: `Par ${Math.random()}`, name_fa: "موازی", gradingRole: "history", maxAttempts: 3 });
    const cid = created.body.id;
    await request(app).put(`/api/classes/${cid}/members`).set(A(ttk)).send({ userIds: ids });
    await request(app).put(`/api/classes/${cid}/cases`).set(A(ttk)).send({ cases: [{ case_id: 1, weight: 1 }] });
    const session = { messages: [{ role: "student", text: "سلام" }], tests: [], imaging: [], ddx: [], finalDx: "", problemList: [] };
    const reqs = await Promise.all(usernames.map(async (u) => {
      const stk = await token(u);
      return request(app).post("/api/exam/evaluate").set(A(stk))
        .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 8, session });
    }));
    expect(reqs.every((r) => r.status === 200)).toBe(true);
    expect(reqs.every((r) => typeof r.body.score === "number")).toBe(true);
  });
});

describe("answer-key surfaces stay closed to students", () => {
  it("GET /checklists and /checklists-meta are teacher/admin only", async () => {
    const stk = await token("40012345");
    const a = await request(app).get("/api/checklists").set(A(stk));
    const b = await request(app).get("/api/checklists-meta").set(A(stk));
    expect(a.status).toBe(403);
    expect(b.status).toBe(403);
  });

  it("student case payload does not include checklist_id", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40033445");
    const cid = await makeClass(ttk, stuId, 1);
    const stk = await token("40033445");
    const r = await request(app).get("/api/cases/1").set(A(stk));
    expect(r.status).toBe(200);
    expect(r.body.checklist_id).toBeUndefined();
    expect(r.body.ddx_fa).toBeUndefined();
    expect(r.body.diagnosis_fa).toBeUndefined();
  });
});

describe("class rubric override actually changes the intern score", () => {
  it("intern class with only history+exam in the rubric scores 100 on a history+exam session", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40044556");
    const cl = await request(app).post("/api/checklists").set(A(ttk)).send({
      name_fa: "پایداری", name_en: "stability rubric",
      items: [
        { id: "h1", section: "history", weight: 2, fa: "معرفی", en: "Intro", keys: ["سلام", "hello"] },
        { id: "e1", section: "exam", weight: 2, fa: "معاینه", en: "Exam", keys: ["معاینه", "examine"] },
        { id: "w1", section: "workup", weight: 8, fa: "ECG", en: "ECG", keys: ["ecg"] },
      ],
    });
    const c = await request(app).post("/api/cases").set(A(ttk)).send({
      title_fa: "کیس پایداری نمره", title_en: "Rubric stability case",
      age: 40, sex: "male", chief_fa: "درد", chief_en: "Pain",
      checklist_id: cl.body.id,
    });
    const rubric = {
      roles: {
        extern: { sections: ["history", "exam"], weightMode: "items" },
        intern: { sections: ["history", "exam"], weightMode: "items" },
      },
    };
    const classId = await makeClass(ttk, stuId, c.body.id, { gradingRole: "overall", gradingRubric: rubric });
    const stk = await token("40044556");
    const r = await request(app).post("/api/exam/evaluate").set(A(stk)).send({
      caseId: c.body.id, classId, lang: "fa", durationSec: 20,
      session: {
        messages: [
          { role: "student", text: "سلام من دکتر هستم" },
          { role: "student", text: "لطفاً بیمار را معاینه کنید" },
        ],
        tests: [], imaging: [], ddx: [], finalDx: "", problemList: [],
      },
    });
    expect(r.status).toBe(200);
    expect(r.body.meta.gradingScope).toBe("intern");
    expect(r.body.sectionScores.intern).toBe(100);
    expect(r.body.meta.internScore).toBe(100);
    expect(r.body.meta.internScore).not.toBe(r.body.sectionScores.overall);
    expect(r.body.score).toBe(100);            // intern class uses intern rubric, not overall
    expect(r.body.sectionScores.overall).toBeLessThan(100); // workup still failed overall
    expect(r.body.meta.rubric).toBeUndefined();
    expect(r.body.sectionScores.rubric).toBeUndefined();
    const stored = db.prepare("SELECT eval_json FROM attempts WHERE id=?").get(r.body.attemptId);
    const ev = JSON.parse(stored.eval_json);
    expect(ev.meta.rubric.roles.intern.sections).toEqual(["history", "exam"]);
  });

  it("GET /settings/vp_grading returns a normalised default rubric to teachers", async () => {
    const ttk = await token("teacher");
    const r = await request(app).get("/api/settings/vp_grading").set(A(ttk));
    expect(r.status).toBe(200);
    expect(r.body.roles.extern.sections).toEqual(["history", "exam", "problem_list", "ddx"]);
    expect(r.body.roles.intern.weightMode).toBe("items");
  });

  it("a student cannot read or write the grading panel", async () => {
    const stk = await token("40012345");
    const g = await request(app).get("/api/settings/vp_grading").set(A(stk));
    const p = await request(app).put("/api/settings/vp_grading").set(A(stk)).send({});
    expect(g.status).toBe(403);
    expect(p.status).toBe(403);
  });
});

describe("same-university teachers can review a class they did not create", () => {
  it("peer teacher can fetch the conversation CSV of a classmate's class", async () => {
    const ttk = await token("teacher");
    const atk = await token("admin");
    const peerName = `teacher_peer_${Date.now()}`;
    const created = await request(app).post("/api/users").set(A(atk)).send({
      username: peerName, password: "demo", name_fa: "همکار", name_en: "Peer",
      role: "teacher", university_id: 1,
    });
    expect(created.status).toBe(200);
    const stuId = await studentId(ttk, "40055667");
    const cid = await makeClass(ttk, stuId, 1, { logTranscript: true });
    const stk = await token("40055667");
    const sess = await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid });
    await request(app).post("/api/exam/evaluate").set(A(stk)).send({
      caseId: 1, classId: cid, lang: "fa", durationSec: 15,
      sessionId: sess.body.sessionId,
      events: [{ kind: "student_msg", atMs: 10, text: "سلام" }, { kind: "finish", atMs: 20 }],
      session: { messages: [{ role: "student", text: "سلام" }], tests: [], imaging: [], ddx: [], finalDx: "" },
    });
    const ptk = await token(peerName, "demo");
    const csv = await request(app).get(`/api/classes/${cid}/conversation-log.csv`).set(A(ptk));
    expect(csv.status).toBe(200);
    expect(csv.text).toContain("student_msg");
  });
});


describe("VP cycle named stages (zip 28)", () => {
  it("GET /cases/:id names stage on 403 access and 404 case for a student with no assignments", async () => {
    const atk = await token("admin");
    const sno = `vp28_${Date.now()}`;
    const created = await request(app).post("/api/users").set(A(atk)).send({
      studentNo: sno, password: "demo", name_fa: "بی‌کیس", name_en: "No cases",
      role: "student", university_id: 1, caseIds: [],
    });
    expect(created.status).toBe(200);
    const stk = await token(sno, "demo");
    const forbidden = await request(app).get("/api/cases/1").set(A(stk));
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.stage).toBe("access");
    const missing = await request(app).get("/api/cases/999999").set(A(stk));
    expect(missing.status).toBe(404);
    expect(missing.body.stage).toBe("case");
  });

  it("scheduled exam with max_attempts=1 then evaluate returns attempts_exhausted", async () => {
    const ttk = await token("teacher");
    const atk = await token("admin");
    const sno = `vp28e_${Date.now()}`;
    const created = await request(app).post("/api/users").set(A(atk)).send({
      studentNo: sno, password: "demo", name_fa: "یک‌بار", name_en: "Once",
      role: "student", university_id: 1, caseIds: [],
    });
    expect(created.status).toBe(200);
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "One shot VP", title_fa: "یک‌بار",
      case_ids: [1], starts_at: now, ends_at: end, duration_min: 20, max_attempts: 1,
    });
    expect(exam.status).toBe(200);
    const part = await request(app).put(`/api/exams/${exam.body.id}/participants`).set(A(ttk))
      .send({ studentNos: [sno] });
    expect(part.status).toBe(200);
    const stk = await token(sno, "demo");
    const session = {
      messages: [{ role: "student", text: "سلام من دکتر هستم" }, { role: "patient", text: "درد دارم" }],
      tests: ["ecg"], imaging: [], ddx: ["STEMI"], finalDx: "STEMI",
    };
    const first = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, examId: exam.body.id, lang: "fa", durationSec: 40, session });
    expect(first.status).toBe(200);
    const second = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, examId: exam.body.id, lang: "fa", durationSec: 40, session });
    expect(second.status).toBe(403);
    expect(second.body.reason).toBe("attempts_exhausted");
    expect(second.body.stage).toBe("evaluate");
  });

  it("learner hub GET /learn/vpatient returns JSON with enabled", async () => {
    const ltk = await token("learner", "demo");
    const res = await request(app).get("/api/learn/vpatient").set(A(ltk));
    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"] || "")).toMatch(/json/);
    expect(typeof res.body.enabled).toBe("boolean");
  });

  it("student class cycle: consent status → session → chat → order → evaluate", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40033445");
    const cid = await makeClass(ttk, stuId, 1, { maxAttempts: 3 });
    const stk = await token("40033445");
    const consent = await request(app).get(`/api/research/consent/status?classId=${cid}`).set(A(stk));
    expect(consent.status).toBe(200);
    const sess = await request(app).post("/api/exam/session-start").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa" });
    expect(sess.status).toBe(200);
    expect(sess.body.sessionId).toBeTruthy();
    const chat = await request(app).post("/api/exam/patient-reply").set(A(stk))
      .send({ caseId: 1, classId: cid, userText: "سلام درد قفسه سینه دارید؟", history: [], lang: "fa" });
    expect(chat.status).toBe(200);
    expect(String(chat.body.text || "").trim()).toBeTruthy();
    const order = await request(app).post("/api/exam/order").set(A(stk))
      .send({ caseId: 1, classId: cid, kind: "lab", query: "تروپونین", lang: "fa" });
    expect(order.status).toBe(200);
    expect(String(order.body.text || "").trim()).toBeTruthy();
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({
        caseId: 1, classId: cid, lang: "fa", durationSec: 30, sessionId: sess.body.sessionId,
        session: {
          messages: [
            { role: "student", text: "سلام درد قفسه سینه دارید؟" },
            { role: "patient", text: chat.body.text },
          ],
          tests: ["تروپونین"], imaging: [], ddx: ["STEMI"], finalDx: "STEMI",
        },
      });
    expect(ev.status).toBe(200);
    expect(ev.body.score).toBeGreaterThanOrEqual(0);
  });
  it("GET /cases/:id 404 stage case when inactive for a learner; teacher still reads it", async () => {
    const ttk = await token("teacher");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Inactive VP", title_fa: "غیرفعال", chief_en: "x", chief_fa: "x" });
    expect(created.status).toBe(200);
    const del = await request(app).delete(`/api/cases/${created.body.id}`).set(A(ttk));
    expect(del.status).toBe(200);
    const ltk = await token("learner");
    const r = await request(app).get(`/api/cases/${created.body.id}`).set(A(ltk));
    expect(r.status).toBe(404);
    expect(r.body.stage).toBe("case");
    const teacherRead = await request(app).get(`/api/cases/${created.body.id}`).set(A(ttk));
    expect(teacherRead.status).toBe(200);
    const start = await request(app).post("/api/exam/session-start").set(A(ltk))
      .send({ caseId: created.body.id, lang: "fa" });
    expect(start.status).toBe(404);
    expect(start.body.stage).toBe("case");
  });

  it("POST /research/consent missing study_id is 400 with stage consent", async () => {
    const stk = await token("40012345");
    const r = await request(app).post("/api/research/consent").set(A(stk)).send({});
    expect(r.status).toBe(400);
    expect(r.body.stage).toBe("consent");
    expect(r.body.error).toBe("bad_study_id");
  });

  it("GET /exams and /classes and /cases as a student return JSON arrays (boot lists)", async () => {
    const stk = await token("40012345");
    for (const path of ["/api/exams", "/api/classes", "/api/cases"]) {
      const r = await request(app).get(path).set(A(stk));
      expect(r.status, path).toBe(200);
      expect(String(r.headers["content-type"] || "")).toMatch(/json/);
      expect(Array.isArray(r.body), path).toBe(true);
    }
    const mine = await request(app).get("/api/reports/my").set(A(stk));
    expect(mine.status).toBe(200);
    expect(Array.isArray(mine.body)).toBe(true);
  });
});

describe("zip-30 admin/teacher VP wiring + corrupt payloads", () => {
  it("Admin.jsx actually mounts VpConversations when that tab is selected", () => {
    const src = readFileSync(join(process.cwd(), "../client/src/pages/Admin.jsx"), "utf8");
    expect(src).toMatch(/tab === ["']vpConversations["']\s*&&\s*<VpConversations/);
    expect(src).toMatch(/function VpConversations/);
    expect(src).toMatch(/api\.get\("\/cases"\)\.then\(\(d\) => setCases\(Array\.isArray\(d\) \? d : \[\]\)\)/);
    expect(src).toMatch(/api\.get\("\/classes"\)\.then\(\(d\) => setClasses/);
    expect(src).toMatch(/api\.get\("\/exams"\)\.then\(\(d\) => setExams/);
    expect(src).toContain("p?.__err || loadErr");
    expect(src).toMatch(/reports\/attempts\?type=\$\{type\}/);
    expect(src).toMatch(/\.catch\(\(e\) => \{ setRows\(\[\]\)/);
  });

  it("GET /classes/conversations is JSON even with an empty inbox", async () => {
    const ttk = await token("teacher");
    const r = await request(app).get("/api/classes/conversations").set(A(ttk));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.attempts)).toBe(true);
  });

  it("student class detail hides a deactivated case; teacher still sees it", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Soon inactive", title_fa: "غیرفعال‌شونده", chief_en: "x", chief_fa: "x" });
    expect(created.status).toBe(200);
    const cid = await makeClass(ttk, stuId, created.body.id);
    const del = await request(app).delete(`/api/cases/${created.body.id}`).set(A(ttk));
    expect(del.status).toBe(200);
    const stk = await token("40012345");
    const studentView = await request(app).get(`/api/classes/${cid}`).set(A(stk));
    expect(studentView.status).toBe(200);
    expect((studentView.body.cases || []).some((c) => c.case_id === created.body.id)).toBe(false);
    const teacherView = await request(app).get(`/api/classes/${cid}`).set(A(ttk));
    expect(teacherView.status).toBe(200);
    const row = (teacherView.body.cases || []).find((c) => c.case_id === created.body.id);
    expect(row).toBeTruthy();
    expect(row.active).toBe(false);
    const start = await request(app).post("/api/exam/session-start").set(A(stk))
      .send({ caseId: created.body.id, classId: cid, lang: "fa" });
    expect(start.status).toBe(404);
    expect(start.body.stage).toBe("case");
  });

  it("corrupt case data_json does not 500 class detail or member attempts", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Corrupt JSON", title_fa: "خراب", chief_en: "x", chief_fa: "x" });
    expect(created.status).toBe(200);
    const cid = await makeClass(ttk, stuId, created.body.id);
    db.prepare("UPDATE cases SET data_json=? WHERE id=?").run("NOT JSON", created.body.id);
    const teacherView = await request(app).get(`/api/classes/${cid}`).set(A(ttk));
    expect(teacherView.status).toBe(200);
    expect(String(teacherView.headers["content-type"] || "")).toMatch(/json/);
    const attempts = await request(app).get(`/api/classes/${cid}/members/${stuId}/attempts`).set(A(ttk));
    expect(attempts.status).toBe(200);
    expect(Array.isArray(attempts.body.attempts)).toBe(true);
  });

  it("evaluate still 200 when the case checklist JSON is corrupt", async () => {
    const ttk = await token("teacher");
    const ch = await request(app).post("/api/checklists").set(A(ttk))
      .send({ name_fa: "خراب", name_en: "corrupt", items: [{ id: "x", text_fa: "a", text_en: "a", weight: 1 }] });
    expect(ch.status).toBe(200);
    db.prepare("UPDATE checklists SET items_json=? WHERE id=?").run("NOT JSON", ch.body.id);
    const lists = await request(app).get("/api/checklists").set(A(ttk));
    expect(lists.status).toBe(200);
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Bad checklist", title_fa: "چک‌لیست خراب", chief_en: "x", chief_fa: "x", checklist_id: ch.body.id });
    expect(created.status).toBe(200);
    const stuId = await studentId(ttk, "40012345");
    const cid = await makeClass(ttk, stuId, created.body.id);
    const stk = await token("40012345");
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({
        caseId: created.body.id, classId: cid, lang: "fa", durationSec: 12,
        session: { messages: [{ role: "student", text: "سلام" }], tests: [], imaging: [], ddx: [], finalDx: "" },
      });
    expect(ev.status).toBe(200);
    expect(ev.body.score).toBeGreaterThanOrEqual(0);
  });

  it("corrupt exam case_ids is an empty list, not HTML 500", async () => {
    const ttk = await token("teacher");
    const now = new Date().toISOString();
    const end = new Date(Date.now() + 3600_000).toISOString();
    const created = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Corrupt ids", title_fa: "خراب", case_ids: [1], starts_at: now, ends_at: end, duration_min: 20,
    });
    expect(created.status).toBe(200);
    db.prepare("UPDATE exams SET case_ids=? WHERE id=?").run("NOT JSON", created.body.id);
    const list = await request(app).get("/api/exams").set(A(ttk));
    expect(list.status).toBe(200);
    const row = list.body.find((e) => e.id === created.body.id);
    expect(row).toBeTruthy();
    expect(Array.isArray(row.case_ids)).toBe(true);
    expect(row.case_ids).toEqual([]);
  });
});

describe("zip-31 teacher review + settings guards", () => {
  it("corrupt exam settings JSON does not 500 GET /settings/exam or /order-catalog", async () => {
    const prev = db.prepare("SELECT value FROM settings WHERE key='exam'").get();
    db.prepare("INSERT INTO settings (key,value) VALUES ('exam',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run("NOT JSON");
    try {
      const stk = await token("40012345");
      const r = await request(app).get("/api/settings/exam").set(A(stk));
      expect(r.status).toBe(200);
      expect(String(r.headers["content-type"] || "")).toMatch(/json/);
      const oc = await request(app).get("/api/order-catalog").set(A(stk));
      expect(oc.status).toBe(200);
      expect(Array.isArray(oc.body.labs)).toBe(true);
      expect(Array.isArray(oc.body.imaging)).toBe(true);
    } finally {
      if (prev) db.prepare("UPDATE settings SET value=? WHERE key='exam'").run(prev.value);
      else db.prepare("DELETE FROM settings WHERE key='exam'").run();
    }
  });

  it("class attempt detail exposes teacher review fields and keeps an adjustment", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const cid = await makeClass(ttk, stuId, 1, { logTranscript: true });
    const stk = await token("40012345");
    const sess = await request(app).post("/api/exam/session-start").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa" });
    expect(sess.status).toBe(200);
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk)).send({
      caseId: 1, classId: cid, lang: "fa", durationSec: 15, sessionId: sess.body.sessionId,
      session: { messages: [{ role: "student", text: "سلام" }, { role: "lab", text: "Troponin high" }], tests: [], imaging: [], ddx: [], finalDx: "" },
    });
    expect(ev.status).toBe(200);
    const detail = await request(app).get(`/api/classes/${cid}/attempts/${ev.body.attemptId}`).set(A(ttk));
    expect(detail.status).toBe(200);
    expect(detail.body.attempt.id).toBe(ev.body.attemptId);
    expect(detail.body.attempt).toHaveProperty("teacher_status");
    expect(detail.body.attempt).toHaveProperty("teacher_score");
    expect(detail.body.attempt).toHaveProperty("teacher_feedback");
    const rev = await request(app).put(`/api/reports/attempts/${ev.body.attemptId}/review`).set(A(ttk))
      .send({ status: "adjusted", teacher_score: 77, teacher_feedback: "ok" });
    expect(rev.status).toBe(200);
    const again = await request(app).get(`/api/classes/${cid}/attempts/${ev.body.attemptId}`).set(A(ttk));
    expect(again.status).toBe(200);
    expect(again.body.attempt.teacher_status).toBe("adjusted");
    expect(again.body.attempt.teacher_score).toBe(77);
    expect(again.body.attempt.teacher_feedback).toBe("ok");
  });
});

describe("zip-32 teacher results + daily reward + assignments", () => {
  it("GET /reports/attempts as teacher is a JSON array", async () => {
    const ttk = await token("teacher");
    const r = await request(app).get("/api/reports/attempts?type=vp").set(A(ttk));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });

  it("GET /assignments/:userId survives corrupt case JSON", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Asg corrupt", title_fa: "تخصیص خراب", chief_en: "x", chief_fa: "x" });
    expect(created.status).toBe(200);
    const put = await request(app).put(`/api/assignments/${stuId}`).set(A(ttk))
      .send({ caseIds: [created.body.id], maxAttempts: 1 });
    expect(put.status).toBe(200);
    db.prepare("UPDATE cases SET data_json=? WHERE id=?").run("NOT JSON", created.body.id);
    const r = await request(app).get(`/api/assignments/${stuId}`).set(A(ttk));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });

  it("student class list nCases ignores deactivated cases", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Count inactive", title_fa: "شمارش", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, created.body.id);
    await request(app).delete(`/api/cases/${created.body.id}`).set(A(ttk));
    const stk = await token("40012345");
    const list = await request(app).get("/api/classes").set(A(stk));
    expect(list.status).toBe(200);
    const row = list.body.find((c) => c.id === cid);
    expect(row).toBeTruthy();
    expect(row.nCases).toBe(0);
  });

  it("daily-reward with a non-daily caseId is 400 stage report", async () => {
    const atk = await token("admin");
    await request(app).put("/api/admin/vpatient").set(A(atk))
      .send({ config: { enabled: true, premium_only: false, in_daily: true, daily_gems: 15 } });
    const ltk = await token("learner");
    const r = await request(app).post("/api/learn/vpatient/daily-reward").set(A(ltk)).send({ caseId: 999999 });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("not_daily_case");
    expect(r.body.stage).toBe("report");
  });
});

describe("zip-33 assigned-case home + corrupt banks", () => {
  it("StudentHome surfaces direct-assigned cases as a caseList module", () => {
    const src = readFileSync(join(process.cwd(), "../client/src/pages/StudentHome.jsx"), "utf8");
    expect(src).toContain('key: "caseList"');
    expect(src).toContain('api.get("/cases"');
  });

  it("GET /cases/:id with corrupt JSON is 404 stage case", async () => {
    const ttk = await token("teacher");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Corrupt case", title_fa: "خراب", chief_en: "x", chief_fa: "x" });
    expect(created.status).toBe(200);
    db.prepare("UPDATE cases SET data_json=? WHERE id=?").run("NOT JSON", created.body.id);
    const r = await request(app).get(`/api/cases/${created.body.id}`).set(A(ttk));
    expect(r.status).toBe(404);
    expect(r.body.stage).toBe("case");
  });

  it("GET /flashcards survives a corrupt card", async () => {
    const ttk = await token("teacher");
    const created = await request(app).post("/api/flashcards").set(A(ttk))
      .send({ title_en: "Corrupt card", title_fa: "کارت خراب", questionText_en: "q", questionText_fa: "س" });
    expect(created.status).toBe(200);
    db.prepare("UPDATE flashcards SET data_json=? WHERE id=?").run("NOT JSON", created.body.id);
    const r = await request(app).get("/api/flashcards").set(A(ttk));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });

  it("GET /cases-export.csv survives a corrupt case", async () => {
    const ttk = await token("teacher");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Csv corrupt", title_fa: "خروجی", chief_en: "x", chief_fa: "x" });
    db.prepare("UPDATE cases SET data_json=? WHERE id=?").run("NOT JSON", created.body.id);
    const r = await request(app).get("/api/cases-export.csv").set(A(ttk));
    expect(r.status).toBe(200);
    expect(String(r.headers["content-type"] || "")).toMatch(/csv/i);
  });

  it("GET /reports/progress/:userId as teacher is JSON", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const r = await request(app).get(`/api/reports/progress/${stuId}`).set(A(ttk));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.line)).toBe(true);
    expect(Array.isArray(r.body.radar)).toBe(true);
  });

  it("GET /admin/vpatient/cases as admin is JSON", async () => {
    const atk = await token("admin");
    const r = await request(app).get("/api/admin/vpatient/cases").set(A(atk));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.cases)).toBe(true);
  });
});


describe("zip-34 university prompts + OSCE checklists", () => {
  it("GET /prompts as admin is a JSON object and empty PUT is 400", async () => {
    const atk = await token("admin");
    const r = await request(app).get("/api/prompts").set(A(atk));
    expect(r.status).toBe(200);
    expect(r.body && typeof r.body).toBe("object");
    const empty = await request(app).put("/api/prompts").set(A(atk)).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error).toBe("prompts_required");
    expect(empty.body.stage).toBe("boot");
  });

  it("GET /checklists as teacher is a JSON array", async () => {
    const ttk = await token("teacher");
    const r = await request(app).get("/api/checklists").set(A(ttk));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.length).toBeGreaterThan(0);
  });

  it("Admin.jsx does not empty-wipe university prompts or OSCE checklists on fetch fail", () => {
    const src = readFileSync(join(process.cwd(), "../client/src/pages/Admin.jsx"), "utf8");
    expect(src).toMatch(/api\.get\("\/prompts"\)\.then\(setP\)\.catch/);
    expect(src).toContain('setP({ __err: true })');
    expect(src).toMatch(/api\.get\("\/checklists"\)\.then\(\(d\) => setLists/);
    expect(src).toContain("setLists({ __err: true })");
    expect(src).toContain("setCards({ __err: true })");
    expect(src).toContain("setAttempts({ __err: true })");
  });
});


describe("zip-35 inactive class grade + catalog fail", () => {
  it("teacher gradebook ignores a deactivated case the same way the student does", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const a = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Active grade", title_fa: "فعال", chief_en: "x", chief_fa: "x" });
    const b = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Inactive grade", title_fa: "غیرفعال", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, a.body.id);
    await request(app).put(`/api/classes/${cid}/cases`).set(A(ttk))
      .send({ cases: [{ case_id: a.body.id, weight: 1 }, { case_id: b.body.id, weight: 1 }] });
    db.prepare("INSERT INTO attempts (user_id,type,case_id,class_id,score,lang) VALUES (?,?,?,?,?,?)")
      .run(stuId, "vp", a.body.id, cid, 100, "fa");
    await request(app).delete(`/api/cases/${b.body.id}`).set(A(ttk));
    const teacherView = await request(app).get(`/api/classes/${cid}`).set(A(ttk));
    expect(teacherView.status).toBe(200);
    const member = teacherView.body.members.find((m) => m.id === stuId);
    expect(member).toBeTruthy();
    expect(member.grade).toBe(100);
    const stk = await token("40012345");
    const studentView = await request(app).get(`/api/classes/${cid}`).set(A(stk));
    expect(studentView.status).toBe(200);
    expect(studentView.body.grade).toBe(100);
  });

  it("student GET of a deactivated class is 404 stage boot", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Gone class", title_fa: "کلاس", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, created.body.id);
    const stk = await token("40012345");
    expect((await request(app).get(`/api/classes/${cid}`).set(A(stk))).status).toBe(200);
    await request(app).delete(`/api/classes/${cid}`).set(A(ttk));
    const r = await request(app).get(`/api/classes/${cid}`).set(A(stk));
    expect(r.status).toBe(404);
    expect(r.body.stage).toBe("boot");
  });

  it("remedial refuses a deactivated case", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const live = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Live rem", title_fa: "زنده", chief_en: "x", chief_fa: "x" });
    const dead = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Dead rem", title_fa: "مرده", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, live.body.id);
    await request(app).delete(`/api/cases/${dead.body.id}`).set(A(ttk));
    const r = await request(app).post(`/api/classes/${cid}/remedial`).set(A(ttk))
      .send({ caseId: dead.body.id, userIds: [stuId] });
    expect(r.status).toBe(404);
    expect(r.body.stage).toBe("case");
  });
});

describe("zip-36 exam omit + inactive exam", () => {
  const session = { messages: [{ role: "student", text: "hello" }], tests: [], imaging: [], ddx: [], finalDx: "" };

  async function exclusiveCase(ttk, title = "Exam-only") {
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: title, title_fa: "کیس آزمون", chief_en: "x", chief_fa: "x" });
    expect(created.status).toBe(200);
    return created.body.id;
  }

  async function makeExam(ttk, caseId, extra = {}) {
    const now = extra.starts_at || new Date(Date.now() - 3600e3).toISOString();
    const end = extra.ends_at || new Date(Date.now() + 86400e3).toISOString();
    const created = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: extra.title || `Exam ${Math.random()}`,
      title_fa: "آزمون",
      case_ids: [caseId],
      starts_at: now, ends_at: end, duration_min: 20,
      max_attempts: extra.max_attempts ?? 1,
      studyId: extra.studyId,
    });
    expect(created.status).toBe(200);
    await request(app).put(`/api/exams/${created.body.id}/participants`).set(A(ttk))
      .send({ studentNos: extra.studentNos || ["40012345"] });
    return created.body.id;
  }

  it("omitting examId does not bypass the exam attempt cap and stores exam_id", async () => {
    const ttk = await token("teacher");
    const caseId = await exclusiveCase(ttk, "Cap omit");
    const examId = await makeExam(ttk, caseId, { max_attempts: 1 });
    const stk = await token("40012345");
    const first = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId, lang: "en", session });
    expect(first.status).toBe(200);
    const row = db.prepare("SELECT exam_id, class_id FROM attempts WHERE id=?").get(first.body.attemptId);
    expect(row.exam_id).toBe(examId);
    expect(row.class_id).toBeNull();
    const second = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId, lang: "en", session });
    expect(second.status).toBe(403);
    expect(second.body.reason).toBe("attempts_exhausted");
    expect(second.body.stage).toBe("evaluate");
  });

  it("omitting examId does not bypass a closed exam window", async () => {
    const ttk = await token("teacher");
    const caseId = await exclusiveCase(ttk, "Window omit");
    await makeExam(ttk, caseId, {
      starts_at: new Date(Date.now() - 7200e3).toISOString(),
      ends_at: new Date(Date.now() - 3600e3).toISOString(),
      max_attempts: 5,
    });
    const stk = await token("40012345");
    const r = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId, lang: "en", session });
    expect(r.status).toBe(403);
    expect(r.body.reason).toBe("window");
    expect(r.body.stage).toBe("evaluate");
  });

  it("omitting examId still requires research consent", async () => {
    const ttk = await token("teacher");
    const study = await request(app).post("/api/research/studies").set(A(ttk)).send({
      title_fa: "رضایت آزمون", title_en: "Exam consent",
      domain: "education", active: true, consent_required: true,
      consent_text_fa: "متن رضایت", consent_text_en: "Consent text",
    });
    expect(study.status).toBe(200);
    const adminToken = await token("admin");
    expect((await request(app).put(`/api/research/studies/${study.body.id}`).set(A(adminToken)).send({consent_admin_managed:false})).status).toBe(200);

    const caseId = await exclusiveCase(ttk, "Consent omit");
    await makeExam(ttk, caseId, { max_attempts: 5, studyId: study.body.id });
    const stk = await token("40012345");
    const r = await request(app).post("/api/exam/session-start").set(A(stk))
      .send({ caseId, lang: "en" });
    expect(r.status).toBe(403);
    expect(r.body.reason).toBe("consent_required");
    expect(r.body.stage).toBe("consent");
  });

  it("student GET of a deactivated exam is 404 stage exam", async () => {
    const ttk = await token("teacher");
    const caseId = await exclusiveCase(ttk, "Gone exam");
    const examId = await makeExam(ttk, caseId, { max_attempts: 5 });
    const stk = await token("40012345");
    expect((await request(app).get(`/api/exams/${examId}`).set(A(stk))).status).toBe(200);
    await request(app).delete(`/api/exams/${examId}`).set(A(ttk));
    const r = await request(app).get(`/api/exams/${examId}`).set(A(stk));
    expect(r.status).toBe(404);
    expect(r.body.stage).toBe("exam");
  });

  it("other-university teacher cannot DELETE an exam", async () => {
    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: "Other U 36", name_fa: "دانشگاه دیگر ۳۶" });
    expect(uni.status).toBe(200);
    const uname = `t36_${Date.now()}`;
    const t2 = await request(app).post("/api/users").set(A(atk)).send({
      username: uname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T36", name_fa: "استاد۳۶",
    });
    expect(t2.status).toBe(200);
    const ttk = await token("teacher");
    const caseId = await exclusiveCase(ttk, "Uni exam");
    const examId = await makeExam(ttk, caseId, { max_attempts: 5 });
    const t2tk = await token(uname);
    const del = await request(app).delete(`/api/exams/${examId}`).set(A(t2tk));
    expect(del.status).toBe(403);
    expect(del.body.stage).toBe("access");
  });

  it("student GET exam drops inactive flashcards", async () => {
    const ttk = await token("teacher");
    const live = await request(app).post("/api/flashcards").set(A(ttk))
      .send({ title_en: "Live fc 36", title_fa: "زنده", questionText_en: "q", questionText_fa: "س" });
    const dead = await request(app).post("/api/flashcards").set(A(ttk))
      .send({ title_en: "Dead fc 36", title_fa: "مرده", questionText_en: "q", questionText_fa: "س" });
    expect(live.status).toBe(200);
    expect(dead.status).toBe(200);
    await request(app).delete(`/api/flashcards/${dead.body.id}`).set(A(ttk));
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "FC exam 36", case_ids: [1], use_flashcards: true,
      flashcard_ids: [live.body.id, dead.body.id],
      starts_at: now, ends_at: end, max_attempts: 5,
    });
    expect(exam.status).toBe(200);
    await request(app).put(`/api/exams/${exam.body.id}/participants`).set(A(ttk))
      .send({ studentNos: ["40012345"] });
    const stk = await token("40012345");
    const r = await request(app).get(`/api/exams/${exam.body.id}`).set(A(stk));
    expect(r.status).toBe(200);
    expect(r.body.flashcard_ids).toEqual([live.body.id]);
  });

  it("live-board total ignores deactivated cases", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const a = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "LB A", title_fa: "الف", chief_en: "x", chief_fa: "x" });
    const b = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "LB B", title_fa: "ب", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, a.body.id);
    await request(app).put(`/api/classes/${cid}/cases`).set(A(ttk))
      .send({ cases: [{ case_id: a.body.id, weight: 1 }, { case_id: b.body.id, weight: 1 }] });
    await request(app).delete(`/api/cases/${b.body.id}`).set(A(ttk));
    const board = await request(app).get(`/api/classes/${cid}/live-board`).set(A(ttk));
    expect(board.status).toBe(200);
    expect(board.body.totals.items).toBe(1);
    expect(board.body.totals.cases).toBe(1);
    const row = (board.body.ranked || []).find((m) => m.user_id === stuId);
    expect(row).toBeTruthy();
    expect(row.total).toBe(1);
  });

  it("class flashcard finish refuses a deactivated card", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "FC class", title_fa: "کلاس", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, created.body.id);
    const card = await request(app).post("/api/flashcards").set(A(ttk))
      .send({ title_en: "Class card 36", title_fa: "کارت", questionText_en: "q", questionText_fa: "س" });
    expect(card.status).toBe(200);
    const put = await request(app).put(`/api/classes/${cid}/flashcards`).set(A(ttk))
      .send({ flashcards: [{ flashcard_id: card.body.id, weight: 1 }] });
    expect(put.status).toBe(200);
    await request(app).delete(`/api/flashcards/${card.body.id}`).set(A(ttk));
    const stk = await token("40012345");
    const r = await request(app).post(`/api/classes/${cid}/flashcard/${card.body.id}/finish`).set(A(stk))
      .send({ score: 80, answers: [] });
    expect(r.status).toBe(403);
  });
});

describe("zip-36 source: exam omit + catalogs + student boot", () => {
  const root = join(process.cwd(), "..");
  const examJs = readFileSync(join(process.cwd(), "src/routes/exam.js"), "utf8");
  const examsJs = readFileSync(join(process.cwd(), "src/routes/exams.js"), "utf8");
  const classesJs = readFileSync(join(process.cwd(), "src/routes/classes.js"), "utf8");
  const home = readFileSync(join(root, "client/src/pages/StudentHome.jsx"), "utf8");
  const examPage = readFileSync(join(root, "client/src/pages/Exam.jsx"), "utf8");
  const admin = readFileSync(join(root, "client/src/pages/Admin.jsx"), "utf8");

  it("hasAccess attributes exam quota when examId is omitted", () => {
    expect(examJs).toContain("attributedExamId");
    expect(examJs).toContain("function containersFor");
    expect(examJs).toMatch(/kind: "exam"/);
  });

  it("examAccess returns remaining so standalone budget can spend exam quota", () => {
    expect(examsJs).toMatch(/remaining: Math\.max\(0, \(ex\.max_attempts/);
  });

  it("student GET inactive exam 404s and DELETE is university-scoped", () => {
    expect(examsJs).toContain("if (!ex.active) return res.status(404)");
    expect(examsJs).toMatch(/r\.delete\("\/:id"[\s\S]*canManageExam/);
  });

  it("StudentHome does not swallow /cases as an empty list", () => {
    expect(home).toMatch(/api\.get\("\/cases", \{ timeoutMs: 20_000, stage: "boot" \}\),/);
    expect(home).not.toMatch(/api\.get\("\/cases"[^;]*catch\(\(\) => \[\]\)/);
  });

  it("exam boot fails the order stage when the catalog cannot load", () => {
    // The boot sequence tags the order-catalog fetch with stage "order" and
    // propagates it through the generic failBoot(e, e?.data?.stage || "case").
    expect(examPage).toContain('api.get("/order-catalog", { timeoutMs: 20_000, stage: "order" })');
    expect(examPage).toContain('failBoot(e, e?.data?.stage || "case")');
  });

  it("admin catalogs, case-modal checklists, and class-manage banks surface errors", () => {
    expect(admin).toContain("setList({ __err: true })");
    expect(admin).toContain("setChkErr");
    expect(admin).toMatch(/api\.get\("\/flashcards"\)[\s\S]*setBankErr/);
  });

  it("live-board and classFlashcardInfo ignore inactive content", () => {
    expect(classesJs).toContain("JOIN cases c ON c.id = cc.case_id WHERE cc.class_id=? AND c.active=1");
    expect(classesJs).toContain("SELECT active FROM flashcards WHERE id=?");
  });
});


describe("zip-37 mixed exam VP vs flash attempts", () => {
  async function makeStudent() {
    const atk = await token("admin");
    const sno = `vp37_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
    const created = await request(app).post("/api/users").set(A(atk)).send({
      studentNo: sno, password: "demo", name_fa: "سی‌وهفت", name_en: "ThirtySeven",
      role: "student", university_id: 1, caseIds: [],
    });
    expect(created.status).toBe(200);
    return { sno, stk: await token(sno), id: created.body.id };
  }
  const session = {
    messages: [{ role: "student", text: "hello ecg troponin STEMI aspirin arm pain diabetes" }],
    tests: ["ecg"], imaging: [], ddx: [], finalDx: "STEMI",
  };

  it("finishing the VP case does not lock the flashcard part of the same exam", async () => {
    const ttk = await token("teacher");
    const { sno, stk } = await makeStudent();
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const card = await request(app).post("/api/flashcards").set(A(ttk))
      .send({ title_en: "37fc", title_fa: "۳۷", questionText_en: "q", questionText_fa: "س" });
    expect(card.status).toBe(200);
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Mixed 37", title_fa: "ترکیبی",
      case_ids: [1], use_flashcards: true, flashcard_ids: [card.body.id],
      starts_at: now, ends_at: end, duration_min: 20, max_attempts: 1,
    });
    expect(exam.status).toBe(200);
    await request(app).put(`/api/exams/${exam.body.id}/participants`).set(A(ttk))
      .send({ studentNos: [sno] });
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, examId: exam.body.id, lang: "en", session });
    expect(ev.status).toBe(200);
    const detail = await request(app).get(`/api/exams/${exam.body.id}`).set(A(stk));
    expect(detail.status).toBe(200);
    expect(detail.body.locked).toBe(false);
    expect(detail.body.vpLocked).toBe(true);
    expect(detail.body.flashLocked).toBe(false);
    expect((detail.body.flashcard_ids || []).length).toBeGreaterThan(0);
    const fl = await request(app).post("/api/exam/flashcard-result").set(A(stk))
      .send({ examId: exam.body.id, score: 80, total: 1, correct: 1, wrong: 0, hints: 0, durationSec: 12, lang: "en" });
    expect(fl.status).toBe(200);
    const ev2 = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, examId: exam.body.id, lang: "en", session });
    expect(ev2.status).toBe(403);
    const fl2 = await request(app).post("/api/exam/flashcard-result").set(A(stk))
      .send({ examId: exam.body.id, score: 10, lang: "en" });
    expect(fl2.status).toBe(403);
  });

  it("clamps flashcard-result score to 0–100 and duration to a non-negative value", async () => {
    const { stk } = await makeStudent();
    const r = await request(app).post("/api/exam/flashcard-result").set(A(stk))
      .send({ score: 999, durationSec: -5, lang: "en" });
    expect(r.status).toBe(200);
    expect(r.body.score).toBe(100);
    const row = db.prepare("SELECT score, duration_sec FROM attempts WHERE id=?").get(r.body.attemptId);
    expect(row.score).toBe(100);
    expect(row.duration_sec).toBe(0);
  });

  it("class flashcard finish names a stage on refusal", async () => {
    const ttk = await token("teacher");
    const stk = await token("40012345");
    const r = await request(app).post("/api/classes/999999/flashcard/1/finish").set(A(stk))
      .send({ score: 80, answers: [] });
    expect([403, 404]).toContain(r.status);
    expect(r.body.stage).toBeTruthy();
  });
});

describe("zip-37 source: mixed lock + silent-fail leftovers", () => {
  const root = join(process.cwd(), "..");
  const examsJs = readFileSync(join(process.cwd(), "src/routes/exams.js"), "utf8");
  const examJs = readFileSync(join(process.cwd(), "src/routes/exam.js"), "utf8");
  const classesJs = readFileSync(join(process.cwd(), "src/routes/classes.js"), "utf8");
  const researchJs = readFileSync(join(process.cwd(), "src/routes/research.js"), "utf8");
  const home = readFileSync(join(root, "client/src/pages/StudentHome.jsx"), "utf8");
  const examPage = readFileSync(join(root, "client/src/pages/Exam.jsx"), "utf8");
  const fc = readFileSync(join(root, "client/src/pages/Flashcards.jsx"), "utf8");
  const admin = readFileSync(join(root, "client/src/pages/Admin.jsx"), "utf8");
  const stuEx = readFileSync(join(root, "client/src/pages/StudentExams.jsx"), "utf8");

  it("examAccess counts VP and flash attempts separately", () => {
    expect(examsJs).toContain("function examKindUsed");
    expect(examsJs).toContain('const kind = caseId == null ? "flash" : "vp"');
    expect(examsJs).toContain("vpAttemptsUsed");
  });

  it("Flashcards.jsx boot and submit are not silent", () => {
    expect(fc).toContain("setLoadErr");
    expect(fc).toContain("setSaveErr");
    expect(fc).not.toMatch(/catch \{\s*\}/);
  });

  it("StudentHome does not swallow /reports/my as an empty list", () => {
    expect(home).not.toMatch(/api\.get\("\/reports\/my"[^;\n]*catch\(\(\) => \[\]\)/);
  });

  it("class flashcard finish and live-board name a stage", () => {
    expect(classesJs).toMatch(/flashcard\/:fid\/finish[\s\S]{0,400}stage: "access"/);
    expect(classesJs).toContain("live_board_failed");
  });

  it("Exam.jsx does not keep leftover catalog defaults after a 200", () => {
    expect(examPage).not.toMatch(/oc\.labs\?\.length \? oc\.labs : LAB_TESTS/);
    expect(examPage).toContain("Array.isArray(oc?.labs) ? oc.labs : []");
  });

  it("consent status can resolve a study from caseId when class/exam ids are omitted", () => {
    expect(researchJs).toContain("studyContextForCase");
    expect(examPage).toContain("&caseId=${caseId || \"\"}");
  });

  it("student exam UI locks VP and flash parts independently", () => {
    expect(stuEx).toContain("vpExhausted");
    expect(stuEx).toContain("flashExhausted");
  });

  it("admin user list and live board no longer pretend a failed load is empty", () => {
    expect(admin).toContain("setLoadErr(String(e.message || e))");
    expect(admin).toContain("setBoardErr");
    expect(admin).toContain("if (!r.ok) throw new Error");
  });

  it("flashcard-result clamps score with clampDuration", () => {
    expect(examJs).toContain("let scoreN = Math.max(0, Math.min(100, Number(score) || 0))");
    expect(examJs).toContain("const durN = clampDuration(durationSec)");
  });
});


describe("zip-38 exam window leak + teacher report tenancy", () => {
  const session = {
    messages: [{ role: "student", text: "hello ecg troponin STEMI aspirin arm pain diabetes" }],
    tests: ["ecg"], imaging: [], ddx: [], finalDx: "STEMI",
  };

  it("upcoming exam does not leak case_ids and GET /cases/:id is 403", async () => {
    const ttk = await token("teacher");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Peek 38", title_fa: "نگاه", chief_en: "secret chest pain", chief_fa: "درد سینه محرمانه" });
    expect(created.status).toBe(200);
    const caseId = created.body.id;
    const future = new Date(Date.now() + 86400e3).toISOString();
    const future2 = new Date(Date.now() + 172800e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Upcoming 38", title_fa: "آینده", case_ids: [caseId],
      starts_at: future, ends_at: future2, duration_min: 20, max_attempts: 1,
    });
    expect(exam.status).toBe(200);
    await request(app).put(`/api/exams/${exam.body.id}/participants`).set(A(ttk))
      .send({ studentNos: ["40012345"] });
    const stk = await token("40012345");
    const list = await request(app).get("/api/exams").set(A(stk));
    const row = (list.body || []).find((e) => e.id === exam.body.id);
    expect(row).toBeTruthy();
    expect(row.case_ids == null || row.case_ids.length === 0).toBe(true);
    expect(row.flashcard_ids == null || row.flashcard_ids.length === 0).toBe(true);
    const detail = await request(app).get(`/api/exams/${exam.body.id}`).set(A(stk));
    expect(detail.status).toBe(200);
    expect(detail.body.locked).toBe(true);
    expect(detail.body.case_ids || []).toEqual([]);
    expect(detail.body.cases || []).toEqual([]);
    const peek = await request(app).get(`/api/cases/${caseId}`).set(A(stk));
    expect(peek.status).toBe(403);
    const start = await request(app).post("/api/exam/session-start").set(A(stk))
      .send({ caseId, examId: exam.body.id, lang: "en" });
    expect(start.status).toBe(403);
  });

  it("flashcard-result cannot attach to a VP-only exam", async () => {
    const ttk = await token("teacher");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "VP only 38", title_fa: "فقط کیس", chief_en: "x", chief_fa: "x" });
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "VP only exam", title_fa: "کیس", case_ids: [created.body.id],
      use_flashcards: false, starts_at: now, ends_at: end, duration_min: 20, max_attempts: 3,
    });
    expect(exam.status).toBe(200);
    await request(app).put(`/api/exams/${exam.body.id}/participants`).set(A(ttk))
      .send({ studentNos: ["40012345"] });
    const stk = await token("40012345");
    const fl = await request(app).post("/api/exam/flashcard-result").set(A(stk))
      .send({ examId: exam.body.id, score: 90, lang: "en" });
    expect(fl.status).toBe(403);
  });

  it("other-university teacher cannot read, review, or delete a VP attempt", async () => {
    const ttk = await token("teacher");
    const stk = await token("40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Tenancy 38", title_fa: "مرز", chief_en: "x", chief_fa: "x" });
    const cid = created.body.id;
    const cls = await request(app).post("/api/classes").set(A(ttk))
      .send({ name_en: "Tenancy class", name_fa: "کلاس مرز", maxAttempts: 5 });
    const stuId = (await request(app).get("/api/users").set(A(ttk))).body
      .find((u) => u.username === "40012345").id;
    await request(app).put(`/api/classes/${cls.body.id}/members`).set(A(ttk)).send({ userIds: [stuId] });
    await request(app).put(`/api/classes/${cls.body.id}/cases`).set(A(ttk)).send({ cases: [{ case_id: cid, weight: 1 }] });
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: cid, classId: cls.body.id, lang: "en", session });
    expect(ev.status).toBe(200);
    const attemptId = ev.body.attemptId;
    const home = await request(app).get("/api/reports/attempts").set(A(ttk));
    expect(home.body.some((a) => a.id === attemptId)).toBe(true);

    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: "Other U 38", name_fa: "دانشگاه دیگر ۳۸" });
    const uname = `t38_${Date.now()}`;
    const t2 = await request(app).post("/api/users").set(A(atk)).send({
      username: uname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T38", name_fa: "استاد۳۸",
    });
    expect(t2.status).toBe(200);
    const t2tk = await token(uname);
    const list = await request(app).get("/api/reports/attempts").set(A(t2tk));
    expect(list.status).toBe(200);
    expect(list.body.some((a) => a.id === attemptId)).toBe(false);
    const detail = await request(app).get(`/api/reports/attempts/${attemptId}`).set(A(t2tk));
    expect(detail.status).toBe(403);
    const rev = await request(app).put(`/api/reports/attempts/${attemptId}/review`).set(A(t2tk))
      .send({ status: "adjusted", teacher_score: 1 });
    expect(rev.status).toBe(403);
    const del = await request(app).delete(`/api/reports/attempts/${attemptId}`).set(A(t2tk));
    expect(del.status).toBe(403);
    const card = await request(app).get(`/api/reports/student/${stuId}`).set(A(t2tk));
    expect(card.status).toBe(403);
  });
});

describe("zip-38 source: window leak + report tenancy", () => {
  const examsJs = readFileSync(join(process.cwd(), "src/routes/exams.js"), "utf8");
  const contentJs = readFileSync(join(process.cwd(), "src/routes/content.js"), "utf8");
  const reportsJs = readFileSync(join(process.cwd(), "src/routes/reports.js"), "utf8");

  it("student exam payloads drop case_ids outside the window", () => {
    expect(examsJs).toContain("const { case_ids, flashcard_ids, ...pub } = ex");
    expect(examsJs).toContain("} else if (!ex.use_flashcards)");
  });

  it("canAccessCase does not grant exam cases before the window opens", () => {
    expect(contentJs).toContain("if (s && now < s) continue");
  });

  it("teacher report list/detail/review are university-scoped", () => {
    expect(reportsJs).toContain("function teacherOwnsStudent");
    expect(reportsJs).toContain("scopedAttemptRows");
    expect(reportsJs).toContain('return res.status(403).json({ error: "wrong_university", stage: "access" })');
  });
});


describe("zip-39 university tenancy on class delete, leaderboard, assignments", () => {
  async function otherTeacher(label) {
    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: `Other U ${label}`, name_fa: `دانشگاه دیگر ${label}` });
    expect(uni.status).toBe(200);
    const uname = `t39_${label}_${Date.now()}`;
    const t2 = await request(app).post("/api/users").set(A(atk)).send({
      username: uname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T39", name_fa: "استاد۳۹",
    });
    expect(t2.status).toBe(200);
    return { uniId: uni.body.id, ttk: await token(uname), uname };
  }

  it("other-university teacher cannot deactivate a class", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Home class 39", title_fa: "کلاس", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, created.body.id);
    const { ttk: t2tk } = await otherTeacher("cls");
    const del = await request(app).delete(`/api/classes/${cid}`).set(A(t2tk));
    expect(del.status).toBe(403);
    expect(del.body.error).toBe("wrong_university");
    const stk = await token("40012345");
    const still = await request(app).get(`/api/classes/${cid}`).set(A(stk));
    expect(still.status).toBe(200);
  });

  it("upcoming competition leaderboard is closed; other-university teacher cannot read scores", async () => {
    const ttk = await token("teacher");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Comp 39", title_fa: "رقابت", chief_en: "x", chief_fa: "x" });
    const future = new Date(Date.now() + 86400e3).toISOString();
    const future2 = new Date(Date.now() + 172800e3).toISOString();
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const upcoming = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Upcoming board 39", title_fa: "تابلو آینده", case_ids: [created.body.id],
      competition: true, starts_at: future, ends_at: future2, duration_min: 20, max_attempts: 1,
    });
    expect(upcoming.status).toBe(200);
    await request(app).put(`/api/exams/${upcoming.body.id}/participants`).set(A(ttk))
      .send({ studentNos: ["40012345"] });
    const stk = await token("40012345");
    const peek = await request(app).get(`/api/exams/${upcoming.body.id}/leaderboard`).set(A(stk));
    expect(peek.status).toBe(403);
    expect(peek.body.reason).toBe("window");

    const open = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Open board 39", title_fa: "تابلو باز", case_ids: [created.body.id],
      competition: true, starts_at: now, ends_at: end, duration_min: 20, max_attempts: 3,
    });
    expect(open.status).toBe(200);
    await request(app).put(`/api/exams/${open.body.id}/participants`).set(A(ttk))
      .send({ studentNos: ["40012345"] });
    const homeBoard = await request(app).get(`/api/exams/${open.body.id}/leaderboard`).set(A(ttk));
    expect(homeBoard.status).toBe(200);
    expect(Array.isArray(homeBoard.body.ranked)).toBe(true);
    const { ttk: t2tk } = await otherTeacher("lb");
    const otherBoard = await request(app).get(`/api/exams/${open.body.id}/leaderboard`).set(A(t2tk));
    expect(otherBoard.status).toBe(403);
    expect(otherBoard.body.error).toBe("wrong_university");
  });

  it("other-university teacher cannot read/write VP assignments or reset the student", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const { ttk: t2tk } = await otherTeacher("asg");
    const get = await request(app).get(`/api/assignments/${stuId}`).set(A(t2tk));
    expect(get.status).toBe(403);
    const put = await request(app).put(`/api/assignments/${stuId}`).set(A(t2tk))
      .send({ caseIds: [1], maxAttempts: 9 });
    expect(put.status).toBe(403);
    const pwd = await request(app).put(`/api/users/${stuId}/password`).set(A(t2tk))
      .send({ password: "hacked" });
    expect(pwd.status).toBe(403);
    const st = await request(app).put(`/api/users/${stuId}/status`).set(A(t2tk))
      .send({ status: "inactive" });
    expect(st.status).toBe(403);
    const still = await token("40012345");
    expect(still).toBeTruthy();
  });

  it("assignment and remedial cannot attach another university's case", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const { ttk: t2tk } = await otherTeacher("case");
    const foreign = await request(app).post("/api/cases").set(A(t2tk))
      .send({ title_en: "Foreign 39", title_fa: "بیگانه", chief_en: "secret", chief_fa: "محرمانه" });
    expect(foreign.status).toBe(200);
    const put = await request(app).put(`/api/assignments/${stuId}`).set(A(ttk))
      .send({ caseIds: [foreign.body.id], maxAttempts: 2 });
    expect(put.status).toBe(200);
    expect(put.body.added).toBe(0);
    const listed = await request(app).get(`/api/assignments/${stuId}`).set(A(ttk));
    expect((listed.body || []).some((a) => a.case_id === foreign.body.id)).toBe(false);
    const live = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Home rem 39", title_fa: "جبرانی", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, live.body.id);
    const rem = await request(app).post(`/api/classes/${cid}/remedial`).set(A(ttk))
      .send({ caseId: foreign.body.id, userIds: [stuId] });
    expect(rem.status).toBe(403);
    expect(rem.body.error).toBe("wrong_university");
  });
});

describe("zip-39 source: class delete + leaderboard + student account tenancy", () => {
  const classesJs = readFileSync(join(process.cwd(), "src/routes/classes.js"), "utf8");
  const examsJs = readFileSync(join(process.cwd(), "src/routes/exams.js"), "utf8");
  const contentJs = readFileSync(join(process.cwd(), "src/routes/content.js"), "utf8");

  it("class DELETE and remedial are university-scoped", () => {
    expect(classesJs).toMatch(/r\.delete\("\/:id"[\s\S]*wrong_university/);
    expect(classesJs).toContain("if ((caseRow.university_id || 1) !== (cl.university_id || 1))");
  });

  it("competition leaderboard does not leak before the window or across universities", () => {
    expect(examsJs).toContain('if (windowState(ex) === "upcoming")');
    expect(examsJs).toContain("else if (!canManageExam(req.user, ex))");
  });

  it("assignments and student password/status are university-scoped", () => {
    expect(contentJs).toContain("function canManageStudentAccount");
    expect(contentJs).toContain("function caseIdsForUniversity");
  });
});


describe("zip-40 case/flashcard export-import and teacher VP tenancy", () => {
  async function otherTeacher(label) {
    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: `Other U ${label}`, name_fa: `دانشگاه دیگر ${label}` });
    expect(uni.status).toBe(200);
    const uname = `t40_${label}_${Date.now()}`;
    const t2 = await request(app).post("/api/users").set(A(atk)).send({
      username: uname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T40", name_fa: "استاد۴۰",
    });
    expect(t2.status).toBe(200);
    return { uniId: uni.body.id, ttk: await token(uname), uname };
  }

  it("teacher CSV export does not include another university's VP case or flashcard", async () => {
    const { ttk: t2tk } = await otherTeacher("exp");
    const secret = `SecretDx40_${Date.now()}`;
    const created = await request(app).post("/api/cases").set(A(t2tk))
      .send({ title_en: secret, title_fa: "محرمانه۴۰", chief_en: "x", chief_fa: "x", diagnosis_en: "hidden STEMI" });
    expect(created.status).toBe(200);
    const cardTitle = `SecretFc40_${Date.now()}`;
    const card = await request(app).post("/api/flashcards").set(A(t2tk))
      .send({ title_en: cardTitle, title_fa: "کارت۴۰", questionText_en: "q", questionText_fa: "س",
              options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }] });
    expect(card.status).toBe(200);

    const ttk = await token("teacher");
    const casesCsv = await request(app).get("/api/cases-export.csv").set(A(ttk));
    expect(casesCsv.status).toBe(200);
    expect(casesCsv.text).not.toContain(secret);
    expect(casesCsv.text).not.toContain("hidden STEMI");
    const fcCsv = await request(app).get("/api/flashcards-export.csv").set(A(ttk));
    expect(fcCsv.status).toBe(200);
    expect(fcCsv.text).not.toContain(cardTitle);

    const stk = await token("40012345");
    const bank = await request(app).get("/api/flashcards").set(A(stk));
    expect(bank.status).toBe(200);
    expect((bank.body || []).some((c) => c.title_en === cardTitle || c.id === card.body.id)).toBe(false);
  });

  it("cases-import stamps the teacher's university so the other university cannot see it", async () => {
    const ttk = await token("teacher");
    const title = `Imported40_${Date.now()}`;
    const csv = `title_en,title_fa,chief_en,chief_fa\n${title},وارد۴۰,pain,درد`;
    const imp = await request(app).post("/api/cases-import").set(A(ttk)).send({ csv });
    expect(imp.status).toBe(200);
    expect(imp.body.imported).toBeGreaterThan(0);
    const home = await request(app).get("/api/cases").set(A(ttk));
    expect(home.status).toBe(200);
    expect((home.body || []).some((c) => c.title_en === title)).toBe(true);
    const { ttk: t2tk } = await otherTeacher("imp");
    const other = await request(app).get("/api/cases").set(A(t2tk));
    expect(other.status).toBe(200);
    expect((other.body || []).some((c) => c.title_en === title)).toBe(false);
  });

  it("other-university teacher cannot start or evaluate a VP case", async () => {
    const ttk = await token("teacher");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Home VP 40", title_fa: "خانه۴۰", chief_en: "x", chief_fa: "x" });
    expect(created.status).toBe(200);
    const { ttk: t2tk } = await otherTeacher("vp");
    const peek = await request(app).get(`/api/cases/${created.body.id}`).set(A(t2tk));
    expect(peek.status).toBe(403);
    const start = await request(app).post("/api/exam/session-start").set(A(t2tk))
      .send({ caseId: created.body.id, lang: "en" });
    expect(start.status).toBe(403);
    expect(start.body.reason).toBe("wrong_university");
    const ev = await request(app).post("/api/exam/evaluate").set(A(t2tk))
      .send({ caseId: created.body.id, lang: "en",
              session: { messages: [{ role: "student", text: "hello" }], tests: [], imaging: [], ddx: [], finalDx: "" } });
    expect(ev.status).toBe(403);
    expect(ev.body.reason).toBe("wrong_university");
  });
});

describe("zip-40 source: export/import tenancy + teacher canAccessCase", () => {
  const contentJs = readFileSync(join(process.cwd(), "src/routes/content.js"), "utf8");
  const examJs = readFileSync(join(process.cwd(), "src/routes/exam.js"), "utf8");

  it("student and teacher lists are university-filtered and imports stamp university_id", () => {
    expect(contentJs).toContain('user.role === "teacher" || user.role === "student"');
    expect(contentJs).toContain("INSERT INTO cases (version,difficulty,checklist_id,data_json,university_id)");
    expect(contentJs).toContain("INSERT INTO flashcards (version,difficulty,data_json,university_id)");
  });

  it("teachers cannot run the VP cycle on another university's case", () => {
    expect(contentJs).toContain("if (user.role === \"teacher\")");
    expect(examJs).toContain('reason: "wrong_university"');
    expect(examJs).toContain('reason === "wrong_university" ? "wrong university"');
  });
});


describe("zip-40 research tenancy + consent membership", () => {
  async function otherTeacher(label) {
    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: `Other U ${label}`, name_fa: `دانشگاه دیگر ${label}` });
    expect(uni.status).toBe(200);
    const uname = `t40r_${label}_${Date.now()}`;
    const t2 = await request(app).post("/api/users").set(A(atk)).send({
      username: uname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T40r", name_fa: "استاد۴۰ر",
    });
    expect(t2.status).toBe(200);
    return { uniId: uni.body.id, ttk: await token(uname), uname };
  }

  it("student cannot read or grant consent for a study they are not in", async () => {
    const ttk = await token("teacher");
    const study = await request(app).post("/api/research/studies").set(A(ttk)).send({
      title_fa: "بیگانه", title_en: "Foreign study", domain: "education", active: true,
      consent_required: true, consent_text_fa: "متن رضایت", consent_text_en: "Consent text",
    });
    expect(study.status).toBe(200);
    const stk = await token("40012345");
    const status = await request(app).get(`/api/research/consent/status?studyId=${study.body.id}`).set(A(stk));
    expect(status.status).toBe(403);
    expect(status.body.error).toBe("not_in_study");
    expect(status.body.consentTextFa || "").toBe("");
    const grant = await request(app).post("/api/research/consent").set(A(stk))
      .send({ study_id: study.body.id });
    expect(grant.status).toBe(403);
    expect(grant.body.error).toBe("not_in_study");
    const ev = await request(app).post("/api/research/event").set(A(stk))
      .send({ study_id: study.body.id, event_type: "session_finished", data: { score: 99 } });
    expect(ev.status).toBe(403);
  });

  it("student cannot probe another class's consent status", async () => {
    const ttk = await token("teacher");
    const study = await request(app).post("/api/research/studies").set(A(ttk)).send({
      title_fa: "کلاس دیگر", title_en: "Other class", domain: "education", active: true,
      consent_required: true, consent_text_fa: "محرمانه", consent_text_en: "secret",
    });
    const cls = await request(app).post("/api/classes").set(A(ttk))
      .send({ name_en: "Closed class", name_fa: "بسته", maxAttempts: 3, studyId: study.body.id });
    expect(cls.status).toBe(200);
    const stk = await token("40022334");
    const r = await request(app).get(`/api/research/consent/status?classId=${cls.body.id}`).set(A(stk));
    expect(r.status).toBe(403);
    expect(r.body.stage).toBe("consent");
  });

  it("enrolled student can grant consent; other-university teacher cannot see the VP research row", async () => {
    const ttk = await token("teacher");
    const study = await request(app).post("/api/research/studies").set(A(ttk)).send({
      title_fa: "وصل ۴۰", title_en: "Linked 40", domain: "education", active: true,
      consent_required: true, consent_text_fa: "متن رضایت کلاس", consent_text_en: "Class consent",
    });
    expect(study.status).toBe(200);
    const adminToken = await token("admin");
    expect((await request(app).put(`/api/research/studies/${study.body.id}`).set(A(adminToken)).send({consent_admin_managed:false})).status).toBe(200);

    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "R40", title_fa: "پژوهش", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, created.body.id, { maxAttempts: 5 });
    const putCls = await request(app).put(`/api/classes/${cid}`).set(A(ttk)).send({
      name_fa: "کلاس پژوهش", name_en: "Research class", maxAttempts: 5, studyId: study.body.id,
    });
    expect(putCls.status).toBe(200);
    const stk = await token("40012345");
    const st = await request(app).get(`/api/research/consent/status?classId=${cid}`).set(A(stk));
    expect(st.status).toBe(200);
    expect(st.body.required).toBe(true);
    const grant = await request(app).post("/api/research/consent").set(A(stk))
      .send({ study_id: study.body.id });
    expect(grant.status).toBe(200);
    const sess = await request(app).post("/api/exam/session-start").set(A(stk))
      .send({ caseId: created.body.id, classId: cid, lang: "en" });
    expect(sess.status).toBe(200);

    const homeEvents = await request(app).get("/api/research/events").set(A(ttk));
    expect(homeEvents.status).toBe(200);
    const mine = (homeEvents.body.events || []).find((e) => e.study_id === study.body.id && e.user_id === stuId);
    expect(mine).toBeTruthy();

    const { ttk: t2tk } = await otherTeacher("rs");
    const otherEvents = await request(app).get("/api/research/events").set(A(t2tk));
    expect(otherEvents.status).toBe(200);
    expect((otherEvents.body.events || []).some((e) => e.id === mine.id)).toBe(false);
    const delEv = await request(app).delete(`/api/research/events/${mine.id}`).set(A(t2tk));
    expect(delEv.status).toBe(403);
    const roster = await request(app).get(`/api/research/studies/${study.body.id}/consents`).set(A(t2tk));
    expect(roster.status).toBe(403);
    expect(roster.body.error).toBe("wrong_university");
    expect((roster.body.consents || []).some((c) => c.userId === stuId)).toBe(false);
    const rec = await request(app).post(`/api/research/studies/${study.body.id}/consents/record`).set(A(t2tk))
      .send({ user_id: stuId, mode: "paper", note: "form" });
    expect(rec.status).toBe(403);
    const delStudy = await request(app).delete(`/api/research/studies/${study.body.id}`).set(A(t2tk));
    expect(delStudy.status).toBe(403);
  });
});

describe("zip-40 source: research tenancy + consent membership", () => {
  const researchJs = readFileSync(join(process.cwd(), "src/routes/research.js"), "utf8");
  const consentJs = readFileSync(join(process.cwd(), "src/lib/consent.js"), "utf8");

  it("consent grant and status require class/exam membership", () => {
    expect(consentJs).toContain("function studentLinkedToStudy");
    expect(consentJs).toContain('return { error: "not_in_study" }');
    expect(researchJs).toContain('error: "not_in_study"');
    expect(researchJs).toContain("studentBelongsToClass");
  });

  it("teacher research events/consents/studies are university-scoped", () => {
    expect(researchJs).toContain("function canManageStudy");
    expect(researchJs).toContain("AND u.university_id=?");
    expect(researchJs).toContain("universityId: uni");
  });
});


describe("zip-41 university roster, case versions, post-VP questionnaires", () => {
  async function otherTeacher(label) {
    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: `Other U ${label}`, name_fa: `دانشگاه دیگر ${label}` });
    expect(uni.status).toBe(200);
    const uname = `t41_${label}_${Date.now()}`;
    const t2 = await request(app).post("/api/users").set(A(atk)).send({
      username: uname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T41", name_fa: "استاد۴۱",
    });
    expect(t2.status).toBe(200);
    return { uniId: uni.body.id, ttk: await token(uname), uname };
  }

  it("other-university teacher cannot read case version history (diagnosis)", async () => {
    const ttk = await token("teacher");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Versioned 41", title_fa: "نسخه", chief_en: "x", chief_fa: "x", diagnosis_en: "SECRET-DX-41" });
    expect(created.status).toBe(200);
    const put = await request(app).put(`/api/cases/${created.body.id}`).set(A(ttk))
      .send({ title_en: "Versioned 41b", title_fa: "نسخه۲", chief_en: "x", chief_fa: "x", diagnosis_en: "SECRET-DX-41" });
    expect(put.status).toBe(200);
    const home = await request(app).get(`/api/cases/${created.body.id}/versions`).set(A(ttk));
    expect(home.status).toBe(200);
    expect(JSON.stringify(home.body)).toContain("SECRET-DX-41");
    const { ttk: t2tk } = await otherTeacher("ver");
    const other = await request(app).get(`/api/cases/${created.body.id}/versions`).set(A(t2tk));
    expect(other.status).toBe(403);
  });

  it("other-university teacher cannot list another faculty's students", async () => {
    const ttk = await token("teacher");
    const mine = await request(app).get("/api/universities/1/members").set(A(ttk));
    expect(mine.status).toBe(200);
    expect(Array.isArray(mine.body.students)).toBe(true);
    const { uniId, ttk: t2tk } = await otherTeacher("mem");
    const peek = await request(app).get("/api/universities/1/members").set(A(t2tk));
    expect(peek.status).toBe(403);
    const own = await request(app).get(`/api/universities/${uniId}/members`).set(A(t2tk));
    expect(own.status).toBe(200);
    const list = await request(app).get("/api/universities").set(A(t2tk));
    expect(list.status).toBe(200);
    expect((list.body.universities || []).every((u) => u.id === uniId)).toBe(true);
  });

  it("student cannot load another class's post-VP questionnaire; catalogs are staff-only", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Q class 41", title_fa: "پرسش", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, created.body.id);
    const form = await request(app).post("/api/questionnaires/admin/forms").set(A(ttk)).send({
      title_en: "Post VP 41", title_fa: "پس از بیمار", scope: "class", class_id: cid,
      questions: [{ id: "q1", fa: "س", en: "q", type: "text" }],
    });
    expect(form.status).toBe(200);
    const outsider = `vp41q_${Date.now()}`;
    const atk = await token("admin");
    await request(app).post("/api/users").set(A(atk)).send({
      studentNo: outsider, password: "demo", name_fa: "غریبه", name_en: "Out",
      role: "student", university_id: 1,
    });
    const otk = await token(outsider);
    const peek = await request(app).get(`/api/questionnaires/prompts?contextType=class&contextId=${cid}`).set(A(otk));
    expect(peek.status).toBe(403);
    const member = await request(app).get(`/api/questionnaires/prompts?contextType=class&contextId=${cid}`).set(A(await token("40012345")));
    expect(member.status).toBe(200);
    const cat = await request(app).get("/api/catalogs").set(A(otk));
    expect(cat.status).toBe(403);
  });
});

describe("zip-41 source: versions + university members + questionnaire scope", () => {
  const contentJs = readFileSync(join(process.cwd(), "src/routes/content.js"), "utf8");
  const uniJs = readFileSync(join(process.cwd(), "src/routes/universities.js"), "utf8");
  const qJs = readFileSync(join(process.cwd(), "src/routes/questionnaires.js"), "utf8");

  it("case version history is university-scoped", () => {
    expect(contentJs).toMatch(/r\.get\("\/cases\/:id\/versions"[\s\S]*canManageUniResource/);
    expect(contentJs).toContain('r.get("/catalogs", authRequired, requireRole("teacher", "admin")');
  });

  it("teachers only see their own university roster", () => {
    expect(uniJs).toContain('error: "wrong_university", stage: "access"');
    expect(uniJs).toContain("rows = rows.filter((u) => u.id === uni)");
  });

  it("questionnaire prompts require class/exam membership", () => {
    expect(qJs).toContain("not enrolled");
    // Form-level tenancy (incl. anonymous responses whose user_id is NULL):
    // management is gated per form, and listings LEFT JOIN users so that
    // de-identified responses are never silently hidden by an INNER JOIN.
    expect(qJs).toContain("function canManageForm");
    expect(qJs).toContain("LEFT JOIN users u ON u.id=qr.user_id");
  });
});


describe("zip-42 student flashcard keys + catalog/checklist guards", () => {
  it("student GET /flashcards strips option.correct and hotspot region", async () => {
    const ttk = await token("teacher");
    const created = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "Leak42", title_fa: "نشت۴۲", questionText_en: "q", questionText_fa: "س",
      options: [{ en: "right", fa: "درست", correct: true }, { en: "wrong", fa: "غلط", correct: false }],
      type: "hotspot",
      hotspot: { x: 22, y: 33, r: 8, shape: "circle", label_en: "apex" },
    });
    expect(created.status).toBe(200);
    const stk = await token("40012345");
    const bank = await request(app).get("/api/flashcards").set(A(stk));
    expect(bank.status).toBe(200);
    const card = (bank.body || []).find((c) => c.id === created.body.id);
    expect(card).toBeTruthy();
    expect((card.options || []).every((o) => o.correct == null)).toBe(true);
    expect(card.hotspot?.x).toBeUndefined();
    expect(card.hotspot?.y).toBeUndefined();
    expect(card.hotspot?.r).toBeUndefined();
    const teacherBank = await request(app).get("/api/flashcards").set(A(ttk));
    const full = (teacherBank.body || []).find((c) => c.id === created.body.id);
    expect(full.options.some((o) => o.correct === true)).toBe(true);
    expect(full.hotspot.x).toBe(22);
  });

  it("POST /flashcards/check grades MCQ and hotspot on the server", async () => {
    const ttk = await token("teacher");
    const mcq = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "Check42", title_fa: "چک۴۲", questionText_en: "q", questionText_fa: "س",
      options: [{ en: "a", fa: "الف", correct: false }, { en: "b", fa: "ب", correct: true }],
    });
    expect(mcq.status).toBe(200);
    const hs = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "HS42", title_fa: "هات۴۲", questionText_en: "q", questionText_fa: "س",
      type: "hotspot", imageUrl: "/x.png",
      hotspot: { x: 50, y: 50, r: 10, shape: "circle" },
    });
    expect(hs.status).toBe(200);
    const stk = await token("40012345");
    const wrong = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: mcq.body.id, optionIndex: 0 });
    expect(wrong.status).toBe(200);
    expect(wrong.body.ok).toBe(false);
    const right = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: mcq.body.id, optionIndex: 1, reveal: true });
    expect(right.status).toBe(200);
    expect(right.body.ok).toBe(true);
    expect(right.body.reveal.index).toBe(1);
    const hit = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: hs.body.id, type: "hotspot", x: 50, y: 50 });
    expect(hit.status).toBe(200);
    expect(hit.body.ok).toBe(true);
    const miss = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: hs.body.id, type: "hotspot", x: 1, y: 1 });
    expect(miss.status).toBe(200);
    expect(miss.body.ok).toBe(false);
  });

  it("student flashcard-result with a claimed 100 is rescored from answers", async () => {
    const ttk = await token("teacher");
    const mcq = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "Score42", title_fa: "نمره۴۲", questionText_en: "q", questionText_fa: "س",
      options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }],
    });
    const stk = await token("40012345");
    const r = await request(app).post("/api/exam/flashcard-result").set(A(stk)).send({
      score: 100, total: 1, correct: 1, wrong: 0, lang: "en",
      answers: [{ card_id: mcq.body.id, type: "mcq", selectedIdx: 1, selected: [{ index: 1 }] }],
    });
    expect(r.status).toBe(200);
    expect(r.body.score).toBe(0);
    const row = db.prepare("SELECT score FROM attempts WHERE id=?").get(r.body.attemptId);
    expect(row.score).toBe(0);
  });

  it("teacher cannot PUT/DELETE another teacher's catalog; in-use checklist cannot be deleted", async () => {
    const ttk = await token("teacher");
    const cat = await request(app).post("/api/catalogs").set(A(ttk))
      .send({ name_en: "Mine42", name_fa: "مال من", items: ["a"] });
    expect(cat.status).toBe(200);
    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: "Other U 42", name_fa: "دانشگاه دیگر ۴۲" });
    const uname = `t42_${Date.now()}`;
    await request(app).post("/api/users").set(A(atk)).send({
      username: uname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T42", name_fa: "استاد۴۲",
    });
    const t2tk = await token(uname);
    const put = await request(app).put(`/api/catalogs/${cat.body.id}`).set(A(t2tk))
      .send({ name_en: "Stolen", name_fa: "دزدیده", items: ["hack"] });
    expect(put.status).toBe(403);
    const del = await request(app).delete(`/api/catalogs/${cat.body.id}`).set(A(t2tk));
    expect(del.status).toBe(403);
    const cl = await request(app).post("/api/checklists").set(A(ttk))
      .send({ name_en: "In use 42", name_fa: "در حال استفاده", items: [{ id: "h1", fa: "a", en: "a", keys: ["hi"] }] });
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "CL42", title_fa: "چک", chief_en: "x", chief_fa: "x", checklist_id: cl.body.id });
    expect(created.status).toBe(200);
    const wipe = await request(app).delete(`/api/checklists/${cl.body.id}`).set(A(ttk));
    expect(wipe.status).toBe(409);
    expect(wipe.body.error).toBe("checklist_in_use");
  });
});

describe("zip-42 source: student-safe flashcards + server grade", () => {
  const contentJs = readFileSync(join(process.cwd(), "src/routes/content.js"), "utf8");
  const examJs = readFileSync(join(process.cwd(), "src/routes/exam.js"), "utf8");
  const classesJs = readFileSync(join(process.cwd(), "src/routes/classes.js"), "utf8");
  const fc = readFileSync(join(process.cwd(), "../client/src/pages/Flashcards.jsx"), "utf8");
  const other = readFileSync(join(process.cwd(), "../client/src/components/ExamOtherType.jsx"), "utf8");
  const admin = readFileSync(join(process.cwd(), "../client/src/pages/Admin.jsx"), "utf8");

  it("GET /flashcards strips keys for students and check is server-side", () => {
    expect(contentJs).toContain("studentSafeFlashcard");
    expect(contentJs).toContain('r.post("/flashcards/check"');
    expect(contentJs).toContain("canManageCatalog");
    expect(contentJs).toContain("checklist_in_use");
  });

  it("exam and class flash scores are recomputed from answers", () => {
    expect(examJs).toContain("scoreSubmittedAnswers");
    expect(classesJs).toContain("scoreSubmittedAnswers");
  });

  it("client MCQ/hotspot/other types grade via /flashcards/check", () => {
    expect(fc).toContain('api.post("/flashcards/check"');
    expect(fc).not.toContain("window.location.reload()");
    expect(other).toContain('api.post("/flashcards/check"');
    expect(admin).toContain("detail.__err");
  });
});

describe("zip-43 all question types + Learn VP exam reserve", () => {
  it("student GET strips puzzle pin labels and grades HMAC tokens", async () => {
    const ttk = await token("teacher");
    const created = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "Puzzle43", title_fa: "پازل۴۳", type: "puzzle",
      puzzle: {
        imageUrl: "/x.png",
        pins: [
          { x: 20, y: 30, label_fa: "قشر", label_en: "cortex" },
          { x: 70, y: 60, label_fa: "مدولا", label_en: "medulla" },
        ],
        distractors_fa: ["کپسول"], distractors_en: ["capsule"],
      },
    });
    expect(created.status).toBe(200);
    const stk = await token("40012345");
    const bank = await request(app).get("/api/flashcards").set(A(stk));
    expect(bank.status).toBe(200);
    const card = (bank.body || []).find((c) => c.id === created.body.id);
    expect(card).toBeTruthy();
    expect((card.puzzle.pins || []).every((p) => !p.label_fa && !p.label_en)).toBe(true);
    expect(card.puzzle.distractors_fa).toBeUndefined();
    expect((card.puzzle.bank || []).length).toBeGreaterThanOrEqual(3);
    const cortex = (card.puzzle.bank || []).find((b) => b.en === "cortex" || b.fa === "قشر");
    const medulla = (card.puzzle.bank || []).find((b) => b.en === "medulla" || b.fa === "مدولا");
    expect(cortex?.id).toBeTruthy();
    expect(String(cortex.id).startsWith("p")).toBe(false);
    const wrong = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: created.body.id, type: "puzzle", assign: { 0: medulla.id, 1: cortex.id } });
    expect(wrong.status).toBe(200);
    expect(wrong.body.ok).toBe(false);
    const right = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: created.body.id, type: "puzzle", assign: { 0: cortex.id, 1: medulla.id } });
    expect(right.status).toBe(200);
    expect(right.body.ok).toBe(true);
    expect(right.body.pointsFrac).toBe(1);
  });

  it("student GET strips fill/truefalse/match/order/kf/stepwise keys and check grades them", async () => {
    const ttk = await token("teacher");
    const fill = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "Fill43", title_fa: "جای۴۳", type: "fill", blank_en: "STEMI", blank_fa: "استمی",
      accept_en: ["STEMI", "MI"], accept_fa: ["استمی"],
    });
    const tf = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "TF43", title_fa: "درست۴۳", type: "truefalse", answer: true,
    });
    const match = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "Match43", title_fa: "تطبیق۴۳", type: "match",
      pairs: [["چپ۱", "L1", "راست۱", "R1"], ["چپ۲", "L2", "راست۲", "R2"]],
    });
    const order = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "Order43", title_fa: "مرتب۴۳", type: "order",
      items_fa: ["اول", "دوم"], items_en: ["first", "second"],
    });
    const kf = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "KF43", title_fa: "کی‌اف۴۳", type: "kf",
      kf: { vignette_fa: "شرح", vignette_en: "vignette", items: [
        { kind: "short", prompt_fa: "تشخیص", prompt_en: "dx", answer_fa: "استمی", answer_en: "STEMI", accept_en: ["STEMI"] },
      ] },
    });
    const step = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "Step43", title_fa: "مرحله۴۳", type: "stepwise",
      steps: [{ prompt_fa: "قدم", prompt_en: "step", answer_en: "aspirin", accept_en: ["aspirin"], explanation_en: "give ASA" }],
    });
    expect([fill.status, tf.status, match.status, order.status, kf.status, step.status].every((s) => s === 200)).toBe(true);
    const stk = await token("40012345");
    const bank = await request(app).get("/api/flashcards").set(A(stk));
    const fillId = Number(fill.body.id);
    const tfId = Number(tf.body.id);
    const matchId = Number(match.body.id);
    const orderId = Number(order.body.id);
    const kfId = Number(kf.body.id);
    const stepId = Number(step.body.id);
    const byId = Object.fromEntries((bank.body || []).map((c) => [Number(c.id), c]));
    expect(byId[fillId]).toBeTruthy();
    expect(byId[fillId].blank_en).toBeUndefined();
    expect(byId[fillId].accept_en).toBeUndefined();
    expect(byId[tfId].answer).toBeUndefined();
    expect(byId[matchId].pairs).toBeUndefined();
    expect((byId[matchId].matchLeft || []).length).toBe(2);
    expect(byId[orderId].items_en).toBeUndefined();
    expect((byId[orderId].orderBank_en || []).length).toBe(2);
    expect(byId[kfId].kf.items[0].answer_en).toBeUndefined();
    expect(byId[stepId].steps[0].accept_en).toBeUndefined();
    expect(byId[stepId].steps[0].explanation_en).toBeUndefined();

    const fillOk = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: fillId, type: "fill", text: "STEMI", lang: "en" });
    expect(fillOk.body.ok).toBe(true);
    const tfOk = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: tfId, type: "truefalse", value: true });
    expect(tfOk.body.ok).toBe(true);
    const mCard = byId[matchId];
    const pairs = {};
    for (const L of mCard.matchLeft) {
      const n = String(L.en || "").replace(/^L/, "");
      const R = mCard.matchRight.find((r) => (r.en || "") === `R${n}`);
      pairs[L.id] = R.id;
    }
    const matchOk = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: matchId, type: "match", pairs });
    expect(matchOk.body.ok).toBe(true);
    const oCard = byId[orderId];
    const ordered = ["first", "second"].map((text) => oCard.orderBank_en.find((x) => x.text === text).id);
    const orderOk = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: orderId, type: "order", order: ordered, lang: "en" });
    expect(orderOk.body.ok).toBe(true);
    const kfOk = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: kfId, type: "kf", answers: { 0: "STEMI" }, lang: "en" });
    expect(kfOk.body.ok).toBe(true);
    const stepOk = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: stepId, type: "stepwise", answers: { 0: "aspirin" }, lang: "en" });
    expect(stepOk.body.ok).toBe(true);
  });

  it("upcoming exam flashcard is hidden from student GET and check", async () => {
    const ttk = await token("teacher");
    const card = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "Hidden43", title_fa: "مخفی۴۳", questionText_en: "secret stem", questionText_fa: "صورت محرمانه",
      options: [{ en: "right", fa: "درست", correct: true }, { en: "wrong", fa: "غلط", correct: false }],
    });
    expect(card.status).toBe(200);
    const future = new Date(Date.now() + 86400e3).toISOString();
    const future2 = new Date(Date.now() + 172800e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Upcoming FC 43", title_fa: "فلش آینده", use_flashcards: true,
      flashcard_ids: [card.body.id], starts_at: future, ends_at: future2, max_attempts: 1,
    });
    expect(exam.status).toBe(200);
    await request(app).put(`/api/exams/${exam.body.id}/participants`).set(A(ttk))
      .send({ studentNos: ["40012345"] });
    const stk = await token("40012345");
    const bank = await request(app).get("/api/flashcards").set(A(stk));
    expect((bank.body || []).some((c) => c.id === card.body.id)).toBe(false);
    const chk = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: card.body.id, optionIndex: 0 });
    expect(chk.status).toBe(403);
    expect(chk.body.error).toBe("not_in_window");
  });

  it("learner GET /cases is empty and a live exam case is not playable", async () => {
    const ttk = await token("teacher");
    const atk = await token("admin");
    await request(app).put("/api/admin/vpatient").set(A(atk))
      .send({ config: { enabled: true, premium_only: false, in_daily: true, daily_gems: 15 } });
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Reserved43", title_fa: "رزرو۴۳", chief_en: "secret chest", chief_fa: "درد محرمانه" });
    expect(created.status).toBe(200);
    const future = new Date(Date.now() + 86400e3).toISOString();
    const future2 = new Date(Date.now() + 172800e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Upcoming VP 43", title_fa: "کیس آینده", case_ids: [created.body.id],
      starts_at: future, ends_at: future2, duration_min: 20, max_attempts: 1,
    });
    expect(exam.status).toBe(200);
    const ltk = await token("learner");
    const list = await request(app).get("/api/cases").set(A(ltk));
    expect(list.status).toBe(200);
    expect(list.body).toEqual([]);
    const peek = await request(app).get(`/api/cases/${created.body.id}`).set(A(ltk));
    expect(peek.status).toBe(403);
    const start = await request(app).post("/api/exam/session-start").set(A(ltk))
      .send({ caseId: created.body.id, lang: "en" });
    expect(start.status).toBe(403);
    expect(start.body.reason).toBe("university_only");
    const hub = await request(app).get("/api/learn/vpatient").set(A(ltk));
    expect(hub.status).toBe(200);
    if (hub.body.access) {
      expect((hub.body.cases || []).some((c) => c.id === created.body.id)).toBe(false);
    }
  });
});

describe("zip-43 source: puzzle tokens + live exam reserve", () => {
  const gradeJs = readFileSync(join(process.cwd(), "src/lib/flashcard-grade.js"), "utf8");
  const contentJs = readFileSync(join(process.cwd(), "src/routes/content.js"), "utf8");
  const examJs = readFileSync(join(process.cwd(), "src/routes/exam.js"), "utf8");
  const vpJs = readFileSync(join(process.cwd(), "src/lib/vpatient.js"), "utf8");
  const other = readFileSync(join(process.cwd(), "../client/src/components/ExamOtherType.jsx"), "utf8");

  it("puzzle bank is tokenized and live exam cases are reserved", () => {
    expect(gradeJs).toContain('flashTok(full.id, "P"');
    expect(gradeJs).toContain("out.puzzle = {");
    expect(contentJs).toContain("studentMaySeeFlashcard");
    expect(contentJs).toContain("if (req.user.role === \"learner\") return res.json([])");
    expect(examJs).toContain("caseInLiveExam");
    expect(vpJs).toContain("liveExamCaseIdSet");
    expect(other).toContain("puzzle.bank");
  });
});

describe("zip-44 case-of-day reserve + check gates + truefalse/compare", () => {
  it("reserved exam case is not the Learn case of the day", async () => {
    const ttk = await token("teacher");
    const atk = await token("admin");
    await request(app).put("/api/admin/vpatient").set(A(atk))
      .send({ config: { enabled: true, premium_only: false, in_daily: true, daily_gems: 15 } });
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "DailyReserve44", title_fa: "روزرزرو۴۴", chief_en: "secret daily", chief_fa: "روز محرمانه" });
    expect(created.status).toBe(200);
    const future = new Date(Date.now() + 86400e3).toISOString();
    const future2 = new Date(Date.now() + 172800e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Upcoming VP 44", title_fa: "کیس روز آینده", case_ids: [created.body.id],
      starts_at: future, ends_at: future2, duration_min: 20, max_attempts: 1,
    });
    expect(exam.status).toBe(200);
    const ltk = await token("learner");
    const hub = await request(app).get("/api/learn/vpatient").set(A(ltk));
    expect(hub.status).toBe(200);
    if (hub.body.access) {
      expect((hub.body.cases || []).some((c) => c.id === created.body.id)).toBe(false);
      expect(hub.body.daily_case_id === created.body.id).toBe(false);
    }
  });

  it("learner cannot check a university flashcard; student cannot check a learn-track card", async () => {
    const ttk = await token("teacher");
    const uni = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "UniCheck44", title_fa: "دانشگاه۴۴", questionText_en: "q", questionText_fa: "س",
      options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }],
    });
    expect(uni.status).toBe(200);
    const learn = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "LearnTrack44", title_fa: "لرن۴۴", questionText_en: "q", questionText_fa: "س",
      options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }],
    });
    expect(learn.status).toBe(200);
    const row = db.prepare("SELECT data_json FROM flashcards WHERE id=?").get(learn.body.id);
    const data = JSON.parse(row.data_json);
    data.track = "learn";
    db.prepare("UPDATE flashcards SET data_json=? WHERE id=?").run(JSON.stringify(data), learn.body.id);

    const ltk = await token("learner");
    const learnerChk = await request(app).post("/api/flashcards/check").set(A(ltk))
      .send({ cardId: uni.body.id, optionIndex: 0 });
    expect(learnerChk.status).toBe(403);
    expect(learnerChk.body.error).toBe("university_only");
    expect(learnerChk.body.stage).toBe("evaluate");

    const stk = await token("40012345");
    const studentChk = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: learn.body.id, optionIndex: 0 });
    expect(studentChk.status).toBe(403);
    expect(studentChk.body.error).toBe("wrong_track");
    expect(studentChk.body.stage).toBe("evaluate");
  });

  it("truefalse coerces string false/true and compare strips belongs", async () => {
    const ttk = await token("teacher");
    const tf = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "TF44", title_fa: "درست۴۴", type: "truefalse", answer: false,
    });
    expect(tf.status).toBe(200);
    const cmp = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "Compare44", title_fa: "مقایسه۴۴", type: "compare",
      entityA_en: "STEMI", entityA_fa: "استمی", entityB_en: "NSTEMI", entityB_fa: "غیر استمی",
      features: [
        { fa: "قطع ST", en: "ST elevation", belongs: "A" },
        { fa: "تروپونین", en: "troponin", belongs: "both" },
      ],
    });
    expect(cmp.status).toBe(200);
    const stk = await token("40012345");
    const falseStr = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: tf.body.id, type: "truefalse", value: "false" });
    expect(falseStr.status).toBe(200);
    expect(falseStr.body.ok).toBe(true);
    const trueStr = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: tf.body.id, type: "truefalse", value: "true" });
    expect(trueStr.status).toBe(200);
    expect(trueStr.body.ok).toBe(false);
    const zero = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: tf.body.id, type: "truefalse", value: 0 });
    expect(zero.body.ok).toBe(true);

    const bank = await request(app).get("/api/flashcards").set(A(stk));
    const card = (bank.body || []).find((c) => c.id === cmp.body.id);
    expect(card).toBeTruthy();
    expect((card.features || []).every((f) => f.belongs == null)).toBe(true);
    const wrong = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: cmp.body.id, type: "compare", answers: { 0: "B", 1: "A" } });
    expect(wrong.status).toBe(200);
    expect(wrong.body.ok).toBe(false);
    const right = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: cmp.body.id, type: "compare", answers: { 0: "A", 1: "both" }, reveal: true });
    expect(right.status).toBe(200);
    expect(right.body.ok).toBe(true);
    expect(right.body.pointsFrac).toBe(1);
    expect(right.body.featureResults[0].belongs).toBe("A");
  });

  it("learner cannot GET a university case stem when VP is off", async () => {
    const ttk = await token("teacher");
    const atk = await token("admin");
    await request(app).put("/api/admin/vpatient").set(A(atk))
      .send({ config: { enabled: false, premium_only: false, in_daily: true, daily_gems: 15 } });
    try {
      const created = await request(app).post("/api/cases").set(A(ttk))
        .send({ title_en: "Peek44", title_fa: "نگاه۴۴", chief_en: "secret", chief_fa: "محرمانه" });
      expect(created.status).toBe(200);
      const ltk = await token("learner");
      const peek = await request(app).get(`/api/cases/${created.body.id}`).set(A(ltk));
      expect(peek.status).toBe(403);
      expect(peek.body.reason).toBe("university_only");
      expect(peek.body.stage).toBe("access");
    } finally {
      await request(app).put("/api/admin/vpatient").set(A(atk))
        .send({ config: { enabled: true, premium_only: false, in_daily: true, daily_gems: 15 } });
    }
  });
});

describe("zip-44 source: daily reserve + exam flash flags + pinGrade", () => {
  const gradeJs = readFileSync(join(process.cwd(), "src/lib/flashcard-grade.js"), "utf8");
  const contentJs = readFileSync(join(process.cwd(), "src/routes/content.js"), "utf8");
  const vpJs = readFileSync(join(process.cwd(), "src/lib/vpatient.js"), "utf8");
  const other = readFileSync(join(process.cwd(), "../client/src/components/ExamOtherType.jsx"), "utf8");
  const fc = readFileSync(join(process.cwd(), "../client/src/pages/Flashcards.jsx"), "utf8");
  const stuEx = readFileSync(join(process.cwd(), "../client/src/pages/StudentExams.jsx"), "utf8");
  const appJsx = readFileSync(join(process.cwd(), "../client/src/App.jsx"), "utf8");

  it("caseOfTheDay skips live exams and check gates learners", () => {
    expect(vpJs).toContain("!reserved.has(r.id) && isLearnContent(r.data_json)");
    expect(contentJs).toContain('error: "university_only"');
    expect(contentJs).toContain('error: "wrong_track"');
    expect(contentJs).toContain("vpatientAccess");
    expect(gradeJs).toContain("function coerceTf");
    expect(gradeJs).toContain('if (type === "compare")');
    expect(gradeJs).toContain("const { belongs, ...rest } = f");
  });

  it("exam flash UI honors per-exam show_correct/show_hints and puzzle uses pinGrade", () => {
    expect(stuEx).toContain("showCorrect: data.show_correct");
    expect(stuEx).toContain("showHints: data.show_hints");
    expect(appJsx).toContain("showCorrect={route.showCorrect}");
    expect(fc).toContain("showCorrect: examShowCorrect");
    expect(fc).toContain("if (examShowCorrect != null) next.showCorrect = !!examShowCorrect");
    expect(other).toContain("const pinOk = (i) =>");
    expect(other).toContain("function CompareQuestion");
  });
});

describe("zip-45 learner cannot join university exam + inactive evaluate", () => {
  const session = { messages: [{ role: "student", text: "hello" }], tests: [], imaging: [], ddx: [], finalDx: "" };

  it("learner evaluate/flashcard-result with a spoofed examId does not land in the gradebook", async () => {
    const ttk = await token("teacher");
    const atk = await token("admin");
    await request(app).put("/api/admin/vpatient").set(A(atk))
      .send({ config: { enabled: true, premium_only: false, in_daily: true, daily_gems: 15 } });
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Spoof45", title_fa: "جعل۴۵", chief_en: "x", chief_fa: "x" });
    expect(created.status).toBe(200);
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Uni exam 45", title_fa: "آزمون۴۵", case_ids: [1],
      starts_at: now, ends_at: end, duration_min: 20, max_attempts: 5,
    });
    expect(exam.status).toBe(200);
    const ltk = await token("learner");
    const ev = await request(app).post("/api/exam/evaluate").set(A(ltk))
      .send({ caseId: created.body.id, examId: exam.body.id, classId: 999, lang: "en", session });
    expect(ev.status).toBe(403);
    expect(ev.body.reason).toBe("university_only");
    const learnCase = await request(app).post("/api/cases").set(A(atk))
      .send({ title_en: "Learn45", title_fa: "رقابتی۴۵", chief_en: "x", chief_fa: "x", track: "learn" });
    expect(learnCase.status).toBe(200);
    const evL = await request(app).post("/api/exam/evaluate").set(A(ltk))
      .send({ caseId: learnCase.body.id, examId: exam.body.id, classId: 999, lang: "en", session });
    expect(evL.status).toBe(200);
    const vpRow = db.prepare("SELECT exam_id, class_id FROM attempts WHERE id=?").get(evL.body.attemptId);
    expect(vpRow.exam_id).toBeNull();
    expect(vpRow.class_id).toBeNull();
    const fl = await request(app).post("/api/exam/flashcard-result").set(A(ltk))
      .send({ examId: exam.body.id, score: 99, lang: "en" });
    expect(fl.status).toBe(200);
    const flRow = db.prepare("SELECT exam_id, score FROM attempts WHERE id=?").get(fl.body.attemptId);
    expect(flRow.exam_id).toBeNull();
  });

  it("chat/order/evaluate of a deactivated case are 404 stage case", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Dead mid 45", title_fa: "میانه۴۵", chief_en: "x", chief_fa: "x" });
    expect(created.status).toBe(200);
    const cid = await makeClass(ttk, stuId, created.body.id);
    await request(app).delete(`/api/cases/${created.body.id}`).set(A(ttk));
    const stk = await token("40012345");
    const chat = await request(app).post("/api/exam/patient-reply").set(A(stk))
      .send({ caseId: created.body.id, classId: cid, userText: "سلام", history: [], lang: "fa" });
    expect(chat.status).toBe(404);
    expect(chat.body.stage).toBe("case");
    const order = await request(app).post("/api/exam/order").set(A(stk))
      .send({ caseId: created.body.id, classId: cid, kind: "lab", query: "تروپونین", lang: "fa" });
    expect(order.status).toBe(404);
    expect(order.body.stage).toBe("case");
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: created.body.id, classId: cid, lang: "fa", durationSec: 8, session });
    expect(ev.status).toBe(404);
    expect(ev.body.stage).toBe("case");
  });

  it("exam show_ai=false strips suggestion and missedKey from the student report", async () => {
    const ttk = await token("teacher");
    const created = await request(app).post("/api/cases").set(A(ttk)).send({
      title_en: "NoAi45", title_fa: "بدون‌هوش۴۵", chief_en: "pain", chief_fa: "درد",
      diagnosis_en: "STEMI", diagnosis_fa: "استمی",
      labResults: [{ name_en: "Troponin", name_fa: "تروپونین", result_en: "high", result_fa: "بالا" }],
    });
    expect(created.status).toBe(200);
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "No AI report", title_fa: "بدون تحلیل", case_ids: [created.body.id],
      starts_at: now, ends_at: end, duration_min: 20, max_attempts: 3,
      show_ai: false, show_micro: false,
    });
    expect(exam.status).toBe(200);
    await request(app).put(`/api/exams/${exam.body.id}/participants`).set(A(ttk))
      .send({ studentNos: ["40012345"] });
    const stk = await token("40012345");
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk)).send({
      caseId: created.body.id, examId: exam.body.id, lang: "en", durationSec: 12,
      session: { messages: [{ role: "student", text: "hello" }], tests: [], imaging: [], ddx: [], finalDx: "" },
    });
    expect(ev.status).toBe(200);
    expect(ev.body.showAi).toBe(false);
    expect(ev.body.suggestion).toBe("");
    expect(ev.body.finalDxCorrect).toBeUndefined();
    expect(ev.body.orderReview?.missedKey || []).toEqual([]);
    expect(ev.body.results || []).toEqual([]);
    expect(ev.body.sectionScores).toBeUndefined();
  });
});

describe("zip-45 source: containersFor + empty flash ids + report flags", () => {
  const examJs = readFileSync(join(process.cwd(), "src/routes/exam.js"), "utf8");
  const fc = readFileSync(join(process.cwd(), "../client/src/pages/Flashcards.jsx"), "utf8");
  const examPage = readFileSync(join(process.cwd(), "../client/src/pages/Exam.jsx"), "utf8");

  it("learners cannot attribute VP/flash attempts to a university exam", () => {
    expect(examJs).toContain("function containersFor");
    expect(examJs).toContain('if (user.role !== "student") return { ownerClassId: null, ownerExamId: null }');
    expect(examJs).toContain("const isCompetitive = req.user.role === \"learner\"");
    expect(examJs).toContain("const examOwner = req.user.role === \"student\" ? (examId || null) : null");
    expect(examJs).toContain("function refuseInactiveCase");
  });

  it("empty exam flashcard_ids is an empty deck and report honors showAi from evaluate", () => {
    expect(fc).toContain("filtered = examIds.length ? list.filter((card) => examIds.includes(card.id)) : []");
    expect(examPage).toContain("const showAi = e.showAi != null ? !!e.showAi : settings.showAiAnalysis !== false");
    expect(examJs).toContain("out.showAi = !!showAi");
  });
});

describe("zip-46 staff cannot attribute + exclusive class/exam + empty flash UI", () => {
  const session = { messages: [{ role: "student", text: "hello" }], tests: [], imaging: [], ddx: [], finalDx: "" };

  it("teacher/admin evaluate with a spoofed examId does not land in the gradebook", async () => {
    const ttk = await token("teacher");
    const atk = await token("admin");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Staff46", title_fa: "استاد۴۶", chief_en: "x", chief_fa: "x" });
    expect(created.status).toBe(200);
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Staff exam 46", title_fa: "آزمون۴۶", case_ids: [created.body.id],
      starts_at: now, ends_at: end, duration_min: 20, max_attempts: 5,
    });
    expect(exam.status).toBe(200);
    const evT = await request(app).post("/api/exam/evaluate").set(A(ttk))
      .send({ caseId: created.body.id, examId: exam.body.id, classId: 999, lang: "en", session });
    expect(evT.status).toBe(200);
    const tRow = db.prepare("SELECT exam_id, class_id FROM attempts WHERE id=?").get(evT.body.attemptId);
    expect(tRow.exam_id).toBeNull();
    expect(tRow.class_id).toBeNull();
    const evA = await request(app).post("/api/exam/evaluate").set(A(atk))
      .send({ caseId: created.body.id, examId: exam.body.id, classId: 999, lang: "en", session });
    expect(evA.status).toBe(200);
    const aRow = db.prepare("SELECT exam_id, class_id FROM attempts WHERE id=?").get(evA.body.attemptId);
    expect(aRow.exam_id).toBeNull();
    expect(aRow.class_id).toBeNull();
    const fl = await request(app).post("/api/exam/flashcard-result").set(A(ttk))
      .send({ examId: exam.body.id, score: 88, lang: "en" });
    expect(fl.status).toBe(200);
    const flRow = db.prepare("SELECT exam_id FROM attempts WHERE id=?").get(fl.body.attemptId);
    expect(flRow.exam_id).toBeNull();
  });

  it("student sending both classId and examId stores only the exam", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Dual46", title_fa: "دوگانه۴۶", chief_en: "x", chief_fa: "x" });
    expect(created.status).toBe(200);
    const cid = await makeClass(ttk, stuId, created.body.id);
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Dual exam 46", title_fa: "دوگانه آزمون", case_ids: [created.body.id],
      starts_at: now, ends_at: end, duration_min: 20, max_attempts: 5,
    });
    expect(exam.status).toBe(200);
    await request(app).put(`/api/exams/${exam.body.id}/participants`).set(A(ttk))
      .send({ studentNos: ["40012345"] });
    const stk = await token("40012345");
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk)).send({
      caseId: created.body.id, examId: exam.body.id, classId: cid, lang: "en", durationSec: 9, session,
    });
    expect(ev.status).toBe(200);
    const row = db.prepare("SELECT exam_id, class_id FROM attempts WHERE id=?").get(ev.body.attemptId);
    expect(row.exam_id).toBe(exam.body.id);
    expect(row.class_id).toBeNull();
  });

  it("student GET class does not receive grading_json / gradingRubric", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Rubric46", title_fa: "روبریک۴۶", chief_en: "x", chief_fa: "x" });
    expect(created.status).toBe(200);
    const rubric = {
      roles: {
        extern: { sections: ["history", "exam"], weightMode: "items" },
        intern: { sections: ["history", "exam"], weightMode: "items" },
      },
    };
    const cid = await makeClass(ttk, stuId, created.body.id, { gradingRubric: rubric });
    const teacherView = await request(app).get(`/api/classes/${cid}`).set(A(ttk));
    expect(teacherView.status).toBe(200);
    expect(teacherView.body.class.grading_json).toBeTruthy();
    expect(teacherView.body.class.gradingRubric).toBeTruthy();
    const stk = await token("40012345");
    const studentView = await request(app).get(`/api/classes/${cid}`).set(A(stk));
    expect(studentView.status).toBe(200);
    expect(studentView.body.class.grading_json).toBeUndefined();
    expect(studentView.body.class.gradingRubric).toBeUndefined();
    const list = await request(app).get("/api/classes").set(A(stk));
    expect(list.status).toBe(200);
    const row = (list.body || []).find((c) => c.id === cid);
    expect(row).toBeTruthy();
    expect(row.grading_json).toBeUndefined();
  });
});

describe("zip-46 source: student-only containersFor + empty flash deck UI", () => {
  const examJs = readFileSync(join(process.cwd(), "src/routes/exam.js"), "utf8");
  const classesJs = readFileSync(join(process.cwd(), "src/routes/classes.js"), "utf8");
  const fc = readFileSync(join(process.cwd(), "../client/src/pages/Flashcards.jsx"), "utf8");
  const stuEx = readFileSync(join(process.cwd(), "../client/src/pages/StudentExams.jsx"), "utf8");

  it("only students may attach class/exam ids and the two are exclusive", () => {
    expect(examJs).toContain('if (user.role !== "student") return { ownerClassId: null, ownerExamId: null }');
    expect(examJs).toContain("if (examId) return { ownerClassId: null, ownerExamId: examId }");
    expect(examJs).toContain("if (classId) return { ownerClassId: classId, ownerExamId: null }");
    expect(classesJs).toContain("decorateClass(cl, { forStudent: true })");
    expect(classesJs).toContain("if (forStudent)");
  });

  it("empty exam flash deck is a staged empty-state, not auto-start", () => {
    expect(fc).toContain("no cards in this exam");
    expect(fc).toContain("if (!card)");
    expect(stuEx).toContain("const flashIds = Array.isArray(data.flashcard_ids) ? data.flashcard_ids : []");
    expect(stuEx).toContain("data.use_flashcards && flashIds.length && !flashLocked");
    expect(stuEx).toContain("data.use_flashcards && (data.flashcard_ids || []).length > 0");
    expect(stuEx).toContain("This exam has nothing to start");
  });
});

describe("zip-47 learner cannot read university class/exam + show_ai checklist", () => {
  it("learner cannot list or open university classes or exams", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Leak47", title_fa: "نشت۴۷", chief_en: "x", chief_fa: "x" });
    expect(created.status).toBe(200);
    const cid = await makeClass(ttk, stuId, created.body.id);
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Leak exam 47", title_fa: "نشت آزمون", case_ids: [created.body.id],
      starts_at: now, ends_at: end, duration_min: 20, max_attempts: 3, competition: true,
    });
    expect(exam.status).toBe(200);
    await request(app).put(`/api/exams/${exam.body.id}/participants`).set(A(ttk))
      .send({ studentNos: ["40012345"] });
    const ltk = await token("learner");
    const classList = await request(app).get("/api/classes").set(A(ltk));
    expect(classList.status).toBe(403);
    expect(classList.body.stage).toBe("access");
    const classOne = await request(app).get(`/api/classes/${cid}`).set(A(ltk));
    expect(classOne.status).toBe(403);
    expect(classOne.body.members).toBeUndefined();
    const examList = await request(app).get("/api/exams").set(A(ltk));
    expect(examList.status).toBe(403);
    const board = await request(app).get(`/api/exams/${exam.body.id}/leaderboard`).set(A(ltk));
    expect(board.status).toBe(403);
    const stk = await token("40012345");
    const own = await request(app).get("/api/classes").set(A(stk));
    expect(own.status).toBe(200);
    expect((own.body || []).some((c) => c.id === cid)).toBe(true);
    const teacherList = await request(app).get("/api/classes").set(A(ttk));
    expect(teacherList.status).toBe(200);
  });

  it("student /reports/progress radar is empty (checklist labels stay off the client)", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Radar47", title_fa: "رادار۴۷", chief_en: "x", chief_fa: "x" });
    expect(created.status).toBe(200);
    const cid = await makeClass(ttk, stuId, created.body.id);
    const stk = await token("40012345");
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk)).send({
      caseId: created.body.id, classId: cid, lang: "en", durationSec: 8,
      session: { messages: [{ role: "student", text: "hello" }], tests: [], imaging: [], ddx: [], finalDx: "" },
    });
    expect(ev.status).toBe(200);
    const uid = stuId;
    const prog = await request(app).get(`/api/reports/progress/${uid}`).set(A(stk));
    expect(prog.status).toBe(200);
    expect(prog.body.radar || []).toEqual([]);
    const teacherProg = await request(app).get(`/api/reports/progress/${uid}`).set(A(ttk));
    expect(teacherProg.status).toBe(200);
    expect(Array.isArray(teacherProg.body.radar)).toBe(true);
  });
});

describe("zip-47 source: show_ai strips checklist + learner class/exam gates", () => {
  const examJs = readFileSync(join(process.cwd(), "src/routes/exam.js"), "utf8");
  const examsJs = readFileSync(join(process.cwd(), "src/routes/exams.js"), "utf8");
  const classesJs = readFileSync(join(process.cwd(), "src/routes/classes.js"), "utf8");
  const examPage = readFileSync(join(process.cwd(), "../client/src/pages/Exam.jsx"), "utf8");
  const reportsJs = readFileSync(join(process.cwd(), "src/routes/reports.js"), "utf8");

  it("evaluate and Report hide checklist when showAi is off", () => {
    expect(examJs).toContain("out.results = []");
    expect(examJs).toContain("delete out.sectionScores");
    expect(examPage).toContain("Item-level checklist analysis is off for this exam.");
    expect(examPage).toContain("{showAi ? (e.results || []).map");
    expect(examPage).toContain("showAi && e.sectionScores");
  });

  it("only students/teachers/admins may list classes and exams", () => {
    expect(classesJs).toContain('return res.status(403).json({ error: "forbidden", stage: "access" })');
    expect(examsJs).toContain('if (req.user.role !== "teacher" && req.user.role !== "admin")');
    expect(examsJs).toContain("else if (!canManageExam(req.user, ex))");
    expect(reportsJs).toContain("const radar = isStaff ? Object.entries(agg).map");
  });
});

describe("zip-48 competitive track is separate from university", () => {
  const session = { messages: [{ role: "student", text: "hello" }], tests: [], imaging: [], ddx: [], finalDx: "" };

  it("learner playable hub and GET case only see track=learn", async () => {
    const ttk = await token("teacher");
    const atk = await token("admin");
    await request(app).put("/api/admin/vpatient").set(A(atk))
      .send({ config: { enabled: true, premium_only: false, in_daily: true, daily_gems: 15 } });
    const uni = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Uni48", title_fa: "دانشگاه۴۸", chief_en: "secret", chief_fa: "محرمانه" });
    expect(uni.status).toBe(200);
    const learn = await request(app).post("/api/cases").set(A(atk))
      .send({ title_en: "Learn48", title_fa: "رقابتی۴۸", chief_en: "dyspnea", chief_fa: "تنگی نفس", track: "learn" });
    expect(learn.status).toBe(200);
    expect(learn.body.track).toBe("learn");
    const ltk = await token("learner");
    const peekUni = await request(app).get(`/api/cases/${uni.body.id}`).set(A(ltk));
    expect(peekUni.status).toBe(403);
    expect(peekUni.body.reason).toBe("university_only");
    const peekLearn = await request(app).get(`/api/cases/${learn.body.id}`).set(A(ltk));
    expect(peekLearn.status).toBe(200);
    expect(peekLearn.body.chief_en).toBe("dyspnea");
    expect(peekLearn.body.diagnosis_en).toBeUndefined();
    const hub = await request(app).get("/api/learn/vpatient").set(A(ltk));
    expect(hub.status).toBe(200);
    const ids = (hub.body.cases || []).map((c) => c.id);
    expect(ids).toContain(learn.body.id);
    expect(ids).not.toContain(uni.body.id);
    const stk = await token("40012345");
    const stuPeek = await request(app).get(`/api/cases/${learn.body.id}`).set(A(stk));
    expect(stuPeek.status).toBe(403);
    expect(stuPeek.body.error).toBe("wrong_track");
    const teacherList = await request(app).get("/api/cases").set(A(ttk));
    expect((teacherList.body || []).some((c) => c.id === learn.body.id)).toBe(false);
  });

  it("learner can check learn-track flashcards of university types, not university cards", async () => {
    const ttk = await token("teacher");
    const atk = await token("admin");
    const uni = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "Uni MCQ 48", title_fa: "دانشگاه۴۸", type: "mcq",
      options: [{ en: "A", fa: "الف", correct: true }, { en: "B", fa: "ب", correct: false }],
    });
    expect(uni.status).toBe(200);
    const learn = await request(app).post("/api/flashcards").set(A(atk)).send({
      track: "learn", title_en: "Learn TF 48", title_fa: "رقابتی۴۸", type: "truefalse", answer: true,
    });
    expect(learn.status).toBe(200);
    const ltk = await token("learner");
    const bank = await request(app).get("/api/flashcards").set(A(ltk));
    expect(bank.status).toBe(200);
    const ids = (bank.body || []).map((c) => c.id);
    expect(ids).toContain(learn.body.id);
    expect(ids).not.toContain(uni.body.id);
    const ok = await request(app).post("/api/flashcards/check").set(A(ltk))
      .send({ cardId: learn.body.id, type: "truefalse", value: true });
    expect(ok.status).toBe(200);
    expect(ok.body.ok).toBe(true);
    const denied = await request(app).post("/api/flashcards/check").set(A(ltk))
      .send({ cardId: uni.body.id, type: "mcq", optionIndex: 0 });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe("university_only");
    const stk = await token("40012345");
    const stu = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: learn.body.id, type: "truefalse", value: true });
    expect(stu.status).toBe(403);
    expect(stu.body.error).toBe("wrong_track");
  });

  it("student cannot buy competitive premium", async () => {
    const stk = await token("40012345");
    const r = await request(app).post("/api/pay/subscribe").set(A(stk)).send({ plan: "monthly" });
    expect(r.status).toBe(403);
  });
});

describe("zip-48 source: case track + playableCases learn-only", () => {
  const vpJs = readFileSync(join(process.cwd(), "src/lib/vpatient.js"), "utf8");
  const contentJs = readFileSync(join(process.cwd(), "src/routes/content.js"), "utf8");
  const examJs = readFileSync(join(process.cwd(), "src/routes/exam.js"), "utf8");
  const payJs = readFileSync(join(process.cwd(), "src/routes/payments.js"), "utf8");
  const learnApp = readFileSync(join(process.cwd(), "../client/src/pages/learn/LearnApp.jsx"), "utf8");

  it("learners are gated to track=learn for VP and flashcards", () => {
    expect(vpJs).toContain("isLearnContent(r.data_json)");
    expect(contentJs).toContain("return caseIsLearn(caseId)");
    expect(contentJs).toContain('reason: "university_only"');
    expect(examJs).toContain('if (!caseIsLearn(caseId)) return { allowed: false, reason: "university_only" }');
    expect(payJs).toContain('requireRole("learner")');
    expect(learnApp).toContain('tab === "flashcards"');
  });
});


describe("zip-49 flash + university-container isolation", () => {
  const session = { messages: [{ role: "student", text: "hello" }], tests: [], imaging: [], ddx: [], finalDx: "" };

  it("learner flash bank is learn-track only (no path demo_seed, no university cards)", async () => {
    const ltk = await token("learner");
    const bank = await request(app).get("/api/flashcards").set(A(ltk));
    expect(bank.status).toBe(200);
    expect(Array.isArray(bank.body)).toBe(true);
    expect((bank.body || []).some((c) => c.id === 1)).toBe(false);
    expect((bank.body || []).every((c) => c.track === "learn")).toBe(true);
    expect((bank.body || []).every((c) => c.content_origin !== "demo_seed")).toBe(true);
    const hs = (bank.body || []).find((c) => c.type === "hotspot");
    expect(hs).toBeTruthy();
    expect(hs.imageUrl).toContain("demo-ecg");
    expect(hs.hotspot?.x).toBeUndefined();
    expect(hs.hotspot?.regions).toBeUndefined();
    const hit = await request(app).post("/api/flashcards/check").set(A(ltk))
      .send({ cardId: hs.id, type: "hotspot", x: 20, y: 50 });
    expect(hit.status).toBe(200);
    expect(hit.body.ok).toBe(true);
    const stk = await token("40012345");
    const stuHs = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: hs.id, type: "hotspot", x: 20, y: 50 });
    expect(stuHs.status).toBe(403);
    expect(stuHs.body.error).toBe("wrong_track");
  });

  it("student cannot read learner mycards; learner cannot finish a class flash set", async () => {
    const stk = await token("40012345");
    const mine = await request(app).get("/api/learn/mycards").set(A(stk));
    expect(mine.status).toBe(403);
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const card = await request(app).post("/api/flashcards").set(A(ttk))
      .send({ title_en: "Class49", title_fa: "کلاس۴۹", questionText_en: "q", questionText_fa: "س" });
    expect(card.status).toBe(200);
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Cls49", title_fa: "کلاس", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, created.body.id);
    await request(app).put(`/api/classes/${cid}/flashcards`).set(A(ttk))
      .send({ flashcards: [{ flashcard_id: card.body.id, weight: 1 }] });
    const ltk = await token("learner");
    const finish = await request(app).post(`/api/classes/${cid}/flashcard/${card.body.id}/finish`).set(A(ltk))
      .send({ score: 99, answers: [] });
    expect(finish.status).toBe(403);
  });

  it("learner is 403 on class/exam leftover surfaces and university gradebook", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Box49", title_fa: "ظرف۴۹", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, created.body.id, { logTranscript: true });
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Box exam 49", title_fa: "آزمون۴۹", case_ids: [created.body.id],
      starts_at: now, ends_at: end, duration_min: 20, max_attempts: 3, competition: true,
    });
    expect(exam.status).toBe(200);
    const ltk = await token("learner");
    const paths = [
      `/api/classes/${cid}`,
      `/api/classes/${cid}/live-board`,
      `/api/classes/${cid}/analytics`,
      `/api/classes/${cid}/gradebook.csv`,
      `/api/classes/${cid}/conversation-log.csv`,
      "/api/classes/drawing-inbox",
      `/api/exams/${exam.body.id}`,
      `/api/exams/${exam.body.id}/leaderboard`,
      `/api/exams/${exam.body.id}/analytics`,
      "/api/reports/attempts",
    ];
    for (const path of paths) {
      const r = await request(app).get(path).set(A(ltk));
      expect(r.status, path).toBe(403);
    }
    const ctk = await token("content");
    const cm = await request(app).get("/api/classes").set(A(ctk));
    expect(cm.status).toBe(403);
    const cmExam = await request(app).get("/api/exams").set(A(ctk));
    expect(cmExam.status).toBe(403);
  });

  it("GET /reports/my for a learner has no university exam/class rows", async () => {
    const atk = await token("admin");
    await request(app).put("/api/admin/vpatient").set(A(atk))
      .send({ config: { enabled: true, premium_only: false, in_daily: true, daily_gems: 15 } });
    const ltk = await token("learner");
    const ev = await request(app).post("/api/exam/evaluate").set(A(ltk))
      .send({ caseId: 3, examId: 1, classId: 1, lang: "en", durationSec: 8, session });
    expect(ev.status).toBe(200);
    const row = db.prepare("SELECT exam_id, class_id FROM attempts WHERE id=?").get(ev.body.attemptId);
    expect(row.exam_id).toBeNull();
    expect(row.class_id).toBeNull();
    db.prepare("UPDATE attempts SET exam_id=1, class_id=1 WHERE id=?").run(ev.body.attemptId);
    const mine = await request(app).get("/api/reports/my").set(A(ltk));
    expect(mine.status).toBe(200);
    expect((mine.body || []).some((a) => a.id === ev.body.attemptId)).toBe(false);
    expect((mine.body || []).every((a) => !a.exam_id && !a.exam_fa && a.research === false)).toBe(true);
    const learner = (await request(app).get("/api/auth/me").set(A(ltk))).body;
    const uid = learner.id || learner.user?.id;
    expect(uid).toBeTruthy();
    const prog = await request(app).get(`/api/reports/progress/${uid}`).set(A(ltk));
    expect(prog.status).toBe(200);
    expect(prog.body.radar || []).toEqual([]);
    const stk = await token("40012345");
    const peek = await request(app).get(`/api/reports/progress/${uid}`).set(A(stk));
    expect(peek.status).toBe(403);
  });

  it("assignment and remedial refuse a learn-track case", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const put = await request(app).put(`/api/assignments/${stuId}`).set(A(ttk))
      .send({ caseIds: [3], maxAttempts: 2 });
    expect(put.status).toBe(200);
    expect(put.body.added).toBe(0);
    const listed = await request(app).get(`/api/assignments/${stuId}`).set(A(ttk));
    expect((listed.body || []).some((a) => a.case_id === 3)).toBe(false);
    const live = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Home rem 49", title_fa: "جبرانی۴۹", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, live.body.id);
    const rem = await request(app).post(`/api/classes/${cid}/remedial`).set(A(ttk))
      .send({ caseId: 3, userIds: [stuId] });
    expect(rem.status).toBe(403);
    expect(rem.body.error).toBe("wrong_track");
  });
});

describe("zip-49 source: embedded flash + leftover container gates", () => {
  const root = join(process.cwd(), "..");
  const fc = readFileSync(join(root, "client/src/pages/Flashcards.jsx"), "utf8");
  const learnApp = readFileSync(join(root, "client/src/pages/learn/LearnApp.jsx"), "utf8");
  const contentJs = readFileSync(join(process.cwd(), "src/routes/content.js"), "utf8");
  const reportsJs = readFileSync(join(process.cwd(), "src/routes/reports.js"), "utf8");
  const classesJs = readFileSync(join(process.cwd(), "src/routes/classes.js"), "utf8");
  const examsJs = readFileSync(join(process.cwd(), "src/routes/exams.js"), "utf8");
  const seedJs = readFileSync(join(process.cwd(), "src/seed.js"), "utf8");

  it("LearnApp flash tab is embedded and skips university exam settings", () => {
    expect(fc).toContain("function flashChrome");
    expect(fc).toContain("embedded = false");
    expect(fc).toContain("skipUniExamSettings");
    expect(learnApp).toContain("<Flashcards home={goBack} embedded />");
  });

  it("learner reports drop class/exam rows and assignments skip learn cases", () => {
    expect(reportsJs).toContain('if (req.user.role === "learner")');
    expect(reportsJs).toContain("rows = rows.filter((a) => !a.class_id && !a.exam_id)");
    expect(contentJs).toContain("if (isLearnContent(row.data_json)) continue;");
    expect(contentJs).toContain('if (card.content_origin === "demo_seed") continue');
    expect(classesJs).toContain('error: "wrong_track", reason: "wrong_track"');
    expect(examsJs).toContain("if (caseIsLearn(caseId)) return { allowed: false }");
    expect(seedJs).toContain('type: "hotspot"');
    expect(seedJs).toContain('imageUrl: "/uploads/demo-ecg.svg"');
  });
});

describe("zip-50 learner isolation: questionnaires, tutor, consent, settings", () => {
  it("learner cannot list or submit university questionnaires; student still can", async () => {
    const ttk = await token("teacher");
    const form = await request(app).post("/api/questionnaires/admin/forms").set(A(ttk)).send({
      title_en: "Uni50", title_fa: "دانشگاه۵۰", scope: "general", active: true, anonymous: false,
      questions: [{ id: "q1", type: "text", fa: "س", en: "q" }],
    });
    expect(form.status).toBe(200);
    const ltk = await token("learner");
    const learnerGeneral = await request(app).get("/api/questionnaires/prompts").set(A(ltk));
    expect(learnerGeneral.status).toBe(200);
    expect(learnerGeneral.body.forms).toEqual([]);
    const learnerClass = await request(app).get("/api/questionnaires/prompts?contextType=class&contextId=1").set(A(ltk));
    expect(learnerClass.status).toBe(403);
    expect(learnerClass.body.error).toBe("university_only");
    const learnerExam = await request(app).get("/api/questionnaires/prompts?contextType=exam&contextId=1").set(A(ltk));
    expect(learnerExam.status).toBe(403);
    expect(learnerExam.body.error).toBe("university_only");
    const submit = await request(app).post(`/api/questionnaires/${form.body.id}/responses`).set(A(ltk))
      .send({ answers: { q1: "nope" }, contextType: "general" });
    expect(submit.status).toBe(403);
    expect(submit.body.error).toBe("university_only");

    const stk = await token("40012345");
    const studentGeneral = await request(app).get("/api/questionnaires/prompts").set(A(stk));
    expect(studentGeneral.status).toBe(200);
    expect((studentGeneral.body.forms || []).some((f) => f.id === form.body.id)).toBe(true);
    const ok = await request(app).post(`/api/questionnaires/${form.body.id}/responses`).set(A(stk))
      .send({ answers: { q1: "yes" }, contextType: "general" });
    expect(ok.status).toBe(200);

    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Q50", title_fa: "پرسش۵۰", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, created.body.id);
    const classForm = await request(app).post("/api/questionnaires/admin/forms").set(A(ttk)).send({
      title_en: "Class50", title_fa: "کلاس۵۰", scope: "class", class_id: cid, active: true,
      questions: [{ id: "q1", type: "text", fa: "س", en: "q" }],
    });
    expect(classForm.status).toBe(200);
    const learnerClassForm = await request(app)
      .get(`/api/questionnaires/prompts?contextType=class&contextId=${cid}`).set(A(ltk));
    expect(learnerClassForm.status).toBe(403);
    const member = await request(app)
      .get(`/api/questionnaires/prompts?contextType=class&contextId=${cid}`).set(A(stk));
    expect(member.status).toBe(200);
    expect((member.body.forms || []).some((f) => f.id === classForm.body.id)).toBe(true);
  });

  it("learner cannot use class/exam tutor; enrolled student can", async () => {
    const ttk = await token("teacher");
    await request(app).put("/api/tutor/settings").set(A(ttk)).send({ enabled: true });
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Tutor50", title_fa: "راهنما۵۰", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, created.body.id);
    const enable = await request(app).put("/api/tutor/context-settings").set(A(ttk))
      .send({ contextType: "class", contextId: cid, enabled: true, prompt: "guide" });
    expect(enable.status).toBe(200);

    const ltk = await token("learner");
    const learnerClass = await request(app).get(`/api/tutor/status?contextType=class&contextId=${cid}`).set(A(ltk));
    expect(learnerClass.status).toBe(403);
    expect(learnerClass.body.error).toBe("university_only");
    const learnerHist = await request(app).get(`/api/tutor/history?contextType=class&contextId=${cid}`).set(A(ltk));
    expect(learnerHist.status).toBe(403);
    const learnerMsg = await request(app).post("/api/tutor/message").set(A(ltk))
      .send({ contextType: "class", contextId: cid, message: "hello" });
    expect(learnerMsg.status).toBe(403);
    const learnerGeneral = await request(app).get("/api/tutor/status?contextType=general").set(A(ltk));
    expect(learnerGeneral.status).toBe(200);
    expect(typeof learnerGeneral.body.enabled).toBe("boolean");

    const stk = await token("40012345");
    const member = await request(app).get(`/api/tutor/status?contextType=class&contextId=${cid}`).set(A(stk));
    expect(member.status).toBe(200);
    expect(member.body.enabled).toBe(true);
    const outsider = await token("40022334");
    const out = await request(app).get(`/api/tutor/status?contextType=class&contextId=${cid}`).set(A(outsider));
    expect(out.status).toBe(403);
    expect(out.body.error).toBe("not enrolled");
  });

  it("learner consent/status is university_only with class/exam; empty query still boots", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Consent50", title_fa: "رضایت۵۰", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, created.body.id);
    const ltk = await token("learner");
    const withClass = await request(app).get(`/api/research/consent/status?classId=${cid}`).set(A(ltk));
    expect(withClass.status).toBe(403);
    expect(withClass.body.error).toBe("university_only");
    expect(withClass.body.stage).toBe("consent");
    const empty = await request(app).get("/api/research/consent/status").set(A(ltk));
    expect(empty.status).toBe(200);
    expect(empty.body.required).toBe(false);
    const learnCase = await request(app).get("/api/research/consent/status?caseId=3").set(A(ltk));
    expect(learnCase.status).toBe(200);
    expect(learnCase.body.required).toBe(false);
    const stk = await token("40012345");
    const student = await request(app).get(`/api/research/consent/status?classId=${cid}`).set(A(stk));
    expect(student.status).toBe(200);
  });

  it("research events require study_id after size/vocab; huge payload is still 413", async () => {
    const ltk = await token("learner");
    const missing = await request(app).post("/api/research/event").set(A(ltk))
      .send({ event_type: "session_started", data: { x: 1 } });
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe("bad_study_id");
    const huge = await request(app).post("/api/research/event").set(A(ltk))
      .send({ event_type: "session_started", data: { blob: "x".repeat(20000) } });
    expect(huge.status).toBe(413);
    expect(huge.body.error).toBe("data_too_large");
  });

  it("learner cannot read university settings keys but can read order-catalog", async () => {
    const ltk = await token("learner");
    const exam = await request(app).get("/api/settings/exam").set(A(ltk));
    expect(exam.status).toBe(403);
    const grading = await request(app).get("/api/settings/vp_grading").set(A(ltk));
    expect(grading.status).toBe(403);
    const ai = await request(app).get("/api/settings/ai").set(A(ltk));
    expect(ai.status).toBe(403);
    const catalog = await request(app).get("/api/order-catalog").set(A(ltk));
    expect(catalog.status).toBe(200);
    expect(Array.isArray(catalog.body.labs)).toBe(true);
    expect(catalog.body.labs.length).toBeGreaterThan(0);
    const lists = await request(app).get("/api/checklists").set(A(ltk));
    expect(lists.status).toBe(403);

    const stk = await token("40012345");
    const studentExam = await request(app).get("/api/settings/exam").set(A(stk));
    expect(studentExam.status).toBe(200);
    expect(studentExam.body.duration).toBeTruthy();
    const ttk = await token("teacher");
    const teacherExam = await request(app).get("/api/settings/exam").set(A(ttk));
    expect(teacherExam.status).toBe(200);
    const teacherGrading = await request(app).get("/api/settings/vp_grading").set(A(ttk));
    expect(teacherGrading.status).toBe(200);

    const ctk = await token("content");
    const cmLists = await request(app).get("/api/checklists").set(A(ctk));
    expect(cmLists.status).toBe(200);
    expect(Array.isArray(cmLists.body)).toBe(true);
    const cmMeta = await request(app).get("/api/checklists-meta").set(A(ctk));
    expect(cmMeta.status).toBe(200);
    const cmExam = await request(app).get("/api/settings/exam").set(A(ctk));
    expect(cmExam.status).toBe(200);
    const support = await token("support");
    const supCat = await request(app).get("/api/order-catalog").set(A(support));
    expect(supCat.status).toBe(403);
  });
});

describe("zip-50 source: isolation gates + Exam boot skip", () => {
  const root = join(process.cwd(), "..");
  const qJs = readFileSync(join(process.cwd(), "src/routes/questionnaires.js"), "utf8");
  const tutorJs = readFileSync(join(process.cwd(), "src/routes/tutor.js"), "utf8");
  const researchJs = readFileSync(join(process.cwd(), "src/routes/research.js"), "utf8");
  const contentJs = readFileSync(join(process.cwd(), "src/routes/content.js"), "utf8");
  const examPage = readFileSync(join(root, "client/src/pages/Exam.jsx"), "utf8");
  const appJsx = readFileSync(join(root, "client/src/App.jsx"), "utf8");

  it("keeps questionnaire membership greps and blocks learners", () => {
    expect(qJs).toContain("not enrolled");
    // Form-level tenancy (incl. anonymous responses whose user_id is NULL):
    // management is gated per form, and listings LEFT JOIN users so that
    // de-identified responses are never silently hidden by an INNER JOIN.
    expect(qJs).toContain("function canManageForm");
    expect(qJs).toContain("LEFT JOIN users u ON u.id=qr.user_id");
    expect(qJs).toContain('error: "university_only"');
    expect(qJs).toContain('return res.json({ forms: [] })');
  });

  it("tutor class/exam is membership-gated", () => {
    expect(tutorJs).toContain("function tutorContextDenied");
    expect(tutorJs).toContain('error: "university_only"');
    expect(tutorJs).toContain("studentBelongsToClass");
    expect(tutorJs).toContain("studentBelongsToExam");
  });

  it("research events require study_id after the size cap", () => {
    expect(researchJs).toContain("if (Buffer.byteLength(dataJson, \"utf8\") > MAX_DATA_BYTES)");
    expect(researchJs).toContain('if (!studyId) return res.status(400).json({ error: "bad_study_id"');
    expect(researchJs).toContain('error: "university_only", stage: "consent"');
  });

  it("settings allowlist + learner Exam boot skip + learner tools stay general", () => {
    expect(contentJs).toContain("function canReadSetting");
    expect(contentJs).toContain('if (key === "vp_grading") return role === "teacher"');
    expect(contentJs).toContain("content_manager");
    expect(examPage).toContain("skipUniExamSettings");
    expect(appJsx).toContain('<QuestionnairePrompt contextType="general" contextId={null} />');
    expect(appJsx).toContain('<DrTutorChat contextType="general" contextId={null} />');
  });
});

describe("zip-51 isolation: role lock, import track, group pay, learner×uni", () => {
  it("teacher cannot convert a student into a learner; admin cannot convert learner into student", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const swap = await request(app).put(`/api/admin/users/${stuId}`).set(A(ttk)).send({ role: "learner" });
    expect(swap.status).toBe(403);
    expect(swap.body.error).toBe("role_track_locked");
    const still = await request(app).get("/api/auth/me").set(A(await token("40012345")));
    expect(still.status).toBe(200);
    expect(still.body.user.role).toBe("student");

    const atk = await token("admin");
    const learners = (await request(app).get("/api/admin/users?role=learner").set(A(atk))).body.users || [];
    const learner = learners.find((u) => u.username === "learner");
    expect(learner).toBeTruthy();
    const swapBack = await request(app).put(`/api/admin/users/${learner.id}`).set(A(atk))
      .send({ role: "student", university_id: 1 });
    expect(swapBack.status).toBe(403);
    expect(swapBack.body.error).toBe("role_track_locked");
    const lme = await request(app).get("/api/auth/me").set(A(await token("learner")));
    expect(lme.body.user.role).toBe("learner");
  });

  it("university mill cannot mint a learner; teacher cannot POST role=learner", async () => {
    const ttk = await token("teacher");
    const r = await request(app).post("/api/users").set(A(ttk)).send({
      studentNo: `lrn51_${Date.now()}`, password: "demo", name_fa: "لرنر", name_en: "Learner",
      role: "learner",
    });
    expect(r.status).toBe(403);
  });

  it("import-cases/import-cards stamp track=learn so clones leave the university bank", async () => {
    const ttk = await token("teacher");
    const atk = await token("admin");
    await request(app).put("/api/admin/vpatient").set(A(atk))
      .send({ config: { enabled: true, premium_only: false, in_daily: true, daily_gems: 15 } });
    const uni = await request(app).post("/api/cases").set(A(ttk)).send({
      title_en: "CloneSrc51", title_fa: "منبع۵۱", chief_en: "secret uni", chief_fa: "دانشگاه محرمانه",
    });
    expect(uni.status).toBe(200);
    const card = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "CloneFc51", title_fa: "کارت۵۱", questionText_en: "q", questionText_fa: "س",
      options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }],
    });
    expect(card.status).toBe(200);
    const impC = await request(app).post("/api/admin/vpatient/import-cases").set(A(atk))
      .send({ ids: [uni.body.id] });
    expect(impC.status).toBe(200);
    expect(impC.body.imported).toBe(1);
    const impF = await request(app).post("/api/admin/vpatient/import-cards").set(A(atk))
      .send({ ids: [card.body.id] });
    expect(impF.status).toBe(200);
    expect(impF.body.imported).toBe(1);

    const teacherCases = await request(app).get("/api/cases").set(A(ttk));
    expect((teacherCases.body || []).some((c) => /CloneSrc51 \(Competitive\)/.test(c.title_en || ""))).toBe(false);
    const teacherCards = await request(app).get("/api/flashcards").set(A(ttk));
    expect((teacherCards.body || []).filter((c) => c.title_en === "CloneFc51").every((c) => c.track !== "learn")).toBe(true);

    const ltk = await token("learner");
    const hub = await request(app).get("/api/learn/vpatient?lang=en").set(A(ltk));
    expect(hub.status).toBe(200);
    // Round 5: learners never receive the internal case title (it may name the
    // diagnosis) — the hub card shows the chief complaint instead.
    const clone = (hub.body.cases || []).find((c) => /secret uni/.test(c.chief || ""));
    expect(clone).toBeTruthy();
    expect(clone.title).toBe("");
    const peek = await request(app).get(`/api/cases/${clone.id}`).set(A(ltk));
    expect(peek.status).toBe(200);
    const stk = await token("40012345");
    const stuPeek = await request(app).get(`/api/cases/${clone.id}`).set(A(stk));
    expect(stuPeek.status).toBe(403);
    expect(stuPeek.body.error).toBe("wrong_track");

    const learnerBank = await request(app).get("/api/flashcards").set(A(ltk));
    const clonedCard = (learnerBank.body || []).find((c) => c.title_en === "CloneFc51" || c.title_fa === "کارت۵۱");
    expect(clonedCard).toBeTruthy();
    expect(clonedCard.track).toBe("learn");
    const chk = await request(app).post("/api/flashcards/check").set(A(ltk))
      .send({ cardId: clonedCard.id, optionIndex: 0 });
    expect(chk.status).toBe(200);
    const stuChk = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: clonedCard.id, optionIndex: 0 });
    expect(stuChk.status).toBe(403);
  });

  it("student cannot buy or redeem a Learn group pack; learner×uni lists stay 403 university_only", async () => {
    const stk = await token("40012345");
    const checkout = await request(app).post("/api/pay/group/checkout").set(A(stk)).send({ packId: 1 });
    expect(checkout.status).toBe(403);
    const redeem = await request(app).post("/api/pay/group/redeem").set(A(stk)).send({ code: "XXXX-XXXX" });
    expect(redeem.status).toBe(403);

    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Iso51", title_fa: "جدا۵۱", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, created.body.id);
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Iso exam 51", title_fa: "آزمون۵۱", case_ids: [created.body.id],
      starts_at: now, ends_at: end, duration_min: 20, max_attempts: 3, competition: true,
    });
    expect(exam.status).toBe(200);
    const ltk = await token("learner");
    const classList = await request(app).get("/api/classes").set(A(ltk));
    expect(classList.status).toBe(403);
    expect(classList.body.error).toBe("university_only");
    const classOne = await request(app).get(`/api/classes/${cid}`).set(A(ltk));
    expect(classOne.status).toBe(403);
    expect(classOne.body.error).toBe("university_only");
    expect(classOne.body.members).toBeUndefined();
    expect(classOne.body.cases).toBeUndefined();
    const examList = await request(app).get("/api/exams").set(A(ltk));
    expect(examList.status).toBe(403);
    expect(examList.body.error).toBe("university_only");
    const examOne = await request(app).get(`/api/exams/${exam.body.id}`).set(A(ltk));
    expect(examOne.status).toBe(403);
    expect(examOne.body.error).toBe("university_only");
    const board = await request(app).get(`/api/exams/${exam.body.id}/leaderboard`).set(A(ltk));
    expect(board.status).toBe(403);
    expect(board.body.error).toBe("university_only");

    const learnHome = await request(app).get("/api/learn/home").set(A(stk));
    expect(learnHome.status).toBe(403);
  });

  it("impersonate JWT is the target role: learner cannot open classes; student cannot open Learn", async () => {
    const atk = await token("admin");
    const learners = (await request(app).get("/api/admin/users?role=learner").set(A(atk))).body.users || [];
    const learner = learners.find((u) => u.username === "learner");
    const impL = await request(app).post(`/api/admin/users/${learner.id}/impersonate`).set(A(atk));
    expect(impL.status).toBe(200);
    expect(impL.body.user.role).toBe("learner");
    const asLearner = await request(app).get("/api/classes").set(A(impL.body.token));
    expect(asLearner.status).toBe(403);

    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const impS = await request(app).post(`/api/admin/users/${stuId}/impersonate`).set(A(atk));
    expect(impS.status).toBe(200);
    expect(impS.body.user.role).toBe("student");
    const asStudent = await request(app).get("/api/learn/home").set(A(impS.body.token));
    expect(asStudent.status).toBe(403);
  });
});

describe("zip-51 source: role lock + import track + group pay + learner leave", () => {
  const adminJs = readFileSync(join(process.cwd(), "src/routes/admin.js"), "utf8");
  const payJs = readFileSync(join(process.cwd(), "src/routes/payments.js"), "utf8");
  const contentJs = readFileSync(join(process.cwd(), "src/routes/content.js"), "utf8");
  const classesJs = readFileSync(join(process.cwd(), "src/routes/classes.js"), "utf8");
  const examsJs = readFileSync(join(process.cwd(), "src/routes/exams.js"), "utf8");
  const examPage = readFileSync(join(process.cwd(), "../client/src/pages/Exam.jsx"), "utf8");

  it("locks student↔learner role swaps and stamps Learn track on VP imports", () => {
    expect(adminJs).toContain("function roleTrackLocked");
    expect(adminJs).toContain('error: "role_track_locked"');
    expect(adminJs).toContain('d.track = "learn"');
    expect(contentJs).toContain('error: "role_track_locked"');
    expect(contentJs).toContain('if (req.user.role === "teacher" && role !== "student")');
  });

  it("group checkout/redeem are learner-only and learner class/exam 403 is university_only", () => {
    expect(payJs).toContain('r.post("/group/checkout", authRequired, requireRole("learner")');
    expect(payJs).toContain('r.post("/group/redeem", authRequired, requireRole("learner")');
    expect(classesJs).toContain('error: "university_only", reason: "university_only", stage: "access"');
    expect(examsJs).toContain('if (req.user.role === "learner")');
    expect(examPage).toContain("const leaveExam = () =>");
    expect(examPage).toContain('if (user?.role === "learner") { go?.("caseList"); return; }');
  });
});

describe("zip-52 phase 9: rubric strip + staff/checklist isolation", () => {
  const session = { messages: [{ role: "student", text: "hello" }], tests: [], imaging: [], ddx: [], finalDx: "" };

  it("student session-start has gradingScope but not gradingRubric; teacher still gets the snapshot", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Rubric52", title_fa: "روبریک۵۲", chief_en: "x", chief_fa: "x" });
    expect(created.status).toBe(200);
    const cid = await makeClass(ttk, stuId, created.body.id, { gradingRole: "history" });
    const stk = await token("40012345");
    const sess = await request(app).post("/api/exam/session-start").set(A(stk))
      .send({ caseId: created.body.id, classId: cid, lang: "fa" });
    expect(sess.status).toBe(200);
    expect(sess.body.gradingScope).toBe("extern");
    expect(sess.body.gradingRubric).toBeUndefined();
    const tstart = await request(app).post("/api/exam/session-start").set(A(ttk))
      .send({ caseId: created.body.id, classId: cid, lang: "fa" });
    expect(tstart.status).toBe(200);
    expect(tstart.body.gradingRubric?.roles?.extern?.sections).toEqual(["history", "exam", "problem_list", "ddx"]);
  });

  it("student evaluate JSON has no meta.rubric; stored eval_json keeps the snapshot", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40022334");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "EvalRubric52", title_fa: "نمره۵۲", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, created.body.id, { gradingRole: "overall" });
    const stk = await token("40022334");
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: created.body.id, classId: cid, lang: "en", durationSec: 9, session });
    expect(ev.status).toBe(200);
    expect(ev.body.meta.gradingScope).toBe("intern");
    expect(ev.body.meta.rubric).toBeUndefined();
    expect(ev.body.sectionScores?.rubric).toBeUndefined();
    const stored = db.prepare("SELECT eval_json FROM attempts WHERE id=?").get(ev.body.attemptId);
    const parsed = JSON.parse(stored.eval_json);
    expect(parsed.meta.rubric.roles.intern.sections.length).toBeGreaterThan(0);
  });

  it("content_manager cannot open university cases/flash; learn track still works", async () => {
    const ttk = await token("teacher");
    const atk = await token("admin");
    await request(app).put("/api/admin/vpatient").set(A(atk))
      .send({ config: { enabled: true, premium_only: false, in_daily: true, daily_gems: 15 } });
    const uni = await request(app).post("/api/cases").set(A(ttk)).send({
      title_en: "StaffLeak52", title_fa: "نشت۵۲", chief_en: "secret", chief_fa: "محرمانه",
      diagnosis_en: "HIDDEN-DX-52",
    });
    expect(uni.status).toBe(200);
    const uniCard = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "StaffFc52", title_fa: "کارت۵۲",
      options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }],
    });
    expect(uniCard.status).toBe(200);
    const learn = await request(app).post("/api/cases").set(A(atk)).send({
      title_en: "LearnStaff52", title_fa: "لرن۵۲", chief_en: "dyspnea", chief_fa: "تنگی",
      track: "learn", diagnosis_en: "PE",
    });
    expect(learn.status).toBe(200);
    const learnCard = await request(app).post("/api/flashcards").set(A(atk)).send({
      track: "learn", title_en: "LearnFc52", title_fa: "فلش۵۲", type: "truefalse", answer: true,
    });
    expect(learnCard.status).toBe(200);

    const ctk = await token("content");
    const list = await request(app).get("/api/cases").set(A(ctk));
    expect(list.status).toBe(200);
    expect((list.body || []).some((c) => c.id === uni.body.id)).toBe(false);
    expect((list.body || []).every((c) => c.track === "learn")).toBe(true);
    const peekUni = await request(app).get(`/api/cases/${uni.body.id}`).set(A(ctk));
    expect(peekUni.status).toBe(403);
    expect(peekUni.body.reason).toBe("university_only");
    const start = await request(app).post("/api/exam/session-start").set(A(ctk))
      .send({ caseId: uni.body.id, lang: "en" });
    expect(start.status).toBe(403);
    expect(start.body.reason).toBe("university_only");
    const peekLearn = await request(app).get(`/api/cases/${learn.body.id}`).set(A(ctk));
    expect(peekLearn.status).toBe(200);
    expect(peekLearn.body.diagnosis_en).toBe("PE");

    const bank = await request(app).get("/api/flashcards").set(A(ctk));
    expect(bank.status).toBe(200);
    expect((bank.body || []).some((c) => c.id === uniCard.body.id)).toBe(false);
    expect((bank.body || []).every((c) => c.track === "learn")).toBe(true);
    const chkUni = await request(app).post("/api/flashcards/check").set(A(ctk))
      .send({ cardId: uniCard.body.id, optionIndex: 0 });
    expect(chkUni.status).toBe(403);
    expect(chkUni.body.error).toBe("university_only");
    const chkLearn = await request(app).post("/api/flashcards/check").set(A(ctk))
      .send({ cardId: learnCard.body.id, type: "truefalse", value: true });
    expect(chkLearn.status).toBe(200);
    expect(chkLearn.body.ok).toBe(true);
  });

  it("teacher cannot PUT another university's in-use checklist or check its flashcard", async () => {
    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: "Other U 52", name_fa: "دانشگاه دیگر ۵۲" });
    expect(uni.status).toBe(200);
    const uname = `t52_${Date.now()}`;
    await request(app).post("/api/users").set(A(atk)).send({
      username: uname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T52", name_fa: "استاد۵۲",
    });
    const t2tk = await token(uname);
    const secretName = `SecretCL52_${Date.now()}`;
    const cl = await request(app).post("/api/checklists").set(A(t2tk)).send({
      name_en: secretName, name_fa: "چک محرمانه۵۲",
      items: [{ id: "h1", fa: "کلید مخفی", en: "secret key", keys: ["hidden-key-52"] }],
    });
    expect(cl.status).toBe(200);
    const created = await request(app).post("/api/cases").set(A(t2tk)).send({
      title_en: "CL case 52", title_fa: "کیس چک۵۲", chief_en: "x", chief_fa: "x",
      checklist_id: cl.body.id,
    });
    expect(created.status).toBe(200);
    const card = await request(app).post("/api/flashcards").set(A(t2tk)).send({
      title_en: "ForeignFc52", title_fa: "کارت بیگانه۵۲",
      options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }],
    });
    expect(card.status).toBe(200);

    const ttk = await token("teacher");
    const lists = await request(app).get("/api/checklists").set(A(ttk));
    expect(lists.status).toBe(200);
    expect((lists.body || []).some((c) => c.id === cl.body.id || c.name_en === secretName)).toBe(false);
    const put = await request(app).put(`/api/checklists/${cl.body.id}`).set(A(ttk)).send({
      name_en: "Stolen", name_fa: "دزدیده", items: [],
    });
    expect(put.status).toBe(403);
    expect(put.body.error).toBe("wrong_university");
    const chk = await request(app).post("/api/flashcards/check").set(A(ttk))
      .send({ cardId: card.body.id, optionIndex: 0 });
    expect(chk.status).toBe(403);
    expect(chk.body.error).toBe("wrong_university");
    const homePut = await request(app).put(`/api/checklists/${cl.body.id}`).set(A(t2tk)).send({
      name_en: secretName, name_fa: "چک محرمانه۵۲",
      items: [{ id: "h1", fa: "کلید مخفی", en: "secret key", keys: ["hidden-key-52"] }],
    });
    expect(homePut.status).toBe(200);
  });
});

describe("zip-52 source: rubric strip + staff/checklist isolation", () => {
  const examJs = readFileSync(join(process.cwd(), "src/routes/exam.js"), "utf8");
  const contentJs = readFileSync(join(process.cwd(), "src/routes/content.js"), "utf8");

  it("session-start and evaluate hide the rubric from students/learners", () => {
    expect(examJs).toContain("if (req.user.role !== \"student\" && req.user.role !== \"learner\") payload.gradingRubric = gradingRubric");
    expect(examJs).toContain("const { rubric: _rubricSnap, ...metaPub } = out.meta");
    expect(examJs).toContain('if (user.role === "content_manager" || user.role === "support")');
    expect(examJs).toContain('if (user.role !== "student") return { allowed: false, reason: "not_assigned" }');
  });

  it("content_manager is learn-only and checklist PUT is university-scoped", () => {
    expect(contentJs).toContain("if (user.role === \"content_manager\" || user.role === \"support\") return caseIsLearn(caseId)");
    expect(contentJs).toContain("function teacherManagesChecklist");
    // Teacher scoping is inlined in the checklists route: own-university rows
    // or own-authored (owner_id) rows only.
    expect(contentJs).toContain('if (req.user.role === "teacher") {');
    expect(contentJs).toContain("const mine = currentUniversityId(req.user);");
    expect(contentJs).toContain("return owner == null || owner === req.user.id;");
    expect(contentJs).toContain("return unis.has(mine);");
    expect(contentJs).toContain("if (!teacherManagesChecklist(req.user, req.params.id))");
    // Round 5: the learn/university split moved into SQL (bank rows never parsed).
    expect(contentJs).toContain("json_extract(data_json, '$.track') = 'learn'");
  });
});


describe("zip-53 phase 10: teacher×learn VP + research/tutor/questionnaire tenancy", () => {
  const session = { messages: [{ role: "student", text: "hello" }], tests: [], imaging: [], ddx: [], finalDx: "" };

  it("teacher cannot GET/start/evaluate a learn-track VP case", async () => {
    const atk = await token("admin");
    await request(app).put("/api/admin/vpatient").set(A(atk))
      .send({ config: { enabled: true, premium_only: false, in_daily: true, daily_gems: 15 } });
    const learn = await request(app).post("/api/cases").set(A(atk)).send({
      title_en: "LearnTeacher53", title_fa: "لرن۵۳", chief_en: "dyspnea", chief_fa: "تنگی",
      track: "learn", diagnosis_en: "PE-SECRET-53",
    });
    expect(learn.status).toBe(200);
    const ttk = await token("teacher");
    const peek = await request(app).get(`/api/cases/${learn.body.id}`).set(A(ttk));
    expect(peek.status).toBe(403);
    expect(peek.body.error).toBe("wrong_track");
    const start = await request(app).post("/api/exam/session-start").set(A(ttk))
      .send({ caseId: learn.body.id, lang: "en" });
    expect(start.status).toBe(403);
    expect(start.body.reason).toBe("wrong_track");
    const ev = await request(app).post("/api/exam/evaluate").set(A(ttk))
      .send({ caseId: learn.body.id, lang: "en", session });
    expect(ev.status).toBe(403);
    expect(ev.body.reason).toBe("wrong_track");
  });

  it("teacher dashboard case count ignores a new learn-track case", async () => {
    const ttk = await token("teacher");
    const before = await request(app).get("/api/reports/summary").set(A(ttk));
    expect(before.status).toBe(200);
    const atk = await token("admin");
    const learn = await request(app).post("/api/cases").set(A(atk)).send({
      title_en: "CountLearn53", title_fa: "شمارش۵۳", chief_en: "x", chief_fa: "x", track: "learn",
    });
    expect(learn.status).toBe(200);
    const after = await request(app).get("/api/reports/summary").set(A(ttk));
    expect(after.status).toBe(200);
    expect(after.body.cases).toBe(before.body.cases);
  });

  it("other-university teacher and content_manager cannot read a study consent text", async () => {
    const ttk = await token("teacher");
    const secret = `SECRET-CONSENT-53-${Date.now()}`;
    const study = await request(app).post("/api/research/studies").set(A(ttk)).send({
      title_fa: "مطالعه۵۳", title_en: "Study53", domain: "education", active: true,
      consent_required: true, consent_text_fa: secret, consent_text_en: secret,
    });
    expect(study.status).toBe(200);
    const home = await request(app).get("/api/research/studies").set(A(ttk));
    expect(home.status).toBe(200);
    expect(JSON.stringify(home.body)).toContain(secret);

    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: "Other U 53", name_fa: "دانشگاه دیگر ۵۳" });
    const uname = `t53_${Date.now()}`;
    await request(app).post("/api/users").set(A(atk)).send({
      username: uname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T53", name_fa: "استاد۵۳",
    });
    const t2tk = await token(uname);
    const other = await request(app).get("/api/research/studies").set(A(t2tk));
    expect(other.status).toBe(200);
    expect(JSON.stringify(other.body)).not.toContain(secret);

    const ctk = await token("content");
    const cmStudies = await request(app).get("/api/research/studies").set(A(ctk));
    expect(cmStudies.status).toBe(200);
    expect(JSON.stringify(cmStudies.body)).not.toContain(secret);
    const cmEvents = await request(app).get("/api/research/events").set(A(ctk));
    expect(cmEvents.status).toBe(200);
    expect(cmEvents.body.events).toEqual([]);
    const cmDel = await request(app).delete(`/api/research/studies/${study.body.id}`).set(A(ctk));
    expect(cmDel.status).toBe(403);
    const still = await request(app).get("/api/research/studies").set(A(ttk));
    expect(JSON.stringify(still.body)).toContain(secret);
  });

  it("content_manager does not see an in-use university checklist; CM questionnaire/tutor stay university_only", async () => {
    const ttk = await token("teacher");
    const secretName = `SecretCL53_${Date.now()}`;
    const cl = await request(app).post("/api/checklists").set(A(ttk)).send({
      name_en: secretName, name_fa: "چک۵۳",
      items: [{ id: "h1", fa: "کلید", en: "key", keys: ["hidden-key-53"] }],
    });
    expect(cl.status).toBe(200);
    const created = await request(app).post("/api/cases").set(A(ttk)).send({
      title_en: "CL53", title_fa: "کیس۵۳", chief_en: "x", chief_fa: "x", checklist_id: cl.body.id,
    });
    expect(created.status).toBe(200);
    const ctk = await token("content");
    const lists = await request(app).get("/api/checklists").set(A(ctk));
    expect(lists.status).toBe(200);
    expect(Array.isArray(lists.body)).toBe(true);
    expect((lists.body || []).some((c) => c.id === cl.body.id || c.name_en === secretName)).toBe(false);

    const form = await request(app).post("/api/questionnaires/admin/forms").set(A(ttk)).send({
      title_en: "Q53secret", title_fa: "پرسش۵۳", scope: "general", active: true,
      questions: [{ id: "q1", type: "text", fa: "س", en: "q" }],
    });
    expect(form.status).toBe(200);
    const cmForms = await request(app).get("/api/questionnaires/admin/forms").set(A(ctk));
    expect(cmForms.status).toBe(200);
    expect((cmForms.body.forms || []).some((f) => f.id === form.body.id || f.title_en === "Q53secret")).toBe(false);
    const cmTutor = await request(app).get("/api/tutor/context-settings").set(A(ctk));
    expect(cmTutor.status).toBe(403);
    expect(cmTutor.body.error).toBe("university_only");
  });

  it("teacher cannot PUT tutor settings on another university's class", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Tutor53", title_fa: "راهنما۵۳", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, created.body.id);
    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: "Tutor U 53", name_fa: "دانشگاه راهنما ۵۳" });
    const uname = `t53tut_${Date.now()}`;
    await request(app).post("/api/users").set(A(atk)).send({
      username: uname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T53t", name_fa: "استاد۵۳ت",
    });
    const t2tk = await token(uname);
    const put = await request(app).put("/api/tutor/context-settings").set(A(t2tk))
      .send({ contextType: "class", contextId: cid, enabled: true, prompt: "steal" });
    expect(put.status).toBe(403);
    expect(put.body.error).toBe("wrong_university");
    const ctx = await request(app).get("/api/tutor/context-settings").set(A(t2tk));
    expect(ctx.status).toBe(200);
    expect((ctx.body.classes || []).some((c) => c.id === cid)).toBe(false);
  });
});

describe("zip-53 source: teacher learn gate + research/tutor tenancy", () => {
  const examJs = readFileSync(join(process.cwd(), "src/routes/exam.js"), "utf8");
  const contentJs = readFileSync(join(process.cwd(), "src/routes/content.js"), "utf8");
  const researchJs = readFileSync(join(process.cwd(), "src/routes/research.js"), "utf8");
  const qJs = readFileSync(join(process.cwd(), "src/routes/questionnaires.js"), "utf8");
  const tutorJs = readFileSync(join(process.cwd(), "src/routes/tutor.js"), "utf8");
  const consentJs = readFileSync(join(process.cwd(), "src/lib/consent.js"), "utf8");

  it("teachers cannot run learn-track VP", () => {
    expect(examJs).toContain("if (caseIsLearn(caseId)) return { allowed: false, reason: \"wrong_track\" }");
    expect(contentJs).toContain("if (!row || isLearnContent(row.data_json)) return false");
    expect(contentJs).toContain('if (req.user.role === "content_manager") {');
    expect(contentJs).toContain("rows = rows.filter((row) => !(uniBy.get(row.id) && uniBy.get(row.id).size) && learnBy.has(row.id));");
  });

  it("research/questionnaire/tutor keep membership greps and hide CM from university rows", () => {
    expect(researchJs).toContain("function canManageStudy");
    expect(researchJs).toContain("universityId: uni");
    expect(qJs).toContain("not enrolled");
    // Form-level tenancy (incl. anonymous responses whose user_id is NULL):
    // management is gated per form, and listings LEFT JOIN users so that
    // de-identified responses are never silently hidden by an INNER JOIN.
    expect(qJs).toContain("function canManageForm");
    expect(qJs).toContain("LEFT JOIN users u ON u.id=qr.user_id");
    expect(tutorJs).toContain("function tutorContextDenied");
    expect(tutorJs).toContain("function refuseCm");
    expect(consentJs).toContain('const STAFF_ROLES = new Set(["admin", "teacher"])');
  });
});

describe("zip-54 phase 11: consent/status, analysis, catalogs, unused checklists, student×learn VP", () => {
  const session = { messages: [{ role: "student", text: "hello" }], tests: [], imaging: [], ddx: [], finalDx: "" };

  it("student cannot start or evaluate a learn-track VP even if class_cases is injected", async () => {
    const atk = await token("admin");
    await request(app).put("/api/admin/vpatient").set(A(atk))
      .send({ config: { enabled: true, premium_only: false, in_daily: true, daily_gems: 15 } });
    const learn = await request(app).post("/api/cases").set(A(atk)).send({
      title_en: "LearnStudent54", title_fa: "لرن۵۴", chief_en: "dyspnea", chief_fa: "تنگی",
      track: "learn", diagnosis_en: "PE-SECRET-54",
    });
    expect(learn.status).toBe(200);
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const home = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Home54", title_fa: "خانه۵۴", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, home.body.id);
    db.prepare("INSERT OR IGNORE INTO class_cases (class_id,case_id,weight) VALUES (?,?,1)").run(cid, learn.body.id);
    const stk = await token("40012345");
    const start = await request(app).post("/api/exam/session-start").set(A(stk))
      .send({ caseId: learn.body.id, classId: cid, lang: "en" });
    expect(start.status).toBe(403);
    expect(start.body.reason).toBe("wrong_track");
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: learn.body.id, classId: cid, lang: "en", session });
    expect(ev.status).toBe(403);
    expect(ev.body.reason).toBe("wrong_track");
    const ver = await request(app).get(`/api/cases/${learn.body.id}/versions`).set(A(ttk));
    expect(ver.status).toBe(403);
    expect(ver.body.error).toBe("wrong_track");
    expect(JSON.stringify(ver.body)).not.toContain("PE-SECRET-54");
  });

  it("other-university teacher cannot read consent text via studyId or write research events", async () => {
    const ttk = await token("teacher");
    const secret = `SECRET-CONSENT-54-${Date.now()}`;
    const study = await request(app).post("/api/research/studies").set(A(ttk)).send({
      title_fa: "مطالعه۵۴", title_en: "Study54", domain: "education", active: true,
      consent_required: true, consent_text_fa: secret, consent_text_en: secret,
    });
    expect(study.status).toBe(200);
    const home = await request(app).get(`/api/research/consent/status?studyId=${study.body.id}`).set(A(ttk));
    expect(home.status).toBe(200);
    expect(JSON.stringify(home.body)).toContain(secret);

    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: "Other U 54", name_fa: "دانشگاه دیگر ۵۴" });
    const uname = `t54_${Date.now()}`;
    await request(app).post("/api/users").set(A(atk)).send({
      username: uname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T54", name_fa: "استاد۵۴",
    });
    const t2tk = await token(uname);
    const other = await request(app).get(`/api/research/consent/status?studyId=${study.body.id}`).set(A(t2tk));
    expect(other.status).toBe(403);
    expect(other.body.error).toBe("wrong_university");
    expect(JSON.stringify(other.body)).not.toContain(secret);
    const ev = await request(app).post("/api/research/event").set(A(t2tk))
      .send({ study_id: study.body.id, event_type: "session_started", data: { note: "inject" } });
    expect(ev.status).toBe(403);
    expect(ev.body.error).toBe("wrong_university");
    const ltk = await token("learner");
    const learner = await request(app).get(`/api/research/consent/status?studyId=${study.body.id}`).set(A(ltk));
    expect(learner.status).toBe(403);
    expect(learner.body.error).toBe("university_only");
    expect(JSON.stringify(learner.body)).not.toContain(secret);
  });

  it("other-university teacher and content_manager cannot read questionnaire analysis; unused checklists stay off CM", async () => {
    const ttk = await token("teacher");
    const qSecret = `QSTEM-54-${Date.now()}`;
    const form = await request(app).post("/api/questionnaires/admin/forms").set(A(ttk)).send({
      title_en: "Analysis54", title_fa: "تحلیل۵۴", scope: "general", active: true,
      questions: [{ id: "q1", type: "text", fa: qSecret, en: qSecret }],
    });
    expect(form.status).toBe(200);
    const homeA = await request(app).get(`/api/questionnaires/admin/forms/${form.body.id}/analysis`).set(A(ttk));
    expect(homeA.status).toBe(200);
    expect(JSON.stringify(homeA.body)).toContain(qSecret);

    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: "Q U 54", name_fa: "دانشگاه پرسش ۵۴" });
    const uname = `t54q_${Date.now()}`;
    await request(app).post("/api/users").set(A(atk)).send({
      username: uname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T54q", name_fa: "استاد۵۴ق",
    });
    const t2tk = await token(uname);
    const otherA = await request(app).get(`/api/questionnaires/admin/forms/${form.body.id}/analysis`).set(A(t2tk));
    expect(otherA.status).toBe(403);
    expect(JSON.stringify(otherA.body)).not.toContain(qSecret);
    const otherCsv = await request(app).get(`/api/questionnaires/admin/forms/${form.body.id}/responses.csv`).set(A(t2tk));
    expect(otherCsv.status).toBe(403);
    expect(String(otherCsv.text || "")).not.toContain(qSecret);

    const ctk = await token("content");
    const cmA = await request(app).get(`/api/questionnaires/admin/forms/${form.body.id}/analysis`).set(A(ctk));
    expect(cmA.status).toBe(403);
    expect(JSON.stringify(cmA.body)).not.toContain(qSecret);

    const unusedName = `UnusedCL54_${Date.now()}`;
    const unused = await request(app).post("/api/checklists").set(A(ttk)).send({
      name_en: unusedName, name_fa: "بلااستفاده۵۴",
      items: [{ id: "h1", fa: "کلید بلااستفاده", en: "unused key", keys: ["unused-key-54"] }],
    });
    expect(unused.status).toBe(200);
    const cmLists = await request(app).get("/api/checklists").set(A(ctk));
    expect(cmLists.status).toBe(200);
    expect(Array.isArray(cmLists.body)).toBe(true);
    expect((cmLists.body || []).some((c) => c.id === unused.body.id || c.name_en === unusedName)).toBe(false);
    const teacherLists = await request(app).get("/api/checklists").set(A(ttk));
    expect((teacherLists.body || []).some((c) => c.id === unused.body.id)).toBe(true);
  });

  it("teacher GET /catalogs is owner-scoped so another teacher cannot read the items", async () => {
    const ttk = await token("teacher");
    const secret = `CatSecret54_${Date.now()}`;
    const cat = await request(app).post("/api/catalogs").set(A(ttk))
      .send({ name_en: secret, name_fa: "کاتالوگ۵۴", items: ["hidden-lab-54"] });
    expect(cat.status).toBe(200);
    const home = await request(app).get("/api/catalogs").set(A(ttk));
    expect(home.status).toBe(200);
    expect((home.body || []).some((c) => c.id === cat.body.id && (c.items || []).includes("hidden-lab-54"))).toBe(true);

    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: "Cat U 54", name_fa: "دانشگاه کاتالوگ ۵۴" });
    const uname = `t54c_${Date.now()}`;
    await request(app).post("/api/users").set(A(atk)).send({
      username: uname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T54c", name_fa: "استاد۵۴ک",
    });
    const t2tk = await token(uname);
    const other = await request(app).get("/api/catalogs").set(A(t2tk));
    expect(other.status).toBe(200);
    expect(JSON.stringify(other.body)).not.toContain(secret);
    expect(JSON.stringify(other.body)).not.toContain("hidden-lab-54");
    expect((other.body || []).some((c) => c.id === cat.body.id)).toBe(false);
  });
});

describe("zip-54 source: consent studyId tenancy + analysis/catalog/checklist gates", () => {
  const examJs = readFileSync(join(process.cwd(), "src/routes/exam.js"), "utf8");
  const contentJs = readFileSync(join(process.cwd(), "src/routes/content.js"), "utf8");
  const researchJs = readFileSync(join(process.cwd(), "src/routes/research.js"), "utf8");
  const qJs = readFileSync(join(process.cwd(), "src/routes/questionnaires.js"), "utf8");
  const classesJs = readFileSync(join(process.cwd(), "src/routes/classes.js"), "utf8");

  it("student hasAccess and classAttemptInfo refuse learn-track VP", () => {
    expect(examJs).toContain("if (caseIsLearn(caseId)) return { allowed: false, reason: \"wrong_track\" }");
    expect(classesJs).toContain("if (isLearnContent(caseRow?.data_json)) return { allowed: false }");
    expect(contentJs).toContain("if (isLearnContent(caseRow.data_json) && req.user.role !== \"admin\")");
  });

  it("consent/status studyId, catalogs, unused CM checklists, and analysis stay tenant-scoped", () => {
    expect(researchJs).toContain("function canManageStudy");
    expect(researchJs).toContain("universityId: uni");
    expect(researchJs).toContain("if (req.user.role === \"teacher\" && !canManageStudy(req.user, st))");
    expect(contentJs).toContain("if (req.user.role === \"teacher\") rows = rows.filter((c) => c.owner_id === req.user.id)");
    expect(contentJs).toContain("function checklistUsedByLearn");
    expect(contentJs).toContain('if (req.user.role === "content_manager") {');
    expect(contentJs).toContain("rows = rows.filter((row) => !(uniBy.get(row.id) && uniBy.get(row.id).size) && learnBy.has(row.id));");
    expect(qJs).toContain("not enrolled");
    // Form-level tenancy (incl. anonymous responses whose user_id is NULL):
    // management is gated per form, and listings LEFT JOIN users so that
    // de-identified responses are never silently hidden by an INNER JOIN.
    expect(qJs).toContain("function canManageForm");
    expect(qJs).toContain("LEFT JOIN users u ON u.id=qr.user_id");
    expect(qJs).toContain("if (!canManageForm(req.user, form))");
  });
});

describe("zip-55 phase 12: classId consent, grant, unused checklist owner, form/study attach", () => {
  it("other-university teacher cannot read consent text via classId or grant/record consent", async () => {
    const ttk = await token("teacher");
    const secret = `SECRET-CONSENT-55-${Date.now()}`;
    const study = await request(app).post("/api/research/studies").set(A(ttk)).send({
      title_fa: "مطالعه۵۵", title_en: "Study55", domain: "education", active: true,
      consent_required: true, consent_text_fa: secret, consent_text_en: secret,
    });
    expect(study.status).toBe(200);
    const stuId = await studentId(ttk, "40012345");
    const home = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Home55", title_fa: "خانه۵۵", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, home.body.id);
    const putCls = await request(app).put(`/api/classes/${cid}`).set(A(ttk)).send({
      name_fa: "کلاس پژوهش۵۵", name_en: "Research class 55", maxAttempts: 5, studyId: study.body.id,
    });
    expect(putCls.status).toBe(200);
    const homeSt = await request(app).get(`/api/research/consent/status?classId=${cid}`).set(A(ttk));
    expect(homeSt.status).toBe(200);
    expect(JSON.stringify(homeSt.body)).toContain(secret);

    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: "Other U 55", name_fa: "دانشگاه دیگر ۵۵" });
    const uname = `t55_${Date.now()}`;
    await request(app).post("/api/users").set(A(atk)).send({
      username: uname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T55", name_fa: "استاد۵۵",
    });
    const t2tk = await token(uname);
    const other = await request(app).get(`/api/research/consent/status?classId=${cid}`).set(A(t2tk));
    expect(other.status).toBe(403);
    expect(other.body.error).toBe("wrong_university");
    expect(JSON.stringify(other.body)).not.toContain(secret);
    const grant = await request(app).post("/api/research/consent").set(A(t2tk))
      .send({ study_id: study.body.id });
    expect(grant.status).toBe(403);
    expect(grant.body.error).toBe("wrong_university");
    expect(JSON.stringify(grant.body)).not.toContain(secret);
    const rec = await request(app).post(`/api/research/studies/${study.body.id}/consents/record`).set(A(t2tk))
      .send({ pseudonym: "ghost-55", mode: "paper", note: "stolen form" });
    expect(rec.status).toBe(403);
    expect(rec.body.error).toBe("wrong_university");
    const ltk = await token("learner");
    const learnerGrant = await request(app).post("/api/research/consent").set(A(ltk))
      .send({ study_id: study.body.id });
    expect(learnerGrant.status).toBe(403);
    expect(learnerGrant.body.error).toBe("university_only");
    const stk = await token("40012345");
    const student = await request(app).get(`/api/research/consent/status?classId=${cid}`).set(A(stk));
    expect(student.status).toBe(200);
    expect(JSON.stringify(student.body)).toContain(secret);
  });

  it("unused checklist is owner-only so another teacher cannot read or PUT it", async () => {
    const ttk = await token("teacher");
    const unusedName = `UnusedCL55_${Date.now()}`;
    const unused = await request(app).post("/api/checklists").set(A(ttk)).send({
      name_en: unusedName, name_fa: "بلااستفاده۵۵",
      items: [{ id: "h1", fa: "کلید بلااستفاده", en: "unused key", keys: ["unused-key-55"] }],
    });
    expect(unused.status).toBe(200);
    const home = await request(app).get("/api/checklists").set(A(ttk));
    expect((home.body || []).some((c) => c.id === unused.body.id)).toBe(true);

    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: "CL U 55", name_fa: "دانشگاه چک ۵۵" });
    const uname = `t55cl_${Date.now()}`;
    await request(app).post("/api/users").set(A(atk)).send({
      username: uname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T55cl", name_fa: "استاد۵۵چ",
    });
    const t2tk = await token(uname);
    const other = await request(app).get("/api/checklists").set(A(t2tk));
    expect(other.status).toBe(200);
    expect((other.body || []).some((c) => c.id === unused.body.id || c.name_en === unusedName)).toBe(false);
    const put = await request(app).put(`/api/checklists/${unused.body.id}`).set(A(t2tk)).send({
      name_en: "Stolen55", name_fa: "دزدیده۵۵", items: [],
    });
    expect(put.status).toBe(403);
    expect(put.body.error).toBe("wrong_university");
    const homePut = await request(app).put(`/api/checklists/${unused.body.id}`).set(A(ttk)).send({
      name_en: unusedName, name_fa: "بلااستفاده۵۵",
      items: [{ id: "h1", fa: "کلید بلااستفاده", en: "unused key", keys: ["unused-key-55"] }],
    });
    expect(homePut.status).toBe(200);
  });

  it("teacher cannot attach a questionnaire or study to another university's class/exam", async () => {
    const ttk = await token("teacher");
    const study = await request(app).post("/api/research/studies").set(A(ttk)).send({
      title_fa: "وصل۵۵", title_en: "Attach55", domain: "education", active: true,
      consent_required: true, consent_text_fa: "متن", consent_text_en: "text",
    });
    expect(study.status).toBe(200);
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Attach case 55", title_fa: "کیس۵۵", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, created.body.id);
    const qSecret = `QSTEM-55-${Date.now()}`;
    const homeForm = await request(app).post("/api/questionnaires/admin/forms").set(A(ttk)).send({
      title_en: "HomeQ55", title_fa: "پرسش۵۵", scope: "class", class_id: cid, active: true,
      questions: [{ id: "q1", type: "text", fa: qSecret, en: qSecret }],
    });
    expect(homeForm.status).toBe(200);

    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: "Attach U 55", name_fa: "دانشگاه وصل ۵۵" });
    const uname = `t55a_${Date.now()}`;
    await request(app).post("/api/users").set(A(atk)).send({
      username: uname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T55a", name_fa: "استاد۵۵و",
    });
    const t2tk = await token(uname);
    const stealForm = await request(app).post("/api/questionnaires/admin/forms").set(A(t2tk)).send({
      title_en: "StealQ55", title_fa: "دزدیده۵۵", scope: "class", class_id: cid, active: true,
      questions: [{ id: "q1", type: "text", fa: "x", en: "x" }],
    });
    expect(stealForm.status).toBe(403);
    expect(stealForm.body.error).toBe("wrong_university");
    const t2cls = await request(app).post("/api/classes").set(A(t2tk))
      .send({ name_en: "Other class 55", name_fa: "کلاس دیگر۵۵", maxAttempts: 3 });
    expect(t2cls.status).toBe(200);
    const attach = await request(app).put(`/api/classes/${t2cls.body.id}`).set(A(t2tk)).send({
      name_en: "Other class 55", name_fa: "کلاس دیگر۵۵", maxAttempts: 3, studyId: study.body.id,
    });
    expect(attach.status).toBe(403);
    expect(attach.body.error).toBe("wrong_university");
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(t2tk)).send({
      title_en: "Steal exam 55", title_fa: "آزمون۵۵", case_ids: [],
      starts_at: now, ends_at: end, duration_min: 20, max_attempts: 1, studyId: study.body.id,
    });
    expect(exam.status).toBe(403);
    expect(exam.body.error).toBe("wrong_university");
  });
});

describe("zip-55 source: classId consent + unused owner + study attach", () => {
  const contentJs = readFileSync(join(process.cwd(), "src/routes/content.js"), "utf8");
  const researchJs = readFileSync(join(process.cwd(), "src/routes/research.js"), "utf8");
  const qJs = readFileSync(join(process.cwd(), "src/routes/questionnaires.js"), "utf8");
  const classesJs = readFileSync(join(process.cwd(), "src/routes/classes.js"), "utf8");
  const examsJs = readFileSync(join(process.cwd(), "src/routes/exams.js"), "utf8");

  it("consent/status classId and grant are tenant-scoped", () => {
    expect(researchJs).toContain("function canManageStudy");
    expect(researchJs).toContain("universityId: uni");
    expect(researchJs).toContain("cl.university_id !== currentUniversityId(req.user)");
    expect(researchJs).toContain("if (req.user.role === \"teacher\" && !canManageStudy(req.user, st))");
    expect(qJs).toContain("not enrolled");
    // Form-level tenancy (incl. anonymous responses whose user_id is NULL):
    // management is gated per form, and listings LEFT JOIN users so that
    // de-identified responses are never silently hidden by an INNER JOIN.
    expect(qJs).toContain("function canManageForm");
    expect(qJs).toContain("LEFT JOIN users u ON u.id=qr.user_id");
    expect(qJs).toContain("if (!canManageForm(req.user, form))");
  });

  it("unused checklists are owner-scoped and study attach is tenant-scoped", () => {
    expect(contentJs).toContain("if (!unis.size) return checklistOwnerId(id) === user.id");
    expect(contentJs).toContain("function checklistUsedByLearn");
    expect(contentJs).toContain('if (req.user.role === "content_manager") {');
    expect(contentJs).toContain("rows = rows.filter((row) => !(uniBy.get(row.id) && uniBy.get(row.id).size) && learnBy.has(row.id));");
    expect(classesJs).toContain("function teacherMayAttachStudy");
    expect(examsJs).toContain("function teacherMayAttachStudy");
  });
});


describe("zip-56 phase 13: general questionnaire tenancy, admin studies, student tutor_prompt", () => {
  it("student cannot read or submit another university's general questionnaire stems", async () => {
    const ttk = await token("teacher");
    const qSecret = `QSTEM-56-${Date.now()}`;
    const form = await request(app).post("/api/questionnaires/admin/forms").set(A(ttk)).send({
      title_en: "General56", title_fa: "عمومی۵۶", scope: "general", active: true,
      questions: [{ id: "q1", type: "text", fa: qSecret, en: qSecret }],
    });
    expect(form.status).toBe(200);
    const homeStu = await request(app).get("/api/questionnaires/prompts").set(A(await token("40012345")));
    expect(homeStu.status).toBe(200);
    expect(JSON.stringify(homeStu.body)).toContain(qSecret);

    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: "Other U 56", name_fa: "دانشگاه دیگر ۵۶" });
    const tname = `t56_${Date.now()}`;
    await request(app).post("/api/users").set(A(atk)).send({
      username: tname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T56", name_fa: "استاد۵۶",
    });
    const sno = `s56_${Date.now()}`;
    await request(app).post("/api/users").set(A(atk)).send({
      studentNo: sno, password: "demo", role: "student", university_id: uni.body.id,
      name_en: "S56", name_fa: "دانشجو۵۶",
    });
    const otk = await token(sno);
    const other = await request(app).get("/api/questionnaires/prompts").set(A(otk));
    expect(other.status).toBe(200);
    expect(JSON.stringify(other.body)).not.toContain(qSecret);
    expect((other.body.forms || []).some((f) => f.id === form.body.id)).toBe(false);
    const submit = await request(app).post(`/api/questionnaires/${form.body.id}/responses`).set(A(otk))
      .send({ answers: { q1: "leak" }, contextType: "general" });
    expect(submit.status).toBe(403);
    expect(submit.body.error).toBe("wrong_university");
    const ttk2 = await token(tname);
    const staff = await request(app).get("/api/questionnaires/prompts").set(A(ttk2));
    expect(staff.status).toBe(403);
    expect(JSON.stringify(staff.body)).not.toContain(qSecret);
  });

  it("teacher cannot manage an admin-created study; CM cannot read protocol templates", async () => {
    const atk = await token("admin");
    const secret = `SECRET-ADMIN-56-${Date.now()}`;
    const study = await request(app).post("/api/research/studies").set(A(atk)).send({
      title_fa: "ادمین۵۶", title_en: "Admin56", domain: "education", active: true,
      consent_required: true, consent_text_fa: secret, consent_text_en: secret,
    });
    expect(study.status).toBe(200);
    const ttk = await token("teacher");
    const list = await request(app).get("/api/research/studies").set(A(ttk));
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(secret);
    const st = await request(app).get(`/api/research/consent/status?studyId=${study.body.id}`).set(A(ttk));
    expect(st.status).toBe(403);
    expect(st.body.error).toBe("wrong_university");
    expect(JSON.stringify(st.body)).not.toContain(secret);
    const attach = await request(app).post("/api/classes").set(A(ttk)).send({
      name_en: "Admin study class 56", name_fa: "کلاس ادمین۵۶", maxAttempts: 3, studyId: study.body.id,
    });
    expect(attach.status).toBe(403);
    expect(attach.body.error).toBe("wrong_university");
    const ctk = await token("content");
    const tpl = await request(app).get("/api/questionnaires/admin/templates").set(A(ctk));
    expect(tpl.status).toBe(403);
    expect(tpl.body.error).toBe("university_only");
  });

  it("student class payloads do not include tutor_prompt", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "TutorPrompt56", title_fa: "راهنما۵۶", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, created.body.id);
    const prompt = `TUTOR-SECRET-56-${Date.now()}`;
    const put = await request(app).put("/api/tutor/context-settings").set(A(ttk))
      .send({ contextType: "class", contextId: cid, enabled: true, prompt });
    expect(put.status).toBe(200);
    const stk = await token("40012345");
    const detail = await request(app).get(`/api/classes/${cid}`).set(A(stk));
    expect(detail.status).toBe(200);
    expect(JSON.stringify(detail.body)).not.toContain(prompt);
    expect(detail.body.class.tutor_prompt).toBeUndefined();
    const list = await request(app).get("/api/classes").set(A(stk));
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(prompt);
  });
});

describe("zip-56 source: general questionnaire tenancy + admin study + tutor_prompt strip", () => {
  const qJs = readFileSync(join(process.cwd(), "src/routes/questionnaires.js"), "utf8");
  const researchJs = readFileSync(join(process.cwd(), "src/routes/research.js"), "utf8");
  const classesJs = readFileSync(join(process.cwd(), "src/routes/classes.js"), "utf8");

  it("student prompts/responses stay tenant-scoped", () => {
    expect(qJs).toContain("not enrolled");
    // Form-level tenancy (incl. anonymous responses whose user_id is NULL):
    // management is gated per form, and listings LEFT JOIN users so that
    // de-identified responses are never silently hidden by an INNER JOIN.
    expect(qJs).toContain("function canManageForm");
    expect(qJs).toContain("LEFT JOIN users u ON u.id=qr.user_id");
    expect(qJs).toContain("if (!canManageForm(req.user, form))");
    expect(qJs).toContain("rows = rows.filter((f) => formInUniversity(f, uni))");
  });

  it("admin-created studies stay off teachers and student class strips tutor_prompt", () => {
    expect(researchJs).toContain("function canManageStudy");
    expect(researchJs).toContain("universityId: uni");
    expect(researchJs).toContain("if (creator.role === \"admin\") return false");
    expect(classesJs).toContain("delete out.tutor_prompt");
  });
});

describe("zip-57 phase 14: admin questionnaires, consent roster, student join code", () => {
  it("admin-created general questionnaire is off every university student and teacher", async () => {
    const atk = await token("admin");
    const qSecret = `QSTEM-57-${Date.now()}`;
    const form = await request(app).post("/api/questionnaires/admin/forms").set(A(atk)).send({
      title_en: "AdminQ57", title_fa: "ادمین۵۷", scope: "general", active: true,
      questions: [{ id: "q1", type: "text", fa: qSecret, en: qSecret }],
    });
    expect(form.status).toBe(200);

    const ttk = await token("teacher");
    const staffList = await request(app).get("/api/questionnaires/admin/forms").set(A(ttk));
    expect(staffList.status).toBe(200);
    expect((staffList.body.forms || []).some((f) => f.id === form.body.id)).toBe(false);
    const analysis = await request(app).get(`/api/questionnaires/admin/forms/${form.body.id}/analysis`).set(A(ttk));
    expect(analysis.status).toBe(403);
    expect(analysis.body.error).toBe("wrong_university");
    expect(JSON.stringify(analysis.body)).not.toContain(qSecret);

    const homeStu = await request(app).get("/api/questionnaires/prompts").set(A(await token("40012345")));
    expect(homeStu.status).toBe(200);
    expect(JSON.stringify(homeStu.body)).not.toContain(qSecret);
    const submit = await request(app).post(`/api/questionnaires/${form.body.id}/responses`).set(A(await token("40012345")))
      .send({ answers: { q1: "leak" }, contextType: "general" });
    expect(submit.status).toBe(403);
    expect(submit.body.error).toBe("wrong_university");

    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: "Other U 57", name_fa: "دانشگاه دیگر ۵۷" });
    const sno = `s57_${Date.now()}`;
    await request(app).post("/api/users").set(A(atk)).send({
      studentNo: sno, password: "demo", role: "student", university_id: uni.body.id,
      name_en: "S57", name_fa: "دانشجو۵۷",
    });
    const other = await request(app).get("/api/questionnaires/prompts").set(A(await token(sno)));
    expect(other.status).toBe(200);
    expect(JSON.stringify(other.body)).not.toContain(qSecret);
  });

  it("other-university teacher cannot read a consent roster; home teacher still can", async () => {
    const ttk = await token("teacher");
    const secret = `SECRET-ROSTER-57-${Date.now()}`;
    const study = await request(app).post("/api/research/studies").set(A(ttk)).send({
      title_fa: "فهرست۵۷", title_en: "Roster57", domain: "education", active: true,
      consent_required: true, consent_text_fa: secret, consent_text_en: secret,
    });
    expect(study.status).toBe(200);
    const home = await request(app).get(`/api/research/studies/${study.body.id}/consents`).set(A(ttk));
    expect(home.status).toBe(200);
    expect(home.body.study?.id).toBe(study.body.id);

    const atk = await token("admin");
    const uni = await request(app).post("/api/universities").set(A(atk))
      .send({ name_en: "Roster U 57", name_fa: "دانشگاه فهرست ۵۷" });
    const uname = `t57_${Date.now()}`;
    await request(app).post("/api/users").set(A(atk)).send({
      username: uname, password: "demo", role: "teacher", university_id: uni.body.id,
      name_en: "T57", name_fa: "استاد۵۷",
    });
    const t2tk = await token(uname);
    const other = await request(app).get(`/api/research/studies/${study.body.id}/consents`).set(A(t2tk));
    expect(other.status).toBe(403);
    expect(other.body.error).toBe("wrong_university");
    expect(JSON.stringify(other.body)).not.toContain(secret);
    const csv = await request(app).get(`/api/research/studies/${study.body.id}/consents.csv`).set(A(t2tk));
    expect(csv.status).toBe(403);
    const ctk = await token("content");
    const cm = await request(app).get(`/api/research/studies/${study.body.id}/consents`).set(A(ctk));
    expect(cm.status).toBe(403);
    expect(cm.body.error).toBe("university_only");
  });

  it("student class list/detail hide the join code; teacher still sees it", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const created = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "Code57", title_fa: "کد۵۷", chief_en: "x", chief_fa: "x" });
    const cid = await makeClass(ttk, stuId, created.body.id);
    const teacherView = await request(app).get(`/api/classes/${cid}`).set(A(ttk));
    expect(teacherView.status).toBe(200);
    expect(teacherView.body.class.code).toBeTruthy();
    const teacherList = await request(app).get("/api/classes").set(A(ttk));
    const trow = (teacherList.body || []).find((c) => c.id === cid);
    expect(trow?.code).toBe(teacherView.body.class.code);

    const stk = await token("40012345");
    const studentView = await request(app).get(`/api/classes/${cid}`).set(A(stk));
    expect(studentView.status).toBe(200);
    expect(studentView.body.class.code).toBeUndefined();
    const studentList = await request(app).get("/api/classes").set(A(stk));
    const srow = (studentList.body || []).find((c) => c.id === cid);
    expect(srow).toBeTruthy();
    expect(srow.code).toBeUndefined();
  });
});

describe("zip-57 source: admin form tenancy + consent roster gate + join-code strip", () => {
  const qJs = readFileSync(join(process.cwd(), "src/routes/questionnaires.js"), "utf8");
  const researchJs = readFileSync(join(process.cwd(), "src/routes/research.js"), "utf8");
  const classesJs = readFileSync(join(process.cwd(), "src/routes/classes.js"), "utf8");
  const classesPage = readFileSync(join(process.cwd(), "../client/src/pages/Classes.jsx"), "utf8");

  it("admin-created questionnaires stay off other universities", () => {
    expect(qJs).toContain("if (creator.role === \"admin\") return false");
    expect(qJs).toContain("if (!canManageForm(req.user, form))");
    expect(qJs).toContain("rows = rows.filter((x) => canManageForm(req.user, db.prepare");
  });

  it("consent roster requires canManageStudy and student class strips join code", () => {
    expect(researchJs).toContain("function refuseStudyRoster");
    expect(researchJs).toContain("if (!canManageStudy(req.user, st))");
    expect(classesJs).toContain("delete out.code");
    expect(classesJs).toContain("delete row.code");
    expect(classesPage).not.toMatch(/c\.code/);
  });
});
