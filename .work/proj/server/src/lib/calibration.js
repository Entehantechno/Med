// ---------------------------------------------------------------------------
// calibration.js — Automatic difficulty calibration (Challenge Point Framework)
// ---------------------------------------------------------------------------
// Evidence-based, AI-free adaptive difficulty for medical learning.
//
// The Challenge Point Framework (Guadagnoli & Lee; applied to medical education
// by Guadagnoli, Morin & Dubrowski, Med Educ 2012) says learning is most
// efficient when the learner is *optimally* challenged — neither bored (too
// easy) nor overwhelmed (too hard). Each learner has an Optimal Challenge Point
// (OCP): the difficulty at which retrieval is effortful but still usually
// succeeds. Empirically that success zone sits around ~70–85%.
//
// This module estimates, deterministically and cheaply:
//   1) the learner's ABILITY in the current program (recent accuracy, adjusted
//      by response speed as a confidence proxy — a slow correct answer counts
//      for less than a fast one), and
//   2) each card's FUNCTIONAL DIFFICULTY (crowd pass-rate from question_stats,
//      blended with the card's intrinsic difficulty label), and then
//   3) a per-card CHALLENGE FIT for this learner, so lessons can order cards to
//      keep the learner inside their challenge zone (ease in, then stretch).
//
// Nothing here calls an AI model. It reads only the telemetry we already
// collect (card_attempts + question_stats).
// ---------------------------------------------------------------------------
import { db } from "../db.js";
import { getGameConfig } from "./gameconfig.js";
import { tehranDay } from "./gamify.js";

function cfg() {
  const c = getGameConfig().calibration || {};
  return {
    enabled: c.enabled !== false,
    target_success: clamp(c.target_success, 0.78, 0.5, 0.95), // centre of the challenge zone
    zone_width: clamp(c.zone_width, 0.12, 0.03, 0.25),        // half-width of the "in zone" band
    window_answers: intOr(c.window_answers, 40),              // recent answers used for ability
    min_answers: intOr(c.min_answers, 8),                     // below this we can't calibrate yet
    slow_ms: intOr(c.slow_ms, 12000),                         // an answer slower than this = low confidence
    ease_in: c.ease_in !== false,                             // start a lesson slightly easier, then ramp
  };
}
function intOr(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }
function clamp(v, d, lo, hi) { const n = Number(v); if (!Number.isFinite(n)) return d; return Math.min(hi, Math.max(lo, n)); }

// Intrinsic difficulty label → a 0..1 "hardness" prior (used before we have
// crowd data). Falls back to 0.5 (medium) for anything unlabelled.
const LABEL_HARDNESS = { easy: 0.25, medium: 0.5, hard: 0.72, brutal: 0.9 };
function intrinsicHardness(card) {
  if (typeof card?.difficulty === "number" && Number.isFinite(card.difficulty)) {
    // some cards store a 1..5 numeric difficulty
    return clamp((card.difficulty - 1) / 4, 0.5, 0, 1);
  }
  return LABEL_HARDNESS[card?.difficulty] ?? 0.5;
}

// -------- learner ability (0..1, higher = stronger) --------
// Recent accuracy with a light speed penalty. Uses a Bayesian shrink toward 0.5
// so a learner with very few answers isn't over-fit. We deliberately use the
// learner's most recent answers across the active course (program scoping via
// card_attempts alone is reliable; the older per-node join was fragile), which
// is exactly the signal the Challenge Point Framework wants: current ability.
export function learnerAbility(userId, program = null) {
  const c = cfg();
  const rows = db.prepare(`
    SELECT ca.correct, ca.response_ms
    FROM card_attempts ca
    WHERE ca.user_id = ?
    ORDER BY ca.id DESC LIMIT ?`).all(userId, c.window_answers);

  const n = rows.length;
  if (n === 0) return { ability: 0.5, answers: 0, calibrated: false };
  let scored = 0;
  for (const r of rows) {
    if (r.correct) {
      // fast correct = full credit; a very slow correct answer signals weaker
      // recall, so it earns partial credit (down to 0.6).
      const slow = r.response_ms > 0 && r.response_ms > c.slow_ms;
      scored += slow ? 0.6 : 1;
    }
  }
  const raw = scored / n;
  // Bayesian shrink toward 0.5 with a pseudo-count of 6 observations.
  const K = 6;
  const ability = (raw * n + 0.5 * K) / (n + K);
  return { ability: clamp(ability, 0.5, 0, 1), answers: n, calibrated: n >= c.min_answers };
}

