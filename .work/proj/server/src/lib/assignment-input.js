// Validate the entire replacement before deactivating any existing grant.
// The 400-entry limit matches sqlInList; never silently truncate a replacement.
function positiveInteger(value) {
  if (typeof value === 'string') {
    if (!/^[0-9]+$/.test(value.trim())) return null;
    value = Number(value.trim());
  }
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function assignmentInput(body, { requireCaseIds = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'invalid_assignment_payload' };
  const ids = body.caseIds === undefined && !requireCaseIds ? [] : body.caseIds;
  if (!Array.isArray(ids) || ids.length > 400) return { error: 'invalid_case_ids', field: 'caseIds' };
  const caseIds = ids.map(positiveInteger);
  if (caseIds.some(id => id === null)) return { error: 'invalid_case_ids', field: 'caseIds' };
  const maxAttempts = positiveInteger(body.maxAttempts === undefined ? 1 : body.maxAttempts);
  if (maxAttempts === null) return { error: 'invalid_max_attempts', field: 'maxAttempts' };
  return { caseIds, maxAttempts };
}
