/* admin.js — Super-admin control panel API (role = 'admin' only).
   Full platform control: system overview, audit log, feature flags, learner
   management (ban/activate/XP/premium/reset/delete), impersonation, global
   settings, microlearning content management, and data export.
   Every write action is recorded in the immutable audit log. */
import { Router } from "express";
import { searchPool, normalizeText, highlightRanges, normDigits } from "../lib/textsearch.js";
import path from "path";
import { hashPassword } from "../lib/password.js";
import { db, persistNow } from "../db.js";
import { authRequired, requireRole, signToken, bumpTokenVer } from "../lib/auth.js";
import { audit, listAudit } from "../lib/audit.js";
import { allFlags, setFlag, ensureFlags } from "../lib/flags.js";
import { requirePerm, permsFor, PERMISSIONS, EDITABLE_ROLES, currentRolePerms, setRolePermOverrides } from "../lib/rbac.js";
import { getSetting, setSetting } from "./content.js";
import { checkStudentLimit } from "../lib/orglimits.js";
import { parseCSV, toCSV } from "../lib/csv.js";
import { moderationQueue, moderate, communityStats } from "../lib/community.js";
import { listPrograms, saveProgramsSetting } from "../lib/programs.js";
import { getGameConfig, saveGameConfig, DEFAULT_GAME_CONFIG } from "../lib/gameconfig.js";
import { listTickets, adminThread, adminReply, markAdminRead, setStatus, setCategory, supportStats } from "../lib/support.js";
import { HELP_CATEGORIES, adminArticles, createArticle, updateArticle, deleteArticle } from "../lib/helpcenter.js";
import {
  getLiveStats,
  listTestimonials, createTestimonial, updateTestimonial, deleteTestimonial,
  listFaqs, createFaq, updateFaq, deleteFaq,
  listBadges, createBadge, updateBadge, deleteBadge,
} from "../lib/landing.js";
import { productHealth } from "../lib/producthealth.js";
import { cardFacets, buildFacetIndex, matchFacets, sortCards } from "../lib/cardfacets.js";
import { recordCardChange, recordImport, listRevisions, revisionSummary } from "../lib/cardhistory.js";
import { analyzeFsrs, loadTrainingItems, optimizeParams, evaluateParams } from "../lib/fsrs-optimizer.js";
import {
  listPacks as gpListPacks, serializePack as gpSerializePack, createPack as gpCreatePack,
  updatePack as gpUpdatePack, deletePack as gpDeletePack, adminOrders as gpAdminOrders, adminStats as gpAdminStats,
} from "../lib/grouppurchase.js";
import {
  premiumOverview, premiumSubscribers, grantPremium, grantLifetime, revokePremium, findLearner,
} from "../lib/premiumadmin.js";
import {
  listCases as dxListCases, createCase as dxCreateCase, updateCase as dxUpdateCase,
  deleteCase as dxDeleteCase, adminStats as dxAdminStats, todaysCase as dxTodaysCase,
  importCases as dxImportCases, importTemplate as dxImportTemplate,
} from "../lib/dxchallenge.js";
import { adminReferralStats, referralLeaderboard } from "../lib/referral.js";
import {
  fillPair, tombstone, tombstoneNode, tombstoneTopic, tombstoneCard,
  isTombstoned, nodeIsTombstoned, topicIsTombstoned, cardIsTombstoned,
} from "../lib/adminbilingual.js";
import { isLearnContent } from "../lib/content-track.js";

const r = Router();
const admin = [authRequired, requireRole("admin")];      // full-admin-only
const P = (...perms) => [authRequired, requirePerm(...perms)];   // permission-gated (ANY of the perms)
// user-management routes are shared by the competitive admin (learn.users) and
// the university teacher/admin (uni.users) — either perm grants access.
const PU = ["learn.users", "uni.users"];
const L = (req) => (req.query.lang === "en" ? "en" : "fa");

/* ============ SYSTEM OVERVIEW ============ */
r.get("/overview", ...P("learn.view"), (req, res) => {
  const one = (sql, ...a) => db.prepare(sql).get(...a) || {};
  const bankSql = "CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.track') = 'learn' ELSE 0 END";
  const counts = {
    users: one("SELECT COUNT(*) c FROM users").c,
    students: one("SELECT COUNT(*) c FROM users WHERE role='student'").c,
    learners: one("SELECT COUNT(*) c FROM users WHERE role='learner'").c,
    teachers: one("SELECT COUNT(*) c FROM users WHERE role='teacher'").c,
    admins: one("SELECT COUNT(*) c FROM users WHERE role='admin'").c,
    inactive: one("SELECT COUNT(*) c FROM users WHERE status!='active'").c,
    flashcards: one(`SELECT COUNT(*) c FROM flashcards WHERE active=1 AND NOT COALESCE(${bankSql}, 0)`).c,
    cases: one(`SELECT COUNT(*) c FROM cases WHERE active=1 AND NOT COALESCE(${bankSql}, 0)`).c,
    learnQuestions: one(`SELECT COUNT(*) c FROM flashcards WHERE active=1 AND COALESCE(${bankSql}, 0)`).c,
    classes: one("SELECT COUNT(*) c FROM classes WHERE active=1").c,
    exams: one("SELECT COUNT(*) c FROM exams WHERE active=1").c,
    attempts: one("SELECT COUNT(*) c FROM attempts").c,
    challenges: one("SELECT COUNT(*) c FROM challenges").c,
    ads: one("SELECT COUNT(*) c FROM ads WHERE active=1").c,
    premium: one("SELECT COUNT(*) c FROM learner_profiles WHERE premium=1").c,
    totalXp: one("SELECT COALESCE(SUM(xp),0) c FROM learner_profiles").c,
  };
  // learner signups per day (last 14 days)
  const signups = db.prepare(`
    SELECT date(created_at) d, COUNT(*) n FROM users WHERE role='learner'
    GROUP BY date(created_at) ORDER BY d DESC LIMIT 14`).all().reverse();
  // ad performance
  const ads = db.prepare("SELECT COALESCE(SUM(impressions),0) imp, COALESCE(SUM(clicks),0) clk FROM ads").get();
  const recent = listAudit({ limit: 8 });
  res.json({ counts, signups, ads, recent });
});

/* ============ DEEP SITE ANALYTICS (DAU/WAU/MAU, retention, trends) ============ */
r.get("/analytics", ...P("learn.view"), async (req, res) => {
  const { siteAnalytics } = await import("../lib/site-analytics.js");
  res.json(siteAnalytics());
});
// Per-university / per-class breakdown (segmentation).
r.get("/analytics/segments", ...P("learn.settings"), async (req, res) => {
  const { byUniversity, byClass } = await import("../lib/site-analytics.js");
  const lang = L(req);
  const uni = req.query.university ? parseInt(req.query.university, 10) : null;
  res.json({ universities: byUniversity(lang), classes: byClass(lang, uni) });
});
// Site analytics CSV / printable-PDF exports.
r.get("/analytics.csv", ...P("learn.view"), async (req, res) => {
  const { siteAnalyticsCsv } = await import("../lib/analytics-export.js");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="site-analytics.csv"');
  audit(req, "analytics.export_csv", "site", {});
  res.send(siteAnalyticsCsv(L(req)));
});
r.get("/analytics.pdf", ...P("learn.view"), async (req, res) => {
  const { siteAnalyticsHtml } = await import("../lib/analytics-export.js");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(siteAnalyticsHtml(L(req)));
});
// Automatic health alerts + editable thresholds.
r.get("/analytics/alerts", ...P("learn.view"), async (req, res) => {
  const { computeAlerts } = await import("../lib/analytics-alerts.js");
  res.json(computeAlerts(L(req)));
});
r.put("/analytics/alerts", ...P("learn.settings"), async (req, res) => {
  const { getAlertThresholds } = await import("../lib/analytics-alerts.js");
  const cur = getAlertThresholds();
  const b = req.body || {}; const val = { ...cur };
  for (const k of Object.keys(cur)) if (b[k] !== undefined) val[k] = Math.max(0, Number(b[k]) || 0);
  setSetting("analytics_alerts", val);
  res.json({ ok: true, thresholds: val });
});

/* ---- Admin bell feed (analytics alerts + weekly digests) ---- */
r.get("/notifications", ...P("learn.view"), async (req, res) => {
  const { adminNotifications } = await import("../lib/analytics-notify.js");
  res.json(adminNotifications(req.user.id));
});
r.post("/notifications/seen", ...P("learn.view"), async (req, res) => {
  const { markAdminNotificationsSeen } = await import("../lib/analytics-notify.js");
  markAdminNotificationsSeen(req.user.id);
  res.json({ ok: true });
});
// Manually run alert notifications now (admin action).
r.post("/analytics/run-alerts", ...P("learn.settings"), async (req, res) => {
  const { runAdminAlertNotifications } = await import("../lib/analytics-notify.js");
  const sent = await runAdminAlertNotifications();
  res.json({ ok: true, sent });
});
// Preview the weekly digest text (without sending) or send it now.
r.get("/analytics/weekly-digest", ...P("learn.view"), async (req, res) => {
  const { buildWeeklyDigest } = await import("../lib/analytics-notify.js");
  res.json({ text: buildWeeklyDigest(L(req)) });
});
r.post("/analytics/weekly-digest", ...P("learn.settings"), async (req, res) => {
  const { runWeeklyDigest } = await import("../lib/analytics-notify.js");
  const sent = await runWeeklyDigest();
  res.json({ ok: true, sent });
});

/* ============ AUDIT LOG ============ */
r.get("/audit", ...P("learn.audit"), (req, res) => {
  res.json({ items: listAudit({ limit: Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 150)), action: req.query.action || "", actor: req.query.actor || "" }) });
});

/* ============ FEATURE FLAGS ============ */
r.get("/flags", ...P("learn.flags"), (req, res) => { ensureFlags(); res.json({ flags: allFlags() }); });
r.put("/flags/:key", ...P("learn.flags"), (req, res) => {
  const enabled = req.body?.enabled ? 1 : 0;
  setFlag(req.params.key, enabled);
  audit(req, "flag.toggle", `flag:${req.params.key}`, { enabled });
  res.json({ ok: true });
});

/* ============ ROLE PERMISSIONS (RBAC editor) — admin only ============
   Admin can grant/revoke any permission for any non-admin role, no code needed. */
r.get("/roles", ...admin, (req, res) => {
  res.json({
    permissions: PERMISSIONS,           // { key: description }
    editableRoles: EDITABLE_ROLES,
    rolePerms: currentRolePerms(),      // { role: [perm,...] }
  });
});
r.put("/roles/:role", ...admin, (req, res) => {
  const role = req.params.role;
  if (role === "admin" || !EDITABLE_ROLES.includes(role))
    return res.status(400).json({ error: "role not editable" });
  const perms = Array.isArray(req.body?.perms) ? req.body.perms.filter((p) => p in PERMISSIONS) : [];
  // persist the full override map
  const cur = currentRolePerms();
  cur[role] = perms;
  db.prepare("INSERT INTO settings (key,value) VALUES ('role_perms',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(JSON.stringify(cur));
  setRolePermOverrides(cur);            // apply immediately (no restart)
  audit(req, "rbac.role_edit", `role:${role}`, { perms });
  persistNow();
  res.json({ ok: true, rolePerms: currentRolePerms() });
});

/* ============ SUBSCRIPTION PRICING (admin-configurable) ============
   Prices are stored in Rial. The premium checkout reads these via getPlans(). */
r.get("/pricing", ...admin, (req, res) => {
  let cfg = {};
  try { const row = db.prepare("SELECT value FROM settings WHERE key='plan_prices'").get(); if (row) cfg = JSON.parse(row.value); } catch { /* */ }
  res.json({
    monthly: Number(cfg.monthly) || 990000,
    yearly: Number(cfg.yearly) || 7900000,
    monthlyDays: Number(cfg.monthlyDays) || 30,
    yearlyDays: Number(cfg.yearlyDays) || 365,
  });
});
r.put("/pricing", ...admin, (req, res) => {
  const b = req.body || {};
  const cfg = {
    monthly: Math.max(0, Number(b.monthly) || 0),
    yearly: Math.max(0, Number(b.yearly) || 0),
    monthlyDays: Math.max(1, Number(b.monthlyDays) || 30),
    yearlyDays: Math.max(1, Number(b.yearlyDays) || 365),
  };
  db.prepare("INSERT INTO settings (key,value) VALUES ('plan_prices',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(JSON.stringify(cfg));
  audit(req, "pricing.edit", "settings:plan_prices", cfg);
  persistNow();
  res.json({ ok: true, ...cfg });
});

/* ============ GLOBAL SETTINGS ============ */
r.get("/settings", ...P("learn.settings"), (req, res) => {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const map = Object.fromEntries(rows.map((x) => [x.key, x.value]));
  res.json({ settings: map });
});
r.put("/settings/:key", ...P("learn.settings"), (req, res) => {
  const value = String(req.body?.value ?? "");
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(req.params.key, value);
  audit(req, "settings.change", `settings:${req.params.key}`, { value });
  persistNow();
  res.json({ ok: true });
});

/* ---- JSON settings (maintenance mode, landing banner) ----
   These store structured objects (not plain strings). Kept separate from the
   generic string-settings endpoint above so values serialize correctly. */
function getJsonSetting(key, fallback) {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key);
  try { return row ? JSON.parse(row.value) : fallback; } catch { return fallback; }
}
function putJsonSetting(key, obj) {
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(key, JSON.stringify(obj || {}));
  persistNow();
}
// Maintenance mode
r.get("/maintenance", ...P("learn.settings"), (req, res) => {
  res.json(getJsonSetting("maintenance", { on: false, title_fa: "", title_en: "", body_fa: "", body_en: "" }));
});
r.put("/maintenance", ...P("learn.settings"), (req, res) => {
  const b = req.body || {};
  const val = {
    on: !!b.on,
    title_fa: String(b.title_fa || ""), title_en: String(b.title_en || ""),
    body_fa: String(b.body_fa || ""), body_en: String(b.body_en || ""),
  };
  putJsonSetting("maintenance", val);
  try { globalThis.__medschoolInvalidateMaintenanceCache?.(); } catch { /* */ }
  audit(req, "settings.maintenance", "settings:maintenance", { on: val.on });
  res.json({ ok: true, maintenance: val });
});

/* ---- Database backup (upgrade safety) --------------------------------------
   Lets an admin snapshot / download the whole database before upgrading the
   site, and shows where persistent data lives. All data (DB + uploads) is kept
   in DATA_DIR outside the code so upgrades never lose it — these tools make
   taking a safety copy a one-click action. */
r.get("/backup/status", ...P("learn.settings"), async (req, res) => {
  const fs = await import("fs");
  const { DATA_DIR, UPLOADS_DIR, BACKUPS_DIR, DB_PATH } = await import("../lib/paths.js");
  const size = (p) => { try { return fs.statSync(p).size; } catch { return 0; } };
  let backups = [];
  try {
    backups = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith(".db"))
      .map((f) => ({ name: f, size: size(path.join(BACKUPS_DIR, f)) }))
      .sort((a, b) => b.name.localeCompare(a.name)).slice(0, 20);
  } catch { /* */ }
  let uploadCount = 0;
  try { uploadCount = fs.readdirSync(UPLOADS_DIR).filter((f) => !f.startsWith(".")).length; } catch { /* */ }
  res.json({ dataDir: DATA_DIR, uploadsDir: UPLOADS_DIR, backupsDir: BACKUPS_DIR,
    dbSize: size(DB_PATH), uploadCount, backups });
});

// Create a timestamped snapshot of the DB inside DATA_DIR/backups.
r.post("/backup/create", ...P("learn.settings"), async (req, res) => {
  const fs = await import("fs");
  const { BACKUPS_DIR, DB_PATH } = await import("../lib/paths.js");
  const { persistNow } = await import("../db.js");
  try {
    persistNow();   // flush the in-memory DB to disk first
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const name = `medlab-backup-${stamp}.db`;
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    fs.copyFileSync(DB_PATH, path.join(BACKUPS_DIR, name));

    /* Prune old manual backups.

       Without this the directory grows without limit: every press of the
       button copies the whole database, and on a small cPanel plan a few dozen
       copies is enough to exhaust the disk quota and take the site down. The
       automatic start-up backup in db.js has always pruned; this manual one
       was the gap.

       Note the filename patterns differ deliberately — db.js writes
       "medlab-<stamp>.db" and this route writes "medlab-backup-<stamp>.db" —
       so the two kinds are pruned independently and an operator's deliberate
       snapshot is never deleted by a routine restart, or vice versa. */
    const KEEP_MANUAL = 5;
    try {
      const mine = fs.readdirSync(BACKUPS_DIR)
        .filter((f) => /^medlab-backup-.*\.db$/.test(f))
        .map((f) => ({ f, t: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t);
      for (const { f } of mine.slice(KEEP_MANUAL)) {
        try { fs.unlinkSync(path.join(BACKUPS_DIR, f)); } catch { /* keep going */ }
      }
    } catch { /* pruning is best-effort; never fail the backup itself */ }

    audit(req, "backup.create", `backup:${name}`, {});
    res.json({ ok: true, name });
  } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
});

// Download the current database file as an attachment.
r.get("/backup/download", ...P("learn.settings"), async (req, res) => {
  const { DB_PATH } = await import("../lib/paths.js");
  const { persistNow } = await import("../db.js");
  try {
    persistNow();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    audit(req, "backup.download", "backup:download", {});
    res.download(DB_PATH, `medlab-backup-${stamp}.db`);
  } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
});

// Landing promo banner
r.get("/banner", ...P("learn.settings"), (req, res) => {
  res.json(getJsonSetting("landing_banner", { on: false, text_fa: "", text_en: "", cta_fa: "", cta_en: "", url: "", bg: "#2f7fd1" }));
});
r.put("/banner", ...P("learn.settings"), (req, res) => {
  const b = req.body || {};
  const val = {
    on: !!b.on,
    text_fa: String(b.text_fa || ""), text_en: String(b.text_en || ""),
    cta_fa: String(b.cta_fa || ""), cta_en: String(b.cta_en || ""),
    url: String(b.url || ""), bg: String(b.bg || "#2f7fd1"),
  };
  putJsonSetting("landing_banner", val);
  audit(req, "settings.banner", "settings:landing_banner", { on: val.on });
  res.json({ ok: true, banner: val });
});

/* ---- Gamification config (Streak Wager, Monthly Quest, XP Ramp-Up event,
   Streak Revival, rewarded-ad rewards). Admin-tunable knobs. ---- */
r.get("/game-config", ...P("learn.settings"), (req, res) => {
  res.json({ config: getGameConfig(), defaults: DEFAULT_GAME_CONFIG });
});
r.put("/game-config", ...P("learn.settings"), (req, res) => {
  const cfg = saveGameConfig(req.body?.config || req.body || {});
  audit(req, "settings.game_config", "settings:gameplus_config", { keys: Object.keys(cfg) });
  res.json({ ok: true, config: cfg });
});

/* ---- Support & feedback inbox (agents reply to user tickets) ---- */
r.get("/support", ...P("learn.support"), (req, res) => {
  res.json({ tickets: listTickets(L(req), req.query.status || ""), stats: supportStats() });
});
r.get("/support/:id", ...P("learn.support"), (req, res) => {
  const t = adminThread(parseInt(req.params.id, 10), L(req));
  if (!t) return res.status(404).json({ error: "not found" });
  markAdminRead(parseInt(req.params.id, 10));
  res.json(t);
});
r.post("/support/:id/reply", ...P("learn.support"), (req, res) => {
  const body = String(req.body?.body || "").trim().slice(0, 4000);
  if (!body) return res.status(400).json({ error: "empty" });
  const agent = db.prepare("SELECT name_fa, name_en FROM users WHERE id=?").get(req.user.id);
  const name = (L(req) === "fa" ? (agent?.name_fa || agent?.name_en) : (agent?.name_en || agent?.name_fa)) || (L(req) === "fa" ? "پشتیبانی" : "Support");
  const r2 = adminReply(parseInt(req.params.id, 10), req.user.id, name, body);
  if (!r2.ok) return res.status(400).json({ error: r2.error });
  audit(req, "support.reply", `support:${req.params.id}`, {});
  res.json(adminThread(parseInt(req.params.id, 10), L(req)));
});
r.put("/support/:id/status", ...P("learn.support"), (req, res) => {
  const s = setStatus(parseInt(req.params.id, 10), String(req.body?.status || ""));
  audit(req, "support.status", `support:${req.params.id}`, { status: s });
  res.json({ ok: true, status: s });
});
r.put("/support/:id/category", ...P("learn.support"), (req, res) => {
  setCategory(parseInt(req.params.id, 10), String(req.body?.category || ""));
  res.json({ ok: true });
});

/* ---- Help center / FAQ management (admin-editable knowledge base) ---- */
r.get("/help", ...P("learn.content"), (req, res) => {
  res.json({ articles: adminArticles(), categories: HELP_CATEGORIES });
});
r.post("/help", ...P("learn.content"), (req, res) => {
  const id = createArticle(req.body || {});
  audit(req, "help.create", `help:${id}`, {});
  res.json({ id });
});
r.put("/help/:id", ...P("learn.content"), (req, res) => {
  updateArticle(parseInt(req.params.id, 10), req.body || {});
  audit(req, "help.update", `help:${req.params.id}`, {});
  res.json({ ok: true });
});
r.delete("/help/:id", ...P("learn.content"), (req, res) => {
  deleteArticle(parseInt(req.params.id, 10));
  audit(req, "help.delete", `help:${req.params.id}`, {});
  res.json({ ok: true });
});

/* ============ LANDING PAGE — SOCIAL PROOF MANAGEMENT ============
   Testimonials, trust badges, FAQ, and the live-stats display floor.
   Gated by learn.content so the content manager can maintain marketing copy. */

/* One combined read for the admin editor (all three lists + live stats snapshot). */
r.get("/landing", ...P("learn.content"), (req, res) => {
  res.json({
    stats: getLiveStats(),
    testimonials: listTestimonials({ publishedOnly: false }),
    faqs: listFaqs({ publishedOnly: false }),
    badges: listBadges({ publishedOnly: false }),
    floor: getGameConfig().landing?.stats_floor || {},
  });
});

/* Stats display floor lives inside the game-config blob (landing.stats_floor). */
r.put("/landing/floor", ...P("learn.content"), (req, res) => {
  const f = req.body?.floor || {};
  const cfg = getGameConfig();
  const num = (v, d) => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? Math.floor(x) : d; };
  const cur = cfg.landing?.stats_floor || {};
  const next = {
    learners: num(f.learners, cur.learners || 0),
    questions: num(f.questions, cur.questions || 0),
    topics: num(f.topics, cur.topics || 0),
    xp: num(f.xp, cur.xp || 0),
    accuracy: Math.min(100, num(f.accuracy, cur.accuracy || 0)),
  };
  saveGameConfig({ ...cfg, landing: { ...(cfg.landing || {}), stats_floor: next } });
  audit(req, "landing.floor", "landing", next);
  res.json({ ok: true, floor: next, stats: getLiveStats() });
});

/* --- Testimonials CRUD --- */
r.post("/landing/testimonials", ...P("learn.content"), (req, res) => {
  const t = createTestimonial(req.body || {});
  audit(req, "testimonial.create", `testimonial:${t.id}`, {});
  res.json({ testimonial: t });
});
r.put("/landing/testimonials/:id", ...P("learn.content"), (req, res) => {
  const t = updateTestimonial(parseInt(req.params.id, 10), req.body || {});
  if (!t) return res.status(404).json({ error: "not found" });
  audit(req, "testimonial.update", `testimonial:${req.params.id}`, {});
  res.json({ testimonial: t });
});
r.delete("/landing/testimonials/:id", ...P("learn.content"), (req, res) => {
  deleteTestimonial(parseInt(req.params.id, 10));
  audit(req, "testimonial.delete", `testimonial:${req.params.id}`, {});
  res.json({ ok: true });
});

/* --- Landing FAQ CRUD --- */
r.post("/landing/faqs", ...P("learn.content"), (req, res) => {
  const f = createFaq(req.body || {});
  audit(req, "landingFaq.create", `faq:${f.id}`, {});
  res.json({ faq: f });
});
r.put("/landing/faqs/:id", ...P("learn.content"), (req, res) => {
  const f = updateFaq(parseInt(req.params.id, 10), req.body || {});
  if (!f) return res.status(404).json({ error: "not found" });
  audit(req, "landingFaq.update", `faq:${req.params.id}`, {});
  res.json({ faq: f });
});
r.delete("/landing/faqs/:id", ...P("learn.content"), (req, res) => {
  deleteFaq(parseInt(req.params.id, 10));
  audit(req, "landingFaq.delete", `faq:${req.params.id}`, {});
  res.json({ ok: true });
});

/* --- Trust badges CRUD --- */
r.post("/landing/badges", ...P("learn.content"), (req, res) => {
  const b = createBadge(req.body || {});
  audit(req, "badge.create", `badge:${b.id}`, {});
  res.json({ badge: b });
});
r.put("/landing/badges/:id", ...P("learn.content"), (req, res) => {
  const b = updateBadge(parseInt(req.params.id, 10), req.body || {});
  if (!b) return res.status(404).json({ error: "not found" });
  audit(req, "badge.update", `badge:${req.params.id}`, {});
  res.json({ badge: b });
});
r.delete("/landing/badges/:id", ...P("learn.content"), (req, res) => {
  deleteBadge(parseInt(req.params.id, 10));
  audit(req, "badge.delete", `badge:${req.params.id}`, {});
  res.json({ ok: true });
});

/* ============ PRODUCT-HEALTH DASHBOARD ============
   Read-only engagement / activation / retention aggregates for admins. */
r.get("/product-health", ...P("learn.view"), (req, res) => {
  res.json(productHealth());
});

/* ============ FSRS PARAMETER OPTIMIZER ============
   Fit the spaced-repetition scheduler to REAL review history. Analyze is a
   dry-run; optimize computes new params and evaluates them; apply saves them
   into the game config (srs.params). Gated by learn.settings. */
r.get("/fsrs/analyze", ...P("learn.settings"), (req, res) => {
  res.json(analyzeFsrs(getGameConfig().srs));
});

r.post("/fsrs/optimize", ...P("learn.settings"), (req, res) => {
  const baseCfg = getGameConfig().srs;
  const items = loadTrainingItems();
  if (items.length < 5) {
    return res.status(400).json({ error: "not_enough_data", trainableCards: items.length });
  }
  const current = evaluateParams(baseCfg.params, items, baseCfg);
  const result = optimizeParams(items, baseCfg);
  audit(req, "fsrs.optimize", "srs", { logloss: result.logloss, cards: items.length });
  res.json({
    proposed: result.params,
    proposedEval: { logloss: round4(result.logloss), rmse: round4(result.rmse), evaluated: result.count },
    currentEval: { logloss: round4(current.logloss), rmse: round4(current.rmse), evaluated: current.count },
    trainableCards: items.length,
    improved: result.logloss < current.logloss,
  });
});

r.post("/fsrs/apply", ...P("learn.settings"), (req, res) => {
  const params = req.body?.params;
  if (!Array.isArray(params) || params.length !== 21 || params.some((x) => typeof x !== "number" || !Number.isFinite(x))) {
    return res.status(400).json({ error: "invalid_params" });
  }
  const cfg = getGameConfig();
  saveGameConfig({ ...cfg, srs: { ...cfg.srs, params } });
  audit(req, "fsrs.apply", "srs", { params });
  res.json({ ok: true, params });
});

function round4(x) { return Number.isFinite(x) ? Math.round(x * 1e4) / 1e4 : null; }

/* ============ GROUP PURCHASE (volume discount) MANAGEMENT ============
   Define seat packs (discounted per-seat), and view orders + redemption stats.
   Gated by learn.settings (it's a pricing / monetization concern). */
r.get("/group", ...P("learn.settings"), (req, res) => {
  // per-seat savings are computed vs the single monthly plan price (settings key)
  let singleMonthly = 990000;
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key='plan_prices'").get();
    if (row) { const cfg = JSON.parse(row.value); if (Number(cfg.monthly) > 0) singleMonthly = Number(cfg.monthly); }
  } catch { /* default */ }
  const packs = gpListPacks().map((p) => gpSerializePack(p, singleMonthly));
  res.json({ packs, orders: gpAdminOrders(), stats: gpAdminStats(), singleMonthly });
});
r.post("/group/packs", ...P("learn.settings"), (req, res) => {
  const p = gpCreatePack(req.body || {});
  audit(req, "grouppack.create", `pack:${p.id}`, {});
  res.json({ pack: p });
});
r.put("/group/packs/:id", ...P("learn.settings"), (req, res) => {
  const p = gpUpdatePack(parseInt(req.params.id, 10), req.body || {});
  if (!p) return res.status(404).json({ error: "not found" });
  audit(req, "grouppack.update", `pack:${req.params.id}`, {});
  res.json({ pack: p });
});
r.delete("/group/packs/:id", ...P("learn.settings"), (req, res) => {
  gpDeletePack(parseInt(req.params.id, 10));
  audit(req, "grouppack.delete", `pack:${req.params.id}`, {});
  res.json({ ok: true });
});

