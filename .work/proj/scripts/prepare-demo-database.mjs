#!/usr/bin/env node
// Reproducible, opt-in DEMO build. Never replace an existing database.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv.includes('--confirm-demo') || !process.env.DATA_DIR ||
    !['development', 'test'].includes(process.env.NODE_ENV)) {
  throw new Error('Set NODE_ENV=development and DATA_DIR to a fresh demo directory; pass --confirm-demo.');
}
const dataDir = path.resolve(process.env.DATA_DIR);
const dbFile = path.join(dataDir, 'medlab.db');
if (fs.existsSync(dbFile)) throw new Error('Refusing to replace an existing medlab.db. Choose a fresh DATA_DIR.');
process.env.DATA_DIR = dataDir;
process.env.DB_FILE = 'medlab.db'; // never inherit an absolute production DB_FILE
const banks = path.join(root, 'tools', 'master-bank');
const files = fs.readdirSync(banks).filter(f => /^import-payload\.master-(preint|residency)\.part\d+\.json$/.test(f)).sort();
const expected = files.reduce((n, f) => n + JSON.parse(fs.readFileSync(path.join(banks, f))).questions.length, 0);
if (files.length !== 54 || expected !== 11604) throw new Error(`Incomplete bank: ${files.length} files / ${expected} records`);
// --force is safe here only because the target DB did not exist above. initDb
// auto-seeds a few rows before seed.js's guard, so an explicit reset is needed.
execFileSync(process.execPath, ['server/src/seed.js', '--force'], { cwd: root, stdio: 'inherit', env: process.env });
execFileSync(process.execPath, ['server/src/restore-demo-accounts.js', '--confirm-demo'], { cwd: root, stdio: 'inherit', env: process.env });
const { initDb, initSchema, db, persistNow } = await import('../server/src/db.js');
await initDb(); initSchema();
const { commitOfficialImport } = await import('../server/src/routes/admin.js');
let inserted = 0;
for (const file of files) {
  const body = JSON.parse(fs.readFileSync(path.join(banks, file)));
  // Two intra-payload source records share the importer's normalized prefix.
  // Keep them with the EXISTING premium-duplicate mode, not by disabling the
  // application's normal deduplication or modifying the educational payloads.
  const result = commitOfficialImport({ ...body, duplicates: 'premium' }, null);
  if (result.counters.errors || result.inserted !== body.questions.length) {
    throw new Error(`Incomplete import of ${file}: ${JSON.stringify(result)}`);
  }
  inserted += result.inserted;
}
const { curateOfficialPath } = await import('../server/src/lib/pathcurator.js');
const curation = curateOfficialPath({ force: true });
const rows = db.prepare('SELECT data_json FROM flashcards').all()
  .map(r => JSON.parse(r.data_json)).filter(d => d.source_meta?.kind === 'past_exam_import');
if (inserted !== expected || rows.length !== expected) throw new Error(`Bank count mismatch: ${inserted}/${rows.length}/${expected}`);
// Verify every source record, including both near-duplicate pairs, not just a count.
const key = (fa, en, no) => JSON.stringify([fa || '', en || '', String(no || '')]);
const counts = new Map();
for (const d of rows) {
  const k = key(d.q_fa, d.q_en, d.source_meta.question_no);
  counts.set(k, (counts.get(k) || 0) + 1);
}
for (const file of files) {
  for (const q of JSON.parse(fs.readFileSync(path.join(banks, file))).questions) {
    const k = key(q.question_fa, q.question_en, q.question_no);
    if (!counts.get(k)) throw new Error(`Missing source record: ${file}:${q.question_no}`);
    counts.set(k, counts.get(k) - 1);
  }
}
const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
if (integrity !== 'ok') throw new Error(integrity);
persistNow({ throwOnError: true });
console.log(JSON.stringify({ files: files.length, sourceRecords: expected, databaseRecords: rows.length,
  activeCases: db.prepare('SELECT COUNT(*) n FROM cases WHERE active=1').get().n,
  integrity, curation }, null, 2));
