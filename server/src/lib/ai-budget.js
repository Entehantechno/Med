/* R92: per-account budget for turns that call the paid AI provider (Dr Tutor messages and
   virtual-patient replies). The general API limiter counts 1200 requests per account per
   15 minutes, which lets one account drive ~80 model calls a minute. These turns get their
   own, much smaller window. Counters are per process (like the translation budget); the
   limits are generous for a real study session and stop a loop or a script. */

const WINDOW_MS = 10 * 60 * 1000;

const LIMITS = {
  // Dr Tutor: about one question every 20 seconds.
  tutor: { env: "AI_TUTOR_TURNS_PER_10MIN", fallback: 30 },
  // Virtual patient: a long encounter can have many short turns.
  vp: { env: "AI_VP_TURNS_PER_10MIN", fallback: 60 },
};

const buckets = new Map();

export function aiTurnLimit(kind) {
  const spec = LIMITS[kind] || LIMITS.vp;
  const n = Number(process.env[spec.env]);
  return Number.isInteger(n) && n > 0 ? n : spec.fallback;
}

/* Returns true and counts the turn, or false when the account is over its budget. The
   route checks this only when a model call is about to happen, so refused or invalid
   requests do not use up the budget. The rate-limit switch (DISABLE_RATE_LIMIT=1, used by
   the test suite) disables this budget too. */
export function takeAiTurn(kind, userId, now = Date.now()) {
  if (process.env.DISABLE_RATE_LIMIT === "1") return true;
  sweepAiTurnBudgets(now);
  const key = `${kind}|${Number(userId) || 0}`;
  const max = aiTurnLimit(kind);
  const b = buckets.get(key) || { start: now, n: 0 };
  if (now - b.start >= WINDOW_MS) { b.start = now; b.n = 0; }
  if (b.n >= max) { buckets.set(key, b); return false; }
  b.n += 1;
  buckets.set(key, b);
  return true;
}

/* Test helper: forget every counter. */
export function resetAiTurnBudgets() {
  buckets.clear();
}

/* Bounded memory: drop expired buckets now and then (a campus of 50,000 accounts must not
   grow the map without limit). */
let lastSweep = 0;
export function sweepAiTurnBudgets(now = Date.now()) {
  if (now - lastSweep < WINDOW_MS) return 0;
  lastSweep = now;
  let removed = 0;
  for (const [k, b] of buckets) {
    if (now - b.start >= WINDOW_MS) { buckets.delete(k); removed++; }
  }
  return removed;
}
