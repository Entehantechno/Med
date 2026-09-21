/* ================================================================
   research-instruments.test.js — Phase 4: the protocol's instruments,
   their analysis, and the teacher progress dashboard.

   Covers: the three seeded templates (Tables 1/2/3), scoring of each
   instrument type, de-identified export, the class-wide progress
   dashboard, and remedial assignment for scores below 6/10.
   ================================================================ */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import {
  OSCE_CHECKLIST, EXPERT_LIKERT, STUDENT_SATISFACTION,
  scoreOsceChecklist, scoreLikert, aggregateNps,
} from "../src/data/research-instruments.js";

let app;
async function token(u, p = "demo") {
  return (await request(app).post("/api/auth/login").send({ username: u, password: p })).body.token;
}
const A = (tk) => ({ Authorization: `Bearer ${tk}` });
const uid = async (tk, username) =>
  ((await request(app).get("/api/users").set(A(tk))).body).find((u) => u.username === username).id;

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

describe("the three protocol instruments are seeded as editable templates", () => {
  it("all three exist, are inactive by default, and carry their items", async () => {
    const ttk = await token("teacher");
    const { forms } = (await request(app).get("/api/questionnaires/admin/forms").set(A(ttk))).body;
    const byKey = Object.fromEntries(forms.filter((f) => f.template_key).map((f) => [f.template_key, f]));

    expect(Object.keys(byKey).sort()).toEqual(["expert-likert", "osce-history-checklist", "student-satisfaction-nps"]);
    // Inactive until the researcher turns them on.
    for (const f of Object.values(byKey)) expect(f.active).toBe(false);

    expect(byKey["osce-history-checklist"].questions.length).toBe(12);   // Table 1
    expect(byKey["expert-likert"].questions.length).toBe(5);             // Table 2
    expect(byKey["student-satisfaction-nps"].questions.length).toBe(10); // Table 3

    // Table 2 is Likert 1-5; Table 3 is 0-10 with the NPS item flagged.
    expect(byKey["expert-likert"].questions.every((q) => q.min === 1 && q.max === 5)).toBe(true);
    expect(byKey["student-satisfaction-nps"].questions.every((q) => q.min === 0 && q.max === 10)).toBe(true);
    const nps = byKey["student-satisfaction-nps"].questions.filter((q) => q.nps);
    expect(nps.length).toBe(1);
    expect(nps[0].id).toBe("sat6");                 // the recommendation question
    // Table 1 is 12 binary items worth 1 point each.
    expect(byKey["osce-history-checklist"].questions.every((q) => q.type === "check" && q.value === 1)).toBe(true);
    // Satisfaction is anonymous; the expert and checklist forms are attributed.
    expect(byKey["student-satisfaction-nps"].anonymous).toBe(true);
    expect(byKey["expert-likert"].anonymous).toBe(false);
  });

  it("reseeding does not duplicate them", async () => {
    execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
    await initDb();
    const ttk = await token("teacher");
    const { forms } = (await request(app).get("/api/questionnaires/admin/forms").set(A(ttk))).body;
    const keyed = forms.filter((f) => f.template_key);
    expect(keyed.length).toBe(3);
    expect(new Set(keyed.map((f) => f.template_key)).size).toBe(3);
  });

  it("the admin can edit a template like any other form", async () => {
    const ttk = await token("teacher");
    const { forms } = (await request(app).get("/api/questionnaires/admin/forms").set(A(ttk))).body;
    const f = forms.find((x) => x.template_key === "expert-likert");
    const res = await request(app).put(`/api/questionnaires/admin/forms/${f.id}`).set(A(ttk))
      .send({ ...f, active: true, title_fa: "ویرایش پژوهشگر" });
    expect(res.status).toBe(200);
    const after = (await request(app).get("/api/questionnaires/admin/forms").set(A(ttk))).body.forms
      .find((x) => x.id === f.id);
    expect(after.active).toBe(true);
    expect(after.title_fa).toBe("ویرایش پژوهشگر");
    expect(after.questions.length).toBe(5);          // the items survive
  });

  it("the shipped templates are readable for comparison / reset", async () => {
    const ttk = await token("teacher");
    const { templates } = (await request(app).get("/api/questionnaires/admin/templates").set(A(ttk))).body;
    expect(templates.map((t) => t.key).sort()).toEqual(["expert-likert", "osce-history-checklist", "student-satisfaction-nps"]);
    expect(templates.find((t) => t.key === "osce-history-checklist").max).toBe(10);
  });

  it("a student cannot read the templates", async () => {
    const stk = await token("40012345");
    expect((await request(app).get("/api/questionnaires/admin/templates").set(A(stk))).status).toBe(403);
  });
});

