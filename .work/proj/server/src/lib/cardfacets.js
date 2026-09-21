/* cardfacets.js — one shared vocabulary for classifying question cards.
 *
 * Every question in the bank carries provenance in `data.source_meta` (written
 * by the past-exam importer) plus a handful of top-level fields. Admin screens,
 * learner browsing and the modification log all need to slice that same data,
 * so the extraction lives here once instead of being re-derived in each route.
 *
 * The vocabulary is deliberately flat: a card resolves to a small set of scalar
 * facet values, and callers combine them with AND across facets / OR inside a
 * facet — the standard faceted-search contract users already expect.
 *
 *   subject   نورولوژی            (the exam subject)
 *   chapter   سردرد…               (chapter inside the subject)
 *   concept   migraine-prophylaxis (the single teaching point)
 *   year      ۱۴۰۴                 (exam year, Persian digits as printed)
 *   month     شهریور               (sitting month)
 *   sitting   main | midterm
 *   scope     ملی | قطبی
 *   style     case | recall | negative | image
 *   origin    official_exam | demo_seed | authored
 *
 * `origin` is the one that lets us retire the seeded demo questions: real
 * imported exam questions carry source_meta.kind === "past_exam_import", the
 * sample cards created by seed.js carry content_origin === "demo_seed", and
 * anything an admin types by hand is "authored".
 */

