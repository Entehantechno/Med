/* ================================================================
   masterbank-md.js — parse the AUTHORITATIVE bilingual master-bank
   Markdown books shipped inside medschool.zip (GitHub branch `main`):

     بانک_کامل_دوزبانه_سوالات_و_درسنامه_پره_انترنی.md   (pre-internship)
     بانک_تجمعی_کامل_دوزبانه_دستیاری_نسخه_جاری.md       (residency)

   Pure ESM, no I/O, no app imports: tools/master-bank/build.mjs turns the
   returned question arrays into import-payload JSON parts.

   Golden rules learned while auditing the books:
     * Persian-digit classes must include [۰-۹] AND Arabic-Indic [٠-٩];
       JS \d never matches them.
     * NEVER use a character class for the multi-char Persian letter
       الف — always an alternation, and index with the FIRST character.
     * Repeated wrong options exist in the source booklets; duplicate
       option TEXT is not a parser failure.
     * The RAPID appendix is the final registry-corrected key; but an
       explicit "پاسخ علمی اصلاح‌شده" wins over it.
     * Indeterminate RAPID answers (هیچ‌کدام / قابل‌تعیین‌نیست) and
       stitched/OCR-bleed option sets are DROPPED, never invented.
     * Residency subject classification scans the STEM FIRST; option
       text contains distractor noise and must never flip a subject.
   ================================================================ */

/* ---------------- basic helpers ---------------- */

export function toLatinDigits(s) {
  return String(s == null ? "" : s)
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
}

const ZERO_JOINERS = /[‌‍­]/g;
const INVISIBLE = /[​-‏‪-‮⁠﻿]/g;

/** Normalise for key lookups: drop ZWNJ/invincible, collapse spaces. */
function normKey(s) {
  return String(s || "")
    .replace(INVISIBLE, "")
    .replace(ZERO_JOINERS, "")
    .replace(/[آ]/g, "ا")
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function clean(s) {
  return String(s == null ? "" : s)
    .replace(/\*\*|__|(?<!\w)#+\s*/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+([.,;:!؟?،)])/g, "$1")
    .replace(/([(])\s+/g, "$1")
    .replace(INVISIBLE, "")
    .trim();
}

function clip(s, n) {
  const t = clean(s);
  return t.length > n ? t.slice(0, n - 1).trim() + "…" : t;
}

/** Split a document into Map(headerCapture -> body) using a header regex
 *  whose first capture group is the block id. */
function splitBlocks(text, headerRe) {
  const map = new Map();
  const re = new RegExp(headerRe.source, "g");
  const marks = [];
  let m;
  while ((m = re.exec(text))) marks.push({ id: m[1], start: m.index, headEnd: re.lastIndex });
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].start : text.length;
    map.set(marks[i].id, text.slice(marks[i].headEnd, end));
  }
  return map;
}

/** Text under a literal bold label, e.g. **صورت سؤال:** … up to the next
 *  bold label / heading / blank-bullet boundary. Labels are literal
 *  strings; do not embed regex quantifiers in them. */
export function labelledText(body, labels) {
  for (const label of labels) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      "(?:^|\\n)\\s*(?:[-*]\\s*)?\\*{0,2}\\s*" + esc + "\\s*\\*{0,2}\\s*[:：]\\s*\\*{0,2}\\s*" +
      "([^\\n]*(?:\\n(?!\\s*(?:[-*]\\s*)?\\*{1,2}[^*\\n]{1,48}[:：]|#{1,4}\\s|[-*]\\s*(?:[الفبجد]|[A-D])[\\s\\)ـ–—-])[^\\n]*)*)",
      ""
    );
    const m = body.match(re);
    if (m && clean(m[1])) return clean(m[1]);
  }
  return "";
}

/** Text under a ### section heading until the next heading of same/higher
 *  level. */
function sectionText(body, headings) {
  for (const h of headings) {
    const esc = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|\\n)#{1,4}\\s*${esc}[^\\n]*\\n([\\s\\S]*?)(?=\\n#{1,4}\\s|$)`);
    const m = body.match(re);
    if (m && clean(m[1])) return m[1];
  }
  return "";
}

/* ---------------- letters ---------------- */

const LETTERS_FA = ["الف", "ب", "ج", "د"];
function faLetterIndex(ch) {
  const s = String(ch == null ? "" : ch);
  if (s === "الف" || s.startsWith("الف") || s[0] === "ا" || s[0] === "آ") return 0;
  const map = { ب: 1, ج: 2, چ: 2, د: 3 };
  return s[0] in map ? map[s[0]] : -1;
}
function enLetterIndex(ch) {
  const map = { A: 0, B: 1, C: 2, D: 3 };
  const u = String(ch || "").toUpperCase();
  return u in map ? map[u] : -1;
}

/* ---------------- subjects ---------------- */

const SUBJECT_EN = {
  "داخلی": "Internal Medicine",
  "بیماری‌های عفونی": "Infectious Diseases",
  "نورولوژی": "Neurology",
  "پاتولوژی": "Pathology",
  "کودکان": "Pediatrics",
  "جراحی": "Surgery",
  "زنان و زایمان": "Obstetrics & Gynecology",
  "اورولوژی": "Urology",
  "ارتوپدی": "Orthopedics",
  "گوش و حلق و بینی": "ENT",
  "چشم‌پزشکی": "Ophthalmology",
  "پوست": "Dermatology",
  "روانپزشکی": "Psychiatry",
  "رادیولوژی": "Radiology",
  "فارماکولوژی": "Pharmacology",
  "آمار و اپیدمیولوژی": "Statistics & Epidemiology",
  "اخلاق پزشکی": "Medical Ethics",
  "ایمنی‌شناسی": "Immunology",
  "ژنتیک پزشکی": "Medical Genetics",
  "فیزیک پزشکی": "Medical Physics",
  "تغذیه": "Nutrition",
};

export const INTERNAL_CHAPTERS = new Map([
  ["قلب", { fa: "قلب", en: "Cardiology" }],
  ["گوارش", { fa: "گوارش", en: "Gastroenterology" }],
  ["ریه و مسمومیت", { fa: "ریه و مسمومیت", en: "Pulmonology & Toxicology" }],
  ["غدد", { fa: "غدد", en: "Endocrinology" }],
  ["کلیه", { fa: "کلیه", en: "Nephrology" }],
  ["روماتولوژی", { fa: "روماتولوژی", en: "Rheumatology" }],
  ["هماتولوژی و انکولوژی", { fa: "هماتولوژی و انکولوژی", en: "Hematology & Oncology" }],
]);

const INTERNAL_ALIAS = {
  "قلب": "قلب", "گوارش": "گوارش", "ریه": "ریه و مسمومیت",
  "ریه و مسمومیت": "ریه و مسمومیت", "مسمومیت": "ریه و مسمومیت",
  "غدد": "غدد", "کلیه": "کلیه", "روماتولوژی": "روماتولوژی",
  "هماتولوژی و انکولوژی": "هماتولوژی و انکولوژی",
  "هماتولوژی": "هماتولوژی و انکولوژی",
  "خون و انکولوژی": "هماتولوژی و انکولوژی", "داخلی": "",
};

/* Exact subject aliases keyed on normKey(). */
const SUBJECT_ALIASES = {
  "داخلی": "داخلی", "internal": "داخلی", "internal medicine": "داخلی",
  "بیماریهای عفونی": "بیماری‌های عفونی", "بیماری های عفونی": "بیماری‌های عفونی",
  "عفونی": "بیماری‌های عفونی", "infectious diseases": "بیماری‌های عفونی",
  "عفونی اطفال": "بیماری‌های عفونی",
  "نورولوژی": "نورولوژی", "مغز و اعصاب": "نورولوژی", "neurology": "نورولوژی",
  "پاتولوژی": "پاتولوژی", "اسیب شناسی": "پاتولوژی", "آسیب شناسی": "پاتولوژی",
  "اسیبشناسی اختصاصی": "پاتولوژی", "اسیب شناسی اختصاصی": "پاتولوژی",
  "آسیب شناسی اختصاصی": "پاتولوژی", "pathology": "پاتولوژی",
  "کودکان": "کودکان", "اطفال": "کودکان", "pediatrics": "کودکان",
  "جراحی": "جراحی", "جراحی عمومی": "جراحی", "surgery": "جراحی",
  "زنان و زایمان": "زنان و زایمان", "زنان": "زنان و زایمان", "مامایی": "زنان و زایمان",
  "gynecology and obstetrics": "زنان و زایمان",
  "obstetrics and gynecology": "زنان و زایمان", "obstetrics & gynecology": "زنان و زایمان",
  "اورولوژی": "اورولوژی", "urology": "اورولوژی", "کلیه و مجاری ادراری": "اورولوژی",
  "ارتوپدی": "ارتوپدی", "ارتوپد": "ارتوپدی", "orthopedics": "ارتوپدی",
  "گوش و حلق و بینی": "گوش و حلق و بینی", "گوش حلق و بینی": "گوش و حلق و بینی",
  "ent": "گوش و حلق و بینی", "otolaryngology": "گوش و حلق و بینی",
  "چشم پزشکی": "چشم‌پزشکی", "چشم‌پزشکی": "چشم‌پزشکی", "چشم": "چشم‌پزشکی",
  "ophthalmology": "چشم‌پزشکی",
  "پوست": "پوست", "پوست و مو": "پوست", "dermatology": "پوست",
  "روانپزشکی": "روانپزشکی", "روان پزشکی": "روانپزشکی", "روان‌پزشکی": "روانپزشکی",
  "psychiatry": "روانپزشکی",
  "رادیولوژی": "رادیولوژی", "radiology": "رادیولوژی",
  "فارماکولوژی": "فارماکولوژی", "فارما": "فارماکولوژی", "pharmacology": "فارماکولوژی",
  "امار و اپیدمیولوژی": "آمار و اپیدمیولوژی", "آمار و اپیدمیولوژی": "آمار و اپیدمیولوژی",
  "امار": "آمار و اپیدمیولوژی", "اپیدمیولوژی": "آمار و اپیدمیولوژی",
  "statistics & epidemiology": "آمار و اپیدمیولوژی",
  "اخلاق پزشکی": "اخلاق پزشکی", "اخلاق": "اخلاق پزشکی", "medical ethics": "اخلاق پزشکی",
  "ایمنی شناسی": "ایمنی‌شناسی", "ایمنی‌شناسی": "ایمنی‌شناسی",
  "ایمونولوژی": "ایمنی‌شناسی", "immunology": "ایمنی‌شناسی",
  "اسیبشناسی": "پاتولوژی",
  "ایمنیشناسی": "ایمنی‌شناسی",
  "ژنتیک پزشکی": "ژنتیک پزشکی", "ژنتیک": "ژنتیک پزشکی", "medical genetics": "ژنتیک پزشکی",
  "فیزیک پزشکی": "فیزیک پزشکی", "medical physics": "فیزیک پزشکی",
  "تغذیه": "تغذیه", "علوم تغذیه": "تغذیه", "nutrition": "تغذیه", "nutrition & diet therapy": "تغذیه",
};

