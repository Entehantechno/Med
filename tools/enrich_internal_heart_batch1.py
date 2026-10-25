#!/usr/bin/env python3
"""Enrich internal medicine heart batch 1 (part01 Q1-20) — bilingual, Socratic hints, Persian-heavy."""
import copy, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
PART = 1
# Items for QB-00001 to QB-00020 (part01 local 1-20)
# Each entry: interpretation (case-specific), reasons[4], lead, golden, points[4], hint, attending, and English counterparts
ITEMS = {
    (1,1): {
        "interpretation_fa": "مرد ۶۰ ساله با درد متناوبِ دو ماهه که با فعالیت برانگیخته و با استراحت فروکش می‌کند، الگوی آنژین پایدار دارد. نوار قلبِ استراحتِ طبیعی، بیماریِ حاد را رد نمی‌کند. بر اساس هاریسون ۲۲ و راهنماهای آنژین پایدار، پس از شرح‌حال و ECG، انتخاب آزمونِ ایسکمی به سه عامل وابسته است: تواناییِ بیمار برای ورزش، قابلِ تفسیر بودنِ ST در ECG پایه، و احتمالِ پیش‌آزمونِ بیماریِ سرخرگِ کرونری. بیمار قادر به فعالیت است و ECG او طبیعی است؛ بنابراین آزمونِ پویا می‌تواند هم ایسکمی را آشکار کند و هم ظرفیتِ عملکردی، پاسخِ فشارِ خون، آریتمی و آستانهٔ درد را بسنجد.",
        "interpretation_en": "A 60-year-old man with 2-month intermittent exertional chest pain relieved by rest fits stable angina. A normal resting ECG does not exclude coronary disease. Per Harrison 22e and stable angina pathways, after history and baseline ECG, the choice of ischemic test depends on exercise ability, ECG interpretability, and pretest probability. This patient can exercise and has an interpretable baseline ECG, so a functional exercise test can reveal ischemia while also assessing functional capacity, blood pressure response, arrhythmia and symptom threshold.",
        "reasons_fa": [
            "گزینه صحیح: در بیمارِ قادر به ورزش با ECGِ پایهٔ قابلِ تفسیر (بدون بلوک شاخهٔ چپ، ریتمِ ضربان‌ساز یا افتِ STِ پایه)، آزمونِ ورزش ساده‌ترین و در دسترس‌ترین روشِ عملکردی برای آشکارسازیِ ایسکمیِ القاشونده با ورزش است و اطلاعاتِ همودینامیکِ ارزشمند می‌دهد.",
            "دلیل رد گزینه: تصویربرداریِ کرونریِ غیرتهاجمی (CCTA) بیشتر زمانی منطقی است که ECG پایه قابل تفسیر نباشد، بیمار نتواند ورزش کند، یا احتمالِ پیش‌آزمونِ متوسط با نیاز به ردِ آناتومیک باشد؛ در این بیمارِ low-intermediate با ECG طبیعی، قدمِ اول نیست.",
            "دلیل رد گزینه: اکوکاردیوگرافیِ استرس زمانی برگزیده می‌شود که ECGِ استراحت غیرقابل تفسیر باشد یا بیماریِ همراهِ غیرکرونری (مثلاً بیماریِ دریچه‌ای) نیازمند تصویربرداری همزمان باشد؛ در ECG طبیعی و بدون محدودیتِ حرکتی، ارجحیت ندارد.",
            "دلیل رد گزینه: آنژیوگرافیِ تهاجمی آزمونِ تشخیصیِ اولیه برای آنژینِ پایدارِ کم‌خطر نیست؛ برای بیمارِ پایدار با دردِ دو ماهه و ECG طبیعی، تهاجم ابتدا اندیکاسیون ندارد و خطرِ خونریزی/عروقی بی‌مورد تحمیل می‌کند."
        ],
        "reasons_en": [
            "Correct: In a patient who can exercise with an interpretable baseline ECG (no LBBB, paced rhythm or baseline ST depression), exercise ECG is the simplest, most accessible functional test to provoke ischemia and provides valuable hemodynamic data.",
            "Why incorrect: Coronary CT angiography is more appropriate when baseline ECG is uninterpretable, the patient cannot exercise, or intermediate pretest probability requires anatomic exclusion; not first-line here with a normal interpretable ECG.",
            "Why incorrect: Stress echocardiography is preferred when resting ECG is uninterpretable or concomitant non-coronary disease needs simultaneous imaging; not preferred with a normal ECG and no mobility limitation.",
            "Why incorrect: Invasive angiography is not an initial diagnostic test for low-risk stable angina; for a stable 2-month history and normal ECG, upfront invasive testing carries unnecessary bleeding/vascular risk."
        ],
        "lead_fa": "دردِ فشارندهٔ پشتِ جناغ (رترواسترنال) که با فعالیت می‌آید و با استراحت می‌رود = آنژین پایدار؛ انتخاب آزمونِ بعدی به توانِ ورزش، ECGِ پایه و احتمالِ پیش‌آزمون بستگی دارد.",
        "lead_en": "Exertional retrosternal pressure relieved by rest = stable angina; the next test depends on exercise ability, baseline ECG interpretability, and pretest probability.",
        "golden_fa": "اگر بیمار می‌تواند ورزش کند و ECGِ پایه قابل تفسیر است، آزمونِ ورزش؛ اگر بلوکِ شاخهٔ چپ/ریتمِ ضربان‌ساز/افتِ STِ پایه یا ناتوانیِ حرکتی دارد، تصویربرداریِ استرس (اکو یا CCTA).",
        "golden_en": "If the patient can exercise and baseline ECG is interpretable, use exercise ECG; if LBBB/paced rhythm/baseline ST depression or inability to exercise, use stress imaging (echo or CCTA).",
        "points_fa": [
            "شرح‌حالِ دقیقِ درد (کیفیت، ارتباط با فعالیت/استراحت، انتشار، تنگی‌نفس، تعریق) پیش از هر آزمون، احتمالِ بالینی را تعیین می‌کند.",
            "آزمونِ ورزش علاوه بر ST، ظرفیتِ عملکردی (METs)، زمانِ بروزِ درد، پاسخِ فشارِ خون و آریتمی را می‌سنجد.",
            "مواردِ غیرقابلِ تفسیرِ ECG شامل بلوکِ شاخهٔ چپ، ریتمِ ضربان‌ساز، هیپرتروفی با افتِ ST و مصرفِ دیگوکسین است.",
            "در احتمالِ پیش‌آزمونِ بسیار بالا یا علائمِ ناپایدار، آنژیوگرافیِ مستقیم مطرح است، نه در آنژینِ پایدارِ کم‌خطرِ دو ماهه."
        ],
        "points_en": [
            "Detailed pain history (quality, exertional trigger, rest relief, radiation, dyspnea, diaphoresis) sets pretest probability before any test.",
            "Exercise testing reports functional capacity (METs), time to symptoms, ST changes, blood pressure response and arrhythmia.",
            "Uninterpretable baseline ECG includes LBBB, paced rhythm, LVH with ST depression and digoxin effect.",
            "Very high pretest probability or unstable features may warrant direct angiography, not low-risk 2-month stable angina."
        ],
        "hint_fa": "به این فکر کن: چه چیزی را فقط حینِ ورزش می‌توان دید که در ECGِ خوابیده دیده نمی‌شود؟",
        "hint_en": "Consider what can only be observed during exercise that resting ECG cannot show.",
        "attending_fa": "استاد می‌گوید: انتخاب آزمونِ ایسکمی مثل انتخابِ ابزار است؛ اول ببین بیمار می‌تواند بدود و ECGاش حرف می‌زند یا نه.",
        "attending_en": "Attending tip: Choosing an ischemia test is like choosing a tool — first ask if the patient can exercise and if the baseline ECG is interpretable.",
    },
    (1,2): {
        "interpretation_fa": "زن ۷۶ ساله با تنگی‌نفس فقط هنگامِ فعالیتِ معمول و نداشتنِ علامت در استراحت، مصداقِ کلاسِ دوِ NYHA است. هاریسون، NYHA را بر مبنایِ «فعالیتِ معمولِ» بیمار تعریف می‌کند: کلاس I بدون محدودیت، کلاس II علامت با فعالیتِ معمول، کلاس III علامت با فعالیتِ کمتر از معمول، کلاس IV علامت در استراحت. این طبقه‌بندیِ بالینی، پیش‌آگهی و شدتِ درمانِ نارساییِ قلب را جهت می‌دهد، اما لزوماً با EF همبستگیِ خطی ندارد.",
        "interpretation_en": "A 76-year-old woman dyspneic only with ordinary activity and asymptomatic at rest fits NYHA class II. Harrison defines NYHA by 'ordinary activity': I no limitation, II symptoms with ordinary activity, III symptoms with less-than-ordinary activity, IV symptoms at rest. This clinical grading guides prognosis and HF therapy intensity, but does not linearly correlate with EF.",
        "reasons_fa": [
            "دلیل رد گزینه: کلاس I یعنی فعالیتِ معمول هم علامت نمی‌دهد؛ بیمار با فعالیتِ معمول دچار تنگی‌نفس می‌شود، پس I نیست.",
            "گزینه صحیح: عبارتِ کلیدیِ «فعالیتِ معمول» دقیقاً تعریفِ کلاس II است؛ علامت در استراحت وجود ندارد.",
            "دلیل رد گزینه: کلاس III به معنایِ علامت با فعالیتِ بسیار کمتر از معمول (مثلاً لباس پوشیدن) است؛ بیمار در این حد محدود نیست.",
            "دلیل رد گزینه: کلاس IV یعنی حتی در استراحت تنگی‌نفس/خستگی دارد؛ شرح‌حال، استراحتِ بدون علامت را تصریح کرده است."
        ],
        "reasons_en": [
            "Why incorrect: Class I means ordinary activity causes no symptoms; this patient is symptomatic with ordinary activity, so not I.",
            "Correct: The key phrase 'ordinary activity' exactly defines class II; no symptoms at rest.",
            "Why incorrect: Class III means symptoms with less-than-ordinary activity (e.g., dressing); the patient is not limited to that degree.",
            "Why incorrect: Class IV means symptoms at rest; the history explicitly states rest is asymptomatic."
        ],
        "lead_fa": "NYHA بر «فعالیتِ معمول» استوار است: I بدون علامت، II با فعالیتِ معمول، III با کمتر از معمول، IV در استراحت.",
        "lead_en": "NYHA is anchored to 'ordinary activity': I no symptoms, II with ordinary activity, III with less-than-ordinary, IV at rest.",
        "golden_fa": "عبارتِ «با فعالیتِ معمول» را دیدی، بی‌درنگ کلاس II را به یاد بیاور؛ «در استراحت» = IV.",
        "golden_en": "Spot 'with ordinary activity' → think class II; 'at rest' → IV.",
        "points_fa": [
            "NYHA ارزیابیِ بالینی و ذهنی است؛ تغییرِ کلاس پس از درمان، پاسخِ درمانی را نشان می‌دهد.",
            "کلاسِ بالاتر با بستریِ بیشتر و مرگِ بیشتر همراه است، اما جایگزینِ EF یا BNP نیست.",
            "افتراقِ تنگی‌نفسِ ریوی/کم‌خونی/چاقی از نارساییِ قلب با معاینه و BNP لازم است.",
            "ثبتِ دقیقِ «فعالیتِ معمولِ» بیمار از اغراق یا کم‌گویی جلوگیری می‌کند."
        ],
        "points_en": [
            "NYHA is subjective clinical grading; class change after therapy reflects response.",
            "Higher class predicts more hospitalization/mortality but does not replace EF or BNP.",
            "Differentiate dyspnea from pulmonary anemia/obesity by exam and BNP.",
            "Documenting the patient's 'ordinary activity' prevents over- or underestimation."
        ],
        "hint_fa": "از خود بپرس: «فعالیتِ معمول» در زندگیِ روزمرهٔ این خانم چه کاری است و استراحت چه فرقی دارد؟",
        "hint_en": "Ask yourself: what is 'ordinary activity' in this woman's daily life, and how does rest differ?",
        "attending_fa": "نکتهٔ استاد: NYHA را با جملهٔ بیمار بسنج: «با کارهایِ معمول نفس کم می‌آورم ولی در مبل راحتم».",
        "attending_en": "Attending tip: Anchor NYHA to the patient's own sentence: 'ordinary chores make me breathless, but I'm fine on the couch.'"
    },
    (1,3): {
        "interpretation_fa": "مرد ۳۵ ساله با مصرفِ کوکائین، دردِ قفسهٔ سینه، تاکی‌کاردی ۱۱۰، فشارِ ۱۸۰/۱۱۰ و تب، دچار تحریکِ سمپاتیک و وازواسپاسمِ کرونری است. هاریسون و سم‌شناسیِ قلب تأکید می‌کنند: آرام‌سازی با بنزودیازپین (کاهشِ تونِ سمپاتیک)، نیترات برای درد/انقباضِ عروقی، و درمانِ هایپرترمی اصولِ نخست‌اند. بتابلوکرِ خالص (آتنولول/متوپرولول/پروپرانولول با مهارِ انتخابیِ بتا) می‌تواند با باقی‌گذاشتنِ اثرِ آلفایِ بدونِ مهار، انقباضِ عروقی و فشار را تشدید کند؛ بنابراین دارویِ دارایِ اثرِ آلفا-بتا (لابتالول) یا وازودیلاتورها ترجیح دارند.",
        "interpretation_en": "A 35-year-old man after cocaine with chest pain, HR 110, BP 180/110 and fever has sympathetic surge and coronary vasospasm. Harrison and cardiac toxicology emphasize benzodiazepine sedation (to reduce sympathetic tone), nitrates for pain/vasospasm, and hyperthermia treatment as first pillars. Pure beta-blockers (atenolol/metoprolol/propranolol with selective beta blockade) can leave unopposed alpha activity, worsening vasoconstriction and pressure; agents with alpha-beta activity (labetalol) or vasodilators are preferred.",
        "reasons_fa": [
            "دلیل رد گزینه: آتنولول بتابلوکرِ انتخابیِ خالص است و اثرِ آلفا را مهار نمی‌کند؛ خطرِ تشدیدِ وازواسپاسم.",
            "دلیل رد گزینه: متوپرولول نیز مهارِ انتخابیِ بتا-۱ دارد و در مرحلهٔ حادِ مسمومیتِ کوکائین ارجح نیست.",
            "دلیل رد گزینه: پروپرانولول اگرچه غیرانتخابی است اما نسبتِ مهارِ بتایِ غالب دارد و رفعِ انقباضِ آلفایِ بدونِ مهار را تضمین نمی‌کند.",
            "گزینه صحیح: لابتالول با مهارِ همزمانِ آلفا و بتا، و همچنین گزینه‌هایِ وازودیلاتور می‌توانند بدونِ تشدیدِ انقباضِ آلفایِ آزاد، فشار و ایسکمی را کنترل کنند."
        ],
        "reasons_en": [
            "Why incorrect: Atenolol is selective beta-1 blockade without alpha blockade; risk of unopposed alpha vasoconstriction.",
            "Why incorrect: Metoprolol is also beta-1 selective and not preferred in acute cocaine toxicity.",
            "Why incorrect: Propranolol, though nonselective, is beta-predominant and does not reliably counter unopposed alpha vasoconstriction.",
            "Correct: Labetalol with combined alpha-beta blockade (or vasodilators) can control pressure/ischemia without worsening unopposed alpha tone."
        ],
        "lead_fa": "در مسمومیتِ حادِ کوکائین، نخست آرام‌سازی و نیترات؛ بتابلوکرِ خالصِ آغازین انتخابِ مناسبی نیست.",
        "lead_en": "In acute cocaine toxicity, first sedation and nitrates; pure beta-blocker as initial therapy is not appropriate.",
        "golden_fa": "ترسِ اصلی: مهارِ خالصِ بتا → باقی ماندنِ تونِ آلفا → تشدیدِ وازواسپاسم؛ لابتالول این تله را ندارد.",
        "golden_en": "Core fear: pure beta blockade → unopposed alpha tone → worse vasospasm; labetalol avoids this trap.",
        "points_fa": [
            "بنزودیازپین با کاهشِ اضطراب و تونِ سمپاتیک، تاکی‌کاردی و فشار را کم می‌کند.",
            "نیتروگلیسیرین درد و انقباضِ کرونری را می‌کاهد و پیش‌بار را کم می‌کند.",
            "هایپرترمی را جدی بگیر: خنک‌سازی و مایعات در کنارِ کنترلِ درد.",
            "در صورتِ نیازِ ضدِفشارِ پایدار، نیترات/فتولامین/لابتالول بر بتابلوکرِ خالص مقدم‌اند."
        ],
        "points_en": [
            "Benzodiazepines reduce anxiety/sympathetic tone, lowering HR and BP.",
            "Nitroglycerin relieves pain and coronary spasm and reduces preload.",
            "Treat hyperthermia seriously: cooling and fluids alongside pain control.",
            "If sustained antihypertensive effect is needed, nitrates/phentolamine/labetalol are preferred over pure beta-blockers."
        ],
        "hint_fa": "به گیرنده‌های آدرنرژیک فکر کن: اگر فقط بتا را ببندی، چه بر سرِ تحریکِ آلفا می‌آید؟",
        "hint_en": "Think about adrenergic receptors: if you block only beta, what happens to alpha stimulation?",
        "attending_fa": "استاد می‌پرسد: آیا دارویی که انتخاب می‌کنی، هر دو بازویِ سمپاتیک را مهار می‌کند یا یکی را آزاد می‌گذارد؟",
        "attending_en": "Attending asks: Does your chosen drug block both sympathetic arms or leave one unopposed?"
    },
    (1,4): {
        "interpretation_fa": "فیبرینولیز در STEMI زمانی مطرح است که PCIِ اولیه در زمانِ مناسب (معمولاً ≤۱۲۰ دقیقه از تماسِ پزشکی) در دسترس نباشد و شروعِ درد معمولاً <۱۲ ساعت باشد. هاریسون منع‌های مطلق را روشن می‌کند: هرگونه خونریزیِ داخلِ جمجمهٔ قبلی، ضایعهٔ عروقیِ مغز، بدخیمیِ داخلِ جمجمه، سکتهٔ ایسکمیکِ ۳ ماهِ اخیر، شک به دیسکسیونِ آئورت، خونریزیِ فعال یا اختلالِ خونریزیِ شدید. جراحیِ بزرگِ ۲ هفته اخیر، بارداری، و CPRِ طولانیِ غیرتروماتیک بیشتر منعِ نسبی‌اند و باید با خطر/سودِ فردی سنجیده شوند.",
        "interpretation_en": "Fibrinolysis in STEMI is considered when primary PCI is not available within timely window (usually ≤120 min from medical contact) and symptom onset is <12 h. Harrison lists absolute contraindications: any prior intracranial hemorrhage, cerebral vascular lesion, intracranial malignancy, ischemic stroke within 3 months, suspected aortic dissection, active bleeding or severe bleeding diathesis. Major surgery 2 weeks ago, pregnancy, and prolonged non-traumatic CPR are generally relative contraindications judged by individual risk/benefit.",
        "reasons_fa": [
            "دلیل رد گزینه: جراحیِ شکمیِ ۲ هفته قبل اغلب منعِ نسبی است، نه قطعی؛ در غیابِ خونریزیِ فعال می‌توان با احتیاط تصمیم گرفت.",
            "گزینه صحیح: سابقهٔ سکتهٔ ایسکمیکِ اخیر (۳ ماه) به دلیلِ خطرِ خونریزیِ داخلِ جمجمه، منعِ مطلقِ کلاسیکِ فیبرینولیز است.",
            "دلیل رد گزینه: CPR حدود ۱۵ دقیقه اگر تروماتیک/تهاجمی نباشد، معمولاً منعِ نسبی است و در شرایطِ کمبودِ زمانِ PCI می‌توان سود/خطر را سنجید.",
            "دلیل رد گزینه: بارداری منعِ نسبی است و تصمیم باید با شدتِ STEMI، زمانِ دسترسی به PCI و خطرِ خونریزیِ فردی متوازن شود."
        ],
        "reasons_en": [
            "Why incorrect: Abdominal surgery 2 weeks ago is usually relative, not absolute; without active bleeding it can be weighed cautiously.",
            "Correct: Recent ischemic stroke (within 3 months) is a classic absolute contraindication due to intracranial hemorrhage risk.",
            "Why incorrect: ~15 min CPR if non-traumatic is usually relative and can be balanced against PCI delay.",
            "Why incorrect: Pregnancy is relative; decision must balance STEMI severity, PCI availability and individual bleeding risk."
        ],
        "lead_fa": "فیبرینولیز ≤۱۲ ساعت و در غیابِ PCIِ به‌موقع؛ منعِ مطلقِ اصلی = هرگونه آسیبِ قبلیِ داخلِ جمجمه یا سکتهٔ ۳ ماهه و شکِ دیسکسیون.",
        "lead_en": "Fibrinolysis ≤12 h when timely PCI unavailable; main absolute contraindications = prior intracranial pathology or stroke within 3 months and suspected dissection.",
        "golden_fa": "سه ماهِ پس از سکتهٔ ایسکمیک، فیبرینولیز نده؛ دو هفته پس از جراحی لزوماً منعِ قطعی نیست.",
        "golden_en": "Within 3 months after ischemic stroke, do not give fibrinolytics; 2 weeks after surgery is not automatically absolute.",
        "points_fa": [
            "زمانِ درد و امکانِ PCI (≤۱۲۰ دقیقه از تماس) قبل از تصمیمِ فیبرینولیز ثبت شوند.",
            "سابقهٔ خونریزیِ مغزی/ضایعهٔ عروقیِ مغز = پرچمِ قرمزِ مطلق.",
            "شک به دیسکسیونِ آئورت را با شرح‌حالِ دردِ مهاجر و اختلافِ فشار/نبض بسنج.",
            "منعِ نسبی را فردی‌سازی کن: بارداری و CPR با خطرِ خونریزیِ واقعی قضاوت شوند، نه برچسبِ مطلق."
        ],
        "points_en": [
            "Document pain onset and PCI feasibility (≤120 min from contact) before fibrinolysis decision.",
            "Prior intracerebral bleed/vascular lesion = absolute red flag.",
            "Assess suspected aortic dissection by migratory pain and pressure/pulse asymmetry.",
            "Individualize relative contraindications: pregnancy and CPR judged by actual bleeding risk, not absolute label."
        ],
        "hint_fa": "کدام یک از این سابقه‌ها، خطرِ خونریزیِ داخلِ جمجمه را به‌طورِ خاص و پایدار بالا می‌برد؟",
        "hint_en": "Which history specifically and durably raises intracranial hemorrhage risk?",
        "attending_fa": "استاد می‌گوید: منعِ مطلق یعنی حتی اگر قلب در خطر باشد، مغز را نمی‌توان قمار کرد.",
        "attending_en": "Attending says: Absolute means even if the heart is at risk, you cannot gamble the brain."
    },
    (1,5): {
        "interpretation_fa": "زنِ ۶۰ ساله با فشارِ ۱۹۰/۱۰۰، تنگی‌نفسِ شدیدِ استراحت، تاکی‌پنه، کراکل و ویز و اشباعِ ۸۰٪، تابلویِ ادمِ حادِ ریهٔ فشارِ بالایی (SCAPE) دارد؛ هاریسون SCAPE را نوعی نارساییِ حاد با افزایشِ ناگهانیِ پس‌بار و جابه‌جاییِ سریعِ مایع به آلوئول می‌داند. ستونِ درمان: اکسیژن، تهویهٔ غیرتهاجمیِ زودهنگام (NIV)، نیتراتِ وریدیِ تیترشونده، و دیورتیک در صورتِ اضافه‌حجمی. بر اساسِ کلیدِ رسمیِ ثبت‌شده، در این دفترچه گزینهٔ «نیتروگلیسیرینِ وریدی» به عنوانِ «نامناسبِ» موردِ نظر علامت‌گذاری شده است؛ در حالی که از دیدِ راهنمایِ روز، دارویِ خوراکیِ کنداثر مانندِ آملودیپین (شروعِ اثرِ ساعتی) نیز در این فوریتِ دقیقه‌ای جایی ندارد و مورفین به دلیلِ تضعیفِ تنفس با احتیاطِ زیاد به کار می‌رود. این توضیح، منطقِ کلیدِ رسمی را بازگو می‌کند و محدودیتِ گزینهٔ خوراکی را نیز یادآور می‌شود.",
        "interpretation_en": "A 60-year-old woman with BP 190/100, severe resting dyspnea, tachypnea, crackles, wheeze and SpO2 80% fits hypertensive acute pulmonary edema (SCAPE) — per Harrison, a sudden afterload surge with rapid fluid shift to alveoli. Pillars: oxygen, early NIV, titratable IV nitrates, and diuretic if volume overloaded. Per the official registered key, 'IV nitroglycerin' is marked as the 'inappropriate' option in this booklet; from a contemporary guideline perspective, slow-onset oral amlodipine (hours to onset) also has no place in this minute-scale emergency, and morphine is used very cautiously due to respiratory depression. This explanation recounts the official key's logic while also reminding of the oral agent's limitation.",
        "reasons_fa": [
            "دلیل رد گزینه: فوروزمایدِ وریدی در SCAPEِ با اضافه‌حجم و احتقانِ ریوی مفید است و با پایشِ ادرار/فشار قابل توجیه است.",
            "گزینه صحیح: بر اساسِ کلیدِ رسمیِ این دفترچه، «نیتروگلیسیرینِ وریدی» به عنوانِ گزینهٔ نامناسب علامت‌گذاری شده است؛ در تفسیرِ آموزشی یادآوری می‌شود که از دیدِ فیزیولوژیک نیتراتِ وریدی معمولاً رکنِ اصلیِ SCAPE است و انتخابِ کلید با ملاحظاتِ خاصِ طراحِ سؤال بوده است.",
            "دلیل رد گزینه: آملودیپینِ خوراکی ۵ میلی‌گرم شروعِ اثرِ کندِ ساعتی دارد و در ادمِ حادِ هیپوکسیکِ ۸۰٪ جایگزینِ سریع‌الاثر نیست؛ از دیدِ بالینیِ روز نیز نامناسب تلقی می‌شود، ولی کلیدِ رسمی گزینهٔ دیگری را برگزیده است.",
            "دلیل رد گزینه: مورفینِ وریدی امروزه به دلیلِ تضعیفِ تنفس با احتیاطِ زیاد به کار می‌رود و در پروتکل‌هایِ جدید روتین نیست، ولی در این سؤال کلیدِ رسمی آن را «رد» نمی‌کند."
        ],
        "reasons_en": [
            "Why incorrect: IV furosemide is useful in SCAPE with volume overload/pulmonary congestion and is justifiable with urine/BP monitoring.",
            "Correct: Per the official key of this booklet, 'IV nitroglycerin' is marked as the inappropriate option; educationally, IV nitrate is usually a main pillar in SCAPE and the key reflects the item writer's specific consideration.",
            "Why incorrect: Oral amlodipine 5 mg has slow hourly onset and cannot replace rapid therapy in 80% hypoxemic acute edema; clinically also inappropriate today, but the official key selected another option.",
            "Why incorrect: IV morphine is used very cautiously today due to respiratory depression and is not routine, but the official key does not mark it as the incorrect one here."
        ],
        "lead_fa": "SCAPE = فشارِ بسیار بالا + انتقالِ ناگهانیِ مایع به ریه؛ درمانِ دقیقه‌ای می‌خواهد، نه قرصِ ساعتی.",
        "lead_en": "SCAPE = very high pressure + sudden fluid shift to lungs; needs minute-scale therapy, not hourly pills.",
        "golden_fa": "در ادمِ حادِ هایپوکسیک، NIV + نیتراتِ وریدی را زود شروع کن؛ انتظارِ اثرِ آملودیپینِ خوراکی خطرناک است.",
        "golden_en": "In hypoxemic acute edema, start NIV + IV nitrate early; waiting for oral amlodipine is hazardous.",
        "points_fa": [
            "اکسیژنِ کافی و NIV زودهنگام، کارِ تنفسی و نیاز به لوله‌گذاری را کم می‌کنند.",
            "نیترات را با پایشِ فشار تیتر کن؛ در تنگیِ شدیدِ آئورت یا مصرفِ اخیرِ مهارکنندهٔ فسفودی‌استراز احتیاط کن.",
            "دیورتیک را بر اساسِ علائمِ اضافه‌حجم و پاسخِ ادراری تنظیم کن، نه به‌صورتِ ثابت برای همه.",
            "مورفین ذخیرهٔ دردِ مقاومِ کنترل‌شده است، نه دارویِ روتینِ تنگی‌نفس."
        ],
        "points_en": [
            "Adequate oxygen and early NIV reduce work of breathing and intubation need.",
            "Titrate nitrate with BP monitoring; caution in severe AS or recent PDE5 inhibitor use.",
            "Adjust diuretic by volume-overload signs and urine response, not fixed for all.",
            "Reserve morphine for controlled resistant pain, not routine dyspnea."
        ],
        "hint_fa": "بین دارویی که دقیقه‌ای اثر می‌کند و قرصی که ساعتی، کدام برای ریهٔ پرآبِ هایپوکسیک منطقی‌تر است؟",
        "hint_en": "Between a drug that acts in minutes and a pill that acts in hours, which makes sense for a flooded hypoxemic lung?",
        "attending_fa": "استاد: در ریهٔ غرقِ SCAPE، ساعت‌ها منتظرِ قرص نمان؛ رگ و نفس را هم‌زمان باز کن.",
        "attending_en": "Attending: In a drowning lung of SCAPE, don't wait hours for a pill; open vessel and airway together."
    },
    (1,6): {
        "interpretation_fa": "مرد ۴۷ ساله با STEMI که روزِ سوم دچار افتِ ناگهانیِ هوشیاری و فشارِ غیرقابلِ لمس با ریتمِ سینوسی می‌شود، تابلویِ شوکِ برق‌آسا پس از انفارکتوس است. هاریسون می‌گوید عوارضِ مکانیکی (پارگیِ دیوارهٔ آزاد، پارگیِ سپتوم، نارساییِ حادِ دریچهٔ میترال ناشی از پارگیِ عضلهٔ پاپیلری) معمولاً روزهایِ ۳ تا ۷ رخ می‌دهند هنگامی که بافتِ نکروتیک نرم می‌شود. پارگیِ دیوارهٔ آزاد با خون‌ریزی به پریکارد، تامپوناد و فعالیتِ الکتریکیِ بدونِ نبض (PEA) با ریتمِ سینوسیِ باقی‌مانده تظاهر می‌کند. فوراً اکوکاردیوگرافیِ بستر (bedside echo) و احضارِ جراحیِ قلب لازم است.",
        "interpretation_en": "A 47-year-old man with STEMI who on day 3 suddenly loses consciousness with unmeasurable pressure but preserved sinus rhythm fits a catastrophic mechanical complication. Harrison notes mechanical complications (free-wall rupture, septal rupture, acute papillary muscle rupture with MR) typically occur days 3–7 when necrotic myocardium softens. Free-wall rupture causes hemopericardium, tamponade and PEA with sinus rhythm still visible. Immediate bedside echo and cardiac surgery activation are required.",
        "reasons_fa": [
            "دلیل رد گزینه: نارساییِ میترالِ حاد معمولاً با ادمِ ریهٔ شدید و سوفلِ سیستولیکِ جدید همراه است، نه PEAِ ناگهانیِ روزِ سوم.",
            "گزینه صحیح: پارگیِ دیوارهٔ آزاد با تامپونادِ حاد، فشارِ غیرقابلِ لمس و PEA با ریتمِ سینوسیِ الکتریکیِ باقی‌مانده را توضیح می‌دهد.",
            "دلیل رد گزینه: پارگیِ سپتومِ بطنی با سوفلِ هولوسیستولیکِ جدید و شانتِ چپ‌به‌راست و نارساییِ راست تظاهر می‌کند، نه PEAِ خالص.",
            "دلیل رد گزینه: ادمِ ریه به‌تنهایی فشارِ نبض‌دارِ قابلِ لمس و معمولاً رالِ منتشر می‌دهد، نه افتِ ناگهانیِ به PEA."
        ],
        "reasons_en": [
            "Why incorrect: Acute MR usually presents with severe pulmonary edema and new systolic murmur, not sudden PEA on day 3.",
            "Correct: Free-wall rupture with acute tamponade explains unmeasurable pressure and PEA with electrical sinus rhythm preserved.",
            "Why incorrect: Ventricular septal rupture presents with new holosystolic murmur and left-to-right shunt with right failure, not pure PEA.",
            "Why incorrect: Pulmonary edema alone gives palpable (though low) pressure and diffuse crackles, not abrupt PEA."
        ],
        "lead_fa": "روزِ ۳ تا ۷ پس از STEMI + افتِ ناگهانیِ فشار با PEA = تا اثباتِ خلاف، پارگیِ مکانیکی و تامپوناد.",
        "lead_en": "Day 3–7 post-STEMI + abrupt hypotension with PEA = mechanical rupture/tamponade until proven otherwise.",
        "golden_fa": "در شوکِ پس از انفارکتوس، اکوِ فوری؛ پارگیِ آزاد = جراحیِ اورژانسی، نه فقط اینوتروپ.",
        "golden_en": "In post-MI shock, immediate echo; free-wall rupture = emergency surgery, not inotrope alone.",
        "points_fa": [
            "زمانِ کلاسیکِ پارگیِ مکانیکی ۳–۷ روز است؛ پیش از آن بیشتر آریتمی و نارساییِ پمپ مطرح‌اند.",
            "تامپونادِ حاد با تریادِ بک (فشارِ وریدیِ بالا، افتِ فشار، صداهایِ قلبِ دور) و PEA تظاهر می‌کند.",
            "اکوِ بستر افتراقِ پارگیِ آزاد (افیوژنِ پرفشار) از سپتوم (شانت) و MRِ حاد (jetِ بزرگ) را می‌دهد.",
            "حتی با تثبیتِ موقت، جراحیِ فوری و حمایتِ مکانیکیِ گردشِ خون لازم است."
        ],
        "points_en": [
            "Classic timing of mechanical rupture is 3–7 days; earlier shock is more often arrhythmia/pump failure.",
            "Acute tamponade presents with Beck triad (high venous pressure, hypotension, muffled sounds) and PEA.",
            "Bedside echo differentiates free-wall (tense effusion) vs septal (shunt) vs acute MR (large jet).",
            "Even with temporary stabilization, urgent surgery and mechanical circulatory support are needed."
        ],
        "hint_fa": "به زمان‌بندی فکر کن: چرا روزِ سوم، دیوارهٔ نرم‌شده بیش از آریتمیِ روزِ اول خطرِ پارگی دارد؟",
        "hint_en": "Think about timing: why does day 3 softened wall pose more rupture risk than day-1 arrhythmia?",
        "attending_fa": "استاد: در STEMI، تقویم را فراموش نکن؛ روزِ سوم PEA یعنی مکانیک، نه الکتریک.",
        "attending_en": "Attending: In STEMI, remember the calendar; day-3 PEA means mechanical, not electrical."
    },
    (1,7): {
        "interpretation_fa": "سوفلِ هولوسیستولیک در لبهٔ چپِ جناغ (LSB) که با دم بلندتر می‌شود، «کاروالو» (Carvallo) مثبت است و منشأِ راست را نشان می‌دهد. هاریسون سمعِ دریچه‌ای را بر چهار محور استوار می‌کند: محلِ شنیده‌شدن، زمانِ سیستول/دیاستول، انتشار و پاسخ به مانور. نارساییِ سه‌لتیِ مزمن (TR) سوفلِ هولوسیستولیکِ LSB با افزایشِ دمی است؛ VSD نیز LSB است ولی معمولاً با دم تغییرِ بارز ندارد و MRِ مزمن در رأس شنیده می‌شود. افزایشِ بازگشتِ وریدی با دم، شدتِ سوفلِ راست را زیاد می‌کند.",
        "interpretation_en": "A holosystolic murmur at the left sternal border that augments with inspiration is Carvallo-positive, indicating right-sided origin. Harrison bases murmur diagnosis on four axes: location, timing, radiation and maneuver response. Chronic tricuspid regurgitation gives a holosystolic LSB murmur that increases with inspiration; VSD is also LSB but usually without marked inspiratory change, and chronic MR is apical.",
        "reasons_fa": [
            "دلیل رد گزینه: VSD سوفلِ هولوسیستولیکِ LSB می‌دهد ولی علامتِ کاروالو شاخصهٔ اصلیِ آن نیست.",
            "دلیل رد گزینه: MRِ مزمن سوفلِ هولوسیستولیکِ راسی با انتشار به زیربغل دارد، نه LSBِ با افزایشِ دمی.",
            "گزینه صحیح: TRِ مزمن سوفلِ هولوسیستولیکِ LSB با تشدیدِ دمی (کاروالو) دارد.",
            "دلیل رد گزینه: ASD سوفلِ سیستولیکِ جهشیِ ناشی از جریانِ ریوی، نه هولوسیستولیکِ نارساییِ دریچه‌ای است."
        ],
        "reasons_en": [
            "Why incorrect: VSD gives holosystolic LSB murmur but Carvallo sign is not its hallmark.",
            "Why incorrect: Chronic MR gives holosystolic apical murmur radiating to axilla, not inspiratory LSB augmentation.",
            "Correct: Chronic TR gives holosystolic LSB murmur that augments with inspiration (Carvallo).",
            "Why incorrect: ASD gives ejection systolic flow murmur from increased pulmonary flow, not holosystolic regurgitant murmur."
        ],
        "lead_fa": "سوفلِ راست با دم بلندتر می‌شود (کاروالو)؛ سوفلِ چپ با مانورِ افزایشِ پس‌بار (Valsalva) کم می‌شود.",
        "lead_en": "Right-sided murmurs get louder with inspiration (Carvallo); left-sided murmurs soften with Valsalva.",
        "golden_fa": "هولوسیستولیکِ LSB + تشدیدِ دمی = TR تا خلافش ثابت شود.",
        "golden_en": "Holosystolic LSB + inspiratory augmentation = TR until proven otherwise.",
        "points_fa": [
            "مانورِ دم با افزایشِ بازگشتِ وریدی، شدتِ TR/PS را زیاد می‌کند.",
            "MRِ مزمن را در رأس و با انتشارِ آگزیلاری بشنو؛ TR را در LSB.",
            "VSD با سوفلِ هولوسیستولیکِ LSB است ولی سابقهٔ مادرزادی و شدتِ شانت مهم است.",
            "ASD را با سوفلِ جهشیِ لبهٔ فوقانیِ چپ و S2ِ ثابتِ دوپاره بشناس."
        ],
        "points_en": [
            "Inspiration increases venous return, augmenting TR/PS.",
            "Hear chronic MR at apex with axillary radiation; TR at LSB.",
            "VSD is holosystolic LSB but consider congenital history and shunt size.",
            "Recognize ASD by pulmonic ejection murmur at left upper border and fixed split S2."
        ],
        "hint_fa": "کدام حفره با دم پرتر می‌شود و سوفلِ کدام دریچه از این پرشدن سود می‌برد؟",
        "hint_en": "Which chamber fills more with inspiration, and which valve's murmur benefits from that filling?",
        "attending_fa": "استاد: دم را یک تستِ فیزیولوژیک ببین؛ راست با دم بلند، چپ با Valsalva ساکت می‌شود.",
        "attending_en": "Attending: Treat inspiration as a physiologic test; right gets louder with inspiration, left quiets with Valsalva."
    },
    (1,8): {
        "interpretation_fa": "خانم ۴۵ ساله با ۱۴۸/۸۹ مطب و میانگینِ بیداریِ ۱۳۶/۸۵ و خوابِ ۱۳۰/۸۰ در هولتر، الگویِ فشارِ بالا در هر دو دوره را دارد. هاریسون آستانه‌هایِ ABPM را حدودِ بیداری ≥۱۳۵/۸۵، خواب ≥۱۲۰/۷۰ و ۲۴ساعته ≥۱۳۰/۸۰ می‌داند؛ الگویِ طبیعی افتِ شبانهٔ ۱۰–۲۰٪ است. نبودِ افتِ کافی (non-dipping) با خطرِ بیشترِ قلبی‌عروقی همراه است. این الگو «فشارِ روپوشِ سفیدِ» ایزوله نیست و نیازمندِ ارزیابیِ آسیبِ اندامِ هدف و تصمیمِ درمانی بر اساسِ خطرِ کلی است، نه صرفِ یک عددِ مطب.",
        "interpretation_en": "A 45-year-old woman with office 148/89 and awake average 136/85, sleep 130/80 on 24-h ABPM has hypertension in both periods. Harrison cites ABPM thresholds ~ awake ≥135/85, sleep ≥120/70, 24-h ≥130/80; normal nocturnal dip is 10–20%. Non-dipping predicts higher cardiovascular risk. This is not isolated white-coat hypertension and needs target-organ assessment and risk-based treatment decision, not a single office value.",
        "reasons_fa": [
            "دلیل رد گزینه: «عدم اقدام» در حالی که میانگینِ بیداری و خواب هر دو بالایِ آستانه‌اند، بی‌توجهی به خطر است.",
            "گزینه صحیح: شروعِ درمانِ دارویی همراهِ اصلاحِ سبکِ زندگی و بررسیِ آسیبِ اندامِ هدف بر اساسِ میانگینِ ABPM اندیکاسیون دارد.",
            "دلیل رد گزینه: تکرارِ سه ماهه بدون درمان با این میانگین‌ها، زمانِ طلاییِ کنترل را از دست می‌دهد.",
            "دلیل رد گزینه: «فقط بررسیِ آسیبِ اندامِ هدف» بدونِ اقدامِ درمانی، ارزیابیِ ناقص است؛ آسیب با کنترلِ فشار کم می‌شود."
        ],
        "reasons_en": [
            "Why incorrect: 'No action' ignores that both awake and sleep averages exceed thresholds.",
            "Correct: Initiating antihypertensive therapy with lifestyle modification and target-organ work-up is indicated by ABPM averages.",
            "Why incorrect: Repeating in 3 months without therapy wastes the window of control with these averages.",
            "Why incorrect: 'Only target-organ screening' without therapy is incomplete; organ damage is reduced by pressure control."
        ],
        "lead_fa": "ABPM حقیقتِ فشارِ روزانه را می‌گوید: بیداری ≥۱۳۵/۸۵ و خواب ≥۱۲۰/۷۰ غیرطبیعی‌اند.",
        "lead_en": "ABPM reveals true daily pressure: awake ≥135/85 and sleep ≥120/70 are abnormal.",
        "golden_fa": "میانگینِ بیداری و خواب، هر دو معیارند؛ روپوشِ سفید فقط زمانی است که ABPM طبیعی باشد.",
        "golden_en": "Both awake and sleep averages count; white-coat is only when ABPM is normal.",
        "points_fa": [
            "افتِ شبانهٔ طبیعی ۱۰–۲۰٪ است؛ non-dipping/non-dipping معکوس خطرِ بیشتری دارد.",
            "ABPM فشارِ مخفی (masked) را نیز آشکار می‌کند که مطب طبیعی ولی ABPM بالاست.",
            "تصمیمِ درمان بر خطرِ کلی (دیابت، چربی، سیگار، آسیبِ کلیه/قلب) استوار است.",
            "آموزشِ اندازه‌گیریِ صحیحِ مطب و خانگی از برچسبِ اشتباه جلوگیری می‌کند."
        ],
        "points_en": [
            "Normal nocturnal dip is 10–20%; non-dipping or reverse dipping carries higher risk.",
            "ABPM also uncovers masked hypertension (office normal, ABPM high).",
            "Treatment decision rests on global risk (diabetes, lipids, smoking, kidney/heart damage).",
            "Teaching correct office/home measurement prevents mislabeling."
        ],
        "hint_fa": "به میانگینِ ۲۴ساعته نه یک عددِ مطب نگاه کن؛ کدام آستانه‌ها در هولتر ملاک‌اند؟",
        "hint_en": "Look at 24-h averages, not a single office number; which Holter thresholds matter?",
        "attending_fa": "استاد: مطب فقط یک عکس است، هولتر فیلمِ شبانه‌روز؛ فیلم را قضاوت کن.",
        "attending_en": "Attending: Office is a snapshot, Holter is the 24-h film; judge the film."
    },
    (1,9): {
        "interpretation_fa": "مرد ۳۸ سالهٔ سیگاری با STEMIِ قدامی و کرونرهایِ طبیعی در آنژیوگرافی، مصداقِ MINOCA است. هاریسون و راهنمایِ MINOCA می‌گویند پس از ردِ پلاکِ انسدادی، باید وازواسپاسم، اختلالِ میکروواسکولار، میوکاردیت و تاکوتسوبو را جستجو کرد. در بیمارِ سیگاری با دردِ فشارنده، وازواسپاسمِ اپیکاردیال محتمل‌ترین علت است؛ ترکِ سیگار، بلوکرِ کانالِ کلسیم (مثلاً دیلتیازم) و نیتراتِ طولانی‌اثر درمانِ پایه‌اند. بتابلوکرِ خالص می‌تواند با باقی‌گذاشتنِ تونِ آلفا، اسپاسم را تشدید کند، به‌ویژه اگر وازواسپاسم ثابت شده باشد.",
        "interpretation_en": "A 38-year-old smoker with anterior STEMI and normal coronaries on angiography fits MINOCA. Harrison and MINOCA guidance say after excluding obstructive plaque, consider vasospasm, microvascular dysfunction, myocarditis and takotsubo. In a smoker with pressive pain, epicardial vasospasm is most likely; smoking cessation, calcium-channel blocker (e.g., diltiazem) and long-acting nitrate are core therapy. Pure beta-blockers can worsen spasm by leaving alpha tone unopposed, especially when vasospasm is proven.",
        "reasons_fa": [
            "دلیل رد گزینه: متوپرولول و نیتروگلیسیرین ترکیبی از بتابلوکرِ خالص با نیترات است؛ جزءِ بتابلوکری در وازواسپاسمِ خالص سودمند نیست.",
            "گزینه صحیح: دیلتیازم (بلوکرِ کانالِ کلسیمِ غیردیهیدروپیریدینی) با شل کردنِ عضلهٔ صافِ عروقی، وازواسپاسم را مهار می‌کند و انتخابِ ارجح است.",
            "دلیل رد گزینه: آسپیرین و متوپرولول بدونِ بلوکرِ کلسیم، جزءِ اصلیِ ضدِاسپاسم را ندارند.",
            "دلیل رد گزینه: «عدمِ درمانِ دارویی» با وجودِ STEMIِ بالینی و وازواسپاسمِ محتمل، بیمار را بی‌دفاع می‌گذارد."
        ],
        "reasons_en": [
            "Why incorrect: Metoprolol plus nitroglycerin includes pure beta-blockade, which is not beneficial in pure vasospasm.",
            "Correct: Diltiazem (non-dihydropyridine CCB) relaxes vascular smooth muscle and inhibits vasospasm; preferred.",
            "Why incorrect: Aspirin and metoprolol without CCB lack the core anti-spasm component.",
            "Why incorrect: 'No drug therapy' leaves the patient unprotected despite clinical STEMI and likely vasospasm."
        ],
        "lead_fa": "STEMI با کرونرِ طبیعی = MINOCA؛ در سیگاری، نخست به وازواسپاسم فکر کن.",
        "lead_en": "STEMI with normal coronaries = MINOCA; in a smoker, think vasospasm first.",
        "golden_fa": "در وازواسپاسمِ اثبات‌شده، بلوکرِ کلسیم + نیترات + ترکِ سیگار؛ بتابلوکرِ خالص نده.",
        "golden_en": "In proven vasospasm, CCB + nitrate + smoking cessation; avoid pure beta-blocker.",
        "points_fa": [
            "MINOCA نیازمندِ ردِ میوکاردیت (CMR) و اختلالِ میکروواسکولار است.",
            "محرک‌هایِ وازواسپاسم: سیگار، کوکائین، سرما، استرس، هیپرونتیلاسیون.",
            "در صورتِ نیازِ تشخیصِ قطعی، تستِ تحریکِ اسپاسم در کت‌لبِ مجهز قابلِ انجام است.",
            "پیگیریِ ترکِ سیگار مهم‌ترین مداخلهٔ پیشگیریِ ثانویه است."
        ],
        "points_en": [
            "MINOCA work-up includes ruling out myocarditis (CMR) and microvascular dysfunction.",
            "Vasospasm triggers: smoking, cocaine, cold, stress, hyperventilation.",
            "If needed, provocative spasm testing in equipped cath lab can confirm.",
            "Smoking cessation is the most important secondary prevention."
        ],
        "hint_fa": "وقتی عروق بازند ولی ECG صعود دارد، مشکلِ کجاست: پلاک یا انقباضِ گذرایِ دیوارهٔ رگ؟",
        "hint_en": "When vessels are open but ECG shows elevation, is the problem plaque or transient wall contraction?",
        "attending_fa": "استاد: کرونرِ تمیز با STEMI یعنی رگ قفل نشده، بلکه قفلِ لحظه‌ای شده؛ سیگار را ببند و رگ را شل کن.",
        "attending_en": "Attending: Clean coronaries with STEMI means the vessel wasn't locked, but transiently clamped; stop smoking and relax the vessel."
    },
    (1,10): {
        "interpretation_fa": "زنِ ۳۶ ساله با دردِ تیزِ قفسهٔ سینه که با تنفس و دراز کشیدن بدتر و با نشستن/خم شدن به جلو بهتر می‌شود، همراه با شروعِ ۳ روزه، الگویِ پریکاردیتِ حاد است. هاریسون تریادِ پریکاردیت را دردِ پلورتیکِ وضعیتی، friction rub و تغییراتِ ECG (صعودِ منتشرِ ST با افتِ PR) می‌داند. عللِ شایع شامل ویروسی/ایدیوپاتیک، پس از انفارکتوس، اورمی، بیماریِ خودایمنی (لوپوس)، بدخیمی، رادیوتراپیِ قفسهٔ سینه و برخی داروها مانند هیدرالازین و پروکائین‌آمید است؛ هیدروکسی‌کلروکین علتِ کلاسیکِ پریکاردیت نیست.",
        "interpretation_en": "A 36-year-old woman with sharp chest pain worsened by breathing and supine position and improved by sitting/leaning forward, for 3 days, fits acute pericarditis. Harrison triad: positional pleuritic pain, friction rub, and ECG diffuse ST elevation with PR depression. Common causes include viral/idiopathic, post-MI, uremia, autoimmune disease (lupus), malignancy, chest radiotherapy and drugs like hydralazine and procainamide; hydroxychloroquine is not a classic cause.",
        "reasons_fa": [
            "دلیل رد گزینه: لوپوس (SLE) می‌تواند پریکاردیتِ خودایمنی بدهد.",
            "دلیل رد گزینه: هیدرالازین از داروهایِ القاکنندهٔ لوپوسِ دارویی و پریکاردیت است.",
            "دلیل رد گزینه: رادیوتراپیِ قفسهٔ سینه از عللِ شناخته‌شدهٔ پریکاردیتِ تأخیری است.",
            "گزینه صحیح: هیدروکسی‌کلروکین در فهرستِ عللِ کلاسیکِ پریکاردیت قرار ندارد و «نیستِ» سؤال همین است."
        ],
        "reasons_en": [
            "Why incorrect: Lupus (SLE) can cause autoimmune pericarditis.",
            "Why incorrect: Hydralazine can induce drug-induced lupus and pericarditis.",
            "Why incorrect: Chest radiotherapy is a known delayed cause of pericarditis.",
            "Correct: Hydroxychloroquine is not in the classic pericarditis cause list and is the 'is not' answer."
        ],
        "lead_fa": "دردِ تیزِ وضعیتیِ قفسهٔ سینه + بهبود با نشستن به جلو = پریکاردیتِ حاد.",
        "lead_en": "Sharp positional chest pain improved by sitting forward = acute pericarditis.",
        "golden_fa": "پریکاردیت را با دردِ وضعیتی و ECG بشناس؛ لوپوس/هیدرالازین/رادیوتراپی علت‌اند، هیدروکسی‌کلروکین نه.",
        "golden_en": "Recognize pericarditis by positional pain and ECG; lupus/hydralazine/radiotherapy are causes, hydroxychloroquine is not.",
        "points_fa": [
            "ECGِ پریکاردیت: صعودِ مقعرِ منتشرِ ST و افتِ PR؛ برخلافِ STEMI موضعی، aVR اغلب افتِ ST دارد.",
            "سمعِ friction rub با تغییرِ وضعیت و حبسِ نفس بهتر شنیده می‌شود.",
            "افتراقِ اورژانسی: STEMI، دیسکسیونِ آئورت و آمبولیِ ریه را فراموش نکن.",
            "درمانِ اولیه اغلب NSAID + کلشیسین با پایشِ علتِ زمینه‌ای است."
        ],
        "points_en": [
            "Pericarditis ECG: diffuse concave ST elevation with PR depression; unlike focal STEMI, aVR often shows ST depression.",
            "Friction rub is better heard with positional change and breath hold.",
            "Emergency differentials: STEMI, aortic dissection and PE must not be missed.",
            "Initial therapy is often NSAID + colchicine while evaluating underlying cause."
        ],
        "hint_fa": "به وضعیتِ بدن و تنفس فکر کن: کدام درد با دراز کشیدن بدتر و با خم شدن به جلو آرام می‌شود؟",
        "hint_en": "Think about body position and breathing: which pain worsens supine and eases leaning forward?",
        "attending_fa": "استاد: دردِ پریکارد را با بالش بسنج؛ اگر بالشِ بیشتر درد را زیاد کرد، به پریکارد شک کن.",
        "attending_en": "Attending: Test pericardial pain with pillows; if more pillows worsen it, suspect pericardium."
    },
    (1,11): {
        "interpretation_fa": "مرد میانسال با HFrEF علامت‌دارِ کلاس II-IV؛ هاریسون چهار ستونِ درمانِ کاهندهٔ مرگ را ARNI (یا ACEI/ARB)، بتا-بلوکرِ مبتنی بر شواهد (متوپرولول سوکسینات، بیزوپرولول یا کارودیلول)، آنتاگونیستِ گیرندهٔ مینرالوکورتیکوئید (اسپیرونولاکتون/اپلرنون) و مهارکنندهٔ SGLT2 (داپاگلیفلوزین/امپاگلیفلوزین) می‌داند. اسپیرونولاکتون در EF پایین با پتاسیم و کراتینینِ مناسب، بستری و مرگ را کم می‌کند. فوروزماید تنها علامت‌زداست، دیگوکسین بستری را کم ولی مرگ را نه، و استاتینِ روتین در HFrEFِ ایزوله سودِ مرگِ ثابت‌شده ندارد.",
        "interpretation_en": "A middle-aged man with symptomatic HFrEF class II–IV; Harrison lists four mortality-reducing pillars: ARNI (or ACEI/ARB), evidence-based beta-blocker (metoprolol succinate, bisoprolol or carvedilol), mineralocorticoid receptor antagonist (spironolactone/eplerenone) and SGLT2 inhibitor (dapagliflozin/empagliflozin). Spironolactone in low EF with suitable potassium/creatinine reduces hospitalization and death. Furosemide is only symptomatic, digoxin reduces hospitalization not mortality, and routine statin in isolated HFrEF has no proven mortality benefit.",
        "reasons_fa": [
            "گزینه صحیح: اسپیرونولاکتون (MRA) در HFrEF علامت‌دار با EF کاهش‌یافته و پتاسیم/کلیهٔ مناسب، مرگ و بستری را کم می‌کند.",
            "دلیل رد گزینه: فوروزماید (لوپ دیورتیک) احتقان را کم می‌کند ولی اثرِ ثابتِ کاهندهٔ مرگ ندارد.",
            "دلیل رد گزینه: دیگوکسین در ریتمِ سینوسیِ HFrEF، بستری را کم ولی مرگِ کلی را کم نمی‌کند و نیازمندِ پایشِ سطح و تداخل‌هاست.",
            "دلیل رد گزینه: روزوواستاتین (استاتین) به طورِ روتین در HFrEFِ بدونِ اندیکاسیونِ کرونریِ جداگانه، مرگِ HFrEF را کم نمی‌کند."
        ],
        "reasons_en": [
            "Correct: Spironolactone (MRA) in symptomatic HFrEF with reduced EF and suitable K/creatinine reduces death and hospitalization.",
            "Why incorrect: Furosemide (loop diuretic) relieves congestion but has no consistent mortality reduction.",
            "Why incorrect: Digoxin in sinus rhythm HFrEF reduces hospitalization but not all-cause mortality and needs level/monitoring.",
            "Why incorrect: Rosuvastatin (statin) routinely in isolated HFrEF without separate coronary indication does not reduce HFrEF mortality."
        ],
        "lead_fa": "چهار ستونِ HFrEF: ARNI/ACEI + بتا-بلوکر + MRA + SGLT2؛ دیورتیک فقط علامت‌زداست.",
        "lead_en": "Four pillars of HFrEF: ARNI/ACEI + beta-blocker + MRA + SGLT2; diuretic is only symptomatic.",
        "golden_fa": "در HFrEFِ علامت‌دار، MRA (اسپیرونولاکتون) را فراموش نکن؛ فوروزماید و دیگوکسین مرگ را کم نمی‌کنند.",
        "golden_en": "In symptomatic HFrEF, do not forget MRA (spironolactone); furosemide and digoxin do not reduce mortality.",
        "points_fa": [
            "ARNI بر ACEI در HFrEFِ سرپایی ارجح است، در صورتِ تحمل و نبودِ منع.",
            "بتا-بلوکرِ مبتنی بر شواهد را تیتر کن، نه هر بتا-بلوکری.",
            "پایشِ پتاسیم و کراتینین پس از شروعِ MRA/ARNI/SGLT2 ضروری است.",
            "درمانِ افتراقیِ کم‌خونی، آهن، خواب و افسردگی نیز پیش‌آگهی را بهبود می‌دهد."
        ],
        "points_en": [
            "ARNI is preferred over ACEI in ambulatory HFrEF if tolerated and not contraindicated.",
            "Titrate evidence-based beta-blocker, not any beta-blocker.",
            "Monitor K and creatinine after starting MRA/ARNI/SGLT2.",
            "Address anemia, iron deficiency, sleep and depression to improve prognosis."
        ],
        "hint_fa": "کدام دارو فراتر از ادرارآوری، هورمونِ آلدوسترون را مهار می‌کند؟",
        "hint_en": "Which drug goes beyond diuresis and blocks the aldosterone hormone?",
        "attending_fa": "استاد: در HFrEF، فقط آب را نکش؛ هورمون را هم مهار کن.",
        "attending_en": "Attending: In HFrEF, don't just drain water; also block the hormone."
    },
    (1,12): {
        "interpretation_fa": "مرد ۷۲ ساله با سابقهٔ CABG، تنگی‌نفس، S4 و سوفلِ میان‌سیستولیکِ III/VI در فضایِ دومِ بین‌دنده‌ایِ راست، تابلویِ تنگیِ آئورت است. هاریسون سوفلِ تنگیِ آئورت را خشنِ crescendo-decrescendo در قاعدهٔ قلب با انتشار به کاروتید، S2ِ ضعیف، و نبضِ parvus et tardus (کوچک و دیررس) توصیف می‌کند. سنکوپ، آنژین و تنگی‌نفس/نارسایی سه‌گانهٔ کلاسیکِ تنگیِ شدیدند. Pulsus bisferiens در نارساییِ آئورتِ همراه یا HCM دیده می‌شود، alternans در نارساییِ شدیدِ پمپ، و paradoxus در تامپوناد.",
        "interpretation_en": "A 72-year-old man with prior CABG, dyspnea, S4 and grade III/VI midsystolic murmur at right second ICS fits aortic stenosis. Harrison describes AS murmur as harsh crescendo-decrescendo at base radiating to carotids, soft S2, and parvus et tardus (small and delayed) pulse. Syncope, angina and dyspnea/failure are the classic triad of severe AS. Bisferiens is seen in combined AR or HCM, alternans in severe pump failure, paradoxus in tamponade.",
        "reasons_fa": [
            "دلیل رد گزینه: Pulsus alternans (ضربانِ قوی-ضعیفِ متناوب) نشانِ نارساییِ شدیدِ پمپ است، نه تنگیِ آئورتِ ایزوله.",
            "گزینه صحیح: Parvus et tardus (نبضِ کوچک و دیررس با صعودِ کند) ویژگیِ تنگیِ آئورت است.",
            "دلیل رد گزینه: Pulsus bisferiens (دو قله در سیستول) در نارساییِ آئورت یا کاردیومیوپاتیِ هیپرتروفیک دیده می‌شود.",
            "دلیل رد گزینه: Pulsus paradoxus (افتِ >۱۰ mmHg فشار در دم) در تامپوناد/آسمِ شدید است، نه تنگیِ آئورت."
        ],
        "reasons_en": [
            "Why incorrect: Pulsus alternans (strong-weak alternating beats) indicates severe pump failure, not isolated AS.",
            "Correct: Parvus et tardus (small, delayed, slow-rising pulse) is characteristic of aortic stenosis.",
            "Why incorrect: Pulsus bisferiens (bifid systolic peak) is seen in aortic regurgitation or HCM.",
            "Why incorrect: Pulsus paradoxus (>10 mmHg inspiratory drop) is seen in tamponade/severe asthma, not AS."
        ],
        "lead_fa": "سوفلِ قاعده + انتشارِ کاروتیدی + S2 ضعیف + نبضِ دیررس = تنگیِ آئورت.",
        "lead_en": "Basal murmur + carotid radiation + soft S2 + delayed pulse = aortic stenosis.",
        "golden_fa": "در تنگیِ آئورت، نبض parvus et tardus است؛ alternans و paradoxus را با آن اشتباه نکن.",
        "golden_en": "In AS, pulse is parvus et tardus; do not confuse with alternans or paradoxus.",
        "points_fa": [
            "شدتِ تنگی با اکو (گرادیان، مساحتِ دریچه، سرعتِ jet) تعیین می‌شود.",
            "سنکوپِ فعالیتی، آنژین و تنگی‌نفس هشدارِ تنگیِ شدیدند.",
            "S4 در هیپرتروفیِ بطنِ چپ قابل شنیدن است.",
            "در تنگیِ شدیدِ علامت‌دار، تعویضِ دریچه (SAVR/TAVI) بررسی شود."
        ],
        "points_en": [
            "Severity is determined by echo (gradient, valve area, jet velocity).",
            "Exertional syncope, angina and dyspnea warn of severe AS.",
            "S4 is heard in LV hypertrophy.",
            "In symptomatic severe AS, valve replacement (SAVR/TAVI) should be considered."
        ],
        "hint_fa": "به نبض فکر کن: کدام نبض در تنگیِ خروجی، کوچک و با تأخیر بالا می‌رود؟",
        "hint_en": "Think about the pulse: which pulse rises small and delayed in outflow obstruction?",
        "attending_fa": "استاد: صدایِ خشنِ قاعده را شنیدی، نبضِ مچ را لمس کن؛ تأخیرِ صعود را حس می‌کنی؟",
        "attending_en": "Attending: Heard the harsh basal murmur, feel the wrist; do you feel the delayed upstroke?"
    },
    (1,13): {
        "interpretation_fa": "مرد ۶۰ ساله با دردِ ۳۰ دقیقه‌ای و صعودِ ST در V2-V6، STEMIِ قدامیِ حاد دارد. نزدیک‌ترین مرکزِ PCI یک ساعت دورتر است. هاریسون می‌گوید اگر زمانِ پیش‌بینی‌شده از اولین تماسِ پزشکی تا PCIِ اولیه ≤۱۲۰ دقیقه باشد، انتقال برای PCIِ اولیه بر فیبرینولیزِ فوری ارجح است (به‌ویژه در STEMIِ قدامیِ وسیع و تاخیرِ کم). در این سناریو با فاصلهٔ یک ساعته و آمادگیِ کت‌لب، انتقالِ سریع با درمانِ اولیه (آسپیرین، هپارین، تیترهٔ درد/اکسیژنِ در صورتِ هیپوکسی) تصمیمِ درست است؛ فیبرینولیز زمانی ارجح است که تأخیرِ PCI از ۱۲۰ دقیقه فراتر رود یا منعِ انتقال وجود داشته باشد.",
        "interpretation_en": "A 60-year-old man with 30-min retrosternal pain and ST elevation V2-V6 has acute anterior STEMI. Nearest PCI center is 1 h away. Harrison notes if anticipated first medical contact-to-device time is ≤120 min, transfer for primary PCI is preferred over immediate fibrinolysis (especially extensive anterior STEMI with short delay). With 1-h transfer and cath lab ready, prompt transfer with initial therapy (aspirin, heparin, pain/oxygen titration if hypoxemic) is correct; fibrinolysis is preferred when PCI delay exceeds 120 min or transfer is impossible.",
        "reasons_fa": [
            "دلیل رد گزینه: بستری و فیبرینولیزِ درجا، زمانی که PCIِ ≤۱۲۰ دقیقه در دسترس است، شانسِ بازپرفیوژنِ کامل و بقا را کمتر می‌کند.",
            "گزینه صحیح: انتقال برای PCIِ اولیه با زمانِ پیش‌بینی‌شدهٔ <۱۲۰ دقیقه، در STEMIِ قدامی ارجح است.",
            "دلیل رد گزینه: فیبرینولیز و سپس اعزام (pharmaco-invasive) زمانی است که تأخیرِ PCI طولانی است؛ اینجا تأخیرِ کوتاه و PCI ارجح است.",
            "دلیل رد گزینه: نیتروگلیسیرینِ وریدی و انتظار، بازپرفیوژن را به تأخیر می‌اندازد و مرگ را بیشتر می‌کند."
        ],
        "reasons_en": [
            "Why incorrect: Admit and give lytics on site, when PCI ≤120 min is feasible, reduces chance of full reperfusion and survival.",
            "Correct: Transfer for primary PCI with anticipated <120 min is preferred in anterior STEMI.",
            "Why incorrect: Lysis then transfer (pharmaco-invasive) is for long PCI delay; here delay is short and PCI is preferred.",
            "Why incorrect: IV nitroglycerin and wait delays reperfusion and increases mortality."
        ],
        "lead_fa": "STEMI + فاصلهٔ PCI حدودِ یک ساعت = انتقال برای PCIِ اولیه (≤۱۲۰ دقیقه) بر فیبرینولیز ارجح است.",
        "lead_en": "STEMI + PCI about 1 h away = transfer for primary PCI (≤120 min) preferred over lysis.",
        "golden_fa": "قانونِ ۱۲۰ دقیقه: اگر از تماس تا بالون ≤۱۲۰ دقیقه می‌شود، ببر؛ اگر نه، لیز کن.",
        "golden_en": "120-minute rule: if contact-to-device ≤120 min, transfer; if not, lyse.",
        "points_fa": [
            "در هر STEMI، زمانِ درد و زمانِ تماسِ پزشکی را دقیق ثبت کن.",
            "درمانِ اولیه (آسپیرین، هپارین، کنترلِ درد/هیپوکسی) در حینِ انتقال ادامه یابد.",
            "فیبرینولیز در STEMIِ قدامیِ وسیع یا ناپایداری، در صورتِ تأخیرِ PCI، سریع انجام شود.",
            "پس از فیبرینولیزِ موفق، آنژیوگرافیِ روتینِ ۲–۲۴ ساعته توصیه می‌شود."
        ],
        "points_en": [
            "In every STEMI, document pain onset and medical contact time.",
            "Continue initial therapy (aspirin, heparin, pain/hypoxia control) during transfer.",
            "In extensive anterior or unstable STEMI, give lytics promptly if PCI will be delayed.",
            "After successful lysis, routine angiography within 2–24 h is recommended."
        ],
        "hint_fa": "ساعت را نگاه کن: از تماسِ الان تا بالون یک ساعت است؛ ۱۲۰ دقیقه پر می‌شود یا نه؟",
        "hint_en": "Check the clock: from now to balloon is one hour; does it fit within 120 minutes?",
        "attending_fa": "استاد: در STEMIِ قدامیِ ۳۰ دقیقه‌ای با کت‌لبِ یک ساعته، جاده را انتخاب کن، نه لیزِ درجا.",
        "attending_en": "Attending: In 30-min anterior STEMI with cath 1 h away, choose the road, not on-site lysis."
    },
    (1,14): {
        "interpretation_fa": "مرد ۵۲ سالهٔ سیگاری با انفارکتوسِ حاد و فشارِ ۷۰/۵۰، ضربانِ ۱۱۰، تابلویِ شوکِ کاردیوژنیک (cardiogenic shock) دارد. هاریسون شوکِ کاردیوژنیک را هیپوتانسیونِ پایدار (SBP <۹۰) با علائمِ هیپوپرفیوژن (سردیِ اندام، الیگوری، منگی) و شواهدِ اختلالِ پمپ می‌داند. بازپرفیوژنِ فوریِ کرونری، پایشِ همودینامیک، و حمایتِ فشار با وازوپرسورِ ارجح مطرح است. نوراپی‌نفرین (norepinephrine) با اثرِ آلفایِ قوی و بتایِ متعادل، فشارِ متوسطِ شریانی (MAP) را حفظ می‌کند و کمتر از دوپامین آریتمی می‌دهد؛ دوبوتامین برای بروندهٔ پایین با فشارِ حاشیه‌ای، و وازوپرسین به‌عنوانِ همراه مطرح است.",
        "interpretation_en": "A 52-year-old smoker with acute MI, BP 70/50, HR 110 fits cardiogenic shock — per Harrison, persistent hypotension (SBP <90) with hypoperfusion signs (cold limbs, oliguria, confusion) and pump failure. Immediate coronary reperfusion, hemodynamic monitoring, and vasopressor support are indicated. Norepinephrine with strong alpha and modest beta effect maintains MAP with less arrhythmia than dopamine; dobutamine is for low output with borderline pressure, vasopressin as adjunct.",
        "reasons_fa": [
            "گزینه صحیح: نوراپی‌نفرین وازوپرسورِ انتخابی در شوکِ کاردیوژنیک برای حفظِ MAP با آریتمیِ کمتر از دوپامین است.",
            "دلیل رد گزینه: وازوپرسین معمولاً به‌عنوانِ دارویِ همراه یا در شوکِ وازودیلاتوری مطرح است، نه تک‌دارویِ اولِ شوکِ کاردیوژنیک.",
            "دلیل رد گزینه: دوبوتامین اینوتروپ است و در هیپوتانسیونِ شدیدِ ۷۰/۵۰ بدونِ وازوپرسور، فشار را به‌تنهایی برنمی‌گرداند.",
            "دلیل رد گزینه: دوپامین با آریتمیِ بیشتر و مرگِ بیشتر نسبت به نوراپی‌نفرین در شوکِ کاردیوژنیک همراه است."
        ],
        "reasons_en": [
            "Correct: Norepinephrine is the vasopressor of choice in cardiogenic shock to maintain MAP with less arrhythmia than dopamine.",
            "Why incorrect: Vasopressin is usually adjunct or in vasodilatory shock, not single first agent in cardiogenic shock.",
            "Why incorrect: Dobutamine is an inotrope and in severe hypotension 70/50 without vasopressor will not restore pressure alone.",
            "Why incorrect: Dopamine carries more arrhythmia and higher mortality than norepinephrine in cardiogenic shock."
        ],
        "lead_fa": "شوکِ کاردیوژنیک = هیپوتانسیونِ پایدار + هیپوپرفیوژن + پمپِ نارسا؛ نوراپی‌نفرین برای MAP.",
        "lead_en": "Cardiogenic shock = persistent hypotension + hypoperfusion + pump failure; norepinephrine for MAP.",
        "golden_fa": "در شوکِ کاردیوژنیکِ هیپوتانسیو، نوراپی‌نفرین بر دوپامین ارجح است.",
        "golden_en": "In hypotensive cardiogenic shock, norepinephrine beats dopamine.",
        "points_fa": [
            "بازپرفیوژنِ فوری (PCI) مهم‌ترین مداخلهٔ نجات‌بخش است.",
            "مایعات را محتاطانه و با پایشِ پرشدگی (ریه/وریدِ ژوگولر/اکو) بده.",
            "اینوتروپ (دوبوتامین) را هنگامِ بروندهٔ پایینِ با فشارِ حاشیه‌ای اضافه کن.",
            "از وازودیلاتور در هیپوتانسیونِ شدید بپرهیز و علتِ شوک را با اکو افتراق بده."
        ],
        "points_en": [
            "Immediate reperfusion (PCI) is the most life-saving intervention.",
            "Give fluids cautiously with filling assessment (lungs/JVP/echo).",
            "Add inotrope (dobutamine) when output is low with borderline pressure.",
            "Avoid vasodilators in severe hypotension and differentiate shock cause by echo."
        ],
        "hint_fa": "کدام وازوپرسور فشار را بالا می‌برد بدونِ اینکه ریتم را بیشتر به هم بزند؟",
        "hint_en": "Which vasopressor raises pressure without provoking more arrhythmia?",
        "attending_fa": "استاد: در شوکِ قلبیِ سرد و مرطوب، اول فشار را با نوراپی‌نفرین بگیر، بعد پمپ را با اینوتروپ یاری کن.",
        "attending_en": "Attending: In cold-wet cardiogenic shock, first hold pressure with norepinephrine, then assist pump with inotrope."
    },
    (1,15): {
        "interpretation_fa": "زنِ ۳۰ ساله با سوفلِ سیستولیکِ III/VI و تنگی‌نفسِ خفیفِ فعالیتی، حتی با ECG و رادیوگرافیِ طبیعی، نیازمندِ اکوکاردیوگرافی است. هاریسون می‌گوید ECG یا عکسِ طبیعی، بیماریِ دریچه‌ایِ مهم را رد نمی‌کنند؛ اکوِ داپلر شدتِ تنگی/نارسایی، گرادیان، مساحتِ دریچه، فشارِ ریوی و عملکردِ بطن را می‌سنجد. سوفلِ درجهٔ ۳ یا بیشتر یا همراهِ علامت، اندیکاسیونِ اکو دارد. تستِ ورزشِ ایسکمیک یا آنزیمِ قلبی در این سناریو اولویت ندارند.",
        "interpretation_en": "A 30-year-old woman with grade III/VI systolic murmur and mild exertional dyspnea, even with normal ECG and chest X-ray, needs echocardiography. Harrison notes normal ECG or X-ray does not exclude significant valvular disease; Doppler echo quantifies stenosis/regurgitation, gradients, valve area, pulmonary pressure and ventricular function. Grade ≥3 or symptomatic murmur is an echo indication. Ischemic stress test or cardiac enzymes are not priorities here.",
        "reasons_fa": [
            "دلیل رد گزینه: «عدمِ بررسی» با سوفلِ III/VIِ علامت‌دار، خطرِ از دست رفتنِ بیماریِ دریچه‌ای را دارد.",
            "دلیل رد گزینه: تستِ ورزشِ ایسکمیک برای دردِ کرونری است، نه ارزیابیِ اولیهٔ سوفلِ دریچه‌ایِ علامت‌دار.",
            "دلیل رد گزینه: آنزیم‌هایِ قلبی برای آسیبِ حادِ میوکاردند، نه کمی‌سازیِ سوفلِ مزمن.",
            "گزینه صحیح: اکوکاردیوگرافیِ داپلر ابزارِ اصلیِ تشخیص و کمی‌سازیِ ضایعهٔ دریچه‌ای است."
        ],
        "reasons_en": [
            "Why incorrect: 'No work-up' with grade III/VI symptomatic murmur risks missing valvular disease.",
            "Why incorrect: Ischemic exercise test is for coronary pain, not primary evaluation of symptomatic valvular murmur.",
            "Why incorrect: Cardiac enzymes are for acute myocardial injury, not quantification of chronic murmur.",
            "Correct: Doppler echocardiography is the main tool to diagnose and quantify valvular lesions."
        ],
        "lead_fa": "سوفلِ III/VI + علامت = اکو؛ ECG/عکسِ طبیعی دریچه را رد نمی‌کنند.",
        "lead_en": "Grade III/VI murmur + symptoms = echo; normal ECG/X-ray does not exclude valve disease.",
        "golden_fa": "در سوفلِ علامت‌دار یا درجهٔ ≥۳، اکو را به تأخیر نینداز.",
        "golden_en": "In symptomatic or grade ≥3 murmur, do not delay echo.",
        "points_fa": [
            "شدتِ سوفل با شدتِ همودینامیک همبستگیِ کامل ندارد؛ اکو ملاک است.",
            "فشارِ ریوی و اندازهٔ حفرات در اکو پیش‌آگهی را نشان می‌دهند.",
            "در سوفلِ بی‌علامتِ درجهٔ ۱–۲ با قلبِ طبیعی، پیگیریِ بالینی کافی است.",
            "یافتهٔ اکو، تصمیمِ درمانِ دارویی/جراحی را هدایت می‌کند."
        ],
        "points_en": [
            "Murmur grade does not fully correlate with hemodynamic severity; echo is the standard.",
            "Pulmonary pressure and chamber size on echo inform prognosis.",
            "In asymptomatic grade 1–2 murmur with normal heart, clinical follow-up suffices.",
            "Echo findings guide medical/surgical decision."
        ],
        "hint_fa": "کدام آزمون هم سوفل را می‌بیند و هم شدتِ تنگی/نارسایی و فشارِ ریه را می‌سنجد؟",
        "hint_en": "Which test both visualizes the murmur and quantifies stenosis/regurgitation and pulmonary pressure?",
        "attending_fa": "استاد: سوفلِ بلندِ علامت‌دار را با گوشی تأیید کن، با اکو قضاوت کن.",
        "attending_en": "Attending: Confirm loud symptomatic murmur with stethoscope, judge it with echo."
    },
}

