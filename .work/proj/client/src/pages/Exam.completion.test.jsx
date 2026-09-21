import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
import {describe,it,expect,beforeEach,afterEach,vi} from 'vitest';
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}));
vi.mock('../api.js',()=>({api,getToken:()=>''}));
vi.mock('../context.jsx',()=>({useApp:()=>({lang:'en',t:k=>k,user:{id:100,role:'student'}})}));
vi.mock('../components/UI.jsx',()=>({TopBar:()=>null,Spinner:()=>null}));
vi.mock('../utils/antiCheat.js',()=>({useAntiCheat:()=>({leaves:0})}));
vi.mock('../lib/sw-update.js',()=>({markBusy:()=>{}}));
vi.mock('../components/OrderSearch.jsx',()=>({default:({onAdd})=><button onClick={()=>onAdd('CBC')}>Order CBC</button>}));
vi.mock('../components/ClinicalLesson.jsx',()=>({default:()=>null,EvaluationProvenance:()=>null}));
import Exam from './Exam.jsx';
let resolveReply,rejectReply;
const evaluations=()=>api.post.mock.calls.filter(c=>c[0]==='/exam/evaluate');
beforeEach(()=>{
 vi.clearAllMocks();Element.prototype.scrollIntoView=vi.fn();
 api.get.mockImplementation(async path=>path.startsWith('/cases/')?{id:Number(path.split('/').at(-1)),chief_en:path}:path==='/settings/exam'?{duration:15}:path==='/order-catalog'?{labs:['CBC']}:{});
 api.post.mockImplementation(async path=>{
  if(path==='/exam/session-start')return {sessionId:100,loggingEnabled:false};
  if(path==='/exam/patient-reply'||path==='/exam/order')return new Promise((resolve,reject)=>{resolveReply=resolve;rejectReply=reject;});
  if(path==='/exam/evaluate')return {attemptId:1,score:0,showAi:false,showMicro:false};
  return {};
 });
});
afterEach(cleanup);
async function open(){const view=render(<Exam caseId={1} classId={1} go={()=>{}} home={()=>{}}/>);await screen.findByPlaceholderText('typeMessage');return view;}
async function finishPending(){fireEvent.click(screen.getByRole('button',{name:/finishExam/}));await act(async()=>{});expect(evaluations()).toHaveLength(0);}
describe('completion waits for encounter interactions',()=>{
 it('includes the final patient reply instead of evaluating an incomplete transcript',async()=>{
  await open();fireEvent.change(screen.getByPlaceholderText('typeMessage'),{target:{value:'When did it start?'}});fireEvent.click(screen.getByRole('button',{name:'send',exact:true}));
  await waitFor(()=>expect(resolveReply).toBeTypeOf('function'));await finishPending();
  await act(async()=>resolveReply({text:'Two hours ago',source:'llm'}));
  await waitFor(()=>expect(evaluations()).toHaveLength(1));
  expect(evaluations()[0][1].session.messages.map(m=>m.text)).toEqual(['When did it start?','Two hours ago']);
 });
 it('includes the last completed order and its result even after the order tab unmounts',async()=>{
  await open();fireEvent.click(screen.getByRole('button',{name:'tabTests',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Order CBC'}));
  await waitFor(()=>expect(api.post.mock.calls.some(c=>c[0]==='/exam/order')).toBe(true));await finishPending();
  await act(async()=>resolveReply({text:'Recorded CBC result',found:true}));
  await waitFor(()=>expect(evaluations()).toHaveLength(1));
  expect(evaluations()[0][1].session.tests).toEqual(['CBC']);
  expect(evaluations()[0][1].session.messages.at(-1).text).toBe('Recorded CBC result');
 });
 it('does not count a failed order as completed or hang the finishing screen',async()=>{
  await open();fireEvent.click(screen.getByRole('button',{name:'tabTests',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Order CBC'}));
  await waitFor(()=>expect(api.post.mock.calls.some(c=>c[0]==='/exam/order')).toBe(true));await finishPending();
  await act(async()=>rejectReply(new Error('network')));
  await waitFor(()=>expect(evaluations()).toHaveLength(1));expect(evaluations()[0][1].session.tests).toEqual([]);
 });
 it('does not import a late patient reply from the previous case',async()=>{
  const view=await open();
  fireEvent.change(screen.getByPlaceholderText('typeMessage'),{target:{value:'Old case question'}});
  fireEvent.click(screen.getByRole('button',{name:'send',exact:true}));
  await waitFor(()=>expect(api.post.mock.calls.some(c=>c[0]==='/exam/patient-reply')).toBe(true));
  const oldReply=resolveReply;
  view.rerender(<Exam caseId={2} classId={1} go={()=>{}} home={()=>{}}/>);
  await waitFor(()=>expect(api.get).toHaveBeenCalledWith('/cases/2',expect.anything()));
  await screen.findByPlaceholderText('typeMessage');
  await act(async()=>oldReply({text:'PRIVATE OLD CASE RESPONSE',source:'llm'}));
  expect(screen.queryByText('PRIVATE OLD CASE RESPONSE')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:/finishExam/}));
  await waitFor(()=>expect(evaluations()).toHaveLength(1));
  expect(evaluations()[0][1].caseId).toBe(2);
  expect(evaluations()[0][1].session.messages).toEqual([]);
 });

 it('reuses the same start request ID after a lost response',async()=>{
  const normal=api.post.getMockImplementation();let lost=true;
  api.post.mockImplementation(async(...args)=>{
   if(args[0]==='/exam/session-start'&&lost){lost=false;throw new Error('network');}
   return normal(...args);
  });
  await open();
  const starts=api.post.mock.calls.filter(c=>c[0]==='/exam/session-start');
  expect(starts).toHaveLength(2);expect(starts[0][1].requestId).toBeTypeOf('string');
  expect(starts[1][1].requestId).toBe(starts[0][1].requestId);
 });

 it('shows revised consent before starting a session',async()=>{
  const normal=api.get.getMockImplementation();
  api.get.mockImplementation(async(...args)=>args[0].startsWith('/research/consent/status')?{required:true,granted:false,reason:'consent_stale',studyId:1,consentTextEn:'Revised study terms'}:normal(...args));
  render(<Exam caseId={1} classId={1} go={()=>{}} home={()=>{}}/>);
  await screen.findByText('Revised study terms');
  expect(screen.getByText(/The consent wording or protocol has changed/)).toBeTruthy();
  expect(api.post.mock.calls.some(c=>c[0]==='/exam/session-start')).toBe(false);
  expect(screen.getByRole('button',{name:'I agree and take part'})).toBeTruthy();
 });

 it('starts normally in admin-managed mode without showing an online consent screen',async()=>{
  const normal=api.get.getMockImplementation();
  api.get.mockImplementation(async(...args)=>args[0].startsWith('/research/consent/status')?{required:false,granted:true,adminManaged:true,status:'none'}:normal(...args));
  await open();expect(api.post.mock.calls.some(c=>c[0]==='/exam/session-start')).toBe(true);
  expect(screen.queryByRole('button',{name:'I agree and take part'})).toBeNull();
 });
 it('does not offer a self-consent bypass for an explicit admin hold',async()=>{
  const normal=api.get.getMockImplementation();
  api.get.mockImplementation(async(...args)=>args[0].startsWith('/research/consent/status')?{required:true,granted:false,reason:'research_paused',studyId:1,consentTextEn:'Terms'}:normal(...args));
  render(<Exam caseId={1} classId={1} go={()=>{}} home={()=>{}}/>);
  await screen.findByText('Participation is paused by an admin. Only an admin can lift this hold.');
  expect(screen.getByRole('button',{name:'I agree and take part'}).disabled).toBe(true);
  expect(api.post.mock.calls.some(c=>c[0]==='/exam/session-start')).toBe(false);
 });

 it('retries a timed-out evaluate and then shows the stored result',async()=>{
  const normal=api.post.getMockImplementation();let n=0;
  api.post.mockImplementation(async(...args)=>{
   if(args[0]==='/exam/evaluate'){
    n+=1;
    if(n===1)throw Object.assign(new Error('timeout'),{status:0,data:{error:'timeout',stage:'evaluate'}});
    return {attemptId:11,score:40,source:'llm',feedbackSource:'llm',showAi:true,showMicro:false};
   }
   return normal(...args);
  });
  await open();fireEvent.click(screen.getByRole('button',{name:/finishExam/}));
  await waitFor(()=>expect(evaluations()).toHaveLength(2),{timeout:5000});
  expect(screen.getByRole('heading',{name:/report/})).toBeTruthy();
 });

 it('retries a 409 evaluation_in_progress and then shows the stored result',async()=>{
  const normal=api.post.getMockImplementation();let n=0;
  api.post.mockImplementation(async(...args)=>{
   if(args[0]==='/exam/evaluate'){
    n+=1;
    if(n===1)throw Object.assign(new Error('busy'),{status:409,data:{error:'evaluation_in_progress',retryable:true,stage:'evaluate'}});
    return {attemptId:9,score:40,source:'llm',feedbackSource:'llm',showAi:true,showMicro:true,microlearning:'### Practice\nAsk the onset.'};
   }
   return normal(...args);
  });
  await open();fireEvent.click(screen.getByRole('button',{name:/finishExam/}));
  await waitFor(()=>expect(evaluations()).toHaveLength(2),{timeout:5000});
  expect(screen.getByRole('heading',{name:/report/})).toBeTruthy();
 });

 it('shows the failed AI stage and actionable quota message without losing the encounter',async()=>{
  const normal=api.post.getMockImplementation();
  api.post.mockImplementation(async(...args)=>{if(args[0]==='/exam/evaluate')throw Object.assign(new Error('unavailable'),{status:503,data:{error:'ai_evaluation_unavailable',aiStage:'lesson',failureCode:'rate_limit'}});return normal(...args);});
  await open();fireEvent.click(screen.getByRole('button',{name:/finishExam/}));
  await screen.findByText(/Lesson generation.*provider rate\/quota limit/);
  expect(screen.getByPlaceholderText('typeMessage')).toBeTruthy();
  expect(screen.getByRole('button',{name:/finishExam/}).disabled).toBe(false);
 });

});