function subjectResult(name, chapterName = "") {
  const ch = chapterName ? INTERNAL_CHAPTERS.get(chapterName) : null;
  return {
    subject_fa: name,
    subject_en: SUBJECT_EN[name] || name,
    subject_track: ["داخلی", "جراحی", "کودکان", "زنان و زایمان"].includes(name) ? "major" : "minor",
    chapter_fa: ch ? ch.fa : "",
    chapter_en: ch ? ch.en : "",
  };
}

/** Canonicalise a raw درس label. Internal chapters (گوارش/قلب/…) resolve to
 *  subject داخلی with chapter_fa set. Combined « / » labels take the FIRST
 *  token, except the combined ortho/urology booklet suffix which decides. */
export function canonicalSubject(raw) {
  if (!raw || !String(raw).trim()) return null;
  let label = String(raw).trim().replace(/\s+\/\s*$/, "");

  // combined ortho/urology booklet: suffix decides
  const ou = label.match(/ارتوپدی\s*\/\s*اورولوژی\s*[\/،,]\s*(ارتوپدی|اورولوژی)/);
  if (ou) return subjectResult(ou[1] === "اورولوژی" ? "اورولوژی" : "ارتوپدی");
  if (/^\s*ارتوپدی\s*\/\s*اورولوژی\s*$/.test(label)) return subjectResult("ارتوپدی");

  // internal chapters (standalone or combined — first token wins)
  const firstTok = label.split(/\s*[\/،,]\s*/)[0].trim();
  if (normKey(firstTok) in Object.fromEntries(Object.keys(INTERNAL_ALIAS).map((k) => [normKey(k), k]))) {
    const chName = INTERNAL_ALIAS[firstTok];
    return subjectResult("داخلی", chName);
  }

  const key = normKey(firstTok);
  if (SUBJECT_ALIASES[key]) return subjectResult(SUBJECT_ALIASES[key]);

  // last-ditch: substring match on alias keys
  for (const [alias, canon] of Object.entries(SUBJECT_ALIASES)) {
    if (key.includes(normKey(alias))) return subjectResult(canon);
  }
  return null;
}

/* ---------------- option parsing ---------------- */

const RIGHT_RE = /(?:صحیح\s*(?:است|می[‌\s]?باشد)|درست\s*(?:است|می[‌\s]?باشد)|گزینه\s*منتخب|پاسخ\s*منتخب|همسو\s*است|is\s*correct|are\s*correct|correct[.\s;]|it\s*is\s*correct|✔|✅)/i;
const WRONG_RE = /^(?:نادرست|غلط|اشتباه|انتخاب اول نیست|در این سؤال انتخاب اول نیست|این گزینه نسبت|این گزینه در مقایسه با پاسخ صحیح|تطابق\s*(?:کمتری|ندارد)|not\s*the\s*first|incorrect|it\s*is\s*not|does\s*not|compared\s*to\s*the\s*correct)/i;
const PLACEHOLDER_RE = /گزینه\s*در\s*(?:منبع\s*)?متنی?\s*موجود\s*نیست|گزینه\s*در\s*متن\s*موجود\s*نیست|پاسخ‌?سازی\s*مجاز\s*نیست/;

/** True / false / null from an option's verdict text + check mark. */
function rightFromOption(o) {
  const blob = `${o.verdict || ""} ${o.tail || ""} ${o.raw || ""}`;
  if (/[✅✔]/.test(o.raw)) return true;
  const head = (o.verdict || "").trim();
  if (WRONG_RE.test(head)) return false;
  if (RIGHT_RE.test(head)) return true;
  // verdicts can sit at the very start of the tail
  const tailHead = (o.tail || "").trim().slice(0, 60);
  if (WRONG_RE.test(tailHead)) return false;
  if (RIGHT_RE.test(tailHead)) return true;
  return null;
}

const FA_OPTION_LINE = /^[-*]\s*\*{0,2}\s*(الف|ب|ج|د)\s*(?:[/／]\s*([A-D]))?\s*[)）]?\s*(?:[\ـ\-–—.:،]\s*|\s+)?([\s\S]*?)$/;

/** Parse every Persian option/analysis line in a chunk.
 *  Returns Map<index, {i, letter, enLetter, text, verdict, tail, raw, line}> */
export function parseFaOptionLines(text) {
  const map = new Map();
  if (!text) return map;
  const lines = text.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!/^\s*[-*]\s*\*{0,2}\s*(?:الف|ب|ج|د)/.test(line)) continue;
    const m = line.match(FA_OPTION_LINE);
    if (!m) continue;
    const i = faLetterIndex(m[1]);
    if (i < 0) continue;
    let enLetter = m[2] ? enLetterIndex(m[2]) : -1;
    let textOpt = "", verdict = "", tail = "";
    const rawRest = m[3] || "";
    let rest = rawRest.replace(/^\*\*/, "").replace(/^[\u0640\u2013\u2014\-]\s*/, "");

    // bold may close after the option text + verdict: "...:** tail"
    const boldClose = rest.indexOf("**");
    const boldSegment = boldClose >= 0 ? rest.slice(0, boldClose) : null;
    if (boldSegment !== null) {
      const vm = boldSegment.match(/^(.*?)[.:：،]\s*(صحیح[\s\S]*|درست[\s\S]*|نادرست[\s\S]*|غلط[\s\S]*|اشتباه[\s\S]*|انتخاب اول نیست[\s\S]*|این گزینه[\s\S]*|is correct[\s\S]*|it is correct[\s\S]*|incorrect[\s\S]*|not the first[\s\S]*|Correct[\s\S]*)$/i);
      if (vm) {
        textOpt = vm[1]; verdict = vm[2]; tail = rest.slice(boldClose + 2);
      } else {
        // whole bold segment is the option text (option-only line)
        textOpt = boldSegment; tail = rest.slice(boldClose + 2);
      }
    } else {
      // non-bold line: pull a leading verdict if present after a colon
      const vm = rest.match(/^(.*?)[.:：،]\s*(صحیح[\s\S]*|درست[\s\S]*|نادرست[\s\S]*|غلط[\s\S]*|اشتباه[\s\S]*|این گزینه[\s\S]*)$/);
      if (vm && /^(صحیح|درست|نادرست|غلط|اشتباه|این گزینه)/.test(vm[2])) {
        textOpt = vm[1]; verdict = vm[2];
      } else {
        textOpt = rest;
      }
    }

    // bilingual inline option: "متن فارسی — _English text_"
    let enText = "";
    const bi = textOpt.match(/^([\s\S]*?)\s*[—–-]\s*_([^_]+)_\s*$/);
    if (bi) { textOpt = bi[1]; enText = bi[2]; }
    const biTail = tail.match(/^\s*[—–-]\s*_([^_]+)_/);
    if (biTail && !enText) { enText = biTail[1]; tail = tail.replace(biTail[0], ""); }

    // check mark at the end of either segment
    const joinedRaw = `${rawRest} ${boldSegment !== null ? boldSegment : ""} ${tail}`;
    textOpt = clean(textOpt.replace(/[✅✔]\s*$/, ""));
    tail = clean(tail.replace(/^[.,;:!؟?،\-—–\s]+/, ""));
    verdict = clean(verdict);
    if (!enText) {
      const em = (boldSegment || "").match(/[—–-]\s*_([^_]+)_/) || tail.match(/[—–-]\s*_([^_]+)_/);
      if (em) enText = em[1];
    }
    const existing = map.get(i);
    if (existing && existing.text && textOpt) {
      // duplicated analysis lines: keep the longer text, union the marks
      if (textOpt.length > existing.text.length) existing.text = textOpt;
      if (enText && !existing.enText) existing.enText = enText;
      if (rightFromOption({ raw: joinedRaw, verdict, tail }) === true) existing.rightMark = true;
      continue;
    }
    map.set(i, {
      i, letter: m[1], enLetter, text: textOpt, enText: clean(enText),
      verdict, tail, raw: joinedRaw,
      rightMark: /[✅✔]/.test(joinedRaw),
    });
  }
  return map;
}

export function buildFaOptionArray(map) {
  const out = ["", "", "", ""];
  for (const [i, o] of map) out[i] = clean(o.text);
  return out;
}
export function buildEnOptionArray(map) {
  const out = ["", "", "", ""];
  for (const [i, o] of map) {
    if (o.enLetter >= 0 && o.enLetter !== i) {
      // bilingual header maps Persian position i to English letter slot same i
    }
    out[i] = clean(o.enText || "");
  }
  return out;
}

/** English A)-D) option bullets (plain list or bold analysis lines). */
export function parseEnOptionBullets(text) {
  const out = ["", "", "", ""];
  const re = /^[-*]\s*\*{0,2}\s*([A-D])\b\s*[)）]?\s*(?:[\-–—.:،]\s*)?([^\n*]*)$/gm;
  let m;
  while ((m = re.exec(text))) {
    const i = enLetterIndex(m[1]);
    if (i < 0 || out[i]) continue;
    let t = m[2] || "";
    // strip verdict after a colon ("Pneumothorax: is correct; ...")
    const vm = t.match(/^([\s\S]*?)\s*:\s*(?:is\s*correct|are\s*correct|it\s*is\s*correct|correct|incorrect|not the first|does not|compared to)[\s\S]*$/i);
    if (vm && vm[1].trim().length >= 1) t = vm[1];
    t = clean(t.replace(/[✅✔]\s*$/, ""));
    if (t && !PLACEHOLDER_RE.test(t)) out[i] = t;
  }
  return out;
}

export function validOptionSet(arr) {
  if (!Array.isArray(arr) || arr.length !== 4) return false;
  for (const t of arr) {
    if (!t || String(t).trim().length < 1) return false;
    if (PLACEHOLDER_RE.test(t)) return false;
  }
  // same text repeated four times is an OCR collapse
  const norm = arr.map((t) => normKey(t));
  if (new Set(norm).size === 1) return false;
  return true;
}

/** OCR bleed: option text that swallowed the next question's stem, exam
 *  boilerplate, or a numbered next stem ("14- کدام گزینه…"). */
export function optionSetHasBleed(opts) {
  const BOILER = /بسمه\s*تعالی|داوطلب\s*محترم|دبیرخانه\s*شورای\s*آموزش|موفق\s*باشید|پذیرای\s*اعتراض|کلید\s*اولیه|پاسخنامه\s*تشریحی/;
  const NEXT_STEM = /\d{1,3}\s*[-–—]\s*(?:کدام|بهترین\s*گزینه|مناسب‌?ترین\s*اقدام|صحیح‌?ترین\s*است|کدامیک|کدام‌?یک)/;
  const SWALLOW = /(?:آقای|خانم|پسر|دختر|نوزاد|شیرخوار|کودک\s*\d|بیمار(?:ی)?\s+\d)[^|]{20,}[،.]\s*(?:کدام|بهترین|مناسب‌?ترین|صحیح‌?ترین|محتم ل?‌?ترین)/;
  for (const t of opts || []) {
    const s = String(t || "");
    if (BOILER.test(s)) return true;
    if (NEXT_STEM.test(s)) return true;
    if (SWALLOW.test(s)) return true;
  }
  return false;
}

/* ---------------- pre-internship helpers ---------------- */

const MONTHS_FA = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const MONTHS_EN = ["Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar", "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand"];

