#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Batch10: part01 Q136-151 excluding 147 (BROKEN)"""
import copy, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
PART = 1
ITEMS = {
    (1,136): {
        "interpretation_fa": "بیمار با ادم ریه حاد کاردیوژنیک تنگی نفس شدید، رال و هیپوکسمی دارد. کاهش پیش‌بار و پس‌بار با نیترات در فشار مناسب اولین قدم است؛ نیتروگلیسیرین زیرزبانی سریع اثر می‌کند و در بیمار با فشار قابل قبول نسبت به مورفین یا فورزماید به‌تنهایی اولویت دارد. دیگوکسین اینوتروپ حاد ریه نیست و مورفین روتین نیست. اکسیژن، تهویه غیرتهاجمی و دیورتیک در احتقان همراه‌اند و بتابلوکر در دکمپانسیون حاد شروع نمی‌شود. این نکته در هاریسون با تأکید بر پایش فشار و اکسیژن آمده است.",
        "interpretation_en": "Patient with acute cardiogenic pulmonary edema has severe dyspnea, rales and hypoxemia. Preload and afterload reduction with nitrate at suitable pressure is first; sublingual nitro fast acts and at acceptable pressure preferred over morphine or furosemide alone. Digoxin not acute lung inotrope and morphine not routine. Oxygen, NIV and diuretic for congestion adjunct and beta not started in acute decompensation. Harrison stresses pressure and oxygen monitoring.",
        "reasons_fa": [
            "گزینه صحیح: نیتروگلیسیرین زیرزبانی خط اول در ادم حاد با فشار مناسب است.",
            "دلیل رد گزینه: مورفین روتین خط اول نیست و با احتیاط است.",
            "دلیل رد گزینه: فورزماید برای احتقان همراه است نه تنهایی خط اول.",
            "دلیل رد گزینه: دیگوکسین اینوتروپ حاد ریه نیست."
        ],
        "reasons_en": [
            "Correct: Sublingual nitroglycerin first line in acute edema with suitable pressure.",
            "Why incorrect: Morphine not routine first line and cautious.",
            "Why incorrect: Furosemide for congestion adjunct not lone first line.",
            "Why incorrect: Digoxin not acute pulmonary inotrope."
        ],
        "lead_fa": "ادم حاد کاردیوژنیک یعنی اول نیترات با فشار مناسب.",
        "lead_en": "Acute cardiogenic edema means nitrate first with suitable pressure.",
        "golden_fa": "نیترات ریه را سبک می‌کند.",
        "golden_en": "Nitrate lightens lungs.",
        "points_fa": ["اکسیژن و NIV.", "فشار را بسنج.", "دیورتیک برای رال.", "بتا را شروع نکن."],
        "points_en": ["Oxygen and NIV.", "Check pressure.", "Diuretic for rales.", "Don't start beta."],
        "hint_fa": "کدام زیرزبانی ریه را سریع سبک می‌کند؟",
        "hint_en": "Which sublingual quickly lightens lungs?",
        "attending_fa": "استاد: ادم حاد را با نیترات شروع کن.",
        "attending_en": "Attending: Start acute edema with nitrate."
    },
    (1,137): {
        "interpretation_fa": "در معاینه قلبی، سیانوز مرکزی به‌صورت آبی لب و مخاط از هیپوکسمی شریانی یا شانت راست‌به‌چپ دیده می‌شود و در نارسایی قلبی با افت برون‌ده یا ادم ریه هم قابل مشاهده است. سیانوز محیطی بیشتر سردی و جریان کم، گره اسلر در اندوکاردیت و حلقه آرکوس در جوانی به نفع چربی بالا است ولی هر یک به‌تنهایی تشخیص قلبی نیست و با سن و شرح حال تفسیر می‌شود. سیانوز مرکزی سرنخ مهم هیپوکسمی است.",
        "interpretation_en": "On cardiac exam, central cyanosis as blue lips/mucosa from arterial hypoxemia or right-to-left shunt seen and in heart failure with low output or pulmonary edema also visible. Peripheral cyanosis more cold/low flow, Osler nodes in endocarditis and arcus in youth suggests dyslipidemia but alone not diagnostic and interpreted with age and history. Central cyanosis important hypoxemia clue.",
        "reasons_fa": [
            "گزینه صحیح: سیانوز مرکزی در مشکلات قلبی با هیپوکسمی قابل مشاهده است.",
            "دلیل رد گزینه: سیانوز محیطی بیشتر سرما/جریان کم است.",
            "دلیل رد گزینه: گره اسلر خاص اندوکاردیت است نه هر مشکل قلبی.",
            "دلیل رد گزینه: آرکوس بیشتر چربی و سن است."
        ],
        "reasons_en": [
            "Correct: Central cyanosis visible in cardiac issues with hypoxemia.",
            "Why incorrect: Peripheral more cold/low flow.",
            "Why incorrect: Osler specific endocarditis not every cardiac issue.",
            "Why incorrect: Arcus more lipids and age."
        ],
        "lead_fa": "آبی لب یعنی مرکزی را ببین.",
        "lead_en": "Blue lips means see central.",
        "golden_fa": "هیپوکسمی را با مرکزی بسنج.",
        "golden_en": "Judge hypoxemia by central.",
        "points_fa": ["لب و مخاط را ببین.", "اکسیژن را بسنج.", "شانت را فکر کن.", "محیطی را با سرما اشتباه نگیر."],
        "points_en": ["See lips and mucosa.", "Check oxygen.", "Think shunt.", "Don't confuse peripheral with cold."],
        "hint_fa": "کدام آبی از ریه و قلب می‌آید؟",
        "hint_en": "Which blue comes from lung and heart?",
        "attending_fa": "استاد: مرکزی را قلبی ببین.",
        "attending_en": "Attending: View central as cardiac."
    },
    (1,138): {
        "interpretation_fa": "زن ۵۳ ساله با کاردیومیوپاتی هیپرتروفیک انسدادی با وجود درمان، تنگی نفس فعالیتی دارد. انسداد با کاهش حجم یا افزایش انقباض تشدید می‌شود؛ بتابلوکر و وراپامیل پایه‌اند و دیسوپیرامید با اثر منفی اینوتروپ قوی، گرادیان خروجی را کم و علائم انسدادی را بهبود می‌دهد. دیلتیازم اثر کمتر و فوروزماید با کم‌آبی انسداد را بدتر می‌کند. ارزیابی خطر مرگ ناگهانی و درمان کاهش سپتوم در مقاوم مطرح است.",
        "interpretation_en": "A 53-year-old with obstructive HCM despite therapy has exertional dyspnea. Obstruction worsens with less volume or more contractility; beta and verapamil base and disopyramide with strong negative inotrope reduces outflow gradient and improves obstructive symptoms. Diltiazem less effect and furosemide with dehydration worsens obstruction. Evaluate sudden death risk and septal reduction in refractory.",
        "reasons_fa": [
            "دلیل رد گزینه: متوپرولول پایه است ولی سوال افزودن داروی جدید است.",
            "دلیل رد گزینه: دیلتیازم برای انسداد انتخاب اول افزودنی نیست.",
            "گزینه صحیح: دیسوپیرامید با منفی اینوتروپ گرادیان را کم می‌کند.",
            "دلیل رد گزینه: فوروزماید با کاهش حجم انسداد را تشدید می‌کند."
        ],
        "reasons_en": [
            "Why incorrect: Metoprolol base but question asks add-on.",
            "Why incorrect: Diltiazem not first add-on for obstruction.",
            "Correct: Disopyramide with negative inotrope reduces gradient.",
            "Why incorrect: Furosemide with volume loss worsens obstruction."
        ],
        "lead_fa": "انسدادی مقاوم یعنی منفی اینوتروپ قوی اضافه کن.",
        "lead_en": "Refractory obstructive means add strong negative inotrope.",
        "golden_fa": "دیسوپیرامید گرادیان را کم می‌کند.",
        "golden_en": "Disopyramide lowers gradient.",
        "points_fa": ["حجم را کم نکن.", "والسالوا تشدید می‌کند.", "پایش QT.", "سپتال در مقاوم."],
        "points_en": ["Don't reduce volume.", "Valsalva worsens.", "Monitor QT.", "Septal in refractory."],
        "hint_fa": "کدام ضدآریتمی انسداد را آرام می‌کند؟",
        "hint_en": "Which antiarrhythmic calms obstruction?",
        "attending_fa": "استاد: انسداد را با دیسوپیرامید آرام کن.",
        "attending_en": "Attending: Calm obstruction with disopyramide."
    },
    (1,139): {
        "interpretation_fa": "مرد ۵۶ ساله با درد رترواسترنال نیم‌ساعته، افت فشار ۹۰ روی ۶۰، اشباع ۹۱، صعود ST تحتانی و JVP برجسته، انفارکتوس تحتانی با درگیری بطن راست را مطرح می‌کند. امکان PCI نیست و در نبود منع، لیتیک‌تراپی فوری ارجح است. مورفین، فورسماید تا پایین آمدن JVP و نیترو زیرزبانی در این زمینه با افت فشار و وابستگی به پیش‌بار مضر و ممنوع است و بولوس سالین محتاطانه همراه بازپرفیوژن کمک‌کننده است. انتخاب بر فشار و ریه متکی است.",
        "interpretation_en": "A 56-year-old with 30-min retrosternal pain, 90/60, 91% sat, inferior ST elevation and high JVP suggests inferior with RV infarct. No PCI and without contraindication immediate lytic preferred. Morphine, furosemide to lower JVP and sublingual nitro with hypotension and preload dependence harmful and prohibited and cautious saline with reperfusion helps. Choice hemodynamic-based.",
        "reasons_fa": [
            "گزینه صحیح: لیتیک فوری در نبود منع در انفارکتوس تحتانی ارجح است.",
            "دلیل رد گزینه: مورفین در افت فشار و راست نارسا مضر است.",
            "دلیل رد گزینه: فورسماید JVP را با کم‌آبی بدتر می‌کند.",
            "دلیل رد گزینه: نیترو زیرزبانی در افت فشار ممنوع است."
        ],
        "reasons_en": [
            "Correct: Immediate lytic without contraindication preferred in inferior MI.",
            "Why incorrect: Morphine harmful in hypotension and failing right.",
            "Why incorrect: Furosemide worsens JVP via depletion.",
            "Why incorrect: Sublingual nitro prohibited in hypotension."
        ],
        "lead_fa": "تحتانی با JVP برجسته یعنی لیتیک نه نیترو.",
        "lead_en": "Inferior with high JVP means lytic not nitro.",
        "golden_fa": "راست نارسا را با مایع پر کن.",
        "golden_en": "Fill failing right with fluid.",
        "points_fa": ["V4R بگیر.", "فشار را بسنج.", "PCI اگر شد.", "مورفین پرهیز."],
        "points_en": ["Get V4R.", "Check pressure.", "PCI if possible.", "Avoid morphine."],
        "hint_fa": "بدون PCI در افت فشار کدام درمان نجات است؟",
        "hint_en": "Without PCI in hypotension which rescue?",
        "attending_fa": "استاد: تحتانی راست را لیز کن.",
        "attending_en": "Attending: Lyse inferior right."
    },
    (1,140): {
        "interpretation_fa": "شایع‌ترین علت پریکاردیت حاد، ایدیوپاتیک با زمینه ویروسی است و درد پلورتیک وضعیتی، rub و ST elevation منتشر با PR depression مشخصه است. جراحی قلب، رادیوتراپی و کانسر ریه علل کمتر شایع‌اند و افیوژن و تامپوناد با اکو ارزیابی می‌شوند. درمان معمول ضدالتهاب غیراستروئیدی و کلشیسین است و علت‌یابی شامل شرح حال، دارو و عفونت اخیر است.",
        "interpretation_en": "Most common cause acute pericarditis is idiopathic with viral background and pleuritic positional pain, rub and diffuse ST elevation with PR depression hallmark. Cardiac surgery, radiotherapy and lung cancer less common and effusion and tamponade evaluated with echo. Usual therapy NSAID and colchicine and workup includes history, drugs and recent infection.",
        "reasons_fa": [
            "دلیل رد گزینه: جراحی قلب علت شایع نیست.",
            "دلیل رد گزینه: رادیوتراپی علت شایع نیست.",
            "گزینه صحیح: ایدیوپاتیک با زمینه ویروسی شایع‌ترین است.",
            "دلیل رد گزینه: کانسر ریه علت شایع نیست."
        ],
        "reasons_en": [
            "Why incorrect: Cardiac surgery not common cause.",
            "Why incorrect: Radiotherapy not common cause.",
            "Correct: Idiopathic with viral background most common.",
            "Why incorrect: Lung cancer not common cause."
        ],
        "lead_fa": "پریکاردیت حاد یعنی اول ویروسی فکر کن.",
        "lead_en": "Acute pericarditis means think viral first.",
        "golden_fa": "ایدیوپاتیک شایع‌ترین است.",
        "golden_en": "Idiopathic most common.",
        "points_fa": ["درد با دم.", "ST منتشر.", "اکو افیوژن.", "کلشیسین پیشگیری عود."],
        "points_en": ["Pain with breath.", "Diffuse ST.", "Echo effusion.", "Colchicine prevents recurrence."],
        "hint_fa": "کدام علت اول ویروسی است؟",
        "hint_en": "Which cause viral first?",
        "attending_fa": "استاد: پریکاردیت را ایدیوپاتیک بدان.",
        "attending_en": "Attending: Know pericarditis as idiopathic."
    },
    (1,141): {
        "interpretation_fa": "زن ۲۶ ساله ESRD باردار ۳۶ هفته با سوفل ممتد چپ جناغ که جزء دیاستولیک آن با فشار محکم استتوسکوپ محو می‌شود، سوفل پستانی خوش‌خیم بارداری است نه PDA یا فیستول. افزایش جریان پستان سوفل ممتد می‌دهد و فشار موضعی شریان پستان را می‌بندد و جزء دیاستولیک را از بین می‌برد برخلاف PDA که داخل‌عروقی و پایدار است. نارسایی میترال هولوسیستولیک است و ممتد نمی‌دهد و شناخت سوفل پستانی از بررسی تهاجمی جلوگیری می‌کند.",
        "interpretation_en": "A 26-year-old ESRD pregnant 36w with continuous murmur left sternal whose diastolic part disappears with firm stethoscope pressure is benign mammary souffle of pregnancy not PDA or fistula. Increased mammary flow gives continuous and local pressure closes mammary artery and abolishes diastolic part unlike PDA intravascular persistent. MR holosystolic not continuous and recognizing mammary souffle avoids invasive workup.",
        "reasons_fa": [
            "دلیل رد گزینه: PDA ممتد پایدار دارد و با فشار محو نمی‌شود.",
            "گزینه صحیح: سوفل پستانی با فشار محکم جزء دیاستولیکش محو می‌شود.",
            "دلیل رد گزینه: نارسایی میترال ممتد نیست.",
            "دلیل رد گزینه: فیستول شریانی‌وریدی ممتد پایدار دارد."
        ],
        "reasons_en": [
            "Why incorrect: PDA has persistent continuous not abolished by pressure.",
            "Correct: Mammary souffle diastolic part abolished by firm pressure.",
            "Why incorrect: MR not continuous.",
            "Why incorrect: AV fistula has persistent continuous."
        ],
        "lead_fa": "ممتد بارداری با فشار محو یعنی پستانی.",
        "lead_en": "Continuous in pregnancy abolished by pressure means mammary.",
        "golden_fa": "بارداری را بی‌دلیل کات نکن.",
        "golden_en": "Don't cath pregnancy without cause.",
        "points_fa": ["روی پستان بشنو.", "فشار را امتحان کن.", "PDA را رد کن.", "خوش‌خیم است."],
        "points_en": ["Hear over breast.", "Try pressure.", "Rule PDA.", "Benign."],
        "hint_fa": "کدام ممتد با فشار می‌رود؟",
        "hint_en": "Which continuous goes with pressure?",
        "attending_fa": "استاد: سوفل پستانی را بشناس.",
        "attending_en": "Attending: Recognize mammary souffle."
    },
    (1,142): {
        "interpretation_fa": "سندرم کرونری بدون صعود ST شامل آنژین ناپایدار و NSTEMI است؛ در ۱۵ درصد موارد آنژیوگرافی ضایعه قابل توجه ندارد، درد معمولاً در استراحت یا فعالیت کم و با آستانه پایین رخ می‌دهد، در NSTEMI تروپونین معمولاً بالا می‌رود و درمان ضدپلاکتی و آنتی‌کوآگولانت پایه است. عدم نیاز به آنتی‌کوآگولانت نادرست است و ریسک براساس تروپونین، تغییرات ST، دیابت و GRACE تعیین می‌شود و راهبرد تهاجمی زودرس در پرخطر اندیکاسیون دارد.",
        "interpretation_en": "NSTE-ACS includes unstable angina and NSTEMI; in 15% angio has no significant lesion, pain usually at rest or low activity with low threshold, in NSTEMI troponin usually rises and antiplatelet and anticoagulant base. No need for anticoagulant false and risk by troponin, ST changes, diabetes and GRACE and early invasive in high-risk indicated.",
        "reasons_fa": [
            "گزینه صحیح: در ۱۵ درصد آنژیو ضایعه قابل توجه ندارد.",
            "دلیل رد گزینه: درد معمولاً با فعالیت شدید نیست بلکه استراحت است.",
            "دلیل رد گزینه: در NSTEMI تروپونین معمولاً بالا می‌رود.",
            "دلیل رد گزینه: آنتی‌کوآگولانت لازم است."
        ],
        "reasons_en": [
            "Correct: In 15% angio no significant lesion.",
            "Why incorrect: Pain not usually with intense activity but rest.",
            "Why incorrect: In NSTEMI troponin usually rises.",
            "Why incorrect: Anticoagulant needed."
        ],
        "lead_fa": "بدون ST یعنی ۱۵ درصد آنژیو پاک است.",
        "lead_en": "No ST means 15% angio clean.",
        "golden_fa": "NSTE را با تروپونین بسنج.",
        "golden_en": "Judge NSTE by troponin.",
        "points_fa": ["درد استراحتی.", "DAPT و هپارین.", "GRACE.", "تهاجمی در پرخطر."],
        "points_en": ["Rest pain.", "DAPT and heparin.", "GRACE.", "Invasive in high-risk."],
        "hint_fa": "چند درصد بدون ضایعه می‌ماند؟",
        "hint_en": "What percent stays without lesion?",
        "attending_fa": "استاد: NSTE را با ۱۵ درصد بشناس.",
        "attending_en": "Attending: Know NSTE by 15%."
    },
    (1,143): {
        "interpretation_fa": "مرد ۶۲ ساله سیگاری با درد قفسه سینه، ضعف، هپاتومگالی، JVP برجسته، افت فشار ۷۰ و ریه پاک با انفارکتوس و ST بالا، درگیری بطن راست با V4R را مطرح می‌کند نه خلفی یا لترال یا انتروسپتال. انسداد شریان کرونری راست پروگزیمال سه‌گانه افت فشار، ورید برجسته و ریه پاک می‌دهد؛ V4R حساس است و نیترات و دیورتیک ممنوع و سالین محتاطانه و بازپرفیوژن کمک‌کننده‌اند. شناخت لید راست درمان را تغییر می‌دهد.",
        "interpretation_en": "A 62-year-old smoker with chest pain, weakness, hepatomegaly, prominent JVP, 70 hypotension and clear lungs with MI and ST elevation suggests RV involvement with V4R not posterior or lateral or anteroseptal. Proximal RCA occlusion gives triad hypotension, high JVP and clear lungs; V4R sensitive and nitrate and diuretic prohibited and cautious saline and reperfusion help. Recognizing right lead changes therapy.",
        "reasons_fa": [
            "دلیل رد گزینه: خلفی V7-V9 با ریه پاک و JVP بالا کمتر جور است.",
            "دلیل رد گزینه: لترال I و aVL سه‌گانه راست نمی‌دهد.",
            "گزینه صحیح: سمت راست V4R با سه‌گانه راست همخوان است.",
            "دلیل رد گزینه: انتروسپتال V1-V4 سه‌گانه راست نمی‌دهد."
        ],
        "reasons_en": [
            "Why incorrect: Posterior V7-V9 less fits clear lungs and high JVP.",
            "Why incorrect: Lateral I aVL not RV triad.",
            "Correct: Right V4R fits RV triad.",
            "Why incorrect: Anteroseptal V1-V4 not RV triad."
        ],
        "lead_fa": "افت با ورید برجسته و ریه پاک یعنی V4R.",
        "lead_en": "Drop with high JVP and clear lungs means V4R.",
        "golden_fa": "راست را با V4R ببین.",
        "golden_en": "See right with V4R.",
        "points_fa": ["RCA پروگزیمال.", "نیترات پرهیز.", "سالین.", "بازپرفیوژن."],
        "points_en": ["Proximal RCA.", "Avoid nitrate.", "Saline.", "Reperfusion."],
        "hint_fa": "کدام لید راست را نشان می‌دهد؟",
        "hint_en": "Which lead shows right?",
        "attending_fa": "استاد: V4R را بگیر.",
        "attending_en": "Attending: Get V4R."
    },
    (1,144): {
        "interpretation_fa": "خستگی و تنگی نفس علامت اصلی نارسایی است؛ ارتوپنه دیرتر از تنگی نفس فعالیتی ظاهر می‌شود و nocturia با بهبود پرفیوژن کلیه در شب شایع است. تنفس شین‌استوک از تأخیر گردش و ناپایداری کنترل تنفس در نارسایی پیشرفته و اغلب همراه اختلال خواب است نه مراحل اولیه شایع. با غالب شدن نارسایی راست، احتقان سیستمیک زیاد و احتقان ریوی کمتر می‌شود و افتراق از آسم قلبی مهم است.",
        "interpretation_en": "Fatigue and dyspnea main symptoms of failure; orthopnea later than exertional dyspnea appears and nocturia with improved kidney perfusion at night common. Cheyne-Stokes from circulation delay and breathing control instability in advanced failure and often with sleep disturbance not common early. With dominant right failure systemic congestion high and pulmonary less and differentiation from cardiac asthma important.",
        "reasons_fa": [
            "دلیل رد گزینه: خستگی و تنگی نفس اصلی‌اند.",
            "گزینه صحیح: شین‌استوک در مراحل اولیه شایع نیست و «صحیح نیست» همین است.",
            "دلیل رد گزینه: ارتوپنه دیررس‌تر از فعالیتی است.",
            "دلیل رد گزینه: nocturia در نارسایی شایع است."
        ],
        "reasons_en": [
            "Why incorrect: Fatigue and dyspnea main.",
            "Correct: Cheyne-Stokes not common early and is the 'not correct'.",
            "Why incorrect: Orthopnea later than exertional.",
            "Why incorrect: Nocturia common in failure."
        ],
        "lead_fa": "شین‌استوک یعنی پیشرفته نه اولیه.",
        "lead_en": "Cheyne-Stokes means advanced not early.",
        "golden_fa": "مراحل را با تنفس بسنج.",
        "golden_en": "Judge stages by breathing.",
        "points_fa": ["ارتوپنه دیررس.", "PND.", "nocturia.", "راست غالب احتقان سیستمیک."],
        "points_en": ["Orthopnea late.", "PND.", "Nocturia.", "Dominant right systemic."],
        "hint_fa": "کدام تنفس مال اوایل نیست؟",
        "hint_en": "Which breathing not of early?",
        "attending_fa": "استاد: شین‌استوک را پیشرفته بدان.",
        "attending_en": "Attending: Know Cheyne-Stokes as advanced."
    },
    (1,145): {
        "interpretation_fa": "مرد ۵۰ ساله پرفشاری شدید با درد ناگهانی شدید قفسه سینه منتشر به پشت و سوفل دیاستولی High pitch چپ جناغ، دیسکسیون آئورت با نارسایی حاد آئورت را مطرح می‌کند. پارگی مدیا، اختلاف نبض و فشار، مدیاستن پهن و ایسکمی ارگان عوارض‌اند؛ کنترل فوری ضربان با بتابلوکر سپس فشار و تصویربرداری سریع ضروری است. نوع A جراحی اورژانسی و نوع B بدون عارضه طبی است و فیبرینولیز در شک به دیسکسیون مطلقاً ممنوع است.",
        "interpretation_en": "A 50-year-old severe HTN with sudden severe chest pain radiating to back and high-pitch diastolic murmur left sternal suggests aortic dissection with acute AR. Media tear, pulse/pressure difference, wide mediastinum and organ ischemia complications; prompt rate control with beta then pressure and rapid imaging essential. Type A emergent surgery and uncomplicated B medical and lysis absolutely prohibited in suspected dissection.",
        "reasons_fa": [
            "دلیل رد گزینه: آمبولی ریه سوفل دیاستولی High pitch چپ نمی‌دهد.",
            "دلیل رد گزینه: انفارکتوس تحتانی درد به پشت پارگیمانند و سوفل دیاستولی نمی‌دهد.",
            "گزینه صحیح: دیسکسیون آئورت با درد ناگهانی و AR مطرح است.",
            "دلیل رد گزینه: پریکاردیت سوفل دیاستولی High pitch چپ نمی‌دهد."
        ],
        "reasons_en": [
            "Why incorrect: PE does not give high-pitch left diastolic.",
            "Why incorrect: Inferior MI not tearing back pain and diastolic.",
            "Correct: Aortic dissection with sudden pain and AR.",
            "Why incorrect: Pericarditis not high-pitch left diastolic."
        ],
        "lead_fa": "درد پارگیمانند به پشت + سوفل دیاستولی یعنی دیسکسیون.",
        "lead_en": "Tearing to back + diastolic murmur means dissection.",
        "golden_fa": "بتا سپس فشار، سریع تصویر.",
        "golden_en": "Beta then pressure, rapid imaging.",
        "points_fa": ["Type A جراحی.", "مدیاستن پهن.", "لیز ممنوع.", "تامپوناد را رد کن."],
        "points_en": ["Type A surgery.", "Wide mediastinum.", "Lysis prohibited.", "Rule tamponade."],
        "hint_fa": "پشت‌درد ناگهانی با سوفل دیاستولی کدام است؟",
        "hint_en": "Which sudden back pain with diastolic?",
        "attending_fa": "استاد: دیسکسیون را با AR بشناس.",
        "attending_en": "Attending: Know dissection by AR."
    },
    (1,146): {
        "interpretation_fa": "تامپوناد شوک انسدادی با اختلال پرشدن است؛ افت فشار، ورید برجسته، صدای خفه، تاکی‌کاردی، پالس پارادوکس و کلاپس دیاستولیک راست در اکو دیده می‌شود ولی احتقان ریوی دیده نمی‌شود و ریه پاک است برخلاف ادم کاردیوژنیک. پنوموتوراکس فشاری و آمبولی بزرگ هم انسدادی‌اند؛ تامپوناد با کوسمال کلاسیک کمتر همراه است و درمان ناپایدار تخلیه فوری است و مایع فقط پل موقت است.",
        "interpretation_en": "Tamponade obstructive shock with filling disturbance; hypotension, prominent JVP, muffled, tachycardia, paradoxus and RV diastolic collapse on echo seen but pulmonary congestion not seen and lungs clear unlike cardiogenic edema. Tension pneumothorax and large PE also obstructive; tamponade less with classic Kussmaul and unstable needs emergent drainage and fluid only bridge.",
        "reasons_fa": [
            "گزینه صحیح: احتقان ریوی در تامپوناد دیده نمی‌شود و «بجز» همین است.",
            "دلیل رد گزینه: تاکی‌کاردی در تامپوناد دیده می‌شود.",
            "دلیل رد گزینه: JVP برجسته در تامپوناد دیده می‌شود.",
            "دلیل رد گزینه: افت فشار در تامپوناد دیده می‌شود."
        ],
        "reasons_en": [
            "Correct: Pulmonary congestion not seen in tamponade and is 'except'.",
            "Why incorrect: Tachycardia seen in tamponade.",
            "Why incorrect: Prominent JVP seen in tamponade.",
            "Why incorrect: Hypotension seen in tamponade."
        ],
        "lead_fa": "تامپوناد یعنی ریه پاک.",
        "lead_en": "Tamponade means clear lungs.",
        "golden_fa": "انسدادی را با ریه پاک بشناس.",
        "golden_en": "Know obstructive by clear lungs.",
        "points_fa": ["صدای خفه.", "پارادوکس.", "اکو کلاپس.", "تخلیه فوری."],
        "points_en": ["Muffled sound.", "Paradoxus.", "Echo collapse.", "Emergent drainage."],
        "hint_fa": "کدام رال در تامپوناد نیست؟",
        "hint_en": "Which rales not in tamponade?",
        "attending_fa": "استاد: تامپوناد را با ریه پاک بشناس.",
        "attending_en": "Attending: Know tamponade by clear lungs."
    },
    (1,148): {
        "interpretation_fa": "نبض Bisferiens دو قله در سیستول با موج میانی دارد و در انسداد خروجی با انقباض شدید و گرادیان دینامیک دیده می‌شود. کاردیومیوپاتی هیپرتروفیک انسدادی Bisferiens می‌دهد در حالی که تنگی شدید آئورت نبض ضعیف و دیررس (parvus tardus) و دیسکسیون اختلاف نبض می‌دهد. لمس نبض به افتراق کمک می‌کند و با مانور والسالوا و سوفل همراه تفسیر می‌شود. این نکته در هاریسون با تأکید بر معاینه آمده است.",
        "interpretation_en": "Bisferiens pulse two systolic peaks with mid trough seen in outflow obstruction with strong contraction and dynamic gradient. HOCM gives bisferiens while severe AS weak late (parvus tardus) and dissection pulse difference gives. Pulse palpation helps differentiate and interpreted with Valsalva and murmur. Harrison emphasizes exam.",
        "reasons_fa": [
            "گزینه صحیح: HOCM نبض Bisferiens می‌دهد.",
            "دلیل رد گزینه: تنگی شدید آئورت parvus tardus می‌دهد.",
            "دلیل رد گزینه: تنگی شدید آئورت parvus tardus می‌دهد.",
            "دلیل رد گزینه: دیسکسیون اختلاف نبض می‌دهد."
        ],
        "reasons_en": [
            "Correct: HOCM gives bisferiens.",
            "Why incorrect: Severe AS gives parvus tardus.",
            "Why incorrect: Severe AS gives parvus tardus.",
            "Why incorrect: Dissection gives pulse difference."
        ],
        "lead_fa": "دو قله سیستول یعنی HOCM.",
        "lead_en": "Two systolic peaks means HOCM.",
        "golden_fa": "Bisferiens را با HOCM بشناس.",
        "golden_en": "Know bisferiens with HOCM.",
        "points_fa": ["سوفل با Valsalva بیشتر.", "پا بالا سوفل کم.", "بتا کمک.", "اکو گرادیان."],
        "points_en": ["Murmur more with Valsalva.", "Legs up murmur less.", "Beta helps.", "Echo gradient."],
        "hint_fa": "کدام بیماری نبض دو قله دارد؟",
        "hint_en": "Which disease double-peak pulse?",
        "attending_fa": "استاد: Bisferiens را HOCM بدان.",
        "attending_en": "Attending: Know bisferiens as HOCM."
    },
    (1,149): {
        "interpretation_fa": "سوفل سیستولیک III/IV بین لبه تحتانی چپ جناغ و اپکس که با بالا بردن پاها کم می‌شود، انسداد دینامیک HOCM را مطرح می‌کند؛ افزایش بازگشت وریدی حجم بطن را زیاد و انسداد را کم می‌کند. در تنگی آئورت ثابت، PS یا ASD این مانور سوفل را کم نمی‌کند و والسالوا برعکس اثر دارد. این ویژگی به افتراق سوفل‌ها کمک می‌کند و اکو تأیید می‌کند و خطر آریتمی ارزیابی می‌شود.",
        "interpretation_en": "III/IV systolic murmur between left lower sternal border and apex that decreases by raising legs suggests dynamic HOCM obstruction; increased venous return raises ventricular volume and reduces obstruction. In fixed AS, PS or ASD this maneuver not reduces and Valsalva opposite. This feature helps differentiate murmurs and echo confirms and arrhythmia risk evaluated.",
        "reasons_fa": [
            "گزینه صحیح: HOCM با افزایش پره‌لود سوفلش کم می‌شود.",
            "دلیل رد گزینه: تنگی آئورت با پا بالا کم نمی‌شود.",
            "دلیل رد گزینه: تنگی پولمونر با پا بالا کم نمی‌شود.",
            "دلیل رد گزینه: ASD با پا بالا کم نمی‌شود."
        ],
        "reasons_en": [
            "Correct: HOCM with increased preload murmur decreases.",
            "Why incorrect: AS not decreased by legs up.",
            "Why incorrect: PS not decreased by legs up.",
            "Why incorrect: ASD not decreased by legs up."
        ],
        "lead_fa": "پا بالا سوفل کم یعنی HOCM.",
        "lead_en": "Legs up less murmur means HOCM.",
        "golden_fa": "HOCM دینامیک است.",
        "golden_en": "HOCM dynamic.",
        "points_fa": ["Valsalva زیاد.", "چمباتمه زیاد.", "اکو SAM.", "ICD در پرخطر."],
        "points_en": ["Valsalva more.", "Squatting more.", "Echo SAM.", "ICD high-risk."],
        "hint_fa": "کدام سوفل با پا بالا آرام می‌شود؟",
        "hint_en": "Which murmur calms with legs up?",
        "attending_fa": "استاد: HOCM را با پا بسنج.",
        "attending_en": "Attending: Judge HOCM with legs."
    },
    (1,150): {
        "interpretation_fa": "زن ۲۵ ساله با تنگی نفس کلاس دو، درد غیراختصاصی، افسردگی، کم‌خونی ۹.۵ و چربی طبیعی با اکو EF 23% و بزرگی چهار حفره، کاردیومیوپاتی متسع با نارسایی کاهشی مطرح است. در کاهشی چهار ستون بقا شامل ARNI/مهارکننده آنزیم مبدل، بتابلوکر شواهدار، MRA و SGLT2 است؛ بیسوپرولول بقا را می‌افزاید در حالی که فلوکستین، آتورواستاتین بدون اندیکاسیون کرونری و اریتروپویتین با هموگلوبین ۹.۵ بقا را نمی‌افزایند. دیورتیک علامت و دیگوکسین بستری را کم می‌کند.",
        "interpretation_en": "A 25-year-old with class II dyspnea, nonspecific pain, depression, anemia 9.5 and normal lipids with echo EF 23% and 4-chamber enlargement suggests dilated cardiomyopathy with reduced failure. In reduced four pillars survival include ARNI/ACEi, evidence beta, MRA and SGLT2; bisoprolol increases survival while fluoxetine, atorvastatin without coronary indication and EPO with Hb 9.5 not increase survival. Diuretic symptom and digoxin hospitalization reduces.",
        "reasons_fa": [
            "دلیل رد گزینه: فلوکستین بقا را نمی‌افزاید.",
            "گزینه صحیح: بیسوپرولول بقا را می‌افزاید.",
            "دلیل رد گزینه: آتورواستاتین بدون اندیکاسیون بقا نمی‌افزاید.",
            "دلیل رد گزینه: اریتروپویتین بقا نمی‌افزاید."
        ],
        "reasons_en": [
            "Why incorrect: Fluoxetine not increase survival.",
            "Correct: Bisoprolol increases survival.",
            "Why incorrect: Atorvastatin without indication not increase survival.",
            "Why incorrect: Erythropoietin not increase survival."
        ],
        "lead_fa": "EF پایین یعنی بتا بقا می‌دهد.",
        "lead_en": "Low EF means beta gives survival.",
        "golden_fa": "چهار ستون را شروع کن.",
        "golden_en": "Start four pillars.",
        "points_fa": ["EF کم.", "بتا شواهدار.", "MRA و SGLT2.", "وراپامیل پرهیز."],
        "points_en": ["Low EF.", "Evidence beta.", "MRA and SGLT2.", "Avoid verapamil."],
        "hint_fa": "کدام قرص عمر را زیاد می‌کند؟",
        "hint_en": "Which pill prolongs life?",
        "attending_fa": "استاد: کاهشی را با بتا نجات بده.",
        "attending_en": "Attending: Save reduced with beta."
    },
    (1,151): {
        "interpretation_fa": "ارزیابی سنکوپ با شرح حال، معاینه، فشار ارتواستاتیک و نوار قلب برای همه است؛ سنکوپ فعالیتی، نوار غیرطبیعی، سابقه خانوادگی مرگ ناگهانی و بیماری ساختاری قلب پرخطر و نیازمند بستری یا بررسی کامل است. بیمار ۶۰ ساله با معاینه، نوار و اکو طبیعی و سنکوپ تروماتیک هنگام ایستادن، رفلکسی خوش‌خیم و کم‌خطر است و اندیکاسیون بستری یا بررسی تهاجمی ندارد و آموزش و پیشگیری کافی است. بلوک بای‌فاسیکولر با سنکوپ ورزشی پرخطر است.",
        "interpretation_en": "Syncope evaluation with history, exam, orthostatic pressure and ECG for all; exertional syncope, abnormal ECG, family sudden death and structural disease high-risk and needs admission or full workup. 60-year-old with normal exam, ECG and echo and traumatic syncope on standing, benign reflex low-risk and no admission or invasive workup indication and education and prevention enough. Bifascicular block with exercise syncope high-risk.",
        "reasons_fa": [
            "دلیل رد گزینه: نارسایی سیستولیک با سنکوپ فعالیتی اندیکاسیون دارد.",
            "دلیل رد گزینه: تنگی آئورت متوسط با سنکوپ استراحت اندیکاسیون دارد.",
            "گزینه صحیح: سنکوپ تروماتیک ایستاده با بررسی طبیعی اندیکاسیون ندارد.",
            "دلیل رد گزینه: بلوک بای‌فاسیکولر با سنکوپ ورزشی اندیکاسیون دارد."
        ],
        "reasons_en": [
            "Why incorrect: Systolic failure with exertional syncope has indication.",
            "Why incorrect: Moderate AS with rest syncope has indication.",
            "Correct: Traumatic standing syncope with normal workup no indication.",
            "Why incorrect: Bifascicular block with exercise syncope has indication."
        ],
        "lead_fa": "ایستاده تروماتیک با اکو طبیعی یعنی خوش‌خیم.",
        "lead_en": "Traumatic standing with normal echo means benign.",
        "golden_fa": "سنکوپ ورزشی و بلوکی را بستری کن.",
        "golden_en": "Admit exercise and block syncope.",
        "points_fa": ["نوار برای همه.", "تیلت در رفلکسی.", "خانوادگی را بپرس.", "پرخطر را بستری."],
        "points_en": ["ECG for all.", "Tilt in reflex.", "Ask family.", "Admit high-risk."],
        "hint_fa": "کدام سنکوپ بستری نمی‌خواهد؟",
        "hint_en": "Which syncope not needs admission?",
        "attending_fa": "استاد: ایستاده تروماتیک را مرخص کن.",
        "attending_en": "Attending: Discharge traumatic standing."
    },
}
OPTIONS_EN_MAP10 = {
    (1,136): ['Sublingual nitro', 'IV morphine', 'IV furosemide', 'IV digoxin'],
    (1,137): ['Central cyanosis', 'Peripheral cyanosis', 'Osler node', 'Arcus senilis'],
    (1,138): ['Metoprolol', 'Diltiazem', 'Disopyramide', 'Furosemide'],
    (1,139): ['Immediate lytic', 'Injectable morphine', 'Furosemide to lower JVP', 'Sublingual nitro'],
    (1,140): ['Cardiac surgery', 'Radiotherapy', 'Idiopathic', 'Lung cancer'],
    (1,141): ['PDA', 'Mammary souffle', 'MR', 'AV fistula'],
    (1,142): ['15% no lesion', 'Pain after intense activity', 'NSTEMI troponin not high', 'No anticoagulant needed'],
    (1,143): ['Posterior V7-V9', 'Lateral I aVL', 'Right V4R', 'Anteroseptal V1-V4'],
    (1,144): ['Fatigue/dyspnea main', 'Cheyne-Stokes early common', 'Orthopnea later', 'Nocturia common'],
    (1,145): ['Pulmonary embolism', 'Inferior MI', 'Aortic dissection', 'Pericarditis'],
    (1,146): ['Pulmonary congestion', 'Tachycardia', 'Prominent JVP', 'Hypotension'],
    (1,148): ['HOCM', 'Severe AS', 'Severe AS', 'Aortic dissection'],
    (1,149): ['HOCM', 'AS', 'PS', 'ASD'],
    (1,150): ['Fluoxetine', 'Bisoprolol', 'Atorvastatin', 'Erythropoietin'],
    (1,151): ['Systolic HF exertional', 'Moderate AS rest', 'Traumatic standing normal workup', 'Bifascicular exercise'],
}
def enrich10():
    assert len(ITEMS)==15
    path = ROOT / f"tools/master-bank/import-payload.master-preint.part{PART:02}.json"
    before = json.loads(path.read_text(encoding="utf-8"))
    after = copy.deepcopy(before)
    for local, q in enumerate(after["questions"], 1):
        item = ITEMS.get((PART, local))
        if item is None:
            continue
        if not q.get("options_en") or len([o for o in q.get("options_en",[]) if str(o).strip()])<4:
            q["options_en"] = OPTIONS_EN_MAP10.get((PART, local), q.get("options_en",[]))
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
    print(f"PASS: enriched {len(ITEMS)} heart Q136-151 excl 147")
if __name__=="__main__":
    enrich10()
