import {Router} from 'express';
import {db,durableTransaction} from '../db.js';
import {authRequired,requireRole} from '../lib/auth.js';
import {audit} from '../lib/audit.js';
import {normDigits} from '../lib/textsearch.js';
import {academicCopy,academicContentTransaction,academicKind,academicError} from '../lib/academic-sharing.js';
import {isLearnContent} from '../lib/content-track.js';
const r=Router();
r.use(['/content','/groups'],authRequired,requireRole('admin','teacher'));
const tenant=user=>db.prepare('SELECT university_id FROM users WHERE id=?').get(user.id)?.university_id;
const handle=fn=>(req,res)=>{try{fn(req,res)}catch(e){res.status(e.status||500).json({error:e.status?e.message:'academic_operation_failed'})}};
r.put('/content/:kind/:id/sharing',requireRole('admin'),handle((req,res)=>{
 const {kind,id}=req.params;if(!academicKind(kind)||typeof req.body?.enabled!=='boolean')throw academicError('invalid_sharing_request',400);
 const row=db.prepare(`SELECT * FROM ${kind} WHERE id=?`).get(id);if(!row||isLearnContent(row.data_json))throw academicError('not_found',404);
 if(req.body.enabled&&!row.active)throw academicError('content_archived');
 durableTransaction(()=>db.prepare(`UPDATE ${kind} SET shared_to_teachers=? WHERE id=?`).run(req.body.enabled?1:0,id));
 audit(req,'academic.sharing',kind,{id:Number(id),enabled:req.body.enabled});res.json({ok:true,enabled:req.body.enabled});
}));
r.post('/content/:kind/:id/copy',handle((req,res)=>{
 const uni=req.user.role==='admin'?Number(req.body?.university_id):tenant(req.user);
 if(!uni||!db.prepare('SELECT id FROM universities WHERE id=? AND active=1').get(uni))throw academicError('university_required',400);
 const {kind,id}=req.params;
 const copy=academicContentTransaction(()=>academicCopy(kind,Number(id),uni,req.user,req.user.id,true));
 audit(req,'academic.copy',kind,{source:Number(id),id:copy,university_id:uni});res.json({id:copy});
}));
function group(req,allowMissing=false){
 const kind=req.params.kind;if(!['classes','exams'].includes(kind))throw academicError('invalid_group',400);
 const row=db.prepare(`SELECT * FROM ${kind} WHERE id=? AND active=1`).get(req.params.id);if(!row)throw academicError('not_found',404);
 if(req.user.role!=='admin'&&row.university_id!==tenant(req.user))throw academicError('wrong_university',403);
 if(!row.university_id&&!allowMissing)throw academicError('university_required');
 return {...row,table:kind==='classes'?'class_members':'exam_participants',key:kind==='classes'?'class_id':'exam_id'};
}
const ids=value=>{if(!Array.isArray(value)||value.length>10000||value.some(n=>!Number.isSafeInteger(n)||n<=0))throw academicError('invalid_membership_delta',400);return [...new Set(value)]};
r.get('/groups/:kind/:id/students',handle((req,res)=>{
 const g=group(req),args=[g.id,g.university_id];
 let sql=`FROM users u LEFT JOIN ${g.table} m ON m.user_id=u.id AND m.${g.key}=? WHERE u.role='student' AND u.university_id=?`;
 const q=normDigits(String(req.query.q||'').trim()).slice(0,200),prefix=normDigits(String(req.query.prefix||'')).replace(/[%_]/g,'').slice(0,80);
 if(q){sql+=' AND (u.student_no LIKE ? OR u.username LIKE ? OR u.name_fa LIKE ? OR u.name_en LIKE ?)';args.push(...Array(4).fill('%'+q+'%'));}
 if(prefix){sql+=' AND u.student_no LIKE ?';args.push(prefix+'%');}
 if(['active','inactive','pending'].includes(req.query.status)){sql+=' AND u.status=?';args.push(req.query.status);}
 if(req.query.membership==='in')sql+=' AND m.user_id IS NOT NULL';if(req.query.membership==='out')sql+=' AND m.user_id IS NULL';
 const total=db.prepare('SELECT COUNT(*) n '+sql).get(...args).n;
 const page=Math.max(1,Math.floor(Number(req.query.page)||1)),pageSize=Math.max(1,Math.min(100,Math.floor(Number(req.query.pageSize)||50)));
 const sort=req.query.sort==='name'?'COALESCE(NULLIF(u.name_fa,\'\'),u.name_en) COLLATE NOCASE':'u.student_no COLLATE NOCASE';
 const items=db.prepare(`SELECT u.id,u.username,u.student_no,u.name_fa,u.name_en,u.status,CASE WHEN m.user_id IS NULL THEN 0 ELSE 1 END member ${sql} ORDER BY ${sort},u.id LIMIT ? OFFSET ?`).all(...args,pageSize,(page-1)*pageSize);
 res.json({items,total,page,pageSize,university_id:g.university_id});
}));
r.put('/groups/:kind/:id/members',handle((req,res)=>{
 const g=group(req),add=ids(req.body?.addIds),remove=ids(req.body?.removeIds),removed=new Set(remove);
 if(add.some(id=>removed.has(id)))throw academicError('overlapping_membership_delta',400);
 const result=durableTransaction(()=>{
  // Bounded set-based reads rather than one SQL lookup per student.
  const rows=[];for(let i=0;i<add.length;i+=400){const part=add.slice(i,i+400);rows.push(...db.prepare(`SELECT id,role,status,university_id FROM users WHERE id IN (${part.map(()=>'?').join(',')})`).all(...part));}
  if(rows.length!==add.length||rows.some(u=>u.role!=='student'||u.university_id!==g.university_id||u.status!=='active'))throw academicError('student_not_eligible');
  const insert=db.prepare(`INSERT OR IGNORE INTO ${g.table}(${g.key},user_id) VALUES (?,?)`),del=db.prepare(`DELETE FROM ${g.table} WHERE ${g.key}=? AND user_id=?`);
  for(const id of add)insert.run(g.id,id);for(const id of remove)del.run(g.id,id);
  return {ok:true,added:add.length,removed:remove.length,total:db.prepare(`SELECT COUNT(*) n FROM ${g.table} WHERE ${g.key}=?`).get(g.id).n};
 });audit(req,'academic.membership',req.params.kind,{id:g.id,added:add.length,removed:remove.length});res.json(result);
}));
// Repair a wrongly associated EMPTY group. Non-empty groups cannot be moved
// implicitly: their existing student data and grading belong to the old tenant.
r.put('/groups/:kind/:id/university',requireRole('admin'),handle((req,res)=>{
 const g=group(req,true),uni=Number(req.body?.university_id);
 if(!Number.isSafeInteger(uni)||!db.prepare('SELECT id FROM universities WHERE id=? AND active=1').get(uni))throw academicError('university_required',400);
 durableTransaction(()=>{
  const occupied=db.prepare(`SELECT 1 FROM ${g.table} WHERE ${g.key}=? LIMIT 1`).get(g.id)||db.prepare(`SELECT 1 FROM attempts WHERE ${g.key}=? LIMIT 1`).get(g.id);
  const attached=req.params.kind==='classes'?db.prepare('SELECT 1 FROM class_cases WHERE class_id=? UNION ALL SELECT 1 FROM class_flashcards WHERE class_id=? LIMIT 1').get(g.id,g.id):JSON.parse(g.case_ids||'[]').length||JSON.parse(g.flashcard_ids||'[]').length;
  if(uni!==g.university_id&&(occupied||attached))throw academicError('nonempty_group_cannot_change_university',409);
  db.prepare(`UPDATE ${req.params.kind} SET university_id=? WHERE id=?`).run(uni,g.id);
 });res.json({ok:true,university_id:uni});
}));
export default r;
