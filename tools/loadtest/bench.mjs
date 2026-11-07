#!/usr/bin/env node
// Zero-dependency load check for a running server (use a scratch copy with
// synthetic users from gen-users.mjs; never production).
//
//   node tools/loadtest/bench.mjs --base http://127.0.0.1:4557 --scenario learner --concurrency 50 --seconds 30
//   scenarios: learner (logged-in learner mix), student (logged-in student mix),
//              login (password-hash storm), guest (public pages/API)
//
// Prints per-endpoint count, errors, p50/p95/p99 (ms) and requests/second.
// Exit code 1 when any endpoint's p95 exceeds --p95-budget (default 800 ms).
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const BASE = opt("base", "http://127.0.0.1:4557");
const SCEN = opt("scenario", "learner");
const CONC = Number(opt("concurrency", 50));
const SECS = Number(opt("seconds", 30));
const P95_BUDGET = Number(opt("p95-budget", 800));
const PASS = opt("password", "demo");
const LEARNER_BASE = Number(opt("learner-first", 33)); // synthetic learners: lt33, lt38, ... (every 5th uid)
const STUDENT_FIRST = Number(opt("student-first", 34));
const USERS = Number(opt("users", 2000));

const headers = (extra = {}) => ({ Origin: BASE, "content-type": "application/json", ...extra });
async function login(username) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: headers(), body: JSON.stringify({ username, password: PASS }) });
  if (!r.ok) throw new Error(`login ${username} ${r.status}`);
  return (await r.json()).token;
}
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const learnerName = (k) => `lt${LEARNER_BASE + 5 * k}`;
const studentName = (k) => `lt${STUDENT_FIRST + 5 * k + (k % 4)}`;

const stats = new Map();
function record(name, ms, ok) {
  let s = stats.get(name);
  if (!s) stats.set(name, (s = { n: 0, err: 0, ms: [] }));
  s.n++; if (!ok) s.err++; s.ms.push(ms);
}
async function hit(name, method, url, token, body) {
  const t0 = performance.now();
  let ok = false;
  try {
    const r = await fetch(BASE + url, {
      method,
      headers: headers(token ? { authorization: `Bearer ${token}` } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    await r.arrayBuffer();
    ok = r.status < 400;
  } catch { ok = false; }
  record(name, performance.now() - t0, ok);
}

const MIX = {
  learner: [["learn.home", "GET", "/api/learn/home"], ["learn.path", "GET", "/api/learn/path"], ["learn.league", "GET", "/api/learn/league"],
    ["learn.ranking", "GET", "/api/learn/ranking"], ["auth.me", "GET", "/api/auth/me"], ["learn.daily", "GET", "/api/learn/daily"]],
  student: [["auth.me", "GET", "/api/auth/me"], ["student.home", "GET", "/api/student/home"], ["flash.due", "GET", "/api/flashcards/due"],
    ["site.config", "GET", "/api/site-content/config"]],
  guest: [["site.config", "GET", "/api/site-content/config"], ["site.content", "GET", "/api/site-content"]],
};

async function worker(deadline, pool) {
  let token = null, who = null;
  if (SCEN === "login") {
    while (performance.now() < deadline) {
      const u = pick(pool);
      const t0 = performance.now();
      let ok = false;
      try { const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: headers(), body: JSON.stringify({ username: u, password: PASS }) }); await r.arrayBuffer(); ok = r.status === 200; } catch {}
      record("auth.login", performance.now() - t0, ok);
    }
    return;
  }
  if (SCEN !== "guest") {
    who = pick(pool);
    token = await login(who);
  }
  const mix = MIX[SCEN] || MIX.guest;
  while (performance.now() < deadline) {
    const [name, method, url] = pick(mix);
    await hit(name, method, url, token);
  }
}

function pct(sorted, p) { return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : NaN; }

const pool = SCEN === "learner" ? Array.from({ length: Math.min(USERS, 400) }, (_, k) => learnerName(k))
  : SCEN === "student" ? Array.from({ length: Math.min(USERS, 400) }, (_, k) => studentName(k))
  : SCEN === "login" ? Array.from({ length: USERS }, (_, k) => (k % 5 === 0 ? learnerName(k % 400) : studentName(k % 400)))
  : [];
const started = performance.now();
const deadline = started + SECS * 1000;
await Promise.all(Array.from({ length: CONC }, () => worker(deadline, pool)));
const elapsed = (performance.now() - started) / 1000;

let total = 0, errors = 0, breach = false;
const rows = [];
for (const [name, s] of [...stats.entries()].sort()) {
  const sorted = s.ms.slice().sort((a, b) => a - b);
  total += s.n; errors += s.err;
  const p95 = pct(sorted, 95);
  if (p95 > P95_BUDGET) breach = true;
  rows.push({ endpoint: name, n: s.n, errors: s.err, p50: Math.round(pct(sorted, 50)), p95: Math.round(p95), p99: Math.round(pct(sorted, 99)) });
}
console.log(JSON.stringify({ scenario: SCEN, base: BASE, concurrency: CONC, seconds: Math.round(elapsed), requests: total, rps: +(total / elapsed).toFixed(1), errors, p95_budget_ms: P95_BUDGET, endpoints: rows }, null, 2));
process.exit(breach || errors > total * 0.01 ? 1 : 0);
