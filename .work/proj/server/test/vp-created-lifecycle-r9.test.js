// All patient content is newly authored through HTTP, not a pre-seeded case.
// The AI provider below is synthetic; this does not certify an external model.
import { beforeAll, afterEach, it, expect, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import request from 'supertest';
import { initDb, db, persistNow, reloadDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { setSetting } from '../src/routes/content.js';
let app, teacher, admin, student, studentId;
const auth = token => ({ Authorization: `Bearer ${token}` });
const login = async username => (await request(app).post('/api/auth/login').send({ username, password: 'demo' })).body.token;
beforeAll(async () => {
  execFileSync(process.execPath, ['src/seed.js', '--force'], { stdio: 'ignore' });
  await initDb(); app = createApp();
  teacher = await login('teacher'); admin = await login('admin'); student = await login('40012345');
  studentId = db.prepare("SELECT id FROM users WHERE username='40012345'").get().id;
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('creates a bilingual patient, assigns it, starts once, interviews/examines/orders, retries failed AI and stores one result across restart', async () => {
  vi.stubEnv('VP_REQUIRE_AI_EVALUATION', '1'); vi.stubEnv('AI_API_KEY', '');
  setSetting('ai', { apiKey: '' }); setSetting('ai_vpatient', {});
  const ref = await request(app).post('/api/academic/references').set(auth(admin)).send({ code: 'r9-synthetic-reference', title_en: 'Synthetic faculty test material', rights_status: 'metadata_only' });
  expect(ref.status).toBe(201);
  const policy = await request(app).post('/api/academic/policies').set(auth(teacher)).send({ course_code: 'r9-synthetic-course', course_name_en: 'Synthetic test policy', reference_id: ref.body.reference.id, source_anchor: 'Synthetic chapter 1', status: 'approved', content_mode: 'teacher_authored', teaching_basis_en: 'Synthetic faculty-authored testing material. Ask the patient about symptom onset and review the chart. This fixture is not medical guidance.' });
  expect(policy.status).toBe(201);
  expect(policy.body.policy.ready).toBe(true);
  const chart = { title_fa: 'پروندهٔ آزمون', title_en: 'Synthetic private diagnosis', age: 43, sex: 'female', chief_fa: 'تنگی نفس', chief_en: 'Shortness of breath', history_fa: 'تنگی نفس از یک ساعت قبل شروع شده است.', history_en: 'Shortness of breath started one hour ago.', exam_fa: 'تعداد تنفس ۲۴', exam_en: 'Respiratory rate is 24.', vitals: { bp: '120/80', hr: '110', rr: '24', temp: '37', spo2: '92%' }, diagnosis_en: 'Synthetic diagnosis', checklist_id: 1, reference_policy_id: policy.body.policy.id, imagingResults: [{ name_en: 'Electrocardiogram', name_fa: 'نوار قلب', aliases: ['ECG'], result_en: 'Sinus tachycardia' }, { name_en: 'CT chest', name_fa: 'سی تی قفسه سینه', aliases: ['CT'], result_en: 'Synthetic CT finding', result_fa: 'یافتهٔ سی تی آزمایشی', imageUrl: '/uploads/r9-synthetic-ct.png' }], labResults: [{ name_en: 'CBC', name_fa: 'شمارش سلول خون', aliases: ['CBC'], result_en: 'Synthetic CBC finding' }] };
  const created = await request(app).post('/api/cases').set(auth(teacher)).send(chart);
  expect(created.status).toBe(200);
  const caseId = created.body.id;
  const row = db.prepare('SELECT * FROM cases WHERE id=?').get(caseId);
  expect(row.public_code).toMatch(/^VP-/);
  expect((await request(app).get(`/api/cases/${caseId}`).set(auth(student))).status).toBe(403);
  const assigned = await request(app).put(`/api/assignments/${studentId}`).set(auth(teacher)).send({ caseIds: [caseId], maxAttempts: 2 });
  expect(assigned.status).toBe(200);
  const safe = await request(app).get(`/api/cases/${caseId}`).set(auth(student));
  expect(safe.status).toBe(200); expect(safe.body.chief_en).toBe(chart.chief_en);
  for (const key of ['diagnosis_en','history_en','exam_en','imagingResults','labResults','images']) expect(safe.body).not.toHaveProperty(key);
  expect(JSON.stringify(safe.body)).not.toContain(chart.title_en);
  const startBody = { caseId, lang: 'en', requestId: 'r9-created-lifecycle' };
  const started = await request(app).post('/api/exam/session-start').set(auth(student)).send(startBody);
  expect(started.status).toBe(200);
  expect((await request(app).post('/api/exam/session-start').set(auth(student)).send(startBody)).body.sessionId).toBe(started.body.sessionId);
  const chat = await request(app).post('/api/exam/patient-reply').set(auth(student)).send({ caseId, sessionId: started.body.sessionId, userText: 'When did it start?', lang: 'en' });
  expect(chat.status).toBe(200); expect(chat.body.text).toContain('one hour');
  const exam = await request(app).post('/api/exam/patient-reply').set(auth(student)).send({ caseId, sessionId: started.body.sessionId, userText: 'Check vital signs', lang: 'en' });
  expect(exam.status).toBe(200); expect(exam.body.mode).toBe('exam'); expect(exam.body.text).toContain('110');
  for (const [kind, query, expected] of [['imaging','CT','Synthetic CT finding'],['paraclinic','ECG','Sinus tachycardia'],['lab','CBC','Synthetic CBC finding']]) {
    const order = await request(app).post('/api/exam/order').set(auth(student)).send({ caseId, sessionId: started.body.sessionId, kind, query, lang: 'en' });
    expect(order.status).toBe(200); expect(order.body.found).toBe(true); expect(order.body.text).toContain(expected);
    if (query === 'CT') expect(order.body.imageUrl).toBe('/uploads/r9-synthetic-ct.png');
  }
  const payload = { caseId, sessionId: started.body.sessionId, lang: 'en', durationSec: 60, session: { messages: [{ role:'student',text:'When did it start?' },{ role:'patient',text:chat.body.text }], problemList:['Dyspnea'], ddx:['Synthetic diagnosis'], tests:['CBC'], imaging:['CT'], finalDx:'Synthetic diagnosis' } };
  const count = () => db.prepare('SELECT COUNT(*) n FROM attempts WHERE case_id=?').get(caseId).n;
  const missing = await request(app).post('/api/exam/evaluate').set(auth(student)).send(payload);
  expect(missing.status).toBe(503); expect(count()).toBe(0);
  setSetting('ai', { provider: 'OpenRouter', model: 'synthetic/test', apiKey: 'synthetic-not-a-real-key' });
  let failLesson = true, scoringCalls = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    const user = JSON.parse(init.body).messages.at(-1).content;
    let content;
    if (user.startsWith('RUBRIC:')) {
      scoringCalls++;
      const rubric = JSON.parse(user.split('RUBRIC:\n')[1].split('\n\nAUTHORITATIVE_REFERENCE:')[0]);
      content = JSON.stringify({ items: rubric.map(r => ({ id:r.id,done:false,reason:'Synthetic test: insufficient evidence.' })) });
    } else content = failLesson ? 'invalid synthetic lesson' : JSON.stringify({ strengths:[],weaknesses:['Ask about onset.'],missed:[],commonMistakes:[],suggestion:'Review with faculty.',microlearning:'### Targeted teaching\nAsk about onset and clarify the symptom history. Review the documented findings with faculty before interpreting them. This is synthetic test teaching, not a clinical recommendation.' });
    return { ok:true,status:200,json:async()=>({choices:[{message:{content}}]}) };
  }));
  const failed = await request(app).post('/api/exam/evaluate').set(auth(student)).send(payload);
  expect(failed.status).toBe(503); expect(count()).toBe(0); expect(scoringCalls).toBe(1);
  failLesson = false;
  const evaluated = await request(app).post('/api/exam/evaluate').set(auth(student)).send(payload);
  expect(evaluated.status).toBe(200); expect(evaluated.body.source).toBe('llm'); expect(evaluated.body.feedbackSource).toBe('llm');
  expect(evaluated.body.microlearning).toContain('Targeted teaching'); expect(evaluated.body.attemptId).toBeTruthy();
  expect(count()).toBe(1); expect(scoringCalls).toBe(1);
  persistNow(); await reloadDb();
  const replay = await request(app).post('/api/exam/evaluate').set(auth(student)).send(payload);
  expect(replay.status).toBe(200); expect(replay.body.replayed).toBe(true); expect(replay.body.attemptId).toBe(evaluated.body.attemptId); expect(count()).toBe(1);
  const saved = await request(app).get(`/api/cases/${caseId}`).set(auth(teacher));
  expect(saved.body.history_fa).toBe(chart.history_fa); expect(saved.body.history_en).toBe(chart.history_en); expect(saved.body.public_code).toBe(row.public_code);
  const learner = await login('learner'); expect((await request(app).get(`/api/cases/${caseId}`).set(auth(learner))).status).toBe(403);
}, 60000);
