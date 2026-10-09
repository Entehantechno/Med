import {beforeAll,it,expect,vi} from 'vitest';
// A fresh file-owned DB is essential: the permanent identity registry correctly
// survives force-seeding in other suites and must not be cleared to make tests pass.
await vi.hoisted(async()=>{const fs=await import('node:fs');const path=await import('node:path');process.env.DATA_DIR=fs.mkdtempSync(path.resolve(process.cwd(),'../../r37-academic-'));});
import {execFileSync} from 'node:child_process';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {db,initDb,initSchema,persistNow,reloadDb} from '../src/db.js';
import {ensureAzarbarzTeacher} from '../src/lib/azarbarz-provision.js';
import {ensureEmergencyCases} from '../src/lib/emergency-provision.js';
import {createApp} from '../src/app.js';
import {signToken} from '../src/lib/auth.js';
let app,teacher,admin,student,result,privateCatalog,sharedCatalog;
const auth=u=>({Authorization:`Bearer ${signToken(u)}`});
beforeAll(async()=>{execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();initSchema();ensureEmergencyCases();
 admin=db.prepare("SELECT * FROM users WHERE role='admin' ORDER BY id LIMIT 1").get();student=db.prepare("SELECT * FROM users WHERE role='student' LIMIT 1").get();
 privateCatalog=Number(db.prepare('INSERT INTO catalogs(name_en,items_json,owner_id) VALUES (?,?,?)').run('Private admin catalog','[]',admin.id).lastInsertRowid);
 result=ensureAzarbarzTeacher();teacher=db.prepare('SELECT * FROM users WHERE username=?').get('drazarbarz1');app=createApp();
 sharedCatalog=db.prepare('SELECT * FROM catalogs WHERE shared_to_teachers=1 LIMIT 1').get();
},60000);
it('creates the requested teacher, hashed credential, canonical university, 16 owned questions and one image/science draft',()=>{
 expect(bcrypt.compareSync(teacher.username,teacher.password_hash)).toBe(true);expect(teacher.role).toBe('teacher');expect(db.prepare('SELECT code FROM universities WHERE id=?').get(teacher.university_id).code).toBe('ARAK');const rows=db.prepare('SELECT * FROM flashcards WHERE created_by=?').all(teacher.id);expect(rows).toHaveLength(16);expect(rows.filter(r=>!r.active)).toHaveLength(1);expect(new Set(rows.map(r=>r.public_code)).size).toBe(16);expect(result.sharedPatients).toBe(10);expect(result.sharedCatalogs).toBeGreaterThan(0);
});
it('logs in with the requested initial credential',async()=>{const r=await request(app).post('/api/auth/login').send({username:teacher.username,password:teacher.username});expect(r.status).toBe(200);expect(r.body.token).toBeTruthy()});
it('does not reset edits, credentials, disabled sharing or deleted cards across reboot/reload',async()=>{
 const r=db.prepare('SELECT * FROM flashcards WHERE created_by=? ORDER BY id DESC LIMIT 1').get(teacher.id);db.prepare('DELETE FROM flashcards WHERE id=?').run(r.id);db.prepare('UPDATE catalogs SET shared_to_teachers=0 WHERE id=?').run(sharedCatalog.id);db.prepare('UPDATE users SET password_hash=? WHERE id=?').run('changed-hash',teacher.id);persistNow({throwOnError:true});await reloadDb();initSchema();expect(ensureAzarbarzTeacher()).toEqual({alreadyApplied:true});expect(db.prepare('SELECT id FROM flashcards WHERE source_key=?').get(r.source_key)).toBeUndefined();expect(db.prepare('SELECT password_hash FROM users WHERE id=?').get(teacher.id).password_hash).toBe('changed-hash');expect(db.prepare('SELECT shared_to_teachers FROM catalogs WHERE id=?').get(sharedCatalog.id).shared_to_teachers).toBe(0);
});
it('allows admin to activate and revoke teacher read access while retaining ownership',async()=>{
 expect((await request(app).put(`/api/catalogs/${sharedCatalog.id}/sharing`).set(auth(admin)).send({enabled:true})).status).toBe(200);
 const r=await request(app).get('/api/catalogs').set(auth(teacher));expect(r.status).toBe(200);const shared=r.body.find(c=>c.id===sharedCatalog.id);expect(shared.can_manage).toBe(false);expect(shared.owner_id).toBe(sharedCatalog.owner_id);expect(r.body.some(c=>c.id===privateCatalog)).toBe(false);
 expect((await request(app).put(`/api/catalogs/${sharedCatalog.id}/sharing`).set(auth(admin)).send({enabled:false})).status).toBe(200);expect((await request(app).get('/api/catalogs').set(auth(teacher))).body.some(c=>c.id===sharedCatalog.id)).toBe(false);
});
it('denies teacher mutation/deletion/sharing of admin catalogs and denies student sharing',async()=>{
 for(const method of ['put','delete'])expect((await request(app)[method](`/api/catalogs/${sharedCatalog.id}`).set(auth(teacher)).send({name_en:'Hijack'})).status).toBe(403);
 for(const who of [teacher,student])expect((await request(app).put(`/api/catalogs/${sharedCatalog.id}/sharing`).set(auth(who)).send({enabled:true})).status).toBe(403);
 expect((await request(app).put(`/api/catalogs/${sharedCatalog.id}/sharing`).set(auth(admin)).send({enabled:'false'})).status).toBe(422);
});
it('shows shared academic VPs to the teacher without granting edit rights',async()=>{
 const r=await request(app).get('/api/cases').set(auth(teacher));expect(r.status).toBe(200);const shared=r.body.filter(c=>c.shared_to_teachers);expect(shared.length).toBeGreaterThanOrEqual(10);expect(shared.every(c=>c.can_manage===false)).toBe(true);
});
it('does not share edited/private patients or reactivate inactive ones on the one-time setup',()=>{
 const key='requested_azarbarz_histology_v1';db.prepare('DELETE FROM settings WHERE key=?').run(key);
 const rows=db.prepare("SELECT * FROM cases WHERE source_key LIKE 'medschool:emergency:%' ORDER BY id").all();const inactive=rows[0],edited=rows[1];db.prepare('UPDATE cases SET active=0,shared_to_teachers=0 WHERE id=?').run(inactive.id);const data={...JSON.parse(edited.data_json),history_fa:'Private faculty edit'};db.prepare('UPDATE cases SET data_json=?,shared_to_teachers=0 WHERE id=?').run(JSON.stringify(data),edited.id);
 const r=ensureAzarbarzTeacher();expect(r.inserted).toBe(0);expect(r.sharedPatients).toBe(8);expect(db.prepare('SELECT active,shared_to_teachers FROM cases WHERE id=?').get(inactive.id)).toEqual({active:0,shared_to_teachers:0});expect(db.prepare('SELECT shared_to_teachers FROM cases WHERE id=?').get(edited.id).shared_to_teachers).toBe(0);
});
it('rolls back rather than repurposing an existing account with a conflicting role',()=>{
 const key='requested_azarbarz_histology_v1';db.prepare('DELETE FROM settings WHERE key=?').run(key);db.prepare("UPDATE users SET role='student' WHERE id=?").run(teacher.id);const before=db.prepare('SELECT * FROM users WHERE id=?').get(teacher.id);expect(()=>ensureAzarbarzTeacher()).toThrow('identity_conflict');expect(db.prepare('SELECT * FROM users WHERE id=?').get(teacher.id)).toEqual(before);expect(db.prepare('SELECT 1 FROM settings WHERE key=?').get(key)).toBeUndefined();
});
