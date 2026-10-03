#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enrich internal heart batch2: part01 Q16-30 (QB-00016..00030)
Persian-heavy, Harrison 22e based, AMBOSS-style Socratic hints, bilingual.
"""
import copy, json, hashlib, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
PART = 1
ITEMS = {
    (1,16): {
        "interpretation_fa": "مرد ۳۰ سالهٔ سیگاری با دردِ متناوبِ قفسهٔ سینه، بالا رفتنِ گذرایِ ST و پاسخِ خوب به نیتروگلیسیرین، و آنژیوگرافیِ طبیعی، الگویِ آنژینِ وازواسپاستیک (پرینزمتال) دارد؛ هاریسون این را انقباضِ گذرایِ شدیدِ یک شریانِ اپیکاردیال می‌داند که می‌تواند رویِ عروقِ بدونِ تنگیِ ثابت یا رویِ پلاکِ آترواسکلروتیک سوار شود. دردِ پرینزمتال اغلب در استراحت، شب یا بامداد است و با رفعِ اسپاسم، ECG به حالِ طبیعی برمی‌گردد. سیگار مهم‌ترین محرکِ قابلِ اصلاح است. درمانِ پیشگیرانه بر ترکِ سیگار، آنتاگونیستِ کلسیم (مانند دیلتیازم/وراپامیل) و نیترات استوار است؛ در این دفترچه آسپیرین به عنوانِ گزینهٔ «غیرقابلِ توصیه» علامت‌گذاری شده است، در حالی که از دیدِ راهنما آسپیرینِ کم‌دوز در بسیاری از بیمارانِ کرونریِ همراه منعِ مطلق ندارد و تصمیمِ آن فردمحور است.",
        "interpretation_en": "A 30-year-old smoker with intermittent chest pain, transient ST elevation responsive to nitroglycerin and normal angiography fits vasospastic (Prinzmetal) angina — per Harrison, transient intense epicardial spasm on non-obstructive or atherosclerotic vessels. Pain often at rest/nocturnally, ECG normalizes after spasm. Smoking is the key modifiable trigger. Prevention rests on smoking cessation, calcium-channel blocker (e.g., diltiazem/verapamil) and nitrate; per this booklet's official key, aspirin is marked as 'not recommended', while guidelines note low-dose aspirin is not absolutely contraindicated and is individualized.",
        "reasons_fa": [
            "گزینه صحیح: بر اساسِ کلیدِ رسمیِ این دفترچه، «آسپیرین» به عنوانِ موردی که توصیه نمی‌شود علامت‌گذاری شده است؛ تفسیرِ آموزشی یادآور می‌شود که ستونِ پرینزمتال ترکِ سیگار و CCB/نیترات است و نقشِ آسپیرین فردمحور و اغلب همراه با ارزیابیِ ریسکِ آترواسکلروز تعیین می‌شود.",
            "دلیل رد گزینه: نیترات (خوراکی/زیرزبانی/وریدیِ کوتاه‌اثر) با شل کردنِ عضلهٔ صافِ عروقی، اسپاسم را سریع رفع می‌کند و رکنِ درمانِ حمله و پیشگیری است.",
            "دلیل رد گزینه: دیلتیازم (آنتاگونیستِ کلسیمِ غیرِ دی‌هیدروپیریدینی) با مهارِ اسپاسمِ عروقِ کرونری، دفعاتِ آنژینِ وازواسپاستیک را کم می‌کند و درمانِ نگهدارندهٔ اصلی است.",
            "دلیل رد گزینه: قطعِ سیگار مهم‌ترین اقدامِ قابلِ اصلاح برای کاهشِ اسپاسم و حوادثِ کرونری است و همیشه توصیه می‌شود."
        ],
        "reasons_en": [
            "Correct: Per the official key, 'aspirin' is marked as not recommended; educationally, the pillars are smoking cessation and CCB/nitrate, and aspirin role is individualized with atherosclerosis risk assessment.",
            "Why incorrect: Nitrate (sublingual/oral/short IV) relaxes vascular smooth muscle, rapidly relieves spasm and is a mainstay for attack and prevention.",
            "Why incorrect: Diltiazem (non-DHP CCB) suppresses coronary spasm, reduces Prinzmetal frequency and is a core maintenance therapy.",
            "Why incorrect: Smoking cessation is the top modifiable action to reduce spasm and coronary events and is always recommended."
        ],
        "lead_fa": "آنژینِ وازواسپاستیک = دردِ استراحتی + صعودِ گذرایِ ST + آنژیوگرافیِ طبیعی؛ درمانِ اصلی CCB/نیترات + ترکِ سیگار است.",
        "lead_en": "Vasospastic angina = rest pain + transient ST elevation + normal angiogram; mainstay is CCB/nitrate + smoking cessation.",
        "golden_fa": "در پرینزمتال، سیگار را قطع و CCB/نیترات را شروع کن؛ آسپیرین را فردمحور بسنج، نه روتینِ مطلق.",
        "golden_en": "In Prinzmetal, stop smoking and start CCB/nitrate; judge aspirin individually, not as absolute routine.",
        "points_fa": [
            "اسپاسم اغلب شبانه/سحرگاهی است؛ ثبتِ ECGِ حمله، تشخیص را قطعی می‌کند.",
            "محرک‌ها: سیگار، کوکائین، سرما، استرس و وازوکانستریکتورها؛ حذف‌شان بخشی از درمان است.",
            "CCB (دیلتیازم/وراپامیل) و نیتراتِ طولانی‌اثر دفعاتِ حمله را کم می‌کنند.",
            "آنژیوگرافیِ طبیعی، بیماریِ کرونریِ ثابت را رد نمی‌کند؛ اسپاسم دینامیک است."
        ],
        "points_en": [
            "Spasm often nocturnal/early morning; capturing ECG during attack secures diagnosis.",
            "Triggers: smoking, cocaine, cold, stress, vasoconstrictors; removing them is therapy.",
            "CCB (diltiazem/verapamil) and long-acting nitrate reduce attack frequency.",
            "Normal angiogram does not exclude coronary disease; spasm is dynamic."
        ],
        "hint_fa": "کدام عامل، بیش از قرص، حملاتِ شبانهٔ پرینزمتال را شعله‌ور می‌کند و کدام دارو رگ را شل می‌کند؟",
        "hint_en": "What factor fuels nocturnal Prinzmetal attacks more than a pill, and which drug relaxes the vessel?",
        "attending_fa": "استاد: پرینزمتال را با سیگار نسوزان؛ رگ را با CCB آرام کن.",
        "attending_en": "Attending: Don't fuel Prinzmetal with smoking; calm the vessel with CCB."
    },
    (1,17): {
        "interpretation_fa": "مرد ۵۰ سالهٔ دیابتی با دردِ قفسهٔ سینه، افتِ جدیدِ ST و تروپونینِ مثبت، تصویرِ NSTE-ACS (NSTEMI) دارد؛ اکو EF ۳۵٪ و نارساییِ متوسطِ میترال را نشان می‌دهد. هاریسون NSTE-ACS را بر پایهٔ ریسک طبقه‌بندی و زمانِ آنژیوگرافی را بر اساسِ بی‌ثباتی، دردِ مقاوم، آریتمی یا نارسایی تعیین می‌کند. درمانِ اولیه شامل مانیتورینگ، آسپیرین، مهارکنندهٔ P2Y12 در بیمارِ مناسب، آنتی‌کوآگولانت (هپارین یا انوکساپارین)، استاتینِ پرقدرت و کنترلِ درد است. بتا-بلوکرِ خوراکی در فقدانِ منعِ همودینامیک مفید است، ولی در این دفترچه بر اساسِ کلیدِ رسمی، گزینهٔ «آسپیرین همراه کلوپیدوگرل» به عنوانِ موردِ «توصیه‌نشده» علامت‌گذاری شده است؛ از دیدِ راهنمایِ روز، دوگانهٔ ضدپلاکتی در NSTEMIِ بدونِ خطرِ خونریزیِ بالا، رکنِ درمان است و انتخابِ آن فردمحور و وابسته به ریسکِ خونریزی/ایسکمی است.",
        "interpretation_en": "A 50-year-old diabetic with chest pain, new ST depression and positive troponin fits NSTE-ACS (NSTEMI); echo EF 35% with moderate MR. Harrison risk-stratifies NSTE-ACS and times angiography by instability, refractory pain, arrhythmia or failure. Initial care: monitoring, aspirin, P2Y12 inhibitor when appropriate, anticoagulant (heparin or enoxaparin), high-intensity statin and pain control. Oral beta-blocker helps without hemodynamic contraindication, but per this booklet's key, 'aspirin+clopidogrel' is marked as not recommended; contemporary guidance makes dual antiplatelet a cornerstone in NSTEMI without high bleeding risk, individualized by ischemic/bleeding risk.",
        "reasons_fa": [
            "دلیل رد گزینه: انوکساپارین به جایِ هپارینِ غیرکسوره در NSTE-ACSِ بدونِ نارساییِ کلیویِ شدید، گزینهٔ آنتی‌کوآگولانتِ قابلِ قبول است.",
            "گزینه صحیح: بر اساسِ کلیدِ رسمیِ این دفترچه، «آسپیرین همراه کلوپیدوگرل» به عنوانِ اقدامِ توصیه‌نشده علامت‌گذاری شده است؛ تفسیرِ آموزشی یادآور می‌شود که از دیدِ راهنما دوگانهٔ ضدپلاکتی در NSTEMIِ کم‌خطرِ خونریزی، معمولاً توصیه می‌شود و انتخابِ کلید با ملاحظاتِ خاصِ طراح بوده است.",
            "دلیل رد گزینه: متوپرولول (بتا-بلوکر) در بیمارِ پایدارِ بدونِ برادی‌کاردی/افتِ فشار، مفید است؛ وراپامیلِ غیرِ دی‌هیدروپیریدینی در غیابِ نارساییِ سیستولیکِ شدید، جایگزینِ محدود است.",
            "دلیل رد گزینه: راهبردِ تهاجمیِ زودهنگام/۲۴–۷۲ ساعته بر اساسِ ریسک (GRACE) در NSTEMIِ پرخطر، بستری و ایسکمیِ مجدد را کم می‌کند."
        ],
        "reasons_en": [
            "Why incorrect: Enoxaparin instead of unfractionated heparin is an acceptable anticoagulant in NSTE-ACS without severe renal failure.",
            "Correct: Per the official key, 'aspirin+clopidogrel' is marked as not recommended; educationally, dual antiplatelet is usually recommended in NSTEMI without high bleeding risk, the key reflecting item-writer considerations.",
            "Why incorrect: Metoprolol (beta-blocker) helps in stable patients without bradycardia/hypotension; non-DHP verapamil is a limited alternative without severe systolic failure.",
            "Why incorrect: Early/24–72h invasive strategy by risk (GRACE) in high-risk NSTEMI reduces hospitalization and re-ischemia."
        ],
        "lead_fa": "NSTEMI = درد + ST دپرشنِ جدید + تروپونینِ مثبت؛ ریسک‌سنجی، زمانِ آنژیوگرافی را تعیین می‌کند.",
        "lead_en": "NSTEMI = pain + new ST depression + positive troponin; risk stratification times angiography.",
        "golden_fa": "در NSTE-ACS، دوگانهٔ ضدپلاکتی را با ریسکِ خونریزی بسنج؛ بتا-بلوکرِ خوراکی را در پایدارِ بدونِ منع بده.",
        "golden_en": "In NSTE-ACS, balance dual antiplatelet with bleeding risk; give oral beta-blocker when stable without contraindication.",
        "points_fa": [
            "تروپونینِ دینامیک + تغییراتِ ST/T = NSTEMI؛ درمانِ ضدایسکمی و ضدپلاکتی را زود شروع کن.",
            "GRACE بالا، دیابت، EF پایین و MR، ریسک را بالا می‌برند و تهاجمِ زودهنگام را تقویت می‌کنند.",
            "آنتی‌کوآگولانت را تا آنژیوگرافی ادامه بده و با کلیه/وزن تنظیم کن.",
            "بتا-بلوکرِ وریدیِ روتین در نارساییِ حاد/برادی‌کاردی ممنوع است؛ خوراکیِ محتاطانه ارجح است."
        ],
        "points_en": [
            "Dynamic troponin + ST/T changes = NSTEMI; start anti-ischemic/antiplatelet early.",
            "High GRACE, diabetes, low EF and MR raise risk and favor early invasive.",
            "Continue anticoagulant until angiography, dose by kidney/weight.",
            "Routine IV beta-blocker in acute failure/bradycardia is contraindicated; cautious oral is preferred."
        ],
        "hint_fa": "بین رقیق‌کنندهٔ خون و کاهندهٔ ضربان، کدام در نارساییِ ۳۵٪ با احتیاطِ بیشتری انتخاب می‌شود؟",
        "hint_en": "Between blood thinner and rate reducer, which needs more caution in 35% failure?",
        "attending_fa": "استاد: در NSTEMIِ کم‌EF، ریسکِ خونریزی و ایسکمی را هم‌زمان وزن کن.",
        "attending_en": "Attending: In low-EF NSTEMI, weigh bleeding and ischemic risk together."
    },
    (1,18): {
        "interpretation_fa": "تفاوتِ دلیریوم و دمانس از پایه‌هایِ هاریسون است: دلیریوم سندرمِ حادِ مغزی با اختلالِ توجه و آگاهی است که در مدتِ کوتاه آغاز و شدتِ آن در شبانه‌روز نوسان می‌کند؛ دمانس افتِ مزمن و پیشروندهٔ شناختی با تخریبِ عملکردِ روزمره است. در دلیریوم اختلالِ سطحِ هوشیاری و نوسانِ توجه برجسته است، در حالی که در دمانسِ اولیه توجه و هوشیاری نسبتاً حفظ است ولی حافظه و کارکردِ اجرایی به‌تدریج افت می‌کند. همین نوسان‌پذیری و حاد بودن، کلیدِ افتراقِ بالینی است.",
        "interpretation_en": "Harrison distinguishes delirium vs dementia: delirium is an acute brain syndrome with impaired attention/awareness that starts quickly and fluctuates through the day; dementia is chronic progressive cognitive decline impairing daily function. Delirium shows prominent fluctuating consciousness/attention; early dementia largely preserves attention/consciousness while memory/executive function slowly declines. Acuteness and fluctuation are the clinical keys.",
        "reasons_fa": [
            "دلیل رد گزینه: اختلالِ ادراک (توهم/هذیان) در دلیریوم شایع‌تر و پرنوسان‌تر از دمانسِ پایدار است؛ دمانس توهمِ ثابتِ کمتری دارد.",
            "گزینه صحیح: سیرِ دمانس پایدار و تدریجی است، در حالی که دلیریوم سیرِ متغیر و نوسانی در ساعاتِ شبانه‌روز دارد.",
            "دلیل رد گزینه: در هر دو، حافظهٔ اخیر زودتر مختل می‌شود؛ «حافظهٔ دور در دلیریوم» توصیفِ دقیقی نیست.",
            "دلیل رد گزینه: اختلالِ سطحِ هوشیاری در دلیریوم برجسته‌تر از دمانس است، نه برعکس."
        ],
        "reasons_en": [
            "Why incorrect: Perceptual disturbance (hallucination/delusion) is more common/fluctuating in delirium than stable dementia.",
            "Correct: Dementia course is stable/gradual, delirium course is variable/fluctuating across the day.",
            "Why incorrect: In both, recent memory fails early; 'remote memory in delirium' is not accurate.",
            "Why incorrect: Consciousness disturbance is more prominent in delirium than dementia, not vice versa."
        ],
        "lead_fa": "دلیریوم = حاد + نوسانی + اختلالِ توجه/هوشیاری؛ دمانس = مزمن + پیشرونده + افتِ کارکرد.",
        "lead_en": "Delirium = acute + fluctuating + attention/consciousness disturbance; dementia = chronic + progressive + functional decline.",
        "golden_fa": "نوسانِ شبانه‌روزی و شروعِ حاد را ببین؛ دلیریوم را از دمانس جدا می‌کند.",
        "golden_en": "Look for diurnal fluctuation and acute onset; it separates delirium from dementia.",
        "points_fa": [
            "دلیریوم اورژانس است؛ علتِ زمینه‌ای (عفونت، دارو، متابولیک) را فوراً بجوی.",
            "ارزیابیِ CAM و مرورِ دارو (آنتی‌کولینرژیک/بنزودیازپین) را فراموش نکن.",
            "در دمانس، معاینهٔ شناختیِ پایه و عملکردِ روزمره را مستند کن.",
            "هیپواکتیو دلیریوم را از افسردگی/دمانس اشتباه نگیر."
        ],
        "points_en": [
            "Delirium is an emergency; seek acute cause (infection, drug, metabolic) immediately.",
            "Use CAM and review anticholinergic/benzodiazepine drugs.",
            "In dementia, document baseline cognition and daily function.",
            "Don't mislabel hypoactive delirium as depression/dementia."
        ],
        "hint_fa": "کدام‌یک در یک روز بالا و پایین می‌شود و کدام‌یک آهسته و پیوسته پیش می‌رود؟",
        "hint_en": "Which fluctuates within a day and which marches slowly forward?",
        "attending_fa": "استاد: نوسان را بپرس؛ دلیریوم مثلِ چراغِ چشمک‌زن است، دمانس مثلِ غروبِ تدریجی.",
        "attending_en": "Attending: Ask about fluctuation; delirium flickers, dementia dims gradually."
    },
    (1,19): {
        "interpretation_fa": "هاریسون اختلالِ دیاستولیک را سفتیِ بطن و اختلالِ شل‌شدنِ (relaxation) فعال می‌داند: برایِ پرشدنِ مشابه، فشارِ بالاتری لازم است و این فشار به دهلیزِ چپ و مویرگِ ریوی منتقل می‌شود. ایسکمی، هیپرتروفی، فیبروزِ کلاژنی، سن، دیابت و پرفشاریِ مزمن، سفتی را زیاد می‌کنند. تاکیکاردی با کوتاه کردنِ دیاستول، نقشِ انقباضِ دهلیزی را پررنگ و فشارِ پرشدگی را بیشتر می‌کند؛ به همین دلیل فیبریلاسیونِ دهلیزیِ سریع در HFpEF می‌تواند به‌سرعت ادمِ ریوی بسازد.",
        "interpretation_en": "Harrison frames diastolic dysfunction as ventricular stiffness and impaired active relaxation: higher pressure is needed for similar filling, transmitted to LA and pulmonary capillaries. Ischemia, hypertrophy, collagen fibrosis, age, diabetes and chronic hypertension increase stiffness. Tachycardia shortens diastole, magnifies atrial kick and raises filling pressure; hence fast AF in HFpEF can rapidly precipitate pulmonary edema.",
        "reasons_fa": [
            "گزینه صحیح: تاکیکاردی با کوتاه کردنِ دیاستول، فشارِ دیاستولیک/پرشدگی را بالا می‌برد و تنگی‌نفس را تشدید می‌کند.",
            "دلیل رد گزینه: افزایشِ کلاژن و فیبروز، نه کاهشِ آن، سفتیِ دیاستولیک را می‌سازد.",
            "دلیل رد گزینه: اختلالِ دیاستولیک می‌تواند به‌تنهایی (HFpEF) دیده شود، نه فقط همراهِ سیستولیک.",
            "دلیل رد گزینه: اختلالِ دیاستولیکِ منفرد می‌تواند علامت‌دار باشد و تنگی‌نفسِ فعالیتی/ادمِ ریوی بدهد."
        ],
        "reasons_en": [
            "Correct: Tachycardia shortens diastole and raises diastolic/filling pressure, worsening dyspnea.",
            "Why incorrect: Increased collagen/fibrosis, not reduction, creates diastolic stiffness.",
            "Why incorrect: Diastolic dysfunction can occur alone (HFpEF), not only with systolic.",
            "Why incorrect: Isolated diastolic dysfunction can be symptomatic with exertional dyspnea/pulmonary edema."
        ],
        "lead_fa": "بخشِ سفتیِ بطن = فشارِ بیشتر برایِ پرشدنِ یکسان؛ تندیِ ضربان، فشار را بدتر می‌کند.",
        "lead_en": "Ventricular stiffness = more pressure for same filling; faster rate worsens pressure.",
        "golden_fa": "در نارساییِ دیاستولیک، ضربان را آرام و فشار را کنترل کن؛ AFِ سریع را سریع مهار کن.",
        "golden_en": "In diastolic failure, slow the rate and control pressure; curb fast AF quickly.",
        "points_fa": [
            "HFpEF را با اکو (الگویِ پرشدگی، E/e') و BNP/historia تنگی‌نفسِ فعالیتی بشناس.",
            "کنترلِ فشارِ خون و ایسکمی، پیشگیریِ اصلی است.",
            "تاکی‌کاردی و کم‌آبی/پرآبیِ حاد، دکامپنسیشن را شعله‌ور می‌کنند.",
            "ورزشِ منظمِ هوازی و کاهشِ وزن، compliance را بهبود می‌دهند."
        ],
        "points_en": [
            "Recognize HFpEF by echo (filling pattern, E/e') and exertional dyspnea/BNP.",
            "Blood pressure and ischemia control are core prevention.",
            "Tachycardia and acute volume shifts trigger decompensation.",
            "Regular aerobic exercise and weight loss improve compliance."
        ],
        "hint_fa": "اگر بطن سفت باشد، کوتاه شدنِ زمانِ پرشدن چه بر سرِ فشار می‌آورد؟",
        "hint_en": "If the ventricle is stiff, what does shorter filling time do to pressure?",
        "attending_fa": "استاد: بطنِ سفت عجله را دوست ندارد؛ ضربانِ تند، ریه را پرآب می‌کند.",
        "attending_en": "Attending: A stiff ventricle hates hurry; fast rate floods the lungs."
    },
    (1,20): {
        "interpretation_fa": "هاریسون هیپوتانسیونِ ارتوستاتیکِ کلاسیک را افتِ SBP حداقل ۲۰ یا DBP حداقل ۱۰ میلی‌مترِ جیوه در ۳ دقیقهٔ ایستادن تعریف می‌کند؛ در فردِ با پرفشاریِ خوابیده، افتِ SBP حداقل ۳۰ معیارِ حساس‌تری است. تشخیص بر اندازه‌گیریِ استاندارد است: استراحتِ خوابیده، سپس ثبتِ فشار/نبض در ۱ و ۳ دقیقهٔ ایستادن. افزایشِ ناکافیِ نبض با افتِ فشار، نوروژنیک بودن را مطرح می‌کند؛ افزایشِ واضحِ نبض به نفعِ کاهشِ حجم یا وازودیلاتور است. علل شامل دهیدراتاسیون، خونریزی، دیورتیک، وازودیلاتور، آلفابلوکر، نوروپاتیِ دیابتی و پارکینسون است.",
        "interpretation_en": "Harrison defines classic orthostatic hypotension as SBP drop ≥20 or DBP ≥10 mmHg within 3 minutes of standing; in supine hypertensives, SBP ≥30 is more sensitive. Diagnosis is standardized: supine rest, then BP/HR at 1 and 3 minutes standing. Insufficient HR rise with drop suggests neurogenic; marked HR rise suggests volume loss or vasodilator. Causes include dehydration, bleeding, diuretics, vasodilators, alpha-blockers, diabetic neuropathy and Parkinson.",
        "reasons_fa": [
            "دلیل رد گزینه: افتِ دیاستولیکِ ۵ میلی‌متر برایِ تعریفِ ارتوستاتیک کافی نیست؛ حداقل ۱۰ لازم است.",
            "گزینه صحیح: افتِ سیستولیکِ حداقل ۲۰ میلی‌مترِ جیوه در ۳ دقیقهٔ ایستادن، معیارِ کلاسیکِ هیپوتانسیونِ ارتوستاتیک است.",
            "دلیل رد گزینه: افتِ سیستولیکِ ۱۰ میلی‌متر به‌تنهایی معیارِ ارتوستاتیکِ کلاسیک نیست.",
            "دلیل رد گزینه: افتِ MAP به‌تنهایی معیارِ استانداردِ تعریف نیست؛ SBP/DBP ملاک‌اند."
        ],
        "reasons_en": [
            "Why incorrect: Diastolic drop 5 mmHg alone is insufficient for orthostatic definition; ≥10 is needed.",
            "Correct: Systolic drop ≥20 mmHg within 3 minutes standing is the classic orthostatic criterion.",
            "Why incorrect: Systolic drop 10 mmHg alone does not meet classic orthostatic criterion.",
            "Why incorrect: MAP drop alone is not the standard definitional criterion; SBP/DBP are."
        ],
        "lead_fa": "ارتواستاتیک = SBP ≥۲۰ یا DBP ≥۱۰ در ۳ دقیقهٔ ایستادن؛ روشِ اندازه‌گیری را استاندارد کن.",
        "lead_en": "Orthostatic = SBP ≥20 or DBP ≥10 within 3 min standing; standardize the measurement.",
        "golden_fa": "همیشه فشارِ خوابیده و ایستادهٔ ۱ و ۳ دقیقه را با نبض ثبت کن؛ نبضِ ناکافی = نوروژنیک.",
        "golden_en": "Always record supine and 1/3-min standing BP with HR; insufficient rise = neurogenic.",
        "points_fa": [
            "در پرفشاریِ خوابیده، افتِ SBP ≥۳۰ را نیز ارتوستاتیک بدان.",
            "دارو (دیورتیک/آلفابلوکر) و کم‌آبی را اول اصلاح کن.",
            "نوروپاتیِ دیابتی/پارکینسون را در افتِ بدونِ تاکی‌کاردی جست‌وجو کن.",
            "توصیه: برخاستنِ تدریجی، جورابِ فشاری و افزایشِ نمک/مایع در فقدانِ منع."
        ],
        "points_en": [
            "In supine hypertension, consider SBP ≥30 as orthostatic too.",
            "Correct drugs (diuretic/alpha-blocker) and dehydration first.",
            "Seek diabetic neuropathy/Parkinson when no tachycardia.",
            "Advise gradual rise, compression stockings, salt/fluid if not contraindicated."
        ],
        "hint_fa": "برایِ افتِ وضعیتی، عددِ جادوییِ سیستولیک در سه دقیقه چقدر است؟",
        "hint_en": "What's the systolic magic number for postural drop in three minutes?",
        "attending_fa": "استاد: فشارِ ایستاده را با ساعت بگیر؛ یک و سه دقیقه را از دست نده.",
        "attending_en": "Attending: Time the standing pressure; don't miss 1 and 3 minutes."
    },
    (1,21): {
        "interpretation_fa": "زنِ ۲۸ ساله با تنگیِ میترالِ روماتیسمی و سطحِ دریچهٔ ۱٫۲ سانتی‌مترِ مربع، تنگیِ متوسط تا شدید دارد (طبیعی ۴–۶، کمتر از ۱٫۵ مهم، کمتر از ۱ شدید). هاریسون یافته‌هایِ کلاسیک را S1 بلند، opening snap پس از A2 و رامبلِ دیاستولیکِ بم در اپکس می‌داند؛ با شدیدتر شدن، فاصلهٔ A2 تا snap کوتاه و شدتِ S1 با کلسیفیکاسیون کم می‌شود. افزایشِ شدتِ S2 (P2 بلند) بازتابِ پرفشاریِ ریوی است. تشدیدِ سوفلِ دیاستولیک با ورزش به عنوانِ «صحیح نیست» در کلید آمده است؛ از دیدِ فیزیولوژیک ورزش با افزایشِ جریانِ ترانس‌میترال گرادیان را بیشتر می‌کند ولی تندیِ ضربان، شنیدنِ سوفل را دشوار می‌سازد و کلیدِ دفترچه تشدیدِ واضح را نادرست دانسته است.",
        "interpretation_en": "A 28-year-old woman with rheumatic mitral stenosis valve area 1.2 cm² has moderate-to-severe stenosis (normal 4–6, <1.5 significant, <1 severe). Harrison lists loud S1, opening snap after A2 and low-pitched diastolic rumble at apex; more severe shortens A2-snap interval and calcification softens S1. Loud P2 reflects pulmonary hypertension. Per the key, 'augmentation of diastolic murmur with exercise' is marked as not correct; physiologically exercise raises trans-mitral gradient but tachycardia can make murmur harder to appreciate, and the booklet marks clear augmentation as incorrect.",
        "reasons_fa": [
            "دلیل رد گزینه: S1 بلند به دلیلِ بسته شدنِ ناگهانیِ لت‌هایِ متحرک در تنگیِ میترالِ روماتیسمی شایع است.",
            "دلیل رد گزینه: افزایشِ شدتِ S2 (P2) ناشی از پرفشاریِ ریویِ ثانویه به تنگیِ میترال است.",
            "دلیل رد گزینه: opening snap پس از S1 (پس از A2) ناشی از باز شدنِ ناگهانیِ لت‌هایِ سفتِ میترال است.",
            "گزینه صحیح: بر اساسِ کلیدِ رسمی، «تشدیدِ سوفلِ دیاستولیک با ورزش» به عنوانِ موردِ «صحیح نیست» علامت‌گذاری شده است؛ هرچند ورزش گرادیان را بیشتر می‌کند، کلیدِ دفترچه تشدیدِ واضحِ سوفل را نادرست دانسته است."
        ],
        "reasons_en": [
            "Why incorrect: Loud S1 from abrupt closure of mobile leaflets is common in rheumatic MS.",
            "Why incorrect: Increased S2 (loud P2) reflects secondary pulmonary hypertension in MS.",
            "Why incorrect: Opening snap after S1 (after A2) from abrupt opening of stiff mitral leaflets.",
            "Correct: Per the official key, 'augmentation of diastolic murmur with exercise' is marked as not correct; though exercise raises gradient, the booklet marks clear augmentation as incorrect."
        ],
        "lead_fa": "تنگیِ میترال = S1 بلند + snap + رامبلِ دیاستولیک؛ شدت با A2-snap کوتاه و P2 بلند بیشتر می‌شود.",
        "lead_en": "Mitral stenosis = loud S1 + snap + diastolic rumble; severity grows with short A2-snap and loud P2.",
        "golden_fa": "سطحِ ۱٫۲ = متوسط تا شدید؛ ریتم (AF)، آمبولی و فشارِ ریوی را هم‌زمان بپا.",
        "golden_en": "Area 1.2 = moderate-to-severe; watch rhythm (AF), embolism and pulmonary pressure together.",
        "points_fa": [
            "اکو: سطح، گرادیان، فشارِ ریوی و مورفولوژی؛ Wilkins score تصمیمِ بالموتومی را هدایت می‌کند.",
            "کنترلِ ضربان (بتا-بلوکر/دیگوکسین) تنگی‌نفس را کم می‌کند.",
            "آنتی‌کوآگولاسیون در AF یا ترومبوسِ دهلیزی اندیکاسیون دارد.",
            "پروفیلاکسیِ تبِ روماتیسمی را در سنِ مناسب ادامه بده."
        ],
        "points_en": [
            "Echo: area, gradient, pulmonary pressure, morphology; Wilkins score guides valvotomy.",
            "Rate control (beta-blocker/digoxin) eases dyspnea.",
            "Anticoagulate if AF or atrial thrombus.",
            "Continue rheumatic prophylaxis at appropriate age."
        ],
        "hint_fa": "بین صدایِ اولِ بلند و صدایِ دومِ ریویِ بلند، کدام با ورزش لزوماً بلندتر نمی‌شود؟",
        "hint_en": "Between loud first sound and loud pulmonary second, which doesn't necessarily get louder with exercise per the key?",
        "attending_fa": "استاد: تنگیِ میترال را با گوشِ دیافراگمی و بل بشنو؛ ورزش همیشه سوفل را بلندتر نمی‌کند.",
        "attending_en": "Attending: Hear MS with both bell and diaphragm; exercise doesn't always amplify it."
    },
    (1,22): {
        "interpretation_fa": "مردِ ۲۵ ساله با سردرد، خستگی، گرفتگیِ ساق، فشارِ ۱۸۰/۱۲۰ و تأخیرِ نبضِ فمورال، تابلویِ کوآرکتاسیونِ آئورت دارد؛ هاریسون آن را تنگیِ پس از خاستگاهِ ساب‌کلاوینِ چپ نزدیکِ لیگامانِ آرتریوزوم می‌داند. فشار و نبضِ اندامِ فوقانی بالا و تحتانی پایین است، claudication و اختلافِ فشارِ دست و پا دیده می‌شود و با دریچهٔ آئورتِ دولتی و آنوریسمِ داخلِ جمجمه همراهی دارد. در گرافیِ بزرگسال، خوردگیِ زیرِ دنده (rib notching) از عروقِ جانبیِ بین‌دنده‌ای و علامتِ عددِ ۳ (figure 3) و اتساعِ آئورتِ صعودی دیده می‌شود؛ «بزرگیِ قابلِ توجهِ قلب» معمولاً تا زمانِ نارساییِ پیشرفته دیده نمی‌شود و به عنوانِ «دیده نمی‌شودِ» کلید آمده است.",
        "interpretation_en": "A 25-year-old with headache, fatigue, calf claudication, BP 180/120 and delayed femoral pulse fits coarctation; Harrison locates it distal to left subclavian near ligamentum arteriosum. Upper limb pressure/pulse high, lower low, with arm-leg gradient and association with bicuspid valve and intracranial aneurysm. In adult X-ray, rib notching from collaterals, figure 3 sign and ascending aorta dilation appear; 'marked cardiac enlargement' is usually not seen until advanced failure and is the key's 'not seen'.",
        "reasons_fa": [
            "دلیل رد گزینه: اتساعِ آئورتِ صعودی/قوسِ پروگزیمال در کوآرکتاسیون شایع است.",
            "گزینه صحیح: بزرگیِ قابلِ توجهِ قلب در کوآرکتاسیونِ جبران‌شده معمولاً دیده نمی‌شود و «نیستِ» سؤال همین است.",
            "دلیل رد گزینه: خوردگیِ سطحِ زیرینِ دنده‌ها (rib notching) از عروقِ جانبیِ بین‌دنده‌ای پس از کودکی دیده می‌شود.",
            "دلیل رد گزینه: علامتِ عددِ ۳ (figure 3) از تنگیِ موضعی و اتساعِ پیش و پس از آن است."
        ],
        "reasons_en": [
            "Why incorrect: Ascending/proximal arch dilation is common in coarctation.",
            "Correct: Marked cardiac enlargement is usually not seen in compensated coarctation and is the 'not seen'.",
            "Why incorrect: Inferior rib notching from intercostal collaterals appears after childhood.",
            "Why incorrect: Figure 3 sign from localized narrowing with pre/post dilation."
        ],
        "lead_fa": "کوآرکتاسیون = فشارِ دست بالا + نبضِ فمورالِ تأخیری + rib notching/figure 3؛ قلبِ بزرگِ زودرس نادر است.",
        "lead_en": "Coarctation = high arm pressure + delayed femoral + rib notching/figure 3; early marked cardiomegaly rare.",
        "golden_fa": "فشارِ هر چهار اندام را بگیر؛ اختلافِ دست و پا، کوآرکتاسیون را لو می‌دهد.",
        "golden_en": "Take BP in all four limbs; arm-leg gradient betrays coarctation.",
        "points_fa": [
            "اکو و CT/MR angiography آناتومی و شدت را دقیق می‌کنند.",
            "دریچهٔ دولتی، آنوریسمِ آئورت و مغزی را غربال کن.",
            "درمان: استنت/جراحی بر اساسِ سن و آناتومی؛ کنترلِ فشارِ طولانی‌مدت لازم است.",
            "عوارضِ بدونِ درمان: نارسایی، دیسکسیون و خونریزیِ داخلِ جمجمه."
        ],
        "points_en": [
            "Echo and CT/MR angiography detail anatomy/severity.",
            "Screen for bicuspid, aortic and intracranial aneurysm.",
            "Therapy: stent/surgery by age/anatomy; lifelong BP control needed.",
            "Untreated complications: failure, dissection, intracranial bleed."
        ],
        "hint_fa": "در قفسهٔ سینهٔ کوآرکتاسیون، کدام یافته دیر و کدام زود ظاهر می‌شود؟",
        "hint_en": "In coarctation chest, which finding appears late vs early?",
        "attending_fa": "استاد: نبضِ پا را لمس کن؛ تأخیرِ فمورال از گرافی زودتر حرف می‌زند.",
        "attending_en": "Attending: Feel the foot pulse; femoral delay speaks before X-ray."
    },
    (1,23): {
        "interpretation_fa": "کودکِ ۴ ساله با سوفلِ ممتدِ machinery در اینفراکلاویکولرِ چپ و اشباعِ ۹۸٪ در دست و پا، PDA دارد؛ چون فشارِ آئورت در سیستول و دیاستول بالاتر از ریوی است، شانتِ چپ به راستِ مداوم ایجاد می‌شود. افزایشِ جریانِ ریوی، بازگشتِ وریدیِ ریوی را زیاد و دهلیز و بطنِ چپ را دچارِ اضافه‌بارِ حجمی می‌کند؛ نتیجه: بزرگیِ LA و LV در گرافی/اکو، نبضِ bounding و pulse pressureِ وسیع. سیانوزِ افتراقی و Eisenmenger در PDAِ بزرگ و دیر درمان دیده می‌شود، نه در این کودکِ با ساتِ یکسان.",
        "interpretation_en": "A 4-year-old with continuous machinery murmur at left infraclavicular and 98% SaO2 in hand/foot has PDA; aortic pressure exceeds pulmonary in systole and diastole, so continuous left-to-right shunt occurs. Increased pulmonary flow augments pulmonary venous return, volume-loading LA and LV; hence LA/LV enlargement on X-ray/echo, bounding pulse and wide pulse pressure. Differential cyanosis/Eisenmenger appears in large late PDA, not in this child with equal sats.",
        "reasons_fa": [
            "گزینه صحیح: شانتِ چپ به راستِ PDA، دهلیز و بطنِ چپ را حجیم می‌کند؛ LA و LV بزرگ می‌شوند.",
            "دلیل رد گزینه: RA و RV در PDAِ چپ به راستِ بدونِ Eisenmenger، اولیه بزرگ نمی‌شوند.",
            "دلیل رد گزینه: ترکیبِ RV و LV بدونِ LA، الگویِ PDA نیست.",
            "دلیل رد گزینه: بزرگیِ هر دو دهلیز به‌تنهایی، توصیفِ PDA نیست."
        ],
        "reasons_en": [
            "Correct: PDA left-to-right shunt volume-loads LA and LV; they enlarge.",
            "Why incorrect: RA and RV are not primarily enlarged in left-to-right PDA without Eisenmenger.",
            "Why incorrect: RV+LV without LA is not the PDA pattern.",
            "Why incorrect: Both atria alone does not describe PDA."
        ],
        "lead_fa": "PDA = سوفلِ ممتدِ machinery + نبضِ bounding + بزرگیِ LA/LV؛ ساتِ یکسان = هنوز Eisenmenger نیست.",
        "lead_en": "PDA = continuous machinery murmur + bounding pulse + LA/LV enlargement; equal sats = not yet Eisenmenger.",
        "golden_fa": "سوفلِ ممتدِ زیرِ ترقوه را بشنو؛ LA/LV بزرگ را با اکو تأیید کن.",
        "golden_en": "Hear the infraclavicular continuous murmur; confirm LA/LV enlargement by echo.",
        "points_fa": [
            "PDAِ کوچک ممکن است بی‌علامت بماند؛ PDAِ بزرگ تنگی‌نفس و نارسایی می‌دهد.",
            "درمان: ایبوپروفن/ایندومتاسین در نوزادی، بستنِ کاتتری/جراحی در کودکیِ بزرگ‌تر.",
            "Eisenmenger = شانتِ معکوس + سیانوزِ افتراقی (پا بیشتر از دست).",
            "پروفیلاکسیِ اندوکاردیتِ روتین در PDAِ بدونِ عارضه توصیه نمی‌شود."
        ],
        "points_en": [
            "Small PDA may be asymptomatic; large causes dyspnea/failure.",
            "Therapy: ibuprofen/indomethacin in neonate, cath/surgical closure later.",
            "Eisenmenger = reversed shunt + differential cyanosis (feet > hands).",
            "Routine endocarditis prophylaxis not recommended for uncomplicated PDA."
        ],
        "hint_fa": "خونی که از آئورت به ریه می‌رود، کدام حفرات را پرکار می‌کند؟",
        "hint_en": "Blood shunted from aorta to lungs volume-loads which chambers?",
        "attending_fa": "استاد: سوفلِ ممتد + نبضِ جهنده = PDA؛ قلبِ چپ را بپا.",
        "attending_en": "Attending: Continuous murmur + bounding pulse = PDA; watch the left heart."
    },
    (1,24): {
        "interpretation_fa": "مردِ ۳۵ سالهٔ سیگاری با دردِ سینه و تغییراتِ گذرایِ ST به صورتِ «تراسه» (نوسانی)، تابلویِ وازواسپاسمِ کرونری (پرینزمتال) دارد؛ سیگار محرکِ مهم است و نیترات به سرعت ST را نرمال می‌کند. افتراقِ کلیدی: STEMIِ واقعی STِ پایدار و Qِ پاتولوژیک می‌دهد، پریکاردیت STِ منتشرِ مقعر با PR depression، هیپرکالمی Tِ بلندِ نوک‌تیز با QRSِ پهن، و رپولاریزاسیونِ زودرس STِ ثابتِ خوش‌خیم با notch است. ماهیتِ گذرا و حمله‌ای، پرینزمتال را متمایز می‌کند.",
        "interpretation_en": "A 35-year-old smoker with chest pain and transient 'tracing' ST shifts fits coronary vasospasm (Prinzmetal); smoking is a key trigger and nitrate rapidly normalizes ST. Key differentials: true STEMI gives persistent ST and pathological Q, pericarditis diffuse concave ST with PR depression, hyperkalemia tall peaked T with wide QRS, early repolarization stable benign ST with notch. Transient paroxysmal nature distinguishes Prinzmetal.",
        "reasons_fa": [
            "گزینه صحیح: نوسانِ گذرایِ ST با سیگار و پاسخِ سریع به نیترات، پرینزمتال (وازواسپاسم) را مطرح می‌کند.",
            "دلیل رد گزینه: پریکاردیت STِ منتشرِ مقعر و PR depression می‌دهد، نه STِ نوسانیِ حمله‌ای.",
            "دلیل رد گزینه: هیپرکالمی Tِ نوک‌تیزِ بلند و QRSِ پهن می‌دهد، نه STِ گذرایِ حمله‌ای.",
            "دلیل رد گزینه: رپولاریزاسیونِ زودرس STِ ثابتِ خوش‌خیم با J-point notch است، نه نوسانِ حمله‌ای."
        ],
        "reasons_en": [
            "Correct: Transient ST fluctuation with smoking and rapid nitrate response suggests Prinzmetal (vasospasm).",
            "Why incorrect: Pericarditis gives diffuse concave ST and PR depression, not paroxysmal ST swings.",
            "Why incorrect: Hyperkalemia gives tall peaked T and wide QRS, not transient attack ST.",
            "Why incorrect: Early repolarization is stable benign ST with J-point notch, not paroxysmal swings."
        ],
        "lead_fa": "STِ گذرا + سیگار + پاسخِ نیترات = وازواسپاسم؛ پریکاردیت و early repol ثابت‌ترند.",
        "lead_en": "Transient ST + smoking + nitrate response = vasospasm; pericarditis and early repol are steadier.",
        "golden_fa": "نوسانِ ST را با زمان بسنج؛ حمله‌ای = اسپاسم، پایدار = انفارکتوس.",
        "golden_en": "Time the ST swing; paroxysmal = spasm, persistent = infarction.",
        "points_fa": [
            "سیگار را ترک و CCB/نیتراتِ پیشگیرانه بده.",
            "حمله‌ها اغلب شبانه/سحرگاهی‌اند؛ هولتر می‌تواند کمک کند.",
            "آنژیوگرافیِ طبیعی، اسپاسم را رد نمی‌کند.",
            "آمفتامین/کوکائین را به عنوانِ محرکِ اسپاسم بپرس."
        ],
        "points_en": [
            "Stop smoking and give preventive CCB/nitrate.",
            "Attacks often nocturnal/early morning; Holter may help.",
            "Normal angiogram does not exclude spasm.",
            "Ask about amphetamine/cocaine as spasm trigger."
        ],
        "hint_fa": "کدام ST می‌آید و می‌رود و با تنگیِ ثابت نمی‌خواند؟",
        "hint_en": "Which ST comes and goes and doesn't fit fixed stenosis?",
        "attending_fa": "استاد: STِ رقصانِ سیگاری را با نیترات بیازما؛ اگر رقص ایستاد، اسپاسم است.",
        "attending_en": "Attending: Test the smoker's dancing ST with nitrate; if it stops, it's spasm."
    },
    (1,25): {
        "interpretation_fa": "تنگیِ شدیدِ آئورتِ دژنراتیو با کلسیفیکاسیونِ لت‌ها، LVHِ متحدالمرکز و سوفلِ سیستولیکِ خشنِ crescendo-decrescendo در RUSB با انتشار به کاروتید و نبضِ parvus et tardus (خیزِ کند و دامنهٔ کم) تظاهر می‌کند. S4 ناشی از بطنِ سفت شنیده می‌شود و A2 با شدتِ تنگی ضعیفِ می‌شود، نه تقویت؛ تنگیِ شدید splittingِ پارادوکس هم می‌دهد ولی «A2 بلندِ» غیرمعمول است و به عنوانِ «نیستِ» سؤال آمده است.",
        "interpretation_en": "Severe degenerative AS with leaflet calcification, concentric LVH, harsh crescendo-decrescendo systolic murmur at RUSB radiating to carotids and parvus et tardus pulse (slow rise, low amplitude) presents as described. S4 from stiff ventricle is heard and A2 softens with severity, not loud; severe AS also gives paradoxical splitting but 'loud A2' is unusual and is the key's 'not seen'.",
        "reasons_fa": [
            "دلیل رد گزینه: سوفلِ خشنِ crescendo-decrescendo منتشر به کاروتید، یافتهٔ اصلیِ تنگیِ آئورت است.",
            "دلیل رد گزینه: S4 ناشی از انقباضِ دهلیزی در برابرِ بطنِ سفت/هیپرتروفیه در AS شایع است.",
            "گزینه صحیح: A2 بلند در تنگیِ شدیدِ آئورت غیرمعمول است؛ با کلسیفیکاسیون و کاهشِ تحرکِ لت، A2 ضعیف می‌شود.",
            "دلیل رد گزینه: paradoxical splitting (P2 پس از A2ِ تأخیری) در تنگیِ شدید با بسته شدنِ دیرهنگامِ آئورت دیده می‌شود."
        ],
        "reasons_en": [
            "Why incorrect: Harsh crescendo-decrescendo murmur radiating to carotids is the main AS finding.",
            "Why incorrect: S4 from atrial contraction against stiff/hypertrophied ventricle is common in AS.",
            "Correct: Loud A2 in severe AS is unusual; calcification/immobility softens A2.",
            "Why incorrect: Paradoxical splitting (P2 after delayed A2) occurs in severe AS with delayed aortic closure."
        ],
        "lead_fa": "تنگیِ شدیدِ آئورت = سوفلِ RUSB + parvus et tardus + A2ِ ضعیف + S4؛ A2 بلند ناهمخوان است.",
        "lead_en": "Severe AS = RUSB murmur + parvus et tardus + soft A2 + S4; loud A2 mismatches.",
        "golden_fa": "شدتِ سوفل با شدتِ تنگی همبسته نیست؛ اکو (Vmax/gradient/AVA) قضاوت می‌کند.",
        "golden_en": "Murmur grade doesn't track severity; echo (Vmax/gradient/AVA) judges.",
        "points_fa": [
            "سه‌گانهٔ علامت‌دار: آنژین، سنکوپِ فعالیتی، تنگی‌نفس/نارسایی — پیش‌آگهیِ بدونِ تعویض بد است.",
            "نبضِ کندِ کم‌دامنه و p. paradoxical را افتراق بده.",
            "اکو شدت و LV را تعیین می‌کند؛ TAVR/SAVR در علامت‌دارِ شدید.",
            "در بی‌علامتِ شدید، تستِ ورزشِ تحتِ نظر برایِ آشکارسازیِ علائم مفید است."
        ],
        "points_en": [
            "Symptomatic triad: angina, exertional syncope, dyspnea/failure — untreated prognosis poor.",
            "Differentiate slow low-amplitude pulse and paradoxical splitting.",
            "Echo grades severity and LV; TAVR/SAVR for severe symptomatic.",
            "In asymptomatic severe, supervised exercise testing can unmask symptoms."
        ],
        "hint_fa": "دریچهٔ کلسیفیهٔ سفت، صدایِ بسته شدنش بلند است یا کم‌جان؟",
        "hint_en": "Does a stiff calcified valve close loudly or faintly?",
        "attending_fa": "استاد: A2 را گوش کن؛ اگر محو شد، تنگی شدیدتر است.",
        "attending_en": "Attending: Listen to A2; if it fades, stenosis is more severe."
    },
    (1,26): {
        "interpretation_fa": "هاریسون چهار مرحلهٔ ECG پریکاردیتِ حاد را: صعودِ منتشرِ مقعرِ ST با PR depression، سپس نرمال‌شدن، سپس وارونگیِ منتشرِ T و سپس نرمال‌شدن برمی‌شمارد؛ همهٔ مراحل در هر بیمار دیده نمی‌شود. اختلالِ T می‌تواند هفته‌ها باقی بماند. AV block یافتهٔ پریکاردیتِ ایزوله نیست؛ اگر بلوک یا آریتمیِ هدایتی دیده شد، درگیریِ میوکارد (میوپریکاردیت) یا علتِ دیگر را جست‌وجو کن. افتراق از STEMI با انتشارِ وسیع، مقعر بودن، فقدانِ Q و فقدانِ reciprocal محدود به قلمرو است.",
        "interpretation_en": "Harrison lists four ECG stages of acute pericarditis: diffuse concave ST elevation with PR depression, then normalization, then diffuse T inversion, then normalization; not all stages appear. T disturbance can persist weeks. AV block is not a finding of isolated pericarditis; if block/conduction arrhythmia appears, look for myocardial involvement (myopericarditis) or other cause. Distinguish from STEMI by widespread concave ST, no Q and no territory-limited reciprocal depression.",
        "reasons_fa": [
            "دلیل رد گزینه: افتِ PR (PR depression) یافتهٔ کلاسیکِ پریکاردیتِ حاد است.",
            "دلیل رد گزینه: صعودِ منتشرِ مقعرِ ST یافتهٔ مرحلهٔ اولِ پریکاردیت است.",
            "دلیل رد گزینه: باقیماندنِ اختلالِ T (وارونگیِ T) می‌تواند هفته‌ها ادامه یابد.",
            "گزینه صحیح: AV block یافتهٔ پریکاردیتِ ایزوله نیست و «بجزِ» سؤال همین است."
        ],
        "reasons_en": [
            "Why incorrect: PR depression is a classic finding of acute pericarditis.",
            "Why incorrect: Diffuse concave ST elevation is the first-stage finding.",
            "Why incorrect: Persistent T-wave disturbance (T inversion) can last weeks.",
            "Correct: AV block is not a finding of isolated pericarditis and is the 'except'."
        ],
        "lead_fa": "ECG پریکاردیت = STِ منتشرِ مقعر + PR depression؛ AV block مالِ پریکاردیتِ ایزوله نیست.",
        "lead_en": "Pericarditis ECG = diffuse concave ST + PR depression; AV block is not isolated pericarditis.",
        "golden_fa": "STEMI را با انتشارِ وسیع و مقعر بودن و فقدانِ Q از پریکاردیت جدا کن.",
        "golden_en": "Separate STEMI by wide concave ST without Q.",
        "points_fa": [
            "در aVR و V1 ممکن است تغییراتِ معکوس دیده شود.",
            "تروپونینِ بالا + اختلالِ LV = میوپریکاردیت را مطرح کن.",
            "اکو برایِ افیوژن/تامپوناد را فراموش نکن.",
            "درمان: NSAID + کلشیسین و پرهیز از فعالیتِ شدید در فازِ حاد."
        ],
        "points_en": [
            "Reciprocal changes may appear in aVR and V1.",
            "High troponin + LV dysfunction suggests myopericarditis.",
            "Don't forget echo for effusion/tamponade.",
            "Therapy: NSAID + colchicine and avoid strenuous activity in acute phase."
        ],
        "hint_fa": "کدام هدایتِ الکتریکی در پریکاردِ تنها معمولاً دست‌نخورده می‌ماند؟",
        "hint_en": "Which conduction stays intact in isolated pericardium?",
        "attending_fa": "استاد: STِ منتشرِ مقعر را ببین، بلوک را جایِ دیگر بجوی.",
        "attending_en": "Attending: See diffuse concave ST, look elsewhere for block."
    },
    (1,27): {
        "interpretation_fa": "نارساییِ مزمنِ آئورت با بازگشتِ دیاستولیکِ خون به LV، LV را حجیم (eccentric hypertrophy) و apex را به پایین و خارج جابه‌جا می‌کند؛ سوفلِ early diastolicِ decrescendo در LSB، pulse pressureِ وسیع، نبضِ bounding و LVHِ اکو/ECG دیده می‌شود و اتساعِ ریشهٔ آئورت شایع است. carotid upstrokeِ دیررس (parvus et tardus) ویژگیِ تنگیِ آئورت است، نه نارسایی؛ به همین دلیل در کلید به عنوانِ «غیرمعمول» آمده است.",
        "interpretation_en": "Chronic AR with diastolic regurgitation volume-loads LV (eccentric hypertrophy) displacing apex inferolaterally; early diastolic decrescendo murmur at LSB, wide pulse pressure, bounding pulses and ECG/echo LVH are seen with frequent aortic root dilation. Delayed carotid upstroke (parvus et tardus) is AS, not AR; hence the key marks it as unusual.",
        "reasons_fa": [
            "دلیل رد گزینه: اتساعِ آئورت/ریشه در ARِ مزمن (مارفان، دولتی، آنوریسم) شایع است.",
            "دلیل رد گزینه: pulse pressureِ وسیع (سیستولِ بالا و دیاستولِ پایین) از نشتِ دیاستولیک است.",
            "دلیل رد گزینه: LVH در ECG/اکو ناشی از اضافه‌بارِ حجمیِ مزمنِ LV است.",
            "گزینه صحیح: carotid upstrokeِ دیررس (خیزِ آهستهٔ کاروتید) ویژگیِ تنگیِ آئورت است و در ARِ خالص غیرمعمول است."
        ],
        "reasons_en": [
            "Why incorrect: Aortic/root dilation in chronic AR (Marfan, bicuspid, aneurysm) is common.",
            "Why incorrect: Wide pulse pressure (high systolic, low diastolic) from diastolic leak.",
            "Why incorrect: LVH on ECG/echo from chronic LV volume overload.",
            "Correct: Delayed carotid upstroke (slow carotid rise) is AS, unusual in pure AR."
        ],
        "lead_fa": "ARِ مزمن = apexِ جابه‌جا + سوفلِ دیاستولیکِ LSB + pulse pressureِ وسیع؛ upstrokeِ دیررس مالِ AS است.",
        "lead_en": "Chronic AR = displaced apex + LSB diastolic murmur + wide pulse pressure; delayed upstroke belongs to AS.",
        "golden_fa": "نبضِ جهنده + فشارِ نبضِ وسیع را ببین؛ upstrokeِ کند را به AS نسبت بده.",
        "golden_en": "See bounding pulse + wide pressure; attribute slow upstroke to AS.",
        "points_fa": [
            "Austin Flint murmur در ARِ شدید ممکن است تقلیدِ MS کند.",
            "اکو: vena contracta، regurgitant volume و ابعادِ LV را بسنج.",
            "در ARِ شدیدِ علامت‌دار یا EF رو به افت، جراحیِ دریچه مطرح است.",
            "فشارِ دیاستولیکِ پایین، پرفیوژنِ کرونری را تهدید می‌کند."
        ],
        "points_en": [
            "Austin Flint murmur in severe AR may mimic MS.",
            "Echo: vena contracta, regurgitant volume and LV size.",
            "Severe symptomatic AR or falling EF warrants valve surgery.",
            "Low diastolic pressure threatens coronary perfusion."
        ],
        "hint_fa": "کدام نبضِ کاروتید کند می‌رسد: تنگی یا نشت؟",
        "hint_en": "Which carotid arrives late: stenosis or leak?",
        "attending_fa": "استاد: نبضِ جهنده را از نبضِ کند جدا کن؛ اولی نشت، دومی تنگی.",
        "attending_en": "Attending: Separate bounding from slow pulse; former leak, latter stenosis."
    },
    (1,28): {
        "interpretation_fa": "علامتِ کوسمال (Kussmaul) افزایش یا عدمِ کاهشِ JVP در دم است؛ به طورِ طبیعی در دم فشارِ داخلِ قفسهٔ سینه پایین می‌آید و JVP فرو می‌نشیند. اگر بطنِ راست سفت، ایسکمیک یا با پریکاردِ سفت محدود شده باشد، افزایشِ بازگشتِ وریدی پذیرفته نمی‌شود و JVP بالا می‌ماند. هاریسون عللِ کلاسیک را پریکاردیتِ انقباضی (constrictive)، کاردیومیوپاتیِ محدودکننده (restrictive) و انفارکتوسِ بطنِ راست می‌داند؛ تنگیِ تریکوسپید به‌تنهایی Kussmaulِ تیپیک نمی‌دهد و به عنوانِ «دیده نمی‌شودِ» کلید آمده است.",
        "interpretation_en": "Kussmaul sign is inspiratory rise/failure to fall of JVP; normally intrathoracic pressure falls on inspiration and JVP drops. If RV is stiff, ischemic or constricted by rigid pericardium, increased venous return is not accommodated and JVP stays high. Harrison lists classic causes as constrictive pericarditis, restrictive cardiomyopathy and RV infarction; tricuspid stenosis alone does not give typical Kussmaul and is the key's 'not seen'.",
        "reasons_fa": [
            "دلیل رد گزینه: پریکاردیتِ انقباضی با پریکاردِ سفت، Kussmaulِ تیپیک می‌دهد.",
            "دلیل رد گزینه: کاردیومیوپاتیِ محدودکننده با بطنِ سفت، Kussmaul می‌دهد.",
            "دلیل رد گزینه: انفارکتوسِ بطنِ راست با بطنِ ایسکمیک/سفت، Kussmaul می‌دهد.",
            "گزینه صحیح: تنگیِ تریکوسپید به‌تنهایی Kussmaulِ تیپیک نمی‌دهد و «نیستِ» سؤال همین است."
        ],
        "reasons_en": [
            "Why incorrect: Constrictive pericarditis with rigid pericardium gives typical Kussmaul.",
            "Why incorrect: Restrictive cardiomyopathy with stiff ventricle gives Kussmaul.",
            "Why incorrect: RV infarction with ischemic/stiff ventricle gives Kussmaul.",
            "Correct: Tricuspid stenosis alone does not give typical Kussmaul and is the 'not seen'."
        ],
        "lead_fa": "Kussmaul = JVP در دم بالا می‌ماند؛ constrictive/restrictive/RV infarction می‌دهند.",
        "lead_en": "Kussmaul = JVP stays high on inspiration; constrictive/restrictive/RV infarction cause it.",
        "golden_fa": "Kussmaul را از pulsus paradoxus جدا کن؛ اولی JVP، دومی SBP.",
        "golden_en": "Separate Kussmaul from pulsus paradoxus; former JVP, latter SBP.",
        "points_fa": [
            "در تامپونادِ کلاسیک، Kussmaul معمولاً نیست (مگر با هیپوولمیِ شدید).",
            "معاینهٔ JVP را با دمِ عمیق و مشاهدهٔ وریدِ ژوگولر انجام بده.",
            "اکو: respiratory variationِ ترانس‌میترال/تریکوسپید در constrictive کمک می‌کند.",
            "در RVMI، نیتروگلیسیرینِ بی‌احتیاط افتِ شدید می‌دهد."
        ],
        "points_en": [
            "In classic tamponade, Kussmaul usually absent (except severe hypovolemia).",
            "Examine JVP with deep inspiration and jugular inspection.",
            "Echo: respiratory variation of mitral/tricuspid flow helps in constrictive.",
            "In RVMI, incautious nitroglycerin causes severe drop."
        ],
        "hint_fa": "کدام بطنِ سفت در دم، خونِ ورودی را پس می‌زند؟",
        "hint_en": "Which stiff ventricle regurgitates incoming blood on inspiration?",
        "attending_fa": "استاد: JVP را در دم بپا؛ اگر پایین نیامد، بطنِ راست را سفت بدان.",
        "attending_en": "Attending: Watch JVP on inspiration; if it doesn't fall, call RV stiff."
    },
    (1,29): {
        "interpretation_fa": "نبضِ دو قله‌ای دو الگو دارد: pulsus bisferiens دو قلهٔ سیستولیک دارد و در ARِ شدید، AR همراهِ AS و HOCM (انسدادِ دینامیک) دیده می‌شود؛ نبضِ دی‌کروتیک (dicrotic) یک قلهٔ سیستولیک و یک موجِ دیاستولیکِ برجسته دارد و در حالاتِ low-output قلبی یا وازودیلاتوریِ سپتیک دیده می‌شود. در این بیمار با افتِ فشار و تنگی‌نفس و نبضِ دی‌کروتیک، سپسیس/وازودیلاتاسیون مطرح است و کلید «سپسیس» را صحیح دانسته است. افتراقِ bisferiens از dicrotic با زمانِ قلهٔ دوم نسبت به بسته شدنِ دریچهٔ آئورت است.",
        "interpretation_en": "Double-peaked pulse has two patterns: pulsus bisferiens has two systolic peaks seen in severe AR, AR+AS and HOCM (dynamic obstruction); dicrotic pulse has one systolic peak and a prominent diastolic wave seen in low-output or vasodilatory septic states. In this hypotensive dyspneic patient with dicrotic pulse, sepsis/vasodilation is implied and the key marks 'sepsis' correct. Bisferiens vs dicrotic is distinguished by timing of second peak relative to aortic closure.",
        "reasons_fa": [
            "گزینه صحیح: نبضِ دی‌کروتیکِ دو قله‌ای با موجِ دیاستولیکِ برجسته در سپسیس/وازودیلاتوریِ low-output دیده می‌شود.",
            "دلیل رد گزینه: تنگیِ آئورت نبضِ parvus et tardus (خیزِ کندِ کم‌دامنه) می‌دهد، نه دو قلهٔ dicrotic.",
            "دلیل رد گزینه: HOCM نبضِ bisferiens/ spike-and-dome می‌دهد که دو قلهٔ سیستولیک دارد، نه الگویِ سپتیکِ خالص.",
            "دلیل رد گزینه: تنگیِ پولمونر نبضِ شریانیِ دو قله نمی‌سازد."
        ],
        "reasons_en": [
            "Correct: Dicrotic double pulse with prominent diastolic wave is seen in sepsis/vasodilatory low-output.",
            "Why incorrect: Aortic stenosis gives parvus et tardus (slow low-amplitude), not dicrotic double.",
            "Why incorrect: HOCM gives bisferiens/spike-and-dome with two systolic peaks, not pure septic pattern.",
            "Why incorrect: Pulmonic stenosis does not create arterial double pulse."
        ],
        "lead_fa": "دو قله = bisferiensِ سیستولیک (HOCM/AR) یا dicroticِ دیاستولیک (سپسیس)؛ زمانِ قله را بسنج.",
        "lead_en": "Double peak = systolic bisferiens (HOCM/AR) or diastolic dicrotic (sepsis); time the peak.",
        "golden_fa": "افتِ فشار + تنگی‌نفس + دی‌کروتیک = سپسیس را فراموش نکن.",
        "golden_en": "Hypotension + dyspnea + dicrotic = don't miss sepsis.",
        "points_fa": [
            "در HOCM، مانورِ والسالوا سوفل و انسداد را بیشتر می‌کند.",
            "در ARِ شدید، bisferiens با pulse pressureِ وسیع همراه است.",
            "در سپسیس، لاکتات، کشت و آنتی‌بیوتیکِ زودهنگام را فراموش نکن.",
            "سمعِ کاروتید و لمسِ هم‌زمانِ آپکس، افتراق را آسان می‌کند."
        ],
        "points_en": [
            "In HOCM, Valsalva augments murmur and obstruction.",
            "In severe AR, bisferiens comes with wide pulse pressure.",
            "In sepsis, don't forget lactate, cultures and early antibiotics.",
            "Carotid auscultation and simultaneous apex palpation ease distinction."
        ],
        "hint_fa": "قلهٔ دوم پیش از بسته شدنِ دریچه است یا پس از آن؟",
        "hint_en": "Is the second peak before or after valve closure?",
        "attending_fa": "استاد: دو قله را با گوش و انگشت زمان‌بندی کن؛ مکانِ قله، تشخیص را می‌گوید.",
        "attending_en": "Attending: Time the two peaks with ear and finger; peak location tells the diagnosis."
    },
    (1,30): {
        "interpretation_fa": "مردِ ۲۵ ساله با فشارِ ۲۰۰/۱۰۰ در دست‌ها، نبضِ ضعیفِ پاها، LVHِ ECG و سردردِ ناگهانیِ شدید با افتِ هوشیاری و خونریزیِ داخلِ جمجمه، تابلویِ کوآرکتاسیونِ آئورت با پارگیِ آنوریسمِ داخلِ جمجمه (شایعاً آنوریسمِ ساکولارِ حلقهٔ ویلیس) دارد؛ هاریسون همراهیِ کوآرکتاسیون با دریچهٔ دولتی، آنوریسمِ آئورت و آنوریسمِ مغزی را یادآوری می‌کند. فشارِ بالایِ مزمنِ اندامِ فوقانی، LVH می‌سازد و آنوریسم‌هایِ مغزیِ هم‌زمان، ریسکِ خونریزیِ ساب‌آراکنوئید/داخلِ مغزی را بالا می‌برند. فشارِ اولیهٔ ایزوله یا دیسکسیونِ صعودی به‌تنهایی، اختلافِ فشارِ دست و پا و LVHِ زمینه‌ای را توضیح نمی‌دهند.",
        "interpretation_en": "A 25-year-old with BP 200/100 in arms, weak leg pulses, ECG LVH and sudden severe headache with depressed consciousness and intracranial hemorrhage fits coarctation with ruptured intracranial (often saccular Willis circle) aneurysm; Harrison notes coarctation association with bicuspid valve, aortic aneurysm and cerebral aneurysm. Chronic upper-limb hypertension builds LVH and concurrent cerebral aneurysms raise subarachnoid/intracerebral bleed risk. Isolated primary hypertension or isolated ascending dissection alone do not explain arm-leg gradient and background LVH.",
        "reasons_fa": [
            "دلیل رد گزینه: هیپرتانسیونِ اولیه به‌تنهایی اختلافِ فشارِ دست و پا و نبضِ ضعیفِ پاها را توضیح نمی‌دهد.",
            "دلیل رد گزینه: دیسکسیونِ صعودی می‌تواند دردِ ناگهانی و اختلافِ نبض دهد ولی LVHِ مزمن و تابلویِ کوآرکتاسیونِ زمینه‌ای را ندارد.",
            "گزینه صحیح: کوآرکتاسیونِ آئورت با آنوریسمِ مغزیِ همراه و پارگیِ آن، فشارِ بالایِ دست‌ها، نبضِ ضعیفِ پاها، LVH و خونریزیِ ناگهانی را یک‌جا توضیح می‌دهد.",
            "دلیل رد گزینه: کوآگولوپاتی و افزایشِ فشارِ ثانویه به ایسکمیِ مغز، علتِ اولیهٔ اختلافِ فشارِ دست و پا نیست."
        ],
        "reasons_en": [
            "Why incorrect: Primary hypertension alone does not explain arm-leg BP gradient and weak leg pulses.",
            "Why incorrect: Ascending dissection can give sudden pain and pulse discrepancy but not chronic LVH and background coarctation picture.",
            "Correct: Coarctation with concurrent cerebral aneurysm rupture explains high arm pressure, weak leg pulses, LVH and sudden bleed together.",
            "Why incorrect: Coagulopathy and pressure rise secondary to brain ischemia is not the primary cause of arm-leg gradient."
        ],
        "lead_fa": "فشارِ دست بالا + نبضِ پایِ ضعیف + LVH + سردردِ برق‌آسا = کوآرکتاسیون + آنوریسمِ مغزیِ پاره.",
        "lead_en": "High arm pressure + weak leg pulse + LVH + thunderclap headache = coarctation + ruptured cerebral aneurysm.",
        "golden_fa": "در جوانِ پرفشار با اختلافِ دست و پا، مغز و آئورت را هم‌زمان بپا.",
        "golden_en": "In young hypertensive with arm-leg gradient, watch brain and aorta together.",
        "points_fa": [
            "هر جوانِ پرفشار را هر چهار اندام فشار بگیر؛ تأخیرِ فمورال را لمس کن.",
            "اکو و CT/MR آنژیو، کوآرکتاسیون و آنوریسم را آشکار می‌کنند.",
            "غربالِ آنوریسمِ مغزی در کوآرکتاسیونِ دارایِ سردردِ ناگهانی ضروری است.",
            "کنترلِ فشارِ حادِ خونریزی با احتیاط و جراحیِ آنوریسمِ پاره اولویت دارد."
        ],
        "points_en": [
            "Take BP in all four limbs in every young hypertensive; feel femoral delay.",
            "Echo and CT/MR angio reveal coarctation and aneurysm.",
            "Screen for cerebral aneurysm in coarctation with sudden headache.",
            "Careful acute pressure control and ruptured aneurysm surgery are priorities."
        ],
        "hint_fa": "کدام تنگیِ مادرزادی، فشارِ دست را بالا و رگِ مغز را شکننده می‌کند؟",
        "hint_en": "Which congenital narrowing raises arm pressure and makes brain vessels fragile?",
        "attending_fa": "استاد: جوانِ پرفشارِ با پایِ کم‌نبض را از سر تا مغز ببین.",
        "attending_en": "Attending: See the young hypertensive with weak leg pulse from head to toe."
    },
}

OPTIONS_EN_MAP2 = {
    (1,16): ['Aspirin', 'Nitrate', 'Diltiazem', 'Smoking cessation'],
    (1,17): ['Enoxaparin instead of heparin', 'Aspirin + clopidogrel', 'Metoprolol or verapamil', 'Angiography after 72h'],
    (1,18): ['Perceptual disorder higher in dementia', 'Dementia stable, delirium fluctuating', 'Recent memory in dementia, remote in delirium', 'Consciousness disorder higher in dementia'],
    (1,19): ['Tachycardia raises diastolic pressure', 'Reduced collagen causes disorder', 'Diastolic disorder never alone', 'Isolated diastolic disorder asymptomatic'],
    (1,20): ['Diastolic drop 5 mmHg', 'Systolic drop at least 20 mmHg', 'Systolic drop at least 10 mmHg', 'MAP drop at least 20 mmHg'],
    (1,21): ['Loud S1', 'Increased S2 intensity', 'Opening snap after S1', 'Diastolic murmur augments with exercise'],
    (1,22): ['Ascending aorta dilation', 'Marked cardiomegaly', 'Inferior rib notching', 'Figure 3 sign'],
    (1,23): ['LA and LV', 'RA and RV', 'RV and LV', 'RA and LA'],
    (1,24): ['Prinzmetal', 'Acute pericarditis', 'Hyperkalemia', 'Early repolarization'],
    (1,25): ['Harsh crescendo-decrescendo murmur', 'S4', 'Loud A2', 'Paradoxical splitting'],
    (1,26): ['PR depression', 'Diffuse ST elevation', 'Persistent T disturbance', 'AV block'],
    (1,27): ['Aortic dilation', 'Wide pulse pressure', 'LVH on ECG', 'Delayed carotid upstroke'],
    (1,28): ['Constrictive pericarditis', 'Restrictive cardiomyopathy', 'RV infarction', 'Tricuspid stenosis'],
    (1,29): ['Sepsis', 'Aortic stenosis', 'HOCM: if bisferiens may be considered', 'Pulmonic stenosis'],
    (1,30): ['Primary hypertension', 'Ascending aortic dissection', 'Coarctation with cerebral aneurysm rupture', 'Coagulopathy and secondary pressure rise'],
}

def enrich2():
    assert len(ITEMS)==15
    path = ROOT / f"tools/master-bank/import-payload.master-preint.part{PART:02}.json"
    before = json.loads(path.read_text(encoding="utf-8"))
    after = copy.deepcopy(before)
    for local, q in enumerate(after["questions"], 1):
        item = ITEMS.get((PART, local))
        if item is None:
            continue
        if not q.get("options_en") or len([o for o in q.get("options_en",[]) if str(o).strip()])<4:
            q["options_en"] = OPTIONS_EN_MAP2.get((PART, local), q.get("options_en",[]))
        if "pending retrospective" in q.get("question_en",""):
            q["question_en"] = q["question_en"].split(" > ")[0]
        q["explanation_fa"] = item["interpretation_fa"] + "\n\n" + "درسنامه (هاریسون ۲۲): " + item["lead_fa"] + " " + item["golden_fa"]
        q["explanation_en"] = item["interpretation_en"] + "\n\nLesson (Harrison 22e): " + item["lead_en"] + " " + item["golden_en"]
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
        assert len(q["explanation_en"])>300
        assert len(q["options_why_fa"])==4
        assert q["options_why_fa"][q["correct_index"]].startswith("گزینه صحیح:")
        assert all(q["options_why_fa"][i].startswith("دلیل رد گزینه:") for i in range(4) if i != q["correct_index"])
        assert q["options_why_en"][q["correct_index"]].startswith("Correct:")
        correct_text = q["options_fa"][q["correct_index"]]
        assert correct_text not in q["hints_fa"][0]
    # validate protected
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
    print(f"PASS: enriched {len(ITEMS)} heart Q16-30 in part{PART:02}; bilingual + Socratic, Persian-heavy.")

if __name__=="__main__":
    enrich2()
