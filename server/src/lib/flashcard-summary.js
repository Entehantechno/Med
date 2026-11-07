/* flashcard-summary.js — R97: the light deck list for learners (GET /api/flashcards?summary=1).

   The learner's deck picker needs only id, topic and the category/course labels. Full card bodies
   are fetched by id (GET /api/flashcards?ids=) when a deck starts. The summary follows the full
   learner list exactly: same rows (active, track "learn"), demo seed cards skipped, corrupt rows
   skipped, and the teaser gate applied by the caller through `wantIds`.

   The rows are parsed once per bank signature and kept in memory, the same approach the browse
   pool uses (lib/bank-pool.js). The signature is BANK_SIG_SQL, which covers every active flashcard,
   so a bank edit or a university card edit rebuilds the cache on the next learner request. */
import { db } from "../db.js";
import { BANK_SQL, BANK_SIG_SQL, FLASHCARDS_BY_TRACK } from "./flashcard-track.js";
import { studentSafeFlashcard } from "./flashcard-grade.js";
import { topicKeyOf } from "./topic-key.js";

const LABEL_KEYS = ["category", "category_fa", "category_en", "course", "course_fa", "course_en"];
let cache = { sig: null, byId: null };

function signature() {
  const s = db.prepare(BANK_SIG_SQL).get();
  return `${s.n}|${s.t}|${s.m}|${s.r}`;
}

/* parseRow(row) must be the same parser the full list uses (routes/content.js `parse`). */
function rebuild(parseRow) {
  const byId = new Map();
  const rows = db.prepare(
    `SELECT * FROM ${FLASHCARDS_BY_TRACK} WHERE active=1 AND ${BANK_SQL} ORDER BY id`
  ).all();
  for (const row of rows) {
    try {
      const card = parseRow(row);
      if (card.content_origin === "demo_seed") continue;
      const topic = topicKeyOf(card);          // the full list uses the unsanitised card here too
      const safe = studentSafeFlashcard(card);
      const item = { id: row.id, topic };
      for (const k of LABEL_KEYS) {
        if (safe[k] != null && safe[k] !== "") item[k] = safe[k];
      }
      byId.set(row.id, item);
    } catch { /* same as the full list: a corrupt card is skipped */ }
  }
  return byId;
}

/* wantIds: null for the whole learner list, or an array of card ids (already teaser-gated). */
export function learnerDeckSummary(wantIds, parseRow) {
  const sig = signature();
  if (cache.sig !== sig || !cache.byId) cache = { sig, byId: rebuild(parseRow) };
  if (!wantIds) return [...cache.byId.values()];
  return wantIds
    .map((id) => cache.byId.get(Number(id)))
    .filter(Boolean)
    .sort((a, b) => a.id - b.id);
}

/* Test hook: forget the in-memory cache. */
export function resetLearnerDeckSummary() { cache = { sig: null, byId: null }; }
