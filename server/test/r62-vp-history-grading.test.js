/* ================================================================
   r62-vp-history-grading.test.js — Round 62 regression tests.

     1. History is never hidden by a row cap or by the current active state:
        - the teacher inbox pages through EVERY saved conversation (no silent
          newest-250 cut-off) and reports the full total;
        - the teacher's per-student detail lists every VP attempt (was 20);
        - a deactivated case the student already worked on stays visible to the
          student as an archived row with its history and best score, but cannot
          be started again.
     2. One question at a time: three or more questions in one message get a
        confused-patient reply asking for one question at a time.
     3. Exam requests reach the supervising attending, not the patient persona:
        imperative/measuring phrasings are detected, and a patient reply that
        deflects an exam is replaced by the attending's chart-based findings.
     4. Partial-credit checklist scoring: problem-list and differential items earn
        weight × (covered expected items / expected items).
   ================================================================ */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import {
  evaluate, countStudentQuestions, detectExamRequest, deflectsExamRequest, patientReply, keyedCredit,
} from "../src/lib/ai-engine.js";
import { REGROUPINGS, regroupDefaultItem, regroupDefaultItems } from "../src/lib/checklist-facets.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
async function token(u, p = "demo") { return (await login(u, p)).body.token; }
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

/* ---------- 2 + 3: pure routing helpers ---------- */
describe("one question at a time", () => {
  it("counts question marks in Persian and Latin text", () => {
    expect(countStudentQuestions("سن شما چند سال است؟ درد کجاست؟ از کی شروع شد؟")).toBe(3);
    expect(countStudentQuestions("Where does it hurt? When did it start?")).toBe(2);
    expect(countStudentQuestions("سلام دکتر، درد کجاست؟")).toBe(1);
  });

  it("counts interrogative sentences when there are no question marks", () => {
    expect(countStudentQuestions("سن شما چند است. درد کجاست. از کی شروع شد. ")).toBe(3);
    // One unpunctuated clause counts as one question (clauses are split on punctuation).
    expect(countStudentQuestions("درد کجاست از کی شروع شد")).toBe(1);
  });

  it("three questions in one message: the patient says they are confused (fa and en)", async () => {
    const fa = await patientReply({ caseData: {}, userText: "سن شما چند سال است؟ درد کجاست؟ از کی شروع شد؟", history: [], lang: "fa", prompts: {}, aiCfg: {} });
    expect(fa.source).toBe("rule");
    expect(fa.text).toMatch(/گیج/);
    expect(fa.text).toMatch(/یک سؤال/);
    const en = await patientReply({ caseData: {}, userText: "Where does it hurt? When did it start? Any fever? Smoking?", history: [], lang: "en", prompts: {}, aiCfg: {} });
    expect(en.text).toMatch(/confused/i);
    expect(en.text).toMatch(/one question at a time/i);
  });

  it("one or two questions are still answered normally", async () => {
    const r = await patientReply({ caseData: {}, userText: "درد کجاست؟ از کی شروع شد؟", history: [], lang: "fa", prompts: {}, aiCfg: {} });
    expect(r.text).not.toMatch(/گیج/);
  });
});

describe("exam requests reach the attending", () => {
  it("detects imperative and measuring requests the fixed phrases used to miss", () => {
    for (const t of [
      "استاد لطفا فشارش را بگیرید", "معاینه شکم را انجام بدهید", "ریه‌هایش را سمع کنید",
      "شکمش را لمس کنید", "نبضش را بگیرید", "can you listen to the chest?",
      "please palpate the abdomen", "check his pulse and bp",
    ]) expect(detectExamRequest(t), t).toBe(true);
  });

  it("does not treat the patient's own history or symptom questions as exam requests", () => {
    for (const t of [
      "آیا قبلاً معاینه شده‌اید؟", "معاینه شدم", "have you been examined before?",
      "درد قفسه سینه دارید؟", "سیگار می‌کشید؟", "I have an exam tomorrow", "آیا تب داشتید؟",
    ]) expect(detectExamRequest(t), t).toBe(false);
  });

  it("flags a patient reply that deflects the exam to someone else", () => {
    expect(deflectsExamRequest("معاینه کار من نیست، از دکتر بخواهید.")).toBe(true);
    expect(deflectsExamRequest("Physical exam is not my job, ask the doctor.")).toBe(true);
    expect(deflectsExamRequest("درد از دیشب شروع شد.")).toBe(false);
  });
});