describe("instrument scoring matches the protocol", () => {
  it("Table 1: 12 binary items are reported out of 10", () => {
    const items = OSCE_CHECKLIST.items;
    const all = Object.fromEntries(items.map((i) => [i.id, true]));
    expect(scoreOsceChecklist(all)).toMatchObject({ raw: 12, maxRaw: 12, outOf10: 10, pct: 100 });

    const none = Object.fromEntries(items.map((i) => [i.id, false]));
    expect(scoreOsceChecklist(none).outOf10).toBe(0);

    // 9 of 12 → 7.5/10, not a silent cap at 10.
    const nine = Object.fromEntries(items.map((i, k) => [i.id, k < 9]));
    expect(scoreOsceChecklist(nine).outOf10).toBe(7.5);
    // Unanswered items are counted as unanswered, not as failures.
    expect(scoreOsceChecklist({ [items[0].id]: true }).answered).toBe(1);
  });

  it("Table 2: Likert 1-5 mean, clamped to the scale", () => {
    const ans = { exp1: 5, exp2: 4, exp3: 4, exp4: 5, exp5: 4 };
    const r = scoreLikert(ans, EXPERT_LIKERT);
    expect(r.mean).toBe(4.4);
    expect(r.answered).toBe(5);
    // An out-of-range value cannot drag the mean outside the scale.
    expect(scoreLikert({ exp1: 99 }, EXPERT_LIKERT).mean).toBe(5);
    expect(scoreLikert({ exp1: -3 }, EXPERT_LIKERT).mean).toBe(1);
    expect(scoreLikert({}, EXPERT_LIKERT).mean).toBeNull();
  });

  it("Table 3: 0-10 satisfaction with the NPS bucketing", () => {
    const all8 = Object.fromEntries(STUDENT_SATISFACTION.items.map((i) => [i.id, 8]));
    const r = scoreLikert(all8, STUDENT_SATISFACTION);
    expect(r.mean).toBe(8);
    expect(r.nps.score).toBe(8);
    expect(r.nps.passives).toBe(1);        // 7-8 = passive
    expect(r.nps.value).toBe(0);

    expect(scoreLikert({ ...all8, sat6: 10 }, STUDENT_SATISFACTION).nps.promoters).toBe(1);
    expect(scoreLikert({ ...all8, sat6: 0 }, STUDENT_SATISFACTION).nps.detractors).toBe(1);
  });

  it("NPS across respondents is the reported figure", () => {
    const rows = [9, 10, 10, 6, 5, 8].map((v) => scoreLikert(
      Object.fromEntries(STUDENT_SATISFACTION.items.map((i) => [i.id, i.nps ? v : 8])), STUDENT_SATISFACTION));
    const agg = aggregateNps(rows);
    expect(agg.n).toBe(6);
    expect(agg.promoters).toBe(3);
    expect(agg.detractors).toBe(2);
    expect(agg.passives).toBe(1);
    // (3 - 2) / 6 = +17
    expect(agg.nps).toBe(17);
    expect(aggregateNps([]).nps).toBeNull();
  });
});

