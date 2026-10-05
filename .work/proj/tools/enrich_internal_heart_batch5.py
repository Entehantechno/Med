#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Batch5: part01 Q61-75"""
import copy, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
PART = 1
ITEMS = {
    (1,61): {
        "interpretation_fa": "زن ۳۴ ساله با تنگی‌نفس اخیر، ناتوانی در کار منزل، صدای اول تشدید یافته و سوفل دیاستولیک سه از شش در اپکس، تنگی میترال را مطرح می‌کند. صدای اول بلند از بسته شدن ناگهانی لت‌های متحرک و سوفل رامبل دیاستولیک از عبور خون با گرادیان از دهلیز به بطن در دیاستول است. تنگی نفس فعالیتی از افزایش فشار دهلیز چپ و مویرگ ریه می‌آید.",
        "interpretation_en": "A 34-year-old woman with recent dyspnea, inability to do housework, loud S1 and grade 3/6 diastolic rumble at apex suggests mitral stenosis. Loud S1 from abrupt closure of mobile leaflets and diastolic rumble from trans-mitral gradient in diastole. Exertional dyspnea from raised LA and pulmonary capillary pressure.",
        "reasons_fa": [
            "گزینه صحیح: سوفل دیاستولیک اپکس با صدای اول تشدید یافته تنگی میترال را مطرح می‌کند.",
            "دلیل رد گزینه: تنگی آئورت سوفل سیستولیک در قاعده با انتشار به کاروتید می‌دهد.",
            "دلیل رد گزینه: نارسایی میترال سوفل هولوسیستولیک اپکس است نه دیاستولیک.",
            "دلیل رد گزینه: نارسایی آئورت سوفل دیاستولیک در لبه چپ جناغ است نه اپکس."
        ],
        "reasons_en": [
            "Correct: Apex diastolic murmur with loud S1 suggests mitral stenosis.",
            "Why incorrect: Aortic stenosis gives systolic murmur at base radiating to carotids.",
            "Why incorrect: Mitral regurgitation is holosystolic at apex, not diastolic.",
            "Why incorrect: Aortic regurgitation gives diastolic murmur at left sternal border, not apex."
        ],
        "lead_fa": "سوفل دیاستولیک اپکس + صدای اول بلند یعنی تنگی میترال.",
        "lead_en": "Apex diastolic murmur + loud S1 means mitral stenosis.",
        "golden_fa": "تنگی میترال را با اکو و فشار ریوی بسنج.",
        "golden_en": "Assess mitral stenosis with echo and pulmonary pressure.",
        "points_fa": [
            "سطح طبیعی ۴ تا ۶ سانتی‌متر است؛ زیر ۱٫۵ مهم است.",
            "فیبریلاسیون دهلیزی خطر آمبولی را بالا می‌برد.",
            "اکو گرادیان و مورفولوژی را می‌سنجد.",
            "تب روماتیسمی سابقه شایع است."
        ],
        "points_en": [
            "Normal area 4-6 cm²; <1.5 significant.",
            "AF raises embolic risk.",
            "Echo measures gradient and morphology.",
            "Rheumatic fever is common history."
        ],
        "hint_fa": "سوفل دیاستولیک کجا شنیده می‌شود: قاعده یا اپکس؟",
        "hint_en": "Where is diastolic murmur heard: base or apex?",
        "attending_fa": "استاد: اپکس را با بل بشنو؛ رامبل یعنی تنگی میترال.",
        "attending_en": "Attending: Hear apex with bell; rumble means MS."
    },
    (1,62): {
        "interpretation_fa": "مرد ۵۶ ساله با درد شدید قفسه سینه، فشار ۶۰، ورید ژوگولر بالا که با دم پایین نمی‌آید و ریه‌های پاک، انفارکتوس بطن راست را مطرح می‌کند. بطن راست به پیش‌بار وابسته است؛ افت فشار با ورید بالا و ریه پاک سه‌گانه کلاسیک است. مورفین، نیترو و بتا فشار را بدتر می‌کنند و مایع محتاط کمک می‌کند. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور بر پایه ریسک آمده است.",
        "interpretation_en": "A 56-year-old with severe chest pain, BP 60, high jugular that does not fall with inspiration and clear lungs suggests RV infarction. RV is preload-dependent; hypotension with high jugular and clear lungs is classic triad. Morphine, nitro and beta worsen pressure and cautious fluids help.",
        "reasons_fa": [
            "دلیل رد گزینه: مورفین ورید را گشاد و فشار را بدتر می‌کند.",
            "دلیل رد گزینه: نیترو پیش‌بار را کم و فشار را می‌اندازد.",
            "دلیل رد گزینه: بتا در شوک با فشار ۶۰ مناسب نیست.",
            "گزینه صحیح: مایع وریدی محتاط پیش‌بار بطن راست را تامین می‌کند."
        ],
        "reasons_en": [
            "Why incorrect: Morphine dilates veins and worsens pressure.",
            "Why incorrect: Nitro reduces preload and drops pressure.",
            "Why incorrect: Beta in shock with 60 not suitable.",
            "Correct: Cautious IV fluids supply RV preload."
        ],
        "lead_fa": "افت فشار + ورید بالا + ریه پاک یعنی بطن راست.",
        "lead_en": "Hypotension + high jugular + clear lungs means RV.",
        "golden_fa": "در بطن راست، نیترو و مورفین را نگه دار.",
        "golden_en": "In RV, hold nitro and morphine.",
        "points_fa": [
            "لید وی چهار راست کمک می‌کند.",
            "اکو حرکت بطن راست را نشان می‌دهد.",
            "از دیورتیک پرهیز کن.",
            "بازکردن رگ راست کرونری اولویت است."
        ],
        "points_en": [
            "V4R helps.",
            "Echo shows RV motion.",
            "Avoid diuretic.",
            "Opening RCA is priority."
        ],
        "hint_fa": "وقتی ورید پر و ریه پاک است، چه بدهی و چه ندهی؟",
        "hint_en": "When vein full and lungs clear, what to give or hold?",
        "attending_fa": "استاد: بطن راست تشنه است؛ نیترو را ببند.",
        "attending_en": "Attending: RV is thirsty; clamp nitro."
    },
    (1,63): {
        "interpretation_fa": "زن ۶۰ ساله با فشار ۲۲۰ روی ۱۳۰ و ادم پاپی، اورژانس پرفشاری با آسیب اندام دارد. ادم پاپی نشانه فشار داخل جمجمه از انسفالوپاتی پرفشاری است و کاهش سریع فشار خطر ایسکمی مغز و قلب را دارد. کاهش تدریجی با داروی وریدی قابل تیتر و پایش مداوم هدف است، نه افت شتاب‌زده به ۱۲۰ روی ۸۰. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور بر پایه ریسک آمده است.",
        "interpretation_en": "A 60-year-old woman with 220/130 and papilledema has hypertensive emergency with organ injury. Papilledema marks intracranial pressure from hypertensive encephalopathy and rapid drop risks brain and heart ischemia. Gradual reduction with titratable IV and monitoring is goal, not abrupt fall to 120/80.",
        "reasons_fa": [
            "دلیل رد گزینه: دو داروی خوراکی با ویزیت فردا در ادم پاپی ناامن است.",
            "دلیل رد گزینه: نیتروگلیسیرین وریدی با کاهش کنترل‌شده از دید بالینی مناسب است، ولی کلید رسمی گزینه دیگری را انتخاب کرده است.",
            "گزینه صحیح: بر اساس کلید رسمی، کاهش فشار به ۱۲۰/۸۰ طی ۲ ساعت به عنوان پاسخ صحیح علامت‌گذاری شده است؛ تفسیر آموزشی یادآور می‌شود که افت شتاب‌زده خطر ایسکمی دارد.",
            "دلیل رد گزینه: نیفدیپین زیرزبانی افت غیرقابل پیش‌بینی می‌دهد."
        ],
        "reasons_en": [
            "Why incorrect: Two oral drugs with next-day visit unsafe in papilledema.",
            "Why incorrect: IV nitroglycerin with controlled reduction is clinically suitable, but the official key selected another option.",
            "Correct: Per the official key, reduction to 120/80 in 2 hours is marked correct; educationally, abrupt fall risks ischemia.",
            "Why incorrect: Sublingual nifedipine gives unpredictable drop."
        ],
        "lead_fa": "فشار ۲۲۰ با ادم پاپی یعنی اورژانس؛ آهسته و وریدی پایین بیاور.",
        "lead_en": "220 with papilledema means emergency; lower slowly IV.",
        "golden_fa": "در اورژانس، ۱۰ تا ۲۰ درصد ساعت اول کافی است.",
        "golden_en": "In emergency, 10-20% in first hour is enough.",
        "points_fa": [
            "ادم پاپی را با افتالموسکوپ ببین.",
            "سدیم نیتروپروساید هم گزینه وریدی است.",
            "از نیفدیپین زیرزبانی پرهیز کن.",
            "علت ثانویه را بعداً بررسی کن."
        ],
        "points_en": [
            "See papilledema with ophthalmoscope.",
            "Nitroprusside is another IV option.",
            "Avoid sublingual nifedipine.",
            "Work up secondary cause later."
        ],
        "hint_fa": "با ادم پاپی، افت سریع خوب است یا آهسته؟",
        "hint_en": "With papilledema, is rapid fall good or slow?",
        "attending_fa": "استاد: چشم را ببین؛ ادم پاپی اورژانس است.",
        "attending_en": "Attending: Look at eye; papilledema is emergency."
    },
    (1,64): {
        "interpretation_fa": "جوان ۱۸ ساله ورزشکار با درد خنجری رترواسترنال که با نفس و خوابیدن بدتر می‌شود و سابقه سرماخوردگی دو هفته قبل، پریکاردیت حاد را مطرح می‌کند. درد پریکارد وضعیتی و پلورتیک است و با نشستن به جلو آرام می‌شود. نوار قلب صعود منتشر مقعر اس‌تی با افت پی‌آر دارد و اکو افیوژن را رد یا تایید می‌کند.",
        "interpretation_en": "An 18-year-old athlete with stabbing retrosternal pain worsened by breathing and lying and prior cold two weeks ago suggests acute pericarditis. Pericardial pain is positional and pleuritic, eased sitting forward. ECG shows diffuse concave ST elevation with PR depression and echo rules effusion.",
        "reasons_fa": [
            "دلیل رد گزینه: آمبولی درد پلورتیک با تپش و تاکی‌کاردی می‌دهد نه درد وضعیتی خنجری.",
            "گزینه صحیح: درد خنجری وضعیتی با سرماخوردگی اخیر پریکاردیت است.",
            "دلیل رد گزینه: انفارکتوس در ۱۸ ساله ورزشکار با درد تنفسی نادر است.",
            "دلیل رد گزینه: پارگی آئورت درد پاره‌کننده با اختلاف نبض است."
        ],
        "reasons_en": [
            "Why incorrect: Embolism gives pleuritic pain with tachycardia not positional stabbing.",
            "Correct: Positional stabbing pain with recent cold is pericarditis.",
            "Why incorrect: Infarction in 18-year-old athlete with respiratory pain rare.",
            "Why incorrect: Aortic dissection gives tearing pain with pulse gap."
        ],
        "lead_fa": "درد خنجری وضعیتی که با دم و خواب بدتر می‌شود یعنی پریکارد.",
        "lead_en": "Stabbing positional pain worsened by breathing and lying means pericardium.",
        "golden_fa": "پریکاردیت را با نوار و اکو و سابقه ویروسی بشناس.",
        "golden_en": "Recognize pericarditis with ECG, echo and viral history.",
        "points_fa": [
            "اصطکاک پریکارد در سمع کمک می‌کند.",
            "استاتین در پریکاردیت حاد جایی ندارد.",
            "فعالیت سنگین را مدتی پرهیز بده.",
            "کلشیسین عود را کم می‌کند."
        ],
        "points_en": [
            "Pericardial friction rub helps auscultation.",
            "Statin has no role in acute pericarditis.",
            "Avoid strenuous activity for a while.",
            "Colchicine reduces recurrence."
        ],
        "hint_fa": "کدام درد با بالش بیشتر می‌شود و با نشستن کم؟",
        "hint_en": "Which pain worsens with pillow and eases sitting?",
        "attending_fa": "استاد: درد را با وضعیت بسنج؛ پریکارد با بالش بدتر است.",
        "attending_en": "Attending: Judge pain by position; pericardium worsens with pillow."
    },
    (1,65): {
        "interpretation_fa": "تظاهرات نارسایی شامل تنگی‌نفس فعالیتی، ارتوپنه، حمله‌ای شبانه یک تا سه ساعت پس از خواب، ادم و خستگی است. ادرار شبانه از بهبود پرفیوژن کلیه در خواب می‌آید. تنفس شین‌استوک از نوسان حساسیت مرکز تنفس به دی‌اکسید کربن است نه اکسیژن. با شروع نارسایی راست، فشار ورید بالا احتقان ریه را کم و تنگی‌نفس حمله‌ای را کمتر می‌کند نه بیشتر.",
        "interpretation_en": "Heart failure manifestations include exertional dyspnea, orthopnea, paroxysmal nocturnal 1-3 hours after sleep, edema and fatigue. Nocturia from improved kidney perfusion in recumbency. Cheyne-Stokes from oscillation of central sensitivity to CO2 not O2. With onset of right failure, high venous pressure lessens pulmonary congestion and paroxysmal dyspnea decreases, not increases.",
        "reasons_fa": [
            "دلیل رد گزینه: ادرار شبانه در نارسایی شایع است و گزینه درستی است.",
            "دلیل رد گزینه: حمله شبانه یک تا سه ساعت پس از خواب درست است.",
            "دلیل رد گزینه: تنفس شین‌استوک از نوسان حساسیت به دی‌اکسید کربن است و این گزاره درست است.",
            "گزینه صحیح: با شروع نارسایی راست، حملات تنگی نفس افزایش می‌یابد — این گزاره غلط است و به همین دلیل پاسخ «غلط است» همین است؛ در واقع نارسایی راست احتقان ریه را کم و تنگی حمله‌ای را کمتر می‌کند."
        ],
        "reasons_en": [
            "Why incorrect: Nocturia is common and this statement is correct.",
            "Why incorrect: Nocturnal attack 1-3 hours after sleep is correct.",
            "Why incorrect: Cheyne-Stokes from CO2 oscillation is correct.",
            "Correct: With onset of right failure, dyspnea attacks increase — this statement is false and thus the 'incorrect' answer; actually RV failure unloads lungs and lessens attacks."
        ],
        "lead_fa": "شین‌استوک یعنی مرکز تنفس به دی‌اکسید کربن حساس نوسانی دارد.",
        "lead_en": "Cheyne-Stokes means breathing center has oscillatory CO2 sensitivity.",
        "golden_fa": "نارسایی راست، ریه را از آب کم می‌کند و تنگی حمله‌ای را کم می‌کند.",
        "golden_en": "RV failure unloads lungs and lessens paroxysmal dyspnea.",
        "points_fa": [
            "ارتوپنه را با تعداد بالش بسنج.",
            "ادم را با وزن روزانه پایش کن.",
            "خستگی از برون‌ده کم است.",
            "سرفه شبانه هم از احتقان است."
        ],
        "points_en": [
            "Gauge orthopnea by pillows.",
            "Monitor edema by daily weight.",
            "Fatigue from low output.",
            "Nocturnal cough also from congestion."
        ],
        "hint_fa": "مرکز تنفس به کدام گاز نوسانی حساس می‌شود؟",
        "hint_en": "Which gas makes breathing center oscillate?",
        "attending_fa": "استاد: شین‌استوک را دی‌اکسید کربنی ببین نه اکسیژنی.",
        "attending_en": "Attending: See Cheyne-Stokes as CO2-driven."
    },
    (1,66): {
        "interpretation_fa": "آنژین پایدار درد فشاری رترواسترنال با فعالیت و استرس می‌آید و با استراحت می‌رود. با وجود ارزش نوار قلب و تست ورزش، شرح حالِ دقیقِ الگوی درد مهم‌ترین ابزار تشخیص است و احتمال پیش‌آزمون را تعیین می‌کند. سمع قلب در آنژین پایدار اغلب طبیعی است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور بر پایه ریسک آمده است.",
        "interpretation_en": "Stable angina is retrosternal pressure with exertion and stress, relieved by rest. Despite ECG and exercise test value, detailed history of pain pattern is the most important diagnostic tool and sets pretest probability. Cardiac auscultation is often normal in stable angina.",
        "reasons_fa": [
            "دلیل رد گزینه: نوار قلب در آنژین پایدار اغلب طبیعی است.",
            "گزینه صحیح: شرح حال الگوی درد مهم‌ترین است.",
            "دلیل رد گزینه: سمع در آنژین پایدار کم‌اهمیت است.",
            "دلیل رد گزینه: تست ورزش پس از شرح حال می‌آید."
        ],
        "reasons_en": [
            "Why incorrect: ECG often normal in stable angina.",
            "Correct: History of pain pattern is most important.",
            "Why incorrect: Auscultation low yield in stable angina.",
            "Why incorrect: Exercise test comes after history."
        ],
        "lead_fa": "آنژین را با داستان درد بشناس نه با نوار تنها.",
        "lead_en": "Know angina by pain story not ECG alone.",
        "golden_fa": "الگوی فعالیتی-استراحتی را دقیق بپرس.",
        "golden_en": "Ask exertional-rest pattern precisely.",
        "points_fa": [
            "ریسک‌فاکتورها احتمال را بالا می‌برد.",
            "نوار طبیعی آنژین را رد نمی‌کند.",
            "تست ورزش برای تایید پس از شرح حال است.",
            "آنژین ناپایدار الگوی متفاوت دارد."
        ],
        "points_en": [
            "Risk factors raise probability.",
            "Normal ECG does not exclude angina.",
            "Exercise test confirms after history.",
            "Unstable angina has different pattern."
        ],
        "hint_fa": "کدام ابزار داستان درد را می‌گوید؟",
        "hint_en": "Which tool tells pain story?",
        "attending_fa": "استاد: آنژین را با گوش بشنو نه با دستگاه.",
        "attending_en": "Attending: Hear angina with ear not machine."
    },
    (1,67): {
        "interpretation_fa": "دوگانگی ثابت صدای دوم در لبه فوقانی چپ جناغ در نوجوان، نقص دیواره دهلیزی را مطرح می‌کند. در نقص دهلیزی جریان ریوی زیاد و تاخیر بطن راست ثابت است و شکاف با تنفس تغییر نمی‌کند. نقص بطنی شکاف طبیعی دارد و بلوک شاخه چپ و راست الگوی شکاف متفاوت می‌دهند. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور بر پایه ریسک آمده است.",
        "interpretation_en": "Fixed splitting of S2 at left upper sternal border in teen suggests atrial septal defect. In ASD pulmonary flow large and RV delay fixed, split does not vary with breathing. VSD has normal split and left and right bundle blocks give different patterns.",
        "reasons_fa": [
            "دلیل رد گزینه: نقص بطنی شکاف ثابت نمی‌دهد.",
            "گزینه صحیح: نقص دهلیزی دوگانگی ثابت می‌دهد.",
            "دلیل رد گزینه: بلوک چپ شکاف معکوس می‌دهد.",
            "دلیل رد گزینه: بلوک راست شکاف وسیع می‌دهد نه ثابت."
        ],
        "reasons_en": [
            "Why incorrect: VSD does not give fixed splitting.",
            "Correct: ASD gives fixed splitting.",
            "Why incorrect: Left block gives reversed splitting.",
            "Why incorrect: Right block gives wide not fixed."
        ],
        "lead_fa": "دوگانگی ثابت یعنی نقص دهلیزی.",
        "lead_en": "Fixed splitting means ASD.",
        "golden_fa": "در نوجوان با دوگانگی ثابت، اکو را بگیر.",
        "golden_en": "In teen with fixed split, get echo.",
        "points_fa": [
            "اکو شانت و فشار ریوی را می‌سنجد.",
            "سوفل جریان ریوی در لبه چپ شنیده می‌شود.",
            "بستن به موقع از نارسایی جلوگیری می‌کند.",
            "نوار قلب تاخیر راست را نشان می‌دهد."
        ],
        "points_en": [
            "Echo measures shunt and pulmonary pressure.",
            "Pulmonary flow murmur heard at left border.",
            "Timely closure prevents failure.",
            "ECG shows right delay."
        ],
        "hint_fa": "کدام سوراخ، شکاف را با نفس ثابت نگه می‌دارد؟",
        "hint_en": "Which hole keeps split fixed with breathing?",
        "attending_fa": "استاد: دوگانگی ثابت را دهلیزی ببین.",
        "attending_en": "Attending: See fixed split as atrial."
    },
    (1,68): {
        "interpretation_fa": "زن ۶۰ ساله با درد و تنگی‌نفس فعالیتی، سوفل چهار از شش در لبه فوقانی راست با انتشار به کاروتید و نبض کاروتید کم‌دامنه، تنگی شدید آئورت است. سوفل خشن جهشی با انتشار به گردن و نبض کند مشخصه است و نارسایی میترال سوفل هولوسیستولیک اپکس می‌دهد. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور بر پایه ریسک آمده است.",
        "interpretation_en": "A 60-year-old woman with chest pain and exertional dyspnea, grade 4/6 murmur at right upper sternal border radiating to carotids and low-amplitude carotid pulse is severe aortic stenosis. Harsh ejection murmur to neck and slow pulse are characteristic and MR gives holosystolic apex murmur.",
        "reasons_fa": [
            "دلیل رد گزینه: نارسایی میترال سوفل هولوسیستولیک اپکس است.",
            "دلیل رد گزینه: هیپرتروفیک انسدادی سوفل با والسالوا بیشتر می‌شود.",
            "گزینه صحیح: تنگی شدید آئورت سوفل جهشی به کاروتید با نبض کم‌دامنه است.",
            "دلیل رد گزینه: نارسایی شدید آئورت نبض جهنده می‌دهد."
        ],
        "reasons_en": [
            "Why incorrect: MR is holosystolic at apex.",
            "Why incorrect: HCM murmur augments with Valsalva.",
            "Correct: Severe AS is ejection murmur to carotids with low pulse.",
            "Why incorrect: Severe AR gives bounding pulse."
        ],
        "lead_fa": "سوفل راست بالا به کاروتید + نبض کم یعنی تنگی شدید آئورت.",
        "lead_en": "Right upper murmur to carotids + low pulse means severe AS.",
        "golden_fa": "اکو شدت را با سرعت جت می‌سنجد.",
        "golden_en": "Echo grades with jet velocity.",
        "points_fa": [
            "سن شایع‌ترین علت دژنراتیو است.",
            "سنکوپ فعالیتی هشدار است.",
            "در علامت‌دار، تعویض لازم است.",
            "نارسایی آئورت نبض جهنده دارد."
        ],
        "points_en": [
            "Age most common degenerative cause.",
            "Exertional syncope is warning.",
            "Symptomatic needs replacement.",
            "AR has bounding pulse."
        ],
        "hint_fa": "سوفل به گردن و نبض کم به کدام دریچه می‌خورد؟",
        "hint_en": "Murmur to neck and low pulse fits which valve?",
        "attending_fa": "استاد: کاروتید کم را با سوفل راست بخوان.",
        "attending_en": "Attending: Read low carotid with right murmur."
    },
    (1,69): {
        "interpretation_fa": "مرد ۵۰ ساله با تنگی‌نفس فعالیتی چندماهه، تب یک ماهه مقاوم به آنتی‌بیوتیک، فشار نبض وسیع ۱۶۰ روی ۶۰، سوفل دیاستولیک آئورت و نبض جهنده، آندوکاردیت با نارسایی حاد آئورت را مطرح می‌کند. تب طولانی با سوفل جدید و فشار نبض وسیع نشانه تخریب حاد دریچه است و اکو پوشش گیاهی و شدت نشت را نشان می‌دهد.",
        "interpretation_en": "A 50-year-old with months of exertional dyspnea, one-month fever resistant to antibiotics, wide pulse pressure 160/60, aortic diastolic murmur and bounding pulse suggests endocarditis with acute AR. Prolonged fever with new murmur and wide pulse pressure marks acute valve destruction and echo shows vegetation and leak severity.",
        "reasons_fa": [
            "دلیل رد گزینه: تنگی آئورت فشار نبض وسیع و جهنده نمی‌دهد.",
            "گزینه صحیح: بر اساس کلید رسمی، نارسایی مزمن آئورت همراه آندوکاردیت به عنوان پاسخ صحیح علامت‌گذاری شده است؛ تفسیر آموزشی یادآور می‌شود که تب طولانی با نبض جهنده تخریب دریچه را می‌رساند و افتراق حاد/مزمن با اکو و سیر بالینی است.",
            "دلیل رد گزینه: آندوکاردیت با نارسایی حاد نیز تب و نبض جهنده می‌دهد ولی کلید رسمی گزینه مزمن را برگزیده است.",
            "دلیل رد گزینه: میترال نبض جهنده و سوفل آئورت نمی‌دهد."
        ],
        "reasons_en": [
            "Why incorrect: AS does not give wide bounding pulse.",
            "Correct: Per official key, chronic AR with endocarditis is marked correct; educationally, prolonged fever with bounding pulse indicates valve destruction and acute vs chronic is judged by echo and course.",
            "Why incorrect: Acute AR with endocarditis also gives fever and bounding pulse, but the official key selected chronic.",
            "Why incorrect: Mitral does not give bounding pulse and aortic murmur."
        ],
        "lead_fa": "تب طولانی + سوفل آئورت جدید + نبض جهنده یعنی آندوکاردیت حاد.",
        "lead_en": "Prolonged fever + new aortic murmur + bounding pulse means acute endocarditis.",
        "golden_fa": "کشت خون قبل از آنتی‌بیوتیک و اکو فوری بگیر.",
        "golden_en": "Get blood cultures before antibiotics and urgent echo.",
        "points_fa": [
            "فشار نبض وسیع از نشت حاد است.",
            "آمبولی و نارسایی عوارض خطرناکند.",
            "جراحی در تخریب شدید مطرح است.",
            "پیشگیری دهان و دندان مهم است."
        ],
        "points_en": [
            "Wide pulse pressure from acute leak.",
            "Embolism and failure are dangerous complications.",
            "Surgery considered in severe destruction.",
            "Dental prevention important."
        ],
        "hint_fa": "تب مقاوم با نبض جهنده کدام دریچه را خراب کرده؟",
        "hint_en": "Resistant fever with bounding pulse ruined which valve?",
        "attending_fa": "استاد: تب + سوفل جدید را آندوکاردیت ببین.",
        "attending_en": "Attending: View fever + new murmur as endocarditis."
    },
    (1,70): {
        "interpretation_fa": "زن ۶۲ ساله با بیماری مزمن کلیه دیابتی و توصیه دیالیز از چهار ماه قبل و صعود منتشر اس‌تی در تمام لیدها، پریکاردیت اورمیک را مطرح می‌کند. نارسایی کلیه اوره بالا پریکارد را ملتهب و اس‌تی منتشر مقعر می‌دهد. میوکاردیت، هیپرکالمی و انفارکتوس الگوی متفاوت دارند و دیالیز درمان اصلی است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور بر پایه ریسک آمده است.",
        "interpretation_en": "A 62-year-old woman with diabetic CKD and dialysis advised four months ago and diffuse ST elevation in all leads suggests uremic pericarditis. Renal failure with high urea inflames pericardium and gives diffuse concave ST. Myocarditis, hyperkalemia and infarction have different patterns and dialysis is main therapy.",
        "reasons_fa": [
            "دلیل رد گزینه: میوکاردیت بیشتر با اختلال عملکرد موضعی است.",
            "دلیل رد گزینه: هیپرکالمی موج بلند نوک‌تیز می‌دهد.",
            "دلیل رد گزینه: انفارکتوس صعود موضعی می‌دهد نه منتشر.",
            "گزینه صحیح: پریکاردیت اورمیک با اس‌تی منتشر در نارسایی کلیه مطرح است."
        ],
        "reasons_en": [
            "Why incorrect: Myocarditis more with regional dysfunction.",
            "Why incorrect: Hyperkalemia gives tall peaked T.",
            "Why incorrect: Infarction gives territorial elevation not diffuse.",
            "Correct: Uremic pericarditis with diffuse ST in renal failure is suggested."
        ],
        "lead_fa": "نارسایی کلیه + اس‌تی منتشر یعنی پریکاردیت اورمیک.",
        "lead_en": "Renal failure + diffuse ST means uremic pericarditis.",
        "golden_fa": "دیالیز را به تاخیر نینداز.",
        "golden_en": "Don't delay dialysis.",
        "points_fa": [
            "اصطکاک پریکارد کمک می‌کند.",
            "اکو افیوژن را می‌بیند.",
            "ضدالتهاب در اورمیک کم‌اثر است.",
            "پتاسیم را هم چک کن."
        ],
        "points_en": [
            "Friction rub helps.",
            "Echo sees effusion.",
            "Anti-inflammatory less effective in uremic.",
            "Check potassium too."
        ],
        "hint_fa": "کلیه نارس با کدام التهاب قلب همراه است؟",
        "hint_en": "Which heart inflammation goes with failing kidney?",
        "attending_fa": "استاد: اس‌تی منتشر در دیالیزی را پریکارد ببین.",
        "attending_en": "Attending: View diffuse ST in dialysis as pericardium."
    },
    (1,71): {
        "interpretation_fa": "اصلاح شیوه زندگی در پرفشاری شامل کاهش نمک به کمتر از شش گرم، کاهش وزن تا نمایه زیر ۲۵، رژیم سرشار از میوه و سبزی و کم‌چرب و ورزش هوازی منظم است. توصیه ورزش ۳۰ دقیقه در بیشتر روزهای هفته است و ۲۰ دقیقه در پنج روز حداقلِ ناکافی تلقی می‌شود و به عنوان گزینه غلط آمده است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور بر پایه ریسک آمده است.",
        "interpretation_en": "Lifestyle in hypertension includes salt <6 g, weight to BMI <25, fruit/vegetable rich low-fat diet and regular aerobic exercise. Recommendation is 30 minutes on most days and 20 minutes five days is considered insufficient minimum and is the incorrect option.",
        "reasons_fa": [
            "دلیل رد گزینه: کاهش نمک کمتر از شش گرم درست است.",
            "دلیل رد گزینه: کاهش وزن تا نمایه زیر ۲۵ درست است.",
            "دلیل رد گزینه: رژیم میوه و سبزی درست است.",
            "گزینه صحیح: ورزش بیست دقیقه پنج روز ناکافی و غلط است."
        ],
        "reasons_en": [
            "Why incorrect: Salt <6 g correct.",
            "Why incorrect: Weight to BMI <25 correct.",
            "Why incorrect: Fruit/vegetable diet correct.",
            "Correct: 20 min five days is insufficient and incorrect."
        ],
        "lead_fa": "ورزش هوازی ۳۰ دقیقه در بیشتر روزها هدف است.",
        "lead_en": "Aerobic 30 min on most days is goal.",
        "golden_fa": "پیاده‌روی تند را هر روز بساز.",
        "golden_en": "Build brisk walking daily.",
        "points_fa": [
            "نمک پنهان نان و پنیر را کم کن.",
            "الکل را محدود کن.",
            "سیگار را قطع کن.",
            "خواب و استرس را تنظیم کن."
        ],
        "points_en": [
            "Cut hidden salt in bread and cheese.",
            "Limit alcohol.",
            "Stop smoking.",
            "Regulate sleep and stress."
        ],
        "hint_fa": "ورزش پرفشاری چند دقیقه می‌خواهد؟",
        "hint_en": "How many minutes does hypertensive exercise need?",
        "attending_fa": "استاد: ورزش را سی دقیقه‌ای تجویز کن.",
        "attending_en": "Attending: Prescribe 30-minute exercise."
    },
    (1,72): {
        "interpretation_fa": "انفارکتوس با صعود اس‌تی در دو، سه، آوی‌اف و آوی‌ال و یک اینفرو‌لترال، قلمرو سیرکومفلکس را نشان می‌دهد. سیرکومفلکس دیواره لترال را خون می‌دهد و صعود در یک و آوی‌ال همراه تحتانی به نفع آن است. قدامی نزولی قدامی، راست تحتانی خالص می‌دهد. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور بر پایه ریسک آمده است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور بر پایه ریسک آمده است.",
        "interpretation_en": "Infarction with ST elevation in II, III, aVF and aVL and I inferolateral shows circumflex territory. Circumflex supplies lateral wall and elevation in I and aVL with inferior favors it. LAD is anterior, RCA pure inferior.",
        "reasons_fa": [
            "دلیل رد گزینه: قدامی نزولی قدامی می‌دهد.",
            "گزینه صحیح: سیرکومفلکس اینفرو‌لترال می‌دهد.",
            "دلیل رد گزینه: راست تحتانی خالص می‌دهد.",
            "دلیل رد گزینه: مارژینال چپ شاخه سیرکومفلکس است."
        ],
        "reasons_en": [
            "Why incorrect: LAD gives anterior.",
            "Correct: Circumflex gives inferolateral.",
            "Why incorrect: RCA gives pure inferior.",
            "Why incorrect: Left marginal is branch of circumflex."
        ],
        "lead_fa": "تحتانی + لترال یعنی سیرکومفلکس.",
        "lead_en": "Inferior + lateral means circumflex.",
        "golden_fa": "آناتومی را با نوار لترال بسنج.",
        "golden_en": "Judge anatomy with lateral ECG.",
        "points_fa": [
            "آوی‌آر بطن راست را نشان می‌دهد.",
            "اکو حرکت لترال را می‌بیند.",
            "سیرکومفلکس میترال را هم درگیر می‌کند.",
            "بازکردن سریع پیش‌آگهی را بهتر می‌کند."
        ],
        "points_en": [
            "V4R shows RV.",
            "Echo sees lateral motion.",
            "Circumflex also involves mitral.",
            "Early opening improves prognosis."
        ],
        "hint_fa": "لترال با تحتانی کدام رگ است؟",
        "hint_en": "Which vessel is lateral with inferior?",
        "attending_fa": "استاد: یک و آوی‌ال را در تحتانی ببین.",
        "attending_en": "Attending: Look at I and aVL in inferior."
    },
    (1,73): {
        "interpretation_fa": "سوفل گراهام استیل سوفل دیاستولیک نارسایی پولمونر از فشار بالای پولمونر در زمینه تنگی مزمن میترال است. فشار بالای ریوی دریچه پولمونر را نارسا و سوفل دیاستولیک در لبه فوقانی چپ می‌سازد و با شدت فشار ریوی مرتبط است. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور بر پایه ریسک آمده است.",
        "interpretation_en": "Graham Steell murmur is diastolic murmur of pulmonic regurgitation from high pulmonary pressure in chronic mitral stenosis. High pulmonary pressure makes pulmonic valve regurgitant and creates diastolic murmur at left upper border, related to pressure severity.",
        "reasons_fa": [
            "دلیل رد گزینه: هولوسیستولیک نیست دیاستولیک است.",
            "گزینه صحیح: نارسایی پولمونر از فشار بالای پولمونر در تنگی مزمن میترال است.",
            "دلیل رد گزینه: سه‌لتی نیست پولمونر است.",
            "دلیل رد گزینه: همراه آئورت شایع نیست."
        ],
        "reasons_en": [
            "Why incorrect: Not holosystolic but diastolic.",
            "Correct: Pulmonic regurgitation from high pulmonary pressure in chronic MS.",
            "Why incorrect: Not tricuspid but pulmonic.",
            "Why incorrect: Not commonly with AR."
        ],
        "lead_fa": "گراهام استیل یعنی نارسایی پولمونر از فشار ریوی تنگی میترال.",
        "lead_en": "Graham Steell means PR from pulmonary hypertension of MS.",
        "golden_fa": "سوفل دیاستولیک لبه بالا را در میترال بشنو.",
        "golden_en": "Hear upper border diastolic murmur in mitral.",
        "points_fa": [
            "فشار ریوی را با اکو بسنج.",
            "سوفل با دم بیشتر می‌شود.",
            "درمان تنگی میترال فشار را کم می‌کند.",
            "از هولوسیستولیک افتراق بده."
        ],
        "points_en": [
            "Gauge pulmonary pressure with echo.",
            "Murmur augments with inspiration.",
            "Treating MS lowers pressure.",
            "Differentiate from holosystolic."
        ],
        "hint_fa": "نارسایی کدام دریچه از فشار ریه می‌آید؟",
        "hint_en": "Which valve leak comes from lung pressure?",
        "attending_fa": "استاد: گراهام را با فشار ریه بخوان.",
        "attending_en": "Attending: Read Graham with lung pressure."
    },
    (1,74): {
        "interpretation_fa": "تب روماتیسمی حمله راجعه در فرد با سابقه درگیری قلبی ثابت‌شده معیارهای کمتری می‌خواهد. یک معیار اصلی به همراه دو فرعی یا دو اصلی کافی است. آرترالژی به عنوان فرعی و تب به عنوان فرعی با هم کافی نیستند و کشت مثبت به تنهایی معیار نیست. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور بر پایه ریسک آمده است.",
        "interpretation_en": "Rheumatic fever recurrence in person with prior proven carditis needs fewer criteria. One major plus two minor or two majors suffice. Arthralgia as minor and fever as minor together insufficient and positive culture alone not criterion.",
        "reasons_fa": [
            "دلیل رد گزینه: آرترالژی به تنهایی برای راجعه ناکافی است ولی کلید رسمی گزینه دیگری را انتخاب کرده است.",
            "دلیل رد گزینه: آرترالژی+تب+کاردیت بیش از حداقل است و گزینه درستی است.",
            "دلیل رد گزینه: کشت مثبت+کاردیت+آرتریت بیش از حداقل است.",
            "گزینه صحیح: بر اساس کلید رسمی، تب + رسوب بالا + سابقه مخملک اخیر به عنوان پاسخ صحیح علامت‌گذاری شده است؛ تفسیر آموزشی یادآور می‌شود که جونز با سابقه قلبی یک اصلی+دو فرعی کافی است."
        ],
        "reasons_en": [
            "Why incorrect: Arthralgia alone insufficient but the official key selected another option.",
            "Why incorrect: Arthralgia+fever+carditis more than minimum and is correct.",
            "Why incorrect: Positive culture+carditis+arthritis more than minimum.",
            "Correct: Per official key, fever + high ESR + recent scarlet fever is marked correct; educationally, Jones with prior heart needs one major+two minor."
        ],
        "lead_fa": "راجعه با سابقه قلبی یک اصلی+دو فرعی کافی است.",
        "lead_en": "Recurrence with cardiac history needs one major+two minor.",
        "golden_fa": "جونز را با سابقه قلبی سبک‌تر بگیر.",
        "golden_en": "Take Jones lighter with cardiac history.",
        "points_fa": [
            "کاردیت، آرتریت، کره، ندول و اریتم حاشیه‌ای اصلی‌اند.",
            "تب و رسوب فرعی‌اند.",
            "شواهد استرپت اخیر لازم است.",
            "پروفیلاکسی را ادامه بده."
        ],
        "points_en": [
            "Carditis, arthritis, chorea, nodule, marginatum are majors.",
            "Fever and ESR are minors.",
            "Evidence of recent strep needed.",
            "Continue prophylaxis."
        ],
        "hint_fa": "راجعه با قلب قبلی چند معیار می‌خواهد؟",
        "hint_en": "How many criteria for recurrence with prior heart?",
        "attending_fa": "استاد: جونز را با قلب قبلی سبک بگیر.",
        "attending_en": "Attending: Lighten Jones with prior heart."
    },
    (1,75): {
        "interpretation_fa": "مرد ۴۶ ساله با درد قفسه سینه منتشر به کتف چپ از ۲۰ روز، معاینه طبیعی، نوار طبیعی و تروپونین منفی، درد عضلانی اسکلتی محتمل‌تر از قلب است. درد طولانی بدون تغییر نوار و نشانگر، با منشا سایکولوژیک یا ریوی کمتر جور است و معاینه عضلانی با فشار حساس می‌شود. این نکته در هاریسون با تاکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور بر پایه ریسک آمده است.",
        "interpretation_en": "A 46-year-old with chest pain radiating to left scapula for 20 days, normal exam, normal ECG and negative troponin, musculoskeletal pain more likely than cardiac. Prolonged pain without ECG/marker change less fits psych or pulmonary and musculoskeletal exam tender on pressure.",
        "reasons_fa": [
            "دلیل رد گزینه: درد طولانی با نوار و تروپونین طبیعی از دید بالینی بیشتر عضلانی است، ولی کلید رسمی گزینه دیگری را برگزیده است.",
            "دلیل رد گزینه: سایکولوژیک بدون سرنخ روان کمتر محتمل است.",
            "گزینه صحیح: بر اساس کلید رسمی، اختلالات مروی به عنوان پاسخ صحیح علامت‌گذاری شده است؛ تفسیر آموزشی یادآور می‌شود که درد طولانی با نوار پاک معمولاً عضلانی است ولی کلید مروی را انتخاب کرده است.",
            "دلیل رد گزینه: ریوی درد با تنفس و تاکی‌پنه می‌دهد."
        ],
        "reasons_en": [
            "Why incorrect: Prolonged pain with normal ECG/troponin is clinically more musculoskeletal, but the official key selected another option.",
            "Why incorrect: Psych without psych clue less likely.",
            "Correct: Per official key, esophageal disorders is marked correct; educationally, prolonged clean pain is often musculoskeletal but the key selected esophageal.",
            "Why incorrect: Pulmonary pain gives breathing and tachypnea."
        ],
        "lead_fa": "درد طولانی با نوار پاک یعنی غیرقلبی؛ عضلانی را ببین.",
        "lead_en": "Prolonged pain with clean ECG means noncardiac; look musculoskeletal.",
        "golden_fa": "معاینه فشار عضله را انجام بده.",
        "golden_en": "Do muscle pressure exam.",
        "points_fa": [
            "سابقه ۲۰ روزه علیه سندرم حاد است.",
            "ریسک‌فاکتور را بسنج.",
            "از تست ورزش بی‌مورد پرهیز کن.",
            "مسکن و فیزیوتراپی کمک می‌کند."
        ],
        "points_en": [
            "20-day history against acute syndrome.",
            "Assess risk factors.",
            "Avoid unwarranted exercise test.",
            "Analgesic and physio help."
        ],
        "hint_fa": "وقتی نوار و آنزیم پاک است، کجا را فشار دهی؟",
        "hint_en": "When ECG and enzymes clean, where to press?",
        "attending_fa": "استاد: درد طولانی پاک را عضلانی ببین.",
        "attending_en": "Attending: View prolonged clean pain as musculoskeletal."
    },
}
OPTIONS_EN_MAP5 = {
    (1,61): ['Mitral stenosis', 'Aortic stenosis', 'Mitral regurgitation', 'Aortic regurgitation'],
    (1,62): ['IV morphine 3 mg', 'IV nitroglycerin', 'Oral beta-blocker', '1 L normal saline'],
    (1,63): ['Two oral drugs, next-day visit', 'IV nitro, slow reduction 12h', 'Drop to 120/80 in 2h IV', 'Sublingual nifedipine/captopril'],
    (1,64): ['Pulmonary embolism', 'Acute pericarditis', 'Myocardial infarction', 'Aortic dissection'],
    (1,65): ['Nocturia common', 'PND 1-3h after sleep', 'Cheyne-Stokes from low O2 sensitivity', 'RV failure increases dyspnea'],
    (1,66): ['ECG', 'History', 'Auscultation', 'Exercise test'],
    (1,67): ['VSD', 'ASD', 'Complete LBBB', 'Complete RBBB'],
    (1,68): ['Mitral regurgitation', 'Obstructive HCM', 'Severe aortic stenosis', 'Severe AR'],
    (1,69): ['Endocarditis on AS', 'Chronic AR + endocarditis', 'Endocarditis + acute AR', 'Endocarditis + MR'],
    (1,70): ['Myocarditis', 'Hyperkalemia', 'Acute infarction', 'Pericarditis'],
    (1,71): ['Salt <6 g', 'Weight to BMI <25', 'Fruit/veg low-fat diet', '20 min x5 exercise'],
    (1,72): ['LAD', 'LCx', 'RCA', 'OM'],
    (1,73): ['Holosystolic', 'PR from high PA in chronic MS', 'Tricuspid', 'With AR'],
    (1,74): ['Arthralgia alone', 'Arthralgia+fever+carditis', 'Positive culture+carditis+arthritis', 'Fever+high ESR+scarlet fever'],
    (1,75): ['Musculoskeletal', 'Psychological', 'Esophageal', 'Pulmonary'],
}
def enrich5():
    assert len(ITEMS)==15
    path = ROOT / f"tools/master-bank/import-payload.master-preint.part{PART:02}.json"
    before = json.loads(path.read_text(encoding="utf-8"))
    after = copy.deepcopy(before)
    for local, q in enumerate(after["questions"], 1):
        item = ITEMS.get((PART, local))
        if item is None:
            continue
        if not q.get("options_en") or len([o for o in q.get("options_en",[]) if str(o).strip()])<4:
            q["options_en"] = OPTIONS_EN_MAP5.get((PART, local), q.get("options_en",[]))
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
        assert len(q["explanation_fa"])>400
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
    print(f"PASS: enriched {len(ITEMS)} heart Q61-75")
if __name__=="__main__":
    enrich5()
