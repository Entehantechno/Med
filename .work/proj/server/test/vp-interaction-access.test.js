import {beforeAll,beforeEach,describe,it,expect,vi} from 'vitest';
import {execSync} from 'node:child_process';
import request from 'supertest';
const engine=vi.hoisted(()=>({patientReply:vi.fn(),labImagingResult:vi.fn()}));
vi.mock('../src/lib/ai-engine.js',async original=>({...await original(),...engine}));
import {db,initDb} from '../src/db.js';
import {createApp} from '../src/app.js';
import {signToken} from '../src/lib/auth.js';
let app,student,admin,classId,studyId;
const A=u=>({Authorization:`Bearer ${signToken(u)}`});
beforeAll(async()=>{
 execSync('node src/seed.js --force',{stdio:'ignore'});await initDb();app=createApp();
 student=db.prepare("SELECT * FROM users WHERE username='40012345'").get();
 admin=db.prepare("SELECT * FROM users WHERE username='admin'").get();
});
beforeEach(()=>{
 vi.clearAllMocks();
 db.prepare("UPDATE users SET status='active',token_ver=? WHERE id=?").run(student.token_ver,student.id);
 db.prepare('UPDATE cases SET active=1 WHERE id=1').run();
 studyId=db.prepare("INSERT INTO research_studies(title_en,active,consent_required) VALUES ('Interaction',1,1)").run().lastInsertRowid;
 classId=db.prepare('INSERT INTO classes(name_en,code,owner_id,university_id,max_attempts,study_id) VALUES (?,?,?,?,100,?)').run('Interaction',`interaction-${Math.random()}`,admin.id,student.university_id,studyId).lastInsertRowid;
 db.prepare('INSERT INTO class_members(class_id,user_id) VALUES (?,?)').run(classId,student.id);
 db.prepare('INSERT INTO class_cases(class_id,case_id) VALUES (?,1)').run(classId);
});
for(const kind of ['chat','order'])describe(`in-flight ${kind} access`,()=>{
 const call=()=>request(app).post(kind==='chat'?'/api/exam/patient-reply':'/api/exam/order').set(A(student)).send({caseId:1,classId,lang:'en',userText:'When did it start?',kind:'lab',query:'CBC'});
 const mock=()=>kind==='chat'?engine.patientReply:engine.labImagingResult;
 for(const change of ['pause','membership','account','token','case','study'])it(`does not release the pending result after ${change} changes`,async()=>{
  mock().mockImplementation(async()=>{
   if(change==='pause')expect((await request(app).post(`/api/research/studies/${studyId}/participation`).set(A(admin)).send({user_id:student.id,blocked:true,note:'Admin pause during request'})).status).toBe(200);
   if(change==='membership')db.prepare('DELETE FROM class_members WHERE class_id=? AND user_id=?').run(classId,student.id);
   if(change==='account')db.prepare("UPDATE users SET status='banned' WHERE id=?").run(student.id);
   if(change==='token')db.prepare('UPDATE users SET token_ver=token_ver+1 WHERE id=?').run(student.id);
   if(change==='case')db.prepare('UPDATE cases SET active=0 WHERE id=1').run();
   if(change==='study')db.prepare('UPDATE classes SET study_id=NULL WHERE id=?').run(classId);
   return {text:'PENDING_PRIVATE_RESULT',source:'llm'};
  });
  const r=await call();expect(r.status).toBe(change==='account'||change==='token'?401:change==='study'?409:change==='case'?404:403);
  expect(JSON.stringify(r.body)).not.toContain('PENDING_PRIVATE_RESULT');expect(mock()).toHaveBeenCalledTimes(1);
 });
 it('allows admin-managed participation without online consent and after a wording change',async()=>{
  mock().mockImplementation(async()=>{db.prepare("UPDATE research_studies SET consent_text_en='Changed' WHERE id=?").run(studyId);return {text:'Allowed result'};});
  const r=await call();expect(r.status).toBe(200);expect(r.body.text).toBe('Allowed result');
 });
 it('does not treat a withdrawal request as an admin pause',async()=>{
  mock().mockImplementation(async()=>{
   expect((await request(app).post('/api/research/consent/withdraw').set(A(student)).send({study_id:studyId})).status).toBe(202);
   return {text:'Still allowed'};
  });
  const r=await call();expect(r.status).toBe(200);expect(r.body.text).toBe('Still allowed');
 });
 it('pins the inferred class when the request omitted classId',async()=>{
  db.prepare('DELETE FROM class_members WHERE user_id=? AND class_id<>?').run(student.id,classId);
  mock().mockImplementation(async()=>{
   expect((await request(app).post(`/api/research/studies/${studyId}/participation`).set(A(admin)).send({user_id:student.id,blocked:true,note:'Pause inferred context'})).status).toBe(200);
   const other=db.prepare("INSERT INTO classes(name_en,code,owner_id,university_id,max_attempts) VALUES ('Other',?,?,?,1000)").run(`other-${Math.random()}`,admin.id,student.university_id).lastInsertRowid;
   db.prepare('INSERT INTO class_members(class_id,user_id) VALUES (?,?)').run(other,student.id);
   db.prepare('INSERT INTO class_cases(class_id,case_id) VALUES (?,1)').run(other);
   return {text:'Do not move this response to the new class'};
  });
  const r=await request(app).post(kind==='chat'?'/api/exam/patient-reply':'/api/exam/order').set(A(student)).send({caseId:1,userText:'When?',kind:'lab',query:'CBC'});
  expect(r.status).toBe(403);expect(r.body.reason).toBe('research_paused');expect(mock()).toHaveBeenCalledTimes(1);
 });
 it('delivers an on-time interaction even if a slow response passes the exam deadline',async()=>{
  const now=Date.now();
  const eid=db.prepare("INSERT INTO exams(title_en,case_ids,starts_at,ends_at,active,max_attempts) VALUES ('Interaction window','[1]',?,?,1,3)").run(new Date(now-60000).toISOString(),new Date(now+5000).toISOString()).lastInsertRowid;
  db.prepare('INSERT INTO exam_participants(exam_id,user_id) VALUES (?,?)').run(eid,student.id);
  mock().mockImplementation(async()=>{vi.spyOn(Date,'now').mockReturnValue(now+10000);return {text:'On-time request result'};});
  try {
   const r=await request(app).post(kind==='chat'?'/api/exam/patient-reply':'/api/exam/order').set(A(student)).send({caseId:1,examId:eid,userText:'When?',kind:'lab',query:'CBC'});
   expect(r.status).toBe(200);expect(r.body.text).toBe('On-time request result');
  } finally {vi.restoreAllMocks();}
 });

});
