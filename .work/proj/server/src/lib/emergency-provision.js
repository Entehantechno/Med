import {createHash} from 'node:crypto';
import {EMERGENCY_RUBRICS} from '../data/emergency-rubrics.js';
// Additive academic provisioning; never rewrite a clinical chart or resurrect a
// reserved/deleted identity. Legacy matches require the full source payload.
import {isDeepStrictEqual} from 'node:util';
import {db,durableTransaction} from '../db.js';
import {EMERGENCY_TEN} from '../data/vp-emergency-ten.js';
import {DEFAULT_LAB_TESTS,DEFAULT_IMAGING,DEFAULT_PARACLINIC,cleanOrderList,cleanOrderItem} from '../data/order-catalog-defaults.js';
const rubricNames={1:'ACS Checklist',2:'Abdominal Pain Checklist',3:'History-taking & communication'};
export function emergencyChecklist(sourceId){
 const definition=EMERGENCY_RUBRICS[sourceId];
 const row=db.prepare('SELECT id FROM checklists WHERE owner_id IS NULL AND name_en=? ORDER BY id LIMIT 1').get(definition?.name_en || rubricNames[sourceId]);
 if(!row && definition)return Number(db.prepare('INSERT INTO checklists(name_fa,name_en,items_json) VALUES (?,?,?)').run(definition.name_fa,definition.name_en,JSON.stringify(definition.items)).lastInsertRowid);
 if(!row)throw new Error(`emergency_checklist_missing:${sourceId}`);
 return row.id;
}
// Only pristine original charts using the exact shipped legacy criteria qualify.
// Never edit the old checklist: in-flight snapshots and historical grades keep it.
function upgradePristineRubric(id, source) {
 const definition=EMERGENCY_RUBRICS[source.checklist_id];
 if(!definition)return false;
 const row=db.prepare('SELECT * FROM cases WHERE id=?').get(id);
 if(!row||row.version!==1||!row.active)return false;
 let data;try{data=JSON.parse(row.data_json)}catch{return false}
 const {track,...chart}=data, {track:sourceTrack,...sourceChart}=source.data;
 if(!isDeepStrictEqual(chart,sourceChart))return false;
 const old=db.prepare('SELECT * FROM checklists WHERE id=?').get(row.checklist_id);
 if(!old||old.owner_id!=null||old.name_en!==definition.legacyName||createHash('sha256').update(old.items_json).digest('hex')!==definition.legacyHash)return false;
 const checklistId=emergencyChecklist(source.checklist_id);
 db.prepare('INSERT INTO case_versions(case_id,version,data_json) VALUES (?,?,?)').run(id,row.version,row.data_json);
 db.prepare("UPDATE cases SET checklist_id=?,version=version+1,updated_at=datetime('now') WHERE id=?").run(checklistId,id);
 return true;
}
// A one-time additive catalog migration, not a per-restart reset. Export only
// public study names/aliases, never result text or a case-specific answer hint.
function ensureEmergencyCatalog(){
 const marker='academic_emergency_catalog_v1';
 if(db.prepare('SELECT 1 FROM settings WHERE key=?').get(marker))return 0;
 const up=db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
 let added=0;
 for(const [field,key,defaults]of [['labResults','order_catalog_lab',DEFAULT_LAB_TESTS],['imagingResults','order_catalog_imaging',DEFAULT_IMAGING],['paraclinicResults','order_catalog_paraclinic',DEFAULT_PARACLINIC]]){
  let saved;try{saved=JSON.parse(db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value||'null')}catch{saved=null}
  const list=[...cleanOrderList(saved,defaults)];let changed=false;
  for(const c of EMERGENCY_TEN)for(const row of c.data[field]||[]){
   const item=cleanOrderItem(row);
   if(item&&!list.some(x=>x.en.toLowerCase()===item.en.toLowerCase())){list.push(item);added++;changed=true;}
  }
  if(list.length>400)throw new Error('emergency_catalog_capacity:'+key);
  if(changed)up.run(key,JSON.stringify(list));
 }
 up.run(marker,JSON.stringify({version:1}));return added;
}
export function ensureEmergencyCases(options={}){
 return durableTransaction(()=>provisionEmergencyCases(options));
}
// Internal composition point: caller MUST supply the durable transaction.
// Demo accounts, cases, catalog and assignments must share one commit boundary.
export function provisionEmergencyCases({universityId,createdBy=null}={}){
 const uni=universityId===undefined?db.prepare("SELECT id FROM universities WHERE code='ARAK'").get()?.id:Number(universityId);
 if(universityId===undefined&&!uni)return {universityId:null,inserted:0,bound:0,entries:[],reason:'university_missing'};
 if(!Number.isInteger(uni)||!db.prepare('SELECT id FROM universities WHERE id=?').get(uni))throw new Error('invalid_university');
 const result={universityId:uni,inserted:0,bound:0,rubricsUpdated:0,entries:[]};
  const legacy=db.prepare('SELECT id,data_json,active FROM cases WHERE university_id=? AND source_key IS NULL ORDER BY active DESC,id').all(uni).flatMap(row=>{
   try{const data=JSON.parse(row.data_json);if(!data||typeof data!=='object'||Array.isArray(data)||data.track==='learn')return [];const {track,...chart}=data;return [{...row,chart}];}catch{return []}
  });
  for(const [i,c]of EMERGENCY_TEN.entries()){
   const key=`medschool:emergency:${i+1}:university:${uni}`;
   const reserved=db.prepare("SELECT entity_id,deleted_at FROM content_identity_registry WHERE kind='cases' AND source_key=?").get(key);
   if(reserved){const row=db.prepare('SELECT id,active FROM cases WHERE id=? AND source_key=?').get(reserved.entity_id,key);if(row&&!reserved.deleted_at&&upgradePristineRubric(row.id,c))result.rubricsUpdated++;result.entries.push({source:i+1,id:reserved.entity_id,state:reserved.deleted_at?'retired':!row?'missing':row.active?'existing':'inactive'});continue;}
   const {track,...chart}=c.data;const match=legacy.find(row=>isDeepStrictEqual(row.chart,chart));
   let id;
   if(match){id=match.id;db.prepare('UPDATE cases SET source_key=? WHERE id=? AND source_key IS NULL').run(key,id);result.bound++;if(upgradePristineRubric(id,c))result.rubricsUpdated++;}
   else {const checklistId=emergencyChecklist(c.checklist_id);id=Number(db.prepare('INSERT INTO cases(difficulty,checklist_id,data_json,university_id,source_key,created_by) VALUES (?,?,?,?,?,?)').run(c.difficulty,checklistId,JSON.stringify({...c.data,track:'uni'}),uni,key,createdBy).lastInsertRowid);result.inserted++;}
   result.entries.push({source:i+1,id,state:match&&!match.active?'inactive':match?'bound':'inserted'});
  }
  result.catalogAdded=ensureEmergencyCatalog();
  return result;
}
