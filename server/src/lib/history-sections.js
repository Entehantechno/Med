/* history-sections.js — Scoring SECTIONS for the university virtual patient.

   Each OSCE checklist item may carry a `section` key. We score every section
   SEPARATELY (e.g. history-taking on its own) plus an OVERALL score. This lets
   a teacher grade an EXTERN mainly on history-taking while grading an INTERN on
   the whole encounter — both scores are always shown; the teacher picks.

   The internal-medicine history form (شرح حال کامل داخلی) is modelled as a set
   of history SUBSECTIONS so an author can build a complete internal-medicine
   station field-by-field. Everything is deterministic and editable in admin. */

// Top-level scoring sections. `history` is the one externs are graded on.
export const SECTIONS = [
  { key: "history",       fa: "شرح‌حال و مرور سیستم‌ها (ROS)",  en: "History & ROS", isHistory: true },
  { key: "exam",          fa: "معاینه فیزیکی و علائم حیاتی",     en: "Physical Exam & Vitals" },
  { key: "problem_list",  fa: "پرابلم لیست",                     en: "Problem list" },
  { key: "ddx",           fa: "تشخیص افتراقی",                   en: "Differential diagnosis" },
  { key: "workup",        fa: "درخواست پاراکلینیک و آزمایش",      en: "Investigations & Labs" },
  { key: "diagnosis",     fa: "تشخیص نهایی",                    en: "Final diagnosis" },
  { key: "management",    fa: "برنامه درمان و مدیریت",           en: "Management & Treatment" },
  { key: "communication", fa: "ارتباط و حرفه‌ای‌گری",             en: "Communication & Professionalism" },
];

export const SECTION_KEYS = SECTIONS.map((s) => s.key);
export const DEFAULT_SECTION = "history";

export function inferSection(it) {
  if (it?.section && SECTION_KEYS.includes(it.section)) return it.section;
  const text = `${it?.fa || ""} ${it?.en || ""} ${(it?.keys || []).join(" ")}`.toLowerCase();
  if (/(آزمایش|تصویربرداری|سونوگرافی|نوار قلب|رادیولوژی|سی‌تی|ام‌آرآی|ecg|ekg|troponin|تروپونین|lab|test|order|imaging|ct|mri|investigation|workup)/i.test(text)) return "workup";
  if (/(تشخیص نهایی|تشخیص قطعی|تشخیص صحیح|تشخیص بیماری|final dx|diagnos|stemi|cholecystitis)/i.test(text)) return "diagnosis";
  if (/(برنامه درمان|درمان اولیه|پلن درمان|مدیریت درمان|آسپرین|نسخه|تجویز|management|treatment|therapy|plan|prescri)/i.test(text)) return "management";
  if (/(معاینه|سمع|لمس|دق|علائم حیاتی|فشار خون|نبض|مورفی|physical exam|exam|vitals|auscultat|palpat|percuss)/i.test(text)) return "exam";
  if (/(پرابلم لیست|لیست مشکلات|problem list)/i.test(text)) return "problem_list";
  if (/(افتراقی|تشخیص‌های افتراقی|differential)/i.test(text)) return "ddx";
  if (/(معرفی خود|کسب رضایت|مهارت ارتباط|ارتباطی|احترام|همدلی|introduce|consent|communication|rapport|professionalism)/i.test(text)) return "communication";
  return DEFAULT_SECTION;
}

/* EXTERN grading scope: an extern is graded UP TO the clinical-reasoning core —
   history-taking, physical examination, problem list AND differential
   diagnosis. Everything after it (investigations, final diagnosis,
   management, communication) only counts for INTERNs. The class's
   grading_role decides which scope the stored/final score uses — see
   routes/exam.js. */
export const EXTERN_SCOPE = ["history", "exam", "problem_list", "ddx"];

export function sectionLabel(key, lang = "fa") {
  const s = SECTIONS.find((x) => x.key === key);
  if (!s) return key || "";
  return lang === "fa" ? s.fa : s.en;
}
export function isHistorySection(key) {
  const s = SECTIONS.find((x) => x.key === key);
  return !!(s && s.isHistory);
}

/* Partial credit for one evaluated checklist item, in [0, 1]. Every item
   contributes in proportion to `credit` (keyed facets, PL/DDX coverage, and
   LLM-graded items). Older records without `credit` fall back to done (0/1). */
export function itemCredit(r) {
  if (r && typeof r.credit === "number" && Number.isFinite(r.credit)) return Math.max(0, Math.min(1, r.credit));
  return r && r.done ? 1 : 0;
}

/* Weighted % over a SUBSET of sections. Returns null when the subset has no
   items (so callers can fall back deliberately instead of showing a fake 0). */
