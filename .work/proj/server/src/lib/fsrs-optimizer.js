/* fsrs-optimizer.js — Fit FSRS-6 parameters to REAL review history.

   Research basis (open-spaced-repetition / Anki FSRS optimizer):
   • Optimization fits the 21 FSRS weights to each card's ordered sequence of
     {grade, delta_t} reviews so the scheduler matches how THIS population
     actually forgets.
   • The evaluation metric is LOG LOSS: for every non-first review we predict the
     recall probability R (from the memory state built by all prior reviews of
     that card) and compare it to the observed outcome (recalled = grade>=2).
     Lower log loss = better-calibrated predictions. RMSE is reported too.
   • Needs enough data (~1000 reviews) to beat the population defaults; below
     that we refuse to optimize and keep the defaults (documented behaviour).
   • Re-optimizing periodically (monthly / when reviews double) is enough — this
     is an admin-triggered batch job, never per-review.

   Implementation note: the sql.js/WASM runtime can't run PyTorch/scipy, so we
   use a dependency-free COORDINATE-DESCENT hill-climb with shrinking steps and
   a couple of random restarts. It reuses the exact scheduler math in fsrs.js so
   the fitted params behave identically at review time. It's deterministic given
   the same data (seeded RNG) and fast enough for a few thousand reviews. */
import { db } from "../db.js";
import { forgetting, schedule } from "./fsrs.js";
import { DEFAULT_GAME_CONFIG } from "./gameconfig.js";

export const MIN_REVIEWS_TO_OPTIMIZE = 400; // lowered vs Anki's ~1000 so smaller
// deployments can still benefit; below this we keep defaults and say so.

/* Reasonable bounds for each of the 21 weights (mirrors py-fsrs clamp ranges).
   Keeps the optimizer from wandering into degenerate territory. */
const BOUNDS = [
  [0.01, 30], [0.01, 30], [0.05, 30], [0.1, 30],   // w0..3 initial stabilities
  [1, 10], [0.05, 5], [0.05, 5], [0, 0.9],          // w4..7 difficulty
  [0, 4], [0, 0.8], [0.01, 4], [0.5, 5],            // w8..11 stability-recall
  [0.01, 0.5], [0.01, 1], [0.5, 6], [0, 1],         // w12..15
  [1, 6], [0, 2], [0, 2], [0, 0.8], [0.05, 0.8],    // w16..20 (w20 = decay)
];

/* Load per-card review sequences for training.
   Returns [ { reviews: [{grade, delta_t}, ...] }, ... ] ordered chronologically. */
export function loadTrainingItems({ userId = null, limitCards = 5000 } = {}) {
  const where = userId ? "WHERE user_id = ?" : "";
  const rows = db.prepare(
    `SELECT user_id, card_id, grade, elapsed_days, created_at
     FROM srs_review_log ${where}
     ORDER BY user_id, card_id, id ASC`
  ).all(...(userId ? [userId] : []));

  const byKey = new Map();
  for (const r of rows) {
    const key = r.user_id + ":" + r.card_id;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ grade: r.grade, delta_t: Math.max(0, r.elapsed_days | 0) });
  }
  const items = [];
  for (const seq of byKey.values()) {
    if (seq.length >= 2) items.push({ reviews: seq }); // need >=2 to have a prediction
    if (items.length >= limitCards) break;
  }
  return items;
}

export function reviewCount(userId = null) {
  const where = userId ? "WHERE user_id = ?" : "";
  const r = db.prepare(`SELECT COUNT(*) c FROM srs_review_log ${where}`).get(...(userId ? [userId] : []));
  return r ? r.c : 0;
}

/* Evaluate a parameter set on the training items → { logloss, rmse, count }.
   We walk each card: for every review after the first, predict R from the memory
   state accumulated so far, then compare to the observed recall (grade>=2). */
