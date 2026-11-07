/* multiprocess-state.test.js — state shared by worker processes (R73b).
   Leases run each scheduled job once per host; the rate store and login backoff are
   counted in the database, so every worker enforces the same limits. */
import { describe, it, expect, beforeAll } from "vitest";
import { initDb, initSchema, db } from "../src/db.js";
import { makeLeases } from "../src/lib/leases.js";

const { tryLease, releaseLease } = makeLeases(db);
import { SqliteRateStore } from "../src/lib/shared-store.js";

beforeAll(async () => {
  await initDb();
  initSchema();
});

describe("job leases (one holder per job)", () => {
  it("the first caller wins and a second caller is refused while the lease is live", () => {
    expect(tryLease("test-job-a", 60_000)).toBe(true);
    expect(tryLease("test-job-a", 60_000)).toBe(true); // same process renews
    // Another process holds the lease: simulate its row.
    db.prepare("UPDATE job_leases SET holder = 'other-proc', expires_at = ? WHERE name = 'test-job-a'").run(Date.now() + 60_000);
    expect(tryLease("test-job-a", 60_000)).toBe(false);
  });
  it("a lease whose holder went silent expires and can be taken over", () => {
    db.prepare("UPDATE job_leases SET holder = 'dead-proc', expires_at = ? WHERE name = 'test-job-b'").run(0);
    db.prepare("INSERT OR REPLACE INTO job_leases (name, holder, expires_at) VALUES ('test-job-b', 'dead-proc', 0)").run();
    expect(tryLease("test-job-b", 60_000)).toBe(true);
    releaseLease("test-job-b");
  });
});

describe("shared rate-limit store", () => {
  it("counts hits across store instances (i.e. across worker processes) for the same prefix", () => {
    const key = `t${Date.now()}`;
    const a = new SqliteRateStore("share-test", 60_000);
    const b = new SqliteRateStore("share-test", 60_000); // "another worker"
    expect(a.increment(key).totalHits).toBe(1);
    expect(b.increment(key).totalHits).toBe(2);
    expect(a.increment(key).totalHits).toBe(3);
    b.decrement(key);
    expect(a.increment(key).totalHits).toBe(3);
    a.resetKey(key);
    expect(b.increment(key).totalHits).toBe(1);
  });
  it("starts a new window after the reset time", () => {
    const key = `w${Date.now()}`;
    const s = new SqliteRateStore("window-test", 1);
    s.increment(key);
    const row = db.prepare("SELECT reset_at FROM rate_hits WHERE key = ?").get(`window-test|${key}`);
    expect(row.reset_at).toBeGreaterThan(0);
    db.prepare("UPDATE rate_hits SET reset_at = 0 WHERE key = ?").run(`window-test|${key}`);
    expect(s.increment(key).totalHits).toBe(1);
  });
});
