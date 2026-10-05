/* site-analytics.js — Deep, research-backed product analytics for the admin.

   Implements the industry-standard KPI set (2026): DAU / WAU / MAU, the
   DAU/MAU stickiness ratio, Day-1/7/30 cohort retention, activity trends,
   premium conversion, and content/engagement rollups. All derived from data we
   already store (learner_profiles.last_active, xp_events, attempts, users) —
   deterministic, no external analytics SDK, no cost, privacy-safe. */
import { db } from "../db.js";

const dayStr = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dayStr(d); };

/* Active-user counts from learner_profiles.last_active (a YYYY-MM-DD string set
   whenever a learner does a lesson). DAU=today window(1d), WAU=7d, MAU=30d. */
export function activeUsers() {
  const since = (n) => db.prepare(
    "SELECT COUNT(*) c FROM learner_profiles WHERE last_active >= ?"
  ).get(daysAgo(n)).c;
  const dau = since(1), wau = since(7), mau = since(30);
  const stickiness = mau ? Math.round((dau / mau) * 100) : 0;   // DAU/MAU %
  return { dau, wau, mau, stickiness };
}

/* Cohort retention: of learners who signed up on a given day, what % were
   active again N days later (using xp_events as the "did something" signal).
   Returns Day-1 / Day-7 / Day-30 averaged across recent cohorts. */
export function retention() {
  // consider signups older than 30 days so all windows are measurable
  const cohorts = db.prepare(`
    SELECT id, date(created_at) AS signup FROM users
    WHERE role='learner' AND created_at IS NOT NULL AND date(created_at) <= ?`).all(daysAgo(1));
  const active = db.prepare("SELECT 1 FROM xp_events WHERE user_id=? AND day > ? AND day <= ? LIMIT 1");
  const measure = (windowDays, minAgeDays) => {
    let denom = 0, ret = 0;
    for (const c of cohorts) {
      const age = Math.floor((Date.now() - new Date(c.signup).getTime()) / 86400000);
      if (age < minAgeDays) continue;             // cohort too young to judge this window
      denom++;
      const start = c.signup;
      const end = dayStr(new Date(new Date(c.signup).getTime() + windowDays * 86400000));
      if (active.get(c.id, start, end)) ret++;
    }
    return denom ? Math.round((ret / denom) * 100) : null;
  };
  return { d1: measure(1, 1), d7: measure(7, 7), d30: measure(30, 30), cohortSize: cohorts.length };
}

/* Daily activity trend (last N days): active learners + XP earned + attempts. */
export function activityTrend(days = 14) {
  const from = daysAgo(days - 1);
  const xpByDay = {};
  for (const r of db.prepare("SELECT day, COUNT(DISTINCT user_id) u, COALESCE(SUM(amount),0) xp FROM xp_events WHERE day>=? GROUP BY day").all(from))
    xpByDay[r.day] = { active: r.u, xp: r.xp };
  const atByDay = {};
  for (const r of db.prepare("SELECT date(created_at) d, COUNT(*) n FROM attempts WHERE date(created_at)>=? GROUP BY date(created_at)").all(from))
    atByDay[r.d] = r.n;
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    out.push({ day: d, active: xpByDay[d]?.active || 0, xp: xpByDay[d]?.xp || 0, attempts: atByDay[d] || 0 });
  }
  return out;
}

