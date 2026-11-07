#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Batch4: part01 Q46-60"""
import copy, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
PART = 1
ITEMS = {
    (1,46): {
        "interpretation_fa": "شکاف معکوس صدای دوم یعنی بخش آئورتی پس از ریوی بسته می‌شود. در حالت طبیعی دم صدای دوم را دوپارچه می‌کند و بازدم آن را یکی می‌کند. تاخیر بسته شدن آئورت در تنگی شدید آئورت، ایسکمی حاد و هیپرتروفیک انسدادی شکاف را معکوس می‌کند: دم صدا را یکی و بازدم آن را دوتایی می‌کند. بلوک شاخه راست تاخیر بطن راست می‌دهد و شکاف را وسیع ولی طبیعی نگه می‌دارد نه معکوس.",
        "interpretation_en": "Reversed splitting means aortic closure follows pulmonic. Normally inspiration splits S2 and expiration makes it single. Delayed aortic closure in severe aortic stenosis, acute ischemia and obstructive HCM reverses splitting: inspiration single, expiration split. Right bundle block delays RV and widens but does not reverse splitting.",
        "reasons_fa": [
            "دلیل رد گزینه: تنگی شدید آئورت بسته شدن آئورت را به تاخیر و شکاف را معکوس می‌کند.",
            "دلیل رد گزینه: ایسکمی حاد با تاخیر فعال شدن بطن چپ، شکاف معکوس می‌دهد.",
            "دلیل رد گزینه: هیپرتروفیک انسدادی با تاخیر جهشی بطن چپ، شکاف معکوس می‌دهد.",
            "گزینه صحیح: بلوک شاخه راست شکاف را وسیع می‌کند ولی معکوس نمی‌کند."
        ],
        "reasons_en": [
            "Why incorrect: Severe aortic stenosis delays aortic closure and reverses splitting.",
            "Why incorrect: Acute ischemia with delayed LV activation reverses splitting.",
            "Why incorrect: Obstructive HCM with delayed LV ejection reverses splitting.",
            "Correct: Right bundle block widens splitting but does not reverse it."
        ],
        "lead_fa": "شکاف معکوس یعنی آئورت دیرتر از ریه بسته می‌شود؛ با تنفس برعکس طبیعی است.",
        "lead_en": "Reversed split means aorta closes after lungs; opposite to normal with breathing.",
        "golden_fa": "در شکاف معکوس، بازدم دو صدا و دم یک صدا می‌شود.",
        "golden_en": "In reversed split, expiration has two sounds, inspiration one.",
        "points_fa": [
            "شکاف طبیعی در دم ظاهر و در بازدم ناپدید می‌شود.",
            "بلوک راست شکاف وسیع ثابت می‌دهد.",
            "تنگی آئورت، ایسکمی و هیپرتروفیک معکوس می‌کنند.",
            "سمع در لبه چپ جناغ شکاف را بهتر نشان می‌دهد."
        ],
        "points_en": [
            "Normal split appears on inspiration, disappears on expiration.",
            "RBBB gives wide fixed splitting.",
            "AS, ischemia and HCM reverse it.",
            "Left sternal border best hears splitting."
        ],
        "hint_fa": "در تنفس، کدام بطن دیرتر بسته می‌شود؟",
        "hint_en": "With breathing, which ventricle closes later?",
        "attending_fa": "استاد: شکاف را با نفس بسنج؛ معکوس را با آئورت بشناس.",
        "attending_en": "Attending: Judge splitting with breathing; know reversed by aorta."
    },
    (1,47): {
        "interpretation_fa": "نارسایی شدید آئورت با نشت دیاستولیک زیاد، فشار نبض وسیع و نبض‌های محیطی جهنده می‌دهد. نبض کوریگان جهش سریع و سقوط تند در کاروتید است که در نارسایی شدید دیده می‌شود و نشانه حجم ضربه‌ای زیاد و مقاومت کم است. پالس آلترنانس در نارسایی شدید بطن، بای‌جمینه در اکستراسیستول و پارادوکس در تامپوناد است.",
        "interpretation_en": "Severe aortic regurgitation with large diastolic leak gives wide pulse pressure and bounding peripherals. Corrigan pulse is rapid upstroke and quick collapse in carotid seen in severe AR and marks high stroke volume and low resistance. Alternans is in severe LV failure, bigeminy in extrasystoles, paradoxus in tamponade.",
        "reasons_fa": [
            "دلیل رد گزینه: پالس آلترنانس نارسایی شدید بطن چپ است نه آئورت.",
            "دلیل رد گزینه: پالس بای‌جمینه از اکستراسیستول منظم است.",
            "دلیل رد گزینه: پالس پارادوکس تامپوناد است.",
            "گزینه صحیح: نبض کوریگان جهش تند و سقوط سریع در نارسایی شدید آئورت است."
        ],
        "reasons_en": [
            "Why incorrect: Pulsus alternans is severe LV failure, not AR.",
            "Why incorrect: Bigeminal pulse is regular extrasystoles.",
            "Why incorrect: Paradoxus is tamponade.",
            "Correct: Corrigan pulse is brisk upstroke and rapid collapse in severe AR."
        ],
        "lead_fa": "نبض کوریگان یعنی جهش سریع و سقوط تند کاروتید در نشت شدید آئورت.",
        "lead_en": "Corrigan means rapid carotid upstroke and quick collapse in severe AR.",
        "golden_fa": "فشار نبض وسیع + کوریگان را در نشت شدید بجوی.",
        "golden_en": "Seek wide pulse pressure + Corrigan in severe leak.",
        "points_fa": [
            "آستین فشار دیاستولیک پایین را نشان می‌دهد.",
            "نبض جهنده در پرکاری تیروئید هم دیده می‌شود.",
            "اکو شدت نشت و ابعاد بطن را می‌سنجد.",
            "در علامت‌دار شدید جراحی مطرح است."
        ],
        "points_en": [
            "Cuff shows low diastolic.",
            "Bounding pulse also in thyrotoxicosis.",
            "Echo grades leak and LV size.",
            "Severe symptomatic needs surgery."
        ],
        "hint_fa": "کدام نبض مثل آبشار بالا می‌رود و می‌ریزد؟",
        "hint_en": "Which pulse rises and falls like a waterfall?",
        "attending_fa": "استاد: کاروتید را ببین؛ جهش و سقوط، نشت را می‌گوید.",
        "attending_en": "Attending: Watch carotid; surge and fall tells leak."
    },
    (1,48): {
        "interpretation_fa": "جوان ۳۰ ساله بدون علامت با سوفل سیستولیک دو از شش میدسیستولی، نوار و عکس طبیعی، سوفل بی‌گناه دارد. سوفل بی‌گناه در جوان سالم کوتاه، نرم، بدون انتشار گسترده و بدون علامت همراه است و نوار و عکس طبیعی آن را تایید می‌کند. در فقدان نشانه ساختاری، اکو روتین لازم نیست و اطمینان‌بخشی و پیگیری کافی است.",
        "interpretation_en": "An asymptomatic 30-year-old with grade 2/6 midsystolic murmur and normal ECG and chest film has innocent murmur. Innocent murmur in healthy young is short, soft, without wide radiation or associated signs and normal ECG/film support it. Without structural clues, routine echo is not needed; reassurance and follow-up suffice.",
        "reasons_fa": [
            "گزینه صحیح: سوفل کوتاه بی‌گناه با نوار و عکس طبیعی نیاز به بررسی بیشتر ندارد و فرد طبیعی تلقی می‌شود.",
            "دلیل رد گزینه: اکو در بی‌گناه بدون علامت اندیکاسیون ندارد.",
            "دلیل رد گزینه: هولتر برای سوفل بی‌گناه بی‌مورد است.",
            "دلیل رد گزینه: تکرار نوار در شش ماه بدون اندیکاسیون لازم نیست."
        ],
        "reasons_en": [
            "Correct: Short innocent murmur with normal ECG/film needs no further workup and is considered normal.",
            "Why incorrect: Echo not indicated for asymptomatic innocent murmur.",
            "Why incorrect: Holter is unwarranted for innocent murmur.",
            "Why incorrect: Repeat ECG in six months without indication is unnecessary."
        ],
        "lead_fa": "سوفل کوتاه نرم بدون انتشار با نوار و عکس طبیعی یعنی بی‌گناه.",
        "lead_en": "Short soft murmur without radiation with normal ECG/film means innocent.",
        "golden_fa": "در جوان بی‌علامت با معاینه طبیعی، اکو روتین نده.",
        "golden_en": "In asymptomatic young with normal exam, no routine echo.",
        "points_fa": [
            "سوفل بی‌گناه با تغییر وضعیت کم و زیاد می‌شود.",
            "تب، کم‌خونی و پرکاری سوفل را بلندتر می‌کند.",
            "در صورت شک به دریچه، اکو انتخابی است.",
            "آموزش بیمار اضطراب را کم می‌کند."
        ],
        "points_en": [
            "Innocent murmur varies with position.",
            "Fever, anemia, hyperthyroidism amplify murmur.",
            "If valve suspected, selective echo.",
            "Patient education reduces anxiety."
        ],
        "hint_fa": "سوفل نرم بی‌علامت با نوار پاک را چقدر پیگیری می‌کنی؟",
        "hint_en": "How far do you work up a soft asymptomatic murmur with clean ECG?",
        "attending_fa": "استاد: بی‌گناه را بشناس و بیهوده اکو نده.",
        "attending_en": "Attending: Recognize innocent and don't over-echo."
    },
    (1,49): {
        "interpretation_fa": "مرد ۴۲ ساله با پرفشاری تازه و سابقه خانوادگی، در مرحله اول به ارزیابی عوامل خطر و آسیب اندام نیاز دارد. اندازه‌گیری قند ناشتا، تری‌گلیسرید و کلسترول، ریسک قلبی عروقی را می‌سنجد و تصمیم به شروع دارو، استاتین و تغییر سبک زندگی را هدایت می‌کند. معاینه فشار در هر دو دست، بررسی نبض‌ها، سابقه دارویی، مصرف نمک و الکل و بررسی خواب هم کمک می‌کند. داپلر کلیه، عکس قفسه سینه و کاتکولامین ادراری در فقدان سرنخ ثانویه، قدم اول نیستند.",
        "interpretation_en": "A 42-year-old with newly found hypertension and family history first needs risk and organ damage assessment. Fasting glucose, triglycerides and cholesterol gauge cardiovascular risk and guide drug, statin and lifestyle decisions. Checking pressure in both arms, pulses, drug history, salt and alcohol intake and sleep history also helps. Renal Doppler, chest film and urinary catecholamines without secondary clues are not first step.",
        "reasons_fa": [
            "گزینه صحیح: بررسی قند و چربی در ارزیابی اولیه پرفشاری لازم است.",
            "دلیل رد گزینه: داپلر کلیه بدون سرنخ انسداد شریان کلیه قدم اول نیست.",
            "دلیل رد گزینه: عکس قفسه سینه در پرفشاری بی‌علامت قدم اول نیست.",
            "دلیل رد گزینه: کاتکولامین ادراری بدون شک فئوکروموسیتوم لازم نیست."
        ],
        "reasons_en": [
            "Correct: Glucose and lipid panel is needed in initial hypertension workup.",
            "Why incorrect: Renal Doppler without clue to renal artery stenosis is not first.",
            "Why incorrect: Chest film in asymptomatic hypertension is not first.",
            "Why incorrect: Urinary catecholamines without pheo suspicion not needed."
        ],
        "lead_fa": "در پرفشاری تازه، اول ریسک متابولیک را بسنج.",
        "lead_en": "In new hypertension, first gauge metabolic risk.",
        "golden_fa": "قند و چربی را زود بگیر تا استاتین و سبک زندگی را بسنجی.",
        "golden_en": "Get glucose and lipids early to judge statin and lifestyle.",
        "points_fa": [
            "فشار را در چند نوبت تایید کن.",
            "سدیم، پتاسیم و کراتینین پایه را بگیر.",
            "آلبومین ادرار آسیب کلیه را زود نشان می‌دهد.",
            "نوار قلب هیپرتروفی را غربال می‌کند."
        ],
        "points_en": [
            "Confirm pressure on several visits.",
            "Get baseline sodium, potassium, creatinine.",
            "Urine albumin early shows kidney injury.",
            "ECG screens for hypertrophy."
        ],
        "hint_fa": "اولین آزمایش پرفشاری جوان چیست؟",
        "hint_en": "What's the first lab in young hypertension?",
        "attending_fa": "استاد: پرفشاری را با چربی و قند کامل کن.",
        "attending_en": "Attending: Complete hypertension with lipids and glucose."
    },
    (1,50): {
        "interpretation_fa": "زن ۶۰ ساله دیابتی با داروهای متوپرولول، کاپتوپریل، آتورواستاتین، گلی‌بن‌کلامید و متفورمین که تازه دچار سرفه خشک شده، عارضه مهارکننده آنزیم مبدل را نشان می‌دهد. سرفه خشک و آنژیوادم از عوارض برادی‌کینین با این گروه است و با قطع دارو بهبود می‌یابد. جایگزینی با مسدودکننده گیرنده آنژیوتانسین سرفه را حل می‌کند.",
        "interpretation_en": "A 60-year-old diabetic on metoprolol, captopril, atorvastatin, glyburide and metformin with new dry cough shows ACE inhibitor side effect. Dry cough and angioedema from bradykinin with this class improve on stopping. Switching to ARB resolves cough.",
        "reasons_fa": [
            "دلیل رد گزینه: گلی‌بن‌کلامید سرفه نمی‌دهد.",
            "دلیل رد گزینه: متوپرولول سرفه خشک تیپیک نمی‌دهد.",
            "دلیل رد گزینه: متفورمین سرفه نمی‌دهد.",
            "گزینه صحیح: کاپتوپریل مهارکننده آنزیم مبدل سرفه خشک می‌دهد و باید جایگزین شود."
        ],
        "reasons_en": [
            "Why incorrect: Glyburide does not cause cough.",
            "Why incorrect: Metoprolol does not typically cause dry cough.",
            "Why incorrect: Metformin does not cause cough.",
            "Correct: Captopril ACE inhibitor causes dry cough and should be switched."
        ],
        "lead_fa": "سرفه خشک جدید با مهارکننده آنزیم مبدل یعنی عارضه برادی‌کینین.",
        "lead_en": "New dry cough with ACE inhibitor means bradykinin side effect.",
        "golden_fa": "سرفه مهارکننده را با مسدود گیرنده جایگزین کن.",
        "golden_en": "Replace ACE inhibitor cough with ARB.",
        "points_fa": [
            "آنژیوادم خطرناک‌تر از سرفه است.",
            "سرفه هفته‌ها پس از قطع باقی می‌ماند.",
            "آتورواستاتین سرفه نمی‌دهد.",
            "فشار را پس از تعویض پایش کن."
        ],
        "points_en": [
            "Angioedema is more dangerous than cough.",
            "Cough may linger weeks after stopping.",
            "Atorvastatin does not cause cough.",
            "Monitor pressure after switch."
        ],
        "hint_fa": "کدام فشاردهنده سرفه خشک می‌آورد؟",
        "hint_en": "Which antihypertensive brings dry cough?",
        "attending_fa": "استاد: سرفه مهارکننده را بشناس و سریع عوض کن.",
        "attending_en": "Attending: Recognize ACE cough and switch quickly."
    },
    (1,51): {
        "interpretation_fa": "مرد ۵۵ ساله با انفارکتوس قدامی، فشار ۱۴۵ روی ۷۰ و کسر جهشی ۳۵ درصد، نارسایی با کسر کم پس از انفارکتوس دارد. در این شرایط مسدودکننده کانال کلسیم غیر دی‌هیدروپیریدینی مانند دیلتیازم به علت تضعیف انقباض، کندی هدایت و افت فشار مناسب نیست و پیش‌آگهی را بدتر می‌کند. ضدپلاکتی دوگانه، مهارکننده آنزیم مبدل و استاتین پرقدرت اولویت دارند و نیترو با احتیاط در ریه پاک استفاده می‌شود.",
        "interpretation_en": "A 55-year-old with anterior MI, BP 145/70 and EF 35% has reduced EF post-MI. Non-DHP calcium blocker like diltiazem is unsuitable due to negative inotropy, conduction slowing and pressure drop and worsens prognosis. Dual antiplatelet, ACE inhibitor and high-intensity statin are priorities and nitro is cautious with clear lungs.",
        "reasons_fa": [
            "گزینه صحیح: دیلتیازم در انفارکتوس قدامی با کسر کم اولویت ندارد و مضر است.",
            "دلیل رد گزینه: آسپیرین رکن ضدپلاکتی است.",
            "دلیل رد گزینه: کلوپیدوگرل همراه آسپیرین لازم است.",
            "دلیل رد گزینه: آتورواستاتین پرقدرت پیش‌آگهی را بهتر می‌کند."
        ],
        "reasons_en": [
            "Correct: Diltiazem in anterior MI with low EF is not priority and is harmful.",
            "Why incorrect: Aspirin is antiplatelet cornerstone.",
            "Why incorrect: Clopidogrel with aspirin is needed.",
            "Why incorrect: High-intensity atorvastatin improves prognosis."
        ],
        "lead_fa": "در قدامی با کسر کم، دیلتیازم نده؛ ضدپلاکتی و استاتین بده.",
        "lead_en": "In anterior with low EF, no diltiazem; give antiplatelet and statin.",
        "golden_fa": "مسدود کلسیم غیر دی‌هیدرو در نارسایی کم‌کسر ممنوع است.",
        "golden_en": "Non-DHP calcium blocker contraindicated in reduced EF.",
        "points_fa": [
            "مسدود بتا پس از پایداری در قدامی مفید است.",
            "مهارکننده آنزیم مبدل در کسر کم لازم است.",
            "نیترو در ریه پاک با احتیاط است.",
            "بازتوانی قلبی را زود شروع کن."
        ],
        "points_en": [
            "Beta-blocker after stability helps in anterior.",
            "ACE inhibitor needed in low EF.",
            "Nitro with clear lungs is cautious.",
            "Start cardiac rehab early."
        ],
        "hint_fa": "کدام دارو قلب کم‌توان را بیشتر ضعیف می‌کند؟",
        "hint_en": "Which drug further weakens a weak heart?",
        "attending_fa": "استاد: قدامی کم‌کسر را با دیلتیازم نسوزان.",
        "attending_en": "Attending: Don't burn low-EF anterior with diltiazem."
    },
    (1,52): {
        "interpretation_fa": "مرد ۸۰ ساله با نارسایی یک ساله تحت درمان، با تهوع، استفراغ، ضعف و بی‌حالی و ریتم مشکوک در مانیتور، مسمومیت دیگوکسین را مطرح می‌کند. دیگوکسین پنجره درمانی باریک دارد و در سالمندی با کم‌آبی، افت کلیه، اختلال الکترولیت و تداخل دارویی سطح آن بالا می‌رود. علائم گوارشی مانند بی‌اشتهایی و تهوع، علائم عصبی مانند تاری دید و ضعف، و انواع آریتمی از هشدارهای کلاسیک هستند. قدم اول بررسی سطح دارو، نوار قلب، الکترولیت و عملکرد کلیه است.",
        "interpretation_en": "An 80-year-old with one-year failure on therapy with nausea, vomiting, weakness, malaise and suspicious rhythm on monitor suggests digoxin toxicity. Digoxin has narrow therapeutic window and rises in elderly with dehydration, renal decline, electrolyte shifts and drug interactions. GI symptoms like anorexia and nausea, neuro symptoms like blurred vision and weakness, and various arrhythmias are classic warnings. First step is drug level, ECG, electrolytes and kidney function.",
        "reasons_fa": [
            "دلیل رد گزینه: فوروزماید بدون بررسی دیگوکسین اولویت اول نیست.",
            "دلیل رد گزینه: آمیودارون بدون تشخیص مسمومیت اولویت ندارد.",
            "گزینه صحیح: بررسی سطح دیگوکسین قدم اول است.",
            "دلیل رد گزینه: آنژیوگرافی اورژانس در این تابلوی مسمومیت اولویت ندارد."
        ],
        "reasons_en": [
            "Why incorrect: Furosemide without checking digoxin is not first.",
            "Why incorrect: Amiodarone without toxicity diagnosis not priority.",
            "Correct: Checking digoxin level is first step.",
            "Why incorrect: Urgent angiography not priority in this toxicity picture."
        ],
        "lead_fa": "تهوع و ضعف در سالمند دیگوکسینی یعنی مسمومیت تا خلافش ثابت شود.",
        "lead_en": "Nausea and weakness in elderly on digoxin means toxicity until proven otherwise.",
        "golden_fa": "سطح دارو، پتاسیم و کلیه را فوری چک کن.",
        "golden_en": "Check drug level, potassium and kidney immediately.",
        "points_fa": [
            "هیپوکالمی سمیت را بیشتر می‌کند.",
            "برادی و بلوک دهلیزی بطنی شایع است.",
            "پادزهر اختصاصی در مسمومیت شدید موجود است.",
            "دوز را با سن و کلیه تنظیم کن."
        ],
        "points_en": [
            "Hypokalemia worsens toxicity.",
            "Brady and AV block are common.",
            "Specific antidote exists for severe toxicity.",
            "Dose by age and kidney."
        ],
        "hint_fa": "تهوع سالمند نارسا با کدام داروی قدیمی گره خورده؟",
        "hint_en": "Which old drug ties to nausea in elderly failure?",
        "attending_fa": "استاد: دیگوکسین را با کلیه و پتاسیم بسنج.",
        "attending_en": "Attending: Judge digoxin with kidney and potassium."
    },
    (1,53): {
        "interpretation_fa": "مرد ۶۵ ساله با درد بسیار شدید یک ساعته قفسه سینه، اختلاف فشار دو دست و سوفل دیاستولی ابتدای آئورت، دیسکسیون آئورت صعودی را مطرح می‌کند. دیسکسیون با پارگی انتیما و پیشروی خون در دیواره، درد پاره‌کننده، اختلاف نبض و نارسایی حاد آئورت می‌دهد. کوآرکتاسیون مادرزادی و تاکایاسو اختلاف فشار مزمن می‌دهند نه حاد یک ساعته.",
        "interpretation_en": "A 65-year-old with one-hour very severe chest pain, inter-arm pressure difference and early diastolic murmur at aortic area suggests ascending aortic dissection. Dissection from intimal tear with blood tracking in wall gives tearing pain, pulse discrepancy and acute AR. Coarctation and Takayasu give chronic pressure difference, not acute one-hour.",
        "reasons_fa": [
            "گزینه صحیح: دیسکسیون آئورت با اختلاف فشار و سوفل نارسایی حاد آئورت مطرح است.",
            "دلیل رد گزینه: کوآرکتاسیون مادرزادی درد حاد یک ساعته نمی‌دهد.",
            "دلیل رد گزینه: تاکایاسو سیر مزمن دارد.",
            "دلیل رد گزینه: پریکاردیت حاد اختلاف فشار دو دست نمی‌دهد."
        ],
        "reasons_en": [
            "Correct: Aortic dissection with pressure difference and acute AR murmur is suggested.",
            "Why incorrect: Congenital coarctation does not give acute one-hour pain.",
            "Why incorrect: Takayasu has chronic course.",
            "Why incorrect: Acute pericarditis does not give inter-arm pressure difference."
        ],
        "lead_fa": "درد شدید حاد + اختلاف فشار دو دست + سوفل دیاستولی یعنی دیسکسیون.",
        "lead_en": "Acute severe pain + inter-arm pressure gap + diastolic murmur means dissection.",
        "golden_fa": "فشار و ضربان را با بتا سریع کنترل و سی‌تی فوری بگیر.",
        "golden_en": "Quickly control pressure and rate with beta and get urgent CT.",
        "points_fa": [
            "نوع صعودی جراحی فوری می‌خواهد.",
            "مدیاستن پهن سرنخ عکس است.",
            "تامپوناد و ایسکمی عوارض کشنده‌اند.",
            "سابقه فشار بالا را بپرس."
        ],
        "points_en": [
            "Ascending type needs urgent surgery.",
            "Widened mediastinum is X-ray clue.",
            "Tamponade and ischemia are lethal complications.",
            "Ask history of hypertension."
        ],
        "hint_fa": "اختلاف فشار دو دست با کدام پارگی دیواره می‌خواند؟",
        "hint_en": "Which wall tear fits inter-arm pressure gap?",
        "attending_fa": "استاد: درد پاره‌کننده را آئورتی ببین.",
        "attending_en": "Attending: View tearing pain as aortic."
    },
    (1,54): {
        "interpretation_fa": "کنترااندیکاسیون مطلق فیبرینولیتیک در انفارکتوس با بالا رفتن اس‌تی شامل خونریزی فعال، خونریزی مغزی قبلی، ایسکمی مغزی اخیر، آسیب عروقی و فشار بسیار بالا مقاوم است. فشار ۲۰۰ روی ۱۱۰ در حال حاضر از موارد مطلق در نظر گرفته شده و تزریق را ممنوع می‌کند. سابقه مصرف آسپیرین منع نیست و جراحی شکم دو سال قبل و سکته ده سال قبل مطلق نیستند.",
        "interpretation_en": "Absolute contraindications to fibrinolytic in ST elevation infarction include active bleeding, prior intracranial bleed, recent ischemic stroke, vascular injury and very high resistant pressure. Current 200/110 is considered absolute and forbids lysis. Recent aspirin is not a contraindication and abdominal surgery two years ago and stroke ten years ago are not absolute.",
        "reasons_fa": [
            "دلیل رد گزینه: مصرف اخیر آسپیرین منع فیبرینولیتیک نیست.",
            "دلیل رد گزینه: جراحی شکم دو سال قبل منع مطلق نیست.",
            "دلیل رد گزینه: سکته ده سال قبل منع مطلق فعلی نیست.",
            "گزینه صحیح: فشار ۲۰۰ روی ۱۱۰ در حال حاضر کنترااندیکاسیون مطلق است."
        ],
        "reasons_en": [
            "Why incorrect: Recent aspirin is not fibrinolytic contraindication.",
            "Why incorrect: Abdominal surgery two years ago is not absolute.",
            "Why incorrect: Stroke ten years ago is not current absolute.",
            "Correct: Current 200/110 is absolute contraindication."
        ],
        "lead_fa": "فشار بسیار بالا در زمان تزریق، فیبرینولیتیک را ممنوع می‌کند.",
        "lead_en": "Very high pressure at time of injection forbids fibrinolytic.",
        "golden_fa": "فشار را قبل از لیز به زیر آستانه بیاور یا سراغ مداخله پوستی برو.",
        "golden_en": "Lower pressure below threshold before lysis or go to PCI.",
        "points_fa": [
            "خونریزی مغزی قبلی مطلق است.",
            "ترومای بزرگ اخیر مطلق است.",
            "کواگولوپاتی فعال مطلق است.",
            "در مطلق، مداخله پوستی ارجح است."
        ],
        "points_en": [
            "Prior intracranial bleed is absolute.",
            "Recent major trauma is absolute.",
            "Active coagulopathy is absolute.",
            "In absolute, PCI is preferred."
        ],
        "hint_fa": "کدام فشار همین حالا لیز را ممنوع می‌کند؟",
        "hint_en": "Which pressure right now forbids lysis?",
        "attending_fa": "استاد: فشار ۲۰۰ را اول بگیر سپس لیز را بسنج.",
        "attending_en": "Attending: Control 200 first then weigh lysis."
    },
    (1,55): {
        "interpretation_fa": "زن ۶۴ ساله با درد سه روزه، افت اس‌تی در وی چهار تا شش، علائم حیاتی پایدار و سابقه بای‌پس پنج سال قبل، سندرم کرونری بدون بالا رفتن اس‌تی پرخطر است. در بیمار با سابقه بای‌پس و تغییرات مداوم، مهار دوگانه پلاکتی و آنتی‌کوآگولانت و آنژیوگرافی زودرس با مهار گیرنده پلاکتی تزریقی در پرخطر توصیه می‌شود. ترخیص یا ورزش در این مرحله ناامن است.",
        "interpretation_en": "A 64-year-old woman with three-day pain, ST depression V4-6, stable vitals and prior bypass five years ago has high-risk non-ST elevation syndrome. In post-bypass with persistent changes, dual antiplatelet and anticoagulant plus early angiography with IV platelet receptor inhibitor in high risk is recommended. Discharge or exercise at this stage is unsafe.",
        "reasons_fa": [
            "دلیل رد گزینه: ترخیص با اس‌تی افتاده و سابقه بای‌پس ناامن است.",
            "دلیل رد گزینه: ورزش در سندرم پرخطر با اس‌تی افتاده اندیکاسیون ندارد.",
            "گزینه صحیح: مهار گیرنده پلاکتی تزریقی و آنژیوگرافی زودرس در پرخطر توصیه می‌شود.",
            "دلیل رد گزینه: تاخیر تا ترخیص برای آنژیو در پرخطر مناسب نیست."
        ],
        "reasons_en": [
            "Why incorrect: Discharge with ST depression and bypass history is unsafe.",
            "Why incorrect: Exercise in high-risk ST depression not indicated.",
            "Correct: IV platelet receptor inhibitor and early angiography in high risk recommended.",
            "Why incorrect: Delay till discharge for angio in high risk not suitable."
        ],
        "lead_fa": "سابقه بای‌پس + افت اس‌تی یعنی پرخطر؛ زود آنژیو کن.",
        "lead_en": "Bypass history + ST depression means high risk; angio early.",
        "golden_fa": "در پرخطر، دوگانه پلاکتی و آنتی‌کوآگولانت را زود بده.",
        "golden_en": "In high risk, give dual antiplatelet and anticoagulant early.",
        "points_fa": [
            "درد سه روزه هنوز سندرم فعال است.",
            "تروپونین را سریال بگیر.",
            "بتابلوکر پس از پایداری مفید است.",
            "استاتین پرقدرت را فراموش نکن."
        ],
        "points_en": [
            "Three-day pain still active syndrome.",
            "Get serial troponin.",
            "Beta-blocker after stability helps.",
            "Don't forget high-intensity statin."
        ],
        "hint_fa": "در پرخطر با بای‌پس، کدام راه زودتر است؟",
        "hint_en": "In high risk with bypass, which path is earlier?",
        "attending_fa": "استاد: بای‌پس قدیمی را پرخطر ببین.",
        "attending_en": "Attending: View old bypass as high risk."
    },
    (1,56): {
        "interpretation_fa": "مرد ۵۰ ساله با درد رترواسترنال فعالیتی شش ماهه، بدون دیابت و فشار، افت یک میلی‌ولتی اس‌تی در لیدهای سینه‌ای و کسر جهشی ۳۵ درصد، بیماری عروق کرونر پایدار با اختلال سیستولیک دارد. در بیمار با درد طولانی، تغییرات پایدار اس‌تی و کسر کم، آنژیوگرافی کرونر برای تعیین آناتومی و تصمیم بازسازی عروق مناسب‌ترین قدم بعدی است. تست ورزش در کسر کم و تغییرات پایه پرخطر است و درمان سرپایی بدون آناتومی کافی نیست.",
        "interpretation_en": "A 50-year-old with six-month exertional retrosternal pain, no diabetes or hypertension, 1 mV ST depression in chest leads and EF 35% has stable coronary disease with systolic dysfunction. With prolonged pain, persistent ST changes and low EF, coronary angiography to define anatomy and decide revascularization is the most suitable next step. Exercise testing with low EF and baseline changes is risky and outpatient drugs without anatomy are insufficient.",
        "reasons_fa": [
            "گزینه صحیح: آنژیوگرافی عروق کرونر آناتومی را معلوم و تصمیم بازسازی را ممکن می‌کند.",
            "دلیل رد گزینه: تست ورزش در کسر کم و اس‌تی پایه پرخطر و گمراه‌کننده است.",
            "دلیل رد گزینه: درمان سرپایی بدون آناتومی در کسر کم کافی نیست.",
            "دلیل رد گزینه: بستری و دارو بدون آنژیو تشخیص را کامل نمی‌کند."
        ],
        "reasons_en": [
            "Correct: Coronary angiography defines anatomy and enables revascularization decision.",
            "Why incorrect: Exercise test with low EF and baseline ST is risky and misleading.",
            "Why incorrect: Outpatient drugs without anatomy insufficient in low EF.",
            "Why incorrect: Admission and drugs without angio do not complete diagnosis."
        ],
        "lead_fa": "درد طولانی + اس‌تی افتاده پایدار + کسر کم یعنی آنژیو.",
        "lead_en": "Prolonged pain + persistent ST depression + low EF means angio.",
        "golden_fa": "کسر کم را با آناتومی قضاوت کن نه با ورزش.",
        "golden_en": "Judge low EF with anatomy not exercise.",
        "points_fa": [
            "آنژین پایدار با کسر کم پیش‌آگهی بدتری دارد.",
            "بتابلوکر و مهار رنین در کسر کم لازم است.",
            "بازسازی در بیماری چندرگی سود دارد.",
            "ریسک‌فاکتورها را همزمان کنترل کن."
        ],
        "points_en": [
            "Stable angina with low EF has worse prognosis.",
            "Beta-blocker and RAS blockade needed in low EF.",
            "Revascularization benefits multivessel disease.",
            "Control risk factors together."
        ],
        "hint_fa": "وقتی کسر کم است، کدام آزمون آناتومی می‌دهد؟",
        "hint_en": "When EF is low, which test gives anatomy?",
        "attending_fa": "استاد: کسر کم را به کت‌لب ببر.",
        "attending_en": "Attending: Take low EF to cath lab."
    },
    (1,57): {
        "interpretation_fa": "نارسایی راست اغلب ثانویه به بیماری سمت چپ است. افزایش فشار دهلیز چپ به مویرگ ریه و سپس شریان ریوی منتقل می‌شود، پس‌بار بطن راست را بالا می‌برد و به هیپرتروفی، اتساع و در نهایت نارسایی راست با ورید برجسته، ادم و هپاتومگالی می‌انجامد. بیماری پارانشیم ریه، فشار اولیه ریوی و آمبولی مزمن علل دیگر هستند، ولی در جمعیت عمومی شایع‌ترین علت، نارسایی مزمن بطن چپ با کسر کم یا حفظ‌شده است که فشار ریوی را به صورت غیرمستقیم بالا می‌برد.",
        "interpretation_en": "Right failure is often secondary to left disease. Raised left atrial pressure transmits to pulmonary capillary then artery, raises RV afterload and leads to hypertrophy, dilation and eventual RV failure with jugular distension, edema and hepatomegaly. Parenchymal lung disease, primary pulmonary hypertension and chronic embolism are other causes, but in general population the most common is chronic left ventricular failure with reduced or preserved EF that indirectly raises pulmonary pressure.",
        "reasons_fa": [
            "دلیل رد گزینه: بیماری پارانشیم علت شایع راست نیست.",
            "دلیل رد گزینه: فشار اولیه ریوی نادر است.",
            "دلیل رد گزینه: آمبولی مزمن علت شایع اول نیست.",
            "گزینه صحیح: نارسایی چپ شایع‌ترین علت نارسایی راست است."
        ],
        "reasons_en": [
            "Why incorrect: Parenchymal disease is not the most common RV cause.",
            "Why incorrect: Primary pulmonary hypertension is rare.",
            "Why incorrect: Chronic embolism is not the top cause.",
            "Correct: Left failure is the most common cause of right failure."
        ],
        "lead_fa": "اول چپ نارسا می‌شود سپس راست از پس‌بار بالا نارسا می‌شود.",
        "lead_en": "Left fails first then RV fails from high afterload.",
        "golden_fa": "نارسایی راست را با درمان چپ آرام کن.",
        "golden_en": "Calm RV failure by treating left.",
        "points_fa": [
            "فشار ریوی را با اکو تخمین بزن.",
            "ادم و ورید برجسته نشانه راست است.",
            "اکسیژن فشار ریوی را کم می‌کند.",
            "نمک و مایع را مدیریت کن."
        ],
        "points_en": [
            "Estimate pulmonary pressure by echo.",
            "Edema and high jugular mark RV.",
            "Oxygen lowers pulmonary pressure.",
            "Manage salt and fluid."
        ],
        "hint_fa": "کدام بطن اول می‌ماند و دومی را خسته می‌کند؟",
        "hint_en": "Which ventricle stalls first and tires the second?",
        "attending_fa": "استاد: راست را از چپ بخوان.",
        "attending_en": "Attending: Read right from left."
    },
    (1,58): {
        "interpretation_fa": "مرد ۶۰ ساله با ادم پا و تنگی‌نفس و منحنی ورید ژوگولر، پریکاردیت فشارنده را مطرح می‌کند. در فشارنده، پریکارد سفت و ضخیم پر شدن بطن‌ها را در دیاستول محدود می‌کند و منحنی وریدی با نزول وای برجسته و الگوی دیپ و پلاتو در فشار بطن را نشان می‌دهد. انسداد مزمن ریه بیشتر با هیپوکسی و فشار ریوی مزمن همراه است و نارسایی سه‌لتی موج سی‌وی بزرگ می‌دهد؛ افتراق فشارنده از محدودکننده با مانور تنفسی و اکو انجام می‌شود.",
        "interpretation_en": "A 60-year-old with leg edema and dyspnea and jugular waveform suggests constrictive pericarditis. In constriction, thick stiff pericardium limits ventricular filling in diastole and venous tracing shows prominent y descent with dip and plateau in ventricular pressure. COPD is more with hypoxia and chronic pulmonary hypertension and TR gives large CV wave; constrictive vs restrictive is differentiated by respiratory maneuver and echo.",
        "reasons_fa": [
            "دلیل رد گزینه: انسداد مزمن ریه منحنی فشارنده نمی‌دهد.",
            "دلیل رد گزینه: نارسایی سه‌لتی موج سی‌وی بزرگ می‌دهد نه فشارنده.",
            "گزینه صحیح: پریکاردیت فشارنده با پریکارد سفت و نزول وای برجسته مطرح است.",
            "دلیل رد گزینه: کاردیومیوپاتی محدودکننده شبیه فشارنده ولی کلید فشارنده است."
        ],
        "reasons_en": [
            "Why incorrect: COPD does not give constrictive tracing.",
            "Why incorrect: TR gives large CV wave not constriction.",
            "Correct: Constrictive pericarditis with stiff pericardium and prominent y descent is suggested.",
            "Why incorrect: Restrictive is similar but key is constrictive."
        ],
        "lead_fa": "منحنی وریدی با وای برجسته و قلب سفت یعنی فشارنده.",
        "lead_en": "Venous tracing with prominent y and stiff heart means constriction.",
        "golden_fa": "فشارنده و محدودکننده را با تنفس و اکو افتراق بده.",
        "golden_en": "Differentiate constrictive vs restrictive with breathing and echo.",
        "points_fa": [
            "اکو تغییرات تنفسی جریان را نشان می‌دهد.",
            "سی‌تی کلسیفیکاسیون پریکارد را می‌بیند.",
            "ادم و آسیت در فشارنده شایع است.",
            "درمان نهایی برداشتن پریکارد است."
        ],
        "points_en": [
            "Echo shows respiratory flow variation.",
            "CT sees pericardial calcification.",
            "Edema and ascites common in constriction.",
            "Definitive therapy is pericardiectomy."
        ],
        "hint_fa": "کدام پریکارد سفت، وای را عمیق می‌کند؟",
        "hint_en": "Which stiff pericardium deepens y?",
        "attending_fa": "استاد: منحنی ورید را بخوان؛ وای عمیق فشارنده است.",
        "attending_en": "Attending: Read venous curve; deep y is constriction."
    },
    (1,59): {
        "interpretation_fa": "کنترااندیکاسیون مطلق فیبرینولیتیک شامل شک به دیسکسیون آئورت، خونریزی مغزی قبلی، خونریزی فعال و تومور مغزی است. دیسکسیون با تزریق لیزکننده پاره و گسترش می‌یابد و کشنده است و هر درد پاره‌کننده با اختلاف نبض باید قبل از لیز رد شود. احیای طولانی بیش از ده دقیقه، فشار قابل کنترل و مصرف آنتی‌کوآگولانت یا سکته ایسکمیک دو سال قبل منع نسبی هستند نه مطلق.",
        "interpretation_en": "Absolute contraindications to fibrinolytic include suspected aortic dissection, prior intracranial bleed, active bleeding and brain tumor. Dissection tears and extends with lytic injection and is fatal, so any tearing pain with pulse discrepancy must be ruled out before lysis. Prolonged CPR >10 minutes, controllable pressure and anticoagulant use or ischemic stroke two years ago are relative not absolute contraindications.",
        "reasons_fa": [
            "دلیل رد گزینه: احیای بیش از ده دقیقه منع نسبی است نه مطلق.",
            "گزینه صحیح: شک به دیسکسیون آئورت منع مطلق است.",
            "دلیل رد گزینه: مصرف آنتی‌کوآگولانت منع مطلق نیست.",
            "دلیل رد گزینه: سکته ایسکمیک دو سال قبل منع مطلق فعلی نیست."
        ],
        "reasons_en": [
            "Why incorrect: CPR >10 minutes is relative not absolute.",
            "Correct: Suspected aortic dissection is absolute.",
            "Why incorrect: Anticoagulant use is not absolute.",
            "Why incorrect: Ischemic stroke two years ago is not current absolute."
        ],
        "lead_fa": "شک به دیسکسیون یعنی هرگز لیز نده.",
        "lead_en": "Suspected dissection means never lysis.",
        "golden_fa": "درد پاره‌کننده و اختلاف نبض را قبل از لیز رد کن.",
        "golden_en": "Rule out tearing pain and pulse gap before lysis.",
        "points_fa": [
            "خونریزی مغزی قبلی مطلق است.",
            "تومور مغزی مطلق است.",
            "جراحی بزرگ اخیر مطلق است.",
            "در مطلق، آنژیو ارجح است."
        ],
        "points_en": [
            "Prior intracranial bleed is absolute.",
            "Brain tumor is absolute.",
            "Recent major surgery is absolute.",
            "In absolute, PCI preferred."
        ],
        "hint_fa": "کدام شک، لیز را به خونریزی مرگبار تبدیل می‌کند؟",
        "hint_en": "Which suspicion turns lysis into fatal bleed?",
        "attending_fa": "استاد: دیسکسیون را قبل از لیز خط بزن.",
        "attending_en": "Attending: Cross out dissection before lysis."
    },
    (1,60): {
        "interpretation_fa": "زن ۶۵ ساله یک روز پس از انفارکتوس قدامی با تنگی‌نفس، رال نیمه تحتانی، ورید برجسته، فشار ۱۵۰ روی ۱۰۰ و تپش ۱۲۰، ادم حاد ریه پس از انفارکتوس دارد. در این مرحله احتقان ریوی با فشار بالا، نیتروگلیسیرین وریدی با کاهش پیش‌بار و پس‌بار تنگی‌نفس را سریع کم می‌کند. مسدود بتا در تنگی‌نفس حاد و رال پرهیز دارد و دوبوتامین برای افت فشار است.",
        "interpretation_en": "A 65-year-old woman one day after anterior infarction with dyspnea, basal rales, jugular distension, 150/100 and 120 bpm has acute pulmonary edema post-MI. At this stage with congestion and high pressure, IV nitroglycerin by reducing preload and afterload quickly eases dyspnea. Beta-blocker is avoided in acute dyspnea with rales and dobutamine is for low pressure.",
        "reasons_fa": [
            "دلیل رد گزینه: متورال در ادم حاد ریه با رال پرهیز دارد.",
            "گزینه صحیح: نیتروگلیسیرین وریدی در ادم ریه با فشار بالا ارجح است.",
            "دلیل رد گزینه: دیگوکسین در ادم حاد ریه انتخاب اول نیست.",
            "دلیل رد گزینه: دوبوتامین برای شوک با افت فشار است نه فشار بالا."
        ],
        "reasons_en": [
            "Why incorrect: Metoral avoided in acute pulmonary edema with rales.",
            "Correct: IV nitroglycerin in pulmonary edema with high pressure is preferred.",
            "Why incorrect: Digoxin not first choice in acute edema.",
            "Why incorrect: Dobutamine for shock with low pressure not high."
        ],
        "lead_fa": "روز بعد انفارکتوس با رال و فشار بالا یعنی ادم ریه؛ نیترو بده.",
        "lead_en": "Day after infarction with rales and high pressure means edema; give nitro.",
        "golden_fa": "در ادم پس از انفارکتوس با فشار بالا، نیترو و اکسیژن را زود بده.",
        "golden_en": "In post-MI edema with high pressure, give nitro and oxygen early.",
        "points_fa": [
            "اکسیژن و وضعیت نشسته کمک می‌کند.",
            "دیورتیک در احتقان ریوی مفید است.",
            "بتا را پس از رفع ادم شروع کن.",
            "اکو عملکرد بطن را می‌سنجد."
        ],
        "points_en": [
            "Oxygen and upright posture help.",
            "Diuretic helps pulmonary congestion.",
            "Start beta after edema resolves.",
            "Echo gauges ventricular function."
        ],
        "hint_fa": "در ریه پرآب با فشار بالا، کدام وریدی رگ را باز می‌کند؟",
        "hint_en": "In wet lung with high pressure, which IV opens vessels?",
        "attending_fa": "استاد: رال پس از انفارکتوس را با نیترو خشک کن.",
        "attending_en": "Attending: Dry post-MI rales with nitro."
    },
}
OPTIONS_EN_MAP4 = {
    (1,46): ['Severe aortic stenosis', 'Acute cardiac ischemia', 'HOCM', 'RBBB'],
    (1,47): ['Pulsus alternans', 'Bigeminal pulse', 'Pulsus paradoxus', 'Corrigan pulse'],
    (1,48): ['No further workup, normal', 'Transthoracic echo', '24h Holter', 'Repeat ECG in 6 months'],
    (1,49): ['FBS, TG, cholesterol', 'Renal Doppler', 'Chest film', 'Urinary catecholamines'],
    (1,50): ['Glyburide', 'Metoprolol', 'Metformin', 'Captopril'],
    (1,51): ['Diltiazem', 'Aspirin', 'Clopidogrel', 'Atorvastatin'],
    (1,52): ['IV furosemide', 'IV amiodarone', 'Check digoxin level', 'Urgent angiography'],
    (1,53): ['Aortic dissection', 'Aortic coarctation', 'Takayasu arteritis', 'Acute pericarditis'],
    (1,54): ['Recent aspirin', 'Abdominal surgery 2y ago', 'Stroke 10y ago', 'BP 200/110 now'],
    (1,55): ['Discharge', 'Exercise test at discharge', 'IV IIb/IIIa + early angio', 'IV IIb/IIIa + angio at discharge'],
    (1,56): ['Coronary angiography', 'Exercise test', 'Outpatient drugs', 'Admission + drugs'],
    (1,57): ['Parenchymal lung disease', 'Idiopathic PAH', 'Chronic thromboembolism', 'Left heart failure'],
    (1,58): ['COPD', 'TR', 'Constrictive pericarditis', 'Restrictive CM'],
    (1,59): ['CPR >10 min', 'Suspected aortic dissection', 'Anticoagulant use', 'Ischemic stroke 2y ago'],
    (1,60): ['Metoral', 'IV nitroglycerin', 'Digoxin', 'Dobutamine'],
}
def enrich4():
    assert len(ITEMS)==15
    path = ROOT / f"tools/master-bank/import-payload.master-preint.part{PART:02}.json"
    before = json.loads(path.read_text(encoding="utf-8"))
    after = copy.deepcopy(before)
    for local, q in enumerate(after["questions"], 1):
        item = ITEMS.get((PART, local))
        if item is None:
            continue
        if not q.get("options_en") or len([o for o in q.get("options_en",[]) if str(o).strip()])<4:
            q["options_en"] = OPTIONS_EN_MAP4.get((PART, local), q.get("options_en",[]))
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
    print(f"PASS: enriched {len(ITEMS)} heart Q46-60 part{PART:02}")
if __name__=="__main__":
    enrich4()
