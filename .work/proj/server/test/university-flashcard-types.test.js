/* University flashcard types: type-lock, empty fill/tf, KF expected,
   partial exam regrade, compare persist, duplicate / out-of-deck 400. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { createApp } from "../src/app.js";
import { initDb, db, persistNow } from "../src/db.js";
import {
  gradeFlashcard, studentSafeFlashcard, gradeSubmittedDeck, flashTok, bodyFromAnswer, bodyFromClientSel, formatFlashAnswer,
} from "../src/lib/flashcard-grade.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
async function token(u, p = "demo") { return (await login(u, p)).body.token; }
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

describe("gradeFlashcard type-lock and empty answers", () => {
  it("locks grading to the stored type (body.type cannot switch MCQ → truefalse)", () => {
    const mcq = {
      id: 9, type: "mcq",
      options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }],
    };
    const spoof = gradeFlashcard(mcq, { type: "truefalse", value: true, answer: true });
    expect(spoof.ok).toBe(false);
    expect(gradeFlashcard(mcq, { optionIndex: 0 }).ok).toBe(true);
  });

  it("treats type image as MCQ", () => {
    const card = {
      id: 11, type: "image",
      options: [{ en: "a", fa: "الف", correct: false }, { en: "b", fa: "ب", correct: true }],
    };
    expect(gradeFlashcard(card, { optionIndex: 1 }).ok).toBe(true);
    expect(gradeFlashcard(card, { optionIndex: 0 }).ok).toBe(false);
  });

  it("empty fill and truefalse are incorrect, not coerced to a default", () => {
    const fill = { id: 1, type: "fill", blank_en: "STEMI", blank_fa: "استمی", accept_en: ["MI"] };
    expect(gradeFlashcard(fill, { text: "" }).ok).toBe(false);
    expect(gradeFlashcard(fill, { text: "   " }).ok).toBe(false);
    expect(gradeFlashcard(fill, { text: "STEMI", lang: "en" }).ok).toBe(true);
    const tf = { id: 2, type: "truefalse", answer: true };
    expect(gradeFlashcard(tf, { value: "" }).ok).toBe(false);
    expect(gradeFlashcard(tf, { value: null }).ok).toBe(false);
    expect(gradeFlashcard(tf, {}).ok).toBe(false);
    expect(gradeFlashcard(tf, { value: "true" }).ok).toBe(true);
    expect(gradeFlashcard(tf, { value: 0 }).ok).toBe(false);
  });

  it("KF reveal returns canonical expected answers", () => {
    const kf = {
      id: 3, type: "kf",
      kf: {
        items: [
          { kind: "short", prompt_en: "dx", answer_en: "STEMI", answer_fa: "استمی", accept_en: ["MI"] },
          { kind: "mcq", prompt_en: "first", options_en: ["ECG", "CXR"], correct: 0 },
        ],
      },
    };
    const g = gradeFlashcard(kf, { answers: { 0: "STEMI", 1: 0 }, lang: "en", reveal: true });
    expect(g.ok).toBe(true);
    expect(g.kfResults[0].expected).toBe("STEMI");
    expect(g.kfResults[1].expected).toBe(0);
  });

  it("student-safe compare strips belongs; match/order require tokens unless allowLegacy", () => {
    const cmp = {
      id: 4, type: "compare",
      features: [{ fa: "قطع ST", en: "ST elevation", belongs: "A" }],
    };
    const safe = studentSafeFlashcard(cmp);
    expect(safe.features[0].belongs).toBeUndefined();
    expect(safe.features[0].en).toBe("ST elevation");

    const match = { id: 5, type: "match", pairs: [["L1", "L1", "R1", "R1"], ["L2", "L2", "R2", "R2"]] };
    expect(gradeFlashcard(match, { pairs: { 0: 0, 1: 1 } }).ok).toBe(false);
    expect(gradeFlashcard(match, { pairs: { 0: 0, 1: 1 } }, { allowLegacy: true }).ok).toBe(true);
    const L0 = flashTok(5, "L", 0), R0 = flashTok(5, "R", 0);
    const L1 = flashTok(5, "L", 1), R1 = flashTok(5, "R", 1);
    expect(gradeFlashcard(match, { pairs: { [L0]: R0, [L1]: R1 } }).ok).toBe(true);

    const order = { id: 6, type: "order", items_en: ["first", "second"] };
    expect(gradeFlashcard(order, { order: [0, 1], lang: "en" }).ok).toBe(false);
    expect(gradeFlashcard(order, { order: [0, 1], lang: "en" }, { allowLegacy: true }).ok).toBe(true);
    const O0 = flashTok(6, "O", 0), O1 = flashTok(6, "O", 1);
    expect(gradeFlashcard(order, { order: [O0, O1], lang: "en" }).ok).toBe(true);
  });

  it("bodyFromAnswer maps order objects and compare answers; deck flags dup/out-of-deck", () => {
    const orderCard = { id: 7, type: "order", items_en: ["first", "second"] };
    const body = bodyFromAnswer({ type: "order", answer: [{ id: flashTok(7, "O", 0) }, { id: flashTok(7, "O", 1) }] }, orderCard);
    expect(gradeFlashcard(orderCard, { ...body, lang: "en" }).ok).toBe(true);

    const cards = new Map([
      [1, { id: 1, type: "mcq", options: [{ correct: true }, { correct: false }] }],
      [2, { id: 2, type: "mcq", options: [{ correct: true }, { correct: false }] }],
    ]);
    const load = (id) => cards.get(id) || null;
    expect(gradeSubmittedDeck(load, [
      { card_id: 1, type: "mcq", selectedIdx: 0 },
      { card_id: 1, type: "mcq", selectedIdx: 0 },
    ], [1]).error).toBe("duplicate_card");
    expect(gradeSubmittedDeck(load, [{ card_id: 9, type: "mcq", selectedIdx: 0 }], [1, 2]).error).toBe("answers_out_of_deck");
    const partial = gradeSubmittedDeck(load, [{ card_id: 1, type: "mcq", selectedIdx: 0 }], [1, 2]);
    expect(partial.score).toBe(50);
    expect(gradeSubmittedDeck(load, [], []).score).toBe(0);
  });
});

describe("university flashcard HTTP: persist, check, exam, class", () => {
  it("compare persists features/belongs for teachers and strips belongs for students", async () => {
    const ttk = await token("teacher");
    const created = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "CompareUFT", title_fa: "مقایسه‌انواع", type: "compare",
      entityA_en: "STEMI", entityA_fa: "استمی", entityB_en: "NSTEMI", entityB_fa: "غیر استمی",
      features: [
        { fa: "قطع ST", en: "ST elevation", belongs: "A" },
        { fa: "تروپونین", en: "troponin", belongs: "both" },
      ],
    });
    expect(created.status).toBe(200);
    const teacherList = await request(app).get("/api/flashcards").set(A(ttk));
    const authored = (teacherList.body || []).find((c) => c.id === created.body.id);
    expect(authored.type).toBe("compare");
    expect(authored.features[0].belongs).toBe("A");
    const stk = await token("40012345");
    const bank = await request(app).get("/api/flashcards").set(A(stk));
    const studentCard = (bank.body || []).find((c) => c.id === created.body.id);
    expect(studentCard).toBeTruthy();
    expect((studentCard.features || []).every((f) => f.belongs == null)).toBe(true);
    const right = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: created.body.id, type: "compare", answers: { 0: "A", 1: "both" }, reveal: true });
    expect(right.status).toBe(200);
    expect(right.body.ok).toBe(true);
    expect(right.body.featureResults[0].belongs).toBe("A");
  });

  it("teacher allowLegacy positional match; student positional is rejected", async () => {
    const ttk = await token("teacher");
    const created = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "MatchUFT", title_fa: "تطبیق‌انواع", type: "match",
      pairs: [["چپ۱", "L1", "راست۱", "R1"], ["چپ۲", "L2", "راست۲", "R2"]],
    });
    expect(created.status).toBe(200);
    const teacherOk = await request(app).post("/api/flashcards/check").set(A(ttk))
      .send({ cardId: created.body.id, type: "match", pairs: { 0: 0, 1: 1 } });
    expect(teacherOk.status).toBe(200);
    expect(teacherOk.body.ok).toBe(true);
    const stk = await token("40012345");
    const studentLegacy = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: created.body.id, type: "match", pairs: { 0: 0, 1: 1 } });
    expect(studentLegacy.status).toBe(200);
    expect(studentLegacy.body.ok).toBe(false);
    const bank = await request(app).get("/api/flashcards").set(A(stk));
    const card = (bank.body || []).find((c) => c.id === created.body.id);
    const pairs = {};
    for (const L of card.matchLeft) {
      const n = String(L.en || "").replace(/^L/, "");
      const R = card.matchRight.find((r) => (r.en || "") === `R${n}`);
      expect(R).toBeTruthy();
      pairs[L.id] = R.id;
    }
    const studentTok = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: created.body.id, type: "match", pairs });
    expect(studentTok.body.ok).toBe(true);
  });

  it("empty fill/truefalse HTTP checks are incorrect; KF reveal expected is canonical", async () => {
    const ttk = await token("teacher");
    const fill = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "FillUFT", title_fa: "جای‌انواع", type: "fill",
      blank_en: "STEMI", blank_fa: "استمی", accept_en: ["MI"],
    });
    const tf = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "TFUFT", title_fa: "درست‌انواع", type: "truefalse", answer: true,
    });
    const kf = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "KFUFT", title_fa: "کی‌اف‌انواع", type: "kf",
      kf: { vignette_en: "chest pain", vignette_fa: "درد", items: [
        { kind: "short", prompt_en: "dx", prompt_fa: "تشخیص", answer_en: "STEMI", answer_fa: "استمی", accept_en: ["MI"] },
        { kind: "mcq", prompt_en: "first", prompt_fa: "اول", options_en: ["ECG", "CXR", "CT", "MRI"], options_fa: ["نوار", "عکس", "سی‌تی", "ام‌آرآی"], correct: 0 },
      ] },
    });
    const stk = await token("40012345");
    const emptyFill = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: fill.body.id, type: "fill", text: "" });
    expect(emptyFill.body.ok).toBe(false);
    const emptyTf = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: tf.body.id, type: "truefalse", value: "" });
    expect(emptyTf.body.ok).toBe(false);
    const kfG = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: kf.body.id, type: "kf", answers: { 0: "STEMI", 1: 0 }, lang: "en", reveal: true });
    expect(kfG.status).toBe(200);
    expect(kfG.body.ok).toBe(true);
    expect(kfG.body.kfResults[0].expected).toBe("STEMI");
    expect(kfG.body.kfResults[1].expected).toBe(0);
  });

  it("exam flashcard-result partial deck, duplicate_card and answers_out_of_deck", async () => {
    const ttk = await token("teacher");
    const a = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "ExamA", title_fa: "آزمون‌آ", questionText_en: "q1", questionText_fa: "س۱",
      options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }],
    });
    const b = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "ExamB", title_fa: "آزمون‌ب", questionText_en: "q2", questionText_fa: "س۲",
      options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }],
    });
    const extra = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "ExamX", title_fa: "آزمون‌اضافه", questionText_en: "qx", questionText_fa: "س‌اضافه",
      options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }],
    });
    expect([a.status, b.status, extra.status].every((s) => s === 200)).toBe(true);
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "UFT deck", title_fa: "دک انواع",
      use_flashcards: true, flashcard_ids: [a.body.id, b.body.id],
      starts_at: now, ends_at: end, duration_min: 20, max_attempts: 8,
    });
    expect(exam.status).toBe(200);
    await request(app).put(`/api/exams/${exam.body.id}/participants`).set(A(ttk))
      .send({ studentNos: ["40012345"] });
    const stk = await token("40012345");

    const partial = await request(app).post("/api/exam/flashcard-result").set(A(stk)).send({
      examId: exam.body.id, score: 100, total: 2, correct: 1, wrong: 0, lang: "en",
      answers: [{ card_id: a.body.id, type: "mcq", selectedIdx: 0 }],
    });
    expect(partial.status).toBe(200);
    expect(partial.body.score).toBe(50);

    const dup = await request(app).post("/api/exam/flashcard-result").set(A(stk)).send({
      examId: exam.body.id, score: 100, lang: "en",
      answers: [
        { card_id: a.body.id, type: "mcq", selectedIdx: 0 },
        { card_id: a.body.id, type: "mcq", selectedIdx: 0 },
      ],
    });
    expect(dup.status).toBe(400);
    expect(dup.body.error).toBe("duplicate_card");

    const out = await request(app).post("/api/exam/flashcard-result").set(A(stk)).send({
      examId: exam.body.id, score: 100, lang: "en",
      answers: [{ card_id: extra.body.id, type: "mcq", selectedIdx: 0 }],
    });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe("answers_out_of_deck");
  });

  it("class finish regrades from answers against the assigned card", async () => {
    const ttk = await token("teacher");
    const card = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "ClassUFT", title_fa: "کلاس‌انواع", questionText_en: "q", questionText_fa: "س",
      options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }],
    });
    expect(card.status).toBe(200);
    const cls = await request(app).post("/api/classes").set(A(ttk))
      .send({ name_fa: "کلاس انواع", name_en: "uft class", maxAttempts: 5 });
    expect(cls.status).toBe(200);
    const users = await request(app).get("/api/users?role=student").set(A(ttk));
    const list = Array.isArray(users.body) ? users.body : (users.body.users || []);
    const stu = list.find((u) => u.student_no === "40012345") || list[0];
    expect(stu).toBeTruthy();
    await request(app).put(`/api/classes/${cls.body.id}/members`).set(A(ttk)).send({ userIds: [stu.id] });
    await request(app).put(`/api/classes/${cls.body.id}/flashcards`).set(A(ttk))
      .send({ flashcards: [{ flashcard_id: card.body.id, graded: true, weight: 1 }] });
    const stk = await token(stu.username || stu.student_no);
    const wrong = await request(app).post(`/api/classes/${cls.body.id}/flashcard/${card.body.id}/finish`).set(A(stk))
      .send({ score: 100, answers: [{ card_id: card.body.id, type: "mcq", selectedIdx: 1 }] });
    expect(wrong.status).toBe(200);
    expect(wrong.body.score).toBe(0);
    const right = await request(app).post(`/api/classes/${cls.body.id}/flashcard/${card.body.id}/finish`).set(A(stk))
      .send({ score: 0, answers: [{ card_id: card.body.id, type: "mcq", selectedIdx: 0 }] });
    expect(right.status).toBe(200);
    expect(right.body.score).toBe(100);
  });

  it("image-type card grades as MCQ over HTTP", async () => {
    const ttk = await token("teacher");
    const created = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "ImageUFT", title_fa: "تصویر‌انواع", type: "image",
      questionText_en: "what", questionText_fa: "چی",
      options: [{ en: "a", fa: "الف", correct: false }, { en: "b", fa: "ب", correct: true }],
    });
    expect(created.status).toBe(200);
    const stk = await token("40012345");
    const ok = await request(app).post("/api/flashcards/check").set(A(stk))
      .send({ cardId: created.body.id, type: "hotspot", optionIndex: 1 });
    expect(ok.status).toBe(200);
    expect(ok.body.ok).toBe(true);
  });
});

describe("competitive wiring: bodyFromClientSel + custom-test + learner regrade", () => {
  it("maps Lesson/CustomTest sel onto gradeFlashcard (fill/match/order/compare/image)", () => {
    const fill = { id: 21, type: "fill", blank_en: "STEMI", blank_fa: "استمی", accept_en: ["MI"] };
    expect(gradeFlashcard(fill, bodyFromClientSel(fill, { sel: "STEMI", lang: "en" })).ok).toBe(true);
    expect(gradeFlashcard(fill, bodyFromClientSel(fill, { sel: "", lang: "en" })).ok).toBe(false);

    const match = { id: 22, type: "match", pairs: [["L1", "L1", "R1", "R1"], ["L2", "L2", "R2", "R2"]] };
    const mBody = bodyFromClientSel(match, { sel: { pairs: { 0: 0, 1: 1 }, activeLeft: null } });
    expect(gradeFlashcard(match, mBody).ok).toBe(false);
    expect(gradeFlashcard(match, mBody, { allowLegacy: true }).ok).toBe(true);

    const order = { id: 23, type: "order", items_en: ["first", "second"] };
    const oBody = bodyFromClientSel(order, { sel: [{ id: 0, text: "first" }, { id: 1, text: "second" }], lang: "en" });
    expect(gradeFlashcard(order, { ...oBody, lang: "en" }, { allowLegacy: true }).ok).toBe(true);

    const cmp = { id: 24, type: "compare", features: [{ fa: "ST", en: "ST", belongs: "A" }, { fa: "tr", en: "tr", belongs: "both" }] };
    expect(gradeFlashcard(cmp, bodyFromClientSel(cmp, { sel: { 0: "A", 1: "both" } })).ok).toBe(true);
    expect(gradeFlashcard(cmp, bodyFromClientSel(cmp, { sel: { 0: "B", 1: "both" } })).ok).toBe(false);

    const img = { id: 25, type: "image", options: [{ correct: false }, { correct: true }] };
    expect(gradeFlashcard(img, bodyFromClientSel(img, { sel: 1 })).ok).toBe(true);
    expect(gradeFlashcard(img, bodyFromClientSel(img, { sel: 0 })).ok).toBe(false);

    const drawing = { id: 26, type: "drawing" };
    const dg = gradeFlashcard(drawing, bodyFromClientSel(drawing, { sel: {} }));
    expect(dg.ok).toBe(true);
    expect(dg.pendingApproval).toBe(true);
  });

  it("custom-test grades fill/match from sel, ignoring client correct:true", async () => {
    const u = db.prepare("SELECT id FROM users WHERE username='learner'").get();
    db.prepare("UPDATE learner_profiles SET premium=1, premium_until=? WHERE user_id=?").run("2030-01-01", u.id);
    persistNow();
    const atk = await token("admin");
    const fill = await request(app).post("/api/flashcards").set(A(atk)).send({
      track: "learn", type: "fill", title_en: "LearnFillCT", title_fa: "جای‌رقابت",
      blank_en: "STEMI", blank_fa: "استمی", accept_en: ["MI"],
    });
    const match = await request(app).post("/api/flashcards").set(A(atk)).send({
      track: "learn", type: "match", title_en: "LearnMatchCT", title_fa: "تطبیق‌رقابت",
      pairs: [["چپ۱", "L1", "راست۱", "R1"], ["چپ۲", "L2", "راست۲", "R2"]],
    });
    expect([fill.status, match.status].every((s) => s === 200)).toBe(true);
    const ltk = await token("learner");
    const start = await request(app).post("/api/learn/custom-test/start").set(A(ltk)).send({ n: 1, mode: "tutor" });
    expect(start.status).toBe(200);
    db.prepare("UPDATE exam_sims SET card_ids=? WHERE id=?").run(JSON.stringify([fill.body.id, match.body.id]), start.body.id);
    persistNow();

    const fillWrong = await request(app).post(`/api/learn/custom-test/${start.body.id}/answer`).set(A(ltk))
      .send({ cardId: fill.body.id, sel: "", correct: true });
    expect(fillWrong.status).toBe(200);
    expect(fillWrong.body.correct).toBe(false);

    const fillRight = await request(app).post(`/api/learn/custom-test/${start.body.id}/answer`).set(A(ltk))
      .send({ cardId: fill.body.id, sel: "STEMI", correct: false });
    expect(fillRight.status).toBe(200);
    expect(fillRight.body.correct).toBe(true);

    const matchRight = await request(app).post(`/api/learn/custom-test/${start.body.id}/answer`).set(A(ltk))
      .send({ cardId: match.body.id, sel: { pairs: { 0: 0, 1: 1 }, activeLeft: null }, correct: false });
    expect(matchRight.status).toBe(200);
    expect(matchRight.body.correct).toBe(true);
  });

  it("learner flashcard-result regrades from answers (cannot spoof 100)", async () => {
    const atk = await token("admin");
    const created = await request(app).post("/api/flashcards").set(A(atk)).send({
      track: "learn", type: "mcq", title_en: "LearnMcqFR", title_fa: "چهار‌رقابت",
      questionText_en: "q", questionText_fa: "س",
      options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }],
    });
    expect(created.status).toBe(200);
    const ltk = await token("learner");
    const spoof = await request(app).post("/api/exam/flashcard-result").set(A(ltk)).send({
      score: 100, total: 1, correct: 1, wrong: 0, lang: "en",
      answers: [{ card_id: created.body.id, type: "mcq", selectedIdx: 1 }],
    });
    expect(spoof.status).toBe(200);
    expect(spoof.body.score).toBe(0);
    const right = await request(app).post("/api/exam/flashcard-result").set(A(ltk)).send({
      score: 0, total: 1, correct: 0, wrong: 1, lang: "en",
      answers: [{ card_id: created.body.id, type: "mcq", selectedIdx: 0 }],
    });
    expect(right.status).toBe(200);
    expect(right.body.score).toBe(100);
  });
});

describe("university classroom live-board + exam competition leaderboard", () => {
  it("formatFlashAnswer covers truefalse false, fill, compare, kf, hotspot", () => {
    expect(formatFlashAnswer({ type: "truefalse", answer: false }, true)).toBe("نادرست");
    expect(formatFlashAnswer({ type: "truefalse", answer: false }, false)).toBe("False");
    expect(formatFlashAnswer({ type: "fill", answer: "STEMI" }, true)).toBe("STEMI");
    expect(formatFlashAnswer({ type: "compare", answers: { 0: "A", 1: "both" } }, true)).toBe("A، هر دو");
    expect(formatFlashAnswer({ type: "kf", kfResults: [{ index: 1, answer: "MI", correct: true }] }, true)).toContain("MI");
    expect(formatFlashAnswer({ type: "hotspot", hotspotClicks: [{ x: 40, y: 50, ok: true }] }, false)).toBe("(40, 50) ✓");
    expect(formatFlashAnswer({ type: "match", pairs: { a: "b", c: "d" } }, true)).toBe("2 جفت");
    expect(formatFlashAnswer({ type: "mcq", selected: [{ fa: "الف", en: "A" }] }, true)).toBe("الف");
  });

  it("live-board ranks by weighted gradebook score; ungraded flash does not count; details show type answers", async () => {
    const ttk = await token("teacher");
    const fill = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "LBFill", title_fa: "جای‌تخته", type: "fill",
      blank_en: "STEMI", blank_fa: "استمی",
    });
    const practice = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "LBPractice", title_fa: "تمرین‌تخته", type: "truefalse", answer: false,
    });
    expect([fill.status, practice.status].every((s) => s === 200)).toBe(true);
    const cls = await request(app).post("/api/classes").set(A(ttk))
      .send({ name_fa: "کلاس تخته زنده انواع", name_en: "lb types", maxAttempts: 5 });
    expect(cls.status).toBe(200);
    const users = await request(app).get("/api/users?role=student").set(A(ttk));
    const list = Array.isArray(users.body) ? users.body : (users.body.users || []);
    const stu = list.find((u) => u.student_no === "40012345") || list[0];
    await request(app).put(`/api/classes/${cls.body.id}/members`).set(A(ttk)).send({ userIds: [stu.id] });
    await request(app).put(`/api/classes/${cls.body.id}/flashcards`).set(A(ttk)).send({
      flashcards: [
        { flashcard_id: fill.body.id, graded: true, weight: 1 },
        { flashcard_id: practice.body.id, graded: false, weight: 1 },
      ],
    });
    const stk = await token(stu.username || stu.student_no);
    const fin = await request(app).post(`/api/classes/${cls.body.id}/flashcard/${fill.body.id}/finish`).set(A(stk))
      .send({ score: 100, answers: [{ card_id: fill.body.id, type: "fill", answer: "STEMI", lang: "en", points: 100 }] });
    expect(fin.status).toBe(200);
    expect(fin.body.score).toBe(100);
    const prac = await request(app).post(`/api/classes/${cls.body.id}/flashcard/${practice.body.id}/finish`).set(A(stk))
      .send({ score: 0, answers: [{ card_id: practice.body.id, type: "truefalse", answer: true }] });
    expect(prac.status).toBe(200);

    const board = await request(app).get(`/api/classes/${cls.body.id}/live-board`).set(A(ttk));
    expect(board.status).toBe(200);
    const row = (board.body.ranked || []).find((m) => m.user_id === stu.id);
    expect(row).toBeTruthy();
    expect(row.done).toBe(2);
    expect(row.total).toBe(2);
    expect(row.score).toBe(100);

    const det = await request(app).get(`/api/classes/${cls.body.id}/live-board/${stu.id}/details`).set(A(ttk));
    expect(det.status).toBe(200);
    const flashAtt = (det.body.attempts || []).find((a) => a.kind === "flashcard" && a.flashcard_id === fill.body.id);
    expect(flashAtt).toBeTruthy();
    expect(flashAtt.answers[0].answerText).toBe("STEMI");
    const tfAtt = (det.body.attempts || []).find((a) => a.kind === "flashcard" && a.flashcard_id === practice.body.id);
    expect(tfAtt.answers[0].answerText).toBe("درست");
    expect(tfAtt.answers[0].answerText_en).toBe("True");
  });

  it("exam competition leaderboard averages VP and flash parts instead of MAX across types", async () => {
    const ttk = await token("teacher");
    const card = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_en: "CompFlash", title_fa: "رقابت‌فلش",
      questionText_en: "q", questionText_fa: "س",
      options: [{ en: "a", fa: "الف", correct: true }, { en: "b", fa: "ب", correct: false }],
    });
    expect(card.status).toBe(200);
    const cse = await request(app).post("/api/cases").set(A(ttk))
      .send({ title_en: "CompCase", title_fa: "کیس‌رقابت", chief_en: "x", chief_fa: "x" });
    expect(cse.status).toBe(200);
    const now = new Date(Date.now() - 3600e3).toISOString();
    const end = new Date(Date.now() + 86400e3).toISOString();
    const exam = await request(app).post("/api/exams").set(A(ttk)).send({
      title_en: "Mixed compete", title_fa: "رقابت ترکیبی",
      case_ids: [cse.body.id], use_flashcards: true, flashcard_ids: [card.body.id],
      competition: true, starts_at: now, ends_at: end, duration_min: 20, max_attempts: 8,
    });
    expect(exam.status).toBe(200);
    await request(app).put(`/api/exams/${exam.body.id}/participants`).set(A(ttk))
      .send({ studentNos: ["40012345", "40067890"] });
    const aTok = await token("40012345");
    const bTok = await token("40067890");
    const flashA = await request(app).post("/api/exam/flashcard-result").set(A(aTok)).send({
      examId: exam.body.id, score: 100, total: 1, correct: 1, wrong: 0, lang: "en",
      answers: [{ card_id: card.body.id, type: "mcq", selectedIdx: 0 }],
    });
    expect(flashA.status).toBe(200);
    expect(flashA.body.score).toBe(100);
    const flashB = await request(app).post("/api/exam/flashcard-result").set(A(bTok)).send({
      examId: exam.body.id, score: 100, total: 1, correct: 1, wrong: 0, lang: "en",
      answers: [{ card_id: card.body.id, type: "mcq", selectedIdx: 0 }],
    });
    expect(flashB.status).toBe(200);
    const lb = await request(app).get(`/api/exams/${exam.body.id}/leaderboard`).set(A(ttk));
    expect(lb.status).toBe(200);
    const ra = lb.body.ranked.find((r) => r.student_no === "40012345");
    const rb = lb.body.ranked.find((r) => r.student_no === "40067890");
    expect(ra.flash).toBe(100);
    expect(ra.vp).toBe(null);
    expect(ra.score).toBe(50);
    expect(rb.score).toBe(50);
  });
});
