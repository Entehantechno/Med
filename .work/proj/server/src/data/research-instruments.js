/* ================================================================
   data/research-instruments.js — the three instruments from the study
   protocol, seeded as editable questionnaire templates.

   Source: «پروپوزال بیمار مجازی», Arak University of Medical Sciences —
   "Design, implementation, and evaluation of an AI-based bilingual clinical
   interactive simulator platform for medical trainees and interns".
   Tables 1, 2 and 3 of the protocol, transcribed item by item.

   These are TEMPLATES, not hard-coded logic. They are inserted as ordinary
   questionnaire forms so the admin can edit the wording, disable an item or
   switch the scale — the analysis reads whatever the form actually contains.
   ================================================================ */

/* Table 1 — OSCE checklist: communication skills and history taking.
   12 items, 1 point each; the protocol reports the total out of 10, so the
   raw total is normalised rather than silently capped. */
export const OSCE_CHECKLIST = {
  key: "osce-history-checklist",
  title_fa: "چک‌لیست OSCE — مهارت‌های ارتباطی و شرح‌حال (جدول ۱ پروپوزال)",
  title_en: "OSCE checklist — communication skills & history taking (protocol Table 1)",
  description_fa: "۱۲ معیار، هر مورد ۱ امتیاز. امتیاز کل طبق پروتکل از ۱۰ گزارش می‌شود.",
  description_en: "12 criteria, 1 point each. Total reported out of 10 per the protocol.",
  anonymous: false,           // the expert scores a specific student
  require_after_finish: false,
  scope: "general",
  max: 10,                    // reported scale
  items: [
    "دانشجو خود را به‌عنوان پزشک به بیمار معرفی کرد",
    "دانشجو نام و سن بیمار را از بیمار پرسید",
    "دانشجو سابقهٔ بیماری خاص مورد نظر را پرسید",
    "نحوهٔ پرسش دانشجو واضح، منظم و با زبان ساده و قابل‌فهم برای بیمار بود",
    "دانشجو از سؤال باز استفاده کرد و به بیمار اجازهٔ صحبت آزادانه داد",
    "دانشجو شکایت اصلی را به‌صورت دقیق و کامل پرسید",
    "دانشجو جزئیات شکایت اصلی (زمان شروع، شدت، محل، تشدیدکننده‌ها، تسکین‌دهنده‌ها) را به‌صورت سیستماتیک پرسید",
    "دانشجو سابقهٔ دارویی و آلرژی فعلی را پرسید",
    "دانشجو سابقه‌های خانوادگی بیماری مورد نظر را پرسید",
    "دانشجو مصرف سیگار، الکل و مواد مخدر را پرسید",
    "دانشجو قدم بعدی مورد نظر (آزمایش/معاینه) را برای بیمار توضیح داد",
    "رفتار کلی دانشجو باعث احساس احترام و اطمینان در بیمار شد",
  ].map((fa, i) => ({
    id: `osce${i + 1}`, fa, type: "check", value: 1,
    en: `OSCE item ${i + 1}`,
  })),
};

/* Table 2 — expert rating of the virtual patient and the virtual mentor.
   5 items, Likert 1–5, completed by 5 clinical experts. */
export const EXPERT_LIKERT = {
  key: "expert-likert",
  title_fa: "ارزیابی رفتار بیمار مجازی و بازخورد مربی مجازی (جدول ۲ پروپوزال)",
  title_en: "Expert rating of the virtual patient and virtual mentor (protocol Table 2)",
  description_fa: "۵ معیار، مقیاس لیکرت ۱ تا ۵، توسط خبرگان بالینی تکمیل می‌شود.",
  description_en: "5 criteria, Likert 1–5, completed by clinical experts.",
  anonymous: false,
  require_after_finish: false,
  scope: "general",
  scale: { min: 1, max: 5 },
  items: [
    ["واقع‌گرایی رفتار بیمار مجازی (تعامل متنی)", "Realism of the virtual patient's behaviour (text interaction)"],
    ["پذیرش و واکنش بیمار به پرسش‌های دانشجو", "The patient's receptiveness and reactions to the student's questions"],
    ["دقت و جامعیت بازخورد مربی مجازی", "Accuracy and comprehensiveness of the virtual mentor's feedback"],
    ["مناسب بودن نمره‌دهی در هر مرحلهٔ OSCE", "Appropriateness of the scoring at each OSCE station"],
    ["وضوح و کاربردی بودن درس‌نامهٔ میکرولرنینگ", "Clarity and practical value of the microlearning lesson"],
  ].map(([fa, en], i) => ({ id: `exp${i + 1}`, fa, en, type: "likert", min: 1, max: 5, required: true })),
};

/* Table 3 — student satisfaction. 10 items on a 0–10 Likert scale; item 6 is
   the NPS recommendation question. Collected from the interns at the end of
   the internal-medicine rotation. */
