/* reminders.js — Smart, behavior-based reminders (habit-forming + win-back).

   Research-informed (behavior triggers, not a fixed wall clock; loss-framed
   "save" reminders separate from gentle "routine" ones; act fast in the first
   few days then stop; a small daily cap to avoid fatigue). All AI-free: rules
   are deterministic and the message copy is our own, admin-tunable via
   gameconfig.reminders and gated by the `smart_reminders` feature flag.

   Reminder types produced:
     • goal   — routine: you haven't hit today's daily goal yet
     • streak — save: you have an active streak and haven't practiced today
     • winback— re-engagement: inactive for 1..N days, come back

   Timing: if respect_habit_window is on, a learner is only reminded when the
   current Tehran hour is within ~1h of their revealed most-active hour. */
import { db } from "../db.js";
import { getGameConfig } from "./gameconfig.js";
import { notify } from "./notify.js";

function tehranNow() {
  // {day: 'YYYY-MM-DD', hour: 0..23}
  const s = new Date().toLocaleString("en-US", { timeZone: "Asia/Tehran", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" });
  // s like "07/11/2026, 18" → normalize
  const d = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
  const hour = parseInt(new Date().toLocaleString("en-US", { timeZone: "Asia/Tehran", hour12: false, hour: "2-digit" }).replace(/[^0-9]/g, ""), 10) % 24;
  return { day: d, hour };
}
function daysBetween(a, b) {
  if (!a || !b) return 999;
  return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
}

/* The learner's revealed "habit window": the Tehran hour they most often earn
   XP. Falls back to null (any time) if there's no data. */
function habitHour(userId) {
  const row = db.prepare(`
    SELECT CAST(strftime('%H', datetime(created_at, '+3 hours', '+30 minutes')) AS INTEGER) AS hr, COUNT(*) c
    FROM xp_events WHERE user_id=? GROUP BY hr ORDER BY c DESC LIMIT 1`).get(userId);
  return row ? row.hr : null;
}

function todayXp(userId, day) {
  return db.prepare("SELECT COALESCE(SUM(amount),0) s FROM xp_events WHERE user_id=? AND day=?").get(userId, day).s;
}
// NOTE: created_at is stored in UTC, but `day` is the TEHRAN day. Compare on the
// Tehran-shifted timestamp (+3:30) so the daily cap/dedup is correct near the
// UTC/Tehran date boundary (a plain date(created_at) drifted by a day there).
function remindersSentToday(userId, day) {
  return db.prepare("SELECT COUNT(*) c FROM notifications WHERE user_id=? AND kind IN ('goal','streak','winback') AND date(created_at,'+3 hours','+30 minutes')=date(?)").get(userId, day).c;
}
function alreadySent(userId, kind, day) {
  return !!db.prepare("SELECT 1 FROM notifications WHERE user_id=? AND kind=? AND date(created_at,'+3 hours','+30 minutes')=date(?)").get(userId, kind, day);
}

/* ---- message pools (our own copy; admin can extend later) ---- */
const POOL = {
  goal: [
    { fa: ["🎯 هدف امروزت منتظرته", "فقط چند دقیقه تا رسیدن به هدف روزانه‌ات مانده — همین حالا ادامه بده!"],
      en: ["🎯 Today's goal is waiting", "You're just a few minutes from your daily goal — jump back in!"] },
    { fa: ["📚 یک درس کوتاه؟", "یک درس کوتاه امروز، یک قدم به قبولی نزدیک‌ترت می‌کند."],
      en: ["📚 One quick lesson?", "One short lesson today gets you a step closer."] },
  ],
  streak: [
    { fa: ["🔥 استریک‌ت در خطر است!", "استریک {streak} روزه‌ات را با یک درس کوتاه امروز حفظ کن."],
      en: ["🔥 Your streak is at risk!", "Save your {streak}-day streak with one short lesson today."] },
    { fa: ["🔥 نگذار استریک‌ت بشکند", "{streak} روز پشت‌سرهم! امروز هم ادامه بده تا زنجیره حفظ شود."],
      en: ["🔥 Don't break the chain", "{streak} days in a row! Keep it going today."] },
  ],
  winback: [
    { fa: ["👋 دلمان برایت تنگ شده", "برگرد و از همان‌جا که بودی ادامه بده — فقط چند دقیقه کافی است."],
      en: ["👋 We miss you", "Come back and pick up where you left off — just a few minutes."] },
    { fa: ["💪 وقت بازگشت است", "یک درس کوتاه امروز، عادت مطالعه‌ات را دوباره روشن می‌کند."],
      en: ["💪 Time to come back", "A short lesson today reignites your study habit."] },
  ],
};
// deterministic pick (stable per user+kind+day) — AI-free
function pick(kind, userId, day) {
  const arr = POOL[kind];
  let h = 0; const s = `${kind}:${userId}:${day}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}
const fill = (s, streak) => s.replace("{streak}", streak);

/* Decide which single reminder (if any) a learner should get right now. */
export function planFor(userId, cfg, now) {
  const p = db.prepare("SELECT streak, last_active, daily_goal FROM learner_profiles WHERE user_id=?").get(userId);
  if (!p) return null;
  const gap = daysBetween(p.last_active, now.day); // 0 = active today

  // win-back: inactive for winback_after..winback_days
  if (gap >= (cfg.winback_after || 1) && gap <= (cfg.winback_days || 7)) {
    return { kind: "winback", streak: p.streak || 0 };
  }
  // practiced yesterday, not today → streak "save"
  if (cfg.streak_save && p.streak > 0 && gap === 1) {
    return { kind: "streak", streak: p.streak };
  }
  // active today but hasn't met today's goal → gentle "goal" nudge
  if (cfg.goal_reminder && gap === 0) {
    const done = todayXp(userId, now.day);
    if (done < (p.daily_goal || 30)) return { kind: "goal", streak: p.streak || 0 };
  }
  return null;
}

/* Run the smart reminder pass. Returns { sent, byKind, considered }.
   `force` (admin test run) ignores the habit-window timing gate. */
export async function runSmartReminders({ force = false } = {}) {
  const cfg = getGameConfig().reminders || {};
  const out = { sent: 0, byKind: { goal: 0, streak: 0, winback: 0 }, considered: 0 };
  const now = tehranNow();

  const learners = db.prepare(`
    SELECT lp.user_id FROM learner_profiles lp JOIN users u ON u.id=lp.user_id
    WHERE u.role='learner' AND u.status='active'`).all();

  for (const { user_id } of learners) {
    out.considered++;
    if (remindersSentToday(user_id, now.day) >= (cfg.daily_cap || 2)) continue;
    const plan = planFor(user_id, cfg, now);
    if (!plan) continue;
    if (alreadySent(user_id, plan.kind, now.day)) continue;
    // habit-window timing gate (skip for win-back — those fire regardless; and skip when forced)
    if (!force && cfg.respect_habit_window && plan.kind !== "winback") {
      const hh = habitHour(user_id);
      if (hh != null && Math.abs(hh - now.hour) > 1) continue;
    }
    const msg = pick(plan.kind, user_id, now.day);
    await notify(user_id, {
      kind: plan.kind, icon: plan.kind === "streak" ? "clock" : plan.kind === "winback" ? "bulb" : "target",
      link: plan.kind === "winback" ? "home" : "path",
      title_fa: msg.fa[0], title_en: msg.en[0],
      body_fa: fill(msg.fa[1], plan.streak), body_en: fill(msg.en[1], plan.streak),
    });
    out.sent++; out.byKind[plan.kind]++;
  }
  return out;
}

/* A no-send DRY RUN for the admin: how many learners currently qualify for each
   reminder type (so the admin can preview reach before sending). */
export function previewSmartReminders() {
  const cfg = getGameConfig().reminders || {};
  const now = tehranNow();
  const res = { goal: 0, streak: 0, winback: 0, eligible: 0, capped: 0, total: 0 };
  const learners = db.prepare(`
    SELECT lp.user_id FROM learner_profiles lp JOIN users u ON u.id=lp.user_id
    WHERE u.role='learner' AND u.status='active'`).all();
  for (const { user_id } of learners) {
    res.total++;
    if (remindersSentToday(user_id, now.day) >= (cfg.daily_cap || 2)) { res.capped++; continue; }
    const plan = planFor(user_id, cfg, now);
    if (!plan || alreadySent(user_id, plan.kind, now.day)) continue;
    res[plan.kind]++; res.eligible++;
  }
  return { now, ...res };
}