/** Normalise Persian/Arabic-Indic digits to ASCII so numeric compares work. */
export function toLatinDigits(s) {
  if (s == null) return "";
  return String(s)
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** Persian month name → 1..12, so sittings sort chronologically. */
export const MONTH_ORDER = {
  فروردین: 1, اردیبهشت: 2, خرداد: 3, تیر: 4, مرداد: 5, شهریور: 6,
  مهر: 7, آبان: 8, آذر: 9, دی: 10, بهمن: 11, اسفند: 12,
};

/** Two-digit exam years are 13xx; four-digit ones are already absolute. */
export function fullYear(y) {
  const n = parseInt(toLatinDigits(y), 10);
  if (!Number.isFinite(n)) return null;
  return n > 1000 ? n : 1300 + n;
}

/**
 * A sortable key for a sitting, e.g. 1404-09 → 140409. Lets the UI order
 * "newest exam first" without parsing dates on every comparison.
 */
export function sittingKey(year, month) {
  const y = fullYear(year);
  if (!y) return 0;
  return y * 100 + (MONTH_ORDER[month] || 0);
}

/** A multiple-choice card with no gradeable answer (auditor refused a key).
 *  Such cards may be browsed/studied but never enter a graded surface:
 *  exam simulator, challenges, FSRS queues or the curated path. */
export function cardIsKeyless(d = {}) {
  const sm = d.source_meta || {};
  if (sm.keyless === true || sm.key_available === false) return true;
  const type = d.type || "mcq";
  if (type === "mcq" && Array.isArray(d.options) && d.options.length === 4
      && !d.options.some((o) => o && o.correct)) return true;
  return false;
}

/** Premium browse-bank-only: a real official card that never made the curated
 *  path (surplus overflow or an ungradeable/keyless item). It must never leak
 *  into a graded learner surface (SRS review/placement/practice), which all
 *  draw from curated path nodes. Keyless cards are a subset. */
export function cardIsBankOnly(d = {}) {
  const sm = d.source_meta || {};
  if (sm.route === "bank_only") return true;
  return cardIsKeyless(d);
}

/** Where did this card come from? Drives the "hide demo content" switch. */
export function cardOrigin(d) {
  if (d?.source_meta?.kind === "past_exam_import") return "official_exam";
  if (d?.content_origin === "demo_seed") return "demo_seed";
  return "authored";
}

/**
 * Extract every facet of a card in one pass.
 *
 * @param {object} d      parsed data_json
 * @param {object} row    the flashcards row (id, difficulty, active, updated_at, created_at)
 * @returns {object} flat facet bag; missing values are "" rather than undefined
 *                   so the client can compare without null-guards everywhere.
 */
export function cardFacets(d = {}, row = {}) {
  const sm = d.source_meta || {};
  const origin = cardOrigin(d);
  const year = sm.year || "";
  const month = sm.month || "";
  return {
    origin,
    official: origin === "official_exam",
    demo: origin === "demo_seed",

    // --- exam provenance (only meaningful for imported questions) ---
    examType: sm.exam_type || "",
    subject: sm.subject_fa || "",
    subjectEn: sm.subject_en || "",
    chapter: sm.chapter_fa || "",
    chapterEn: sm.chapter_en || "",
    concept: sm.concept || "",
    conceptFa: sm.concept_fa || "",
    conceptEn: sm.concept_en || "",
    year,
    yearNum: fullYear(year) || null,
    month,
    sitting: sm.sitting || "",
    scope: sm.scope || "",
    pole: sm.pole || "",
    examLabel: sm.label_fa || "",
    examLabelEn: sm.label_en || "",
    sittingKey: sittingKey(year, month),
    questionNo: sm.question_no ?? null,
    style: sm.question_style || "",
    keySource: sm.key_source || "",
    keyless: sm.keyless === true || sm.key_available === false,
    track: sm.subject_track || "",
    license: sm.license || "",
    tags: Array.isArray(sm.tags) ? sm.tags : [],

    // --- authoring / freshness ---
    difficulty: row.difficulty || d.difficulty || "medium",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    revision: row.revision ?? null,
    lastEditor: row.last_editor_name || "",
    lastAction: row.last_action || "",
  };
}

/**
 * Build the distinct value lists that power filter dropdowns.
 * Counts are included so the UI can show "۱۴۰۴ (۱۲)" and grey out empties —
 * a facet with a zero count is never rendered, per faceted-search guidance.
 */
export function buildFacetIndex(cards, lang = "fa") {
  const en = lang === "en";
  const bag = {
    subject: new Map(), chapter: new Map(), concept: new Map(),
    year: new Map(), month: new Map(), sitting: new Map(), scope: new Map(),
    style: new Map(), origin: new Map(), difficulty: new Map(), exam: new Map(),
    examType: new Map(),
  };
  const bump = (m, key, label, extra) => {
    if (!key) return;
    const cur = m.get(key) || { value: key, label: label || key, count: 0, ...extra };
    cur.count += 1;
    m.set(key, cur);
  };
  for (const c of cards) {
    const f = c.facets || c;
    // The `value` stays Persian everywhere — it is the key the filter query
    // uses — while `label` follows the reading language, so an English learner
    // sees "Tuberculosis (4)" but still sends `chapter=سل`.
    bump(bag.subject, f.subject, (en && f.subjectEn) || f.subject);
    bump(bag.chapter, f.chapter, (en && f.chapterEn) || f.chapter, { subject: f.subject });
    bump(bag.concept, f.concept, (en ? f.conceptEn : f.conceptFa) || f.concept, { subject: f.subject, chapter: f.chapter });
    bump(bag.year, f.year, f.year, { sortKey: f.yearNum || 0 });
    bump(bag.month, f.month, f.month, { sortKey: MONTH_ORDER[f.month] || 0 });
    bump(bag.sitting, f.sitting, f.sitting);
    bump(bag.scope, f.scope, f.scope);
    bump(bag.style, f.style, f.style);
    bump(bag.origin, f.origin, f.origin);
    bump(bag.difficulty, f.difficulty, f.difficulty);
    bump(bag.exam, f.examLabel, (en && f.examLabelEn) || f.examLabel, { sortKey: f.sittingKey || 0 });
    bump(bag.examType, f.examType, f.examType, { keyless: f.keyless === true });
  }
  const out = {};
  for (const k of Object.keys(bag)) {
    out[k] = [...bag[k].values()].sort((a, b) => {
      if (a.sortKey != null && b.sortKey != null && a.sortKey !== b.sortKey) return b.sortKey - a.sortKey;
      return String(a.label).localeCompare(String(b.label), "fa");
    });
  }
  return out;
}

/**
 * Apply a filter bag to one card's facets.
 *
 * Contract (matches how shoppers/learners expect filters to behave):
 *   - within a facet, an array of values is OR   (year ۱۴۰۳ OR ۱۴۰۴)
 *   - across facets it is AND                    (subject نورولوژی AND year ۱۴۰۴)
 * A scalar is accepted anywhere an array is, so old single-select callers keep
 * working unchanged.
 */
export function matchFacets(f, filt = {}) {
  const has = (v) => v != null && v !== "" && !(Array.isArray(v) && !v.length);
  const oneOf = (val, want) => {
    if (!has(want)) return true;
    const list = Array.isArray(want) ? want : [want];
    return list.map(String).includes(String(val ?? ""));
  };
  if (!oneOf(f.subject, filt.subject)) return false;
  if (!oneOf(f.chapter, filt.chapter)) return false;
  if (!oneOf(f.concept, filt.concept)) return false;
  if (!oneOf(f.year, filt.year)) return false;
  if (!oneOf(f.month, filt.month)) return false;
  if (!oneOf(f.sitting, filt.sitting)) return false;
  if (!oneOf(f.scope, filt.scope)) return false;
  if (!oneOf(f.style, filt.style)) return false;
  if (!oneOf(f.origin, filt.origin)) return false;
  if (!oneOf(f.difficulty, filt.difficulty)) return false;
  if (!oneOf(f.examLabel, filt.exam)) return false;
  if (!oneOf(f.examType, filt.examType)) return false;

  // exam-year range, inclusive; uses the absolute year so ۹۸ < ۱۴۰۰ compares right
  if (has(filt.yearFrom) && (f.yearNum ?? 0) < fullYear(filt.yearFrom)) return false;
  if (has(filt.yearTo) && (f.yearNum ?? 9999) > fullYear(filt.yearTo)) return false;

  // modification window, day granularity on the ISO timestamps we store
  const day = (s) => String(s || "").slice(0, 10);
  if (has(filt.updatedFrom) && day(f.updatedAt) < filt.updatedFrom) return false;
  if (has(filt.updatedTo) && day(f.updatedAt) > filt.updatedTo) return false;
  if (has(filt.createdFrom) && day(f.createdAt) < filt.createdFrom) return false;
  if (has(filt.createdTo) && day(f.createdAt) > filt.createdTo) return false;
  return true;
}

/** Sort comparators shared by the admin table and the learner browser. */
export const SORTS = {
  newest_exam: (a, b) => (b.facets.sittingKey - a.facets.sittingKey) || (a.id - b.id),
  oldest_exam: (a, b) => (a.facets.sittingKey - b.facets.sittingKey) || (a.id - b.id),
  last_modified: (a, b) => String(b.facets.updatedAt).localeCompare(String(a.facets.updatedAt)) || (b.id - a.id),
  first_modified: (a, b) => String(a.facets.updatedAt).localeCompare(String(b.facets.updatedAt)) || (a.id - b.id),
  newest_added: (a, b) => String(b.facets.createdAt).localeCompare(String(a.facets.createdAt)) || (b.id - a.id),
  oldest_added: (a, b) => String(a.facets.createdAt).localeCompare(String(b.facets.createdAt)) || (a.id - b.id),
  most_revised: (a, b) => ((b.facets.revision || 0) - (a.facets.revision || 0)) || (a.id - b.id),
  id_desc: (a, b) => b.id - a.id,
  id_asc: (a, b) => a.id - b.id,
};

export function sortCards(cards, key) {
  const cmp = SORTS[key] || SORTS.id_desc;
  return [...cards].sort(cmp);
}
