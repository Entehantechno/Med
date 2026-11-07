/* ================================================================
   leases.js — "run this scheduled job in one process only".

   Several worker processes share one database, so a timer in each process would
   run the same job N times (double notifications, double exam finalisation,
   double backups). A lease row says who holds the job and until when. Only the
   holder runs it; the others skip. A crashed holder loses the lease after ttlMs.
   The claim is one atomic upsert, so two processes cannot both win.

   The database is passed in (makeLeases(db)), so this module does not import
   db.js: db.js itself uses a lease for its backup job, and a module import in
   that direction would be a cycle.
   ================================================================ */
import crypto from "node:crypto";

const HOLDER = `${process.pid}-${crypto.randomBytes(6).toString("hex")}`;

export function makeLeases(db) {
  /* True when this process holds (or just acquired) the lease for `name`. */
  function tryLease(name, ttlMs, now = Date.now()) {
    const r = db.prepare(
      `INSERT INTO job_leases (name, holder, expires_at) VALUES (?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET holder = excluded.holder, expires_at = excluded.expires_at
       WHERE job_leases.expires_at <= ? OR job_leases.holder = excluded.holder`
    ).run(name, HOLDER, now + ttlMs, now);
    return r.changes > 0;
  }

  function releaseLease(name) {
    db.prepare("DELETE FROM job_leases WHERE name = ? AND holder = ?").run(name, HOLDER);
  }

  return { tryLease, releaseLease };
}
