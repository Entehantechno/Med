/* Subject-based answer catalogs for the flashcard editor.
   The teacher picks a subject; the option list auto-fills from the catalog,
   and the teacher only needs to mark the correct answer. */

export const HISTOLOGY = [
  { fa: "اپیتلیوم سنگفرشی ساده", en: "Simple squamous epithelium" },
  { fa: "اپیتلیوم مکعبی ساده", en: "Simple cuboidal epithelium" },
  { fa: "اپیتلیوم استوانه‌ای ساده", en: "Simple columnar epithelium" },
  { fa: "اپیتلیوم سنگفرشی مطبق", en: "Stratified squamous epithelium" },
  { fa: "اپیتلیوم مکعبی مطبق", en: "Stratified cuboidal epithelium" },
  { fa: "اپیتلیوم استوانه‌ای مطبق", en: "Stratified columnar epithelium" },
  { fa: "اپیتلیوم مطبق کاذب مژک‌دار", en: "Pseudostratified ciliated columnar epithelium" },
  { fa: "اپیتلیوم انتقالی (یوروتلیوم)", en: "Transitional epithelium (urothelium)" },
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
  { fa: "عضله اسکلتی", en: "Skeletal muscle" },
  { fa: "عضله قلبی", en: "Cardiac muscle" },
  { fa: "عضله صاف", en: "Smooth muscle" },
  { fa: "بافت عصبی", en: "Nervous tissue" },
  { fa: "خون", en: "Blood" },
  { fa: "غده اگزوکرین", en: "Exocrine gland" },
  { fa: "غده اندوکرین", en: "Endocrine gland" },
];

export const ANATOMY = [
  { fa: "استخوان ران (فمور)", en: "Femur" }, { fa: "استخوان بازو (هومروس)", en: "Humerus" },
  { fa: "استخوان درشت‌نی (تیبیا)", en: "Tibia" }, { fa: "استخوان نازک‌نی (فیبولا)", en: "Fibula" },
  { fa: "زند زبرین (رادیوس)", en: "Radius" }, { fa: "زند زیرین (اولنا)", en: "Ulna" },
  { fa: "جمجمه", en: "Skull" }, { fa: "ستون فقرات", en: "Vertebral column" },
  { fa: "دنده", en: "Rib" }, { fa: "جناغ سینه", en: "Sternum" },
  { fa: "لگن", en: "Pelvis" }, { fa: "کتف (اسکاپولا)", en: "Scapula" },
  { fa: "ترقوه (کلاویکل)", en: "Clavicle" },
  { fa: "عصب سیاتیک", en: "Sciatic nerve" }, { fa: "عصب مدیان", en: "Median nerve" },
  { fa: "شریان آئورت", en: "Aorta" }, { fa: "ورید اجوف فوقانی", en: "Superior vena cava" },
];

export const PATHOLOGY = [
  { fa: "آدنوکارسینوما", en: "Adenocarcinoma" }, { fa: "کارسینوم سلول سنگفرشی", en: "Squamous cell carcinoma" },
  { fa: "کارسینوم سلول بازال", en: "Basal cell carcinoma" }, { fa: "لنفوم", en: "Lymphoma" },
  { fa: "ملانوما", en: "Melanoma" }, { fa: "سارکوم", en: "Sarcoma" },
  { fa: "التهاب حاد", en: "Acute inflammation" }, { fa: "التهاب مزمن", en: "Chronic inflammation" },
  { fa: "نکروز انعقادی", en: "Coagulative necrosis" }, { fa: "نکروز پنیری", en: "Caseous necrosis" },
  { fa: "آپوپتوز", en: "Apoptosis" }, { fa: "هیپرپلازی", en: "Hyperplasia" },
  { fa: "متاپلازی", en: "Metaplasia" }, { fa: "دیسپلازی", en: "Dysplasia" },
  { fa: "آتروفی", en: "Atrophy" }, { fa: "هیپرتروفی", en: "Hypertrophy" },
  { fa: "گرانولوم", en: "Granuloma" }, { fa: "آمیلوئیدوز", en: "Amyloidosis" },
];

export const MICROBIOLOGY = [
  { fa: "استافیلوکوکوس اورئوس", en: "Staphylococcus aureus" },
  { fa: "استرپتوکوکوس پیوژنز", en: "Streptococcus pyogenes" },
  { fa: "استرپتوکوکوس پنومونیه", en: "Streptococcus pneumoniae" },
  { fa: "اشریشیا کلی", en: "Escherichia coli" }, { fa: "کلبسیلا پنومونیه", en: "Klebsiella pneumoniae" },
  { fa: "سودوموناس آئروژینوزا", en: "Pseudomonas aeruginosa" }, { fa: "سالمونلا", en: "Salmonella" },
  { fa: "شیگلا", en: "Shigella" }, { fa: "هلیکوباکتر پیلوری", en: "Helicobacter pylori" },
  { fa: "مایکوباکتریوم توبرکلوزیس", en: "Mycobacterium tuberculosis" },
  { fa: "نایسریا مننژیتیدیس", en: "Neisseria meningitidis" }, { fa: "کلستریدیوم دیفیسیل", en: "Clostridioides difficile" },
  { fa: "کاندیدا آلبیکنس", en: "Candida albicans" }, { fa: "ویروس آنفلوانزا", en: "Influenza virus" },
];

export const PHARMACOLOGY = [
  { fa: "آسپرین", en: "Aspirin" }, { fa: "وارفارین", en: "Warfarin" }, { fa: "متوپرولول", en: "Metoprolol" },
  { fa: "آتنولول", en: "Atenolol" }, { fa: "لیزینوپریل", en: "Lisinopril" }, { fa: "لوزارتان", en: "Losartan" },
  { fa: "آملودیپین", en: "Amlodipine" }, { fa: "فوروزماید", en: "Furosemide" }, { fa: "دیگوکسین", en: "Digoxin" },
  { fa: "آتورواستاتین", en: "Atorvastatin" }, { fa: "متفورمین", en: "Metformin" }, { fa: "انسولین", en: "Insulin" },
  { fa: "آموکسی‌سیلین", en: "Amoxicillin" }, { fa: "سفتریاکسون", en: "Ceftriaxone" }, { fa: "آزیترومایسین", en: "Azithromycin" },
  { fa: "امپرازول", en: "Omeprazole" }, { fa: "پردنیزولون", en: "Prednisolone" }, { fa: "مورفین", en: "Morphine" },
  { fa: "استامینوفن", en: "Acetaminophen" }, { fa: "ایبوپروفن", en: "Ibuprofen" },
];

export const SUBJECTS = {
  histology:    { fa: "بافت‌شناسی", en: "Histology", list: HISTOLOGY },
  anatomy:      { fa: "آناتومی", en: "Anatomy", list: ANATOMY },
  pathology:    { fa: "پاتولوژی", en: "Pathology", list: PATHOLOGY },
  microbiology: { fa: "میکروب‌شناسی", en: "Microbiology", list: MICROBIOLOGY },
  pharmacology: { fa: "فارماکولوژی", en: "Pharmacology", list: PHARMACOLOGY },
};
