#!/usr/bin/env node
import fs from 'node:fs';

const input = process.argv[2];
const output = process.argv[3] || 'past-exam-import.json';
if (!input) {
  console.error('Usage: node tools/convert-past-exam-csv-to-import-json.mjs input.csv output.json');
  process.exit(2);
}

function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i + 1];
    if (q && ch === '"' && nx === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { q = !q; continue; }
    if (!q && ch === ',') { row.push(cur); cur = ''; continue; }
    if (!q && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && nx === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => String(x).trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }
  row.push(cur);
  if (row.some((x) => String(x).trim() !== '')) rows.push(row);
  return rows;
}
const text = fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, '');
const rows = parseCsv(text);
const headers = rows.shift().map((h) => h.trim());
const objRows = rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])));
const questions = objRows.filter((r) => r.question_fa || r.question_en).map((r) => ({
  year: r.year,
  exam_type: r.exam_type,
  subject_fa: r.subject_fa,
  subject_en: r.subject_en,
  chapter_fa: r.chapter_fa,
  chapter_en: r.chapter_en,
  question_no: r.question_no,
  question_fa: r.question_fa,
  question_en: r.question_en,
  options_fa: [r.option1_fa, r.option2_fa, r.option3_fa, r.option4_fa].filter(Boolean),
  options_en: [r.option1_en, r.option2_en, r.option3_en, r.option4_en].filter(Boolean),
  correct_index: Number(r.correct_index || 0),
  explanation_fa: r.explanation_fa,
  explanation_en: r.explanation_en,
  hints_fa: [r.hint1_fa, r.hint2_fa].filter(Boolean),
  hints_en: [r.hint1_en, r.hint2_en].filter(Boolean),
  difficulty: r.difficulty || 'medium',
  source: r.source,
  source_url: r.source_url,
  license: r.license || 'public_past_exam_review_required',
  route_preference: r.route_preference || 'auto',
}));
const bundle = {
  program: 'preint',
  exam_type: objRows[0]?.exam_type || 'past_exam',
  year: objRows[0]?.year || '',
  source: objRows[0]?.source || '',
  source_url: objRows[0]?.source_url || '',
  license: objRows[0]?.license || 'public_past_exam_review_required',
  maxPerLesson: 15,
  overflowToPremium: true,
  questions,
};
fs.writeFileSync(output, JSON.stringify(bundle, null, 2));
console.log(`Wrote ${questions.length} questions to ${output}`);
