/* topic-link.js — deep links between flashcards and virtual-patient cases.

   One subject key links both sides (server/src/lib/topic-key.js). The URL carries
   only the key, so a link survives a reload, can be shared, and works on first load:
     #flashcards?topic=cardio   opens the flashcard tab filtered to Cardiology
     #vpatient?topic=cardio     opens the virtual-patient list filtered to Cardiology
   Unknown keys are ignored (the tab still opens, unfiltered). The labels below
   mirror TOPIC_KEYS on the server; server/test/topic-key.test.js checks they match. */

export const TOPIC_LABELS = {
  cardio: { fa: "قلب و عروق", en: "Cardiology" },
  pulmo: { fa: "ریه و مسمومیت", en: "Pulmonology" },
  gi: { fa: "گوارش", en: "Gastroenterology" },
  nephro: { fa: "نفرولوژی", en: "Nephrology" },
  heme: { fa: "خون و انکولوژی", en: "Hematology-Oncology" },
  endo: { fa: "غدد", en: "Endocrinology" },
  rheum: { fa: "روماتولوژی", en: "Rheumatology" },
  surgery: { fa: "جراحی", en: "Surgery" },
  peds: { fa: "کودکان", en: "Pediatrics" },
  obgyn: { fa: "زنان و زایمان", en: "Obstetrics & Gynecology" },
  path: { fa: "پاتولوژی", en: "Pathology" },
  infect: { fa: "عفونی", en: "Infectious Diseases" },
  neuro: { fa: "مغز و اعصاب", en: "Neurology" },
  psych: { fa: "روانپزشکی", en: "Psychiatry" },
  derm: { fa: "پوست", en: "Dermatology" },
  ortho: { fa: "ارتوپدی", en: "Orthopedics" },
  pharm: { fa: "فارماکولوژی", en: "Pharmacology" },
  uro: { fa: "اورولوژی", en: "Urology" },
  ophth: { fa: "چشم‌پزشکی", en: "Ophthalmology" },
  ent: { fa: "گوش و حلق و بینی", en: "ENT" },
  radio: { fa: "رادیولوژی", en: "Radiology" },
  stats: { fa: "آمار و اپیدمیولوژی", en: "Statistics & Epidemiology" },
  ethics: { fa: "اخلاق پزشکی", en: "Medical Ethics" },
  genetics: { fa: "ژنتیک پزشکی", en: "Medical Genetics" },
  immuno: { fa: "ایمونولوژی", en: "Immunology" },
  nutrition: { fa: "تغذیه", en: "Nutrition" },
  physics: { fa: "فیزیک پزشکی", en: "Medical Physics" },
  anatomy: { fa: "آناتومی", en: "Anatomy" },
  physio: { fa: "فیزیولوژی", en: "Physiology" },
  biochem: { fa: "بیوشیمی", en: "Biochemistry" },
  histology: { fa: "بافت‌شناسی", en: "Histology" },
  embryo: { fa: "جنین‌شناسی", en: "Embryology" },
  micro: { fa: "میکروب‌شناسی", en: "Microbiology" },
  biophys: { fa: "بیوفیزیک", en: "Biophysics" },
};

export const TOPIC_TABS = ["flashcards", "vpatient"];

export function isTopicKey(key) {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(TOPIC_LABELS, key);
}

export function topicLabel(key, lang = "fa") {
  if (!isTopicKey(key)) return "";
  return lang === "en" ? TOPIC_LABELS[key].en : TOPIC_LABELS[key].fa;
}

// Parse a location hash. Returns {tab, key} for a link hash, or null for any other hash.
// key is null when the tab is named without a valid topic.
export function parseTopicHash(hash) {
  const m = /^#(flashcards|vpatient)(?:\?(.*))?$/.exec(hash || "");
  if (!m) return null;
  let key = null;
  try {
    const v = new URLSearchParams(m[2] || "").get("topic");
    key = isTopicKey(v) ? v : null;
  } catch { key = null; }
  return { tab: m[1], key };
}

export function topicHash(tab, key) {
  if (!TOPIC_TABS.includes(tab)) return "";
  return isTopicKey(key) ? `#${tab}?topic=${encodeURIComponent(key)}` : `#${tab}`;
}
