import { beforeAll, describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import request from 'supertest';
import { masterSourceKey } from '../src/lib/content-identity.js';
import { initDb, initSchema, db, persistNow, reloadDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { commitOfficialImport, resetOfficialImportCaches } from '../src/routes/admin.js';
let app, admin, learner;
beforeAll(async () => {
  execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});
  await initDb(); app=createApp();
  admin=(await request(app).post('/api/auth/login').send({username:'admin',password:'demo'})).body.token;
  learner=(await request(app).post('/api/auth/login').send({username:'learner',password:'demo'})).body.token;
},60000);
const get=(table,id)=>db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
const insert=(table,data)=>db.prepare(`INSERT INTO ${table}(data_json) VALUES (?)`).run(JSON.stringify(data)).lastInsertRowid;
describe('permanent content identities',()=>{
 it('recognizes every shipped source-ID family, including residency courses',()=>{
  for(const tag of ['QB-00001','RES-QB-00001','TB-P51-00001','TB-P52-00001']) expect(masterSourceKey({tags:[tag]})).toBe('medschool:master-bank:'+tag);
  expect(masterSourceKey({tags:'bad input'})).toBeNull();
 });
 it('assigns all three prefixes, survives edits, and rejects identity tampering',()=>{
  for(const [table,track,prefix] of [['cases','uni','VP-'],['flashcards','uni','FC-'],['flashcards','learn','Q-']]){
   const id=insert(table,{track,q_fa:'original'}), code=get(table,id).public_code;
   expect(code).toMatch(new RegExp(`^${prefix}[0-9a-f]{32}$`));
   db.prepare(`UPDATE ${table} SET data_json=? WHERE id=?`).run(JSON.stringify({track,q_fa:'edited'}),id);
   expect(get(table,id).public_code).toBe(code);
   expect(()=>db.prepare(`UPDATE ${table} SET public_code='forged' WHERE id=?`).run(id)).toThrow(/immutable/);
   db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
   expect(db.prepare('SELECT deleted_at FROM content_identity_registry WHERE public_code=?').get(code).deleted_at).toBeTruthy();
   expect(()=>db.prepare(`INSERT INTO ${table}(data_json,public_code) VALUES ('{}',?)`).run(code)).toThrow();
   expect(()=>db.prepare(`INSERT OR REPLACE INTO ${table}(data_json,public_code) VALUES ('{}',?)`).run(code)).toThrow();
   // Explicitly reusing a local PK cannot reuse its public identity.
   db.prepare(`INSERT INTO ${table}(id,data_json) VALUES (?,?)`).run(id,JSON.stringify({track}));
   expect(get(table,id).public_code).not.toBe(code);
  }
 });
 it('prevents upgrade duplicates after editing, disabling and deleting a sourced question', async()=>{
  const q={tags:['QB-999991'],question_no:999991,subject_fa:'قلب',subject_en:'Cardiology',chapter_fa:'آزمون',question_fa:'اصل سؤال',question_en:'Source stem',options_fa:['الف','ب','ج','د'],correct_index:0,explanation_fa:'توضیح آموزشی'};
  const body={program:'preint',questions:[q]};
  expect(commitOfficialImport(body).inserted).toBe(1);
  const row=db.prepare("SELECT * FROM flashcards WHERE source_key='medschool:master-bank:QB-999991'").get();
  db.prepare('UPDATE flashcards SET data_json=?,active=0 WHERE id=?').run(JSON.stringify({track:'learn',q_fa:'teacher edit, no source metadata'}),row.id);
  persistNow(); await reloadDb(); initSchema(); resetOfficialImportCaches();
  expect(commitOfficialImport({...body,questions:[{...q,question_fa:'new release wording'}]}).inserted).toBe(0);
  expect(get('flashcards',row.id).public_code).toBe(row.public_code);
  expect(JSON.parse(get('flashcards',row.id).data_json).q_fa).toContain('teacher edit');
  db.prepare('DELETE FROM flashcards WHERE id=?').run(row.id);
  expect(commitOfficialImport(body).inserted).toBe(0);
  expect(commitOfficialImport({...body,questions:[{...q,tags:['QB-999992']}]}).inserted).toBe(1);
 });
 it('keeps distinct source questions even when their normalized text collides',()=>{
  const common={question_fa:'Same clinical stem',options_fa:['a','b','c','d'],correct_index:0};
  const result=commitOfficialImport({questions:[{...common,tags:['TB-999993']},{...common,tags:['TB-999994']}]});
  expect(result.inserted).toBe(2);
 });
 it('exposes searchable canonical codes in the admin bank',async()=>{
  const id=insert('flashcards',{track:'learn',type:'mcq',q_fa:'Unique test card'});
  const code=get('flashcards',id).public_code;
  const r=await request(app).get('/api/admin/learn-cards').query({q:code}).auth(admin,{type:'bearer'});
  expect(r.status).toBe(200);expect(r.body.cards.map(c=>c.public_code)).toEqual([code]);
  const detail=await request(app).get('/api/admin/learn-cards/'+id).auth(admin,{type:'bearer'});
  expect(detail.body.card.public_code).toBe(code);
 });
});
describe('academic-only virtual patient',()=>{
 it('blocks old competitive APIs even if legacy settings enable them',async()=>{
  db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('vpatient',?)").run(JSON.stringify({enabled:true,premium_only:false}));
  expect((await request(app).get('/api/learn/vpatient').auth(learner,{type:'bearer'})).status).toBe(410);
  expect((await request(app).get('/api/cases/1').auth(learner,{type:'bearer'})).status).toBe(403);
  expect((await request(app).post('/api/exam/session-start').send({caseId:1}).auth(learner,{type:'bearer'})).status).toBe(403);
  expect((await request(app).put('/api/admin/vpatient').send({config:{enabled:true}}).auth(admin,{type:'bearer'})).status).toBe(410);
  expect(()=>insert('cases',{track:'learn'})).toThrow(/university_only/);
  expect((await request(app).post('/api/cases').send({track:'learn'}).auth(admin,{type:'bearer'})).status).toBe(400);
 });
 it('has no competitive cases on a fresh seed',()=>{
  expect(db.prepare("SELECT COUNT(*) n FROM cases WHERE json_extract(data_json,'$.track')='learn'").get().n).toBe(0);
 });
});
