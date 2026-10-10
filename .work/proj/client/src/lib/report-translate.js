/* report-translate.js — translate a virtual-patient report into the current
   site language, with a browser cache so the AI is only asked once.

   The bundle shape mirrors server/src/lib/report-translate.js on purpose: the
   same fields are read from the report, sent to the translator, and written
   back. Cache key = attempt + source language + target language + SHA-256 of
   the source bundle, so a changed report can never be served a stale text. */
import { api } from "../api.js";
import { getCachedLesson, putCachedLesson } from "./lesson-cache.js";

const LIST_KEYS = ["strengths", "weaknesses", "missed", "commonMistakes"];
const ORDER_KEYS = ["appropriate", "unnecessary", "missedKey"];
const str = (v) => (typeof v === "string" ? v : "");
const arrOfStr = (v) => (Array.isArray(v) ? v.map(str) : []);

/* Source bundle from the public report (the same fields the server extracts). */
export function reportBundleOf(ev) {
  if (!ev || typeof ev !== "object") return {};
  const b = {};
  if (str(ev.microlearning).trim()) b.microlearning = str(ev.microlearning);
  if (str(ev.suggestion).trim()) b.suggestion = str(ev.suggestion);
  for (const k of LIST_KEYS) {
    const list = arrOfStr(ev[k]);
    if (list.some((x) => x.trim())) b[k] = list;
  }
  if (Array.isArray(ev.results) && ev.results.length) {
    const rows = ev.results.map((r) => ({ label: str(r?.label), reason: str(r?.reason) }));
    if (rows.some((r) => r.label.trim() || r.reason.trim())) b.results = rows;
  }
  const sections = Array.isArray(ev.sectionScores?.sections) ? ev.sectionScores.sections.map((s) => str(s?.label)) : [];
  if (sections.some((x) => x.trim())) b.sectionLabels = sections;
  if (ev.orderReview && typeof ev.orderReview === "object") {
    const ob = {};
    for (const k of ORDER_KEYS) {
      const list = arrOfStr(ev.orderReview[k]);
      if (list.some((x) => x.trim())) ob[k] = list;
    }
    if (Object.keys(ob).length) b.orderReview = ob;
  }
  return b;
}

/* Put translated text in place of the source text; everything else stays. */
export function applyReportBundle(ev, t) {
  if (!t || typeof t !== "object") return ev;
  const out = { ...ev };
  if (t.microlearning !== undefined) out.microlearning = t.microlearning;
  if (t.suggestion !== undefined) out.suggestion = t.suggestion;
  for (const k of LIST_KEYS) if (t[k] !== undefined) out[k] = t[k];
  if (Array.isArray(t.results) && Array.isArray(ev.results)) {
    out.results = ev.results.map((r, i) => ({ ...r, label: t.results[i]?.label ?? r.label, reason: r?.reason ? (t.results[i]?.reason ?? r.reason) : r?.reason }));
  }
  if (Array.isArray(t.sectionLabels) && ev.sectionScores?.sections) {
    out.sectionScores = { ...ev.sectionScores, sections: ev.sectionScores.sections.map((s, i) => ({ ...s, label: t.sectionLabels[i] ?? s.label })) };
  }
  if (t.orderReview && ev.orderReview) {
    out.orderReview = { ...ev.orderReview };
    for (const k of ORDER_KEYS) if (t.orderReview[k] !== undefined) out.orderReview[k] = t.orderReview[k];
  }
  return out;
}

async function sha256Hex(text) {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const buf = await subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Non-secure context (no SubtleCrypto): FNV-1a is enough to tell texts apart.
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); h1 ^= c; h1 = Math.imul(h1, 0x01000193); h2 ^= c; h2 = Math.imul(h2, 0x5bd1e995); }
  return `fnv${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}${text.length}`;
}

export function reportCacheKey(attemptId, from, to, bundleHash) {
  return `vpreport:v1:${attemptId}:${from}>${to}:${bundleHash}`;
}

const inflight = new Map();

/* Returns { bundle, cached }. Throws on network/AI failure (caller shows the
   original text with a notice). Concurrent calls for the same key share one
   request. */
export async function translateReport({ attemptId, from, to, source }) {
  const bundle = reportBundleOf(source);
  if (!Object.keys(bundle).length) return { bundle: {}, cached: true };
  const key = reportCacheKey(attemptId, from, to, await sha256Hex(JSON.stringify(bundle)));
  const hit = await getCachedLesson(key);
  if (hit) return { bundle: hit, cached: true };
  if (inflight.has(key)) return inflight.get(key);
  const p = api.post(`/exam/attempts/${attemptId}/translate`, { to }, { timeoutMs: 60_000, stage: "translate" })
    .then(async (r) => {
      const translated = r && r.bundle && typeof r.bundle === "object" ? r.bundle : null;
      if (!translated) throw new Error("translation_empty");
      await putCachedLesson(key, translated);
      return { bundle: translated, cached: false };
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
