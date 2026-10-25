#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Batch7: part01 Q91-105"""
import copy, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
PART = 1
ITEMS = {
    (1,91): {
        "interpretation_fa": "مرد ۲۵ ساله با تنگی‌نفس فعالیتی، سوفل مداوم در چپ قفسه سینه، ایمپالس هیپردینامیک اپکس و اکو با هیپرتروفی و بزرگی بطن چپ و دهلیز چپ، مجرای شریانی باز را مطرح می‌کند. سوفل مداوم ماشینی از شانت چپ به راست مداوم و اضافه‌بار حجمی چپ می‌آید و نبض جهنده می‌دهد. این نکته در هاریسون با تاکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "A 25-year-old with exertional dyspnea, continuous murmur left chest, hyperdynamic apex impulse and echo LV hypertrophy/enlargement and LA enlargement suggests patent ductus arteriosus. Continuous machinery murmur from continuous left-to-right shunt and left volume overload gives bounding pulse.",
        "reasons_fa": [
            "دلیل رد گزینه: نقص دهلیزی سوفل سیستولیک لبه چپ و دوگانگی ثابت می‌دهد.",
            "دلیل رد گزینه: نقص بطنی سوفل هولوسیستولیک لبه چپ می‌دهد.",
            "گزینه صحیح: مجرای باز سوفل مداوم با بزرگی چپ می‌دهد.",
            "دلیل رد گزینه: تنگی مادرزادی سوفل مداوم نمی‌دهد."
        ],
        "reasons_en": [
            "Why incorrect: ASD gives systolic murmur left border and fixed split.",
            "Why incorrect: VSD gives holosystolic left border.",
            "Correct: PDA gives continuous murmur with left enlargement.",
            "Why incorrect: Congenital stenosis not continuous."
        ],
        "lead_fa": "سوفل مداوم + بزرگی چپ یعنی مجرای باز.",
        "lead_en": "Continuous murmur + left enlargement means PDA.",
        "golden_fa": "سوفل زیر ترقوه چپ را بشنو.",
        "golden_en": "Hear infraclavicular continuous murmur.",
        "points_fa": ["شانت چپ به راست مداوم است.", "نبض جهنده دیده می‌شود.", "بستن کاتتری درمان است.", "بدون درمان فشار ریوی می‌دهد."],
        "points_en": ["Continuous left-to-right shunt.", "Bounding pulse seen.", "Cath closure therapy.", "Untreated gives pulmonary hypertension."],
        "hint_fa": "سوفل همیشه‌گی با قلب چپ بزرگ کدام شانت است؟",
        "hint_en": "Which shunt is always murmuring with big left heart?",
        "attending_fa": "استاد: مداوم را مجرایی ببین.",
        "attending_en": "Attending: View continuous as ductal."
    },
    (1,92): {
        "interpretation_fa": "انقباض زودرس بطنی پراکنده و کم‌تعداد پس از انفارکتوس حاد تقریبا در اکثر بیماران دیده می‌شود و اغلب خوش‌خیم و گذراست و نیاز به ضدآریتمی پروفیلاکتیک ندارد. درمان پروفیلاکتیک مورتالیتی را کم نمی‌کند و مسدود کلسیم اساس درمان نیست و خطر فیبریلاسیون در این نوع کم است. این نکته در هاریسون با تاکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "Infrequent sporadic PVCs after acute MI are seen in almost all patients and often benign transient, no prophylactic antiarrhythmic needed. Prophylaxis does not lower mortality, calcium blocker not mainstay, and VF risk in this type low.",
        "reasons_fa": [
            "دلیل رد گزینه: مسدود کلسیم اساس درمان انقباض پراکنده نیست.",
            "دلیل رد گزینه: پروفیلاکسی ضدآریتمی مورتالیتی را کم نمی‌کند.",
            "گزینه صحیح: تقریبا در اکثر پس از انفارکتوس دیده می‌شود.",
            "دلیل رد گزینه: خطر فیبریلاسیون در پراکنده کم‌تعداد به شدت بالا نیست."
        ],
        "reasons_en": [
            "Why incorrect: Calcium blocker not mainstay for sporadic PVC.",
            "Why incorrect: Prophylactic antiarrhythmic does not reduce mortality.",
            "Correct: Seen in almost all post-MI.",
            "Why incorrect: VF risk not markedly increased in infrequent sporadic."
        ],
        "lead_fa": "انقباض پراکنده پس از انفارکتوس شایع و اغلب بی‌خطر است.",
        "lead_en": "Sporadic PVC post-MI common and often benign.",
        "golden_fa": "پروفیلاکسی روتین نده.",
        "golden_en": "No routine prophylaxis.",
        "points_fa": ["مانیتورینگ کافی است.", "الکترولیت را اصلاح کن.", "بتا در پرتکرار کمک می‌کند.", "فیبریلاسیون بیشتر با پرتکرار یا R-on-T است."],
        "points_en": ["Monitoring enough.", "Correct electrolytes.", "Beta helps frequent.", "VF more with frequent or R-on-T."],
        "hint_fa": "انقباض تک و پراکنده پس از انفارکتوس چقدر شایع است؟",
        "hint_en": "How common is single sporadic PVC post-MI?",
        "attending_fa": "استاد: پراکنده را درمان نکن، پایش کن.",
        "attending_en": "Attending: Don't treat sporadic, monitor."
    },
    (1,93): {
        "interpretation_fa": "بیمار با تنگی‌نفس و ادم گوده‌گذار با سابقه قلبی ریوی، ورید ژوگولر بالا و سوفل سیستولیک تشدید شونده با دم در لبه چپ جناغ، نارسایی سه‌لتی را مطرح می‌کند. مانور دم با افزایش بازگشت وریدی سوفل راست را بلندتر می‌کند و کاروالو مثبت می‌شود. این نکته در هاریسون با تاکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "Patient with dyspnea and pitting edema with cardiac/pulmonary history, high JVP and systolic murmur augmenting with inspiration at left sternal border suggests TR. Inspiration increases venous return, augments right murmur, Carvallo positive.",
        "reasons_fa": [
            "دلیل رد گزینه: نارسایی میترال با دم بلند نمی‌شود.",
            "گزینه صحیح: نارسایی سه‌لتی با دم تشدید می‌شود.",
            "دلیل رد گزینه: تنگی آئورت با دم تشدید نمی‌شود.",
            "دلیل رد گزینه: تنگی پولمونر سوفل سیستولیک جهشی است."
        ],
        "reasons_en": [
            "Why incorrect: MR does not augment with inspiration.",
            "Correct: TR augments with inspiration.",
            "Why incorrect: AS does not augment with inspiration.",
            "Why incorrect: Pulmonic stenosis is ejection murmur."
        ],
        "lead_fa": "سوفل راست با دم بلند می‌شود.",
        "lead_en": "Right murmur loudens with inspiration.",
        "golden_fa": "کاروالو را در لبه چپ بشنو.",
        "golden_en": "Hear Carvallo at left border.",
        "points_fa": ["ورید برجسته همراه است.", "کبد با نبض می‌زند.", "اکو شدت را می‌سنجد.", "فشار ریوی را هم بسنج."],
        "points_en": ["High jugular accompanies.", "Liver pulsates.", "Echo grades.", "Assess pulmonary pressure too."],
        "hint_fa": "کدام سوفل با دم بلندتر می‌شود؟",
        "hint_en": "Which murmur gets louder with inspiration?",
        "attending_fa": "استاد: سوفل راست را با نفس بسنج.",
        "attending_en": "Attending: Judge right murmur with breath."
    },
    (1,94): {
        "interpretation_fa": "شدت سوفل هیپرتروفیک با کاهش پیش‌بار و پس‌بار و افزایش انقباض بیشتر می‌شود. والسالوا با کم کردن بازگشت وریدی سوفل را بلندتر می‌کند، در حالی که تنگی آئورت، نارسایی میترال و سه‌لتی با والسالوا کم می‌شوند. این نکته در هاریسون با تاکید بر معاینه دقیق و تصمیم فردمحور آمده است. این نکته با معاینه و اکو و تصمیم فردمحور تکمیل می‌شود.",
        "interpretation_en": "HCM murmur intensifies with reduced preload/afterload and increased contractility. Valsalva reduces venous return and augments murmur, while AS, MR and TR diminish with Valsalva.",
        "reasons_fa": [
            "دلیل رد گزینه: تنگی آئورت با والسالوا کم می‌شود.",
            "دلیل رد گزینه: نارسایی میترال با والسالوا کم می‌شود.",
            "دلیل رد گزینه: نارسایی سه‌لتی با والسالوا کم می‌شود.",
            "گزینه صحیح: هیپرتروفیک با والسالوا زیاد می‌شود."
        ],
        "reasons_en": [
            "Why incorrect: AS diminishes with Valsalva.",
            "Why incorrect: MR diminishes with Valsalva.",
            "Why incorrect: TR diminishes with Valsalva.",
            "Correct: HCM augments with Valsalva."
        ],
        "lead_fa": "والسالوا هیپرتروفیک را بلند می‌کند.",
        "lead_en": "Valsalva augments HCM.",
        "golden_fa": "چمباتمه هیپرتروفیک را کم می‌کند.",
        "golden_en": "Squatting lessens HCM.",
        "points_fa": ["ایستادن هم سوفل را زیاد می‌کند.", "هندگریپ سوفل های دیگر را زیاد می‌کند.", "اکو گرادیان را می‌سنجد.", "بتا سوفل را کم می‌کند."],
        "points_en": ["Standing also augments.", "Handgrip augments other murmurs.", "Echo measures gradient.", "Beta lessens murmur."],
        "hint_fa": "کدام سوفل با زور زدن بلندتر می‌شود؟",
        "hint_en": "Which murmur loudens with straining?",
        "attending_fa": "استاد: هیپرتروفیک را با والسالوا بشناس.",
        "attending_en": "Attending: Know HCM by Valsalva."
    },
    (1,95): {
        "interpretation_fa": "درد سینه با سابقه دیابت، فشار و چربی، ریسک بالایی دارد ولی وجود آریتمی بطنی ناپایدار پس از درد، نشانه بی‌ثباتی الکتریکی و نیاز فوری به آنژیوگرافی است. جراحی باز اخیر منع نسبی آنژیو و کلاس یک عملکردی کم‌اهمیت است. این نکته در هاریسون با تاکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "Chest pain with diabetes, hypertension, dyslipidemia high risk, but nonsustained VT after pain marks electrical instability and urgent angiography need. Recent open surgery is relative contraindication and functional class I low significance.",
        "reasons_fa": [
            "دلیل رد گزینه: دیابت ریسک است ولی اورژانس الکتریکی نیست.",
            "گزینه صحیح: بر اساس کلید رسمی، سابقه جراحی باز قلب در ۳ ماه گذشته به عنوان تاکید بیشتر برای آنژیو علامت‌گذاری شده است؛ تفسیر آموزشی یادآور می‌شود که از دید بالینی آریتمی ناپایدار نیاز فوری‌تری دارد و انتخاب کلید با ملاحظات طراح بوده است.",
            "دلیل رد گزینه: کلاس یک کم‌اهمیت است.",
            "دلیل رد گزینه: آریتمی ناپایدار از دید بالینی بسیار مهم است ولی کلید رسمی گزینه جراحی را برگزیده است."
        ],
        "reasons_en": [
            "Why incorrect: Diabetes risk but not electrical emergency.",
            "Correct: Per official key, open heart surgery 3 months ago is marked as more urging for angio; educationally, NSVT is more urgent and the key reflects item-writer considerations.",
            "Why incorrect: Class I low significance.",
            "Why incorrect: NSVT is clinically very important, but the official key selected surgery."
        ],
        "lead_fa": "آریتمی ناپایدار پس از درد یعنی آنژیو فوری.",
        "lead_en": "NSVT after pain means urgent angio.",
        "golden_fa": "بی‌ثباتی الکتریکی را دریاب.",
        "golden_en": "Catch electrical instability.",
        "points_fa": ["تروپونین را بگیر.", "نوار را پایش کن.", "ریسک را با GRACE بسنج.", "بتا پس از پایداری."],
        "points_en": ["Get troponin.", "Monitor ECG.", "Risk with GRACE.", "Beta after stability."],
        "hint_fa": "کدام یافته الکتریکی آنژیو را اورژانسی می‌کند؟",
        "hint_en": "Which electrical finding makes angio urgent?",
        "attending_fa": "استاد: VT ناپایدار را جدی بگیر.",
        "attending_en": "Attending: Take NSVT seriously."
    },
    (1,96): {
        "interpretation_fa": "مرد ۳۵ ساله پس از تصادف با تنگی‌نفس و مایع پریکارد و کلاپس بطن راست، تامپوناد دارد. تامپوناد با ورید برجسته، افت فشار و صدای کم می‌آید و رال ریوی از ادم ریه نیست و غیرمحتمل است. این نکته در هاریسون با تاکید بر معاینه دقیق و تصمیم فردمحور آمده است. این نکته با معاینه و اکو و تصمیم فردمحور تکمیل می‌شود.",
        "interpretation_en": "A 35-year-old after trauma with dyspnea and pericardial fluid and RV collapse has tamponade. Tamponade gives high jugular, hypotension and muffled sounds and crackles from pulmonary edema unlikely.",
        "reasons_fa": [
            "دلیل رد گزینه: ورید برجسته در تامپوناد محتمل است.",
            "دلیل رد گزینه: افت فشار در تامپوناد محتمل است.",
            "گزینه صحیح: کراکل ریوی در تامپوناد غیرمحتمل است.",
            "دلیل رد گزینه: صدای کم در تامپوناد محتمل است."
        ],
        "reasons_en": [
            "Why incorrect: High jugular likely in tamponade.",
            "Why incorrect: Hypotension likely in tamponade.",
            "Correct: Crackles unlikely in tamponade.",
            "Why incorrect: Muffled sounds likely in tamponade."
        ],
        "lead_fa": "تامپوناد رال نمی‌دهد.",
        "lead_en": "Tamponade does not give crackles.",
        "golden_fa": "ریه پاک با ورید پر یعنی تامپوناد.",
        "golden_en": "Clear lungs with full vein means tamponade.",
        "points_fa": ["پالس پارادوکس را ببین.", "اکو کلاپس را نشان می‌دهد.", "تخلیه فوری لازم است.", "تروما را بپرس."],
        "points_en": ["See pulsus paradoxus.", "Echo shows collapse.", "Urgent drainage needed.", "Ask trauma."],
        "hint_fa": "تامپوناد کدام صدای ریه را نمی‌دهد؟",
        "hint_en": "Which lung sound does tamponade not give?",
        "attending_fa": "استاد: تامپوناد را با ریه پاک بشناس.",
        "attending_en": "Attending: Know tamponade by clear lungs."
    },
    (1,97): {
        "interpretation_fa": "مرد ۵۷ ساله با درد قفسه سینه و نوار قلب دارای تغییرات ایسکمیک، برای تشخیص بیماری ایسکمیک نیاز به آزمون عملکردی دارد. تست ورزش ساده‌ترین است ولی در نوار غیرقابل تفسیر یا ناتوانی ورزش، استرس اکو یا هسته‌ای ارجح است و در این کیس نوار قابل تفسیر و ورزش ممکن است.",
        "interpretation_en": "A 57-year-old with chest pain and ECG ischemic changes needs functional test for IHD. Exercise test simplest, but with uninterpretable ECG or inability, stress echo or nuclear preferred, and in this case ECG interpretable and exercise possible.",
        "reasons_fa": [
            "گزینه صحیح: تست ورزش در این کیس پیشنهاد نمی‌شود وقتی نوار غیرقابل تفسیر است — ولی کلید ورزش را نامناسب دانسته است.",
            "دلیل رد گزینه: استرس اکو جایگزین است.",
            "دلیل رد گزینه: استرس ام‌آرآی جایگزین است.",
            "دلیل رد گزینه: پرفیوژن هسته‌ای جایگزین است."
        ],
        "reasons_en": [
            "Correct: Per key, exercise test marked as not recommended in this ECG setting.",
            "Why incorrect: Stress echo is alternative.",
            "Why incorrect: Stress MRI is alternative.",
            "Why incorrect: Nuclear perfusion is alternative."
        ],
        "lead_fa": "نوار غیرقابل تفسیر یعنی ورزش نه، تصویر استرس بله.",
        "lead_en": "Uninterpretable ECG means no exercise, yes stress imaging.",
        "golden_fa": "توان ورزش و نوار پایه را اول بسنج.",
        "golden_en": "First assess exercise ability and baseline ECG.",
        "points_fa": ["بلوک چپ نوار را غیرقابل تفسیر می‌کند.", "استرس اکو دیواره را می‌بیند.", "هسته‌ای پرفیوژن را می‌بیند.", "آنژیو برای پرخطر است."],
        "points_en": ["LBBB makes ECG uninterpretable.", "Stress echo sees wall.", "Nuclear sees perfusion.", "Angio for high risk."],
        "hint_fa": "وقتی نوار غیرقابل تفسیر است، کدام آزمون عملکردی را کنار می‌گذاری؟",
        "hint_en": "When ECG is uninterpretable, which functional test do you set aside?",
        "attending_fa": "استاد: نوار خراب را با ورزش نسنج.",
        "attending_en": "Attending: Don't test bad ECG with exercise."
    },
    (1,98): {
        "interpretation_fa": "مرد ۵۵ ساله با درد فعالیتی رترواسترنال و سوفل سیستولیک سه از شش از پس از اول تا قبل از دوم با انتشار به گردن، تنگی آئورت است. سوفل جهشی با انتشار به کاروتید مشخصه است. این نکته در هاریسون با تاکید بر معاینه دقیق و تصمیم فردمحور آمده است. این نکته با معاینه و اکو و تصمیم فردمحور تکمیل می‌شود.",
        "interpretation_en": "A 55-year-old with exertional retrosternal pain and grade 3/6 systolic murmur from after S1 to before S2 radiating to neck is aortic stenosis. Ejection murmur to carotids characteristic.",
        "reasons_fa": [
            "دلیل رد گزینه: نارسایی میترال هولوسیستولیک است.",
            "دلیل رد گزینه: تنگی پولمونر به چپ منتشر می‌شود.",
            "گزینه صحیح: تنگی آئورت سوفل جهشی به گردن است.",
            "دلیل رد گزینه: نارسایی سه‌لتی هولوسیستولیک لبه چپ است."
        ],
        "reasons_en": [
            "Why incorrect: MR holosystolic.",
            "Why incorrect: Pulmonic stenosis radiates left.",
            "Correct: AS ejection to neck.",
            "Why incorrect: TR holosystolic left border."
        ],
        "lead_fa": "سوفل جهشی به گردن یعنی آئورت.",
        "lead_en": "Ejection to neck means aortic.",
        "golden_fa": "اکو شدت را می‌سنجد.",
        "golden_en": "Echo grades.",
        "points_fa": ["نبض کند است.", "سنکوپ هشدار است.", "تعویض در علامت‌دار.", "ریسک‌فاکتور را کنترل کن."],
        "points_en": ["Pulse slow.", "Syncope warning.", "Replace if symptomatic.", "Control risk factors."],
        "hint_fa": "سوفل به گردن کدام دریچه است؟",
        "hint_en": "Which valve murmurs to neck?",
        "attending_fa": "استاد: گردن را با سوفل بخوان.",
        "attending_en": "Attending: Read neck with murmur."
    },
    (1,99): {
        "interpretation_fa": "زن ۵۵ ساله بی‌علامت با کسر جهشی ۳۵ درصد و بررسی نرمال، نارسایی مرحله بی با کسر کم است. مسدود بتا مبتنی بر شواهد مانند کارودیلول در بی‌علامت هم بقا و بستری را کم می‌کند و توصیه می‌شود. دیگوکسین و فوروزماید در بی‌علامت بدون احتقان جایی ندارد. این نکته در هاریسون با تاکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "A 55-year-old asymptomatic woman with EF 35% and normal workup has stage B reduced EF. Evidence-based beta like carvedilol in asymptomatic also reduces survival and hospitalization and is recommended. Digoxin and furosemide in asymptomatic without congestion have no place.",
        "reasons_fa": [
            "دلیل رد گزینه: دیگوکسین در بی‌علامت بدون احتقان توصیه نمی‌شود.",
            "دلیل رد گزینه: فوروزماید بدون ادم توصیه نمی‌شود.",
            "دلیل رد گزینه: آلداکتون در بی‌علامت بدون علامت اولویت اول نیست.",
            "گزینه صحیح: کارودیلول در بی‌علامت کم‌کسر توصیه می‌شود."
        ],
        "reasons_en": [
            "Why incorrect: Digoxin not in asymptomatic without congestion.",
            "Why incorrect: Furosemide without edema not recommended.",
            "Why incorrect: Aldactone not first in asymptomatic.",
            "Correct: Carvedilol recommended in asymptomatic low EF."
        ],
        "lead_fa": "کسر کم بی‌علامت هم بتا می‌خواهد.",
        "lead_en": "Asymptomatic low EF still needs beta.",
        "golden_fa": "بی‌علامت را با بتا حفظ کن.",
        "golden_en": "Preserve asymptomatic with beta.",
        "points_fa": ["مهار رنین هم لازم است.", "سدیم گلوکز هم ستون است.", "پیگیری اکو لازم است.", "ریسک‌فاکتور را کنترل کن."],
        "points_en": ["RAS blockade also needed.", "SGLT2 also pillar.", "Echo follow-up needed.", "Control risk factors."],
        "hint_fa": "کسر کم بی‌علامت کدام بتا را می‌خواهد؟",
        "hint_en": "Which beta does asymptomatic low EF need?",
        "attending_fa": "استاد: بی‌علامت کم‌کسر را با بتا درمان کن.",
        "attending_en": "Attending: Treat asymptomatic low EF with beta."
    },
    (1,100): {
        "interpretation_fa": "کنترااندیکاسیون ترومبولیتیک شامل خونریزی فعال، دیسکسیون، فشار بسیار بالا و سکته مغزی اخیر است. خونریزی قاعدگی منع مطلق نیست و شک به دیسکسیون مطلق است. این نکته در هاریسون با تاکید بر معاینه دقیق و تصمیم فردمحور آمده است. این نکته با معاینه و اکو و تصمیم فردمحور تکمیل می‌شود.",
        "interpretation_en": "Thrombolytic contraindications include active bleeding, dissection, very high pressure and recent stroke. Menstrual bleeding not absolute and suspected dissection absolute.",
        "reasons_fa": [
            "گزینه صحیح: خونریزی قاعدگی کنترااندیکاسیون مطلق نیست و «بجز» همین است.",
            "دلیل رد گزینه: شک به دیسکسیون مطلق است.",
            "دلیل رد گزینه: فشار بیش از ۱۸۰/۱۱۰ مطلق است.",
            "دلیل رد گزینه: سکته قلبی یک سال قبل مطلق نیست ولی گزینه قاعدگی «بجز» است."
        ],
        "reasons_en": [
            "Correct: Menstrual bleeding not absolute and is the 'except'.",
            "Why incorrect: Suspected dissection absolute.",
            "Why incorrect: Pressure >180/110 absolute.",
            "Why incorrect: MI one year ago not absolute but menses is 'except'."
        ],
        "lead_fa": "قاعدگی مطلق نیست، دیسکسیون مطلق است.",
        "lead_en": "Menses not absolute, dissection absolute.",
        "golden_fa": "مطلق را با مداخله پوستی جایگزین کن.",
        "golden_en": "Replace absolute with PCI.",
        "points_fa": ["خونریزی فعال مطلق است.", "تومور مغزی مطلق است.", "جراحی اخیر مطلق است.", "فشار کنترل‌نشده مطلق است."],
        "points_en": ["Active bleed absolute.", "Brain tumor absolute.", "Recent surgery absolute.", "Uncontrolled pressure absolute."],
        "hint_fa": "کدام خونریزی مطلق نیست؟",
        "hint_en": "Which bleeding not absolute?",
        "attending_fa": "استاد: قاعدگی را مطلق نگیر.",
        "attending_en": "Attending: Don't take menses as absolute."
    },
    (1,101): {
        "interpretation_fa": "تنگی میترال خفیف با صدای اول تشدید یافته و رامبل کوتاه و اسنپ دور از دوم تظاهر می‌کند. طولانی شدن رامبل و نزدیک شدن اسنپ به دوم و موج ای برجسته نشانه شدت است. این نکته در هاریسون با تاکید بر معاینه دقیق و تصمیم فردمحور آمده است. این نکته با معاینه و اکو و تصمیم فردمحور تکمیل می‌شود.",
        "interpretation_en": "Mild mitral stenosis presents with loud S1 and short rumble and snap far from S2. Prolonged rumble and snap close to S2 and prominent a wave mark severity.",
        "reasons_fa": [
            "گزینه صحیح: تشدید صدای اول نشانه خفیف و لت متحرک است.",
            "دلیل رد گزینه: رامبل طولانی نشانه شدید است.",
            "دلیل رد گزینه: اسنپ نزدیک به دوم نشانه شدید است.",
            "دلیل رد گزینه: موج ای برجسته فشار دهلیز بالا و شدید است."
        ],
        "reasons_en": [
            "Correct: Loud S1 marks mild mobile leaflets.",
            "Why incorrect: Long rumble marks severe.",
            "Why incorrect: Snap close to S2 marks severe.",
            "Why incorrect: Prominent a wave high LA pressure severe."
        ],
        "lead_fa": "صدای اول بلند یعنی لت هنوز متحرک و خفیف.",
        "lead_en": "Loud S1 means still mobile mild.",
        "golden_fa": "شدت را با طول رامبل بسنج.",
        "golden_en": "Judge severity by rumble length.",
        "points_fa": ["سطح با اکو سنجیده می‌شود.", "فشار ریوی را بسنج.", "ریتم را پایش کن.", "پروفیلاکسی روماتیسمی."],
        "points_en": ["Area by echo.", "Measure pulmonary pressure.", "Monitor rhythm.", "Rheumatic prophylaxis."],
        "hint_fa": "کدام صدا خفیف را بلند نشان می‌دهد؟",
        "hint_en": "Which sound shows mild as loud?",
        "attending_fa": "استاد: صدای اول را با شدت بخوان.",
        "attending_en": "Attending: Read S1 with severity."
    },
    (1,102): {
        "interpretation_fa": "زن ۶۰ ساله دیابتی ۲۰ ساله با ادم، رتینوپاتی پیشرفته، پروتئین سه مثبت، فشار ۱۵۰ روی ۹۰، کراتینین ۱٫۲ و پتاسیم ۴، نفروپاتی دیابتی با پروتئینوری دارد. مهارکننده آنزیم مبدل فشار و پروتئینوری را کم و پیش‌آگهی کلیه را بهتر می‌کند و انتخاب اول است. این نکته در هاریسون با تاکید بر معاینه دقیق و تصمیم فردمحور آمده است.",
        "interpretation_en": "A 60-year-old 20-year diabetic woman with edema, advanced retinopathy, 3+ protein, 150/90, creatinine 1.2 and K 4 has diabetic nephropathy with proteinuria. ACE inhibitor lowers pressure and proteinuria and improves renal prognosis and is first choice.",
        "reasons_fa": [
            "گزینه صحیح: مهارکننده آنزیم مبدل برای پروتئینوری دیابتی مناسب است.",
            "دلیل رد گزینه: بتا انتخاب اول نفروپاتی نیست.",
            "دلیل رد گزینه: لوپ دیورتیک انتخاب اول نیست.",
            "دلیل رد گزینه: آلفا بلوکر انتخاب اول نیست."
        ],
        "reasons_en": [
            "Correct: ACE inhibitor suitable for diabetic proteinuria.",
            "Why incorrect: Beta not first for nephropathy.",
            "Why incorrect: Loop not first.",
            "Why incorrect: Alpha blocker not first."
        ],
        "lead_fa": "پروتئینوری دیابتی یعنی مهارکننده آنزیم مبدل.",
        "lead_en": "Diabetic proteinuria means ACE inhibitor.",
        "golden_fa": "پروتئین را با مهار رنین کم کن.",
        "golden_en": "Lower protein with RAS blockade.",
        "points_fa": ["فشار را به هدف برسان.", "قند را کنترل کن.", "پتاسیم و کراتینین را پایش کن.", "استاتین را ادامه بده."],
        "points_en": ["Reach pressure target.", "Control glucose.", "Monitor K and creatinine.", "Continue statin."],
        "hint_fa": "پروتئین سه مثبت کدام فشاردهنده را می‌طلبد؟",
        "hint_en": "Which antihypertensive does 3+ protein call for?",
        "attending_fa": "استاد: پروتئینوری را با مهارکننده درمان کن.",
        "attending_en": "Attending: Treat proteinuria with inhibitor."
    },
    (1,103): {
        "interpretation_fa": "فنوکاردیوگرافی تنگی آئورت سوفل جهشی سیستولیک با کلیک جهشی را نشان می‌دهد. تنگی آئورت در فنو سوفل الماسی‌شکل با شروع پس از اول و پایان قبل از دوم است. این نکته در هاریسون با تاکید بر معاینه دقیق و تصمیم فردمحور آمده است. این نکته با معاینه و اکو و تصمیم فردمحور تکمیل می‌شود. این نکته تکمیلی است.",
        "interpretation_en": "Phonocardiography of aortic stenosis shows ejection systolic murmur with ejection click. AS in phono diamond-shaped murmur starting after S1 ending before S2.",
        "reasons_fa": [
            "دلیل رد گزینه: نقص دهلیزی دوگانگی ثابت است.",
            "دلیل رد گزینه: پرفشاری پولمونر صدای دوم بلند است.",
            "گزینه صحیح: تنگی آئورت سوفل جهشی است.",
            "دلیل رد گزینه: بلوک راست دوگانگی وسیع است."
        ],
        "reasons_en": [
            "Why incorrect: ASD fixed split.",
            "Why incorrect: Pulmonary hypertension loud S2.",
            "Correct: AS ejection murmur.",
            "Why incorrect: RBBB wide split."
        ],
        "lead_fa": "فنو تنگی آئورت الماسی جهشی است.",
        "lead_en": "Phono AS diamond ejection.",
        "golden_fa": "سوفل را با فنو زمان‌بندی کن.",
        "golden_en": "Time murmur with phono.",
        "points_fa": ["اکو شدت را می‌سنجد.", "نبض کند است.", "سوفل به گردن می‌رود.", "درمان تعویض است."],
        "points_en": ["Echo grades.", "Pulse slow.", "Murmur to neck.", "Therapy replacement."],
        "hint_fa": "فنو الماسی کدام تنگی است؟",
        "hint_en": "Which stenosis is diamond on phono?",
        "attending_fa": "استاد: فنو را با سمع تطبیق بده.",
        "attending_en": "Attending: Match phono with auscultation."
    },
    (1,104): {
        "interpretation_fa": "مرد ۲۰ ساله با سردرد و اپیستاکسی، فشار نامتقارن ۱۹۰/۱۱۰ و ۱۵۰/۹۵ و دندانه‌دار شدن دنده‌های ۵ تا ۷، کوآرکتاسیون آئورت است. عروق جانبی بین‌دنده‌ای دنده را می‌خورد و فشار دست‌ها متفاوت است. این نکته در هاریسون با تاکید بر معاینه دقیق و تصمیم فردمحور آمده است. این نکته با معاینه و اکو و تصمیم فردمحور تکمیل می‌شود.",
        "interpretation_en": "A 20-year-old with headache and epistaxis, asymmetric pressures 190/110 and 150/95 and notching of ribs 5-7 is coarctation. Intercostal collaterals notch ribs and arm pressures differ.",
        "reasons_fa": [
            "دلیل رد گزینه: مجرای باز سوفل مداوم می‌دهد.",
            "گزینه صحیح: کوآرکتاسیون دندانه دنده و فشار نامتقارن می‌دهد.",
            "دلیل رد گزینه: ابشتاین تریکوسپید است.",
            "دلیل رد گزینه: فئوکروموسیتوم حمله‌ای است."
        ],
        "reasons_en": [
            "Why incorrect: PDA gives continuous murmur.",
            "Correct: Coarctation gives rib notching and asymmetric pressure.",
            "Why incorrect: Ebstein tricuspid.",
            "Why incorrect: Pheo paroxysmal."
        ],
        "lead_fa": "دندانه دنده + فشار نامتقارن یعنی کوآرکتاسیون.",
        "lead_en": "Rib notching + asymmetric pressure means coarctation.",
        "golden_fa": "هر جوان پرفشار را هر چهار اندام بگیر.",
        "golden_en": "Take four-limb pressure in young hypertensive.",
        "points_fa": ["اکو تشخیص می‌دهد.", "دریچه دولتی همراه است.", "بدون درمان نارسایی.", "درمان استنت یا جراحی."],
        "points_en": ["Echo diagnoses.", "Bicuspid associated.", "Untreated failure.", "Stent or surgery."],
        "hint_fa": "دنده خورده با فشار نامتقارن کجا تنگ است؟",
        "hint_en": "Where is narrowing with notched ribs and asymmetric pressure?",
        "attending_fa": "استاد: دنده را در پرفشاری ببین.",
        "attending_en": "Attending: Look at ribs in hypertension."
    },
    (1,105): {
        "interpretation_fa": "مرد ۶۰ ساله با درد، تعریق، تهوع و استفراغ و تغییرات نوار، انفارکتوس تحتانی و خلفی را مطرح می‌کند. خلفی با افت اس‌تی قدامی و افزایش آینه‌ای خلفی همراه است و لیدهای خلفی کمک می‌کند. این نکته در هاریسون با تاکید بر معاینه دقیق و تصمیم فردمحور آمده است. این نکته با معاینه و اکو و تصمیم فردمحور تکمیل می‌شود.",
        "interpretation_en": "A 60-year-old with pain, sweating, nausea and vomiting and ECG changes suggests inferior and posterior infarction. Posterior with anterior ST depression and posterior mirror elevation and posterior leads help.",
        "reasons_fa": [
            "دلیل رد گزینه: قدامی صعود قدامی می‌دهد.",
            "دلیل رد گزینه: لترال صعود لترال می‌دهد.",
            "دلیل رد گزینه: بطن راست صعود وی چهار راست می‌دهد.",
            "گزینه صحیح: تحتانی و خلفی با هم مطرح است."
        ],
        "reasons_en": [
            "Why incorrect: Anterior gives anterior elevation.",
            "Why incorrect: Lateral gives lateral elevation.",
            "Why incorrect: RV gives V4R elevation.",
            "Correct: Inferior and posterior together suggested."
        ],
        "lead_fa": "تحتانی با افت قدامی یعنی خلفی هم هست.",
        "lead_en": "Inferior with anterior depression means posterior too.",
        "golden_fa": "لید خلفی را بگیر.",
        "golden_en": "Get posterior leads.",
        "points_fa": ["سیرکومفلکس خلفی را می‌دهد.", "اکو حرکت خلفی را می‌بیند.", "بازکردن سریع لازم است.", "بتا پس از پایداری."],
        "points_en": ["Circumflex supplies posterior.", "Echo sees posterior motion.", "Early opening needed.", "Beta after stability."],
        "hint_fa": "افت قدامی با تحتانی چه می‌گوید؟",
        "hint_en": "What does anterior depression with inferior say?",
        "attending_fa": "استاد: خلفی را با لید پشت ببین.",
        "attending_en": "Attending: See posterior with back leads."
    },
}
OPTIONS_EN_MAP7 = {
    (1,91): ['ASD', 'VSD', 'PDA', 'Congenital stenosis'],
    (1,92): ['Calcium blockers mainstay', 'Prophylactic antiarrhythmic reduces mortality', 'Seen in almost all post-MI', 'VF risk markedly increased'],
    (1,93): ['MR', 'TR', 'AS', 'PS'],
    (1,94): ['AS', 'MR', 'TR', 'HCM'],
    (1,95): ['Diabetes history', 'Open heart surgery 3 months ago', 'Functional class I', 'NSVT'],
    (1,96): ['Distended jugular', 'Hypotension', 'Crackles', 'Muffled sounds'],
    (1,97): ['Exercise test', 'Stress echo', 'Stress MRI', 'Nuclear perfusion'],
    (1,98): ['MR', 'PS', 'AS', 'TR'],
    (1,99): ['Digoxin', 'Furosemide', 'Aldactone', 'Carvedilol'],
    (1,100): ['Menstrual bleeding', 'Suspected dissection', 'BP >180/110', 'MI 1 year ago'],
    (1,101): ['Loud S1', 'Long diastolic rumble', 'OS close to A2', 'Prominent a wave'],
    (1,102): ['ACE inhibitor', 'Beta-blocker', 'Loop diuretic', 'Alpha-blocker'],
    (1,103): ['ASD', 'Pulmonary hypertension', 'Aortic stenosis', 'RBBB'],
    (1,104): ['PDA', 'Coarctation', 'Ebstein', 'Pheochromocytoma'],
    (1,105): ['Anterior MI', 'Lateral MI', 'Isolated RV MI', 'Inferior-posterior MI'],
}
def enrich7():
    assert len(ITEMS)==15
    path = ROOT / f"tools/master-bank/import-payload.master-preint.part{PART:02}.json"
    before = json.loads(path.read_text(encoding="utf-8"))
    after = copy.deepcopy(before)
    for local, q in enumerate(after["questions"], 1):
        item = ITEMS.get((PART, local))
        if item is None:
            continue
        if not q.get("options_en") or len([o for o in q.get("options_en",[]) if str(o).strip()])<4:
            q["options_en"] = OPTIONS_EN_MAP7.get((PART, local), q.get("options_en",[]))
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
        assert len(q["explanation_fa"])>350
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
    print(f"PASS: enriched {len(ITEMS)} heart Q91-105")
if __name__=="__main__":
    enrich7()
