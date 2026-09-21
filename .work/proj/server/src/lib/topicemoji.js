/* Default relevant emoji per medical subject (by topic slug).
   Chosen to visually match each specialty as closely as the emoji set allows;
   admins can still override per topic or per lesson node.

   NOTE: Unicode has NO stomach organ emoji (the digestive organs were never
   added — see the AGA/Unicode proposal). So گوارش (GI) intentionally has an
   EMPTY emoji and falls back to a hand-drawn "stomach" SVG icon (icon:"stomach")
   which the client renders. This is the closest to a real stomach possible. */
export const TOPIC_EMOJI = {
  // --- pre-internship & residency (clinical) ---
  gi: "",          // stomach — no emoji exists → renders the "stomach" SVG icon
  pulmo: "🫁",     // lungs
  nephro: "🫘",    // kidney (bean shape)
  heme: "🩸",      // blood / hematology
  endo: "🦋",      // thyroid (butterfly gland) — classic endocrinology symbol
  rheum: "🦴",     // rheumatology (bones/joints)
  cardio: "🫀",    // heart
  surgery: "🔪",   // surgery / scalpel
  peds: "🧸",      // pediatrics (teddy bear)
  obgyn: "🤰",     // obstetrics & gynecology
  path: "🔬",      // pathology (microscope)
  infect: "🦠",    // infectious diseases (microbe)
  neuro: "🧠",     // neurology (brain)
  psych: "🛋️",     // psychiatry (couch)
  derm: "🧴",      // dermatology (skin/lotion)
  ortho: "🦿",     // orthopedics (prosthetic limb)
  pharm: "💊",     // pharmacology (pill)
  uro: "🚽",       // urology (urinary tract)
  ophth: "👁️",     // ophthalmology (eye)
  ent: "👂",       // ear-nose-throat
  radio: "🩻",     // radiology (x-ray)
  stats: "📊",     // statistics & epidemiology
  ethics: "⚖️",    // medical ethics (scales)
  genetics: "🧬",  // medical genetics (DNA)
  immuno: "🛡️",    // immunology (shield / defense)
  nutrition: "🥗", // nutrition
  physics: "⚛️",   // medical physics (atom)
  emergency: "🚑", // emergency
  internal: "🩺",  // internal medicine (stethoscope)
  // --- basic sciences ---
  anatomy: "🦴",   // anatomy (skeleton/structure)
  physio: "💪",    // physiology (body function)
  biochem: "🧪",   // biochemistry (test tube / reactions)
  histology: "🔬", // histology (microscope — tissue under scope)
  embryo: "🥚",    // embryology (egg / development)
  micro: "🧫",     // microbiology (petri dish — distinct from clinical infect 🦠)
  biophys: "🧲",   // biophysics (magnet / physical forces)
};

export function emojiForTopic(slug) {
  // returns "" for GI so the client falls back to the stomach icon
  return TOPIC_EMOJI[slug] !== undefined ? TOPIC_EMOJI[slug] : "📚";
}
