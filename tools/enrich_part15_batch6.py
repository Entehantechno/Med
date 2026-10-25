#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enrichment script for Part 15 Batch 6 (Questions 150 to 179)
Target payload: work/tools/master-bank/import-payload.master-preint.part15.json
Note: Per user instructions, question_fa and options_fa are preserved exactly as original.
Only options_why_fa, explanation_fa, and micro are enriched.
"""

import json
import sys

PAYLOAD_PATH = "work/tools/master-bank/import-payload.master-preint.part15.json"

ENRICHMENTS_BATCH6 = {
    150: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: برومید ایپراتروپیوم استنشاقی در حملات متوسط تا شدید آسم به عنوان درمان کمکی همراه با بتا-۲ آگونیست کاملاً اندیکاسیون دارد.",
            "نادرست است؛ دلیل رد: اکسیژن‌درمانی برای حفظ اشباع اکسیژن بالای ۹۳ تا ۹۵ درصد اقدامی پایه‌ای و ضروری است.",
            "نادرست است؛ دلیل رد: سالموتامول استنشاقی کوتاه‌اثر (SABA) سنگ‌بنای خط اول درمان حمله حاد آسم است.",
            "صحیح است (اقدامی که به شدت ممنوع است)؛ تجویز «داروهای آرام‌بخش و خواب‌آور (Sedatives نظیر بنزودیازپین‌ها)» در فاز حاد حمله شدید آسم «منع مصرف مطلق (Contraindicated)» دارد؛ زیرا این داروها درایو تنفسی مغزی را سرکوب کرده و در بیماری که به علت خستگی عضلات تنفسی دچار نرمال شدن کاذب PCO2 (PCO2=42) شده است، به سرعت منجر به توقف تنفس، اسیدوز تنفسی کشنده و مرگ بیمار می‌گردند."
        ],
        "exp": "تجویز داروهای آرام‌بخش در حمله حاد آسم به علت خطر مهار درایو تنفسی و ایست تنفسی اکیداً ممنوع است.",
        "micro": {
            "lead_fa": "در حمله حاد آسم شدید، کاهش صداهای تنفسی (Silent chest) همراه با PCO2 طبیعی یا رو به بالا (PCO2=42 mmHg در حضور تاکی‌پنه) نشانه خطیر خستگی عضلات تنفسی و نارسایی حاد تنفسی قریب‌الوقوع است. تجویز هرگونه داروی آرام‌بخش، مسکن مخدر یا خواب‌آور در این شرایط ممنوعیت مطلق دارد، زیرا محرک تنفسی را خاموش کرده و فاجعه‌آفرین است. درمان با اکسیژن، SABA نبولایزر، ایپراتروپیوم و کورتیکواستروئید وریدی است.",
            "lead_en": "In severe acute asthma, silent chest and a 'pseudonormal' or rising PaCO2 (42 mmHg amidst tachypnea) herald diaphragmatic exhaustion and impending respiratory arrest. Administering sedatives or anxiolytics is strictly contraindicated; suppressing central respiratory drive precipitates immediate hypercapnic respiratory arrest. Intensive management requires nebulized SABA, ipratropium, and systemic steroids.",
            "golden_fa": "در حمله حاد آسم شدید: تجویز داروهای آرام‌بخش ممنوعیت مطلق دارد و باعث توقف تنفسی می‌شود.",
            "golden_en": "In acute severe asthma: sedatives and anxiolytics are strictly contraindicated due to fatal respiratory arrest risk.",
            "points_fa": [
                "طبیعی بودن PCO2 در حضور تاکی‌پنه نشانه نارسایی قریب‌الوقوع پمپ تنفسی است.",
                "ایپراتروپیوم استنشاقی همراه با سالبوتامول عضلات صاف برونش را با دو مکانیسم متفاوت متسع می‌سازد.",
                "کورتیکواستروئیدهای سیستمیک (متیل‌پردنیزولون وریدی) جهت مهار التهاب فاز تأخیری تجویز می‌شوند.",
                "سولفات منیزیم وریدی داروی خط دوم بسیار مؤثر در حملات شدید مقاوم به درمان است."
            ],
            "points_en": [
                "A normal PaCO2 in the face of tachypneic hyperventilation indicates severe muscle fatigue and impending failure.",
                "Inhaled ipratropium bromide synergizes with albuterol, maximizing bronchodilation through complementary pathways.",
                "Systemic corticosteroids (intravenous methylprednisolone) prevent delayed inflammatory exacerbations.",
                "Intravenous magnesium sulfate represents a highly efficacious second-line bronchodilator in refractory flares."
            ]
        }
    },
    151: {
        "ci": 0,
        "whys": [
            "صحیح است؛ در یک بیمار چاق با تابلوی خروپف بلند شبانه، وقفه‌های تنفسی، سردرد و خواب‌آلودگی مفرط صبحگاهی و فشار خون بالا (شک قطعی به سندرم آپنه انسدادی خواب / OSA)، روش استاندارد طلایی و بهترین ابزار تشخیصی «پلی‌سومنوگرافی در طول شب (Polysomnography / Overnight Sleep Study)» است که وقایع آپنه و هایپوپنه، اشباع اکسیژن و مراحل خواب را ثبت می‌نماید.",
            "نادرست است؛ دلیل رد: اسپیرومتری بیماری‌های تحدیدی و انسدادی راه‌های هوایی را می‌سنجد و برای تشخیص آپنه خواب ارزشی ندارد.",
            "نادرست است؛ دلیل رد: رادیوگرافی ساده قفسه سینه تشخیصی برای اختلالات تنفسی حین خواب نیست.",
            "نادرست است؛ دلیل رد: اکوکاردیوگرافی هیپرتروفی یا هایپرتانسیون ریوی ناشی از OSA را نشان می‌دهد اما روش اثبات تشخیص خود بیماری نیست."
        ],
        "exp": "پلی‌سومنوگرافی در طول شب (PSG) روش استاندارد طلایی تشخیصی برای اثبات سندرم آپنه انسدادی خواب (OSA) است.",
        "micro": {
            "lead_fa": "سندرم آپنه انسدادی خواب (OSA) با انسداد مکرر مجاری هوایی فوقانی حین خواب ناشی از شلی عضلات حلق مشخص می‌شود. عوامل خطر اصلی شامل چاقی (BMI بالا)، جنس مذکر و گردن ضخیم است. تظاهرات شاخص شامل خروپف بلند، خواب‌آلودگی روزانه (Daytime sleepiness)، سردردهای صبحگاهی و هایپرتانسیون مقاوم به درمان است. پلی‌سومنوگرافی شبانه در آزمایشگاه خواب با تعیین شاخص آپنه-هایپوپنه (AHI بالای ۵ تا ۱۵) استاندارد طلایی تشخیص است.",
            "lead_en": "Obstructive sleep apnea (OSA) involves recurrent upper pharyngeal collapse during sleep, predominantly afflicting obese individuals. Cardinal clinical features encompass loud snoring, witnessed apneas, morning cephalea, and intractable hypertension. Overnight in-laboratory polysomnography (PSG) represents the undisputed gold standard, establishing the apnea-hypopnea index (AHI).",
            "golden_fa": "خروپف شبانه + خواب‌آلودگی صبحگاهی و چاقی = آپنه خواب (OSA)؛ روش تشخیصی طلایی: پلی‌سومنوگرافی (PSG).",
            "golden_en": "Snoring + daytime sleepiness + obesity = OSA; diagnostic gold standard: overnight polysomnography (PSG).",
            "points_fa": [
                "شاخص AHI مساوی یا بیشتر از ۵ همراه با علائم بالینی تشخیص OSA را قطعی می‌سازد.",
                "درمان انتخابی استاندارد طلایی استفاده شبانه از دستگاه فشار مثبت مداوم راه‌های هوایی (CPAP) است.",
                "کاهش وزن در بیماران چاق بخش ضروری درمان بیماری است.",
                "آپنه خواب درمان‌نشده ریسک سکته مغزی، آریتمی قلبی و حوادث رانندگی را به شدت بالا می‌برد."
            ],
            "points_en": [
                "An apnea-hypopnea index (AHI) ≥5 events/hour alongside characteristic symptoms verifies the diagnosis.",
                "Continuous positive airway pressure (CPAP) during sleep represents the definitive gold-standard therapy.",
                "Behavioral weight reduction and positional therapy provide vital adjunctive benefits.",
                "Untreated severe OSA dramatically escalates long-term hazards of stroke, atrial fibrillation, and motor vehicle crashes."
            ]
        }
    },
    152: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: کلسیتریول متابولیت فعال ویتامین D است و جذب کلسیم را بالا برده و هایپرکلسمی را وخیم‌تر می‌کند.",
            "نادرست است؛ دلیل رد: هیدروکورتیزون در هایپرکلسمی ناشی از گرانولوم‌ها یا میلوم کاربرد دارد نه هایپرپاراتیروئیدی اولیه حاد.",
            "صحیح است؛ در بیماری با تابلوی هایپرکلسمی علامت‌دار (Ca=12 mg/dL همراه با تهوع، استفراغ، خستگی، پرنوشی و دهیدراتاسیون) ناشی از هایپرپاراتیروئیدیسم اولیه (PTH=280 بالا)، اقدام فوری و سنگ‌بنای خط اول در مرحله اول «مایع‌درمانی وریدی تهاجمی با سرم نرمال سالین (0.9% NaCl)» با حجم اولیه ۲۰۰ تا ۳۰۰ میلی‌لیتر در ساعت است تا اتساع حجم درون‌عروقی حاصل شده و دفع ادراری کلسیم تقویت گردد.",
            "نادرست است؛ دلیل رد: فسفات ساندوز خوراکی در حضور تهوع و استفراغ خط اول نیست و هایپرکلسمی حاد را سریع کنترل نمی‌کند."
        ],
        "exp": "در هایپرکلسمی علامت‌دار حاد، هیدراسیون تهاجمی با سرم نرمال سالین اولین و فوری‌ترین اقدام درمانی است.",
        "micro": {
            "lead_fa": "هایپرکلسمی علامت‌دار (کلسیم سرم بالای ۱۲ میلی‌گرم در دسی‌لیتر) به دلیل دیورز اسمزی ناشی از کلسیم و تهوع/استفراغ همواره با دهیدراتاسیون شدید درون‌عروقی و افت GFR همراه است. اولین و حیاتی‌ترین گام در مدیریت درمانی، بازگرداندن حجم درون‌عروقی با تزریق وریدی سرم نرمال سالین ایزوتونیک (معمولاً ۲ تا ۳ لیتر در ۲۴ ساعت اول) است. اتساع حجم علاوه بر بهبود پرفیوژن کلیوی، دفع کلسیم در قوس هنله را از طریق مهار بازجذب سدیم تحریک می‌نماید.",
            "lead_en": "Symptomatic hypercalcemia (calcium 12 mg/dL) precipitates profound hypovolemia secondary to nephrogenic diabetes insipidus, vomiting, and anorexia. The immutable initial therapeutic priority is aggressive volume resuscitation utilizing intravenous isotonic normal saline (0.9% NaCl), which restores extracellular volume and stimulates calciuresis via coupled proximal sodium excretion.",
            "golden_fa": "کلسیم بالا (Ca=12) با تهوع و دهیدراتاسیون = اولین اقدام درمانی: هیدراسیون سریع با سرم نرمال سالین وریدی.",
            "golden_en": "Symptomatic hypercalcemia (Ca=12 mg/dL) = first therapeutic step: aggressive intravenous normal saline hydration.",
            "points_fa": [
                "نرمال سالین با سرعت ۲۰۰ تا ۳۰۰ میلی‌لیتر در ساعت تا برقراری برون‌ده ادراری کافی تجویز می‌شود.",
                "پس از اصلاح کامل حجم، در صورت نیاز از بیس‌فسفونات‌های وریدی (زولدرونیک اسید) استفاده می‌شود.",
                "دیورتیک‌های لوپ (فورزماید) تنها پس از هیدراسیون کامل در صورت بروز اضافه بار مایعات مجاز هستند.",
                "درمان قطعی هایپرپاراتیروئیدی اولیه برداشتن آدنوم پاراتیروئید با جراحی است."
            ],
            "points_en": [
                "Isotonic saline is infused at 200-300 mL/h, titrated to maintain adequate urine output (100-150 mL/h).",
                "Following intravascular rehydration, intravenous bisphosphonates (zoledronic acid) are initiated for durable suppression.",
                "Loop diuretics (furosemide) are strictly withheld until volume repletion is verified, reserved solely for volume overload.",
                "Definitive long-term cure for primary hyperparathyroidism requires targeted surgical parathyroidectomy."
            ]
        }
    },
    153: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: سیتاگلیپتین (مهارکننده DPP-4) ترشح وابسته به گلوکز انسولین را تحریک کرده و خطر هایپوگلیسمی بسیار ناچیزی دارد.",
            "صحیح است؛ داروی «رپاگلینید (Repaglinide)» از دسته گلینیدها (مگلیتینیدها / Secretagogues) است که با بستن کانال‌های وابسته به ATP پتاسیم در سلول‌های بتای پانکراس، «ترشح انسولین را به صورت مستقیم و مستقل از سطح قند خون تحریک می‌کند»؛ در نتیجه در مقایسه با داروهای حساس‌کننده به انسولین و مهارکننده‌های SGLT2 یا DPP-4، اضافه کردن آن به متفورمین «بیشترین خطر بروز حملات هایپوگلیسمی» را برای بیمار به همراه دارد.",
            "نادرست است؛ دلیل رد: امپاگلیفلوزین (مهارکننده SGLT2) دفع کلیوی گلوکز را زیاد می‌کند و باعث هایپوگلیسمی نمی‌شود.",
            "نادرست است؛ دلیل رد: پیوگلیتازون حساسیت محیطی به انسولین را افزایش می‌دهد و به تنهایی هایپوگلیسمی ایجاد نمی‌کند."
        ],
        "exp": "رپاگلینید یک داروی محرک ترشح انسولین (سکرتاگوگ) است و در بین گزینه‌ها بالاترین خطر هایپوگلیسمی را دارد.",
        "micro": {
            "lead_fa": "داروهای ضد دیابت خوراکی از نظر پتانسیل القای هایپوگلیسمی به دو گروه تقسیم می‌شوند: ۱) داروهای سکرتاگوگ محرک ترشح انسولین شامل سولفونیل‌اوره‌ها (گلی‌بن‌کلامید) و مگلیتینیدها (رپاگلینید) که حتی در قندهای پایین کانال‌های پتاسیم بتاسل را بسته و انسولین آزاد می‌کنند، بنابراین بالاترین ریسک هایپوگلیسمی را دارند؛ ۲) داروهای غیرسکرتاگوگ شامل متفورمین، مهارکننده‌های SGLT2، تیازولیدین‌دیون‌ها و مهارکننده‌های DPP-4 که به خودی خود هایپوگلیسمی نمی‌دهند.",
            "lead_en": "Oral antihyperglycemic agents diverge fundamentally regarding hypoglycemia hazard. Insulin secretagogues—specifically sulfonylureas and glinides (repaglinide)—close ATP-sensitive K+ channels on pancreatic beta-cells, stimulating insulin release irrespective of ambient glycemia and imparting substantial hypoglycemia risks. DPP-4 inhibitors, SGLT2 inhibitors, and TZDs carry negligible risk.",
            "golden_fa": "در بین گزینه‌ها، داروی دارای بیشترین خطر هایپوگلیسمی = رپاگلینید (محرک ترشح انسولین).",
            "golden_en": "Among options, the drug carrying the highest hypoglycemia risk = repaglinide (insulin secretagogue).",
            "points_fa": [
                "رپاگلینید دارویی سریع‌الاثر و کوتاه‌اثر است و باید دقیقاً قبل از وعده‌های غذایی مصرف شود.",
                "در صورت حذف یک وعده غذایی توسط بیمار، دوز رپاگلینید آن وعده باید حذف گردد تا هایپوگلیسمی رخ ندهد.",
                "مهارکننده‌های SGLT2 (امپاگلیفلوزین) محافظت قلبی و کلیوی عالی دارند بدون اینکه قند را بیش از حد افت دهند.",
                "سیتاگلیپتین دارویی کاملاً خنثی بر وزن و بسیار ایمن از نظر هایپوگلیسمی است."
            ],
            "points_en": [
                "Repaglinide exhibits rapid onset and brief duration, engineered specifically for postprandial glycemic coverage.",
                "Patients skipping a meal must omit the scheduled repaglinide dose to avert severe iatrogenic hypoglycemia.",
                "SGLT2 inhibitors (empagliflozin) deliver cardiorenal protection without elevating hypoglycemia.",
                "DPP-4 inhibitors (sitagliptin) provide weight-neutral glycemic lowering with intrinsic glucose-dependent safety."
            ]
        }
    },
    154: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: به تعویق انداختن درمان تا سال بعد در زنی که قصد بارداری دارد با خطرات جدی سقط جنین همراه است.",
            "نادرست است؛ دلیل رد: صبر کردن تا سه ماهه اول بارداری اشتباه است؛ ارگانوژنز و تکامل مغز جنین در همان هفته‌های اول نیازمند هورمون تیروئید است.",
            "صحیح است؛ در یک خانم جوان که قصد بارداری در ماه‌های آینده را دارد، وجود کم‌کاری تحت‌بالینی تیروئید (TSH=5) همراه با «مثبت بودن آنتی‌بادی Anti-TPO Ab» طبق دستورالعمل‌های انجمن تیروئید آمریکا (ATA)، اندیکاسیون قطعی برای «شروع لووتیروکسین (Levothyroxine)» است تا سطح TSH پیش از لقاح به زیر 2.5 mIU/L برسد؛ این اقدام خطر سقط جنین، زایمان زودرس و اختلال در تکامل سیستم عصبی و هوش جنین را کاهش می‌دهد.",
            "نادرست است؛ دلیل رد: اندازه‌گیری ید ادرار در مدیریت روتین کم‌کاری تیروئید بالینی جایگاهی ندارد."
        ],
        "exp": "در زن دارای Anti-TPO مثبت با TSH بالای ۲/۵ تا ۴ که قصد بارداری دارد، شروع لووتیروکسین قبل از لقاح الزامی است.",
        "micro": {
            "lead_fa": "تیروئیدیت اتوایمیون تحت‌بالینی در دوران پیش از بارداری اهمیت حیاتی دارد. جنین تا هفته ۱۲ حاملگی به طور کامل وابسته به تیروکسین مادری است که از جفت عبور می‌کند. طبق راهنماهای ATA و اندوکرینولوژی، در زنان قصد بارداری با آنتی‌بادی Anti-TPO مثبت، آستانه مجاز TSH حداکثر 2.5 mIU/L است و در TSH بالای ۲/۵ تا ۴ شروع دوزهای پایین لووتیروکسین (۵۰ میکروگرم روزانه) جهت رساندن TSH به زیر ۲/۵ و پیشگیری از سقط خودبه‌خودی و آسیب عصبی جنین اکیداً توصیه می‌شود.",
            "lead_en": "Subclinical hypothyroidism alongside anti-TPO positivity before conception threatens early embryogenesis, as the fetus depends entirely on maternal transplacental levothyroxine throughout the first trimester. American Thyroid Association (ATA) guidelines mandate initiating levothyroxine in TPO-positive women planning pregnancy when TSH exceeds 2.5-4.0 mIU/L, targeting TSH <2.5 mIU/L to avert miscarriage.",
            "golden_fa": "زن قصد بارداری با Anti-TPO مثبت و TSH بالای نرمال = اقدام صحیح: شروع لووتیروکسین با هدف TSH زیر ۲/۵.",
            "golden_en": "Woman planning pregnancy with positive anti-TPO and elevated TSH = initiate levothyroxine (target TSH <2.5).",
            "points_fa": [
                "تست TSH باید بلافاصله پس از مثبت شدن تست بارداری تکرار شده و دوز لووتیروکسین ۲۵ تا ۳۰ درصد افزایش یابد.",
                "آنتی‌بادی Anti-TPO ریسک سقط جنین و زایمان زودرس را حتی در کم‌کاری خفیف تیروئید به شدت بالا می‌برد.",
                "هدف TSH در دوران سه ماهه اول بارداری کمتر از ۲/۵ میلی‌واحد در لیتر است.",
                "هورمون‌های تیروئید مادر نقش کلیدی در مهاجرت نورونی و تکامل مغزی جنین ایفا می‌کنند."
            ],
            "points_en": [
                "Serum TSH must be rechecked as soon as pregnancy is confirmed, requiring a 25-30% empiric dose increase.",
                "Anti-TPO positivity independently escalates the risk of spontaneous miscarriage and preterm delivery.",
                "The target TSH threshold during the critical first trimester remains strictly below 2.5 mIU/L.",
                "Maternal thyroxine is essential for fetal cerebral cortex neurogenesis and axonal myelination."
            ]
        }
    },
    155: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: بستری الکتیو در بخش برای بیماری با تاکی‌پنه، تاکی‌کارد، تب و درد شکم بسیار خطرناک است و تأخیر درمانی ایجاد می‌کند.",
            "صحیح است؛ بروز پرنوشی، پرادراری، کاهش وزن، تهوع، استفراغ و دردهای شکمی همراه با تاکی‌پنه (تنفس کوسمول با RR=24)، تاکی‌کاردی، دهیدراتاسیون و قند خون بالای ۲۵۰ در یک خانم جوان، اورژانس تهدیدکننده حیات «کتواسیدوز دیابتی (DKA)» را مطرح می‌سازد؛ مناسب‌ترین اقدام فوری «بستری در اورژانس، برقراری رگ باز و ارسال فوری کتون ادرار (یا سرم)، گاز خون وریدی (VBG جهت ارزیابی اسیدوز متابولیک و آنیون گپ) و الکترولیت‌ها» و آغاز هیدراسیون است.",
            "نادرست است؛ دلیل رد: متفورمین در بیمار دچار تهوع، دهیدراتاسیون و اسیدوز خطرساز بوده و شروع آن در DKA اشتباه محض است.",
            "نادرست است؛ دلیل رد: تجویز آنتی‌بیوتیک سرپایی بدون بستری در DKA کشنده است."
        ],
        "exp": "درد شکم، تاکی‌پنه و قند خون بالا در خانم جوان تابلوی DKA است؛ اقدام فوری بستری در اورژانس و ارسال گاز خون و کتون است.",
        "micro": {
            "lead_fa": "کتواسیدوز دیابتی (DKA) تظاهر اولیه دیابت نوع ۱ در بیش از ۳۰ درصد جوانان است. تظاهرات تیپیک: پرادراری و تشنگی طولانی که با تهوع، استفراغ، درد شدید شکم (به دلیل اسیدوز و ایلئوس) و تاکی‌پنه جبرانی عمیق (تنفس کوسمول) همراه می‌شود. تریاد تشخیصی: قند خون بالای ۲۵۰، کتونمی/کتونوری و اسیدوز متابولیک با آنیون گپ بالا (pH زیر ۷/۳ و بیکربنات زیر ۱۸). اقدام فوری بستری در اورژانس و شروع هیدراسیون با نرمال سالین و ارزیابی پتاسیم است.",
            "lead_en": "Diabetic ketoacidosis (DKA) frequently represents the initial presentation of type 1 diabetes in young adults. Classical progression involves polyuria and polydipsia evolving into nausea, diffuse abdominal pain, and Kussmaul respirations. Diagnostic criteria mandate hyperglycemia (>250 mg/dL), ketonuria/ketonemia, and high anion gap metabolic acidosis. Immediate emergency admission and blood gas/ketone analysis are required.",
            "golden_fa": "قند بالا + درد شکم و تاکی‌پنه در خانم جوان = شک به DKA؛ اقدام فوری: بستری در اورژانس، ارسال کتون و گاز خون.",
            "golden_en": "Hyperglycemia + abdominal pain and tachypnea in a young female = DKA; immediate emergency admission, ketones, and VBG.",
            "points_fa": [
                "درد شکم در DKA می‌تواند شکم حاد جراحی را تقلید کند و با اصلاح اسیدوز خودبه‌خود برطرف می‌شود.",
                "مایع‌درمانی با نرمال سالین ۱ تا ۱/۵ لیتر در ساعت اول مهم‌ترین اقدام نجات‌بخش است.",
                "انسولین رگولار وریدی تنها پس از اطمینان از سطح پتاسیم سرم بالای ۳/۳ شروع می‌شود.",
                "پایش مکرر پتاسیم برای جلوگیری از ایست قلبی ناشی از هایپوکالمی ناشی از انسولین اجباری است."
            ],
            "points_en": [
                "Abdominal pain in DKA frequently mimics an acute surgical abdomen, resolving completely with acidosis reversal.",
                "Aggressive fluid resuscitation with isotonic saline (1-1.5 L in the first hour) represents the initial priority.",
                "Intravenous regular insulin infusion is withheld until serum potassium is verified above 3.3 mEq/L.",
                "Serial potassium monitoring is essential to intercept fatal hypokalemic cardiac arrhythmias during insulin therapy."
            ]
        }
    },
    156: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: سنجش FSH برای ارزیابی عملکرد تخمدان و یائسگی است و تستی برای سندرم کوشینگ نیست.",
            "نادرست است؛ دلیل رد: پرولاکتین برای گالاکتوره و آمنوره است و تست غربالگری اولیه کوشینگ نیست.",
            "صحیح است؛ در بیماری با علائم تیپیک سندرم کوشینگ (چاقی شکمی، استریاهای بنفش عریض، پرفشاری خون، آکنه و صورت گرد)، بر اساس تمام دستورالعمل‌های بین‌المللی غدد درون‌ریز، یکی از تست‌های خط اول غربالگری و تشخیصی اولیه «اندازه‌گیری کورتیزول آزاد ادرار ۲۴ ساعته (24-Hour Urinary Free Cortisol / UFC)» (یا تست سرکوب دگزامتازون شبانه ۱ میلی‌گرم یا کورتیزول بزاقی آخر شب) است تا وجود هایپرکورتیزولیسم اثبات گردد.",
            "نادرست است؛ دلیل رد: IGF-1 مارکر غربالگری بیماری آکرومگالی است نه سندرم کوشینگ."
        ],
        "exp": "سنجش کورتیزول آزاد ادرار ۲۴ ساعته (UFC) از تست‌های غربالگری خط اول و اولیه برای اثبات سندرم کوشینگ است.",
        "micro": {
            "lead_fa": "در مواجهه با شک بالینی به سندرم کوشینگ، ارزیابی تشخیصی در دو مرحله انجام می‌پذیرد: مرحله اول اثبات هایپرکورتیزولیسم پاتولوژیک با استفاده از حداقل دو مورد از سه تست غربالگری استاندارد است: ۱) کورتیزول آزاد ادرار ۲۴ ساعته (UFC حداقل ۳ برابر نرمال)؛ ۲) تست مهار دگزامتازون با دوز پایین شبانه (1mg Overnight DST با کورتیزول صبحگاهی بالای 1.8 μg/dL)؛ ۳) کورتیزول بزاق در ساعت ۱۱ شب. پس از اثبات، مرحله دوم سنجش ACTH جهت تفکیک منشأ بیماری است.",
            "lead_en": "Diagnostic confirmation of Cushing's syndrome fundamentally initiates with biochemical verification of endogenous hypercortisolemia using first-line screening modalities: 24-hour urinary free cortisol (UFC), overnight 1-mg dexamethasone suppression testing, or late-night salivary cortisol. Measuring 24-hour urinary free cortisol remains a definitive, time-tested initial diagnostic screening test.",
            "golden_fa": "تست‌های غربالگری اولیه کوشینگ: کورتیزول ادرار ۲۴ ساعته (UFC)، تست دگزامتازون ۱ میلی‌گرم و کورتیزول بزاق شبانه.",
            "golden_en": "First-line screening tests for Cushing's: 24-hour urinary free cortisol, overnight 1-mg DST, and late-night salivary cortisol.",
            "points_fa": [
                "استریاهای پوستی در کوشینگ عریض (بیش از ۱ سانتی‌متر) و ارغوانی-بنفش هستند.",
                "اندازه‌گیری تصادفی تک‌نوبتی کورتیزول صبحگاهی به علت نوسانات ریتم شبانه‌روزی بی‌ارزش است.",
                "در صورت مثبت شدن تست غربالگری، سطح ACTH پلاسما برای تفکیک وابسته به ACTH از آدنوم آدرنال چک می‌شود.",
                "ام‌آر‌آی هیپوفیز تنها پس از اثبات بیوشیمیایی بالا بودن ACTH اندیکاسیون پیدا می‌کند."
            ],
            "points_en": [
                "Violaceous abdominal striae pathognomonic of Cushing's are characteristically wide (>1 cm) and purple.",
                "Random single-point morning serum cortisol is completely non-diagnostic due to circadian pulsatility.",
                "Following proven hypercortisolemia, plasma ACTH quantification differentiates ACTH-dependent from adrenal etiologies.",
                "Pituitary MRI is strictly contraindicated until biochemical ACTH dependency has been established."
            ]
        }
    },
    157: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: افزایش دوز متی‌مازول اشتباه است زیرا سطح FT4 کاملاً نرمال است و بیمار را به سمت هایپوتیروئیدی بالینی می‌برد.",
            "صحیح است؛ در بیماری مبتلا به گریوز تحت درمان با متی‌مازول که سطح هورمون فعال تیروئید «FT4 به حد طبیعی رسیده است»، مناسب‌ترین اقدام «ادامه درمان با همان دوز فعلی (یا کاهش ملایم دوز نگه‌دارنده)» است؛ زیرا ترشح هورمون TSH از سلول‌های تیروتروف هیپوفیز به علت سرکوب طولانی‌مدت قبلی، ممکن است تا «چندین ماه پس از یوتیروئید شدن بالینی و آزمایشگاهی همچنان مهارشده و پایین باقی بماند»؛ بنابراین پایش دوز دارو در ماه‌های اول صرفاً بر اساس سطح نرمال FT4 صورت می‌گیرد نه TSH سرکوب‌شده.",
            "نادرست است؛ دلیل رد: قطع زودهنگام دارو در ماه سوم منجر به عود سریع پرکاری تیروئید می‌شود (دوره درمان گریوز ۱۲ تا ۱۸ ماه است).",
            "نادرست است؛ دلیل رد: بیمار به درمان دارویی عالی پاسخ داده و نیازی به قطع دارو و ید رادیواکتیو نیست."
        ],
        "exp": "در ماه‌های اول درمان گریوز، TSH تا ماه‌ها سرکوب‌شده می‌ماند؛ در صورت نرمال بودن FT4، ادامه درمان با همان دوز صحیح است.",
        "micro": {
            "lead_fa": "در پایش درمان پرکاری تیروئید (گریوز) با داروهای ضد تیروئید (متی‌مازول)، یک نکته فیزیولوژیک کلیدی وجود دارد: بازگشت TSH هیپوفیز به محدوده طبیعی پدیده‌ای بسیار کند است و حتی ماه‌ها پس از طبیعی شدن کامل هورمون‌های تیروئید آزاد (FT4 و FT3)، TSH ممکن است همچنان زیر 0.01 سرکوب بماند. بنابراین در ماه‌های ابتدایی درمان، هدف بالینی رسیدن FT4 به نیمه فوقانی محدوده طبیعی است و نباید به بهانه پایین بودن TSH دوز دارو را افزایش داد.",
            "lead_en": "When titrating thionamide therapy (methimazole) for Graves' disease, prolonged suppression of the hypothalamic-pituitary-thyroid axis keeps serum TSH suppressed for months after circulating free T4 normalizes. Adjustments during early therapy are calibrated strictly against serum FT4; a normal FT4 dictates continuing the current regimen rather than increasing the dose.",
            "golden_fa": "پایش متی‌مازول در گریوز: با FT4 نرمال، TSH تا ماه‌ها پایین می‌ماند؛ اقدام صحیح: ادامه درمان با همان دوز.",
            "golden_en": "Monitoring methimazole in Graves': with normal FT4, TSH remains suppressed for months; continue the same dose.",
            "points_fa": [
                "تکیه بر TSH پایین در اوایل درمان و افزایش متی‌مازول موجب کم‌کاری شدید ایتروژنیک تیروئید می‌شود.",
                "دوره درمان استاندارد دارویی گریوز معمولاً ۱۲ تا ۱۸ ماه ادامه می‌یابد.",
                "در صورت بروز تب و گلودرد حین مصرف متی‌مازول، قطع فوری دارو و شمارش CBC جهت رد آگرانولوسیتوز الزامی است.",
                "آزمایش FT4 هر ۴ تا ۶ هفته در فاز تنظیم دوز تکرار می‌گردد."
            ],
            "points_en": [
                "Relying on a suppressed TSH to escalate methimazole provokes severe iatrogenic hypothyroidism and goiter.",
                "A complete therapeutic course of thionamides for Graves' hyperthyroidism spans 12 to 18 continuous months.",
                "Sudden fever and sore throat on methimazole dictate urgent drug withdrawal and CBC testing for agranulocytosis.",
                "Serum FT4 and total/free T3 are reassessed every 4 to 6 weeks until stable euthyroid maintenance is achieved."
            ]
        }
    },
    158: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: بررسی سلیاک مهم است اما در اولویت فوریت حیاتی قرار ندارد.",
            "صحیح است؛ در یک بیمار جوان مبتلا به کم‌کاری تیروئید اتوایمیون که با درد شکم، تهوع و کاهش وزن مراجعه کرده است، شک قوی به «سندرم اتوایمیون پلی‌گلاندولار تیپ ۲ (PGA-II / سندرم اشمیت)» یعنی همراهی همزمان تیروئیدیت هاشیموتو و «نارسایی اولیه کورتکس آدرنال (بیماری آدیسون)» مطرح است؛ شروع هیدراتاسیون یا لووتیروکسین با افزایش ترخیص و کاتابولیسم کبدی کورتیزول، بیمار دچار نارسایی مخفی آدرنال را وارد «بحران آدرنال حاد کشنده» می‌کند؛ بنابراین بررسی فوری «اندازه‌گیری کورتیزول و ACTH سرم» بالاترین اهمیت و فوریت حیاتی را دارد.",
            "نادرست است؛ دلیل رد: سنجش کلسیم و فسفر در سندرم PGA تیپ ۱ کاربرد دارد و علت درد شکم و کاهش وزن حاد نیست.",
            "نادرست است؛ دلیل رد: CBC افتراقی علت نارسایی زمینه‌ای غدد را آشکار نمی‌سازد."
        ],
        "exp": "در بیمار کم‌کار تیروئید با درد شکم و کاهش وزن، شک به آدیسون همراه (سندرم اشمیت) ارزیابی فوری کورتیزول و ACTH را ایجاب می‌کند.",
        "micro": {
            "lead_fa": "سندرم اتوایمیون پلی‌گلاندولار تیپ ۲ (PGA-II یا سندرم اشمیت) با همراهی نارسایی اولیه آدرنال (آدیسون) با بیماری اتوایمیون تیروئید (هاشیموتو یا گریوز) و دیابت نوع ۱ مشخص می‌شود. یک قانون طلایی در اندوکرینولوژی: تجویز لووتیروکسین به تنهایی در بیماری که نارسایی آدرنال همزمان دارد، به علت تسریع متابولیسم هپاتیک کورتیزول اندک باقی‌مانده، بحران آدرنال کشنده با کلاپس گردش خون القا می‌کند. بنابراین سنجش فوری کورتیزول و ACTH حیاتی است.",
            "lead_en": "Polyglandular autoimmune syndrome type II (Schmidt's syndrome) involves concurrent primary adrenal insufficiency (Addison's disease) alongside autoimmune thyroiditis and type 1 diabetes. Initiating levothyroxine accelerates hepatic clearance of residual cortisol, triggering life-threatening adrenal crisis in unrecognized Addison's; immediate cortisol and ACTH measurement is paramount.",
            "golden_fa": "کم‌کاری تیروئید + درد شکم، ضعف و کاهش وزن = شک به نارسایی آدرنال همراه (آدیسون)؛ بررسی فوری: کورتیزول و ACTH.",
            "golden_en": "Hypothyroidism + abdominal pain, fatigue, and weight loss = suspect Addison's; immediate testing: morning cortisol and ACTH.",
            "points_fa": [
                "درمان با هیدروکورتیزون همواره باید قبل از شروع یا افزایش لووتیروکسین آغاز شود.",
                "هیپرپیگمانتاسیون پوست و مخاطات در اثر ترشح بالای ACTH و MSH سرنخ بالینی آدیسون است.",
                "اختلالات الکترولیتی تیپیک شامل هایپوناترمی و هایپرکالمی همراه با افت فشار خون ارتوستاتیک است.",
                "در صورت شک به کریز آدرنال حاد، درمان با هیدروکورتیزون وریدی نباید معطل جواب آزمایش شود."
            ],
            "points_en": [
                "Glucocorticoid replacement (hydrocortisone) must always precede or accompany thyroxine initiation.",
                "Cutaneous and mucosal hyperpigmentation from POMC-derived ACTH and MSH strongly signals Addison's.",
                "Classic biochemical derangements feature hyponatremia, hyperkalemia, and postural orthostatic hypotension.",
                "Emergent hydrocortisone therapy must never be delayed pending laboratory confirmation if crisis is suspected."
            ]
        }
    },
    159: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: پالس پارادوکس علامت شاخص تامپوناد قلبی و پریکاردیت انقباضی است نه نارسایی مزمن آئورت.",
            "نادرست است؛ دلیل رد: شکاف متناقض صدای دوم (Paradoxical S2 splitting) در تنگی شدید دریچه آئورت یا LBBB دیده می‌شود.",
            "نادرست است؛ دلیل رد: علامت کوسمول (Kussmaul) علامت کلاسیک پریکاردیت کونستریکتیو و انفارکتوس بطن راست است.",
            "صحیح است؛ سمع سوفل دیاستولی کاهنده (Decrescendo) در کناره چپ استرنوم که با خم شدن به جلو تشدید می‌شود همراه با سوفل آستین فلینت در اپکس و جابجایی PMI به خارج، تابلوی تیپیک «نارسایی شدید دریچه آئورت (Aortic Regurgitation / AR)» است؛ یافته بالینی همودینامیک شاخص و پاتوگنومونیک این بیماری، وجود «فشار نبض پهن (Wide Pulse Pressure)» به علت افزایش حجم ضربه‌ای سیستولی و افت شدید فشار خون دیاستولی ناشی از پس‌زدن خون به بطن چپ است."
        ],
        "exp": "سوفل دم‌کرشندو دیاستولی و سوفل آستین فلینت نشانه نارسایی آئورت (AR) است و یافته بارز آن فشار نبض پهن (Wide Pulse Pressure) می‌باشد.",
        "micro": {
            "lead_fa": "نارسایی مزمن دریچه آئورت (Aortic Regurgitation) با پس‌زدن خون از آئورت به بطن چپ در دیاستول مشخص می‌شود. سمع قلب: سوفل دم‌کرشندو دیاستولی با فرکانس بالا در فضای بین‌دنده‌ای سوم و چهارم چپ که در حالت نشسته با تنه خمیده به جلو و در بازدم کامل بهتر شنیده می‌شود، و سوفل دیاستولی آستین فلینت در اپکس ناشی از برخورد جت نارسایی با دریچه میترال. ویژگی همودینامیک بارز افزایش فشار سیستولی و افت شدید فشار دیاستولی (فشار نبض پهن بالای ۵۰ تا ۶۰ mmHg) و نبض‌های جهنده کریگان است.",
            "lead_en": "Chronic aortic regurgitation (AR) manifests with a high-pitched decrescendo diastolic murmur along the left sternal border, accentuated by leaning forward in full expiration, and an Austin Flint apical diastolic rumble. Regurgitant volume into the left ventricle engenders profound hemodynamic widening of the pulse pressure (elevated systolic with plummeted diastolic pressure) and water-hammer pulses.",
            "golden_fa": "سوفل دیاستولی دم‌کرشندو + آستین فلینت در اپکس = نارسایی آئورت (AR)؛ مشخصه بالینی: فشار نبض پهن (Wide pulse pressure).",
            "golden_en": "Decrescendo diastolic murmur + Austin Flint rumble = aortic regurgitation; hemodynamic hallmark: wide pulse pressure.",
            "points_fa": [
                "فشار نبض پهن مسبب علائم محیطی متعدد نظیر نبض واترهامر (کریگان) و جهش مویرگی کوئینکه است.",
                "جابجایی لترال PMI نشانه بزرگ شدن و اتساع بطن چپ در اثر بار اضافی حجمی است.",
                "اکوکاردیوگرافی روش استاندارد طلایی برای تعیین شدت نارسایی و ابعاد انتهای سیستولی بطن چپ است.",
                "در صورت بروز علائم یا رسیدن قطر انتهای سیستولی بطن به ۵۰ میلی‌متر، جراحی تعویض دریچه اندیکاسیون دارد."
            ],
            "points_en": [
                "Wide pulse pressure drives dramatic peripheral signs including Corrigan water-hammer pulses and Quincke's capillary pulsations.",
                "Lateral displacement of the apical impulse indicates left ventricular eccentric hypertrophy and volume dilation.",
                "Transthoracic echocardiography is the gold standard staging regurgitant severity and left ventricular end-systolic dimensions.",
                "Symptomatic status or left ventricular end-systolic diameter exceeding 50 mm triggers surgical valve replacement."
            ]
        }
    },
    160: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: دیگوکسین هدایت گره AV را مهار کرده و هدایت را به سمت راه فرعی هدایت می‌کند که منجر به فیبریلاسیون بطنی کشنده (VF) می‌شود.",
            "نادرست است؛ دلیل رد: وراپامیل (کلسیم چنل بلاکر) گره AV را بلاک کرده و در ولف-پارکینسون-وایت منع مصرف مطلق دارد.",
            "صحیح است؛ در یک بیمار مبتلا به سندرم ولف-پارکینسون-وایت (WPW) که با حمله فیبریلاسیون دهلیزی پیش‌برانگیخته (Pre-excited AF) مراجعه کرده و وضعیت همودینامیک پایدار دارد (فشار خون ۱۱۰/۸۰)، داروی انتخابی خط اول ضدآریتمی «پروکائین‌آمید وریدی (Procainamide / آنتی‌آریتمی کلاس Ia)» یا ایبوتیلید است؛ زیرا پروکائین‌آمید دوره تحریک‌ناپذیری راه فرعی اکسسوری (Bundle of Kent) را طولانی کرده و انتقال به بطن‌ها را مهار می‌سازد.",
            "نادرست است؛ دلیل رد: پروپرانولول و سایر بتابلوکرها با مهار گره AV هدایت از راه فرعی را تسریع کرده و خطرساز هستند."
        ],
        "exp": "در فیبریلاسیون دهلیزی در زمینه WPW، پروکائین‌آمید داروی انتخابی است؛ مسدودکننده‌های گره AV (دیگوکسین، وراپامیل) ممنوع هستند.",
        "micro": {
            "lead_fa": "حمله فیبریلاسیون دهلیزی در زمینه سندرم WPW (AF با پیش‌برانگیختگی) یک آریتمی با کمپلکس پهن، نامنظم و فوق‌العاده سریع است که می‌تواند به فیبریلاسیون بطنی (VF) و مرگ ناگهانی تبدیل شود. یک اصل خطیر اورژانس قلب: تمام داروهای مسدودکننده گره دهلیزی-بطنی (شامل وراپامیل، دیلتیازم، دیگوکسین، بتابلوکرها و آدنوزین) منع مصرف مطلق دارند؛ زیرا با مهار گره AV تمام ایمپالس‌ها را به راه فرعی سریع منحرف کرده و ایست قلبی ایجاد می‌کنند. پروکائین‌آمید وریدی راه فرعی را مسدود ساخته و داروی انتخابی در وضعیت پایدار است.",
            "lead_en": "Pre-excited atrial fibrillation in Wolff-Parkinson-White (WPW) syndrome produces an irregularly irregular wide-complex tachycardia risking rapid degeneration into ventricular fibrillation. All AV-nodal blocking agents (adenosine, beta-blockers, verapamil/diltiazem, digoxin) are absolutely contraindicated as they force preferential conduction down the accessory bypass tract, inducing cardiac arrest. Intravenous procainamide is the drug of choice in hemodynamically stable patients.",
            "golden_fa": "فیبریلاسیون دهلیزی در سندرم WPW پایدار = داروی انتخابی: پروکائین‌آمید وریدی؛ دیگوکسین و وراپامیل ممنوع هستند.",
            "golden_en": "Pre-excited AF in stable WPW = drug of choice: intravenous procainamide; AV nodal blockers (verapamil, digoxin) are contraindicated.",
            "points_fa": [
                "در صورت ناپایداری همودینامیک (افت فشار، درد سینه، کاهش هوشیاری)، کاردیوورژن الکتریکی هماهنگ فوری الزامی است.",
                "پروکائین‌آمید سرعت هدایت و دوره تحریک‌ناپذیری دسته کنت (راه فرعی) را سرکوب می‌کند.",
                "ابلیشن راه فرعی با امواج رادیوفرکوئنسی (RF Ablation) درمان قطعی بلندمدت سندرم WPW است.",
                "نوار قلب تاکیکاردی با کمپلکس‌های پهن و اشکال متغیر (پلی‌مورفیک) و ریتم کاملاً نامنظم را نشان می‌دهد."
            ],
            "points_en": [
                "Hemodynamic instability (hypotension, acute pulmonary edema) mandates immediate synchronized direct-current cardioversion.",
                "Procainamide prolongs the refractory period within the accessory bypass tract (bundle of Kent), slowing ventricular rate.",
                "Catheter radiofrequency ablation of the accessory pathway provides definitive long-term curative therapy.",
                "ECG displays an irregularly irregular, wide-QRS polymorphic tachycardia with alternating Delta wave morphology."
            ]
        }
    },
    161: {
        "ci": 0,
        "whys": [
            "صحیح است (موردی که صحیح نیست)؛ در یک بیمار مبتلا به بیماری انسدادی مزمن ریه (COPD) با FEV1 معادل ۴۵ درصد (انسداد متوسط تا شدید)، در وضعیت پایدار بیمار «انتظار نمی‌رود که PaCO2 بالاتر از مقادیر طبیعی باشد»؛ احتباس دی‌اکسید کربن و هایپرکاپنی (افزایش PaCO2) معمولاً تا زمانی که FEV1 به ارقام بسیار پایین زیر ۲۵ تا ۳۰ درصد نرسد یا بیمار دچار نارسایی تنفسی حاد نگردد رخ نمی‌دهد؛ بنابراین وجود هایپرکاپنی در FEV1=45% غیرمنتظره است.",
            "نادرست است؛ دلیل رد: ترک سیگار تنها مداخله غیردارویی است که سرعت افت FEV1 را کند کرده و بقای بیماران را به طور قطعی بهبود می‌بخشد.",
            "نادرست است؛ دلیل رد: هایپوکسمی (PaO2 پایین) به علت عدم تطابق تهویه-پرفیوژن (V/Q mismatch) در این مرحله کاملاً قابل انتظار است.",
            "نادرست است؛ دلیل رد: طبق راهنماهای جهانی GOLD و سازمان بهداشت جهانی، ارزیابی میزان آلفا-۱ آنتی‌تریپسین حداقل یک‌بار در تمام بیماران مبتلا به COPD توصیه می‌شود."
        ],
        "exp": "در COPD پایدار با FEV1 معادل ۴۵ درصد، تهویه آلوئولی حفظ شده و افزایش PaCO2 (هایپرکاپنی) قابل انتظار نیست.",
        "micro": {
            "lead_fa": "در سیر بالینی COPD، تبادل گازها به صورت مرحله‌ای مختل می‌شود: اختلال نسبت تهویه به پرفیوژن ابتدا سبب هایپوکسمی شریانی (افت PaO2) می‌شود، در حالی که دفع دی‌اکسید کربن به دلیل تهویه دقیق آلوئول‌های سالم حفظ شده و PaCO2 نرمال یا حتی پایین می‌ماند. هایپرکاپنی و احتباس CO2 تظاهر دیرهنگام بیماری است که فقط در مراحل انسداد بسیار شدید (FEV1 کمتر از ۱ لیتر یا کمتر از ۳۰ درصد پیش‌بینی‌شده) یا در فاز خستگی حاد عضلات تنفسی پدیدار می‌گردد.",
            "lead_en": "Gas exchange derangements in COPD advance sequentially: ventilation-perfusion mismatching initially precipitates arterial hypoxemia (low PaO2), while alveolar hyperventilation maintains normal PaCO2. Chronic hypercapnia and CO2 retention emerge as a late phenomenon reserved for end-stage airflow limitation (FEV1 <25-30% predicted or <1 L); expecting elevated PaCO2 at an FEV1 of 45% is incorrect.",
            "golden_fa": "در COPD با FEV1=45%: افت PaO2 رخ می‌دهد اما PaCO2 نرمال می‌ماند؛ هایپرکاپنی مربوط به FEV1 زیر ۲۵-۳۰٪ است.",
            "golden_en": "In COPD with FEV1 45%: PaO2 drops but PaCO2 remains normal; hypercapnia only emerges when FEV1 falls below 25-30%.",
            "points_fa": [
                "ترک دخانیات و اکسیژن‌درمانی طولانی‌مدت (در صورت اندیکاسیون) تنها عواملی هستند که بقای بیماران COPD را افزایش می‌دهند.",
                "غربالگری کمبود آلفا-۱ آنتی‌تریپسین طبق راهنمای GOLD یک‌بار برای تمام افراد مبتلا به COPD اندیکاسیون دارد.",
                "واکسیناسیون سالانه آنفلوآنزا و پنوموکوک از حملات تشدید حاد بیماری پیشگیری می‌کند.",
                "برونکودیلاتورهای طولانی‌اثر استنشاقی (LAMA و LABA) خط اول بهبود علائم و پیشگیری از اکساسربیشن هستند."
            ],
            "points_en": [
                "Smoking cessation and long-term domiciliary oxygen therapy (when indicated) are the sole interventions proven to prolong survival.",
                "GOLD guidelines mandate a one-time serum alpha-1 antitrypsin screening in all individuals carrying a COPD diagnosis.",
                "Annual influenza and polyvalent pneumococcal immunizations dramatically reduce exacerbation frequencies.",
                "Long-acting inhaled bronchodilators (LABA/LAMA combinations) optimize lung function and diminish hospitalizations."
            ]
        }
    },
    162: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: مکث سینوسی توقف در تولید امواج P توسط گره SA با خط ایزوالکتریک طولانی است.",
            "نادرست است؛ دلیل رد: ونکباخ (موبیتز تیپ ۱) با طولانی شدن پیشرونده فاصله PR تا افتادن یک کمپلکس QRS مشخص می‌شود.",
            "نادرست است؛ دلیل رد: موبیتز تیپ ۲ با فواصل PR ثابت و افتادن ناگهانی هدایت QRS بدون طولانی شدن قبلی تظاهر می‌یابد.",
            "صحیح است؛ بروز سنکوپ در یک فرد سالمند با نوار قلبی نشان‌دهنده عدم ارتباط و تفکیک کامل بین امواج P و کمپلکس‌های QRS (AV Dissociation) با ریت آهسته و منظم بطنی (Escape Rhythm)، تابلوی «بلوک کامل قلبی دهلیزی-بطنی (Complete Heart Block / Third-Degree AV Block)» یا سندرم استوکس-آدامز است؛ درمان انتخابی و نجات‌بخش تعبیه فوری ضربان‌ساز موقت و سپس پی‌س‌میکر دائمی است."
        ],
        "exp": "تفکیک کامل دهلیزی-بطنی (امواج P و کمپلکس‌های QRS کاملاً مستقل) همراه با سنکوپ در سالمند، مشخصه بلوک کامل قلبی است.",
        "micro": {
            "lead_fa": "بلوک درجه سه دهلیزی-بطنی (Complete Heart Block) ناشی از تخریب یا فیبروز فیبرهای هدایتی گره AV یا سیستم هیس-پورکنژ (بیماری لنگر یا لو) است. در نوار قلب، دهلیزها با ریتم سینوسی مستقل خود و بطن‌ها با ریتم فرار اتوماتیک آهسته جانکشنال یا ایدیوبنتاریکولار (معمولاً ۳۰ تا ۴۰ ضربه در دقیقه) منقبض می‌شوند و هیچ ارتباطی بین امواج P و QRS وجود ندارد. حملات سنکوپ ناشی از ایسکمی مغزی (حملات Adams-Stokes) نیازمند تعبیه ضربان‌ساز دائمی است.",
            "lead_en": "Third-degree (complete) atrioventricular (AV) block reflects complete failure of electrical conduction between atria and ventricles, typically driven by idiopathic conduction fibrosis (Lenegre-Lev disease). The ECG pathognomonic hallmark is complete AV dissociation: regular P-P and regular R-R intervals marching completely independently. Recurrent syncope (Stokes-Adams attacks) dictates permanent pacemaker implantation.",
            "golden_fa": "سنکوپ در سالمند + عدم ارتباط کامل P با QRS در نوار قلب = بلوک کامل قلبی (Complete AV Block)؛ درمان: تعبیه پی‌س‌میکر.",
            "golden_en": "Syncope in elderly + complete AV dissociation on ECG = complete heart block; definitive therapy: permanent pacemaker.",
            "points_fa": [
                "در بلوک کامل قلبی، فاصله P-P منظم و فاصله R-R منظم است اما فواصل PR کاملاً متغیر و تصادفی است.",
                "در صورت ناپایداری حاد یا برادی‌کاردی شدید، آتروپین وریدی و پی‌سینگ موقت از راه پوست شروع می‌شود.",
                "رد علل برگشت‌پذیر نظیر سمیت دارویی (دیگوکسین، بتابلوکرها)، ایسکمی و هیپرکالمی اجباری است.",
                "تعبیه پی‌س‌میکر دائمی بقای طولانی‌مدت بیمار را تضمین کرده و مانع از مرگ ناگهانی می‌شود."
            ],
            "points_en": [
                "In complete heart block, P-P intervals are regular and R-R intervals are regular, but P-R intervals vary continuously.",
                "Acute symptomatic instability warrants bedside transcutaneous pacing backup alongside intravenous atropine/epinephrine.",
                "Reversible etiologies—medication toxicity (digoxin, beta-blockers), acute inferior MI, and hyperkalemia—must be excluded.",
                "Dual-chamber permanent transvenous pacemaker implantation restores physiological rate and averts sudden cardiac death."
            ]
        }
    },
    163: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: انفارکتوس قدامی (Ant. MI) با بالا رفتن قطعه ST در لیدهای V1 تا V4 مشخص می‌شود.",
            "صحیح است؛ درد فشارنده رترواسترنال حاد با انتشار به بازو، تعریق و تهوع همراه با افزایش قطعه ST در لیدهای تحتانی II، III و aVF (و تغییرات متقابل دپرسیون ST در لیدهای I و aVL)، تابلوی کلاسیک و پاتوگنومونیک «انفارکتوس میوکارد دیواره تحتانی (Inferior MI / Inf.MI)» ناشی از انسداد حاد ترومبوتیک شریان کرونر راست (RCA) یا به ندرت شریان سیرکومفلکس (LCx) است.",
            "نادرست است؛ دلیل رد: انفارکتوس لترال با صعود ST در لیدهای I، aVL، V5 و V6 مشخص می‌شود.",
            "نادرست است؛ دلیل رد: انفارکتوس خلفی با دپرسیون افقی ST و امواج R بلند در لیدهای V1-V2 مشخص می‌گردد."
        ],
        "exp": "درد سینه همراه با بالا رفتن قطعه ST در لیدهای II، III و aVF، تابلوی انفارکتوس تحتانی میوکارد (Inferior MI) است.",
        "micro": {
            "lead_fa": "انفارکتوس میوکارد دیواره تحتانی بطن چپ (Inferior STEMI) در اثر انسداد حاد شریان کرونر راست (RCA در ۸۵ تا ۹۰ درصد موارد) یا شریان سیرکومفلکس چپ رخ می‌دهد. مشخصات نوار قلب: بالا رفتن قطعه ST به میزان مساوی یا بیش از ۱ میلی‌متر در حداقل دو لید مجاور تحتانی شامل لیدهای II، III و aVF، همراه با فرورفتگی متقابل (Reciprocal ST depression) در لیدهای I و aVL. به دلیل همراهی در ۴۰ درصد موارد با انفارکتوس بطن راست، بررسی لیدهای راست (V4R) الزامی است.",
            "lead_en": "Acute inferior wall myocardial infarction (inferior STEMI) stems from acute occlusion of the right coronary artery (RCA) or left circumflex artery (LCx). The defining electrocardiographic criterion is ST-segment elevation ≥1 mm across contiguous inferior leads II, III, and aVF, accompanied by reciprocal ST depressions in lateral leads I and aVL. Right-sided leads (V4R) must be recorded to rule out RV infarction.",
            "golden_fa": "درد حاد سینه + صعود ST در لیدهای II، III و aVF = انفارکتوس دیواره تحتانی (Inferior MI) ناشی از انسداد RCA.",
            "golden_en": "Acute chest pain + ST elevation in leads II, III, and aVF = inferior myocardial infarction (Inferior MI) due to RCA occlusion.",
            "points_fa": [
                "ثبت لیدهای سمت راست (V3R و V4R) در تمام بیماران دچار اینفریور MI جهت رد درگیری بطن راست اجباری است.",
                "در صورت همراهی با درگیری بطن راست، مصرف نیتروگلیسیرین و دیورتیک‌ها به علت افت شدید برون‌ده قلبی ممنوع است.",
                "اقدام درمانی اورژانس، آنژیوپلاستی اولیه عروق کرونر (Primary PCI) با هدف زمان درب به بالون زیر ۹۰ دقیقه است.",
                "برادی‌کاردی سینوسی و بلوک‌های AV در ساعات اول ناشی از تحریک واگ یا ایسکمی گره شایع هستند."
            ],
            "points_en": [
                "Right precordial lead V4R recording is mandatory to identify concurrent right ventricular involvement.",
                "Nitroglycerin, morphine, and diuretics are strictly avoided in RV infarction to prevent profound preload-dependent collapse.",
                "Immediate coronary revascularization via primary percutaneous coronary intervention (PCI) is the gold standard.",
                "Sinus bradycardia and high-degree AV block frequently emerge due to localized nodal ischemia and Bezold-Jarisch reflex."
            ]
        }
    },
    164: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: کارودیلول (بتابلوکر) بقای بیماران نارسایی قلبی را بیش از ۳۵ درصد بهبود می‌بخشد.",
            "صحیح است (دارویی که کمترین تأثیر را در کاهش مرگ‌ومیر دارد)؛ «داروهای استاتین (نظیر آتورواستاتین)» در کارآزمایی‌های بالینی بزرگ بین‌المللی (از جمله مطالعات CORONA و GISSI-HF) ثابت کرده‌اند که در بیماران مبتلا به نارسایی قلبی با کسر تخلیه‌ای کاهش‌یافته (HFrEF) «هیچ‌گونه اثری در کاهش مورتالیتی و مرگ‌ومیر قلبی ندارند»؛ در حالی که داروهای کارودیلول، مهارکننده‌های RAAS (والسارتان/ARNI) و آنتاگونیست‌های آلدوسترون (اسپیرونولاکتون) ستون‌های چهارگانه کاهش مورتالیتی در HFrEF هستند.",
            "نادرست است؛ دلیل رد: والسارتان و مهارکننده‌های محور رنین-آنژیوتانسین مورتالیتی نارسایی قلبی را به طور چشمگیری کاهش می‌دهند.",
            "نادرست است؛ دلیل رد: اسپیرونولاکتون (آنتاگونیست گیرنده مینرالوکورتیکوئید) مرگ‌ومیر نارسایی قلبی را تا ۳۰ درصد کم می‌کند."
        ],
        "exp": "استاتین‌ها (آتورواستاتین) در نارسایی قلبی با افت EF مورتالیتی را کاهش نمی‌دهند؛ بتابلوکر، ARNI و MRA نجات‌بخش هستند.",
        "micro": {
            "lead_fa": "چهار ستون دارویی کاهش‌دهنده مورتالیتی در نارسایی قلبی با افت کسر تخلیه بطن چپ (HFrEF با EF زیر ۴۰٪) بر اساس راهنماهای AHA/ACC عبارتند از: ۱) مهارکننده‌های SGLT2 (امپاگلیفلوزین یا داپاگلیفلوزین)؛ ۲) مهارکننده نپری‌لیزین/گیرنده آنژیوتانسین (ARNI نظیر ساکوبیتریل-والسارتان) یا مهارکننده ACE؛ ۳) بتابلوکرهای اختصاصی اثبات‌شده (کارودیلول، متوپرولول سوکسینات، بیزوپرولول)؛ ۴) آنتاگونیست‌های گیرنده مینرالوکورتیکوئید (اسپیرونولاکتون یا اپلرنون). استاتین‌ها مورتالیتی نارسایی قلبی را کم نمی‌کنند.",
            "lead_en": "Guideline-directed medical therapy (GDMT) establishing proven mortality reduction in heart failure with reduced ejection fraction (HFrEF) relies on four foundational drug classes: 1) ARNI/ACEI/ARB; 2) evidence-based beta-blockers (carvedilol, metoprolol succinate, bisoprolol); 3) mineralocorticoid receptor antagonists (spironolactone); and 4) SGLT2 inhibitors. Large randomized trials (CORONA and GISSI-HF) demonstrated that statins (atorvastatin) provide no survival benefit in HFrEF.",
            "golden_fa": "کاهش مورتالیتی در نارسایی قلبی HFrEF: بتابلوکر، ARNI، اسپیرونولاکتون و SGLT2i؛ استاتین‌ها مورتالیتی را کم نمی‌کنند.",
            "golden_en": "Mortality reduction in HFrEF: beta-blockers, ARNI, MRAs, and SGLT2 inhibitors; statins do not improve survival.",
            "points_fa": [
                "استاتین‌ها فقط در صورتی که بیمار همزمان اندیکاسیون بیماری عروق کرونر داشته باشد ادامه می‌یابند اما درمان اولیه HFrEF نیستند.",
                "کارودیلول با مهار گیرنده‌های آلفا-۱ و بتا مورتالیتی و بستری مجدد را کاهش می‌دهد.",
                "اسپیرونولاکتون فیبروز میوکارد را مهار کرده و نیازمند پایش منظم پتاسیم و کراتینین است.",
                "دیگوکسین علائم و بستری را کاهش می‌دهد اما مورتالیتی را تغییر نمی‌دهد."
            ],
            "points_en": [
                "Statins are maintained if independently indicated for secondary ischemic prevention, but exert no intrinsic CHF survival benefit.",
                "Carvedilol provides combined non-selective beta- and alpha-1-adrenergic blockade, dramatically improving long-term ejection fraction.",
                "Spironolactone attenuates neurohormonal myocardial fibrosis, mandating surveillance of serum potassium and renal indices.",
                "Digoxin reduces hospitalizations and alleviates congestive symptoms but produces no net reduction in all-cause mortality."
            ]
        }
    },
    165: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: نیترات‌های طولانی‌اثر و مسدودکننده‌های کانال کلسیم داروهای خط اول اتساع‌دهنده عروق کرونر در آنژین پرینزمتال هستند.",
            "نادرست است؛ دلیل رد: اسپاسم شدید و طولانی‌مدت شریان کرونر اپی‌کاردیال می‌تواند منجر به آسیب میوکارد و افزایش آنزیم تروپونین شود.",
            "نادرست است؛ دلیل رد: استاتین‌ها با بهبود عملکرد اندوتلیوم و مهار مسیر Rho-kinase وازواسپاسم را کاهش می‌دهند.",
            "صحیح است (جمله‌ای که صحیح نیست)؛ در آنژین وازواسپاستیک پرینزمتال خالص بدون پلاک و تنگی آترواسکلروتیک، تجویز روتین آسپیرین توصیه نمی‌شود؛ در واقع «آسپیرین (به‌ویژه در دوزهای بالا یا روتین) با مهار ساخت پروستاسیکلین گشادکننده عروقی (PGI2) توسط سلول‌های اندوتلیوم، می‌تواند وازواسپاسم عروق کرونر را تشدید نماید»؛ بنابراین تجویز آن به صورت پیش‌فرض در نبود پلاک انسدادی نادرست است."
        ],
        "exp": "در آنژین پرینزمتال خالص، آسپیرین با مهار پروستاسیکلین اندوتلیوم می‌تواند اسپاسم عروق کرونر را تشدید کند.",
        "micro": {
            "lead_fa": "آنژین وازواسپاستیک (پرینزمتال) ناشی از اسپاسم حاد موضعی شریان‌های کرونر بزرگ اپی‌کارد است که به صورت دردهای تیپیک سینه در حالت استراحت و ساعات اولیه بامداد تظاهر می‌یابد و با بالا رفتن گذرای قطعه ST همراه است. خط اول درمان مسدودکننده‌های کانال کلسیم (دیلتیازم، وراپامیل، املودیپین) و نیترات‌ها هستند. بتابلوکرها به علت وازوکانستریکسیون آلفا منع مصرف مطلق دارند. آسپیرین با مهار پروستاسیکلین طبیعی ممکن است اسپاسم را تشدید کند.",
            "lead_en": "Prinzmetal's (vasospastic) angina stems from localized hyperreactivity and focal vasospasm of epicardial coronary arteries, typically striking at rest during nocturnal or early morning hours with transient ST-segment elevation. Calcium channel blockers and long-acting nitrates are standard-of-care vasodilators. Aspirin can paradoxically worsen vasospasm via inhibition of endothelial prostacyclin synthesis.",
            "golden_fa": "درمان آنژین پرینزمتال: کلسیم‌بلوکرها و نیترات‌ها؛ بتابلوکرها ممنوع هستند و آسپیرین روتین تجویز نمی‌شود.",
            "golden_en": "Therapy for Prinzmetal angina: CCBs and nitrates; beta-blockers are contraindicated and aspirin may worsen spasm.",
            "points_fa": [
                "مصرف بتابلوکرهای غیراختصاصی در آنژین پرینزمتال به علت تحریک مهارنشده گیرنده‌های آلفا ممنوع است.",
                "استعمال سیگار مهم‌ترین فاکتور خطر قابل اجتناب در تحریک اسپاسم عروق کرونر است.",
                "آنژیوگرافی عروق کرونر فقدان تنگی انسدادی ثابت آترواسکلروتیک را اثبات می‌کند.",
                "تزریق داخل کرونری استیل‌کولین یا ارگونووین در کت‌لب برای برانگیختن اسپاسم تشخیصی به کار می‌رود."
            ],
            "points_en": [
                "Non-selective beta-blockers are strictly contraindicated; unopposed alpha-1 receptor stimulation exacerbates vasospasm.",
                "Cigarette smoking is the paramount modifiable risk factor triggering hyperreactive vascular tone.",
                "Coronary angiography reveals angiographically normal or non-obstructive coronary arteries.",
                "Intracoronary acetylcholine or ergonovine provocative testing confirms reproducible focal vasospasm during catheterization."
            ]
        }
    },
    166: {
        "ci": 0,
        "whys": [
            "صحیح است؛ وجود تریاد بک (Beck's Triad: افت فشار خون سیستولی BP=100/60، تاکی‌کاردی، صداهای قلبی مبهم و خفه، و برجستگی ورید وداج JVP) همراه با افت بیش از ۱۰ میلی‌متر جیوه‌ای فشار خون سیستولی در دم (پالس پارادوکس = ۱۵ mmHg) در یک خانم مبتلا به سرطان پستان، اورژانس مرگبار «تامپوناد قلبی (Cardiac Tamponade)» را مسجل می‌سازد؛ روش تشخیصی انتخابی، سریع و استاندارد طلایی بالینی «اکوکاردیوگرافی فوری ترانس‌توراسیک (Transthoracic Echocardiography)» است که کلاپس دیاستولی بطن راست و دهلیز راست را نشان داده و پریکاردیوسنتز را هدایت می‌کند.",
            "نادرست است؛ دلیل رد: عکس قفسه سینه بزرگی سایه قلب را نشان می‌دهد اما برای اثبات تامپوناد اختصاصی نیست.",
            "نادرست است؛ دلیل رد: سی‌تی‌اسکن قفسه سینه روش انتخابی اورژانسی در بستر بیمار ناپایدار نیست.",
            "نادرست است؛ دلیل رد: آنژیوگرافی عروق کرونر جایگاهی در ارزیابی اورژانس تامپوناد پریکارد ندارد."
        ],
        "exp": "اکوکاردیوگرافی ترانس‌توراسیک روش تشخیصی انتخابی، سریع و استاندارد در اثبات تامپوناد قلبی و افیوژن پریکارد است.",
        "micro": {
            "lead_fa": "تامپوناد قلبی ناشی از تجمع مایع در فضای پریکارد تحت فشار بالا است که مانع از پر شدن دیاستولی حفرات قلب می‌شود. تظاهرات شاخص: ۱) تریاد بک شامل هایپوتنشن، اتساع وریدهای ژوگولار (JVP برجسته) و صداهای قلبی خفه (Muffled heart sounds)؛ ۲) نبض متناقض یا پالس پارادوکس (افت فشار سیستولی بیش از ۱۰ میلی‌متر جیوه در دم). اکوکاردیوگرافی فوری روش انتخابی استاندارد طلایی است که کلاپس دیاستولی دیواره بطن راست، کلاپس سیستولی دهلیز راست و تغییرات تنفسی جریان‌های دریچه‌ای را آشکار می‌سازد.",
            "lead_en": "Cardiac tamponade represents a life-threatening oncologic/cardiac crisis wherein pericardial effusion under tension compresses cardiac chambers, blunting diastolic filling. Hallmark physical signs include Beck's triad (hypotension, jugular venous distention, muffled heart sounds) and pulsus paradoxus (>10 mmHg systolic drop during inspiration). Bedside transthoracic echocardiography is the definitive diagnostic modality.",
            "golden_fa": "تریاد بک (افت فشار + JVP برجسته + صدای خفه قلب) + پالس پارادوکس = تامپوناد قلبی؛ اقدام انتخابی: اکوکاردیوگرافی فوری.",
            "golden_en": "Beck's triad + pulsus paradoxus = cardiac tamponade; procedure of choice: emergent bedside echocardiography.",
            "points_fa": [
                "اکوکاردیوگرافی کلاپس دیاستولی دیواره آزاد بطن راست را به عنوان حساس‌ترین نشانه تامپوناد نشان می‌دهد.",
                "درمان اورژانسی نجات‌بخش پریکاردیوسنتز با هدایت سونوگرافی یا اکوکاردیوگرافی است.",
                "تجویز بولوس مایع وریدی نرمال سالین به عنوان پل کوتاه‌مدت تا زمان درناژ پریکارد فشار پرشدگی را بالا می‌برد.",
                "مصرف دیورتیک‌ها و وازودیلاتورها در تامپوناد قلبی ممنوع است زیرا افت فشار خون کشنده ایجاد می‌کنند."
            ],
            "points_en": [
                "Echocardiographic diastolic collapse of the right ventricular free wall is the hallmark sign confirming hemodynamic compromise.",
                "Emergent pericardiocentesis under direct ultrasound/echocardiographic guidance is the definitive life-saving intervention.",
                "Intravenous isotonic crystalloid boluses provide crucial temporizing hemodynamic support prior to fluid evacuation.",
                "Vasodilators and diuretics are strictly contraindicated as they precipitate catastrophic hemodynamic collapse."
            ]
        }
    },
    167: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: تجویز آنتی‌بیوتیک در باکتریوری بدون علامت در زنان غیرباردار مقاومت میکروبی و عوارض دارویی ایجاد می‌کند.",
            "نادرست است؛ دلیل رد: باکتریوری بدون علامت در زنان جوان سالم نیازی به بررسی‌های پیچیده ندارد.",
            "صحیح است؛ در یک خانم جوان، غیرباردار و سالم که هیچ‌گونه علائم یا نشانه‌های بالینی ادراری (سوزش ادرار، تکرر، فوریت، تب یا درد پهلو) ندارد و صرفاً کشت ادرار مثبت دارد، وضعیت «باکتریوری بدون علامت (Asymptomatic Bacteriuria / ASB)» مطرح است؛ بر اساس تمام راهنماهای انجمن بیماری‌های عفونی آمریکا (IDSA)، «هیچ‌گونه نیازی به درمان آنتی‌بیوتیکی وجود ندارد»؛ درمان ASB منحصراً در زنان باردار و بیمارانی که قرار است تحت اعمال جراحی اورولوژیک با خونریزی مخاطی قرار گیرند اندیکاسیون دارد.",
            "نادرست است؛ دلیل رد: انجام سونوگرافی کلیه و سیستم ادراری در باکتریوری بدون علامت در زن جوان سالم اندیکاسیون ندارد."
        ],
        "exp": "باکتریوری بدون علامت در زنان غیرباردار و بدون علائم ادراری نیازی به درمان آنتی‌بیوتیکی ندارد.",
        "micro": {
            "lead_fa": "باکتریوری بدون علامت (ASB) به صورت وجود باکتری با کلونی بالای ۱۰۰٬۰۰۰ در کشت ادرار در فردی که کاملاً فاقد علائم سوزش، تکرر و تب است تعریف می‌شود. طبق راهنماهای بین‌المللی IDSA، درمان آنتی‌بیوتیکی در اکثریت مطلق بیماران (شامل زنان سالم غیرباردار، افراد دیابتی، سالمندان مقیم آسایشگاه و افراد دارای کاتتر ادراری) فاقد فایده بوده و به شدت نهی شده است. تنها دو اندیکاسیون قطعی درمان ASB عبارتند از: ۱) زنان باردار؛ ۲) پیش از اعمال جراحی تهاجمی اورولوژی.",
            "lead_en": "Asymptomatic bacteriuria (ASB) entails quantitative growth of ≥10^5 CFU/mL of a pure bacterial isolate without urinary tract symptoms. IDSA guidelines strictly recommend against screening or antimicrobial therapy in healthy non-pregnant women, diabetic cohorts, or elderly individuals. Antibiotic treatment provides zero clinical benefit while breeding antimicrobial resistance, indicated solely in pregnancy and prior to urologic mucosal procedures.",
            "golden_fa": "کشت مثبت ادرار بدون هیچ علامت ادراری در زن غیرباردار = باکتریوری بدون علامت (ASB)؛ نیاز به درمان آنتی‌بیوتیکی نیست.",
            "golden_en": "Positive urine culture without urinary symptoms in non-pregnant female = ASB; antibiotic therapy is not indicated.",
            "points_fa": [
                "غربالگری و درمان ASB در زنان باردار برای پیشگیری از پیلونفریت و زایمان زودرس الزامی است.",
                "پیش از جراحی‌های اندواورولوژی همراه با خونریزی مخاطی درمان آنتی‌بیوتیکی ASB اجباری است.",
                "درمان نابجای ASB منجر به کلونیزاسیون با باکتری‌های مقاوم به چند دارو (MDR) و عفونت کلستریدیوم دیفیسیل می‌شود.",
                "در صورت بروز علائم ادراری نظیر دیزوری و تکرر، سیستیت حاد مطرح شده و درمان آغاز می‌گردد."
            ],
            "points_en": [
                "Screening and antimicrobial eradication of ASB in pregnancy is mandatory to avert acute pyelonephritis and preterm labor.",
                "Pre-procedural antibiotics are required prior to invasive urologic interventions involving mucosal disruption.",
                "Inappropriate antimicrobial treatment of ASB breeds multidrug-resistant pathogens and Clostridioides difficile colitis.",
                "Emergence of true irritative lower urinary tract symptoms (dysuria, urgency) transitions management to acute cystitis."
            ]
        }
    },
    168: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: FSGS شیوع ترومبوز ورید کلیوی بسیار کمتری در مقایسه با نفروپاتی ممبرانوس دارد.",
            "نادرست است؛ دلیل رد: MPGN می‌تواند سندرم نفروتیک بدهد اما ریسک RVT آن به پای نفروپاتی غشایی نمی‌رسد.",
            "نادرست است؛ دلیل رد: نفروپاتی دیابتی سندرم نفروتیک ایجاد می‌کند اما به علت تعادل متفاوت فاکتورها، ریسک RVT بالایی ندارد.",
            "صحیح است؛ در میان تمام بیماری‌های گلومرولی ایجادکننده سندرم نفروتیک، «نفروپاتی غشایی (Membranous Glomerulopathy / MGN)» بالاترین شیوع، بیشترین نقش و قوی‌ترین استعداد را در ایجاد «ترومبوز ورید کلیوی (Renal Vein Thrombosis / RVT)» (در بیش از ۲۵ تا ۴۰ درصد بیماران به ویژه با آلبومین سرم زیر ۲ تا ۲/۵ گرم در دسی‌لیتر) به علت دفع ادراری شدید آنتی‌ترومبین III و فعال شدن آبشار انعقادی دارد."
        ],
        "exp": "نفروپاتی غشایی (MGN) بالاترین شیوع و بیشترین نقش را در ایجاد ترومبوز ورید کلیوی (RVT) در سندرم نفروتیک دارد.",
        "micro": {
            "lead_fa": "سندرم نفروتیک یک وضعیت هایپرکواگولابل شدید است که به علت دفع پروتئین‌های ضدانعقاد پلاسمایی در ادرار (به‌ویژه آنتی‌ترومبین ۳، پروتئین C و S)، افزایش تولید فیبرینوژن در کبد و بیش‌فعالی پلاکت‌ها ایجاد می‌شود. در بین تمام اتولوژی‌های سندرم نفروتیک، نفروپاتی ممبرانوس (MGN) با فاصله زیاد بیشترین تمایل را به ترومبوز ورید کلیه (RVT) دارد به طوری که در تا ۳۰ درصد بیماران رخ می‌دهد. در صورت افت آلبومین به زیر ۲ تا ۲/۵، ضدانعقاد پروفیلاکتیک مدنظر قرار می‌گیرد.",
            "lead_en": "Nephrotic syndrome generates an intense hypercoagulable state through urinary loss of regulatory anticoagulants (antithrombin III, protein S) juxtaposed with hepatic fibrinogen hyperproduction. Among all nephrotic glomerulopathies, membranous nephropathy (MGN) exhibits the highest incidence of renal vein thrombosis (RVT), afflicting 25-35% of cohorts, especially when serum albumin drops below 2.0-2.5 g/dL.",
            "golden_fa": "شایع‌ترین علت گلومرولی ترومبوز ورید کلیوی (RVT) = نفروپاتی غشایی (Membranous Nephropathy / MGN).",
            "golden_en": "Most common glomerular etiology driving renal vein thrombosis (RVT) = membranous nephropathy (MGN).",
            "points_fa": [
                "تظاهر بالینی RVT حاد شامل درد ناگهانی پهلو، هماچوری ماکروسکوپیک و افت حاد کارکرد کلیه است.",
                "در بسیاری از بیماران مبتلا به MGN، ترومبوز ورید کلیوی به صورت مزمن و بی‌علامت پیشرفت می‌کند.",
                "سونوگرافی داپلر عروق کلیه یا CT ونوگرافی روش‌های انتخابی تشخیصی هستند.",
                "درمان RVT تجویز فوری هپارین و ادامه داروی ضدانعقاد خوراکی تا زمان برطرف شدن سندرم نفروتیک است."
            ],
            "points_en": [
                "Acute presentation features severe flank pain, gross hematuria, worsening proteinuria, and renal failure.",
                "In many MGN patients, renal vein thrombosis develops insidiously as an indolent, asymptomatic subclinical event.",
                "Renal Doppler ultrasonography or contrast-enhanced CT venography represents the diagnostic imaging modality of choice.",
                "Management dictates immediate therapeutic systemic anticoagulation maintained as long as nephrotic-range hypoalbuminemia persists."
            ]
        }
    },
    169: {
        "ci": 2,
        "whys": [
            "نادرست است؛ دلیل رد: آنمی ناشی از کاهش تولید اریتروپویتین در اثر فیبروز اینترستیشیوم در نفریت بینابینی مزمن شایع است.",
            "نادرست است؛ دلیل رد: فشار خون بالا به علت احتباس نمک و فعال شدن رنین از یافته‌های شایع بیماری است.",
            "صحیح است (یافته‌ای که با بیماری مطابقت ندارد)؛ نفریت بینابینی مزمن (Chronic Tubulointerstitial Nephritis / CIN) با آسیب لوله‌های کلیوی و اسیدوز توبولار نوع ۴ (RTA Type 4 با مقاومت یا کمبود آلدوسترون) همراه است و به طور مشخص موجب «هایپرکالمی (افزایش پتاسیم خون / Hyperkalemia)» می‌گردد نه هایپوکالمی؛ بنابراین بروز هایپوکالمی با این بیماری همخوانی ندارد.",
            "نادرست است؛ دلیل رد: کاهش قدرت تغلیظ ادرار (ایزوستنوری و پولی‌اوری) به علت تخریب شیب مدولاری شاخص‌ترین علامت درگیری توبولواینترستیشیال است."
        ],
        "exp": "نفریت بینابینی مزمن با اسیدوز توبولار نوع ۴ و هایپرکالمی همراه است؛ بنابراین هایپوکالمی با آن مطابقت ندارد.",
        "micro": {
            "lead_fa": "نفریت بینابینی مزمن (CIN) با آتروفی پیشرونده توبول‌ها و فیبروز بافت بینابینی کلیه مشخص می‌شود. ویژگی‌های عملکردی و بالینی شاخص: ۱) از دست رفتن زودهنگام قدرت تغلیظ ادرار در مدولا با ایجاد ناکچوری و پولی‌اوری (ایزوستنوری)؛ ۲) کاهش زودهنگام ترشح اریتروپویتین توسط فیبروبلاست‌های بینابینی که منجر به آنمی شدید نامتناسب با میزان کراتینین می‌شود؛ ۳) هیپوآلدوسترونیسم هیپورنینمیک (RTA نوع ۴) که موجب هایپرکالمی و اسیدوز متابولیک می‌گردد.",
            "lead_en": "Chronic tubulointerstitial nephritis (CIN) is pathologically characterized by interstitial fibrosis and tubular atrophy. Hallmark clinical manifestations encompass: 1) early defect in urinary concentrating ability (polyuria, nocturia, isosthenuria); 2) disproportionate early normocytic anemia due to loss of peritubular erythropoietin-producing cells; and 3) type 4 renal tubular acidosis provoking hyperkalemia, not hypokalemia.",
            "golden_fa": "نفریت بینابینی مزمن (CIN): کاهش قدرت تغلیظ ادرار، آنمی زودهنگام و هایپرکالمی (نه هایپوکالمی).",
            "golden_en": "Chronic tubulointerstitial nephritis (CIN): impaired concentration, early anemia, and hyperkalemia (not hypokalemia).",
            "points_fa": [
                "اسیدوز توبولار نوع ۴ در اثر مقاومت توبول به آلدوسترون هایپرکالمی ایجاد می‌کند.",
                "پروتئینوری در CIN معمولاً خفیف تا متوسط (کمتر از ۱ تا ۲ گرم در روز و از نوع توبولار) است.",
                "شایع‌ترین علل CIN شامل مصرف مزمن مسکن‌ها (نفروپاتی آنالژزیک)، ریفلاکس ادراری، مسمومیت با فلزات سنگین و نقرس هستند.",
                "سدیمان ادراری معمولاً آرام و فاقد کست‌های گلومرولی فعال خونی است."
            ],
            "points_en": [
                "Type 4 renal tubular acidosis impairs distal potassium excretion, inducing characteristic hyperkalemia.",
                "Proteinuria in CIN is modest (typically tubular microproteinuria <1-2 g/day), sparing nephrotic ranges.",
                "Leading etiologies encompass analgesic nephropathy (NSAID abuse), reflux nephropathy, heavy metals, and hyperuricemia.",
                "Urinary sediment is typically bland, devoid of dysmorphic red cells or active cellular casts."
            ]
        }
    },
    170: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: سونوگرافی حساسیت پایینی در کشف سنگ‌های حالب دارد و روش استاندارد قطعی نیست گرچه در بارداری خط اول است.",
            "نادرست است؛ دلیل رد: گرافی ساده KUB سنگ‌های رادیولوسنت (اسید اوریکی) و سنگ‌های کوچک حالب را نشان نمی‌دهد.",
            "نادرست است؛ دلیل رد: MRI سنگ‌های کلسیمی را نشان نمی‌دهد و سیگنال خالی ایجاد می‌کند.",
            "صحیح است؛ تست تشخیصی استاندارد طلایی (Gold Standard) و دقیق‌ترین روش تصویربرداری جهت بررسی وجود، اندازه و محل دقیق سنگ‌های کلیوی و حالب «سی‌تی‌اسکن اسپیرال شکم و لگن بدون تزریق ماده حاجب (Non-contrast CT Abdomen and Pelvis)» با حساسیت و ویژگی بالای ۹۸ تا ۹۹ درصد است که تمامی انواع سنگ‌ها (به جز سنگ‌های بسیار نادر دارویی نظیر ایندیناویر) را آشکار می‌سازد."
        ],
        "exp": "سی‌تی‌اسکن اسپیرال بدون ماده حاجب استاندارد طلایی و دقیق‌ترین روش تشخیصی برای سنگ‌های کلیوی و حالب است.",
        "micro": {
            "lead_fa": "سی‌تی‌اسکن هلیکال بدون تزریق ماده حاجب با دوز تابش کم (Low-dose non-contrast CT) استاندارد طلایی برای اثبات سنگ کلیه و ارزیابی کولیک رنال حاد است. حساسیت و ویژگی این روش بیش از ۹۸ درصد است و اندازه سنگ، محل دقیق انسداد حالب، درجه هیدرونفروز و اتولوژی‌های افتراقی حاد شکمی را به وضوح مشخص می‌سازد. در زنان باردار سونوگرافی کلیه‌ها و مثانه به عنوان خط اول تصویربرداری بدون اشعه جایگزین می‌گردد.",
            "lead_en": "Low-dose non-contrast helical computed tomography (NCCT) of the abdomen and pelvis represents the definitive diagnostic gold standard for evaluating suspected nephrolithiasis and acute ureteral colic (>98% sensitivity and specificity). It precisely delineates stone dimensions, exact ureteral localization, hydronephrosis severity, and alternate non-renal pathology.",
            "golden_fa": "روش تشخیصی استاندارد و انتخابی برای سنگ کلیه و حالب = سی‌تی‌اسکن شکم و لگن بدون ماده حاجب.",
            "golden_en": "Standard diagnostic imaging for nephrolithiasis = non-contrast CT (NCCT) of the abdomen and pelvis.",
            "points_fa": [
                "سی‌تی‌اسکن بدون حاجب سنگ‌های اسید اوریکی رادیولوسنت را نیز به وضوح شناسایی می‌کند.",
                "در زنان باردار و کودکان سونوگرافی کلیه خط اول تصویربرداری است تا از تابش اشعه X اجتناب شود.",
                "سنگ‌های با ابعاد کمتر از ۵ میلی‌متر در بیش از ۸۰ تا ۹۰ درصد موارد خودبه‌خود با درمان نگهدارنده دفع می‌شوند.",
                "تنها سنگ‌های نادر ناشی از داروی ایندیناویر در سی‌تی‌اسکن رادیولوسنت هستند."
            ],
            "points_en": [
                "Non-contrast CT readily visualizes radiolucent uric acid stones that are completely invisible on plain KUB.",
                "In pregnant or pediatric cohorts, renal ultrasonography is the primary imaging modality to avoid ionizing radiation.",
                "Calculi measuring <5 mm in diameter pass spontaneously in >80-90% of cases under medical expulsive therapy.",
                "Indinavir protease-inhibitor-induced calculi represent the rare exception, remaining radiolucent on CT."
            ]
        }
    },
    171: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: آنوریسم‌های داخل مغزی (Berry Aneurysm) در حدود ۱۰ تا ۱۵ درصد بیماران دیده می‌شود نه در تمامی بیماران.",
            "نادرست است؛ دلیل رد: ADPKD بیماری بزرگسالی است و علائم بالینی به طور کلاسیک در دهه‌های سوم تا پنجم زندگی بروز می‌کند.",
            "نادرست است؛ دلیل رد: کیست‌های کلیوی در بیماری اتوزومال غالب همواره به صورت دوطرفه (Bilateral) و متعدد پیشرفت می‌کنند.",
            "صحیح است؛ در بیماران مبتلا به بیماری کلیه پلی‌کیستیک اتوزومال غالب (ADPKD ناشی از جهش ژن‌های PKD1 یا PKD2)، به دلیل نقص در کلاژن و ماتریکس بافت همبند، «اختلالات دریچه‌ای قلب به ویژه پرولاپس دریچه میترال (Mitral Valve Prolapse / MVP در بیش از ۲۵ تا ۳۰ درصد بیماران)» و نارسایی دریچه آئورت به مراتب شایع‌تر از جمعیت عمومی است."
        ],
        "exp": "اختلالات دریچه‌ای قلب (به ویژه MVP در ۲۵٪ موارد) در بیماری کلیه پلی‌کیستیک اتوزومال غالب شایع‌تر از افراد عادی است.",
        "micro": {
            "lead_fa": "بیماری کلیه پلی‌کیستیک اتوزومال غالب (ADPKD) یک بیماری ژنتیکی سیستمیک است که با بزرگ شدن پیشرونده کیست‌های دوطرفه کلیه و تخریب پارانشیم مشخص می‌شود. تظاهرات خارج کلیوی شاخص عبارتند از: ۱) کیست‌های کبدی (شایع‌ترین تظاهر خارج کلیوی در بیش از ۷۰٪ مبتلایان)؛ ۲) اختلالات قلبی-عروقی شامل پرولاپس دریچه میترال (MVP) در ۲۵٪، نارسایی آئورت و آنوریسم ریشه آئورت؛ ۳) آنوریسم‌های ساکولار عروق مغزی (Berry aneurysm) در ۱۰ تا ۱۵ درصد بیماران.",
            "lead_en": "Autosomal dominant polycystic kidney disease (ADPKD) is a systemic genetic disorder characterized by bilateral renal cyst expansion leading to end-stage renal disease. Extrarenal manifestations encompass polycystic liver disease, intracranial berry aneurysms (10-15%), and cardiac valvular abnormalities, most prominently mitral valve prolapse (MVP), which affects ~25% of patients.",
            "golden_fa": "بیماری کلیه پلی‌کیستیک اتوزومال غالب (ADPKD): کیست‌های دوطرفه، MVP شایع و آنوریسم مغزی در ۱۰-۱۵٪.",
            "golden_en": "ADPKD: bilateral renal cysts, frequent mitral valve prolapse (25%), and intracranial berry aneurysms (10-15%).",
            "points_fa": [
                "بیماری در اثر جهش در ژن‌های PKD1 (کروموزوم ۱۶ با سیر شدیدتر) یا PKD2 (کروموزوم ۴) ایجاد می‌شود.",
                "غربالگری آنوریسم مغزی با MRA در بیماران با سابقه خانوادگی خونریزی ساب‌آراکنوئید یا خلبانان الزامی است.",
                "کنترل دقیق فشار خون با مهارکننده‌های ACE/ARB سرعت پیشرفت نارسایی کلیه را کاهش می‌دهد.",
                "داروی تولواپتان (آنتاگونیست وازوپرسین V2) رشد کیست‌ها را کند می‌سازد."
            ],
            "points_en": [
                "Etiology links to mutations in PKD1 (chromosome 16, more severe, 85%) or PKD2 (chromosome 4, 15%).",
                "Screening for intracranial aneurysms with magnetic resonance angiography (MRA) is indicated when family history is positive.",
                "Rigorous blood pressure control utilizing ACE inhibitors or ARBs slows renal functional decline.",
                "Tolvaptan (selective vasopressin V2 receptor antagonist) significantly retards cyst proliferation and eGFR loss."
            ]
        }
    },
    172: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: لیز توموری منجر به آزادسازی پتاسیم درون‌سلولی و هایپرکالمی شدید کشنده می‌شود نه هیپوکالمی.",
            "نادرست است؛ دلیل رد: تخریب اسیدهای نوکلئیک مقادیر انبوه فسفات آزاد کرده و هایپرفسفاتمی شدید ایجاد می‌کند.",
            "صحیح است؛ در بیماری که پس از شروع شیمی‌درمانی برای لوسمی حاد دچار اولیگوری، افزایش کراتینین و اسید اوریک بسیار بالا (Uric acid=14 mg/dL) شده است، تابلوی تیپیک «سندرم لیز تومور (Tumor Lysis Syndrome / TLS)» مطرح است؛ در این سندرم به دنبال هایپرفسفاتمی شدید و اتصال سریع یون‌های فسفات به کلسیم آزاد سرم و رسوب نمک فسفات کلسیم در بافت‌ها، عارضه شاخص بیوشیمیایی بروز «هیپوکلسمی (کاهش کلسیم سرم / Hypocalcemia)» است که می‌تواند منجر به تتانی، تشنج و آریتمی گردد.",
            "نادرست است؛ دلیل رد: هیپوناترمی جزء معیارهای تشخیصی تعریف‌شده برای سندرم لیز تومور نیست."
        ],
        "exp": "در سندرم لیز تومور، تتراد اختلالات شامل هایپراوریسمی، هایپرکالمی، هایپرفسفاتمی و «هیپوکلسمی» ثانویه است.",
        "micro": {
            "lead_fa": "سندرم لیز تومور (TLS) یک اورژانس انکولوژی ناشی از تخریب سریع و همزمان سلول‌های بدخیم با ترن‌اور بالا (نظیر ALL و لنفوم بورکیت) به دنبال شیمی‌درمانی است. تتراد بیوشیمیایی کلاسیک کایروس-بیشاپ شامل: ۱) هایپراوریسمی (آزادسازی پورین‌ها)؛ ۲) هایپرکالمی (خروج پتاسیم درون‌سلولی)؛ ۳) هایپرفسفاتمی (تجزیه نوکلئوتیدها)؛ ۴) هیپوکلسمی ثانویه شدید به علت رسوب و کریستالیزاسیون فسفات کلسیم در کلیه‌ها و بافت‌ها.",
            "lead_en": "Tumor lysis syndrome (TLS) is a life-threatening oncologic emergency triggered by massive lysis of high-turnover malignant hematologic cells. The Cairo-Bishop definition establishes a classic biochemical tetrad: hyperuricemia, hyperkalemia, hyperphosphatemia, and secondary hypocalcemia driven by precipitation of calcium phosphate salts, precipitating acute kidney injury.",
            "golden_fa": "اختلالات آزمایشگاهی سندرم لیز تومور (TLS): اسید اوریک بالا، پتاسیم بالا، فسفر بالا و کلسیم پایین (هیپوکلسمی).",
            "golden_en": "Tumor lysis syndrome (TLS) tetrad: hyperuricemia, hyperkalemia, hyperphosphatemia, and hypocalcemia.",
            "points_fa": [
                "رسوب کریستال‌های اسید اوریک و فسفات کلسیم در توبول‌ها مسبب نارسایی حاد کلیه (AKI) است.",
                "پروفیلاکسی استاندارد پیش از شیمی‌درمانی با هیدراسیون وریدی تهاجمی و آلوپورینول یا راسبوریکاز است.",
                "راسبوریکاز (اورات اکسیداز نوترکیب) مستقیماً اسید اوریک را به آلانتوئین محلول در آب تبدیل می‌کند.",
                "تصحیح هیپوکلسمی بدون علامت ممنوع است زیرا تزریق کلسیم رسوب فسفات کلسیم را در کلیه‌ها تشدید می‌نماید."
            ],
            "points_en": [
                "Intratubular crystallization of uric acid and calcium phosphate drives acute oliguric renal failure.",
                "Preventive prophylaxis incorporates aggressive isotonic intravenous hydration alongside allopurinol or rasburicase.",
                "Rasburicase (recombinant urate oxidase) enzymatically degrades insoluble uric acid into soluble allantoin.",
                "Asymptomatic hypocalcemia should not be treated with IV calcium, as calcium instillation accelerates fatal metastatic precipitation."
            ]
        }
    },
    173: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: آندوسکوپی و کولونوسکوپی در ارزیابی اول بعد از اثبات فقر آهن آشکار یا آزمایش مدفوع مثبت انجام می‌شوند نه به عنوان قدم اول آزمایشگاهی.",
            "نادرست است؛ دلیل رد: آزمایش مدفوع مرحله بعدی است اما بررسی کم‌خونی در نارسایی کلیه نیازمند ارزیابی ذخایر آهن است.",
            "صحیح است؛ در یک بیمار مبتلا به نارسایی مزمن کلیه (CKD) با آنمی (Hb=9 gr/dL)، طبق دستورالعمل‌های بین‌المللی KDIGO، پیش از هرگونه تصمیم‌گیری برای شروع داروهای محرک اریتروپوئز (ESA نظیر اریتروپویتین)، اولین و ضروری‌ترین اقدام در مرحله بعد «بررسی کامل پروفایل آهن سرم (Iron Profile شامل فریتین و درصد اشباع ترانسفرین TSAT)» است؛ زیرا فقر آهن شایع‌ترین علت عدم پاسخ به درمان در بیماران کلیوی است و تجویز اریتروپویتین بدون ذخایر کافی آهن اثربخش نخواهد بود.",
            "نادرست است؛ دلیل رد: شروع اریتروپویتین قبل از بررسی ذخایر آهن و اطمینان از کفایت فریتین و TSAT خطای پزشکی است."
        ],
        "exp": "در آنمی ناشی از نارسایی مزمن کلیه، اولین اقدام بررسی پروفایل آهن (فریتین و TSAT) پیش از تجویز اریتروپویتین است.",
        "micro": {
            "lead_fa": "آنمی در نارسایی مزمن کلیه (CKD) عمدتاً به دلیل کاهش تولید هورمون اریتروپویتین توسط کلیه‌ها ایجاد می‌شود. با این حال، طبق راهنمای معتبر KDIGO، اولین اقدام در بیمار آنمیک دارای CKD، رد سایر علل کم‌خونی و به ویژه بررسی پروفایل آهن (فریتین سرم و اشباع ترانسفرین TSAT) است. آستانه درمان آهن در بیماران CKD بسیار بالاتر از افراد عادی است (هدف TSAT بالای ۲۰ تا ۳۰ درصد و فریتین بالای ۱۰۰ تا ۵۰۰ نانوگرم/میلی‌لیتر). شروع اریتروپویتین بدون تصحیح آهن بی‌فایده است.",
            "lead_en": "Anemia of chronic kidney disease (CKD) stems primarily from diminished peritubular erythropoietin synthesis alongside uremic bone marrow resistance. KDIGO guidelines mandate evaluating absolute or functional iron deficiency via a complete iron profile (serum ferritin and transferrin saturation [TSAT]) as the initial clinical step prior to considering erythropoiesis-stimulating agents (ESAs).",
            "golden_fa": "آنمی در نارسایی کلیه (CKD): اولین اقدام در مرحله بعد = بررسی پروفایل آهن (فریتین و TSAT) قبل از شروع اریتروپویتین.",
            "golden_en": "Anemia in chronic kidney disease: initial next step = evaluate iron profile (ferritin and TSAT) prior to ESA initiation.",
            "points_fa": [
                "در صورت وجود فقر آهن، ابتدا آهن وریدی یا خوراکی تجویز می‌شود تا ذخایر پر شوند.",
                "شروع داروهای محرک اریتروپویتین (ESA) در صورتی که هموگلوبین زیر ۱۰ باشد پس از اصلاح آهن آغاز می‌گردد.",
                "هدف سطح هموگلوبین در درمان با اریتروپویتین بین ۱۰ تا ۱۱/۵ گرم در دسی‌لیتر است و نباید به بالای ۱۳ برسد.",
                "بالا بردن هموگلوبین به ارقام نرمال خطر حوادث ترومبوتیک قلبی-عروقی و سکته مغزی را افزایش می‌دهد."
            ],
            "points_en": [
                "Iron repletion (intravenous iron is preferred in advanced CKD) must precede or accompany ESA administration.",
                "Erythropoiesis-stimulating agents (ESAs) are considered when hemoglobin drops below 10 g/dL after iron optimization.",
                "The target maintenance hemoglobin range on ESA therapy is strictly kept between 10.0 and 11.5 g/dL.",
                "Overcorrecting hemoglobin (>13 g/dL) escalates risks of stroke, vascular access thrombosis, and cardiovascular death."
            ]
        }
    },
    174: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: وجود پلورال افیوژن در ۲۴ ساعت اول در سیستم‌های نمره‌دهی BISAP و رانسون نشانه درگیری شدید سیستمیک و پیش‌آگهی بد است.",
            "نادرست است؛ دلیل رد: BUN بالای ۲۵ تا ۳۰ نشانه نارسایی پره‌رنال ناشی از نشت مایع به فضای سوم و از معیارهای پروگنوز بد BISAP است.",
            "نادرست است؛ دلیل رد: افت فشار خون و تاکی‌کاردی نشانه شوک همودینامیک و سندرم SIRS و پیش‌آگهی بسیار ضعیف است.",
            "صحیح است (موردی که معیار پروگنوز بد نیست)؛ «سطح مطلق آمیلاز (و لیپاز) سرم» هیچ‌گونه ارتباطی با شدت التهاب، میزان نکروز بافتی یا پیش‌آگهی پانکراتیت حاد ندارد؛ در واقع یک پانکراتیت بسیار شدید نکروزان ممکن است با آمیلاز مختصر بالا همراه باشد در حالی که یک پانکراتیت خفیف بینابینی آمیلاز چند هزار داشته باشد؛ بنابراین میزان بالا بودن آمیلاز جزء معیارهای پیش‌آگهی بد محسوب نمی‌شود."
        ],
        "exp": "سطح سرمی آمیلاز یا لیپاز هیچ ارتباطی با شدت و پیش‌آگهی پانکراتیت حاد ندارد؛ افیوژن، BUN بالا و افت فشار نشانه پروگنوز بد هستند.",
        "micro": {
            "lead_fa": "در ارزیابی پیش‌آگهی و شدت پانکراتیت حاد، سیستم‌های امتیازدهی معتبر متعددی (شامل BISAP، رانسون و APACHE-II) وجود دارند. متغیرهای نشان‌دهنده پیش‌آگهی بد عبارتند از: BUN بالای ۲۵، اختلال هوشیاری، وجود سندروم پاسخ التهابی سیستمیک (SIRS با تاکی‌کاردی، تاکی‌پنه یا تب)، سن بالای ۶۰ سال و وجود پلورال افیوژن. یک اصل بنیادین در گوارش: میزان افزایش آنزیم‌های آمیلاز و لیپاز ارزش تشخیصی دارد اما ارزش پروگنوستیک ندارد.",
            "lead_en": "Staging acute pancreatitis severity and mortality relies on validated clinical scoring indices (BISAP, Ranson, APACHE-II). Poor prognostic indicators incorporate BUN >25 mg/dL, SIRS criteria, altered mental status, age >60, and presence of a pleural effusion. The magnitude of serum amylase (or lipase) elevation bears zero correlation with disease severity or patient prognosis.",
            "golden_fa": "سطح سرمی آمیلاز یا لیپاز ارتباطی با شدت پانکراتیت حاد ندارد و معیار پیش‌آگهی بد محسوب نمی‌شود.",
            "golden_en": "The absolute degree of serum amylase elevation has no correlation with pancreatitis severity or prognosis.",
            "points_fa": [
                "معیارهای BISAP شامل ۵ متغیر: BUN>25، هوشیاری مختل، SIRS، سن>60 و پلورال افیوژن است.",
                "افیوژن پلورال (به ویژه در سمت چپ) نشانه انتشار ترشحات آنزیمی از طریق دیافراگم است.",
                "سی‌تی‌اسکن با کنتراست ۴۸ تا ۷۲ ساعت پس از شروع بهترین روش ارزیابی نکروز پانکراس است.",
                "هیدراسیون تهاجمی سریع با رینگر لاکتات در ۱۲ تا ۲۴ ساعت اول مورتالیتی را به شدت کاهش می‌دهد."
            ],
            "points_en": [
                "The BISAP score encompasses BUN >25 mg/dL, impaired mental status, SIRS, age >60 years, and pleural effusion.",
                "Presence of an early pleural effusion (predominantly left-sided) reflects extensive diaphragmatic transudation.",
                "Contrast-enhanced abdominal CT obtained 48-72 hours post-admission is optimal to stage pancreatic parenchymal necrosis.",
                "Early aggressive intravenous hydration with lactated Ringer's solution during the first 12-24 hours improves survival."
            ]
        }
    },
    175: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: تنگی ناشی از ریفلاکس مزمن (پپتیک استریکچر) دیسفاژی پیشرونده به جامدات می‌دهد نه مایعات و مانومتری متفاوتی دارد.",
            "نادرست است؛ دلیل رد: در اسکلرودرمی فشار اسفنگتر تحتانی مری به شدت کاهش می‌یابد (LES بی‌کفایت و آتونیک) نه اینکه فشار بالا برود.",
            "صحیح است؛ تابلوی بالینی دیسفاژی پیشرونده همزمان به هر دو دسته مایعات و جامدات، پس زدن غذای هضم‌نشده، اتساع شدید مری با سطح مایع-هوا و باریک شدن انتهای مری شبیه منقار پرنده (Bird's Beak) در گرافی باریم، و مانومتری با مشخصات پاتوگنومونیک «فقدان حرکات پریستالتیسم تنه مری همراه با عدم شل شدن اسفنگتر تحتانی مری (LES Incomplete Relaxation)»، تعریف قطعی و استاندارد طلایی «بیماری آشالازی (Achalasia)» است.",
            "نادرست است؛ دلیل رد: اسپاسم منتشر مری با انقباضات ناهماهنگ با دامنه بالا (مری چوب‌پنبه‌بازکن) مشخص می‌شود و دیلاتاسیون وسیع نمی‌دهد."
        ],
        "exp": "دیسفاژی به جامدات و مایعات، تصویر منقار پرنده و عدم ریلاکس شدن LES در مانومتری، مشخصه پاتوگنومونیک آشالازی است.",
        "micro": {
            "lead_fa": "آشالازی یک اختلال حرکتی اولیه مری ناشی از دژنراسیون و تخریب اتوایمیون سلول‌های عصبی شبکه میانتریک (اورباخ) است که فاقد نیتریک اکسید و VIP هستند. مشخصات تشخیصی: ۱) دیسفاژی همزمان به مایعات و جامدات و رگورژیتاسیون غذای مانده؛ ۲) بلع باریم با منظره منقار پرنده (Bird's beak appearance) و اتساع تنه مری؛ ۳) مانومتری مری با رزولوشن بالا (HRM) به عنوان استاندارد طلایی با دو یافته قطعی: فقدان کامل پریستالتیسم و نقص در شل شدن اسفنگتر تحتانی مری (IRP بالا).",
            "lead_en": "Achalasia is a primary neurodegenerative esophageal motility disorder driven by loss of inhibitory nitric-oxide-producing ganglion cells within the myenteric (Auerbach's) plexus. Hallmark features encompass simultaneous dysphagia to liquids and solids, regurgitation, radiographic 'bird's beak' tapering, and high-resolution manometry demonstrating absent peristalsis with incomplete LES relaxation.",
            "golden_fa": "دیسفاژی به جامد و مایع + مری منقار پرنده‌ای + عدم شل شدن LES در مانومتری = بیماری آشالازی.",
            "golden_en": "Dysphagia to liquids and solids + bird's beak sign + incomplete LES relaxation on manometry = achalasia.",
            "points_fa": [
                "مانومتری با وضوح بالا (High-Resolution Manometry) استاندارد طلایی قطعی برای تشخیص و تعیین زیرنوع آشالازی است.",
                "انجام آندوسکوپی فوقانی در تمام بیماران برای رد سودوآشالازی ناشی از تومورهای بدخیم محل اتصال گاستروازوفاژیال الزامی است.",
                "گزینه‌های درمانی شامل دیلاتاسیون با بالن پنوماتیک، میوتومی جراحی به روش هلر یا میوتومی اندوسکوپیک (POEM) است.",
                "تزریق سم بوتولینوم (بوتاکس) در LES درمان موقت برای بیماران با ریسک جراحی بالا است."
            ],
            "points_en": [
                "High-resolution manometry (HRM) represents the definitive gold standard establishing Chicago classification subtypes.",
                "Upper endoscopy is mandatory in every patient to rule out pseudoachalasia secondary to distal adenocarcinoma.",
                "Definitive interventions prioritize mechanical disruption of the LES: graded pneumatic balloon dilation or surgical Heller myotomy/POEM.",
                "Endoscopic botulinum toxin injection into the LES provides temporary, palliative relief reserved for frail candidates."
            ]
        }
    },
    176: {
        "ci": 0,
        "whys": [
            "صحیح است (موردی که تظاهر خارج روده‌ای اتوایمیون محسوب نمی‌شود)؛ «سنگ کیسه صفرا (Cholelithiasis)» جزء تظاهرات خارج روده‌ای اتوایمیون بیماری التهابی روده نیست، بلکه یک «پیامد متابولیک ثانویه به سوء‌جذب نمک‌های صفراوی در درگیری یا برداشتن جراحی انتهای ایلئوم (ترمینال ایلئوم)» است؛ در حالی که اریتم ندوزوم، یووئیت و آرتریت‌های سرونگاتیو همگی تظاهرات خارج روده‌ای خودایمن سیستمیک کلاسیک IBD هستند.",
            "نادرست است؛ دلیل رد: اریتم ندوزوم شایع‌ترین تظاهر پوستی خارج روده‌ای در کرون است و با فعالیت روده همگام است.",
            "نادرست است؛ دلیل رد: یووئیت قدامی و اپی‌اسکلریت از تظاهرات چشمی خارج روده‌ای بسیار شایع در IBD هستند.",
            "نادرست است؛ دلیل رد: آرتریت محیطی سرونگاتیو شایع‌ترین تظاهر خارج روده‌ای بیماری‌های کرون و کولیت اولسروز است."
        ],
        "exp": "سنگ کیسه صفرا عارضه متابولیک ناشی از سوء‌جذب ایلئوم در کرون است و تظاهر خارج روده‌ای سیستمیک (اتوایمیون) نیست.",
        "micro": {
            "lead_fa": "تظاهرات بالینی بیماری کرون فراتر از لوله گوارش به دو دسته تقسیم می‌شوند: ۱) تظاهرات خارج روده‌ای ایمونولوژیک (EIMs) که با شدت بیماری روده همگام هستند یا سیر مستقل دارند شامل آرتریت محیطی، ساکروایلییت و اسپوندیلیت، اریتم ندوزوم، پیودرما گانگرنوزوم، یووئیت و کلانژیت اسکلروزان اولیه (PSC)؛ ۲) عوارض متابولیک ناشی از سوءجذب ایلئوم شامل سنگ کیسه صفرا (کاهش جذب اسیدهای صفراوی) و سنگ‌های کلیوی اگزالات کلسیم.",
            "lead_en": "Systemic manifestations of inflammatory bowel disease (IBD) strictly bifurcate into autoimmune extraintestinal manifestations (EIMs)—such as peripheral seronegative arthropathy, erythema nodosum, pyoderma gangrenosum, and anterior uveitis—and metabolic complications. Cholelithiasis is a metabolic consequence of terminal ileal dysfunction impairing bile acid reabsorption, not an immune-mediated EIM.",
            "golden_fa": "تظاهرات خارج روده‌ای اتوایمیون IBD: آرتریت، اریتم ندوزوم، یووئیت؛ سنگ کیسه صفرا عارضه متابولیک ایلئوم است.",
            "golden_en": "Autoimmune EIMs in IBD: arthritis, erythema nodosum, uveitis; gallstones represent an ileal metabolic complication.",
            "points_fa": [
                "التهاب یا رزکسیون ترمینال ایلئوم چرخه روده‌ای-کبدی اسیدهای صفراوی را مختل کرده و سنگ کلسترولی ایجاد می‌کند.",
                "افزایش جذب روده ای اگزالات آزاد در کرون موجب سنگ‌های اگزالات کلسیمی کلیه می‌شود.",
                "اریتم ندوزوم با ندول‌های قرمز دردناک روی ساق پا با فروکش کردن التهاب روده بهبود می‌یابد.",
                "آرتریت محیطی در IBD غیرتخریبی (Non-deforming) و سرونگاتیو است."
            ],
            "points_en": [
                "Terminal ileal resection/inflammation breaks the enterohepatic bile circulation, precipitating lithogenic gallstones.",
                "Unabsorbed enteric fatty acids bind calcium, leaving uncomplexed oxalate hyperabsorbed, generating calcium oxalate kidney stones.",
                "Erythema nodosum presents as tender pretibial violaceous nodules fluctuating directly with intestinal disease activity.",
                "Peripheral enteropathic arthritis is non-erosive, non-deforming, and seronegative for rheumatoid factor."
            ]
        }
    },
    177: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: اسپیرونولاکتون (آنتاگونیست آلدوسترون) سنگ‌بنای خط اول درمان دارویی آسیت در سیروز است.",
            "نادرست است؛ دلیل رد: فورسماید دیورتیک کمکی است که در کنار اسپیرونولاکتون برای تنظیم الکترولیت‌ها و تخلیه آب استفاده می‌شود.",
            "صحیح است (توصیه‌ای که صحیح نیست)؛ «محدودیت مصرف مایعات (Fluid Restriction)» در بیمار مبتلا به آسیت سیروتیک منحصراً زمانی اندیکاسیون دارد که «سطح سدیم سرم به زیر ۱۲۰ تا ۱۲۵ میلی‌اکی‌والان در لیتر برسد (هایپوناترمی هیپروولمیک شدید)»؛ در این بیمار سدیم سرم کاملاً طبیعی (Na=136 mEq/L) است؛ بنابراین اعمال محدودیت مایعات نه تنها هیچ اندیکاسیونی ندارد، بلکه موجب تشدید تشنگی، افت پرفیوژن کلیوی و نارسایی حاد پیش‌کلیوی می‌گردد.",
            "نادرست است؛ دلیل رد: محدودیت نمک رژیم غذایی (به میزان کمتر از ۲ گرم سدیم در روز معادل ۵ گرم نمک) اساس درمان آسیت است."
        ],
        "exp": "محدودیت مایعات در آسیت سیروتیک فقط در هایپوناترمی شدید (سدیم < ۱۲۰ تا ۱۲۵) کاربرد دارد و با سدیم نرمال ۱۳۶ اشتباه است.",
        "micro": {
            "lead_fa": "مدیریت آسیت در بیماران سیروز کبدی بر دو محور استوار است: ۱) محدودیت سدیم رژیم غذایی به کمتر از ۲ گرم (۸۸ میلی‌مول) در روز؛ ۲) دیورتیک‌تراپی ترکیبی با نسبت استاندارد اسپیرونولاکتون ۱۰۰ میلی‌گرم به همراه فورسماید ۴۰ میلی‌گرم روزانه جهت حفظ تعادل پتاسیم. یک اشتباه شایع بالینی محدودیت مصرف مایعات است: طبق دستورالعمل‌های معتبر گوارش (AASLD و EASL)، محدودیت مایعات (۱ تا ۱/۵ لیتر در روز) فقط و فقط در صورتی توصیه می‌شود که سدیم سرم کمتر از ۱۲۰ تا ۱۲۵ مه‌اکی‌والان باشد.",
            "lead_en": "Management of cirrhotic ascites pivots upon dietary sodium restriction (<2 g/day or 88 mmol/day) coupled with dual-diuretic therapy utilizing spironolactone (100 mg) and furosemide (40 mg) titrated to preserve normokalemia. Fluid restriction is strictly unnecessary and counterproductive in patients with normal serum sodium (136 mEq/L), indicated solely for severe hypervolemic hyponatremia (<120-125 mEq/L).",
            "golden_fa": "در آسیت سیروتیک: محدودیت نمک و مصرف دیورتیک الزامی است؛ محدودیت مایعات فقط در سدیم زیر ۱۲۰ تا ۱۲۵ اندیکاسیون دارد.",
            "golden_en": "In cirrhotic ascites: sodium restriction and diuretics are standard; fluid restriction is reserved for serum sodium <120-125.",
            "points_fa": [
                "گرادیان آلبومین سرم به آسیت (SAAG) در این بیمار مساوی 3.5 - 1.2 = 2.3 است که هایپرتانسیون پورت را اثبات می‌کند.",
                "نسبت طلایی دیورتیک‌ها ۱۰۰ میلی‌گرم اسپیرونولاکتون به ۴۰ میلی‌گرم فورسماید است.",
                "هدف کاهش وزن روزانه با دیورتیک حداکثر ۰/۵ کیلوگرم (یا ۱ کیلوگرم در صورت وجود ادم محیطی) است.",
                "بروز انسفالوپاتی کبدی یا کراتینین بالای ۲ اندیکاسیون قطع موقت دیورتیک‌ها است."
            ],
            "points_en": [
                "Serum-ascites albumin gradient (SAAG) is 3.5 - 1.2 = 2.3 g/dL (>1.1), verifying portal hypertension etiology.",
                "The classic 100:40 mg spironolactone-to-furosemide ratio balances kaliuresis, maintaining stable serum potassium.",
                "Targeted maximum weight loss is 0.5 kg/day in uncomplicated ascites (or 1.0 kg/day if peripheral edema coexists).",
                "Emergence of hepatic encephalopathy or acute serum creatinine doubling mandates prompt diuretic cessation."
            ]
        }
    },
    178: {
        "ci": 0,
        "whys": [
            "صحیح است؛ در بیماری با الگوی کلستاز شدید بیوشیمیایی (افزایش چشمگیر آلکالن فسفاتاز ALK-Ph=900 در مقایسه با افزایش خفیف ترانس‌آمینازها ALT=60) همراه با افزایش بیلی‌روبین، قدم اول، تشخیصی‌ترین و ضروری‌ترین اقدام برای ارزیابی کبد و مجاری صفراوی «سونوگرافی شکم و مجاری صفراوی (Abdominal Ultrasonography)» است تا در وهله اول اتساع مجاری صفراوی خارج‌کبدی ناشی از انسداد مکانیکی (سنگ، تومور) از کلستاز داخل‌کبدی (نظیر سیروز صفراوی اولیه PBC) تفکیک گردد.",
            "نادرست است؛ دلیل رد: انجام ERCP یک اقدام تهاجمی است و فقط در صورت اثبات اتساع مجاری یا سنگ در سونوگرافی مدنظر قرار می‌گیرد.",
            "نادرست است؛ دلیل رد: ویروس هپاتیت C عمدتاً الگوی هپاتوسلولار (افزایش شدید ALT) می‌دهد نه کلستاز غالب با آلکالن فسفاتاز ۹۰۰.",
            "نادرست است؛ دلیل رد: سی‌تی‌اسکن شکم برای مرحله اول نسبت به سونوگرافی ارجحیت ندارد."
        ],
        "exp": "در مواجهه با الگوی آزمایشگاهی کلستاز غالب (ALP بسیار بالا)، سونوگرافی کبد و مجاری صفراوی اولین اقدام الزامی است.",
        "micro": {
            "lead_fa": "در رویکرد بالینی به بیمار با تست‌های کبدی مختل با الگوی کلستاتیک غالب (افزایش شدید آلکالن فسفاتاز و گاما گلوتامیل ترانسفراز به همراه افزایش بیلی‌روبین)، اولین گام تفکیک کلستاز خارج‌کبدی (انسداد مجاری بزرگ توسط سنگ کلدوک یا تومور) از کلستاز داخل‌کبدی (نظیر کلانژیت صفراوی اولیه PBC یا داروها) است. سونوگرافی ترانس‌شکمی به عنوان ابزاری در دسترس، بدون اشعه و با حساسیت بالا برای کشف اتساع مجاری صفراوی، روش تشخیصی خط اول است.",
            "lead_en": "Diagnostic approach to a predominant cholestatic liver enzyme pattern (strikingly elevated alkaline phosphatase disproportionate to aminotransferases) primarily demands distinguishing extrahepatic biliary obstruction from intrahepatic cholestasis. Transabdominal ultrasonography is the mandatory initial imaging investigation, reliably detecting dilated intrahepatic/extrahepatic biliary ducts or choledocholithiasis.",
            "golden_fa": "آلکالن فسفاتاز بسیار بالا (کلستاز): اولین اقدام تشخیصی = سونوگرافی کبد و مجاری صفراوی جهت رد انسداد خارج‌کبدی.",
            "golden_en": "Markedly elevated alkaline phosphatase (cholestasis): initial step = abdominal ultrasound to rule out biliary dilation.",
            "points_fa": [
                "در صورت اتساع مجاری صفراوی در سونوگرافی، اقدام بعدی انجام MRCP یا ERCP است.",
                "در صورت عدم اتساع مجاری صفراوی، بررسی کلستاز داخل‌کبدی با سنجش آنتی‌بادی آنتی‌میتوکندریال (AMA برای PBC) انجام می‌گیرد.",
                "همراهی خستگی مزمن در یک خانم میانسال مبتلا به بیماری تیروئید با آلکالن فسفاتاز بالا شک به PBC را تقویت می‌کند.",
                "داروی اورسودوکسی‌کولیک اسید (UDCA) درمان خط اول در بیماری PBC است."
            ],
            "points_en": [
                "Demonstration of dilated biliary ducts prompts targeted therapeutic MRCP or endoscopic retrograde cholangiopancreatography (ERCP).",
                "Absence of biliary dilation focuses on intrahepatic cholestasis, prompting antimitochondrial antibody (AMA) testing for PBC.",
                "Middle-aged woman with autoimmune thyroiditis and profound isolated alkaline phosphatase elevation strongly suggests PBC.",
                "Ursodeoxycholic acid (UDCA) represents the disease-modifying medical therapy of choice for primary biliary cholangitis."
            ]
        }
    },
    179: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: پنومونی اکتسابی از جامعه (CAP) به دلیل کاهش اسیدیته معده و کلونیزاسیون باکتری‌ها از عوارض شناخته‌شده PPI است.",
            "نادرست است؛ دلیل رد: شکستگی لگن و ستون فقرات در اثر کاهش جذب کلسیم ناشی از کمبود اسید معده از عوارض مصرف طولانی PPI است.",
            "صحیح است (موردی که جزء عوارض نیست)؛ مصرف مزمن داروهای مهارکننده پمپ پروتون (PPIs نظیر امپرازول و پانتوپرازول) به دلیل مهار انتقال فعال منیزیم در روده، موجب «کاهش منیزیم سرم (هیپومنیزیمی / Hypomagnesemia)» می‌گردد نه افزایش آن؛ بنابراین گزاره «افزایش منیزیم سرم» نادرست و برعکس عارضه واقعی بیماری است.",
            "نادرست است؛ دلیل رد: کولیت با باکتری کلستریدیوم دیفیسیل (CDI) به علت تغییر فلور میکروبی روده عارضه بارز مصرف مزمن PPI است."
        ],
        "exp": "مصرف طولانی‌مدت PPIs موجب هیپومنیزیمی (کاهش منیزیم سرم) می‌شود نه افزایش آن؛ همچنین با شکستگی و عفونت همراه است.",
        "micro": {
            "lead_fa": "مهارکننده‌های پمپ پروتون (PPIs) پرمصرف‌ترین داروهای مهارکننده اسید معده هستند اما مصرف مزمن و طولانی‌مدت آن‌ها با عوارض جانبی متعددی پیوند خورده است: ۱) اختلالات الکترولیتی و مواد معدنی: هیپومنیزیمی (کاهش منیزیم سرم به علت اختلال جذب روده‌ای TRPM6/7)، هیپوکلسمی و فقر آهن و ویتامین B12؛ ۲) افزایش خطر پوکی استخوان و شکستگی‌های هیپ در سالمندان؛ ۳) عفونت‌های گوارشی نظیر کولیت کلستریدیوم دیفیسیل؛ ۴) پنومونی اکتسابی از جامعه و نفریت بینابینی حاد.",
            "lead_en": "Chronic long-term proton pump inhibitor (PPI) exposure suppresses gastric acidity, provoking distinct adverse clinical sequelae: 1) micronutrient malabsorption manifesting as hypomagnesemia (via impaired intestinal TRPM6/7 active transport), calcium malabsorption, and vitamin B12 deficiency; 2) osteoporosis and osteoporotic hip fractures; and 3) enteric/respiratory infections including Clostridioides difficile colitis.",
            "golden_fa": "عوارض مصرف طولانی PPI: هیپومنیزیمی (کاهش منیزیم)، شکستگی استخوان، عفونت کلستریدیوم دیفیسیل و پنومونی.",
            "golden_en": "Complications of chronic PPI use: hypomagnesemia (low magnesium), hip fractures, C. difficile colitis, and pneumonia.",
            "points_fa": [
                "هیپومنیزیمی ناشی از PPI می‌تواند با تتانی، تشنج و آریتمی قلبی تظاهر یابد و با قطع دارو برطرف می‌شود.",
                "کاهش اسید معده جذب کلسیم کربنات را مختل کرده و تخریب بافت استخوانی را تسریع می‌بخشد.",
                "در بیماران تحت درمان طولانی‌مدت PPI، پایش سالانه سطح منیزیم سرم توصیه می‌گردد.",
                "نفریت بینابینی حاد آلرژیک (AIN) از عوارض کلیوی مهم مهارکننده‌های پمپ پروتون است."
            ],
            "points_en": [
                "Severe PPI-induced hypomagnesemia provokes secondary hypokalemia, neuromuscular excitability, and cardiac arrhythmias.",
                "Hypochlorhydria impairs ionization and bio-accessibility of insoluble dietary calcium carbonate.",
                "Periodic serum magnesium surveillance is advised for individuals undergoing sustained long-term PPI therapy.",
                "Drug-induced acute interstitial nephritis (AIN) represents a major immune-mediated renal hazard of PPIs."
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
    for idx, enrich in ENRICHMENTS_BATCH6.items():
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
