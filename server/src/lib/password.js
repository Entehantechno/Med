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
import os from "node:os";
import { Worker } from "node:worker_threads";

/* ---- argon2 worker pool -------------------------------------------------
   HASH_WORKERS sets the pool size (0 = hash on the main thread, the old way).
   Default: the CPU count, at most 4 (the event loop shares cores with the workers;
   the OS scheduler handles that, and a hash never blocks the loop). Workers are unref'd so they never keep the process alive. If a worker
   cannot start, jobs fall back to the in-thread path below. */
const WORKER_URL = new URL("./password-worker.js", import.meta.url);
function poolSize() {
  const env = process.env.HASH_WORKERS;
  if (env !== undefined && env !== "") {
    const n = Number(env);
    return Number.isInteger(n) && n >= 0 ? Math.min(n, 8) : 0;
  }
  const cores = (typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length) || 1;
  return Math.max(1, Math.min(4, cores));
}
const pool = { size: poolSize(), slots: [], queue: [], disabled: false };

function pump() {
  while (pool.queue.length) {
    let slot = pool.slots.find((s) => !s.busy && !s.dead);
    if (!slot) {
      if (pool.slots.filter((s) => !s.dead).length >= pool.size) return;
      try {
        slot = makeSlot();
      } catch {
        pool.disabled = true;
        for (const job of pool.queue.splice(0)) job.reject(Object.assign(new Error("hash_worker_unavailable"), { code: "HASH_WORKER_UNAVAILABLE" }));
        return;
      }
      pool.slots.push(slot);
    }
    const job = pool.queue.shift();
    slot.busy = true;
    slot.job = job;
    slot.w.postMessage(job.payload);
  }
}

function makeSlot() {
  const w = new Worker(WORKER_URL);
  w.unref();
  const slot = { w, busy: false, job: null, dead: false };
  const finish = () => {
    const job = slot.job;
    slot.job = null;
    slot.busy = false;
    return job;
  };
  w.on("message", (msg) => {
    const job = finish();
    if (job) {
      if (msg && msg.ok) job.resolve(msg.result);
      else job.reject(Object.assign(new Error((msg && msg.error) || "hash_failed"), { code: "HASH_WORKER_ERROR" }));
    }
    pump();
  });
  const die = (err) => {
    if (slot.dead) return;
    slot.dead = true;
    const job = finish();
    if (job) job.reject(Object.assign(new Error(err ? err.message : "hash_worker_exited"), { code: "HASH_WORKER_UNAVAILABLE" }));
    pump();
  };
  w.on("error", die);
  w.on("exit", () => die(null));
  return slot;
}

function runInWorker(payload) {
  return new Promise((resolve, reject) => {
    pool.queue.push({ payload, resolve, reject });
    pump();
  });
}

/* Runs one argon2 operation in the pool; falls back to the in-thread wasm
   path only when the pool itself is unavailable. A genuine hash/verify error
   from the worker is re-thrown unchanged. */
async function argonOp(payload, inline) {
  if (pool.size > 0 && !pool.disabled) {
    try {
      return await runInWorker(payload);
    } catch (e) {
      if (e && e.code === "HASH_WORKER_ERROR") throw e;
    }
  }
  return inline();
}


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
  if (await argon2Ready()) {
    const salt = crypto.randomBytes(16);
    const params = { parallelism: ARGON_P, iterations: ARGON_T, memorySize: ARGON_M, hashLength: ARGON_LEN };
    try {
      return await argonOp({ op: "hash", password, salt, ...params }, async () => {
        const hw = await wasm();
        if (!hw) throw new Error("hash_wasm_missing");
        return hw.argon2id({ password, salt, ...params, outputType: "encoded" });
      });
    } catch { /* fall through to bcrypt */ }
  }
  return bcrypt.hashSync(password, BCRYPT_COST);
}

export async function verifyPassword(pw, hash) {
  if (!hash || typeof hash !== "string") return false;
  const password = String(pw ?? "").slice(0, 1024);
  if (isArgon2(hash)) {
    // A mismatch is a normal `false`. A runtime failure (wasm/memory error) is NOT
    // a wrong password: it must surface as an error so the caller can answer
    // "service unavailable" instead of "invalid credentials".
    return argonOp({ op: "verify", password, hash }, async () => {
      const hw = await wasm();
      if (!hw) {                  // argon hash but the wasm module is unavailable
        warnMissingArgon2Once();
        throw Object.assign(new Error("argon2_runtime_missing"), { code: "ARGON2_RUNTIME_MISSING" });
      }
      return !!(await hw.argon2Verify({ password, hash }));
    });
  }
  // bcrypt (legacy / fallback). bcrypt itself caps at 72 bytes; the longer
  // slice is compared against what bcrypt stored, same as before. The async
  // compare yields between rounds, so a legacy login does not freeze the server.
  return bcrypt.compare(password, hash);
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
