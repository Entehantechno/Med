/* idempotency.js — Idempotency-Key replay for state-changing POSTs.

   Why: a client that times out (e.g. the 180 s exam evaluation) cannot tell whether the
   server finished. Re-sending without a key can, before this change, return a 409
   "session_closed" for a request that actually succeeded. With a key, the server
   replays the stored response instead.

   Rules (following the IETF httpapi idempotency-key draft and common practice):
   - The key is scoped to the authenticated user and the route scope; the same key on
     another route or by another user is a different key.
   - Same key + same request body   -> replay the stored status and body
                                       (header Idempotent-Replayed: true).
   - Same key + different body      -> 422 idempotency_key_reused.
   - Same key while the first call is still running -> 409 idempotency_in_progress
     (retryable:true, Retry-After). A lease of LEASE_MS lets a crashed attempt be retried.
   - Server errors (5xx) are not stored, so the client may retry them.
   - Stored records expire after TTL_MS. Only a digest of the key is kept.
   Without the header the route behaves exactly as before. */
import crypto from "node:crypto";
import { db } from "../db.js";

const KEY_RE = /^[A-Za-z0-9_-]{16,128}$/;
const LEASE_MS = 120_000;
const TTL_MS = 24 * 3600_000;
const MAX_BODY = 512 * 1024;
let lastPurge = 0;

function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
}

function purgeOld(now) {
  if (now - lastPurge < 10 * 60_000) return;
  lastPurge = now;
  try { db.prepare("DELETE FROM idempotency_keys WHERE created_ms < ?").run(now - TTL_MS); } catch { /* best effort */ }
}

export function idempotent(scope) {
  return (req, res, next) => {
    const raw = req.get("Idempotency-Key");
    if (raw === undefined) return next();
    if (!KEY_RE.test(raw)) return res.status(400).json({ error: "idempotency_key_invalid", stage: "idempotency" });
    if (!req.user?.id) return next();
    const now = Date.now();
    purgeOld(now);
    const keyHash = crypto.createHash("sha256").update(`${req.user.id}\n${scope}\n${raw}`).digest("hex");
    const fingerprint = crypto.createHash("sha256").update(stableStringify(req.body ?? null)).digest("hex");
    const claim = db.prepare(
      `INSERT OR IGNORE INTO idempotency_keys
         (key_hash, user_id, scope, fingerprint, state, status, body, created_ms, updated_ms)
       VALUES (?,?,?,?, 'in_flight', NULL, NULL, ?, ?)`
    ).run(keyHash, Number(req.user.id), scope, fingerprint, now, now);
    if (claim.changes === 0) {
      const row = db.prepare("SELECT * FROM idempotency_keys WHERE key_hash = ?").get(keyHash);
      if (!row) return res.status(409).json({ error: "idempotency_in_progress", stage: "idempotency", retryable: true });
      if (row.fingerprint !== fingerprint) {
        return res.status(422).json({ error: "idempotency_key_reused", stage: "idempotency", retryable: false });
      }
      if (row.state === "done" && row.body != null) {
        res.set("Idempotent-Replayed", "true");
        return res.status(row.status || 200).type("application/json").send(row.body);
      }
      if (now - row.updated_ms < LEASE_MS) {
        res.set("Retry-After", "2");
        return res.status(409).json({ error: "idempotency_in_progress", stage: "idempotency", retryable: true });
      }
      // Stale lease: the earlier attempt is presumed dead; this one takes over.
      db.prepare("UPDATE idempotency_keys SET state='in_flight', updated_ms=? WHERE key_hash=?").run(now, keyHash);
    }
    let settled = false;
    const sendJson = res.json.bind(res);
    res.json = (body) => {
      if (!settled) {
        settled = true;
        try {
          if (res.statusCode >= 500) {
            db.prepare("DELETE FROM idempotency_keys WHERE key_hash=?").run(keyHash);
          } else {
            const text = JSON.stringify(body ?? null);
            if (text.length <= MAX_BODY) {
              db.prepare("UPDATE idempotency_keys SET state='done', status=?, body=?, updated_ms=? WHERE key_hash=?")
                .run(res.statusCode, text, Date.now(), keyHash);
            } else {
              db.prepare("DELETE FROM idempotency_keys WHERE key_hash=?").run(keyHash);
            }
          }
        } catch (e) {
          console.error("[idempotency] could not store result:", e?.message || e);
        }
      }
      return sendJson(body);
    };
    next();
  };
}
