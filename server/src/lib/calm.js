/* calm.js — Calm Mode (anti-burnout, opt-in).

   Research basis (see گزارش/ریسرچ docs): medical-student burnout is highly
   prevalent, and streak anxiety + an ever-growing spaced-repetition review pile
   are documented drivers ("a source of guilt rather than learning"). Humane
   guardrails (streak freezes, opt-out competition, review caps, "do 10 minutes")
   keep the habit positive. Calm Mode bundles these as an OPT-IN, learner-owned
   set of protections. Everything is deterministic & AI-free; admins tune the
   defaults via getGameConfig().calm and can disable the whole feature. */
import { db, persistNow } from "../db.js";
import { getGameConfig } from "./gameconfig.js";
import { tehranDay, isoWeekKey } from "./gamify.js";

function cfg() { return { ...(getGameConfig().calm || {}) }; }

/* Read a learner's Calm Mode settings merged with the admin defaults. */
export function getCalmSettings(userId) {
  const c = cfg();
  const p = db.prepare(`SELECT calm_mode, calm_review_cap, calm_hide_streak,
      calm_opt_out_leagues, rest_days_used, rest_week_key, last_rest_day
    FROM learner_profiles WHERE user_id=?`).get(userId) || {};
  const week = isoWeekKey();
  // rest-day counter resets each ISO week
  const restUsed = p.rest_week_key === week ? (p.rest_days_used || 0) : 0;
  return {
    enabled: !!p.calm_mode,
    reviewCap: p.calm_review_cap && p.calm_review_cap > 0 ? p.calm_review_cap : (c.default_review_cap ?? 40),
    hideStreak: !!p.calm_hide_streak,
    optOutLeagues: !!p.calm_opt_out_leagues,
    restDaysPerWeek: c.rest_days_per_week ?? 2,
    restDaysUsed: restUsed,
    restDaysLeft: Math.max(0, (c.rest_days_per_week ?? 2) - restUsed),
    lastRestDay: p.last_rest_day || null,
    restToday: p.last_rest_day === tehranDay(),
    // admin knobs surfaced so the client can validate the cap slider
    minReviewCap: c.min_review_cap ?? 10,
    maxReviewCap: c.max_review_cap ?? 100,
    showWellbeingTips: c.show_wellbeing_tips !== false,
    featureEnabled: c.enabled !== false,
  };
}

/* Update a learner's Calm Mode settings (only the provided fields). */
export function setCalmSettings(userId, patch = {}) {
  const c = cfg();
  const cur = db.prepare("SELECT calm_review_cap FROM learner_profiles WHERE user_id=?").get(userId) || {};
  const sets = [], vals = [];
  if ("enabled" in patch) { sets.push("calm_mode=?"); vals.push(patch.enabled ? 1 : 0); }
  if ("hideStreak" in patch) { sets.push("calm_hide_streak=?"); vals.push(patch.hideStreak ? 1 : 0); }
  if ("optOutLeagues" in patch) { sets.push("calm_opt_out_leagues=?"); vals.push(patch.optOutLeagues ? 1 : 0); }
  if ("reviewCap" in patch) {
    const lo = c.min_review_cap ?? 10, hi = c.max_review_cap ?? 100;
    const cap = Math.min(hi, Math.max(lo, parseInt(patch.reviewCap, 10) || (c.default_review_cap ?? 40)));
    sets.push("calm_review_cap=?"); vals.push(cap);
  }
  if (sets.length) {
    vals.push(userId);
    db.prepare(`UPDATE learner_profiles SET ${sets.join(", ")} WHERE user_id=?`).run(...vals);
    persistNow();
  }
  return getCalmSettings(userId);
}

/* The effective daily review cap for a learner (null = no cap / Calm Mode off). */
export function effectiveReviewCap(userId) {
  if (cfg().enabled === false) return null;
  const s = getCalmSettings(userId);
  return s.enabled ? s.reviewCap : null;
}

/* Whether the learner has opted out of weekly leagues via Calm Mode. */
export function calmOptOutLeagues(userId) {
  if (cfg().enabled === false) return false;
  const s = getCalmSettings(userId);
  return s.enabled && s.optOutLeagues;
}

/* Take a planned REST DAY: preserves the streak for today without requiring a
   lesson. Guilt-free days off are an evidence-based anti-burnout strategy.
   Returns { ok, reason?, ...settings }. */
export function takeRestDay(userId) {
  const c = cfg();
  if (c.enabled === false) return { ok: false, reason: "disabled" };
  const s = getCalmSettings(userId);
  if (!s.enabled) return { ok: false, reason: "calm_off" };
  const today = tehranDay();
  const p = db.prepare("SELECT last_active, last_rest_day, rest_days_used, rest_week_key, streak FROM learner_profiles WHERE user_id=?").get(userId);
  if (!p) return { ok: false, reason: "no_profile" };
  if (p.last_active === today) return { ok: false, reason: "already_active" };   // studied today already
  if (p.last_rest_day === today) return { ok: false, reason: "already_rested" }; // already rested today
  if (s.restDaysLeft <= 0) return { ok: false, reason: "no_rest_left" };

  const week = isoWeekKey();
  const used = (p.rest_week_key === week ? (p.rest_days_used || 0) : 0) + 1;
  // Mark today active (so tomorrow's lesson keeps the streak) WITHOUT incrementing
  // the streak — a rest day protects, it doesn't inflate. Log the day as active.
  db.prepare(`UPDATE learner_profiles
      SET last_active=?, last_rest_day=?, rest_days_used=?, rest_week_key=?
      WHERE user_id=?`).run(today, today, used, week, userId);
  db.prepare("INSERT OR IGNORE INTO streak_days (user_id, day, frozen) VALUES (?,?,1)").run(userId, today);
  db.prepare("UPDATE streak_days SET frozen=1 WHERE user_id=? AND day=?").run(userId, today);
  persistNow();
  return { ok: true, ...getCalmSettings(userId) };
}
