#!/usr/bin/env node
// OFFLINE synthetic sizing, not live completions, billing or clinical validation.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {getEncoding} from 'js-tiktoken';
import {patientReply,mockPatientReply,labImagingResult,evaluate,scoreChecklistWithLLM,enrichEvaluationWithLLM} from '../../server/src/lib/ai-engine.js';
const here=path.dirname(new URL(import.meta.url).pathname);
const fixtures=JSON.parse(fs.readFileSync(path.join(here,'synthetic-fixtures.json'),'utf8'));
const outDir=path.resolve(process.env.VP_COST_DIR||path.join(here,'../../e2e-data/cost-measurement'));
fs.mkdirSync(outDir,{recursive:true});
process.env.DATA_DIR ||= path.join(outDir,'runtime');
const outputFloor=Number(process.env.VP_PATIENT_OUTPUT_FLOOR||0);
if(![0,60,120].includes(outputFloor))throw new Error('Supported output floors: 0,60,120');
const encoders={o200k_base:getEncoding('o200k_base'),cl100k_base:getEncoding('cl100k_base')};
const questions={
 fa:['سلام، من دانشجوی پزشکی هستم؛ اجازه می‌دهید چند سؤال بپرسم؟','مشکل اصلی شما چیست؟','از کی شروع شده؟','درد کجاست؟','درد به جایی انتشار دارد؟','درد چه کیفیتی دارد؟','تهوع دارید؟','سابقه بیماری قبلی دارید؟','دارویی مصرف می‌کنید؟','حساسیت دارویی دارید؟','کسی در خانواده بیماری مشابه داشته؟','سیگار می‌کشید؟','تنگی نفس دارید؟','تب داشته‌اید؟','درد با استراحت بهتر می‌شود؟','شدت درد چقدر است؟','اخیراً سفر داشته‌اید؟','استفراغ داشته‌اید؟','علائم دیگری دارید؟','کدام علامت بیشتر شما را اذیت می‌کند؟','شروع درد ناگهانی بود؟','درد از شروع تا الان تغییر کرده؟','غذا روی درد اثری دارد؟','آخرین بار چه دارویی مصرف کردید؟','قبلاً این درد را داشته‌اید؟','بیماری زمینه‌ای در خانواده دارید؟','شغل شما چیست؟','الکل مصرف می‌کنید؟','تعریق داشته‌اید؟','سرفه داشته‌اید؟','داروها را مرتب مصرف می‌کنید؟','آلرژی شما به چه دارویی است؟','درد پیوسته است یا متناوب؟','درد به پشت هم می‌زند؟','بعد از شروع درد چه کردید؟','قبل از شروع علامت چه کار می‌کردید؟','درباره سابقه بیماری‌تان توضیح می‌دهید؟','درباره داروهای فعلی‌تان توضیح می‌دهید؟','آیا نکته دیگری از شرح‌حال مانده است؟','ممنون از پاسخ‌هایتان.'],
 en:['Hello, I am a medical student. May I ask some questions?','What is the main problem?','When did it start?','Where is the pain?','Does the pain radiate anywhere?','What does the pain feel like?','Do you have nausea?','Do you have any past medical history?','Do you take medications?','Do you have drug allergies?','Any similar family history?','Do you smoke?','Do you have shortness of breath?','Have you had fever?','Does rest relieve the pain?','How severe is the pain?','Have you travelled recently?','Have you vomited?','Any other symptoms?','Which symptom bothers you most?','Was the onset sudden?','Has the pain changed since onset?','Does food affect the pain?','What medication did you last take?','Have you had this pain before?','Any family medical history?','What is your job?','Do you drink alcohol?','Have you been sweating?','Have you had a cough?','Do you take your medications regularly?','Which drug are you allergic to?','Is the pain continuous or intermittent?','Does it radiate to the back?','What did you do after the pain started?','What were you doing at onset?','Can you describe your past medical history?','Can you describe your current medications?','Is there anything else about the history?','Thank you for answering.']};
