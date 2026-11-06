/* R93: bug fixes from the round-93 review.
   1. The site-bank case list gives students and learners the same reduced view as the
      detail route (no diagnosis, objectives, labs or imaging).
   2. Site-bank promotion requests are readable by teachers and admins only.
   3. Mindmap history records the signed-in account. A body `actor` field is ignored.
   4. Practice answers: a live card is required; single-choice cards are graded on the
      server; XP and review-quest progress count once per card per learner per day.
   5. practiceVerdict covers the MCQ, out-of-range and client-judged cases. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { createApp } from "../src/app.js";
import { initDb, db } from "../src/db.js";
import { practiceVerdict } from "../src/routes/learn.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
const token = async (u, p = "demo") => (await login(u, p)).body.token;
const A = (tk) => ({ Authorization: `Bearer ${tk}` });
const idOf = (username) => db.prepare("SELECT id FROM users WHERE username=?").get(username).id;

let learnCaseId = null;
const LEARN_CASE_DX = "R93-SECRET-DIAGNOSIS";

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
  // A competitive (learn-track) virtual-patient case, cloned from a seeded university case.
  const base = db.prepare("SELECT * FROM cases ORDER BY id LIMIT 1").get();
  const data = JSON.parse(base.data_json);
  data.track = "learn";
  data.diagnosis_en = LEARN_CASE_DX;
  data.diagnosis_fa = "تشخیص-آزمایشی";
  learnCaseId = Number(db.prepare("INSERT INTO cases (difficulty, checklist_id, data_json, university_id, active) VALUES (?,?,?,?,1)")
    .run(base.difficulty, base.checklist_id, JSON.stringify(data), base.university_id).lastInsertRowid);
});

afterAll(() => {
  if (learnCaseId) db.prepare("UPDATE cases SET active=0 WHERE id=?").run(learnCaseId);
});

describe("R93 site-bank case list", () => {
  it("gives a student the same reduced view in the list as in the detail", async () => {
    const stk = await token("40012345");
    const list = await request(app).get("/api/site-bank/cases").set(A(stk));
    expect(list.status).toBe(200);
    const row = list.body.find((c) => c.id === learnCaseId);
    expect(row).toBeTruthy();
    const text = JSON.stringify(list.body);
    expect(text).not.toContain(LEARN_CASE_DX);
    expect(row.diagnosis_en).toBeUndefined();
    expect(row.labs_en).toBeUndefined();
    expect(row.imagingResults).toBeUndefined();
    const detail = await request(app).get(`/api/site-bank/cases/${learnCaseId}`).set(A(stk));
    expect(JSON.stringify(detail.body)).not.toContain(LEARN_CASE_DX);
  });

  it("keeps the full case for an admin list", async () => {
    const atk = await token("admin");
    const list = await request(app).get("/api/site-bank/cases").set(A(atk));
    expect(list.status).toBe(200);
    const row = list.body.find((c) => c.id === learnCaseId);
    expect(row?.diagnosis_en).toBe(LEARN_CASE_DX);
  });
});

describe("R93 site-bank promotion requests", () => {
  it("refuses a student", async () => {
    const stk = await token("40012345");
    const res = await request(app).get("/api/site-bank/promotion-requests").set(A(stk));
    expect(res.status).toBe(403);
  });

  it("answers a teacher and an admin", async () => {
    const ttk = await token("teacher");
    const atk = await token("admin");
    expect((await request(app).get("/api/site-bank/promotion-requests").set(A(ttk))).status).toBe(200);
    expect((await request(app).get("/api/site-bank/promotion-requests").set(A(atk))).status).toBe(200);
  });
});

describe("R93 mindmap history actor", () => {
  it("records the teacher who saves and deletes, not a body-supplied actor", async () => {
    const ttk = await token("teacher");
    const tid = idOf("teacher");
    const slug = "r93-actor-test";
    const create = await request(app).post("/api/admin/mindmap-bank").set(A(ttk))
      .send({ slug, title_fa: "تست", title_en: "Actor test", actor: "admin", graph_json: { nodes: [], edges: [] } });
    expect(create.status).toBe(200);
    const created = db.prepare("SELECT actor FROM mindmap_history WHERE slug=? AND action='create' ORDER BY id DESC LIMIT 1").get(slug);
    expect(created.actor).toBe(`teacher:${tid}`);
    const del = await request(app).delete(`/api/admin/mindmap-bank/${slug}`).set(A(ttk));
    expect(del.status).toBe(200);
    const deleted = db.prepare("SELECT actor FROM mindmap_history WHERE slug=? AND action='delete' ORDER BY id DESC LIMIT 1").get(slug);
    expect(deleted.actor).toBe(`teacher:${tid}`);
  });
});

describe("R93 practice answers", () => {
  const pickCard = () => {
    const rows = db.prepare("SELECT id, data_json FROM flashcards WHERE active=1 ORDER BY id LIMIT 400").all();
    for (const r of rows) {
      const d = JSON.parse(r.data_json || "{}");
      const type = String(d.type || "mcq").toLowerCase();
      if (type !== "mcq" || !Array.isArray(d.options) || d.options.length < 2) continue;
      const ci = d.options.findIndex((o) => o.correct === true);
      const wi = d.options.findIndex((o) => o.correct !== true);
      if (ci >= 0 && wi >= 0) return { id: r.id, ci, wi };
    }
    return null;
  };
  const xpEvents = (uid, cardId) => db.prepare("SELECT COUNT(*) n FROM xp_events WHERE user_id=? AND reason='practice' AND node_id=?").get(uid, cardId).n;

  it("grades a single-choice card on the server and counts XP once per day", async () => {
    const card = pickCard();
    expect(card).toBeTruthy();
    const ltk = await token("learner");
    const uid = idOf("learner");
    const before = xpEvents(uid, card.id);

    // Wrong option, client claims correct: no XP.
    const wrong = await request(app).post("/api/learn/practice/answer").set(A(ltk))
      .send({ cardId: card.id, sel: card.wi, correct: true, responseMs: 1000 });
    expect(wrong.status).toBe(200);
    expect(xpEvents(uid, card.id)).toBe(before);

    // Correct option: XP once.
    const right = await request(app).post("/api/learn/practice/answer").set(A(ltk))
      .send({ cardId: card.id, sel: card.ci, correct: false, responseMs: 1000 });
    expect(right.status).toBe(200);
    expect(xpEvents(uid, card.id)).toBe(before + 1);

    // Same card again, correct again: no second XP event today.
    await request(app).post("/api/learn/practice/answer").set(A(ltk))
      .send({ cardId: card.id, sel: card.ci, correct: true, responseMs: 1000 });
    expect(xpEvents(uid, card.id)).toBe(before + 1);
  });

  it("refuses a card that does not exist or is retired", async () => {
    const ltk = await token("learner");
    const missing = await request(app).post("/api/learn/practice/answer").set(A(ltk)).send({ cardId: 999999, sel: 0, correct: true });
    expect(missing.status).toBe(404);
  });
});

describe("R93 practiceVerdict", () => {
  const mcq = JSON.stringify({ type: "mcq", options: [{ correct: false }, { correct: true }, { correct: false }] });
  it("decides a single-choice card from the stored option", () => {
    expect(practiceVerdict(mcq, 1)).toBe(true);
    expect(practiceVerdict(mcq, 0)).toBe(false);
    expect(practiceVerdict(mcq, 9)).toBe(false);
    expect(practiceVerdict(mcq, null)).toBe(false);
  });
  it("leaves other card types to the client", () => {
    expect(practiceVerdict(JSON.stringify({ type: "truefalse", answer: true }), true)).toBeNull();
    expect(practiceVerdict(JSON.stringify({ type: "fill", accept_en: ["x"] }), "x")).toBeNull();
    expect(practiceVerdict("not json", 0)).toBeNull();
  });
});
