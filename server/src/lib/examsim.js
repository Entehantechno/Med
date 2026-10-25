/* examsim.js — Exam SIMULATOR for the pre-internship track.
   Builds a timed, exam-like block of questions and, on finish, estimates a
   pass PROBABILITY. This is PURE STATISTICS — no AI, no per-question cost.

   Pass-probability model (transparent & explainable):
   - The pre-internship (پره‌انترنی) pass mark is ~50% (score >= 50 passes).
   - We blend three signals into a single probability:
       s1 = this sim's raw accuracy
       s2 = the learner's all-time accuracy (stability / track record)
       s3 = time pressure factor (finishing comfortably in time is a good sign)
   - The blended score is mapped through a logistic curve centred on the pass
     mark so that being just above 50% gives ~50% probability and climbs fast. */
import { db, persist, persistNow } from "../db.js";
import { awardXp, getProfile } from "./gamify.js";

const PASS_MARK = 50; // percent — pre-internship passing threshold

import { cardIsKeyless } from "./cardfacets.js";

// pull N random active LEARN-track cards, optionally scoped to topic slugs and
// to a program (Duolingo-style course). Free learners draw from the curated
// path nodes only; PREMIUM learners draw from the full question bank (path +
// premium-only cards), which is the paid benefit promised on the upgrade page.
export function pickSimCards(topicSlugs, n, program = null, { premium = false } = {}) {
  let ids = [];
  const topicIdsForSlugs = (slugs) => {
    const placeholders = slugs.map(() => "?").join(",");
    return db.prepare(`SELECT id, slug FROM topics WHERE slug IN (${placeholders})`).all(...slugs);
  };
  if (topicSlugs && topicSlugs.length) {
    const topics = topicIdsForSlugs(topicSlugs);
    const topicIds = new Set(topics.map((t) => t.id));
    const placeholders = topics.map(() => "?").join(",");
    if (placeholders) {
      const nodes = db.prepare(
        `SELECT pn.card_ids FROM path_nodes pn
         JOIN topics t ON t.id = pn.topic_id
         WHERE pn.active=1 AND t.id IN (${placeholders})`
      ).all(...topicIds);
      for (const nd of nodes) { try { ids.push(...JSON.parse(nd.card_ids || "[]")); } catch { /* */ } }
    }
    if (premium) {
      // batch resolve topic slug to id
      const topicRows = program
        ? db.prepare("SELECT id, slug FROM topics WHERE program=? AND active=1").all(program)
        : db.prepare("SELECT id, slug FROM topics WHERE active=1").all();
      const slugToId = new Map(topicRows.map((t) => [t.slug, t.id]));

      // every active learn card that belongs to one of the selected topics
      const rows = db.prepare("SELECT id, data_json FROM flashcards WHERE active=1").all();
      for (const r of rows) {
        let d; try { d = JSON.parse(r.data_json); } catch { continue; }
        if (d.track !== "learn" || cardIsKeyless(d)) continue;
        const tid = slugToId.get(d.topic || "");
        if (tid && topicIds.has(tid)) ids.push(r.id);
      }
    }
    ids = [...new Set(ids)];
  }
  // fall back / top up with the active program's cards
  if (ids.length < n) {
    const extra = [];
    const nodeRows = program
      ? db.prepare(`SELECT pn.card_ids FROM path_nodes pn JOIN topics t ON t.id=pn.topic_id
          WHERE pn.active=1 AND t.active=1 AND t.program=?`).all(program)
      : db.prepare("SELECT card_ids FROM path_nodes WHERE active=1").all();
    for (const nd of nodeRows) { try { extra.push(...JSON.parse(nd.card_ids || "[]")); } catch { /* */ } }
    if (premium) {
      // batch resolve program slugs
      const allowedSlugs = program
        ? new Set(db.prepare("SELECT slug FROM topics WHERE program=? AND active=1").all(program).map((t) => t.slug))
        : null;

      // full bank: every learn card that belongs to one of the program's topics
      const rows = db.prepare("SELECT id, data_json FROM flashcards WHERE active=1").all();
      for (const r of rows) {
        let d; try { d = JSON.parse(r.data_json); } catch { continue; }
        if (d.track !== "learn" || cardIsKeyless(d)) continue;
        if (allowedSlugs && !allowedSlugs.has(d.topic || "")) continue;
        extra.push(r.id);
      }
    }
    ids = [...new Set([...ids, ...extra])];
  }
  // shuffle
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids.slice(0, n);
}

