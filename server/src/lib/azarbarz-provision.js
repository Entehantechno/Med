import {db,durableTransaction} from '../db.js';
import {AZARBARZ_CARDS} from '../data/azarbarz-histology.js';
import {EMERGENCY_TEN} from '../data/vp-emergency-ten.js';
import {isDeepStrictEqual} from 'node:util';
import {SUBJECTS} from '../../../client/src/data/subject-catalog.js';
const marker='requested_azarbarz_histology_v1';
// Requested initial credential is stored only as a salted bcrypt hash.
const initialHash='$2a$12$bkszErt2ZH0pdxBSrnIp4.iDDjCW5PnlSPe0F7B.EzuI0BhzI/MZO';
export function ensureAzarbarzTeacher(){
 return durableTransaction(()=>{
  if(db.prepare('SELECT 1 FROM settings WHERE key=?').get(marker))return {alreadyApplied:true};
  const uni=db.prepare("SELECT id FROM universities WHERE code='ARAK' AND active=1").get();
  if(!uni)throw new Error('canonical_arak_missing');
  let user=db.prepare('SELECT * FROM users WHERE username=?').get('drazarbarz1');
  // Never commandeer an existing identity or reset its credentials/role.
  if(user&&(user.role!=='teacher'||user.university_id!==uni.id||user.status!=='active'))throw new Error('requested_teacher_identity_conflict');
  if(!user){const id=Number(db.prepare("INSERT INTO users(username,password_hash,name_fa,name_en,role,status,university_id) VALUES (?,?,?,?,'teacher','active',?)").run('drazarbarz1',initialHash,'drazarbarz1','drazarbarz1',uni.id).lastInsertRowid);user={id};}
  let inserted=0;
  for(const [i,card]of AZARBARZ_CARDS.entries()){
   const key=`medschool:azarbarz:histology:${i+1}`;
   if(db.prepare("SELECT 1 FROM content_identity_registry WHERE kind='flashcards' AND source_key=?").get(key))continue;
   const {active=true,...data}=card;
   db.prepare("INSERT INTO flashcards(version,difficulty,data_json,active,university_id,created_by,last_editor_id,last_action,source_key) VALUES (1,'easy',?,?,?,?,?,'created',?)").run(JSON.stringify(data),active?1:0,uni.id,user.id,user.id,key);inserted++;
  }
  // Share only pristine shipped charts. Do not expose private/edited patients,
  // reactivate inactive cases, or alter encounter snapshots and historical grades.
  let sharedPatients=0;
  for(const [i,source]of EMERGENCY_TEN.entries()){
   const row=db.prepare('SELECT * FROM cases WHERE source_key=? AND active=1').get(`medschool:emergency:${i+1}:university:${uni.id}`);
   if(!row)continue;
   let data;try{data=JSON.parse(row.data_json)}catch{continue}
   const {track,...chart}=data,{track:ignored,...expected}=source.data;
   if(isDeepStrictEqual(chart,expected))sharedPatients+=db.prepare('UPDATE cases SET shared_to_teachers=1 WHERE id=?').run(row.id).changes;
  }
  let sharedCatalogs=0;
  for(const catalog of db.prepare('SELECT * FROM catalogs').all()){
   let items;try{items=JSON.parse(catalog.items_json)}catch{continue}
   if(Object.values(SUBJECTS).some(s=>s.fa===catalog.name_fa&&s.en===catalog.name_en&&isDeepStrictEqual(items,s.list)))sharedCatalogs+=db.prepare('UPDATE catalogs SET shared_to_teachers=1 WHERE id=?').run(catalog.id).changes;
  }
  const result={sharedCatalogs,userId:user.id,universityId:uni.id,inserted,sharedPatients};
  db.prepare('INSERT INTO settings(key,value) VALUES (?,?)').run(marker,JSON.stringify(result));
  return result;
 });
}
