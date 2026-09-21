/* Pre-internship (پره‌انترنی) national exam blueprint.
   Question budgets sourced from published Iranian pre-internship exam breakdowns
   (200 single-best-answer MCQs). Used to seed topics + a gamified learning path. */

export const TOPICS = [
  // --- Internal medicine sub-specialties (grouped under "internal") ---
  { slug: "gi",        name_fa: "گوارش",             name_en: "Gastroenterology", parent: "internal", budget: 8,  color: "#e0912e", icon: "stomach" },
  { slug: "pulmo",     name_fa: "ریه و مسمومیت",     name_en: "Pulmonology",      parent: "internal", budget: 10, color: "#2f7fd1", icon: "flask" },
  { slug: "nephro",    name_fa: "نفرولوژی",          name_en: "Nephrology",       parent: "internal", budget: 7,  color: "#2569b0", icon: "flask" },
  { slug: "heme",      name_fa: "خون و انکولوژی",     name_en: "Hematology-Oncology", parent: "internal", budget: 7, color: "#e0544f", icon: "flask" },
  { slug: "endo",      name_fa: "غدد",               name_en: "Endocrinology",    parent: "internal", budget: 5,  color: "#22a06b", icon: "flask" },
  { slug: "rheum",     name_fa: "روماتولوژی",         name_en: "Rheumatology",     parent: "internal", budget: 5,  color: "#6d5bd0", icon: "flask" },
  { slug: "cardio",    name_fa: "قلب و عروق",         name_en: "Cardiology",       parent: "internal", budget: 4,  color: "#e0568a", icon: "flask" },
  // --- Major clinical subjects ---
  { slug: "surgery",   name_fa: "جراحی",             name_en: "Surgery",          parent: "major", budget: 24, color: "#2f7fd1", icon: "check" },
  { slug: "peds",      name_fa: "کودکان",            name_en: "Pediatrics",       parent: "major", budget: 24, color: "#22a06b", icon: "patient" },
  { slug: "obgyn",     name_fa: "زنان و زایمان",      name_en: "Obstetrics & Gynecology", parent: "major", budget: 19, color: "#e0568a", icon: "patient" },
  // --- Minor subjects ---
  { slug: "path",      name_fa: "پاتولوژی",          name_en: "Pathology",        parent: "minor", budget: 9,  color: "#6d5bd0", icon: "brain" },
  { slug: "infect",    name_fa: "عفونی",             name_en: "Infectious Diseases", parent: "minor", budget: 9, color: "#e0912e", icon: "flask" },
  { slug: "neuro",     name_fa: "مغز و اعصاب",        name_en: "Neurology",        parent: "minor", budget: 8,  color: "#2569b0", icon: "brain" },
  { slug: "psych",     name_fa: "روانپزشکی",         name_en: "Psychiatry",       parent: "minor", budget: 7,  color: "#6d5bd0", icon: "brain" },
  { slug: "derm",      name_fa: "پوست",              name_en: "Dermatology",      parent: "minor", budget: 7,  color: "#e0a52e", icon: "patient" },
  { slug: "ortho",     name_fa: "ارتوپدی",           name_en: "Orthopedics",      parent: "minor", budget: 7,  color: "#22a06b", icon: "check" },
  { slug: "pharm",     name_fa: "فارماکولوژی",        name_en: "Pharmacology",     parent: "minor", budget: 7,  color: "#e0544f", icon: "flask" },
  { slug: "uro",       name_fa: "اورولوژی",          name_en: "Urology",          parent: "minor", budget: 6,  color: "#2f7fd1", icon: "patient" },
  { slug: "ophth",     name_fa: "چشم‌پزشکی",         name_en: "Ophthalmology",    parent: "minor", budget: 6,  color: "#2569b0", icon: "patient" },
  { slug: "ent",       name_fa: "گوش و حلق و بینی",   name_en: "ENT",              parent: "minor", budget: 6,  color: "#e0568a", icon: "patient" },
  { slug: "radio",     name_fa: "رادیولوژی",         name_en: "Radiology",        parent: "minor", budget: 6,  color: "#647184", icon: "image" },
  { slug: "stats",     name_fa: "آمار و اپیدمیولوژی", name_en: "Statistics & Epidemiology", parent: "minor", budget: 6, color: "#22a06b", icon: "chart" },
  { slug: "ethics",    name_fa: "اخلاق پزشکی",        name_en: "Medical Ethics",   parent: "minor", budget: 3,  color: "#6d5bd0", icon: "book" },
  // --- Floating (basic-science) subjects added since 1401 ---
  { slug: "genetics",  name_fa: "ژنتیک پزشکی",       name_en: "Medical Genetics", parent: "floating", budget: 5, color: "#e0a52e", icon: "brain" },
  { slug: "immuno",    name_fa: "ایمونولوژی",        name_en: "Immunology",       parent: "floating", budget: 8, color: "#e0544f", icon: "flask" },
  { slug: "nutrition", name_fa: "تغذیه",             name_en: "Nutrition",        parent: "floating", budget: 5, color: "#22a06b", icon: "flask" },
  { slug: "physics",   name_fa: "فیزیک پزشکی",       name_en: "Medical Physics",  parent: "floating", budget: 5, color: "#2f7fd1", icon: "chart" },
];

export const PARENTS = {
  internal: { name_fa: "دروس داخلی", name_en: "Internal Medicine" },
  major:    { name_fa: "دروس ماژور", name_en: "Major Subjects" },
  minor:    { name_fa: "دروس مینور", name_en: "Minor Subjects" },
  floating: { name_fa: "دروس شناور", name_en: "Floating Subjects" },
};

/* A pool of sample pre-internship style MCQ flashcards per topic.
   Each: { q_fa, q_en, options:[{fa,en,correct}], explain_fa, explain_en }.
   Kept concise but medically representative for demo/seed purposes. */
