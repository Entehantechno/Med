import {beforeAll,beforeEach,describe,it,expect} from 'vitest';
import {execSync} from 'node:child_process';
import request from 'supertest';
import {initDb,db} from '../src/db.js';
import {createApp} from '../src/app.js';
import {signToken} from '../src/lib/auth.js';
let app,admin,teacher,student,study,cid;
const A=u=>({Authorization:`Bearer ${signToken(u)}`});
const start=()=>request(app).post('/api/exam/session-start').set(A(student)).send({caseId:1,classId:cid});
const decide=(blocked,user=admin,patch={})=>request(app).post(`/api/research/studies/${study.id}/participation`).set(A(user)).send({user_id:student.id,blocked,note:'In-person decision',...patch});
const abandon=sid=>request(app).post('/api/exam/session-abandon').set(A(student)).send({sessionId:sid,events:[{kind:'student_msg',text:'Recorded conversation',atMs:1}]});
beforeAll(async()=>{
 execSync('node src/seed.js --force',{stdio:'ignore'});await initDb();app=createApp();
 admin=db.prepare("SELECT * FROM users WHERE username='admin'").get();
 teacher=db.prepare("SELECT * FROM users WHERE username='teacher'").get();
 student=db.prepare("SELECT * FROM users WHERE username='40012345'").get();
});
beforeEach(async()=>{
 const r=await request(app).post('/api/research/studies').set(A(admin)).send({title_en:'Admin policy',active:true,consent_required:true});
 expect(r.status).toBe(200);study=r.body;
 cid=db.prepare('INSERT INTO classes(name_en,code,owner_id,university_id,max_attempts,log_transcript,study_id) VALUES (?,?,?,?,100,1,?)').run('Policy',`policy-${Math.random()}`,teacher.id,student.university_id,study.id).lastInsertRowid;
 db.prepare('INSERT INTO class_members(class_id,user_id) VALUES (?,?)').run(cid,student.id);
 db.prepare('INSERT INTO class_cases(class_id,case_id) VALUES (?,1)').run(cid);
});
describe('admin-controlled research collection',()=>{
 it('defaults to admin management and logs without any online confirmation or wording',async()=>{
  expect(study.consent_admin_managed).toBe(true);
  const status=await request(app).get(`/api/research/consent/status?classId=${cid}`).set(A(student));
  expect(status.body.required).toBe(false);expect(status.body.granted).toBe(true);
  const r=await start();expect(r.status).toBe(200);expect((await abandon(r.body.sessionId)).body.stored).toBe(1);
  expect(db.prepare('SELECT COUNT(*) n FROM research_consents WHERE study_id=?').get(study.id).n).toBe(0);
 });
 it.each(['paper','verbal'])('records %s evidence and does not block when the protocol changes',async mode=>{
  const r=await request(app).post(`/api/research/studies/${study.id}/consents/record`).set(A(admin)).send({user_id:student.id,mode,note:'Ward, form 12'});
  expect(r.status).toBe(200);
  await request(app).put(`/api/research/studies/${study.id}`).set(A(admin)).send({protocol_version:'v2',consent_text_fa:'New text'});
  expect((await start()).status).toBe(200);
  const row=db.prepare('SELECT * FROM research_consents WHERE study_id=? AND user_id=?').get(study.id,student.id);
  expect(row.mode).toBe(mode);expect(row.recorded_by).toBe(admin.id);expect(row.protocol_version).toBe('');
 });
 it('records a student withdrawal request but keeps logging until admin decides',async()=>{
  const sid=(await start()).body.sessionId;
  const r=await request(app).post('/api/research/consent/withdraw').set(A(student)).send({study_id:study.id,note:'Please contact me'});
  expect(r.status).toBe(202);expect(r.body.status).toBe('pending_admin');expect(r.body.collectionPaused).toBe(false);
  expect((await abandon(sid)).body.stored).toBe(1);
  expect(db.prepare("SELECT COUNT(*) n FROM research_events WHERE study_id=? AND event_type='withdrawal_requested'").get(study.id).n).toBe(1);
 });
 it('admin can pause without a consent record, block late logging, then resume',async()=>{
  const sid=(await start()).body.sessionId;
  expect((await decide(true)).status).toBe(200);
  const blocked=await abandon(sid);expect(blocked.status).toBe(403);expect(blocked.body.reason).toBe('research_paused');
  expect((await start()).status).toBe(403);
  expect(db.prepare('SELECT COUNT(*) n FROM vp_session_events WHERE session_id=?').get(sid).n).toBe(0);
  expect((await decide(false)).status).toBe(200);expect((await abandon(sid)).body.stored).toBe(1);
  const roster=await request(app).get(`/api/research/studies/${study.id}/consents`).set(A(admin));
  expect(roster.body.participationControls[0]).toMatchObject({blocked:0,recorded_by:admin.id});
  expect(db.prepare("SELECT COUNT(*) n FROM research_events WHERE study_id=? AND event_type IN ('participation_paused','participation_resumed')").get(study.id).n).toBe(2);
 });
 it('students and teachers cannot pause or resume participants',async()=>{
  expect((await decide(true,student)).status).toBe(403);expect((await decide(true,teacher)).status).toBe(403);
  expect((await decide(true,admin,{note:''})).status).toBe(400);
  expect((await decide(true,admin,{user_id:999999})).status).toBe(400);
 });
 it('only admin can turn on the optional online gate',async()=>{
  expect((await request(app).put(`/api/research/studies/${study.id}`).set(A(teacher)).send({consent_admin_managed:false})).status).toBe(403);
  expect((await request(app).put(`/api/research/studies/${study.id}`).set(A(admin)).send({consent_admin_managed:false,consent_text_en:'Terms'})).status).toBe(200);
  expect((await start()).status).toBe(403);
  expect((await request(app).post('/api/research/consent').set(A(student)).send({study_id:study.id})).status).toBe(200);
  expect((await start()).status).toBe(200);
 });
 it('neither offline consent nor policy/text changes override an admin hold',async()=>{
  await decide(true);
  expect((await request(app).post(`/api/research/studies/${study.id}/consents/record`).set(A(admin)).send({user_id:student.id,mode:'verbal',note:'Evidence only'})).status).toBe(200);
  await request(app).put(`/api/research/studies/${study.id}`).set(A(admin)).send({consent_required:false,active:false,protocol_version:'new'});
  expect((await start()).body.reason).toBe('research_paused');
 });
 it('legacy withdrawn consent evidence does not automatically block admin-managed collection',async()=>{
  db.prepare("INSERT INTO research_consents(study_id,user_id,status,mode) VALUES (?,?,'withdrawn','paper')").run(study.id,student.id);
  const sid=(await start()).body.sessionId;expect(sid).toBeTruthy();expect((await abandon(sid)).body.stored).toBe(1);
  expect(db.prepare('SELECT status FROM research_consents WHERE study_id=?').get(study.id).status).toBe('withdrawn');
 });
 it('direct research event collection follows the same admin hold policy',async()=>{
  const event=()=>request(app).post('/api/research/event').set(A(student)).send({study_id:study.id,event_type:'session_finished',context_type:'study'});
  expect((await event()).status).toBe(200);await decide(true);expect((await event()).status).toBe(403);
 });
});
