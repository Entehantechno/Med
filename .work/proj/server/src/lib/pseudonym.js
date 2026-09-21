/* pseudonym.js — one-way participant codes for anonymous data collection.

   When a questionnaire (or research study) is marked anonymous we must NOT
   store the user id, but we still need to answer two questions:
     1. "has THIS person already answered?" (so a form can't be spammed)
     2. "do these rows belong to the same participant?" (so pre/post answers can
        be paired in the analysis)

   A keyed one-way hash gives us both without keeping identity: the same user
   always maps to the same code, but the code cannot be reversed to a user id
   and it is salted per scope so codes from different forms/studies can't be
   joined together.

   This is a DEDUPLICATION / PAIRING aid, not strong anonymisation — the server
   still holds the identity map while the session is live. It is deliberately
   simple and dependency-free so it runs on a small cPanel host. */
import crypto from "crypto";

const ALGO = "sha256";

/* The key the hash is keyed with. Derived from JWT_SECRET so deployments that
   already set a strong secret get a strong salt for free; a per-scope constant
   is mixed in so rotating one scope does not invalidate the others. */
function keyFor(scope) {
  const base = process.env.JWT_SECRET || "dev-secret";
  return crypto.createHash(ALGO).update(`pseudonym::${scope}::${base}`).digest();
}

/* Stable, non-reversible code for (user, scope).
   Returns a 16-char lowercase hex string, or null for a missing user id. */
export function pseudonymFor(userId, scope = "general") {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return null;
  return crypto.createHmac(ALGO, keyFor(scope)).update(String(id)).digest("hex").slice(0, 16);
}

/* A per-study participant code: the same person always gets the same code
   inside one study, but the code differs across studies (no cross-study join).
   Useful for the research export. */
export function participantCode(userId, studyId) {
  return pseudonymFor(userId, `study:${Number(studyId) || 0}`);
}
