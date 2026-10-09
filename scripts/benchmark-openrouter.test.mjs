import test from 'node:test';
import assert from 'node:assert/strict';
import {freeModel,guardedFetch,exercise} from './benchmark-openrouter.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.MED_SOURCE_ROOT||(fs.existsSync('.work/proj/server/src/lib/ai-engine.js')?'.work/proj':'.');
const engine=await import(pathToFileURL(path.resolve(root,'server/src/lib/ai-engine.js')));
const id='synthetic/model:free';
const json=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}});
const req=(model=id)=>({method:'POST',body:JSON.stringify({model,messages:[]})});
test('catalog rejects missing pricing, paid routes and extra nonzero charges',()=>{
 assert.equal(freeModel({id,pricing:{prompt:'0',completion:'0'}}),true);
 for(const m of [{id},{id,pricing:{prompt:'0'}},{id:'vendor/paid',pricing:{prompt:0,completion:0}},{id,pricing:{prompt:0,completion:0,request:1}},{id,pricing:{prompt:0,completion:'NaN'}}]) assert.equal(freeModel(m),false);
});
test('outbound guard blocks other origins, paid models and fallback lists',async()=>{
 let n=0;const guard=guardedFetch(async()=>{n++;return json({});},new Set([id]),[]);
 await assert.rejects(()=>guard('https://other.example/api/v1/chat/completions',req()));
 await assert.rejects(()=>guard('https://openrouter.ai/api/v1/chat/completions',req('vendor/paid')));
 await assert.rejects(()=>guard('https://openrouter.ai/api/v1/chat/completions',{method:'POST',body:JSON.stringify({model:id,models:['vendor/paid']})}));
 assert.equal(n,0);
});
test('request caps, zero price and redirect protection are enforced',async()=>{
 let sent;const metrics=[];const guard=guardedFetch(async(u,o)=>{sent=o;return json({usage:{cost:0}});},new Set([id]),metrics,1);
 await guard('https://openrouter.ai/api/v1/chat/completions',req());
 assert.deepEqual(JSON.parse(sent.body).provider.max_price,{prompt:0,completion:0});
 assert.equal(JSON.parse(sent.body).provider.allow_fallbacks,false);
 assert.equal(sent.redirect,'error');assert.equal(JSON.parse(sent.body).max_tokens,1024);
 await assert.rejects(()=>guard('https://openrouter.ai/api/v1/chat/completions',req()),/REQUEST_LIMIT/);
 assert.equal(metrics.length,1);
});
test('nonzero reported cost fails; missing cost stays unknown',async()=>{
 const metrics=[];let cost=0.01;
 const guard=guardedFetch(async()=>json({usage:cost===null?{}:{cost}}),new Set([id]),metrics);
 await assert.rejects(()=>guard('https://openrouter.ai/api/v1/chat/completions',req()),/NONZERO_COST/);
 cost=null;await guard('https://openrouter.ai/api/v1/chat/completions',req());
 assert.equal(metrics[1].reportedCost,null);
});
for(const lang of ['en','fa'])test('actual MED patient/grading engine, simulated upstream: '+lang,async()=>{
 const original=globalThis.fetch;const payloads=[];
 globalThis.fetch=async(u,o)=>{
  const body=JSON.parse(o.body);payloads.push(body);
  const grading=body.messages[0].content.includes('OSCE examiner');
  if(grading){assert.match(body.messages[1].content,/STUDENT:/);assert.match(body.messages[1].content,/medications|دارویی/);}
  const content=grading?JSON.stringify({items:['med','pl','ddx','dx'].map(id=>({id,done:id==='med',reason:'Synthetic test evidence'}))}):(lang==='fa'?'متفورمین مصرف می‌کنم.':'I take metformin.');
  return json({choices:[{message:{content}}],usage:{cost:0}});
 };
 try {
  const r=await exercise(engine,id,'synthetic-not-a-real-key',lang,1);
  assert.equal(payloads.length,2);
  assert.ok(Object.values(r.checks).every(Boolean),JSON.stringify(r.checks));
  assert.ok(!JSON.stringify(r).includes('synthetic-not-a-real-key'));
 } finally {globalThis.fetch=original;}
});
test('malformed grading is a failed check, not a successful mock score',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(u,o)=>json({choices:[{message:{content:JSON.parse(o.body).messages[0].content.includes('OSCE examiner')?'not grading JSON':'I take metformin.'}}]});
 try {const r=await exercise(engine,id,'synthetic','en',1);assert.equal(r.checks.realGradingProvider,false);}finally{globalThis.fetch=original;}
});