/* ============ PREMIUM ACCOUNTS MANAGEMENT ============
   Dedicated view of premium subscribers + manual grant/extend/revoke.
   Gated by learn.users (subscriber management is a user-admin concern). */
r.get("/premium", ...P("learn.users"), (req, res) => {
  res.json({ overview: premiumOverview(), subscribers: premiumSubscribers({ q: req.query.q || "" }) });
});
r.get("/premium/find", ...P("learn.users"), (req, res) => {
  res.json({ results: findLearner(req.query.q || "") });
});
r.post("/premium/grant", ...P("learn.users"), (req, res) => {
  const id = parseInt(req.body?.userId, 10);
  const lifetime = !!req.body?.lifetime;
  const days = parseInt(req.body?.days, 10) || 30;
  const result = lifetime ? grantLifetime(id) : grantPremium(id, days);
  if (!result.ok) return res.status(400).json(result);
  audit(req, "premium.grant", `users:${id}`, { days, lifetime });
  res.json(result);
});
r.post("/premium/revoke", ...P("learn.users"), (req, res) => {
  const id = parseInt(req.body?.userId, 10);
  revokePremium(id);
  audit(req, "premium.revoke", `users:${id}`, {});
  res.json({ ok: true });
});

/* ============ DAILY DIAGNOSIS CHALLENGE MANAGEMENT ============
   Admin authors the original clinical cases used by the daily game.
   Gated by learn.content (it's learner content). */
r.get("/dx", ...P("learn.content"), (req, res) => {
  const today = dxTodaysCase();
  res.json({ cases: dxListCases(), stats: dxAdminStats(), todayId: today ? today.id : null });
});
r.post("/dx", ...P("learn.content"), (req, res) => {
  const c = dxCreateCase(req.body || {});
  audit(req, "dx.create", `dx:${c.id}`, {});
  res.json({ case: c });
});
r.put("/dx/:id", ...P("learn.content"), (req, res) => {
  const c = dxUpdateCase(parseInt(req.params.id, 10), req.body || {});
  if (!c) return res.status(404).json({ error: "not found" });
  audit(req, "dx.update", `dx:${req.params.id}`, {});
  res.json({ case: c });
});
r.delete("/dx/:id", ...P("learn.content"), (req, res) => {
  dxDeleteCase(parseInt(req.params.id, 10));
  audit(req, "dx.delete", `dx:${req.params.id}`, {});
  res.json({ ok: true });
});
/* Bulk import cases from a CSV the admin already has the rights to use. */
r.post("/dx/import", ...P("learn.content"), (req, res) => {
  const csv = String(req.body?.csv || "");
  if (!csv.trim()) return res.status(400).json({ error: "empty" });
  let rows;
  try { rows = parseCSV(csv); } catch { return res.status(400).json({ error: "parse_error" }); }
  const result = dxImportCases(rows);
  audit(req, "dx.import", "dx", { imported: result.imported });
  res.json(result);
});
r.get("/dx/import/template.csv", ...P("learn.content"), (req, res) => {
  res.set("content-type", "text/csv; charset=utf-8");
  res.set("content-disposition", "attachment; filename=dx-template.csv");
  res.send(dxImportTemplate());
});

/* ============ GROWTH: referral + social-share analytics ============
   Reward amounts are edited via the game-config editor (referral / social groups).
   These endpoints surface the growth analytics + leaderboard. Perm learn.view. */
r.get("/growth", ...P("learn.view"), (req, res) => {
  res.json({ stats: adminReferralStats(), leaderboard: referralLeaderboard(L(req), 15) });
});

/* ============ SMART REMINDERS ============
   Behavior-based streak/goal/win-back reminders. Preview shows current reach;
   run sends them now (respecting the daily cap). Perm learn.settings. */
r.get("/reminders/preview", ...P("learn.settings"), async (req, res) => {
  const { previewSmartReminders } = await import("../lib/reminders.js");
  res.json(previewSmartReminders());
});
r.post("/reminders/run", ...P("learn.settings"), async (req, res) => {
  const { runSmartReminders } = await import("../lib/reminders.js");
  const result = await runSmartReminders({ force: true });
  audit(req, "reminders.run", "reminders", result);
  res.json(result);
});

/* ============ MOBILE APP (PWA) ============
   Install-funnel analytics for the installable "add to home screen" app.
   Read-only dashboard; the install experience itself is tuned via game-config
   (pwa group) and toggled by the `pwa_install` feature flag. Perm learn.view. */
r.get("/pwa", ...P("learn.view"), async (req, res) => {
  const { pwaStats } = await import("../lib/pwa.js");
  res.json(pwaStats());
});

/* ============ SECURITY (hardening status + tunables) ============
   Read-only status of the production hardening (Helmet headers, rate limits,
   bcrypt cost, env). Rate-limit numbers are tuned in game-config (security
   group). Perm learn.settings. */
r.get("/security", ...P("learn.settings"), async (req, res) => {
  const { securityStatus } = await import("../lib/security.js");
  const { googleConfigured, googleClientId } = await import("../lib/google.js");
  const st = securityStatus();
  st.google_configured = googleConfigured();
  st.google_client_id = googleClientId();
  res.json(st);
});
r.put("/security/google", ...P("learn.settings"), async (req, res) => {
  const { setGoogleClientId, googleClientId } = await import("../lib/google.js");
  const id = String(req.body?.client_id ?? "").trim();
  setGoogleClientId(id);
  audit(req, "security.google", "settings:google_client_id", { set: !!id });
  res.json({ ok: true, client_id: googleClientId() });
});

/* ============ RUM / WEB VITALS MONITORING ============
   Field data from real browsers: LCP, CLS, INP, TTFB + security events. */
r.get("/rum/summary", ...P("learn.view"), (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 14));
  const sinceExpr = `-${days} day`;
  const vitals = db.prepare("SELECT metric,value,rating,path,device,created_at FROM rum_vitals WHERE created_at >= datetime('now', ?) ORDER BY created_at DESC LIMIT 5000").all(sinceExpr);
  const pctl = (arr, p) => {
    const xs = arr.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (!xs.length) return null;
    return Math.round(xs[Math.min(xs.length - 1, Math.max(0, Math.ceil((p / 100) * xs.length) - 1))] * 10) / 10;
  };
  const byMetric = {};
  for (const m of vitals) {
    const k = m.metric;
    byMetric[k] = byMetric[k] || { metric: k, count: 0, values: [], good: 0, needs: 0, poor: 0, latest: null };
    byMetric[k].count++;
    byMetric[k].values.push(Number(m.value));
    if (m.rating === "good") byMetric[k].good++;
    else if (m.rating === "poor") byMetric[k].poor++;
    else if (m.rating) byMetric[k].needs++;
    byMetric[k].latest = byMetric[k].latest || m.created_at;
  }
  const metrics = Object.values(byMetric).map((m) => ({
    metric: m.metric,
    count: m.count,
    avg: pctl(m.values, 50),
    p75: pctl(m.values, 75),
    p95: pctl(m.values, 95),
    good: m.good,
    needsImprovement: m.needs,
    poor: m.poor,
    latest: m.latest,
  })).sort((a, b) => a.metric.localeCompare(b.metric));
  const paths = db.prepare(`SELECT path, metric, COUNT(*) count, AVG(value) avg
      FROM rum_vitals WHERE created_at >= datetime('now', ?)
      GROUP BY path, metric ORDER BY count DESC LIMIT 50`).all(sinceExpr)
    .map((r) => ({ ...r, avg: Math.round((r.avg || 0) * 10) / 10 }));
  const security = db.prepare(`SELECT kind,status,COUNT(*) count
      FROM security_events WHERE created_at >= datetime('now', ?)
      GROUP BY kind,status ORDER BY count DESC LIMIT 50`).all(sinceExpr);
  const recentSecurity = db.prepare(`SELECT kind,status,method,path,ip,created_at
      FROM security_events WHERE created_at >= datetime('now', ?)
      ORDER BY id DESC LIMIT 25`).all(sinceExpr);
  res.json({ days, total: vitals.length, metrics, paths, security, recentSecurity });
});

/* ============ BLOG (medical education articles) ============
   Public reading is under /api/site-content/blog; here we manage posts.
   Perm learn.content. */
