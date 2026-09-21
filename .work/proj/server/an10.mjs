process.env.DATA_DIR="/home/user/Med/.work/data";
const { db, initDb } = await import("./src/db.js"); await initDb();
const { syllabusFor } = await import("./src/data/path-syllabus.js");
const { classifyCard } = await import("./src/lib/pathcurator.js");
const want=process.argv[2]; const rows = db.prepare("SELECT id,data_json FROM flashcards").all();
const syl=syllabusFor(want); const cnt={}; const ex={};
for (const r of rows){ let d; try{d=JSON.parse(r.data_json)}catch{continue}; if(d.track!=="learn"||d.source_meta?.kind!=="past_exam_import"||d.topic!==want) continue; const ch=classifyCard({id:r.id,d},syl); const k=ch?ch.slug:"(none)"; cnt[k]=(cnt[k]||0)+1; (ex[k]??=[]).length<3 && ex[k].push(String(d.q_fa||"").replace(/\s+/g," ").slice(0,90)); }
for (const c of syl) console.log(String(cnt[c.slug]||0).padStart(4), c.slug.padEnd(20), (ex[c.slug]||[]).join(" ‖ "));
console.log(String(cnt["(none)"]||0).padStart(4), "(none)");