const profiles=[{name:'short',turns:10,exams:2,unrecordedOrders:0},{name:'standard',turns:20,exams:3,unrecordedOrders:2},{name:'long',turns:40,exams:5,unrecordedOrders:4}];
let active,stage,answer;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{
 if(String(url)!=='https://openrouter.ai/api/v1/chat/completions')throw new Error('Offline meter rejects unexpected endpoint');
 const body=JSON.parse(init.body);
 const sample=typeof answer==='function'?answer(body):answer;
 if(typeof sample!=='string')throw new Error('Missing authored fixture response');
 const row={stage,messages:body.messages,authoredOutput:sample,tokens:{}};
 for(const [name,enc] of Object.entries(encoders)){
  const content=body.messages.reduce((n,m)=>n+enc.encode(m.content).length,0);
  const overhead=3+body.messages.reduce((n,m)=>n+3+enc.encode(m.role).length,0);
  row.tokens[name]={inputContent:content,estimatedChatOverhead:overhead,input:content+overhead,output:enc.encode(sample).length};
 }
 active.calls.push(row);
 return {ok:true,status:200,json:async()=>({choices:[{message:{content:sample}}]})};
};
const aiCfg={provider:'OpenRouter',model:'synthetic/offline-sizing',apiKey:'synthetic-no-network'};
const runs=[];
try{
 for(const fixture of fixtures.cases)for(const lang of ['fa','en'])for(const profile of profiles){
  const {checklist,...c}=fixture;
  active={caseId:c.id,lang,profile:profile.name,scope:'intern',patientTurns:profile.turns,examTurns:profile.exams,unrecordedOrders:profile.unrecordedOrders,recordedOrders:0,calls:[]};runs.push(active);
  const session={messages:[],tests:[],imaging:[],problemList:[],ddx:[],finalDx:''};
  for(const userText of questions[lang].slice(0,profile.turns)){
   stage='patient';answer=mockPatientReply(c,userText,lang);
   while(outputFloor && encoders.o200k_base.encode(answer).length<outputFloor)answer+=' '+(lang==='fa'?'نمونهٔ آموزشی برای سنجش طول متن.':'Authored text-length stress sample.');
   const r=await patientReply({caseData:c,userText,history:session.messages,lang,prompts:fixtures.prompts,aiCfg});
   if(r.source!=='llm')throw new Error('Fixture did not take model patient path');
   session.messages.push({role:'student',text:userText},{role:'patient',text:r.text});
  }
  const exams=lang==='fa'?['علائم حیاتی را بررسی کن','ریه را سمع کن','شکم را معاینه کن','قلب را سمع کن','معاینه عصبی انجام بده']:['Check vital signs','Auscultate the lungs','Examine the abdomen','Auscultate the heart','Perform a neurological examination'];
  for(const userText of exams.slice(0,profile.exams)){
   const offline=await patientReply({caseData:c,userText,history:session.messages,lang,prompts:fixtures.prompts,aiCfg:{}});
   stage='exam';answer=offline.text;
   const r=await patientReply({caseData:c,userText,history:session.messages,lang,prompts:fixtures.prompts,aiCfg});
   session.messages.push({role:'student',text:userText},{role:'teacher',mode:'exam',text:r.text});
  }
  // Actual chart reports cost zero generation requests, but are still ordered evidence.
  for(const item of (c.labResults||[]).slice(0,2)){
   const r=await labImagingResult({caseData:c,kind:'lab',query:item.name_en,lang,prompts:fixtures.prompts,aiCfg});
   if(r.source!=='chart')throw new Error('Recorded result should not generate');
   active.recordedOrders++;session.tests.push(item.name_en);
  }
  for(let i=0;i<profile.unrecordedOrders;i++){
   stage='unrecorded_lab';answer=lang==='fa'?'این یک پاسخ ساختگی برای اندازه‌گیری طول گزارش است؛ تفسیر بالینی تأیید نشده است.':'This is an authored sizing response; no clinical interpretation is validated.';
   const query=['TSH','ESR','Ferritin','Vitamin D'][i];
   await labImagingResult({caseData:c,kind:'lab',query,lang,prompts:fixtures.prompts,aiCfg});session.tests.push(query);
  }
  session.problemList=String(c['problem_list_'+lang]||c['chief_'+lang]||'').split('\n');
  session.ddx=[c['diagnosis_'+lang]];session.finalDx=c['diagnosis_'+lang];
  const base=evaluate({caseData:c,checklist,session,lang,scope:'intern'});
  stage='scoring';answer=body=>{
   const rubric=JSON.parse(body.messages.at(-1).content.split('RUBRIC:\n')[1].split('\n\nAUTHORITATIVE_REFERENCE:')[0]);
   return JSON.stringify({items:rubric.map((r,i)=>({id:r.id,done:i%3!==0,reason:lang==='fa'?'این داوری فرضی فقط برای اندازه‌گیری خروجی ساخته شده است.':'Authored sizing judgment, not a clinical assessment.'}))});
  };
  const scored=await scoreChecklistWithLLM({base,caseData:c,checklist,session,lang,aiCfg});
  if(scored.source!=='llm')throw new Error('Scoring fixture invalid');
  stage='lesson';answer=JSON.stringify({strengths:scored.strengths,weaknesses:scored.weaknesses,missed:scored.missed,commonMistakes:[],suggestion:lang==='fa'?'معیارهای جامانده را با استاد مرور و در برخورد بعدی ثبت کنید.':'Review missed criteria with your supervisor and document them in the next encounter.',microlearning:scored.microlearning});
  const taught=await enrichEvaluationWithLLM({base:scored,caseData:c,session,lang,prompts:fixtures.prompts,aiCfg,scope:'intern'});
  if(taught.feedbackSource!=='llm')throw new Error('Lesson fixture invalid');
  active.requestCount=active.calls.length;active.stageTotals={};
  for(const row of active.calls){
   active.stageTotals[row.stage]||={requests:0,o200k_base:{input:0,output:0},cl100k_base:{input:0,output:0}};
   const dest=active.stageTotals[row.stage];dest.requests++;
   for(const name of Object.keys(encoders))for(const side of ['input','output'])dest[name][side]+=row.tokens[name][side];
  }
  active.total=Object.fromEntries(Object.keys(encoders).map(name=>[name,{input:active.calls.reduce((n,r)=>n+r.tokens[name].input,0),output:active.calls.reduce((n,r)=>n+r.tokens[name].output,0)}]));
 }
 const source=fs.readFileSync(path.join(here,'../../server/src/lib/ai-engine.js'));
 const result={createdAt:new Date().toISOString(),method:'OFFLINE: real application request construction, authored replies, local tokenizers; NO LIVE USAGE',engineSha256:createHash('sha256').update(source).digest('hex'),tokenizers:Object.keys(encoders),overhead:'Estimated: 3 reply-priming tokens plus 3 + encoded role per message, not a guaranteed provider chat template.',liveCompletions:0,patientOutputFloor:outputFloor,runs};
 fs.writeFileSync(path.join(outDir,'samples.json'),JSON.stringify(result,null,2));
 const summary={...result,runs:runs.map(({calls,...rest})=>rest)};
 fs.writeFileSync(path.join(outDir,'summary.json'),JSON.stringify(summary,null,2));
 console.log(JSON.stringify(summary,null,2));
}finally{globalThis.fetch=originalFetch;}
