/* ================================================================
   seed.js — Populate the database with teacher-authored content.
   Run: npm run seed
   ================================================================ */
import bcrypt from "bcryptjs";
import { db, initDb, initSchema, persistNow } from "./db.js";
import { isoWeekKey } from "./lib/gamify.js";
// Built-in answer catalogs (Histology, Anatomy, …) are seeded as REAL, editable
// rows in the `catalogs` table so they show up — and can be edited — in the admin
// "Catalogs" section instead of being hidden hardcoded lists. Loaded defensively
// (dynamic import + fallback) so seeding never breaks if the client sources are
// absent in a server-only deployment.
let BUILTIN_SUBJECTS = {};
try {
  ({ SUBJECTS: BUILTIN_SUBJECTS } = await import("../../client/src/data/subject-catalog.js"));
} catch {
  BUILTIN_SUBJECTS = {};   // no client sources present → skip built-in catalog seeding
}

await initDb();      // load WASM SQLite engine (top-level await, ESM)
initSchema();

/* SAFETY GUARD — protect real data.
   This seed WIPES the database. If the DB already contains users, refuse to run
   unless the operator explicitly forces it with `--force` or SEED_FORCE=1.
   First run (empty DB) and the test suite (fresh DB) are unaffected. */
const forced = process.argv.includes("--force") || process.env.SEED_FORCE === "1";
// Protect ANY existing content, not just users — a real site accumulates
// flashcards, cases, blog posts, learner progress, etc. If ANY of these tables
// has rows, seeding is blocked (it would DELETE them). This makes accidental
// data loss on upgrade essentially impossible.
const countOf = (t) => { try { return db.prepare(`SELECT COUNT(*) n FROM ${t}`).get()?.n ?? 0; } catch { return 0; } };
const guardTables = ["users", "flashcards", "cases", "blog_posts", "attempts", "learner_profiles", "learner_cards", "courses"];
const existingRows = guardTables.reduce((s, t) => s + countOf(t), 0);
const existingUsers = countOf("users");
if (existingRows > 0 && !forced) {
  console.error("⛔ Database already has data (" + existingUsers + " users, " + existingRows + " content rows). Seeding is BLOCKED to protect it.");
  console.error("   Your users, exams, flashcards, blog posts, progress and everything else are safe.");
  console.error("   To intentionally WIPE everything and re-seed, run:  npm run seed:reset");
  process.exit(0);
}

// Wipe (idempotent seed)
db.pragma("foreign_keys = OFF");
db.exec(`DELETE FROM class_members; DELETE FROM class_cases; DELETE FROM classes;
         DELETE FROM exam_assignments; DELETE FROM attempts; DELETE FROM flashcard_versions;
         DELETE FROM flashcards; DELETE FROM case_versions; DELETE FROM cases; DELETE FROM checklists;
         DELETE FROM prompts; DELETE FROM settings; DELETE FROM users;
         DELETE FROM learner_profiles; DELETE FROM xp_events; DELETE FROM topics;
         DELETE FROM path_nodes; DELETE FROM node_progress; DELETE FROM leagues;
         DELETE FROM league_members; DELETE FROM achievements; DELETE FROM user_achievements; DELETE FROM ads;
         DELETE FROM notifications; DELETE FROM push_subscriptions;
         DELETE FROM challenges; DELETE FROM challenge_results;
         DELETE FROM srs_state; DELETE FROM learner_cards;
         DELETE FROM audit_log; DELETE FROM feature_flags;
         DELETE FROM admin_deleted;
         DELETE FROM follows; DELETE FROM friend_streaks; DELETE FROM friend_quests;
         DELETE FROM feed_events; DELETE FROM feed_highfives;
         DELETE FROM tournament_champions;
         DELETE FROM support_tickets; DELETE FROM support_messages;
         DELETE FROM help_articles;
         DELETE FROM testimonials; DELETE FROM landing_faqs; DELETE FROM trust_badges;
         DELETE FROM srs_review_log;
         DELETE FROM group_packs; DELETE FROM group_orders; DELETE FROM seat_codes;
         DELETE FROM dx_cases; DELETE FROM dx_attempts;
         DELETE FROM referrals; DELETE FROM share_events; DELETE FROM pwa_events;
         DELETE FROM blog_posts; DELETE FROM certificates;
         DELETE FROM user_quests; DELETE FROM daily_chests; DELETE FROM streak_days;
         DELETE FROM card_attempts; DELETE FROM question_stats; DELETE FROM monthly_quests;
         DELETE FROM user_badges; DELETE FROM event_runs; DELETE FROM ad_views;
         DELETE FROM streak_wagers; DELETE FROM user_notes; DELETE FROM study_plans;
         DELETE FROM exam_sims; DELETE FROM course_enrollments; DELETE FROM transactions;
         DELETE FROM community_votes; DELETE FROM community_imports;
         DELETE FROM mastery_badges;
         DELETE FROM class_flashcards; DELETE FROM class_flashcard_attempts;
         DELETE FROM catalogs;
         DELETE FROM sqlite_sequence;`);
  /* Per-participant research data references the users/classes/exams just
     deleted, and `sqlite_sequence` has been reset — so leaving these rows in
     place produces orphaned records whose user_id/class_id now point at
     somebody else. Definitions (questionnaire_forms, research_studies) are
     admin config and are deliberately preserved. */
  db.exec(`DELETE FROM vp_session_events; DELETE FROM vp_sessions;
           DELETE FROM research_events; DELETE FROM questionnaire_responses;
           DELETE FROM research_consents; DELETE FROM exam_participants;
           DELETE FROM exams;`);
db.pragma("foreign_keys = ON");

// ---- Users (password = 'demo' for all) ----
// Students log in with their STUDENT NUMBER as the username.
const hash = bcrypt.hashSync("demo", 8);
const insUser = db.prepare(
  `INSERT INTO users (username,password_hash,name_fa,name_en,student_no,role,status) VALUES (?,?,?,?,?,?,?)`
);
insUser.run("teacher", hash, "دکتر سارا احمدی", "Dr. Sara Ahmadi", null, "teacher", "active");
insUser.run("admin", hash, "مدیر سامانه", "System Admin", null, "admin", "active");
// students: username == student_no
insUser.run("40012345", hash, "علی رضایی", "Ali Rezaei", "40012345", "student", "active");
insUser.run("40067890", hash, "مریم حسینی", "Maryam Hosseini", "40067890", "student", "active");
insUser.run("40099999", hash, "نیما کریمی", "Nima Karimi", "40099999", "student", "inactive");
// A few more demo students so class/exam student pickers show a realistic list
// (and the search box is genuinely useful). All password: demo.
insUser.run("40011223", hash, "زهرا موسوی", "Zahra Mousavi", "40011223", "student", "active");
insUser.run("40022334", hash, "رضا احمدی", "Reza Ahmadi", "40022334", "student", "active");
insUser.run("40033445", hash, "فاطمه رحیمی", "Fatemeh Rahimi", "40033445", "student", "active");
insUser.run("40044556", hash, "امیر صادقی", "Amir Sadeghi", "40044556", "student", "active");
insUser.run("40055667", hash, "سارا نوری", "Sara Nouri", "40055667", "student", "active");
insUser.run("40066778", hash, "حسین کاظمی", "Hossein Kazemi", "40066778", "student", "active");
// mid-level (granular RBAC) demo accounts — added AFTER core users to keep IDs stable
insUser.run("content", hash, "مدیر محتوا", "Content Manager", null, "content_manager", "active");
insUser.run("support", hash, "پشتیبان", "Support Agent", null, "support", "active");

// ---- Checklists ----
const insChecklist = db.prepare(
  `INSERT INTO checklists (id,name_fa,name_en,items_json) VALUES (?,?,?,?)`
);
insChecklist.run(1, "چک‌لیست ACS", "ACS Checklist", JSON.stringify([
  { id: "i1", section: "communication", weight: 2, fa: "معرفی خود به‌عنوان پزشک و کسب رضایت", en: "Introduce self as doctor & obtain consent", keys: ["من دکتر", "من پزشک", "دکتر شما", "پزشک شما", "معرفی", "اجازه هست", "کسب رضایت", "با اجازه", "رضایت دارید", "introduce", "i am dr", "i am doctor", "consent"] },
  { id: "i2", section: "history", weight: 3, fa: "پرسش ماهیت، محل و انتشار درد", en: "Ask pain character, site & radiation", keys: ["انتشار", "بازو", "فشارنده", "تیر کشیدن", "radiat", "arm", "crush"] },
  { id: "i3", section: "history", weight: 2, fa: "پرسش عوامل خطر قلبی (دیابت، فشار، چربی، سیگار)", en: "Ask cardiac risk factors (DM, HTN, smoking, family)", keys: ["دیابت", "فشار خون", "سیگار", "سابقه قلبی", "diabet", "smok", "hypertens", "cardiac history"] },
  { id: "i_ros", section: "history", weight: 2, fa: "مرور سیستم‌ها (ROS: تنگی‌نفس، تعریق سرد، تهوع، تپش قلب)", en: "Review of systems (ROS: dyspnea, cold sweat, nausea, palpitation)", keys: ["مرور سیستم", "ros", "تنگی نفس", "تعریق", "عرق سرد", "تهوع", "تپش", "dyspnea", "sweat", "nausea", "palpitation"] },
  { id: "i_exam", section: "exam", weight: 2, fa: "معاینه فیزیکی و علائم حیاتی (فشار خون، نبض، سمع قلب و ریه)", en: "Physical exam & vitals (BP, pulse, auscultation)", keys: ["معاینه", "علائم حیاتی", "فشار خون", "سمع", "نبض", "vitals", "physical exam", "auscultat", "bp", "pulse"] },
  { id: "i4", section: "workup", weight: 3, fa: "درخواست نوار قلب (ECG)", en: "Order ECG", keys: ["ecg", "نوار قلب", "الکتروکاردیو", "ekg"] },
  { id: "i5", section: "workup", weight: 3, fa: "درخواست تروپونین و بیومارکرهای قلبی", en: "Order troponin & cardiac biomarkers", keys: ["troponin", "تروپونین", "ck-mb", "بیومارکر"] },
  { id: "i6", section: "diagnosis", weight: 4, fa: "تشخیص صحیح STEMI / ACS", en: "Correct STEMI/ACS diagnosis", keys: ["stemi", "انفارکتوس", "سکته قلبی", "acs", "myocardial"] },
  { id: "i7", section: "management", weight: 3, fa: "بیان برنامه درمان اولیه (آسپرین، نیترات، ارجاع برای آنژیوگرافی/PCI)", en: "State initial management (Aspirin, nitrate, cath lab/PCI)", keys: ["aspirin", "آسپرین", "آنژیوگرافی", "pci", "درمان", "treatment", "reperfus"] },
]));
insChecklist.run(2, "چک‌لیست درد شکم", "Abdominal Pain Checklist", JSON.stringify([
  { id: "i1", section: "communication", weight: 2, fa: "معرفی خود به‌عنوان پزشک و کسب رضایت", en: "Introduce self as doctor & obtain consent", keys: ["من دکتر", "من پزشک", "دکتر شما", "پزشک شما", "معرفی", "اجازه هست", "کسب رضایت", "با اجازه", "رضایت دارید", "introduce", "i am dr", "i am doctor", "consent"] },
  { id: "i2", section: "history", weight: 3, fa: "شرح‌حال درد، محل و ارتباط با مصرف غذای چرب", en: "Pain history, site & relation to fatty meals", keys: ["غذا", "چرب", "کجا", "کیفیت درد", "meal", "fatty", "pain"] },
  { id: "i3", section: "history", weight: 2, fa: "پرسش تهوع، استفراغ و تب", en: "Ask nausea/vomiting & fever", keys: ["تهوع", "استفراغ", "تب", "nausea", "vomit", "fever"] },
  { id: "i_ros", section: "history", weight: 2, fa: "مرور سیستم‌ها (ROS: وضعیت ادرار، ایکتر/زردی، تغییر رنگ مدفوع)", en: "Review of systems (ROS: jaundice, urinary, acholic stool)", keys: ["مرور سیستم", "ros", "زردی", "ادرار", "مدفوع", "jaundice", "stool", "urine"] },
  { id: "i4", section: "exam", weight: 3, fa: "معاینه فیزیکی شکم و بررسی تندرنس یا علامت مورفی", en: "Abdominal physical exam & Murphy's sign / tenderness", keys: ["مورفی", "murphy", "معاینه شکم", "تندرنس", "لمس", "tenderness", "palpat"] },
  { id: "i5", section: "workup", weight: 4, fa: "درخواست سونوگرافی شکم و کبد/کیسه صفرا", en: "Order abdominal/gallbladder ultrasound", keys: ["سونوگرافی", "سونو", "ultrasound", "sono"] },
  { id: "i6", section: "diagnosis", weight: 4, fa: "تشخیص کوله‌سیستیت حاد", en: "Diagnose acute cholecystitis", keys: ["کوله سیستیت", "کوله‌سیستیت", "کیسه صفرا", "cholecystitis", "gallbladder"] },
]));

