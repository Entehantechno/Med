import { beforeAll, afterEach, it, expect, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import request from 'supertest';
import { db, initDb, persistNow, reloadDb } from '../src/db.js';
import { DB_PATH } from '../src/lib/paths.js';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/auth.js';
import { getSetting } from '../src/routes/content.js';
let app, admin, teacher, student, seq=0;
const rows=(table,keys)=>db.prepare(`SELECT key,value FROM ${table} WHERE key IN (${keys.map(()=>'?').join(',')}) ORDER BY key`).all(...keys);
const put=(url,body,token=admin)=>request(app).put('/api'+url).set('Authorization',`Bearer ${token}`).send(body);
function actor(role){const id=Number(db.prepare("INSERT INTO users(username,password_hash,role,status,university_id) VALUES (?,'fixture',?,'active',1)").run('r27-'+(++seq),role).lastInsertRowid);return signToken(db.prepare('SELECT * FROM users WHERE id=?').get(id));}
const raw=(key,value)=>db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));
beforeAll(async()=>{execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();app=createApp();admin=actor('admin');teacher=actor('teacher');student=actor('student');},60000);
afterEach(()=>vi.restoreAllMocks());
for(const key of ['maintenance','plan_prices','security','flags','ai_vpatient','r27-unknown'])it(`teacher cannot overwrite platform setting ${key}`,async()=>{
 const before=rows('settings',[key]); const r=await put('/settings/'+key,{on:false,r27:'unauthorized'},teacher);
 expect(r.status).toBe(403);expect(rows('settings',[key])).toEqual(before);
});
const writes=[
 ['prompts','/prompts',{r27_prompt_a:'new A',r27_prompt_b:'new B'},'prompts',['r27_prompt_a','r27_prompt_b']],
 ['settings','/settings/exam',{duration:27,r27:'saved'},'settings',['exam']],
 ['order catalog','/order-catalog',{labs:[{en:'R27 CBC'}],imaging:[{en:'R27 CXR'}],paraclinic:[{en:'R27 ECG'}]},'settings',['order_catalog_lab','order_catalog_imaging','order_catalog_paraclinic']],
];
for(const[name,url,body,table,keys]of writes)it(`${name}: failed publication rolls back every key and retry survives reload`,async()=>{
 const before=rows(table,keys);for(const key of keys)if(table==='settings')getSetting(key,null);persistNow({throwOnError:true});
 const rename=fs.renameSync;let hit=false;vi.spyOn(fs,'renameSync').mockImplementation((src,dst)=>{if(dst===DB_PATH&&JSON.stringify(rows(table,keys))!==JSON.stringify(before)){hit=true;throw Error('R27 disk failure');}return rename(src,dst);});
 const response=await put(url,body);vi.restoreAllMocks();expect(hit).toBe(true);expect(response.status).toBe(503);expect(rows(table,keys)).toEqual(before);
 for(const key of keys)if(table==='settings'){const old=before.find(r=>r.key===key);expect(getSetting(key,null)).toEqual(old?JSON.parse(old.value):null);}
 await reloadDb();expect(rows(table,keys)).toEqual(before);expect((await put(url,body)).status).toBe(200);const saved=rows(table,keys);expect(saved).not.toEqual(before);await reloadDb();expect(rows(table,keys)).toEqual(saved);
});
it('warmed settings observe writes through the separately authorized admin endpoint',async()=>{
 const key='r27-admin-path';raw(key,{revision:1});expect(getSetting(key,null)).toEqual({revision:1});
 expect((await put('/admin/settings/'+key,{value:JSON.stringify({revision:2})})).status).toBe(200);
 expect(getSetting(key,null)).toEqual({revision:2});
});
it('cached missing key observes a later database insert',()=>{const key='r27-cache-miss';expect(getSetting(key,'fallback')).toBe('fallback');raw(key,{revision:1});expect(getSetting(key,null)).toEqual({revision:1});});
it('cache cannot resurrect deleted settings',()=>{const key='r27-cache-delete';raw(key,{revision:1});getSetting(key,null);db.prepare('DELETE FROM settings WHERE key=?').run(key);expect(getSetting(key,'fallback')).toBe('fallback');});
it('reload replaces a warmed but unpersisted configuration',async()=>{const key='r27-cache-reload';raw(key,{revision:1});persistNow({throwOnError:true});raw(key,{revision:2});expect(getSetting(key,null)).toEqual({revision:2});await reloadDb();expect(getSetting(key,null)).toEqual({revision:1});});
for(const key of ['exam','vp_grading'])it(`teacher retains the existing ${key} control`,async()=>{
 const r=await put('/settings/'+key,key==='exam'?{duration:31}:{},teacher);expect(r.status).toBe(200);
 expect((await request(app).get('/api/settings/'+key).set('Authorization',`Bearer ${teacher}`)).status).toBe(200);
});
for(const[url,body]of [['/settings/exam',{duration:99}],['/prompts',{r27:'not allowed'}],['/order-catalog',{labs:[{en:'CBC'}],imaging:[{en:'CXR'}]}]])it(`student cannot write ${url}`,async()=>{expect((await put(url,body,student)).status).toBe(403);});
it('admin retains custom settings and JSON null is not a cache miss',async()=>{
 expect((await put('/settings/r27-custom',{enabled:true})).status).toBe(200);expect(getSetting('r27-custom',null)).toEqual({enabled:true});raw('r27-custom',null);expect(getSetting('r27-custom','fallback')).toBeNull();
});
it('malformed stored JSON returns the caller fallback rather than a warmed value',()=>{raw('r27-malformed',{ok:true});getSetting('r27-malformed',null);db.prepare("UPDATE settings SET value='not-json' WHERE key='r27-malformed'").run();expect(getSetting('r27-malformed','safe')).toBe('safe');});
it('invalid order catalog leaves all three stored lists untouched',async()=>{
 const keys=['order_catalog_lab','order_catalog_imaging','order_catalog_paraclinic'],before=rows('settings',keys);
 expect((await put('/order-catalog',{labs:[],imaging:[{en:'CXR'}]})).status).toBe(400);expect(rows('settings',keys)).toEqual(before);
});
