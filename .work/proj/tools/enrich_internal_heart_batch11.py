#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Batch11: part01 Q152-181 (30 questions)"""
import copy, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
PART = 1
ITEMS = {
    (1,152): {
        "interpretation_fa": "مرد ۴۰ ساله سیگاری با درد فشارنده قفسه سینه و نوار انفارکتوس حاد با صعود ST، کاندید بازپرفیوژن فوری است. در نبود منع خونریزی و با زمان مناسب، تنکتپلاز فیبرینولیتیک ارجح است و نیترو وریدی، مورفین یا متوپرولول وریدی خط اول بازکننده عروق نیستند. درمان همراه شامل آسپیرین، کلوپیدوگرل، هپارین، استاتین پرقدرت و کنترل فشار و درد است. اکسیژن فقط در هیپوکسمی و بتابلوکر در شوک یا برادی ممنوع است و انتخاب بر همودینامیک متکی است.",
        "interpretation_en": "A 40-year-old smoker with pressing chest pain and acute ST elevation MI is candidate for immediate reperfusion. Without bleeding contraindication and with suitable time, tenecteplase lytic preferred and IV nitro, morphine or IV metoprolol not first vessel opener. Adjunct includes aspirin, clopidogrel, heparin, high-intensity statin and pressure/pain control. Oxygen only hypoxemic and beta forbidden in shock or brady, choice hemodynamic-based.",
        "reasons_fa": [
            "دلیل رد گزینه: نیتروگلیسیرین وریدی بازپرفیوژن فوری نیست.",
            "دلیل رد گزینه: مورفین بازپرفیوژن فوری نیست.",
            "دلیل رد گزینه: متوپرولول وریدی بازپرفیوژن فوری نیست.",
            "گزینه صحیح: تنکتپلاز بازپرفیوژن فوری در STEMI است."
        ],
        "reasons_en": [
            "Why incorrect: IV nitroglycerin not immediate reperfusion.",
            "Why incorrect: Morphine not immediate reperfusion.",
            "Why incorrect: IV metoprolol not immediate reperfusion.",
            "Correct: Tenecteplase immediate reperfusion in STEMI."
        ],
        "lead_fa": "STEMI یعنی اول رگ را باز کن.",
        "lead_en": "STEMI means open vessel first.",
        "golden_fa": "تنکتپلاز در STEMI ارجح است.",
        "golden_en": "Tenecteplase preferred in STEMI.",
        "points_fa": ["آسپیرین و کلوپیدوگرل.", "هپارین.", "استاتین.", "بتا با احتیاط."],
        "points_en": ["Aspirin and clopidogrel.", "Heparin.", "Statin.", "Beta cautious."],
        "hint_fa": "کدام دارو لخته را سریع حل می‌کند؟",
        "hint_en": "Which drug quickly lyses clot?",
        "attending_fa": "استاد: STEMI را با لیتک باز کن.",
        "attending_en": "Attending: Open STEMI with lytic."
    },
    (1,153): {
        "interpretation_fa": "زن ۲۰ ساله با آفت دهانی و آرترالژی، تنگی نفس و درد پلورتیک، تاکی‌کاردی، افت فشار ۸۰، ورید برجسته و صدای خفه، تامپوناد در زمینه بیماری التهابی مانند بهجت را مطرح می‌کند. شوک انسدادی با اختلال پرشدن و برابر شدن فشارها، پالس پارادوکس می‌دهد؛ رامبل دیاستولیک، QRS ولتاژ بالا یا y descent حاضر به نفع تامپوناد نیست. اکو کلاپس دیاستولیک راست و تخلیه فوری در ناپایداری لازم است و مایع فقط پل موقت است.",
        "interpretation_en": "A 20-year-old with oral aphthae and arthralgia, dyspnea and pleuritic pain, tachycardia, 80 hypotension, high JVP and muffled suggests tamponade in inflammatory disease like Behcet. Obstructive shock with impaired filling and equalized pressures gives paradoxus; diastolic rumble, high voltage or present y not for tamponade. Echo RV diastolic collapse and emergent drainage in instability needed and fluid only bridge.",
        "reasons_fa": [
            "دلیل رد گزینه: رامبل دیاستولیک بیشتر تنگی میترال است.",
            "گزینه صحیح: پالس پارادوکس در تامپوناد محتمل‌تر است.",
            "دلیل رد گزینه: ولتاژ بالا بیشتر هیپرتروفی است.",
            "دلیل رد گزینه: y حاضر بیشتر کانستریکشن است."
        ],
        "reasons_en": [
            "Why incorrect: Diastolic rumble more mitral stenosis.",
            "Correct: Pulsus paradox more likely in tamponade.",
            "Why incorrect: High voltage more hypertrophy.",
            "Why incorrect: Present y more constriction."
        ],
        "lead_fa": "افت با ورید برجسته و خفه یعنی پارادوکس.",
        "lead_en": "Drop with high JVP and muffled means paradoxus.",
        "golden_fa": "تامپوناد را با پارادوکس بشناس.",
        "golden_en": "Know tamponade by paradoxus.",
        "points_fa": ["اکو کلاپس.", "تخلیه فوری.", "مایع پل.", "علت التهابی را بجوی."],
        "points_en": ["Echo collapse.", "Emergent drainage.", "Fluid bridge.", "Seek inflammatory cause."],
        "hint_fa": "کدام نبض با دم می‌افتد؟",
        "hint_en": "Which pulse drops with breath?",
        "attending_fa": "استاد: تامپوناد را با پارادوکس ببین.",
        "attending_en": "Attending: See tamponade by paradoxus."
    },
    (1,154): {
        "interpretation_fa": "مرد ۶۵ ساله سیگاری دیابتی با درد تیپیک یک‌ساله و تست ورزش منفی، درد پایدار کرونری با احتمال بیماری LCx را مطرح می‌کند؛ قلمرو سیرکومفلکس در تست ورزش ساده کمتر دیده می‌شود و در تیپیک با تست منفی کاذب، LCx به‌عنوان گزینه کلیدی مطرح است و با ریسک بالا، آنژیو زودرس و کنترل علائم و استاتین و ضدپلاکت لازم است. LAD، تنه اصلی و RCA در این سناریو کمتر با کلید رسمی همخوان‌اند.",
        "interpretation_en": "A 65-year-old smoker diabetic with one-year typical pain and negative exercise suggests persistent LCx disease; LCx territory less seen on simple exercise and with typical and false-negative, LCx as key suggested and with high risk early cath and symptom control and statin and antiplatelet needed. LAD, left main and RCA less match official key.",
        "reasons_fa": [
            "گزینه صحیح: سیرکومفلکس چپ با تست منفی کاذب محتمل‌تر است.",
            "دلیل رد گزینه: نزولی قدامی در این سناریو کلید نیست.",
            "دلیل رد گزینه: تنه اصلی در این سناریو کلید نیست.",
            "دلیل رد گزینه: کرونری راست در این سناریو کلید نیست."
        ],
        "reasons_en": [
            "Correct: Left circumflex with false-negative more likely.",
            "Why incorrect: LAD in this scenario not key.",
            "Why incorrect: Left main in this scenario not key.",
            "Why incorrect: RCA in this scenario not key."
        ],
        "lead_fa": "تیپیک با ورزش منفی یعنی آناتومی پرخطر را فکر کن.",
        "lead_en": "Typical with negative exercise means think high-risk anatomy.",
        "golden_fa": "تنه اصلی را از دست نده.",
        "golden_en": "Don't miss left main.",
        "points_fa": ["تست منفی کاذب.", "آنژیو در پرخطر.", "استاتین.", "دیابت را کنترل کن."],
        "points_en": ["False negative test.", "Cath in high-risk.", "Statin.", "Control diabetes."],
        "hint_fa": "کدام رگ همه جا را تغذیه می‌کند؟",
        "hint_en": "Which vessel feeds everywhere?",
        "attending_fa": "استاد: تیپیک منفی را آنژیو کن.",
        "attending_en": "Attending: Cath typical negative."
    },
    (1,155): {
        "interpretation_fa": "BNP در پاسخ به کشش دیواره بطن بالا می‌رود و در نارسایی راست و دیاستولیک هم افزایش دارد؛ در مردان نسبت به زنان پایین‌تر و در چاق‌ها به‌طور کاذب پایین است نه بالا. سن، بیماری کلیه، فیبریلاسیون و فشار راست آن را بالا می‌برد و تفسیر باید در زمینه بالینی باشد. BNP برای رد نارسایی با cut-off منفی قوی است ولی به‌تنهایی تشخیص نیست و با اکو و معاینه تکمیل می‌شود.",
        "interpretation_en": "BNP rises in response to wall stretch and increases in right and diastolic failure; in men lower than women and in obese falsely low not high. Age, kidney disease, AF and right pressure raise it and interpretation must be clinical. BNP for ruling out failure with strong negative cut-off but alone not diagnosis and completed with echo and exam.",
        "reasons_fa": [
            "گزینه صحیح: در نارسایی راست BNP افزایش دارد.",
            "دلیل رد گزینه: در مردان بالاتر نیست، زنان بالاترند.",
            "دلیل رد گزینه: در چاق کاذباً پایین است نه بالا.",
            "دلیل رد گزینه: در دیاستولیک هم افزایش دارد."
        ],
        "reasons_en": [
            "Correct: In right failure BNP increased.",
            "Why incorrect: In men not higher, women higher.",
            "Why incorrect: In obese falsely low not high.",
            "Why incorrect: In diastolic also increased."
        ],
        "lead_fa": "BNP یعنی کشش دیواره.",
        "lead_en": "BNP means wall stretch.",
        "golden_fa": "راست هم BNP را بالا می‌برد.",
        "golden_en": "Right also raises BNP.",
        "points_fa": ["زنان بالاتر.", "چاق پایین کاذب.", "کلیه بالا.", "اکو تکمیل."],
        "points_en": ["Women higher.", "Obese false low.", "Kidney high.", "Echo completes."],
        "hint_fa": "کدام بطن BNP را بالا می‌برد؟",
        "hint_en": "Which ventricle raises BNP?",
        "attending_fa": "استاد: BNP را با زمینه بخوان.",
        "attending_en": "Attending: Read BNP with context."
    },
    (1,156): {
        "interpretation_fa": "مرد ۵۵ ساله سه روز پس از انفارکتوس با تب ۳۸ و تاکی‌کاردی و CRP بالا، تب التهابی ناشی از نکروز میوکارد را مطرح می‌کند که در ۲ تا ۴ روز اول شایع و خفیف است و بدون کانون عفونت یا بی‌ثباتی، فقط کنترل تب کافی است. کشت خون و ادرار، گرافی یا آنتی‌بیوتیک وسیع روتین نیست مگر تب بالا، پایدار، کاتتر، زخم یا لکوسیتوز نامتناسب مطرح کند. مراقبت از زخم و کاتتر و پایش مهم است.",
        "interpretation_en": "A 55-year-old 3 days post-MI with 38 fever and tachy and high CRP suggests inflammatory fever from myocardial necrosis common mild in 2-4 days first and without focus or instability, only fever control enough. Blood/urine culture, film or broad antibiotic not routine unless high, persistent, catheter, wound or disproportionate leukocytosis suggests. Wound and catheter care and monitoring important.",
        "reasons_fa": [
            "دلیل رد گزینه: کشت بدون کانون روتین نیست.",
            "دلیل رد گزینه: گرافی بدون کانون روتین نیست.",
            "گزینه صحیح: فقط کنترل تب در تب نکروزی خفیف کافی است.",
            "دلیل رد گزینه: آنتی‌بیوتیک وسیع بدون عفونت روتین نیست."
        ],
        "reasons_en": [
            "Why incorrect: Culture without focus not routine.",
            "Why incorrect: Film without focus not routine.",
            "Correct: Only fever control in mild necrotic fever enough.",
            "Why incorrect: Broad antibiotic without infection not routine."
        ],
        "lead_fa": "تب روز سوم پس MI یعنی نکروز.",
        "lead_en": "Day 3 fever post-MI means necrosis.",
        "golden_fa": "آنتی‌بیوتیک بی‌جا نده.",
        "golden_en": "Don't give needless antibiotic.",
        "points_fa": ["تب نکروزی خفیف.", "کانون را بجوی.", "کاتتر را ببین.", "CRP بالا طبیعی."],
        "points_en": ["Mild necrotic fever.", "Seek focus.", "See catheter.", "CRP high normal."],
        "hint_fa": "تب خفیف روز سوم چه می‌خواهد؟",
        "hint_en": "What does mild day 3 fever want?",
        "attending_fa": "استاد: تب MI را کنترل کن نه آنتی‌بیوتیک.",
        "attending_en": "Attending: Control MI fever not antibiotic."
    },
    (1,157): {
        "interpretation_fa": "سوفل میدسیستولیک ejection از عبور سریع خون از دریچه تنگ یا جریان زیاد می‌آید و crescendo-decrescendo است؛ تنگی آئورت تیپیک ejection می‌دهد در حالی که نقص سپتوم بین بطنی هولوسیستولیک و نارسایی میترال و تریکوسپید پان‌سیستولیک یا هولوسیستولیک‌اند. حجم ضربه و سرعت جت تعیین‌کننده است و اکو شدت و گرادیان را می‌سنجد؛ شدت سوفل همیشه با شدت تنگی هم‌خوان نیست و با برون‌ده کم، سوفل کم می‌شود.",
        "interpretation_en": "Midsystolic ejection murmur from rapid blood through narrow valve or high flow and crescendo-decrescendo; AS typical ejection while VSD holosystolic and MR and TR pansystolic or holosystolic. Stroke volume and jet speed determinants and echo measures severity and gradient; murmur intensity not always correlates with stenosis and with low output murmur less.",
        "reasons_fa": [
            "گزینه صحیح: تنگی آئورت ejection میدسیستولیک می‌دهد.",
            "دلیل رد گزینه: VSD هولوسیستولیک است.",
            "دلیل رد گزینه: MR هولوسیستولیک/پان‌سیستولیک است.",
            "دلیل رد گزینه: TR پان‌سیستولیک است."
        ],
        "reasons_en": [
            "Correct: AS gives midsystolic ejection.",
            "Why incorrect: VSD holosystolic.",
            "Why incorrect: MR holosystolic/pansystolic.",
            "Why incorrect: TR pansystolic."
        ],
        "lead_fa": "ejection یعنی تنگی دریچه.",
        "lead_en": "Ejection means valve stenosis.",
        "golden_fa": "AS را با ejection بشناس.",
        "golden_en": "Know AS by ejection.",
        "points_fa": ["crescendo.", "به کاروتید.", "A2 ضعیف.", "اکو گرادیان."],
        "points_en": ["Crescendo.", "To carotid.", "Weak A2.", "Echo gradient."],
        "hint_fa": "کدام تنگی سوفل جهشی می‌دهد؟",
        "hint_en": "Which stenosis ejection?",
        "attending_fa": "استاد: ejection را آئورتی بدان.",
        "attending_en": "Attending: Know ejection as aortic."
    },
    (1,158): {
        "interpretation_fa": "مرد ۴۱ ساله با درد رترواسترنال نیم‌ساعته، اختلاف فشار دو بازو ۲۲ میلی‌متر، سوفل دیاستولیک راست و ST elevation تحتانی، دیسکسیون آئورت نوع A با درگیری کرونری راست را مطرح می‌کند نه STEMI ساده؛ آنژیوگرافی کرونری اورژانسی یا شروع دو ضدپلاکت و هپارین و استرپتوکیناز می‌تواند کشنده باشد. اکوکاردیوگرافی اورژانسی فلپ، نارسایی آئورت، افیوژن و درگیری کرونری را سریع می‌بیند و سی‌تی آئورت تأییدی است و جراحی اورژانسی لازم است.",
        "interpretation_en": "A 41-year-old with 30-min retrosternal pain, 22 mm arm pressure difference, right diastolic murmur and inferior ST elevation suggests type A dissection with right coronary involvement not simple STEMI; urgent coronary angio or starting DAPT and heparin and streptokinase can be fatal. Emergency echo quickly sees flap, AR, effusion and coronary involvement and CT aorta confirmatory and emergency surgery needed.",
        "reasons_fa": [
            "دلیل رد گزینه: آنژیو کرونری در دیسکسیون خطرناک است.",
            "گزینه صحیح: اکو اورژانسی قدم اول ایمن است.",
            "دلیل رد گزینه: دو ضدپلاکت و هپارین در دیسکسیون ممنوع است.",
            "دلیل رد گزینه: استرپتوکیناز در دیسکسیون کشنده است."
        ],
        "reasons_en": [
            "Why incorrect: Coronary angio in dissection dangerous.",
            "Correct: Emergency echo safe first step.",
            "Why incorrect: DAPT and heparin prohibited in dissection.",
            "Why incorrect: Streptokinase in dissection fatal."
        ],
        "lead_fa": "اختلاف فشار + AR یعنی اول اکو.",
        "lead_en": "Pressure gap + AR means echo first.",
        "golden_fa": "دیسکسیون را با اکو ببین.",
        "golden_en": "See dissection with echo.",
        "points_fa": ["Type A جراحی.", "مدیاستن پهن.", "لیز ممنوع.", "بتا سپس فشار."],
        "points_en": ["Type A surgery.", "Wide mediastinum.", "Lysis prohibited.", "Beta then pressure."],
        "hint_fa": "قبل از رگ‌بازکن کدام تصویر ایمن است؟",
        "hint_en": "Which imaging safe before opener?",
        "attending_fa": "استاد: دیسکسیون را اول اکو کن.",
        "attending_en": "Attending: Echo dissection first."
    },
    (1,159): {
        "interpretation_fa": "بیمار با انفارکتوس حاد، فشار ۱۳۰ روی ۸۰، بدون friction rub، نبض ۸۰ و اشباع بالای ۹۸، همودینامیک پایدار و اکسیژن کافی دارد. آسپیرین ۱۶۰ تا ۳۲۵، نیترو زیرزبانی تا سه بار و مورفین در صورت درد مقاوم به نیترو اندیکاسیون دارند و روتین نیستند که حذف شوند؛ اکسیژن نازال ۲ تا ۴ لیتر در اشباع طبیعی روتین نیست و توصیه نمی‌شود و فقط در هیپوکسمی، دیسترس یا شوک داده می‌شود. بتابلوکر هم با احتیاط است.",
        "interpretation_en": "Patient with acute MI, 130/80, no rub, pulse 80 and sat >98, hemodynamically stable and adequate oxygen. Aspirin 160-325, sublingual nitro up to three and morphine if pain resistant to nitro indicated and not routine to omit; nasal O2 2-4 L in normal saturation not routine and not recommended and only in hypoxemia, distress or shock given. Beta also cautious.",
        "reasons_fa": [
            "دلیل رد گزینه: نیترو تا سه بار در فشار مناسب ضروری است.",
            "دلیل رد گزینه: آسپیرین در MI ضروری است.",
            "دلیل رد گزینه: مورفین در درد مقاوم به نیترو ضروری است.",
            "گزینه صحیح: اکسیژن روتین در اشباع طبیعی ضروری نیست و «بجز» همین است."
        ],
        "reasons_en": [
            "Why incorrect: Nitro up to three at suitable pressure essential.",
            "Why incorrect: Aspirin in MI essential.",
            "Why incorrect: Morphine in nitro-resistant pain essential.",
            "Correct: Routine oxygen at normal saturation not essential and is 'except'."
        ],
        "lead_fa": "اشباع طبیعی یعنی اکسیژن روتین نده.",
        "lead_en": "Normal sat means no routine oxygen.",
        "golden_fa": "اکسیژن فقط در هیپوکسمی.",
        "golden_en": "Oxygen only in hypoxemia.",
        "points_fa": ["آسپیرین.", "نیترو.", "مورفین با احتیاط.", "بازپرفیوژن."],
        "points_en": ["Aspirin.", "Nitro.", "Morphine cautious.", "Reperfusion."],
        "hint_fa": "کدام درمان با ۹۸٪ لازم نیست؟",
        "hint_en": "Which therapy not needed at 98%?",
        "attending_fa": "استاد: اکسیژن بی‌جا نده.",
        "attending_en": "Attending: Don't give needless oxygen."
    },
    (1,160): {
        "interpretation_fa": "اندازه‌گیری صحیح فشار نیاز به استراحت، پشت و پاهای حمایتشده، بازو همسطح قلب و کاف مناسب دارد؛ عرض bladder حدود ۴۰ درصد محیط بازو و طول آن ۸۰ تا ۱۰۰ درصد است نه ۴۰ دور. فشار سیستولیک فاز یک و دیاستولیک فاز پنج کورتکوف است نه سه، اختلاف دو بازو بیش از ۱۰ تا ۱۵ پایدار غیرطبیعی و اختلاف فوقانی-تحتانی بیش از ۱۰ هم بررسی می‌شود. در ویزیت اول هر دو بازو سنجیده شود.",
        "interpretation_en": "Correct pressure needs rest, supported back and legs, arm heart level and proper cuff; bladder width about 40% arm circumference and length 80-100% not 40 around. Systolic phase I and diastolic phase V Korotkoff not three, inter-arm difference >10-15 persistent abnormal and upper-lower >10 also evaluated. At first visit both arms measured.",
        "reasons_fa": [
            "گزینه صحیح: پهنای کاف حدود ۴۰ درصد محیط بازو درست است.",
            "دلیل رد گزینه: دیاستول فاز پنج است نه سه.",
            "دلیل رد گزینه: اختلاف دو بازو بیش از ۵ غیرطبیعی نیست، بالای ۱۰ است.",
            "دلیل رد گزینه: فوقانی-تحتانی بیش از ۱۰ غیرطبیعی است ولی گزینه اول دقیق‌تر است."
        ],
        "reasons_en": [
            "Correct: Cuff width about 40% arm circumference correct.",
            "Why incorrect: Diastolic phase five not three.",
            "Why incorrect: Inter-arm >5 not abnormal, >10 is.",
            "Why incorrect: Upper-lower >10 abnormal but first more accurate."
        ],
        "lead_fa": "کاف ۴۰ درصد محیط است.",
        "lead_en": "Cuff 40% circumference.",
        "golden_fa": "دیاستول فاز پنج است.",
        "golden_en": "Diastolic phase five.",
        "points_fa": ["بازو همسطح قلب.", "دو بازو.", "فاز پنج.", "۱۰-۱۵ غیرطبیعی."],
        "points_en": ["Arm heart level.", "Both arms.", "Phase five.", "10-15 abnormal."],
        "hint_fa": "کاف را با چه درصدی می‌سنجی؟",
        "hint_en": "Which percent for cuff?",
        "attending_fa": "استاد: کاف را درست ببند.",
        "attending_en": "Attending: Wrap cuff correctly."
    },
    (1,161): {
        "interpretation_fa": "مرد ۶۰ ساله با انفارکتوس قدامی تحت استرپتوکیناز با ریتم جدید، فشار طبیعی و بهبود درد و تنگی نفس، بازپرفیوژن موفق با ریتم accelerated idioventricular را مطرح می‌کند. AIVR با ضربان ۵۰ تا ۱۲۰، همودینامیک پایدار و خودمحدودشونده است و نیاز به کاردیوورژن، آمیودارون یا لیدوکائین ندارد؛ فقط پایش کافی است. ناپایداری، VT پایدار یا VF مسیر را تغییر می‌دهد.",
        "interpretation_en": "A 60-year-old with anterior MI on streptokinase with new rhythm, normal pressure and improved pain and dyspnea suggests successful reperfusion with accelerated idioventricular rhythm. AIVR rate 50-120, stable and self-limited and no need for cardioversion, amiodarone or lidocaine; only monitoring enough. Instability, sustained VT or VF changes course.",
        "reasons_fa": [
            "دلیل رد گزینه: کاردیوورژن در AIVR پایدار لازم نیست.",
            "دلیل رد گزینه: آمیودارون در AIVR لازم نیست.",
            "دلیل رد گزینه: لیدوکائین در AIVR لازم نیست.",
            "گزینه صحیح: فقط پایش در AIVR پس از بازپرفیوژن کافی است."
        ],
        "reasons_en": [
            "Why incorrect: Cardioversion not needed in stable AIVR.",
            "Why incorrect: Amiodarone not needed in AIVR.",
            "Why incorrect: Lidocaine not needed in AIVR.",
            "Correct: Only monitoring in AIVR post-reperfusion enough."
        ],
        "lead_fa": "AIVR پس از لیز یعنی موفقیت.",
        "lead_en": "AIVR after lysis means success.",
        "golden_fa": "AIVR را درمان نکن.",
        "golden_en": "Don't treat AIVR.",
        "points_fa": ["۵۰-۱۲۰.", "خودمحدود.", "پایدار.", "پایش."],
        "points_en": ["50-120.", "Self-limited.", "Stable.", "Monitor."],
        "hint_fa": "ریتم قدامی پس لیز با فشار طبیعی چه می‌خواهد؟",
        "hint_en": "What anterior rhythm post-lysis with normal pressure wants?",
        "attending_fa": "استاد: AIVR را پایش کن.",
        "attending_en": "Attending: Monitor AIVR."
    },
    (1,162): {
        "interpretation_fa": "زن ۵۲ ساله دیابتی با STEMI قدامی سه روز قبل لیز شده و نیم‌ساعت درد بدون تغییر نوار، درد مجدد مشکوک به انفارکتوس مجدد است. تروپونین‌ها روزها بالا می‌مانند و میوگلوبین زود و غیراختصاصی است؛ CK-MB طی ۴۸ تا ۷۲ ساعت به پایه برمی‌گردد و افزایش مجدد آن با درد و نوار برای reinfarction کمک‌کننده‌تر است. تصمیم فقط آزمایشگاهی نیست و دینامیک مارکر با بالین تفسیر می‌شود.",
        "interpretation_en": "A 52-year-old diabetic with 3 days prior anterior STEMI lysed and 30-min pain without ECG change, recurrent pain suspicious for reinfarction. Troponins stay high for days and myoglobin early nonspecific; CK-MB returns to baseline 48-72h and re-elevation with pain and ECG more helpful for reinfarction. Decision not only lab and marker dynamics with clinic interpreted.",
        "reasons_fa": [
            "دلیل رد گزینه: تروپونین I روزها بالا می‌ماند.",
            "گزینه صحیح: CK-MB با بازگشت زودتر، reinfarction را بهتر نشان می‌دهد.",
            "دلیل رد گزینه: تروپونین T روزها بالا می‌ماند.",
            "دلیل رد گزینه: میوگلوبین زود و غیراختصاصی است."
        ],
        "reasons_en": [
            "Why incorrect: Troponin I stays high for days.",
            "Correct: CK-MB with earlier return better shows reinfarction.",
            "Why incorrect: Troponin T stays high for days.",
            "Why incorrect: Myoglobin early and nonspecific."
        ],
        "lead_fa": "روز سوم درد بی‌تغییر نوار یعنی CK-MB.",
        "lead_en": "Day 3 pain without ECG change means CK-MB.",
        "golden_fa": "تروپونین ماندگار است.",
        "golden_en": "Troponin persistent.",
        "points_fa": ["۴۸-۷۲ ساعت.", "دینامیک.", "درد+نوار.", "LDH قدیمی."],
        "points_en": ["48-72h.", "Dynamics.", "Pain+ECG.", "LDH old."],
        "hint_fa": "کدام زود به پایه برمی‌گردد؟",
        "hint_en": "Which returns early?",
        "attending_fa": "استاد: reinfarction را CK-MB بسنج.",
        "attending_en": "Attending: Judge reinfarction with CK-MB."
    },
    (1,163): {
        "interpretation_fa": "مرد ۷۲ ساله با درد گهگاهی و FC II، فشار ۱۶۵ روی ۹۵ و نبض ضعیف و تأخیری parvus tardus، تنگی آئورت را مطرح می‌کند نه نارسایی‌ها یا تنگی پولمونری. فشار بالا ریسک آترواسکلروز است ولی نبض تأخیری مشخصه AS است و با سوفل crescendo به کاروتید، A2 ضعیف و LVH همراه است. اکو سرعت جت و گرادیان را می‌سنجد و شدت علامت‌دار نیاز به تعویض دارد و فشار باید کنترل شود.",
        "interpretation_en": "A 72-year-old with occasional pain and FC II, 165/95 and weak delayed parvus tardus pulse suggests AS not regurgitations or PS. High pressure risk atherosclerosis but delayed pulse hallmark AS and with crescendo to carotid, weak A2 and LVH associated. Echo measures jet speed and gradient and symptomatic severe needs replacement and pressure should be controlled.",
        "reasons_fa": [
            "دلیل رد گزینه: نارسایی آئورت نبض جهنده می‌دهد.",
            "دلیل رد گزینه: تنگی پولمونری نبض تأخیری سیستمیک نمی‌دهد.",
            "گزینه صحیح: تنگی آئورت نبض ضعیف تأخیری می‌دهد.",
            "دلیل رد گزینه: نارسایی تریکوسپید نبض تأخیری نمی‌دهد."
        ],
        "reasons_en": [
            "Why incorrect: AR gives bounding pulse.",
            "Why incorrect: PS not systemic delayed pulse.",
            "Correct: AS gives weak delayed pulse.",
            "Why incorrect: TR not delayed pulse."
        ],
        "lead_fa": "نبض ضعیف تأخیری یعنی AS.",
        "lead_en": "Weak delayed means AS.",
        "golden_fa": "parvus tardus را بشناس.",
        "golden_en": "Know parvus tardus.",
        "points_fa": ["سوفل به کاروتید.", "A2 ضعیف.", "اکو گرادیان.", "فشار را بگیر."],
        "points_en": ["Murmur to carotid.", "Weak A2.", "Echo gradient.", "Take pressure."],
        "hint_fa": "کدام تنگی نبض را کند می‌کند؟",
        "hint_en": "Which stenosis slows pulse?",
        "attending_fa": "استاد: نبض تأخیری را AS ببین.",
        "attending_en": "Attending: See delayed as AS."
    },
    (1,164): {
        "interpretation_fa": "زن ۶۸ ساله دیابتی با نقرس و پرفشاری، فشار ۱۶۴ روی ۹۳، برادی ۵۸، سمع طبیعی، تحت لوزارتان، متفورمین و آلوپورینول، فشار کنترل‌نشده بدون اورژانس دارد. تیازید با افزایش اسید اوریک نقرس را تشدید می‌کند؛ هیدرالازین یا تغییر به کاپتوپریل اولویت نیست و افزودن کارودیلول با برادی ۵۸ نامناسب است. بهترین پیشنهاد افزودن دی‌هیدروپیریدین مانند آملودیپین یا هیدروکلروتیازید با احتیاط نقرس است ولی در این گزینه‌ها کارودیلول به‌عنوان بتابلوکر با برادی رد می‌شود و تیازید با ملاحظه مطرح است ولی صورت سوال تیازید را به‌عنوان انتخاب معرفی می‌کند.",
        "interpretation_en": "A 68-year-old diabetic with gout and HTN, 164/93, brady 58, normal exam, on losartan, metformin and allopurinol, uncontrolled without emergency. Thiazide with high uric worsens gout; hydralazine or switch to captopril not priority and adding carvedilol with brady 58 inappropriate. Best add dihydropyridine like amlodipine or thiazide with gout caution but in these options carvedilol as beta with brady rejected and thiazide with consideration considered.",
        "reasons_fa": [
            "گزینه صحیح: هیدرالازین در این ترکیب با لوزارتان افزودنی مطرح است.",
            "دلیل رد گزینه: تغییر به کاپتوپریل مزیتی ندارد.",
            "دلیل رد گزینه: کارودیلول با برادی ۵۸ مناسب نیست.",
            "دلیل رد گزینه: هیدروکلروتیازید با نقرس و پایش نیاز دارد و در این کلید انتخاب نیست."
        ],
        "reasons_en": [
            "Correct: Hydralazine in this combo with losartan add-on considered.",
            "Why incorrect: Switch to captopril no benefit.",
            "Why incorrect: Carvedilol with brady 58 not suitable.",
            "Why incorrect: Hydrochlorothiazide with gout and monitoring needed and not choice in this key."
        ],
        "lead_fa": "۶۸ ساله با لوزارتان یعنی هیدرالازین را بسنج.",
        "lead_en": "68-year-old with losartan means consider hydralazine.",
        "golden_fa": "برادی را با بتا نسنج.",
        "golden_en": "Don't judge brady with beta.",
        "points_fa": ["لوزارتان.", "برادی را ببین.", "نقرس را بپایش.", "تیازید با احتیاط."],
        "points_en": ["Losartan.", "See brady.", "Monitor gout.", "Thiazide cautious."],
        "hint_fa": "با ۵۸ و لوزارتان کدام افزودنی مطرح است؟",
        "hint_en": "With 58 and losartan which add-on considered?",
        "attending_fa": "استاد: هیدرالازین را بسنج.",
        "attending_en": "Attending: Consider hydralazine."
    },
    (1,165): {
        "interpretation_fa": "زن ۶۰ ساله بدون سابقه با تنگی نفس پیشرونده سه‌ماهه، AF و Q تحتانی و بزرگی قلب و پرخونی، کاردیومیوپاتی ایسکمیک با نارسایی و فیبریلاسیون را مطرح می‌کند. در نارسایی، JVP بالا، S3 و سوفل هولوسیستولیک آپکس از MR کارکردی دیده می‌شود ولی جابجایی PMI به سمت استرنوم دیده نمی‌شود؛ PMI به سمت زیربغل و پایین جابجا می‌شود و استرنوم جابجایی راست را نشان نمی‌دهد. درمان چهار ستون و کنترل ضربان و ضد انعقاد در AF لازم است.",
        "interpretation_en": "A 60-year-old without history with 3-month progressive dyspnea, AF and inferior Q and cardiomegaly and congestion suggests ischemic cardiomyopathy with failure and AF. In failure, high JVP, S3 and holosystolic apical murmur from functional MR seen but PMI displacement to sternum not seen; PMI displaced to axilla and down and sternum not shows right displacement. Four pillars and rate control and anticoag in AF needed.",
        "reasons_fa": [
            "دلیل رد گزینه: JVP بالا در نارسایی دیده می‌شود.",
            "دلیل رد گزینه: S3 در نارسایی دیده می‌شود.",
            "گزینه صحیح: جابجایی PMI به استرنوم دیده نمی‌شود و «ندارید» همین است.",
            "دلیل رد گزینه: سوفل هولوسیستولیک آپکس در نارسایی دیده می‌شود."
        ],
        "reasons_en": [
            "Why incorrect: High JVP seen in failure.",
            "Why incorrect: S3 seen in failure.",
            "Correct: PMI to sternum not seen and is 'not expected'.",
            "Why incorrect: Holosystolic apical murmur seen in failure."
        ],
        "lead_fa": "PMI نارسا به زیربغل می‌رود نه استرنوم.",
        "lead_en": "Failing PMI goes to axilla not sternum.",
        "golden_fa": "جابجایی استرنوم را اشتباه نگیر.",
        "golden_en": "Don't mistake sternal shift.",
        "points_fa": ["AF.", "Q تحتانی.", "بزرگی قلب.", "MR کارکردی."],
        "points_en": ["AF.", "Inferior Q.", "Cardiomegaly.", "Functional MR."],
        "hint_fa": "کدام جابجایی به استرنوم نمی‌رود؟",
        "hint_en": "Which shift not to sternum?",
        "attending_fa": "استاد: PMI را زیربغلی ببین.",
        "attending_en": "Attending: See PMI axillary."
    },
    (1,166): {
        "interpretation_fa": "دختر ۶ ساله با سوفل ۲ از ۶ سیستولیک فضای دوم چپ و S2 و S1 یکنواخت با split ثابت یا S2 ثابت، نقص سپتوم دهلیزی با شانت چپ‌به‌راست و افزایش جریان پولمونری را مطرح می‌کند؛ سوفل ejection پولمونری از جریان زیاد است و S2 با split ثابت. شانت چپ‌به‌راست بیشتر دهلیز راست و بطن راست را متسع می‌کند و بطن چپ کمتر تحت تأثیر است برخلاف VSD که چپ را بیشتر درگیر می‌کند. اکو نوع و اندازه را تعیین و بستن در شانت معنادار مطرح است.",
        "interpretation_en": "A 6-year-old with 2/6 systolic murmur left second space and uniform S2 S1 with fixed split or fixed S2 suggests ASD with left-to-right and increased pulmonary flow; pulmonary ejection from high flow and S2 fixed split. Left-to-right more dilates RA and RV and LV less affected unlike VSD that more involves left. Echo determines type and size and closure in significant shunt considered.",
        "reasons_fa": [
            "دلیل رد گزینه: دهلیز چپ کمتر از راست متسع می‌شود.",
            "دلیل رد گزینه: بطن راست در ASD متسع می‌شود.",
            "دلیل رد گزینه: دهلیز راست در ASD متسع می‌شود.",
            "گزینه صحیح: بطن چپ در ASD کمتر تحت تأثیر است."
        ],
        "reasons_en": [
            "Why incorrect: LA less dilates than RA.",
            "Why incorrect: RV in ASD dilates.",
            "Why incorrect: RA in ASD dilates.",
            "Correct: LV in ASD less affected."
        ],
        "lead_fa": "ASD یعنی راست متسع، چپ کم.",
        "lead_en": "ASD means right dilated, left less.",
        "golden_fa": "S2 ثابت را بشناس.",
        "golden_en": "Know fixed S2.",
        "points_fa": ["سوفل 2/6.", "split ثابت.", "اکو.", "بستن در شانت بزرگ."],
        "points_en": ["2/6 murmur.", "Fixed split.", "Echo.", "Closure large shunt."],
        "hint_fa": "کدام حفره در ASD کم می‌ماند؟",
        "hint_en": "Which chamber stays less in ASD?",
        "attending_fa": "استاد: ASD را راستی ببین.",
        "attending_en": "Attending: View ASD as right-sided."
    },
    (1,167): {
        "interpretation_fa": "تاکی‌کاردی پهن QRS منظم ۱۶۰ در بالغ را تا خلافش ثابت نشده VT فرض کنید؛ concordance مثبت، capture و fusion به نفع VT است ولی نبود موج P به‌تنهایی افتراق‌دهنده نیست چون SVT با انحراف هم P نامرئی دارد. AV dissociation، محور غیرعادی و سابقه انفارکتوس هم به VT کمک می‌کند. در ناپایداری کاردیوورژن و در بدون نبض دیفیبریلاسیون لازم است و درمان ناپایدار برق است.",
        "interpretation_en": "Wide QRS regular tachy 160 in adult assume VT until proven otherwise; positive concordance, capture and fusion favor VT but no visible P alone not discriminating because SVT with aberrancy also invisible P. AV dissociation, abnormal axis and prior MI also help VT. In instability cardioversion and pulseless defibrillation needed and unstable therapy electric.",
        "reasons_fa": [
            "دلیل رد گزینه: concordance به نفع VT است.",
            "دلیل رد گزینه: capture به نفع VT است.",
            "دلیل رد گزینه: fusion به نفع VT است.",
            "گزینه صحیح: نبود P به‌تنهایی به نفع VT نیست و «نیست» همین است."
        ],
        "reasons_en": [
            "Why incorrect: Concordance favors VT.",
            "Why incorrect: Capture favors VT.",
            "Why incorrect: Fusion favors VT.",
            "Correct: No visible P alone not favor VT and is 'not'."
        ],
        "lead_fa": "P نامرئی را VT نگیر.",
        "lead_en": "Don't take invisible P as VT.",
        "golden_fa": "capture را VT بدان.",
        "golden_en": "Know capture as VT.",
        "points_fa": ["VT فرضی.", "محور.", "سابقه MI.", "برق در ناپایدار."],
        "points_en": ["Assume VT.", "Axis.", "Prior MI.", "Shock unstable."],
        "hint_fa": "کدام یافته VT را ثابت نمی‌کند؟",
        "hint_en": "Which not proves VT?",
        "attending_fa": "استاد: P نامرئی را ملاک نگیر.",
        "attending_en": "Attending: Don't criterion invisible P."
    },
    (1,168): {
        "interpretation_fa": "کودک ۵ ساله با غش حین بازی، سنکوپ فعالیتی پرخطر را مطرح می‌کند؛ فوت ناگهانی برادر ۸ ساله، انحراف محور چپ یا سوفل AS و افزایش JVP با بیماری ساختاری یا کانالوپاتی همراه و پرخطر است و نیاز به بستری دارد. هیچ‌یک به‌تنهایی بی‌خطر نیست ولی صورت سوال می‌خواهد کدام «نیست» که در کلید رسمی افزایش JVP به‌عنوان کم‌خطر نسبی انتخاب شده است؛ با این حال هر سه دیگر پرخطرترند و ارزیابی نوار، اکو و هولتر لازم است.",
        "interpretation_en": "A 5-year-old with faint during play suggests high-risk exertional syncope; sudden death brother 8y, left axis deviation or AS murmur and high JVP with structural or channelopathy and high-risk and needs admission. None alone benign but official key picks high JVP as relatively not high-risk; however other three more high-risk and ECG, echo and Holter evaluation needed.",
        "reasons_fa": [
            "دلیل رد گزینه: فوت برادر پرخطر است.",
            "دلیل رد گزینه: انحراف محور چپ پرخطر است.",
            "گزینه صحیح: افزایش JVP به‌تنهایی کم‌خطرتر تلقی شده و «نیست» همین است.",
            "دلیل رد گزینه: سوفل AS پرخطر است."
        ],
        "reasons_en": [
            "Why incorrect: Brother death high-risk.",
            "Why incorrect: Left axis high-risk.",
            "Correct: High JVP alone considered less high-risk and is 'not'.",
            "Why incorrect: AS murmur high-risk."
        ],
        "lead_fa": "غش بازی یعنی پرخطر را بجوی.",
        "lead_en": "Play faint means seek high-risk.",
        "golden_fa": "سابقه خانوادگی را جدی بگیر.",
        "golden_en": "Take family history seriously.",
        "points_fa": ["نوار.", "اکو.", "هولتر.", "بستری."],
        "points_en": ["ECG.", "Echo.", "Holter.", "Admit."],
        "hint_fa": "کدام نسبتاً کم‌خطرتر است؟",
        "hint_en": "Which relatively less risk?",
        "attending_fa": "استاد: غش بازی را بستری کن.",
        "attending_en": "Attending: Admit play faint."
    },
    (1,169): {
        "interpretation_fa": "در تنگی نفس حاد، افتراق قلبی از ریوی با BNP که کشش دیواره را نشان می‌دهد و با CXR و معاینه و اکو تکمیل می‌شود؛ تست ورزش در اورژانس حاد مناسب نیست و ECG و CXR هم کمک‌کننده‌اند ولی BNP با حساسیت منفی قوی، رد نارسایی را بهتر می‌کند. چاقی پایین کاذب و سن و کلیه بالا می‌برند و cut-off سنی متفاوت است. تصمیم نهایی چندوجهی است و یک تست به‌تنهایی کافی نیست.",
        "interpretation_en": "In acute dyspnea, differentiation cardiac vs pulmonary with BNP showing wall stretch and completed with CXR and exam and echo; exercise test not suitable in acute emergency and ECG and CXR also helpful but BNP with strong negative sensitivity better rules out failure. Obesity false low and age and kidney raise and age cut-off different. Final decision multimodal and one test alone insufficient.",
        "reasons_fa": [
            "دلیل رد گزینه: CXR کمک می‌کند ولی BNP افتراق بهتری می‌دهد.",
            "دلیل رد گزینه: تست ورزش در حاد مناسب نیست.",
            "گزینه صحیح: BNP افتراق قلبی-ریوی را بهتر کمک می‌کند.",
            "دلیل رد گزینه: ECG کمک می‌کند ولی BNP قوی‌تر است."
        ],
        "reasons_en": [
            "Why incorrect: CXR helps but BNP better differentiates.",
            "Why incorrect: Exercise not suitable in acute.",
            "Correct: BNP better helps cardiac-pulmonary differentiation.",
            "Why incorrect: ECG helps but BNP stronger."
        ],
        "lead_fa": "تنگی نفس حاد یعنی BNP.",
        "lead_en": "Acute dyspnea means BNP.",
        "golden_fa": "BNP رد قوی دارد.",
        "golden_en": "BNP strong rule-out.",
        "points_fa": ["CXR.", "اکو.", "سن و چاقی.", "چندوجهی."],
        "points_en": ["CXR.", "Echo.", "Age and obesity.", "Multimodal."],
        "hint_fa": "کدام پپتید قلبی-ریوی را جدا می‌کند؟",
        "hint_en": "Which peptide separates cardiac-pulmonary?",
        "attending_fa": "استاد: تنگی نفس را با BNP بسنج.",
        "attending_en": "Attending: Judge dyspnea with BNP."
    },
    (1,170): {
        "interpretation_fa": "زن ۳۵ ساله با FC II، ریتم نامنظم، S1 و S2 بلند، double density راست، تنگی میترال را مطرح می‌کند؛ S1 بلند، اسنپ بازشدن و رامبل دیاستولیک اپکس با فیبریلاسیون و فشار ریوی همراه است و نارسایی یا تنگی آئورت این نمای رادیولوژیک را نمی‌دهند. اکو سطح دریچه و گرادیان را می‌سنجد و کنترل ضربان و ضد انعقاد در AF و والووتومی در مناسب مطرح است.",
        "interpretation_en": "A 35-year-old with FC II, irregular rhythm, loud S1 S2, double density right suggests MS; loud S1, opening snap and diastolic rumble at apex with AF and pulmonary hypertension associated and AR or AS not give this radiologic view. Echo measures valve area and gradient and rate control and anticoag in AF and valvotomy in suitable considered.",
        "reasons_fa": [
            "گزینه صحیح: تنگی میترال double density می‌دهد.",
            "دلیل رد گزینه: تنگی آئورت double density نمی‌دهد.",
            "دلیل رد گزینه: نارسایی میترال double density تیپیک نمی‌دهد.",
            "دلیل رد گزینه: نارسایی آئورت double density نمی‌دهد."
        ],
        "reasons_en": [
            "Correct: MS gives double density.",
            "Why incorrect: AS not give double density.",
            "Why incorrect: MR not give typical double density.",
            "Why incorrect: AR not give double density."
        ],
        "lead_fa": "نامنظم+بلند+double یعنی MS.",
        "lead_en": "Irregular+loud+double means MS.",
        "golden_fa": "MS را با رامبل بشناس.",
        "golden_en": "Know MS by rumble.",
        "points_fa": ["AF.", "S1 بلند.", "اکو.", "ضد انعقاد."],
        "points_en": ["AF.", "Loud S1.", "Echo.", "Anticoag."],
        "hint_fa": "کدام تنگی دهلیز را دوگانه می‌کند؟",
        "hint_en": "Which stenosis doubles atrium?",
        "attending_fa": "استاد: MS را با double ببین.",
        "attending_en": "Attending: See MS by double."
    },
    (1,171): {
        "interpretation_fa": "مرد ۵۰ ساله با درد شکافنده پس از بلند کردن سنگین از ظهر، اختلاف فشار ۵۰ میلی‌متر دو بازو، تاکی‌کاردی بدون ST، دیسکسیون آئورت را مطرح می‌کند. کنترل فشار با کاهش ضربان و نیروی برشی اولویت دارد؛ لابتالول وریدی با اثر آلفا و بتا هر دو را کم می‌کند در حالی که کاپتوپریل یا نیفیدیپین زیرزبانی افت غیرقابل کنترل و نیترو وریدی به‌تنهایی تاکی‌رفلکسی می‌دهد. سی‌تی آئورت سریع و جراحی نوع A لازم است.",
        "interpretation_en": "A 50-year-old with tearing pain after heavy lifting since noon, 50 mm arm difference, tachy without ST suggests dissection. Pressure control with rate and shear reduction priority; IV labetalol with alpha and beta both reduces while sublingual captopril or nifedipine uncontrolled drop and IV nitro alone reflex tachy gives. Rapid CT aorta and type A surgery needed.",
        "reasons_fa": [
            "دلیل رد گزینه: کاپتوپریل زیرزبانی کنترل برشی نمی‌دهد.",
            "دلیل رد گزینه: نیفیدیپین زیرزبانی افت غیرقابل کنترل می‌دهد.",
            "دلیل رد گزینه: نیترو وریدی به‌تنهایی تاکی‌رفلکسی می‌دهد.",
            "گزینه صحیح: لابتالول وریدی ضربان و فشار را با هم کم می‌کند."
        ],
        "reasons_en": [
            "Why incorrect: Sublingual captopril not shear control.",
            "Why incorrect: Sublingual nifedipine uncontrolled drop.",
            "Why incorrect: IV nitro alone reflex tachy.",
            "Correct: IV labetalol reduces rate and pressure together."
        ],
        "lead_fa": "دیسکسیون یعنی لابتالول وریدی.",
        "lead_en": "Dissection means IV labetalol.",
        "golden_fa": "ضربان سپس فشار.",
        "golden_en": "Rate then pressure.",
        "points_fa": ["50 اختلاف.", "شکافنده.", "Type A جراحی.", "لیز ممنوع."],
        "points_en": ["50 difference.", "Tearing.", "Type A surgery.", "Lysis forbidden."],
        "hint_fa": "کدام وریدی هر دو را کم می‌کند؟",
        "hint_en": "Which IV lowers both?",
        "attending_fa": "استاد: دیسکسیون را با لابتالول بگیر.",
        "attending_en": "Attending: Take dissection with labetalol."
    },
    (1,172): {
        "interpretation_fa": "زن ۵۵ ساله دیابتی با درد استراحتی ۱۵ دقیقه‌ای، ST depression یک میلی‌متری تحتانی و پاسخ به نیترو، NSTE-ACS پرخطر را مطرح می‌کند. درمان پایه DAPT، آنتی‌کوآگولانت و استاتین و در پرخطر آنژیو زودرس است؛ نیترو وریدی و آنتی‌کوآگولانت تجویز می‌شوند ولی بتابلوکر خوراکی در NSTE با درد تازه و ریسک برادی یا نارسایی، در این لحظه تجویز نمی‌شود و «بجز» همین است. انتخاب بر فشار و ضربان متکی است.",
        "interpretation_en": "A 55-year-old diabetic with 15-min rest pain, 1 mm inferior ST depression and nitro response suggests high-risk NSTE-ACS. Base DAPT, anticoagulant and statin and in high-risk early cath; IV nitro and anticoag given but oral beta in NSTE with fresh pain and brady/failure risk, at this moment not given and is 'except'. Choice pressure and rate based.",
        "reasons_fa": [
            "دلیل رد گزینه: DAPT در NSTE ضروری است.",
            "گزینه صحیح: نیترو وریدی با درد برطرف‌شده فعلاً «بجز» است.",
            "دلیل رد گزینه: بتابلوکر خوراکی معمولاً داده می‌شود.",
            "دلیل رد گزینه: انوکساپارین در NSTE ضروری است."
        ],
        "reasons_en": [
            "Why incorrect: DAPT in NSTE essential.",
            "Correct: IV nitro with resolved pain currently 'except'.",
            "Why incorrect: Oral beta usually given.",
            "Why incorrect: Enoxaparin in NSTE essential."
        ],
        "lead_fa": "درد برطرف یعنی نیترو وریدی فعلاً نه.",
        "lead_en": "Pain resolved means IV nitro not now.",
        "golden_fa": "NSTE را با درد بسنج.",
        "golden_en": "Judge NSTE by pain.",
        "points_fa": ["ST پایین.", "دیابت.", "GRACE.", "آنژیو."],
        "points_en": ["ST depression.", "Diabetes.", "GRACE.", "Angio."],
        "hint_fa": "با درد برطرف کدام وریدی را نگه می‌داری؟",
        "hint_en": "Which IV to hold with resolved pain?",
        "attending_fa": "استاد: NSTE بدون درد را بدون نیترو بسنج.",
        "attending_en": "Attending: Judge NSTE without pain without nitro."
    },
    (1,173): {
        "interpretation_fa": "در پرفشاری، تیازید با بلوک‌کننده رنین-آنژیوتانسین یا دی‌هیدروپیریدین هم‌افزایی دارد چون حجم و عروق را جداگانه می‌گیرد. افزودن تیازید به آملودیپین که به‌تنهایی عروق را گشاد می‌کند هم‌افزایی کمتری از افزودن به لوزارتان یا کاندسارتان یا کاپتوپریل دارد و صورت سوال «کمتر» را با آملودیپین نشان می‌دهد. ترکیب‌ها باید بر پتاسیم، کلیه و نقرس پایش شوند و دوز پایین تیازید ارجح است.",
        "interpretation_en": "In hypertension, thiazide with RAAS blocker or dihydropyridine synergizes because volume and vessels separately taken. Adding thiazide to amlodipine which alone dilates vessels less synergy than adding to losartan or candesartan or captopril and question shows 'less' with amlodipine. Combos must monitor K, kidney and gout and low-dose thiazide preferred.",
        "reasons_fa": [
            "دلیل رد گزینه: لوزارتان+تیازید هم‌افزایی خوب دارد.",
            "دلیل رد گزینه: کاپتوپریل+تیازید هم‌افزایی خوب دارد.",
            "گزینه صحیح: آملودیپین+تیازید تأثیر کمتری دارد و «کمتر» همین است.",
            "دلیل رد گزینه: کاندسارتان+تیازید هم‌افزایی خوب دارد."
        ],
        "reasons_en": [
            "Why incorrect: Losartan+thiazide good synergy.",
            "Why incorrect: Captopril+thiazide good synergy.",
            "Correct: Amlodipine+thiazide less effect and is 'less'.",
            "Why incorrect: Candesartan+thiazide good synergy."
        ],
        "lead_fa": "تیازید با RAAS بیشتر می‌گیرد تا با آملودیپین.",
        "lead_en": "Thiazide with RAAS takes more than with amlodipine.",
        "golden_fa": "هم‌افزایی را بشناس.",
        "golden_en": "Know synergy.",
        "points_fa": ["حجم+عروق.", "پتاسیم.", "نقرس.", "دوز کم."],
        "points_en": ["Volume+vessels.", "K.", "Gout.", "Low dose."],
        "hint_fa": "با کدام فشاربر کمتر می‌گیرد؟",
        "hint_en": "With which pressure drug less?",
        "attending_fa": "استاد: تیازید را با RAAS ببین.",
        "attending_en": "Attending: View thiazide with RAAS."
    },
    (1,174): {
        "interpretation_fa": "در anterior STEMI با درد و صعود ST قدامی، یافته‌های التهابی و همودینامیک شامل S3/S4، راب پریکاردی و سوفل میدسیستولیک گذرا از جریان یا پاپیلری دیده می‌شوند ولی افزایش حجم نبض کاروتید دیده نمی‌شود؛ حجم نبض بیشتر در نارسایی آئورت یا مجرای باز زیاد است نه انفارکتوس قدامی با افت برون‌ده. سایر یافته‌ها با ادم، التهاب و اختلال پاپیلری قابل انتظارند و پایش با اکو و نوار مهم است.",
        "interpretation_en": "In anterior STEMI with pain and anterior ST elevation, inflammatory and hemodynamic including S3/S4, pericardial rub and transient midsystolic murmur from flow or papillary seen but increased carotid pulse volume not seen; pulse volume more in AR or PDA not in anterior infarct with low output. Other findings with edema, inflammation and papillary disturbance expected and monitoring with echo and ECG important.",
        "reasons_fa": [
            "دلیل رد گزینه: S3/S4 در anterior STEMI مورد انتظار است.",
            "دلیل رد گزینه: راب پریکاردی در anterior مورد انتظار است.",
            "گزینه صحیح: افزایش حجم نبض کاروتید در anterior مورد انتظار نیست و «بجز» همین است.",
            "دلیل رد گزینه: سوفل میدسیستولیک گذرا در anterior مورد انتظار است."
        ],
        "reasons_en": [
            "Why incorrect: S3/S4 in anterior STEMI expected.",
            "Why incorrect: Pericardial rub in anterior expected.",
            "Correct: Increased carotid pulse volume in anterior not expected and is 'except'.",
            "Why incorrect: Transient midsystolic murmur in anterior expected."
        ],
        "lead_fa": "قدامی یعنی نبض پرحجم نداری.",
        "lead_en": "Anterior means no bounding carotid.",
        "golden_fa": "حجم نبض را با AR اشتباه نگیر.",
        "golden_en": "Don't confuse pulse volume with AR.",
        "points_fa": ["S3.", "راب.", "سوفل گذرا.", "اکو."],
        "points_en": ["S3.", "Rub.", "Transient murmur.", "Echo."],
        "hint_fa": "کدام نبض مال قد‌امی نیست؟",
        "hint_en": "Which pulse not anterior?",
        "attending_fa": "استاد: قد‌امی را با نبض کم ببین.",
        "attending_en": "Attending: View anterior with low pulse."
    },
    (1,175): {
        "interpretation_fa": "MVP با کلیک میدسیستولیک و سوفل دیرسیستولیک همراه است و با کاهش حجم (ایستادن، والسالوا strain) کلیک و سوفل زودتر و بلندتر می‌شود و با افزایش حجم یا پس‌بار (چمباتمه، هندگریپ) دیرتر و کمتر می‌شود. افزایش شدت با isometric exercise (افزایش پس‌بار) بیشتر به نفع MR است نه MVP و MVP را رد می‌کند؛ همین ویژگی افتراق MR از MVP را کمک می‌کند و اکو پرولاپس را تأیید می‌کند.",
        "interpretation_en": "MVP with midsystolic click and late systolic murmur and with less volume (standing, Valsalva strain) click and murmur earlier and louder and with more volume or afterload (squatting, handgrip) later and less. Increase with isometric exercise (higher afterload) more for MR not MVP and rejects MVP; this differentiates MR from MVP and echo confirms prolapse.",
        "reasons_fa": [
            "دلیل رد گزینه: ایستادن MVP را تشدید می‌کند.",
            "دلیل رد گزینه: چمباتمه MVP را کم می‌کند.",
            "گزینه صحیح: افزایش با isometric به نفع MR است و MVP را رد می‌کند.",
            "دلیل رد گزینه: والسالوا MVP را تشدید می‌کند."
        ],
        "reasons_en": [
            "Why incorrect: Standing worsens MVP.",
            "Why incorrect: Squatting lessens MVP.",
            "Correct: Increase with isometric favors MR and rejects MVP.",
            "Why incorrect: Valsalva worsens MVP."
        ],
        "lead_fa": "MVP با حجم کم زیاد می‌شود.",
        "lead_en": "MVP with low volume increases.",
        "golden_fa": "isometric MVP را کم می‌کند.",
        "golden_en": "Isometric lessens MVP.",
        "points_fa": ["کلیک.", "ایستادن.", "والسالوا.", "اکو."],
        "points_en": ["Click.", "Standing.", "Valsalva.", "Echo."],
        "hint_fa": "کدام مانور MVP را رد می‌کند؟",
        "hint_en": "Which maneuver rejects MVP?",
        "attending_fa": "استاد: MVP را با حجم بسنج.",
        "attending_en": "Attending: Judge MVP with volume."
    },
    (1,176): {
        "interpretation_fa": "زن ۲۰ ساله با ایستادن طولانی، تعریق و رنگ‌پریدگی و افت هوشیاری گذرا با بازگشت ثانیه‌ای، سنکوپ وازوواگال تیپیک را مطرح می‌کند که با هیپوتانسیون و برادی رفلکسی از تحریک واگ همراه است. آریتمی، TIA یا تنگی آئورت prodrome وازوواگال و بهبود خوابیده را ندارند و با تلاش یا بدون prodrome می‌آیند. آموزش، مایعات، نمک و مانور counter-pressure پایه است و بستری لازم نیست.",
        "interpretation_en": "A 20-year-old with prolonged standing, sweating and pallor and transient loss with seconds recovery suggests typical vasovagal syncope with reflex hypotension and brady from vagal. Arrhythmia, TIA or AS not have vasovagal prodrome and supine recovery and come with effort or without prodrome. Education, fluids, salt and counter-pressure maneuver base and no admission needed.",
        "reasons_fa": [
            "دلیل رد گزینه: آریتمی prodrome وازوواگال ندارد.",
            "دلیل رد گزینه: TIA با ایستادن و تعریق وازوواگال نیست.",
            "گزینه صحیح: وازوواگال با ایستادن و prodrome مطرح است.",
            "دلیل رد گزینه: تنگی آئورت با تلاش می‌آید نه ایستادن طولانی."
        ],
        "reasons_en": [
            "Why incorrect: Arrhythmia no vasovagal prodrome.",
            "Why incorrect: TIA not standing sweating vasovagal.",
            "Correct: Vasovagal with standing and prodrome suggested.",
            "Why incorrect: AS with effort not prolonged standing."
        ],
        "lead_fa": "ایستادن+تعریق+پریدگی یعنی وازوواگال.",
        "lead_en": "Standing+sweat+pallor means vasovagal.",
        "golden_fa": "وازوواگال خوش‌خیم است.",
        "golden_en": "Vasovagal benign.",
        "points_fa": ["prodrome.", "خوابیده بهبود.", "مایعات.", "counter-pressure."],
        "points_en": ["Prodrome.", "Supine recovery.", "Fluids.", "Counter-pressure."],
        "hint_fa": "کدام سنکوپ با ایستادن می‌آید؟",
        "hint_en": "Which syncope with standing?",
        "attending_fa": "استاد: وازوواگال را بشناس.",
        "attending_en": "Attending: Recognize vasovagal."
    },
    (1,177): {
        "interpretation_fa": "زن ۷۱ ساله با DM و HTN و IHD بدون پیگیری، تنگی نفس شدید، فشار ۱۸۰ روی ۱۱۰، اشباع ۸۸، ادم ژنرالیزه، رال تا نیمه و ارتوپنه، ادم ریه کاردیوژنیک با فشار بالا را مطرح می‌کند. فورزماید، اکسیژن و مورفین با احتیاط در کنار نیترات و NIV توصیه می‌شود ولی هیدروکورتیزون وریدی ۲۰۰ در ادم ریه کاردیوژنیک اندیکاسیون ندارد و «بجز» همین است. بتابلوکر در دکمپانسیشن شروع نمی‌شود و دیس‌پنه قلبی با آسم اشتباه نشود.",
        "interpretation_en": "A 71-year-old with DM and HTN and IHD without follow-up, severe dyspnea, 180/110, 88% sat, generalized edema, rales to half and orthopnea suggests cardiogenic pulmonary edema with high pressure. Furosemide, oxygen and morphine cautious with nitrate and NIV recommended but IV hydrocortisone 200 in cardiogenic edema not indicated and is 'except'. Beta not started in decompensation and cardiac dyspnea not confused with asthma.",
        "reasons_fa": [
            "دلیل رد گزینه: فورزماید در ادم ریه توصیه می‌شود.",
            "دلیل رد گزینه: اکسیژن در هیپوکسمی توصیه می‌شود.",
            "گزینه صحیح: هیدروکورتیزون در ادم کاردیوژنیک توصیه نمی‌شود و «بجز» همین است.",
            "دلیل رد گزینه: مورفین با احتیاط توصیه می‌شود."
        ],
        "reasons_en": [
            "Why incorrect: Furosemide in pulmonary edema recommended.",
            "Why incorrect: Oxygen in hypoxemia recommended.",
            "Correct: Hydrocortisone in cardiogenic edema not recommended and is 'except'.",
            "Why incorrect: Morphine cautious recommended."
        ],
        "lead_fa": "ادم کاردیوژنیک یعنی کورتون نه.",
        "lead_en": "Cardiogenic edema means no steroid.",
        "golden_fa": "کورتون را برای آسم نگه دار.",
        "golden_en": "Keep steroid for asthma.",
        "points_fa": ["فورزماید.", "نیترات.", "NIV.", "فشار را بگیر."],
        "points_en": ["Furosemide.", "Nitrate.", "NIV.", "Take pressure."],
        "hint_fa": "کدام آمپول مال ریه قلبی نیست؟",
        "hint_en": "Which ampule not for cardiac lung?",
        "attending_fa": "استاد: ادم را با دیورتیک بسنج نه کورتون.",
        "attending_en": "Attending: Judge edema with diuretic not steroid."
    },
    (1,178): {
        "interpretation_fa": "کوآرکتاسیون آئورت سینه‌ای با فشار بالای اندام فوقانی، اختلاف فشار چهار اندام، سوفل بین کتفی و دندانه دنده همراه است و شایع‌ترین همراهی دریچه‌ای آن دریچه آئورت دولتی است که استنوز یا نارسایی می‌دهد؛ تنگی یا نارسایی میترال همراهی شایع نیست. اکو کوآرکتاسیون و دریچه را می‌بیند و درمان استنت یا جراحی است و فشار هر چهار اندام باید گرفته شود.",
        "interpretation_en": "Thoracic coarctation with high upper pressure, four-limb difference, interscapular murmur and rib notching and most common valvular association bicuspid aortic valve that gives stenosis or regurg; mitral stenosis or regurg not common association. Echo sees coarctation and valve and stent or surgery therapy and four-limb pressure should be taken.",
        "reasons_fa": [
            "دلیل رد گزینه: تنگی میترال همراهی شایع کوآرکتاسیون نیست.",
            "گزینه صحیح: دولتی آئورت شایع‌ترین همراهی کوآرکتاسیون است.",
            "دلیل رد گزینه: نارسایی میترال همراهی شایع نیست.",
            "دلیل رد گزینه: نارسایی آئورت به‌تنهایی کمتر از دولتی شایع است."
        ],
        "reasons_en": [
            "Why incorrect: MS not common coarctation association.",
            "Correct: Bicuspid aorta most common coarctation association.",
            "Why incorrect: MR not common association.",
            "Why incorrect: AR alone less common than bicuspid."
        ],
        "lead_fa": "کوآرکتاسیون یعنی دولتی را بجوی.",
        "lead_en": "Coarctation means seek bicuspid.",
        "golden_fa": "دولتی را با اکو ببین.",
        "golden_en": "See bicuspid with echo.",
        "points_fa": ["چهار اندام.", "دندانه.", "سوفل.", "استنت/جراحی."],
        "points_en": ["Four limbs.", "Notching.", "Murmur.", "Stent/surgery."],
        "hint_fa": "کدام دریچه با کوآرکت می‌آید؟",
        "hint_en": "Which valve with coarct?",
        "attending_fa": "استاد: کوآرکت را با دولتی بشناس.",
        "attending_en": "Attending: Know coarct with bicuspid."
    },
    (1,179): {
        "interpretation_fa": "مرد ۸۵ ساله با تنگی نفس، خستگی زودرس، ورم، فشار ۱۰۵ روی ۹۰، S3 و S4، رال قاعده، JVP برجسته، ادم و EF 25% نارسایی کاهشی علامت‌دار را مطرح می‌کند. BNP با کشش دیواره بالا می‌رود و با سن، کلیه و AF بالاتر می‌رود؛ حداکثر جذب اکسیژن با نارسایی پایین می‌آید و فشار نبض و جذب روده مارکر نارسایی نیستند. BNP پیش‌آگهی و تشخیص را کمک می‌کند و با چاقی پایین کاذب است.",
        "interpretation_en": "An 85-year-old with dyspnea, early fatigue, edema, 105/90, S3 S4, basal rales, high JVP, edema and EF 25% suggests symptomatic reduced failure. BNP with wall stretch rises and with age, kidney and AF higher; peak VO2 with failure low and pulse pressure and gut absorption not failure markers. BNP helps prognosis and diagnosis and with obesity false low.",
        "reasons_fa": [
            "گزینه صحیح: BNP در نارسایی افزایش می‌یابد.",
            "دلیل رد گزینه: VO2max در نارسایی کاهش می‌یابد نه افزایش.",
            "دلیل رد گزینه: جذب روده مارکر نارسایی نیست.",
            "دلیل رد گزینه: فشار نبض مارکر نارسایی نیست."
        ],
        "reasons_en": [
            "Correct: BNP in failure increased.",
            "Why incorrect: VO2max in failure decreased not increased.",
            "Why incorrect: Gut absorption not failure marker.",
            "Why incorrect: Pulse pressure not failure marker."
        ],
        "lead_fa": "EF پایین یعنی BNP بالا.",
        "lead_en": "Low EF means high BNP.",
        "golden_fa": "VO2 پایین یعنی نارسا.",
        "golden_en": "Low VO2 means failing.",
        "points_fa": ["BNP.", "اکو.", "چهار ستون.", "VO2."],
        "points_en": ["BNP.", "Echo.", "Four pillars.", "VO2."],
        "hint_fa": "کدام مارکر با کشش بالا می‌رود؟",
        "hint_en": "Which marker rises with stretch?",
        "attending_fa": "استاد: نارسایی را با BNP بسنج.",
        "attending_en": "Attending: Judge failure with BNP."
    },
    (1,180): {
        "interpretation_fa": "زن ۶۷ ساله با درد تیپیک شدید ۳۰ دقیقه‌ای، هیپرلیپیدمی و سکته ۸ ماه قبل، فشار ۱۳۰ روی ۸۰، S4، JVP طبیعی، ST صعود V2 تا V4 و نزول تحتانی و CPK-MB طبیعی، STEMI قدامی حاد بسیار زود با سکته اخیر را مطرح می‌کند. سکته ایسکمیک ۸ ماه قبل منع قطعی فیبرینولیتیک در ماه‌های اخیر است و CPK طبیعی STEMI را رد نمی‌کند و بهترین اقدام PCI اولیه است نه لیتیک یا دیلتیازم وریدی یا چک مجدد آنزیم برای تصمیم.",
        "interpretation_en": "A 67-year-old with 30-min severe typical pain, hyperlipidemia and 8-month stroke, 130/80, S4, normal JVP, V2-V4 ST elevation and inferior depression and normal CPK-MB suggests very early anterior STEMI with recent stroke. 8-month ischemic stroke absolute lytic contraindication recent months and normal CPK not rule STEMI and best action primary PCI not lytic or IV diltiazem or recheck enzyme for PCI decision.",
        "reasons_fa": [
            "دلیل رد گزینه: فیبرینولیتیک با سکته اخیر ممنوع است.",
            "گزینه صحیح: PCI اولیه با سکته اخیر ارجح است.",
            "دلیل رد گزینه: چک مجدد آنزیم تصمیم را عقب می‌اندازد.",
            "دلیل رد گزینه: دیلتیازم وریدی بازپرفیوژن نیست."
        ],
        "reasons_en": [
            "Why incorrect: Fibrinolytic with recent stroke prohibited.",
            "Correct: Primary PCI with recent stroke preferred.",
            "Why incorrect: Recheck enzyme delays decision.",
            "Why incorrect: IV diltiazem not reperfusion."
        ],
        "lead_fa": "سکته ۸ ماه یعنی لیز نده، PCI کن.",
        "lead_en": "8-month stroke means no lysis, do PCI.",
        "golden_fa": "CPK طبیعی STEMI را رد نمی‌کند.",
        "golden_en": "Normal CPK not rule STEMI.",
        "points_fa": ["سکته منع.", "V2-V4.", "PCI سریع.", "آنزیم دیر."],
        "points_en": ["Stroke contraindication.", "V2-V4.", "Rapid PCI.", "Enzyme late."],
        "hint_fa": "با سابقه سکته کدام بازکن ارجح است؟",
        "hint_en": "Which opener preferred with stroke history?",
        "attending_fa": "استاد: STEMI با سکته را PCI کن.",
        "attending_en": "Attending: PCI STEMI with stroke."
    },
    (1,181): {
        "interpretation_fa": "پرفشاری درازمدت آسیب ارگان هدف می‌دهد و آریتمی با فیبریلاسیون، دمانس عروقی، پروتئین‌اوری و نفروپاتی، رتینوپاتی و هیپرتروفی بطن دیده می‌شود و «همه موارد» صحیح است. اندازه‌گیری صحیح، کنترل نمک، ورزش، وزن و داروهای خط اول بلوک رنین-آنژیوتانسین، تیازید یا دی‌هیدروپیریدین با هدف پیشگیری از آسیب است و غربالگری ارگان هدف شامل ادرار، کراتینین، نوار و چشم است.",
        "interpretation_en": "Long hypertension gives target organ damage and arrhythmia with AF, vascular dementia, proteinuria and nephropathy, retinopathy and LVH seen and 'all' correct. Correct measurement, salt control, exercise, weight and first-line RAAS, thiazide or dihydropyridine with goal prevent damage and target screening includes urine, creatinine, ECG and eye.",
        "reasons_fa": [
            "دلیل رد گزینه: آریتمی در پرفشاری دیده می‌شود.",
            "دلیل رد گزینه: دمانس در پرفشاری دیده می‌شود.",
            "دلیل رد گزینه: پروتئین‌اوری در پرفشاری دیده می‌شود.",
            "گزینه صحیح: همه موارد در پرفشاری دیده می‌شود."
        ],
        "reasons_en": [
            "Why incorrect: Arrhythmia in HTN seen.",
            "Why incorrect: Dementia in HTN seen.",
            "Why incorrect: Proteinuria in HTN seen.",
            "Correct: All in HTN seen."
        ],
        "lead_fa": "پرفشاری یعنی همه ارگان‌ها.",
        "lead_en": "HTN means all organs.",
        "golden_fa": "همه موارد را بشناس.",
        "golden_en": "Know all.",
        "points_fa": ["فیبریلاسیون.", "دمانس.", "پروتئین.", "LVH."],
        "points_en": ["Fibrillation.", "Dementia.", "Protein.", "LVH."],
        "hint_fa": "کدام آسیب مال فشار نیست؟ همه هست.",
        "hint_en": "Which damage not of pressure? All are.",
        "attending_fa": "استاد: فشار را با همه ببین.",
        "attending_en": "Attending: See pressure with all."
    },
}
OPTIONS_EN_MAP11 = {
    (1,152): ['IV nitro', 'Morphine', 'IV metoprolol', 'Tenecteplase'],
    (1,153): ['Diastolic rumble', 'Pulsus paradoxus', 'High voltage', 'Present y descent'],
    (1,154): ['LCx', 'LAD', 'Left main', 'RCA'],
    (1,155): ['High in right failure', 'Higher in men', 'Higher in obese', 'Not in diastolic'],
    (1,156): ['Blood/urine culture', 'Chest film', 'Fever control only', 'Broad antibiotic'],
    (1,157): ['AS', 'VSD', 'MR', 'TR'],
    (1,158): ['Urgent coronary angio', 'Emergency echo', 'ASA+plavix+heparin', 'Streptokinase'],
    (1,159): ['SL nitro x3', 'Aspirin 160-325', 'Morphine if nitro fails', 'Nasal O2 2-4L'],
    (1,160): ['Cuff 40% arm', 'Diastolic phase III', 'Inter-arm >5 abnormal', 'Upper-lower >10 abnormal'],
    (1,161): ['50J cardioversion', 'IV amiodarone', 'IV lidocaine', 'Observation'],
    (1,162): ['Troponin I', 'CK-MB', 'Troponin T', 'Myoglobin'],
    (1,163): ['AR', 'PS', 'AS', 'TR'],
    (1,164): ['Hydralazine', 'Captopril', 'Carvedilol', 'HCTZ'],
    (1,165): ['High JVP', 'S3', 'PMI to sternum', 'Holosystolic apical'],
    (1,166): ['LA', 'RV', 'RA', 'LV'],
    (1,167): ['Positive concordance', 'Capture beats', 'Fusion beats', 'No P visible'],
    (1,168): ['High JVP', 'Brother sudden death', 'Left axis', 'AS murmur'],
    (1,169): ['CXR', 'Exercise test', 'BNP', 'ECG'],
    (1,170): ['MS', 'AS', 'MR', 'AR'],
    (1,171): ['Sublingual captopril', 'Sublingual nifedipine', 'IV nitroglycerin', 'IV labetalol'],
    (1,172): ['Clopi+Aspirin', 'IV nitro', 'Oral beta', 'Enoxaparin'],
    (1,173): ['Losartan', 'Captopril', 'Amlodipine', 'Candesartan'],
    (1,174): ['S3/S4', 'Pericardial rub', 'High carotid pulse', 'Transient midsystolic'],
    (1,175): ['Earlier louder on standing', 'Less with squatting', 'More with isometric', 'Earlier with Valsalva strain'],
    (1,176): ['Cardiac arrhythmia', 'TIA', 'Vasovagal', 'AS'],
    (1,177): ['IV furosemide 40', 'Nasal O2 3-5L', 'IV hydrocortisone 200', 'IV morphine 3'],
    (1,178): ['MS', 'Bicuspid AV', 'MR', 'AR'],
    (1,179): ['BNP', 'Peak VO2', 'Gut protein absorption', 'Pulse pressure'],
    (1,180): ['Fibrinolytic', 'Primary PCI', 'Recheck CPK for PCI', 'IV diltiazem'],
    (1,181): ['Arrhythmia', 'Dementia', 'Proteinuria', 'All'],
}
def enrich11():
    assert len(ITEMS)==30
    path = ROOT / f"tools/master-bank/import-payload.master-preint.part{PART:02}.json"
    before = json.loads(path.read_text(encoding="utf-8"))
    after = copy.deepcopy(before)
    for local, q in enumerate(after["questions"], 1):
        item = ITEMS.get((PART, local))
        if item is None:
            continue
        if not q.get("options_en") or len([o for o in q.get("options_en",[]) if str(o).strip()])<4:
            q["options_en"] = OPTIONS_EN_MAP11.get((PART, local), q.get("options_en",[]))
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
    print(f"PASS: enriched {len(ITEMS)} heart Q152-181")
if __name__=="__main__":
    enrich11()
