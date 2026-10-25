/* rewardedads.js — Duolingo-Ads-2026 style monetization helpers.
   Formats (stored in ads.format):
     • banner        — the classic card shown in feed/path (existing behaviour)
     • interstitial  — full-screen after a lesson, skippable after N seconds
     • rewarded      — OPT-IN video; watching to the end pays gems (96% of
                       Duolingo's rewarded views complete — this is the star format)
     • prelesson     — pre-lesson sponsorship: forced 30s takeover before the
                       first daily lesson that unlocks a reward
   A learner never gets more than the admin-set daily reward cap, and premium
   learners see no ads at all. */
import { db, persistNow } from "../db.js";
import { getProfile } from "./gamify.js";
import { tehranDay } from "./gamify.js";
import { getGameConfig } from "./gameconfig.js";
import { adsGloballyOn } from "./ads-control.js";

// map an ads row → the client-facing shape (localized)
export function shapeAd(a, lang) {
  return {
    id: a.id,
    format: a.format || "banner",
    sponsor: a.sponsor || "",
    title: lang === "fa" ? a.title_fa : a.title_en,
    body: lang === "fa" ? a.body_fa : a.body_en,
    cta: lang === "fa" ? a.cta_fa : a.cta_en,
    url: a.url, image: a.image, bg: a.bg,
    reward_gems: a.reward_gems || 0,
    skippable_after: a.skippable_after ?? 5,
    duration_s: a.duration_s ?? 15,
  };
}

// Pick an active ad of a given format (optionally per-lesson). Returns null if
// the learner is premium or none is configured.
export function pickAd(lang, premium, format, nodeId = null) {
  if (premium) return null;
  if (!adsGloballyOn()) return null;   // master switch OFF → no ads for anyone
  let rows = [];
  if (nodeId != null) {
    rows = db.prepare("SELECT * FROM ads WHERE active=1 AND format=? AND node_id=?").all(format, nodeId);
    if (!rows.length) rows = db.prepare("SELECT * FROM ads WHERE active=1 AND format=? AND node_id IS NULL").all(format);
  } else {
    rows = db.prepare("SELECT * FROM ads WHERE active=1 AND format=? AND node_id IS NULL").all(format);
  }
  if (!rows.length) return null;
  const a = rows[Math.floor(Math.random() * rows.length)];
  db.prepare("UPDATE ads SET impressions=impressions+1 WHERE id=?").run(a.id);
  persistNow();
  return shapeAd(a, lang);
}

// How many rewarded views this learner has already been paid for today.
export function rewardedViewsToday(userId) {
  const day = tehranDay();
  return db.prepare("SELECT COUNT(*) c FROM ad_views WHERE user_id=? AND day=? AND format IN ('rewarded','prelesson') AND reward_amount>0").get(userId, day).c;
}

// Grant the reward for finishing a rewarded / pre-lesson ad. Enforces the daily
// cap so learners can't farm gems by re-watching.
export function claimRewardedAd(userId, adId, format = "rewarded") {
  const cfg = getGameConfig().ads;
  const p = getProfile(userId);
  if (p.premium) return { ok: false, error: "premium" };
  if (!adsGloballyOn()) return { ok: false, error: "ads_off" };   // master switch OFF
  const day = tehranDay();
  const used = rewardedViewsToday(userId);
  if (used >= cfg.daily_reward_cap) {
    // still log the view (no reward) so analytics is accurate
    db.prepare("INSERT INTO ad_views (user_id, ad_id, format, day, reward_kind, reward_amount) VALUES (?,?,?,?, 'none', 0)")
      .run(userId, adId || null, format, day);
    persistNow();
    return { ok: false, error: "cap", capped: true, cap: cfg.daily_reward_cap };
  }
  const gems = format === "prelesson" ? cfg.prelesson_gems : cfg.rewarded_gems;
  db.prepare("INSERT INTO ad_views (user_id, ad_id, format, day, reward_kind, reward_amount) VALUES (?,?,?,?, 'gems', ?)")
    .run(userId, adId || null, format, day, gems);
  db.prepare("UPDATE learner_profiles SET gems=gems+? WHERE user_id=?").run(gems, userId);
  if (adId) db.prepare("UPDATE ads SET clicks=clicks+1 WHERE id=?").run(adId);
  persistNow();
  return { ok: true, gems, remaining: cfg.daily_reward_cap - used - 1, profile: getProfile(userId) };
}

// Aggregate ad stats for the admin dashboard.
export function adStats() {
  const totals = db.prepare("SELECT COALESCE(SUM(impressions),0) imp, COALESCE(SUM(clicks),0) clk FROM ads").get();
  const byFormat = db.prepare("SELECT format, COUNT(*) n, COALESCE(SUM(impressions),0) imp, COALESCE(SUM(clicks),0) clk FROM ads GROUP BY format").all();
  const rewardsPaid = db.prepare("SELECT COALESCE(SUM(reward_amount),0) g, COUNT(*) v FROM ad_views WHERE reward_amount>0").get();
  return { totals, byFormat, rewardsPaidGems: rewardsPaid.g, rewardedViews: rewardsPaid.v };
}
