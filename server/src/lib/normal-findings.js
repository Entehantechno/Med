/* normal-findings.js — deterministic normal results for what a student asks for
   but the case chart does not record (teaching default, AI-free by cost rule).

   Rule: a requested exam system, lab or imaging study that is missing from the
   case is reported as NORMAL. Labs use a normal-range table (a value inside the
   range is shown); anything without a table entry is reported as normal in words.
   Authors who need a different finding must record it in the case. */

const EXAM_NORMAL = {
  vitals:  { fa: "علائم حیاتی طبیعی", en: "vital signs normal" },
  general: { fa: "ظاهر عمومی طبیعی؛ بدون رنگ‌پریدگی، زردی یا ادم", en: "general appearance normal; no pallor, jaundice or edema" },
  heent:   { fa: "سر و گردن طبیعی؛ بدون لنفادنوپاتی یا بزرگی تیروئید", en: "head & neck normal; no lymphadenopathy or thyroid enlargement" },
  chest:   { fa: "ریه‌ها: تنفس وزیکولر طبیعی، بدون رال، ویزینگ یا کاهش صدا", en: "lungs: normal vesicular breath sounds; no rales, wheeze or dullness" },
  heart:   { fa: "قلب: S1 و S2 طبیعی و منظم، بدون سوفل", en: "heart: normal S1 and S2, regular, no murmur" },
  abdomen: { fa: "شکم: نرم، غیردردناک، بدون توده یا بزرگی کبد و طحال", en: "abdomen: soft, non-tender, no mass, no hepatosplenomegaly" },
  neuro:   { fa: "عصبی: هوشیار، قدرت و حس طبیعی، رفلکس‌ها طبیعی", en: "neuro: alert, normal power and sensation, normal reflexes" },
  msk:     { fa: "اسکلتی-عضلانی: بدون تورم، محدودیت حرکتی یا ضعف", en: "musculoskeletal: no swelling, restricted movement or weakness" },
  skin:    { fa: "پوست: بدون ضایعه، کبودی یا راش", en: "skin: no lesions, bruising or rash" },
  genito:  { fa: "معاینهٔ ژنیتال/رکتال: طبیعی", en: "genitourinary/rectal exam: normal" },
  psych:   { fa: "وضعیت روانی: هوشیار، همکاری‌کننده، بدون علامت حاد", en: "mental status: alert, cooperative, no acute features" },
};

export function normalExamLine(systemKeys, lang = "fa") {
  const parts = (systemKeys || []).map((k) => EXAM_NORMAL[k]).filter(Boolean).map((x) => (lang === "fa" ? x.fa : x.en));
  return parts.join(lang === "fa" ? "؛ " : "; ");
}

/* Normal ranges (adult, common reference values; units as typically reported).
   `aliases` are matched against the student's query after lower-casing. */
