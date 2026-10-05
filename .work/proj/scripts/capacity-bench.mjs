#!/usr/bin/env node
/* capacity-bench.mjs — realistic learner-mix load test for a 2–3 GB VPS.
   Measures p50/p95/error-rate/RSS while ramping concurrency.
   Usage: BASE=http://127.0.0.1:4388 node scripts/capacity-bench.mjs
*/
const BASE = (process.env.BASE || "http://127.0.0.1:4388").replace(/\/$/, "");
const USER = process.env.BENCH_USER || "learner";
const PASS = process.env.BENCH_PASS || "demo";

async function json(method, path, body, token) {
  const t0 = performance.now();
  let status = 0, err = null;
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    status = res.status;
    if (res.headers.get("content-type")?.includes("json")) await res.json().catch(() => null);
    else await res.text().catch(() => "");
    if (!res.ok) err = `HTTP ${res.status}`;
  } catch (e) {
    err = String(e.message || e);
    status = 0;
  }
  return { ms: performance.now() - t0, status, err };
}

function pct(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] * 10) / 10;
}

async function wave(name, n, fn) {
  const started = performance.now();
  const jobs = Array.from({ length: n }, () => fn());
  const rows = await Promise.all(jobs);
  const wall = performance.now() - started;
  const times = rows.map((r) => r.ms);
  const fails = rows.filter((r) => r.err);
  return {
    name, n,
    wallMs: Math.round(wall),
    rps: Math.round((n / wall) * 10000) / 10,
    p50: pct(times, 50),
    p95: pct(times, 95),
    p99: pct(times, 99),
    errors: fails.length,
    errRate: Math.round((fails.length / n) * 1000) / 10,
    sampleErr: fails[0]?.err || null,
  };
}

async function main() {
  const login = await json("POST", "/api/auth/login", { username: USER, password: PASS });
  if (login.err) {
    console.error("login failed", login);
    process.exit(2);
  }
  // login endpoint returns { token }
  const first = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  const auth = await first.json();
  const token = auth.token;
  if (!token) {
    console.error("no token", auth);
    process.exit(2);
  }

  const health = await json("GET", "/api/health");
  console.log(`target ${BASE}  login ${Math.round(login.ms)}ms  health ${Math.round(health.ms)}ms`);

  const mix = async () => {
    const pick = Math.random();
    if (pick < 0.25) return json("GET", "/api/learn/home?lang=fa", null, token);
    if (pick < 0.45) return json("GET", "/api/learn/profile?lang=fa", null, token);
    if (pick < 0.65) return json("GET", "/api/learn/path?lang=fa", null, token);
    if (pick < 0.85) return json("GET", "/api/learn/browse?lang=fa&page=1&per=20", null, token);
    if (pick < 0.95) return json("GET", "/api/health");
    return json("GET", "/api/learn/premium/plans?lang=fa", null, token);
  };

  const levels = [10, 25, 50, 100, 200, 400, 800, 1000];
  const results = [];
  for (const n of levels) {
    // warm a bit so the first wave is not cold-start
    await wave("warm", Math.min(10, n), mix);
    const r = await wave(`c${n}`, n, mix);
    results.push(r);
    const rss = Math.round(process.memoryUsage().rss / 1048576);
    console.log(JSON.stringify({ ...r, clientRssMb: rss }));
    // stop if the service is collapsing (errors or p95 > 3s)
    if (r.errRate > 15 || r.p95 > 3000) {
      console.log("stopping ramp — service past the stable envelope");
      break;
    }
    await new Promise((ok) => setTimeout(ok, 400));
  }

  const stable = [...results].reverse().find((r) => r.errRate < 2 && r.p95 < 800 && r.p50 < 350);
  const thousand = results.find((r) => r.n === 1000);
  console.log("---summary---");
  console.log(JSON.stringify({
    stableMaxBurst: stable ? stable.n : 0,
    thousandOk: !!(thousand && thousand.errRate < 2 && thousand.p95 < 1500),
    rows: results,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
