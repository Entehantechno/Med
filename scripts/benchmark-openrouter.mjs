#!/usr/bin/env node
// Standalone Node 20+ runner. No packages, database, or production settings required.
// Examples (set OPENROUTER_API_KEY privately, not as a command-line argument):
// node scripts/benchmark-openrouter.mjs --preflight
// node scripts/benchmark-openrouter.mjs --models vendor/model:free --repeats 2
// MED_SOURCE_ROOT=/path/to/extracted/package selects an installed MED source tree.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const ORIGIN = 'https://openrouter.ai';
export const chart = {
  age:42, sex:'female', chief_en:'Headache', chief_fa:'سردرد',
  history_en:'Headache began yesterday. I take metformin 500 mg daily. No other history is recorded.',
  history_fa:'سردرد از دیروز شروع شد. روزانه متفورمین ۵۰۰ میلی‌گرم مصرف می‌کنم. سابقه دیگری ثبت نشده است.',
  medications_en:'Metformin 500 mg daily', medications_fa:'متفورمین ۵۰۰ میلی‌گرم روزانه',
  diagnosis_en:'Synthetic examiner-only diagnosis', diagnosis_fa:'تشخیص ساختگی مخصوص ممتحن',
  problem_list_en:'Headache', problem_list_fa:'سردرد', ddx_en:'Tension headache', ddx_fa:'سردرد تنشی'
};
export const checklist = {items:[
  {id:'med',section:'history',weight:1,en:'Ask about medications',fa:'پرسیدن داروها',keys:['medication','دارو']},
  {id:'pl',section:'problem_list',weight:1,en:'Record problem list',fa:'ثبت فهرست مشکلات'},
  {id:'ddx',section:'ddx',weight:1,en:'Record differential diagnosis',fa:'ثبت تشخیص افتراقی'},
  {id:'dx',section:'diagnosis',weight:1,en:'Record correct final diagnosis',fa:'ثبت تشخیص نهایی صحیح'}
]};
export function freeModel(m) {
  const p=m?.pricing;
  return !!(m?.id?.endsWith(':free') && p && ['prompt','completion'].every(k=>p[k] != null && Number(p[k])===0)
    && Object.values(p).every(v=>v != null && Number.isFinite(Number(v)) && Number(v)===0));
}
export function guardedFetch(realFetch, allowed, metrics, limit=48) {
  let calls=0;
  return async (url,options={})=>{
    const u=new URL(url);
    if(u.origin!==ORIGIN || u.pathname!=='/api/v1/chat/completions' || u.search || options.method!=='POST') throw new Error('BENCH_OUTBOUND_BLOCKED');
    const b=JSON.parse(options.body);
    if(!allowed.has(b.model) || !b.model.endsWith(':free') || b.models || b.route) throw new Error('BENCH_PAID_OR_FALLBACK_BLOCKED');
    if(++calls>limit) throw new Error('BENCH_REQUEST_LIMIT');
    // Even automatic provider selection is constrained to zero-priced tokens.
    b.provider={...b.provider,max_price:{prompt:0,completion:0},allow_fallbacks:false};
    b.max_tokens=1024;
    b.usage={include:true};
    const start=performance.now();
    const res=await realFetch(u.href,{...options,redirect:'error',body:JSON.stringify(b)});
    const data=await res.clone().json().catch(()=>null);
    metrics.push({model:b.model,status:res.status,ms:Math.round(performance.now()-start),
      promptTokens:data?.usage?.prompt_tokens??null,completionTokens:data?.usage?.completion_tokens??null,
      reportedCost:data?.usage?.cost??null,servedModel:data?.model??null});
    if(data?.usage?.cost != null && Number(data.usage.cost)!==0) throw new Error('BENCH_NONZERO_COST_STOP');
    return res;
  };
}
export async function exercise(engine, model, apiKey, lang, repeat) {
  const aiCfg={provider:'OpenRouter',model,apiKey};
  const question=lang==='fa'?'چه دارویی مصرف می‌کنید؟':'What medications do you take?';
  const start=performance.now();
  const patient=await engine.patientReply({caseData:chart,userText:question,history:[],lang,prompts:{},aiCfg},{throwOnError:true});
  const session={messages:[{role:'student',text:question},{role:'patient',text:lang==='fa'?'متفورمین مصرف می‌کنم.':'I take metformin.'}],problemList:[],ddx:[],finalDx:'',tests:[],imaging:[]};
  const base=engine.evaluate({caseData:chart,checklist,session,lang});
  const grade=await engine.scoreChecklistWithLLM({base,caseData:chart,checklist,session,lang,aiCfg});
  const medicationMention=/metformin|متفورمین/i.test(patient.text||'');
  const marks=Object.fromEntries((grade.results||[]).map(r=>[r.id,r.done]));
  return {model,lang,repeat,ms:Math.round(performance.now()-start),patientSource:patient.source,
    // These are narrow automatic checks, not a clinical-quality score.
    checks:{realPatientProvider:patient.source==='llm',medicationMention,
      noExaminerDiagnosis:!String(patient.text).includes(chart.diagnosis_en)&&!String(patient.text).includes(chart.diagnosis_fa),
      realGradingProvider:grade.source==='llm'&&!grade.scoreFallback,
      rubricEvidence:marks.med===true&&marks.pl===false&&marks.ddx===false&&marks.dx===false},
    patientText:String(patient.text||'').replaceAll(apiKey,'[REDACTED]'),
    gradingItems:(grade.results||[]).map(r=>({id:r.id,done:r.done})),needsHumanClinicalReview:true};
}
export async function main(args=process.argv.slice(2)) {
  const value=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
  const output=path.resolve(value('--output','openrouter-benchmark-result.json'));
  const report={kind:'MED engine smoke benchmark, not HTTP/UI end-to-end or clinical certification',
    startedAt:new Date().toISOString(),paidAllowed:false,status:'preflight',results:[],requests:[],limitations:[
      'Only synthetic bilingual medication interview and checklist scoring are exercised.',
      'No examination, orders, lesson generation, concurrency, clinical certification or model ranking from this small sample.',
      'Missing provider usage/cost is unknown, not proof of zero billed usage. Check OpenRouter usage dashboard.',
      'Free-provider availability and rate limits can change. The fixed token cap may truncate reasoning models.'
    ]};
  const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  let catalog;
  try {
    const r=await fetch(ORIGIN+'/api/v1/models',{redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!r.ok) throw new Error('HTTP_'+r.status);
    const d=await r.json();if(!Array.isArray(d.data))throw new Error('BAD_CATALOG');
    catalog=d.data;
  } catch(e) {
    report.status='blocked_catalog_connection';report.errorCode=e.cause?.code||e.name;
    save();console.log('BLOCKED: catalog unavailable; no key or inference request sent. Report:',output);return 2;
  }
  report.availableFreeIds=catalog.filter(freeModel).map(m=>m.id);
  if(args.includes('--preflight')){report.status='catalog_only_no_inference';save();console.log('Free catalog IDs:',report.availableFreeIds.join('\n'));return 0;}
  const ids=String(value('--models','')).split(',').map(s=>s.trim()).filter(Boolean);
  const repeats=Number(value('--repeats','2'));
  if(!ids.length||ids.length>4||new Set(ids).size!==ids.length||!Number.isInteger(repeats)||repeats<1||repeats>3)throw new Error('Specify 1–4 unique --models IDs and --repeats 1–3');
  for(const id of ids) if(!catalog.some(m=>m.id===id&&freeModel(m)))throw new Error('Model absent or not explicitly zero-priced: '+id);
  // Confirm serving endpoints as well as the catalog; a stale :free page is insufficient.
  for(const id of ids){
    const r=await fetch(ORIGIN+'/api/v1/models/'+id.split('/').map(encodeURIComponent).join('/')+'/endpoints',{redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw new Error('Endpoint lookup failed');
    const d=await r.json();if(!d.data?.endpoints?.length)throw new Error('No active endpoint for '+id);
  }
  const apiKey=process.env.OPENROUTER_API_KEY?.trim();
  if(!apiKey)throw new Error('Set OPENROUTER_API_KEY privately in your local environment; never pass it as an argument');
  delete process.env.OPENROUTER_API_KEY;
  const root=process.env.MED_SOURCE_ROOT || (fs.existsSync('.work/proj/server/src/lib/ai-engine.js')?'.work/proj':'.');
  const engine=await import(pathToFileURL(path.resolve(root,'server/src/lib/ai-engine.js')));
  const realFetch=globalThis.fetch;
  const wrapper=guardedFetch(realFetch,new Set(ids),report.requests);
  let lastRequest=0,terminal=false;
  globalThis.fetch=async (...a)=>{
    if(terminal)throw new Error('BENCH_STOPPED');
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,3500-(Date.now()-lastRequest))));lastRequest=Date.now();
    const r=await wrapper(...a);
    if([401,402,429].includes(r.status)){terminal=true;throw new Error('BENCH_PROVIDER_LIMIT_STOP');}
    return r;
  };
  try {
    outer:for(const model of ids)for(let repeat=1;repeat<=repeats;repeat++)for(const lang of ['en','fa']){
      try {report.results.push(await exercise(engine,model,apiKey,lang,repeat));}
      catch {report.results.push({model,lang,repeat,status:'failed',error:'Provider/engine failure; raw diagnostics deliberately omitted'});}
      if(report.requests.some(r=>r.reportedCost!=null&&Number(r.reportedCost)!==0)||terminal){report.status='stopped_limit_or_cost';break outer;}
    }
    if(report.status==='preflight')report.status='completed_smoke_only';
  } finally {globalThis.fetch=realFetch;save();}
  console.log('Report:',output,'— review clinical outputs manually; no automatic best-model claim.');
  return report.status==='completed_smoke_only'&&report.results.every(r=>r.checks&&Object.values(r.checks).every(Boolean))?0:1;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  main().then(code=>process.exitCode=code).catch(()=>{console.error('Benchmark stopped safely: verify options, source path, free endpoint availability and private key configuration. No raw provider diagnostics printed.');process.exitCode=2;});
}
