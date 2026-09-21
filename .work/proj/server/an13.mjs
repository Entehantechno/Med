process.env.DATA_DIR="/home/user/Med/.work/data";
const { db, initDb } = await import("./src/db.js"); await initDb();
const rows = db.prepare("SELECT id,data_json FROM flashcards").all();
const terms=process.argv.slice(2); const re=new RegExp(terms.join("|"));
const per={};
for (const r of rows){ let d; try{d=JSON.parse(r.data_json)}catch{continue}; if(d.track!=="learn"||d.source_meta?.kind!=="past_exam_import") continue;
 const t=[d.q_fa,...(d.options_fa||d.options||[]).map(o=>typeof o==='string'?o:o?.text||'')].join(' ');
 if(re.test(t)) per[d.topic]=(per[d.topic]||0)+1; }
console.log(per);
