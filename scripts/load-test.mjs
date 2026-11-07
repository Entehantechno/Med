#!/usr/bin/env node
/* load-test.mjs — ramping load + concurrent-login test for the MED School API.
   Zero dependencies (Node 18+ native fetch). Mirrors k6's ramping stages and thresholds.

   Usage:
     node scripts/load-test.mjs --base http://localhost:3000 --vus 100 --ramp 20 --hold 60 \
       --users 40012345:demo [--users user2:pass2 ...] [--out reports/load.json]
     node scripts/load-test.mjs --login-burst 20 --users ...      # concurrent login test only

   What it does:
   1. Logs each account in ONCE during setup (or, with --tokens-file, loads pre-issued tokens) (a per-account login limiter exists, so
      logins are not repeated per virtual user). Login latency is recorded.
   2. Ramp: 0 -> VUs over --ramp s, hold for --hold s, ramp down. Each VU repeatedly calls
      authenticated read endpoints with random 1–3 s think time (realistic pacing).
   3. Thresholds (exit code 1 if any fails):
        p95 latency  < --p95 ms     (default 800)
        error rate   < --max-errors % (default 1; network errors and 5xx count)
        429 rate     < --max-429 %    (default 5; a rate limit that fires for a normal
                                       student is a capacity/config problem)
   4. --login-burst N: fires N concurrent logins (valid credentials, spread over the given
      accounts) and reports the status mix and latency. Expected: 200s, or 429 once the
      limiter kicks in. Anything else (5xx, timeouts) fails.

   Passwords are read from the --users argument only; they are never written to the report. */

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const multi = (name) => args.flatMap((a, i) => (a === `--${name}` && args[i + 1] ? [args[i + 1]] : []));

const BASE = opt("base", "http://localhost:3000").replace(/\/+$/, "");
const VUS = Number(opt("vus", 100));
const RAMP = Number(opt("ramp", 20));
const HOLD = Number(opt("hold", 60));
const P95_MS = Number(opt("p95", 800));
const MAX_ERR = Number(opt("max-errors", 1));
const MAX_429 = Number(opt("max-429", 5));
const BURST = Number(opt("login-burst", 0));
const OUT = opt("out", "");
// Optional: a JSON array of bearer tokens (one per virtual user). When given, setup skips
// logins, so the test is not bound by the per-IP login budget (96 logins / 15 min).
const TOKENS_FILE = opt("tokens-file", "");
const READS = ["/api/auth/me", "/api/classes"];