export function scoreForScope(results = [], scopeKeys = [], lang = "fa") {
  let earned = 0, total = 0, items = 0;
  for (const r of results) {
    const sec = SECTION_KEYS.includes(r.section) ? r.section : inferSection(r);
    if (!scopeKeys.includes(sec)) continue;
    const w = Number(r.weight) || 0;
    earned += w * itemCredit(r);
    total += w; items += 1;
  }
  return { score: total ? Math.round((earned / total) * 100) : null, earned, total, items };
}

/* Given evaluated checklist results ([{ id, label, weight, done, section }]),
   compute a per-section score (%) + the earned/total weights, and a convenience
   `history`/`other`/`overall` split — plus the two grading scopes:
     • `extern`  = history + physical exam + problem list + ddx (extern criterion)
     • `overall` = every section (intern criterion) */
export function computeSectionScores(results = [], lang = "fa") {
  const bySection = {};
  let earnedAll = 0, totalAll = 0;
  let earnedHist = 0, totalHist = 0;

  for (const r of results) {
    const sec = SECTION_KEYS.includes(r.section) ? r.section : inferSection(r);
    const w = Number(r.weight) || 0;
    const e = w * itemCredit(r);
    (bySection[sec] ||= { key: sec, label: sectionLabel(sec, lang), earned: 0, total: 0, items: 0 });
    bySection[sec].earned += e; bySection[sec].total += w; bySection[sec].items += 1;
    totalAll += w; earnedAll += e;
    if (isHistorySection(sec)) { totalHist += w; earnedHist += e; }
  }

  // ordered list following SECTIONS order, only for sections that have items
  const sections = SECTIONS
    .filter((s) => bySection[s.key])
    .map((s) => {
      const b = bySection[s.key];
      return { key: s.key, label: sectionLabel(s.key, lang), items: b.items,
        earned: b.earned, total: b.total,
        score: b.total ? Math.round((b.earned / b.total) * 100) : 0 };
    });

  const overall = totalAll ? Math.round((earnedAll / totalAll) * 100) : 0;
  const history = totalHist ? Math.round((earnedHist / totalHist) * 100) : null;
  const otherEarned = earnedAll - earnedHist, otherTotal = totalAll - totalHist;
  const other = otherTotal ? Math.round((otherEarned / otherTotal) * 100) : null;
  /* Extern scope = history + physical exam + problem list + differential dx
     (up to and including the differential, per the university protocol). When
     a checklist has no exam/problem-list/ddx items this degrades gracefully to
     the history score, which is the legacy extern criterion. */
  const ext = scoreForScope(results, EXTERN_SCOPE, lang);
  const extern = ext.score != null ? ext.score : history;

  return {
    sections,
    overall,
    history,           // legacy extern criterion (history items only)
    other,             // everything except history (null if none)
    extern,            // extern criterion: up to and including the problem list
    externItems: ext.items,
    hasHistory: totalHist > 0,
    hasOther: otherTotal > 0,
  };
}

/* -------------------------------------------------------------------------
   Internal-medicine complete history template (شرح حال کامل داخلی).
   Based on the standard Balinoma internal-medicine history form. Each entry
   becomes a checklist item with section='history' so the WHOLE thing scores
   into the history section. Authors get every field to fill in / tune.
   Grouped by the classic history subsections; `sub` is a display group only.
   ------------------------------------------------------------------------- */
