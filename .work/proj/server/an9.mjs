// dump unplaced stems per topic to files for reading
process.env.DATA_DIR="/home/user/Med/.work/data";
import fs from "fs";
const { db, initDb } = await import("./src/db.js"); await initDb();
const { allSyllabi } = await import("./src/data/path-syllabus.js"); const SUBJECT_SYLLABUS = allSyllabi();
const { classifyCard } = await import("./src/lib/pathcurator.js");
const rows = db.prepare("SELECT id,data_json FROM flashcards").all();
const out={};
for (const r of rows){ let d; try{d=JSON.parse(r.data_json)}catch{continue}; if(d.track!=="learn"||d.source_meta?.kind!=="past_exam_import") continue; const t=d.topic; if(classifyCard({id:r.id,d},SUBJECT_SYLLABUS[t]||[])) continue; (out[t]??=[]).push(`${r.id}\t${(d.q_fa||"").replace(/\s+/g," ").slice(0,140)}\t|| ${(d.options||[]).map(o=>o?.fa||"").join(" / ").slice(0,120)}`); }
fs.mkdirSync("/home/user/Med/.work/unplaced",{recursive:true});
for (const [t,l] of Object.entries(out)) fs.writeFileSync(`/home/user/Med/.work/unplaced/${t}.txt`, l.join("\n"));
console.log(Object.entries(out).map(([t,l])=>t+":"+l.length).join(" "));
