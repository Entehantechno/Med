import {describe,it,expect} from 'vitest';
import {mockPatientReply} from '../src/lib/ai-engine.js';
const c={title_en:'Pulmonary embolism',chief_fa:'تنگی نفس ناگهانی از یک ساعت پیش',chief_en:'Sudden shortness of breath for one hour',history_fa:'تنگی نفس ناگهانی در حال نشستن، بدون درد قفسه سینه واضح، سابقه سفر طولانی هفته گذشته.',history_en:'Sudden dyspnea at rest, no clear chest pain, long-haul travel last week.'};
describe('chart-grounded local patient responses',()=>{
 it('does not volunteer onset in the initial chief complaint',()=>{
  expect(mockPatientReply(c,'What is the problem?','en')).not.toContain('one hour');
  expect(mockPatientReply(c,'مشکل شما چیست؟','fa')).not.toContain('یک ساعت');
 });
 it('does not invent a two-hour exertional onset for a dyspnea case',()=>{
  const out=mockPatientReply(c,'When did it start?','en');
  expect(out).not.toMatch(/2 hours|boxes/);expect(out).toContain('one hour');
 });
 it('keeps Persian responses Persian when no chest/abdominal template applies',()=>{
  expect(mockPatientReply(c,'از کی شروع شده؟','fa')).toContain('یک ساعت');
 });
 it('recognizes radiation before the substring where in anywhere',()=>{
  const out=mockPatientReply({...c,history_en:'Pain radiates to the right shoulder.'},'Does the pain radiate anywhere?','en');
  expect(out).toContain('right shoulder');expect(out).not.toContain('breastbone');
 });
 it('never invents radiation for an unrecorded symptom',()=>{
  expect(mockPatientReply(c,'Does the pain radiate?','en')).not.toMatch(/left arm|jaw/);
 });
 for(const q of ['Where exactly?','What does it feel like?','Do you have nausea?'])it(`does not invent symptoms for an empty chart: ${q}`,()=>{
  expect(mockPatientReply({},q,'en')).toMatch(/not recorded/i);
 });
 it('does not fabricate social negatives',()=>expect(mockPatientReply({},'Do you smoke?','en')).toMatch(/not recorded/i));
 it('does not infer chief complaint severity from the diagnosis/title',()=>{
  expect(mockPatientReply({title_en:'Chest pain',chief_en:'Mild discomfort'},'What is the problem?','en')).toBe('Mild discomfort');
 });
 it('does not mistake this for a greeting',()=>{
  expect(mockPatientReply({},'When did this start?','en')).toMatch(/not recorded/i);
 });
 it('does not answer a drug-use question with the medication list',()=>{
  expect(mockPatientReply({social_en:'No recreational drugs.',meds_en:'Metformin'},'Any drug use?','en')).toContain('No recreational drugs');
 });
});
