/* Round 64: pure helpers for resumed timed sessions (VP encounters and flashcard runs).
   The server holds the clock and the saved progress. The browser only displays them. */

/* Seconds left for a timed session. The server's remainingSec wins; a missing or
   non-numeric value falls back to the caller's default (null means untimed). */
export function remainingFromServer(session, fallbackSec = null) {
  const r = session?.remainingSec;
  if (typeof r === "number" && Number.isFinite(r)) return Math.max(0, Math.floor(r));
  return fallbackSec;
}

/* True when the server restored a saved run or encounter instead of starting a new one. */
export function isResumedSession(session) {
  return session?.resumed === true;
}
