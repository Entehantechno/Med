import { routingSettings } from "./ai-routing.js";
/* vpatient.js — Virtual Patient for the COMPETITIVE (learner) side.

   The virtual-patient engine (patientReply / order / evaluate) already exists
   and is shared with the university exam flow. This module adds the LEARNER
   access layer: an admin-editable config controlling whether learners see the
   feature at all, and whether it's premium-only. It also selects which cases
   are exposed in the competitive path and picks a deterministic "case of the
   day" for the daily challenge.

   Config lives in the settings table under key "vpatient":
     { enabled: bool, premium_only: bool, in_path: bool, in_daily: bool,
       daily_gems: number }

   AI-free by default: the engine falls back to the deterministic mock patient
   unless an AI key is configured (opt-in), exactly per the platform's cost rule.
*/
import { db, persistNow } from "../db.js";
import { isEnabled } from "./flags.js";
import { awardXp } from "./gamify.js";
import { resolveAiConfig } from "./ai-engine.js";
import { liveExamCaseIdSet } from "./live-exam-content.js";
import { isLearnContent } from "./content-track.js";

const KEY = "vpatient";

export const DEFAULT_VPATIENT = {
  enabled: false,        // master switch for the competitive side (off until wanted)
  premium_only: true,    // when enabled, restrict to premium learners
  in_path: true,         // allow surfacing a case as a learning-path node
  in_daily: true,        // allow a "case of the day" in the daily challenge
  daily_gems: 15,        // reward for completing the daily case
  award_xp: true,        // whether finishing a case grants ranking XP
  default_xp_max: 120,   // XP cap for a 100%% case when the case has no own cap
};

export function getVpatientConfig() {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(KEY);
  let saved = {};
  try { saved = row ? JSON.parse(row.value) : {}; } catch { saved = {}; }
  const cfg = { ...DEFAULT_VPATIENT, ...saved };
  cfg.enabled = saved.enabled === true;
  cfg.premium_only = saved.premium_only !== false;
  cfg.in_path = saved.in_path !== false;
  cfg.in_daily = saved.in_daily !== false;
  cfg.daily_gems = Number.isFinite(+saved.daily_gems) ? Math.max(0, Math.round(+saved.daily_gems)) : DEFAULT_VPATIENT.daily_gems;
  cfg.award_xp = saved.award_xp !== false;
  cfg.default_xp_max = Number.isFinite(+saved.default_xp_max) ? Math.max(0, Math.round(+saved.default_xp_max)) : DEFAULT_VPATIENT.default_xp_max;
  return cfg;
}

/* The XP cap for a case: the case's own `xp_max` (set by admin in the case data)
   falls back to the global default. */
export function caseXpMax(caseData) {
  const own = Number(caseData?.xp_max);
  if (Number.isFinite(own) && own >= 0) return Math.round(own);
  return getVpatientConfig().default_xp_max;
}

export function saveVpatientConfig(input) {
  const cfg = {
    enabled: input?.enabled === true,
    premium_only: input?.premium_only !== false,
    in_path: input?.in_path !== false,
    in_daily: input?.in_daily !== false,
    daily_gems: Number.isFinite(+input?.daily_gems) ? Math.max(0, Math.round(+input.daily_gems)) : DEFAULT_VPATIENT.daily_gems,
    award_xp: input?.award_xp !== false,
    default_xp_max: Number.isFinite(+input?.default_xp_max) ? Math.max(0, Math.round(+input.default_xp_max)) : DEFAULT_VPATIENT.default_xp_max,
  };
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(KEY, JSON.stringify(cfg));
  persistNow();
  return cfg;
}

/* Whether the feature is live at all (feature flag AND admin switch). */
export function vpatientLive() {
  return isEnabled("virtual_patient") && getVpatientConfig().enabled;
}

/* Access check for a given learner profile. Returns { ok, reason }.
   reason ∈ "off" | "premium" | null(ok). Admins/teachers always allowed for QA. */
export function vpatientAccess(profile, role) {
  const cfg = getVpatientConfig();
  if (!isEnabled("virtual_patient") || !cfg.enabled) return { ok: false, reason: "off", cfg };
  if (role === "admin" || role === "teacher") return { ok: true, reason: null, cfg };
  if (cfg.premium_only && !(profile?.premium_effective ?? profile?.premium)) {
    return { ok: false, reason: "premium", cfg };
  }
  return { ok: true, reason: null, cfg };
}