describe("instrument analysis and de-identified export", () => {
  async function submit(formId, tk, answers, ctx = {}) {
    return request(app).post(`/api/questionnaires/${formId}/responses`).set(A(tk))
      .send({ answers, ...ctx });
  }

  it("scores submissions and reports per-item statistics", async () => {
    const ttk = await token("teacher");
    const { forms } = (await request(app).get("/api/questionnaires/admin/forms").set(A(ttk))).body;
    const osce = forms.find((f) => f.template_key === "osce-history-checklist");
    await request(app).put(`/api/questionnaires/admin/forms/${osce.id}`).set(A(ttk)).send({ ...osce, active: true });

    const stk = await token("40012345");
    const nine = Object.fromEntries(OSCE_CHECKLIST.items.map((i, k) => [i.id, k < 9]));
    expect((await submit(osce.id, stk, nine)).status).toBe(200);

    const an = await request(app).get(`/api/questionnaires/admin/forms/${osce.id}/analysis`).set(A(ttk));
    expect(an.status).toBe(200);
    expect(an.body.form.isChecklist).toBe(true);
    expect(an.body.overall.mean).toBe(7.5);
    expect(an.body.responses[0].score.outOf10).toBe(7.5);
    // Per-criterion pass rates are what Table 1 of the protocol reports.
    expect(an.body.perItem.length).toBe(12);
    expect(an.body.perItem[0].passRate).toBe(100);      // item 1 was done
    expect(an.body.perItem[11].passRate).toBe(0);       // item 12 was not
  });

  it("the NPS aggregate surfaces on a satisfaction form", async () => {
    const ttk = await token("teacher");
    const { forms } = (await request(app).get("/api/questionnaires/admin/forms").set(A(ttk))).body;
    const sat = forms.find((f) => f.template_key === "student-satisfaction-nps");
    await request(app).put(`/api/questionnaires/admin/forms/${sat.id}`).set(A(ttk)).send({ ...sat, active: true });

    const stk = await token("40012345");
    await submit(sat.id, stk, Object.fromEntries(STUDENT_SATISFACTION.items.map((i) => [i.id, i.nps ? 10 : 9])));

    const an = await request(app).get(`/api/questionnaires/admin/forms/${sat.id}/analysis`).set(A(ttk));
    expect(an.body.nps.n).toBe(1);
    expect(an.body.nps.promoters).toBe(1);
    expect(an.body.nps.nps).toBe(100);
    expect(an.body.overall.mean).toBe(9.1);
  });

  it("the CSV export is de-identified for anonymous forms and named otherwise", async () => {
    const ttk = await token("teacher");
    const { forms } = (await request(app).get("/api/questionnaires/admin/forms").set(A(ttk))).body;
    const sat = forms.find((f) => f.template_key === "student-satisfaction-nps");
    const osce = forms.find((f) => f.template_key === "osce-history-checklist");

    // Anonymous form: no identifier columns at all.
    const anon = await request(app).get(`/api/questionnaires/admin/forms/${sat.id}/responses.csv`).set(A(ttk));
    expect(anon.status).toBe(200);
    const anonLines = anon.text.replace(/^\uFEFF/, "").trim().split("\n");
    expect(anonLines[0].startsWith("response_id,pseudonym,sat1,")).toBe(true);
    expect(anon.text).not.toContain("40012345");

    // Attributed form: identifiers present by default…
    const named = await request(app).get(`/api/questionnaires/admin/forms/${osce.id}/responses.csv`).set(A(ttk));
    expect(named.text).toContain("40012345");
    // …and dropped on request.
    const deId = await request(app).get(`/api/questionnaires/admin/forms/${osce.id}/responses.csv?anonymize=1`).set(A(ttk));
    expect(deId.status).toBe(200);
    expect(deId.text).not.toContain("40012345");
    expect(deId.text.split("\n")[0]).toContain("pseudonym");
    expect(deId.text.split("\n")[0]).not.toContain("student_no");
  });

  it("every analysis and export is audited", async () => {
    const ttk = await token("teacher");
    const { forms } = (await request(app).get("/api/questionnaires/admin/forms").set(A(ttk))).body;
    const osce = forms.find((f) => f.template_key === "osce-history-checklist");
    await request(app).get(`/api/questionnaires/admin/forms/${osce.id}/responses.csv`).set(A(ttk));
    const acts = db.prepare("SELECT action FROM audit_log ORDER BY id DESC LIMIT 10").all().map((x) => x.action);
    expect(acts).toContain("questionnaire.export");
  });
});

