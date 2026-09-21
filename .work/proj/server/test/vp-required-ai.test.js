import {describe,it,expect,beforeAll,beforeEach,afterEach,vi} from 'vitest';
import {execSync} from 'node:child_process';
import request from 'supertest';
import {initDb,db} from '../src/db.js';
import {createApp} from '../src/app.js';
import {setSetting} from '../src/routes/content.js';
let app,token;
const count=()=>db.prepare('SELECT COUNT(*) n FROM attempts').get().n;
const session={messages:[{role:'student',text:'سلام من پزشک هستم، اجازه می‌دهید بپرسم درد از کی شروع شده؟'}],problemList:['درد قفسه سینه'],ddx:['ACS'],tests:[],imaging:[],finalDx:''};
const submit=()=>request(app).post('/api/exam/evaluate').set('Authorization',`Bearer ${token}`).send({caseId:1,lang:'fa',session,durationSec:120});
const lesson={strengths:[],weaknesses:[],missed:[],commonMistakes:[],suggestion:'تمرین شرح‌حال با استاد.',microlearning:'### تمرین هدفمند\nزمان شروع درد را صریح بپرسید و پاسخ را در شرح‌حال ثبت کنید. سپس معیارهای جامانده را با استاد مرور کنید.'};
function provider({badScore=false,badLesson=false}={}){
 vi.stubGlobal('fetch',vi.fn(async(url,init)=>{
  const body=JSON.parse(init.body),user=body.messages.at(-1).content;
  const isScore=user.startsWith('RUBRIC:');
  const rubric=isScore?JSON.parse(user.split('RUBRIC:\n')[1].split('\n\nAUTHORITATIVE_REFERENCE:')[0]):[];
  const value=isScore?(badScore?{items:[]}:{items:rubric.map(r=>({id:r.id,done:false,reason:'شاهد کافی ثبت نشده است.'}))}):(badLesson?{microlearning:''}:lesson);
  return {ok:true,status:200,json:async()=>({choices:[{message:{content:JSON.stringify(value)}}]})};
 }));
}
beforeAll(async()=>{execSync('node src/seed.js --force',{stdio:'ignore'});await initDb();app=createApp();token=(await request(app).post('/api/auth/login').send({username:'admin',password:'demo'})).body.token;});
beforeEach(()=>{vi.stubEnv('VP_REQUIRE_AI_EVALUATION','1');vi.stubEnv('AI_API_KEY','');setSetting('ai',{provider:'OpenRouter',model:'test/free',apiKey:'synthetic-only'});setSetting('ai_vpatient',{});});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('AI-required final evaluation',()=>{
 it('defaults to required AI even without the environment setting',async()=>{
  vi.stubEnv('VP_REQUIRE_AI_EVALUATION',undefined);setSetting('ai',{});const n=count(),r=await submit();expect(r.status).toBe(503);expect(r.body.aiStage).toBe('configuration');expect(r.body.score).toBeUndefined();expect(count()).toBe(n);
 });
 it('does not call teaching or store a grade after invalid scoring',async()=>{
  provider({badScore:true});const n=count(),r=await submit();expect(r.status).toBe(503);expect(r.body.aiStage).toBe('checklist');expect(fetch).toHaveBeenCalledTimes(1);expect(count()).toBe(n);
 });
 it('does not store a final grade if the lesson is invalid',async()=>{
  provider({badLesson:true});const n=count(),r=await submit();expect(r.status).toBe(503);expect(r.body.aiStage).toBe('lesson');expect(fetch).toHaveBeenCalledTimes(2);expect(count()).toBe(n);
 });
 it('persists only when both model stages return valid responses',async()=>{
  provider();const n=count(),r=await submit();expect(r.status).toBe(200);expect(count()).toBe(n+1);expect(r.body.source).toBe('llm');expect(r.body.feedbackSource).toBe('llm');expect(r.body.score).toBe(0);expect(r.body.microlearning).toBe(lesson.microlearning);
 });
 it('does not consume an attempt on quota failure and allows a subsequent successful retry',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:429,text:async()=> 'sensitive provider detail'})));
  const n=count(),failed=await submit();expect(failed.status).toBe(503);expect(count()).toBe(n);expect(JSON.stringify(failed.body)).not.toContain('sensitive');
  provider();expect((await submit()).status).toBe(200);expect(count()).toBe(n+1);
 });
 it('retains an explicit offline diagnostic mode, not the production default',async()=>{
  vi.stubEnv('VP_REQUIRE_AI_EVALUATION','0');setSetting('ai',{});const n=count(),r=await submit();expect(r.status).toBe(200);expect(r.body.source).not.toBe('llm');expect(count()).toBe(n+1);
 });
});