export function evaluateParams(params, items, baseCfg) {
  const cfg = { ...baseCfg, params };
  let sumLoss = 0, sumSq = 0, n = 0;
  const EPS = 1e-6;
  for (const item of items) {
    let prev = null; // { stability, difficulty }
    for (let i = 0; i < item.reviews.length; i++) {
      const { grade, delta_t } = item.reviews[i];
      if (prev && prev.stability > 0 && i > 0) {
        // predicted recall probability BEFORE this review
        let p = forgetting(Math.max(0, delta_t), prev.stability, params);
        p = Math.min(1 - EPS, Math.max(EPS, p));
        const y = grade >= 2 ? 1 : 0; // observed: recalled?
        sumLoss += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
        sumSq += (p - y) * (p - y);
        n++;
      }
      // advance the memory state through this review
      const r = schedule(prev, grade, i === 0 ? 0 : delta_t, cfg);
      prev = { stability: r.stability, difficulty: r.difficulty };
    }
  }
  if (!n) return { logloss: Infinity, rmse: Infinity, count: 0 };
  return { logloss: sumLoss / n, rmse: Math.sqrt(sumSq / n), count: n };
}

const clampW = (v, i) => Math.min(BOUNDS[i][1], Math.max(BOUNDS[i][0], v));

/* Small deterministic PRNG (mulberry32) so optimization is reproducible. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Coordinate-descent hill-climb with shrinking steps + random restarts.
   Returns { params, logloss, rmse }. Pure JS, no deps. */
export function optimizeParams(items, baseCfg, { iterations = 6, restarts = 2 } = {}) {
  const start = (baseCfg.params && baseCfg.params.length === 21)
    ? baseCfg.params.slice()
    : DEFAULT_GAME_CONFIG.srs.params.slice();

  let best = start.map((v, i) => clampW(v, i));
  let bestEval = evaluateParams(best, items, baseCfg);
  const rand = rng(1337);

  const climb = (initial) => {
    let cur = initial.slice();
    let curEval = evaluateParams(cur, items, baseCfg);
    let step = 0.5; // fraction of each param's range used as the probe step
    for (let it = 0; it < iterations; it++) {
      let improvedThisPass = false;
      for (let i = 0; i < 21; i++) {
        const range = BOUNDS[i][1] - BOUNDS[i][0];
        const delta = range * step * 0.15;
        for (const dir of [+1, -1]) {
          const cand = cur.slice();
          cand[i] = clampW(cur[i] + dir * delta, i);
          if (cand[i] === cur[i]) continue;
          const e = evaluateParams(cand, items, baseCfg);
          if (e.logloss < curEval.logloss - 1e-9) {
            cur = cand; curEval = e; improvedThisPass = true;
          }
        }
      }
      if (!improvedThisPass) step *= 0.5; // shrink and try finer moves
      if (step < 0.02) break;
    }
    return { params: cur, eval: curEval };
  };

  // primary climb from current/default params
  let r0 = climb(best);
  if (r0.eval.logloss < bestEval.logloss) { best = r0.params; bestEval = r0.eval; }

  // random restarts (perturb the defaults) to escape shallow local minima
  for (let s = 0; s < restarts; s++) {
    const perturbed = start.map((v, i) => {
      const range = BOUNDS[i][1] - BOUNDS[i][0];
      return clampW(v + (rand() - 0.5) * range * 0.3, i);
    });
    const r = climb(perturbed);
    if (r.eval.logloss < bestEval.logloss) { best = r.params; bestEval = r.eval; }
  }

  return {
    params: best.map((v) => Math.round(v * 1e4) / 1e4),
    logloss: bestEval.logloss,
    rmse: bestEval.rmse,
    count: bestEval.count,
  };
}

/* High-level: analyse the current data + params without changing anything.
   Returns everything the admin panel needs to decide whether to optimize. */
export function analyzeFsrs(baseCfg) {
  const total = reviewCount();
  const items = loadTrainingItems();
  const cur = evaluateParams(baseCfg.params, items, baseCfg);
  return {
    totalReviews: total,
    trainableCards: items.length,
    minReviews: MIN_REVIEWS_TO_OPTIMIZE,
    ready: total >= MIN_REVIEWS_TO_OPTIMIZE && items.length >= 5,
    current: { logloss: round(cur.logloss), rmse: round(cur.rmse), evaluated: cur.count },
    params: baseCfg.params,
  };
}

function round(x) { return Number.isFinite(x) ? Math.round(x * 1e4) / 1e4 : null; }
