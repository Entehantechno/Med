process.env.DATA_DIR="/home/user/Med/.work/data";
const { db, initDb } = await import("./src/db.js"); await initDb();
const { allSyllabi } = await import("./src/data/path-syllabus.js");
const rows = db.prepare("SELECT id,data_json FROM flashcards").all();
const texts=[]; for (const r of rows){ let d; try{d=JSON.parse(r.data_json)}catch{continue}; if(d.track!=="learn"||d.source_meta?.kind!=="past_exam_import") continue; texts.push({t:`${d.q_fa||""} ${d.q_en||""} ${(d.options||[]).map(o=>`${o?.fa||""} ${o?.en||""}`).join(" ")}`.toLowerCase(), topic:d.topic}); }
const N=texts.length; const out=[];
for (const [subj, syl] of Object.entries(allSyllabi())) for (const ch of syl) for (const k of ch.kw) {
  let re; try{re=new RegExp(k,"i")}catch{continue}; let df=0, dfOut=0; for (const x of texts){ if(re.test(x.t)){df++; if(x.topic!==subj) dfOut++;} }
  if (df/N > 0.012 && dfOut/Math.max(1,df) > 0.5) out.push([df, dfOut, subj, ch.slug, k]);
}
out.sort((a,b)=>b[0]-a[0]); for (const o of out) console.log(o.join("\t"));