const accounts = multi("users").map((s) => {
  const i = s.indexOf(":");
  return { username: s.slice(0, i), password: s.slice(i + 1) };
});
if (!accounts.length) {
  console.error("Pass at least one --users username:password");
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now();

function pct(sorted, p) {
  if (!sorted.length) return null;
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
}
function summarise(samples) {
  const d = samples.map((s) => s.ms).sort((a, b) => a - b);
  return { count: d.length, p50: pct(d, 50), p95: pct(d, 95), p99: pct(d, 99), max: d.length ? Math.round(d[d.length - 1]) : null };
}

async function call(method, path, { token, body } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const t0 = now();
  try {
    const res = await fetch(BASE + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    await res.arrayBuffer();
    return { status: res.status, ms: now() - t0 };
  } catch (e) {
    return { status: 0, ms: now() - t0, error: e?.name || "network" };
  }
}

async function fetchToken(acc) {
  const res = await fetch(BASE + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: acc.username, password: acc.password }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, token: data?.token || null };
}

async function loginBurst(n) {
  const jobs = Array.from({ length: n }, (_, i) => accounts[i % accounts.length]);
  const results = await Promise.all(jobs.map((acc) => call("POST", "/api/auth/login", { body: { username: acc.username, password: acc.password } })));
  const mix = {};
  for (const r of results) mix[r.status || r.error] = (mix[r.status || r.error] || 0) + 1;
  const bad = results.filter((r) => !(r.status === 200 || r.status === 429));
  return { concurrent: n, statusMix: mix, latency: summarise(results), unexpected: bad.length, passed: bad.length === 0 };
}

async function main() {
  const report = { base: BASE, startedAt: new Date().toISOString(), thresholds: {}, checks: {} };

  // 1. Setup: one login per account (tokens reused by VUs).
  const pool = [];
  const loginTimes = [];
  if (TOKENS_FILE) {
    const list = JSON.parse(readFileSync(TOKENS_FILE, "utf8"));
    if (!Array.isArray(list) || !list.length) { console.error("tokens file is empty"); process.exit(2); }
    pool.push(...list);
    report.checks.tokens = { source: "tokens-file", count: list.length };
  }
  for (const acc of TOKENS_FILE ? [] : accounts) {
    const t0 = now();
    const r = await fetchToken(acc);
    loginTimes.push({ ms: now() - t0, status: r.status });
    if (r.token) pool.push(r.token);
    else console.error(`login failed for one account (status ${r.status})`);
    await sleep(300);
  }
  if (!pool.length) { console.error("No token obtained; aborting."); process.exit(1); }
  if (!TOKENS_FILE) report.checks.setupLogins = { ...summarise(loginTimes), okCount: pool.length, of: accounts.length };

  // 2. Optional concurrent-login burst.
  if (BURST > 0) {
    report.checks.loginBurst = await loginBurst(BURST);
  }

  // 3. Ramping VU load.
  const samples = [];
  const started = now();
  const total = (RAMP + HOLD + 5) * 1000;
  const vuTarget = (t) => {
    if (t < RAMP * 1000) return Math.max(1, Math.round((VUS * t) / (RAMP * 1000)));
    if (t < (RAMP + HOLD) * 1000) return VUS;
    return Math.max(0, Math.round(VUS * (1 - (t - (RAMP + HOLD) * 1000) / 5000)));
  };
  const active = new Set();
  let nextId = 0;
  async function vu(id) {
    const token = pool[id % pool.length];
    while (now() - started < total && vuTarget(now() - started) > id) {
      const path = READS[Math.floor(Math.random() * READS.length)];
      const r = await call("GET", path, { token });
      samples.push({ ms: r.ms, status: r.status, path, error: r.error });
      await sleep(1000 + Math.random() * 2000);
    }
    active.delete(id);
  }
  // Spawn VUs as the ramp target rises; each VU stops when the target drops below its id.
  const spawner = setInterval(() => {
    const target = vuTarget(now() - started);
    while (nextId < target) {
      const id = nextId++;
      active.add(id);
      vu(id);
    }
  }, 250);
  await sleep(total);
  clearInterval(spawner);
  while (active.size) await sleep(200);

  // 4. Summarise.
  const ok = samples.filter((s) => s.status >= 200 && s.status < 400).length;
  const r429 = samples.filter((s) => s.status === 429).length;
  const errs = samples.filter((s) => s.status === 0 || s.status >= 500).length;
  const n = samples.length || 1;
  const latency = summarise(samples);
  const errPct = +((errs / n) * 100).toFixed(2);
  const rate429 = +((r429 / n) * 100).toFixed(2);
  report.checks.load = {
    vus: VUS, rampSec: RAMP, holdSec: HOLD, requests: samples.length,
    statusMix: samples.reduce((m, s) => ((m[s.status || s.error] = (m[s.status || s.error] || 0) + 1), m), {}),
    okPct: +((ok / n) * 100).toFixed(2), errorPct: errPct, rate429Pct: rate429,
    latencyMs: latency,
    perPath: Object.fromEntries(READS.map((p) => [p, summarise(samples.filter((s) => s.path === p))])),
  };
  report.thresholds = {
    p95Ms: { limit: P95_MS, actual: latency.p95, passed: latency.p95 !== null && latency.p95 < P95_MS },
    errorPct: { limit: MAX_ERR, actual: errPct, passed: errPct < MAX_ERR },
    rate429Pct: { limit: MAX_429, actual: rate429, passed: rate429 < MAX_429 },
  };
  if (report.checks.loginBurst) report.thresholds.loginBurstUnexpected = { limit: 0, actual: report.checks.loginBurst.unexpected, passed: report.checks.loginBurst.passed };
  report.passed = Object.values(report.thresholds).every((t) => t.passed);
  report.finishedAt = new Date().toISOString();

  const text = JSON.stringify(report, null, 2);
  console.log(text);
  if (OUT) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, text + "\n"); }
  process.exit(report.passed ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