const LAB_RANGES = [
  { aliases: ["cbc", "wbc", "شمارش کامل"], fa: "WBC", en: "WBC", unit: "×10⁹/L", low: 4.0, high: 11.0, dp: 1 },
  { aliases: ["hb", "hgb", "هموگلوبین"], fa: "هموگلوبین", en: "Hemoglobin", unit: "g/dL", low: 12.0, high: 16.0, dp: 1 },
  { aliases: ["plt", "platelet", "پلاکت"], fa: "پلاکت", en: "Platelets", unit: "×10⁹/L", low: 150, high: 400, dp: 0 },
  { aliases: ["na", "sodium", "سدیم"], fa: "سدیم", en: "Sodium", unit: "mmol/L", low: 135, high: 145, dp: 0 },
  { aliases: ["k", "potassium", "پتاسیم"], fa: "پتاسیم", en: "Potassium", unit: "mmol/L", low: 3.5, high: 5.0, dp: 1 },
  { aliases: ["cl", "chloride", "کلر"], fa: "کلر", en: "Chloride", unit: "mmol/L", low: 98, high: 107, dp: 0 },
  { aliases: ["cr", "creatinine", "کراتینین"], fa: "کراتینین", en: "Creatinine", unit: "mg/dL", low: 0.6, high: 1.2, dp: 1 },
  { aliases: ["bun", "اوره"], fa: "BUN", en: "BUN", unit: "mg/dL", low: 7, high: 20, dp: 0 },
  { aliases: ["fbs", "glucose", "قند"], fa: "قند خون ناشتا", en: "Fasting glucose", unit: "mg/dL", low: 70, high: 99, dp: 0 },
  { aliases: ["hba1c", "a1c"], fa: "HbA1c", en: "HbA1c", unit: "%", low: 4.0, high: 5.6, dp: 1 },
  { aliases: ["ast", "sgot"], fa: "AST", en: "AST", unit: "U/L", low: 10, high: 40, dp: 0 },
  { aliases: ["alt", "sgpt"], fa: "ALT", en: "ALT", unit: "U/L", low: 7, high: 56, dp: 0 },
  { aliases: ["bili", "bilirubin", "بیلی"], fa: "بیلی‌روبین توتال", en: "Total bilirubin", unit: "mg/dL", low: 0.1, high: 1.2, dp: 1 },
  { aliases: ["alp", "alkaline"], fa: "ALP", en: "ALP", unit: "U/L", low: 44, high: 147, dp: 0 },
  { aliases: ["albumin", "آلبومین"], fa: "آلبومین", en: "Albumin", unit: "g/dL", low: 3.5, high: 5.0, dp: 1 },
  { aliases: ["ca", "calcium", "کلسیم"], fa: "کلسیم", en: "Calcium", unit: "mg/dL", low: 8.5, high: 10.5, dp: 1 },
  { aliases: ["tsh"], fa: "TSH", en: "TSH", unit: "mIU/L", low: 0.4, high: 4.0, dp: 1 },
  { aliases: ["inr"], fa: "INR", en: "INR", unit: "", low: 0.9, high: 1.1, dp: 2 },
  { aliases: ["ptt", "aptt"], fa: "PTT", en: "aPTT", unit: "sec", low: 25, high: 35, dp: 0 },
  { aliases: ["esr", "sedimentation", "سرعت رسوب"], fa: "ESR", en: "ESR", unit: "mm/h", low: 0, high: 20, dp: 0 },
  { aliases: ["crp"], fa: "CRP", en: "CRP", unit: "mg/L", low: 0, high: 5, dp: 1 },
  { aliases: ["troponin", "تروپونین", "trop"], fa: "تروپونین", en: "Troponin", unit: "ng/mL", low: 0, high: 0.04, dp: 3 },
  { aliases: ["ck-mb", "ckmb"], fa: "CK-MB", en: "CK-MB", unit: "ng/mL", low: 0, high: 5, dp: 1 },
  { aliases: ["ferritin", "فریتین"], fa: "فریتین", en: "Ferritin", unit: "ng/mL", low: 30, high: 300, dp: 0 },
  { aliases: ["lactate", "لاکتات"], fa: "لاکتات", en: "Lactate", unit: "mmol/L", low: 0.5, high: 2.0, dp: 1 },
];

function labRange(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return null;
  // Short aliases (k, na, cr, ast...) must match exactly; longer ones may appear inside the query.
  return LAB_RANGES.find((r) => r.aliases.some((a) => q === a || (a.length > 4 && q.includes(a)))) || null;
}

/* A plausible normal value inside the range (mid-point), formatted to the table precision. */
export function normalLabText(query, lang = "fa") {
  const r = labRange(query);
  if (!r) return null;
  const mid = (r.low + r.high) / 2;
  const val = r.dp === 0 ? String(Math.round(mid)) : mid.toFixed(r.dp);
  const range = `${r.low}–${r.high}`;
  const name = lang === "fa" ? r.fa : r.en;
  return lang === "fa"
    ? `${name}: ${val} ${r.unit} (در محدوده‌ی نرمال: ${range})`
    : `${name}: ${val} ${r.unit} (within normal range: ${range})`;
}

export function normalStudyText(query, kind, lang = "fa") {
  const lab = kind === "lab" ? normalLabText(query, lang) : null;
  if (lab) return lang === "fa" ? `📋 نتیجهٔ طبیعی — ${lab}` : `📋 Normal result — ${lab}`;
  if (kind === "lab")
    return lang === "fa"
      ? `📋 ${query}: نتیجه طبیعی و در محدوده‌ی نرمال است.`
      : `📋 ${query}: normal, within the reference range.`;
  return lang === "fa"
    ? `📋 ${query}: گزارش طبیعی؛ بدون یافتهٔ پاتولوژیک.`
    : `📋 ${query}: normal report; no pathological finding.`;
}