export const SAMPLE_QUESTIONS = {
  gi: [
    {
      q_fa: "شایع‌ترین علت خونریزی حاد گوارشی فوقانی در بزرگسالان کدام است؟",
      q_en: "What is the most common cause of acute upper gastrointestinal bleeding in adults?",
      options: [
        [
          "بیماری زخم پپتیک (زخم معده و دوازدهه)",
          "Peptic ulcer disease (gastric and duodenal ulcers)",
          true,
          "صحیح است؛ زخم‌های پپتیک معده و دوازدهه (اثنی‌عشر) مسئول بیش از ۵۰ درصد موارد خونریزی حاد گوارشی فوقانی در بزرگسالان هستند.",
          "Correct; peptic ulcer disease accounts for more than 50% of acute upper GI bleed cases in adults."
        ],
        [
          "واریس‌های مری و معده ناشی از پرفشاری پورت",
          "Esophageal and gastric varices from portal hypertension",
          false,
          "نادرست است؛ واریس‌ها عامل حدود ۱۰ تا ۲۰ درصد موارد خونریزی گوارشی فوقانی هستند و معمولاً در زمینه سیروز و نارسایی کبدی رخ می‌دهند، بنابراین شایع‌ترین علت در جمعیت عمومی نیستند.",
          "Incorrect; varices cause 10-20% of cases, typically in cirrhotic patients."
        ],
        [
          "پارگی طولی مخاط مالوری-وایس",
          "Mallory-Weiss mucosal laceration",
          false,
          "نادرست است؛ پارگی‌های مخاطی محل اتصال مری به معده (به دنبال استفراغ‌های شدید و مکرر) تنها حدود ۵ تا ۱۰ درصد موارد را شامل می‌شوند.",
          "Incorrect; Mallory-Weiss tears account for only 5-10% of acute upper GI bleeds."
        ],
        [
          "بدخیمی‌ها و تومورهای معده (آدنوکارسینوم)",
          "Gastric malignancies (adenocarcinoma)",
          false,
          "نادرست است؛ نئوپلاسم‌های معده کمتر از ۳ درصد موارد خونریزی حاد شدید را تشکیل می‌دهند و بیشتر تظاهر خونریزی مزمن و کم‌خونی فقر آهن دارند.",
          "Incorrect; gastric neoplasms cause less than 3% of acute upper GI bleeds."
        ]
      ],
      ex_fa: "زخم پپتیک شایع‌ترین علت خونریزی حاد گوارشی فوقانی است. نخستین اقدام، احیای بیمار و پایدارسازی وضعیت همودینامیک (تزریق مایعات کریستالوئید و خون) و سپس آندوسکوپی زودهنگام در ۲۴ ساعت نخست است.",
      ex_en: "PUD is the leading cause of acute upper GI bleeding. Initial management requires hemodynamic stabilization followed by early endoscopy within 24 hours.",
      media: { url: "/uploads/demo-melena-endoscopy.svg", kind: "image", caption_fa: "نمای آندوسکوپیک زخم پپتیک در بستر مخاطی", caption_en: "Endoscopic view of peptic ulcer" },
      explain: {
        text_fa: "زخم پپتیک شایع‌ترین علت است. در مواجهه با خونریزی گوارشی فوقانی، ارزیابی علائم حیاتی و برقراری دو خط وریدی قطور بر هر اقدام تشخیصی مقدم است.",
        text_en: "PUD is the most common cause. Immediate hemodynamic resuscitation precedes endoscopic evaluation.",
        media: { url: "https://www.aparat.com/v/demoGIbleed", kind: "embed", caption_fa: "ویدیوی آموزشی: رویکرد بالینی به خونریزی گوارشی فوقانی", caption_en: "Educational video: Approach to upper GI bleeding" }
      }
    },
    {
      q_fa: "کدام نشانگر سرولوژیک، حساس‌ترین و بهترین تست خط اول برای غربالگری بیماری سلیاک است؟",
      q_en: "Which serologic marker is the best first-line screening test for celiac disease?",
      options: [
        [
          "آنتی‌بادی ضد ترانس‌گلوتامیناز بافتی از کلاس IgA (Anti-tTG IgA)",
          "Anti-tissue transglutaminase IgA (Anti-tTG IgA)",
          true,
          "صحیح است؛ Anti-tTG IgA به عنوان تست انتخابی و خط اول غربالگری سلیاک با حساسیت و ویژگی بالای ۹۵ درصد توصیه می‌شود (همراه با سنجش سطح تام IgA برای رد نقص ایمنی).",
          "Correct; Anti-tTG IgA has >95% sensitivity and specificity and is the initial test of choice."
        ],
        [
          "آنتی‌بادی ضد هسته سلول (ANA)",
          "Antinuclear antibody (ANA)",
          false,
          "نادرست است؛ ANA مارکر غربالگری بیماری‌های روماتیسمی خودایمنی سیستمیک نظیر لوپوس (SLE) است و نقشی در بیماری سلیاک ندارد.",
          "Incorrect; ANA is used to evaluate systemic autoimmune rheumatic diseases like SLE, not celiac."
        ],
        [
          "آنتی‌بادی ضد میتوکندری (AMA)",
          "Anti-mitochondrial antibody (AMA)",
          false,
          "نادرست است؛ AMA مارکر اختصاصی و کلیدی بیماری کلانژیت صفراوی اولیه (PBC) در کبد است و ارتباطی با انتروپاتی حساس به گلوتن ندارد.",
          "Incorrect; AMA is the hallmark diagnostic marker for primary biliary cholangitis (PBC)."
        ],
        [
          "آنتی‌بادی ضد ساکارومایسس سرویزیه (ASCA)",
          "Anti-Saccharomyces cerevisiae antibody (ASCA)",
          false,
          "نادرست است؛ ASCA در بیماری کرون (از دسته بیماری‌های التهابی مزمن روده / IBD) بررسی می‌شود و مارکر سلیاک نیست.",
          "Incorrect; ASCA is associated with Crohn disease, not celiac enteropathy."
        ]
      ],
      ex_fa: "Anti-tTG IgA تست استاندارد اولیه سلیاک است. در صورت کمبود مادرزادی تام IgA، سنجش IgG ضد tTG یا IgG ضد پپتید دآمیده‌شده گلیادین (DGP) درخواست می‌شود.",
      ex_en: "Anti-tTG IgA is the preferred initial serologic test for celiac disease, accompanied by total serum IgA measurement."
    },
    {
      q_fa: "درمان استاندارد خط اول جهت ریشه‌کنی باکتری هلیکوباکتر پیلوری شامل کدام ترکیب است؟",
      q_en: "What is the standard first-line regimen for Helicobacter pylori eradication?",
      options: [
        [
          "مهارکننده پمپ پروتون (PPI) با دوز دو برابر + دو آنتی‌بیوتیک به مدت ۱۴ روز",
          "PPI twice daily + two antibiotics for 14 days",
          true,
          "صحیح است؛ رژیم‌های استاندارد خط اول نیازمند مهار قوی اسید معده توسط PPI به همراه ترکیب دو یا سه آنتی‌بیوتیک (نظیر کلاریترومایسین و آموکسی‌سیلین، یا رژیم چهارگانه حاوی بیسموت) به مدت ۱۴ روز کامل است.",
          "Correct; standard first-line regimens combine potent acid suppression with multiple antibiotics for 14 days."
        ],
        [
          "تک‌درمانی با مهارکننده پمپ پروتون (PPI به تنهایی)",
          "Proton pump inhibitor monotherapy",
          false,
          "نادرست است؛ PPI به تنهایی ترشح اسید را مهار کرده و زخم را التیام می‌بخشد اما قادر به ریشه‌کنی باکتری نیست و پس از قطع دارو بیماری عود می‌کند.",
          "Incorrect; PPI alone does not eradicate H. pylori and recurrence is virtually universal."
        ],
        [
          "تک‌درمانی با مترونیدازول خوراکی",
          "Metronidazole monotherapy",
          false,
          "نادرست است؛ تک‌درمانی با آنتی‌بیوتیک‌ها نه تنها عفونت را ریشه‌کن نمی‌کند بلکه به سرعت منجر به بروز سویه‌های مقاوم باکتریایی می‌گردد.",
          "Incorrect; antibiotic monotherapy rapidly leads to treatment failure and drug resistance."
        ],
        [
          "سوکرالفات خوراکی به تنهایی",
          "Sucralfate monotherapy",
          false,
          "نادرست است؛ سوکرالفات محافظ سد مخاطی است و هیچ‌گونه خاصیت باکتریسیدال یا باکتریواستاتیک علیه هلیکوباکتر پیلوری ندارد.",
          "Incorrect; sucralfate is a cytoprotective barrier agent with no antibacterial activity against H. pylori."
        ]
      ],
      ex_fa: "ریشه‌کنی هلیکوباکتر پیلوری نیازمند مهار اسید به همراه ترکیب چند آنتی‌بیوتیک است. پس از اتمام دوره درمان، بررسی موفقیت ریشه‌کنی با تست تنفسی اوره (UBT) حداقل ۴ هفته پس از قطع آنتی‌بیوتیک الزامی است.",
      ex_en: "Successful eradication requires acid suppression combined with antibiotics. Eradication must be confirmed with UBT at least 4 weeks post-treatment."
    }
  ],

  cardio: [
    {
      q_fa: "نخستین اقدام درمانی حیاتی در بیمار مبتلا به انفارکتوس حاد میوکارد با صعود قطعه ST (STEMI) کدام است؟",
      q_en: "What is the critical first-line management step in acute STEMI?",
      options: [
        [
          "تجویز فوری آسپیرین و برنامه‌ریزی ریپرفیوژن فوری عروقی (PCI اولیه یا فیبرینولیز)",
          "Immediate aspirin and urgent reperfusion therapy (primary PCI or fibrinolysis)",
          true,
          "صحیح است؛ جویدن ۳۲۵ میلی‌گرم آسپیرین غیرپوشش‌دار و برقراری جریان خون مجدد (PCI در کمتر از ۹۰ تا ۱۲۰ دقیقه یا فیبرینولیز در کمتر از ۳۰ دقیقه) مهم‌ترین اقدام نجات‌بخش میوکارد است.",
          "Correct; prompt chewable aspirin and rapid reperfusion are the cornerstone of STEMI management."
        ],
        [
          "استراحت مطلق در بستر بدون مداخله عروقی",
          "Strict bed rest alone without reperfusion",
          false,
          "نادرست است؛ STEMI ناشی از انسداد حاد و ترومبوتیک شریان کرونر است و تاخیر در باز کردن رگ منجر به مرگ سلول‌های عضله قلب و عوارض کشنده می‌شود.",
          "Incorrect; delaying reperfusion results in progressive and irreversible myocardial necrosis."
        ],
        [
          "شروع وارفارین خوراکی",
          "Initiating oral warfarin",
          false,
          "نادرست است؛ وارفارین چند روز طول می‌کشد تا اثر ضد انعقادی خود را نشان دهد و هیچ نقشی در برطرف کردن انسداد حاد عروق کرونر ندارد.",
          "Incorrect; warfarin has a slow onset of action over days and plays no role in acute coronary thrombosis."
        ],
        [
          "تجویز دیورتیک با دوز بالا به تنهایی",
          "High-dose loop diuretic alone",
          false,
          "نادرست است؛ دیورتیک‌ها تنها در صورت بروز ادم حاد ریه اندیکاسیون دارند و در غیاب نارسایی احتقانی می‌توانند با کاهش حجم، فشار خون و پرفیوژن کرونر را مختل سازند.",
          "Incorrect; diuretics are reserved for pulmonary congestion and can precipitate shock in uncomplicated STEMI."
        ]
      ],
      ex_fa: "در STEMI زمان معادل با عضله قلب است («Time is muscle»). تجویز سریع داروی ضد پلاکت و باز کردن رگ مسدود از طریق آنژیوپلاستی اولیه (Primary PCI) راهکار استاندارد طلایی است.",
      ex_en: "In STEMI, time is muscle. Immediate antiplatelet therapy and prompt reperfusion via primary PCI are the gold standard."
    },
    {
      q_fa: "کدام یافته در نوار قلب (ECG) مشخصه کلاسیک پریکاردیت حاد است؟",
      q_en: "Which electrocardiographic finding is characteristic of acute pericarditis?",
      options: [
        [
          "بالا رفتن منتشر و مقعر قطعه ST همراه با افت قطعه PR در اکثر لیدها",
          "Diffuse concave ST-segment elevation with PR depression",
          true,
          "صحیح است؛ در مرحله اول پریکاردیت حاد، صعود منتشر، مقعر و یکنواخت قطعه ST در لیدهای اندامی و پره‌کوردیال (به جز aVR و V1) همراه با افت قطعه PR دیده می‌شود.",
          "Correct; diffuse concave ST elevation with reciprocal PR depression in aVR is classic for acute pericarditis."
        ],
        [
          "امواج Q عمیق پاتولوژیک در لیدهای مجاور",
          "Deep pathological Q waves in contiguous leads",
          false,
          "نادرست است؛ موج Q پاتولوژیک نشانه نکروز تمام‌ضخامت میوکارد به دنبال انفارکتوس قلبی (MI) است و در پریکاردیت غیرعارضه‌دار دیده نمی‌شود.",
          "Incorrect; pathologic Q waves signify transmural myocardial necrosis from myocardial infarction, not pericarditis."
        ],
        [
          "کوتاه شدن شدید فاصله QT",
          "Marked shortening of the QT interval",
          false,
          "نادرست است؛ کوتاه شدن فاصله QT تظاهر اختلالاتی چون هیپرکلسمی یا اثر دارویی دیگوکسین است و در پریکاردیت رخ نمی‌دهد.",
          "Incorrect; short QT interval is associated with hypercalcemia or digitalis effect."
        ],
        [
          "بلوک شاخه‌ای جدید و پهن شدن کمپلکس QRS",
          "New-onset bundle branch block with wide QRS",
          false,
          "نادرست است؛ بلوک‌های شاخه‌ای نشانه آسیب به بافت هدایتی درون‌بطنی در بیماری‌های ایسکمیک یا میوکاردیت هستند، نه التهاب سطحی پریکارد.",
          "Incorrect; bundle branch blocks indicate intraventricular conduction system disruption."
        ]
      ],
      ex_fa: "تغییرات ECG در پریکاردیت ۴ مرحله دارد. مرحله ۱ با بالا رفتن مقعر ST در تمام لیدها و افت قطعه PR در لیدهای تحتانی و قدامی با صعود PR در aVR مشخص می‌شود.",
      ex_en: "Acute pericarditis typically evolves through four stages, beginning with diffuse concave ST elevation and PR depression."
    }
  ],

  peds: [
    {
      q_fa: "شایع‌ترین پاتوژن باکتریال عامل مننژیت حاد در نوزادان زیر یک ماه کدام است؟",
      q_en: "What is the most common bacterial pathogen causing acute meningitis in neonates?",
      options: [
        [
          "استرپتوکوک گروه B (استرپتوکوک آگالاکتیه / GBS)",
          "Group B Streptococcus (Streptococcus agalactiae)",
          true,
          "صحیح است؛ استرپتوکوک آگالاکتیه (GBS) شایع‌ترین عامل باکتریال سپسیس و مننژیت در دوره نوزادی است و پس از آن اشریشیا کلی و لیستریا مونوسیتوژنز قرار دارند.",
          "Correct; Group B Streptococcus is the leading bacterial cause of neonatal sepsis and meningitis."
        ],
        [
          "نایسریا مننژیتیدیس (مننگوکوک)",
          "Neisseria meningitidis (meningococcus)",
          false,
          "نادرست است؛ مننگوکوک علت شایع مننژیت در کودکان بزرگ‌تر، نوجوانان و همه‌گیری‌های مراکز جمعیتی است، نه در نوزادان کمتر از یک ماه.",
          "Incorrect; meningococcus causes meningitis in older children and adolescents, not neonates."
        ],
        [
          "استرپتوکوک پنومونیه (پنوموکوک)",
          "Streptococcus pneumoniae (pneumococcus)",
          false,
          "نادرست است؛ پنوموکوک شایع‌ترین عامل مننژیت باکتریال فراتر از سن ۳ ماهگی تا دوران کهنسالی است، اما در نوزادان مقام اول را ندارد.",
          "Incorrect; pneumococcus is the leading cause after the neonatal period (beyond 3 months)."
        ],
        [
          "هموفیلوس آنفلوانزا نوع b",
          "Haemophilus influenzae type b",
          false,
          "نادرست است؛ به دنبال پوشش همگانی واکسیناسیون کونژوگه کشوری، شیوع این باکتری به طور چشمگیری افت کرده و در دوره نوزادی نیز پاتوژن غالب نیست.",
          "Incorrect; Hib incidence has plummeted due to vaccination and it is rare in neonates."
        ]
      ],
      ex_fa: "در مننژیت نوزادان (زیر ۲۸ روز)، شایع‌ترین پاتوژن‌ها استرپتوکوک گروه B، باسیل‌های گرم‌منفی روده‌ای (مانند E. coli) و لیستریا هستند. درمان تجربی اولیه شامل آمپی‌سیلین + سفوتاکسیم (یا جنتامایسین) است.",
      ex_en: "Neonatal meningitis is most commonly caused by GBS, E. coli, and Listeria. Empiric therapy is ampicillin plus cefotaxime or gentamicin."
    },
    {
      q_fa: "طبق برنامه کشوری ایمن‌سازی در ایران، واکسن ب ث ژ (BCG) در چه زمانی تجویز می‌شود؟",
      q_en: "When is the BCG vaccine administered in Iran's national immunization schedule?",
      options: [
        [
          "بدو تولد (همراه با نوبت صفر فلج اطفال و هپاتیت B)",
          "At birth (with birth doses of OPV and Hepatitis B)",
          true,
          "صحیح است؛ واکسن BCG برای پیشگیری از اشکال شدید و کشنده سل (مننژیت سلی و سل ارزنی) در بدو تولد به صورت داخل‌جلدی در بازوی چپ تزریق می‌گردد.",
          "Correct; BCG is administered intradermally at birth to protect against severe disseminated tuberculosis."
        ],
        [
          "پایان دو ماهگی",
          "At 2 months of age",
          false,
          "نادرست است؛ در پایان دو ماهگی نوبت اول واکسن پنج‌گانه (پنتاوالان شامل دیفتری، کزاز، سیاه‌سرفه، هپاتیت B و هموفیلوس) و قطره فلج اطفال تجویز می‌شود.",
          "Incorrect; 2 months is the schedule for the first dose of pentavalent and OPV."
        ],
        [
          "پایان شش ماهگی",
          "At 6 months of age",
          false,
          "نادرست است؛ در شش ماهگی نوبت سوم واکسن پنج‌گانه و فلج اطفال دریافت می‌گردد و ارتباطی با زمان تجویز BCG ندارد.",
          "Incorrect; 6 months marks the third dose of pentavalent and OPV."
        ],
        [
          "پایان یک سالگی (۱۲ ماهگی)",
          "At 12 months of age",
          false,
          "نادرست است؛ در ۱۲ ماهگی نوبت اول واکسن سه‌گانه ویروسی سرخک، سرخجه و اوریون (MMR) تجویز می‌شود.",
          "Incorrect; 12 months is the schedule for the first dose of MMR."
        ]
      ],
      ex_fa: "واکسن ب ث ژ (BCG) در بدو تولد به میزان ۰.۰۵ میلی‌لیتر به صورت اینترادرمال تلقیح می‌شود. بروز پاپول، اسکار و ترشح خفیف در محل تزریق پس از چند هفته سیر طبیعی پاسخ ایمنی است.",
      ex_en: "BCG is administered at birth to prevent tuberculous meningitis and miliary tuberculosis in infants."
    }
  ],

  obgyn: [
    {
      q_fa: "غربالگری دیابت بارداری (GDM) در زنان با ریسک متوسط در کدام هفته بارداری انجام می‌گیرد؟",
      q_en: "At what gestational age is routine screening for gestational diabetes performed?",
      options: [
        [
          "هفته ۲۴ تا ۲۸ بارداری",
          "24 to 28 weeks of gestation",
          true,
          "صحیح است؛ به دلیل ترشح هورمون‌های ضدانسولین جفتی (نظیر لاکتوژن جفتی انسان / hPL و پروژسترون) مقاومت به انسولین در اواخر سه‌ماهه دوم به اوج می‌رسد، لذا هفته ۲۴ تا ۲۸ زمان استاندارد غربالگری است.",
          "Correct; peak placental anti-insulin hormone production occurs at 24-28 weeks, making it the ideal screening window."
        ],
        [
          "هفته ۸ بارداری (نخستین ویزیت)",
          "At 8 weeks of gestation",
          false,
          "نادرست است؛ در نخستین ویزیت بارداری صرفاً قند خون ناشتا (FBS) جهت رد دیابت آشکار قبلی (Overt diabetes) چک می‌شود، نه آزمون غربالگری استاندارد GDM.",
          "Incorrect; early pregnancy testing evaluates pre-existing overt diabetes, not GDM screening."
        ],
        [
          "هفته ۱۲ تا ۱۴ بارداری",
          "12 to 14 weeks of gestation",
          false,
          "نادرست است؛ در انتهای سه‌ماهه اول مقاومت انسولینی جفتی هنوز بارز نشده و غربالگری در این زمان ارزش تشخیصی مناسبی ندارد.",
          "Incorrect; placental insulin resistance is not sufficiently established in early pregnancy."
        ],
        [
          "هفته ۳۶ بارداری",
          "At 36 weeks of gestation",
          false,
          "نادرست است؛ انجام غربالگری در این مرحله بسیار دیرهنگام است و فرصت کنترل قند و پیشگیری از عوارضی چون ماکروزومی، دیستوشی شانه و مرگ داخل رحمی از دست می‌رود.",
          "Incorrect; screening at 36 weeks is far too late to prevent fetal macrosomia and perinatal complications."
        ]
      ],
      ex_fa: "غربالگری دیابت بارداری با آزمون چالش گلوکز (GCT با ۵۰ گرم گلوکز) در هفته‌های ۲۴ تا ۲۸ حاملگی انجام می‌شود. در صورت قند خون ۱ ساعته بالاتر از ۱۴۰ میلی‌گرم بر دسی‌لیتر، تست تحمل گلوکز ۳ ساعته (OGTT) درخواست می‌شود.",
      ex_en: "Universal screening for gestational diabetes is performed between 24 and 28 weeks of gestation using a 50-g glucose challenge test."
    },
    {
      q_fa: "شایع‌ترین علت خونریزی شدید پس از زایمان (PPH) کدام مورد است؟",
      q_en: "What is the most common cause of postpartum hemorrhage (PPH)?",
      options: [
        [
          "آتونی رحم (نقص در انقباض میومتر)",
          "Uterine atony",
          true,
          "صحیح است؛ آتونی رحم مسئول حدود ۷۰ تا ۸۰ درصد از موارد خونریزی‌های زودرس پس از زایمان است و نخستین گام، ماساژ رحم و تجویز داروهای یوتروتونیک (اکسی‌توسین) است.",
          "Correct; uterine atony accounts for 70-80% of postpartum hemorrhage cases."
        ],
        [
          "پارگی‌ها و آسیب‌های مجرای زایمان (سرویکس و واژن)",
          "Genital tract lacerations (cervix, vagina, perineum)",
          false,
          "نادرست است؛ تروماها و پارگی‌های کانال زایمان عامل حدود ۲۰ درصد موارد PPH هستند و زمانی مطرح می‌شوند که رحم با وجود خونریزی، کاملاً منقبض و سفت باشد.",
          "Incorrect; lacerations account for ~20% of cases, suspected when hemorrhage persists despite a firmly contracted uterus."
        ],
        [
          "احتباس بقایای بافت جفت و پرده‌های جنینی",
          "Retained placental tissue or membranes",
          false,
          "نادرست است؛ بافت باقی‌مانده جفت عامل حدود ۱۰ درصد موارد است و نیاز به معاینه دقیق جفت پس از خروج و سونوگرافی دارد.",
          "Incorrect; retained placenta causes ~10% of cases, confirmed on visual inspection of the delivered placenta."
        ],
        [
          "اختلالات انعقادی اولیه و اکتسابی (کوآگولوپاتی)",
          "Coagulopathies (primary or consumptive)",
          false,
          "نادرست است؛ کوآگولوپاتی‌ها علت کمتر از ۱ درصد موارد خونریزی‌های پس از زایمان هستند و معمولاً در زمینه دکولمان شدید یا پره‌اکلامپسی با DIC تظاهر می‌یابند.",
          "Incorrect; coagulopathies cause <1% of PPH cases, usually in the setting of severe abruption, amniotic fluid embolism, or sepsis."
        ]
      ],
      ex_fa: "چهار عامل PPH در قانون ۴T خلاصه می‌شوند: Tone (آتونی رحم: شایع‌ترین)، Trauma (پارگی مجرا)، Tissue (بقایای جفت) و Thrombin (اختلال انعقادی). اولین اقدام درمانی ماساژ رحم و انفوزیون اکسی‌توسین است.",
      ex_en: "The causes of PPH are remembered by the 4 Ts: Tone (atony, #1 cause), Trauma, Tissue, and Thrombin."
    }
  ],

  surgery: [
    {
      q_fa: "وجود تندرنس و حساسیت در نقطه مک‌بورنی (McBurney point) مشخصه کدام بیماری جراحی است؟",
      q_en: "Tenderness at McBurney's point is characteristic of which surgical condition?",
      options: [
        [
          "آپاندیسیت حاد",
          "Acute appendicitis",
          true,
          "صحیح است؛ نقطه مک‌بورنی در محل اتصال یک‌سوم خارجی و دو‌سوم داخلی خط فرضی بین خار خاصره قدامی فوقانی (ASIS) و ناف قرار دارد و حساسیت در آن قویاً به نفع آپاندیسیت حاد است.",
          "Correct; McBurney's point tenderness is the hallmark clinical sign of acute appendicitis."
        ],
        [
          "کوله‌سیستیت حاد",
          "Acute cholecystitis",
          false,
          "نادرست است؛ در کوله‌سیستیت حاد، حساسیت و دفاع شکمی در ربع فوقانی راست (RUQ) و زیر لبه دنده‌ای راست همراه با علامت مورفی مثبت وجود دارد.",
          "Incorrect; acute cholecystitis produces right upper quadrant tenderness and a positive Murphy sign."
        ],
        [
          "پانکراتیت حاد",
          "Acute pancreatitis",
          false,
          "نادرست است؛ پانکراتیت با درد خنجری و منتشر در ناحیه اپی‌گاستر با انتشار به پشت و افزایش آنزیم‌های آمیلاز و لیپاز تظاهر می‌یابد.",
          "Incorrect; pancreatitis presents with severe epigastric pain radiating to the back."
        ],
        [
          "دیورتیکولیت حاد کولون سیگموئید",
          "Acute sigmoid diverticulitis",
          false,
          "نادرست است؛ دیورتیکولیت بیشتر کولون چپ و سیگموئید را درگیر می‌سازد و حساسیت آن در ربع تحتانی چپ شکم (LLQ) واقع می‌شود.",
          "Incorrect; diverticulitis most commonly affects the sigmoid colon, causing left lower quadrant tenderness."
        ]
      ],
      ex_fa: "آپاندیسیت حاد شایع‌ترین اورژانس جراحی شکم است. علائم با درد مبهم دور ناف آغاز شده و سپس به نقطه مک‌بورنی در ربع تحتانی راست منتقل و تثبیت می‌شود.",
      ex_en: "Acute appendicitis is the most common surgical abdomen emergency, characterized by migration of periumbilical pain to McBurney's point in the RLQ."
    },
    {
      q_fa: "علامت مورفی مثبت (Positive Murphy sign) در معاینه شکم به نفع کدام تشخیص است؟",
      q_en: "A positive Murphy sign on abdominal examination strongly suggests?",
      options: [
        [
          "کوله‌سیستیت حاد",
          "Acute cholecystitis",
          true,
          "صحیح است؛ توقف ناگهانی دم به علت درد شدید هنگام لمس عمقی کیسه صفرا در زیر لبه دنده‌ای راست، نشانه کلاسیک التهاب حاد کیسه صفرا (کوله‌سیستیت) است.",
          "Correct; inspiratory arrest during deep palpation of the right upper quadrant is the classic sign of acute cholecystitis."
        ],
        [
          "آپاندیسیت حاد",
          "Acute appendicitis",
          false,
          "نادرست است؛ آپاندیسیت با نشانه‌های مک‌بورنی، رووسینگ (Rovsing)، پسواس و اوبتوراتور در ربع تحتانی راست همراه است.",
          "Incorrect; appendicitis is evaluated with McBurney, Rovsing, psoas, and obturator signs."
        ],
        [
          "انسداد مکانیکی روده باریک",
          "Mechanical small bowel obstruction",
          false,
          "نادرست است؛ انسداد روده با دردهای کولیکی، اتساع شکم، استفراغ‌های مکرر و صداهای روده با تون بالا (هایپرپریستالتیسم فلزی) تظاهر دارد.",
          "Incorrect; bowel obstruction presents with distension, colicky pain, vomiting, and high-pitched rushes."
        ],
        [
          "کولیک کلیوی ناشی از سنگ حالب",
          "Renal colic from ureteral calculus",
          false,
          "نادرست است؛ کولیک کلیوی با تندرنس زاویه دنده‌ای‌مهره‌ای (CVA tenderness) و دردهای دوره‌ای پهلو با انتشار به کشاله ران و هماچوری مشخص می‌گردد.",
          "Incorrect; renal colic causes flank pain radiating to the groin with costovertebral angle tenderness."
        ]
      ],
      ex_fa: "علامت مورفی دارای حساسیت بالایی در تشخیص بالینی کوله‌سیستیت حاد است. روش تصویربرداری انتخابی برای تایید سنگ و شواهد التهاب جدار کیسه صفرا، سونوگرافی شکم است.",
      ex_en: "A positive Murphy sign indicates acute cholecystitis. Right upper quadrant ultrasound is the imaging modality of choice."
    }
  ],

  neuro: [
    {
      q_fa: "پنجره زمانی استاندارد جهت تجویز داخل وریدی داروی حل‌کننده لخته (tPA وریدی) در سکته مغزی ایسکمیک حاد تا چند ساعت است؟",
      q_en: "What is the therapeutic time window for intravenous alteplase (tPA) in acute ischemic stroke?",
      options: [
        [
          "تا ۴.۵ ساعت از زمان شروع علائم",
          "Up to 4.5 hours from symptom onset",
          true,
          "صحیح است؛ طبق گایدلاین‌های نورولوژی، پنجره طلایی تجویز tPA وریدی (آلتپلاز) حداکثر تا ۴.۵ ساعت پس از شروع نقص عصبی در بیماران واجد شرایط است.",
          "Correct; IV alteplase is proven effective when administered within 4.5 hours of ischemic stroke symptom onset."
        ],
        [
          "تا ۲۴ ساعت از زمان شروع علائم",
          "Up to 24 hours from symptom onset",
          false,
          "نادرست است؛ ترومبکتومی مکانیکی در انسداد عروق بزرگ مغزی ممکن است تا ۲۴ ساعت قابل انجام باشد، اما تجویز داروی ترومبولیتیک وریدی در این زمان با خطر مرگبار خونریزی مغزی همراه است.",
          "Incorrect; mechanical thrombectomy may be considered up to 24 hours, but IV tPA at 24 hours carries unacceptable hemorrhagic risk."
        ],
        [
          "تا ۱۲ ساعت از زمان شروع علائم",
          "Up to 12 hours from symptom onset",
          false,
          "نادرست است؛ پس از گذشت ۴.۵ ساعت بافت مغز دچار نکروز شده و تزریق tPA وریدی منع مطلق دارد.",
          "Incorrect; IV tPA after 4.5 hours significantly increases fatal intracerebral hemorrhage without clinical benefit."
        ],
        [
          "بدون محدودیت زمانی در تمام مراحل",
          "No time limit across all stages",
          false,
          "نادرست است؛ تجویز خارج از پنجره درمانی مغایر با اصول ایمنی بیمار است و به خونریزی گسترده داخل مغزی منجر می‌شود.",
          "Incorrect; strict time limits are essential to avoid fatal hemorrhagic transformation."
        ]
      ],
      ex_fa: "در سکته مغزی حاد ایسکمیک، رد خونریزی با سی‌تی‌اسکن مغز بدون کنتراست نخستین گام است. در صورت نبود منع مصرف، tPA وریدی ظرف ۴.۵ ساعت تجویز می‌شود.",
      ex_en: "Non-contrast head CT must rule out hemorrhage prior to IV tPA, which must be initiated within 4.5 hours of symptom onset."
    }
  ],

  infect: [
    {
      q_fa: "درمان دارویی خط اول انتخابی در سیفلیس اولیه (شانکر سیفلیسی) کدام است؟",
      q_en: "What is the first-line treatment of choice for primary syphilis?",
      options: [
        [
          "بنزاتین پنی‌سیلین G تک‌دوز عضلانی به میزان ۲.۴ میلیون واحد",
          "Benzathine penicillin G 2.4 million units IM single dose",
          true,
          "صحیح است؛ درمان انتخابی سیفلیس اولیه، ثانویه و نهفته زودرس، تزریق یک نوبت بنزاتین پنی‌سیلین G عضلانی است که سطح خونی پایدار و موثری ایجاد می‌کند.",
          "Correct; single-dose intramuscular benzathine penicillin G is the definitive treatment for primary syphilis."
        ],
        [
          "آزیترومایسین خوراکی",
          "Oral azithromycin",
          false,
          "نادرست است؛ به دلیل گزارش‌های متعدد از مقاومت باکتری ترپونما پالیدوم به آنتی‌بیوتیک‌های ماکرولید، آزیترومایسین دیگر داروی خط اول درمان سیفلیس نیست.",
          "Incorrect; widespread resistance of Treponema pallidum to macrolides precludes its routine use."
        ],
        [
          "داکسی‌سایکلین خوراکی به عنوان خط اول",
          "Oral doxycycline as first line",
          false,
          "نادرست است؛ داکسی‌سایکلین (۱۰۰ میلی‌گرم دوبار در روز به مدت ۱۴ روز) فقط گزینه جایگزین و خط دوم در بیماران غیرباردار با حساسیت شدید تایید‌شده به پنی‌سیلین است.",
          "Incorrect; doxycycline is a second-line alternative reserved strictly for non-pregnant patients with penicillin allergy."
        ],
        [
          "سفتریاکسون وریدی به مدت یک ماه",
          "Intravenous ceftriaxone for one month",
          false,
          "نادرست است؛ سفتریاکسون درمان روتین سیفلیس اولیه نیست و نیازی به بستری یا درمان طولانی‌مدت وجود ندارد.",
          "Incorrect; prolonged parenteral third-generation cephalosporins are unnecessary and inappropriate for primary syphilis."
        ]
      ],
      ex_fa: "سیفلیس توسط اسپیروکت ترپونما پالیدوم ایجاد می‌شود. ضایعه اولیه شانکر بدون درد با قاعده تمیز و لبه‌های برجسته است. بنزاتین پنی‌سیلین تک‌دوز درمان ریشه‌کن‌کننده قطعی است.",
      ex_en: "Primary syphilis manifests as a painless indurated chancre. A single dose of benzathine penicillin G remains the gold standard therapy."
    }
  ],

  psych: [
    {
      q_fa: "طبق معیارهای تشخیصی استاندارد (DSM-5)، حداقل مدت تداوم علائم برای تایید تشخیص اسکیزوفرنی چقدر است؟",
      q_en: "According to DSM-5 criteria, what is the minimum duration of continuous disturbance required to diagnose schizophrenia?",
      options: [
        [
          "حداقل ۶ ماه تداوم نشانه‌ها (با حداقل ۱ ماه علائم فاز فعال)",
          "At least 6 months of continuous disturbance (including at least 1 month of active symptoms)",
          true,
          "صحیح است؛ تشخیص اسکیزوفرنی نیازمند تداوم علائم اختلال به مدت حداقل ۶ ماه است که باید شامل حداقل ۱ ماه علائم ملاک A (هذیان، توهم یا گفتار آشفته) باشد.",
          "Correct; DSM-5 requires continuous signs of disturbance for at least 6 months with 1 month of active-phase symptoms."
        ],
        [
          "حداقل ۱ ماه",
          "At least 1 month",
          false,
          "نادرست است؛ وجود علائم برای مدت بین ۱ تا ۶ ماه تحت عنوان «اختلال اسکیزوفرنیفرم» (Schizophreniform disorder) تشخیص داده می‌شود، نه اسکیزوفرنی.",
          "Incorrect; symptoms lasting between 1 and 6 months are classified as schizophreniform disorder."
        ],
        [
          "حداقل ۲ هفته",
          "At least 2 weeks",
          false,
          "نادرست است؛ مدت ۲ هفته معیار زمانی اپیزود افسردگی اساسی است و برای روان‌پریشی‌های اسکیزوفرنیک ناکافی است.",
          "Incorrect; 2 weeks is the duration criterion for major depressive episodes, not schizophrenia."
        ],
        [
          "حداقل ۱ سال",
          "At least 1 year",
          false,
          "نادرست است؛ نیازی به گذشت یک سال نیست و انتظار بیش از ۶ ماه باعث تاخیر غیرضروری در درمان موثر روان‌پریشی می‌گردد.",
          "Incorrect; 1 year is not required; waiting beyond 6 months delays formal diagnosis and management."
        ]
      ],
      ex_fa: "تشخیص اسکیزوفرنی نیازمند تداوم علائم برای حداقل ۶ ماه و اختلال عملکرد در زمینه‌های شغلی، تحصیلی یا اجتماعی است. فاز فعال شامل حداقل دو علامت از موارد هذیان، توهم، گفتار آشفته، رفتار حرکتی به شدت آشفته و علائم منفی است.",
      ex_en: "Schizophrenia requires ≥6 months of continuous disturbance with at least 1 month of active-phase psychotic symptoms and functional decline."
    }
  ],

  endo: [
    {
      q_fa: "طبق معیارهای انجمن دیابت (ADA)، کدام سطح از هموگلوبین گلیکوزیله (HbA1c) در دو نوبت مجزا ملاک تشخیص دیابت است؟",
      q_en: "According to ADA criteria, which HbA1c threshold confirms the diagnosis of diabetes mellitus?",
      options: [
        [
          "HbA1c برابر یا بیشتر از ۶.۵ درصد (≥ ۶.۵٪)",
          "HbA1c ≥ 6.5%",
          true,
          "صحیح است؛ HbA1c برابر یا بالاتر از ۶.۵ درصد (با تکرار آزمایش در نوبت دیگر یا همراهی با علائم بالینی پرنوشی و پرادراری) یکی از ملاک‌های قطعی تشخیص دیابت است.",
          "Correct; HbA1c ≥ 6.5% repeated or accompanied by unequivocal hyperglycemia confirms diabetes mellitus."
        ],
        [
          "HbA1c بین ۵.۷ تا ۶.۴ درصد",
          "HbA1c between 5.7% and 6.4%",
          false,
          "نادرست است؛ این محدوده نشان‌دهنده «پیش‌دیابت» (Pre-diabetes / اختلال در تحمل گلوکز) و خطر افزایش‌یافته ابتلا به دیابت است، نه بیماری دیابت.",
          "Incorrect; 5.7% to 6.4% defines prediabetes (impaired glucose regulation)."
        ],
        [
          "HbA1c فقط در مقادیر بالاتر از ۷.۵ درصد",
          "HbA1c ≥ 7.5% only",
          false,
          "نادرست است؛ ملاک تشخیصی دیابت از ۶.۵ درصد آغاز می‌شود و انتظار برای رسیدن به ۷.۵ درصد باعث تاخیر خطرناک در شناسایی و مداخله زودهنگام می‌گردد.",
          "Incorrect; diagnostic threshold is 6.5%; waiting for 7.5% delays critical intervention."
        ],
        [
          "HbA1c کمتر از ۵.۷ درصد",
          "HbA1c < 5.7%",
          false,
          "نادرست است؛ مقادیر کمتر از ۵.۷ درصد نشان‌دهنده تنظیم کاملاً طبیعی قند خون است.",
          "Incorrect; values below 5.7% represent normal glycemic regulation."
        ]
      ],
      ex_fa: "معیارهای تشخیصی دیابت شامل: ۱) HbA1c ≥ ۶.۵٪، ۲) قند خون ناشتا (FBS) ≥ ۱۲۶ میلی‌گرم، ۳) قند ۲ ساعته تست تحمل گلوکز (OGTT) ≥ ۲۰۰، یا ۴) قند تصادفی ≥ ۲۰۰ همراه با علائم کلاسیک هایپرگلیسمی است.",
      ex_en: "Criteria for diabetes: HbA1c ≥ 6.5%, FPG ≥ 126 mg/dL, 2-h PG ≥ 200 mg/dL during OGTT, or random PG ≥ 200 mg/dL with classic symptoms."
    }
  ],

  nephro: [
    {
      q_fa: "شایع‌ترین علت نارسایی حاد کلیه از نوع پیش‌کلیوی (Prerenal AKI) کدام است؟",
      q_en: "What is the most common cause of prerenal acute kidney injury (AKI)?",
      options: [
        [
          "کاهش حجم موثر داخل عروقی و هیپوولمی",
          "Effective intravascular volume depletion and hypovolemia",
          true,
          "صحیح است؛ هیپوولمی ناشی از اتلاف مایعات (اسهال، استفراغ، خونریزی، سوختگی یا مصرف زیاد دیورتیک) و افت پرفیوژن کلیوی، شایع‌ترین علت نارسایی کلیه پیش‌کلیوی است.",
          "Correct; volume depletion from fluid losses or hemorrhage leading to renal hypoperfusion is the primary cause of prerenal AKI."
        ],
        [
          "گلومرولونفریت حاد پس از عفونت",
          "Acute post-infectious glomerulonephritis",
          false,
          "نادرست است؛ گلومرولونفریت از علل آسیب پارانشیمی و ذاتی کلیه (Intrinsic renal AKI) است، نه پیش‌کلیوی.",
          "Incorrect; glomerulonephritis is an intrinsic parenchymal renal cause, not prerenal."
        ],
        [
          "انسداد دوطرفه مجاری ادراری و حالب‌ها",
          "Bilateral ureteral or bladder outlet obstruction",
          false,
          "نادرست است؛ انسداد در مسیر خروج ادرار در دسته نارسایی پس‌کلیوی (Postrenal AKI) طبقه‌بندی می‌شود.",
          "Incorrect; urinary outflow obstruction constitutes postrenal AKI."
        ],
        [
          "نکروز حاد توبولار ناشی از سموم (ATN)",
          "Nephrotoxic acute tubular necrosis (ATN)",
          false,
          "نادرست است؛ ATN آسیب ساختاری به سلول‌های اپیتلیوم توبول‌های کلیه است و جزو علل ذاتی نارسایی محسوب می‌شود.",
          "Incorrect; ATN causes direct tubular cellular necrosis, categorized as intrinsic renal failure."
        ]
      ],
      ex_fa: "در AKI پیش‌کلیوی، پارانشیم کلیه سالم است و اختلال ناشی از افت خونرسانی است (BUN/Cr > ۲۰ و FENa < ۱٪). تجویز مایعات و جبران حجم، عملکرد کلیه را به سرعت به حالت طبیعی برمی‌گرداند.",
      ex_en: "Prerenal AKI results from decreased renal perfusion without structural parenchymal damage, characterized by BUN/Cr > 20 and FENa < 1%."
    }
  ],

  heme: [
    {
      q_fa: "شایع‌ترین نوع کم‌خونی در سراسر جهان و در تمام گروه‌های سنی کدام است؟",
      q_en: "What is the most common type of anemia worldwide across all age groups?",
      options: [
        [
          "کم‌خونی فقر آهن (میکروسیتیک هیپوکرومیک)",
          "Iron deficiency anemia (microcytic hypochromic)",
          true,
          "صحیح است؛ کم‌خونی فقر آهن به دلیل دریافت ناکافی، سوءجذب یا اتلاف مزمن خون (قاعدگی یا گوارشی)، شایع‌ترین علت آنمی در تمام نقاط جهان است.",
          "Correct; iron deficiency is by far the leading cause of anemia worldwide."
        ],
        [
          "کم‌خونی سیدروبلاستیک",
          "Sideroblastic anemia",
          false,
          "نادرست است؛ آنمی سیدروبلاستیک ناشی از نقص در سنتز مولکول هم است و اختلالی بسیار نادر محسوب می‌شود.",
          "Incorrect; sideroblastic anemia involves defective heme synthesis and is comparatively rare."
        ],
        [
          "کم‌خونی آپلاستیک ناشی از نارسایی مغز استخوان",
          "Aplastic anemia from bone marrow failure",
          false,
          "نادرست است؛ آنمی آپلاستیک با پان‌سیتوپنی و مغز استخوان هیپوسلولار تظاهر می‌کند و شیوع بسیار پایینی دارد.",
          "Incorrect; aplastic anemia causes pancytopenia from marrow failure and has a low incidence."
        ],
        [
          "کم‌خونی همولیتیک خودایمنی",
          "Autoimmune hemolytic anemia",
          false,
          "نادرست است؛ همولیز خودایمنی ناشی از تخریب گلبول‌های قرمز توسط آنتی‌بادی‌هاست و شیوع بسیار کمتری نسبت به فقر تغذیه‌ای آهن دارد.",
          "Incorrect; hemolytic anemias are uncommon compared to nutritional iron deficiency."
        ]
      ],
      ex_fa: "کم‌خونی فقر آهن با افت فریتین سرم (< ۳۰ ng/mL)، کاهش آهن و افزایش ظرفیت اتصال آهن (TIBC) مشخص می‌شود. در مردان و زنان یائسه، بررسی اندوسکوپیک دستگاه گوارش جهت رد بدخیمی الزامی است.",
      ex_en: "Iron deficiency anemia is characterized by low ferritin and high TIBC. In men and postmenopausal women, GI investigation is mandatory to rule out occult malignancy."
    }
  ],

  pulmo: [
    {
      q_fa: "در بیمار با احتمال بالینی بالا برای ترومبوآمبولی ریه (PE) که از نظر همودینامیک پایدار است، روش تشخیصی انتخابی کدام است؟",
      q_en: "In a hemodynamically stable patient with high clinical probability of pulmonary embolism, what is the diagnostic test of choice?",
      options: [
        [
          "سی‌تی آنژیوگرافی عروق ریه (CTPA)",
          "CT pulmonary angiography (CTPA)",
          true,
          "صحیح است؛ در بیماران با احتمال بالینی بالا، روش استاندارد طلایی تصویربرداری تشخیصی فوری، CTPA با کنتراست عروقی است.",
          "Correct; CTPA is the definitive first-line diagnostic imaging modality in high-probability PE."
        ],
        [
          "اندازه‌گیری سطح خونی D-dimer",
          "Serum D-dimer assay",
          false,
          "نادرست است؛ در احتمال بالینی بالا، تست D-dimer جایگاهی ندارد زیرا منفی کاذب آن می‌تواند گمراه‌کننده باشد؛ دی-دایمر صرفاً برای رد PE در افراد با احتمال پایین یا متوسط اندیکاسیون دارد.",
          "Incorrect; D-dimer is used to rule out PE in low/intermediate probability patients; a negative test cannot reliably rule out high-probability PE."
        ],
        [
          "اکوکاردیوگرافی از راه قفسه سینه به عنوان تست اولیه",
          "Transthoracic echocardiography as the primary test",
          false,
          "نادرست است؛ اکوکاردیوگرافی در بیماران «ناپایدار همودینامیک» برای بررسی فشار حاد بطن راست انجام می‌شود، اما در بیمار پایدار تست تشخیصی استاندارد نیست.",
          "Incorrect; bedside echo evaluates unstable patients with shock, but CTPA is preferred in stable individuals."
        ],
        [
          "عکس ساده قفسه سینه (CXR) به تنهایی",
          "Plain chest radiography alone",
          false,
          "نادرست است؛ CXR اغلب نرمال است یا یافته‌های غیراختصاصی دارد و قادر به اثبات یا رد ترومبوز عروق ریه نیست.",
          "Incorrect; chest X-ray cannot diagnose PE directly and serves only to exclude alternative etiologies."
        ]
      ],
      ex_fa: "در آمبولی ریه، طبق معیار ولز (Wells score) در صورت احتمال بالا، بیمار باید بدون فوت وقت تحت CTPA قرار گیرد. در صورت نبود منع مصرف، درمان ضدانعقاد (هپارین) باید همزمان آغاز شود.",
      ex_en: "In high-probability PE, proceed directly to CTPA. Anticoagulation should be initiated promptly while awaiting imaging unless contraindicated."
    }
  ],

  rheum: [
    {
      q_fa: "کدام آنتی‌بادی بیشترین ویژگی تشخیصی را برای بیماری لوپوس اریتماتوز سیستمیک (SLE) دارد؟",
      q_en: "Which autoantibody is most specific for systemic lupus erythematosus (SLE)?",
      options: [
        [
          "آنتی‌بادی ضد DNA دو‌رشته‌ای (Anti-dsDNA) و آنتی‌اسمیت (Anti-Smith)",
          "Anti-double-stranded DNA (Anti-dsDNA) and Anti-Smith",
          true,
          "صحیح است؛ Anti-dsDNA و Anti-Smith ویژگی بسیار بالایی (>۹۵٪) برای لوپوس دارند؛ تیتر Anti-dsDNA همچنین با فعالیت بیماری و نفریت لوپوسی همبستگی دارد.",
          "Correct; Anti-dsDNA and Anti-Smith autoantibodies have high specificity (>95%) for SLE."
        ],
        [
          "فاکتور روماتوئید (RF)",
          "Rheumatoid factor (RF)",
          false,
          "نادرست است؛ RF در آرتریت روماتوئید، سندرم شوگرن و عفونت‌های مزمن مثبت می‌شود و اختصاصیتی برای بیماری لوپوس ندارد.",
          "Incorrect; rheumatoid factor is primarily associated with rheumatoid arthritis and chronic infections."
        ],
        [
          "آنتی‌بادی ضد پپتید حلقوی سیترولینه‌شده (Anti-CCP)",
          "Anti-cyclic citrullinated peptide (Anti-CCP)",
          false,
          "نادرست است؛ Anti-CCP مارکر فوق‌العاده اختصاصی برای «آرتریت روماتوئید» است، نه لوپوس.",
          "Incorrect; Anti-CCP is highly specific for rheumatoid arthritis."
        ],
        [
          "آنتی‌بادی ضد سیتوپلاسم نوتروفیل (ANCA)",
          "Anti-neutrophil cytoplasmic antibodies (ANCA)",
          false,
          "نادرست است؛ ANCA نشانگر واسکولیت‌های عروق کوچک نظیر گرانولوماتوز با پلی‌آنژئیت (وگنر) و پلی‌آنژئیت میکروسکوپیک است.",
          "Incorrect; ANCA is associated with systemic necrotizing vasculitides, not SLE."
        ]
      ],
      ex_fa: "ANA حساس‌ترین تست غربالگری لوپوس است (>۹۸٪)، اما اختصاصی نیست. برعکس، Anti-dsDNA و Anti-Smith اختصاصی‌ترین مارکرهای تشخیصی SLE هستند.",
      ex_en: "ANA is sensitive for screening, whereas Anti-dsDNA and Anti-Smith are highly specific for SLE."
    }
  ],

  path: [
    {
      q_fa: "کدام یک از تغییرات زیر نشانه قطعی آسیب برگشت‌ناپذیر سلولی و نکروز است؟",
      q_en: "Which cellular alteration indicates irreversible cell injury and cell death?",
      options: [
        [
          "تخریب، تراکم و خرد شدن هسته سلول (پیکنوز، کاریورکسی و کاریولیز)",
          "Nuclear breakdown (pyknosis, karyorrhexis, and karyolysis)",
          true,
          "صحیح است؛ تغییرات هسته‌ای شامل انقباض شدید کروماتین (پیکنوز)، قطعه‌قطعه شدن هسته (کاریورکسی) و حل شدن آن (کاریولیز) همراه با پارگی غشای سلول، علائم قطعی مرگ برگشت‌ناپذیر سلول هستند.",
          "Correct; nuclear pyknosis, karyorrhexis, and karyolysis signify irreversible cell death."
        ],
        [
          "تورم حاد سلولی (دژنراسیون واکوئولی)",
          "Acute cellular swelling (hydropic change)",
          false,
          "نادرست است؛ تورم سلولی ناشی از اختلال موقت در پمپ سدیم-پتاسیم است و با برقراری مجدد اکسیژن‌رسانی کاملاً برگشت‌پذیر است.",
          "Incorrect; cellular swelling reflects reversible failure of plasma membrane ATP-dependent ionic pumps."
        ],
        [
          "تجمع قطرات چربی درون‌سلولی (استئاتوز)",
          "Intracellular lipid accumulation (fatty change)",
          false,
          "نادرست است؛ تغییر چربی در بافت‌هایی مثل کبد یک آسیب زودرس و برگشت‌پذیر ناشی از نقص متابولیسم لیپیدها است.",
          "Incorrect; steatosis represents a reversible manifestation of sublethal metabolic derangement."
        ],
        [
          "کاهش موقت در غلظت ATP درون سلول",
          "Transient depletion of intracellular ATP",
          false,
          "نادرست است؛ افت خفیف ATP با بازگشت خونرسانی و فسفوریلاسیون اکسیداتیو جبران شده و به تنهایی نشانه مرگ سلول نیست.",
          "Incorrect; transient ATP depletion reverses upon restoration of oxidative phosphorylation."
        ]
      ],
      ex_fa: "آسیب برگشت‌پذیر با تورم سلولی، برآمدگی غشا و تجمع چربی تظاهر می‌یابد. پارگی غشای سلولی، ورود کلسیم و تغییرات تخریبی هسته نشان‌دهنده ورود سلول به فاز غیرقابل برگشت و نکروز است.",
      ex_en: "Reversible injury features swelling and steatosis; loss of membrane integrity and nuclear pyknosis/karyolysis define irreversible cell death."
    }
  ],

  derm: [
    {
      q_fa: "ضایعات پوستی به شکل هدف یا چشم گاو (Target or Iris lesions) تظاهر کلاسیک کدام بیماری است؟",
      q_en: "Target (iris) skin lesions are characteristic of which disease?",
      options: [
        [
          "اریتم مولتی‌فرم (Erythema Multiforme)",
          "Erythema multiforme",
          true,
          "صحیح است؛ ضایعات هدف با سه منطقه متحدالمرکز (مرکز تیره یا تاول، حلقه رنگ‌پریده میانی و حاشیه اریتماتوز برجسته) تظاهر شاخص اریتم مولتی‌فرم است که اغلب به دنبال عفونت هرپس سیمپلکس (HSV) رخ می‌دهد.",
          "Correct; targetoid lesions with concentric concentric zones of erythema and pallor are the pathognomonic finding of erythema multiforme."
        ],
        [
          "پسوریازیس ولگاریس",
          "Psoriasis vulgaris",
          false,
          "نادرست است؛ پسوریازیس با پلاک‌های اریتماتوز با حدود مشخص و پوسته‌های نقره‌ای‌رنگ در سطوح اکستنسور (آرنج و زانو) مشخص می‌شود.",
          "Incorrect; plaque psoriasis presents with well-demarcated salmon-pink plaques covered by silvery-white scales."
        ],
        [
          "پمفیگوس ولگاریس",
          "Pemphigus vulgaris",
          false,
          "نادرست است؛ پمفیگوس یک بیماری خودایمنی تاولی داخل‌اپیدرمی است که با تاول‌های شل و پارگی سریع همراه با گرفتاری دردناک مخاط دهان تظاهر می‌یابد.",
          "Incorrect; pemphigus vulgaris presents with flaccid intraepidermal bullae and mucosal erosions."
        ],
        [
          "لیکن پلان",
          "Lichen planus",
          false,
          "نادرست است؛ ضایعات لیکن پلان با پاپول‌های بنفش، چندضلعی، خارش‌دار و مسطح در مچ دست‌ها مشخص می‌گردد (قانون 6P).",
          "Incorrect; lichen planus is characterized by pruritic, purple, polygonal, planar papules."
        ]
      ],
      ex_fa: "اریتم مولتی‌فرم واکنش ازدیاد حساسیت پوستی-مخاطی حاد است. شایع‌ترین محرک آن عفونت راجعه با ویروس هرپس سیمپلکس (HSV) و پس از آن عفونت با مایکوپلاسما پنومونیه و داروها است.",
      ex_en: "Erythema multiforme is characterized by targetoid lesions, most commonly triggered by herpes simplex virus reactivation."
    }
  ],

  ortho: [
    {
      q_fa: "شایع‌ترین شکستگی مچ دست در افراد مسن به دنبال افتادن روی دست بازشده (FOOSH) کدام است؟",
      q_en: "What is the most common wrist fracture in the elderly resulting from a fall onto an outstretched hand (FOOSH)?",
      options: [
        [
          "شکستگی کالیس (Colles fracture)",
          "Colles fracture",
          true,
          "صحیح است؛ شکستگی کالیس ناشی از شکستگی متافیز دیستال رادیوس با جابجایی خلفی (دورسال) قطعه استخوانی است که تغییر شکل مشخص «چنگالی» (Dinner-fork deformity) ایجاد می‌کند.",
          "Correct; Colles fracture is a distal radius metaphyseal fracture with dorsal displacement, producing the classic dinner-fork deformity."
        ],
        [
          "شکستگی اسمیت (Smith fracture / کالیس معکوس)",
          "Smith fracture (reverse Colles)",
          false,
          "نادرست است؛ شکستگی اسمیت ناشی از افتادن روی مچ دست در وضعیت خم‌شده (فلکسیون) است که منجر به جابجایی قدامی (ولار) قطعه دیستال می‌شود.",
          "Incorrect; Smith fracture involves volar displacement resulting from a fall onto a flexed wrist."
        ],
        [
          "شکستگی استخوان اسکافوئید (ناوی)",
          "Scaphoid bone fracture",
          false,
          "نادرست است؛ شکستگی اسکافوئید شایع‌ترین شکستگی کارپال در جوانان و ورزشکاران است، نه شکستگی غالب مچ در سالمندان با پوکی استخوان.",
          "Incorrect; scaphoid fracture is typical in young active adults with anatomical snuffbox tenderness."
        ],
        [
          "شکستگی بارتون (Barton fracture)",
          "Barton fracture",
          false,
          "نادرست است؛ شکستگی بارتون شکستگی-دررفتگی داخل‌مفصلی لبه دیستال رادیوس است و شیوع کمتری دارد.",
          "Incorrect; Barton fracture is an unstable fracture-dislocation of the radiocarpal joint."
        ]
      ],
      ex_fa: "شکستگی کالیس شایع‌ترین آسیب مچ دست در افراد استئوپروتیک است. درمان شامل جااندازی بسته و گچ‌گیری در وضعیت خمش و انحراف اولنار، یا تثبیت جراحی در موارد ناپایدار است.",
      ex_en: "Colles fracture involves dorsal displacement of the distal radial fragment following a FOOSH injury in osteoporotic patients."
    }
  ],

  pharm: [
    {
      q_fa: "پادزهر اختصاصی (Antidote) در مسمومیت حاد با داروی استامینوفن (پاراستامول) کدام است؟",
      q_en: "What is the specific antidote for acute acetaminophen (paracetamol) toxicity?",
      options: [
        [
          "ان-استیل‌سیستئین (N-acetylcysteine / NAC)",
          "N-acetylcysteine (NAC)",
          true,
          "صحیح است؛ NAC با بازسازی ذخایر گلوتاتیون هپاتوسیت‌ها و اتصال به متابولیت فوق‌العاده سمی NAPQI، از نکروز سلول‌های کبد و نارسایی حاد کبدی پیشگیری می‌نماید.",
          "Correct; N-acetylcysteine restores hepatic glutathione pools and neutralizes toxic NAPQI, preventing fulminant hepatic necrosis."
        ],
        [
          "نالوکسان وریدی",
          "Intravenous naloxone",
          false,
          "نادرست است؛ نالوکسان آنتاگونیست رقابتی گیرنده‌های اوپیوئیدی است و پادزهر اختصاصی مسمومیت با تریاک، مرفین و متادون است.",
          "Incorrect; naloxone is the specific opioid receptor antagonist used in narcotic overdose."
        ],
        [
          "فلومازنیل وریدی",
          "Intravenous flumazenil",
          false,
          "نادرست است؛ فلومازنیل آنتاگونیست گیرنده بنزودیازپین‌ها (دیازپام، آلپرازولام) است و در اوردوز استامینوفن هیچ اثری ندارد.",
          "Incorrect; flumazenil reverses benzodiazepines, not acetaminophen."
        ],
        [
          "آتروپین سولفات",
          "Atropine sulfate",
          false,
          "نادرست است؛ آتروپین آنتی‌کولینرژیک اختصاصی برای درمان مسمومیت با سموم ارگانوفسفره، حشره‌کش‌ها و شوک‌های با برادی‌کاردی شدید است.",
          "Incorrect; atropine treats organophosphate poisoning and symptomatic bradycardia."
        ]
      ],
      ex_fa: "سمیت استامینوفن ناشی از اشباع مسیر گلوکورونیداسیون و تولید متابولیت توکسیک NAPQI است. ان-استیل‌سیستئین (NAC) اگر در ۸ ساعت اول پس از بلع تجویز شود، اثربخشی نزدیک به ۱۰۰٪ در حفاظت کبدی دارد.",
      ex_en: "Acetaminophen toxicity results from toxic metabolite NAPQI accumulation. N-acetylcysteine replenishes glutathione and is virtually 100% hepatoprotective within 8 hours."
    }
  ],

  uro: [
    {
      q_fa: "باریک‌ترین نقطه آناتومیک و شایع‌ترین محل گیر افتادن سنگ در مجاری ادراری کدام است؟",
      q_en: "What is the narrowest anatomical site and most common location for ureteral stone impaction?",
      options: [
        [
          "محل اتصال حالب به مثانه (اتصال وزیکویورترال / UVJ)",
          "Ureterovesical junction (UVJ)",
          true,
          "صحیح است؛ اتصال وزیکویورترال (UVJ) با قطر داخلی حدود ۱ تا ۲ میلی‌متر باریک‌ترین بخش حالب است و شایع‌ترین محل به دام افتادن سنگ‌های کلیوی به شمار می‌رود.",
          "Correct; the ureterovesical junction is the narrowest point of the ureter and the most frequent site of stone impaction."
        ],
        [
          "محل اتصال لگنچه به حالب (UPJ)",
          "Ureteropelvic junction (UPJ)",
          false,
          "نادرست است؛ اتصال UPJ اولین تنگی آناتومیک حالب است، اما قطر آن از UVJ بازتر بوده و شیوع گیر افتادن سنگ در آن کمتر است.",
          "Incorrect; UPJ is the proximal constriction, but impaction is less frequent than at the narrower UVJ."
        ],
        [
          "محل عبور حالب از روی عروق ایلیاک در لبه لگن",
          "Crossing of the iliac vessels at the pelvic brim",
          false,
          "نادرست است؛ این محل تنگی میانی حالب است و دومین محل گیر افتادن محسوب می‌شود، نه شایع‌ترین.",
          "Incorrect; the pelvic brim crossing is the middle constriction point, but less common than UVJ."
        ],
        [
          "مجرای خروجی ادرار (پیشابراه / Urethra)",
          "Urethra",
          false,
          "نادرست است؛ قطر پیشابراه به مراتب از حالب بازتر است و سنگی که از UVJ عبور کند، معمولاً بدون گیر افتادن دفع می‌گردد مگر در تنگی‌های قبلی.",
          "Incorrect; stones that traverse the ureter usually pass through the wider urethra spontaneously."
        ]
      ],
      ex_fa: "حالب دارای سه تنگی طبیعی است: ۱) اتصال UPJ، ۲) تقاطع عروق ایلیاک، و ۳) ورود به جدار مثانه (UVJ). اتصال UVJ باریک‌ترین نقطه بوده و علائم تکرر و سوزش ادرار را همراه درد پهلو ایجاد می‌کند.",
      ex_en: "The ureter has three physiologic constrictions: UPJ, pelvic brim, and UVJ. The UVJ is the narrowest and most common impaction site."
    }
  ],

  ophth: [
    {
      q_fa: "اورژانس حاد چشم‌پزشکی با تظاهر درد شدید چشم و سردرد، قرمزی مژگانی، تاری دید، دیدن هاله دور نورها و مردمک نیمه‌گشاد غیرپاسخگو کدام است؟",
      q_en: "An ophthalmic emergency presenting with severe ocular pain, ciliary injection, blurred vision, colored halos, and a fixed mid-dilated pupil is?",
      options: [
        [
          "گلوکوم حاد زاویه بسته (Acute Angle-Closure Glaucoma)",
          "Acute angle-closure glaucoma",
          true,
          "صحیح است؛ انسداد ناگهانی شبکه ترابکولار توسط ریشه‌های عنبیه منجر به افزایش انفجاری فشار داخل کره چشم (IOP > ۴۰-۵۰ mmHg)، ادم قرنیه و مردمک نیمه‌گشاد و غیرواکنش به نور می‌شود.",
          "Correct; acute angle-closure glaucoma causes marked elevation of intraocular pressure, corneal edema, and a fixed mid-dilated pupil."
        ],
        [
          "جداشدگی حاد پرده شبکیه (Retinal Detachment)",
          "Acute retinal detachment",
          false,
          "نادرست است؛ جداشدگی شبکیه یک عارضه کاملاً بدون درد است که با دیدن جرقه‌های نورانی (فوتوپسی)، مگس‌پران و افتادن پرده سایه‌وار تیره در میدان دید مشخص می‌شود.",
          "Incorrect; retinal detachment is painless and manifests with photopsias, floaters, and a curtain-like visual field defect."
        ],
        [
          "التهاب ملتحمه حاد باکتریال (Conjunctivitis)",
          "Acute bacterial conjunctivitis",
          false,
          "نادرست است؛ کونژانکتیویت با ترشحات چرکی و چسبندگی پلک‌ها همراه است، اما هیچ‌گاه درد شدید، مردمک غیرطبیعی یا افزایش فشار چشم ایجاد نمی‌کند.",
          "Incorrect; conjunctivitis causes discharge without deep pain, pupillary changes, or elevated IOP."
        ],
        [
          "انسداد شریان مرکزی شبکیه (CRAO)",
          "Central retinal artery occlusion (CRAO)",
          false,
          "نادرست است؛ CRAO کاهش دید ناگهانی و بدون درد ایجاد می‌کند و در افتالموسکوپی با لکه قرمز گیلاسی در ماکولا مشخص می‌شود.",
          "Incorrect; CRAO presents with sudden, catastrophic painless vision loss and a cherry-red foveal spot."
        ]
      ],
      ex_fa: "گلوکوم حاد زاویه بسته یک اورژانس فوری است. درمان دارویی سریع برای پایین آوردن فشار چشم شامل مهارکننده کربنیک انیدراز (استازولامید)، قطره تیمولول، پیلوکارپین و مانیتول وریدی است تا درمان قطعی با لیزر ایریدوتومی انجام شود.",
      ex_en: "Acute angle-closure glaucoma requires emergency pressure-lowering medical therapy followed by definitive laser peripheral iridotomy."
    }
  ],

  ent: [
    {
      q_fa: "شایع‌ترین پاتوژن باکتریال در ایجاد اوتیت مدیای حاد (AOM) در کودکان کدام است؟",
      q_en: "What is the most common bacterial pathogen responsible for acute otitis media in children?",
      options: [
        [
          "استرپتوکوک پنومونیه (Streptococcus pneumoniae)",
          "Streptococcus pneumoniae",
          true,
          "صحیح است؛ استرپتوکوک پنومونیه شایع‌ترین عامل باکتریال اوتیت میانی حاد است و به دنبال آن هموفیلوس آنفلوانزای بدون کپسول و موراکسلا کاتارالیس قرار دارند.",
          "Correct; Streptococcus pneumoniae is the leading bacterial cause of acute otitis media."
        ],
        [
          "سودوموناس آئروژینوزا",
          "Pseudomonas aeruginosa",
          false,
          "نادرست است؛ سودوموناس عامل شایع اوتیت خارجی («گوش شناگران») یا اوتیت خارجی بدخیم در بیماران مبتلا به دیابت است، نه اوتیت مدیای حاد معمول.",
          "Incorrect; Pseudomonas causes otitis externa (swimmer's ear) and malignant otitis externa, not typical AOM."
        ],
        [
          "استافیلوکوک اورئوس",
          "Staphylococcus aureus",
          false,
          "نادرست است؛ استافیلوکوک عامل کورک و عفونت‌های موضعی مجرای گوش خارجی است و در پاتوژنز اوتیت میانی کودکان نادر است.",
          "Incorrect; S. aureus causes localized furuncles of the external ear canal."
        ],
        [
          "کلبسیلا پنومونیه",
          "Klebsiella pneumoniae",
          false,
          "نادرست است؛ کلبسیلا عامل پنومونی‌های آسپیراسیون در الکلی‌ها و عفونت‌های بیمارستانی است و نقشی در اوتیت اطفال ندارد.",
          "Incorrect; Klebsiella causes hospital-acquired or aspiration pneumonia, not pediatric AOM."
        ]
      ],
      ex_fa: "اوتیت میانی حاد با برآمدگی پرده تمپان، اریتم و تب تظاهر می‌کند. داروی خط اول انتخابی، آنتی‌بیوتیک آموکسی‌سیلین خوراکی با دوز بالا (۸۰ تا ۹۰ میلی‌گرم بر کیلوگرم در روز) است.",
      ex_en: "S. pneumoniae is the predominant pathogen in acute otitis media. High-dose amoxicillin is the first-line antibiotic of choice."
    }
  ],

  radio: [
    {
      q_fa: "بهترین روش تصویربرداری اولیه با بالاترین حساسیت و ویژگی برای تشخیص کولیک کلیوی و سنگ‌های ادراری کدام است؟",
      q_en: "What is the initial imaging modality of choice with the highest sensitivity and specificity for suspected nephrolithiasis?",
      options: [
        [
          "سی‌تی‌اسکن اسپیرال شکم و لگن بدون تزریق کنتراست (NCCT)",
          "Non-contrast helical CT of the abdomen and pelvis (NCCT)",
          true,
          "صحیح است؛ سی‌تی‌اسکن هلیکال بدون کنتراست با حساسیت و ویژگی بالای ۹۸ درصد، استاندارد طلایی تصویربرداری سنگ‌های کلیه و حالب در بیماران بزرگسال غیرباردار است.",
          "Correct; non-contrast helical CT is the gold standard imaging modality for urinary tract calculi with >98% accuracy."
        ],
        [
          "تصویربرداری تشدید مغناطیسی (MRI شکم)",
          "Magnetic resonance imaging (MRI)",
          false,
          "نادرست است؛ کلسیم و سنگ‌های ادراری سیگنال ضعیفی در MRI تولید می‌کنند و این روش برای رویت مستقیم سنگ‌ها ناکارآمد است.",
          "Incorrect; calcified stones lack mobile protons and produce signal voids, making MRI poor for stone detection."
        ],
        [
          "عکس رادیوگرافی ساده شکم (KUB)",
          "Plain abdominal radiography (KUB)",
          false,
          "نادرست است؛ رادیوگرافی ساده حساسیت پایینی (حدود ۵۰٪) دارد و سنگ‌های رادیولوسنت نظیر سنگ‌های اسید اوریک را هرگز نشان نمی‌دهد.",
          "Incorrect; plain KUB has low sensitivity (~50%) and misses radiolucent uric acid stones."
        ],
        [
          "توموگرافی گسیل پوزیترون (PET Scan)",
          "Positron emission tomography (PET)",
          false,
          "نادرست است؛ پت‌اسکن تصویربرداری متابولیک در انکولوژی است و هیچ جایگاهی در ارزیابی کولیک کلیوی ندارد.",
          "Incorrect; PET imaging evaluates neoplastic metabolic activity and has no role in acute nephrolithiasis."
        ]
      ],
      ex_fa: "سی‌تی‌اسکن بدون کنتراست اندازه، محل دقیق سنگ و شواهد انسداد (هیدرونفروز) را مشخص می‌کند. در زنان باردار و کودکان، سونوگرافی شکم و لگن روش خط اول است تا از پرتوگیری پرهیز شود.",
      ex_en: "Non-contrast CT accurately identifies stone size and location. Renal ultrasonography is the preferred alternative in pregnant women and children."
    }
  ],

  stats: [
    {
      q_fa: "کدام شاخص آماری نشان‌دهنده توانایی یک تست در منفی شدن در افراد کاملاً سالم و فاقد بیماری است؟",
      q_en: "Which statistical parameter measures a diagnostic test's ability to correctly identify individuals who do NOT have the disease?",
      options: [
        [
          "ویژگی تست (Specificity / نرخ منفی‌های واقعی)",
          "Specificity (True negative rate)",
          true,
          "صحیح است؛ ویژگی تست برابر با نسبت افراد سالمی است که پاسخ تست آن‌ها به درستی منفی می‌شود (TN / [TN + FP]) و با نرخ مثبت کاذب رابطه معکوس دارد.",
          "Correct; specificity measures the proportion of disease-free individuals who correctly test negative (TN / [TN + FP])."
        ],
        [
          "حساسیت تست (Sensitivity / نرخ مثبت‌های واقعی)",
          "Sensitivity (True positive rate)",
          false,
          "نادرست است؛ حساسیت توانایی تست در مثبت شدن در افراد «بیمار» (TP / [TP + FN]) است.",
          "Incorrect; sensitivity measures the proportion of affected individuals who test positive."
        ],
        [
          "شیوع بیماری در جامعه (Prevalence)",
          "Prevalence",
          false,
          "نادرست است؛ شیوع نشان‌دهنده کل موارد موجود یک بیماری در یک مقطع زمانی در جمعیت است و ویژگی تست تشخیصی نیست.",
          "Incorrect; prevalence represents the total existing disease burden in a population at a specific time."
        ],
        [
          "میزان بروز بیماری (Incidence)",
          "Incidence",
          false,
          "نادرست است؛ بروز به موارد جدید بیماری در یک دوره زمانی مشخص اشاره دارد.",
          "Incorrect; incidence measures the rate of new cases arising in a population over time."
        ]
      ],
      ex_fa: "حساسیت بالا برای تست‌های «غربالگری» لازم است تا بیمار از دست نرود (قانون SnNOut). ویژگی بالا برای تست‌های «تایید تشخیصی» ضروری است تا مثبت کاذب رخ ندهد (قانون SpPIn).",
      ex_en: "Sensitivity is crucial for ruling out disease in screening (SnNOut), whereas specificity is essential for confirmation (SpPIn)."
    }
  ],

  ethics: [
    {
      q_fa: "کدام اصل اخلاق پزشکی بر حق مسلم بیمار در پذیرش یا رد درمان و اخذ رضایت آگاهانه تاکید دارد؟",
      q_en: "Which bioethical principle emphasizes the patient's right to accept or refuse treatment through informed consent?",
      options: [
        [
          "احترام به خودمختاری بیمار (Autonomy)",
          "Respect for patient autonomy",
          true,
          "صحیح است؛ اصل خودمختاری تصریح می‌کند که هر بیمار با ظرفیت تصمیم‌گیری، حق دارد با آگاهی کامل از خطرات و گزینه‌ها، روند درمانی خود را تعیین کند.",
          "Correct; autonomy affirms a competent patient's fundamental right to self-determination and informed consent."
        ],
        [
          "اصل سودرسانی (Beneficence)",
          "Beneficence",
          false,
          "نادرست است؛ سودرسانی وظیفه اخلاقی پزشک در راستای ارتقای سلامتی و انجام بهترین اقدامات به نفع بیمار است.",
          "Incorrect; beneficence obligates healthcare providers to act for the patient's benefit."
        ],
        [
          "اصل عدالت (Justice)",
          "Justice",
          false,
          "نادرست است؛ عدالت بر توزیع منصفانه و برابر منابع درمانی بدون تبعیض میان افراد تمرکز دارد.",
          "Incorrect; justice pertains to the fair, equitable allocation of healthcare resources."
        ],
        [
          "اصل عدم آسیب‌رسانی (Non-maleficence)",
          "Non-maleficence",
          false,
          "نادرست است؛ این اصل بر پرهیز از آسیب و صدمه زدن به بیمار («نخست آسیب نرسان») استوار است.",
          "Incorrect; non-maleficence dictates first doing no harm (primum non nocere)."
        ]
      ],
      ex_fa: "اصول چهارگانه اخلاق زیست‌پزشکی بوچامپ و چیلدرس شامل خودمختاری، سودرسانی، عدم آسیب‌رسانی و عدالت است. رضایت آگاهانه تبلور اصل خودمختاری بیمار است.",
      ex_en: "The four core bioethical principles are autonomy, beneficence, non-maleficence, and justice. Informed consent embodies patient autonomy."
    }
  ],

  genetics: [
    {
      q_fa: "کدام یک از بیماری‌های ژنتیکی زیر دارای الگوی توارث اتوزومال مغلوب (Autosomal Recessive) است؟",
      q_en: "Which of the following genetic diseases exhibits an autosomal recessive inheritance pattern?",
      options: [
        [
          "سیستیک فیبروزیس (Cystic Fibrosis)",
          "Cystic fibrosis",
          true,
          "صحیح است؛ سیستیک فیبروزیس ناشی از جهش در ژن CFTR روی کروموزوم ۷ با الگوی اتوزومال مغلوب به ارث می‌رسد و احتمال ابتلای هر فرزند دو والد ناقل ۲۵ درصد است.",
          "Correct; cystic fibrosis is inherited in an autosomal recessive fashion via mutations in the CFTR gene."
        ],
        [
          "بیماری هانتینگتون (Huntington disease)",
          "Huntington disease",
          false,
          "نادرست است؛ بیماری هانتینگتون دارای توارث اتوزومال غالب (Autosomal Dominant) است و هر فرزند شانس ۵۰ درصدی ابتلا دارد.",
          "Incorrect; Huntington disease is autosomal dominant with trinucleotide CAG repeat expansion."
        ],
        [
          "سندرم مارفان (Marfan syndrome)",
          "Marfan syndrome",
          false,
          "نادرست است؛ سندرم مارفان به علت جهش در ژن فیبریلین-۱ (FBN1) به صورت اتوزومال غالب به ارث می‌رسد.",
          "Incorrect; Marfan syndrome is an autosomal dominant connective tissue disorder (FBN1 mutation)."
        ],
        [
          "نوروفیبروماتوز نوع ۱ (NF-1)",
          "Neurofibromatosis type 1",
          false,
          "نادرست است؛ نوروفیبروماتوز بیماری اتوزومال غالب با نفوذ کامل و تظاهرات پوستی لکه‌های شیرقهوه‌ای است.",
          "Incorrect; NF-1 is an autosomal dominant disorder caused by mutations in the neurofibromin gene."
        ]
      ],
      ex_fa: "در بیماری‌های اتوزومال مغلوب (نظیر CF، فنیل‌کتونوری، تالاسمی و بیماری ویلسون)، هر دو والد ناقل سالم هستند و فرزندان با احتمال ۲۵٪ مبتلا، ۵۰٪ ناقل و ۲۵٪ سالم غیرناقل متولد می‌شوند.",
      ex_en: "Autosomal recessive diseases require two mutant alleles. Two carrier parents face a 25% risk of having an affected child per pregnancy."
    }
  ],

  immuno: [
    {
      q_fa: "واکنش‌های ازدیاد حساسیت تیپ I (شامل آنافیلاکسی، کهیر و رینیت آلرژیک) توسط کدام ایمونوگلوبولین واسطه می‌شوند؟",
      q_en: "Which immunoglobulin mediates Type I immediate hypersensitivity reactions (such as anaphylaxis and allergic rhinitis)?",
      options: [
        [
          "ایمونوگلوبولین E (IgE)",
          "Immunoglobulin E (IgE)",
          true,
          "صحیح است؛ آنتی‌بادی‌های IgE با اتصال به گیرنده‌های با تمایل بالا (FcεRI) روی سطح ماست‌سل‌ها و بازوفیل‌ها، در مواجهه مجدد با آلرژن موجب دگرانولاسیون سریع و ترشح هیستامین می‌شوند.",
          "Correct; IgE binds to Fc receptors on mast cells and basophils, triggering immediate degranulation upon allergen cross-linking."
        ],
        [
          "ایمونوگلوبولین G (IgG)",
          "Immunoglobulin G (IgG)",
          false,
          "نادرست است؛ IgG ایمونوگلوبولین اصلی سرم در پاسخ‌های ایمنی ثانویه است و در واکنش‌های ازدیاد حساسیت نوع II (سیتوتوکسیک) و نوع III (ایمیون‌کمپلکس) نقش دارد.",
          "Incorrect; IgG mediates Type II cytotoxic and Type III immune-complex hypersensitivity reactions."
        ],
        [
          "ایمونوگلوبولین M (IgM)",
          "Immunoglobulin M (IgM)",
          false,
          "نادرست است؛ IgM اولین ایمونوگلوبولین تولیدشده در پاسخ ایمنی اولیه با ساختار پنتامر است و واسطه‌گر آنافیلاکسی نیست.",
          "Incorrect; IgM is the primary pentameric antibody produced in acute antigen exposure."
        ],
        [
          "ایمونوگلوبولین A (IgA)",
          "Immunoglobulin A (IgA)",
          false,
          "نادرست است؛ IgA آنتی‌بادی سکرتوری اصلی در ترشحات مخاطی (دستگاه تنفس، گوارش و اشک) است و نقش ایمنی مخاطی را بر عهده دارد.",
          "Incorrect; IgA provides mucosal immunity along mucosal epithelial surfaces."
        ]
      ],
      ex_fa: "واکنش ازدیاد حساسیت تیپ I واکنشی فوری است که به دنبال اتصال متقاطع آلرژن به IgE متصل به ماست‌سل رخ می‌دهد. درمان آنافیلاکسی حاد، تزریق فوری اپی‌نفرین (آدرنالین) عضلانی است.",
      ex_en: "Type I hypersensitivity is mediated by preformed IgE bound to mast cells. Intramuscular epinephrine is the treatment of choice for anaphylaxis."
    }
  ],

  nutrition: [
    {
      q_fa: "کمبود شدید و طولانی‌مدت ویتامین C (اسید اسکوربیک) منجر به بروز کدام بیماری کمبودی کلاسیک می‌شود؟",
      q_en: "Severe dietary deficiency of Vitamin C (ascorbic acid) leads to which classic nutritional disease?",
      options: [
        [
          "بیماری اسکوربوت (Scurvy)",
          "Scurvy",
          true,
          "صحیح است؛ ویتامین C کوفاکتور ضروری آنزیم‌های پرولیل و لیزیل هیدروکسیلاز در سنتز کلاژن است؛ کمبود آن باعث نقص کلاژن، شکنندگی عروق، خونریزی لثه‌ها، پتیشی دور فولیکولی و تاخیر در بهبود زخم می‌شود.",
          "Correct; Vitamin C is required for collagen hydroxylation; deficiency impairs collagen cross-linking leading to scurvy."
        ],
        [
          "بیماری بری‌بری (Beriberi)",
          "Beriberi",
          false,
          "نادرست است؛ بری‌بری بیماری ناشی از کمبود ویتامین B1 (تیامین) است که در دو شکل مرطوب (قلبی) و خشک (نوروپاتی محیطی) تظاهر می‌یابد.",
          "Incorrect; beriberi is caused by thiamine (Vitamin B1) deficiency."
        ],
        [
          "بیماری پلاگر (Pellagra)",
          "Pellagra",
          false,
          "نادرست است؛ پلاگر به علت کمبود ویتامین B3 (نیاسین) ایجاد می‌شود و با علامت کلاسیک ۴D (درماتیت، اسهال، دمانس و مرگ) همراه است.",
          "Incorrect; pellagra is caused by niacin (Vitamin B3) deficiency, presenting with the 4 Ds."
        ],
        [
          "بیماری راشیتیسم (Rickets)",
          "Rickets",
          false,
          "نادرست است؛ راشیتیسم ناشی از کمبود ویتامین D در کودکان و نقص در معدنی‌شدن استخوان در حال رشد است.",
          "Incorrect; rickets is caused by Vitamin D deficiency impairing osteoid mineralization in children."
        ]
      ],
      ex_fa: "ویتامین C یک آنتی‌اکسیدان قوی محلول در آب و کوفاکتور تولید کلاژن است. اسکوربوت با خونریزی‌های زیرپوستی و دور فولیکولی، تورم و خونریزی لثه، دردهای استخوانی و کندی ترمیم زخم همراه است.",
      ex_en: "Ascorbic acid deficiency impairs triple-helix collagen synthesis, manifesting as scurvy with capillary fragility and perifollicular hemorrhages."
    }
  ],

  physics: [
    {
      q_fa: "در کدام یک از روش‌های تصویربرداری پزشکی زیر، بیمار در معرض هیچ‌گونه پرتو یونیزان (پرتو ایکس یا گاما) قرار نمی‌گیرد؟",
      q_en: "Which medical imaging modality exposes the patient to NO ionizing radiation?",
      options: [
        [
          "تصویربرداری تشدید مغناطیسی (MRI) و سونوگرافی",
          "Magnetic resonance imaging (MRI) and ultrasound",
          true,
          "صحیح است؛ MRI از میدان مغناطیسی قوی و امواج رادیویی (RF) و سونوگرافی از امواج صوتی مکانیکی با فرکانس بالا استفاده می‌کنند و هیچ‌کدام پرتو یونیزان تابش نمی‌کنند.",
          "Correct; MRI utilizes magnetic fields with radiofrequency pulses, and ultrasound uses mechanical sound waves, neither using ionizing radiation."
        ],
        [
          "سی‌تی‌اسکن اسپیرال چند مقطعی (CT Scan)",
          "Computed tomography (CT scan)",
          false,
          "نادرست است؛ سی‌تی‌اسکن از پرتوهای پرانرژی ایکس (X-ray) استفاده می‌کند و یکی از بالاترین دوزهای پرتو یونیزان پزشکی را به بیمار تحویل می‌دهد.",
          "Incorrect; CT scans utilize ionizing X-rays with significant radiation dose."
        ],
        [
          "رادیوگرافی ساده دیجیتال (Digital Radiography)",
          "Conventional plain radiography",
          false,
          "نادرست است؛ رادیوگرافی‌های ساده از پرتو ایکس یونیزان جهت عبور از بافت‌ها و تشکیل تصویر روی فیلم یا دتکتور استفاده می‌کنند.",
          "Incorrect; plain radiographs emit ionizing X-radiation."
        ],
        [
          "اسکن پزشکی هسته‌ای و اسکن استخوان (Nuclear Scintigraphy)",
          "Nuclear medicine scintigraphy",
          false,
          "نادرست است؛ اسکن‌های هسته‌ای از رادیوداروها با گسیل پرتوهای گامای یونیزان (مانند تکنسیم ۹۹m) بهره می‌برند.",
          "Incorrect; nuclear scans utilize gamma-emitting radiotracers, representing ionizing radiation."
        ]
      ],
      ex_fa: "روش‌های تصویربرداری ایمن فاقد پرتوهای یونیزان شامل سونوگرافی و ام‌آر‌آی هستند و در دوران بارداری و اطفال اولویت بالایی دارند.",
      ex_en: "Ultrasound and MRI are non-ionizing modalities, making them preferred choices in pediatric and obstetric populations."
    }
  ],

  anatomy: [
    {
      q_fa: "عصب فرنیک (Phrenic nerve) که عصب‌دهی حرکتی عضله دیافراگم را بر عهده دارد، از کدام ریشه‌های نخاعی منشأ می‌گیرد؟",
      q_en: "The phrenic nerve, which provides motor innervation to the diaphragm, arises from which cervical spinal cord roots?",
      options: [
        [
          "ریشه‌های سوم، چهارم و پنجم گردنی (C3, C4, C5)",
          "C3, C4, and C5 roots",
          true,
          "صحیح است؛ عصب فرنیک از شاخه‌های قدامی اعصاب نخاعی C3، C4 و C5 (به ویژه ریشه چهارم گردنی) منشأ می‌گیرد طبق یادافزای معروف: «C3, 4, 5 keeps the diaphragm alive».",
          "Correct; the phrenic nerve originates from the anterior rami of C3, C4, and C5 ('C3, 4, 5 keeps the diaphragm alive')."
        ],
        [
          "ریشه‌های اول و دوم گردنی (C1, C2)",
          "C1 and C2 roots",
          false,
          "نادرست است؛ ریشه‌های C1 و C2 در تشکیل قوس گردنی (انسا سرویکالیس) و عصب‌دهی عضلات زیر لامی (اینفراهیوئید) مشارکت دارند، نه دیافراگم.",
          "Incorrect; C1-C2 innervate prevertebral and infrahyoid muscles via ansa cervicalis."
        ],
        [
          "ریشه‌های اول تا چهارم سینه‌ای (T1-T4)",
          "T1 to T4 thoracic roots",
          false,
          "نادرست است؛ ریشه‌های توراسیک اعصاب بین‌دنده‌ای را می‌سازند و در عصب‌دهی سمپاتیک احشایی و جدار سینه نقش دارند.",
          "Incorrect; T1-T4 give rise to intercostal nerves and thoracic sympathetic outflow."
        ],
        [
          "ریشه‌های اول تا سوم کمری (L1-L3)",
          "L1 to L3 lumbar roots",
          false,
          "نادرست است؛ این ریشه‌ها شبکه کمری (لومبار) را تشکیل می‌دهند و عصب‌دهی حسی-حرکتی اندام تحتانی را تامین می‌کنند.",
          "Incorrect; L1-L3 roots form the upper lumbar plexus innervating the lower abdominal wall and lower limb."
        ]
      ],
      ex_fa: "عصب فرنیک در گردن بر روی عضله اسکالن قدامی طی مسیر کرده و تنها عصب حرکتی دیافراگم است. آسیب به آن منجر به فلج و بالا رفتن نیم‌دیافراگم در همان سمت می‌شود.",
      ex_en: "The phrenic nerve traverses the anterior scalene muscle; injury results in hemidiaphragmatic paralysis and elevation."
    },
    {
      q_fa: "طولانی‌ترین، سنگین‌ترین و مستحکم‌ترین استخوان در اسکلت بدن انسان کدام است؟",
      q_en: "What is the longest, heaviest, and strongest bone in the human skeleton?",
      options: [
        [
          "استخوان ران (فمور / Femur)",
          "Femur (thigh bone)",
          true,
          "صحیح است؛ فمور بزرگ‌ترین و محکم‌ترین استخوان بدن است که وزن تنه را از کمربند لگنی به استخوان درشت‌نی (تیبیا) منتقل می‌سازد.",
          "Correct; the femur is the longest and strongest bone in the human body, bearing substantial weight."
        ],
        [
          "استخوان درشت‌نی ساق پا (تیبیا / Tibia)",
          "Tibia (shin bone)",
          false,
          "نادرست است؛ تیبیا دومین استخوان بزرگ بدن است اما طول و استحکام آن کمتر از فمور است.",
          "Incorrect; the tibia is the second largest bone, transmitting forces from the femur to the foot."
        ],
        [
          "استخوان بازو (هومروس / Humerus)",
          "Humerus",
          false,
          "نادرست است؛ هومروس بزرگ‌ترین استخوان اندام فوقانی است، اما ابعاد و مقاومت مکانیکی آن به مراتب کمتر از استخوان‌های باربر اندام تحتانی است.",
          "Incorrect; the humerus is the longest bone of the upper limb but smaller than the femur."
        ],
        [
          "استخوان بی‌نام کمربند لگنی (کوکسال / Pelvis)",
          "Pelvic hip bone (Os coxae)",
          false,
          "نادرست است؛ استخوان کوکسال استخوانی پهن و نامنظم است و طویل‌ترین استخوان محسوب نمی‌شود.",
          "Incorrect; the hip bone is a broad, irregular bone forming the pelvic girdle."
        ]
      ],
      ex_fa: "استخوان فمور طول و قدرتی فوق‌العاده دارد و حدود یک‌چهارم قد کل بدن فرد را تشکیل می‌دهد.",
      ex_en: "The femur accounts for roughly one-fourth of adult human standing height and possesses tremendous mechanical strength."
    },
    {
      q_fa: "کدام دریچه قلبی مانع از برگشت خون از بطن چپ به دهلیز چپ در هنگام سیستول بطنی می‌گردد؟",
      q_en: "Which cardiac valve prevents backflow of blood from the left ventricle into the left atrium during ventricular systole?",
      options: [
        [
          "دریچه میترال (دولختی / Mitral bicuspid valve)",
          "Mitral (bicuspid) valve",
          true,
          "صحیح است؛ دریچه میترال دارای دو لته (قدامی و خلفی) است و در حفره دهلیزی-بطنی چپ قرار دارد و در سیستول با بسته شدن کامل از نارسایی خون به دهلیز چپ جلوگیری می‌کند.",
          "Correct; the mitral bicuspid valve separates the left atrium from the left ventricle."
        ],
        [
          "دریچه تریکوسپید (سه‌لختی)",
          "Tricuspid valve",
          false,
          "نادرست است؛ دریچه تریکوسپید بین دهلیز راست و بطن راست قرار دارد و مانع برگشت خون به گردش خون وریدی سیستمیک می‌شود.",
          "Incorrect; the tricuspid valve guards the right atrioventricular orifice."
        ],
        [
          "دریچه آئورت (هلالی آئورتی)",
          "Aortic semilunar valve",
          false,
          "نادرست است؛ دریچه آئورت در مدخل شریان آئورت قرار دارد و مانع برگشت خون از آئورت به بطن چپ در دیاستول می‌شود.",
          "Incorrect; the aortic valve lies between the left ventricle and ascending aorta."
        ],
        [
          "دریچه پولمونر (هلالی شریان ریوی)",
          "Pulmonary semilunar valve",
          false,
          "نادرست است؛ دریچه پولمونر بین بطن راست و تنه شریان ریوی واقع شده است.",
          "Incorrect; the pulmonary valve prevents retrograde flow from the pulmonary artery into the right ventricle."
        ]
      ],
      ex_fa: "دریچه‌های دهلیزی-بطنی شامل میترال (چپ) و تریکوسپید (راست) هستند که با عضلات پاپیلاری و طناب‌های وتری (Chordae tendineae) از پرولاپس به درون دهلیزها محافظت می‌شوند.",
      ex_en: "The mitral valve closes during systole, producing the first heart sound (S1) along with tricuspid closure."
    }
  ],

  physio: [
    {
      q_fa: "کدام هورمون تنظیم‌کننده اصلی هومئوستاز گلوکز خون است که با تسهیل ورود قند به سلول‌ها، قند سرم را کاهش می‌دهد؟",
      q_en: "Which hormone is the primary regulator of blood glucose that lowers circulating blood sugar?",
      options: [
        [
          "انسولین ترشح‌شده از سلول‌های بتای جزایر لانگرهانس پانکراس",
          "Insulin secreted by pancreatic beta cells",
          true,
          "صحیح است؛ انسولین تنها هورمون کاهنده قند خون در بدن است که با انتقال ناقل‌های GLUT4 به غشای سلول‌های عضلانی و بافت چربی و تحریک گلیکوژنز، قند سرم را پایین می‌آورد.",
          "Correct; insulin promotes glucose uptake into skeletal muscle and adipose tissue via GLUT4 translocation."
        ],
        [
          "گلوکاگون ترشح‌شده از سلول‌های آلفا",
          "Glucagon from pancreatic alpha cells",
          false,
          "نادرست است؛ گلوکاگون هورمون ضدانسولینی است که با فعال‌سازی گلیکوژنولیز و گلوکونئوژنز در کبد، قند خون را بالا می‌برد.",
          "Incorrect; glucagon acts counter-regulatory to insulin, stimulating hepatic glycogenolysis and gluconeogenesis."
        ],
        [
          "کورتیزول (گلوکوکورتیکوئید آدرنال)",
          "Cortisol from adrenal cortex",
          false,
          "نادرست است؛ کورتیزول هورمون استرس و هایپرگلیسمیک است که مقاومت به انسولین را افزایش داده و قند خون را بالا می‌برد.",
          "Incorrect; cortisol promotes gluconeogenesis and antagonizes insulin action."
        ],
        [
          "اپی‌نفرین (آدرنالین بخش مدولای فوق کلیه)",
          "Epinephrine from adrenal medulla",
          false,
          "نادرست است؛ اپی‌نفرین از طریق گیرنده‌های بتا-۲ آدرنرژیک گلیکوژنولیز را تحریک کرده و قند خون را سریعاً بالا می‌برد.",
          "Incorrect; epinephrine stimulates rapid glycogenolysis, elevating plasma glucose during stress."
        ]
      ],
      ex_fa: "انسولین هورمون اصلی آنابولیک بدن است که علاوه بر ورود گلوکز، برداشت اسیدهای آمینه و سنتز پروتئین و ذخیره چربی‌ها را تحریک می‌کند.",
      ex_en: "Insulin is the primary anabolic hormone promoting glucose disposal, glycogen synthesis, lipogenesis, and protein translation."
    },
    {
      q_fa: "واحد ساختمانی و عملکردی میکروسکوپی مسئول پالایش پلاسما و تشکیل ادرار در کلیه کدام است؟",
      q_en: "What is the microscopic structural and functional unit of the kidney responsible for filtering blood and forming urine?",
      options: [
        [
          "نفرون (Nephron شامل گلومرول و کپسول بومن و سیستم توبولی)",
          "Nephron (glomerulus, Bowman capsule, and tubular system)",
          true,
          "صحیح است؛ هر کلیه انسان حاوی حدود یک میلیون نفرون است که هر کدام از بخش فیلتراسیون (گلومرول) و بخش بازجذب و ترشح (توبول‌های پروگزیمال، هنله و دیستال) تشکیل یافته‌اند.",
          "Correct; each kidney contains roughly 1 million nephrons, the fundamental functional units of renal clearance."
        ],
        [
          "صرفاً کلافه گلومرولی به تنهایی",
          "Glomerulus alone",
          false,
          "نادرست است؛ گلومرول تنها کلافه مویرگی فیلتراسیون اولیه است و بدون سیستم توبولی و مجاری جمع‌کننده، پردازش ادرار و بازجذب کامل نمی‌شود.",
          "Incorrect; the glomerulus is strictly the vascular filtering tuft within the nephron."
        ],
        [
          "حالب کلیوی (Ureter)",
          "Ureter",
          false,
          "نادرست است؛ حالب لوله عضلانی هدایت‌کننده ادرار از لگنچه به مثانه است و نقشی در فیلتراسیون پلاسما ندارد.",
          "Incorrect; the ureter is a muscular transport duct conveying urine to the bladder."
        ],
        [
          "لگنچه کلیه (Renal pelvis)",
          "Renal pelvis",
          false,
          "نادرست است؛ لگنچه محل تجمع ماکروسکوپیک ادرار از کالیس‌ها است و یک واحد عملکردی بافتی پالایشگر نیست.",
          "Incorrect; the renal pelvis is the funnel-like macroscopic urine-collecting basin."
        ]
      ],
      ex_fa: "نفرون‌ها به دو گروه قشری (Cortical) و ژوکستامدولاری (Juxtamedullary) تقسیم می‌شوند. نفرون‌های ژوکستامدولاری با قوس‌های بلند هنله مسئول ایجاد شیب اسمزی و تغلیظ ادرار هستند.",
      ex_en: "The nephron encompasses the renal corpuscle and tubular segments. Juxtamedullary nephrons establish the medullary hyperosmolar gradient."
    },
    {
      q_fa: "افزایش اسیدوز، بالا رفتن غلظت یون هیدروژن (+H) و افزایش فشار دی‌اکسید کربن (اثر بوهر / Bohr effect) منحنی تفکیک اکسی‌هموگلوبین را به کدام سمت منتقل می‌کند؟",
      q_en: "Acidosis, elevated H+, and increased PCO2 (the Bohr effect) shift the oxyhemoglobin dissociation curve in which direction?",
      options: [
        [
          "انتقال منحنی به سمت راست (تسهیل آزادسازی اکسیژن در بافت‌ها)",
          "Shift to the right (facilitating oxygen unloading to tissues)",
          true,
          "صحیح است؛ اسیدوز، افزایش CO2، بالا رفتن دما و افزایش 2,3-BPG تمایل هموگلوبین به اکسیژن را کاهش داده و منحنی را به راست شیفت می‌دهند که به آزادسازی موثر اکسیژن در بافت‌های فعال متابولیک کمک می‌کند.",
          "Correct; acidosis decreases hemoglobin O2 affinity (Bohr effect), shifting the curve rightward to unload oxygen where tissues need it."
        ],
        [
          "انتقال منحنی به سمت چپ (افزایش تمایل هموگلوبین به اکسیژن)",
          "Shift to the left (increasing hemoglobin O2 affinity)",
          false,
          "نادرست است؛ شیفت به چپ توسط آلکالوز (کاهش H+)، کاهش CO2، هیپوترمی و افت 2,3-BPG رخ می‌دهد و اکسیژن محکم‌تر به هموگلوبین چسبیده و دیرتر آزاد می‌شود.",
          "Incorrect; left shifts occur with alkalosis, decreased PCO2, and hypothermia, impeding O2 release."
        ],
        [
          "بدون تغییر در وضعیت منحنی تفکیک",
          "No change in the dissociation curve",
          false,
          "نادرست است؛ تغییرات pH مستقیماً بر ساختار فضایی هموگلوبین تاثیر گذاشته و تمایل اتصالی آن را دگرگون می‌سازد.",
          "Incorrect; pH alterations directly modulate hemoglobin's quaternary allosteric conformation."
        ],
        [
          "صرفاً تغییر در دامنه بدون تغییر در میل ترکیبی P50",
          "Change in amplitude without altering P50",
          false,
          "نادرست است؛ شاخص P50 (فشار اکسیژنی که در آن ۵۰ درصد هموگلوبین اشباع است) با اسیدوز افزایش می‌یابد که نشانه قطعی تغییر تمایل اتصالی است.",
          "Incorrect; P50 increases with acidosis, demonstrating an altered affinity state."
        ]
      ],
      ex_fa: "یادافزای عوامل شیفت منحنی به راست (CADET face right): CO2 بالا، Acidosis (اسیدوز)، 2,3-DPG بالا، Exercise (ورزش) و Temperature (دمای بالا). شیفت به راست به نفع اکسیژن‌رسانی بافتی است.",
      ex_en: "The Bohr effect shifts the curve to the right in working tissues (acidic, hypercapnic), optimizing oxygen delivery."
    }
  ],

  biochem: [
    {
      q_fa: "محصول نهایی مسیر متابولیکی گلیکولیز در شرایط حضور اکسیژن کافی (شرایط هوازی) کدام است؟",
      q_en: "What is the end product of the glycolytic pathway under fully aerobic conditions?",
      options: [
        [
          "مولکول پیرووات (Pyruvate)",
          "Pyruvate",
          true,
          "صحیح است؛ در شرایط هوازی، هر مولکول گلوکز طی ۱۰ مرحله آنزیمی به دو مولکول پیرووات، دو ATP خالص و دو NADH تبدیل می‌شود تا وارد چرخه میتوکندری گردد.",
          "Correct; aerobic glycolysis converts one glucose molecule into two pyruvate molecules, two net ATP, and two NADH."
        ],
        [
          "مولکول اسید لاکتات (Lactate)",
          "Lactate",
          false,
          "نادرست است؛ اسید لاکتات محصول نهایی گلیکولیز در شرایط «بی‌هوازی» (مانند ایسکمی شدید بافتی یا گلبول‌های قرمز فاقد میتوکندری) توسط آنزیم لاکتات دهیدروژناز است.",
          "Incorrect; lactate is the end product under anaerobic conditions to regenerate NAD+."
        ],
        [
          "استیل کوآنزیم A (Acetyl-CoA)",
          "Acetyl-CoA",
          false,
          "نادرست است؛ استیل‌کوآ محصول واکنش اکسیداسیون پیرووات درون میتوکندری توسط کمپلکس پیرووات دهیدروژناز است، نه محصول مستقیم گلیکولیز در سیتوزول.",
          "Incorrect; acetyl-CoA is produced subsequently in mitochondria via the pyruvate dehydrogenase complex."
        ],
        [
          "سیترات (Citrate)",
          "Citrate",
          false,
          "نادرست است؛ سیترات اولین حدواسط چرخه اسید سیتریک (کربس) در میتوکندری است که از ترکیب استیل‌کوآ با اگزالواستات پدید می‌آید.",
          "Incorrect; citrate is the first intermediate formed inside the mitochondrial TCA cycle."
        ]
      ],
      ex_fa: "گلیکولیز در سیتوپلاسم تمام سلول‌ها انجام می‌شود. در حضور اکسیژن، پیرووات وارد ماتریکس میتوکندری شده و به استیل‌کوآ تبدیل می‌شود تا در چرخه کربس اکسید شود.",
      ex_en: "Glycolysis takes place in the cytosol, yielding pyruvate under aerobic conditions, which enters mitochondria for oxidative phosphorylation."
    },
    {
      q_fa: "مکانیسم بیوشیمیایی آسیب بافتی در بیماری اسکوربوت (Scurvy) ناشی از کمبود کدام فاکتور ضروری است؟",
      q_en: "What is the biochemical basis of tissue fragility in scurvy?",
      options: [
        [
          "نقص در هیدروکسیلاسیون ریشه‌های پرولین و لیزین کلاژن ناشی از کمبود ویتامین C",
          "Impaired prolyl and lysyl hydroxylation of collagen due to Vitamin C deficiency",
          true,
          "صحیح است؛ اسید اسکوربیک کوفاکتور ردوکس برای پرولیل هیدروکسیلاز است که آهن را در حالت دوظرفیتی (+Fe2) احیا نگه می‌دارد؛ فقدان آن مانع تشکیل پیوندهای هیدروژنی پایدار در مارپیچ سه‌گانه کلاژن می‌شود.",
          "Correct; ascorbic acid maintains iron in the ferrous (Fe2+) state for prolyl and lysyl hydroxylases, essential for collagen cross-linking."
        ],
        [
          "نقص در گاماکربوکسیلاسیون فاکتورهای انعقادی ناشی از فقدان ویتامین K",
          "Defective gamma-carboxylation of clotting factors from Vitamin K deficiency",
          false,
          "نادرست است؛ گاماکربوکسیلاسیون ریشه‌های اسید گلوتامیک فاکتورهای انعقادی (۲، ۷، ۹، ۱۰) وابسته به ویتامین K است و با ویتامین C ارتباطی ندارد.",
          "Incorrect; gamma-carboxylation of clotting factors requires Vitamin K."
        ],
        [
          "نقص در متیلاسیون اسیدهای نوکلئیک ناشی از کمبود ویتامین B12",
          "Defective DNA methylation from Vitamin B12 deficiency",
          false,
          "نادرست است؛ کمبود کوبالامین (B12) منجر به کم‌خونی مگالوبلاستیک و اختلالات میلین طناب نخاعی می‌شود، نه شکنندگی کلاژن.",
          "Incorrect; B12 deficiency impairs methionine synthesis and DNA replication, causing megaloblastic anemia."
        ],
        [
          "مهار مستقیم آنزیم لیپوپروتئین لیپاز در آندوتلیوم عروق",
          "Direct inhibition of endothelial lipoprotein lipase",
          false,
          "نادرست است؛ لیپوپروتئین لیپاز در متابولیسم شیلومیکرون‌ها و VLDL نقش دارد و نقشی در بیوسنتز بافت همبند ندارد.",
          "Incorrect; lipoprotein lipase hydrolyzes plasma triglycerides."
        ]
      ],
      ex_fa: "ویتامین C برای تثبیت ساختار ترومبوکلاژن الزامی است. کمبود آن سبب شکنندگی مویرگی، تحلیل لثه‌ها، افتادن دندان‌ها و خونریزی‌های زیرپریوستی می‌شود.",
      ex_en: "Defective collagen hydroxylation due to Vitamin C deficiency leads to microvascular fragility, mucosal bleeding, and impaired wound healing."
    },
    {
      q_fa: "محل دقیق انجام واکنش‌های چرخه اسید سیتریک (چرخه کربس / TCA cycle) در سلول‌های یوکاریوتی کدام است؟",
      q_en: "Where do the enzymatic reactions of the citric acid (Krebs) cycle take place in eukaryotic cells?",
      options: [
        [
          "ماتریکس داخلی میتوکندری (Mitochondrial matrix)",
          "Mitochondrial matrix",
          true,
          "صحیح است؛ کلیه آنزیم‌های چرخه کربس (به استثنای سوکسینات دهیدروژناز که در غشای داخلی قرار دارد) در ماتریکس میتوکندری حل شده و فعالیت می‌کنند.",
          "Correct; the enzymes of the citric acid cycle reside in the mitochondrial matrix (except succinate dehydrogenase, located in the inner membrane)."
        ],
        [
          "سیتوزول سلولی (Cytosol)",
          "Cellular cytosol",
          false,
          "نادرست است؛ در سیتوزول مسیرهایی نظیر گلیکولیز، مسیر پنتوزفسفات و سنتز اسیدهای چرب انجام می‌گیرند، نه چرخه کربس.",
          "Incorrect; glycolysis, the pentose phosphate shunt, and fatty acid synthesis occur in the cytosol."
        ],
        [
          "فضای بین دو غشای میتوکندری (Intermembrane space)",
          "Mitochondrial intermembrane space",
          false,
          "نادرست است؛ فضای بین‌غشایی محل تجمع یون‌های هیدروژن (+H) پمپ‌شده توسط زنجیره انتقال الکترون است تا شیب الکتروشیمیایی تولید کند.",
          "Incorrect; the intermembrane space accumulates protons pumped by the electron transport chain."
        ],
        [
          "شبکه آندوپلاسمی صاف (Smooth ER)",
          "Smooth endoplasmic reticulum",
          false,
          "نادرست است؛ شبکه اندوپلاسمی صاف محل سنتز لیپیدها، فسفولیپیدها و دتوکسیفیکاسیون دارویی توسط سیستم P450 است.",
          "Incorrect; the smooth ER is specialized for lipid synthesis and drug detoxification."
        ]
      ],
      ex_fa: "چرخه کربس در ماتریکس میتوکندری استیل‌کوآ را اکسید کرده و ۳ NADH، ۱ FADH2 و ۱ GTP تولید می‌کند که الکترون‌های آن‌ها به زنجیره تنفسی منتقل می‌شوند.",
      ex_en: "The Krebs cycle runs inside the mitochondrial matrix, fueling the electron transport chain with reducing equivalents."
    }
  ],

  histology: [
    {
      q_fa: "سطح مخاطی مجرای لومن مری توسط کدام نوع بافت پوششی (اپیتلیوم) محافظت می‌شود؟",
      q_en: "Which type of epithelium lines the lumen of the esophagus?",
      options: [
        [
          "بافت پوششی سنگفرشی مطبق غیرشاخی (Non-keratinized stratified squamous)",
          "Non-keratinized stratified squamous epithelium",
          true,
          "صحیح است؛ مری به دلیل نیاز به مقاومت مکانیکی در برابر سایش ذرات عبوری غذا، توسط چند لایه سلول سنگفرشی مطبق غیرشاخی با سلول‌های زنده سطحی پوشیده شده است.",
          "Correct; the esophageal mucosa is lined by non-keratinized stratified squamous epithelium designed to withstand mechanical abrasion."
        ],
        [
          "بافت پوششی مکعبی ساده",
          "Simple cuboidal epithelium",
          false,
          "نادرست است؛ اپیتلیوم مکعبی ساده در توبول‌های کلیوی و مجاری ترشحی غدد جهت ترشح و بازجذب وجود دارد، نه در مجرای عبور لقمه غذا.",
          "Incorrect; simple cuboidal epithelium lines renal tubules and small glandular ducts."
        ],
        [
          "بافت پوششی استوانه‌ای ساده ترشحی",
          "Simple columnar epithelium",
          false,
          "نادرست است؛ استوانه‌ای ساده بافت پوششی معده و روده‌ها است؛ تبدیل مخاط مری به استوانه‌ای ساده یک وضعیت پاتولوژیک ناشی از ریفلاکس اسید موسوم به «مری بارت» است.",
          "Incorrect; simple columnar epithelium lines the stomach and intestines; its presence in the esophagus represents Barrett metaplasia."
        ],
        [
          "بافت پوششی انتقالی (ترانزیشنال / یوروتلیوم)",
          "Transitional epithelium (urothelium)",
          false,
          "نادرست است؛ بافت ترانزیشنال اختصاصی مجاری ادراری (لگنچه، حالب و مثانه) جهت اتساع و مقاومت در برابر اسمولاریته ادرار است.",
          "Incorrect; transitional epithelium (urothelium) exclusively lines the urinary tract."
        ]
      ],
      ex_fa: "محل اتصال مری به معده (Z-line) نقطه گذار ناگهانی اپیتلیوم سنگفرشی مطبق مری به استوانه‌ای ساده معده است. آسیب مکرر ناشی از اسید معده می‌تواند به متاپلازی بارت منجر گردد.",
      ex_en: "The normal esophagus is lined by non-keratinized stratified squamous epithelium, transitioning abruptly to simple columnar at the gastroesophageal junction."
    },
    {
      q_fa: "سلول‌های کوپفر (Kupffer cells) ماکروفاژهای مقیم کدام اندام در بدن هستند؟",
      q_en: "Kupffer cells represent the specialized resident macrophage population of which organ?",
      options: [
        [
          "کبد (مقیم در سینوزوئیدهای کبدی)",
          "Liver (resident in hepatic sinusoids)",
          true,
          "صحیح است؛ سلول‌های کوپفر ماکروفاژهای فاگوسیت‌کننده مستقر در لومن سینوزوئیدهای کبدی هستند که باکتری‌ها، اندوتوکسین‌ها و گلبول‌های قرمز فرسوده ورودی از ورید پورت را پاکسازی می‌نمایند.",
          "Correct; Kupffer cells are specialized sinusoidal macrophages lining hepatic vascular channels."
        ],
        [
          "قشر و مدولای بافت کلیه",
          "Kidney",
          false,
          "نادرست است؛ در کلیه سلول‌های مزانژیال فاگوسیتوز و پاکسازی مویرگ‌های گلومرولی را انجام می‌دهند.",
          "Incorrect; intraglomerular mesangial cells fulfill phagocytic roles in the kidney."
        ],
        [
          "بافت پارانشیم ریه",
          "Lung parenchyma",
          false,
          "نادرست است؛ ماکروفاژهای مقیم حبابچه‌های ریوی «ماکروفاژهای آلوئولار» (Alveolar macrophages یا سلول‌های غباری / Dust cells) نامیده می‌شوند.",
          "Incorrect; alveolar macrophages (dust cells) reside within pulmonary alveolar spaces."
        ],
        [
          "طحال",
          "Spleen",
          false,
          "نادرست است؛ طحال دارای ماکروفاژهای پالپ قرمز طحالی است، اما اصطلاح سلول کوپفر اختصاصاً برای کبد به کار می‌رود.",
          "Incorrect; red pulp splenic macrophages clear senescent erythrocytes, but are distinct from hepatic Kupffer cells."
        ]
      ],
      ex_fa: "سلول‌های کوپفر بخشی از سیستم فاگوسیت تک‌هسته‌ای (MPS) هستند و بزرگ‌ترین جمعیت ماکروفاژهای ثابت بافتی بدن را در سینوزوئیدهای کبد تشکیل می‌دهند.",
      ex_en: "Kupffer cells constitute the largest tissue-resident macrophage pool, playing an indispensable role in clearing gut-derived portal antigens."
    }
  ],

  embryo: [
    {
      q_fa: "لوله عصبی جنینی (Neural tube) و بافت دستگاه عصبی مرکزی از کدام لایه زایای اولیه منشأ می‌گیرد؟",
      q_en: "From which primary embryonic germ layer does the neural tube and central nervous system derive?",
      options: [
        [
          "اکتودرم (Ectoderm به ویژه نورواکتودرم)",
          "Ectoderm (specifically neuroectoderm)",
          true,
          "صحیح است؛ در جریان نورولاسیون، نوتوکورد اکتودرم فوقانی را القا می‌کند تا صفحه عصبی و سپس لوله عصبی تشکیل شود که مغز و نخاع را می‌سازد.",
          "Correct; the central and peripheral nervous systems originate from the embryonic neuroectoderm under notochordal induction."
        ],
        [
          "مزودرم (Mesoderm)",
          "Mesoderm",
          false,
          "نادرست است؛ مزودرم منشأ استخوان‌ها، عضلات، بافت همبند، سیستم قلبی-عروقی، کلیه‌ها و گنادها است.",
          "Incorrect; mesoderm gives rise to musculoskeletal, circulatory, and genitourinary structures."
        ],
        [
          "اندودرم (Endoderm)",
          "Endoderm",
          false,
          "نادرست است؛ اندودرم پوشش مخاطی اپیتلیال دستگاه گوارش، کبد، پانکراس و سیستم تنفسی را ایجاد می‌کند.",
          "Incorrect; endoderm lines the epithelial interior of the digestive and respiratory tracts."
        ],
        [
          "سلول‌های تروفوبلاست (Trophoblast)",
          "Trophoblast",
          false,
          "نادرست است؛ تروفوبلاست لایه خارجی بلاستوسیست است که پرده کوریون و بخش جنینی جفت را می‌سازد و در ساخت بافت‌های خود جنین نقشی ندارد.",
          "Incorrect; trophoblast forms the fetal portion of the placenta."
        ]
      ],
      ex_fa: "لوله عصبی در پایان هفته چهارم بارداری بسته می‌شود. مصرف اسید فولیک در مادران پیش از لقاح و حین بارداری، خطر نقص‌های لوله عصبی (NTD نظیر آنانسفالی و اسپینا بیفیدا) را تا ۷۰ درصد کاهش می‌دهد.",
      ex_en: "The neural tube closes by the end of the fourth week. Periconceptional folic acid supplementation dramatically prevents neural tube defects."
    },
    {
      q_fa: "محل استاندارد و طبیعی وقوع پدیده لقاح (ترکیب اسپرم و تخمک) در دستگاه تناسلی زنان کدام است؟",
      q_en: "What is the normal anatomical site where fertilization of the ovum by sperm takes place?",
      options: [
        [
          "بخش آمپول لوله رحمی (Ampulla of the fallopian tube)",
          "Ampulla of the fallopian tube",
          true,
          "صحیح است؛ آمپول وسیع‌ترین و طویل‌ترین بخش لوله فالوپ است و محل طبیعی اتصال و لقاح سلول تخمک آزادشده با اسپرم است.",
          "Correct; the ampulla of the fallopian tube is the normal physiologic site of fertilization."
        ],
        [
          "حفره اصلی رحم (Uterine cavity)",
          "Uterine cavity",
          false,
          "نادرست است؛ حفره رحم محل لانه‌گزینی (Implantation) بلاستوسیست در روز ششم تا هفتم پس از لقاح است، نه محل وقوع لقاح اولیه.",
          "Incorrect; the uterine cavity is the site of blastocyst implantation, not fertilization."
        ],
        [
          "بافت کورتکس تخمدان (Ovary)",
          "Ovary",
          false,
          "نادرست است؛ تخمدان محل فولیکولوژنز و تخمک‌گذاری است و اسپرم به درون بافت تخمدان راه پیدا نمی‌کند.",
          "Incorrect; the ovary matures and releases the oocyte during ovulation."
        ],
        [
          "کانال دهانه رحم (سرویکس / Cervix)",
          "Cervical canal",
          false,
          "نادرست است؛ کانال سرویکس محل عبور و ذخیره اولیه اسپرم‌ها در موکوس است، نه محل باروری تخمک.",
          "Incorrect; the cervix acts as a selective barrier and reservoir for spermatozoa."
        ]
      ],
      ex_fa: "تخمک پس از اوولاسیون توسط فیمبریا وارد لوله شده و در آمپول با اسپرم مواجه می‌شود. زیگوت حاصل پس از ۳ تا ۴ روز تقسیم سلولی وارد رحم شده و در مرحله بلاستوسیست لانه‌گزینی می‌کند.",
      ex_en: "Fertilization occurs in the ampulla. The cleaving zygote travels toward the uterus over 3-4 days, implanting at the blastocyst stage."
    }
  ],

  micro: [
    {
      q_fa: "در تکنیک استاندارد رنگ‌آمیزی گرم، باکتری‌های گرم‌مثبت به چه رنگی زیر میکروسکوپ نوری مشاهده می‌شوند؟",
      q_en: "In the Gram stain procedure, what color do Gram-positive bacteria appear under light microscopy?",
      options: [
        [
          "رنگ بنفش تا آبی تیره (Purple/Violet)",
          "Purple to dark blue",
          true,
          "صحیح است؛ باکتری‌های گرم‌مثبت به دلیل لایه ضخیم پپتیدوگلیکان در دیواره سلولی، رنگ اولیه کریستال ویوله-ید را پس از رنگ‌زدایی با الکل درون خود نگه می‌دارند و بنفش دیده می‌شوند.",
          "Correct; Gram-positive bacteria retain the crystal violet-iodine complex within their thick peptidoglycan meshwork, staining purple."
        ],
        [
          "رنگ صورتی تا قرمز روشن (Pink/Red)",
          "Pink to bright red",
          false,
          "نادرست است؛ باکتری‌های گرم‌منفی پس از حل شدن لیپیدهای غشای خارجی با الکل، رنگ اولیه را از دست داده و با رنگ متقابل سافرانین به رنگ صورتی/قرمز درمی‌آیند.",
          "Incorrect; Gram-negative organisms lose crystal violet during alcohol decolorization and take up the safranin counterstain, appearing pink/red."
        ],
        [
          "رنگ سبز زمردی",
          "Emerald green",
          false,
          "نادرست است؛ رنگ سبز در روش‌های رنگ‌آمیزی اسپور (نظیر مالاشیت گرین) به کار می‌رود و رنگ باکتری گرم‌مثبت نیست.",
          "Incorrect; green coloration is characteristic of endospore staining using malachite green."
        ],
        [
          "رنگ زرد شفاف",
          "Clear yellow",
          false,
          "نادرست است؛ زرد جزو رنگ‌های تشخیصی متداول در رنگ‌آمیزی روتین باکتری‌های گرم نیست.",
          "Incorrect; yellow is not an endpoint color in standard Gram staining."
        ]
      ],
      ex_fa: "مراحل رنگ‌آمیزی گرم: ۱) کریستال ویوله، ۲) لوگول (تثبیت‌کننده ید)، ۳) استون/الکل (رنگ‌زدا)، و ۴) سافرانین (رنگ متقابل). گرم‌مثبت‌ها بنفش و گرم‌منفی‌ها صورتی/قرمز می‌شوند.",
      ex_en: "Gram-positive bacteria resist alcohol decolorization due to extensive peptidoglycan cross-linking, retaining crystal violet to appear purple."
    },
    {
      q_fa: "عامل اتیولوژیک بیماری سل (توبرکلوزیس ریوی و خارج‌ریوی) دارای کدام ویژگی میکروبیولوژیک تشخیصی است؟",
      q_en: "What is the defining microbiological characteristic of Mycobacterium tuberculosis, the causative agent of tuberculosis?",
      options: [
        [
          "باسیل اسیدفست با لایه غنی از اسید مایکولیک در دیواره (Acid-fast bacillus / AFB)",
          "Acid-fast bacillus (AFB) with high mycolic acid cell wall content",
          true,
          "صحیح است؛ مایکوباکتریوم توبرکلوزیس باسیل هوازی کندرشد با مقادیر فراوان لیپید و اسید مایکولیک در دیواره است که رنگ فوشین را در برابر اسید-الکل حفظ کرده و در رنگ‌آمیزی زیل-نلسون قرمز دیده می‌شود.",
          "Correct; M. tuberculosis has a lipid-rich cell wall with mycolic acids that resists acid-alcohol decolorization, staining positive with Ziehl-Neelsen."
        ],
        [
          "کوکسی گرم‌مثبت بدون دیواره سلولی",
          "Gram-positive coccus lacking a cell wall",
          false,
          "نادرست است؛ ارگانیسم‌های فاقد دیواره شامل مایکوپلاسما هستند؛ مایکوباکتریوم دیواره سلولی فوق‌العاده ضخیم و مومی‌شکل دارد و باسیل است.",
          "Incorrect; bacteria lacking cell walls belong to Mycoplasma, not Mycobacterium."
        ],
        [
          "باکتری بی‌هوازی اجباری و اسپورزا",
          "Obligate anaerobic spore-forming bacillus",
          false,
          "نادرست است؛ باکتری‌های اسپورزای بی‌هوازی کلستریدیوم‌ها هستند؛ باسیل سل یک هوازی اجباری بدون اسپور است.",
          "Incorrect; obligate spore-forming anaerobes are Clostridia; M. tuberculosis is an obligate aerobe."
        ],
        [
          "اسپیروکت متحرک با ترشح اگزوتوکسین نکروزان",
          "Motile spirochete producing necrotizing exotoxin",
          false,
          "نادرست است؛ اسپیروکت‌ها شامل ترپونما و بورلیا هستند و عامل سل ساختار باسیلی غیرمتحرک دارد.",
          "Incorrect; spirochetes include Treponema and Borrelia; tuberculosis is caused by an immotile acid-fast rod."
        ]
      ],
      ex_fa: "رنگ‌آمیزی زیل-نلسون یا کینیون روش استاندارد شناسایی باسیل‌های اسیدفست است. کشت باکتری در محیط لوون‌اشتاین-جنسن یا سیستم‌های مایع خودکار (MGIT) جهت تایید و تست حساسیت دارویی انجام می‌گیرد.",
      ex_en: "Mycobacterium tuberculosis is an obligate aerobe characterized by high mycolic acid content, detected via acid-fast staining."
    }
  ],

  biophys: [
    {
      q_fa: "واحد استاندارد بین‌المللی بالینی جهت اندازه‌گیری و ثبت فشار خون در طبابت کدام است؟",
      q_en: "What is the standard clinical unit of measurement for arterial blood pressure?",
      options: [
        [
          "میلی‌متر جیوه (mmHg)",
          "Millimeters of mercury (mmHg)",
          true,
          "صحیح است؛ فشار خون شریانی به طور سنتی و استاندارد با ارتفاع ستون جیوه برحسب میلی‌متر جیوه (mmHg) کالیبره و در معاینات بالینی ثبت می‌شود.",
          "Correct; blood pressure is universally reported in clinical medicine in millimeters of mercury (mmHg)."
        ],
        [
          "پاسکال خالص سیستم SI",
          "Pascal (Pa)",
          false,
          "نادرست است؛ پاسکال یکای فشار در سیستم بین‌المللی SI است، اما در دستگاه‌های مانومتر و معاینات پزشکی کاربرد بالینی مستقیم ندارد (هر ۱ mmHg معادل حدود ۱۳۳.۳ پاسکال است).",
          "Incorrect; although the Pascal is the SI unit of pressure, clinical medicine standardly utilizes mmHg."
        ],
        [
          "نیوتن بر متر مربع",
          "Newton per square meter",
          false,
          "نادرست است؛ نیوتن بر متر مربع معادل همان پاسکال است و در گزارش فشار فیزیولوژیک انسان استفاده نمی‌شود.",
          "Incorrect; N/m2 is identical to Pascal and not used for vascular hemodynamics."
        ],
        [
          "وات بر ثانیه",
          "Watt per second",
          false,
          "نادرست است؛ وات یکای توان انرژی است و هیچ ارتباط فیزیکی با کمیت فشار ندارد.",
          "Incorrect; the Watt is a unit of power, not pressure."
        ]
      ],
      ex_fa: "فشار خون طبیعی در بزرگسالان کمتر از ۱۲۰/۸۰ میلی‌متر جیوه است. فشار سیستولیک نشان‌دهنده اوج انقباض بطن و فشار دیاستولیک نشان‌دهنده مقاومت عروقی در فاز استراحت قلب است.",
      ex_en: "Normal resting blood pressure is <120/80 mmHg. The sphygmomanometer remains the reference standard device."
    },
    {
      q_fa: "مکانیسم تولید سیگنال تصویر در ام‌آر‌آی (MRI) بر پایه برهم‌کنش کدام پدیده‌های فیزیکی با پروتون‌های هیدروژن بافت است؟",
      q_en: "The physical basis of signal acquisition in magnetic resonance imaging (MRI) relies on the interaction of hydrogen protons with?",
      options: [
        [
          "میدان مغناطیسی قوی ایستا همراه با پالس‌های امواج رادیوفرکانسی (RF)",
          "Strong static magnetic field and radiofrequency (RF) pulses",
          true,
          "صحیح است؛ پروتون‌های هیدروژن بدن در میدان مغناطیسی قوی اسپین خود را تراز می‌کنند و با اعمال پالس رادیویی به فرکانس لارجلار، انرژی جذب کرده و در بازگشت به حالت تعادل (Relaxation T1 و T2)، سیگنال رادیویی تصویر تولید می‌شود.",
          "Correct; MRI aligns hydrogen nuclear spins in a strong magnetic field and perturbs them with radiofrequency pulses to generate signal."
        ],
        [
          "تابش باریکه پرتوهای ایکس یونی از چند زاویه",
          "Angular X-ray beam attenuation",
          false,
          "نادرست است؛ تضعیف اشعه ایکس در زوایای مختلف اساس تشکیل تصویر در سی‌تی‌اسکن (CT) است، نه MRI.",
          "Incorrect; X-ray attenuation across angular projections forms the basis of computed tomography."
        ],
        [
          "امواج صوتی مکانیکی با فرکانس مگاهرتز",
          "High-frequency acoustic sound waves",
          false,
          "نادرست است؛ امواج فراصوت مکانیکی اساس تصویربرداری سونوگرافی هستند.",
          "Incorrect; acoustic reflections govern ultrasonography."
        ],
        [
          "نابودی پوزیترون و تولید فوتون‌های گاما",
          "Positron annihilation producing coincidence gamma photons",
          false,
          "نادرست است؛ نابودی جفت پوزیترون-الکترون اساس کار اسکن توموگرافی انتشار پوزیترون (PET) است.",
          "Incorrect; positron annihilation underpins PET imaging."
        ]
      ],
      ex_fa: "تصویربرداری MRI دارای تفکیک بافتی فوق‌العاده برای بافت‌های نرم، طناب نخاعی، مغز و مفاصل است و خطرات پرتوهای یون‌ساز را به همراه ندارد.",
      ex_en: "MRI exploits the nuclear magnetic resonance of tissue hydrogen atoms, delivering high-contrast soft tissue imaging without ionizing radiation."
    }
  ]
};


export const BASIC_TOPICS = [
  { slug: "anatomy",   name_fa: "آناتومی",        name_en: "Anatomy",        parent: "basic", budget: 20, color: "#e0568a", icon: "patient" },
  { slug: "physio",    name_fa: "فیزیولوژی",       name_en: "Physiology",     parent: "basic", budget: 18, color: "#2f7fd1", icon: "activity" },
  { slug: "biochem",   name_fa: "بیوشیمی",         name_en: "Biochemistry",   parent: "basic", budget: 16, color: "#22a06b", icon: "flask" },
  { slug: "histology", name_fa: "بافت‌شناسی",      name_en: "Histology",      parent: "basic", budget: 12, color: "#6d5bd0", icon: "brain" },
  { slug: "embryo",    name_fa: "جنین‌شناسی",      name_en: "Embryology",     parent: "basic", budget: 10, color: "#e0912e", icon: "patient" },
  { slug: "micro",     name_fa: "میکروب‌شناسی",    name_en: "Microbiology",   parent: "basic", budget: 14, color: "#e0544f", icon: "flask" },
  { slug: "biophys",   name_fa: "بیوفیزیک",        name_en: "Biophysics",     parent: "basic", budget: 8,  color: "#2569b0", icon: "chart" },
];
