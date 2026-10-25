/* community.js — Community Decks (AnkiHub-style shared, moderated, votable cards).
   A learner shares one of their own cards → it enters moderation (pending) →
   admin approves → it becomes visible to everyone, votable, and importable into
   each learner's personal SRS. The best cards float up by net votes.
   NO AI — this is a social / network-effect feature. */
import { db, persistNow } from "../db.js";
import { serializeCard } from "./cardserialize.js";
import { ensureTracked } from "./srs.js";

const nameOf = (uid, lang) => {
  const u = db.prepare("SELECT name_fa, name_en FROM users WHERE id=?").get(uid);
  return !u ? "" : (lang === "fa" ? (u.name_fa || u.name_en) : (u.name_en || u.name_fa));
};

// share a flashcard the learner owns into the community (idempotent per card)
export function shareCard(userId, flashcardId, topicId) {
  const card = db.prepare("SELECT * FROM flashcards WHERE id=? AND active=1").get(flashcardId);
  if (!card) return { error: "card not found" };
  let d = {}; try { d = JSON.parse(card.data_json); } catch { /* */ }
  if (d.owner && d.owner !== userId) return { error: "not your card" };
  const existing = db.prepare("SELECT * FROM community_cards WHERE flashcard_id=?").get(flashcardId);
  if (existing) return { id: existing.id, status: existing.status, already: true };
  const info = db.prepare(
    "INSERT INTO community_cards (flashcard_id, author_id, topic_id, status) VALUES (?,?,?, 'pending')"
  ).run(flashcardId, userId, topicId || null);
  persistNow();
  return { id: info.lastInsertRowid, status: "pending" };
}

// public browse: approved cards, optional topic filter, sorted by score then recency
export function browseCommunity(userId, { topicId = null, lang = "fa", sort = "top", limit = 50 } = {}) {
  const order = sort === "new" ? "cc.created_at DESC" : "cc.score DESC, cc.imports DESC, cc.created_at DESC";
  const rows = topicId
    ? db.prepare(`SELECT cc.*, f.data_json, f.difficulty FROM community_cards cc
        JOIN flashcards f ON f.id=cc.flashcard_id
        WHERE cc.status='approved' AND cc.topic_id=? AND f.active=1 ORDER BY ${order} LIMIT ?`).all(topicId, limit)
    : db.prepare(`SELECT cc.*, f.data_json, f.difficulty FROM community_cards cc
        JOIN flashcards f ON f.id=cc.flashcard_id
        WHERE cc.status='approved' AND f.active=1 ORDER BY ${order} LIMIT ?`).all(limit);
  return rows.map((r) => {
    const myVote = db.prepare("SELECT value FROM community_votes WHERE community_id=? AND user_id=?").get(r.id, userId);
    const mine = db.prepare("SELECT id FROM community_imports WHERE community_id=? AND user_id=?").get(r.id, userId);
    const card = serializeCard({ id: r.flashcard_id, data_json: r.data_json, difficulty: r.difficulty }, lang);
    return {
      id: r.id, card, score: r.score, imports: r.imports,
      author: nameOf(r.author_id, lang), mine: r.author_id === userId,
      myVote: myVote?.value || 0, imported: !!mine,
      topic_id: r.topic_id, created_at: r.created_at,
    };
  });
}

// up/down vote (+1 / -1). Re-voting the same way removes the vote (toggle).
export function voteCommunity(userId, communityId, value) {
  const cc = db.prepare("SELECT * FROM community_cards WHERE id=? AND status='approved'").get(communityId);
  if (!cc) return { error: "not found" };
  const v = value > 0 ? 1 : -1;
  const existing = db.prepare("SELECT * FROM community_votes WHERE community_id=? AND user_id=?").get(communityId, userId);
  if (existing) {
    if (existing.value === v) db.prepare("DELETE FROM community_votes WHERE id=?").run(existing.id); // toggle off
    else db.prepare("UPDATE community_votes SET value=? WHERE id=?").run(v, existing.id);
  } else {
    db.prepare("INSERT INTO community_votes (community_id, user_id, value) VALUES (?,?,?)").run(communityId, userId, v);
  }
  const score = db.prepare("SELECT COALESCE(SUM(value),0) s FROM community_votes WHERE community_id=?").get(communityId).s;
  db.prepare("UPDATE community_cards SET score=? WHERE id=?").run(score, communityId);
  persistNow();
  const myVote = db.prepare("SELECT value FROM community_votes WHERE community_id=? AND user_id=?").get(communityId, userId);
  return { score, myVote: myVote?.value || 0 };
}

// import an approved community card into the learner's own SRS (clones nothing —
// SRS just starts tracking the shared flashcard for this user).
export function importCommunity(userId, communityId) {
  const cc = db.prepare("SELECT * FROM community_cards WHERE id=? AND status='approved'").get(communityId);
  if (!cc) return { error: "not found" };
  const existing = db.prepare("SELECT id FROM community_imports WHERE community_id=? AND user_id=?").get(communityId, userId);
  if (existing) return { already: true };
  db.prepare("INSERT INTO community_imports (community_id, user_id, flashcard_id) VALUES (?,?,?)")
    .run(communityId, userId, cc.flashcard_id);
  db.prepare("UPDATE community_cards SET imports=imports+1 WHERE id=?").run(communityId);
  ensureTracked(userId, cc.flashcard_id);
  persistNow();
  return { ok: true };
}

/* ---------------- ADMIN moderation ---------------- */
export function moderationQueue(lang = "fa") {
  const rows = db.prepare(`SELECT cc.*, f.data_json, f.difficulty FROM community_cards cc
    JOIN flashcards f ON f.id=cc.flashcard_id
    WHERE cc.status='pending' ORDER BY cc.created_at ASC`).all();
  return rows.map((r) => ({
    id: r.id, author: nameOf(r.author_id, lang), topic_id: r.topic_id, created_at: r.created_at,
    card: serializeCard({ id: r.flashcard_id, data_json: r.data_json, difficulty: r.difficulty }, lang),
  }));
}
export function moderate(communityId, action) {
  const cc = db.prepare("SELECT id FROM community_cards WHERE id=?").get(communityId);
  if (!cc) return { error: "not found" };
  const status = action === "approve" ? "approved" : "rejected";
  db.prepare("UPDATE community_cards SET status=?, reviewed_at=datetime('now') WHERE id=?").run(status, communityId);
  persistNow();
  return { ok: true, status };
}
export function communityStats() {
  const q = (s) => db.prepare("SELECT COUNT(*) c FROM community_cards WHERE status=?").get(s).c;
  return { pending: q("pending"), approved: q("approved"), rejected: q("rejected") };
}
