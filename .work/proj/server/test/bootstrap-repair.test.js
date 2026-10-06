import {beforeAll,it,expect} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';
import request from 'supertest';
import {initDb,initSchema,db,persistNow,reloadDb} from '../src/db.js';
import {createApp} from '../src/app.js';
import {hashPasswordSync} from '../src/lib/password.js';
import {installBundledDemo} from '../src/lib/first-run.js';
import {repairDemo} from '../src/lib/demo-repair.js';
let app,token;
beforeAll(async()=>{execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();initSchema();app=createApp();token=(await request(app).post('/api/auth/login').send({username:'admin',password:'demo'})).body.token;},60000);
it('schema migration never resets a real admin password or recreates accounts',async()=>{
 const hash=hashPasswordSync('A-changed-private-password-42');db.prepare("UPDATE users SET password_hash=? WHERE username='admin'").run(hash);const n=db.prepare('SELECT COUNT(*) n FROM users').get().n;
 persistNow();await reloadDb();initSchema();expect(db.prepare("SELECT password_hash FROM users WHERE username='admin'").get().password_hash).toBe(hash);expect(db.prepare('SELECT COUNT(*) n FROM users').get().n).toBe(n);
});
it('copies a bundle to a missing target and never replaces an existing database or media',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'med-bootstrap-'));try{const bundleDir=path.join(root,'bundle'),dataDir=path.join(root,'data'),dbPath=path.join(dataDir,'medlab.db');fs.mkdirSync(path.join(bundleDir,'uploads'),{recursive:true});fs.writeFileSync(path.join(bundleDir,'medlab.db'),'fixture');fs.writeFileSync(path.join(bundleDir,'uploads','image.svg'),'asset');
 expect(installBundledDemo({bundleDir,dataDir,dbPath}).installed).toBe(true);fs.writeFileSync(dbPath,'retained');expect(installBundledDemo({bundleDir,dataDir,dbPath}).reason).toBe('existing_database');expect(fs.readFileSync(dbPath,'utf8')).toBe('retained');}finally{fs.rmSync(root,{recursive:true,force:true});}
});
it('additive recovery is repeatable, preserves credentials and respects retired cases',async()=>{
 const before=db.prepare('SELECT COUNT(*) n FROM users').get().n;
 const first=repairDemo({universityId:1,password:'New-demo-secret-123',actorId:2});expect(first.accounts.every(a=>a.created)).toBe(true);expect(first.caseIds.length).toBe(10);
 const id=first.caseIds[0],code=db.prepare('SELECT public_code FROM cases WHERE id=?').get(id).public_code;
 const hashes=db.prepare("SELECT password_hash FROM users WHERE username LIKE 'demo_%'").all();db.prepare('DELETE FROM cases WHERE id=?').run(id);
 const second=repairDemo({universityId:1,password:'Different-secret-456',actorId:2});expect(second.accounts.every(a=>!a.created)).toBe(true);expect(second.caseIds.length).toBe(9);expect(db.prepare('SELECT COUNT(*) n FROM users').get().n).toBe(before+3);expect(db.prepare("SELECT password_hash FROM users WHERE username LIKE 'demo_%'").all()).toEqual(hashes);expect(db.prepare('SELECT deleted_at FROM content_identity_registry WHERE public_code=?').get(code).deleted_at).toBeTruthy();
 const login=await request(app).post('/api/auth/login').send({username:'demo_student_1',password:'New-demo-secret-123'});expect(login.status).toBe(200);
 const visible=await request(app).get('/api/cases').auth(login.body.token,{type:'bearer'});expect(visible.body.length).toBe(9);
 expect((await request(app).post('/api/admin/demo/prepare').auth(login.body.token,{type:'bearer'}).send({confirm:true,universityId:1,password:'New-demo-secret-123'})).status).toBe(403);
});
it('CSV preview does not write, invalid answer keys do not import and valid rows commit',async()=>{
 const before=db.prepare('SELECT COUNT(*) n FROM flashcards').get().n;
 const csv='title_fa,options_fa,correct_fa\nنمونه,الف|ب,ب';
 const post=b=>request(app).post('/api/flashcards-import').auth(token,{type:'bearer'}).send(b);
 const preview=await post({csv,dryRun:true});expect(preview.status).toBe(200);expect(preview.body.valid).toBe(true);expect(db.prepare('SELECT COUNT(*) n FROM flashcards').get().n).toBe(before);
 expect((await post({csv:'title_fa,options_fa\nنمونه,الف|ب'})).status).toBe(400);
 expect((await post({csv})).body.imported).toBe(1);
});
it('preserves independent translations, empty English text, provenance and stable identity over API edits',async()=>{
 const payload={type:'match',q_fa:'سؤال',q_en:'',pairs:[['چپ','left','راست','right']],micro:{lead_fa:'درس',lead_en:'lesson'},explain:{text_fa:'پاسخ',text_en:'answer'},source_meta:{kind:'past_exam_import',tags:['QB-900099']}};
 const create=await request(app).post('/api/admin/learn-cards').auth(token,{type:'bearer'}).send(payload);expect(create.status).toBe(200);const id=create.body.id;
 const before=db.prepare('SELECT public_code FROM flashcards WHERE id=?').get(id).public_code;
 const update=await request(app).put('/api/admin/learn-cards/'+id).auth(token,{type:'bearer'}).send({...payload,q_fa:'ویرایش'});expect(update.status).toBe(200);
 const row=db.prepare('SELECT * FROM flashcards WHERE id=?').get(id),d=JSON.parse(row.data_json);expect(row.public_code).toBe(before);expect(d.q_en).toBe('');expect(d.pairs).toEqual(payload.pairs);expect(d.micro.lead_en).toBe('lesson');expect(d.source_meta).toEqual(payload.source_meta);
});
it('keeps bilingual CSV option indices when one translation has a gap',async()=>{
 const csv='title_en,options_fa,options_en,correct_fa,correct_en\nGap,الف||ج,A|B|C,ج,C';
 const post=b=>request(app).post('/api/flashcards-import').auth(token,{type:'bearer'}).send(b);
 expect((await post({csv,dryRun:true})).body.valid).toBe(true);
 expect((await post({csv})).status).toBe(200);
 const d=JSON.parse(db.prepare('SELECT data_json FROM flashcards ORDER BY id DESC LIMIT 1').get().data_json);
 expect(d.options.map(o=>[o.fa,o.en])).toEqual([['الف','A'],['','B'],['ج','C']]);
 expect(d.options.map(o=>o.correct)).toEqual([false,false,true]);
});
it('rejects a supplied unmatched translation key even if the other key matches',async()=>{
 const before=db.prepare('SELECT COUNT(*) n FROM flashcards').get().n;
 const csv='title_en,options_fa,options_en,correct_fa,correct_en\nBad,الف|ب,A|B,الف,Z';
 const post=b=>request(app).post('/api/flashcards-import').auth(token,{type:'bearer'}).send(b);
 expect((await post({csv,dryRun:true})).body.valid).toBe(false);
 expect((await post({csv})).status).toBe(400);expect(db.prepare('SELECT COUNT(*) n FROM flashcards').get().n).toBe(before);
});
it.each([
 ['conflicting','title_en,options_fa,options_en,correct_fa,correct_en\nQ,الف|ب,A|B,الف,B'],
 ['duplicate-key','title_en,options_en,correct_en\nQ,A|A|B,A'],
 ['unsupported','title_en,type,options_en,correct_en\nQ,drawing,A|B,A'],
 ['wrong-track','title_en,track,options_en,correct_en\nQ,learn,A|B,A'],
 ['atomic','title_en,options_en,correct_en\nGood,A|B,A\nBad,A|B,Z']
])('rejects %s CSV without partial writes',async(_,csv)=>{
 const before=db.prepare('SELECT COUNT(*) n FROM flashcards').get().n;
 const r=await request(app).post('/api/flashcards-import').auth(token,{type:'bearer'}).send({csv});expect(r.status).toBe(400);expect(db.prepare('SELECT COUNT(*) n FROM flashcards').get().n).toBe(before);
});
it('requires explicit admin confirmation and valid university/password without changes',async()=>{
 const before=db.prepare('SELECT COUNT(*) n FROM users').get().n;
 for(const b of [{universityId:1,password:'Long-secret-12345'},{confirm:true,universityId:999999,password:'Long-secret-12345'},{confirm:true,universityId:1,password:'short'}]){
  const r=await request(app).post('/api/admin/demo/prepare').auth(token,{type:'bearer'}).send(b);expect(r.status).toBe(400);
 }
 expect(db.prepare('SELECT COUNT(*) n FROM users').get().n).toBe(before);
});
it('retains disabled demo accounts and inactive cases',()=>{
 db.prepare("UPDATE users SET status='inactive' WHERE username='demo_student_1'").run();
 const id=db.prepare("SELECT id FROM cases WHERE source_key LIKE 'medschool:emergency:%:university:1' AND active=1 LIMIT 1").get().id;
 db.prepare('UPDATE cases SET active=0 WHERE id=?').run(id);
 const r=repairDemo({universityId:1,password:'Not-a-reset-12345',actorId:2});expect(r.accounts.find(a=>a.role==='student').status).toBe('inactive');expect(r.caseIds).not.toContain(id);
 expect(db.prepare('SELECT active FROM cases WHERE id=?').get(id).active).toBe(0);
});
it.each([
 {type:'order',items_fa:['',''],items_en:['first','second']},
 {type:'compare',entityA_en:'A',entityB_en:'B',features:[{fa:'',en:'English only',belongs:'A'},{fa:'فقط فارسی',en:'',belongs:'B'}]},
 {type:'fill',accept_fa:['الف','ب','ج'],accept_en:['A','B','C']}
])('preserves $type authoring data and identity across academic create/edit/read',async data=>{
 const payload={title_en:'R7 roundtrip',...data};
 const created=await request(app).post('/api/flashcards').auth(token,{type:'bearer'}).send(payload);expect(created.status).toBe(200);
 const id=created.body.id,before=db.prepare('SELECT public_code FROM flashcards WHERE id=?').get(id).public_code;
 expect((await request(app).put('/api/flashcards/'+id).auth(token,{type:'bearer'}).send({...payload,title_en:'Edited'})).status).toBe(200);
 const read=await request(app).get('/api/flashcards/'+id).auth(token,{type:'bearer'});expect(read.status).toBe(200);expect(read.body).toMatchObject(data);
 expect(db.prepare('SELECT public_code FROM flashcards WHERE id=?').get(id).public_code).toBe(before);
});
it.each([
 {type:'mcq',options:[{en:'A',correct:true},{en:'B',correct:false}],body:{optionIndex:null}},
 {type:'kf',kf:{items:[{kind:'mcq',correct:0,options_en:['A','B']}]},body:{answers:{0:false}}},
 {type:'hotspot',hotspot:{x:0,y:0,r:5},body:{x:null,y:null}}
])('never grades coerced empty $type submissions as correct through HTTP',async({body,...data})=>{
 const created=await request(app).post('/api/flashcards').auth(token,{type:'bearer'}).send({title_en:'Empty is not zero',...data});expect(created.status).toBe(200);
 const graded=await request(app).post('/api/flashcards/check').auth(token,{type:'bearer'}).send({cardId:created.body.id,...body});expect(graded.status).toBe(200);expect(graded.body.ok).toBe(false);expect(graded.body.pointsFrac).toBe(0);
});
