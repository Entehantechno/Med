/* ================================================================
   password.js — password hashing with a lazy bcrypt → argon2id move.

   Policy (OWASP ASVS 2.4, 2025 guidance):
     • argon2id is the preferred hash (m=19 MiB, t=3, p=1).
     • hash-wasm is an OPTIONAL, pure-WebAssembly dependency — on a
       build host that cannot install it we transparently keep bcrypt
       cost 12 (already above the OWASP minimum), so auth never breaks.
     • existing bcrypt hashes keep verifying; every successful login
       UPGRADES the stored hash to argon2id in the background once
       (needsRehash), i.e. no forced password reset / downtime.
   ================================================================ */
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const BCRYPT_COST = 12;
const ARGON_M = 19456;   // 19 MiB
const ARGON_T = 3;
const ARGON_P = 1;
const ARGON_LEN = 32;

let wasmState = { mod: undefined, tried: false };
async function wasm() {
  if (wasmState.tried) return wasmState.mod;
  wasmState.tried = true;
  try {
    wasmState.mod = await import("hash-wasm");
  } catch { wasmState.mod = null; }
  return wasmState.mod;
}

export function isArgon2(hash) {
  return typeof hash === "string" && /^\$argon2(id|i|d)\$/.test(hash);
}

/* Round-trip self-test. argon2id is used for NEW hashes (and login upgrades)
   only when this runtime can both create AND verify an argon2id hash. Without
   this check a host that loads hash-wasm for hashing but not for verifying
   would write hashes it can never check, locking those accounts out. */
let argon2Check = { promise: null, ok: false };
export function argon2Ready() {
  if (!argon2Check.promise) {
    argon2Check.promise = (async () => {
      const hw = await wasm();
      if (!hw) return false;
      try {
        const password = "med-school-selftest";
        const hash = await hw.argon2id({
          password, salt: crypto.randomBytes(16),
          parallelism: ARGON_P, iterations: ARGON_T,
          memorySize: ARGON_M, hashLength: ARGON_LEN,
          outputType: "encoded",
        });
        const ok = isArgon2(hash) && (await hw.argon2Verify({ password, hash })) === true
          && (await hw.argon2Verify({ password: "wrong-" + password, hash })) === false;
        argon2Check.ok = ok;
        return ok;
      } catch {
        argon2Check.ok = false;
        return false;
      }
    })();
  }
  return argon2Check.promise;
}

/* Synchronous bcrypt — used by bulk imports/seed where hashing hundreds
   of students through async argon2 would stall imports and block startup. */
export function hashPasswordSync(pw) {
  return bcrypt.hashSync(String(pw).slice(0, 1024), BCRYPT_COST);
}

export async function hashPassword(pw) {
  const password = String(pw).slice(0, 1024);
  const hw = (await argon2Ready()) ? await wasm() : null;
  if (hw) {
    const salt = crypto.randomBytes(16);
    try {
      return await hw.argon2id({
        password, salt,
        parallelism: ARGON_P, iterations: ARGON_T,
        memorySize: ARGON_M, hashLength: ARGON_LEN,
        outputType: "encoded",
      });
    } catch { /* fall through to bcrypt */ }
  }
  return bcrypt.hashSync(password, BCRYPT_COST);
}

export async function verifyPassword(pw, hash) {
  if (!hash || typeof hash !== "string") return false;
  const password = String(pw ?? "").slice(0, 1024);
  if (isArgon2(hash)) {
    const hw = await wasm();
    if (!hw) {                    // argon hash but the wasm module is unavailable
      warnMissingArgon2Once();
      throw Object.assign(new Error("argon2_runtime_missing"), { code: "ARGON2_RUNTIME_MISSING" });
    }
    // A mismatch is a normal `false`. A runtime failure (wasm/memory error) is NOT
    // a wrong password: it must surface as an error so the caller can answer
    // "service unavailable" instead of "invalid credentials".
    return !!(await hw.argon2Verify({ password, hash }));
  }
  // bcrypt (legacy / fallback). bcrypt itself caps at 72 bytes; the longer
  // slice is compared against what bcrypt stored, same as before.
  return bcrypt.compareSync(password, hash);
}

/* True when the stored hash should be upgraded (bcrypt and argon2id
   available). */
export async function needsRehash(hash) {
  if (isArgon2(hash)) return false;
  return argon2Ready();
}

let warnedMissingArgon2 = false;
function warnMissingArgon2Once() {
  if (warnedMissingArgon2) return;
  warnedMissingArgon2 = true;
  console.error("[auth] Some accounts use argon2id hashes but the hash-wasm package is not available. Those accounts cannot sign in until it is installed: run `npm install` in the server folder.");
}

/* Boot-time report: how many stored hashes need argon2 and whether this
   runtime can verify them. Used to warn before users are locked out. */
export async function passwordRuntimeReport(database) {
  const row = database.prepare("SELECT COUNT(*) AS n FROM users WHERE password_hash LIKE '$argon2%'").get();
  const argon2Stored = Number(row?.n) || 0;
  const ready = await argon2Ready();
  if (argon2Stored > 0 && !ready) warnMissingArgon2Once();
  return { argon2Stored, argon2Ready: ready };
}
