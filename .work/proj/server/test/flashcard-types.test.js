/* ================================================================
   flashcard-types.test.js — KF / puzzle persist, drawing approve-reject,
   questionnaires admin does not 500.
   ================================================================ */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb } from "../src/db.js";
import { createApp } from "../src/app.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
async function token(u, p = "demo") { return (await login(u, p)).body.token; }
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

describe("questionnaires admin", () => {
  it("lists forms and responses for a teacher (the tab that used to white-screen)", async () => {
    const tk = await token("teacher");
    const forms = await request(app).get("/api/questionnaires/admin/forms").set(A(tk));
    expect(forms.status).toBe(200);
    expect(Array.isArray(forms.body.forms)).toBe(true);
    const resp = await request(app).get("/api/questionnaires/admin/responses").set(A(tk));
    expect(resp.status).toBe(200);
    expect(Array.isArray(resp.body.responses)).toBe(true);
  });
});

describe("flashcard KF and puzzle payloads persist", () => {
  it("stores a Key Feature card with vignette + items", async () => {
    const tk = await token("teacher");
    const created = await request(app).post("/api/flashcards").set(A(tk)).send({
      title_fa: "کی‌اف نمونه", title_en: "KF sample", type: "kf", difficulty: "medium",
      kf: {
        vignette_fa: "آقای ۴۵ ساله با درد قفسه سینه",
        vignette_en: "45-year-old man with chest pain",
        items: [
          { kind: "short", prompt_fa: "تشخیص محتمل؟", prompt_en: "Likely dx?", answer_fa: "STEMI", answer_en: "STEMI", accept_fa: ["MI"], accept_en: ["MI"] },
          { kind: "mcq", prompt_fa: "اولین اقدام؟", prompt_en: "First step?", options_fa: ["ECG", "CXR", "CT", "MRI"], options_en: ["ECG", "CXR", "CT", "MRI"], correct: 0 },
        ],
      },
    });
    expect(created.status).toBe(200);
    expect(created.body.id).toBeTruthy();
    const list = await request(app).get("/api/flashcards").set(A(tk));
    const card = list.body.find((c) => c.id === created.body.id);
    expect(card.type).toBe("kf");
    expect(card.kf.vignette_fa).toContain("درد قفسه سینه");
    expect(card.kf.items.length).toBe(2);
    expect(card.kf.items[1].correct).toBe(0);
  });

  it("stores an image-label puzzle card", async () => {
    const tk = await token("teacher");
    const created = await request(app).post("/api/flashcards").set(A(tk)).send({
      title_fa: "پازل بافت", title_en: "Histology puzzle", type: "puzzle",
      imageUrl: "/uploads/demo-histo.png",
      puzzle: {
        imageUrl: "/uploads/demo-histo.png",
        pins: [
          { x: 32, y: 40, label_fa: "گلومرول", label_en: "Glomerulus" },
          { x: 70, y: 55, label_fa: "توبول", label_en: "Tubule" },
        ],
        distractors_fa: ["کپسول بومن"],
        distractors_en: ["Bowman capsule"],
      },
    });
    expect(created.status).toBe(200);
    const list = await request(app).get("/api/flashcards").set(A(tk));
    const card = list.body.find((c) => c.id === created.body.id);
    expect(card.type).toBe("puzzle");
    expect(card.puzzle.pins.length).toBe(2);
    expect(card.puzzle.pins[0].label_en).toBe("Glomerulus");
    expect(card.puzzle.distractors_en).toContain("Bowman capsule");
  });

  it("stores MCQ option images", async () => {
    const tk = await token("teacher");
    const created = await request(app).post("/api/flashcards").set(A(tk)).send({
      title_fa: "گزینه تصویری", title_en: "Image options", type: "mcq",
      options: [
        { fa: "الف", en: "A", correct: true, imageUrl: "/uploads/opt-a.png" },
        { fa: "ب", en: "B", correct: false, imageUrl: "/uploads/opt-b.png" },
      ],
    });
    expect(created.status).toBe(200);
    const list = await request(app).get("/api/flashcards").set(A(tk));
    const card = list.body.find((c) => c.id === created.body.id);
    expect(card.options[0].imageUrl).toBe("/uploads/opt-a.png");
    expect(card.options[1].imageUrl).toBe("/uploads/opt-b.png");
  });

  it("stores professional drawing canvas settings", async () => {
    const tk = await token("teacher");
    const created = await request(app).post("/api/flashcards").set(A(tk)).send({
      title_fa: "نقاشی بافت", title_en: "Histo drawing", type: "drawing",
      drawing: {
        prompt_fa: "لایه‌ها را بکشید", prompt_en: "Draw the layers",
        referenceImageUrl: "/uploads/slide.png", aspect: "4:3", background: "cream",
        traceReference: true, gridDefault: true, minStrokes: 3,
        rubric_fa: ["لایه‌ها مشخص"], rubric_en: ["layers visible"],
      },
    });
    expect(created.status).toBe(200);
    const list = await request(app).get("/api/flashcards").set(A(tk));
    const card = list.body.find((c) => c.id === created.body.id);
    expect(card.drawing.aspect).toBe("4:3");
    expect(card.drawing.background).toBe("cream");
    expect(card.drawing.gridDefault).toBe(true);
    expect(card.drawing.minStrokes).toBe(3);
  });

  it("stores a click-on-image hotspot with polygon + extra circle (legacy circle still reads)", async () => {
    const tk = await token("teacher");
    const created = await request(app).post("/api/flashcards").set(A(tk)).send({
      title_fa: "کلیک روی گلومرول", title_en: "Click the glomerulus", type: "hotspot",
      imageUrl: "/uploads/demo-histo.png",
      hotspot: {
        label_fa: "گلومرول", label_en: "Glomerulus", confirm: true, shape: "polygon",
        regions: [
          { shape: "polygon", points: [{ x: 30, y: 28 }, { x: 48, y: 30 }, { x: 46, y: 48 }, { x: 28, y: 44 }] },
          { shape: "circle", x: 72, y: 60, r: 8 },
        ],
      },
    });
    expect(created.status).toBe(200);
    const list = await request(app).get("/api/flashcards").set(A(tk));
    const card = list.body.find((c) => c.id === created.body.id);
    expect(card.type).toBe("hotspot");
    expect(card.hotspot.confirm).toBe(true);
    expect(card.hotspot.regions.length).toBe(2);
    expect(card.hotspot.regions[0].shape).toBe("polygon");
    expect(card.hotspot.regions[0].points.length).toBe(4);
    expect(card.hotspot.regions[1].r).toBe(8);

    const legacy = await request(app).post("/api/flashcards").set(A(tk)).send({
      title_fa: "دایره قدیمی", title_en: "Legacy circle", type: "hotspot",
      imageUrl: "/uploads/demo-histo.png",
      hotspot: { x: 40, y: 55, r: 12, label_fa: "توبول" },
    });
    expect(legacy.status).toBe(200);
    const again = await request(app).get("/api/flashcards").set(A(tk));
    const old = again.body.find((c) => c.id === legacy.body.id);
    expect(old.hotspot.x).toBe(40);
    expect(old.hotspot.r).toBe(12);
  });
});

