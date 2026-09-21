process.env.DATA_DIR="/home/user/Med/.work/data";
const { db, initDb } = await import("./src/db.js"); await initDb();
const ids=process.argv.slice(2).map(Number);
for (const id of ids){ const r=db.prepare("SELECT data_json FROM flashcards WHERE id=?").get(id); const d=JSON.parse(r.data_json); const s=d.source_meta; console.log(id, d.topic, JSON.stringify({subject:s.subject_fa,chapter:s.chapter_fa,source:s.source,label:s.label_fa,year:s.year,month:s.month,exam:s.exam_type,scope:s.scope,pole:s.pole,tags:s.tags,seq:s.seq,lp:s.lesson_part})); }
