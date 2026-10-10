// Validate author-supplied chart structure before a patient or version is written.
// Sparse drafts remain supported; an unknown age is null, never an invented zero.
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = v => typeof v === 'string' && v.trim().length > 0;
export function validateCase(data) {
  if (!object(data)) return 'case';
  if (![data.title_fa, data.title_en].some(text)) return 'title';
  if (data.age != null && data.age !== '') {
    if (!['number', 'string'].includes(typeof data.age) || !String(data.age).trim() || !Number.isFinite(Number(data.age)) || Number(data.age) < 0 || Number(data.age) > 150) return 'age';
  }
  for (const [key, value] of Object.entries(data)) {
    if ((key.endsWith('_fa') || key.endsWith('_en')) && value != null && typeof value !== 'string') return key;
  }
  if (data.vitals != null && (!object(data.vitals) || Object.values(data.vitals).some(v => v != null && !['string','number'].includes(typeof v)))) return 'vitals';
  for (const key of ['labResults', 'imagingResults', 'paraclinicResults', 'images']) {
    const rows = data[key];
    if (rows == null) continue;
    if (!Array.isArray(rows)) return key;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i], path = `${key}[${i}]`;
      if (!object(row)) return path;
      if (row.aliases != null && (!Array.isArray(row.aliases) || row.aliases.some(x => typeof x !== 'string'))) return `${path}.aliases`;
      for (const field of ['name_fa','name_en','result_fa','result_en','label_fa','label_en','imageUrl','url']) {
        if (row[field] != null && typeof row[field] !== 'string') return `${path}.${field}`;
      }
    }
  }
  return null;
}
export function normalizeCaseAge(data) {
  if (Object.hasOwn(data, 'age')) data.age = data.age == null || data.age === '' ? null : Number(data.age);
  return data;
}
