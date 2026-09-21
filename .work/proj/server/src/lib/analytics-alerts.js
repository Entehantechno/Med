/* analytics-alerts.js — Automatic health alerts for the admin dashboard.
   Compares current KPIs against admin-editable thresholds and returns a list of
   warnings (with severity) so the admin is proactively told when something
   drops — e.g. stickiness below target, CTR too low, ad frequency too high,
   retention weak. Deterministic; thresholds live in settings "analytics_alerts". */
import { getSetting } from "../routes/content.js";
import { siteAnalytics } from "./site-analytics.js";
import { adAnalytics } from "./ad-analytics.js";
import { getAdsMaster } from "./ads-control.js";

// Sensible research-backed defaults (2026 benchmarks). All editable in admin.
export function getAlertThresholds() {
  const d = {
    stickiness_min: 20,      // DAU/MAU % — good is 20%+
    retention_d1_min: 12,    // education apps ~14-15% D1
    retention_d30_min: 2,    // education apps ~2-3% D30
    premium_conv_min: 1,     // % of learners on premium (soft floor)
    ctr_min: 0.5,            // ad CTR % floor
    frequency_max: 3,        // ad fatigue above ~3 impressions/user
    fill_rate_min: 60,       // % served/requested
  };
  return { ...d, ...(getSetting("analytics_alerts", {}) || {}) };
}

/* Build the current alert list. Each: { id, severity: 'warn'|'info', metric,
   value, threshold, fa, en }. Only fires alerts that are actionable given the
   data we have (e.g. ad alerts only when the ads master switch is ON). */
export function computeAlerts(lang = "fa") {
  const t = getAlertThresholds();
  const s = siteAnalytics();
  const alerts = [];
  const add = (id, severity, fa, en, extra = {}) => alerts.push({ id, severity, fa, en, ...extra });

  // --- site KPIs ---
  if (s.active.mau > 0 && s.active.stickiness < t.stickiness_min)
    add("stickiness", "warn",
      `چسبندگی (DAU/MAU) ${s.active.stickiness}٪ است و زیر هدف ${t.stickiness_min}٪ — کاربران کمتر برمی‌گردند.`,
      `Stickiness ${s.active.stickiness}% is below target ${t.stickiness_min}% — users return less often.`,
      { metric: "stickiness", value: s.active.stickiness, threshold: t.stickiness_min });

  if (s.retention.d1 != null && s.retention.d1 < t.retention_d1_min)
    add("retention_d1", "warn",
      `ماندگاری روز ۱ برابر ${s.retention.d1}٪ است و زیر هدف ${t.retention_d1_min}٪ — آنبوردینگ را تقویت کنید.`,
      `Day-1 retention ${s.retention.d1}% is below target ${t.retention_d1_min}% — improve onboarding.`,
      { metric: "retention_d1", value: s.retention.d1, threshold: t.retention_d1_min });

  if (s.retention.d30 != null && s.retention.d30 < t.retention_d30_min)
    add("retention_d30", "warn",
      `ماندگاری روز ۳۰ برابر ${s.retention.d30}٪ است و زیر هدف ${t.retention_d30_min}٪ — ارزش بلندمدت را بیشتر کنید.`,
      `Day-30 retention ${s.retention.d30}% is below target ${t.retention_d30_min}% — boost long-term value.`,
      { metric: "retention_d30", value: s.retention.d30, threshold: t.retention_d30_min });

  if (s.premium.learners >= 20 && s.premium.convPct < t.premium_conv_min)
    add("premium_conv", "info",
      `نرخ تبدیل پریمیوم ${s.premium.convPct}٪ است و زیر هدف ${t.premium_conv_min}٪.`,
      `Premium conversion ${s.premium.convPct}% is below target ${t.premium_conv_min}%.`,
      { metric: "premium_conv", value: s.premium.convPct, threshold: t.premium_conv_min });

  // --- ad KPIs (only when ads are actually running) ---
  if (getAdsMaster().enabled) {
    const a = adAnalytics(); const T = a.totals;
    if (T.impressions >= 100 && T.ctr < t.ctr_min)
      add("ctr", "warn",
        `نرخ کلیک تبلیغات ${T.ctr}٪ است و زیر هدف ${t.ctr_min}٪ — خلاقیت/هدف‌گیری تبلیغ را بهبود دهید.`,
        `Ad CTR ${T.ctr}% is below target ${t.ctr_min}% — improve creative/targeting.`,
        { metric: "ctr", value: T.ctr, threshold: t.ctr_min });
    if (T.frequency > t.frequency_max)
      add("frequency", "warn",
        `فراوانی نمایش تبلیغ ${T.frequency} است و بالای سقف ${t.frequency_max} — خطر خستگی کاربر (سقف روزانه بگذارید).`,
        `Ad frequency ${T.frequency} exceeds ${t.frequency_max} — user fatigue risk (set daily caps).`,
        { metric: "frequency", value: T.frequency, threshold: t.frequency_max });
    if (T.fillRate != null && T.fillRate < t.fill_rate_min)
      add("fill_rate", "info",
        `نرخ پرشدن ${T.fillRate}٪ است و زیر هدف ${t.fill_rate_min}٪ — تبلیغ کافی برای همهٔ جایگاه‌ها ندارید.`,
        `Fill rate ${T.fillRate}% is below target ${t.fill_rate_min}% — not enough ads for all slots.`,
        { metric: "fill_rate", value: T.fillRate, threshold: t.fill_rate_min });
  }

  return { thresholds: t, alerts, count: alerts.length };
}
