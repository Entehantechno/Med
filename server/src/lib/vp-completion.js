// Process-local mutual exclusion, one lock per encounter (R101).
//
// The lock is held while an encounter is being evaluated, and that can take as long as the
// AI provider takes to answer, or fail. It used to be keyed by student and case, so a
// pending encounter's grading blocked the student's NEW encounter on the same case: its
// saves and its leave were refused for as long as the AI was slow or down. Keying by
// encounter keeps the protection (one evaluation of one encounter at a time) and removes
// that restriction. Encounters without a session keep the old student-and-case key.
const active = new Set();

export const completionKey = ({ sessionId = null, userId, caseId }) =>
  sessionId ? `s:${Number(sessionId)}` : `c:${Number(userId)}:${Number(caseId)}`;

export function completionBusy(key) { return active.has(key); }

export function acquireCompletion(key) {
  if (active.has(key)) return null;
  active.add(key);
  return () => active.delete(key);
}

export function publicEvaluation(result, role, showAi, showMicro) {
  const out = JSON.parse(JSON.stringify(result));
  out.showAi = !!showAi; out.showMicro = !!showMicro;
  if (!showAi) {
    out.strengths = []; out.weaknesses = []; out.missed = []; out.commonMistakes = [];
    out.suggestion = ''; out.results = [];
    out.orderReview = { appropriate: [], unnecessary: [], missedKey: [] };
    delete out.finalDxCorrect; delete out.sectionScores;
  }
  if (!showMicro) out.microlearning = '';
  if (role === 'student' || role === 'learner') {
    if (out.meta) delete out.meta.rubric;
    if (out.sectionScores) delete out.sectionScores.rubric;
  }
  return out;
}
