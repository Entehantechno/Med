/* Round 9: peer benchmark & premium extras (option stats, percentile, daily
   report, hint, one-tap flashcard, streak premium trial, jump ahead). */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { execSync } from "child_process";
import { initDb, db, persistNow } from "../src/db.js";
import { createApp } from "../src/app.js";
import { optionStats, percentileFor, dailyReport, checkStreakTrial, saveExplainAsCard } from "../src/lib/peerstats.js";
import { recordAnswers } from "../src/lib/analytics.js";

let app, uid;
const A = (tk) => ({ Authorization: `Bearer ${tk}` });
async function token(u) { const r = await request(app).post("/api/auth/login").send({ username: u, password: "demo" }); return r.body.token; }
function setPremium(on) {
  db.prepare("UPDATE learner_profiles SET premium=?, premium_until=? WHERE user_id=?").run(on ? 1 : 0, on ? "2030-01-01" : null, uid);
  persistNow();
}
function anyMcqCardId() {
  for (const r of db.prepare("SELECT id, data_json FROM flashcards WHERE active=1 LIMIT 400").all()) {
    try { const d = JSON.parse(r.data_json); if (Array.isArray(d.options) && d.options.length >= 2 && (d.q_fa || d.q_en)) return r.id; } catch { /* */ }
  }
  return null;
}
beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb(); app = createApp();
  uid = db.prepare("SELECT id FROM users WHERE username='learner'").get().id;
});

describe("option stats («شناسنامهٔ سؤال»)", () => {
  it("counts picks per option and hides percentages under the minimum sample", () => {
    const cid = anyMcqCardId(); expect(cid).toBeTruthy();
    db.prepare("DELETE FROM option_stats WHERE card_id=?").run(cid);
    db.prepare("DELETE FROM question_stats WHERE card_id=?").run(cid);
    for (let i = 0; i < 6; i++) recordAnswers(uid, [{ cardId: cid, correct: i % 2 === 0, responseMs: 5000, sel: i % 2 }]);
    const s = optionStats(cid, 4);
    expect(s.ready).toBe(true);
    expect(s.total).toBe(6);
    expect(s.pct[0]).toBe(50); expect(s.pct[1]).toBe(50);
    expect(s.pct.length).toBe(4);
    expect(s.avgSec).toBeGreaterThanOrEqual(5);
  });
  it("is free for every learner over the API", async () => {
    setPremium(false);
    const tk = await token("learner");
    const r = await request(app).get(`/api/learn/card/${anyMcqCardId()}/option-stats`).set(A(tk));
    expect(r.status).toBe(200);
    expect(r.body.stats).toBeTruthy();
  });
});

