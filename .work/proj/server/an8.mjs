process.env.DATA_DIR="/home/user/Med/.work/data";
const { db, initDb } = await import("./src/db.js"); await initDb();
const { SUBJECT_SYLLABUS } = await import("./src/data/path-syllabus.js");
const { classifyCard } = await import("./src/lib/pathcurator.js");
const rows = db.prepare("SELECT id,data_json FROM flashcards").all();
const cards=[]; for (const r of rows){ let d; try{d=JSON.parse(r.data_json)}catch{continue}; if(d.track==="learn"&&d.source_meta?.kind==="past_exam_import") cards.push({id:r.id,d}); }
// garbled OCR: many single-letter tokens "ی" / "سوا ه" pattern
const garbled=c=>{const t=c.d.q_fa||""; const toks=t.split(/\s+/); const single=toks.filter(x=>x.length===1&&/[\u0600-\u06FF]/.test(x)).length; return toks.length>6&&single/toks.length>0.12;};
const g=cards.filter(garbled); console.log("garbled",g.length);
const by={}; for(const c of g){const k=`${c.d.source_meta.year}-${c.d.source_meta.month}-${c.d.topic}`; by[k]=(by[k]||0)+1;} console.log(Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,15));
// year-month distribution per topic for 1403 اسفند
const ym={}; for(const c of cards){const k=`${c.d.source_meta.year}-${c.d.source_meta.month}`; ym[k]=(ym[k]||0)+1;} console.log(Object.entries(ym).sort((a,b)=>b[1]-a[1]).slice(0,30));
// how ids are grouped: consecutive id ranges per (year,month,topic)
