import {afterEach,describe,it,expect,vi} from 'vitest';
import {patientReply,mockPatientReply} from '../src/lib/ai-engine.js';
const caseData={chief_fa:'درد شکم',chief_en:'Abdominal pain',history_fa:'درد از یک ساعت پیش شروع شده.',history_en:'Pain started one hour ago.',meds_fa:'متفورمین',meds_en:'Metformin'};
const aiCfg={provider:'OpenRouter',model:'test/model:free',apiKey:'synthetic-test-only'};
const call=(lang='fa',opts={})=>patientReply({caseData,userText:lang==='fa'?'سلام وقت شما بخیر':'Hello, good morning',history:[],lang,prompts:{},aiCfg},opts);
function response(text){vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:text}}]})})));}
afterEach(()=>vi.unstubAllGlobals());
describe('patient role integrity',()=>{
 for(const text of ['سلام چه کاری از دست من برمی‌آید؟','سلام، چه کمکی می‌توانم به شما بکنم؟','چطور می‌توانم کمکتان کنم؟','من یک دستیار هوش مصنوعی هستم.','Hello! How can I help you today?','How may I assist you?','As an AI assistant, I can help.'])it(`rejects assistant-role response: ${text}`,async()=>{
  response(text);const out=await call();
  expect(out.source).toBe('mock');expect(out.text).not.toBe(text);expect(out.error).toBe('AI patient role violation');
 });
 it('keeps connection-test failures visible rather than silently replacing the reply',async()=>{
  response('How can I help you?');await expect(call('en',{throwOnError:true})).rejects.toThrow('AI patient role violation');
 });
 it('accepts normal first-person patient speech',async()=>{
  response('سلام دکتر، ممنون.');const out=await call();expect(out.source).toBe('llm');expect(out.text).toBe('سلام دکتر، ممنون.');
 });
 it('does not reject a patient asking for help',async()=>{
  response('Doctor, can you help me?');expect((await call('en')).source).toBe('llm');
 });
 it('supplies a built-in patient role even when admin prompts are empty',async()=>{
  response('Hello doctor.');await call('en');const sys=JSON.parse(fetch.mock.calls[0][1].body).messages[0].content;
  expect(sys).toContain('You are the patient, not an assistant');
  expect(sys).not.toContain('My stomach hurts, doctor');
 });
 for(const [q,lang,expected] of [['سلام، از کی شروع شده؟','fa','یک ساعت'],['Hello, when did it start?','en','one hour'],['سلام، دارویی مصرف می‌کنید؟','fa','متفورمین'],['Good morning, what is the problem?','en','Abdominal pain']])it(`does not discard the actual question after a greeting: ${q}`,()=>{
  expect(mockPatientReply(caseData,q,lang)).toContain(expected);
 });
 it('responds to a standalone Persian greeting as the patient',()=>{
  expect(mockPatientReply(caseData,'سلام وقت شما بخیر','fa')).toBe('سلام دکتر.');
 });
 it('responds to standalone good morning in English',()=>{
  expect(mockPatientReply(caseData,'Good morning','en')).toBe('Hello doctor.');
 });
});
