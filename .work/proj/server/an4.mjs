process.env.DATA_DIR="/home/user/Med/.work/data";
const { db, initDb } = await import("./src/db.js"); await initDb();
const { SUBJECT_SYLLABUS } = await import("./src/data/path-syllabus.js");
const { classifyCard } = await import("./src/lib/pathcurator.js");
const rows = db.prepare("SELECT id,data_json FROM flashcards").all();
const stop=new Set("در به از با که را این است کدام کدامیک زیر مورد بیمار برای شده کرده می های ای یک روز سال ساله بر اورژانس مراجعه است؟ درمان شکایت معاینه علت شما کند شود دارد اقدام مناسب ترین بهترین صحیح نیست؟ چیست؟ است؟ کدامست؟ کدام؟ اند نموده آورده شکایت تشخیص احتمالی کودک پسر دختر خانم مرد آقای سابقه قبل بعد حدود روزه ماهه هفته ماه سالهای سالهای، شیرخوار ی ه و آزمایش آزمایشات نتیجه علائم علایم زمان طول همراه دچار طبیعی غیر بدون همه موارد جز کدامیک؟ گزینه گزینههای عمل شده، مبتلا ب دلیل تحت نظر مي بار دقیقه محل نوع میزان بیشتر کمتر شایع شایعترین اولین وی او ایشان توسط دو سه چند نمی خود یا هر اگر تا هم پس نظر عنوان بایستی باید توصیه".split(/\s+/));
const want=process.argv.slice(2);
for (const t of want){
  const freq=new Map(); let n=0;
  for (const r of rows){ let d; try{d=JSON.parse(r.data_json)}catch{continue}; if(d.track!=="learn"||d.source_meta?.kind!=="past_exam_import"||d.topic!==t) continue; if(classifyCard({id:r.id,d},SUBJECT_SYLLABUS[t]||[])) continue; n++;
    const txt=`${d.q_fa||""} ${(d.options||[]).map(o=>o?.fa||"").join(" ")}`.replace(/[،؟?.,:;()\[\]\-_«»]/g," ");
    const seen=new Set(); for (const w of txt.split(/\s+/)){ const x=w.trim().toLowerCase(); if(x.length<3||stop.has(x)||/^\d+$/.test(x)||seen.has(x)) continue; seen.add(x); freq.set(x,(freq.get(x)||0)+1);} }
  console.log(`## ${t} unplaced=${n}`); console.log([...freq].sort((a,b)=>b[1]-a[1]).slice(0,90).map(([w,c])=>`${w}:${c}`).join("  "));
}