export const INTERNAL_HISTORY_TEMPLATE = [
  // --- Opening / rapport (still part of a good history encounter) ---
  { sub: "opening", weight: 1, fa: "معرفی خود به‌عنوان پزشک و کسب رضایت", en: "Introduce self as doctor & obtain consent", keys: ["معرفی|من دکتر|من پزشک|دکتر شما|پزشک شما|من دانشجو|من اکسترن|من اینترن|دانشجوی پزشکی|introduce|i am dr|i am doctor|i am a medical student|i am a student|i am an extern|i am an intern", "اجازه هست|با اجازه|رضایت دارید|کسب رضایت|consent|permission"] },
  { sub: "opening", weight: 1, fa: "پرسش سن و شغل بیمار", en: "Ask age and occupation", keys: ["سن|چند سال|age|how old", "شغل|occupation|job|work"] },
  { sub: "opening", weight: 1, fa: "پرسش منبع و درصد اعتماد شرح‌حال", en: "Ask source & reliability of history", keys: ["منبع|source|همراه|از چه کسی|کی همراهتونه", "اعتماد|reliab|قابل اعتماد|اطمینان|درصد|percent"] },

  // --- Chief complaint ---
  { sub: "cc", weight: 2, fa: "ثبت شکایت اصلی (C.C) به زبان بیمار", en: "Record the chief complaint (C.C)", keys: ["شکایت|مشکل|complaint|chief|problem|درد سینه|chest pain|تپش|palpitation", "چه شده|چی شده|what happened|what brings|own words|به زبان خودش"] },
  { sub: "cc", weight: 1, fa: "پرسش مدت شکایت اصلی", en: "Ask duration of the chief complaint", keys: ["چند وقت|مدت|چقدره|چند ساعته|چند روزه|how long|duration|since when|از کی", "کی شروع|شروع شد|onset|started|began|when did"] },

  // --- HPI / OPQRST ---
  { sub: "hpi", weight: 1, fa: "نحوهٔ شروع و مراجعه (Onset)", en: "Onset & mode of arrival", keys: ["شروع|onset|started|began", "ناگهانی|تدریجی|sudden|gradual|abrupt|چطور شروع|چطوری شروع|چطور آمد"] },
  { sub: "hpi", weight: 1, fa: "عوامل تشدیدکننده/تسکین‌دهنده (Provocation/Palliation)", en: "Provoking / relieving factors", keys: ["بدتر|تشدید|provok|aggravat|worse", "بهتر|تسکین|relie|better|ease|کم می‌شود|کم میشه"] },
  { sub: "hpi", weight: 1, fa: "کیفیت درد/علامت (Quality)", en: "Quality of the symptom", keys: ["کیفیت|چه جور|چجوری|چطوری|quality|character|what does it feel like", "فشارنده|سوزشی|سوزش|تیز|کولیک|سنگین|مبهم|sharp|dull|burning|pressure|crush|colic|heavy"] },
  { sub: "hpi", weight: 1, fa: "انتشار (Radiation)", en: "Radiation", keys: ["انتشار|پخش|radiat|spread|منتشر", "تیر|بازو|فک|پشت|شانه|jaw|arm|back|shoulder"] },
  { sub: "hpi", weight: 1, fa: "شدت ۱ تا ۱۰ (Severity)", en: "Severity (1–10)", keys: ["شدت|severity|چقدر|how bad|scale|درجه", "۱ تا ۱۰|1 تا 10|1 to 10|1-10|از ۱۰|out of 10|scale of 10"] },
  { sub: "hpi", weight: 1, fa: "زمان‌بندی و طول‌کشیدن (Timing)", en: "Timing / course", keys: ["زمان|timing|مداوم|پیوسته|constant|continuous", "متناوب|intermittent|episod|بیاید و برود|سیر|course|pattern"] },
  { sub: "hpi", weight: 1, fa: "پرسش علائم همراه", en: "Ask associated symptoms", keys: ["علائم همراه|همراه|associated", "تهوع|تعریق|nausea|sweat|vomit|تنگی نفس|dyspnea"] },
  { sub: "hpi", weight: 1, fa: "سابقهٔ مشابه قبلی", en: "Previous similar episode", keys: ["قبلا|قبلاً|before|previous|earlier|تا حالا|تا به حال", "مشابه|similar|same as|سابقه مشابه|بار قبل|episode"] },

  // --- Past medical history (PMH) ---
  { sub: "pmh", weight: 1, fa: "پرسش بیماری‌های زمینه‌ای (DM/HTN/HLP/IHD...)", en: "Ask chronic diseases (DM/HTN/HLP/IHD...)", keys: ["دیابت|قند|diabet", "فشار|hypertens|htn|پرفشاری", "چربی|hlp|hyperlip|کلسترول|cholesterol|lipid", "قلبی|ihd|ischemic|کرونر|heart disease"] },
  { sub: "pmh", weight: 1, fa: "سابقهٔ بستری/جراحی/آنژیوگرافی", en: "Hospitalization / surgery / angiography", keys: ["بستری|hospital|admission", "جراحی|عمل|surg|operation", "آنژیو|angio|کاتتریزاسیون|catheter"] },
  { sub: "pmh", weight: 1, fa: "سابقهٔ دارویی (نام/دوز)", en: "Medication history (name/dose)", keys: ["دارو|قرص|medicat|drug|pill|taking|مصرف می‌کنی|مصرف می کنی", "دوز|dose|میلی گرم|mg|نام دارو|name of"] },
  { sub: "pmh", weight: 1, fa: "غربالگری و واکسیناسیون", en: "Screening & vaccination", keys: ["غربالگری|screen", "واکسن|vaccin|پاپ|pap|ماموگرافی|mammo"] },

  // --- Family history (FH) ---
  { sub: "fh", weight: 1, fa: "سابقهٔ خانوادگی بیماری‌های مرتبط", en: "Relevant family history", keys: ["خانواده|family|پدر|مادر|father|mother", "ارثی|hereditary|genetic|فامیل|بستگان|relatives"] },

  // --- Allergy ---
  { sub: "allergy", weight: 1, fa: "پرسش حساسیت و آلرژی", en: "Ask allergies", keys: ["آلرژی|حساسیت|allerg|sensitiv", "واکنش|reaction|کدام دارو|which drug|نوع"] },

  // --- Social history (SH) ---
  { sub: "sh", weight: 1, fa: "مصرف سیگار/الکل/مواد مخدر", en: "Smoking / alcohol / drug use", keys: ["سیگار|smok|tobacco", "الکل|alcohol", "مواد|مخدر|اعتیاد|opium|drug use|substance|تریاک"] },
  { sub: "sh", weight: 1, fa: "وضعیت سکونت/شغلی/عادات غذایی", en: "Living / occupation / diet habits", keys: ["سکونت|خانه|زندگی|living|home|house", "شغل|occupation|job|work", "غذا|رژیم|diet|تغذیه|food"] },
  { sub: "sh", weight: 1, fa: "سفر اخیر/تماس با حیوانات", en: "Recent travel / animal contact", keys: ["سفر|مسافرت|travel|trip", "حیوان|animal|contact|گربه|سگ|dog|cat"] },

  // --- Review of systems (ROS) ---
  { sub: "ros", weight: 1, fa: "مرور سیستم عمومی (تب/لرز/تعریق شبانه/کاهش وزن)", en: "General ROS (fever/chills/night sweats/weight loss)", keys: ["تب|fever", "لرز|chills|تعریق شبانه|night sweat|عرق شب", "کاهش وزن|weight loss|وزن"] },
  { sub: "ros", weight: 1, fa: "مرور سیستم تنفسی (سرفه/تنگی‌نفس/خلط)", en: "Respiratory ROS (cough/dyspnea/sputum)", keys: ["سرفه|cough", "تنگی نفس|dyspn|shortness of breath", "خلط|sputum|اسپوتوم"] },
  { sub: "ros", weight: 1, fa: "مرور سیستم قلبی‌عروقی (درد سینه/تپش/ادم)", en: "Cardiovascular ROS (chest pain/palpitation/edema)", keys: ["درد سینه|chest pain", "تپش|palpitation", "ادم|ورم|edema|oedema"] },
  { sub: "ros", weight: 1, fa: "مرور سیستم گوارشی (تهوع/استفراغ/تغییر اجابت)", en: "GI ROS (nausea/vomiting/bowel change)", keys: ["تهوع|nausea", "استفراغ|vomit", "اسهال|یبوست|diarrh|constipat|bowel|دفع"] },
  { sub: "ros", weight: 1, fa: "مرور سیستم ادراری‌تناسلی", en: "Genitourinary ROS", keys: ["ادرار|urin", "سوزش ادرار|dysuria|burning urin", "تکرر ادرار|frequency|تکرر"] },
  { sub: "ros", weight: 1, fa: "مرور سیستم عصبی/روانی", en: "Neuro / psych ROS", keys: ["سردرد|headache", "سرگیجه|dizz|vertigo", "ضعف|weakness|weak", "خواب|sleep|خلق|mood"] },

  // --- Summary / synthesis (still history-side clinical reasoning) ---
  { sub: "summary", weight: 2, fa: "جمع‌بندی شرح‌حال و ساخت Problem List", en: "Summarize history & build a problem list", keys: ["خلاصه|جمع بندی|جمع‌بندی|summary|summar", "پروبلم|problem list|لیست مشکلات|فهرست مشکلات"] },
];

