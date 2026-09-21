process.env.DATA_DIR="/home/user/Med/.work/data";
const { db, initDb } = await import("./src/db.js"); await initDb();
const rows = db.prepare("SELECT id,data_json FROM flashcards").all();
const m=new Map(), rep=new Map(); let noChapter=0;
for (const r of rows){ let d; try{d=JSON.parse(r.data_json)}catch{continue}; if(d.track!=="learn"||d.source_meta?.kind!=="past_exam_import") continue; const k=`${d.source_meta.subject_fa}→${d.topic}`; m.set(k,(m.get(k)||0)+1); if(!d.source_meta.chapter_fa) noChapter++; const rc=d.source_meta.repeat_count||0; rep.set(rc,(rep.get(rc)||0)+1);}
console.log([...m].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}:${v}`).join("\n")); console.log("noChapter",noChapter,"repeat dist",[...rep]);
