#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enrichment script for Part 15 Batch 2 (Questions 30 to 59)
Target payload: work/tools/master-bank/import-payload.master-preint.part15.json
Note: Per user instructions, question_fa and options_fa are preserved exactly as original.
Only options_why_fa, explanation_fa, and micro are enriched.
"""

import json
import sys

PAYLOAD_PATH = "work/tools/master-bank/import-payload.master-preint.part15.json"

ENRICHMENTS_BATCH2 = {
    30: {
        "whys": [
            "نادرست است؛ دلیل رد: استئوآرتریت اولیه مفصل گلنوهومورال شانه ناشایع است و کمتر از ۵ درصد علل درد شانه را تشکیل می‌دهد.",
            "صحیح است؛ اختلالات و پاتولوژی‌های تاندون‌های روتاتور کاف (شامل تاندونیت، سندروم ایمپینجمنت ساب‌آکرومیال و پارگی‌های کاف به‌ویژه تاندون سوپرااسپیناتوس) با اختصاص بیش از ۶۵ تا ۷۰ درصد موارد، «شایع‌ترین علت درد شانه» در طب بالینی و روماتولوژی هستند.",
            "نادرست است؛ دلیل رد: آرتریت روماتوئید معمولاً مفاصل کوچک دست و مچ را متقارن مبتلا می‌سازد و شایع‌ترین علت درد شانه نیست.",
            "نادرست است؛ دلیل رد: بورسیت سابدلتوئید معمولاً ثانویه به آسیب تاندون روتاتور کاف رخ می‌دهد و علت اولیه مجزا و غالب نیست."
        ],
        "exp": "اختلالات تاندون‌های روتاتور کاف (به‌ویژه تاندونیت سوپرااسپیناتوس) شایع‌ترین علت مراجعه به علت درد شانه هستند.",
        "micro": {
            "lead_fa": "درد شانه سومین شکایت شایع اسکلتی-عضلانی در بالین است. شایع‌ترین علت درد شانه (بیش از دوسوم موارد)، آسیب‌ها و تاندینوپاتی روتاتور کاف و گیرافتادگی ساب‌آکرومیال است که معمولاً تاندون عضله سوپرااسپیناتوس را گرفتار می‌سازد. مشخصه بالینی آن قوس دردناک (Painful Arc) در ابداکسیون ۶۰ تا ۱۲۰ درجه و تشدید درد در شب هنگام خوابیدن روی شانه مبتلا است.",
            "lead_en": "Rotator cuff disorders, encompassing tendinitis, subacromial impingement syndrome, and tendon tears (predominantly involving the supraspinatus), represent the single most common etiology of shoulder pain, accounting for over two-thirds of clinical presentations.",
            "golden_fa": "شایع‌ترین علت درد شانه در بالین = تاندونیت و اختلالات روتاتور کاف (به‌ویژه سوپرااسپیناتوس).",
            "golden_en": "The single most common cause of shoulder pain = rotator cuff tendinopathy (supraspinatus).",
            "points_fa": [
                "عضله سوپرااسپیناتوس آغازگر ابداکسیون شانه در ۱۵ درجه اول است و بیش از سایر تاندون‌ها دچار تاندونیت می‌شود.",
                "مانورهای هاوکینز-کندی و نیر برای اثبات گیرافتادگی ساب‌آکرومیال استفاده می‌شوند.",
                "تست drop arm در صورت پارگی کامل تاندون سوپرااسپیناتوس مثبت می‌شود.",
                "درمان اولیه شامل اصلاح فعالیت، فیزیوتراپی تقویتی روتاتور کاف و NSAIDs است."
            ],
            "points_en": [
                "The supraspinatus tendon initiates abduction and is anatomically most vulnerable to subacromial impingement.",
                "Hawkins-Kennedy and Neer provocative maneuvers reliably elicit subacromial impingement symptoms.",
                "The drop arm sign specifically detects full-thickness tears of the supraspinatus tendon.",
                "First-line management centers on active overhead rest, rotator cuff rehabilitation, and short-course NSAIDs."
            ]
        }
    },
    31: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: تب یکی از مهم‌ترین پرچم‌های قرمز (Red flags) کمردرد است که نشانه استئومیلیت، دیسکیت یا آبسه اپیدورال است.",
            "نادرست است؛ دلیل رد: سن بالای ۷۰ سال (یا بالای ۵۰ سال) پرچم قرمز قطعی برای احتمال شکستگی فشاری استئوپروتیک یا بدخیمی استخوان است.",
            "نادرست است؛ دلیل رد: کاهش وزن غیرقابل توجیه یکی از شاخص‌ترین پرچم‌های قرمز کمردرد ناشی از بدخیمی‌های متاستاتیک یا میلوم است.",
            "صحیح است (موردی که نشانه خطر نیست)؛ «کاهش و تسکین درد با استراحت (Pain relieved by rest)» مشخصه کلاسیک و بارز کمردردهای مکانیکی ساده و خوش‌خیم (Lumbago / Muscle Strain) است؛ در نقطه مقابل، دردی که در استراحت ادامه یابد یا شب‌ها بدتر شود پرچم قرمز محسوب می‌شود."
        ],
        "exp": "کاهش درد با استراحت مشخصه کمردرد مکانیکی خوش‌خیم است؛ نشانه‌های خطر شامل تب، سن بالای ۷۰ و کاهش وزن هستند.",
        "micro": {
            "lead_fa": "غربالگری کمردرد بر شناسایی پرچم‌های قرمز (Red flags) متمرکز است که نیاز به تصویربرداری اورژانسی را مشخص می‌کنند: تب یا عفونت سیستمیک، سن بالای ۵۰ یا ۷۰ سال، سابقه سرطان، کاهش وزن بدون توجیه، مصرف کورتیکواستروئید، و نقص پیشرونده عصبی. دردهای مکانیکی عضلانی با فعالیت بدتر شده و با دراز کشیدن و استراحت آرام می‌گیرند که این یافته نشانه خوش‌خیم بودن درد است.",
            "lead_en": "Screening for red flags in back pain identifies candidates requiring urgent neuroimaging to rule out infection, malignancy, or fractures. Key red flags include fever, advanced age (>70 years), unexplained weight loss, and nocturnal unremitting pain. Improvement with rest is characteristic of benign mechanical strain.",
            "golden_fa": "نشانه‌های خطر کمردرد: تب، سن بالا و کاهش وزن؛ کاهش درد با استراحت نشانه خوش‌خیم مکانیکی است.",
            "golden_en": "Back pain red flags: fever, age >70, weight loss; relief with rest indicates benign mechanical strain.",
            "points_fa": [
                "درد مداوم در حالت درازکشیده که شب‌ها بیمار را بیدار کند پرچم قرمز تومور یا عفونت است.",
                "کمردرد مکانیکی با استراحت تسکین می‌یابد و نیازی به گرافی در ۴ هفته اول ندارد.",
                "بی‌اختیاری ادرار یا مدفوع پرچم قرمز اورژانس جراحی سندرم دم اسب (کودا اکوینا) است.",
                "کاهش وزن ناخواسته شک به متاستاز مهره‌ای را به شدت بالا می‌برد."
            ],
            "points_en": [
                "Nocturnal pain worsening with recumbency is a strong red flag for spinal neoplasm or epidural infection.",
                "Mechanical low back pain improves with recumbency and requires no routine early plain radiographs.",
                "Bowel or bladder incontinence is an ominous red flag mandating emergency decompression for cauda equina syndrome.",
                "Unintentional weight loss coupled with localized vertebral tenderness demands contrast-enhanced MRI."
            ]
        }
    },
    32: {
        "whys": [
            "نادرست است؛ دلیل رد: آرتریت قارچی سیر مزمن با مایع التهابی ملایم (WBC حدود ۱۰ تا ۳۰ هزار) و سلول‌های تک‌هسته‌ای یا مختلط ایجاد می‌کند.",
            "نادرست است؛ دلیل رد: آرتریت توبرکولوزی (سل مفصلی) تابلوی کلاسیک مونوآرتریت مزمن چندماهه با گلبول سفید حدود ۲۰٬۰۰۰ و ۵۰٪ نوتروفیل است.",
            "صحیح است (تشخیصی که مطرح نیست)؛ «آرتریت سپتیک حاد باکتریایی» یک بیماری حاد (با طول مدت چند روز) همراه با تب بالا و مایع چرکی با گلبول‌های سفید بسیار بالا (معمولاً بالای ۵۰٬۰۰۰ تا ۱۰۰٬۰۰۰ در میکرولیتر با بیش از ۹۰٪ نوتروفیل) است؛ سابقه ۴ ماهه بیماری با WBC=20,000 و تنها ۵۰٪ نوتروفیل با آرتریت سپتیک حاد همخوانی ندارد و این تشخیص مطرح نیست.",
            "نادرست است؛ دلیل رد: آرتریت روماتوئید می‌تواند با مونوآرتریت زانو با WBC بین ۵۰۰۰ تا ۲۵۰۰۰ با فرمول سلولی مختلط تظاهر کند."
        ],
        "exp": "طول مدت ۴ ماهه درد همراه با مایع مفصلی WBC=20,000 و ۵۰٪ نوتروفیل، با آرتریت سپسیس حاد باکتریایی همخوانی ندارد.",
        "micro": {
            "lead_fa": "مایع سینوویال بر اساس شمارش سلولی طبقه‌بندی می‌شود: غیرالتهابی (زیر ۲۰۰۰)، التهابی (۲۰۰۰ تا ۵۰٬۰۰۰)، و چرکی سپسیس (بیش از ۵۰٬۰۰۰ تا ۱۰۰٬۰۰۰ با بیش از ۹۰٪ نوتروفیل). آرتریت سپتیک باکتریایی کلاسیک یک بیماری برق‌آسا و حاد است که ظرف چند روز تظاهر می‌کند. در مونوآرتریت مزمن ۴ ماهه با WBC بیست‌هزار و تعادل ۵۰٪ لنفوسیت/نوتروفیل، سل مفصلی، عفونت‌های قارچی یا بیماری‌های روماتیسمی مزمن مطرح هستند نه آرتریت سپسیس.",
            "lead_en": "Synovial fluid is categorized as non-inflammatory (<2,000/μL), inflammatory (2,000-50,000/μL), or purulent/septic (>50,000/μL with >90% PMNs). Acute bacterial septic arthritis presents acutely within days with intense neutrophilic leukocytosis. A 4-month insidious effusion with 20,000 WBCs and 50% PMNs argues strongly against acute pyogenic sepsis.",
            "golden_fa": "مونوآرتریت مزمن ۴ ماهه با WBC=20,000 و ۵۰٪ نوتروفیل = سل یا قارچ یا RA؛ آرتریت سپتیک حاد باکتریایی مطرح نیست.",
            "golden_en": "Chronic 4-month effusion with 20,000 WBC and 50% PMNs = TB, fungal, or RA; acute bacterial sepsis is excluded.",
            "points_fa": [
                "سل مفصلی با بیوپسی بافت سینوویال و کشت بافت به دست می‌آید.",
                "در آرتریت سپتیک حاد نوتروفیل‌ها همواره بالای ۹۰٪ شمارش سلولی هستند.",
                "مایع سینوویال گروه II (التهابی) با کدر بودن و کاهش ویسکوزیته مشخص می‌شود.",
                "رنگ‌آمیزی اسید فست مایع سینوویال در سل مفصلی در کمتر از یک‌سوم موارد مثبت است."
            ],
            "points_en": [
                "Tuberculous arthritis confirmation relies upon synovial biopsy culture demonstrating caseating granulomas.",
                "Acute bacterial pyogenic arthritis almost invariably exhibits >90% polymorphonuclear predominance.",
                "Group II inflammatory synovial fluid displays translucency loss and reduced string sign viscosity.",
                "Acid-fast bacillus smear sensitivity in synovial fluid is poor (<30%), necessitating tissue culture."
            ]
        }
    },
    33: {
        "whys": [
            "نادرست است؛ دلیل رد: دیورتیک‌های تیازیدی و لوپ با کاهش حجم و افزایش بازجذب لوله‌ای اورات از شایع‌ترین علل هایپراوریسمی هستند.",
            "صحیح است (موردی که علت هایپراوریسمی نیست)؛ «آلکالوز» موجب هایپراوریسمی نمی‌شود و در واقع قلیایی شدن ادرار حلالیت اورات را افزایش می‌دهد؛ در نقطه مقابل، «اسیدوز» (نظیر اسیدوز لاکتیک و کتواسیدوز دیابتی یا الکلی) به علت رقابت آنیون‌های آلی با اسید اوریک در ترانسپورترهای لوله‌ای کلیه، دفع کلیوی اورات را مهار کرده و عامل شناخته‌شده هایپراوریسمی است.",
            "نادرست است؛ دلیل رد: اتانول (مصرف الکل) از طریق تولید لاکتات و افزایش ترن‌اور ATP یکی از مهم‌ترین محرک‌های هایپراوریسمی است.",
            "نادرست است؛ دلیل رد: پسوریازیس منتشر به دلیل تکثیر و تخریب سریع سلول‌های پوستی (ترن‌اور بالای نوکلئوتیدها) تولید اسید اوریک را افزایش می‌دهد."
        ],
        "exp": "اسیدوز با مهار دفع کلیوی اورات باعث هایپراوریسمی می‌شود، در حالی که آلکالوز عامل هایپراوریسمی نیست.",
        "micro": {
            "lead_fa": "هایپراوریسمی ناشی از افزایش تولید اورات (پسوریازیس شدید، نئوپلاسم‌ها، سندرم لیز تومور) یا کاهش دفع کلیوی اورات (نارسایی کلیه، دیورتیک‌ها، کتواسیدوز، اسیدوز لاکتیک) است. در حالت‌های اسیدوز، کتون‌بادی‌ها و اسید لاکتیک با ترشح اسید اوریک در توبول پروکسیمال رقابت کرده و اسید اوریک خون را بالا می‌برند. آلکالوز این تداخل را ایجاد نکرده و عامل هایپراوریسمی نیست.",
            "lead_en": "Hyperuricemia stems from urate overproduction (diffuse psoriasis, myeloproliferative disorders) or impaired renal excretion (diuretics, chronic kidney disease, metabolic acidosis). Organic acidemias (lactic acidosis, ketoacidosis) competitively inhibit urate secretion at URAT1, precipitating hyperuricemia. Alkalosis does not induce hyperuricemia.",
            "golden_fa": "علل هایپراوریسمی: دیورتیک‌ها، اتانول، پسوریازیس و اسیدوز؛ آلکالوز عامل بالا رفتن اسید اوریک نیست.",
            "golden_en": "Causes of hyperuricemia: diuretics, ethanol, psoriasis, and acidosis; alkalosis does not cause hyperuricemia.",
            "points_fa": [
                "کتواسیدوز دیابتی و گرسنگی طولانی‌مدت دفع کلیوی اورات را به شدت مهار می‌کنند.",
                "مصرف الکل سبب هیدرولیز سریع نوکلئوتیدهای آدنین و تولید اسید اوریک می‌شود.",
                "قلیایی کردن ادرار با بیکربنات یا سیترات سدیم انحلال اسید اوریک را بالا می‌برد.",
                "دیورتیک‌های تیازیدی شایع‌ترین عامل دارویی بروز حملات حاد نقرس هستند."
            ],
            "points_en": [
                "Diabetic ketoacidosis and starvation ketoacidosis suppress renal tubular uric acid excretion.",
                "Ethanol metabolism accelerates hepatic adenine nucleotide degradation, boosting urate synthesis.",
                "Urinary alkalinization with sodium/potassium citrate enhances uric acid solubility.",
                "Thiazide diuretics are the most frequent iatrogenic cause precipitating clinical gout flares."
            ]
        }
    },
    34: {
        "whys": [
            "نادرست است؛ دلیل رد: ESR شاخص عمومی التهاب است و برای تشخیص اختصاصی آرتریت روماتوئید ارزش تاییدی پایینی دارد.",
            "صحیح است؛ در بیماری با تابلوی پلی‌آرتریت التهابی متقارن مفاصل کوچک دست‌ها و خشکی صبحگاهی طولانی (شک به آرتریت روماتوئید)، «آنتی‌بادی ضد پپتید سیترولینه‌دار حلقوی (Anti-CCP / ACPA)» با داشتن «اختصاصیت فوق‌العاده بالا در حدود ۹۶ تا ۹۸ درصد» بالاترین ارزش تشخیصی و پیش‌آگهی را دارد؛ فاکتور روماتوئید (RF) حساس است اما اختصاصیت بسیار کمتری نسبت به Anti-CCP دارد.",
            "نادرست است؛ دلیل رد: CRP صرفاً یک پروتئین فاز حاد غیراختصاصی است و در بسیاری از بیماری‌های التهابی بالا می‌رود.",
            "نادرست است؛ دلیل رد: RF در بیماری‌های بافت همبند دیگر، عفونت‌های مزمن و افراد مسن سالم نیز مثبت می‌شود و اختصاصیت پایین‌تری نسبت به Anti-CCP دارد."
        ],
        "exp": "آنتی‌بادی Anti-CCP اختصاصیتی نزدیک به ۹۶ تا ۹۸ درصد برای آرتریت روماتوئید دارد و بالاترین ارزش تأییدی را داراست.",
        "micro": {
            "lead_fa": "در ارزیابی سرولوژیک آرتریت روماتوئید، دو اتوآنتی‌بادی کلیدی وجود دارند: فاکتور روماتوئید (RF) و Anti-CCP. گرچه حساسیت هر دو آزمایش مشابه است (حدود ۷۰ تا ۸۰ درصد)، اما اختصاصیت Anti-CCP (۹۶ تا ۹۸ درصد) بسیار فراتر از RF است. علاوه بر این، Anti-CCP در مراحل اولیه پیش از تغییرات رادیوگرافی مثبت می‌شود و پیش‌بینی‌کننده قوی بیماری اروزیو و تهاجمی است.",
            "lead_en": "Anti-cyclic citrullinated peptide (anti-CCP) antibodies demonstrate high diagnostic specificity (96-98%) for rheumatoid arthritis, markedly exceeding rheumatoid factor. Anti-CCP positivity strongly forecasts an erosive, aggressive disease course and is heavily weighted in the 2010 ACR/EULAR classification criteria.",
            "golden_fa": "بالاترین ارزش آزمایشگاهی در تأیید تشخیص آرتریت روماتوئید = آنتی‌بادی Anti-CCP (اختصاصیت ۹۶ تا ۹۸٪).",
            "golden_en": "Highest diagnostic specificity in confirming rheumatoid arthritis = anti-CCP antibody (96-98% specificity).",
            "points_fa": [
                "مثبت بودن توأم RF و Anti-CCP با بالاترین ارزش اخباری مثبت برای RA همراه است.",
                "فاکتور روماتوئید در عفونت هپاتیت C، اندوکاردیت و سندرم شوگرن نیز شایعاً مثبت می‌شود.",
                "معیارهای ACR/EULAR 2010 به Anti-CCP با تیتر بالا ۳ امتیاز اختصاص داده‌اند.",
                "حضور Anti-CCP حتی سال‌ها قبل از بروز علائم بالینی آرتریت در خون قابل شناسایی است."
            ],
            "points_en": [
                "Dual positivity for RF and anti-CCP confers the highest positive predictive value for persistent RA.",
                "Rheumatoid factor is notoriously non-specific, frequently positive in chronic hepatitis C and Sjögren's.",
                "High-titer anti-CCP serology receives maximum weighting (3 points) in the 2010 ACR/EULAR criteria.",
                "Anti-CCP antibodies frequently circulate in asymptomatic individuals years prior to clinical arthritis onset."
            ]
        }
    },
    35: {
        "whys": [
            "صحیح است؛ ریشه عصبی «L5» از طریق فتق دیسک بین‌مهره‌ای L4-L5 فشرده می‌شود؛ مسیر درماتوم درد و پارستزی ریشه L5 از باسن به «قسمت خلفی-خارجی ران، قدام-خارجی ساق پا و انتشار به پشت پا (دورسوم پا) و انگشت شست» است؛ همچنین رفلکس‌های تاندونی پاتلار و آشیل طبیعی باقی می‌مانند.",
            "نادرست است؛ دلیل رد: ریشه S1 به خلف ران و خلف ساق پا و کف پا تا انگشت کوچک پا انتشار دارد و رفلکس آشیل را مختل می‌سازد.",
            "نادرست است؛ دلیل رد: ریشه L4 به قدام ران و سطح داخلی ساق پا انتشار دارد و رفلکس پاتلار را کاهش می‌دهد.",
            "نادرست است؛ دلیل رد: ریشه L3 به قسمت قدامی ران بالای زانو انتشار می‌یابد و رفلکس‌ها را تضعیف می‌کند."
        ],
        "exp": "انتشار درد از باسن به خلفی-خارجی ران و ساق تا پشت پا، مسیر پاتوگنومونیک ریشه عصبی L5 است.",
        "micro": {
            "lead_fa": "فتق دیسک کمری L4-L5 شایع‌ترین محل رادیکولوپاتی کمری است که ریشه عصبی L5 را تحت فشار قرار می‌دهد. ویژگی‌های درماتوم و میوتوم L5: درد و بی‌حسی در مسیر پوستولترال ران، قدام لترال ساق و دورسوم پا تا شست پا؛ ضعف اکستانسور هالوسیس لونگوس (اختلال در راه رفتن روی پاشنه‌ها)؛ رفلکس‌های عمقی پاتلار و آشیل کاملاً طبیعی باقی می‌مانند.",
            "lead_en": "L5 radiculopathy, typically provoked by posterolateral L4-L5 disc protrusion, characteristically radiates along the posterolateral thigh, anterolateral calf, and across the dorsum of the foot into the hallux. Motor testing shows weakness in great toe extension (EHL), while patellar and Achilles reflexes remain intact.",
            "golden_fa": "درد باسن به خلفی-خارجی ران و ساق تا پشت پا = درگیری ریشه عصبی L5 (فتق دیسک L4-L5).",
            "golden_en": "Pain radiating down posterolateral thigh and leg to the foot dorsum = L5 nerve root compression.",
            "points_fa": [
                "تست SLR مستقیم در زاویه ۳۰ تا ۷۰ درجه برای ریشه L5 مثبت می‌شود.",
                "افتادگی پا (Foot drop) تظاهر حرکتی شدید فشار بر ریشه L5 است.",
                "ام‌آر‌آی روش انتخابی برای اثبات فتق دیسک در صورت عدم پاسخ به درمان محافظه‌کارانه است.",
                "در غیاب نقایص شدید حرکتی، استراحت نسبی و NSAIDs به مدت ۶ هفته درمان اولیه است."
            ],
            "points_en": [
                "The straight leg raise (Lasègue) maneuver elicits sharp radicular pain between 30° and 70°.",
                "Foot drop reflects profound L5 motor deficit impairing ankle and great toe dorsiflexion.",
                "Non-contrast lumbar MRI is the definitive imaging modality confirming root compromise.",
                "Conservative care with physical therapy and NSAIDs succeeds in >90% of cases within 6 weeks."
            ]
        }
    },
    36: {
        "whys": [
            "نادرست است؛ دلیل رد: آرتریت روماتوئید با تورم سینوویال گرم، خشکی صبحگاهی طولانی بیش از یک ساعت و درگیری متقارن مفاصل کوچک دست مشخص می‌شود.",
            "نادرست است؛ دلیل رد: هایپرپاراتیروئیدی اولیه بیماری متابولیک استخوان است و علامت کریپتاسیون ایزوله زانو با درد وابسته به بارگذاری نمی‌دهد.",
            "نادرست است؛ دلیل رد: نقرس با حملات حاد بسیار دردناک و اریتماتو با فواصل بدون علامت تظاهر می‌کند نه درد مزمن تدریجی دو ساله.",
            "صحیح است؛ درد مزمن زانوها در یک خانم ۶۰ ساله که با فعالیت و ایستادن تشدید می‌شود (درد مکانیکی)، همراه با عدم وجود سینوویت التهابی حاد و لمس صدای سایش و کریپتاسیون (Crepitation) ناشی از سایش سطوح غضروفی فرسوده، تابلوی کلاسیک «استئوآرتریت زانو (Knee Osteoarthritis / آرتروز)» است."
        ],
        "exp": "درد مکانیکی زانوها در سن ۶۰ سالگی با کریپتاسیون و عدم تورم سینوویال، مشخصه استئوآرتریت است.",
        "micro": {
            "lead_fa": "استئوآرتریت زانو شایع‌ترین بیماری مفصلی در سالمندان به ویژه در زنان پس از یائسگی است. علائم مشخصه: ۱) درد مکانیکی که با بارگذاری وزن و راه رفتن تشدید شده و با استراحت تسکین می‌یابد؛ ۲) خشکی صبحگاهی کوتاه کمتر از ۱۵ تا ۳۰ دقیقه (Gel phenomenon)؛ ۳) لمس کریپتاسیون استخوانی در حین باز و بسته کردن زانو؛ ۴) بزرگ‌شدگی استخوانی و عدم وجود حرارت و قرمزی سینوویوم.",
            "lead_en": "Knee osteoarthritis is the primary degenerative weight-bearing arthropathy in older females. Cardinal manifestations feature mechanical activity-induced joint pain, transient morning stiffness (<30 minutes), and palpable joint crepitus stemming from cartilage erosion and irregular subchondral articulating surfaces.",
            "golden_fa": "درد زانوها با راه رفتن + کریپتاسیون بدون سینوویت التهابی در زن ۶۰ ساله = استئوآرتریت (آرتروز).",
            "golden_en": "Weight-bearing knee pain + palpable crepitus without inflammatory effusion = knee osteoarthritis.",
            "points_fa": [
                "کریپتاسیون نشان‌دهنده از بین رفتن یکنواختی غضروف و سایش خشن استخوان ساب‌کوندرال است.",
                "درمان اولیه شامل کاهش وزن، ورزش‌های تقویتی چهارسر ران و NSAIDهای موضعی است.",
                "گرافی ساده زانو در حالت ایستاده باریک شدن فضای مفصل و استئوفیت‌ها را نشان می‌دهد.",
                "تزریق داخل مفصلی کورتیکواستروئید صرفاً برای تسکین موقت در دردهای شدید کاربرد دارد."
            ],
            "points_en": [
                "Crepitus is the tactile sensation of rough denuded subchondral bone surfaces rubbing together.",
                "Core management emphasizes therapeutic weight reduction, quadriceps conditioning, and topical NSAIDs.",
                "Weight-bearing plain radiography confirms joint space narrowing, subchondral sclerosis, and osteophytosis.",
                "Intra-articular steroid injections deliver transient (2-4 weeks) palliative anti-inflammatory benefit."
            ]
        }
    },
    37: {
        "whys": [
            "نادرست است؛ دلیل رد: داروی اوریکوزوریک پروبنسید کاهنده اورات است و در فاز حاد حمله نقرس ممنوعیت مصرف دارد.",
            "صحیح است؛ مشاهده کریستال‌های سوزنی‌شکل داخل سلولی با «انکسار مضاعف منفی قوی (Strong Negative Birefringence)» در مایع سینوویال مؤید قطعی «حمله حاد نقرس مفصلی» است؛ در حال حاضر و در فاز حاد، مناسب‌ترین اقدام دارویی تجویز «کلشی‌سین (Colchicine)» یا یک داروی ضدالتهاب غیراستروئیدی (NSAID) جهت سرکوب سریع التهاب حاد نوتروفیلی است.",
            "نادرست است؛ دلیل رد: شروع آلوپورینول در اواسط حمله حاد ممنوع است زیرا نوسان سطح اورات حمله را تشدید و طولانی می‌سازد.",
            "نادرست است؛ دلیل رد: فبوکسوستات نیز داروی کاهنده اورات است و مشابه آلوپورینول نباید در فاز حاد آغاز شود."
        ],
        "exp": "در حمله حاد نقرس با مشاهده کریستال‌های سوزنی با انکسار منفی، کلشی‌سین داروی انتخابی خط اول مهار التهاب حاد است.",
        "micro": {
            "lead_fa": "کریستال‌های اورات مونوسدیم (MSU) در زیر میکروسکوپ پلاریزان دارای شکل سوزنی و انکسار نوری منفی قوی هستند (در راستای موازی با فیلتر رنگ زرد و در راستای عمود رنگ آبی دارند). در هنگام حمله حاد نقرس، درمان فوری فقط متمرکز بر سرکوب التهاب با کلشی‌سین دوز پایین، NSAIDها یا استروئید است. داروهای کاهنده اورات (آلوپورینول، فبوکسوستات، پروبنسید) در فاز حاد ممنوع هستند.",
            "lead_en": "Monosodium urate crystals are needle-shaped with bright negative birefringence under polarized microscopy. Acute management focuses exclusively on rapid anti-inflammatory abortive therapy using low-dose colchicine, full-dose NSAIDs, or corticosteroids. Urate-lowering therapy must never be initiated during an active flare.",
            "golden_fa": "حمله حاد نقرس با کریستال سوزنی انکسار منفی = درمان حاد با کلشی‌سین یا NSAID (شروع آلوپورینول ممنوع است).",
            "golden_en": "Acute gout flare with negative birefringent needles = abortive therapy with colchicine or NSAIDs (allopurinol contraindicated acutely).",
            "points_fa": [
                "رژیم مدرن کلشی‌سین: یک میلی‌گرم اولیه و ۰/۵ میلی‌گرم یک ساعت بعد با کارایی عالی و سمیت اندک گوارشی.",
                "کریستال‌های نقرس کاذب (CPPD) متوازی‌الاضلاع با انکسار نوری مثبت ضعیف هستند.",
                "آلوپورینول باید ۲ تا ۴ هفته پس از فروکش کامل حمله با دوز پایین آغاز شود.",
                "همزمان با شروع آلوپورینول، کلشی‌سین با دوز پیشگیری به مدت ۳ تا ۶ ماه ادامه می‌یابد."
            ],
            "points_en": [
                "Low-dose colchicine (1.0 mg followed by 0.5 mg 1 hour later) matches high-dose efficacy without toxicity.",
                "CPPD pseudogout crystals exhibit rhomboid morphology with weak positive birefringence.",
                "Urate-lowering therapy initiation should be deferred for 2 to 4 weeks post-flare resolution.",
                "Initiating allopurinol requires concurrent low-dose colchicine flare prophylaxis for 3-6 months."
            ]
        }
    },
    38: {
        "whys": [
            "نادرست است؛ دلیل رد: دید مستقیم و رنگ‌آمیزی گرم مایع سینوویال جهت بررسی باکتری‌ها و کریستال‌های نقرس کاملاً حیاتی و الزامی است.",
            "صحیح است (اقدامی که بررسی آن در مایع مفصل لزومی ندارد)؛ سنجش «پروتئین، LDH و pH مایع مفصلی» ارزش تشخیصی و تمایزدهنده اثبات‌شده‌ای در افتراق آرتریت سپسیس از آرتریت کریستالی حاد ندارد و در هیچ‌یک از پروتکل‌های استاندارد روماتولوژی توصیه نمی‌شود و اتلاف وقت است.",
            "نادرست است؛ دلیل رد: کشت خون و مایع مفصلی برای اثبات قطعی یا رد آرتریت سپتیک باکتریایی الزامی است.",
            "نادرست است؛ دلیل رد: بررسی اسید اوریک سرم برای ارزیابی وضعیت متابولیک بیمار با سابقه پوداگرا ضروری است."
        ],
        "exp": "سنجش پروتئین، LDH و pH مایع سینوویال در تشخیص آرتریت ارزشی ندارد و در بررسی مونوآرتریت حاد لازم نیست.",
        "micro": {
            "lead_fa": "آنالیز مایع سینوویال در مونوآرتریت حاد شامل: ظاهر فیزیکی (رنگ، شفافیت، ویسکوزیته)، شمارش کامل سلولی و تفکیک درصدی (WBC و PMN)، رنگ‌آمیزی گرم و کشت باکتریولوژی، و بررسی کریستال‌ها زیر نور پلاریزان است. برخلاف مایع پلور و صفاق، اندازه‌گیری بیوشیمیایی گلوکز، پروتئین، LDH و pH در مایع مفصلی فاقد حساسیت و اختصاصیت بوده و بررسی آن‌ها در ارزیابی تشخیصی بالینی روتین جایگاهی ندارد.",
            "lead_en": "Synovial fluid analysis in acute monoarthritis requires physical assessment, cell count with differential, Gram stain, bacterial culture, and compensated polarized microscopy for crystals. Biochemical testing for protein, LDH, and pH lacks diagnostic specificity and is explicitly unnecessary.",
            "golden_fa": "در آنالیز مایع مفصلی: شمارش سلول، اسمیر، کشت و کریستال الزامی است؛ سنجش پروتئین، LDH و pH لازم نیست.",
            "golden_en": "Essential synovial fluid tests: cell count, Gram stain, culture, crystals; measuring protein, LDH, and pH is unindicated.",
            "points_fa": [
                "گلبول سفید بالای ۵۰٬۰۰۰ در میکرولیتر با بیش از ۹۰٪ نوتروفیل نشانه عفونت باکتریایی است.",
                "مشاهده کریستال‌های اورات تشخیص نقرس را اثبات می‌کند اما آرتریت سپسیس همزمان را رد نمی‌کند.",
                "رنگ‌آمیزی گرم در ۵۰ تا ۷۰ درصد موارد آرتریت باکتریایی باسیل یا کوکسی‌ها را نشان می‌دهد.",
                "اسید اوریک سرم در یک‌سوم موارد در جریان حمله حاد نقرس ممکن است در حد نرمال باشد."
            ],
            "points_en": [
                "Synovial leukocyte counts >50,000/μL with >90% polymorphonuclears strongly point to bacterial infection.",
                "Identifying intracellular urate crystals confirms gout but does not exclude concomitant septic arthritis.",
                "Gram stain demonstrates causative microorganisms in 50-70% of non-gonococcal bacterial infections.",
                "Serum uric acid levels may transiently normalize in up to one-third of acute gout flare presentations."
            ]
        }
    },
    39: {
        "whys": [
            "صحیح است؛ درد در سمت رادیال مچ دست در یک خانم دو ماه پس از زایمان (به علت در آغوش گرفتن مکرر نوزاد و تغییرات هورمونی) به همراه مثبت شدن «تست فینکلشتاین (Finkelstein's Test)» پاتوگنومونیک بیماری «تنوسینوویت دکوئروان (De Quervain's Tenosynovitis)» است که التهاب غلاف تاندون‌های ابداکتور پولیسیس لونگوس و اکستانسور پولیسیس برویس در مچ دست است.",
            "نادرست است؛ دلیل رد: انگشت ماشه‌ای (Trigger finger) با گیر کردن و تقه زدن حین باز کردن انگشت در قرقره A1 کف دست مشخص می‌شود.",
            "نادرست است؛ دلیل رد: سندرم تونل کارپال با تست‌های فالن و تینل و پارستزی در قلمرو عصب مدین مشخص می‌گردد نه درد لبه رادیال مچ.",
            "نادرست است؛ دلیل رد: استئوآرتریت قاعده شست (CMC1) معمولاً در زنان مسن رخ می‌دهد و تست Grind در آن مثبت است نه فینکلشتاین."
        ],
        "exp": "درد لبه رادیال مچ دست پس از زایمان با تست فینکلشتاین مثبت، مشخصه تنوسینوویت دکوئروان است.",
        "micro": {
            "lead_fa": "تنوسینوویت دکوئروان تنگی و التهاب اولین کمپارتمنت دورسال مچ دست است که تاندون‌های ابداکتور پولیسیس لونگوس (APL) و اکستانسور پولیسیس برویس (EPB) را در بر می‌گیرد. زنان پس از زایمان به دلیل بلند کردن مکرر نوزاد با زاویه باز دست مستعدترین گروه هستند. مانور فینکلشتاین (قرار دادن شست درون مشت بسته و انحراف اولنار مچ) درد شدیدی در استیلوئید رادیوس برمی‌انگیزد.",
            "lead_en": "De Quervain tenosynovitis represents stenosing tenosynovitis of the first extensor compartment enclosing the APL and EPB tendons over the radial styloid. Frequently afflicting postpartum mothers lifting infants, the diagnostic hallmark is a positive Finkelstein maneuver producing sharp pain upon ulnar deviation of the fist-enclosed thumb.",
            "golden_fa": "درد لبه رادیال مچ دست در مادر پس از زایمان + تست فینکلشتاین مثبت = تنوسینوویت دکوئروان.",
            "golden_en": "Radial styloid wrist pain in postpartum female + positive Finkelstein test = De Quervain tenosynovitis.",
            "points_fa": [
                "تاندون‌های درگیر: ابداکتور پولیسیس لونگوس (APL) و اکستانسور پولیسیس برویس (EPB).",
                "بریس تامب اسپایکا (Thumb-spica splint) شست و مچ را بی‌حرکت نگه داشته و درد را تسکین می‌دهد.",
                "تزریق موضعی کورتیکواستروئید به غلاف تاندون اثربخشی درمانی بالای ۸۰ تا ۹۰ درصد دارد.",
                "در صورت شکست درمان‌های نگهدارنده پس از ۶ ماه، جراحی آزادسازی غلاف کمپارتمنت اول انجام می‌شود."
            ],
            "points_en": [
                "The tendons involved are the abductor pollicis longus and extensor pollicis brevis.",
                "A thumb-spica splint provides biomechanical immobilization of the first ray, promoting healing.",
                "Intrasheath corticosteroid injection achieves curative resolution in >80% of uncomplicated presentations.",
                "Surgical decompression of the first dorsal compartment is reserved for refractory chronic cases."
            ]
        }
    },
    40: {
        "whys": [
            "صحیح است؛ حضور آنتی‌بادی «Anti-Scl-70 (آنتی‌توپوایزومراز I)» در بیمار مبتلا به پدیده رینود مشخصه اسکلروز سیستمیک پوستی منتشر و قوی‌ترین فاکتور خطر برای «بیماری بینابینی فیبروز دهنده ریه (ILD)» است؛ اقدام استاندارد برای پیگیری و غربالگری اولیه، «انجام آزمون‌های عملکرد ریه شامل اسپیرومتری و سنجش ظرفیت انتشار مونوکسیدکربن (DLCO)» و در صورت لزوم سی‌تی‌اسکن HRCT ریه است.",
            "نادرست است؛ دلیل رد: ادرار ۲۴ ساعته برای کریز کلیوی نیست؛ کریز کلیوی با فشار خون و کراتینین پایش می‌شود و با Anti-RNA Polymerase III مرتبط است.",
            "نادرست است؛ دلیل رد: تست شیرمر برای شوگرن است و با Anti-Scl-70 در اسکلرودرمی اولویت غربالگری ریوی را ندارد.",
            "نادرست است؛ دلیل رد: سندرم آنتی‌فسفولیپید ربطی به پیگیری اختصاصی درگیری ارگان‌های داخلی در اسکلرودرمی ندارد."
        ],
        "exp": "در بیمار رینود با Anti-Scl-70 مثبت، انجام اسپیرومتری و DLCO جهت غربالگری زودهنگام فیبروز ریه (ILD) توصیه می‌شود.",
        "micro": {
            "lead_fa": "اسکلروز سیستمیک منتشر با آنتی‌بادی Anti-Scl-70 تمایل شدیدی به ایجاد بیماری فیبروز بینابینی ریه (ILD) دارد که علت اول مرگ‌ومیر در این بیماران است. از آنجا که کاهش عملکرد ریه قبل از پیدایش تنگی نفس و سرفه آغاز می‌شود، تمام بیماران در زمان تشخیص باید تحت غربالگری با اسپیرومتری (کاهش FVC)، سنجش DLCO (کاهش زودرس) و HRCT قفسه سینه قرار گیرند.",
            "lead_en": "Anti-topoisomerase I (anti-Scl-70) positivity in systemic sclerosis is tightly correlated with progressive interstitial lung disease (ILD). Initial surveillance mandates baseline pulmonary function testing (spirometry, lung volumes, and DLCO) alongside high-resolution chest CT to detect early alveolar restriction.",
            "golden_fa": "رینود + Anti-Scl-70 مثبت = غربالگری زودهنگام درگیری ریه با اسپیرومتری، DLCO و HRCT ریه.",
            "golden_en": "Raynaud + positive anti-Scl-70 = screen for pulmonary fibrosis with spirometry, DLCO, and chest HRCT.",
            "points_fa": [
                "افت DLCO حساس‌ترین نشانگر اولیه کاهش بستر تبادل گازهای ریوی در اسکلرودرمی است.",
                "در صورت اثبات ILD فعال، درمان با مایکوفنولات موفتیل (MMF) یا سیکلوفسفامید آغاز می‌گردد.",
                "توسیلیزوماب (مهارکننده گیرنده IL-6) روند افت FVC را در اسکلرودرمی کند می‌کند.",
                "رادیوگرافی ساده ریه حساسیت بسیار پایینی دارد و جایگزین HRCT و اسپیرومتری نمی‌شود."
            ],
            "points_en": [
                "Disproportionate DLCO reduction represents the earliest functional indicator of microvascular and alveolar disease.",
                "Active progressive SSc-ILD mandates immunosuppression with mycophenolate mofetil or cyclophosphamide.",
                "Tocilizumab (anti-IL-6 receptor antagonist) preserves forced vital capacity in progressive diffuse disease.",
                "Conventional chest radiography possesses dismal sensitivity for early ground-glass interstitial infiltrates."
            ]
        }
    },
    41: {
        "whys": [
            "نادرست است؛ دلیل رد: سایکوز و تشنج جزء معیارهای رسمی تشخیصی سیستم عصبی در لوپوس هستند.",
            "صحیح است (موردی که جزء معیارهای SLE نیست)؛ در بیماری لوپوس اریتماتوی سیستمیک اختلالات خونی شامل «لکوپنی (WBC کمتر از ۴۰۰۰)، لنفوپنی (کمتر از ۱۵۰۰) و ترومبوسیتوپنی (پلاکت کمتر از ۱۰۰٬۰۰۰)» جزء معیارهای تشخیصی رسمی هستند؛ بنابراین «لکوسیتوز» نه تنها معیار تشخیصی نیست بلکه خلاف روند سرکوب مغز استخوان ناشی از لوپوس بوده و معمولاً نشانه عفونت اضافه شده یا مصرف کورتیکواستروئید است.",
            "نادرست است؛ دلیل رد: آرتریت غیراروزیو دو یا چند مفصل محیطی جزء معیارهای رسمی تشخیصی لوپوس است.",
            "نادرست است؛ دلیل رد: ترومبوسیتوپنی با پلاکت کمتر از ۱۰۰٬۰۰۰ جزء معیارهای خونی رسمی SLE است."
        ],
        "exp": "لوپوس موجب لکوپنی و لنفوپنی می‌شود؛ بنابراین لکوسیتوز جزء معیارهای تشخیصی SLE نیست.",
        "micro": {
            "lead_fa": "معیارهای تشخیصی ACR و SLICC برای لوپوس اریتماتوی سیستمیک شامل حیطه‌های بالینی و ایمونولوژیک است. در حیطه خون‌شناسی (Hematologic)، معیارهای تشخیصی شامل: لکوپنی (گلبول سفید کمتر از ۴۰۰۰ در حداقل دو نوبت)، لنفوپنی (لنفوسیت کمتر از ۱۵۰۰ در حداقل دو نوبت)، ترومبوسیتوپنی (پلاکت کمتر از ۱۰۰٬۰۰۰ در غیاب داروها)، و آنمی همولیتیک اتوایمیون با رتیکولوسیتوز است. لکوسیتوز هرگز معیار لوپوس نبوده و باید عفونت را مطرح ساخت.",
            "lead_en": "Diagnostic classification criteria for systemic lupus erythematosus strictly incorporate cytopenias: leukopenia (<4,000/μL), lymphopenia (<1,500/μL), thrombocytopenia (<100,000/μL), and autoimmune hemolytic anemia. Leukocytosis is never a criterion for SLE; its presence prompts suspicion of intercurrent infection or steroid effect.",
            "golden_fa": "معیارهای خونی لوپوس: لکوپنی، لنفوپنی و ترومبوسیتوپنی؛ لکوسیتوز جزء معیارهای SLE نیست.",
            "golden_en": "Lupus hematologic criteria: leukopenia, lymphopenia, and thrombocytopenia; leukocytosis is not an SLE criterion.",
            "points_fa": [
                "لکوسیتوز در بیمار لوپوسی زنگ خطر جدی برای عفونت‌های فرصت‌طلب است.",
                "پردنیزولون با دوز بالا با مهار مارژیناسیون نوتروفیل‌ها می‌تواند لکوسیتوز دارویی ایجاد کند.",
                "آنمی در لوپوس شایعاً از نوع آنمی بیماری مزمن یا آنمی همولیتیک کومبس مثبت است.",
                "حضور ۴ معیار از معیارهای تشخیصی برای اثبات لوپوس الزامی است."
            ],
            "points_en": [
                "Leukocytosis emerging in a lupus patient represents a critical red flag for intercurrent bacterial infection.",
                "Exogenous glucocorticoid therapy induces demargination granulocytosis, mimicking systemic infection.",
                "Anemia in SLE typically stems from chronic disease or Coombs-positive autoimmune hemolytic destruction.",
                "Fulfillment of at least 4 criteria (including clinical and immunologic domains) establishes classification."
            ]
        }
    },
    42: {
        "whys": [
            "نادرست است؛ دلیل رد: وگنر واسکولیت عروق کوچک و متوسط است و اختلاف نبض و فشار اندام فوقانی در زن جوان ایجاد نمی‌کند.",
            "نادرست است؛ دلیل رد: آرتریت تمپورال واسکولیت عروق بزرگ در افراد بالای ۵۰ سال است نه دختر ۲۲ ساله.",
            "صحیح است؛ سن ۲۲ سالگی در یک زن جوان، خستگی و ضعف ناشی از ایسکمی اندام فوقانی چپ در حین فعالیت (کلادیکاسیون دست)، و وجود «اختلاف فشار خون بارز معادل ۳۰ میلی‌متر جیوه بین دست راست و چپ» همراه با افزایش ESR و کم‌خونی، تابلوی کلاسیک و پاتوگنومونیک «آرتریت تاکایاسو (Takayasu Arteritis / بیماری بدون نبض)» است که یک واسکولیت گرانولوماتوز عروق بزرگ (آئورت و شاخه‌های اصلی آن نظیر شریان ساب‌کلاوین) در زنان جوان است.",
            "نادرست است؛ دلیل رد: لوپوس واسکولیت عروق بزرگ با تنگی ساب‌کلاوین و اختلاف فشار خون دو دست ایجاد نمی‌کند."
        ],
        "exp": "اختلاف فشار خون دو دست و لنگش دست در زن ۲۲ ساله با ESR بالا، مشخصه کلاسیک آرتریت تاکایاسو است.",
        "micro": {
            "lead_fa": "آرتریت تاکایاسو یک واسکولیت گرانولوماتوز مزمن آئورت و شاخه‌های اصلی آن است که به شدت در زنان جوان زیر ۴۰ سال شایع است. التهاب دیواره شریان منجر به تنگی، انسداد یا تشکیل آنوریسم می‌شود. علائم شاخص: کلادیکاسیون دست حین کار، نبض‌های ضعیف یا غایب اندام فوقانی (بیماری بدون نبض)، اختلاف فشار خون بیش از ۱۰ تا ۲۰ میلی‌متر جیوه بین دو دست، و سوفل‌های عروقی روی شریان ساب‌کلاوین یا آئورت.",
            "lead_en": "Takayasu arteritis is a chronic granulomatous large-vessel vasculitis targeting the aorta and its major branches, predominantly afflicting young females under 40. Hallmark findings feature upper limb claudication, asymmetric or absent peripheral pulses, and blood pressure discrepancy >10-20 mmHg between arms.",
            "golden_fa": "زن جوان + خستگی دست + اختلاف فشار خون دو دست بیش از ۱۰-۲۰ mmHg با ESR بالا = آرتریت تاکایاسو.",
            "golden_en": "Young female + arm claudication + bilateral arm BP discrepancy with high ESR = Takayasu arteritis.",
            "points_fa": [
                "سی‌تی آنژیوگرافی یا ام‌آر آنژیوگرافی آئورت روش تشخیصی انتخابی برای نمایش ضخامت دیواره و تنگی‌هاست.",
                "درمان خط اول دارویی گلوکوکورتیکوئیدهای دوز بالا (پردنیزولون یک میلی‌گرم به ازای کیلوگرم) است.",
                "داروهای بیولوژیک ضد IL-6 (توسیلیزوماب) و مهارکننده‌های TNF در موارد مقاوم بسیار مؤثرند.",
                "مداخلات جراحی بای‌پس عروقی یا آنژیوپلاستی تنها پس از کنترل کامل التهاب فاز فعال مجاز است."
            ],
            "points_en": [
                "CT or MR angiography represents the non-invasive imaging modality of choice, delineating mural thickening and stenoses.",
                "High-dose systemic corticosteroid therapy (prednisone 1 mg/kg/day) forms the cornerstone of remission induction.",
                "Biologic agents targeting IL-6 (tocilizumab) or TNF-alpha demonstrate robust efficacy in refractory arteritis.",
                "Surgical vascular reconstruction or angioplasty must be deferred until active systemic inflammation is fully arrested."
            ]
        }
    },
    43: {
        "whys": [
            "نادرست است؛ دلیل رد: در آرتریت روماتوئید خشکی صبحگاهی طولانی بیش از یک ساعت است، درد با فعالیت بهتر می‌شود و پلی‌آرتریت قرینه مفاصل کوچک دیده می‌شود.",
            "صحیح است؛ درد مکانیکی زانو در خانم ۶۵ ساله که با فعالیت بدتر شده و با استراحت بهبود می‌یابد، خشکی صبحگاهی کوتاه ۱۰ دقیقه‌ای (پدیده ژل)، عدم وجود تورم التهابی و مارکرهای خونی التهاب نرمال، تابلوی بالینی تیپیک «استئوآرتریت زانو (Knee Osteoarthritis)» است؛ مثبت شدن فاکتور روماتوئید با تیتر پایین (1+) در افراد مسن سالم در ۱۰ تا ۱۵ درصد موارد دیده می‌شود و ارزش پاتولوژیک ندارد.",
            "نادرست است؛ دلیل رد: آرتریت پسوریازیس ماهیت التهابی حاد با علائم پوستی، انتزیت و داکتیلیت دارد.",
            "نادرست است؛ دلیل رد: فیبرومیالژی با دردهای منتشر اسکلتی بالا و پایین دیافراگم در تمام بدن تظاهر می‌کند نه مونوآرتریت مکانیکی زانو."
        ],
        "exp": "درد مکانیکی زانو با خشکی ۱۰ دقیقه‌ای و ESR نرمال، معرف استئوآرتریت است؛ RF ضعیف در افراد مسن شایع و فاقد اهمیت است.",
        "micro": {
            "lead_fa": "افتراق درد مکانیکی از التهابی کلید اساسی در روماتولوژی است: استئوآرتریت با درد حین بارگذاری، تسکین در استراحت، خشکی صبحگاهی زیر ۱۵ تا ۳۰ دقیقه و مارکرهای فاز حاد طبیعی شناخته می‌شود. نکته بسیار مهم آزمونی این است که تیترهای ضعیف و پایین فاکتور روماتوئید (RF) در ۱۰ تا ۲۰ درصد افراد بالای ۶۰ سال کاملاً سالم به صورت فیزیولوژیک مثبت می‌شود و بدون علائم بالینی RA نباید مبنای تشخیص غلط قرار گیرد.",
            "lead_en": "Differentiating mechanical from inflammatory joint pain is fundamental: osteoarthritis produces load-dependent pain relieved by rest, morning stiffness under 15 minutes, and normal inflammatory markers. Low-titer rheumatoid factor is an incidental finding in up to 15% of healthy elderly individuals and should not mislead the clinician.",
            "golden_fa": "درد مکانیکی زانو با خشکی کوتاه و فاز حاد نرمال = استئوآرتریت؛ تیتر ضعیف RF در سالمندان بی‌اهمیت است.",
            "golden_en": "Mechanical knee pain + brief morning stiffness + normal ESR = osteoarthritis; low-titer RF in the elderly is non-specific.",
            "points_fa": [
                "خشکی صبحگاهی در استئوآرتریت به سرعت ظرف چند دقیقه با حرکت برطرف می‌گردد.",
                "درمان شامل کاهش وزن، تمرینات ایزومتریک کوادری‌سپس و تجویز مسکن‌های موضعی است.",
                "رادیوگرافی ساده در وضعیت ایستاده کاهش فضای مفصلی و استئوفیت‌ها را اثبات می‌کند.",
                "مثبت بودن ضعیف RF هرگز به تنهایی برای شروع داروهای سرکوب‌کننده ایمنی کافی نیست."
            ],
            "points_en": [
                "Morning gel phenomenon in osteoarthritis typically resolves within minutes of ambulation.",
                "Core conservative management focuses on weight reduction, quadriceps exercises, and topical NSAIDs.",
                "Weight-bearing plain radiography confirms characteristic joint space narrowing and marginal osteophytosis.",
                "Low-titer rheumatoid factor in the absence of clinical synovitis never justifies immunosuppressive therapy."
            ]
        }
    },
    44: {
        "whys": [
            "نادرست است؛ دلیل رد: پرفشاری خون به تنهایی بدون حملات بالینی نقرس اندیکاسیون درمان هایپراوریسمی بدون علامت نیست.",
            "نادرست است؛ دلیل رد: چاقی و دیابت اندیکاسیون شروع آلوپورینول در هایپراوریسمی بدون علامت نیستند.",
            "صحیح است؛ بر اساس راهنماهای بالینی انجمن روماتولوژی آمریکا (ACR)، درمان دارویی کاهنده اسید اوریک با آلوپورینول در هایپراوریسمی بدون علامت اندیکاسیون ندارد؛ اندیکاسیون‌های قطعی شروع داروی کاهنده اورات شامل: ۱) وجود توفوس نقرسی در معاینه یا تصویربرداری؛ ۲) شواهد آسیب رادیوگرافی ناشی از نقرس؛ ۳) «سابقه دو بار یا بیشتر حمله حاد نقرس در سال گذشته (Frequent Flares ≥ 2 per year)»؛ ۴) نارسایی مزمن کلیه (CKD مرحله ۳ یا بالاتر) یا سنگ‌های کلیوی ادراری است.",
            "نادرست است؛ دلیل رد: سابقه فامیلی نقرس اندیکاسیون شروع درمان دارویی مادام‌العمر آلوپورینول نیست."
        ],
        "exp": "سابقه دو بار یا بیشتر حمله نقرس در سال گذشته، از اندیکاسیون‌های قطعی شروع درمان درازمدت با آلوپورینول است.",
        "micro": {
            "lead_fa": "شروع درمان دارویی کاهنده اسید اوریک (ULT) با آلوپورینول یک تعهد مادام‌العمر است و نباید برای هایپراوریسمی ساده بدون علامت تجویز شود. طبق دستورالعمل‌های معتبر روماتولوژی، اندیکاسیون‌های قوی شروع آلوپورینول عبارتند از: بروز ۲ حمله حاد یا بیشتر در سال، وجود حداقل یک توفوس در معاینه بالینی، وجود آسیب استخوانی رادیوگرافیک نقرس، و سابقه سنگ‌های ادراری یا نارسایی کلیه.",
            "lead_en": "Urate-lowering therapy with allopurinol is lifelong and strongly discouraged for asymptomatic hyperuricemia. The ACR guidelines delineate firm indications for initiating allopurinol: presence of subcutaneous tophi, radiographic damage attributable to gout, or frequent clinical flares (≥2 attacks per year).",
            "golden_fa": "اندیکاسیون‌های شروع آلوپورینول در نقرس: وجود توفوس، سنگ کلیه، یا سابقه دو بار و بیشتر حمله در سال.",
            "golden_en": "Indications for allopurinol in gout: tophi, nephrolithiasis, or ≥2 flares per year; asymptomatic hyperuricemia is not treated.",
            "points_fa": [
                "آلوپورینول باید با دوز پایین (۱۰۰ میلی‌گرم در روز یا ۵۰ میلی‌گرم در نارسایی کلیه) شروع شود و تدریجاً تیتر گردد.",
                "هدف درمانی رساندن اسید اوریک سرم به زیر ۶ میلی‌گرم در دسی‌لیتر (یا زیر ۵ در حضور توفوس) است.",
                "کلشی‌سین دوز پایین همزمان به عنوان پروفیلاکسی از عود حملات برای ۳ تا ۶ ماه تجویز می‌شود.",
                "آزمایش غربالگری آلل HLA-B*5801 قبل از شروع آلوپورینول در نژادهای پرخطر جهت پیشگیری از سندرم استیونز-جانسون توصیه می‌شود."
            ],
            "points_en": [
                "Allopurinol should be initiated at low doses (≤100 mg/day, lower in CKD) and titrated upward every 2-4 weeks.",
                "The therapeutic target is a sustained serum urate <6.0 mg/dL (or <5.0 mg/dL in severe tophaceous disease).",
                "Concomitant anti-inflammatory flare prophylaxis with low-dose colchicine is mandatory for 3-6 months.",
                "Screening for the HLA-B*5801 allele prevents life-threatening severe cutaneous adverse reactions in high-risk populations."
            ]
        }
    },
    45: {
        "whys": [
            "نادرست است؛ دلیل رد: بثورات کف دست و پا (کراتودرما بلنوراژیکا) تظاهر پوستی حاد است و پیش‌بینی‌کننده مزمن شدن بیماری نیست.",
            "نادرست است؛ دلیل رد: عفونت‌های گوارشی کامپیلوباکتر معمولاً با سیر خودمحدودشونده‌تری نسبت به عفونت‌های کلامیدیایی همراه هستند.",
            "نادرست است؛ دلیل رد: بالانیت سرسیناتا یک ضایعه مخاطی سطحی بدون درد است و ارتباط مستقیمی با کرونیک شدن آرتریت ندارد.",
            "صحیح است؛ در بیماران مبتلا به آرتریت راکتیو (Reactive Arthritis)، وجود «آنتی‌ژن بافتی HLA-B27 مثبت» قوی‌ترین پیش‌بینی‌کننده ژنتیکی برای «سیر طولانی‌مدت، حملات عودکننده، ایجاد آرتریت مزمن مخرب، درگیری محوری ستون مهره‌ها و ساکروایلییت، و بروز عوارض چشمی شدید» است."
        ],
        "exp": "مثبت بودن HLA-B27 در آرتریت راکتیو قوی‌ترین فاکتور خطر برای سیر مزمن، عودکننده و درگیری محوری ستون مهره‌ها است.",
        "micro": {
            "lead_fa": "اکثر موارد آرتریت راکتیو خودمحدودشونده بوده و ظرف ۳ تا ۶ ماه کاملاً فروکش می‌کنند. با این حال، در حدود ۱۵ تا ۳۰ درصد بیماران بیماری به سمت آرتریت مزمن پیش می‌رود. مهم‌ترین شاخص پیش‌آگهی نامطلوب و مزمن شدن بیماری، مثبت بودن آلل HLA-B27 است. بیماران حامل HLA-B27 در معرض خطر بالای ساکروایلییت مزمن، اسپوندیلیت، آرتریت محیطی مقاوم و یوئیت راجعه هستند.",
            "lead_en": "While the majority of reactive arthritis episodes resolve within 6 months, approximately 20-30% develop chronic or recurrent spondyloarthritis. Possession of the HLA-B27 allele represents the single most potent prognostic risk factor for disease chronicity, recurrent flares, and progressive axial sacroiliitis.",
            "golden_fa": "قوی‌ترین عامل پیش‌بینی‌کننده مزمن شدن آرتریت راکتیو = مثبت بودن آزمایش HLA-B27.",
            "golden_en": "Strongest predictor of chronicity and axial progression in reactive arthritis = HLA-B27 positivity.",
            "points_fa": [
                "بیماران دارای HLA-B27 در صورت عدم پاسخ به NSAIDs کاندیدای داروی سولفاسالازین هستند.",
                "در فرم‌های محوری مزمن مهارکننده‌های TNF-alpha در کنترل بیماری بسیار مؤثرند.",
                "عفونت‌های کلامیدیایی دستگاه ادراری تناسلی شانس مزمن شدن بالاتری نسبت به اسهال باکتریایی دارند.",
                "داکتیلیت و آرتریت مفصل هیپ نیز از نشانه‌های همراه با پیش‌آگهی تهاجمی‌تر هستند."
            ],
            "points_en": [
                "HLA-B27-positive patients with persistent peripheral synovitis benefit from second-line sulfasalazine.",
                "Chronic refractory axial involvement responds dramatically to biologic TNF inhibitors.",
                "Chlamydia-induced reactive arthritis carries a greater propensity for recurrence than enteric forms.",
                "Concomitant dactylitis and hip joint coxitis further herald an aggressive clinical trajectory."
            ]
        }
    },
    46: {
        "whys": [
            "نادرست است؛ دلیل رد: آنتی‌بادی Anti-Ro با لوپوس نوزادی و بلوک قلبی جنین همراه است نه ترومبوزهای شریانی.",
            "صحیح است؛ ترومبوز شریان شبکیه چشم (Central Retinal Artery Occlusion) یک حادثه ترومبوتیک حاد شریانی است؛ در بیماران مبتلا به لوپوس، اتوآنتی‌بادی‌های آنتی‌فسفولیپید به ویژه «Anti-Beta2 Glycoprotein I» (به همراه لوپوس آنتی‌کواگولانت و آنتی‌کاردیولیپین) مستقیماً با فعال‌سازی آبشار انعقادی و اندوتلیوم، عامل ایجاد ترومبوزهای شریانی و وریدی و عوارض بارداری در زمینه «سندرم آنتی‌فسفولیپید ثانویه (Secondary APS)» هستند.",
            "نادرست است؛ دلیل رد: Anti-histone مارکر لوپوس ناشی از دارو است و خاصیت ترومبوژنیک ندارد.",
            "نادرست است؛ دلیل رد: Anti-synthetase مارکر میوزیت و فیبروز ریه است."
        ],
        "exp": "آنتی‌بادی Anti-Beta2 Glycoprotein I از اتوآنتی‌بادی‌های اصلی سندرم آنتی‌فسفولیپید و عامل ترومبوز شریان شبکیه در لوپوس است.",
        "micro": {
            "lead_fa": "سندرم آنتی‌فسفولیپید (APS) در بیماران مبتلا به لوپوس می‌تواند تظاهرات ترومبوتیک فاجعه‌باری هم در بستر وریدی (DVT، آمبولی ریه) و هم شریانی (سکته مغزی، ترومبوز شریان رتین) ایجاد کند. سه آنتی‌بادی معیار تشخیصی عبارتند از: لوپوس آنتی‌کواگولانت، آنتی‌کاردیولیپین و آنتی-بتا-۲ گلیکوپروتئین I. این آنتی‌بادی‌ها به پروتئین‌های متصل‌شونده به فسفولیپید متصل شده و وضعیت پیش‌لخته‌ای شدیدی القا می‌نمایند.",
            "lead_en": "Secondary antiphospholipid syndrome in systemic lupus erythematosus induces recurrent arterial and venous thromboses alongside pregnancy morbidity. Anti-Beta2-glycoprotein I autoantibodies directly target phospholipid-binding plasma proteins, driving platelet aggregation, endothelial activation, and acute arterial occlusions.",
            "golden_fa": "ترومبوز شریانی یا وریدی در باردار لوپوسی = سندرم آنتی‌فسفولیپید؛ آنتی‌بادی عامل: Anti-Beta2 Glycoprotein I.",
            "golden_en": "Arterial or retinal thrombosis in pregnant lupus patient = secondary APS; key antibody: anti-Beta2 glycoprotein I.",
            "points_fa": [
                "انسداد شریان رتین اورژانس بینایی است و نیازمند شروع فوری ضدانعقاد با هپارین با وزن مولکولی پایین است.",
                "در طول بارداری به جای وارفارین (که تراتوژن است) از انوکساپارین به همراه آسپرین استفاده می‌شود.",
                "مثبت بودن هر سه آزمایش آنتی‌فسفولیپید (Triple positivity) بالاترین ریسک ترومبوز را دارد.",
                "هیدروکسی‌کلروکین ریسک ترومبوزهای بعدی را در بیماران لوپوسی دارای aPL به شدت کاهش می‌دهد."
            ],
            "points_en": [
                "Retinal arterial occlusion is an ocular emergency requiring therapeutic anticoagulation with low-molecular-weight heparin.",
                "Warfarin is strictly teratogenic; pregnant APS patients are managed with therapeutic enoxaparin plus low-dose aspirin.",
                "Triple positivity across all three antiphospholipid tests carries the highest cumulative thrombotic risk.",
                "Adjuvant hydroxychloroquine significantly lowers recurrent thrombotic events in lupus patients with aPL."
            ]
        }
    },
    47: {
        "whys": [
            "نادرست است؛ دلیل رد: چرگ اشتراوس (EGPA) واسکولیت عروق کوچک با آسم شدید، ائوزینوفیلی و P-ANCA است و آنوریسم‌های متعدد کلیوی نمی‌دهد.",
            "نادرست است؛ دلیل رد: وگنر با درگیری نکروزان راه‌های هوایی فوقانی و گلومرولونفریت هلال‌دار مشخص می‌شود و آنوریسم شریانی ایجاد نمی‌کند.",
            "صحیح است؛ افزایش فشار خون رنوواسکولار حاد، نارسایی کلیه، مونوپاتی چندگانه محیطی ناشی از انفارکتوس عروق تغذیه‌کننده عصب به صورت افتادگی مچ دست (Wrist Drop / Mononeuritis Multiplex)، و مشاهده بارز «میکروآنوریسم‌های متعدد دانه‌تسبیحی در شریان‌های بین‌لوبولی و کمانی کلیه در آنژیوگرافی»، تابلوی پاتوگنومونیک بیماری «پلی‌آرتریت ندوزا (Polyarteritis Nodosa / PAN)» است که یک واسکولیت نکروزان شریان‌های عضلانی متوسط است.",
            "نادرست است؛ دلیل رد: پورپورای هنوخ واسکولیت IgA عروق کوچک با پورپورای قابل لمس و دردهای شکمی در کودکان است."
        ],
        "exp": "آنوریسم‌های متعدد شریان کلیه در آنژیوگرافی به همراه مونونوریت مالتی‌پلکس (افتادگی مچ دست) و پرفشاری خون، مشخصه پلی‌آرتریت نودوزا است.",
        "micro": {
            "lead_fa": "پلی‌آرتریت ندوزا (PAN) یک واسکولیت نکروزان سیستمیک شریان‌های با اندازه متوسط و کوچک است که به طور کلاسیک نقاط دوشاخه شدن عروق را مبتلا ساخته و میکروآنوریسم‌های متعددی ایجاد می‌کند. سه مشخصه اصلی بالینی: ۱) درگیری کلیه به صورت فشار خون رنوواسکولار و نارسایی ناشی از ایسکمی (بدون گلومرولونفریت)؛ ۲) مونونوریت مالتی‌پلکس (افتادگی مچ دست یا مچ پا)؛ ۳) میکروآنوریسم‌های شریانی در آنژیوگرافی احشایی. ارتباط قوی با هپاتیت B دارد.",
            "lead_en": "Polyarteritis nodosa (PAN) is a necrotizing systemic vasculitis targeting medium-sized muscular arteries. Key hallmarks include renovascular hypertension and renal failure without capillaritis, mononeuritis multiplex (wrist drop), and characteristic microaneurysms on visceral angiography, often linked to hepatitis B.",
            "golden_fa": "فشار خون بالا + افتادگی مچ دست (مونونوریت مالتی‌پلکس) + میکروآنوریسم در آنژیوگرافی کلیه = پلی‌آرتریت نودوزا (PAN).",
            "golden_en": "Hypertension + wrist drop (mononeuritis multiplex) + renal aneurysms on angiography = polyarteritis nodosa.",
            "points_fa": [
                "گلومرول‌های کلیه و مویرگ‌های ریه در پلی‌آرتریت ندوزا کلاسیک سالم می‌مانند.",
                "تست‌های ANCA در پلی‌آرتریت ندوزا کلاسیک منفی هستند.",
                "در موارد غیرمرتبط با HBV، درمان شامل گلوکوکورتیکوئیدهای دوز بالا همراه با سیکلوفسفامید است.",
                "در موارد همراه با هپاتیت B، درمان بر داروهای ضدویروس و پلاسمافرز با دوره کوتاه استروئید استوار است."
            ],
            "points_en": [
                "Glomerular capillaries and the pulmonary circulation are characteristically strictly spared in classic PAN.",
                "Classical polyarteritis nodosa is ANCA-negative, distinguishing it from microscopic polyangiitis.",
                "Non-viral PAN requires aggressive immunosuppression with high-dose corticosteroids and cyclophosphamide.",
                "HBV-associated PAN is treated with antiviral therapy and plasma exchange, avoiding long-term immunosuppression."
            ]
        }
    },
    48: {
        "whys": [
            "نادرست است؛ دلیل رد: بوسنتان برای هایپرتانسیون شریان ریوی و پیشگیری از زخم انگشتان است و نقشی در درمان کریز کلیوی ندارد.",
            "نادرست است؛ دلیل رد: بتابلوکرها (متوپرولول) با تشدید وازوکانستریکشن محیطی رینود و مهار رنین منع مصرف دارند.",
            "نادرست است؛ دلیل رد: پرازوسین داروی آلفابلوکر است و توانایی مهار سیستم رنین-آنژیوتانسین را ندارد.",
            "صحیح است؛ بروز پرفشاری خون بدخیم ناگهانی (۱۹۰/۱۱۰)، سردرد، نارسایی حاد کلیه (افزایش کراتینین)، آنمی همولیتیک میکروآنژیوپاتیک و ترومبوسیتوپنی در بیمار مبتلا به اسکلرودرمی، اورژانس مرگ‌بار «بحران کلیوی اسکلرودرمی (Scleroderma Renal Crisis / SRC)» ناشی از هایپررنینمی شدید است؛ داروی انتخابی، قطعی و نجات‌بخش حیات، تجویز فوری «کاپتوپریل (Captopril)» و مهارکننده‌های ACE با دوز تیترشده است که با مهار سیستم رنین جان بیمار و عملکرد کلیه را نجات می‌دهد."
        ],
        "exp": "کاپتوپریل و مهارکننده‌های ACE داروی انتخابی و نجات‌بخش در درمان بحران کلیوی اسکلرودرمی (SRC) هستند.",
        "micro": {
            "lead_fa": "بحران کلیوی اسکلرودرمی (SRC) خطرناک‌ترین عارضه اسکلروز سیستمیک منتشر است که در اثر ایسکمی کلیه و فعال‌سازی انفجاری سیستم رنین-آنژیوتانسین-آلدوسترون رخ می‌دهد. قبل از کشف مهارکننده‌های ACE، این عارضه تقریباً در ۱۰۰ درصد موارد کشنده بود. داروی کاپتوپریل خوراکی کوتاه‌اثر داروی استاندارد طلایی است که با دوزهای فزاینده تا کنترل فشار خون و تثبیت کراتینین تیتر می‌شود.",
            "lead_en": "Scleroderma renal crisis (SRC) is a hyper-reninemic hypertensive emergency causing microangiopathic hemolytic anemia and acute kidney injury. ACE inhibitors, specifically short-acting oral captopril, are life-saving first-line therapy, reversing renal vasoconstriction and dramatically reducing mortality.",
            "golden_fa": "بحران کلیوی اسکلرودرمی (فشار خون بالا + نارسایی کلیه) = تجویز فوری کاپتوپریل (مهارکننده ACE).",
            "golden_en": "Scleroderma renal crisis (malignant hypertension + acute renal failure) = immediate captopril (ACE inhibitor).",
            "points_fa": [
                "مصرف پردنیزولون با دوز بیش از ۱۵ میلی‌گرم در روز از مهم‌ترین فاکتورهای خطر القاکننده کریز کلیوی است.",
                "کاپتوپریل به دلیل نیمه‌عمر کوتاه و قابلیت تیتراسیون سریع ساعتی نسبت به سایر مهارکننده‌های ACE ترجیح داده می‌شود.",
                "حتی در صورت افزایش موقت کراتینین در روزهای اول، کاپتوپریل نباید قطع گردد.",
                "در صورت عدم کنترل فشار با کاپتوپریل، مسدودکننده‌های کانال کلسیم یا ایلوپروست اضافه می‌شوند."
            ],
            "points_en": [
                "Glucocorticoid exposure exceeding 15 mg/day prednisone is a prominent iatrogenic trigger precipitating SRC.",
                "Captopril is uniquely preferred over long-acting ACE inhibitors due to rapid absorption and hourly titration flexibility.",
                "Mild transient elevations in serum creatinine upon initiating captopril should not prompt discontinuation.",
                "Add-on agents for resistant hypertension include dihydropyridine calcium channel blockers or IV prostacyclins."
            ]
        }
    },
    49: {
        "whys": [
            "نادرست است؛ دلیل رد: کورتیکواستروئید خوراکی در حضور احتمال بالای سپسیس حاد مفصلی خطر انتشار سیستمیک عفونت را به همراه دارد.",
            "نادرست است؛ دلیل رد: تزریق کورتون به داخل مفصل مشکوک به سپسیس حتی با اسمیر منفی ممنوعیت مطلق دارد، زیرا باکتری‌ها را تکثیر و مفصل را منهدم می‌کند.",
            "نادرست است؛ دلیل رد: مسکن‌های ساده یا NSAID بدون آنتی‌بیوتیک در برخورد با عفونت باکتریایی منجر به تأخیر درمانی و نابودی غضروف مفصل می‌شوند.",
            "صحیح است؛ در هر بیمار مبتلا به آرتریت روماتوئید که مفاصل دیگر در خاموشی کامل هستند و ناگهان دچار مونوآرتریت حاد، داغ، قرمز و بسیار دردناک در یک مفصل تک (مچ دست) می‌شود، شک اولیه «آرتریت سپتیک باکتریایی» است؛ رنگ‌آمیزی گرم مایع سینوویال در ۳۰ تا ۵۰ درصد موارد عفونت باکتریایی منفی کاذب است؛ بنابراین منفی بودن اسمیر هرگز آرتریت سپسیس را رد نمی‌کند و شروع فوری «آنتی‌بیوتیک مناسب وریدی» تا زمان آماده شدن نتیجه قطعی کشت الزامی است."
        ],
        "exp": "منفی بودن اسمیر مستقیم رنگ‌آمیزی گرم هرگز آرتریت سپتیک را رد نمی‌کند و شروع فوری آنتی‌بیوتیک وریدی در مونوآرتریت حاد الزامی است.",
        "micro": {
            "lead_fa": "حساسیت رنگ‌آمیزی گرم مایع سینوویال در آرتریت‌های باکتریایی حدود ۵۰ تا ۷۰ درصد است؛ به این معنی که در بیش از یک‌سوم بیماران مبتلا به آرتریت سپسیس اثبات‌شده، اسمیر اولیه مایع هیچ باکتری را نشان نمی‌دهد. در بیماری با سابقه RA تحت درمان سرکوب ایمنی که با مونوآرتریت داغ و قرمز مراجعه می‌کند، منفی بودن اسمیر هرگز نباید موجب احساس امنیت کاذب شود. درمان ضدمیکروبی وریدی تجربی بلافاصله آغاز شده و تا رد قطعی کشت ادامه می‌یابد.",
            "lead_en": "Synovial fluid Gram stain sensitivity in septic arthritis ranges from 50% to 70%; therefore, a negative smear never excludes active bacterial joint infection. In an immunosuppressed RA patient presenting with acute hot monoarthritis, negative Gram stain mandates immediate continuation of empiric intravenous bactericidal antibiotic therapy awaiting definitive cultures.",
            "golden_fa": "مونوآرتریت حاد گرم در بیمار روماتوئید = شک به سپسیس؛ منفی بودن اسمیر باکتری را رد نمی‌کند، آنتی‌بیوتیک وریدی الزامی است.",
            "golden_en": "Acute hot monoarthritis in RA = suspect sepsis; negative Gram stain does not rule out infection, prompt IV antibiotics required.",
            "points_fa": [
                "تزریق موضعی کورتیکواستروئید تا آماده شدن نتیجه منفی کشت مایع مفصل اکیداً ممنوع است.",
                "پوشش آنتی‌بیوتیکی تجربی استافیلوکوک اورئوس و ارگانیسم‌های شایع را پوشش می‌دهد.",
                "کشت مایع مفصلی در ۹۰ درصد موارد عفونت‌های غیرگونوکوکی ارگانیسم را مشخص می‌سازد.",
                "تخلیه مکرر مایع چرکی با آسپیراسیون سوزنی جهت کاهش تخریب غضروف حیاتی است."
            ],
            "points_en": [
                "Intra-articular steroid instillation is absolutely contraindicated until negative cultures definitively rule out sepsis.",
                "Empiric intravenous antibiotic regimens must aggressively target Staphylococcus aureus.",
                "Synovial fluid culture is positive in >90% of non-gonococcal bacterial joint infections.",
                "Serial closed-needle joint evacuations are required to decompress the joint and eliminate damaging enzymes."
            ]
        }
    },
    50: {
        "whys": [
            "نادرست است؛ دلیل رد: اسپلنومگالی بخشی از تریاد پاتوگنومونیک سندرم فلتی (آرتریت روماتوئید + اسپلنومگالی + نوتروپنی) در RA مزمن است.",
            "نادرست است؛ دلیل رد: نوتروپنی جزء تعریف سندرم فلتی در آرتریت روماتوئید طول‌کشیده و شدید است.",
            "نادرست است؛ دلیل رد: پارستزی دست‌ها در آرتریت روماتوئید شایع بوده و ناشی از تنوسینوویت و سندرم تونل کارپال یا واسکولیت محیطی است.",
            "صحیح است (موردی که با آرتریت روماتوئید قابل توجیه نیست)؛ بیماری «آرتریت روماتوئید (RA)» مفاصل دیارترودیال محیطی را درگیر می‌کند و به طور کلاسیک و اکید «ستون فقرات کمری (Lumbar Spine) و مفاصل ساکروایلیاک را سالم می‌گذارد» (تنها ناحیه درگیر ستون فقرات در RA مفصل آتلانتواگزیال گردن است)؛ بنابراین وجود «کمردرد» با بیماری آرتریت روماتوئید قابل توجیه نیست و ناشی از علل دیگر نظیر فتق دیسک، استئوآرتریت یا شکستگی مهره است."
        ],
        "exp": "آرتریت روماتوئید ستون فقرات کمری را درگیر نمی‌کند؛ بنابراین کمردرد با RA قابل توجیه نبوده و باید علت دیگری را جستجو کرد.",
        "micro": {
            "lead_fa": "آرتریت روماتوئید ستون فقرات توراسیک و کمری را درگیر نمی‌سازد؛ تنها بخش محوری گرفتار در RA، ستون فقرات گردنی و به ویژه مفصل آتلانتواگزیال (C1-C2) است که پانووس می‌تواند با تخریب لیگامان ترانسورس سابلوکساسیون آتلانتواگزیال ایجاد کند. در مقابل، تریاد سندرم فلتی (Felty's syndrome) شامل RA سرم‌مثبت مزمن، اسپلنومگالی و نوتروپنی شدید است. پارستزی دست نیز عارضه سندرم تونل کارپال ثانویه به سینوویت مچ است.",
            "lead_en": "Rheumatoid arthritis strictly spares the thoracolumbar spine and sacroiliac joints; the only axial structure targeted is the cervical spine (atlantoaxial subluxation at C1-C2). In contrast, Felty syndrome encompasses seropositive RA, splenomegaly, and neutropenia, while hand paresthesias reflect secondary carpal tunnel syndrome.",
            "golden_fa": "آرتریت روماتوئید ستون فقرات کمری را درگیر نمی‌کند؛ کمردرد با RA قابل توجیه نیست و علت دیگری دارد.",
            "golden_en": "Rheumatoid arthritis spares the lumbar spine; low back pain cannot be attributed to RA and implies an alternative etiology.",
            "points_fa": [
                "درگیری ستون فقرات گردنی (C1-C2) در RA نیازمند گرافی فلکسیون-اکستنشن جهت ارزیابی ثبات نخاع است.",
                "سندرم فلتی با خطر بالای عفونت‌های مکرر باکتریایی و زخم‌های پا همراه است.",
                "درمان سندرم فلتی شامل کنترل فعال RA با متوترکسات و در موارد نوتروپنی شدید فاکتور G-CSF است.",
                "کمردرد در بیمار روماتوئیدی نیازمند بررسی از نظر شکستگی فشاری ناشی از پوکی استخوان با کورتون است."
            ],
            "points_en": [
                "Cervical spine involvement warrants flexion-extension radiography to detect potentially catastrophic atlantoaxial subluxation.",
                "Felty syndrome predisposes patients to severe recurrent pyogenic bacterial infections and lower-extremity skin ulcers.",
                "Felty syndrome management combines aggressive DMARD therapy (methotrexate) with G-CSF for severe neutropenia.",
                "Lumbar back pain in chronic RA suggests osteoporotic vertebral compression fracture secondary to glucocorticoids."
            ]
        }
    },
    51: {
        "whys": [
            "نادرست است؛ دلیل رد: با در نظر گرفتن شرط درگیری ۲ مفصل برای آرتریت، بیمار ۴ معیار دارد نه ۵ معیار.",
            "صحیح است؛ بر اساس معیارهای تشخیصی و طبقه‌بندی رسمی ACR 1987 برای لوپوس، این بیمار دقیقاً «۴ معیار تشخیصی» دارد: ۱) زخم‌های دهانی بدون درد (معیار مخاطی)؛ ۲) ترومبوسیتوپنی با پلاکت ۷۰٬۰۰۰ کمتر از ۱۰۰٬۰۰۰ (معیار خونی)؛ ۳) مثبت بودن آنتی‌بادی Anti-Sm (معیار ایمونولوژیک)؛ ۴) مثبت بودن ANA (معیار آنتی‌بادی ضد هسته)؛ نکته بسیار مهم آزمونی این است که «آرتریت مچ دست» معیار آرتریت ACR را پر نمی‌کند، زیرا معیار آرتریت در ACR صراحتاً نیازمند درگیری «حداقل دو یا چند مفصل محیطی (≥ 2 peripheral joints)» است و درگیری یک مفصل تک مچ دست به عنوان معیار آرتریت شمرده نمی‌شود.",
            "نادرست است؛ دلیل رد: هر چهار مورد زخم دهان، ترومبوسیتوپنی، Anti-Sm و ANA معیارهای مستقل و معتبر هستند.",
            "نادرست است؛ دلیل رد: بیمار ۶ معیار ندارد."
        ],
        "exp": "بیمار دارای ۴ معیار است: زخم دهان، ترومبوسیتوپنی، Anti-Sm و ANA؛ آرتریت به دلیل درگیری تنها ۱ مفصل (مچ) شمرده نمی‌شود.",
        "micro": {
            "lead_fa": "معیارهای طبقه‌بندی ۱۱ گانه ACR 1997 برای SLE نیازمند حداقل ۴ معیار هستند. دقت به تعریف دقیق هر معیار در آزمون بسیار سرنوشت‌ساز است: معیار آرتریت لوپوس بر اساس تعریف دقیق ACR عبارت است از: «آرتریت غیراروزیو در دو یا چند مفصل محیطی همراه با تندرنس، تورم یا افیوژن». بنابراین درگیری ایزوله یک مفصل تک (تنها مچ دست) معیار آرتریت را محقق نمی‌سازد. چهار معیار این بیمار: زخم دهان، ترومبوسیتوپنی، Anti-Sm مثبت و ANA مثبت است.",
            "lead_en": "Under the 1997 ACR criteria for SLE, classification requires at least 4 of 11 criteria. Crucially, the arthritis criterion specifically mandates non-erosive involvement of TWO or more peripheral joints. Solitary wrist synovitis fails this threshold, leaving the patient with exactly 4 criteria: oral ulcers, thrombocytopenia, anti-Sm positivity, and ANA positivity.",
            "golden_fa": "معیار آرتریت ACR در لوپوس نیازمند حداقل ۲ مفصل محیطی است؛ درگیری تک‌مفصلی مچ دست معیار آرتریت شمرده نمی‌شود.",
            "golden_en": "The ACR arthritis criterion in SLE strictly mandates ≥2 peripheral joints; single wrist involvement does not count.",
            "points_fa": [
                "تعداد ۴ معیار برای طبقه‌بندی قطعی لوپوس اریتماتوی سیستمیک در این بیمار کفایت می‌کند.",
                "آنتی‌بادی Anti-Sm اختصاصی‌ترین مارکر سرولوژیک بیماری لوپوس است.",
                "ترومبوسیتوپنی کمتر از ۱۰۰٬۰۰۰ در غیاب علل دارویی معیار هماتولوژیک رسمی است.",
                "در کرایتریای جدیدتر SLICC 2012 حتی سینوویت یک مفصل با خشکی صبحگاهی قابل قبول است."
            ],
            "points_en": [
                "Achieving 4 documented criteria fully satisfies the validated threshold for SLE classification.",
                "Anti-Smith (anti-Sm) autoantibodies exhibit nearly 99% diagnostic specificity for SLE.",
                "Thrombocytopenia <100,000/μL in the absence of offending pharmacotherapy satisfies the hematologic criterion.",
                "The subsequent SLICC 2012 criteria relaxed the joint requirement to include single-joint synovitis with stiffness."
            ]
        }
    },
    52: {
        "whys": [
            "نادرست است؛ دلیل رد: تاندون ترس مینور در چرخش خارجی نقش دارد و تست دراپ‌آرم برای این تاندون نیست.",
            "نادرست است؛ دلیل رد: تاندونیت ساده سوپرااسپیناتوس با قوس دردناک مشخص می‌شود و تست دراپ‌آرم در آن منفی است.",
            "نادرست است؛ دلیل رد: تاندونیت بای‌سپس با تست‌های یرگاسون و اسپید ارزیابی می‌شود.",
            "صحیح است؛ در یک خانم سالمند با سابقه ترومای شانه، مثبت شدن «تست افتادن دست (Drop Arm Test)» - که در آن بیمار قادر نیست بازوی خود را پس از بالا بردن غیرفعال در زاویه ۹۰ درجه ابداکسیون نگه دارد و دست به علت فقدان کنترل تاندونی ناگهان سقوط می‌کند - پاتوگنومونیک «پارگی کامل تاندون‌های روتاتور کاف (به‌ویژه تاندون سوپرااسپیناتوس / Full-Thickness Rotator Cuff Tear)» است."
        ],
        "exp": "مثبت شدن تست دراپ‌آرم (Drop Arm Test) نشانه پاتوگنومونیک پارگی کامل تاندون روتاتور کاف (سوپرااسپیناتوس) است.",
        "micro": {
            "lead_fa": "تست افتادن دست (Drop Arm Test) مانور بالینی پاتوگنومونیک برای پارگی وسیع یا کامل تاندون سوپرااسپیناتوس روتاتور کاف است. پزشک بازوی بیمار را به صورت غیرفعال تا ۹۰ درجه ابداکسیون بالا می‌آورد و از او می‌خواهد که دست را به آرامی به پایین هدایت کند؛ در صورت پارگی کامل، بیمار توانایی کنترل برون‌گرای عضله را نداشته و بازو ناگهان سقوط می‌کند. ام‌آر‌آی شانه روش انتخابی برای اثبات اندازه پارگی و پس‌کشیدگی تاندون است.",
            "lead_en": "The drop arm test specifically identifies full-thickness tears of the rotator cuff, predominantly involving the supraspinatus tendon. The examiner passively abducts the patient's arm to 90 degrees and asks them to lower it slowly; failure to sustain controlled eccentric descent resulting in a sudden drop confirms a massive tendon tear.",
            "golden_fa": "ترومای شانه در سالمند + تست Drop Arm مثبت = پارگی کامل تاندون روتاتور کاف (سوپرااسپیناتوس).",
            "golden_en": "Shoulder trauma in elderly + positive drop arm test = full-thickness rotator cuff tear.",
            "points_fa": [
                "تاندون سوپرااسپیناتوس شایع‌ترین جزء پاره‌شده در مجموعه عضلات روتاتور کاف است.",
                "در پارگی حاد تاندون در افراد فعال، ترمیم جراحی آرتروسکوپیک زودهنگام توصیه می‌شود.",
                "در افراد مسن با تقاضای عملکردی پایین، فیزیوتراپی تقویتی دلتوئید و NSAIDs رویکرد اول است.",
                "ام‌آر‌آی یا سونوگرافی دینامیک شانه ضایعه را با دقت عالی تأیید می‌نمایند."
            ],
            "points_en": [
                "The supraspinatus tendon is the most frequently ruptured structure within the rotator cuff envelope.",
                "Acute traumatic full-thickness tears in active patients warrant early arthroscopic surgical repair.",
                "Elderly sedentary patients may be managed conservatively with deltoid strengthening and physical therapy.",
                "Non-contrast shoulder MRI or dynamic ultrasound establishes tear dimensions and muscle fatty infiltration."
            ]
        }
    },
    53: {
        "whys": [
            "صحیح است؛ داروی «هیدروکسی‌کلروکین (Hydroxychloroquine / HCQ)» سنگ‌بنای اساسی، اجباری و بدون جایگزین درمان در تمام بیماران مبتلا به لوپوس اریتماتوی سیستمیک است؛ هیدروکسی‌کلروکین علاوه بر کنترل علائم مفصلی، ضایعات پوستی و خستگی، بقای کلی بیماران را به طور معناداری افزایش داده و از آسیب ارگان‌های حیاتی و بروز شعله‌وری‌های آینده پیشگیری می‌کند و باید بلافاصله شروع شود.",
            "نادرست است؛ دلیل رد: متوترکسات داروی خط دوم است و در غیاب هیدروکسی‌کلروکین به عنوان داروی پایه لوپوس تجویز نمی‌شود.",
            "نادرست است؛ دلیل رد: پالس سیکلوفسفامید فقط در درگیری‌های شدید تهدیدکننده حیات نظیر نفریت پرولیفراتیو کلاس ۳ و ۴ یا درگیری شدید CNS کاربرد دارد.",
            "نادرست است؛ دلیل رد: آزاتیوپرین برای درگیری‌های احشایی متوسط تا شدید یا به عنوان نگهدارنده پس از سیکلوفسفامید استفاده می‌شود."
        ],
        "exp": "هیدروکسی‌کلروکین داروی پایه‌ای و سنگ‌بنای درمان در تمام بیماران لوپوسی برای کنترل علائم پوستی-مفصلی و افزایش بقا است.",
        "micro": {
            "lead_fa": "هیدروکسی‌کلروکین (داروی ضد مالاریا) سنگ‌بنای درمانی لوپوس است. تمام بیماران مبتلا به SLE، مگر در صورت وجود منع مصرف قطعی، باید تحت درمان دائمی با هیدروکسی‌کلروکین (دوز حداکثر ۵ میلی‌گرم به ازای هر کیلوگرم وزن واقعی بدن روزانه) قرار گیرند. این دارو ضایعات پوستی و آرتریت را مهار کرده، خطر ترومبوز را کاسته، پروفایل لیپید را بهبود بخشیده و میزان مرگ‌ومیر کلی را به شدت کاهش می‌دهد.",
            "lead_en": "Hydroxychloroquine is the indispensable foundational therapy for all patients diagnosed with systemic lupus erythematosus, unless strictly contraindicated. It treats cutaneous and articular manifestations, decreases flare frequency, imparts antithrombotic protection, and definitively improves long-term survival.",
            "golden_fa": "داروی اصلی و پایه‌ای برای تمام بیماران لوپوسی = هیدروکسی‌کلروکین (Hydroxychloroquine).",
            "golden_en": "Foundational, mandatory therapy for all SLE patients = hydroxychloroquine.",
            "points_fa": [
                "دوز نگهدارنده هیدروکسی‌کلروکین حداکثر ۵ میلی‌گرم به ازای کیلوگرم وزن واقعی برای پیشگیری از سمیت شبکیه است.",
                "معاینه بینایی‌سنجی پایه و غربالگری سالیانه فوندوسکوپی و میدان بینایی پس از ۵ سال الزامی است.",
                "پردنیزولون با دوز پایین به عنوان پل درمانی کوتاه‌مدت تا زمان اثربخشی هیدروکسی‌کلروکین تجویز می‌شود.",
                "قطع خودسرانه هیدروکسی‌کلروکین شایع‌ترین عامل عود شدید بیماری در بیماران لوپوسی است."
            ],
            "points_en": [
                "The daily maintenance dose of hydroxychloroquine should not exceed 5.0 mg/kg actual body weight to prevent retinotoxicity.",
                "Baseline ophthalmologic screening and annual automated visual field assessments are mandated after 5 years of exposure.",
                "Low-dose oral prednisone serves as a transient bridge awaiting hydroxychloroquine therapeutic onset (2-3 months).",
                "Non-compliance or premature discontinuation of hydroxychloroquine triggers severe systemic disease relapses."
            ]
        }
    },
    54: {
        "whys": [
            "نادرست است؛ دلیل رد: گلومرولونفریت عارضه واسکولیت‌های عروق کوچک (ANCA) است و در آرتریت تمپورال که عروق بزرگ را مبتلا می‌سازد دیده نمی‌شود.",
            "نادرست است؛ دلیل رد: آلوئولیت ریوی مربوط به بیماری‌های بینابینی و واسکولیت‌های عروق کوچک است.",
            "صحیح است؛ در یک خانم ۶۵ ساله با سردرد جدید تمپورال، لمس نشدن یا تندرنس نبض شریان تمپورال، ESR سه رقمی (ESR=100) و آنمی بیماری مزمن، تشخیص قطعی «آرتریت سلول غول‌آسا (آرتریت تمپورال / GCA)» است؛ شایع‌ترین، مخرب‌ترین و خطرناک‌ترین عارضه بیماری «نابینایی ناگهانی و دائمی یک‌طرفه یا دوطرفه (Irreversible Blindness)» ناشی از نوروپاتی ایسکمیک قدامی عصب بینایی (AION) است که یک اورژانس واقعی پزشکی تلقی می‌شود.",
            "نادرست است؛ دلیل رد: افتادگی مچ دست ناشی از مونونوریت مالتی‌پلکس در واسکولیت‌های عروق متوسط نظیر PAN است."
        ],
        "exp": "مهم‌ترین و خطرناک‌ترین عارضه آرتریت تمپورال (سلول غول‌آسا)، کوری ناگهانی و دائمی ناشی از نوروپاتی ایسکمیک عصب بینایی است.",
        "micro": {
            "lead_fa": "آرتریت سلول غول‌آسا (تمپورال) شایع‌ترین واسکولیت سیستمیک در افراد بالای ۵۰ سال است که شاخه‌های شریان کاروتید خارجی و شریان‌های مژگانی خلفی چشم را درگیر می‌سازد. مهم‌ترین عارضه تهدیدکننده، ایسکمی شریان‌های تامین‌کننده عصب بینایی و بروز کوری ناگهانی، بدون درد و غیرقابل بازگشت (AION) است. به محض شک بالینی، درمان فوری با کورتیکواستروئید دوز بالا (پردنیزولون ۶۰ میلی‌گرم روزانه) باید فوراً پیش از بیوپسی آغاز گردد.",
            "lead_en": "Giant cell arteritis (temporal arteritis) is a large-vessel vasculitis targeting extracranial branches of the carotid artery in patients >50 years. Anterior ischemic optic neuropathy (AION) is the most feared, irreversible complication causing sudden permanent blindness, demanding immediate high-dose systemic corticosteroid therapy prior to biopsy confirmation.",
            "golden_fa": "سردرد تمپورال در سالمند با ESR=100 = آرتریت تمپورال؛ خطرناک‌ترین عارضه: نابینایی ناگهانی و دائمی.",
            "golden_en": "Temporal headache in elderly with ESR=100 = giant cell arteritis; most feared complication: permanent blindness.",
            "points_fa": [
                "شروع کورتیکواستروئید دوز بالا نباید حتی برای یک ساعت منتظر انجام بیوپسی شریان تمپورال بماند.",
                "بیوپسی شریان تمپورال با طول حداقل ۲ تا ۳ سانتی‌متر استاندارد طلایی تشخیصی است.",
                "لنگش فک (Jaw claudication) اختصاصی‌ترین علامت بالینی در شرح حال آرتریت تمپورال است.",
                "توسیلیزوماب (آنتی‌بادی ضد گیرنده IL-6) درمان کمکی تأییدشده برای کاهش وابستگی به استروئید است."
            ],
            "points_en": [
                "High-dose corticosteroid therapy must be administered immediately upon suspicion, never delayed for temporal artery biopsy.",
                "Temporal artery biopsy (segment length ≥2-3 cm) represents the histopathological diagnostic gold standard.",
                "Jaw claudication during mastication is the single most specific clinical symptom of cranial ischemia.",
                "Tocilizumab (IL-6 receptor antagonist) is an established FDA-approved steroid-sparing agent in GCA."
            ]
        }
    },
    55: {
        "whys": [
            "نادرست است؛ دلیل رد: چرخش خارجی در مراحل دیررس‌تر آرتروز هیپ محدود می‌شود.",
            "صحیح است؛ در بیماری استئوآرتریت مفصل ران (Hip Osteoarthritis / کوکس‌آرتروز)، «چرخش داخلی مفصل هیپ (Internal Rotation)» حساس‌ترین، زودهنگام‌ترین و نخستین حرکتی است که دچار درد و محدودیت دامنه حرکتی می‌شود؛ در معاینه فیزیکی، بروز درد یا کاهش زاویه چرخش داخلی هیپ در وضعیت فلکشن ۹۰ درجه، کلید طلایی کشف زودهنگام آسیب غضروفی مفصل ران است.",
            "نادرست است؛ دلیل رد: فلکسیون مفصل هیپ معمولاً تا مراحل متوسط تا پیشرفته بیماری حفظ می‌شود.",
            "نادرست است؛ دلیل رد: اکستنشن مفصل هیپ در مراحل دیررس با کنتراکچر فلکشن محدود می‌گردد."
        ],
        "exp": "محدودیت و درد در چرخش داخلی (Internal Rotation) زودهنگام‌ترین و حساس‌ترین یافته بالینی در استئوآرتریت هیپ است.",
        "micro": {
            "lead_fa": "استئوآرتریت مفصل ران (هیپ) با درد عمقی در ناحیه کشاله ران (Groin) که به قدام ران و زانو تیر می‌کشد تظاهر می‌کند. در معاینه فیزیکی سیستم اسکلتی-عضلانی، اولین و حساس‌ترین نشانه بالینی از دست رفتن و محدودیت چرخش داخلی (Internal rotation) همراه با درد است. مانور FABER (فلکسیون، ابداکسیون، چرخش خارجی) نیز پاتولوژی مفصل را بازتولید می‌کند. با پیشرفت بیماری، ابداکسیون و فلکسیون نیز محدود می‌شوند.",
            "lead_en": "Hip osteoarthritis classically presents with deep groin pain radiating into the anterior thigh or knee. On physical examination, restricted and painful internal rotation represents the earliest and most sensitive objective clinical sign of coxarthrosis, preceding impairment in flexion or external rotation.",
            "golden_fa": "اولین و حساس‌ترین علامت در معاینه فیزیکی استئوآرتریت مفصل هیپ = محدودیت چرخش داخلی (Internal rotation).",
            "golden_en": "Earliest and most sensitive physical examination sign of hip osteoarthritis = restricted internal rotation.",
            "points_fa": [
                "درد مفصل هیپ به کشاله ران ارجاع می‌شود نه قسمت خارجی ران (درد لترال ران مربوط به تروکانتر است).",
                "لنگش آنتالژیک و علامت ترندلنبرگ در آرتروز پیشرفته به علت ضعف گلوتئوس مدیوس دیده می‌شود.",
                "رادیوگرافی ساده لگن باریک شدن بالای فضای مفصلی، اسکلروز و استئوفیت‌ها را نشان می‌دهد.",
                "در موارد ناتوانی شدید حرکتی مقاوم به درمان دارویی، تعویض کامل مفصل هیپ (THR) درمان قطعی است."
            ],
            "points_en": [
                "True hip intra-articular pathology radiates into the groin; lateral hip pain reflects trochanteric bursitis.",
                "Antalgic gait and a positive Trendelenburg sign develop due to secondary gluteal muscular insufficiency.",
                "Pelvic radiography reveals superior joint space narrowing, subchondral sclerosis, and acetabular osteophytes.",
                "Total hip arthroplasty provides definitive, restorative outcomes in advanced, pharmacologically refractory disease."
            ]
        }
    },
    56: {
        "whys": [
            "صحیح است؛ لمس یک فرورفتگی یا پله در خط وسط مهره‌های کمری در معاینه فیزیکی بالینی «علامت پله (Step-off Sign)»، پاتوگنومونیک بیماری «اسپوندیلولیستزیس (Spondylolisthesis / لغزش مهره)» است که در آن یک تنه مهره (معمولاً L4 بر روی L5 یا L5 بر روی S1) به علت نقص در پارس اینترآرتیکولاریس یا تغییرات دژنراتیو فاست‌ها بر روی مهره پایینی به سمت جلو سر می‌خورد و لبه مهره بالایی زیر دست به صورت یک پله لمس می‌شود.",
            "نادرست است؛ دلیل رد: دیسکوپاتی و فتق دیسک توده یا تغییر شکل پله‌ای در لمس مهره‌ها ایجاد نمی‌کند.",
            "نادرست است؛ دلیل رد: کمردرد وضعیتی ساده ناهنجاری ساختاری پله‌ای در معاینه فیزیکی استخوان ندارد.",
            "نادرست است؛ دلیل رد: تنگی کانال نخاعی (Canal Stenosis) با لنگش نوروژنیک مشخص می‌شود و علامت پله در معاینه لمسی ندارد مگر اینکه ناشی از لیزتزیس باشد."
        ],
        "exp": "لمس پله در خط وسط ستون فقرات کمری (Step-off sign) نشانه پاتوگنومونیک لغزش مهره (اسپوندیلولیستزیس) است.",
        "micro": {
            "lead_fa": "اسپوندیلولیستزیس به لغزش و جابجایی قدامی یک تنه مهره بر روی مهره زیرین اطلاق می‌شود که دو نوع شایع دارد: اسپوندیلولیتیک (ناشی از شکستگی استرسی یا نقص مادرزادی پارس اینترآرتیکولاریس / اسپوندیلولیزیس) و دژنراتیو (ناشی از آرتروز مفاصل فاست در افراد مسن). علامت شاخص در معاینه لمس عمقی زائده‌های خاری، حس کردن یک فرورفتگی ناگهانی پله‌مانند (Step-off deformity) در خط وسط کمر است.",
            "lead_en": "Spondylolisthesis defines the anterior displacement of a superior vertebral body relative to the subjacent vertebra, arising from spondylolysis (pars interarticularis defect) or facet joint degeneration. The tactile detection of a midline 'step-off' deformity upon deep paraspinal palpation is clinically pathognomonic.",
            "golden_fa": "کمردرد دوطرفه + لمس برجستگی پله‌مانند در خط وسط مهره‌های کمری (Step sign) = اسپوندیلولیستزیس.",
            "golden_en": "Bilateral back pain + palpable midline vertebral step-off = spondylolisthesis.",
            "points_fa": [
                "رادیوگرافی ساده لترال ستون فقرات کمری روش استاندارد تعیین درجه لغزش (درجه ۱ تا ۴ مایردینگ) است.",
                "گرافی مایل کمری نمای سگ اسکاتلندی با قلاده شکسته (Scotty dog sign) را در اسپوندیلولیزیس نشان می‌دهد.",
                "تنگی کانال نخاعی و لنگش متناوب عصبی از عوارض ثانویه شایع اسپوندیلولیستزیس دژنراتیو است.",
                "درمان شامل فیزیوتراپی تقویتی فلکسورهای تنه و عضلات شکم و در موارد ناپایدار جراحی فیوژن مهره‌ها است."
            ],
            "points_en": [
                "Standing lateral lumbar radiography quantitatively grades vertebral slip percentage (Meyerding grades I-IV).",
                "Oblique lumbar views reveal the classic fractured-collar 'Scotty dog' sign denoting a pars defect.",
                "Secondary neurogenic claudication and spinal canal stenosis frequently complicate degenerative slips.",
                "Management focuses on core abdominal stabilization exercises, reserving spinal fusion for unstable progressive slips."
            ]
        }
    },
    57: {
        "whys": [
            "نادرست است؛ دلیل رد: آرتریت سپتیک با تب بالا، اریتم حاد و ESR/CRP به شدت بالا تظاهر می‌کند نه مارکرهای کاملاً نرمال.",
            "صحیح است؛ تابلوی بالینی درد مداوم شانه در یک خانم ۶۲ ساله مبتلا به دیابت قندی که در معاینه «حرکات فعال و غیرفعال شانه در تمامی جهات کاملاً مسدود و محدود است» به همراه استئوپنی ناشی از بی‌حرکتی در گرافی و طبیعی بودن نشانگرهای التهابی (ESR=15 و CRP منفی)، پاتوگنومونیک «کپسولیت چسبنده (Adhesive Capsulitis / شانه منجمد)» است.",
            "نادرست است؛ دلیل رد: تاندونیت روتاتور کاف حرکات غیرفعال مفصل شانه را قفل نمی‌کند و دامنه غیرفعال در آن حفظ می‌شود.",
            "نادرست است؛ دلیل رد: تاندونیت دو سر بازویی با تندرنس قدام شیار دو سر و تست یرگاسون مثبت مشخص می‌شود."
        ],
        "exp": "محدودیت حرکات فعال و غیرفعال در تمام جهات در یک فرد دیابتی با ESR/CRP نرمال، مشخصه کپسولیت چسبنده است.",
        "micro": {
            "lead_fa": "کپسولیت چسبنده یک انقباض فیبروتیک غیرالتهابی منتشر در کپسول مفصل گلنوهومورال است که زمینه بسیار قدرتمندی در بیماران دیابتی دارد. یافته تشخیصی محوری: محدودیت همسان حرکات اکتیو و پاسیو در تمام جهات به ویژه در چرخش خارجی است. از آنجا که بیماری موضعی و غیرسیستمیک است، آزمایشات التهابی ESR و CRP کاملاً در محدوده نرمال قرار دارند و گرافی استئوپنی ناشی از عدم استفاده را نشان می‌دهد.",
            "lead_en": "Adhesive capsulitis (frozen shoulder) involves progressive contracture of the glenohumeral capsule, characteristically complicating diabetes mellitus. The defining physical hallmark is equal restriction of both active and passive motion across all planes, accompanied by normal inflammatory markers (ESR/CRP) and disuse osteopenia on radiographs.",
            "golden_fa": "دیابت + محدودیت کامل حرکات فعال و غیرفعال شانه در تمام جهات با ESR و CRP نرمال = کپسولیت چسبنده.",
            "golden_en": "Diabetes + global active and passive shoulder restriction with normal ESR/CRP = adhesive capsulitis.",
            "points_fa": [
                "چرخش خارجی شانه بیش از سایر جهات دچار محدودیت شدید و زودهنگام می‌گردد.",
                "تزریق کورتیکواستروئید داخل مفصل گلنوهومورال همراه با کشش ملایم کپسول درمان انتخابی است.",
                "در پارگی روتاتور کاف حرکات غیرفعال شانه آزاد است اما در کپسولیت هر دو محدود هستند.",
                "هیدرواتساع کپسول با سالین در موارد مقاوم چسبندگی‌های فیبروزه را آزاد می‌سازد."
            ],
            "points_en": [
                "External rotation is the earliest and most severely compromised arc of motion on clinical exam.",
                "Intra-articular glenohumeral corticosteroid injections paired with supervised stretching constitute first-line therapy.",
                "Passive range of motion is preserved in rotator cuff tears but globally locked in adhesive capsulitis.",
                "Glenohumeral hydrodilatation physically disrupts dense capsular adhesions in chronic recalcitrant presentations."
            ]
        }
    },
    58: {
        "whys": [
            "نادرست است؛ دلیل رد: تست یرگاسون برای تاندونیت دو سر بازویی در شانه است نه مچ دست.",
            "نادرست است؛ دلیل رد: تست تینل با ضربه زدن به عصب مدین در سندرم تونل کارپال ارزیابی می‌شود.",
            "نادرست است؛ دلیل رد: تست فالن با فلکسیون مچ دست برای ارزیابی سندرم تونل کارپال است.",
            "صحیح است؛ درد و تورم در کناره رادیال (لترال) مچ دست در یک خانم باردار به دنبال حرکات چرخشی و پیچاندن مچ، تابلوی تیپیک تنوسینوویت دکوئروان است؛ در معاینه بالینی این بیمار انتظار داریم «علامت فینکلشتاین (Finkelstein's Sign)» - که با قرار دادن شست درون مشت بسته و انحراف مچ دست به سمت اولنار انجام شده و درد شدیدی در استیلوئید رادیوس ایجاد می‌کند - مثبت باشد."
        ],
        "exp": "درد لترال مچ دست به دنبال حرکات چرخشی با علامت فینکلشتاین (Finkelstein) در تنوسینوویت دکوئروان مثبت می‌شود.",
        "micro": {
            "lead_fa": "تنوسینوویت دکوئروان التهاب غلاف فیبروزی اولین کمپارتمنت بازکننده‌های مچ دست شامل تاندون‌های APL و EPB است. بارداری و دوره پس از زایمان به علت احتباس مایعات و حرکات پیچشی مکرر مچ دست زمینه‌ساز شایع هستند. تست تشخیصی استاندارد طلایی مانور فینکلشتاین است: بیمار شست خود را درون مشت بسته پنهان کرده و پزشک مچ را به سمت استخوان اولنار منحرف می‌سازد که درد گزنده‌ای در لبه رادیال مچ دست برمی‌انگیزد.",
            "lead_en": "De Quervain's tenosynovitis involves stenosing friction of the abductor pollicis longus and extensor pollicis brevis within the first extensor compartment. Highly prevalent in pregnancy due to fluid retention and wrist wringing, Finkelstein's sign (pain provoked by passive ulnar deviation of the fist-enclosed thumb) is the hallmark physical test.",
            "golden_fa": "درد کناره رادیال مچ دست پس از حرکات پیچشی در بارداری = تست فینکلشتاین مثبت (تنوسینوویت دکوئروان).",
            "golden_en": "Radial styloid wrist pain after twisting motions in pregnancy = positive Finkelstein sign (De Quervain tenosynovitis).",
            "points_fa": [
                "تاندون‌های گرفتار: ابداکتور پولیسیس لونگوس و اکستانسور پولیسیس برویس.",
                "استفاده از آتل تامب اسپایکا (Thumb spica) مفاصل مچ و شست را بی‌حرکت و آرام می‌سازد.",
                "تزریق داخل غلاف کورتیکواستروئید در بارداری بی‌خطر و دارای اثربخشی درمانی قطعی است.",
                "درد سندرم تونل کارپال در کف دست و انگشتان است در حالی که دکوئروان روی استیلوئید رادیوس متمرکز است."
            ],
            "points_en": [
                "The tendons involved are the abductor pollicis longus and extensor pollicis brevis.",
                "A rigid thumb-spica splint mechanically unloads the irritated fibro-osseous compartment.",
                "Intrasheath corticosteroid infiltration is safe during pregnancy, yielding rapid definitive symptom resolution.",
                "Carpal tunnel syndrome causes palmar paresthesias, whereas De Quervain manifests as focal radial styloid pain."
            ]
        }
    },
    59: {
        "whys": [
            "نادرست است؛ دلیل رد: آرتریت استرپتوکوک پنومونیه یک سپسیس حاد تخریب‌کننده است که ظرف چند روز بروز می‌کند نه یک سیر تدریجی مزمن ۷ ماهه.",
            "نادرست است؛ دلیل رد: آرتریت گونوکوکی یک عفونت حاد با تابلوی سندرم درماتیت-آرتریت گذرا یا مونوآرتریت حاد چند روزه است.",
            "نادرست است؛ دلیل رد: آرتریت‌های ویروسی معمولاً حاد، خودمحدودشونده و گذرا بوده و ظرف ۲ تا ۴ هفته برطرف می‌شوند.",
            "صحیح است؛ بروز مونوآرتریت التهابی تک‌مفصلی زانو که بیش از ۶ هفته پایداری داشته و سیر بسیار موذی، پیشرونده و مزمن چندماهه (۷ ماه) را طی کرده است، در درجه اول و قبل از هر عفونت دیگر مطرح‌کننده «آرتریت توبرکولوزی (سل مفصلی / Tuberculous Monoarthritis)» است که به علت تکثیر آهسته مایکوباکتریوم توبرکلوزیس در بافت سینوویوم ایجاد می‌شود و تشخیص با بیوپسی سینوویوم قطعی می‌گردد."
        ],
        "exp": "مونوآرتریت مزمن التهابی زانو با سیر پیشرونده ۷ ماهه، تابلوی کلاسیک و مشخصه آرتریت توبرکولوزی (سل مفصلی) است.",
        "micro": {
            "lead_fa": "سل خارج ریوی در ۱۰ تا ۱۵ درصد موارد استخوان‌ها و مفاصل را مبتلا می‌سازد. مونوآرتریت توبرکولوزی به صورت یک فرآیند مزمن، کم‌درد، سرد و موذی با افیوژن و تورم پیشرونده در مفاصل بزرگ متحمل وزن (به‌ویژه زانو و هیپ) تظاهر می‌کند. بر خلاف باکتری‌های چرکی معمول که ظرف چند روز مفصل را متلاشی می‌کنند، آرتریت سلی ماه‌ها طول می‌کشد. استاندارد طلایی تشخیص انجام بیوپسی بافت سینوویال و کشت باسیل کخ است.",
            "lead_en": "Tuberculous arthritis characteristically presents as an insidious, chronic inflammatory 'cold' monoarthritis persisting over months to years, with knee and hip joints most frequently involved. Unlike acute pyogenic joint infections that destroy cartilage within days, skeletal tuberculosis progresses slowly, requiring synovial tissue biopsy for culture.",
            "golden_fa": "مونوآرتریت مزمن زانو با تداوم چندماهه (۷ ماه) = در درجه اول آرتریت توبرکولوزی (سل مفصلی).",
            "golden_en": "Chronic inflammatory monoarthritis of the knee lasting months = primarily tuberculous arthritis.",
            "points_fa": [
                "کشت بافت سینوویال نسبت به کشت مایع مفصلی حساسیت بسیار بالاتری (بیش از ۸۵٪) دارد.",
                "در رادیوگرافی تریاد فیمیستر شامل استئوپنی اطراف مفصلی، باریک شدن تدریجی فضا و اروزیون حاشیه‌ای دیده می‌شود.",
                "در بیش از نیمی از بیماران مبتلا به سل مفصلی، عکس رادیوگرافی قفسه سینه کاملاً نرمال است.",
                "درمان استاندارد شامل مصرف رژیم چهاردارویی ضدسل (RIF, INH, PZA, EMB) به مدت حداقل ۹ تا ۱۲ ماه است."
            ],
            "points_en": [
                "Synovial tissue biopsy culture delivers far superior diagnostic yield (>85%) compared to fluid culture.",
                "Radiographic Phemister triad exhibits juxta-articular osteopenia, progressive joint space loss, and marginal erosions.",
                "Chest radiographs are normal in over 50% of patients with isolated peripheral tuberculous arthritis.",
                "Antituberculous chemotherapy is administered as a four-drug regimen for an extended 9 to 12 months."
            ]
        }
    }
}


def main():
    print(f"Loading payload from: {PAYLOAD_PATH}")
    with open(PAYLOAD_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    questions = data.get("questions", [])
    print(f"Total questions in payload: {len(questions)}")

    enriched_count = 0
    for idx, enrich in ENRICHMENTS_BATCH2.items():
        if idx >= len(questions):
            print(f"Warning: Index {idx} out of range!")
            continue

        q = questions[idx]
        # PER USER DIRECTIVE: question_fa and options_fa are PRESERVED EXACTLY AS ORIGINAL.
        q["options_why_fa"] = enrich["whys"]
        q["explanation_fa"] = enrich["exp"]
        if "ci" in enrich:
            q["correct_index"] = enrich["ci"]
        if "key_source" in enrich:
            q["key_source"] = enrich["key_source"]
        if "micro" in enrich:
            q["micro"] = enrich["micro"]

        enriched_count += 1

    with open(PAYLOAD_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Successfully enriched {enriched_count} questions in {PAYLOAD_PATH} while preserving original stems and options.")


if __name__ == "__main__":
    main()
