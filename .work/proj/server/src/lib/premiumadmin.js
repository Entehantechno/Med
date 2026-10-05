/* premiumadmin.js — Admin management of Premium subscribers.

   A dedicated view/action set for the "Premium accounts" admin tab:
   • overview: whether the premium program is switched on, counts, revenue,
     expiring-soon, and where premium came from (paid vs group-code vs granted).
   • list current premium subscribers with days remaining.
   • grant/extend premium by N days, or revoke it — all manual admin actions,
     independent of the payment gateway (useful for support & comps).

   All writes flush via persistNow(). Premium days are stored as an absolute
   `premium_until` ISO timestamp on learner_profiles (same field the gateway uses),
   so admin grants and paid subscriptions stack naturally. */
import { db, persistNow } from "../db.js";
import { maxHearts, premiumProgramOn, getProfile } from "./gamify.js";
import { applyPremiumDays, daysLeftPremium, premiumUntilExpr, premiumActiveWhere, PREMIUM_ACTIVE_SQL, PREMIUM_EXPIRED_SQL } from "./entitlement.js";

function one(sql, params = []) {
  try { const r = db.prepare(sql).get(...params); return r ? Number(Object.values(r)[0]) || 0 : 0; }
  catch { return 0; }
}

const daysLeft = daysLeftPremium;

/* Overview stats for the top of the premium tab. */
export function premiumOverview() {
  // Drop stale flags so the admin tab never shows an expired grant as "active".
  let swept = 0;
  try {
    const r = db.prepare(`UPDATE learner_profiles SET premium=0, premium_until=NULL WHERE ${PREMIUM_EXPIRED_SQL}`).run();
    swept = r.changes || 0;
  } catch { /* */ }
  const untilX = premiumUntilExpr();
  const active = one(`SELECT COUNT(*) c FROM learner_profiles WHERE ${PREMIUM_ACTIVE_SQL}`);
  const expiring7 = one(
    `SELECT COUNT(*) c FROM learner_profiles WHERE premium=1 AND premium_until IS NOT NULL AND ${untilX} > datetime('now') AND ${untilX} <= datetime('now','+7 day')`
  );
  const expired = swept;
  // revenue from paid premium transactions (monthly/yearly) + group orders
  const subRevenue = one("SELECT COALESCE(SUM(amount),0) c FROM transactions WHERE status='paid' AND (plan='monthly' OR plan='yearly')");
  const groupRevenue = one("SELECT COALESCE(SUM(amount),0) c FROM group_orders WHERE status='paid'");
  const courseRevenue = one("SELECT COALESCE(SUM(amount),0) c FROM transactions WHERE status='paid' AND plan LIKE 'course:%'");
  return {
    programOn: premiumProgramOn(),
    active,
    expiringSoon: expiring7,
    expired,
    revenue: { subscriptions: subRevenue, group: groupRevenue, courses: courseRevenue, total: subRevenue + groupRevenue + courseRevenue },
  };
}

/* List current premium subscribers with days remaining. */
export function premiumSubscribers({ q = "" } = {}) {
  const like = `%${(q || "").trim()}%`;
  const rows = db.prepare(`
    SELECT u.id, u.username, u.name_fa, u.name_en, u.email,
           lp.premium, lp.premium_until, lp.tier, lp.xp, lp.created_at
    FROM learner_profiles lp JOIN users u ON u.id = lp.user_id
    WHERE ${premiumActiveWhere("lp")}
      AND (? = '%%' OR u.username LIKE ? OR u.name_fa LIKE ? OR u.name_en LIKE ? OR u.email LIKE ?)
    ORDER BY (lp.premium_until IS NULL) ASC, lp.premium_until ASC
    LIMIT 300`).all(like, like, like, like, like);
  return rows.map((r) => ({
    id: r.id, username: r.username,
    name: r.name_fa || r.name_en || r.username,
    email: r.email || "",
    tier: r.tier, xp: r.xp,
    premium_until: r.premium_until,
    daysLeft: daysLeft(r.premium_until),
    lifetime: !r.premium_until, // premium with no expiry = granted lifetime
  }));
}

/* Grant or extend premium by N days for a learner. Stacks on remaining time. */
export function grantPremium(userId, days = 30) {
  const u = db.prepare("SELECT id, role FROM users WHERE id=?").get(userId);
  if (!u || u.role !== "learner") return { ok: false, error: "not_a_learner" };
  const p = applyPremiumDays(userId, days, { source: "admin_grant" });
  return {
    ok: true,
    premium_until: p.premium_until || null,
    daysLeft: daysLeft(p.premium_until),
    premium: 1,
    lifetime: !!(p.premium && !p.premium_until),
  };
}

/* Grant lifetime premium (no expiry). Creates a profile if the learner has none. */
export function grantLifetime(userId) {
  const u = db.prepare("SELECT id, role FROM users WHERE id=?").get(userId);
  if (!u || u.role !== "learner") return { ok: false, error: "not_a_learner" };
  getProfile(userId);
  db.prepare("UPDATE learner_profiles SET premium=1, premium_until=NULL, hearts=? WHERE user_id=?")
    .run(maxHearts(), userId);
  persistNow();
  return { ok: true, lifetime: true, premium: 1 };
}

/* Revoke premium immediately. */
export function revokePremium(userId) {
  db.prepare("UPDATE learner_profiles SET premium=0, premium_until=NULL WHERE user_id=?").run(userId);
  persistNow();
  return { ok: true };
}

/* Find a learner by username/email to grant premium to (for the "add" action). */
export function findLearner(q) {
  const like = `%${(q || "").trim()}%`;
  const rows = db.prepare(`
    SELECT u.id, u.username, u.name_fa, u.name_en, u.email, lp.premium
    FROM users u LEFT JOIN learner_profiles lp ON lp.user_id = u.id
    WHERE u.role='learner' AND (u.username LIKE ? OR u.name_fa LIKE ? OR u.name_en LIKE ? OR u.email LIKE ?)
    ORDER BY u.id DESC LIMIT 20`).all(like, like, like, like);
  return rows.map((r) => ({
    id: r.id, username: r.username, name: r.name_fa || r.name_en || r.username,
    email: r.email || "", premium: !!r.premium,
  }));
}
