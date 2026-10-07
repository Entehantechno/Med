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
function changeBundle(file,edit){
 const entries=readPortableZip(bundle),manifest=JSON.parse(entries.find(e=>e.path==='manifest.json').data);
 const entry=entries.find(e=>e.path.endsWith('/'+file));const data=JSON.parse(entry.data);edit(data);entry.data=Buffer.from(JSON.stringify(data));
 const sum=b=>crypto.createHash('sha256').update(b).digest('hex');const record=manifest.files.find(f=>f.path===entry.path);record.size=entry.data.length;record.sha256=sum(entry.data);
 const m=entries.find(e=>e.path==='manifest.json');m.data=Buffer.from(JSON.stringify(manifest));entries.find(e=>e.path==='manifest.sha256').data=Buffer.from(sum(m.data)+'  manifest.json\n');return createPortableZip(entries);
}
for(const [file,label] of [['cases.json','cases'],['academic-identities.json','identities']]){
 it(`rejects duplicate ${label} IDs before any writes`,async()=>{
  const broken=changeBundle(file,rows=>rows.push({...rows[0]}));const before=stats();
  await expect(importUniversityBundle(broken)).rejects.toThrow(`${label}_identity_invalid`);expect(stats()).toEqual(before);
 });
}
for(const field of ['class_id','exam_id']){
 it(`rejects an attempt with an absent ${field}`,()=>{
  const broken=changeBundle('attempts.json',rows=>{rows.find(a=>a.id===otherAttemptId)[field]=9999999;});
  expect(()=>validateUniversityBundle(broken)).toThrow('attempt_context_invalid');
 });
 it(`rejects a session with an absent ${field}`,()=>{
  const broken=changeBundle('vp-sessions.json',data=>{const s=data.sessions.find(s=>s.id===sessionId);s.attempt_id=null;s[field]=9999999;});
  expect(()=>validateUniversityBundle(broken)).toThrow('session_context_invalid');
 });
}
it('rejects a historical case version whose parent is absent',()=>{
 const broken=changeBundle('case-versions.json',rows=>{rows[0].case_id=9999999;});
 expect(()=>validateUniversityBundle(broken)).toThrow('case_version_graph_invalid');
});
it('rejects non-positive source case IDs',()=>{
 expect(()=>validateUniversityBundle(changeBundle('cases.json',rows=>{rows[0].id=0;}))).toThrow('cases_identity_invalid');
});
it('rejects numeric aliases of the same source case ID',()=>{
 expect(()=>validateUniversityBundle(changeBundle('cases.json',rows=>rows.push({...rows[0],id:String(rows[0].id)})))).toThrow('cases_identity_invalid');
});
it('rejects an orphan historical flashcard version',()=>{
 expect(()=>validateUniversityBundle(changeBundle('flashcard-versions.json',rows=>rows.push({flashcard_id:9999999,version:1,data_json:'{}'})))).toThrow('flashcard_version_graph_invalid');
});
