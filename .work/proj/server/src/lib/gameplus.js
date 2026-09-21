/* gameplus.js — Advanced gamification layer on top of gamify.js.
   Adds the mechanics that make retention best-in-class (informed by Duolingo's
   documented system): customisable daily goals, daily quests, timed daily
   chests (Early Bird / Night Owl), a gem shop with powerups (XP Boost, Streak
   Freeze, Timer Boost, Streak Repair), personal records, and a streak calendar.
   All state is per-user in SQLite; days/weeks use the Tehran timezone helpers. */
import { db, persistNow } from "../db.js";
import { getProfile, tehranDay, maxHearts } from "./gamify.js";

/* ---------------- Daily goal ---------------- */
// Duolingo-style calibrated goals: user picks a target they can actually hit.
export const DAILY_GOALS = [
  { value: 10, fa: "آسان", en: "Casual" },
  { value: 20, fa: "معمولی", en: "Regular" },
  { value: 30, fa: "جدی", en: "Serious" },
  { value: 50, fa: "شدید", en: "Intense" },
];
export function setDailyGoal(userId, value) {
  const v = DAILY_GOALS.some((g) => g.value === value) ? value : 30;
  db.prepare("UPDATE learner_profiles SET daily_goal=? WHERE user_id=?").run(v, userId);
  persistNow();
  return getProfile(userId);
}
// XP earned today (from xp_events) → progress toward the daily goal.
export function todayXp(userId) {
  const day = tehranDay();
  return db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM xp_events WHERE user_id=? AND day=?").get(userId, day).n;
}

/* ---------------- Powerups / gem shop ---------------- */
export const SHOP = [
  { slug: "streak_freeze", cost: 200, fa: "واکسن استریک (آمپول)", en: "Streak vaccine (ampoule)", icon: "ampoule",
    descFa: "یک واکسن/آمپول در انبار بماند؛ اگر یک روز درس نزدی خودکار تزریق می‌شود و استریک نمی‌شکند", descEn: "Keep a vaccine/ampoule in reserve — miss a day and it injects automatically so the streak survives" },
  { slug: "xp_boost", cost: 150, fa: "بوست XP (۱۵ دقیقه ۲ برابر)", en: "XP Boost (15 min, 2×)", icon: "bolt",
    descFa: "تا ۱۵ دقیقه، امتیازها دو برابر می‌شوند", descEn: "Double XP for the next 15 minutes" },
  { slug: "timer_boost", cost: 100, fa: "بوست زمان", en: "Timer Boost", icon: "clock",
    descFa: "در تمرین‌های زمان‌دار، زمان بیشتری بگیرید", descEn: "Extra time in timed drills" },
  { slug: "heart_refill", cost: 120, fa: "پر کردن قلب‌ها", en: "Refill hearts", icon: "heart",
    descFa: "همهٔ قلب‌ها را دوباره پر کنید", descEn: "Refill all hearts" },
  { slug: "streak_repair", cost: 350, fa: "تعمیر استریک", en: "Streak Repair", icon: "wrench",
    descFa: "استریک از‌دست‌رفتهٔ دیروز را بازیابی کنید", descEn: "Restore a streak you just lost" },
];
export function buyItem(userId, slug) {
  const item = SHOP.find((s) => s.slug === slug);
  if (!item) return { ok: false, error: "unknown item" };
  const p = getProfile(userId);
  if (p.gems < item.cost) return { ok: false, error: "not enough gems" };
  const gems = p.gems - item.cost;
  const now = new Date();
  if (slug === "streak_freeze") {
    if ((p.freezes || 0) >= 5) return { ok: false, error: "freeze_cap" };
    db.prepare("UPDATE learner_profiles SET gems=?, freezes=MIN(5, freezes+1) WHERE user_id=?").run(gems, userId);
  } else if (slug === "xp_boost") {
    const until = new Date(now.getTime() + 15 * 60000).toISOString();
    db.prepare("UPDATE learner_profiles SET gems=?, xp_boost_until=? WHERE user_id=?").run(gems, until, userId);
  } else if (slug === "timer_boost") {
    db.prepare("UPDATE learner_profiles SET gems=?, timer_boosts=timer_boosts+1 WHERE user_id=?").run(gems, userId);
  } else if (slug === "heart_refill") {
    db.prepare("UPDATE learner_profiles SET gems=?, hearts=?, hearts_updated=? WHERE user_id=?")
      .run(gems, maxHearts(), now.toISOString(), userId);
  } else if (slug === "streak_repair") {
    const ok = repairStreak(userId);
    if (!ok) return { ok: false, error: "nothing to repair" };
    db.prepare("UPDATE learner_profiles SET gems=?, streak_repairs_used=streak_repairs_used+1 WHERE user_id=?").run(gems, userId);
  }
  persistNow();
  return { ok: true, profile: getProfile(userId) };
}
export function xpBoostActive(userId) {
  const p = getProfile(userId);
  return p.xp_boost_until && new Date(p.xp_boost_until) > new Date();
}
// If the user was active yesterday-1 (i.e. broke a 1-day gap), restore streak by +1.
function repairStreak(userId) {
  const p = getProfile(userId);
  const today = tehranDay();
  if (!p.last_active) return false;
  const gap = Math.round((new Date(today + "T00:00:00Z") - new Date(p.last_active + "T00:00:00Z")) / 86400000);
  if (gap >= 2) { // a break happened; give back the streak as if not broken
    db.prepare("UPDATE learner_profiles SET streak=?, last_active=? WHERE user_id=?")
      .run((p.best_streak > p.streak ? p.streak : p.streak) + 1, today, userId);
    return true;
  }
  return false;
}