function parseIdentity(line) {
  const out = { year: "", year_num: null, month: "", month_en: "", scope: "", pole: "", sitting: "", subject_raw: "", source_qno: null };
  if (!line) return out;
  const fa = toLatinDigits(line);
  const ym = fa.match(/(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)\s*(\d{4})/);
  if (ym) {
    out.month = ym[1];
    out.month_en = MONTHS_EN[MONTHS_FA.indexOf(ym[1])];
    out.year = toPersianDigits(ym[2]);
    out.year_num = Number(ym[2]);
  } else {
    const y = fa.match(/\b(1[34]\d{2})\b/);
    if (y) { out.year = toPersianDigits(y[1]); out.year_num = Number(y[1]); }
  }
  out.sitting = /میان.?دوره|midterm|intermediate/i.test(line) ? "midterm" : "main";
  const pole = line.match(/قطب\s+([^|‌\n]+?)(?:\s*\||$)/);
  if (/کشوری|ملی|سراسری|هشت قطب مشترک/.test(line)) { out.scope = "ملی"; }
  else if (pole) { out.scope = "قطبی"; out.pole = clean(pole[1]); }
  const qm = fa.match(/شماره\s*سؤال\s*منبع[:：]?\s*(\d+)/);
  if (qm) out.source_qno = Number(qm[1]);
  const sm = line.match(/درس[:：]\s*([^|\n]+)$/);
  if (sm) out.subject_raw = clean(sm[1]);
  return out;
}
function toPersianDigits(s) {
  return String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
}

function questionStyle(stem, fa = true) {
  const s = String(stem || "");
  if (/تصویر|شکل\s*\d|وابسته\s*به\s*تصویر|image|figure/i.test(s)) return "image";
  if (fa && /\bبجز\b|به\s*جز|همه\s*موارد\s*زیر|کدام\s*(?:نادرست|غلط|صحیح\s*نیست|اشتباه|مناسب\s*نیست|لازم\s*نیست|قرار\s*نمی‌?گیرد)|جمله[ٔ‌]?\s*(?:غلط|نادرست|اشتباه)|اشتباه\s*است|مناسب\s*نیست|کم\s?تر\s*کمک\s*کننده|least\s+(?:likely|appropriate|helpful)|except|all of the following/i.test(s)) return "negative";
  if (/(آقای|خانم|پسر\s*\d|دختر\s*\d|کودک\s*\d|نوزاد|شیرخوار|بیمار(?:ی)?\s+\d|مرد\s*\d|زن\s*\d|پسر[ی‌]|دختری|سال ه ا|ساله)/.test(s)) return "case";
  return "recall";
}

/** Answer letter after a bold label, or null when indeterminate. */
function labelledAnswerFa(body, labels) {
  for (const label of labels) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\*{0,2}\\s*${esc}\\s*\\*{0,2}\\s*[:：]\\s*\\*{0,2}\\s*[«"']?\\s*([الفبجد])`, "");
    const m = body.match(re);
    if (m) {
      // reject non-answers printed on the same line
      const tail = body.slice(m.index, m.index + 120);
      if (/هیچ‌? ?کدام|قابل‌? ?تعیین‌? ?نیست|قابل تعیین|منسوخ|فاقد\s*گزینه|گزینه\s*صحیح(?:ی)?\s*(?:در|وجود\s*ندارد)|نمی‌?توان/.test(tail)) return null;
      return faLetterIndex(m[1]);
    }
  }
  return null;
}

/* The auditors sometimes print a MULTI-option verdict ("پاسخ نهایی: الف، ب و د"
 * or, for a negative stem, "ب و ج توصیه نمی‌شوند"). Such an item has no single
 * best answer and must ship keyless (bank-only, never graded). The one
 * exception: a line that rejects several options and explicitly affirms the
 * sole remaining one ("الف، ب و ج ناسازگارند؛ د علت معتبر است") — that is a
 * single key with a verbose explanation. Returns { letters, single } or null. */