/* Build ready-to-store checklist items from the internal-history template.
   Every item is section='history'. IDs are stable/prefixed to avoid clashes. */
export function buildInternalHistoryItems() {
  return buildHistoryItems("internal");
}

/* ==========================================================================
   SPECIALTY HISTORY FORMS (فرم‌های شرح‌حال تخصصی)
   Each form is a set of history-taking items modelled on the standard Balinoma
   forms. Selecting a form on a virtual-patient case one-click inserts its full
   history checklist (all section='history') so an author can build a complete,
   specialty-appropriate station. Everything is editable in admin afterwards.
   ========================================================================== */

// --- زنان و مامایی (OB/GYN — Shiraz form) ---
export const OBGYN_HISTORY_TEMPLATE = [
  { sub: "opening", weight: 1, fa: "معرفی و کسب رضایت + پرسش سن و G/P/A/L", en: "Introduce/consent + ask age & G/P/A/L", keys: ["معرفی|من دکتر|من پزشک|دکتر شما|پزشک شما|من دانشجو|من اکسترن|من اینترن|دانشجوی پزشکی|introduce|i am dr|i am doctor|i am a medical student|i am a student|i am an extern|i am an intern", "اجازه هست|با اجازه|رضایت دارید|کسب رضایت|consent|permission", "سن|چند سال|age|how old", "گراوید|پاریتی|gravida|para|سقط|abortion"] },
  { sub: "cc", weight: 2, fa: "ثبت شکایت اصلی و LMP/GA", en: "Chief complaint + LMP/GA", keys: ["شکایت|complaint|chief|مشکل|problem", "lmp|آخرین قاعدگی|قاعدگی|last menstrual|period", "هفته|gestational age|سن بارداری|سن حاملگی"] },
  { sub: "pi", weight: 2, fa: "شرح بیماری فعلی (شروع، سیر، شدت)", en: "History of present illness (onset/course/severity)", keys: ["از کی|شروع|onset|started|began", "درد|خونریزی|pain|bleeding", "سیر|course|شدت|severity|چقدر"] },
  { sub: "menstrual", weight: 2, fa: "شرح‌حال قاعدگی (نظم، مدت، حجم، دیسمنوره)", en: "Menstrual history (regularity, duration, flow, dysmenorrhea)", keys: ["قاعدگی|پریود|menstrual|period|cycle|نامنظم|منظم|regular", "مدت|duration|چند روز|روز", "دیسمنوره|dysmenorrh|درد قاعدگی|جریان|flow|menorrhag"] },
  { sub: "obstetric", weight: 2, fa: "شرح‌حال مامایی (زایمان‌ها، سقط، نوع زایمان)", en: "Obstetric history (deliveries, abortions, mode)", keys: ["زایمان|delivery|birth", "سقط|abortion|miscarr", "سزارین|cesarean|c-section|عادی|vaginal|نحوه زایمان|mode"] },
  { sub: "gyn", weight: 1, fa: "سابقهٔ زنان (پاپ‌اسمیر، عفونت، جراحی زنان)", en: "Gynecologic history (Pap, infections, GYN surgery)", keys: ["پاپ|pap smear|pap", "عفونت|infection|sti|ترشح|discharge", "کیست|میوم|cyst|fibroid|myom|جراحی|gyn surgery|surgery"] },
  { sub: "contraception", weight: 1, fa: "روش پیشگیری از بارداری", en: "Contraception method", keys: ["پیشگیری|contracep", "قرص|ocp|pill|ایمپلنت|implant|آی‌یو‌دی|iud|آی یو دی", "کاندوم|condom|عزل|withdraw"] },
  { sub: "pmh", weight: 1, fa: "سابقهٔ بیماری/جراحی/بستری قبلی", en: "Past medical/surgical/admission history", keys: ["سابقه|past|history", "بیماری قبلی|بیماری زمینه|medical", "جراحی|surg|operation", "بستری|admission|hospital"] },
  { sub: "pmh", weight: 1, fa: "داروها و اعتیاد", en: "Drug therapy & addiction", keys: ["دارو|قرص|medicat|drug|therapy", "اعتیاد|addiction|مواد|substance|سیگار|smok|الکل|alcohol"] },
  { sub: "fh", weight: 1, fa: "سابقهٔ خانوادگی (سرطان پستان/تخمدان...)", en: "Family history (breast/ovarian cancer...)", keys: ["خانواده|family|فامیل", "سرطان|cancer|پستان|breast|تخمدان|ovar"] },
  { sub: "ros", weight: 1, fa: "مرور سیستم‌ها (عمومی، ادراری، پستان، گوارشی)", en: "Review of systems (general, urinary, breast, GI)", keys: ["review of systems|مرور سیستم", "ادرار|urin|سوزش ادرار|dysuria", "پستان|breast", "گوارش|تهوع|نفخ|اسهال|یبوست|bowel|stool|diarrh|constipat"] },
  { sub: "summary", weight: 2, fa: "جمع‌بندی و Problem List / DDx", en: "Summary & problem list / DDx", keys: ["خلاصه|جمع بندی|جمع‌بندی|summary|summar", "problem list|پروبلم|لیست مشکلات|فهرست مشکلات", "افتراقی|ddx|differential|تشخیص افتراقی"] },
];

