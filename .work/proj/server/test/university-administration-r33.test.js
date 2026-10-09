import {beforeAll,it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import request from 'supertest';
import {db,initDb} from '../src/db.js';
import {createApp} from '../src/app.js';
import {signToken} from '../src/lib/auth.js';
let app,admin,teacher,other,uni,foreign,caseId,cardId,group,exam,student;
const call=(token,method,url,body)=>request(app)[method]('/api'+url).auth(token,{type:'bearer'}).send(body);
beforeAll(async()=>{
 execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();app=createApp();
 uni=Number(db.prepare("INSERT INTO universities(code,name_en) VALUES ('R33-A','R33 A')").run().lastInsertRowid);
 foreign=Number(db.prepare("INSERT INTO universities(code,name_en) VALUES ('R33-B','R33 B')").run().lastInsertRowid);
 const user=(name,role,u)=>{const id=Number(db.prepare("INSERT INTO users(username,password_hash,role,status,university_id,student_no,name_en) VALUES (?,'fixture',?,'active',?,?,?)").run(name,role,u,name,name).lastInsertRowid);return db.prepare('SELECT * FROM users WHERE id=?').get(id)};
 admin=signToken(user('r33-admin','admin',foreign));teacher=signToken(user('r33-teacher','teacher',uni));other=signToken(user('r33-other','teacher',foreign));student=user('r33-student','student',uni);
 const maker=db.prepare("SELECT id FROM users WHERE username='r33-other'").get().id;
 caseId=Number(db.prepare("INSERT INTO cases(university_id,created_by,checklist_id,data_json) VALUES (?,?,1,?)").run(foreign,maker,JSON.stringify({title_en:'R33 source patient',track:'uni',age:40})).lastInsertRowid);
 cardId=Number(db.prepare("INSERT INTO flashcards(university_id,created_by,data_json) VALUES (?,?,?)").run(foreign,maker,JSON.stringify({title_en:'R33 source card',track:'uni',type:'mcq',q_en:'Question',options:[{en:'A',correct:true},{en:'B'}]})).lastInsertRowid);
 group=Number(db.prepare("INSERT INTO classes(name_en,code,owner_id,university_id) VALUES ('R33','R33-CLASS',?,?)").run(db.prepare("SELECT id FROM users WHERE username='r33-teacher'").get().id,uni).lastInsertRowid);
 exam=Number(db.prepare("INSERT INTO exams(title_en,owner_id,university_id) VALUES ('R33 exam',?,?)").run(db.prepare("SELECT id FROM users WHERE username='r33-teacher'").get().id,uni).lastInsertRowid);
},60000);
it('administrator reads all teacher-authored cases and cards across universities',async()=>{for(const[kind,id]of[['cases',caseId],['flashcards',cardId]]){const r=await call(admin,'get','/'+kind);expect(r.status).toBe(200);expect(r.body.some(x=>x.id===id)).toBe(true)}});
it('admin explicit class university wins over administrator membership',async()=>{const r=await call(admin,'post','/classes',{name_en:'Chosen university',university_id:uni});expect(r.status).toBe(200);expect(db.prepare('SELECT university_id FROM classes WHERE id=?').get(r.body.id).university_id).toBe(uni)});
it('admin explicit exam university wins over administrator membership',async()=>{const r=await call(admin,'post','/exams',{title_en:'Chosen university',university_id:uni});expect(r.status).toBe(200);expect(db.prepare('SELECT university_id FROM exams WHERE id=?').get(r.body.id).university_id).toBe(uni)});
it('invalid explicit university is rejected, not silently defaulted',async()=>{for(const path of ['/classes','/exams'])expect((await call(admin,'post',path,{name_en:'Invalid',title_en:'Invalid',university_id:999999})).status).toBe(400)});
for(const[kind,id]of [['cases',()=>caseId],['flashcards',()=>cardId]]){
 it(kind+': only admin can publish, and teachers cannot edit shared original',async()=>{
  expect((await call(teacher,'put',`/academic/content/${kind}/${id()}/sharing`,{enabled:true})).status).toBe(403);
  expect((await call(admin,'put',`/academic/content/${kind}/${id()}/sharing`,{enabled:'true'})).status).toBe(400);
  expect((await call(admin,'put',`/academic/content/${kind}/${id()}/sharing`,{enabled:true})).status).toBe(200);
  expect((await call(teacher,'get','/'+kind)).body.some(x=>x.id===id())).toBe(true);
  expect((await call(teacher,'get',`/${kind}/${id()}`)).status).toBe(200);
  expect((await call(teacher,'delete',`/${kind}/${id()}`)).status).toBe(403);
  expect((await call(signToken(student),'get','/'+kind)).body.some(x=>x.id===id())).toBe(false);
 });
 it(kind+': assignment copies shared source into target university and is idempotent',async()=>{
  const key=kind==='cases'?'case_id':'flashcard_id';const body={[kind]:[{[key]:id(),weight:1}]};
  const first=await call(teacher,'put',`/classes/${group}/${kind}`,body);expect(first.status).toBe(200);expect(first.body.skipped).toBe(0);
  const table=kind==='cases'?'class_cases':'class_flashcards';const rows=()=>db.prepare(`SELECT ${key} id FROM ${table} WHERE class_id=?`).all(group);const copied=rows()[0].id;expect(copied).not.toBe(id());expect(db.prepare(`SELECT university_id FROM ${kind} WHERE id=?`).get(copied).university_id).toBe(uni);
  expect((await call(teacher,'put',`/classes/${group}/${kind}`,body)).status).toBe(200);expect(rows()[0].id).toBe(copied);
 });
 it(kind+': withdrawing share hides original without removing assigned independent copy',async()=>{expect((await call(admin,'put',`/academic/content/${kind}/${id()}/sharing`,{enabled:false})).status).toBe(200);expect((await call(teacher,'get','/'+kind)).body.some(x=>x.id===id())).toBe(false);expect((await call(teacher,'get',`/${kind}/${id()}`)).status).toBe(403)});
}
it('malformed class replacement does not erase existing attachments',async()=>{for(const kind of ['cases','flashcards']){const before=db.prepare(`SELECT * FROM class_${kind} WHERE class_id=?`).all(group);expect((await call(admin,'put',`/classes/${group}/${kind}`,{})).status).toBe(400);expect(db.prepare(`SELECT * FROM class_${kind} WHERE class_id=?`).all(group)).toEqual(before)}});
it('admin may assign private cross-university content by independent copy',async()=>{const r=await call(admin,'put',`/classes/${group}/cases`,{cases:[{case_id:caseId}]});expect(r.status).toBe(200);expect(r.body.added).toBe(1);expect(r.body.skipped).toBe(0)});
it('directory is server-paged, scoped, searchable by student number and sorts globally',async()=>{
 const ins=db.prepare("INSERT INTO users(username,password_hash,role,status,university_id,student_no,name_en) VALUES (?,'fixture','student','active',?,?,?)");for(let i=0;i<350;i++)ins.run('r33-many-'+i,uni,'9033'+String(i).padStart(4,'0'),'Person '+i);
 const r=await call(admin,'get',`/academic/groups/classes/${group}/students?page=4&pageSize=100&prefix=9033&sort=student_no`);expect(r.status).toBe(200);expect(r.body.total).toBe(350);expect(r.body.items).toHaveLength(50);expect(r.body.items[0].student_no).toBe('90330300');
 expect((await call(other,'get',`/academic/groups/classes/${group}/students`)).status).toBe(403);
});
for(const[kind,getId]of[['classes',()=>group],['exams',()=>exam]])it(kind+': membership deltas are atomic, idempotent, and preserve unrelated members',async()=>{
 const path=`/academic/groups/${kind}/${getId()}/members`;expect((await call(admin,'put',path,{addIds:[student.id],removeIds:[]})).status).toBe(200);expect((await call(admin,'put',path,{addIds:[student.id],removeIds:[]})).status).toBe(200);
 const foreignStudent=Number(db.prepare("INSERT INTO users(username,password_hash,role,status,university_id) VALUES (?,'fixture','student','active',?)").run('r33-foreign-'+kind,foreign).lastInsertRowid);
 expect((await call(admin,'put',path,{addIds:[foreignStudent],removeIds:[student.id]})).status).toBe(422);
 const r=await call(admin,'get',`/academic/groups/${kind}/${getId()}/students?q=r33-student`);expect(r.body.items.find(x=>x.id===student.id).member).toBe(1);
 expect((await call(other,'put',path,{addIds:[],removeIds:[student.id]})).status).toBe(403);
});
it('admin users beyond 300 can be paged and filtered on server',async()=>{const r=await call(admin,'get',`/admin/users?q=r33-many-&page=4&pageSize=100&university_id=${uni}`);expect(r.status).toBe(200);expect(r.body.total).toBe(350);expect(r.body.users).toHaveLength(50)});
it('scheduled exam also materializes admin-selected private content without moving source',async()=>{
 const r=await call(admin,'put',`/exams/${exam}`,{title_en:'Copied exam content',case_ids:[caseId],flashcard_ids:[cardId]});expect(r.status).toBe(200);
 const ex=db.prepare('SELECT * FROM exams WHERE id=?').get(exam);for(const[kind,key,source]of[['cases','case_ids',caseId],['flashcards','flashcard_ids',cardId]]){const id=JSON.parse(ex[key])[0];expect(id).not.toBe(source);expect(db.prepare(`SELECT university_id FROM ${kind} WHERE id=?`).get(id).university_id).toBe(uni);expect(db.prepare(`SELECT university_id FROM ${kind} WHERE id=?`).get(source).university_id).toBe(foreign)}
});
it('empty mis-associated groups can be repaired by admin but nonempty groups cannot be silently moved',async()=>{
 const id=Number(db.prepare("INSERT INTO classes(name_en,code,owner_id,university_id) VALUES ('Misassociated','R33-EMPTY',1,NULL)").run().lastInsertRowid);
 expect((await call(admin,'put',`/academic/groups/classes/${id}/university`,{university_id:uni})).status).toBe(200);
 expect(db.prepare('SELECT university_id FROM classes WHERE id=?').get(id).university_id).toBe(uni);
 expect((await call(admin,'put',`/academic/groups/classes/${group}/university`,{university_id:foreign})).status).toBe(409);
 expect((await call(teacher,'put',`/academic/groups/classes/${id}/university`,{university_id:foreign})).status).toBe(403);
});
it('published media is teacher-only; copied media is local and source revocation does not break the copy',async()=>{
 const image=Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64');
 const upload=await request(app).post('/api/upload').auth(other,{type:'bearer'}).attach('image',image,{filename:'r33.gif',contentType:'image/gif'});expect(upload.status).toBe(200);
 const url=upload.body.url,chart=JSON.parse(db.prepare('SELECT data_json FROM cases WHERE id=?').get(caseId).data_json);chart.images=[{url,label_en:'Teaching image'}];db.prepare('UPDATE cases SET data_json=?,version=version+1 WHERE id=?').run(JSON.stringify(chart),caseId);
 expect((await request(app).get(url).auth(teacher,{type:'bearer'})).status).toBe(404);
 await call(admin,'put',`/academic/content/cases/${caseId}/sharing`,{enabled:true});
 expect((await request(app).get(url).auth(teacher,{type:'bearer'})).status).toBe(200);expect((await request(app).get(url).auth(signToken(student),{type:'bearer'})).status).toBe(404);
 const outsider=Number(db.prepare("INSERT INTO users(username,password_hash,role,status) VALUES ('r33-unassigned-teacher','fixture','teacher','active')").run().lastInsertRowid);const outsiderToken=signToken(db.prepare('SELECT * FROM users WHERE id=?').get(outsider));expect((await request(app).get(url).auth(outsiderToken,{type:'bearer'})).status).toBe(200);expect((await call(outsiderToken,'post',`/academic/content/cases/${caseId}/copy`,{})).status).toBe(400);
 const copied=await call(teacher,'post',`/academic/content/cases/${caseId}/copy`,{});expect(copied.status).toBe(200);
 const row=db.prepare('SELECT * FROM cases WHERE id=?').get(copied.body.id);const local=JSON.parse(row.data_json).images[0].url;expect(local).toContain(`/university-${uni}/`);expect(local).not.toBe(url);expect(row.reference_policy_id).toBeNull();
 await call(admin,'put',`/academic/content/cases/${caseId}/sharing`,{enabled:false});expect((await request(app).get(url).auth(teacher,{type:'bearer'})).status).toBe(404);expect((await request(app).get(local).auth(signToken(student),{type:'bearer'})).status).toBe(200);
});
it('failed mixed content assignment rolls back copies and preserves old class selection',async()=>{
 const before=db.prepare('SELECT * FROM class_cases WHERE class_id=?').all(group),count=db.prepare('SELECT COUNT(*) n FROM cases').get().n;
 const r=await call(admin,'put',`/classes/${group}/cases`,{cases:[{case_id:caseId},{case_id:999999}]});expect(r.status).toBe(422);expect(db.prepare('SELECT * FROM class_cases WHERE class_id=?').all(group)).toEqual(before);expect(db.prepare('SELECT COUNT(*) n FROM cases').get().n).toBe(count);
});
it('missing membership fields cannot clear the class or exam roster',async()=>{for(const[kind,id]of[['classes',group],['exams',exam]])expect((await call(admin,'put',`/academic/groups/${kind}/${id}/members`,{})).status).toBe(400)});
it('university candidate pagination reaches students beyond the legacy 200 cap',async()=>{const r=await call(admin,'get',`/universities/${foreign}/candidates?prefix=9033&role=student&page=4&pageSize=100&lang=en`);expect(r.status).toBe(200);expect(r.body.total).toBe(350);expect(r.body.candidates).toHaveLength(50);expect(r.body.candidates[0].student_no).toBe('90330300')});
it('malformed university transfer cannot partly move valid users',async()=>{const before=db.prepare('SELECT university_id FROM users WHERE id=?').get(student.id);expect((await call(admin,'post',`/universities/${foreign}/members`,{userIds:[student.id,'12bad']})).status).toBe(400);expect(db.prepare('SELECT university_id FROM users WHERE id=?').get(student.id)).toEqual(before)});
