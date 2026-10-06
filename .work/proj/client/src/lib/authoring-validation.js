import {acceptedAnswers} from "./authoring-values.js";
const text=v=>typeof v==='string'&&v.trim().length>0;
const lines=v=>Array.isArray(v)?v.filter(text):String(v||'').split('\n').filter(text);
export function validateQuestion(f,lang='fa'){
 const fa=lang==='fa',fail=(a,b)=>fa?a:b;
 if(![f.title_fa,f.title_en,f.q_fa,f.q_en,f.questionText_fa,f.questionText_en].some(text))return fail('عنوان یا متن سؤال را وارد کنید.','Enter a title or question.');
 if(f.type==='mcq'){
  const options=(f.options||[]).filter(o=>text(o.fa)||text(o.en)||text(o.text_fa)||text(o.text_en));
  const keyless=f.source_meta?.keyless===true||f.source_meta?.key_available===false,correct=options.filter(o=>o.correct).length;
  if(options.length<2||(!keyless&&correct!==1)||(keyless&&correct>1))return fail('در بخش پاسخ، حداقل دو گزینه و دقیقاً یک پاسخ صحیح مشخص کنید.','In Question & answer, enter at least two options and mark exactly one correct answer.');
 }
 if(f.type==='fill'&&![f.blank_fa,f.blank_en].some(text)&&!acceptedAnswers(f.accept_fa).length&&!acceptedAnswers(f.accept_en).length)return fail('پاسخ قابل قبول جای‌خالی را وارد کنید.','Enter an accepted fill-in answer.');
 if(f.type==='match'&&!(f.pairs||[]).some(p=>Array.isArray(p)?[p[0],p[1]].some(text)&&[p[2],p[3]].some(text):[p.l,p.le].some(text)&&[p.r,p.re].some(text)))return fail('حداقل یک جفت تطبیق کامل وارد کنید.','Enter at least one complete matching pair.');
 if(f.type==='order'&&Math.max(lines(f.items_fa).length,lines(f.items_en).length)<2)return fail('حداقل دو مورد برای مرتب‌سازی وارد کنید.','Enter at least two ordered items.');
 if(f.type==='compare'&&(![f.entityA_fa,f.entityA_en].some(text)||![f.entityB_fa,f.entityB_en].some(text)||!(f.features||[]).some(x=>text(x.fa)||text(x.en))))return fail('نام هر دو موجودیت و حداقل یک ویژگی مقایسه را وارد کنید.','Enter both entity names and at least one comparison feature.');
 if(f.type==='hotspot'&&!text(f.imageUrl))return fail('تصویر سؤال ناحیه‌گذاری را انتخاب کنید.','Choose the hotspot image.');
 if(f.type==='puzzle'&&(!text(f.puzzle?.imageUrl||f.imageUrl)||!(f.puzzle?.pins||[]).some(p=>text(p.label_fa)||text(p.label_en))))return fail('تصویر و حداقل یک پین نام‌دار برای پازل لازم است.','The puzzle needs an image and at least one named pin.');
 if(f.type==='kf'&&!(f.kf?.items||[]).some(x=>text(x.prompt_fa)||text(x.prompt_en)))return fail('متن حداقل یک پرسش کلیدی را وارد کنید.','Enter at least one key-feature prompt.');
 if(f.type==='stepwise'&&!(f.steps||[]).some(x=>text(x.prompt_fa)||text(x.prompt_en)))return fail('متن حداقل یک مرحله را وارد کنید.','Enter at least one step prompt.');
 return null;
}
