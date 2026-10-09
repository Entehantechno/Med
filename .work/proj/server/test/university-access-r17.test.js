import {beforeAll,it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';import request from 'supertest';
import {initDb,db} from '../src/db.js';import {createApp} from '../src/app.js';import {signToken} from '../src/lib/auth.js';
let app,seq=0,uniA,uniB;
const A=token=>({Authorization:`Bearer ${token}`});
function user(role='teacher',uni=uniA){const id=Number(db.prepare("INSERT INTO users(username,password_hash,role,university_id,status) VALUES (?,'fixture',?,?,'active')").run('r17-'+(++seq),role,uni).lastInsertRowid);return {id,token:signToken(db.prepare('SELECT * FROM users WHERE id=?').get(id))};}
function context(kind,uni=uniA){return Number(db.prepare(`INSERT INTO ${kind==='class'?'classes':'exams'}(${kind==='class'?'name_en':'title_en'},university_id) VALUES ('R17',?)`).run(uni).lastInsertRowid);}
function enroll(kind,id,uid){db.prepare(`INSERT INTO ${kind==='class'?'class_members(class_id':'exam_participants(exam_id'},user_id) VALUES (?,?)`).run(id,uid);}
function form(kind,id,creator){return Number(db.prepare(`INSERT INTO questionnaire_forms(title_en,scope,${kind}_id,created_by,anonymous) VALUES ('R17',?,?,?,1)`).run(kind,id,creator).lastInsertRowid);}
beforeAll(async()=>{execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();uniA=Number(db.prepare("INSERT INTO universities(name_en,code) VALUES ('R17 A','r17-a')").run().lastInsertRowid);uniB=Number(db.prepare("INSERT INTO universities(name_en,code) VALUES ('R17 B','r17-b')").run().lastInsertRowid);app=createApp();},60000);
for(const [kind,path] of [['class','classes'],['exam','exams']]){
 it(`revokes warmed ${kind} access after teacher university transfer`,async()=>{
  const u=user(),old=context(kind),next=context(kind,uniB);expect((await request(app).get(`/api/${path}/${old}`).set(A(u.token))).status).toBe(200);
  db.prepare('UPDATE users SET university_id=? WHERE id=?').run(uniB,u.id);
  expect((await request(app).get(`/api/${path}/${old}`).set(A(u.token))).status).toBe(403);expect((await request(app).get(`/api/${path}/${next}`).set(A(u.token))).status).toBe(200);
 });
 it(`revokes warmed ${kind} access when university membership is removed`,async()=>{
  const u=user(),id=context(kind);expect((await request(app).get(`/api/${path}/${id}`).set(A(u.token))).status).toBe(200);db.prepare('UPDATE users SET university_id=NULL WHERE id=?').run(u.id);
  expect((await request(app).get(`/api/${path}/${id}`).set(A(u.token))).status).toBe(403);
 });
 it(`rejects unassigned teacher forging university_id to create ${kind}`,async()=>{
  const u=user('teacher',null),table=kind==='class'?'classes':'exams',before=db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n;
  const r=await request(app).post('/api/'+path).set(A(u.token)).send({name_en:'forged',title_en:'forged',university_id:uniB});expect(r.status).toBe(400);expect(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n).toBe(before);
 });
 it(`rejects answering a foreign ${kind} questionnaire using own membership`,async()=>{
  const u=user('student'),teacher=user('teacher',uniB),own=context(kind),foreign=context(kind,uniB);enroll(kind,own,u.id);const fid=form(kind,foreign,teacher.id);
  const r=await request(app).post(`/api/questionnaires/${fid}/responses`).set(A(u.token)).send({contextType:kind,contextId:own,answers:{x:'forged'}});expect(r.status).toBe(403);expect(db.prepare('SELECT COUNT(*) n FROM questionnaire_responses WHERE form_id=?').get(fid).n).toBe(0);
 });
}
it('does not expose global report totals to a teacher without a university',async()=>{
 expect((await request(app).get('/api/reports/summary').set(A(user('teacher',null).token))).status).toBe(403);
});
it('rejects substituting another enrolled class for the form-bound class',async()=>{
 const u=user('student'),teacher=user(),bound=context('class'),other=context('class');enroll('class',bound,u.id);enroll('class',other,u.id);const fid=form('class',bound,teacher.id);
 expect((await request(app).post(`/api/questionnaires/${fid}/responses`).set(A(u.token)).send({contextType:'class',contextId:other,answers:{}})).status).toBe(403);
});
it('checks both class and exam tenant references when a teacher creates a form',async()=>{
 const teacher=user();const r=await request(app).post('/api/questionnaires/admin/forms').set(A(teacher.token)).send({scope:'class',class_id:context('class'),exam_id:context('exam',uniB)});expect(r.status).toBe(403);
});
it('honors an explicit null when detaching a questionnaire from a class',async()=>{
 const teacher=user(),fid=form('class',context('class'),teacher.id);const r=await request(app).put(`/api/questionnaires/admin/forms/${fid}`).set(A(teacher.token)).send({scope:'general',class_id:null});expect(r.status).toBe(200);expect(r.body.class_id).toBeNull();
});
for(const [kind,path] of [['class','classes'],['exam','exams']]){
 it(`prevents revoked teacher from deactivating ${kind}`,async()=>{
  const u=user(),id=context(kind);expect((await request(app).get(`/api/${path}/${id}`).set(A(u.token))).status).toBe(200);db.prepare('UPDATE users SET university_id=? WHERE id=?').run(uniB,u.id);
  expect((await request(app).delete(`/api/${path}/${id}`).set(A(u.token))).status).toBe(403);expect(db.prepare(`SELECT active FROM ${path} WHERE id=?`).get(id).active).toBe(1);
 });
 it(`keeps teacher ${kind} creation in the current university and allows admin selection`,async()=>{
  const u=user(),admin=user('admin',null),body={name_en:'R17 allowed',title_en:'R17 allowed',university_id:uniB};
  for(const [actor,expected] of [[u,uniA],[admin,uniB]]){const r=await request(app).post('/api/'+path).set(A(actor.token)).send(body);expect(r.status).toBe(200);expect(db.prepare(`SELECT university_id FROM ${path} WHERE id=?`).get(r.body.id).university_id).toBe(expected);}
 });
 it(`allows correct anonymous ${kind} questionnaire and idempotent replacement`,async()=>{
  const teacher=user(),student=user('student'),id=context(kind),fid=form(kind,id,teacher.id);enroll(kind,id,student.id);
  for(const n of [1,2]){const r=await request(app).post(`/api/questionnaires/${fid}/responses`).set(A(student.token)).send({answers:{n}});expect(r.status).toBe(200);expect(r.body.replaced).toBe(n===2);}
  const rows=db.prepare('SELECT * FROM questionnaire_responses WHERE form_id=?').all(fid);expect(rows).toHaveLength(1);expect(rows[0].user_id).toBeNull();expect(rows[0].pseudonym).toBeTruthy();expect(rows[0].context_id).toBe(id);expect(JSON.parse(rows[0].answers_json)).toEqual({n:2});
 });
 it(`rejects unbound ${kind} questionnaire without a concrete enrollment context`,async()=>{
  const teacher=user(),student=user('student');const fid=form(kind,null,teacher.id);
  expect((await request(app).post(`/api/questionnaires/${fid}/responses`).set(A(student.token)).send({answers:{}})).status).toBe(403);
 });
}
it('checks both references on form update and leaves the original unchanged',async()=>{
 const teacher=user(),id=context('class'),fid=form('class',id,teacher.id),before=db.prepare('SELECT * FROM questionnaire_forms WHERE id=?').get(fid);
 const r=await request(app).put(`/api/questionnaires/admin/forms/${fid}`).set(A(teacher.token)).send({exam_id:context('exam',uniB)});expect(r.status).toBe(403);expect(db.prepare('SELECT * FROM questionnaire_forms WHERE id=?').get(fid)).toEqual(before);
});
it('preserves same-university general questionnaire responses',async()=>{
 const teacher=user(),student=user('student');const fid=Number(db.prepare("INSERT INTO questionnaire_forms(scope,created_by,anonymous) VALUES ('general',?,1)").run(teacher.id).lastInsertRowid);
 expect((await request(app).post(`/api/questionnaires/${fid}/responses`).set(A(student.token)).send({answers:{x:'valid'}})).status).toBe(200);
});
for(const path of ['/api/classes','/api/exams','/api/reports/summary','/api/questionnaires/admin/forms','/api/research/studies','/api/academic/status','/api/upload/library','/api/tutor/context-settings']){
 it(`requires authentication for ${path}`,async()=>{expect((await request(app).get(path)).status).toBe(401);});
}
it('keeps student out of staff-only academic, report, research, media and tutor settings',async()=>{
 const student=user('student');for(const path of ['/api/reports/summary','/api/questionnaires/admin/forms','/api/research/studies','/api/academic/status','/api/upload/library','/api/tutor/context-settings'])expect((await request(app).get(path).set(A(student.token))).status,path).toBe(403);
});
it('scopes class/exam/tutor/research lists to the teacher university',async()=>{
 const teacher=user(),other=user('teacher',uniB),oursClass=context('class'),foreignClass=context('class',uniB),oursExam=context('exam'),foreignExam=context('exam',uniB);
 const study=owner=>Number(db.prepare("INSERT INTO research_studies(title_en,created_by) VALUES ('R17 scoped study',?)").run(owner).lastInsertRowid);const oursStudy=study(teacher.id),foreignStudy=study(other.id);
 for(const [path,ours,foreign] of [['classes',oursClass,foreignClass],['exams',oursExam,foreignExam]]){const r=await request(app).get('/api/'+path).set(A(teacher.token));expect(r.status).toBe(200);expect(r.body.some(x=>x.id===ours)).toBe(true);expect(r.body.some(x=>x.id===foreign)).toBe(false);}
 const tutor=await request(app).get('/api/tutor/context-settings').set(A(teacher.token));expect(tutor.status).toBe(200);expect(tutor.body.classes.some(x=>x.id===oursClass)).toBe(true);expect(tutor.body.classes.some(x=>x.id===foreignClass)).toBe(false);expect(tutor.body.exams.some(x=>x.id===foreignExam)).toBe(false);
 const research=await request(app).get('/api/research/studies').set(A(teacher.token));expect(research.status).toBe(200);expect(research.body.studies.some(x=>x.id===oursStudy)).toBe(true);expect(research.body.studies.some(x=>x.id===foreignStudy)).toBe(false);
});
it('retains scoped reports and global admin summary access',async()=>{
 const teacher=user(),admin=user('admin',null);const r=await request(app).get('/api/reports/summary').set(A(teacher.token));expect(r.status).toBe(200);expect(r.body.students).toBe(db.prepare("SELECT COUNT(*) n FROM users WHERE role='student' AND university_id=?").get(uniA).n);expect((await request(app).get('/api/reports/summary').set(A(admin.token))).status).toBe(200);
});
