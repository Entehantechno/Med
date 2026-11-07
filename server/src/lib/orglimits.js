/* orglimits.js — per-university licensing, sales configuration and feature
   flags, plus the monthly usage metering that enforces them.

   Feature flags are tri-state and resolve hierarchically:
       class.flash_no_penalty  →  university.flash_no_penalty  →  settings key
   so an administrator decides globally and teachers can override per class.

   Limits (max_students / VP message & token budgets) are only enforced when
   universities.limits_enabled = 1, so a university on an open contract is
   unaffected; every NULL limit means "unlimited". */

import { db } from "../db.js";

/* ---------- settings (global defaults) ---------- */
export function getSetting(key) {
  try { return db.prepare("SELECT value FROM settings WHERE key=?").get(key)?.value ?? null; }
  catch { return null; }
}
export function setSetting(key, value) {
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(key, String(value));
}
export function boolSetting(key, dflt = false) {
  const v = getSetting(key);
  return v == null ? dflt : (v === "1" || v === "true" || v === "on");
}

/* ---------- tri-state flag resolution ---------- */
const tri = (v) => (v === 1 || v === 0) ? !!v : null; // NULL/undefined → inherit

function universityRow(id) {
  if (!id) return null;
  try { return db.prepare("SELECT * FROM universities WHERE id=?").get(id) || null; } catch { return null; }
}

/** Generic resolution: row column → university column → global settings key → default. */
function effectiveTriFlag(row, universityId, col, settingKey, dflt = false) {
  const t = tri(row?.[col]);
  if (t !== null) return t;
  const tu = tri(universityRow(universityId ?? row?.university_id)?.[col]);
  if (tu !== null) return tu;
  return boolSetting(settingKey, dflt);
}

/** Effective "no-penalty flashcards" for a class row (or bare university_id). */
export function effectiveFlashNoPenalty(cls = null, universityId = null) {
  return effectiveTriFlag(cls, universityId, "flash_no_penalty", "default_flash_no_penalty", false);
}

/* Flashcard navigation flags (exam or class). Teachers set them on the exam /
   class; admins set the university and global defaults. Both default OFF, so an
   unconfigured exam keeps the strict one-way flow. */
export function effectiveFlashAllowBack(row = null, universityId = null) {
  return effectiveTriFlag(row, universityId, "flash_allow_back", "default_flash_allow_back", false);
}
export function effectiveFlashAllowChange(row = null, universityId = null) {
  return effectiveTriFlag(row, universityId, "flash_allow_change", "default_flash_allow_change", false);
}

/** Effective "leaderboard tie-break by less time" for a class row. */
export function effectiveLiveBoardSpeed(cls = null, universityId = null) {
  const t = tri(cls?.live_board_speed);
  if (t !== null) return t;
  const uni = universityRow(universityId ?? cls?.university_id);
  const tu = tri(uni?.live_board_speed);
  if (tu !== null) return tu;
  return boolSetting("default_live_board_speed", false);
}

/* ---------- student-count cap ---------- */
function studentCount(uniId) {
  if (!uniId) return 0;
  return db.prepare("SELECT COUNT(*) c FROM users WHERE role='student' AND university_id=?").get(uniId).c;
}

/** null when ok; {max,current,wouldBe} when adding n students would break the cap. */
export function checkStudentLimit(uniId, addCount = 0) {
  const u = universityRow(uniId);
  if (!u || !u.limits_enabled || u.max_students == null) return null;
  const current = studentCount(uniId);
  const wouldBe = current + Math.max(0, addCount);
  if (wouldBe > u.max_students) return { max: u.max_students, current, wouldBe };
  return null;
}

/* ---------- monthly usage metering (virtual patient) ---------- */
export function monthPeriod(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function usageRow(uniId, period = monthPeriod()) {
  if (!uniId) return null;
  db.prepare("INSERT OR IGNORE INTO university_usage (university_id,period) VALUES (?,?)").run(uniId, period);
  return db.prepare("SELECT * FROM university_usage WHERE university_id=? AND period=?").get(uniId, period);
}

export function vpUsage(uniId, period = monthPeriod()) {
  const r = usageRow(uniId, period);
  if (!r) return { period, vp_msgs: 0, vp_tokens: 0, vp_sessions: 0 };
  return { period: r.period, vp_msgs: r.vp_msgs || 0, vp_tokens: r.vp_tokens || 0, vp_sessions: r.vp_sessions || 0 };
}

/** Rough token estimate for mixed fa/en text (≈3.2 chars/token, floor 1). */
export function estimateTokens(...texts) {
  let chars = 0;
  for (const t of texts) {
    if (!t) continue;
    chars += typeof t === "string" ? t.length : JSON.stringify(t).length;
  }
  return Math.max(1, Math.ceil(chars / 3.2));
}

/* ---------- normalization for admin input ---------- */
/** null | non-negative int, NaN-safe */
export function limitInt(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined; // undefined = invalid input
}
/** tri-state input: "on"/true/1 → 1 ; "off"/false/0 → 0 ; everything else → null (inherit) */
export function triInput(v) {
  if (v === 1 || v === true || v === "on" || v === "1") return 1;
  if (v === 0 || v === false || v === "off" || v === "0") return 0;
  return null;
}

/* Validate the per-university licensing / limits payload used by both the
   universities POST (create) and PUT (update) routes — previously the create
   route silently dropped these fields. Returns {error} or {patch:{col:val}}. */
const LICENSE_PLANS = ["trial", "standard", "enterprise"];
export function parseLicensingBody(b = {}) {
  const patch = {};
  const num = (key, col) => {
    if (b[key] === undefined) return true;
    const v = limitInt(b[key]);
    if (v === undefined) return false;
    patch[col] = v;                       // null = unlimited
    return true;
  };
  if (!num("max_students", "max_students")) return { error: "invalid_max_students" };
  if (!num("max_vp_msgs_month", "max_vp_msgs_month")) return { error: "invalid_max_vp_msgs_month" };
  if (!num("max_vp_tokens_month", "max_vp_tokens_month")) return { error: "invalid_max_vp_tokens_month" };
  if (b.limits_enabled !== undefined) patch.limits_enabled = b.limits_enabled ? 1 : 0;
  if (b.license_plan !== undefined) {
    const plan = String(b.license_plan || "").trim();
    if (!LICENSE_PLANS.includes(plan)) return { error: "invalid_license_plan" };
    patch.license_plan = plan;
  }
  if (b.license_expires_at !== undefined) patch.license_expires_at = b.license_expires_at === null ? null : String(b.license_expires_at).slice(0, 40);
  if (b.sales_method !== undefined) patch.sales_method = b.sales_method === null ? null : String(b.sales_method).slice(0, 60);
  if (b.flash_no_penalty !== undefined) patch.flash_no_penalty = triInput(b.flash_no_penalty);
  if (b.flash_allow_back !== undefined) patch.flash_allow_back = triInput(b.flash_allow_back);
  if (b.flash_allow_change !== undefined) patch.flash_allow_change = triInput(b.flash_allow_change);
  if (b.live_board_speed !== undefined) patch.live_board_speed = triInput(b.live_board_speed);
  return { patch };
}
