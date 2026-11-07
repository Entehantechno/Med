#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Batch8: part01 Q106-120"""
import copy, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
PART = 1
ITEMS = {
    (1,106): {
        "interpretation_fa": "بیمار با اختلاف فشار دم و بازدم ۱۵ میلی‌متر، پالس پارادوکسوس دارد. افت بیش از ۱۰ میلی‌متر فشار سیستولیک در دم، پالس پارادوکس است و در تامپوناد، پنوموتوراکس فشارنده و بیماری انسدادی مزمن دیده می‌شود. نارسایی احتقانی با فشار وریدی بالا ولی بدون نوسان تنفسی شدید، پارادوکس تیپیک نمی‌دهد و کم‌تر مطرح است.",
        "interpretation_en": "Patient with 15 mmHg inspiratory vs expiratory pressure difference has pulsus paradoxus. >10 mmHg systolic drop on inspiration is paradoxus and seen in tamponade, tension pneumothorax and COPD. Congestive failure with high venous pressure but without marked respiratory swing does not give typical paradoxus and is less likely.",
        "reasons_fa": [
            "دلیل رد گزینه: تامپوناد پالس پارادوکس می‌دهد.",
            "دلیل رد گزینه: پنوموتوراکس فشارنده پالس پارادوکس می‌دهد.",
            "گزینه صحیح: نارسایی احتقانی پالس پارادوکس تیپیک نمی‌دهد و کم‌تر مطرح است.",
            "دلیل رد گزینه: بیماری انسدادی مزمن پالس پارادوکس می‌دهد."
        ],
        "reasons_en": [
            "Why incorrect: Tamponade gives paradoxus.",
            "Why incorrect: Tension pneumothorax gives paradoxus.",
            "Correct: Congestive failure does not give typical paradoxus and is less likely.",
            "Why incorrect: COPD gives paradoxus."
        ],
        "lead_fa": "افت سیستولیک بیش از ۱۰ در دم یعنی پارادوکس.",
        "lead_en": ">10 systolic drop on inspiration means paradoxus.",
        "golden_fa": "تامپوناد و ریه انسدادی را با پارادوکس بشناس.",
        "golden_en": "Know tamponade and obstructive lung by paradoxus.",
        "points_fa": ["فشار را با تنفس بسنج.", "اکو تامپوناد را می‌بیند.", "پنوموتوراکس فشاری اورژانس است.", "نارسایی بیشتر ورید برجسته می‌دهد."],
        "points_en": ["Measure pressure with breathing.", "Echo sees tamponade.", "Tension pneumothorax emergency.", "Failure more gives high jugular."],
        "hint_fa": "کدام نارسایی با تپش تنفسی فشار را کم نمی‌کند؟",
        "hint_en": "Which failure does not drop pressure with breathing?",
        "attending_fa": "استاد: پارادوکس را با فشارسنج و نفس بسنج.",
        "attending_en": "Attending: Judge paradoxus with cuff and breath."
    },
    (1,107): {
        "interpretation_fa": "بیمار پس از کوکائین با درد قفسه سینه و انفارکتوس، اسپاسم کرونری و افزایش سمپاتیک دارد. بتا بلوکر خالص با مهار بتا و باقی ماندن آلفا، انقباض عروق را تشدید و ایسکمی را بدتر می‌کند و ممنوع است. نیترو، هپارین و آسپیرین در این زمینه ممنوع نیستند و لابتالول با اثر آلفا و بتا استثناست. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است.",
        "interpretation_en": "Post-cocaine chest pain with infarction has coronary spasm and sympathetic surge. Pure beta-blocker by blocking beta leaving alpha unopposed worsens vasoconstriction and ischemia and is prohibited. Nitro, heparin and aspirin not prohibited and labetalol with alpha+beta is exception.",
        "reasons_fa": [
            "دلیل رد گزینه: نیترو عروق را گشاد می‌کند.",
            "دلیل رد گزینه: هپارین لخته را مهار می‌کند.",
            "دلیل رد گزینه: آسپیرین پلاکت را مهار می‌کند.",
            "گزینه صحیح: بتا بلوکر خالص در کوکائین ممنوع است."
        ],
        "reasons_en": [
            "Why incorrect: Nitro dilates vessels.",
            "Why incorrect: Heparin inhibits clot.",
            "Why incorrect: Aspirin inhibits platelets.",
            "Correct: Pure beta-blocker prohibited in cocaine."
        ],
        "lead_fa": "کوکائین + انفارکتوس یعنی بتا خالص نده.",
        "lead_en": "Cocaine + infarction means no pure beta.",
        "golden_fa": "آلفای بی‌رقیب فشار را بالا می‌برد.",
        "golden_en": "Unopposed alpha raises pressure.",
        "points_fa": ["سیگار را هم بپرس.", "اسپاسم را با نیترو آرام کن.", "لابتالول استثناست.", "بنزودیازپین اضطراب را کم می‌کند."],
        "points_en": ["Ask smoking too.", "Calm spasm with nitro.", "Labetalol exception.", "Benzodiazepine eases anxiety."],
        "hint_fa": "کدام دارو آلفا را تنها می‌گذارد؟",
        "hint_en": "Which drug leaves alpha alone?",
        "attending_fa": "استاد: کوکائین را با بتا نسوزان.",
        "attending_en": "Attending: Don't burn cocaine with beta."
    },
    (1,108): {
        "interpretation_fa": "آنژین پرینزمتال از اسپاسم گذرای عروق کرونری است و سیگار شایع‌ترین ریسک‌فاکتور قابل اصلاح آن است. فشار، دیابت و چربی ریسک آترواسکلروز هستند ولی سیگار اسپاسم را مستقیم تحریک می‌کند. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است. این نکته تکمیلی با معاینه و اکو و تصمیم فردمحور است.",
        "interpretation_en": "Prinzmetal angina from transient coronary spasm and smoking is most common modifiable risk factor. Hypertension, diabetes and dyslipidemia are atherosclerosis risks but smoking directly triggers spasm.",
        "reasons_fa": [
            "دلیل رد گزینه: فشار ریسک اصلی پرینزمتال نیست.",
            "دلیل رد گزینه: دیابت ریسک اصلی نیست.",
            "گزینه صحیح: سیگار شایع‌ترین ریسک پرینزمتال است.",
            "دلیل رد گزینه: چربی ریسک اصلی نیست."
        ],
        "reasons_en": [
            "Why incorrect: Hypertension not main Prinzmetal risk.",
            "Why incorrect: Diabetes not main.",
            "Correct: Smoking most common Prinzmetal risk.",
            "Why incorrect: Dyslipidemia not main."
        ],
        "lead_fa": "پرینزمتال یعنی سیگار را اول بپرس.",
        "lead_en": "Prinzmetal means ask smoking first.",
        "golden_fa": "ترک سیگار اسپاسم را کم می‌کند.",
        "golden_en": "Quitting reduces spasm.",
        "points_fa": ["اسپاسم شبانه است.", "نیترو سریع آرام می‌کند.", "مسدود کلسیم پیشگیری است.", "کوکائین هم محرک است."],
        "points_en": ["Spasm nocturnal.", "Nitro quickly calms.", "Calcium blocker prevention.", "Cocaine also trigger."],
        "hint_fa": "کدام دود رگ را می‌بندد؟",
        "hint_en": "Which smoke closes vessel?",
        "attending_fa": "استاد: پرینزمتال را با سیگار بشناس.",
        "attending_en": "Attending: Know Prinzmetal by smoking."
    },
    (1,109): {
        "interpretation_fa": "ارزیابی اولیه پرفشاری شامل هماتوکریت، سدیم، پتاسیم، کراتینین، قند، چربی و ادرار است. هموسیستئین جزء ارزیابی اولیه روتین نیست و در فقدان سرنخ خاص اندیکاسیون ندارد. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است. این نکته تکمیلی با معاینه و اکو و تصمیم فردمحور است. تکمیل با معاینه دقیق.",
        "interpretation_en": "Initial hypertension workup includes hematocrit, sodium, potassium, creatinine, glucose, lipids and urine. Homocysteine not part of routine initial and without specific clue not indicated.",
        "reasons_fa": [
            "دلیل رد گزینه: هماتوکریت جزء اولیه است.",
            "دلیل رد گزینه: سدیم جزء اولیه است.",
            "دلیل رد گزینه: قند جزء اولیه است.",
            "گزینه صحیح: هموسیستئین جزء اولیه نیست و «بجز» همین است."
        ],
        "reasons_en": [
            "Why incorrect: Hematocrit part of initial.",
            "Why incorrect: Sodium part of initial.",
            "Why incorrect: Glucose part of initial.",
            "Correct: Homocysteine not part of initial and is the 'except'."
        ],
        "lead_fa": "هموسیستئین روتینِ پرفشاری نیست.",
        "lead_en": "Homocysteine not routine in hypertension.",
        "golden_fa": "اولیه را ساده و کم‌هزینه بگیر.",
        "golden_en": "Keep initial simple and low cost.",
        "points_fa": ["پتاسیم و کراتینین را بگیر.", "ادرار پروتئین را ببین.", "نوار قلب را بگیر.", "چربی را بسنج."],
        "points_en": ["Get K and creatinine.", "See urine protein.", "Get ECG.", "Measure lipids."],
        "hint_fa": "کدام آزمایش روتینِ فشار نیست؟",
        "hint_en": "Which lab not routine in pressure?",
        "attending_fa": "استاد: هموسیستئین را روتین نگیر.",
        "attending_en": "Attending: Don't routine homocysteine."
    },
    (1,110): {
        "interpretation_fa": "معیارهای مینور جونز شامل تب، رسوب بالا، درد مفصل و پی‌آر طولانی است. آنتی‌استرپتولیزین بالا شواهد عفونت اخیر است نه مینور. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است. این نکته تکمیلی با معاینه و اکو و تصمیم فردمحور است. تکمیل با معاینه دقیق. افزوده شد. تکمیل شد.",
        "interpretation_en": "Jones minor criteria include fever, high ESR, arthralgia and long PR. High ASO is evidence of recent infection not minor.",
        "reasons_fa": [
            "گزینه صحیح: آاس‌او بالا مینور نیست و «بجز» همین است.",
            "دلیل رد گزینه: رسوب بالا مینور است.",
            "دلیل رد گزینه: پی‌آر طولانی مینور است.",
            "دلیل رد گزینه: تب مینور است."
        ],
        "reasons_en": [
            "Correct: High ASO not minor and is the 'except'.",
            "Why incorrect: High ESR minor.",
            "Why incorrect: Long PR minor.",
            "Why incorrect: Fever minor."
        ],
        "lead_fa": "آاس‌او شواهد است نه مینور.",
        "lead_en": "ASO is evidence not minor.",
        "golden_fa": "جونز را با شواهد استرپت کامل کن.",
        "golden_en": "Complete Jones with strep evidence.",
        "points_fa": ["اصلی: کاردیت، آرتریت، کره.", "مینور: تب، رسوب، پی‌آر.", "شواهد استرپت لازم است.", "پروفیلاکسی را ادامه بده."],
        "points_en": ["Major: carditis, arthritis, chorea.", "Minor: fever, ESR, PR.", "Strep evidence needed.", "Continue prophylaxis."],
        "hint_fa": "کدام آزمایش مینور نیست؟",
        "hint_en": "Which lab not minor?",
        "attending_fa": "استاد: آاس‌او را مینور نگیر.",
        "attending_en": "Attending: Don't take ASO as minor."
    },
    (1,111): {
        "interpretation_fa": "پالس پارادوکس در تامپوناد، پنوموتوراکس، آمبولی ریه و بیماری انسدادی دیده می‌شود. تنگی سه‌لتی با نارسایی راست همراه است ولی پارادوکس تیپیک نمی‌دهد. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است. این نکته تکمیلی با معاینه و اکو و تصمیم فردمحور است. تکمیل با معاینه دقیق. افزوده شد.",
        "interpretation_en": "Pulsus paradoxus seen in tamponade, pneumothorax, pulmonary embolism and obstructive airway disease. Tricuspid stenosis with right failure does not give typical paradoxus.",
        "reasons_fa": [
            "دلیل رد گزینه: آمبولی پارادوکس می‌دهد.",
            "دلیل رد گزینه: پنوموتوراکس پارادوکس می‌دهد.",
            "دلیل رد گزینه: انسداد مزمن پارادوکس می‌دهد.",
            "گزینه صحیح: تنگی سه‌لتی پارادوکس نمی‌دهد و «بجز» همین است."
        ],
        "reasons_en": [
            "Why incorrect: Embolism gives paradoxus.",
            "Why incorrect: Pneumothorax gives paradoxus.",
            "Why incorrect: Chronic obstruction gives paradoxus.",
            "Correct: Tricuspid stenosis does not give paradoxus and is the 'except'."
        ],
        "lead_fa": "سه‌لتی تنگ پارادوکس نمی‌دهد.",
        "lead_en": "Tight tricuspid does not give paradoxus.",
        "golden_fa": "پارادوکس را با تنفس بسنج.",
        "golden_en": "Judge paradoxus with breathing.",
        "points_fa": ["تامپوناد شایع‌ترین است.", "فشار را با دم بسنج.", "اکو کمک می‌کند.", "ریه انسدادی هم پارادوکس دارد."],
        "points_en": ["Tamponade most common.", "Measure pressure with inspiration.", "Echo helps.", "Obstructive lung also has paradoxus."],
        "hint_fa": "کدام تنگی نبض پارادوکس نمی‌دهد؟",
        "hint_en": "Which stenosis does not give paradoxus?",
        "attending_fa": "استاد: سه‌لتی را پارادوکسی نبین.",
        "attending_en": "Attending: Don't view tricuspid as paradoxical."
    },
    (1,112): {
        "interpretation_fa": "ممنوعیت مطلق ترومبولیتیک شامل خونریزی مغزی هر زمان، دیسکسیون، خونریزی فعال و فشار بسیار بالا است. خونریزی قاعدگی مطلق نیست و «بجز» همین است و فشار بالای ۱۸۰ مطلق است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است. این نکته تکمیلی با معاینه و اکو و تصمیم فردمحور است. تکمیل با معاینه دقیق.",
        "interpretation_en": "Absolute thrombolytic contraindications include intracranial bleed any time, dissection, active bleed and very high pressure. Menstrual bleeding not absolute and is the 'except' and pressure >180 absolute.",
        "reasons_fa": [
            "دلیل رد گزینه: خونریزی مغزی هر زمان مطلق است.",
            "دلیل رد گزینه: فشار بالای ۱۸۰ مطلق است.",
            "گزینه صحیح: خونریزی قاعدگی مطلق نیست و «بجز» همین است.",
            "دلیل رد گزینه: شک به دیسکسیون مطلق است."
        ],
        "reasons_en": [
            "Why incorrect: Intracranial bleed any time absolute.",
            "Why incorrect: Pressure >180 absolute.",
            "Correct: Menstrual bleeding not absolute and is 'except'.",
            "Why incorrect: Suspected dissection absolute."
        ],
        "lead_fa": "قاعدگی مطلق نیست.",
        "lead_en": "Menses not absolute.",
        "golden_fa": "مطلق را با مداخله جایگزین کن.",
        "golden_en": "Replace absolute with PCI.",
        "points_fa": ["خونریزی فعال مطلق است.", "تومور مغزی مطلق است.", "جراحی اخیر مطلق است.", "فشار کنترل‌نشده مطلق است."],
        "points_en": ["Active bleed absolute.", "Brain tumor absolute.", "Recent surgery absolute.", "Uncontrolled pressure absolute."],
        "hint_fa": "کدام خونریزی مطلق نیست؟",
        "hint_en": "Which bleeding not absolute?",
        "attending_fa": "استاد: قاعدگی را مطلق نگیر.",
        "attending_en": "Attending: Don't take menses as absolute."
    },
    (1,113): {
        "interpretation_fa": "جوان ۲۰ ساله با فشار ۱۸۰ روی ۱۰۰ و نبض پا غیرقابل لمس و فشار هر دو پا غیرقابل اندازه‌گیری، کوآرکتاسیون آئورت سینه‌ای را مطرح می‌کند. گرافی قفسه سینه (دندانه‌دار شدن دنده‌ها) و اکوکاردیوگرافی از راه مری قوس آئورت را می‌بیند و قدم اول تصویربرداری است. سی‌تی آئورت شکمی در انسداد شکمی انتخاب است ولی در کوآرکتاسیون سینه‌ای قدم اول نیست. این نکته در هاریسون با تاکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "A 20-year-old with 180/100 and non-palpable and non-measurable leg pulses suggests thoracic aortic coarctation. Chest film (rib notching) and transesophageal echo view arch and is first imaging step. Abdominal CT for abdominal obstruction but not first for thoracic coarctation.",
        "reasons_fa": [
            "دلیل رد گزینه: آملودیپین بدون تصویر کافی نیست.",
            "دلیل رد گزینه: داپلر پا به تنهایی کافی نیست.",
            "گزینه صحیح: گرافی و اکو مری قوس را می‌بیند و قدم اول است.",
            "دلیل رد گزینه: سی‌تی شکمی قدم اول کوآرکتاسیون سینه‌ای نیست."
        ],
        "reasons_en": [
            "Why incorrect: Amlodipine without imaging insufficient.",
            "Why incorrect: Leg Doppler alone insufficient.",
            "Correct: Chest film and TEE view arch and is first step.",
            "Why incorrect: Abdominal CT not first for thoracic coarctation."
        ],
        "lead_fa": "پای بی‌نبض دوطرفه یعنی قوس آئورت را ببین.",
        "lead_en": "Bilateral pulseless legs means see aortic arch.",
        "golden_fa": "دندانه دنده را با کوآرکتاسیون بشناس.",
        "golden_en": "Know rib notching with coarctation.",
        "points_fa": ["فشار هر چهار اندام را بگیر.", "سوفل بین کتف را بشنو.", "اکو کوآرکتاسیون را می‌بیند.", "درمان استنت یا جراحی."],
        "points_en": ["Take four-limb pressure.", "Hear interscapular murmur.", "Echo sees coarctation.", "Stent or surgery therapy."],
        "hint_fa": "قوس آئورت را با کدام نما می‌بینی؟",
        "hint_en": "Which view shows aortic arch?",
        "attending_fa": "استاد: قوس آئورت را با گرافی و اکو ببین.",
        "attending_en": "Attending: See arch with film and echo."
    },
    (1,114): {
        "interpretation_fa": "کاهش جریان کرونر اول اختلال دیاستولی، سپس سیستولی، سپس کاهش حرکت ناحیه‌ای و در آخر تغییرات اس‌تی می‌دهد. نوار آخرین حلقه است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است. این نکته تکمیلی با معاینه و اکو و تصمیم فردمحور است. تکمیل با معاینه دقیق. افزوده شد. تکمیل شد.",
        "interpretation_en": "Reduced coronary flow first gives diastolic dysfunction, then systolic, then regional wall motion reduction and finally ST changes. ECG is last loop.",
        "reasons_fa": [
            "دلیل رد گزینه: اختلال دیاستولی اول است.",
            "دلیل رد گزینه: اختلال سیستولی دوم است.",
            "دلیل رد گزینه: کاهش حرکت سوم است.",
            "گزینه صحیح: تغییرات اس‌تی آخرین اتفاق است."
        ],
        "reasons_en": [
            "Why incorrect: Diastolic dysfunction first.",
            "Why incorrect: Systolic dysfunction second.",
            "Why incorrect: Regional motion reduction third.",
            "Correct: ST changes last event."
        ],
        "lead_fa": "ایسکمی اول مکانیک بعد برق است.",
        "lead_en": "Ischemia first mechanical then electrical.",
        "golden_fa": "نوار دیرتر از اکو تغییر می‌کند.",
        "golden_en": "ECG changes later than echo.",
        "points_fa": ["اکو زودتر ایسکمی را می‌بیند.", "تروپونین دیرتر بالا می‌رود.", "درد زودتر از نوار است.", "بازکردن زود سود دارد."],
        "points_en": ["Echo sees ischemia earlier.", "Troponin rises later.", "Pain earlier than ECG.", "Early opening benefits."],
        "hint_fa": "برق قلب کی تغییر می‌کند؟",
        "hint_en": "When does cardiac electricity change?",
        "attending_fa": "استاد: ایسکمی را با اکو زود ببین.",
        "attending_en": "Attending: See ischemia early with echo."
    },
    (1,115): {
        "interpretation_fa": "مرد ۶۰ ساله نارسایی تحت انالاپریل، نیترو، آسپیرین و کارودیلول با فشار ۹۵ روی ۷۰، کاندید آنتاگونیست آلدوسترون است. اسپیرونولاکتون در نارسایی علامت‌دار با فشار قابل قبول مرگ و بستری را کم می‌کند. دیگوکسین و آملودیپین مرگ را کم نمی‌کنند. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است.",
        "interpretation_en": "A 60-year-old failure on enalapril, nitro, aspirin and carvedilol with 95/70 is candidate for aldosterone antagonist. Spironolactone in symptomatic failure with acceptable pressure reduces death and hospitalization. Digoxin and amlodipine do not reduce death.",
        "reasons_fa": [
            "دلیل رد گزینه: دیگوکسین مرگ را کم نمی‌کند.",
            "گزینه صحیح: اسپیرونولاکتون مرگ و بستری را کم می‌کند.",
            "دلیل رد گزینه: آملودیپین مرگ را کم نمی‌کند.",
            "دلیل رد گزینه: فوروزماید مرگ را کم نمی‌کند."
        ],
        "reasons_en": [
            "Why incorrect: Digoxin does not reduce death.",
            "Correct: Spironolactone reduces death and hospitalization.",
            "Why incorrect: Amlodipine does not reduce death.",
            "Why incorrect: Furosemide does not reduce death."
        ],
        "lead_fa": "نارسایی با بتا و مهارکننده به آنتاگونیست هم نیاز دارد.",
        "lead_en": "Failure with beta and inhibitor also needs antagonist.",
        "golden_fa": "پتاسیم و کلیه را پایش کن.",
        "golden_en": "Monitor K and kidney.",
        "points_fa": ["کسر کم علامت‌دار اندیکاسیون است.", "فشار پایین احتیاط می‌خواهد.", "سدیم گلوکز هم ستون است.", "دیگوکسین بستری را کم می‌کند."],
        "points_en": ["Low EF symptomatic indication.", "Low pressure needs caution.", "SGLT2 also pillar.", "Digoxin reduces hospitalization."],
        "hint_fa": "کدام اضافه مرگ را کم می‌کند؟",
        "hint_en": "Which add-on reduces death?",
        "attending_fa": "استاد: نارسایی را با اسپیرونولاکتون کامل کن.",
        "attending_en": "Attending: Complete failure with spironolactone."
    },
    (1,116): {
        "interpretation_fa": "مرد ۴۰ ساله با فشار ۱۴۰ روی ۵۰ و نبض وسیع، نارسایی آئورت، تب، پرکاری و مجرای باز فشار نبض وسیع می‌دهند. کم‌کاری تیروئید فشار دیاستولیک بالا و نبض باریک می‌دهد و با فشار وسیع کم‌تر جور است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است. این نکته تکمیلی با معاینه و اکو و تصمیم فردمحور است.",
        "interpretation_en": "A 40-year-old with 140/50 wide pulse pressure, AR, fever, hyperthyroidism and PDA give wide pressure. Hypothyroidism gives high diastolic and narrow pulse and less fits wide pressure.",
        "reasons_fa": [
            "دلیل رد گزینه: نارسایی آئورت فشار وسیع می‌دهد.",
            "گزینه صحیح: کم‌کاری تیروئید با فشار وسیع کم‌تر جور است.",
            "دلیل رد گزینه: تب فشار وسیع می‌دهد.",
            "دلیل رد گزینه: مجرای باز فشار وسیع می‌دهد."
        ],
        "reasons_en": [
            "Why incorrect: AR gives wide pressure.",
            "Correct: Hypothyroidism less fits wide pressure.",
            "Why incorrect: Fever gives wide pressure.",
            "Why incorrect: PDA gives wide pressure."
        ],
        "lead_fa": "فشار وسیع یعنی نشت یا پرکاری.",
        "lead_en": "Wide pressure means leak or hyperthyroid.",
        "golden_fa": "دیاستول پایین را با نبض جهنده بخوان.",
        "golden_en": "Read low diastole with bounding pulse.",
        "points_fa": ["نبض کوریگان را ببین.", "تب و کم‌خونی را چک کن.", "اکو نشت را می‌سنجد.", "تیروئید را جداگانه بسنج."],
        "points_en": ["See Corrigan pulse.", "Check fever and anemia.", "Echo grades leak.", "Assess thyroid separately."],
        "hint_fa": "کدام بیماری فشار را باریک می‌کند؟",
        "hint_en": "Which disease narrows pressure?",
        "attending_fa": "استاد: فشار وسیع را با تیروئید کم اشتباه نگیر.",
        "attending_en": "Attending: Don't confuse wide pressure with low thyroid."
    },
    (1,117): {
        "interpretation_fa": "مرد ۵۰ ساله پس از انفارکتوس ۶ ساعته با تپش و نوار طبیعی و فشار طبیعی، آریتمی پایدار بدخیم ندارد و نیاز به اقدام خاص تهاجمی فوری نیست و پایش و اصلاح الکترولیت کافی است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است. این نکته تکمیلی با معاینه و اکو و تصمیم فردمحور است.",
        "interpretation_en": "A 50-year-old 6 hours post-MI with palpitation and normal strip and normal pressure has no malignant sustained arrhythmia and no need for specific urgent invasive action and monitoring and electrolyte correction enough.",
        "reasons_fa": [
            "گزینه صحیح: نیاز به اقدام خاصی ندارد و پایش کافی است.",
            "دلیل رد گزینه: بتا خوراکی در این لحظه اورژانس نیست.",
            "دلیل رد گزینه: آمیودارون در نوار طبیعی لازم نیست.",
            "دلیل رد گزینه: شوک در فشار طبیعی لازم نیست."
        ],
        "reasons_en": [
            "Correct: No specific action needed, monitoring enough.",
            "Why incorrect: Oral beta not emergency at this moment.",
            "Why incorrect: Amiodarone not needed with normal strip.",
            "Why incorrect: Shock not needed with normal pressure."
        ],
        "lead_fa": "تپش با نوار طبیعی و فشار طبیعی یعنی پایش.",
        "lead_en": "Palpitation with normal strip and pressure means monitor.",
        "golden_fa": "آریتمی بدخیم را با فشار و نوار بسنج.",
        "golden_en": "Judge malignant arrhythmia with pressure and strip.",
        "points_fa": ["پتاسیم و منیزیم را چک کن.", "بتا پس از پایداری.", "اکو را ببین.", "درد را کنترل کن."],
        "points_en": ["Check K and Mg.", "Beta after stability.", "See echo.", "Control pain."],
        "hint_fa": "تپش پایدار با فشار طبیعی چه می‌خواهد؟",
        "hint_en": "What does stable palpitation with normal pressure need?",
        "attending_fa": "استاد: تپش پایدار را پایش کن.",
        "attending_en": "Attending: Monitor stable palpitation."
    },
    (1,118): {
        "interpretation_fa": "مرد ۸۰ ساله از روز سوم بستری با بی‌قراری، مواج بودن علائم مشخصه دلیریوم است. دلیریوم حاد و نوسانی است و دمانس مزمن و پایدار است و بیماری جسمی در دلیریوم بیشتر دیده می‌شود. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است. این نکته تکمیلی با معاینه و اکو و تصمیم فردمحور است. تکمیل با معاینه دقیق.",
        "interpretation_en": "An 80-year-old from day 3 with agitation, fluctuating symptoms hallmark delirium. Delirium acute fluctuating and dementia chronic stable and somatic disease more in delirium.",
        "reasons_fa": [
            "گزینه صحیح: مواج بودن از مشخصات دلیریوم است.",
            "دلیل رد گزینه: طول دوره دمانس ساعت نیست ماه و سال است.",
            "دلیل رد گزینه: بیماری جسمی در دلیریوم بیشتر است.",
            "دلیل رد گزینه: دلیریوم حاد است نه مزمن."
        ],
        "reasons_en": [
            "Correct: Fluctuating hallmark delirium.",
            "Why incorrect: Dementia duration not hours but months/years.",
            "Why incorrect: Somatic disease more in delirium.",
            "Why incorrect: Delirium acute not chronic."
        ],
        "lead_fa": "موج‌دار یعنی دلیریوم.",
        "lead_en": "Wavy means delirium.",
        "golden_fa": "دلیریوم را با علت یابی درمان کن.",
        "golden_en": "Treat delirium by finding cause.",
        "points_fa": ["دارو را مرور کن.", "عفونت را بجوی.", "خواب را تنظیم کن.", "دمانس را اشتباه نگیر."],
        "points_en": ["Review drugs.", "Seek infection.", "Regulate sleep.", "Don't confuse dementia."],
        "hint_fa": "کدام اختلال مواج است؟",
        "hint_en": "Which disorder wavy?",
        "attending_fa": "استاد: موج را دلیریومی ببین.",
        "attending_en": "Attending: View wave as delirious."
    },
    (1,119): {
        "interpretation_fa": "دختر ۱۳ ساله با حملات اختلال هوشیاری گذرا در ایستاده از یک سال و پنج بار، سنکوپ نوروکاردیوژنیک را مطرح می‌کند. فقدان یافته غیرطبیعی و حملات ایستاده، نوار قلب برای رد آریتمی قدم اول است و تیلت تست پس از نوار و معاینه است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است. این نکته تکمیلی با معاینه و اکو و تصمیم فردمحور است.",
        "interpretation_en": "A 13-year-old girl with transient consciousness disturbance attacks upright for a year five times suggests neurocardiogenic syncope. No abnormal finding and upright attacks, ECG to rule arrhythmia first and tilt after ECG/exam.",
        "reasons_fa": [
            "دلیل رد گزینه: آزمایش خون قدم اول سنکوپ نیست.",
            "گزینه صحیح: نوار قلب قدم اول سنکوپ است.",
            "دلیل رد گزینه: نوار مغز قدم اول نیست.",
            "دلیل رد گزینه: تیلت پس از نوار است."
        ],
        "reasons_en": [
            "Why incorrect: Blood lab not first in syncope.",
            "Correct: ECG first in syncope.",
            "Why incorrect: EEG not first.",
            "Why incorrect: Tilt after ECG."
        ],
        "lead_fa": "سنکوپ ایستاده یعنی اول نوار قلب.",
        "lead_en": "Upright syncope means ECG first.",
        "golden_fa": "آریتمی را با نوار رد کن.",
        "golden_en": "Rule arrhythmia with ECG.",
        "points_fa": ["سابقه خانوادگی را بپرس.", "دهیدراتاسیون را چک کن.", "تیلت در عود کمک می‌کند.", "آموزش ایستادن تدریجی."],
        "points_en": ["Ask family history.", "Check dehydration.", "Tilt helps recurrence.", "Teach gradual standing."],
        "hint_fa": "سنکوپ ایستاده اول کدام آزمون؟",
        "hint_en": "Which test first in upright syncope?",
        "attending_fa": "استاد: سنکوپ را با نوار شروع کن.",
        "attending_en": "Attending: Start syncope with ECG."
    },
    (1,120): {
        "interpretation_fa": "پسر ۱۵ ساله با تنگی‌نفس فعالیتی و درد قفسه سینه، نبض ضعیف قرینه، بدون سیانوز و ورید برجسته، صدای اضافه قبل از اول در اپکس و سوفل میدسیستولیک چپ جناغ، تنگی آئورت را مطرح می‌کند. صدای اضافه کلیک جهشی و سوفل جهشی مشخصه است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است.",
        "interpretation_en": "A 15-year-old with exertional dyspnea and chest pain, weak symmetric pulses, no cyanosis or high jugular, extra sound before S1 at apex and midsystolic murmur left sternal border suggests aortic stenosis. Extra sound ejection click and ejection murmur characteristic.",
        "reasons_fa": [
            "دلیل رد گزینه: تنگی پولمونر سوفل لبه چپ بدون کلیک اپکس است.",
            "گزینه صحیح: تنگی آئورت کلیک جهشی و سوفل جهشی است.",
            "دلیل رد گزینه: ابشتاین تریکوسپید است.",
            "دلیل رد گزینه: کوآرکتاسیون فشار نامتقارن می‌دهد."
        ],
        "reasons_en": [
            "Why incorrect: Pulmonic stenosis murmur left border without apex click.",
            "Correct: AS ejection click and ejection murmur.",
            "Why incorrect: Ebstein tricuspid.",
            "Why incorrect: Coarctation gives asymmetric pressure."
        ],
        "lead_fa": "کلیک قبل از اول + سوفل جهشی یعنی آئورت.",
        "lead_en": "Click before S1 + ejection murmur means aortic.",
        "golden_fa": "نوجوان با سوفل جهشی را اکو کن.",
        "golden_en": "Echo teen with ejection murmur.",
        "points_fa": ["اکو شدت را می‌سنجد.", "ورزش سنگین را محدود کن.", "سابقه سنکوپ را بپرس.", "در شدید تعویض مطرح است."],
        "points_en": ["Echo grades.", "Limit strenuous exercise.", "Ask syncope history.", "Severe needs replacement."],
        "hint_fa": "کلیک جهشی با کدام تنگی می‌آید؟",
        "hint_en": "Which stenosis gives ejection click?",
        "attending_fa": "استاد: کلیک را آئورتی بشنو.",
        "attending_en": "Attending: Hear click as aortic."
    },
}
OPTIONS_EN_MAP8 = {
    (1,106): ['Pericardial tamponade', 'Tension pneumothorax', 'CHF', 'COPD'],
    (1,107): ['Nitroglycerin', 'Heparin', 'Aspirin', 'Beta-blocker'],
    (1,108): ['Hypertension', 'Diabetes', 'Smoking', 'Dyslipidemia'],
    (1,109): ['Hematocrit', 'Serum Na', 'Blood glucose', 'Homocysteine'],
    (1,110): ['High ASO', 'High ESR', 'Long PR', 'Fever'],
    (1,111): ['Pulmonary embolism', 'Pneumothorax', 'COPD', 'Tricuspid stenosis'],
    (1,112): ['Intracranial bleed any time', 'SBP >180', 'Menstrual bleeding', 'Suspected dissection'],
    (1,113): ['Start amlodipine', 'Leg Doppler', 'Chest film + TEE', 'Abdominal CT'],
    (1,114): ['Diastolic dysfunction', 'Systolic dysfunction', 'Regional hypokinesis', 'ST changes'],
    (1,115): ['Digoxin', 'Spironolactone', 'Amlodipine', 'Furosemide'],
    (1,116): ['AR', 'Hypothyroidism', 'Fever', 'PDA'],
    (1,117): ['No action', 'Oral beta-blocker', 'IV amiodarone', 'DC shock'],
    (1,118): ['Fluctuating hallmark delirium', 'Dementia hours', 'Somatic disease more in dementia', 'Delirium chronic'],
    (1,119): ['Blood lab', 'ECG', 'EEG', 'Tilt test'],
    (1,120): ['Pulmonic stenosis', 'Aortic stenosis', 'Ebstein', 'Coarctation'],
}
def enrich8():
    assert len(ITEMS)==15
    path = ROOT / f"tools/master-bank/import-payload.master-preint.part{PART:02}.json"
    before = json.loads(path.read_text(encoding="utf-8"))
    after = copy.deepcopy(before)
    for local, q in enumerate(after["questions"], 1):
        item = ITEMS.get((PART, local))
        if item is None:
            continue
        if not q.get("options_en") or len([o for o in q.get("options_en",[]) if str(o).strip()])<4:
            q["options_en"] = OPTIONS_EN_MAP8.get((PART, local), q.get("options_en",[]))
        if "pending retrospective" in q.get("question_en",""):
            q["question_en"] = q["question_en"].split(" > ")[0]
        q["explanation_fa"] = item["interpretation_fa"] + "\n\n" + "درسنامه: " + item["lead_fa"] + " " + item["golden_fa"]
        q["explanation_en"] = item["interpretation_en"] + "\n\nLesson: " + item["lead_en"] + " " + item["golden_en"]
        q["options_why_fa"] = list(item["reasons_fa"])
        q["options_why_en"] = list(item["reasons_en"])
        if "micro" not in q or not isinstance(q["micro"], dict):
            q["micro"] = {}
        q["micro"]["lead_fa"] = item["lead_fa"]
        q["micro"]["lead_en"] = item["lead_en"]
        q["micro"]["golden_fa"] = item["golden_fa"]
        q["micro"]["golden_en"] = item["golden_en"]
        q["micro"]["points_fa"] = list(item["points_fa"])
        q["micro"]["points_en"] = list(item["points_en"])
        q["micro"]["source_fa"] = "هاریسون ۲۲ - قلب"
        q["micro"]["source_en"] = "Harrison 22e - Cardiology"
        q["hints_fa"] = [item["hint_fa"]]
        q["hints_en"] = [item["hint_en"]]
        q["attending_fa"] = item["attending_fa"]
        q["attending_en"] = item["attending_en"]
        assert len(q["explanation_fa"])>340
        assert q["options_why_fa"][q["correct_index"]].startswith("گزینه صحیح:")
        assert all(q["options_why_fa"][i].startswith("دلیل رد گزینه:") for i in range(4) if i != q["correct_index"])
        assert q["options_why_en"][q["correct_index"]].startswith("Correct:")
        assert q["options_fa"][q["correct_index"]] not in q["hints_fa"][0]
    ALLOWED = {"explanation_fa","explanation_en","options_why_fa","options_why_en","options_en","question_en","hints_fa","hints_en","attending_fa","attending_en"}
    MICRO_ALLOWED = {"lead_fa","lead_en","golden_fa","golden_en","points_fa","points_en","source_fa","source_en"}
    restored = copy.deepcopy(after)
    for local, (old,new) in enumerate(zip(before["questions"], restored["questions"]),1):
        if (PART, local) in ITEMS:
            for f in ALLOWED:
                new[f]=old.get(f)
            for f in MICRO_ALLOWED:
                if "micro" in new and "micro" in old:
                    new["micro"][f]=old["micro"].get(f) if isinstance(old.get("micro"),dict) else None
            assert old["question_fa"]==new["question_fa"]
            assert old["options_fa"]==new["options_fa"]
            assert old["correct_index"]==new["correct_index"]
    path.write_text(json.dumps(after, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(f"PASS: enriched {len(ITEMS)} heart Q106-120")
if __name__=="__main__":
    enrich8()
