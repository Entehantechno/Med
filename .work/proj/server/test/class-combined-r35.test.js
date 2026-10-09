import {beforeAll,it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import request from 'supertest';
import {db,initDb} from '../src/db.js';
import {createApp} from '../src/app.js';
import {signToken} from '../src/lib/auth.js';
let app,token,outsider,cid,student,ids,version;
const get=()=>request(app).get(`/api/classes/${cid}/flashcards/config`).auth(token,{type:'bearer'});
const finish=(body={},key='r35-submission-key-00001',who=token)=>request(app).post(`/api/classes/${cid}/flashcards/finish`).auth(who,{type:'bearer'}).send({submissionId:key,version,answers:[],...body});
const count=()=>db.prepare('SELECT COUNT(*) n FROM class_flashcard_attempts WHERE class_id=?').get(cid).n;
beforeAll(async()=>{
 execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();app=createApp();
 const user=(name,uni)=>{const id=Number(db.prepare("INSERT INTO users(username,password_hash,role,status,university_id) VALUES (?,'fixture','student','active',?)").run(name,uni).lastInsertRowid);return db.prepare('SELECT * FROM users WHERE id=?').get(id)};
 student=user('combined-r35',1);token=signToken(student);outsider=signToken(user('combined-foreign-r35',2));
 cid=Number(db.prepare("INSERT INTO classes(name_en,university_id,max_attempts,exam_mode) VALUES ('Combined R35',1,2,'combined')").run().lastInsertRowid);
 db.prepare('INSERT INTO class_members(class_id,user_id) VALUES (?,?)').run(cid,student.id);
 ids=[{type:'mcq',track:'uni',q_en:'Pick A',options:[{text_en:'A',correct:true},{text_en:'B',correct:false}]},{type:'truefalse',track:'uni',q_en:'False?',answer:false}].map((d,i)=>{const id=Number(db.prepare('INSERT INTO flashcards(data_json,university_id,active) VALUES (?,1,1)').run(JSON.stringify(d)).lastInsertRowid);db.prepare('INSERT INTO class_flashcards(class_id,flashcard_id,graded,weight) VALUES (?,?,1,?)').run(cid,id,i+1);return id});
 version=(await get()).body.version;
},60000);
it('returns complete ordered deck only to an enrolled same-tenant student',async()=>{expect((await get()).body.ids).toEqual(ids);expect((await request(app).get(`/api/classes/${cid}/flashcards/config`).auth(outsider,{type:'bearer'})).status).toBe(403);expect((await finish({},'foreign-key-000001',outsider)).status).toBe(403);expect(count()).toBe(0)});
it('rejects duplicate/foreign IDs and mismatched version before writing anything',async()=>{for(const answers of [[{card_id:ids[0]},{card_id:ids[0]}],[{card_id:9999999}]])expect((await finish({answers})).status).toBe(400);expect((await finish({version:'a'.repeat(64)})).status).toBe(409);expect(count()).toBe(0)});
it('blocks individual submission in combined mode',async()=>{expect((await request(app).post(`/api/classes/${cid}/flashcard/${ids[0]}/finish`).auth(token,{type:'bearer'}).send({answers:[{card_id:ids[0]}]})).status).toBe(409);expect(count()).toBe(0)});
it('regrades all questions, applies weights, partitions duration and retries idempotently',async()=>{
 const body={answers:[{card_id:ids[0],selectedIdx:0},{card_id:ids[1],answer:false}],durationSec:11,score:0};
 const r=await finish(body);expect(r.status).toBe(200);expect(r.body.score).toBe(100);expect(count()).toBe(2);
 expect(db.prepare('SELECT SUM(duration_sec) n FROM class_flashcard_attempts WHERE class_id=?').get(cid).n).toBe(11);
 expect((await finish(body)).body).toEqual(r.body);expect(count()).toBe(2);
});
it('unanswered questions count zero and an exhausted deck rejects every row atomically',async()=>{
 const r=await finish({answers:[{card_id:ids[0],selectedIdx:0}]},'second-submission-key');expect(r.status).toBe(200);expect(r.body.score).toBe(33);expect(count()).toBe(4);
 expect((await finish({},'third-submission-key')).status).toBe(429);expect(count()).toBe(4);
 // Successful retry still works after quota is exhausted.
 expect((await finish()).status).toBe(200);expect(count()).toBe(4);
});
it('practice decks remain usable beyond graded quotas and mode changes take effect',async()=>{
 db.prepare('UPDATE class_flashcards SET graded=0 WHERE class_id=?').run(cid);version=(await get()).body.version;
 expect((await finish({},'practice-submission-key')).status).toBe(200);
 db.prepare("UPDATE classes SET exam_mode='perQuestion' WHERE id=?").run(cid);
 expect((await get()).status).toBe(409);
 expect((await request(app).post(`/api/classes/${cid}/flashcard/${ids[0]}/finish`).auth(token,{type:'bearer'}).send({answers:[{card_id:ids[0],selectedIdx:0}]})).status).toBe(200);
});
it('rolls back all per-question writes if any insert fails',async()=>{
 db.prepare("UPDATE classes SET exam_mode='combined' WHERE id=?").run(cid);version=(await get()).body.version;const before=count();
 db.exec(`CREATE TRIGGER r35_fail_insert BEFORE INSERT ON class_flashcard_attempts WHEN NEW.flashcard_id=${ids[1]} BEGIN SELECT RAISE(ABORT,'simulated_disk_failure'); END`);
 try{expect((await finish({},'rollback-submission-key')).status).toBe(500);expect(count()).toBe(before);expect(db.prepare("SELECT COUNT(*) n FROM class_flash_submissions WHERE submission_id='rollback-submission-key'").get().n).toBe(0)}finally{db.exec('DROP TRIGGER r35_fail_insert')}
});