describe("teacher progress dashboard for the whole class", () => {
  async function setup() {
    const ttk = await token("teacher");
    const cid = (await request(app).post("/api/classes").set(A(ttk))
      .send({ name_en: "Dash", name_fa: "داشبورد", maxAttempts: 5 })).body.id;
    const ali = await uid(ttk, "40012345");
    const maryam = await uid(ttk, "40067890");
    await request(app).put(`/api/classes/${cid}/members`).set(A(ttk)).send({ userIds: [ali, maryam] });
    await request(app).put(`/api/classes/${cid}/cases`).set(A(ttk)).send({ cases: [{ case_id: 1, weight: 1 }] });
    return { ttk, cid, ali, maryam };
  }
  const session = { messages: [{ role: "student", text: "سلام دکتر هستم، درد قفسه سینه دارید؟" }],
                    tests: ["ecg", "troponin"], imaging: ["cxr"], ddx: ["STEMI", "GERD"], finalDx: "STEMI" };

  it("returns every member with a line, a radar and a remedial flag", async () => {
    const { ttk, cid } = await setup();
    const atk = await token("40012345");
    await request(app).post("/api/exam/evaluate").set(A(atk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 120, session });

    const p = await request(app).get(`/api/classes/${cid}/progress`).set(A(ttk));
    expect(p.status).toBe(200);
    expect(p.body.threshold).toBe(6);
    expect(p.body.totals.students).toBe(2);
    expect(p.body.totals.notStarted).toBe(1);        // Maryam has no attempt yet

    const ali = p.body.students.find((s) => s.studentNo === "40012345");
    expect(ali.attempts).toBe(1);
    expect(ali.line.length).toBe(1);
    expect(ali.line[0].score10).toBe(Math.round(ali.line[0].score / 10 * 10) / 10);
    expect(Array.isArray(ali.radar)).toBe(true);
    expect(ali.needsRemedial).toBe(ali.latest < 6);

    const maryam = p.body.students.find((s) => s.studentNo === "40067890");
    expect(maryam.attempts).toBe(0);
    expect(maryam.latest).toBeNull();
    expect(maryam.needsRemedial).toBe(false);        // never started is not "below 6"
  });

  it("a teacher override moves the dashboard score", async () => {
    const { ttk, cid } = await setup();
    const atk = await token("40012345");
    const ev = await request(app).post("/api/exam/evaluate").set(A(atk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 120, session });
    await request(app).put(`/api/reports/attempts/${ev.body.attemptId}/review`).set(A(ttk))
      .send({ status: "adjusted", teacher_score: 20, teacher_feedback: "ضعیف" });

    const p = await request(app).get(`/api/classes/${cid}/progress`).set(A(ttk));
    const ali = p.body.students.find((s) => s.studentNo === "40012345");
    expect(ali.latest).toBe(2);                       // 20/100 → 2/10
    expect(ali.needsRemedial).toBe(true);
    expect(p.body.totals.needsRemedial).toBe(1);
  });

  it("a student cannot read the dashboard", async () => {
    const { cid } = await setup();
    const atk = await token("40012345");
    expect((await request(app).get(`/api/classes/${cid}/progress`).set(A(atk))).status).toBe(403);
  });
});

