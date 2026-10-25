/* ads.js — Admin management of advertisement slots (simulated monetization).
   Learners fetch active ads via /api/learn/ads; admins manage them here.
   A single MASTER SWITCH globally turns all ads on/off for everyone. */
import { Router } from "express";
import { db, persistNow } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";
import { adStats } from "../lib/rewardedads.js";
import { getSetting, setSetting } from "./content.js";
import { AD_FORMATS, AD_AUDIENCES, getAdsMaster } from "../lib/ads-control.js";

const r = Router();
const admin = [authRequired, requireRole("admin")];

r.get("/", ...admin, (req, res) => {
  res.json({ ads: db.prepare("SELECT * FROM ads ORDER BY id DESC").all(), master: getAdsMaster(), formats: AD_FORMATS, audiences: AD_AUDIENCES });
});

// --- MASTER SWITCH: one global on/off for ALL ads (default OFF). ---
r.get("/master", ...admin, (req, res) => { res.json(getAdsMaster()); });
r.put("/master", ...admin, (req, res) => {
  const b = req.body || {};
  const cur = getAdsMaster();
  const val = {
    enabled: b.enabled === true || b.enabled === 1,
    session_cap: Math.max(0, Number(b.session_cap ?? cur.session_cap) || 0),
    min_account_age_days: Math.max(0, Number(b.min_account_age_days ?? cur.min_account_age_days) || 0),
  };
  setSetting("ads_master", val);
  res.json({ ok: true, master: val });
});

// Aggregated ad performance (impressions/clicks by format + gems paid out).
r.get("/stats", ...admin, (req, res) => {
  res.json(adStats());
});

// DEEP ad analytics: CTR, eCPM, fill rate, reach, frequency, RPM, estimated
// revenue, per-format/slot breakdowns + a daily trend + top ads.
r.get("/analytics", ...admin, async (req, res) => {
  const { adAnalytics } = await import("../lib/ad-analytics.js");
  res.json(adAnalytics());
});
// Ad analytics CSV / printable-PDF exports.
r.get("/analytics.csv", ...admin, async (req, res) => {
  const { adAnalyticsCsv } = await import("../lib/analytics-export.js");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="ad-analytics.csv"');
  res.send(adAnalyticsCsv(req.query.lang === "en" ? "en" : "fa"));
});
r.get("/analytics.pdf", ...admin, async (req, res) => {
  const { adAnalyticsHtml } = await import("../lib/analytics-export.js");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(adAnalyticsHtml(req.query.lang === "en" ? "en" : "fa"));
});


r.get("/external-config", ...admin, async (req,res)=>{const {getExternalAdsConfig,externalAdStats}=await import("../lib/external-ads.js");res.json({config:getExternalAdsConfig(),stats:externalAdStats()})});
r.put("/external-config", ...admin, async (req,res)=>{const {saveExternalAdsConfig}=await import("../lib/external-ads.js");res.json({config:saveExternalAdsConfig(req.body||{})})});
r.get("/external/public",(req,res)=>import("../lib/external-ads.js").then(({getExternalAdsConfig})=>{const c=getExternalAdsConfig();res.json(c.enabled?{enabled:true,provider:c.provider,client_id:c.client_id,slot_id:c.slot_id,placement:c.placement}:{enabled:false})}).catch(()=>res.json({enabled:false})));

// Admin-set eCPM benchmarks (revenue per 1000 impressions) per format → used to
// estimate revenue/RPM (we serve our own inventory, so this is a set benchmark).
r.get("/ecpm", ...admin, async (req, res) => {
  const { getEcpm } = await import("../lib/ad-analytics.js");
  res.json(getEcpm());
});
r.put("/ecpm", ...admin, async (req, res) => {
  const { getEcpm } = await import("../lib/ad-analytics.js");
  const cur = getEcpm();
  const b = req.body || {};
  const val = { ...cur };
  for (const f of ["banner", "native", "interstitial", "rewarded", "app_open", "prelesson", "sponsored"]) {
    if (b[f] !== undefined) val[f] = Math.max(0, Number(b[f]) || 0);
  }
  if (b.currency) val.currency = String(b.currency).slice(0, 12);
  setSetting("ads_ecpm", val);
  res.json({ ok: true, ecpm: val });
});