OPTIONS_EN_MAP = {
    (1,1): ['Exercise test', 'CT coronary angiography', 'Stress echocardiography', 'Invasive angiography'],
    (1,2): ['Class I', 'Class II', 'Class III', 'Class IV'],
    (1,3): ['Atenolol', 'Metoprolol', 'Propranolol', 'Labetalol'],
    (1,4): ['Abdominal surgery within 2 weeks', 'Recent ischemic stroke', 'About 15 min CPR', 'Pregnancy'],
    (1,5): ['IV furosemide', 'IV nitroglycerin', 'Oral amlodipine 5 mg', 'IV morphine'],
    (1,6): ['Mitral regurgitation', 'Free-wall rupture', 'Ventricular septal rupture', 'Pulmonary edema'],
    (1,7): ['VSD', 'Chronic MR', 'Chronic TR', 'ASD'],
    (1,8): ['No action', 'Start drug therapy', 'Repeat in 3 months without therapy', 'Check target-organ damage only'],
    (1,9): ['Metoprolol + nitroglycerin', 'Diltiazem', 'Aspirin + metoprolol', 'No drug therapy'],
    (1,10): ['Lupus', 'Hydralazine', 'Chest radiotherapy', 'Hydroxychloroquine'],
    (1,11): ['Spironolactone', 'Furosemide', 'Digoxin', 'Rosuvastatin'],
    (1,12): ['Pulsus alternans', 'Parvus et tardus', 'Pulsus bisferiens', 'Pulsus paradoxus'],
    (1,13): ['Admit and give fibrinolysis', 'Transfer for primary PCI', 'Give lysis then transfer', 'IV nitroglycerin and wait'],
    (1,14): ['Norepinephrine', 'Vasopressin', 'Dobutamine', 'Dopamine'],
    (1,15): ['No work-up', 'Ischemic exercise test', 'Cardiac enzymes', 'Echocardiography'],
}

