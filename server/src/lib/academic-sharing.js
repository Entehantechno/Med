import {db,durableTransaction} from '../db.js';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ACADEMIC_DIR} from './paths.js';
import {isLearnContent} from './content-track.js';
export const academicKind = kind => ['cases','flashcards'].includes(kind);
export const sharedAcademic = row => !!row?.active && row.shared_to_teachers===1 && !isLearnContent(row.data_json);
export function academicError(message,status=422){return Object.assign(new Error(message),{status});}
let stagedFiles=null;
export function academicContentTransaction(fn){
 if(stagedFiles)throw new Error('nested_academic_content_transaction');
 stagedFiles=[];
 try{return durableTransaction(fn)}catch(error){for(const file of stagedFiles)try{fs.unlinkSync(file)}catch{}throw error}finally{stagedFiles=null}
}
function copyMedia(data,sourceUniversity,targetUniversity){
 const urls=new Map();
 const rewrite=value=>{
  if(typeof value==='string')return value.replace(/\/uploads\/academic\/university-(\d+)\/([a-zA-Z0-9_.%~-]+)/g,(url,source,name)=>{
   if(urls.has(url))return urls.get(url);
   if(Number(source)!==Number(sourceUniversity))throw academicError('foreign_media_reference');
   name=decodeURIComponent(name);if(name!==path.basename(name)||name.includes('..'))throw academicError('invalid_media_reference');
   const base=path.join(ACADEMIC_DIR,`university-${source}`);
   const file=[path.join(base,'media',name),path.join(base,name)].find(p=>fs.existsSync(p)&&fs.lstatSync(p).isFile());
   if(!file||!fs.realpathSync(file).startsWith(fs.realpathSync(base)+path.sep))throw academicError('source_media_missing');
   const bytes=fs.readFileSync(file),hash=createHash('sha256').update(bytes).digest('hex'),filename='shared-'+hash+path.extname(name);
   const dir=path.join(ACADEMIC_DIR,`university-${targetUniversity}`,'media'),dest=path.join(dir,filename);
   if(!stagedFiles)throw new Error('media_copy_requires_transaction');
   fs.mkdirSync(dir,{recursive:true,mode:0o700});
   if(!fs.existsSync(dest)){fs.writeFileSync(dest,bytes,{flag:'wx',mode:0o600});stagedFiles.push(dest);}
   else if(!fs.lstatSync(dest).isFile()||createHash('sha256').update(fs.readFileSync(dest)).digest('hex')!==hash)throw academicError('media_copy_conflict');
   const result=`/uploads/academic/university-${targetUniversity}/${filename}`;urls.set(url,result);return result;
  });
  if(Array.isArray(value))return value.map(rewrite);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,rewrite(v)]));
  return value;
 };return rewrite(data);
}
// Called only inside a durable transaction. Copies have their own identity and
// grading history; publication never grants cross-tenant access to students.
export function academicCopy(kind,id,universityId,actor,ownerId=actor.id,force=false){
 if(!academicKind(kind))throw academicError('invalid_content_kind',400);
 const row=db.prepare(`SELECT * FROM ${kind} WHERE id=?`).get(id);
 if(!row || isLearnContent(row.data_json))throw academicError('content_not_available');
 if(!row.active&&(force||Number(row.university_id)!==Number(universityId)))throw academicError('content_archived');
 if(actor.role!=='admin'&&!sharedAcademic(row)&&Number(row.university_id)!==Number(universityId))throw academicError('content_not_accessible',403);
 if(actor.role==='teacher'&&!sharedAcademic(row)&&row.created_by!=null&&Number(row.created_by)!==Number(actor.id)&&!db.prepare('SELECT is_expert FROM users WHERE id=?').get(actor.id)?.is_expert)throw academicError('content_not_accessible',403);
 if(!force&&Number(row.university_id)===Number(universityId))return row.id;
 const existing=db.prepare('SELECT copy_id FROM academic_content_copies WHERE kind=? AND source_id=? AND source_version=? AND university_id=? AND owner_id=?').get(kind,row.id,row.version,universityId,ownerId);
 if(existing){if(!db.prepare(`SELECT id FROM ${kind} WHERE id=? AND active=1`).get(existing.copy_id))throw academicError('previous_copy_archived');return existing.copy_id;}
 const data=copyMedia(JSON.parse(row.data_json),row.university_id,universityId);for(const k of ['id','public_code','source_key','shared_to_teachers','created_by','university_id','reference','reference_policy_id'])delete data[k];data.track='uni';
 let copy;
 if(kind==='cases'){
  const rubric=db.prepare('SELECT * FROM checklists WHERE id=?').get(row.checklist_id);if(!rubric)throw academicError('checklist_not_found');
  const checklist=Number(db.prepare('INSERT INTO checklists(name_fa,name_en,items_json,owner_id) VALUES (?,?,?,?)').run(rubric.name_fa,rubric.name_en,rubric.items_json,ownerId).lastInsertRowid);
  // Target institution must approve its own reference policy. Never inherit a
  // foreign institution's approval or silently claim the copy is ready.
  copy=Number(db.prepare('INSERT INTO cases(data_json,difficulty,checklist_id,university_id,created_by) VALUES (?,?,?,?,?)').run(JSON.stringify(data),row.difficulty,checklist,universityId,ownerId).lastInsertRowid);
 }else copy=Number(db.prepare('INSERT INTO flashcards(data_json,difficulty,university_id,created_by) VALUES (?,?,?,?)').run(JSON.stringify(data),row.difficulty,universityId,ownerId).lastInsertRowid);
 db.prepare('INSERT INTO academic_content_copies(kind,source_id,source_version,university_id,owner_id,copy_id) VALUES (?,?,?,?,?,?)').run(kind,row.id,row.version,universityId,ownerId,copy);
 return copy;
}
