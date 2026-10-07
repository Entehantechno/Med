import {beforeAll,it,expect} from 'vitest';
import crypto from 'node:crypto';
import {readPortableZip,createPortableZip} from '../src/lib/portable-zip.js';
import {execFileSync} from 'node:child_process';
import {initDb,db,persistNow,reloadDb} from '../src/db.js';
import {createUniversityBundle,importUniversityBundle} from '../src/routes/portable.js';
let bundle,source;
beforeAll(async()=>{
 execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();
 const uid=db.prepare("SELECT id FROM users WHERE username='40012345'").get().id;
 db.prepare('UPDATE users SET university_id=1 WHERE id=?').run(uid);
 const study=Number(db.prepare("INSERT INTO research_studies(title_en) VALUES ('R14 study')").run().lastInsertRowid);
 const cls=Number(db.prepare("INSERT INTO classes(name_en,university_id,study_id) VALUES ('R14 class',1,?)").run(study).lastInsertRowid);
 const exam=Number(db.prepare("INSERT INTO exams(title_en,university_id,study_id) VALUES ('R14 exam',1,?)").run(study).lastInsertRowid);
 const caseId=Number(db.prepare("INSERT INTO cases(data_json,university_id) VALUES (?,1)").run(JSON.stringify({title_en:'R14 case'})).lastInsertRowid);
 source={class:cls,exam,case:caseId,study};
 for(const type of ['class','exam']){
  const form=Number(db.prepare('INSERT INTO questionnaire_forms(title_en,scope,class_id,exam_id,anonymous) VALUES (?,?,?,?,1)').run('R14 '+type,type,type==='class'?cls:null,type==='exam'?exam:null).lastInsertRowid);
  db.prepare("INSERT INTO questionnaire_responses(form_id,user_id,context_type,context_id,answers_json,pseudonym) VALUES (?,NULL,?,?,?,?)").run(form,type,source[type],'{"answer":"original"}','r14-anonymous');
 }
 for(const type of ['class','exam','case','study','general']){
  db.prepare("INSERT INTO research_events(study_id,user_id,event_type,context_type,context_id,data_json) VALUES (?,?,'note',?,?,?)").run(study,uid,type,type==='general'?null:source[type],JSON.stringify({marker:'r14-'+type,originalText:'historical payload'}));
 }
 persistNow();bundle=createUniversityBundle(db.prepare('SELECT * FROM universities WHERE id=1').get(),{full:true}).buffer;
},60000);
for(const type of ['class','exam'])it(`remaps anonymous questionnaire ${type} context to the restored form context`,async()=>{
 const result=await importUniversityBundle(bundle);const column=type+'_id';
 const row=db.prepare(`SELECT q.context_id,q.user_id,q.pseudonym,q.answers_json,f.${column} expected FROM questionnaire_responses q JOIN questionnaire_forms f ON f.id=q.form_id JOIN ${type==='class'?'classes':'exams'} c ON c.id=f.${column} WHERE c.university_id=? AND f.title_en=?`).get(result.university_id,'R14 '+type);
 expect(row.context_id).toBe(row.expected);expect(row.context_id).not.toBe(source[type]);expect(row.user_id).toBeNull();expect(row.pseudonym).toBe('r14-anonymous');expect(row.answers_json).toBe('{"answer":"original"}');
});
for(const type of ['class','exam','case','study'])it(`remaps research event ${type} context without rewriting payload`,async()=>{
 const result=await importUniversityBundle(bundle);const cls=db.prepare("SELECT * FROM classes WHERE university_id=? AND name_en='R14 class'").get(result.university_id);
 const row=db.prepare('SELECT * FROM research_events WHERE study_id=? AND context_type=?').get(cls.study_id,type);
 const expected=type==='class'?cls.id:type==='study'?cls.study_id:type==='exam'?db.prepare("SELECT id FROM exams WHERE university_id=? AND title_en='R14 exam'").get(result.university_id).id:db.prepare("SELECT id FROM cases WHERE university_id=? AND data_json LIKE '%R14 case%'").get(result.university_id).id;
 expect(row.context_id).toBe(expected);expect(row.context_id).not.toBe(source[type]);expect(row.data_json).toBe(JSON.stringify({marker:'r14-'+type,originalText:'historical payload'}));
});

for(const [file,key,label] of [['questionnaires.json','responses','questionnaire'],['research.json','events','research_event']])it(`rejects dangling ${label} context before database changes`,async()=>{
 const entries=readPortableZip(bundle),manifest=JSON.parse(entries.find(e=>e.path==='manifest.json').data),entry=entries.find(e=>e.path.endsWith('/'+file));
 const data=JSON.parse(entry.data);data[key].find(r=>r.context_type==='class').context_id=99999999;entry.data=Buffer.from(JSON.stringify(data));
 const digest=b=>crypto.createHash('sha256').update(b).digest('hex');const record=manifest.files.find(f=>f.path===entry.path);record.sha256=digest(entry.data);record.size=entry.data.length;
 const m=entries.find(e=>e.path==='manifest.json');m.data=Buffer.from(JSON.stringify(manifest));entries.find(e=>e.path==='manifest.sha256').data=Buffer.from(digest(m.data)+'  manifest.json\n');
 const before=db.prepare('SELECT COUNT(*) n FROM universities').get().n;await expect(importUniversityBundle(createPortableZip(entries))).rejects.toThrow(label+'_context_invalid');expect(db.prepare('SELECT COUNT(*) n FROM universities').get().n).toBe(before);
});
it('preserves general null context and mapped links after database reload',async()=>{
 const result=await importUniversityBundle(bundle);await reloadDb();
 const cls=db.prepare("SELECT * FROM classes WHERE university_id=? AND name_en='R14 class'").get(result.university_id);
 const general=db.prepare("SELECT * FROM research_events WHERE study_id=? AND context_type='general'").get(cls.study_id);expect(general.context_id).toBeNull();expect(JSON.parse(general.data_json).marker).toBe('r14-general');
 const event=db.prepare("SELECT * FROM research_events WHERE study_id=? AND context_type='class'").get(cls.study_id);expect(event.context_id).toBe(cls.id);
 const response=db.prepare('SELECT q.* FROM questionnaire_responses q JOIN questionnaire_forms f ON f.id=q.form_id WHERE f.class_id=?').get(cls.id);expect(response.context_id).toBe(cls.id);expect(response.user_id).toBeNull();
});
