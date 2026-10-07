import {beforeAll,afterEach,it,expect,vi} from 'vitest';
import {execFileSync} from 'node:child_process';import fs from 'node:fs';import request from 'supertest';
import {initDb,db,persistNow,reloadDb} from '../src/db.js';import {DB_PATH} from '../src/lib/paths.js';import {createApp} from '../src/app.js';import {signToken} from '../src/lib/auth.js';
let app,a,b,seq=0;
const A=token=>({Authorization:`Bearer ${token}`});
function fixture(kind='class',role='student'){
 const uid=Number(db.prepare("INSERT INTO users(username,password_hash,role,university_id,status) VALUES (?,'fixture',?,?,'active')").run('r18-'+(++seq),role,a).lastInsertRowid);
 const table=kind==='class'?'classes':'exams',column=kind==='class'?'name_en':'title_en';const id=Number(db.prepare(`INSERT INTO ${table}(${column},university_id,tutor_enabled,active) VALUES ('R18',?,1,1)`).run(a).lastInsertRowid);
 db.prepare(`INSERT INTO ${kind==='class'?'class_members(class_id':'exam_participants(exam_id'},user_id) VALUES (?,?)`).run(id,uid);
 return {uid,id,kind,table,token:signToken(db.prepare('SELECT * FROM users WHERE id=?').get(uid))};
}
const count=f=>db.prepare('SELECT COUNT(*) n FROM tutor_chats WHERE user_id=?').get(f.uid).n;
const message=f=>request(app).post('/api/tutor/message').set(A(f.token)).send({contextType:f.kind,contextId:f.id,message:'Synthetic clinical reasoning question',lang:'en'});
async function denied(f){const before=count(f);for(const path of ['status','history'])expect((await request(app).get(`/api/tutor/${path}?contextType=${f.kind}&contextId=${f.id}`).set(A(f.token))).status,path).toBe(403);expect((await message(f)).status).toBe(403);expect(count(f)).toBe(before);}
beforeAll(async()=>{execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();a=Number(db.prepare("INSERT INTO universities(name_en,code) VALUES ('R18 A','r18-a')").run().lastInsertRowid);b=Number(db.prepare("INSERT INTO universities(name_en,code) VALUES ('R18 B','r18-b')").run().lastInsertRowid);db.prepare('UPDATE tutor_settings SET enabled=1 WHERE id=1').run();app=createApp();},60000);
afterEach(()=>{vi.restoreAllMocks();db.exec('DROP TRIGGER IF EXISTS r18_fail_reply');});
for(const kind of ['class','exam'])for(const event of ['transfer','removed','inactive'])it(`denies all tutor endpoints for ${kind} after ${event} despite retained enrollment`,async()=>{
 const f=fixture(kind);expect((await message(f)).status).toBe(200);
 if(event==='inactive')db.prepare(`UPDATE ${f.table} SET active=0 WHERE id=?`).run(f.id);
 else db.prepare('UPDATE users SET university_id=? WHERE id=?').run(event==='transfer'?b:null,f.uid);
 await denied(f);
});
it('rolls back the user message if inserting the tutor reply fails',async()=>{
 const f=fixture();persistNow();db.exec("CREATE TRIGGER r18_fail_reply BEFORE INSERT ON tutor_chats WHEN NEW.role='tutor' BEGIN SELECT RAISE(ABORT,'R18 simulated reply failure'); END");
 expect((await message(f)).status).toBeGreaterThanOrEqual(500);expect(count(f)).toBe(0);
});
it('does not acknowledge or retain a message pair when durable persistence fails',async()=>{
 const f=fixture();persistNow();const rename=fs.renameSync;
 vi.spyOn(fs,'renameSync').mockImplementation((src,dst)=>{if(dst===DB_PATH && count(f)>0)throw Error('R18 simulated post-write persistence failure');return rename(src,dst);});
 const r=await message(f);vi.restoreAllMocks();expect(r.status).toBeGreaterThanOrEqual(500);expect(count(f)).toBe(0);
 expect((await message(f)).status).toBe(200);expect(count(f)).toBe(2);await reloadDb();expect(count(f)).toBe(2);
});
for(const kind of ['class','exam']){
 it(`saves a valid ${kind} exchange and preserves ordered history across reload`,async()=>{
  const f=fixture(kind);const r=await message(f);expect(r.status).toBe(200);expect(r.body.reply).toContain('Synthetic clinical reasoning question');
  await reloadDb();const rows=db.prepare('SELECT role,message,meta_json FROM tutor_chats WHERE user_id=? ORDER BY id').all(f.uid);expect(rows.map(x=>x.role)).toEqual(['user','tutor']);expect(JSON.parse(rows[1].meta_json).ai).toBe(false);
  const history=await request(app).get(`/api/tutor/history?contextType=${kind}&contextId=${f.id}`).set(A(f.token));expect(history.status).toBe(200);expect(history.body.messages.map(x=>x.message)).toEqual(rows.map(x=>x.message));
 });
 it(`blocks a retained ${kind} enrollment when the parent belongs to another university`,async()=>{
  const f=fixture(kind);db.prepare(`UPDATE ${f.table} SET university_id=? WHERE id=?`).run(b,f.id);await denied(f);
 });
 it(`blocks tutor access after ${kind} enrollment removal`,async()=>{
  const f=fixture(kind);db.prepare(`DELETE FROM ${kind==='class'?'class_members WHERE class_id':'exam_participants WHERE exam_id'}=? AND user_id=?`).run(f.id,f.uid);await denied(f);
 });
 it(`blocks tutor access after ${kind} deletion`,async()=>{
  const f=fixture(kind);db.prepare(`DELETE FROM ${f.table} WHERE id=?`).run(f.id);await denied(f);
 });
}
for(const role of ['teacher','admin','learner','content_manager'])it(`does not let ${role} use a student's class tutor`,async()=>{await denied(fixture('class',role));});
it('keeps the learner general tutor functional without university enrollment',async()=>{
 const f=fixture('class','learner');db.prepare('UPDATE users SET university_id=NULL WHERE id=?').run(f.uid);
 const r=await request(app).post('/api/tutor/message').set(A(f.token)).send({message:'Synthetic general question',lang:'en'});expect(r.status).toBe(200);expect(r.body.reply).toContain('Synthetic general question');expect(count(f)).toBe(2);
});
it('rejects disabled and empty messages without recording a partial exchange',async()=>{
 const f=fixture();db.prepare('UPDATE tutor_settings SET enabled=0 WHERE id=1').run();db.prepare('UPDATE classes SET tutor_enabled=0 WHERE id=?').run(f.id);
 try{expect((await message(f)).status).toBe(403);expect(count(f)).toBe(0);}finally{db.prepare('UPDATE tutor_settings SET enabled=1 WHERE id=1').run();}
 const r=await request(app).post('/api/tutor/message').set(A(f.token)).send({contextType:'class',contextId:f.id,message:'   '});expect(r.status).toBe(400);expect(count(f)).toBe(0);
});