// ---- Communication & history-taking OSCE checklist (fully editable in admin) ----
// This mirrors the 13-item history-taking rubric; the AI examiner scores each
// row from the whole encounter. Admins can edit/add/remove rows anytime.
insChecklist.run(3, "شرح‌حال‌گیری و مهارت ارتباطی", "History-taking & communication", JSON.stringify([
  { id: "c1", weight: 1, fa: "دانشجو به‌عنوان پزشک خود را به بیمار معرفی کرد.", en: "Introduced self to the patient as the doctor.", keys: ["من دکتر", "من پزشک", "دکتر شما", "پزشک شما", "معرفی", "introduce", "i am dr", "i am doctor"] },
  { id: "c2", weight: 1, fa: "درباره‌ی نام و سن بیمار پرسید.", en: "Asked the patient's name and age.", keys: ["نام","اسم","سن","چند سال","name","age","how old"] },
  { id: "c3", weight: 1, fa: "درباره‌ی سابقه‌ی بیماری خاص پرسید.", en: "Asked about significant past medical history.", keys: ["سابقه","بیماری قبلی","past history","pmh","medical history"] },
  { id: "c4", weight: 1, fa: "پرسش‌ها واضح، منظم و با زبان ساده و قابل‌فهم برای بیمار عادی بود.", en: "Questions were clear, organized and in plain, patient-friendly language.", keys: [] },
  { id: "c5", weight: 1, fa: "از سؤالات باز (Open-ended) استفاده کرد و اجازه‌ی صحبت آزادانه به بیمار داد.", en: "Used open-ended questions and let the patient speak freely.", keys: ["open","بگویید","توضیح","تعریف کنید"] },
  { id: "c6", weight: 2, fa: "درباره‌ی شکایت اصلی (Chief Complaint) دقیق و کامل پرسید.", en: "Asked about the chief complaint accurately and completely.", keys: ["شکایت","مشکل","چه شده","chief complaint","complaint"] },
  { id: "c7", weight: 2, fa: "شکایت اصلی را سیستماتیک بررسی کرد (محل، شدت، زمان شروع، عوامل تشدید/تسکین و ...).", en: "Explored the complaint systematically (site, severity, onset, aggravating/relieving factors…).", keys: ["محل","شدت","زمان","شروع","تشدید","تسکین","onset","severity","radiat","site","duration"] },
  { id: "c8", weight: 1, fa: "درباره‌ی سابقه‌ی دارویی فعلی و آلرژی دارویی پرسید.", en: "Asked about current medications and drug allergies.", keys: ["دارو","مصرف","آلرژی","حساسیت","medication","drug","allergy"] },
  { id: "c9", weight: 1, fa: "درباره‌ی سابقه‌ی بیماری‌های خانوادگی پرسید.", en: "Asked about family history of disease.", keys: ["خانواده","ارثی","family","hereditary"] },
  { id: "c10", weight: 1, fa: "درباره‌ی مصرف سیگار، الکل و مواد مخدر پرسید.", en: "Asked about smoking, alcohol and drug use.", keys: ["سیگار","الکل","مواد","اعتیاد","smok","alcohol","drug use"] },
  { id: "c11", weight: 1, fa: "درباره‌ی قدم بعدی (مثلاً معاینه‌ی فیزیکی یا آزمایش) به بیمار توضیح داد.", en: "Explained the next step (e.g. physical exam or tests) to the patient.", keys: ["معاینه","آزمایش","قدم بعد","exam","test","next step"] },
  { id: "c12", weight: 1, fa: "رفتار کلی دانشجو باعث شد بیمار احساس راحتی و احترام کند.", en: "Overall conduct made the patient feel comfortable and respected.", keys: ["ممنون","لطفا","خواهش","راحت","احترام","thank","please"] },
  { id: "c13", weight: 2, fa: "امتیاز کلی مهارت ارتباطی و شرح‌حال‌گیری دانشجو.", en: "Overall communication & history-taking skill.", keys: [] },
]));

// ---- Cases ----
const insCase = db.prepare(
  `INSERT INTO cases (id,version,difficulty,checklist_id,data_json,active) VALUES (?,?,?,?,?,1)`
);
insCase.run(1, 3, "medium", 1, JSON.stringify({
  title_fa: "درد قفسه سینه در مرد ۵۸ ساله", title_en: "Chest pain in a 58-year-old man",
  specialty_fa: "قلب و عروق", specialty_en: "Cardiology", age: 58, sex: "male",
  chief_fa: "درد فشارنده قفسه سینه از ۲ ساعت پیش", chief_en: "Crushing chest pain for 2 hours",
  history_fa: "درد از ۲ ساعت پیش هنگام فعالیت شروع شده، فشارنده و با انتشار به بازوی چپ و فک، همراه با تعریق و تهوع، با استراحت بهبود نمی‌یابد.",
  history_en: "Pain started 2 hours ago on exertion, crushing, radiating to left arm and jaw, with sweating and nausea, not relieved by rest.",
  pmh_fa: "فشار خون بالا، دیابت نوع ۲", pmh_en: "Hypertension, type 2 diabetes",
  meds_fa: "متفورمین، لوزارتان", meds_en: "Metformin, Losartan",
  allergies_fa: "ندارد", allergies_en: "None",
  family_fa: "پدر در ۶۰ سالگی سکته قلبی داشته", family_en: "Father had MI at age 60",
  exam_fa: "مضطرب و رنگ‌پریده، تعریق سرد، صداهای قلبی طبیعی، ریه پاک", exam_en: "Anxious, pale, cold sweat, normal heart sounds, clear lungs",
  vitals: { bp: "150/95", hr: "98", rr: "20", temp: "36.8", spo2: "96%" },
  labs_fa: "تروپونین بالا (۰٫۹)، CK-MB بالا", labs_en: "Elevated troponin (0.9), elevated CK-MB",
  imaging_fa: "ECG: صعود ST در لیدهای II, III, aVF", imaging_en: "ECG: ST elevation in II, III, aVF",
  // Structured results the student can ORDER during the exam. If they order
  // something not listed here, they're told it's normal (per the lab).
  labResults: [
    { name_fa: "تروپونین", name_en: "Troponin", aliases: ["troponin", "trop"], result_fa: "بالا — ۰٫۹ (طبیعی <۰٫۰۴)", result_en: "Elevated — 0.9 (normal <0.04)" },
    { name_fa: "CK-MB", name_en: "CK-MB", aliases: ["ckmb"], result_fa: "بالا", result_en: "Elevated" },
    { name_fa: "قند خون", name_en: "Blood glucose", aliases: ["glucose", "bs", "fbs"], result_fa: "۱۸۵ mg/dL", result_en: "185 mg/dL" },
  ],
  imagingResults: [
    { name_fa: "نوار قلب", name_en: "ECG", aliases: ["ecg", "ekg", "electrocardiogram"], result_fa: "صعود قطعه ST در لیدهای II، III، aVF", result_en: "ST elevation in leads II, III, aVF", imageUrl: "/uploads/demo-ecg.svg" },
    { name_fa: "عکس قفسه سینه", name_en: "Chest X-ray", aliases: ["cxr", "chest xray"], result_fa: "طبیعی، بدون احتقان", result_en: "Normal, no congestion" },
  ],
  images: [
    { url: "/uploads/demo-ecg.svg", label_fa: "نوار قلب — صعود قطعه ST", label_en: "ECG — ST elevation" },
  ],
  problem_list_fa: "درد قفسهٔ سینهٔ حاد (مشکوک به ACS)\nدیابت نوع ۲\nفشار خون بالا",
  problem_list_en: "Acute chest pain (concerning for ACS)\nType 2 diabetes\nHypertension",
  diagnosis_fa: "انفارکتوس حاد میوکارد تحتانی (STEMI)", diagnosis_en: "Acute inferior STEMI",
  objectives_fa: "شناخت ACS، درخواست به‌موقع ECG و تروپونین، شروع درمان اولیه",
  objectives_en: "Recognize ACS, timely ECG & troponin, initiate acute management",
  allowedResponses_fa: "بیمار مؤدب اما مضطرب پاسخ می‌دهد و فقط اطلاعات پرونده را می‌گوید.",
  allowedResponses_en: "Patient answers politely but anxiously, only sharing chart info.",
}));
insCase.run(2, 1, "hard", 2, JSON.stringify({
  title_fa: "درد شکم در زن ۳۴ ساله", title_en: "Abdominal pain in a 34-year-old woman",
  specialty_fa: "گوارش", specialty_en: "Gastroenterology", age: 34, sex: "female",
  chief_fa: "درد ربع فوقانی راست شکم از دیشب", chief_en: "Right upper quadrant pain since last night",
  history_fa: "درد پس از غذای چرب شروع شده، به شانه راست انتشار دارد، همراه با تهوع و استفراغ.",
  history_en: "Pain started after a fatty meal, radiates to right shoulder, with nausea and vomiting.",
  pmh_fa: "ندارد", pmh_en: "None", meds_fa: "قرص ضدبارداری", meds_en: "Oral contraceptive",
  allergies_fa: "پنی‌سیلین", allergies_en: "Penicillin",
  family_fa: "مادر سنگ کیسه صفرا داشته", family_en: "Mother had gallstones",
  exam_fa: "تندرنس ربع فوقانی راست، علامت مورفی مثبت", exam_en: "RUQ tenderness, positive Murphy's sign",
  vitals: { bp: "125/80", hr: "92", rr: "18", temp: "38.1", spo2: "98%" },
  labs_fa: "لکوسیتوز، بیلی‌روبین کمی بالا", labs_en: "Leukocytosis, mildly elevated bilirubin",
  imaging_fa: "سونوگرافی: سنگ و ضخیم‌شدگی دیواره کیسه صفرا", imaging_en: "Ultrasound: gallstones and wall thickening",
  labResults: [
    { name_fa: "شمارش کامل خون", name_en: "CBC", aliases: ["cbc", "wbc", "لکوسیت"], result_fa: "لکوسیتوز (WBC ۱۴٬۰۰۰)", result_en: "Leukocytosis (WBC 14,000)" },
    { name_fa: "بیلی‌روبین", name_en: "Bilirubin", aliases: ["bilirubin", "bili"], result_fa: "کمی بالا", result_en: "Mildly elevated" },
  ],
  imagingResults: [
    { name_fa: "سونوگرافی شکم", name_en: "Abdominal ultrasound", aliases: ["ultrasound", "us", "سونو"], result_fa: "سنگ کیسه صفرا و ضخیم‌شدگی دیواره", result_en: "Gallstones and wall thickening" },
  ],
  problem_list_fa: "درد حاد ربع فوقانی راست شکم (مشکوک به کوله‌سیستیت)\nتب ۳۸٫۱ درجه",
  problem_list_en: "Acute RUQ pain (concerning for cholecystitis)\nFever (38.1°C)",
  diagnosis_fa: "کوله‌سیستیت حاد", diagnosis_en: "Acute cholecystitis",
  objectives_fa: "افتراق درد RUQ، علامت مورفی، درخواست سونوگرافی",
  objectives_en: "Work up RUQ pain, Murphy's sign, order ultrasound",
  allowedResponses_fa: "بیمار با ناراحتی پاسخ می‌دهد و فقط اطلاعات پرونده را بیان می‌کند.",
  allowedResponses_en: "Patient answers uncomfortably, sharing only chart data.",
}));


insCase.run(3, 1, "medium", 1, JSON.stringify({
  track: "learn",
  title_fa: "تنگی نفس در مرد ۴۵ ساله (مسیر رقابتی)", title_en: "Dyspnea in a 45-year-old man (competitive track)",
  specialty_fa: "قلب و عروق", specialty_en: "Cardiology", age: 45, sex: "male",
  chief_fa: "تنگی نفس ناگهانی از یک ساعت پیش", chief_en: "Sudden shortness of breath for one hour",
  history_fa: "تنگی نفس ناگهانی در حال نشستن، بدون درد قفسه سینه واضح، سابقه سفر طولانی هفته گذشته.",
  history_en: "Sudden dyspnea at rest, no clear chest pain, long-haul travel last week.",
  pmh_fa: "ندارد", pmh_en: "None", meds_fa: "ندارد", meds_en: "None",
  allergies_fa: "ندارد", allergies_en: "None",
  exam_fa: "تاکی‌پنه، ریه راست کاهش صدا", exam_en: "Tachypnea, reduced breath sounds on the right",
  vitals: { bp: "110/70", hr: "110", rr: "28", temp: "37.0", spo2: "89%" },
  diagnosis_fa: "آمبولی ریه", diagnosis_en: "Pulmonary embolism",
  labResults: [
    { name_fa: "دی‌دایمر", name_en: "D-dimer", aliases: ["ddimer"], result_fa: "بالا", result_en: "Elevated" },
  ],
  imagingResults: [
    { name_fa: "سی‌تی آنژیو ریه", name_en: "CT pulmonary angiogram", aliases: ["ctpa"], result_fa: "ترومبوز شریان ریوی", result_en: "Pulmonary artery thrombus" },
  ],
  objectives_fa: "شک به آمبولی ریه و درخواست دی‌دایمر و CTPA",
  objectives_en: "Suspect PE and order D-dimer and CTPA",
}));

// ---- Flashcards (MULTIPLE CHOICE + progressive hints) ----
const insCard = db.prepare(
  `INSERT INTO flashcards (id,version,difficulty,data_json,active) VALUES (?,?,?,?,1)`
);
// ---- Comprehensive histology tissue list (FA + EN) shown in the search box ----
const TISSUES = [
  // Epithelial
  { fa: "اپیتلیوم سنگفرشی ساده", en: "Simple squamous epithelium" },
  { fa: "اپیتلیوم مکعبی ساده", en: "Simple cuboidal epithelium" },
  { fa: "اپیتلیوم استوانه‌ای ساده", en: "Simple columnar epithelium" },
  { fa: "اپیتلیوم سنگفرشی مطبق", en: "Stratified squamous epithelium" },
  { fa: "اپیتلیوم مکعبی مطبق", en: "Stratified cuboidal epithelium" },
  { fa: "اپیتلیوم استوانه‌ای مطبق", en: "Stratified columnar epithelium" },
  { fa: "اپیتلیوم مطبق کاذب مژک‌دار", en: "Pseudostratified ciliated columnar epithelium" },
  { fa: "اپیتلیوم انتقالی (یوروتلیوم)", en: "Transitional epithelium (urothelium)" },
  // Connective
  { fa: "بافت همبند سست", en: "Loose (areolar) connective tissue" },
  { fa: "بافت همبند متراکم منظم", en: "Dense regular connective tissue" },
  { fa: "بافت همبند متراکم نامنظم", en: "Dense irregular connective tissue" },
  { fa: "بافت چربی", en: "Adipose tissue" },
  { fa: "بافت رتیکولر", en: "Reticular tissue" },
  { fa: "تاندون", en: "Tendon" },
  { fa: "غضروف هیالن", en: "Hyaline cartilage" },
  { fa: "غضروف الاستیک", en: "Elastic cartilage" },
  { fa: "فیبروکارتیلاژ", en: "Fibrocartilage" },
  { fa: "استخوان فشرده", en: "Compact bone" },
  { fa: "استخوان اسفنجی", en: "Spongy bone" },
  // Muscle
  { fa: "عضله اسکلتی", en: "Skeletal muscle" },
  { fa: "عضله قلبی", en: "Cardiac muscle" },
  { fa: "عضله صاف", en: "Smooth muscle" },
  // Nervous & blood
  { fa: "بافت عصبی", en: "Nervous tissue" },
  { fa: "خون", en: "Blood" },
  // Other epithelial-derived
  { fa: "غده اگزوکرین", en: "Exocrine gland" },
  { fa: "غده اندوکرین", en: "Endocrine gland" },
];
// Build a full options list for a histology card, marking `correctEn` as correct.
function tissueOptions(correctEn) {
  return TISSUES.map((tis) => ({ ...tis, correct: tis.en === correctEn }));
}

