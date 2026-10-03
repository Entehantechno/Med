#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Batch3: part01 Q31-45 — Persian-heavy, minimal parentheses, Socratic hints.
"""
import copy, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
PART = 1
ITEMS = {
    (1,31): {
        "interpretation_fa": "زن ۵۵ ساله پس از تصادف شدید بدون کمربند، با افت فشار، ورید ژوگولر برجسته و صداهای قلبی نشنیدنی و تابلوی کوسمال مراجعه کرده است. این سه‌تاییِ افت فشار، برجستگی ورید ژوگولر و صداهای خفه، همراه با تپش و تنگی‌نفس پس از ترومای بلانت قفسه سینه، تامپوناد قلبی را مطرح می‌کند. در تامپوناد، مایع یا خون در پریکارد فشار داخل پریکارد را بالا می‌برد، پرشدن بطن‌ها مختل و برون‌ده افت می‌کند. کوسمالِ تیپیک بیشتر به سود انقباض پریکارد است و در تامپوناد کلاسیک معمولاً دیده نمی‌شود، ولی برجستگی پایدار ورید ژوگولر و افت فشار سرنخ اصلی است. اقدام ضروری تخلیه فوری مایع پریکارد است؛ مایع‌درمانی یا وازوپرسور بدون تخلیه، مشکل را حل نمی‌کند.",
        "interpretation_en": "A 55-year-old woman after severe unrestrained collision with hypotension, distended jugular veins and inaudible heart sounds fits cardiac tamponade. Fluid or blood in the pericardium raises intrapericardial pressure, impairs filling and drops output. The triad of hypotension, jugular distension and muffled sounds after blunt chest trauma points to tamponade; classic Kussmaul favors constriction and is usually not classic tamponade, but persistent jugular distension with hypotension is the clue. Essential action is emergent pericardial drainage; fluids or vasopressors without drainage do not fix the obstruction.",
        "reasons_fa": [
            "گزینه صحیح: تخلیه مایع پریکارد فشار داخل پریکارد را کم و پرشدن بطن‌ها را آزاد می‌کند و ضروری‌ترین اقدام است.",
            "دلیل رد گزینه: دوپامین بدون رفع انسداد مکانیکی، برون‌ده را پایدار نمی‌کند و درمان اصلی نیست.",
            "دلیل رد گزینه: مایع‌درمانی به تنهایی در تامپونادِ انسدادی کافی نیست و ممکن است فشار وریدی را بالاتر ببرد.",
            "دلیل رد گزینه: تزریق خون در تامپونادِ بدون خونریزی فعال، مشکل پرشدن را حل نمی‌کند."
        ],
        "reasons_en": [
            "Correct: Pericardial drainage lowers intrapericardial pressure, frees filling and is the essential action.",
            "Why incorrect: Dopamine without relieving mechanical obstruction does not stabilize output and is not definitive.",
            "Why incorrect: Fluids alone in obstructive tamponade are insufficient and may raise venous pressure further.",
            "Why incorrect: Whole blood without active bleeding does not fix filling obstruction."
        ],
        "lead_fa": "افت فشار + ورید ژوگولر برجسته + صداهای خفه پس از تروما یعنی تامپوناد تا خلافش ثابت شود.",
        "lead_en": "Hypotension + distended jugular + muffled sounds after trauma means tamponade until proven otherwise.",
        "golden_fa": "در تامپوناد تروما، اکو را فوری بگیر و تخلیه را به تاخیر نینداز.",
        "golden_en": "In traumatic tamponade, get echo immediately and do not delay drainage.",
        "points_fa": [
            "پالس پارادوکسوس افت بیش از ۱۰ میلی‌متر فشار سیستولیک در دم است.",
            "اکو کلاپس دیاستولیک بطن راست و تغییرات تنفسی جریان را نشان می‌دهد.",
            "پنوموتوراکس فشاری و آمبولی ریه هم شوک انسدادی می‌دهند؛ افتراق بالینی لازم است.",
            "پس از تخلیه، علت خونریزی و آسیب میوکارد را بررسی کن."
        ],
        "points_en": [
            "Pulsus paradoxus is >10 mmHg systolic drop on inspiration.",
            "Echo shows diastolic RV collapse and respiratory flow variation.",
            "Tension pneumothorax and large pulmonary embolism also cause obstructive shock; differentiate clinically.",
            "After drainage, look for bleeding source and myocardial injury."
        ],
        "hint_fa": "وقتی قلب در مایع غرق است، کدام اقدام فضا را باز می‌کند؟",
        "hint_en": "When the heart is drowned in fluid, which action reopens the space?",
        "attending_fa": "استاد: تامپوناد را با گوشی و چشم بشناس؛ درمانش سوزن است نه سرم.",
        "attending_en": "Attending: Recognize tamponade with ear and eye; treat with needle, not fluids."
    },
    (1,32): {
        "interpretation_fa": "مرد ۶۰ ساله با تنگی‌نفس و خستگی فعالیتی، صدای اول طبیعی، کاهش شدت صدای دوم آئورتی، صدای جهشی پس از صدای اول و صدای چهارم، همراه با سوفل سیستولیک جهشی در کانون آئورت با انتشار به کاروتید و نبض رادیال کند و کم‌دامنه، تابلوی تنگی آئورت است. با کلسیفیه شدن لت‌ها، صدای بسته شدن آئورت ضعیف و سوفل خشن به کاروتید منتشر می‌شود و نبض، کند و کم‌ارتفاع می‌شود. صدای جهشی از باز شدن لت‌های هنوز متحرک و صدای چهارم از سفت شدن بطن است.",
        "interpretation_en": "A 60-year-old with exertional dyspnea and fatigue, normal S1, diminished aortic S2, ejection sound after S1 and S4, with ejection systolic murmur at aortic area radiating to carotids and slow low-amplitude radial pulse fits aortic stenosis. Calcified leaflets soften aortic closure, create harsh murmur to carotids and slow low pulse. Ejection sound from still-mobile leaflets and S4 from stiff ventricle.",
        "reasons_fa": [
            "دلیل رد گزینه: نبض جهنده در نارسایی آئورت دیده می‌شود نه تنگی شدید.",
            "دلیل رد گزینه: نبض دو قله‌ای دی‌کروتیک الگوی تنگی آئورت نیست.",
            "دلیل رد گزینه: نبض متناوب در نارسایی شدید بطن است نه تنگی آئورت.",
            "گزینه صحیح: نبض کند و کم‌دامنه با خیز آهسته ویژگی تنگی شدید آئورت است."
        ],
        "reasons_en": [
            "Why incorrect: Bounding pulse is seen in aortic regurgitation, not severe stenosis.",
            "Why incorrect: Dicrotic double pulse is not the pattern of aortic stenosis.",
            "Why incorrect: Pulsus alternans is in severe ventricular failure, not aortic stenosis.",
            "Correct: Slow low-amplitude pulse with delayed rise characterizes severe aortic stenosis."
        ],
        "lead_fa": "سوفل آئورت به کاروتید + صدای دوم ضعیف + نبض کند یعنی تنگی شدید آئورت.",
        "lead_en": "Aortic murmur to carotids + soft second sound + slow pulse means severe aortic stenosis.",
        "golden_fa": "شدت سوفل ملاک شدت تنگی نیست؛ اکو قضاوت می‌کند.",
        "golden_en": "Murmur grade is not severity; echo judges.",
        "points_fa": [
            "سه علامت خطر: آنژین، سنکوپ فعالیتی و تنگی‌نفس.",
            "اکو با سرعت جت و گرادیان میانگین شدت را می‌سنجد.",
            "نبض کند را از نبض جهنده افتراق بده.",
            "در علامت‌دار شدید، تعویض دریچه پیش‌آگهی را عوض می‌کند."
        ],
        "points_en": [
            "Danger triad: angina, exertional syncope, dyspnea.",
            "Echo grades with jet velocity and mean gradient.",
            "Distinguish slow pulse from bounding pulse.",
            "In severe symptomatic, valve replacement changes prognosis."
        ],
        "hint_fa": "دریچه سفت چگونه نبض را کند می‌کند؟",
        "hint_en": "How does a stiff valve slow the pulse?",
        "attending_fa": "استاد: نبض را لمس کن؛ کندی خبر از تنگی می‌دهد.",
        "attending_en": "Attending: Feel the pulse; slowness tells stenosis."
    },
    (1,33): {
        "interpretation_fa": "بیمار با ادم اندام تحتانی، آسیت و هپاتومگالی و یافته‌های سمع شامل سوفل هولوسیستولیک سه ششم، صدای سوم و چهارم و تغییرات صدای دوم، نارسایی دریچه سه‌لتی را مطرح می‌کند. در نارسایی شدید سه‌لتی، برگشت سیستولیک خون به دهلیز موج بزرگ سیستولیک در ورید ژوگولر می‌سازد که به‌صورت موج سی‌وی دیده می‌شود و گاهی کبد با هر ضربان بزرگ می‌شود. موج ای از انقباض دهلیز است و در فیبریلاسیون دهلیزی حذف می‌شود.",
        "interpretation_en": "A patient with leg edema, ascites and hepatomegaly and auscultation of holosystolic murmur grade 3/6, S3 and S4 with second sound changes suggests tricuspid regurgitation. In severe TR, systolic backflow to atrium creates a large systolic jugular wave seen as CV wave, sometimes with systolic liver pulsation. A wave reflects atrial contraction and is lost in atrial fibrillation.",
        "reasons_fa": [
            "دلیل رد گزینه: کاهش موج ای در فیبریلاسیون دهلیزی است نه TR.",
            "گزینه صحیح: موج سی‌وی بزرگ از ادغام موج سی و وی در برگشت سیستولیک شدید سه‌لتی است.",
            "دلیل رد گزینه: برجسته شدن موج سی به تنهایی توصیف TR شدید نیست.",
            "دلیل رد گزینه: کاهش موج وای یافته اصلی TR نیست."
        ],
        "reasons_en": [
            "Why incorrect: Diminished a wave is in atrial fibrillation, not TR.",
            "Correct: Large CV wave from merged c and v in severe systolic TR.",
            "Why incorrect: Prominent c wave alone does not describe severe TR.",
            "Why incorrect: Diminished y wave is not the main TR finding."
        ],
        "lead_fa": "سوفل هولوسیستولیک چپ استرنوم + کبد بزرگ + موج سی‌وی یعنی نارسایی سه‌لتی شدید.",
        "lead_en": "Left sternal holosystolic murmur + enlarged liver + CV wave means severe TR.",
        "golden_fa": "ورید ژوگولر را در TR با دقت ببین؛ موج سیستولیک بزرگ را از دست نده.",
        "golden_en": "Inspect jugular in TR carefully; don't miss the large systolic wave.",
        "points_fa": [
            "موج ای از دهلیز، موج وی از پرشدن دهلیز در سیستول است.",
            "در TR کبد با نبض سیستولیک بزرگ می‌شود.",
            "فیبریلاسیون دهلیزی موج ای را پاک می‌کند.",
            "اکو شدت نارسایی و فشار ریوی را می‌سنجد."
        ],
        "points_en": [
            "A wave from atrium, v wave from atrial filling in systole.",
            "In TR liver pulsates systolically.",
            "AF abolishes a wave.",
            "Echo grades regurgitation and pulmonary pressure."
        ],
        "hint_fa": "وقتی خون به عقب برمی‌گردد، کدام موج وریدی بزرگ می‌شود؟",
        "hint_en": "When blood regurgitates, which venous wave enlarges?",
        "attending_fa": "استاد: گردن را ببین؛ موج بزرگ سیستولیک TR را لو می‌دهد.",
        "attending_en": "Attending: Look at the neck; large systolic wave betrays TR."
    },
    (1,34): {
        "interpretation_fa": "مرد ۲۶ ساله بدون بیماری قلبی قبلی با تپش و سنکوپ و نیاز به احیا و شوک، و نوار پس از ریتم سینوسی طبیعی با طرح بلوک شاخه راست و بالارفتن قطعه اس‌تی در لیدهای وی یک تا سه، سندرم بروگادا را مطرح می‌کند. بروگادا اختلال کانال سدیم ارثی است که در قلب ساختاری طبیعی، خطر تپش بطنی و فیبریلاسیون را بالا می‌برد. تب و برخی داروها الگو را آشکار می‌کنند. درمان فرد پرخطر یا نجات‌یافته، کاشت دفیبریلاتور داخلی است.",
        "interpretation_en": "A 26-year-old without prior heart disease with palpitation and syncope requiring CPR and shock, and post-conversion sinus rhythm with RBBB pattern and ST elevation in V1-3 suggests Brugada syndrome. Brugada is an inherited sodium channel disorder that in structurally normal heart raises VT/VF risk. Fever and certain drugs unmask the pattern. High-risk or survivor therapy is implantable defibrillator.",
        "reasons_fa": [
            "گزینه صحیح: الگوی شبه بلوک راست با بالا رفتن اس‌تی در وی یک تا سه و سنکوپ بطنی، بروگادا را مطرح می‌کند.",
            "دلیل رد گزینه: کاردیومیوپاتی آریتموژنیک بطن راست بیشتر با موج اپسیلون و درگیری ساختاری است.",
            "دلیل رد گزینه: هیپوکالمی موج یو و اس‌تی افتاده می‌دهد نه الگوی بروگادا.",
            "دلیل رد گزینه: انفارکتوس با بالا رفتن اس‌تی موضعی و الگوی تکاملی است نه طرح بروگادا."
        ],
        "reasons_en": [
            "Correct: RBBB-like pattern with ST elevation V1-3 and ventricular syncope suggests Brugada.",
            "Why incorrect: ARVC more with epsilon wave and structural involvement.",
            "Why incorrect: Hypokalemia gives U wave and ST depression, not Brugada pattern.",
            "Why incorrect: Infarction has territorial ST elevation with evolutionary pattern, not Brugada pattern."
        ],
        "lead_fa": "سنکوپ بطنی + قلب طبیعی + اس‌تی بالا در وی یک تا سه یعنی بروگادا تا خلافش ثابت شود.",
        "lead_en": "Ventricular syncope + normal heart + ST elevation V1-3 means Brugada until proven otherwise.",
        "golden_fa": "تب را در بروگادا سریع پایین بیاور و داروهای محرک را قطع کن.",
        "golden_en": "Lower fever quickly in Brugada and stop provoking drugs.",
        "points_fa": [
            "الگوی نوع یک با اس‌تی گنبدی‌شکل تشخیصی‌تر است.",
            "سابقه خانوادگی مرگ ناگهانی را بپرس.",
            "اکو معمولاً طبیعی است؛ ام‌آرآی برای رد آریتموژنیک کمک می‌کند.",
            "نجات‌یافته از ایست قلبی کاندید دفیبریلاتور است."
        ],
        "points_en": [
            "Type 1 coved ST pattern is most diagnostic.",
            "Ask family history of sudden death.",
            "Echo usually normal; MRI helps exclude ARVC.",
            "Survivor of cardiac arrest is ICD candidate."
        ],
        "hint_fa": "کدام اختلال کانالی در قلب سالم، اس‌تی وی یک تا سه را بالا می‌برد؟",
        "hint_en": "Which channel disorder in a healthy heart elevates ST V1-3?",
        "attending_fa": "استاد: بروگادا را با تب بیدار نکن؛ تب را خاموش کن.",
        "attending_en": "Attending: Don't awaken Brugada with fever; extinguish fever."
    },
    (1,35): {
        "interpretation_fa": "زن ۵۷ ساله دیابتی با درد شدید قفسه سینه، برادی‌کاردی سینوسی، بالا رفتن پنج میلی‌متری اس‌تی در لیدهای تحتانی و افت چهار میلی‌متری در وی یک و دو، همراه با برجستگی ورید ژوگولر و هپاتومگالی دردناک، انفارکتوس تحتانی همراه با درگیری بطن راست را مطرح می‌کند. انفارکتوس بطن راست معمولاً با انسداد شریان کرونری راست نزدیک منشا همراه است و سه‌گانه افت فشار، ورید ژوگولر بالا و ریه‌های پاک دارد. بطن راست به پیش‌بار وابسته است و نیترات و دیورتیک فشار را بدتر می‌کند.",
        "interpretation_en": "A 57-year-old diabetic woman with severe chest pain, sinus bradycardia, 5 mm ST elevation inferiorly and 4 mm depression in V1-2, with jugular distension and tender hepatomegaly suggests inferior infarction with right ventricular involvement. RV infarction usually accompanies proximal right coronary occlusion with triad of hypotension, high jugular pressure and clear lungs. RV is preload-dependent; nitrates and diuretics worsen pressure.",
        "reasons_fa": [
            "دلیل رد گزینه: انفارکتوس تحتانی به تنهایی هپاتومگالی دردناک و ورید برجسته را توضیح نمی‌دهد.",
            "گزینه صحیح: انفارکتوس تحتانی همراه نارسایی بطن راست سه‌گانه افت فشار، ورید بالا و ریه پاک می‌دهد.",
            "دلیل رد گزینه: انفارکتوس قدامی اس‌تی بالا در لیدهای سینه‌ای می‌دهد نه تحتانی خالص.",
            "دلیل رد گزینه: آمبولی ریه تپش و تنگی‌نفس با اس‌تی تحتانی پایدار نمی‌دهد."
        ],
        "reasons_en": [
            "Why incorrect: Inferior infarction alone does not explain tender hepatomegaly and high jugular.",
            "Correct: Inferior plus RV failure gives triad hypotension, high jugular, clear lungs.",
            "Why incorrect: Anterior infarction gives chest lead ST elevation, not pure inferior.",
            "Why incorrect: Pulmonary embolism gives tachycardia/dyspnea without fixed inferior ST."
        ],
        "lead_fa": "تحتانی با ورید برجسته + کبد دردناک + افت فشار یعنی بطن راست درگیر است.",
        "lead_en": "Inferior with high jugular + tender liver + hypotension means RV involved.",
        "golden_fa": "در انفارکتوس بطن راست، نیترات و دیورتیک را نگه دار و مایع محتاط بده.",
        "golden_en": "In RV infarction, hold nitrates/diuretics and give cautious fluids.",
        "points_fa": [
            "لید وی چهار راست به تشخیص کمک می‌کند.",
            "ریه‌های پاک در برابر ادم ریه، سرنخ افتراق است.",
            "برادی‌کاردی از درگیری گره دهلیزی بطنی است.",
            "اکو حرکت دیواره بطن راست را نشان می‌دهد."
        ],
        "points_en": [
            "Lead V4R helps diagnosis.",
            "Clear lungs vs pulmonary edema is a distinguishing clue.",
            "Bradycardia from AV nodal involvement.",
            "Echo shows RV wall motion."
        ],
        "hint_fa": "وقتی ورید بالا و ریه پاک است، کدام بطن نارساست؟",
        "hint_en": "When jugular is high and lungs clear, which ventricle fails?",
        "attending_fa": "استاد: در تحتانی با افت فشار، گردن را ببین و نیترو را نگه دار.",
        "attending_en": "Attending: In inferior with hypotension, look at neck and hold nitro."
    },
    (1,36): {
        "interpretation_fa": "در سکته حاد قلبی بدون علائم همودینامیک، بازکردن سریع رگ، ضدپلاکتی و آنتی‌کوآگولانت مناسب و استاتین پرقدرت پیش‌آگهی را بهتر می‌کند. اکسیژن فقط در هیپوکسمی، دیسترس یا شوک سود دارد و در اشباع طبیعی فایده پیش‌آگهی ثابت‌شده ندارد. آسپیرین، کلوپیدوگرل و هپارین هر کدام در اندیکاسیون خود نقش دارند.",
        "interpretation_en": "In acute myocardial infarction without hemodynamic compromise, rapid reperfusion, antiplatelet and appropriate anticoagulation plus high-intensity statin improve prognosis. Oxygen helps only in hypoxemia, distress or shock and has no proven prognostic benefit with normal saturation. Aspirin, clopidogrel and heparin each have roles when indicated.",
        "reasons_fa": [
            "دلیل رد گزینه: آسپیرین مرگ و عود را کم می‌کند.",
            "دلیل رد گزینه: کلوپیدوگرل در کنار آسپیرین حوادث را کم می‌کند.",
            "گزینه صحیح: اکسیژن در اشباع طبیعی پیش‌آگهی را تغییر نمی‌دهد و روتین توصیه نمی‌شود.",
            "دلیل رد گزینه: هپارین در باز کردن رگ و پیشگیری از لخته نقش دارد."
        ],
        "reasons_en": [
            "Why incorrect: Aspirin reduces death and recurrence.",
            "Why incorrect: Clopidogrel with aspirin reduces events.",
            "Correct: Oxygen with normal saturation does not change prognosis and is not routine.",
            "Why incorrect: Heparin helps vessel patency and clot prevention."
        ],
        "lead_fa": "اکسیژن را فقط در هیپوکسمی بده؛ در اشباع طبیعی روتین نیست.",
        "lead_en": "Give oxygen only in hypoxemia; not routine with normal saturation.",
        "golden_fa": "در انفارکتوس پایدار، اکسیژن اضافی فایده پیش‌آگهی ندارد.",
        "golden_en": "In stable infarction, extra oxygen has no prognostic benefit.",
        "points_fa": [
            "اشباع را پایش کن؛ بالای ۹۴ کافی است.",
            "اکسیژن زیاد عروق کرونری را تنگ می‌کند.",
            "ضدپلاکتی را زود شروع کن.",
            "بتابلوکر در نارسایی حاد ممنوع است."
        ],
        "points_en": [
            "Monitor saturation; >94 is enough.",
            "Excess oxygen constricts coronary vessels.",
            "Start antiplatelet early.",
            "Beta-blocker contraindicated in acute failure."
        ],
        "hint_fa": "کدام درمان فقط وقتی هوا کم است کمک می‌کند؟",
        "hint_en": "Which therapy helps only when air is low?",
        "attending_fa": "استاد: اکسیژن را با پالس اکسیمتر تجویز کن نه با عادت.",
        "attending_en": "Attending: Prescribe oxygen by oximeter, not habit."
    },
    (1,37): {
        "interpretation_fa": "مرد ۶۰ ساله دیابتی با فشار بالا ولی بدون سردرد، درد قفسه سینه، تنگی‌نفس یا یافته عصبی و آزمایش‌های طبیعی، فشار شدید بدون آسیب حاد اندام است. چنین حالتی اورژانس فشار نیست و با استراحت در اتاق آرام، بررسی داروها و کاهش تدریجی خوراکی کنترل می‌شود. انفوزیون وریدی سریع مانند نیتروگلیسیرین با دوز بالا در این شرایط نامناسب است و برای اورژانس با آسیب اندام نگه داشته می‌شود.",
        "interpretation_en": "A 60-year-old diabetic with high pressure but no headache, chest pain, dyspnea or neurologic findings and normal labs has severe hypertension without acute organ damage. This is not hypertensive emergency and is managed with quiet rest, medication review and gradual oral lowering. Rapid IV infusion such as high-dose nitroglycerin is inappropriate here and reserved for emergency with organ injury.",
        "reasons_fa": [
            "دلیل رد گزینه: استراحت در اتاق آرام و تکرار فشار در فوریت بدون آسیب منطقی است.",
            "دلیل رد گزینه: دوز کم خوراکی کاپتوپریل با پایش در فوریت قابل قبول است.",
            "دلیل رد گزینه: آوردن داروهای قبلی و دادن به موقع در فوریت توصیه می‌شود.",
            "گزینه صحیح: انفوزیون نیتروگلیسیرین با دوز بالا در فشار شدید بدون آسیب اندام نامناسب است."
        ],
        "reasons_en": [
            "Why incorrect: Quiet rest and repeat BP in urgency without damage is reasonable.",
            "Why incorrect: Low oral captopril dose with monitoring is acceptable in urgency.",
            "Why incorrect: Bringing prior meds and giving timely is recommended in urgency.",
            "Correct: High-dose nitroglycerin infusion in severe pressure without organ damage is inappropriate."
        ],
        "lead_fa": "فشار بالا بدون آسیب اندام یعنی فوریت نه اورژانس؛ وریدی پرشتاب نده.",
        "lead_en": "High pressure without organ damage means urgency not emergency; no rapid IV.",
        "golden_fa": "اورژانس را با آسیب اندام بشناس؛ بدون آن، خوراکی و آرام پیش برو.",
        "golden_en": "Recognize emergency by organ damage; without it, go oral and calm.",
        "points_fa": [
            "آسیب اندام: مغز، قلب، کلیه، ریه و آئورت را چک کن.",
            "کاهش سریع فشار در فوریت خطر ایسکمی دارد.",
            "داروهای قبلی را مرور کن؛ قطع ناگهانی بتا خطر دارد.",
            "پیگیری سرپایی نزدیک لازم است."
        ],
        "points_en": [
            "Organ damage: check brain, heart, kidney, lungs, aorta.",
            "Rapid drop in urgency risks ischemia.",
            "Review prior meds; abrupt beta stop is risky.",
            "Close outpatient follow-up needed."
        ],
        "hint_fa": "بدون آسیب اندام، کدام راه خوراکی است نه وریدی؟",
        "hint_en": "Without organ damage, which route is oral not IV?",
        "attending_fa": "استاد: فشار بدون زخم اندام را با عجله وریدی نسوزان.",
        "attending_en": "Attending: Don't burn non-injured pressure with hasty IV."
    },
    (1,38): {
        "interpretation_fa": "جوانی که حین فوتبال ناگهان فوت کرده و کالبدشکافی ضخامت شدید عضله قلب بدون درگیری دریچه را نشان داده، کاردیومیوپاتی هیپرتروفیک را مطرح می‌کند. این بیماری اغلب ارثی با الگوی اتوزوم غالب است و خویشاوندان درجه یک در خطر هستند. یافته‌ها می‌تواند نامتقارن و همراه با انسداد دینامیک و سنکوپ باشد. غربالگری خانواده با نوار قلب و اکوکاردیوگرافی و در صورت امکان بررسی ژنتیک توصیه می‌شود.",
        "interpretation_en": "A young person with sudden death during football and autopsy showing severe myocardial thickening without valve disease suggests hypertrophic cardiomyopathy. Often autosomal dominant, first-degree relatives are at risk. Findings can be asymmetric with dynamic obstruction and syncope. Family screening with ECG and echo and, when possible, genetic testing is recommended.",
        "reasons_fa": [
            "دلیل رد گزینه: شیوع کم نیست و غربالگری لازم است.",
            "دلیل رد گزینه: بتابلاکر برای همه خانواده بدون بررسی اندیکاسیون ندارد.",
            "دلیل رد گزینه: تست ورزش به تنهایی غربالگری خانواده نیست.",
            "گزینه صحیح: خویشاوندان درجه یک نیاز به اکوکاردیوگرافی و نوار قلب دارند."
        ],
        "reasons_en": [
            "Why incorrect: Not rare and screening is needed.",
            "Why incorrect: Beta-blocker for all family without evaluation is not indicated.",
            "Why incorrect: Exercise test alone is not family screening.",
            "Correct: First-degree relatives need echo and ECG."
        ],
        "lead_fa": "مرگ ناگهانی جوان ورزشکار + قلب ضخیم یعنی هیپرتروفیک ارثی؛ خانواده را غربال کن.",
        "lead_en": "Young athlete sudden death + thick heart means heritable HCM; screen family.",
        "golden_fa": "اکو و نوار قلب خانواده را به موقع بگیر.",
        "golden_en": "Get family ECG and echo timely.",
        "points_fa": [
            "وراثت غالب؛ هر فرزند ۵۰ درصد خطر.",
            "سوفل با مانور والسالوا بیشتر می‌شود.",
            "از دیورتیک و نیترات بی‌مورد پرهیز کن.",
            "در پرخطر، دفیبریلاتور قابل کاشت مطرح است."
        ],
        "points_en": [
            "Autosomal dominant; each child 50% risk.",
            "Murmur augments with Valsalva.",
            "Avoid unwarranted diuretic and nitrate.",
            "In high-risk, ICD is considered."
        ],
        "hint_fa": "وقتی قلب ضخیم ارثی است، چه کسی را باید چک کرد؟",
        "hint_en": "When thick heart is heritable, who should be checked?",
        "attending_fa": "استاد: مرگ جوان ورزشکار را خانوادگی ببین.",
        "attending_en": "Attending: View young athlete death as familial."
    },
    (1,39): {
        "interpretation_fa": "زن ۵۰ ساله با نارسایی قلبی یک ساله، نوار قلب با هیپرتروفی بطن چپ بدون ایسکمی، داروهای هیدروکلروتیازید و لیزینوپریل، ضربان ۸۵، بدون ورید برجسته و ادم، و صدای چهارم، قلب با کسر جهشی کاهش‌یافته را مطرح می‌کند. چهار ستون کاهش مرگ شامل مهار رنین آنژیوتانسین، مسدودکننده بتا مبتنی بر شواهد، آنتاگونیست آلدوسترون و مهارکننده هم‌انتقال سدیم گلوکز هستند. کارودیلول در این گروه بقا را بهتر می‌کند و انتخاب مناسب است.",
        "interpretation_en": "A 50-year-old woman with one-year heart failure, ECG LVH without ischemia, on HCTZ and lisinopril, HR 85, no jugular distension or edema, with S4 suggests reduced ejection fraction. Four mortality-reducing pillars are renin-angiotensin blockade, evidence-based beta-blocker, aldosterone antagonist and sodium-glucose transporter inhibitor. Carvedilol in this group improves survival and is the suitable choice.",
        "reasons_fa": [
            "دلیل رد گزینه: لوزارتان جایگزین لیزینوپریل است نه افزودنی همزمان.",
            "دلیل رد گزینه: دیلتیازم در نارسایی با کسر کاهش‌یافته مناسب نیست.",
            "گزینه صحیح: کارودیلول مسدودکننده بتا مبتنی بر شواهد بقا را بهتر می‌کند.",
            "دلیل رد گزینه: دیگوکسین بستری را کم ولی مرگ را کم نمی‌کند."
        ],
        "reasons_en": [
            "Why incorrect: Losartan substitutes lisinopril, not add-on together.",
            "Why incorrect: Diltiazem is unsuitable in reduced ejection failure.",
            "Correct: Carvedilol evidence-based beta-blocker improves survival.",
            "Why incorrect: Digoxin reduces hospitalization not death."
        ],
        "lead_fa": "نارسایی با کسر کم نیاز به چهار ستون دارد؛ مسدودکننده بتا رکن دوم است.",
        "lead_en": "Reduced EF failure needs four pillars; beta-blocker is second pillar.",
        "golden_fa": "کارودیلول یا متوپرولول سوکسینات یا بیزوپرولول را انتخاب کن.",
        "golden_en": "Choose carvedilol or metoprolol succinate or bisoprolol.",
        "points_fa": [
            "دیورتیک تیازیدی به تنهایی ستون نیست.",
            "مهارکننده سدیم گلوکز بستری را هم کم می‌کند.",
            "ضربان ۸۵ هدف کاهش تدریجی دارد.",
            "پتاسیم و کلیه را با مهار رنین پایش کن."
        ],
        "points_en": [
            "Thiazide alone is not a pillar.",
            "SGLT2 inhibitor also reduces hospitalization.",
            "HR 85 aims for gradual reduction.",
            "Monitor potassium and kidney with renin blockade."
        ],
        "hint_fa": "کدام دارو از چهار ستون، ضربان را هم کم می‌کند؟",
        "hint_en": "Which of the four pillars also lowers heart rate?",
        "attending_fa": "استاد: در نارسایی کم‌کسر، بتا را فراموش نکن.",
        "attending_en": "Attending: In reduced EF, don't forget beta-blocker."
    },
    (1,40): {
        "interpretation_fa": "زن باردار با فشار ۱۵۰ روی ۱۰۰ و تکرار ۱۵۰ روی ۱۰۵، پرفشاری در بارداری دارد. متیل‌دوپا از داروهای با سابقه ایمنی طولانی در بارداری است. مهارکننده آنزیم مبدل و مسدودکننده گیرنده آنژیوتانسین به علت آسیب جنینی و کلیه جنین ممنوع هستند. آتنولول با خطر وزن کم هنگام تولد همراه است و انتخاب اول نیست.",
        "interpretation_en": "A pregnant woman with 150/100 and repeat 150/105 has hypertension in pregnancy. Methyldopa has long safety history in pregnancy. ACE inhibitors and ARBs are contraindicated due to fetal renal injury. Atenolol is linked to low birth weight and is not first choice.",
        "reasons_fa": [
            "دلیل رد گزینه: کاپتوپریل در بارداری ممنوع است.",
            "دلیل رد گزینه: آتنولول به دلیل وزن کم جنین انتخاب اول نیست.",
            "دلیل رد گزینه: لوزارتان در بارداری ممنوع است.",
            "گزینه صحیح: متیل‌دوپا در بارداری ایمن و توصیه می‌شود."
        ],
        "reasons_en": [
            "Why incorrect: Captopril contraindicated in pregnancy.",
            "Why incorrect: Atenolol not first choice due to low birth weight.",
            "Why incorrect: Losartan contraindicated in pregnancy.",
            "Correct: Methyldopa is safe and recommended in pregnancy."
        ],
        "lead_fa": "در بارداری متیل‌دوپا بده؛ مهارکننده آنزیم مبدل و مسدود گیرنده را نده.",
        "lead_en": "In pregnancy give methyldopa; avoid ACE inhibitor and ARB.",
        "golden_fa": "فشار بارداری را زود کنترل کن و پره‌اکلامپسی را رد کن.",
        "golden_en": "Control pregnancy pressure early and rule out preeclampsia.",
        "points_fa": [
            "لابتالول و نیفدیپین هم گزینه‌های بارداری هستند.",
            "مهارکننده‌ها در سه‌ماهه اول هم ممنوعند.",
            "پروتئین ادرار و علائم هشدار را چک کن.",
            "پس از زایمان دارو را بازنگری کن."
        ],
        "points_en": [
            "Labetalol and nifedipine are also pregnancy options.",
            "Inhibitors are contraindicated even in first trimester.",
            "Check urine protein and warning signs.",
            "Reassess drugs after delivery."
        ],
        "hint_fa": "کدام فشاردهنده قدیمی در بارداری بی‌خطرتر است؟",
        "hint_en": "Which old antihypertensive is safest in pregnancy?",
        "attending_fa": "استاد: باردار را با مهارکننده نسوزان.",
        "attending_en": "Attending: Don't burn the pregnant with inhibitor."
    },
    (1,41): {
        "interpretation_fa": "مرد ۴۲ ساله با درد ناگهانی شدید قفسه سینه منتشر به بین کتف‌ها، فشار ۱۸۰ روی ۷۰ و نبض‌های غیرقابل لمس، دیسکسیون آئورت را مطرح می‌کند. دیسکسیون با پارگی لایه داخلی و پیشروی خون در دیواره، درد پاره‌کننده، اختلاف فشار و نبض و پهن شدن مدیاستن می‌دهد. آئورت دولتی مادرزادی همراهی شایع با دیسکسیون و بیماری آئورت است و در اکو بیشتر دیده می‌شود.",
        "interpretation_en": "A 42-year-old with sudden severe chest pain radiating between scapulae, BP 180/70 and impalpable pulses suggests aortic dissection. Dissection from intimal tear with blood tracking in wall gives tearing pain, pressure/pulse discrepancy and widened mediastinum. Bicuspid aorta is a common association with dissection and aortic disease and is more often seen on echo.",
        "reasons_fa": [
            "دلیل رد گزینه: تنگی روماتیسمال میترال همراهی شایع دیسکسیون نیست.",
            "دلیل رد گزینه: آندوکاردیت سه‌لتی ارتباطی با دیسکسیون ندارد.",
            "دلیل رد گزینه: هیپرتروفیک انسدادی همراهی دیسکسیون نیست.",
            "گزینه صحیح: آئورت دولتی مادرزادی همراهی محتمل با دیسکسیون است."
        ],
        "reasons_en": [
            "Why incorrect: Rheumatic mitral stenosis is not a common dissection association.",
            "Why incorrect: Tricuspid endocarditis is unrelated to dissection.",
            "Why incorrect: Obstructive HCM is not a dissection association.",
            "Correct: Bicuspid aorta is a likely association with dissection."
        ],
        "lead_fa": "درد پاره‌کننده بین کتف + اختلاف نبض یعنی دیسکسیون تا خلافش ثابت شود.",
        "lead_en": "Tearing pain between scapulae + pulse discrepancy means dissection until proven otherwise.",
        "golden_fa": "فشار و ضربان را سریع با مسدودکننده بتا کنترل کن و تصویر فوری بگیر.",
        "golden_en": "Quickly control pressure and rate with beta-blocker and get urgent imaging.",
        "points_fa": [
            "نوع صعودی نیاز جراحی فوری دارد.",
            "نارسایی آئورت حاد و تامپوناد عوارض خطرناک هستند.",
            "سی‌تی آنژیو تشخیص را سریع می‌دهد.",
            "سابقه فشار بالا و اختلال بافت همبند را بپرس."
        ],
        "points_en": [
            "Ascending type needs urgent surgery.",
            "Acute AR and tamponade are dangerous complications.",
            "CT angiography gives rapid diagnosis.",
            "Ask history of hypertension and connective tissue disease."
        ],
        "hint_fa": "کدام دریچه مادرزادی آئورت را ضعیف می‌کند؟",
        "hint_en": "Which congenital valve weakens the aorta?",
        "attending_fa": "استاد: درد بین کتف را آئورتی ببین.",
        "attending_en": "Attending: View interscapular pain as aortic."
    },
    (1,42): {
        "interpretation_fa": "زن ۲۴ ساله با سنکوپ و سوفل سیستولیک درجه چهار و تشخیص هیپرتروفیک انسدادی، انسداد دینامیک مسیر خروجی بطن چپ دارد. در این بیماری کاهش حجم بطن یا افزایش انقباضی سوفل را بلندتر می‌کند و افزایش حجم یا کاهش انقباض آن را کم می‌کند. مسدودکننده بتا با کم کردن انقباض و ضربان، انسداد و سوفل را کاهش می‌دهد؛ دیورتیک، نیترات و دوبوتامین برعکس اثر دارند.",
        "interpretation_en": "A 24-year-old woman with syncope and grade 4 systolic murmur diagnosed as obstructive HCM has dynamic LV outflow obstruction. In this disease, reduced ventricular volume or increased contractility augments murmur, while increased volume or reduced contractility lessens it. Beta-blocker by reducing contractility and rate lessens obstruction and murmur; diuretic, nitrate and dobutamine do opposite.",
        "reasons_fa": [
            "گزینه صحیح: متورال با کاهش انقباض، سوفل انسدادی را کم می‌کند.",
            "دلیل رد گزینه: دیورتیک با کم کردن حجم، سوفل را بیشتر می‌کند.",
            "دلیل رد گزینه: دوبوتامین با زیاد کردن انقباض، سوفل را بیشتر می‌کند.",
            "دلیل رد گزینه: نیتروگلیسیرین با کم کردن پیش‌بار، سوفل را بیشتر می‌کند."
        ],
        "reasons_en": [
            "Correct: Metoral by reducing contractility lessens obstructive murmur.",
            "Why incorrect: Diuretic by reducing volume augments murmur.",
            "Why incorrect: Dobutamine by increasing contractility augments murmur.",
            "Why incorrect: Nitroglycerin by reducing preload augments murmur."
        ],
        "lead_fa": "سوفل هیپرتروفیک انسدادی با والسالوا بلند و با چمباتمه کم می‌شود؛ بتا آن را کم می‌کند.",
        "lead_en": "HCM murmur augments with Valsalva and lessens with squatting; beta lessens it.",
        "golden_fa": "در سنکوپ هیپرتروفیک، از نیترات و دیورتیک بی‌مورد پرهیز کن.",
        "golden_en": "In HCM syncope, avoid unwarranted nitrate and diuretic.",
        "points_fa": [
            "اکو ضخامت و گرادیان را می‌سنجد.",
            "ورزش سنگین رقابتی در انسدادی پرهیز دارد.",
            "سابقه خانوادگی مرگ ناگهانی را بپرس.",
            "در مقاوم، کاهش سپتوم مطرح است."
        ],
        "points_en": [
            "Echo measures thickness and gradient.",
            "Avoid competitive strenuous exercise in obstructive.",
            "Ask family history of sudden death.",
            "In refractory, septal reduction is considered."
        ],
        "hint_fa": "کدام دارو قدرت تپش را کم و سوفل را آرام می‌کند؟",
        "hint_en": "Which drug lowers contractile power and calms the murmur?",
        "attending_fa": "استاد: هیپرتروفیک را با بتا آرام کن نه با نیترات.",
        "attending_en": "Attending: Calm HCM with beta, not nitrate."
    },
    (1,43): {
        "interpretation_fa": "موج‌های ورید ژوگولر بازتاب فشار دهلیز راست در طول چرخه قلب هستند. موج ای از انقباض دهلیز در دیاستول انتهایی می‌آید، موج سی از برجسته شدن دریچه سه‌لتی به داخل دهلیز در آغاز سیستول و موج وی از پر شدن دهلیز هنگام بسته بودن دریچه در سیستول بطنی ایجاد می‌شود. پس از هر موج یک فرورفتگی می‌آید: ایکس از پایین کشیده شدن کف دهلیز در سیستول و وای از باز شدن دریچه سه‌لتی و تخلیه خون به بطن در دیاستول. درک این توالی کمک می‌کند نارسایی سه‌لتی را با موج سی‌وی بزرگ و فیبریلاسیون را با حذف موج ای بشناسی و فشار وریدی را درست تفسیر کنی.",
        "interpretation_en": "Jugular venous waves reflect right atrial pressure through the cycle. A wave comes from atrial contraction in late diastole, c wave from tricuspid bulging into atrium at early systole, and v wave from atrial filling while the valve is closed during ventricular systole. Each wave is followed by a descent: x from systolic descent of the atrial floor and y from tricuspid opening and emptying into the ventricle in diastole. Knowing this sequence helps recognize TR with large CV wave and AF with lost a wave and interpret venous pressure correctly.",
        "reasons_fa": [
            "دلیل رد گزینه: انقباض دهلیزی موج ای می‌سازد نه وی.",
            "دلیل رد گزینه: افزایش فشار دهلیزی توصیف وی نیست.",
            "گزینه صحیح: پر شدن دهلیزی در سیستول بطنی موج وی را می‌سازد.",
            "دلیل رد گزینه: سیستول ایزوولومیک موج وی نیست."
        ],
        "reasons_en": [
            "Why incorrect: Atrial contraction makes a wave, not v.",
            "Why incorrect: Raised atrial pressure does not describe v.",
            "Correct: Atrial filling during ventricular systole creates v wave.",
            "Why incorrect: Isovolumetric systole is not v wave."
        ],
        "lead_fa": "وی از پر شدن دهلیز در سیستول می‌آید.",
        "lead_en": "V comes from atrial filling in systole.",
        "golden_fa": "امواج وریدی را با سیستول و دیاستول زمان‌بندی کن.",
        "golden_en": "Time venous waves with systole and diastole.",
        "points_fa": [
            "موج ای در فیبریلاسیون حذف می‌شود.",
            "موج سی کوچک و زودگذر است.",
            "در نارسایی سه‌لتی موج سی‌وی بزرگ می‌شود.",
            "نزول وای از باز شدن سه‌لتی است."
        ],
        "points_en": [
            "A wave lost in fibrillation.",
            "C wave small and brief.",
            "In TR, CV wave enlarges.",
            "Y descent from tricuspid opening."
        ],
        "hint_fa": "وقتی دریچه سه‌لتی بسته است، خون کجا جمع می‌شود؟",
        "hint_en": "When tricuspid is closed, where does blood pool?",
        "attending_fa": "استاد: وی را با سیستول بخوان.",
        "attending_en": "Attending: Read v with systole."
    },
    (1,44): {
        "interpretation_fa": "مرد ۴۸ ساله سیگاری با درد پنج ساعته قفسه سینه، تعریق، فشار ۸۵ و تپش ۱۰۰ تا ۱۱۰، انفارکتوس با افت فشار دارد. بر اساس کلید رسمی این دفترچه، تجویز مسدودکننده بتا برای کاهش ایسکمی به عنوان پاسخ صحیح علامت‌گذاری شده است. از دید بالینی در افت فشار و تپش، مسدودکننده بتا با احتیاط و تنها پس از پایداری همودینامیک مطرح است و همزمان باید لیدهای راست، مایع محتاط و بازکردن رگ را هم در نظر داشت. این توضیح منطق کلید را بازگو و احتیاط بالینی را یادآور می‌شود.",
        "interpretation_en": "A 48-year-old smoker with 5-hour chest pain, sweating, BP 85 and HR 100-110 has infarction with hypotension. Per the official key, beta-blocker to reduce ischemia is marked correct. Clinically with hypotension and tachycardia, beta-blocker is cautious and only after hemodynamic stability, while right-sided leads, cautious fluids and reperfusion must also be considered. This recounts the key's logic and reminds clinical caution.",
        "reasons_fa": [
            "گزینه صحیح: بر اساس کلید رسمی، مسدودکننده بتا برای کاهش ایسکمی به عنوان اقدام صحیح علامت‌گذاری شده است.",
            "دلیل رد گزینه: نرمال سالین به تنهایی بدون ارزیابی بطن راست کافی نیست.",
            "دلیل رد گزینه: گرفتن لیدهای راست مفید است ولی به تنهایی درمان ایسکمی نیست.",
            "دلیل رد گزینه: فیبرینولیتیک در زمان مناسب مطرح است ولی کلید گزینه دیگری را انتخاب کرده است."
        ],
        "reasons_en": [
            "Correct: Per official key, beta-blocker to reduce ischemia is marked correct.",
            "Why incorrect: Normal saline alone without RV assessment is insufficient.",
            "Why incorrect: Right-sided leads are useful but not alone ischemia therapy.",
            "Why incorrect: Fibrinolytic is timely but the key selected another option."
        ],
        "lead_fa": "انفارکتوس با افت فشار نیاز به پایداری قبل از بتا دارد؛ کلید بتا را انتخاب کرده است.",
        "lead_en": "Infarction with hypotension needs stability before beta; the key selected beta.",
        "golden_fa": "در افت فشار انفارکتوس، اول پایداری سپس ضدایسکمی.",
        "golden_en": "In infarction with hypotension, stability first then anti-ischemic.",
        "points_fa": [
            "فشار ۸۵ با تپش، بتا را پرخطر می‌کند.",
            "لید وی چهار راست درگیری بطن راست را نشان می‌دهد.",
            "مایع محتاط در بطن راست وابسته به پیش‌بار کمک می‌کند.",
            "بازکردن رگ اولویت پیش‌آگهی است."
        ],
        "points_en": [
            "BP 85 with tachycardia makes beta risky.",
            "V4R shows RV involvement.",
            "Cautious fluid helps preload-dependent RV.",
            "Reperfusion is prognostic priority."
        ],
        "hint_fa": "وقتی فشار پایین است، کدام ضدایسکمی با احتیاط می‌آید؟",
        "hint_en": "When pressure is low, which anti-ischemic comes cautiously?",
        "attending_fa": "استاد: فشار پایین را اول بگیر سپس بتا را بسنج.",
        "attending_en": "Attending: Secure pressure first then weigh beta."
    },
    (1,45): {
        "interpretation_fa": "زن ۶۵ ساله با سابقه انسداد مزمن ریه و اکو با هیپرتروفی و بزرگی بطن راست و اختلال عملکرد، قلب ریوی دارد. در قلب ریوی فشار ورید ژوگولر بالا، هیو بطن راست، صدای دوم بلند ریوی، هپاتومگالی و ادم دیده می‌شود. سیانوز بیشتر بازتاب هیپوکسمی بیماری ریه است و زودتر از نارسایی راست ظاهر می‌شود. بر اساس کلید، سیانوز به عنوان علامتی که دیرتر از بقیه بروز می‌کند علامت‌گذاری شده است؛ تفسیر آموزشی یادآور می‌شود که ادم و هپاتومگالی نشانه پیشرفت نارسایی راست هستند.",
        "interpretation_en": "A 65-year-old woman with COPD and echo RV hypertrophy/enlargement and dysfunction has cor pulmonale. In cor pulmonale, high jugular pressure, RV heave, loud pulmonary S2, hepatomegaly and edema appear. Cyanosis mostly reflects lung hypoxemia and appears earlier than RV failure. Per the key, cyanosis is marked as the latest sign; educationally edema and hepatomegaly mark advanced RV failure.",
        "reasons_fa": [
            "دلیل رد گزینه: ادم محیطی از احتباس سدیم در نارسایی راست است.",
            "گزینه صحیح: بر اساس کلید رسمی، سیانوز به عنوان علامتی که دیرتر بروز می‌کند علامت‌گذاری شده است.",
            "دلیل رد گزینه: برجستگی ورید ژوگولر از فشار بالای دهلیز راست است.",
            "دلیل رد گزینه: هپاتومگالی از احتقان کبدی در نارسایی راست است."
        ],
        "reasons_en": [
            "Why incorrect: Peripheral edema from sodium retention in RV failure.",
            "Correct: Per key, cyanosis is marked as the latest-appearing sign.",
            "Why incorrect: Jugular distension from high right atrial pressure.",
            "Why incorrect: Hepatomegaly from hepatic congestion in RV failure."
        ],
        "lead_fa": "قلب ریوی یعنی بطن راست در برابر ریه بیمار؛ ورید برجسته و کبد بزرگ نشانه پیشرفت است.",
        "lead_en": "Cor pulmonale is RV against diseased lung; high jugular and enlarged liver mark progression.",
        "golden_fa": "هیپوکسمی زمینه را درمان کن تا فشار ریوی پایین بیاید.",
        "golden_en": "Treat underlying hypoxemia to lower pulmonary pressure.",
        "points_fa": [
            "اکسیژن طولانی‌مدت در هیپوکسمی مزمن پیش‌آگهی را بهتر می‌کند.",
            "دیورتیک با احتیاط ادم را کم می‌کند.",
            "از وازودیلاتور ریوی بدون اندیکاسیون پرهیز کن.",
            "واکسن آنفلوانزا و پنوموکوک را به‌روز کن."
        ],
        "points_en": [
            "Long-term oxygen in chronic hypoxemia improves prognosis.",
            "Diuretic cautiously reduces edema.",
            "Avoid pulmonary vasodilator without indication.",
            "Keep flu and pneumococcal vaccines up to date."
        ],
        "hint_fa": "کدام رنگ پوست از ریه می‌آید نه از ورید؟",
        "hint_en": "Which skin color comes from lung not vein?",
        "attending_fa": "استاد: در قلب ریوی، ریه را درمان کن تا قلب آرام شود.",
        "attending_en": "Attending: In cor pulmonale, treat lung to calm heart."
    },
}
OPTIONS_EN_MAP3 = {
    (1,31): ['Pericardial tap', 'Dopamine', 'Fluids', 'Whole blood'],
    (1,32): ['Bounding pulse', 'Dicrotic pulse', 'Pulsus alternans', 'Parvus et tardus'],
    (1,33): ['Diminished a wave', 'CV wave', 'Prominent c wave', 'Diminished y wave'],
    (1,34): ['Brugada syndrome', 'ARVC/D', 'Hypokalemia', 'MI'],
    (1,35): ['Acute inferior infarct', 'Inferior infarct with RV failure', 'Anterior infarct', 'Pulmonary embolism'],
    (1,36): ['Aspirin', 'Clopidogrel', 'Oxygen', 'Heparin'],
    (1,37): ['Observe and recheck', 'Oral captopril 6.25 mg', 'Bring prior meds stat', 'High-dose nitro infusion'],
    (1,38): ['No action, rare disease', 'Family needs beta-blocker', 'Exercise test before sport', 'Family needs echo'],
    (1,39): ['Losartan', 'Diltiazem', 'Carvedilol', 'Digoxin'],
    (1,40): ['Captopril', 'Atenolol', 'Losartan', 'Methyldopa'],
    (1,41): ['Rheumatic mitral stenosis', 'Tricuspid endocarditis', 'Obstructive HCM', 'Bicuspid aorta'],
    (1,42): ['Metoral', 'Diuretic', 'Dobutamine', 'Nitroglycerin'],
    (1,43): ['Atrial contraction', 'Raised atrial/diastolic pressure', 'Atrial filling in ventricular systole', 'Isovolumic systole'],
    (1,44): ['Metoral to reduce ischemia', 'Normal saline', 'Right-sided leads', 'Fibrinolytic'],
    (1,45): ['Peripheral edema', 'Cyanosis', 'Distended JVP', 'Hepatomegaly'],
}
def enrich3():
    assert len(ITEMS)==15
    path = ROOT / f"tools/master-bank/import-payload.master-preint.part{PART:02}.json"
    before = json.loads(path.read_text(encoding="utf-8"))
    after = copy.deepcopy(before)
    for local, q in enumerate(after["questions"], 1):
        item = ITEMS.get((PART, local))
        if item is None:
            continue
        if not q.get("options_en") or len([o for o in q.get("options_en",[]) if str(o).strip()])<4:
            q["options_en"] = OPTIONS_EN_MAP3.get((PART, local), q.get("options_en",[]))
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
    print(f"PASS: enriched {len(ITEMS)} heart Q31-45 part{PART:02}")
if __name__=="__main__":
    enrich3()
