// Run only on a COPY of the delivery database: this writes login/session events.
import assert from 'node:assert/strict';
import request from 'supertest';
import {initDb,initSchema,db} from '../src/db.js';
import {createApp} from '../src/app.js';
await initDb();initSchema();const app=createApp(), tokens={};
for(const username of ['admin','teacher','40012345','learner']) {
 const r=await request(app).post('/api/auth/login').send({username,password:'demo'});
 assert.equal(r.status,200,username);tokens[username]=r.body.token;
}
const get=(url,who='admin')=>request(app).get('/api'+url).auth(tokens[who],{type:'bearer'});
assert.equal((await get('/health')).status,200);
const cases=await get('/cases?status=all');assert.equal(cases.status,200);assert.equal(cases.body.length,23);
assert.equal(cases.body.filter(c=>c.active).length,13);assert(cases.body.every(c=>c.public_code.startsWith('VP-')));
const student=await get('/cases','40012345');assert.equal(student.status,200);assert(student.body.some(c=>c.id===2));
assert(student.body.every(c=>c.public_code && !c.diagnosis_fa));
assert.equal((await get('/cases','learner')).status,403);
assert.equal((await get('/learn/vpatient','learner')).status,410);
const cards=await get('/flashcards?status=all');assert.equal(cards.status,200);assert(cards.body.every(c=>c.public_code.startsWith('FC-')));
const row=db.prepare("SELECT public_code FROM flashcards WHERE source_key='medschool:master-bank:QB-00001'").get();
const bank=await get('/admin/learn-cards?q='+encodeURIComponent(row.public_code));assert.equal(bank.status,200);assert.equal(bank.body.cards.length,1);
const browse=await get('/learn/browse?q='+encodeURIComponent(row.public_code),'learner');assert.equal(browse.status,200);assert.equal(browse.body.bankTotal,1); // free accounts must not bypass the premium bank gate
const previews=await get("/learn/browse","learner");const previewCode=previews.body.cards[0]?.public_code;assert(previewCode);
const previewSearch=await get("/learn/browse?q="+encodeURIComponent(previewCode),"learner");assert.equal(previewSearch.body.cards[0]?.public_code,previewCode);
const start=await request(app).post('/api/exam/session-start').auth(tokens['40012345'],{type:'bearer'}).send({caseId:2});assert.equal(start.status,200,JSON.stringify(start.body));
const blocked=await request(app).post('/api/exam/session-start').auth(tokens.learner,{type:'bearer'}).send({caseId:2});assert.equal(blocked.status,403);
const mode=db.prepare('PRAGMA table_info(classes)').all().find(c=>c.name==='exam_mode');assert.equal(mode.type,'TEXT');assert.equal(mode.dflt_value,"'perQuestion'");
console.log(JSON.stringify({fourDemoLogins:'ok',health:'ok',cases:23,activeAcademic:13,academicCards:cards.body.length,studentUniversityVP:'ok',competitiveVP:'blocked',bankCodeSearch:'ok',learnerCodeSearch:'ok',examMode:'TEXT DEFAULT perQuestion'},null,2));
