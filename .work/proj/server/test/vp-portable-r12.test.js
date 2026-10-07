import {beforeAll,afterEach,it,expect,vi} from 'vitest';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';
import {initDb,db,persistNow,reloadDb,initSchema} from '../src/db.js';
import {ACADEMIC_DIR,DB_PATH} from '../src/lib/paths.js';
import express from 'express';import request from 'supertest';import {signToken} from '../src/lib/auth.js';
import {createPortableRouter,createUniversityBundle,importUniversityBundle,validateUniversityBundle} from '../src/routes/portable.js';
import {sealEncounter,readEncounter} from '../src/lib/vp-encounter.js';
import {normalizeRubric} from '../src/lib/grading-rubric.js';
import {readPortableZip,createPortableZip} from '../src/lib/portable-zip.js';
let bundle,caseId,attemptId,sessionId,sourceUrl,scoreJson,otherAttemptId;
const stats=()=>({unis:db.prepare('SELECT COUNT(*) n FROM universities').get().n,cases:db.prepare('SELECT COUNT(*) n FROM cases').get().n,users:db.prepare('SELECT COUNT(*) n FROM users').get().n});
beforeAll(async()=>{
 execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();
 const uid=db.prepare("SELECT id FROM users WHERE username='40012345'").get().id;
 db.prepare('UPDATE users SET university_id=1 WHERE id=?').run(uid);
 const mediaDir=path.join(ACADEMIC_DIR,'university-1','media');fs.mkdirSync(mediaDir,{recursive:true});fs.writeFileSync(path.join(mediaDir,'r12-lung.mp3'),'R12 synthetic media bytes');fs.writeFileSync(path.join(mediaDir,'r12-lab.png'),'Second synthetic asset');
 sourceUrl='/uploads/academic/university-1/r12-lung.mp3';
 caseId=Number(db.prepare('INSERT INTO cases(data_json,active,university_id) VALUES (?,1,1)').run(JSON.stringify({title_en:'R12 linked media',lungSound:sourceUrl,images:[{url:sourceUrl}],labResults:[{name_en:'CBC',imageUrl:sourceUrl}],history_en:'A clinical narrative must stay unchanged.',external:'https://external.example/uploads/academic/university-1/keep.png'})).lastInsertRowid);
 db.prepare('INSERT INTO case_versions(case_id,version,data_json) VALUES (?,1,?)').run(caseId,JSON.stringify({lungSound:sourceUrl}));
 scoreJson=JSON.stringify({score:73,meta:{marker:'R12 historical grade'},microlearning:'Historical feedback must stay unchanged.'});
 attemptId=Number(db.prepare("INSERT INTO attempts(user_id,type,case_id,score,eval_json,transcript_json) VALUES (?,'vp',?,73,?,?)").run(uid,caseId,scoreJson,JSON.stringify({messages:[{role:'student',text:'Synthetic history'}]})).lastInsertRowid);
 sessionId=Number(db.prepare("INSERT INTO vp_sessions(user_id,case_id,started_ms,finished_at,attempt_id,encounter_snapshot_json) VALUES (?,?,?,datetime('now'),?,?)").run(uid,caseId,Date.now(),attemptId,sealEncounter({caseData:{id:caseId,lungSound:sourceUrl,images:[{url:sourceUrl}]},checklist:{items:[]},gradingScope:'overall',gradingRubric:normalizeRubric(null)})).lastInsertRowid);
 db.prepare("INSERT INTO vp_session_events(session_id,seq,at_ms,kind,payload_json) VALUES (?,0,1,'finish','{}')").run(sessionId);
 const otherCase=Number(db.prepare('INSERT INTO cases(data_json,active,university_id) VALUES (?,1,1)').run(JSON.stringify({title_en:'Other R12 case'})).lastInsertRowid);
 otherAttemptId=Number(db.prepare("INSERT INTO attempts(user_id,type,case_id,score,eval_json) VALUES (?,'vp',?,11,'{}')").run(uid,otherCase).lastInsertRowid);
 persistNow();bundle=createUniversityBundle(db.prepare('SELECT * FROM universities WHERE id=1').get(),{full:true}).buffer;
},60000);
afterEach(()=>vi.restoreAllMocks());
function editedBundle(edit){
 const entries=readPortableZip(bundle),manifest=JSON.parse(entries.find(e=>e.path==='manifest.json').data);
 const entity=entries.find(e=>e.path.endsWith('/vp-sessions.json'));const data=JSON.parse(entity.data);edit(data);entity.data=Buffer.from(JSON.stringify(data));
 const sum=b=>crypto.createHash('sha256').update(b).digest('hex');const record=manifest.files.find(f=>f.path===entity.path);record.size=entity.data.length;record.sha256=sum(entity.data);
 const m=entries.find(e=>e.path==='manifest.json');m.data=Buffer.from(JSON.stringify(manifest));entries.find(e=>e.path==='manifest.sha256').data=Buffer.from(sum(m.data)+'  manifest.json\n');return createPortableZip(entries);
}
it('restores the completed session link to the remapped historical attempt',async()=>{
 const out=await importUniversityBundle(bundle);const row=db.prepare('SELECT s.* FROM vp_sessions s JOIN cases c ON c.id=s.case_id WHERE c.university_id=? AND s.encounter_snapshot_json IS NOT NULL').all(out.university_id).find(s=>JSON.parse(s.encounter_snapshot_json).caseData.lungSound?.endsWith('r12-lung.mp3'));
 expect(row).toBeTruthy();expect(row.attempt_id).toBeTruthy();expect(row.attempt_id).not.toBe(attemptId);
 const grade=db.prepare('SELECT * FROM attempts WHERE id=?').get(row.attempt_id);expect(grade.case_id).toBe(row.case_id);expect(grade.user_id).toBe(row.user_id);expect(grade.score).toBe(73);expect(grade.eval_json).toBe(scoreJson);
 expect(db.prepare('SELECT COUNT(*) n FROM vp_session_events WHERE session_id=?').get(row.id).n).toBe(1);
});
it('rewrites tenant media addresses in live cases, versions and frozen encounters',async()=>{
 const out=await importUniversityBundle(bundle);const row=db.prepare('SELECT * FROM cases WHERE university_id=?').all(out.university_id).find(c=>JSON.parse(c.data_json).title_en==='R12 linked media');const data=JSON.parse(row.data_json);
 const url=`/uploads/academic/${out.namespace}/r12-lung.mp3`;expect(data.lungSound).toBe(url);expect(data.images[0].url).toBe(url);expect(data.labResults[0].imageUrl).toBe(url);expect(data.history_en).toBe('A clinical narrative must stay unchanged.');expect(data.external).toBe('https://external.example/uploads/academic/university-1/keep.png');
 const session=db.prepare('SELECT * FROM vp_sessions WHERE case_id=? AND encounter_snapshot_json IS NOT NULL').get(row.id);expect(readEncounter(session).caseData.lungSound).toBe(url);
 expect(JSON.parse(db.prepare('SELECT data_json FROM case_versions WHERE case_id=?').get(row.id).data_json).lungSound).toBe(url);
 expect(fs.readFileSync(path.join(ACADEMIC_DIR,out.namespace,'media','r12-lung.mp3'),'utf8')).toBe('R12 synthetic media bytes');
});
it('rolls back database inserts if destination media copy fails',async()=>{
 const before=stats(),copy=fs.copyFileSync;persistNow();
 vi.spyOn(fs,'copyFileSync').mockImplementation((a,b,...rest)=>{if(String(a).includes('.portable-staging')&&String(b).includes('/media/'))throw Error('R12 simulated copy failure');return copy(a,b,...rest);});
 await expect(importUniversityBundle(bundle)).rejects.toThrow('R12 simulated copy failure');vi.restoreAllMocks();expect(stats()).toEqual(before);
});
it('refuses dangling attempt links before importing',()=>{
 const broken=editedBundle(d=>{d.sessions.find(s=>s.id===sessionId).attempt_id=9999999;});
 expect(()=>validateUniversityBundle(broken)).toThrow('session_attempt_graph_invalid');
});
it('does not report success or leave media/rows when DB persistence fails',async()=>{
 persistNow();const before=stats(),rename=fs.renameSync,dirs=fs.readdirSync(ACADEMIC_DIR).sort();
 vi.spyOn(fs,'renameSync').mockImplementation((a,b)=>{if(b===DB_PATH)throw Error('R12 simulated database failure');return rename(a,b);});
 await expect(importUniversityBundle(bundle)).rejects.toThrow();vi.restoreAllMocks();expect(stats()).toEqual(before);expect(fs.readdirSync(ACADEMIC_DIR).sort()).toEqual(dirs);
});
it('rejects linking a session to another case grade even with valid archive checksums',()=>{
 expect(()=>validateUniversityBundle(editedBundle(d=>{d.sessions.find(s=>s.id===sessionId).attempt_id=otherAttemptId;}))).toThrow('session_attempt_graph_invalid');
});
it('rejects duplicate session IDs and orphan events',()=>{
 expect(()=>validateUniversityBundle(editedBundle(d=>d.sessions.push({...d.sessions[0]})))).toThrow('session_graph_invalid');
 expect(()=>validateUniversityBundle(editedBundle(d=>{d.events[0].session_id=9999999;}))).toThrow('session_event_graph_invalid');
});
it('removes earlier new files when the second media copy fails',async()=>{
 persistNow();const before=stats(),dirs=fs.readdirSync(ACADEMIC_DIR).sort(),copy=fs.copyFileSync;let n=0;
 vi.spyOn(fs,'copyFileSync').mockImplementation((a,b,...rest)=>{if(String(a).includes('.portable-staging')&&++n===2)throw Error('R12 second copy failure');return copy(a,b,...rest);});
 await expect(importUniversityBundle(bundle)).rejects.toThrow('R12 second copy failure');vi.restoreAllMocks();expect(n).toBe(2);expect(stats()).toEqual(before);expect(fs.readdirSync(ACADEMIC_DIR).sort()).toEqual(dirs);
});
it('never overwrites different pre-existing destination media on restore',async()=>{
 const target=Number(db.prepare("INSERT INTO universities(name_en,code) VALUES ('R12 existing target','R12_EXISTING')").run().lastInsertRowid);
 const dir=path.join(ACADEMIC_DIR,`university-${target}`,'media');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'r12-lung.mp3');fs.writeFileSync(file,'Keep destination bytes');persistNow();const before=stats();
 await expect(importUniversityBundle(bundle,{target_university_id:target})).rejects.toThrow('media_file_conflict');expect(stats()).toEqual(before);expect(fs.readFileSync(file,'utf8')).toBe('Keep destination bytes');expect(fs.readdirSync(dir)).toEqual(['r12-lung.mp3']);
});
it('a successful restored grade and snapshot survive database reload',async()=>{
 const out=await importUniversityBundle(bundle);await reloadDb();initSchema();
 const s=db.prepare('SELECT s.* FROM vp_sessions s JOIN cases c ON c.id=s.case_id WHERE c.university_id=? AND s.attempt_id IS NOT NULL').get(out.university_id);
 expect(s).toBeTruthy();expect(readEncounter(s).caseData.lungSound).toBe(`/uploads/academic/${out.namespace}/r12-lung.mp3`);expect(db.prepare('SELECT eval_json FROM attempts WHERE id=?').get(s.attempt_id).eval_json).toBe(scoreJson);
});

it('HTTP export honors explicit full requests and preserves the default preview',async()=>{
 const app=express();app.use(express.json());app.use('/portable',createPortableRouter({selectedUniversity:()=>db.prepare('SELECT * FROM universities WHERE id=1').get()}));
 const token=signToken(db.prepare("SELECT * FROM users WHERE role='admin' LIMIT 1").get());
 const send=body=>request(app).post('/portable/export').set('Authorization',`Bearer ${token}`).send(body).buffer(true).parse((res,cb)=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>cb(null,Buffer.concat(chunks)));});
 const full=await send({full:true});expect(full.status).toBe(200);expect(validateUniversityBundle(full.body).restorable).toBe(true);
 const preview=await send({});expect(preview.status).toBe(200);const manifest=JSON.parse(readPortableZip(preview.body).find(e=>e.path==='manifest.json').data);expect(manifest.scope.restorable).toBe(false);
});
