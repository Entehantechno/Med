/* referral.js — Invite-a-friend (referral) + social-sharing rewards.

   Design (per viral-growth research, 2025-2026): DOUBLE-SIDED, product-value
   rewards (gems / free premium, not cash), one-click sharing, milestone bonuses,
   a referrer leaderboard, and light anti-fraud. Everything is admin-tunable via
   gameconfig.referral / gameconfig.social and gated by the referral / social_share
   feature flags.

   Reward currency is gems + optional free premium days — tied to product value,
   which research shows outperforms cash for SaaS/education apps.

   All writes flush via persistNow(). */
import { db, persistNow } from "../db.js";
import crypto from "crypto";
import { getGameConfig } from "./gameconfig.js";
import { tehranDay } from "./gamify.js";
import { applyPremiumDays } from "./entitlement.js";

const J = (s, d = []) => { if (!s) return d; try { const v = JSON.parse(s); return v == null ? d : v; } catch { return d; } };

/* Generate a short, unambiguous personal invite code (idempotent per user). */
function genCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let t = 0; t < 25; t++) {
    let s = "";
    for (let i = 0; i < 6; i++) s += A[crypto.randomInt(A.length)];
    if (!db.prepare("SELECT 1 FROM learner_profiles WHERE referral_code=?").get(s)) return s;
  }
  return "R" + Date.now().toString(36).toUpperCase();
}

/* Ensure a learner has a referral code; returns it. */
export function ensureCode(userId) {
  const p = db.prepare("SELECT referral_code FROM learner_profiles WHERE user_id=?").get(userId);
  if (p && p.referral_code) return p.referral_code;
  const code = genCode();
  db.prepare("UPDATE learner_profiles SET referral_code=? WHERE user_id=?").run(code, userId);
  persistNow();
  return code;
}

export function userByCode(code) {
  if (!code) return null;
  const c = String(code).trim().toUpperCase();
  return db.prepare("SELECT user_id FROM learner_profiles WHERE referral_code=?").get(c);
}

function addGems(userId, gems) {
  if (gems > 0) db.prepare("UPDATE learner_profiles SET gems=gems+? WHERE user_id=?").run(gems, userId);
}
function addXp(userId, xp) {
  if (xp > 0) {
    db.prepare("INSERT INTO xp_events (user_id, amount, reason, day) VALUES (?,?,?,?)").run(userId, xp, "referral", tehranDay());
    db.prepare("UPDATE learner_profiles SET xp=xp+?, weekly_xp=weekly_xp+? WHERE user_id=?").run(xp, xp, userId);
  }
}
function addPremiumDays(userId, days) {
  if (days <= 0) return;
  // Shared writer: stacks dated Plus and never downgrades a paid lifetime grant.
  applyPremiumDays(userId, days, { source: "referral", persist: false });
}

/* Called at signup when a valid referral code is supplied. Records the referral
   and (if configured to qualify on signup) pays both sides immediately. */
export function attachReferral(referredId, code) {
  const cfg = getGameConfig().referral;
  if (!cfg.enabled) return { ok: false, reason: "disabled" };
  const owner = userByCode(code);
  if (!owner) return { ok: false, reason: "invalid_code" };
  if (owner.user_id === referredId) return { ok: false, reason: "self" };
  // a user can only be referred once
  if (db.prepare("SELECT 1 FROM referrals WHERE referred_id=?").get(referredId)) return { ok: false, reason: "already" };

  db.prepare("INSERT INTO referrals (referrer_id, referred_id, code, status) VALUES (?,?,?,?)")
    .run(owner.user_id, referredId, String(code).trim().toUpperCase(), "pending");
  db.prepare("UPDATE learner_profiles SET referred_by=? WHERE user_id=?").run(owner.user_id, referredId);
  persistNow();

  if (cfg.qualify_on === "signup") qualifyReferral(referredId);
  return { ok: true };
}

/* Mark a referral qualified (e.g. the referred user did their first lesson) and
   pay the double-sided rewards + advance the referrer's milestone rewards. */
export function qualifyReferral(referredId) {
  const cfg = getGameConfig().referral;
  const ref = db.prepare("SELECT * FROM referrals WHERE referred_id=?").get(referredId);
  if (!ref || ref.status === "qualified") return false;

  db.prepare("UPDATE referrals SET status='qualified', qualified_at=datetime('now') WHERE id=?").run(ref.id);

  // reward the new friend (referred)
  if (!ref.referred_rewarded) {
    addGems(referredId, cfg.referred_gems || 0);
    addPremiumDays(referredId, cfg.referred_premium_days || 0);
    db.prepare("UPDATE referrals SET referred_rewarded=1 WHERE id=?").run(ref.id);
  }
  // reward the inviter (referrer) + bump their count
  if (!ref.referrer_rewarded) {
    addGems(ref.referrer_id, cfg.referrer_gems || 0);
    addXp(ref.referrer_id, cfg.referrer_xp || 0);
    db.prepare("UPDATE referrals SET referrer_rewarded=1 WHERE id=?").run(ref.id);
    db.prepare("UPDATE learner_profiles SET referral_count=referral_count+1 WHERE user_id=?").run(ref.referrer_id);
    grantMilestones(ref.referrer_id);
  }
  persistNow();
  return true;
}