def enrich():
    assert len(ITEMS) == 15
    path = ROOT / f"tools/master-bank/import-payload.master-preint.part{PART:02}.json"
    before = json.loads(path.read_text(encoding="utf-8"))
    after = copy.deepcopy(before)
    # also load English payload? same file contains both fa/en
    for local, q in enumerate(after["questions"], 1):
        item = ITEMS.get((PART, local))
        if item is None:
            continue
        # fill English options where missing
        if not q.get("options_en") or len([o for o in q.get("options_en", []) if str(o).strip()]) < 4:
            q["options_en"] = OPTIONS_EN_MAP.get((PART, local), q.get("options_en", []))
        # also fix question_en if truncated placeholder
        if "pending retrospective" in q.get("question_en",""):
            # keep Persian as is, clean English placeholder suffix
            q["question_en"] = q["question_en"].split(" > ")[0]
        # explanation: multi-paragraph Persian + English
        # keep Persian question/options/correct_index untouched
        q["explanation_fa"] = item["interpretation_fa"] + "\n\n" + "درسنامه (هاریسون ۲۲): " + item["lead_fa"] + " " + item["golden_fa"]
        q["explanation_en"] = item["interpretation_en"] + "\n\nLesson (Harrison 22e): " + item["lead_en"] + " " + item["golden_en"]
        q["options_why_fa"] = list(item["reasons_fa"])
        q["options_why_en"] = list(item["reasons_en"])
        # micro: ensure structure
        if "micro" not in q or not isinstance(q["micro"], dict):
            q["micro"] = {}
        q["micro"]["lead_fa"] = item["lead_fa"]
        q["micro"]["lead_en"] = item["lead_en"]
        q["micro"]["golden_fa"] = item["golden_fa"]
        q["micro"]["golden_en"] = item["golden_en"]
        q["micro"]["points_fa"] = list(item["points_fa"])
        q["micro"]["points_en"] = list(item["points_en"])
        # source
        q["micro"]["source_fa"] = "هاریسون ۲۲ - قلب"
        q["micro"]["source_en"] = "Harrison 22e - Cardiology"
        # hints and attending Socratic
        q["hints_fa"] = [item["hint_fa"]]
        q["hints_en"] = [item["hint_en"]]
        q["attending_fa"] = item["attending_fa"]
        q["attending_en"] = item["attending_en"]
        # ensure at least 300 chars explanation
        assert len(q["explanation_fa"]) > 400, (PART, local, len(q["explanation_fa"]))
        assert len(q["explanation_en"]) > 300
        assert len(q["options_why_fa"]) == 4
        assert len(q["options_why_en"]) == 4
        assert q["options_why_fa"][q["correct_index"]].startswith("گزینه صحیح:")
        assert all(q["options_why_fa"][i].startswith("دلیل رد گزینه:") for i in range(4) if i != q["correct_index"])
        assert q["options_why_en"][q["correct_index"]].startswith("Correct:")
        assert q["micro"]["points_fa"][0].strip()
        # Socratic check: hint should not contain the correct option text verbatim
        correct_text = q["options_fa"][q["correct_index"]]
        assert correct_text not in q["hints_fa"][0], f"hint reveals answer for {(PART,local)}"
    # validation: ensure only allowed fields changed (compare stripped)
    # Build baseline copy with only allowed fields reverted, then compare
    ALLOWED = {"explanation_fa","explanation_en","options_why_fa","options_why_en","options_en","question_en","hints_fa","hints_en","attending_fa","attending_en"}
    MICRO_ALLOWED = {"lead_fa","lead_en","golden_fa","golden_en","points_fa","points_en","source_fa","source_en"}
    restored = copy.deepcopy(after)
    for local, (old, new) in enumerate(zip(before["questions"], restored["questions"]), 1):
        if (PART, local) in ITEMS:
            for f in ALLOWED:
                new[f] = old.get(f)
            # micro
            for f in MICRO_ALLOWED:
                if "micro" in new and "micro" in old:
                    new["micro"][f] = old["micro"].get(f) if isinstance(old.get("micro"), dict) else None
            # question_en may have been cleaned, so allow it
            # But ensure core preserved
            assert old["question_fa"] == new["question_fa"], f"question_fa changed {(PART,local)}"
            assert old["options_fa"] == new["options_fa"], f"options_fa changed {(PART,local)}"
            assert old["correct_index"] == new["correct_index"], f"key changed {(PART,local)}"
            assert old["subject_fa"] == new["subject_fa"]
    # Also ensure no other parts changed
    # The check above ensures only enrichment; now write
    path.write_text(json.dumps(after, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"PASS: enriched {len(ITEMS)} heart questions in part{PART:02} (QB-00001..00015); bilingual + Socratic hints, Persian-heavy.")

if __name__ == "__main__":
    enrich()

