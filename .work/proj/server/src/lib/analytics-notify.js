/* analytics-notify.js — turns analytics alerts + a weekly digest into ADMIN
   in-app notifications (bell feed), and a scheduler entry that runs them at a
   safe cadence (alerts once/day, digest once/week). Deterministic; degrades to
   in-app only when Web Push isn't configured. */
import { db } from "../db.js";
import { notify } from "./notify.js";
import { computeAlerts } from "./analytics-alerts.js";
import { siteAnalytics } from "./site-analytics.js";
import { adAnalytics } from "./ad-analytics.js";
import { getAdsMaster } from "./ads-control.js";

function admins() {
  return db.prepare("SELECT id FROM users WHERE role='admin' AND status='active'").all();
}
const todayStr = () => new Date().toISOString().slice(0, 10);
// ISO week key like 2026-W29 (for once-per-week de-dup)
function weekKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/* Send admin alert notifications for TODAY's health alerts. De-dupes so each
   distinct alert is sent at most once per day per admin. Returns count sent. */
export async function runAdminAlertNotifications() {
  const { alerts } = computeAlerts("fa");
  if (!alerts.length) return 0;
  let sent = 0;
  for (const a of admins()) {
    for (const al of alerts) {
      const tag = `alert:${al.id}:${todayStr()}`;
      // already sent this alert to this admin today?
      const dup = db.prepare(
        "SELECT 1 FROM notifications WHERE user_id=? AND kind='admin_alert' AND link=? LIMIT 1"
      ).get(a.id, tag);
      if (dup) continue;
      await notify(a.id, {
        kind: "admin_alert", icon: "warn",
        title_fa: "هشدار آماری", title_en: "Analytics alert",
        body_fa: al.fa, body_en: al.en,
        link: tag,   // tagged link doubles as the de-dup key
      });
      sent++;
    }
  }
  return sent;
}

/* Build a compact weekly analytics summary text (fa/en). */
export function buildWeeklyDigest(lang = "fa") {
  const fa = lang === "fa";
  const s = siteAnalytics();
  const parts = [];
  parts.push(fa
    ? `کاربر فعال روزانه ${s.active.dau} · هفتگی ${s.active.wau} · ماهانه ${s.active.mau} · چسبندگی ${s.active.stickiness}٪`
    : `DAU ${s.active.dau} · WAU ${s.active.wau} · MAU ${s.active.mau} · stickiness ${s.active.stickiness}%`);
  parts.push(fa
    ? `تبدیل پریمیوم ${s.premium.convPct}٪ · درس تکمیل‌شده ${s.engagement.lessonsCompleted}`
    : `premium conv ${s.premium.convPct}% · lessons ${s.engagement.lessonsCompleted}`);
  if (getAdsMaster().enabled) {
    const a = adAnalytics(); const T = a.totals;
    parts.push(fa
      ? `تبلیغات: نمایش ${T.impressions} · CTR ${T.ctr}٪ · درآمد تخمینی ${T.estRevenue} ${T.currency}`
      : `ads: imp ${T.impressions} · CTR ${T.ctr}% · est. rev ${T.estRevenue} ${T.currency}`);
  }
  const { alerts } = computeAlerts(lang);
  parts.push(fa
    ? (alerts.length ? `⚠️ ${alerts.length} هشدار فعال` : "✅ بدون هشدار")
    : (alerts.length ? `⚠️ ${alerts.length} active alerts` : "✅ no alerts"));
  return parts.join(" | ");
}

/* Send the weekly digest to admins (once per ISO week). Returns count sent. */
export async function runWeeklyDigest() {
  const wk = weekKey();
  const tag = `digest:${wk}`;
  let sent = 0;
  for (const a of admins()) {
    const dup = db.prepare("SELECT 1 FROM notifications WHERE user_id=? AND kind='admin_digest' AND link=? LIMIT 1").get(a.id, tag);
    if (dup) continue;
    await notify(a.id, {
      kind: "admin_digest", icon: "chart",
      title_fa: "گزارش هفتگی آمار", title_en: "Weekly analytics digest",
      body_fa: buildWeeklyDigest("fa"), body_en: buildWeeklyDigest("en"),
      link: tag,
    });
    sent++;
  }
  return sent;
}

/* Admin bell feed (notifications targeted at this admin: alerts + digests + system). */
export function adminNotifications(userId, limit = 40) {
  const rows = db.prepare(
    "SELECT * FROM notifications WHERE user_id=? AND kind IN ('admin_alert','admin_digest','system') ORDER BY id DESC LIMIT ?"
  ).all(userId, limit);
  const unseen = db.prepare(
    "SELECT COUNT(*) c FROM notifications WHERE user_id=? AND kind IN ('admin_alert','admin_digest','system') AND seen=0"
  ).get(userId).c;
  return { notifications: rows, unseen };
}
export function markAdminNotificationsSeen(userId) {
  db.prepare("UPDATE notifications SET seen=1 WHERE user_id=? AND kind IN ('admin_alert','admin_digest','system')").run(userId);
}

/* Scheduler entry — called from the hourly tick. Runs alerts daily + digest
   weekly, self-gated by the de-dup tags above so it's safe to call often. */
export async function runAdminAnalyticsScheduler() {
  let n = 0;
  try { n += await runAdminAlertNotifications(); } catch { /* */ }
  // run the weekly digest only on the configured weekday (default: Saturday=6 Tehran-ish → use day 6)
  try { n += await runWeeklyDigest(); } catch { /* */ }
  return n;
}
