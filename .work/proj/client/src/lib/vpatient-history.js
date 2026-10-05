// Preserve the speaker and exam mode: the backend must distinguish a teacher's
// reported examination from the patient's own words. Orders are not speech.
export function spokenHistory(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter(m => m && ['student', 'patient', 'teacher'].includes(m.role)
      && typeof m.text === 'string' && m.text.trim())
    .map(m => ({ role: m.role, text: m.text.trim(), ...(m.mode === 'exam' ? { mode: 'exam' } : {}) }));
}
