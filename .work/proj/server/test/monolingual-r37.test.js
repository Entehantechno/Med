import {it,expect,afterEach,vi} from 'vitest';
import {flashcardLanguageFallback as fallback} from '../src/lib/flashcard-language.js';
import {studentSafeFlashcard,gradeFlashcard} from '../src/lib/flashcard-grade.js';
import {serializeCard} from '../src/lib/cardserialize.js';
import {patientReply} from '../src/lib/ai-engine.js';
import {AZARBARZ_CARDS} from '../src/data/azarbarz-histology.js';
afterEach(()=>vi.unstubAllGlobals());
it('fills only absent translations recursively, including partial arrays, and never mutates authored data',()=>{
 const d={q_fa:'متن',q_en:' ',steps:[{options_fa:['الف','ب'],options_en:['Alpha',''],hint_fa:'کمک'}],pairs:[['چپ','','راست','']],options:[{fa:'گزینه',en:'',correct:true}],zero_fa:0,false_en:false};const before=JSON.stringify(d),o=fallback(d);
 expect(o.q_en).toBe('متن');expect(o.steps[0].options_en).toEqual(['Alpha','ب']);expect(o.pairs[0]).toEqual(['چپ','چپ','راست','راست']);expect(o.zero_en).toBe(0);expect(o.false_fa).toBe(false);expect(JSON.stringify(d)).toBe(before);
});
for(const type of ['mcq','fill','truefalse','match','order','drawing','stepwise','kf','compare','hotspot','puzzle'])it(`falls back for ${type} without leaking step answer keys`,()=>{
 const d={id:123,type,questionText_en:'English only',questionText_fa:'',drawing:{prompt_en:'Draw'},kf:{items:[{prompt_fa:'پرسش',answer_fa:'کلید'}]},steps:[{prompt_fa:'مرحله',answer:'SECRET',correct_index:1,correct:true,accept_fa:['SECRET'],answer_fa:'SECRET',explanation_fa:'SECRET'}]};const out=studentSafeFlashcard(d);
 expect(out.questionText_fa).toBe('English only');expect(out.drawing.prompt_fa).toBe('Draw');expect(out.steps[0].prompt_en).toBe('مرحله');expect(JSON.stringify(out.steps)).not.toContain('SECRET');expect(out.steps[0]).not.toHaveProperty('correct_index');expect(out.steps[0]).not.toHaveProperty('correct');expect(out.kf.items[0]).not.toHaveProperty('answer_en');
});
it('competitive MCQ serialization fills a blank translated stem and options',()=>{
 const d=AZARBARZ_CARDS[1],c={id:44,data_json:JSON.stringify(d)};const o=serializeCard(c,'en');expect(o.q).toBe(d.questionText_fa);expect(JSON.stringify(o)).toContain('میتوکندری');expect(c.data_json).toBe(JSON.stringify(d));
});
it.each(AZARBARZ_CARDS.filter(c=>c.type==='fill'))('grades Persian-only search answers in an English interface',c=>{expect(gradeFlashcard(c,{lang:'en',text:c.blank_fa}).ok).toBe(true)});
for(const lang of ['fa','en'])it(`requests ${lang} response language independently of chart language, with explicit-user override`,async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:lang==='fa'?'سلام دکتر.':'Hello doctor.'}}]})})));
 await patientReply({caseData:{history_fa:'درد از دیروز شروع شد.',history_en:''},userText:'Hello. Please answer in Persian.',history:[],lang,prompts:{},aiCfg:{provider:'OpenRouter',model:'test/model:free',apiKey:'synthetic-test-only'}},{throwOnError:true});
 const messages=JSON.parse(fetch.mock.calls[0][1].body).messages;
 expect(messages[0].content).toContain(lang==='fa'?'Persian':'English');expect(messages[0].content).toContain('unless the user explicitly requests another response language');expect(messages[0].content).toContain('درد از دیروز');expect(JSON.stringify(messages)).toContain('Please answer in Persian');
});
it('renders object-form matching pairs in both languages without touching the source',()=>{const d={id:123,type:'match',pairs:[{l:'چپ',le:'',r:'راست',re:''}]};const out=studentSafeFlashcard(d);expect(out.matchLeft[0].en).toBe('چپ');expect(out.matchRight[0].en).toBe('راست');expect(d.pairs[0].le).toBe('')});
for(const lang of ['fa','en'])it(`grades the same authored order with blank translations in ${lang}`,()=>{
 const d={id:123,type:'order',items_fa:['اول','دوم'],items_en:[]};const safe=studentSafeFlashcard(d);const order=d.items_fa.map(text=>safe['orderBank_'+lang].find(x=>x.text===text).id);expect(gradeFlashcard(d,{lang,order}).ok).toBe(true);expect(gradeFlashcard(d,{lang,order:[...order].reverse()}).ok).toBe(false);expect(d.items_en).toEqual([]);
});