/* The list of cases a learner can play (active cases, lightweight fields). */
export function playableCases(lang = "fa", userId = null) {
  const reserved = liveExamCaseIdSet();
  const rows = db.prepare("SELECT id, difficulty, data_json FROM cases WHERE active=1 ORDER BY id").all()
    .filter((r) => !reserved.has(r.id) && isLearnContent(r.data_json));
  const getBest = userId ? db.prepare("SELECT MAX(score) best FROM attempts WHERE user_id=? AND case_id=?") : null;
  return rows.map((r) => {
    let d = {};
    try { d = JSON.parse(r.data_json); } catch { d = {}; }
    const pick = (k) => (lang === "fa" ? (d[`${k}_fa`] || d[`${k}_en`]) : (d[`${k}_en`] || d[`${k}_fa`]));
    const best = getBest ? (getBest.get(userId, r.id)?.best ?? null) : null;
    return {
      id: r.id,
      difficulty: r.difficulty || "medium",
      // Learners never see the internal title (it often names the diagnosis);
      // the chief complaint is the headline. Staff use GET /cases instead.
      title: "",
      specialty: pick("specialty") || "",
      chief: pick("chief") || pick("chief_complaint") || "",
      age: d.age ?? null,
      sex: d.sex || null,
      best,
    };
  });
}

/* Deterministic "case of the day": rotates by day so everyone gets the same
   one, and it changes daily. Returns a case id or null if none exist. */
export function caseOfTheDay() {
  const reserved = liveExamCaseIdSet();
  const ids = db.prepare("SELECT id, data_json FROM cases WHERE active=1 ORDER BY id").all()
    .filter((r) => !reserved.has(r.id) && isLearnContent(r.data_json))
    .map((r) => r.id);
  if (!ids.length) return null;
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) >>> 0;
  return ids[h % ids.length];
}

/* Award ranking XP for a completed virtual-patient case.

   XP = round(score% × caseXpMax).  The auto-evaluator ("the AI examiner") is the
   `score` produced by evaluate(); the admin controls the ceiling per case.

   Anti-farming BEST-SCORE policy: we track each learner's best score per case in
   the settings table. A learner only gains the DELTA of XP above what their
   previous best already granted — so replaying a case can raise their standing
   if they do better, but never lets them grind unlimited XP from one case.

   Returns { awarded, xpMax, best, prevBest, alreadyMaxed }.
   Called only for learners who passed the vpatient access gate. */
export function awardVpatientXp(userId, caseData, scorePct) {
  const cfg = getVpatientConfig();
  if (!cfg.award_xp) return { awarded: 0, xpMax: 0, best: scorePct, prevBest: 0, alreadyMaxed: false };
  const xpMax = caseXpMax(caseData);
  const pct = Math.max(0, Math.min(100, Math.round(Number(scorePct) || 0)));
  const caseId = caseData.id;

  const key = `vp_best_${userId}_${caseId}`;
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key);
  let rec = null; try { rec = row ? JSON.parse(row.value) : null; } catch { rec = null; }
  const prevBest = rec?.best || 0;

  // XP already granted from this case = prevBest% of the cap.
  const prevXp = Math.round((prevBest / 100) * xpMax);
  const targetXp = Math.round((pct / 100) * xpMax);
  const delta = Math.max(0, targetXp - prevXp);   // never negative, never double-counts

  const newBest = Math.max(prevBest, pct);
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(key, JSON.stringify({ best: newBest, xpMax, updated: new Date().toISOString() }));
  persistNow();

  if (delta > 0) {
    // award through the standard XP pipeline so ranking, tiers, leagues all update
    try { awardXp(userId, delta, "vpatient", null); }
    catch { /* best-effort: the best score is already recorded */ }
  }
  return { awarded: delta, xpMax, best: newBest, prevBest, alreadyMaxed: pct <= prevBest };
}