// --- قلب (Cardiology — Balinoma) ---
export const CARDIO_HISTORY_TEMPLATE = [
  { sub: "opening", weight: 1, fa: "معرفی و کسب رضایت", en: "Introduce & obtain consent", keys: ["معرفی|من دکتر|من پزشک|دکتر شما|پزشک شما|من دانشجو|من اکسترن|من اینترن|دانشجوی پزشکی|introduce|i am dr|i am doctor|i am a medical student|i am a student|i am an extern|i am an intern", "اجازه هست|با اجازه|رضایت دارید|کسب رضایت|consent|permission"] },
  { sub: "cc", weight: 2, fa: "ثبت شکایت اصلی به زبان بیمار", en: "Record chief complaint in patient's words", keys: ["شکایت|مشکل|complaint|chief|problem|درد سینه|chest pain|تپش|palpitation", "چه شده|چی شده|what happened|what brings|own words|به زبان خودش"] },
  { sub: "hpi", weight: 2, fa: "OPQRST درد سینه (شروع، کیفیت، انتشار)", en: "OPQRST of chest pain (onset, quality, radiation)", keys: ["شروع|onset|از کی", "کیفیت|quality|character|چطور", "انتشار|radiation|radiat|پخش"] },
  { sub: "hpi", weight: 1, fa: "پرسش ماهیت درد (پلورتیک/پوزیشنال/فشارنده)", en: "Ask pain nature (pleuritic/positional/pressure)", keys: ["پلورتیک|pleuritic|تنفس عمیق|deep breath", "پوزیشنال|positional|وضعیت|posture|حرکت", "فشارنده|pressure|pressing|سنگین"] },
  { sub: "hpi", weight: 1, fa: "کلاس عملکردی NYHA و تحمل فعالیت", en: "NYHA functional class & exertional tolerance", keys: ["فعالیت|exertion|exercise|ورزش", "پله|stairs|پیاده روی|walk|راه رفتن", "nyha|functional class|کلاس عملکردی|تحمل"] },
  { sub: "hpi", weight: 1, fa: "علائم همراه (تنگی‌نفس، سنکوپ، تعریق، تپش)", en: "Associated symptoms (dyspnea, syncope, sweating, palpitation)", keys: ["تنگی نفس|dyspnea|shortness of breath", "سنکوپ|syncope|غش", "تعریق|sweat|عرق", "تپش|palpitation"] },
  { sub: "hpi", weight: 1, fa: "ارتوپنه / PND / ادم اندام", en: "Orthopnea / PND / limb edema", keys: ["ارتوپنه|orthopn|بالش|متکا", "شب بیدار|نیمه شب|nocturnal|pnd|paroxysmal", "ادم|ورم|oedema|edema|پا ورم"] },
  { sub: "pmh", weight: 2, fa: "سابقهٔ قلبی (MI/PCI/CABG/آنژیو/تعویض دریچه)", en: "Cardiac history (MI/PCI/CABG/angio/valve)", keys: ["سکته قلبی|myocardial|انفارکتوس", "pci|استنت|stent|آنژیو|angio", "cabg|بای پس|bypass", "دریچه|valve|valv"] },
  { sub: "pmh", weight: 1, fa: "ریسک‌فاکتورها (DM/HTN/HLP/COPD/تیروئید)", en: "Risk factors (DM/HTN/HLP/COPD/thyroid)", keys: ["دیابت|diabet", "فشار|hypertens|htn|پرفشاری", "چربی|lipid|hyperlip|کلسترول|cholesterol", "copd|انسدادی|سی او پی دی", "تیروئید|thyroid"] },
  { sub: "pmh", weight: 1, fa: "داروها (نوع/دوز/کامپلاینس)", en: "Medications (type/dose/compliance)", keys: ["دارو|medicat|قرص|drug", "دوز|dose|میلی گرم|mg", "compliance|پایبندی|مصرف منظم|adherence"] },
  { sub: "fh", weight: 1, fa: "سابقهٔ خانوادگی MI/SCD/CABG زودرس", en: "Family history of premature MI/SCD/CABG", keys: ["خانواده|family|فامیل|پدر|مادر", "زودرس|premature|جوان|early age", "مرگ ناگهانی|scd|sudden death|sudden cardiac"] },
  { sub: "sh", weight: 1, fa: "سابقهٔ اجتماعی (سیگار/الکل/مواد/شغل)", en: "Social history (smoking/alcohol/drugs/job)", keys: ["سیگار|smok", "الکل|alcohol", "مواد|مخدر|اعتیاد|drug|opium", "شغل|occupation|job|work"] },
  { sub: "summary", weight: 2, fa: "جمع‌بندی و Problem List / DDx", en: "Summary & problem list / DDx", keys: ["خلاصه|جمع بندی|جمع‌بندی|summary|summar", "problem list|پروبلم|لیست مشکلات|فهرست مشکلات", "افتراقی|ddx|differential|تشخیص افتراقی"] },
];

