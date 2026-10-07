import {beforeAll,afterEach,describe,it,expect,vi} from 'vitest';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import initSqlJs from 'sql.js';
import request from 'supertest';
import {initDb,db,persistNow} from '../src/db.js';
import {DB_PATH} from '../src/lib/paths.js';
import {createApp} from '../src/app.js';
let app,auth,SQL;
const chart=()=>({title_en:'R10 new patient',title_fa:'بیمار جدید',age:45,history_en:'Original history',history_fa:'شرح حال اصلی',checklist_id:1});
const count=()=>db.prepare('SELECT COUNT(*) n FROM cases').get().n;
function diskRow(id){const image=new SQL.Database(fs.readFileSync(DB_PATH));try{const stmt=image.prepare('SELECT * FROM cases WHERE id=?');stmt.bind([id]);const row=stmt.step()?stmt.getAsObject():null;stmt.free();return row;}finally{image.close();}}
async function create(){const r=await request(app).post('/api/cases').set(auth).send(chart());expect(r.status).toBe(200);return r.body.id;}
beforeAll(async()=>{execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();SQL=await initSqlJs();app=createApp();const login=await request(app).post('/api/auth/login').send({username:'teacher',password:'demo'});auth={Authorization:`Bearer ${login.body.token}`};},60000);
afterEach(()=>vi.restoreAllMocks());
describe('R10 acknowledged patient writes are durable',()=>{
 it('rejects a stale editor rather than overwriting newer bilingual data',async()=>{
  const id=await create();
  expect((await request(app).put(`/api/cases/${id}`).set(auth).send({...chart(),version:1,history_en:'First editor saved'})).status).toBe(200);
  const stale=await request(app).put(`/api/cases/${id}`).set(auth).send({...chart(),version:1,history_fa:'ویرایش دوم'});expect(stale.status).toBe(409);expect(stale.body.error).toBe('case_version_conflict');
  expect(JSON.parse(db.prepare('SELECT data_json FROM cases WHERE id=?').get(id).data_json).history_en).toBe('First editor saved');
  expect(db.prepare('SELECT COUNT(*) n FROM case_versions WHERE case_id=?').get(id).n).toBe(1);
 });
 it.each(['edit','archive'])('persists %s before returning success',async action=>{
  const id=await create();const r=action==='edit'?await request(app).put(`/api/cases/${id}`).set(auth).send({title_en:'Durable edit'}):await request(app).delete(`/api/cases/${id}`).set(auth);
  expect(r.status).toBe(200);const row=diskRow(id);
  if(action==='edit'){expect(row.version).toBe(2);expect(JSON.parse(row.data_json).title_en).toBe('Durable edit');}else expect(row.active).toBe(0);
 });
 it.each(['create','edit','archive','csv'])('rolls back failed durable %s and permits a clean retry',async action=>{
  const id=await create(),before=db.prepare('SELECT * FROM cases WHERE id=?').get(id),n=count();persistNow();const rename=fs.renameSync;
  vi.spyOn(fs,'renameSync').mockImplementation((a,b)=>{if(b===DB_PATH)throw new Error('R10 simulated disk failure');return rename(a,b);});
  let r;
  if(action==='create')r=await request(app).post('/api/cases').set(auth).send(chart());
  if(action==='edit')r=await request(app).put(`/api/cases/${id}`).set(auth).send({history_en:'Must not survive failed save'});
  if(action==='archive')r=await request(app).delete(`/api/cases/${id}`).set(auth);
  if(action==='csv')r=await request(app).post('/api/cases-import').set(auth).send({csv:'title_en,age\nR10 CSV A,40\nR10 CSV B,50'});
  vi.restoreAllMocks();expect(r.status).toBe(503);expect(r.body.error).toBe('database_persistence_failed');expect(count()).toBe(n);
  expect(db.prepare('SELECT * FROM cases WHERE id=?').get(id)).toEqual(before);expect(diskRow(id)).toEqual(before);
  expect(db.prepare('SELECT COUNT(*) n FROM case_versions WHERE case_id=?').get(id).n).toBe(0);
  const next=await create();expect(count()).toBe(n+1);expect(diskRow(next)).toBeTruthy();
 });
 it('finishes short writes before replacing the good database',async()=>{
  const id=await create(),write=fs.writeSync;let calls=0;
  vi.spyOn(fs,'writeSync').mockImplementation((fd,buffer,offset,length,position)=>{calls++;return write(fd,buffer,offset,Math.min(length,65536),position);});
  db.prepare('UPDATE cases SET difficulty=? WHERE id=?').run('hard',id);persistNow({throwOnError:true});vi.restoreAllMocks();expect(calls).toBeGreaterThan(1);expect(diskRow(id).difficulty).toBe('hard');
 });
 it('rejects zero-progress writes without replacing the good database',async()=>{
  const id=await create(),before=fs.readFileSync(DB_PATH);
  vi.spyOn(fs,'writeSync').mockReturnValue(0);db.prepare('UPDATE cases SET difficulty=? WHERE id=?').run('easy',id);
  expect(()=>persistNow({throwOnError:true})).toThrow('database_persistence_failed');vi.restoreAllMocks();expect(fs.readFileSync(DB_PATH)).toEqual(before);persistNow({throwOnError:true});expect(diskRow(id).difficulty).toBe('easy');
 });
});

it('does not leave a half-created session after a disk failure',async()=>{
 const id=await create();const n=db.prepare('SELECT COUNT(*) n FROM vp_sessions').get().n;persistNow();
 const rename=fs.renameSync;vi.spyOn(fs,'renameSync').mockImplementation((a,b)=>{if(b===DB_PATH)throw new Error('R10 simulated session disk failure');return rename(a,b);});
 const body={caseId:id,lang:'en',requestId:'r10-durable-session'};
 const failed=await request(app).post('/api/exam/session-start').set(auth).send(body);vi.restoreAllMocks();
 expect(failed.status).toBeGreaterThanOrEqual(500);expect(db.prepare('SELECT COUNT(*) n FROM vp_sessions').get().n).toBe(n);
 const retry=await request(app).post('/api/exam/session-start').set(auth).send(body);expect(retry.status).toBe(200);expect(db.prepare('SELECT COUNT(*) n FROM vp_sessions').get().n).toBe(n+1);
});
it('rolls back the version row as well when the patient update SQL fails',async()=>{
 const id=await create();const before=db.prepare('SELECT * FROM cases WHERE id=?').get(id);
 db.exec(`CREATE TRIGGER r10_reject_case BEFORE UPDATE OF data_json ON cases WHEN NEW.id=${id} BEGIN SELECT RAISE(ABORT,'r10 forced SQL failure'); END;`);
 try {const failed=await request(app).put(`/api/cases/${id}`).set(auth).send({title_en:'Rejected'});expect(failed.status).toBe(500);expect(db.prepare('SELECT * FROM cases WHERE id=?').get(id)).toEqual(before);expect(db.prepare('SELECT COUNT(*) n FROM case_versions WHERE case_id=?').get(id).n).toBe(0);}
 finally {db.exec('DROP TRIGGER r10_reject_case');persistNow();}
});
