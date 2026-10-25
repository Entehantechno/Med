import { db } from "../db.js";

/** Competitive vs university content. Missing/`uni` track = university. */
export function contentTrack(dataJson) {
  try {
    const d = typeof dataJson === "string" ? JSON.parse(dataJson) : (dataJson || {});
    return d.track === "learn" ? "learn" : "university";
  } catch {
    return "university";
  }
}

export function isLearnContent(dataJson) {
  return contentTrack(dataJson) === "learn";
}

export function caseIsLearn(caseId) {
  const row = db.prepare("SELECT data_json FROM cases WHERE id=?").get(caseId);
  if (!row) return false;
  return isLearnContent(row.data_json);
}

export function flashIsLearn(cardId) {
  const row = db.prepare("SELECT data_json FROM flashcards WHERE id=?").get(cardId);
  if (!row) return false;
  return isLearnContent(row.data_json);
}
