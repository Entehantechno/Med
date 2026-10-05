/* Record a research event only when a live study is actually linked.
   Classes/exams without study_id never write here. */
import { db, persistNow } from "../db.js";

const EVENT_TYPES = new Set([
  "consent_viewed", "consent_granted", "consent_withdrawn",
  "session_started", "session_finished", "case_opened",
  "feedback_submitted", "questionnaire_submitted",
  "note", "custom", "flashcard_finished",
]);

export function recordStudyEvent({ studyId, userId, eventType, contextType, contextId, data }) {
  const sid = Number(studyId) || 0;
  if (!sid) return false;
  const st = db.prepare("SELECT id, active FROM research_studies WHERE id=?").get(sid);
  if (!st || !st.active) return false;
  const kind = EVENT_TYPES.has(String(eventType || "")) ? String(eventType) : "custom";
  const ctx = ["general", "class", "exam", "case", "study"].includes(contextType) ? contextType : "study";
  let dataJson = "{}";
  try { dataJson = JSON.stringify(data && typeof data === "object" ? data : {}); } catch { dataJson = "{}"; }
  db.prepare(`INSERT INTO research_events
    (study_id,user_id,event_type,context_type,context_id,data_json) VALUES (?,?,?,?,?,?)`)
    .run(sid, Number(userId) || null, kind, ctx, Number(contextId) || null, dataJson);
  persistNow();
  return true;
}

export function studyIdForClass(classId) {
  if (!classId) return null;
  return db.prepare("SELECT study_id FROM classes WHERE id=?").get(Number(classId))?.study_id || null;
}
export function studyIdForExam(examId) {
  if (!examId) return null;
  return db.prepare("SELECT study_id FROM exams WHERE id=?").get(Number(examId))?.study_id || null;
}
