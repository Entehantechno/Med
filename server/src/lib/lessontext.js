/* lessontext.js — keep answer keys and micro-lessons self-contained.
 *
 * Questions are shuffled every attempt, so any phrase that says "see the
 * previous question" or "as in Q12" is wrong on screen. We strip those
 * pointers and leave the rest of the teaching text intact. Also collapses
 * a lead paragraph that merely repeats the golden tip.
 */

const FA_CROSS = [
  /این\s+سؤال\s+همان\s+مفهوم\s+قبلی[^.。!؟\n]*/g,
  /همان\s+مفهوم\s+قبلی\s+را[^.。!؟\n]*/g,
  /مانند\s+سؤال\s+(قبلی|قبل|بالا|\d+)[^.。!؟\n]*/g,
  /مانند\s+سوال\s+(قبلی|قبل|بالا|\d+)[^.。!؟\n]*/g,
  /رجوع\s+کنید\s+به\s+سؤال\s+\d+[^.。!؟\n]*/g,
  /ر\.?\s*ک\.?\s*سؤال\s+\d+[^.。!؟\n]*/g,
  /در\s+سؤال\s+(قبلی|قبل|\d+)\s+[^.。!؟\n]*/g,
  /در\s+سوال\s+(قبلی|قبل|\d+)\s+[^.。!؟\n]*/g,
  /سؤال\s+\d+\s+را\s+ببینید[^.。!؟\n]*/g,
  /سوال\s+\d+\s+را\s+ببینید[^.。!؟\n]*/g,
  /\(?\s*ن\.?\s*ک\.?\s*سؤال\s+\d+\s*\)?/g,
];

const EN_CROSS = [
  /\bsee\s+(the\s+)?(previous|prior|above)\s+question\b[^.!?\n]*/gi,
  /\bas\s+in\s+(the\s+)?(previous|prior)\s+question\b[^.!?\n]*/gi,
  /\bas\s+in\s+Q\.?\s*\d+\b[^.!?\n]*/gi,
  /\b(see|cf\.?|refer\s+to)\s+Q\.?\s*\d+\b[^.!?\n]*/gi,
  /\bthis\s+question\s+restates\s+the\s+previous\s+(one|concept)\b[^.!?\n]*/gi,
  /\bsame\s+concept\s+as\s+(the\s+)?previous\s+question\b[^.!?\n]*/gi,
];

function tidy(s) {
  return String(s || "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[،,;؛:\s]+/, "")
    .replace(/\s+([.。!؟])/g, "$1")
    .trim();
}

export function stripCrossRefs(text) {
  if (!text) return "";
  let s = String(text);
  for (const re of FA_CROSS) s = s.replace(re, " ");
  for (const re of EN_CROSS) s = s.replace(re, " ");
  return tidy(s);
}

function normCmp(s) {
  return String(s || "")
    .replace(/\*\*/g, "")
    .replace(/[‌‍]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** If lead is the same as (or a prefix of) the golden tip, drop the lead. */
export function dedupeGolden(lead, golden) {
  const L = String(lead || "").trim();
  const G = String(golden || "").trim();
  if (!L || !G) return { lead: L, golden: G };
  const a = normCmp(L);
  const b = normCmp(G);
  if (!a || !b) return { lead: L, golden: G };
  if (a === b) return { lead: "", golden: G };
  if (a.includes(b) && a.length - b.length < 24) return { lead: "", golden: G };
  if (b.includes(a) && b.length - a.length < 40) return { lead: "", golden: G };
  return { lead: L, golden: G };
}

export function cleanMicroFields(m = {}) {
  const out = { ...m };
  for (const k of ["lead_fa", "lead_en", "golden_fa", "golden_en", "source_fa", "source_en"]) {
    if (out[k]) out[k] = stripCrossRefs(out[k]);
  }
  const fa = dedupeGolden(out.lead_fa, out.golden_fa);
  const en = dedupeGolden(out.lead_en, out.golden_en);
  out.lead_fa = fa.lead; out.golden_fa = fa.golden;
  out.lead_en = en.lead; out.golden_en = en.golden;
  for (const k of ["points_fa", "points_en", "options_fa", "options_en"]) {
    if (Array.isArray(out[k])) out[k] = out[k].map((p) => stripCrossRefs(p)).filter(Boolean);
  }
  return out;
}

const MONTH_FA = {
  "01": "فروردین", "02": "اردیبهشت", "03": "خرداد", "04": "تیر",
  "05": "مرداد", "06": "شهریور", "07": "مهر", "08": "آبان",
  "09": "آذر", "10": "دی", "11": "بهمن", "12": "اسفند",
  فروردین: "فروردین", اردیبهشت: "اردیبهشت", خرداد: "خرداد", تیر: "تیر",
  مرداد: "مرداد", شهریور: "شهریور", مهر: "مهر", آبان: "آبان",
  آذر: "آذر", دی: "دی", بهمن: "بهمن", اسفند: "اسفند",
};
const MONTH_EN = {
  فروردین: "Farvardin", اردیبهشت: "Ordibehesht", خرداد: "Khordad", تیر: "Tir",
  مرداد: "Mordad", شهریور: "Shahrivar", مهر: "Mehr", آبان: "Aban",
  آذر: "Azar", دی: "Dey", بهمن: "Bahman", اسفند: "Esfand",
};

function toFaDigits(s) {
  return String(s ?? "").replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
}

export function examSourceLabel(d = {}, lang = "fa") {
  const sm = d.source_meta || {};
  if (lang === "en" && sm.label_en) return sm.label_en;
  if (lang !== "en" && sm.label_fa) return sm.label_fa;
  const monthRaw = sm.month || sm.month_en || "";
  const monthFa = MONTH_FA[monthRaw] || monthRaw;
  const monthEn = sm.month_en || MONTH_EN[monthFa] || monthRaw;
  const year = sm.year || "";
  // Question "passport": exam type + month + year, e.g. «پره‌انترنی شهریور ۱۳۹۹»
  // / "Pre-internship · Shahrivar 1399". Residency questions say so.
  const typeRaw = String(sm.exam_type || "");
  const isResidency = /دستیار|resid/i.test(typeRaw);
  const typeFa = isResidency ? "دستیاری" : "پره‌انترنی";
  const typeEn = isResidency ? "Residency" : "Pre-internship";
  if (!year && !monthFa) {
    // still identify the exam type so the learner knows where it came from
    return sm.kind === "past_exam_import" ? (lang === "en" ? `${typeEn} exam` : `آزمون ${typeFa}`) : "";
  }
  if (lang === "en") {
    const yearEn = String(year).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
    const when = [monthEn, yearEn].filter(Boolean).join(" ");
    return `${typeEn} · ${when}`;
  }
  const when = [monthFa, year ? toFaDigits(year) : ""].filter(Boolean).join(" ");
  return `${typeFa} ${when}`;
}

export function cardTopicSlug(d = {}, fallback = "") {
  return d.topic || d.source_meta?.subject_track_slug || fallback || "";
}
