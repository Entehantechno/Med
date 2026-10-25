#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Batch13: P01 Q212-220 + P02 Q1-21 (30) => heart 240"""
import copy, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
ITEMS = {
    (1,212): {
        "interpretation_fa": "مرد ۵۰ ساله پس از انفارکتوس قدامی در CCU روز دوم آریتمی بدون علامت با علائم حیاتی پایدار دارد؛ تراسه احتمالاً PVC یا NSVT کوتاه یا AIVR پس از بازپرفیوژن است که در بیمار پایدار بدون علامت، چک الکترولیت مانند منیزیوم و پتاسیم و پایش کافی است و تجویز بتابلوکر یا لیدوکائین روتین مفید نیست و حتی مضر است. تصمیم بر پایداری و نوع آریتمی متکی است.",
        "interpretation_en": "A 50-year-old post-anterior MI in CCU day2 asymptomatic arrhythmia with stable vitals; tracing likely PVC or short NSVT or AIVR post-reperfusion where stable asymptomatic check electrolytes like Mg and K and monitoring enough and beta or lidocaine routine not useful and even harmful. Decision on stability and type.",
        "reasons_fa": [
            "دلیل رد گزینه: چک منیزیوم در آریتمی پس MI مفید است.",
            "دلیل رد گزینه: بتابلوکر در این آریتمی پایدار بی‌علامت مفید نیست و «مفید نیست» همین است ولی کلید لیدوکائین است.",
            "گزینه صحیح: لیدوکائین در PVC/NSVT بی‌علامت پایدار مفید نیست.",
            "دلیل رد گزینه: چک پتاسیم در آریتمی پس MI مفید است."
        ],
        "reasons_en": [
            "Why incorrect: Check Mg in post-MI arrhythmia useful.",
            "Why incorrect: Beta in this stable asymptomatic not useful but key lidocaine.",
            "Correct: Lidocaine in asymptomatic stable PVC/NSVT not useful.",
            "Why incorrect: Check K in post-MI arrhythmia useful."
        ],
        "lead_fa": "آریتمی بی‌علامت پایدار یعنی الکترولیت را ببین.",
        "lead_en": "Stable asymptomatic arrhythmia means see electrolytes.",
        "golden_fa": "لیدوکائین روتین نده.",
        "golden_en": "Don't routine lidocaine.",
        "points_fa": ["منیزیوم.", "پتاسیم.", "پایش.", "بتا با احتیاط."],
        "points_en": ["Mg.", "K.", "Monitor.", "Beta cautious."],
        "hint_fa": "کدام دارو در پایدار بی‌علامت مفید نیست؟",
        "hint_en": "Which drug not useful in stable asymptomatic?",
        "attending_fa": "استاد: آریتمی پایدار را پایش کن.",
        "attending_en": "Attending: Monitor stable arrhythmia."
    },
    (1,213): {
        "interpretation_fa": "JVP فشار پرشدگی دهلیز راست و بطن راست را تخمین می‌زند و با نارسایی قلبی ارتباط پیش‌آگهی دارد؛ در نارسایی افزایش JVP با بستری مکرر همراه است ولی ارتباط قابل پیش‌بینی مستقیم با فشار و جریان شریان ریوی ندارد و بیشتر با فشار سیستمیک وریدی است. همه موارد صحیح است و فشار وریدی مرکزی را نشان می‌دهد.",
        "interpretation_en": "JVP estimates RA and RV filling pressure and prognostic with HF; increased JVP with readmission but no predictable direct link with pulmonary artery pressure and flow and more with systemic venous. All correct and shows central venous pressure.",
        "reasons_fa": [
            "دلیل رد گزینه: JVP فشار پرشدگی راست را تخمین می‌زند.",
            "دلیل رد گزینه: ارتباط قابل پیش‌بینی با شریان ریوی ندارد ولی سوال همه می‌گوید.",
            "دلیل رد گزینه: JVP بالا بستری مکرر را پیش‌بینی می‌کند.",
            "گزینه صحیح: همه موارد صحیح است."
        ],
        "reasons_en": [
            "Why incorrect: JVP estimates right filling.",
            "Why incorrect: No predictable pulmonary link but question all says.",
            "Why incorrect: High JVP predicts readmission.",
            "Correct: All correct."
        ],
        "lead_fa": "JVP یعنی فشار وریدی مرکزی.",
        "lead_en": "JVP means central venous pressure.",
        "golden_fa": "همه در مورد JVP صحیح است.",
        "golden_en": "All about JVP correct.",
        "points_fa": ["دهلیز راست.", "بستری.", "وریدی.", "اکو."],
        "points_en": ["RA.", "Admission.", "Venous.", "Echo."],
        "hint_fa": "JVP چیست؟ همه.",
        "hint_en": "What is JVP? All.",
        "attending_fa": "استاد: JVP را با همه بشناس.",
        "attending_en": "Attending: Know JVP with all."
    },
    (1,214): {
        "interpretation_fa": "هیپرکالمی آریتمی با برادی، QRS پهن، موج T بلند و سپس سینوس، تاکی بطنی، آسیستول و ریتم ایدیوونتریکلر کند می‌دهد ولی تاکی سینوسی جزء آن نیست و «نیست» همین است. ECG با پتاسیم بالا پله‌ای تغییر می‌کند و درمان کلسیم، انسولین-گلوکز، بی‌کربنات و دیالیز است و پایش پتاسیم و کلیه مهم است.",
        "interpretation_en": "Hyperkalemia arrhythmia with brady, wide QRS, tall T then sinus, VT, asystole and slow idioventricular but sinus tachy not part and is 'not'. ECG with high K stepwise changes and therapy calcium, insulin-glucose, bicarbonate and dialysis and K and kidney monitoring important.",
        "reasons_fa": [
            "دلیل رد گزینه: VT در هیپرکالمی دیده می‌شود.",
            "دلیل رد گزینه: آسیستول در هیپرکالمی دیده می‌شود.",
            "گزینه صحیح: تاکی سینوسی جزء هیپرکالمی نیست.",
            "دلیل رد گزینه: ایدیوونتریکلر کند در هیپرکالمی دیده می‌شود."
        ],
        "reasons_en": [
            "Why incorrect: VT seen in hyperkalemia.",
            "Why incorrect: Asystole seen.",
            "Correct: Sinus tachy not part hyperkalemia.",
            "Why incorrect: Slow idioventricular seen."
        ],
        "lead_fa": "هیپرکالمی یعنی برادی و پهن.",
        "lead_en": "Hyperkalemia means brady and wide.",
        "golden_fa": "سینوسی تند مال هیپرکالمی نیست.",
        "golden_en": "Sinus tachy not hyperkalemia.",
        "points_fa": ["T بلند.", "QRS پهن.", "کلسیم.", "انسولین."],
        "points_en": ["Tall T.", "Wide QRS.", "Calcium.", "Insulin."],
        "hint_fa": "کدام تند مال پتاسیم نیست؟",
        "hint_en": "Which tachy not of K?",
        "attending_fa": "استاد: هیپرکالمی را با برادی بشناس.",
        "attending_en": "Attending: Know hyperK by brady."
    },
    (1,215): {
        "interpretation_fa": "فشار مخفی با فشار مطب طبیعی و میانگین خارج مطب بالا تعریف می‌شود و با آترواسکلروز، درگیری قلبی، bruit و آلبومینوری همراه است ولی «فشار در معاینه بالا و grade II» توصیف white coat است نه masked و «غلط» همین است. تشخیص با هولتر یا HBPM و درمان مشابه پرفشاری است. این نکته در هاریسون با تأکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "Masked HTN office normal and out-of-office high and with atherosclerosis, cardiac involvement, bruit and albuminuria but 'office high grade II' describes white coat not masked and is 'false'. Diagnosis with Holter or HBPM and therapy similar HTN.",
        "reasons_fa": [
            "دلیل رد گزینه: آترواسکلروز در masked دیده می‌شود.",
            "دلیل رد گزینه: درگیری قلبی در masked دیده می‌شود.",
            "دلیل رد گزینه: آلبومینوری در masked دیده می‌شود.",
            "گزینه صحیح: فشار بالا در مطب masked نیست و «غلط» همین است."
        ],
        "reasons_en": [
            "Why incorrect: Atherosclerosis in masked seen.",
            "Why incorrect: Cardiac involvement seen.",
            "Why incorrect: Albuminuria seen.",
            "Correct: Office high not masked and is 'false'."
        ],
        "lead_fa": "masked یعنی مطب نرمال بیرون بالا.",
        "lead_en": "Masked means office normal out high.",
        "golden_fa": "مطب بالا masked نیست.",
        "golden_en": "Office high not masked.",
        "points_fa": ["هولتر.", "HBPM.", "آلبومین.", "bruit."],
        "points_en": ["Holter.", "HBPM.", "Albumin.", "Bruit."],
        "hint_fa": "کدام توصیف masked نیست؟",
        "hint_en": "Which not masked?",
        "attending_fa": "استاد: masked را با هولتر بشناس.",
        "attending_en": "Attending: Know masked with Holter."
    },
    (1,216): {
        "interpretation_fa": "نوار بلوک زیرنودی مانند موبیتز ۲ یا درجه سه با QRS پهن، با افزایش ضربان بدتر می‌شود و آتروپین مفید نیست و تقریباً همیشه زیرنودی است و در ناپایداری پیس موقت لازم است؛ اینکه «با افزایش ضربان بهتر می‌شود» در بلوک گره‌ای است نه زیرنودی و «صحیح نیست» همین است. این نکته در هاریسون با تأکید بر سطح بلوک آمده است.",
        "interpretation_en": "Subnodal block like Mobitz2 or third with wide QRS worsens with rate and atropine not useful and almost always infranodal and in instability temporary pacing needed; 'better with rate increase' is nodal not subnodal and is 'not correct'. Harrison emphasizes block level.",
        "reasons_fa": [
            "دلیل رد گزینه: زیرنودی همیشه بلوک زیرنودی است.",
            "گزینه صحیح: بهتر شدن با ضربان در زیرنودی صحیح نیست.",
            "دلیل رد گزینه: آتروپین در زیرنودی مفید نیست.",
            "دلیل رد گزینه: ناپایداری پیس می‌خواهد."
        ],
        "reasons_en": [
            "Why incorrect: Infranodal always infranodal.",
            "Correct: Better with rate in infranodal not correct.",
            "Why incorrect: Atropine in infranodal not useful.",
            "Why incorrect: Instability needs pacing."
        ],
        "lead_fa": "زیرنودی با ضربان بدتر می‌شود.",
        "lead_en": "Infranodal worsens with rate.",
        "golden_fa": "آتروپین زیرنودی نده.",
        "golden_en": "Don't atropine infranodal.",
        "points_fa": ["QRS پهن.", "موبیتز2.", "پیس.", "زیرنودی."],
        "points_en": ["Wide QRS.", "Mobitz2.", "Pace.", "Infranodal."],
        "hint_fa": "کدام با تند شدن بهتر نمی‌شود؟",
        "hint_en": "Which not better with fast?",
        "attending_fa": "استاد: زیرنودی را با پیس بسنج.",
        "attending_en": "Attending: Judge infranodal with pace."
    },
    (1,217): {
        "interpretation_fa": "آنژین پایدار ۲ تا ۵ دقیقه، crescendo-decrescendo، انتشار اولنار چپ و به ندرت زیر ناف است و با استراحت یا نیترو آرام می‌شود و با تلاش می‌آید؛ جمله «محل درد اولنار است» صحیح و رایج است ولی «آنژین معمولاً ماهیت crescendo دارد» نیز صحیح است و در این کلید «زیر ناف کم» به‌عنوان غلط انتخاب نشده و کلید رسمی «اولنار» را به‌عنوان صحیح معرفی می‌کند و ما با کلید همسو می‌شویم. این نکته در هاریسون با تأکید بر انتشار آمده است.",
        "interpretation_en": "Stable angina 2-5 min, crescendo, left ulnar radiation and rarely subumbilical and relieved by rest or nitro and exertional; 'ulnar location' correct and common but 'crescendo' also correct and in this key 'subumbilical rare' not chosen as false and official key picks 'ulnar' as correct and we align.",
        "reasons_fa": [
            "گزینه صحیح: نشان دادن اولنار در آنژین صحیح است.",
            "دلیل رد گزینه: crescendo در آنژین دیده می‌شود.",
            "دلیل رد گزینه: ۲-۵ دقیقه در آنژین دیده می‌شود.",
            "دلیل رد گزینه: زیر ناف به ندرت دیده می‌شود."
        ],
        "reasons_en": [
            "Correct: Showing ulnar in angina correct.",
            "Why incorrect: Crescendo in angina seen.",
            "Why incorrect: 2-5 min in angina seen.",
            "Why incorrect: Subumbilical rarely seen."
        ],
        "lead_fa": "آنژین یعنی اولنار.",
        "lead_en": "Angina means ulnar.",
        "golden_fa": "انتشار اولنار را بشناس.",
        "golden_en": "Know ulnar radiation.",
        "points_fa": ["۲-۵ دقیقه.", "crescendo.", "نیترو.", "زیر ناف نه."],
        "points_en": ["2-5 min.", "Crescendo.", "Nitro.", "Not subumbilical."],
        "hint_fa": "کدام توصیف آنژین درست است؟",
        "hint_en": "Which angina description correct?",
        "attending_fa": "استاد: آنژین را با اولنار بشناس.",
        "attending_en": "Attending: Know angina by ulnar."
    },
    (1,218): {
        "interpretation_fa": "فیبریلاسیون دهلیزی با ریتم کاملاً نامنظم و بدون موج P مشخص و پاسخ بطنی نامنظم است؛ این نکته در هاریسون با تأکید بر معاینه نبض و نوار آمده است. و بدون موج P مشخص و پاسخ بطنی نامنظم است؛ تراسه B یا C یا A/D بسته به نمایش، AF با بی‌نظمی را نشان می‌دهد و کلید رسمی B را AF می‌خواند. افتراق از فلاتر با نظم و دندانه‌اره‌ای و از SVT با نظم است و درمان بر کنترل ضربان و ضد انعقاد متکی است. این نکته در هاریسون با تأکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "AF with completely irregular and no distinct P and irregular ventricular response; tracing B or C or A/D depending display, AF with irregularity and official key B reads AF. Differentiate from flutter with regularity and sawtooth and from SVT with regularity and therapy rate and anticoag.",
        "reasons_fa": [
            "دلیل رد گزینه: A در این کلید AF نیست.",
            "گزینه صحیح: B در این کلید AF است.",
            "دلیل رد گزینه: C در این کلید AF نیست.",
            "دلیل رد گزینه: D در این کلید AF نیست."
        ],
        "reasons_en": [
            "Why incorrect: A in this key not AF.",
            "Correct: B in this key AF.",
            "Why incorrect: C in this key not AF.",
            "Why incorrect: D in this key not AF."
        ],
        "lead_fa": "نامنظم بی‌P یعنی AF.",
        "lead_en": "Irregular no P means AF.",
        "golden_fa": "AF را با بی‌نظمی بشناس.",
        "golden_en": "Know AF by irregular.",
        "points_fa": ["بی‌نظم.", "P ندارد.", "ضد انعقاد.", "کنترل ضربان."],
        "points_en": ["Irregular.", "No P.", "Anticoag.", "Rate control."],
        "hint_fa": "کدام تراسه AF است؟",
        "hint_en": "Which tracing AF?",
        "attending_fa": "استاد: AF را با بی‌نظمی ببین.",
        "attending_en": "Attending: See AF by irregular."
    },
    (1,219): {
        "interpretation_fa": "موج ورید ژوگولر با a برجسته X کم در تنگی تریکوسپید و CV بارز در نارسایی تریکوسپید دیده می‌شود؛ نارسایی شدید تریکوسپید با موج CV بزرگ و y عمیق و فشار وریدی بالا همراه است و تصویر با CV بزرگ به نفع نارسایی شدید است نه تامپوناد یا کانستریکشن یا محدودکننده به‌تنهایی. اکو شدت و فشار را می‌سنجد و این نکته در هاریسون با تأکید بر معاینه ورید آمده است.",
        "interpretation_en": "Jugular wave with prominent a shallow X in TS and prominent CV in TR; severe TR with large CV and deep y and high venous pressure and image with large CV favors severe TR not tamponade or constriction or restrictive alone. Echo measures severity and pressure and Harrison emphasizes vein exam.",
        "reasons_fa": [
            "گزینه صحیح: نارسایی شدید تریکوسپید CV بزرگ می‌دهد.",
            "دلیل رد گزینه: تامپوناد CV تیپیک نمی‌دهد.",
            "دلیل رد گزینه: کانستریکشن Xy عمیق می‌دهد نه CV بزرگ.",
            "دلیل رد گزینه: محدودکننده CV بزرگ تیپیک نمی‌دهد."
        ],
        "reasons_en": [
            "Correct: Severe TR gives large CV.",
            "Why incorrect: Tamponade not typical CV.",
            "Why incorrect: Constriction deep Xy not large CV.",
            "Why incorrect: Restrictive not typical large CV."
        ],
        "lead_fa": "CV بزرگ یعنی TR شدید.",
        "lead_en": "Large CV means severe TR.",
        "golden_fa": "TR شدید را با CV بشناس.",
        "golden_en": "Know severe TR by CV.",
        "points_fa": ["a.", "CV.", "y.", "اکو."],
        "points_en": ["a.", "CV.", "y.", "Echo."],
        "hint_fa": "کدام نارسایی CV بزرگ می‌دهد؟",
        "hint_en": "Which regurg large CV?",
        "attending_fa": "استاد: CV را TR ببین.",
        "attending_en": "Attending: See CV as TR."
    },
    (1,220): {
        "interpretation_fa": "هیپوتانسیون با برون‌ده بالا از گشادشدگی عروقی و مقاومت کم می‌آید و در تیروتوکسیکوز، پانکراتیت، نارسایی کبدی، سپسیس و آنمی دیده می‌شود ولی پلی‌اوری علت high output نیست و «بجز» همین است. پلی‌اوری بیشتر دهیدراتاسیون و افت پیش‌بار می‌دهد نه high output و افتراق با low output با اکو و لاکتات است.",
        "interpretation_en": "Hypotension with high output from vasodilation and low resistance and in thyrotoxicosis, pancreatitis, liver failure, sepsis and anemia but polyuria not cause high output and is 'except'. Polyuria more dehydration and low preload not high output and differentiation with low output by echo and lactate.",
        "reasons_fa": [
            "دلیل رد گزینه: تیروتوکسیکوز high output می‌دهد.",
            "دلیل رد گزینه: پانکراتیت high output می‌دهد.",
            "گزینه صحیح: پلی‌اوری high output نمی‌دهد و «بجز» همین است.",
            "دلیل رد گزینه: نارسایی کبدی high output می‌دهد."
        ],
        "reasons_en": [
            "Why incorrect: Thyrotoxicosis gives high output.",
            "Why incorrect: Pancreatitis gives high output.",
            "Correct: Polyuria not give high output and is 'except'.",
            "Why incorrect: Liver failure gives high output."
        ],
        "lead_fa": "high output یعنی گشاد عروقی.",
        "lead_en": "High output means vasodilation.",
        "golden_fa": "پلی‌اوری high output نیست.",
        "golden_en": "Polyuria not high output.",
        "points_fa": ["تیروتوکس.", "سپسیس.", "کبد.", "پانکراتیت."],
        "points_en": ["Thyrotox.", "Sepsis.", "Liver.", "Pancreatitis."],
        "hint_fa": "کدام high output نمی‌دهد؟",
        "hint_en": "Which not high output?",
        "attending_fa": "استاد: high output را با گشاد بشناس.",
        "attending_en": "Attending: Know high output by dilation."
    },
    (2,1): {
        "interpretation_fa": "مرد ۵۵ ساله با درد دو ساعته، افت فشار ۸۰/۵۵ و ریه پاک، انفارکتوس تحتانی با بطن راست را مطرح می‌کند؛ هماهنگی آنژیو و مایع سریع کمک‌کننده است و پتدین درد را کم می‌کند ولی نیترو وریدی با افت فشار و وابستگی به پیش‌بار «صحیح نیست» و ممنوع است و بولوس سالین و پرهیز نیترو اساس است. سه‌گانه راست و V4R کمک می‌کند.",
        "interpretation_en": "A 55-year-old with 2h pain, 80/55 and clear lungs suggests inferior with RV; angio coordination and rapid fluid helpful and pethidine pain reduces but IV nitro with low pressure and preload dependence 'not correct' and prohibited and saline bolus and avoid nitro base. RV triad and V4R helps.",
        "reasons_fa": [
            "دلیل رد گزینه: آنژیو اورژانس صحیح است.",
            "دلیل رد گزینه: پتدین صحیح است.",
            "دلیل رد گزینه: مایع سریع صحیح است.",
            "گزینه صحیح: نیترو وریدی با افت صحیح نیست."
        ],
        "reasons_en": [
            "Why incorrect: Emergency angio correct.",
            "Why incorrect: Pethidine correct.",
            "Why incorrect: Rapid fluid correct.",
            "Correct: IV nitro with drop not correct."
        ],
        "lead_fa": "افت+ریه پاک یعنی نیترو نده.",
        "lead_en": "Drop+clear lungs means no nitro.",
        "golden_fa": "راست را با سالین پر کن.",
        "golden_en": "Fill right with saline.",
        "points_fa": ["V4R.", "فشار.", "مایع.", "آنژیو."],
        "points_en": ["V4R.", "Pressure.", "Fluid.", "Angio."],
        "hint_fa": "با 80 کدام وریدی نده؟",
        "hint_en": "Which IV not to give at 80?",
        "attending_fa": "استاد: افت را نیترو نده.",
        "attending_en": "Attending: Don't nitro drop."
    },
    (2,2): {
        "interpretation_fa": "مرد ۳۵ ساله با درد استراحتی ۵ دقیقه‌ای که هیپرونتیلاسیون ایجاد می‌کند، اسپاسم یا درد غیرکرونری با الگوی هیپرونتیلاسیون را مطرح می‌کند؛ نیترو، آملودیپین و وراپامیل با گشاد عروقی یا کاهش اسپاسم کمک می‌کنند ولی آسپیرین در درد هیپرونتیلاسیونی بدون ریسک کرونری، نادرست و «نادرست» همین است. بررسی اضطراب و تست ورزش در مناسب کمک می‌کند.",
        "interpretation_en": "A 35-year-old with 5-min rest pressing pain hyperventilation triggers, spasm or noncoronary with hyperventilation pattern; nitro, amlodipine and verapamil with vasodilation or less spasm help but aspirin in hyperventilation pain without coronary risk incorrect and is 'incorrect'. Anxiety and exercise test in suitable help.",
        "reasons_fa": [
            "دلیل رد گزینه: نیترو در اسپاسم درست است.",
            "دلیل رد گزینه: آملودیپین درست است.",
            "گزینه صحیح: آسپیرین در هیپرونتیلاسیون نادرست است.",
            "دلیل رد گزینه: وراپامیل درست است."
        ],
        "reasons_en": [
            "Why incorrect: Nitro in spasm correct.",
            "Why incorrect: Amlodipine correct.",
            "Correct: Aspirin in hyperventilation incorrect.",
            "Why incorrect: Verapamil correct."
        ],
        "lead_fa": "هیپرونتیلاسیون یعنی آسپیرین نده.",
        "lead_en": "Hyperventilation means no aspirin.",
        "golden_fa": "اسپاسم را با CCB آرام کن.",
        "golden_en": "Calm spasm with CCB.",
        "points_fa": ["اسپاسم.", "هیپرونتیل.", "CCB.", "نیترو."],
        "points_en": ["Spasm.", "Hypervent.", "CCB.", "Nitro."],
        "hint_fa": "کدام قرص مال هیپرونتیل نیست؟",
        "hint_en": "Which pill not for hypervent?",
        "attending_fa": "استاد: هیپرونتیل را آسپیرین نده.",
        "attending_en": "Attending: Don't aspirin hypervent."
    },
    (2,3): {
        "interpretation_fa": "مرد ۵۹ ساله دیابتی پرفشاری با درد خفیف استراحتی یک هفته قبل ۴۰ دقیقه‌ای به تراپزیوس، تب خفیف، راب و لکوسیتوز، پریکاردیت پس از ایسکمی یا Dressler را مطرح می‌کند نه انفارکتوس حاد؛ فریکشن راب به ضرر انفارکتوس است و محل انتشار به تراپزیوس بیشتر پریکاردی است و تب و لکوسیتوز هر دو می‌آیند ولی راب متمایزکننده است.",
        "interpretation_en": "A 59-year-old diabetic hypertensive with mild rest pain one week ago 40-min to trapezius, mild fever, rub and leukocytosis suggests pericarditis after ischemia or Dressler not acute MI; friction rub against MI and trapezius radiation more pericardial and fever and leukocytosis both come but rub distinctive.",
        "reasons_fa": [
            "دلیل رد گزینه: راب در پریکاردیت دیده می‌شود ولی کلید انتشار است.",
            "گزینه صحیح: انتشار تراپزیوس به ضرر انفارکتوس است.",
            "دلیل رد گزینه: لکوسیتوز در هر دو دیده می‌شود.",
            "دلیل رد گزینه: تب در هر دو دیده می‌شود."
        ],
        "reasons_en": [
            "Why incorrect: Rub in pericarditis but key radiation.",
            "Correct: Trapezius radiation against MI.",
            "Why incorrect: Leukocytosis in both.",
            "Why incorrect: Fever in both."
        ],
        "lead_fa": "تراپزیوس یعنی پریکاردیت.",
        "lead_en": "Trapezius means pericarditis.",
        "golden_fa": "تراپزیوس را پریکاردی بدان.",
        "golden_en": "Know trapezius as pericardial.",
        "points_fa": ["راب.", "تراپزیوس.", "Dressler.", "MI را رد کن."],
        "points_en": ["Rub.", "Trapezius.", "Dressler.", "Rule MI."],
        "hint_fa": "کدام صدا MI را رد می‌کند؟",
        "hint_en": "Which sound rejects MI?",
        "attending_fa": "استاد: راب را ضد MI ببین.",
        "attending_en": "Attending: See rub against MI."
    },
    (2,4): {
        "interpretation_fa": "ASD با شانت چپ‌به‌راست مزمن، دهلیز و بطن راست و شریان ریوی را بزرگ و در درازمدت آریتمی دهلیزی به‌ویژه فیبریلاسیون را زیاد می‌کند؛ این نکته در هاریسون با تأکید بر اکو و پیگیری آمده است.، دهلیز و بطن راست و شریان ریوی را بزرگ و در درازمدت آریتمی دهلیزی به‌ویژه فیبریلاسیون را زیاد می‌کند؛ فیبریلاسیون بطنی، جانکشنال یا بطنی افزایش تیپیک ASD نیست و فیبریلاسیون دهلیزی شایع‌ترین است و اکو و هولتر کمک می‌کند و بستن زود خطر را کم می‌کند. این نکته در هاریسون با تأکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "ASD with chronic left-to-right enlarges RA and RV and PA and long term atrial arrhythmia especially AF increases; VF, junctional or VT not typical ASD increase and AF most common and echo and Holter help and early closure reduces risk.",
        "reasons_fa": [
            "گزینه صحیح: فیبریلاسیون دهلیزی در ASD شایع‌ترین است.",
            "دلیل رد گزینه: فیبریلاسیون بطنی شایع نیست.",
            "دلیل رد گزینه: تاکی جانکشنال شایع نیست.",
            "دلیل رد گزینه: تاکی بطنی شایع نیست."
        ],
        "reasons_en": [
            "Correct: AF in ASD most common.",
            "Why incorrect: VF not common.",
            "Why incorrect: Junctional not common.",
            "Why incorrect: VT not common."
        ],
        "lead_fa": "ASD مزمن یعنی AF.",
        "lead_en": "Chronic ASD means AF.",
        "golden_fa": "ASD را با AF بشناس.",
        "golden_en": "Know ASD by AF.",
        "points_fa": ["شانت.", "RA.", "فیبریلاسیون.", "بستن."],
        "points_en": ["Shunt.", "RA.", "Fibrillation.", "Closure."],
        "hint_fa": "کدام آریتمی ASD را می‌گیرد؟",
        "hint_en": "Which arrhythmia ASD?",
        "attending_fa": "استاد: ASD را AF ببین.",
        "attending_en": "Attending: See ASD as AF."
    },
    (2,5): {
        "interpretation_fa": "مرد ۳۳ ساله با تپش ناگهانی ماهانه چند دقیقه‌ای و معاینه نرمال و نوار با QRS باریک منظم و P متفاوت، تاکی فوق بطنی حمله‌ای را مطرح می‌کند؛ VT مداوم یا غیرمداوم با QRS پهن و فیبریلاسیون حمله‌ای با بی‌نظمی همراه است. درمان حاد واگال و آدنوزین و پیشگیری بتا یا ابلیشن است و هولتر کمک می‌کند.",
        "interpretation_en": "A 33-year-old with sudden monthly minutes palpitation and normal exam and ECG narrow regular QRS and different P suggests paroxysmal SVT; sustained or nonsustained VT with wide QRS and paroxysmal AF with irregularity. Acute vagal and adenosine and prevention beta or ablation and Holter helps.",
        "reasons_fa": [
            "دلیل رد گزینه: VT مداوم QRS پهن است.",
            "دلیل رد گزینه: VT غیرمداوم QRS پهن است.",
            "گزینه صحیح: SVT حمله‌ای QRS باریک منظم است.",
            "دلیل رد گزینه: AF حمله‌ای بی‌نظم است."
        ],
        "reasons_en": [
            "Why incorrect: Sustained VT wide QRS.",
            "Why incorrect: Nonsustained VT wide QRS.",
            "Correct: Paroxysmal SVT narrow regular.",
            "Why incorrect: Paroxysmal AF irregular."
        ],
        "lead_fa": "تپش منظم باریک یعنی SVT.",
        "lead_en": "Regular narrow palpitation means SVT.",
        "golden_fa": "SVT حمله‌ای را بشناس.",
        "golden_en": "Know paroxysmal SVT.",
        "points_fa": ["QRS باریک.", "ناگهانی.", "واگال.", "آدنوزین."],
        "points_en": ["Narrow QRS.", "Sudden.", "Vagal.", "Adenosine."],
        "hint_fa": "کدام تاکی باریک منظم است؟",
        "hint_en": "Which tachy narrow regular?",
        "attending_fa": "استاد: SVT را با باریکی بشناس.",
        "attending_en": "Attending: Know SVT by narrow."
    },
    (2,6): {
        "interpretation_fa": "افت فشار با SVR پایین از گشادشدگی عروقی می‌آید و در شوک سپتیک با مقاومت کم و برون‌ده بالا دیده می‌شود؛ این نکته در هاریسون با تأکید بر لاکتات و کشت و درمان سریع آمده است. از گشادشدگی عروقی می‌آید و در شوک سپتیک با مقاومت کم و برون‌ده بالا دیده می‌شود؛ نارسایی راست، تامپوناد و نارسایی میترال بیشتر با برون‌ده پایین یا انسدادی هستند و SVR پایین تیپیک سپتیک است و لاکتات و کشت کمک می‌کند. این نکته در هاریسون با تأکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "Drop with low SVR from vasodilation and in septic shock with low resistance and high output; right failure, tamponade and acute MR more low output or obstructive and low SVR typical septic and lactate and cultures help.",
        "reasons_fa": [
            "دلیل رد گزینه: نارسایی راست SVR پایین تیپیک نیست.",
            "گزینه صحیح: سپتیک SVR پایین می‌دهد.",
            "دلیل رد گزینه: تامپوناد انسدادی است.",
            "دلیل رد گزینه: نارسایی میترال low output است."
        ],
        "reasons_en": [
            "Why incorrect: Right failure not typical low SVR.",
            "Correct: Septic gives low SVR.",
            "Why incorrect: Tamponade obstructive.",
            "Why incorrect: MR low output."
        ],
        "lead_fa": "SVR پایین یعنی سپتیک.",
        "lead_en": "Low SVR means septic.",
        "golden_fa": "سپتیک را با گشاد بشناس.",
        "golden_en": "Know septic by dilation.",
        "points_fa": ["SVR.", "سپسیس.", "لاکتات.", "آنتی‌بیوتیک."],
        "points_en": ["SVR.", "Sepsis.", "Lactate.", "Antibiotic."],
        "hint_fa": "کدام شوک مقاومت را کم می‌کند؟",
        "hint_en": "Which shock lowers resistance?",
        "attending_fa": "استاد: SVR پایین را سپتیک ببین.",
        "attending_en": "Attending: See low SVR septic."
    },
    (2,7): {
        "interpretation_fa": "در CPR با یک دفیبریلاسیون و ماساژ و لوله و رگ، ریتم بعدی تصمیم می‌دهد؛ در VF/VT بی‌نبض مقاوم، آمیودارون و سپس اپی‌نفرین مطرح است ولی آتروپین در آسیستول یا PEA قدیم بود و منیزیوم فقط در torsades یا هیپومنیزیمی و روتین نیست؛ در این سناریو اپی‌نفرین قدم بعدی استاندارد است و آمیودارون پس از اپی در VF مقاوم مطرح است ولی سوال اپی را انتخاب کرده است.",
        "interpretation_en": "In CPR with one defib and compressions and tube and line, next rhythm decides; in refractory pulseless VF/VT amiodarone and then epi considered but atropine in asystole or PEA old and Mg only in torsades or hypoMg and not routine; in this scenario epi next standard and amiodarone after epi in refractory VF considered but question picks epi.",
        "reasons_fa": [
            "دلیل رد گزینه: منیزیوم روتین CPR نیست.",
            "دلیل رد گزینه: آمیودارون پس از اپی مطرح است ولی سوال اپی است.",
            "دلیل رد گزینه: آتروپین روتین VF نیست.",
            "گزینه صحیح: اپی‌نفرین قدم بعدی CPR است."
        ],
        "reasons_en": [
            "Why incorrect: Mg not routine CPR.",
            "Why incorrect: Amiodarone after epi but question epi.",
            "Why incorrect: Atropine not routine VF.",
            "Correct: Epinephrine next step CPR."
        ],
        "lead_fa": "CPR یعنی اپی.",
        "lead_en": "CPR means epi.",
        "golden_fa": "اپی را فراموش نکن.",
        "golden_en": "Don't forget epi.",
        "points_fa": ["دفیب.", "ماساژ.", "اپی.", "آمیودارون."],
        "points_en": ["Defib.", "Compress.", "Epi.", "Amiodarone."],
        "hint_fa": "پس از یک شوک کدام دارو؟",
        "hint_en": "Which drug after one shock?",
        "attending_fa": "استاد: CPR را با اپی ادامه بده.",
        "attending_en": "Attending: Continue CPR with epi."
    },
    (2,8): {
        "interpretation_fa": "زن ۳۵ ساله روماتیسمی با تنگی میترال و تپش، فیبریلاسیون دهلیزی با ریسک ترومبوآمبولی بالا دارد؛ این نکته در هاریسون با تأکید بر اندیکاسیون وارفارین و پایش INR آمده است. با تنگی میترال و تپش، فیبریلاسیون دهلیزی با ریسک ترومبوآمبولی بالا دارد؛ در تنگی میترال روماتیسمی با AF یا سابقه آمبولی، وارفارین با INR هدف ارجح است و ریواروکسابان یا آسپیرین یا عدم درمان در این اندیکاسیون مناسب نیست و اکو ترومبوز دهلیز را می‌بیند. این نکته در هاریسون با تأکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "A 35-year-old rheumatic with MS and palpitation, AF with high thromboembolic risk; in rheumatic MS with AF or embolic, warfarin with target INR preferred and rivaroxaban or aspirin or no therapy in this indication not suitable and echo sees atrial thrombus.",
        "reasons_fa": [
            "دلیل رد گزینه: ریواروکسابان در MS روماتیسمی ارجح نیست.",
            "دلیل رد گزینه: آسپیرین کافی نیست.",
            "گزینه صحیح: وارفارین در MS با AF ارجح است.",
            "دلیل رد گزینه: عدم درمان با AF مناسب نیست."
        ],
        "reasons_en": [
            "Why incorrect: Rivaroxaban in rheumatic MS not preferred.",
            "Why incorrect: Aspirin insufficient.",
            "Correct: Warfarin in MS with AF preferred.",
            "Why incorrect: No therapy with AF not suitable."
        ],
        "lead_fa": "MS روماتیسمی+AF یعنی وارفارین.",
        "lead_en": "Rheumatic MS+AF means warfarin.",
        "golden_fa": "NOAC در MS روماتیسمی نه.",
        "golden_en": "NOAC not in rheumatic MS.",
        "points_fa": ["AF.", "ترومبوز.", "INR.", "اکو."],
        "points_en": ["AF.", "Thrombus.", "INR.", "Echo."],
        "hint_fa": "کدام ضد انعقاد با MS می‌ماند؟",
        "hint_en": "Which anticoag stays with MS?",
        "attending_fa": "استاد: MS را با وارفارین بسنج.",
        "attending_en": "Attending: Judge MS with warfarin."
    },
    (2,9): {
        "interpretation_fa": "افیوژن ماسیو پریکارد با بزرگی قلب در CXR، ولتاژ پایین و آلترنانس و افت فشار و پالس پارادوکس همراه است ولی کاهش کسر تخلیه در اکو دیده نمی‌شود؛ این نکته در هاریسون با تأکید بر اکو و افتراق تامپوناد آمده است. با بزرگی قلب در CXR، ولتاژ پایین و آلترنانس و افت فشار و پالس پارادوکس همراه است ولی کاهش کسر تخلیه در اکو دیده نمی‌شود؛ EF معمولاً حفظ است و مشکل پرشدگی دیاستولیک است نه سیستولیک. اکو افیوژن را می‌بیند و تامپوناد را با کلاپس ارزیابی می‌کند. این نکته در هاریسون با تأکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "Massive pericardial effusion with cardiomegaly on CXR, low voltage and alternans and hypotension and paradoxus but reduced EF on echo not seen; EF usually preserved and problem diastolic filling not systolic. Echo sees effusion and tamponade with collapse evaluated.",
        "reasons_fa": [
            "گزینه صحیح: کاهش EF در افیوژن ماسیو دیده نمی‌شود.",
            "دلیل رد گزینه: آلترنانس در افیوژن دیده می‌شود.",
            "دلیل رد گزینه: بزرگی قلب در CXR دیده می‌شود.",
            "دلیل رد گزینه: افت فشار دیده می‌شود."
        ],
        "reasons_en": [
            "Correct: Reduced EF in massive effusion not seen.",
            "Why incorrect: Alternans in effusion seen.",
            "Why incorrect: Cardiomegaly on CXR seen.",
            "Why incorrect: Hypotension seen."
        ],
        "lead_fa": "افیوژن ماسیو یعنی EF حفظ است.",
        "lead_en": "Massive effusion means EF preserved.",
        "golden_fa": "EF را کم نبین.",
        "golden_en": "Don't see low EF.",
        "points_fa": ["CXR بزرگ.", "آلترنانس.", "افت.", "اکو."],
        "points_en": ["Large CXR.", "Alternans.", "Drop.", "Echo."],
        "hint_fa": "کدام در افیوژن نیست؟",
        "hint_en": "Which not in effusion?",
        "attending_fa": "استاد: افیوژن را با EF حفظ ببین.",
        "attending_en": "Attending: See effusion preserved EF."
    },
    (2,10): {
        "interpretation_fa": "نوجوان ۱۶ ساله با سنکوپ، افتراق تشنج با بی‌اختیاری مدفوعی/ادراری، حرکات تونیک کلونیک و دیس‌اوریانتاسیون پس‌حمله کمک می‌کند؛ بی‌اختیاری مدفوعی با حساسیت کمتر و بیشتر در تشنج شدید یا سنکوپ طولانی هم دیده می‌شود و افتراق کمتری نسبت به ادراری یا حرکات یا گیجی طولانی دارد. شرح حال شاهد و نوار قلب و EEG کمک می‌کند.",
        "interpretation_en": "A 16-year-old with syncope, differentiate seizure with fecal/urinary incontinence, tonic-clonic and postictal disorientation; fecal with less sensitivity and more in severe seizure or long syncope also seen and less discriminating than urinary or movements or prolonged confusion. Witness history and ECG and EEG help.",
        "reasons_fa": [
            "دلیل رد گزینه: بی‌اختیاری مدفوعی افتراق کمتری دارد ولی کلید ادراری است.",
            "گزینه صحیح: بی‌اختیاری ادراری افتراق بیشتری می‌دهد.",
            "دلیل رد گزینه: تونیک کلونیک افتراق بهتری می‌دهد.",
            "دلیل رد گزینه: گیجی طولانی افتراق بهتری می‌دهد."
        ],
        "reasons_en": [
            "Why incorrect: Fecal less but key urinary.",
            "Correct: Urinary better discriminating.",
            "Why incorrect: Tonic-clonic better.",
            "Why incorrect: Prolonged confusion better."
        ],
        "lead_fa": "مدفوعی افتراق کم دارد.",
        "lead_en": "Fecal less discriminating.",
        "golden_fa": "تشنج را با ادراری بسنج.",
        "golden_en": "Judge seizure by urinary.",
        "points_fa": ["تونیک.", "ادراری.", "گیجی.", "ECG."],
        "points_en": ["Tonic.", "Urinary.", "Confusion.", "ECG."],
        "hint_fa": "کدام افتراق کم می‌دهد؟",
        "hint_en": "Which less discriminates?",
        "attending_fa": "استاد: تشنج را با ادراری بشناس.",
        "attending_en": "Attending: Know seizure by urinary."
    },
    (2,11): {
        "interpretation_fa": "پالس پارادوکس افت بیش از ۱۰ میلی‌متر فشار سیستولیک با دم است و در تامپوناد، آسم شدید و بیماری انسدادی دیده می‌شود؛ این نکته در هاریسون با تأکید بر اندازه‌گیری با تنفس و اکو آمده است. بیش از ۱۰ میلی‌متر فشار سیستولیک با دم است و در تامپوناد، آسم شدید و بیماری انسدادی دیده می‌شود؛ افزایش با دم یا افت با بازدم یا افزایش با دم تعریف نیست و افت با دم صحیح است. اندازه‌گیری با فشارسنج و تنفس و اکو کمک می‌کند. این نکته در هاریسون با تأکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "Pulsus paradoxus drop >10 mm systolic with inspiration and seen in tamponade, severe asthma and obstructive; increase with inspiration or drop with expiration or increase with inspiration not definition and drop with inspiration correct. Measure with cuff and breathing and echo helps.",
        "reasons_fa": [
            "دلیل رد گزینه: افزایش با دم تعریف نیست.",
            "دلیل رد گزینه: افت با بازدم تعریف نیست.",
            "دلیل رد گزینه: افزایش با دم تعریف نیست.",
            "گزینه صحیح: افت بیش از ۱۰ با دم تعریف است."
        ],
        "reasons_en": [
            "Why incorrect: Increase with inspiration not definition.",
            "Why incorrect: Drop with expiration not definition.",
            "Why incorrect: Increase with inspiration not definition.",
            "Correct: Drop >10 with inspiration definition."
        ],
        "lead_fa": "پارادوکس یعنی افت با دم.",
        "lead_en": "Paradox means drop with inspiration.",
        "golden_fa": "۱۰ میلی‌متر را قدر بدان.",
        "golden_en": "Value 10 mm.",
        "points_fa": ["تامپوناد.", "آسم.", "فشار.", "اکو."],
        "points_en": ["Tamponade.", "Asthma.", "Pressure.", "Echo."],
        "hint_fa": "کدام افت پارادوکس است؟",
        "hint_en": "Which drop paradox?",
        "attending_fa": "استاد: پارادوکس را با دم بسنج.",
        "attending_en": "Attending: Judge paradox with inspiration."
    },
    (2,12): {
        "interpretation_fa": "در NSTEMI، تروپونین مثبت، CRP مثبت و دیابت همراه ریسک بالاتر و ESR بالا به‌تنهایی کم‌خطرتر از تروپونین یا CRP یا دیابت است و در این سوال خانم ۶۰ ساله با ESR بالا کم‌خطرتر انتخاب شده است. ریسک کلی با GRACE و تغییرات ST و نارسایی تعیین می‌شود و آنتی‌پلاکت و آنتی‌کوآگولانت و استاتین پایه است.",
        "interpretation_en": "In NSTEMI, positive troponin, positive CRP and diabetes higher risk and high ESR alone less risky than troponin or CRP or diabetes and in this question 60-year-old woman with high ESR less risky chosen. Overall risk with GRACE and ST changes and failure and antiplatelet and anticoag and statin base.",
        "reasons_fa": [
            "دلیل رد گزینه: تروپونین مثبت پرخطر است.",
            "دلیل رد گزینه: CRP مثبت پرخطر است.",
            "گزینه صحیح: ESR بالا کم‌خطرتر است.",
            "دلیل رد گزینه: دیابت پرخطر است."
        ],
        "reasons_en": [
            "Why incorrect: Positive troponin high-risk.",
            "Why incorrect: Positive CRP high-risk.",
            "Correct: High ESR less risky.",
            "Why incorrect: Diabetes high-risk."
        ],
        "lead_fa": "ESR کم‌خطرتر از تروپونین است.",
        "lead_en": "ESR less risky than troponin.",
        "golden_fa": "ریسک را با تروپونین بسنج.",
        "golden_en": "Judge risk by troponin.",
        "points_fa": ["تروپونین.", "CRP.", "دیابت.", "GRACE."],
        "points_en": ["Troponin.", "CRP.", "Diabetes.", "GRACE."],
        "hint_fa": "کدام مارکر کم‌خطرتر است؟",
        "hint_en": "Which marker less risky?",
        "attending_fa": "استاد: NSTEMI را با تروپونین بسنج.",
        "attending_en": "Attending: Judge NSTEMI with troponin."
    },
    (2,13): {
        "interpretation_fa": "مرد ۳۳ ساله با سنکوپ گذرا خودبه‌خود بهبودیافته، بستری در صورت AF، سنکوپ فعالیتی، QT طولانی یا بیماری ساختاری لازم است؛ این نکته در هاریسون با تأکید بر نوار و اکو و هولتر آمده است. خودبه‌خود بهبودیافته، بستری در صورت AF، سنکوپ فعالیتی، QT طولانی یا بیماری ساختاری لازم است؛ میترال خفیف یا سینوس تاکی یا QT ۴۲۰ نرمال اندیکاسیون قوی نیست و AF با ریسک آمبولی و آریتمی اندیکاسیون بستری دارد. ارزیابی نوار و اکو و هولتر لازم است. این نکته در هاریسون با تأکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "A 33-year-old with transient self-resolving syncope, admission if AF, exertional syncope, long QT or structural; mild MS or sinus tachy or QT420 normal not strong indication and AF with embolic and arrhythmia indication. ECG and echo and Holter needed.",
        "reasons_fa": [
            "دلیل رد گزینه: میترال خفیف اندیکاسیون قوی نیست.",
            "گزینه صحیح: AF اندیکاسیون بستری دارد.",
            "دلیل رد گزینه: QT420 نرمال است.",
            "دلیل رد گزینه: سینوس تاکی به‌تنهایی اندیکاسیون نیست."
        ],
        "reasons_en": [
            "Why incorrect: Mild MS not strong indication.",
            "Correct: AF has admission indication.",
            "Why incorrect: QT420 normal.",
            "Why incorrect: Sinus tachy alone not indication."
        ],
        "lead_fa": "سنکوپ+AF یعنی بستری.",
        "lead_en": "Syncope+AF means admit.",
        "golden_fa": "AF را جدی بگیر.",
        "golden_en": "Take AF seriously.",
        "points_fa": ["QT.", "اکو.", "هولتر.", "بستری."],
        "points_en": ["QT.", "Echo.", "Holter.", "Admit."],
        "hint_fa": "کدام ریتم بستری می‌خواهد؟",
        "hint_en": "Which rhythm needs admit?",
        "attending_fa": "استاد: سنکوپ AF را بستری کن.",
        "attending_en": "Attending: Admit AF syncope."
    },
    (2,14): {
        "interpretation_fa": "زن ۷۰ ساله ESRD با تنگی نفس، افت فشار ۸۰، تاکی ۱۲۵، JVP برجسته و افیوژن شدید، تامپوناد اورمیک را مطرح می‌کند؛ پالس پارادوکس، آلترنانس و از بین رفتن y دیده می‌شود ولی علامت کاسمال بیشتر کانستریکشن است و در تامپوناد غیرمعمول است و «غیر معمول» همین است. دیالیز و پریکاردیوسنتز در ناپایداری مطرح است.",
        "interpretation_en": "A 70-year-old ESRD with dyspnea, 80 drop, tachy 125, high JVP and severe effusion suggests uremic tamponade; paradoxus, alternans and loss of y seen but Kussmaul more constriction and in tamponade unusual and is 'unusual'. Dialysis and pericardiocentesis in instability considered.",
        "reasons_fa": [
            "گزینه صحیح: کاسمال در تامپوناد غیرمعمول است.",
            "دلیل رد گزینه: پارادوکس در تامپوناد دیده می‌شود.",
            "دلیل رد گزینه: آلترنانس در تامپوناد دیده می‌شود.",
            "دلیل رد گزینه: از بین رفتن y در تامپوناد دیده می‌شود."
        ],
        "reasons_en": [
            "Correct: Kussmaul in tamponade unusual.",
            "Why incorrect: Paradoxus in tamponade seen.",
            "Why incorrect: Alternans in tamponade seen.",
            "Why incorrect: Loss of y in tamponade seen."
        ],
        "lead_fa": "کاسمال یعنی کانستریکشن نه تامپوناد.",
        "lead_en": "Kussmaul means constriction not tamponade.",
        "golden_fa": "تامپوناد را با پارادوکس بشناس.",
        "golden_en": "Know tamponade by paradoxus.",
        "points_fa": ["افیوژن.", "فشار.", "پارادوکس.", "دیالیز."],
        "points_en": ["Effusion.", "Pressure.", "Paradoxus.", "Dialysis."],
        "hint_fa": "کدام علامت مال کانستریکشن است؟",
        "hint_en": "Which sign of constriction?",
        "attending_fa": "استاد: کاسمال را کانستریکشن ببین.",
        "attending_en": "Attending: See Kussmaul as constriction."
    },
    (2,15): {
        "interpretation_fa": "مرد ۶۰ ساله دیابتی با درد تیپیک، اولین داروی انتخابی آسپیرین است که پلاکت را مهار و مورتالیتی را کم می‌کند؛ این نکته در هاریسون با تأکید بر شروع سریع و DAPT آمده است.، اولین داروی انتخابی آسپیرین است که پلاکت را مهار و مورتالیتی را کم می‌کند؛ هپارین و کلوپیدوگرل و استاتین همراه‌اند ولی آسپیرین اولین و ضروری‌ترین است و بدون منع باید سریع جویدنی داده شود و سپس DAPT و آنتی‌کوآگولانت و استاتین تکمیل می‌شود. این نکته در هاریسون با تأکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "A 60-year-old diabetic with typical pain, first choice aspirin that inhibits platelets and reduces mortality; heparin and clopidogrel and statin adjunct but aspirin first and most essential and without contraindication quickly chewable given and then DAPT and anticoag and statin completed.",
        "reasons_fa": [
            "دلیل رد گزینه: هپارین اولین نیست.",
            "دلیل رد گزینه: کلوپیدوگرل اولین نیست.",
            "گزینه صحیح: آسپیرین اولین انتخاب است.",
            "دلیل رد گزینه: استاتین اولین نیست."
        ],
        "reasons_en": [
            "Why incorrect: Heparin not first.",
            "Why incorrect: Clopidogrel not first.",
            "Correct: Aspirin first choice.",
            "Why incorrect: Statin not first."
        ],
        "lead_fa": "درد تیپیک یعنی اول آسپیرین.",
        "lead_en": "Typical pain means aspirin first.",
        "golden_fa": "آسپیرین را سریع بده.",
        "golden_en": "Give aspirin quickly.",
        "points_fa": ["جویده.", "DAPT.", "هپارین.", "استاتین."],
        "points_en": ["Chewable.", "DAPT.", "Heparin.", "Statin."],
        "hint_fa": "اول کدام ضدپلاکت؟",
        "hint_en": "Which antiplatelet first?",
        "attending_fa": "استاد: درد تیپیک را آسپیرین بده.",
        "attending_en": "Attending: Give typical pain aspirin."
    },
    (2,16): {
        "interpretation_fa": "بیمار با LVEF 25% و کرونر نرمال، کاردیومیوپاتی غیرایسکمیک با نارسایی کاهشی را مطرح می‌کند؛ این نکته در هاریسون با تأکید بر چهار ستون و اولویت بتابلوکر آمده است.، کاردیومیوپاتی غیرایسکمیک با نارسایی کاهشی را مطرح می‌کند؛ درمان چهار ستون شامل بتابلوکر شواهدار، RAAS و MRA و SGLT2 در اولویت است و آسپیرین، وارفارین یا استاتین بدون اندیکاسیون کرونری اولویت نیست و بتابلوکر در اولویت دارویی قرار دارد. این نکته در هاریسون با تأکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "Patient with LVEF 25% and normal coronaries suggests nonischemic cardiomyopathy with reduced failure; four pillars including evidence beta, RAAS and MRA and SGLT2 priority and aspirin, warfarin or statin without coronary indication not priority and beta priority.",
        "reasons_fa": [
            "دلیل رد گزینه: آسپیرین بدون کرونر اولویت نیست.",
            "دلیل رد گزینه: وارفارین بدون اندیکاسیون اولویت نیست.",
            "دلیل رد گزینه: استاتین بدون کرونر اولویت نیست.",
            "گزینه صحیح: بتابلوکر در کاهشی اولویت دارد."
        ],
        "reasons_en": [
            "Why incorrect: Aspirin without coronary not priority.",
            "Why incorrect: Warfarin without indication not priority.",
            "Why incorrect: Statin without coronary not priority.",
            "Correct: Beta-blocker in reduced priority."
        ],
        "lead_fa": "EF کم+کرونر پاک یعنی بتا.",
        "lead_en": "Low EF+clean coronaries means beta.",
        "golden_fa": "چهار ستون را شروع کن.",
        "golden_en": "Start four pillars.",
        "points_fa": ["EF.", "کرونر پاک.", "بتا.", "MRA."],
        "points_en": ["EF.", "Clean coronaries.", "Beta.", "MRA."],
        "hint_fa": "با EF25 بدون رگ کدام دارو اولویت دارد؟",
        "hint_en": "With EF25 no vessel which drug priority?",
        "attending_fa": "استاد: EF کم را با بتا بسنج.",
        "attending_en": "Attending: Judge low EF with beta."
    },
    (2,17): {
        "interpretation_fa": "نبض کاروتید در AS با صعود کند و قله دیررس parvus tardus و در AR با صعود تند و جهنده و در HOCM با دو قله bisferiens دیده می‌شود؛ این نکته در هاریسون با تأکید بر لمس نبض و سوفل آمده است. با صعود کند و قله دیررس parvus tardus و در AR با صعود تند و جهنده و در HOCM با دو قله bisferiens دیده می‌شود؛ دیاگرام B با parvus tardus به AS می‌خواند و سایر دیاگرام‌ها به AR یا نرمال یا HOCM تعلق دارند. لمس نبض به افتراق کمک می‌کند و با سوفل تفسیر می‌شود. این نکته در هاریسون با تأکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "Carotid in AS with slow upstroke and late peak parvus tardus and in AR steep and bounding and in HOCM double peak bisferiens; diagram B with parvus tardus reads AS and others AR or normal or HOCM. Palpation helps differentiate and interpreted with murmur.",
        "reasons_fa": [
            "دلیل رد گزینه: A در این کلید AS نیست.",
            "گزینه صحیح: B در این کلید AS است.",
            "دلیل رد گزینه: C در این کلید AS نیست.",
            "دلیل رد گزینه: D در این کلید AS نیست."
        ],
        "reasons_en": [
            "Why incorrect: A in this key not AS.",
            "Correct: B in this key AS.",
            "Why incorrect: C in this key not AS.",
            "Why incorrect: D in this key not AS."
        ],
        "lead_fa": "parvus tardus یعنی AS.",
        "lead_en": "Parvus tardus means AS.",
        "golden_fa": "AS را با کندی بشناس.",
        "golden_en": "Know AS by slowness.",
        "points_fa": ["کاروتید.", "parvus.", "سوفل.", "اکو."],
        "points_en": ["Carotid.", "Parvus.", "Murmur.", "Echo."],
        "hint_fa": "کدام دیاگرام کند است؟",
        "hint_en": "Which diagram slow?",
        "attending_fa": "استاد: AS را با parvus ببین.",
        "attending_en": "Attending: See AS with parvus."
    },
    (2,18): {
        "interpretation_fa": "مرد ۴۰ ساله با درد شدید و ST elevation تحتانی که ده دقیقه پس از آنتی‌پلاکت و نیترات کامل برطرف می‌شود، آنژین پرینزمتال یا وازواسپاسم را مطرح می‌کند که با نیترات پاسخ سریع و بدون لخته پایدار است؛ بتابلوکر در اسپاسم ممکن است مضر باشد و مرگ ناگهانی در پرینزمتال ممکن است ولی ریسک فاکتور کرونری کمتر و مورتالیتی ۵ ساله بالا بدون درمان است و CCB پیشگیری است.",
        "interpretation_en": "A 40-year-old with severe pain and inferior ST elevation that 10 min after antiplatelet and nitrate completely resolves suggests Prinzmetal or vasospasm which with nitrate rapid response and no persistent clot; beta in spasm may be harmful and sudden death in Prinzmetal possible but coronary risk less and 5-year mortality high without therapy and CCB prevention.",
        "reasons_fa": [
            "دلیل رد گزینه: بتابلوکر در پرینزمتال سودمند نیست.",
            "دلیل رد گزینه: مرگ ناگهانی در پرینزمتال ممکن است.",
            "گزینه صحیح: ریسک فاکتور کرونری کمتر در پرینزمتال است.",
            "دلیل رد گزینه: مورتالیتی ۵ ساله بدون درمان بالاست."
        ],
        "reasons_en": [
            "Why incorrect: Beta in Prinzmetal not beneficial.",
            "Why incorrect: Sudden death in Prinzmetal possible.",
            "Correct: Less coronary risk in Prinzmetal.",
            "Why incorrect: 5-year mortality without therapy high."
        ],
        "lead_fa": "برطرف با نیترات یعنی پرینزمتال.",
        "lead_en": "Resolved with nitrate means Prinzmetal.",
        "golden_fa": "پرینزمتال را با اسپاسم بشناس.",
        "golden_en": "Know Prinzmetal by spasm.",
        "points_fa": ["نیترات.", "CCB.", "سیگار.", "بتا پرهیز."],
        "points_en": ["Nitro.", "CCB.", "Smoking.", "Avoid beta."],
        "hint_fa": "کدام ریسک در پرینزمتال کمتر است؟",
        "hint_en": "Which risk less in Prinzmetal?",
        "attending_fa": "استاد: پرینزمتال را با نیترات بشناس.",
        "attending_en": "Attending: Know Prinzmetal with nitrate."
    },
    (2,19): {
        "interpretation_fa": "زن ۷۰ ساله با درد طولانی ۳ ساعته و ST صعود V1 تا V5 به میزان ۳ میلی‌متر، STEMI قدامی وسیع را مطرح می‌کند؛ امکان Primary PCI نیست و فاصله ۲ ساعت و نیم تا مرکز PCI بیش از ۱۲۰ دقیقه است و طبق راهنما فیبرینولیتیک طی ۳۰ دقیقه از ورود ارجح است و سپس انتقال برای PCI نجات. آنتی‌کوآگولانت تنها یا آنژیو بدون فیبرینولیتیک در این زمان تأخیر دارد.",
        "interpretation_en": "A 70-year-old with 3h long pain and V1-V5 ST elevation 3 mm suggests extensive anterior STEMI; Primary PCI not possible and 2.5h to PCI >120 min and per guideline lytic within 30 min of arrival preferred and then transfer for rescue PCI. Anticoag alone or angio without lytic in this delay delayed.",
        "reasons_fa": [
            "دلیل رد گزینه: آنتی‌کوآگولانت تنها کافی نیست.",
            "گزینه صحیح: فیبرینولیتیک طی ۳۰ دقیقه ارجح است.",
            "دلیل رد گزینه: اعزام بدون لیز با 150 دقیقه تأخیر دارد.",
            "دلیل رد گزینه: آنتی‌پلاکت تنها کافی نیست."
        ],
        "reasons_en": [
            "Why incorrect: Anticoag alone insufficient.",
            "Correct: Lytic within 30 min preferred.",
            "Why incorrect: Transfer without lysis with 150 min delay.",
            "Why incorrect: Antiplatelet alone insufficient."
        ],
        "lead_fa": "۲.۵ ساعت تا PCI یعنی لیز.",
        "lead_en": "2.5h to PCI means lysis.",
        "golden_fa": "۳۰ دقیقه را قدر بدان.",
        "golden_en": "Value 30 min.",
        "points_fa": ["قدامی.", "V1-V5.", "لیز.", "PCI نجات."],
        "points_en": ["Anterior.", "V1-V5.", "Lysis.", "Rescue PCI."],
        "hint_fa": "با 150 دقیقه کدام زودتر؟",
        "hint_en": "With 150 min which sooner?",
        "attending_fa": "استاد: قد‌امی دور را لیز کن.",
        "attending_en": "Attending: Lyse far anterior."
    },
    (2,20): {
        "interpretation_fa": "مرد ۷۰ ساله روز سوم پس از inferior STEMI با افت فشار و ادم ریه شدید و صدای مافل و EF حفظ و MR خفیف، پارگی دیواره بطن یا سپتوم یا پاپیلری را مطرح می‌کند؛ در این سناریو پارگی بطن با تامپوناد و شوک کاردیوژنیک بهترین توجیه است نه VSD حاد یا MR حاد یا LV dysfunction با EF حفظ. اکو افیوژن و شانت را می‌بیند و جراحی اورژانسی لازم است.",
        "interpretation_en": "A 70-year-old day3 post-inferior STEMI with hypotension and severe pulmonary edema and muffled and preserved EF and mild MR suggests ventricular or septal or papillary rupture; in this scenario ventricular rupture with tamponade and cardiogenic shock best explains not acute VSD or acute MR or LV dysfunction with preserved EF. Echo sees effusion and shunt and emergency surgery needed.",
        "reasons_fa": [
            "دلیل رد گزینه: VSD حاد در این سناریو توجیه اصلی نیست.",
            "دلیل رد گزینه: MR حاد با EF حفظ توجیه اصلی نیست.",
            "گزینه صحیح: پارگی بطن توجیه بهتری است.",
            "دلیل رد گزینه: شوک LV با EF55 توجیه نیست."
        ],
        "reasons_en": [
            "Why incorrect: Acute VSD not main explanation in this scenario.",
            "Why incorrect: Acute MR with preserved EF not main.",
            "Correct: Ventricular rupture better explanation.",
            "Why incorrect: LV shock with EF55 not explanation."
        ],
        "lead_fa": "روز سوم+مافل+افت یعنی پارگی.",
        "lead_en": "Day3+muffled+drop means rupture.",
        "golden_fa": "پارگی را با اکو ببین.",
        "golden_en": "See rupture with echo.",
        "points_fa": ["روز3.", "مافل.", "EF.", "جراحی."],
        "points_en": ["Day3.", "Muffled.", "EF.", "Surgery."],
        "hint_fa": "کدام عارضه روز سوم مافل می‌دهد؟",
        "hint_en": "Which complication day3 muffled?",
        "attending_fa": "استاد: پارگی را با مافل بشناس.",
        "attending_en": "Attending: Know rupture by muffled."
    },
    (2,21): {
        "interpretation_fa": "مرد ۷۲ ساله IHD تحت نیترات، کارودیلول، ASA، کاپتوپریل و آتوروستاتین با درد فعالیتی کوتاه و معاینه نرمال و EF60، آنژین پایدار با درمان بهینه را مطرح می‌کند؛ قطع کارودیلول و شروع نیکاردیپین یا آملودیپین یا افزودن وراپامیل با بتا خطر برادی و بلوک دارد و بهترین گزینه افزودن دیلتیازم با حفظ بتا و پایش است ولی کلید رسمی ادامه کارودیلول و دیلتیازم است و ما همسو می‌شویم.",
        "interpretation_en": "A 72-year-old IHD on nitrate, carvedilol, ASA, captopril and atorvastatin with short exertional pain and normal exam and EF60 suggests stable angina with optimal therapy; stopping carvedilol and starting nicardipine or amlodipine or adding verapamil with beta brady and block risk and best continue carvedilol and add diltiazem with monitoring but official key continue carvedilol and diltiazem and we align.",
        "reasons_fa": [
            "دلیل رد گزینه: قطع بتا و نیکاردیپین ارجح نیست.",
            "دلیل رد گزینه: قطع بتا و آملودیپین ارجح نیست.",
            "گزینه صحیح: ادامه بتا و دیلتیازم پیشنهاد مناسب‌تر است.",
            "دلیل رد گزینه: ادامه بتا و وراپامیل با برادی خطر دارد."
        ],
        "reasons_en": [
            "Why incorrect: Stop beta and nicardipine not preferred.",
            "Why incorrect: Stop beta and amlodipine not preferred.",
            "Correct: Continue beta and diltiazem more suitable.",
            "Why incorrect: Continue beta and verapamil with brady risk."
        ],
        "lead_fa": "بتا را نگه دار و دیلتیازم اضافه کن.",
        "lead_en": "Keep beta and add diltiazem.",
        "golden_fa": "وراپامیل با بتا خطر دارد.",
        "golden_en": "Verapamil with beta risky.",
        "points_fa": ["IHD.", "EF60.", "بتا.", "دیلتیازم."],
        "points_en": ["IHD.", "EF60.", "Beta.", "Diltiazem."],
        "hint_fa": "با بتا کدام اضافه بهتر است؟",
        "hint_en": "Which add better with beta?",
        "attending_fa": "استاد: IHD را با بتا نگه دار.",
        "attending_en": "Attending: Keep IHD with beta."
    },
}
OPTIONS_EN_MAP13 = {
    (1,212): ['Check Mg', 'Beta-blocker', 'Lidocaine', 'Check K'],
    (1,213): ['JVP filling', 'Pulmonary link', 'Readmission', 'All'],
    (1,214): ['VT', 'Asystole', 'Sinus tachy', 'Slow idioventricular'],
    (1,215): ['Advanced atherosclerosis', 'Cardiac bruit', 'Albuminuria', 'Office high grade II'],
    (1,216): ['Always infranodal', 'Better with rate', 'Atropine not useful', 'Temporary pacing'],
    (1,217): ['Ulnar location', 'Crescendo', '2-5 min', 'Rarely subumbilical'],
    (1,218): ['A', 'D', 'C', 'B'],
    (1,219): ['Severe TR', 'Tamponade', 'Constrictive', 'Restrictive'],
    (1,220): ['Thyrotoxicosis', 'Pancreatitis', 'Polyuria', 'Liver failure'],
    (2,1): ['Emergency angio', 'Pethidine 15mg', '500cc fluid', 'IV nitro'],
    (2,2): ['Nitro', 'Amlodipine', 'Aspirin', 'Verapamil'],
    (2,3): ['Friction rub', 'Trapezius radiation', 'Leukocytosis', 'Fever'],
    (2,4): ['AF', 'VF', 'Junctional', 'VT'],
    (2,5): ['Sustained VT', 'Nonsustained VT', 'Paroxysmal SVT', 'Paroxysmal AF'],
    (2,6): ['Right failure', 'Septic', 'Tamponade', 'Acute MR'],
    (2,7): ['Mg', 'Amiodarone', 'Atropine', 'Epinephrine'],
    (2,8): ['Rivaroxaban', 'Aspirin', 'Warfarin', 'No therapy'],
    (2,9): ['Low EF', 'Alternans', 'Cardiomegaly', 'Hypotension'],
    (2,10): ['Fecal incontinence', 'Urinary', 'Tonic-clonic', 'Prolonged disorientation'],
    (2,11): ['Increase >10 inspiration', 'Drop >10 expiration', 'Increase >10 inspiration', 'Drop >10 inspiration'],
    (2,12): ['Troponin+', 'CRP+', 'High ESR', 'Diabetes'],
    (2,13): ['Mild MS', 'AF', 'QT420', 'Sinus tachy'],
    (2,14): ['Kussmaul', 'Paradoxus', 'Alternans', 'Loss y'],
    (2,15): ['Heparin', 'Clopidogrel', 'Aspirin', 'Statin'],
    (2,16): ['Aspirin', 'Warfarin', 'Statin', 'Beta-blocker'],
    (2,17): ['A', 'B', 'C', 'D'],
    (2,18): ['Beta useful', 'No sudden death', 'Less risk factors', 'High 5y mortality'],
    (2,19): ['Anticoag then PCI', 'Lytic within 30min', 'Transfer for PCI', 'Antiplatelet to CCU'],
    (2,20): ['Acute VSD', 'Acute MR', 'Rupture', 'LV shock'],
    (2,21): ['Stop beta nicardipine', 'Stop beta amlodipine', 'Continue beta diltiazem', 'Continue beta verapamil'],
}
def enrich13():
    assert len(ITEMS)==30
    for part in [1,2]:
        path = ROOT / f"tools/master-bank/import-payload.master-preint.part{part:02}.json"
        before = json.loads(path.read_text(encoding="utf-8"))
        after = copy.deepcopy(before)
        for local, q in enumerate(after["questions"], 1):
            item = ITEMS.get((part, local))
            if item is None:
                continue
            if not q.get("options_en") or len([o for o in q.get("options_en",[]) if str(o).strip()])<4:
                q["options_en"] = OPTIONS_EN_MAP13.get((part, local), q.get("options_en",[]))
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
            if (part, local) in ITEMS:
                for f in ALLOWED:
                    new[f]=old.get(f)
                for f in MICRO_ALLOWED:
                    if "micro" in new and "micro" in old:
                        new["micro"][f]=old["micro"].get(f) if isinstance(old.get("micro"),dict) else None
                assert old["question_fa"]==new["question_fa"]
                assert old["options_fa"]==new["options_fa"]
                assert old["correct_index"]==new["correct_index"]
        path.write_text(json.dumps(after, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(f"PASS: enriched 30 heart P01-212-220 + P02 1-21")
if __name__=="__main__":
    enrich13()
