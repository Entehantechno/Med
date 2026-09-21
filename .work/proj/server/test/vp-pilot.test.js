import {grantOnlineConsent,withdrawConsent} from '../src/lib/consent.js';
import fs from 'node:fs';
import {describe,it,expect,beforeAll,beforeEach,afterEach,vi} from 'vitest';
import {execSync} from 'node:child_process';
import request from 'supertest';
import {db,initDb} from '../src/db.js';
import {createApp} from '../src/app.js';
import {signToken} from '../src/lib/auth.js';
import {setSetting} from '../src/routes/content.js';
let app,users=[],classId;
const A=i=>({Authorization:`Bearer ${users[i].token}`});
const count=()=>db.prepare('SELECT COUNT(*) n FROM attempts WHERE class_id=?').get(classId).n;
const start=async(i=0,caseId=1)=>(await request(app).post('/api/exam/session-start').set(A(i)).send({caseId,classId})).body.sessionId;
const body=(i,sid,extra={})=>({caseId:1,classId,sessionId:sid,lang:'fa',durationSec:20,events:[{kind:'student_msg',atMs:1,text:`MARK-${i}`}],session:{messages:[{role:'student',text:`MARK-${i} سلام، درد از چه زمانی شروع شده؟`}],tests:[],imaging:[],ddx:[],problemList:[],finalDx:''},...extra});
const submit=(i,sid,extra={})=>request(app).post('/api/exam/evaluate').set(A(i)).send(body(i,sid,extra));
function provider(delay=0){
 vi.stubGlobal('fetch',vi.fn(async(url,init)=>{
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  const input=JSON.parse(init.body).messages.at(-1).content;
  const tag=input.match(/MARK-\d+/)?.[0]||'MARK-unknown';
  const rubric=input.startsWith('RUBRIC:')?JSON.parse(input.split('RUBRIC:\n')[1].split('\n\nAUTHORITATIVE_REFERENCE:')[0]):null;
  const output=rubric?{items:rubric.map(r=>({id:r.id,done:false,reason:`${tag}: شاهد کافی ثبت نشده است.`}))}:{strengths:[],weaknesses:[],missed:[],commonMistakes:[],suggestion:'تمرین با استاد',microlearning:`### یادگیری اختصاصی ${tag}\nزمان شروع درد و داروهای مصرفی را به شکل روشن بپرسید و پاسخ بیمار را دقیق ثبت کنید. سپس معیارهای جامانده را با استاد مرور کنید.`};
  return {ok:true,status:200,json:async()=>({choices:[{message:{content:JSON.stringify(output)}}]})};
 }));
}
beforeAll(async()=>{
 execSync('node src/seed.js --force',{stdio:'ignore'});await initDb();app=createApp();
 const template=db.prepare("SELECT * FROM users WHERE username='40012345'").get();
 for(let i=0;i<10;i++){
  const id=db.prepare("INSERT INTO users(username,password_hash,role,name_en,university_id) VALUES (?,?,'student',?,?)").run(`pilot-${i}`,template.password_hash,`Pilot ${i}`,template.university_id).lastInsertRowid;
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(id);users.push({...u,token:signToken(u)});
 }
});
beforeEach(()=>{
 vi.stubEnv('VP_REQUIRE_AI_EVALUATION','1');vi.stubEnv('AI_API_KEY','');
 setSetting('ai',{provider:'OpenRouter',model:'synthetic/model',apiKey:'synthetic-only'});setSetting('ai_vpatient',{});setSetting('exam',{showAiAnalysis:true,showMicro:true});
 const teacher=db.prepare("SELECT id,university_id FROM users WHERE username='teacher'").get();
 classId=db.prepare("INSERT INTO classes(name_en,code,owner_id,university_id,max_attempts,log_transcript) VALUES (?,?,?,?,100,1)").run('Pilot',`pilot-${Date.now()}-${Math.random()}`,teacher.id,teacher.university_id).lastInsertRowid;
 for(const u of users)db.prepare('INSERT INTO class_members(class_id,user_id) VALUES (?,?)').run(classId,u.id);
 for(const c of [1,2])db.prepare('INSERT INTO class_cases(class_id,case_id) VALUES (?,?)').run(classId,c);
 provider();
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('10-student pilot isolation and completion safety',()=>{
 it('refuses a foreign session before any model call or attempt insertion',async()=>{
  const sid=await start(1);const r=await submit(0,sid);
  expect(r.status).toBe(403);expect(count()).toBe(0);expect(fetch).not.toHaveBeenCalled();
 });
 it('refuses an unknown session before grading',async()=>{
  const r=await submit(0,999999);expect(r.status).toBe(404);expect(count()).toBe(0);expect(fetch).not.toHaveBeenCalled();
 });
 it('refuses an own session belonging to another case',async()=>{
  const sid=await start(0,2);const r=await submit(0,sid);expect(r.status).toBe(409);expect(count()).toBe(0);
 });
 it('replays one completed session without grading or consuming another attempt',async()=>{
  const sid=await start();const first=await submit(0,sid);expect(first.status).toBe(200);
  const calls=fetch.mock.calls.length;const second=await submit(0,sid);
  expect(second.status).toBe(200);expect(second.body.attemptId).toBe(first.body.attemptId);expect(count()).toBe(1);expect(fetch.mock.calls.length).toBe(calls);
 });
 it('prevents simultaneous duplicate completion from producing two grades',async()=>{
  const sid=await start();provider(30);
  const results=await Promise.all([submit(0,sid),submit(0,sid)]);
  expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect(count()).toBe(1);expect(fetch).toHaveBeenCalledTimes(2);
 });
 it('a late abandon cannot erase the completed attempt link or duplicate events',async()=>{
  const sid=await start();await submit(0,sid);
  const before=db.prepare('SELECT * FROM vp_sessions WHERE id=?').get(sid);
  await request(app).post('/api/exam/session-abandon').set(A(0)).send({sessionId:sid,events:body(0,sid).events});
  expect(db.prepare('SELECT * FROM vp_sessions WHERE id=?').get(sid)).toEqual(before);
  expect(db.prepare('SELECT COUNT(*) n FROM vp_session_events WHERE session_id=?').get(sid).n).toBe(1);
 });
 it('records final duration/logging metadata in the stored evaluation, not only the response',async()=>{
  const sid=await start();const r=await submit(0,sid);expect(r.status).toBe(200);
  const saved=JSON.parse(db.prepare('SELECT eval_json FROM attempts WHERE id=?').get(r.body.attemptId).eval_json);
  expect(saved.meta.durationSecRecorded).toBe(r.body.meta.durationSecRecorded);
 });
 it('runs seven synthetic rounds for ten students with isolated results and idempotent retries',async()=>{
  provider(5);
  const ids=new Set();
  for(let day=1;day<=7;day++){
   const sessions=await Promise.all(users.map((_,i)=>start(i)));
   const results=await Promise.all(sessions.map((sid,i)=>submit(i,sid)));
   for(let i=0;i<10;i++){
    const r=results[i];expect(r.status).toBe(200);expect(r.body.source).toBe('llm');expect(r.body.feedbackSource).toBe('llm');
    expect(r.body.microlearning).toContain(`MARK-${i}`);expect(r.body.meta.rubric).toBeUndefined();
    const attempt=db.prepare('SELECT * FROM attempts WHERE id=?').get(r.body.attemptId);
    expect(attempt.user_id).toBe(users[i].id);expect(attempt.transcript_json).toContain(`MARK-${i}`);
    const log=db.prepare('SELECT * FROM vp_sessions WHERE id=?').get(sessions[i]);
    expect(log.user_id).toBe(users[i].id);expect(log.attempt_id).toBe(r.body.attemptId);
    ids.add(r.body.attemptId);
   }
   const calls=fetch.mock.calls.length;
   const retries=await Promise.all(sessions.map((sid,i)=>submit(i,sid)));
   retries.forEach((r,i)=>{expect(r.status).toBe(200);expect(r.body.attemptId).toBe(results[i].body.attemptId);});
   expect(fetch.mock.calls.length).toBe(calls);
  }
  expect(ids.size).toBe(70);expect(count()).toBe(70);expect(fetch).toHaveBeenCalledTimes(140);
 },180_000);
 it('does not let different sessions exceed one student attempt budget',async()=>{
  db.prepare('UPDATE classes SET max_attempts=1 WHERE id=?').run(classId);
  const a=await start(),b=await start();provider(30);
  const results=await Promise.all([submit(0,a),submit(0,b)]);
  expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect(count()).toBe(1);
  const winner=results.find(r=>r.status===200).body.attemptId;
  const won=db.prepare('SELECT id FROM vp_sessions WHERE attempt_id=?').get(winner).id;
  expect((await submit(0,won)).body.attemptId).toBe(winner);
  expect((await submit(0,won===a?b:a)).status).toBe(403);
 });
 it('releases failed evaluation for retry and refuses abandon during grading',async()=>{
  const sid=await start();let signal,release;
  const entered=new Promise(resolve=>{signal=resolve;});
  vi.stubGlobal('fetch',vi.fn(async()=>{signal();await new Promise(resolve=>{release=resolve;});return {ok:false,status:429,text:async()=>''};}));
  const pending=submit(0,sid).then(r=>r);await entered;
  expect((await request(app).post('/api/exam/session-abandon').set(A(0)).send({sessionId:sid})).status).toBe(409);
  release();expect((await pending).status).toBe(503);expect(count()).toBe(0);
  provider();expect((await submit(0,sid)).status).toBe(200);expect(count()).toBe(1);
 });
 it('never reveals hidden feedback or rubric through a replay',async()=>{
  const sid=await start();const first=await submit(0,sid);expect(first.status).toBe(200);
  setSetting('exam',{showAiAnalysis:false,showMicro:false});
  const r=await submit(0,sid);expect(r.status).toBe(200);expect(r.body.results).toEqual([]);
  expect(r.body.microlearning).toBe('');expect(r.body.meta.rubric).toBeUndefined();expect(r.body.sectionScores).toBeUndefined();
 });
 it('rejects a closed abandoned session and a missing session in production student grading',async()=>{
  const sid=await start();await request(app).post('/api/exam/session-abandon').set(A(0)).send({sessionId:sid});
  expect((await submit(0,sid)).status).toBe(409);expect((await submit(0,null)).status).toBe(400);expect(count()).toBe(0);
 });

 it('rolls back the grade if storing its session events fails',async()=>{
  const sid=await start();
  db.exec(`CREATE TEMP TRIGGER pilot_log_failure BEFORE INSERT ON vp_session_events WHEN NEW.session_id=${sid} BEGIN SELECT RAISE(ABORT,'synthetic event storage failure'); END;`);
  try {
   expect((await submit(0,sid)).status).toBe(500);expect(count()).toBe(0);
   expect(db.prepare('SELECT attempt_id FROM vp_sessions WHERE id=?').get(sid).attempt_id).toBeNull();
  } finally {db.exec('DROP TRIGGER pilot_log_failure');}
  expect((await submit(0,sid)).status).toBe(200);expect(count()).toBe(1);
 });
 it('does not acknowledge durable success on disk failure; retry persists one result without regrading',async()=>{
  const sid=await start();const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  const rename=vi.spyOn(fs,'renameSync').mockImplementation(()=>{throw new Error('synthetic disk failure');});
  const failed=await submit(0,sid);
  rename.mockRestore();log.mockRestore();
  expect(failed.status).toBe(500);
  const calls=fetch.mock.calls.length;
  const recovered=await submit(0,sid);expect(recovered.status).toBe(200);expect(count()).toBe(1);
  expect(fetch.mock.calls.length).toBe(calls);
 });

 it('retries a lost session-start response without opening another session',async()=>{
  const payload={caseId:1,classId,requestId:'pilot-start-retry'};
  const a=await request(app).post('/api/exam/session-start').set(A(0)).send(payload);
  const b=await request(app).post('/api/exam/session-start').set(A(0)).send(payload);
  expect(a.status).toBe(200);expect(b.status).toBe(200);expect(b.body.sessionId).toBe(a.body.sessionId);
 });
 it('rejects reuse of a session-start request ID for another case',async()=>{
  await request(app).post('/api/exam/session-start').set(A(0)).send({caseId:1,classId,requestId:'pilot-start-context'});
  const r=await request(app).post('/api/exam/session-start').set(A(0)).send({caseId:2,classId,requestId:'pilot-start-context'});
  expect(r.status).toBe(409);
 });
 for(const mode of ['consent','membership','account','visibility']) it(`rechecks ${mode} after AI returns`,async()=>{
  let study;
  if(mode==='consent'){
   study=db.prepare("INSERT INTO research_studies(title_en,active,consent_required,consent_text_en,consent_admin_managed) VALUES ('Pilot',1,1,'Synthetic informed consent text',0)").run().lastInsertRowid;
   db.prepare('UPDATE classes SET study_id=? WHERE id=?').run(study,classId);
   expect(grantOnlineConsent(users[0],study).ok).toBe(true);
  }
  const sid=await start();const fake=fetch;let entered,release;const ready=new Promise(resolve=>{entered=resolve;});let first=true;
  vi.stubGlobal('fetch',vi.fn(async(...args)=>{if(first){first=false;entered();await new Promise(resolve=>{release=resolve;});}return fake(...args);}));
  const pending=submit(0,sid).then(r=>r);await ready;
  if(mode==='consent')withdrawConsent(users[0],study);
  if(mode==='membership')db.prepare('DELETE FROM class_members WHERE class_id=? AND user_id=?').run(classId,users[0].id);
  if(mode==='account')db.prepare("UPDATE users SET status='banned' WHERE id=?").run(users[0].id);
  if(mode==='visibility')setSetting('exam',{showAiAnalysis:false,showMicro:false});
  release();const r=await pending;
  if(mode==='account')db.prepare("UPDATE users SET status='active' WHERE id=?").run(users[0].id);
  if(mode==='visibility'){
   expect(r.status).toBe(200);expect(r.body.showAi).toBe(false);expect(r.body.microlearning).toBe('');expect(r.body.results).toEqual([]);
  }else{
   expect(r.status).toBe(mode==='account'?401:403);expect(count()).toBe(0);
   expect(db.prepare('SELECT COUNT(*) n FROM vp_session_events WHERE session_id=?').get(sid).n).toBe(0);
  }
 });

 it('keeps start request IDs isolated between students and validates them',async()=>{
  const payload={caseId:1,classId,requestId:'shared-client-request'};
  const a=await request(app).post('/api/exam/session-start').set(A(0)).send(payload);
  const b=await request(app).post('/api/exam/session-start').set(A(1)).send(payload);
  expect(a.status).toBe(200);expect(b.status).toBe(200);expect(a.body.sessionId).not.toBe(b.body.sessionId);
  const bad=await request(app).post('/api/exam/session-start').set(A(0)).send({...payload,requestId:{bad:true}});
  expect(bad.status).toBe(400);
 });
 it('accepts an on-time exam submission despite slow AI passing the closing time',async()=>{
  const now=Date.now();
  const eid=db.prepare("INSERT INTO exams(title_en,case_ids,starts_at,ends_at,active,max_attempts,show_ai,show_micro) VALUES ('Timed pilot','[1]',?,?,1,1,1,1)").run(new Date(now-60000).toISOString(),new Date(now+5000).toISOString()).lastInsertRowid;
  db.prepare('INSERT INTO exam_participants(exam_id,user_id) VALUES (?,?)').run(eid,users[0].id);
  const started=await request(app).post('/api/exam/session-start').set(A(0)).send({caseId:1,examId:eid});expect(started.status).toBe(200);
  const fake=fetch;vi.stubGlobal('fetch',vi.fn(async(...args)=>{vi.spyOn(Date,'now').mockReturnValue(now+10000);return fake(...args);}));
  const r=await submit(0,started.body.sessionId,{classId:null,examId:eid});expect(r.status).toBe(200);
  const late=await request(app).post('/api/exam/session-start').set(A(0)).send({caseId:1,examId:eid});expect(late.status).toBe(403);
 });

 it('does not ingest a late abandon transcript after consent withdrawal',async()=>{
  const study=db.prepare("INSERT INTO research_studies(title_en,active,consent_required,consent_text_en,consent_admin_managed) VALUES ('Privacy pilot',1,1,'Initial consent wording',0)").run().lastInsertRowid;
  db.prepare('UPDATE classes SET study_id=? WHERE id=?').run(study,classId);
  expect(grantOnlineConsent(users[0],study).ok).toBe(true);
  const sid=await start();withdrawConsent(users[0],study);
  const r=await request(app).post('/api/exam/session-abandon').set(A(0)).send({sessionId:sid,events:body(0,sid).events});
  expect(r.status).toBe(403);expect(r.body.reason).toBe('consent_withdrawn');
  expect(db.prepare('SELECT COUNT(*) n FROM vp_session_events WHERE session_id=?').get(sid).n).toBe(0);
 });
 it('keeps wording changes informational rather than requiring renewed consent',async()=>{
  const study=db.prepare("INSERT INTO research_studies(title_en,active,consent_required,consent_text_en,consent_admin_managed) VALUES ('Privacy pilot',1,1,'Initial consent wording',0)").run().lastInsertRowid;
  db.prepare('UPDATE classes SET study_id=? WHERE id=?').run(study,classId);grantOnlineConsent(users[0],study);
  db.prepare("UPDATE research_studies SET consent_text_en='Revised consent wording' WHERE id=?").run(study);
  const r=await request(app).post('/api/exam/session-start').set(A(0)).send({caseId:1,classId});
  expect(r.status).toBe(200);
  grantOnlineConsent(users[0],study);
  expect((await request(app).post('/api/exam/session-start').set(A(0)).send({caseId:1,classId})).status).toBe(200);
 });
 it('does not relabel an existing session after its class is moved to another study',async()=>{
  const sid=await start();
  const study=db.prepare("INSERT INTO research_studies(title_en,active,consent_required) VALUES ('Other protocol',1,0)").run().lastInsertRowid;
  db.prepare('UPDATE classes SET study_id=? WHERE id=?').run(study,classId);
  const r=await submit(0,sid);expect(r.status).toBe(409);expect(r.body.error).toBe('study_context_changed');
  expect(count()).toBe(0);expect(fetch).not.toHaveBeenCalled();
 });
 it('rolls back every abandon event if one event insert fails',async()=>{
  const sid=await start();const events=[...body(0,sid).events,{kind:'patient_msg',text:'Second event',atMs:2}];
  db.exec(`CREATE TEMP TRIGGER abandon_log_failure BEFORE INSERT ON vp_session_events WHEN NEW.session_id=${sid} AND NEW.seq=1 BEGIN SELECT RAISE(ABORT,'synthetic event failure'); END;`);
  try {
   const r=await request(app).post('/api/exam/session-abandon').set(A(0)).send({sessionId:sid,events});
   expect(r.status).toBe(500);expect(db.prepare('SELECT COUNT(*) n FROM vp_session_events WHERE session_id=?').get(sid).n).toBe(0);
  }finally{db.exec('DROP TRIGGER abandon_log_failure');}
  expect((await request(app).post('/api/exam/session-abandon').set(A(0)).send({sessionId:sid,events})).status).toBe(200);
  expect(db.prepare('SELECT COUNT(*) n FROM vp_session_events WHERE session_id=?').get(sid).n).toBe(2);
 });
 it('does not acknowledge an abandoned-session save when the disk write failed',async()=>{
  const sid=await start();const events=body(0,sid).events;
  const quiet=vi.spyOn(console,'error').mockImplementation(()=>{});
  const disk=vi.spyOn(fs,'renameSync').mockImplementation(()=>{throw new Error('synthetic disk failure');});
  const r=await request(app).post('/api/exam/session-abandon').set(A(0)).send({sessionId:sid,events});
  disk.mockRestore();quiet.mockRestore();expect(r.status).toBe(500);
  expect((await request(app).post('/api/exam/session-abandon').set(A(0)).send({sessionId:sid,events})).status).toBe(200);
  expect(db.prepare('SELECT COUNT(*) n FROM vp_session_events WHERE session_id=?').get(sid).n).toBe(1);
 });

 it('does not interrupt grading merely because the protocol wording changes',async()=>{
  const study=db.prepare("INSERT INTO research_studies(title_en,active,consent_required,consent_text_en,consent_admin_managed) VALUES ('Protocol pilot',1,1,'Original wording',0)").run().lastInsertRowid;
  db.prepare('UPDATE classes SET study_id=? WHERE id=?').run(study,classId);grantOnlineConsent(users[0],study);
  const sid=await start();const original=fetch.getMockImplementation();
  fetch.mockImplementation(async(...args)=>{const answer=await original(...args);db.prepare("UPDATE research_studies SET protocol_version='v2' WHERE id=?").run(study);return answer;});
  const r=await submit(0,sid);expect(r.status).toBe(200);expect(count()).toBe(1);
  expect(db.prepare('SELECT COUNT(*) n FROM vp_session_events WHERE session_id=?').get(sid).n).toBe(1);
 });
 it('blocks abandon after a study move without relabeling or logging the old encounter',async()=>{
  const sid=await start();const study=db.prepare("INSERT INTO research_studies(title_en,active,consent_required) VALUES ('Moved study',1,0)").run().lastInsertRowid;
  db.prepare('UPDATE classes SET study_id=? WHERE id=?').run(study,classId);
  const r=await request(app).post('/api/exam/session-abandon').set(A(0)).send({sessionId:sid,events:body(0,sid).events});
  expect(r.status).toBe(409);expect(r.body.error).toBe('study_context_changed');
  expect(db.prepare('SELECT COUNT(*) n FROM vp_session_events WHERE session_id=?').get(sid).n).toBe(0);
 });

 it('honors an explicit admin pause during AI without storing the pending grade',async()=>{
  const study=db.prepare("INSERT INTO research_studies(title_en,active,consent_required) VALUES ('Admin pilot',1,1)").run().lastInsertRowid;
  db.prepare('UPDATE classes SET study_id=? WHERE id=?').run(study,classId);
  const sid=await start();const original=fetch.getMockImplementation();
  const admin=db.prepare("SELECT * FROM users WHERE username='admin'").get();
  fetch.mockImplementation(async(...args)=>{const answer=await original(...args);
   const decision=await request(app).post(`/api/research/studies/${study}/participation`).set({Authorization:`Bearer ${signToken(admin)}`}).send({user_id:users[0].id,blocked:true,note:'In-person withdrawal during encounter'});
   expect(decision.status).toBe(200);return answer;
  });
  const r=await submit(0,sid);expect(r.status).toBe(403);expect(r.body.reason).toBe('research_paused');expect(count()).toBe(0);
  expect(db.prepare('SELECT COUNT(*) n FROM vp_session_events WHERE session_id=?').get(sid).n).toBe(0);
 });
 it('preserves completed results through admin pause/resume and replays without another AI call',async()=>{
  const study=db.prepare("INSERT INTO research_studies(title_en,active,consent_required) VALUES ('Admin replay',1,1)").run().lastInsertRowid;
  db.prepare('UPDATE classes SET study_id=? WHERE id=?').run(study,classId);
  const sid=await start();const first=await submit(0,sid);expect(first.status).toBe(200);
  const calls=fetch.mock.calls.length;const admin=db.prepare("SELECT * FROM users WHERE username='admin'").get();
  const control=blocked=>request(app).post(`/api/research/studies/${study}/participation`).set({Authorization:`Bearer ${signToken(admin)}`}).send({user_id:users[0].id,blocked,note:'Admin decision'});
  await control(true);expect((await submit(0,sid)).status).toBe(403);expect(count()).toBe(1);
  await control(false);const replay=await submit(0,sid);expect(replay.status).toBe(200);expect(replay.body.attemptId).toBe(first.body.attemptId);
  expect(fetch.mock.calls.length).toBe(calls);expect(count()).toBe(1);
 });

 it('reuses valid AI checklist judgments when only teaching failed on the previous submission',async()=>{
  const sid=await start();const original=fetch.getMockImplementation();let lessons=0;
  fetch.mockImplementation(async(...args)=>{
   const input=JSON.parse(args[1].body).messages.at(-1).content;
   if(!input.startsWith('RUBRIC:')&&++lessons===1)return {ok:true,status:200,json:async()=>({choices:[{message:{content:'{"microlearning":""}'}}]})};
   return original(...args);
  });
  const first=await submit(0,sid);expect(first.status).toBe(503);expect(first.body.aiStage).toBe('lesson');expect(count()).toBe(0);
  const retry=await submit(0,sid);expect(retry.status).toBe(200);expect(count()).toBe(1);
  expect(fetch).toHaveBeenCalledTimes(3);
 });
 it('returns a safe actionable quota diagnosis rather than only a generic evaluation error',async()=>{
  const sid=await start();fetch.mockResolvedValue({ok:false,status:429,text:async()=> 'PRIVATE PROVIDER BODY'});
  const r=await submit(0,sid);expect(r.status).toBe(503);expect(r.body.failureCode).toBe('rate_limit');
  expect(JSON.stringify(r.body)).not.toContain('PRIVATE');expect(count()).toBe(0);
 });

 for(const changed of ['transcript','rubric','model']) it(`re-grades a retry when ${changed} changed`,async()=>{
  const sid=await start();const original=fetch.getMockImplementation();let failLesson=true;
  fetch.mockImplementation(async(...args)=>{
   const input=JSON.parse(args[1].body).messages.at(-1).content;
   if(!input.startsWith('RUBRIC:')&&failLesson)return {ok:true,status:200,json:async()=>({choices:[{message:{content:'{}'}}]})};
   return original(...args);
  });
  expect((await submit(0,sid)).status).toBe(503);failLesson=false;
  if(changed==='model')setSetting('ai',{provider:'OpenRouter',model:'synthetic/changed',apiKey:'synthetic-only'});
  if(changed==='rubric')db.prepare("UPDATE classes SET grading_role='history' WHERE id=?").run(classId);
  const extra=changed==='transcript'?{session:{...body(0,sid).session,finalDx:'Changed answer'}}:{};
  expect((await submit(0,sid,extra)).status).toBe(200);expect(fetch).toHaveBeenCalledTimes(4);
 });

});