describe("remedial assignment for scores below 6/10", () => {
  it("assigns only the students below the threshold", async () => {
    const ttk = await token("teacher");
    const cid = (await request(app).post("/api/classes").set(A(ttk))
      .send({ name_en: "Rem", name_fa: "جبرانی", maxAttempts: 5 })).body.id;
    const ali = await uid(ttk, "40012345");
    const maryam = await uid(ttk, "40067890");
    await request(app).put(`/api/classes/${cid}/members`).set(A(ttk)).send({ userIds: [ali, maryam] });
    await request(app).put(`/api/classes/${cid}/cases`).set(A(ttk)).send({ cases: [{ case_id: 1, weight: 1 }] });

    // Ali scores poorly; Maryam is never graded.
    const atk = await token("40012345");
    const ev = await request(app).post("/api/exam/evaluate").set(A(atk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 60,
              session: { messages: [{ role: "student", text: "سلام" }], tests: [], imaging: [], ddx: [], finalDx: "" } });
    await request(app).put(`/api/reports/attempts/${ev.body.attemptId}/review`).set(A(ttk))
      .send({ status: "adjusted", teacher_score: 30 });

    const r = await request(app).post(`/api/classes/${cid}/remedial`).set(A(ttk)).send({ caseId: 2 });
    expect(r.status).toBe(200);
    expect(r.body.assigned).toBe(1);
    expect(r.body.userIds).toEqual([ali]);
    expect(r.body.threshold).toBe(6);

    // The assignment is a real exam_assignment, so the student sees the case.
    const aliRow = db.prepare("SELECT assigned_by, max_attempts FROM exam_assignments WHERE user_id=? AND case_id=2").get(ali);
    expect(aliRow.assigned_by).not.toBeNull();
    expect(aliRow.max_attempts).toBe(2);
    // Maryam already had case 2 from the seed; the remedial call must leave her
    // row alone rather than silently rewriting a pre-existing assignment.
    const maryamRow = db.prepare("SELECT assigned_by, max_attempts FROM exam_assignments WHERE user_id=? AND case_id=2").get(maryam);
    expect(maryamRow.max_attempts).toBe(2);
    expect(r.body.created).toBe(1);
    expect(r.body.updated).toBe(0);

    // Re-assigning updates rather than duplicating (UNIQUE(user_id, case_id)).
    const again = await request(app).post(`/api/classes/${cid}/remedial`).set(A(ttk)).send({ caseId: 2, maxAttempts: 3 });
    expect(again.body.assigned).toBe(1);
    expect(again.body.updated).toBe(1);
    expect(again.body.created).toBe(0);
    expect(db.prepare("SELECT COUNT(*) n FROM exam_assignments WHERE user_id=? AND case_id=2").get(ali).n).toBe(1);
    expect(db.prepare("SELECT max_attempts m FROM exam_assignments WHERE user_id=? AND case_id=2").get(ali).m).toBe(3);
  });

  it("the dashboard and the remedial selection can never disagree", async () => {
    /* Regression: the dashboard scored an attempt by its EFFECTIVE score (a
       teacher's override wins) while the remedial query read the raw
       attempts.score. A teacher could lower a student below 6/10, see the flag
       on the dashboard, press "assign remedial", and nobody would be selected.
       Both now derive from the same computation. */
    const ttk = await token("teacher");
    const cid = (await request(app).post("/api/classes").set(A(ttk))
      .send({ name_en: "Agree", name_fa: "توافق", maxAttempts: 5 })).body.id;
    const ali = await uid(ttk, "40012345");
    await request(app).put(`/api/classes/${cid}/members`).set(A(ttk)).send({ userIds: [ali] });
    await request(app).put(`/api/classes/${cid}/cases`).set(A(ttk)).send({ cases: [{ case_id: 1, weight: 1 }] });

    const atk = await token("40012345");
    const ev = await request(app).post("/api/exam/evaluate").set(A(atk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 60,
              session: { messages: [{ role: "student", text: "من دکتر هستم، اجازه هست سؤال بپرسم؟ درد به بازو انتشار دارد؟ دیابت یا تنگی نفس دارید؟ معاینه و علائم حیاتی را می‌خواهم؛ درمان مناسب و آسپرین را بررسی می‌کنم." }],
                         tests: ["ecg", "troponin"], imaging: ["cxr"], problemList: ["درد قفسه سینه"], ddx: ["STEMI"], finalDx: "STEMI" } });
    // The AI score is above the threshold; the teacher pulls it below.
    expect(ev.body.score).toBeGreaterThanOrEqual(60);
    await request(app).put(`/api/reports/attempts/${ev.body.attemptId}/review`).set(A(ttk))
      .send({ status: "adjusted", teacher_score: 30, teacher_feedback: "ضعیف" });

    const prog = await request(app).get(`/api/classes/${cid}/progress`).set(A(ttk));
    const flagged = prog.body.students.filter((x) => x.needsRemedial).map((x) => x.userId);
    expect(flagged).toEqual([ali]);

    const r = await request(app).post(`/api/classes/${cid}/remedial`).set(A(ttk)).send({ caseId: 1 });
    expect(r.body.userIds).toEqual(flagged);        // exactly who the dashboard flagged
    expect(r.body.assigned).toBe(1);
  });

  it("an explicit list overrides the threshold selection", async () => {
    const ttk = await token("teacher");
    const cid = (await request(app).post("/api/classes").set(A(ttk))
      .send({ name_en: "Rem2", name_fa: "ج۲", maxAttempts: 5 })).body.id;
    const maryam = await uid(ttk, "40067890");
    await request(app).put(`/api/classes/${cid}/members`).set(A(ttk)).send({ userIds: [maryam] });
    const r = await request(app).post(`/api/classes/${cid}/remedial`).set(A(ttk))
      .send({ caseId: 2, userIds: [maryam] });
    expect(r.body.assigned).toBe(1);
    expect(r.body.userIds).toEqual([maryam]);
  });

  it("validates the case and refuses students", async () => {
    const ttk = await token("teacher");
    const cid = (await request(app).post("/api/classes").set(A(ttk))
      .send({ name_en: "Rem3", name_fa: "ج۳", maxAttempts: 5 })).body.id;
    expect((await request(app).post(`/api/classes/${cid}/remedial`).set(A(ttk)).send({})).status).toBe(400);
    expect((await request(app).post(`/api/classes/${cid}/remedial`).set(A(ttk)).send({ caseId: 999999 })).status).toBe(404);
    const atk = await token("40012345");
    expect((await request(app).post(`/api/classes/${cid}/remedial`).set(A(atk)).send({ caseId: 2 })).status).toBe(403);
  });

  it("the assignment is audited", async () => {
    const acts = db.prepare("SELECT action FROM audit_log ORDER BY id DESC LIMIT 12").all().map((x) => x.action);
    expect(acts).toContain("class.remedial_assigned");
  });
});
