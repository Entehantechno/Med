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

/* Synchronous bcrypt — used by bulk imports/seed where hashing hundreds
   of students through async argon2 would stall imports and block startup. */
export function hashPasswordSync(pw) {
  return bcrypt.hashSync(String(pw).slice(0, 1024), BCRYPT_COST);
}

export async function hashPassword(pw) {
  const hw = await wasm();
  const password = String(pw).slice(0, 1024);
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
    if (!hw) return false;        // argon hash but the wasm module is unavailable
    try {
      return !!(await hw.argon2Verify({ password, hash }));
    } catch { return false; }
  }
  // bcrypt (legacy / fallback). bcrypt itself caps at 72 bytes; the longer
  // slice is compared against what bcrypt stored, same as before.
  return bcrypt.compareSync(password, hash);
}

/* True when the stored hash should be upgraded (bcrypt and argon2id
   available). */
export async function needsRehash(hash) {
  if (isArgon2(hash)) return false;
  const hw = await wasm();
  return !!hw;
}
