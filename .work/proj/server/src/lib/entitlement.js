/* entitlement.js — single source of truth for paid access.

   Billing (Zarinpal / mock / group codes / admin) emits facts.
   This module is the only place that writes premium=1 / premium_until, so a
   paying user cannot be left "paid but not upgraded", and a lifetime grant
   cannot be silently downgraded.

   Research (SaaS 2025–2026): entitlements live in the app DB, handlers are
   idempotent, webhook/callback retries must not double-extend, and a reconcile
   path recovers when the user closes the bank page before the redirect. */
import { db, persistNow } from "../db.js";
import { getProfile, maxHearts, stackPremiumUntil } from "./gamify.js";

/** SQLite expression that compares JS ISO timestamps with datetime('now'). */
export function premiumUntilExpr(col = "premium_until") {
  return `datetime(substr(replace(replace(COALESCE(${col},''),'T',' '),'Z',''),1,19))`;
}
export function premiumActiveWhere(alias = "") {
  const p = alias ? `${alias}.premium` : "premium";
  const u = alias ? `${alias}.premium_until` : "premium_until";
  return `${p}=1 AND (${u} IS NULL OR ${premiumUntilExpr(u)} > datetime('now'))`;
}
export const PREMIUM_ACTIVE_SQL = premiumActiveWhere();
export const PREMIUM_EXPIRED_SQL = `premium=1 AND premium_until IS NOT NULL AND ${premiumUntilExpr()} <= datetime('now')`;

export function daysLeftPremium(until) {
  if (!until) return null;
  const ms = new Date(until).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return ms <= 0 ? 0 : Math.ceil(ms / 86400000);
}

export function isLifetimePremium(p) {
  return !!(p && p.premium && !p.premium_until);
}

function ensureGrantTable() {
  db.exec(`CREATE TABLE IF NOT EXISTS premium_grants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    days INTEGER,
    until TEXT,
    kind TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
}

/** Stack N days (or keep lifetime). Always leaves premium=1 and full hearts. */
export function applyPremiumDays(userId, days, { source = "grant", persist = true } = {}) {
  const p = getProfile(userId);
  const until = stackPremiumUntil(p, days);
  if (until === null) {
    db.prepare("UPDATE learner_profiles SET premium=1, hearts=? WHERE user_id=?").run(maxHearts(), userId);
  } else {
    db.prepare("UPDATE learner_profiles SET premium=1, premium_until=?, hearts=? WHERE user_id=?")
      .run(until, maxHearts(), userId);
  }
  try {
    ensureGrantTable();
    db.prepare("INSERT INTO premium_grants (user_id, days, until, kind) VALUES (?,?,?,?)")
      .run(userId, Math.max(1, Number(days) || 1), until, source);
  } catch { /* audit is best-effort */ }
  if (persist) persistNow();
  return getProfile(userId);
}

/** Mark a transaction paid exactly once. Returns true if THIS call claimed it. */
export function claimTransactionPaid(txId, refId) {
  const r = db.prepare(
    "UPDATE transactions SET status='paid', ref_id=?, paid_at=datetime('now') WHERE id=? AND status != 'paid'"
  ).run(String(refId || ""), txId);
  return (r.changes || 0) > 0;
}

/**
 * Idempotent fulfill: claim the tx, then grant days. A replay of a paid
 * authority never stacks extra time.
 */
export function fulfillPaidSubscription(tx, { refId, days }) {
  const claimed = claimTransactionPaid(tx.id, refId);
  if (!claimed) return { ok: true, already: true, profile: getProfile(tx.user_id) };
  const profile = applyPremiumDays(tx.user_id, days, { source: "payment" });
  persistNow();
  return { ok: true, already: false, profile };
}

/** Enroll the buyer in a paid course. Safe to replay (INSERT OR IGNORE). */
export function fulfillCoursePurchase(tx, { refId } = {}) {
  if (!String(tx?.plan || "").startsWith("course:")) return { ok: false, error: "not_course" };
  claimTransactionPaid(tx.id, refId);
  const courseId = Number(String(tx.plan).split(":")[1]);
  if (courseId) {
    db.prepare("INSERT OR IGNORE INTO course_enrollments (user_id, course_id) VALUES (?,?)")
      .run(tx.user_id, courseId);
  }
  persistNow();
  return { ok: true, courseId };
}

/** Dispatch a verified payment to the right product. Never default a course/group tx to a monthly Plus grant. */
export function fulfillVerifiedTransaction(tx, v, { plusDays } = {}) {
  const plan = String(tx?.plan || "");
  if (plan.startsWith("group:")) {
    // Must claim the tx. Leaving it "pending" after a real bank success lets a
    // later Status=NOK cancel it, hides the sale from revenue, and makes every
    // /pay/reconcile look like a fresh recovery.
    const claimed = claimTransactionPaid(tx.id, v?.refId);
    return { ok: true, kind: "group", already: !claimed, orderId: parseInt(plan.split(":")[1], 10) || 0 };
  }
  if (plan.startsWith("course:")) {
    return { ok: true, kind: "course", ...fulfillCoursePurchase(tx, { refId: v?.refId }) };
  }
  if (plan === "monthly" || plan === "yearly") {
    const days = Number(plusDays) > 0 ? Number(plusDays) : (plan === "yearly" ? 365 : 30);
    const out = fulfillPaidSubscription(tx, { refId: v?.refId, days });
    return { ok: true, kind: "plus", ...out };
  }
  return { ok: false, kind: "unknown", error: "unknown_plan" };
}

/** One renewal nudge when Plus has 1–3 days left. Called from /profile. */
export function maybeNudgePremiumRenewal(p) {
  if (!p?.user_id || !p.premium || !p.premium_until) return;
  const left = daysLeftPremium(p.premium_until);
  if (!(left >= 1 && left <= 3)) return;
  try {
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
    const already = db.prepare(
      "SELECT 1 FROM notifications WHERE user_id=? AND kind='premium' AND date(created_at,'+3 hours','+30 minutes')=date(?)"
    ).get(p.user_id, day);
    if (already) return;
    import("./notify.js").then(({ notify }) => notify(p.user_id, {
      kind: "premium", icon: "crown", link: "premium",
      title_fa: "اشتراک پلاس رو به پایان است",
      title_en: "Your Plus plan is ending soon",
      body_fa: `فقط ${left} روز مانده. تمدید کن تا بانک سؤال و قلب نامحدود قطع نشود.`,
      body_en: `Only ${left} day(s) left. Renew so the full bank and unlimited hearts stay on.`,
    })).catch(() => {});
  } catch { /* never block the learner */ }
}

export function notifyPremiumActivated(userId) {
  try {
    // lazy import so billing tests that never touch notify still load
    import("./notify.js").then(({ notify }) => notify(userId, {
      kind: "system", icon: "crown", link: "premium",
      title_fa: "اشتراک پلاس فعال شد",
      title_en: "Plus is now active",
      body_fa: "بانک کامل سؤالات، خلاصهٔ فصل‌ها، قلب نامحدود و بدون تبلیغات برای شما باز است.",
      body_en: "Full question bank, chapter summaries, unlimited hearts, and no ads are unlocked.",
    })).catch(() => {});
  } catch { /* never block checkout */ }
}
