import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { routingSettings, effectiveRouting, routeCompletion, providerFailure, resetRoutingState } from '../src/lib/ai-routing.js';
import { resolveAiConfig, patientReply } from '../src/lib/ai-engine.js';
const row = (id, model='vendor/a:free', extra={}) => ({ id, label:id, enabled:true, provider:'OpenRouter', model, apiKey:'synthetic-key', quotaGroup:'shared', cooldownSeconds:60, ...extra });
const config = (...routes) => ({ routingEnabled:true, routes });
const fail = (status, detail='', retry='') => providerFailure(status, new Headers(retry ? { 'Retry-After':retry } : {}), detail);
const run = (c, send) => routeCompletion(c, [], {}, send);
beforeEach(()=>{resetRoutingState();vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-18T12:00:00Z'));});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('ordered AI connections',()=>{
 it('preserves order, key per stable id, explicit clear and rejects duplicate IDs / excess rows',()=>{
  const prev=config(row('a'),row('b','paid',{apiKey:'other'}));
  const r=routingSettings({routes:[{...row('b'),apiKey:''},{...row('a'),clearApiKey:true}]},prev);
  expect(r.routes.map(x=>x.apiKey)).toEqual(['other','']);
  expect(()=>routingSettings(config(row('a'),row('a')))).toThrow('duplicate');
  expect(()=>routingSettings(config(...Array.from({length:9},(_,i)=>row(String(i)))))).toThrow('maximum');
  expect(()=>routingSettings(config(row('a','x',{cooldownSeconds:0})))).toThrow('cooldown');
 });
 it('does not inherit legacy/env key when enabled list is empty or disabled',()=>{
  vi.stubEnv('AI_API_KEY','environment-secret');
  expect(resolveAiConfig(config(row('a','x',{enabled:false}))).apiKey).toBe('');
  expect(effectiveRouting({...config(),apiKey:'legacy'}).apiKey).toBe('');
 });
 it('uses only the first healthy enabled connection',async()=>{
  const send=vi.fn().mockResolvedValue('reply');const c=config(row('off','x',{enabled:false}),row('a'),row('b','paid'));
  expect(await run(c,send)).toBe('reply');expect(send).toHaveBeenCalledTimes(1);expect(send.mock.calls[0][0].id).toBe('a');expect(c.lastRoute.id).toBe('a');
 });
 it('falls back to paid and returns to first after Retry-After',async()=>{
  const c=config(row('a'),row('b','paid'));let failed=true;
  const send=vi.fn(async r=>{if(r.id==='a'&&failed)throw fail(429,'', '120');return r.id;});
  expect(await run(c,send)).toBe('b');failed=false;
  vi.advanceTimersByTime(119000);expect(await run(c,send)).toBe('b');
  vi.advanceTimersByTime(1001);expect(await run(c,send)).toBe('a');
 });
 it('skips other free models / keys in same account group for platform 429',async()=>{
  const c=config(row('a'),row('b','vendor/b:free',{apiKey:'different-key'}),row('c','paid'));
  const send=vi.fn(async r=>{if(r.id==='a')throw fail(429);return r.id;});
  expect(await run(c,send)).toBe('c');expect(send.mock.calls.map(x=>x[0].id)).toEqual(['a','c']);
 });
 it('tries a second free model for identified upstream capacity errors',async()=>{
  const send=vi.fn(async r=>{if(r.id==='a')throw fail(429,JSON.stringify({error:{metadata:{provider_name:'upstream'}}}));return r.id;});
  expect(await run(config(row('a'),row('b','vendor/b:free')),send)).toBe('b');
 });
 it('waits until UTC reset on a daily free quota error',async()=>{
  const c=config(row('a'),row('b','paid'));let failed=true;
  const send=vi.fn(async r=>{if(r.id==='a'&&failed)throw fail(429,'daily free limit');return r.id;});
  await run(c,send);failed=false;
  vi.setSystemTime(new Date('2026-09-18T23:59:59Z'));expect(await run(c,send)).toBe('b');
  vi.setSystemTime(new Date('2026-09-19T00:00:01Z'));expect(await run(c,send)).toBe('a');
 });
 it('accepts HTTP-date Retry-After and handles malformed headers safely',()=>{
  expect(fail(429,'','Fri, 18 Sep 2026 12:05:00 GMT').retryAt).toBe(Date.now()+300000);
  expect(Number.isNaN(fail(429,'','nonsense').retryAt)).toBe(true);
  expect(providerFailure(429,new Headers({'x-ratelimit-reset':String((Date.now()+60000)/1000)})).retryAt).toBe(Date.now()+60000);
 });
 it('falls through network, 402 and 5xx failures without leaking provider secrets',async()=>{
  const c=config(row('a'),row('b','paid'),row('c','paid'));
  const send=vi.fn().mockRejectedValueOnce(new Error('secret network body')).mockRejectedValueOnce(fail(402)).mockResolvedValueOnce('ok');
  expect(await run(c,send)).toBe('ok');
  resetRoutingState();await expect(run(config(row('a')),vi.fn().mockRejectedValue(fail(503,'secret')))).rejects.toThrow('503');
 });
 it('does not route around an access/moderation refusal, including the next request',async()=>{
  const send=vi.fn().mockRejectedValue(fail(403));const c=config(row('a'),row('b','paid'));
  await expect(run(c,send)).rejects.toThrow('403');await expect(run(c,send)).rejects.toThrow('403');
  expect(send.mock.calls.map(x=>x[0].id)).toEqual(['a','a']);
 });
 it('allows only one recovery probe while concurrent requests use fallback',async()=>{
  const c=config(row('a'),row('b','paid'));
  await run(c,async r=>{if(r.id==='a')throw fail(500);return 'b';});
  vi.advanceTimersByTime(61000);let done;
  const send=vi.fn(r=>r.id==='a'?new Promise(resolve=>{done=resolve;}):Promise.resolve('b'));
  const probing=run(c,send);expect(await run(c,send)).toBe('b');done('a');expect(await probing).toBe('a');
 });
 it('never calls legacy config or disabled paid rows when all active rows fail',async()=>{
  const c={...config(row('a'),row('b','paid',{enabled:false})),apiKey:'legacy-secret'};
  const send=vi.fn().mockRejectedValue(new Error('secret'));
  await expect(run(c,send)).rejects.toThrow('unavailable');expect(send).toHaveBeenCalledTimes(1);
  await expect(run(c,send)).rejects.toThrow('cooling');expect(send).toHaveBeenCalledTimes(1);
 });
 it('routes real engine request construction with distinct keys and same messages',async()=>{
  const c=resolveAiConfig(config(row('a'),row('b','openai/test',{apiKey:'second-synthetic'})));
  const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:{message:'rate limit'}}),{status:429,headers:{'Retry-After':'60'}}))
   .mockResolvedValueOnce(new Response(JSON.stringify({choices:[{message:{content:'از دو ساعت پیش درد دارم.'}}]}),{status:200}));
  vi.stubGlobal('fetch',fetch);
  const result=await patientReply({caseData:{chief_fa:'درد قفسه سینه'},userText:'از کی شروع شده؟',lang:'fa',prompts:{},aiCfg:c},{throwOnError:true});
  expect(result.source).toBe('llm');expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer second-synthetic');
  expect(JSON.parse(fetch.mock.calls[0][1].body).messages).toEqual(JSON.parse(fetch.mock.calls[1][1].body).messages);
  expect(c.lastRoute.id).toBe('b');
 });
});
