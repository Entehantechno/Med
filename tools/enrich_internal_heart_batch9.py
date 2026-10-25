#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Batch9: part01 Q121-135"""
import copy, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
PART = 1
ITEMS = {
    (1,121): {
        "interpretation_fa": "مرد ۷۰ ساله با انفارکتوس قدامی وسیع V1 تا V6، روز چهارم درد مجدد دارد. تروپونین‌ها چند روز بالا می‌مانند و برای تشخیص انفارکتوس مجدد در روز چهارم کمک کمتری می‌کنند، لاکتات دهیدروژناز هم دیر و غیراختصاصی است. کراتین کیناز ام‌بی حدود ۴۸ تا ۷۲ ساعت به پایه برمی‌گردد و افزایش دوبارهٔ آن همراه درد و تغییرات نوار، انفارکتوس مجدد را بهتر نشان می‌دهد. این نکته در هاریسون با تأکید بر تفسیر هم‌زمان بالین، نوار و دینامیک مارکرها آمده است.",
        "interpretation_en": "A 70-year-old with extensive anterior STEMI V1-V6 has recurrent pain day 4. Troponins stay high for days and are less helpful for early reinfarction, LDH late and nonspecific. CK-MB returns to baseline in 48-72h and a re-elevation with pain and ECG helps diagnose reinfarction. Harrison stresses integrated clinical, ECG and marker dynamics.",
        "reasons_fa": [
            "دلیل رد گزینه: لاکتات دهیدروژناز دیر و غیراختصاصی است.",
            "دلیل رد گزینه: تروپونین آی روزها بالا می‌ماند و تمایز سخت است.",
            "دلیل رد گزینه: تروپونین تی روزها بالا می‌ماند و تمایز سخت است.",
            "گزینه صحیح: سی‌کا-ام‌بی طی ۴۸ تا ۷۲ ساعت به پایه برمی‌گردد و افزایش مجدد آن کمک‌کننده است."
        ],
        "reasons_en": [
            "Why incorrect: LDH late and nonspecific.",
            "Why incorrect: CTn-I stays high for days and hard to differentiate.",
            "Why incorrect: CTn-T stays high for days and hard to differentiate.",
            "Correct: CK-MB returns to baseline in 48-72h and re-elevation helps."
        ],
        "lead_fa": "روز چهارم پس از انفارکتوس، سی‌کا-ام‌بی دوباره بالا یعنی انفارکتوس مجدد.",
        "lead_en": "Day 4 post-MI, CK-MB re-elevation means reinfarction.",
        "golden_fa": "تروپونین ماندگار است؛ سی‌کا-ام‌بی زودتر به پایه می‌رسد.",
        "golden_en": "Troponin persists; CK-MB returns earlier.",
        "points_fa": ["درد و نوار را همراه مارکر ببین.", "تروپونین حساس ولی ماندگار.", "سی‌کا-ام‌بی برای reinfarction زودرس.", "LDH قدیمی و غیراختصاصی."],
        "points_en": ["See pain and ECG with marker.", "Troponin sensitive but persistent.", "CK-MB for early reinfarction.", "LDH old and nonspecific."],
        "hint_fa": "کدام آنزیم زود به خانه برمی‌گردد؟",
        "hint_en": "Which enzyme returns home early?",
        "attending_fa": "استاد: reinfarction را با سی‌کا-ام‌بی بسنج.",
        "attending_en": "Attending: Judge reinfarction with CK-MB."
    },
    (1,122): {
        "interpretation_fa": "مرد ۶۰ ساله با سابقه پریکاردیت سلی و تنگی نفس، فشار ورید ژوگولر برجسته و ریتم فیبریلاسیون دهلیزی، پریکاردیت انقباضی مطرح است. پریکارد سفت باعث یکسان شدن فشارهای دیاستولیک، فشار وریدی بالا، علامت کوسمال و y descent تند می‌شود. موج a نیاز به انقباض دهلیز دارد و در فیبریلاسیون دهلیزی دیده نمی‌شود، ولی موج V برجسته و y عمیق در کانستریکشن دیده می‌شوند. افتراق از کاردیومیوپاتی محدودکننده با اکو و Doppler تنفسی و سی‌تی/ام‌آرآی است و درمان قطعی مزمن علامت‌دار برداشت پریکارد است.",
        "interpretation_en": "A 60-year-old with prior TB pericarditis, dyspnea, high JVP and AF suggests constrictive pericarditis. Rigid pericardium equalizes diastolic pressures, high venous pressure, Kussmaul and steep y descent. a wave needs atrial contraction and not seen in AF, but prominent V and deep y seen in constriction. Differentiation from restrictive cardiomyopathy with echo and respiratory Doppler and CT/MRI; definitive therapy for chronic symptomatic is pericardiectomy.",
        "reasons_fa": [
            "دلیل رد گزینه: علامت کوسمال در کانستریکشن دیده می‌شود.",
            "گزینه صحیح: موج a برجسته نیاز به انقباض دهلیزی دارد و در فیبریلاسیون دیده نمی‌شود.",
            "دلیل رد گزینه: موج نزولی y عمیق در کانستریکشن دیده می‌شود.",
            "دلیل رد گزینه: موج V برجسته در کانستریکشن دیده می‌شود."
        ],
        "reasons_en": [
            "Why incorrect: Kussmaul seen in constriction.",
            "Correct: Prominent a wave needs atrial contraction and not seen in AF.",
            "Why incorrect: Deep y descent seen in constriction.",
            "Why incorrect: Prominent V wave seen in constriction."
        ],
        "lead_fa": "فیبریلاسیون دهلیزی یعنی a وجود ندارد.",
        "lead_en": "AF means no a wave.",
        "golden_fa": "کانستریکشن را با y تند و فشار یکسان بشناس.",
        "golden_en": "Know constriction by steep y and equal pressures.",
        "points_fa": ["سابقه سل را بپرس.", "Kussmaul را چک کن.", "اکو و Doppler تنفسی.", "برداشت پریکارد درمان قطعی."],
        "points_en": ["Ask TB history.", "Check Kussmaul.", "Echo and respiratory Doppler.", "Pericardiectomy definitive."],
        "hint_fa": "کدام موج به انقباض دهلیز نیاز دارد؟",
        "hint_en": "Which wave needs atrial kick?",
        "attending_fa": "استاد: a را در فیبریلاسیون نجوی.",
        "attending_en": "Attending: Don't seek a in fibrillation."
    },
    (1,123): {
        "interpretation_fa": "مرد ۶۵ ساله با انفارکتوس قدامی V1 تا V4 درمان‌شده و درد برطرف، روز سوم درد جدید به دو طرف گردن و تشدید با دم عمیق دارد. این درد پلورتیک و وضعیتی با rub، پریکاردیت زودرس ۱ تا ۴ روز پس از انفارکتوس است نه ایسکمی مجدد. درمان ترجیحی آسپیرین با دوز بالا است؛ سایر ضدالتهاب‌های غیراستروئیدی و کورتون ممکن است ترمیم اسکار را مختل کنند و فیبرینولیتیک، هپارین بیشتر یا نیترات بالا اندیکاسیون ندارد. درسلر دیرتر و با مکانیسم ایمنی رخ می‌دهد.",
        "interpretation_en": "A 65-year-old with treated anterior MI V1-V4 and resolved pain has day 3 new pain to both sides of neck worsened by deep inspiration. This pleuritic positional pain with rub is early pericarditis 1-4 days post-MI not recurrent ischemia. Preferred therapy high-dose aspirin; other NSAIDs and steroids may impair scar healing and lytic, more heparin or high-dose nitrate not indicated. Dressler later immune-mediated.",
        "reasons_fa": [
            "دلیل رد گزینه: فیبرینولیتیک در پریکاردیت پس از انفارکتوس اندیکاسیون ندارد.",
            "دلیل رد گزینه: افزایش هپارین درد پریکاردی را درمان نمی‌کند.",
            "دلیل رد گزینه: نیترات بالا برای درد پلورتیک پریکاردی نیست.",
            "گزینه صحیح: آسپیرین با دوز بالا درمان پریکاردیت زودرس پس از انفارکتوس است."
        ],
        "reasons_en": [
            "Why incorrect: Fibrinolytic not indicated in post-MI pericarditis.",
            "Why incorrect: More heparin does not treat pericardial pain.",
            "Why incorrect: High-dose nitrate not for pericardial pleuritic pain.",
            "Correct: High-dose aspirin therapy for early post-MI pericarditis."
        ],
        "lead_fa": "روز سوم درد با دم یعنی پریکاردیت پس از انفارکتوس.",
        "lead_en": "Day 3 pain with breathing means post-MI pericarditis.",
        "golden_fa": "آسپیرین بالا بده، کورتون را پرهیز کن.",
        "golden_en": "Give high aspirin, avoid steroids.",
        "points_fa": ["درد با دم و وضعیت.", "rub را بشنو.", "سایر NSAID و کورتون پرهیز.", "درسلر دیرتر است."],
        "points_en": ["Pain with breathing and position.", "Hear rub.", "Avoid other NSAID and steroid.", "Dressler later."],
        "hint_fa": "درد تنفسی روز سوم را با کدام ضدالتهاب آرام می‌کنی؟",
        "hint_en": "Which anti-inflammatory calms day 3 breathing pain?",
        "attending_fa": "استاد: پریکاردیت زودرس را با آسپیرین آرام کن.",
        "attending_en": "Attending: Calm early pericarditis with aspirin."
    },
    (1,124): {
        "interpretation_fa": "سوفل ممتد در سیستول و دیاستول بدون وقفه از شنتی با گرادیان همیشگی می‌آید. پارگی آنوریسم سینوس والسالوا به حفره کم‌فشار، سوفل ممتد می‌دهد. کاردیومیوپاتی هیپرتروفیک سوفل جهشی سیستولیک دارد، نقص بین دهلیزی سوفل سیستولیک جریان ریوی و نقص بین بطنی سوفل هولوسیستولیک دارد و ممتد نمی‌دهند. مجرای باز هم ممتد زیرترقوه چپ می‌دهد ولی در گزینه‌ها نیست. شناخت سوفل ممتد به افتراق شانت‌های خاص کمک می‌کند.",
        "interpretation_en": "Continuous murmur in systole and diastole without pause comes from shunt with always gradient. Ruptured sinus of Valsalva aneurysm to low-pressure chamber gives continuous murmur. HCM has ejection systolic, ASD has systolic flow, VSD has holosystolic, not continuous. PDA also continuous left infraclavicular but not in options. Recognizing continuous helps differentiate specific shunts.",
        "reasons_fa": [
            "دلیل رد گزینه: هیپرتروفیک سوفل جهشی سیستولیک است نه ممتد.",
            "گزینه صحیح: پارگی آنوریسم سینوس والسالوا سوفل ممتد می‌دهد.",
            "دلیل رد گزینه: نقص بین دهلیزی سوفل سیستولیک جریان است.",
            "دلیل رد گزینه: نقص بین بطنی هولوسیستولیک است نه ممتد."
        ],
        "reasons_en": [
            "Why incorrect: Hypertrophic has ejection systolic not continuous.",
            "Correct: Ruptured sinus of Valsalva gives continuous murmur.",
            "Why incorrect: ASD systolic flow murmur.",
            "Why incorrect: VSD holosystolic not continuous."
        ],
        "lead_fa": "ممتد بی‌وقفه یعنی شانت همیشه باز.",
        "lead_en": "Unbroken continuous means always-open shunt.",
        "golden_fa": "پارگی سینوس را با ممتد بشناس.",
        "golden_en": "Know ruptured sinus by continuous.",
        "points_fa": ["ممتد در هر دو فاز.", "پارگی به حفره کم‌فشار.", "PDA هم ممتد است.", "اکو تشخیص می‌دهد."],
        "points_en": ["Continuous in both phases.", "Rupture to low-pressure.", "PDA also continuous.", "Echo diagnoses."],
        "hint_fa": "کدام پارگی صدای بی‌وقفه می‌دهد؟",
        "hint_en": "Which rupture gives ceaseless sound?",
        "attending_fa": "استاد: ممتد را با پارگی سینوس بشنو.",
        "attending_en": "Attending: Hear continuous as sinus rupture."
    },
    (1,125): {
        "interpretation_fa": "شایع‌ترین علت نارسایی راست، نارسایی چپ و انتقال فشار به گردش ریوی است. نارسایی ایزوله راست فشار ورید ژوگولر بالا، ادم اندام تحتانی، آسیت و درد شکمی و هپاتومگالی می‌دهد؛ ارتوپنه و تنگی نفس حمله‌ای شبانه بیشتر از احتقان ریوی چپ ناشی می‌شوند و در ایزوله راست کم‌تر برجسته‌اند. درمان علت زمینه‌ای، کنترل حجم و درمان بیماری ریوی و فشار ریوی را هدف می‌گیرد و اکو و بررسی ریه کمک‌کننده‌اند.",
        "interpretation_en": "Most common cause of right failure is left failure with pressure transmission to pulmonary circulation. Isolated right failure gives high JVP, leg edema, ascites and abdominal pain and hepatomegaly; orthopnea and PND more from left pulmonary congestion and less prominent in isolated right. Therapy targets underlying cause, volume control and lung disease/pulmonary hypertension and echo and lung workup help.",
        "reasons_fa": [
            "گزینه صحیح: ارتوپنه و تنگی نفس شبانه بیشتر نشانه احتقان چپ است و «بجز» همین است.",
            "دلیل رد گزینه: درد شکمی و آسیت در نارسایی راست دیده می‌شود.",
            "دلیل رد گزینه: ادم اندام تحتانی در نارسایی راست شایع است.",
            "دلیل رد گزینه: موج گردنی برجسته در نارسایی راست دیده می‌شود."
        ],
        "reasons_en": [
            "Correct: Orthopnea and PND more sign of left congestion and is the 'except'.",
            "Why incorrect: Abdominal pain and ascites seen in right failure.",
            "Why incorrect: Leg edema common in right failure.",
            "Why incorrect: Prominent JVP seen in right failure."
        ],
        "lead_fa": "راست ایزوله یعنی ورید و شکم، نه تنگی نفس خوابیده.",
        "lead_en": "Isolated right means vein and belly, not lying dyspnea.",
        "golden_fa": "علت چپ را اول رد کن.",
        "golden_en": "Rule out left cause first.",
        "points_fa": ["فشار ریوی را بسنج.", "ادم و آسیت را ببین.", "چپ نارسا شایع‌ترین علت.", "دیورتیک با احتیاط."],
        "points_en": ["Measure pulmonary pressure.", "See edema and ascites.", "Failing left most common.", "Diuretic cautiously."],
        "hint_fa": "کدام تنگی نفس مال راست تنها نیست؟",
        "hint_en": "Which dyspnea not of lone right?",
        "attending_fa": "استاد: راست ایزوله را با ارتوپنه اشتباه نگیر.",
        "attending_en": "Attending: Don't confuse isolated right with orthopnea."
    },
    (1,126): {
        "interpretation_fa": "زن ۳۸ ساله مبتلا به لنفوم با خستگی و تنگی نفس چند روزه، افت هوشیاری گذرا، افت فشار ۸۵ روی ۵۵، تاکیکاردی ۱۱۰، فشار ورید ژوگولر برجسته، صداهای قلبی خفه و ریه پاک، شوک انسدادی با تامپوناد قلبی مطرح است. پریکارد پر از مایع، پرشدن قلب را مختل و فشارها را برابر می‌کند؛ افت فشار، ورید برجسته، صدای خفه، پالس پارادوکس و کلاپس دیاستولیک بطن راست در اکو مطرح‌اند. میوکاردیت و نارسایی و پریکاردیت حاد ساده این تریاد انسدادی را نمی‌دهند و درمان ناپایدار تخلیه فوری است.",
        "interpretation_en": "A 38-year-old with lymphoma, days of fatigue and dyspnea, transient low consciousness, 85/55, tachy 110, high JVP, muffled sounds and clear lungs suggests obstructive shock with cardiac tamponade. Fluid-filled pericardium impairs filling and equalizes pressures; hypotension, high JVP, muffled sound, paradoxus and RV diastolic collapse on echo point; myocarditis and failure and simple acute pericarditis do not give this obstructive triad and unstable needs emergent drainage.",
        "reasons_fa": [
            "دلیل رد گزینه: میوکاردیت فولمینانت تریاد انسدادی خفه نمی‌دهد.",
            "دلیل رد گزینه: پریکاردیت حاد بدون تامپوناد افت فشار انسدادی نمی‌دهد.",
            "دلیل رد گزینه: نارسایی حاد رال می‌دهد نه ریه پاک انسدادی.",
            "گزینه صحیح: تامپوناد با افت فشار، ورید برجسته و صدای خفه مطرح است."
        ],
        "reasons_en": [
            "Why incorrect: Fulminant myocarditis does not give muffled obstructive triad.",
            "Why incorrect: Acute pericarditis without tamponade not obstructive hypotension.",
            "Why incorrect: Acute failure gives rales not clear obstructive lungs.",
            "Correct: Tamponade with hypotension, high JVP and muffled sound."
        ],
        "lead_fa": "افت فشار + ورید برجسته + صدای خفه یعنی تامپوناد.",
        "lead_en": "Hypotension + high JVP + muffled means tamponade.",
        "golden_fa": "ریه پاک را با شوک انسدادی بخوان.",
        "golden_en": "Read clear lungs with obstructive shock.",
        "points_fa": ["اکو کلاپس راست.", "پارادوکس را بسنج.", "تخلیه فوری.", "مایع فقط پل موقت."],
        "points_en": ["Echo RV collapse.", "Check paradoxus.", "Emergent drainage.", "Fluid only bridge."],
        "hint_fa": "کدام شوک ریه را پاک می‌گذارد؟",
        "hint_en": "Which shock leaves lungs clear?",
        "attending_fa": "استاد: تامپوناد را با تریاد بشناس.",
        "attending_en": "Attending: Know tamponade by triad."
    },
    (1,127): {
        "interpretation_fa": "نارسایی با کسر جهشی حفظ‌شده بیشتر در سالمندان، زنان، پرفشاری، چاقی، دیابت، بیماری کلیه مزمن و فیبریلاسیون دهلیزی دیده می‌شود و با سفتی بطن و فشار پرشدگی بالا همراه است. اقدام اول کنترل پرفشاری و درمان ایسکمی و کنترل حجم و بیماری‌های همراه است؛ هماهنگ‌سازی مجدد قلبی، دیگوکسین و دفیبریلاتور داخل قلبی بدون اندیکاسیون جداگانه درمان روتین این گروه نیستند. کسر جهشی حفظ‌شده نارسایی را رد نمی‌کند و افتراق از تنگی نفس ریوی مهم است.",
        "interpretation_en": "HF with preserved EF more in elderly, women, hypertension, obesity, diabetes, CKD and AF and with ventricular stiffness and high filling pressure. First action control hypertension and treat ischemia and manage volume and comorbidities; CRT, digoxin and ICD without separate indication not routine for this group. Preserved EF does not rule out failure and differentiation from pulmonary dyspnea important.",
        "reasons_fa": [
            "گزینه صحیح: کنترل هیپرتانسیون و درمان ایسکمی اقدام اول در حفظ‌شده است.",
            "دلیل رد گزینه: هماهنگ‌سازی مجدد بدون اندیکاسیون روتین نیست.",
            "دلیل رد گزینه: دیگوکسین بهبود قابل ملاحظه روتین نمی‌دهد.",
            "دلیل رد گزینه: دفیبریلاتور بدون اندیکاسیون روتین نیست."
        ],
        "reasons_en": [
            "Correct: Control hypertension and treat ischemia first in preserved.",
            "Why incorrect: CRT without indication not routine.",
            "Why incorrect: Digoxin not significant routine benefit.",
            "Why incorrect: Defibrillator without indication not routine."
        ],
        "lead_fa": "حفظ‌شده یعنی اول فشار و ایسکمی را بگیر.",
        "lead_en": "Preserved means first take pressure and ischemia.",
        "golden_fa": "همراهی‌ها را درمان کن.",
        "golden_en": "Treat comorbidities.",
        "points_fa": ["سالمند و زن بیشتر.", "سفتی بطن.", "دیورتیک برای احتقان.", "SGLT2 مفید."],
        "points_en": ["Older and woman more.", "Ventricular stiffness.", "Diuretic for congestion.", "SGLT2 useful."],
        "hint_fa": "اول کدام ریسک را خاموش می‌کنی؟",
        "hint_en": "Which risk to silence first?",
        "attending_fa": "استاد: حفظ‌شده را با فشار شروع کن.",
        "attending_en": "Attending: Start preserved with pressure."
    },
    (1,128): {
        "interpretation_fa": "مانورها به تشخیص سوفل کمک می‌کنند: والسالوا و ایستادن پیش‌بار را کم و سوفل کاردیومیوپاتی هیپرتروفیک و پرولاپس را بیشتر و بقیه را کمتر می‌کنند، چمباتمه برعکس است، handgrip پس‌بار را بالا و نارسایی میترال و آئورت و نقص بین بطنی را تقویت و تنگی آئورت و هیپرتروفیک را کم می‌کند. بستن کاف دو بازو بالای فشار سیستولیک هم افزایش پس‌بار است؛ اگر شدت کم شود، تنگی آئورت محتمل‌تر است چون با پس‌بار بیشتر جریان جهشی کم می‌شود برخلاف نارسایی‌ها.",
        "interpretation_en": "Maneuvers help murmur diagnosis: Valsalva and standing reduce preload and increase HCM and MVP and reduce others, squatting opposite, handgrip raises afterload and augments MR and AR and VSD and reduces AS and HCM. Bilateral cuff inflation above systolic also raises afterload; if intensity falls, AS more likely because with higher afterload ejection flow less unlike regurgitations.",
        "reasons_fa": [
            "دلیل رد گزینه: نارسایی میترال با پس‌بار بیشتر تقویت می‌شود.",
            "گزینه صحیح: تنگی آئورت با افزایش پس‌بار کاهش می‌یابد.",
            "دلیل رد گزینه: نقص بین بطنی با پس‌بار بیشتر تقویت می‌شود.",
            "دلیل رد گزینه: نارسایی آئورت با پس‌بار بیشتر تقویت می‌شود."
        ],
        "reasons_en": [
            "Why incorrect: MR augments with higher afterload.",
            "Correct: AS decreases with higher afterload.",
            "Why incorrect: VSD augments with higher afterload.",
            "Why incorrect: AR augments with higher afterload."
        ],
        "lead_fa": "کاف دو بازو یعنی پس‌بار بالا.",
        "lead_en": "Bilateral cuff means high afterload.",
        "golden_fa": "جهشی با پس‌بار کم می‌شود، نشتی زیاد.",
        "golden_en": "Ejection less with afterload, leak more.",
        "points_fa": ["والسالوا HCM را زیاد می‌کند.", "چمباتمه برعکس.", "handgrip نشتی را زیاد.", "اکو قضاوت می‌کند."],
        "points_en": ["Valsalva ups HCM.", "Squatting opposite.", "Handgrip ups leak.", "Echo judges."],
        "hint_fa": "کدام سوفل با بستن کاف آرام می‌شود؟",
        "hint_en": "Which murmur calms with cuff?",
        "attending_fa": "استاد: پس‌بار را با کاف بسنج.",
        "attending_en": "Attending: Judge afterload with cuff."
    },
    (1,129): {
        "interpretation_fa": "زن ۲۵ ساله با نقص بین بطنی قدیمی، تنگی نفس، سیانوز و چماقی شدن و هماتوکریت ۶۰ و میکروسیتوز، آیزن‌منگر با شانت معکوس پس از فشار ریوی ثابت مطرح است. میکروسیتوز اغلب فقر آهن است و با تأیید کمبود، آهن لازم است؛ فلبوتومی روتین و دهیدراتاسیون مضر و خطر ترومبوز را بیشتر می‌کنند. آسپیرین روتین و کنتراسپتیو خوراکی استروژنی خطرناک‌اند و پیشگیری از بارداری و مشاوره پرخطر ضروری است.",
        "interpretation_en": "A 25-year-old with old VSD, dyspnea, cyanosis and clubbing and Hct 60 microcytic suggests Eisenmenger with reversed shunt after fixed PH. Microcytosis often iron deficiency and with confirmed deficiency iron needed; routine phlebotomy and dehydration harmful and raise thrombosis. Routine aspirin and estrogen contraceptive risky and contraception counseling high-risk essential.",
        "reasons_fa": [
            "دلیل رد گزینه: فلبوتومی روتین در آیزن‌منگر مضر است.",
            "دلیل رد گزینه: کنتراسپتیو استروژنی خطر ترومبوز دارد.",
            "گزینه صحیح: میکروسیتوز فقر آهن است و با تأیید، آهن بده.",
            "دلیل رد گزینه: آسپیرین روتین پیشگیری نیست."
        ],
        "reasons_en": [
            "Why incorrect: Routine phlebotomy harmful in Eisenmenger.",
            "Why incorrect: Estrogen contraceptive thrombosis risk.",
            "Correct: Microcytosis iron deficiency and with confirmation give iron.",
            "Why incorrect: Routine aspirin not prevention."
        ],
        "lead_fa": "میکروسیتوز در سیانوتیک یعنی فقر آهن را جبران کن.",
        "lead_en": "Microcytosis in cyanotic means replete iron.",
        "golden_fa": "خون‌گیری روتین نکن.",
        "golden_en": "Don't routine phlebotomy.",
        "points_fa": ["سیانوز و چماقی.", "فشار ریوی ثابت.", "دهیدراتاسیون پرهیز.", "بارداری پرخطر."],
        "points_en": ["Cyanosis and clubbing.", "Fixed PH.", "Avoid dehydration.", "Pregnancy high-risk."],
        "hint_fa": "گلبول ریز در آیزن‌منگر چه می‌خواهد؟",
        "hint_en": "What does small RBC want in Eisenmenger?",
        "attending_fa": "استاد: آهن را در میکروسیتوز بده.",
        "attending_en": "Attending: Give iron in microcytosis."
    },
    (1,130): {
        "interpretation_fa": "مرد ۴۵ ساله با درد قفسه سینه، افت فشار ۸۰ روی ۵۰ و برادیکاردی ۵۵ و نوار انفارکتوس تحتانی، سه‌گانه افت فشار، ورید برجسته و ریه پاک انفارکتوس بطن راست با انسداد شریان کرونری راست پروگزیمال را مطرح می‌کند. بطن راست به پیش‌بار وابسته است؛ نیترات، دیورتیک و مورفین افت را بدتر می‌کنند. اولین اقدام بولوس محتاطانه سرم نمکی برای افزایش پیش‌بار، همراه بازپرفیوژن و درمان برادیکاردی است؛ آتروپین، پیس‌میکر و اینوتروپ پس از مایع مطرح‌اند.",
        "interpretation_en": "A 45-year-old with chest pain, 80/50 hypotension and brady 55 and inferior infarct ECG suggests RV infarct triad hypotension, high JVP and clear lungs with proximal RCA occlusion. RV preload dependent; nitrate, diuretic and morphine worsen drop. First action cautious saline bolus to raise preload, with reperfusion and bradycardia therapy; atropine, pacer and inotrope after fluid.",
        "reasons_fa": [
            "دلیل رد گزینه: آتروپین پس از مایع مطرح است نه اول.",
            "دلیل رد گزینه: پیس‌میکر پس از مایع و آتروپین مطرح است.",
            "دلیل رد گزینه: دوپامین پس از مایع مطرح است.",
            "گزینه صحیح: سرم نمکی محتاطانه اولین قدم در بطن راست نارساست."
        ],
        "reasons_en": [
            "Why incorrect: Atropine after fluid not first.",
            "Why incorrect: Pacemaker after fluid and atropine.",
            "Why incorrect: Dopamine after fluid.",
            "Correct: Cautious saline first in failing RV."
        ],
        "lead_fa": "راست نارسا یعنی اول مایع.",
        "lead_en": "Failing right means fluid first.",
        "golden_fa": "نیترات و دیورتیک را پرهیز کن.",
        "golden_en": "Avoid nitrate and diuretic.",
        "points_fa": ["V4R را بگیر.", "ریه پاک را ببین.", "بازپرفیوژن سریع.", "برادی را درمان کن."],
        "points_en": ["Get V4R.", "See clear lungs.", "Rapid reperfusion.", "Treat brady."],
        "hint_fa": "افت فشار با ریه پاک چه مایعی می‌خواهد؟",
        "hint_en": "What fluid for hypotension with clear lungs?",
        "attending_fa": "استاد: بطن راست را با مایع پر کن.",
        "attending_en": "Attending: Fill right ventricle with fluid."
    },
    (1,131): {
        "interpretation_fa": "زن ۶۰ ساله با درد شدید قفسه سینه، فشار ۱۶۰ روی ۸۰ و سابقه سکته مغزی ترومبوتیک دو سال قبل، نوار انفارکتوس حاد مطرح است ولی سکته ایسکمیک دو سال قبل منع قطعی فیبرینولیتیک در ماه‌های اخیر نیست ولی سابقه عروق مغزی و فشار نیاز به ارزیابی دقیق دارد؛ با این حال در این سناریو با فشار کنترل‌شده، نیترو، دفیبریلاتور و پیس‌میکر موقت بسته به ریتم مطرح‌اند و دوبوتامین بدون شوک کاردیوژنیک و افت فشار روتین نیست و «مورد نیاز نیست» همین است. انتخاب دارو بر همودینامیک متکی است.",
        "interpretation_en": "A 60-year-old with severe chest pain, 160/80 and 2-year prior thrombotic stroke with acute infarct ECG; lytic and other therapies considered; with controlled pressure nitro, defib and temporary pacer as per rhythm considered and dobutamine without cardiogenic shock and hypotension not routine and is the 'not needed'. Drug choice hemodynamic-based.",
        "reasons_fa": [
            "دلیل رد گزینه: نیترو در فشار مناسب مطرح است.",
            "دلیل رد گزینه: استرپتوکیناز در انفارکتوس حاد مطرح است.",
            "دلیل رد گزینه: پیس‌میکر موقت بسته به بلوک مطرح است.",
            "گزینه صحیح: دوبوتامین بدون شوک و افت فشار مورد نیاز نیست."
        ],
        "reasons_en": [
            "Why incorrect: Nitro considered with suitable pressure.",
            "Why incorrect: Streptokinase considered in acute MI.",
            "Why incorrect: Temporary pacer as per block considered.",
            "Correct: Dobutamine without shock and hypotension not needed."
        ],
        "lead_fa": "بدون افت فشار، اینوتروپ روتین نده.",
        "lead_en": "Without hypotension, no routine inotrope.",
        "golden_fa": "درمان را با فشار و ریتم انتخاب کن.",
        "golden_en": "Choose therapy by pressure and rhythm.",
        "points_fa": ["بازپرفیوژن سریع.", "ضدپلاکت و آنتی‌کوا.", "اکسیژن فقط در هیپوکسمی.", "بتابلوکر با احتیاط."],
        "points_en": ["Rapid reperfusion.", "Antiplatelet and anticoag.", "Oxygen only hypoxemic.", "Beta cautious."],
        "hint_fa": "کدام دارو فشار طبیعی را نمی‌خواهد؟",
        "hint_en": "Which drug not for normal pressure?",
        "attending_fa": "استاد: اینوتروپ را بی‌افت نده.",
        "attending_en": "Attending: Don't give inotrope without drop."
    },
    (1,132): {
        "interpretation_fa": "مرد ۵۹ ساله با درد شدید و ST elevation تحتانی (II، III، aVF)، یک ساعت بعد افت فشار ۸۰ روی ۶۰ و برادی ۵۰، انفارکتوس بطن راست با انسداد شریان کرونری راست را مطرح می‌کند؛ سه‌گانه افت فشار، فشار ورید بالا و ریه پاک و لید V4R کمک‌کننده است. بطن راست به پیش‌بار وابسته است و اولین اقدام بولوس نرمال سالین محتاطانه است؛ ایزوپروترنول، دوبوتامین و پیس‌میکر پس از مایع و ارزیابی ریتم مطرح‌اند و نیترات و دیورتیک مضرند.",
        "interpretation_en": "A 59-year-old with severe pain and inferior ST elevation II, III, aVF, an hour later 80/60 and brady 50 suggests RV infarct with RCA occlusion; triad hypotension, high venous and clear lungs and V4R help. RV preload dependent and first action cautious normal saline bolus; isoproterenol, dobutamine and pacer after fluid and rhythm evaluation and nitrate and diuretic harmful.",
        "reasons_fa": [
            "گزینه صحیح: نرمال سالین محتاطانه اولین قدم است.",
            "دلیل رد گزینه: ایزوپروترنول قدم اول نیست.",
            "دلیل رد گزینه: دوبوتامین قدم اول نیست.",
            "دلیل رد گزینه: پیس‌میکر قدم اول نیست."
        ],
        "reasons_en": [
            "Correct: Cautious normal saline first step.",
            "Why incorrect: Isoproterenol not first.",
            "Why incorrect: Dobutamine not first.",
            "Why incorrect: Pacemaker not first."
        ],
        "lead_fa": "تحتانی با افت و برادی یعنی اول سالین.",
        "lead_en": "Inferior with drop and brady means saline first.",
        "golden_fa": "ریال ریه پاک را قدر بدان.",
        "golden_en": "Value clear lungs.",
        "points_fa": ["V4R را بگیر.", "نیترات پرهیز.", "بازپرفیوژن.", "برادی را پس از مایع بسنج."],
        "points_en": ["Get V4R.", "Avoid nitrate.", "Reperfusion.", "Judge brady after fluid."],
        "hint_fa": "اولین مایع در راست نارسا کدام است؟",
        "hint_en": "Which fluid first in failing right?",
        "attending_fa": "استاد: اول سالین، بعد اینوتروپ.",
        "attending_en": "Attending: Saline first, then inotrope."
    },
    (1,133): {
        "interpretation_fa": "مرد ۷۱ ساله با سابقه فشار و انفارکتوس و PCI سه سال قبل، تنگی نفس پیشرونده سه روزه، دیسترس، تاکی‌پنه ۲۸، تاکی‌کاردی ۱۰۸، فشار ۱۲۳ روی ۷۴، رال دوطرفه تا دو سوم و S3 و S4، ادم حاد ریه پس از انفارکتوس با نارسایی احتقانی مطرح است. درمان حاد اکسیژن در هیپوکسمی، تهویه غیرتهاجمی، نیترات با فشار مناسب و دیورتیک در احتقان است؛ بتابلوکر در دکمپانسیشن حاد شروع نمی‌شود و دوبوتامین برای low-output با افت فشار است نه فشار محفوظ. مورفین با احتیاط و دوز کم در صورت لزوم مطرح است.",
        "interpretation_en": "A 71-year-old with HTN and prior MI/PCI, 3 days progressive dyspnea, distress, tachypnea 28, tachy 108, 123/74, bilateral rales to 2/3 and S3 S4 suggests acute pulmonary edema post-MI with congestion. Acute therapy oxygen in hypoxemia, NIV, nitrate with suitable pressure and diuretic for congestion; beta not started in acute decompensation and dobutamine for low-output with hypotension not preserved pressure. Morphine cautiously low dose if needed.",
        "reasons_fa": [
            "دلیل رد گزینه: کارودیلول در ادم حاد شروع نمی‌شود.",
            "دلیل رد گزینه: کاپتوپریل بدون فورزماید و اکسیژن کافی نیست.",
            "دلیل رد گزینه: دوبوتامین در فشار محفوظ روتین نیست.",
            "گزینه صحیح: فورزماید، نیترات، مورفین و اکسیژن ترکیب مناسب حاد است."
        ],
        "reasons_en": [
            "Why incorrect: Carvedilol not started in acute edema.",
            "Why incorrect: Captopril without furosemide and oxygen insufficient.",
            "Why incorrect: Dobutamine not routine with preserved pressure.",
            "Correct: Furosemide, nitrate, morphine and oxygen suitable acute combo."
        ],
        "lead_fa": "ادم حاد با فشار محفوظ یعنی نیترات و دیورتیک نه بتا.",
        "lead_en": "Acute edema with preserved pressure means nitrate and diuretic not beta.",
        "golden_fa": "بتا را در دکمپانسیشن شروع نکن.",
        "golden_en": "Don't start beta in decompensation.",
        "points_fa": ["اکسیژن و NIV.", "نیترات با فشار.", "دیورتیک برای رال.", "عارضه مکانیکی را رد کن."],
        "points_en": ["Oxygen and NIV.", "Nitrate with pressure.", "Diuretic for rales.", "Rule mechanical complication."],
        "hint_fa": "در تنگی نفس حاد کدام دارو را فعلاً نگه می‌داری؟",
        "hint_en": "Which drug to hold in acute dyspnea?",
        "attending_fa": "استاد: ادم را با دیورتیک و نیترات آرام کن.",
        "attending_en": "Attending: Calm edema with diuretic and nitrate."
    },
    (1,134): {
        "interpretation_fa": "مرد ۷۳ ساله با درد سه روزه، سیگار و دیابت، ST depression قدامی بدون تهوع و یافته پاتولوژیک، سندرم کرونری بدون صعود ST با ریسک بالا (زمان طولانی، دیابت، افسردگی ST) مطرح است. با تروپونین در راه، انتقال به مراقبت ویژه، آنتی‌کوآگولانت، DAPT و استاتین پایه‌اند و آنژیوگرافی زودرس در پرخطر اندیکاسیون دارد. اسکن دی‌پیریدامول تست استرس غیرتهاجمی دیرتر و در فاز حاد با درد ادامه‌دار مناسب اول نیست.",
        "interpretation_en": "A 73-year-old with 3-day pain, smoking and diabetes, anterior ST depression without nausea and no pathologic finding suggests high-risk NSTE-ACS (long time, diabetes, ST depression). With troponin pending, CCU, anticoagulant, DAPT and statin base and early cath in high-risk indicated. Dipyridamole scan noninvasive stress later and not suitable first in acute ongoing pain.",
        "reasons_fa": [
            "دلیل رد گزینه: انتقال به ویژه مناسب است.",
            "دلیل رد گزینه: آنژیوگرافی در پرخطر مناسب است.",
            "گزینه صحیح: اسکن دی‌پیریدامول در وهله اول مناسب نیست.",
            "دلیل رد گزینه: شروع آنتی‌کوآگولانت مناسب است."
        ],
        "reasons_en": [
            "Why incorrect: Transfer to CCU appropriate.",
            "Why incorrect: Angiography appropriate in high-risk.",
            "Correct: Dipyridamole scan not appropriate first.",
            "Why incorrect: Starting anticoagulant appropriate."
        ],
        "lead_fa": "درد سه روزه با ST پایین یعنی اول تهاجمی نه اسکن.",
        "lead_en": "3-day pain with ST depression means invasive first not scan.",
        "golden_fa": "پرخطر را زود کات کن.",
        "golden_en": "Cath high-risk early.",
        "points_fa": ["تروپونین را بگیر.", "GRACE را بسنج.", "DAPT و هپارین.", "استاتین پرقدرت."],
        "points_en": ["Get troponin.", "Assess GRACE.", "DAPT and heparin.", "High-intensity statin."],
        "hint_fa": "کدام تست غیرتهاجمی را عقب می‌اندازی؟",
        "hint_en": "Which noninvasive test to delay?",
        "attending_fa": "استاد: NSTE پرخطر را با آنژیو بسنج.",
        "attending_en": "Attending: Judge high-risk NSTE with cath."
    },
    (1,135): {
        "interpretation_fa": "نارسایی با کسر جهشی حفظ‌شده بیشتر در سالمندی، زنان، پرفشاری، چاقی، دیابت، بیماری کلیوی مزمن و فیبریلاسیون دهلیزی دیده می‌شود و با سفتی بطن و اختلال پرشدگی همراه است. aging شایع‌ترین زمینه است در حالی که شاگاس بیشتر کاردیومیوپاتی متسع و کسر پایین، تنگی کرونر کسر پایین ایسکمیک و نارسایی دریچه‌ای شدید با overload حجمی مزمن بیشتر کسر پایین می‌دهند. درمان حفظ‌شده کنترل فشار، حجم، بیماری‌های همراه و SGLT2 است.",
        "interpretation_en": "HF with preserved EF more in aging, women, HTN, obesity, diabetes, CKD and AF and with stiffness and filling disturbance. Aging most common background while Chagas more dilated and low EF, coronary stenosis low EF ischemic and severe valvular with chronic volume overload more low EF. Preserved therapy control pressure, volume, comorbidities and SGLT2.",
        "reasons_fa": [
            "گزینه صحیح: سالمندی شایع‌ترین زمینه حفظ‌شده است.",
            "دلیل رد گزینه: شاگاس بیشتر کسر پایین می‌دهد.",
            "دلیل رد گزینه: تنگی کرونر بیشتر کسر پایین می‌دهد.",
            "دلیل رد گزینه: نارسایی دریچه‌ای شدید بیشتر کسر پایین می‌دهد."
        ],
        "reasons_en": [
            "Correct: Aging most common background for preserved.",
            "Why incorrect: Chagas more gives low EF.",
            "Why incorrect: Coronary stenosis more gives low EF.",
            "Why incorrect: Severe valvular more gives low EF."
        ],
        "lead_fa": "حفظ‌شده یعنی سالمند و سفت.",
        "lead_en": "Preserved means old and stiff.",
        "golden_fa": "aging را با HFpEF بشناس.",
        "golden_en": "Know aging with HFpEF.",
        "points_fa": ["زن و پرفشاری.", "سفتی بطن.", "حجم و فشار را بگیر.", "فیبریلاسیون را کنترل کن."],
        "points_en": ["Woman and HTN.", "Ventricular stiffness.", "Control volume and pressure.", "Control AF."],
        "hint_fa": "کدام سن کسر را حفظ می‌کند؟",
        "hint_en": "Which age preserves EF?",
        "attending_fa": "استاد: حفظ‌شده را با سالمندی بشناس.",
        "attending_en": "Attending: Know preserved with aging."
    },
}
OPTIONS_EN_MAP9 = {
    (1,121): ['LDH', 'CTn-I', 'CTn-T', 'CK-MB'],
    (1,122): ['Kussmaul sign', 'prominent a wave', 'deep y descent', 'prominent V wave'],
    (1,123): ['Fibrinolytic', 'More heparin', 'High nitrate', 'High aspirin'],
    (1,124): ['HCM', 'Ruptured sinus Valsalva', 'ASD', 'VSD'],
    (1,125): ['Orthopnea/PND', 'Abdominal pain/ascites', 'Leg edema', 'Prominent JVP'],
    (1,126): ['Fulminant myocarditis', 'Acute pericarditis', 'Acute heart failure', 'Cardiac tamponade'],
    (1,127): ['Control HTN/ischemia first', 'CRT', 'Digoxin', 'ICD'],
    (1,128): ['MR', 'AS', 'VSD', 'AR'],
    (1,129): ['Phlebotomy', 'Oral contraceptive', 'Iron', 'Aspirin'],
    (1,130): ['Atropine', 'Temporary pacer', 'IV dopamine', 'IV saline'],
    (1,131): ['IV nitroglycerin', 'IV streptokinase', 'Temporary pacer', 'IV dobutamine'],
    (1,132): ['Normal saline', 'IV isoproterenol', 'IV dobutamine', 'Temporary pacer'],
    (1,133): ['Furosemide-nitrate-carvedilol-morphine', 'Nitrate-morphine-carvedilol-captopril', 'Furosemide-nitrate-O2-dobutamine', 'Furosemide-nitrate-morphine-O2'],
    (1,134): ['CCU transfer', 'Angiography', 'Dipyridamole scan', 'Anticoagulant'],
    (1,135): ['Aging', 'Chagas', 'Coronary stenosis', 'Severe valvular volume overload'],
}
def enrich9():
    assert len(ITEMS)==15
    path = ROOT / f"tools/master-bank/import-payload.master-preint.part{PART:02}.json"
    before = json.loads(path.read_text(encoding="utf-8"))
    after = copy.deepcopy(before)
    for local, q in enumerate(after["questions"], 1):
        item = ITEMS.get((PART, local))
        if item is None:
            continue
        if not q.get("options_en") or len([o for o in q.get("options_en",[]) if str(o).strip()])<4:
            q["options_en"] = OPTIONS_EN_MAP9.get((PART, local), q.get("options_en",[]))
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
    print(f"PASS: enriched {len(ITEMS)} heart Q121-135")
if __name__=="__main__":
    enrich9()
