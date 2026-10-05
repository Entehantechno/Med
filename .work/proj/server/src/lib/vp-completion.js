// Process-local mutual exclusion: separate students never share a lock.
// sql.js deployments must use one writer process per DATA_DIR.
const active = new Set();
const key = (userId, caseId) => `${Number(userId)}:${Number(caseId)}`;
export function completionBusy(userId, caseId) { return active.has(key(userId, caseId)); }
export function acquireCompletion(userId, caseId) {
  const k = key(userId, caseId);
  if (active.has(k)) return null;
  active.add(k);
  return () => active.delete(k);
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
