/* ================================================================
   shared-store.js — express-rate-limit store kept in SQLite.

   The default MemoryStore lives in ONE process. With several worker processes
   (WEB_CONCURRENCY > 1) a per-process counter lets an attacker spend the full
   budget on every worker. This store keeps the counters in the shared database,
   so the budget is per host, not per process. Used for the auth limiters only:
   those are low-volume. General API counters stay in memory on purpose — a
   write per API request would cost more than the protection is worth.
   ================================================================ */
import { db } from "../db.js";

export class SqliteRateStore {
  constructor(prefix, windowMs) {
    this.prefix = prefix;
    this.windowMs = windowMs;
    this.localKeys = false;
    this.calls = 0;
  }
  init(options) {
    if (options && options.windowMs) this.windowMs = options.windowMs;
  }
  _key(k) { return `${this.prefix}|${k}`; }
  increment(k) {
    const now = Date.now();
    const reset = now + this.windowMs;
    const key = this._key(k);
    const row = db.prepare(
      `INSERT INTO rate_hits (key, hits, reset_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         hits = CASE WHEN rate_hits.reset_at <= ? THEN 1 ELSE rate_hits.hits + 1 END,
         reset_at = CASE WHEN rate_hits.reset_at <= ? THEN ? ELSE rate_hits.reset_at END
       RETURNING hits, reset_at`
    ).get(key, reset, now, now, reset);
    // Occasional sweep of expired counters so the table stays small.
    if (++this.calls % 500 === 0) db.prepare("DELETE FROM rate_hits WHERE reset_at <= ?").run(now);
    return { totalHits: row.hits, resetTime: new Date(row.reset_at) };
  }
  decrement(k) {
    db.prepare("UPDATE rate_hits SET hits = MAX(0, hits - 1) WHERE key = ?").run(this._key(k));
  }
  resetKey(k) {
    db.prepare("DELETE FROM rate_hits WHERE key = ?").run(this._key(k));
  }
}