// -------- card functional difficulty (0..1, higher = harder) --------
export function cardHardness(card) {
  const st = db.prepare("SELECT seen, correct FROM question_stats WHERE card_id=?").get(card.id);
  const prior = intrinsicHardness(card);
  if (!st || !st.seen) return prior;
  const crowdPass = st.correct / st.seen;          // 1 = everyone gets it right (easy)
  const crowdHardness = 1 - crowdPass;
  // Blend crowd evidence with the intrinsic prior; the more people have seen the
  // card, the more we trust the crowd (up to ~0.85 weight at 40+ views).
  const w = Math.min(0.85, st.seen / (st.seen + 8));
  return clamp(crowdHardness * w + prior * (1 - w), prior, 0, 1);
}

// -------- challenge fit for one card and one learner --------
// Predicts the learner's success probability on the card, then scores how close
// that is to the target success (centre of the challenge zone). 1 = perfect
// fit, 0 = far outside the zone. `zone` is "easy" | "in" | "hard".
export function challengeFit(ability, hardness, c = cfg()) {
  // predicted success = ability vs hardness, squashed into 0..1.
  const pSuccess = clamp(0.5 + (ability - hardness) * 0.9, 0.5, 0.02, 0.98);
  const dist = Math.abs(pSuccess - c.target_success);
  const fit = clamp(1 - dist / 0.5, 0, 0, 1);
  let zone = "in";
  if (pSuccess > c.target_success + c.zone_width) zone = "easy";
  else if (pSuccess < c.target_success - c.zone_width) zone = "hard";
  return { pSuccess, fit, zone };
}

// -------- order a lesson's cards to keep the learner in-zone --------
// Given serialized cards (each with .id and .difficulty) and the learner ability,
// return the cards reordered: ease-in (a couple of comfortable cards) then ramp
// toward the challenge zone, keeping too-hard cards from front-loading and
// discouraging the learner. Deterministic, order-stable for equal fits.
export function calibrateLessonOrder(userId, cards, program = null) {
  const c = cfg();
  if (!c.enabled || cards.length < 3) return { cards, calibration: null };
  const { ability, calibrated, answers } = learnerAbility(userId, program);
  if (!calibrated) return { cards, calibration: { calibrated: false, ability: Math.round(ability * 100), answers } };

  const scored = cards.map((card, i) => {
    const hardness = cardHardness(card);
    const { pSuccess, fit, zone } = challengeFit(ability, hardness, c);
    return { card, i, hardness, pSuccess, fit, zone };
  });

  let ordered;
  if (c.ease_in) {
    // 1) an easy-ish warm-up (highest predicted success first),
    // 2) then the best-fit challenge-zone cards,
    // 3) hardest/riskiest last so an early stumble doesn't tank momentum.
    const byEase = [...scored].sort((a, b) => b.pSuccess - a.pSuccess || a.i - b.i);
    const warmCount = Math.min(2, Math.floor(scored.length / 4));
    const warm = byEase.slice(0, warmCount);
    const warmIds = new Set(warm.map((x) => x.card.id));
    const rest = scored.filter((x) => !warmIds.has(x.card.id))
      .sort((a, b) => b.fit - a.fit || a.hardness - b.hardness || a.i - b.i);
    ordered = [...warm, ...rest];
  } else {
    ordered = [...scored].sort((a, b) => b.fit - a.fit || a.i - b.i);
  }

  const inZone = scored.filter((x) => x.zone === "in").length;
  return {
    cards: ordered.map((x) => x.card),
    calibration: {
      calibrated: true,
      ability: Math.round(ability * 100),           // 0..100 skill estimate
      answers,
      targetSuccess: Math.round(c.target_success * 100),
      inZone, total: scored.length,
      // average predicted success for THIS deck, after calibration
      avgSuccess: Math.round((scored.reduce((s, x) => s + x.pSuccess, 0) / scored.length) * 100),
    },
  };
}

// -------- a compact learner-facing calibration snapshot --------
// Used by the mascot/guide + the learner dashboard. Zone-friendly, human.
export function calibrationSnapshot(userId, program = null) {
  const c = cfg();
  const { ability, calibrated, answers } = learnerAbility(userId, program);
  const abilityPct = Math.round(ability * 100);
  // classify the learner's *recent* success zone from raw recent accuracy
  const recent = db.prepare(
    "SELECT COUNT(*) n, SUM(correct) c FROM card_attempts WHERE user_id=? AND day >= date(?, '-6 day')"
  ).get(userId, tehranDay());
  const recentAcc = recent && recent.n ? recent.c / recent.n : null;
  let zone = "unknown";
  if (recentAcc != null && (recent.n >= c.min_answers)) {
    if (recentAcc > c.target_success + c.zone_width) zone = "easy";      // too easy → push harder
    else if (recentAcc < c.target_success - c.zone_width) zone = "hard"; // too hard → ease off
    else zone = "in";                                                    // in the sweet spot
  }
  return {
    enabled: c.enabled,
    calibrated,
    ability: abilityPct,
    answers,
    zone,
    recentAccuracy: recentAcc == null ? null : Math.round(recentAcc * 100),
    targetSuccess: Math.round(c.target_success * 100),
  };
}
