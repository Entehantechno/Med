/* idempotency-key.js — one Idempotency-Key per logical action (e.g. one exam finish).
   Every retry of the same action re-sends the SAME key, so the server can replay the
   stored result instead of grading twice. crypto.randomUUID needs a secure context
   (HTTPS or localhost), so a getRandomValues fallback is used on plain HTTP. */
export function newIdempotencyKey() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch { /* fall through */ }
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
