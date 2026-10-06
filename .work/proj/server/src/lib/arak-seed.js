/* arak-seed.js — Idempotent demo seed for University of Arak (id=120) histology.
   Ensures the 12-card histology demo exists with correct types:
   - Q1 stepwise (simple/stratified → pseudostratified → columnar ciliated) with image
   - Q2-3,6-8,10-11 mcq, Q4 match, Q5/Q9 drawing, Q12 mcq with hints
   The image at /uploads/academic/university-120/histology_q1_1790882726117.png is
   expected to already exist in .work/medschool-data/academic/university-120/media/.
   Called from db.js init; safe to run multiple times. */
import { db, persistNow } from "../db.js";
import fs from "fs";
import path from "path";
import { DATA_DIR } from "./paths.js";

const ARAK_ID = 120;
const IMAGE_URL = "/uploads/academic/university-120/histology_q1_1790882726117.png";

function ensureUniversity() {
  const has = db.prepare("SELECT id FROM universities WHERE id=?").get(ARAK_ID);
  if (!has) {
    // Use a distinct code for the histology demo university (120) to avoid unique-code clash with the main Arak university (13, code ARAK)
    try { db.prepare("INSERT OR IGNORE INTO universities (id,name_fa,name_en,city_fa,city_en,code,active) VALUES (?,?,?,?,?,?,1)").run(ARAK_ID, "دانشگاه علوم پزشکی اراک - بافت‌شناسی", "Arak University of Medical Sciences - Histology", "اراک", "Arak", "ARAK_HIST"); } catch {}
    // fallback: if code clash still, try with same code but ignore error
    try { if (!db.prepare("SELECT id FROM universities WHERE id=?").get(ARAK_ID)) db.prepare("INSERT OR IGNORE INTO universities (id,name_fa,name_en,city_fa,city_en,code,active) VALUES (?,?,?,?,?,?,1)").run(ARAK_ID, "دانشگاه علوم پزشکی اراک", "Arak University of Medical Sciences", "اراک", "Arak", "ARAK120"); } catch {}
  }
}

function ensureUsers() {
  // Use username-based idempotency to avoid colliding with auto-increment student ids (85 Arak students).
  const users = [
    { username:"arak_histology", name_fa:"استاد بافت‌شناسی اراک", role:"teacher", univ:ARAK_ID, is_expert:0 },
    { username:"arak_expert", name_fa:"کارشناس آموزش اراک", role:"teacher", univ:ARAK_ID, is_expert:1 },
    { username:"arak_other_teacher", name_fa:"استاد دیگر اراک", role:"teacher", univ:ARAK_ID, is_expert:0 },
    { username:"arak_teacher", name_fa:"استاد اراک", role:"teacher", univ:13, is_expert:0 },
  ];
  for (const u of users) {
    const has = db.prepare("SELECT id, university_id FROM users WHERE username=?").get(u.username);
    if (!has) {
      const hashRow = db.prepare("SELECT password_hash FROM users WHERE role='teacher' LIMIT 1").get();
      const hash = hashRow?.password_hash || "$2a$10$dummyhashdummyhashdummyhashdummyha";
      try { db.prepare("INSERT OR IGNORE INTO users (username,password_hash,name_fa,role,university_id,is_expert,status) VALUES (?,?,?,?,?,?,'active')").run(u.username, hash, u.name_fa, u.role, u.univ, u.is_expert); } catch {}
    } else {
      // heal university if misassigned (student collision previously set 120 incorrectly)
      if (Number(has.university_id) !== Number(u.univ)) {
        try { db.prepare("UPDATE users SET university_id=?, is_expert=? WHERE username=?").run(u.univ, u.is_expert, u.username); } catch {}
      }
    }
  }
  // legacy arak_student (demo) - keep if not exists, under 120
  const s = db.prepare("SELECT id FROM users WHERE username='arak_student'").get();
  if (!s) {
    const hash = db.prepare("SELECT password_hash FROM users WHERE role='teacher' LIMIT 1").get()?.password_hash || "x";
    try { db.prepare("INSERT OR IGNORE INTO users (username,password_hash,name_fa,role,university_id,status) VALUES (?,?,?,?,?,'active')").run("arak_student", hash, "دانشجوی اراک", "student", ARAK_ID); } catch {}
  }
}

