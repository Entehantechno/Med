#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enrichment script for Part 15 Batch 1 (Questions 0 to 29)
Target payload: work/tools/master-bank/import-payload.master-preint.part15.json
Note: Per user instructions, question_fa and options_fa are preserved exactly as original.
Only options_why_fa, explanation_fa, and micro are enriched.
"""

import json
import sys

PAYLOAD_PATH = "work/tools/master-bank/import-payload.master-preint.part15.json"

ENRICHMENTS_BATCH1 = {
    0: {
        "whys": [
            "نادرست است؛ دلیل رد: سندرم لوفگرن یک بیماری خودمحدودشونده با پیش‌آگهی بسیار عالی است و نیازی به سنجش روتین RF و Anti-CCP ندارد.",
            "نادرست است؛ دلیل رد: بررسی ANA برای لوپوس کاربرد دارد در حالی که تابلوی آرتریت حاد مچ پا و اریتم ندوزوم سندرم لوفگرن سارکوئیدوز را مطرح می‌سازد.",
            "صحیح است؛ تابلوی بالینی درد و تورم حاد هر دو مچ پا (پری‌آرتریت مچ پا) به همراه پلاک‌ها و ندول‌های دردناک بنفش‌رنگ روی ساق پاها (اریتم ندوزوم / Erythema Nodosum) در یک زن جوان، پاتوگنومونیک «سندرم لوفگرن (Löfgren's Syndrome)» در سارکوئیدوز حاد است؛ گام تشخیصی بعدی استاندارد و ضروری، انجام «رادیوگرافی قفسه صدری (CXR)» جهت بررسی لنفادنوپاتی دوطرفه ناف ریه (Bilateral Hilar Lymphadenopathy) است که تریاد بیماری را کامل می‌سازد.",
            "نادرست است؛ دلیل رد: اسید اوریک برای نقرس است که به شکل مونوآرتریت حاد تظاهر می‌کند نه پری‌آرتریت دوطرفه مچ پا با اریتم ندوزوم."
        ],
        "exp": "پری‌آرتریت دوطرفه مچ پا همراه با اریتم ندوزوم معرف سندرم لوفگرن (سارکوئیدوز حاد) است و رادیوگرافی قفسه سینه جهت اثبات آدنوپاتی هیلار گام بعدی است.",
        "micro": {
            "lead_fa": "سندرم لوفگرن فرم حاد و خوش‌خیم سارکوئیدوز است که با تریاد مشخص: ۱) آرتریت یا پری‌آرتریت حاد دوطرفه مچ پا؛ ۲) اریتم ندوزوم (پلاک‌های اریتماتوی دردناک در قدام ساق پا)؛ ۳) لنفادنوپاتی ناف ریه دوطرفه در رادیوگرافی قفسه سینه شناخته می‌شود. پیش‌آگهی این فرم بسیار درخشان است و در بیش از ۸۵ تا ۹۰ درصد بیماران ظرف ۱ تا ۲ سال خودبه‌خود بدون نیاز به درمان سرکوب‌کننده ایمنی بهبود می‌یابد.",
            "lead_en": "Löfgren syndrome represents an acute benign presentation of sarcoidosis defined by the classic triad of bilateral hilar adenopathy on chest radiography, painful erythema nodosum over the pretibial regions, and acute bilateral ankle periarthritis.",
            "golden_fa": "آرتریت دوطرفه مچ پا + اریتم ندوزوم ساق پا = سندرم لوفگرن (سارکوئیدوز حاد)؛ اقدام تشخیصی: عکس قفسه سینه (CXR).",
            "golden_en": "Bilateral ankle periarthritis + erythema nodosum = Löfgren syndrome (acute sarcoidosis); next step: chest X-ray.",
            "points_fa": [
                "در سندرم لوفگرن کلاسیک نیازی به بیوپسی بافت نیست و تریاد بالینی-تصویربرداری برای تشخیص کافی است.",
                "درمان خط اول دارویی شامل استراحت و مصرف داروهای ضدالتهاب غیراستروئیدی (NSAIDs) است.",
                "کلشی‌سین در موارد مقاوم به NSAIDها می‌تواند در تسکین اریتم ندوزوم مؤثر باشد.",
                "محدوده حرکات غیرفعال مچ پا معمولاً حفظ می‌شود چون التهاب بیشتر پری‌آرتیکولار است."
            ],
            "points_en": [
                "Tissue biopsy is unnecessary when the full classical clinical-radiological triad of Löfgren syndrome is present.",
                "First-line management centers on bed rest and short-course nonsteroidal anti-inflammatory drugs (NSAIDs).",
                "Colchicine offers effective second-line relief for persistent painful erythema nodosum.",
                "Passive ankle range of motion remains largely preserved because inflammation is predominately periarticular."
            ]
        }
    },
    1: {
        "whys": [
            "نادرست است؛ دلیل رد: اسپوندیلیت آنکیلوزان بیماری التهابی مزمن با شروع تدریجی درد ستون فقرات و ساکروایلییت است نه اولیگوآرتریت حاد پس از اسهال عفونی.",
            "نادرست است؛ دلیل رد: بیماری استیل بالغین با تب بالا، راش سالمون، گلودرد و افزایش بسیار شدید فریتین (بالای ۳۰۰۰) مشخص می‌شود.",
            "نادرست است؛ دلیل رد: نقرس معمولاً به صورت مونوآرتریت حاد شست پا یا زانو در افراد مسن‌تر رخ می‌دهد و با اسهال و کنژونکتیویت همراهی ندارد.",
            "صحیح است؛ تابلوی اولیگوآرتریت حاد غیرقرینه اندام تحتانی (زانو و مچ پا)، کنژونکتیویت چشمی، و انتزیت تاندون آشیل چند روز پس از یک دوره اسهال عفونی (پاتوژن‌هایی نظیر شیگلا، سالمونلا، یرسینیا یا کامپیلوباکتر)، تظاهر کلاسیک «آرتریت راکتیو (Reactive Arthritis / سندرم رایتر)» است."
        ],
        "exp": "اولیگوآرتریت اندام تحتانی، انتزیت و کنژونکتیویت به دنبال گاستروانتریت عفونی، تابلوی مشخص آرتریت راکتیو است.",
        "micro": {
            "lead_fa": "آرتریت راکتیو یک اسپوندیلوآرتریت سرونگاتیو است که ۱ تا ۴ هفته پس از یک عفونت دستگاه گوارش (شیگلا، سالمونلا، کامپیلوباکتر) یا دستگاه ادراری-تناسلی (کلامیدیا تراکوماتیس) ایجاد می‌شود. تظاهرات بالینی شامل اولیگوآرتریت غیرقرینه مفاصل بزرگ اندام تحتانی، انتزیت (به‌ویژه تاندون آشیل و فاشیای کف پا)، داکتیلیت (انگشت سوسیسی)، و درگیری مخاطی-چشمی شامل کنژونکتیویت، اورتریت استریل و کراتودرما بلنوراژیکا است.",
            "lead_en": "Reactive arthritis is a seronegative spondyloarthropathy developing 1 to 4 weeks following enteritis (Shigella, Salmonella, Campylobacter) or genitourinary infection (Chlamydia). Classic triad features inflammatory asymmetric oligoarthritis, conjunctivitis, and non-gonococcal urethritis with prominent enthesitis.",
            "golden_fa": "آرتریت زانو و مچ پا + التهاب تاندون آشیل + کنژونکتیویت بعد از اسهال = آرتریت راکتیو.",
            "golden_en": "Lower extremity arthritis + Achilles enthesitis + conjunctivitis post-enteritis = reactive arthritis.",
            "points_fa": [
                "آنتی‌ژن HLA-B27 در ۶۰ تا ۸۰ درصد بیماران مبتلا به آرتریت راکتیو مثبت گزارش می‌شود.",
                "درمان خط اول درمان دارویی علائم مفصلی شامل دوزهای بالای NSAIDs (نظیر ناپروکسن یا ایندومتاسین) است.",
                "آنتی‌بیوتیک‌ها در آرتریت راکتیو ناشی از اسهال عفونی تأثیری در درمان روند مفصلی ندارند.",
                "در موارد آرتریت راکتیو مزمن و مقاوم به NSAID، سولفاسالازین داروی انتخابی خط دوم است."
            ],
            "points_en": [
                "HLA-B27 is positive in 60-80% of severe reactive arthritis presentations.",
                "High-dose continuous NSAIDs (e.g., indomethacin, naproxen) represent the foundational first-line therapy.",
                "Post-dysenteric reactive arthritis derives no articular therapeutic benefit from antibacterial therapy.",
                "Sulfasalazine is the preferred disease-modifying agent when peripheral arthritis persists beyond 3-6 months."
            ]
        }
    },
    2: {
        "whys": [
            "نادرست است؛ دلیل رد: قطع ناگهانی کورتیکواستروئید منجر به بحران حاد نارسایی آدرنال می‌شود و تستر Anti-CCP اورژانسی نیست.",
            "صحیح است؛ در هر بیمار مبتلا به آرتریت روماتوئید که دچار تشدید حاد درد و التهاب در یک مفصل تک (مونوآرتریت حاد مچ دست) همراه با تب و علائم سیستمیک می‌شود، تشخیص قطعی فرضی تا اثبات خلاف آن «آرتریت سپتیک باکتریایی» است؛ اقدام تشخیصی و درمانی استاندارد اورژانسی، «انجام فوری آرتروسنتز جهت اسمیر گرم و کشت مایع سینوویال به همراه کشت خون و شروع بلافاصله آنتی‌بیوتیک وریدی وسیع‌الطیف» است.",
            "نادرست است؛ دلیل رد: افزایش دوز استروئید در بیمار با عفونت چرکی مفصل فاجعه‌بار است و عفونت باکتریایی را تشدید می‌کند.",
            "نادرست است؛ دلیل رد: تزریق کورتیکواستروئید به داخل مفصل مشکوک به سپسیس اکیداً ممنوع بوده و غضروف را نابود می‌سازد."
        ],
        "exp": "در بیمار روماتوئیدی با مونوآرتریت حاد تب‌دار، اسمیر و کشت مایع مفصل و خون و شروع فوری آنتی‌بیوتیک وریدی الزامی است.",
        "micro": {
            "lead_fa": "مفاصل آسیب‌دیده از آرتریت روماتوئید بستر مستعدی برای لانه‌گزینی هماتوژن باکتری‌ها هستند و مصرف داروهای سرکوب‌کننده ایمنی این خطر را تشدید می‌کند. مونوآرتریت حاد با تب و لرز هرگز نباید تشدید ساده بیماری زمینه‌ای قلمداد شود. نمونه‌گیری مایع سینوویال با سوزن، ارسال جهت رنگ‌آمیزی گرم، شمارش سلول و کشت، همراه با کشت خون و شروع فوری آنتی‌بیوتیک‌های باکتریسیدال وریدی قبل از هر اقدام دیگر واجب است.",
            "lead_en": "Pre-existing joint damage and immunosuppression render rheumatoid arthritis patients exceptionally susceptible to secondary septic arthritis. Acute febrile monoarthritis requires urgent arthrocentesis for Gram stain, leukocyte count, and culture, coupled with blood cultures and immediate intravenous bactericidal therapy.",
            "golden_fa": "مونوآرتریت حاد مچ دست با تب در بیمار روماتوئید = اورژانس آرتریت سپتیک؛ اقدام: کشت مفصل و خون + آنتی‌بیوتیک وریدی.",
            "golden_en": "Acute febrile monoarthritis in rheumatoid arthritis = septic arthritis emergency; aspirate joint, culture, and start IV antibiotics.",
            "points_fa": [
                "استافیلوکوک اورئوس شایع‌ترین عامل باکتریایی آرتریت چرکی در بیماران آرتریت روماتوئید است.",
                "پوشش آنتی‌بیوتیکی تجربی باید استافیلوکوک و باسیل‌های گرم منفی را به طور همزمان پوشش دهد.",
                "تزریق داخل مفصلی کورتون تا رد قطعی سپسیس ممنوعیت مطلق دارد.",
                "تخلیه مکرر مایع چرکی با آسپیراسیون سوزنی جهت کاهش فشار و بار آنزیمی مخرب انجام می‌شود."
            ],
            "points_en": [
                "Staphylococcus aureus is the predominant causative pathogen implicated in rheumatoid joint sepsis.",
                "Empiric antimicrobial coverage must cover MRSA and gram-negative bacilli simultaneously.",
                "Intra-articular steroid instillation is strictly prohibited until bacterial sepsis is definitively ruled out.",
                "Serial therapeutic joint aspirations decompress intra-articular pressure and evacuate damaging enzymes."
            ]
        }
    },
    3: {
        "whys": [
            "صحیح است (تشخیصی که در مونوآرتریت مزمن زانو کمترین احتمال را دارد)؛ بیماری «اسپوندیلیت آنکیلوزان (AS)» به طور عمده یک بیماری اسکلت محوری (ستون فقرات و مفاصل ساکروایلیاک) و انتزیت است؛ بروز درگیری محیطی به صورت مونوآرتریت مزمن ایزوله زانو بدون سابقه کمردرد التهابی تظاهری بسیار نامتعارف و نادر برای AS است و نسبت به سل، آرتریت پسوریاتیک و راکتیو کمترین احتمال را دارد.",
            "نادرست است؛ دلیل رد: سل مفصلی (سل خارج ریوی) از شایع‌ترین علل کلاسیک مونوآرتریت التهابی مزمن زانو در جهان است.",
            "نادرست است؛ دلیل رد: آرتریت پسوریاتیک می‌تواند با مونوآرتریت مزمن یا اولیگوآرتریت زانو تظاهر کند.",
            "نادرست است؛ دلیل رد: آرتریت راکتیو تمایل شدیدی به ایجاد مونوآرتریت یا اولیگوآرتریت زانو و مچ پا دارد."
        ],
        "exp": "اسپوندیلیت آنکیلوزان بیماری محوری ستون مهره‌هاست و تظاهر آن به شکل مونوآرتریت مزمن ایزوله زانو بسیار نامحتمل است.",
        "micro": {
            "lead_fa": "مونوآرتریت التهابی مزمن (تداوم بیش از ۶ هفته در یک مفصل) تشخیص افتراقی‌های مشخصی دارد: عفونت‌های گرانولوماتوز مزمن (سل مفصلی، قارچ‌ها)، آرتریت‌های میکروکریستالی مزمن، و اسپوندیلوآرتروپاتی‌های محیطی (پسوریاتیک و راکتیو). در نقطه مقابل، اسپوندیلیت آنکیلوزان کلاسیک ستون فقرات کمری و مفاصل ساکروایلیاک را گرفتار می‌سازد و بروز آن صرفاً به صورت مونوآرتریت مزمن محیطی زانو فوق‌العاده نادر است.",
            "lead_en": "Chronic inflammatory monoarthritis persisting beyond 6 weeks is most commonly caused by mycobacterial infections, fungal synovitis, or peripheral spondyloarthropathies (psoriatic, reactive). Classic ankylosing spondylitis targets the axial skeleton, making isolated chronic knee monoarthritis exceedingly improbable.",
            "golden_fa": "علل مونوآرتریت مزمن زانو: سل مفصلی، آرتریت پسوریاتیک و راکتیو؛ اسپوندیلیت آنکیلوزان بیماری محوری است.",
            "golden_en": "Causes of chronic knee monoarthritis include TB, psoriatic, and reactive arthritis; axial AS rarely presents as isolated knee disease.",
            "points_fa": [
                "سل مفصلی با بیوپسی بافت سینوویال و کشت نمونه اثبات می‌گردد.",
                "در آرتریت پسوریاتیک بررسی ناخن‌ها و پوست از نظر پلاک پسوریازیس راهگشاست.",
                "کریستال‌های پیروفسفات کلسیم (CPPD) نیز می‌توانند مونوآرتریت مزمن زانو ایجاد کنند.",
                "آسپیراسیون و آنالیز مایع سینوویال اولین اقدام ضروری در هر مونوآرتریت مزمن است."
            ],
            "points_en": [
                "Tuberculous arthritis confirmation requires synovial tissue biopsy and mycobacterial culture.",
                "Psoriatic arthritis mandates thorough cutaneous inspection for occult plaque disease and nail pitting.",
                "Calcium pyrophosphate dihydrate (CPPD) crystal deposition can trigger pseudo-rheumatoid monoarthritis.",
                "Synovial fluid analysis remains the indispensable initial step in evaluating any chronic monoarticular effusion."
            ]
        }
    },
    4: {
        "whys": [
            "صحیح است؛ در یک «مرد جوان که به دنبال بلند کردن بار سنگین دچار کمردرد حاد شده و معاینه فیزیکی و عصبی وی کاملاً نرمال است»، تابلوی کشیدگی حاد عضلانی-رباطی مکانیکی ستون فقرات (Acute Lumbago / Mechanical Low Back Pain) مطرح است؛ در غیاب تمام علائم هشداردهنده (Red Flags)، هیچ‌گونه تصویربرداری یا بررسی اضافی لازم نبوده و درمان علامتی و محافظه‌کارانه (فعالیت در حد تحمل، مسکن‌های ساده و گرما) توصیه اصلی است.",
            "نادرست است؛ دلیل رد: وجود تب علامت هشداردهنده (Red flag) برای سپسیس، استئومیلیت مهره یا آبسه اپیدورال است و نیازمند تصویربرداری و بررسی فوری است.",
            "نادرست است؛ دلیل رد: سن بالای ۷۵ سال بدون تروما پرچم قرمز بدخیمی یا شکستگی فشاری استئوپروتیک است.",
            "نادرست است؛ دلیل رد: مصرف مواد مخدر تزریقی ریسک‌فاکتور مهلک دیسکیت و آبسه اپیدورال ستون فقرات است."
        ],
        "exp": "کمردرد حاد مکانیکی پس از بلند کردن بار سنگین در جوان با معاینه عصبی نرمال، فقط نیازمند درمان علامتی محافظه‌کارانه است.",
        "micro": {
            "lead_fa": "کمردرد حاد در بالغین جوان در بیش از ۹۰ درصد موارد ناشی از کشیدگی لامیناها، فاست‌ها و رباط‌های پاراورتبرال است. در بیمار جوان فاقد علائم هشداردهنده (شامل تب، سابقه سرطان، کاهش وزن، مصرف کورتون، اعتیاد تزریقی، سن بالای ۵۰ سال یا نقایص عصبی پیشرونده)، انجام گرافی ساده یا ام‌آر‌آی در ۴ تا ۶ هفته اول ممنوع است و مدیریت بر درمان علامتی و تشویق به تحرک استوار است.",
            "lead_en": "Acute low back pain in young adults without red flags represents benign mechanical musculoligamentous strain. In the absence of constitutional symptoms, trauma, or neurological deficits, routine neuroimaging is unindicated within the initial 4 to 6 weeks, and conservative symptomatic therapy is standard.",
            "golden_fa": "کمردرد حاد جوان پس از بار سنگین با معاینه نرمال = درمان علامتی؛ تصویربرداری در ۴ تا ۶ هفته اول ممنوع است.",
            "golden_en": "Acute mechanical back pain in young adults with normal exam = symptomatic treatment; imaging is contraindicated initially.",
            "points_fa": [
                "استراحت مطلق در بستر بیش از ۴۸ ساعت مضر بوده و بازگشت زودهنگام به فعالیت توصیه می‌شود.",
                "داروهای ضدالتهاب غیراستروئیدی (NSAIDs) یا استامینوفن مسکن‌های انتخابی هستند.",
                "شل‌کننده‌های عضلانی در چند روز اول می‌توانند به کاهش اسپاسم‌های حاد کمک کنند.",
                "در صورت تداوم درد پس از ۶ هفته، بررسی‌های تکمیلی تصویربرداری ارزیابی می‌شود."
            ],
            "points_en": [
                "Bed rest exceeding 48 hours delays recovery; early ambulation within pain limits is strongly recommended.",
                "NSAIDs and acetaminophen represent first-line analgesics for acute mechanical back symptoms.",
                "Short-term skeletal muscle relaxants provide adjunctive relief for intense paraspinal spasm.",
                "Persistent pain lasting beyond 4 to 6 weeks warrants secondary diagnostic re-evaluation."
            ]
        }
    },
    5: {
        "whys": [
            "نادرست است؛ دلیل رد: نفریت لوپوسی و پروتئینوری یکی از شایع‌ترین و جدی‌ترین عوارض سیستمیک بیماری SLE است.",
            "نادرست است؛ دلیل رد: تشنج و سایکوز از معیارهای اصلی درگیری سیستم عصبی مرکزی در لوپوس هستند.",
            "نادرست است؛ دلیل رد: سروزیت به شکل پریکاردیت و پلوریت در بیماران لوپوسی بسیار شایع است.",
            "صحیح است (عارضه‌ای که بیمار در معرض آن قرار ندارد)؛ «کمردرد التهابی و ساکروایلییت» تظاهر اختصاصی گروه بیماری‌های اسپوندیلوآرتریت سرونگاتیو (نظیر اسپوندیلیت آنکیلوزان) است؛ بیماری لوپوس اریتماتوی سیستمیک (SLE) مفاصل اسکلت محوری و ساکروایلیاک را درگیر نمی‌کند و بیمار در معرض کمردرد التهابی نیست."
        ],
        "exp": "لوپوس مفاصل محوری و ساکروایلیاک را مبتلا نمی‌سازد؛ کمردرد التهابی مربوط به اسپوندیلوآرتروپاتی‌هاست نه SLE.",
        "micro": {
            "lead_fa": "لوپوس اریتماتوی سیستمیک (SLE) یک بیماری خودایمنی چندسیستمی است که مفاصل محیطی (پلی‌آرتریت غیوتخریبی)، پوست (راش مالار، فتوسنسیتیویتی)، کلیه‌ها (گلومرولونفریت لوپوسی)، بافت‌های سروز (پریکاردیت، پلوریت)، سیستم خون‌ساز (سیتوپنی‌ها) و سیستم عصبی (تشنج، سایکوز) را مبتلا می‌سازد. درگیری ستون فقرات، ساکروایلییت و کمردرد التهابی از ویژگی‌های اسپوندیلوآرتریت‌ها هستند و در لوپوس رخ نمی‌دهند.",
            "lead_en": "Systemic lupus erythematosus characteristically involves peripheral non-erosive polyarthritis, cutaneous rashes, serositis (pericarditis), glomerulonephritis, hematologic cytopenias, and neuropsychiatric disorders. The axial skeleton and sacroiliac joints are spared in SLE, making inflammatory back pain absent.",
            "golden_fa": "عوارض لوپوس: نفریت، پریکاردیت، تشنج و سیتوپنی؛ ستون فقرات و کمردرد التهابی در لوپوس درگیر نمی‌شوند.",
            "golden_en": "SLE targets kidneys, serosa, CNS, and blood cells; the axial skeleton and inflammatory back pain are not features of SLE.",
            "points_fa": [
                "پروتئینوری نیازمند بیوپسی کلیه جهت تعیین کلاس نفریت لوپوسی (کلاس I تا VI) است.",
                "پریکاردیت شایع‌ترین تظاهر قلبی در بیماران مبتلا به لوپوس فعال است.",
                "تشنج و لوپوس مغزی نیازمند پالس استروئید و داروهای سرکوب‌کننده ایمنی قوی است.",
                "آرتریت لوپوس بر خلاف RA غیراروزیو است و استخوان را تخریب نمی‌کند."
            ],
            "points_en": [
                "Significant proteinuria warrants percutaneous renal biopsy to stage histologic nephritis class.",
                "Pericarditis is the most common cardiovascular manifestation of active systemic lupus erythematosus.",
                "Lupus psychosis and seizures require high-dose pulse corticosteroids and aggressive immunosuppression.",
                "Lupus peripheral arthritis is non-erosive and reducible (Jaccoud arthropathy), preserving joint architecture."
            ]
        }
    },
    6: {
        "whys": [
            "نادرست است؛ دلیل رد: تست فینکلشتاین برای بررسی تنوسینوویت دکوئروان در مچ دست است نه شانه.",
            "نادرست است؛ دلیل رد: تست کلنسی تستی نامربوط و غیراختصاصی در معاینات ارتوپدی است.",
            "صحیح است؛ درد قدام شانه با انتشار به ساعد، تشدید در ابداکسیون و چرخش خارجی، و تندرنس موضعی در شیار بین تکمه‌ای بازو، مشخصه تاندینوپاتی سر بلند عضله دوسربازویی (Bicipital Tendinitis) است؛ «مانور سوپیناسیون یرگاسون (Yergason's Test)» که با سوپیناسیون مقاومتی ساعد همراه با فلکسیون آرنج انجام می‌شود، تاندون دو سر را در شیار بای‌سیپیتال تحت استرس قرار داده و تست بالینی انتخابی است.",
            "نادرست است؛ دلیل رد: علامت کشویی (Drawer sign) برای ارزیابی پارگی رباط‌های متقاطع زانو به کار می‌رود."
        ],
        "exp": "تست سوپیناسیون مقاومتی یرگاسون (Yergason) تست اختصاصی برای تشخیص تاندونیت عضله دوسربازویی در قدام شانه است.",
        "micro": {
            "lead_fa": "تاندونیت بای‌سیپیتال التهاب تاندون سر بلند عضله دوسربازویی در حین عبور از شیار بین تکمه‌های هومروس است. این عارضه اغلب ثانویه به حرکات مکرر اندام فوقانی رخ می‌دهد. معاینه بالینی با دو آزمون استاندارد تأیید می‌شود: ۱) تست یرگاسون (Yergason): سوپیناسیون ساعد در برابر مقاومت پزشک در حالی که آرنج ۹۰ درجه خم است؛ ۲) تست اسپید (Speed): فلکسیون رو به بالای دست در برابر مقاومت.",
            "lead_en": "Bicipital tendinitis represents friction inflammation of the long head of the biceps brachii tendon. It produces anterior shoulder tenderness along the bicipital groove. Yergason's maneuver (resisted active forearm supination with elbow flexed to 90°) selectively tensions the tendon, reproducing anterior shoulder pain.",
            "golden_fa": "درد و حساسیت قدام شانه در شیار بین توبرکول‌ها = تست یرگاسون (تاندونیت دو سر بازویی).",
            "golden_en": "Anterior shoulder pain over the bicipital groove = positive Yergason test (bicipital tendinitis).",
            "points_fa": [
                "تست اسپید (Speed test) حساسیت بالینی حتی بالاتری نسبت به مانور یرگاسون دارد.",
                "تندرنس در لمس مستقیم شیار بای‌سیپیتال در قدام شانه کلید بالینی معاینه است.",
                "درمان اولیه شامل استراحت نسبی، پرهیز از کارهای تکراری بالای سر و NSAIDs است.",
                "تزریق دقیق استروئید به داخل غلاف تاندون تحت هدایت سونوگرافی در موارد مقاوم مؤثر است."
            ],
            "points_en": [
                "Speed's test offers greater sensitivity than Yergason's maneuver in identifying biceps tendinopathy.",
                "Point tenderness along the bicipital groove is the most localized physical finding.",
                "Conservative therapy mandates relative rest, avoiding overhead lifting strain, and NSAIDs.",
                "Ultrasound-guided peritendinous corticosteroid infiltration provides prompt symptomatic relief."
            ]
        }
    },
    7: {
        "whys": [
            "نادرست است؛ دلیل رد: افزایش سرکوب ایمنی خوراکی در حضور مونوآرتریت حاد و شک به عفونت خطرناک است.",
            "نادرست است؛ دلیل رد: داروهای بیولوژیک ضد TNF در بیمار مشکوک به آرتریت سپسیس مطلقاً منع مصرف دارند.",
            "صحیح است؛ در هر بیمار مبتلا به آرتریت روماتوئید که مفاصل محیطی وی آرام یا دارای التهاب خفیف مزمن هستند و ناگهان دچار تشدید حاد مونوآرتیکولار با افیوژن و قرمزی در مفصل زانو می‌شود، تشخیص اول تا اثبات خلاف آن «آرتریت سپتیک ثانویه» است؛ مناسب‌ترین و اولین اقدام، «انجام آسپیراسیون مایع مفصلی زانوی چپ (آرتروسنتز) جهت شمارش سلولی، رنگ‌آمیزی گرم و کشت باکتری» است.",
            "نادرست است؛ دلیل رد: تزریق کورتون به داخل مفصل قبل از رد قطعی آرتریت سپسیس فاجعه‌بار است و مفصل را منهدم می‌سازد."
        ],
        "exp": "تشدید حاد مونوآرتیکولار همراه با قرمزی زانو در بیمار RA، نیازمند آسپیراسیون فوری مایع مفصل جهت رد سپسیس است.",
        "micro": {
            "lead_fa": "قانون بالینی حیاتی در روماتولوژی: تشدید نامتناسب التهاب در یک مفصل تک (مونوآرتریت حاد) در بیماری که مبتلا به آرتریت روماتوئید است و داروهای سرکوب‌کننده ایمنی مصرف می‌کند، هرگز نباید عود ساده بیماری تلقی شود. آرتریت سپسیس سوارشده بر مفصل آسیب‌دیده روماتوئید بسیار شایع و مخرب است. آسپیراسیون سینوویال و بررسی اسمیر و کشت پیش از هر مداخله دارویی یا تزریقی اجباری است.",
            "lead_en": "An acute disproportionate monoarticular flare with warmth and effusion in a patient with rheumatoid arthritis must be presumed septic arthritis until proven otherwise. Immediate arthrocentesis for synovial cell count, Gram stain, and microbiological culture is the mandatory primary step.",
            "golden_fa": "تشدید حاد قرمزی و تورم زانو در بیمار روماتوئیدی = اورژانس سپسیس مفصل؛ اولین اقدام: آسپیراسیون زانو.",
            "golden_en": "Acute red swollen knee flare in an RA patient = rule out septic arthritis; first step: knee arthrocentesis.",
            "points_fa": [
                "تزریق داخل مفصلی استروئید تا زمان آماده شدن نتیجه کشت مایع مفصل کاملاً ممنوع است.",
                "گلبول سفید بالای ۵۰٬۰۰۰ در میکرولیتر با بیش از ۹۰٪ نوتروفیل نشانه قطعی سپسیس است.",
                "استافیلوکوک اورئوس شایع‌ترین پاتوژن در مفاصل روماتوئید عفونی است.",
                "شروع آنتی‌بیوتیک تجربی وسیع‌الطیف وریدی بلافاصله پس از تخلیه مایع انجام می‌شود."
            ],
            "points_en": [
                "Intra-articular steroid injections are strictly contraindicated until joint infection is excluded.",
                "Synovial fluid leukocyte counts >50,000/μL with >90% neutrophils establish joint sepsis.",
                "Staphylococcus aureus represents the leading pathogen cultured from septic rheumatoid joints.",
                "Empiric intravenous broad-spectrum bactericidal coverage follows immediate joint aspiration."
            ]
        }
    },
    8: {
        "whys": [
            "صحیح است؛ بیمار تابلوی قطعی لوپوس اریتماتوی سیستمیک (SLE) شامل آرتریت، مالار راش، حساسیت به نور، لکوپنی، FANA مثبت و پروتئینوری بالای یک گرم دارد؛ در میان اتوآنتی‌بادی‌های موجود، «Anti-dsDNA» اختصاصی‌ترین آنتی‌بادی برای بیماری SLE است (اختصاصیت بالای ۹۵٪) و علاوه بر تأیید تشخیص، تیتر آن مستقیماً نشانگر فعالیت بیماری و درگیری نفریت لوپوسی است.",
            "نادرست است؛ دلیل رد: Anti-U1-RNP آنتی‌بادی شاخص بیماری بافت همبند مختلط (MCTD) است نه لوپوس خالص.",
            "نادرست است؛ دلیل رد: Anti-Ro در سندرم شوگرن و لوپوس جلدی تحت حاد دیده می‌شود و اختصاصیت کمتری برای SLE دارد.",
            "نادرست است؛ دلیل رد: Anti-Scl-70 مارکر اسکلرودرمی پوستی منتشر است."
        ],
        "exp": "آنتی‌بادی Anti-dsDNA اختصاصی‌ترین اتوآنتی‌بادی برای تأیید تشخیص SLE و پایش نفریت لوپوسی فعال است.",
        "micro": {
            "lead_fa": "در ارزیابی آزمایشگاهی لوپوس سیستمیک، تست FANA (آزمایش آنتی‌بادی ضد هسته) دارای حساسیت فوق‌العاده بالا (بیش از ۹۸٪) اما اختصاصیت پایین است. برای اثبات و تأیید قطعی تشخیص، آنتی‌بادی‌های اختصاصی سنجیده می‌شوند: ۱) Anti-dsDNA که اختصاصیت بسیار بالا داشته و با شدت نفریت همبستگی دارد؛ ۲) Anti-Smith که بیشترین اختصاصیت (۹۹٪) را دارد اما سطح آن با فعالیت بیماری تغییر نمی‌کند.",
            "lead_en": "While ANA is highly sensitive for SLE, its diagnostic specificity is limited. Anti-double-stranded DNA (anti-dsDNA) antibodies provide high diagnostic specificity for SLE and correlate closely with disease flare activity and active proliferative glomerulonephritis.",
            "golden_fa": "آنتی‌بادی اختصاصی جهت تأیید لوپوس و پایش درگیری کلیه = Anti-dsDNA.",
            "golden_en": "Specific autoantibody to confirm SLE diagnosis and monitor renal involvement = anti-dsDNA.",
            "points_fa": [
                "پروتئینوری ۱۲۰۰ میلی‌گرم در ۲۴ ساعت اندیکاسیون قطعی بیوپسی سوزنی کلیه است.",
                "افزایش تیتر Anti-dsDNA همزمان با افت C3 و C4 نشانگر عود فعال نفریت است.",
                "هیدروکسی‌کلروکین داروی مادام‌العمر برای بقا و کاهش شعله‌وری در تمام بیماران SLE است.",
                "آنتی‌بادی Anti-Sm نیز بسیار اختصاصی است اما به ندرت در طول زمان نوسان می‌کند."
            ],
            "points_en": [
                "24-hour proteinuria of 1200 mg warrants immediate percutaneous renal biopsy for staging.",
                "Rising anti-dsDNA titers paired with hypocomplementemia (low C3/C4) herald active nephritis flares.",
                "Lifelong hydroxychloroquine therapy is mandatory for all SLE patients to reduce flares and mortality.",
                "Anti-Smith (anti-Sm) is highly specific but its titer does not track disease activity longitudinally."
            ]
        }
    },
    9: {
        "whys": [
            "نادرست است؛ دلیل رد: نقرس مفاصل DIP دست‌ها را به این صورت در زن جوان درگیر نمی‌کند و با پیتینگ ناخن همراه نیست.",
            "صحیح است؛ درگیری مفاصل اینترفالانژیال دیستال (DIP) به همراه PIP و MCP با الگوی نامتقارن، منفی بودن فاکتور روماتوئید (RF سرونگاتیو)، و مشاهده فرورفتگی‌های سوزنی در ناخن‌ها (Nail Pitting)، تابلوی پاتوگنومونیک و کلاسیک «آرتریت پسوریازیسی (Psoriatic Arthritis)» است؛ هایپراوریسمی خفیف نیز به علت ترن‌اور بالای سلول‌های اپیدرم در بیماران پسوریاتیک شایع است.",
            "نادرست است؛ دلیل رد: آرتریت روماتوئید به طور کلاسیک مفاصل DIP را درگیر نمی‌کند، قرینه است، پیتینگ ناخن ندارد و معمولاً RF مثبت است.",
            "نادرست است؛ دلیل رد: سارکوئیدوز این الگوی اختصاصی درگیری DIP و پیتینگ ناخن‌ها را ایجاد نمی‌کند."
        ],
        "exp": "درگیری مفاصل DIP، الگوی نامتقارن، پیتینگ ناخن و RF منفی مشخصه پاتوگنومونیک آرتریت پسوریازیسی است.",
        "micro": {
            "lead_fa": "آرتریت پسوریازیسی (PsA) یک آرتریت التهابی ناهمگون سرونگاتیو است. ویژگی‌های شاخص این بیماری: ۱) درگیری مشخص مفاصل DIP که در RA دیده نمی‌شود؛ ۲) دیستروفی و پیتینگ ناخن‌ها (Nail pitting) در بیش از ۸۰٪ بیماران دارای آرتریت DIP؛ ۳) داکتیلیت (تورم سوسیسی کل انگشت)؛ ۴) ترن‌اور بالای پوستی که می‌تواند منجر به هایپراوریسمی ثانویه شود. آرتریت در ۱۵٪ موارد قبل از ظهور ضایعات پوستی بروز می‌کند.",
            "lead_en": "Psoriatic arthritis is a seronegative inflammatory arthropathy distinctively targeting distal interphalangeal (DIP) joints, accompanied by prominent nail pitting and onycholysis. Rapid epidermal turnover frequently causes secondary mild hyperuricemia, occasionally mimicking gout.",
            "golden_fa": "آرتریت مفاصل DIP + پیتینگ ناخن + RF منفی = آرتریت پسوریازیسی.",
            "golden_en": "DIP joint arthritis + nail pitting + negative RF = psoriatic arthritis.",
            "points_fa": [
                "درگیری مفاصل DIP همراه با تغییرات ناخنی قویاً آرتریت پسوریازیسی را از آرتریت روماتوئید افتراق می‌دهد.",
                "تغییرات رادیوگرافی در مراحل پیشرفته شامل نمای کلاسیک مداد در فنجان (Pencil-in-cup) است.",
                "داروهای ضد TNF، مهارکننده‌های IL-17 (سکوکینوماب) و IL-23 درمان‌های هدفمند بسیار مؤثر هستند.",
                "متوترکسات داروی انتخابی خط اول در درگیری همزمان پوست و مفاصل محیطی است."
            ],
            "points_en": [
                "DIP joint involvement paired with nail changes definitively distinguishes PsA from rheumatoid arthritis.",
                "Advanced radiographic manifestations classically demonstrate 'pencil-in-cup' destructive deformities.",
                "Targeted biologic therapies including TNF-alpha, IL-17, and IL-23 inhibitors effectively control skin and joint disease.",
                "Methotrexate is the preferred initial disease-modifying agent addressing joint and plaque involvement."
            ]
        }
    },
    10: {
        "whys": [
            "نادرست است؛ دلیل رد: در کمردرد حاد رادیکولر ۲ روزه بدون نقص پیشرونده حرکتی، رادیوگرافی ساده کمکی به تشخیص فتق دیسک نمی‌کند.",
            "صحیح است؛ در یک «مرد ۲۵ ساله با کمردرد مزمن از تیپ التهابی با ماندگاری بیش از ۳ تا ۶ ماه»، شک اولیه به «اسپوندیلیت آنکیلوزان (AS)» و اسپوندیلوآرتریت محوری است؛ بر اساس معیارهای تشخیصی استاندارد اصلاح‌شده نیویورک، «انجام رادیوگرافی ساده لگن و مفاصل ساکروایلیاک» برای اثبات شواهد عینی ساکروایلییت دوطرفه (اروزیون، اسکلروز، باریک شدن فضا و آنکیلوز) ارزش تشخیصی فوق‌العاده بالایی دارد و سنگ‌بنای تأیید بیماری است.",
            "نادرست است؛ دلیل رد: برای بررسی استئوپروز رادیوگرافی ساده کاربرد ندارد و سنجش تراکم استخوان (DEXA scan) استاندارد است.",
            "نادرست است؛ دلیل رد: کمردرد مکانیکی حاد پس از حرکت ناگهانی ناشی از کشیدگی عضلانی است و نیازی به گرافی ندارد."
        ],
        "exp": "در کمردرد التهابی مزمن در جوانان (شک به اسپوندیلیت آنکیلوزان)، رادیوگرافی مفاصل ساکروایلیاک اقدام تشخیصی کلیدی است.",
        "micro": {
            "lead_fa": "کمردرد التهابی در جوانان با شروع تدریجی، خشکی صبحگاهی طولانی و بهبود با حرکت مشخص می‌شود. بر اساس معیارهای اصلاح‌شده نیویورک برای اسپوندیلیت آنکیلوزان، وجود ساکروایلییت رادیوگرافیک (درجه ۲ به بالا دوطرفه یا درجه ۳-۴ یک‌طرفه) برای تشخیص قطعی ضروری است. بنابراین رادیوگرافی ساده لگن روش تشخیصی اول و بسیار کمک‌کننده است. در مراحل اولیه قبل از تغییرات گرافی، MRI ساکروایلیاک ادم استخوان را نشان می‌دهد.",
            "lead_en": "In young adults presenting with chronic inflammatory back pain, standard plain radiography of the sacroiliac joints is pivotal. Documenting radiographic sacroiliitis is the cornerstone requirement under the modified New York classification criteria for ankylosing spondylitis.",
            "golden_fa": "کمردرد التهابی مزمن در مرد جوان = رادیوگرافی مفاصل ساکروایلیاک جهت اثبات ساکروایلییت اسپوندیلیت آنکیلوزان.",
            "golden_en": "Chronic inflammatory back pain in young male = sacroiliac joint radiography to establish ankylosing spondylitis.",
            "points_fa": [
                "ساکروایلییت در گرافی ساده لگن شامل بلور شدن حاشیه، اروزیون‌های دانه‌تسبیحی و اسکلروز است.",
                "در مراحل بسیار زودهنگام، ام‌آر‌آی حساس‌ترین ابزار برای کشف ساکروایلییت پیش‌رادیوگرافیک است.",
                "کمردردهای مکانیکی ساده به هیچ عنوان در هفته‌های اول نیازی به رادیوگرافی ندارند.",
                "سنجش استئوپروز منحصراً با دانسیتومتری DXA انجام می‌گیرد نه با عکس ساده مهره‌ها."
            ],
            "points_en": [
                "Sacroiliitis on pelvic radiograph manifests as subchondral sclerosis, erosions, and progressive bony ankylosis.",
                "In early non-radiographic axial spondyloarthritis, MRI is the most sensitive tool detecting active osteitis.",
                "Acute uncomplicated mechanical lumbago requires no imaging studies within the first month.",
                "Osteoporosis evaluation strictly requires dual-energy X-ray absorptiometry (DXA), not plain radiographs."
            ]
        }
    },
    11: {
        "whys": [
            "نادرست است؛ دلیل رد: آرتریت تاکایاسو واسکولیت عروق بزرگ (آئورت و شاخه‌های آن) است و کاویته ریوی و C-ANCA مثبت نمی‌دهد.",
            "صحیح است؛ تریاد بالینی: ۱) درگیری مجاری تنفسی فوقانی (سینوزیت راجعه مزمن و ترشحات خونی بینی ناشی از واسکولیت مخاطی)؛ ۲) درگیری ریوی با ندول‌ها و کاویته‌های دوطرفه در گرافی قفسه سینه؛ ۳) مثبت شدن سرولوژی «C-ANCA (آنتی‌بادی ضد پروتئیناز ۳ / PR3)» با تیتر بالا در کنار آرتریت مفاصل، تابلوی تیپیک و پاتوگنومونیک «گرانولوماتوز با پلی‌آنژیت (گرانولوماتوز وگنر / GPA)» است.",
            "نادرست است؛ دلیل رد: اگوانولوماتوز ائوزینوفیلیک (چرگ اشتراوس) با آسم شدید، ائوزینوفیلی خون بالای ۱۰٪ و P-ANCA مشخص می‌شود.",
            "نادرست است؛ دلیل رد: پلی‌آرتریت میکروسکوپیک با P-ANCA همراه است و کاویته ریوی یا درگیری گرانولوماتوز فوقانی ایجاد نمی‌کند."
        ],
        "exp": "سینوزیت خونی راجعه، کاویته‌های ریوی و سرولوژی C-ANCA مثبت، تابلوی کلاسیک گرانولوماتوز با پلی‌آنژیت (وگنر) است.",
        "micro": {
            "lead_fa": "گرانولوماتوز با پلی‌آنژیت (GPA / وگنر) یک واسکولیت نکروزان عروق کوچک با التهاب گرانولوماتوز است که به طور کلاسیک تریاد گوش و حلق و بینی، ریه و کلیه را مبتلا می‌سازد. علائم شایع: سینوزیت مقاوم، ترشح خونی بینی، سوراخ شدن تیغه بینی (دفرمیتی بینی زینی‌شکل)، تنگی ساب‌گلوتیک، و ندول‌ها و کاویته‌های ریوی. مارکر تشخیصی پاتوگنومونیک، آنتی‌بادی C-ANCA (ضد پروتئیناز-۳) با حساسیت و اختصاصیت بالای ۹۰٪ است.",
            "lead_en": "Granulomatosis with polyangiitis (GPA / Wegener's) is a necrotizing pauci-immune small-vessel vasculitis featuring granulomatous inflammation. The classic triad encompasses upper respiratory tract ulcerations/sinusitis, cavitary pulmonary nodules, and glomerulonephritis, strongly anchored by c-ANCA (anti-PR3) positivity.",
            "golden_fa": "سینوزیت و ترشح خونی بینی + کاویته‌های ریه + C-ANCA مثبت = گرانولوماتوز وگنر (GPA).",
            "golden_en": "Necrotizing sinusitis + cavitary pulmonary nodules + positive c-ANCA = Granulomatosis with Polyangiitis (GPA).",
            "points_fa": [
                "بیوپسی از مخاط بینی یا گره‌های ریه واسکولیت نکروزان گرانولوماتوز را اثبات می‌کند.",
                "درگیری کلیوی به صورت گلومرولونفریت هلال‌دار نکروزان (Pauci-immune) با نارسایی سریع کلیه همراه است.",
                "درمان استاندارد القای خاموشی در موارد شدید شامل ریتوکسیماب یا سیکلوفسفامید همراه با پالس کورتیکواستروئید است.",
                "کو-تریموکسازول (کوتریموکسازول) در پیشگیری از عود بیماری و عفونت پنوموسیستیس نقش دارد."
            ],
            "points_en": [
                "Histopathology demonstrates necrotizing granulomatous vasculitis with mixed inflammatory infiltrates.",
                "Renal disease manifests as rapidly progressive pauci-immune crescentic necrotizing glomerulonephritis.",
                "Remission induction mandates high-dose glucocorticoids combined with rituximab or cyclophosphamide.",
                "Prophylactic trimethoprim-sulfamethoxazole prevents Pneumocystis jirovecii and reduces upper airway relapse rates."
            ]
        }
    },
    12: {
        "whys": [
            "نادرست است؛ دلیل رد: FANA آزمایش بیماری‌های بافت همبند نظیر لوپوس است و در اسپوندیلوآرتریت‌ها کاربرد ندارد.",
            "صحیح است؛ وجود اولیگوآرتریت نامتقارن اندام تحتانی همراه با انتزیت تاندون آشیل (التهاب محل اتصال تاندون به استخوان) و داکتیلیت (انگشت سوسیسی) در یک مرد جوان، تابلوی قطعی «اسپوندیلوآرتریت محیطی / محوری (Spondyloarthritis)» است؛ مناسب‌ترین اقدام تشخیصی عینی، انجام «رادیوگرافی ساده مفاصل ساکروایلیاک (Sacroiliac Joint X-Ray)» جهت بررسی شواهد ساکروایلییت دوطرفه است که ملاک اصلی طبقه‌بندی این گروه بیماری‌هاست.",
            "نادرست است؛ دلیل رد: رادیوگرافی پا صرفاً تورم بافت نرم داکتیلیت را نشان می‌دهد و ارزش طبقه‌بندی تشخیصی سیستمیک ندارد.",
            "نادرست است؛ دلیل رد: HLA-B27 یک تست سرولوژیک کمکی است و به تنهایی بدون اثبات تصویربرداری ساکروایلییت تشخیصی نیست."
        ],
        "exp": "در تابلوی اولیگوآرتریت نامتقارن، انتزیت آشیل و داکتیلیت (اسپوندیلوآرتریت)، گرافی ساکروایلیاک اقدام تشخیصی کلیدی است.",
        "micro": {
            "lead_fa": "اسپوندیلوآرتروپاتی‌های سرونگاتیو شامل اسپوندیلیت آنکیلوزان، آرتریت پسوریاتیک و آرتریت راکتیو با سه ویژگی بالینی شاخص شناخته می‌شوند: اولیگوآرتریت نامتقارن اندام تحتانی، انتزیت (به‌ویژه تاندون آشیل)، و داکتیلیت. مفاصل ساکروایلیاک نقطه هدف اصلی التهاب در این خانواده بیماری‌ها هستند. رادیوگرافی مفاصل ساکروایلیاک اقدام تشخیصی اولیه برای اثبات ساکروایلییت است.",
            "lead_en": "Seronegative spondyloarthropathies characteristically feature asymmetric lower-extremity oligoarthritis, enthesitis (Achilles tendon), and dactylitis. Plain radiography of the sacroiliac joints represents the paramount initial investigation to detect sacroiliitis, establishing the diagnostic anchor.",
            "golden_fa": "اولیگوآرتریت نامتقارن پا + تاندونیت آشیل + داکتیلیت (اسپوندیلوآرتریت) = اقدام اول: رادیوگرافی ساکروایلیاک.",
            "golden_en": "Asymmetric leg arthritis + Achilles enthesitis + dactylitis (SpA) = first investigation: sacroiliac radiography.",
            "points_fa": [
                "ساکروایلییت رادیوگرافیک دوطرفه شرط لازم طبقه‌بندی بر اساس معیارهای اصلاح‌شده نیویورک است.",
                "در صورت طبیعی بودن گرافی ساده، انجام ام‌آر‌آی ساکروایلیاک جهت کشف ادم مغز استخوان فعال الزامی است.",
                "آزمایش HLA-B27 ارتباط ژنتیکی قوی دارد اما بدون شواهد التهاب ساکروایلیاک تشخیصی نیست.",
                "درمان اولیه شامل دوره‌های مداوم داروهای ضدالتهاب غیراستروئیدی (NSAIDs) با دوز کامل است."
            ],
            "points_en": [
                "Bilateral radiographic sacroiliitis is an essential classification requirement under modified New York criteria.",
                "If plain radiographs appear unremarkable, pelvic MRI detects early subchondral bone marrow edema.",
                "HLA-B27 testing provides supportive genetic risk stratification but does not supplant diagnostic imaging.",
                "Continuous full-dose NSAID regimens constitute the foundational first-line medical intervention."
            ]
        }
    },
    13: {
        "whys": [
            "نادرست است؛ دلیل رد: آزمایش ژنتیکی HLA-B27 به تنهایی بدون اثبات درگیری ساختاری ساکروایلیاک برای تشخیص کافی نیست.",
            "صحیح است؛ در یک بیمار با کمردرد مزمن یک‌ساله با ویژگی‌های بارز التهابی (خشکی صبحگاهی طولانی بیش از ۳۰ دقیقه، سن زیر ۴۵ سال)، ارزیابی تشخیصی استاندارد با «انجام گرافی ساده لگن و مفاصل ساکروایلیاک (Pelvic / Sacroiliac Radiography)» آغاز می‌شود تا وجود ساکروایلییت دوطرفه که شرط اساسی تشخیص اسپوندیلیت آنکیلوزان است اثبات گردد.",
            "نادرست است؛ دلیل رد: MRI لومبوساکرال روش روتین خط اول نیست و تنها در صورت منفی بودن گرافی لگن و شک قوی به مرحله پیش‌رادیوگرافیک به کار می‌رود.",
            "نادرست است؛ دلیل رد: آزمایشات التهابی ESR و CRP غیر اختصاصی هستند و فاکتور روماتوئید در اسپوندیلوآرتریت‌ها منفی است."
        ],
        "exp": "در کمردرد التهابی مزمن با خشکی صبحگاهی طولانی، گرافی ساده لگن جهت کشف ساکروایلییت اولین اقدام تشخیصی است.",
        "micro": {
            "lead_fa": "کمردرد التهابی با خشکی صبحگاهی طولانی و بهبود با فعالیت در مردان جوان مشخصه اسپوندیلوآرتریت محوری است. اولین گام استاندارد تصویربرداری، رادیوگرافی ساده لگن با تمرکز بر مفاصل ساکروایلیاک است. کشف شواهد ساکروایلییت دوطرفه درجه ۲ تا ۴ (اروزیون، اسکلروز ساب‌کوندرال و جوش خوردن استخوانی) طبق کرایتریای نیویورک برای اثبات قطعی بیماری اسپوندیلیت آنکیلوزان الزامی است.",
            "lead_en": "Inflammatory back pain persisting for a year in a 42-year-old male strongly implicates axial spondyloarthritis. An anteroposterior pelvic radiograph evaluating the sacroiliac joints represents the requisite initial diagnostic maneuver to establish structural sacroiliitis.",
            "golden_fa": "کمردرد مزمن با خشکی صبحگاهی طولانی در جوان = اولین اقدام تشخیصی: گرافی ساده لگن (ساکروایلیاک).",
            "golden_en": "Chronic back pain with prolonged morning stiffness in a young adult = first diagnostic test: pelvic X-ray (sacroiliac joints).",
            "points_fa": [
                "ساکروایلییت دوطرفه در گرافی ساده مشخصه بارز اسپوندیلیت آنکیلوزان اولیه است.",
                "در صورت طبیعی بودن گرافی، ام‌آر‌آی ساکروایلیاک می‌تواند فاز فعال پیش‌رادیوگرافیک را اثبات کند.",
                "ورزش‌های منظم کششی روزانه و فیزیوتراپی رکن اساسی حفظ انعطاف‌پذیری ستون فقرات هستند.",
                "مهارکننده‌های TNF در صورت شکست پاسخ به دو نوع NSAID مختلف آغاز می‌گردند."
            ],
            "points_en": [
                "Bilateral symmetric sacroiliitis on pelvic radiography is the defining hallmark of primary ankylosing spondylitis.",
                "When conventional radiographs remain normal, sacroiliac MRI detects early pre-radiographic subchondral osteitis.",
                "Daily structured spinal stretching exercises preserve long-term functional spinal mobility.",
                "Biologic TNF inhibitors are indicated upon failure of at least two consecutive NSAID trials."
            ]
        }
    },
    14: {
        "whys": [
            "نادرست است؛ دلیل رد: رادیوگرافی ساده در روزهای اول آرتریت سپتیک به جز تورم بافت نرم نکته‌ای نشان نمی‌دهد و نباید اقدام تشخیصی اصلی باشد.",
            "نادرست است؛ دلیل رد: ام‌آر‌آی زمان‌بر است و انجام آن نباید آسپیراسیون اورژانسی مفصل را به تعویق بیندازد.",
            "صحیح است؛ در یک بیمار دیابتی با مونوآرتریت حاد، گرم، اریتماتو، تب بالا (۳۹ درجه) و درد شدید زانو، تشخیص تا اثبات خلاف آن «آرتریت سپتیک حاد باکتریایی» است که یک اورژانس واقعی پزشکی محسوب می‌شود؛ اقدام تشخیصی فوری و دارای اولویت مطلق، «پونکسیون مایع مفصل (آرتروسنتز) جهت آنالیز سلولی، رنگ‌آمیزی گرم و کشت میکروبی» قبل از شروع آنتی‌بیوتیک است.",
            "نادرست است؛ دلیل رد: آزمایشات سرولوژی و فاز حاد التهاب عمومی را نشان می‌دهند اما علت مفصلی را اثبات نکرده و جایگزین مایع مفصل نیستند."
        ],
        "exp": "در مونوآرتریت حاد تب‌دار در بیمار دیابتی، پونکسیون اورژانسی زانو جهت اسمیر و کشت باکتری اقدام دارای اولویت مطلق است.",
        "micro": {
            "lead_fa": "دیابت قندی یک عامل خطر عمده برای عفونت‌های مفصلی هماتوژن به ویژه با استافیلوکوک اورئوس است. تابلوی تورم حاد، داغی، قرمزی و تب بالا در مفصل زانو اورژانس آرتریت سپتیک است. آنزیم‌های پروتئولیتیک باکتری و نوتروفیل‌ها می‌توانند غضروف مفصل را ظرف ۴۸ ساعت به طور غیرقابل برگشت نابود کنند. آرتروسنتز فوری زانو برای آنالیز کامل و کشت گام حیاتی نجات مفصل است.",
            "lead_en": "Diabetes mellitus impairs cellular immunity and significantly increases susceptibility to hematogenous pyogenic septic arthritis. A hot, erythematous, exquisitely tender swollen knee with high fever constitutes a limb-threatening emergency mandating immediate diagnostic arthrocentesis for Gram stain and culture.",
            "golden_fa": "زانو متورم، داغ و قرمز با تب ۳۹ درجه در فرد دیابتی = اورژانس آرتریت سپسیس؛ اقدام اول: پونکسیون فوری مایع مفصل.",
            "golden_en": "Hot, red, swollen knee with high fever in diabetes = septic arthritis emergency; immediate step: joint aspiration for culture.",
            "points_fa": [
                "تزریق داخل مفصلی هرگونه کورتیکواستروئید تا رد قطعی عفونت باکتریایی مطلقاً ممنوع است.",
                "شمارش گلبول سفید بالای ۵۰٬۰۰۰ در میکرولیتر با غلبه نوتروفیلی بیش از ۹۰٪ مؤید سپسیس است.",
                "آنتی‌بیوتیک تجربی وسیع‌الطیف وریدی بلافاصله پس از تخلیه مایع آغاز می‌شود.",
                "آسپیراسیون‌های مکرر روزانه یا شستشوی آرتروسکوپیک جهت تخلیه ترشحات چرکی الزامی است."
            ],
            "points_en": [
                "Intra-articular steroid instillation is strictly contraindicated prior to excluding bacterial infection.",
                "Synovial fluid leukocyte counts >50,000/μL with >90% polymorphonuclears strongly indicate sepsis.",
                "Broad-spectrum empiric intravenous antimicrobial therapy commences immediately post-aspiration.",
                "Serial daily closed-needle joint evacuations or arthroscopic lavage prevent cartilage chondrolysis."
            ]
        }
    },
    15: {
        "whys": [
            "صحیح است؛ در بیمار مبتلا به لوپوس اریتماتوی سیستمیک (آرتریت، مالار راش و فتوسنسیتیویتی)، غربالگری درگیری کلیه (نفریت لوپوسی) بر اساس معیارهای تشخیصی ACR و SLICC، با انجام «آزمایش ادرار ساده (Urinalysis / U/A)» جهت کشف پروتئینوری پایدار (بیش از 0.5 گرم در روز یا ۳+) و بررسی سدیمان فعال ادراری (هماچوری میکروسکوپی و کست‌های سلولی گلبول قرمز) انجام می‌گیرد و حساس‌ترین تست غربالگری اولیه است.",
            "نادرست است؛ دلیل رد: کراتینین و BUN تا مراحل پیشرفته آسیب عملکردی نرمال باقی می‌مانند و آسیب اولیه گلومرولی را نشان نمی‌دهند.",
            "نادرست است؛ دلیل رد: ANA مارکر عمومی خودایمنی است و اختصاصیتی برای ارزیابی درگیری بافت کلیه ندارد.",
            "نادرست است؛ دلیل رد: سونوگرافی کلیه اندازه و آناتومی را نشان می‌دهد و قادر به کشف گلومرولونفریت لوپوسی نیست."
        ],
        "exp": "آزمایش ادرار ساده (U/A) حساس‌ترین و اصلی‌ترین آزمایش غربالگری برای ارزیابی معیارهای درگیری کلیه در لوپوس است.",
        "micro": {
            "lead_fa": "نفریت لوپوسی شایع‌ترین تظاهر تهدیدکننده حیات در بیماران SLE است و در بیش از ۵۰ درصد بیماران بروز می‌کند. از آنجا که التهاب گلومرولی در مراحل اولیه کاملاً بدون علامت است، انجام آزمایش کامل ادرار (U/A) و نسبت پروتئین به کراتینین در هر ویزیت دوره‌ای اجباری است. کشف پروتئینوری یا سدیمان فعال (کست RBC) اندیکاسیون فوری بیوپسی کلیه جهت تعیین کلاس پاتولوژی است.",
            "lead_en": "Lupus nephritis represents the most frequent life-threatening organ involvement in systemic lupus erythematosus. Routine urinalysis is the indispensable screening tool to detect asymptomatic cellular casts, microscopic hematuria, and proteinuria, directing the requirement for renal biopsy.",
            "golden_fa": "غربالگری درگیری کلیه (نفریت) در بیمار لوپوسی = آزمایش ادرار ساده (U/A) جهت بررسی پروتئینوری و کست سلولی.",
            "golden_en": "Screening for lupus nephritis = routine urinalysis (U/A) to detect proteinuria and cellular casts.",
            "points_fa": [
                "پروتئینوری بیش از ۰/۵ گرم در ۲۴ ساعت یا کست‌های سلولی معیار رسمی تشخیصی درگیری کلیه در لوپوس است.",
                "سطح کراتینین سرم در مراحل اولیه نفریت لوپوسی کاملاً طبیعی است و نباید مبنای رد بیماری قرار گیرد.",
                "بیوپسی کلیه روش قطعی طبقه‌بندی نفریت (کلاس ۳ و ۴ پرولیفراتیو تهاجمی) است.",
                "کنترل فشار خون و درمان با هیدروکسی‌کلروکین بقای کلیوی را به میزان چشمگیری بهبود می‌بخشد."
            ],
            "points_en": [
                "Persistent proteinuria >0.5 g/24 hours or cellular casts fulfill standard classification criteria for lupus nephritis.",
                "Normal serum creatinine levels in early disease do not exclude severe proliferative glomerulonephritis.",
                "Percutaneous renal biopsy remains the definitive gold standard to differentiate proliferative from membranous classes.",
                "Strict blood pressure optimization and continuous hydroxychloroquine protect long-term renal survival."
            ]
        }
    },
    16: {
        "whys": [
            "نادرست است؛ دلیل رد: آزمایشات خونی التهاب عمومی را نشان می‌دهند اما برای تشخیص قطعی بهجت یا پیشگیری از کوری کمکی نمی‌کنند.",
            "نادرست است؛ دلیل رد: بیوپسی ضایعات مخاطی صرفاً ارتشاح غیراختصاصی نشان می‌دهد و تشخیصی برای بهجت نیست.",
            "صحیح است؛ در بیماری که با آفت‌های راجعه و دردناک دهانی و ژنیتال مراجعه کرده و شک قوی به «بیماری بهجت (Behçet's Disease)» وجود دارد، مهم‌ترین، فوری‌ترین و حیاتی‌ترین اقدام تشخیصی و پیشگیرانه، «مشاوره اورژانسی چشم‌پزشکی و معاینه با اسلیت لامپ از نظر یووئیت قدامی/خلفی و رتینیت» است؛ زیرا درگیری چشمی در بهجت می‌تواند بسیار بی‌سر و صدا آغاز شده و منجر به کوری دائمی و غیرقابل بازگشت گردد.",
            "نادرست است؛ دلیل رد: تست HLA-B51 صرفاً همراهی ژنتیکی را نشان می‌دهد و به تنهایی برای تشخیص بهجت کافی نیست."
        ],
        "exp": "در بیمار مشکوک به بیماری بهجت، مشاوره چشم‌پزشکی از نظر یووئیت جهت تأیید درگیری احشایی و پیشگیری از کوری حیاتی است.",
        "micro": {
            "lead_fa": "بیماری بهجت یک واسکولیت سیستمیک عروق در تمام اندازه‌هاست که مشخصه آن آفت‌های راجعه دهانی و تناسلی است. یووئیت دوطرفه (به‌ویژه یووئیت خلفی و واسکولیت عروق رتین) جدی‌ترین و ناتوان‌کننده‌ترین عارضه بهجت است که در بیش از ۵۰ تا ۷۰ درصد بیماران ایجاد شده و در غیاب درمان مناسب به سرعت به نابینایی منجر می‌شود. بنابراین ارزیابی تخصصی چشم‌پزشکی اقدام واجب در تمام مبتلایان است.",
            "lead_en": "Behçet's disease is a multi-system variable-vessel vasculitis hallmarked by recurrent bipolar aphthosis. Panuveitis and occlusive retinal vasculitis represent the most dreaded sight-threatening manifestations, demanding prompt specialist ophthalmologic slit-lamp examination to prevent irreversible blindness.",
            "golden_fa": "آفت دهان و ژنیتال (شک به بیماری بهجت) = مشاوره فوری چشم‌پزشکی از نظر یووئیت جهت پیشگیری از نابینایی.",
            "golden_en": "Oral and genital aphthae (suspected Behçet) = immediate ophthalmology consult for uveitis to prevent blindness.",
            "points_fa": [
                "تست پاترژی مثبت (ایجاد پاپول چرکی استریل ۲۴ تا ۴۸ ساعت پس از سوزن زدن پوست) ارزش تشخیصی دارد.",
                "یووئیت خلفی نیازمند درمان فوری با کورتیکواستروئید دوز بالا و داروهای سرکوب‌کننده ایمنی (آزاتیوپرین یا ضد TNF) است.",
                "زخم‌های تناسلی بر خلاف آفت‌های دهانی معمولاً با اسکار بهبود می‌یابند.",
                "ترومبوزهای وریدی عمقی (DVT) در بیماران بهجت ماهیت التهابی داشته و به ایمونوساپرسیو پاسخ می‌دهند."
            ],
            "points_en": [
                "Positive pathergy testing (sterile pustule 24-48 hours post-prick) provides supportive diagnostic specificity.",
                "Posterior uveitis and retinal vasculitis require immediate high-dose corticosteroids and azathioprine or anti-TNF biologics.",
                "Genital aphthae characteristically heal with scarring, whereas buccal aphthae typically resolve without scars.",
                "Venous thromboses in Behçet represent inflammatory endophlebitis requiring immunosuppression rather than anticoagulation alone."
            ]
        }
    },
    17: {
        "whys": [
            "نادرست است؛ دلیل رد: آرتریت روماتوئید عمدتاً مفاصل کوچک دست‌ها و مچ را متقارن درگیر می‌سازد و به ندرت با مونوآرتریت شانه آغاز می‌شود.",
            "نادرست است؛ دلیل رد: تاندونیت بای‌سپس درد قدام شانه با تست یرگاسون مثبت می‌دهد و محدودیت در تمام جهات ایجاد نمی‌کند.",
            "نادرست است؛ دلیل رد: سندرم ایمپینجمنت با قوس دردناک در ابداکسیون ۶۰-۱۲۰ درجه مشخص می‌شود و حرکات غیرفعال شانه در آن آزاد است.",
            "صحیح است؛ درد مداوم شانه در یک زن دیابتی که بیش از ۴ ماه طول کشیده و با «محدودیت حرکتی شدید و بارز هم در حرکات فعال و هم غیرفعال در تمام جهات (Global Restriction)» همراه است، پاتوگنومونیک «شانه منجمد یا کپسولیت چسبنده (Frozen Shoulder / Adhesive Capsulitis)» است؛ دیابت قندی شایع‌ترین و قوی‌ترین عامل خطر زمینه‌ای این عارضه است و استئوپنی ناشی از بی‌حرکتی در گرافی شایع است."
        ],
        "exp": "درد شانه در فرد دیابتی همراه با محدودیت حرکات در تمام جهات، تشخیص پاتوگنومونیک کپسولیت چسبنده (شانه منجمد) است.",
        "micro": {
            "lead_fa": "کپسولیت چسبنده (شانه منجمد) در افراد مبتلا به دیابت قندی شیوع بسیار بالایی (تا ۲۰ درصد) دارد. فرآیند پاتولوژیک شامل التهاب فیبروزان و انقباض پیشرونده کپسول مفصل شانه است. یافته کلیدی در معاینه فیزیکی، محدودیت همسان حرکات فعال و غیرفعال مفصل شانه در تمام سطوح حرکتی (الگوی کپسولی: چرخش خارجی > ابداکسیون > چرخش داخلی) است. رادیوگرافی ساده فضای مفصل را سالم نشان می‌دهد.",
            "lead_en": "Adhesive capsulitis (frozen shoulder) exhibits a strong epidemiological predilection for patients with diabetes mellitus. Fibroblastic contracture of the glenohumeral capsule manifests as severe, equal restriction of both active and passive motion across all cardinal planes.",
            "golden_fa": "درد شانه در فرد دیابتی + محدودیت حرکات فعال و غیرفعال در تمام جهات = کپسولیت چسبنده (Frozen shoulder).",
            "golden_en": "Shoulder pain in a diabetic patient + global active and passive restriction = adhesive capsulitis (frozen shoulder).",
            "points_fa": [
                "تزریق داخل مفصلی کورتیکواستروئید همراه با فیزیوتراپی کششی درمان اصلی است.",
                "افتراق از آسیب روتاتور کاف: در پارگی کاف حرکات غیرفعال باز است اما در کپسولیت تمام جهات قفل است.",
                "بیماری دارای سیر طبیعی طولانی (۱ تا ۲ سال) با فازهای درد، انجماد و ذوب شدن است.",
                "کنترل دقیق قند خون مانع از درگیری شانه سمت مقابل می‌شود."
            ],
            "points_en": [
                "Intra-articular glenohumeral corticosteroid injection combined with physical stretching represents first-line therapy.",
                "Differential vs rotator cuff tears: passive range is preserved in cuff tears, whereas capsulitis restricts all planes.",
                "Natural progression spans 1-2 years through freezing, frozen, and gradual thawing stages.",
                "Rigorous glycemic optimization helps prevent bilateral contralateral shoulder involvement."
            ]
        }
    },
    18: {
        "whys": [
            "نادرست است؛ دلیل رد: نیفدیپین درمان خط اول وازواسپاسم رینود است اما در پیشگیری از پیدایش زخم‌های جدید ایسکمیک کارایی اثبات‌شده قطعی ندارد.",
            "نادرست است؛ دلیل رد: لوزارتان اثرات محدودی در وازودیلاتاسیون دارد و مانع ایجاد زخم‌های جدید نمی‌شود.",
            "نادرست است؛ دلیل رد: کاپتوپریل برای پیشگیری و درمان بحران کلیوی اسکلرودرمی (SRC) کاربرد دارد نه زخم انگشتان.",
            "صحیح است؛ داروی «بوسنتان (Bosentan)» یک آنتاگونیست دوگانه گیرنده‌های اندوتلین (Endothelin Receptor Antagonist / ERA) است؛ در کارآزمایی‌های بالینی استاندارد بین‌المللی (مطالعات RAPIDS-1 و RAPIDS-2) اثبات شده است که تجویز بوسنتان به طور اختصاصی و چشمگیری «خطر پیدایش و ایجاد زخم‌های ایسکمیک جدید در انگشتان دست (Digital Ulcers)» را در بیماران مبتلا به اسکلروز سیستمیک کاهش می‌دهد."
        ],
        "exp": "داروی بوسنتان (آنتاگونیست گیرنده اندوتلین) برای پیشگیری از پیدایش زخم‌های ایسکمیک جدید انگشتان در اسکلرودرمی اندیکاسیون دارد.",
        "micro": {
            "lead_fa": "زخم‌های ایسکمیک نوک انگشتان در اسکلروز سیستمیک ناشی از واسکولوپاتی انسدادی میکروواسکولار و وازواسپاسم شدید است که بسیار دردناک بوده و مستعد عفونت و قطع عضو می‌باشند. داروی بوسنتان با مهار گیرنده‌های اندوتلین-۱ (قوی‌ترین منقبض‌کننده عروقی بدن) بازسازی عروق را تسهیل کرده و در کارآزمایی‌های معتبر ثابت شده است که از تشکیل زخم‌های انگشتی جدید تا ۵۰ درصد پیشگیری می‌کند.",
            "lead_en": "Ischemic digital ulcers in systemic sclerosis arise from proliferative obliterative vasculopathy. Bosentan, an oral dual endothelin-1 receptor antagonist, has been shown in the RAPIDS randomized trials to significantly reduce the occurrence of new digital ulcers in at-risk systemic sclerosis cohorts.",
            "golden_fa": "داروی کاهش‌دهنده خطر پیدایش زخم‌های جدید انگشتان در اسکلرودرمی = بوسنتان (آنتاگونیست اندوتلین).",
            "golden_en": "Drug reducing the incidence of new ischemic digital ulcers in scleroderma = bosentan (endothelin receptor antagonist).",
            "points_fa": [
                "بوسنتان زخم‌های قبلی را درمان نمی‌کند بلکه مانع از تشکیل زخم‌های جدید در آینده می‌شود.",
                "پایش منظم آنزیم‌های ترانس‌آمیناز کبدی (ALT/AST) ماهیانه به علت سمیت کبدی بوسنتان اجباری است.",
                "درمان زخم‌های حاد فعال موجود با آنالوگ‌های پروستاسیکلین وریدی (ایلوپروست) انجام می‌گیرد.",
                "نیفدیپین خط اول درمان وازواسپاسم پدیده رینود است."
            ],
            "points_en": [
                "Bosentan effectively prevents future new digital ulcers but does not accelerate healing of pre-existing ulcers.",
                "Monthly liver transaminase monitoring is strictly mandated due to potential dose-dependent hepatotoxicity.",
                "Active non-healing refractory ischemic ulcers are treated with intravenous prostacyclin analogs (iloprost).",
                "Dihydropyridine calcium channel blockers (nifedipine) form baseline therapy for vasospastic Raynaud phenomenon."
            ]
        }
    },
    19: {
        "whys": [
            "نادرست است؛ دلیل رد: آلوپورینول در حین حمله فعال حاد ممنوع است و کلشی‌سین در نارسایی کلیه خطر سمیت شدید دارد.",
            "نادرست است؛ دلیل رد: ایندومتاسین و تمام داروهای NSAID در نارسایی متوسط تا شدید کلیه (GFR=30) به علت خطر نارسایی حاد کلیه و خونریزی اکیداً ممنوع هستند.",
            "نادرست است؛ دلیل رد: اپیوئیدها التهاب کریستالی زمینه را سرکوب نمی‌کنند و داروی اختصاصی نقرس نیستند.",
            "صحیح است؛ در بیماری با حمله حاد مونوآرتریت نقرسی زانو که مبتلا به نارسایی کلیوی پیشرفته (GFR=30 cc/min) است، مصرف داروهای NSAID به علت سمیت کلیوی حاد و کلشی‌سین به علت سمیت عصبی-عضلانی منع مصرف دارند؛ در حضور درگیری تک‌مفصلی بزرگ با رد سپسیس (اسمیر گرم منفی)، امن‌ترین، مؤثرترین و مناسب‌ترین اقدام درمانی «تزریق داخل مفصلی کورتیکواستروئید (نظیر تریامسینولون)» است که بدون بار کلیوی به سرعت التهاب حاد را مهار می‌سازد."
        ],
        "exp": "در حمله حاد مونوآرتریت نقرس همراه با نارسایی کلیه (GFR=30)، تزریق داخل مفصلی استروئید ایمن‌ترین و مناسب‌ترین درمان است.",
        "micro": {
            "lead_fa": "درمان حمله حاد نقرس در بیماران مبتلا به نارسایی کلیوی چالش‌برانگیز است: ۱) NSAIDها به دلیل مهار پروستاگلاندین‌ها و خطر نکروز حاد توبولار ممنوع هستند؛ ۲) کلشی‌سین به دلیل تجمع دارو و خطر میوپاتی و نوروپاتی شدید در کلیه با کلیرانس پایین توصیه نمی‌شود. در مواردی که یک مفصل بزرگ (مانند زانو) درگیر است و مایع مفصل آرتروسنتز شده و سپسیس رد شده است، تزریق کورتون داخل مفصل داروی انتخابی طلایی است.",
            "lead_en": "Managing an acute gout flare in moderate-to-severe renal impairment (GFR 30 mL/min) is complicated by the nephrotoxicity of NSAIDs and the heightened toxicity risks of colchicine. In single accessible large-joint flares with confirmed sterile fluid, intra-articular corticosteroid injection provides the safest, most rapid anti-inflammatory response.",
            "golden_fa": "حمله حاد نقرس در یک مفصل با نارسایی کلیه (GFR پایین) = تزریق داخل مفصلی استروئید (پرهیز از NSAID و کلشی‌سین).",
            "golden_en": "Acute monoarticular gout flare in renal impairment = intra-articular corticosteroid injection (avoid NSAIDs/colchicine).",
            "points_fa": [
                "پردنیزولون خوراکی سیستمیک با دوز کوتاه جایگزین مناسبی در صورت ابتلای چند مفصل در نارسایی کلیه است.",
                "شروع آلوپورینول هرگز در فاز حاد حمله نقرس انجام نمی‌شود.",
                "کریستال‌های سوزنی‌شکل مونوسدیم اورات (MSU) دارای انکسار نوری منفی قوی هستند.",
                "درمان کاهنده اسید اوریک باید پس از رفع کامل علائم حاد با تنظیم دوز بر اساس GFR آغاز گردد."
            ],
            "points_en": [
                "Oral systemic prednisone is an acceptable alternative when multiple joints are involved in renal disease.",
                "Urate-lowering allopurinol must never be newly initiated during an active acute gout flare.",
                "Monosodium urate crystals display characteristic needle morphology with strong negative birefringence.",
                "Long-term urate-lowering therapy should be initiated post-flare, adjusting starting doses strictly for GFR."
            ]
        }
    },
    20: {
        "whys": [
            "نادرست است؛ دلیل رد: پردنیزولون اثری در پیشگیری از ترومبوزهای عروقی ندارد و حتی می‌تواند ریسک ترومبوز را بیفزاید.",
            "صحیح است؛ داروی «هیدروکسی‌کلروکین (Hydroxychloroquine / HCQ)» علاوه بر کنترل فعالیت عمومی لوپوس، دارای خواص آنتی‌ترومبوتیک اثبات‌شده منحصر‌به‌فردی است (شامل مهار فعال‌سازی پلاکت‌ها، مهار اتصال آنتی‌بادی‌های آنتی‌فسفولیپید به غشاها و کاهش چسبندگی گلبول‌ها)؛ در بیماران مبتلا به لوپوس دارای آنتی‌بادی‌های ضد کاردیولیپین، مصرف منظم هیدروکسی‌کلروکین «خطر بروز ترومبوزهای بعدی وریدی و شریانی را به طور معناداری کاهش می‌دهد».",
            "نادرست است؛ دلیل رد: آزاتیوپرین داروی مهارکننده ایمنی است و اثری در پیشگیری اختصاصی از ترومبوز ناشی از aPL ندارد.",
            "نادرست است؛ دلیل رد: سیکلوفسفامید در ترومبوز ساده نقشی ندارد و فقط در نفریت یا واسکولیت شدید تهدیدکننده حیات کاربرد دارد."
        ],
        "exp": "هیدروکسی‌کلروکین در بیماران مبتلا به لوپوس دارای اثرات آنتی‌ترومبوتیک بوده و احتمال ترومبوزهای بعدی را کاهش می‌دهد.",
        "micro": {
            "lead_fa": "سندرم آنتی‌فسفولیپید ثانویه در بیماران مبتلا به لوپوس شایع است و خطر ترومبوزهای عودکننده را به شدت بالا می‌برد. علاوه بر درمان ضدانعقاد استاندارد (وارفارین)، داروی هیدروکسی‌کلروکین (HCQ) اثرات محافظتی قدرتمندی در برابر ترومبوز دارد. مطالعات بالینی نشان داده‌اند که بیماران لوپوسی مصرف‌کننده هیدروکسی‌کلروکین تا بیش از ۵۰ درصد کمتر دچار حوادث ترومبوتیک وریدی و شریانی می‌شوند.",
            "lead_en": "Secondary antiphospholipid syndrome in systemic lupus erythematosus heightens venous and arterial thrombotic hazards. Hydroxychloroquine possesses distinct pleiotropic antithrombotic properties, inhibiting platelet aggregation and antiphospholipid complex formation, significantly slashing future thrombosis risks in lupus patients.",
            "golden_fa": "لوپوس + آنتی‌بادی آنتی‌کاردیولیپین و ترومبوز = تجویز هیدروکسی‌کلروکین جهت کاهش ریسک ترومبوزهای بعدی.",
            "golden_en": "Lupus + anticardiolipin antibody and DVT = hydroxychloroquine reduces the hazard of subsequent thrombotic events.",
            "points_fa": [
                "درمان فاز حاد ترومبوز شامل هپارین و سپس ضدانعقاد خوراکی طولانی‌مدت با وارفارین (هدف INR بین ۲ تا ۳) است.",
                "هیدروکسی‌کلروکین بقای کلی بیماران لوپوسی را افزایش داده و آسیب ارگان‌های احشایی را به حداقل می‌رساند.",
                "معاینه سالیانه چشم‌پزشکی برای غربالگری سمیت شبکیه هیدروکسی‌کلروکین الزامی است.",
                "آنتی‌بادی‌های آنتی‌فسفولیپید باید حداقل ۱۲ هفته بعد تکرار شوند تا حضور پایدار آن‌ها اثبات گردد."
            ],
            "points_en": [
                "Acute thrombosis mandates immediate therapeutic heparin bridged to long-term oral warfarin (target INR 2.0-3.0).",
                "Hydroxychloroquine significantly enhances overall survival and delays permanent irreversible organ accrual in SLE.",
                "Baseline and annual ophthalmologic screening ensures early detection of potential retinal toxicity.",
                "Antiphospholipid antibodies must be demonstrated positive on two occasions spaced at least 12 weeks apart."
            ]
        }
    },
    21: {
        "whys": [
            "صحیح است؛ آنتی‌بادی «Anti-Mi-2» اختصاصی بیماری درماتومیوزیت کلاسیک با ضایعات پوستی تیپیک (هلیوتروپ و پاپول گاترون) است؛ وجود این اتوآنتی‌بادی با «پاسخ درمانی بسیار عالی و سریع به کورتیکواستروئیدها، عدم همراهی با فیبروز ریوی، خطر بسیار پایین بدخیمی‌های مخفی و پیش‌آگهی درخشان و مطلوب (Favorable Prognosis)» همراه است.",
            "نادرست است؛ دلیل رد: Anti-SRP مارکر میوپاتی نکروزان با ضعف عضلانی فوق‌العاده شدید، مقاومت به درمان و پیش‌آگهی بد است.",
            "نادرست است؛ دلیل رد: Anti-dsDNA مارکر لوپوس است و ارتباطی با میوزیت و درماتومیوزیت ندارد.",
            "نادرست است؛ دلیل رد: Anti-Jo-1 مارکر سندرم آنتی‌سنتتاز همراه با بیماری شدید بینابینی ریه (ILD) و پیش‌آگهی متوسط تا ضعیف است."
        ],
        "exp": "آنتی‌بادی Anti-Mi-2 در درماتومیوزیت نشانگر پاسخ عالی به استروئیدها و پیش‌آگهی بسیار مطلوب است.",
        "micro": {
            "lead_fa": "اتوآنتی‌بادی‌های اختصاصی میوزیت (MSAs) زیرگروه‌های بالینی و پیش‌آگهی را تفکیک می‌کنند: ۱) Anti-Mi-2 با تابلوی کلاسیک درماتومیوزیت پوستی، پاسخ عالی به درمان و پیش‌آگهی خوب همراه است؛ ۲) Anti-Jo-1 (آنتی‌سنتتاز) با فیبروز ریوی، مکانیک هند و آرتروپاتی با پیش‌آگهی بینابینی همراه است؛ ۳) Anti-SRP با میوزیت نکروزان شدید مقاوم به استروئید و آتروفی عضلانی پیش‌آگهی بدی دارد؛ ۴) Anti-TIF1-gamma با خطر بالای بدخیمی همراه است.",
            "lead_en": "Myositis-specific autoantibodies stratify clinical phenotypes and prognoses in inflammatory myopathies. Anti-Mi-2 antibody is hallmarked by classic dermatomyositis cutaneous eruptions (heliotrope, Gottron sign), acute steroid responsiveness, and a favorable overall long-term prognosis.",
            "golden_fa": "درماتومیوزیت + آنتی‌بادی Anti-Mi-2 = پاسخ عالی به کورتیکواستروئیدها و پیش‌آگهی خوب و مطلوب.",
            "golden_en": "Dermatomyositis + anti-Mi-2 antibody = excellent steroid responsiveness and favorable prognosis.",
            "points_fa": [
                "راش هلیوتروپ (اریتم بنفش دور چشم‌ها) و پاپول‌های گاترون روی مفاصل انگشتان در این فرم شایع است.",
                "آنزیم‌های عضلانی (CPK و آلدولاز) به عنوان نشانگر فعالیت بیماری پایش می‌شوند.",
                "درمان اولیه شامل پردنیزولون خوراکی با دوز یک میلی‌گرم به ازای کیلوگرم وزن بدن است.",
                "متوترکسات یا آزاتیوپرین به عنوان داروی نگهدارنده پس از کاهش دوز کورتون اضافه می‌شود."
            ],
            "points_en": [
                "Heliotrope violaceous periorbital edema and Gottron papules are highly prominent in anti-Mi-2 presentations.",
                "Serial serum creatine kinase and aldolase levels objectively monitor disease activity and treatment response.",
                "Initial management relies on high-dose oral prednisone (1 mg/kg/day) with subsequent gradual tapering.",
                "Methotrexate or azathioprine serves as steroid-sparing maintenance therapy to sustain long-term remission."
            ]
        }
    },
    22: {
        "whys": [
            "نادرست است؛ دلیل رد: متالوپروتئینازهای ماتریکس (MMPs) در پاتوژنز RA شدیداً افزایش می‌یابند و ماتریکس غضروف را تجزیه می‌کنند.",
            "صحیح است (عاملی که در پاتوژنز RA دخالت ندارد)؛ در پاتوژنز آرتریت روماتوئید، سینوویوم ملتهب و سلول‌های بیگانه پانووس مقادیر بسیار زیادی از آنزیم‌های هیدرولیتیک و لیزوزیمی را ترشح می‌کنند؛ بنابراین در بافت مفصلی مبتلا به RA «افزایش آنزیم‌های لیزوزیمی» رخ می‌دهد و «کاهش» این آنزیم‌ها کاملاً نادرست بوده و در روند بیماری دخالت ندارد.",
            "نادرست است؛ دلیل رد: سایتوکین RANKL و TNF موجب تحریک و افزایش فعالیت استئوکلاست‌ها و ایجاد اروزیون‌های استخوانی می‌شوند.",
            "نادرست است؛ دلیل رد: سنتز پروستاگلاندین E2 توسط سیکلواکسیژناز-۲ در سینوویوم به شدت افزایش می‌یابد و موجب درد و التهاب می‌شود."
        ],
        "exp": "در آرتریت روماتوئید آنزیم‌های لیزوزیمی افزایش می‌یابند؛ بنابراین کاهش آنزیم‌های لیزوزیمی در پاتوژنز بیماری نقشی ندارد.",
        "micro": {
            "lead_fa": "پاتوژنز آرتریت روماتوئید بر تخریب واسطه‌گری‌شده توسط پانووس سینوویال استوار است. لنفوسیت‌های T و B با ترشح سینوویاسیت‌های شبه‌فیبروبلاستی و ماکروفاژها را تحریک می‌کنند. پیامدهای پاتولوژیک شامل: ۱) افزایش ترشح متالوپروتئینازها (MMP-1, MMP-3)؛ ۲) افزایش ترشح آنزیم‌های لیزوزیمی تخریب‌کننده پروتئوگلیکان؛ ۳) افزایش تولید پروستاگلاندین E2 ناشی از COX-2؛ ۴) تمایز و فعال‌سازی استئوکلاست‌ها از طریق محور RANK-RANKL است.",
            "lead_en": "Rheumatoid arthritis pathogenesis is driven by an invasive inflammatory synovial pannus. Synoviocytes and infiltrating leukocytes overproduce matrix metalloproteinases, lysosomal acid hydrolases, and prostaglandin E2, while upregulating osteoclastogenesis via the RANK/RANKL pathway, resulting in cartilage resorption and bone erosions.",
            "golden_fa": "در آرتریت روماتوئید ترشح آنزیم‌های لیزوزیمی، متالوپروتئینازها و استئوکلاست‌ها افزایش می‌یابد نه کاهش.",
            "golden_en": "In rheumatoid arthritis, lysosomal enzymes, matrix metalloproteinases, and osteoclasts are increased, not decreased.",
            "points_fa": [
                "سایتوکین‌های TNF-alpha و اینترلوکین-۱ محرک‌های اصلی ترشح آنزیم‌های مخرب سینوویال هستند.",
                "مهارکننده‌های TNF با سرکوب این آبشار تخریب استخوان و ماتریکس غضروف را متوقف می‌سازند.",
                "فعالیت استئوکلاست‌ها در لبه کپسول مفصلی علت پاتولوژیک اروزیون‌های حاشیه‌ای در عکس ساده است.",
                "تولید بیش از حد پروستاگلاندین E2 هدف اصلی اثر درمانی داروهای NSAID است."
            ],
            "points_en": [
                "Pro-inflammatory cytokines TNF-alpha and IL-1 are the paramount drivers of destructive enzyme synthesis.",
                "Targeted anti-TNF therapies halt the cascade of structural cartilage loss and bony erosion.",
                "Osteoclast-mediated bone resorption at capsular insertion points causes classic marginal radiographic erosions.",
                "Elevated synovial prostaglandin E2 is the therapeutic target inhibited by nonsteroidal anti-inflammatory drugs."
            ]
        }
    },
    23: {
        "whys": [
            "نادرست است؛ دلیل رد: تاندونیت روتاتور کاف دامنه حرکات غیرفعال شانه را محدود نمی‌سازد و استئوپنی منتشر نمی‌دهد.",
            "نادرست است؛ دلیل رد: بورسیت ساب‌آکرومیال محدودیت حرکات در تمام جهات ایجاد نمی‌کند.",
            "نادرست است؛ دلیل رد: در پارگی تاندون روتاتور کاف حرکات فعال مسدود است اما حرکات غیرفعال که توسط پزشک انجام می‌شود آزاد است.",
            "صحیح است؛ درد شدید شانه در طول شب در یک زن ۵۵ ساله مبتلا به دیابت همراه با «محدودیت حرکات فعال و غیرفعال مفصل در تمام جهات (Active & Passive Restricted)» و استئوپنی ناشی از عدم استفاده در رادیوگرافی، تابلوی تیپیک و پاتوگنومونیک «کپسولیت چسبنده (Adhesive Capsulitis / شانه منجمد)» است."
        ],
        "exp": "محدودیت همزمان حرکات فعال و غیرفعال در تمام جهات در یک بیمار دیابتی، تشخیص قطعی کپسولیت چسبنده است.",
        "micro": {
            "lead_fa": "کپسولیت چسبنده (شانه منجمد) ناشی از انقباض و فیبروز متراکم کپسول مفصل گلنوهومورال است. دیابت قندی شایع‌ترین عامل مستعدکننده است. تظاهر بالینی تیپیک: درد شبانه، تندرنس و مسدود شدن کامل حرکات شانه هم توسط خود بیمار (Active) و هم توسط پزشک (Passive) در تمام جهات است. عدم استفاده طولانی‌مدت از اندام موجب استئوپنی موضعی در رادیوگرافی می‌شود در حالی که فضای مفصل سالم است.",
            "lead_en": "Adhesive capsulitis (frozen shoulder) represents a chronic capsular fibrotic contracture strongly linked to diabetes mellitus. Its hallmark diagnostic feature is global, symmetrical restriction of both active and passive glenohumeral excursion across all planes, often with disuse osteopenia on plain radiographs.",
            "golden_fa": "درد شانه در فرد دیابتی + محدودیت حرکات فعال و غیرفعال شانه در تمام جهات = کپسولیت چسبنده.",
            "golden_en": "Shoulder pain in diabetes + global active and passive range of motion restriction = adhesive capsulitis.",
            "points_fa": [
                "چرخش خارجی شانه بیش از سایر جهات دچار محدودیت دردناک می‌شود.",
                "درمان شامل تزریق داخل مفصلی استروئید همراه با فیزیوتراپی کششی ملایم است.",
                "هیدرواتساع کپسول با سالین در موارد مقاوم چسبندگی‌های فیبروزه را باز می‌کند.",
                "افتراق از آسیب روتاتور کاف: در آسیب کاف حرکات غیرفعال شانه باز است اما در کپسولیت هر دو مسدود هستند."
            ],
            "points_en": [
                "External rotation is typically the most severely and early restricted motion on physical examination.",
                "Intra-articular glenohumeral corticosteroid injections paired with stretching exercises constitute standard therapy.",
                "High-volume capsular hydrodilatation physically releases fibrotic adhesions in refractory cases.",
                "Rotator cuff tears preserve passive range of motion, whereas adhesive capsulitis locks passive motion."
            ]
        }
    },
    24: {
        "whys": [
            "صحیح است؛ در بیوپسی بافت عضلانی در بیماری «درماتومیوزیت (Dermatomyositis)»، پاتولوژی محوری یک واسکولوپاتی و میکروآنژیوپاتی با واسطه کمپلکس‌های ایمنی و کمپلمان (تشکیل کمپلکس حمله به غشا MAC C5b-9) در مویرگ‌های اندومایزیوم است که منجر به «نکروز مویرگی، ترومبوز عروقی، اتساع مویرگ‌های باقی‌مانده، ارتشاح لنفوسیت‌های B و T کمکی CD4 مثبت در اطراف عروق و بافت پری‌مایزیوم، و آتروفی مشخص دور دسته‌ای (Perifascicular Atrophy)» می‌گردد.",
            "نادرست است؛ دلیل رد: در پلی‌میوزیت التهاب درون‌دسته‌ای (اندومایزیال) با غلبه لنفوسیت‌های سیتوتوکسیک CD8 مثبت است و آسیب عروقی دیده نمی‌شود.",
            "نادرست است؛ دلیل رد: رابدومیولیز حاد نکروز وسیع و حاد فیبرهای عضلانی بدون ارتشاح ایمونولوژیک لنفوسیت‌های B و CD4 است.",
            "نادرست است؛ دلیل رد: میوپاتی دارویی با واکوئولیزاسیون بدون ارتشاح التهابی سلول‌های B و CD4 مشخص می‌شود."
        ],
        "exp": "درماتومیوزیت با آسیب میکروواسکولار ناشی از کمپلمان، ارتشاح سلول‌های CD4 و B، و آتروفی پری‌فاسیکولار در بیوپسی شناخته می‌شود.",
        "micro": {
            "lead_fa": "پاتولوژی درماتومیوزیت یک میکروآنژیوپاتی با واسطه ایمنی هومورال است. کمپلکس ایمنی موجب فعال شدن کمپلمان و رسوب C5b-9 در دیواره اندوتلیوم مویرگ‌ها می‌شود که به ایسکمی موضعی، کاهش تراکم مویرگ‌ها و آتروفی دور دسته‌ای (Perifascicular atrophy) می‌انجامد. سلول‌های التهابی غالب در بافت پری‌مایزیال شامل لنفوسیت‌های B و سلول‌های T کمکی CD4+ هستند. برعکس، در پلی‌میوزیت لنفوسیت‌های سایتوتوکسیک CD8 مستقیماً به فیبرهای عضلانی حمله می‌کنند.",
            "lead_en": "Dermatomyositis is fundamentally a complement-mediated microangiopathy targeting endomysial capillaries. Deposition of the C5b-9 membrane attack complex triggers capillary necrosis, thrombosis, and secondary ischemic perifascicular myofiber atrophy, with perivascular infiltrates dominated by B cells and CD4+ T helper cells.",
            "golden_fa": "بیوپسی عضله با آسیب مویرگی، سلول‌های CD4 و B cell، و آتروفی دور دسته‌ای = درماتومیوزیت.",
            "golden_en": "Muscle biopsy showing microvascular thrombosis, CD4+ T cells, B cells, and perifascicular atrophy = dermatomyositis.",
            "points_fa": [
                "آتروفی فیبرهای عضلانی در حاشیه دسته‌ها (Perifascicular atrophy) پاتوگنومونیک درماتومیوزیت است.",
                "پلی‌میوزیت ناشی از تهاجم سلولی CD8+ T مستقیم به فیبرهای عضلانی با MHC-I بالا است.",
                "درمان اولیه شامل پردنیزولون خوراکی با دوز بالا (یک میلی‌گرم به ازای کیلوگرم) است.",
                "در تمام بالغین مبتلا به درماتومیوزیت غربالگری دقیق بدخیمی‌های مخفی اجباری است."
            ],
            "points_en": [
                "Perifascicular muscle fiber atrophy is a pathognomonic histopathological hallmark of dermatomyositis.",
                "Polymyositis involves direct antigen-driven cytotoxic CD8+ T-cell invasion of non-necrotic myofibers.",
                "High-dose systemic glucocorticoids (prednisone 1 mg/kg/day) form the foundational first-line therapy.",
                "Comprehensive age- and gender-appropriate oncologic screening is mandatory in all adult dermatomyositis cases."
            ]
        }
    },
    25: {
        "whys": [
            "نادرست است؛ دلیل رد: تزریق استروئید داخل مفصلی در حضور تب بالا و لکوپنی و شک به آرتریت سپسیس اکیداً ممنوع و فاجعه‌بار است.",
            "صحیح است؛ در بیماری که با مونوآرتریت حاد، گرم، متورم و تندر در مفصل زانو، تب ۳۸/۷ درجه، لکوسیتوز با غلبه نوتروفیلی ۹۰٪، CRP بالا و سابقه مصرف هیدروکلروتیازید مراجعه کرده است، گرچه نقرس نیز با مصرف تیازید مطرح است اما به دلیل وجود تب و علائم سیستمیک، تشخیص اورژانس مرگ‌بار «آرتریت سپتیک باکتریایی» در اولویت نخست قرار دارد؛ اقدام استاندارد واجب، «انجام فوری پونکسیون مفصلی (آرتروسنتز) جهت اسمیر گرم، بررسی کریستال و کشت و شروع بلافاصله آنتی‌بیوتیک تجربی وریدی» است.",
            "نادرست است؛ دلیل رد: چک کردن اسید اوریک و شروع آلوپورینول در فاز حاد ممنوع است و جان بیمار را در صورت سپسیس به خطر می‌اندازد.",
            "نادرست است؛ دلیل رد: پونکسیون مستقیم خود مفصل زانو اقدام کلیدی است و نباید به کشت ادرار و خون موکول شود."
        ],
        "exp": "در مونوآرتریت حاد داغ و قرمز همراه با تب، پونکسیون فوری زانو جهت اسمیر و کشت و شروع سریع آنتی‌بیوتیک وریدی الزامی است.",
        "micro": {
            "lead_fa": "در مواجهه با مونوآرتریت حاد با علائم التهابی شدید و تب، نخستین وظیفه پزشک رد آرتریت سپسیس است، حتی اگر بیمار فاکتورهای خطر نقرس (نظیر مصرف هیدروکلروتیازید) داشته باشد؛ زیرا آرتریت چرکی و نقرس حاد می‌توانند تابلوی بالینی کاملاً یکسانی ایجاد کنند و حتی همزمان رخ دهند. آرتروسنتز اورژانسی برای اسمیر و کشت باکتری و مشاهده کریستال‌های اورات باید فوراً انجام شده و آنتی‌بیوتیک وریدی آغاز گردد.",
            "lead_en": "Acute hot monoarthritis presenting with systemic fever and neutrophil leukocytosis is a medical emergency requiring the immediate exclusion of bacterial septic arthritis. Even when clinical risk factors for gout exist, emergency arthrocentesis for Gram stain, crystal analysis, and culture must precede empiric intravenous antibiotic therapy.",
            "golden_fa": "مونوآرتریت حاد زانو با تب ۳۸/۷ درجه = اورژانس آرتریت سپسیس؛ اقدام: پونکسیون مفصل برای کشت + آنتی‌بیوتیک وریدی.",
            "golden_en": "Acute monoarthritis with high fever = septic arthritis emergency; immediate step: arthrocentesis for culture + IV antibiotics.",
            "points_fa": [
                "تزریق داخل مفصلی کورتیکواستروئید قبل از رد قطعی باکتری‌ها خطای فاحش پزشکی است.",
                "شمارش گلبول سفید سینوویال بالای ۵۰٬۰۰۰ در میکرولیتر نشانه قطعی عفونت باکتریایی است.",
                "پوشش آنتی‌بیوتیکی تجربی معمولاً استافیلوکوک اورئوس و باسیل‌های گرم منفی را هدف می‌گیرد.",
                "بررسی همزمان میکروسکوپ پلاریزان جهت رد یا اثبات کریستال‌های نقرس انجام می‌شود."
            ],
            "points_en": [
                "Intra-articular corticosteroid infiltration prior to ruling out infection causes catastrophic joint destruction.",
                "Synovial fluid leukocyte count >50,000/μL with >90% neutrophils strongly confirms bacterial joint infection.",
                "Empiric intravenous antibiotic regimens must cover Staphylococcus aureus and gram-negative bacilli.",
                "Simultaneous compensated polarized light microscopy evaluates for concurrent monosodium urate crystals."
            ]
        }
    },
    26: {
        "whys": [
            "نادرست است؛ دلیل رد: آزمایش ASO برای تب روماتیسمی است و در دردهای ژنرالیزه مزمن زن ۵۵ ساله هیچ کاربردی ندارد.",
            "صحیح است؛ بیمار تابلوی کلاسیک «سندرم فیبرومیالژی (Fibromyalgia)» را دارد (درد اسکلتی-عضلانی ژنرالیزه منتشر بیش از ۳ ماه، خستگی، اختلال خواب و حساسیت منتشر در لمس بدون هیچ‌گونه شواهدی از افیوژن یا التهاب مفصلی)؛ از آنجا که فیبرومیالژی یک تشخیص ردّی (Diagnosis of Exclusion) است، مهم‌ترین و ضروری‌ترین آزمایشات اولیه برای رد بیماری‌های التهابی سیستمیک پنهان (به‌ویژه پلی‌میالژیا روماتیکا PMR)، «اندازه‌گیری نشانگرهای فاز حاد التهابی ESR و CRP» است که در فیبرومیالژی کاملاً نرمال هستند.",
            "نادرست است؛ دلیل رد: آزمایشات RF و Anti-CCP برای آرتریت روماتوئید است که در غیاب سینوویت و افیوژن مفصلی اندیکاسیون ندارد.",
            "نادرست است؛ دلیل رد: ANA در غیاب نشانه‌های بالینی لوپوس صرفاً مثبت کاذب ایجاد کرده و توصیه نمی‌شود."
        ],
        "exp": "در بیمار مشکوک به فیبرومیالژی، سنجش ESR و CRP برای رد بیماری‌های التهابی سیستمیک (نظیر پلی‌میالژیا روماتیکا) ضروری است.",
        "micro": {
            "lead_fa": "فیبرومیالژی شایع‌ترین علت درد اسکلتی-عضلانی منتشر در زنان میانسال است که ناشی از اختلال در پردازش مرکزی حس درد (Central Sensitization) می‌باشد. ویژگی‌های بالینی: درد ژنرالیزه هر دو طرف بدن بالا و پایین دیافراگم، خستگی مزمن، خواب ناکافی و نقاط حساس تندر بدون افیوژن مفصلی. تمام آزمایشات خونی در فیبرومیالژی نرمال هستند؛ بررسی ESR و CRP برای رد پلی‌میالژیا روماتیکا و میوپاتی‌ها گام اولیه استاندارد است.",
            "lead_en": "Fibromyalgia represents a chronic generalized nociplastic pain syndrome driven by central sensitization. Characterized by widespread musculoskeletal aching, unrefreshing sleep, fatigue, and widespread soft tissue tenderness without articular swelling, standard evaluation requires testing ESR and CRP to rule out occult inflammatory conditions.",
            "golden_fa": "درد منتشر بدن + خستگی و اختلال خواب بدون تورم مفصل = شک به فیبرومیالژی؛ اقدام اولیه: سنجش ESR و CRP.",
            "golden_en": "Widespread pain + fatigue without joint effusion = suspect fibromyalgia; initial test: normal ESR and CRP to rule out PMR.",
            "points_fa": [
                "نشانگرهای فاز حاد (ESR و CRP) در فیبرومیالژی کاملاً در محدوده طبیعی هستند.",
                "درمان‌های غیردارویی شامل ورزش‌های هوازی ملایم، شنا و درمان شناختی-رفتاری (CBT) خط اول هستند.",
                "داروهای مورد تأیید شامل مهارکننده‌های بازجذب سروتونین-نوراپی‌نفرین (دولوکستین) و پره‌گابالین هستند.",
                "داروهای مسکن اپیوئیدی در فیبرومیالژی کاملاً بی‌اثر بوده و منع مصرف دارند."
            ],
            "points_en": [
                "Acute-phase reactants (ESR and CRP) are characteristically entirely normal in primary fibromyalgia.",
                "Non-pharmacologic management emphasizing low-impact aerobic exercise, hydrotherapy, and CBT forms first-line care.",
                "FDA-approved pharmacological options include duloxetine, milnacipran, and pregabalin.",
                "Opioid analgesics are strictly contraindicated due to inefficacy and risk of opioid-induced hyperalgesia."
            ]
        }
    },
    27: {
        "whys": [
            "نادرست است؛ دلیل رد: آرتریت روماتوئید به طور کلاسیک مفاصل DIP را سالم می‌گذارد و تمایل به مفاصل MCP و PIP دارد.",
            "نادرست است؛ دلیل رد: بیماری لوپوس باعث آرتروپاتی غیرتخریبی مفاصل دست می‌شود و تظاهر مونو یا اولیگوآرتریت ایزوله DIP ندارد.",
            "صحیح است؛ درگیری اختصاصی، متورم و دردناک «مفاصل بین انگشتی دیستال (DIP Joints)» در یک مرد میانسال، در درجه اول و پیش از هر بیماری دیگر مطرح‌کننده «آرتریت پسوریازیسی (Psoriatic Arthritis)» است؛ ابتلای مفاصل DIP از نشانه‌های پاتوگنومونیک آرتریت پسوریاتیک است که اغلب با پیتینگ و تغییرات ناخنی همراه بوده و در تشخیص افتراقی با استئوآرتریت مفاصل DIP قرار می‌گیرد.",
            "نادرست است؛ دلیل رد: بیماری بهجت با آرتریت مفاصل بزرگ (زانو و مچ پا) تظاهر می‌کند و مفاصل DIP را گرفتار نمی‌سازد."
        ],
        "exp": "درگیری التهابی مفاصل بین انگشتی دیستال (DIP) در درجه اول مطرح‌کننده بیماری آرتریت پسوریازیسی است.",
        "micro": {
            "lead_fa": "مفاصل DIP دست‌ها در اکثر بیماری‌های التهابی خودایمنی (به‌ویژه آرتریت روماتوئید و لوپوس) درگیر نمی‌شوند. درگیری مفاصل اینترفالانژیال دیستال دو تشخیص افتراقی اصلی دارد: ۱) استئوآرتریت ندولار (گره‌های هبردن با درد مکانیکی و بدون شواهد التهاب شدید)؛ ۲) آرتریت پسوریازیسی (التهاب فعال سینوویال، داکتیلیت و تغییرات ناخن). بنابراین در یک مرد با آرتریت التهابی مفاصل DIP، آرتریت پسوریاتیک در صدر احتمالات است.",
            "lead_en": "Inflammatory involvement of the distal interphalangeal (DIP) joints is a hallmark of psoriatic arthritis, a site characteristically spared by rheumatoid arthritis and systemic lupus erythematosus. DIP synovitis is tightly linked to psoriatic nail dystrophy due to the close anatomic continuity between the nail matrix and extensor enthesis.",
            "golden_fa": "تورم و درد التهابی مفاصل اینترفالانژیال دیستال (DIP) = در درجه اول آرتریت پسوریازیسی.",
            "golden_en": "Inflammatory arthritis of distal interphalangeal (DIP) joints = primarily psoriatic arthritis.",
            "points_fa": [
                "معاینه دقیق خط رویش مو، ناف و ناحیه نشیمنگاه برای کشف پلاک‌های مخفی پسوریازیس ضروری است.",
                "تغییرات ناخنی نظیر پیتینگ، لکه روغنی و اونیکولیز در کنار درگیری DIP بسیار شایع است.",
                "در گرافی ساده انگشتان، اروزیون‌های استخوانی همراه با تشکیل استخوان جدید و نمای مداد در فنجان دیده می‌شود.",
                "آزمایشات RF و Anti-CCP در آرتریت پسوریازیسی منفی هستند."
            ],
            "points_en": [
                "Careful clinical inspection of scalp, umbilicus, and gluteal cleft uncovers hidden plaque psoriasis.",
                "Psoriatic nail changes (pitting, oil-drop discoloration, onycholysis) correlate tightly with DIP disease.",
                "Plain hand radiography shows concurrent erosion and bone proliferation, culminating in 'pencil-in-cup' changes.",
                "Rheumatoid factor and anti-CCP autoantibodies are characteristically negative in psoriatic arthritis."
            ]
        }
    },
    28: {
        "whys": [
            "صحیح است؛ تابلوی بالینی درد حاد شکمی، تهوع و استفراغ، آرتریت یا آرترالژی مفصل زانو، و ضایعات پوستی «پورپورای قابل لمس (Palpable Purpura)» بدون ترومبوسیتوپنی در اندام تحتانی در یک پسربچه ۱۰ ساله، تظاهر کلاسیک و پاتوگنومونیک «واسکولیت هنوخ شوئن‌لاین (Henoch-Schönlein Purpura / واسکولیت IgA)» است که شایع‌ترین واسکولیت سیستمیک دوران کودکی محسوب می‌شود.",
            "نادرست است؛ دلیل رد: چرگ اشتراوس واسکولیت همراه با آسم و ائوزینوفیلی شدید در بزرگسالان است.",
            "نادرست است؛ دلیل رد: گرانولوماتوز وگنر با سینوزیت نکروزان، کاویته‌های ریوی و C-ANCA مثبت تظاهر می‌کند نه پورپورای اطفال.",
            "نادرست است؛ دلیل رد: بیماری کاوازاکی با تب بیش از ۵ روز، تغییرات لب و زبان توت‌فرنگی، کونژونکتیویت و آنوریسم عروق کرونر مشخص می‌شود."
        ],
        "exp": "پورپورای قابل لمس، دردهای شکمی و آرتریت زانو در کودک ۱۰ ساله، تابلوی تیپیک واسکولیت هنوخ شوئن‌لاین (IgA) است.",
        "micro": {
            "lead_fa": "واسکولیت هنوخ شوئن‌لاین (HSP / IgA Vasculitis) شایع‌ترین واسکولیت عروق کوچک در کودکان است که در اثر رسوب کمپلکس‌های ایمنی حاوی IgA1 ایجاد می‌شود. بیماری اغلب به دنبال یک عفونت تنفسی فوقانی رخ می‌دهد. تتراد بالینی کلاسیک شامل: ۱) پورپورای قابل لمس غیرترومبوسیتوپنیک در باسن و اندام تحتانی؛ ۲) دردهای کولیکی شکم و خونریزی گوارشی؛ ۳) آرتریت گذرا بدون آسیب دائمی؛ ۴) نفریت با هماچوری و پروتئینوری است.",
            "lead_en": "Henoch-Schönlein purpura (IgA vasculitis) is the most common pediatric systemic small-vessel vasculitis. Driven by tissue deposition of IgA1-dominant immune complexes, its cardinal clinical tetrad includes palpable leukocytoclastic purpura over lower extremities, colicky abdominal pain, transient non-migratory arthritis, and glomerulonephritis.",
            "golden_fa": "کودک با پورپورای قابل لمس اندام تحتانی + درد شکم + آرتریت = واسکولیت هنوخ شوئن‌لاین (HSP).",
            "golden_en": "Child with lower-extremity palpable purpura + abdominal pain + arthritis = Henoch-Schönlein purpura (IgA vasculitis).",
            "points_fa": [
                "تعداد پلاکت‌های خون در پورپورای هنوخ شوئن‌لاین کاملاً طبیعی یا افزایش‌یافته است.",
                "درد شدید شکمی می‌تواند عارضه خطرناک درهم‌فرورفتگی روده (انواژیناسیون / Intussusception) را ایجاد کند.",
                "پیش‌آگهی درازمدت بیماری منحصراً توسط شدت درگیری کلیوی (نفریت IgA) تعیین می‌شود.",
                "درمان حمایتی است؛ در دردهای شدید گوارشی کورتیکواستروئید خوراکی تجویز می‌گردد."
            ],
            "points_en": [
                "Platelet count is characteristically normal or elevated, ruling out thrombocytopenic purpuras.",
                "Severe abdominal pain raises high suspicion for secondary ileo-ileal or ileocolic intussusception.",
                "Long-term pediatric prognosis is governed entirely by the extent and progression of renal disease.",
                "Management is largely supportive, utilizing oral systemic corticosteroids for severe abdominal pain."
            ]
        }
    },
    29: {
        "whys": [
            "نادرست است؛ دلیل رد: آرتریت روماتوئید بیماری التهابی مزمن با خشکی صبحگاهی طولانی بیش از یک ساعت است و درد آن با فعالیت بهتر می‌شود نه بدتر.",
            "صحیح است؛ سن ۶۲ سالگی در یک خانم با چاقی مفرط (BMI=40)، درد مکانیکی زانوها از ۵ سال قبل که با فعالیت بیشتر شده و با استراحت تسکین می‌یابد، خشکی صبحگاهی کوتاه ۱۵ دقیقه‌ای (پدیده ژل)، تغییر شکل ژنوواروم (زانوی پرانتزی به علت باریک شدن کمپارتمنت داخلی) و محدودیت حرکتی، تابلوی کلاسیک و قطعی «استئوآرتریت زانو (Knee Osteoarthritis)» است.",
            "نادرست است؛ دلیل رد: آرتریت کریستالی به صورت حملات حاد ناگهانی، بسیار دردناک و داغ مونوآرتیکولار رخ می‌دهد نه درد مکانیکی پیشرونده ۵ ساله.",
            "نادرست است؛ دلیل رد: آرتریت راکتیو بیماری التهابی حاد در جوانان پس از عفونت با درگیری نامتقارن و انتزیت است."
        ],
        "exp": "درد مکانیکی زانوها با خشکی صبحگاهی کوتاه ۱۵ دقیقه‌ای و دفرمیتی ژنوواروم در خانم چاق مسن، مشخصه استئوآرتریت است.",
        "micro": {
            "lead_fa": "استئوآرتریت شایع‌ترین بیماری دژنراتیو مفصلی در جهان است که به شدت با چاقی، جنس مؤنث و افزایش سن همراهی دارد. اضافه وزن بار تحمیل‌شده بر کمپارتمنت مدیال زانو را افزایش داده و موجب تخریب تدریجی غضروف و ایجاد دفرمیتی ژنوواروم (زانوی پرانتزی) می‌شود. درد ماهیت مکانیکی داشته (تشدید با راه رفتن و پله و بهبود با استراحت) و خشکی صبحگاهی کمتر از ۳۰ دقیقه است.",
            "lead_en": "Knee osteoarthritis is the archetype of degenerative weight-bearing arthropathy, profoundly amplified by severe obesity and female sex. Progressive loss of medial compartment cartilage produces classical genu varum malalignment, mechanical loading pain relieved by rest, and transient morning gel phenomenon lasting under 30 minutes.",
            "golden_fa": "درد مکانیکی زانوها + خشکی صبحگاهی کوتاه + چاقی و زانوی پرانتزی = استئوآرتریت زانو.",
            "golden_en": "Mechanical knee pain + transient morning stiffness + obesity and genu varum = knee osteoarthritis.",
            "points_fa": [
                "کاهش وزن مهم‌ترین مداخله اصلاحی غیردارویی جهت کاهش بار فشاری بر مفصل زانو است.",
                "ورزش‌های تقویتی عضله چهارسر ران (کوادری‌سپس) ثبات بیومکانیکال زانو را تقویت می‌نمایند.",
                "NSAIDهای موضعی خط اول درمان دارویی علامتی به دلیل ایمنی عالی هستند.",
                "عکس رادیوگرافی در حالت ایستاده باریک شدن فضای داخلی، اسکلروز ساب‌کوندرال و استئوفیت‌ها را نشان می‌دهد."
            ],
            "points_en": [
                "Weight loss represents the most effective lifestyle intervention reducing compressive joint loads.",
                "Quadriceps isometric strengthening exercises stabilize tibiofemoral tracking and alleviate symptoms.",
                "Topical NSAIDs are the preferred first-line pharmacotherapy due to minimal systemic absorption.",
                "Weight-bearing plain radiography demonstrates medial compartment narrowing, subchondral sclerosis, and osteophytes."
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
    for idx, enrich in ENRICHMENTS_BATCH1.items():
        if idx >= len(questions):
            print(f"Warning: Index {idx} out of range!")
            continue

        q = questions[idx]
        # PER USER DIRECTIVE: question_fa and options_fa are PRESERVED EXACTLY AS ORIGINAL.
        q["options_why_fa"] = enrich["whys"]
        q["explanation_fa"] = enrich["exp"]
        if "micro" in enrich:
            q["micro"] = enrich["micro"]

        enriched_count += 1

    with open(PAYLOAD_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Successfully enriched {enriched_count} questions in {PAYLOAD_PATH} while preserving original stems and options.")


if __name__ == "__main__":
    main()
