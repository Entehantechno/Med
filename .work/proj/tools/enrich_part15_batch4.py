#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enrichment script for Part 15 Batch 4 (Questions 90 to 119)
Target payload: work/tools/master-bank/import-payload.master-preint.part15.json
Note: Per user instructions, question_fa and options_fa are preserved exactly as original.
Only options_why_fa, explanation_fa, and micro are enriched.
"""

import json
import sys

PAYLOAD_PATH = "work/tools/master-bank/import-payload.master-preint.part15.json"

ENRICHMENTS_BATCH4 = {
    90: {
        "whys": [
            "نادرست است؛ دلیل رد: کلشی‌سین داروی استاندارد و خط اول ضدالتهابی در حمله حاد نقرس است.",
            "صحیح است (دارویی که تجویز نمی‌شود)؛ شروع داروی کاهنده اسید اوریک «آلوپورینول (Allopurinol)» در طی فاز فعال حمله حاد آرتریت نقرسی مطلقاً ممنوع است؛ زیرا تغییرات و نوسانات ناگهانی سطح اورات در مایع سینوویال موجب حل شدن سطحی کریستال‌ها، آزاد شدن آنتی‌ژنیک آن‌ها و «تشدید و طولانی شدن شدید حمله حاد التهابی» می‌گردد؛ درمان با آلوپورینول باید حداقل ۲ تا ۳ هفته پس از فرونشست کامل حمله آغاز شود.",
            "نادرست است؛ دلیل رد: ایندومتاسین و سایر NSAIDها از داروهای خط اول درمان حمله حاد نقرس هستند.",
            "نادرست است؛ دلیل رد: کورتیکواستروئیدها (پردنیزولون) خط اول ضدالتهابی در درمان فاز حاد نقرس هستند."
        ],
        "exp": "شروع آلوپورینول در فاز حاد حمله نقرس ممنوع است زیرا نوسان سطح اورات حمله را تشدید و طولانی می‌کند.",
        "micro": {
            "lead_fa": "در مدیریت بالینی حمله حاد آرتریت نقرسی، تفکیک درمان ضدالتهاب حاد از درمان کاهنده اسید اوریک (ULT) حیاتی است. در فاز حاد، هدف تنها مهار التهاب با کلشی‌سین، NSAIDs یا گلوکوکورتیکوئیدها است. شروع داروی آلوپورینول در اواسط حمله حاد سبب جابجایی کریستال‌های اورات و تشدید طوفان سایتوکاینی می‌شود. البته اگر بیمار از قبل تحت درمان مزمن با آلوپورینول بوده باشد، دارو در حین حمله قطع نمی‌گردد.",
            "lead_en": "Acute gouty arthritis management strictly prioritizes anti-inflammatory agents (colchicine, NSAIDs, or systemic corticosteroids) to quell neutrophilic inflammation. Initiating urate-lowering therapy with allopurinol during an acute paroxysm is contraindicated because abrupt fluctuations in serum urate destabilize micro-tophi, prolonging and intensifying the attack.",
            "golden_fa": "در حمله حاد نقرس شروع آلوپورینول ممنوع است؛ درمان حاد فقط شامل کلشی‌سین، NSAID یا کورتون است.",
            "golden_en": "Never initiate allopurinol during an acute gout flare; acute therapy is restricted to colchicine, NSAIDs, or steroids.",
            "points_fa": [
                "درمان کاهنده اسید اوریک (آلوپورینول) ۲ تا ۴ هفته پس از برطرف شدن کامل فاز حاد شروع می‌شود.",
                "در صورت شروع آلوپورینول، کلشی‌سین پروفیلاکسی با دوز پایین به مدت ۳ تا ۶ ماه همراه آن تجویز می‌گردد.",
                "اگر بیمار قبلاً آلوپورینول مصرف می‌کرده، دوز آن در حین حمله حاد دست‌نخورده باقی می‌ماند.",
                "هدف درمانی سطح اسید اوریک سرم رسیدن به ارقام زیر ۶ میلی‌گرم در دسی‌لیتر است."
            ],
            "points_en": [
                "Urate-lowering therapy with allopurinol should be delayed 2 to 4 weeks following complete flare resolution.",
                "Concomitant low-dose colchicine flare prophylaxis is mandatory for the first 3 to 6 months of allopurinol.",
                "If a flare strikes a patient already taking allopurinol maintenance, the dose is maintained without interruption.",
                "Target serum uric acid levels are set below 6 mg/dL (or <5 mg/dL in severe tophaceous disease)."
            ]
        }
    },
    91: {
        "whys": [
            "نادرست است؛ دلیل رد: سابقه مصرف کورتیکواستروئید پرچم قرمز (Red Flag) برای شکستگی مهره‌ای ناشی از پوکی استخوان است.",
            "نادرست است؛ دلیل رد: سابقه ابتلا به سرطان پرچم قرمز اصلی برای متاستاز استخوانی به ستون فقرات است.",
            "نادرست است؛ دلیل رد: وجود تب و کاهش وزن پرچم قرمز هشداردهنده برای عفونت (اسپوندیلودیسکیت) یا بدخیمی است.",
            "صحیح است (عاملی که جزء پرچم‌های قرمز خطرساز کمردرد نیست)؛ «سن کمتر از ۴۰ سال» به عنوان پرچم قرمز برای کمردردهای خطرناک ثانویه (سرطان، شکستگی، عفونت) محسوب نمی‌شود؛ در واقع سنین بالای ۵۰ سال فاکتور خطر جدی هستند؛ (تنها استثنا کمردرد التهابی و اسپوندیلیت آنکیلوزان است که سن شروع زیر ۴۰ تا ۴۵ سال دارد، اما در ارزیابی پرچم‌های قرمز خطرساز پاتولوژی‌های تهدیدکننده ستون فقرات، سن کمتر از ۴۰ فاکتور خطر نیست)."
        ],
        "exp": "سن زیر ۴۰ سال جزء پرچم‌های قرمز خطرساز کمردرد (نظیر سابقه بدخیمی، مصرف کورتون، تب و کاهش وزن) نیست.",
        "micro": {
            "lead_fa": "علائم هشداردهنده یا پرچم‌های قرمز (Red Flags) در ارزیابی کمردرد نشانگر وجود پاتولوژی‌های زمینه‌ای خطرناک نظیر سرطان، شکستگی استخوانی و عفونت هستند. مهم‌ترین رد فلگ‌ها عبارتند از: سابقه سرطان قبلی، کاهش وزن غیرقابل توجیه، تب و لرز، سابقه مصرف طولانی کورتیکواستروئیدها، بی‌اختیاری ادرار یا مدفوع (سندرم دم اسب)، نقص عصبی پیشرونده و سن بالای ۵۰ سال. سن زیر ۴۰ سال فاکتور خطرساز محسوب نمی‌شود.",
            "lead_en": "Red flag clinical indicators in low back pain identify life-threatening etiologies including spinal malignancy, vertebral osteomyelitis, and pathologic insufficiency fractures. Critical red flags encompass a history of cancer, unexplained weight loss, fever, chronic corticosteroid use, age >50 years, and cauda equina symptoms; age <40 years is not a red flag.",
            "golden_fa": "پرچم‌های قرمز کمردرد: سابقه سرطان، مصرف کورتون، تب، کاهش وزن و سن > ۵۰ سال؛ سن < ۴۰ پرچم قرمز نیست.",
            "golden_en": "Low back pain red flags: malignancy history, corticosteroids, fever, weight loss, age >50; age <40 is not a red flag.",
            "points_fa": [
                "سابقه بدخیمی قبلی قوی‌ترین پرچم قرمز با بالاترین ارزش اخباری مثبت برای متاستاز مهره‌ای است.",
                "مصرف کورتون ریسک شکستگی فشاری مهره را حتی با ترومای خفیف به شدت افزایش می‌دهد.",
                "سندرم دم اسب (احتباس ادرار، بی‌حسی زینی‌شکل) یک اورژانس جراحی اورژانسی نوروسرجری است.",
                "کمردردهای مکانیکی ساده در غیاب پرچم‌های قرمز نیازی به عکس‌برداری یا ام‌آر‌آی در ۴ تا ۶ هفته اول ندارند."
            ],
            "points_en": [
                "A previous personal history of malignancy carries the highest positive likelihood ratio for spinal metastasis.",
                "Systemic corticosteroid exposure substantially accelerates trabecular bone loss, precipitating compression fractures.",
                "Cauda equina syndrome (urinary retention, saddle anesthesia) constitutes an absolute emergent surgical crisis.",
                "Uncomplicated acute mechanical low back pain devoid of red flags warrants no routine imaging in the first 4-6 weeks."
            ]
        }
    },
    92: {
        "whys": [
            "صحیح است؛ داروی «هیدروکسی‌کلروکین (Hydroxychloroquine)» در مصرف طولانی‌مدت می‌تواند در سلول‌های اپیتلیوم رنگدانه‌دار شبکیه رسوب کرده و «رتینوپاتی سمی غیرقابل برگشت با الگوی چشم گاوی (Bull's Eye Retinopathy)» ایجاد نماید؛ طبق تمام راهنماهای آکادمی چشم‌پزشکی (AAO)، انجام معاینه پایه‌ای چشم در شروع دارو و سپس «معاینات چشم‌پزشکی سالانه با آزمون‌های میدان بینایی و OCT» از سال پنجم (یا زودتر در حضور ریسک‌فاکتورها) توصیه اکید می‌گردد.",
            "نادرست است؛ دلیل رد: پردنیزولون آب‌مروارید خلفی و گلوکوم ایجاد می‌کند اما غربالگری روتین سالانه رتینوپاتی مدنظر سؤال مربوط به هیدروکسی‌کلروکین است.",
            "نادرست است؛ دلیل رد: آزاتیوپرین سمیت چشمی شناخته‌شده‌ای که نیازمند معاینه روتین سالانه باشد ندارد.",
            "نادرست است؛ دلیل رد: ناپروکسن عوارض چشمی اختصاصی روتین ندارد."
        ],
        "exp": "معاینه سالانه چشم‌پزشکی (OCT و میدان بینایی) برای پایش رتینوپاتی سمی ناشی از هیدروکسی‌کلروکین ضروری است.",
        "micro": {
            "lead_fa": "هیدروکسی‌کلروکین سنگ‌بنای درمان لوپوس اریتماتوی سیستمیک است که بقای بیماران را افزایش می‌دهد اما عارضه نادر و خطیر آن سمیت شبکیه (Retinal toxicity) است. تجمع دارو در ماکولا منجر به آسیب جبران‌ناپذیر فوتورسپتورها و ماکولوپاتی طرح چشم گاوی (Bull's eye maculopathy) با کوری مرکزی می‌شود. آکادمی چشم‌پزشکی آمریکا غربالگری با میدان بینایی خودکار (Automated Visual Field 10-2) و OCT با وضوح بالا (SD-OCT) را توصیه می‌کند.",
            "lead_en": "Hydroxychloroquine is the cornerstone therapeutic agent in SLE, but long-term cumulative dosing risks irreversible retinal pigment epithelial toxicity (bull's-eye maculopathy). The American Academy of Ophthalmology mandates baseline ophthalmic screening followed by annual surveillance utilizing automated visual field perimetry (10-2) and spectral-domain OCT.",
            "golden_fa": "معاینه چشم‌پزشکی دوره‌ای منظم در لوپوس = پایش سمیت شبکیه ناشی از هیدروکسی‌کلروکین.",
            "golden_en": "Mandatory periodic ophthalmic surveillance in lupus = monitoring hydroxychloroquine retinal toxicity.",
            "points_fa": [
                "دوز ایمن روزانه هیدروکسی‌کلروکین حداکثر ۵ میلی‌گرم به ازای هر کیلوگرم وزن واقعی بدن است.",
                "در صورت تشخیص زودهنگام سمیت با OCT، پیشرفت آسیب با قطع دارو متوقف می‌شود.",
                "مصرف تاموکسیفن، بیماری کلیوی و دوز تجمعی بالای ۱۰۰۰ گرم ریسک سمیت چشمی را بالا می‌برند.",
                "تاری دید و نقص در دید رنگ‌ها از علائم اولیه مسمومیت شبکیه هستند."
            ],
            "points_en": [
                "The maximum recommended daily dosage of hydroxychloroquine is ≤5.0 mg/kg of actual body weight.",
                "Early identification of subclinical toxicity with SD-OCT allows cessation before central visual loss ensues.",
                "Concomitant tamoxifen use, chronic renal impairment, and cumulative dose >1000g accelerate retinal risk.",
                "Color vision abnormalities and paracentral scotomas represent early manifestations of drug toxicity."
            ]
        }
    },
    93: {
        "whys": [
            "نادرست است؛ دلیل رد: آنتی‌هیستون در لوپوس ناشی از دارو (DILE) مثبت می‌شود و پنل پایه‌ای ارزیابی لوپوس ایدیوپاتیک نیست.",
            "صحیح است؛ در یک خانم جوان با آرتریت مفاصل و راش مالار پروانه‌ای حساس به نور (شک قوی به لوپوس اریتماتوی سیستمیک)، قدم اول تشخیصی درخواست «ANA (حساس‌ترین تست سرولوژیک غربالگری با حساسیت بالای ۹۸٪)، CBC با تفکیک (جهت بررسی سیتوپنی‌های خونی لکوپنی، لنفوپنی، آنمی یا ترومبوسیتوپنی) و آزمایش کامل ادرار U/A (جهت کشف زودهنگام پروتئینوری و هماچوری نفریت لوپوسی)» است.",
            "نادرست است؛ دلیل رد: آنتی‌رو و آنتی‌لا در سندرم شوگرن و لوپوس ساب‌کیوت مثبت هستند اما ارزیابی خونی و کلیوی U/A و CBC را پوشش نمی‌دهند.",
            "نادرست است؛ دلیل رد: آنتی‌بادی Anti-U1-RNP مارکر بیماری بافت همبند مختلط (MCTD) است نه ارزیابی خط اول لوپوس."
        ],
        "exp": "در مواجهه با شک بالینی به لوپوس، بررسی پایه‌ای تشخیصی شامل ANA، شمارش سلول‌های خونی (CBC diff) و آزمایش ادرار (U/A) است.",
        "micro": {
            "lead_fa": "در برخورد اولیه با بیماری که علائم بالینی شک به لوپوس (آرتریت، راش حساس به نور) را نشان می‌دهد، اقدامات آزمایشگاهی تشخیصی باید بر سه اصل استوار باشد: ۱) تست سرولوژیک با حساسیت فوق‌العاده بالا: سنجش آنتی‌بادی ضد هسته (ANA به روش ایمونوفلورسانس غیرمستقیم با حساسیت > ۹۸٪)؛ ۲) ارزیابی معیارهای هماتولوژیک با CBC diff (لکوپنی، لنفوپنی، ترومبوسیتوپنی)؛ ۳) ارزیابی درگیری خاموش اما حیاتی کلیه با آنالیز میکروسکوپی کامل ادرار (U/A).",
            "lead_en": "Initial diagnostic workup for a patient presenting with classic lupus hallmarks (polyarthritis and photosensitive malar rash) fundamentally combines: 1) antinuclear antibody (ANA) testing (>98% sensitivity); 2) complete blood count with differential (evaluating leukopenia, lymphopenia, or thrombocytopenia); and 3) comprehensive urinalysis (screening for occult lupus nephritis).",
            "golden_fa": "بررسی اولیه در شک به لوپوس: ANA (حساس‌ترین تست سرولوژی) + CBC diff (سیتوپنی‌ها) + U/A (درگیری کلیه).",
            "golden_en": "Initial workup in suspected SLE: ANA (highly sensitive) + CBC diff (cytopenias) + urinalysis (nephritis).",
            "points_fa": [
                "تست ANA منفی با عیار بالا تقریباً تشخیص لوپوس سیستمیک را رد می‌کند.",
                "آزمایش ادرار ساده و ارزان بوده و سریع‌ترین راه کشف آسیب گلومرولی کلیه است.",
                "در صورت مثبت بودن ANA، تست‌های تأییدی اختصاصی‌تر شامل Anti-dsDNA و Anti-Smith درخواست می‌شوند.",
                "بررسی سطوح کمپلمان‌های C3 و C4 نیز به ارزیابی فعالیت بیماری کمک می‌نماید."
            ],
            "points_en": [
                "A negative high-titer ANA virtually excludes systemic lupus erythematosus from the differential diagnosis.",
                "Urinalysis represents the simplest, highest-yield screening modality identifying early glomerulonephritis.",
                "Following positive ANA screening, confirmatory high-specificity autoantibodies (anti-dsDNA, anti-Sm) are drawn.",
                "Quantifying baseline complement fractions C3 and C4 aids subsequent monitoring of immunologic flares."
            ]
        }
    },
    94: {
        "whys": [
            "نادرست است؛ دلیل رد: رادیولوژی برای دیدن خار پاشنه لازم نیست؛ خار پاشنه یک یافته تصادفی و بدون علامت در بیش از ۱۰ تا ۲۰ درصد افراد جامعه است و نقشی در درمان ندارد.",
            "نادرست است؛ دلیل رد: فاسییت پلانتار یک آسیب مکانیکی است و آزمایشات التهابی روماتولوژی (RF، ANA، ESR) ارزش بالینی ندارند.",
            "صحیح است؛ درد ناحیه پاشنه پا که صبح‌ها هنگام بیدار شدن و گذاشتن اولین قدم‌ها روی زمین شدید است و با تندرنس موضعی در محل اتصال فاسیا به توبرکل داخلی کالکانئوس همراه است، تابلوی کلاسیک «فاسییت پلانتار (Plantar Fasciitis)» است؛ تشخیص بالینی بوده و درمان خط اول در مراحل ابتدایی اقدامات محافظه‌کارانه شامل «ماساژ موضعی، حرکات کششی فاسیای کف پا و تاندون آشیل، استفاده از کفی نرم پاشنه و مصرف دوره کوتاه NSAID» است.",
            "نادرست است؛ دلیل رد: درمان فاسییت پلانتار کاملاً غیرجراحی است و جراحی هیچ جایگاهی در فاز حاد ندارد."
        ],
        "exp": "درد پاشنه پا با اولین قدم‌های صبحگاهی مشخصه فاسییت پلانتار است و درمان خط اول شامل ماساژ، کشش و NSAID است.",
        "micro": {
            "lead_fa": "فاسییت پلانتار شایع‌ترین علت درد پاشنه پا در بزرگسالان است. علامت مشخصه درد شدید و تیز در کف پاشنه با برداشتن اولین گام‌های صبحگاهی پس از برخاستن از خواب (First-step pain) یا پس از دوره‌های طولانی استراحت است که با چند دقیقه راه‌رفتن ملایم‌تر می‌شود. تندرنس موضعی در لمس برجستگی توبرکل قدامی-داخلی پاشنه حس می‌گردد. درمان محافظه‌کارانه شامل ورزش‌های کششی، کفی‌های سیلیکونی پاشنه و NSAIDs در بیش از ۹۰ درصد بیماران موفقیت‌آمیز است.",
            "lead_en": "Plantar fasciitis is the leading etiology of plantar heel pain in adults, characterized by sharp medial calcaneal tuberosity tenderness. The hallmark symptom is excruciating 'first-step' pain upon waking or rising after prolonged rest that moderates with ambulation. First-line therapy is conservative: targeted plantar/Achilles stretching, supportive footwear/heel cups, and short-course NSAIDs.",
            "golden_fa": "درد پاشنه پا با اولین قدم‌های صبحگاهی = فاسییت پلانتار؛ درمان خط اول: ورزش کششی، ماساژ و NSAID.",
            "golden_en": "Sharp heel pain with first morning steps = plantar fasciitis; initial management: stretching, massage, and NSAIDs.",
            "points_fa": [
                "وجود خار پاشنه در عکس ساده رادیوگرافی علت درد نبوده و مداخله جراحی روی آن ممنوع است.",
                "کشش منظم فاسیای کف پا و وتر آشیل مؤثرترین اقدام در تسریع بهبودی است.",
                "استفاده از آتل‌های شبانه (Night splints) در موارد مقاوم کشش مداوم ایجاد می‌کند.",
                "تزریق موضعی کورتیکواستروئید فقط در موارد مقاوم به کار می‌رود و خطر پارگی فاسیا را دارد."
            ],
            "points_en": [
                "Presence of a radiographic calcaneal spur is an incidental finding, neither causative nor warranting surgery.",
                "Rigorous home-based stretching of the plantar fascia and calf gastroc-soleus complex accelerates recovery.",
                "Night dorsiflexion splints prevent nocturnal fascial contracture in recalcitrant presentations.",
                "Intralesional corticosteroid injection is reserved for refractory cases but risks plantar fat pad atrophy and rupture."
            ]
        }
    },
    95: {
        "whys": [
            "نادرست است؛ دلیل رد: غضروف مفصلی هیالین فاقد عروق و فاقد پایانه‌های عصبی حسی (Aneural and Avascular) است؛ بنابراین آسیب یا زخم سطحی غضروف به خودی خود نمی‌تواند منشأ انتقال حس درد باشد.",
            "نادرست است؛ دلیل رد: غضروف بالغ در مفصل فاقد هرگونه عروق خونی است.",
            "صحیح است؛ در بیماری استئوآرتریت، غضروف مفصلی بافتی کاملاً فاقد عصب (Aneural) است و خودش هیچ حسی از درد ندارد؛ بنابراین منشأ اصلی احساس درد ناشی از ساختارهای عصب‌دار مجاور مفصل است که مهم‌ترین آن‌ها «پرده سینوویال (Synovial Membrane)» به دلیل سینوویت و آزادسازی مدایاتورهای شیمیایی و کشش کپسولی، استخوان ساب‌کندرال به علت میکروفکچرها و هیپرتانسیون داخل مدولار، و پایانه‌های عصبی پری‌اوست و کپسول مفصلی هستند.",
            "نادرست است؛ دلیل رد: پایانه‌های عصبی داخل غضروف وجود ندارند که کشیده شوند."
        ],
        "exp": "غضروف مفصلی فاقد عصب و عروق است؛ بنابراین منشأ اصلی درد در استئوآرتریت پرده سینوویال و استخوان زیرین است.",
        "micro": {
            "lead_fa": "یک نکته کلیدی در فیزیوپاتولوژی استئوآرتریت این است که غضروف هیالین مفصل بافتی بدون رگ و بدون پایانه عصبی (Avascular and Aneural) است؛ به همین دلیل تخریب اولیه غضروف مفصلی بدون درد است. با پیشرفت بیماری، منشأ تولید ایمپالس‌های درد شامل ساختارهای اطراف غضروف است: ۱) پرده سینوویال (به دلیل سینوویت با درجه خفیف و التهاب ناشی از بلع ذرات غضروف)؛ ۲) استخوان زیر غضروف (Subchondral bone) به علت میکروفرکچرها و استئوفیت‌ها؛ ۳) کشش فیبرهای کپسول مفصلی.",
            "lead_en": "Articular cartilage is inherently devoid of neural endings and microvascular networks (aneural and avascular), precluding it from directly sensing or generating pain. Joint pain in osteoarthritis originates entirely from contiguous innervated tissues: the synovial lining (low-grade synovitis triggered by cartilage fragments), subchondral bone microfractures, osteophytic periosteal stretching, and the fibrous capsule.",
            "golden_fa": "غضروف مفصل عصب و درد ندارد؛ منشأ درد در استئوآرتریت = پرده سینوویال، استخوان ساب‌کندرال و کپسول مفصل.",
            "golden_en": "Articular cartilage has no nerve supply; OA joint pain originates from the synovium, subchondral bone, and capsule.",
            "points_fa": [
                "تخریب غضروف سبب آزادسازی خرده‌های ماتریکس و تحریک التهابی پرده سینوویال می‌شود.",
                "استئوفیت‌های استخوانی با کشیدن پری‌اوست غنی از عصب باعث تشدید درد حرکتی می‌شوند.",
                "ورزش‌های تقویت‌کننده عضلات پیرامون مفصل بار فشاری بر روی استخوان و سینوویوم را کاهش می‌دهند.",
                "تزریق داخل مفصلی کورتیکواستروئید التهاب سینوویال را خاموش کرده و درد را فرو می‌نشاند."
            ],
            "points_en": [
                "Cartilage degradation sheds matrix microparticles, inciting low-grade secondary synovial inflammation.",
                "Marginal osteophytes generate mechanical strain against the pain-sensitive, highly innervated periosteum.",
                "Strengthening periarticular musculature stabilizes the articulation, unloading vulnerable subchondral bone.",
                "Intra-articular corticosteroid administration suppresses local synovial inflammation, yielding rapid pain relief."
            ]
        }
    },
    96: {
        "whys": [
            "نادرست است؛ دلیل رد: بروسلوزیس مونوآرتریت حاد راجعه شست پا با فواصل خودمحدودشونده ایجاد نمی‌کند.",
            "نادرست است؛ دلیل رد: آرتریت روماتوئید پلی‌آرتریت مزمن و متقارن دست‌ها است و فواصل خودمحدودشونده بدون علامت ندارد.",
            "نادرست است؛ دلیل رد: استئوآرتریت بیماری فرسایشی مزمن و مکانیکی است و حملات حاد قرمزی شدید و عودکننده نمی‌دهد.",
            "صحیح است؛ تورم، قرمزی و درد بسیار شدید و حاد در مفصل اول متاتارسوفالانژیال پا (پوداگرا / Podagra) با سابقه حملات حاد متناوب قبلی در همان مفصل و مچ پا که «به طور خودبه‌خود و بدون باقی ماندن نقص بهبود می‌یافته‌اند»، تابلوی پاتوگنومونیک و کلاسیک «بیماری نقرس (Gout)» است."
        ],
        "exp": "حملات حاد، عودکننده و خودمحدودشونده مفصل MTP اول پا با فواصل بدون علامت، مشخصه پاتوگنومونیک نقرس است.",
        "micro": {
            "lead_fa": "سیر طبیعی نقرس با حملات حاد آرتریت تک‌مفصلی شدید مشخص می‌شود. مفصل متاتارسوفالانژیال اول پا (MTP1) شایع‌ترین موضع درگیری در بیش از ۹۰ درصد بیماران است که پوداگرا نامیده می‌شود. ویژگی منحصر‌به‌فرد نقرس در مراحل اولیه، خودمحدودشونده بودن حملات حاد ظرف ۵ تا ۱۰ روز است که به دوره‌های کاملاً بدون علامت بین‌حمله‌ای (Intercritical gout) منجر می‌شود. با گذشت سال‌ها در صورت عدم درمان، حملات مکررتر شده و فاز توفوسی مزمن ایجاد می‌گردد.",
            "lead_en": "The classic natural history of gout features explosive, self-limited paroxysms of agonizing monoarticular inflammation targeting the first metatarsophalangeal joint (podagra). Untreated acute flares resolve spontaneously within 7 to 14 days, followed by asymptomatic quiescent intercritical intervals before frequency increases.",
            "golden_fa": "حمله حاد قرمزی و تورم شست پا با بهبود خودبه‌خود و فواصل سالم = نقرس (Gout).",
            "golden_en": "Recurrent acute self-resolving erythema and swelling of the great toe = gout (podagra).",
            "points_fa": [
                "تأیید قطعی با مشاهده کریستال‌های سوزنی‌شکل MSU با انکسار نوری منفی در مایع سینوویال است.",
                "حمله حاد با استراحت مفصل، کمپرس سرد، NSAID یا کلشی‌سین مهار می‌شود.",
                "تغییر ناگهانی اسید اوریک، غذاهای غنی از پورین، الکل و داروها آغازگر حملات هستند.",
                "در صورت تکرار بیش از ۲ حمله در سال، درمان طولانی‌مدت با آلوپورینول اندیکاسیون قطعی دارد."
            ],
            "points_en": [
                "Definitive confirmation hinges on identifying needle-shaped intracellular negatively birefringent MSU crystals.",
                "Acute flare management relies on joint rest, cold compresses, full-dose NSAIDs, or low-dose colchicine.",
                "Triggers encompass dietary purine binges, alcohol consumption, dehydration, and diuretic therapy.",
                "Experiencing ≥2 flares per year represents an established guideline indication for long-term urate-lowering therapy."
            ]
        }
    },
    97: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: اندازه‌گیری اسید اوریک سرم در فاز حاد حمله می‌تواند نرمال باشد و به هیچ وجه عفونت مفصلی (آرتریت سپتیک) را رد نکرده و تشخیصی قطعی نیست.",
            "صحیح است؛ در هر بیماری با تظاهر مونوآرتریت حاد، گرم و متورم مفصل زانو (حتی در صورت شک بالینی بالا به نقرس یا نقرس کاذب)، اقدام تشخیصی الزامی، استاندارد طلایی و نجات‌بخش «آسپیراسیون مایع مفصلی و آنالیز آن (Arthrocentesis & Synovial Fluid Analysis)» است؛ این اقدام هم برای بررسی میکروسکوپی حضور کریستال‌های اورات (MSU) و هم برای رد قاطعانه آرتریت سپتیک و ارزیابی رنگ‌آمیزی گرم و کشت باکتریایی واجب است.",
            "نادرست است؛ دلیل رد: سنجش ESR و CRP صرفاً نشان‌دهنده التهاب غیراختصاصی است و نوع آرتریت را مشخص نمی‌سازد.",
            "نادرست است؛ دلیل رد: گرافی زانو تغییرات حاد را نشان نمی‌دهد و ردکننده عفونت یا نقرس نیست."
        ],
        "exp": "در مواجهه با مونوآرتریت حاد زانو، آسپیراسیون فوری مایع مفصلی برای اثبات کریستال و رد آرتریت سپتیک الزامی است.",
        "micro": {
            "lead_fa": "در هر بیماری که با مونوآرتریت حاد التهابی مفصل بزرگ (نظیر زانو) مراجعه می‌کند، قانون طلایی روماتولوژی انجام فوری آسپیراسیون تشخیصی مایع مفصل (آرتروسنتز) است. اندازه‌گیری اسید اوریک سرم گمراه‌کننده است زیرا در بیش از یک‌سوم بیماران در حین حمله فعال نقرس به دلیل ترشح سایتوکاین‌های دفع‌کننده ادراری اسید اوریک، سطح سرمی اورات ممکن است کاملاً طبیعی باشد. علاوه بر این، رد آرتریت سپسیس حاد تنها با آنالیز و کشت مایع سینوویال امکان‌پذیر است.",
            "lead_en": "In any acute inflammatory monoarthritis of a major joint, emergent diagnostic arthrocentesis and synovial fluid analysis is the mandatory clinical directive. Measuring serum uric acid during an acute flare is notoriously unreliable (normal in up to 30-40% due to acute-phase uricosuria) and critically fails to exclude pyogenic septic arthritis.",
            "golden_fa": "مونوآرتریت حاد زانو = اقدام تشخیصی اول و الزامی: آسپیراسیون و آنالیز مایع مفصلی.",
            "golden_en": "Acute knee monoarthritis = mandatory initial diagnostic procedure: arthrocentesis and synovial fluid analysis.",
            "points_fa": [
                "اسید اوریک سرم در حین حمله حاد نقرس می‌تواند در محدوده کاملاً طبیعی قرار داشته باشد.",
                "بررسی میکروسکوپ پلاریزان کریستال‌های سوزنی داخل سلولی MSU را کشف می‌کند.",
                "انجام رنگ‌آمیزی گرم و کشت باکتریایی مایع مفصلی جهت رد آرتریت چرکی اجباری است.",
                "تخلیه مایع مفصلی فشار داخل مفصل را کاهش داده و سریعاً درد بیمار را تسکین می‌دهد."
            ],
            "points_en": [
                "Serum uric acid concentrations may be paradoxically normal during the peak of an acute gout attack.",
                "Polarized light microscopy unequivocally identifies diagnostic needle-shaped intracellular MSU crystals.",
                "Urgent synovial fluid Gram staining and microbial cultures are mandatory to rule out concurrent joint sepsis.",
                "Therapeutic aspiration of joint fluid immediately decompresses intra-articular hypertension, easing pain."
            ]
        }
    },
    98: {
        "whys": [
            "نادرست است؛ دلیل رد: Anti-Topoisomerase I (Anti-Scl-70) با فرم منتشر اسکلرودرمی و فیبروز شدید ریوی (ILD) همراهی دارد نه فرم محدود CREST.",
            "نادرست است؛ دلیل رد: Anti-RNA Polymerase III با فرم منتشر شدید و بحران کلیوی اسکلرودرمی (Renal Crisis) همراه است.",
            "نادرست است؛ دلیل رد: Anti-U3-RNP آنتی‌بادی نادری در فرم منتشر با درگیری شدید قلبی است.",
            "صحیح است؛ تابلوی پدیده رینود، اسکلروداکتیلی، تلانژکتازی صورت، اختلال حرکتی مری (دیسفاژی) و هایپرتانسیون ایزوله شریان ریوی (PAH)، نشان‌دهنده «سندرم CREST یا اسکلرودرمی محدود جلدی (Limited Cutaneous Systemic Sclerosis)» است؛ آنتی‌بادی بسیار اختصاصی و شاخص این فرم بالینی «آنتی‌سانترومر (Anti-Centromere Antibody / ACA)» است که در بیش از ۷۰ تا ۸۰ درصد این بیماران دیده می‌شود."
        ],
        "exp": "آنتی‌بادی آنتی‌سانترومر (Anti-centromere) مارکر اختصاصی سندرم CREST و هایپرتانسیون شریان ریوی ایزوله در اسکلرودرمی است.",
        "micro": {
            "lead_fa": "اسکلروز سیستمیک محدود جلدی (lcSSc) که تحت عنوان سندرم CREST شناخته می‌شود شامل پنج تظاهر شاخص است: ۱) کلسینوز جلدی؛ ۲) پدیده رینود؛ ۳) اختلال حرکتی مری با دیسفاژی؛ ۴) اسکلروداکتیلی محدود به دیستال آرنج؛ ۵) تلانژکتازی جلدی. عارضه تهدیدکننده حیات در این گروه افزایش فشار شریان ریوی اولیه (PAH) است. اتوآنتی‌بادی اختصاصی این سندروم، آنتی‌بادی ضد سانترومر (Anti-centromere antibody) با الگوی رنگ‌آمیزی سنترومری در ANA است.",
            "lead_en": "Limited cutaneous systemic sclerosis (CREST syndrome) characteristically encompasses Calcinosis, Raynaud phenomenon, Esophageal dysmotility, Sclerodactyly, and Telangiectasia. Patients run a substantial long-term risk of isolated pulmonary arterial hypertension (PAH). The defining, highly specific serologic biomarker is the anti-centromere antibody (ACA).",
            "golden_fa": "سندرم CREST (رینود، اسکلروداکتیلی، تلانژکتازی، دیسفاژی، هایپرتانسیون ریوی) = آنتی‌سانترومر (Anti-centromere).",
            "golden_en": "CREST syndrome (Raynaud, sclerodactyly, telangiectasia, dysphagia, pulmonary hypertension) = anti-centromere antibody.",
            "points_fa": [
                "Anti-Scl-70 با اسکلرودرمی منتشر و فیبروز بینابینی ریه (ILD) همراه است.",
                "اکوکاردیوگرافی داپلر سالانه برای غربالگری زودهنگام هایپرتانسیون ریوی در بیماران سنترومرمثبت الزامی است.",
                "درگیری پوست در این فرم فراتر از آرنج و زانو پیشرفت نمی‌کند.",
                "بحران کلیوی در بیماران دارای Anti-centromere بسیار نادر است."
            ],
            "points_en": [
                "Anti-Scl-70 (anti-topoisomerase I) heralds diffuse cutaneous systemic sclerosis complicated by pulmonary fibrosis.",
                "Annual Doppler echocardiography surveillance is mandatory for the early interception of asymptomatic PAH.",
                "Cutaneous thickening in limited SSc remains strictly confined distal to the elbows and knees, sparing the trunk.",
                "Scleroderma renal crisis is extraordinarily rare in anti-centromere-positive cohorts."
            ]
        }
    },
    99: {
        "whys": [
            "نادرست است؛ دلیل رد: پلی‌آنژئیت گرانولوماتوز (وگنر) عروق کوچک را درگیر کرده و همواره با درگیری شدید تنفسی (ندول‌های ریوی) و گلومرولونفریت فعال همراه است.",
            "نادرست است؛ دلیل رد: واسکولیت لوپوس با راش مالار، آنتی‌بادی dsDNA و علائم چندارگانی دیگر همراه است.",
            "صحیح است؛ تابلوی مرد میانسال با درگیری عروق با کالیبر متوسط شامل: اولسرهای پوستی ساق پا، درد شکمی ناشی از آنژین احشایی مزانتر، پرفشاری خون جدید ناشی از ایسکمی شریان کلیوی، مونونوریت مولتیپلکس، ESR بالا و «سدیمان ادراری کاملاً طبیعی (Normal urinary sediment بدون گلومرولونفریت)»، تابلوی پاتوگنومونیک و کلاسیک «پلی‌آرتریت ندوزا (Polyarteritis Nodosa / PAN)» است.",
            "نادرست است؛ دلیل رد: کرایوگلوبولینمی با پورپورای برجسته، گلومرولونفریت فعال (سدیمان غیرطبیعی) و عفونت هپاتیت C تظاهر می‌کند."
        ],
        "exp": "درد شکم، مونونوریت مولتیپلکس، فشار خون بالا و سدیمان ادراری طبیعی در عروق متوسط، مشخصه پلی‌آرتریت ندوزا (PAN) است.",
        "micro": {
            "lead_fa": "پلی‌آرتریت ندوزا (PAN) واسکولیت نکروزان عروق عضلانی با کالیبر متوسط و کوچک است که ریه‌ها را درگیر نمی‌کند و با آنکا (ANCA) مرتبط نیست. ویژگی‌های تشخیصی بارز: درد شدید شکم بعد از غذا (آنژین روده)، هایپرتانسیون شریانی به علت ایسکمی رنوواسکولار، مونونوریت مولتیپلکس (نظیر افتادگی مچ پا یا دست)، و زخم‌های پوستی ایسکمیک. نکته کلیدی عدم ایجاد گلومرولونفریت است (بنابراین سدیمان ادراری کاملاً نرمال است).",
            "lead_en": "Polyarteritis nodosa (PAN) is a necrotizing vasculitis selectively targeting medium-sized muscular arteries while sparing pulmonary vessels and glomerular capillaries. Key features include mesenteric angina, renovascular hypertension, mononeuritis multiplex, and deep ischemic cutaneous ulcers. The hallmark clue is severe renal arteritis yielding renal insufficiency with normal urinalysis.",
            "golden_fa": "درد شکم + مونونوریت مولتیپلکس + فشار خون بالا + سدیمان ادراری نرمال = پلی‌آرتریت ندوزا (PAN).",
            "golden_en": "Postprandial abdominal pain + mononeuritis multiplex + hypertension + normal urinary sediment = polyarteritis nodosa.",
            "points_fa": [
                "آنژیوگرافی عروق احشایی میکروآنوریسم‌های متعدد در شریان‌های کلیوی و مزانتر را نشان می‌دهد.",
                "PAN با عفونت ویروس هپاتیت B (HBV) همراهی شناخته‌شده دارد.",
                "درمان استاندارد PAN ایدیوپاتیک کورتیکواستروئید با دوز بالا همراه با سیکلوفسفامید است.",
                "در PAN عروق مویرگی گلومرول درگیر نمی‌شوند، لذا کست خونی در ادرار دیده نمی‌شود."
            ],
            "points_en": [
                "Visceral catheter angiography reveals characteristic multiple microaneurysms along renal and mesenteric trees.",
                "Strong etiologic association exists between secondary PAN and chronic hepatitis B virus (HBV) infection.",
                "Standard immunosuppression for idiopathic systemic PAN pairs high-dose corticosteroids with cyclophosphamide.",
                "Glomerular capillaries are spared, accounting for the absence of cellular casts and glomerulonephritis."
            ]
        }
    },
    100: {
        "whys": [
            "صحیح است؛ درد در قدام بازو و ناودان بای‌سیپیتال شانه که با ایجاد مقاومت در برابر سوپیناسیون ساعد در وضعیت فلکسیون ۹۰ درجه آرنج تشدید می‌گردد، مثبت بودن «تست یرگاسون (Yergason's Test)» را نشان می‌دهد که مانور بالینی پاتوگنومونیک برای تشخیص «تاندونیت سر بلند عضله دوسربازویی (Biceps Tendinitis)» است.",
            "نادرست است؛ دلیل رد: تاندونیت تری‌سپس در پشت آرنج و با اکستنشن مقاومتی آرنج درد ایجاد می‌کند.",
            "نادرست است؛ دلیل رد: تاندونیت روتاتور کاف با تست‌های نیر، هاوکینز و ابداکسیون مقاومتی تحریک می‌شود نه سوپیناسیون ساعد.",
            "نادرست است؛ دلیل رد: اپی‌کوندیلیت لترال با اکستنشن مقاومتی مچ دست دردناک می‌شود."
        ],
        "exp": "تشدید درد قدام بازو با سوپیناسیون مقاومتی ساعد در آرنج خمیده، تست مثبت یرگاسون در تاندونیت بای‌سپس است.",
        "micro": {
            "lead_fa": "تاندونیت سر بلند بای‌سپس در ورزشکاران به دنبال حرکات تکراری پرتابی بالای سر ایجاد می‌شود. دو تست بالینی اختصاصی برای تشخیص آن وجود دارد: ۱) تست یرگاسون (Yergason test): مقاومت در برابر سوپیناسیون فعال ساعد در حالی که آرنج ۹۰ درجه خمیده است موجب احساس درد شدید در ناودان بای‌سیپیتال می‌شود؛ ۲) تست اسپید (Speed test): فلکسیون رو به بالای دست در وضعیت سوپیناسیون با مقاومت در برابر دست معاینه‌کننده درد قدام شانه را بازتولید می‌کند.",
            "lead_en": "Long head biceps tendinitis typically afflicts overhead throwing athletes, manifesting as anterior shoulder ache over the bicipital groove. The pathognomonic physical examination maneuver described is Yergason's test: resisted active forearm supination with the elbow flexed at 90° reproduces localized anterior groove pain.",
            "golden_fa": "درد قدام بازو با سوپیناسیون مقاومتی ساعد (تست یرگاسون) = تاندونیت بای‌سپس.",
            "golden_en": "Anterior arm/shoulder pain with resisted supination (Yergason's sign) = biceps tendinitis.",
            "points_fa": [
                "تست اسپید (فلکسیون شانه در سوپیناسیون کامل دست) حساسیت بالاتری در کشف تاندونیت بای‌سپس دارد.",
                "لمس مستقیم ناودان اینترتوبرکولار بازو تندرنس موضعی را آشکار می‌سازد.",
                "درمان اولیه شامل استراحت از پرتاب، کمپرس سرد، NSAIDs و فیزیوتراپی است.",
                "تزریق کورتون داخل غلاف تاندون بای‌سپس باید با احتیاط انجام شود تا خطر پارگی به حداقل برسد."
            ],
            "points_en": [
                "Speed's test (resisted forward shoulder flexion in full supination) offers superior sensitivity.",
                "Direct palpation along the bicipital groove elicits exquisite, reproducible point tenderness.",
                "Conservative management incorporates relative rest, cryotherapy, NSAIDs, and rotator cuff balancing exercises.",
                "Direct intra-tendinous steroid injections must be avoided to mitigate catastrophic tendon rupture."
            ]
        }
    },
    101: {
        "whys": [
            "نادرست است؛ دلیل رد: مسیر انتشار به خلفی‌جانبی ران، ساق و پشت پا منطبق با درماتوم L5 است و این جمله کاملاً صحیح است.",
            "نادرست است؛ دلیل رد: فتق دیسک بین‌مهره‌ای L4-L5 شایع‌ترین عامل فشار بر ریشه عصبی L5 است و این جمله کاملاً درست است.",
            "صحیح است (جمله‌ای که نادرست است)؛ رفلکس تاندون کشکک زانو (Knee reflex / Patellar tendon reflex) منحصراً توسط «ریشه عصبی L4» هدایت می‌شود؛ در رادیکولوپاتی فشاری ریشه عصبی L5، «رفلکس زانو کاملاً طبیعی و دست‌نخورده» باقی می‌ماند (در واقع ریشه L5 هیچ رفلکس تاندونی استانداردی ندارد)؛ بنابراین مختل بودن رفلکس زانو نادرست است.",
            "نادرست است؛ دلیل رد: ضعف عضله تیبیالیس قدامی و اکستنسور هالوسیس لونگوس منجر به اختلال در راه رفتن روی پاشنه‌ها (Heel walking) در رادیکولوپاتی L5 می‌شود و این جمله کاملاً صحیح است."
        ],
        "exp": "در رادیکولوپاتی ریشه L5 رفلکس زانو نرمال است؛ رفلکس زانو توسط ریشه L4 و رفلکس آشیل توسط S1 هدایت می‌شود.",
        "micro": {
            "lead_fa": "در رادیکولوپاتی دیسک کمر، شناخت دقیق نقشه ریشه‌های L4، L5 و S1 حیاتی است. درگیری ریشه L5 (ناشی از هرنی دیسک L4-L5): حس دورسوم پا و انگشت شست را تأمین می‌کند؛ عضله تیبیالیس قدامی و اکستانسور شست را عصب‌دهی می‌کند (اختلال در راه رفتن روی پاشنه‌ها و اکستنشن شست)؛ اما هیچ رفلکس وتری قابل ارزیابی ندارد و رفلکس زانو (مربوط به L4) و رفلکس آشیل (مربوط به S1) هر دو کاملاً نرمال باقی می‌مانند.",
            "lead_en": "Neurological localization in lumbar disc disease demands strict anatomic precision. An L4-L5 disc herniation impinges upon the exiting L5 nerve root, precipitating posterolateral calf pain, dorsum foot paresthesias, and toe/wrist extensor weakness (impaired heel walking). Crucially, L5 possesses no routine deep tendon reflex; the patellar reflex (L4) is entirely normal.",
            "golden_fa": "رادیکولوپاتی L5: ضعف اکستنشن شست و اختلال راه رفتن روی پاشنه؛ رفلکس زانو (L4) و آشیل (S1) کاملاً طبیعی هستند.",
            "golden_en": "L5 radiculopathy: weak big toe extension and impaired heel walking; patellar (L4) and Achilles (S1) reflexes are normal.",
            "points_fa": [
                "ریشه L4: ضعف عضله چهارسر ران، حس مدیال ساق و کاهش رفلکس تاندون پتلا.",
                "ریشه S1: ضعف پلانتارفلکسیون مچ پا، اختلال راه رفتن روی پنجه، حس لترال پا و کاهش رفلکس آشیل.",
                "تست SLR مستقیم در درگیری دیسک L4-L5 بسیار حساس و مثبت می‌شود.",
                "بیش از ۹۰ درصد فتق‌های دیسک کمری در سطوح L4-L5 یا L5-S1 رخ می‌دهند."
            ],
            "points_en": [
                "L4 radiculopathy features quadriceps weakness, medial leg sensory loss, and an impaired patellar reflex.",
                "S1 radiculopathy features gastrocnemius weakness, impaired toe walking, lateral foot sensory loss, and depressed Achilles reflex.",
                "Straight leg raise (SLR) is exceedingly sensitive for lower lumbar neurocompression.",
                "Over 90% of all symptomatic lumbar disc herniations localize to either L4-L5 or L5-S1 levels."
            ]
        }
    },
    102: {
        "whys": [
            "نادرست است؛ دلیل رد: درد عمقی و منتشر از مشخصات شاخص درد منشأ مفصلی (آرتیکولار) است.",
            "صحیح است (موردی که به نفع درد مفصلی نیست)؛ محدودیت حرکتی بیشتر در حرکات فعال نسبت به غیرفعال (Disproportionate loss of active compared to passive motion)، مشخصه کلاسیک «درد و پاتولوژی غیرمفصلی یا اطراف مفصلی (Periarticular / Non-articular)» نظیر پارگی‌های تاندونی، تاندونیت و بورسیت است؛ در درد واقعی داخل مفصل (Articular)، دامنه حرکات مفصل در «هر دو وضعیت فعال و غیرفعال به طور یکسان» محدود و دردناک می‌شود.",
            "نادرست است؛ دلیل رد: قفل شدن مفصل نشانه وجود ضایعه مکانیکی داخل مفصل نظیر آسیب منیسک یا استئوکندریت است.",
            "نادرست است؛ دلیل رد: کریپتاسیون نشانه سایش سطوح غضروفی داخل مفصل است."
        ],
        "exp": "در درد مفصلی محدودیت حرکات فعال و غیرفعال یکسان است؛ محدودیت بیشتر در حرکات فعال نشانه درد غیرمفصلی/تاندونی است.",
        "micro": {
            "lead_fa": "در معاینه فیزیکی دستگاه حرکتی، افتراق درد مفصلی (Articular) از درد پری‌آرتیکولار/غیرمفصلی (تاندونیت، بورسیت، عضلانی) بنیادین است. در پاتولوژی داخل مفصل، درد عمقی و منتشر بوده و حرکات فعال و غیرفعال مفصل در تمام جهات به یک اندازه محدود و دردناک می‌شوند (بروز کریپتوس و قفل شدن). در مقابل، در پاتولوژی‌های بافت اطراف مفصل، حرکات فعال بیش از حرکات غیرفعال محدود است و معمولاً حساسیت نقطه‌ای لوکالیزه وجود دارد.",
            "lead_en": "Differentiating articular from periarticular pathology is a foundational musculoskeletal clinical skill. Articular pathology produces deep, diffuse joint pain accompanied by equivalent restriction of both active and passive ranges of motion. Conversely, periarticular conditions (tendinitis, bursitis) selectively impair active motion while passive excursion remains relatively preserved.",
            "golden_fa": "درد مفصلی: محدودیت یکسان حرکات فعال و غیرفعال؛ محدودیت بیشتر حرکت فعال = درد غیرمفصلی (پری‌آرتیکولار).",
            "golden_en": "Articular pain: equivalent active and passive motion loss; selective active loss = periarticular/tendon lesion.",
            "points_fa": [
                "تندرنس متمرکز در یک نقطه خارج مفصل نشانه بورسیت یا انتزیت است.",
                "تورم و افیوژن احاطه‌کننده کل خط مفصلی نشان‌دهنده پاتولوژی داخل مفصل است.",
                "انقباض عضلانی مقاومتی در بیماری‌های تاندونی درد موضعی ایجاد می‌کند اما در آرتریت بدون درد است.",
                "قفل شدن زانو همراه با درد عمقی بیانگر پارگی منیسک یا قطعه آزاد داخل مفصلی است."
            ],
            "points_en": [
                "Focal point tenderness over an anatomical landmark remote from the joint line indicates bursitis or enthesitis.",
                "Circumferential effusion tracking the anatomic synovial contour confirms true intra-articular disease.",
                "Resisted active isometric muscular contraction triggers localized pain in tendinitis but is painless in pure arthritis.",
                "True mechanical locking alongside deep joint line pain establishes intra-articular loose bodies or meniscal tears."
            ]
        }
    },
    103: {
        "whys": [
            "نادرست است؛ دلیل رد: آرتریت پسوریاتیک پلاک‌های پسوریازیس در سطوح اکستنسور و تغییرات ناخنی می‌دهد نه تظاهر کراتودرما بلنوراژیکا در کف پاها پس از عفونت.",
            "نادرست است؛ دلیل رد: لوپوس ضایعات پوستی حساس به نور مالار و دیسکوئید ایجاد می‌کند.",
            "نادرست است؛ دلیل رد: سارکوئیدوز اریتم ندوزوم و لوپوس پرنیو ایجاد می‌کند.",
            "صحیح است؛ «کراتودرما بلنوراژیکوم (Keratoderma Blennorrhagica)» ضایعه پوستی اختصاصی و پاتوگنومونیک «آرتریت واکنشی (Reactive Arthritis)» است؛ این ضایعات به صورت پلاک‌ها و وزیکول‌های پوسته‌دار و ضخیم هیپرکراتوتیک زرد-قهوه‌ای بدون درد در کف دست‌ها و به ویژه کف پاها تظاهر پیدا می‌کنند."
        ],
        "exp": "کراتودرما بلنوراژیکوم ضایعه پوستی هیپرکراتوتیک و اختصاصی کف دست و پا در بیماری آرتریت واکنشی است.",
        "micro": {
            "lead_fa": "کراتودرما بلنوراژیکوم (Keratoderma blennorrhagica) تظاهر پوستی شاخص آرتریت واکنشی است که در ۱۰ تا ۲۰ درصد بیماران دیده می‌شود. این ضایعات ابتدا به شکل وزیکول‌های کوچک با دیواره ضخیم در کف دست‌ها یا پاها ظاهر شده و سپس به پاپول‌ها و پلاک‌های هیپرکراتوتیک مومی‌شکل شبیه پسوریازیس پوسچولار تبدیل می‌شوند. سایر علائم مخاطی-پوستی آرتریت واکنشی شامل بالانیت سرسیناتا و اولسرهای دهانی بدون درد هستند.",
            "lead_en": "Keratoderma blennorrhagica represents a classic dermatologic hallmark of reactive arthritis, developing in 10-20% of patients. Lesions erupt as discrete wax-like hyperkeratotic pustules and plaques heavily distributed on the palms and soles, histopathologically indistinguishable from pustular psoriasis.",
            "golden_fa": "ضایعات پوستی هیپرکراتوتیک کف پا (کراتودرما بلنوراژیکوم) = علامت اختصاصی آرتریت واکنشی.",
            "golden_en": "Hyperkeratotic sole plaques (keratoderma blennorrhagica) = specific cutaneous marker of reactive arthritis.",
            "points_fa": [
                "ضایعات کراتودرما بلنوراژیکوم معمولاً بدون علامت و بدون خارش هستند.",
                "بالانیت سرسیناتا ضایعات حلقوی فرسایشی بدون درد روی گلنز آلت تناسلی است.",
                "این ضایعات همراه با اولیگوآرتریت محیطی و انتزیت تاندون آشیل در حضور HLA-B27 دیده می‌شوند.",
                "درمان بیماری زمینه‌ای با NSAIDs به مرور ضایعات پوستی را ناپدید می‌سازد."
            ],
            "points_en": [
                "Keratoderma blennorrhagica eruptions are typically painless, non-pruritic, and self-limiting.",
                "Circinate balanitis features painless, superficial serpiginous erosions encircling the coronal glans penis.",
                "These mucocutaneous manifestations frequently co-segregate with severe peripheral oligoarthritis and HLA-B27.",
                "Standard systemic NSAID therapy and topical corticosteroids resolve the cutaneous lesions."
            ]
        }
    },
    104: {
        "whys": [
            "نادرست است؛ دلیل رد: حساسیت Anti-CCP در آرتریت روماتوئید متوسط تا بالا است (حدود ۶۵ تا ۷۵ درصد) و تفاوت اصلی آن ویژگی فوق‌العاده بالا است.",
            "صحیح است؛ آزمایش آنتی‌بادی علیه پپتید سیترولینه حلقوی (Anti-CCP / ACPA) در تشخیص بیماری آرتریت روماتوئید دارای «ویژگی یا اختصاصیت بسیار بالا (Specificity بیش از ۹۵ تا ۹۸ درصد)» است؛ برعکس فاکتور روماتوئید (RF) که در بسیاری از بیماری‌های بافت همبند، عفونت‌های مزمن و افراد مسن سالم مثبت کاذب می‌شود، Anti-CCP به ندرت در بیماری دیگری مثبت شده و تشخیص RA را قطعی می‌سازد.",
            "نادرست است؛ دلیل رد: اگرچه حساسیت آن حدود ۷۰ درصد است اما بارزترین مشخصه بیولوژیک آن در تمام منابع ویژگی استثنایی آن است.",
            "نادرست است؛ دلیل رد: مثبت بودن تیتر بالای Anti-CCP همراه با بیماری اروزیو مهاجم و پیش‌آگهی بدتر است نه پیش‌آگهی خوب."
        ],
        "exp": "آزمایش Anti-CCP در آرتریت روماتوئید دارای ویژگی (اختصاصیت) بسیار بالا (>۹۵٪) و نشان‌دهنده سیر تهاجمی‌تر بیماری است.",
        "micro": {
            "lead_fa": "آنتی‌بادی ضد پپتید سیترولینه حلقوی (Anti-CCP) حساسیت تشخیصی مشابه فاکتور روماتوئید (حدود ۷۰٪) دارد، اما مزیت بی‌بدیل آن ویژگی تشخیصی استثنایی آن (۹۵٪ تا ۹۸٪ در برابر ۷۵٪ تا ۸۰٪ در RF) است. آنتی‌سی‌سی‌پی حتی سال‌ها قبل از ظهور اولین علائم بالینی در سرم قابل شناسایی است و همراه با پیش‌آگهی بیماری تهاجمی، اروزیون‌های سریع استخوانی و درگیری‌های خارج مفصلی است.",
            "lead_en": "Anti-cyclic citrullinated peptide (anti-CCP/ACPA) testing delivers extraordinary diagnostic specificity (95-98%) for rheumatoid arthritis, sharply outperforming rheumatoid factor, which frequently yields false positives across chronic infections and autoimmune states. High-titer ACPA correlates with progressive articular erosions and poor prognosis.",
            "golden_fa": "مزیت و ارزش اصلی تست Anti-CCP در آرتریت روماتوئید = ویژگی (اختصاصیت) بسیار بالا (> ۹۵٪).",
            "golden_en": "Primary diagnostic value of anti-CCP in rheumatoid arthritis = exceptionally high specificity (>95%).",
            "points_fa": [
                "تست Anti-CCP در طبقه‌بندی سال ۲۰۱۰ ACR/EULAR معادل ۳ امتیاز به بیمار می‌دهد.",
                "فاکتور روماتوئید در هپاتیت C، اندوکاردیت و کهولت سن به وفور مثبت کاذب می‌شود اما Anti-CCP نه.",
                "مثبت بودن توأم RF و Anti-CCP ویژگی تشخیصی را به نزدیک ۱۰۰ درصد می‌رساند.",
                "بیماران Anti-CCP مثبت نیازمند درمان تهاجمی‌تر و سریع‌تر با DMARDها جهت پیشگیری از تخریب استخوان هستند."
            ],
            "points_en": [
                "High-positive ACPA titers award the maximal 3 points under the 2010 ACR/EULAR classification criteria.",
                "Rheumatoid factor frequently crosses with hepatitis C, subacute endocarditis, and aging, whereas ACPA does not.",
                "Co-positivity for both RF and ACPA elevates rheumatoid arthritis diagnostic specificity to virtually 100%.",
                "ACPA positivity mandates aggressive, early DMARD intervention to arrest structural radiographic joint erosions."
            ]
        }
    },
    105: {
        "whys": [
            "نادرست است؛ دلیل رد: سندرم تونل کارپ (CTS) به دلیل گلیکاسیون تاندون‌ها و احتباس آب، در دیابت بسیار شایع است.",
            "صحیح است (مشکلی که با دیابت توجیه نمی‌شود)؛ «کندروکلسینوز (Chondrocalcinosis / رسوب پیروفسفات کلسیم CPPD)» با بیماری دیابت ارتباط زمینه‌ای ندارد؛ بیماری‌های متابولیک زمینه‌ساز کندروکلسینوز عبارتند از: «هایپرپاراتیروئیدیسم، هموکروماتوز، هیپومنیزیمی و هیپوفسفاتازی»؛ در حالی که عوارض شایع موسکولواسکلتال دیابت شامل چیروآرتروپاتی، شانه منجمد، CTS و انقباض دوپویترن هستند.",
            "نادرست است؛ دلیل رد: محدودیت حرکتی مفاصل (Limited joint mobility / Cheiroarthropathy دیابتی) علامت کلاسیک دیابت است.",
            "نادرست است؛ دلیل رد: کپسولیت چسبنده شانه (شانه منجمد) شیوع بسیار بالایی تا ۲۰ درصد در مبتلایان به دیابت دارد."
        ],
        "exp": "کندروکلسینوز با هموکروماتوز و هایپرپاراتیروئیدیسم مرتبط است و جزء عوارض اسکلتی بیماری دیابت نیست.",
        "micro": {
            "lead_fa": "عوارض اسکلتی-عضلانی شایع دیابت ملیتوس ناشی از گلیکاسیون پیشرفته کلاژن (AGEs) و اختلالات میکروواسکولار هستند و شامل: ۱) کپسولیت چسبنده شانه (Adhesive capsulitis)؛ ۲) سندرم محدودیت حرکتی مفاصل دست (Cheiroarthropathy یا پدیده Prayer sign)؛ ۳) سندرم تونل کارپ (CTS)؛ ۴) انقباض دوپویترن؛ ۵) تنوسینوویت فلکسور (انگشت ماشه‌ای)؛ ۶) مفصل شارکو. در نقطه مقابل، کندروکلسینوز (CPPD) وابسته به هموکروماتوز و اختلالات کلسیم/منیزیم است نه دیابت.",
            "lead_en": "Musculoskeletal complications of diabetes mellitus arise from non-enzymatic collagen glycation and microvascular microangiopathy, classically comprising adhesive capsulitis, diabetic cheiroarthropathy (limited joint mobility), carpal tunnel syndrome, and Charcot neuroarthropathy. Chondrocalcinosis (CPPD) is etiologically tied to hyperparathyroidism and hemochromatosis, not diabetes.",
            "golden_fa": "عوارض موسکولواسکلتال دیابت: شانه منجمد، چیروآرتروپاتی، CTS؛ کندروکلسینوز جزء عوارض دیابت نیست.",
            "golden_en": "Musculoskeletal complications of diabetes: frozen shoulder, cheiroarthropathy, CTS; chondrocalcinosis is not linked to diabetes.",
            "points_fa": [
                "علامت دست زدن عبادت‌گونه (Prayer sign) ناشی از محدودیت حرکتی پوست و مفاصل دست دیابتی‌ها است.",
                "بیماری هموکروماتوز کلاسیک‌ترین عامل ایجاد کندروکلسینوز مفاصل است.",
                "انقباض دوپویترن با ضخیم شدن و گره‌های فاسیای کف دست در دیابت بسیار شایع است.",
                "نوروآرتروپاتی شارکو ناشی از نوروپاتی حسی دیابتی منجر به فروپاشی مفاصل پا و قوزک می‌شود."
            ],
            "points_en": [
                "The 'prayer sign' illustrates inability to approximate palmar digital surfaces due to advanced periarticular contracture.",
                "Hereditary hemochromatosis is the quintessential metabolic disorder driving secondary chondrocalcinosis.",
                "Dupuytren's contracture involves nodular palmar fascial fibromatosis disproportionately elevated in diabetes.",
                "Charcot neuroarthropathy precipitates architectural collapse of the midfoot secondary to severe diabetic neuropathy."
            ]
        }
    },
    106: {
        "whys": [
            "نادرست است؛ دلیل رد: بتابلوکرها رنین را مهار می‌کنند اما در کریز کلیوی اسکلرودرمی داروی نجات‌بخش نبوده و جریان خون محیطی را بدتر می‌کنند.",
            "صحیح است؛ بروز سردرد شدید، فشار خون بالا و نارسایی حاد کلیه (افزایش کراتینین و پروتئینوری) در یک بیمار اسکلرودرمی، اورژانس تهدیدکننده حیات «بحران کلیوی اسکلرودرمی (Scleroderma Renal Crisis / SRC)» ناشی از هایپرپلازی لایه اینتیما و افزایش وحشتناک ترشح رنین است؛ داروی خط اول، نجات‌بخش و الزامی، شروع فوری یک داروی مهارکننده آنزیم تبدیل‌کننده آنژیوتانسین با اثر کوتاه نظیر «کاپتوپریل (Captopril)» با تیتراسیون سریع دوز است.",
            "نادرست است؛ دلیل رد: لوزارتان و ARBها در مطالعات برای نجات جان در کریز کلیوی اسکلرودرمی معادل ACEIها عمل نکرده‌اند و کاپتوپریل انتخاب اول است.",
            "نادرست است؛ دلیل رد: آملودیپین داروی کمکی است و به تنهایی نمی‌تواند محور رنین-آنژیوتانسین را برای نجات کلیه مهار سازد."
        ],
        "exp": "کاپتوپریل (مهارکننده ACE) داروی نجات‌بخش خط اول در درمان بحران کلیوی اسکلرودرمی (Scleroderma Renal Crisis) است.",
        "micro": {
            "lead_fa": "بحران کلیوی اسکلرودرمی (SRC) یک اورژانس تهدیدکننده حیات در بیماران اسکلروز سیستمیک (به‌ویژه با فرم منتشر و در حضور Anti-RNA Polymerase III) است. مشخصات: شروع ناگهانی پرفشاری خون بدخیم، نارسایی حاد کلیه و آنمی همولیتیک میکروآنژیوپاتیک (MAHA). مکانیسم ایسکمی شدید قشر کلیه و طوفان رنین است. کاپتوپریل خوراکی سریع‌الاثر داروی انتخابی خط اول است که فشار خون را سریعاً مهار کرده و مورتالیتی را از بالای ۹۰٪ به زیر ۳۰٪ رسانده است.",
            "lead_en": "Scleroderma renal crisis (SRC) is an ominous medical emergency precipitated by renal cortical vasospasm and exuberant renin secretion, triggering malignant hypertension, acute renal failure, and microangiopathic hemolytic anemia. Prompt titration of short-acting ACE inhibitors, specifically captopril, represents the indisputable, life-saving gold standard of therapy.",
            "golden_fa": "فشار خون بالا و نارسایی کلیه در اسکلرودرمی (SRC) = درمان نجات‌بخش فوری: کاپتوپریل (ACEI).",
            "golden_en": "Hypertension and renal failure in scleroderma (SRC) = emergent life-saving therapy: captopril (ACE inhibitor).",
            "points_fa": [
                "مصرف کورتیکواستروئیدها با دوز بیش از ۱۵ میلی‌گرم در روز مهم‌ترین عامل خطر آغازگر کریز کلیوی است.",
                "کاپتوپریل خوراکی هر ۸ ساعت تجویز شده و تا کنترل کامل فشار خون تیتر می‌شود.",
                "حتی در صورت افزایش ملایم اولیه کراتینین، مصرف مهارکننده ACE نباید قطع گردد.",
                "دیالیز موقت ممکن است لازم شود اما پس از ماه‌ها کارکرد کلیه در نیمی از بیماران بازمی‌گردد."
            ],
            "points_en": [
                "High-dose corticosteroid exposure (>15 mg/day prednisone) represents the primary iatrogenic trigger for SRC.",
                "Short-acting oral captopril is titrated rapidly every 8 hours toward normalized systolic parameters.",
                "Mild transient elevations in creatinine during ACE-inhibitor initiation must not prompt drug withdrawal.",
                "Temporary hemodialysis may be required; half of successfully treated patients eventually recover renal function."
            ]
        }
    },
    107: {
        "whys": [
            "نادرست است؛ دلیل رد: فتق دیسک شایع‌ترین علت رادیکولوپاتی و انتشار درد از کمر به اندام تحتانی است.",
            "نادرست است؛ دلیل رد: هیپرتروفی فاست می‌تواند موجب دردهای انتشاری سودورادیکولار به باسن و پشت ران گردد.",
            "نادرست است؛ دلیل رد: تنگی کانال نخاعی علت اصلی لنگش عصبی و انتشار درد دوطرفه به ساق پاها است.",
            "صحیح است (بیماری‌ای که درد ارجاعی به اندام تحتانی نمی‌دهد)؛ «کشیدگی و آسیب لیگامانی یا عضلانی کمر (Sprain/Strain)» پاتولوژی موضعی عضلات پارااسپینال و بافت نرم است که تنها موجب «درد موضعی و محوری در ناحیه کمر بدون هیچ‌گونه انتشار به اندام تحتانی» یا رادیکولوپاتی می‌گردد."
        ],
        "exp": "کشیدگی عضلانی کمر (Sprain/Strain) درد موضعی پارااسپینال ایجاد می‌کند و به اندام تحتانی انتشار نمی‌یابد.",
        "micro": {
            "lead_fa": "کمردردهای مکانیکی به دو دسته منتشر به اندام تحتانی (با انتشار رادیکولار یا سودورادیکولار) و دردهای موضعی غیرمنتشر تقسیم می‌شوند. فتق دیسک، تنگی کانال نخاعی و آرتروپاتی فاست سبب انتشار درد به زیر باسن، ران و ساق پا می‌شوند. در مقابل، کشیدگی عضلات یا لیگامان‌های ستون فقرات (Lumbar muscle strain/sprain) شایع‌ترین علت کمردرد حاد است که درد را کاملاً در ناحیه لومبار متمرکز نگه می‌دارد و به هیچ وجه به زیر زانو یا اندام تحتانی انتشار نمی‌دهد.",
            "lead_en": "Acute lumbar sprain and strain represents the most prevalent etiology of mechanical back pain, restricted to micro-tearing within paraspinal musculature and ligaments. Symptoms remain purely axial and localized across the lumbar spine and paraspinal muscles without radiating into the lower extremities, in stark contrast to herniated discs, facet arthropathy, or canal stenosis.",
            "golden_fa": "کشیدگی عضله کمر (Strain): درد موضعی محوری کمر بدون هیچ‌گونه انتشار به اندام تحتانی.",
            "golden_en": "Lumbar sprain/strain: localized axial back pain without radiation into the lower extremities.",
            "points_fa": [
                "اسپاسم عضلات پاراورتبرال و تندرنس موضعی در لمس عضلانی علامت اصلی اسپراین کمر است.",
                "معاینه نورولوژیک شامل قدرت، حس، رفلکس‌ها و تست SLR در کشیدگی عضله کاملاً نرمال است.",
                "استراحت در بستر بیش از ۱ تا ۲ روز روند بهبودی را به تأخیر می‌اندازد.",
                "درمان با ورزش‌های سبک، گرمای موضعی و مسکن‌های ساده غیراستروئیدی ظرف ۲ تا ۴ هفته منجر به بهبودی کامل می‌شود."
            ],
            "points_en": [
                "Prominent paraspinal muscle spasm and localized palpation tenderness delineate acute myofascial strain.",
                "Neurological examination (motor strength, light touch sensation, DTRs, and SLR) is strictly unremarkable.",
                "Bed rest exceeding 1-2 days delays functional recovery and worsens biomechanical deconditioning.",
                "Gentle early ambulation, superficial heat application, and oral NSAIDs yield recovery within 2 to 4 weeks."
            ]
        }
    },
    108: {
        "whys": [
            "نادرست است؛ دلیل رد: ANA در لوپوس و بسیاری از بیماری‌های بافت همبند مثبت می‌شود و اختصاصیتی برای تشخیص قطعی آرتریت روماتوئید ندارد.",
            "نادرست است؛ دلیل رد: فاکتور روماتوئید (RF) در عفونت‌های مزمن و بیماری‌های مختلف مثبت کاذب بالایی داشته و اختصاصیت آن متوسط است.",
            "صحیح است؛ در بیماری با پلی‌آرتریت مفاصل کوچک دست‌ها و زانوها با شک به آرتریت روماتوئید، تست «آنتی‌بادی ضد پپتید سیترولینه حلقوی (Anti-CCP / ACPA)» با «اختصاصیت فوق‌العاده بالا (بیش از ۹۶ تا ۹۸ درصد)» بالاترین ارزش تشخیصی را داشته و قطعی‌کننده تشخیص نهایی بیماری است.",
            "نادرست است؛ دلیل رد: آنالیز مایع مفصلی تنها ماهیت التهابی مایع را نشان می‌دهد و نوع بیماری زمینه‌ای را اختصاصاً اثبات نمی‌کند."
        ],
        "exp": "تست Anti-CCP با اختصاصیت بالای ۹۶ تا ۹۸ درصد، اختصاصی‌ترین آزمون سرولوژیک برای تأیید نهایی آرتریت روماتوئید است.",
        "micro": {
            "lead_fa": "در ارزیابی آزمایشگاهی پلی‌آرتریت التهابی مفاصل کوچک دست، اگرچه حساسیت آنتی‌بادی Anti-CCP و فاکتور روماتوئید (RF) تقریباً برابر است (حدود ۷۰٪)، اما اختصاصیت Anti-CCP به مراتب بالاتر است (بیش از ۹۶٪ در مقایسه با ۷۵٪ تا ۸۰٪ برای RF). مثبت بودن Anti-CCP تقریباً با اطمینان کامل آرتریت روماتوئید را از هپاتیت C، لوپوس و شوگرن تفکیک می‌کند و علاوه بر آن، پیش‌بینی‌کننده بروز آسیب و تخریب فرسایشی زودهنگام مفاصل است.",
            "lead_en": "In early inflammatory symmetric polyarthritis affecting small hand joints, anti-cyclic citrullinated peptide (anti-CCP) antibodies provide unrivaled diagnostic specificity (>96-98%) for rheumatoid arthritis. Its specificity dramatically surpasses rheumatoid factor, confirming the definitive diagnosis while reliably predicting erosive radiographic joint progression.",
            "golden_fa": "اختصاصی‌ترین تست سرولوژیک برای اثبات قطعی آرتریت روماتوئید = آزمایش Anti-CCP.",
            "golden_en": "Most specific serologic test for confirming rheumatoid arthritis = anti-CCP antibody testing.",
            "points_fa": [
                "تست Anti-CCP به صورت رسمی در کرایتریای طبقه‌بندی سال ۲۰۱۰ ACR/EULAR قرار گرفته است.",
                "فاکتور روماتوئید در سندرم شوگرن، هپاتیت C مزمن و سنین بالا مکرراً مثبت کاذب می‌شود.",
                "حضور همزمان RF و Anti-CCP ویژگی تشخیصی را به نزدیک ۱۰۰ درصد می‌رساند.",
                "مثبت بودن Anti-CCP اندیکاسیون شروع زودهنگام و تهاجمی داروهای DMARD (نظیر متوترکسات) است."
            ],
            "points_en": [
                "Anti-CCP testing contributes maximal weight within the validated 2010 ACR/EULAR classification criteria.",
                "Rheumatoid factor frequently yields false-positive elevations across chronic viral hepatitis and healthy elderly cohorts.",
                "Concurrent positivity for both RF and ACPA elevates rheumatoid arthritis diagnostic specificity to virtually 100%.",
                "High-titer ACPA warrants early aggressive DMARD therapy (e.g., methotrexate) to prevent joint destruction."
            ]
        }
    },
    109: {
        "whys": [
            "صحیح است (مشکل مفصلی که با لوپوس توجیه نمی‌شود)؛ آرتریت در بیماری لوپوس اریتماتوی سیستمیک به طور کلاسیک و پاتوگنومونیک «غیراروزیو (Non-erosive arthritis)» است و در رادیوگرافی ساده «هیچ‌گونه خوردگی یا اروزیون استخوانی (Bone Erosion)» در مفاصل مچ دست دیده نمی‌شود؛ مشاهده اروزیون استخوانی در مچ دست نشانه بارز آرتریت روماتوئید است نه لوپوس.",
            "نادرست است؛ دلیل رد: نکروز آواسکولار سر فمور هیپ (AVN) به دنبال واسکولیت عروقی و مصرف کورتیکواستروئید در بیماران لوپوسی شایع است.",
            "نادرست است؛ دلیل رد: آرتروپاتی جاکود (Jaccoud) دفورمیتی مفصلی جاافتادنی بدون اروزیون است که در لوپوس رخ می‌دهد.",
            "نادرست است؛ دلیل رد: پلی‌آرتریت التهابی قرینه مفاصل شایع‌ترین تظاهر اسکلتی در شروع بیماری لوپوس است."
        ],
        "exp": "آرتریت در لوپوس کاملاً غیراروزیو (Non-erosive) است؛ وجود اروزیون در رادیوگرافی با SLE قابل توجیه نیست و به نفع RA است.",
        "micro": {
            "lead_fa": "آرتریت در لوپوس اریتماتوی سیستمیک یک پلی‌آرتریت قرینه التهابی مفاصل کوچک دست و مچ است اما ویژگی بنیادین آن غیراروزیو بودن (Non-erosive) در رادیوگرافی است؛ برعکس آرتریت روماتوئید که غضروف و استخوان را سوراخ و تخریب می‌کند. دفورمیتی‌های دست در لوپوس (نظیر انحراف اولنار و گردن قو) تحت عنوان آرتروپاتی جاکود ناشی از شلی لیگامان‌ها و تاندون‌ها هستند و در معاینه کاملاً با دست جا می‌افتند و اروزیون ندارند.",
            "lead_en": "Articular involvement in systemic lupus erythematosus is characteristically inflammatory, symmetric, and strictly non-erosive on plain radiography, in marked contrast to the destructive osseous erosions typical of rheumatoid arthritis. Reversible deformities like Jaccoud's arthropathy stem from ligamentous laxity rather than bone destruction.",
            "golden_fa": "آرتریت لوپوس همیشه غیراروزیو است؛ وجود اروزیون استخوانی در رادیوگرافی با لوپوس توجیه نمی‌شود.",
            "golden_en": "Lupus arthritis is strictly non-erosive; the presence of bone erosions on radiography is incompatible with simple SLE.",
            "points_fa": [
                "آرتروپاتی جاکود در لوپوس با شلی کپسول و تاندون‌ها همراه است و دفورمیتی‌ها کاملاً جاافتادنی (Reducible) هستند.",
                "نکروز آواسکولار هیپ (AVN) عارضه شناخته‌شده مصرف کورتون و واسکولوپاتی در لوپوس است.",
                "وجود توأم علائم لوپوس و اروزیون رادیولوژیک به عنوان سندرم Rhupus نامیده می‌شود.",
                "درمان آرتریت لوپوس بر مصرف هیدروکسی‌کلروکین و دوزهای پایین پردنیزولون استوار است."
            ],
            "points_en": [
                "Jaccoud's arthropathy features tendon laxity resulting in completely reducible hand deformities without erosions.",
                "Avascular osteonecrosis of the femoral head represents a prominent hazard of steroid therapy and vasculopathy in SLE.",
                "The exceptional overlap of true erosive polyarthritis alongside systemic lupus is designated 'Rhupus'.",
                "Lupus articular flares are managed with hydroxychloroquine and low-dose corticosteroid bridging."
            ]
        }
    },
    110: {
        "whys": [
            "نادرست است؛ دلیل رد: لوپوس به تنهایی سابقه لخته شدن ورید عمقی (DVT) را به صورت خودبه‌خود توضیح نمی‌دهد و همراهی سندرم آنتی‌فسفولیپید مطرح است.",
            "صحیح است؛ وجود آرتریت مفاصل، راش پروانه‌ای روی گونه‌ها، لکوپنی و ترومبوسیتوپنی معیارهای بالینی و هماتولوژیک لوپوس سیستمیک (SLE) را پر می‌کند؛ علاوه بر آن، بروز ترومبوز وریدی عروق عمقی (DVT اندام تحتانی) همراه با ترومبوسیتوپنی در این خانم جوان، حضور توأم و ثانویه «سندرم آنتی‌فسفولیپید (Antiphospholipid Syndrome / APS ثانویه به لوپوس)» را مسجل می‌سازد.",
            "نادرست است؛ دلیل رد: واسکولیت اولیه تابلوی درگیری عروقی متفاوت با آنوریسم یا پورپورا می‌دهد و راش پروانه‌ای لوپوس را ندارد.",
            "نادرست است؛ دلیل رد: درماتومیوزیت ضعف پروکسیمال عضلات ایجاد می‌کند و علت ترومبوز وریدی DVT نیست."
        ],
        "exp": "آرتریت و راش پروانه‌ای همراه با سابقه DVT و ترومبوسیتوپنی، بیانگر سندرم آنتی‌فسفولیپید ثانویه به لوپوس (Secondary APS) است.",
        "micro": {
            "lead_fa": "سندرم آنتی‌فسفولیپید ثانویه در ۲۰ تا ۳۰ درصد بیماران مبتلا به لوپوس سیستمیک رخ می‌دهد. این سندرم با تظاهر توأم حوادث ترومبوتیک (ترومبوز وریدی DVT، آمبولی ریه، سکته مغزی)، عوارض مامایی (سقط‌های مکرر) و آنتی‌بادی‌های آنتی‌فسفولیپید (لوپوس آنتی‌کواگولانت، آنتی‌کاردولیپین و Anti-beta2GPI) مشخص می‌شود. ترومبوسیتوپنی ملایم تا متوسط همراهی شاخص APS و لوپوس است.",
            "lead_en": "Secondary antiphospholipid syndrome (APS) complicates 20-30% of systemic lupus erythematosus cohorts. Diagnostic classification hinges on demonstrated clinical vascular thrombosis (deep vein thrombosis, pulmonary embolism, stroke) or obstetric morbidities occurring in the setting of persistent antiphospholipid antibodies, often marked by baseline thrombocytopenia.",
            "golden_fa": "علائم بالینی لوپوس + ترومبوز وریدی DVT یا شریانی = لوپوس و سندرم آنتی‌فسفولیپید (APS).",
            "golden_en": "Clinical lupus features + deep vein thrombosis (DVT) = systemic lupus erythematosus complicated by APS.",
            "points_fa": [
                "تست‌های سرولوژیک شامل لوپوس آنتی‌کواگولانت، آنتی‌کاردولیپین و آنتی-بتا۲-گلیکوپروتئین ۱ هستند.",
                "درمان بیماران دچار ترومبوز قطعی، تجویز ضدانعقاد خوراکی مادام‌العمر (وارفارین با هدف INR ۲ تا ۳) است.",
                "مصرف هیدروکسی‌کلروکین ریسک وقایع ترومبوتیک را در مبتلایان به لوپوس به طور معناداری کاهش می‌دهد.",
                "داروهای ضد انعقاد نوین (DOACs) در بیماران ترومبوتیک APS با خطر عود بالا توصیه نمی‌شوند."
            ],
            "points_en": [
                "Laboratory criteria mandate documented lupus anticoagulant, anticardiolipin, or anti-beta-2-glycoprotein-I positivity.",
                "Established venous thrombosis requires indefinite therapeutic oral anticoagulation with warfarin (target INR 2.0-3.0).",
                "Concomitant hydroxychloroquine therapy exerts proven antithrombotic protection in lupus patients.",
                "Direct oral anticoagulants (DOACs) are inferior to warfarin, showing higher recurrent thrombosis rates in high-risk APS."
            ]
        }
    },
    111: {
        "whys": [
            "صحیح است؛ در معیارهای تشخیصی و طبقه‌بندی آرتریت روماتوئید (2010 ACR/EULAR Classification Criteria)، درگیری مفصلی بر اساس تعداد و اندازه مفاصل دارای بیشترین وزن است؛ درگیری بیش از ۱۰ ناحیه مفصلی که حداقل شامل یک مفصل کوچک باشد «بالاترین امتیاز ممکن یعنی ۵ امتیاز (از ۱۰ امتیاز کل)» را به خود اختصاص می‌دهد؛ در حالی که تیتر بالای Anti-CCP حداکثر ۳ امتیاز و افزایش ESR فقط ۱ امتیاز دارد.",
            "نادرست است؛ دلیل رد: مثبت بودن تیتر بالای Anti-CCP حداکثر ۳ امتیاز در سیستم نمره‌دهی دارد.",
            "نادرست است؛ دلیل رد: مثبت بودن RF با عیار بالا نیز ۳ امتیاز به همراه دارد.",
            "نادرست است؛ دلیل رد: افزایش نشانگرهای فاز حاد (ESR یا CRP) فقط ۱ امتیاز دارد."
        ],
        "exp": "در معیارهای ACR/EULAR برای RA، درگیری بیش از ۱۰ مفصل با ۵ امتیاز، بالاترین امتیاز جدول را دارد.",
        "micro": {
            "lead_fa": "معیارهای تشخیصی ACR/EULAR 2010 برای آرتریت روماتوئید شامل ۴ دسته نمره‌دهی است (کسب حداقل ۶ از ۱۰ امتیاز تشخیص را اثبات می‌کند): ۱) درگیری مفصلی: بیش از ۱۰ مفصل با حداقل یک مفصل کوچک بالاترین امتیاز یعنی ۵ امتیاز را دارد؛ ۲) سرولوژی: تیتر بالای RF یا Anti-CCP دارای ۳ امتیاز است؛ ۳) مارکرهای فاز حاد: افزایش ESR یا CRP دارای ۱ امتیاز است؛ ۴) مدت زمان علائم: بالای ۶ هفته دارای ۱ امتیاز است.",
            "lead_en": "The 2010 ACR/EULAR Rheumatoid Arthritis Classification Criteria allocate weighted scores across 4 domains (threshold ≥6/10 for diagnosis). Joint involvement carries the highest single weight, where >10 joints (incorporating at least 1 small joint) receives 5 points, contrasted with high-titer serology (3 points) and abnormal acute-phase reactants (1 point).",
            "golden_fa": "بالاترین امتیاز در کرایتریای آرتریت روماتوئید: درگیری بیش از ۱۰ مفصل (۵ امتیاز از ۱۰).",
            "golden_en": "Highest single score in 2010 RA criteria: involvement of >10 joints (5 out of 10 points).",
            "points_fa": [
                "بیمار این سوال: ۵ امتیاز (مفاصل) + ۳ امتیاز (سرولوژی) + ۱ امتیاز (ESR) + ۱ امتیاز (مدت علائم) = ۱۰ از ۱۰.",
                "مفاصل کوچک شامل MCPها، PIPها، مفاصل MTP و مچ دست هستند.",
                "مفاصل DIP، اولین MTP و اولین CMC در این سیستم نمره‌دهی برای RA شمارش نمی‌شوند.",
                "سیستم نمره‌دهی با هدف تشخیص و درمان زودهنگام قبل از تخریب استخوانی طراحی شده است."
            ],
            "points_en": [
                "Patient scoring: 5 (joints) + 3 (high-positive ACPA) + 1 (ESR) + 1 (duration >6 weeks) = 10/10 points.",
                "Small joints evaluated encompass MCPs, PIPs, wrists, and MTPs 2 through 5.",
                "DIPs, first MTP, and first CMC joints are excluded from joint counts as classic sites of osteoarthritis.",
                "The criteria emphasize early disease classification prior to irreversible structural radiographic erosion."
            ]
        }
    },
    112: {
        "whys": [
            "نادرست است؛ دلیل رد: نکروز آواسکولار سر فمور درد عمقی کشاله ران (Groin pain) ایجاد می‌کند نه تندرنس موضعی در برجستگی لترال هیپ.",
            "نادرست است؛ دلیل رد: آرتریت ساکروایلیاک در ناحیه باسن و پشت لگن درد می‌دهد و تندرنس تروکانتر ندارد.",
            "نادرست است؛ دلیل رد: آرتریت خود مفصل هیپ با درد کشاله ران و محدودیت چرخش داخلی مشخص می‌شود نه تندرنس لترال.",
            "صحیح است؛ درد در ناحیه لترال و خارجی مفصل ران (هیپ) که به قسمت خارجی و قدام ران انتشار دارد، همراه با تندرنس موضعی در لمس مستقیم روی برجستگی تروکانتر بزرگ فمور و تشدید درد با ابداکسیون مقاومتی پا، تابلوی کلاسیک و پاتوگنومونیک «بورسیت تروکانتریک (Trochanteric Bursitis / سندرم درد تروکانتر بزرگ GTPS)» است."
        ],
        "exp": "درد لترال هیپ با تندرنس روی برجستگی تروکانتر بزرگ، مشخصه پاتوگنومونیک بورسیت تروکانتریک (GTPS) است.",
        "micro": {
            "lead_fa": "سندرم درد تروکانتر بزرگ (Greater Trochanteric Pain Syndrome) که قبلاً بورسیت تروکانتریک نامیده می‌شد ناشی از تاندینوپاتی تاندون‌های گلوتئوس مدیوس و مینیموس و التهاب بورس روی تروکانتر بزرگ فمور است. علائم مشخصه: درد سطح لترال هیپ که به ران انتشار می‌یابد، ناتوانی در خوابیدن روی سمت مبتلا، تندرنس موضعی در لمس دقیق روی تروکانتر بزرگ و تشدید درد با ابداکسیون مقاومتی ران. دردهای خود مفصل ران برخلاف آن در کشاله ران حس می‌شوند.",
            "lead_en": "Greater trochanteric pain syndrome (trochanteric bursitis) encompasses gluteus medius/minimus tendinopathy and secondary bursitis. The hallmark physical finding is exquisite focal palpation tenderness directly overlying the greater trochanteric bony prominence, aggravated by lying on the ipsilateral side and resisted hip abduction, sparing true groin range.",
            "golden_fa": "درد و تندرنس موضعی در سطح خارجی و لترال ران روی برجستگی استخوانی = بورسیت تروکانتریک.",
            "golden_en": "Lateral hip pain with focal tenderness over the bony prominence = trochanteric bursitis (GTPS).",
            "points_fa": [
                "درد خود مفصل ران (هیپ) همواره در کشاله ران (Groin) حس می‌شود نه در سطح خارجی لترال.",
                "بیماران از تشدید درد هنگام خوابیدن روی سمت درگیر شاکی هستند.",
                "درمان اولیه شامل کشش باند ایلیوتیبیال، NSAIDs و اصلاح الگوی راه رفتن است.",
                "تزریق موضعی کورتیکواستروئید داخل بورس تروکانتریک در بیش از ۸۰ درصد موارد درد را کاملاً برطرف می‌سازد."
            ],
            "points_en": [
                "True intra-articular hip joint pain reliably localizes to the anterior groin, not the lateral trochanteric aspect.",
                "Patients characteristically complain of intense discomfort when attempting to sleep on the affected hip.",
                "Initial conservative treatment combines iliotibial band stretching, short-course NSAIDs, and gait correction.",
                "Local bursa corticosteroid injection provides dramatic, long-lasting symptomatic relief in >80% of patients."
            ]
        }
    },
    113: {
        "whys": [
            "نادرست است؛ دلیل رد: ستون فقرات لومبار و کمر در آرتریت روماتوئید سالم می‌ماند و مبتلا نمی‌شود.",
            "نادرست است؛ دلیل رد: مهره‌های توراسیک در RA سالم می‌مانند.",
            "صحیح است؛ بیماری آرتریت روماتوئید (به‌ویژه فرم‌های سرپوزیتیو شدید و مزمن با سابقه ۱۵ ساله)، به طور کامل ستون فقرات توراسیک، کمری و مفاصل ساکروایلیاک را معاف و سالم می‌گذارد؛ تنها قسمت از اسکلت محوری (Axial Skeleton) که تمایل شدیدی برای ابتلا به سینوویت و تخریب مفصلی در RA دارد، «ستون فقرات گردنی (Cervical Spine)» به خصوص مفاصل سینوویال C1-C2 است که می‌تواند منجر به عارضه خطرناک سابلوکساسیون آتلانتواگزیال گردد.",
            "نادرست است؛ دلیل رد: مفاصل ساکروم و ساکروایلیاک در بیماری آرتریت روماتوئید درگیر نمی‌شوند و مشخصه اسپوندیلوآرتریت‌ها هستند."
        ],
        "exp": "ستون فقرات گردنی (Cervical Spine به ویژه مفاصل C1-C2) تنها بخش از اسکلت محوری است که در آرتریت روماتوئید مبتلا می‌شود.",
        "micro": {
            "lead_fa": "یک قانون بنیادین در روماتولوژی در مورد درگیری اسکلت محوری (Axial Skeleton) در آرتریت روماتوئید: بیماری RA ستون فقرات توراسیک، ستون فقرات کمری و مفاصل ساکروایلیاک را کاملاً معاف می‌گذارد. تنها بخش اسکلت محوری که درگیر می‌شود ستون فقرات گردن (Cervical spine) است؛ به دلیل وجود سینوویوم در مفاصل آتلانتواگزیال و فاست‌های گردنی. تخریب لیگامان ترانسورس C1-C2 منجر به سابلوکساسیون آتلانتواگزیال و خطر قطع نخاع می‌گردد.",
            "lead_en": "A fundamental tenet in rheumatology governs axial skeletal involvement in rheumatoid arthritis: RA strictly spares the thoracic spine, lumbar spine, and sacroiliac joints. The cervical spine (specifically the synovial atlantoaxial complex C1-C2 and subaxial facet joints) is the sole axial segment targeted, risking odontoid erosion, ligamentous laxity, and catastrophic cord compression.",
            "golden_fa": "تنها بخش اسکلت محوری که در آرتریت روماتوئید درگیر می‌شود = ستون فقرات گردنی (C1-C2).",
            "golden_en": "The only axial skeletal segment involved in rheumatoid arthritis = cervical spine (C1-C2 atlantoaxial region).",
            "points_fa": [
                "سابلوکساسیون آتلانتواگزیال با فاصله بیش از ۳ میلی‌متر بین دانس و قوس قدامی اطلس در گرافی فلکسیون تأیید می‌شود.",
                "درد پس‌سری گردن یا علائم میلوپاتی گردنی (هایپررفلکسی، علامت بابنسکی) زنگ خطر آسیب نخاعی است.",
                "بیماران مبتلا به RA مزمن قبل از لوله‌گذاری تراشه یا بیهوشی عمومی نیازمند بررسی رادیوگرافی گردن هستند.",
                "در صورت وجود بی‌ثباتی خطرناک گردنی، جراحی فیکساسیون و فیوژن اطلس به آکسیس (C1-C2) الزامی است."
            ],
            "points_en": [
                "Atlantoaxial subluxation is defined by an anterior atlantodental interval exceeding 3 mm on lateral flexion radiography.",
                "Occipital neck pain or cervical myelopathy signs (hyperreflexia, Babinski) herald impending cord compression.",
                "Chronic RA patients mandate routine cervical flexion-extension radiography prior to elective endotracheal intubation.",
                "Advanced instability or progressive neurological impairment warrants surgical C1-C2 posterior stabilization and fusion."
            ]
        }
    },
    114: {
        "whys": [
            "صحیح است؛ «آرتریت پسوریاتیک (Psoriatic Arthritis)» در یکی از الگوهای بالینی شایع خود تظاهر پلی‌آرتریت متقارن مفاصل کوچک دست‌ها و مچ (Symmetric Polyarthritis Pattern) ایجاد می‌کند که از نظر بالینی، توزیع مفاصل، خشکی صبحگاهی طولانی و ظاهر ظاهری «کاملاً با آرتریت روماتوئید اشتباه گرفته می‌شود (RA mimic)»؛ افتراق آن با منفی بودن RF/Anti-CCP، ابتلای همزمان DIPها، داکتیلیت و کشف پلاک‌های مخفی پسوریازیس در پوست سر و ناف است.",
            "نادرست است؛ دلیل رد: اسپوندیلیت آنکیلوزان تظاهر محوری غالب در ستون فقرات و ساکروایلییت دارد و با RA اشتباه نمی‌شود.",
            "نادرست است؛ دلیل رد: آرتریت بیماری کرون اولیگوآرتریت حاد مفاصل بزرگ اندام تحتانی همراه با علائم گوارشی است.",
            "نادرست است؛ دلیل رد: آرتریت راکتیو اولیگوآرتریت غیرقرینه مفاصل بزرگ پا با داکتیلیت است نه پلی‌آرتریت متقارن دست شبیه RA."
        ],
        "exp": "فرم پلی‌آرتریت متقارن آرتریت پسوریاتیک بیشترین شباهت بالینی را با آرتریت روماتوئید داشته و به راحتی با آن اشتباه می‌شود.",
        "micro": {
            "lead_fa": "آرتریت پسوریاتیک دارای پنج الگوی بالینی است که شایع‌ترین آن‌ها (حدود ۱۵ تا ۲۵ درصد) فرم پلی‌آرتریت متقارن است. این فرم مفاصل کوچک دست، مچ و زانوها را به صورت کاملاً قرینه درگیر کرده و تابلوی بالینی آرتریت روماتوئید را کاملاً تقلید می‌نماید. سرنخ‌های افتراق از RA: ابتلای مفاصل DIP، وجود تغییرات ناخنی (Pitting)، داکتیلیت سوسیسی، منفی بودن سرولوژی RF و عدم وجود ندول روماتیسمی است.",
            "lead_en": "Psoriatic arthritis exhibits several discrete phenotypic subforms; the symmetric polyarthritis pattern mimics rheumatoid arthritis so convincingly that it is frequently misdiagnosed as seronegative RA. Critical discriminators favoring PsA include concurrent distal interphalangeal (DIP) involvement, nail dystrophy/pitting, dactylitis, and absence of rheumatoid nodules/RF.",
            "golden_fa": "بیماری که بیشترین شباهت بالینی را با آرتریت روماتوئید دارد = فرم متقارن آرتریت پسوریاتیک.",
            "golden_en": "Disease whose clinical presentation most closely mimics rheumatoid arthritis = symmetric psoriatic arthritis.",
            "points_fa": [
                "درگیری مفاصل DIP در آرتریت روماتوئید رخ نمی‌دهد اما در آرتریت پسوریاتیک شایع است.",
                "پیدا کردن حفره‌دار شدن ناخن (Nail pitting) یا جدا شدن ناخن (Onycholysis) سرنخ قطعی پسوریازیس است.",
                "رادیوگرافی در آرتریت پسوریاتیک منظره مداد در فنجان (Pencil-in-cup) و استخوان‌سازی نشان می‌دهد.",
                "بیماران مبتلا به PsA معمولاً تست RF و Anti-CCP منفی دارند (سرونگاتیو هستند)."
            ],
            "points_en": [
                "DIP joint involvement is virtually absent in rheumatoid arthritis but distinctly frequent in psoriatic arthritis.",
                "Identifying discrete nail pitting or onycholysis serves as a vital diagnostic clue uncovering occult psoriasis.",
                "Radiographic imaging in PsA demonstrates destructive 'pencil-in-cup' osteolysis juxtaposed with periostitis.",
                "Patients presenting with psoriatic polyarthritis are characteristically seronegative for both RF and ACPA."
            ]
        }
    },
    115: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: کرایوگلوبولینمی پورپورای برجسته، هایپوکمپلمانمی شدید و گلومرولونفریت با سدیمان فعال ادراری ایجاد می‌کند نه سدیمان کاملاً نرمال.",
            "نادرست است؛ دلیل رد: لوپوس با راش مالار، آنتی‌بادی dsDNA و علائم سیستمیک متعدد دیگر همراه است.",
            "نادرست است؛ دلیل رد: پلی‌آنژئیت گرانولوماتوز (GPA) ضایعات گوش و حلق و بینی، درگیری کاویتاری ریه و گلومرولونفریت با رسوب ادراری فعال می‌دهد.",
            "صحیح است؛ تابلوی بیمار مسن با درد شکم و تهوع بعد از غذا خوردن (آنژین احشایی ناشی از ایسکمی مزانتریک / Intestinal Angina)، کاهش وزن، ناتوانی در دورسی‌فلکسیون مچ دست (فلج عصب رادیال ناشی از مونونوریت مولتیپلکس / Mononeuritis Multiplex)، نارسایی کلیوی همراه با «سدیمان ادراری کاملاً طبیعی (Normal urinary sediment به دلیل درگیری شریانچه‌های کلیه بدون ایجاد گلومرولونفریت)» و ESR بالا، تابلوی کلاسیک و پاتوگنومونیک «پلی‌آرتریت ندوزا (Polyarteritis Nodosa / PAN)» است."
        ],
        "exp": "درد شکم پس از غذا (آنژین روده)، فلج مچ دست و نارسایی کلیه با سدیمان ادراری نرمال، مشخصه پلی‌آرتریت ندوزا است.",
        "micro": {
            "lead_fa": "پلی‌آرتریت ندوزا (PAN) یک واسکولیت سیستمیک عروق متوسط است. شاخص‌ترین تظاهرات آن: ۱) آنژین روده با دردهای پس از صرف غذا به دلیل ایسکمی شریان‌های مزانتریک و کاهش وزن چشمگیر؛ ۲) مونونوریت مولتیپلکس (نظیر آسیب عصب رادیال با افتادگی مچ دست Wrist drop یا پرونئال با Foot drop)؛ ۳) نارسایی کلیوی ناشی از آرتریت شریان‌های متوسط کلیوی بدون ابتلای مویرگ‌های گلومرول، که باعث می‌شود رسوب و سدیمان ادراری کاملاً طبیعی باقی بماند.",
            "lead_en": "Polyarteritis nodosa (PAN) is a necrotizing vasculitis of medium-sized arteries. Landmark clinical manifestations include: 1) postprandial abdominal angina with severe weight loss resulting from mesenteric ischemia; 2) mononeuritis multiplex (such as radial nerve palsy causing wrist drop); and 3) renal insufficiency characterized by a completely normal urinary sediment due to sparing of glomerular capillaries.",
            "golden_fa": "آنژین روده پس از غذا + افتادگی مچ دست (مونونوریت) + نارسایی کلیه با سدیمان نرمال = پلی‌آرتریت ندوزا (PAN).",
            "golden_en": "Postprandial abdominal angina + wrist drop + renal insufficiency with normal sediment = polyarteritis nodosa.",
            "points_fa": [
                "آنژیوگرافی عروق مزانتر و رنال میکروآنوریسم‌های متعدد و تنگی‌های دانه‌تسبیحی را نشان می‌دهد.",
                "در بیماری‌های با درگیری عروق کوچک (ANCA واسکولیت‌ها و SLE)، گلومرولونفریت با کست خونی و سدیمان فعال رخ می‌دهد.",
                "بررسی سرولوژی عفونت هپاتیت B در تمام بیماران مبتلا به PAN اجباری است.",
                "درمان با کورتیکواستروئید با دوز بالا به تنهایی یا همراه با سیکلوفسفامید پاسخ بالینی عالی ایجاد می‌کند."
            ],
            "points_en": [
                "Catheter mesenteric/renal angiography uncovers pathognomonic saccular microaneurysms and arterial stenoses.",
                "Small-vessel vasculitides and SLE invariably induce active sediment with hematuria and red cell casts.",
                "Screening for underlying hepatitis B virus (HBV) surface antigen and DNA is clinically mandated.",
                "Systemic immunosuppression with high-dose corticosteroids paired with cyclophosphamide controls active vasculitis."
            ]
        }
    },
    116: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: کلسینوز جلدی (C در سندرم CREST) یکی از عوارض بسیار شایع در بیماران Anti-centromere مثبت است.",
            "نادرست است؛ دلیل رد: افزایش فشار شریان پولمونر (PAH) عارضه تهدیدکننده حیات تیپیک و شناخته‌شده در اسکلرودرمی محدود و بیماران Anti-centromere است.",
            "صحیح است (عارضه‌ای که کمتر بروز می‌کند)؛ «نارسایی کلیه و فشار خون بالا (بحران کلیوی اسکلرودرمی / Scleroderma Renal Crisis)» منحصراً در فرم منتشر جلدی اسکلرودرمی (Diffuse Cutaneous SSc) و همراه با آنتی‌بادی Anti-RNA Polymerase III رخ می‌دهد و در بیماران مبتلا به اسکلرودرمی محدود جلدی با آنتی‌بادی «Anti-Centromere» به ندرت و با شیوع بسیار اندک (کمتر از ۱ تا ۲ درصد) دیده می‌شود.",
            "نادرست است؛ دلیل رد: دیسفاژی و اختلالات حرکتی مری (E در سندرم CREST) در بیش از ۸۰ تا ۹۰ درصد بیماران آنتی‌سانترومر مثبت رخ می‌دهد."
        ],
        "exp": "بحران کلیوی و فشار خون بالا در اسکلرودرمی محدود با Anti-centromere نادر است و در فرم منتشر دیده می‌شود.",
        "micro": {
            "lead_fa": "اسکلرودرمی محدود جلدی (CREST syndrome) همراهی قوی با آنتی‌بادی آنتی‌سانترومر (Anti-centromere) دارد. عوارض شایع این گروه عبارتند از: پدیده رینود، کلسینوز زیرجلدی، دیسفاژی ناشی از آتونسیون مری، تلانژکتازی و به ویژه هایپرتانسیون شریان ریوی ایزوله (PAH). در نقطه مقابل، درگیری احشایی شدید کلیوی نظیر بحران کلیوی اسکلرودرمی (SRC) با فشار خون بدخیم، تقریباً منحصراً ویژه فرم منتشر جلدی و همراه با Anti-RNA Polymerase III است و در بیماران سنترومرمثبت فوق‌العاده نادر است.",
            "lead_en": "Anti-centromere-positive limited cutaneous systemic sclerosis (CREST syndrome) characteristically exhibits calcinosis, severe Raynaud's, esophageal dysmotility, and late isolated pulmonary arterial hypertension (PAH). Scleroderma renal crisis and rapidly progressive renal failure are extraordinarily rare in this subset, occurring predominantly in diffuse systemic sclerosis with anti-RNA polymerase III.",
            "golden_fa": "عارضه‌ای که در اسکلرودرمی محدود با Anti-centromere کمتر بروز می‌کند = نارسایی کلیه و بحران فشار خون.",
            "golden_en": "Complication distinctly rare in anti-centromere limited SSc = scleroderma renal crisis and hypertension.",
            "points_fa": [
                "بحران کلیوی اسکلرودرمی عمدتاً در فرم منتشر و در حضور آنتی‌بادی Anti-RNA polymerase III رخ می‌دهد.",
                "هایپرتانسیون ریوی ایزوله در ۱۰ تا ۱۵ درصد بیماران Anti-centromere مثبت ایجاد می‌شود.",
                "کلسینوز جلدی در دست‌ها و آرنج‌ها می‌تواند باعث زخم‌های پوستی دردناک شود.",
                "اختلال حرکتی دوسوم دیستال مری مسبب رفلاکس اسیدی شدید و دیسفاژی به جامدات است."
            ],
            "points_en": [
                "Scleroderma renal crisis is heavily clustered within diffuse cutaneous disease linked to anti-RNA polymerase III.",
                "Isolated pulmonary arterial hypertension develops in 10-15% of anti-centromere patients, requiring screening echo.",
                "Subcutaneous dystrophic calcinosis across fingers and extensor elbows precipitates painful skin ulcerations.",
                "Smooth muscle atrophy in the distal two-thirds of the esophagus drives refractory reflux and dysphagia."
            ]
        }
    },
    117: {
        "whys": [
            "نادرست است؛ دلیل رد: Anti-Smith اختصاصی‌ترین آنتی‌بادی لوپوس است اما نقشی در فتوسنسیتیویتی پوستی و بلوک قلبی جنین ندارد.",
            "صحیح است؛ آنتی‌بادی «Anti-SSA (یا Anti-Ro)» در بیماران لوپوسی هم با بروز «ضایعات پوستی حساس به نور (فتوسنسیتیویتی و لوپوس پوستی تحت حاد SCLE)» ارتباط مستقیم دارد و هم با عبور از جفت مادر در دوران بارداری و ایجاد میوکاردیت در بافت هدایتی قلب جنین، مسبب بروز عارضه خطیر «بلوک کامل قلبی مادرزادی نوزاد (Congenital Heart Block در لوپوس نوزادی)» است.",
            "نادرست است؛ دلیل رد: Anti-dsDNA با نفریت لوپوسی و فعالیت سیستمیک در ارتباط است نه بلوک قلبی نوزاد.",
            "نادرست است؛ دلیل رد: Anti-U1-RNP آنتی‌بادی اختصاصی بیماری بافت همبند مختلط (MCTD) است."
        ],
        "exp": "آنتی‌بادی Anti-SSA (Ro) عامل اصلی ضایعات پوستی حساس به نور (SCLE) و بلوک مادرزادی هدایت قلبی در نوزاد است.",
        "micro": {
            "lead_fa": "آنتی‌بادی Anti-SSA/Ro با دو تظاهر بالینی برجسته در بیماران لوپوسی پیوند خورده است: ۱) درماتولوژی: حساسیت شدید پوستی به نور خورشید و راش‌های حلقوی یا پاپولواسکواموس لوپوس جلدی ساب‌کیوت (SCLE)؛ ۲) بارداری و نوزاد: آنتی‌بادی‌های ضد Ro از سد جفتی عبور کرده، به فیبرهای هدایتی گره دهلیزی-بطنی قلب جنین متصل شده و بلوک کامل دهلیزی-بطنی (Complete congenital heart block) غیرقابل برگشت ایجاد می‌کنند.",
            "lead_en": "Anti-SSA (anti-Ro) autoantibodies are intimately tied to photosensitive cutaneous lupus erythematosus (subacute cutaneous LE) and transplacental autoimmune fetal injury. Maternal IgG crossing the placenta targets fetal AV nodal cardiac tissue, permanently scarring conduction pathways to induce congenital third-degree heart block in neonatal lupus syndrome.",
            "golden_fa": "ضایعات پوستی حساس به نور + بلوک قلبی مادرزادی نوزاد = آنتی‌بادی Anti-SSA (Anti-Ro).",
            "golden_en": "Photosensitive skin rash + neonatal congenital heart block = anti-SSA (anti-Ro) autoantibodies.",
            "points_fa": [
                "خطر بلوک قلبی مادرزادی در نوزاد مادر Anti-Ro مثبت در اولین بارداری حدود ۲ درصد و در بارداری بعدی تا ۱۸ درصد است.",
                "پایش با اکوکاردیوگرافی سریال جنینی بین هفته‌های ۱۶ تا ۲۶ بارداری هر هفته یا دو هفته توصیه می‌شود.",
                "ضایعات پوستی لوپوس نوزادی خودبه‌خود با پاک شدن آنتی‌بادی‌های مادری ظرف ۶ ماه بهبود می‌یابند.",
                "بلوک قلبی جنین در صورت استقرار کامل غیرقابل برگشت بوده و نیازمند تعبیه ضربان‌ساز (Pacemaker) دائمی پس از تولد است."
            ],
            "points_en": [
                "Congenital heart block risk in an anti-Ro-positive pregnancy is ~2%, escalating to ~18% after an affected child.",
                "Serial fetal Doppler echocardiography is rigorously conducted every 1-2 weeks from gestational weeks 16 to 26.",
                "Neonatal cutaneous lupus rash spontaneously wanes within 6 months as transplacental maternal antibodies clear.",
                "Complete fetal AV block is irreversible, ultimately necessitating permanent cardiac pacemaker implantation at birth."
            ]
        }
    },
    118: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: مانور یرگاسون (Yergason) برای تشخیص تاندونیت عضله دوسربازویی (بای‌سپس) در شانه به کار می‌رود.",
            "صحیح است؛ درد در سمت رادیال مچ دست که با حرکت شست تشدید می‌شود در یک مادر جوان پس از زایمان (حمل و بلند کردن مکرر نوزاد)، تابلوی تنوسینوویت دکوئروان (De Quervain's Tenosynovitis) است؛ آزمون بالینی پاتوگنومونیک و اختصاصی برای اثبات این بیماری «تست فینکلشتاین (Finkelstein's Test)» است که با قرار دادن شست درون مشت بسته و انجام انحراف اولنار فعال یا غیرفعال مچ دست، درد شدیدی را در زائده استیلوئید رادیوس بازتولید می‌کند.",
            "نادرست است؛ دلیل رد: علامت تینل (Tinel) با دق روی عصب مدین در مچ دست برای تشخیص سندرم تونل کارپ (CTS) به کار می‌رود.",
            "نادرست است؛ دلیل رد: دورسی‌فلکسیون مقاومتی مچ دست برای بررسی اپی‌کوندیلیت لترال آرنج (آرنج تنیس‌بازان) استفاده می‌شود."
        ],
        "exp": "تست فینکلشتاین (انحراف اولنار مچ با شست خمیده در مشت) آزمون اختصاصی تشخیصی تنوسینوویت دکوئروان است.",
        "micro": {
            "lead_fa": "تنوسینوویت دکوئروان (De Quervain tenosynovitis) التهاب غلاف فیبروتیک کمپارتمان اول اکستانسور مچ دست شامل تاندون‌های ابداکتور پولیسیس لونگوس (APL) و اکستانسور پولیسیس برویس (EPB) است. این عارضه در زنان پس از زایمان که مکرراً نوزاد را با دست بلند می‌کنند بسیار شایع است. تست فینکلشتاین (فلکسیون شست درون مشت بسته و انحراف ناگهانی مچ به سمت اولنار) با بازتولید درد شدید روی استیلوئید رادیوس تشخیص را قطعی می‌سازد.",
            "lead_en": "De Quervain's tenosynovitis involves stenosing tenosynovitis of the first extensor dorsal compartment containing the abductor pollicis longus (APL) and extensor pollicis brevis (EPB) tendons. Classically afflicting postpartum mothers lifting infants, the diagnostic standard is Finkelstein's test (passive ulnar wrist deviation with the thumb folded within a clenched fist).",
            "golden_fa": "درد سمت رادیال مچ در مادر نوزاد با حرکت شست = تنوسینوویت دکوئروان؛ آزمون تشخیصی: تست فینکلشتاین.",
            "golden_en": "Radial wrist pain worsening with thumb motion in a nursing mother = De Quervain's; diagnostic test: Finkelstein test.",
            "points_fa": [
                "تست تینل و فالن برای بررسی گیرافتادگی عصب مدین در سندرم تونل کارپال به کار می‌روند.",
                "تست یرگاسون و اسپید آزمون‌های تشخیصی برای آسیب تاندون بای‌سپس شانه هستند.",
                "درمان اولیه شامل استفاده از آتل شست‌بند (Thumb spica splint) و داروهای NSAID است.",
                "تزریق موضعی کورتیکواستروئید داخل غلاف کمپارتمان اول در صورت تداوم علائم درمانی قطعی است."
            ],
            "points_en": [
                "Tinel's and Phalen's maneuvers selectively assess median nerve compression across the carpal tunnel.",
                "Yergason's and Speed's tests evaluate proximal biceps tendon pathology at the shoulder.",
                "Conservative management incorporates a rigid thumb-spica splint and a short course of oral NSAIDs.",
                "Intralesional corticosteroid injection into the first extensor tendon sheath cures >80% of persistent cases."
            ]
        }
    },
    119: {
        "whys": [
            "صحیح است؛ در یک فرد سالمند (۶۰ ساله) با تابلوی کاملاً تیپیک استئوآرتریت زانو شامل: درد مکانیکی مفاصل که با فعالیت بدتر شده و با استراحت تسکین می‌یابد، خشکی کوتاه‌مدت پس از بی‌حرکتی، عدم وجود علائم سیستمیک، تب، درد شبانه یا خشکی صبحگاهی طولانی؛ طبق دستورالعمل‌های معتبر روماتولوژی (نظیر ACR و EULAR)، «اخذ شرح حال دقیق و معاینه فیزیکی کامل به تنهایی برای تشخیص استئوآرتریت کافی بوده و نیاز به هیچ اقدام تشخیصی یا تصویربرداری خاصی نیست».",
            "نادرست است؛ دلیل رد: انجام MRI در آرتروز تیپیک زانو نه تنها غیرضروری و هزینه اضافی است، بلکه یافته‌های تخریب غضروف کاذب را برجسته می‌سازد.",
            "نادرست است؛ دلیل رد: رادیوگرافی ساده زانو در تظاهر بالینی تیپیک الزامی نیست و بر مدیریت اولیه تأثیری ندارد مگر در موارد شک تشخیصی.",
            "نادرست است؛ دلیل رد: آنالیز مایع مفصلی تنها در حضور افیوژن حاد یا شک به سپسیس و کریستال انجام می‌شود نه آرتروز تیپیک."
        ],
        "exp": "در تابلوی بالینی تیپیک استئوآرتریت زانو، شرح حال و معاینه فیزیکی کافی است و نیاز به اقدام تشخیصی خاصی نیست.",
        "micro": {
            "lead_fa": "بر اساس راهنماهای بالینی انجمن روماتولوژی آمریکا (ACR) و اروپا (EULAR)، در افراد بالای ۴۵ تا ۵۰ سال که با درد زانو با مشخصات مکانیکی (تشدید با فعالیت، بهبود با استراحت) و خشکی صبحگاهی کمتر از ۳۰ دقیقه مراجعه می‌کنند و معاینه فیزیکی مؤید کریپتوس یا بزرگی استخوانی بدون علائم پرچم قرمز است، تشخیص استئوآرتریت به صورت کاملاً بالینی گذاشته می‌شود و هیچ‌گونه نیاز روتینی به رادیوگرافی، ام‌آر‌آی یا آزمایش خون وجود ندارد.",
            "lead_en": "Validated ACR and EULAR clinical practice guidelines emphasize that in individuals aged ≥45-50 presenting with classic mechanical knee pain (activity-related ache relieved by rest), brief morning stiffness (<30 minutes), and crepitus without red flags, the diagnosis of osteoarthritis is established clinically; routine radiography or MRI is unnecessary.",
            "golden_fa": "درد مکانیکی تیپیک زانو با خشکی کوتاه در سن بالا = شرح حال و معاینه فیزیکی برای تشخیص استئوآرتریت کافی است.",
            "golden_en": "Classic mechanical knee pain with brief stiffness in older adults = clinical history and examination suffice for OA diagnosis.",
            "points_fa": [
                "انجام ام‌آر‌آی زانو در آرتروز به دلیل نشان دادن پارگی‌های دژنراتیو شایع منیسک منجر به جراحی‌های غیرضروری می‌شود.",
                "درد شبانه شدید یا کاهش وزن علائم پرچم قرمزی هستند که نیاز به تصویربرداری را توجیه می‌کنند.",
                "درمان اولیه بر کاهش وزن، ورزش‌های تقویت‌کننده کوادری‌سپس و استامینوفن/NSAID موضعی استوار است.",
                "رادیوگرافی زانو در وضعیت ایستاده فقط زمانی ضرورت دارد که تشخیص بالینی مبهم باشد یا جراحی مدنظر باشد."
            ],
            "points_en": [
                "Knee MRI is actively discouraged in typical OA as incidental degenerative meniscal tears prompt unhelpful arthroscopies.",
                "Prominent nocturnal resting pain or constitutional red flags warrant structural radiographic evaluation.",
                "Initial management prioritizes weight reduction, low-impact exercise, quadriceps strengthening, and topical NSAIDs.",
                "Weight-bearing knee radiographs are reserved for atypical presentations, rapid deterioration, or arthroplasty planning."
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
    for idx, enrich in ENRICHMENTS_BATCH4.items():
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
