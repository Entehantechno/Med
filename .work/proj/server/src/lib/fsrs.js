/* fsrs.js — Free Spaced Repetition Scheduler (FSRS-6), a faithful implementation
   of the open-source DSR memory model that replaced SM-2 as Anki's default.

   Three per-card values:
     • Difficulty (D)   1..10 — how hard the card is for this learner (mean-reverting)
     • Stability  (S)   days  — time for recall probability to fall 100% → desired retention
     • Retrievability(R) 0..1 — predicted recall probability right now

   Grades (Anki-style): 1=Again, 2=Hard, 3=Good, 4=Easy.
   Scheduling target: review each card when R drops to the desired retention.

   Reference: open-spaced-repetition/py-fsrs, FSRS-5/6 formulas. Pure JS, no deps. */

// FSRS-6 curve decay parameter lives at w[20]. FACTOR is derived so that
// R = 0.9 exactly when elapsed time == stability (by construction).
function decayOf(w) { return -Math.max(0.001, w[20] ?? 0.2); }
function factorOf(w) { const d = decayOf(w); return Math.pow(0.9, 1 / d) - 1; }

/* Retrievability after `elapsedDays` for a memory of stability S (power curve). */
export function forgetting(elapsedDays, stability, w) {
  if (stability <= 0) return 0;
  const decay = decayOf(w), factor = factorOf(w);
  return Math.pow(1 + factor * (elapsedDays / stability), decay);
}

/* Interval (days) to reach `retention` for a card of stability S. */
export function intervalForRetention(stability, retention, w) {
  const decay = decayOf(w), factor = factorOf(w);
  const days = (stability / factor) * (Math.pow(retention, 1 / decay) - 1);
  return days;
}

const clampD = (d) => Math.min(10, Math.max(1, d));

/* ---- initialization (first review of a brand-new card) ---- */
function initStability(w, grade) {
  // w[0..3] are the initial stabilities for Again/Hard/Good/Easy.
  return Math.max(0.1, w[Math.min(3, Math.max(0, grade - 1))]);
}
function initDifficulty(w, grade) {
  // FSRS-5/6: D0(G) = w4 - e^(w5*(G-1)) + 1, clamped to [1,10]
  return clampD(w[4] - Math.exp(w[5] * (grade - 1)) + 1);
}

/* ---- difficulty update (mean-reverting → no "ease hell") ---- */
function nextDifficulty(w, D, grade) {
  const deltaD = -w[6] * (grade - 3);
  const Dp = D + linearDamping(deltaD, D);        // linear damping (FSRS-5)
  // mean reversion toward the difficulty of an "Easy" first review
  const D0easy = initDifficulty(w, 4);
  return clampD(w[7] * D0easy + (1 - w[7]) * Dp);
}
function linearDamping(deltaD, D) { return (deltaD * (10 - D)) / 9; }

/* ---- stability updates ---- */
// successful recall (grade >= 2): stability grows; growth is larger when R is low
function stabilityAfterRecall(w, D, S, R, grade) {
  const hardPenalty = grade === 2 ? w[15] : 1;
  const easyBonus = grade === 4 ? w[16] : 1;
  const inc =
    Math.exp(w[8]) *
    (11 - D) *
    Math.pow(S, -w[9]) *
    (Math.exp(w[10] * (1 - R)) - 1) *
    hardPenalty *
    easyBonus;
  return S * (1 + inc);
}
// lapse (grade == 1): post-lapse stability (moderate, not a full reset)
function stabilityAfterForget(w, D, S, R) {
  const postLapse =
    w[11] *
    Math.pow(D, -w[12]) *
    (Math.pow(S + 1, w[13]) - 1) *
    Math.exp(w[14] * (1 - R));
  // never larger than the pre-lapse stability
  return Math.min(postLapse, S);
}
// same-day (short-term) review stability bump (FSRS-5 w[17], w[18])
function shortTermStability(w, S, grade) {
  const sinc = Math.exp(w[17] * (grade - 3 + w[18])) * Math.pow(S, -w[19]);
  return S * (grade >= 3 ? Math.max(sinc, 1) : sinc);
}

/* ---- public API ----
   schedule(prev, grade, elapsedDays, cfg) → { stability, difficulty, R, intervalDays }
   `prev` = { stability, difficulty } (0/0 for a new card). */
export function schedule(prev, grade, elapsedDays, cfg) {
  const w = cfg.params;
  const retention = cfg.desired_retention;
  const g = Math.min(4, Math.max(1, grade));
  let S, D;

  const isNew = !prev || !prev.stability || prev.stability <= 0;
  if (isNew) {
    S = initStability(w, g);
    D = initDifficulty(w, g);
  } else {
    D = nextDifficulty(w, prev.difficulty, g);
    const R = forgetting(Math.max(0, elapsedDays), prev.stability, w);
    if (elapsedDays < 1) {
      // same-day review → short-term stability model
      S = shortTermStability(w, prev.stability, g);
    } else if (g === 1) {
      S = stabilityAfterForget(w, D, prev.stability, R);
    } else {
      S = stabilityAfterRecall(w, D, prev.stability, R, g);
    }
  }
  S = Math.max(0.1, S);
  let intervalDays = intervalForRetention(S, retention, w);
  intervalDays = Math.min(cfg.maximum_interval, Math.max(1, Math.round(intervalDays)));
  const Rnow = forgetting(0, S, w); // 1.0 right after review
  return { stability: S, difficulty: D, R: Rnow, intervalDays };
}

/* Preview the next interval (days) for EACH grade button — the signature FSRS UX
   ("Again 1d · Hard 3d · Good 8d · Easy 20d"). */
export function previewIntervals(prev, elapsedDays, cfg) {
  const out = {};
  for (let g = 1; g <= 4; g++) out[g] = schedule(prev, g, elapsedDays, cfg).intervalDays;
  return out;
}