// --- اطفال (Pediatrics — Balinoma) ---
export const PEDS_HISTORY_TEMPLATE = [
  { sub: "opening", weight: 1, fa: "معرفی و کسب رضایت از همراه/والد", en: "Introduce & obtain consent from caregiver", keys: ["معرفی|من دکتر|من پزشک|دکتر شما|پزشک شما|من دانشجو|من اکسترن|من اینترن|دانشجوی پزشکی|introduce|i am dr|i am doctor|i am a medical student|i am a student|i am an extern|i am an intern", "همراه|والد|مادر|پدر|caregiver|parent|رضایت|اجازه|consent|permission"] },
  { sub: "id", weight: 1, fa: "شناسایی (سن، جنس، منبع)", en: "Identification (age, sex, source)", keys: ["سن|چند سال|age|how old", "جنس|sex|gender|پسر|دختر", "منبع|source|همراه|از چه کسی"] },
  { sub: "cc", weight: 2, fa: "ثبت شکایت اصلی", en: "Record chief complaint", keys: ["شکایت|مشکل|complaint|problem", "چه شده|چی شده|what happened|what brings|مشکل"] },
  { sub: "pi", weight: 2, fa: "شرح بیماری فعلی (کیفیت، زمان، تظاهرات همراه)", en: "Present illness (quality, timing, associated features)", keys: ["کیفیت|quality|چطور|character", "زمان|timing|شروع|onset|از کی", "همراه|associated|تب|استفراغ|اسهال"] },
  { sub: "natal", weight: 2, fa: "سابقهٔ پره‌ناتال (بارداری مادر، دارو، بیماری)", en: "Prenatal history (pregnancy, meds, illness)", keys: ["بارداری|حاملگی|pregnan|prenatal", "دارو مادر|دارو|drug|medicat|maternal med", "بیماری مادر|maternal illness|عفونت|infection"] },
  { sub: "natal", weight: 1, fa: "سابقهٔ حین/بعد تولد (نوع زایمان، آپگار، ایکتر)", en: "Peri/post-natal (delivery, Apgar, jaundice)", keys: ["زایمان|delivery|birth|تولد", "آپگار|apgar", "زردی|jaundice"] },
  { sub: "development", weight: 2, fa: "تاریخچهٔ رشد و تکامل (وزن/قد/مایلستون‌ها)", en: "Growth & development (weight/height/milestones)", keys: ["رشد|growth", "تکامل|development|milestone|نشستن|راه رفتن|حرف زدن", "وزن|قد|weight|height|دور سر"] },
  { sub: "feeding", weight: 1, fa: "تاریخچهٔ تغذیه (شیر مادر/خشک، جامدات)", en: "Feeding history (breast/formula, solids)", keys: ["شیر|breast|سینه|تغذیه|feeding", "فرمولا|formula", "جامد|solid|غذای کمکی|complementary"] },
  { sub: "vaccine", weight: 1, fa: "واکسیناسیون (برنامهٔ کشوری)", en: "Vaccination (national schedule)", keys: ["واکسن|واکسیناسیون|vaccin|immuniz|ایمن‌سازی", "برنامه ملی|national schedule|schedule|تقویمی"] },
  { sub: "pmh", weight: 1, fa: "سابقهٔ بیماری/بستری/جراحی، دارو و آلرژی", en: "Past illness/admission/surgery, drugs & allergy", keys: ["سابقه|past", "بستری|admission|hospital", "جراحی|surgery|surg", "دارو|drug|آلرژی|allerg"] },
  { sub: "fh", weight: 1, fa: "سابقهٔ خانوادگی + نسبت فامیلی والدین", en: "Family history + parental consanguinity", keys: ["خانواده|family|فامیل", "خویشاوند|consanguin|ازدواج فامیلی|cousin", "ارثی|hereditary|genetic"] },
  { sub: "sh", weight: 1, fa: "سابقهٔ اجتماعی (مهد/مدرسه، شغل والدین، محل زندگی)", en: "Social history (daycare/school, parents' job, home)", keys: ["مهد|daycare|nursery|پیش دبستانی|kindergarten", "مدرسه|school", "شغل|parents|occupation|job|والدین", "خانه|home|زندگی|living|house"] },
  { sub: "summary", weight: 2, fa: "جمع‌بندی و Problem List / DDx", en: "Summary & problem list / DDx", keys: ["خلاصه|جمع بندی|جمع‌بندی|summary|summar", "problem list|پروبلم|لیست مشکلات|فهرست مشکلات", "افتراقی|ddx|differential|تشخیص افتراقی"] },
];

