/* ================================================================
   password-worker.js — argon2id hashing off the main event loop.

   One argon2id hash/verify (m=19 MiB, t=3) takes ~80 ms of CPU in the
   WebAssembly build. Run on the main thread it stalls every other request
   for that long, so a login burst froze the whole site. The pool in
   password.js runs these jobs here instead. Only plain data crosses the
   boundary: { op: "hash"|"verify", ...payload } → { ok, result | error }.
   ================================================================ */
import { parentPort } from "node:worker_threads";

let hw = null;
async function lib() {
  if (!hw) hw = await import("hash-wasm");
  return hw;
}

parentPort.on("message", async (msg) => {
  try {
    const m = await lib();
    let result;
    if (msg.op === "hash") {
      result = await m.argon2id({
        password: msg.password, salt: msg.salt,
        parallelism: msg.parallelism, iterations: msg.iterations,
        memorySize: msg.memorySize, hashLength: msg.hashLength,
        outputType: "encoded",
      });
    } else if (msg.op === "verify") {
      result = !!(await m.argon2Verify({ password: msg.password, hash: msg.hash }));
    } else {
      throw new Error("unknown_op");
    }
    parentPort.postMessage({ ok: true, result });
  } catch (e) {
    parentPort.postMessage({ ok: false, error: String((e && e.message) || e) });
  }
});
