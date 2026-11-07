/* analytics-export.js — CSV + printable-HTML(PDF) exports and alert rules for
   the admin analytics dashboards. Deterministic, no external deps. */
import { siteAnalytics } from "./site-analytics.js";
import { adAnalytics } from "./ad-analytics.js";

const BOM = "\uFEFF";
const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const row = (arr) => arr.map(esc).join(",");

/* ---- SITE analytics CSV (KPIs + daily trends) ---- */
export function siteAnalyticsCsv(lang = "fa") {
  const fa = lang === "fa";
  const a = siteAnalytics();
  const lines = [];
  const L = (f, e) => (fa ? f : e);
  lines.push(row([L("شاخص", "metric"), L("مقدار", "value")]));
  lines.push(row([L("کاربر فعال روزانه (DAU)", "DAU"), a.active.dau]));
  lines.push(row([L("کاربر فعال هفتگی (WAU)", "WAU"), a.active.wau]));
  lines.push(row([L("کاربر فعال ماهانه (MAU)", "MAU"), a.active.mau]));
  lines.push(row([L("چسبندگی DAU/MAU (٪)", "Stickiness %"), a.active.stickiness]));
  lines.push(row([L("ماندگاری روز ۱ (٪)", "Retention D1 %"), a.retention.d1 ?? ""]));
  lines.push(row([L("ماندگاری روز ۷ (٪)", "Retention D7 %"), a.retention.d7 ?? ""]));
  lines.push(row([L("ماندگاری روز ۳۰ (٪)", "Retention D30 %"), a.retention.d30 ?? ""]));
  lines.push(row([L("نرخ تبدیل پریمیوم (٪)", "Premium conv %"), a.premium.convPct]));
  lines.push(row([L("کاربران پریمیوم", "Premium users"), a.premium.premium]));
  lines.push(row([L("درس‌های تکمیل‌شده", "Lessons completed"), a.engagement.lessonsCompleted]));
  lines.push(row([L("استریک‌های فعال", "Active streaks"), a.engagement.activeStreaks]));
  lines.push(row([L("میانگین نمرهٔ بیمار مجازی", "Avg VP score"), a.engagement.avgVpScore]));
  lines.push("");
  lines.push(row([L("روزانه — تاریخ", "Daily — date"), L("کاربر فعال", "Active"), L("امتیاز", "XP"), L("آزمون", "Attempts"), L("ثبت‌نام", "Signups")]));
  const sign = Object.fromEntries(a.signupTrend.map((s) => [s.day, s.n]));
  for (const d of a.activityTrend) lines.push(row([d.day, d.active, d.xp, d.attempts, sign[d.day] ?? 0]));
  return BOM + lines.join("\n");
}

/* ---- AD analytics CSV (totals + per-format + top ads) ---- */
export function adAnalyticsCsv(lang = "fa") {
  const fa = lang === "fa";
  const a = adAnalytics(); const T = a.totals; const cur = T.currency || "";
  const L = (f, e) => (fa ? f : e);
  const lines = [];
  lines.push(row([L("شاخص", "metric"), L("مقدار", "value")]));
  lines.push(row([L("نمایش", "Impressions"), T.impressions]));
  lines.push(row([L("کلیک", "Clicks"), T.clicks]));
  lines.push(row([L("نرخ کلیک CTR (٪)", "CTR %"), T.ctr]));
  lines.push(row([L("دسترسی (کاربر یکتا)", "Reach"), T.reach]));
  lines.push(row([L("فراوانی", "Frequency"), T.frequency]));
  lines.push(row([L("نرخ پرشدن (٪)", "Fill rate %"), T.fillRate ?? ""]));
  lines.push(row([L(`درآمد تخمینی (${cur})`, "Est. revenue"), T.estRevenue]));
  lines.push(row([L(`RPM (${cur})`, "RPM"), T.rpm]));
  lines.push(row([L("بازدید جایزه‌دار", "Rewarded views"), T.rewardedViews]));
  lines.push(row([L("جم پرداختی", "Gems paid"), T.gemsPaid]));
  lines.push("");
  lines.push(row([L("فرمت", "Format"), L("نمایش", "Imp"), L("کلیک", "Clk"), L("CTR٪", "CTR%"), L("eCPM", "eCPM"), L("درآمد تخمینی", "Est.rev")]));
  for (const f of a.byFormat) lines.push(row([f.format, f.imp, f.clk, f.ctr, f.ecpm, f.estRevenue]));
  lines.push("");
  lines.push(row([L("برترین تبلیغات — عنوان", "Top ads — title"), L("نمایش", "Imp"), L("کلیک", "Clk"), L("CTR٪", "CTR%")]));
  for (const t of a.topAds) lines.push(row([fa ? t.title_fa : t.title_en, t.imp, t.clk, t.ctr]));
  return BOM + lines.join("\n");
}

/* ---- Printable HTML (opens the browser print dialog → Save as PDF). We ship
   HTML rather than a heavy PDF lib: zero deps, fully styled, RTL-aware. ---- */
