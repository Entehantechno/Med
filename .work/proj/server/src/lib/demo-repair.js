import {isDeepStrictEqual} from 'node:util';
import {db,persistNow,snapshotDb} from '../db.js';
import {hashPasswordSync} from './password.js';
import {EMERGENCY_TEN} from '../data/vp-emergency-ten.js';
export function demoStatus(){
 return {universities:db.prepare('SELECT id,name_fa,name_en FROM universities ORDER BY id').all(),
 accounts:db.prepare("SELECT username,role,status,university_id FROM users WHERE username IN ('admin','teacher','learner','40012345') OR username LIKE 'demo_%'").all(),
 cases:db.prepare('SELECT university_id,COUNT(*) total,SUM(active=1) active FROM cases GROUP BY university_id').all()};
}
export function repairDemo({universityId,password,actorId}){
 const uni=Number(universityId);
 if(!Number.isInteger(uni)||!db.prepare('SELECT id FROM universities WHERE id=?').get(uni))throw new Error('invalid_university');
 if(typeof password!=='string'||password.length<12||password.length>128)throw new Error('demo_password_min_12');
 const hash=hashPasswordSync(password), accounts=[],cases=[];
 persistNow({throwOnError:true});snapshotDb({force:true});
 db.transaction(()=>{
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
  const checklist=db.prepare('SELECT id FROM checklists ORDER BY id LIMIT 1').get()?.id || null;
  for(const [i,c] of EMERGENCY_TEN.entries()){
   const key=`medschool:emergency:${i+1}:university:${uni}`;
   const reserved=db.prepare("SELECT entity_id,deleted_at FROM content_identity_registry WHERE kind='cases' AND source_key=?").get(key);
   let id=reserved?.entity_id;
   if(reserved){if(reserved.deleted_at)continue;const current=db.prepare('SELECT active,public_code FROM cases WHERE id=? AND source_key=?').get(id,key);if(!current?.active)continue;}
   else {
    // Bind a matching legacy demo in the SAME university, without editing it.
    const existing=db.prepare("SELECT id,data_json FROM cases WHERE university_id=? AND source_key IS NULL AND active=1").all(uni).find(row=>{
      try{const {track,...data}=JSON.parse(row.data_json),{track: _track,...source}=c.data;return isDeepStrictEqual(data,source);}catch{return false;}
    });
    if(existing){id=existing.id;db.prepare('UPDATE cases SET source_key=? WHERE id=?').run(key,id);}
    else id=db.prepare('INSERT INTO cases(data_json,difficulty,checklist_id,university_id,created_by,source_key) VALUES (?,?,?,?,?,?)')
      .run(JSON.stringify({...c.data,track:'uni'}),c.difficulty,checklist,uni,ids.teacher,key).lastInsertRowid;
   }
   db.prepare('INSERT OR IGNORE INTO exam_assignments(user_id,case_id,assigned_by,max_attempts) VALUES (?,?,?,10)').run(ids.student,id,actorId);
   cases.push(id);
  }
 })();
 persistNow({throwOnError:true});return {accounts,caseIds:cases,universityId:uni};
}