/* Pay any newly-reached milestone rewards for the referrer. */
function grantMilestones(userId) {
  const cfg = getGameConfig().referral;
  const p = db.prepare("SELECT referral_count, referral_milestones FROM learner_profiles WHERE user_id=?").get(userId);
  if (!p) return;
  const claimed = J(p.referral_milestones);
  let changed = false;
  for (const m of (cfg.milestones || [])) {
    if (p.referral_count >= m.count && !claimed.includes(m.count)) {
      addGems(userId, m.gems || 0);
      addPremiumDays(userId, m.premium_days || 0);
      claimed.push(m.count); changed = true;
    }
  }
  if (changed) db.prepare("UPDATE learner_profiles SET referral_milestones=? WHERE user_id=?").run(JSON.stringify(claimed), userId);
}

/* The learner-facing referral dashboard. */
export function referralStatus(userId, lang = "fa") {
  const cfg = getGameConfig().referral;
  const code = ensureCode(userId);
  const p = db.prepare("SELECT referral_count, referral_milestones FROM learner_profiles WHERE user_id=?").get(userId) || {};
  const claimed = J(p.referral_milestones);
  const invited = db.prepare(`
    SELECT r.status, r.created_at, u.name_fa, u.name_en
    FROM referrals r JOIN users u ON u.id=r.referred_id
    WHERE r.referrer_id=? ORDER BY r.id DESC LIMIT 50`).all(userId)
    .map((r) => ({ name: (lang === "fa" ? r.name_fa : r.name_en) || r.name_fa || "—", status: r.status, at: r.created_at }));
  return {
    enabled: cfg.enabled,
    code,
    count: p.referral_count || 0,
    rewards: { referrerGems: cfg.referrer_gems, referredGems: cfg.referred_gems, referredPremiumDays: cfg.referred_premium_days },
    milestones: (cfg.milestones || []).map((m) => ({
      count: m.count, gems: m.gems, premium_days: m.premium_days,
      label: lang === "fa" ? (m.label_fa || `${m.count}`) : (m.label_en || `${m.count}`),
      reached: (p.referral_count || 0) >= m.count, claimed: claimed.includes(m.count),
    })),
    invited,
  };
}

/* Top referrers leaderboard (public recognition fuels more sharing). */
export function referralLeaderboard(lang = "fa", limit = 20) {
  const rows = db.prepare(`
    SELECT lp.user_id, lp.referral_count, u.name_fa, u.name_en, lp.province
    FROM learner_profiles lp JOIN users u ON u.id=lp.user_id
    WHERE lp.referral_count > 0 ORDER BY lp.referral_count DESC, lp.user_id ASC LIMIT ?`).all(limit);
  return rows.map((r, i) => ({
    rank: i + 1, name: (lang === "fa" ? r.name_fa : r.name_en) || r.name_fa || "—",
    count: r.referral_count, province: r.province || "",
  }));
}

/* ---------- social sharing (share-to-earn + analytics) ---------- */
export function recordShare(userId, kind, channel) {
  const cfg = getGameConfig().social;
  const day = tehranDay();
  const rewardedToday = db.prepare("SELECT COUNT(*) c FROM share_events WHERE user_id=? AND day=? AND rewarded=1").get(userId, day).c;
  let reward = 0;
  if (cfg.enabled && rewardedToday < (cfg.daily_reward_cap || 0) && (cfg.reward_gems || 0) > 0) {
    reward = cfg.reward_gems;
    addGems(userId, reward);
  }
  db.prepare("INSERT INTO share_events (user_id, kind, channel, day, rewarded) VALUES (?,?,?,?,?)")
    .run(userId, String(kind || "").slice(0, 30), String(channel || "").slice(0, 30), day, reward > 0 ? 1 : 0);
  persistNow();
  return { rewardGems: reward };
}

/* ---------- admin analytics ---------- */
export function adminReferralStats() {
  const total = db.prepare("SELECT COUNT(*) c FROM referrals").get().c;
  const qualified = db.prepare("SELECT COUNT(*) c FROM referrals WHERE status='qualified'").get().c;
  const shares = db.prepare("SELECT COUNT(*) c FROM share_events").get().c;
  const learners = db.prepare("SELECT COUNT(*) c FROM learner_profiles").get().c || 1;
  const top = db.prepare(`
    SELECT u.name_fa, u.name_en, u.username, lp.referral_count
    FROM learner_profiles lp JOIN users u ON u.id=lp.user_id
    WHERE lp.referral_count>0 ORDER BY lp.referral_count DESC LIMIT 10`).all()
    .map((r) => ({ name: r.name_fa || r.name_en || r.username, count: r.referral_count }));
  const byChannel = db.prepare("SELECT channel, COUNT(*) c FROM share_events GROUP BY channel ORDER BY c DESC").all()
    .map((r) => ({ channel: r.channel || "—", count: r.c }));
  // viral coefficient (K) ≈ qualified referrals per learner
  const k = Math.round((qualified / learners) * 100) / 100;
  return { total, qualified, shares, viralK: k, topReferrers: top, byChannel };
}
