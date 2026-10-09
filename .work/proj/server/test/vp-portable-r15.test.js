import {beforeAll,it,expect} from 'vitest';
import crypto from 'node:crypto';
import {readPortableZip,createPortableZip} from '../src/lib/portable-zip.js';
import {execFileSync} from 'node:child_process';
import {initDb,db,reloadDb} from '../src/db.js';
import {createUniversityBundle,importUniversityBundle} from '../src/routes/portable.js';
let bundle,original,restored;
beforeAll(async()=>{
 execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();
 const id=Number(db.prepare(`INSERT INTO classes(name_en,code,university_id,exam_mode,timer_enabled,timer_minutes,flash_no_penalty,live_board_speed) VALUES ('R15 settings','r15-source',1,'wholeExam',1,47,0,1)`).run().lastInsertRowid);
 original=db.prepare('SELECT * FROM classes WHERE id=?').get(id);
 bundle=createUniversityBundle(db.prepare('SELECT * FROM universities WHERE id=1').get(),{full:true}).buffer;
 const out=await importUniversityBundle(bundle);restored=db.prepare("SELECT * FROM classes WHERE university_id=? AND name_en='R15 settings'").get(out.university_id);
},60000);
for(const field of ['exam_mode','timer_enabled','timer_minutes','flash_no_penalty','live_board_speed'])it(`preserves the explicitly configured ${field}`,()=>{
 expect(restored[field]).toBe(original[field]);
});

function editClass(edit){
 const entries=readPortableZip(bundle),manifest=JSON.parse(entries.find(e=>e.path==='manifest.json').data),entry=entries.find(e=>e.path.endsWith('/classes.json'));
 const rows=JSON.parse(entry.data);edit(rows.find(c=>c.id===original.id));entry.data=Buffer.from(JSON.stringify(rows));
 const digest=b=>crypto.createHash('sha256').update(b).digest('hex');const record=manifest.files.find(f=>f.path===entry.path);record.sha256=digest(entry.data);record.size=entry.data.length;
 const m=entries.find(e=>e.path==='manifest.json');m.data=Buffer.from(JSON.stringify(manifest));entries.find(e=>e.path==='manifest.sha256').data=Buffer.from(digest(m.data)+'  manifest.json\n');return createPortableZip(entries);
}
for(const flag of [0,1,null])it(`retains both per-class override values ${flag}`,async()=>{
 const out=await importUniversityBundle(editClass(c=>{c.flash_no_penalty=flag;c.live_board_speed=flag;}));
 const row=db.prepare("SELECT * FROM classes WHERE university_id=? AND name_en='R15 settings'").get(out.university_id);expect(row.flash_no_penalty).toBe(flag);expect(row.live_board_speed).toBe(flag);
});
it('uses schema-compatible defaults only when legacy bundle fields are absent',async()=>{
 const out=await importUniversityBundle(editClass(c=>{for(const key of ['exam_mode','timer_enabled','timer_minutes','flash_no_penalty','live_board_speed'])delete c[key];}));
 expect(db.prepare("SELECT exam_mode,timer_enabled,timer_minutes,flash_no_penalty,live_board_speed FROM classes WHERE university_id=? AND name_en='R15 settings'").get(out.university_id)).toEqual({exam_mode:'perQuestion',timer_enabled:0,timer_minutes:30,flash_no_penalty:null,live_board_speed:null});
});
it('preserves all other class columns except remapped identifiers and collision-safe code',()=>{
 const identity=new Set(['id','code','university_id','public_code']);
 for(const key of Object.keys(original))if(!identity.has(key))expect(restored[key],key).toEqual(original[key]);
 expect(restored.id).not.toBe(original.id);expect(restored.university_id).not.toBe(original.university_id);expect(restored.code).not.toBe(original.code);
});
it('retains restored settings after reload without altering the source class or schema',async()=>{
 await reloadDb();expect(db.prepare('SELECT * FROM classes WHERE id=?').get(original.id)).toEqual(original);expect(db.prepare('SELECT * FROM classes WHERE id=?').get(restored.id)).toEqual(restored);
 const column=db.prepare('PRAGMA table_info(classes)').all().find(c=>c.name==='exam_mode');expect(column.type).toBe('TEXT');expect(column.dflt_value).toBe("'perQuestion'");
});