const cards = [
  {
    id: 1, difficulty: "easy",
    data: {
      course_fa: "بافت‌شناسی", course_en: "Histology",
      category_fa: "بافت پوششی", category_en: "Epithelial tissue",
      title_fa: "این بافت پوششی را شناسایی کنید", title_en: "Identify this epithelial tissue",
      color: "#f7c6c7", imageUrl: "", questionType: "image", answerMode: "search",
      options: tissueOptions("Simple squamous epithelium"),
      hints_fa: ["تک‌لایه است.", "سلول‌ها پهن و صاف‌اند.", "در آلوئول و اندوتلیوم عروق دیده می‌شود."],
      hints_en: ["It is a single layer.", "Cells are flat and thin.", "Found in alveoli and vascular endothelium."],
    },
  },
  {
    id: 2, difficulty: "medium",
    data: {
      course_fa: "بافت‌شناسی", course_en: "Histology",
      category_fa: "بافت همبند", category_en: "Connective tissue",
      title_fa: "این بافت را شناسایی کنید", title_en: "Identify this tissue",
      color: "#bcd7f0", imageUrl: "", questionType: "image", answerMode: "search",
      options: tissueOptions("Hyaline cartilage"),
      hints_fa: ["نوعی غضروف است.", "کندروسیت‌ها در لاکونا قرار دارند.", "ماتریکس شیشه‌ای و آبی کم‌رنگ دارد."],
      hints_en: ["It is a type of cartilage.", "Chondrocytes sit in lacunae.", "Glassy, pale-blue matrix."],
    },
  },
  {
    id: 3, difficulty: "hard",
    data: {
      course_fa: "بافت‌شناسی", course_en: "Histology",
      category_fa: "بافت عضلانی", category_en: "Muscle tissue",
      title_fa: "این بافت عضلانی را شناسایی کنید", title_en: "Identify this muscle tissue",
      color: "#e8c6f0", imageUrl: "", questionType: "image", answerMode: "search",
      options: tissueOptions("Cardiac muscle"),
      hints_fa: ["مخطط اما غیرارادی است.", "دارای صفحات بینابینی (intercalated discs) است.", "سلول‌ها منشعب و تک‌هسته‌ای هستند."],
      hints_en: ["Striated but involuntary.", "Has intercalated discs.", "Cells are branched and mononucleate."],
    },
  },
  {
    id: 4, difficulty: "medium",
    data: {
      course_fa: "فارماکولوژی", course_en: "Pharmacology",
      category_fa: "داروشناسی قلبی", category_en: "Cardiac pharmacology",
      title_fa: "پرسش متنی", title_en: "Text question",
      questionType: "text", answerMode: "search", color: "#c9f0d8",
      questionText_fa: "خط اول درمان دارویی در بیمار مبتلا به STEMI کدام دارو است که باید بلافاصله تجویز شود؟",
      questionText_en: "Which drug is the first-line agent to give immediately in a patient with STEMI?",
      options: [
        { fa: "آسپرین", en: "Aspirin", correct: true },
        { fa: "وارفارین", en: "Warfarin", correct: false },
        { fa: "متوپرولول", en: "Metoprolol", correct: false },
        { fa: "فوروزماید", en: "Furosemide", correct: false },
        { fa: "دیگوکسین", en: "Digoxin", correct: false },
        { fa: "آتورواستاتین", en: "Atorvastatin", correct: false },
      ],
      hints_fa: ["یک داروی ضدپلاکتی است.", "باید جویده شود تا سریع‌تر جذب شود.", "دوز اولیه ۳۲۵ میلی‌گرم است."],
      hints_en: ["It is an antiplatelet agent.", "It should be chewed for faster absorption.", "Initial dose is 325 mg."],
    },
  },
];
for (const c of cards) insCard.run(c.id, 1, c.difficulty, JSON.stringify({ track: "uni", ...c.data }));

// ---- Prompts ----
const insPrompt = db.prepare(`INSERT INTO prompts (key,value) VALUES (?,?)`);
const prompts = {
  patient_fa: "تو نقش یک بیمار مجازی واقعی را ایفا می‌کنی که به پزشک مراجعه کرده است. تمام پاسخ‌هایت باید بر اساس «پروندهٔ بیمار» (JSON) باشد. اصل اساسی: اطلاعات را ذره‌ذره (قطره‌چکانی) و دقیقاً در حد همان سؤالی که پزشک پرسیده ارائه بده و از ارائه اطلاعات اضافه یا پیش‌دستانه اکیداً خودداری کن. مثلاً اگر پرسید «مشکل شما چیست؟»، فقط شکایت اصلی را در یک جمله بگو (مثلاً «شکمم درد می‌کنه آقای دکتر»)؛ توضیحات اضافه مثل محل دقیق، انتشار درد، شدت، زمان شروع، عوامل تشدید یا تسکین، علائم همراه و سوابق را فقط و فقط وقتی بازگو کن که پزشک اختصاصاً درباره همان مورد سؤال بپرسد. زبان عامیانه و پاسخ‌های کوتاه (۱ تا ۲ جمله).",
  patient_en: "You play a realistic virtual patient who has come to see a doctor. Answer ONLY from the PATIENT CHART (JSON). Core rule: Disclose information strictly bit by bit, answering ONLY what the doctor explicitly asked. If asked 'What is your problem?' or 'What brings you here?', answer ONLY with the chief complaint in a brief sentence (e.g. 'My stomach hurts, doctor'). Do NOT volunteer pain radiation, onset, severity, relieving/aggravating factors, associated symptoms, or history unless specifically asked for that exact item. Natural patient tone, brief 1-2 sentences.",
  // Operating rules for the patient (fully editable by the admin — previously
  // these were hard-coded inside the engine and could NOT be changed):
  patient_rules_fa: "قوانین: ۱) اطلاعات را ذره‌ذره و متناسب با سؤال پزشک ارائه کن و هرگز بدون پرسش پزشک اطلاعاتی مثل انتشار درد، زمان شروع، شدت یا علائم همراه را فاش نکن. ۲) پاسخ‌ها را فقط از روی پروندهٔ بیمار استخراج کن و هیچ حقیقت پزشکیِ جدیدی از خودت نساز. ۳) اگر پزشک چیزی پرسید که در پرونده نیست، پاسخ منفی یا طبیعی بده (مثلاً «نه، سیگار نمی‌کشم»). ۴) هرگز تشخیص نهایی، نتیجهٔ آزمایش/تصویربرداری یا یافته‌های معاینهٔ فیزیکی را لو نده (معاینه را استاد انجام می‌دهد). ۵) اول‌شخص و از زبان بیمار عادی، کوتاه (۱ تا ۲ جمله) و طبیعی پاسخ بده.",
  patient_rules_en: "Rules: 1) Disclose information strictly bit by bit as asked; never volunteer pain radiation, onset, severity, or associated symptoms unprompted. 2) Draw answers ONLY from the chart and never invent new facts. 3) If asked about something unrecorded, give a plausible negative/normal reply. 4) Never reveal the final diagnosis, lab/imaging results, or physical exam findings (the supervising teacher performs exams). 5) Reply in the first person as an ordinary patient, briefly (1-2 sentences) and naturally.",
  // Role prompt for the SUPERVISING-TEACHER responder (exam findings &
  // auscultation). The engine always appends its hard constraints on top.
  exam_teacher_fa: "تو استادِ نظارت (attending) هستی. دانشجو از تو خواسته معاینهٔ بیمار مجازی را انجام دهی و یافته‌ها را به او بگویی.",
  exam_teacher_en: "You are the supervising attending. The student has asked you to examine the virtual patient and report the findings.",
  // Rules for how the lab/radiology responder words a result (used when the AI
  // generates a normal-result report). Also admin-editable:
  labresult_rules_fa: "تو گزارش‌دهندهٔ آزمایشگاه/رادیولوژی هستی. لحن رسمی و کوتاه. فقط یک جمله بنویس.",
  labresult_rules_en: "You are the lab/radiology reporter. Formal, short tone. Write only one sentence.",
  // Deterministic fallback template for a NORMAL result (no AI). Use {item}.
  lab_normal_fa: "طبق گزارش آزمایشگاه، {item} بیمار نرمال است.",
  lab_normal_en: "Per the lab report, the patient's {item} is normal.",
  evaluator_fa: "تو یک استادِ ارزیابِ بالینی و مصحح سخت‌گیر و عادل OSCE هستی. کل تعامل دانشجو با بیمار مجازی را بررسی کن: متن گفتگو، آزمایش‌ها/تصویربرداری‌ها، پرابلم لیست، تشخیص‌های افتراقی و تشخیص نهایی. قوانین ارزیابی چک‌لیست: ۱) معرفی خود و کسب رضایت: دانشجو باید صراحتاً نام یا عنوان خود را به‌عنوان پزشک بیان کرده باشد و از بیمار اجازه/رضایت گرفته باشد؛ صرف گفتن «سلام» یا پرسیدن «مشکل چیست؟» به هیچ وجه معرفی و کسب رضایت نیست (done: false). ۲) بررسی سیستماتیک شکایت اصلی و مرور سیستم‌ها (ROS): تنها در صورتی تیک می‌خورد که دانشجو ویژگی‌های علامت و ارگان‌های دیگر را صریحاً پرسیده باشد. ۳) برای هر مورد یک دلیل کوتاه بنویس و خروجی را با فرمت معتبر JSON ارائه بده.",
  evaluator_en: "You are a strict, fair clinical OSCE examiner. Review the student encounter: chat transcript, orders, problem list, differentials, and final diagnosis. Rules: 1) Introduction & consent: The student MUST have explicitly stated their name/role as doctor and asked for consent; merely saying 'hello' or 'what is your problem' is NOT introduction or consent (done: false). 2) Systematic exploration & ROS: Only mark done if the student specifically asked about characteristics and organ systems. 3) Provide a brief reason per item and return valid JSON.",
  micro_fa: "بر اساس نقاط ضعف و خطاهای این دانشجو در این سناریو، یک درسنامه میکرو-لرنینگِ کاربردی، ساختاریافته و جامع (شامل پیام کلیدی، رویکرد شرح‌حال، معاینه فیزیکی و مرور سیستم‌ها ROS، نکات دام‌دار، و جمع‌بندی طلایی) در قالب مارک‌داون بنویس تا دانشجو بلافاصله پس از مشاهده نمره، آن را بخواند و یاد بگیرد.",
  micro_en: "Based on the student's weaknesses and mistakes in this encounter, write a structured, practical clinical micro-learning lesson (covering core concept, H&P + ROS approach, common pitfalls, and golden takeaway) in markdown.",
};
for (const [k, v] of Object.entries(prompts)) insPrompt.run(k, v);

// ---- Settings ----
const insSetting = db.prepare(`INSERT INTO settings (key,value) VALUES (?,?)`);
insSetting.run("exam", JSON.stringify({
  duration: 15, maxAttempts: 3, showCorrect: true, showHints: true,
  showAiAnalysis: true, showMicro: true, examLang: "both",
}));
insSetting.run("ai", JSON.stringify({
  provider: process.env.AI_PROVIDER || "GapGPT", model: process.env.AI_MODEL || "gpt-4o-mini",
  apiKey: (process.env.NODE_ENV === "test" || process.env.VITEST) ? "" : (process.env.AI_API_KEY || ""),
  baseUrl: process.env.AI_BASE_URL || "https://api.gapgpt.app/v1", connected: false,
}));
insSetting.run("ai_vpatient", JSON.stringify({
  provider: process.env.AI_PROVIDER || "GapGPT", model: process.env.AI_MODEL || "gpt-4o-mini",
  apiKey: (process.env.NODE_ENV === "test" || process.env.VITEST) ? "" : (process.env.AI_API_KEY || ""),
  baseUrl: process.env.AI_BASE_URL || "https://api.gapgpt.app/v1", connected: false,
}));

// ---- A few sample attempts for the research dashboard ----
const insAttempt = db.prepare(
  `INSERT INTO attempts (user_id,type,case_id,content_version,score,turns,tests,hints,duration_sec,lang,created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?)`
);
insAttempt.run(3, "vp", 1, 3, 78, 14, 3, 0, 540, "fa", "2026-06-28 10:12:00");
insAttempt.run(4, "vp", 2, 1, 91, 18, 4, 0, 610, "fa", "2026-06-30 09:40:00");
insAttempt.run(3, "flash", null, 1, 66, 0, 0, 5, 300, "fa", "2026-07-01 14:05:00");

// ---- Exam assignments (admin grants access to specific cases) ----
// Ali (id 3) may take case 1; Maryam (id 4) may take cases 1 & 2.
const insAssign = db.prepare(
  `INSERT OR IGNORE INTO exam_assignments (user_id,case_id,assigned_by,max_attempts) VALUES (?,?,?,?)`
);
insAssign.run(3, 1, 2, 3);      // Ali -> Chest pain
insAssign.run(4, 1, 2, 3);      // Maryam -> Chest pain
insAssign.run(4, 2, 2, 2);      // Maryam -> Abdominal pain

// ---- Classrooms ----
const insClass = db.prepare(
  `INSERT INTO classes (id,name_fa,name_en,desc_fa,desc_en,code,owner_id,max_attempts) VALUES (?,?,?,?,?,?,?,?)`
);
insClass.run(1, "طب داخلی — نیمسال ۱", "Internal Medicine — Sem 1",
  "کیس‌های بالینی طب داخلی برای ارزیابی مهارت‌های تشخیصی.",
  "Clinical internal-medicine cases for diagnostic-skills assessment.",
  "MED-1024", 1, 2);
try { db.prepare("UPDATE classes SET log_transcript=1 WHERE id=1").run(); } catch { /* column may not exist yet on very old schemas */ }
const insClassCase = db.prepare(`INSERT INTO class_cases (class_id,case_id,weight) VALUES (?,?,?)`);
insClassCase.run(1, 1, 2);  // chest pain, weight 2
insClassCase.run(1, 2, 1);  // abdominal pain, weight 1
const insMember = db.prepare(`INSERT INTO class_members (class_id,user_id) VALUES (?,?)`);
insMember.run(1, 3);  // Ali
insMember.run(1, 4);  // Maryam

