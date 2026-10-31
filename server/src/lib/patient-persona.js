/* patient-persona.js — who the virtual patient is, socially.

   Two small, deterministic rules that make the simulated patient feel like a
   real person in the room:

   1. NAME. A case card has no patient name. When the student asks for it, the
      patient gives a first name that matches the card's sex, or says that the
      name is on the triage sheet. The choice is fixed per encounter (session),
      so asking twice gives the same answer, while different encounters differ.

   2. TITLE. The patient addresses the student as «دکتر». Only when the
      student's gender is clear from the name do we say «آقای دکتر» / «خانم دکتر».
      Otherwise the patient just says «دکتر» (any «آقا»/«خانم» the model adds is removed).

   Gender is inferred from the first name only, from the lists below. An unknown
   or ambiguous name gives null, and nothing gendered is said. */

// Common Iranian first names. Ambiguous names are left out on purpose.
const MALE_FA = [
  "علی", "حسین", "محمد", "احمد", "رضا", "مهدی", "امیر", "سعید", "حمید", "کامران", "کریم", "ناصر",
  "مرتضی", "جواد", "هادی", "وحید", "بهرام", "فرهاد", "پرویز", "ایرج", "منصور", "محسن", "عباس",
  "غلامرضا", "داریوش", "شاهین", "بهزاد", "آرش", "پیمان", "سهراب", "نوید", "مجید", "اکبر", "یوسف",
  "ایمان", "سینا", "نیما", "کیانوش", "جمشید", "قاسم", "خسرو", "حامد", "بابک", "میثم", "سامان",
  "محمدمهدی", "امیرمحمد", "امیرمهدی", "مصطفی", "علیرضا", "پوریا", "پارسا", "شایان", "عرشیا",
  "کیان", "یاسان", "محمدسعید", "سجاد", "احسان", "میلاد", "امین", "کیوان", "رامین", "آرمین",
];
const FEMALE_FA = [
  "زهرا", "فاطمه", "مریم", "سارا", "نرگس", "فریبا", "شهلا", "معصومه", "پروین", "مهین", "طاهره",
  "زینب", "لیلا", "مینا", "سمانه", "نیلوفر", "ریحانه", "آتوسا", "پریسا", "شیرین", "گلنار", "سیما",
  "فرزانه", "مهسا", "ساناز", "الهه", "هما", "مهشید", "صدف", "ژاله", "فرشته", "سحر", "ندا", "رعنا",
  "پگاه", "آزاده", "شقایق", "الناز", "یلدا", "نسرین", "پروانه", "اعظم", "صبا", "نازنین", "مبینا",
  "یاسمن", "ستاره", "دیبا", "نگار", "الهام", "سپیده", "شادی", "رویا", "هانیه", "ساره", "عاطفه",
];
const MALE_EN = [
  "Ali", "Hossein", "Mohammad", "Ahmad", "Reza", "Mehdi", "Amir", "Saeed", "Hamid", "Kamran", "Karim",
  "Nasser", "Morteza", "Javad", "Hadi", "Vahid", "Farhad", "Parviz", "Mohsen", "Abbas", "Behzad",
  "Arash", "Peyman", "Sohrab", "Navid", "Majid", "Yousef", "Iman", "Sina", "Nima", "Kian", "Babak",
  "Mostafa", "Alireza", "Pouya", "Parsa", "Shayan", "Sajjad", "Ehsan", "Milad", "Amin", "Ramin", "Armin",
];
const FEMALE_EN = [
  "Zahra", "Fatemeh", "Maryam", "Sara", "Narges", "Fariba", "Shahla", "Masoumeh", "Parvin", "Mahin",
  "Zeinab", "Leila", "Mina", "Samaneh", "Niloufar", "Reyhaneh", "Atousa", "Parisa", "Shirin", "Sima",
  "Farzaneh", "Mahsa", "Sanaz", "Elahe", "Homa", "Sadaf", "Fereshteh", "Sahar", "Neda", "Pegah",
  "Azadeh", "Shaghayegh", "Elnaz", "Yalda", "Nasrin", "Nazanin", "Mobina", "Yasaman", "Setareh",
  "Diba", "Negar", "Elham", "Sepideh", "Shadi", "Roya", "Hanieh", "Samira", "Golnaz",
];

const ARABIC_FA = (s) => String(s || "").replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[\u064B-\u065F\u0670]/g, "").replace(/\u200c/g, "").trim();

function firstToken(s) {
  return ARABIC_FA(s).split(/\s+/).filter(Boolean)[0] || "";
}

/* Male / female from a student's name. Persian name first, then English. Returns
   null when the name is not in the lists (so the patient uses «دکتر» only). */
export function genderFromStudentName({ name_fa, name_en } = {}) {
  const fa = firstToken(name_fa);
  if (fa) {
    if (MALE_FA.includes(fa)) return "male";
    if (FEMALE_FA.includes(fa)) return "female";
  }
  const en = firstToken(name_en).toLowerCase();
  if (en) {
    if (MALE_EN.some((n) => n.toLowerCase() === en)) return "male";
    if (FEMALE_EN.some((n) => n.toLowerCase() === en)) return "female";
  }
  return null;
}

/* Stable pseudo-random number from a string (FNV-1a). Same seed → same choice. */
function hash(s) {
  let h = 0x811c9dc5;
  for (const ch of String(s)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function patientSex(caseData) {
  const v = String(caseData?.sex || "").trim().toLowerCase();
  if (v === "male" || v === "m" || v === "مرد") return "male";
  if (v === "female" || v === "f" || v === "زن" || v === "خانم") return "female";
  return null;
}

/* What the patient answers to «what is your name?». The answer is a fixed choice
   for one encounter (seed = session id). A name written on the case wins. */
export function patientNameAnswer(caseData, seed, lang) {
  const fa = lang === "fa";
  const written = fa ? (caseData?.patient_name_fa || caseData?.patient_name) : (caseData?.patient_name_en || caseData?.patient_name);
  if (written && typeof written === "string" && written.trim()) {
    const n = written.trim();
    return fa ? `اسمم ${n} است دکتر.` : `My name is ${n}, doctor.`;
  }
  const h = hash(`${seed || "0"}|name`);
  // One encounter in three: the name is on the triage sheet instead of spoken.
  if (h % 3 === 0) {
    return fa ? "اسمم روی برگه تریاژ نوشته شده دکتر." : "My name is on the triage sheet, doctor.";
  }
  const sex = patientSex(caseData);
  const pool = sex === "female" ? (fa ? FEMALE_FA : FEMALE_EN) : sex === "male" ? (fa ? MALE_FA : MALE_EN) : null;
  if (!pool) return fa ? "اسمم روی برگه تریاژ نوشته شده دکتر." : "My name is on the triage sheet, doctor.";
  const n = pool[Math.floor(h / 3) % pool.length];
  return fa ? `اسمم ${n} است دکتر.` : `My name is ${n}, doctor.`;
}

/* Persian honorific for the student. Removes any «آقا/خانم» the model put in front
   of «دکتر», then adds the one the student's gender allows (or nothing). */
export function addressDoctor(text, studentGender) {
  const s = String(text || "");
  if (!s.includes("دکتر")) return s;
  const title = studentGender === "male" ? "آقای دکتر" : studentGender === "female" ? "خانم دکتر" : "دکتر";
  return s.replace(/(?:آقای\s*|آقا\s*|خانم\s*)?دکتر(?![\p{L}\p{M}\u200c])/gu, title);
}