// --- روان (Psychiatry — Kamalbakhsh Mir-Hosseini form) ---
export const PSYCH_HISTORY_TEMPLATE = [
  { sub: "opening", weight: 1, fa: "معرفی، برقراری ارتباط و کسب رضایت", en: "Introduce, build rapport & obtain consent", keys: ["معرفی|من دکتر|من پزشک|دکتر شما|پزشک شما|من دانشجو|من اکسترن|من اینترن|دانشجوی پزشکی|introduce|i am dr|i am doctor|i am a medical student|i am a student|i am an extern|i am an intern", "اجازه هست|با اجازه|رضایت دارید|کسب رضایت|consent|permission", "راحت|احترام|rapport|همدلی|empath|نگران نباشید|اعتماد"] },
  { sub: "cc", weight: 2, fa: "ثبت شکایت اصلی به زبان بیمار", en: "Record chief complaint in patient's words", keys: ["شکایت|مشکل|complaint|chief|problem|درد سینه|chest pain|تپش|palpitation", "چه شده|چی شده|what happened|what brings|own words|به زبان خودش"] },
  { sub: "hpi", weight: 2, fa: "شرح بیماری فعلی (شروع، سیر، عوامل)", en: "History of present illness (onset/course/factors)", keys: ["شروع|onset|از کی|started", "سیر|course|روند|پیشرفت", "عامل|factor|stressor|استرس|تریگر|trigger|محرک"] },
  { sub: "psych_past", weight: 2, fa: "سابقهٔ روان‌پزشکی قبلی (بستری، دارو، درمان)", en: "Past psychiatric history (admission, meds, therapy)", keys: ["روانپزشک|psychiatr", "بستری|admission|hospital|بیمارستان روان", "دارو|medicat|drug", "درمان|therapy|مشاوره|psychotherapy"] },
  { sub: "risk", weight: 2, fa: "ارزیابی خطر خودکشی/دیگرکشی", en: "Suicide / homicide risk assessment", keys: ["خودکشی|suicid", "آسیب|self-harm|self harm|خودآزاری", "دیگرکشی|homicid|آسیب به دیگران|harm to others"] },
  { sub: "substance", weight: 1, fa: "سابقهٔ مصرف مواد و الکل", en: "Substance & alcohol use history", keys: ["مواد|substance|drug|مخدر|اعتیاد", "الکل|alcohol"] },
  { sub: "medical", weight: 1, fa: "سابقهٔ طبی و دارویی مرتبط", en: "Relevant medical & drug history", keys: ["بیماری|medical|طبی", "دارو|drug|medicat"] },
  { sub: "personal", weight: 1, fa: "تاریخچهٔ شخصی/رشدی (کودکی، تحصیل، شغل، ازدواج)", en: "Personal/developmental history (childhood, education, job, marriage)", keys: ["کودکی|childhood", "تحصیل|education|school|مدرسه", "شغل|occupation|job", "ازدواج|marriage|married|همسر"] },
  { sub: "family", weight: 1, fa: "سابقهٔ خانوادگی روان‌پزشکی", en: "Family psychiatric history", keys: ["خانواده|family", "روانی|psychiatric|ارثی|hereditary"] },
  { sub: "mse", weight: 2, fa: "معاینهٔ وضعیت روانی (MSE): ظاهر، خلق، تفکر، ادراک", en: "Mental status exam (MSE): appearance, mood, thought, perception", keys: ["ظاهر|appearance|وضع ظاهری", "خلق|mood|affect", "تفکر|thought|thinking", "ادراک|توهم|هذیان|hallucin|delusion|perception"] },
  { sub: "mse", weight: 1, fa: "بینش و قضاوت (Insight & Judgment)", en: "Insight & judgment", keys: ["بینش|insight", "قضاوت|judgment|judgement"] },
  { sub: "summary", weight: 2, fa: "فرمولاسیون و برنامهٔ درمان", en: "Formulation & treatment plan", keys: ["خلاصه|summary|فرمولاسیون|formulation", "درمان|treatment plan|treatment|برنامه درمان"] },
];

