/* cardhistory.js — record what changed on a question card, and expose the
 * change log as something you can filter like any other facet.
 *
 * Why this exists: `flashcards.updated_at` is touched by any write, including
 * the import that created the row, so it cannot answer "which questions were
 * actually edited last week?". We therefore keep three distinct moments:
 *
 *   created_at          the card entered the bank (never changes again)
 *   content_updated_at  the learner-visible content genuinely changed
 *   updated_at          any write at all (kept for backwards compatibility)
 *
 * plus a `revision` counter and a row-per-change table so an admin can open a
 * question and read its history, or ask "last modified questions in Neurology
 * → Headache" — the combined query the product needs.
 */
import { db, persistNow } from "../db.js";

/** Fields that change what the learner sees. Touching only `active` or an
 *  internal flag should not masquerade as a content edit. */
const CONTENT_FIELDS = [
  "q_fa", "q_en", "title_fa", "title_en", "questionText_fa", "questionText_en",
  "options", "answer", "accept_fa", "accept_en", "blank_fa", "blank_en",
  "pairs", "items_fa", "items_en", "features", "entityA_fa", "entityB_fa",
  "micro", "explain", "mnemonic", "hints_fa", "hints_en", "media", "image",
  "difficulty", "premium", "category", "topic", "type",
];

/** Deep-ish equality good enough for card payloads (JSON-shaped data only). */
function same(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== "object" || typeof b !== "object") return false;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

/** Which learner-visible fields differ between two card payloads. */
export function changedFields(before = {}, after = {}) {
  const out = [];
  for (const f of CONTENT_FIELDS) {
    if (!same(before?.[f], after?.[f])) out.push(f);
  }
  return out;
}

/** Resolve a display name for the actor.
 *  `req.user` comes from the JWT, which carries the id and role but not always
 *  a readable name, so fall back to the users table. */
function actorName(actor) {
  if (actor?.name) return actor.name;
  if (!actor?.id) return "";
  try {
    const u = db.prepare("SELECT name_fa, name_en, username FROM users WHERE id=?").get(actor.id);
    return u?.name_fa || u?.name_en || u?.username || "";
  } catch { return ""; }
}

/** Subject/chapter for the log row, so the log filters without joining. */
function provenance(data = {}) {
  const sm = data.source_meta || {};
  return { subject: sm.subject_fa || "", chapter: sm.chapter_fa || "" };
}

/**
 * Record a change and move the card's tracking columns forward.
 *
 * @param {object} o
 * @param {number} o.cardId
 * @param {string} o.action   created | edited | imported | activated | deactivated | deleted
 * @param {object} [o.before] previous data_json (omit for creates)
 * @param {object} [o.after]  new data_json
 * @param {object} [o.actor]  { id, name }
 * @param {string} [o.note]
 * @param {boolean} [o.contentChanged] force the content flag (import = true)
 * @returns {{revision:number, fields:string[]}}
 */
