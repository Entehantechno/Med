/* lesson-translate.js — the bilingual lesson text (درسنامه) of a flashcard.

   Rule (product decision):
   • A flashcard's QUESTION and OPTIONS follow the flashcard language rule
     (flashcard-language.js): when only one language was authored, that
     language is shown to every student.
   • A درسنامه (micro-lesson) must match the SITE language. When the authored
     micro-lesson lacks a field in the site language but has it in the other
     language, the server reports that field as PENDING. The client then asks
     for an AI translation (POST /learn/lessons/translate), caches the result in
     the browser, and never asks again for the same text.

   This module only describes the shape: which fields are missing, what is sent
   to the translator, how the answer is validated, and how it is applied. It has
   no I/O except the per-user budget (in memory, deliberately: it limits runaway
   AI spend; it is not a billing record). The AI call lives in ai-engine.js. */

import { createHash } from "node:crypto";

export const MICRO_KEYS = ["lead", "golden", "points", "options", "source"];
const LIST_KEYS = new Set(["points", "options"]);

export const otherLang = (lang) => (lang === "fa" ? "en" : "fa");

const txt = (v) => (typeof v === "string" ? v : "");
const hasText = (v) => txt(v).trim().length > 0;
const listOf = (v) => (Array.isArray(v) ? v.map(txt) : []);

/* Does the micro-lesson carry this field in language L? */
function hasField(m, key, L) {
  if (LIST_KEYS.has(key)) return listOf(m[`${key}_${L}`]).some(hasText);
  return hasText(m[`${key}_${L}`]);
}

/* The fields that exist in the other language but are missing in `lang`.
   Legacy unsuffixed `source` is language-neutral, so it never triggers a
   translation. */
export function microMissing(m, lang) {
  if (!m || typeof m !== "object") return { from: otherLang(lang), fields: [] };
  const from = otherLang(lang);
  const fields = MICRO_KEYS.filter((k) => hasField(m, k, from) && !hasField(m, k, lang));
  return { from, fields };
}

/* Text of one micro field in language L, without any cross-language fallback. */
export function microValue(m, key, L) {
  if (!m || typeof m !== "object") return LIST_KEYS.has(key) ? [] : "";
  if (key === "source") return txt(m[`source_${L}`]) || txt(m.source);
  if (LIST_KEYS.has(key)) return listOf(m[`${key}_${L}`]);
  return txt(m[`${key}_${L}`]);
}

/* Source-language content for the missing fields only (what the AI receives). */
export function microSourceBundle(m, { from, fields }) {
  const out = {};
  for (const k of fields) {
    const v = microValue(m, k, from);
    if (LIST_KEYS.has(k)) { if (v.some(hasText)) out[k] = v; } else if (hasText(v)) out[k] = v;
  }
  return out;
}

/* A stable key of the source text. Any authored edit changes it, so a cached
   translation can never be served for a different source. */
export function microSourceHash(m, { from, fields }, to) {
  const bundle = microSourceBundle(m, { from, fields });
  return createHash("sha256").update(JSON.stringify({ from, to, bundle })).digest("hex").slice(0, 32);
}

/* A translation is accepted only if every non-empty source field came back with
   the same shape: strings for text, same-length arrays for lists, and no blank
   item where the source had text. Malformed output is rejected whole. */
export function validateMicroTranslation(source, t) {
  if (!t || typeof t !== "object" || Array.isArray(t)) return false;
  for (const k of Object.keys(source)) {
    if (LIST_KEYS.has(k)) {
      const sv = source[k];
      const tv = t[k];
      if (!Array.isArray(tv) || tv.length !== sv.length) return false;
      for (let i = 0; i < sv.length; i++) {
        if (hasText(sv[i]) && !hasText(tv[i])) return false;
      }
    } else if (!hasText(t[k])) {
      return false;
    }
  }
  return true;
}

/* Keep only the translated fields that were requested, in the target language. */
export function pickMicroTranslation(source, t) {
  const out = {};
  for (const k of Object.keys(source)) {
    if (LIST_KEYS.has(k)) out[k] = t[k].map(txt);
    else out[k] = txt(t[k]).trim();
  }
  return out;
}

/* Apply a validated translation to the raw micro object for language `to`.
   Authored text in `to` is never overwritten. */
export function applyMicroTranslation(m, to, translated, fields) {
  const out = { ...m };
  for (const k of fields) {
    if (translated[k] === undefined) continue;
    out[`${k}_${to}`] = translated[k];
  }
  return out;
}

/* The line a summary shows for a card: golden tip, else lead, else first point.
   Mirrors chaptersummary.js and the client, so a translated card produces the
   same bullet as a natively authored one. */
export function summaryPick(micro, lang) {
  const get = (k) => microValue(micro, k, lang);
  const golden = get("golden");
  if (hasText(golden)) return { kind: "golden", text: golden };
  const lead = get("lead");
  if (hasText(lead)) return { kind: "lead", text: lead };
  const pts = get("points");
  if (pts[0] && hasText(pts[0])) return { kind: "points0", text: pts[0] };
  return null;
}

/* Per-user budget for lesson translations (one budget unit = one AI call that
   may translate up to MAX_BATCH cards). */
export const MAX_BATCH = 8;
const buckets = new Map();
export function takeLessonBudget(userId, now = Date.now()) {
  const max = Math.max(1, Number(process.env.LESSON_TRANSLATE_PER_HOUR) || 60);
  const windowMs = 60 * 60 * 1000;
  const b = buckets.get(userId) || { start: now, n: 0 };
  if (now - b.start >= windowMs) { b.start = now; b.n = 0; }
  if (b.n >= max) { buckets.set(userId, b); return false; }
  b.n += 1;
  buckets.set(userId, b);
  return true;
}

/* A call that produced no usable translation (the model failed, not the learner)
   gives its unit back, so a provider outage does not use up the hourly budget. */
export function refundLessonBudget(userId) {
  const b = buckets.get(userId);
  if (b && b.n > 0) b.n -= 1;
}

/* Test hook only. */
export function _resetLessonBudget() { buckets.clear(); }
