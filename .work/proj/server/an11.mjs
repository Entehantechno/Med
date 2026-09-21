process.env.DATA_DIR="/home/user/Med/.work/data";
const { db, initDb } = await import("./src/db.js"); await initDb();
const { syllabusFor } = await import("./src/data/path-syllabus.js");
const { classifyCard } = await import("./src/lib/pathcurator.js");
const [want, slug, n=8] = process.argv.slice(2); const rows = db.prepare("SELECT id,data_json FROM flashcards").all();
const syl=syllabusFor(want); let k=0;
for (const r of rows){ let d; try{d=JSON.parse(r.data_json)}catch{continue}; if(d.track!=="learn"||d.source_meta?.kind!=="past_exam_import"||d.topic!==want) continue; const ch=classifyCard({id:r.id,d},syl); if((ch?ch.slug:"(none)")!==slug) continue; if(k++>=n) break;
 const text=`${d.q_fa||""} ${(d.options||[]).map(o=>o.fa).join(" ")}`.toLowerCase();
 const hits=ch?ch.kw.filter(x=>new RegExp(x,"i").test(text)).slice(0,6):[];
 console.log("•", String(d.q_fa||"").replace(/\s+/g," ").slice(0,120), "  ⇐", hits.join(" , ")); }
