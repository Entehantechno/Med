import {describe,it,expect} from 'vitest';
import {eligibleModels} from '../../tools/benchmark-vpatient-openrouter.mjs';
const free={id:'example/model:free',pricing:{prompt:'0',completion:'0'},architecture:{input_modalities:['text'],output_modalities:['text'],tokenizer:'Other'}};
describe('live benchmark free-only selection',()=>{
 it('accepts an explicitly zero-priced text model',()=>expect(eligibleModels([free])).toEqual([free]));
 it('never infers free from a missing or invalid price',()=>{
  expect(eligibleModels([{...free,pricing:{}},{...free,pricing:{prompt:'0',completion:'unknown'}},{...free,pricing:{prompt:'0',completion:'.00001'}}])).toEqual([]);
 });
 it('excludes routing, embeddings and nonzero per-request costs',()=>{
  expect(eligibleModels([{...free,id:'openrouter/free'},{...free,architecture:{...free.architecture,tokenizer:'Router'}},{...free,architecture:{...free.architecture,output_modalities:['embeddings']}},{...free,pricing:{...free.pricing,request:'0.1'}}])).toEqual([]);
 });
});
