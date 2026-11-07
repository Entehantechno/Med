/* R96 — one SQL expression for a flashcard's track, shared by the list route, the bank split
   and the expression index idx_flashcards_active_track (created in db.js).

   Why this shape (measured on the 11.7k-row bank, /api/flashcards was ~100 ms of synchronous
   JSON parsing per request):
   - The index stores the track expression, so a query that repeats the exact expression reads
     it without parsing JSON. SQLite only does that when the query uses the same expression.
   - The planner does not pick the index for "IS NOT 'learn'" on its own, so the list reads
     FROM flashcards INDEXED BY idx_flashcards_active_track. The bank predicate is an equality,
     and the non-bank predicate is written as three index ranges, which cover exactly the rows
     that are not 'learn' (NULL, numbers and any other text).
   Semantics match the pre-R96 predicate: a corrupt row (json_valid = 0) has no track and is
   never the bank; a missing track (NULL) is not the bank either. */
export const TRACK_EXPR = "CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.track') END";
export const BANK_SQL = `(${TRACK_EXPR}) = 'learn'`;
export const NON_BANK_SQL = `((${TRACK_EXPR}) IS NULL OR (${TRACK_EXPR}) < 'learn' OR (${TRACK_EXPR}) > 'learn')`;
export const FLASHCARDS_BY_TRACK = "flashcards INDEXED BY idx_flashcards_active_track";
export const TRACK_INDEX_SQL = `CREATE INDEX IF NOT EXISTS idx_flashcards_active_track ON flashcards(active, (${TRACK_EXPR}))`;

/* R96 — the browse pool's cache key. It ran on every learner request (learn/browse) and took
   ~35 ms because the table rows are ~6 KB each. The covering index below holds every column
   the key reads, so SQLite reads only the narrow index (~1 ms). Same query, same values. */
export const FLASHCARDS_SIG_INDEX_SQL = "CREATE INDEX IF NOT EXISTS idx_flashcards_sig ON flashcards(active, revision, content_updated_at, updated_at, id)";
export const BANK_SIG_SQL = "SELECT COUNT(*) AS n, COALESCE(MAX(COALESCE(content_updated_at, updated_at)), '') AS t, COALESCE(MAX(id), 0) AS m, COALESCE(SUM(revision), 0) AS r FROM flashcards WHERE active=1";