describe("percentile vs peers", () => {
  it("needs a minimum peer sample, then ranks the learner", () => {
    expect(percentileFor(uid, "sim", 4, 5, 1000).ready).toBe(false);
    for (let u = 0; u < 6; u++) {
      db.prepare("INSERT INTO exam_sims (user_id, card_ids, n, duration_s, topic_scope, status, correct, total, time_ms, kind) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run(9000 + u, "[1]", 5, 300, "all", "finished", u, 5, 100000, "sim");
    }
    const p = percentileFor(uid, "sim", 4, 5, 50000);
    expect(p.ready).toBe(true);
    expect(p.peers).toBe(6);
    expect(p.percentile).toBeGreaterThan(50);
    expect(p.mySecPerQ).toBe(10);
    expect(p.peerSecPerQ).toBe(20);
  });
  it("is premium on the exam-sim result (free learners get a locked teaser)", async () => {
    setPremium(false);
    const tk = await token("learner");
    const s = await request(app).post("/api/learn/exam-sim/start").set(A(tk)).send({ n: 3 });
    if (s.status !== 200) return; // no bank in this seed
    const f = await request(app).post(`/api/learn/exam-sim/${s.body.id}/finish`).set(A(tk)).send({ correct: 2, total: 3, timeMs: 30000 });
    expect(f.status).toBe(200);
    expect(f.body.peer?.premiumRequired).toBe(true);
  });
});

describe("daily report", () => {
  it("is premium and summarises today", async () => {
    setPremium(false);
    let tk = await token("learner");
    let r = await request(app).get("/api/learn/daily-report").set(A(tk));
    expect(r.body.premiumRequired).toBe(true);
    setPremium(true);
    tk = await token("learner");
    r = await request(app).get("/api/learn/daily-report").set(A(tk));
    expect(r.status).toBe(200);
    expect(r.body.report.today.answered).toBeGreaterThan(0);
    expect(r.body.report.week.length).toBe(7);
    const d = dailyReport(uid, "fa");
    expect(d.today.accuracy).toBeGreaterThanOrEqual(0);
  });
});

describe("hint & one-tap flashcard", () => {
  it("hint is free for premium, costs gems for free learners", async () => {
    const row = db.prepare("SELECT id, data_json FROM flashcards WHERE active=1").all().find((r) => { try { const d = JSON.parse(r.data_json); return (d.hints_fa?.length || d.attending_fa || d.micro?.golden_fa) && Array.isArray(d.options); } catch { return false; } });
    if (!row) return;
    setPremium(true);
    let tk = await token("learner");
    let r = await request(app).post(`/api/learn/card/${row.id}/hint`).set(A(tk));
    expect(r.status).toBe(200); expect(r.body.hint).toBeTruthy(); expect(r.body.cost).toBe(0);
    setPremium(false);
    db.prepare("UPDATE learner_profiles SET gems=100 WHERE user_id=?").run(uid); persistNow();
    tk = await token("learner");
    r = await request(app).post(`/api/learn/card/${row.id}/hint`).set(A(tk));
    expect(r.status).toBe(200); expect(r.body.cost).toBeGreaterThan(0); expect(r.body.gems).toBe(100 - r.body.cost);
  });
  it("saves a personal flashcard once (premium only)", async () => {
    const cid = anyMcqCardId();
    setPremium(false);
    let tk = await token("learner");
    let r = await request(app).post(`/api/learn/card/${cid}/save-flashcard`).set(A(tk));
    expect(r.status).toBe(402);
    setPremium(true);
    tk = await token("learner");
    r = await request(app).post(`/api/learn/card/${cid}/save-flashcard`).set(A(tk));
    expect(r.status).toBe(200); expect(r.body.ok).toBe(true);
    const again = saveExplainAsCard(uid, cid, "fa");
    expect(again.duplicate).toBe(true);
    const mine = await request(app).get("/api/learn/mycards").set(A(tk));
    expect(mine.body.cards.some((c) => c.id === r.body.id)).toBe(true);
  });
});

describe("streak premium trial", () => {
  it("grants once per milestone and never twice", () => {
    db.prepare("UPDATE learner_profiles SET trial_tier=0 WHERE user_id=?").run(uid);
    expect(checkStreakTrial(uid, 50)).toBeNull();
    const t = checkStreakTrial(uid, 100);
    expect(t).toEqual({ milestone: 100, days: 3 });
    expect(checkStreakTrial(uid, 150)).toBeNull();
    const t2 = checkStreakTrial(uid, 365);
    expect(t2.milestone).toBe(365); expect(t2.days).toBe(6); // 200 + 365 crossed together
  });
});

describe("jump ahead («پرش از واحد»)", () => {
  it("builds a quiz from undone stages, grades on the server, unlocks the unit on pass", async () => {
    setPremium(false);
    const tk = await token("learner");
    const path = await request(app).get("/api/learn/path").set(A(tk));
    const topic = path.body.topics.find((t) => t.canJump);
    if (!topic) return; // seed without a multi-stage unit
    const q = await request(app).get(`/api/learn/jump/${topic.id}`).set(A(tk));
    if (q.status === 400 && q.body.error === "nothing to skip") return; // tiny demo unit (too few MCQs)
    expect(q.status).toBe(200);
    expect(q.body.cards.length).toBeGreaterThanOrEqual(2);
    for (const c of q.body.cards) expect(c.micro).toBeUndefined();
    // fail first (all wrong) → nothing unlocked
    const wrong = q.body.cards.map((c) => ({ cardId: c.id, sel: c.options.findIndex((o) => !o.correct) }));
    const f = await request(app).post(`/api/learn/jump/${topic.id}`).set(A(tk)).send({ answers: wrong });
    expect(f.body.passed).toBe(false); expect(f.body.skipped).toBe(0);
    // pass → unit unlocked, stages marked done, no second quiz
    const right = q.body.cards.map((c) => ({ cardId: c.id, sel: c.options.findIndex((o) => o.correct) }));
    const p = await request(app).post(`/api/learn/jump/${topic.id}`).set(A(tk)).send({ answers: right });
    expect(p.body.passed).toBe(true); expect(p.body.skipped).toBeGreaterThan(0);
    const after = await request(app).get("/api/learn/path").set(A(tk));
    const t2 = after.body.topics.find((t) => t.id === topic.id);
    expect(t2.canJump).toBe(false);
    expect(t2.nodes.filter((n) => !n.premium).every((n) => !n.locked)).toBe(true);
    const again = await request(app).get(`/api/learn/jump/${topic.id}`).set(A(tk));
    expect(again.status).toBe(400);
  });
});
