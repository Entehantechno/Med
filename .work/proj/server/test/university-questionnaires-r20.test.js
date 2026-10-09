import {beforeAll,afterEach,it,expect,vi} from 'vitest';
import {execFileSync} from 'node:child_process';import fs from 'node:fs';import request from 'supertest';
import {initDb,db,persistNow,reloadDb} from '../src/db.js';import {DB_PATH} from '../src/lib/paths.js';import {createApp} from '../src/app.js';import {signToken} from '../src/lib/auth.js';
let app,uni,seq=0;const A=t=>({Authorization:`Bearer ${t}`});
function actor(role,university=uni){const id=Number(db.prepare("INSERT INTO users(username,password_hash,role,university_id,status) VALUES (?,'fixture',?,?,'active')").run('r20-'+(++seq),role,university).lastInsertRowid);return {id,token:signToken(db.prepare('SELECT * FROM users WHERE id=?').get(id))};}
function fixture(anonymous=true){const teacher=actor('teacher'),student=actor('student');const fid=Number(db.prepare("INSERT INTO questionnaire_forms(title_en,scope,created_by,anonymous) VALUES ('R20 original','general',?,?)").run(teacher.id,anonymous?1:0).lastInsertRowid);return {teacher,student,fid};}
function failSaveWhen(changed){const rename=fs.renameSync;vi.spyOn(fs,'renameSync').mockImplementation((src,dst)=>{if(dst===DB_PATH&&changed())throw Error('R20 simulated database persistence failure');return rename(src,dst);});}
const rows=f=>db.prepare('SELECT * FROM questionnaire_responses WHERE form_id=? ORDER BY id').all(f.fid);
const answer=(f,text)=>request(app).post(`/api/questionnaires/${f.fid}/responses`).set(A(f.student.token)).send({answers:{text}});
beforeAll(async()=>{execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();uni=Number(db.prepare("INSERT INTO universities(name_en,code) VALUES ('R20 university','r20-uni')").run().lastInsertRowid);app=createApp();},60000);
afterEach(()=>vi.restoreAllMocks());
it('rejects creating a general university form by an unassigned teacher',async()=>{
 const teacher=actor('teacher',null),before=db.prepare('SELECT COUNT(*) n FROM questionnaire_forms').get().n;
 expect((await request(app).post('/api/questionnaires/admin/forms').set(A(teacher.token)).send({scope:'general',title_en:'unassigned'})).status).toBe(400);expect(db.prepare('SELECT COUNT(*) n FROM questionnaire_forms').get().n).toBe(before);
});
it('rolls back new forms and reports failure if the save fails',async()=>{
 const teacher=actor('teacher'),before=db.prepare('SELECT COUNT(*) n FROM questionnaire_forms').get().n;persistNow();failSaveWhen(()=>db.prepare('SELECT COUNT(*) n FROM questionnaire_forms').get().n>before);
 const r=await request(app).post('/api/questionnaires/admin/forms').set(A(teacher.token)).send({title_en:'R20 new',scope:'general'});vi.restoreAllMocks();expect(r.status).toBeGreaterThanOrEqual(500);expect(db.prepare('SELECT COUNT(*) n FROM questionnaire_forms').get().n).toBe(before);
});
it('preserves the original form if editing cannot be durably saved',async()=>{
 const f=fixture(),before=db.prepare('SELECT * FROM questionnaire_forms WHERE id=?').get(f.fid);persistNow();failSaveWhen(()=>db.prepare('SELECT title_en FROM questionnaire_forms WHERE id=?').get(f.fid)?.title_en==='R20 changed');
 const r=await request(app).put(`/api/questionnaires/admin/forms/${f.fid}`).set(A(f.teacher.token)).send({title_en:'R20 changed',anonymous:false});vi.restoreAllMocks();expect(r.status).toBeGreaterThanOrEqual(500);expect(db.prepare('SELECT * FROM questionnaire_forms WHERE id=?').get(f.fid)).toEqual(before);
});
it('does not acknowledge or retain an anonymous answer after save failure',async()=>{
 const f=fixture();persistNow();failSaveWhen(()=>rows(f).length>0);const r=await answer(f,'unsaved');vi.restoreAllMocks();expect(r.status).toBeGreaterThanOrEqual(500);expect(rows(f)).toHaveLength(0);
});
it('preserves the previous anonymous answer when replacement fails',async()=>{
 const f=fixture();expect((await answer(f,'original')).status).toBe(200);const before=rows(f);persistNow();failSaveWhen(()=>rows(f)[0]?.answers_json.includes('replacement'));
 const r=await answer(f,'replacement');vi.restoreAllMocks();expect(r.status).toBeGreaterThanOrEqual(500);expect(rows(f)).toEqual(before);
});
for(const anonymous of [true,false]){
 it(`saves exactly one ${anonymous?'anonymous':'identified'} response after a failed insert and retry`,async()=>{
  const f=fixture(anonymous);persistNow();failSaveWhen(()=>rows(f).length>0);expect((await answer(f,'failed')).status).toBe(500);vi.restoreAllMocks();expect(rows(f)).toHaveLength(0);
  const r=await answer(f,'saved');expect(r.status).toBe(200);expect(r.body.replaced).toBe(false);await reloadDb();expect(rows(f)).toHaveLength(1);expect(rows(f)[0].user_id).toBe(anonymous?null:f.student.id);expect(JSON.parse(rows(f)[0].answers_json)).toEqual({text:'saved'});
 });
 it(`retains identity and response ID when retrying a ${anonymous?'anonymous':'identified'} replacement`,async()=>{
  const f=fixture(anonymous);expect((await answer(f,'old')).status).toBe(200);const before=rows(f);persistNow();failSaveWhen(()=>rows(f)[0]?.answers_json.includes('new'));
  expect((await answer(f,'new')).status).toBe(500);vi.restoreAllMocks();expect(rows(f)).toEqual(before);const r=await answer(f,'new');expect(r.status).toBe(200);expect(r.body.replaced).toBe(true);await reloadDb();const after=rows(f);expect(after).toHaveLength(1);expect(after[0].id).toBe(before[0].id);expect(after[0].user_id).toBe(before[0].user_id);expect(after[0].pseudonym).toBe(before[0].pseudonym);expect(JSON.parse(after[0].answers_json)).toEqual({text:'new'});
 });
}
it('retries failed form creation once and preserves the saved form on reload',async()=>{
 const teacher=actor('teacher'),title='R20 create retry';persistNow();const lookup=()=>db.prepare('SELECT * FROM questionnaire_forms WHERE title_en=?').all(title);failSaveWhen(()=>lookup().length>0);
 const post=()=>request(app).post('/api/questionnaires/admin/forms').set(A(teacher.token)).send({scope:'general',title_en:title,questions:[{id:'q1',type:'text'}]});expect((await post()).status).toBe(500);vi.restoreAllMocks();expect(lookup()).toHaveLength(0);const r=await post();expect(r.status).toBe(200);await reloadDb();expect(lookup()).toHaveLength(1);expect(lookup()[0].id).toBe(r.body.id);
});
it('retries a form edit without rewriting previously submitted answers',async()=>{
 const f=fixture();expect((await answer(f,'historical')).status).toBe(200);const answers=rows(f),before=db.prepare('SELECT * FROM questionnaire_forms WHERE id=?').get(f.fid);persistNow();failSaveWhen(()=>db.prepare('SELECT title_en FROM questionnaire_forms WHERE id=?').get(f.fid)?.title_en==='R20 edit retry');
 const put=()=>request(app).put(`/api/questionnaires/admin/forms/${f.fid}`).set(A(f.teacher.token)).send({title_en:'R20 edit retry',active:false});expect((await put()).status).toBe(500);vi.restoreAllMocks();expect(db.prepare('SELECT * FROM questionnaire_forms WHERE id=?').get(f.fid)).toEqual(before);expect((await put()).status).toBe(200);await reloadDb();expect(db.prepare('SELECT active FROM questionnaire_forms WHERE id=?').get(f.fid).active).toBe(0);expect(rows(f)).toEqual(answers);
});
it('still allows administrators to create a general form without university membership',async()=>{
 const admin=actor('admin',null);const r=await request(app).post('/api/questionnaires/admin/forms').set(A(admin.token)).send({scope:'general',title_en:'R20 admin form'});expect(r.status).toBe(200);expect(r.body.created_by).toBe(admin.id);
});
it('rejects teacher creation after membership removal with the same token',async()=>{
 const teacher=actor('teacher');expect((await request(app).get('/api/questionnaires/admin/forms').set(A(teacher.token))).status).toBe(200);db.prepare('UPDATE users SET university_id=NULL WHERE id=?').run(teacher.id);
 expect((await request(app).post('/api/questionnaires/admin/forms').set(A(teacher.token)).send({scope:'general'})).status).toBe(400);
});
it('keeps general form responses scoped to the creator university',async()=>{
 const f=fixture(),foreign=actor('student',1);const r=await request(app).post(`/api/questionnaires/${f.fid}/responses`).set(A(foreign.token)).send({answers:{text:'foreign'}});expect(r.status).toBe(403);expect(rows(f)).toHaveLength(0);
});
