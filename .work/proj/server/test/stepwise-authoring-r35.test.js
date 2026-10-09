import {it,expect} from 'vitest';
import {normalizeStep} from '../../client/src/lib/step-authoring.js';
import {gradeFlashcard} from '../src/lib/flashcard-grade.js';
it('grades all four authored step kinds through the existing server contract',()=>{
 const steps=[
 {answerType:'autocomplete',prompt_en:'Find',options_fa:['آلفا','بتا'],options_en:['Alpha','Beta'],correct_index:1},
 {answerType:'mcq',prompt_en:'Choose',options_fa:['الف','ب'],options_en:['A','B'],correct_index:0},
 {answerType:'truefalse',prompt_en:'Proposition',answer:false},
 {answerType:'fill',prompt_en:'The answer is ___',answer_en:'renal',accept_en:['kidney']},
 ].map(normalizeStep);
 const card={id:35,type:'stepwise',steps};
 for(const [lang,answers]of[['en',{0:'Beta',1:'A',2:'false',3:'kidney'}],['fa',{0:'بتا',1:'الف',2:'false',3:'renal'}]]){const result=gradeFlashcard(card,{lang,answers});expect(result.ok).toBe(true);expect(result.pointsFrac).toBe(1);}
 const bad=gradeFlashcard(card,{lang:'en',answers:{0:'Alpha',1:'B',2:'true',3:'other'}});expect(bad.ok).toBe(false);expect(bad.pointsFrac).toBe(0);
});
