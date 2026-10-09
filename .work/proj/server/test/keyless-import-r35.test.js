import {beforeAll,it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import {db,initDb} from '../src/db.js';
import {commitOfficialImport} from '../src/routes/admin.js';
let sequence=990100;
beforeAll(async()=>{execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();},60000);
function imported(patch){const tag='QB-'+(++sequence);const question={tags:[tag],question_fa:'سؤال آزمایشی '+tag,options_fa:['الف','ب','ج','د'],subject_fa:'آزمون',...patch};expect(commitOfficialImport({program:'preint',questions:[question]}).inserted).toBe(1);return db.prepare('SELECT * FROM flashcards WHERE source_key=?').get('medschool:master-bank:'+tag);}
for(const [label,patch] of [
 ['explicit keyless with numeric key',{keyless:true,correct_index:2}],
 ['null key with fallback correct',{correct_index:null,correct:1}],
 ['low confidence with numeric key',{key_source:'low-confidence',correct_index:0}],
 ['multi-answer with numeric key',{key_source:'multi-answer',correct_index:1}],
])it(label+' imports without a marked correct answer',()=>{const row=imported(patch),d=JSON.parse(row.data_json);expect(d.source_meta.keyless).toBe(true);expect(d.source_meta.key_available).toBe(false);expect(d.source_meta.route).toBe('bank_only');expect(d.options.every(o=>!o.correct)).toBe(true);});
it('keeps a valid official key, including index zero',()=>{for(const n of [0,3]){const d=JSON.parse(imported({correct_index:n,key_source:'official'}).data_json);expect(d.options.map(o=>o.correct)).toEqual([0,1,2,3].map(i=>i===n));expect(d.source_meta.keyless).not.toBe(true);}});
it('does not rewrite an existing source question during a repeat import',()=>{const row=imported({correct_index:1,key_source:'official'});const tag=row.source_key.split(':').at(-1);const r=commitOfficialImport({program:'preint',questions:[{tags:[tag],question_fa:'new wording',options_fa:['a','b','c','d'],keyless:true,correct_index:null}]});expect(r.inserted).toBe(0);const after=db.prepare('SELECT * FROM flashcards WHERE id=?').get(row.id);expect(after.data_json).toBe(row.data_json);expect(after.public_code).toBe(row.public_code);});
