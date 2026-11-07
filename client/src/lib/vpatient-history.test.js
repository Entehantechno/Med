import {describe,it,expect} from 'vitest';
import {spokenHistory} from './vpatient-history.js';
describe('VP spoken-history provenance',()=>{
 it('preserves teacher role and examination mode',()=>{
  expect(spokenHistory([{role:'teacher',mode:'exam',text:' Lungs clear. '}])).toEqual([{role:'teacher',mode:'exam',text:'Lungs clear.'}]);
 });
 it('preserves exam mode on legacy patient-labelled exam messages',()=>{
  expect(spokenHistory([{role:'patient',mode:'exam',text:'Exam finding'}])[0].mode).toBe('exam');
 });
 it('excludes orders and malformed content without inventing speech',()=>{
  expect(spokenHistory([null,{}, {role:'lab',text:'Result'}, {role:'patient',text:{}},{role:'student',text:' Hello '}] )).toEqual([{role:'student',text:'Hello'}]);
 });
 it('handles a missing/non-array history',()=>{
  expect(spokenHistory(null)).toEqual([]);expect(spokenHistory({})).toEqual([]);
 });
});
