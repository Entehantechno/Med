/* ads-control.js — Central ad-serving policy for the competitive learner app.

   Research-backed monetization (banner / interstitial / rewarded / native /
   app-open / pre-lesson / sponsored) with three hard guarantees:

     1) MASTER SWITCH — a single global on/off. While OFF (the default for the
        first months) NO user sees ANY ad anywhere. Nothing is even fetched.
     2) PREMIUM — premium users NEVER see ads, even when the master is ON.
     3) DISCIPLINE — scheduling (start/end), per-user daily frequency caps,
        audience targeting (all/free/new) and weighted rotation, so ads stay
        rare and non-annoying (per 2026 best practice: delay first ad, cap
        frequency, prefer opt-in rewarded).

   All deterministic, no external calls, no cost. */
import { db, persistNow } from "../db.js";
import { getSetting } from "../routes/content.js";
import { isEnabled } from "./flags.js";

export const AD_FORMATS = ["banner", "interstitial", "rewarded", "prelesson", "native", "app_open", "sponsored"];
export const AD_AUDIENCES = ["all", "free", "new"];

// Master config lives in settings under "ads_master".
export function getAdsMaster() {
  const d = { enabled: false, session_cap: 0, min_account_age_days: 0 };
  return { ...d, ...(getSetting("ads_master", {}) || {}) };
}
// True when ads are globally ON. Everything else short-circuits when false.
export function adsGloballyOn() {
  // both the ads master switch AND the «ads» feature flag must be on
  return !!getAdsMaster().enabled && isEnabled("ads");
}

const today = () => new Date().toISOString().slice(0, 10);

/* Is this ad currently eligible to be shown to THIS user?
   Applies: active flag, schedule window, audience, and per-user daily cap. */
function eligible(ad, { userId, isNew }) {
  if (!ad.active) return false;
  const now = Date.now();
  if (ad.start_at && new Date(ad.start_at).getTime() > now) return false;
  if (ad.end_at && new Date(ad.end_at).getTime() < now) return false;
  const aud = ad.audience || "all";
  if (aud === "new" && !isNew) return false;
  // 'free' vs 'all' both fine here (premium already filtered before we get called)
  if (ad.daily_cap && ad.daily_cap > 0 && userId) {
    const row = db.prepare("SELECT count FROM ad_impressions WHERE ad_id=? AND user_id=? AND day=?").get(ad.id, userId, today());
    if (row && row.count >= ad.daily_cap) return false;
  }
  return true;
}

// Weighted random pick from a list of eligible ads (higher weight = more often).
function weightedPick(ads) {
  if (ads.length <= 1) return ads[0] || null;
  const total = ads.reduce((s, a) => s + Math.max(1, a.weight || 1), 0);
  let r = Math.random() * total;
  for (const a of ads) { r -= Math.max(1, a.weight || 1); if (r <= 0) return a; }
  return ads[ads.length - 1];
}

// Record one impression (for stats + frequency capping).
export function recordImpression(adId, userId) {
  db.prepare("UPDATE ads SET impressions=impressions+1 WHERE id=?").run(adId);
  if (userId) {
    db.prepare(`INSERT INTO ad_impressions (ad_id,user_id,day,count) VALUES (?,?,?,1)
      ON CONFLICT(ad_id,user_id,day) DO UPDATE SET count=count+1`).run(adId, userId, today());
  }
  persistNow();
}

/* Serve ads for a slot (banner/native lists) OR a single format (rewarded/
   interstitial/prelesson/app_open). Returns [] instantly when the master is
   off or the user is premium. `opts`: { userId, premium, isNew, lang, slot,
   format, nodeId, single } */
export function serveAds({ userId, premium, isNew = false, lang = "fa", slot = null, format = null, nodeId = null, single = false }) {
  if (premium) return [];            // premium: never
  if (!adsGloballyOn()) return [];   // master OFF: nothing, for everyone

  // record the request (for fill-rate analytics) — best-effort
  try {
    const k = slot || format || "?";
    db.prepare(`INSERT INTO ad_requests (day, slot, count) VALUES (?,?,1)
      ON CONFLICT(day, slot) DO UPDATE SET count=count+1`).run(today(), k);
  } catch { /* */ }

  let rows;
  if (format) {
    rows = db.prepare("SELECT * FROM ads WHERE format=?").all(format);
    if (nodeId != null) {
      const targeted = rows.filter((a) => a.node_id === nodeId);
      rows = targeted.length ? targeted : rows.filter((a) => a.node_id == null);
    } else {
      rows = rows.filter((a) => a.node_id == null);
    }
  } else if (slot) {
    if (nodeId != null) {
      rows = db.prepare("SELECT * FROM ads WHERE slot=? AND node_id=?").all(slot, nodeId);
      if (!rows.length) rows = db.prepare("SELECT * FROM ads WHERE slot=? AND node_id IS NULL").all(slot);
    } else {
      rows = db.prepare("SELECT * FROM ads WHERE slot=? AND node_id IS NULL").all(slot);
    }
  } else {
    return [];
  }

  const ok = rows.filter((a) => eligible(a, { userId, isNew }));
  if (!ok.length) return [];

  const shape = (a) => {
    recordImpression(a.id, userId);
    return {
      id: a.id, title: lang === "fa" ? a.title_fa : a.title_en, body: lang === "fa" ? a.body_fa : a.body_en,
      cta: lang === "fa" ? a.cta_fa : a.cta_en, url: a.url, image: a.image, bg: a.bg,
      sponsor: a.sponsor || "", format: a.format || "banner",
      reward_gems: a.reward_gems || 0, skippable_after: a.skippable_after, duration_s: a.duration_s,
    };
  };

  if (single || format) { const pick = weightedPick(ok); return pick ? [shape(pick)] : []; }
  // slot lists (banner/native): return all eligible (usually one), impression-counted
  return ok.map(shape);
}

// Whether a learner counts as "new" (for audience targeting / delaying first ad).
export function isNewLearner(profile) {
  const days = getAdsMaster().min_account_age_days || 0;
  if (!days) return false; // targeting 'new' only meaningful when configured
  const created = profile?.created_at ? new Date(profile.created_at).getTime() : 0;
  if (!created) return false;
  return (Date.now() - created) < days * 86400000;
}
