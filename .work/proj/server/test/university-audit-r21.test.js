import { beforeAll, afterEach, it, expect, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import request from 'supertest';
import { initDb, db, persistNow, reloadDb } from '../src/db.js';
import { DB_PATH } from '../src/lib/paths.js';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/auth.js';
let app, uni, foreign, seq = 0;
const run = (sql, ...args) => Number(db.prepare(sql).run(...args).lastInsertRowid);
const rows = (sql, ...args) => db.prepare(sql).all(...args);
function actor(role = 'student', university = uni) {
  const username = `r21-${++seq}`;
  const id = run("INSERT INTO users(username,student_no,password_hash,role,university_id,status) VALUES (?,?,'fixture',?,?,'active')", username, username, role, university);
  return { id, username, token: signToken(db.prepare('SELECT * FROM users WHERE id=?').get(id)) };
}
function fixture() {
  const teacher = actor('teacher'), student = actor(), unassigned = actor('student', null);
  const cid = run("INSERT INTO classes(name_en,name_fa,desc_en,desc_fa,code,owner_id,university_id,max_attempts) VALUES ('Original','اولیه','Description','شرح',?,?,?,5)", `R21-${++seq}`, teacher.id, uni);
  const eid = run("INSERT INTO exams(title_en,owner_id,university_id,use_flashcards,competition) VALUES ('Original',?,?,1,1)", teacher.id, uni);
  const caseId=900000+seq, fid=900000+seq;
  run("INSERT INTO cases(id,data_json,university_id) VALUES (?, '{}', ?)",caseId,uni);
  run("INSERT INTO flashcards(id,data_json,university_id) VALUES (?, '{}', ?)",fid,uni);
  db.prepare('INSERT INTO class_members(class_id,user_id) VALUES (?,?)').run(cid, student.id);
  db.prepare('INSERT INTO exam_participants(exam_id,user_id) VALUES (?,?)').run(eid, student.id);
  const aid = run("INSERT INTO attempts(user_id,type,score,class_id,exam_id) VALUES (?,'vp',65,?,?)", student.id, cid, eid);
  return { teacher, student, unassigned, cid, eid, caseId, fid, aid };
}
const call = (method, url, user, body = {}) => request(app)[method](url).set('Authorization', `Bearer ${user.token}`).send(body);
beforeAll(async () => {
  execFileSync(process.execPath, ['src/seed.js', '--force'], { stdio: 'ignore' });
  await initDb();
  uni = run("INSERT INTO universities(name_en,code) VALUES ('R21','r21')");
  foreign = run("INSERT INTO universities(name_en,code) VALUES ('R21 other','r21-other')");
  app = createApp();
}, 60000);
afterEach(() => vi.restoreAllMocks());
const mutations = [
  ['class create', f => ['post', '/api/classes', {name_en:'R21 new',name_fa:'جدید'}], f => rows('SELECT * FROM classes WHERE owner_id=?',f.teacher.id)],
  ['class update', f => ['put', `/api/classes/${f.cid}`, {name_en:'Changed', name_fa:'جدید'}], f => rows('SELECT * FROM classes WHERE id=?',f.cid)],
  ['class deactivate', f => ['delete', `/api/classes/${f.cid}`], f => rows('SELECT * FROM classes WHERE id=?',f.cid)],
  ['class cases', f => ['put', `/api/classes/${f.cid}/cases`, {cases:[{case_id:f.caseId}]}], f => rows('SELECT * FROM class_cases WHERE class_id=?',f.cid)],
  ['class flashcards', f => ['put', `/api/classes/${f.cid}/flashcards`, {flashcards:[{flashcard_id:f.fid}]}], f => rows('SELECT * FROM class_flashcards WHERE class_id=?',f.cid)],
  ['class members with university healing', f => ['put', `/api/classes/${f.cid}/members`, {userIds:[f.unassigned.id]}], f => ({members:rows('SELECT * FROM class_members WHERE class_id=?',f.cid),user:rows('SELECT university_id FROM users WHERE id=?',f.unassigned.id)})],
  ['class resolve with university healing', f => ['post', `/api/classes/${f.cid}/members/resolve`, {studentNos:[f.unassigned.username],attach:false}], f => rows('SELECT university_id FROM users WHERE id=?',f.unassigned.id)],
  ['exam create', f => ['post', '/api/exams', {title_en:'R21 new'}], f => rows('SELECT * FROM exams WHERE owner_id=?',f.teacher.id)],
  ['exam update', f => ['put', `/api/exams/${f.eid}`, {title_en:'Changed'}], f => rows('SELECT * FROM exams WHERE id=?',f.eid)],
  ['exam deactivate', f => ['delete', `/api/exams/${f.eid}`], f => rows('SELECT * FROM exams WHERE id=?',f.eid)],
  ['exam participants with university healing', f => ['put', `/api/exams/${f.eid}/participants`, {userIds:[f.unassigned.id]}], f => ({members:rows('SELECT * FROM exam_participants WHERE exam_id=?',f.eid),user:rows('SELECT university_id FROM users WHERE id=?',f.unassigned.id)})],
  ['exam resolve with university healing', f => ['post', `/api/exams/${f.eid}/participants/resolve`, {studentNos:[f.unassigned.username]}], f => rows('SELECT university_id FROM users WHERE id=?',f.unassigned.id)],
  ['report review', f => ['put', `/api/reports/attempts/${f.aid}/review`, {status:'adjusted',teacher_score:80}], f => rows('SELECT * FROM attempts WHERE id=?',f.aid)],
  ['report delete', f => ['delete', `/api/reports/attempts/${f.aid}`], f => rows('SELECT * FROM attempts WHERE id=?',f.aid)],
  ['remedial assignment', f => ['post', `/api/classes/${f.cid}/remedial`, {caseId:f.caseId,userIds:[f.student.id]}], f => rows('SELECT * FROM exam_assignments WHERE case_id=?',f.caseId)],
];
for (const [name, operation, read] of mutations) {
  it(`${name}: rejects failed disk save, rolls back all writes, retries and survives reload`, async () => {
    const f = fixture(), before = read(f); persistNow({throwOnError:true});
    const original = fs.renameSync; let injected = false;
    vi.spyOn(fs, 'renameSync').mockImplementation((src,dst) => {
      if(dst===DB_PATH && JSON.stringify(read(f))!==JSON.stringify(before)) {injected=true;throw Error('R21 injected save failure');}
      return original(src,dst);
    });
    const [method,url,body] = operation(f);
    const failed = await call(method,url,f.teacher,body);vi.restoreAllMocks();
    expect(failed.status).toBe(500);expect(injected).toBe(true);expect(read(f)).toEqual(before);
    await reloadDb();expect(read(f)).toEqual(before);
    const retry = await call(method,url,f.teacher,body);expect(retry.status).toBe(200);
    const saved=read(f);expect(saved).not.toEqual(before);await reloadDb();expect(read(f)).toEqual(saved);
  });
}
it('partial class settings edit preserves omitted names, descriptions and attempt limit',async()=>{
 const f=fixture(),before=rows('SELECT name_en,name_fa,desc_en,desc_fa,max_attempts FROM classes WHERE id=?',f.cid);
 expect((await call('put',`/api/classes/${f.cid}`,f.teacher,{timer_enabled:true})).status).toBe(200);
 expect(rows('SELECT name_en,name_fa,desc_en,desc_fa,max_attempts FROM classes WHERE id=?',f.cid)).toEqual(before);
});
it('remedial refuses a foreign student without writing any assignments',async()=>{
 const f=fixture(),other=actor('student',foreign);
 expect((await call('post',`/api/classes/${f.cid}/remedial`,f.teacher,{caseId:f.caseId,userIds:[f.student.id,other.id]})).status).toBe(403);
 expect(rows('SELECT * FROM exam_assignments WHERE case_id=?',f.caseId)).toHaveLength(0);
});
it('reports deny a university-1 teacher access to an unassigned student',async()=>{
 const teacher=actor('teacher',1),student=actor('student',null);
 const aid=run("INSERT INTO attempts(user_id,type,score) VALUES (?,'vp',44)",student.id);
 expect((await call('get',`/api/reports/attempts/${aid}`,teacher)).status).toBe(403);
});
for(const kind of ['classes','exams']) {
 it(`${kind}: hides stale membership in list after student university transfer`,async()=>{
  const f=fixture();db.prepare('UPDATE users SET university_id=? WHERE id=?').run(foreign,f.student.id);
  const r=await call('get',`/api/${kind}`,f.student);expect(r.status).toBe(200);
  expect(r.body.some(x=>x.id===(kind==='classes'?f.cid:f.eid))).toBe(false);
 });
 it(`${kind}: rejects stale membership in detail after student university removal`,async()=>{
  const f=fixture();db.prepare('UPDATE users SET university_id=NULL WHERE id=?').run(f.student.id);
  expect((await call('get',`/api/${kind}/${kind==='classes'?f.cid:f.eid}`,f.student)).status).toBe(403);
 });
}
for(const role of ['support','content_manager']) it(`class detail denies learner-side ${role} role`,async()=>{
 const f=fixture();expect((await call('get',`/api/classes/${f.cid}`,actor(role))).status).toBe(403);
});
for(const body of [{status:'aproved'},{status:'adjusted',teacher_score:'80oops'},{status:'adjusted'},{status:'adjusted',teacher_score:-1},{status:'adjusted',teacher_score:101}]) it(`review rejects malformed grade decision ${JSON.stringify(body)}`,async()=>{
 const f=fixture(),before=rows('SELECT * FROM attempts WHERE id=?',f.aid);
 expect((await call('put',`/api/reports/attempts/${f.aid}/review`,f.teacher,body)).status).toBe(400);
 expect(rows('SELECT * FROM attempts WHERE id=?',f.aid)).toEqual(before);
});
for(const operation of ['reference create','reference update','policy create','policy update']) it(`${operation} rolls back on failed save including propagated case reference`,async()=>{
 const admin=actor('admin',null), code=`r21-ref-${++seq}`;
 const rid=run("INSERT INTO reference_catalog(code,title_en) VALUES (?,'Old reference')",code);
 const pid=run("INSERT INTO course_reference_policies(university_id,course_code,reference_id,status) VALUES (? ,?,?, 'draft')",uni,code,rid);
 const caseId=run("INSERT INTO cases(data_json,university_id,reference_policy_id,reference_snapshot_json) VALUES ('{}',?,?,'{}')",uni,pid);
 const read=()=>({ref:rows('SELECT * FROM reference_catalog WHERE code IN (?,?)',code,code+'-new'),policies:rows('SELECT * FROM course_reference_policies WHERE university_id=?',uni),case:rows('SELECT reference_snapshot_json FROM cases WHERE id=?',caseId)});
 const spec={
 'reference create':['post','/api/academic/references',{code:code+'-new',title_en:'New reference'}],
 'reference update':['put',`/api/academic/references/${rid}`,{title_en:'Changed reference'}],
 'policy create':['post','/api/academic/policies',{university_id:uni,course_code:code+'-new',reference_id:rid,status:'draft'}],
 'policy update':['put',`/api/academic/policies/${pid}`,{university_id:uni,course_name_en:'Changed policy'}],
 }[operation];
 const before=read();persistNow({throwOnError:true});const rename=fs.renameSync;let injected=false;
 vi.spyOn(fs,'renameSync').mockImplementation((src,dst)=>{if(dst===DB_PATH&&JSON.stringify(read())!==JSON.stringify(before)){injected=true;throw Error('R21 reference save failure');}return rename(src,dst);});
 const failed=await call(spec[0],spec[1],admin,spec[2]);vi.restoreAllMocks();expect(failed.status).toBe(500);expect(injected).toBe(true);expect(read()).toEqual(before);
 const retry=await call(spec[0],spec[1],admin,spec[2]);expect(retry.status).toBe(operation.endsWith('create')?201:200);const saved=read();await reloadDb();expect(read()).toEqual(saved);
});
for (const scope of ['classes','exams']) it(`${scope} drawing review preserves grade and payload on save failure`,async()=>{
 const f=fixture(),answer={type:'drawing',points:0,proposedPoints:50,pendingApproval:true,drawing:{preview:'fixture'}};
 const id=scope==='classes'?run('INSERT INTO class_flashcard_attempts(class_id,flashcard_id,user_id,score,answers_json) VALUES (?,?,?,0,?)',f.cid,f.fid,f.student.id,JSON.stringify([answer])):f.aid;
 if(scope==='exams')db.prepare("UPDATE attempts SET type='flash',score=0,transcript_json=? WHERE id=?").run(JSON.stringify({answers:[answer]}),id);
 const read=()=>rows(`SELECT * FROM ${scope==='classes'?'class_flashcard_attempts':'attempts'} WHERE id=?`,id),before=read();persistNow({throwOnError:true});const rename=fs.renameSync;let injected=false;
 vi.spyOn(fs,'renameSync').mockImplementation((src,dst)=>{if(dst===DB_PATH&&read()[0].score!==0){injected=true;throw Error('R21 drawing save failure');}return rename(src,dst);});
 const submit=()=>call('post',`/api/${scope}/${scope==='classes'?f.cid:f.eid}/drawing-reviews/${id}/0`,f.teacher,{status:'approved',points:50});
 expect((await submit()).status).toBe(500);vi.restoreAllMocks();expect(injected).toBe(true);expect(read()).toEqual(before);expect((await submit()).status).toBe(200);expect(read()[0].score).toBe(50);const saved=read();await reloadDb();expect(read()).toEqual(saved);
});
for (const scope of ['classes','exams']) it(`${scope} new student and enrolment are one durable unit`,async()=>{
 const f=fixture(),username=`r21-created-${++seq}`,read=()=>({users:rows('SELECT id,university_id FROM users WHERE username=?',username),members:scope==='classes'?rows('SELECT user_id FROM class_members WHERE class_id=?',f.cid):rows('SELECT user_id FROM exam_participants WHERE exam_id=?',f.eid)}),before=read();
 persistNow({throwOnError:true});const rename=fs.renameSync;
 vi.spyOn(fs,'renameSync').mockImplementation((src,dst)=>{if(dst===DB_PATH&&read().users.length)throw Error('R21 new student save failure');return rename(src,dst);});
 const submit=()=>call(scope==='classes'?'post':'put',`/api/${scope}/${scope==='classes'?f.cid:f.eid}/${scope==='classes'?'members/resolve':'participants'}`,f.teacher,{studentNos:[username],createMissing:true});
 expect((await submit()).status).toBe(500);vi.restoreAllMocks();expect(read()).toEqual(before);expect((await submit()).status).toBe(200);const saved=read();expect(saved.users).toHaveLength(1);expect(saved.members.filter(x=>x.user_id===saved.users[0].id)).toHaveLength(1);await reloadDb();expect(read()).toEqual(saved);
});
it('a mid-batch SQL error rolls back healed users and the replaced class roster',async()=>{
 const f=fixture(),before=rows('SELECT * FROM class_members WHERE class_id=?',f.cid);
 db.prepare(`CREATE TRIGGER r21_reject_roster BEFORE INSERT ON class_members WHEN NEW.user_id=${f.unassigned.id} BEGIN SELECT RAISE(ABORT,'R21 intentional SQL failure'); END`).run();
 try{
  expect((await call('put',`/api/classes/${f.cid}/members`,f.teacher,{userIds:[f.unassigned.id]})).status).toBe(500);
  expect(rows('SELECT * FROM class_members WHERE class_id=?',f.cid)).toEqual(before);expect(rows('SELECT university_id FROM users WHERE id=?',f.unassigned.id)[0].university_id).toBeNull();
 }finally{db.prepare('DROP TRIGGER r21_reject_roster').run();}
});
it('remedial de-duplicates valid current members without touching historical attempts',async()=>{
 const f=fixture(),before=rows('SELECT * FROM attempts WHERE id=?',f.aid);
 const r=await call('post',`/api/classes/${f.cid}/remedial`,f.teacher,{caseId:f.caseId,userIds:[f.student.id,f.student.id]});expect(r.status).toBe(200);expect(r.body.assigned).toBe(1);expect(rows('SELECT * FROM exam_assignments WHERE case_id=?',f.caseId)).toHaveLength(1);expect(rows('SELECT * FROM attempts WHERE id=?',f.aid)).toEqual(before);
});
for(const target of ['nonmember','teacher','unassigned','transferred'])it(`remedial rejects ${target} target`,async()=>{
 const f=fixture();let u=target==='transferred'?f.student:actor(target==='teacher'?'teacher':'student',target==='unassigned'?null:uni);
 if(target==='transferred')db.prepare('UPDATE users SET university_id=? WHERE id=?').run(foreign,u.id);
 expect((await call('post',`/api/classes/${f.cid}/remedial`,f.teacher,{caseId:f.caseId,userIds:[u.id]})).status).toBe(403);expect(rows('SELECT * FROM exam_assignments WHERE case_id=?',f.caseId)).toHaveLength(0);
});
for(const method of ['get','put','delete'])it(`unassigned student report ${method} is not accessible to university 1 teacher`,async()=>{
 const t=actor('teacher',1),s=actor('student',null),id=run("INSERT INTO attempts(user_id,type,score) VALUES (?,'vp',44)",s.id),before=rows('SELECT * FROM attempts WHERE id=?',id);
 expect((await call(method,`/api/reports/attempts/${id}${method==='put'?'/review':''}`,t,{status:'rejected'})).status).toBe(403);expect(rows('SELECT * FROM attempts WHERE id=?',id)).toEqual(before);
 for(const path of [`/api/reports/student/${s.id}`,`/api/reports/progress/${s.id}`])expect((await call('get',path,t)).status).toBe(403);
 const list=await call('get','/api/reports/attempts',t);expect(list.body.some(a=>a.id===id)).toBe(false);
});
it('administrator still sees an unassigned student report',async()=>{
 const s=actor('student',null),id=run("INSERT INTO attempts(user_id,type,score) VALUES (?,'vp',44)",s.id);expect((await call('get',`/api/reports/attempts/${id}`,actor('admin',null))).status).toBe(200);
});
for(const score of [0,100,'80',80.9])it(`valid grade ${score} keeps integer review contract without changing AI score`,async()=>{
 const f=fixture();expect((await call('put',`/api/reports/attempts/${f.aid}/review`,f.teacher,{status:'adjusted',teacher_score:score})).status).toBe(200);
 expect(rows('SELECT score,teacher_score FROM attempts WHERE id=?',f.aid)[0]).toEqual({score:65,teacher_score:Math.trunc(Number(score))});
});
it('revoked student cannot load a stale exam leaderboard with the same token',async()=>{
 const f=fixture();db.prepare('UPDATE users SET university_id=NULL WHERE id=?').run(f.student.id);expect((await call('get',`/api/exams/${f.eid}/leaderboard`,f.student)).status).toBe(403);
});