/* ============================================================================
   SEPARATE AI config + prompts for the competitive virtual patient.
   The university side uses settings["ai"] + the `prompts` table. The competitive
   side gets its OWN, independent config so an admin can (for example) point it at
   a cheaper model or write learner-friendly patient prompts — WITHOUT touching
   the university exam behaviour.

   Fallback rule (so it works out-of-the-box): any field the admin leaves EMPTY
   falls back to the shared university value. This keeps the feature working the
   moment it's enabled, while allowing full independent overrides.
   ========================================================================== */

const AI_KEY = "ai_vpatient";
const PROMPTS_KEY = "prompts_vpatient";

const PROMPT_KEYS = [
  "patient_fa", "patient_en", "patient_rules_fa", "patient_rules_en",
  "labresult_rules_fa", "labresult_rules_en", "lab_normal_fa", "lab_normal_en",
  "evaluator_fa", "evaluator_en", "micro_fa", "micro_en",
];

function readJson(key, fallback) {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key);
  try { return row ? JSON.parse(row.value) : fallback; } catch { return fallback; }
}

/* The RAW separate AI config (what the admin typed; may have empty fields). */
export function getVpatientAiRaw() {
  const c = readJson(AI_KEY, {}) || {};
  return { ...routingSettings(c), provider: c.provider || "", model: c.model || "", apiKey: c.apiKey || "", baseUrl: c.baseUrl || "", connected: !!c.connected };
}

/* The EFFECTIVE AI config used at runtime: separate config, with each empty
   field falling back to the shared university `ai` setting. */
export function getVpatientAiEffective() {
  const sep = getVpatientAiRaw();
  const uni = readJson("ai", {}) || {};
  if (sep.routingEnabled) return resolveAiConfig(sep);
  if (!sep.provider && !sep.model && !sep.apiKey && !sep.baseUrl && uni.routingEnabled) return resolveAiConfig(uni);
  const merged = {
    provider: sep.provider || uni.provider || "",
    model: sep.model || uni.model || "",
    apiKey: sep.apiKey || uni.apiKey || "",
    baseUrl: sep.baseUrl || uni.baseUrl || "",
  };
  // Env vars (AI_API_KEY / AI_PROVIDER / …) fill any field still empty, so a
  // key added after first seed is live on the next VP turn without re-seeding.
  return resolveAiConfig(merged);
}

export function saveVpatientAi(input) {
  const prev = getVpatientAiRaw();
  const keepKey = !input?.clearApiKey && !String(input?.apiKey || "").trim();
  const cfg = {
    ...routingSettings(input, prev),
    provider: String(input?.provider || "").trim(),
    model: String(input?.model || "").trim(),
    apiKey: keepKey ? String(prev.apiKey || "").trim() : String(input?.apiKey || "").trim(),
    baseUrl: String(input?.baseUrl || "").trim(),
    connected: false,
  };
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(AI_KEY, JSON.stringify(cfg));
  persistNow();
  return cfg;
}

export function setVpatientAiConnected(ok) {
  const cur = getVpatientAiRaw();
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(AI_KEY, JSON.stringify({ ...cur, connected: !!ok }));
  persistNow();
}

/* RAW separate prompts (admin-typed; may be partial/empty). */
export function getVpatientPromptsRaw() {
  const p = readJson(PROMPTS_KEY, {}) || {};
  const out = {};
  for (const k of PROMPT_KEYS) out[k] = typeof p[k] === "string" ? p[k] : "";
  return out;
}

/* EFFECTIVE prompts: separate value if non-empty, else the shared university
   prompt (from the `prompts` table). Returns a flat {key: value} map like
   loadPrompts() so the engine can consume it directly. */
export function getVpatientPromptsEffective() {
  const sep = readJson(PROMPTS_KEY, {}) || {};
  const uniRows = db.prepare("SELECT key, value FROM prompts").all();
  const uni = {}; uniRows.forEach((r) => (uni[r.key] = r.value));
  const out = { ...uni };
  for (const k of PROMPT_KEYS) {
    if (typeof sep[k] === "string" && sep[k].trim() !== "") out[k] = sep[k];
  }
  return out;
}

export function saveVpatientPrompts(input) {
  const clean = {};
  for (const k of PROMPT_KEYS) clean[k] = typeof input?.[k] === "string" ? input[k] : "";
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(PROMPTS_KEY, JSON.stringify(clean));
  persistNow();
  return clean;
}
