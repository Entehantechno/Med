import {beforeAll,afterEach,it,expect,vi} from 'vitest';
import {execFileSync} from 'node:child_process';
import request from 'supertest';
import {initDb,db,persistNow,reloadDb,initSchema} from '../src/db.js';
import {createApp} from '../src/app.js';
import {setSetting} from '../src/routes/content.js';
let app,teacher,student;
const auth=token=>({Authorization:`Bearer ${token}`});
beforeAll(async()=>{execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();app=createApp();teacher=(await request(app).post('/api/auth/login').send({username:'teacher',password:'demo'})).body.token;student=(await request(app).post('/api/auth/login').send({username:'40012345',password:'demo'})).body.token;setSetting('ai',{apiKey:''});setSetting('ai_vpatient',{});},60000);
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
async function encounter(extra={},startExtra={}) {
 const created=await request(app).post('/api/cases').set(auth(teacher)).send({title_en:'Snapshot fixture',age:43,chief_en:'Original complaint',meds_en:'Original private medication',diagnosis_en:'Private diagnosis',checklist_id:1,labResults:[{name_en:'CBC',result_en:'Original CBC'}],...extra});
 expect(created.status).toBe(200);const caseId=created.body.id;
 const uid=db.prepare("SELECT id FROM users WHERE username='40012345'").get().id;
 expect((await request(app).put(`/api/assignments/${uid}`).set(auth(teacher)).send({caseIds:[caseId],maxAttempts:3})).status).toBe(200);
 const body={caseId,lang:'en',requestId:`r10-${caseId}-start`,...startExtra};
 const opened=await request(app).post('/api/exam/session-start').set(auth(student)).send(body);expect(opened.status).toBe(200);
 return {caseId,sessionId:opened.body.sessionId,opened:opened.body,body};
}
const order=e=>request(app).post('/api/exam/order').set(auth(student)).send({caseId:e.caseId,sessionId:e.sessionId,kind:'lab',query:'CBC',lang:'en'});
const evaluate=e=>request(app).post('/api/exam/evaluate').set(auth(student)).send({caseId:e.caseId,sessionId:e.sessionId,lang:'en',session:{messages:[],tests:['CBC'],ddx:[],problemList:[]}});
it('keeps the medication chart seen at encounter start after a teacher edit',async()=>{
 const e=await encounter();
 expect((await request(app).put(`/api/cases/${e.caseId}`).set(auth(teacher)).send({meds_en:'Changed medication note'})).status).toBe(200);
 const reply=await request(app).post('/api/exam/patient-reply').set(auth(student)).send({caseId:e.caseId,sessionId:e.sessionId,lang:'en',userText:'What medications do you take?'});
 expect(reply.status).toBe(200);expect(reply.body.text).toContain('Original private medication');expect(reply.body.text).not.toContain('Changed medication note');
});
it('returns a safe pinned card and replays the same snapshot after edits and reload',async()=>{
 const e=await encounter();const raw=db.prepare('SELECT encounter_snapshot_json FROM vp_sessions WHERE id=?').get(e.sessionId).encounter_snapshot_json;
 for(const forbidden of ['Original private medication','Private diagnosis','Original CBC','checklist','gradingRubric','snapshot_json'])expect(JSON.stringify(e.opened)).not.toContain(forbidden);
 expect(e.opened.caseCard.age).toBe(43);
 expect((await request(app).put(`/api/cases/${e.caseId}`).set(auth(teacher)).send({age:65,labResults:[{name_en:'CBC',result_en:'Changed CBC'}]})).status).toBe(200);
 persistNow();await reloadDb();initSchema();initSchema();
 const replay=await request(app).post('/api/exam/session-start').set(auth(student)).send(e.body);
 expect(replay.status).toBe(200);expect(replay.body.sessionId).toBe(e.sessionId);expect(replay.body.caseCard.age).toBe(43);
 expect(db.prepare('SELECT encounter_snapshot_json FROM vp_sessions WHERE id=?').get(e.sessionId).encounter_snapshot_json).toBe(raw);
 const first=await order(e);expect(first.status).toBe(200);expect(first.body.text).toContain('Original CBC');
 const fresh=await request(app).post('/api/exam/session-start').set(auth(student)).send({...e.body,requestId:`r10-${e.caseId}-new`});expect(fresh.status).toBe(200);expect(fresh.body.caseCard.age).toBe(65);
 expect((await order({...e,sessionId:fresh.body.sessionId})).body.text).toContain('Changed CBC');
});
it('uses the original checklist after live edits and preserves historical result replay',async()=>{
 const oldItem={id:'r10-original-item',label_en:'Original criterion',section:'history',weight:2,keywords_en:['onset']};
 const checklist=await request(app).post('/api/checklists').set(auth(teacher)).send({name_en:'R10 rubric',items:[oldItem]});expect(checklist.status).toBe(200);
 const e=await encounter({checklist_id:checklist.body.id});
 expect((await request(app).put(`/api/checklists/${checklist.body.id}`).set(auth(teacher)).send({name_en:'Changed rubric',items:[{...oldItem,id:'changed-item',weight:9}]})).status).toBe(200);
 const result=await evaluate(e);expect(result.status).toBe(200);expect(result.body.results.map(r=>r.id)).toContain('r10-original-item');expect(result.body.results.map(r=>r.id)).not.toContain('changed-item');
 const replay=await evaluate(e);expect(replay.status).toBe(200);expect(replay.body.attemptId).toBe(result.body.attemptId);
 db.prepare('UPDATE vp_sessions SET encounter_snapshot_json=NULL WHERE id=?').run(e.sessionId);
 const historical=await evaluate(e);expect(historical.status).toBe(200);expect(historical.body.attemptId).toBe(result.body.attemptId);
});
it('pins class grading scope rather than applying a later role change',async()=>{
 const e=await encounter();
 db.prepare('INSERT OR IGNORE INTO class_cases(class_id,case_id,weight) VALUES (1,?,1)').run(e.caseId);
 const uid=db.prepare("SELECT id FROM users WHERE username='40012345'").get().id;
 db.prepare('INSERT OR IGNORE INTO class_members(class_id,user_id) VALUES (1,?)').run(uid);
 const old=db.prepare('SELECT grading_role FROM classes WHERE id=1').get().grading_role;
 try {
  db.prepare("UPDATE classes SET grading_role='history' WHERE id=1").run();
  const opened=await request(app).post('/api/exam/session-start').set(auth(student)).send({caseId:e.caseId,classId:1,lang:'en'});expect(opened.status).toBe(200);expect(opened.body.gradingScope).toBe('extern');
  db.prepare("UPDATE classes SET grading_role='overall' WHERE id=1").run();
  const result=await evaluate({...e,sessionId:opened.body.sessionId});expect(result.status).toBe(200);expect(result.body.meta.gradingScope).toBe('extern');
 } finally {db.prepare('UPDATE classes SET grading_role=? WHERE id=1').run(old);}
});
it.each(['missing','tampered'])('refuses an unfinished %s snapshot without consuming attempts',async kind=>{
 const e=await encounter();
 if(kind==='missing')db.prepare('UPDATE vp_sessions SET encounter_snapshot_json=NULL WHERE id=?').run(e.sessionId);
 else {const row=db.prepare('SELECT encounter_snapshot_json FROM vp_sessions WHERE id=?').get(e.sessionId);const data=JSON.parse(row.encounter_snapshot_json);data.caseData.meds_en='Tampered';db.prepare('UPDATE vp_sessions SET encounter_snapshot_json=? WHERE id=?').run(JSON.stringify(data),e.sessionId);}
 const n=db.prepare('SELECT COUNT(*) n FROM attempts').get().n;
 for(const r of [await order(e),await evaluate(e)]){expect(r.status).toBe(409);expect(r.body.error).toBe(`encounter_snapshot_${kind==='missing'?'missing':'invalid'}`);}
 expect(db.prepare('SELECT COUNT(*) n FROM attempts').get().n).toBe(n);
});
it('rejects another student, different case, and different class',async()=>{
 const e=await encounter();const other=(await request(app).post('/api/auth/login').send({username:'40067890',password:'demo'})).body.token;
 const body={caseId:e.caseId,sessionId:e.sessionId,lang:'en',userText:'What medications?'};
 expect((await request(app).post('/api/exam/patient-reply').set(auth(other)).send(body)).status).toBe(403);
 for(const patch of [{caseId:1},{classId:999}])expect((await request(app).post('/api/exam/patient-reply').set(auth(student)).send({...body,...patch})).status).toBe(409);
});
it('requires a session for production student interactions',async()=>{
 const e=await encounter();vi.stubEnv('VP_REQUIRE_AI_EVALUATION','1');
 for(const endpoint of ['patient-reply','order']){
  const r=await request(app).post(`/api/exam/${endpoint}`).set(auth(student)).send({caseId:e.caseId,lang:'en',userText:'What medications?',query:'CBC',kind:'lab'});
  expect(r.status).toBe(400);expect(r.body.error).toBe('session_id_required');
 }
});
it('does not let snapshots bypass assignment revocation or archival',async()=>{
 const e=await encounter();const uid=db.prepare("SELECT id FROM users WHERE username='40012345'").get().id;
 db.prepare('UPDATE exam_assignments SET active=0 WHERE user_id=? AND case_id=?').run(uid,e.caseId);expect((await order(e)).status).toBe(403);
 db.prepare('UPDATE exam_assignments SET active=1 WHERE user_id=? AND case_id=?').run(uid,e.caseId);
 expect((await request(app).delete(`/api/cases/${e.caseId}`).set(auth(teacher))).status).toBe(200);expect((await order(e)).status).toBe(404);
});
it('refuses interactions and start replay after abandonment',async()=>{
 const e=await encounter();expect((await request(app).post('/api/exam/session-abandon').set(auth(student)).send({sessionId:e.sessionId})).status).toBe(200);
 expect((await order(e)).body.error).toBe('session_closed');expect((await request(app).post('/api/exam/session-start').set(auth(student)).send(e.body)).body.error).toBe('session_closed');
});
it('rejects a late provider response after the session closes',async()=>{
 const e=await encounter();setSetting('ai',{provider:'OpenRouter',model:'synthetic/r10',apiKey:'synthetic-test-key'});
 vi.stubGlobal('fetch',vi.fn(async()=>{
  db.prepare("UPDATE vp_sessions SET finished_at=datetime('now') WHERE id=?").run(e.sessionId);
  return {ok:true,status:200,json:async()=>({choices:[{message:{content:'Synthetic normal report'}}]})};
 }));
 try {
  const result=await request(app).post('/api/exam/order').set(auth(student)).send({caseId:e.caseId,sessionId:e.sessionId,kind:'lab',query:'Troponin',lang:'en'});
  expect(result.status).toBe(409);expect(result.body.error).toBe('session_closed');expect(result.body.text).toBeUndefined();
 } finally {setSetting('ai',{apiKey:''});}
});
it('pins grading weights, not just the class role name',async()=>{
 const rubric={roles:{intern:{sections:['history','exam'],weightMode:'sections',sectionWeights:{history:1,exam:1}}}};
 setSetting('vp_grading',rubric);
 const checklist=await request(app).post('/api/checklists').set(auth(teacher)).send({name_en:'Weight test',items:[{id:'r10-h',label_en:'History',section:'history',weight:1},{id:'r10-e',label_en:'Exam',section:'exam',weight:1}]});
 expect(checklist.status).toBe(200);
 const e=await encounter({checklist_id:checklist.body.id});
 const uid=db.prepare("SELECT id FROM users WHERE username='40012345'").get().id;
 db.prepare('INSERT OR IGNORE INTO class_cases(class_id,case_id,weight) VALUES(1,?,1)').run(e.caseId);
 db.prepare('INSERT OR IGNORE INTO class_members(class_id,user_id) VALUES(1,?)').run(uid);
 const old=db.prepare('SELECT grading_role,grading_json FROM classes WHERE id=1').get();
 db.prepare("UPDATE classes SET grading_role='overall',grading_json=NULL WHERE id=1").run();
 try {
  const opened=await request(app).post('/api/exam/session-start').set(auth(student)).send({caseId:e.caseId,classId:1,lang:'en'});expect(opened.status).toBe(200);
  setSetting('vp_grading',{roles:{intern:{sections:['history','exam'],weightMode:'sections',sectionWeights:{history:9,exam:1}}}});
  setSetting('ai',{provider:'OpenRouter',model:'synthetic/r10',apiKey:'synthetic-test-key'});
  vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{
   const prompt=JSON.parse(init.body).messages.at(-1).content;
   const content=prompt.startsWith('RUBRIC:')?{items:JSON.parse(prompt.split('RUBRIC:\n')[1].split('\n\nAUTHORITATIVE_REFERENCE:')[0]).map(r=>({id:r.id,done:r.id==='r10-h',reason:'Synthetic evidence judgment.'}))}:{strengths:[],weaknesses:[],missed:[],commonMistakes:[],suggestion:'Synthetic test.',microlearning:'### Synthetic teaching\nReview the documented case history and examination with faculty. This fixture checks grading weights, and does not provide clinical recommendations.'};
   return {ok:true,status:200,json:async()=>({choices:[{message:{content:JSON.stringify(content)}}]})};
  }));
  const result=await evaluate({...e,sessionId:opened.body.sessionId});expect(result.status).toBe(200);expect(result.body.source).toBe('llm');expect(result.body.score).toBe(50);
 }finally{db.prepare('UPDATE classes SET grading_role=?,grading_json=? WHERE id=1').run(old.grading_role,old.grading_json);setSetting('vp_grading',{});setSetting('ai',{apiKey:''});}
});