// ---- Built-in answer catalogs (now real, editable rows) ----
// The admin can rename, edit items, or delete these from the Catalogs section.
const insCatalog = db.prepare(
  `INSERT INTO catalogs (name_fa,name_en,items_json,owner_id) VALUES (?,?,?,1)`
);
for (const key of Object.keys(BUILTIN_SUBJECTS)) {
  const s = BUILTIN_SUBJECTS[key];
  insCatalog.run(s.fa, s.en, JSON.stringify(s.list));
}

/* =====================================================================
   GAMIFIED PRE-INTERNSHIP TRACK SEED (role = 'learner')
   ===================================================================== */
import { TOPICS, BASIC_TOPICS, SAMPLE_QUESTIONS } from "./data/preinternship.js";
import { RICH } from "./data/microlearning.js";
import { emojiForTopic } from "./lib/topicemoji.js";

// helper to make a learner MCQ flashcard in the shape learn.js expects
const insLearnCard = db.prepare(
  `INSERT INTO flashcards (id,version,difficulty,data_json,active) VALUES (?,?,?,?,1)`
);
let cardId = 100; // learner cards start at 100 to avoid clashing with the demo cards (1..4)
function makeCard(topicSlug, q, diff = "medium") {
  const id = ++cardId;
  const options = q.options.map(([fa, en, correct, why_fa, why_en], i) => ({
    fa, en, correct: !!correct,
    why_fa: why_fa || q.micro?.options_fa?.[i] || (correct ? `صحیح است؛ ${q.ex_fa || ""}` : `نادرست است؛ گزینه صحیح «${q.options.find(o => o[2])?.[0] || ""}» می‌باشد.`),
    why_en: why_en || q.micro?.options_en?.[i] || (correct ? `Correct; ${q.ex_en || ""}` : `Incorrect; the correct choice is "${q.options.find(o => o[2])?.[1] || ""}".`),
  }));
  const data = {
    course_fa: "پره‌انترنی", course_en: "Pre-internship", topic: topicSlug, track: "learn",
    // Seeded sample content, NOT a real past-exam question. `content_origin`
    // lets the learner-facing routes hide demo cards once real imported
    // questions exist for a subject, and lets admins filter them out.
    content_origin: "demo_seed",
    type: "mcq",
    q_fa: q.q_fa, q_en: q.q_en,
    questionType: "text", answerMode: "choice",
    title_fa: q.q_fa, title_en: q.q_en,
    questionText_fa: q.q_fa, questionText_en: q.q_en,
    options,
    ex_fa: q.ex_fa, ex_en: q.ex_en,
    hints_fa: [q.ex_fa], hints_en: [q.ex_en],
    // attach a comprehensive QB-style micro with per-option analysis
    micro: {
      lead_fa: q.ex_fa, lead_en: q.ex_en,
      golden_fa: q.golden_fa || q.ex_fa, golden_en: q.golden_en || q.ex_en,
      points_fa: q.points_fa || [q.ex_fa], points_en: q.points_en || [q.ex_en],
      options_fa: options.map(o => (o.correct ? `✅ ${o.fa}: ${o.why_fa}` : `❌ ${o.fa}: ${o.why_fa}`)),
      options_en: options.map(o => (o.correct ? `✅ ${o.en}: ${o.why_en}` : `❌ ${o.en}: ${o.why_en}`)),
      source_fa: q.source_fa || "منابع رسمی آزمون پیش‌کارورزی و دستیاری", source_en: q.source_en || "Official Exam Guidelines"
    },
    // optional rich media: question media + answer-key (پاسخنامه) block
    ...(q.media ? { media: q.media } : {}),
    ...(q.explain ? { explain: q.explain } : { explain: { text_fa: q.ex_fa, text_en: q.ex_en } }),
  };
  insLearnCard.run(id, 1, diff, JSON.stringify(data));
  return id;
}

// helper to make a RICH mixed-type flashcard (mcq/truefalse/fill/match/order) with QB micro
function makeRichCard(topicSlug, q) {
  const id = ++cardId;
  const data = { course_fa: "پره‌انترنی", course_en: "Pre-internship", topic: topicSlug, track: "learn", content_origin: "demo_seed", ...q };
  // normalize mcq options to {fa,en,correct,why_fa,why_en}
  if (q.type === "mcq" && Array.isArray(q.options) && Array.isArray(q.options[0])) {
    data.options = q.options.map(([fa, en, correct, why_fa, why_en], i) => ({
      fa, en, correct: !!correct,
      why_fa: why_fa || q.micro?.options_fa?.[i] || "",
      why_en: why_en || q.micro?.options_en?.[i] || "",
    }));
  }
  data.title_fa = q.q_fa; data.title_en = q.q_en;
  data.questionText_fa = q.q_fa; data.questionText_en = q.q_en;
  insLearnCard.run(id, 1, "medium", JSON.stringify(data));
  return id;
}

// topics
const insTopic = db.prepare(
  `INSERT INTO topics (slug,name_fa,name_en,parent,program,budget,color,icon,ord,active) VALUES (?,?,?,?,?,?,?,?,?,1)`
);
const insNode = db.prepare(
  `INSERT INTO path_nodes (topic_id,title_fa,title_en,ord,kind,card_ids,xp_reward,active) VALUES (?,?,?,?,?,?,?,1)`
);

// existing pre-internship topics live in the 'preint' program; basic-science
// topics (added below) live in the 'basic' program (Duolingo-style courses).
const ALL_SEED_TOPICS = [
  ...TOPICS.map((t) => ({ ...t, program: "preint" })),
  ...BASIC_TOPICS.map((t) => ({ ...t, program: "basic" })),
];
ALL_SEED_TOPICS.forEach((t, ti) => {
  const r = insTopic.run(t.slug, t.name_fa, t.name_en, t.parent, t.program, t.budget, t.color, t.icon, ti);
  const topicId = r.lastInsertRowid;
  // seed a relevant default emoji for each subject (admin can override later)
  db.prepare("UPDATE topics SET emoji=? WHERE id=?").run(emojiForTopic(t.slug), topicId);
  const pool = SAMPLE_QUESTIONS[t.slug] || [];
  // build cards for this topic (fallback: reuse GI pool question if empty so path isn't empty)
  const cardIds = pool.map((q, i) => makeCard(t.slug, q, i === 0 ? "easy" : "medium"));
  // add RICH mixed-type cards (fill/match/order/truefalse) with QB-style micro
  const rich = RICH[t.slug] || [];
  const richIds = rich.map((q) => makeRichCard(t.slug, q));
  cardIds.push(...richIds);
  // create lesson nodes: group cards into lessons of up to 3; if fewer cards, still make 3 nodes
  const lessonsWanted = Math.max(3, Math.ceil(cardIds.length / 2));
  for (let n = 0; n < lessonsWanted; n++) {
    // cycle through available cards so every node has content
    const chosen = [];
    const k = Math.min(3, Math.max(1, cardIds.length));
    for (let j = 0; j < k; j++) {
      if (cardIds.length) chosen.push(cardIds[(n * 2 + j) % cardIds.length]);
    }
    const isBoss = n === lessonsWanted - 1;
    insNode.run(
      topicId,
      isBoss ? `آزمون فصل ${t.name_fa}` : `درس ${n + 1} — ${t.name_fa}`,
      isBoss ? `${t.name_en} Checkpoint` : `${t.name_en} — Lesson ${n + 1}`,
      n,
      isBoss ? "boss" : "lesson",
      JSON.stringify(chosen),
      isBoss ? 40 : 20
    );
  }
});

/* Competitive (track=learn) university-type sample: click-on-image hotspot.
   Path demo_seed cards stay on /learn/*; this card is what GET /flashcards
   serves to learners in the Flashcards player. */
{
  const id = ++cardId;
  insLearnCard.run(id, 1, "medium", JSON.stringify({
    track: "learn",
    type: "hotspot",
    course_fa: "قلب و عروق", course_en: "Cardiology",
    category_fa: "نوار قلب", category_en: "ECG",
    title_fa: "صعود ST تحتانی را لمس کنید",
    title_en: "Tap the inferior ST elevation",
    questionText_fa: "روی این نوار قلب، ناحیهٔ صعود قطعهٔ ST در لید تحتانی را لمس کنید.",
    questionText_en: "On this ECG, tap the inferior ST-elevation region.",
    questionType: "image",
    imageUrl: "/uploads/demo-ecg.svg",
    hotspot: {
      label_fa: "صعود ST تحتانی",
      label_en: "Inferior ST elevation",
      confirm: true,
      shape: "polygon",
      regions: [
        { shape: "polygon", points: [
          { x: 8, y: 42 }, { x: 42, y: 42 }, { x: 42, y: 56 }, { x: 8, y: 56 },
        ] },
      ],
    },
    hints_fa: ["لیدهای II، III و aVF تحتانی‌اند.", "صعود ST در این لیدها STEMI تحتانی است."],
    hints_en: ["Leads II, III and aVF are inferior.", "ST elevation there is an inferior STEMI."],
  }));
}

// achievements catalog
const insAch = db.prepare(
  `INSERT INTO achievements (slug,name_fa,name_en,desc_fa,desc_en,icon,metric,threshold,ord) VALUES (?,?,?,?,?,?,?,?,?)`
);
[
  ["first_step", "اولین قدم", "First Step", "اولین درس را کامل کن", "Complete your first lesson", "check", "nodes", 1, 1],
  ["streak_3", "شعله سه‌روزه", "3-Day Flame", "۳ روز پیاپی تمرین کن", "Practice 3 days in a row", "clock", "streak", 3, 2],
  ["streak_7", "هفته طلایی", "Golden Week", "۷ روز پیاپی تمرین کن", "Keep a 7-day streak", "trophy", "streak", 7, 3],
  ["streak_30", "ماراتن ۳۰ روزه", "30-Day Marathon", "۳۰ روز پیاپی تمرین کن", "Reach a 30-day streak", "medal", "streak", 30, 4],
  ["xp_500", "پانصدی", "500 Club", "به ۵۰۰ امتیاز برس", "Earn 500 XP", "chart", "xp", 500, 5],
  ["xp_2000", "دو هزاری", "2K Scholar", "به ۲۰۰۰ امتیاز برس", "Earn 2000 XP", "brain", "xp", 2000, 6],
  ["nodes_10", "ده‌گانه", "Ten Lessons", "۱۰ درس را کامل کن", "Finish 10 lessons", "book", "nodes", 10, 7],
  ["perfect_5", "بی‌نقص", "Flawless", "۵ درس را کامل (۵ ستاره) بزن", "Get 5 perfect lessons", "medal", "perfect", 5, 8],
  ["diamond", "قهرمان الماس", "Diamond Champ", "به لیگ الماس برس", "Reach the Diamond league", "trophy", "league", 1, 9],
  ["legend_1", "افسانه", "Legend", "اولین درس افسانه‌ای را کامل کن", "Earn your first legendary level", "crown", "legend", 1, 10],
  ["legend_10", "افسانهٔ بزرگ", "Grand Legend", "۱۰ درس افسانه‌ای کامل کن", "Reach 10 legendary levels", "crown", "legend", 10, 11],
  ["tourney_1", "قهرمان تورنمنت", "Tournament Champion", "در فینال تورنمنت الماس برنده شو", "Win a Diamond Tournament final", "trophy", "champion", 1, 12],
].forEach((a) => insAch.run(...a));

// sample ads (simulated monetization)
const insAd = db.prepare(
  `INSERT INTO ads (slot,title_fa,title_en,body_fa,body_en,cta_fa,cta_en,url,bg,active) VALUES (?,?,?,?,?,?,?,?,?,1)`
);
insAd.run("home", "کتاب مرجع پره‌انترنی", "Pre-internship Reference", "جدیدترین رفرنس‌های خلاصه‌شده برای آزمون پیش‌کارورزی.", "The latest condensed references for the exam.", "مشاهده", "View", "#", "#2569b0");
insAd.run("path", "دوره جمع‌بندی نکته و تست", "Rapid Review Course", "نکته و تست فشرده همه دروس در دو هفته.", "Intensive review of every subject in two weeks.", "ثبت‌نام", "Enroll", "#", "#22a06b");
insAd.run("between-lessons", "اپلیکیشن فلش‌کارت پزشکی", "Medical Flashcards App", "هزاران فلش‌کارت رایگان برای مرور روزانه.", "Thousands of free flashcards for daily review.", "دانلود", "Download", "#", "#6d5bd0");

// Duolingo-Ads-2026 formats (rewarded video, interstitial, pre-lesson sponsorship)
const insAdF = db.prepare(
  `INSERT INTO ads (slot,title_fa,title_en,body_fa,body_en,cta_fa,cta_en,url,bg,active,format,sponsor,reward_gems,skippable_after,duration_s)
   VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?,?,?)`
);
insAdF.run("reward", "کتابخانهٔ ویدیویی پزشکی", "Medical Video Library", "یک ویدیوی کوتاه تماشا کن و جم جایزه بگیر!", "Watch a short video and earn bonus gems!", "دریافت جایزه", "Get reward", "#", "#8b5cf6", "rewarded", "MedVid", 15, 5, 15);
insAdF.run("reward", "دورهٔ آناتومی تصویری", "Visual Anatomy Course", "با تماشای این ویدیو، جم رایگان بگیر.", "Watch to earn free gems.", "دریافت جایزه", "Get reward", "#", "#0ea5e9", "rewarded", "AnatomyPro", 15, 5, 20);
insAdF.run("between-lessons", "کنکور پزشکی — مؤسسهٔ نمونه", "Med Prep Institute", "کلاس‌های آنلاین جمع‌بندی، همین حالا.", "Live rapid-review classes, right now.", "بیشتر", "Learn more", "#", "#f97316", "interstitial", "MedPrep", 0, 5, 10);
insAdF.run("prelesson", "اسپانسر امروز: داروخانهٔ نمونه", "Today's sponsor: Sample Pharmacy", "با تماشای این پیام، ۳۰ دقیقه انرژی نامحدود بگیر.", "Watch to unlock bonus gems.", "شروع", "Start", "#", "#16a34a", "prelesson", "Sample Pharmacy", 10, 30, 30);

