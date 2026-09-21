process.env.DATA_DIR="/home/user/Med/.work/data";
const { db, initDb } = await import("./src/db.js"); await initDb();
const { SUBJECT_SYLLABUS } = await import("./src/data/path-syllabus.js");
const { classifyCard } = await import("./src/lib/pathcurator.js");
const rows = db.prepare("SELECT id,data_json FROM flashcards").all();
const cards=[]; for (const r of rows){ let d; try{d=JSON.parse(r.data_json)}catch{continue}; if(d.track==="learn"&&d.source_meta?.kind==="past_exam_import") cards.push({id:r.id,d}); }
// mis-subject check: keyword hints of other subjects inside a topic
const hints={obgyn:/باردار|حاملگ|زایمان|رحم|تخمدان|واژن|سرویکس|قاعدگ|جنین|نفاس|سقط/, peds:/کودک|شیرخوار|نوزاد|ماهه|پسر|دختر/, uro:/بیضه|پروستات|مثانه|حالب|پیشابراه|اسکروتوم|نعوظ/, };
const gyn=cards.filter(c=>c.d.topic==="obgyn"&&!hints.obgyn.test(c.d.q_fa||"")&&!/خانم|زن|دختر|پستان|واژ|ولو|لگن|هورمون|استروژن|OCP|ocp|IUD|iud|یائسگ|ناباروری/i.test(c.d.q_fa||""));
console.log("obgyn non-gyn looking:",gyn.length); console.log(gyn.slice(0,15).map(c=>c.id+" "+(c.d.q_fa||"").slice(0,90)).join("\n"));
// overall low-score classifications: cards placed with only option hits (score<3)
