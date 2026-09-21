import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluate, scoreChecklistWithLLM, enrichEvaluationWithLLM, patientReply } from '../src/lib/ai-engine.js';

const aiCfg={provider:'OpenRouter',model:'test/model:free',apiKey:'test-only-not-a-secret'};
const prompts={patient_en:'Answer only the requested chart fact.', evaluator_en:'Evaluate the encounter.',micro_en:'Teach the missed steps.'};
const caseData={chief_en:'Chest pain',diagnosis_en:'Acute coronary syndrome',history_en:'Pressure for one hour.',exam_en:'Lungs clear.',objectives_en:'Recognize red flags.',labResults:[],imagingResults:[]};
const checklist={items:[
 {id:'h',section:'history',weight:2,en:'Ask about onset',fa:'زمان شروع',keys:['onset']},
 {id:'p',section:'problem_list',weight:2,en:'Problem list',fa:'فهرست مشکلات',keys:['pain']},
 {id:'d',section:'ddx',weight:2,en:'Differential diagnoses',fa:'افتراق',keys:['ACS']},
 {id:'x',section:'diagnosis',weight:2,en:'Correct final diagnosis',fa:'تشخیص نهایی',keys:['Acute coronary syndrome']},
]};
const session={messages:[{role:'student',text:'When was the onset?'}],tests:[],imaging:[],problemList:['pain'],ddx:['ACS'],finalDx:'Acute coronary syndrome'};
const base=()=>evaluate({caseData,checklist,session,lang:'en'});
const validItems=()=>checklist.items.map(it=>({id:it.id,done:false,reason:'Not demonstrated.'}));
function mock(content,status=200){return vi.stubGlobal('fetch',vi.fn(async()=>({ok:status===200,status,json:async()=>({choices:[{message:{content:typeof content==='string'?content:JSON.stringify(content)}}]}),text:async()=> 'rate limited'})));}
const score=(b=base())=>scoreChecklistWithLLM({base:b,caseData,checklist,session,lang:'en',aiCfg});
const feedback={strengths:[],weaknesses:['Clarify symptom onset.'],missed:[],commonMistakes:[],suggestion:'Rehearse a focused interview.',microlearning:'### Practice\nAsk when the symptom began and explain why the timeline changes the differential diagnosis.'};
const enrich=b=>enrichEvaluationWithLLM({base:b,caseData,session,lang:'en',prompts,aiCfg});
afterEach(()=>vi.unstubAllGlobals());

