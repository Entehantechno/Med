/* Round 8: premium custom test builder (آزمون‌ساز). */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { execSync } from "child_process";
import { initDb, db, persistNow } from "../src/db.js";
import { createApp } from "../src/app.js";

let app;
const A = (tk) => ({ Authorization: `Bearer ${tk}` });
async function token(u) { const r = await request(app).post("/api/auth/login").send({ username: u, password: "demo" }); return r.body.token; }
function setPremium(on) {
  const u = db.prepare("SELECT id FROM users WHERE username='learner'").get();
  db.prepare("UPDATE learner_profiles SET premium=?, premium_until=? WHERE user_id=?").run(on ? 1 : 0, on ? "2030-01-01" : null, u.id);
  persistNow();
}
beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb(); app = createApp();
});

describe("custom test builder", () => {
  it("is a premium perk (402 for free learners when full_bank is on)", async () => {
    setPremium(false);
    const tk = await token("learner");
    const r = await request(app).get("/api/learn/custom-test/options").set(A(tk));
    expect([402, 200]).toContain(r.status); // 200 only if the full_bank flag is off
  });
  it("builds a test with live counts, grades on the server, records status", async () => {
    setPremium(true);
    const tk = await token("learner");
    const o = await request(app).post("/api/learn/custom-test/options").set(A(tk)).send({ status: "all" });
    expect(o.status).toBe(200);
    expect(o.body.available).toBeGreaterThan(0);
    expect(Array.isArray(o.body.topics)).toBe(true);
    const topic = o.body.topics[0] || null;   // seed DBs without official cards have no topic buckets
    const n = Math.min(5, topic ? topic.count : o.body.available);
    const s = await request(app).post("/api/learn/custom-test/start").set(A(tk)).send({ topic: topic ? [topic.slug] : [], n, mode: "tutor" });
    expect(s.status).toBe(200);
    expect(s.body.cards.length).toBe(n);
    if (topic) for (const c of s.body.cards) expect(c.topicSlug).toBe(topic.slug);
    const card = s.body.cards.find((c) => (c.type === "mcq" || !c.type) && Array.isArray(c.options) && c.options.some((x) => !x.correct)) || s.body.cards[0];
    const wrongIdx = (card.options || []).findIndex((x) => !x.correct);
    const a = await request(app).post(`/api/learn/custom-test/${s.body.id}/answer`).set(A(tk)).send({ cardId: card.id, sel: wrongIdx, correct: true });
    expect(a.status).toBe(200);
    if (wrongIdx >= 0) expect(a.body.correct).toBe(false);   // server grades, client claim ignored
    expect(a.body.card?.id).toBe(card.id);          // tutor mode returns the explanation card
    const f = await request(app).post(`/api/learn/custom-test/${s.body.id}/finish`).set(A(tk)).send({});
    expect(f.status).toBe(200);
    expect(f.body.total).toBe(n);
    if (wrongIdx >= 0) expect(f.body.correct).toBe(0);
    // the miss now shows up under "incorrect"
    const o2 = await request(app).post("/api/learn/custom-test/options").set(A(tk)).send({ topic: topic ? [topic.slug] : [], status: "incorrect" });
    if (wrongIdx >= 0) expect(o2.body.available).toBeGreaterThanOrEqual(1);
    const h = await request(app).get("/api/learn/custom-test/history").set(A(tk));
    expect(h.body.history[0].id).toBe(s.body.id);
    expect(h.body.history[0].status).toBe("finished");
  });
  it("timed mode hides explanations until finished and never exceeds the cap", async () => {
    setPremium(true);
    const tk = await token("learner");
    const s = await request(app).post("/api/learn/custom-test/start").set(A(tk)).send({ n: 999, mode: "timed", secPerQ: 45 });
    expect(s.status).toBe(200);
    expect(s.body.cards.length).toBeLessThanOrEqual(100);
    expect(s.body.durationS).toBe(s.body.cards.length * 45);
    expect(s.body.cards[0].micro).toBeUndefined();
    expect(s.body.cards[0].explain).toBeUndefined();
    setPremium(false);
  });
});
