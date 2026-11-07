/* bank-pool.js — the competitive bank as an in-memory pool for search, facets and teasers.
   Built from SQLite once per bank signature (count, last update, max id, revision sum). Moved
   out of routes/learn.js in R96 so that /api/flashcards (routes/content.js) can apply the same
   free-learner teaser rule without importing a route module. Behaviour is unchanged. */
import { db } from "../db.js";
import { cardFacets, sortCards } from "./cardfacets.js";
import { normalizeText } from "./textsearch.js";
import { BANK_SIG_SQL } from "./flashcard-track.js";

let browsePoolCache = { sig: null, all: null };

export function browsePool() {
  const s = db.prepare(BANK_SIG_SQL).get(); // R96: served by idx_flashcards_sig (see lib/flashcard-track.js)
  const sig = `${s.n}|${s.t}|${s.m}|${s.r}`;
  if (browsePoolCache.sig === sig) return browsePoolCache.all;

  // Extract only the handful of fields the list needs INSIDE SQLite instead of
  // JSON.parse-ing every full card in JS. Parsing 11 000+ cards (options,
  // explanations, micro-lessons, sources — ~50 MB of JSON) allocated ~250 MB
  // of V8 heap that the runtime never handed back to the OS: the process sat
  // at ~400 MB RSS on a 1 GB cPanel plan. Now the pool costs ~15 MB.
  const rows = db.prepare(
    `SELECT id, public_code, difficulty, created_at, content_updated_at, updated_at, revision,
            json_extract(data_json, '$.q_fa') AS q_fa,
            json_extract(data_json, '$.q_en') AS q_en,
            json_extract(data_json, '$.title_fa') AS title_fa,
            json_extract(data_json, '$.title_en') AS title_en,
            json_extract(data_json, '$.premium') AS premium,
            json_extract(data_json, '$.topic') AS topic,
            json_extract(data_json, '$.difficulty') AS d_difficulty,
            json_extract(data_json, '$.content_origin') AS content_origin,
            json_extract(data_json, '$.source_meta') AS source_meta,
            (SELECT group_concat(COALESCE(json_extract(o.value,'$.fa'),'') || ' ' || COALESCE(json_extract(o.value,'$.en'),''), ' ')
               FROM json_each(COALESCE(json_extract(data_json,'$.options'), '[]')) o) AS opts_text
       FROM flashcards
      WHERE active=1 AND json_valid(data_json) AND json_extract(data_json, '$.track') = 'learn'`
  ).all();
  const all = [];
  for (const c of rows) {
    let sm = {};
    if (c.source_meta) { try { sm = JSON.parse(c.source_meta) || {}; } catch { sm = {}; } }
    const d = { source_meta: sm, content_origin: c.content_origin || undefined, difficulty: c.d_difficulty || undefined };
    const facets = cardFacets(d, { ...c, updated_at: c.content_updated_at || c.updated_at });
    // Pre-lowercase the searchable stem once instead of rebuilding and
    // lowercasing it for every card on every keystroke.
    // Normalised once (ی/ک/ه, digits, ZWNJ, diacritics) so every keystroke is
    // a plain indexOf over pre-cleaned text; `extra` = weaker fields.
    const hay = normalizeText(`${c.public_code || ""} ${c.q_fa || ""} ${c.q_en || ""} ${c.title_fa || ""} ${c.title_en || ""}`);
    const extra = normalizeText(`${sm.chapter_fa || ""} ${sm.chapter_en || ""} ${sm.concept_fa || ""} ${sm.concept_en || ""} ${c.opts_text || ""}`);
    const data = { q_fa: c.q_fa || "", q_en: c.q_en || "", title_fa: c.title_fa || "", title_en: c.title_en || "", topic: c.topic || "" };
    all.push({ id: c.id, public_code: c.public_code, facets, premium: c.premium === 1 || c.premium === true || c.premium === "true", data, hay, extra });
  }
  browsePoolCache = { sig, all };
  return all;
}

/* The three premium cards a non-subscriber is allowed to preview. Computed
 * from the global newest-exam ordering so the list page and the detail route
 * agree no matter which filters the learner applied. */
export function lockedTeaserIds(pool = browsePool()) {
  // Round 5: there is no premium question tier any more — every path
  // question is free to LEARN on the path. Browsing/searching the whole bank
  // is the premium perk, so non-subscribers preview the three newest cards.
  return sortCards(pool.filter((c) => !c.facets.demo), "newest_exam")
    .slice(0, 3).map((c) => c.id);
}

/* R96: the signature of the pool returned by the last browsePool() call (the facet memo key). */
export function browsePoolSignature() { browsePool(); return browsePoolCache.sig; }
