import {it,expect} from 'vitest';
import {biField} from './bifield.js';
import {validateQuestion} from './authoring-validation.js';
import {AZARBARZ_CARDS} from '../../../server/src/data/azarbarz-histology.js';
for(const lang of ['fa','en']){
 it(`uses authored FA from empty/absent ${lang} translations`,()=>{expect(biField({q_fa:'سلام',q_en:'  '},'q',lang)).toBe('سلام')});
 it(`uses authored EN from empty/absent ${lang} translations`,()=>{expect(biField({q_fa:'',q_en:'Hello'},'q',lang)).toBe('Hello')});
 it(`uses the main question instead of mandatory stage instructions in ${lang}`,()=>expect(validateQuestion({type:'stepwise',questionText_fa:'صورت سؤال',steps:[{answerType:'mcq',options_fa:['الف','ب'],correct_index:1}]},lang)).toBeNull());
}
it('keeps real translations and false/zero',()=>{expect(biField({q_fa:'سلام',q_en:'Hello'},'q','en')).toBe('Hello');expect(biField({q_fa:0},'q','en')).toBe(0);expect(biField({q_en:false},'q','fa')).toBe(false)});
it('title alone does not replace a missing question in stepwise content',()=>expect(validateQuestion({type:'stepwise',title_fa:'عنوان',steps:[{answerType:'truefalse',answer:false}]},'fa')).toContain('صورت مرحله'));
it.each(AZARBARZ_CARDS.map((c,i)=>[i+1,c]))('validates supplied question %s without numeric prefixes',(_,c)=>{expect(validateQuestion(c,'fa')).toBeNull();expect(c.questionText_fa).not.toMatch(/^\d+[.)]/)});
it('rejects an autocomplete list that excludes every accepted answer',()=>expect(validateQuestion({type:'fill',title_fa:'پرسش',answerMode:'search',blank_fa:'ب',options_fa:['الف']},'fa')).toContain('پاسخ صحیح'));
it('falls back from an array of blank translated strings',()=>expect(biField({hints_fa:[''],hints_en:['Help']},'hints','fa')).toEqual(['Help']));