describe('VP provider output contracts',()=>{
 for(const [name,mutate] of [
  ['string false',r=>{r.items[0].done='false';}],
  ['missing item',r=>{r.items.pop();}],
  ['duplicate ID',r=>{r.items[1].id='h';}],
  ['unknown ID',r=>{r.items[1].id='foreign';}],
  ['wrong reason type',r=>{r.items[0].reason={text:'no'};}],
 ]) it(`rejects ${name} instead of silently changing grades`,async()=>{
  const r={items:validItems()};mutate(r);mock(r);const b=base(),out=await score(b);
  expect(out.source).toBe('mock');expect(out.score).toBe(b.score);expect(out.results).toEqual(b.results);expect(out.scoreFallback?.stage).toBe('checklist');
 });
 it('rejects unparseable scoring output',async()=>{mock('I cannot produce JSON.');const out=await score();expect(out.scoreFallback?.stage).toBe('checklist');});
 it('accepts a complete boolean response and refreshes the missed-step lesson',async()=>{
  mock({items:validItems()});const out=await score();expect(out.source).toBe('llm');expect(out.score).toBe(0);expect(out.microlearning).toContain('Ask about onset');
 });
 it('ignores extra commentary items when every rubric id is present once',async()=>{
  mock({items:[...validItems(),{id:'zzz',done:true,reason:'commentary'}]});
  const out=await score();expect(out.source).toBe('llm');expect(out.score).toBe(0);
 });
 it('still AI-scores an empty checklist via synthesized problem-list and ddx items',async()=>{
  mock({items:[{id:'pl01',done:true,reason:'listed'},{id:'ddx01',done:false,reason:'missing'}]});
  const empty={items:[]};
  const out=await scoreChecklistWithLLM({base:evaluate({caseData,checklist:empty,session,lang:'en'}),caseData,checklist:empty,session,lang:'en',aiCfg});
  expect(out.source).toBe('llm');expect(out.results.some(r=>r.id==='pl01'&&r.done)).toBe(true);expect(out.results.some(r=>r.id==='ddx01'&&!r.done)).toBe(true);
 });
 it('gives the examiner a separate authoritative reference, with sections',async()=>{
  mock({items:validItems()});await score();const body=JSON.parse(fetch.mock.calls[0][1].body),text=body.messages.at(-1).content;
  expect(text).toContain('AUTHORITATIVE_REFERENCE');expect(text).toContain('Acute coronary syndrome');expect(text).toContain('"section":"diagnosis"');
  expect(body.messages[0].content).toContain('untrusted');
 });
 it('does not retry quota failures as JSON-format failures',async()=>{
  mock('',429);const out=await score();expect(fetch).toHaveBeenCalledTimes(1);expect(out.scoreFallback).toBeTruthy();
 });
 it('does not retry authentication errors',async()=>{mock('',401);await score();expect(fetch).toHaveBeenCalledTimes(1);});
 it('rejects reasoning-only responses rather than leaking them as patient speech',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:null,reasoning_content:'PRIVATE REASONING TRACE'}}]})})));
  const out=await patientReply({caseData,userText:'When did it start?',history:[],lang:'en',prompts,aiCfg});
  expect(out.source).not.toBe('llm');expect(out.text).not.toContain('PRIVATE REASONING');
 });
 it('does not relabel keyword grading as LLM grading after successful teaching',async()=>{
  mock(feedback);const b={...base(),source:'mock',scoreFallback:{stage:'checklist',error:'invalid response'}};const out=await enrich(b);
  expect(out.source).toBe('mock');expect(out.feedbackSource).toBe('llm');expect(out.scoreFallback).toEqual(b.scoreFallback);expect(out.score).toBe(b.score);
 });
 it('keeps authoritative strengths and missed items when teaching contradicts grading',async()=>{
  mock({...feedback,strengths:['Invented full marks'],missed:['Invented omission']});const b=base(),out=await enrich(b);
  expect(out.strengths).toEqual(b.strengths);expect(out.missed).toEqual(b.missed);
 });
 it('rejects malformed feedback arrays without corrupting UI fields',async()=>{
  mock({...feedback,weaknesses:'not an array'});const b=base(),out=await enrich(b);
  expect(out.weaknesses).toEqual(b.weaknesses);expect(out.feedbackFallback?.stage).toBe('enrich');
 });
 it('accepts a nested markdown lesson object from the model',async()=>{
  mock({...feedback,microlearning:{markdown:'### Practice\nAsk when the symptom began and record the timeline in the history.'}});
  const out=await enrich(base());expect(out.feedbackSource).toBe('llm');expect(out.microlearning).toContain('Ask when the symptom began');
 });
 it('preserves grading-failure provenance if teaching also fails',async()=>{
  mock('invalid');const b={...base(),source:'mock',scoreFallback:{stage:'checklist',error:'bad scoring'}};const out=await enrich(b);
  expect(out.scoreFallback).toEqual(b.scoreFallback);expect(out.feedbackFallback?.stage).toBe('enrich');
 });
});

