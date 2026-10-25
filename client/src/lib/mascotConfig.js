/* mascotConfig — loads the admin-editable mascot configuration (character
   images, on/off toggles, animation speed, and the rotating speech lines) from
   the public site-config endpoint, with a module-level cache + built-in
   defaults so the path renders instantly even before the fetch resolves.

   AI-free & deterministic: the admin authors the copy; the client just picks a
   stable line per section via a hash (so a section always shows the same line).
   All bundled defaults are original, medical, hand-written strings. */

import { api } from "../api.js";

export const DEFAULT_MASCOTS = {
  enabled: true,
  speed: "normal",
  dr: {
    enabled: true,
    img: "/mascots/dr-med.webp",
    // A POOL of guide characters that rotate deterministically per section for
    // variety (Duolingo-style cast). The first is the primary; `img` above is
    // kept as a back-compat fallback. Admin can edit this list.
    guides: ["/mascots/dr-med.webp", "/mascots/dr-nova.webp", "/mascots/organ-heart.webp", "/mascots/organ-brain.webp"],
    lines: {
      start: {
        fa: ["بزن بریم! اولین قدم همیشه مهم‌ترینه.", "آماده‌ای؟ با هم این بخش رو فتح می‌کنیم.", "هر درس یه قدم به پزشکِ بهتر شدن نزدیک‌ترت می‌کنه."],
        en: ["Let's go! The first step matters most.", "Ready? Let's conquer this section together.", "Every lesson makes you a better doctor."],
      },
      mid: {
        fa: ["عالی پیش می‌ری! همین‌طور ادامه بده.", "نصف راه رو اومدی — عالیه!", "تمرکزت رو نگه دار، داری حرفه‌ای می‌شی."],
        en: ["You're doing great — keep it up!", "Halfway there. Excellent!", "Stay focused, you're becoming a pro."],
      },
      done: {
        fa: ["این بخش رو کامل کردی! بهت افتخار می‌کنم.", "آفرین! یه فصل دیگه از دانشت کامل شد.", "کارت عالی بود — استراحت کوتاه، بعد بخش بعدی!"],
        en: ["You finished this section! So proud of you.", "Nice! Another chapter of knowledge complete.", "Great work — short break, then the next section!"],
      },
    },
  },
  microbe: {
    enabled: true,
    img: "/mascots/microbe.webp",
    lines: {
      fa: ["فکر کردی می‌تونی از پسم بربیای؟", "این چالش رو رد کنی تا باور کنم!", "بذار ببینم چقدر بلدی…"],
      en: ["Think you can beat me?", "Pass this challenge — if you can!", "Let's see what you've got…"],
    },
  },
};

let _cache = null;
let _inflight = null;

/* Fetch (and cache) the mascot config. Returns a promise. */
export function loadMascots() {
  if (_cache) return Promise.resolve(_cache);
  if (_inflight) return _inflight;
  _inflight = api.get("/site-content/mascots")
    .then((d) => { _cache = normalize(d?.mascots); return _cache; })
    .catch(() => { _cache = DEFAULT_MASCOTS; return _cache; })
    .finally(() => { _inflight = null; });
  return _inflight;
}

/* Synchronous current value (defaults until loaded). */
export function currentMascots() { return _cache || DEFAULT_MASCOTS; }

/* Merge a possibly-partial server config over the defaults so a missing field
   never breaks rendering. */
function normalize(m) {
  if (!m || typeof m !== "object") return DEFAULT_MASCOTS;
  const d = DEFAULT_MASCOTS;
  return {
    enabled: m.enabled !== false,
    speed: ["slow", "normal", "fast"].includes(m.speed) ? m.speed : "normal",
    dr: {
      enabled: m.dr?.enabled !== false,
      img: m.dr?.img || d.dr.img,
      guides: (Array.isArray(m.dr?.guides) && m.dr.guides.filter(Boolean).length)
        ? m.dr.guides.filter(Boolean) : d.dr.guides,
      lines: m.dr?.lines || d.dr.lines,
    },
    microbe: {
      enabled: m.microbe?.enabled !== false,
      img: m.microbe?.img || d.microbe.img,
      lines: m.microbe?.lines || d.microbe.lines,
    },
  };
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function pickFrom(arr, seed) {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  return arr[hash(String(seed)) % arr.length];
}

/* Deterministic guide image for a section: rotates through the guide pool so
   different sections get different friendly characters (falls back to dr.img). */
export function guideImg(cfg, seed = "") {
  const pool = (Array.isArray(cfg?.dr?.guides) && cfg.dr.guides.length)
    ? cfg.dr.guides : [cfg?.dr?.img || DEFAULT_MASCOTS.dr.img];
  return pickFrom(pool, String(seed) + "guide") || pool[0];
}

/* Deterministic Dr. Med line for a phase (start|mid|done) + a section seed. */
export function drLine(cfg, lang, phase, seed = "") {
  const L = cfg?.dr?.lines?.[phase] || DEFAULT_MASCOTS.dr.lines[phase] || DEFAULT_MASCOTS.dr.lines.start;
  return pickFrom(L[lang === "en" ? "en" : "fa"] || L.fa, String(seed) + phase);
}

/* Deterministic Microbe line for a boss node seed. */
export function microbeLine(cfg, lang, seed = "") {
  const L = cfg?.microbe?.lines || DEFAULT_MASCOTS.microbe.lines;
  return pickFrom(L[lang === "en" ? "en" : "fa"] || L.fa, String(seed) + "boss");
}
