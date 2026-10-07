import {beforeAll,afterEach,it,expect,vi} from 'vitest';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import request from 'supertest';
import {initDb,db,persistNow} from '../src/db.js';
import {DB_PATH} from '../src/lib/paths.js';
import {createApp} from '../src/app.js';
import {setSetting} from '../src/routes/content.js';
let app,teacher,admin,student;
const A=t=>({Authorization:`Bearer ${t}`});
const mp3=Buffer.concat([Buffer.from('ID3'),Buffer.alloc(64)]);
beforeAll(async()=>{execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();app=createApp();for(const name of ['teacher','admin','40012345']){const r=await request(app).post('/api/auth/login').send({username:name,password:'demo'});expect(r.status).toBe(200);if(name==='teacher')teacher=r.body.token;else if(name==='admin')admin=r.body.token;else student=r.body.token;}setSetting('ai',{apiKey:''});setSetting('ai_vpatient',{});},60000);
afterEach(()=>vi.restoreAllMocks());
async function encounter(extra={}){
 const created=await request(app).post('/api/cases').set(A(teacher)).send({title_en:'R11 persistence fixture',age:40,chief_en:'Headache',checklist_id:1,...extra});expect(created.status).toBe(200);
 const uid=db.prepare("SELECT id FROM users WHERE username='40012345'").get().id;
 expect((await request(app).put(`/api/assignments/${uid}`).set(A(teacher)).send({caseIds:[created.body.id],maxAttempts:3})).status).toBe(200);
 const opened=await request(app).post('/api/exam/session-start').set(A(student)).send({caseId:created.body.id,lang:'en'});expect(opened.status).toBe(200);
 return {caseId:created.body.id,sessionId:opened.body.sessionId};
}
it('teacher library includes the tenant-scoped audio just uploaded',async()=>{
 const up=await request(app).post('/api/upload/audio').set(A(teacher)).attach('audio',mp3,'r11.mp3');expect(up.status).toBe(200);
 const library=await request(app).get('/api/upload/library').set(A(teacher));expect(library.status).toBe(200);
 expect(library.body.items.find(x=>x.url===up.body.url)?.kind).toBe('audio');
});
it('legacy malformed result collections do not crash the media library',async()=>{
 const e=await encounter();const row=db.prepare('SELECT data_json FROM cases WHERE id=?').get(e.caseId);
 try{db.prepare('UPDATE cases SET data_json=? WHERE id=?').run(JSON.stringify({...JSON.parse(row.data_json),labResults:{bad:'legacy'}}),e.caseId);
 expect((await request(app).get('/api/upload/library').set(A(admin))).status).toBe(200);
 }finally{db.prepare('UPDATE cases SET data_json=? WHERE id=?').run(row.data_json,e.caseId);}
});
it('an audio file referenced only by an encounter snapshot cannot be deleted',async()=>{
 const up=await request(app).post('/api/upload/audio').set(A(admin)).attach('audio',mp3,'snapshot.mp3');expect(up.status).toBe(200);
 const e=await encounter({lungSound:up.body.url});
 expect((await request(app).put(`/api/cases/${e.caseId}`).set(A(teacher)).send({lungSound:''})).status).toBe(200);
 const deleted=await request(app).delete('/api/upload/library/'+up.body.url.split('/').pop()).set(A(admin));
 expect(deleted.status).toBe(409);
});
it.each(['abandon','evaluate'])('failed %s persistence leaves the encounter open and no phantom results',async(action)=>{
 const e=await encounter();persistNow();const n=db.prepare('SELECT COUNT(*) n FROM attempts').get().n;
 const rename=fs.renameSync;vi.spyOn(fs,'renameSync').mockImplementation((a,b)=>{if(b===DB_PATH)throw new Error('R11 simulated disk failure');return rename(a,b);});
 const endpoint=action==='abandon'?'session-abandon':'evaluate';const body={...e,lang:'en',session:{messages:[],tests:[],ddx:[],problemList:[]},events:[{kind:'leave',atMs:10,note:'Synthetic event'}]};
 const failed=await request(app).post('/api/exam/'+endpoint).set(A(student)).send(body);vi.restoreAllMocks();
 expect(failed.status).toBeGreaterThanOrEqual(500);
 expect(db.prepare('SELECT COUNT(*) n FROM attempts').get().n).toBe(n);
 expect(db.prepare('SELECT finished_at,attempt_id FROM vp_sessions WHERE id=?').get(e.sessionId)).toEqual({finished_at:null,attempt_id:null});
 expect(db.prepare('SELECT COUNT(*) n FROM vp_session_events WHERE session_id=?').get(e.sessionId).n).toBe(0);
 const retry=await request(app).post('/api/exam/'+endpoint).set(A(student)).send(body);expect(retry.status).toBe(200);
 expect(db.prepare('SELECT COUNT(*) n FROM attempts').get().n).toBe(n+(action==='evaluate'?1:0));
});
it('teacher library does not expose another university or platform files',async()=>{
 const up=await request(app).post('/api/upload/audio').set(A(admin)).attach('audio',mp3,'private-platform.mp3');expect(up.status).toBe(200);
 const row=db.prepare("SELECT id,university_id FROM users WHERE username='teacher'").get();
 const own=await request(app).get('/api/upload/library').set(A(teacher));expect(own.status).toBe(200);
 expect(own.body.items.every(x=>x.url.startsWith(`/uploads/academic/university-${row.university_id}/`))).toBe(true);
 expect(own.body.items.some(x=>x.url===up.body.url)).toBe(false);
 expect((await request(app).get('/api/upload/library').set(A(student))).status).toBe(403);
 try{db.prepare('UPDATE users SET university_id=NULL WHERE id=?').run(row.id);
 expect((await request(app).get('/api/upload/library').set(A(teacher))).status).toBe(403);
 }finally{db.prepare('UPDATE users SET university_id=? WHERE id=?').run(row.university_id,row.id);}
});
it('completed encounter snapshots still protect their result images after archival',async()=>{
 const name='r11-historical-image.png';
 const {UPLOADS_DIR}=await import('../src/lib/paths.js');const path=await import('node:path');
 const file=path.join(UPLOADS_DIR,'platform',name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'Synthetic image');
 const e=await encounter({labResults:[{name_en:'CBC',result_en:'Synthetic',imageUrl:`/uploads/platform/${name}`} ]});
 expect((await request(app).post('/api/exam/evaluate').set(A(student)).send({...e,session:{messages:[],tests:[],ddx:[],problemList:[]},lang:'en'})).status).toBe(200);
 expect((await request(app).delete(`/api/cases/${e.caseId}`).set(A(teacher))).status).toBe(200);
 expect((await request(app).delete('/api/upload/library/'+name).set(A(admin))).status).toBe(409);
 expect(fs.existsSync(file)).toBe(true);
});
it('unused media remains deletable and corrupt snapshot JSON does not crash listing',async()=>{
 const up=await request(app).post('/api/upload/audio').set(A(admin)).attach('audio',mp3,'unused.mp3');expect(up.status).toBe(200);
 const e=await encounter();db.prepare('UPDATE vp_sessions SET encounter_snapshot_json=? WHERE id=?').run('{bad json',e.sessionId);
 expect((await request(app).get('/api/upload/library').set(A(admin))).status).toBe(200);
 expect((await request(app).delete('/api/upload/library/'+up.body.url.split('/').pop()).set(A(admin))).status).toBe(200);
});
it('a successful evaluation is on disk and replays without creating another attempt',async()=>{
 const e=await encounter();const body={...e,lang:'en',session:{messages:[],tests:[],ddx:[],problemList:[]}};
 const result=await request(app).post('/api/exam/evaluate').set(A(student)).send(body);expect(result.status).toBe(200);
 const {reloadDb,initSchema}=await import('../src/db.js');await reloadDb();initSchema();
 const row=db.prepare('SELECT attempt_id,finished_at FROM vp_sessions WHERE id=?').get(e.sessionId);expect(row.attempt_id).toBe(result.body.attemptId);expect(row.finished_at).toBeTruthy();
 const replay=await request(app).post('/api/exam/evaluate').set(A(student)).send(body);expect(replay.status).toBe(200);expect(replay.body.attemptId).toBe(result.body.attemptId);expect(replay.body.replayed).toBe(true);
});
