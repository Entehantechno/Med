/* crowd.js — Crowd difficulty analysis (Duolingo Birdbrain style).
   Difficulty is LEARNED from real answer data in question_stats, not a fixed
   label. Powers: a per-card crowd badge, and a "hardest questions" insights
   view so learners can drill the questions most people miss. NO AI. */
import { db } from "../db.js";
import { serializeCard } from "./cardserialize.js";
import { difficultyLabel } from "./analytics.js";
import { emojiForTopic } from "./topicemoji.js";

// crowd difficulty for a single card (or null if never seen)
export function crowdForCard(cardId) {
  const st = db.prepare("SELECT * FROM question_stats WHERE card_id=?").get(cardId);
  if (!st || !st.seen) return null;
  const { key, pct } = difficultyLabel(st.seen, st.correct);
  const avgSec = st.seen ? Math.round((st.total_ms / st.seen) / 100) / 10 : 0;
  return { seen: st.seen, passRate: pct, key, avgSec };
}

// attach crowd difficulty to a batch of serialized cards (mutates copies)
export function withCrowd(cards) {
  return cards.map((c) => ({ ...c, crowd: crowdForCard(c.id) }));
}

/* The hardest questions overall (lowest pass rate), min sample size so a single
   wrong answer doesn't dominate. Grouped with their topic for context. */
export function hardestQuestions(lang = "fa", { minSeen = 3, limit = 20, program = null } = {}) {
  // when a program is given, only include cards used by that program's lessons
  let programCardIds = null;
  if (program) {
    programCardIds = new Set();
    const nodes = db.prepare(`SELECT pn.card_ids FROM path_nodes pn JOIN topics t ON t.id=pn.topic_id
      WHERE pn.active=1 AND t.active=1 AND t.program=?`).all(program);
    for (const n of nodes) { try { JSON.parse(n.card_ids || "[]").forEach((id) => programCardIds.add(id)); } catch { /* */ } }
  }
  let rows = db.prepare(`
    SELECT qs.card_id, qs.seen, qs.correct, qs.total_ms, f.data_json, f.difficulty
    FROM question_stats qs
    JOIN flashcards f ON f.id = qs.card_id
    WHERE qs.seen >= ? AND f.active = 1
    ORDER BY (CAST(qs.correct AS REAL)/qs.seen) ASC, qs.seen DESC`).all(minSeen);
  if (programCardIds) rows = rows.filter((r) => programCardIds.has(r.card_id));
  rows = rows.slice(0, limit);

  // topic lookup per card (via any path_node that references it)
  const topicOfCard = (cardId) => {
    const nodes = db.prepare("SELECT topic_id, card_ids FROM path_nodes").all();
    for (const n of nodes) {
      let ids = []; try { ids = JSON.parse(n.card_ids || "[]"); } catch { /* */ }
      if (ids.includes(cardId)) {
        const t = db.prepare("SELECT slug, name_fa, name_en, emoji FROM topics WHERE id=?").get(n.topic_id);
        if (t) return { title: lang === "fa" ? (t.name_fa || t.name_en) : (t.name_en || t.name_fa), emoji: t.emoji || emojiForTopic(t.slug) };
      }
    }
    return null;
  };

  return rows.map((r) => {
    const card = serializeCard({ id: r.card_id, data_json: r.data_json, difficulty: r.difficulty }, lang);
    const { key, pct } = difficultyLabel(r.seen, r.correct);
    return {
      id: r.card_id, q: card.q, type: card.type,
      passRate: pct, key, seen: r.seen,
      avgSec: r.seen ? Math.round((r.total_ms / r.seen) / 100) / 10 : 0,
      topic: topicOfCard(r.card_id),
    };
  });
}

// overall crowd stats summary for the insights header
export function crowdSummary() {
  const agg = db.prepare("SELECT COUNT(*) cards, SUM(seen) answers FROM question_stats WHERE seen>0").get();
  const dist = db.prepare("SELECT seen, correct FROM question_stats WHERE seen>=3").all();
  const buckets = { easy: 0, medium: 0, hard: 0, brutal: 0 };
  for (const d of dist) { const { key } = difficultyLabel(d.seen, d.correct); if (buckets[key] != null) buckets[key]++; }
  return { ratedCards: agg?.cards || 0, totalAnswers: agg?.answers || 0, buckets };
}
