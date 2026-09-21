/* pwa.js — Installable-app (PWA) tracking + admin analytics.

   AI-free. Records lightweight, privacy-respecting funnel events for the
   "add to home screen" experience so the admin can see how many learners are
   installing MED School as a phone app and how well the prompt converts.

   Events (pwa_events.event):
     • prompt_shown — the custom install card was displayed
     • accepted     — user tapped "Install" (Android native prompt accepted)
     • dismissed    — user tapped "Later" / dismissed
     • installed    — the OS fired appinstalled (confirmed on device)
     • launch       — app opened; standalone=1 means launched as an installed app
*/
import { db, persistNow } from "../db.js";
import { getGameConfig } from "./gameconfig.js";

const VALID = new Set(["prompt_shown", "accepted", "dismissed", "installed", "launch"]);
const PLATFORMS = new Set(["android", "ios", "desktop", "other"]);

function tehranDay() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
}

/* Record a single funnel event (best-effort; never throws to the caller). */
export function recordPwaEvent({ userId = null, event, platform = "other", standalone = false }) {
  if (!VALID.has(event)) return { ok: false, error: "bad event" };
  const plat = PLATFORMS.has(platform) ? platform : "other";
  db.prepare(
    `INSERT INTO pwa_events (user_id, event, platform, standalone, day)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, event, plat, standalone ? 1 : 0, tehranDay());
  persistNow();
  return { ok: true };
}

/* The client-facing PWA config (safe subset of gameconfig.pwa). */
export function pwaClientConfig() {
  const cfg = getGameConfig().pwa || {};
  return {
    enabled: cfg.enabled !== false,
    show_prompt: cfg.show_prompt !== false,
    snooze_days: Number(cfg.snooze_days) > 0 ? Number(cfg.snooze_days) : 14,
    ios_hint: cfg.ios_hint !== false,
    offline_enabled: cfg.offline_enabled !== false,
  };
}

/* Admin analytics: funnel counts, install rate, platform split, recent trend. */
export function pwaStats() {
  const total = (e) =>
    db.prepare(`SELECT COUNT(*) c FROM pwa_events WHERE event=?`).get(e)?.c || 0;

  const shown = total("prompt_shown");
  const accepted = total("accepted");
  const dismissed = total("dismissed");
  const installed = total("installed");

  // distinct users confirmed installed
  const installedUsers =
    db.prepare(
      `SELECT COUNT(DISTINCT user_id) c FROM pwa_events WHERE event='installed' AND user_id IS NOT NULL`
    ).get()?.c || 0;

  // distinct users who launched in standalone (actually use the installed app)
  const standaloneUsers =
    db.prepare(
      `SELECT COUNT(DISTINCT user_id) c FROM pwa_events WHERE event='launch' AND standalone=1 AND user_id IS NOT NULL`
    ).get()?.c || 0;

  const launches = total("launch");
  const standaloneLaunches =
    db.prepare(`SELECT COUNT(*) c FROM pwa_events WHERE event='launch' AND standalone=1`).get()?.c || 0;

  // platform split of installs
  const platform = db
    .prepare(
      `SELECT platform, COUNT(*) c FROM pwa_events WHERE event='installed' GROUP BY platform ORDER BY c DESC`
    )
    .all();

  // last-14-day trend of prompt_shown + installed
  const trend = db
    .prepare(
      `SELECT day,
              SUM(CASE WHEN event='prompt_shown' THEN 1 ELSE 0 END) AS shown,
              SUM(CASE WHEN event='installed'    THEN 1 ELSE 0 END) AS installed
       FROM pwa_events
       WHERE day >= date('now','-14 days')
       GROUP BY day ORDER BY day ASC`
    )
    .all();

  const learners =
    db.prepare(`SELECT COUNT(*) c FROM learner_profiles`).get()?.c || 0;

  const installRate = shown ? Math.round((accepted / shown) * 100) : 0;
  const reach = learners ? Math.round((standaloneUsers / learners) * 100) : 0;

  return {
    funnel: { shown, accepted, dismissed, installed },
    installedUsers,
    standaloneUsers,
    launches,
    standaloneLaunches,
    installRate,        // % of shown prompts that were accepted
    reach,              // % of learners actively using the installed app
    learners,
    platform,
    trend,
    config: pwaClientConfig(),
  };
}