function multiAnswerFa(body, labels) {
  const NAMES = ["الف", "ب", "ج", "د"];
  for (const label of labels) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\*{0,2}\\s*${esc}\\s*\\*{0,2}\\s*[:：]\\s*\\*{0,2}\\s*[«"']?\\s*([^\\n]{0,120})`);
    const m = body.match(re);
    if (!m) continue;
    const line = m[1];
    let head = line;
    // the option-letter run ends at the explanation dash ("الف ـ ..." or
    // "الف ـ، ..." — OCR sometimes glues the comma to the dash); letters
    // inside the explanation text (e.g. vaccine "ب ث ژ" = BCG) are not options
    const dash = head.search(/\s[ـ\-–—]/);
    if (dash >= 0) head = head.slice(0, dash);
    const tokRe = /(?:^|[\s،,٬«»"'])(الف|ب|ج|د)(?=$|[\s،,٬«»"'\-ـ–—.])/g;
    const found = [];
    let mm;
    while ((mm = tokRe.exec(head))) {
      const i = faLetterIndex(mm[1]);
      if (i >= 0 && !found.includes(i)) found.push(i);
    }
    if (found.length < 2) continue;
    let single = null;
    const neg = /نادرست|غلط|اشتباه|نمی‌?شوند|نیستند|نمی‌?شود|نیست|توصیه نمی|مناسب نیست|ناسازگار|غیرتیپیک|غیر\s?ضروری|رویکرد مناسب|قرار نمی|لازم نیست|پشتیبانی نمی|کاربرد ندارد/.test(line);
    const others = [0, 1, 2, 3].filter((i) => !found.includes(i));
    if (neg && others.length === 1) {
      const r = NAMES[others[0]];
      const aff = new RegExp(`[،؛]\\s*[«"']?${r}[»"']?[^\\n]{0,50}?(معتبر|صحیح|درست|پاسخ|توصیه می‌شود|مناسب)`);
      const segMatch = line.match(aff);
      const seg = segMatch ? segMatch[0] : "";
      if (seg && !/نادرست|غلط|نیست|نمی/.test(seg.replace(r, ""))) single = others[0];
    }
    return { letters: found.sort((a, b) => a - b), single };
  }
  return null;
}

function goldenAndMnemonic(body) {
  let golden = "", mnemonic = "";
  const g = body.match(/\*\*(?:🏅\s*)?نکته[ٔ‌]?\s*طلایی[:：]\*\*\s*([^\n]+)/);
  if (g) golden = clean(g[1]);
  const mm = body.match(/\*\*(?:🧠\s*)?رمز\s*(?:حافظه|حفظی|حافظه)[:：]\*\*\s*([^\n]+)/);
  if (mm) mnemonic = clean(mm[1]);
  return { golden, mnemonic };
}

function preWhy(map) {
  const out = ["", "", "", ""];
  for (const [i, o] of map) {
    const right = rightFromOption(o);
    const verdictTxt = right === true ? "صحیح است" : right === false ? "نادرست است" : "";
    const tail = o.tail || "";
    const text = [verdictTxt, tail].filter(Boolean).join(verdictTxt && tail ? (tail.startsWith("؛") || tail.startsWith("،") ? "" : "؛ ") : " ");
    out[i] = clip(text, 320);
  }
  return out;
}

/* ---------------- English counterpart block ---------------- */

function parsePreEnBlock(eb) {
  const out = { stem: "", options: [], lesson: "", golden: "" };
  if (!eb) return out;
  out.stem = labelledText(eb, ["Question", "Stem (English)", "Stem"]);
  // strip an embedded A)-D) list from the stem
  out.stem = out.stem.split(/\n\s*A\)/)[0].trim();
  const analysisAt = eb.search(/#{2,4}\s*(?:Option analysis|Analysis of options|Independent option)/);
  const head = analysisAt >= 0 ? eb.slice(0, analysisAt) : eb;
  let opts = parseEnOptionBullets(head);
  if (!validOptionSet(opts) && analysisAt >= 0) opts = parseEnOptionBullets(eb.slice(analysisAt));
  out.options = opts;
  out.lesson = clip(
    labelledText(eb, ["Comprehensive microlearning lesson", "Microlearning textbook", "Microlearning note", "Microlearning note (English)"]) ||
    sectionText(eb, ["Comprehensive microlearning lesson", "Microlearning textbook", "Microlearning note"]),
    700);
  const g = eb.match(/\*\*(?:Clinical pearl|Golden point|Golden tip|Gold tip|Golden Tip)[:：]\*\*\s*([^\n]+)/i);
  if (g) out.golden = clean(g[1]);
  return out;
}

/* ================================================================
   PRE-INTERNSHIP MASTER
   ================================================================ */

export function parsePreintMaster(text) {
  const appendixAt = text.indexOf("# بخش دوم");
  const mainText = appendixAt >= 0 ? text.slice(0, appendixAt) : text;
  const rapidText = appendixAt >= 0 ? text.slice(appendixAt) : "";

  const faMain = splitBlocks(mainText, /\n## (QB-\d{5})(?![-\d])[^\n]*\n/);
  const enMain = splitBlocks(mainText, /\n## (EN-QB-\d{5})[^\n]*\n/);
  const rapid = splitBlocks(rapidText, /\n## (RAPID-QB-\d{5})[^\n]*\n/);
  let enSupp = new Map();
  const suppAt = mainText.indexOf("Retrospective English");
  if (suppAt >= 0) enSupp = splitBlocks(mainText.slice(suppAt), /\n### (EN-QB-\d{5})[^\n]*\n/);

  const stats = { total: 0, imported: 0, keyed: 0, keyless: 0, unresolved: 0, badOptions: 0, noSubject: 0, tooShort: 0, incompleteMedia: 0, subjects: {} };
  const questions = [];

  const ids = [...faMain.keys()].map((id) => Number(id.slice(3))).sort((a, b) => a - b);
  stats.total = ids.length;

  for (const num of ids) {
    const id = `QB-${String(num).padStart(5, "0")}`;
    const mb = faMain.get(id) || "";
    const rb = rapid.get(`RAPID-${id}`) || "";
    const eb = enMain.get(`EN-${id}`) || "";
    const es = enSupp.get(`EN-${id}`) || "";

    const idLine = labelledText(mb, ["شناسنامه سؤال", "Question identity"]);
    const identity = parseIdentity(idLine);

    const rapidSubject = (() => { const m = rb.match(/\*\*درس[:：]\*\*\s*(.+?)\s*$/m); return m ? clean(m[1]) : ""; })();
    const subj = canonicalSubject(identity.subject_raw) || canonicalSubject(rapidSubject);
    if (!subj) { stats.noSubject++; continue; }

    const mainOpts = parseFaOptionLines(sectionText(mb, ["تحلیل گزینه‌ها"]) || mb);
    const rapidOpts = parseFaOptionLines(sectionText(rb, ["تحلیل سریع گزینه‌ها"]) || rb);
    let optsFa = buildFaOptionArray(mainOpts.size >= 4 ? mainOpts : rapidOpts);
    const useMain = mainOpts.size >= 4;
    const optMap = useMain ? mainOpts : rapidOpts;
    if (!validOptionSet(optsFa) || optionSetHasBleed(optsFa)) {
      if (!useMain) { stats.badOptions++; continue; }
      optsFa = buildFaOptionArray(rapidOpts);
      if (!validOptionSet(optsFa) || optionSetHasBleed(optsFa)) { stats.badOptions++; continue; }
    }

    let optsEn = (() => {
      const en = parsePreEnBlock(eb);
      if (validOptionSet(en.options)) return en.options;
      const inline = buildEnOptionArray(mainOpts.size >= 4 ? mainOpts : rapidOpts);
      return validOptionSet(inline) ? inline : [];
    })();

    // Auditor confidence printed on each block. «صفر» means the auditors
    // refused to answer (missing image / deleted data); «پایین» means the
    // answer is contested — the card stays in the browse bank but ships
    // keyless (bank_only). We never dress a guess up as an official key.
    const mainConf = (mb.match(/(?:سطح )?اطمینان[:：]\**\s*(بالا|متوسط|پایین|صفر)/) || [])[1] || "";
    const rapidConf = (rb.match(/(?:سطح )?اطمینان[:：]\**\s*(بالا|متوسط|پایین|صفر)/) || [])[1] || "";
    const registryKey = labelledAnswerFa(mb, ["پاسخ علمی اصلاح‌شده", "پاسخ علمی اصلاح شده"]);
    const mainFinalKey = labelledAnswerFa(mb, ["پاسخ نهایی", "پاسخ علمی نهایی"]);
    const rCorrKey = labelledAnswerFa(rb, ["پاسخ اصلاح‌شده", "پاسخ اصلاح شده", "پاسخ بازیابی‌شده"]);
    const rSugKey = labelledAnswerFa(rb, ["پاسخ سریع پیشنهادی"]);
    // answer authority, most-audited source first
    let correct = null;
    let keyless = false;
    let keySource = "";
    if (registryKey != null) { correct = registryKey; keySource = "registry-corrected"; }
    else if (mainConf === "صفر") { stats.incompleteMedia++; continue; }
    else if (mainFinalKey != null) {
      if (mainConf === "پایین") { keyless = true; }
      else {
        // A printed verdict naming two or more jointly-correct options is not
        // gradeable as a single-best-answer MCQ: ship it keyless/bank-only.
        const multi = multiAnswerFa(mb, ["پاسخ نهایی", "پاسخ علمی نهایی"]);
        if (multi && multi.single == null) { keyless = true; keySource = "multi-answer"; }
        else if (multi && multi.single != null) { correct = multi.single; keySource = "registry-corrected"; }
        else { correct = mainFinalKey; keySource = "official"; }
      }
    } else {
      // Even when labelledAnswerFa rejected the line (e.g. «هیچ‌کدام ... ندارند»),
      // a printed multi-option verdict is still a keyless item.
      const multi0 = multiAnswerFa(mb, ["پاسخ نهایی", "پاسخ علمی نهایی"]);
      if (multi0 && multi0.single == null) { keyless = true; keySource = "multi-answer"; }
      else if (multi0 && multi0.single != null) { correct = multi0.single; keySource = "registry-corrected"; }
      const rights = [];
      if (correct == null && !keyless) for (const o of optMap.values()) { const r = rightFromOption(o); if (r === true) rights.push(o.i); }
      if (correct == null && !keyless && rights.length === 1) { correct = rights[0]; keySource = "official"; }
      else if (correct == null && !keyless && rCorrKey != null) { correct = rCorrKey; keySource = "registry-corrected"; }
      else if (correct == null && !keyless && rSugKey != null) {
        if (rapidConf === "پایین") { keyless = true; }
        else { correct = rSugKey; keySource = "rapid"; }
      }
      if (correct == null && !keyless) { stats.unresolved++; continue; }
    }

    const mainFull = labelledText(mb, ["صورت سؤال", "متن فارسی", "متن (فارسی)"]);
    const rapidFull = labelledText(rb, ["صورت سؤال", "متن"]);
    const compact = labelledText(mb, ["صورت فشرده"]);
    const stem = mainFull.length >= 25 ? mainFull : rapidFull.length >= 25 ? rapidFull : compact || mainFull || rapidFull;
    if (clean(stem).length < 12) { stats.tooShort++; continue; }

    // OCR collapse: two printed options are byte-identical. Acceptable only
    // when neither duplicate carries the key (a repeated wrong distractor);
    // a duplicated correct option would teach an ambiguous answer.
    {
      const nrm = (x) => (x || "").replace(/\s+/g, " ").replace(/[‌‍ـ.,،;؛:؟?!()«»"':\-]/g, "").trim();
      const seen = new Map();
      let ambig = false;
      optsFa.forEach((o, i) => {
        const k = nrm(o);
        const list = seen.get(k) || [];
        list.push(i); seen.set(k, list);
      });
      for (const list of seen.values()) {
        if (correct != null && list.length > 1 && list.includes(correct)) ambig = true;
      }
      if (ambig) { stats.badOptions++; continue; }
    }

    const en = parsePreEnBlock(eb);
    const enStem = en.stem || "";

    const why = preWhy(optMap);
    let lesson = sectionText(mb, ["درسنامهٔ میکرولرنینگ", "درسنامه میکرولرنینگ", "درسنامه جامع میکرولرنینگ"]);
    if (!lesson) lesson = sectionText(rb, ["جمع‌بندی آموزشی سریع", "جمع‌بندی"]) || labelledText(rb, ["جمع‌بندی آموزشی سریع", "جمع‌بندی"]);
    const gm = goldenAndMnemonic(mb);
    const golden = gm.golden || goldenAndMnemonic(rb).golden;
    const mnemonic = gm.mnemonic || goldenAndMnemonic(rb).mnemonic;
    const enLesson = en.lesson || (es ? clip(sectionText(es, ["Microlearning textbook", "Analysis of options"]), 700) : "");
    const enGM = goldenAndMnemonic(es);

    stats.subjects[subj.subject_fa] = (stats.subjects[subj.subject_fa] || 0) + 1;

    const whyEn = (() => {
      if (es) {
        const sm = parseFaOptionLines(es);
        const enSm = parseEnOptionBullets(es);
        const arr = [0, 1, 2, 3].map((i) => {
          const o = sm.get(i);
          if (o) return clip(clean(`${o.verdict ? o.verdict.replace(/[،,]\\s*$/, "") + ". " : ""}${o.tail}`), 320);
          return "";
        });
        if (arr.some(Boolean)) return arr;
      }
      return ["", "", "", ""];
    })();

    questions.push({
      program: "preint",
      exam_type: "preinternship",
      subject_fa: subj.subject_fa, subject_en: subj.subject_en, subject_track: subj.subject_track,
      chapter_fa: subj.chapter_fa, chapter_en: subj.chapter_en,
      question_fa: clean(stem), question_en: clean(enStem),
      options_fa: optsFa,
      options_en: validOptionSet(optsEn) ? optsEn : (optsEn[0] ? optsEn : []),
      correct_index: correct,
      ...(keyless ? { keyless: true } : {}),
      options_why_fa: why,
      options_why_en: whyEn,
      explanation_fa: clip(lesson, 700),
      explanation_en: enLesson,
      ...(golden || mnemonic || lesson ? {
        micro: {
          lead_fa: clip(lesson, 600), lead_en: enLesson ? clip(enLesson, 600) : "",
          golden_fa: golden, golden_en: enGM.golden || en.golden,
          points_fa: mnemonic ? [mnemonic] : [], points_en: [],
          options_fa: [], options_en: [],
          source_fa: "", source_en: "", media: null,
        },
      } : {}),
      year: identity.year || "", year_num: identity.year_num,
      month: identity.month || "", month_en: identity.month_en || "",
      scope: identity.scope || "", pole: identity.pole || "",
      question_no: identity.source_qno || num,
      question_style: questionStyle(stem, true),
      source: "بانک کامل دوزبانه رسمی پیش‌کارورزی (نسخهٔ ۰۰۵)",
      license: "official_ministry_booklet",
      tags: [id, ...(keyless ? ["no-official-key"] : []), ...(keySource === "multi-answer" ? ["multi-answer"] : [])],
      key_source: keyless ? (keySource === "multi-answer" ? "multi-answer" : "low-confidence") : keySource || (/اصلاح/.test(mb + rb) ? "registry-corrected" : "official"),
    });
    if (keyless) stats.keyless++; else stats.keyed++;
  }
  stats.imported = questions.length;
  return { questions, stats };
}

/* ================================================================
   RESIDENCY MASTER
   ================================================================ */

/* Reference-book hints. "i" marks omnibus internal-medicine references
 * (Harrison covers every topic); the earliest-cited book wins. */
/* kind: "book" = specific textbook for one specialty (strong),
 *       "omni" = internal-medicine omnibus / internal guideline,
 *       "guide" = generic org/guideline, weak without a domain keyword. */
const RES_REFERENCE_HINTS = [
  // omnibus internal medicine
  [/Braunwald|Harrison|Cecil|GINA|GOLD|\bERS\b|ESCMID|KDOQI|KDIGO|ADA\s|Standards of Care|\bACP\b|Wintrobe|Williams Hematology|Hoffman|ESC Guidelines|ACC\/AHA|AHA\/ACC|ACLS|\bATS\b|ACG Guideline|ACG Crohn|ACG PUD|ACG Barrett|ACG Liver|ATA Guidelines|ATA Thyroid|Bethesda|AABB|Rome IV|Transfusion Reactions/i, "داخلی", "i", "omni"],
  // specific books / strong orgs by specialty
  [/Nelson|Kliegman|Rudolph|Avery(?!\sHospital)|Behrman|Pediatrics|AAP\b|ISPAD|ACIP|Bright Futures|PECARN/i, "کودکان", "", "book"],
  [/Berek|Novak|Williams (?:Obstetrics|Gynecology)|Obstetric|Beckmann|Gabbe|Callen|Lopez Gynecology|ACOG|ASRM|ASCCP|SMFM|RCOG/i, "زنان و زایمان", "", "book"],
  [/Schwartz|Sabiston|SRU|Mattox|Blumgart|Cameron|HerniaSurge/i, "جراحی", "", "book"],
  [/Robbins|Pathologic Basis/i, "پاتولوژی", "", "book"],
  [/Aminoff|Adams|Ropper|Bradley|Neurology in Practice|Bradley and Daroff|\bIHS\b|AASM|MHAUS/i, "نورولوژی", "", "book"],
  [/Katzung|Goodman|Gilman|Hardman/i, "فارماکولوژی", "", "book"],
  [/Learning Radiology|Fleischer|Felson|Resnick|ACR\s|ACR Appropriateness/i, "رادیولوژی", "", "book"],
  [/Mandell|Red Book|IDSA|Holmes|Feigin|SHEA/i, "بیماری‌های عفونی", "", "book"],
  [/Campbell|Walsh|\bAUA\b|\bEAU\b/i, "اورولوژی", "", "book"],
  [/Rockwood|Green(?:’|')?s (?:Fractures|Orthopaedic)|AAOS|Hoppenfeld|Tachdjian|Gustilo/i, "ارتوپدی", "", "book"],
  [/Cummings|AAO-?HNS|Bailey.*Head|Bluestone/i, "گوش و حلق و بینی", "", "book"],
  [/Fitzpatrick|Bolognia|Andrews(?:’|')? (?:Diseases|Disease)|Wolff/i, "پوست", "", "book"],
  [/Sadock|Kaplan.*Psychiatry|\bDSM|ASAM/i, "روانپزشکی", "", "book"],
  [/Kanski|Yanoff|\bAAO\b/i, "چشم‌پزشکی", "", "book"],
  [/Abbas|Janeway|Rich.*Clinical Immunology|Murphy.*Immunobiology|WAO/i, "ایمنی‌شناسی", "", "book"],
  // weak generic guidelines
  [/WHO\/UNICEF|WHO\b[^\n]{0,40}(?:monitor|surveillance|eliminat|assess|population|community|iodine|ید)|UNICEF|EQUATOR|اپیدمیولوژی|آمار زیستی|سلامت اجتماعی/i, "آمار و اپیدمیولوژی", "", "guide"],
  [/\bCDC\b|\bWHO\b|UNICEF|وزارت بهداشت/i, "بیماری‌های عفونی", "", "guide"],
  [/WHO\/UNICEF|WHO\b.*(?:monitor|surveillance|eliminat|assess|population|community|EQUATOR|اپیدمیولوژی|آمار زیستی|سلامت اجتماعی)|UNICEF/i, "آمار و اپیدمیولوژی", "", "guide"],
  [/ethics|Ethics|Beauchamp|اخلاق/i, "اخلاق پزشکی", "", "book"],
  // explicit Persian specialty names inside references are book-strength
  [/ارتوپدی/i, "ارتوپدی", "", "book"],
  [/چشم[‌ ]?پزشکی/i, "چشم‌پزشکی", "", "book"],
  [/اورولوژی/i, "اورولوژی", "", "book"],
  [/گوش[‌ ]?و[‌ ]?حلق[‌ ]?و[‌ ]?بینی|اتولارنگ/i, "گوش و حلق و بینی", "", "book"],
  [/روانپزشکی/i, "روانپزشکی", "", "book"],
  [/رادیولوژی/i, "رادیولوژی", "", "book"],
  [/پاتولوژی/i, "پاتولوژی", "", "book"],
  [/اپیدمیولوژی|آمار زیستی/i, "آمار و اپیدمیولوژی", "", "book"],
  [/فارماکولوژی/i, "فارماکولوژی", "", "book"],
  [/زنان[‌ ]?و[‌ ]?زایمان|مامایی/i, "زنان و زایمان", "", "book"],
  [/اطفال|کودکان/i, "کودکان", "", "book"],
];

/* Internal chapter from the audited reference chapter title (authoritative
 * for course-53 cards), falling back to stem tokens. */
function internalChapterFromRef(ref, textFa, textEn) {
  // the audited reference title (both languages live in it) is tested on
  // its own first — English stem prose ("dyspnea", "smoking") must not
  // override an explicit cardiology chapter citation
  const map = [
    ["هماتولوژی و انکولوژی", /Megaloblast|Iron Deficiency|Anemia|Leukemia|Lymphoma|Myeloma|Myeloproliferative|Polycythemia|Thrombocytopenia|TTP\b|\bHUS\b|Transfusion|Marrow|Myelodysplasia|Myeloid|Coagulopathy|Hemostasis|Hemoglobin|آنمی|کم.?خونی|هماتول|ترانسفیوژن|انعقاد/i],
    ["روماتولوژی", /Rheumatoid|\bRA\b|Vasculit|Gout|Arthritis|Lupus|Scleroderma|Spondylo|Periarticular|Polymyalgia|Temporal Cell|Ankylosing|رومات|آرتریت|واسکولیت|نقرس|پری.?آرتیکولار|شانه|اسپوندیل/i],
    ["ریه و مسمومیت", /Asthma|\bCOPD\b|GOLD|GINA|Pleur|Pneumothorax|Hemoptysis|Interstitial Lung|Pulmonary Function|Venous Thrombo|Pulmonary Embolism|Respiratory|Pulmonary|Silicosis|Tobacco|Smoking|Lung|Poison|Overdose|Withdrawal|Alcohol|Substance Use|Serotonin|End-of-Life|Palliative|Toxicology|آسم|ریه|پلور|هموپتزی|سیلیکوز|مسموم|سندرم سروتونین|الکل|ترک/i],
    ["قلب", /STEMI|Pericard|Arrhythmia|Cardiomyopathy|Heart Failure|Valvular|Coronary|Endocarditis|Hypertrophic|Aortic Disease|Atrial Fibrillation|قلب|پریکارد|آریتمی|کاردیومیوپاتی/i],
    ["غدد", /Hypocalc|Hypercalc|Diabetes|Thyroid|Hypothyroid|Hyperthyroid|Pituitary|Acromegaly|Adrenal|Cushing|Lipid|Cholesterol|Metabolic Syndrome|Pheochromocytoma|دیابت|تیروئید|هیپوفیز|آکرومگالی|چربی خون/i],
    ["کلیه", /Glomerular|Tubulointerstitial|Renovascular|Kidney|Renal |Nephro|Nephri|Dialysis|Electrolyte|Hyponatr|Hypokal|Fluid and Electrolyte|کلیه|نفرو|گلومرول/i],
    ["گوارش", /Hepatitis|Pancreatitis|Crohn|Colitis|\bIBS\b|Malabsorption|Peptic Ulcer|Esophag|Barrett|Liver|Cirrhos|Biliary|GI Tumors|Gastrointestinal|Stomach|Gastric|Colorectal|Diverticular|Mesenteric|کبد|پانکراس|پانکراتیت|گوارش|معده|هپاتیت/i],
  ];
  const refHay = ref || "";
  for (const [ch, re] of map) if (re.test(refHay)) return ch;
  return internalChapterFromStem(textFa) || (textEn ? internalChapterFromStem(textEn) : null);
}

const RES_RULES = [
  // —— statistics / ethics ——
  [/کارآزمایی بالینی|\bRCT\b|p ?value|p-value|همگنی واریانس|انحراف معیار|فاصله اطمینان|توان آماری|آزمون فرض|فرض صفر|متاآنالیز|کای ?دو|حساسیت و ویژگی|ویژگی آزمون|ارزش اخباری|غربالگری|اپیدمی|میزان ?شیوع|میزان ?بروز|میانگین و انحراف|آماری/, "آمار و اپیدمیولوژی"],
  [/منابع محدود|بحران بهداشت|رضایت آگاهانه|محرمانگی|پزشک قانونی|تعهد حرفه|سقط درمانی|اخلاق پزشکی|پژوهش بر|مشارکت دانشجویان در مراقبت|تریاژ|تلفات جمعی|کمیته.اخلاق/, "اخلاق پزشکی"],
  [/سلامت اجتماعی|سالمت اجتماعی|سلامت جامعه|سطح پیشگیری|سطوح پیشگیری|بهداشت عمومی|اپیدمیولوژی توصیفی/, "آمار و اپیدمیولوژی"],
  [/شبکیه|گلوکوم|کاتاراکت|قرنیه|ملتحمه|افتالمو|کاهش ?بینایی|اختلال بینایی|انحراف چشم|پاپی[للد]|فشار (?:داخل ?)?چشم|زاویه ?اتاق ?قدام|کاپ به دیسک|گونیوسکوپ|دیوپتر|یوپتر|دامنه ?تطابق|نمره ?عینک/, "چشم‌پزشکی"],
  // specialty-defining internal tokens that must beat generic words
  [/تیرویید|تیروئید|پرکاری ?تیرو|کم.کاری ?تیرو|تیروتوکسیکوز|میکسدم|گریوز|آدرنال|فئوکروموسیتوم|کوشینگ|آلدسترونیسم|هیپوفیز|پرولاکتینوما|آکرومگالی|ندول ?تیرو|تروسو|Trousseau|قفل شدن دست|اسپاسم.های عضلانی/, { s: "داخلی", ch: "غدد" }],
  [/\bCOPD\b|آسم|GINA|پنوموتوراکس|آمفیزم|آمپیم|برونشکتازی|سارکوئیدوز|سیلیکوزیس|فیبروز ?ریوی|آمبولی ?ریه|متادون|مسمومیت با|اوردوز|اووردوز|الکل متیلیک|متانول|نالوکسان/, { s: "داخلی", ch: "ریه و مسمومیت" }],
  [/واسکولیت|پلی ?آرتریت ندوزا|ندوزا|لیویدو|هنوخ|شونلاین/, { s: "داخلی", ch: "روماتولوژی" }],
  [/آنوریسم|توده ضربان.?دار|ترومبوز آنوریسم/, "جراحی"],
  // —— high-priority cross-cutting rules (must beat age/word tokens) ——
  // thoracic / polytrauma (flail chest, hemothorax, chest tube) beats rib- fracture orthopaedics
  [/هموتوراکس|پنوموهمدوتوراکس|چست ?تیوب|چست ?تیوب|دنده ?های|حرکات پارادوکس|قفسه ?سینه.*تروما|تروما.*قفسه ?سینه|سوختگی|سونتگ/, "جراحی"],
  // a dermatologist-managed skin lesion is dermatology even when a biopsy was taken
  [/متخصص پوست|پلاک ?های? اریتماتو|سطوح اکستانسور(?:آرنج|زانو)?/, "پوست"],
  // gout / synovial joint pathology is rheumatology, not general pathology
  [/نقرس|سینووی|هیپراوریسمی|یوری ?اسید|آرتریت ?نقرسی/, { s: "داخلی", ch: "روماتولوژی" }],
  // endocrine tumours (adrenal/thyroid) cited under Robbins are still endocrine
  [/فئوکروموسیتوم|پاراگانگلیوما|هاشیموتو|تیروییدیت|بیماری آدیسون|آدرنال.{0,25}(?:توده|ماکروسکوپ)|ماکروسکوپ.{0,25}آدرنال/, { s: "داخلی", ch: "غدد" }],
  // electrolyte emergencies (vomiting/outlet obstruction, ECG changes)
  [/اختلال الکترولیت|هیپوکالمی|هایپوکالمی|هیپرکالمی|کاهش ولتاژ|طولانی ?شدن فاصله|فاصلهٔ? ?P-?R|الکترولیت.{0,30}(?:بیشتر مطرح|کدام)/, { s: "داخلی", ch: "کلیه" }],
  // pelvic fracture with hematuria = urinary tract injury (urology), not ortho
  [/شکستگی لگن[\s\S]{0,50}هماچوری|هماچوری[\s\S]{0,50}شکستگی لگن/, "اورولوژی"],
  // acute limb ischaemia = vascular surgery
  [/اندام تحتانی[\s\S]{0,40}(?:رنگ ?پریده|رنگ ?پری|سرد و|بی ?حرکت)|ایسکمی حاد اندام|ناگهانی[\s\S]{0,25}اندام تحتانی[\s\S]{0,25}(?:رنگ|سرد)/, "جراحی"],
  // colon polyp / colonoscopy management is gastroenterology, not pathology
  [/کولونوسکوپی|پولیز|پولیپ|آدنوم|رزکسیون سگمنتال|کولون نزولی|بارت(?=ر?ت)/, { s: "داخلی", ch: "گوارش" }],
  // contraceptive / breakthrough-bleeding management is gynaecology
  [/OCP|کنتراسپتیو|کنتراسپان|لکه ?بینی(?!\s*باردار)|پروژسترون|آندومتر|گراوید|پرایمی|هفته ?(?:۴|۵|۵۰) ?بارداری/, "زنان و زایمان"],
  // Guillain-Barré: ascending symmetric weakness, areflexia, facial diplegia
  [/Bifacial palsy|پالسی دوطرفه|ضعف (?:پیشرونده|صعودی)[\s\S]{0,40}(?:قرینه|چهار ?اندام)|کاهش (?:جنرالیزه )?(?:رفلکس|DTR|تاندون ?های عمقی)|آررفلکسی|پروتئین.{0,15}مایع مغزی/, "نورولوژی"],
  // viral esophagitis biopsy: multinucleated giant cells / intranuclear inclusions
  [/انک[لک]و[ژز]ی[وون]ن|انکلوژن|گنجانک ?(?:هسته ?ای|درون ?هسته)|سنگفرش\s*ی? چند ?هسته|چند ?هسته ?ای[\s\S]{0,60}(?:ویروس|ازوفاژیت)|ازوفاژیت.{0,30}(?:ویروس|کدام ویروس)/, "بیماری‌های عفونی"],
  [/فون ?ویلبراند|ویلبراند|هموفیلی|سطح فاکتور ?(?:۸|8|۹|9|۱۱|۱۳)|فاکتور ?(?:۸|8|۹|9) ?حدود|فاکتور انعقادی|کمبود فاکتور/, { s: "داخلی", ch: "هماتولوژی و انکولوژی" }],
  // (also a STRONG content verdict — see RES_STRONG_RULES)
  [/^(?:(?!اینتوبه|لوله ?گذاری|تهویه ?مکانیکی|ونتیلاتور)[\s\S])*(?:ضربه به سر|\bGCS\b|Brain CT|Brain MRI|اسکن مغز|تصویربرداری[^\n]{0,12}مغز|نوروسرجری)/, "نورولوژی"],
  [/اوتیت|اوتیت|اتوسکوپ|پرده ?صماخ|میرنگوتومی|گوش ?درد|کاهش شنوایی|شنوایی ?سنجی|خون ?دماغه|اپی ?گلوت|سینوزیت|آدنو ?[ئیی] ?دکتومی|ادنو[ئیی]د ?مزمن/, "گوش و حلق و بینی"],
  [/هیسترکتومی[\s\S]{0,200}?(?:فلانک|پهلو|ترشح ?آبکی|نشت|حالب|اورتر|فیستول)|ترشح ?آبکی فراوان|فیستول وزیکو|واژیکوواژینال|اورتروواژینال|حالب.?واژینال/, "اورولوژی"],
  [/Onion.?skin|فیبروز ?پوست ?پیازی|پوست ?پیازی|کلانژیت اسکلروزان|اسکلروز ?اولیه ?صفراوی|اسکلروزان|مجاری ?صفراوی|ایکتر[\s\S]{0,60}خارش|خارش[\s\S]{0,60}ایکتر/, { s: "داخلی", ch: "گوارش" }],
  [/\bDCIS\b|کارسینوم ?مجرایی|توده ?پستان|کانسر ?پستان|سرطان ?پستان|کارسینوم ?پستان|ماستکتومی|لمپکتومی|المپکتومی|پستان.{0,20}اقدام مناسب/, "جراحی"],
  [/فشار (?:داخل ?)?چشم|زاویه ?اتاق ?قدام|کاپ به دیسک|گونیوسکوپ|دیوپتر|یوپتر|دامنه ?تطابق|نمره ?عینک|عینک .{0,15}مطالعه|گلوکوم/, "چشم‌پزشکی"],
  // —— major specialties ——
  [/نوزاد|شیرخوار|طفل|نارس(?!ایی)|آپگار|پدیاتریک|کودک|بچه(?!\u200c?دار|دار)|پسر ?\d|دختر ?\d|رشد و تکامل|مانا|شیر مادر|زردی نوزاد|واکسیناسیون کشیری|واکسیناسیون کشوری|ایمن ?سازی کشوری|کریپتورکیدیم|کود ?[۰-۹\d]+ ?ماهه|لکنت زبان/, "کودکان"],
  [/باردار|حاملگی|حامله|زایمان|جنین|واژن|واژینال|رحم|پرهاکلامپسی|پره ?اکلامپسی|اکلامپسی|سقط|مامایی|تخمدان|قاعدگی|یائس|سرویکس|نابارور|تخمک ?گذاری|اوولاسیون|Ovulation|هیسترکتومی|زگیل تناسلی|\bHPV\b|لکه ?بینی باردار|پرایمی ?گراوید|گراوید|دیابت بارداری|مکانیسم ?زایمان|post.?partum|بعد از زایمان|خونریزی پس از زایمان|واژینیت|کاندیدیاز واژینال|G\dP\d|پرولاپس|افتادگی (?:رحم|واژن|لگن)/, "زنان و زایمان"],
  [/پروستات|بیضه|اورکیت|اپیدیدیم|واریکوسل|مثانه|اورتر|حالب|پیچش بیضه|ریفلاکس وزیکو|هایدرونفروز|هیدروسل|اورولوژی|کانسر بیضه|تکرر ادرار|سوزش ادرار|دیزوری|بی ?اختیاری ادرار|آسیب ?حالب|نشت ادرار/, "اورولوژی"],
  [/شکستگی|دررفتگی|ارتوپد|اسکولیوز|لگام|(?<![؀-ۿ])تاندون(?!ی)|گچ ?گیری|کلاب ?فوت|ژنوواروم|ژنووالگوم|کمردرد|درد ?کمر|مهره ?کمری|درد هیپ|پیاده شدن از ماشین|لگن.*تروما|کمپارتمان|نسج نرم|(?<![؀-ۿ])زانو(?![؀-ۿ])|درد ?ناحیه ?مهره|مهره ?های پشتی|مهرههای پشتی|درد ستون ?فقرات|تندرنس.{0,10}مهره/, "ارتوپدی"],
  [/اپیستاکسی|اپی ?گلوت|سینوزیت|پرده صماخ|ادنو[ئیی]د|لوزه|لارنکس|نازوفارنکس|کاهش شنوایی|شنوایی|گوش میانی|گوش درد|خون ?دماغه|حلق|استرتور|stertor|توده.ی ?(?:لترال )?گردن|توده ?(?:بدون درد )?در گردن|اوتیت ?مدیا|گوش درد دوطرفه|میرنگوتومی|آدنو ?ئ یدکتومی/, "گوش و حلق و بینی"],
  [/پمفیگوس|پمفیگوئید|درماتیت|اگزما|کهیر|پسوریاز|\bراش\b|ماکول|پاپول|وزیکول|پوسچول|پلاک[های‌ ]?پوست|ضایع[ههای]+ ?پوستی|ملانوم|\bSJS\b|\bTEN\b|آلوپسی|شپش|گال|خارش.*(پوست|اندام)|پوست سر|تاول/, "پوست"],
  [/سایکوز|روان ?پریشی|افسردگی|دوقطبی|هذیان|توهم|اضطراب|وسواس|شخصیت مرزی|مانیا|panic|پانیک|سایکو|دلیریوم|دمانس|نوروز|خودکشی|حمله[ٔ‌ ]?هراس|روانپزشک|ترس از مردن|نگران بروز حالات|از منزل خارج نمی|وضعیت روانی|تفکر انتزاعی|\bMSE\b|معنی ضرب|به خواب رفتن|اختلال هراس/, "روانپزشکی"],
  [/بروسلا|مالاریا|هاری|\bخفاش\b|کزاز|مننژیت|مننگوکوک|سپسیس|سپتیک|باکتریمی|اندوکاردیت|بیماری سل|سل ریوی|(?<![؀-ۿ])سل(?![؀-ۿ])|آبسه|آنتی ?بیوتیک|عفونت|ویرولانس|عامل بیولوژیک|عفونت بیمارستانی|تب و لرز|پنومونی اکتسابی|مراقبت بالینی بیماران/, "بیماری‌های عفونی"],
  [/سکته مغزی|تشنج|صرع|نوروپاتی|میگرن|سردرد|دمیلین|گیلن|بارهنگ|پارکینسون|ترمور|کما|سندرم تونل کارپ|گزگز|ادم پاپی|حافظه|مننگو|سفتی گردن|فتق دیسک|نخاع|کالریک|ictal|ایکتال|دیس ?متری/, "نورولوژی"],
  [/بیوپسی|هیستوپات|پاتولوژی|سیتولوژی|ندول کیستیک|کارسینوم درجا|گرانولوما|نئوپلاسم|آدنوکارسینوم|متاستاز|هیستولوژی|ماکروسکوپ|بیوپسر|میکروسکوپی.*تومور|سلول.های گلیال|زواید مویی|پیلوسیتیک|ندول دیواره.ای/, "پاتولوژی"],
  [/(?:^|[.!؟?۔»])\s*در\s*(?:مورد\s*)?(?:رادیوگراف|راد[\sی]*و*\s*گراف|رادیو ?گراف|گرافی|سی ?تی ?اسکن|سی ?تی|تصاویر|تصویر |ام ?آر ?آی|\bMRI\b)|تصویر زیر|یافته.های تصویر|هیپردنس|هایپردنس|اکسترا ?اکزیال|ساب ?دورال|ساب.?دورال|اپیدورال|اپیدورو|هیپودنس|air bronchogram|opacification|High density|high-?density|Crescent|bamboo sign|دقیق ?تر.{0,15}(?:کنتراست|اسکن)|انجام ?(?:سی ?تی|MRI|ام ?آر ?آی).{0,20}(?:دقیق|مجاز|بهتر|منع)|کنتراست.{0,10}(?:دقیق ?تر|بهتر)|رادیولوژی/, "رادیولوژی"],
  [/آپاندیس|هرنی|فتق|کوله ?سیست|ایلئوس|پریتونیت|شانت|سوختگ|سونتگ|ترومای|جراحی|لاپاراتوم|لاپاراسکوپ|آناستوموز|آمپوتاسیون|چست ?تیوب|نکروزان|پانکراتیت|خون ?ریزی.*گوارش|بلع دردناک|آندوسکوپی.*گردن|سوراخ ?شدن|انسداد ?روده|توده.ی ?پستان|کارسینوم ?پستان|پستان راست|پستان چپ|ماستکتومی|لمپکتومی|المپکتومی|مک ?برنی|\bRLQ\b|شیفت پیدا کرده|مهاجرت درد|سرطان معده|گلوله|آسیب نافذ|نافذ شکم/, "جراحی"],
  [/ایمنی شناسی|ایمنی‌شناسی|آنتی ?بادی|سیتوکین|لکوسیت(?!وز)|ایمونوگلوبولین|اتوآنتی ?بادی|پیوند عضو|TH1|TH17|حساسیت تأخیری|نقص ایمنی|بند ناف|چسبندگی لکوسیت/, "ایمنی‌شناسی"],
  [/مهارکننده|آنتاگونیست|آگونیست|فارماکو|نیمه ?عمر|کتورولاک|سفالوسپورین|بتابلوکر|بتا ?بلوکر|داروی ضد ?افسردگی|داروهای ضد تشنج|هیپرترمی بدخیم|بیهوشی ?جنرال|شل ?کننده.عضلانی/, "فارماکولوژی"],
  // —— internal medicine chapters ——
  [/تنگی نفس|آسم|\bCOPD\b|GINA|پلور|پنوم|اکسیژن|سرفه|هموپتزی|آمبولی ریه|پنوموتوراکس|تهویه مکانیکی|سیلیکوزیس|تعریق شبانه/, { s: "داخلی", ch: "ریه و مسمومیت" }],
  [/دیابت|تیروئید|کوشینگ|آدرنال|هیپرکلسمی|هیپوکلسمی|قند|ندول تیروئید|گریوز|متابولیک|لووتیروکسین|متفورمین|ژنیکوماستی/, { s: "داخلی", ch: "غدد" }],
  [/کراتینین|نارسایی کلیه|پروتئینوری|هماچوری|دیالیز|گلومرول|سنگ ?های? کلیه|نفرو|نقرس در کلیه|ورید ?کلیوی|شریان ?کلیوی|نکروز پاپیل|ادرار ۲۴ ?ساعته|آلبومین سرم|پروتئین در (?:جمع|ادرار)|هیپوآلبومینمی|نفروپاتی|متابولیک آلکالوز|سدیم ادرار|Nephropathy|nephrotic|nephritic|acid-base|Gitelman|Bartter|بارتر|بارتتر/, { s: "داخلی", ch: "کلیه" }],
  [/لوپوس|آرتریت|رومات|اسکلرودرمی|نقرس|پوکی استخوان|اسپوندیل|کپسولیت|شقیقه|آرتریت ?تمپورال|سلول ?ژانت|پلی ?میالژیا روماتیکا/, { s: "داخلی", ch: "روماتولوژی" }],
  [/آنمی|کم ?خونی|لوسمی|لنفوم|انعقاد|هموگلوبین|فقر آهن|ترومبوسیتوپن|هماتوکریت|سیکل ?سل|اسپلنومگالی|پتشی|پورپور|میلوفیبروز|اریتروپویتین|پا?لاستیک|آ ?نمی|همولیز/, { s: "داخلی", ch: "هماتولوژی و انکولوژی" }],
  [/تپش قلب|سنکوپ|قلب|فشار ?خون|میوکارد|آنژین|فیبریلاسیون|تامپوناد|احیاء|شوک|استنت|کرونری|نارسایی قلب|اکوکاردیوگرام|هیپرتنشن|دریچه|وارفارین|ایسکمی|CIED|MRI قلب/, { s: "داخلی", ch: "قلب" }],
  [/هلیکوباکتر|سندرم روده تحریک|\bIBS\b|کولیت|کرون|هپات|کبد|سیروز|پانکراس|گاستریت|زخم پپتیک|ملنا|استفراغ خونی|دیسفاژی|ایکتر|یرقان|اسهال|گوارش|ریشه ?کنی|کلستاز|آلکالن.?فسفاتاز|بیلی.?روبین|CBD|کیسه صفرا|نژیودیسپ|آنژیودیسپلازی|پر.?پیلور|سندرم روده کوتاه|ایسکمی مزانتر/, { s: "داخلی", ch: "گوارش" }],
  // —— broad fallbacks ——
  [/باردار|حاملگی|زایمان|جنین|رحم|واژن/, "زنان و زایمان"],
  [/واکسن|ایمن ?سازی/, "کودکان"],
  [/عفونت|(?<![؀-ۿ])تب(?![؀-ۿ])|آنتی ?بیوتیک|سپسیس/, "بیماری‌های عفونی"],
  [/مغز|اعصاب|سردرد|تشنج|نورو/, "نورولوژی"],
  [/دارو|سمیت|دوز/, "فارماکولوژی"],
];

function applyResRule(hay) {
  for (const rule of RES_RULES) {
    if (!rule[0].test(hay)) continue;
    const target = rule[1];
    const subjName = target && typeof target === "object" ? target.s : target;
    const chName = target && typeof target === "object" ? target.ch : rule[2];
    const c = canonicalSubject(subjName);
    if (c && chName) {
      const ch = INTERNAL_CHAPTERS.get(chName);
      if (ch) { c.chapter_fa = ch.fa; c.chapter_en = ch.en; }
    }
    if (c) return c;
  }
  return null;
}

function internalChapterFromStem(text) {
  if (!text) return null;
  for (const rule of RES_RULES) {
    const target = rule[1];
    if (target && typeof target === "object" && target.s === "داخلی" && rule[0].test(text)) return target.ch;
  }
  return null;
}

function referenceMatches(reference) {
  const out = [];
  const refHay = reference || "";
  for (const [re, subj, flag, kind] of RES_REFERENCE_HINTS) {
    const mm = refHay.match(re);
    if (mm && mm.index != null) out.push({ idx: mm.index, subj, flag: flag || "", kind: kind || "guide" });
  }
  out.sort((x, y) => x.idx - y.idx);
  return out;
}
function bestReference(reference) {
  return referenceMatches(reference)[0] || null;
}

function internalWithChapter(textFa, textEn, base, chName) {
  const c = base || canonicalSubject("داخلی");
  chName = chName || internalChapterFromStem(textFa) || (textEn ? internalChapterFromStem(textEn) : null);
  const ch = chName && INTERNAL_CHAPTERS.get(chName);
  if (ch) { c.chapter_fa = ch.fa; c.chapter_en = ch.en; }
  return c;
}

/* Strong content verdicts: when these unambiguous department-defining
 * tokens are in the STEM (not merely an omnibus reference), they decide the
 * subject even if a specialty textbook is co-cited (e.g. von Willebrand
 * disease cited inside Nelson still belongs to haematology). Only used in
 * the stem-authoritative mode (courses 51/52/fast); the audited course-53
 * headings/references use referenceFirst instead. */
const RES_STRONG_RULES = [
  [/فون ?ویلبراند|ویلبراند|هموفیلی|سطح فاکتور ?(?:۸|8|۹|9|۱۱|۱۳)|فاکتور ?(?:۸|8|۹|9) ?حدود|فاکتور انعقادی|کمبود فاکتور/, { s: "داخلی", ch: "هماتولوژی و انکولوژی" }],
];

function neuroTraumaHit(textFa) {
  const picu = /اینتوبه|لوله ?گذاری|تهویه ?مکانیکی|ونتیلاتور/.test(textFa);
  return !picu && /ضربه به سر|\bGCS\b|نوروسرجری/.test(textFa);
}

export function classifyResidencySubject(textFa = "", textEn = "", reference = "", optionsFa = [], opts = {}) {
  // OCR repair: fast-path booklets misrender چشم as چام
  textFa = textFa.replace(/چام/g, "چشم");
  optionsFa = (optionsFa || []).map((o) => o.replace(/چام/g, "چشم"));
  const FINDING_DEPT = new Set(["رادیولوژی", "پاتولوژی"]);

  // STEM ONLY (Persian authoritative; English rescues)
  let stemHit = applyResRule(textFa);
  if (!stemHit && textEn) stemHit = applyResRule(textEn);

  const best = bestReference(reference);

  if (opts.referenceFirst) {
    // course-53 deep audit: audited references route the card; the booklet
    // heading is the authors' default when references agree with it.
    if (neuroTraumaHit(textFa)) return canonicalSubject("نورولوژی");
    const matches = referenceMatches(reference);
    const heading = opts.heading || null;

    if (heading) {
      if (heading.subject_fa === "داخلی") {
        return internalWithChapter(textFa, textEn, canonicalSubject("داخلی"),
          internalChapterFromRef(reference, textFa, textEn));
      }
      const first = matches[0];
      // joint guideline at the very start that also names the heading specialty
      const jointHeading = matches.find((m) => m.idx < 16 && m.kind === "book" && m.subj === heading.subject_fa);
      if (!jointHeading && first && first.kind === "book" && first.subj !== "داخلی" && first.subj !== heading.subject_fa) {
        return canonicalSubject(first.subj);
      }
      if (matches.some((m) => m.kind === "book" && m.subj === heading.subject_fa)) return heading;
      if (matches.some((m) => m.subj === "داخلی")) {
        const refCh = internalChapterFromRef(reference, "", "");
        if (refCh) return internalWithChapter(textFa, textEn, canonicalSubject("داخلی"), refCh);
        return heading; // Harrison covers everything — never steals by itself
      }
      if (first) return canonicalSubject(first.subj) || heading;
      return heading;
    }

    if (best) {
      const c = canonicalSubject(best.subj);
      if (c && (c.subject_fa === "داخلی" || best.flag === "i"))
        return internalWithChapter(textFa, textEn, c, internalChapterFromRef(reference, textFa, textEn));
      if (c) return c;
    }
    if (stemHit && stemHit.subject_fa !== "داخلی" && !FINDING_DEPT.has(stemHit.subject_fa)) return stemHit;
    if (best) return internalWithChapter(textFa, textEn, canonicalSubject(best.subj), internalChapterFromRef(reference, textFa, textEn));
    if (stemHit) return stemHit;
    const broad0 = `${textFa}\n${(optionsFa || []).join(" ")}\n${textEn}`;
    const broadHit0 = applyResRule(broad0);
    if (broadHit0) return broadHit0;
    return canonicalSubject("داخلی");
  }

  if (stemHit && stemHit.subject_fa !== "داخلی" && !FINDING_DEPT.has(stemHit.subject_fa)) return stemHit;
  if (stemHit && stemHit.subject_fa === "داخلی" && stemHit.chapter_fa) {
    for (const [re, target] of RES_STRONG_RULES) {
      if (re.test(textFa) && target.ch === stemHit.chapter_fa) return stemHit;
    }
  }
  if (best) {
    const c = canonicalSubject(best.subj);
    if (c) {
      if (c.subject_fa === "داخلی" || best.flag === "i") {
        if (stemHit && stemHit.subject_fa === "داخلی" && stemHit.chapter_fa) return stemHit;
        return internalWithChapter(textFa, textEn, c, internalChapterFromRef(reference, textFa, textEn));
      }
      if (stemHit && FINDING_DEPT.has(stemHit.subject_fa)) return c;
      return c;
    }
  }
  if (stemHit) return stemHit;

  // rescue with options + English
  const broad = `${textFa}\n${(optionsFa || []).join(" ")}\n${textEn}`;
  const broadHit = applyResRule(broad);
  if (broadHit) return broadHit;
  return canonicalSubject("داخلی");
}

/* ---------------- bilingual deep residency block ---------------- */

function parseResDeepBlock({ body, year, course, qno, subjectOverride, idTag, sourceName }) {
  const stemFa = labelledText(body, ["متن فارسی", "متن (فارسی)", "متن / Stem", "متن"]);
  const stemEn = labelledText(body, ["English", "Stem (English)", "Stem"]);

  const splitAt = body.search(/(?:^|\n)\s*(?:#{2,4}\s*)?\*\*\s*(?:تحلیل|Independent option|Four-option|Option analysis|Analysis of options)/);
  const head = splitAt >= 0 ? body.slice(0, splitAt) : body;
  const tail = splitAt >= 0 ? body.slice(splitAt) : "";
  const optMap = parseFaOptionLines(head);
  if (optMap.size < 4) return null;
  const optsFa = buildFaOptionArray(optMap);
  let optsEn = buildEnOptionArray(optMap);
  if (!validOptionSet(optsEn)) optsEn = parseEnOptionBullets(head);
  if (!validOptionSet(optsFa)) return null;

  let correct = null;
  const keyM = body.match(/\*\*کلید(?:\s*اولیهٔ?\s*)?رسمی[^*]*?:\*\*\s*(?:\*\*)?\s*[«"']?\s*([الفبجد])/);
  if (keyM) correct = faLetterIndex(keyM[1]);
  if (correct == null) {
    const checks = [];
    for (const o of optMap.values()) if (rightFromOption(o) === true) checks.push(o.i);
    if (checks.length === 1) correct = checks[0];
  }
  if (correct == null) {
    const m = body.match(/پاسخ علمی نهایی[^:：\n]*[:：]\s*\**?\s*گزینه?[ٔ‌]?\s*[«"']?\s*([الفبجد])/);
    if (m) correct = faLetterIndex(m[1]);
  }
  if (correct == null) return null;
  if (clean(stemFa).length < 12) return null;

  const referenceText = (body.match(/\*\*(?:📖\s*)?(?:ارجاع رسمی|منبع\s*\/\s*Reference)[^*]*?\*\*:?\s*([^\n]+)/) || [, ""])[1];
  // P53 headings carry the booklet authors' coarse درس tag, but the audited
  // reference is authoritative for fine subject/chapter routing.
  const subj = classifyResidencySubject(stemFa, stemEn, referenceText, optsFa,
    subjectOverride ? { referenceFirst: true, heading: subjectOverride } : {});

  const rationaleOf = (letter, lang) => {
    const flag = lang === "fa" ? "🇮🇷" : "🇬🇧";
    const inline = tail.match(new RegExp(`^- \\*\\*${letter}\\)\\*\\*\\s*(.+)$`, "m"));
    if (inline && inline[1].length > 15) return clip(inline[1], 320);
    const seg = tail.match(new RegExp(`^- \\*\\*${letter}\\s*\\/\\s*[A-D]\\)\\*\\*([\\s\\S]*?)(?=^- \\*\\*[الفبجد]|^\\*\\*|^###|$)`, "m"));
    const sub = seg && seg[1].match(new RegExp(`^\\s*-\\s*${flag}\\s*(.+)$`, "m"));
    return sub ? clip(sub[1], 320) : "";
  };
  const whyFa = LETTERS_FA.map((l) => rationaleOf(l, "fa"));
  const whyEn = LETTERS_FA.map((l) => rationaleOf(l, "en"));

  const lessonFa = clip(labelledText(body, ["درسنامهٔ میکرولرنینگ", "درسنامه میکرولرنینگ"]) || sectionText(body, ["تحلیل مستقل گزینه‌ها"]), 700);
  const lessonEn = clip(labelledText(body, ["Microlearning note", "Microlearning note (English)"]) || sectionText(body, ["Independent option analysis"]), 700);
  const gm = goldenAndMnemonic(body);

  return {
    program: "preint", exam_type: "residency",
    subject_fa: subj.subject_fa, subject_en: subj.subject_en, subject_track: subj.subject_track,
    chapter_fa: subj.chapter_fa || "", chapter_en: subj.chapter_en || "",
    question_fa: clean(stemFa), question_en: clean(stemEn),
    options_fa: optsFa, options_en: validOptionSet(optsEn) ? optsEn : [],
    correct_index: correct,
    options_why_fa: whyFa, options_why_en: whyEn,
    explanation_fa: lessonFa, explanation_en: lessonEn,
    ...(gm.golden || lessonFa ? {
      micro: {
        lead_fa: lessonFa ? clip(lessonFa, 600) : "", lead_en: lessonEn ? clip(lessonEn, 600) : "",
        golden_fa: gm.golden || "", golden_en: goldenAndMnemonic(body).golden || "",
        points_fa: [], points_en: [], options_fa: [], options_en: [],
        source_fa: "", source_en: "", media: null,
      },
    } : {}),
    year, year_num: Number(toLatinDigits(year)) || null,
    question_no: qno, question_style: questionStyle(stemFa, true),
    source: sourceName, license: "official_ministry_booklet",
    tags: [idTag, `residency-course-${course}`],
    key_source: "official", label_fa: `دورهٔ ${course} دستیاری`,
  };
}

/* ---------------- residency master ---------------- */

export function parseResidencyMaster(text) {
  const stats = { total: 0, imported: 0, bad: 0, unresolved: 0, subjects: {} };
  const questions = [];
  const push = (q) => {
    if (!q) return;
    questions.push(q);
    stats.subjects[q.subject_fa] = (stats.subjects[q.subject_fa] || 0) + 1;
  };

  // ---- course 53 ----
  const sec53 = text.slice(text.indexOf("# بخش الف"), text.indexOf("# بخش ب"));
  const blocks53 = splitBlocks(sec53, /\n### (RES-QB-\d{5})[^\n]*\n/);
  for (const [id, body] of blocks53) {
    stats.total++;
    const head = (sec53.match(new RegExp(`### ${id} — سؤال [۰-۹\\d]+ \\[([^\\]]+)\\]`)) || [, ""])[1];
    const qn = Number(id.slice(7));
    const subj = canonicalSubject(head.trim());
    const q = parseResDeepBlock({
      body, year: "۱۴۰۵", course: "۵۳", qno: qn,
      subjectOverride: subj || undefined, idTag: id,
      sourceName: "بانک تجمعی دوزبانه دستیاری — دورهٔ ۵۳ (۱۴۰۵)",
    });
    if (q) push(q); else stats.bad++;
  }

  // ---- courses 51 / 52 ----
  const deepSpec = [
    { period: "۵۱", year: "۱۴۰۳", a: "# بخش ب", b: "# بخش ج" },
    { period: "۵۲", year: "۱۴۰۴", a: "# بخش ج", b: "# بخش د" },
  ];
  for (const spec of deepSpec) {
    const seg = text.slice(text.indexOf(spec.a), text.indexOf(spec.b));
    const deep = seg.split("## بخش ۲")[0];
    const periodLatin = toLatinDigits(spec.period);
    const re = new RegExp(`\\n### دورهٔ? ${spec.period} — (?:سوال|سؤال) [۰-۹\\d]+ / Period ${periodLatin} — Q([۰-۹\\d]+)[^\\n]*\\n([\\s\\S]*?)(?=\\n### دورهٔ? |\\n## |$)`, "g");
    let m;
    while ((m = re.exec(deep))) {
      stats.total++;
      const qno = Number(m[1]);
      const idTag = `TB-P${toLatinDigits(spec.period)}-${String(qno).padStart(5, "0")}`;
      const q = parseResDeepBlock({
        body: m[2], year: spec.year, course: spec.period, qno, idTag,
        sourceName: `بانک تجمعی دوزبانه دستیاری — دورهٔ ${spec.period} (${spec.year})`,
      });
      if (q) push(q); else stats.bad++;
    }

    // ---- course 52 part 2: fast OCR coverage ----
    if (spec.period === "۵۲" && seg.includes("## بخش ۲")) {
      const fast = "## بخش ۲" + seg.split("## بخش ۲")[1];
      const fre = /\n\*\*س[ؤو]ال\s+[۰-۹\d]+\s*\/\s*Q(\d+)\*\*\s*\(`(TB-P52-\d+)`\)[^\n]*?Official key \w+:\s*\*\*(الف|ب|ج|د)\*\*\n([\s\S]*?)(?=\n\*\*س[ؤو]ال|\n## |$)/g;
      let fm;
      while ((fm = fre.exec(fast))) {
        stats.total++;
        const qno = Number(fm[1]); const idTag = fm[2]; const answer = faLetterIndex(fm[3]);
        const chunk = fm[4];
        const stemM = chunk.match(/-\s*متن:\s*(.+?)(?=\n\s*-\s*(?:الف|ب|ج|د)\))/s);
        const optMs = [...chunk.matchAll(/^\s*[-*]\s*(الف|ب|ج|د)\)\s*(.+?)\s*$/gm)];
        let opts = ["", "", "", ""];
        let ok = true;

        // OCR merges TWO questions into one block: option letters ب/ج/د can
        // be printed inline on the same physical line as the preceding
        // option. Walk physical lines in order, splitting inline markers,
        // demanding the exact sequence الف→ب→ج→د.
        const EMBED_RE = /\s+\d{1,3}\s*[-–—]\s*(?:کدامیک|کدام‌?یک|کدام|دنتر|دختر|پسر|آقا|خانم|نوزاد|شیرخوار|کودک|بیمار|مرد|زن|نوجوان|مادری|در ?رادیوگرافی|در ?رادیو ?گرافی|در ?یک ?بیمار)/;
        const cutEmbedded = (t) => t.split(EMBED_RE)[0].split(/\)\s*الف(?=[\s،])/)[0];
        const segmentsOf = (letter, raw) => {
          const txt = cutEmbedded(raw);
          const marks = [...txt.matchAll(/\)\s*([بجد])(?=[\s،]|$)/g)];
          if (!marks.length) return [[letter, txt]];
          const out = [];
          let start = 0; let prev = letter;
          for (const mk of marks) {
            if (LETTERS_FA.indexOf(mk[1]) <= LETTERS_FA.indexOf(prev)) return null;
            out.push([prev, txt.slice(start, mk.index)]);
            start = mk.index + mk[0].length;
            prev = mk[1];
          }
          out.push([prev, txt.slice(start)]);
          return out;
        };
        const rebuilt = [];
        for (const om of optMs) {
          const segs = segmentsOf(om[1], om[2]);
          if (!segs) { ok = false; break; }
          for (const [letter, t0] of segs) {
            if (letter !== LETTERS_FA[rebuilt.length]) { ok = false; break; }
            rebuilt.push(clean(t0).replace(/\s*[✅✔]+\s*$/, ""));
          }
          if (!ok || rebuilt.length === 4) break;
        }
        if (ok && rebuilt.length === 4 && rebuilt.every((t) => t && t.length >= 2)) opts = rebuilt;
        else ok = false;

        const stem = stemM ? clean(stemM[1]) : "";
        if (!ok || answer < 0 || !validOptionSet(opts) || optionSetHasBleed(opts) || stem.length < 15) { stats.bad++; continue; }
        const subj = classifyResidencySubject(stem, "", "", opts);
        push({
          program: "preint", exam_type: "residency",
          subject_fa: subj.subject_fa, subject_en: subj.subject_en, subject_track: subj.subject_track,
          chapter_fa: subj.chapter_fa || "", chapter_en: subj.chapter_en || "",
          question_fa: stem, question_en: "", options_fa: opts, options_en: [],
          correct_index: answer, options_why_fa: ["", "", "", ""], options_why_en: ["", "", "", ""],
          explanation_fa: "", explanation_en: "",
          year: spec.year, year_num: Number(toLatinDigits(spec.year)) || null,
          question_no: qno, question_style: questionStyle(stem, true),
          source: "بانک تجمعی دستیاری — پوشش سریع دورهٔ ۵۲",
          license: "official_ministry_booklet",
          tags: [idTag, `residency-course-${spec.period}`, "fast-coverage"],
          key_source: "official", label_fa: `دورهٔ ${spec.period} دستیاری`,
        });
      }
    }
  }

  stats.imported = questions.length;
  return { questions, stats };
}

// QA/test helpers (harmless in production)
export { splitBlocks, sectionText, parseIdentity, labelledAnswerFa, rightFromOption };
