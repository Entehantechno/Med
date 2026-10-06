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