r.get("/blog", ...P("learn.content"), async (req, res) => {
  const { adminList, blogStats, listCategories } = await import("../lib/blog.js");
  res.json({ posts: adminList(), stats: blogStats(), categories: listCategories() });
});
r.get("/blog/:id", ...P("learn.content"), async (req, res) => {
  const { adminGet } = await import("../lib/blog.js");
  const p = adminGet(Number(req.params.id));
  if (!p) return res.status(404).json({ error: "not found" });
  res.json(p);
});
r.post("/blog", ...P("learn.content"), async (req, res) => {
  const { createPost } = await import("../lib/blog.js");
  const p = createPost(req.body || {});
  audit(req, "blog.create", "blog", { id: p.id, slug: p.slug });
  res.json(p);
});
r.put("/blog/:id", ...P("learn.content"), async (req, res) => {
  const { updatePost } = await import("../lib/blog.js");
  const p = updatePost(Number(req.params.id), req.body || {}, req.user?.username);
  if (!p) return res.status(404).json({ error: "not found" });
  audit(req, "blog.update", "blog", { id: p.id });
  res.json(p);
});
// Edit history (revisions): list, view one, restore.
r.get("/blog/:id/revisions", ...P("learn.content"), async (req, res) => {
  const { listRevisions } = await import("../lib/blog.js");
  res.json({ revisions: listRevisions(Number(req.params.id)) });
});
r.get("/blog/:id/revisions/:rev", ...P("learn.content"), async (req, res) => {
  const { getRevision } = await import("../lib/blog.js");
  const rev = getRevision(Number(req.params.id), Number(req.params.rev));
  if (!rev) return res.status(404).json({ error: "not found" });
  res.json(rev);
});
r.post("/blog/:id/revisions/:rev/restore", ...P("learn.content"), async (req, res) => {
  const { restoreRevision } = await import("../lib/blog.js");
  const p = restoreRevision(Number(req.params.id), Number(req.params.rev), req.user?.username);
  if (!p) return res.status(404).json({ error: "not found" });
  audit(req, "blog.restore", "blog", { id: p.id, rev: Number(req.params.rev) });
  res.json(p);
});
r.delete("/blog/:id", ...P("learn.content"), async (req, res) => {
  const { deletePost } = await import("../lib/blog.js");
  audit(req, "blog.delete", "blog", { id: Number(req.params.id) });
  res.json(deletePost(Number(req.params.id)));
});
// Live markdown preview (render + TOC) without saving.
r.post("/blog/preview", ...P("learn.content"), async (req, res) => {
  const { renderMarkdown, extractToc } = await import("../lib/blog.js");
  const md = req.body?.markdown || "";
  res.json({ html: renderMarkdown(md), toc: extractToc(md) });
});
// AI draft generator (opt-in): builds a full post draft from a topic. Uses the
// shared university AI config; returns a clear message when no key is set so the
// zero-cost rule is honoured. The admin always reviews before publishing.
r.post("/blog/ai-draft", ...P("learn.content"), async (req, res) => {
  const { generateBlogDraft, resolveAiConfig } = await import("../lib/ai-engine.js");
  const aiCfg = resolveAiConfig(getSetting("ai", {}));
  const lang = req.body?.lang === "en" ? "en" : "fa";
  const out = await generateBlogDraft({ topic: req.body?.topic || "", lang, aiCfg });
  if (!out.ok) {
    const msg = out.reason === "no_key"
      ? (lang === "fa" ? "برای تولید خودکار، ابتدا کلید هوش مصنوعی را در «تنظیمات هوش مصنوعی» وارد کنید." : "Set an AI key in AI settings first.")
      : out.reason === "no_topic"
        ? (lang === "fa" ? "لطفاً موضوع مقاله را وارد کنید." : "Please enter a topic.")
        : (lang === "fa" ? "تولید ناموفق بود؛ دوباره تلاش کنید یا مدل دیگری انتخاب کنید." : "Generation failed; try again or another model.");
    return res.json({ ok: false, message: msg, reason: out.reason });
  }
  audit(req, "blog.ai_draft", "blog", { topic: String(req.body?.topic || "").slice(0, 80) });
  res.json(out);
});
// AI rewrite of a selected passage (improve/shorten/expand/simplify/fix).
r.post("/blog/ai-rewrite", ...P("learn.content"), async (req, res) => {
  const { rewriteText, resolveAiConfig } = await import("../lib/ai-engine.js");
  const aiCfg = resolveAiConfig(getSetting("ai", {}));
  const lang = req.body?.lang === "en" ? "en" : "fa";
  const out = await rewriteText({ text: req.body?.text || "", mode: req.body?.mode || "improve", lang, aiCfg });
  if (!out.ok) {
    const msg = out.reason === "no_key"
      ? (lang === "fa" ? "برای بازنویسی، ابتدا کلید هوش مصنوعی را در «تنظیمات هوش مصنوعی» وارد کنید." : "Set an AI key in AI settings first.")
      : out.reason === "no_text"
        ? (lang === "fa" ? "ابتدا متنی را انتخاب کنید." : "Select some text first.")
        : (lang === "fa" ? "بازنویسی ناموفق بود؛ دوباره تلاش کنید." : "Rewrite failed; try again.");
    return res.json({ ok: false, message: msg, reason: out.reason });
  }
  res.json(out);
});
// AI cover-image generator. Uses a FREE, keyless text-to-image service
// (Pollinations) by default so it honours the zero-cost rule; the result is
// downloaded and stored locally under /uploads so the site never hot-links.
r.post("/blog/ai-cover", ...P("learn.content"), async (req, res) => {
  const lang = req.body?.lang === "en" ? "en" : "fa";
  const prompt = String(req.body?.prompt || "").trim();
  if (!prompt) return res.json({ ok: false, message: lang === "fa" ? "توضیح تصویر را وارد کنید." : "Enter an image prompt." });
  // Provider is admin-configurable via settings key "blog_image_ai".
  const cfg = getSetting("blog_image_ai", {}) || {};
  const provider = cfg.provider || "pollinations";
  const fullPrompt = `${prompt}, professional medical illustration, clean editorial cover, high quality`;
  try {
    const fs = await import("fs");
    const path = await import("path");
    const { UPLOADS_DIR, ensureDataDirs } = await import("../lib/paths.js");
    ensureDataDirs();
    let buf = null, lastStatus = 0;

    if (provider === "pollinations") {
      // free, no key. Fixed public host (SSRF-safe). Retry with fresh seeds
      // (the free service is occasionally overloaded). Each attempt time-boxed.
      const enc = encodeURIComponent(fullPrompt);
      for (let attempt = 0; attempt < 3 && !buf; attempt++) {
        if (attempt) await new Promise((r2) => setTimeout(r2, 1500));
        const seed = Math.floor(Math.random() * 1e6);
        const url = `https://image.pollinations.ai/prompt/${enc}?width=1024&height=576&nologo=true&seed=${seed}`;
        try {
          const ctl = new AbortController(); const tmr = setTimeout(() => ctl.abort(), 40000);
          const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 MED-School/1.0" }, signal: ctl.signal });
          clearTimeout(tmr); lastStatus = resp.status;
          if (!resp.ok) continue;
          if (!/^image\//i.test(resp.headers.get("content-type") || "")) continue;
          const b = Buffer.from(await resp.arrayBuffer());
          if (b.length >= 500) buf = b;
        } catch { /* retry */ }
      }
    } else {
      // OpenAI-compatible /images/generations (OpenAI, OpenRouter, custom).
      if (!cfg.apiKey) return res.json({ ok: false, message: lang === "fa" ? "برای این سرویس تصویر، کلید API را در تنظیمات تصویر وارد کنید." : "Set an API key for this image provider." });
      const bases = { openai: "https://api.openai.com/v1", openrouter: "https://openrouter.ai/api/v1" };
      const base = (cfg.baseUrl && cfg.baseUrl.trim()) || bases[provider] || bases.openai;
      const { isSafeOutboundUrl } = await import("../lib/security.js");
      const chk = isSafeOutboundUrl(`${base}/images/generations`);
      if (!chk.ok) return res.json({ ok: false, message: lang === "fa" ? "آدرس سرویس تصویر نامعتبر است." : "Invalid image endpoint." });
      const ctl = new AbortController(); const tmr = setTimeout(() => ctl.abort(), 60000);
      const resp = await fetch(`${base}/images/generations`, {
        method: "POST", signal: ctl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({ model: cfg.model || "gpt-image-1", prompt: fullPrompt, size: "1024x1024", n: 1 }),
      });
      clearTimeout(tmr); lastStatus = resp.status;
      if (!resp.ok) { const det = await resp.text().catch(() => ""); throw new Error(`image provider ${resp.status} ${det.slice(0, 120)}`); }
      const j = await resp.json();
      const item = j?.data?.[0] || {};
      if (item.b64_json) buf = Buffer.from(item.b64_json, "base64");
      else if (item.url) {
        const { safeFetch } = await import("../lib/security.js");
        const ir = await safeFetch(item.url);
        if (ir.ok) buf = Buffer.from(await ir.arrayBuffer());
      }
    }

    if (!buf) throw new Error(`image service ${lastStatus || "unreachable"}`);
    const fname = "img_cover_" + Date.now() + "_" + Math.round(Math.random() * 1e6) + ".jpg";
    fs.writeFileSync(path.join(UPLOADS_DIR, fname), buf);
    audit(req, "blog.ai_cover", "blog", { provider, prompt: prompt.slice(0, 80) });
    res.json({ ok: true, url: `/uploads/${fname}` });
  } catch (e) {
    res.json({ ok: false, message: (lang === "fa" ? "تولید تصویر ناموفق بود؛ سرویس در دسترس نیست یا کلید/مدل نادرست است. می‌توانید تصویر را دستی بارگذاری یا از کتابخانه انتخاب کنید." : "Image generation failed; upload or pick from library instead."), error: String(e.message || e) });
  }
});


/* ============ DAILY USER ANALYTICS ============ */
r.get("/analytics/daily-users", ...P("learn.view"), (req,res)=>{const rows=db.prepare(`SELECT substr(created_at,1,10) day,COUNT(*) total,SUM(CASE WHEN role='student' THEN 1 ELSE 0 END) students,SUM(CASE WHEN role='teacher' THEN 1 ELSE 0 END) teachers,SUM(CASE WHEN role='learner' THEN 1 ELSE 0 END) learners FROM users GROUP BY substr(created_at,1,10) ORDER BY day DESC`).all();res.json({rows})});
r.get("/analytics/daily-users.csv", ...P("learn.view"), (req,res)=>{const rows=db.prepare(`SELECT substr(created_at,1,10) day,COUNT(*) total,SUM(CASE WHEN role='student' THEN 1 ELSE 0 END) students,SUM(CASE WHEN role='teacher' THEN 1 ELSE 0 END) teachers,SUM(CASE WHEN role='learner' THEN 1 ELSE 0 END) learners FROM users GROUP BY substr(created_at,1,10) ORDER BY day DESC`).all();res.type('text/csv; charset=utf-8').send(['day,total,students,teachers,learners',...rows.map(r=>`${r.day},${r.total||0},${r.students||0},${r.teachers||0},${r.learners||0}`)].join('\n'))});

/* ============ CERTIFICATES (verifiable completion credentials) ============
   Issued automatically on completion; here admins review/issue/revoke. Perm
   learn.users (they manage learner credentials). */
r.get("/certificates", ...P("learn.users"), async (req, res) => {
  const { adminList, adminStats } = await import("../lib/certificates.js");
  const lang = req.query.lang === "en" ? "en" : "fa";
  res.json({ list: adminList({ lang }), stats: adminStats() });
});
r.post("/certificates/issue", ...P("learn.users"), async (req, res) => {
  const { adminIssue } = await import("../lib/certificates.js");
  const out = adminIssue({ username: req.body?.username, kind: req.body?.kind || "program", courseId: req.body?.courseId || null });
  audit(req, "certificate.issue", "certificate", out);
  res.status(out.ok ? 200 : 400).json(out);
});
r.post("/certificates/:id/revoke", ...P("learn.users"), async (req, res) => {
  const { setRevoked } = await import("../lib/certificates.js");
  const revoked = req.body?.revoked !== false;
  audit(req, revoked ? "certificate.revoke" : "certificate.restore", "certificate", { id: Number(req.params.id) });
  res.json(setRevoked(Number(req.params.id), revoked));
});

/* ============ SEO (native Yoast/RankMath-equivalent) ============
   Edit site meta, per-route titles, social image, indexing switch. The engine
   injects real crawlable meta + JSON-LD into index.html for bots and serves
   sitemap.xml/robots.txt. Perm learn.settings. */
r.get("/seo", ...P("learn.settings"), async (req, res) => {
  const { getSeoConfig, DEFAULT_SEO } = await import("../lib/seo.js");
  res.json({ config: getSeoConfig(), defaults: DEFAULT_SEO });
});
r.put("/seo", ...P("learn.settings"), async (req, res) => {
  const { saveSeoConfig } = await import("../lib/seo.js");
  const saved = saveSeoConfig(req.body?.config || {});
  audit(req, "seo.update", "seo", {});
  res.json({ config: saved });
});
// Live preview of the rendered meta + JSON-LD for a given route/lang.
r.get("/seo/preview", ...P("learn.settings"), async (req, res) => {
  const { metaForRoute, buildJsonLd, renderMetaTags } = await import("../lib/seo.js");
  const route = req.query.route || "home";
  const lang = req.query.lang === "en" ? "en" : "fa";
  res.json({
    meta: metaForRoute(route, lang, route === "home" ? "/" : `/${route}`),
    jsonld: buildJsonLd(lang),
    html: renderMetaTags(route, lang, route === "home" ? "/" : `/${route}`),
  });
});

/* ============ TWA / Android app (Cafe Bazaar & Google Play) ============
   Manage the Digital Asset Links used to verify the Trusted Web Activity app.
   The admin enters the app package name + signing-cert SHA-256 fingerprint(s);
   the server publishes /.well-known/assetlinks.json so Chrome hides the URL bar
   inside the installed app. Perm learn.settings. */
r.get("/twa", ...P("learn.settings"), async (req, res) => {
  const { getTwaConfig, DEFAULT_TWA, renderAssetLinks } = await import("../lib/twa.js");
  res.json({ config: getTwaConfig(), defaults: DEFAULT_TWA, assetlinks: renderAssetLinks() });
});
r.put("/twa", ...P("learn.settings"), async (req, res) => {
  const { saveTwaConfig, renderAssetLinks } = await import("../lib/twa.js");
  const saved = saveTwaConfig(req.body?.config || {});
  audit(req, "twa.update", "twa", {});
  res.json({ config: saved, assetlinks: renderAssetLinks() });
});

/* ============ Virtual Patient (competitive side) ============
   Toggle whether learners get the virtual-patient feature, restrict to premium,
   and control its path / daily-challenge integration + daily reward. The engine
   itself is shared with the university exam flow. Perm learn.settings. */
r.get("/vpatient", ...P("learn.settings"), async (req, res) => {
  try {
  const { getVpatientConfig, DEFAULT_VPATIENT } = await import("../lib/vpatient.js");
  const { isEnabled } = await import("../lib/flags.js");
  res.json({ config: getVpatientConfig(), defaults: DEFAULT_VPATIENT, flagOn: isEnabled("virtual_patient") });
  } catch (e) {
    res.status(500).json({ error: "vpatient_config_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});
r.put("/vpatient", ...P("learn.settings"), async (req, res) => {
  try {
  const { saveVpatientConfig } = await import("../lib/vpatient.js");
  const saved = saveVpatientConfig(req.body?.config || {});
  audit(req, "vpatient.update", "vpatient", {});
  res.json({ config: saved });
  } catch (e) {
    res.status(500).json({ error: "vpatient_save_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* Per-case XP cap for the competitive virtual patient. Lists every active case
   with its title + current xp_max (falls back to the global default), so the
   admin can set how much ranking XP a 100%% performance on each case is worth. */
r.get("/vpatient/cases", ...P("learn.settings"), async (req, res) => {
  try {
  const { getVpatientConfig } = await import("../lib/vpatient.js");
  const lang = req.query.lang === "en" ? "en" : "fa";
  const def = getVpatientConfig().default_xp_max;
  const { isLearnContent } = await import("../lib/content-track.js");
  const rows = db.prepare("SELECT id, difficulty, data_json FROM cases WHERE active=1 ORDER BY id").all()
    .filter((r) => isLearnContent(r.data_json));
  const cases = rows.map((r) => {
    let d = {}; try { d = JSON.parse(r.data_json); } catch { d = {}; }
    const title = (lang === "fa" ? (d.title_fa || d.title_en) : (d.title_en || d.title_fa)) || `#${r.id}`;
    const own = Number(d.xp_max);
    return {
      id: r.id, title, difficulty: r.difficulty || "medium",
      xp_max: Number.isFinite(own) ? own : null,   // null = uses global default
      effective: Number.isFinite(own) ? own : def,
    };
  });
  res.json({ cases, defaultXpMax: def });
  } catch (e) {
    res.status(500).json({ error: "vpatient_cases_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

// Set (or clear, with null/empty) a single case's xp_max in its data_json.
r.put("/vpatient/cases/:id", ...P("learn.settings"), async (req, res) => {
  const id = +req.params.id;
  const row = db.prepare("SELECT data_json FROM cases WHERE id=? AND active=1").get(id);
  if (!row) return res.status(404).json({ error: "case not found" });
  if (!isLearnContent(row.data_json)) {
    return res.status(403).json({ error: "wrong_track", stage: "access" });
  }
  let d = {}; try { d = JSON.parse(row.data_json); } catch { d = {}; }
  const raw = req.body?.xp_max;
  if (raw === null || raw === "" || raw === undefined) { delete d.xp_max; }
  else {
    const n = Math.max(0, Math.round(Number(raw)));
    if (!Number.isFinite(n)) return res.status(400).json({ error: "bad xp_max" });
    d.xp_max = n;
  }
  db.prepare("UPDATE cases SET data_json=?, updated_at=datetime('now') WHERE id=?").run(JSON.stringify(d), id);
  persistNow();
  audit(req, "vpatient.case_xp", "case", { id, xp_max: d.xp_max ?? null });
  res.json({ ok: true, id, xp_max: d.xp_max ?? null });
});

/* ---- SEPARATE AI config for the competitive virtual patient ---- */
r.get("/vpatient/ai", ...P("learn.settings"), async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  try {
  const { getVpatientAiRaw } = await import("../lib/vpatient.js");
  res.json({ config: getVpatientAiRaw() });
  } catch (e) {
    res.status(500).json({ error: "vpatient_ai_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});
r.put("/vpatient/ai", ...P("learn.settings"), async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const { saveVpatientAi } = await import("../lib/vpatient.js");
  let saved;
  try { saved = saveVpatientAi(req.body || {}); }
  catch (e) { return res.status(400).json({ error: "invalid_ai_configuration", message: String(e.message) }); }
  audit(req, "vpatient.ai", "vpatient_ai", {});
  res.json({ config: saved });
});
/* Live connection test using the SEPARATE (effective) config + prompts. */
r.post("/vpatient/ai-test", ...P("learn.settings"), async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const { getVpatientAiEffective, getVpatientPromptsEffective, setVpatientAiConnected } = await import("../lib/vpatient.js");
  const { patientReply } = await import("../lib/ai-engine.js");
  const aiCfg = getVpatientAiEffective();
  if (!aiCfg.apiKey) return res.json({ connected: false, mode: "mock", message: "No API key — using mock engine." });
  try {
    const lang = req.body?.lang === "en" ? "en" : "fa";
    const result = await patientReply({
      caseData: lang === "fa"
        ? { chief_fa: "درد قفسه سینه", history_fa: "درد فشارنده از یک ساعت پیش، انتشار به بازوی چپ" }
        : { chief_en: "chest pain", history_en: "pressure-like pain for an hour, radiating to left arm" },
      userText: lang === "fa" ? "سلام، چه مشکلی دارید؟" : "Hello, what brings you in today?",
      lang, prompts: getVpatientPromptsEffective(), aiCfg,
    }, { throwOnError: true });   // surface the REAL provider error to the admin
    const ok = result.source === "llm";
    setVpatientAiConnected(ok);
    res.json({ connected: ok, mode: result.source, provider: aiCfg.lastRoute?.provider || aiCfg.provider || "", model: aiCfg.lastRoute?.model || aiCfg.model || "", route: aiCfg.lastRoute || null, sample: result.text || "" });
  } catch (e) {
    setVpatientAiConnected(false);
    res.json({ connected: false, mode: "mock", message: String(e.message || e) });
  }
});

/* ---- SEPARATE prompts for the competitive virtual patient ---- */
r.get("/vpatient/prompts", ...P("learn.settings"), async (req, res) => {
  try {
  const { getVpatientPromptsRaw } = await import("../lib/vpatient.js");
  res.json({ prompts: getVpatientPromptsRaw() });
  } catch (e) {
    res.status(500).json({ error: "vpatient_prompts_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});
r.put("/vpatient/prompts", ...P("learn.settings"), async (req, res) => {
  const { saveVpatientPrompts } = await import("../lib/vpatient.js");
  const saved = saveVpatientPrompts(req.body?.prompts || {});
  audit(req, "vpatient.prompts", "vpatient_prompts", {});
  res.json({ prompts: saved });
});

/* ---- Import from the university library (cases + flashcards) ----
   Both sections share the same `cases`/`flashcards` tables, so "import" here
   means CLONE: make an independent competitive copy the admin can tune (XP cap,
   edits) without affecting the university original. Also provides CSV export so
   the admin can round-trip. */
r.get("/vpatient/library", ...P("learn.settings"), async (req, res) => {
  try {
  const lang = req.query.lang === "en" ? "en" : "fa";
  const cases = db.prepare("SELECT id, difficulty, data_json FROM cases WHERE active=1 ORDER BY id DESC").all().map((r) => {
    let d = {}; try { d = JSON.parse(r.data_json); } catch { d = {}; }
    const title = (lang === "fa" ? (d.title_fa || d.title_en) : (d.title_en || d.title_fa)) || `#${r.id}`;
    return { id: r.id, title, difficulty: r.difficulty || "medium", specialty: (lang === "fa" ? d.specialty_fa : d.specialty_en) || "", competitive: !!d.competitive, xp_max: d.xp_max ?? null };
  });
  const cards = db.prepare("SELECT id, difficulty, data_json FROM flashcards WHERE active=1 ORDER BY id DESC LIMIT 500").all().map((r) => {
    let d = {}; try { d = JSON.parse(r.data_json); } catch { d = {}; }
    const q = (lang === "fa" ? (d.question_fa || d.q_fa || d.front_fa) : (d.question_en || d.q_en || d.front_en)) || `#${r.id}`;
    return { id: r.id, q: String(q).slice(0, 90), difficulty: r.difficulty || "medium", topic: (lang === "fa" ? d.topic_fa : d.topic_en) || d.topic || "" };
  });
  res.json({ cases, cards });
  } catch (e) {
    res.status(500).json({ error: "vpatient_library_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

// Clone one or more university cases into an independent competitive copy.
r.post("/vpatient/import-cases", ...P("learn.settings"), async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  let imported = 0;
  for (const id of ids) {
    const row = db.prepare("SELECT * FROM cases WHERE id=? AND active=1").get(id);
    if (!row) continue;
    let d = {}; try { d = JSON.parse(row.data_json); } catch { d = {}; }
    d.competitive = true;                       // tag the clone as competitive
    d.track = "learn";                          // isolation: clones are Learn bank, not university
    d.title_fa = (d.title_fa || "") + " (رقابتی)";
    d.title_en = (d.title_en || "") + " (Competitive)";
    db.prepare("INSERT INTO cases (version, difficulty, checklist_id, data_json, active) VALUES (1,?,?,?,1)")
      .run(row.difficulty, row.checklist_id, JSON.stringify(d));
    imported++;
  }
  persistNow();
  audit(req, "vpatient.import_cases", "case", { count: imported });
  res.json({ ok: true, imported });
});

// Clone one or more university flashcards into an independent competitive copy.
r.post("/vpatient/import-cards", ...P("learn.settings"), async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  let imported = 0;
  for (const id of ids) {
    const row = db.prepare("SELECT * FROM flashcards WHERE id=? AND active=1").get(id);
    if (!row) continue;
    let d = {}; try { d = JSON.parse(row.data_json); } catch { d = {}; }
    d.competitive = true;
    d.track = "learn";
    db.prepare("INSERT INTO flashcards (version, difficulty, data_json, active) VALUES (1,?,?,1)")
      .run(row.difficulty, JSON.stringify(d));
    imported++;
  }
  persistNow();
  audit(req, "vpatient.import_cards", "flashcard", { count: imported });
  res.json({ ok: true, imported });
});


function currentUniversityId(user) {
  if (!user?.id) return null;
  try { return db.prepare("SELECT university_id FROM users WHERE id=?").get(user.id)?.university_id || null; }
  catch { return null; }
}
function staffMaySeeUser(actor, target) {
  if (!actor || !target) return false;
  if (actor.role === "admin") return true;
  if (actor.role === "teacher") {
    return ["student", "teacher"].includes(target.role)
      && target.university_id === currentUniversityId(actor);
  }
  return target.role === "learner";
}
function staffMayWriteUser(actor, target) {
  if (!actor || !target) return false;
  if (actor.role === "admin") return true;
  if (actor.role === "teacher") {
    return target.role === "student"
      && target.university_id === currentUniversityId(actor);
  }
  return target.role === "learner";
}
function roleTrack(role) {
  if (role === "learner") return "learn";
  if (role === "student" || role === "teacher") return "university";
  return "staff";
}
function roleTrackLocked(from, to) {
  if (!from || !to || from === to) return false;
  const a = roleTrack(from), b = roleTrack(to);
  return (a === "learn" && b === "university") || (a === "university" && b === "learn");
}
function studentNoConflict(studentNo, excludeId = null) {
  const sn = String(studentNo || "").trim();
  if (!sn) return null;
  const snNorm = normDigits(sn);
  const row = excludeId
    ? db.prepare("SELECT id, username, name_fa, name_en, student_no, university_id FROM users WHERE (student_no=? OR student_no=?) AND id<>?").get(sn, snNorm, excludeId)
    : db.prepare("SELECT id, username, name_fa, name_en, student_no, university_id FROM users WHERE student_no=? OR student_no=?").get(sn, snNorm);
  return row || null;
}
function duplicateStudentPayload(u) {
  return u ? { id: u.id, username: u.username, name_fa: u.name_fa, name_en: u.name_en, student_no: u.student_no, university_id: u.university_id } : null;
}

/* ============ FULL USER / LEARNER MANAGEMENT ============ */
// unified user list with search + role/status filters + learner stats
r.get("/users", ...P(PU), (req, res) => {
  const { role = "", roles = "", status = "", q = "", scope = "" } = req.query;
  let sql = `SELECT u.id, u.username, u.email, u.name_fa, u.name_en, u.role, u.status, u.student_no,
    u.email_verified, u.google_id, u.university_id, u.phone, u.bio, u.nickname, u.anon_mode, u.created_at,
    uni.name_fa AS uni_name_fa, uni.name_en AS uni_name_en,
    lp.xp, lp.streak, lp.tier, lp.premium, lp.province
    FROM users u
    LEFT JOIN learner_profiles lp ON lp.user_id = u.id
    LEFT JOIN universities uni ON uni.id = u.university_id
    WHERE 1=1`;
  const args = [];
  // `roles` (comma-separated allow-list) restricts the universe of the tab
  // (e.g. uni tab = student,teacher ; competitive tab = learner). `role`
  // narrows further to a single role picked in the filter dropdown.
  const KNOWN_ROLES = ["student", "teacher", "admin", "learner", "content_manager", "support"];
  const roleList = String(roles).split(",").map((s) => s.trim()).filter((s) => KNOWN_ROLES.includes(s));
  if (roleList.length) { sql += ` AND u.role IN (${roleList.map(() => "?").join(",")})`; args.push(...roleList); }
  /* Tab scopes (what the user asked for):
       all         → everyone
       uni         → university people only: students, teachers and university
                     managers (admins attached to a university). Platform staff
                     (content_manager/support) and competitive learners are NOT
                     university users.
       competitive → learners only. */
  if (scope === "uni") sql += " AND (u.role IN ('student','teacher') OR (u.role='admin' AND u.university_id IS NOT NULL))";
  else if (scope === "competitive") sql += " AND u.role='learner'";
  if (role) { sql += " AND u.role=?"; args.push(role); }
  if (status) { sql += " AND u.status=?"; args.push(status); }
  if (req.user.role === "teacher") {
    const uni = currentUniversityId(req.user);
    sql += " AND u.university_id=? AND u.role IN ('student','teacher')"; args.push(uni || -1);
  } else if (req.user.role !== "admin") {
    sql += " AND u.role='learner'";
  }
  if (q) { sql += " AND (u.username LIKE ? OR u.name_fa LIKE ? OR u.name_en LIKE ? OR u.email LIKE ? OR u.student_no LIKE ?)"; args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  sql += " ORDER BY u.id DESC LIMIT 300";
  const rows = db.prepare(sql).all(...args);
  // attach exam assignments for students so the unified users panel can show
  // and pre-fill each student's exam access (parity with the legacy uni panel)
  const asg = db.prepare("SELECT case_id FROM exam_assignments WHERE user_id=? AND active=1");
  for (const u of rows) if (u.role === "student") u.caseIds = asg.all(u.id).map((a) => a.case_id);
  res.json({ users: rows });
});

// detailed single-user operational view
r.get("/users/:id", ...P(PU), (req, res) => {
  const u = db.prepare("SELECT id, username, name_fa, name_en, role, status, student_no, university_id, created_at FROM users WHERE id=?").get(req.params.id);
  if (!u) return res.status(404).json({ error: "not found" });
  if (req.user.role === "teacher" && (u.university_id !== currentUniversityId(req.user) || !["student","teacher"].includes(u.role))) return res.status(403).json({ error: "wrong_university" });
  if (!staffMaySeeUser(req.user, u)) return res.status(403).json({ error: "university_only", stage: "access" });
  const profile = db.prepare("SELECT * FROM learner_profiles WHERE user_id=?").get(u.id) || null;
  const attempts = db.prepare("SELECT COUNT(*) c FROM attempts WHERE user_id=?").get(u.id).c;
  const nodes = db.prepare("SELECT COUNT(*) c FROM node_progress WHERE user_id=? AND completed_at IS NOT NULL").get(u.id).c;
  const cards = db.prepare("SELECT COUNT(*) c FROM learner_cards WHERE user_id=?").get(u.id).c;
  const recentXp = db.prepare("SELECT amount, reason, day FROM xp_events WHERE user_id=? ORDER BY id DESC LIMIT 10").all(u.id);
  res.json({ user: u, profile, stats: { attempts, nodes, cards }, recentXp });
});

// create a user of ANY role (admin can add teachers/admins/students/learners)
r.post("/users", ...P(PU), async (req, res) => {
  const b = req.body || {};
  const uname = String(b.username || "").trim();
  if (!uname || !b.password) return res.status(400).json({ error: "username & password required" });
  const ALL_ROLES = ["student", "teacher", "admin", "learner", "content_manager", "support"];
  const PRIVILEGED = ["admin", "content_manager", "support", "teacher"];
  if (!ALL_ROLES.includes(b.role)) return res.status(400).json({ error: "bad role" });
  // only a full admin may create privileged roles (separation of duties)
  if (PRIVILEGED.includes(b.role) && req.user.role !== "admin") return res.status(403).json({ error: "only admin can assign privileged roles" });
  // a teacher may ONLY create students (not learners/others); admin may create any.
  if (req.user.role === "teacher" && b.role !== "student") return res.status(403).json({ error: "teachers can only add students" });
  if (req.user.role !== "admin" && req.user.role !== "teacher" && b.role !== "learner") {
    return res.status(403).json({ error: "university_only", stage: "access" });
  }
  if (db.prepare("SELECT id FROM users WHERE username=?").get(uname)) return res.status(409).json({ error: "username_taken", message_fa: "نام کاربری قبلاً ثبت شده است." });
  if (b.role === "student") {
    const conflict = studentNoConflict(b.student_no || uname);
    if (conflict) return res.status(409).json({ error: "student_no_exists", message_fa: "این شماره دانشجویی قبلاً در سامانه وجود دارد.", existing: duplicateStudentPayload(conflict) });
  }
  // a teacher's students are pinned to the teacher's own university.
  let uni = (b.role === "teacher" || b.role === "student") ? (parseInt(b.university_id, 10) || null) : null;
  if (req.user.role === "teacher") uni = currentUniversityId(req.user);
  if ((b.role === "teacher" || b.role === "student") && !uni) return res.status(400).json({ error: "university_required", message_fa: "برای استاد و دانشجو انتخاب دانشگاه الزامی است." });
  // University licence: refuse to grow a capped university's student roster.
  if (b.role === "student") {
    const hit = checkStudentLimit(uni, 1);
    if (hit) return res.status(403).json({ error: "university_student_limit", ...hit,
      message_fa: `سقف دانشجویان این دانشگاه (${hit.max}) تکمیل است.` });
  }
  const info = db.prepare("INSERT INTO users (username,email,password_hash,name_fa,name_en,student_no,role,status,university_id,phone,bio,nickname,email_verified) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)")
    .run(uname, b.email || null, await hashPassword(String(b.password)), b.name_fa || uname, b.name_en || uname, b.student_no || null, b.role, b.status || "active", uni, b.phone || null, b.bio || null, b.nickname || null);
  if (b.role === "learner")
    db.prepare("INSERT OR IGNORE INTO learner_profiles (user_id, week_key, hearts, hearts_updated, province) VALUES (?,?,?,?,?)")
      .run(info.lastInsertRowid, "", 5, new Date().toISOString(), b.province || "");
  audit(req, "user.create", `users:${info.lastInsertRowid}`, { role: b.role, username: uname });
  persistNow();
  res.json({ id: info.lastInsertRowid });
});

// soft edit: name / role / student_no / province
r.put("/users/:id", ...P(PU), (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if (!u) return res.status(404).json({ error: "not found" });
  const b = req.body || {};
  const ALL_ROLES = ["student", "teacher", "admin", "learner", "content_manager", "support"];
  const PRIVILEGED = ["admin", "content_manager", "support", "teacher"];
  let role = ALL_ROLES.includes(b.role) ? b.role : u.role;
  // non-admins may not grant/keep privileged roles via edit
  if (role !== u.role && PRIVILEGED.includes(role) && req.user.role !== "admin") return res.status(403).json({ error: "only admin can assign privileged roles" });
  if (req.user.role === "teacher" && (u.university_id !== currentUniversityId(req.user) || u.role !== "student")) return res.status(403).json({ error: "wrong_university" });
  if (!staffMayWriteUser(req.user, u)) return res.status(403).json({ error: "university_only", stage: "access" });
  // University student/teacher and competitive learner are separate tracks.
  // Teachers cannot convert a student into a learner (learners need no university_id).
  if (roleTrackLocked(u.role, role) || (req.user.role === "teacher" && role !== u.role)) {
    return res.status(403).json({ error: "role_track_locked", reason: "role_track_locked", stage: "access" });
  }
  let uni = b.university_id !== undefined ? (parseInt(b.university_id, 10) || null) : u.university_id;
  if (req.user.role === "teacher") uni = currentUniversityId(req.user);
  const newStudentNo = b.student_no ?? u.student_no;
  if (role === "student") {
    const conflict = studentNoConflict(newStudentNo, u.id);
    if (conflict) return res.status(409).json({ error: "student_no_exists", message_fa: "این شماره دانشجویی قبلاً در سامانه وجود دارد.", existing: duplicateStudentPayload(conflict) });
  }
  if ((role === "teacher" || role === "student") && !uni) return res.status(400).json({ error: "university_required", message_fa: "برای استاد و دانشجو انتخاب دانشگاه الزامی است." });
  // Becoming a (new) student of a university counts against its licence cap —
  // unchanged students do not.
  if (role === "student" && (u.role !== "student" || Number(u.university_id) !== Number(uni))) {
    const hit = checkStudentLimit(uni, 1);
    if (hit) return res.status(403).json({ error: "university_student_limit", ...hit,
      message_fa: `سقف دانشجویان این دانشگاه (${hit.max}) تکمیل است.` });
  }
  db.prepare("UPDATE users SET name_fa=?, name_en=?, role=?, student_no=?, email=?, university_id=?, phone=?, bio=?, nickname=? WHERE id=?")
    .run(b.name_fa ?? u.name_fa, b.name_en ?? u.name_en, role, b.student_no ?? u.student_no, b.email ?? u.email, uni,
      b.phone ?? u.phone, b.bio ?? u.bio, b.nickname ?? u.nickname, u.id);
  if (b.province != null) db.prepare("UPDATE learner_profiles SET province=? WHERE user_id=?").run(b.province, u.id);
  audit(req, "user.update", `users:${u.id}`, { before: { role: u.role, name_fa: u.name_fa }, after: { role, name_fa: b.name_fa } });
  persistNow();
  res.json({ ok: true });
});

// ban / activate (soft)
r.post("/users/:id/status", ...P(PU), (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if (!u) return res.status(404).json({ error: "not found" });
  if (!staffMayWriteUser(req.user, u)) return res.status(403).json({ error: "university_only", stage: "access" });
  if (u.role === "admin" && u.id === req.user.id) return res.status(400).json({ error: "cannot ban yourself" });
  const status = req.body?.status === "active" ? "active" : "inactive";
  db.prepare("UPDATE users SET status=? WHERE id=?").run(status, u.id);
  audit(req, "user.status", `users:${u.id}`, { status });
  persistNow();
  res.json({ ok: true });
});

// reset password
r.post("/users/:id/password", ...P(PU), async (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if (!u) return res.status(404).json({ error: "not found" });
  if (!staffMayWriteUser(req.user, u)) return res.status(403).json({ error: "university_only", stage: "access" });
  const pw = String(req.body?.password || "");
  if (pw.length < 3) return res.status(400).json({ error: "password too short" });
  const nextVer = bumpTokenVer(u.id);
  db.prepare("UPDATE users SET password_hash=?, token_ver=? WHERE id=?").run(await hashPassword(pw), nextVer, u.id);
  audit(req, "user.password_reset", `users:${u.id}`, {});
  persistNow();
  res.json({ ok: true });
});

// adjust learner XP / gems / premium / streak (support & moderation)
r.post("/users/:id/learner", ...P("learn.users"), (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if (!u || u.role !== "learner") return res.status(400).json({ error: "not a learner" });
  let p = db.prepare("SELECT * FROM learner_profiles WHERE user_id=?").get(u.id);
  if (!p) { db.prepare("INSERT INTO learner_profiles (user_id, week_key, hearts, hearts_updated) VALUES (?,?,?,?)").run(u.id, "", 5, new Date().toISOString()); p = db.prepare("SELECT * FROM learner_profiles WHERE user_id=?").get(u.id); }
  const b = req.body || {};
  const xp = b.xp != null ? Math.max(0, parseInt(b.xp, 10) || 0) : p.xp;
  const gems = b.gems != null ? Math.max(0, parseInt(b.gems, 10) || 0) : p.gems;
  const streak = b.streak != null ? Math.max(0, parseInt(b.streak, 10) || 0) : p.streak;
  const premium = b.premium != null ? (b.premium ? 1 : 0) : p.premium;
  // Never clobber an existing premium_until when only XP/gems/streak change.
  // Turning premium ON without an expiry uses grantPremium (30 days) so the
  // grant survives a restart; turning it OFF clears the expiry.
  if (b.premium === true || b.premium === 1) {
    const days = parseInt(b.days, 10) || 30;
    grantPremium(u.id, days);
    db.prepare("UPDATE learner_profiles SET xp=?, gems=?, streak=? WHERE user_id=?").run(xp, gems, streak, u.id);
  } else if (b.premium === false || b.premium === 0) {
    db.prepare("UPDATE learner_profiles SET xp=?, gems=?, streak=?, premium=0, premium_until=NULL WHERE user_id=?").run(xp, gems, streak, u.id);
  } else {
    db.prepare("UPDATE learner_profiles SET xp=?, gems=?, streak=? WHERE user_id=?").run(xp, gems, streak, u.id);
  }
  audit(req, "user.learner_adjust", `users:${u.id}`, { xp, gems, streak, premium });
  persistNow();
  res.json({ ok: true });
});

// Reset a learner's placement test (so they can retake it). Clears result +
// placement-based unlocks; never touches real lesson progress or stars.
r.post("/users/:id/reset-placement", ...P("learn.users"), async (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if (!u || u.role !== "learner") return res.status(400).json({ error: "not a learner" });
  const { resetPlacement } = await import("../lib/placement.js");
  resetPlacement(u.id);
  audit(req, "user.reset_placement", `users:${u.id}`, {});
  res.json({ ok: true });
});

// Placement analytics report (aggregate of all learners' placement results).
r.get("/placement/analytics", ...P("learn.view"), async (req, res) => {
  const { placementAnalytics } = await import("../lib/placement.js");
  const range = ["3m", "6m", "12m", "all"].includes(req.query.range) ? req.query.range : "all";
  res.json(placementAnalytics(req.query.lang === "en" ? "en" : "fa", range));
});

// Placement results as a downloadable CSV (one row per learner).
r.get("/placement/analytics.csv", ...P("learn.view"), async (req, res) => {
  const { placementAnalyticsCsv } = await import("../lib/placement.js");
  const csv = placementAnalyticsCsv(req.query.lang === "en" ? "en" : "fa");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="placement-results.csv"`);
  audit(req, "placement.export_csv", "placement", {});
  res.send(csv);
});

// impersonate: returns a short-lived token acting as the target user
r.post("/users/:id/impersonate", ...P("learn.users.impersonate"), (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if (!u) return res.status(404).json({ error: "not found" });
  // SECURITY: prevent privilege escalation — only a full admin may impersonate
  // a privileged (staff) account. Mid-level roles may impersonate end users only.
  const PRIVILEGED = ["admin", "content_manager", "support", "teacher"];
  if (PRIVILEGED.includes(u.role) && req.user.role !== "admin")
    return res.status(403).json({ error: "cannot impersonate a privileged account" });
  if (!staffMaySeeUser(req.user, u) || (req.user.role !== "admin" && u.role !== "learner")) {
    return res.status(403).json({ error: "university_only", stage: "access" });
  }
  const token = signToken({ id: u.id, role: u.role, username: u.username });
  audit(req, "user.impersonate", `users:${u.id}`, { username: u.username });
  res.json({ token, user: { id: u.id, username: u.username, role: u.role, name_fa: u.name_fa, name_en: u.name_en } });
});

// delete a single user (granular; blocks self + last admin)
r.delete("/users/:id", ...P("learn.users.delete"), (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if (!u) return res.status(404).json({ error: "not found" });
  if (u.id === req.user.id) return res.status(400).json({ error: "cannot delete yourself" });
  if (u.role === "admin" && db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin'").get().c <= 1)
    return res.status(400).json({ error: "cannot delete the last admin" });
  // cascade learner data
  db.prepare("DELETE FROM learner_profiles WHERE user_id=?").run(u.id);
  db.prepare("DELETE FROM node_progress WHERE user_id=?").run(u.id);
  db.prepare("DELETE FROM srs_state WHERE user_id=?").run(u.id);
  db.prepare("DELETE FROM xp_events WHERE user_id=?").run(u.id);
  db.prepare("DELETE FROM notifications WHERE user_id=?").run(u.id);
  db.prepare("DELETE FROM league_members WHERE user_id=?").run(u.id);
  db.prepare("DELETE FROM users WHERE id=?").run(u.id);
  audit(req, "user.delete", `users:${u.id}`, { username: u.username, role: u.role });
  persistNow();
  res.json({ ok: true });
});

/* ============ MICROLEARNING / CONTENT MANAGEMENT ============ */
// list all flashcards with their micro-lesson status (for content curation)
r.get("/content/cards", ...P("learn.content"), (req, res) => {
  const lang = L(req);
  const rows = db.prepare("SELECT id, data_json, difficulty, active FROM flashcards ORDER BY id DESC LIMIT 500").all();
  const cards = [];
  for (const c of rows) {
    if (req.user.role !== "admin" && !isLearnContent(c.data_json)) continue;
    let d = {}; try { d = JSON.parse(c.data_json); } catch { d = {}; }
    const hasMicro = !!(d.micro && (d.micro.lead_fa || d.micro.golden_fa || d.micro.lead_en));
    cards.push({
      id: c.id, active: c.active, type: d.type || "mcq", difficulty: c.difficulty,
      q: lang === "fa" ? (d.q_fa || d.title_fa) : (d.q_en || d.title_en),
      topic: d.topic || "", hasMicro,
    });
  }
  res.json({ cards });
});
// update just the micro-lesson of a card
r.put("/content/cards/:id/micro", ...P("learn.content"), (req, res) => {
  const c = db.prepare("SELECT * FROM flashcards WHERE id=?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  if (req.user.role !== "admin" && !isLearnContent(c.data_json)) {
    return res.status(403).json({ error: "university_only", stage: "access" });
  }
  let d = {}; try { d = JSON.parse(c.data_json); } catch { d = {}; }
  const b = req.body || {};
  d.micro = {
    lead_fa: b.lead_fa || "", lead_en: b.lead_en || "",
    golden_fa: b.golden_fa || "", golden_en: b.golden_en || "",
    points_fa: b.points_fa || [], points_en: b.points_en || [],
    options_fa: d.micro?.options_fa || [], options_en: d.micro?.options_en || [],
    source_fa: b.source_fa || "", source_en: b.source_en || "",
  };
  db.prepare("UPDATE flashcards SET data_json=? WHERE id=?").run(JSON.stringify(d), c.id);
  audit(req, "content.micro_edit", `flashcards:${c.id}`, {});
  persistNow();
  res.json({ ok: true });
});
// toggle a card active/inactive (soft)
r.post("/content/cards/:id/active", ...P("learn.content"), (req, res) => {
  const c = db.prepare("SELECT data_json FROM flashcards WHERE id=?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  if (req.user.role !== "admin" && !isLearnContent(c.data_json)) {
    return res.status(403).json({ error: "university_only", stage: "access" });
  }
  const active = req.body?.active ? 1 : 0;
  db.prepare("UPDATE flashcards SET active=? WHERE id=?").run(active, req.params.id);
  audit(req, "content.card_active", `flashcards:${req.params.id}`, { active });
  persistNow();
  res.json({ ok: true });
});

/* ---- Community deck moderation (approve / reject shared learner cards) ---- */
r.get("/community/queue", ...P("learn.content"), (req, res) => {
  res.json({ queue: moderationQueue(L(req)), stats: communityStats() });
});
r.post("/community/:id/moderate", ...P("learn.content"), (req, res) => {
  const action = req.body?.action === "approve" ? "approve" : "reject";
  const out = moderate(parseInt(req.params.id, 10), action);
  if (out.error) return res.status(404).json(out);
  audit(req, "community.moderate", `community_cards:${req.params.id}`, { action });
  res.json(out);
});

/* ============ BULK IMPORT of pre-internship questions ============
   Rich CSV importer supporting ALL question types + QB-style microlearning.
   Columns (header row, any order; blanks allowed):
     type            mcq | truefalse | fill | match | order   (default mcq)
     topic           topic slug (e.g. gi, cardio, surgery) — assigns to a subject
     difficulty      easy | medium | hard
     q_fa, q_en      question text
     options_fa      pipe-separated options (MCQ), e.g.  الف|ب|ج|د
     options_en      pipe-separated options (English)
     correct         1-based index of the correct MCQ option (e.g. 2)  [MCQ]
     answer          true | false                                      [truefalse]
     blank_fa/blank_en   the fill-in answer                            [fill]
     accept_fa/accept_en pipe-separated accepted alternatives          [fill]
     pairs_fa/pairs_en   pipe-separated "left::right" pairs            [match]
     items_fa/items_en   pipe-separated items in the CORRECT order     [order]
     hints_fa/hints_en   pipe-separated progressive hints
     lead_fa/lead_en     one-line takeaway (micro)
     golden_fa/golden_en نکتهٔ طلایی (golden note)
     analysis_fa/analysis_en  pipe-separated per-option analysis lines
     source_fa/source_en source / reference (شناسنامه)
*/
// Forgiving list splitter: accepts the pipe "|" plus common alternatives people
// naturally type — Persian/Arabic semicolon "؛", regular ";", or a newline —
// so admins don't have to remember one exact separator. ("::" for pairs stays.)
const splitPipe = (s) => String(s || "").split(/[|؛;\n]/).map((x) => x.trim()).filter(Boolean);

// tolerant column read: try several header names (aliases) for the same field,
// so both the full (options_fa) and simple (options / گزینه‌ها) headers work.
function col(row, ...names) {
  for (const n of names) {
    if (row[n] != null && String(row[n]).trim() !== "") return String(row[n]).trim();
  }
  return "";
}

// Resolve a topic given a slug OR a (fa/en) topic name the admin may have typed.
// `topicIndex` maps slug→slug and lowercased-name→slug. Returns "" if unknown.
export function resolveTopic(raw, topicIndex) {
  const v = String(raw || "").trim();
  if (!v) return "";
  if (topicIndex.bySlug.has(v)) return v;
  const lc = v.toLowerCase();
  if (topicIndex.byName.has(lc)) return topicIndex.byName.get(lc);
  return v; // unknown → keep as-is so the validator reports a clear error
}
function buildTopicIndex() {
  const rows = db.prepare("SELECT slug, name_fa, name_en FROM topics").all();
  const bySlug = new Set(rows.map((t) => t.slug));
  const byName = new Map();
  for (const t of rows) {
    if (t.name_fa) byName.set(String(t.name_fa).toLowerCase(), t.slug);
    if (t.name_en) byName.set(String(t.name_en).toLowerCase(), t.slug);
  }
  return { bySlug, byName };
}

// Figure out which MCQ option is correct from a very forgiving `correct` cell:
//  • a 1-based number ("2")            • a letter ("A"/"ب")
//  • the exact option text             • or a "*" prefix on the option itself
function resolveCorrectIndex(correctRaw, faOpts, enOpts) {
  const raw = String(correctRaw || "").trim();
  // 1) a "*" marker inside the options wins (e.g. "PUD*|Varices")
  const starIdx = faOpts.findIndex((o) => /\*$/.test(o)) ;
  const starIdxEn = enOpts.findIndex((o) => /\*$/.test(o));
  if (starIdx >= 0) return { idx: starIdx, star: true };
  if (starIdxEn >= 0) return { idx: starIdxEn, star: true };
  if (!raw) return { idx: 0, star: false };
  // 2) numeric index (1-based)
  const num = parseInt(raw.replace(/[^\d]/g, ""), 10);
  if (raw.match(/^\s*\d+\s*$/) && num >= 1) return { idx: num - 1, star: false };
  // 3) a single letter A/B/C/D or Persian ا/ب/ج/د
  const letters = { a: 0, b: 1, c: 2, d: 3, e: 4, "الف": 0, "ب": 1, "ج": 2, "د": 3, "ه": 4 };
  if (letters[raw.toLowerCase()] != null) return { idx: letters[raw.toLowerCase()], star: false };
  // 4) match the option text
  const all = faOpts.concat(enOpts).map((o) => o.replace(/\*$/, "").toLowerCase());
  const byText = all.indexOf(raw.toLowerCase()) % Math.max(1, faOpts.length);
  if (all.indexOf(raw.toLowerCase()) >= 0) return { idx: (all.indexOf(raw.toLowerCase())) % Math.max(1, Math.max(faOpts.length, enOpts.length)), star: false };
  return { idx: 0, star: false };
}

function rowToCardData(row, topicIndex) {
  topicIndex = topicIndex || buildTopicIndex();
  const type = (col(row, "type", "نوع") || "mcq").trim().toLowerCase();
  // topic accepts slug OR name (fa/en) — simple "topic"/"موضوع"/"درس" headers too
  const topicSlug = resolveTopic(col(row, "topic", "موضوع", "درس"), topicIndex);
  // question text: full (q_fa/q_en) or simple (question/سوال) headers
  const qFa = col(row, "q_fa", "question_fa", "question", "سوال", "پرسش");
  const qEn = col(row, "q_en", "question_en");
  const data = {
    track: "learn", type,
    course_fa: "پره‌انترنی", course_en: "Pre-internship",
    topic: topicSlug || undefined,
    q_fa: qFa || qEn || "", q_en: qEn || qFa || "",
    title_fa: qFa || qEn || "", title_en: qEn || qFa || "",
    questionText_fa: qFa || "", questionText_en: qEn || "",
    hints_fa: splitPipe(col(row, "hints_fa", "hints", "راهنمایی")), hints_en: splitPipe(col(row, "hints_en")),
    micro: {
      lead_fa: col(row, "lead_fa", "lead"), lead_en: col(row, "lead_en"),
      golden_fa: col(row, "golden_fa", "golden", "نکته_طلایی"), golden_en: col(row, "golden_en"),
      points_fa: [], points_en: [],
      options_fa: splitPipe(col(row, "analysis_fa", "analysis")), options_en: splitPipe(col(row, "analysis_en")),
      source_fa: col(row, "source_fa", "source", "منبع"), source_en: col(row, "source_en"),
    },
  };
  if (type === "mcq") {
    let fa = splitPipe(col(row, "options_fa", "options", "گزینه‌ها", "گزینه ها"));
    let en = splitPipe(col(row, "options_en"));
    const n = Math.max(fa.length, en.length);
    const { idx: correctIdx } = resolveCorrectIndex(col(row, "correct", "answer", "پاسخ", "جواب"), fa, en);
    // strip any "*" correct-markers from the visible option text
    fa = fa.map((o) => o.replace(/\*$/, "")); en = en.map((o) => o.replace(/\*$/, ""));
    data.options = [];
    for (let i = 0; i < n; i++) data.options.push({ fa: fa[i] || en[i] || "", en: en[i] || fa[i] || "", correct: i === correctIdx });
    if (data.options.length && !data.options.some((o) => o.correct)) data.options[0].correct = true;
    data.answerMode = "choice"; data.questionType = "text";
  } else if (type === "truefalse") {
    data.answer = /^(1|true|t|درست|بله|صحیح|yes|y)$/i.test(col(row, "answer", "correct", "پاسخ", "جواب"));
  } else if (type === "fill") {
    data.blank_fa = col(row, "blank_fa", "blank", "answer", "پاسخ"); data.blank_en = col(row, "blank_en");
    const accFa = splitPipe(col(row, "accept_fa", "accept"));
    data.accept_fa = accFa.length ? accFa : (data.blank_fa ? [data.blank_fa] : []);
    const accEn = splitPipe(col(row, "accept_en"));
    data.accept_en = accEn.length ? accEn : (data.blank_en ? [data.blank_en] : []);
  } else if (type === "match") {
    // pairs "left::right | left::right"  (also tolerates "left => right" / "left - right")
    const parsePair = (p) => p.split(/::|=>|—|(?: - )/).map((s) => s.trim());
    const fa = splitPipe(col(row, "pairs_fa", "pairs", "جفت‌ها")).map(parsePair);
    const en = splitPipe(col(row, "pairs_en")).map(parsePair);
    const n = Math.max(fa.length, en.length);
    data.pairs = [];
    for (let i = 0; i < n; i++) {
      const [lf, rf] = fa[i] || ["", ""]; const [le, re] = en[i] || ["", ""];
      data.pairs.push([lf || le || "", le || lf || "", rf || re || "", re || rf || ""]);
    }
  } else if (type === "order") {
    data.items_fa = splitPipe(col(row, "items_fa", "items", "آیتم‌ها"));
    const itEn = splitPipe(col(row, "items_en"));
    data.items_en = itEn.length ? itEn : data.items_fa;
  }
  return { data, topicSlug, difficulty: (col(row, "difficulty", "سختی") || "medium").trim().toLowerCase() };
}

/* Build a short, human-readable "here's what the site understood" summary for a
   parsed row — shown in the preview so admins can VERIFY the file was read
   correctly before importing. */
function explainRow(parsed, lang = "fa") {
  const d = parsed.data; const type = d.type;
  const q = (lang === "fa" ? d.q_fa : d.q_en) || d.q_fa || "";
  const out = { type, topic: parsed.topicSlug, difficulty: parsed.difficulty, question: q, detail: "" };
  if (type === "mcq") {
    const opts = (d.options || []).map((o, i) => `${i + 1}) ${(lang === "fa" ? o.fa : o.en) || o.fa}${o.correct ? " ✅" : ""}`);
    out.detail = opts.join("  ");
  } else if (type === "truefalse") {
    out.detail = d.answer ? (lang === "fa" ? "پاسخ: درست ✅" : "Answer: True ✅") : (lang === "fa" ? "پاسخ: نادرست ❌" : "Answer: False ❌");
  } else if (type === "fill") {
    out.detail = `${lang === "fa" ? "پاسخ" : "Answer"}: ${d.blank_fa || d.blank_en} ${d.accept_fa?.length > 1 ? `(+${d.accept_fa.length - 1})` : ""}`;
  } else if (type === "match") {
    out.detail = (d.pairs || []).map((p) => `${p[0]}↔${p[2]}`).join("  ");
  } else if (type === "order") {
    out.detail = (d.items_fa || []).map((it, i) => `${i + 1}.${it}`).join("  ");
  }
  return out;
}

function validateRow(parsed, i) {
  const { data, type } = { ...parsed, type: parsed.data.type };
  if (!data.q_fa && !data.q_en) return `ردیف ${i + 1}: متن سوال خالی است`;
  if (type === "mcq") {
    if (!data.options || data.options.length < 2) return `ردیف ${i + 1}: چهارگزینه‌ای حداقل ۲ گزینه لازم دارد`;
  } else if (type === "fill") {
    if (!data.blank_fa && !data.blank_en) return `ردیف ${i + 1}: پاسخ جای خالی خالی است`;
  } else if (type === "match") {
    if (!data.pairs || data.pairs.length < 2) return `ردیف ${i + 1}: تطبیق حداقل ۲ جفت لازم دارد`;
  } else if (type === "order") {
    if (!data.items_fa || data.items_fa.length < 2) return `ردیف ${i + 1}: مرتب‌سازی حداقل ۲ آیتم لازم دارد`;
  }
  return null;
}

// preview (dry-run): validate the CSV and report what WOULD be imported, no writes
/* ============ LEARNING PATH MANAGEMENT (topics + lessons/nodes + questions) ============
   Full admin control over the pre-internship path: create/edit/delete subjects
   and their lessons, choose which cards each lesson contains, and design new
   questions attached directly to a lesson. */

// full path tree for the admin editor
r.get("/path", ...P("learn.content"), (req, res) => {
  const program = req.query.program || null;   // optional program filter
  const topics = program
    ? db.prepare("SELECT * FROM topics WHERE program=? ORDER BY ord, id").all(program)
    : db.prepare("SELECT * FROM topics ORDER BY ord, id").all();
  const nodes = db.prepare("SELECT * FROM path_nodes ORDER BY topic_id, ord, id").all();
  const byTopic = {};
  for (const n of nodes) {
    let cardIds = []; try { cardIds = JSON.parse(n.card_ids || "[]"); } catch { /* */ }
    (byTopic[n.topic_id] ||= []).push({
      id: n.id, topic_id: n.topic_id, title_fa: n.title_fa, title_en: n.title_en,
      ord: n.ord, kind: n.kind, xp_reward: n.xp_reward, active: n.active, emoji: n.emoji || "",
      cardIds, cardCount: cardIds.length,
    });
  }
  res.json({
    programs: listPrograms(),
    topics: topics.map((t) => ({
      id: t.id, slug: t.slug, name_fa: t.name_fa, name_en: t.name_en, parent: t.parent,
      program: t.program || "preint",
      budget: t.budget, color: t.color, icon: t.icon, emoji: t.emoji || "", ord: t.ord, active: t.active,
      nodes: byTopic[t.id] || [],
    })),
  });
});

/* ---- Programs (Duolingo-style courses) management ---- */
r.get("/programs", ...P("learn.content"), (req, res) => {
  const withCounts = listPrograms().map((p) => ({
    ...p, topics: db.prepare("SELECT COUNT(*) c FROM topics WHERE program=?").get(p.slug).c,
  }));
  res.json({ programs: withCounts });
});
r.put("/programs", ...P("learn.content"), (req, res) => {
  const programs = Array.isArray(req.body?.programs) ? req.body.programs : [];
  if (!programs.length) return res.status(400).json({ error: "no programs" });
  saveProgramsSetting(programs);
  audit(req, "programs.update", "settings:programs", { count: programs.length });
  persistNow();
  res.json({ ok: true });
});

// ---- topics (subjects) ----
r.post("/path/topics", ...P("learn.content"), (req, res) => {
  const b = req.body || {};
  const slug = String(b.slug || "").trim() || ("topic_" + Date.now());
  try {
    const ord = db.prepare("SELECT COALESCE(MAX(ord),-1)+1 AS n FROM topics").get().n;
    const info = db.prepare(`INSERT INTO topics (slug,name_fa,name_en,parent,program,budget,color,icon,emoji,ord,active)
      VALUES (?,?,?,?,?,?,?,?,?,?,1)`).run(slug, b.name_fa || "", b.name_en || "", b.parent || "major",
      b.program || "preint", b.budget || 0, b.color || "#2f7fd1", b.icon || "flask", b.emoji || "", ord);
    audit(req, "path.topic_create", `topics:${info.lastInsertRowid}`, { slug });
    persistNow();
    res.json({ id: info.lastInsertRowid });
  } catch (e) { res.status(400).json({ error: "slug already exists" }); }
});
r.put("/path/topics/:id", ...P("learn.content"), (req, res) => {
  const t = db.prepare("SELECT * FROM topics WHERE id=?").get(req.params.id);
  if (!t) return res.status(404).json({ error: "not found" });
  const b = req.body || {};
  const names = fillPair(b.name_fa ?? t.name_fa, b.name_en ?? t.name_en);
  db.prepare(`UPDATE topics SET name_fa=?, name_en=?, parent=?, program=?, budget=?, color=?, icon=?, emoji=?, ord=? WHERE id=?`)
    .run(names.fa, names.en, b.parent ?? t.parent, b.program ?? t.program ?? "preint",
      b.budget ?? t.budget, b.color ?? t.color, b.icon ?? t.icon, b.emoji ?? t.emoji, b.ord ?? t.ord, t.id);
  audit(req, "path.topic_edit", `topics:${t.id}`, {});
  persistNow();
  res.json({ ok: true });
});
r.delete("/path/topics/:id", ...P("learn.content"), (req, res) => {
  const topic = db.prepare("SELECT * FROM topics WHERE id=?").get(req.params.id);
  const nodes = db.prepare("SELECT * FROM path_nodes WHERE topic_id=?").all(req.params.id);
  const tx = db.transaction(() => {
    for (const n of nodes) tombstoneNode(n, topic);
    tombstoneTopic(topic);
    db.prepare("DELETE FROM path_nodes WHERE topic_id=?").run(req.params.id);
    db.prepare("DELETE FROM topics WHERE id=?").run(req.params.id);
  });
  tx();
  audit(req, "path.topic_delete", `topics:${req.params.id}`, { both_langs: true });
  persistNow();
  res.json({ ok: true, both_langs: true });
});

// ---- lessons (path nodes) ----
r.post("/path/nodes", ...P("learn.content"), (req, res) => {
  const b = req.body || {};
  const topicId = parseInt(b.topic_id, 10);
  if (!topicId) return res.status(400).json({ error: "topic_id required" });
  const ord = db.prepare("SELECT COALESCE(MAX(ord),-1)+1 AS n FROM path_nodes WHERE topic_id=?").get(topicId).n;
  const cardIds = Array.isArray(b.cardIds) ? b.cardIds.map(Number).filter(Boolean) : [];
  const titles = fillPair(b.title_fa, b.title_en);
  const info = db.prepare(`INSERT INTO path_nodes (topic_id,title_fa,title_en,ord,kind,card_ids,xp_reward,emoji,active)
    VALUES (?,?,?,?,?,?,?,?,1)`).run(topicId, titles.fa, titles.en, ord,
    b.kind || "lesson", JSON.stringify(cardIds), b.xp_reward || 20, b.emoji || "");
  audit(req, "path.node_create", `path_nodes:${info.lastInsertRowid}`, { topicId });
  persistNow();
  res.json({ id: info.lastInsertRowid });
});
r.put("/path/nodes/:id", ...P("learn.content"), (req, res) => {
  const n = db.prepare("SELECT * FROM path_nodes WHERE id=?").get(req.params.id);
  if (!n) return res.status(404).json({ error: "not found" });
  const b = req.body || {};
  const titles = fillPair(b.title_fa ?? n.title_fa, b.title_en ?? n.title_en);
  // Tombstone the OLD titles only so the next official import does not mint a
  // second lesson under the printed chapter name. Never tombstone the node id
  // here — the live renamed row must stay attachable.
  if (titles.fa !== n.title_fa || titles.en !== n.title_en) {
    const topic = db.prepare("SELECT * FROM topics WHERE id=?").get(n.topic_id);
    const slug = topic?.slug || "";
    if (slug && n.title_fa && n.title_fa !== titles.fa) tombstone("node", `${slug}:${n.title_fa}`);
    if (slug && n.title_en && n.title_en !== titles.en) tombstone("node", `${slug}:${n.title_en}`);
  }
  const cardIds = Array.isArray(b.cardIds) ? b.cardIds.map(Number).filter(Boolean) : (() => { try { return JSON.parse(n.card_ids); } catch { return []; } })();
  db.prepare(`UPDATE path_nodes SET title_fa=?, title_en=?, kind=?, card_ids=?, xp_reward=?, emoji=?, ord=? WHERE id=?`)
    .run(titles.fa, titles.en, b.kind ?? n.kind,
      JSON.stringify(cardIds), b.xp_reward ?? n.xp_reward, b.emoji ?? n.emoji, b.ord ?? n.ord, n.id);
  audit(req, "path.node_edit", `path_nodes:${n.id}`, {});
  persistNow();
  res.json({ ok: true });
});
r.delete("/path/nodes/:id", ...P("learn.content"), (req, res) => {
  const n = db.prepare("SELECT * FROM path_nodes WHERE id=?").get(req.params.id);
  const topic = n ? db.prepare("SELECT * FROM topics WHERE id=?").get(n.topic_id) : null;
  tombstoneNode(n, topic);
  db.prepare("DELETE FROM path_nodes WHERE id=?").run(req.params.id);
  audit(req, "path.node_delete", `path_nodes:${req.params.id}`, { both_langs: true });
  persistNow();
  res.json({ ok: true, both_langs: true });
});

// cards available to attach to a lesson (learn-track only), with quick labels
r.get("/path/cards", ...P("learn.content"), (req, res) => {
  const lang = L(req);
  const rows = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE active=1 ORDER BY id DESC").all();
  const cards = [];
  for (const c of rows) {
    if (!isLearnContent(c.data_json)) continue;
    let d = {}; try { d = JSON.parse(c.data_json); } catch { /* */ }
    cards.push({ id: c.id, type: d.type || "mcq", difficulty: c.difficulty, track: d.track || "uni",
      q: (lang === "fa" ? (d.q_fa || d.title_fa) : (d.q_en || d.title_en)) || `#${c.id}` });
  }
  res.json({ cards });
});

// design a brand-new question (flashcard) and optionally attach it to a lesson
r.post("/path/questions", ...P("learn.content"), (req, res) => {
  const b = req.body || {};
  const data = {
    type: b.type || "mcq", track: "learn",
    q_fa: b.q_fa || "", q_en: b.q_en || b.q_fa || "",
    title_fa: b.q_fa || "", title_en: b.q_en || b.q_fa || "",
    hints_fa: Array.isArray(b.hints_fa) ? b.hints_fa : [],
    hints_en: Array.isArray(b.hints_en) ? b.hints_en : [],
  };
  if ((b.type || "mcq") === "mcq") {
    // Keep the per-option rationale (why_fa/why_en) authored in the admin form
    // and sent by the past-exam importer; cardserialize already exposes it to
    // the learner as the UWorld-style "why this option is right/wrong" note.
    data.options = (b.options || []).map((o) => ({
      fa: o.fa || "", en: o.en || o.fa || "", correct: !!o.correct,
      ...(o.why_fa ? { why_fa: o.why_fa } : {}),
      ...(o.why_en ? { why_en: o.why_en } : {}),
    }));
  } else if (b.type === "truefalse") {
    data.answer = !!b.answer;
  } else if (b.type === "fill") {
    data.accept_fa = b.accept_fa || []; data.accept_en = b.accept_en || [];
    data.blank_fa = b.blank_fa || ""; data.blank_en = b.blank_en || "";
  }
  if (b.micro) data.micro = b.micro;
  const info = db.prepare("INSERT INTO flashcards (difficulty, data_json, active) VALUES (?,?,1)")
    .run(b.difficulty || "medium", JSON.stringify(data));
  const cardId = info.lastInsertRowid;
  // attach to a node if provided
  if (b.node_id) {
    const n = db.prepare("SELECT card_ids FROM path_nodes WHERE id=?").get(b.node_id);
    if (n) {
      let ids = []; try { ids = JSON.parse(n.card_ids || "[]"); } catch { /* */ }
      if (!ids.includes(cardId)) ids.push(cardId);
      db.prepare("UPDATE path_nodes SET card_ids=? WHERE id=?").run(JSON.stringify(ids), b.node_id);
    }
  }
  audit(req, "path.question_create", `flashcards:${cardId}`, { node_id: b.node_id || null });
  persistNow();
  res.json({ id: cardId });
});

// reorder lessons within a topic (drag & drop): body { order: [nodeId,...] }
r.put("/path/topics/:id/reorder", ...P("learn.content"), (req, res) => {
  const order = Array.isArray(req.body?.order) ? req.body.order.map(Number).filter(Boolean) : [];
  const tx = db.transaction(() => {
    order.forEach((nodeId, i) => db.prepare("UPDATE path_nodes SET ord=? WHERE id=? AND topic_id=?").run(i, nodeId, req.params.id));
  });
  tx();
  audit(req, "path.reorder", `topics:${req.params.id}`, { count: order.length });
  persistNow();
  res.json({ ok: true });
});
// reorder subjects (topics) themselves: body { order: [topicId,...] }
r.put("/path/reorder", ...P("learn.content"), (req, res) => {
  const order = Array.isArray(req.body?.order) ? req.body.order.map(Number).filter(Boolean) : [];
  const tx = db.transaction(() => {
    order.forEach((tid, i) => db.prepare("UPDATE topics SET ord=? WHERE id=?").run(i, tid));
  });
  tx();
  audit(req, "path.reorder_topics", "topics", { count: order.length });
  persistNow();
  res.json({ ok: true });
});

/* ============ LEARN (non-university) CARD LIBRARY ============
   Full control over competitive-track cards: create (single & bulk), mark
   premium, tag category, edit, delete, and see where each is used. */
// Content analytics dashboard: overall coverage of the competitive-track cards
// — media/lesson-note/answer-key coverage, type & difficulty distribution, and
// per-subject/section breakdown incl. content gaps. AI-free, computed on read.
r.get("/content-stats", ...P("learn.content"), async (req, res) => {
  const lang = L(req);
  const rows = db.prepare("SELECT id, data_json, difficulty, active FROM flashcards").all();
  const topics = db.prepare("SELECT id, slug, name_fa, name_en, parent, program FROM topics").all();
  const topicBySlug = {}; for (const t of topics) topicBySlug[t.slug] = t;
  // which cards are used in a lesson (and their topic via the node)
  const nodeTopic = {}; const usedCards = new Set();
  for (const n of db.prepare("SELECT card_ids, topic_id FROM path_nodes").all()) {
    let ids = []; try { ids = JSON.parse(n.card_ids || "[]"); } catch { ids = []; }
    const tp = topics.find((t) => t.id === n.topic_id);
    for (const cid of ids) { usedCards.add(cid); if (tp) (nodeTopic[cid] ||= new Set()).add(tp.slug); }
  }
  const mediaKind = (m) => (!m ? null : (typeof m === "string" ? (m ? "image" : null) : (m.kind || (m.url ? "image" : null))));

  const totals = { total: 0, active: 0, premium: 0, withMedia: 0, withImage: 0, withVideo: 0, withEmbed: 0,
    withMicro: 0, withExplain: 0, withMnemonic: 0, withHints: 0, usedInPath: 0, orphan: 0 };
  const byType = {}; const byDifficulty = {};
  const bySubject = {}; // slug -> counters
  const bySection = {};

  for (const c of rows) {
    let d = {}; try { d = JSON.parse(c.data_json); } catch { d = {}; }
    if ((d.track || "uni") !== "learn") continue;   // competitive-track cards only
    totals.total++;
    if (c.active) totals.active++;
    if (d.premium) totals.premium++;
    const type = d.type || "mcq"; byType[type] = (byType[type] || 0) + 1;
    const diff = c.difficulty || "medium"; byDifficulty[diff] = (byDifficulty[diff] || 0) + 1;

    const kinds = new Set([mediaKind(d.media), mediaKind(d.micro?.media), mediaKind(d.explain?.media), mediaKind(d.mnemonic?.media), (d.image || d.imageUrl) ? "image" : null].filter(Boolean));
    const hasImage = kinds.has("image"), hasVideo = kinds.has("video"), hasEmbed = kinds.has("embed");
    const hasMedia = hasImage || hasVideo || hasEmbed;
    const hasMicro = !!(d.micro && (d.micro.lead_fa || d.micro.golden_fa || d.micro.lead_en || d.micro.golden_en));
    const hasExplain = !!(d.explain && (d.explain.text_fa || d.explain.text_en || d.explain.media));
    const hasMnemonic = !!(d.mnemonic && (d.mnemonic.scene_fa || d.mnemonic.image || d.mnemonic.media || (d.mnemonic.hooks_fa || []).length));
    const hasHints = !!((d.hints_fa && d.hints_fa.length) || (d.hints_en && d.hints_en.length));
    if (hasMedia) totals.withMedia++; if (hasImage) totals.withImage++; if (hasVideo) totals.withVideo++; if (hasEmbed) totals.withEmbed++;
    if (hasMicro) totals.withMicro++; if (hasExplain) totals.withExplain++; if (hasMnemonic) totals.withMnemonic++; if (hasHints) totals.withHints++;
    const used = usedCards.has(c.id);
    if (used) totals.usedInPath++; else totals.orphan++;

    const slug = d.topic || [...(nodeTopic[c.id] || [])][0] || "";
    const tp = topicBySlug[slug];
    const section = tp ? tp.parent : "other";
    const bump = (bag, key) => {
      const b = (bag[key] ||= { total: 0, withMedia: 0, withMicro: 0, withExplain: 0, premium: 0, active: 0 });
      b.total++; if (hasMedia) b.withMedia++; if (hasMicro) b.withMicro++; if (hasExplain) b.withExplain++;
      if (d.premium) b.premium++; if (c.active) b.active++;
    };
    if (slug) bump(bySubject, slug);
    bump(bySection, section || "other");
  }

  const subjectRows = Object.entries(bySubject).map(([slug, b]) => {
    const tp = topicBySlug[slug];
    return {
      slug, name: tp ? (lang === "fa" ? tp.name_fa : tp.name_en) : slug,
      section: tp ? tp.parent : "other", ...b,
      mediaPct: b.total ? Math.round((b.withMedia / b.total) * 100) : 0,
      microPct: b.total ? Math.round((b.withMicro / b.total) * 100) : 0,
    };
  }).sort((a, b) => b.total - a.total);

  // media library rollup (files on disk + total size)
  let libFiles = 0, libSize = 0, libImages = 0, libVideos = 0;
  try {
    const fs = await import("fs");
    const { UPLOADS_DIR: UPLOAD_DIR } = await import("../lib/paths.js");
    for (const f of fs.readdirSync(UPLOAD_DIR)) {
      if (f.startsWith(".")) continue;
      const st = fs.statSync(path.join(UPLOAD_DIR, f)); if (!st.isFile()) continue;
      libFiles++; libSize += st.size;
      const ext = path.extname(f).toLowerCase();
      if ([".mp4", ".webm", ".mov", ".m4v", ".ogg", ".ogv"].includes(ext)) libVideos++; else libImages++;
    }
  } catch { /* uploads dir may be empty */ }

  const pct = (n) => (totals.total ? Math.round((n / totals.total) * 100) : 0);
  res.json({
    totals: {
      ...totals,
      mediaPct: pct(totals.withMedia), microPct: pct(totals.withMicro),
      explainPct: pct(totals.withExplain), usedPct: pct(totals.usedInPath),
    },
    byType, byDifficulty,
    subjects: subjectRows,
    sections: Object.entries(bySection).map(([k, b]) => ({ section: k, ...b })),
    // content gaps: subjects with the lowest media coverage (min 1 card)
    gaps: subjectRows.filter((s) => s.total >= 1).sort((a, b) => a.mediaPct - b.mediaPct).slice(0, 6),
    library: { files: libFiles, sizeBytes: libSize, images: libImages, videos: libVideos },
  });
});

// The admin table parses every card's JSON, walks every path node and rebuilds
// the whole facet index on each request — cheap with the seed bank, but it grows
// linearly and the bank is now in the hundreds. The result is memoised behind a
// signature drawn from the two tables it reads, so a write anywhere (create,
// edit, import, activate, or a lesson re-linking its cards) invalidates it while
// a plain re-sort or re-filter reuses the parsed rows.
let adminCardsCache = { sig: null, lang: null, built: null };

r.get("/learn-cards", ...P("learn.content"), (req, res) => {
  const lang = L(req);
  const sigRow = db.prepare(
    `SELECT COUNT(*) AS n, COALESCE(MAX(id), 0) AS m,
            COALESCE(MAX(COALESCE(content_updated_at, updated_at)), '') AS t,
            COALESCE(SUM(revision), 0) AS r, COALESCE(SUM(active), 0) AS a
       FROM flashcards`
  ).get();
  const nodeSig = db.prepare(
    "SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(card_ids)), 0) AS L FROM path_nodes"
  ).get();
  const sig = `${sigRow.n}|${sigRow.m}|${sigRow.t}|${sigRow.r}|${sigRow.a}|${nodeSig.n}|${nodeSig.L}`;

  if (adminCardsCache.sig === sig && adminCardsCache.lang === lang) {
    return respondLearnCards(req, res, adminCardsCache.built);
  }

  const rows = db.prepare(
    `SELECT f.id, f.data_json, f.difficulty, f.active, f.updated_at,
            f.created_at, f.content_updated_at, f.revision, f.last_action,
            COALESCE(u.name_fa, u.name_en, u.username) AS last_editor_name
       FROM flashcards f
       LEFT JOIN users u ON u.id = f.last_editor_id
      ORDER BY f.id DESC`
  ).all();
  const nodeUse = {}; // cardId -> [lesson titles]
  const nodeTopic = {}; // cardId -> Set(topic slug)
  const nodes = db.prepare("SELECT id, title_fa, title_en, card_ids, topic_id FROM path_nodes").all();
  const topicById = {};
  for (const t of db.prepare("SELECT id, slug, name_fa, name_en, parent, program FROM topics").all()) topicById[t.id] = t;
  for (const n of nodes) {
    let ids = []; try { ids = JSON.parse(n.card_ids || "[]"); } catch { /* */ }
    for (const cid of ids) {
      (nodeUse[cid] ||= []).push(lang === "fa" ? n.title_fa : n.title_en);
      const tp = topicById[n.topic_id];
      if (tp) (nodeTopic[cid] ||= new Set()).add(tp.slug);
    }
  }
  // resolve a subject/topic display name from a slug (data.topic OR node topic)
  const topicBySlug = {};
  for (const id in topicById) { const t = topicById[id]; topicBySlug[t.slug] = t; }
  const mediaKind = (m) => {
    if (!m) return null;
    if (typeof m === "string") return m ? "image" : null;
    return m.kind || (m.url ? "image" : null);
  };

  const cards = rows.map((c) => {
    let d = {}; try { d = JSON.parse(c.data_json); } catch { /* */ }
    const hasMicro = !!(d.micro && (d.micro.lead_fa || d.micro.golden_fa || d.micro.lead_en || d.micro.golden_en));
    const hasHints = !!((d.hints_fa && d.hints_fa.length) || (d.hints_en && d.hints_en.length));
    const hasExplain = !!(d.explain && (d.explain.text_fa || d.explain.text_en || d.explain.media));
    const hasMnemonic = !!(d.mnemonic && (d.mnemonic.scene_fa || d.mnemonic.image || d.mnemonic.media || (d.mnemonic.hooks_fa || []).length));
    // collect every media descriptor attached anywhere on the card
    const mediaSet = new Set([
      mediaKind(d.media), mediaKind(d.micro?.media), mediaKind(d.explain?.media), mediaKind(d.mnemonic?.media),
      (d.image || d.imageUrl) ? "image" : null,
    ].filter(Boolean));
    const hasImage = mediaSet.has("image");
    const hasVideo = mediaSet.has("video");
    const hasEmbed = mediaSet.has("embed");
    // subject: prefer the card's own topic slug, else the topic of a lesson it's used in
    const slug = d.topic || [...(nodeTopic[c.id] || [])][0] || "";
    const tp = topicBySlug[slug];
    return {
      id: c.id, active: c.active, type: d.type || "mcq", difficulty: c.difficulty || "medium",
      track: d.track || "uni", premium: !!d.premium, category: d.category || "",
      q: (lang === "fa" ? (d.q_fa || d.title_fa) : (d.q_en || d.title_en)) || `#${c.id}`,
      usedIn: nodeUse[c.id] || [],
      // --- rich attributes for comprehensive filtering ---
      subjectSlug: slug,
      subject: tp ? (lang === "fa" ? tp.name_fa : tp.name_en) : (slug || ""),
      section: tp ? tp.parent : "",
      program: tp ? tp.program : "",
      updatedAt: c.updated_at || "",
      // modification tracking: three distinct moments + who touched it last
      createdAt: c.created_at || "",
      contentUpdatedAt: c.content_updated_at || c.updated_at || "",
      revision: c.revision || 1,
      lastAction: c.last_action || "created",
      lastEditor: c.last_editor_name || "",
      hasMicro, hasHints, hasExplain, hasMnemonic, hasImage, hasVideo, hasEmbed,
      hasMedia: hasImage || hasVideo || hasEmbed,
      // full exam provenance (subject/chapter/concept/year/sitting/style/origin)
      facets: cardFacets(d, { ...c, created_at: c.created_at, updated_at: c.content_updated_at || c.updated_at }),
      // normalised search text (stem fa+en, options, chapter, category, editor)
      // for the server-side `?q=` — built once per cache generation.
      hay: normalizeText(`${d.q_fa || ""} ${d.q_en || ""} ${d.title_fa || ""} ${d.title_en || ""} #${c.id}`),
      extra: normalizeText(`${(d.options || []).map((o) => `${o?.fa || ""} ${o?.en || ""}`).join(" ")} ${d.category || ""} ${d.source_meta?.chapter_fa || ""} ${d.source_meta?.chapter_en || ""} ${d.source_meta?.concept_fa || ""} ${d.explain?.text_fa || ""} ${d.explain?.text_en || ""} ${c.last_editor_name || ""}`),
      // NOTE: the full card body (`data`) is NOT sent in the list by default.
      // With 11 600 cards it made this response 87 MB (4.3 MB brotli) and froze
      // the admin tab for ~10 s on every open; the editor fetches ONE card
      // lazily from GET /admin/learn-cards/:id. `?full=1` opts back in.
      data: d,
    };
  }).filter((c) => c.track === "learn");
  // distinct subjects/categories present, to power the filter dropdowns
  const subjects = [...new Map(cards.filter((c) => c.subjectSlug).map((c) => [c.subjectSlug, { slug: c.subjectSlug, name: c.subject }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "fa"));
  const categories = [...new Set(cards.map((c) => c.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fa"));

  // Exam-provenance facets (subject → chapter → concept, year, sitting, style,
  // origin…) with counts, so the filter UI can show "۱۴۰۴ (۱۲)" and hide any
  // option that would return nothing.
  const facets = buildFacetIndex(cards, lang);

  adminCardsCache = { sig, lang, built: { cards, subjects, categories, facets } };
  return respondLearnCards(req, res, adminCardsCache.built);
});

// Narrowing and sorting run on the memoised rows, so they stay cheap even when
// the parse above is skipped. The contract matches /learn/browse: OR inside a
// facet (?year=۱۴۰۳&year=۱۴۰۴), AND across facets.
function respondLearnCards(req, res, built) {
  const { cards, subjects, categories, facets } = built;
  const asList = (v) => (v == null ? null : Array.isArray(v) ? v : String(v).split(",").filter(Boolean));
  const q = req.query || {};
  const filt = {
    subject: asList(q.subject_fa), chapter: asList(q.chapter), concept: asList(q.concept),
    year: asList(q.year), month: asList(q.month), sitting: asList(q.sitting),
    scope: asList(q.scope), style: asList(q.style), origin: asList(q.origin),
    difficulty: asList(q.difficulty), exam: asList(q.exam),
    yearFrom: q.yearFrom, yearTo: q.yearTo,
    updatedFrom: q.updatedFrom, updatedTo: q.updatedTo,
    createdFrom: q.createdFrom, createdTo: q.createdTo,
  };
  const anyFilter = Object.values(filt).some((v) => v != null && v !== "" && !(Array.isArray(v) && !v.length));
  let out = anyFilter ? cards.filter((c) => matchFacets(c.facets, filt)) : cards;
  // Server-side text search (same grammar/normalisation as the learner bank:
  // AND terms, "phrase", -exclude, سال:1399, #id). Relevance order unless an
  // explicit sort is requested.
  const term = String(q.q || "").trim().slice(0, 200);
  let pq = null;
  if (term) { const r = searchPool(out, term); out = r.hits; pq = r.pq.empty ? null : r.pq; }
  if (q.sort && q.sort !== "relevance") out = sortCards(out, String(q.sort));
  else if (!pq && !q.sort) out = sortCards(out, "id_desc");
  const matched = out.length;
  // Optional pagination (?page=&per=) so the admin table can stream 11 600
  // rows 50 at a time instead of parsing a 1 MB JSON on every open.
  const per = Math.min(500, Math.max(0, parseInt(q.per, 10) || 0));
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  if (per > 0) out = out.slice((page - 1) * per, page * per);
  const full = /^(1|true|yes)$/i.test(String(q.full || ""));
  out = out.map(({ data, hay, extra, ...light }) => {
    const row = full ? { ...light, data } : light;
    if (pq) row.hl = highlightRanges(light.q, pq);
    return row;
  });

  res.json({ cards: out, total: cards.length, matched, page, per, subjects, categories, facets,
    query: pq ? { terms: pq.terms, phrases: pq.phrases, excludes: pq.excludes, fields: pq.fields, id: pq.id } : null });
}

// helper: build a card data_json from a flexible payload
function buildLearnCard(b) {
  const data = {
    type: b.type || "mcq", track: "learn",
    premium: !!b.premium, category: b.category || "",
    q_fa: b.q_fa || "", q_en: b.q_en || b.q_fa || "",
    title_fa: b.q_fa || "", title_en: b.q_en || b.q_fa || "",
    hints_fa: Array.isArray(b.hints_fa) ? b.hints_fa : [],
    hints_en: Array.isArray(b.hints_en) ? b.hints_en : [],
  };
  const type = b.type || "mcq";
  if (type === "mcq") {
    // Keep the per-option rationale (why_fa/why_en) authored in the admin form
    // and sent by the past-exam importer; cardserialize already exposes it to
    // the learner as the UWorld-style "why this option is right/wrong" note.
    data.options = (b.options || []).map((o) => ({
      fa: o.fa || "", en: o.en || o.fa || "", correct: !!o.correct,
      ...(o.why_fa ? { why_fa: o.why_fa } : {}),
      ...(o.why_en ? { why_en: o.why_en } : {}),
    }));
    // answer mode: "choice" (default) or "search" (autocomplete). optional subject for the catalog.
    if (b.answerMode === "search") { data.answerMode = "search"; if (b.subject) data.subject = b.subject; }
  } else if (type === "truefalse") {
    data.answer = !!b.answer;
  } else if (type === "fill") {
    data.accept_fa = Array.isArray(b.accept_fa) ? b.accept_fa : (b.accept_fa ? [b.accept_fa] : []);
    data.accept_en = Array.isArray(b.accept_en) ? b.accept_en : (b.accept_en ? [b.accept_en] : []);
    data.blank_fa = b.blank_fa || ""; data.blank_en = b.blank_en || "";
  } else if (type === "match") {
    // pairs: [ [left_fa,left_en,right_fa,right_en], ... ]
    data.pairs = Array.isArray(b.pairs) ? b.pairs : [];
  } else if (type === "order") {
    data.items_fa = Array.isArray(b.items_fa) ? b.items_fa : [];
    data.items_en = Array.isArray(b.items_en) ? b.items_en : [];
  } else if (type === "compare") {
    // clinical compare & contrast: preserve entities + belongs-tagged features
    data.entityA_fa = b.entityA_fa || ""; data.entityA_en = b.entityA_en || b.entityA_fa || "";
    data.entityB_fa = b.entityB_fa || ""; data.entityB_en = b.entityB_en || b.entityB_fa || "";
    data.features = Array.isArray(b.features) ? b.features.map((f) => ({ fa: f.fa || "", en: f.en || f.fa || "", belongs: ["A", "B", "both"].includes(f.belongs) ? f.belongs : "A" })) : [];
  }
  // preserve the subject/topic slug across an import round-trip
  if (b.topic) data.topic = b.topic;
  if (b.micro) data.micro = b.micro;
  if (b.mnemonic) data.mnemonic = b.mnemonic;
  // پاسخنامه (answer explanation) block: text + optional media
  if (b.explain) data.explain = b.explain;
  // rich question media (image / uploaded video / Aparat|YouTube embed) + the
  // legacy plain-image field kept in sync for older renderers.
  if (b.media) data.media = b.media;
  if (b.image != null) data.image = b.image;
  // provenance for imported past-exam questions (exam type, year, pole, source
  // and the dedupe fingerprint). Preserved so the official importer can route
  // the card and so the admin UI can show where a question came from.
  if (b.source_meta) data.source_meta = b.source_meta;
  if (b.difficulty) data.difficulty = b.difficulty;
  return data;
}
r.post("/learn-cards", ...P("learn.content"), (req, res) => {
  const data = buildLearnCard(req.body || {});
  const info = db.prepare(
    `INSERT INTO flashcards (difficulty, data_json, active, created_at, content_updated_at, revision, last_action)
     VALUES (?,?,1,datetime('now'),datetime('now'),0,'created')`
  ).run(req.body?.difficulty || "medium", JSON.stringify(data));
  // SQLite reuses row ids after deletes, so a brand-new card can inherit the
  // change log of a long-deleted one. Clear any stale history for this id.
  db.prepare("DELETE FROM card_revisions WHERE card_id=?").run(info.lastInsertRowid);
  recordCardChange({ cardId: info.lastInsertRowid, action: "created", after: data, actor: req.user });
  audit(req, "learn.card_create", `flashcards:${info.lastInsertRowid}`, { premium: data.premium });
  persistNow();
  res.json({ id: info.lastInsertRowid });
});
// bulk create many cards at once: body { cards: [ {...}, ... ] }
r.post("/learn-cards/bulk", ...P("learn.content"), (req, res) => {
  const list = Array.isArray(req.body?.cards) ? req.body.cards : [];
  let created = 0;
  const tx = db.transaction(() => {
    for (const b of list) {
      if (!(b.q_fa || b.q_en)) continue;
      const data = buildLearnCard(b);
      db.prepare("INSERT INTO flashcards (difficulty, data_json, active) VALUES (?,?,1)").run(b.difficulty || "medium", JSON.stringify(data));
      created++;
    }
  });
  tx();
  audit(req, "learn.card_bulk", "flashcards", { created });
  persistNow();
  res.json({ created, total: list.length });
});
// Bulk action on many cards at once (from the filtered content list):
// body { ids: [..], action: "activate"|"deactivate"|"premium"|"free"|"delete" }
r.post("/learn-cards/bulk-action", ...P("learn.content"), (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  const action = String(req.body?.action || "");
  const allowed = new Set(["activate", "deactivate", "premium", "free", "delete"]);
  if (!ids.length || !allowed.has(action)) return res.status(400).json({ error: "bad request" });
  // deleting is destructive → require the stronger content permission holder to
  // be an admin (guard via role, consistent with single delete which anyone with
  // learn.content can do; we keep parity but audit clearly).
  let affected = 0;
  const tx = db.transaction(() => {
    for (const id of ids) {
      const c = db.prepare("SELECT id, data_json, active FROM flashcards WHERE id=?").get(id);
      if (!c) continue;
      if (!isLearnContent(c.data_json)) continue;
      if (action === "delete") {
        tombstoneCard(c);
        db.prepare("DELETE FROM flashcards WHERE id=?").run(id);
        // also detach from any lesson node so we never leave a dangling id
        for (const n of db.prepare("SELECT id, card_ids FROM path_nodes").all()) {
          let arr = []; try { arr = JSON.parse(n.card_ids || "[]"); } catch { arr = []; }
          if (arr.includes(id)) db.prepare("UPDATE path_nodes SET card_ids=? WHERE id=?").run(JSON.stringify(arr.filter((x) => x !== id)), n.id);
        }
        affected++; continue;
      }
      if (action === "activate" || action === "deactivate") {
        db.prepare("UPDATE flashcards SET active=? WHERE id=?").run(action === "activate" ? 1 : 0, id);
        affected++; continue;
      }
      // premium / free → toggle the flag inside data_json
      let d = {}; try { d = JSON.parse(c.data_json); } catch { d = {}; }
      d.premium = action === "premium";
      db.prepare("UPDATE flashcards SET data_json=? WHERE id=?").run(JSON.stringify(d), id);
      affected++;
    }
  });
  tx();
  audit(req, "learn.card_bulk_action", "flashcards", { action, count: affected });
  persistNow();
  res.json({ ok: true, action, affected });
});

// Export cards as a JSON bundle (media-faithful — keeps the full data_json incl.
// image/video/embed media, درسنامه, پاسخنامه & mnemonic). Optional ?ids=1,2,3 to
// export only a selection (e.g. the current filtered view). AI-free.
r.get("/learn-cards/export", ...P("learn.content"), (req, res) => {
  const only = String(req.query.ids || "").split(",").map((x) => parseInt(x, 10)).filter(Boolean);
  const idSet = only.length ? new Set(only) : null;
  // map each card to the topic slug(s) of the lesson(s) it's used in (so the
  // subject survives a round-trip even if data.topic wasn't set).
  const nodeTopic = {};
  const topicById = {};
  for (const t of db.prepare("SELECT id, slug FROM topics").all()) topicById[t.id] = t.slug;
  for (const n of db.prepare("SELECT card_ids, topic_id FROM path_nodes").all()) {
    let ids = []; try { ids = JSON.parse(n.card_ids || "[]"); } catch { ids = []; }
    for (const cid of ids) if (topicById[n.topic_id]) (nodeTopic[cid] ||= topicById[n.topic_id]);
  }
  const rows = db.prepare("SELECT id, data_json, difficulty, active FROM flashcards ORDER BY id").all();
  const cards = [];
  for (const c of rows) {
    if (idSet && !idSet.has(c.id)) continue;
    let d = {}; try { d = JSON.parse(c.data_json); } catch { d = {}; }
    if ((d.track || "uni") !== "learn") continue;
    if (!d.topic && nodeTopic[c.id]) d.topic = nodeTopic[c.id];   // backfill subject
    cards.push({ id: c.id, difficulty: c.difficulty, active: c.active, data: d });
  }
  const bundle = {
    format: "med-school/cards", version: 1,
    exported_at: new Date().toISOString(),
    count: cards.length, cards,
  };
  audit(req, "learn.card_export", "flashcards", { count: cards.length, filtered: !!idSet });
  const fname = `med-school-cards-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(JSON.stringify(bundle, null, 2));
});

// Preview a JSON bundle before importing: validate shape + count what will import.
r.post("/learn-cards/import-bundle/preview", ...P("learn.content"), (req, res) => {
  const b = req.body?.bundle;
  if (!b || b.format !== "med-school/cards" || !Array.isArray(b.cards)) {
    return res.status(400).json({ error: "invalid bundle" });
  }
  const byType = {}; const byTopic = {}; let withMedia = 0; let valid = 0; const errors = [];
  b.cards.forEach((c, i) => {
    const d = c && c.data;
    if (!d || !(d.q_fa || d.q_en || d.title_fa)) { errors.push(`#${i + 1}: بدون متن سؤال`); return; }
    valid++;
    byType[d.type || "mcq"] = (byType[d.type || "mcq"] || 0) + 1;
    if (d.topic) byTopic[d.topic] = (byTopic[d.topic] || 0) + 1;
    if (d.media || d.image || d.micro?.media || d.explain?.media || d.mnemonic?.media) withMedia++;
  });
  res.json({ total: b.cards.length, valid, withMedia, byType, byTopic, errors: errors.slice(0, 50) });
});

// Commit a JSON bundle import. Creates NEW cards (keeps media) and optionally
// attaches them to their subject's path (chunked lessons of 5), like CSV import.
r.post("/learn-cards/import-bundle", ...P("learn.content"), (req, res) => {
  const b = req.body?.bundle;
  const attachToPath = req.body?.attachToPath === true;   // default off (safer)
  if (!b || b.format !== "med-school/cards" || !Array.isArray(b.cards)) {
    return res.status(400).json({ error: "invalid bundle" });
  }
  const topics = Object.fromEntries(db.prepare("SELECT id, slug FROM topics").all().map((t) => [t.slug, t.id]));
  const insCard = db.prepare("INSERT INTO flashcards (version, difficulty, data_json, active) VALUES (1,?,?,?)");
  let imported = 0; const errors = []; const perTopic = {};
  const tx = db.transaction(() => {
    b.cards.forEach((c, i) => {
      const d = c && c.data;
      if (!d || !(d.q_fa || d.q_en || d.title_fa)) { errors.push(`#${i + 1}: بدون متن سؤال`); return; }
      // rebuild via the same sanitizer used by the editor so nothing dangerous
      // slips in, but preserve media/explain/micro/mnemonic exactly.
      const rebuilt = buildLearnCard({
        ...d, track: "learn",
        media: d.media, image: d.image, explain: d.explain, micro: d.micro, mnemonic: d.mnemonic,
      });
      const active = c.active === 0 ? 0 : 1;
      const info = insCard.run(d.difficulty || c.difficulty || "medium", JSON.stringify(rebuilt), active);
      imported++;
      if (d.topic && topics[d.topic]) (perTopic[d.topic] ||= []).push(info.lastInsertRowid);
    });
    if (attachToPath) {
      for (const [slug, cardIds] of Object.entries(perTopic)) {
        const topicId = topics[slug];
        const ord = (db.prepare("SELECT COALESCE(MAX(ord),-1)+1 AS n FROM path_nodes WHERE topic_id=?").get(topicId).n) || 0;
        for (let c = 0; c < cardIds.length; c += 5) {
          const chunk = cardIds.slice(c, c + 5);
          db.prepare("INSERT INTO path_nodes (topic_id,title_fa,title_en,ord,kind,card_ids,xp_reward,active) VALUES (?,?,?,?,?,?,?,1)")
            .run(topicId, `درس واردشده ${ord + 1}`, `Imported lesson ${ord + 1}`, ord + Math.floor(c / 5), "lesson", JSON.stringify(chunk), 20);
        }
      }
    }
  });
  tx();
  audit(req, "learn.card_import_bundle", "flashcards", { imported, attachToPath });
  persistNow();
  res.json({ imported, errors: errors.slice(0, 50) });
});


/* ---- Official/past-exam question import pipeline (legal-content ready).
   This endpoint does NOT scrape PDFs. It accepts explicit JSON content that the
   admin confirms is allowed to use. It then deduplicates, splits high-value
   questions into the competitive path, and routes repeats/overflow to premium. */
const normalizeOfficialText = (x) => String(x || "")
  .replace(/[ي]/g, "ی").replace(/[ك]/g, "ک")
  .replace(/[٠-٩۰-۹0-9]+/g, "#")
  .replace(/[\u064B-\u065F\u200c]/g, "")
  .toLowerCase().replace(/[^\p{L}\p{N}#]+/gu, " ").replace(/\s+/g, " ").trim();
function officialFingerprint(q) {
  return normalizeOfficialText([q.subject_fa, q.subject_en, q.chapter_fa, q.chapter_en, q.question_fa, q.question_en].filter(Boolean).join(" ")).slice(0, 260);
}
function officialExistingFingerprints() {
  // Include inactive rows. An admin deactivate must not look like "missing"
  // and get a duplicate insert on the next bank import / restart.
  const set = new Set();
  for (const row of db.prepare("SELECT data_json FROM flashcards").all()) {
    try { const d = JSON.parse(row.data_json); if (d.source_meta?.fingerprint) set.add(d.source_meta.fingerprint); }
    catch { /* ignore */ }
  }
  return set;
}
/* Compiling a parameterised prepared statement on every one of 11k+ questions
 * is seconds-per-file on sql.js. Load the card tombstone keys once per import
 * pass and test membership in memory. */
function cardTombstoneSet() {
  const set = new Set();
  for (const row of db.prepare("SELECT key FROM admin_deleted WHERE kind='card'").all()) set.add(row.key);
  return set;
}
/* Scanning and JSON-parsing every flashcard row ONCE per payload part
 * (54 parts × 11.6k cards) dominated boot time (~100 s). Keep one snapshot
 * for the lifetime of the process and fold each freshly inserted fingerprint
 * into it, so later parts skip in-memory while staying correct. The cache
 * only ever grows inside this import pipeline, which is its only writer. */
let officialExistingCache = null;
function existingFingerprintSet() {
  if (!officialExistingCache) officialExistingCache = officialExistingFingerprints();
  return officialExistingCache;
}
export function resetOfficialImportCaches() {
  officialExistingCache = null;
}
function officialSlug(s) { return String(s || "official").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "official"; }

/* One canonical exam-type vocabulary. Shipped banks used both "preinternship"
 * (English) and "پره‌انترنی" (Persian) for the SAME sitting, which split the
 * learner's "exam" filter into two buckets. Residency strings stay separate. */
export function canonicalExamType(v) {
  const fa = String(v || "").replace(/[\u200c\u200f\u200e]/g, "");
  const s = fa.trim().toLowerCase();
  if (!s) return "";
  if (s.includes("resid") || fa.includes("دستیار") || fa.includes("رزیدنت")) return "دستیاری";
  if (s.startsWith("pre") || fa.includes("انترن") || fa.includes("کارورز")) return "پره‌انترنی";
  return String(v).trim();
}

/* Internal medicine is not ONE node in this course: it is seven seeded
 * sub-topics (GI, pulmonary, nephrology, haematology/oncology, endocrinology,
 * rheumatology, cardiology). Past-exam booklets tag every question with a
 * finer `chapter_fa` such as "خون / ITP" or "ریه / آسم"; route each internal
 * medicine question to the sub-topic its chapter belongs to, so the curated
 * path covers the real internal curriculum instead of a parallel umbrella
 * topic that learners never browse. Keyed by the chapter SECTION prefix
 * (the part before " / "), with a few full-chapter aliases. */
const INTERNAL_CHAPTER_SLUG = [
  ["gi", /^(گوارش|هپات|کبد|واریس|اسهال|هلیکوباکتر|صفرا|IBS|PSC|کرون|درد اپی‌گاستر|پپتیک)/],
  ["pulmo", /^(ریه|پنوم|آسم|COPD|پلور|اکسیژن|هموپتزی|سرفه|ILD|PAP|GOLD|منحنی اکسیژن|هیدروتوراکس)/],
  ["nephro", /^(کلیه|نفر|هماچوری|ادرار|دیالیز|میلوم|باکتریوری|پروتئینوری)/],
  ["heme", /^(خون|همات|آنمی|کم‌خونی|لوسمی|لنفوم|انعقاد|VTE|تالاسمی|فولیک|آهن|انتقال خون|CML|APL|ITP|TTP|MCV)/],
  ["endo", /^(غدد|تیروئید|آدرنال|دیابت|کوشینگ|هیپرکلسمی|هیپوکلسمی|میکسدم|گریوز|SGLT2|ندول|قند|متابولیک)/],
  ["rheum", /^(رومات|لوپوس|آرتریت|اسکلرودرمی|اسپوندیل|نقرس|APS|کپسولیت|پوکی استخوان|استخوان|شانه|ستون فقرات)/],
  ["cardio", /^(قلب|فشار|شوک|میترال|تامپوناد|STEMI|SVT|BNP|فیبریل|کاردیو|روماتیسم قلبی|احیاء|احیا)/],
];
export function internalChapterSlug(chapter_fa, chapter_en) {
  const section = String(chapter_fa || "").split("/")[0].replace(/\s+/g, " ").trim();
  for (const [slug, re] of INTERNAL_CHAPTER_SLUG) if (re.test(section)) return slug;
  const en = String(chapter_en || "").toLowerCase();
  const enMap = [
    ["gi", /^(gi|gastro|liver|hepat|esophag|peptic|diarrh|ibs|varic|biliary|gallbladder)/],
    ["pulmo", /^(pulm|lung|pneum|asthma|copd|pleur|oxygen|hemopt|cough|ild)/],
    ["nephro", /^(nephr|renal|kidney|hematur|proteinur|dialysis|myeloma)/],
    ["heme", /^(hemat|hemato|anaem|anemi|leuk|lymphom|coagul|vte|thalass|iron|transfusion|cml|apl|itp|ttp)/],
    ["endo", /^(endocr|thyroid|adrenal|diabet|cushing|calcem|myxedema|graves|nodule|metabolic)/],
    ["rheum", /^(rheum|lupus|arthrit|scleroderm|spondyl|gout|aps|capsul|osteoporosis|bone|shoulder|spine)/],
    ["cardio", /^(cardio|cardiac|heart|hypertens|shock|mitral|tamponade|stemi|svt|bnp|fibrill|resuscit|cp r)/],
  ];
  const sectionEn = en.split("/")[0].trim();
  for (const [slug, re] of enMap) if (re.test(sectionEn)) return slug;
  return null;
}

/* Internal medicine umbrella for questions whose chapter cannot be placed in
 * any of the seven sub-topics. Lazily fetched (and, for fresh installs,
 * created) under the "internal" section like its siblings. */
function internalUmbrellaTopic(program, dryRun) {
  let row = db.prepare("SELECT * FROM topics WHERE slug='internal' AND program=?").get(program);
  if (row) return topicRowDead(row) ? { ...row, tombstoned: true, id: null } : row;
  if (dryRun) return { id: "dry-topic:internal", slug: "internal", parent: "internal", name_fa: "داخلی (سایر مباحث)", name_en: "Internal Medicine (other)" };
  const maxOrd = db.prepare("SELECT COALESCE(MAX(ord),0) m FROM topics WHERE program=?").get(program).m || 0;
  const info = db.prepare("INSERT INTO topics (slug,name_fa,name_en,parent,budget,color,icon,ord,active,program) VALUES (?,?,?,?,?,?,?,?,1,?)")
    .run("internal", "داخلی (سایر مباحث)", "Internal Medicine (other)", "internal", 0, "#2569b0", "book", maxOrd + 1, program);
  return db.prepare("SELECT * FROM topics WHERE id=?").get(info.lastInsertRowid);
}
// The pre-internship exam splits its subjects into two tracks. The four majors
// (internal medicine, surgery, paediatrics, obstetrics) carry far more questions and
// marks than the minors, which include neurology, psychiatry, ENT, ophthalmology and
// the rest. An importer may state the track per question via `subject_track`; when it
// does not, fall back to the known major list instead of assuming "major".
const OFFICIAL_MAJOR_SUBJECTS = new Set([
  "internal medicine", "surgery", "pediatrics", "paediatrics",
  "obstetrics", "obstetrics and gynecology", "gynecology",
  "داخلی", "جراحی", "کودکان", "زنان", "زنان و زایمان",
]);
function officialTrack({ subject_fa, subject_en, subject_track }) {
  if (subject_track === "major" || subject_track === "minor") return subject_track;
  const fa = String(subject_fa || "").trim().toLowerCase();
  const en = String(subject_en || "").trim().toLowerCase();
  return (OFFICIAL_MAJOR_SUBJECTS.has(fa) || OFFICIAL_MAJOR_SUBJECTS.has(en)) ? "major" : "minor";
}
/* Map an imported subject onto the topic a learner actually browses.
 *
 * The importer used to always mint a NEW topic called `official-<subject>`.
 * That looked fine in the admin table — the cards were there and countable —
 * but the learning path is built from the seeded topics (`neuro`, `infect`,
 * …), so every imported question landed in a parallel topic the learner never
 * sees. The result was an admin panel full of questions and an empty path.
 *
 * So: prefer an existing topic whose name matches the subject, and only create
 * an `official-…` topic when the subject is genuinely new to this install.
 */
const TOPIC_ALIASES = {
  "نورولوژی": ["neuro"], "مغز و اعصاب": ["neuro"], "Neurology": ["neuro"],
  "بیماری‌های عفونی": ["infect"], "عفونی": ["infect"], "Infectious Diseases": ["infect"],
  "داخلی": ["internal"], "جراحی": ["surgery"], "کودکان": ["peds"],
  "زنان و زایمان": ["obgyn"], "روان‌پزشکی": ["psych"], "روانپزشکی": ["psych"],
  "قلب": ["cardio"], "پوست": ["derm"], "پاتولوژی": ["path"],
  "رادیولوژی": ["radio"], "فارماکولوژی": ["pharm"],
  "گوش و حلق و بینی": ["ent"], "ارتوپدی": ["ortho"], "اورولوژی": ["uro"],
  "چشم‌پزشکی": ["ophth"], "آمار و اپیدمیولوژی": ["stats"], "اپیدمیولوژی و آمار": ["stats"],
  "اخلاق پزشکی": ["ethics"], "ژنتیک": ["genetics"], "ژنتیک پزشکی": ["genetics"],
  "ایمونولوژی": ["immuno"], "تغذیه": ["nutrition"], "فیزیک پزشکی": ["physics"],
};

/* Persian is written with an optional zero-width non-joiner, so
 * «بیماری‌های عفونی» and «بیماریهای عفونی» are the same words but different
 * strings. Comparing without it (and without the Arabic/Persian letter
 * variants) is what makes the alias table actually hit. */
function topicKey(s) {
  return String(s || "")
    .replace(/[\u200c\u200f\u200e]/g, "")
    .replace(/[يﻯ]/g, "ی").replace(/[كﻙ]/g, "ک")
    .replace(/\s+/g, " ")
    .trim();
}

function matchExistingTopic(program, subject_fa, subject_en) {
  const wanted = [subject_fa, subject_en].filter(Boolean);
  const aliasByKey = {};
  for (const k in TOPIC_ALIASES) aliasByKey[topicKey(k)] = TOPIC_ALIASES[k];

  const slugs = [];
  for (const w of wanted) {
    const hit = aliasByKey[topicKey(w)];
    if (hit) slugs.push(...hit);
  }
  for (const s of slugs) {
    const row = db.prepare("SELECT * FROM topics WHERE slug=? AND program=?").get(s, program);
    if (row) return row;
  }
  // fall back to a display-name match (ZWNJ-insensitive), which covers subjects
  // we have not aliased but that the seed or an earlier import already created
  const all = db.prepare("SELECT * FROM topics WHERE program=?").all(program);
  for (const w of wanted) {
    const k = topicKey(w);
    const row = all.find((t) => topicKey(t.name_fa) === k || topicKey(t.name_en) === k);
    if (row) return row;
  }
  return null;
}

function aliasSlugsFor(subject_fa, subject_en) {
  const wanted = [subject_fa, subject_en].filter(Boolean);
  const slugs = [];
  for (const w of wanted) {
    const hit = TOPIC_ALIASES[topicKey(w)] || TOPIC_ALIASES[w];
    if (hit) slugs.push(...hit);
  }
  return slugs;
}
export function isInternalMedicineSubject(subject_fa, subject_en) {
  const k = topicKey(subject_fa);
  const en = String(subject_en || "").trim().toLowerCase();
  return k === "داخلی" || en === "internal medicine";
}
/* A live topic row is only "dead" when its stable slug was tombstoned. The
 * numeric id must not veto a live row: after an admin deletes a topic SQLite
 * can hand that id to a freshly imported topic, which would then be wrongly
 * treated as deleted. Tombstone deletions always record the slug too. */
function topicRowDead(row) {
  return !!row && !!row.slug && isTombstoned("topic", row.slug);
}
function officialTopic({ program, subject_fa, subject_en, subject_track, chapter_fa, chapter_en }, dryRun = false) {
  // Internal medicine distributes across its seven seeded sub-topics by the
  // chapter prefix; only genuinely unplaceable chapters fall to the umbrella.
  if (isInternalMedicineSubject(subject_fa, subject_en)) {
    const sub = internalChapterSlug(chapter_fa, chapter_en);
    if (sub) {
      const row = db.prepare("SELECT * FROM topics WHERE slug=? AND program=?").get(sub, program);
      if (row) {
        if (topicRowDead(row)) return { ...row, tombstoned: true, id: null };
        if (subject_track && row.parent !== subject_track && !dryRun) {
          db.prepare("UPDATE topics SET parent=? WHERE id=?").run(subject_track, row.id);
          return { ...row, parent: subject_track };
        }
        return row;
      }
    }
    return internalUmbrellaTopic(program, dryRun);
  }
  const existing = matchExistingTopic(program, subject_fa, subject_en);
  if (existing && topicRowDead(existing)) {
    return { ...existing, tombstoned: true, id: null };
  }
  if (existing) {
    // An explicit subject_track in the payload is an instruction, not a hint:
    // it must still win over whatever track the pre-existing topic sits under.
    if (subject_track && existing.parent !== subject_track) {
      if (!dryRun) db.prepare("UPDATE topics SET parent=? WHERE id=?").run(subject_track, existing.id);
      return { ...existing, parent: subject_track };
    }
    return existing;
  }
  // The seeded topic may already be gone. If the admin deleted it, do not mint
  // a parallel official-* subject that would put the same questions back.
  for (const s of aliasSlugsFor(subject_fa, subject_en)) {
    if (topicIsTombstoned(s)) {
      return { id: null, slug: s, parent: officialTrack({ subject_fa, subject_en, subject_track }), tombstoned: true,
        name_fa: subject_fa || "سؤالات رسمی", name_en: subject_en || "Official questions" };
    }
  }
  const slug = `official-${officialSlug(subject_en || subject_fa)}`;
  if (topicIsTombstoned(slug)) {
    return { id: null, slug, parent: officialTrack({ subject_fa, subject_en, subject_track }), tombstoned: true,
      name_fa: subject_fa || "سؤالات رسمی", name_en: subject_en || "Official questions" };
  }
  const row = db.prepare("SELECT * FROM topics WHERE slug=?").get(slug);
  if (row) {
    if (isTombstoned("topic", slug)) return { ...row, tombstoned: true, id: null };
    return row;
  }
  const track = officialTrack({ subject_fa, subject_en, subject_track });
  if (dryRun) return { id: `dry-topic:${slug}`, slug, parent: track, name_fa: subject_fa || "سؤالات رسمی", name_en: subject_en || "Official questions" };
  const maxOrd = db.prepare("SELECT COALESCE(MAX(ord),0) m FROM topics WHERE program=?").get(program).m || 0;
  const info = db.prepare("INSERT INTO topics (slug,name_fa,name_en,parent,budget,color,icon,ord,active,program) VALUES (?,?,?,?,?,?,?,?,1,?)")
    .run(slug, subject_fa || subject_en || "سؤالات رسمی", subject_en || subject_fa || "Official questions", track, 0, "#6d5bd0", "book", maxOrd + 1, program);
  return db.prepare("SELECT * FROM topics WHERE id=?").get(info.lastInsertRowid);
}
function officialNode(topic, q, part, dryRun = false) {
  if (!topic?.id || topic.tombstoned) return null;
  const title_fa = `${q.chapter_fa || topic.name_fa || "درس آزمون"}${part > 1 ? ` - بخش ${part}` : ""}`;
  const title_en = `${q.chapter_en || topic.name_en || "Exam lesson"}${part > 1 ? ` - Part ${part}` : ""}`;
  const found = db.prepare("SELECT * FROM path_nodes WHERE topic_id=? AND (title_fa=? OR title_en=?)").get(topic.id, title_fa, title_en);
  // A live row (even active=0) wins. Do not auto-activate: the admin may have
  // hidden it. Demo-purged empty lessons are revived separately, and only if
  // they were never tombstoned.
  if (found) return found;
  if (nodeIsTombstoned(topic, title_fa, title_en)) return null;
  if (dryRun) return { id: `dry-node:${topic.id}:${part}`, title_fa, title_en, card_ids: "[]" };
  const maxOrd = db.prepare("SELECT COALESCE(MAX(ord),0) m FROM path_nodes WHERE topic_id=?").get(topic.id).m || 0;
  const info = db.prepare("INSERT INTO path_nodes (topic_id,title_fa,title_en,ord,kind,card_ids,xp_reward,active) VALUES (?,?,?,?,?,?,?,1)")
    .run(topic.id, title_fa, title_en, maxOrd + 1, "lesson", "[]", 20);
  return db.prepare("SELECT * FROM path_nodes WHERE id=?").get(info.lastInsertRowid);
}

/* Purging the demo questions empties the lessons that only ever held demo
 * cards, and those lessons are deactivated so the learner is not handed a
 * blank screen. But once real questions arrive for the same topic, a lesson
 * that now HAS cards must come back — otherwise the topic looks empty on the
 * path even though the bank is full. Called at the end of every import.
 * Admin-deleted (tombstoned) lessons stay dead. */
function reviveNodesWithCards() {
  const rows = db.prepare("SELECT id, topic_id, title_fa, title_en, card_ids FROM path_nodes WHERE active=0").all();
  let revived = 0;
  for (const r of rows) {
    const topic = db.prepare("SELECT * FROM topics WHERE id=?").get(r.topic_id);
    if (nodeIsTombstoned(topic, r.title_fa, r.title_en, r.id)) continue;
    let ids = [];
    try { ids = JSON.parse(r.card_ids || "[]"); } catch { ids = []; }
    if (!ids.length) continue;
    // only count cards that still exist and are active
    const live = db.prepare(
      `SELECT COUNT(*) n FROM flashcards WHERE active=1 AND id IN (${ids.map(() => "?").join(",")})`
    ).get(...ids).n;
    if (live > 0) {
      db.prepare("UPDATE path_nodes SET active=1 WHERE id=?").run(r.id);
      revived++;
    }
  }
  return revived;
}
function normalizeOfficialQuestion(q, meta = {}) {
  const faOpts = Array.isArray(q.options_fa) ? q.options_fa : [];
  const enOpts = Array.isArray(q.options_en) ? q.options_en : [];
  const keyless = q.keyless === true || q.correct_index === null ||
    (q.correct_index === undefined && q.key_source === "low-confidence");
  const correctNum = Number(q.correct_index ?? q.correct);
  const correct = Number.isInteger(correctNum) && correctNum >= 0 && correctNum < faOpts.length ? correctNum : (keyless ? -1 : Math.max(0, correctNum || 0));
  const fingerprint = officialFingerprint(q);
  return buildLearnCard({
    track: "learn",
    premium: !!q.premium,
    type: q.type || "mcq",
    answerMode: q.answerMode || "choice",
    difficulty: q.difficulty || "medium",
    title_fa: q.title_fa || q.chapter_fa || q.subject_fa || "سؤال آزمون",
    title_en: q.title_en || q.chapter_en || q.subject_en || "Exam question",
    q_fa: q.question_fa || q.stem_fa || "",
    q_en: q.question_en || q.stem_en || "",
    questionText_fa: q.question_fa || q.stem_fa || "",
    questionText_en: q.question_en || q.stem_en || "",
    category_fa: q.chapter_fa || q.subject_fa || "",
    category_en: q.chapter_en || q.subject_en || "",
    topic: q.topic || meta.topic || "",
    // per-option rationale (UWorld-style "why each option is right/wrong") is
    // carried through the import so past-exam questions arrive with distractor
    // explanations already attached, exactly like admin-authored cards.
    options: faOpts.map((fa, i) => ({
      fa, en: enOpts[i] || fa, correct: correct >= 0 && i === correct,
      why_fa: (Array.isArray(q.options_why_fa) ? q.options_why_fa[i] : "") || "",
      why_en: (Array.isArray(q.options_why_en) ? q.options_why_en[i] : "") || "",
    })),
    hints_fa: Array.isArray(q.hints_fa) ? q.hints_fa : [],
    hints_en: Array.isArray(q.hints_en) ? q.hints_en : [],
    explain: { text_fa: q.explanation_fa || "", text_en: q.explanation_en || "" },
    // QB-style microlearning block ("درسنامه"): a structured mini-lesson shown
    // after answering. Imported past-exam questions can now ship with a full
    // lesson (lead, golden tip, teaching points, source) instead of only a
    // plain explanation paragraph.
    ...(q.micro ? {
      micro: {
        lead_fa: q.micro.lead_fa || "", lead_en: q.micro.lead_en || "",
        golden_fa: q.micro.golden_fa || "", golden_en: q.micro.golden_en || "",
        points_fa: Array.isArray(q.micro.points_fa) ? q.micro.points_fa : [],
        points_en: Array.isArray(q.micro.points_en) ? q.micro.points_en : [],
        options_fa: Array.isArray(q.micro.options_fa) ? q.micro.options_fa : [],
        options_en: Array.isArray(q.micro.options_en) ? q.micro.options_en : [],
        source_fa: q.micro.source_fa || "", source_en: q.micro.source_en || "",
        media: q.micro.media || null,
      },
    } : {}),
    image: q.image || "",
    media: q.media || (q.image ? {
      url: q.image, kind: "image",
      caption_fa: q.image_caption_fa || "",
      caption_en: q.image_caption_en || "",
    } : null),
    source_meta: {
      kind: "past_exam_import",
      ...(keyless ? { keyless: true, key_available: false } : {}),
      exam_type: canonicalExamType(q.exam_type || meta.exam_type || "") || "unknown",
      year: q.year || meta.year || "",
      subject_fa: q.subject_fa || meta.subject_fa || "",
      subject_en: q.subject_en || meta.subject_en || "",
      chapter_fa: q.chapter_fa || meta.chapter_fa || "",
      chapter_en: q.chapter_en || meta.chapter_en || "",
      question_no: q.question_no || "",
      source: q.source || meta.source || "",
      source_url: q.source_url || meta.source_url || "",
      license: q.license || meta.license || "public_past_exam_review_required",
      fingerprint,
      route: q.route || "",
      imported_at: new Date().toISOString(),
      // Rich exam provenance so the bank stays sliceable by sitting, region,
      // question style and yield. All optional: older payloads simply omit them.
      year_num: Number.isFinite(Number(q.year_num)) ? Number(q.year_num) : null,
      month: q.month || "",
      month_en: q.month_en || "",
      sitting: q.sitting || "",            // 'main' | 'midterm'
      pole: q.pole || "",
      poles: Array.isArray(q.poles) ? q.poles : [],
      scope: q.scope || "",                // 'ملی' | 'قطبی'
      scope_en: q.scope_en || "",
      label_fa: q.label_fa || "",
      label_en: q.label_en || "",
      question_style: q.question_style || "",   // case | recall | negative | image
      // pedagogic grouping: the concept a question teaches, plus its position in
      // the evidence-based sequence (see tools/neurology-bank/PEDAGOGY.md)
      concept: q.concept || "",
      concept_fa: q.concept_fa || "",
      concept_en: q.concept_en || "",
      seq: Number.isFinite(Number(q.seq)) ? Number(q.seq) : null,
      lesson_part: Number.isInteger(Number(q.lesson_part)) ? Number(q.lesson_part) : null,
      repeat_count: Number(q.repeat_count) || 1,
      repeat_sources: Array.isArray(q.repeat_sources) ? q.repeat_sources : [],
      cluster_id: q.cluster_id || "",
      is_representative: q.is_representative !== false,
      tags: Array.isArray(q.tags) ? q.tags : [],
    },
  });
}
function officialImportPlan(body = {}, dryRun = true) {
  const questions = Array.isArray(body.questions) ? body.questions : [];
  const program = body.program || "preint";
  const maxPerLesson = Math.max(1, Math.min(25, Number(body.maxPerLesson || 15) || 15));
  const existing = existingFingerprintSet();
  const tombstones = cardTombstoneSet();
  const seen = new Set();
  const lessonCounts = new Map();
  const plan = [];
  const counters = { total: questions.length, path: 0, premium: 0, duplicate: 0, overflow: 0, bankOnly: 0, errors: 0 };
  for (const q of questions) {
    try {
      const fp = officialFingerprint(q);
      const deleted = tombstones.has(String(fp));
      const inDb = existing.has(fp);
      const duplicate = inDb || seen.has(fp) || deleted;
      seen.add(fp);
      // Fast path for a fingerprint already present in THIS database: the
      // commit step skips it outright (idempotent bootstrap re-runs), so do
      // none of the topic/node resolution or card normalisation — with
      // 11k+ questions that keeps a warm-boot import pass to a few seconds.
      if (inDb || deleted) {
        plan.push({ fingerprint: fp, question_no: q.question_no || plan.length + 1,
          duplicate: true, overflow: false, route: "premium_duplicate",
          subject_fa: q.subject_fa, chapter_fa: q.chapter_fa, part: 0,
          topic: { slug: "", parent: "", name_fa: "" }, data: null });
        counters.duplicate++; counters.premium++;
        continue;
      }
      const topic = officialTopic({ program, subject_fa: q.subject_fa || body.subject_fa, subject_en: q.subject_en || body.subject_en, subject_track: q.subject_track || body.subject_track, chapter_fa: q.chapter_fa || body.chapter_fa, chapter_en: q.chapter_en || body.chapter_en }, true);
      const lessonKey = `${topic.slug}:${q.chapter_fa || q.chapter_en || "general"}`;
      const count = lessonCounts.get(lessonKey) || 0;
      // A payload built by the pedagogic sequencer already knows which lesson
      // part each question belongs to, and that grouping is balanced and
      // concept-mixed. Honour it when present; otherwise fall back to the
      // greedy chunking, which can leave a lonely one-question lesson at the
      // end of a chapter.
      const authoredPart = Number(q.lesson_part);
      const part = Number.isInteger(authoredPart) && authoredPart > 0
        ? authoredPart
        : Math.floor(count / maxPerLesson) + 1;
      // A question with no teaching content is fine in the searchable bank and
      // in exam simulation, but it must not land on the curated learning path:
      // there the student answers and then expects a lesson, and an empty
      // panel reads as a broken page. Importers say so explicitly with
      // `needs_lesson`, and we also detect it from the payload itself so an
      // older or hand-made file cannot slip a bare question onto the path.
      const hasLesson = !!(
        (q.explanation_fa && String(q.explanation_fa).trim()) ||
        (q.micro && ((q.micro.points_fa || []).length || (q.micro.lead_fa || "").trim())) ||
        (Array.isArray(q.options_why_fa) && q.options_why_fa.some((w) => (w || "").trim()))
      );
      const topicGone = !!(topic?.tombstoned || !topic?.id);
      let nodeBlocked = false;
      if (!topicGone && topic?.id && !String(topic.id).startsWith("dry-")) {
        const probe = officialNode(topic, { chapter_fa: q.chapter_fa, chapter_en: q.chapter_en }, part, true);
        if (!probe) nodeBlocked = true;
      }
      const isKeyless = q.keyless === true || q.correct_index === null || q.key_source === "low-confidence";
      const bankOnly = q.needs_lesson === true || !hasLesson || topicGone || nodeBlocked || isKeyless;
      const inPath = !duplicate && !bankOnly;
      if (inPath) lessonCounts.set(lessonKey, count + 1);
      const data = normalizeOfficialQuestion(q, body);
      const overflow = inPath && (count >= maxPerLesson && body.overflowToPremium === true);
      data.premium = duplicate || overflow;
      data.source_meta.route = duplicate
        ? "premium_duplicate"
        : bankOnly ? "bank_only"
          : overflow ? "premium_overflow" : "competitive_path";
      if (bankOnly) data.source_meta.needs_lesson = true;
      plan.push({ fingerprint: fp, question_no: q.question_no || plan.length + 1, duplicate, overflow, route: data.source_meta.route, subject_fa: q.subject_fa, chapter_fa: q.chapter_fa, part,
      // surface the resolved topic so a reviewer can see which exam track the
      // subject lands in (major vs minor) before committing the import
      topic: { slug: topic.slug, parent: topic.parent, name_fa: topic.name_fa }, data });
      if (data.premium) counters.premium++; else if (bankOnly) counters.bankOnly++; else counters.path++;
      if (duplicate) counters.duplicate++; if (overflow) counters.overflow++;
    } catch (e) { counters.errors++; plan.push({ error: String(e.message || e), raw: q }); }
  }
  return { ok: true, dryRun, maxPerLesson, counters, plan };
}
r.post("/official-question-import/preview", ...P("learn.content"), (req, res) => res.json(officialImportPlan(req.body || {}, true)));
/**
 * Commit an official past-exam payload into the bank.
 *
 * Extracted from the route handler so the SAME code path can run without an
 * HTTP request. That matters because the question banks ship as JSON files
 * inside the release: previously the only way to load them was for someone to
 * POST each file by hand after deploying, and if nobody did, the site came up
 * with an empty learning path and an empty content table — which is exactly
 * what happened on the first upload.
 *
 * `actor` may be a real req.user or a synthetic system actor.
 */
export function commitOfficialImport(body = {}, actor = null) {
  const preview = officialImportPlan(body, true);
  const program = body.program || "preint";
  const maxPerLesson = Math.max(1, Math.min(25, Number(body.maxPerLesson || 15) || 15));
  const ins = db.prepare("INSERT INTO flashcards (version,difficulty,data_json,active) VALUES (1,?,?,1)");
  let inserted = 0, attached = 0;
  const insertedIds = [];
  // Re-running the same import (a retry, or a second pass over the same bank)
  // must not double the bank. By default an already-present fingerprint is
  // skipped outright; `duplicates:"premium"` restores the older behaviour of
  // filing it as a premium duplicate instead.
  const dupMode = body.duplicates === "premium" ? "premium" : "skip";
  let skipped = 0;
  const tx = db.transaction(() => {
    const nodeCounts = new Map();
    const tombstones = cardTombstoneSet();
    for (const item of preview.plan) {
      if (item.error) continue;
      if (item.fingerprint && tombstones.has(String(item.fingerprint))) { skipped++; continue; }
      if (item.duplicate && dupMode === "skip") { skipped++; continue; }
      const d = item.data;
      const topic = officialTopic({ program, subject_fa: d.source_meta.subject_fa, subject_en: d.source_meta.subject_en, subject_track: d.source_meta.subject_track, chapter_fa: d.source_meta.chapter_fa, chapter_en: d.source_meta.chapter_en }, false);
      d.topic = topic?.slug || d.topic;
      let node = null;
      if (!topic?.id || topic.tombstoned) {
        if (d.source_meta.route === "competitive_path") d.source_meta.route = "bank_only";
      } else if (d.source_meta.route === "competitive_path") {
        const key = `${topic.slug}:${d.source_meta.chapter_fa || d.source_meta.chapter_en || "general"}`;
        const count = nodeCounts.get(key) || 0;
        nodeCounts.set(key, count + 1);
        // The preview already decided the lesson part, honouring any authored
        // grouping from the pedagogic sequencer. Reuse it rather than counting
        // again here, so preview and commit can never disagree.
        const part = Number.isInteger(item.part) && item.part > 0
          ? item.part
          : Math.floor(count / maxPerLesson) + 1;
        node = officialNode(topic, { chapter_fa: d.source_meta.chapter_fa, chapter_en: d.source_meta.chapter_en }, part, false);
        if (!node?.id || String(node.id).startsWith("dry-")) {
          d.source_meta.route = "bank_only";
          node = null;
        }
      }
      const info = ins.run(d.difficulty || "medium", JSON.stringify(d));
      insertedIds.push(info.lastInsertRowid);
      inserted++;
      if (node) {
        let ids = []; try { ids = JSON.parse(node.card_ids || "[]"); } catch { ids = []; }
        if (!ids.includes(info.lastInsertRowid)) ids.push(info.lastInsertRowid);
        db.prepare("UPDATE path_nodes SET card_ids=? WHERE id=?").run(JSON.stringify(ids), node.id);
        attached++;
      }
    }
  });
  tx();
  // This payload's fingerprints are now in the DB (whether inserted or skipped
  // as duplicates) — make later parts within the same boot see them without a
  // full table rescan.
  for (const item of preview.plan) if (item.fingerprint) officialExistingCache?.add(item.fingerprint);
  // Nothing changed (idempotent warm-boot pass over an already-imported part):
  // skip the table scans and, crucially, the sql.js disk export entirely —
  // that is what made every server restart churn for over a minute.
  if (!inserted) {
    return { ok: true, inserted: 0, attached: 0, skipped, revived: 0, purged: 0, counters: preview.counters };
  }
  // Stamp the freshly imported rows with their provenance in the change log so
  // "recently added questions in Neurology" is answerable straight after an
  // import, without waiting for someone to edit them.
  if (insertedIds.length) recordImport(insertedIds, actor, "official past-exam import");
  const revived = reviveNodesWithCards();
  const purged = purgeUnsignedInOfficialSubjects();
  persistNow();
  return { ok: true, inserted, attached, skipped, revived, purged, counters: preview.counters };
}

r.post("/official-question-import/commit", ...P("learn.content"), async (req, res) => {
  const out = commitOfficialImport(req.body || {}, req.user);
  // Re-curate so newly imported questions immediately appear as titled
  // path stages / premium bank rows instead of ad-hoc 1-question nodes.
  try {
    const { curateOfficialPath } = await import("../lib/pathcurator.js");
    out.curation = curateOfficialPath({ force: out.inserted > 0 });
  } catch (e) { out.curation = { error: String(e.message || e) }; }
  audit(req, "official_question_import", "flashcards", {
    inserted: out.inserted, attached: out.attached, skipped: out.skipped, counters: out.counters,
  });
  res.json(out);
});

// Manual re-run of the path curator (rebuilds titled free stages + premium
// bank assignment from the official questions currently in the database).
r.post("/learn-path/curate", ...P("learn.content"), async (req, res) => {
  try {
    const { curateOfficialPath } = await import("../lib/pathcurator.js");
    const out = curateOfficialPath({ force: true });
    audit(req, "learn_path_curate", "path_nodes", out);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: "curation_failed", message: String(e.message || e) });
  }
});

r.put("/learn-cards/:id", ...P("learn.content"), (req, res) => {
  const c = db.prepare("SELECT * FROM flashcards WHERE id=?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  if (!isLearnContent(c.data_json)) {
    return res.status(403).json({ error: "wrong_track", stage: "access" });
  }
  let d = {}; try { d = JSON.parse(c.data_json); } catch { /* */ }
  const b = req.body || {};
  // Quick toggles (premium/category/active) OR a full re-edit of every field.
  if ("premium" in b) d.premium = !!b.premium;
  if ("category" in b) d.category = b.category || "";
  // If a full edit payload is sent (has type), rebuild the card body from scratch.
  if (b.type) {
    const rebuilt = buildLearnCard({ ...b, premium: d.premium, category: d.category });
    d = { ...rebuilt };
  } else {
    if (b.q_fa != null) { d.q_fa = b.q_fa; d.title_fa = b.q_fa; }
    if (b.q_en != null) { d.q_en = b.q_en; d.title_en = b.q_en; }
    if (b.options) d.options = b.options.map((o) => ({ fa: o.fa || "", en: o.en || o.fa || "", correct: !!o.correct }));
    if ("answer" in b) d.answer = !!b.answer;
    if (b.micro) d.micro = b.micro;
  }
  let before = {}; try { before = JSON.parse(c.data_json); } catch { /* */ }
  db.prepare("UPDATE flashcards SET data_json=?, difficulty=? WHERE id=?").run(JSON.stringify(d), b.difficulty || c.difficulty, c.id);
  const activeChanged = "active" in b && (!!b.active) !== (!!c.active);
  if ("active" in b) db.prepare("UPDATE flashcards SET active=? WHERE id=?").run(b.active ? 1 : 0, c.id);
  // Log the change so the admin can later ask "what was edited, where and by
  // whom" — and so an activate/deactivate is not mistaken for a content edit.
  const { fields } = recordCardChange({
    cardId: c.id,
    action: activeChanged && !b.type ? (b.active ? "activated" : "deactivated") : "edited",
    before, after: d, actor: req.user,
  });
  audit(req, "learn.card_edit", `flashcards:${c.id}`, { fields });
  persistNow();
  res.json({ ok: true, fields });
});
// ---------------------------------------------------------------------------
// Question modification log
// ---------------------------------------------------------------------------
// "Which questions changed last, and where?" — the log is filterable by the
// same facets as the card list, so a combined query like
//   /admin/card-revisions?subject=نورولوژی&chapter=سردرد…
// answers "last modification in Neurology → Headache" directly.
r.get("/card-revisions", ...P("learn.content"), (req, res) => {
  const q = req.query || {};
  res.json({
    revisions: listRevisions({
      cardId: q.cardId ? parseInt(q.cardId, 10) : null,
      subject: q.subject || null,
      chapter: q.chapter || null,
      action: q.action || null,
      actorId: q.actorId ? parseInt(q.actorId, 10) : null,
      from: q.from || null,
      to: q.to || null,
      limit: q.limit,
    }),
  });
});

// Per-card history, shown inside the card editor.
/* One full card (body + provenance) for the editor. Kept separate from the
   list so the list stays light (see above). */
r.get("/learn-cards/:id", ...P("learn.content"), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "bad id" });
  const c = db.prepare(
    `SELECT f.id, f.data_json, f.difficulty, f.active, f.updated_at, f.created_at,
            f.content_updated_at, f.revision, f.last_action,
            COALESCE(u.name_fa, u.name_en, u.username) AS last_editor_name
       FROM flashcards f LEFT JOIN users u ON u.id = f.last_editor_id WHERE f.id=?`
  ).get(id);
  if (!c) return res.status(404).json({ error: "not found" });
  let d = {}; try { d = JSON.parse(c.data_json); } catch { /* */ }
  res.json({
    card: {
      id: c.id, active: c.active, type: d.type || "mcq", difficulty: c.difficulty || "medium",
      track: d.track || "uni", premium: !!d.premium, category: d.category || "",
      revision: c.revision || 1, lastAction: c.last_action || "created", lastEditor: c.last_editor_name || "",
      createdAt: c.created_at || "", updatedAt: c.updated_at || "", contentUpdatedAt: c.content_updated_at || c.updated_at || "",
      facets: cardFacets(d, { ...c, created_at: c.created_at, updated_at: c.content_updated_at || c.updated_at }),
      data: d,
    },
  });
});

r.get("/learn-cards/:id/history", ...P("learn.content"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const card = db.prepare(
    `SELECT f.id, f.revision, f.created_at, f.content_updated_at, f.updated_at,
            f.last_action, COALESCE(u.name_fa, u.name_en, u.username) AS last_editor_name
       FROM flashcards f LEFT JOIN users u ON u.id = f.last_editor_id
      WHERE f.id=?`
  ).get(id);
  if (!card) return res.status(404).json({ error: "not found" });
  res.json({ card, revisions: listRevisions({ cardId: id, limit: 200 }) });
});

// Activity roll-up for the content dashboard (edits per day + per subject).
r.get("/card-revisions/summary", ...P("learn.content"), (req, res) => {
  res.json(revisionSummary(parseInt(req.query?.days, 10) || 30));
});

// ---------------------------------------------------------------------------
// Demo content cleanup
// ---------------------------------------------------------------------------
// The seeded sample questions exist so a fresh install is not an empty shell.
// Once real past-exam questions are imported they become noise, so admins get
// an explicit, reversible way to retire them: `preview` reports what would go,
// `deactivate` hides them from learners while keeping them inspectable, and
// `delete` removes them for good.
/* If a subject already has official past-exam cards, drop demo seeds and
   unsigned/no-source authored cards in that subject so the learner bank is
   only identified questions. Official imports are never deleted. */
export function purgeUnsignedInOfficialSubjects() {
  const rows = db.prepare("SELECT id, data_json, active FROM flashcards").all();
  const parsed = rows.map((c) => {
    let d = {}; try { d = JSON.parse(c.data_json); } catch { d = {}; }
    return { id: c.id, d, active: c.active };
  });
  const officialSubjects = new Set();
  for (const c of parsed) {
    if (c.d?.source_meta?.kind === "past_exam_import") {
      const subj = c.d.source_meta.subject_fa || c.d.topic || "";
      if (subj) officialSubjects.add(subj);
    }
  }
  const doomed = [];
  for (const c of parsed) {
    const sm = c.d?.source_meta || {};
    if (sm.kind === "past_exam_import") continue;
    const subj = sm.subject_fa || c.d.topic || "";
    if (!officialSubjects.has(subj)) continue;
    const signed = !!(sm.source || sm.license || c.d.micro?.source_fa || c.d.micro?.source_en);
    if (c.d.content_origin === "demo_seed" || !signed) doomed.push(c.id);
  }
  if (!doomed.length) return { deleted: 0, detached: 0, subjects: [...officialSubjects] };
  const idSet = new Set(doomed);
  let detached = 0;
  const tx = db.transaction(() => {
    for (const n of db.prepare("SELECT id, card_ids FROM path_nodes").all()) {
      let list = []; try { list = JSON.parse(n.card_ids || "[]"); } catch { continue; }
      const kept = list.filter((x) => !idSet.has(x));
      if (kept.length !== list.length) {
        db.prepare("UPDATE path_nodes SET card_ids=? WHERE id=?").run(JSON.stringify(kept), n.id);
        detached++;
      }
    }
    for (const id of doomed) {
      const row = db.prepare("SELECT id, data_json FROM flashcards WHERE id=?").get(id);
      tombstoneCard(row);
      db.prepare("DELETE FROM flashcards WHERE id=?").run(id);
      db.prepare("DELETE FROM card_revisions WHERE card_id=?").run(id);
    }
    for (const n of db.prepare("SELECT id, card_ids FROM path_nodes").all()) {
      let list = []; try { list = JSON.parse(n.card_ids || "[]"); } catch { continue; }
      if (!list.length) db.prepare("UPDATE path_nodes SET active=0 WHERE id=?").run(n.id);
    }
  });
  tx(); persistNow();
  return { deleted: doomed.length, detached, subjects: [...officialSubjects] };
}

function demoCardRows() {
  return db.prepare("SELECT id, data_json, active FROM flashcards").all().filter((c) => {
    let d = {}; try { d = JSON.parse(c.data_json); } catch { return false; }
    return d.content_origin === "demo_seed";
  });
}
r.get("/demo-cards", ...P("learn.content"), (req, res) => {
  const rows = demoCardRows();
  const nodes = db.prepare("SELECT id, title_fa, card_ids FROM path_nodes").all();
  const ids = new Set(rows.map((c) => c.id));
  let usedInNodes = 0;
  for (const n of nodes) {
    let list = []; try { list = JSON.parse(n.card_ids || "[]"); } catch { /* */ }
    if (list.some((x) => ids.has(x))) usedInNodes++;
  }
  res.json({ count: rows.length, active: rows.filter((c) => c.active).length, usedInNodes });
});
r.post("/demo-cards/purge", ...P("learn.content"), (req, res) => {
  const mode = req.body?.mode === "delete" ? "delete" : "deactivate";
  const rows = demoCardRows();
  const ids = rows.map((c) => c.id);
  if (!ids.length) return res.json({ ok: true, mode, affected: 0, detached: 0 });
  const idSet = new Set(ids);
  let detached = 0;
  const tx = db.transaction(() => {
    // Always unlink them from the learning path first, otherwise a lesson would
    // point at a card the learner can no longer be served.
    for (const n of db.prepare("SELECT id, card_ids FROM path_nodes").all()) {
      let list = []; try { list = JSON.parse(n.card_ids || "[]"); } catch { continue; }
      const kept = list.filter((x) => !idSet.has(x));
      if (kept.length !== list.length) {
        db.prepare("UPDATE path_nodes SET card_ids=? WHERE id=?").run(JSON.stringify(kept), n.id);
        detached++;
      }
    }
    for (const id of ids) {
      if (mode === "delete") {
        db.prepare("DELETE FROM flashcards WHERE id=?").run(id);
        db.prepare("DELETE FROM card_revisions WHERE card_id=?").run(id);
      } else {
        db.prepare("UPDATE flashcards SET active=0 WHERE id=?").run(id);
        recordCardChange({ cardId: id, action: "deactivated", actor: req.user, note: "demo cleanup", contentChanged: false });
      }
    }
    // Drop lessons that are now empty so the path has no dead nodes.
    for (const n of db.prepare("SELECT id, card_ids FROM path_nodes").all()) {
      let list = []; try { list = JSON.parse(n.card_ids || "[]"); } catch { continue; }
      if (!list.length) db.prepare("UPDATE path_nodes SET active=0 WHERE id=?").run(n.id);
    }
  });
  tx(); persistNow();
  audit(req, "learn.demo_purge", "flashcards", { mode, affected: ids.length, detached });
  res.json({ ok: true, mode, affected: ids.length, detached });
});
r.post("/demo-cards/purge-unsigned", ...P("learn.content"), (req, res) => {
  const out = purgeUnsignedInOfficialSubjects();
  audit(req, "learn.unsigned_purge", "flashcards", out);
  res.json({ ok: true, ...out });
});

r.delete("/learn-cards/:id", ...P("learn.content"), (req, res) => {
  const doomed = db.prepare("SELECT id, data_json FROM flashcards WHERE id=?").get(req.params.id);
  if (!doomed) return res.status(404).json({ error: "not found" });
  if (!isLearnContent(doomed.data_json)) {
    return res.status(403).json({ error: "wrong_track", stage: "access" });
  }
  tombstoneCard(doomed);
  db.prepare("DELETE FROM flashcards WHERE id=?").run(req.params.id);
  // also strip from any lesson that referenced it
  for (const n of db.prepare("SELECT id, card_ids FROM path_nodes").all()) {
    let ids = []; try { ids = JSON.parse(n.card_ids || "[]"); } catch { /* */ }
    if (ids.includes(Number(req.params.id))) {
      db.prepare("UPDATE path_nodes SET card_ids=? WHERE id=?").run(JSON.stringify(ids.filter((x) => x !== Number(req.params.id))), n.id);
    }
  }
  audit(req, "learn.card_delete", `flashcards:${req.params.id}`, {});
  persistNow();
  res.json({ ok: true });
});

r.post("/content/import/preview", ...P("learn.content"), (req, res) => {
  const csv = req.body?.csv || "";
  const lang = L(req);
  let rows;
  try { rows = parseCSV(csv); } catch { return res.status(400).json({ error: "invalid csv" }); }
  const topicIndex = buildTopicIndex();
  const topics = Object.fromEntries(db.prepare("SELECT slug, name_fa FROM topics").all().map((t) => [t.slug, t.name_fa]));
  const errors = []; const byType = {}; const byTopic = {}; let ok = 0; const rowsOut = [];
  rows.forEach((row, i) => {
    const parsed = rowToCardData(row, topicIndex);
    let err = validateRow(parsed, i);
    if (!err && parsed.topicSlug && !topics[parsed.topicSlug]) err = `${lang === "fa" ? "ردیف" : "Row"} ${i + 1}: ${lang === "fa" ? "درس نامعتبر" : "unknown topic"} «${parsed.topicSlug}»`;
    // per-row echo of what the site understood (so admins can verify before import)
    rowsOut.push({ row: i + 1, ok: !err, error: err || null, ...explainRow(parsed, lang) });
    if (err) { errors.push(err); return; }
    ok++; byType[parsed.data.type] = (byType[parsed.data.type] || 0) + 1;
    if (parsed.topicSlug) byTopic[parsed.topicSlug] = (byTopic[parsed.topicSlug] || 0) + 1;
  });
  const validTopics = db.prepare("SELECT slug, name_fa, name_en FROM topics WHERE active=1 ORDER BY ord, id").all()
    .map((t) => ({ slug: t.slug, name: lang === "fa" ? t.name_fa : t.name_en }));
  res.json({ total: rows.length, valid: ok, errors: errors.slice(0, 50), byType, byTopic, rows: rowsOut.slice(0, 100), validTopics });
});

// commit import: writes cards, attaches them to their topic's path nodes
r.post("/content/import", ...P("learn.content"), (req, res) => {
  const csv = req.body?.csv || "";
  const attachToPath = req.body?.attachToPath !== false; // default: add to the topic's path
  let rows;
  try { rows = parseCSV(csv); } catch { return res.status(400).json({ error: "invalid csv" }); }
  const topics = Object.fromEntries(db.prepare("SELECT id, slug FROM topics").all().map((t) => [t.slug, t.id]));
  const topicIndex = buildTopicIndex();
  const insCard = db.prepare("INSERT INTO flashcards (version, difficulty, data_json, active) VALUES (1,?,?,1)");
  let imported = 0; const errors = []; const perTopicCards = {};
  const tx = db.transaction(() => {
    rows.forEach((row, i) => {
      const parsed = rowToCardData(row, topicIndex);
      const err = validateRow(parsed, i);
      if (err) { errors.push(err); return; }
      if (parsed.topicSlug && !topics[parsed.topicSlug]) { errors.push(`ردیف ${i + 1}: درس نامعتبر «${parsed.topicSlug}»`); return; }
      const info = insCard.run(parsed.difficulty, JSON.stringify(parsed.data));
      imported++;
      if (parsed.topicSlug) (perTopicCards[parsed.topicSlug] ||= []).push(info.lastInsertRowid);
    });
    // attach imported cards to a fresh lesson node per topic so they show on the path
    if (attachToPath) {
      for (const [slug, cardIds] of Object.entries(perTopicCards)) {
        const topicId = topics[slug];
        const ord = (db.prepare("SELECT COALESCE(MAX(ord),-1)+1 AS n FROM path_nodes WHERE topic_id=?").get(topicId).n) || 0;
        // chunk into lessons of up to 5 cards each
        for (let c = 0; c < cardIds.length; c += 5) {
          const chunk = cardIds.slice(c, c + 5);
          db.prepare("INSERT INTO path_nodes (topic_id,title_fa,title_en,ord,kind,card_ids,xp_reward,active) VALUES (?,?,?,?,?,?,?,1)")
            .run(topicId, `درس واردشده ${ord + 1}`, `Imported lesson ${ord + 1}`, ord + Math.floor(c / 5), "lesson", JSON.stringify(chunk), 20);
        }
      }
    }
  });
  tx();
  audit(req, "content.import", "flashcards", { imported, topics: Object.keys(perTopicCards) });
  persistNow();
  res.json({ imported, errors: errors.slice(0, 50) });
});

// SIMPLE downloadable template: MCQ-only, minimal columns, uses the friendly
// "*" marker for the correct option — the easiest possible starting point.
r.get("/content/import/simple.csv", ...P("learn.content"), (req, res) => {
  const cols = ["type", "topic", "difficulty", "question", "options", "correct"];
  const examples = [
    { type: "mcq", topic: "gi", difficulty: "medium", question: "شایع‌ترین علت خونریزی گوارشی فوقانی؟",
      options: "زخم پپتیک | واریس مری | سرطان معده | مالوری وایس", correct: "1" },
    { type: "mcq", topic: "cardio", difficulty: "easy", question: "اولین اقدام در برخورد با STEMI؟",
      options: "ECG در ۱۰ دقیقه* | آنژیوگرافی | اکوکاردیوگرافی | تست ورزش", correct: "" },
  ];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=simple_questions.csv");
  res.send(toCSV(examples, cols));
});

// downloadable CSV template with a filled example row per type
r.get("/content/import/template.csv", ...P("learn.content"), (req, res) => {
  const cols = ["type", "topic", "difficulty", "q_fa", "q_en", "options_fa", "options_en", "correct",
    "answer", "blank_fa", "blank_en", "accept_fa", "accept_en", "pairs_fa", "pairs_en",
    "items_fa", "items_en", "hints_fa", "hints_en", "lead_fa", "lead_en",
    "golden_fa", "golden_en", "analysis_fa", "analysis_en", "source_fa", "source_en"];
  const examples = [
    { type: "mcq", topic: "gi", difficulty: "medium", q_fa: "شایع‌ترین علت خونریزی گوارشی فوقانی؟", q_en: "Most common cause of upper GI bleed?",
      options_fa: "زخم پپتیک|واریس مری|سرطان معده|مالوری وایس", options_en: "PUD|Varices|Gastric cancer|Mallory-Weiss", correct: "1",
      hints_fa: "منشأ بالای رباط تریتز", golden_fa: "زخم پپتیک شایع‌ترین علت است؛ ابتدا تثبیت، سپس آندوسکوپی.",
      analysis_fa: "✅ زخم پپتیک: شایع‌ترین|❌ واریس: در سیروز", source_fa: "هاریسون" },
    { type: "truefalse", topic: "surgery", difficulty: "easy", q_fa: "علامت مورفی به نفع کوله‌سیستیت است.", answer: "true",
      golden_fa: "مورفی مثبت = کوله‌سیستیت حاد.", source_fa: "شوارتز" },
    { type: "fill", topic: "neuro", difficulty: "medium", q_fa: "پنجرهٔ tPA وریدی تا ____ ساعت است.", blank_fa: "۴.۵", accept_fa: "۴.۵|4.5" },
    { type: "match", topic: "pharm", difficulty: "medium", q_fa: "هر مسمومیت را به آنتی‌دوت وصل کنید:",
      pairs_fa: "استامینوفن::NAC|اوپیوئید::نالوکسان", source_fa: "گودمن" },
    { type: "order", topic: "cardio", difficulty: "hard", q_fa: "مراحل برخورد با STEMI را مرتب کنید:",
      items_fa: "ECG در ۱۰ دقیقه|آسپیرین بجوید|ریپرفیوژن" },
  ];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=preinternship_template.csv");
  res.send(toCSV(examples, cols));
});

/* ============ DATA EXPORT (JSON snapshot) ============ */
r.get("/export/:table", ...P("learn.data"), (req, res) => {
  const allowed = ["users", "flashcards", "topics", "path_nodes", "learner_profiles", "audit_log", "ads", "challenges"];
  const table = req.params.table;
  if (!allowed.includes(table)) return res.status(400).json({ error: "table not exportable" });
  let rows = db.prepare(`SELECT * FROM ${table} LIMIT 5000`).all();
  // Credentials never leave the server — a data export is for analysis, and
  // the "Export data" permission is also held by support/content staff.
  if (table === "users") {
    rows = rows.map(({ password_hash, token_ver, google_id, ...rest }) => rest);
  }
  audit(req, "data.export", table, { rows: rows.length });
  res.setHeader("Content-Disposition", `attachment; filename="${table}.json"`);
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(rows, null, 2));
});

/* ============ PUBLIC FLAGS (any authed user can read which features are on) ============ */
export function publicFlagsHandler(req, res) {
  ensureFlags();
  const rows = allFlags();
  res.json({ flags: Object.fromEntries(rows.map((f) => [f.key, !!f.enabled])) });
}

export default r;
