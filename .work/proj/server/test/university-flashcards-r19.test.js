import {beforeAll,afterEach,it,expect,vi} from 'vitest';
import {execFileSync} from 'node:child_process';import fs from 'node:fs';import request from 'supertest';
import {initDb,db,persistNow,reloadDb} from '../src/db.js';import {DB_PATH} from '../src/lib/paths.js';import {createApp} from '../src/app.js';import {signToken} from '../src/lib/auth.js';
let app,a,b,seq=0;const A=t=>({Authorization:`Bearer ${t}`});
function fixture(kind='class',research=false){
 const uid=Number(db.prepare("INSERT INTO users(username,password_hash,role,status,university_id) VALUES (?,'fixture','student','active',?)").run('r19-'+(++seq),a).lastInsertRowid);
 const card=Number(db.prepare('INSERT INTO flashcards(data_json,university_id) VALUES (?,?)').run(JSON.stringify({type:'mcq',title_en:'R19 card',options:[{en:'A',correct:true},{en:'B',correct:false}],hints_en:['h1','h2','h3']}),a).lastInsertRowid);
 const study=research?Number(db.prepare("INSERT INTO research_studies(title_en,active) VALUES ('R19 study',1)").run().lastInsertRowid):null;
 let id;if(kind==='class'){
 id=Number(db.prepare("INSERT INTO classes(name_en,university_id,max_attempts,study_id) VALUES ('R19',?,1,?)").run(a,study).lastInsertRowid);db.prepare('INSERT INTO class_members(class_id,user_id) VALUES (?,?)').run(id,uid);db.prepare('INSERT INTO class_flashcards(class_id,flashcard_id,graded) VALUES (?,?,1)').run(id,card);
 }else{
 id=Number(db.prepare("INSERT INTO exams(title_en,university_id,use_flashcards,flashcard_ids,max_attempts,study_id) VALUES ('R19',?,1,?,1,?)").run(a,JSON.stringify([card]),study).lastInsertRowid);db.prepare('INSERT INTO exam_participants(exam_id,user_id) VALUES (?,?)').run(id,uid);
 }
 return {kind,id,uid,card,study,token:signToken(db.prepare('SELECT * FROM users WHERE id=?').get(uid))};
}
const count=f=>db.prepare(`SELECT COUNT(*) n FROM ${f.kind==='class'?'class_flashcard_attempts':'attempts'} WHERE user_id=?`).get(f.uid).n;
const submit=(f,extra={})=>request(app).post(f.kind==='class'?`/api/classes/${f.id}/flashcard/${f.card}/finish`:'/api/exam/flashcard-result').set(A(f.token)).send({score:100,...(f.kind==='exam'?{examId:f.id}:{}),answers:[{card_id:f.card,selectedIdx:0}],...extra});
beforeAll(async()=>{execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();a=Number(db.prepare("INSERT INTO universities(name_en,code,flash_no_penalty) VALUES ('R19 A','r19-a',0)").run().lastInsertRowid);b=Number(db.prepare("INSERT INTO universities(name_en,code) VALUES ('R19 B','r19-b')").run().lastInsertRowid);app=createApp();},60000);
afterEach(()=>{vi.restoreAllMocks();db.exec('DROP TRIGGER IF EXISTS r19_fail_research');});
it('refuses a client-only score for a graded class card without consuming a try',async()=>{
 const f=fixture();expect((await submit(f,{answers:[]})).status).toBe(400);expect(count(f)).toBe(0);
});
for(const kind of ['class','exam']){
 it(`rejects ${kind} flash completion after student university transfer`,async()=>{
  const f=fixture(kind);db.prepare('UPDATE users SET university_id=? WHERE id=?').run(b,f.uid);expect((await submit(f)).status).toBe(403);expect(count(f)).toBe(0);
 });
 it(`does not save a ${kind} grade when its research event fails`,async()=>{
  const f=fixture(kind,true);persistNow();db.exec("CREATE TRIGGER r19_fail_research BEFORE INSERT ON research_events BEGIN SELECT RAISE(ABORT,'R19 event failure'); END");
  expect((await submit(f)).status).toBeGreaterThanOrEqual(500);expect(count(f)).toBe(0);
 });
 it(`does not acknowledge ${kind} grades when DB persistence fails`,async()=>{
  const f=fixture(kind);persistNow();const rename=fs.renameSync;vi.spyOn(fs,'renameSync').mockImplementation((s,d)=>{if(d===DB_PATH&&count(f)>0)throw Error('R19 simulated disk failure');return rename(s,d);});
  const r=await submit(f);vi.restoreAllMocks();expect(r.status).toBeGreaterThanOrEqual(500);expect(count(f)).toBe(0);
 });
}
it('rejects a foreign-university card even if a stale class link exists',async()=>{
 const f=fixture();db.prepare('UPDATE flashcards SET university_id=? WHERE id=?').run(b,f.card);expect((await submit(f)).status).toBe(403);expect(count(f)).toBe(0);
});
it('applies the university hint penalty to exam scores, not only the UI',async()=>{
 const f=fixture('exam');const r=await submit(f,{answers:[{card_id:f.card,selectedIdx:0,hintsUsed:2}]});expect(r.status).toBe(200);expect(r.body.score).toBe(50);
});
it('preserves legacy score-only practice without turning it into graded work',async()=>{
 const f=fixture();db.prepare('UPDATE class_flashcards SET graded=0 WHERE class_id=? AND flashcard_id=?').run(f.id,f.card);const r=await submit(f,{answers:[],score:73});expect(r.status).toBe(200);expect(r.body.score).toBe(73);
});
for(const kind of ['class','exam']){
 it(`regrades wrong ${kind} answers rather than trusting score 100`,async()=>{
  const f=fixture(kind);const r=await submit(f,{answers:[{card_id:f.card,selectedIdx:1}]});expect(r.status).toBe(200);expect(r.body.score).toBe(0);
 });
 it(`rejects duplicate and out-of-deck ${kind} answers without consuming a try`,async()=>{
  const f=fixture(kind);for(const answers of [[{card_id:f.card,selectedIdx:0},{card_id:f.card,selectedIdx:0}],[{card_id:999999,selectedIdx:0}]]){expect((await submit(f,{answers})).status).toBe(400);expect(count(f)).toBe(0);}
 });
 it(`retains ${kind} score and one research event on disk, then enforces the attempt cap`,async()=>{
  const f=fixture(kind,true);const r=await submit(f);expect(r.status).toBe(200);expect(r.body.score).toBe(100);await reloadDb();expect(count(f)).toBe(1);expect(db.prepare('SELECT COUNT(*) n FROM research_events WHERE study_id=? AND user_id=?').get(f.study,f.uid).n).toBe(1);
  expect((await submit(f)).status).toBe(kind==='class'?429:403);expect(count(f)).toBe(1);
 });
 it(`lets a ${kind} retry save exactly once after research insert failure`,async()=>{
  const f=fixture(kind,true);persistNow();db.exec("CREATE TRIGGER r19_fail_research BEFORE INSERT ON research_events BEGIN SELECT RAISE(ABORT,'R19 retry event failure'); END");expect((await submit(f)).status).toBe(500);expect(count(f)).toBe(0);db.exec('DROP TRIGGER r19_fail_research');
  expect((await submit(f)).status).toBe(200);expect(count(f)).toBe(1);expect(db.prepare('SELECT COUNT(*) n FROM research_events WHERE study_id=? AND user_id=?').get(f.study,f.uid).n).toBe(1);
 });
 it(`rejects inactive ${kind} flash content`,async()=>{
  const f=fixture(kind);db.prepare('UPDATE flashcards SET active=0 WHERE id=?').run(f.card);expect((await submit(f)).status).toBe(403);expect(count(f)).toBe(0);
 });
}
it('honors an exam university no-penalty override for hinted answers',async()=>{
 const f=fixture('exam');db.prepare('UPDATE universities SET flash_no_penalty=1 WHERE id=?').run(a);
 try{const r=await submit(f,{answers:[{card_id:f.card,selectedIdx:0,hintsUsed:2}]});expect(r.status).toBe(200);expect(r.body.score).toBe(100);}finally{db.prepare('UPDATE universities SET flash_no_penalty=0 WHERE id=?').run(a);}
});
it('applies the class override ahead of the university hint policy',async()=>{
 const f=fixture();db.prepare('UPDATE classes SET flash_no_penalty=1 WHERE id=?').run(f.id);const r=await submit(f,{answers:[{card_id:f.card,selectedIdx:0,hintsUsed:2}]});expect(r.status).toBe(200);expect(r.body.score).toBe(100);
});
it('blocks a foreign exam card even when its ID is explicitly on the exam',async()=>{
 const f=fixture('exam');db.prepare('UPDATE flashcards SET university_id=? WHERE id=?').run(b,f.card);expect((await submit(f)).status).toBe(403);expect(count(f)).toBe(0);
});
