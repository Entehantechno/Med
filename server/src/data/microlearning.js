/* microlearning.js — QB-style (سبک کامران احمدی) micro-lessons + mixed exercise types.
   Each entry produces ONE flashcard with:
     - type: mcq | truefalse | fill | match | order
     - question payload appropriate to the type
     - micro: a short "درسنامه" shown after answering, styled like a QB explanation
       (نکتهٔ طلایی golden-note box, per-option analysis, source/reference).
   Written as original educational content for the app (no copyrighted text). */

/* micro shape:
   { lead_fa, lead_en,           // one-line takeaway
     golden_fa, golden_en,       // "نکتهٔ طلایی" highlighted box
     points_fa:[], points_en:[], // bullet key facts
     options_fa:[], options_en:[], // per-option analysis (why each is right/wrong) — for mcq
     source_fa, source_en }      // reference (شناسنامه) */

export const RICH = {
  gi: [
    {
      type: "mcq",
      q_fa: "مردی ۵۰ ساله با ملنا و افت فشار مراجعه کرده؛ محتمل‌ترین منبع خونریزی کدام است؟",
      q_en: "A 50-year-old man presents with melena and hypotension; the most likely bleeding source is?",
      options: [["زخم پپتیک", "Peptic ulcer", true], ["پولیپ کولون", "Colonic polyp", false], ["هموروئید", "Hemorrhoid", false], ["دیورتیکول", "Diverticulum", false]],
      // rich question media (an uploaded, self-hosted educational image)
      media: { url: "/uploads/demo-melena-endoscopy.svg", kind: "image", caption_fa: "نمای آندوسکوپیک زخم پپتیک", caption_en: "Endoscopic view of a peptic ulcer" },
      // پاسخنامه (answer explanation) with its own media (a short teaching video)
      explain: {
        text_fa: "ملنا منشأ فوقانی دارد؛ در این بیمار با افت فشار، اولویت با تثبیت همودینامیک (مایع/خون) و سپس آندوسکوپی تشخیصی–درمانی است. زخم پپتیک شایع‌ترین علت است.",
        text_en: "Melena is an upper-GI sign; in a hypotensive patient, resuscitate first (fluids/blood) then perform endoscopy. PUD is the most common cause.",
        media: { url: "https://www.aparat.com/v/demoGI1", kind: "embed", caption_fa: "ویدیوی کوتاه: رویکرد به خونریزی گوارشی فوقانی", caption_en: "Short video: approach to upper GI bleeding" },
      },
      micro: {
        lead_fa: "ملنا (مدفوع قیری) نشانهٔ خونریزی گوارشی فوقانی است.",
        lead_en: "Melena signals an upper GI source.",
        golden_fa: "زخم پپتیک شایع‌ترین علت خونریزی گوارشی فوقانی است؛ اولین اقدام تثبیت همودینامیک و سپس آندوسکوپی است.",
        golden_en: "PUD is the #1 cause of upper GI bleed; stabilize first, then endoscopy.",
        points_fa: ["ملنا معمولاً منشأ بالای رباط تریتز دارد.", "هماتوشزی به نفع منبع تحتانی است.", "PPI وریدی زودهنگام شروع شود."],
        points_en: ["Melena is usually proximal to the ligament of Treitz.", "Hematochezia favors a lower source.", "Start IV PPI early."],
        options_fa: ["✅ زخم پپتیک: منبع فوقانی و شایع‌ترین علت ملنا.", "❌ پولیپ کولون: منبع تحتانی، هماتوشزی می‌دهد.", "❌ هموروئید: خون روشن روی مدفوع، نه ملنا.", "❌ دیورتیکول: خونریزی تحتانی حجیم و بدون درد."],
        options_en: ["✅ PUD: upper source, top cause of melena.", "❌ Colonic polyp: lower source → hematochezia.", "❌ Hemorrhoid: bright blood, not melena.", "❌ Diverticulum: painless lower GI bleed."],
        source_fa: "هاریسون - فصل خونریزی گوارشی", source_en: "Harrison – GI Bleeding",
        reference: { book_fa: "هاریسون - اصول طب داخلی", book_en: "Harrison's Principles of Internal Medicine", chapter_fa: "فصل خونریزی گوارشی", chapter_en: "Chapter: GI Bleeding", edition: "22e", url: "https://accessmedicine.mhmedical.com/book.aspx?bookid=3095", page: "۲۳۸-۲۴۵" },
      },
    },
    {
      type: "truefalse",
      q_fa: "درمان ریشه‌کنی هلیکوباکتر پیلوری همیشه شامل حداقل یک مهارکنندهٔ پمپ پروتون است.",
      q_en: "H. pylori eradication always includes at least one proton-pump inhibitor.",
      answer: true,
      micro: {
        lead_fa: "رژیم‌های استاندارد ریشه‌کنی همگی PPI-محور هستند.",
        lead_en: "Standard eradication regimens are all PPI-based.",
        golden_fa: "رژیم سه‌گانه = PPI + کلاریترومایسین + آموکسی‌سیلین (۱۴ روز).",
        golden_en: "Triple therapy = PPI + clarithromycin + amoxicillin (14 days).",
        points_fa: ["در مناطق با مقاومت بالا رژیم چهارگانهٔ حاوی بیسموت ترجیح دارد.", "تأیید ریشه‌کنی با تست تنفسی اوره ۴ هفته بعد."],
        points_en: ["Bismuth quadruple therapy is preferred in high-resistance areas.", "Confirm eradication with urea breath test after 4 weeks."],
        source_fa: "گایدلاین ACG - هاریسون، فصل هلیکوباکتر", source_en: "ACG Guideline - Harrison, H. pylori",
        reference: { book_fa: "هاریسون - اصول طب داخلی", book_en: "Harrison's Principles of Internal Medicine", chapter_fa: "فصل هلیکوباکتر پیلوری", chapter_en: "Chapter: H. pylori", edition: "22e", url: "https://accessmedicine.mhmedical.com/book.aspx?bookid=3095", page: "۲۶۰-۲۶۸" },
      },
    },
  ],
  cardio: [
    {
      type: "order",
      q_fa: "مراحل برخورد اولیه با STEMI را به ترتیب مرتب کنید:",
      q_en: "Order the initial steps in managing STEMI:",
      items_fa: ["ECG در ۱۰ دقیقه", "آسپیرین بجوید", "ریپرفیوژن (PCI/فیبرینولیز)", "مانیتورینگ و اکسیژن در صورت نیاز"],
      items_en: ["ECG within 10 min", "Chew aspirin", "Reperfusion (PCI/fibrinolysis)", "Monitor & O2 if needed"],
      // correct order = index order above
      micro: {
        lead_fa: "زمان طلایی در STEMI: «Time is muscle».",
        lead_en: "In STEMI, time is muscle.",
        golden_fa: "هدف door-to-balloon زیر ۹۰ دقیقه؛ اگر PCI در دسترس نیست فیبرینولیز زیر ۳۰ دقیقه.",
        golden_en: "Goal door-to-balloon <90 min; if no PCI, fibrinolysis <30 min.",
        points_fa: ["ECG اولین قدم تشخیصی است.", "آسپیرین جویدنی جذب سریع‌تری دارد."],
        points_en: ["ECG is the first diagnostic step.", "Chewed aspirin absorbs faster."],
        source_fa: "گایدلاین ACC/AHA - هاریسون، فصل سندرم کرونری حاد", source_en: "ACC/AHA Guideline - Harrison, ACS",
        reference: { book_fa: "هاریسون - اصول طب داخلی", book_en: "Harrison's Principles of Internal Medicine", chapter_fa: "فصل سندرم کرونری حاد", chapter_en: "Chapter: Acute Coronary Syndrome", edition: "22e", url: "https://accessmedicine.mhmedical.com/book.aspx?bookid=3095", page: "۱۸۵۰-۱۸۷۰" },
      },
    },
  ],
  peds: [
    {
      type: "fill",
      q_fa: "واکسن ب‌ث‌ژ (BCG) در برنامهٔ ایمن‌سازی ایران در ____ تزریق می‌شود.",
      q_en: "In Iran's schedule, BCG is given at ____.",
      blank_fa: "بدو تولد", blank_en: "birth",
      accept_fa: ["بدو تولد", "تولد", "بدو تولّد"], accept_en: ["birth", "at birth"],
      micro: {
        lead_fa: "BCG جزو واکسن‌های بدو تولد است.",
        lead_en: "BCG is a birth-dose vaccine.",
        golden_fa: "واکسن‌های بدو تولد در ایران: BCG، هپاتیت B و فلج اطفال خوراکی (OPV صفر).",
        golden_en: "Birth-dose vaccines in Iran: BCG, Hepatitis B, and OPV-0.",
        points_fa: ["BCG از فرم‌های شدید سل (مننژیت سلی و میلیاری) محافظت می‌کند."],
        points_en: ["BCG protects against severe TB (miliary & TB meningitis)."],
        source_fa: "نلسون - فصل ایمن‌سازی", source_en: "Nelson – Immunization",
        reference: { book_fa: "نلسون - طب کودکان", book_en: "Nelson Textbook of Pediatrics", chapter_fa: "فصل ایمن‌سازی", chapter_en: "Chapter: Immunization", edition: "21e", url: "https://www.clinicalkey.com/#!/browse/book/3-s2.0-C20161017111", page: "۱۲۴۵-۱۲۶۰" },
      },
    },
    {
      type: "match",
      q_fa: "هر بیماری کودکان را به عامل شاخص آن وصل کنید:",
      q_en: "Match each pediatric disease to its hallmark:",
      pairs: [
        ["سرخک", "Measles", "لکه‌های کوپلیک", "Koplik spots"],
        ["اوریون", "Mumps", "تورم پاروتید", "Parotid swelling"],
        ["سیاه‌سرفه", "Pertussis", "سرفهٔ کوبنده", "Whooping cough"],
      ],
      micro: {
        lead_fa: "نشانه‌های شاخص کمک تشخیصی سریع می‌دهند.",
        lead_en: "Hallmark signs speed up diagnosis.",
        golden_fa: "لکه‌های کوپلیک ۱ تا ۲ روز قبل از بثورات سرخک ظاهر می‌شوند و پاتوگنومونیک‌اند.",
        golden_en: "Koplik spots precede the measles rash by 1–2 days and are pathognomonic.",
        points_fa: ["اوریون می‌تواند با اورکیت و مننژیت همراه باشد."],
        points_en: ["Mumps can be complicated by orchitis and meningitis."],
        source_fa: "نلسون - بیماری‌های عفونی کودکان", source_en: "Nelson – Pediatric ID",
        reference: { book_fa: "نلسون - طب کودکان", book_en: "Nelson Textbook of Pediatrics", chapter_fa: "فصل سرخک و اوریون", chapter_en: "Chapter: Measles & Mumps", edition: "21e", url: "https://www.clinicalkey.com/#!/browse/book/3-s2.0-C20161017111", page: "۱۶۵۰-۱۶۸۰" },
      },
    },
  ],
  endo: [
    {
      // Clinical Compare & Contrast — the classic medical discrimination task.
      type: "compare",
      q_fa: "تمایز بالینی: DKA در برابر HHS — هر ویژگی مربوط به کدام است؟",
      q_en: "Clinical compare & contrast: DKA vs HHS — which does each feature belong to?",
      entityA_fa: "DKA (کتواسیدوز)", entityA_en: "DKA",
      entityB_fa: "HHS (هایپراسمولار)", entityB_en: "HHS",
      features: [
        { fa: "کتون ادرار/خون مثبت", en: "Positive urine/serum ketones", belongs: "A" },
        { fa: "اسیدوز متابولیک با شکاف آنیونی بالا (pH < ۷.۳)", en: "High anion-gap metabolic acidosis (pH < 7.3)", belongs: "A" },
        { fa: "اسمولاریتهٔ سرم > ۳۲۰ mOsm/kg", en: "Serum osmolality > 320 mOsm/kg", belongs: "B" },
        { fa: "قند خون معمولاً > ۶۰۰ mg/dL", en: "Glucose usually > 600 mg/dL", belongs: "B" },
        { fa: "شایع‌تر در دیابت نوع ۲ و سالمندان", en: "More common in type-2 diabetes / elderly", belongs: "B" },
        { fa: "قند خون بالا و کم‌آبی", en: "Hyperglycemia and dehydration", belongs: "both" },
        { fa: "درمان با مایع، انسولین و اصلاح پتاسیم", en: "Treated with fluids, insulin and potassium correction", belongs: "both" },
      ],
      micro: {
        // درسنامه with a self-hosted comparison diagram
        media: { url: "/uploads/demo-dka-vs-hhs.svg", kind: "image", caption_fa: "نمودار مقایسهٔ DKA و HHS", caption_en: "DKA vs HHS comparison chart" },
        lead_fa: "DKA و HHS دو سر یک طیف‌اند؛ کلید تمایز، کتون و اسیدوز است.",
        lead_en: "DKA and HHS are two ends of one spectrum; ketones + acidosis are the discriminators.",
        golden_fa: "کتون مثبت + اسیدوز شکاف‌آنیونی = DKA. اسمولاریتهٔ خیلی بالا بدون کتوز مهم = HHS. HHS مرگ‌ومیر بالاتری دارد.",
        golden_en: "Ketones + anion-gap acidosis = DKA. Very high osmolality without significant ketosis = HHS. HHS has higher mortality.",
        points_fa: ["هر دو اورژانس‌اند و مایع‌درمانی سنگ‌بنای درمان است.", "پیش از انسولین، پتاسیم را چک کنید."],
        points_en: ["Both are emergencies; fluids are the cornerstone.", "Check potassium before insulin."],
        source_fa: "هاریسون - فصل کتواسیدوز دیابتی", source_en: "Harrison – DKA/HHS",
        reference: { book_fa: "هاریسون - اصول طب داخلی", book_en: "Harrison's Principles of Internal Medicine", chapter_fa: "فصل دیابت - اورژانس‌های متابولیک", chapter_en: "Chapter: Diabetes - Metabolic Emergencies", edition: "22e", url: "https://accessmedicine.mhmedical.com/book.aspx?bookid=3095", page: "۳۰۱۰-۳۰۲۵" },
      },
    },
    {
      type: "mcq",
      q_fa: "کدام معیار برای تشخیص دیابت به‌کار می‌رود؟",
      q_en: "Which value is diagnostic of diabetes?",
      options: [["HbA1c ≥ 6.5%", "HbA1c ≥ 6.5%", true], ["FPG = 100", "FPG = 100", false], ["HbA1c = 5.7%", "HbA1c = 5.7%", false], ["قند تصادفی = 150", "Random = 150", false]],
      micro: {
        lead_fa: "چند مسیر برای تشخیص دیابت وجود دارد.",
        lead_en: "Several pathways diagnose diabetes.",
        golden_fa: "تشخیص دیابت: HbA1c ≥ ۶.۵٪ یا FPG ≥ ۱۲۶ یا قند ۲ساعته ≥ ۲۰۰ یا قند تصادفی ≥ ۲۰۰ با علائم.",
        golden_en: "Dx: HbA1c ≥6.5% OR FPG ≥126 OR 2-h ≥200 OR random ≥200 + symptoms.",
        points_fa: ["پیش‌دیابت: HbA1c بین ۵.۷ تا ۶.۴٪.", "هر تست غیرطبیعی باید تکرار/تأیید شود."],
        points_en: ["Prediabetes: HbA1c 5.7–6.4%.", "Confirm any abnormal test on repeat."],
        options_fa: ["✅ HbA1c ≥۶.۵٪: معیار تشخیصی.", "❌ FPG=۱۰۰: مرز پایین اختلال قند ناشتا.", "❌ HbA1c=۵.۷٪: پیش‌دیابت.", "❌ قند تصادفی ۱۵۰: تشخیصی نیست."],
        options_en: ["✅ HbA1c ≥6.5%: diagnostic.", "❌ FPG=100: lower IFG cutoff.", "❌ HbA1c=5.7%: prediabetes.", "❌ Random 150: not diagnostic."],
        source_fa: "ADA Standards of Care - هاریسون، فصل دیابت", source_en: "ADA Standards of Care - Harrison, Diabetes",
        reference: { book_fa: "هاریسون - اصول طب داخلی", book_en: "Harrison's Principles of Internal Medicine", chapter_fa: "فصل دیابت ملیتوس", chapter_en: "Chapter: Diabetes Mellitus", edition: "22e", url: "https://accessmedicine.mhmedical.com/book.aspx?bookid=3095", page: "۲۹۸۰-۳۰۰۵" },
      },
    },
  ],
  pharm: [
    {
      type: "match",
      q_fa: "هر مسمومیت را به آنتی‌دوت آن وصل کنید:",
      q_en: "Match each poisoning to its antidote:",
      pairs: [
        ["استامینوفن", "Acetaminophen", "N-استیل‌سیستئین", "N-acetylcysteine"],
        ["اوپیوئید", "Opioid", "نالوکسان", "Naloxone"],
        ["بنزودیازپین", "Benzodiazepine", "فلومازنیل", "Flumazenil"],
        ["ارگانوفسفره", "Organophosphate", "آتروپین", "Atropine"],
      ],
      micro: {
        lead_fa: "دانستن جفت مسمومیت-آنتی‌دوت در اورژانس حیاتی است.",
        lead_en: "Knowing poison–antidote pairs is vital in the ED.",
        golden_fa: "آنتی‌دوت استامینوفن (NAC) بیشترین اثر را در ۸ ساعت اول دارد.",
        golden_en: "NAC for acetaminophen works best within the first 8 hours.",
        points_fa: ["در مسمومیت ارگانوفسفره پرالیدوکسیم هم اضافه می‌شود."],
        points_en: ["Add pralidoxime in organophosphate poisoning."],
        source_fa: "کاتزونگ - فصل antidote", source_en: "Katzung – Antidotes",
        reference: { book_fa: "کاتزونگ - فارماکولوژی", book_en: "Katzung's Pharmacology", chapter_fa: "فصل مسمومیت‌ها و آنتی‌دوت‌ها", chapter_en: "Chapter: Poisoning & Antidotes", edition: "15e", url: "https://accessmedicine.mhmedical.com/book.aspx?bookid=3058", page: "۹۸۰-۱۰۰۰" },
      },
    },
  ],
  neuro: [
    {
      type: "fill",
      q_fa: "پنجرهٔ درمانی tPA وریدی در سکتهٔ ایسکمیک تا ____ ساعت از شروع علائم است.",
      q_en: "The IV tPA window in ischemic stroke is up to ____ hours from onset.",
      blank_fa: "۴.۵", blank_en: "4.5",
      accept_fa: ["۴.۵", "4.5", "4/5", "۴/۵"], accept_en: ["4.5", "4,5"],
      micro: {
        lead_fa: "زمان در سکته مغزی نقش تعیین‌کننده دارد.",
        lead_en: "Time is critical in stroke.",
        golden_fa: "قبل از tPA حتماً CT بدون کنتراست برای رد خونریزی انجام شود.",
        golden_en: "Always get a non-contrast CT to exclude hemorrhage before tPA.",
        points_fa: ["ترومبکتومی مکانیکی تا ۲۴ ساعت در موارد منتخب."],
        points_en: ["Mechanical thrombectomy up to 24 h in selected cases."],
        source_fa: "گایدلاین AHA/ASA - هاریسون، فصل سکته مغزی", source_en: "AHA/ASA Guideline - Harrison, Stroke",
        reference: { book_fa: "هاریسون - اصول طب داخلی", book_en: "Harrison's Principles of Internal Medicine", chapter_fa: "فصل سکته مغزی ایسکمیک", chapter_en: "Chapter: Ischemic Stroke", edition: "22e", url: "https://accessmedicine.mhmedical.com/book.aspx?bookid=3095", page: "۳۳۰۰-۳۳۲۰" },
      },
    },
  ],
  surgery: [
    {
      type: "truefalse",
      q_fa: "علامت مورفی مثبت به نفع آپاندیسیت حاد است.",
      q_en: "A positive Murphy's sign indicates acute appendicitis.",
      answer: false,
      micro: {
        lead_fa: "علامت مورفی مربوط به کیسهٔ صفراست، نه آپاندیس.",
        lead_en: "Murphy's sign is about the gallbladder, not appendix.",
        golden_fa: "مورفی مثبت = کوله‌سیستیت حاد؛ حساسیت نقطهٔ مک‌بورنی = آپاندیسیت.",
        golden_en: "Positive Murphy = acute cholecystitis; McBurney tenderness = appendicitis.",
        points_fa: ["سونوگرافی اولین تصویربرداری در کوله‌سیستیت است."],
        points_en: ["Ultrasound is first-line imaging for cholecystitis."],
        source_fa: "شوارتز - فصل کوله‌سیستیت", source_en: "Schwartz – Cholecystitis",
        reference: { book_fa: "شوارتز - اصول جراحی", book_en: "Schwartz's Principles of Surgery", chapter_fa: "فصل کیسه صفرا و مجاری صفراوی", chapter_en: "Chapter: Gallbladder & Biliary Tract", edition: "11e", url: "https://accessmedicine.mhmedical.com/book.aspx?bookid=2576", page: "۱۴۲۰-۱۴۵۰" },
      },
    },
  ],
};