/* Signups per day (learners), last N days. */
export function signupTrend(days = 14) {
  const from = daysAgo(days - 1);
  const rows = db.prepare("SELECT date(created_at) d, COUNT(*) n FROM users WHERE role='learner' AND date(created_at)>=? GROUP BY date(created_at)").all(from);
  const map = Object.fromEntries(rows.map((r) => [r.d, r.n]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) { const d = daysAgo(i); out.push({ day: d, n: map[d] || 0 }); }
  return out;
}

/* Premium / monetization rollup for learners. */
export function premiumRollup() {
  const learners = db.prepare("SELECT COUNT(*) c FROM learner_profiles").get().c;
  const premium = db.prepare("SELECT COUNT(*) c FROM learner_profiles WHERE premium=1").get().c;
  const convPct = learners ? Math.round((premium / learners) * 1000) / 10 : 0;
  return { learners, premium, free: Math.max(0, learners - premium), convPct };
}

/* Engagement rollups: lessons completed, avg stars, streaks, review load. */
export function engagementRollup() {
  const nodesDone = db.prepare("SELECT COUNT(*) c FROM node_progress WHERE completed_at IS NOT NULL").get().c;
  const avgStars = db.prepare("SELECT COALESCE(AVG(stars),0) a FROM node_progress WHERE completed_at IS NOT NULL").get().a;
  const activeStreaks = db.prepare("SELECT COUNT(*) c FROM learner_profiles WHERE streak > 0").get().c;
  const bestStreak = db.prepare("SELECT COALESCE(MAX(streak),0) m FROM learner_profiles").get().m;
  const vpAttempts = db.prepare("SELECT COUNT(*) c FROM attempts WHERE type='vp'").get().c;
  const avgVp = db.prepare("SELECT COALESCE(AVG(score),0) a FROM attempts WHERE type='vp'").get().a;
  return {
    lessonsCompleted: nodesDone, avgStars: Math.round(avgStars * 10) / 10,
    activeStreaks, bestStreak, vpAttempts, avgVpScore: Math.round(avgVp),
  };
}

// The full site-analytics payload for the admin dashboard.
export function siteAnalytics() {
  return {
    active: activeUsers(),
    retention: retention(),
    activityTrend: activityTrend(14),
    signupTrend: signupTrend(14),
    premium: premiumRollup(),
    engagement: engagementRollup(),
  };
}

/* Per-university breakdown: faculty/student counts, classes, exams, and the
   average virtual-patient attempt score of that university's students. Lets an
   admin compare institutions. */
export function byUniversity(lang = "fa") {
  const unis = db.prepare("SELECT id, name_fa, name_en FROM universities ORDER BY id").all();
  return unis.map((u) => {
    const teachers = db.prepare("SELECT COUNT(*) c FROM users WHERE role='teacher' AND university_id=?").get(u.id).c;
    const students = db.prepare("SELECT COUNT(*) c FROM users WHERE role='student' AND university_id=?").get(u.id).c;
    const classes = db.prepare("SELECT COUNT(*) c FROM classes WHERE owner_id IN (SELECT id FROM users WHERE university_id=?) AND active=1").get(u.id).c;
    // avg VP score of this university's students
    const avg = db.prepare(`SELECT COALESCE(AVG(a.score),0) s, COUNT(*) n FROM attempts a
      JOIN users us ON us.id=a.user_id WHERE a.type='vp' AND us.university_id=?`).get(u.id);
    return {
      id: u.id, name: lang === "fa" ? (u.name_fa || u.name_en) : (u.name_en || u.name_fa),
      teachers, students, classes, attempts: avg.n, avgScore: Math.round(avg.s || 0),
    };
  });
}

/* Per-class breakdown: members, cases, avg best score. Optionally for one
   university (filter by owner's university). */
export function byClass(lang = "fa", universityId = null) {
  let sql = `SELECT c.id, c.name_fa, c.name_en, c.code, c.grading_role, c.history_form,
      (SELECT COUNT(*) FROM class_members m WHERE m.class_id=c.id) AS members,
      (SELECT COUNT(*) FROM class_cases cc WHERE cc.class_id=c.id) AS cases
    FROM classes c WHERE c.active=1`;
  const args = [];
  if (universityId) { sql += " AND c.owner_id IN (SELECT id FROM users WHERE university_id=?)"; args.push(universityId); }
  sql += " ORDER BY c.id DESC";
  const rows = db.prepare(sql).all(...args);
  return rows.map((c) => {
    const avg = db.prepare(`SELECT COALESCE(AVG(best),0) s FROM (
        SELECT MAX(score) best FROM attempts WHERE class_id=? AND type='vp' GROUP BY user_id, case_id)`).get(c.id);
    return {
      id: c.id, name: lang === "fa" ? (c.name_fa || c.name_en) : (c.name_en || c.name_fa), code: c.code,
      members: c.members, cases: c.cases, gradingRole: c.grading_role, historyForm: c.history_form,
      avgScore: Math.round(avg.s || 0),
    };
  });
}
