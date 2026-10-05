/* mastery.js — Topic Mastery Badges (Bloom's Mastery Learning + durable memory).

   Research basis (see گزارش/ریسرچ docs):
   • Bloom's Mastery Learning (1968, 50+ yrs of evidence): a learner should reach
     a HIGH fixed criterion (classically ≥90% accuracy) on a topic before it is
     considered "mastered" — time varies, the standard stays fixed.
   • Durable memory: a single high quiz score can be a cram. We additionally
     require that a share of the topic's cards be SRS-"mature" (high stability),
     proving the knowledge survives the forgetting curve (FSRS desired-retention
     philosophy). This makes the badge MEAN something, not a sticker.

   Everything here is deterministic & AI-free. All thresholds are admin-tunable
   via getGameConfig().mastery, and the whole feature is gated by the `mastery`
   feature flag at the route layer. */
import { db, persistNow } from "../db.js";
import { getGameConfig } from "./gameconfig.js";
import { awardXp } from "./gamify.js";

function cfg() {
  return { ...(getGameConfig().mastery || {}) };
}

/* All flashcard ids that belong to a topic (across every active lesson node). */
function topicCardIds(topicId) {
  const rows = db.prepare("SELECT card_ids FROM path_nodes WHERE topic_id=? AND active=1").all(topicId);
  const ids = new Set();
  for (const r of rows) {
    try { JSON.parse(r.card_ids || "[]").forEach((id) => ids.add(id)); } catch { /* */ }
  }
  return [...ids];
}

/* Compute a learner's mastery status for ONE topic (no side-effects). */
export function topicMastery(userId, topicId) {
  const c = cfg();
  const cardIds = topicCardIds(topicId);
  if (cardIds.length === 0) {
    return { topicId, total: 0, seen: 0, accuracy: 0, matureRatio: 0, mastered: false, eligible: false };
  }
  const ph = cardIds.map(() => "?").join(",");

  // Accuracy is measured per-card on its MOST RECENT answer, so re-learning a
  // previously-missed card counts fairly (you're judged on where you are now).
  const attempts = db.prepare(`
    SELECT card_id, correct, created_at FROM card_attempts
    WHERE user_id=? AND card_id IN (${ph})
    ORDER BY created_at ASC`).all(userId, ...cardIds);
  const latest = new Map();  // card_id -> last correctness
  for (const a of attempts) latest.set(a.card_id, a.correct);
  const seen = latest.size;
  const correct = [...latest.values()].filter((x) => x === 1).length;
  const accuracy = seen ? Math.round((correct / seen) * 100) : 0;

  // Durable memory: how many of the topic's SEEN cards are SRS-"mature".
  let matureRatio = 0;
  if (seen > 0) {
    const mature = db.prepare(`
      SELECT COUNT(*) n FROM srs_state
      WHERE user_id=? AND card_id IN (${ph}) AND stability >= ?`)
      .get(userId, ...cardIds, c.mature_days ?? 21).n;
    matureRatio = Math.round((mature / seen) * 100);
  }

  const accOk = accuracy >= (c.accuracy ?? 90);
  const enoughAnswers = seen >= (c.min_answers ?? 12);
  const retentionOk = !c.require_retention || matureRatio >= Math.round((c.mature_ratio ?? 0.6) * 100);
  const mastered = accOk && enoughAnswers && retentionOk;

  return {
    topicId,
    total: cardIds.length,
    seen,
    accuracy,
    matureRatio,
    // progress toward the criteria (for a nice progress UI even before mastery)
    needAccuracy: c.accuracy ?? 90,
    needAnswers: c.min_answers ?? 12,
    needMatureRatio: c.require_retention ? Math.round((c.mature_ratio ?? 0.6) * 100) : 0,
    mastered,
    eligible: enoughAnswers,   // has attempted enough to be a candidate
  };
}

/* Grant (idempotently) a mastery badge + one-time reward when newly earned.
   Returns the badge row if this call is the one that awarded it, else null. */
