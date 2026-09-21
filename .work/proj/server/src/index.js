/* ================================================================
   index.js — Server launcher
   ================================================================ */
import "./load-env.js";
import { initDb, reloadDb, initSchema, db, persistNow, snapshotDb } from "./db.js";
import { createApp } from "./app.js";
import { runStreakReminders } from "./lib/notify.js";
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

/* ------------------------------------------------------------------
   Boot strategy for shared hosts (cPanel / Passenger / small VPS)
   ------------------------------------------------------------------
   Passenger only waits a limited time for the app to accept its first
   request; the FIRST start of MED School must seed the demo content and
   import ~11 600 official questions (≈ 60-70 s, ≈ 500 MB peak RSS). When
   that ran BEFORE `listen()`, the host gave up and the site never appeared.

   So we now:
     1. open the listening socket FIRST, answering every request with a light
        "preparing, back in a minute" page (auto-refreshing) + 503 for /api;
     2. run seeding / bank import / migrations in the background;
     3. swap in the real Express app once ready (no restart needed).
   Warm boots (database already prepared) go through the same path but
   finish in ~1-2 s, so visitors never notice. */
import http from "http";

let realApp = null;                      // set once the full app is ready
let bootState = { phase: "starting", startedAt: Date.now(), error: null };

const PREPARING_HTML = (lang) => `<!doctype html><html lang="${lang}" dir="${lang === "fa" ? "rtl" : "ltr"}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="8"><title>MED School</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,Tahoma,sans-serif;background:#eef1f6;color:#1e2b3d}
.b{background:#fff;border:1px solid #dbe3ee;border-radius:18px;padding:28px 32px;max-width:420px;text-align:center;box-shadow:0 20px 50px -30px rgba(38,82,122,.4)}
.s{width:40px;height:40px;border:4px solid #dbe3ee;border-top-color:#2f7fd1;border-radius:50%;margin:0 auto 14px;animation:r 1s linear infinite}@keyframes r{to{transform:rotate(360deg)}}
h1{font-size:1.1rem;margin:0 0 6px}p{margin:0;color:#647184;font-size:.92rem;line-height:1.7}</style></head><body><div class="b"><div class="s"></div>
${lang === "fa"
  ? "<h1>MED School در حال آماده‌سازی است</h1><p>اولین اجرا: بانک سؤال و محتوای اولیه در حال بارگذاری است. این صفحه خودش تازه می‌شود؛ معمولاً کمتر از یک دقیقه طول می‌کشد.</p>"
  : "<h1>MED School is getting ready</h1><p>First start: loading the question bank and initial content. This page refreshes itself; it usually takes under a minute.</p>"}
</div></body></html>`;

function placeholder(req, res) {
  if (req.url.startsWith("/api/health")) {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ ok: true, ready: false, phase: bootState.phase, uptime_s: Math.round((Date.now() - bootState.startedAt) / 1000) }));
  }
  if (req.url.startsWith("/api/")) {
    res.writeHead(503, { "Content-Type": "application/json", "Retry-After": "10", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ error: "starting", message_fa: "سرور در حال آماده‌سازی است؛ چند لحظه بعد دوباره تلاش کنید.", message_en: "Server is starting; retry in a moment." }));
  }
  const lang = /medlab_lang=en/.test(req.headers.cookie || "") ? "en" : "fa";
  res.writeHead(503, { "Content-Type": "text/html; charset=utf-8", "Retry-After": "10", "Cache-Control": "no-store" });
  res.end(PREPARING_HTML(lang));
}

const server = http.createServer((req, res) => (realApp ? realApp(req, res) : placeholder(req, res)));
// Slowloris / hung-connection protection (must satisfy headersTimeout > requestTimeout).
server.requestTimeout = 60_000;   // 60s to send the full request
server.headersTimeout = 65_000;   // a bit longer for headers
server.keepAliveTimeout = 30_000; // close idle keep-alive sockets
server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`✗ port ${PORT} is already in use (another MED School instance running?). Stop it or set PORT=… in .env`);
  } else {
    console.error("✗ server error:", err?.stack || err);
  }
  setTimeout(() => process.exit(1), 500);
});
server.listen(PORT, () => console.log(`🎓 MED School listening on http://localhost:${PORT} (preparing…)`));

