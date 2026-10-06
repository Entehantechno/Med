import { beforeAll, describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import request from 'supertest';
import { initDb, db, reloadDb, persistNow } from '../src/db.js';
import { createApp } from '../src/app.js';
let app, teacher, student;
const basic = { name_fa: 'آزمایش', name_en: 'Test', desc_fa: '', desc_en: '', maxAttempts: 2 };
const auth = token => ({ Authorization: `Bearer ${token}` });
beforeAll(async () => {
  execFileSync(process.execPath, ['src/seed.js', '--force'], { stdio: 'ignore' });
  await initDb();
  app = createApp();
  teacher = (await request(app).post('/api/auth/login').send({ username: 'teacher', password: 'demo' })).body.token;
  student = (await request(app).post('/api/auth/login').send({ username: '40012345', password: 'demo' })).body.token;
}, 60000);
describe('class exam settings', () => {
  it('creates, updates, preserves omitted flags, and persists them', async () => {
    const created = await request(app).post('/api/classes').set(auth(teacher)).send({ ...basic, exam_mode: true, timer_enabled: '1', timer_minutes: 45 });
    expect(created.status).toBe(200);
    const id = created.body.id;
    const read = () => db.prepare('SELECT exam_mode,timer_enabled,timer_minutes FROM classes WHERE id=?').get(id);
    expect(read()).toEqual({ exam_mode: 1, timer_enabled: 1, timer_minutes: 45 });
    expect((await request(app).put(`/api/classes/${id}`).set(auth(teacher)).send(basic)).status).toBe(200);
    expect(read()).toEqual({ exam_mode: 1, timer_enabled: 1, timer_minutes: 45 });
    expect((await request(app).put(`/api/classes/${id}`).set(auth(teacher)).send({ ...basic, examMode: 'false', timerEnabled: false, timerMinutes: 60 })).status).toBe(200);
    await reloadDb();
    expect(read()).toEqual({ exam_mode: 0, timer_enabled: 0, timer_minutes: 60 });
    const list = await request(app).get('/api/classes').set(auth(teacher));
    expect(list.body.find(c => c.id === id)).toMatchObject(read());
    expect((await request(app).put(`/api/classes/${id}`).set(auth(student)).send({ timer_enabled: true })).status).toBe(403);
  });
  it('defaults to untimed and rejects invalid settings without inserting', async () => {
    const created = await request(app).post('/api/classes').set(auth(teacher)).send(basic);
    expect(created.body).toMatchObject({ exam_mode: 0, timer_enabled: 0, timer_minutes: 30 });
    for (const bad of [{ timer_minutes: 0 }, { timer_minutes: null }, { timer_minutes: 1.5 }, { timer_minutes: 1441 }, { timer_minutes: 'oops' }, { exam_mode: 'yes' }, { timer_enabled: {} }]) {
      expect((await request(app).post('/api/classes').set(auth(teacher)).send({ ...basic, ...bad })).status).toBe(400);
      expect((await request(app).put(`/api/classes/${created.body.id}`).set(auth(teacher)).send({ ...basic, ...bad })).status).toBe(400);
    }
  });
});
describe('student case list shares detail access policy', () => {
  it('includes direct, class and started exam cases, but not future/inactive/foreign/unassigned cases', async () => {
    const uid = db.prepare("SELECT id FROM users WHERE username='40012345'").get().id;
    function makeCase(uni = 1) {
      return db.prepare('INSERT INTO cases (data_json,active,university_id) VALUES (?,1,?)').run(JSON.stringify({ title_en: 'Secret diagnosis', chief_en: 'Complaint', track: 'university' }), uni).lastInsertRowid;
    }
    const examCase = makeCase(), future = makeCase(), inactive = makeCase(), foreign = makeCase(999), unassigned = makeCase();
    for (const [cid, start, active] of [[examCase, '2020-01-01', 1], [future, '2099-01-01', 1], [inactive, '2020-01-01', 0]]) {
      const eid = db.prepare('INSERT INTO exams (case_ids,starts_at,active,university_id) VALUES (?,?,?,1)').run(JSON.stringify([cid]), start, active).lastInsertRowid;
      db.prepare('INSERT INTO exam_participants (exam_id,user_id) VALUES (?,?)').run(eid, uid);
    }
    db.prepare('INSERT INTO exam_assignments (case_id,user_id,active) VALUES (?,?,1)').run(foreign, uid);
    const list = await request(app).get('/api/cases').set(auth(student));
    expect(list.status).toBe(200);
    const ids = list.body.map(c => c.id);
    expect(ids).toEqual(expect.arrayContaining([1, 2, examCase]));
    for (const id of [future, inactive, foreign, unassigned]) {
      expect(ids).not.toContain(id);
      expect((await request(app).get(`/api/cases/${id}`).set(auth(student))).status).toBe(403);
    }
    expect(JSON.stringify(list.body)).not.toContain('Secret diagnosis');
    db.prepare('UPDATE classes SET active=0 WHERE id=1').run();
    expect((await request(app).get('/api/cases').set(auth(student))).body.map(c => c.id)).not.toContain(2);
    persistNow();
  });
});
describe('explicit demo account restoration', () => {
  it('is opt-in, repeatable, preserves content and restores four login roles', async () => {
    const count = () => db.prepare('SELECT COUNT(*) n FROM cases').get().n;
    const before = count();
    persistNow();
    expect(() => execFileSync(process.execPath, ['src/restore-demo-accounts.js'], { stdio: 'ignore' })).toThrow();
    for (let i = 0; i < 2; i++) {
      execFileSync(process.execPath, ['src/restore-demo-accounts.js', '--confirm-demo'], {
        stdio: 'ignore', env: { ...process.env, NODE_ENV: 'development' },
      });
    }
    await reloadDb();
    expect(count()).toBe(before);
    for (const [username, role] of [['admin','admin'], ['teacher','teacher'], ['40012345','student'], ['learner','learner']]) {
      const result = await request(app).post('/api/auth/login').send({ username, password: 'demo' });
      expect(result.status).toBe(200);
      expect(result.body.user.role).toBe(role);
    }
  }, 60000);
});
