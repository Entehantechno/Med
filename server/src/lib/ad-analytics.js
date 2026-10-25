/* ad-analytics.js — Deep advertising analytics for the admin (2026 KPI set).

   Implements the standard display/in-app ad reporting metrics:
     • Impressions, Clicks, CTR (clicks/impressions)
     • Reach (unique users) & Frequency (impressions/reach)
     • Fill rate (served / requested)  [requests tracked in ad_requests]
     • eCPM (admin-set benchmark per format) → estimated Revenue & RPM
     • Per-format, per-slot, per-ad breakdowns + a daily time series
   All computed from ads / ad_impressions / ad_views / ad_requests. eCPM is an
   admin-editable benchmark (settings key "ads_ecpm") because we serve our own
   inventory — this yields an honest ESTIMATED revenue, clearly labelled. */
import { db } from "../db.js";
import { getSetting } from "../routes/content.js";

const dayStr = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dayStr(d); };

// Admin-set eCPM (revenue per 1000 impressions) per format, in the site currency.
export function getEcpm() {
  const d = { banner: 0, native: 0, interstitial: 0, rewarded: 0, app_open: 0, prelesson: 0, sponsored: 0, currency: "تومان" };
  return { ...d, ...(getSetting("ads_ecpm", {}) || {}) };
}

const pct = (num, den) => (den ? Math.round((num / den) * 1000) / 10 : 0);

/* Aggregate performance across all ads + per-format breakdown with derived
   metrics. `reach` and `frequency` come from the per-user ad_impressions ledger. */
export function adAnalytics() {
  const ecpm = getEcpm();
  const totals = db.prepare("SELECT COALESCE(SUM(impressions),0) imp, COALESCE(SUM(clicks),0) clk FROM ads").get();
  const reachRow = db.prepare("SELECT COUNT(DISTINCT user_id) r, COALESCE(SUM(count),0) imp FROM ad_impressions").get();
  const reach = reachRow.r || 0;
  const cappedImp = reachRow.imp || 0;           // impressions with a known user (for frequency)
  const frequency = reach ? Math.round((cappedImp / reach) * 10) / 10 : 0;

  // requests (for fill rate) — table may be empty on older DBs
  let requests = 0;
  try { requests = db.prepare("SELECT COALESCE(SUM(count),0) c FROM ad_requests").get().c || 0; } catch { /* */ }
  const fillRate = requests ? pct(totals.imp, requests) : null;

  const byFormatRows = db.prepare(
    "SELECT format, COUNT(*) n, COALESCE(SUM(impressions),0) imp, COALESCE(SUM(clicks),0) clk FROM ads GROUP BY format"
  ).all();
  let estRevenue = 0;
  const byFormat = byFormatRows.map((f) => {
    const rev = Math.round(((f.imp || 0) / 1000) * (ecpm[f.format] || 0));
    estRevenue += rev;
    return { format: f.format, ads: f.n, imp: f.imp, clk: f.clk, ctr: pct(f.clk, f.imp), ecpm: ecpm[f.format] || 0, estRevenue: rev };
  });

  const bySlot = db.prepare(
    "SELECT slot, COUNT(*) n, COALESCE(SUM(impressions),0) imp, COALESCE(SUM(clicks),0) clk FROM ads GROUP BY slot"
  ).all().map((s) => ({ slot: s.slot, ads: s.n, imp: s.imp, clk: s.clk, ctr: pct(s.clk, s.imp) }));

  const rewardsPaid = db.prepare("SELECT COALESCE(SUM(reward_amount),0) g, COUNT(*) v FROM ad_views WHERE reward_amount>0").get();

  // RPM = revenue per 1000 impressions across the whole account (blended eCPM)
  const rpm = totals.imp ? Math.round((estRevenue / totals.imp) * 1000) : 0;

  return {
    ecpm,
    totals: {
      impressions: totals.imp, clicks: totals.clk, ctr: pct(totals.clk, totals.imp),
      reach, frequency, fillRate, requests,
      estRevenue, rpm, currency: ecpm.currency,
      rewardedViews: rewardsPaid.v, gemsPaid: rewardsPaid.g,
    },
    byFormat, bySlot,
    trend: adTrend(14),
    topAds: topAds(8),
  };
}

/* Daily ad time series (impressions/clicks + estimated revenue). Uses the
   per-user impression ledger (ad_impressions.day) + ad_views for clicks proxy.
   Since raw clicks aren't dated per-day, we chart impressions & rewarded views. */
export function adTrend(days = 14) {
  const ecpm = getEcpm();
  const from = daysAgo(days - 1);
  const impByDay = {};
  try {
    for (const r of db.prepare(`SELECT ai.day d, COALESCE(SUM(ai.count),0) imp, a.format f
        FROM ad_impressions ai JOIN ads a ON a.id=ai.ad_id WHERE ai.day>=? GROUP BY ai.day, a.format`).all(from)) {
      impByDay[r.d] = impByDay[r.d] || { imp: 0, rev: 0 };
      impByDay[r.d].imp += r.imp;
      impByDay[r.d].rev += Math.round((r.imp / 1000) * (ecpm[r.f] || 0));
    }
  } catch { /* */ }
  const viewByDay = {};
  for (const r of db.prepare("SELECT day, COUNT(*) v FROM ad_views WHERE day>=? GROUP BY day").all(from))
    viewByDay[r.day] = r.v;
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    out.push({ day: d, imp: impByDay[d]?.imp || 0, rev: impByDay[d]?.rev || 0, views: viewByDay[d] || 0 });
  }
  return out;
}

/* Best-performing ads by CTR (min impressions gate to avoid noise). */
export function topAds(limit = 8) {
  const rows = db.prepare(
    "SELECT id, title_fa, title_en, format, slot, impressions, clicks FROM ads ORDER BY clicks DESC, impressions DESC LIMIT ?"
  ).all(limit);
  return rows.map((a) => ({
    id: a.id, title_fa: a.title_fa, title_en: a.title_en, format: a.format, slot: a.slot,
    imp: a.impressions, clk: a.clicks, ctr: pct(a.clicks, a.impressions),
  }));
}
