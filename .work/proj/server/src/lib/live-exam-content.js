import { db } from "../db.js";

function parseIds(raw) {
  try { return JSON.parse(raw || "[]").map(Number).filter(Boolean); } catch { return []; }
}

function examStillLive(row, now) {
  const end = row.ends_at ? Date.parse(row.ends_at) : 0;
  if (end && Number.isFinite(end) && end < now) return false;
  return true;
}

function examIsOpen(row, now) {
  const start = row.starts_at ? Date.parse(row.starts_at) : 0;
  const end = row.ends_at ? Date.parse(row.ends_at) : 0;
  if (start && Number.isFinite(start) && start > now) return false;
  if (end && Number.isFinite(end) && end < now) return false;
  return true;
}

/** Case ids that belong to an active exam that has not ended yet. */
export function liveExamCaseIdSet() {
  const now = Date.now();
  const rows = db.prepare("SELECT case_ids, starts_at, ends_at FROM exams WHERE active=1").all();
  const ids = new Set();
  for (const r of rows) {
    if (!examStillLive(r, now)) continue;
    for (const id of parseIds(r.case_ids)) ids.add(id);
  }
  return ids;
}

export function caseInLiveExam(caseId) {
  return liveExamCaseIdSet().has(Number(caseId));
}

/** One scan of live flashcard exams + one participant IN-query.
 *  `reserved` = cards on a not-yet-ended exam deck (practice bank must hide them).
 *  `allowedReserved` = reserved cards on an OPEN exam this student is in. */
export function studentFlashcardAccess(userId) {
  const now = Date.now();
  const rows = db.prepare(
    "SELECT id, flashcard_ids, starts_at, ends_at FROM exams WHERE active=1 AND use_flashcards=1"
  ).all();
  const reserved = new Set();
  const openExamIds = [];
  const openCards = [];
  for (const r of rows) {
    if (!examStillLive(r, now)) continue;
    const ids = parseIds(r.flashcard_ids);
    if (!ids.length) continue;
    for (const id of ids) reserved.add(id);
    if (examIsOpen(r, now)) {
      openExamIds.push(r.id);
      openCards.push(ids);
    }
  }
  const allowedReserved = new Set();
  if (openExamIds.length && userId) {
    const ph = openExamIds.map(() => "?").join(",");
    const parts = db.prepare(
      `SELECT exam_id FROM exam_participants WHERE user_id=? AND exam_id IN (${ph})`
    ).all(userId, ...openExamIds);
    const mine = new Set(parts.map((p) => p.exam_id));
    openExamIds.forEach((eid, i) => {
      if (!mine.has(eid)) return;
      for (const id of openCards[i]) allowedReserved.add(id);
    });
  }
  return { reserved, allowedReserved };
}

export function studentMaySeeFlashcard(userId, cardId) {
  const { reserved, allowedReserved } = studentFlashcardAccess(userId);
  const cid = Number(cardId);
  if (!reserved.has(cid)) return true;
  return allowedReserved.has(cid);
}
