import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { routingSettings, providerFailure, resetRoutingState, routeCompletion } from '../src/lib/ai-routing.js';
const row=(id,extra={})=>({id,enabled:true,provider:'OpenRouter',model:'vendor/model:free',apiKey:'synthetic',cooldownSeconds:60,quotaGroup:'shared',...extra});
const cfg=(...routes)=>({routingEnabled:true,routes});
const run=(c,send)=>routeCompletion(c,[],{},send);
const error=(status,detail='',headers={})=>providerFailure(status,new Headers(headers),detail);
beforeEach(()=>{resetRoutingState();vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-18T12:00:00Z'));});
afterEach(()=>vi.useRealTimers());
describe('audit9 routing regressions',()=>{
 it('honors explicit Retry-After rather than forcing a daily error to next midnight',async()=>{
  const c=cfg(row('a'),row('b',{model:'paid'}));
  await run(c,async r=>{if(r.id==='a')throw error(429,'daily quota',{'Retry-After':'30'});return 'b';});
  vi.advanceTimersByTime(31000);expect(await run(c,async r=>r.id)).toBe('a');
 });
 it('does not impose OpenRouter UTC daily reset on other providers',async()=>{
  const c=cfg(row('a',{provider:'Groq',model:'test'}),row('b',{model:'paid'}));
  await run(c,async r=>{if(r.id==='a')throw error(429,'daily quota');return 'b';});
  vi.advanceTimersByTime(61000);expect(await run(c,async r=>r.id)).toBe('a');
 });
 it('does not clear a newer cooldown when an older concurrent call succeeds',async()=>{
  const c=cfg(row('a',{provider:'OpenAI',model:'test'}),row('b',{model:'paid'}));let finish;
  const pending=run(c,r=>new Promise(resolve=>{finish=resolve;}));
  await run(c,async r=>{if(r.id==='a')throw error(503);return 'b';});
  finish('old success');await pending;
  expect(await run(c,async r=>r.id)).toBe('b');
 });
 it('does not shorten a newer cooldown when overlapping failures finish out of order',async()=>{
  const c=cfg(row('a',{provider:'OpenAI',model:'test'}),row('b',{model:'paid'}));const rejects=[];
  const send=r=>r.id==='a'?new Promise((resolve,reject)=>rejects.push(reject)):Promise.resolve('b');
  const first=run(c,send),second=run(c,send);
  rejects[0](error(429,'',{'Retry-After':'120'}));await first;
  rejects[1](error(429,'',{'Retry-After':'5'}));await second;
  vi.advanceTimersByTime(10000);expect(await run(c,async r=>r.id)).toBe('b');
 });
 for(const [name,input] of [
  ['routingEnabled',{routingEnabled:'false',routes:[]}],
  ['enabled',cfg(row('a',{enabled:'false'}))],
  ['clearApiKey',cfg(row('a',{clearApiKey:'false'}))],
 ]) it(`rejects nonboolean ${name} instead of interpreting it as permission`,()=>{
  expect(()=>routingSettings(input)).toThrow('AI routing:');
 });
 it('retains a same-endpoint stored key when the incoming key is only whitespace',()=>{
  const r=routingSettings(cfg(row('a',{apiKey:'   '})),cfg(row('a')));
  expect(r.routes[0].apiKey).toBe('synthetic');
 });
 for(const change of [{provider:'Groq'}, {baseUrl:'https://other.example/v1'}])
  it(`does not inherit a saved key when its destination changes: ${Object.keys(change)[0]}`,()=>{
   const r=routingSettings(cfg(row('a',{...change,apiKey:''})),cfg(row('a')));
   expect(r.routes[0].apiKey).toBe('');
  });
 it('platform rate-limit headers take precedence over incidental provider metadata',()=>{
  const e=error(429,JSON.stringify({error:{message:'Rate limited',metadata:{provider_name:'upstream'}}}),{'X-RateLimit-Limit':'20','X-RateLimit-Remaining':'0','X-RateLimit-Reset':String((Date.now()+60000)/1000)});
  expect(e.upstream).toBe(false);
 });
 it('does not infer daily quota from unrelated diagnostic fields',()=>{
  const e=error(429,JSON.stringify({error:{message:'Rate limited per minute',metadata:{request_id:'daily-debug-id'}}}));
  expect(e.daily).toBe(false);
 });
 it('gives evaluation completions enough time rather than aborting every route at 15 seconds',async()=>{
  const send=vi.fn(async(_r,_m,opts)=>{if(opts.timeoutMs<20000)throw new Error('AI request timed out');return 'valid full evaluation';});
  expect(await routeCompletion(cfg(row('a')),[],{workload:'evaluation',timeoutMs:40000,totalTimeoutMs:45000},send)).toBe('valid full evaluation');
  expect(send.mock.calls[0][2].timeoutMs).toBe(40000);
 });

 it('does not let a short chat timeout disable the longer evaluation budget',async()=>{
  const c=cfg(row('a'));
  await expect(routeCompletion(c,[],{},async()=>{throw new Error('AI request timed out');})).rejects.toThrow();
  expect(await routeCompletion(c,[],{workload:'evaluation',timeoutMs:40000,totalTimeoutMs:45000},async()=> 'graded')).toBe('graded');
  await expect(routeCompletion(c,[],{},async()=> 'chat')).rejects.toThrow('cooling');
 });

 for(const status of [429,401])it(`keeps HTTP ${status} cooldown shared across chat and evaluation`,async()=>{
  const c=cfg(row('a'));const send=vi.fn(async()=>{throw error(status);});
  await expect(routeCompletion(c,[],{},send)).rejects.toThrow();
  await expect(routeCompletion(c,[],{workload:'evaluation'},send)).rejects.toThrow('cooling');
  expect(send).toHaveBeenCalledTimes(1);
 });

});