// logistic mapping: input percent (0-100) -> probability percent (0-100)
function logistic(scorePct, centre = PASS_MARK, steepness = 0.12) {
  const p = 1 / (1 + Math.exp(-steepness * (scorePct - centre)));
  return Math.round(p * 100);
}

// Estimate pass probability. Returns {prob, breakdown}
export function estimatePassProbability(userId, correct, total, timeMs, durationS) {
  const simAcc = total ? (correct / total) * 100 : 0;
  const all = db.prepare("SELECT COUNT(*) n, SUM(correct) c FROM card_attempts WHERE user_id=?").get(userId);
  const trackAcc = all && all.n ? (all.c / all.n) * 100 : simAcc; // no history → trust this sim
  // time factor: 1.0 if used <=70% of time, down to 0.85 if ran to the wire/over
  const used = durationS ? Math.min(1.5, (timeMs / 1000) / durationS) : 0.7;
  const timeFactor = used <= 0.7 ? 1 : Math.max(0.85, 1 - (used - 0.7) * 0.3);
  // weighted blend: this sim matters most, track record stabilises it
  const blended = (simAcc * 0.6 + trackAcc * 0.4) * timeFactor;
  const prob = Math.max(1, Math.min(99, logistic(blended)));
  return {
    prob,
    breakdown: {
      simAccuracy: Math.round(simAcc),
      trackAccuracy: Math.round(trackAcc),
      timeFactor: Math.round(timeFactor * 100),
      passMark: PASS_MARK,
      passed: simAcc >= PASS_MARK,
    },
  };
}

// create a new sim session (optionally scoped to the learner's active program)
export function createSim(userId, { topicSlugs = [], n = 20, durationS = 1200, program = null, premium = false }) {
  const cards = pickSimCards(topicSlugs, n, program, { premium });
  const info = db.prepare(
    `INSERT INTO exam_sims (user_id, card_ids, n, duration_s, topic_scope, status)
     VALUES (?,?,?,?,?, 'active')`
  ).run(userId, JSON.stringify(cards), cards.length, durationS,
    topicSlugs.length ? topicSlugs.join(",") : "all");
  persist();
  return { id: info.lastInsertRowid, cardIds: cards, n: cards.length, durationS };
}

// finish a sim: record score + compute probability, award a little XP
export function finishSim(userId, simId, { correct, total, timeMs }) {
  const s = db.prepare("SELECT * FROM exam_sims WHERE id=? AND user_id=?").get(simId, userId);
  if (!s) return { error: "not found" };
  if (s.status === "finished") return { error: "already finished" };
  // Bound the self-reported tally by the sim's real size (s.n / card_ids):
  // correct ≤ total ≤ number of questions actually served.
  let served = Number(s.n) || 0;
  if (!served) { try { served = JSON.parse(s.card_ids || "[]").length; } catch { served = 0; } }
  let tot = Math.max(1, parseInt(total, 10) || 1);
  if (served > 0) tot = served;                  // the sim's real size wins
  const c = Math.min(tot, Math.max(0, parseInt(correct, 10) || 0));
  const tms = Math.max(0, parseInt(timeMs, 10) || 0);
  const est = estimatePassProbability(userId, c, tot, tms, s.duration_s);
  db.prepare(
    `UPDATE exam_sims SET status='finished', correct=?, total=?, time_ms=?, pass_prob=?, finished_at=datetime('now') WHERE id=?`
  ).run(c, tot, tms, est.prob, s.id);
  // reward: 1 XP per correct answer + a small completion bonus (independent of hearts)
  const xp = c + 10;
  const profile = awardXp(userId, xp, "exam_sim", null);
  persist();
  return { prob: est.prob, breakdown: est.breakdown, xp, profile };
}

// history of finished sims for the progress screen
export function simHistory(userId, limit = 10) {
  return db.prepare(
    `SELECT id, n, correct, total, pass_prob, topic_scope, finished_at
     FROM exam_sims WHERE user_id=? AND status='finished'
     ORDER BY id DESC LIMIT ?`
  ).all(userId, limit).map((r) => ({
    id: r.id, n: r.n, correct: r.correct, total: r.total,
    accuracy: r.total ? Math.round((r.correct / r.total) * 100) : 0,
    passProb: r.pass_prob, scope: r.topic_scope, finishedAt: r.finished_at,
  }));
}

export { PASS_MARK, getProfile };