// list of lessons an ad can target (id + title), for the admin ad editor
r.get("/lessons", ...admin, (req, res) => {
  const rows = db.prepare(`SELECT n.id, n.title_fa, n.title_en, t.name_fa AS topic_fa, t.name_en AS topic_en
    FROM path_nodes n LEFT JOIN topics t ON t.id = n.topic_id
    WHERE n.active=1 AND n.kind='lesson' ORDER BY t.name_fa, n.ord`).all();
  res.json({ lessons: rows });
});

const nid = (v) => (v === "" || v === null || v === undefined ? null : Number(v) || null);

const fmt = (v) => (AD_FORMATS.includes(v) ? v : "banner");
const aud = (v) => (AD_AUDIENCES.includes(v) ? v : "all");
const num = (v, d) => (v === "" || v === null || v === undefined || isNaN(Number(v)) ? d : Number(v));
const isoOrNull = (v) => (v && String(v).trim() ? String(v).trim() : null);

r.post("/", ...admin, (req, res) => {
  const b = req.body || {};
  const info = db.prepare(`INSERT INTO ads
    (slot, node_id, title_fa, title_en, body_fa, body_en, image, cta_fa, cta_en, url, bg, active,
     format, sponsor, reward_gems, skippable_after, duration_s,
     weight, start_at, end_at, daily_cap, audience)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?)`).run(
    b.slot || "path", nid(b.node_id), b.title_fa || "", b.title_en || "", b.body_fa || "", b.body_en || "",
    b.image || "", b.cta_fa || "", b.cta_en || "", b.url || "", b.bg || "#2f7fd1",
    b.active === 0 ? 0 : 1,
    fmt(b.format), b.sponsor || "", num(b.reward_gems, 0), num(b.skippable_after, 5), num(b.duration_s, 15),
    Math.max(1, num(b.weight, 1)), isoOrNull(b.start_at), isoOrNull(b.end_at), Math.max(0, num(b.daily_cap, 0)), aud(b.audience)
  );
  persistNow();
  res.json({ id: info.lastInsertRowid });
});

r.put("/:id", ...admin, (req, res) => {
  const b = req.body || {};
  db.prepare(`UPDATE ads SET slot=?, node_id=?, title_fa=?, title_en=?, body_fa=?, body_en=?, image=?,
    cta_fa=?, cta_en=?, url=?, bg=?, active=?,
    format=?, sponsor=?, reward_gems=?, skippable_after=?, duration_s=?,
    weight=?, start_at=?, end_at=?, daily_cap=?, audience=? WHERE id=?`).run(
    b.slot || "path", nid(b.node_id), b.title_fa || "", b.title_en || "", b.body_fa || "", b.body_en || "",
    b.image || "", b.cta_fa || "", b.cta_en || "", b.url || "", b.bg || "#2f7fd1",
    b.active === 0 ? 0 : 1,
    fmt(b.format), b.sponsor || "", num(b.reward_gems, 0), num(b.skippable_after, 5), num(b.duration_s, 15),
    Math.max(1, num(b.weight, 1)), isoOrNull(b.start_at), isoOrNull(b.end_at), Math.max(0, num(b.daily_cap, 0)), aud(b.audience),
    req.params.id
  );
  persistNow();
  res.json({ ok: true });
});

// Quick toggle a single ad on/off (management convenience).
r.put("/:id/toggle", ...admin, (req, res) => {
  const a = db.prepare("SELECT active FROM ads WHERE id=?").get(req.params.id);
  if (!a) return res.status(404).json({ error: "not found" });
  db.prepare("UPDATE ads SET active=? WHERE id=?").run(a.active ? 0 : 1, req.params.id);
  persistNow();
  res.json({ ok: true, active: a.active ? 0 : 1 });
});

r.delete("/:id", ...admin, (req, res) => {
  db.prepare("DELETE FROM ads WHERE id=?").run(req.params.id);
  persistNow();
  res.json({ ok: true });
});

export default r;