describe("drawing approve / reject inbox", () => {
  it("teacher inbox is empty-ok, student is forbidden", async () => {
    const ttk = await token("teacher");
    const inbox = await request(app).get("/api/classes/drawing-inbox").set(A(ttk));
    expect(inbox.status).toBe(200);
    expect(Array.isArray(inbox.body.reviews)).toBe(true);
    const stk = await token("40012345");
    const denied = await request(app).get("/api/classes/drawing-inbox").set(A(stk));
    expect(denied.status).toBe(403);
  });

  it("pending drawing stays unscored until the teacher approves it", async () => {
    const ttk = await token("teacher");
    const users = (await request(app).get("/api/users").set(A(ttk))).body;
    const stu = users.find((u) => u.username === "40012345");
    const card = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_fa: "رسم بافت", title_en: "Draw tissue", type: "drawing",
      drawing: { prompt_fa: "بافت پوششی سنگفرشی را بکشید", prompt_en: "Draw squamous epithelium", rubric_fa: ["لایه"], rubric_en: ["layer"] },
    });
    expect(card.status).toBe(200);
    const cid = (await request(app).post("/api/classes").set(A(ttk))
      .send({ name_en: "Draw class", name_fa: "کلاس نقاشی" })).body.id;
    await request(app).put(`/api/classes/${cid}/members`).set(A(ttk)).send({ userIds: [stu.id] });
    const put = await request(app).put(`/api/classes/${cid}/flashcards`).set(A(ttk))
      .send({ flashcards: [{ flashcard_id: card.body.id, graded: true, weight: 1 }] });
    expect(put.status).toBe(200);

    const stk = await token("40012345");
    const finish = await request(app).post(`/api/classes/${cid}/flashcard/${card.body.id}/finish`).set(A(stk)).send({
      score: 0,
      durationSec: 30,
      answers: [{
        order: 1, card_id: card.body.id, type: "drawing",
        question_fa: "بافت پوششی سنگفرشی را بکشید", question_en: "Draw squamous epithelium",
        solved: true, points: 0, proposedPoints: 80, pendingApproval: true,
        drawing: { preview: "data:image/png;base64,aaa", strokeCount: 4, pointsFrac: 0.8, approval: { status: "pending" } },
      }],
    });
    expect(finish.status).toBe(200);
    expect(finish.body.score).toBe(0);

    const inbox = await request(app).get("/api/classes/drawing-inbox").set(A(ttk));
    expect(inbox.status).toBe(200);
    const row = inbox.body.reviews.find((r) => r.classId === cid && r.status === "pending");
    expect(row).toBeTruthy();
    expect(row.proposedPoints).toBe(80);

    const approve = await request(app)
      .post(`/api/classes/${cid}/drawing-reviews/${row.attemptId}/${row.answerIndex}`)
      .set(A(ttk)).send({ status: "approved", points: 80, feedback: "خوب" });
    expect(approve.status).toBe(200);
    expect(approve.body.score).toBe(80);
    expect(approve.body.review.status).toBe("approved");

    const after = await request(app).get("/api/classes/drawing-inbox").set(A(ttk));
    const updated = after.body.reviews.find((r) => r.attemptId === row.attemptId && r.answerIndex === row.answerIndex);
    expect(updated.status).toBe("approved");
    expect(updated.points).toBe(80);
  });

  it("drawing assist: per-card opt-out and the global flag suppress zones + suggestions", async () => {
    const ttk = await token("teacher");
    const users = (await request(app).get("/api/users").set(A(ttk))).body;
    const stu = users.find((u) => u.username === "40012345");
    // 10x10 ink mask: full left-top quadrant filled
    const cells = new Uint8Array(100);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) cells[y * 10 + x] = 1;
    const bytes = Buffer.alloc(Math.ceil(100 / 8));
    for (let i = 0; i < 100; i++) if (cells[i]) bytes[i >> 3] |= 1 << (7 - (i & 7));
    const mask = { w: 10, h: 10, data: bytes.toString("base64") };
    const zone = { x: 0, y: 0, w: 50, h: 50, label: "1" };
    const mkCard = async (assistEnabled) => (await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_fa: assistEnabled ? "نقاشی با دستیار" : "نقاشی ساده", title_en: "d", type: "drawing",
      drawing: { prompt_fa: "بکش", prompt_en: "d", minStrokes: 1, assistEnabled, zones: assistEnabled ? [zone] : [] },
    })).body.id;
    const cid = (await request(app).post("/api/classes").set(A(ttk))
      .send({ name_en: "Assist class", name_fa: "کلاس دستیار" })).body.id;
    await request(app).put(`/api/classes/${cid}/members`).set(A(ttk)).send({ userIds: [stu.id] });
    const cardOn = await mkCard(true);
    const cardOff = await mkCard(false);
    await request(app).put(`/api/classes/${cid}/flashcards`).set(A(ttk))
      .send({ flashcards: [{ flashcard_id: cardOn, graded: true }, { flashcard_id: cardOff, graded: true }] });
    const stk = await token("40012345");
    const submit = (cardId, withMask) => request(app).post(`/api/classes/${cid}/flashcard/${cardId}/finish`).set(A(stk)).send({
      score: 0, durationSec: 10,
      answers: [{ order: 1, card_id: cardId, type: "drawing", question_fa: "بکش", question_en: "d",
        solved: true, points: 0, proposedPoints: 100, pendingApproval: true,
        drawing: { preview: "data:image/png;base64,aaa", strokeCount: 3, pointsFrac: 1,
          ...(withMask ? { mask } : {}), approval: { status: "pending" } } }],
    });
    await submit(cardOn, true);
    await submit(cardOff, true);
    const inbox = await request(app).get("/api/classes/drawing-inbox").set(A(ttk));
    const find = (cardId) => inbox.body.reviews.find((r) => r.classId === cid && r.card_id === cardId && r.status === "pending");
    const on = find(cardOn), off = find(cardOff);
    expect(on).toBeTruthy(); expect(off).toBeTruthy();
    // assist ON: zones visible + coverage suggested at 100%
    expect(on.zones.length).toBe(1);
    expect(on.assist).toBeTruthy();
    expect(on.assist.basis).toBe("zones");
    expect(on.assist.coveragePct).toBe(100);
    // assist OFF for this card: no zones, no suggested numbers at all
    expect(off.zones.length).toBe(0);
    expect(off.assist).toBeNull();
    // global admin flag off suppresses assist everywhere (even opt-in cards)
    const atk = await token("admin");
    await request(app).put("/api/admin/flags/drawing_assist").set(A(atk)).send({ enabled: false });
    const inbox2 = await request(app).get("/api/classes/drawing-inbox").set(A(ttk));
    const on2 = inbox2.body.reviews.find((r) => r.classId === cid && r.card_id === cardOn && r.status === "pending");
    expect(on2.assist).toBeNull();
    expect(on2.zones.length).toBe(0);
    await request(app).put("/api/admin/flags/drawing_assist").set(A(atk)).send({ enabled: true });
  });

  it("rejecting a drawing keeps the attempt at zero", async () => {
    const ttk = await token("teacher");
    const users = (await request(app).get("/api/users").set(A(ttk))).body;
    const stu = users.find((u) => u.username === "40067890");
    const card = await request(app).post("/api/flashcards").set(A(ttk)).send({
      title_fa: "رسم رد", title_en: "Reject draw", type: "drawing",
      drawing: { prompt_fa: "بکش", prompt_en: "Draw" },
    });
    const cid = (await request(app).post("/api/classes").set(A(ttk))
      .send({ name_en: "Reject class", name_fa: "رد" })).body.id;
    await request(app).put(`/api/classes/${cid}/members`).set(A(ttk)).send({ userIds: [stu.id] });
    await request(app).put(`/api/classes/${cid}/flashcards`).set(A(ttk))
      .send({ flashcards: [{ flashcard_id: card.body.id, graded: true }] });
    const stk = await token("40067890");
    await request(app).post(`/api/classes/${cid}/flashcard/${card.body.id}/finish`).set(A(stk)).send({
      score: 0, answers: [{
        order: 1, card_id: card.body.id, type: "drawing", pendingApproval: true, points: 0, proposedPoints: 50,
        drawing: { preview: "data:image/png;base64,bbb", strokeCount: 1, approval: { status: "pending" } },
      }],
    });
    const inbox = await request(app).get(`/api/classes/${cid}/drawing-reviews`).set(A(ttk));
    const row = inbox.body.reviews[0];
    const rej = await request(app)
      .post(`/api/classes/${cid}/drawing-reviews/${row.attemptId}/${row.answerIndex}`)
      .set(A(ttk)).send({ status: "rejected" });
    expect(rej.status).toBe(200);
    expect(rej.body.score).toBe(0);
    expect(rej.body.review.status).toBe("rejected");
  });
});