describe('paraclinic orders in workup review',()=>{
 it('counts a recorded ECG as appropriate whether ordered as imaging or paraclinic',()=>{
  const c={...caseData,paraclinicResults:[{name_en:'ECG',name_fa:'نوار قلب',result_en:'ST elevation'}],imagingResults:[],labResults:[]};
  const asImaging=evaluate({caseData:c,checklist,session:{...session,tests:[],imaging:['ECG']},lang:'en'});
  expect(asImaging.orderReview.appropriate).toContain('ECG');expect(asImaging.orderReview.unnecessary).not.toContain('ECG');
  const asPara=evaluate({caseData:c,checklist,session:{...session,tests:[],imaging:[],paraclinic:['ECG']},lang:'en'});
  expect(asPara.orderReview.appropriate).toContain('ECG');
 });
});

describe('targeted remediation',()=>{
 it('targets missed criteria rather than completed steps and includes a self-check',()=>{
  const empty={messages:[],tests:[],imaging:[],ddx:[],problemList:[],finalDx:''};
  const out=evaluate({caseData,checklist,session:empty,lang:'en'});
  expect(out.microlearning).toContain('Practice criterion: Ask about onset');
  expect(out.microlearning).toContain('Self-check:');
  expect(out.microlearning).toContain('Next action:');
 });
 it('does not use out-of-scope diagnosis failures as extern practice items',()=>{
  const out=evaluate({caseData,checklist,session:{messages:[],ddx:[],problemList:[]},lang:'en',scope:'extern'});
  expect(out.microlearning).not.toContain('Correct final diagnosis');
 });
 it('never invents an omission for a fully completed checklist',()=>{
  const out=base();expect(out.microlearning).toContain('Consolidation practice');
  expect(out.microlearning).not.toContain('Practice criterion:');
 });
});

it('teaching receives the scoped score and no out-of-scope failed criteria',async()=>{
 mock(feedback);
 const b=base();b.sectionScores={...b.sectionScores,extern:100,overall:75};
 await enrichEvaluationWithLLM({base:b,caseData,session,lang:'en',prompts,aiCfg,scope:'extern'});
 const content=JSON.parse(fetch.mock.calls[0][1].body).messages.at(-1).content;
 const context=JSON.parse(content.split('CONTEXT:\n')[1]);
 expect(context.objectiveScore).toBe(100);
 expect(context.checklistResults.some(r=>r.section==='diagnosis')).toBe(false);
});

describe('VP second-audit conversation and retry regressions',()=>{
 for(const terminal of [401,402,429,500]) it(`stops when JSON compatibility retry returns ${terminal}`,async()=>{
  vi.stubGlobal('fetch',vi.fn()
   .mockResolvedValueOnce({ok:false,status:400,text:async()=>''})
   .mockResolvedValue({ok:false,status:terminal,text:async()=> 'sensitive provider body'}));
  const out=await score();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(out.scoreFallback).toBeTruthy();
  expect(JSON.stringify(out)).not.toContain('sensitive provider body');
 });
 it('does not misattribute teacher speech to the patient',async()=>{
  mock('It began an hour ago.');
  await patientReply({caseData,userText:'When did it start?',history:[
   {role:'student',text:'Hello'}, {role:'teacher',text:'PRIVATE TEACHER HINT'},
   {role:'patient',text:'Hello doctor'}, {role:'lab',text:'LAB ARTIFACT'}
  ],lang:'en',prompts,aiCfg});
  const msgs=JSON.parse(fetch.mock.calls[0][1].body).messages;
  expect(msgs.slice(1).map(m=>m.content)).toEqual(['Hello','Hello doctor','When did it start?']);
 });
 for(const history of [null,{},[null,7,{role:'patient',text:{unsafe:'object'}},{role:'student',text:'Hello'}]])
 it(`sanitizes malformed conversation history ${JSON.stringify(history)}`,async()=>{
  mock('It began an hour ago.');
  const out=await patientReply({caseData,userText:'When did it start?',history,lang:'en',prompts,aiCfg});
  expect(out.source).toBe('llm');
  expect(JSON.parse(fetch.mock.calls[0][1].body).messages.every(m=>typeof m.content==='string')).toBe(true);
 });
});
