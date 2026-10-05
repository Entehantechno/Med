/* notify.js — unified notifications: (1) in-app bell feed, (2) optional browser Web Push.
   Web Push is best-effort: if the `web-push` package or VAPID keys are missing, it
   silently degrades to in-app only, so the app still runs on a bare local install. */
import { db, persistNow } from "../db.js";

let webpush = null;
let vapidReady = false;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@medschool.local";

// Lazy, optional load — never crash if web-push isn't installed.
async function ensureWebPush() {
  if (webpush !== null) return webpush;
  try {
    const mod = await import("web-push");
    webpush = mod.default || mod;
    if (VAPID_PUBLIC && VAPID_PRIVATE) {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
      vapidReady = true;
    }
  } catch { webpush = false; } // not installed
  return webpush;
}

export function vapidPublicKey() { return VAPID_PUBLIC; }
export function pushConfigured() { return !!(VAPID_PUBLIC && VAPID_PRIVATE); }

/* Create an in-app notification and (best-effort) fire a browser push. */
export async function notify(userId, n) {
  db.prepare(`INSERT INTO notifications (user_id, kind, title_fa, title_en, body_fa, body_en, icon, link)
    VALUES (?,?,?,?,?,?,?,?)`).run(
    userId, n.kind || "system", n.title_fa || "", n.title_en || "", n.body_fa || "", n.body_en || "",
    n.icon || "clock", n.link || ""
  );
  persistNow();
  // browser push (optional)
  try {
    const wp = await ensureWebPush();
    if (!wp || !vapidReady) return;
    const subs = db.prepare("SELECT * FROM push_subscriptions WHERE user_id=?").all(userId);
    const payload = JSON.stringify({
      title: n.title_fa || n.title_en, body: n.body_fa || n.body_en, icon: "/icon-192.png", link: n.link || "/",
    });
    for (const s of subs) {
      try {
        await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      } catch (e) {
        // stale subscription (410/404) → remove it
        if (e?.statusCode === 410 || e?.statusCode === 404) db.prepare("DELETE FROM push_subscriptions WHERE id=?").run(s.id);
      }
    }
  } catch { /* push not available — in-app already stored */ }
}

/* Streak reminder logic: for each active learner who practiced yesterday but not
   today, remind them to keep the streak. Idempotent per day (checks last reminder). */
export async function runStreakReminders() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
  const rows = db.prepare(`
    SELECT lp.user_id, lp.streak, lp.last_active FROM learner_profiles lp
    JOIN users u ON u.id = lp.user_id
    WHERE u.role='learner' AND u.status='active' AND lp.streak > 0
      AND lp.last_active = ?`).all(yesterday);
  let sent = 0;
  for (const r of rows) {
    // avoid duplicate reminder the same day
    const already = db.prepare(`SELECT 1 FROM notifications WHERE user_id=? AND kind='streak' AND date(created_at)=date('now')`).get(r.user_id);
    if (already) continue;
    await notify(r.user_id, {
      kind: "streak", icon: "clock", link: "path",
      title_fa: "🔥 استریک‌ت در خطر است!", title_en: "🔥 Your streak is at risk!",
      body_fa: `استریک ${r.streak} روزه‌ات را با یک درس کوتاه امروز حفظ کن.`,
      body_en: `Keep your ${r.streak}-day streak alive with one short lesson today.`,
    });
    sent++;
  }
  return sent;
}
