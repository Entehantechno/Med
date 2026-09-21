import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {scoreChecklistWithLLM,evaluate,patientReply,resolveAiConfig} from '../src/lib/ai-engine.js';
import {resetRoutingState,routeCompletion} from '../src/lib/ai-routing.js';
const route={id:'speed',enabled:true,provider:'OpenRouter',model:'vendor/test:free',apiKey:'synthetic-key',cooldownSeconds:60};
const cfg=()=>resolveAiConfig({routingEnabled:true,routes:[{...route}]});
beforeEach(async()=>{await import('../src/lib/security.js');resetRoutingState();vi.useFakeTimers();});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('allows a real engine checklist response at 20 simulated seconds without timing out at 15',async()=>{
 const bodies=[];
 vi.stubGlobal('fetch',vi.fn(async(_url,opts)=>{
  const body=JSON.parse(opts.body);bodies.push(body);
  const rubric=JSON.parse(body.messages.at(-1).content.split('RUBRIC:\n')[1].split('\n\nAUTHORITATIVE_REFERENCE:')[0]);
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>resolve({ok:true,status:200,json:async()=>({choices:[{message:{content:JSON.stringify({items:rubric.map(r=>({id:r.id,done:false,reason:'Not demonstrated'}))})}}]})}),20000);
   opts.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(Object.assign(new Error('aborted'),{name:'AbortError'}));},{once:true});
  });
 }));
 const caseData={chief_en:'Chest pain',diagnosis_en:'Example'},checklist={items:[{id:'h1',weight:1,section:'history',en:'Onset',fa:'زمان شروع'}]},session={messages:[],tests:[],imaging:[],ddx:[]};
 const base=evaluate({caseData,checklist,session,lang:'en'});
 const pending=scoreChecklistWithLLM({base,caseData,checklist,session,lang:'en',aiCfg:cfg()});
 await vi.advanceTimersByTimeAsync(20001);
 const result=await pending;expect(result.source).toBe('llm');expect(result.scoreFallback).toBeUndefined();
 expect(bodies[0].provider).toEqual({sort:'throughput'});expect(fetch).toHaveBeenCalledTimes(1);
});
it('prefers low latency for free chat without changing model or enabling paid fallback',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:'It started two hours ago.'}}]})})));
 const c=cfg();await patientReply({caseData:{chief_en:'Chest pain'},userText:'When did it start?',lang:'en',prompts:{},aiCfg:c},{throwOnError:true});
 const body=JSON.parse(fetch.mock.calls[0][1].body);expect(body.provider).toEqual({sort:'latency'});expect(body.model).toBe('vendor/test:free');
 const paid=resolveAiConfig({provider:'OpenRouter',model:'vendor/paid',apiKey:'synthetic-key'});
 await patientReply({caseData:{chief_en:'Chest pain'},userText:'When did it start?',lang:'en',prompts:{},aiCfg:paid},{throwOnError:true});
 expect(JSON.parse(fetch.mock.calls[1][1].body).provider).toBeUndefined();
});
it('bounds the interactive fallback chain to 35 seconds instead of 50',async()=>{
 const c=cfg();c.routes=Array.from({length:8},(_,i)=>({...route,id:String(i),model:`vendor/${i}:free`}));
 const time=Date.now();const budgets=[];
 const send=vi.fn(async(_r,_m,o)=>{budgets.push(o.timeoutMs);vi.setSystemTime(Date.now()+o.timeoutMs);throw new Error('AI request timed out');});
 await expect(routeCompletion(c,[],{timeoutMs:30000,totalTimeoutMs:35000},send)).rejects.toThrow();
 expect(Date.now()-time).toBe(35000);expect(budgets).toEqual([15000,15000,5000]);
});
