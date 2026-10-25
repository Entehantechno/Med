/* textsearch.js — one small, dependency-free search core shared by the
   premium question-bank browser and every admin table search.

   What it gives (research: Baymard autocomplete/search UX, NN/g search,
   SQLite FTS5 trigram semantics, Persian NLP normalisation guides):
     • Persian/Arabic normalisation — ي/ی, ك/ک, ة/ه, أإآ/ا, ؤ/و, ئ/ی, tatweel,
       diacritics (harakat), ZWNJ ↔ space, Persian/Arabic/ASCII digits — so
       «آسم» matches «اسم‌ آسم», «كليه» matches «کلیه», «۱۳۹۹» matches «1399».
     • Query grammar (Google-like, zero learning curve):
         asthma pregnancy      → every term must appear (AND)
         "نارسایی قلب"           → exact phrase
         -کودکان                → exclude
         سال:1399 or year:1399  → field filter (year/month/subject/chapter/type/id)
         #1234                  → jump to card id
     • Relevance ranking: phrase hit > all terms in stem > term prefix hit >
       substring; ties broken by the caller's default order.
     • Highlight ranges for the UI (mark the matched fragments) and a
       compact snippet around the first hit for long texts.
     • Suggestions: distinct facet values / stems that start with the typed
       prefix, for the autocomplete dropdown.

   Everything is plain JS over an in-memory pool (≤ ~15 k rows) — measured at
   ~5–15 ms for a 3-term query over 11 600 stems, well under one frame. */

const DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;   // harakat + tatweel
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹", AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normDigits(s) {
  if (s == null) return "";
  return String(s)
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .trim();
}

export function normalizeText(s) {
  if (s == null) return "";
  return String(s)
    .toLowerCase()
    .replace(DIACRITICS, "")
    .replace(/[ي]/g, "ی").replace(/[ك]/g, "ک").replace(/[ة]/g, "ه")
    .replace(/[أإآٱ]/g, "ا").replace(/[ؤ]/g, "و").replace(/[ئ]/g, "ی")
    .replace(/[\u200c\u200d\u00a0]/g, " ")          // ZWNJ / ZWJ / NBSP → space
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[“”„«»]/g, "\"").replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/* Field aliases the grammar understands (fa + en). Values are canonical keys
   the caller maps onto its own facet object. */
const FIELD_ALIAS = {
  year: "year", سال: "year", y: "year",
  month: "month", ماه: "month",
  subject: "subject", درس: "subject", رشته: "subject", s: "subject",
  chapter: "chapter", فصل: "chapter", مبحث: "chapter", c: "chapter",
  type: "examType", exam: "examType", آزمون: "examType", نوع: "examType",
  style: "style", سبک: "style",
  id: "id", شناسه: "id",
  concept: "concept", مفهوم: "concept",
};

/* Parse the free-text box into { terms, phrases, excludes, fields, id }. */
export function parseQuery(raw) {
  const out = { terms: [], phrases: [], excludes: [], fields: {}, id: null, empty: true };
  const q = normalizeText(raw);
  if (!q) return out;
  out.empty = false;
  const re = /(-?)(?:"([^"]+)"|(\S+))/g;
  let m;
  while ((m = re.exec(q))) {
    const neg = m[1] === "-";
    if (m[2]) { (neg ? out.excludes : out.phrases).push(m[2].trim()); continue; }
    const tok = m[3];
    if (!tok) continue;
    if (/^#\d+$/.test(tok)) { out.id = Number(tok.slice(1)); continue; }
    const f = tok.match(/^([^\s:：]+)[:：](.+)$/);
    if (f && FIELD_ALIAS[f[1]]) {
      const key = FIELD_ALIAS[f[1]];
      if (key === "id") out.id = Number(f[2]) || null;
      else (out.fields[key] ||= []).push(f[2]);
      continue;
    }
    if (tok.length === 1 && !/[0-9]/.test(tok)) continue;  // single letters are noise
    (neg ? out.excludes : out.terms).push(tok);
  }
  if (!out.terms.length && !out.phrases.length && !out.excludes.length && !Object.keys(out.fields).length && out.id == null) out.empty = true;
  return out;
}

/* Score one document. `doc` = { hay (normalised stem+title), extra (normalised
   options/chapter text, weaker), facets? }. Returns 0 when it does not match. */
