import { beforeAll, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { db, initDb, initSchema, persistNow, reloadDb } from '../src/db.js';
let seq=0;
beforeAll(async()=>{execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();initSchema();},60000);
for(const role of ['teacher','student'])it(`${role}: boot does not reassign a deliberately cleared university`,async()=>{
 const id=Number(db.prepare("INSERT INTO users(username,password_hash,role,status,university_id) VALUES (?,'fixture',?,'active',1)").run('r26-restart-'+(++seq),role).lastInsertRowid);
 db.prepare('UPDATE users SET university_id=NULL WHERE id=?').run(id);persistNow({throwOnError:true});await reloadDb();initSchema();
 expect(db.prepare('SELECT university_id FROM users WHERE id=?').get(id).university_id).toBeNull();
});
it('legacy database without membership column is backfilled once, not on later boots',()=>{
 const script=`
 import fs from 'node:fs';import path from 'node:path';import initSql from 'sql.js';
 const SQL=await initSql();const raw=new SQL.Database();
 raw.run("CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,name_fa TEXT,name_en TEXT,student_no TEXT,role TEXT NOT NULL CHECK(role IN ('student','teacher','admin','learner','content_manager','support')),status TEXT DEFAULT 'active',created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
 raw.run("INSERT INTO users(username,password_hash,role) VALUES ('legacy-teacher','fixture','teacher'),('legacy-student','fixture','student'),('legacy-admin','fixture','admin')");
 fs.mkdirSync(process.env.DATA_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.DATA_DIR,'medlab.db'),raw.export());raw.close();
 const {initDb,initSchema,db,persistNow,reloadDb}=await import('./src/db.js');await initDb();initSchema();
 const first=db.prepare('SELECT role,university_id FROM users ORDER BY id').all();
 db.prepare("UPDATE users SET university_id=NULL WHERE username='legacy-teacher'").run();persistNow({throwOnError:true});await reloadDb();initSchema();
 console.log(JSON.stringify({first,after:db.prepare("SELECT university_id FROM users WHERE username='legacy-teacher'").get()}));
 `;
 const output=execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,DATA_DIR:process.env.DATA_DIR+'-legacy'},encoding:'utf8'});
 const result=JSON.parse(output.trim().split('\n').at(-1));
 expect(result.first.slice(0,3)).toEqual([{role:'teacher',university_id:1},{role:'student',university_id:1},{role:'admin',university_id:null}]);expect(result.after.university_id).toBeNull();
},60000);
it('fresh demo assigns the built-in teacher and students explicitly',()=>{
 expect(db.prepare("SELECT university_id FROM users WHERE username='teacher'").get().university_id).toBe(1);
 expect(db.prepare("SELECT university_id FROM users WHERE username='40012345'").get().university_id).toBe(1);
 expect(db.prepare("SELECT university_id FROM users WHERE username='admin'").get().university_id).toBeNull();
});