/* ---------------- Daily quests ---------------- */
// A small rotating set generated per user per day. Variety drives engagement.
const QUEST_POOL = [
  { slug: "xp", goal: 30, gems: 20, fa: "۳۰ امتیاز کسب کن", en: "Earn 30 XP", metric: "xp" },
  { slug: "lessons", goal: 3, gems: 20, fa: "۳ درس کامل کن", en: "Complete 3 lessons", metric: "lessons" },
  { slug: "perfect", goal: 1, gems: 25, fa: "۱ درس بی‌نقص بزن", en: "Get 1 perfect lesson", metric: "perfect" },
  { slug: "review", goal: 5, gems: 15, fa: "۵ کارت مرور کن", en: "Review 5 cards", metric: "review" },
];
export function getQuests(userId) {
  const day = tehranDay();
  let rows = db.prepare("SELECT * FROM user_quests WHERE user_id=? AND day=?").all(userId, day);
  if (rows.length === 0) {
    // pick 3 quests deterministically from the pool for this user+day
    const seed = hashStr(userId + ":" + day);
    const picks = pickN(QUEST_POOL, 3, seed);
    const ins = db.prepare("INSERT OR IGNORE INTO user_quests (user_id, day, slug, goal, progress, reward_gems) VALUES (?,?,?,?,0,?)");
    for (const q of picks) ins.run(userId, day, q.slug, q.goal, q.gems);
    persistNow();
    rows = db.prepare("SELECT * FROM user_quests WHERE user_id=? AND day=?").all(userId, day);
  }
  return rows;
}
// Advance quest progress for a given metric.
export function progressQuests(userId, metric, amount = 1) {
  const day = tehranDay();
  getQuests(userId); // ensure today's quests exist
  const q = db.prepare("SELECT * FROM user_quests WHERE user_id=? AND day=? AND slug=?").get(userId, day, metric);
  if (!q || q.claimed) return;
  const prog = Math.min(q.goal, q.progress + amount);
  db.prepare("UPDATE user_quests SET progress=? WHERE id=?").run(prog, q.id);
  persistNow();
}
export function claimQuest(userId, questId) {
  const q = db.prepare("SELECT * FROM user_quests WHERE id=? AND user_id=?").get(questId, userId);
  if (!q || q.claimed || q.progress < q.goal) return { ok: false };
  db.prepare("UPDATE user_quests SET claimed=1 WHERE id=?").run(q.id);
  db.prepare("UPDATE learner_profiles SET gems=gems+? WHERE user_id=?").run(q.reward_gems, userId);
  persistNow();
  return { ok: true, gems: q.reward_gems, profile: getProfile(userId) };
}

