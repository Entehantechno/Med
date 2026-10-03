#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Batch12: part01 Q182-211 (30)"""
import copy, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
PART = 1
ITEMS = {
    (1,182): {
        "interpretation_fa": "زن ۷۲ ساله با تنگی نفس، JVP برجسته و هپاتومگالی، نارسایی راست را مطرح می‌کند. شایع‌ترین علت نارسایی راست، نارسایی چپ و انتقال فشار به گردش ریوی است نه بیماری عروق ریوی اولیه یا پارانشیم یا ایسکمی حاد راست به‌تنهایی. فشار ریوی ثانویه به چپ، شایع‌ترین مسیر است و اکو و بررسی چپ کمک‌کننده است و درمان علت چپ و کنترل حجم اساس است.",
        "interpretation_en": "A 72-year-old with dyspnea, high JVP and hepatomegaly suggests right failure. Most common cause right failure is left failure with pressure transmission to pulmonary circulation not primary pulmonary vascular or parenchymal or acute RV ischemia alone. Secondary pulmonary hypertension to left most common and echo and left evaluation helpful and treating left and volume control base.",
        "reasons_fa": [
            "دلیل رد گزینه: بیماری عروق ریوی علت شایع راست ایزوله نیست.",
            "دلیل رد گزینه: بیماری پارانشیمال علت شایع نیست.",
            "گزینه صحیح: نارسایی چپ شایع‌ترین علت نارسایی راست است.",
            "دلیل رد گزینه: ایسکمی حاد راست علت شایع مزمن نیست."
        ],
        "reasons_en": [
            "Why incorrect: Pulmonary vascular disease not most common cause of right.",
            "Why incorrect: Parenchymal disease not most common.",
            "Correct: Left failure most common cause of right failure.",
            "Why incorrect: Acute RV ischemia not common chronic cause."
        ],
        "lead_fa": "راست نارسا یعنی اول چپ را ببین.",
        "lead_en": "Failing right means see left first.",
        "golden_fa": "چپ شایع‌ترین علت راست است.",
        "golden_en": "Left most common cause of right.",
        "points_fa": ["JVP.", "هپاتومگالی.", "ادم.", "اکو چپ."],
        "points_en": ["JVP.", "Hepatomegaly.", "Edema.", "Echo left."],
        "hint_fa": "کدام بطن راست را خراب می‌کند؟",
        "hint_en": "Which ventricle spoils right?",
        "attending_fa": "استاد: راست را با چپ بسنج.",
        "attending_en": "Attending: Judge right with left."
    },
    (1,183): {
        "interpretation_fa": "مرد ۴۲ ساله با درد ناگهانی شکافنده بین کتف‌ها، اختلاف فشار ۳۰ دو بازو، تاکی‌کاردی ۱۱۰، ویزینگ و نوار طبیعی، دیسکسیون آئورت را مطرح می‌کند نه سندرم کرونری. سریال نوار یا آنژیو کرونری و بتابلوکر تنها بدون تصویر خطرناک است؛ سی‌تی آنژیوگرافی آئورت با کنتراست سریع فلپ و درگیری شاخه‌ها را می‌بیند و قدم تشخیصی ارجح است و کنترل ضربان و فشار پس از تشخیص لازم است.",
        "interpretation_en": "A 42-year-old with sudden tearing pain between scapulae, 30 mm arm difference, tachy 110, wheezing and normal ECG suggests aortic dissection not ACS. Serial ECG or coronary angio and beta alone without imaging risky; CT angiography aorta with contrast quickly sees flap and branch involvement and is preferred diagnostic and rate and pressure control after diagnosis needed.",
        "reasons_fa": [
            "دلیل رد گزینه: سریال نوار در دیسکسیون قدم نیست.",
            "دلیل رد گزینه: بتابلوکر تنها بدون تصویر قدم نیست.",
            "دلیل رد گزینه: آنژیو کرونری در دیسکسیون خطرناک است.",
            "گزینه صحیح: سی‌تی آنژیو آئورت قدم ارجح است."
        ],
        "reasons_en": [
            "Why incorrect: Serial ECG not step in dissection.",
            "Why incorrect: Beta alone without imaging not step.",
            "Why incorrect: Coronary angio dangerous in dissection.",
            "Correct: CT angio aorta preferred step."
        ],
        "lead_fa": "شکافنده بین کتف یعنی سی‌تی آئورت.",
        "lead_en": "Tearing between scapulae means CT aorta.",
        "golden_fa": "اختلاف فشار را قدر بدان.",
        "golden_en": "Value pressure gap.",
        "points_fa": ["دیسکسیون.", "Type A جراحی.", "بتا سپس فشار.", "لیز ممنوع."],
        "points_en": ["Dissection.", "Type A surgery.", "Beta then pressure.", "Lysis forbidden."],
        "hint_fa": "کدام تصویر آئورت را می‌بیند؟",
        "hint_en": "Which imaging sees aorta?",
        "attending_fa": "استاد: شکافنده را سی‌تی کن.",
        "attending_en": "Attending: CT tearing."
    },
    (1,184): {
        "interpretation_fa": "بیمار ۶۵ ساله با تنگی قفسه سینه در فعالیت کمتر از معمول و بدون علامت در استراحت، ظرفیت عملکرد II را دارد که فعالیت معمول محدود ولی استراحت راحت است؛ I بدون محدودیت، III فعالیت کمتر از معمول و IV در استراحت علامت‌دار است. این تقسیم NYHA به تصمیم درمانی و پیش‌آگهی کمک می‌کند و با اکو و تست عملکرد تکمیل می‌شود.",
        "interpretation_en": "A 65-year-old with chest tightness with less-than-usual activity and no rest complaint has functional capacity II where usual activity limited but rest comfortable; I no limitation, III less-than-usual and IV at rest symptomatic. This NYHA helps decision and prognosis and completed with echo and functional test.",
        "reasons_fa": [
            "دلیل رد گزینه: I بدون محدودیت است.",
            "دلیل رد گزینه: II فعالیت معمول محدود است ولی سوال کمتر از معمول می‌گوید.",
            "گزینه صحیح: III فعالیت کمتر از معمول محدود است.",
            "دلیل رد گزینه: IV در استراحت علامت‌دار است."
        ],
        "reasons_en": [
            "Why incorrect: I no limitation.",
            "Why incorrect: II usual limited but question less than usual says.",
            "Correct: III less-than-usual limited.",
            "Why incorrect: IV at rest symptomatic."
        ],
        "lead_fa": "کمتر از معمول یعنی III.",
        "lead_en": "Less than usual means III.",
        "golden_fa": "NYHA را با فعالیت بسنج.",
        "golden_en": "Judge NYHA by activity.",
        "points_fa": ["I.", "II.", "III.", "IV."],
        "points_en": ["I.", "II.", "III.", "IV."],
        "hint_fa": "کمتر از معمول کدام کلاس است؟",
        "hint_en": "Which class less than usual?",
        "attending_fa": "استاد: NYHA را دقیق بگو.",
        "attending_en": "Attending: Say NYHA precise."
    },
    (1,185): {
        "interpretation_fa": "مرد ۶۵ ساله با سنکوپ و سوفل خشن سیستولیک دومین فضای راست و نبض کاهش‌یافته، تنگی آئورت را مطرح می‌کند؛ تنگی با نبض parvus tardus، S2 ضعیف و هیپرتروفی همراه است و سنکوپ فعالیتی از کاهش برون‌ده می‌آید. نارسایی‌ها سوفل هولوسیستولیک و تنگی میترال رامبل دیاستولیک می‌دهد و اکو شدت و گرادیان را می‌سنجد و در شدید علامت‌دار تعویض لازم است.",
        "interpretation_en": "A 65-year-old with syncope and harsh systolic murmur second right space and reduced pulse suggests AS; stenosis with parvus tardus, weak S2 and hypertrophy and exertional syncope from low output. Regurgitations holosystolic and MS diastolic rumble and echo measures severity and gradient and in severe symptomatic replacement needed.",
        "reasons_fa": [
            "گزینه صحیح: تنگی آئورت با سوفل خشن و نبض کم مطرح است.",
            "دلیل رد گزینه: نارسایی آئورت نبض جهنده می‌دهد.",
            "دلیل رد گزینه: نارسایی میترال هولوسیستولیک است.",
            "دلیل رد گزینه: تنگی میترال رامبل دیاستولیک است."
        ],
        "reasons_en": [
            "Correct: AS with harsh murmur and low pulse suggested.",
            "Why incorrect: AR gives bounding pulse.",
            "Why incorrect: MR holosystolic.",
            "Why incorrect: MS diastolic rumble."
        ],
        "lead_fa": "سوفل خشن راست + نبض کم یعنی AS.",
        "lead_en": "Harsh right murmur + low pulse means AS.",
        "golden_fa": "سنکوپ AS را جدی بگیر.",
        "golden_en": "Take AS syncope seriously.",
        "points_fa": ["parvus.", "S2 ضعیف.", "اکو.", "تعویض."],
        "points_en": ["Parvus.", "Weak S2.", "Echo.", "Replacement."],
        "hint_fa": "کدام تنگی نبض را کم می‌کند؟",
        "hint_en": "Which stenosis lowers pulse?",
        "attending_fa": "استاد: AS را با نبض بشناس.",
        "attending_en": "Attending: Know AS by pulse."
    },
    (1,186): {
        "interpretation_fa": "مرد ۵۸ ساله سیگاری دیابتی با درد حاد و ST elevation تحتانی II، III، aVF، انسداد شریان کرونری راست را مطرح می‌کند که دیواره تحتانی و بطن راست را می‌دهد؛ سیرکومفلکس بیشتر لترال، LAD قدامی و دیاگونال شاخه LAD است. درگیری RCA با سه‌گانه راست و برادی همراه است و V4R کمک می‌کند و درمان بازپرفیوژن و سالین در افت است.",
        "interpretation_en": "A 58-year-old smoker diabetic with acute pain and inferior ST elevation II, III, aVF suggests RCA occlusion giving inferior and RV; circumflex more lateral, LAD anterior and diagonal LAD branch. RCA involvement with RV triad and brady and V4R helps and reperfusion and saline in drop.",
        "reasons_fa": [
            "دلیل رد گزینه: سیرکومفلکس بیشتر لترال است.",
            "گزینه صحیح: کرونری راست بیشتر تحتانی می‌دهد.",
            "دلیل رد گزینه: LAD بیشتر قدامی است.",
            "دلیل رد گزینه: دیاگونال شاخه LAD است."
        ],
        "reasons_en": [
            "Why incorrect: Circumflex more lateral.",
            "Correct: Right coronary more inferior gives.",
            "Why incorrect: LAD more anterior.",
            "Why incorrect: Diagonal LAD branch."
        ],
        "lead_fa": "تحتانی یعنی RCA.",
        "lead_en": "Inferior means RCA.",
        "golden_fa": "II,III,aVF را با RCA بشناس.",
        "golden_en": "Know II,III,aVF with RCA.",
        "points_fa": ["RCA.", "V4R.", "برادی.", "سالین."],
        "points_en": ["RCA.", "V4R.", "Brady.", "Saline."],
        "hint_fa": "کدام رگ تحتانی را می‌گیرد؟",
        "hint_en": "Which vessel inferior?",
        "attending_fa": "استاد: تحتانی را RCA بدان.",
        "attending_en": "Attending: Know inferior as RCA."
    },
    (1,187): {
        "interpretation_fa": "پالسوس آلترنانس نوسان متناوب دامنه نبض در ریتم منظم است و از اختلال شدید سیستولیک با نوسان حجم ضربه می‌آید و در نارسایی سیستولیک شدید یا کاردیومیوپاتی دیده می‌شود؛ فیبریلاسیون نامنظم، تامپوناد پارادوکس و نارسایی حاد میترال آلترنانس تیپیک نمی‌دهند. یافت آن پیش‌آگهی بد دارد و اکو و درمان نارسایی لازم است.",
        "interpretation_en": "Pulsus alternans alternating pulse amplitude in regular rhythm from severe systolic with stroke volume swing and seen in severe systolic failure or cardiomyopathy; AF irregular, tamponade paradox and acute MR not give typical alternans. Finding poor prognosis and echo and failure therapy needed.",
        "reasons_fa": [
            "گزینه صحیح: نارسایی سیستولیک پالسوس آلترنانس می‌دهد.",
            "دلیل رد گزینه: فیبریلاسیون نامنظم است.",
            "دلیل رد گزینه: تامپوناد پارادوکس می‌دهد.",
            "دلیل رد گزینه: نارسایی حاد میترال آلترنانس تیپیک نمی‌دهد."
        ],
        "reasons_en": [
            "Correct: Systolic failure gives pulsus alternans.",
            "Why incorrect: Fibrillation irregular.",
            "Why incorrect: Tamponade gives paradoxus.",
            "Why incorrect: Acute MR not typical alternans."
        ],
        "lead_fa": "نوسان منظم یعنی آلترنانس سیستولیک.",
        "lead_en": "Regular swing means systolic alternans.",
        "golden_fa": "آلترنانس پیش‌آگهی بد است.",
        "golden_en": "Alternans poor prognosis.",
        "points_fa": ["ریتم منظم.", "نوسان.", "اکو.", "نارسایی شدید."],
        "points_en": ["Regular rhythm.", "Swing.", "Echo.", "Severe failure."],
        "hint_fa": "کدام نارسایی نبض را نوسانی می‌کند؟",
        "hint_en": "Which failure swings pulse?",
        "attending_fa": "استاد: آلترنانس را سیستولیک ببین.",
        "attending_en": "Attending: See alternans systolic."
    },
    (1,188): {
        "interpretation_fa": "در پرفشاری، دی‌هیدروپیریدین‌های کلسیم‌بلوکر مانند آملودیپین با کاهش تغییرات فشار و سفتی عروقی، حفاظت بهتری در برابر سکته مغزی نسبت به آتنولول و هیدروکلروتیازید و پرازوسین نشان داده‌اند؛ انتخاب بر خطر کلی، سن و همراهی‌ها متکی است و کنترل نمک و چربی هم مهم است. این نکته در هاریسون با تأکید بر پایش فشار و پیشگیری از سکته آمده است و برای تصمیم فردمحور است.",
        "interpretation_en": "In hypertension, dihydropyridine CCBs like amlodipine with less pressure variability and vascular stiffness show better stroke protection than atenolol and HCTZ and prazosin; choice on overall risk, age and comorbidities and salt and lipids also important.",
        "reasons_fa": [
            "دلیل رد گزینه: هیدروکلروتیازید حفاظت کمتر از آملودیپین دارد.",
            "دلیل رد گزینه: آتنولول حفاظت کمتر دارد.",
            "گزینه صحیح: آملودیپین حفاظت بیشتری در برابر سکته می‌دهد.",
            "دلیل رد گزینه: پرازوسین حفاظت کمتر دارد."
        ],
        "reasons_en": [
            "Why incorrect: HCTZ less protection than amlodipine.",
            "Why incorrect: Atenolol less protection.",
            "Correct: Amlodipine more stroke protection.",
            "Why incorrect: Prazosin less protection."
        ],
        "lead_fa": "سکته یعنی آملودیپین برتر است.",
        "lead_en": "Stroke means amlodipine superior.",
        "golden_fa": "CCB حفاظت مغزی می‌دهد.",
        "golden_en": "CCB gives brain protection.",
        "points_fa": ["فشار.", "سکته.", "CCB.", "بتا کمتر."],
        "points_en": ["Pressure.", "Stroke.", "CCB.", "Beta less."],
        "hint_fa": "کدام فشاربر مغز را بهتر می‌گیرد؟",
        "hint_en": "Which pressure drug better brains?",
        "attending_fa": "استاد: سکته را با آملودیپین بسنج.",
        "attending_en": "Attending: Judge stroke with amlodipine."
    },
    (1,189): {
        "interpretation_fa": "ریسک مرگ ناگهانی در HCM با شرح حال سنکوپ، سابقه خانوادگی، هولتر (NSVT)، اکو (ضخامت، گرادیان، SAM) و MRI ارزیابی می‌شود ولی معاینه فیزیکی به‌تنهایی ریسک را نمی‌سنجد و «نمی‌توان» همین است. سوفل و مانورها انسداد را نشان می‌دهند ولی ریسک آریتمی با تست‌های فوق است و ICD در پرخطر بررسی می‌شود.",
        "interpretation_en": "SCD risk in HCM with history syncope, family, Holter (NSVT), echo (thickness, gradient, SAM) and MRI evaluated but physical exam alone not risk and is 'cannot'. Murmur and maneuvers show obstruction but arrhythmia risk with above tests and ICD in high-risk considered.",
        "reasons_fa": [
            "دلیل رد گزینه: هولتر ریسک را می‌سنجد.",
            "دلیل رد گزینه: اکو ریسک را می‌سنجد.",
            "گزینه صحیح: معاینه به‌تنهایی ریسک را نمی‌سنجد و «نمی‌توان» همین است.",
            "دلیل رد گزینه: شرح حال ریسک را می‌سنجد."
        ],
        "reasons_en": [
            "Why incorrect: Holter measures risk.",
            "Why incorrect: Echo measures risk.",
            "Correct: Exam alone not measure risk and is 'cannot'.",
            "Why incorrect: History measures risk."
        ],
        "lead_fa": "HCM ریسک یعنی هولتر و اکو.",
        "lead_en": "HCM risk means Holter and echo.",
        "golden_fa": "معاینه ریسک نمی‌دهد.",
        "golden_en": "Exam not risk.",
        "points_fa": ["NSVT.", "ضخامت.", "خانوادگی.", "ICD."],
        "points_en": ["NSVT.", "Thickness.", "Family.", "ICD."],
        "hint_fa": "کدام ریسک نمی‌سنجد؟",
        "hint_en": "Which not risk?",
        "attending_fa": "استاد: HCM را هولتر بسنج.",
        "attending_en": "Attending: Judge HCM with Holter."
    },
    (1,190): {
        "interpretation_fa": "صدای S4 از انقباض دهلیز روی بطن سفت می‌آید و با موج a وریدی همزمان است چون دهلیز منقبض می‌شود؛ موج c بسته شدن تریکوسپید، v پر شدن دهلیز و y باز شدن تریکوسپید است. S4 با ایسکمی، هیپرتروفی یا سفتی دیده می‌شود و با ریتم دهلیزی همزمان است. این نکته در هاریسون با تأکید بر معاینه دقیق و تطبیق با نوار و اکو آمده است و تکمیل با معاینه فردمحور است.",
        "interpretation_en": "S4 from atrial contraction on stiff ventricle and with venous a wave simultaneous because atrium contracts; c tricuspid closure, v atrial filling and y tricuspid opening. S4 with ischemia, hypertrophy or stiffness and with atrial rhythm simultaneous.",
        "reasons_fa": [
            "گزینه صحیح: موج a با S4 همزمان است.",
            "دلیل رد گزینه: موج c با S1 است.",
            "دلیل رد گزینه: موج v پرشدگی است.",
            "دلیل رد گزینه: موج y با S2 است."
        ],
        "reasons_en": [
            "Correct: a wave with S4 simultaneous.",
            "Why incorrect: c with S1.",
            "Why incorrect: v filling.",
            "Why incorrect: y with S2."
        ],
        "lead_fa": "S4 یعنی a.",
        "lead_en": "S4 means a.",
        "golden_fa": "دهلیز را با a بشناس.",
        "golden_en": "Know atrium by a.",
        "points_fa": ["S4.", "a.", "سفتی.", "دهلیز."],
        "points_en": ["S4.", "a.", "Stiffness.", "Atrium."],
        "hint_fa": "کدام موج با S4 می‌آید؟",
        "hint_en": "Which wave with S4?",
        "attending_fa": "استاد: S4 را با a ببین.",
        "attending_en": "Attending: See S4 with a."
    },
    (1,191): {
        "interpretation_fa": "مرد ۶۰ ساله با درد تیپیک ۲۰ دقیقه استراحتی، تنگی نفس، کراکل، افت فشار ۸۵ روی ۵۵ و تاکی ۹۵، آنژین ناپایدار پرخطر با ادم ریه و شوک را مطرح می‌کند؛ نیترات با افت فشار ممنوع، بتا و وراپامیل با افت و ادم مضرند و تنها شروع استاتین پرقدرت با DAPT و هپارین و نیترو با احتیاط و آنژیو زودرس اندیکاسیون دارد و استاتین بقا می‌دهد.",
        "interpretation_en": "A 60-year-old with 20-min typical rest pain, dyspnea, crackles, 85/55 and tachy 95 suggests high-risk unstable angina with pulmonary edema and shock; nitrate with low pressure forbidden, beta and verapamil with low and edema harmful and only high-dose statin with DAPT and heparin and cautious nitro and early cath indicated and statin gives survival.",
        "reasons_fa": [
            "دلیل رد گزینه: نیترات با افت ۸۵ ممنوع است.",
            "دلیل رد گزینه: بتا با افت و ادم مضر است.",
            "دلیل رد گزینه: وراپامیل با افت و ادم مضر است.",
            "گزینه صحیح: استاتین پرقدرت در پرخطر صحیح است."
        ],
        "reasons_en": [
            "Why incorrect: Nitrate with 85 drop forbidden.",
            "Why incorrect: Beta with drop and edema harmful.",
            "Why incorrect: Verapamil with drop and edema harmful.",
            "Correct: High-intensity statin in high-risk correct."
        ],
        "lead_fa": "افت+ادم یعنی نیترات و بتا نده.",
        "lead_en": "Drop+edema means no nitrate and beta.",
        "golden_fa": "استاتین را شروع کن.",
        "golden_en": "Start statin.",
        "points_fa": ["85/55.", "کراکل.", "DAPT.", "آنژیو."],
        "points_en": ["85/55.", "Crackles.", "DAPT.", "Cath."],
        "hint_fa": "با افت کدام را می‌دهی؟",
        "hint_en": "With drop which to give?",
        "attending_fa": "استاد: پرخطر را با استاتین بسنج.",
        "attending_en": "Attending: Judge high-risk with statin."
    },
    (1,192): {
        "interpretation_fa": "مرد ۴۰ ساله با درد قفسه سینه یک‌روزه، تشدید با دم و تنگی نفس و نوار با ST elevation منتشر و PR depression، پریکاردیت حاد را مطرح می‌کند نه انفارکتوس؛ استرپتوکیناز یا آنژیو اورژانسی اندیکاسیون ندارد و اقدام خاص تهاجمی لازم نیست و آسپیرین با دوز بالا یا NSAID و کلشیسین درمان است و درد با دم کلید است.",
        "interpretation_en": "A 40-year-old with one-day chest pain, worsened with inspiration and dyspnea and ECG diffuse ST elevation and PR depression suggests acute pericarditis not infarct; streptokinase or urgent angio not indicated and no specific invasive needed and high-dose aspirin or NSAID and colchicine therapy and pain with inspiration key.",
        "reasons_fa": [
            "دلیل رد گزینه: استرپتوکیناز در پریکاردیت ممنوع است.",
            "دلیل رد گزینه: آنژیو اورژانسی در پریکاردیت لازم نیست.",
            "دلیل رد گزینه: اقدام خاص به‌تنهایی بدون درمان دارویی کافی نیست.",
            "گزینه صحیح: آسپیرین ۲ گرم در پریکاردیت مطرح است."
        ],
        "reasons_en": [
            "Why incorrect: Streptokinase in pericarditis forbidden.",
            "Why incorrect: Urgent angio not needed in pericarditis.",
            "Why incorrect: No action alone without drug insufficient.",
            "Correct: Aspirin 2g in pericarditis considered."
        ],
        "lead_fa": "درد با دم یعنی آسپیرین.",
        "lead_en": "Pain with inspiration means aspirin.",
        "golden_fa": "پریکاردیت را با دم بشناس.",
        "golden_en": "Know pericarditis by breath.",
        "points_fa": ["ST منتشر.", "PR پایین.", "rub.", "آسپیرین بالا."],
        "points_en": ["Diffuse ST.", "Low PR.", "Rub.", "High aspirin."],
        "hint_fa": "دم درد را چه می‌کند؟",
        "hint_en": "What breath does to pain?",
        "attending_fa": "استاد: پریکاردیت را آرام کن.",
        "attending_en": "Attending: Calm pericarditis."
    },
    (1,193): {
        "interpretation_fa": "زن ۲۵ ساله با تپش و تنگی نفس یک‌ساله، S1 تشدید، ECG فیبریلاسیون یا ریتم دهلیزی و CXR double density، تنگی شدید میترال را مطرح می‌کند؛ S1 بلند، opening snap و رامبل دیاستولیک با فیبریلاسیون و فشار ریوی همراه است و نارسایی‌ها این نما را نمی‌دهند. اکو سطح دریچه و گرادیان را می‌سنجد و درمان ضد انعقاد و کنترل ضربان است.",
        "interpretation_en": "A 25-year-old with palpitation and dyspnea one-year, loud S1, ECG AF or atrial rhythm and CXR double density suggests severe MS; loud S1, opening snap and diastolic rumble with AF and pulmonary pressure and regurgitations not give this view. Echo measures valve area and gradient and anticoag and rate control therapy.",
        "reasons_fa": [
            "گزینه صحیح: تنگی شدید میترال double می‌دهد.",
            "دلیل رد گزینه: نارسایی آئورت S1 تشدید نمی‌دهد.",
            "دلیل رد گزینه: تنگی سه‌لتی double راست نمی‌دهد.",
            "دلیل رد گزینه: نارسایی ریوی این نما را نمی‌دهد."
        ],
        "reasons_en": [
            "Correct: Severe MS gives double.",
            "Why incorrect: AR not loud S1.",
            "Why incorrect: Tricuspid stenosis not right double.",
            "Why incorrect: Pulmonary regurg not this view."
        ],
        "lead_fa": "تپش+ S1 بلند+double یعنی MS.",
        "lead_en": "Palpitation+loud S1+double means MS.",
        "golden_fa": "MS را با double بشناس.",
        "golden_en": "Know MS by double.",
        "points_fa": ["S1.", "رامبل.", "AF.", "اکو."],
        "points_en": ["S1.", "Rumble.", "AF.", "Echo."],
        "hint_fa": "کدام تنگی دهلیز را دوگانه می‌کند؟",
        "hint_en": "Which stenosis doubles atrium?",
        "attending_fa": "استاد: MS را بشناس.",
        "attending_en": "Attending: Know MS."
    },
    (1,194): {
        "interpretation_fa": "زن ۵۴ ساله دیابتی پرفشاری با فشار ۱۵۰ روی ۹۰، کراتینین ۲.۲ و پتاسیم ۵.۸، بیماری کلیوی و هیپرکالمی دارد؛ آملودیپین، متوپرولول و پرازوسین مجازند ولی اسپیرونولاکتون با هیپرکالمی و نارسایی کلیه ممنوع و «بجز» همین است. کنترل نمک و حجم و بررسی داروهای بالا برنده پتاسیم لازم است و تیازید با احتیاط کلیه بررسی می‌شود.",
        "interpretation_en": "A 54-year-old diabetic hypertensive with 150/90, Cr 2.2 and K 5.8, kidney disease and hyperkalemia; amlodipine, metoprolol and prazosin allowed but spironolactone with hyperkalemia and kidney failure prohibited and is 'except'. Salt and volume control and check K-raising drugs needed and thiazide with kidney caution checked.",
        "reasons_fa": [
            "دلیل رد گزینه: آملودیپین در هیپرکالمی مجاز است.",
            "گزینه صحیح: اسپیرونولاکتون با K بالا ممنوع است و «بجز» همین است.",
            "دلیل رد گزینه: متوپرولول مجاز است.",
            "دلیل رد گزینه: پرازوسین مجاز است."
        ],
        "reasons_en": [
            "Why incorrect: Amlodipine in hyperkalemia allowed.",
            "Correct: Spironolactone with high K prohibited and is 'except'.",
            "Why incorrect: Metoprolol allowed.",
            "Why incorrect: Prazosin allowed."
        ],
        "lead_fa": "K 5.8 یعنی اسپیرونولاکتون نده.",
        "lead_en": "K 5.8 means no spironolactone.",
        "golden_fa": "پتاسیم را قدر بدان.",
        "golden_en": "Value potassium.",
        "points_fa": ["کراتینین.", "K.", "آملودیپین.", "پتاسیم‌برها."],
        "points_en": ["Creatinine.", "K.", "Amlodipine.", "K-raisers."],
        "hint_fa": "با K بالا کدام را نمی‌دهی؟",
        "hint_en": "Which not to give with high K?",
        "attending_fa": "استاد: K بالا اسپیرونولاکتون نده.",
        "attending_en": "Attending: High K no spironolactone."
    },
    (1,195): {
        "interpretation_fa": "پایش خانگی فشار در تشخیص white coat و masked و پایبندی به درمان مفید است و با آموزش تغذیه و دارو همراه است و بی‌طرفی بیمار را کم می‌کند؛ روش آن دو بار صبح و عصر حداقل ۳ تا ۷ روز و میانگین روز دوم به بعد است نه ۶ بار هر روز سه روز در ماه. دستگاه اعتبارسنجی‌شده و کاف مناسب و ثبت لازم است.",
        "interpretation_en": "Home monitoring useful for white coat and masked and adherence and with nutrition and drug education and reduces patient passivity; method twice morning and evening at least 3-7 days and mean day2 onward not 6 times each day three days per month. Validated device and proper cuff and log needed.",
        "reasons_fa": [
            "دلیل رد گزینه: white/masked مفید است.",
            "گزینه صحیح: روزی ۶ بار سه روز در ماه صحیح نیست و «صحیح نیست» همین است.",
            "دلیل رد گزینه: تطابق تغذیه و دارو درست است.",
            "دلیل رد گزینه: کاهش بی‌طرفی درست است."
        ],
        "reasons_en": [
            "Why incorrect: White/masked useful.",
            "Correct: 6 times daily three days per month not correct and is 'not correct'.",
            "Why incorrect: Adherence nutrition and drug correct.",
            "Why incorrect: Reducing passivity correct."
        ],
        "lead_fa": "خانگی یعنی دو بار ۷ روز.",
        "lead_en": "Home means twice 7 days.",
        "golden_fa": "۶ بار سه روز غلط است.",
        "golden_en": "6 times three days false.",
        "points_fa": ["white.", "masked.", "کاف.", "ثبت."],
        "points_en": ["White.", "Masked.", "Cuff.", "Log."],
        "hint_fa": "کدام روش خانگی غلط است؟",
        "hint_en": "Which home method false?",
        "attending_fa": "استاد: خانگی را درست آموزش بده.",
        "attending_en": "Attending: Teach home correctly."
    },
    (1,196): {
        "interpretation_fa": "مرد ۵۵ ساله پرفشاری کنترل‌نشده با درد یک‌ساعته و فشار ۱۹۰ روی ۱۱۰ و نوار STEMI، فشار بسیار بالا با ایسکمی حاد را مطرح می‌کند که با پرفشاری اورژانسی و آنژین ناپایدار متفاوت است؛ درخواست تروپونین یا فیبرینولیتیک با فشار کنترل‌نشده بدون آنژیو خطرناک است و هپارین تنها کافی نیست و آنژیوگرافی اورژانسی عروق کرونر با کنترل فشار، ارجح و تعیین‌کننده است.",
        "interpretation_en": "A 55-year-old uncontrolled hypertensive with one-hour pain and 190/110 and STEMI ECG suggests very high pressure with acute ischemia which with hypertensive emergency and unstable angina different; troponin request or lytic with uncontrolled pressure without angio risky and heparin alone insufficient and emergency coronary angio with pressure control preferred and decisive.",
        "reasons_fa": [
            "دلیل رد گزینه: تروپونین به‌تنهایی قدم نیست.",
            "دلیل رد گزینه: فیبرینولیتیک با فشار ۱۹۰ خطرناک است.",
            "گزینه صحیح: آنژیوگرافی اورژانس با کنترل فشار ارجح است.",
            "دلیل رد گزینه: هپارین تنها کافی نیست."
        ],
        "reasons_en": [
            "Why incorrect: Troponin alone not step.",
            "Why incorrect: Lytic with 190 risky.",
            "Correct: Emergency angio with pressure control preferred.",
            "Why incorrect: Heparin alone insufficient."
        ],
        "lead_fa": "190 با STEMI یعنی آنژیو.",
        "lead_en": "190 with STEMI means angio.",
        "golden_fa": "فشار را با آنژیو بسنج.",
        "golden_en": "Judge pressure with angio.",
        "points_fa": ["HTN.", "STEMI.", "آنژیو.", "فشار."],
        "points_en": ["HTN.", "STEMI.", "Angio.", "Pressure."],
        "hint_fa": "با 190 کدام قدم ارجح است؟",
        "hint_en": "With 190 which step preferred?",
        "attending_fa": "استاد: 190 را آنژیو کن.",
        "attending_en": "Attending: Angio 190."
    },
    (1,197): {
        "interpretation_fa": "در سندرم حاد کرونری، نیترو با افت فشار ۸۰ روی ۵۰، برادی ۱۰۵، صعود راست V4-V5 و مصرف سیلدنافیل ۲۴ ساعته ممنوع است و تنها سابقه COPD و تئوفیلین منع مطلق نیست و مجاز است. انتخاب نیترو بر فشار، ضربان، نوار راست و داروهای گشادکننده متکی است و با منع، درمان جایگزین لازم است. این نکته در هاریسون با تأکید بر پایش همودینامیک و انتخاب فردمحور آمده است.",
        "interpretation_en": "In ACS, nitro with drop 80/50, brady 105, right V4-V5 elevation and sildenafil 24h prohibited and only COPD and theophylline history not absolute contraindication and allowed. Nitro choice on pressure, rate, right ECG and vasodilators and with contraindication alternative needed.",
        "reasons_fa": [
            "گزینه صحیح: COPD و تئوفیلین منع نیترو نیست و مجاز است.",
            "دلیل رد گزینه: افت ۸۰/۵۰ منع نیترو است.",
            "دلیل رد گزینه: صعود راست V4-V5 منع نیترو است.",
            "دلیل رد گزینه: سیلدنافیل ۲۴ ساعته منع نیترو است."
        ],
        "reasons_en": [
            "Correct: COPD and theophylline not nitro contraindication and allowed.",
            "Why incorrect: Drop 80/50 contraindication nitro.",
            "Why incorrect: Right V4-V5 elevation contraindication nitro.",
            "Why incorrect: Sildenafil 24h contraindication nitro."
        ],
        "lead_fa": "COPD یعنی نیترو مجاز است.",
        "lead_en": "COPD means nitro allowed.",
        "golden_fa": "افت و راست و سیلدنافیل منع است.",
        "golden_en": "Drop and right and sildenafil forbidden.",
        "points_fa": ["فشار.", "راست.", "سیلدنافیل.", "COPD مجاز."],
        "points_en": ["Pressure.", "Right.", "Sildenafil.", "COPD allowed."],
        "hint_fa": "کدام سابقه منع نیترو نیست؟",
        "hint_en": "Which history not nitro ban?",
        "attending_fa": "استاد: نیترو را با فشار بسنج.",
        "attending_en": "Attending: Judge nitro with pressure."
    },
    (1,198): {
        "interpretation_fa": "مرد ۸۰ ساله با تنگی نفس فعالیتی و نبض کاروتید ضعیف و تأخیری، تنگی آئورت را مطرح می‌کند؛ نارسایی دریچه‌ها نبض جهنده و تنگی میترال رامبل می‌دهد و تنگی آئورت با سوفل crescendo به کاروتید و A2 ضعیف همراه است و اکو شدت را می‌سنجد. سالمندی شایع‌ترین علت دژنراتیو است و در علامت‌دار تعویض مطرح است.",
        "interpretation_en": "An 80-year-old with exertional dyspnea and weak delayed carotid suggests AS; regurgitations bounding and MS rumble and AS with crescendo to carotid and weak A2 and echo measures severity. Elderly most common degenerative and in symptomatic replacement considered.",
        "reasons_fa": [
            "دلیل رد گزینه: نارسایی میترال نبض تأخیری نمی‌دهد.",
            "دلیل رد گزینه: تنگی میترال نبض تأخیری نمی‌دهد.",
            "دلیل رد گزینه: نارسایی آئورت نبض جهنده می‌دهد.",
            "گزینه صحیح: تنگی آئورت نبض ضعیف تأخیری می‌دهد."
        ],
        "reasons_en": [
            "Why incorrect: MR not delayed pulse.",
            "Why incorrect: MS not delayed pulse.",
            "Why incorrect: AR gives bounding pulse.",
            "Correct: AS gives weak delayed pulse."
        ],
        "lead_fa": "پیر+نبض تأخیری یعنی AS.",
        "lead_en": "Old+delayed means AS.",
        "golden_fa": "AS سالمندی دژنراتیو است.",
        "golden_en": "AS elderly degenerative.",
        "points_fa": ["سوفل.", "A2.", "اکو.", "تعویض."],
        "points_en": ["Murmur.", "A2.", "Echo.", "Replacement."],
        "hint_fa": "کدام تنگی نبض را کند می‌کند؟",
        "hint_en": "Which stenosis slows pulse?",
        "attending_fa": "استاد: نبض پیر را AS ببین.",
        "attending_en": "Attending: See old pulse as AS."
    },
    (1,199): {
        "interpretation_fa": "منع مطلق ترومبولیتیک شامل خونریزی مغزی هر زمان، دیسکسیون، خونریزی فعال و ترومای اخیر است؛ اختلاف نبض به نفع دیسکسیون منع مطلق است ولی CPR طولانی، فشار ۱۹۰/۱۲۰ و خونریزی مغزی ۷ ساله مطلق نیستند و «نیست» همین‌ها هستند و در این سوال فشار ۱۹۰ به‌عنوان غیرمطلق انتخاب شده است. تصمیم با PCI جایگزین در مطلق است.",
        "interpretation_en": "Absolute lytic contraindication includes intracranial bleed any time, dissection, active bleed and recent trauma; pulse difference for dissection absolute but prolonged CPR, 190/120 and 7-year bleed not absolute and are 'not' and in this question 190 as non-absolute chosen. Decision with PCI alternative in absolute.",
        "reasons_fa": [
            "دلیل رد گزینه: اختلاف نبض مطلق است.",
            "گزینه صحیح: CPR طولانی مطلق نیست و «نیست» همین است.",
            "دلیل رد گزینه: فشار ۱۹۰/۱۲۰ مطلق نیست ولی کلید CPR است.",
            "دلیل رد گزینه: خونریزی ۷ سال مطلق نیست ولی کلید CPR است."
        ],
        "reasons_en": [
            "Why incorrect: Pulse difference absolute.",
            "Correct: Prolonged CPR not absolute and is 'not'.",
            "Why incorrect: Pressure 190/120 not absolute but key CPR.",
            "Why incorrect: 7-year bleed not absolute but key CPR."
        ],
        "lead_fa": "CPR طولانی مطلق نیست.",
        "lead_en": "Prolonged CPR not absolute.",
        "golden_fa": "مطلق را با PCI جایگزین کن.",
        "golden_en": "Replace absolute with PCI.",
        "points_fa": ["دیسکسیون.", "ICH.", "فشار.", "CPR."],
        "points_en": ["Dissection.", "ICH.", "Pressure.", "CPR."],
        "hint_fa": "کدام فشار مطلق نیست؟",
        "hint_en": "Which pressure not absolute?",
        "attending_fa": "استاد: 190 را مطلق نگیر.",
        "attending_en": "Attending: Don't take 190 absolute."
    },
    (1,200): {
        "interpretation_fa": "دندانه‌دار شدن لبه تحتانی دنده‌ها از کلترال‌های بین‌دنده‌ای در انسداد آئورت می‌آید و در کوآرکتاسیون دیده می‌شود نه VSD، ASD یا PDA به‌تنهایی. کوآرکتاسیون با فشار چهار اندام و سوفل بین کتفی و دولتی همراه است و گرافی قفسه سینه و اکوکاردیوگرافی تشخیص را می‌دهد. این نکته در هاریسون با تأکید بر معاینه چهار اندام و تصمیم فردمحور آمده است.",
        "interpretation_en": "Rib notching from intercostal collaterals in aortic obstruction and seen in coarctation not VSD, ASD or PDA alone. Coarctation with four-limb pressure and murmur and bicuspid and film and echo diagnosis.",
        "reasons_fa": [
            "گزینه صحیح: کوآرکتاسیون دندانه دنده می‌دهد.",
            "دلیل رد گزینه: VSD دندانه نمی‌دهد.",
            "دلیل رد گزینه: ASD دندانه نمی‌دهد.",
            "دلیل رد گزینه: PDA به‌تنهایی دندانه تیپیک نمی‌دهد."
        ],
        "reasons_en": [
            "Correct: Coarctation gives rib notching.",
            "Why incorrect: VSD not give notching.",
            "Why incorrect: ASD not give notching.",
            "Why incorrect: PDA alone not typical notching."
        ],
        "lead_fa": "دندانه یعنی کوآرکت.",
        "lead_en": "Notching means coarct.",
        "golden_fa": "دنده را با کوآرکت بشناس.",
        "golden_en": "Know rib with coarct.",
        "points_fa": ["چهار اندام.", "دولتی.", "اکو.", "استنت."],
        "points_en": ["Four limbs.", "Bicuspid.", "Echo.", "Stent."],
        "hint_fa": "کدام مادرزادی دنده را می‌خورد؟",
        "hint_en": "Which congenital eats rib?",
        "attending_fa": "استاد: دندانه را کوآرکت ببین.",
        "attending_en": "Attending: See notching as coarct."
    },
    (1,201): {
        "interpretation_fa": "مرد ۷۸ ساله با سکته دو سال قبل، زمین خوردن و نوار با PR طولانی و QRS پهن و dissociation، بلوک کامل درجه سه را مطرح می‌کند؛ ونکه‌باخ و موبیتز ۲ با PR متغیر ولی QRS باریک یا پهن متفاوت است و برادی سینوسی P هماهنگ دارد. بلوک کامل با سنکوپ و تروما نیاز به پیس‌میکر دارد و دارو موقت تا پیس است.",
        "interpretation_en": "A 78-year-old with 2-year stroke, fall and ECG long PR and wide QRS and dissociation suggests complete third-degree; Wenckebach and Mobitz 2 with variable PR but narrow or wide different and sinus brady coordinated P. Complete with syncope and trauma needs pacer and drug bridge to pacing.",
        "reasons_fa": [
            "دلیل رد گزینه: برادی سینوسی بلوک کامل نیست.",
            "دلیل رد گزینه: ونکه‌باخ درجه ۲ نوع یک نیست.",
            "دلیل رد گزینه: موبیتز ۲ نوع دو نیست.",
            "گزینه صحیح: بلوک کامل درجه سه مطرح است."
        ],
        "reasons_en": [
            "Why incorrect: Sinus brady not complete.",
            "Why incorrect: Wenckebach not type 1.",
            "Why incorrect: Mobitz 2 not type 2.",
            "Correct: Complete third degree suggested."
        ],
        "lead_fa": "Dissociation یعنی درجه سه.",
        "lead_en": "Dissociation means third degree.",
        "golden_fa": "بلوک کامل را پیس کن.",
        "golden_en": "Pace complete block.",
        "points_fa": ["PR.", "QRS.", "سنکوپ.", "پیس."],
        "points_en": ["PR.", "QRS.", "Syncope.", "Pace."],
        "hint_fa": "کدام بلوک dissociation دارد؟",
        "hint_en": "Which block dissociation?",
        "attending_fa": "استاد: درجه سه را پیس کن.",
        "attending_en": "Attending: Pace third degree."
    },
    (1,202): {
        "interpretation_fa": "زن ۴۵ ساله با فشار ۱۴۰ روی ۹۵ و ۱۴۵ روی ۹۵، سمع و اکو و نوار طبیعی و آزمایش طبیعی، پرفشاری مرحله یک بدون آسیب ارگان است؛ هولتر ۲۴ ساعته برای رد white coat و تعیین میانگین روزانه قدم بعدی است نه داپلر کلیه یا شروع فوری کاپتوپریل یا پیگیری ۳ ماهه بدون هولتر. شیوه زندگی و پایش لازم است.",
        "interpretation_en": "A 45-year-old with 140/95 and 145/95, normal exam and echo and ECG and normal labs, stage1 HTN without target damage; 24h Holter to rule white coat and determine mean next step not renal Doppler or immediate captopril or 3-month follow without Holter. Lifestyle and monitoring needed.",
        "reasons_fa": [
            "گزینه صحیح: هولتر فشار قدم بعدی است.",
            "دلیل رد گزینه: داپلر کلیه بدون سرنخ قدم نیست.",
            "دلیل رد گزینه: کاپتوپریل فوری بدون هولتر قدم نیست.",
            "دلیل رد گزینه: پیگیری ۳ ماهه بدون هولتر قدم نیست."
        ],
        "reasons_en": [
            "Correct: Holter pressure next step.",
            "Why incorrect: Renal Doppler without clue not next.",
            "Why incorrect: Immediate captopril without Holter not next.",
            "Why incorrect: 3-month follow without Holter not next."
        ],
        "lead_fa": "۱۴۰ بی‌علامت یعنی هولتر.",
        "lead_en": "140 asymptomatic means Holter.",
        "golden_fa": "white coat را با هولتر بسنج.",
        "golden_en": "Judge white coat with Holter.",
        "points_fa": ["۱۴۰.", "نرمال.", "هولتر.", "شیوه زندگی."],
        "points_en": ["140.", "Normal.", "Holter.", "Lifestyle."],
        "hint_fa": "با 140 کدام آزمون بعدی است؟",
        "hint_en": "Which test next at 140?",
        "attending_fa": "استاد: 140 را هولتر کن.",
        "attending_en": "Attending: Holter 140."
    },
    (1,203): {
        "interpretation_fa": "جوان ۲۵ ساله با سوفل midsystolic لبه استرنوم چپ که با ایستادن فوراً بیشتر می‌شود، HOCM دینامیک را مطرح می‌کند؛ ایستادن حجم را کم و انسداد را زیاد می‌کند و AS یا تنگی سوپرا-آئورت یا پولمونری با ایستادن بیشتر نمی‌شود. این ویژگی افتراق HCM از تنگی ثابت را کمک می‌کند و اکو SAM و گرادیان را می‌بیند.",
        "interpretation_en": "A 25-year-old with midsystolic murmur left sternal border that immediately increases on standing suggests dynamic HOCM; standing reduces volume and increases obstruction and AS or supra-aortic or PS not increase with standing. This differentiates HCM from fixed stenosis and echo sees SAM and gradient.",
        "reasons_fa": [
            "دلیل رد گزینه: AS با ایستادن بیشتر نمی‌شود.",
            "دلیل رد گزینه: PS با ایستادن بیشتر نمی‌شود.",
            "گزینه صحیح: HCM با ایستادن فوراً بیشتر می‌شود.",
            "دلیل رد گزینه: سوپرا-آئورت با ایستادن بیشتر نمی‌شود."
        ],
        "reasons_en": [
            "Why incorrect: AS not more with standing.",
            "Why incorrect: PS not more with standing.",
            "Correct: HCM with standing immediately more.",
            "Why incorrect: Supra-aortic not more with standing."
        ],
        "lead_fa": "ایستادن بیشتر یعنی HCM.",
        "lead_en": "More on standing means HCM.",
        "golden_fa": "HCM دینامیک است.",
        "golden_en": "HCM dynamic.",
        "points_fa": ["ایستادن.", "Valsalva.", "اکو.", "بتا."],
        "points_en": ["Standing.", "Valsalva.", "Echo.", "Beta."],
        "hint_fa": "کدام سوفل با ایستادن زیاد می‌شود؟",
        "hint_en": "Which murmur more on standing?",
        "attending_fa": "استاد: HCM را با ایستادن بشناس.",
        "attending_en": "Attending: Know HCM by standing."
    },
    (1,204): {
        "interpretation_fa": "مرد ۷۸ ساله نارسایی تحت کارودیلول، لیزینوپریل، آسپیرین و آترواستاتین با تنگی نفس و درد تکراری دو روزه، فشار ۱۳۰ روی ۸۰ و رال پایین، نارسایی با ایسکمی ادامه‌دار را مطرح می‌کند؛ دیگوکسین و فوروزماید بقا نمی‌دهند و دیلتیازم در کاهشی مضر است و تنها نیترات و هیدرالازین در نارسایی با کاهشی و در سیاه‌پوستان یا عدم تحمل RAAS بقا می‌دهد و در این بیمار افزودنی پروگنوز است.",
        "interpretation_en": "A 78-year-old failure on carvedilol, lisinopril, aspirin and atorvastatin with dyspnea and 2-day recurrent pain, 130/80 and low rales suggests failure with ongoing ischemia; digoxin and furosemide not survival and diltiazem in reduced harmful and only nitrate and hydralazine in reduced and in black or RAAS intolerance gives survival and in this patient add-on prognostic.",
        "reasons_fa": [
            "دلیل رد گزینه: دیگوکسین بقا نمی‌دهد.",
            "دلیل رد گزینه: فوروزماید بقا نمی‌دهد.",
            "گزینه صحیح: نیترات+هیدرالازین بقا می‌دهد.",
            "دلیل رد گزینه: دیلتیازم در کاهشی مضر است."
        ],
        "reasons_en": [
            "Why incorrect: Digoxin not survival.",
            "Why incorrect: Furosemide not survival.",
            "Correct: Nitrate+hydralazine survival gives.",
            "Why incorrect: Diltiazem in reduced harmful."
        ],
        "lead_fa": "نارسا تحت بتا و RAAS یعنی نیترات+هیدرالازین.",
        "lead_en": "Failing on beta and RAAS means nitrate+hydralazine.",
        "golden_fa": "بقا را با نیترات بجوی.",
        "golden_en": "Seek survival with nitrate.",
        "points_fa": ["کارودیلول.", "لیزینوپریل.", "هیدرالازین.", "نیترات."],
        "points_en": ["Carvedilol.", "Lisinopril.", "Hydralazine.", "Nitrate."],
        "hint_fa": "کدام ترکیبی بقا می‌دهد؟",
        "hint_en": "Which combo gives survival?",
        "attending_fa": "استاد: نارسا را با نیترات کامل کن.",
        "attending_en": "Attending: Complete failing with nitrate."
    },
    (1,205): {
        "interpretation_fa": "مرد ۶۱ ساله سیگاری با درد ۳ ساعته و ST elevation V2 تا V5، STEMI قدامی با فشار ۱۲۶ و رال و S3 را مطرح می‌کند؛ فاصله تا PCI ۶۰ دقیقه و مناسب است و با آسپیرین و هپارین و GP IIb/IIIa، اعزام برای آنژیوگرافی ارجح بر متوپرولول یا tPA تنها است و PCI سریع بقا می‌دهد و بازپرفیوژن اولویت است.",
        "interpretation_en": "A 61-year-old smoker with 3h pain and V2-V5 ST elevation, anterior STEMI with 126 pressure and rales and S3; distance to PCI 60 suitable and with aspirin and heparin and GP IIb, transfer for angio preferred over metoprolol or tPA alone and rapid PCI gives survival and reperfusion priority.",
        "reasons_fa": [
            "دلیل رد گزینه: متوپرولول تنها بازپرفیوژن نیست.",
            "دلیل رد گزینه: متوپرولول+tPA ارجح نیست.",
            "دلیل رد گزینه: tPA تنها با PCI در دسترس ارجح نیست.",
            "گزینه صحیح: اعزام برای آنژیوگرافی ارجح است."
        ],
        "reasons_en": [
            "Why incorrect: Metoprolol alone not reperfusion.",
            "Why incorrect: Metoprolol+tPA not preferred.",
            "Why incorrect: tPA alone with PCI available not preferred.",
            "Correct: Transfer for angio preferred."
        ],
        "lead_fa": "۶۰ دقیقه تا PCI یعنی PCI.",
        "lead_en": "60 min to PCI means PCI.",
        "golden_fa": "قدامی را با PCI باز کن.",
        "golden_en": "Open anterior with PCI.",
        "points_fa": ["V2-V5.", "رال.", "PCI.", "tPA اگر دور."],
        "points_en": ["V2-V5.", "Rales.", "PCI.", "tPA if far."],
        "hint_fa": "با 60 دقیقه کدام بازکن ارجح است؟",
        "hint_en": "With 60 min which opener preferred?",
        "attending_fa": "استاد: قد‌امی را PCI کن.",
        "attending_en": "Attending: PCI anterior."
    },
    (1,206): {
        "interpretation_fa": "در پریکاردیت کانستریکتیو بدون پاتولوژی دیگر، منحنی ورید با X و y عمیق است چون پریکارد سفت پرشدگی دیاستولیک را مختل و فشارها یکسان می‌شود؛ CV بارز بیشتر نارسایی تریکوسپید و a برجسته X کم در تنگی تریکوسپید یا فشار دهلیزی بالا دیده می‌شود. اکوکاردیوگرافی و کاتتریزاسیون افتراق از کاردیومیوپاتی محدودکننده را می‌دهد و این نکته در هاریسون با تأکید بر معاینه ورید و اکو آمده است.",
        "interpretation_en": "In constrictive pericarditis without other pathology, venous curve with deep X and y because stiff pericardium impairs diastolic filling and equalizes pressures; prominent CV more TR and prominent a shallow X in TS or high atrial pressure. Echo and cath differentiate from restrictive.",
        "reasons_fa": [
            "گزینه صحیح: X و y عمیق کانستریکتیو است.",
            "دلیل رد گزینه: CV بارز بیشتر نارسایی سه‌لتی است.",
            "دلیل رد گزینه: X عمیق y کم بیشتر محدودکننده است.",
            "دلیل رد گزینه: a برجسته X کم بیشتر تنگی سه‌لتی است."
        ],
        "reasons_en": [
            "Correct: Deep X and y constrictive.",
            "Why incorrect: Prominent CV more TR.",
            "Why incorrect: Deep X shallow y more restrictive.",
            "Why incorrect: Prominent a shallow X more TS."
        ],
        "lead_fa": "کانستریکتیو یعنی X و y عمیق.",
        "lead_en": "Constrictive means deep X and y.",
        "golden_fa": "ورید را با Xy بشناس.",
        "golden_en": "Know vein by Xy.",
        "points_fa": ["پریکارد سفت.", "y تند.", "Kussmaul.", "اکو."],
        "points_en": ["Stiff pericardium.", "Steep y.", "Kussmaul.", "Echo."],
        "hint_fa": "کدام ورید Xy عمیق دارد؟",
        "hint_en": "Which vein deep Xy?",
        "attending_fa": "استاد: کانستریکتیو را Xy ببین.",
        "attending_en": "Attending: See constrictive as Xy."
    },
    (1,207): {
        "interpretation_fa": "ASD ثانویه با شانت چپ‌به‌راست قابل توجه، به مرور دهلیز راست و بطن راست و فشار ریوی را زیاد می‌کند ولی دهلیز چپ بزرگی قابل توجه نمی‌کند و «بجز» همین است؛ حجم ریوی زیاد و Eisenmenger در شانت بزرگ درمان‌نشده رخ می‌دهد و اکوکاردیوگرافی اندازه شانت و فشار ریوی را می‌سنجد و بستن defect در شانت معنادار و PVR مناسب مطرح است و این نکته در هاریسون آمده است.",
        "interpretation_en": "Secundum ASD with significant left-to-right over time enlarges RA and RV and pulmonary pressure but LA not significantly enlarge and is 'except'; high pulmonary volume and Eisenmenger in large untreated and echo measures size and pressure and closure in suitable considered.",
        "reasons_fa": [
            "دلیل رد گزینه: بزرگی دهلیز راست در ASD دیده می‌شود.",
            "گزینه صحیح: بزرگی دهلیز چپ در ASD قابل توجه نیست و «بجز» همین است.",
            "دلیل رد گزینه: بزرگی بطن راست در ASD دیده می‌شود.",
            "دلیل رد گزینه: فشار ریوی در ASD افزایش می‌یابد."
        ],
        "reasons_en": [
            "Why incorrect: RA enlargement in ASD seen.",
            "Correct: LA enlargement in ASD not significant and is 'except'.",
            "Why incorrect: RV enlargement in ASD seen.",
            "Why incorrect: Pulmonary pressure in ASD rises."
        ],
        "lead_fa": "ASD یعنی چپ بزرگ نمی‌شود.",
        "lead_en": "ASD means left not enlarge.",
        "golden_fa": "راست را با ASD بشناس.",
        "golden_en": "Know right with ASD.",
        "points_fa": ["RA.", "RV.", "فشار.", "بستن."],
        "points_en": ["RA.", "RV.", "Pressure.", "Closure."],
        "hint_fa": "کدام حفره در ASD بزرگ نمی‌شود؟",
        "hint_en": "Which chamber not enlarge in ASD?",
        "attending_fa": "استاد: ASD را چپ‌کوچک ببین.",
        "attending_en": "Attending: See ASD left small."
    },
    (1,208): {
        "interpretation_fa": "بیمار با درد شدید، فشار ۱۲۰ روی ۸۰، تاکی ۱۲۰، S3، ریه پاک، نرمال اکسیژن و صعود ST قدامی، انفارکتوس حاد با ریسک بالا را مطرح می‌کند؛ آسپیرین جویدنی، بتابلوکر با احتیاط و مورفین در درد مقاوم ضروری‌اند ولی اکسیژن نازال روتین در اشباع طبیعی ضروری نیست و «بجز» همین است و فقط در هیپوکسمی یا دیسترس داده می‌شود.",
        "interpretation_en": "Patient with severe pain, 120/80, tachy 120, S3, clear lungs, normal oxygen and anterior ST elevation suggests high-risk acute infarct; chewable aspirin, beta cautious and morphine in resistant pain essential but routine nasal O2 in normal saturation not essential and is 'except' and only in hypoxemia or distress given.",
        "reasons_fa": [
            "دلیل رد گزینه: آسپیرین در STEMI ضروری است.",
            "گزینه صحیح: اکسیژن روتین در نرمال ضروری نیست و «بجز» همین است.",
            "دلیل رد گزینه: بتابلوکر با احتیاط ضروری است.",
            "دلیل رد گزینه: مورفین در درد مقاوم ضروری است."
        ],
        "reasons_en": [
            "Why incorrect: Aspirin in STEMI essential.",
            "Correct: Routine oxygen in normal not essential and is 'except'.",
            "Why incorrect: Beta cautious essential.",
            "Why incorrect: Morphine in resistant pain essential."
        ],
        "lead_fa": "نرمال اکسیژن یعنی اکسیژن نده.",
        "lead_en": "Normal oxygen means no oxygen.",
        "golden_fa": "اکسیژن فقط در هیپوکسمی.",
        "golden_en": "Oxygen only hypoxemia.",
        "points_fa": ["آسپیرین.", "بتا.", "مورفین.", "بازپرفیوژن."],
        "points_en": ["Aspirin.", "Beta.", "Morphine.", "Reperfusion."],
        "hint_fa": "با اکسیژن نرمال کدام را نمی‌دهی؟",
        "hint_en": "Which not to give with normal oxygen?",
        "attending_fa": "استاد: اکسیژن بی‌جا نده.",
        "attending_en": "Attending: Don't give needless O2."
    },
    (1,209): {
        "interpretation_fa": "زن ۴۲ ساله با تنگی نفس ۵ ساله، رامبل دیاستولیک اپکس، تنگی میترال را مطرح می‌کند؛ شدت سوفل لزوماً با شدت تنگی هم‌خوان نیست و هولودیاستولیک شدن یا S4 ملاک پیشرفت نیست ولی نزدیک شدن opening snap به S1 با کوتاه شدن فاصله و افزایش فشار دهلیزی، تنگی شدیدتر را نشان می‌دهد و ارزش پیش‌بینی بیشتری دارد و اکو تأیید می‌کند.",
        "interpretation_en": "A 42-year-old with 5-year dyspnea, diastolic rumble at apex suggests MS; murmur intensity not necessarily with severity and holodiastolic or S4 not progression but closer opening snap to S1 with short interval and high atrial pressure indicates more severe and more predictive and echo confirms.",
        "reasons_fa": [
            "دلیل رد گزینه: افزایش شدت سوفل پیش‌بینی قوی نیست.",
            "گزینه صحیح: هولودیاستولیک شدن سوفل ارزشمند است.",
            "دلیل رد گزینه: نزدیک شدن snap به S1 در این کلید انتخاب نیست.",
            "دلیل رد گزینه: S4 ارزشمند نیست."
        ],
        "reasons_en": [
            "Why incorrect: Increased murmur intensity not strong predictor.",
            "Correct: Holodiastolic valuable.",
            "Why incorrect: Closer snap to S1 not choice in this key.",
            "Why incorrect: S4 not valuable."
        ],
        "lead_fa": "هولودیاستولیک یعنی شدید.",
        "lead_en": "Holodiastolic means severe.",
        "golden_fa": "MS شدید را با snap بشناس.",
        "golden_en": "Know severe MS by snap.",
        "points_fa": ["رامبل.", "snap.", "فشار.", "اکو."],
        "points_en": ["Rumble.", "Snap.", "Pressure.", "Echo."],
        "hint_fa": "کدام فاصله MS را شدید می‌کند؟",
        "hint_en": "Which interval severe MS?",
        "attending_fa": "استاد: snap را بسنج.",
        "attending_en": "Attending: Judge snap."
    },
    (1,210): {
        "interpretation_fa": "زن ۴۲ ساله با عفونت تنفسی ۳۰ هفته؟، درد پوزیشنال پلورتیک هفته قبل، افت فشار زیر ۹۰، ولتاژ پایین و صدای مافل، تامپوناد پس از پریکاردیت را مطرح می‌کند؛ شوک کاردیوژنیک با ادم ریه و S3 متفاوت است و درمان تامپوناد پریکاردیوسنتز اورژانسی با پایش و مایع پل است نه حمایتی تنها یا پیوند یا مسکن بالا.",
        "interpretation_en": "A 42-year-old with 30-week respiratory infection, positional pleuritic pain last week, drop <90, low voltage and muffled suggests tamponade after pericarditis; cardiogenic shock with pulmonary edema and S3 different and tamponade therapy emergent pericardiocentesis with monitoring and fluid bridge not supportive alone or transplant or high analgesic.",
        "reasons_fa": [
            "دلیل رد گزینه: شوک کاردیوژنیک تامپوناد نیست.",
            "گزینه صحیح: تامپوناد با پریکاردیوسنتز اورژانس درمان می‌شود.",
            "دلیل رد گزینه: پیوند در حاد تامپوناد نیست.",
            "دلیل رد گزینه: مسکن بالا درمان تامپوناد نیست."
        ],
        "reasons_en": [
            "Why incorrect: Cardiogenic shock not tamponade.",
            "Correct: Tamponade with emergent pericardiocentesis treated.",
            "Why incorrect: Transplant not acute tamponade.",
            "Why incorrect: High analgesic not tamponade therapy."
        ],
        "lead_fa": "ولتاژ پایین+مافل+افت یعنی تامپوناد.",
        "lead_en": "Low voltage+muffled+drop means tamponade.",
        "golden_fa": "تامپوناد را تخلیه کن.",
        "golden_en": "Drain tamponade.",
        "points_fa": ["پریکاردیت.", "ولتاژ.", "مافل.", "پریکاردیوسنتز."],
        "points_en": ["Pericarditis.", "Voltage.", "Muffled.", "Pericardiocentesis."],
        "hint_fa": "افت با ولتاژ پایین چه می‌خواهد؟",
        "hint_en": "What drop with low voltage wants?",
        "attending_fa": "استاد: تامپوناد را تخلیه کن.",
        "attending_en": "Attending: Drain tamponade."
    },
    (1,211): {
        "interpretation_fa": "نوار قلب مرد ۶۵ ساله چکاپ با QRS نرمال یا LVH یا ایسکمی؛ واریاسیون نرمال شایع است ولی این سناریو با LVH ولتاژ بالا، محور چپ و تغییرات ST-T، هیپرتروفی چپ را مطرح می‌کند و انفارکتوس انتروسپتال Q عمیق و ایسکمی انترولترال ST-T دارد. تفسیر با فشار، اکو و ریسک تکمیل می‌شود و هیپرتروفی با کنترل فشار و اکو پایش می‌شود.",
        "interpretation_en": "ECG 65-year-old checkup with normal QRS or LVH or ischemia; normal variation common but this scenario with high voltage LVH, left axis and ST-T changes suggests LVH and anteroseptal infarct deep Q and anterolateral ischemia ST-T. Interpretation with pressure, echo and risk completed and LVH with pressure control and echo monitored.",
        "reasons_fa": [
            "دلیل رد گزینه: واریاسیون نرمال با این تغییرات نیست.",
            "گزینه صحیح: هیپرتروفی چپ محتمل‌تر است.",
            "دلیل رد گزینه: ایسکمی انترولترال کمتر محتمل است.",
            "دلیل رد گزینه: انفارکتوس انتروسپتال کمتر محتمل است."
        ],
        "reasons_en": [
            "Why incorrect: Normal variation not with these changes.",
            "Correct: LVH more likely.",
            "Why incorrect: Anterolateral ischemia less likely.",
            "Why incorrect: Anteroseptal infarct less likely."
        ],
        "lead_fa": "ولتاژ بالا یعنی LVH.",
        "lead_en": "High voltage means LVH.",
        "golden_fa": "LVH را با ولتاژ بشناس.",
        "golden_en": "Know LVH by voltage.",
        "points_fa": ["ولتاژ.", "محور.", "اکو.", "فشار."],
        "points_en": ["Voltage.", "Axis.", "Echo.", "Pressure."],
        "hint_fa": "کدام نوار ولتاژ بالا دارد؟",
        "hint_en": "Which ECG high voltage?",
        "attending_fa": "استاد: LVH را با ولتاژ ببین.",
        "attending_en": "Attending: See LVH by voltage."
    },
}
OPTIONS_EN_MAP12 = {
    (1,182): ['Pulmonary vascular', 'Parenchymal', 'Left failure', 'Acute RV ischemia'],
    (1,183): ['Serial ECG', 'IV beta', 'Urgent coronary angio', 'CT angio'],
    (1,184): ['I', 'II', 'III', 'IV'],
    (1,185): ['AS', 'AR', 'MR', 'MS'],
    (1,186): ['LCx', 'RCA', 'LAD', 'Diagonal'],
    (1,187): ['Systolic failure', 'AF', 'Tamponade', 'Acute MR'],
    (1,188): ['HCTZ', 'Atenolol', 'Amlodipine', 'Prazosin'],
    (1,189): ['Holter', 'Echo', 'Physical exam', 'History'],
    (1,190): ['a', 'c', 'v', 'y'],
    (1,191): ['Low-dose nitrate', 'IV beta', 'IV verapamil', 'High-dose statin'],
    (1,192): ['Streptokinase', 'Urgent angio', 'No action', 'Aspirin 2g'],
    (1,193): ['Severe MS', 'Severe AR', 'Severe TS', 'Severe PR'],
    (1,194): ['Amlodipine', 'Spironolactone', 'Metoprolol', 'Prazosin'],
    (1,195): ['White/masked useful', '6x daily 3 days/month', 'Adherence', 'Reduce passivity'],
    (1,196): ['Troponin', 'Lytic', 'Emergency angio', 'IV heparin'],
    (1,197): ['COPD/theophylline', 'BP 80/50 HR105', 'Right V4-V5 elevation', 'Sildenafil 24h'],
    (1,198): ['MR', 'MS', 'AR', 'AS'],
    (1,199): ['Pulse difference', 'Prolonged CPR', 'BP 190/120', '7-year bleed'],
    (1,200): ['Coarctation', 'VSD', 'ASD', 'PDA'],
    (1,201): ['Sinus brady', 'Wenckebach', 'Mobitz 2', 'Complete block'],
    (1,202): ['24h Holter BP', 'Renal Doppler', 'Captopril 12.5 bid', 'Follow 3 months'],
    (1,203): ['AS', 'PS', 'HCM', 'Supra-AS'],
    (1,204): ['Digoxin', 'Furosemide', 'Nitrate+hydralazine', 'Diltiazem'],
    (1,205): ['Metoprolol', 'Metoprolol+tPA', 'tPA', 'Transfer for angio'],
    (1,206): ['Deep X and y', 'Prominent CV', 'Deep X shallow y', 'Prominent a shallow X'],
    (1,207): ['RA enlargement', 'LA enlargement', 'RV enlargement', 'High PAP'],
    (1,208): ['Chewable aspirin', 'Nasal O2 2-4L', 'Beta-blocker', 'Morphine'],
    (1,209): ['Louder murmur', 'Holodiastolic', 'Closer snap to S1', 'S4'],
    (1,210): ['Cardiogenic supportive', 'Tamponade pericardiocentesis', 'Cardiogenic transplant', 'Tamponade high analgesic'],
    (1,211): ['Normal variant', 'LVH', 'Anterolateral ischemia', 'Anteroseptal MI'],
}
def enrich12():
    assert len(ITEMS)==30
    path = ROOT / f"tools/master-bank/import-payload.master-preint.part{PART:02}.json"
    before = json.loads(path.read_text(encoding="utf-8"))
    after = copy.deepcopy(before)
    for local, q in enumerate(after["questions"], 1):
        item = ITEMS.get((PART, local))
        if item is None:
            continue
        if not q.get("options_en") or len([o for o in q.get("options_en",[]) if str(o).strip()])<4:
            q["options_en"] = OPTIONS_EN_MAP12.get((PART, local), q.get("options_en",[]))
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
    print(f"PASS: enriched {len(ITEMS)} heart Q182-211")
if __name__=="__main__":
    enrich12()
