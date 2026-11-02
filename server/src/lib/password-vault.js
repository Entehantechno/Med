/* password-vault.js — an encrypted copy of each user's current password, so an
   administrator can show it to the user or set a new one from the user's profile.

   Sign-in still checks only the bcrypt/argon2 hash. The copy is sealed with the
   settings key (AES-256-GCM, lib/secret-store.js). A reveal re-checks the copy
   against the current hash, so a stale copy (for example after a command-line
   reset that touched only the hash) is never shown as the password. With no
   key configured nothing is stored at all.

   initial_password = 1 means staff set the password, or it is the student
   number, and the user has not chosen their own yet. The app suggests a change. */
import { db } from "../db.js";
import { sealSecret, openSecret, sealingAvailable } from "./secret-store.js";
import { verifyPassword } from "./password.js";
import { normDigits } from "./textsearch.js";

/** Store the copy for a password that was just written. `initial` marks a
 *  staff-set or default password (the user should be prompted to change it). */
export function recordPassword(userId, plain, { initial = false } = {}) {
  const enc = sealingAvailable() && plain ? sealSecret(String(plain)) : null;
  db.prepare("UPDATE users SET password_enc=?, initial_password=? WHERE id=?")
    .run(enc, initial ? 1 : 0, userId);
}

/** Called after a successful sign-in, which is the only moment the plain password
 *  is known for accounts created before this feature. It writes only when
 *  something is missing, so steady-state logins do no extra work. */
export function captureLoginPassword(user, matchedPlain) {
  if (!user.password_enc && sealingAvailable()) {
    const enc = sealSecret(String(matchedPlain));
    db.prepare("UPDATE users SET password_enc=? WHERE id=? AND password_enc IS NULL").run(enc, user.id);
    user.password_enc = enc;
  }
  if (!user.initial_password && user.student_no && normDigits(matchedPlain) === normDigits(user.student_no)) {
    db.prepare("UPDATE users SET initial_password=1 WHERE id=?").run(user.id);
    user.initial_password = 1;   // the sign-in response is built from this object
  }
}

/** The status shown to an administrator. `password` is set only when the copy
 *  is present and still matches the current hash. */
export async function revealPassword(userId) {
  const row = db.prepare("SELECT password_hash, password_enc, initial_password FROM users WHERE id=?").get(userId);
  if (!row) return null;
  const initial = !!row.initial_password;
  const plain = row.password_enc ? openSecret(row.password_enc) : "";
  if (!plain) return { available: false, stale: false, initial, password: null };
  const current = await verifyPassword(plain, row.password_hash).catch(() => false);
  if (!current) return { available: false, stale: true, initial, password: null };
  return { available: true, stale: false, initial, password: plain };
}