function htmlDoc(title, bodyHtml, fa) {
  return `<!doctype html><html dir="${fa ? "rtl" : "ltr"}" lang="${fa ? "fa" : "en"}"><head>
<meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:Tahoma,Vazirmatn,Arial,sans-serif;margin:28px;color:#1a2233;}
  h1{font-size:20px;margin:0 0 4px} .sub{color:#6b7385;font-size:12px;margin-bottom:18px}
  .kpis{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px}
  .kpi{border:1px solid #e2e6ee;border-radius:10px;padding:10px 14px;min-width:120px;text-align:center}
  .kpi .n{font-size:20px;font-weight:800;color:#2f5fd0} .kpi .l{font-size:11px;color:#6b7385}
  table{border-collapse:collapse;width:100%;margin:8px 0 18px;font-size:12px}
  th,td{border:1px solid #e2e6ee;padding:6px 8px;text-align:${fa ? "right" : "left"}}
  th{background:#f4f6fb} h2{font-size:15px;margin:16px 0 6px}
  .noprint{margin:16px 0}
  @media print{.noprint{display:none}}
</style></head><body>
<div class="noprint"><button onclick="window.print()" style="padding:8px 16px;font-size:14px;border-radius:8px;border:0;background:#2f5fd0;color:#fff;cursor:pointer">${fa ? "چاپ / ذخیره PDF" : "Print / Save PDF"}</button></div>
${bodyHtml}
</body></html>`;
}

export function siteAnalyticsHtml(lang = "fa") {
  const fa = lang === "fa"; const a = siteAnalytics();
  const L = (f, e) => (fa ? f : e);
  const kpi = (n, l) => `<div class="kpi"><div class="n">${n}</div><div class="l">${l}</div></div>`;
  const trendRows = a.activityTrend.map((d) => `<tr><td>${d.day}</td><td>${d.active}</td><td>${d.xp}</td><td>${d.attempts}</td></tr>`).join("");
  const body = `
    <h1>${L("گزارش آمار پیشرفتهٔ سایت", "Site analytics report")}</h1>
    <div class="sub">MED School · ${new Date().toLocaleString(fa ? "fa-IR" : "en-US")}</div>
    <div class="kpis">
      ${kpi(a.active.dau, L("کاربر فعال روزانه", "DAU"))}
      ${kpi(a.active.wau, L("کاربر فعال هفتگی", "WAU"))}
      ${kpi(a.active.mau, L("کاربر فعال ماهانه", "MAU"))}
      ${kpi(a.active.stickiness + "%", L("چسبندگی", "Stickiness"))}
      ${kpi((a.retention.d1 ?? "—") + (a.retention.d1 != null ? "%" : ""), L("ماندگاری روز ۱", "Retention D1"))}
      ${kpi((a.retention.d30 ?? "—") + (a.retention.d30 != null ? "%" : ""), L("ماندگاری روز ۳۰", "Retention D30"))}
      ${kpi(a.premium.convPct + "%", L("تبدیل پریمیوم", "Premium conv"))}
      ${kpi(a.engagement.lessonsCompleted, L("درس تکمیل‌شده", "Lessons"))}
    </div>
    <h2>${L("روند فعالیت روزانه", "Daily activity trend")}</h2>
    <table><thead><tr><th>${L("تاریخ", "Date")}</th><th>${L("کاربر فعال", "Active")}</th><th>${L("امتیاز", "XP")}</th><th>${L("آزمون", "Attempts")}</th></tr></thead><tbody>${trendRows}</tbody></table>`;
  return htmlDoc(L("گزارش آمار سایت", "Site analytics"), body, fa);
}

export function adAnalyticsHtml(lang = "fa") {
  const fa = lang === "fa"; const a = adAnalytics(); const T = a.totals; const cur = T.currency || "";
  const L = (f, e) => (fa ? f : e);
  const kpi = (n, l) => `<div class="kpi"><div class="n">${n}</div><div class="l">${l}</div></div>`;
  const fRows = a.byFormat.map((f) => `<tr><td>${f.format}</td><td>${f.imp}</td><td>${f.clk}</td><td>${f.ctr}%</td><td>${f.ecpm}</td><td>${f.estRevenue} ${cur}</td></tr>`).join("");
  const tRows = a.topAds.map((t) => `<tr><td>${fa ? t.title_fa : t.title_en}</td><td>${t.imp}</td><td>${t.clk}</td><td>${t.ctr}%</td></tr>`).join("");
  const body = `
    <h1>${L("گزارش آمار تبلیغات", "Ad analytics report")}</h1>
    <div class="sub">MED School · ${new Date().toLocaleString(fa ? "fa-IR" : "en-US")}</div>
    <div class="kpis">
      ${kpi(T.impressions, L("نمایش", "Impressions"))}
      ${kpi(T.clicks, L("کلیک", "Clicks"))}
      ${kpi(T.ctr + "%", "CTR")}
      ${kpi(T.reach, L("دسترسی", "Reach"))}
      ${kpi(T.frequency, L("فراوانی", "Frequency"))}
      ${kpi((T.fillRate ?? "—") + (T.fillRate != null ? "%" : ""), L("نرخ پرشدن", "Fill rate"))}
      ${kpi(T.estRevenue + " " + cur, L("درآمد تخمینی", "Est. revenue"))}
      ${kpi(T.rpm + " " + cur, "RPM")}
    </div>
    <h2>${L("به تفکیک فرمت", "By format")}</h2>
    <table><thead><tr><th>${L("فرمت", "Format")}</th><th>${L("نمایش", "Imp")}</th><th>${L("کلیک", "Clk")}</th><th>CTR</th><th>eCPM</th><th>${L("درآمد", "Rev")}</th></tr></thead><tbody>${fRows}</tbody></table>
    <h2>${L("برترین تبلیغات", "Top ads")}</h2>
    <table><thead><tr><th>${L("عنوان", "Title")}</th><th>${L("نمایش", "Imp")}</th><th>${L("کلیک", "Clk")}</th><th>CTR</th></tr></thead><tbody>${tRows}</tbody></table>`;
  return htmlDoc(L("گزارش آمار تبلیغات", "Ad analytics"), body, fa);
}
