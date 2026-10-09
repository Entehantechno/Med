import { beforeAll, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { db, initDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/auth.js';
import { UPLOADS_DIR, ACADEMIC_DIR } from '../src/lib/paths.js';
let app, a, b, seq = 0;
const run = (sql, ...args) => Number(db.prepare(sql).run(...args).lastInsertRowid);
function user(role = 'teacher', uni = a) {
  const id = run("INSERT INTO users(username,password_hash,role,status,university_id) VALUES (?,'fixture',?,'active',?)", `r26-${++seq}`, role, uni);
  return { id, token: signToken(db.prepare('SELECT * FROM users WHERE id=?').get(id)) };
}
const image = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
const samples = [
  ['image', '/api/upload', 'pixel.gif', 'image/gif', image],
  ['video', '/api/upload/video', 'clip.mp4', 'video/mp4', Buffer.from('0000ftypisom00000000')],
  ['audio', '/api/upload/audio', 'sound.wav', 'audio/wav', Buffer.from('RIFF0000WAVEfmt 0000000000000000')],
];
const upload = (sample, u) => request(app).post(sample[1]).set('Authorization', `Bearer ${u.token}`).attach(sample[0], sample[4], { filename: sample[2], contentType: sample[3] });
beforeAll(async () => {
  execFileSync(process.execPath, ['src/seed.js', '--force'], { stdio: 'ignore' });
  await initDb();
  a = run("INSERT INTO universities(name_en,code) VALUES ('R26 A','r26-a')");
  b = run("INSERT INTO universities(name_en,code) VALUES ('R26 B','r26-b')");
  app = createApp();
}, 60000);
for (const sample of samples) {
  it(`${sample[0]}: uploaded teacher file is private before attachment to a case`, async () => {
    const teacher = user(), student = user('student'), outsider = user('student', b);
    const result = await upload(sample, teacher);
    expect(result.status).toBe(200);
    const url = result.body.url;
    expect((await request(app).get(url)).status).toBe(404);
    expect((await request(app).get(url).set('Authorization', `Bearer ${outsider.token}`)).status).toBe(404);
    expect((await request(app).get(url).set('Authorization', `Bearer ${student.token}`)).status).toBe(200);
    expect(url).toMatch(new RegExp(`^/uploads/academic/university-${a}/`));
    expect(fs.existsSync(path.join(ACADEMIC_DIR, `university-${a}`, 'media', path.basename(url)))).toBe(true);
    const library = await request(app).get('/api/upload/library').set('Authorization', `Bearer ${teacher.token}`);
    expect(library.body.items.some(x => x.url === url)).toBe(true);
  });
  it(`${sample[0]}: unassigned teacher cannot publish a public fallback`, async () => {
    const before = fs.readdirSync(UPLOADS_DIR);
    expect((await upload(sample, user('teacher', null))).status).toBe(403);
    expect(fs.readdirSync(UPLOADS_DIR)).toEqual(before);
  });
  it(`${sample[0]}: admin upload remains in the platform library`, async () => {
    const admin = user('admin', null), result = await upload(sample, admin);
    expect(result.status).toBe(200);
    expect(result.body.url).toMatch(/^\/uploads\/platform\//);
    expect((await request(app).get(result.body.url)).status).toBe(200);
  });
}
for (const sample of samples) {
  it(`${sample[0]}: rejects student writes and removes invalid content`, async () => {
    expect((await upload(sample, user('student'))).status).toBe(403);
    const teacher = user(), dir = path.join(ACADEMIC_DIR, `university-${a}`, 'media');
    const before = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
    const invalid = [...sample]; invalid[4] = Buffer.from('not a media file');
    expect((await upload(invalid, teacher)).status).toBe(400);
    expect(fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []).toEqual(before);
  });
  it(`${sample[0]}: private caching and current membership apply to retrieval`, async () => {
    const teacher = user(), result = await upload(sample, teacher), url = result.body.url;
    const own = await request(app).get(url).set('Authorization', `Bearer ${teacher.token}`);
    expect(own.status).toBe(200); expect(own.headers['cache-control']).toBe('private, no-store');
    db.prepare('UPDATE users SET university_id=? WHERE id=?').run(b, teacher.id);
    expect((await request(app).get(url).set('Authorization', `Bearer ${teacher.token}`)).status).toBe(404);
    expect((await request(app).get(url).set('Authorization', `Bearer ${user('admin', null).token}`)).status).toBe(200);
  });
}
it('reference PDFs keep their explicit public platform contract', async () => {
  const sample = ['pdf', '/api/upload/pdf', 'reference.pdf', 'application/pdf', Buffer.from('%PDF-1.4\n%%EOF\n')];
  const result = await upload(sample, user());
  expect(result.status).toBe(200); expect(result.body.url).toMatch(/^\/uploads\/platform\//);
  expect((await request(app).get(result.body.url)).status).toBe(200);
});
it('PNG upload URL points to the retained or optimized tenant file', async () => {
  const sample = ['image', '/api/upload', 'pixel.png', 'image/png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ+YAAAAASUVORK5CYII=', 'base64')];
  const teacher = user(), result = await upload(sample, teacher);
  expect(result.status).toBe(200); expect(result.body.url).toContain(`/uploads/academic/university-${a}/`);
  expect((await request(app).get(result.body.url).set('Authorization', `Bearer ${teacher.token}`)).status).toBe(200);
});