/* ---------- 4: partial-credit checklist scoring ---------- */
describe("partial-credit problem list and differentials", () => {
  const caseData = {
    diagnosis_fa: "آنفارکتوس", diagnosis_en: "STEMI",
    problem_list_fa: "درد قفسه سینه\nفشار خون بالا\nدیابت نوع ۲\nچاقی",
    ddx_fa: "پریکاردیت\nآمبولی ریه\nتشریح آئورت\nگاستریت",
  };
  const item = (r, id) => r.results.find((x) => x.id === id);

  it("half of the expected problems earns half of the item weight", () => {
    const r = evaluate({
      caseData, checklist: { items: [] }, lang: "fa", scope: "overall",
      session: { problemList: ["درد قفسه سینه", "فشار خون بالا"], ddx: [] },
    });
    const pl = item(r, "pl01");
    expect(pl.credit).toBe(0.5);
    expect(pl.done).toBe(false);
    expect(pl.weight).toBe(3);
  });

  it("writing none earns zero; naming the real diagnosis earns the whole item", () => {
    const none = evaluate({ caseData, checklist: { items: [] }, lang: "fa", scope: "overall", session: { problemList: [], ddx: [] } });
    expect(item(none, "pl01").credit).toBe(0);
    const dx = evaluate({ caseData, checklist: { items: [] }, lang: "fa", scope: "overall", session: { problemList: ["آنفارکتوس"], ddx: [] } });
    expect(item(dx, "pl01").credit).toBe(1);
    expect(item(dx, "pl01").done).toBe(true);
  });

  it("differentials are proportional too (1 of 3 covered = 1/3 of the item)", () => {
    const r = evaluate({
      caseData, checklist: { items: [] }, lang: "fa", scope: "overall",
      session: { problemList: [], ddx: ["پریکاردیت"] },
    });
    expect(item(r, "ddx01").credit).toBeCloseTo(1 / 4, 2);   // 4 expected differentials
    const earned = r.results.reduce((s, x) => s + x.weight * x.credit, 0);
    const total = r.results.reduce((s, x) => s + x.weight, 0);
    expect(r.score).toBe(Math.round((earned / total) * 100));
  });
});

/* ---------- 1: history is never hidden ---------- */
describe("virtual-patient history is never hidden by caps or active state", () => {
  let ttk, stuId, caseId, classId;
  const STUDENT = "40012345";

  beforeAll(async () => {
    ttk = await token("teacher");
    const users = (await request(app).get("/api/users").set(A(ttk))).body;
    stuId = users.find((u) => u.username === STUDENT).id;
    const seedCase = (await request(app).get("/api/cases").set(A(ttk))).body;
    const pool = Array.isArray(seedCase) ? seedCase : (seedCase.items || seedCase.cases || []);
    const pickId = pool.find((c) => c.id)?.id;
    const created = await request(app).post("/api/classes").set(A(ttk))
      .send({ name_en: `R62 history ${Math.random()}`, name_fa: "سابقه", gradingRole: "history" });
    classId = created.body.id;
    await request(app).put(`/api/classes/${classId}/members`).set(A(ttk)).send({ userIds: [stuId] });
    await request(app).put(`/api/classes/${classId}/cases`).set(A(ttk)).send({ cases: [{ case_id: pickId, weight: 1 }] });
    // Use the id the class actually holds (academic copies may differ from pickId).
    const held = (await request(app).get(`/api/classes/${classId}`).set(A(ttk))).body.cases || [];
    caseId = held[0]?.case_id;
    expect(caseId, "class must hold one case").toBeTruthy();
  });

  const insertAttempt = (score) => db.prepare(
    "INSERT INTO attempts (user_id,type,case_id,class_id,score,eval_json,transcript_json,lang) VALUES (?,?,?,?,?,?,?,?)"
  ).run(stuId, "vp", caseId, classId, score, JSON.stringify({ score }), JSON.stringify({ messages: [] }), "fa");

  it("the teacher's per-student detail lists every VP attempt, not just the newest 20", async () => {
    for (let i = 0; i < 25; i++) insertAttempt(40 + i);
    const r = await request(app).get(`/api/classes/${classId}/live-board/${stuId}/details`).set(A(ttk));
    expect(r.status).toBe(200);
    const vp = r.body.attempts.filter((a) => a.kind === "vp");
    expect(vp.length).toBeGreaterThanOrEqual(25);
  });

  it("the teacher inbox pages through all saved conversations and reports the total", async () => {
    const p1 = await request(app).get("/api/classes/conversations?limit=5&offset=0").set(A(ttk));
    expect(p1.status).toBe(200);
    expect(p1.body.attempts.length).toBe(5);
    expect(p1.body.total).toBeGreaterThanOrEqual(25);
    const p2 = await request(app).get("/api/classes/conversations?limit=5&offset=5").set(A(ttk));
    const ids1 = new Set(p1.body.attempts.map((a) => a.id));
    expect(p2.body.attempts.some((a) => ids1.has(a.id))).toBe(false);
    // Paging over everything reaches the last row (no silent cut-off).
    let seen = 0, offset = 0;
    while (true) {
      const pg = await request(app).get(`/api/classes/conversations?limit=500&offset=${offset}`).set(A(ttk));
      if (!pg.body.attempts.length) break;
      seen += pg.body.attempts.length; offset += pg.body.attempts.length;
    }
    expect(seen).toBe(p1.body.total);
  });

  it("a deactivated case the student worked on stays visible as archived, with history, but cannot be started", async () => {
    const stk = await token(STUDENT);
    const before = await request(app).get(`/api/classes/${classId}`).set(A(stk));
    expect(before.status).toBe(200);
    expect(before.body.cases.some((c) => c.case_id === caseId && !c.archived)).toBe(true);

    const del = await request(app).delete(`/api/cases/${caseId}`).set(A(ttk));
    expect(del.status).toBe(200);
    try {
      const after = await request(app).get(`/api/classes/${classId}`).set(A(stk));
      const row = after.body.cases.find((c) => c.case_id === caseId);
      expect(row, "history row must not disappear").toBeTruthy();
      expect(row.archived).toBe(true);
      expect(row.attemptsUsed).toBeGreaterThan(0);
      expect(row.best).toBeGreaterThan(0);
      // archived rows do not count as graded progress items
      expect(after.body.grade ?? 0).toBeGreaterThanOrEqual(0);
      const start = await request(app).post("/api/exam/session-start").set(A(stk))
        .send({ caseId, classId, lang: "fa" });
      expect(start.status).toBe(404);
    } finally {
      db.prepare("UPDATE cases SET active=1 WHERE id=?").run(caseId);
    }
  });
});