function cardData() {
  const histRef = {
    book_fa:"جان‌کوئرا - بافت‌شناسی پایه", book_en:"Junqueira's Basic Histology",
    chapter_fa:"فصل بافت پوششی", chapter_en:"Chapter: Epithelial Tissue",
    edition:"15e", url:"https://accessmedicine.mhmedical.com/book.aspx?bookid=2430", page:"۵۵-۷۲",
    short_fa:"Junqueira 15e", short_en:"Junqueira 15e",
  };
  // Full 12-card bilingual payload — exactly as originally created for Arak (172-183)
  return [
    {
      id:172,
      data:{
        track:"uni", type:"stepwise", course_fa:"بافت‌شناسی", course_en:"Histology", category_fa:"بافت پوششی", category_en:"Epithelial tissue",
        title_fa:"تشخیص مرحله‌ای نوع اپیتلیوم از روی تصویر", title_en:"Stepwise identification of epithelium from image",
        q_fa:"با توجه به تصویر میکروسکوپی زیر، به صورت مرحله‌ای نوع اپیتلیوم را تعیین کنید.", q_en:"Given the microscopic image, determine the epithelium type stepwise.",
        questionText_fa:"تصویر زیر مربوط به کدام نوع اپیتلیوم است؟ به صورت مرحله‌ای پاسخ دهید", questionText_en:"Which type of epithelium is shown? Answer stepwise",
        imageUrl:IMAGE_URL, media:{ url:IMAGE_URL, kind:"image", caption_fa:"اپیتلیوم مطبق کاذب مژکدار - نای", caption_en:"Pseudostratified ciliated columnar - trachea" }, color:"#f7c6c7",
        steps:[
          { prompt_fa:"مرحله ۱: این اپیتلیوم ساده است یا مطبق (چندلایه به نظر می‌رسد)؟", prompt_en:"Step 1: Is this epithelium simple or stratified (appears multilayered)?", answer_fa:"مطبق", answer_en:"Stratified", accept_fa:["مطبق","چندلایه","stratified"], accept_en:["stratified","multilayered"], explanation_fa:"چون در تصویر چند ردیف هسته در ارتفاع‌های مختلف دیده می‌شود، نما مطبق است (هرچند بعداً مشخص می‌شود کاذب است).", explanation_en:"Multiple nuclear rows at different heights give a stratified appearance." },
          { prompt_fa:"مرحله ۲: اگر مطبق به نظر می‌رسد، آیا مطبق واقعی یا مطبق کاذب است؟ (آیا همه سلول‌ها روی غشای پایه‌اند؟)", prompt_en:"Step 2: If stratified appearance, is it true stratified or pseudostratified?", answer_fa:"مطبق کاذب", answer_en:"Pseudostratified", accept_fa:["مطبق کاذب","کاذب","سودواستراتیفیه","pseudostratified"], accept_en:["pseudostratified","pseudo"], explanation_fa:"همه سلول‌ها به غشای پایه متصل‌اند ولی چون قد سلول‌ها متفاوت است، هسته‌ها در سطوح مختلف قرار دارند → نمای کاذب مطبق.", explanation_en:"All cells contact basement membrane but vary in height → pseudostratified." },
          { prompt_fa:"مرحله ۳: شکل سلول‌های سطحی چگونه است؟ سنگ‌فرشی (مسطح) / مکعبی (مربعی) / استوانه‌ای (بلند)؟ آیا مژک دارد؟", prompt_en:"Step 3: What is the shape of surface cells? Squamous / cuboidal / columnar? Ciliated?", answer_fa:"استوانه‌ای مژکدار", answer_en:"Ciliated columnar", accept_fa:["استوانه‌ای","استوانه ای","columnar","مژکدار","استوانه‌ای مژکدار"], accept_en:["columnar","ciliated columnar","ciliated"], explanation_fa:"سلول‌های سطحی بلند و استوانه‌ای با مژک‌های واضح در لبه رأسی + سلول‌های جامی بین آنها → استوانه‌ای مژکدار.", explanation_en:"Tall columnar surface cells with prominent cilia + goblet cells → ciliated columnar." },
        ],
        hints_fa:["به هسته‌ها و مژک‌ها دقت کن","همه سلول‌ها به غشای پایه می‌رسند؟","قد سلول سطحی را بسنج"], hints_en:["Look at nuclei and cilia","Do all cells reach basement membrane?","Measure surface cell height"],
        explanation_fa:"جمع‌بندی: اپیتلیوم **استوانه‌ای مطبق کاذب مژکدار** (نای/برونش). هر سه مرحله را درست پاسخ دادی: مطبق → کاذب → استوانه‌ای مژکدار.",
        explanation_en:"Summary: Pseudostratified ciliated columnar epithelium (trachea/bronchus).",
        micro:{ lead_fa:"مطبق کاذب = همه روی غشا ولی نما چندلایه.", lead_en:"Pseudostratified = all on membrane but looks layered.", golden_fa:"نای کلاسیک‌ترین محل مطبق کاذب مژکدار است.", golden_en:"Trachea is classic pseudostratified ciliated columnar.", points_fa:["مژه برای جاروب موکوس","سلول جامی بین استوانه‌ای‌ها","هسته‌های نامتقارن کلید تشخیص"], points_en:["Cilia sweep mucus","Goblet cells among columnar","Heterogeneous nuclei key"], source_fa:"جان‌کوئرا - فصل بافت پوششی", source_en:"Junqueira - Epithelial Tissue", reference:{ ...histRef } }
      }
    },
    { id:173, data:{ track:"uni", type:"mcq", course_fa:"بافت‌شناسی", course_en:"Histology", category_fa:"بافت پوششی", category_en:"Epithelial tissue", title_fa:"این ارگانل اسیدوفیلیک فراوان در سیتوپلاسم سلول‌های ترشحی چیست؟", title_en:"Which acidophilic organelle is abundant in secretory cells?", q_fa:"در رنگ‌آمیزی H&E، کدام اندامک به دلیل پروتئین فراوان اسیدوفیل (صورتی) دیده می‌شود؟", q_en:"On H&E, which organelle appears acidophilic (pink) due to abundant protein?", questionText_fa:"در رنگ‌آمیزی H&E، کدام اندامک به دلیل پروتئین فراوان اسیدوفیل (صورتی) دیده می‌شود؟", questionText_en:"On H&E, which organelle appears acidophilic (pink)?", options:[{text_fa:"میتوکندری",text_en:"Mitochondria",correct:true},{text_fa:"شبکه آندوپلاسمی صاف",text_en:"Smooth ER",correct:false},{text_fa:"ریبوزوم",text_en:"Ribosome",correct:false},{text_fa:"لیزوزوم",text_en:"Lysosome",correct:false}], hints_fa:["اسیدوفیلیک = صورتی در H&E","پروتئین زیاد دارد","انرژی سلول را تأمین می‌کند"], hints_en:["Acidophilic = pink on H&E","Protein-rich","Powerhouse"], explanation_fa:"میتوکندری به دلیل پروتئین‌های غشای داخلی فراوان، در H&E اسیدوفیل (صورتی) است.", explanation_en:"Mitochondria are acidophilic on H&E due to abundant inner-membrane proteins.", color:"#f7c6c7", micro:{ lead_fa:"اسیدوفیل = صورتی، بازوفیل = آبی.", lead_en:"Acidophilic = pink, basophilic = blue.", golden_fa:"میتوکندری = اسیدوفیل پررنگ.", golden_en:"Mitochondria = strongly acidophilic.", points_fa:["غشای دو لایه","کریستا","ATP"], points_en:["Double membrane","Cristae","ATP"], source_fa:"جان‌کوئرا - سلول", source_en:"Junqueira - Cell", reference:histRef } } },
    { id:174, data:{ track:"uni", type:"mcq", course_fa:"بافت‌شناسی", course_en:"Histology", category_fa:"بافت همبند", category_en:"Connective tissue", title_fa:"این ساختار بازوفیلیک خشن در سیتوپلاسم چیست؟", title_en:"What is this rough basophilic structure?", q_fa:"کدام اندامک به دلیل RNA فراوان، بازوفیل (آبی) است؟", q_en:"Which organelle is basophilic due to abundant RNA?", questionText_fa:"کدام اندامک به دلیل RNA فراوان، بازوفیل (آبی) است؟", questionText_en:"Which organelle is basophilic due to abundant RNA?", options:[{text_fa:"شبکه آندوپلاسمی خشن",text_en:"Rough ER",correct:true},{text_fa:"دستگاه گلژی",text_en:"Golgi apparatus",correct:false},{text_fa:"سانتریول",text_en:"Centriole",correct:false},{text_fa:"پراکسی‌زوم",text_en:"Peroxisome",correct:false}], hints_fa:["بازوفیل = آبی","RNA زیاد دارد","ریبوزوم روی آن نشسته"], hints_en:["Basophilic = blue","RNA-rich","Ribosomes attached"], explanation_fa:"شبکه آندوپلاسمی خشن به دلیل ریبوزوم‌ها بازوفیل است.", explanation_en:"Rough ER is basophilic due to attached ribosomes.", color:"#f7c6c7", micro:{ lead_fa:"RER = بازوفیل", lead_en:"RER = basophilic", golden_fa:"RER = کارخانه پروتئین", golden_en:"RER = protein factory", points_fa:["ریبوزوم","سیسترنا"], points_en:["Ribosomes","Cisternae"], source_fa:"جان‌کوئرا - سلول", source_en:"Junqueira - Cell", reference:histRef } } },
    { id:175, data:{ track:"uni", type:"match", course_fa:"بافت‌شناسی", course_en:"Histology", category_fa:"بافت پوششی", category_en:"Epithelial tissue", title_fa:"جورچین: اپیتلیوم ↔ محل بافتی", title_en:"Match: epithelium ↔ location", q_fa:"هر اپیتلیوم را به محل صحیح وصل کنید.", q_en:"Match each epithelium to its location.", questionText_fa:"هر اپیتلیوم را به محل صحیح وصل کنید.", questionText_en:"Match each epithelium to its location.", pairs:[{left_fa:"سنگفرشی ساده",left_en:"Simple squamous",right_fa:"آلوئول ریه",right_en:"Lung alveolus"},{left_fa:"مکعبی ساده",left_en:"Simple cuboidal",right_fa:"توبول کلیه",right_en:"Kidney tubule"},{left_fa:"استوانه‌ای ساده",left_en:"Simple columnar",right_fa:"روده باریک",right_en:"Small intestine"},{left_fa:"مطبق کاذب مژکدار",left_en:"Pseudostratified ciliated",right_fa:"نای",right_en:"Trachea"}], hints_fa:["آلوئول نازک است","کلیه مکعبی است","روده جاذب است"], hints_en:["Alveolus thin","Kidney cuboidal","Intestine absorptive"], explanation_fa:"سنگفرشی ساده در تبادل، مکعبی در لوله‌ها، استوانه‌ای در روده، مطبق کاذب در راه هوایی.", explanation_en:"Simple squamous at exchange, cuboidal in tubules, columnar in intestine, pseudostratified in airway.", color:"#e8f0ff", micro:{ lead_fa:"شکل ↔ عملکرد", lead_en:"Shape ↔ function", golden_fa:"محل نوع را حدس می‌زند", golden_en:"Location predicts type", points_fa:["تبادل","جذب"], points_en:["Exchange","Absorption"], source_fa:"جان‌کوئرا - اپیتلیوم", source_en:"Junqueira - Epithelium", reference:histRef } } },
    { id:176, data:{ track:"uni", type:"drawing", course_fa:"بافت‌شناسی", course_en:"Histology", category_fa:"بافت پوششی", category_en:"Epithelial tissue", title_fa:"طراحی: اپیتلیوم سنگفرشی مطبق را رسم و نام‌گذاری کنید", title_en:"Draw: stratified squamous epithelium", q_fa:"لایه‌های بازال، خاردار، دانه‌دار و شاخی را رسم کنید.", q_en:"Draw and label basal, spinosum, granulosum, corneum.", questionText_fa:"لایه‌های بازال، خاردار، دانه‌دار و شاخی را رسم کنید.", questionText_en:"Draw basal, spinosum, granulosum, corneum.", hints_fa:["از بازال کوچک شروع کن","به سمت سطح پهن شو","کراتین در سطح"], hints_en:["Start small basal","Flatten superficially","Keratin at top"], explanation_fa:"سنگفرشی مطبق کراتینه ۴ لایه دارد.", explanation_en:"Keratinized stratified squamous has 4 layers.", color:"#e8f8e8", micro:{ lead_fa:"مطبق = محافظت", lead_en:"Stratified = protection", golden_fa:"پوست = مطبق کراتینه", golden_en:"Skin = keratinized stratified", points_fa:["بازال","خاردار"], points_en:["Basal","Spinosum"], source_fa:"جان‌کوئرا - پوست", source_en:"Junqueira - Skin", reference:histRef } } },
    { id:177, data:{ track:"uni", type:"mcq", course_fa:"بافت‌شناسی", course_en:"Histology", category_fa:"بافت پوششی", category_en:"Epithelial tissue", title_fa:"کدام اپیتلیوم در نای دیده می‌شود؟", title_en:"Which epithelium lines trachea?", q_fa:"اپیتلیوم نای کدام است؟", q_en:"Which epithelium is in trachea?", questionText_fa:"اپیتلیوم نای کدام است؟", questionText_en:"Which epithelium is in trachea?", options:[{text_fa:"مطبق کاذب مژکدار",text_en:"Pseudostratified ciliated columnar",correct:true},{text_fa:"سنگفرشی مطبق",text_en:"Stratified squamous",correct:false},{text_fa:"مکعبی ساده",text_en:"Simple cuboidal",correct:false},{text_fa:"انتقالی",text_en:"Transitional",correct:false}], hints_fa:["راه هوایی","مژک","جامی"], hints_en:["Airway","Ciliated","Goblet"], explanation_fa:"نای مطبق کاذب مژکدار با جامی است.", explanation_en:"Trachea is pseudostratified ciliated with goblet.", color:"#f7c6c7", micro:{ lead_fa:"نای = مژک + جامی", lead_en:"Trachea = cilia + goblet", golden_fa:"راه هوایی = مطبق کاذب", golden_en:"Airway = pseudostratified", points_fa:["مژک","جامی"], points_en:["Cilia","Goblet"], source_fa:"جان‌کوئرا - تنفس", source_en:"Junqueira - Respiratory", reference:histRef } } },
    { id:178, data:{ track:"uni", type:"mcq", course_fa:"بافت‌شناسی", course_en:"Histology", category_fa:"بافت پوششی", category_en:"Epithelial tissue", title_fa:"پمپ سدیم-پتاسیم وابسته به کدام اندامک است؟", title_en:"Sodium-potassium pump depends on which organelle?", q_fa:"ATP لازم برای Na+/K+ ATPase از کجا می‌آید؟", q_en:"Where does ATP for Na+/K+ ATPase come from?", questionText_fa:"ATP لازم برای Na+/K+ ATPase از کجا می‌آید؟", questionText_en:"Where does ATP for Na+/K+ ATPase come from?", options:[{text_fa:"میتوکندری",text_en:"Mitochondria",correct:true},{text_fa:"ریبوزوم",text_en:"Ribosome",correct:false},{text_fa:"لیزوزوم",text_en:"Lysosome",correct:false},{text_fa:"سانتریول",text_en:"Centriole",correct:false}], hints_fa:["ATP","نیروگاه","تنفس سلولی"], hints_en:["ATP","Powerhouse","Respiration"], explanation_fa:"میتوکندری ATP می‌سازد.", explanation_en:"Mitochondria produce ATP.", color:"#f7c6c7", micro:{ lead_fa:"پمپ = ATPخوار", lead_en:"Pump = ATP-hungry", golden_fa:"میتوکندری = باتری", golden_en:"Mitochondria = battery", points_fa:["ATP","غشا"], points_en:["ATP","Membrane"], source_fa:"جان‌کوئرا - غشا", source_en:"Junqueira - Membrane", reference:histRef } } },
    { id:179, data:{ track:"uni", type:"mcq", course_fa:"بافت‌شناسی", course_en:"Histology", category_fa:"بافت پوششی", category_en:"Epithelial tissue", title_fa:"کدام سلول دارای میتوکندری اسیدوفیلیک فراوان و ترشح HCl است؟", title_en:"Which cell has abundant acidophilic mitochondria and HCl?", q_fa:"سلول پریتال چه ویژگی دارد؟", q_en:"What characterizes parietal cell?", questionText_fa:"سلول پریتال چه ویژگی دارد؟", questionText_en:"What characterizes parietal cell?", options:[{text_fa:"سلول پریتال با میتوکندری فراوان",text_en:"Parietal cell with abundant mitochondria",correct:true},{text_fa:"سلول اصلی",text_en:"Chief cell",correct:false},{text_fa:"سلول جامی",text_en:"Goblet cell",correct:false},{text_fa:"انترواندوکرین",text_en:"Enteroendocrine",correct:false}], hints_fa:["اسید","میتوکندری","کانالیکول"], hints_en:["Acid","Mitochondria","Canaliculus"], explanation_fa:"پریتال HCl ترشح می‌کند؛ ائوزینوفیلیک.", explanation_en:"Parietal secretes HCl; eosinophilic.", color:"#f7c6c7", micro:{ lead_fa:"پریتال = اسید", lead_en:"Parietal = acid", golden_fa:"ائوزینوفیلیک = پریتال", golden_en:"Eosinophilic = parietal", points_fa:["HCl","میتوکندری"], points_en:["HCl","Mitochondria"], source_fa:"جان‌کوئرا - گوارش", source_en:"Junqueira - GI", reference:{...histRef, chapter_fa:"فصل لوله گوارش", chapter_en:"Chapter: Digestive Tract"} } } },
    { id:180, data:{ track:"uni", type:"drawing", course_fa:"بافت‌شناسی", course_en:"Histology", category_fa:"بافت پوششی", category_en:"Epithelial tissue", title_fa:"طراحی: مجرای مخطط غده بزاقی", title_en:"Draw: striated duct of salivary gland", q_fa:"مجرای مخطط را رسم و چین‌های بازال را نشان دهید.", q_en:"Draw striated duct and show basal striations.", questionText_fa:"مجرای مخطط را رسم و چین‌های بازال را نشان دهید.", questionText_en:"Draw striated duct.", hints_fa:["مکعبی-استوانه‌ای","چین بازال","میتوکندری ردیفی"], hints_en:["Cuboidal-columnar","Basal folds","Rowed mitochondria"], explanation_fa:"مجرای مخطط با چین بازال و میتوکندری ردیفی.", explanation_en:"Striated duct with basal infoldings.", color:"#e8f8e8", micro:{ lead_fa:"مخطط = چین", lead_en:"Striated = folds", golden_fa:"چین = بازجذب", golden_en:"Folds = reabsorption", points_fa:["چین","میتوکندری"], points_en:["Folds","Mitochondria"], source_fa:"جان‌کوئرا - بزاقی", source_en:"Junqueira - Salivary", reference:histRef } } },
    { id:181, data:{ track:"uni", type:"mcq", course_fa:"بافت‌شناسی", course_en:"Histology", category_fa:"بافت پوششی", category_en:"Epithelial tissue", title_fa:"کدام اپیتلیوم در برونشیول انتهایی دیده می‌شود؟", title_en:"Which epithelium in terminal bronchiole?", q_fa:"برونشیول انتهایی چه اپیتلیومی دارد؟", q_en:"What epithelium lines terminal bronchiole?", questionText_fa:"برونشیول انتهایی چه اپیتلیومی دارد؟", questionText_en:"What epithelium lines terminal bronchiole?", options:[{text_fa:"مکعبی ساده تا استوانه‌ای ساده مژکدار",text_en:"Simple cuboidal to simple columnar ciliated",correct:true},{text_fa:"سنگفرشی مطبق کراتینه",text_en:"Keratinized stratified squamous",correct:false},{text_fa:"انتقالی",text_en:"Transitional",correct:false},{text_fa:"سنگفرشی ساده",text_en:"Simple squamous",correct:false}], hints_fa:["برونشیول کوچک","مژک کم","کلارا"], hints_en:["Small bronchiole","Cilia decrease","Clara"], explanation_fa:"برونشیول از مکعبی مژکدار به استوانه‌ای ساده.", explanation_en:"Bronchiole shifts from ciliated cuboidal to columnar.", color:"#f7c6c7", micro:{ lead_fa:"برونشیول = مکعبی", lead_en:"Bronchiole = cuboidal", golden_fa:"کلارا = برونشیول", golden_en:"Clara = bronchiole", points_fa:["مژک","کلارا"], points_en:["Cilia","Clara"], source_fa:"جان‌کوئرا - تنفس", source_en:"Junqueira - Respiratory", reference:histRef } } },
    { id:182, data:{ track:"uni", type:"mcq", course_fa:"بافت‌شناسی", course_en:"Histology", category_fa:"بافت پوششی", category_en:"Epithelial tissue", title_fa:"اپیتلیوم انتقالی (یوروتلیوم) کجا دیده می‌شود؟", title_en:"Where is transitional epithelium found?", q_fa:"یوروتلیوم مخصوص کدام اندام است؟", q_en:"Which organ has urothelium?", questionText_fa:"یوروتلیوم مخصوص کدام اندام است؟", questionText_en:"Which organ has urothelium?", options:[{text_fa:"مثانه و حالب",text_en:"Bladder and ureter",correct:true},{text_fa:"نای",text_en:"Trachea",correct:false},{text_fa:"روده",text_en:"Intestine",correct:false},{text_fa:"پوست",text_en:"Skin",correct:false}], hints_fa:["ادرار","قابل اتساع","چتری"], hints_en:["Urine","Distensible","Umbrella"], explanation_fa:"یوروتلیوم در مثانه/حالب.", explanation_en:"Urothelium in bladder/ureter.", color:"#f7c6c7", micro:{ lead_fa:"انتقالی = ادراری", lead_en:"Transitional = urinary", golden_fa:"چتری = یوروتلیوم", golden_en:"Umbrella = urothelium", points_fa:["چتری","اتساع"], points_en:["Umbrella","Distension"], source_fa:"جان‌کوئرا - ادراری", source_en:"Junqueira - Urinary", reference:{...histRef, chapter_fa:"فصل دستگاه ادراری", chapter_en:"Chapter: Urinary"} } } },
    { id:183, data:{ track:"uni", type:"mcq", course_fa:"بافت‌شناسی", course_en:"Histology", category_fa:"بافت پوششی", category_en:"Epithelial tissue", title_fa:"این بافت ملتحمه (Conjunctiva) را توصیف کنید", title_en:"Describe conjunctival tissue", q_fa:"ملتحمه چه نوع اپیتلیومی دارد؟", q_en:"What epithelium is conjunctiva?", questionText_fa:"ملتحمه چه نوع اپیتلیومی دارد؟", questionText_en:"What epithelium is conjunctiva?", options:[{text_fa:"استوانه‌ای چندردیفه با سلول جامی فراوان",text_en:"Stratified columnar with many goblet cells",correct:true},{text_fa:"سنگفرشی مطبق کراتینه",text_en:"Keratinized stratified squamous",correct:false},{text_fa:"مکعبی ساده",text_en:"Simple cuboidal",correct:false},{text_fa:"سنگفرشی ساده",text_en:"Simple squamous",correct:false}], hints_fa:["این بافت مخاط نازکی است که سفیدی چشم (صلبیه) و سطح داخلی پلک‌ها را می‌پوشاند و التهاب آن قرمزی چشم می‌دهد","برخلاف اپیدرم که سطح آن سنگ‌فرشی و کراتینه است، سطح این بافت استوانه‌ای بلند با سلول‌های جامی فراوان است؛ لایه‌های عمقی مکعبی‌اند","نام لاتین آن conjunctiva به معنای 'متصل‌کننده' است — پلک را به کره چشم متصل می‌کند"], hints_en:["This thin mucosa covers sclera and inner eyelids; inflammation causes red eye","Unlike epidermis, surface is tall columnar with many goblet cells; deeper cuboidal","Latin conjunctiva means joining — joins eyelid to eyeball"], explanation_fa:"ملتحمه ۲-۳ ردیفه استوانه‌ای با جامی فراوان.", explanation_en:"Conjunctiva is 2-3-layered columnar with goblet.", color:"#f7c6c7", micro:{ lead_fa:"ملتحمه = ۲-۳ ردیفه", lead_en:"Conjunctiva = 2-3 layered", golden_fa:"ملتحمه = استوانه‌ای + جامی", golden_en:"Conjunctiva = columnar + goblet", points_fa:["استوانه‌ای","جامی"], points_en:["Columnar","Goblet"], source_fa:"جان‌کوئرا - ملتحمه", source_en:"Junqueira - Conjunctiva", reference:{ book_fa:"جان‌کوئرا - بافت‌شناسی پایه", book_en:"Junqueira's Basic Histology", chapter_fa:"فصل بافت پوششی - ملتحمه", chapter_en:"Chapter: Epithelium - Conjunctiva", edition:"15e", url:"https://accessmedicine.mhmedical.com/book.aspx?bookid=2430", page:"۶۸-۷۰", short_fa:"Junqueira 15e", short_en:"Junqueira 15e"} } } },
  ];
}

