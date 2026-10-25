/* Round 9 audit: every learner-facing feature has an admin kill-switch, and
   the server honours it (403 when off, works when on). Also smoke-tests every
   learner GET route so nothing silently 500s. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { execSync } from "child_process";
import { initDb, db, persistNow } from "../src/db.js";
import { createApp } from "../src/app.js";
import { setFlag, DEFAULT_FLAGS, allFlags } from "../src/lib/flags.js";

let app, tk, uid;
const A = () => ({ Authorization: `Bearer ${tk}` });
beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb(); app = createApp();
  const r = await request(app).post("/api/auth/login").send({ username: "learner", password: "demo" });
  tk = r.body.token;
  uid = db.prepare("SELECT id FROM users WHERE username='learner'").get().id;
  db.prepare("UPDATE learner_profiles SET premium=1, premium_until='2030-01-01' WHERE user_id=?").run(uid);
  persistNow();
});
afterAll(() => { for (const [k, , , def] of DEFAULT_FLAGS) setFlag(k, def !== 0); });

// flag → representative GET route(s) that must be gated by it
const GATED = {
  bank_browse: ["/api/learn/browse"],
  custom_test: ["/api/learn/custom-test/options", "/api/learn/custom-test/history"],
  summaries: ["/api/learn/summaries"],
  crowd_insights: ["/api/learn/crowd/hardest"],
  ranking: ["/api/learn/ranking"],
  ramp_event: ["/api/learn/event"],
  achievements: ["/api/learn/achievements"],
  quests: ["/api/learn/quests"],
  notes: ["/api/learn/notes"],
  flagged_review: ["/api/learn/flagged"],
  library: ["/api/learn/library"],
  streak_wager: ["/api/learn/wager"],
  monthly_quest: ["/api/learn/monthly"],
  streak_revival: ["/api/learn/revival"],
  mistakes_hub: ["/api/learn/mistakes"],
  progress: ["/api/learn/analytics"],
  option_stats: ["/api/learn/card/1/option-stats"],
  daily_report: ["/api/learn/daily-report"],
  jump_ahead: ["/api/learn/jump/1"],
  exam_sim: ["/api/learn/exam-sim/history"],
  srs_review: ["/api/learn/review"],
  smart_practice: ["/api/learn/practice"],
  placement: ["/api/learn/placement"],
  study_plan: ["/api/learn/study-plan"],
  mindmap: ["/api/learn/mindmap/topics"],
  mnemonics: ["/api/learn/mnemonics"],
  community: ["/api/learn/community"],
  friends: ["/api/learn/friends"],
  leagues: ["/api/learn/league"],
  referral: ["/api/learn/referral"],
  checkpoint: ["/api/learn/checkpoints"],
  mastery: ["/api/learn/mastery"],
  certificates: ["/api/learn/certificates"],
  dx_challenge: ["/api/learn/dx/daily"],
  learner_cards: ["/api/learn/mycards"],
  onboarding: ["/api/learn/onboarding"],
  calm_mode: ["/api/learn/calm"],
  anon_ranking: ["/api/learn/anon"],
};

describe("admin feature flags", () => {
  it("every DEFAULT_FLAG is persisted and exposed to the client", async () => {
    const keys = new Set(allFlags().map((f) => f.key));
    for (const [k] of DEFAULT_FLAGS) expect(keys.has(k)).toBe(true);
    const r = await request(app).get("/api/flags").set(A());
    expect(r.status).toBe(200);
    for (const [k] of DEFAULT_FLAGS) expect(k in r.body.flags).toBe(true);
  });
  for (const [flag, routes] of Object.entries(GATED)) {
    it(`flag «${flag}» switches its routes off (403) and on again`, async () => {
      expect(DEFAULT_FLAGS.some(([k]) => k === flag)).toBe(true);
      setFlag(flag, false);
      for (const url of routes) {
        const r = await request(app).get(url).set(A());
        expect(r.status, `${url} should be 403 when ${flag} is off, got ${r.status}`).toBe(403);
      }
      setFlag(flag, true);
      for (const url of routes) {
        const r = await request(app).get(url).set(A());
        expect(r.status, `${url} with ${flag} on returned ${r.status}`).not.toBe(403);
        expect(r.status, `${url} 5xx`).toBeLessThan(500);
      }
    });
  }
  it("hint / save-flashcard / premium-trial honour their flags", async () => {
    const { peerCfg } = await import("../src/lib/peerstats.js");
    setFlag("hint", false); expect(peerCfg().hint).toBe(false);
    setFlag("hint", true); expect(peerCfg().hint).not.toBe(false);
    setFlag("save_flashcard", false);
    let r = await request(app).post("/api/learn/card/1/save-flashcard").set(A());
    expect(r.status).toBe(403);
    setFlag("save_flashcard", true);
    setFlag("premium_trial", false); expect(peerCfg().trial_days).toBe(0);
    setFlag("premium_trial", true); expect(peerCfg().trial_days).toBeGreaterThan(0);
    setFlag("peer_percentile", false); expect(peerCfg().percentile).toBe(false);
    setFlag("peer_percentile", true);
  });
});

describe("learner route smoke (no 5xx anywhere)", () => {
  const urls = [
    "/api/learn/home", "/api/learn/profile", "/api/learn/path", "/api/learn/streak", "/api/learn/daily",
    "/api/learn/chests", "/api/learn/shop", "/api/learn/notifications", "/api/learn/programs", "/api/learn/srs/stats",
    "/api/learn/ads?slot=home", "/api/learn/heart", "/api/learn/tournament", "/api/learn/ranking/province",
    "/api/learn/exam-sim/history", "/api/learn/custom-test/history", "/api/learn/daily-report",
    "/api/learn/vpatient", "/api/learn/calibration", "/api/learn/social", "/api/learn/legendary/1",
    "/api/learn/browse/suggest?q=a", "/api/learn/crowd/hardest", "/api/learn/summaries", "/api/learn/library",
    "/api/learn/mistakes", "/api/learn/flagged", "/api/learn/analytics", "/api/learn/achievements", "/api/learn/quests",
    "/api/learn/wager", "/api/learn/monthly", "/api/learn/revival", "/api/learn/event", "/api/learn/notes",
    "/api/learn/mycards", "/api/learn/mycards/practice", "/api/learn/placement", "/api/learn/study-plan",
    "/api/learn/mindmap/topics", "/api/learn/mnemonics", "/api/learn/community", "/api/learn/friends",
    "/api/learn/league", "/api/learn/referral", "/api/learn/checkpoints", "/api/learn/mastery", "/api/learn/certificates",
    "/api/learn/dx/daily", "/api/learn/onboarding", "/api/learn/calm", "/api/learn/anon", "/api/learn/review",
    "/api/learn/practice", "/api/learn/premium", "/api/learn/jump/1", "/api/learn/card/1/option-stats",
  ];
  for (const url of urls) {
    it(`GET ${url}`, async () => {
      const r = await request(app).get(url).set(A());
      expect(r.status, `${url} → ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`).toBeLessThan(500);
    });
  }
});
