import {isDeepStrictEqual} from 'node:util';
import {db,persistNow,snapshotDb,durableTransaction} from '../db.js';
import {hashPasswordSync} from './password.js';
import {EMERGENCY_TEN} from '../data/vp-emergency-ten.js';
import {provisionEmergencyCases} from './emergency-provision.js';
export function demoStatus(){
 const universities=db.prepare('SELECT id,name_fa,name_en,code FROM universities ORDER BY id').all();
 const rows=db.prepare('SELECT id,university_id,source_key,active,data_json FROM cases ORDER BY active DESC,id').all().map(row=>{
  let chart=null;try{const parsed=JSON.parse(row.data_json);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&parsed.track!=='learn'){const {track,...data}=parsed;chart=data;}}catch{}
  return {...row,chart};
 });
 const byId=new Map(rows.map(r=>[r.id,r])),byUni=new Map();
 for(const row of rows){if(!byUni.has(row.university_id))byUni.set(row.university_id,[]);byUni.get(row.university_id).push(row);}
 const reserved=new Map(db.prepare("SELECT source_key,entity_id,deleted_at FROM content_identity_registry WHERE kind='cases' AND source_key LIKE 'medschool:emergency:%'").all().map(r=>[r.source_key,r]));
 const emergency=universities.map(u=>{
  const summary={university_id:u.id,active:0,inactive:0,retired:0,missing:0,invalid:0,modified:0};
  for(const [i,c]of EMERGENCY_TEN.entries()){
   const {track,...chart}=c.data,key=`medschool:emergency:${i+1}:university:${u.id}`,claim=reserved.get(key);
   if(claim?.deleted_at){summary.retired++;continue;}
   const row=claim?byId.get(claim.entity_id):(byUni.get(u.id)||[]).find(r=>r.source_key===null&&isDeepStrictEqual(r.chart,chart));
   if(!row||row.university_id!==u.id||(claim&&row.source_key!==key)){summary.missing++;continue;}
   if(!row.chart){summary.invalid++;continue;}
   summary[row.active?'active':'inactive']++;
   if(!isDeepStrictEqual(row.chart,chart))summary.modified++;
  }
  return summary;
 });
 return {universities,emergency,
 accounts:db.prepare("SELECT username,role,status,university_id FROM users WHERE username IN ('admin','teacher','learner','40012345') OR username LIKE 'demo_%'").all(),
 cases:db.prepare('SELECT university_id,COUNT(*) total,SUM(active=1) active FROM cases GROUP BY university_id').all()};
}
export function repairDemo({universityId,password,actorId}){
 const uni=Number(universityId);
 if(!Number.isInteger(uni)||!db.prepare('SELECT id FROM universities WHERE id=?').get(uni))throw new Error('invalid_university');
 if(typeof password!=='string'||password.length<12||password.length>128)throw new Error('demo_password_min_12');
 const hash=hashPasswordSync(password), accounts=[],cases=[];
 persistNow({throwOnError:true});snapshotDb({force:true});
 durableTransaction(()=>{
  const ids={};
  for(const role of ['teacher','student','learner']){
   const username=`demo_${role}_${uni}`;
   let user=db.prepare('SELECT * FROM users WHERE username=?').get(username);
   if(user && (user.role!==role || (role!=='learner' && user.university_id!==uni))) throw new Error('demo_username_conflict');
   let created=false;
   if(!user){const r=db.prepare("INSERT INTO users(username,password_hash,name_fa,name_en,role,status,university_id) VALUES (?,?,?,?,?,'active',?)")
    .run(username,hash,`دمو ${role}`,`Demo ${role}`,role,role==='learner'?null:uni);user={id:r.lastInsertRowid};created=true;}
   ids[role]=user.id;accounts.push({username,role,created,status:user.status||'active'});
  }
  const provision=provisionEmergencyCases({universityId:uni,createdBy:ids.teacher});
  for(const entry of provision.entries){
   if(!['existing','bound','inserted'].includes(entry.state))continue;
   const id=entry.id;
   db.prepare('INSERT OR IGNORE INTO exam_assignments(user_id,case_id,assigned_by,max_attempts) VALUES (?,?,?,10)').run(ids.student,id,actorId);
   // Deliberately disabled assignments stay disabled; do not report them as usable.
   if(db.prepare('SELECT active FROM exam_assignments WHERE user_id=? AND case_id=?').get(ids.student,id)?.active)cases.push(id);
  }
 });
 return {accounts,caseIds:cases,universityId:uni};
}
