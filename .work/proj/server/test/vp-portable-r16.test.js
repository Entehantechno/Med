import {beforeAll,it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';import crypto from 'node:crypto';
import {initDb,db,reloadDb} from '../src/db.js';
import {createUniversityBundle,importUniversityBundle} from '../src/routes/portable.js';
import {readPortableZip,createPortableZip} from '../src/lib/portable-zip.js';
let bundle,examId,sourceCases,sourceCards,foreign;
beforeAll(async()=>{
 execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();
 const insert=(table,uni,label)=>Number(db.prepare(`INSERT INTO ${table}(data_json,university_id) VALUES (?,?)`).run(JSON.stringify({title_en:label}),uni).lastInsertRowid);
 sourceCases=[insert('cases',1,'R16 case A'),insert('cases',1,'R16 case B')];sourceCards=[insert('flashcards',1,'R16 card A'),insert('flashcards',1,'R16 card B')];
 foreign={case_ids:insert('cases',2,'R16 foreign case'),flashcard_ids:insert('flashcards',2,'R16 foreign card')};
 examId=Number(db.prepare("INSERT INTO exams(title_en,university_id,case_ids,flashcard_ids) VALUES ('R16 exam',1,?,?)").run(JSON.stringify(sourceCases),JSON.stringify(sourceCards)).lastInsertRowid);
 bundle=createUniversityBundle(db.prepare('SELECT * FROM universities WHERE id=1').get(),{full:true}).buffer;
},60000);
function editExam(edit){
 const entries=readPortableZip(bundle),manifest=JSON.parse(entries.find(e=>e.path==='manifest.json').data),entry=entries.find(e=>e.path.endsWith('/exams.json'));
 const rows=JSON.parse(entry.data);edit(rows.find(e=>e.id===examId));entry.data=Buffer.from(JSON.stringify(rows));
 const digest=b=>crypto.createHash('sha256').update(b).digest('hex');const record=manifest.files.find(f=>f.path===entry.path);record.sha256=digest(entry.data);record.size=entry.data.length;
 const m=entries.find(e=>e.path==='manifest.json');m.data=Buffer.from(JSON.stringify(manifest));entries.find(e=>e.path==='manifest.sha256').data=Buffer.from(digest(m.data)+'  manifest.json\n');return createPortableZip(entries);
}
for(const [field,kind] of [['case_ids','case'],['flashcard_ids','flashcard']]){
 it(`rejects an exam ${kind} reference outside its archive before inserts`,async()=>{
  const before=db.prepare('SELECT COUNT(*) n FROM universities').get().n;
  await expect(importUniversityBundle(editExam(e=>{e[field]=JSON.stringify([foreign[field]]);}))).rejects.toThrow(`exam_${kind}_graph_invalid`);
  expect(db.prepare('SELECT COUNT(*) n FROM universities').get().n).toBe(before);
 });
 for(const bad of ['not JSON','{}'])it(`rejects ${field} value ${bad}`,async()=>{
  await expect(importUniversityBundle(editExam(e=>{e[field]=bad;}))).rejects.toThrow(`exam_${field}_invalid`);
 });
}

for(const raw of ['[true]','[0]','[1.5]','[{}]'])it(`rejects invalid ID elements ${raw}`,async()=>{
 await expect(importUniversityBundle(editExam(e=>{e.case_ids=raw;}))).rejects.toThrow('exam_case_ids_invalid');
});
it('preserves selection order and repeated entries while remapping numeric string IDs',async()=>{
 const out=await importUniversityBundle(editExam(e=>{e.case_ids=JSON.stringify([String(sourceCases[1]),sourceCases[0],sourceCases[1]]);e.flashcard_ids=JSON.stringify([String(sourceCards[1]),sourceCards[0]]);}));
 const row=db.prepare("SELECT * FROM exams WHERE university_id=? AND title_en='R16 exam'").get(out.university_id);
 const titles=(field,table)=>JSON.parse(row[field]).map(id=>{const r=db.prepare(`SELECT data_json,university_id FROM ${table} WHERE id=?`).get(id);expect(r.university_id).toBe(out.university_id);return JSON.parse(r.data_json).title_en;});
 expect(titles('case_ids','cases')).toEqual(['R16 case B','R16 case A','R16 case B']);expect(titles('flashcard_ids','flashcards')).toEqual(['R16 card B','R16 card A']);
 expect(JSON.parse(row.case_ids).every(id=>!sourceCases.includes(id))).toBe(true);
 await reloadDb();expect(db.prepare('SELECT case_ids,flashcard_ids FROM exams WHERE id=?').get(row.id)).toEqual({case_ids:row.case_ids,flashcard_ids:row.flashcard_ids});
});
for(const empty of [null,'','[]'])it(`retains legacy empty selection ${JSON.stringify(empty)}`,async()=>{
 const out=await importUniversityBundle(editExam(e=>{e.case_ids=empty;e.flashcard_ids=empty;}));
 expect(db.prepare("SELECT case_ids,flashcard_ids FROM exams WHERE university_id=? AND title_en='R16 exam'").get(out.university_id)).toEqual({case_ids:'[]',flashcard_ids:'[]'});
});