/* Registry of all history forms (order = display order). `key` is stored on the
   case/class. `internal` reuses the existing INTERNAL_HISTORY_TEMPLATE. */
export const HISTORY_FORMS = [
  { key: "internal", fa: "داخلی", en: "Internal medicine", template: INTERNAL_HISTORY_TEMPLATE, prefix: "hx" },
  { key: "obgyn",    fa: "زنان و مامایی", en: "OB/GYN",        template: OBGYN_HISTORY_TEMPLATE,  prefix: "ob" },
  { key: "cardio",   fa: "قلب",          en: "Cardiology",     template: CARDIO_HISTORY_TEMPLATE, prefix: "cv" },
  { key: "peds",     fa: "اطفال",        en: "Pediatrics",     template: PEDS_HISTORY_TEMPLATE,   prefix: "pd" },
  { key: "psych",    fa: "روان‌پزشکی",   en: "Psychiatry",     template: PSYCH_HISTORY_TEMPLATE,  prefix: "ps" },
];
export const HISTORY_FORM_KEYS = HISTORY_FORMS.map((f) => f.key);

export function historyFormLabel(key, lang = "fa") {
  const f = HISTORY_FORMS.find((x) => x.key === key);
  if (!f) return key || "";
  return lang === "fa" ? f.fa : f.en;
}

/* Build ready-to-store checklist items for a given form key. Every item is
   section='history' with a stable, prefixed id. Falls back to internal. */
export function buildHistoryItems(formKey = "internal") {
  const form = HISTORY_FORMS.find((f) => f.key === formKey) || HISTORY_FORMS[0];
  return form.template.map((t, i) => ({
    id: `${form.prefix}${String(i + 1).padStart(2, "0")}`,
    section: "history",
    sub: t.sub,
    weight: t.weight,
    fa: t.fa, en: t.en,
    keys: t.keys,
  }));
}
