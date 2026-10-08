import {beforeAll,afterEach,it,expect,vi} from 'vitest';
import {execFileSync} from 'node:child_process';import fs from 'node:fs';import request from 'supertest';
import {initDb,db,persistNow,reloadDb} from '../src/db.js';import {DB_PATH} from '../src/lib/paths.js';import {createApp} from '../src/app.js';import {signToken} from '../src/lib/auth.js';import {parseCSV} from '../src/lib/csv.js';
let app,uni,other,seq=0;const run=(s,...a)=>Number(db.prepare(s).run(...a).lastInsertRowid);const rows=(s,...a)=>db.prepare(s).all(...a);
function actor(role='student',u=uni){const id=run("INSERT INTO users(username,password_hash,role,university_id,status) VALUES (?,'fixture',?,?,'active')",`r22-${++seq}`,role,u);return {id,token:signToken(db.prepare('SELECT * FROM users WHERE id=?').get(id))};}
function fixture(){const admin=actor('admin',null),teacher=actor('teacher'),student=actor(),unassigned=actor('student',null);const sid=run("INSERT INTO research_studies(title_en,created_by,active,consent_required,consent_admin_managed,consent_modes,consent_text_en) VALUES ('R22 original',?,1,1,0,'online,paper,verbal','Synthetic wording')",teacher.id);const cid=run("INSERT INTO classes(name_en,university_id,study_id,code) VALUES ('R22 class',?,?,?)",uni,sid,`R22-${++seq}`);const eid=run("INSERT INTO exams(title_en,university_id,study_id) VALUES ('R22 exam',?,?)",uni,sid);db.prepare('INSERT INTO class_members(class_id,user_id) VALUES (?,?)').run(cid,student.id);db.prepare('INSERT INTO exam_participants(exam_id,user_id) VALUES (?,?)').run(eid,student.id);const event=run("INSERT INTO research_events(study_id,user_id,event_type) VALUES (?,?,'note')",sid,student.id);return {admin,teacher,student,unassigned,sid,cid,eid,event};}
const call=(method,path,user,body={})=>request(app)[method]('/api'+path).set('Authorization',`Bearer ${user.token}`).send(body);
const evidence=f=>({consents:rows('SELECT * FROM research_consents WHERE study_id=?',f.sid),events:rows('SELECT * FROM research_events WHERE study_id=?',f.sid),controls:rows('SELECT * FROM research_participation_controls WHERE study_id=?',f.sid)});
beforeAll(async()=>{execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();uni=run("INSERT INTO universities(name_en,code) VALUES ('R22','r22')");other=run("INSERT INTO universities(name_en,code) VALUES ('R22 other','r22-other')");app=createApp();},60000);
afterEach(()=>vi.restoreAllMocks());
const mutations=[
 ['study create',f=>['post','/research/studies',f.teacher,{title_en:'R22 created',active:true}],f=>rows('SELECT * FROM research_studies WHERE created_by=?',f.teacher.id)],
 ['study update',f=>['put',`/research/studies/${f.sid}`,f.teacher,{title_en:'R22 changed'}],f=>rows('SELECT * FROM research_studies WHERE id=?',f.sid)],
 ['study delete',f=>['delete',`/research/studies/${f.sid}`,f.teacher],f=>({study:rows('SELECT * FROM research_studies WHERE id=?',f.sid),...evidence(f),class:rows('SELECT study_id FROM classes WHERE id=?',f.cid),exam:rows('SELECT study_id FROM exams WHERE id=?',f.eid)})],
 ['event delete',f=>['delete',`/research/events/${f.event}`,f.teacher],evidence],
 ['event insert',f=>['post','/research/event',f.admin,{study_id:f.sid,event_type:'note',data:{text:'R22'}}],evidence],
 ['online consent',f=>['post','/research/consent',f.student,{study_id:f.sid}],evidence],
 ['offline consent',f=>['post',`/research/studies/${f.sid}/consents/record`,f.teacher,{user_id:f.student.id,mode:'paper',note:'R22 paper record'}],evidence],
 ['withdrawal request',f=>['post','/research/consent/withdraw',f.student,{study_id:f.sid,note:'R22 request'}],evidence,202],
 ['participation pause',f=>['post',`/research/studies/${f.sid}/participation`,f.admin,{user_id:f.student.id,blocked:true,note:'R22 pause'}],evidence],
 ['global tutor settings',f=>['put','/tutor/settings',f.admin,{enabled:true,default_prompt:'R22 '+f.cid}],f=>rows('SELECT * FROM tutor_settings')],
 ['class tutor settings',f=>['put','/tutor/context-settings',f.teacher,{contextType:'class',contextId:f.cid,enabled:true,prompt:'R22'}],f=>rows('SELECT tutor_enabled,tutor_prompt FROM classes WHERE id=?',f.cid)],
 ['exam tutor settings',f=>['put','/tutor/context-settings',f.teacher,{contextType:'exam',contextId:f.eid,enabled:true,prompt:'R22'}],f=>rows('SELECT tutor_enabled,tutor_prompt FROM exams WHERE id=?',f.eid)],
 ['bulk university',f=>['post','/admin/users/bulk-assign-university',f.teacher,{ids:[f.unassigned.id],university_id:uni}],f=>rows('SELECT university_id FROM users WHERE id=?',f.unassigned.id)],
 ['bulk class',f=>['post','/admin/users/bulk-assign-class',f.teacher,{ids:[f.unassigned.id],class_id:f.cid}],f=>({user:rows('SELECT university_id FROM users WHERE id=?',f.unassigned.id),members:rows('SELECT * FROM class_members WHERE class_id=?',f.cid)})],
 ['bulk exam',f=>['post','/admin/users/bulk-assign-exam',f.teacher,{ids:[f.unassigned.id],exam_id:f.eid}],f=>({user:rows('SELECT university_id FROM users WHERE id=?',f.unassigned.id),members:rows('SELECT * FROM exam_participants WHERE exam_id=?',f.eid)})],
];
for(const [name,spec,read,success=200] of mutations)it(`${name}: disk failure rolls back, retry persists all related writes`,async()=>{
 const f=fixture(),before=read(f);persistNow({throwOnError:true});const rename=fs.renameSync;let hit=false;
 vi.spyOn(fs,'renameSync').mockImplementation((src,dst)=>{if(dst===DB_PATH&&JSON.stringify(read(f))!==JSON.stringify(before)){hit=true;throw Error('R22 injected save failure');}return rename(src,dst);});
 const args=spec(f);const r=await call(...args);vi.restoreAllMocks();expect(r.status).toBe(500);expect(hit).toBe(true);expect(read(f)).toEqual(before);await reloadDb();expect(read(f)).toEqual(before);
 expect((await call(...args)).status).toBe(success);const saved=read(f);expect(saved).not.toEqual(before);await reloadDb();expect(read(f)).toEqual(saved);
});
it('teacher cannot move their student to a foreign university',async()=>{const f=fixture();expect((await call('post','/admin/users/bulk-assign-university',f.teacher,{ids:[f.student.id],university_id:other})).status).toBe(403);expect(rows('SELECT university_id FROM users WHERE id=?',f.student.id)[0].university_id).toBe(uni);});
for(const kind of ['university','class','exam'])it(`learner support cannot bulk assign university ${kind}`,async()=>{const f=fixture();expect((await call('post',`/admin/users/bulk-assign-${kind}`,actor('support'),{ids:[f.unassigned.id],university_id:uni,class_id:f.cid,exam_id:f.eid})).status).toBe(403);});
it('teacher cannot change platform-wide tutor settings',async()=>{const f=fixture(),before=rows('SELECT * FROM tutor_settings');expect((await call('put','/tutor/settings',f.teacher,{enabled:true,default_prompt:'foreign tenants affected'})).status).toBe(403);expect(rows('SELECT * FROM tutor_settings')).toEqual(before);});
for(const route of ['consent/status','consent','event'])it(`stale study membership is rejected for ${route}`,async()=>{const f=fixture();db.prepare('UPDATE users SET university_id=? WHERE id=?').run(other,f.student.id);const r=route==='consent/status'?await call('get',`/research/${route}?studyId=${f.sid}`,f.student):await call('post',`/research/${route}`,f.student,{study_id:f.sid,event_type:'note'});expect(r.status).toBe(403);});
it('university 1 teacher cannot record consent for an unassigned student',async()=>{const f=fixture(),teacher=actor('teacher',1);db.prepare('UPDATE research_studies SET created_by=? WHERE id=?').run(teacher.id,f.sid);db.prepare('UPDATE classes SET university_id=1 WHERE id=?').run(f.cid);db.prepare('UPDATE exams SET university_id=1 WHERE id=?').run(f.eid);expect((await call('post',`/research/studies/${f.sid}/consents/record`,teacher,{user_id:f.unassigned.id,mode:'paper',note:'Unauthorized'})).status).toBe(403);});
it('CSV preserves comma/quote-containing consent notes exactly once',async()=>{const f=fixture(),note='Paper, signed "in person"';expect((await call('post',`/research/studies/${f.sid}/consents/record`,f.teacher,{user_id:f.student.id,mode:'paper',note})).status).toBe(200);const r=await call('get',`/research/studies/${f.sid}/consents.csv`,f.teacher);expect(r.status).toBe(200);expect(parseCSV(r.text)[0].note).toBe(note);});
it('consent CSV neutralizes formula-prefixed note on export without changing evidence',async()=>{const f=fixture(),note='=1+1';await call('post',`/research/studies/${f.sid}/consents/record`,f.teacher,{user_id:f.student.id,mode:'paper',note});const r=await call('get',`/research/studies/${f.sid}/consents.csv`,f.teacher);expect(parseCSV(r.text)[0].note).toBe("'=1+1");expect(rows('SELECT note FROM research_consents WHERE study_id=?',f.sid)[0].note).toBe(note);});
it('deleting a study removes participation controls as well as its links',async()=>{const f=fixture();db.prepare("INSERT INTO research_participation_controls(study_id,user_id,blocked,recorded_by,note) VALUES (?,?,1,?,'R22')").run(f.sid,f.student.id,f.admin.id);expect((await call('delete',`/research/studies/${f.sid}`,f.teacher)).status).toBe(200);expect(rows('SELECT * FROM research_participation_controls WHERE study_id=?',f.sid)).toHaveLength(0);});
it('admin tutor settings reject a nonexistent context',async()=>{const f=fixture();expect((await call('put','/tutor/context-settings',f.admin,{contextType:'class',contextId:99999999,enabled:true})).status).toBe(404);});
for(const kind of ['class','exam'])it(`bulk ${kind} healing cannot exceed the university student cap`,async()=>{
 const f=fixture(),current=rows("SELECT COUNT(*) n FROM users WHERE role='student' AND university_id=?",uni)[0].n;
 db.prepare('UPDATE universities SET limits_enabled=1,max_students=? WHERE id=?').run(current,uni);
 try{const r=await call('post',`/admin/users/bulk-assign-${kind}`,f.teacher,{ids:[f.unassigned.id],class_id:f.cid,exam_id:f.eid});expect(r.status).toBe(200);expect(r.body.added).toEqual([]);expect(rows('SELECT university_id FROM users WHERE id=?',f.unassigned.id)[0].university_id).toBeNull();}finally{db.prepare('UPDATE universities SET limits_enabled=0 WHERE id=?').run(uni);}
});
it('a teacher without a university cannot create an unscoped research study',async()=>{const t=actor('teacher',null);expect((await call('post','/research/studies',t,{title_en:'Unscoped'})).status).toBe(400);});
it('university 1 teacher cannot manage a study whose creator lost their university',async()=>{const t=actor('teacher',1),creator=actor('teacher',null),sid=run("INSERT INTO research_studies(title_en,created_by) VALUES ('Unscoped legacy',?)",creator.id);expect((await call('put',`/research/studies/${sid}`,t,{title_en:'Unauthorized'})).status).toBe(403);});
for(const kind of ['class','exam'])for(const change of ['transfer','removed'])it(`consent context ${kind} rejects ${change} with the old token`,async()=>{
 const f=fixture();db.prepare('UPDATE users SET university_id=? WHERE id=?').run(change==='transfer'?other:null,f.student.id);
 expect((await call('get',`/research/consent/status?${kind}Id=${kind==='class'?f.cid:f.eid}`,f.student)).status).toBe(403);
});
for(const mode of ['online','paper'])it(`${mode} consent and event remain atomic when the event INSERT fails`,async()=>{
 const f=fixture(),before=evidence(f);persistNow();db.exec(`CREATE TRIGGER r22_consent_event BEFORE INSERT ON research_events WHEN NEW.study_id=${f.sid} AND NEW.event_type='consent_granted' BEGIN SELECT RAISE(ABORT,'R22 event failure'); END`);
 try{const r=mode==='online'?await call('post','/research/consent',f.student,{study_id:f.sid}):await call('post',`/research/studies/${f.sid}/consents/record`,f.teacher,{user_id:f.student.id,mode,note:'R22 paper'});expect(r.status).toBe(500);expect(evidence(f)).toEqual(before);}finally{db.exec('DROP TRIGGER r22_consent_event');}
});
for(const kind of ['class','exam'])it(`bulk ${kind} rolls back university healing on mid-batch SQL failure`,async()=>{
 const f=fixture(),table=kind==='class'?'class_members':'exam_participants';persistNow();db.exec(`CREATE TRIGGER r22_enrol BEFORE INSERT ON ${table} WHEN NEW.user_id=${f.unassigned.id} BEGIN SELECT RAISE(ABORT,'R22 enrolment failure'); END`);
 try{const r=await call('post',`/admin/users/bulk-assign-${kind}`,f.teacher,{ids:[f.unassigned.id],class_id:f.cid,exam_id:f.eid});expect(r.status).toBe(500);expect(rows('SELECT university_id FROM users WHERE id=?',f.unassigned.id)[0].university_id).toBeNull();expect(rows(`SELECT * FROM ${table} WHERE user_id=?`,f.unassigned.id)).toHaveLength(0);}finally{db.exec('DROP TRIGGER r22_enrol');}
});
it('offline consent replacement preserves prior evidence and its hash on save failure',async()=>{
 const f=fixture();await call('post',`/research/studies/${f.sid}/consents/record`,f.teacher,{user_id:f.student.id,mode:'paper',note:'original'});const before=evidence(f),rename=fs.renameSync;persistNow();
 vi.spyOn(fs,'renameSync').mockImplementation((src,dst)=>{if(dst===DB_PATH&&evidence(f).consents[0].note==='replacement')throw Error('R22 replacement failure');return rename(src,dst);});
 expect((await call('post',`/research/studies/${f.sid}/consents/record`,f.teacher,{user_id:f.student.id,mode:'verbal',note:'replacement'})).status).toBe(500);vi.restoreAllMocks();expect(evidence(f)).toEqual(before);await reloadDb();expect(evidence(f)).toEqual(before);
});
it('admin-managed withdrawal stays pending; pause/resume remain explicit admin decisions',async()=>{
 const f=fixture();db.prepare('UPDATE research_studies SET consent_admin_managed=1 WHERE id=?').run(f.sid);
 const withdrawal=await call('post','/research/consent/withdraw',f.student,{study_id:f.sid,note:'request'});expect(withdrawal.status).toBe(202);expect(withdrawal.body).toMatchObject({status:'pending_admin',collectionPaused:false});
 expect((await call('post',`/research/studies/${f.sid}/participation`,f.teacher,{user_id:f.student.id,blocked:true,note:'unauthorized'})).status).toBe(403);
 for(const blocked of [true,false]){expect((await call('post',`/research/studies/${f.sid}/participation`,f.admin,{user_id:f.student.id,blocked,note:'explicit decision'})).status).toBe(200);await reloadDb();expect(evidence(f).controls[0].blocked).toBe(blocked?1:0);}
 expect(evidence(f).consents).toHaveLength(0);
});
it('unassigned student consent is excluded from university-1 teacher roster but retained for admin',async()=>{
 const f=fixture(),teacher=actor('teacher',1);db.prepare('UPDATE research_studies SET created_by=? WHERE id=?').run(teacher.id,f.sid);db.prepare('UPDATE classes SET university_id=1 WHERE id=?').run(f.cid);db.prepare('UPDATE exams SET university_id=1 WHERE id=?').run(f.eid);
 expect((await call('post',`/research/studies/${f.sid}/consents/record`,f.admin,{user_id:f.unassigned.id,mode:'paper',note:'admin record'})).status).toBe(200);
 expect((await call('get',`/research/studies/${f.sid}/consents`,teacher)).body.consents).toHaveLength(0);expect((await call('get',`/research/studies/${f.sid}/consents`,f.admin)).body.consents).toHaveLength(1);
});
for(const note of ['+1','-1','@SUM(A1)','＝1+1','\t=1+1','  =1+1','normal, "quoted"\nیادداشت'])it(`CSV round-trip for ${JSON.stringify(note)} preserves safe text or adds an export-only text marker`,async()=>{
 const f=fixture();await call('post',`/research/studies/${f.sid}/consents/record`,f.teacher,{user_id:f.student.id,mode:'paper',note});const r=await call('get',`/research/studies/${f.sid}/consents.csv`,f.teacher);expect(parseCSV(r.text)[0].note).toBe(note.startsWith('normal')?note:"'"+note);expect(rows('SELECT note FROM research_consents WHERE study_id=?',f.sid)[0].note).toBe(note);
});
it('administrator retains cross-university assignment; foreign and revoked teachers are denied',async()=>{
 const f=fixture();expect((await call('post','/admin/users/bulk-assign-university',f.admin,{ids:[f.student.id],university_id:other})).status).toBe(200);
 db.prepare('UPDATE users SET university_id=NULL WHERE id=?').run(f.teacher.id);expect((await call('post','/admin/users/bulk-assign-university',f.teacher,{ids:[f.unassigned.id],university_id:uni})).status).toBe(403);
});
it('a teacher keeps context-specific tutor management and an admin keeps global settings',async()=>{
 const f=fixture();expect((await call('put','/tutor/settings',f.admin,{enabled:false,default_prompt:'R22 admin'})).status).toBe(200);
 for(const contextType of ['class','exam'])expect((await call('put','/tutor/context-settings',f.teacher,{contextType,contextId:contextType==='class'?f.cid:f.eid,enabled:true,prompt:'R22 local'})).status).toBe(200);
});