export function recordCardChange(o) {
  const { cardId, action, before, after, actor, note = "" } = o;
  const fields = action === "edited" ? changedFields(before, after) : [];
  const contentChanged = o.contentChanged != null
    ? !!o.contentChanged
    : (action === "created" || action === "imported" || fields.length > 0);

  const row = db.prepare("SELECT revision FROM flashcards WHERE id=?").get(cardId);
  const revision = (row?.revision || 0) + 1;
  const { subject, chapter } = provenance(after || before || {});

  db.prepare(
    `UPDATE flashcards
        SET revision=?,
            last_editor_id=?,
            last_action=?,
            updated_at=datetime('now'),
            content_updated_at=CASE WHEN ? THEN datetime('now') ELSE content_updated_at END,
            created_at=COALESCE(created_at, datetime('now'))
      WHERE id=?`
  ).run(revision, actor?.id ?? null, action, contentChanged ? 1 : 0, cardId);

  db.prepare(
    `INSERT INTO card_revisions (card_id,revision,action,fields,actor_id,actor_name,subject,chapter,note)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(cardId, revision, action, JSON.stringify(fields), actor?.id ?? null,
    actorName(actor), subject, chapter, note);

  return { revision, fields };
}

/** Bulk variant used by the importer: one statement pair per card, no N+1 reads. */
export function recordImport(cardIds, actor, note = "") {
  const upd = db.prepare(
    `UPDATE flashcards
        SET revision=COALESCE(revision,0)+1, last_editor_id=?, last_action='imported',
            updated_at=datetime('now'), content_updated_at=datetime('now'),
            created_at=COALESCE(created_at, datetime('now'))
      WHERE id=?`
  );
  const sel = db.prepare("SELECT revision, data_json FROM flashcards WHERE id=?");
  const ins = db.prepare(
    `INSERT INTO card_revisions (card_id,revision,action,fields,actor_id,actor_name,subject,chapter,note)
     VALUES (?,?,'imported','[]',?,?,?,?,?)`
  );
  const who = actorName(actor);
  // SQLite reuses row ids after deletes, so a newly imported card can inherit
  // the change log of a long-gone one. Anything already logged for an id we are
  // importing into belongs to that previous occupant, so clear it first.
  const del = db.prepare("DELETE FROM card_revisions WHERE card_id=?");
  const tx = db.transaction((ids) => {
    for (const id of ids) {
      del.run(id);
      upd.run(actor?.id ?? null, id);
      const r = sel.get(id);
      let d = {}; try { d = JSON.parse(r?.data_json || "{}"); } catch { /* */ }
      const { subject, chapter } = provenance(d);
      ins.run(id, r?.revision || 1, actor?.id ?? null, who, subject, chapter, note);
    }
  });
  tx(cardIds);
  persistNow();
}

/**
 * Read the change log, filtered the same way the card list is.
 * Supports the combined query the product asked for, e.g.
 *   { subject: "نورولوژی", chapter: "سردرد…", limit: 50 }
 */
export function listRevisions(filt = {}) {
  const where = [];
  const args = [];
  if (filt.cardId) { where.push("r.card_id=?"); args.push(filt.cardId); }
  if (filt.subject) { where.push("r.subject=?"); args.push(filt.subject); }
  if (filt.chapter) { where.push("r.chapter=?"); args.push(filt.chapter); }
  if (filt.action) { where.push("r.action=?"); args.push(filt.action); }
  if (filt.actorId) { where.push("r.actor_id=?"); args.push(filt.actorId); }
  if (filt.from) { where.push("date(r.created_at)>=date(?)"); args.push(filt.from); }
  if (filt.to) { where.push("date(r.created_at)<=date(?)"); args.push(filt.to); }
  const limit = Math.min(Math.max(parseInt(filt.limit, 10) || 100, 1), 500);
  const sql = `SELECT r.*, f.active
                 FROM card_revisions r
                 LEFT JOIN flashcards f ON f.id = r.card_id
                ${where.length ? "WHERE " + where.join(" AND ") : ""}
                ORDER BY r.created_at DESC, r.id DESC
                LIMIT ?`;
  return db.prepare(sql).all(...args, limit).map((r) => ({
    id: r.id,
    cardId: r.card_id,
    revision: r.revision,
    action: r.action,
    fields: (() => { try { return JSON.parse(r.fields || "[]"); } catch { return []; } })(),
    actorId: r.actor_id,
    actorName: r.actor_name || "",
    subject: r.subject || "",
    chapter: r.chapter || "",
    note: r.note || "",
    at: r.created_at,
    active: r.active,
  }));
}

/** Compact summary for the admin dashboard: activity per day and per subject. */
export function revisionSummary(days = 30) {
  const byDay = db.prepare(
    `SELECT date(created_at) AS day, COUNT(*) AS n
       FROM card_revisions
      WHERE date(created_at) >= date('now', ?)
      GROUP BY day ORDER BY day`
  ).all(`-${Math.max(1, Math.min(days, 365))} days`);
  const bySubject = db.prepare(
    `SELECT subject, chapter, COUNT(*) AS n, MAX(created_at) AS last_at
       FROM card_revisions
      WHERE subject <> '' AND date(created_at) >= date('now', ?)
      GROUP BY subject, chapter ORDER BY n DESC LIMIT 40`
  ).all(`-${Math.max(1, Math.min(days, 365))} days`);
  return { byDay, bySubject };
}
