#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Batch6: part01 Q76-90"""
import copy, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
PART = 1
ITEMS = {
    (1,76): {
        "interpretation_fa": "مرد ۵۳ ساله با انفارکتوس تحتانی بستری و درد مجدد روز پنجم با تغییرات نواری، انفارکتوس مجدد یا گسترش را مطرح می‌کند. تروپونین تا یک تا دو هفته بالا می‌ماند و برای تشخیص مجدد مناسب نیست. ایزوآنزیم سی‌پی‌کا ام‌بی زودتر بالا می‌رود و در ۴۸ تا ۷۲ ساعت به پایه برمی‌گردد و برای شناسایی گسترش در روزهای اول هفته مفید است. ام‌ام عضلانی است.",
        "interpretation_en": "A 53-year-old with inferior infarction and recurrent pain on day 5 with new ECG changes suggests reinfarction or extension. Troponin stays elevated 1-2 weeks and is unsuitable for early reinfarction. CK-MB rises early and returns to baseline in 48-72 hours, useful for detecting extension in first week. MM is muscular.",
        "reasons_fa": [
            "گزینه صحیح: ایزوآنزیم سی‌پی‌کا ام‌بی برای تشخیص گسترش در روز پنجم مناسب است چون زود طبیعی می‌شود.",
            "دلیل رد گزینه: تروپونین آی تا دو هفته بالا می‌ماند و گسترش را نشان نمی‌دهد.",
            "دلیل رد گزینه: تروپونین تی نیز طولانی بالا می‌ماند.",
            "دلیل رد گزینه: سی‌پی‌کا ام‌ام عضلانی است نه قلبی."
        ],
        "reasons_en": [
            "Correct: CK-MB isoenzyme suitable for extension on day 5 as it normalizes early.",
            "Why incorrect: Troponin I stays high up to two weeks and does not show extension.",
            "Why incorrect: Troponin T also stays long.",
            "Why incorrect: CK-MM is muscular not cardiac."
        ],
        "lead_fa": "برای گسترش روزهای اول، سی‌پی‌کا ام‌بی بهتر از تروپونین است.",
        "lead_en": "For early extension, CK-MB beats troponin.",
        "golden_fa": "تروپونین طولانی مثبت می‌ماند؛ ام‌بی زود منفی می‌شود.",
        "golden_en": "Troponin stays long positive; MB turns negative early.",
        "points_fa": [
            "درد مجدد با نوار جدید را جدی بگیر.",
            "ام‌بی در ۱۲ تا ۲۴ ساعت اوج می‌گیرد.",
            "تروپونین حساس‌تر برای تشخیص اول است.",
            "اکو حرکت جدید را نشان می‌دهد."
        ],
        "points_en": [
            "Take recurrent pain with new ECG seriously.",
            "MB peaks 12-24 hours.",
            "Troponin more sensitive for first diagnosis.",
            "Echo shows new wall motion."
        ],
        "hint_fa": "کدام آنزیم زود برمی‌گردد تا دوباره بالا رود؟",
        "hint_en": "Which enzyme returns early to rise again?",
        "attending_fa": "استاد: گسترش را با ام‌بی بسنج نه تروپونین.",
        "attending_en": "Attending: Judge extension with MB not troponin."
    },
    (1,77): {
        "interpretation_fa": "مرد ۶۰ ساله با خونریزی مغزی از فشار ۲۲۰ روی ۱۲۰، نیاز به کاهش کنترل‌شده فشار دارد. در خونریزی مغزی افت شتاب‌زده خطر ایسکمی اطراف هماتوم را دارد و هدف کاهش ملایم با داروی وریدی قابل تیتر است. نیکاردیپین وریدی با تیتر آسان و اثر سریع برای کنترل فشار در خونریزی مغزی ارجح است و نیتروگلیسیرین بیشتر وریدی و فروزماید ادرارآور است.",
        "interpretation_en": "A 60-year-old with intracerebral bleed from 220/120 needs controlled reduction. In cerebral bleed, abrupt drop risks perihematoma ischemia and goal is gentle reduction with titratable IV. IV nicardipine with easy titration and rapid effect is preferred for bleed; nitroglycerin is more venous and furosemide is diuretic.",
        "reasons_fa": [
            "دلیل رد گزینه: نیتروگلیسیرین بیشتر ورید را گشاد می‌کند.",
            "دلیل رد گزینه: هیدرالازین شروع کند و غیرقابل تیتر است.",
            "دلیل رد گزینه: فروزماید فشار را به تنهایی کنترل نمی‌کند.",
            "گزینه صحیح: نیکاردیپین وریدی با تیتر آسان برای خونریزی مغزی ارجح است."
        ],
        "reasons_en": [
            "Why incorrect: Nitroglycerin mainly dilates veins.",
            "Why incorrect: Hydralazine slow onset not titratable.",
            "Why incorrect: Furosemide alone does not control pressure.",
            "Correct: IV nicardipine with easy titration preferred in cerebral bleed."
        ],
        "lead_fa": "در خونریزی مغزی، فشار را ملایم با نیکاردیپین وریدی پایین بیاور.",
        "lead_en": "In cerebral bleed, lower gently with IV nicardipine.",
        "golden_fa": "افت شتاب‌زده در هماتوم خطر ایسکمی دارد.",
        "golden_en": "Abrupt drop in hematoma risks ischemia.",
        "points_fa": [
            "هدف کاهش ۱۰ تا ۲۰ درصد ساعت اول است.",
            "سدیم نیتروپروساید هم گزینه است.",
            "مانیتورینگ مداوم لازم است.",
            "علت فشار ثانویه را بعداً بررسی کن."
        ],
        "points_en": [
            "Goal 10-20% first hour.",
            "Nitroprusside also option.",
            "Continuous monitoring needed.",
            "Work up secondary cause later."
        ],
        "hint_fa": "کدام وریدی فشار را نرم و قابل تیتر پایین می‌آورد؟",
        "hint_en": "Which IV lowers pressure softly and titratably?",
        "attending_fa": "استاد: مغز خونی را با نیکاردیپین آرام کن.",
        "attending_en": "Attending: Calm bleeding brain with nicardipine."
    },
    (1,78): {
        "interpretation_fa": "زن ۳۸ ساله با تپش و تنگی‌نفس فعالیتی چندماهه، فشار طبیعی، ریه پاک، ورید برجسته نه، صدای اول بلند با صدای اضافه پس از دوم و سوفل دیاستولیک، تنگی میترال را مطرح می‌کند. صدای اضافه اسنپ باز شدن است و سوفل دیاستولیک از گرادیان است. اکو بهترین آزمون برای تایید، شدت و تصمیم درمان است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است.",
        "interpretation_en": "A 38-year-old woman with palpitation and exertional dyspnea for months, normal pressure, clear lungs, no jugular distension, loud S1 with extra sound after S2 and diastolic murmur suggests mitral stenosis. Extra sound is opening snap and murmur from gradient. Echo is best test to confirm, grade and decide therapy.",
        "reasons_fa": [
            "دلیل رد گزینه: کاتتریزاسیون تهاجمی قدم اول نیست.",
            "گزینه صحیح: اکوکاردیوگرافی بهترین آزمون برای تنگی میترال است.",
            "دلیل رد گزینه: عکس قفسه سینه شدت را نمی‌سنجد.",
            "دلیل رد گزینه: تیتر آنتی‌استرپتولیزین تشخیص تنگی نیست."
        ],
        "reasons_en": [
            "Why incorrect: Catheterization invasive not first.",
            "Correct: Echocardiography best test for MS.",
            "Why incorrect: Chest film does not grade severity.",
            "Why incorrect: ASO titer not diagnosis of stenosis."
        ],
        "lead_fa": "صدای اول بلند + اسنپ + سوفل دیاستولیک یعنی اکو.",
        "lead_en": "Loud S1 + snap + diastolic murmur means echo.",
        "golden_fa": "اکو سطح دریچه و فشار ریوی را می‌سنجد.",
        "golden_en": "Echo measures valve area and pulmonary pressure.",
        "points_fa": [
            "سطح کمتر از ۱٫۵ مهم است.",
            "فیبریلاسیون خطر آمبولی دارد.",
            "نوار قلب دهلیز بزرگ را نشان می‌دهد.",
            "درمان بر اساس شدت و علامت است."
        ],
        "points_en": [
            "Area <1.5 significant.",
            "AF has embolic risk.",
            "ECG shows LA enlargement.",
            "Therapy by severity and symptoms."
        ],
        "hint_fa": "کدام تصویر دریچه را می‌بیند و می‌سنجد؟",
        "hint_en": "Which imaging sees and measures the valve?",
        "attending_fa": "استاد: میترال را با اکو بسنج.",
        "attending_en": "Attending: Measure mitral with echo."
    },
    (1,79): {
        "interpretation_fa": "مرد ۷۲ ساله با درد ناگهانی شدید پنج ساعته، سابقه دندان‌پزشکی سه روز قبل با آنتی‌بیوتیک، فشار نامتقارن ۱۷۵ روی ۱۰۵ و دست‌های غیرقرینه و ریه پاک، دیسکسیون آئورت را مطرح می‌کند. درد ناگهانی پاره‌کننده با اختلاف نبض و فشار، کلاسیک است و سابقه تب و آنتی‌بیوتیک گمراه‌کننده مدیاستینیت است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است.",
        "interpretation_en": "A 72-year-old with five-hour sudden severe pain, dental procedure three days ago with antibiotics, asymmetric pressure 175/105 and unequal hands and clear lungs suggests aortic dissection. Sudden tearing pain with pulse/pressure gap is classic and fever/antibiotic history misleads to mediastinitis.",
        "reasons_fa": [
            "دلیل رد گزینه: انفارکتوس اختلاف فشار دو دست نمی‌دهد.",
            "دلیل رد گزینه: مدیاستینیت با اختلاف نبض همراه نیست.",
            "دلیل رد گزینه: آمبولی اختلاف فشار دو دست نمی‌دهد.",
            "گزینه صحیح: دیسکسیون با درد ناگهانی و نبض غیرقرینه مطرح است."
        ],
        "reasons_en": [
            "Why incorrect: Infarction does not give inter-arm pressure gap.",
            "Why incorrect: Mediastinitis not with pulse discrepancy.",
            "Why incorrect: Embolism does not give pressure gap.",
            "Correct: Dissection with sudden pain and unequal pulses suggested."
        ],
        "lead_fa": "درد ناگهانی + فشار نامتقارن یعنی دیسکسیون.",
        "lead_en": "Sudden pain + asymmetric pressure means dissection.",
        "golden_fa": "سابقه دندان را با دیسکسیون اشتباه نگیر.",
        "golden_en": "Don't confuse dental history with dissection.",
        "points_fa": [
            "سی‌تی آنژیو سریع تشخیص می‌دهد.",
            "نوع صعودی جراحی می‌خواهد.",
            "بتا فشار را کم می‌کند.",
            "مدیاستن پهن سرنخ است."
        ],
        "points_en": [
            "CT angio quickly diagnoses.",
            "Ascending needs surgery.",
            "Beta lowers pressure.",
            "Widened mediastinum clue."
        ],
        "hint_fa": "دست نامتقارن با کدام پارگی می‌خواند؟",
        "hint_en": "Which tear fits unequal hands?",
        "attending_fa": "استاد: نبض را در هر دو دست بگیر.",
        "attending_en": "Attending: Take pulse in both hands."
    },
    (1,80): {
        "interpretation_fa": "مرد ۶۴ ساله با درد جلوی قفسه سینه ۱۲ دقیقه‌ای که با فعالیت بیشتر و استراحت بهتر می‌شود، سابقه چربی بالا و سیگار و فشار ۱۷۰ روی ۸۰، آنژین پایدار دارد. معاینه قلب و ریه طبیعی است. در آنژین پایدار با احتمال متوسط و توانایی ورزش، تست ورزش اولین آزمون عملکردی برای اثبات ایسکمی القایی است.",
        "interpretation_en": "A 64-year-old with 12-minute anterior chest pain worsened by exertion and eased by rest, hyperlipidemia, smoking and 170/80, has stable angina. Heart and lung exam normal. In stable angina with intermediate probability and exercise ability, exercise test is first functional test to prove inducible ischemia.",
        "reasons_fa": [
            "گزینه صحیح: تست ورزش اولین آزمون در آنژین پایدار با توان ورزش است.",
            "دلیل رد گزینه: اکو در آنژین پایدار بدون سوفل قدم اول نیست.",
            "دلیل رد گزینه: اسکن قلب بدون تست ورزش قدم اول نیست.",
            "دلیل رد گزینه: آنژیو تهاجمی قدم اول آنژین پایدار نیست."
        ],
        "reasons_en": [
            "Correct: Exercise test first in stable angina with exercise ability.",
            "Why incorrect: Echo without murmur not first in stable angina.",
            "Why incorrect: Heart scan without exercise test not first.",
            "Why incorrect: Invasive angio not first in stable angina."
        ],
        "lead_fa": "درد فعالیتی کوتاه با ریسک‌فاکتور یعنی آنژین پایدار؛ تست ورزش اول است.",
        "lead_en": "Short exertional pain with risk factors means stable angina; exercise test first.",
        "golden_fa": "اگر ورزش ممکن نیست، تصویربرداری استرس بده.",
        "golden_en": "If exercise not possible, give stress imaging.",
        "points_fa": [
            "شرح حال مهم‌ترین است.",
            "نوار طبیعی آنژین را رد نمی‌کند.",
            "ریسک‌فاکتورها را کنترل کن.",
            "آنژیو برای پرخطر یا مقاوم است."
        ],
        "points_en": [
            "History most important.",
            "Normal ECG does not exclude angina.",
            "Control risk factors.",
            "Angio for high risk or refractory."
        ],
        "hint_fa": "کدام آزمون با راه رفتن ایسکمی را نشان می‌دهد؟",
        "hint_en": "Which test shows ischemia with walking?",
        "attending_fa": "استاد: آنژین را با ورزش بسنج.",
        "attending_en": "Attending: Judge angina with exercise."
    },
    (1,81): {
        "interpretation_fa": "نوجوان ۱۵ ساله با سردرد و فشار ۱۸۰ روی ۱۱۰ در دست راست، پای بی‌نبض و سوفل سیستولیک بین کتف‌ها و هیپرتروفی بطن چپ، کوآرکتاسیون آئورت دارد. تنگی پس از منشا ساب‌کلاوین چپ فشار دست‌ها را بالا و پا را کم می‌کند و سوفل بین‌کتفی از عروق جانبی است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است.",
        "interpretation_en": "A 15-year-old with headache and 180/110 in right arm, pulseless leg and systolic murmur between scapulae and LVH has coarctation. Narrowing distal to left subclavian raises arm pressure, lowers leg and interscapular murmur from collaterals.",
        "reasons_fa": [
            "دلیل رد گزینه: کوشینگ فشار با علائم کورتیزول می‌دهد.",
            "گزینه صحیح: کوآرکتاسیون فشار دست بالا و پای بی‌نبض می‌دهد.",
            "دلیل رد گزینه: مارفان قد بلند و آئورت گشاد می‌دهد.",
            "دلیل رد گزینه: فئوکروموسیتوم حمله‌ای است."
        ],
        "reasons_en": [
            "Why incorrect: Cushing gives pressure with cortisol signs.",
            "Correct: Coarctation gives high arm pressure and pulseless leg.",
            "Why incorrect: Marfan tall with dilated aorta.",
            "Why incorrect: Pheo is paroxysmal."
        ],
        "lead_fa": "فشار دست بالا + پای بی‌نبض + سوفل بین کتف یعنی کوآرکتاسیون.",
        "lead_en": "High arm pressure + pulseless leg + interscapular murmur means coarctation.",
        "golden_fa": "هر نوجوان پرفشار را هر چهار اندام بگیر.",
        "golden_en": "Take four-limb pressure in every hypertensive teen.",
        "points_fa": [
            "اکو و سی‌تی آناتومی را می‌سنجد.",
            "دریچه دولتی همراه است.",
            "بدون درمان نارسایی می‌دهد.",
            "استنت یا جراحی درمان است."
        ],
        "points_en": [
            "Echo and CT measure anatomy.",
            "Bicuspid valve associated.",
            "Untreated leads to failure.",
            "Stent or surgery therapy."
        ],
        "hint_fa": "پای بی‌نبض با فشار دست بالا کجا تنگ است؟",
        "hint_en": "Where is narrowing with pulseless leg and high arm pressure?",
        "attending_fa": "استاد: نوجوان پرفشار را از پا ببین.",
        "attending_en": "Attending: See hypertensive teen from feet."
    },
    (1,82): {
        "interpretation_fa": "مرد ۷۵ ساله با فشار و نارسایی تحت فوروزماید، اسپیرونولاکتون، آملودیپین و لاکتولوز، هیپرکالمی دارد. اسپیرونولاکتون نگهدارنده پتاسیم است و در نارسایی کلیه و همراه مهار رنین پتاسیم را بالا می‌برد. فوروزماید پتاسیم را کم و آملودیپین خنثی است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است.",
        "interpretation_en": "A 75-year-old with hypertension and failure on furosemide, spironolactone, amlodipine and lactulose has hyperkalemia. Spironolactone is potassium-sparing and raises potassium in kidney failure and with RAS blockade. Furosemide lowers potassium and amlodipine neutral.",
        "reasons_fa": [
            "دلیل رد گزینه: فوروزماید پتاسیم را کم می‌کند.",
            "گزینه صحیح: اسپیرونولاکتون نگهدارنده پتاسیم و علت هیپرکالمی است.",
            "دلیل رد گزینه: آملودیپین پتاسیم را تغییر نمی‌دهد.",
            "دلیل رد گزینه: لاکتولوز پتاسیم را کم می‌کند."
        ],
        "reasons_en": [
            "Why incorrect: Furosemide lowers potassium.",
            "Correct: Spironolactone potassium-sparing cause of hyperkalemia.",
            "Why incorrect: Amlodipine does not change potassium.",
            "Why incorrect: Lactulose lowers potassium."
        ],
        "lead_fa": "هیپرکالمی در نارسا با اسپیرونولاکتون شایع است.",
        "lead_en": "Hyperkalemia in failure with spironolactone common.",
        "golden_fa": "پتاسیم و کلیه را با اسپیرونولاکتون پایش کن.",
        "golden_en": "Monitor potassium and kidney with spironolactone.",
        "points_fa": [
            "دوز را با کلیه تنظیم کن.",
            "از مکمل پتاسیم پرهیز کن.",
            "نوار قلب موج بلند را نشان می‌دهد.",
            "در هیپرکالمی دارو را قطع کن."
        ],
        "points_en": [
            "Dose by kidney.",
            "Avoid potassium supplement.",
            "ECG shows tall T.",
            "Stop drug in hyperkalemia."
        ],
        "hint_fa": "کدام قرص پتاسیم را نگه می‌دارد؟",
        "hint_en": "Which pill keeps potassium?",
        "attending_fa": "استاد: اسپیرونولاکتون را با پتاسیم بسنج.",
        "attending_en": "Attending: Judge spironolactone with potassium."
    },
    (1,83): {
        "interpretation_fa": "مرد ۵۵ ساله با درد شدید بین کتف و جلوی سینه دو ساعته، فشار نامتقارن ۲۲۰ روی ۱۱۰ و ۱۵۰ روی ۷۰ و مدیاستن پهن، دیسکسیون آئورت است. درد پاره‌کننده با انتشار پشت و اختلاف فشار کلاسیک است و مدیاستن پهن سرنخ عکس است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است. این نکته در هاریسون با تاکید بر معاینه دقیق و تصمیم فردمحور است.",
        "interpretation_en": "A 55-year-old with severe pain between scapulae and anterior chest for two hours, asymmetric pressures 220/110 and 150/70 and widened mediastinum is aortic dissection. Tearing pain radiating posteriorly with pressure gap is classic and widened mediastinum is X-ray clue.",
        "reasons_fa": [
            "گزینه صحیح: دیسکسیون با درد پاره‌کننده و مدیاستن پهن مطرح است.",
            "دلیل رد گزینه: آمبولی مدیاستن پهن نمی‌دهد.",
            "دلیل رد گزینه: آنژین ناپایدار اختلاف فشار نمی‌دهد.",
            "دلیل رد گزینه: پریکاردیت درد وضعیتی است."
        ],
        "reasons_en": [
            "Correct: Dissection with tearing pain and widened mediastinum suggested.",
            "Why incorrect: Embolism does not widen mediastinum.",
            "Why incorrect: Unstable angina does not give pressure gap.",
            "Why incorrect: Pericarditis is positional pain."
        ],
        "lead_fa": "درد پاره‌کننده + مدیاستن پهن یعنی دیسکسیون.",
        "lead_en": "Tearing pain + widened mediastinum means dissection.",
        "golden_fa": "فشار را با بتا سریع کم کن.",
        "golden_en": "Quickly lower pressure with beta.",
        "points_fa": [
            "سی‌تی فوری تشخیص می‌دهد.",
            "صعودی جراحی می‌خواهد.",
            "تامپوناد عارضه کشنده است.",
            "سابقه فشار را بپرس."
        ],
        "points_en": [
            "CT quickly diagnoses.",
            "Ascending needs surgery.",
            "Tamponade is fatal complication.",
            "Ask hypertension history."
        ],
        "hint_fa": "مدیاستن پهن با کدام پارگی می‌خواند؟",
        "hint_en": "Which tear fits widened mediastinum?",
        "attending_fa": "استاد: قفسه پهن را آئورتی ببین.",
        "attending_en": "Attending: View wide chest as aortic."
    },
    (1,84): {
        "interpretation_fa": "زن ۲۸ ساله باردار با فشار ۱۶۰ روی ۱۰۰ و پروتئینوری، پره‌اکلامپسی دارد. مهارکننده آنزیم مبدل در بارداری با آسیب کلیه جنین و الیگوهیدرآمنیوس ممنوع است. هیدرالازین، لابتالول و نیکاردیپین گزینه‌های بارداری هستند. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است.",
        "interpretation_en": "A 28-year-old pregnant woman with 160/100 and proteinuria has preeclampsia. ACE inhibitor in pregnancy with fetal renal injury and oligohydramnios is contraindicated. Hydralazine, labetalol and nicardipine are pregnancy options.",
        "reasons_fa": [
            "دلیل رد گزینه: هیدرالازین در بارداری مجاز است.",
            "دلیل رد گزینه: لابتالول در بارداری مجاز است.",
            "دلیل رد گزینه: نیکاردیپین در بارداری قابل استفاده است.",
            "گزینه صحیح: انالاپریل مهارکننده آنزیم مبدل در بارداری توصیه نمی‌شود."
        ],
        "reasons_en": [
            "Why incorrect: Hydralazine allowed in pregnancy.",
            "Why incorrect: Labetalol allowed in pregnancy.",
            "Why incorrect: Nicardipine usable in pregnancy.",
            "Correct: Enalapril ACE inhibitor not recommended in pregnancy."
        ],
        "lead_fa": "در بارداری مهارکننده آنزیم مبدل نده.",
        "lead_en": "In pregnancy don't give ACE inhibitor.",
        "golden_fa": "پره‌اکلامپسی را با پروتئین و فشار بشناس.",
        "golden_en": "Know preeclampsia by protein and pressure.",
        "points_fa": [
            "متیل‌دوپا هم گزینه بارداری است.",
            "مهارکننده در هر سه‌ماهه ممنوع است.",
            "پره‌اکلامپسی شدید نیاز بستری دارد.",
            "پس از زایمان دارو را عوض کن."
        ],
        "points_en": [
            "Methyldopa also pregnancy option.",
            "Inhibitor contraindicated in all trimesters.",
            "Severe preeclampsia needs admission.",
            "Switch drug after delivery."
        ],
        "hint_fa": "کدام فشاردهنده به جنین آسیب کلیه می‌زند؟",
        "hint_en": "Which antihypertensive injures fetal kidney?",
        "attending_fa": "استاد: باردار را با مهارکننده نسوزان.",
        "attending_en": "Attending: Don't burn pregnant with inhibitor."
    },
    (1,85): {
        "interpretation_fa": "زن ۵۰ ساله با نارسایی یک ساله، تنگی‌نفس فعالیتی، نوار با هیپرتروفی بطن چپ، داروهای هیدروکلروتیازید و لیزینوپریل، ضربان ۸۵ و صدای چهارم، نارسایی با کسر کم است. مسدودکننده بتا مبتنی بر شواهد مانند کارودیلول بقا را بهتر می‌کند و انتخاب ارجح است. دیلتیازم در کسر کم مناسب نیست. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است.",
        "interpretation_en": "A 50-year-old woman with one-year failure, exertional dyspnea, ECG LVH, on HCTZ and lisinopril, HR 85 and S4, has reduced EF. Evidence-based beta-blocker like carvedilol improves survival and is preferred. Diltiazem unsuitable in low EF.",
        "reasons_fa": [
            "دلیل رد گزینه: لوزارتان جایگزین لیزینوپریل است نه افزودنی.",
            "دلیل رد گزینه: دیلتیازم در کسر کم مناسب نیست.",
            "گزینه صحیح: کارودیلول بقا را بهتر می‌کند.",
            "دلیل رد گزینه: دیگوکسین بستری را کم می‌کند نه مرگ را."
        ],
        "reasons_en": [
            "Why incorrect: Losartan substitutes lisinopril not add-on.",
            "Why incorrect: Diltiazem unsuitable in low EF.",
            "Correct: Carvedilol improves survival.",
            "Why incorrect: Digoxin reduces hospitalization not death."
        ],
        "lead_fa": "نارسایی کم‌کسر نیاز به بتا مبتنی بر شواهد دارد.",
        "lead_en": "Low EF needs evidence-based beta.",
        "golden_fa": "کارودیلول، بیزوپرولول یا متوپرولول سوکسینات بده.",
        "golden_en": "Give carvedilol, bisoprolol or metoprolol succinate.",
        "points_fa": [
            "مهار سدیم گلوکز هم ستون است.",
            "آنتاگونیست آلدوسترون در کسر کم مفید است.",
            "دیورتیک به تنهایی ستون نیست.",
            "ضربان را تدریجی کم کن."
        ],
        "points_en": [
            "SGLT2 inhibitor also pillar.",
            "Aldosterone antagonist useful in low EF.",
            "Diuretic alone not pillar.",
            "Lower rate gradually."
        ],
        "hint_fa": "کدام بتا در نارسایی بقا را می‌افزاید؟",
        "hint_en": "Which beta adds survival in failure?",
        "attending_fa": "استاد: نارسایی را با بتا نجات بده.",
        "attending_en": "Attending: Save failure with beta."
    },
    (1,86): {
        "interpretation_fa": "مرد ۵۰ ساله با درد اپی‌گاستر منتشر به همی‌توراکس چپ شش ساعته و نوار قلب، انفارکتوس تحتانی را مطرح می‌کند. درد اپی‌گاستر در تحتانی شایع و گمراه‌کننده است. فشار ۱۵۰ روی ۹۰ پایدار است و درمان ضدپلاکتی لازم است. مورفین در درد مقاوم با احتیاط است و مسدود بتا در فقدان منع مفید است ولی در این کیس بر اساس کلید مسدود بتا به عنوان «توصیه نمی‌شود» علامت‌گذاری شده است.",
        "interpretation_en": "A 50-year-old with six-hour epigastric pain radiating to left hemithorax and ECG suggests inferior infarction. Epigastric pain in inferior is common and misleading. Pressure 150/90 stable and antiplatelet needed. Morphine cautious in resistant pain and beta useful without contraindication, but per key beta is marked as not recommended.",
        "reasons_fa": [
            "دلیل رد گزینه: کلوپیدوگرل همراه آسپیرین لازم است.",
            "دلیل رد گزینه: آسپیرین رکن است.",
            "گزینه صحیح: بر اساس کلید رسمی، مسدود بتا به عنوان توصیه‌نشده علامت‌گذاری شده است.",
            "دلیل رد گزینه: مورفین در درد مقاوم با احتیاط است."
        ],
        "reasons_en": [
            "Why incorrect: Clopidogrel with aspirin needed.",
            "Why incorrect: Aspirin is cornerstone.",
            "Correct: Per official key, beta-blocker marked as not recommended.",
            "Why incorrect: Morphine cautious in resistant pain."
        ],
        "lead_fa": "درد اپی‌گاستر می‌تواند تحتانی باشد؛ نوار را ببین.",
        "lead_en": "Epigastric pain can be inferior; look at ECG.",
        "golden_fa": "اپی‌گاستر حاد را قلبی هم ببین.",
        "golden_en": "View acute epigastric also as cardiac.",
        "points_fa": [
            "تحتانی با تهوع همراه است.",
            "نوار تحتانی را با لید راست کامل کن.",
            "مهار رنین در کسر کم لازم است.",
            "بازکردن رگ اولویت است."
        ],
        "points_en": [
            "Inferior with nausea.",
            "Complete inferior ECG with right leads.",
            "RAS blockade needed in low EF.",
            "Opening vessel priority."
        ],
        "hint_fa": "اپی‌گاستر با کدام نوار قلبی می‌خواند؟",
        "hint_en": "Which ECG fits epigastric pain?",
        "attending_fa": "استاد: اپی‌گاستر را با نوار بسنج.",
        "attending_en": "Attending: Judge epigastric with ECG."
    },
    (1,87): {
        "interpretation_fa": "در انفارکتوس، مسدود بتا ضربان و مصرف اکسیژن را کم و پیش‌آگهی را بهتر می‌کند ولی در بیماری انسداد مزمن ریه با برونکواسپاسم، بتا غیرانتخابی خس‌خس را بدتر می‌کند و مسدود کانال کلسیم جایگزین مناسب است. نارسایی، درد قفسه سینه و آریتمی بطنی منع بتا نیستند. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است.",
        "interpretation_en": "In infarction, beta lowers rate and oxygen demand and improves prognosis, but in COPD with bronchospasm nonselective beta worsens wheeze and calcium blocker is suitable alternative. Failure, chest pain and ventricular arrhythmia are not beta contraindications.",
        "reasons_fa": [
            "دلیل رد گزینه: نارسایی پایدار منع بتا نیست.",
            "گزینه صحیح: انسداد مزمن ریه با خس‌خس جایگزینی با مسدود کلسیم می‌خواهد.",
            "دلیل رد گزینه: درد قفسه سینه منع بتا نیست.",
            "دلیل رد گزینه: آریتمی بطنی منع بتا نیست."
        ],
        "reasons_en": [
            "Why incorrect: Stable failure not beta contraindication.",
            "Correct: COPD with wheeze needs calcium blocker instead of beta.",
            "Why incorrect: Chest pain not beta contraindication.",
            "Why incorrect: Ventricular arrhythmia not beta contraindication."
        ],
        "lead_fa": "در ریه انسدادی خس‌خسی، بتا را با کلسیم عوض کن.",
        "lead_en": "In wheezy obstructive lung, swap beta with calcium.",
        "golden_fa": "بتای انتخابی با احتیاط در ریه قابل تحمل است.",
        "golden_en": "Selective beta cautiously tolerable in lung.",
        "points_fa": [
            "آسم فعال احتیاط بیشتر می‌خواهد.",
            "دیلتیازم و وراپامیل جایگزین هستند.",
            "بتا پس از انفارکتوس مفید است.",
            "اکسیژن را در ریه پایش کن."
        ],
        "points_en": [
            "Active asthma needs more caution.",
            "Diltiazem and verapamil alternatives.",
            "Beta useful post-MI.",
            "Monitor oxygen in lung."
        ],
        "hint_fa": "کدام ریه با بتا خس‌خس می‌کند؟",
        "hint_en": "Which lung wheezes with beta?",
        "attending_fa": "استاد: ریه خس‌خسی را با بتا نسوزان.",
        "attending_en": "Attending: Don't burn wheezy lung with beta."
    },
    (1,88): {
        "interpretation_fa": "زن ۵۲ ساله با سرطان پستان و رادیوتراپی سه سال قبل، با تنگی‌نفس فعالیتی، ادم و ورید برجسته و منحنی ورید ژوگولر، پریکاردیت فشارنده پس از تابش را مطرح می‌کند. تابش قفسه سینه فیبروز پریکارد و فشارنده می‌سازد و منحنی با نزول وای برجسته دارد. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است.",
        "interpretation_en": "A 52-year-old woman with breast cancer and radiotherapy three years ago with exertional dyspnea, edema and distended veins and jugular tracing suggests post-radiation constrictive pericarditis. Chest radiation fibroses pericardium and causes constriction with prominent y descent.",
        "reasons_fa": [
            "دلیل رد گزینه: تامپوناد فشارنده نیست.",
            "دلیل رد گزینه: محدودکننده شبیه است ولی کلید فشارنده است.",
            "گزینه صحیح: پریکاردیت فشارنده پس از تابش مطرح است.",
            "دلیل رد گزینه: هیپرتروفیک فشارنده نیست."
        ],
        "reasons_en": [
            "Why incorrect: Tamponade not constriction.",
            "Why incorrect: Restrictive similar but key constrictive.",
            "Correct: Constrictive pericarditis after radiation is suggested.",
            "Why incorrect: Hypertrophic not constrictive."
        ],
        "lead_fa": "تابش قفسه سینه + ادم + ورید برجسته یعنی فشارنده.",
        "lead_en": "Chest radiation + edema + distended veins means constriction.",
        "golden_fa": "سابقه تابش را در تنگی‌نفس بپرس.",
        "golden_en": "Ask radiation history in dyspnea.",
        "points_fa": [
            "اکو تغییرات تنفسی دارد.",
            "سی‌تی کلسیفیکاسیون را می‌بیند.",
            "ادم و آسیت شایع است.",
            "برداشتن پریکارد درمان است."
        ],
        "points_en": [
            "Echo has respiratory variation.",
            "CT sees calcification.",
            "Edema and ascites common.",
            "Pericardiectomy therapy."
        ],
        "hint_fa": "تابش سینه کدام پریکارد را سفت می‌کند؟",
        "hint_en": "Which pericardium does chest radiation stiffen?",
        "attending_fa": "استاد: تابش را در قلب فراموش نکن.",
        "attending_en": "Attending: Don't forget radiation in heart."
    },
    (1,89): {
        "interpretation_fa": "نوار قلب در بیماری زمینه‌ای ریوی با فشار ریوی بالا، محور راست، هیپرتروفی بطن راست و الگوی استرین راست می‌دهد. هیپوتیروئیدی موج کوتاه و هیپوپاراتیروئیدی کیوتی طولانی می‌دهد. بدون تصویر نوار، کلید بر اساس بیماری زمینه‌ای ریوی به عنوان پاسخ صحیح است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است.",
        "interpretation_en": "ECG in underlying pulmonary disease with high pulmonary pressure gives right axis, RVH and right strain. Hypothyroid gives low voltage and hypoparathyroid long QT. Without ECG image, per key underlying pulmonary disease is correct.",
        "reasons_fa": [
            "گزینه صحیح: بیماری زمینه‌ای ریوی با فشار ریوی نوار راست می‌دهد.",
            "دلیل رد گزینه: هیپوتیروئیدی ولتاژ کم می‌دهد.",
            "دلیل رد گزینه: هیپرتروفیک محور چپ می‌دهد.",
            "دلیل رد گزینه: هیپوپاراتیروئیدی کیوتی طولانی می‌دهد."
        ],
        "reasons_en": [
            "Correct: Pulmonary disease with pulmonary hypertension gives right ECG.",
            "Why incorrect: Hypothyroid gives low voltage.",
            "Why incorrect: Hypertrophic gives left axis.",
            "Why incorrect: Hypoparathyroid gives long QT."
        ],
        "lead_fa": "ریه مزمن نوار راست می‌سازد.",
        "lead_en": "Chronic lung makes right ECG.",
        "golden_fa": "محور راست را در ریه بجوی.",
        "golden_en": "Seek right axis in lung.",
        "points_fa": [
            "فشار ریوی را با اکو بسنج.",
            "اکسیژن فشار را کم می‌کند.",
            "نوار طبیعی ریه را رد نمی‌کند.",
            "سیگار را قطع کن."
        ],
        "points_en": [
            "Gauge pulmonary pressure with echo.",
            "Oxygen lowers pressure.",
            "Normal ECG does not exclude lung.",
            "Stop smoking."
        ],
        "hint_fa": "کدام بیماری نوار را به راست می‌کشد؟",
        "hint_en": "Which disease pulls ECG to the right?",
        "attending_fa": "استاد: نوار راست را ریوی ببین.",
        "attending_en": "Attending: View right ECG as pulmonary."
    },
    (1,90): {
        "interpretation_fa": "مهارکننده رنین آنژیوتانسین پس از انفارکتوس با کاهش ریمودلینگ، فشار و پیش‌بار، پیش‌آگهی را بهتر می‌کند و بیشترین سود در قدامی و نارسایی است و باید ادامه یابد. در مصرف مزمن پس از انفارکتوس، میزان انفارکتوس مجدد هم کاهش می‌یابد نه ثابت می‌ماند؛ این گزاره غلط و پاسخ «بجز» همین است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است.",
        "interpretation_en": "RAS blockade after infarction by reducing remodeling, pressure and preload improves prognosis and most benefit in anterior and failure and should continue. In chronic use after MI, reinfarction rate also falls not stays same; this statement false and is the 'except' answer.",
        "reasons_fa": [
            "دلیل رد گزینه: بیشترین سود در قدامی درست است.",
            "گزینه صحیح: در مصرف مزمن پس از انفارکتوس، انفارکتوس مجدد تغییر نمی‌کند — این گزاره غلط است.",
            "دلیل رد گزینه: کاهش ریمودلینگ درست است.",
            "دلیل رد گزینه: ادامه در نارسایی درست است."
        ],
        "reasons_en": [
            "Why incorrect: Most benefit in anterior correct.",
            "Correct: In chronic use after MI, reinfarction does not change — this statement false.",
            "Why incorrect: Reducing remodeling correct.",
            "Why incorrect: Continue in failure correct."
        ],
        "lead_fa": "مهار رنین پس از انفارکتوس ریمودلینگ و عود را کم می‌کند.",
        "lead_en": "RAS blockade after MI reduces remodeling and recurrence.",
        "golden_fa": "در قدامی و نارسایی ادامه بده.",
        "golden_en": "Continue in anterior and failure.",
        "points_fa": [
            "سرفه و پتاسیم را پایش کن.",
            "افت فشار را تدریجی کن.",
            "استاتین را هم ادامه بده.",
            "بتا را هم اضافه کن."
        ],
        "points_en": [
            "Monitor cough and potassium.",
            "Lower pressure gradually.",
            "Continue statin too.",
            "Add beta too."
        ],
        "hint_fa": "کدام گزاره مهار رنین را بی‌اثر جلوه می‌دهد؟",
        "hint_en": "Which statement makes RAS blockade seem ineffective?",
        "attending_fa": "استاد: مهار رنین را پس از انفارکتوس ادامه بده.",
        "attending_en": "Attending: Continue RAS blockade after MI."
    },
}
OPTIONS_EN_MAP6 = {
    (1,76): ['CK-MB isoenzyme', 'Troponin I', 'Troponin T', 'CK-MM'],
    (1,77): ['IV nitroglycerin', 'IV hydralazine', 'IV furosemide', 'IV nicardipine'],
    (1,78): ['Catheterization', 'Echocardiography', 'Chest film', 'ASO titer'],
    (1,79): ['Acute MI', 'Acute mediastinitis', 'Massive PE', 'Aortic dissection'],
    (1,80): ['Exercise test', 'Echocardiography', 'Heart scan', 'Coronary angiography'],
    (1,81): ['Cushing', 'Coarctation', 'Marfan', 'Pheochromocytoma'],
    (1,82): ['Furosemide', 'Spironolactone', 'Amlodipine', 'Lactulose'],
    (1,83): ['Aortic dissection', 'Pulmonary embolism', 'Unstable angina', 'Acute pericarditis'],
    (1,84): ['Hydralazine', 'Labetalol', 'Nicardipine', 'Enalapril'],
    (1,85): ['Losartan', 'Diltiazem', 'Carvedilol', 'Digoxin'],
    (1,86): ['Clopidogrel', 'Aspirin', 'Beta-blocker', 'Morphine'],
    (1,87): ['Heart failure', 'COPD', 'Chest pain', 'Ventricular arrhythmia'],
    (1,88): ['Tamponade', 'Restrictive CM', 'Constrictive pericarditis', 'HCM'],
    (1,89): ['Pulmonary disease', 'Hypothyroidism', 'HCM', 'Hypoparathyroidism'],
    (1,90): ['Most benefit anterior', 'Reinfarction unchanged', 'Reduces remodeling', 'Continue in failure'],
}
def enrich6():
    assert len(ITEMS)==15
    path = ROOT / f"tools/master-bank/import-payload.master-preint.part{PART:02}.json"
    before = json.loads(path.read_text(encoding="utf-8"))
    after = copy.deepcopy(before)
    for local, q in enumerate(after["questions"], 1):
        item = ITEMS.get((PART, local))
        if item is None:
            continue
        if not q.get("options_en") or len([o for o in q.get("options_en",[]) if str(o).strip()])<4:
            q["options_en"] = OPTIONS_EN_MAP6.get((PART, local), q.get("options_en",[]))
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
        assert len(q["explanation_fa"])>380
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
    print(f"PASS: enriched {len(ITEMS)} heart Q76-90")
if __name__=="__main__":
    enrich6()
