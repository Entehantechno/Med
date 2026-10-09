import {acceptedAnswers} from './authoring-values.js';
export const stepOptions=v=>Array.isArray(v)?v.map(x=>String(x??'')):(String(v||'').trim()?String(v).split('\n').map(x=>x.trim()):[]);
export function stepBoolean(s){
 if(typeof s.answer==='boolean')return s.answer;
 for(const v of [s.answer_en,s.answer_fa,...acceptedAnswers(s.accept_en),...acceptedAnswers(s.accept_fa)]){
  const t=String(v||'').trim().toLowerCase();
  if(['true','درست','صحیح'].includes(t))return true;
  if(['false','نادرست','غلط'].includes(t))return false;
 }
 return undefined;
}
export function stepCorrectIndex(s){
 if(Number.isInteger(s.correct_index)&&s.correct_index>=0)return s.correct_index;
 const fa=stepOptions(s.options_fa),en=stepOptions(s.options_en);
 const answers=[s.answer_fa,s.answer_en,...acceptedAnswers(s.accept_fa),...acceptedAnswers(s.accept_en)].filter(Boolean);
 return Array.from({length:Math.max(fa.length,en.length)},(_,i)=>i).find(i=>answers.includes(fa[i])||answers.includes(en[i]))??-1;
}
export function normalizeStep(s){
 const type=s.answerType||s.type||'autocomplete';
 const result={...s,answerType:type,options_fa:stepOptions(s.options_fa),options_en:stepOptions(s.options_en),accept_fa:acceptedAnswers(s.accept_fa),accept_en:acceptedAnswers(s.accept_en)};
 if(type==='truefalse'){
  const answer=stepBoolean(s);
  if(answer!==undefined)Object.assign(result,{answer,answer_fa:String(answer),answer_en:String(answer),accept_fa:[String(answer)],accept_en:[String(answer)]});
 }else if(type==='mcq'||(type==='autocomplete'&&Number.isInteger(s.correct_index)&&s.correct_index>=0)){
  const i=stepCorrectIndex(s),fa=result.options_fa[i]||result.options_en[i]||'',en=result.options_en[i]||result.options_fa[i]||'';
  Object.assign(result,{correct_index:i,answer_fa:fa,answer_en:en,accept_fa:fa?[fa]:[],accept_en:en?[en]:[]});
 }
 return result;
}
const gradingText=v=>String(v??'').trim().toLowerCase().replace(/\s+/g,' ');
export function validateSteps(steps,lang='fa'){
 const fa=lang==='fa';
 if(!Array.isArray(steps)||!steps.length)return fa?'حداقل یک مرحله لازم است.':'At least one step is required.';
 for(let i=0;i<steps.length;i++){
  const s=normalizeStep(steps[i]),prefix=fa?`مرحله ${i+1}: `:`Step ${i+1}: `;
  if(![s.prompt_fa,s.prompt_en].some(v=>String(v||'').trim()))return prefix+(fa?'صورت مرحله را وارد کنید.':'Enter a prompt.');
  if(s.answerType==='truefalse'&&stepBoolean(s)===undefined)return prefix+(fa?'درست یا غلط را تعیین کنید.':'Choose True or False.');
  if(s.answerType==='mcq'){
   const count=Math.max(s.options_fa.length,s.options_en.length);
   const filled=Array.from({length:count},(_,j)=>String(s.options_fa[j]||s.options_en[j]||'').trim());
   if(count<2||filled.some(v=>!v)||s.correct_index<0||s.correct_index>=count)return prefix+(fa?'حداقل دو گزینه و پاسخ صحیح را مشخص کنید.':'Enter at least two complete options and mark the correct answer.');
   // The grader accepts either translation. Labels from DIFFERENT options must
   // not collapse to the same answer, even across languages or case/spacing.
   const labels=new Map();
   for(let j=0;j<count;j++)for(const label of [s.options_fa[j],s.options_en[j]]){
    const key=gradingText(label);if(!key)continue;
    if(labels.has(key)&&labels.get(key)!==j)return prefix+(fa?'گزینه‌های تکراری را در هر دو زبان اصلاح کنید.':'Remove duplicate options in either language.');
    labels.set(key,j);
   }
  }
  if(s.answerType==='autocomplete'&&[...s.options_fa,...s.options_en].some(v=>gradingText(v))){
   const keys=[s.answer_fa,s.answer_en,...s.accept_fa,...s.accept_en].map(gradingText).filter(Boolean);
   const count=Math.max(s.options_fa.length,s.options_en.length);
   for(const language of ['fa','en']){
    const other=language==='fa'?'en':'fa';
    const reachable=Array.from({length:count},(_,j)=>gradingText(s['options_'+language][j]||s['options_'+other][j]));
    if(!reachable.some(x=>x&&keys.includes(x)))return prefix+(fa?'پاسخ صحیح باید از پیشنهادهای قابل انتخاب در هر دو زبان باشد.':'Choose an accepted answer available in the suggestions for both languages.');
   }
  }
  if(![s.answer_fa,s.answer_en,...s.accept_fa,...s.accept_en].some(v=>String(v||'').trim()))return prefix+(fa?'پاسخ صحیح را وارد کنید.':'Enter an accepted answer.');
 }
 return null;
}
