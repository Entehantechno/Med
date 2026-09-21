import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
describe('release AI credentials and connection state',()=>{
 for(const name of ['../../.env.ready','../src/seed.js'])it(`${name} never ships a provider key literal`,()=>{
  const content=fs.readFileSync(new URL(name,import.meta.url),'utf8');
  // Report only a boolean, never echo credential-bearing file content.
  expect(/sk-[A-Za-z0-9_-]{30,}/.test(content)).toBe(false);
 });
 it('new seed settings do not claim an unverified connection',()=>{
  const src=fs.readFileSync(new URL('../src/seed.js',import.meta.url),'utf8');
  const blocks=src.match(/insSetting\.run\("ai(?:_vpatient)?",[\s\S]*?\}\)\);/g);
  expect(blocks).toHaveLength(2);
  expect(blocks.every(s=>s.includes('connected: false'))).toBe(true);
 });
});