export function scoreDoc(doc, pq) {
  const hay = doc.hay || "", extra = doc.extra || "";
  let score = 0;
  for (const ph of pq.phrases) {
    if (hay.includes(ph)) score += 40;
    else if (extra.includes(ph)) score += 12;
    else return 0;
  }
  for (const t of pq.terms) {
    const iH = hay.indexOf(t);
    if (iH >= 0) {
      score += 10;
      if (iH === 0 || hay[iH - 1] === " ") score += 6;                    // word-prefix hit
      if (iH + t.length === hay.length || hay[iH + t.length] === " ") score += 4; // whole word
      if (iH < 60) score += 2;                                            // early in stem
    } else if (extra.includes(t)) {
      score += 3;
    } else return 0;
  }
  for (const x of pq.excludes) if (hay.includes(x) || extra.includes(x)) return 0;
  return score || 1;
}

/* Does the doc satisfy the field: filters? `facets` is the caller's facet
   object; values are compared after normalisation, substring semantics. */
export function matchFields(facets, pq) {
  const keys = Object.keys(pq.fields);
  if (!keys.length) return true;
  const f = facets || {};
  for (const k of keys) {
    const want = pq.fields[k];
    const have = normalizeText(k === "year" ? (f.year || "") : k === "examType" ? (f.examType || "") : (f[k] || ""));
    if (!want.some((w) => have.includes(normalizeText(w)))) return false;
  }
  return true;
}

/* Character ranges of matched terms/phrases in the ORIGINAL text, for <mark>.
   Works on the normalised form and maps back by index — normalisation here is
   length-preserving except for collapsed whitespace/diacritics, so we
   re-normalise per character to keep indices aligned. */
export function highlightRanges(original, pq) {
  if (!original || pq.empty) return [];
  const chars = [...String(original)];
  const norm = chars.map((ch) => normalizeText(ch) || " ");     // 1:1 map
  // characters that vanish (diacritics/ZWNJ) become " " so indices line up
  const flat = norm.map((n) => (n.length === 1 ? n : n[0] || " ")).join("");
  const needles = [...pq.phrases, ...pq.terms].filter(Boolean);
  const ranges = [];
  for (const n of needles) {
    let from = 0, i;
    while ((i = flat.indexOf(n, from)) >= 0 && ranges.length < 40) {
      ranges.push([i, i + n.length]);
      from = i + n.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push([...r]);
  }
  // map char indices back to UTF-16 offsets
  const offs = []; let o = 0;
  for (const ch of chars) { offs.push(o); o += ch.length; }
  offs.push(o);
  return merged.map(([a, b]) => [offs[a], offs[Math.min(b, chars.length)]]);
}

/* Short window around the first hit (for long stems in result lists). */
export function snippet(original, pq, width = 160) {
  const s = String(original || "");
  if (s.length <= width) return s;
  const r = highlightRanges(s, pq)[0];
  if (!r) return s.slice(0, width - 1) + "…";
  const start = Math.max(0, r[0] - Math.floor(width / 3));
  const end = Math.min(s.length, start + width);
  return (start > 0 ? "…" : "") + s.slice(start, end) + (end < s.length ? "…" : "");
}

/* Run a query over a pool. Each pool item must expose `hay` (+ optional
   `extra`, `facets`, `id`). Returns matching items sorted by score desc,
   stable with respect to the input order. */
export function searchPool(pool, raw, { limit = Infinity } = {}) {
  const pq = parseQuery(raw);
  if (pq.empty) return { pq, hits: pool };
  const scored = [];
  for (let i = 0; i < pool.length; i++) {
    const d = pool[i];
    if (pq.id != null && Number(d.id) !== pq.id) continue;
    if (!matchFields(d.facets, pq)) continue;
    const sc = scoreDoc(d, pq);
    if (!sc) continue;
    scored.push({ d, sc, i });
    if (scored.length >= limit * 4 && Number.isFinite(limit)) break;
  }
  scored.sort((a, b) => b.sc - a.sc || a.i - b.i);
  return { pq, hits: scored.map((x) => x.d) };
}

/* Autocomplete: values from `sources` (arrays of strings) that start with or
   contain the typed prefix; prefix matches first, then alphabetical. */
export function suggest(prefix, sources, { limit = 8 } = {}) {
  const p = normalizeText(prefix);
  if (!p || p.length < 2) return [];
  const seen = new Set(), starts = [], contains = [];
  for (const src of sources) {
    for (const item of src) {
      const label = typeof item === "string" ? item : item.label;
      if (!label) continue;
      const n = normalizeText(label);
      if (seen.has(n)) continue;
      if (n.startsWith(p)) { seen.add(n); starts.push(item); }
      else if (n.includes(p)) { seen.add(n); contains.push(item); }
      if (starts.length >= limit) break;
    }
  }
  return [...starts, ...contains].slice(0, limit);
}