// Full 12-card payload is now embedded — creates missing cards idempotently.

export function ensureArakHistology() {
  try {
    // Ensure academic media image exists (copy a placeholder if missing so stepwise card never has broken image)
    try {
      const mediaDir = path.join(DATA_DIR, "academic", "university-120", "media");
      try { fs.mkdirSync(mediaDir, { recursive:true }); } catch {}
      const dest = path.join(mediaDir, "histology_q1_1790882726117.png");
      if (!fs.existsSync(dest)) {
        const srcCandidates = [path.join(process.cwd(), "uploads", "teach-apoptosis-necrosis.svg"), path.join(DATA_DIR, "uploads", "teach-apoptosis-necrosis.svg")];
        for (const src of srcCandidates) { try { if (fs.existsSync(src)) { fs.copyFileSync(src, dest); break; } } catch {} }
        if (!fs.existsSync(dest)) {
          // fallback: create a 1x1 png placeholder
          try { fs.writeFileSync(dest, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64")); } catch {}
        }
      }
    } catch {}
    ensureUniversity();
    ensureUsers();
    // Ensure the 12-card histology demo exists; create any missing ids 172-183
    const all = cardData();
    for (const c of all) {
      const has = db.prepare("SELECT id FROM flashcards WHERE id=?").get(c.id);
      if (!has) {
        try {
          db.prepare("INSERT INTO flashcards (id, data_json, university_id, active, difficulty, version, created_at, updated_at, content_updated_at, revision, created_by, last_editor_id, last_action) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .run(c.id, JSON.stringify(c.data), ARAK_ID, 1, "medium", 1, new Date().toISOString(), new Date().toISOString(), new Date().toISOString(), 1, 27, 27, "created");
        } catch {}
      }
    }
    // Also ensure histology cards are available for the main Arak university (13) — tenant isolation requires copies under 13 so Arak students see the bank
    try {
      const mainArak = db.prepare("SELECT id FROM universities WHERE code='ARAK'").get()?.id || 13;
      if (mainArak && mainArak !== ARAK_ID) {
        // Check by title to avoid duplicates
        const titles13 = new Set(db.prepare("SELECT data_json FROM flashcards WHERE university_id=?").all(mainArak).map(r=>{ try{return JSON.parse(r.data_json).title_fa;}catch{return ""}}));
        for (const c of all) {
          let d = c.data;
          if (titles13.has(d.title_fa)) continue;
          // clone to main Arak with new id
          try { db.prepare("INSERT INTO flashcards (data_json, university_id, active, difficulty, version, created_at, updated_at, content_updated_at, revision, created_by, last_editor_id, last_action) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .run(JSON.stringify(d), mainArak, 1, "medium", 1, new Date().toISOString(), new Date().toISOString(), new Date().toISOString(), 1, 27, 27, "created"); } catch {}
          titles13.add(d.title_fa);
        }
        // Case provisioning is explicit; never recreate deleted/edited cases at boot.

      }
    } catch {}

    const cnt = db.prepare("SELECT COUNT(*) c FROM flashcards WHERE university_id=? AND active=1").get(ARAK_ID).c;
    const q1 = db.prepare("SELECT id, data_json FROM flashcards WHERE id=172").get();
    if (q1) {
      const d = JSON.parse(q1.data_json);
      if (d.type !== "stepwise" || !Array.isArray(d.steps) || d.steps.length !== 3) {
        const wanted = cardData().find(c=>c.id===172).data;
        // preserve imageUrl if missing
        if (!wanted.imageUrl) wanted.imageUrl = d.imageUrl;
        if (!wanted.media) wanted.media = d.media;
        db.prepare("UPDATE flashcards SET data_json=?, updated_at=datetime('now'), content_updated_at=datetime('now'), revision=COALESCE(revision,1)+1, university_id=?, last_editor_id=?, last_action='edited' WHERE id=?").run(JSON.stringify(wanted), ARAK_ID, ARAK_ID, 172);
      } else {
        // ensure reference present for future
        const d2 = JSON.parse(q1.data_json);
        if (!d2.micro?.reference) {
          d2.micro = d2.micro || {};
          d2.micro.reference = { book_fa:"جان‌کوئرا - بافت‌شناسی پایه", book_en:"Junqueira's Basic Histology", chapter_fa:"فصل بافت پوششی", chapter_en:"Chapter: Epithelial Tissue", edition:"15e", url:"https://accessmedicine.mhmedical.com/book.aspx?bookid=2430", page:"۵۵-۷۲", short_fa:"Junqueira 15e", short_en:"Junqueira 15e" };
          db.prepare("UPDATE flashcards SET data_json=? WHERE id=?").run(JSON.stringify(d2), 172);
        }
        if (!d2.media && d2.imageUrl) {
          d2.media = { url:d2.imageUrl, kind:"image", caption_fa:"اپیتلیوم مطبق کاذب مژکدار - نای", caption_en:"Pseudostratified ciliated columnar - trachea" };
          db.prepare("UPDATE flashcards SET data_json=? WHERE id=?").run(JSON.stringify(d2), 172);
        }
      }
    }
    const q12 = db.prepare("SELECT id, data_json FROM flashcards WHERE id=183").get();
    if (q12) {
      const d = JSON.parse(q12.data_json);
      const hints = ["این بافت مخاط نازکی است که سفیدی چشم (صلبیه) و سطح داخلی پلک‌ها را می‌پوشاند و التهاب آن قرمزی چشم می‌دهد","برخلاف اپیدرم که سطح آن سنگ‌فرشی و کراتینه است، سطح این بافت استوانه‌ای بلند با سلول‌های جامی فراوان است؛ لایه‌های عمقی مکعبی‌اند","نام لاتین آن conjunctiva به معنای 'متصل‌کننده' است — پلک را به کره چشم متصل می‌کند"];
      if (!Array.isArray(d.hints_fa) || d.hints_fa.length < 3) {
        d.hints_fa = hints;
        d.hints_en = ["This thin mucosa covers the sclera and inner eyelids; its inflammation causes red eye","Unlike epidermis (flat keratinized top), its surface is tall columnar with many goblet cells; deeper layers are cuboidal","Latin conjunctiva means 'joining' — it joins eyelid to eyeball"];
        db.prepare("UPDATE flashcards SET data_json=? WHERE id=?").run(JSON.stringify(d), 183);
      }
      if (!d.micro?.reference) {
        const dj = JSON.parse(db.prepare("SELECT data_json FROM flashcards WHERE id=183").get().data_json);
        dj.micro = dj.micro || {};
        dj.micro.reference = { book_fa:"جان‌کوئرا - بافت‌شناسی پایه", book_en:"Junqueira's Basic Histology", chapter_fa:"فصل بافت پوششی - ملتحمه", chapter_en:"Chapter: Epithelium - Conjunctiva", edition:"15e", url:"https://accessmedicine.mhmedical.com/book.aspx?bookid=2430", page:"۶۸-۷۰", short_fa:"Junqueira 15e", short_en:"Junqueira 15e" };
        dj.micro.source_fa = dj.micro.source_fa || "جان‌کوئرا - فصل بافت پوششی";
        dj.micro.source_en = dj.micro.source_en || "Junqueira - Epithelium";
        db.prepare("UPDATE flashcards SET data_json=? WHERE id=?").run(JSON.stringify(dj), 183);
      }
    }
    // Ensure all 12 have university_id=120 and active=1 (if they were soft-deleted)
    db.exec("UPDATE flashcards SET university_id=120, active=1 WHERE id BETWEEN 172 AND 183 AND (university_id IS NULL OR university_id<>120 OR active<>1)");
    // If cnt==0 (no Arak cards) but we only patched 172/183, we still need the other 10. In that case, the DB is empty for Arak and we cannot reconstruct without the original payload.
    // As a fallback, if cnt==0 we leave it — the operator should re-run the original setup-arak script. The 2 patched cards already cover the user's explicit correction.
    try { persistNow(); } catch {}
  } catch (e) { console.warn("ensureArakHistology:", e.message); }
}