export function grantMasteryIfEarned(userId, topicId) {
  const c = cfg();
  if (c.enabled === false) return null;
  const already = db.prepare("SELECT id FROM mastery_badges WHERE user_id=? AND topic_id=?").get(userId, topicId);
  if (already) return null;
  const m = topicMastery(userId, topicId);
  if (!m.mastered) return null;

  db.prepare("INSERT OR IGNORE INTO mastery_badges (user_id, topic_id, accuracy, mature_ratio) VALUES (?,?,?,?)")
    .run(userId, topicId, m.accuracy, m.matureRatio);
  if (c.reward_xp) { try { awardXp(userId, c.reward_xp, "mastery", null); } catch { /* */ } }
  if (c.reward_gems) db.prepare("UPDATE learner_profiles SET gems=gems+? WHERE user_id=?").run(c.reward_gems, userId);
  persistNow();
  const topic = db.prepare("SELECT name_fa, name_en FROM topics WHERE id=?").get(topicId);
  return {
    topicId, accuracy: m.accuracy, matureRatio: m.matureRatio,
    name_fa: topic?.name_fa || "", name_en: topic?.name_en || "",
    reward_gems: c.reward_gems || 0, reward_xp: c.reward_xp || 0,
  };
}

/* After a lesson/checkpoint, check every topic that the answered cards touched
   and grant any newly-earned mastery badges. Returns the list of new badges. */
export function checkMasteryForCards(userId, cardIds = []) {
  if (cfg().enabled === false || !cardIds.length) return [];
  const ph = cardIds.map(() => "?").join(",");
  const topicRows = db.prepare(`
    SELECT DISTINCT pn.topic_id FROM path_nodes pn
    WHERE pn.active=1 AND (${cardIds.map(() => "pn.card_ids LIKE ?").join(" OR ")})`)
    .all(...cardIds.map((id) => `%${id}%`));
  // The LIKE prefilter is loose; confirm membership precisely per topic.
  const earned = [];
  const seenTopics = new Set();
  for (const r of topicRows) {
    if (!r.topic_id || seenTopics.has(r.topic_id)) continue;
    seenTopics.add(r.topic_id);
    // precise membership: does this topic actually contain one of the cardIds?
    const topicCards = new Set(topicCardIds(r.topic_id));
    if (!cardIds.some((id) => topicCards.has(id))) continue;
    const badge = grantMasteryIfEarned(userId, r.topic_id);
    if (badge) earned.push(badge);
  }
  return earned;
  // (ph is unused but kept for clarity of the prefilter intent)
}

/* The learner's mastery dashboard: every topic in the active program with its
   mastery status (earned or progress-toward). Powers the "Mastery" page. */
export function masteryOverview(userId, program, lang = "fa") {
  const topics = db.prepare(`
    SELECT DISTINCT t.id, t.name_fa, t.name_en, t.icon, t.color, t.ord
    FROM topics t JOIN path_nodes pn ON pn.topic_id = t.id
    WHERE t.active=1 AND pn.active=1
    ORDER BY t.ord ASC, t.id ASC`).all();
  const badges = new Map(
    db.prepare("SELECT topic_id, accuracy, mature_ratio, earned_at FROM mastery_badges WHERE user_id=?")
      .all(userId).map((b) => [b.topic_id, b]));
  const items = topics.map((t) => {
    const m = topicMastery(userId, t.id);
    const badge = badges.get(t.id);
    return {
      topicId: t.id,
      name: lang === "fa" ? (t.name_fa || t.name_en) : (t.name_en || t.name_fa),
      icon: t.icon, color: t.color,
      total: m.total, seen: m.seen, accuracy: m.accuracy, matureRatio: m.matureRatio,
      needAccuracy: m.needAccuracy, needAnswers: m.needAnswers, needMatureRatio: m.needMatureRatio,
      mastered: !!badge || m.mastered,
      earnedAt: badge?.earned_at || null,
    };
  });
  const masteredCount = items.filter((x) => x.mastered).length;
  return { total: items.length, mastered: masteredCount, topics: items };
}