/* ---------------- Timed daily chests ---------------- */
// Early Bird (05:00–12:00) and Night Owl (18:00–24:00) in Tehran time.
export function getChests(userId) {
  const day = tehranDay();
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", hour: "2-digit", hour12: false }).format(new Date()));
  const defs = [
    { slug: "earlybird", fa: "صندوق سحرخیز", en: "Early Bird Chest", from: 5, to: 12, gems: 30 },
    { slug: "nightowl", fa: "صندوق شب‌زنده‌دار", en: "Night Owl Chest", from: 18, to: 24, gems: 30 },
  ];
  return defs.map((d) => {
    const rec = db.prepare("SELECT * FROM daily_chests WHERE user_id=? AND day=? AND slug=?").get(userId, day, d.slug);
    const available = hour >= d.from && hour < d.to && !rec?.opened_at;
    return { ...d, opened: !!rec?.opened_at, available };
  });
}
export function openChest(userId, slug) {
  const day = tehranDay();
  const chests = getChests(userId);
  const c = chests.find((x) => x.slug === slug);
  if (!c || !c.available) return { ok: false, error: "not available" };
  db.prepare("INSERT OR IGNORE INTO daily_chests (user_id, day, slug, opened_at, reward_gems) VALUES (?,?,?,?,?)")
    .run(userId, day, slug, new Date().toISOString(), c.gems);
  db.prepare("UPDATE learner_profiles SET gems=gems+? WHERE user_id=?").run(c.gems, userId);
  persistNow();
  return { ok: true, gems: c.gems, profile: getProfile(userId) };
}

/* ---------------- Streak calendar + personal records ---------------- */
export function logStreakDay(userId) {
  db.prepare("INSERT OR IGNORE INTO streak_days (user_id, day) VALUES (?,?)").run(userId, tehranDay());
}
export function streakCalendar(userId, days = 30) {
  // returns [{day, frozen}] — frozen days render as a snowflake vs a checkmark
  const rows = db.prepare("SELECT day, frozen FROM streak_days WHERE user_id=? ORDER BY day DESC LIMIT ?").all(userId, days);
  return rows.map((r) => ({ day: r.day, frozen: !!r.frozen }));
}
/* Streak status: current/best/perfect, freeze count, whether the streak is at
   risk today (no lesson yet + no freeze), and the next Streak-Society milestone. */
export function streakStatus(userId) {
  const p = getProfile(userId);
  const today = tehranDay();
  const doneToday = !!db.prepare("SELECT 1 FROM streak_days WHERE user_id=? AND day=? AND frozen=0").get(userId, today);
  const SOCIETY = [3, 7, 14, 30, 60, 100, 180, 365];
  const next = SOCIETY.find((d) => d > (p.streak || 0)) || null;
  return {
    streak: p.streak || 0,
    best: p.best_streak || 0,
    perfect: p.perfect_streak || 0,
    freezes: p.freezes || 0,
    doneToday,
    atRisk: !doneToday && (p.streak || 0) > 0,      // needs a lesson today to keep it
    societyTier: p.society_tier || 0,
    nextMilestone: next,
    toNext: next ? next - (p.streak || 0) : null,
  };
}
export function personalRecords(userId) {
  const p = getProfile(userId);
  const bestDayXp = db.prepare("SELECT COALESCE(MAX(s),0) AS m FROM (SELECT SUM(amount) s FROM xp_events WHERE user_id=? GROUP BY day)").get(userId).m;
  const totalLessons = db.prepare("SELECT COUNT(*) c FROM node_progress WHERE user_id=? AND completed_at IS NOT NULL").get(userId).c;
  const perfect = db.prepare("SELECT COUNT(*) c FROM node_progress WHERE user_id=? AND stars>=5").get(userId).c;
  return {
    bestStreak: p.best_streak, currentStreak: p.streak,
    totalXp: p.xp, bestDayXp, totalLessons, perfectLessons: perfect,
  };
}

/* ---------------- helpers ---------------- */
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }
function pickN(arr, n, seed) {
  const a = [...arr]; const out = [];
  for (let i = 0; i < n && a.length; i++) { const idx = (seed + i * 7) % a.length; out.push(a.splice(idx, 1)[0]); }
  return out;
}