async function main() {
  bootState.phase = "database";
  await initDb();                 // load the WASM SQLite engine first
  initSchema();                   // ensure all tables exist before we query them

  // FIRST-RUN ONLY seeding: if the database has no users, load the demo/content
  // seed once. On every later start (even after code changes) the existing data
  // is preserved — user accounts, exams, flashcards, attempts, everything stays.
  const existing = db.prepare("SELECT COUNT(*) n FROM users").get()?.n ?? 0;
  if (existing === 0) {
    bootState.phase = "seed";
    console.log("🌱 First run — seeding initial content (this happens only once)…");
    // Flush and quiesce this process's writer before the child seed runs:
    // with the seed child exporting the same DB file, a pending debounced write
    // from THIS process could otherwise land after the child's seeded image.
    try { persistNow({ force: true }); } catch { /* best-effort */ }
    try {
      // async child so the placeholder page keeps being served meanwhile
      await new Promise((resolve, reject) => {
        const child = execFile(process.execPath, [path.join(__dirname, "seed.js")], { env: process.env, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
          if (stdout) process.stdout.write(stdout);
          if (stderr) process.stderr.write(stderr);
          err ? reject(err) : resolve();
        });
        child.on("error", reject);
      });
      await reloadDb();           // force-reload the freshly-written database file
      initSchema();               // run any migrations on the reloaded DB
      // The boot-time backup ran BEFORE this seed, so first-day backups used to
      // hold only an empty schema — a restore would re-seed and look like data
      // loss. Take a forced snapshot NOW so backups/ always contains the full
      // seeded database from day one.
      try {
        persistNow({ force: true });
        snapshotDb({ force: true });
        console.log("💾 post-seed backup snapshot saved to backups/");
      } catch (e) { console.warn("post-seed snapshot skipped:", e?.message || e); }
    } catch (e) {
      console.error("Seed failed:", e.message);
    }
  } else {
    console.log(`✓ Existing database detected (${existing} users) — data preserved, no seeding.`);
  }

  try { const { ensureDefaultEducationPosts } = await import("./lib/blog.js"); const n = ensureDefaultEducationPosts(); if (n) console.log(`📝 ensured ${n} default education blog post change(s)`); } catch (e) { console.warn("default blog posts skipped", e?.message || e); }

  // Load the past-exam question banks that ship with the release. This is
  // idempotent — questions already present are skipped by fingerprint — so it
  // is safe on every restart, and it means a fresh deployment comes up with a
  // populated learning path instead of an empty one.
  bootState.phase = "question-bank";
  try {
    const { ensureQuestionBanks } = await import("./lib/bankbootstrap.js");
    const r = await ensureQuestionBanks();
    if (r && r.inserted) {
      const who = r.subjects.length ? ` (${r.subjects.join("، ")})` : "";
      console.log(`📚 imported ${r.inserted} official exam question(s)${who}; bank now ${r.after} cards`);
    } else if (r && r.cached) {
      console.log(`📚 question bank unchanged — ${r.after} cards (import skipped)`);
    } else if (r && r.after) {
      console.log(`📚 question bank ready — ${r.after} cards already present`);
    } else if (r && r.failed) {
      console.warn(`📚 question bank import had ${r.failed} problem file(s)`);
    }
    if (r?.curation && !r.curation.skipped && !r.curation.empty) {
      const c = r.curation;
      console.log(`🛣️  curated competitive path: ${c.topicsCovered} subjects, ${c.stages} titled stages, ${c.pathCards} free-path questions, ${c.premiumCards} premium-bank questions`);
    }
  } catch (e) {
    console.warn("question bank import skipped:", e?.message || e);
  }

  try {
    const { getSetting } = await import("./routes/content.js");
    const { resolveAiConfig } = await import("./lib/ai-engine.js");
    const ai = resolveAiConfig(getSetting("ai", {}));
    if (ai.apiKey) {
      console.log(`✓ Virtual-patient AI path ready (${ai.provider || "custom"} / ${ai.model || "default"})`);
    } else {
      console.log("✓ Virtual-patient AI path ready — mock until an API key is saved in Admin → AI");
    }
  } catch (e) {
    console.warn("AI path check skipped:", e?.message || e);
  }

  bootState.phase = "app";
  realApp = createApp();
  bootState.phase = "ready";
  // Pre-warm hot caches after the first tick so "ready" is not delayed.
  setTimeout(async () => {
    try { const m = await import("./routes/learn.js"); m.prewarmLearnCaches?.(); } catch { /* best-effort */ }
  }, 50);
  console.log(`🎓 MED School API ready on http://localhost:${PORT} (boot ${((Date.now() - bootState.startedAt) / 1000).toFixed(1)} s)`);

  // Streak-reminder scheduler: check hourly for learners who risk losing a streak.
  const tick = async () => {
    try { const n = await runStreakReminders(); if (n) console.log(`🔔 sent ${n} streak reminders`); } catch (e) { /* */ }
    // Admin analytics scheduler: daily health-alert notifications + weekly digest
    // (self-gated by per-day/per-week de-dup tags, so it's safe to call hourly).
    try { const { runAdminAnalyticsScheduler } = await import("./lib/analytics-notify.js"); const m = await runAdminAnalyticsScheduler(); if (m) console.log(`📊 sent ${m} admin analytics notifications`); } catch (e) { /* */ }
  };
  setTimeout(tick, 15000);                 // once shortly after boot
  setInterval(tick, 60 * 60 * 1000);       // then hourly
}

main().catch((e) => {
  // Keep listening so the operator sees the error in the browser/log instead
  // of a bare Passenger "application could not be started".
  bootState.phase = "failed"; bootState.error = String(e?.stack || e);
  console.error("Startup failed:", e);
  setTimeout(() => process.exit(1), 30_000);
});
