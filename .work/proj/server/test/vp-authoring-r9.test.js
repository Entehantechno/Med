import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import request from 'supertest';
import { initDb, db, persistNow, reloadDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { findRecordedResult, matchCaseImage, labImagingResult } from '../src/lib/ai-engine.js';

const ecg = { name_en: 'Electrocardiogram', result_en: 'ST elevation', aliases: ['ECG'] };
const ct = { name_en: 'CT chest', result_en: 'Pulmonary embolus', aliases: ['CT'] };
describe('R9 study matching', () => {
  it('prefers an exact CT alias over the letters ct inside electrocardiogram', () => {
    expect(findRecordedResult({ imagingResults: [ecg, ct] }, 'imaging', 'CT')).toEqual(ct);
  });
  it('does not treat CT as electrocardiogram if no CT was recorded', () => {
    expect(findRecordedResult({ imagingResults: [ecg] }, 'imaging', 'CT')).toBeNull();
  });
  it('prefers exact name over an earlier longer partial name', () => {
    const exact = { name_en: 'Troponin', result_en: '2.5' };
    expect(findRecordedResult({ labResults: [{ name_en: 'Troponin trend', result_en: 'old' }, exact] }, 'lab', 'Troponin')).toEqual(exact);
  });
  it('does not attach a chest X-ray merely because CT chest shares chest', () => {
    expect(matchCaseImage({ images: [{ label_en: 'Chest X-ray', url: '/wrong.png' }, { label_en: 'CT chest', url: '/right.png' }] }, ['CT chest'])).toBe('/right.png');
    expect(matchCaseImage({ images: [{ label_en: 'Chest X-ray', url: '/wrong.png' }] }, ['CT chest'])).toBeNull();
  });
  it('keeps bounded descriptive ECG labels and Persian labels usable', () => {
    expect(matchCaseImage({ images: [{ label_en: 'ECG — ST elevation', url: '/ecg.png' }] }, ['ECG'])).toBe('/ecg.png');
    const item = { name_fa: 'سی تی قفسه سینه', aliases: ['سی‌تی'], result_fa: 'ثبت شده' };
    expect(findRecordedResult({ imagingResults: [item] }, 'imaging', 'سی‌تی')).toEqual(item);
  });
  it('handles legacy malformed rows without crashing the order route', async () => {
    expect(findRecordedResult({ imagingResults: [null, { ...ct, aliases: 'CT, سی تی' }] }, 'imaging', 'CT')).toMatchObject({ result_en: ct.result_en });
    expect(findRecordedResult({ labResults: {} }, 'lab', 'CBC')).toBeNull();
    expect(matchCaseImage({ images: {} }, ['CT'])).toBeNull();
    const result = await labImagingResult({ caseData: { imagingResults: [ct] }, kind: 'imaging', query: 'CT', lang: 'en', prompts: {}, aiCfg: {} });
    expect(result.text).toContain('Pulmonary embolus');
  });
  it('asks for a specific study rather than selecting or normalizing an ambiguous order', async () => {
    const result = await labImagingResult({ caseData: { imagingResults: [{ name_en: 'CT chest', aliases: ['CT'] }, { name_en: 'CT abdomen', aliases: ['CT'] }] }, kind: 'imaging', query: 'CT', lang: 'en', prompts: {}, aiCfg: {} });
    expect(result.ambiguous).toBe(true);
    expect(result.text).not.toMatch(/normal|recorded$/i);
  });
});

let app, auth;
const valid = () => ({ title_fa: 'بیمار ممیزی', title_en: 'Audit patient', age: 43, sex: 'female', history_fa: 'شرح حال مستقل', history_en: 'Independent history', diagnosis_en: 'Pulmonary embolism', checklist_id: 1, imagingResults: [ct] });
beforeAll(async () => {
  execFileSync(process.execPath, ['src/seed.js', '--force'], { stdio: 'ignore' });
  await initDb(); app = createApp();
  const login = await request(app).post('/api/auth/login').send({ username: 'teacher', password: 'demo' });
  expect(login.status).toBe(200); auth = { Authorization: `Bearer ${login.body.token}` };
});
describe('R9 patient authoring validation and preservation', () => {
  it.each([
    ['empty title', { title_fa: ' ', title_en: ' ' }],
    ['invalid age', { age: 'not-a-number' }],
    ['negative age', { age: -1 }],
    ['boolean age', { age: false }],
    ['result object', { labResults: {} }],
    ['null result row', { imagingResults: [null] }],
    ['invalid aliases', { labResults: [{ name_en: 'CBC', aliases: {} }] }],
    ['image object', { images: {} }],
    ['missing checklist', { checklist_id: 999999 }],
  ])('rejects %s without persisting a patient', async (_label, patch) => {
    const count = db.prepare('SELECT COUNT(*) n FROM cases').get().n;
    const response = await request(app).post('/api/cases').set(auth).send({ ...valid(), ...patch });
    expect(response.status).toBe(422);
    expect(db.prepare('SELECT COUNT(*) n FROM cases').get().n).toBe(count);
  });
  it('allows one valid language, an actual newborn zero, and an omitted age without inventing zero', async () => {
    for (const age of [0, null]) {
      const response = await request(app).post('/api/cases').set(auth).send({ ...valid(), title_fa: ' ', age });
      expect(response.status).toBe(200);
      const saved = await request(app).get(`/api/cases/${response.body.id}`).set(auth);
      expect(saved.body.title_en).toBe('Audit patient'); expect(saved.body.age).toBe(age);
    }
  });
  it('preserves omitted bilingual chart fields on a partial update and across restart', async () => {
    const created = await request(app).post('/api/cases').set(auth).send(valid());
    expect(created.status).toBe(200);
    const id = created.body.id;
    const prior = db.prepare('SELECT public_code FROM cases WHERE id=?').get(id).public_code;
    expect((await request(app).put(`/api/cases/${id}`).set(auth).send({ title_en: 'Revised title' })).status).toBe(200);
    persistNow(); await reloadDb();
    const saved = await request(app).get(`/api/cases/${id}`).set(auth);
    expect(saved.body.history_fa).toBe(valid().history_fa);
    expect(saved.body.history_en).toBe(valid().history_en);
    expect(saved.body.imagingResults).toEqual([ct]);
    expect(saved.body.public_code).toBe(prior);
    expect(saved.body.title_en).toBe('Revised title');
    expect(saved.body.version).toBe(2);
    const before = db.prepare('SELECT * FROM cases WHERE id=?').get(id);
    expect((await request(app).put(`/api/cases/${id}`).set(auth).send({ labResults: [null] })).status).toBe(422);
    expect(db.prepare('SELECT * FROM cases WHERE id=?').get(id)).toEqual(before);
  });
});

describe('R9 rubric authorization', () => {
  it('does not let an author bind a hidden private checklist by guessing its id', async () => {
    const owner = db.prepare("SELECT id FROM users WHERE username='admin'").get().id;
    const id = db.prepare("INSERT INTO checklists (name_en,items_json,owner_id) VALUES ('Private R9','[]',?)").run(owner).lastInsertRowid;
    const listed = await request(app).get('/api/checklists').set(auth);
    expect(listed.body.map(c => c.id)).not.toContain(id);
    expect((await request(app).post('/api/cases').set(auth).send({ ...valid(), checklist_id: id })).status).toBe(403);
  });
  it('keeps the shipped rubric available for the first case of another university', async () => {
    const user = db.prepare("SELECT id,university_id FROM users WHERE username='teacher'").get();
    const uni = db.prepare("INSERT INTO universities (code,name_en) VALUES ('R9-NEW','R9 new university')").run().lastInsertRowid;
    db.prepare('UPDATE users SET university_id=? WHERE id=?').run(uni, user.id);
    try {
      const listed = await request(app).get('/api/checklists').set(auth);
      expect(listed.status).toBe(200);
      expect(listed.body.map(c => c.id)).toContain(1);
      const created = await request(app).post('/api/cases').set(auth).send(valid());
      expect(created.status).toBe(200);
      expect(db.prepare('SELECT university_id FROM cases WHERE id=?').get(created.body.id).university_id).toBe(uni);
    } finally { db.prepare('UPDATE users SET university_id=? WHERE id=?').run(user.university_id, user.id); }
  });
});

describe('R9 patient CSV creation', () => {
  it('rejects an invalid age in preview and import without partial writes', async () => {
    const csv = 'title_en,age\nValid,40\nInvalid,-1';
    const count = db.prepare('SELECT COUNT(*) n FROM cases').get().n;
    const preview = await request(app).post('/api/cases-import').set(auth).send({ csv, dryRun:true });
    expect(preview.status).toBe(200); expect(preview.body.valid).toBe(false);
    expect((await request(app).post('/api/cases-import').set(auth).send({ csv })).status).toBe(400);
    expect(db.prepare('SELECT COUNT(*) n FROM cases').get().n).toBe(count);
  });
  it('preserves unknown age as null, newborn zero, and a valid English title with blank Persian', async () => {
    const csv = 'title_fa,title_en,age\n ,R9 CSV unknown,\n,R9 CSV newborn,0';
    const imported = await request(app).post('/api/cases-import').set(auth).send({ csv });
    expect(imported.status).toBe(200); expect(imported.body.imported).toBe(2);
    const patients = db.prepare('SELECT data_json FROM cases ORDER BY id DESC LIMIT 2').all().map(r=>JSON.parse(r.data_json));
    expect(patients.map(p=>p.age)).toEqual([0,null]);
  });
});
