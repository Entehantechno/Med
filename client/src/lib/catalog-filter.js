/* Shared list rules for catalogue screens (virtual-patient cases, flashcard decks):
   text matching, facet counts and sorting. Pure functions, so the rules are unit-tested
   without rendering a page. */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/* Makes Persian/Arabic spellings comparable: ي/ك → ی/ک, digits → ASCII, no ZWNJ,
   no diacritics, single spaces, lower case. */
export function normalizeSearch(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\u200c\u200d\u00a0]/g, " ")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/\s+/g, " ")
    .trim();
}

/* Distinct non-empty values with how many items carry them, sorted by name. */
export function facetCounts(items, pick) {
  const counts = new Map();
  for (const item of items) {
    const value = String(pick(item) ?? "").trim();
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

/* Easy → medium → hard. Unknown values sort last. */
export const DIFFICULTY_RANK = { easy: 0, medium: 1, hard: 2 };
export function difficultyRank(level) {
  return Object.prototype.hasOwnProperty.call(DIFFICULTY_RANK, level) ? DIFFICULTY_RANK[level] : 3;
}

/* Returns a new array sorted by `mode`. Unknown modes keep the input order. */
export function sortBy(list, mode, { title, difficulty, unattempted, count = () => 0 }) {
  const copy = [...list];
  if (mode === "title") return copy.sort((a, b) => title(a).localeCompare(title(b)));
  if (mode === "difficulty") return copy.sort((a, b) => difficultyRank(difficulty(a)) - difficultyRank(difficulty(b)) || title(a).localeCompare(title(b)));
  if (mode === "unattempted") return copy.sort((a, b) => (unattempted(b) ? 1 : 0) - (unattempted(a) ? 1 : 0) || title(a).localeCompare(title(b)));
  if (mode === "count") return copy.sort((a, b) => count(b) - count(a) || title(a).localeCompare(title(b)));
  return copy;
}
