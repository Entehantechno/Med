/* topic-key.js — one canonical topic key shared by flashcards and virtual-patient cases.

   Why: the question bank tags a card with subject/chapter text ("Internal Medicine" /
   "Cardiology"), and a virtual-patient case carries a free-text specialty
   ("Cardiology" / "قلب و عروق"). Neither carries the other's id, so the learner had no
   way to move from a card to the case that practises it, or back.

   The keys ARE the TOPICS slugs (server/src/data/preinternship.js), so learn cards that
   already store `topic: "cardio"` need no migration. TOPIC_KEYS below must list exactly
   those slugs; test/topic-key.test.js checks it against TOPICS.

   Resolution order (first hit wins):
     1. an explicit `topic` slug on the item, when it is a known key;
     2. the chapter / specialty / category / subject text, English then Persian.
   Matching is on whole words (\b) so short aliases such as "ent" never match "patient".
   An item with no recognisable topic gets "" and is simply not linked. */

// label: [Persian, English]. patterns: lowercase English or Persian regular expressions.
const TOPIC_KEYS = [
  { key: "cardio",    fa: "قلب و عروق", en: "Cardiology",          p: [/\bcardio/, /\bheart\b/, /قلب/] },
  { key: "pulmo",     fa: "ریه و مسمومیت", en: "Pulmonology",      p: [/\bpulmon/, /\brespir/, /\blung/, /\btoxicolog/, /ریه/, /مسمومیت/] },
  { key: "gi",        fa: "گوارش", en: "Gastroenterology",            p: [/\bgastro/, /\bhepat/, /\bliver\b/, /\bcirrho/, /گوارش/, /کبد/] },
  { key: "nephro",    fa: "نفرولوژی", en: "Nephrology",               p: [/\bnephro/, /\brenal\b/, /\bkidney/, /نفرولوژی/, /کلیه/] },
  { key: "heme",      fa: "خون و انکولوژی", en: "Hematology-Oncology", p: [/\bhemato/, /\bhaemato/, /\bonco/, /خون/, /انکولوژی/] },
  { key: "endo",      fa: "غدد", en: "Endocrinology",                 p: [/\bendocrin/, /\bdiabet/, /غدد/, /دیابت/] },
  { key: "rheum",     fa: "روماتولوژی", en: "Rheumatology",           p: [/\brheumat/, /روماتولوژی/] },
  { key: "surgery",   fa: "جراحی", en: "Surgery",                     p: [/\bsurg/, /جراحی/] },
  { key: "peds",      fa: "کودکان", en: "Pediatrics",                 p: [/\bpaed?iatr/, /\bneonat/, /کودکان/, /اطفال/] },
  { key: "obgyn",     fa: "زنان و زایمان", en: "Obstetrics & Gynecology", p: [/\bobstet/, /\bgynec/, /\bgynaec/, /زنان/, /زایمان/] },
  { key: "path",      fa: "پاتولوژی", en: "Pathology",                 p: [/\bpatholog/, /پاتولوژی/] },
  { key: "infect",    fa: "عفونی", en: "Infectious Diseases",         p: [/\binfect/, /عفونی/, /عفونت/] },
  { key: "neuro",     fa: "مغز و اعصاب", en: "Neurology",               p: [/\bneuro(?!surg)/, /\bstroke\b/, /مغز/, /اعصاب/] },
  { key: "psych",     fa: "روانپزشکی", en: "Psychiatry",                p: [/\bpsychiat/, /روانپزشکی/] },
  { key: "derm",      fa: "پوست", en: "Dermatology",                    p: [/\bdermat/, /پوست/] },
  { key: "ortho",     fa: "ارتوپدی", en: "Orthopedics",                 p: [/\bortho/, /ارتوپد/] },
  { key: "pharm",     fa: "فارماکولوژی", en: "Pharmacology",            p: [/\bpharmacolog/, /فارماکولوژی/, /داروشناسی/] },
  { key: "uro",       fa: "اورولوژی", en: "Urology",                    p: [/\burolog/, /اورولوژی/, /ارولوژی/] },
  { key: "ophth",     fa: "چشم‌پزشکی", en: "Ophthalmology",             p: [/\bophthalm/, /\beye\b/, /چشم/] },
  { key: "ent",       fa: "گوش و حلق و بینی", en: "ENT",                p: [/\bent\b/, /\botolaryn/, /گوش/] },
  { key: "radio",     fa: "رادیولوژی", en: "Radiology",                 p: [/\bradiolog/, /رادیولوژی/] },
  { key: "stats",     fa: "آمار و اپیدمیولوژی", en: "Statistics & Epidemiology", p: [/\bstatistic/, /\bepidemiolog/, /آمار/, /اپیدمیولوژی/] },
  { key: "ethics",    fa: "اخلاق پزشکی", en: "Medical Ethics",          p: [/\bethic/, /اخلاق/] },
  { key: "genetics",  fa: "ژنتیک پزشکی", en: "Medical Genetics",        p: [/\bgenetic/, /ژنتیک/] },
  { key: "immuno",    fa: "ایمونولوژی", en: "Immunology",               p: [/\bimmunolog/, /ایمونولوژی/] },
  { key: "nutrition", fa: "تغذیه", en: "Nutrition",                     p: [/\bnutrition/, /تغذیه/] },
  { key: "physics",   fa: "فیزیک پزشکی", en: "Medical Physics",         p: [/\bmedical physics/, /فیزیک پزشکی/] },
  { key: "anatomy",   fa: "آناتومی", en: "Anatomy",                     p: [/\banatom/, /آناتومی/] },
  { key: "physio",    fa: "فیزیولوژی", en: "Physiology",                 p: [/\bphysiolog/, /فیزیولوژی/] },
  { key: "biochem",   fa: "بیوشیمی", en: "Biochemistry",                 p: [/\bbiochem/, /بیوشیمی/] },
  { key: "histology", fa: "بافت‌شناسی", en: "Histology",                 p: [/\bhistolog/, /بافت‌شناسی/] },
  { key: "embryo",    fa: "جنین‌شناسی", en: "Embryology",                p: [/\bembryolog/, /جنین‌شناسی/] },
  { key: "micro",     fa: "میکروب‌شناسی", en: "Microbiology",            p: [/\bmicrobiolog/, /میکروب‌شناسی/] },
  { key: "biophys",   fa: "بیوفیزیک", en: "Biophysics",                   p: [/\bbiophysic/, /بیوفیزیک/] },
];

