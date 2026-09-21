process.env.DATA_DIR="/home/user/Med/.work/data";
const { db, initDb } = await import("./src/db.js"); await initDb();
const { allSyllabi } = await import("./src/data/path-syllabus.js"); const SUBJECT_SYLLABUS = allSyllabi();
const { classifyCard } = await import("./src/lib/pathcurator.js");
const topics = db.prepare("SELECT * FROM topics WHERE program='preint' AND active=1 ORDER BY ord").all();
const rows = db.prepare("SELECT id,data_json FROM flashcards").all();
const cards=[]; for (const r of rows){ let d; try{d=JSON.parse(r.data_json)}catch{continue}; if(d.track==="learn"&&d.source_meta?.kind==="past_exam_import") cards.push({id:r.id,d}); }
console.log("official cards", cards.length);
const byTopic = new Map();
for (const c of cards){ const k=c.d.topic; if(!byTopic.has(k)) byTopic.set(k,[]); byTopic.get(k).push(c); }
let out=[];
for (const t of topics){
  const cs = byTopic.get(t.slug)||[];
  const syl = SUBJECT_SYLLABUS[t.slug]||[];
  const nodes = db.prepare("SELECT id,title_fa,card_ids FROM path_nodes WHERE topic_id=? AND active=1 ORDER BY ord").all(t.id);
  const counts = new Map(syl.map(s=>[s.slug,0])); let unpl=0, bankOnly=0;
  for (const c of cs){ if(c.d.source_meta.route==="bank_only"){bankOnly++;} const ch=classifyCard(c,syl); if(ch) counts.set(ch.slug,counts.get(ch.slug)+1); else unpl++; }
  const empty=[...counts].filter(([,n])=>n===0).map(([s])=>s);
  const small=[...counts].filter(([,n])=>n>0&&n<4).map(([s,n])=>`${s}:${n}`);
  out.push(`${t.slug.padEnd(10)} cards=${String(cs.length).padStart(5)} nodes=${String(nodes.length).padStart(3)} syl=${String(syl.length).padStart(2)} unplaced=${unpl} bankOnly=${bankOnly} empty=[${empty.join(",")}] small=[${small.join(",")}]`);
}
console.log(out.join("\n"));
