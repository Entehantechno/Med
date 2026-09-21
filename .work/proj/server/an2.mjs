process.env.DATA_DIR="/home/user/Med/.work/data";
const { db, initDb } = await import("./src/db.js"); await initDb();
const { SUBJECT_SYLLABUS } = await import("./src/data/path-syllabus.js");
const { classifyCard } = await import("./src/lib/pathcurator.js");
const rows = db.prepare("SELECT id,data_json FROM flashcards").all();
const cards=[]; for (const r of rows){ let d; try{d=JSON.parse(r.data_json)}catch{continue}; if(d.track==="learn"&&d.source_meta?.kind==="past_exam_import") cards.push({id:r.id,d}); }
const stat={}; let noConcept=0, hasLesson=0;
for (const c of cards){ const sm=c.d.source_meta; if(!sm.concept_fa) noConcept++; if(c.d.micro_lesson_fa||c.d.lesson_fa||c.d.explain_fa) hasLesson++; }
console.log("cards",cards.length,"noConcept",noConcept,"hasLesson",hasLesson);
console.log("sample keys", Object.keys(cards[0].d), Object.keys(cards[0].d.source_meta));
const ex=cards.filter(c=>c.d.topic==="peds").slice(0,5).map(c=>[c.d.source_meta.chapter_fa,c.d.source_meta.concept_fa,c.d.source_meta.year,c.d.source_meta.style]); console.log(ex);
// per subject: chapter → cards, distinct concepts
const per={};
for (const c of cards){ const t=c.d.topic; const syl=SUBJECT_SYLLABUS[t]||[]; const ch=classifyCard(c,syl); const k=ch?ch.slug:"(unplaced)"; per[t]??={}; per[t][k]??={n:0,concepts:new Set(),booklet:new Set()}; per[t][k].n++; if(c.d.source_meta.concept_fa) per[t][k].concepts.add(c.d.source_meta.concept_fa); if(c.d.source_meta.chapter_fa) per[t][k].booklet.add(c.d.source_meta.chapter_fa); }
for (const [t,chs] of Object.entries(per)){ console.log("## "+t); for (const [k,v] of Object.entries(chs)) console.log(`  ${k.padEnd(22)} n=${String(v.n).padStart(4)} concepts=${String(v.concepts.size).padStart(3)} booklets=${v.booklet.size}`); }