// demo learners with some progress + a populated league
const provinces = ["تهران", "اصفهان", "فارس", "خراسان رضوی", "آذربایجان شرقی", "مازندران", "گیلان", "کرمان"];
const learnerNames = [
  ["سینا محمدی", "Sina Mohammadi"], ["نگار موسوی", "Negar Mousavi"], ["پارسا اکبری", "Parsa Akbari"],
  ["الهام صادقی", "Elham Sadeghi"], ["رضا نجفی", "Reza Najafi"], ["یاسمن رحیمی", "Yasaman Rahimi"],
  ["امیر حسینی", "Amir Hosseini"], ["دیبا کاظمی", "Diba Kazemi"], ["کیان فتحی", "Kian Fathi"],
  ["ستاره جعفری", "Setare Jafari"], ["آرش قادری", "Arash Ghaderi"], ["مبینا شریفی", "Mobina Sharifi"],
];
const insLearner = db.prepare(
  `INSERT INTO users (username,password_hash,name_fa,name_en,role,status) VALUES (?,?,?,?,'learner','active')`
);
const insProfile = db.prepare(
  `INSERT INTO learner_profiles (user_id,xp,weekly_xp,week_key,streak,best_streak,last_active,hearts,hearts_updated,tier,gems,province,daily_goal) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
);
// Use the SAME (Tehran-based) ISO-week function the runtime uses, so seeded
// leagues/tournament rooms always match the week the app looks up. (A local-time
// copy here previously drifted a week near boundaries → empty rooms.)
const isoWeek = isoWeekKey;
const wkKey = isoWeek();
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
const todayMinus = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" }); };
function tierForXp(xp) {
  if (xp >= 12000) return "diamond"; if (xp >= 6000) return "ruby"; if (xp >= 3000) return "sapphire";
  if (xp >= 1200) return "gold"; if (xp >= 400) return "silver"; return "bronze";
}
// the primary demo learner — seeded at Diamond tier so the league + Diamond
// Tournament + legendary features are all demonstrable out of the box.
const demoLearnerId = insLearner.run("learner", hash, "کاربر نمونه", "Demo Learner").lastInsertRowid;
insProfile.run(demoLearnerId, 12800, 2600, wkKey, 4, 6, today, 4, new Date().toISOString(), "diamond", 320, "تهران", 30);

// bot learners to fill the weekly league leaderboard
const botIds = [];
learnerNames.forEach((nm, i) => {
  const uid = insLearner.run(`learner${i + 1}`, hash, nm[0], nm[1]).lastInsertRowid;
  const xp = 3200 - i * 220 + (i % 3) * 40;
  const prof = { xp, wk: (i * 137) % 800 + 80, streak: (i * 3) % 21 + 1 };
  insProfile.run(uid, xp, prof.wk, wkKey, prof.streak, prof.streak, today, 5, new Date().toISOString(), tierForXp(xp), (i * 30) % 300, provinces[i % provinces.length], 30);
  botIds.push(uid);
});
// bots are established accounts — mark the one-time welcome flow as already seen
db.prepare(`UPDATE learner_profiles SET welcome_seen=1 WHERE user_id IN (${botIds.join(",")})`).run();

// place demo learner + bots into a Diamond league room for this week
const lg = db.prepare("INSERT INTO leagues (week_key,tier,room) VALUES (?,?,1)").run(wkKey, "diamond").lastInsertRowid;
const insLM = db.prepare("INSERT INTO league_members (league_id,user_id,xp) VALUES (?,?,?)");
insLM.run(lg, demoLearnerId, 2600);
botIds.slice(0, 11).forEach((uid) => {
  const wx = db.prepare("SELECT weekly_xp FROM learner_profiles WHERE user_id=?").get(uid).weekly_xp;
  insLM.run(lg, uid, wx);
});

// --- Diamond Tournament (final stage) demo room: demo learner + bots ---
// The tournament stage is derived from the ISO week, so we tag the room to
// match this week's stage.
{
  const n = parseInt((wkKey.split("-W")[1] || "1"), 10);
  const stage = ["quarterfinal", "semifinal", "final"][(n - 1) % 3];
  const tlg = db.prepare("INSERT INTO leagues (week_key,tier,room,tournament) VALUES (?,?,?,?)").run(wkKey, "diamond", 101, stage).lastInsertRowid;
  // demo learner sits mid-pack so both "advance" and "out" zones are visible
  insLM.run(tlg, demoLearnerId, 4200);
  botIds.forEach((uid, i) => {
    insLM.run(tlg, uid, 6800 - i * 380 + (i % 4) * 120);
  });
}

// mark a couple of the demo learner's early nodes as mastered + legendary so the
// path shows the purple/gold legendary crown and the Legend achievement.
{
  const firstNodes = db.prepare("SELECT id FROM path_nodes WHERE active=1 ORDER BY id LIMIT 3").all();
  const insNP = db.prepare("INSERT OR IGNORE INTO node_progress (user_id,node_id,stars,attempts,last_score,completed_at,legendary,legendary_at) VALUES (?,?,?,?,?,?,?,?)");
  firstNodes.forEach((nd, i) => {
    const legendary = i < 2 ? 1 : 0;   // first two are legendary, third only mastered
    insNP.run(demoLearnerId, nd.id, 5, 3, 100, new Date().toISOString(), legendary, legendary ? new Date().toISOString() : null);
  });
  db.prepare("UPDATE learner_profiles SET legendary_count=2, tournament_wins=1 WHERE user_id=?").run(demoLearnerId);

  // --- Section Checkpoint demo: complete ALL Internal-Medicine (parent
  // 'internal') lessons for the demo learner so the "Internal Medicine"
  // Checkpoint exam is unlocked out-of-the-box and shows a rich mixed blueprint
  // drawn across gastro/pulmo/nephro/heme/endo/rheum/cardio. ---
  {
    const internalNodes = db.prepare(`
      SELECT pn.id FROM path_nodes pn
      JOIN topics t ON t.id = pn.topic_id
      WHERE pn.active=1 AND t.active=1 AND t.program='preint' AND t.parent='internal'
      ORDER BY pn.id`).all();
    for (const nd of internalNodes) {
      insNP.run(demoLearnerId, nd.id, 5, 2, 100, new Date().toISOString(), 0, null);
    }
  }
  // demo learner already took the placement test + set a goal (so home isn't cluttered with offers)
  db.prepare("UPDATE learner_profiles SET placement_done=1, goal_set=1, onboarding_dismissed=1, welcome_seen=1 WHERE user_id=?").run(demoLearnerId);
  // a past tournament championship for the profile badge
  db.prepare("INSERT OR IGNORE INTO tournament_champions (user_id,week_key,rank,gems) VALUES (?,?,?,?)").run(demoLearnerId, "2026-W25", 1, 200);
}

// ---- Referral demo: give the demo learner an invite code + a few referrals so
// the invite dashboard and the referrer leaderboard are populated out of the box ----
{
  db.prepare("UPDATE learner_profiles SET referral_code='MED123', referral_count=? WHERE user_id=?").run(3, demoLearnerId);
  const insRef = db.prepare("INSERT INTO referrals (referrer_id, referred_id, code, status, referrer_rewarded, referred_rewarded, qualified_at) VALUES (?,?,?,?,1,1,datetime('now'))");
  botIds.slice(0, 3).forEach((uid) => insRef.run(demoLearnerId, uid, "MED123", "qualified"));
  // give the top bots some referral counts so the leaderboard has competition
  botIds.slice(3, 7).forEach((uid, i) => db.prepare("UPDATE learner_profiles SET referral_count=? WHERE user_id=?").run(5 - i, uid));
  // a couple of share events for admin analytics
  const insShare = db.prepare("INSERT INTO share_events (user_id, kind, channel, day, rewarded) VALUES (?,?,?,?,1)");
  ["instagram", "telegram", "whatsapp"].forEach((ch) => insShare.run(demoLearnerId, "streak", ch, today));

  // ---- PWA (mobile app) install-funnel demo data for the admin dashboard ----
  const insPwa = db.prepare("INSERT INTO pwa_events (user_id, event, platform, standalone, day, created_at) VALUES (?,?,?,?,?,datetime('now',?))");
  // spread a small, realistic funnel across the last several days
  const pwaSeed = [
    // [userId, event, platform, standalone, daysAgo]
    [demoLearnerId, "prompt_shown", "android", 0, 5], [demoLearnerId, "accepted", "android", 0, 5], [demoLearnerId, "installed", "android", 1, 5],
    [botIds[0], "prompt_shown", "android", 0, 4], [botIds[0], "accepted", "android", 0, 4], [botIds[0], "installed", "android", 1, 4],
    [botIds[1], "prompt_shown", "ios", 0, 4], [botIds[1], "installed", "ios", 1, 3],
    [botIds[2], "prompt_shown", "android", 0, 3], [botIds[2], "dismissed", "android", 0, 3],
    [botIds[3], "prompt_shown", "desktop", 0, 2], [botIds[3], "accepted", "desktop", 0, 2], [botIds[3], "installed", "desktop", 1, 2],
    [null, "prompt_shown", "android", 0, 1], [null, "dismissed", "android", 0, 1],
    // installed-app launches (standalone usage)
    [demoLearnerId, "launch", "android", 1, 2], [demoLearnerId, "launch", "android", 1, 0],
    [botIds[0], "launch", "android", 1, 1], [botIds[1], "launch", "ios", 1, 0], [botIds[3], "launch", "desktop", 1, 0],
    [demoLearnerId, "launch", "android", 0, 3], // one non-standalone (web) launch
  ];
  pwaSeed.forEach(([uid, ev, plat, st, ago]) =>
    insPwa.run(uid, ev, plat, st, todayMinus(ago), `-${ago} days`)
  );
}

// ---- Blog: original, physician-style educational articles (our OWN write-ups;
// no copied exam questions or third-party cases — copyright-safe) ----
{
  const insBlog = db.prepare(`INSERT INTO blog_posts
    (slug, category, title_fa, title_en, excerpt_fa, excerpt_en, body_fa, body_en, tags,
     author_name, author_credentials, reviewed, published, featured, ord, published_at, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`);
  const posts = [
    {
      slug: "stemi-recognition",
      category: "cardiology",
      title_fa: "تشخیص سریع STEMI روی نوار قلب",
      title_en: "Recognizing STEMI on the ECG",
      excerpt_fa: "چطور در چند ثانیه انفارکتوس حاد میوکارد با بالا رفتن ST را تشخیص دهیم و چه اقدامی فوری لازم است.",
      excerpt_en: "How to spot acute ST-elevation myocardial infarction in seconds, and the immediate steps that follow.",
      tags: "قلب, ECG, اورژانس, STEMI",
      author_name: "دکتر نمونه", author_credentials: "متخصص قلب",
      reviewed: 1, published: 1, featured: 1, ord: 1,
      ago: 2,
      body_fa: `## STEMI چیست؟
انفارکتوس حاد میوکارد با بالا رفتن قطعهٔ ST (STEMI) یک اورژانس واقعی است که در آن انسداد کامل یک شریان کرونر باعث مرگ سلول‌های قلبی می‌شود. هر دقیقه تأخیر، عضلهٔ بیشتری از دست می‌رود.

## نشانه‌های کلیدی روی نوار قلب
- بالا رفتن قطعهٔ ST بیش از ۱ میلی‌متر در دو لید مجاور اندامی
- بالا رفتن بیش از ۲ میلی‌متر در لیدهای پیش‌کوردیال
- تصویر آینه‌ای (reciprocal changes) در لیدهای مقابل

## گام‌های فوری
1. اکسیژن در صورت افت اشباع، دسترسی وریدی و مانیتورینگ
2. آسپرین جویدنی
3. تماس فوری با تیم آنژیوگرافی برای PCI اولیه

> نکتهٔ طلایی: «زمان، عضله است.» هدف، باز کردن شریان در کمتر از ۹۰ دقیقه است.

## جمع‌بندی
تشخیص سریع الگوی ST و اقدام بدون تأخیر، تفاوت میان بهبود کامل و آسیب دائمی قلب است.`,
      body_en: `## What is STEMI?
ST-elevation myocardial infarction (STEMI) is a true emergency in which complete occlusion of a coronary artery kills heart muscle. Every minute of delay costs more myocardium.

## Key ECG findings
- ST elevation > 1 mm in two contiguous limb leads
- > 2 mm in the precordial leads
- Reciprocal changes in opposite leads

## Immediate steps
1. Oxygen if desaturating, IV access, monitoring
2. Chewable aspirin
3. Activate the cath lab for primary PCI

> Golden rule: "Time is muscle." Aim to open the artery in under 90 minutes.

## Takeaway
Fast pattern recognition and no-delay action separate full recovery from permanent damage.`,
    },
    {
      slug: "dka-management-basics",
      category: "internal",
      title_fa: "اصول مدیریت کتواسیدوز دیابتی (DKA)",
      title_en: "Fundamentals of Managing Diabetic Ketoacidosis",
      excerpt_fa: "سه ستون درمان DKA: مایع، انسولین و اصلاح پتاسیم — به زبان ساده برای دانشجوی پزشکی.",
      excerpt_en: "The three pillars of DKA care: fluids, insulin and potassium — explained simply for students.",
      tags: "داخلی, دیابت, DKA, اورژانس",
      author_name: "دکتر نمونه", author_credentials: "متخصص داخلی",
      reviewed: 1, published: 1, featured: 0, ord: 2,
      ago: 5,
      body_fa: `## تعریف
کتواسیدوز دیابتی سه‌گانهٔ قند خون بالا، اسیدوز متابولیک و کتون مثبت است.

## سه ستون درمان
1. **مایع‌درمانی:** نرمال سالین برای جبران کم‌آبی شدید
2. **انسولین:** انفوزیون وریدی برای مهار کتوژنز
3. **پتاسیم:** پیش از شروع انسولین بررسی شود؛ انسولین پتاسیم را به داخل سلول می‌راند.

## پایش
قند، الکترولیت‌ها و گاز خون را منظم چک کنید. شکاف آنیونی معیار بهبود است.

> هشدار: هرگز پیش از اصلاح پتاسیم پایین، انسولین را با دوز کامل شروع نکنید.`,
      body_en: `## Definition
DKA is the triad of high blood glucose, metabolic acidosis and positive ketones.

## The three pillars
1. **Fluids:** normal saline to correct severe dehydration
2. **Insulin:** IV infusion to shut down ketogenesis
3. **Potassium:** check before starting insulin; insulin drives potassium into cells.

## Monitoring
Recheck glucose, electrolytes and blood gas regularly. The anion gap tracks recovery.

> Warning: never start full-dose insulin before correcting low potassium.`,
    },
    {
      slug: "spaced-repetition-for-med-students",
      category: "study-skills",
      title_fa: "مرور فاصله‌دار: چرا برای دانشجوی پزشکی بهترین روش است",
      title_en: "Spaced Repetition: Why It Wins for Med Students",
      excerpt_fa: "علم پشت فراموشی و اینکه چطور مرور فاصله‌دار حجم عظیم مطالب پزشکی را ماندگار می‌کند.",
      excerpt_en: "The science of forgetting and how spaced repetition makes the huge medical syllabus stick.",
      tags: "مهارت مطالعه, حافظه, فلش‌کارت",
      author_name: "تیم آموزشی MED School", author_credentials: "",
      reviewed: 0, published: 1, featured: 0, ord: 3,
      ago: 9,
      body_fa: `## منحنی فراموشی
مغز ما اطلاعات تازه را به‌سرعت فراموش می‌کند مگر اینکه در فواصل حساب‌شده آن‌ها را مرور کنیم.

## چرا مرور فاصله‌دار؟
- مرور درست پیش از لحظهٔ فراموشی، حافظه را تقویت می‌کند
- زمان مطالعه را بهینه می‌کند: روی چیزهایی که در حال فراموش‌شدن‌اند تمرکز می‌شود
- برای حجم عظیم مطالب پزشکی ایده‌آل است

## چطور شروع کنیم؟
از سیستم فلش‌کارت هوشمند MED School استفاده کنید که خودش زمان‌بندی مرور را بر اساس عملکرد شما تنظیم می‌کند.

> نکته: مرور کوتاه و روزانه بسیار مؤثرتر از مطالعهٔ فشردهٔ شب امتحان است.`,
      body_en: `## The forgetting curve
Our brain forgets new information quickly unless we review it at calculated intervals.

## Why spaced repetition?
- Reviewing just before you'd forget strengthens memory
- It optimizes study time: you focus on what's fading
- Ideal for the enormous medical syllabus

## How to start
Use MED School's smart flashcards, which schedule each review based on your performance.

> Tip: short daily reviews beat last-night cramming by a wide margin.`,
    },
  ];
  for (const p of posts) {
    insBlog.run(p.slug, p.category, p.title_fa, p.title_en, p.excerpt_fa, p.excerpt_en,
      p.body_fa, p.body_en, p.tags, p.author_name, p.author_credentials,
      p.reviewed, p.published, p.featured, p.ord, todayMinus(p.ago));
  }
}

// ---- A sample verifiable certificate for the demo learner (so the wallet +
// public verification page have data out of the box) ----
{
  const name = db.prepare("SELECT name_fa FROM users WHERE id=?").get(demoLearnerId)?.name_fa || "کاربر نمونه";
  db.prepare(`INSERT OR IGNORE INTO certificates
    (serial, user_id, kind, program_key, recipient_name, title_fa, title_en, hours, signer_name, signer_title_fa, signer_title_en, issued_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now','-3 days'))`).run(
    "MED-2026-DEMO01", demoLearnerId, "program", "preint", name,
    "مبانی علوم پایهٔ پزشکی", "Foundations of Basic Medical Sciences", "24",
    "مدیر آموزش", "MED School", "MED School"
  );
}

// seed a few in-app notifications for the demo learner
const insNotif = db.prepare(`INSERT INTO notifications (user_id,kind,title_fa,title_en,body_fa,body_en,icon,link,seen) VALUES (?,?,?,?,?,?,?,?,?)`);
insNotif.run(demoLearnerId, "streak", "🔥 استریکت در خطر است!", "🔥 Your streak is at risk!", "استریک ۴ روزه‌ات را با یک درس کوتاه حفظ کن.", "Keep your 4-day streak with one short lesson.", "clock", "path", 0);
insNotif.run(demoLearnerId, "league", "🏆 لیگ هفتگی شروع شد", "🏆 Weekly league started", "این هفته در لیگ نقره‌ای هستی؛ برای صعود تلاش کن.", "You're in the Silver league this week.", "trophy", "league", 0);
insNotif.run(demoLearnerId, "system", "به MED School خوش آمدی 🎉", "Welcome to MED School 🎉", "مسیر پره‌انترنی‌ات را همین حالا شروع کن.", "Start your pre-internship path now.", "cap", "path", 1);

// seed a small friend graph so the demo learner has friends, a friend streak,
// an active friend quest and a feed to interact with.
const insFollow = db.prepare("INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?,?)");
const friendPeers = botIds.slice(0, 3);
for (const pid of friendPeers) { insFollow.run(demoLearnerId, pid); insFollow.run(pid, demoLearnerId); } // mutual
// a couple of one-way follows (people who follow the demo learner)
insFollow.run(botIds[3], demoLearnerId);
// a friend streak with the first peer (demo learner active today, peer active today)
db.prepare(`INSERT OR IGNORE INTO friend_streaks (user_lo, user_hi, streak, best, lo_day, hi_day, last_day) VALUES (?,?,?,?,?,?,?)`)
  .run(Math.min(demoLearnerId, friendPeers[0]), Math.max(demoLearnerId, friendPeers[0]), 5, 8, today, today, today);
// an active friend quest for this week
db.prepare(`INSERT OR IGNORE INTO friend_quests (week_key, a_id, b_id, goal, a_xp, b_xp, reward_gems) VALUES (?,?,?,?,?,?,?)`)
  .run(wkKey, demoLearnerId, friendPeers[1], 300, 90, 120, 100);
// a few feed events from peers for the demo learner to high-five
const insFeed = db.prepare("INSERT INTO feed_events (user_id, kind, title_fa, title_en, icon, day) VALUES (?,?,?,?,?,?)");
insFeed.run(friendPeers[0], "streak", "به استریک ۷ روزه رسید 🔥", "hit a 7-day streak 🔥", "flame", today);
insFeed.run(friendPeers[1], "perfect_day", "یک درس بی‌نقص زد ⭐", "aced a perfect lesson ⭐", "star", today);
insFeed.run(friendPeers[2], "league", "به لیگ بالاتر صعود کرد 🏆", "was promoted a league 🏆", "trophy", today);

// seed a couple of support tickets so the admin inbox is demonstrable
{
  const insT = db.prepare(`INSERT INTO support_tickets (user_id,category,subject,status,user_unread,admin_unread,last_message_at,created_at)
      VALUES (?,?,?,?,?,?,datetime('now'),datetime('now'))`);
  const insM = db.prepare(`INSERT INTO support_messages (ticket_id,sender,sender_id,sender_name,body) VALUES (?,?,?,?,?)`);
  // an open bug report from the demo learner (unread by admin)
  const t1 = insT.run(demoLearnerId, "bug", "", "open", 0, 1).lastInsertRowid;
  insM.run(t1, "user", demoLearnerId, "", "سلام، در صفحهٔ مرور، دکمهٔ «آسان» گاهی دیر واکنش می‌دهد. ممنون می‌شوم بررسی کنید.");
  // an answered feedback thread from a bot learner
  const t2 = insT.run(botIds[1], "feedback", "", "answered", 0, 0).lastInsertRowid;
  insM.run(t2, "user", botIds[1], "", "تمرین هوشمند فوق‌العاده است! می‌شود تعداد سوال‌های هر جلسه را هم قابل‌تنظیم کنید؟");
  insM.run(t2, "admin", null, "پشتیبانی MED School", "ممنون از پیشنهاد عالی‌تان! این گزینه به‌زودی اضافه می‌شود. 🙌");
}

// seed starter Help-Center / FAQ articles (admin can edit/add more)
{
  const insH = db.prepare(`INSERT INTO help_articles (category,title_fa,title_en,body_fa,body_en,ord,published) VALUES (?,?,?,?,?,?,1)`);
  [
    ["learning", "چطور یک درس را شروع کنم؟", "How do I start a lesson?",
      "به تب «مسیر یادگیری» برو، روی اولین درس باز (قفل‌نشده) بزن و به سوال‌ها پاسخ بده. با هر درس XP و استریک می‌گیری.",
      "Open the Learning Path tab, tap the first unlocked lesson, and answer the questions. Each lesson earns XP and keeps your streak.", 1],
    ["learning", "استریک چیست و چطور حفظش کنم؟", "What is a streak and how do I keep it?",
      "استریک یعنی تعداد روزهای پیاپی که حداقل یک درس زده‌ای. کافی است هر روز یک درس کوتاه انجام دهی. با «محافظ استریک» یک روز غیبت، استریک نمی‌شکند.",
      "A streak is the number of consecutive days you complete at least one lesson. Just do one short lesson daily. A Streak Freeze protects it for one missed day.", 2],
    ["learning", "«تمرین هوشمند» چه فرقی با درس دارد؟", "How is Smart Practice different from a lesson?",
      "تمرین هوشمند یک جلسهٔ هدفمند از نقاط ضعف خودت می‌سازد: موضوعات ضعیف، اشتباهات قبلی، مرورهای امروز و سخت‌ترین سوال‌ها.",
      "Smart Practice builds a targeted session from YOUR weak spots: weak topics, past mistakes, due reviews, and the hardest questions.", 3],
    ["account", "چطور دورهٔ خودم را عوض کنم؟", "How do I change my course?",
      "از نوار کناری، بالای فهرست، دورهٔ فعال (پره‌انترنی یا علوم پایه) را انتخاب کن. همچنین در «پیشرفت من» هم قابل تغییر است.",
      "Use the course selector at the top of the sidebar (Pre-internship or Basic Sciences). You can also change it in My Progress.", 1],
    ["billing", "پریمیوم چه مزایایی دارد؟", "What does Premium include?",
      "قلب نامحدود، بدون تبلیغات، دسترسی به کتابخانهٔ کامل، و چالش‌های افسانه‌ای رایگان.",
      "Unlimited hearts, no ads, full library access, and free Legendary challenges.", 1],
    ["technical", "چطور یک باگ گزارش کنم؟", "How do I report a bug?",
      "روی دکمهٔ چت پشتیبانی (پایین صفحه) بزن، موضوع «گزارش باگ» را انتخاب کن و مشکل را بنویس. تیم ما پاسخ می‌دهد.",
      "Tap the support chat button (bottom of the screen), choose the “Report a bug” topic, and describe the issue. Our team will reply.", 1],
  ].forEach((a) => insH.run(...a));
}

// ---- Landing-page social proof: starter testimonials, FAQ & trust badges ----
// Real & specific (name + role + concrete result), admin-editable. These are
// example/beta reviews the admin should replace with genuine ones over time.
{
  const insT = db.prepare(`INSERT INTO testimonials
    (name_fa,name_en,role_fa,role_en,quote_fa,quote_en,photo,rating,featured,ord,published)
    VALUES (?,?,?,?,?,?,?,?,?,?,1)`);
  [
    ["نگار محمدی", "Negar Mohammadi", "داوطلب پره‌انترنی", "Pre-internship candidate",
      "«با لیگ‌ها و استریک، ۳۸ روز پشت‌سرهم بدون قطع درس زدم — چیزی که با هیچ روش دیگری نتونستم. درصد پاسخ درستم از ۶۱٪ به ۸۴٪ رسید.»",
      "\"With leagues and streaks I studied 38 days straight without a break — something no other method got me to. My accuracy went from 61% to 84%.\"",
      null, 5, 1, 1],
    ["دکتر سامان رضایی", "Dr. Saman Rezaei", "استاد دانشکدهٔ پزشکی", "Medical school faculty",
      "«بیمار مجازی و آزمون‌های زمان‌بندی‌شده کار تصحیح من رو نصف کرد. ۳۲ دانشجوی من هفتهٔ اول ۹۰٪ فعال بودن.»",
      "\"Virtual patients and scheduled exams halved my grading. 32 of my students were 90% active in the first week.\"",
      null, 5, 1, 2],
    ["مهدی کاظمی", "Mehdi Kazemi", "دانشجوی علوم پایه", "Basic Sciences student",
      "«درسنامهٔ کوتاه بعد هر سوال و توضیح تک‌تک گزینه‌ها دقیقاً همونیه که کم داشتم. دیگه لازم نیست کتاب رو زیر و رو کنم.»",
      "\"The short lesson after each question and the per-option explanations are exactly what I was missing. No more digging through textbooks.\"",
      null, 5, 0, 3],
    ["سارا احمدی", "Sara Ahmadi", "داوطلب دستیاری", "Residency candidate",
      "«تمرین هوشمند نقاط ضعفم رو خودش پیدا می‌کنه و همون‌ها رو تمرین می‌ده. در دو هفته گوارش من از ضعیف‌ترین به قوی‌ترین درسم تبدیل شد.»",
      "\"Smart Practice finds my weak spots and drills exactly those. In two weeks GI went from my weakest to my strongest subject.\"",
      null, 5, 0, 4],
  ].forEach((t) => insT.run(...t));

  const insF = db.prepare(`INSERT INTO landing_faqs (q_fa,q_en,a_fa,a_en,ord,published) VALUES (?,?,?,?,?,1)`);
  [
    ["استفاده از MED School رایگان است؟", "Is MED School free to use?",
      "بله. ثبت‌نام و مسیر یادگیری پایه کاملاً رایگان است و نیازی به کارت بانکی ندارد. پریمیوم اختیاری امکانات بیشتری مثل قلب نامحدود و بدون تبلیغات می‌دهد.",
      "Yes. Sign-up and the core learning path are completely free — no credit card required. Optional Premium adds extras like unlimited hearts and an ad-free experience.", 1],
    ["محتوا برای کدام آزمون‌ها مناسب است؟", "Which exams is the content for?",
      "دو مسیر کامل داریم: «پره‌انترنی و دستیاری» و «علوم پایه». محتوا توسط تیم و اساتید تهیه شده و مرتب به‌روزرسانی می‌شود.",
      "We have two full courses: “Pre-internship & Residency” and “Basic Sciences.” Content is prepared by our team and faculty and updated regularly.", 2],
    ["روی گوشی کار می‌کند؟", "Does it work on my phone?",
      "بله. سایت روی موبایل کاملاً واکنش‌گراست و به‌صورت اپ قابل نصب است (PWA). حالت روشن/تاریک و دو زبان فارسی/انگلیسی هم دارد.",
      "Yes. The site is fully responsive and installable as an app (PWA). It also has light/dark mode and Persian/English.", 3],
    ["اطلاعات و پیشرفت من امن است؟", "Is my data and progress safe?",
      "پیشرفت شما روی سرور ذخیره می‌شود و از هر دستگاهی در دسترس است. ما هیچ‌گاه اطلاعات شما را نمی‌فروشیم.",
      "Your progress is saved on the server and available from any device. We never sell your data.", 4],
    ["چطور شروع کنم؟", "How do I get started?",
      "روی «شروع رایگان» بزن، در چند ثانیه حساب بساز، آزمون تعیین سطح کوتاه را بده تا از نقطهٔ درست شروع کنی، و اولین درست را همین امروز بزن.",
      "Click “Start free,” create an account in seconds, take the short placement test to start at the right level, and do your first lesson today.", 5],
  ].forEach((f) => insF.run(...f));

  const insB = db.prepare(`INSERT INTO trust_badges (icon,label_fa,label_en,ord,published) VALUES (?,?,?,?,1)`);
  [
    ["check", "بدون نیاز به کارت بانکی", "No credit card required", 1],
    ["globe", "دوزبانه فارسی/انگلیسی", "Bilingual Persian/English", 2],
    ["download", "قابل نصب روی موبایل (PWA)", "Installable on mobile (PWA)", 3],
    ["lock", "پیشرفت شما ذخیره و امن", "Your progress saved & secure", 4],
  ].forEach((b) => insB.run(...b));
}

// ---- Group purchase packs (volume discount). Each seat = an INDEPENDENT
// account; a bigger pack lowers the per-seat price. Single monthly ≈ 99,000 T
// (990,000 Rial), so these packs are priced below buying individually. ----
{
  const insP = db.prepare(`INSERT INTO group_packs (title_fa,title_en,seats,days,price,ord,active) VALUES (?,?,?,?,?,?,1)`);
  [
    ["بستهٔ دونفره", "Duo pack", 2, 30, 1780000, 1],       // 89,000 T/seat (~10% off)
    ["بستهٔ گروه مطالعه (۳ نفره)", "Study group (3)", 3, 30, 2490000, 2], // 83,000 T/seat (~16% off)
    ["بستهٔ کلاسی (۵ نفره)", "Class pack (5)", 5, 30, 3750000, 3],        // 75,000 T/seat (~24% off)
    ["بستهٔ کلاسی سالانه (۵ نفره)", "Class annual (5)", 5, 365, 33000000, 4],
  ].forEach((p) => insP.run(...p));
}

// ---- Daily Diagnosis Challenge: original, self-authored example cases (classic
// textbook presentations written by us — no third-party game content). Admins
// add/edit more from the panel. Each: vignette + progressive clues + a picklist. ----
{
  const insDx = db.prepare(`INSERT INTO dx_cases
    (category_fa,category_en,vignette_fa,vignette_en,clues_json,answer_fa,answer_en,aliases_json,options_json,explanation_fa,explanation_en,difficulty,max_guesses,active,ord)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)`);
  const opt = (arr) => JSON.stringify(arr.map(([fa, en]) => ({ fa, en })));
  const clues = (arr) => JSON.stringify(arr.map(([fa, en]) => ({ fa, en })));
  const cases = [
    [
      "قلب و عروق", "Cardiology",
      "مرد ۵۸ ساله با درد فشارندهٔ قفسه سینه از یک ساعت پیش.", "A 58-year-old man with crushing chest pain for one hour.",
      clues([
        ["درد به بازوی چپ و فک انتشار دارد و با تعریق سرد همراه است.", "Pain radiates to the left arm and jaw with cold sweating."],
        ["سابقهٔ فشار خون بالا و دیابت دارد.", "History of hypertension and diabetes."],
        ["ECG: صعود قطعهٔ ST در لیدهای II، III، aVF.", "ECG: ST elevation in leads II, III, aVF."],
        ["تروپونین سرم بالا است.", "Serum troponin is elevated."],
      ]),
      "انفارکتوس حاد میوکارد (STEMI)", "Acute myocardial infarction (STEMI)",
      JSON.stringify(["mi", "stemi", "سکته قلبی", "انفارکتوس", "heart attack", "acute mi"]),
      opt([["آنژین ناپایدار", "Unstable angina"], ["پریکاردیت", "Pericarditis"], ["انفارکتوس حاد میوکارد (STEMI)", "Acute myocardial infarction (STEMI)"], ["آمبولی ریه", "Pulmonary embolism"], ["ریفلاکس مری", "GERD"], ["دایسکسیون آئورت", "Aortic dissection"]]),
      "صعود ST در لیدهای تحتانی همراه با تروپونین بالا و علائم کلاسیک، تشخیص STEMI تحتانی را می‌گذارد. اقدام فوری: ECG در ۱۰ دقیقه و ریپرفیوژن.",
      "Inferior ST elevation with elevated troponin and classic symptoms indicates an inferior STEMI. Act fast: ECG within 10 minutes and reperfusion.",
      "medium", 6, 1,
    ],
    [
      "گوارش", "Gastroenterology",
      "زن ۳۴ ساله با درد ربع فوقانی راست شکم پس از غذای چرب.", "A 34-year-old woman with right-upper-quadrant pain after a fatty meal.",
      clues([
        ["درد به شانهٔ راست انتشار دارد، همراه تهوع و استفراغ.", "Pain radiates to the right shoulder with nausea and vomiting."],
        ["در معاینه علامت مورفی مثبت است.", "Murphy's sign is positive on exam."],
        ["تب خفیف و لکوسیتوز دارد.", "Low-grade fever and leukocytosis."],
        ["سونوگرافی: سنگ و ضخیم‌شدگی دیوارهٔ کیسهٔ صفرا.", "Ultrasound: gallstones and gallbladder wall thickening."],
      ]),
      "کوله‌سیستیت حاد", "Acute cholecystitis",
      JSON.stringify(["cholecystitis", "کوله سیستیت", "التهاب کیسه صفرا"]),
      opt([["سنگ کلیه", "Renal colic"], ["کوله‌سیستیت حاد", "Acute cholecystitis"], ["زخم معده", "Peptic ulcer"], ["آپاندیسیت", "Appendicitis"], ["پانکراتیت", "Pancreatitis"], ["هپاتیت", "Hepatitis"]]),
      "درد RUQ پس از غذای چرب + مورفی مثبت + سونوی مثبت = کوله‌سیستیت حاد.",
      "RUQ pain after a fatty meal + positive Murphy's + positive ultrasound = acute cholecystitis.",
      "easy", 6, 2,
    ],
    [
      "عفونی", "Infectious disease",
      "کودک ۶ ساله با گلودرد و تب از ۲ روز پیش.", "A 6-year-old with sore throat and fever for 2 days.",
      clues([
        ["اگزودای لوزه‌ها و لنفادنوپاتی گردنی قدامی دردناک دارد.", "Tonsillar exudates and tender anterior cervical nodes."],
        ["سرفه ندارد.", "No cough."],
        ["تست سریع آنتی‌ژن استرپتوکوک مثبت است.", "Rapid strep antigen test is positive."],
      ]),
      "فارنژیت استرپتوکوکی", "Streptococcal pharyngitis",
      JSON.stringify(["strep throat", "فارنژیت استرپ", "گلودرد استرپتوکوکی", "gas pharyngitis"]),
      opt([["سرماخوردگی ویروسی", "Viral URI"], ["مونونوکلئوز", "Mononucleosis"], ["فارنژیت استرپتوکوکی", "Streptococcal pharyngitis"], ["دیفتری", "Diphtheria"], ["آبسه پری‌تونسیلار", "Peritonsillar abscess"]]),
      "معیارهای Centor (اگزودا، لنفادنوپاتی، تب، بدون سرفه) + تست سریع مثبت = فارنژیت استرپتوکوکی. درمان با آنتی‌بیوتیک.",
      "Centor criteria (exudate, adenopathy, fever, no cough) + positive rapid test = strep pharyngitis. Treat with antibiotics.",
      "easy", 5, 3,
    ],
    [
      "ریه", "Pulmonology",
      "مرد ۷۰ ساله با تنگی نفس ناگهانی و درد پلورتیک قفسه سینه.", "A 70-year-old man with sudden dyspnea and pleuritic chest pain.",
      clues([
        ["اخیراً جراحی زانو داشته و بی‌حرکت بوده است.", "Recent knee surgery with immobilization."],
        ["ضربان قلب ۱۱۰ و اشباع اکسیژن ۸۸٪ است.", "Heart rate 110, oxygen saturation 88%."],
        ["D-dimer بالا و ساق پای راست متورم است.", "Elevated D-dimer and a swollen right calf."],
        ["سی‌تی آنژیوگرافی ریه: نقص پرشدگی در شریان ریوی.", "CT pulmonary angiography: filling defect in the pulmonary artery."],
      ]),
      "آمبولی ریه", "Pulmonary embolism",
      JSON.stringify(["pe", "pulmonary embolism", "آمبولی ریوی", "امبولی ریه"]),
      opt([["پنومونی", "Pneumonia"], ["انفارکتوس میوکارد", "Myocardial infarction"], ["آمبولی ریه", "Pulmonary embolism"], ["پنوموتوراکس", "Pneumothorax"], ["نارسایی قلب", "Heart failure"], ["آسم", "Asthma"]]),
      "بی‌حرکتی اخیر + تاکی‌کاردی + هایپوکسی + DVT + CTA مثبت = آمبولی ریه. درمان با ضدانعقاد.",
      "Recent immobilization + tachycardia + hypoxia + DVT + positive CTA = pulmonary embolism. Treat with anticoagulation.",
      "hard", 6, 4,
    ],
    [
      "غدد", "Endocrinology",
      "زن ۲۵ ساله با تشنگی زیاد، ادرار فراوان و کاهش وزن.", "A 25-year-old woman with polydipsia, polyuria, and weight loss.",
      clues([
        ["از دو هفته پیش خسته و بی‌حال است.", "Fatigued and unwell for two weeks."],
        ["تنفس عمیق و تند دارد و بوی استون از دهانش می‌آید.", "Deep rapid breathing and a fruity (acetone) breath."],
        ["قند خون ۴۵۰ و کتون خون و ادرار مثبت است.", "Blood glucose 450 with positive blood and urine ketones."],
        ["گاز خون: اسیدوز متابولیک با آنیون‌گپ بالا.", "Blood gas: high-anion-gap metabolic acidosis."],
      ]),
      "کتواسیدوز دیابتی", "Diabetic ketoacidosis (DKA)",
      JSON.stringify(["dka", "کتواسیدوز", "diabetic ketoacidosis", "کتو اسیدوز دیابتی"]),
      opt([["دیابت نوع ۲ کنترل‌نشده", "Uncontrolled type 2 diabetes"], ["کتواسیدوز دیابتی", "Diabetic ketoacidosis (DKA)"], ["هایپرگلایسمی هایپراسمولار", "Hyperosmolar hyperglycemic state"], ["پرکاری تیروئید", "Hyperthyroidism"], ["عفونت ادراری", "Urinary tract infection"]]),
      "هایپرگلایسمی + کتون + اسیدوز آنیون‌گپ‌بالا در جوان = DKA. درمان: مایع، انسولین، اصلاح پتاسیم.",
      "Hyperglycemia + ketones + high-anion-gap acidosis in a young patient = DKA. Treat with fluids, insulin, potassium correction.",
      "medium", 6, 5,
    ],
  ];
  cases.forEach((c) => insDx.run(...c));
}

// seed an open challenge created by learner1 that the demo learner can join
const chCards = JSON.stringify(db.prepare("SELECT id FROM flashcards WHERE active=1 ORDER BY RANDOM() LIMIT 5").all().map((x) => x.id));
db.prepare(`INSERT INTO challenges (code,topic_id,card_ids,creator_id,status,xp_stake) VALUES (?,?,?,?,'open',30)`)
  .run("MEDGI1", 1, chCards, botIds[0]);

/* ---- Visual mnemonics (Sketchy-style) on a few representative cards ---- */
const MNEMONICS = [
  { topic: "anatomy", title_fa: "عصب فرنیک: C3،4،5", title_en: "Phrenic nerve: C3,4,5",
    scene_fa: "سه بادکنک (۳،۴،۵) که یک دیافراگم را مثل یک ترامپولین بالا و پایین نگه می‌دارند.",
    scene_en: "Three balloons (3,4,5) keeping a diaphragm bouncing like a trampoline.",
    hooks_fa: ["سه بادکنک = C3، C4، C5", "دیافراگم = عضلهٔ اصلی تنفس", "«C3،4،5 دیافراگم را زنده نگه می‌دارد»"],
    hooks_en: ["Three balloons = C3, C4, C5", "Diaphragm = main breathing muscle", "\"C3,4,5 keep the diaphragm alive\""] },
  { topic: "biochem", title_fa: "ویتامین C و اسکوربوت", title_en: "Vitamin C & scurvy",
    scene_fa: "یک ملوانِ بی‌حال روی کشتی که لثه‌هایش خون‌ریزی دارد و یک لیموترش بزرگ او را نجات می‌دهد.",
    scene_en: "A weak sailor with bleeding gums on a ship, rescued by a giant lemon.",
    hooks_fa: ["ملوان = بیماری دریانوردان قدیم", "لثهٔ خون‌ریز = علامت اسکوربوت", "لیمو = ویتامین C"],
    hooks_en: ["Sailor = old seafarers' disease", "Bleeding gums = scurvy sign", "Lemon = vitamin C"] },
  { topic: "pharm", title_fa: "بتا-بلاکرها: پسوند «-olol»", title_en: "Beta-blockers: the '-olol' suffix",
    scene_fa: "یک زنبورِ آرام (β) که روی گلِ قلب نشسته و ضربانش را کُند می‌کند؛ روی بال‌هایش نوشته «olol».",
    scene_en: "A calm bee (β) resting on a heart-flower, slowing its beat; its wings read 'olol'.",
    hooks_fa: ["زنبور = گیرندهٔ بتا", "کُندشدن ضربان = کاهش ضربان قلب", "olol = پروپرانولول، آتنولول، متوپرولول"],
    hooks_en: ["Bee = beta receptor", "Slowed beat = lower heart rate", "olol = propranolol, atenolol, metoprolol"] },
  { topic: "infect", title_fa: "استاف اورئوس: خوشهٔ انگور طلایی", title_en: "Staph aureus: golden grape cluster",
    scene_fa: "یک خوشهٔ انگورِ طلایی‌رنگ (کوکسی خوشه‌ای، طلایی=aureus) که کاتالاز-مثبت حباب می‌سازد.",
    scene_en: "A golden grape cluster (grape-like cocci, golden = aureus) bubbling because it's catalase-positive.",
    hooks_fa: ["خوشهٔ انگور = آرایش خوشه‌ای کوکسی‌ها", "طلایی = aureus", "حباب = کاتالاز مثبت"],
    hooks_en: ["Grape cluster = cocci in clusters", "Golden = aureus", "Bubbles = catalase positive"] },
  { topic: "cardio", title_fa: "شریان‌های کرونر و لیدها", title_en: "Coronary arteries & leads",
    scene_fa: "یک قلب که سه رودخانه (LAD, RCA, LCx) در آن جاری‌اند؛ هر رودخانه به یک گروه لید ECG می‌ریزد.",
    scene_en: "A heart with three rivers (LAD, RCA, LCx); each river flows into an ECG lead group.",
    hooks_fa: ["LAD = V1–V4 (قدامی)", "RCA = II, III, aVF (تحتانی)", "LCx = I, aVL, V5–V6 (جانبی)"],
    hooks_en: ["LAD = V1–V4 (anterior)", "RCA = II, III, aVF (inferior)", "LCx = I, aVL, V5–V6 (lateral)"] },
];
for (const mn of MNEMONICS) {
  const tid = db.prepare("SELECT id FROM topics WHERE slug=?").get(mn.topic)?.id;
  if (!tid) continue;
  const node = db.prepare("SELECT card_ids FROM path_nodes WHERE topic_id=? AND active=1 LIMIT 1").get(tid);
  let ids = []; try { ids = JSON.parse(node?.card_ids || "[]"); } catch { /* */ }
  const fid = ids[0];
  if (!fid) continue;
  const row = db.prepare("SELECT data_json FROM flashcards WHERE id=?").get(fid);
  let d = {}; try { d = JSON.parse(row.data_json); } catch { /* */ }
  d.mnemonic = {
    image: "", title_fa: mn.title_fa, title_en: mn.title_en,
    scene_fa: mn.scene_fa, scene_en: mn.scene_en, hooks_fa: mn.hooks_fa, hooks_en: mn.hooks_en,
  };
  db.prepare("UPDATE flashcards SET data_json=? WHERE id=?").run(JSON.stringify(d), fid);
}

/* ---- Crowd difficulty: pre-seed question_stats so insights aren't empty ---- */
const allLearnCards = db.prepare("SELECT id FROM flashcards WHERE active=1").all()
  .filter((r) => { try { return (JSON.parse(db.prepare("SELECT data_json FROM flashcards WHERE id=?").get(r.id).data_json).track || "uni") === "learn"; } catch { return false; } });
const insQS = db.prepare("INSERT OR IGNORE INTO question_stats (card_id, seen, correct, total_ms) VALUES (?,?,?,?)");
allLearnCards.forEach((r, i) => {
  const seen = 8 + (i % 25);                       // 8..32 people saw it
  const passRate = [0.30, 0.45, 0.62, 0.78, 0.90][i % 5]; // spread of difficulty
  const correct = Math.round(seen * passRate);
  const avgMs = 6000 + (i % 7) * 1500;            // 6–15s average
  insQS.run(r.id, seen, correct, avgMs * seen);
});

/* ---- Community decks: one approved (votable) + one pending (for moderation) ---- */
const communityAuthor = botIds[0];
const shareIds = db.prepare("SELECT id FROM flashcards WHERE active=1 ORDER BY id LIMIT 2").all().map((x) => x.id);
if (shareIds[0]) {
  const ap = db.prepare("INSERT INTO community_cards (flashcard_id, author_id, topic_id, status, score, imports, reviewed_at) VALUES (?,?,?,?,?,?, datetime('now'))")
    .run(shareIds[0], communityAuthor, 1, "approved", 5, 3).lastInsertRowid;
  db.prepare("INSERT INTO community_votes (community_id, user_id, value) VALUES (?,?,1)").run(ap, botIds[1]);
}
if (shareIds[1]) {
  db.prepare("INSERT INTO community_cards (flashcard_id, author_id, topic_id, status) VALUES (?,?,?, 'pending')")
    .run(shareIds[1], communityAuthor, 1);
}

/* ---- Activity log: seed recent xp_events + card_attempts spread over the last
   14 days so the product-health dashboard (DAU/WAU/MAU, stickiness, trend,
   activation funnel, retention) has real signal out of the box. Days are
   Tehran-local to match how the app buckets activity. */
{
  const learners = [demoLearnerId, ...botIds];
  const cardRows = db.prepare("SELECT id FROM flashcards WHERE active=1 ORDER BY id LIMIT 30").all().map((c) => c.id);
  const firstNode = db.prepare("SELECT id FROM path_nodes WHERE active=1 ORDER BY id LIMIT 1").get();
  const nodeId = firstNode ? firstNode.id : null;
  const insXp = db.prepare("INSERT INTO xp_events (user_id, amount, reason, node_id, day, created_at) VALUES (?,?,?,?,?, datetime('now'))");
  const insCA = db.prepare("INSERT INTO card_attempts (user_id, card_id, node_id, correct, response_ms, day, created_at) VALUES (?,?,?,?,?,?, datetime('now'))");
  const dayStr = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" }); };
  let sa = 987654321;
  const r2 = () => { sa = (sa * 1103515245 + 12345) & 0x7fffffff; return sa / 0x7fffffff; };
  const tx2 = db.transaction(() => {
    learners.forEach((uid, li) => {
      // how many of the last 14 days this learner was active (varies → realistic DAU/MAU)
      const activeDays = li === 0 ? 14 : 3 + Math.floor(r2() * 11); // demo learner active every day
      for (let back = 0; back < 14; back++) {
        // spread activity: more likely to be active on recent days
        if (back < activeDays && r2() < (back < 7 ? 0.8 : 0.5)) {
          const day = dayStr(back);
          insXp.run(uid, 20 + Math.floor(r2() * 40), "lesson", nodeId, day);
          const answers = 4 + Math.floor(r2() * 8);
          for (let a = 0; a < answers; a++) {
            const cid = cardRows[Math.floor(r2() * cardRows.length)] || cardRows[0];
            insCA.run(uid, cid, nodeId, r2() < 0.78 ? 1 : 0, 5000 + Math.floor(r2() * 9000), day);
          }
        }
      }
    });
  });
  tx2();
  console.log(`   Seeded activity: ${db.prepare("SELECT COUNT(*) c FROM xp_events").get().c} xp events, ${db.prepare("SELECT COUNT(*) c FROM card_attempts").get().c} card attempts.`);
}

/* ---- FSRS review log: simulate realistic review histories so the parameter
   optimizer has real data to fit against out of the box. We synthesize, per
   (learner, card), an ordered sequence of {grade, elapsed_days} that roughly
   follows a forgetting curve: cards start hard, intervals grow after good
   recalls, and occasional lapses reset progress. This is training data only
   (the srs_review_log table), not scheduling state. */
{
  const cardRows = db.prepare("SELECT id FROM flashcards WHERE active=1 ORDER BY id LIMIT 40").all().map((c) => c.id);
  const learners = [demoLearnerId, ...botIds];
  const insLog = db.prepare(
    "INSERT INTO srs_review_log (user_id, card_id, grade, elapsed_days, day, created_at) VALUES (?,?,?,?,?, datetime('now'))"
  );
  // deterministic pseudo-random so the seed is reproducible
  let s = 20260709;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const daysAgo = (n) => {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
  };
  const tx = db.transaction(() => {
    learners.forEach((uid, li) => {
      // each learner has reviewed a subset of cards, several times each
      const nCards = 12 + (li % 6) * 3;               // 12..27 cards
      for (let ci = 0; ci < nCards && ci < cardRows.length; ci++) {
        const cardId = cardRows[ci];
        let elapsed = 0;
        let interval = 1;
        let start = 40 + (li % 10);                    // reviews started ~40 days ago
        const reviews = 3 + Math.floor(rnd() * 5);     // 3..7 reviews per card
        for (let ri = 0; ri < reviews; ri++) {
          // probability of recall drops with a longer interval; harder cards lapse more
          const pRecall = Math.min(0.97, 0.55 + 0.4 * (ri / reviews) - Math.min(0.3, interval / 60));
          const recalled = rnd() < pRecall;
          let grade;
          if (!recalled) grade = 1;                    // Again
          else grade = rnd() < 0.2 ? 2 : (rnd() < 0.85 ? 3 : 4); // Hard/Good/Easy
          const day = daysAgo(Math.max(0, start - ri * Math.max(1, Math.round(interval))));
          insLog.run(uid, cardId, grade, elapsed, day);
          // advance interval like a simple SRS would
          if (grade === 1) interval = 1;
          else interval = Math.max(1, Math.round(interval * (grade === 4 ? 3 : grade === 3 ? 2.2 : 1.3)));
          elapsed = interval;
        }
      }
    });
  });
  tx();
  const logCount = db.prepare("SELECT COUNT(*) c FROM srs_review_log").get().c;
  console.log(`   Seeded ${logCount} FSRS review-log rows for the optimizer.`);
}

/* ---- Store: a few real, published courses (with free-preview lessons) so the
   public storefront ("محصولات آموزشی") isn't empty. Prices are in Rial. ---- */
{
  const insCourse = db.prepare(`INSERT INTO courses
    (title_fa,title_en,desc_fa,desc_en,cover,price,discount_price,instructor_fa,instructor_en,level,published,ord)
    VALUES (?,?,?,?,?,?,?,?,?,?,1,?)`);
  const insLesson = db.prepare(`INSERT INTO course_lessons
    (course_id,title_fa,title_en,video_url,duration,free_preview,ord) VALUES (?,?,?,?,?,?,?)`);
  const courses = [
    { title_fa: "دورهٔ جمع‌بندی پره‌انترنی", title_en: "Pre-internship Rapid Review",
      desc_fa: "مرور فشرده و نکته‌محور مهم‌ترین سرفصل‌های پره‌انترنی، همراه با تست‌های کلیدی.",
      desc_en: "A concise, high-yield review of the key pre-internship topics with essential MCQs.",
      price: 4900000, discount_price: 2900000, instructor_fa: "دکتر رضایی", instructor_en: "Dr. Rezaei", level: "pre-internship", ord: 1,
      lessons: [
        ["جلسهٔ معرفی و نقشهٔ راه", "Intro & roadmap", "12:40", 1],
        ["قلب و عروق — نکات پرتکرار", "Cardiology high-yield", "38:10", 0],
        ["گوارش — نکات پرتکرار", "GI high-yield", "41:05", 0],
      ] },
    { title_fa: "آناتومی تصویری علوم پایه", title_en: "Visual Anatomy (Basic Sciences)",
      desc_fa: "آموزش گام‌به‌گام آناتومی با تصاویر و اشِماتیک، مناسب دانشجویان علوم پایه.",
      desc_en: "Step-by-step anatomy with illustrations and schematics for basic-science students.",
      price: 0, discount_price: null, instructor_fa: "دکتر کریمی", instructor_en: "Dr. Karimi", level: "basic", ord: 2,
      lessons: [
        ["مقدمه و اصطلاحات آناتومیک", "Intro & anatomical terms", "09:20", 1],
        ["اندام فوقانی", "Upper limb", "27:30", 1],
      ] },
  ];
  for (const c of courses) {
    const info = insCourse.run(c.title_fa, c.title_en, c.desc_fa, c.desc_en, null, c.price, c.discount_price, c.instructor_fa, c.instructor_en, c.level, c.ord);
    c.lessons.forEach((l, i) => insLesson.run(info.lastInsertRowid, l[0], l[1], "#", l[2], l[3], i + 1));
  }
  console.log(`   Seeded ${courses.length} published store courses.`);
}

/* ---- Protocol instruments (Tables 1/2/3) as editable templates ------------
   Idempotent: a form that already carries the template_key is left exactly as
   the admin last saved it. Only genuinely missing templates are inserted. */
{
  const { RESEARCH_INSTRUMENTS } = await import("./data/research-instruments.js");
  const ins = db.prepare(
    `INSERT INTO questionnaire_forms
      (title_fa,title_en,description_fa,description_en,scope,questions_json,active,require_after_finish,anonymous,created_by,template_key)
     VALUES (?,?,?,?,?,?,0,?,?,1,?)`
  );
  const reset = db.prepare(
    `UPDATE questionnaire_forms SET title_fa=?, title_en=?, description_fa=?, description_en=?,
        questions_json=?, active=0, require_after_finish=?, anonymous=?, updated_at=datetime('now')
      WHERE template_key=?`
  );
  let added = 0, restored = 0;
  for (const t of RESEARCH_INSTRUMENTS) {
    const exists = db.prepare("SELECT id FROM questionnaire_forms WHERE template_key=?").get(t.key);
    if (!exists) {
      ins.run(t.title_fa, t.title_en, t.description_fa, t.description_en, t.scope,
              JSON.stringify(t.items), t.require_after_finish ? 1 : 0, t.anonymous ? 1 : 0, t.key);
      added++;
      continue;
    }
    /* `--force` deliberately does NOT delete questionnaire_forms — those are
       admin config and wiping them would destroy a researcher's own surveys.
       But the protocol templates are shipped content, not admin config: a
       forced reseed must be able to put them back to the protocol wording,
       otherwise a demo database can never be reset and an edited template
       silently becomes the new baseline. */
    if (forced) {
      reset.run(t.title_fa, t.title_en, t.description_fa, t.description_en,
                JSON.stringify(t.items), t.require_after_finish ? 1 : 0, t.anonymous ? 1 : 0, t.key);
      restored++;
    }
  }
  if (added) console.log(`   Seeded ${added} research instrument template(s) from the study protocol (inactive by default).`);
  if (restored) console.log(`   Restored ${restored} protocol instrument template(s) to their shipped state.`);
}

persistNow();   // flush the seeded database to disk

console.log("✅ Database seeded successfully.");
console.log("   Staff logins (password: demo): teacher / admin");
console.log("   Student logins (password: demo): 40012345 (Ali) / 40067890 (Maryam)");
console.log("   Learner login (password: demo): learner (competitive pre-internship track)");
console.log("   Ali is assigned case 1; Maryam is assigned cases 1 & 2.");