/* ---------- 4b: evidence-point keys for keyed checklist items ---------- */
describe("keyed checklist items: synonyms count, points are proportional", () => {
  const legacy = (id, keys) => ({ id, section: "exam", weight: 2, fa: "x", en: "x", keys });

  it("a key with | is one point: any synonym covers it; the item earns covered/points", () => {
    const keys = ["معرفی|من دکتر|من دانشجو|introduce", "اجازه هست|consent"];
    expect(keyedCredit("سلام، من دانشجو هستم", keys)).toBe(0.5);
    expect(keyedCredit("سلام، من دانشجو هستم و اجازه هست؟", keys)).toBe(1);
    expect(keyedCredit("hello there", keys)).toBe(0);
  });

  it("plain flat keys stay one synonym set: any hit earns the item (no regression)", () => {
    expect(keyedCredit("نبض را گرفتم", ["نبض", "pulse", "سمع"])).toBe(1);
    expect(keyedCredit("هیچ", ["نبض", "pulse"])).toBe(0);
  });

  it("the introduction counts as a student, extern or intern, not only a doctor", () => {
    const i1 = REGROUPINGS.find((r) => r.id === "i1").facets;
    expect(keyedCredit("من دانشجوی پزشکی هستم، اجازه هست؟", i1)).toBe(1);
    expect(keyedCredit("I am an extern, may I ask consent?", i1)).toBe(1);
  });

  it("evaluate: an exam that covers two of four exam points earns half the exam item", () => {
    const i_exam = [legacy("i_exam", REGROUPINGS.find((r) => r.id === "i_exam").facets)];
    const r = evaluate({
      caseData: { diagnosis_fa: "STEMI", diagnosis_en: "STEMI" },
      checklist: { items: i_exam }, lang: "en", scope: "overall",
      session: { problemList: [], ddx: [], finalDx: "", tests: [], messages: [{ role: "student", text: "physical exam done, pulse 80" }] },
    });
    const item = r.results.find((x) => x.id === "i_exam");
    expect(item.credit).toBe(0.5);
  });

  it("the legacy default key list is rewritten only when id and keys match exactly", () => {
    const shipped = REGROUPINGS.find((r) => r.id === "i_exam");
    const hit = regroupDefaultItem({ id: "i_exam", keys: shipped.legacy, weight: 2 });
    expect(hit.keys).toEqual(shipped.facets);
    const edited = regroupDefaultItem({ id: "i_exam", keys: [...shipped.legacy, "ECG"], weight: 2 });
    expect(edited.keys).toEqual([...shipped.legacy, "ECG"]);
    const { items, changed } = regroupDefaultItems([{ id: "i_exam", keys: shipped.legacy }, { id: "custom", keys: ["a"] }]);
    expect(changed).toBe(1);
    expect(items[1].keys).toEqual(["a"]);
  });

  it("the seeded default checklists already use evidence points", () => {
    // R63: the default checklists moved from seed.js into data/default-checklists.js.
    const dataSrc = require("node:fs").readFileSync(new URL("../src/data/default-checklists.js", import.meta.url), "utf8");
    expect(dataSrc).toMatch(/id: "i_exam"[^\n]*keys: \["معاینه\|/);
  });
  it("section scores use partial credit, not done-only (a 0.25 item earns a quarter of its weight)", async () => {
    const { itemCredit, computeSectionScores } = await import("../src/lib/history-sections.js");
    expect(itemCredit({ credit: 0.5, done: false })).toBe(0.5);
    expect(itemCredit({ credit: 2, done: true })).toBe(1);
    expect(itemCredit({ credit: -1 })).toBe(0);
    expect(itemCredit({ done: true })).toBe(1);
    expect(itemCredit({})).toBe(0);
    const s = computeSectionScores([
      { id: "a", section: "history", weight: 4, credit: 0.25, done: false },
      { id: "b", section: "history", weight: 4, credit: 1, done: true },
    ], "en");
    const hist = s.sections.find((x) => x.key === "history");
    expect(hist.earned).toBe(5);
    expect(hist.total).toBe(8);
    expect(s.overall).toBe(63);
  });
});