export const TOPIC_KEY_SET = new Set(TOPIC_KEYS.map((t) => t.key));

/** Persian/Arabic letter forms and zero-width joiners removed, lowercased. */
export function normalizeTopicText(s) {
  return String(s ?? "")
    .replace(/\u200c/g, " ")
    .replace(/ي/g, "ی").replace(/ك/g, "ک")
    .toLowerCase()
    .trim();
}

const memo = new Map();
const MEMO_MAX = 4000;

/** Key for one piece of text, or "". Memoised: the learner card list runs this ~11k times. */
export function topicKeyFromText(text) {
  const s = normalizeTopicText(text);
  if (!s) return "";
  if (memo.has(s)) return memo.get(s);
  let hit = "";
  for (const t of TOPIC_KEYS) {
    if (t.p.some((re) => re.test(s))) { hit = t.key; break; }
  }
  if (memo.size >= MEMO_MAX) memo.clear();
  memo.set(s, hit);
  return hit;
}

/**
 * Key for a card or case. `data` is the parsed JSON (or any object with the same fields).
 * Looks at the explicit slug first, then chapter, category, subject and specialty in both languages.
 */
export function topicKeyOf(data) {
  if (!data || typeof data !== "object") return "";
  if (TOPIC_KEY_SET.has(data.topic)) return data.topic;
  const sm = data.source_meta || {};
  const candidates = [
    sm.chapter_en, sm.chapter_fa, data.chapter_en, data.chapter_fa,
    data.category_en, data.category_fa,
    sm.subject_en, sm.subject_fa, data.subject_en, data.subject_fa, data.subject,
    data.specialty_en, data.specialty_fa,
  ];
  for (const c of candidates) {
    const k = topicKeyFromText(c);
    if (k) return k;
  }
  return "";
}

/** Display label for a key in one language ("" when unknown). */
export function topicLabel(key, lang = "fa") {
  const t = TOPIC_KEYS.find((x) => x.key === key);
  if (!t) return "";
  return lang === "en" ? t.en : t.fa;
}

export { TOPIC_KEYS };
