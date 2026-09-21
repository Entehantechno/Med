process.env.DATA_DIR="/home/user/Med/.work/data";
const { db, initDb } = await import("./src/db.js"); await initDb();
const { allSyllabi } = await import("./src/data/path-syllabus.js"); const SUBJECT_SYLLABUS = allSyllabi();
const { classifyCard } = await import("./src/lib/pathcurator.js");
const rows = db.prepare("SELECT id,data_json FROM flashcards").all();
const want = process.argv[2]; const N=Number(process.argv[3]||40);
const out=[];
for (const r of rows){ let d; try{d=JSON.parse(r.data_json)}catch{continue}; if(d.track!=="learn"||d.source_meta?.kind!=="past_exam_import") continue; if(d.topic!==want) continue; const ch=classifyCard({id:r.id,d},SUBJECT_SYLLABUS[want]||[]); if(ch) continue; out.push(`${r.id} [${d.source_meta.chapter_fa||"-"}] ${String(d.q_fa||"").replace(/\s+/g," ").slice(0,110)}`); }
console.log(out.length); console.log(out.slice(0,N).join("\n"));
