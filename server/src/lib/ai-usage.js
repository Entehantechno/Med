// Round 69: token usage meter for every real AI call.
// Stores COUNTS ONLY (stage, provider, model, token numbers). No prompt, reply,
// student id, session id or API key is written here. The admin can read the
// totals to see where tokens go and whether prompt caching is actually hitting.
import { db, onDbReady } from "../db.js";

let ready = false;

function ensureUsageTable() {
  if (ready) return true;
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS ai_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      stage TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      cached_tokens INTEGER NOT NULL DEFAULT 0,
      cache_write_tokens INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage(created_at);`);
    ready = true;
  } catch {
    ready = false;
  }
  return ready;
}
onDbReady(() => { ensureUsageTable(); });

const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; };
const label = (v, max = 120) => String(v || "").replace(/[\u0000-\u001f]/g, "").slice(0, max);

/* Record one provider response's usage block. `usage` is the OpenAI-style object
   (prompt_tokens, completion_tokens, prompt_tokens_details.cached_tokens and
   cache_write_tokens). Missing usage (offline tests, some providers) records nothing. */
export function recordAiUsage({ stage = "other", provider = "", model = "", usage = null } = {}) {
  if (!usage || typeof usage !== "object") return false;
  if (!ensureUsageTable()) return false;
  const details = usage.prompt_tokens_details || usage.input_tokens_details || {};
  const row = [
    label(stage, 40) || "other",
    label(provider, 60),
    label(model, 160),
    num(usage.prompt_tokens ?? usage.input_tokens),
    num(usage.completion_tokens ?? usage.output_tokens),
    num(details.cached_tokens),
    num(details.cache_write_tokens),
  ];
  try {
    db.prepare(`INSERT INTO ai_usage (stage, provider, model, prompt_tokens, completion_tokens, cached_tokens, cache_write_tokens)
      VALUES (?,?,?,?,?,?,?)`).run(...row);
    return true;
  } catch {
    return false;   // metering must never break a student's request
  }
}

/* Totals per stage and model over the last `days` days (default 7, max 90). */
export function aiUsageSummary({ days = 7 } = {}) {
  const d = Math.max(1, Math.min(90, Number(days) || 7));
  if (!ensureUsageTable()) return { days: d, rows: [], totals: emptyTotals() };
  const rows = db.prepare(`SELECT stage, provider, model,
      COUNT(*) AS calls,
      SUM(prompt_tokens) AS prompt_tokens,
      SUM(completion_tokens) AS completion_tokens,
      SUM(cached_tokens) AS cached_tokens,
      SUM(cache_write_tokens) AS cache_write_tokens
    FROM ai_usage
    WHERE created_at >= datetime('now', ?)
    GROUP BY stage, provider, model
    ORDER BY prompt_tokens DESC`).all(`-${d} days`);
  const totals = emptyTotals();
  for (const r of rows) {
    totals.calls += r.calls || 0;
    totals.prompt_tokens += r.prompt_tokens || 0;
    totals.completion_tokens += r.completion_tokens || 0;
    totals.cached_tokens += r.cached_tokens || 0;
    totals.cache_write_tokens += r.cache_write_tokens || 0;
  }
  totals.cache_hit_ratio = totals.prompt_tokens ? +(totals.cached_tokens / totals.prompt_tokens).toFixed(3) : 0;
  return { days: d, rows, totals };
}

function emptyTotals() {
  return { calls: 0, prompt_tokens: 0, completion_tokens: 0, cached_tokens: 0, cache_write_tokens: 0, cache_hit_ratio: 0 };
}
