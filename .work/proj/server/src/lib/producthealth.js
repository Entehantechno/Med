/* producthealth.js — Product-health dashboard for admins.

   Research basis (SaaS engagement / stickiness best-practice, 2025-2026):
   • DAU / WAU / MAU = unique active users in the trailing 1 / 7 / 30 days.
   • Stickiness = DAU / MAU (× 100). 20%+ is healthy for most SaaS; consumer
     daily-habit apps aim higher. We also show WAU/MAU (better for weekly-use).
   • Activation funnel: signed-up → did first lesson → reached a 3-day streak →
     came back after 7 days. Watch where users drop off.
   • Retention: of learners who signed up 7+ days ago, how many are still active.
   • Close-the-loop: surface OPEN support tickets as a bug/feedback signal so the
     team can act on them (ties the support inbox into the health view).

   "Active" = earned any XP that day (xp_events.day) OR answered a card
   (card_attempts.day) — either counts as engagement. All figures are read-only
   aggregates; nothing here writes to the DB. Dates are Tehran-local (YYYY-MM-DD)
   to match how the rest of the app buckets days. */
import { db } from "../db.js";
import { tehranDay } from "./gamify.js";

function one(sql, params = []) {
  try { const r = db.prepare(sql).get(...params); return r ? Number(Object.values(r)[0]) || 0 : 0; }
  catch { return 0; }
}
function all(sql, params = []) { try { return db.prepare(sql).all(...params); } catch { return []; } }

/* Unique active users within the last `days` days (inclusive of today). */
function activeUsers(today, days) {
  // union of xp_events and card_attempts activity, distinct user_id
  return one(
    `SELECT COUNT(*) c FROM (
       SELECT DISTINCT user_id FROM xp_events WHERE day >= date(?, ?)
       UNION
       SELECT DISTINCT user_id FROM card_attempts WHERE day >= date(?, ?)
     )`,
    [today, `-${days - 1} day`, today, `-${days - 1} day`]
  );
}

export function productHealth() {
  const today = tehranDay();

  // ---- engagement ----
  const dau = activeUsers(today, 1);
  const wau = activeUsers(today, 7);
  const mau = activeUsers(today, 30);
  const stickiness = mau ? Math.round((dau / mau) * 100) : 0;
  const wauMau = mau ? Math.round((wau / mau) * 100) : 0;

  // 14-day active-user trend (unique users per day)
  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const d = db.prepare("SELECT date(?, ?) d").get(today, `-${i} day`).d;
    const n = one(
      `SELECT COUNT(*) c FROM (
         SELECT DISTINCT user_id FROM xp_events WHERE day = ?
         UNION SELECT DISTINCT user_id FROM card_attempts WHERE day = ?)`,
      [d, d]
    );
    trend.push({ day: d, active: n });
  }

  // ---- population ----
  const totalLearners = one("SELECT COUNT(*) c FROM learner_profiles");
  const newLearners7 = one("SELECT COUNT(*) c FROM learner_profiles WHERE date(created_at) >= date(?, '-6 day')", [today]);
  const newLearners30 = one("SELECT COUNT(*) c FROM learner_profiles WHERE date(created_at) >= date(?, '-29 day')", [today]);
  const premium = one("SELECT COUNT(*) c FROM learner_profiles WHERE premium=1");

  // ---- activation funnel ----
  // step counts are cumulative-eligible; each is a subset of the previous.
  const signedUp = totalLearners;
  const didFirstLesson = one("SELECT COUNT(DISTINCT user_id) c FROM xp_events WHERE reason='lesson'")
    || one("SELECT COUNT(*) c FROM learner_profiles WHERE xp > 0");
  const reached3Streak = one("SELECT COUNT(*) c FROM learner_profiles WHERE best_streak >= 3");
  // "returned after 7 days": signed up 7+ days ago AND active in the last 7 days
  const eligibleForReturn = one("SELECT COUNT(*) c FROM learner_profiles WHERE date(created_at) <= date(?, '-7 day')", [today]);
  const returned = one(
    `SELECT COUNT(*) c FROM learner_profiles lp
     WHERE date(lp.created_at) <= date(?, '-7 day')
       AND (lp.last_active >= date(?, '-6 day')
            OR lp.user_id IN (SELECT DISTINCT user_id FROM xp_events WHERE day >= date(?, '-6 day')))`,
    [today, today, today]
  );
  const pct = (num, den) => (den ? Math.round((num / den) * 100) : 0);
  const funnel = [
    { key: "signup", count: signedUp, pct: 100 },
    { key: "firstLesson", count: didFirstLesson, pct: pct(didFirstLesson, signedUp) },
    { key: "streak3", count: reached3Streak, pct: pct(reached3Streak, signedUp) },
    { key: "return7", count: returned, pct: pct(returned, eligibleForReturn || signedUp) },
  ];

  // ---- retention (day-7): of learners created exactly ~7 days ago window, how
  // many were active in the last 3 days ----
  const cohort7 = one("SELECT COUNT(*) c FROM learner_profiles WHERE date(created_at) BETWEEN date(?, '-13 day') AND date(?, '-7 day')", [today, today]);
  const cohort7Active = one(
    `SELECT COUNT(*) c FROM learner_profiles lp
     WHERE date(lp.created_at) BETWEEN date(?, '-13 day') AND date(?, '-7 day')
       AND (lp.last_active >= date(?, '-2 day')
            OR lp.user_id IN (SELECT DISTINCT user_id FROM xp_events WHERE day >= date(?, '-2 day')))`,
    [today, today, today, today]
  );
  const retention7 = pct(cohort7Active, cohort7);

  // ---- close-the-loop: open support tickets (bug/feedback signal) ----
  const openTickets = one("SELECT COUNT(*) c FROM support_tickets WHERE status='open'");
  const ticketsByCat = all(
    "SELECT category, COUNT(*) c FROM support_tickets WHERE status='open' GROUP BY category ORDER BY c DESC"
  );
  const recentTickets = all(
    `SELECT t.id, t.category, t.subject, t.status, t.last_message_at, u.name_fa, u.name_en, u.username
     FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id
     WHERE t.status='open' ORDER BY t.last_message_at DESC LIMIT 6`
  );

  // ---- content & streaks health ----
  const activeStreaks = one("SELECT COUNT(*) c FROM learner_profiles WHERE streak >= 1 AND last_active >= date(?, '-1 day')", [today]);
  const avgStreak = one("SELECT COALESCE(ROUND(AVG(streak),1),0) c FROM learner_profiles WHERE streak > 0");
  const lessonsToday = one("SELECT COUNT(*) c FROM xp_events WHERE reason='lesson' AND day=?", [today]);
  const answersToday = one("SELECT COUNT(*) c FROM card_attempts WHERE day=?", [today]);

  return {
    generatedAt: today,
    engagement: { dau, wau, mau, stickiness, wauMau, trend },
    population: { totalLearners, newLearners7, newLearners30, premium },
    funnel,
    retention: { day7: retention7, cohort: cohort7, cohortActive: cohort7Active },
    support: {
      open: openTickets,
      byCategory: ticketsByCat.map((r) => ({ category: r.category, count: r.c })),
      recent: recentTickets.map((t) => ({
        id: t.id, category: t.category, subject: t.subject, status: t.status,
        last_message_at: t.last_message_at,
        who: t.name_fa || t.name_en || t.username || "—",
      })),
    },
    activity: { activeStreaks, avgStreak, lessonsToday, answersToday },
  };
}