export const STUDENT_SATISFACTION = {
  key: "student-satisfaction-nps",
  title_fa: "پرسشنامهٔ رضایت دانشجویان + NPS (جدول ۳ پروپوزال)",
  title_en: "Student satisfaction questionnaire + NPS (protocol Table 3)",
  description_fa: "۱۰ پرسش، لیکرت ۰ تا ۱۰. پرسش ۶ شاخص NPS است.",
  description_en: "10 questions, Likert 0–10. Question 6 is the NPS item.",
  anonymous: true,            // satisfaction is collected anonymously
  require_after_finish: true,
  scope: "general",
  scale: { min: 0, max: 10 },
  items: [
    ["شبیه‌سازی سیستم چقدر واقع‌گرایانه بود؟", "How realistic was the system's simulation?"],
    ["بازخورد مربی مجازی چقدر دقیق و مفید بود؟", "How accurate and useful was the virtual mentor's feedback?"],
    ["درس‌نامهٔ میکرولرنینگ چقدر به رفع خطاهای شما کمک کرد؟", "How much did the microlearning lesson help correct your errors?"],
    ["استفاده از سیستم چقدر آسان بود؟", "How easy was the system to use?"],
    ["آیا سیستم به بهبود مهارت‌های بالینی شما کمک کرد؟", "Did the system help improve your clinical skills?"],
    ["چقدر احتمال دارد این سیستم را به همکلاسی‌هایتان توصیه کنید؟", "How likely are you to recommend this system to your classmates?"],
    ["پشتیبانی از زبان فارسی/ترکی آذری چقدر رضایت‌بخش بود؟", "How satisfactory was the Persian/Azeri language support?"],
    ["سرعت پاسخ‌دهی سیستم چقدر مناسب بود؟", "How adequate was the system's response speed?"],
    ["آیا سیستم ایمنی بیمار را در آموزش تضمین کرد؟", "Did the system ensure patient safety during training?"],
    ["تجربهٔ کلی شما از سیستم چقدر بود؟", "How was your overall experience with the system?"],
  ].map(([fa, en], i) => ({
    id: `sat${i + 1}`, fa, en, type: "likert", min: 0, max: 10, required: true,
    // The recommendation item is the NPS driver — flagged so the analysis can
    // bucket 0–6 detractors / 7–8 passives / 9–10 promoters.
    nps: i === 5,
  })),
};

export const RESEARCH_INSTRUMENTS = [OSCE_CHECKLIST, EXPERT_LIKERT, STUDENT_SATISFACTION];

/* ---- Scoring helpers used by the analysis and the export ------------------ */

/* Table 1: 12 binary items → reported out of 10. */
export function scoreOsceChecklist(answers = {}, inst = OSCE_CHECKLIST) {
  const items = inst.items || [];
  let raw = 0, answered = 0;
  for (const it of items) {
    const v = answers[it.id];
    if (v == null || v === "") continue;
    answered++;
    if (v === true || v === 1 || v === "1") raw += Number(it.value ?? 1);
  }
  const maxRaw = items.reduce((s, it) => s + Number(it.value ?? 1), 0) || 1;
  return {
    raw, maxRaw, answered, total: items.length,
    outOf10: Math.round((raw / maxRaw) * 100) / 10,     // e.g. 9 of 12 → 7.5
    pct: Math.round((raw / maxRaw) * 100),
  };
}

/* Likert instruments: mean of the answered items, plus NPS when flagged. */
export function scoreLikert(answers = {}, inst) {
  const items = (inst.items || []).filter((it) => it.type === "likert");
  const values = [];
  for (const it of items) {
    const v = Number(answers[it.id]);
    if (!Number.isFinite(v)) continue;
    values.push(Math.min(it.max ?? 5, Math.max(it.min ?? 1, v)));
  }
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const npsItem = items.find((it) => it.nps);
  let nps = null;
  if (npsItem) {
    const v = Number(answers[npsItem.id]);
    if (Number.isFinite(v)) {
      const promoters = v >= 9 ? 1 : 0;
      const detractors = v <= 6 ? 1 : 0;
      nps = { score: v, promoters, passives: promoters || detractors ? 0 : 1, detractors,
              value: (promoters - detractors) * 100 };
    }
  }
  return { answered: values.length, total: items.length, mean: mean == null ? null : Math.round(mean * 100) / 100, nps };
}

/* NPS across many respondents — the number the paper reports. */
export function aggregateNps(scores) {
  const vals = scores.map((s) => s?.nps?.score).filter((v) => Number.isFinite(v));
  if (!vals.length) return { n: 0, nps: null, promoters: 0, passives: 0, detractors: 0 };
  const promoters = vals.filter((v) => v >= 9).length;
  const detractors = vals.filter((v) => v <= 6).length;
  const passives = vals.length - promoters - detractors;
  return { n: vals.length, promoters, passives, detractors,
           nps: Math.round(((promoters - detractors) / vals.length) * 100) };
}
