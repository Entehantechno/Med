/* practice.js — Smart Practice Hub (UWorld-style targeted weak-area training).
   Aggregates the learner's own data into ONE targeted session, mixing four
   sources by admin-configurable weights:
     • weak     — cards from the learner's lowest-accuracy topics
     • mistakes — cards recently answered wrong (not since corrected)
     • due      — spaced-repetition cards due today
     • hardest  — globally hardest cards (crowd) the learner hasn't mastered
   The value of a missed question is realized by turning it into the next rep. */
import { db } from "../db.js";
import { getProfile, tehranDay } from "./gamify.js";
import { getGameConfig } from "./gameconfig.js";
import { mistakeCardIds } from "./analytics.js";
import { dueCards, dueCount } from "./srs.js";
import { activeProgramFor } from "./programs.js";

// card ids that belong to the learner's ACTIVE program (so practice stays scoped)
function programCardIds(userId) {
  const program = activeProgramFor(userId);
  const nodes = db.prepare(`
    SELECT pn.card_ids FROM path_nodes pn JOIN topics t ON t.id = pn.topic_id
    WHERE pn.active=1 AND t.active=1 AND t.program=?`).all(program);
  const set = new Set();
  for (const n of nodes) { try { JSON.parse(n.card_ids || "[]").forEach((id) => set.add(id)); } catch { /* */ } }
  return set;
}

// weak-topic node list (lowest accuracy, min answers) → their card ids
function weakCardIds(userId, cfg) {
  const weak = db.prepare(`
    SELECT ca.node_id, COUNT(*) n, SUM(ca.correct) c
    FROM card_attempts ca WHERE ca.user_id=? AND ca.node_id IS NOT NULL
    GROUP BY ca.node_id HAVING n >= ? AND (CAST(SUM(ca.correct) AS REAL)/COUNT(*))*100 < ?
    ORDER BY (CAST(SUM(ca.correct) AS REAL)/COUNT(*)) ASC, n DESC`).all(userId, cfg.min_answers, cfg.weak_accuracy);
  const ids = [];
  for (const w of weak) {
    const node = db.prepare("SELECT card_ids FROM path_nodes WHERE id=?").get(w.node_id);
    if (node) { try { JSON.parse(node.card_ids || "[]").forEach((id) => ids.push(id)); } catch { /* */ } }
  }
  return ids;
}

// globally hardest cards (low crowd pass-rate) the learner hasn't mastered (5★)
function hardestCardIds(userId, limit = 20) {
  const rows = db.prepare(`
    SELECT card_id, seen, correct FROM question_stats
    WHERE seen >= 3 ORDER BY (CAST(correct AS REAL)/seen) ASC LIMIT ?`).all(limit * 2);
  return rows.map((r) => r.card_id);
}

// A weighted round-robin merge that respects the admin mix, dedupes, and scopes
// to the active program. Returns { cardIds, sources } (sources tags each id).
export function buildSession(userId) {
  const cfg = getGameConfig().practice;
  const size = cfg.session_size;
  const inProgram = programCardIds(userId);
  const keep = (id) => inProgram.size === 0 || inProgram.has(id);

  const pools = {
    weak: weakCardIds(userId, cfg).filter(keep),
    mistakes: mistakeCardIds(userId, 40).filter(keep),
    due: dueCards(userId, 40).map((c) => c.id ?? c).filter(keep),
    hardest: hardestCardIds(userId, 40).filter(keep),
  };
  const mix = cfg.mix || { weak: 4, mistakes: 3, due: 2, hardest: 1 };
  const order = ["weak", "mistakes", "due", "hardest"];
  // build a weighted draw sequence, e.g. [weak,weak,weak,weak,mistakes,mistakes,mistakes,...]
  const seq = [];
  for (const k of order) for (let i = 0; i < (mix[k] || 0); i++) seq.push(k);

  const chosen = [];
  const seen = new Set();
  const idxByPool = { weak: 0, mistakes: 0, due: 0, hardest: 0 };
  const sources = {};
  let guard = 0;
  while (chosen.length < size && guard < size * 12) {
    guard++;
    const k = seq[chosen.length % seq.length] || "weak";
    // try the current pool, else fall through to any other pool with items
    let picked = null, from = null;
    for (const cand of [k, ...order]) {
      const pool = pools[cand];
      while (idxByPool[cand] < pool.length) {
        const id = pool[idxByPool[cand]++];
        if (!seen.has(id)) { picked = id; from = cand; break; }
      }
      if (picked != null) break;
    }
    if (picked == null) break;   // all pools exhausted
    seen.add(picked); chosen.push(picked); sources[picked] = from;
  }
  return { cardIds: chosen, sources };
}

// Hub landing summary: what's available to practice + weak-topic report.
export function practiceSummary(userId, lang = "fa") {
  const cfg = getGameConfig().practice;
  const inProgram = programCardIds(userId);
  const keep = (id) => inProgram.size === 0 || inProgram.has(id);
  const weakTopics = db.prepare(`
    SELECT ca.node_id, pn.title_fa, pn.title_en, COUNT(*) n, SUM(ca.correct) c
    FROM card_attempts ca LEFT JOIN path_nodes pn ON pn.id = ca.node_id
    WHERE ca.user_id=? AND ca.node_id IS NOT NULL
    GROUP BY ca.node_id HAVING n >= ? AND (CAST(SUM(ca.correct) AS REAL)/COUNT(*))*100 < ?
    ORDER BY (CAST(SUM(ca.correct) AS REAL)/COUNT(*)) ASC, n DESC LIMIT 6`).all(userId, cfg.min_answers, cfg.weak_accuracy);
  const counts = {
    weak: weakCardIds(userId, cfg).filter(keep).length,
    mistakes: mistakeCardIds(userId, 100).filter(keep).length,
    due: dueCount(userId),
    hardest: hardestCardIds(userId, 40).filter(keep).length,
  };
  return {
    enabled: cfg.enabled,
    sessionSize: cfg.session_size,
    counts,
    hasData: counts.weak + counts.mistakes + counts.due + counts.hardest > 0,
    weakTopics: weakTopics.map((w) => ({
      node_id: w.node_id,
      title: lang === "fa" ? (w.title_fa || w.title_en) : (w.title_en || w.title_fa),
      answered: w.n, accuracy: Math.round((w.c / w.n) * 100),
    })),
  };
}
