import {describe,it,expect,vi,afterEach} from 'vitest';
import {evaluationFingerprint,retryScoreGet,retryScorePut,retryScoreDrop} from '../src/lib/vp-evaluation-retry.js';
const value={result:{source:'llm',score:40,results:[{done:false,reason:'AI judgment'}]},scoringRoute:{id:'a'}};
afterEach(()=>vi.useRealTimers());
describe('ephemeral evaluation checkpoint',()=>{
 it('binds user/session/input and clones values rather than sharing mutable state',()=>{
  const fingerprint=evaluationFingerprint({session:{messages:['private']},apiKey:'secret'});
  expect(fingerprint).not.toContain('private');expect(fingerprint).not.toContain('secret');
  retryScorePut(1,2,fingerprint,value);
  expect(retryScoreGet(1,3,fingerprint)).toBeNull();expect(retryScoreGet(2,2,fingerprint)).toBeNull();
  const copy=retryScoreGet(1,2,fingerprint);copy.result.score=99;
  expect(retryScoreGet(1,2,fingerprint).result.score).toBe(40);
  expect(retryScoreGet(1,2,'changed-input')).toBeNull();
  expect(retryScoreGet(1,2,fingerprint)).toBeNull();
 });
 it('expires after two minutes without extending life on read',()=>{
  vi.useFakeTimers();retryScorePut(2,2,'a',value);vi.advanceTimersByTime(119000);
  expect(retryScoreGet(2,2,'a')).toBeTruthy();vi.advanceTimersByTime(1001);expect(retryScoreGet(2,2,'a')).toBeNull();
 });
 it('never caches invalid or non-AI scoring and can discard a successful checkpoint',()=>{
  retryScorePut(3,2,'a',{result:{source:'mock'}});expect(retryScoreGet(3,2,'a')).toBeNull();
  retryScorePut(3,2,'a',{result:{source:'llm',scoreFallback:{error:'failure'}}});expect(retryScoreGet(3,2,'a')).toBeNull();
  retryScorePut(3,2,'a',value);retryScoreDrop(3,2);expect(retryScoreGet(3,2,'a')).toBeNull();
 });
 it('bounds the process-local cache to 64 sessions',()=>{
  for(let i=100;i<166;i++)retryScorePut(i,20,'a',value);
  expect(retryScoreGet(100,20,'a')).toBeNull();expect(retryScoreGet(165,20,'a')).toBeTruthy();
 });
});
