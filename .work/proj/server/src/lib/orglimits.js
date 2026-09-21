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

export function universityRow(id) {
  if (!id) return null;
  try { return db.prepare("SELECT * FROM universities WHERE id=?").get(id) || null; } catch { return null; }
}

/** Effective "no-penalty flashcards" for a class row (or bare university_id). */
export function effectiveFlashNoPenalty(cls = null, universityId = null) {
  const t = tri(cls?.flash_no_penalty);
  if (t !== null) return t;
  const uni = universityRow(universityId ?? cls?.university_id);
  const tu = tri(uni?.flash_no_penalty);
  if (tu !== null) return tu;
  return boolSetting("default_flash_no_penalty", false);
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
export function studentCount(uniId) {
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

export function usageRow(uniId, period = monthPeriod()) {
  if (!uniId) return null;
  db.prepare("INSERT OR IGNORE INTO university_usage (university_id,period) VALUES (?,?)").run(uniId, period);
  return db.prepare("SELECT * FROM university_usage WHERE university_id=? AND period=?").get(uniId, period);
}

export function vpUsage(uniId, period = monthPeriod()) {
  const r = usageRow(uniId, period);
  if (!r) return { period, vp_msgs: 0, vp_tokens: 0, vp_sessions: 0 };
  return { period: r.period, vp_msgs: r.vp_msgs || 0, vp_tokens: r.vp_tokens || 0, vp_sessions: r.vp_sessions || 0 };
}

/** Which university pays for a VP interaction: the class/exam owner first,
    then the caller's own university (learners without org → unbilled). */
export function resolveVpUniversity({ classId = null, examId = null, userId = null } = {}) {
  try {
    if (classId) {
      const r = db.prepare("SELECT university_id FROM classes WHERE id=?").get(classId);
      if (r?.university_id) return r.university_id;
    }
    if (examId) {
      const r = db.prepare("SELECT university_id FROM exams WHERE id=?").get(examId);
      if (r?.university_id) return r.university_id;
    }
    if (userId) {
      const r = db.prepare("SELECT university_id FROM users WHERE id=?").get(userId);
      if (r?.university_id) return r.university_id;
    }
  } catch { /* */ }
  return null;
}

/** null when a VP chat message is allowed; {kind:'messages'|'tokens',...} when a cap is hit. */
export function checkVpAllowance(uniId) {
  if (!uniId) return null;
  const u = universityRow(uniId);
  if (!u || !u.limits_enabled) return null;
  const use = vpUsage(uniId);
  if (u.max_vp_msgs_month != null && use.vp_msgs >= u.max_vp_msgs_month) {
    return { kind: "messages", max: u.max_vp_msgs_month, used: use.vp_msgs, period: use.period };
  }
  if (u.max_vp_tokens_month != null && use.vp_tokens >= u.max_vp_tokens_month) {
    return { kind: "tokens", max: u.max_vp_tokens_month, used: use.vp_tokens, period: use.period };
  }
  return null;
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

export function bumpUsage(uniId, { msgs = 0, tokens = 0, sessions = 0 } = {}) {
  if (!uniId) return;
  try {
    usageRow(uniId);
    db.prepare(
      `UPDATE university_usage
          SET vp_msgs = vp_msgs + ?, vp_tokens = vp_tokens + ?, vp_sessions = vp_sessions + ?,
              updated_at = datetime('now')
        WHERE university_id = ? AND period = ?`
    ).run(Math.round(msgs), Math.round(tokens), Math.round(sessions), uniId, monthPeriod());
  } catch { /* metering must never break the clinical flow */ }
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
  if (b.live_board_speed !== undefined) patch.live_board_speed = triInput(b.live_board_speed);
  return { patch };
}
