import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'node:child_process';
import request from 'supertest';
import { initDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { setSetting } from '../src/routes/content.js';
import { getVpatientAiEffective } from '../src/lib/vpatient.js';
import { resetRoutingState } from '../src/lib/ai-routing.js';
let app,admin,student;
const auth=t=>({Authorization:`Bearer ${t}`});
const route=(id,model='vendor/a:free')=>({id,label:id,enabled:true,provider:'OpenRouter',model,apiKey:`synthetic-${id}`,cooldownSeconds:60});
const config=()=>({provider:'OpenAI',model:'legacy',apiKey:'synthetic-legacy',routingEnabled:true,routes:[route('free'),route('paid','vendor/paid')]});
beforeAll(async()=>{execSync('node src/seed.js --force',{stdio:'ignore'});await initDb();app=createApp();admin=(await request(app).post('/api/auth/login').send({username:'admin',password:'demo'})).body.token;student=(await request(app).post('/api/auth/login').send({username:'40012345',password:'demo'})).body.token;});
beforeEach(()=>{setSetting('ai',{});setSetting('ai_vpatient',{});resetRoutingState();});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('AI routing configuration API',()=>{
 for(const path of ['/api/settings/ai','/api/admin/vpatient/ai']) {
  it(`persists order and keys with explicit per-row clear at ${path}`,async()=>{
   expect((await request(app).put(path).set(auth(admin)).send(config())).status).toBe(200);
   const get=await request(app).get(path).set(auth(admin));const saved=get.body.config||get.body;
   expect(saved.routes.map(r=>r.id)).toEqual(['free','paid']);expect(saved.apiKey).toBe('synthetic-legacy');
   const edited={...saved,routes:[{...saved.routes[1],apiKey:''},{...saved.routes[0],apiKey:'',clearApiKey:true}]};
   expect((await request(app).put(path).set(auth(admin)).send(edited)).status).toBe(200);
   const r=await request(app).get(path).set(auth(admin));const c=r.body.config||r.body;
   expect(c.routes.map(r=>r.apiKey)).toEqual(['synthetic-paid','']);
   const invalid={...c,routes:[route('same'),route('same')]};expect((await request(app).put(path).set(auth(admin)).send(invalid)).status).toBe(400);
  });
  it(`rejects malformed activation without changing saved configuration at ${path}`,async()=>{
   await request(app).put(path).set(auth(admin)).send(config());
   for (const invalid of [
    {...config(),routingEnabled:'false'},
    {...config(),routes:[{...route('free'),enabled:'false'}]},
    {...config(),routes:null},
   ]) expect((await request(app).put(path).set(auth(admin)).send(invalid)).status).toBe(400);
   const r=await request(app).get(path).set(auth(admin));
   expect((r.body.config||r.body).routes[0].apiKey).toBe('synthetic-free');
  });
  it(`invalidates old connection success after editing settings at ${path}`,async()=>{
   const key=path.includes('vpatient')?'ai_vpatient':'ai';
   setSetting(key,{...config(),connected:true});
   expect((await request(app).put(path).set(auth(admin)).send({...config(),connected:true})).status).toBe(200);
   const r=await request(app).get(path).set(auth(admin));expect((r.body.config||r.body).connected).toBe(false);
  });
  it(`refuses student read/write at ${path}`,async()=>{
   expect((await request(app).get(path).set(auth(student))).status).toBe(403);
   expect((await request(app).put(path).set(auth(student)).send(config())).status).toBe(403);
  });
 }
 it('inherits university list only when competitive settings are empty; separate list takes priority',()=>{
  setSetting('ai',config());expect(getVpatientAiEffective().routes[0].id).toBe('free');
  setSetting('ai_vpatient',{routingEnabled:true,routes:[route('competitive')]});expect(getVpatientAiEffective().apiKey).toBe('synthetic-competitive');
  setSetting('ai_vpatient',{routingEnabled:true,routes:[]});expect(getVpatientAiEffective().apiKey).toBe('');
 });
 it('admin test reports the used fallback, not the unavailable first model',async()=>{
  setSetting('ai',config());
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response('{}',{status:429}))
   .mockResolvedValueOnce(new Response(JSON.stringify({model:'vendor/paid-version',choices:[{message:{content:'از دو ساعت پیش درد دارم.'}}]}))));
  const r=await request(app).post('/api/exam/ai-test').set(auth(admin)).send({lang:'fa'});
  expect(r.body.connected).toBe(true);expect(r.body.route.id).toBe('paid');expect(r.body.model).toBe('vendor/paid-version');expect(JSON.stringify(r.body)).not.toContain('synthetic-');
 });
 it('blog rewrite uses ordered config without a legacy key',async()=>{
  setSetting('ai',{routingEnabled:true,routes:[route('only')]});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'متن بازنویسی شده.'}}]}))));
  const r=await request(app).post('/api/admin/blog/ai-rewrite').set(auth(admin)).send({text:'متن آموزشی برای بازنویسی.',lang:'fa'});
  expect(r.body.ok).toBe(true);expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('an intentionally empty university route list does not silently use competitive keys',async()=>{
  setSetting('ai',{routingEnabled:true,routes:[]});setSetting('ai_vpatient',config());
  vi.stubGlobal('fetch',vi.fn());
  const r=await request(app).post('/api/exam/ai-test').set(auth(admin)).send({lang:'fa'});
  expect(r.body.connected).toBe(false);expect(fetch).not.toHaveBeenCalled();
 });
});
