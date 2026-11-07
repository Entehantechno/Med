#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enrichment script for Part 16 Batch 1 (Questions 0 to 29)
Target payload: work/tools/master-bank/import-payload.master-preint.part16.json
Note: Per user instructions, question_fa and options_fa are preserved exactly as original.
Only options_why_fa, explanation_fa, correct_index (when misindexed), and micro are enriched.
"""

import json
import sys

PAYLOAD_PATH = "work/tools/master-bank/import-payload.master-preint.part16.json"

ENRICHMENTS_BATCH1 = {
    0: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: ریشه S2 حس خلف ران و زانو را تأمین می‌کند و نقشی در دورسی‌فلکسیون انگشتان پا ندارد.",
            "نادرست است؛ دلیل رد: ریشه S1 مسئول پلانتارفلکسیون مچ پا، ایستادن روی پنجه، حس لترال پا و رفلکس تاندون آشیل است.",
            "صحیح است؛ انتشار درد به «سطح لترال ساق و دورسوم (پشت) پا» همراه با «اختلال در دورسی‌فلکسیون انگشتان پا (به‌ویژه شست پا با ضعف عضله Extensor Hallucis Longus) و اختلال در راه رفتن روی پاشنه‌ها»، تابلوی عصبی پاتوگنومونیک و کلاسیک درگیری «ریشه عصبی L5» (شایع‌ترین رادیکولوپاتی ناشی از فتق دیسک L4-L5) است.",
            "نادرست است؛ دلیل رد: ریشه L3 به قدام ران انتشار داشته و عضله چهارسر ران را تحت تأثیر قرار می‌دهد."
        ],
        "exp": "انتشار درد به لترال ساق و دورسوم پا همراه با ضعف دورسی‌فلکسیون شست و انگشتان پا، نشانه درگیری ریشه عصبی L5 است.",
        "micro": {
            "lead_fa": "رادیکولوپاتی ریشه L5 شایع‌ترین سندرم فشاری ناشی از فتق دیسک لومبار (بین‌مهره‌ای L4-L5) است. مشخصات بالینی تشخیصی: ۱) درماتوم حسی: درد و پارستزی در مسیر لترال ساق، دورسوم پا و انگشت شست؛ ۲) میوتوم حرکتی: ضعف در دورسی‌فلکسیون انگشت شست پا (عضله اکستنسور هالوسیس لونگوس) و دورسی‌فلکسیون مچ پا (عضله تیبیالیس قدامی) با اختلال در راه رفتن روی پاشنه‌ها؛ ۳) رفلکس: ریشه L5 فاقد رفلکس تاندونی روتین است (رفلکس‌های پتلا و آشیل نرمال می‌مانند).",
            "lead_en": "L5 radiculopathy represents the most frequent lumbar nerve root compression syndrome, predominantly provoked by an L4-L5 posterolateral intervertebral disc herniation. Neurological localization features radiating sensory pain across the lateral calf and dorsum of the foot, paired with motor weakness in great toe dorsiflexion (extensor hallucis longus) and impaired heel walking, sparing deep tendon reflexes.",
            "golden_fa": "درد لترال ساق و دورسوم پا + ضعف دورسی‌فلکسیون شست پا = درگیری ریشه عصبی L5 (فتق دیسک L4-L5).",
            "golden_en": "Lateral calf/dorsal foot pain + weak great toe dorsiflexion = L5 nerve root compression (L4-L5 disc herniation).",
            "points_fa": [
                "تست بالا آوردن مستقیم پا (Straight Leg Raise / SLR) با حساسیت بالا برای درگیری ریشه L5 مثبت می‌شود.",
                "اختلال در راه رفتن روی پاشنه پا (Heel walking) تست حرکتی سریع غربالگری برای ریشه L5 است.",
                "ریشه S1 با ضعف پلانتارفلکسیون (راه رفتن روی پنجه) و کاهش رفلکس آشیل افتراق داده می‌شود.",
                "ام‌آر‌آی کمری بدون تزریق روش تصویربرداری انتخابی برای اثبات فتق دیسک L4-L5 است."
            ],
            "points_en": [
                "The straight leg raise (SLR) test is highly sensitive for confirming lower lumbar L5 root traction.",
                "Inability to ambulate on heels (heel walking) is the cardinal physical examination indicator of L5 motor weakness.",
                "S1 radiculopathy contrasts sharply by causing plantarflexion weakness (toe walking) and an absent Achilles reflex.",
                "Non-contrast lumbar spine MRI is the definitive imaging study establishing the exact disc herniation site."
            ]
        }
    },
    1: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: کاهش نامتقارن فضای مفصلی ناشی از فرسایش غضروف از علائم رادیولوژی شایع استئوآرتریت است.",
            "نادرست است؛ دلیل رد: تشکیل استئوفیت‌های لبه‌ای شاخص‌ترین یافته تشخیصی آرتروز در رادیوگرافی ساده است.",
            "صحیح است (یافته‌ای که در استئوآرتریت دیده نمی‌شود)؛ «استئوپنی یا پوکی استخوان نزدیک مفصل (Juxta-articular Osteopenia)» نشانه افزایش جریان خون التهابی سینوویال و تخریب سایتوکاینی در بیماری‌های التهابی نظیر «آرتریت روماتوئید (RA)» است؛ در بیماری غیرالتهابی استئوآرتریت، استخوان زیر غضروف متراکم و سفت شده و «اسکلروز ساب‌کندرال (Subchondral Sclerosis)» ایجاد می‌کند نه استئوپنی.",
            "نادرست است؛ دلیل رد: رادیوگرافی نرمال ممکن است در مراحل اولیه علائم بالینی استئوآرتریت دیده شود."
        ],
        "exp": "استئوپنی نزدیک مفصلی مشخصه آرتریت‌های التهابی (RA) است؛ در استئوآرتریت اسکلروز و تراکم استخوان دیده می‌شود.",
        "micro": {
            "lead_fa": "در ارزیابی رادیولوژی مفاصل، تفکیک استئوآرتریت از آرتریت‌های التهابی بر تفاوت‌های ساختاری استخوان استوار است. چهار نشانه کلاسیک استئوآرتریت عبارتند از: تنگی نامتقارن فضای مفصل، اسکلروز و سفت‌شدگی استخوان ساب‌کندرال (افزایش دانسیته)، استئوفیت‌های لبه‌ای و کیست‌های ساب‌کندرال. در نقطه مقابل، استئوپنی اطراف مفصلی (کاهش تراکم استخوان مجاور کپسول) همراه با اروزیون‌های حاشیه‌ای، امضای رادیولوژیک آرتریت روماتوئید است.",
            "lead_en": "Radiographic discrimination between degenerative osteoarthritis and inflammatory arthritides relies on subchondral bone response. Osteoarthritis produces asymmetric joint space loss, subchondral sclerosis (eburnation), marginal osteophytes, and subchondral geode cysts. Periarticular osteopenia (juxta-articular demineralization) is conversely the hallmark of rheumatoid arthritis.",
            "golden_fa": "علائم رادیولوژی آرتروز: تنگی فضا، استئوفیت و اسکلروز؛ استئوپنی اطراف مفصلی نشانه آرتریت روماتوئید است.",
            "golden_en": "Radiographic features of OA: narrowing, osteophytes, and sclerosis; periarticular osteopenia denotes rheumatoid arthritis.",
            "points_fa": [
                "کریپتاسیون مفصلی در معاینه فیزیکی ناشی از سایش سطوح ناهموار غضروفی بر روی یکدیگر است.",
                "اسکلروز ساب‌کندرال پاسخ واکنشی و پرولیفراتیو استخوان به از دست رفتن غضروف هیالین است.",
                "رادیوگرافی ایستاده زانو (Weight-bearing) برای بررسی واقعی فاصله مفصلی ضروری است.",
                "درد در استئوآرتریت با فعالیت تشدید شده و با استراحت تسکین می‌یابد."
            ],
            "points_en": [
                "Articular crepitus palpated during passive motion indicates mechanical roughening of degenerative cartilage.",
                "Subchondral bone sclerosis reflects compensatory osteoblastic remodeling under abnormal focal loading.",
                "Standing weight-bearing knee radiographs are required to accurately quantify functional joint space loss.",
                "Osteoarthritic pain displays mechanical characteristics, provoked by weight-bearing and relieved by rest."
            ]
        }
    },
    2: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: پالس کورتیکواستروئیدها در اسکلرودرمی کاتالیزور و آغازگر بحران کلیوی بوده و مورتالیتی را بالا می‌برند.",
            "نادرست است؛ دلیل رد: سیکلوفسفاماید در بحران کلیوی حاد اثربخشی سریع ندارد و داروی نجات‌بخش نیست.",
            "نادرست است؛ دلیل رد: پردنیزولون خوراکی با دوز بیش از ۱۵ میلی‌گرم ریسک بروز کریز کلیوی را تشدید می‌کند و منع مصرف دارد.",
            "صحیح است؛ بروز پرفشاری خون شریانی جدید، نارسایی حاد کلیه (Cr=2.5) و کم‌خونی همولیتیک میکروآنژیوپاتیک با شیستوسیت‌های فراوان (MAHA) در یک بیمار اسکلرودرمی، تابلوی اورژانس تهدیدکننده حیات «بحران کلیوی اسکلرودرمی (Scleroderma Renal Crisis / SRC)» است؛ داروی انتخابی، نجات‌بخش و الزامی، شروع فوری یک داروی مهارکننده ACE با اثر کوتاه نظیر «کاپتوپریل (Captopril)» با تیتراسیون سریع دوز است که طوفان رنین را مهار می‌سازد."
        ],
        "exp": "کاپتوپریل (مهارکننده ACE) داروی نجات‌بخش خط اول در کنترل بحران کلیوی اسکلرودرمی (SRC) است؛ استروئیدها ممنوع هستند.",
        "micro": {
            "lead_fa": "بحران کلیوی اسکلرودرمی (SRC) ناشی از وازواسپاسم شریانی قشر کلیه و پرولیفراسیون لایه اینتیما با ایسکمی شدید و هایپرپلازی دستگاه ژوکستاگلومرولی است که منجر به طوفان ترشح رنین می‌شود. تظاهرات شامل فشار خون بدخیم، آنمی همولیتیک با شیستوسیت‌ها و نارسایی کلیوی حاد است. تجویز فوری مهارکننده ACE سریع‌الاثر (کاپتوپریل خوراکی هر ۸ ساعت) فشار خون را کنترل کرده و بقای ارگان را نجات می‌دهد. گلوکوکورتیکوئیدها عامل آغازگر کریز بوده و اکیداً ممنوع هستند.",
            "lead_en": "Scleroderma renal crisis (SRC) is an ominous medical emergency precipitated by intense intrarenal cortical vasospasm triggering exuberant renin release, manifesting as accelerated hypertension, microangiopathic hemolytic anemia with schistocytes, and oliguric renal failure. Prompt administration of short-acting ACE inhibitors, specifically captopril, represents the life-saving standard of care. Corticosteroids are strictly contraindicated.",
            "golden_fa": "فشار خون بالا و شیستوسیت در اسکلرودرمی = بحران کلیوی (SRC)؛ درمان نجات‌بخش فوری: کاپتوپریل.",
            "golden_en": "Malignant hypertension and schistocytes in systemic sclerosis = scleroderma renal crisis; immediate therapy: captopril.",
            "points_fa": [
                "کاپتوپریل تا مهار کامل فشار خون سیستولی هر ۸ ساعت تیتر افزایشی می‌شود.",
                "حتی در صورت افزایش موقت کراتینین در روزهای اول، کاپتوپریل نباید قطع گردد.",
                "آنتی‌بادی Anti-RNA Polymerase III قوی‌ترین مارکر پیش‌بینی‌کننده بروز کریز کلیوی است.",
                "مصرف کورتیکواستروئید با دوز بیش از ۱۵ میلی‌گرم ریسک بروز SRC را به شدت افزایش می‌دهد."
            ],
            "points_en": [
                "Oral captopril is titrated aggressively every 8 hours toward target blood pressure stabilization.",
                "Transient elevations in serum creatinine during early ACE inhibitor titration must not prompt drug cessation.",
                "Anti-RNA polymerase III antibodies represent the single strongest risk factor predicting scleroderma renal crisis.",
                "Prednisone doses exceeding 15 mg daily represent a prominent iatrogenic trigger precipitating renal crisis."
            ]
        }
    },
    3: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: افزایش دوز پردنیزولون خوراکی در حضور آرتریت سپتیک فاجعه‌آفرین بوده و عفونت را منتشر می‌سازد.",
            "نادرست است؛ دلیل رد: تزریق کورتون عضلانی و ترخیص بیمار بدون رد عفونت مفصل خطای غیرقابل جبران است.",
            "صحیح است؛ در بیماری مبتلا به آرتریت روماتوئید با سابقه طولانی که ناگهان دچار مونوآرتریت حاد، بسیار داغ، متورم، قرمز و شدید در یک مفصل منفرد (زانو) با محدودیت شدید حرکات می‌شود، تا زمان اثبات خلاف آن، تشخیص تهدیدکننده حیات «آرتریت سپتیک حاد باکتریایی (Septic Arthritis)» مطرح است؛ اولین، ضروری‌ترین و مناسب‌ترین اقدام «آسپیراسیون فوری مایع مفصلی (آرتروسنتز) جهت شمارش سلول‌ها، بررسی میکروسکوپیک کریستال‌ها، رنگ‌آمیزی گرم و کشت باکتریایی» است.",
            "نادرست است؛ دلیل رد: تزریق داخل مفصلی کورتیکواستروئید قبل از رد قطعی آرتریت سپسیس مطلقاً ممنوع است."
        ],
        "exp": "در مونوآرتریت حاد داغ در بیمار روماتوئیدی شک به سپسیس است؛ اقدام فوری آسپیراسیون مایع برای اسمیر گرم، کشت و شمارش سلولی است.",
        "micro": {
            "lead_fa": "بیماران مبتلا به آرتریت روماتوئید به دلیل تخریب ساختاری مفصل و مصرف داروهای سرکوب‌کننده ایمنی، بیشترین استعداد را برای آرتریت چرکی باکتریایی (Septic arthritis به ویژه استافیلوکوک اورئوس) دارند. بروز مونوآرتریت حاد و داغ در یک مفصل تا زمان رد با آزمایش، سپسیس تلقی می‌شود. قانون طلایی روماتولوژی: آسپیراسیون تشخیصی فوری مفصل با ارسال مایع برای شمارش WBC، اسمیر گرم و کشت. تزریق یا افزایش کورتون قبل از رد سپسیس خطای مرگبار است.",
            "lead_en": "Patients with long-standing rheumatoid arthritis receiving immunosuppressive DMARDs are exceptionally predisposed to pyogenic septic arthritis, predominantly Staphylococcus aureus. An acute flare isolated to a single joint mandates immediate diagnostic arthrocentesis for leukocyte count, Gram stain, and bacterial culture prior to any steroid escalation. Intra-articular steroid injection into an infected joint is catastrophic.",
            "golden_fa": "مونوآرتریت حاد و داغ در بیمار روماتوئیدی = اولویت اول: آرتروسنتز فوری جهت اسمیر گرم، کشت و رد سپسیس.",
            "golden_en": "Acute hot monoarthritis in an RA patient = top priority: urgent arthrocentesis for Gram stain, culture, and cell count.",
            "points_fa": [
                "تزریق داخل مفصلی کورتون در مفصل عفونی منجر به تخریب سریع غضروف و شوک سپسیس می‌شود.",
                "مایع سینوویال با گلبول سفید بالای ۵۰ تا ۱۰۰ هزار و بیش از ۹۰٪ نوتروفیل مؤید آرتریت چرکی است.",
                "درمان تجربی با آنتی‌بیوتیک وریدی بلافاصله پس از انجام آرتروسنتز آغاز می‌گردد.",
                "بیمار نیازمند بستری در بخش و تخلیه مکرر مایع چرکی مفصل است."
            ],
            "points_en": [
                "Instilling intra-articular steroids into an undiagnosed septic joint precipitates devastating chondrolysis.",
                "Synovial fluid leukocytosis >50,000-100,000/μL with >90% neutrophils strongly verifies purulent sepsis.",
                "Empiric intravenous bactericidal antibiotic coverage must be instituted promptly following fluid procurement.",
                "Management requires inpatient admission and serial needle aspirations or surgical arthroscopic debridement."
            ]
        }
    },
    4: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: Anti-dsDNA با فعالیت سیستمیک و نفریت لوپوسی مادر همراه است اما عامل اختصاصی ناهنجاری هدایتی جنین نیست.",
            "نادرست است؛ دلیل رد: تست ANA برای غربالگری کلی است و اختصاصیتی برای آسیب قلبی جنین ندارد.",
            "نادرست است؛ دلیل رد: Anti-Smith اختصاصی‌ترین آنتی‌بادی تشخیصی لوپوس است اما عارضه جنینی ایجاد نمی‌کند.",
            "صحیح است؛ آنتی‌بادی «Anti-Ro (SS-A)» (و Anti-La) به عنوان آنتی‌بادی‌های از جنس IgG مادری از سد جفتی عبور کرده و با اتصال به بافت گره دهلیزی-بطنی قلب جنین، موجب آپوپتوز و فیبروز غیرقابل برگشت سیستم هدایتی قلب و بروز «بلوک کامل قلبی مادرزادی (Congenital Heart Block)» و سندرم لوپوس نوزادی می‌شوند؛ بنابراین مثبت شدن Anti-Ro بیشترین احتمال و خطر بروز عارضه جنینی را در بارداری به همراه دارد."
        ],
        "exp": "آنتی‌بادی Anti-Ro (SS-A) با عبور از جفت مسبب بلوک مادرزادی هدایت قلبی در جنین و سندرم لوپوس نوزادی است.",
        "micro": {
            "lead_fa": "آنتی‌بادی‌های Anti-SSA/Ro و Anti-SSB/La مهم‌ترین اتوآنتی‌بادی‌های مرتبط با آسیب جنینی در زنان باردار مبتلا به لوپوس هستند. آنتی‌بادی IgG مادری ضد Ro از هفته ۱۶ بارداری از جفت عبور کرده و با القای التهاب بافت گره AV قلب جنین، بلوک دهلیزی-بطنی درجه سه مادرزادی (Congenital complete AV block) ایجاد می‌کند که عارضه‌ای غیرقابل برگشت و نیازمند پی‌س‌میکر پس از تولد است. پایش با اکوکاردیوگرافی سریال جنین بین هفته‌های ۱۶ تا ۲۶ الزامی است.",
            "lead_en": "Maternal anti-Ro (SS-A) and anti-La (SSB) autoantibodies are intimately tied to fetal complications in SLE. Transplacental passage of maternal IgG antibodies targeting 52-kDa and 60-kDa Ro ribonucleoproteins elicits autoimmune fetal myocarditis, permanently scarring the cardiac conduction system to cause irreversible congenital complete heart block in neonatal lupus syndrome.",
            "golden_fa": "مادر باردار مبتلا به لوپوس: آنتی‌بادی با بیشترین احتمال عارضه جنینی (بلوک قلبی نوزاد) = Anti-Ro (SS-A).",
            "golden_en": "Pregnant lupus patient: antibody bearing the highest fetal complication risk (congenital heart block) = Anti-Ro (SS-A).",
            "points_fa": [
                "خطر بلوک قلبی جنین در مادر Anti-Ro مثبت در بارداری اول حدود ۲ درصد و با سابقه قبلی تا ۱۸ درصد است.",
                "مصرف مستمر هیدروکسی‌کلروکین در طول بارداری خطر وقوع بلوک قلبی جنین را بیش از ۵۰ درصد کاهش می‌دهد.",
                "ضایعات پوستی لوپوس نوزادی با محو شدن آنتی‌بادی‌های مادری ظرف ۶ ماه خودبه‌خود برطرف می‌شوند.",
                "اکوکاردیوگرافی سریال قلب جنین از هفته ۱۶ هر هفته یا دو هفته یک‌بار انجام می‌پذیرد."
            ],
            "points_en": [
                "The baseline risk of fetal heart block in an anti-Ro-positive primigravida is ~2%, rising tenfold if a prior sibling was affected.",
                "Maternal hydroxychloroquine therapy throughout pregnancy slashes fetal cardiac conduction defects by over 50%.",
                "Cutaneous annular lesions of neonatal lupus spontaneously resolve within 6 months as maternal IgG antibodies clear.",
                "Serial fetal Doppler echocardiography is conducted weekly to biweekly between gestational weeks 16 and 26."
            ]
        }
    },
    5: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: قند ناشتا، هموگلوبین A1c و تست OGTT همگی بالاتر از محدوده طبیعی هستند و بیمار تحمل طبیعی ندارد.",
            "صحیح است؛ طبق معیارهای انجمن دیابت آمریکا (ADA)، محدوده «پیش‌دیابت (Prediabetes)» عبارت است از: ۱) قند خون ناشتا (IFG) بین ۱۰۰ تا ۱۲۵ mg/dL (در بیمار ۱۱۸ است)؛ ۲) هموگلوبین A1c بین ۵/۷٪ تا ۶/۴٪ (در بیمار ۶/۱٪ است)؛ ۳) تست تحمل گلوکز دو ساعته (IGT) بین ۱۴۰ تا ۱۹۹ mg/dL (در بیمار ۱۴۸ است)؛ بنابراین تمام معیارهای بیوشیمیایی بیمار دقیقاً بر روی محدوده «پیش‌دیابت (پره‌دیابت)» منطبق است.",
            "نادرست است؛ دلیل رد: برای تشخیص دیابت قند ناشتا مساوی یا بالای ۱۲۶ یا A1c مساوی یا بالای ۶/۵٪ نیاز است.",
            "نادرست است؛ دلیل رد: ارقام آزمایشگاهی بیمار به آستانه تشخیصی دیابت نوع ۲ نرسیده‌اند."
        ],
        "exp": "قند ناشتا ۱۱۸، هموگلوبین A1c معادل ۶/۱٪ و تست تحمل گلوکز ۱۴۸، معیارهای قطعی پیش‌دیابت (Prediabetes) هستند.",
        "micro": {
            "lead_fa": "پیش‌دیابت (Prediabetes) وضعیت پرخطری است که نشان‌دهنده مقاومت شدید به انسولین و ریسک بالای پیشرفت به دیابت نوع ۲ و بیماری‌های عروقی است. طبق معیارهای استاندارد ADA، تشخیص با هر یک از موارد زیر اثبات می‌شود: ۱) اختلال قند ناشتا (IFG): قند پلاسما ۱۰۰ تا ۱۲۵ میلی‌گرم در دسی‌لیتر؛ ۲) اختلال تحمل گلوکز (IGT): قند ۲ ساعت بعد از ۷۵ گرم گلوکز بین ۱۴۰ تا ۱۹۹ میلی‌گرم در دسی‌لیتر؛ ۳) هموگلوبین A1c بین ۵/۷ تا ۶/۴ درصد. اصلاح سبک زندگی و کاهش ۵ تا ۷ درصدی وزن مؤثرترین مداخله است.",
            "lead_en": "Prediabetes identifies an intermediate stage of altered glucose homeostasis conferring substantial cardiovascular and diabetic conversion risk. American Diabetes Association (ADA) criteria classify prediabetes by any of: impaired fasting glucose (IFG: 100-125 mg/dL), impaired glucose tolerance (IGT: 2-hour post-OGTT 140-199 mg/dL), or HbA1c 5.7-6.4%. Intensive lifestyle modification is first-line therapy.",
            "golden_fa": "قند ناشتا ۱۰۰-۱۲۵، تست OGTT بین ۱۴۰-۱۹۹، و HbA1c بین ۵/۷٪-۶/۴٪ = پیش‌دیابت (Prediabetes).",
            "golden_en": "Fasting glucose 100-125, 2-h OGTT 140-199, and HbA1c 5.7-6.4% = prediabetes.",
            "points_fa": [
                "کاهش وزن به میزان ۵ تا ۷ درصد خطر پیشرفت به دیابت را بیش از ۵۸ درصد کاهش می‌دهد.",
                "فعالیت بدنی هوازی حداقل ۱۵۰ دقیقه در هفته جزء توصیه‌های پایه‌ای پیش‌دیابت است.",
                "در افراد زیر ۶۰ سال با BMI بالای ۳۵ تجویز متفورمین برای پیشگیری از دیابت مدنظر قرار می‌گیرد.",
                "آزمایش مجدد غربالگری سالانه در افراد مبتلا به پیش‌دیابت توصیه می‌گردد."
            ],
            "points_en": [
                "Achieving a 5-7% intentional body weight reduction diminishes conversion to overt diabetes by 58%.",
                "Moderate-intensity aerobic physical exercise (at least 150 minutes weekly) represents a core non-pharmacologic mandate.",
                "Metformin pharmacotherapy is considered for diabetes prevention in individuals aged <60 with BMI ≥35 kg/m2.",
                "Annual glycemic surveillance is guideline-recommended to track progressive metabolic deterioration."
            ]
        }
    },
    6: {
        "ci": 0,
        "whys": [
            "صحیح است؛ بروز تیروتوکسیکوز (TSH سرکوب‌شده و T4 بالا) همراه با «غده تیروئید بسیار حساس و دردناک در لمس (Painful and Tender Thyroid)» پس از یک عفونت ویروسی تنفسی اخیر، همراه با «کاهش شدید یا فقدان جذب ید رادیواکتیو در اسکن (Near-zero RAIU ناشی از تخریب فولیکول‌ها)»، تابلوی پاتوگنومونیک و کلاسیک «تیروئیدیت تحت‌حاد گرانولوماتوز (تیروئیدیت دکرون / Subacute Thyroiditis)» است.",
            "نادرست است؛ دلیل رد: بیماری گریوز با تیروئید غیردردناک و افزایش منتشر و یکنواخت جذب در اسکن ید رادیواکتیو (High RAIU) همراه است.",
            "نادرست است؛ دلیل رد: آدنوم توکسیک با یک گره گرم تکی در اسکن و جذب بالا در همان موضع تظاهر می‌یابد.",
            "نادرست است؛ دلیل رد: تیروتوکسیکوز ساختگی (مصرف هورمون) تیروئید دردناک و حساس در معاینه ندارد و تیروئید آتروفیک است."
        ],
        "exp": "تیروئید دردناک، تیروتوکسیکوز و جذب ید رادیواکتیو نزدیک به صفر پس از عفونت ویروسی، مشخصه تیروئیدیت تحت‌حاد (دکرون) است.",
        "micro": {
            "lead_fa": "تیروئیدیت تحت‌حاد گرانولوماتوز (تیروئیدیت دکورون) یک التهاب گذرای تیروئید با منشأ ویروسی پس از عفونت راه‌های تنفسی فوقانی است. علامت محوری: درد شدید و تندرنس بسیار بارز روی غده تیروئید که اغلب به فک و گوش‌ها تیر می‌کشد. در فاز اولیه به علت پارگی فولیکول‌ها و ریزش هورمون، تیروتوکسیکوز همراه با ESR بسیار بالا (بالای ۵۰ تا ۱۰۰) و جذب ید رادیواکتیو (RAIU) نزدیک به صفر دیده می‌شود. درمان با NSAIDs و در دردهای شدید پردنیزولون است.",
            "lead_en": "Subacute granulomatous thyroiditis (de Quervain's thyroiditis) is a post-viral inflammatory condition following an upper respiratory infection. Cardinal diagnostic findings comprise exquisite anterior neck tenderness radiating toward the mandible/ears, transient thyrotoxicosis from follicular destruction, markedly elevated ESR, and a near-zero radioactive iodine uptake (RAIU). NSAIDs or prednisone provide rapid symptomatic relief.",
            "golden_fa": "تیروئید به شدت دردناک + تیروتوکسیکوز + اسکن ید رادیواکتیو نزدیک صفر (RAIU=0) = تیروئیدیت تحت‌حاد (دکورون).",
            "golden_en": "Exquisitely tender thyroid + thyrotoxicosis + near-zero radioiodine uptake (RAIU ≈ 0) = subacute (de Quervain's) thyroiditis.",
            "points_fa": [
                "افزایش شدید نشانگر فاز حاد ESR (اغلب بالای ۵۰ تا ۱۰۰ میلی‌متر در ساعت) سرنخ آزمایشگاهی شاخص است.",
                "داروهای ضد تیروئید (متی‌مازول) در تیروئیدیت تحت‌حاد بی‌اثر هستند زیرا سنتز جدید هورمون وجود ندارد.",
                "بتابلوکرها (پروپرانولول) علائم تپش قلب و لرزش فاز تیروتوکسیک را تسکین می‌دهند.",
                "بیماری معمولاً خودمحدودشونده است اما ممکن است به فاز کم‌کاری موقت تیروئید قبل از بهبودی کامل برود."
            ],
            "points_en": [
                "Marked erythrocyte sedimentation rate (ESR) elevation, characteristically >50-100 mm/h, is virtually universal.",
                "Antithyroid medications (methimazole) are completely ineffective because hyperthyroidism reflects leakage, not hyper-synthesis.",
                "Beta-blockers (propranolol) manage transient hyperadrenergic palpitations during the initial destructive thyrotoxic phase.",
                "The natural course evolves through euthyroidism, transient hypothyroidism, and eventual full functional recovery."
            ]
        }
    },
    7: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: بدخیمی‌های صفاقی مایع اگزودا با SAAG کمتر از ۱/۱ ایجاد می‌کنند و شمارش PMN بالای ۲۵۰ را توجیه نمی‌نمایند.",
            "نادرست است؛ دلیل رد: پریتونیت سلی با غلبه لنفوسیت‌ها در مایع آسیت (بیش از ۷۰٪) و SAAG زیر ۱/۱ تظاهر می‌یابد نه ۸۰٪ PMN.",
            "نادرست است؛ دلیل رد: کاهش سطح هوشیاری در این بیمار ناشی از انسفالوپاتی کبدی برانگیخته‌شده توسط عفونت داخل شکمی است.",
            "صحیح است؛ در یک بیمار مبتلا به سیروز کبدی و هایپرتانسیون پورت (SAAG = 3 - 1.5 = 1.5 > 1.1) با افت سطح هوشیاری، آنالیز مایع آسیت نشان‌دهنده «شمارش مطلق نوتروفیل‌های چند‌هسته‌ای مساوی یا بیش از ۲۵۰ در میکرولیتر (Absolute Neutrophil Count = 600 * 80% = 480 PMN/mm3)» است؛ این یافته معیار قطعی، استاندارد طلایی و پاتوگنومونیک «پریتونیت باکتریایی خود‌به‌خودی (Spontaneous Bacterial Peritonitis / SBP)» است و شروع فوری آنتی‌بیوتیک تجربی را الزامی می‌سازد."
        ],
        "exp": "شمارش مطلق نوتروفیل‌های مایع آسیت بالای ۲۵۰ (در این بیمار ۴۸۰ = ۸۰٪ * ۶۰۰)، نشانه قطعی پریتونیت خودبه‌خودی (SBP) است.",
        "micro": {
            "lead_fa": "پریتونیت باکتریال خود‌به‌خودی (SBP) عفونت مایع آسیت بدون وجود کانون جراحی داخل شکمی در بیماران سیروتیک است. تظاهر بالینی می‌تواند بسیار موذی با بدتر شدن آنسفالوپاتی یا نارسایی کلیه بدون تب باشد. تشخیص استاندارد بر شمارش نوتروفیل‌های چند‌هسته‌ای (PMN) مایع آسیت استوار است: PMN مساوی یا بیشتر از ۲۵۰ در میکرولیتر تشخیص را قطعی می‌سازد. درمان نجات‌بخش تزریق فوری آنتی‌بیوتیک سفالوسپورین نسل سوم (سفوتاکسیم یا سفتریاکسون) همراه با آلبومین وریدی است.",
            "lead_en": "Spontaneous bacterial peritonitis (SBP) is an acute bacterial infection of ascitic fluid in cirrhotic patients, commonly presenting subtly with encephalopathy, worsening azotemia, or abdominal pain. Diagnostic confirmation requires an ascitic fluid absolute polymorphonuclear (PMN) count ≥250 cells/μL (here: 600 x 0.80 = 480 PMNs/μL). Immediate empirical intravenous third-generation cephalosporin therapy plus IV albumin is mandatory.",
            "golden_fa": "سیروز با افت هوشیاری + نوتروفیل مایع آسیت ≥ ۲۵۰ = پریتونیت باکتریال خود‌به‌خودی (SBP)؛ درمان: سفتریاکسون + آلبومین.",
            "golden_en": "Cirrhotic with encephalopathy + ascitic PMN count ≥250/μL = spontaneous bacterial peritonitis (SBP); therapy: ceftriaxone + albumin.",
            "points_fa": [
                "شمارش PMN آسیت در این بیمار: ۴۸۰ سلول است که بسیار بالاتر از آستانه ۲۵۰ قرار دارد.",
                "تجویز آلبومین وریدی (۱/۵ گرم/کیلوگرم در روز اول و ۱ گرم/کیلوگرم در روز سوم) ریسک سندرم هپاتورنال را به شدت کم می‌کند.",
                "کشت مایع آسیت باید مستقیماً در شیشه‌های کشت خون بر بالین بیمار تلقیح شود.",
                "پس از بهبود حمله اول، پروفیلاکسی مادام‌العمر با نورفلوکساسین یا کوتریموکسازول جهت پیشگیری از عود الزامی است."
            ],
            "points_en": [
                "Ascitic fluid absolute PMN count in this patient is 480 cells/μL, comfortably exceeding the 250 threshold.",
                "Intravenous albumin infusions (1.5 g/kg day 1, 1.0 g/kg day 3) significantly reduce hepatorenal syndrome and mortality.",
                "Bedside inoculation of ascitic fluid directly into blood culture bottles maximizes microbiological yield.",
                "Secondary long-term prophylaxis utilizing oral fluoroquinolones (norfloxacin) is mandatory to prevent recurrent SBP."
            ]
        }
    },
    8: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: افزایش متفورمین در فاز حاد ACS به دلیل ریسک اسیدوز لاکتیک و اقدامات تهاجمی آنژیوگرافی با کنتراست خط اول نیست.",
            "صحیح است؛ در بیماران مبتلا به دیابت نوع ۲ که دچار سندرم حاد کرونری (ACS) یا بیماری قلبی-عروقی آترواسکلروتیک ثابت‌شده (ASCVD) هستند، بر اساس تمام دستورالعمل‌های ADA و انجمن قلب آمریکا، داروی انتخابی ارجح برای افزودن به متفورمین «داروهای آگونیست گیرنده GLP-1 با اثربخشی اثبات‌شده قلبی (نظیر لیراگلوتاید / Liraglutide)» یا مهارکننده‌های SGLT2 است؛ زیرا لیراگلوتاید در مطالعه LEADER به طور معناداری حوادث ماژور قلبی (MACE) و مرگ‌ومیر قلبی-عروقی را کاهش داده است.",
            "نادرست است؛ دلیل رد: پیوگلیتازون موجب احتباس آب و نمک شده و در بیماران بستری در CCU و نارسایی قلبی بالقوه منع مصرف دارد.",
            "نادرست است؛ دلیل رد: گلیکلازید (سولفونیل‌اوره) در فاز حاد سکته قلبی خطر هایپوگلیسمی خطرناک دارد و سودمندی قلبی اختصاصی نشان نداده است."
        ],
        "exp": "در بیمار دیابتی با سندرم حاد کرونری (ACS)، افزودن آگونیست گیرنده GLP-1 (لیراگلوتاید) موجب محافظت قلبی و کاهش مرگ‌ومیر می‌شود.",
        "micro": {
            "lead_fa": "در هدایت دارویی دیابت نوع ۲ طبق دستورالعمل‌های انجمن دیابت آمریکا (ADA)، حضور بیماری قلبی-عروقی آترواسکلروتیک (ASCVD نظیر سابقه انفارکتوس قلبی یا ACS) مستقلاً تعیین‌کننده خط دوم درمان است. در این بیماران، صرف‌نظر از سطح HbA1c، دارویی با سودمندی قلبی اثبات‌شده باید افزوده شود: آگونیست‌های گیرنده GLP-1 با مزیت قلبی (لیراگلوتاید، سماگلوتاید) یا مهارکننده‌های SGLT2 (امپاگلیفلوزین). پیوگلیتازون به علت احتباس سدیم در CCU ممنوع است.",
            "lead_en": "In type 2 diabetes mellitus complicated by established atherosclerotic cardiovascular disease (ASCVD / acute coronary syndrome), validated ADA/ACC guidelines mandate prioritizing disease-modifying agents with proven secondary cardiovascular risk reduction. Adding a GLP-1 receptor agonist with demonstrated cardiovascular superiority (specifically liraglutide, as established in LEADER) represents the optimal guideline-directed pharmacotherapy.",
            "golden_fa": "دیابت همراه با بیماری عروق کرونر (ACS): داروی انتخابی افزوده‌شده = آگونیست GLP-1 (لیراگلوتاید) جهت کاهش مرگ‌ومیر قلبی.",
            "golden_en": "Type 2 diabetes with ACS = add GLP-1 receptor agonist (liraglutide) with established cardiovascular mortality reduction.",
            "points_fa": [
                "لیراگلوتاید علاوه بر کنترل قند موجب کاهش وزن و کاهش نرخ سکته‌های قلبی مجدد می‌گردد.",
                "پیوگلیتازون به دلیل خطر ادم ریوی و تشدید نارسایی قلبی در سندرم‌های حاد کرونری منع مصرف دارد.",
                "در فاز حاد بستری در CCU قند خون معمولاً با انسولین رگولار وریدی کنترل می‌شود.",
                "سولفونیل‌اوره‌ها با مهار پیش‌شرطی‌سازی ایسکمیک میوکارد داروی مطلوبی در فاز حاد قلبی نیستند."
            ],
            "points_en": [
                "Liraglutide provides sustained HbA1c reduction, intentional weight loss, and secondary major adverse cardiac event suppression.",
                "Pioglitazone induces renal fluid retention, rendering it strictly contraindicated amidst unstable ischemic heart disease.",
                "During acute CCU admission, intravenous regular insulin titration represents the acute in-hospital standard of care.",
                "Sulfonylureas impair ischemic myocardial preconditioning and run unacceptable inpatient hypoglycemia hazards."
            ]
        }
    },
    9: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: اندازه‌گیری ACTH گام دوم پس از اثبات افت اولیه کورتیزول است تا منشأ اولیه از ثانویه تفکیک شود.",
            "نادرست است؛ دلیل رد: سنجش کورتیزول ادرار ۲۴ ساعته برای بررسی پرکاری آدرنال (سندرم کوشینگ) است نه نارسایی آدرنال.",
            "نادرست است؛ دلیل رد: رنین و آلدوسترون تست‌های تکمیلی هستند اما اولین و حیاتی‌ترین اقدام تشخیصی اثبات کمبود کورتیزول است.",
            "صحیح است؛ در یک بیمار جوان با تابلوی بالینی تیپیک نارسایی اولیه قشر آدرنال (بیماری آدیسون: ضعف، کاهش وزن، اشتیاق به نمک، هیپرپیگمانتاسیون پوست در نواحی چین‌ها همراه با هیپوناترمی و هیپرکالمی)، مناسب‌ترین، اساسی‌ترین و اولین اقدام تشخیصی در این مرحله «اندازه‌گیری سطح کورتیزول صبحگاهی پلاسما (8 AM Plasma Cortisol)» (و در صورت لزوم تست تحریک با ACTH سنتتیک / کوسینتروپین) است تا کمبود ترشح گلوکوکورتیکوئیدها اثبات گردد."
        ],
        "exp": "در مواجهه با شک قوی به نارسایی آدرنال (آدیسون)، اولین و مناسب‌ترین اقدام تشخیصی سنجش کورتیزول صبحگاهی پلاسما است.",
        "micro": {
            "lead_fa": "بیماری آدیسون (نارسایی اولیه کورتکس آدرنال) با تخریب اتوایمیون کورتکس غدد فوق‌کلیوی ایجاد می‌شود. تظاهرات تیپیک: ضعف مفرط، کاهش وزن، میل به مصرف نمک (Salt craving ناشی از کمبود آلدوسترون)، تیرگی و پیگمانتاسیون پوست به ویژه در خطوط دست و مخاط دهان ناشی از افزایش ACTH و ملانوسیت‌ها، همراه با هایپوناترمی و هایپرکالمی. قدم اول تشخیصی اندازه‌گیری کورتیزول سرم در ساعت ۸ صبح است؛ مقادیر کمتر از ۳ میکروگرم بر دسی‌لیتر نارسایی آدرنال را قطعی می‌سازد.",
            "lead_en": "Primary adrenal insufficiency (Addison's disease) involves autoimmune destruction of all adrenal cortical zones, depleting both cortisol and aldosterone. Clinical hallmarks feature fatigue, weight loss, salt craving, hyperpigmentation, hyponatremia, and hyperkalemia. The initial screening investigation is measuring an 8 AM plasma cortisol (values <3-5 μg/dL verify hypocortisolemia, prompting ACTH cosyntropin stimulation).",
            "golden_fa": "شک به آدیسون (تیرگی پوست + افت سدیم و افزایش پتاسیم) = اقدام اول: اندازه‌گیری کورتیزول صبحگاهی پلاسما.",
            "golden_en": "Suspected Addison's (hyperpigmentation + hyponatremia/hyperkalemia) = initial step: morning 8 AM plasma cortisol.",
            "points_fa": [
                "تست استاندارد طلایی تأییدی، تست تحریک با کوسینتروپین (۲۵۰ میکروگرم ACTH) است.",
                "در صورت تأیید کمبود کورتیزول، سطح بالای ACTH پلاسما نارسایی اولیه (آدیسون) را از ثانویه تفکیک می‌کند.",
                "درمان جایگزینی شامل هیدروکورتیزون خوراکی به همراه فلودروکورتیزون (مینرالوکورتیکوئید) است.",
                "آموزش افزایش دوز دارو در زمان بیماری، جراحی و استرس جهت پیشگیری از بحران کشنده آدرنال الزامی است."
            ],
            "points_en": [
                "The definitive confirmatory gold standard is the short cosyntropin (250 μg synthetic ACTH) stimulation test.",
                "Subsequent plasma ACTH measurement differentiates primary (markedly elevated) from central secondary adrenal failure.",
                "Standard maintenance therapy pairs oral glucocorticoids (hydrocortisone) with a mineralocorticoid (fludrocortisone).",
                "Patient education regarding mandatory stress-dose adjustments during febrile illness averts fatal adrenal crisis."
            ]
        }
    },
    10: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: وانکومایسین سمیت توبولار می‌دهد اما هایپوکالمی شدید و هایپومنیزیمی پاتوگنومونیک آمفوتریسین B را ایجاد نمی‌کند.",
            "صحیح است؛ داروی ضدقارچ «آمفوتریسین بی (Amphotericin B)» به طور کلاسیک و پاتوگنومونیک با اتصال به کلسترول غشای توبول‌های کلیه، منافذ نفوذپذیری ایجاد کرده و تابلوی نارسایی حاد کلیه (افزایش کراتینین به 3.3) همراه با «دفع شدید کلیوی پتاسیم و منیزیم (هایپوکالمی شدید K=2.8 و هایپومنیزیمی)، اسیدوز توبولار نوع یک (دیستال) و هیپوکلسمی» ایجاد می‌نماید که این تابلوی آزمایشگاهی دقیقاً ویژه سمیت آمفوتریسین B است.",
            "نادرست است؛ دلیل رد: سفتریاکسون عمدتاً از صفرا دفع می‌شود و نفروتوکسیسیتی با هایپوکالمی شدید نمی‌دهد.",
            "نادرست است؛ دلیل رد: آسیکلوویر با رسوب کریستال‌ها در لوله‌ها نارسایی کلیه انسدادی با سدیمان کریستالی می‌دهد نه اتلاف پتاسیم/منیزیم."
        ],
        "exp": "نارسایی حاد کلیه همراه با اتلاف شدید پتاسیم (K=2.8)، هایپومنیزیمی و اسیدوز توبولار، مشخصه بارز سمیت آمفوتریسین B است.",
        "micro": {
            "lead_fa": "سمیت کلیوی داروی ضدقارچ آمفوتریسین B ناشی از وازوکانستریکسیون شریانچه‌های کلیه و آسیب مستقیم به غشای توبول‌های پروگزیمال و دیستال است. پاتوژنزی منحصربه‌فرد این دارو ایجاد منافذ اتلافی در لوله‌های جمع‌کننده کلیه است که منجر به اتلاف شدید پتاسیم و منیزیم (Wasting)، هایپوکالمی پایدار مقاوم به درمان، هایپومنیزیمی، هیپوکلسمی و اسیدوز توبولار دیستال نوع ۱ (RTA) می‌گردد. هیدراسیون با سرم سالین قبل از تزریق دارو از شدت سمیت کلیوی می‌کاهد.",
            "lead_en": "Amphotericin B deoxycholate nephrotoxicity arises from afferent arteriolar vasoconstriction and direct disruption of tubular epithelial membranes. The biochemical signature is non-oliguric acute kidney injury characterized by dramatic renal tubular potassium and magnesium wasting, refractory hypokalemia, hypomagnesemia, and type 1 distal RTA. Pre-infusion saline volume loading attenuates nephrotoxic severity.",
            "golden_fa": "نارسایی حاد کلیه + هایپوکالمی شدید (K=2.8) و هایپومنیزیمی در بیمار ICU = سمیت آمفوتریسین B (Amphotericin B).",
            "golden_en": "Acute kidney injury + severe hypokalemia (K 2.8) and hypomagnesemia in ICU = amphotericin B toxicity.",
            "points_fa": [
                "فرمولاسیون‌های لیپیدی آمفوتریسین B (نظیر آمبیزوم) سمیت کلیوی بسیار کمتری نسبت به دئوکسی‌کولات دارند.",
                "انفوزیون ۵۰۰ تا ۱۰۰۰ میلی‌لیتر سرم نرمال سالین قبل از تجویز آمفوتریسین B از سمیت توبولار پیشگیری می‌کند.",
                "جبران تهاجمی پتاسیم و منیزیم در طول دوره درمان با آمفوتریسین B الزامی است.",
                "آسیکلوویر با کریستالیزاسیون داخل توبول نارسایی می‌دهد و با هیدراسیون فراوان مهار می‌شود."
            ],
            "points_en": [
                "Liposomal amphotericin B (AmBisome) significantly curtails tubular membrane disruption and renal toxicity.",
                "Pre-infusion intravascular sodium loading with 500-1,000 mL normal saline preserves renal microcirculation.",
                "Aggressive proactive intravenous potassium and magnesium supplementation is mandatory during therapy.",
                "Acyclovir nephrotoxicity conversely reflects intratubular crystal precipitation, mitigated by slow saline hydration."
            ]
        }
    },
    11: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: FeNa در نارسایی ذاتی کلیوی ناشی از نکروز حاد توبولار (ATN) به دلیل از دست رفتن بازجذب توبولار بیشتر از ۱ درصد (>1%) است نه کمتر از ۱٪.",
            "صحیح است؛ رژه نظامی سنگین در هوای گرم منجر به رابدومیولیز حاد (Exertional Rhabdomyolysis) با آزاد شدن مقادیر فراوان میوگلوبین از عضلات آسیب‌دیده می‌گردد؛ میوگلوبین موجب مثبت شدن ۳+ بیلیستر دیپ‌استیک برای هموگلوبین بدون حضور گلبول‌های قرمز سالم (RBC=0-1) می‌شود؛ رسوب میوگلوبین با تخریب توبول‌ها نارسایی کلیوی ناشی از «نکروز حاد توبولار (ATN)» ایجاد می‌کند؛ مشخصه پاتولوژیک ادراری آن حضور «کست‌های پیگمانته دندانه‌دار قهوه‌ای (Pigmented Granular / Muddy-Brown Casts)» و شاخص کسری دفع سدیم «FeNa بیشتر از یک درصد (FeNa > 1%)» است.",
            "نادرست است؛ دلیل رد: کست‌های گلبول قرمز (RBC Casts) مشخصه گلومرولونفریت حاد هستند نه رابدومیولیز.",
            "نادرست است؛ دلیل رد: در رابدومیولیز کست RBC تشکیل نمی‌شود زیرا مویرگ‌های گلومرول سالم هستند."
        ],
        "exp": "رابدومیولیز ورزشی با آسیب حاد توبولار (ATN) همراه است که مشخصه آن کست پیگمانته ادراری و FeNa بالای ۱٪ است.",
        "micro": {
            "lead_fa": "رابدومیولیز ناشی از ورزش سنگین نظامی با تخریب حاد میوسیت‌ها و ورود مقادیر انبوه میوگلوبین به گردش خون مشخص می‌شود. دیپ‌استیک ادرار به علت شباهت مولکولی میوگلوبین با هموگلوبین برای خون مثبت شدید (3+) می‌شود در حالی که زیر میکروسکوپ RBC دیده نمی‌شود. انقباض عروقی کلیه و سمیت اکسیداتیو میوگلوبین سبب نکروز حاد توبولار (ATN) می‌شود. رسوب میکروسکوپی ادرار حاوی کست‌های دانه‌دار پیگمانته قهوه‌ای چرک (Muddy brown) بوده و به دلیل نارسایی توبول، FeNa بالای ۱ درصد است.",
            "lead_en": "Exertional rhabdomyolysis following intense military marching drives massive myoglobinuria, characteristically yielding dipstick heme positivity in the complete absence of intact urinary RBCs. Heme pigment casts precipitate acute tubular necrosis (ATN). Urinalysis establishes pathognomonic pigmented granular 'muddy brown' casts, alongside a fractional excretion of sodium (FeNa) exceeding 1%, confirming intrinsic renal tubular failure.",
            "golden_fa": "رابدومیولیز ورزشی (ادرار مثبت کاذب برای خون بدون RBC): کست‌های پیگمانته (Muddy brown) و FeNa بالای ۱٪.",
            "golden_en": "Exertional rhabdomyolysis ATN: pigmented granular (muddy brown) casts with fractional sodium excretion (FeNa) >1%.",
            "points_fa": [
                "افزایش شدید آنزیم کراتین کیناز (CPK سرم معمولاً بالای ۵ تا ۱۰ برابر نرمال) تشخیص رابدومیولیز را قطعی می‌سازد.",
                "درمان فوری با هیدراسیون وریدی تهاجمی سریع با نرمال سالین (۳۰۰ تا ۵۰۰ میلی‌لیتر در ساعت) است.",
                "هایپرکالمی شدید ناشی از تخریب سلول‌های عضله شایع‌ترین علت مرگ ناگهانی قلبی است.",
                "کست‌های RBC منحصراً در گلومرولونفریت‌های حاد و سندرم نفریتیک دیده می‌شوند."
            ],
            "points_en": [
                "Profound elevation in serum creatine kinase (CK characteristically >5-fold) definitively confirms skeletal rhabdomyolysis.",
                "Immediate resuscitation pivots on aggressive early intravenous isotonic crystalloids targeting urine output >200-300 mL/h.",
                "Life-threatening hyperkalemia released from necrotic myocytes constitutes the paramount lethal cardiac hazard.",
                "RBC casts are strictly confined to active proliferative glomerulonephritis and small-vessel renal vasculitis."
            ]
        }
    },
    12: {
        "ci": 0,
        "whys": [
            "صحیح است؛ داروی «لیتیوم (Lithium)» در مصرف درازمدت موجب بروز «نفریت بینابینی مزمن کلیوی (Chronic Tubulointerstitial Nephritis)» با آتروفی توبول‌ها، فیبروز بافت بینابینی، تشکیل میکروکیست‌های متعدد در قشر و مدولای کلیه و نارسایی مزمن کلیه (CKD) می‌گردد.",
            "نادرست است؛ دلیل رد: لیتیوم دیابت بی‌مزه نفروژنیک (Nephrogenic DI) ناشی از مهار کانال‌های آکواپورین-۲ در کلیه ایجاد می‌کند نه دیابت بی‌مزه مرکزی.",
            "نادرست است؛ دلیل رد: لیتیوم با تحریک ترشح پاراتورمون موجب هایپرکلسمی (Hypercalcemia) و پرکاری پاراتیروئید می‌شود نه هیپوکلسمی.",
            "نادرست است؛ دلیل رد: اسیدوز توبولار تیپ ۱ عارضه اصلی لیتیوم نیست و سمیت اصلی نفروژنیک DI و نفریت بینابینی مزمن است."
        ],
        "exp": "مصرف طولانی‌مدت لیتیوم موجب نفریت بینابینی مزمن کلیوی (Chronic Interstitial Nephritis) و دیابت بی‌مزه نفروژنیک می‌شود.",
        "micro": {
            "lead_fa": "لیتیوم داروی تثبیت‌کننده خلق در اختلال دو‌قطبی است که دفع آن منحصراً کلیوی است و از طریق کانال‌های ENaC وارد سلول‌های توبول می‌شود. عوارض کلیوی مهم لیتیوم عبارتند از: ۱) دیابت بی‌مزه نفروژنیک (NDI) در ۲۰ تا ۴۰ درصد مصرف‌کنندگان به علت مهار عملکرد وازوپرسین بر کانال‌های آکواپورین-۲ با پرادراری و تشنگی؛ ۲) نفریت توبولواینترستیشیال مزمن (CIN) با فیبروز بافتی و میکروکیست‌ها در مصرف بالای ۱۰ تا ۱۵ سال؛ ۳) هایپرکلسمی و هایپرپاراتیروئیدیسم.",
            "lead_en": "Lithium toxicity selectively targets the renal tubulointerstitium via cellular uptake through ENaC channels. Chronic long-term exposure provokes chronic tubulointerstitial nephritis (CIN) pathologically characterized by interstitial fibrosis, tubular atrophy, and microcyst formation. Concurrently, lithium impairs adenylate cyclase signaling, eliciting nephrogenic (not central) diabetes insipidus, and stimulates hyperparathyroidism.",
            "golden_fa": "عوارض کلیوی لیتیوم: نفریت بینابینی مزمن (CIN)، دیابت بی‌مزه نفروژنیک و هایپرکلسمی.",
            "golden_en": "Renal toxicities of lithium: chronic interstitial nephritis (CIN), nephrogenic diabetes insipidus, and hypercalcemia.",
            "points_fa": [
                "لیتیوم دیابت بی‌مزه نفروژنیک می‌دهد که با دسموپرسین اصلاح نمی‌شود.",
                "داروی آمیلوراید با مسدود کردن ورود لیتیوم از طریق کانال ENaC دیابت بی‌مزه نفروژنیک را تسکین می‌دهد.",
                "پایش منظم سطح سرمی کراتینین و غلظت پلاسمایی لیتیوم هر ۶ ماه الزامی است.",
                "در صورت افت شدید GFR قطع لیتیوم و جایگزینی با سایر داروهای اعصاب توصیه می‌شود."
            ],
            "points_en": [
                "Lithium drives nephrogenic diabetes insipidus refractory to desmopressin by internalizing apical aquaporin-2 channels.",
                "Amiloride blocks lithium entry through luminal ENaC channels, partially restoring urinary concentrating ability.",
                "Routine biannual surveillance of serum creatinine, eGFR, and trough serum lithium levels is clinically mandated.",
                "Progressive renal functional decline warrants careful psychiatric taper and transition to non-lithium mood stabilizers."
            ]
        }
    },
    13: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: در RTA پروگزیمال (نوع ۲) ادرار در اسیدوز سیستمیک به خوبی اسیدی می‌شود (pH زیر ۵/۵) و نفروکلسینوز دیده نمی‌شود.",
            "صحیح است؛ تابلوی اسیدوز متابولیک با آنیون گپ طبیعی (pH=7.20, HCO3=17)، «ناتوانی در اسیدی کردن ادرار (Urine pH=6.8 که بالاتر از ۵/۵ است) در حضور اسیدوز سیستمیک»، هایپوکالمی شدید (K=2.9)، «وجود نفروکلسینوز دوطرفه در گرافی شکم» و «آنیون گپ ادراری مثبت مساوی +۵۰ [Urine Na + K - Cl = 100 + 60 - 110 = +50]»، تعریف پاتوگنومونیک و کلاسیک «اسیدوز توبولار دیستال نوع یک (Type 1 Classical Distal RTA)» ناشی از نقص پمپ هیدروژنی توبول دیستال است.",
            "نادرست است؛ دلیل رد: RTA نوع ۴ با هایپرکالمی و کمبود آلدوسترون همراه است و نفروکلسینوز نمی‌دهد.",
            "نادرست است؛ دلیل رد: نوع ۳ فرم نادر نوزادی ناشی از جهش کربنیک انهیدراز ۲ است و تابلوی شایع دختر ۱۴ ساله نیست."
        ],
        "exp": "pH ادرار بالای ۵/۵ در حضور اسیدوز، نفروکلسینوز، هایپوکالمی و آنیون گپ ادراری مثبت، مشخصه RTA دیستال (نوع ۱) است.",
        "micro": {
            "lead_fa": "اسیدوز توبولار کلیوی دیستال یا کلاسیک (Type 1 RTA) ناشی از ناتوانی سلول‌های اینترکالیت آلفا در توبول جمع‌کننده قشر کلیه در ترشح یون‌های H+ به لومن ادرار است. مشخصات تشخیصی شاخص: ۱) عدم توانایی در اسیدی کردن ادرار (pH ادرار همواره بالای ۵/۵ باقی می‌ماند حتی در اوج اسیدوز)؛ ۲) آنیون گپ مثبت ادراری (نشانه نقص ترشح آمونیوم)؛ ۳) هایپوکالمی ناشی از اتلاف پتاسیم در توبول دیستال؛ ۴) هیپرکالسیوری و افت سیترات ادرار که منجر به بروز نفروکلسینوز و سنگ‌های کلسیمی مکرر می‌شود.",
            "lead_en": "Classic distal renal tubular acidosis (Type 1 RTA) arises from failure of alpha-intercalated cells to secrete protons (H+) into the collecting duct lumen. Hallmark diagnostic criteria encompass: inability to acidify urine below pH 5.5 despite systemic acidemia, a positive urine net charge (urine anion gap), hypokalemia, and profound hypocitraturia/hypercalciuria driving bilateral nephrocalcinosis and recurrent calcium phosphate stones.",
            "golden_fa": "اسیدوز با pH ادرار بالای ۵/۵ + نفروکلسینوز + هایپوکالمی = اسیدوز توبولار دیستال نوع یک (Type 1 RTA).",
            "golden_en": "Metabolic acidosis with urine pH >5.5 + nephrocalcinosis + hypokalemia = classic distal (type 1) RTA.",
            "points_fa": [
                "آنیون گپ ادراری در این بیمار: ۱۰۰ + ۶۰ - ۱۱۰ = ۵۰+ است که نقص ترشح H+ و آمونیوم را اثبات می‌کند.",
                "نفروکلسینوز دوطرفه به دلیل رسوب نمک فسفات کلسیم در پارانشیم مدولاری کلیه ایجاد می‌شود.",
                "درمان قطعی تجویز روزانه بی‌کربنات سدیم یا سیترات پتاسیم جهت اصلاح اسیدوز و پیشگیری از سنگ است.",
                "RTA نوع ۱ در بزرگسالان ارتباط تنگاتنگی با بیماری خودایمن سندرم شوگرن دارد."
            ],
            "points_en": [
                "Positive urine anion gap (+50 mEq/L) unequivocally verifies defective distal urinary ammonium (NH4+) excretion.",
                "Bilateral medullary nephrocalcinosis stems from calcium phosphate precipitation favored by high alkaline urinary pH.",
                "Definitive alkali replacement incorporates potassium citrate or sodium bicarbonate to arrest stone progression.",
                "Autoimmune primary Sjogren's syndrome is the foremost secondary etiology driving distal RTA in adult females."
            ]
        }
    },
    14: {
        "ci": 0,
        "whys": [
            "صحیح است (موردی که در ارزیابی وضعیت حجم در استفراغ گمراه‌کننده و غیرمؤثر است)؛ در بیماری که به دنبال استفراغ شدید دچار آلکالوز متابولیک شده است، به علت فیلتراسیون مقادیر بالای بی‌کربنات از گلومرول که بیش از ظرفیت بازجذب توبول پروکسیمال است، یون‌های بی‌کربنات به صورت آنیون دفع‌ناپذیر دفع شده و اجباراً یون سدیم را همراه خود به ادرار می‌کشند؛ بنابراین «سطح سدیم ادرار (Urine Na)» حتی در حضور کاهش حجم شدید ممکن است «به طور کاذب بالای ۲۰ تا ۴۰» باشد؛ شاخص تشخیصی دقیق برای وضعیت حجم در استفراغ «کلر ادرار (Urine Cl)» است که به زیر ۱۰ تا ۱۵ سقوط می‌کند.",
            "نادرست است؛ دلیل رد: کلر ادرار (Urine Cl) استاندارد طلایی و دقیق‌ترین تست بررسی وضعیت حجم و افتراق آلکالوز پاسخ‌دهنده به سالین در استفراغ است.",
            "نادرست است؛ دلیل رد: اسید اوریک سرم در هایپوولمی به علت افزایش بازجذب در توبول پروکسیمال بالا می‌رود و به ارزیابی حجم کمک می‌کند.",
            "نادرست است؛ دلیل رد: نسبت BUN به کراتینین بالای ۲۰ نشانه کاهش حجم درون‌عروقی و ازوتمی پره‌رنال است."
        ],
        "exp": "در استفراغ حاد، بی‌کربناتوری موجب سدیم ادرار بالا و کاذب می‌شود؛ بنابراین کلر ادرار (Urine Cl) ارزیاب دقیق حجم است نه Urine Na.",
        "micro": {
            "lead_fa": "در ارزیابی وضعیت حجم در آلکالوز متابولیک ناشی از استفراغ حاد (از دست رفتن اسید کلریدریک معده)، سنجش سدیم ادرار گمراه‌کننده است. در فاز فعال استفراغ، بی‌کربنات فیلتره‌شده در ادرار به عنوان آنیون دفع‌ناپذیر بار منفی ادرار را بالا برده و سدیم را به اجبار با خود دفع می‌کند (سدیم ادرار کاذباً > ۲۰). در مقابل، یون کلر به شدت توسط کلیه بازجذب شده و سطح کلر ادرار (Urine Cl) به کمتر از ۱۰ تا ۱۵ میلی‌اکی‌والان سقوط می‌کند. بنابراین کلر ادرار شاخص واقعی دهیدراتاسیون در استفراغ است.",
            "lead_en": "Diagnostic assessment of intravascular volume in vomiting-induced metabolic alkalosis is uniquely confounded. Marked bicarbonaturia forces obligatory cation co-excretion, generating misleadingly elevated urine sodium (>20-40 mEq/L) despite profound hypovolemia. Urine chloride (Urine Cl) is immune to this effect, dropping below 10-15 mEq/L to accurately signal volume depletion and chloride responsiveness.",
            "golden_fa": "در استفراغ شدید، سدیم ادرار کاذباً بالاست و در ارزیابی حجم مؤثر نیست؛ شاخص واقعی دهیدراتاسیون = کلر ادرار (Urine Cl < 10).",
            "golden_en": "In active vomiting, urine sodium is misleadingly elevated; urine chloride (<10-15 mEq/L) is the true indicator of hypovolemia.",
            "points_fa": [
                "کلر ادرار کمتر از ۱۰ تا ۱۵ میلی‌اکی‌والان آلکالوز حساس به نرمال سالین (Saline-responsive) را اثبات می‌کند.",
                "افزایش نسبت BUN به کراتینین بالای ۲۰ نشانه آزوتمی پیش‌کلیوی است.",
                "اسید اوریک سرم به عنوان نشانگر غیرمستقیم افزایش بازجذب در توبول پروکسیمال بالا می‌رود.",
                "درمان انتخابی تزریق وریدی سرم نرمال سالین (0.9% NaCl) همراه با کلرید پتاسیم است."
            ],
            "points_en": [
                "Urine chloride <10-15 mEq/L definitively classifies the condition as saline-responsive metabolic alkalosis.",
                "A BUN/creatinine ratio >20:1 reflects augmented proximal tubular urea reabsorption secondary to prerenal hypoperfusion.",
                "Serum uric acid rises during volume contraction due to coupled proximal tubular urate reabsorption.",
                "Resuscitation mandates intravenous volume expansion utilizing isotonic saline with potassium chloride supplementation."
            ]
        }
    },
    15: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: سیترات بالای ادرار مهارکننده کریستالیزاسیون کلسیم است و یک فاکتور محافظت‌کننده در برابر سنگ است نه ریسک‌فاکتور.",
            "نادرست است؛ دلیل رد: مصرف بالای پتاسیم در رژیم غذایی موجب افزایش دفع سیترات در ادرار شده و از تولید سنگ پیشگیری می‌کند.",
            "نادرست است؛ دلیل رد: رژیم کم‌سدیم بازجذب کلسیم را در توبول پروکسیمال بالا برده و دفع ادراری کلسیم را کم می‌کند و محافظت‌کننده است.",
            "صحیح است؛ «کاهش حجم ادرار (Low Urinary Volume به میزان کمتر از ۱ تا ۱/۵ لیتر در روز ناشی از دهیدراتاسیون مزمن یا مصرف ناکافی مایعات)» مهم‌ترین، شایع‌ترین و قوی‌ترین ریسک‌فاکتور فیزیکوشیمیایی در تولید انواع سنگ‌های ادراری به ویژه «سنگ‌های کلیوی کلسیمی (اگزالات کلسیم و فسفات کلسیم)» است؛ زیرا کاهش حجم آب ادرار موجب اشباع مفرط (Supersaturation) یون‌های کلسیم و اگزالات و رسوب آن‌ها می‌گردد."
        ],
        "exp": "کاهش حجم ادرار (دهیدراتاسیون) شایع‌ترین و مهم‌ترین ریسک‌فاکتور فیزیکوشیمیایی در تشکیل سنگ‌های کلسیمی کلیه است.",
        "micro": {
            "lead_fa": "پاتوژنز تشکیل سنگ‌های کلسیمی کلیه (۸۰ درصد کل سنگ‌ها) وابسته به پدیده فرااشباع (Supersaturation) املاح در ادرار است. شایع‌ترین ناهنجاری فیزیکوشیمیایی در مبتلایان به سنگ، حجم پایین ادرار (کمتر از ۱ تا ۲ لیتر در روز) به علت عدم مصرف کافی آب یا تعریق است که غلظت کلسیم و اگزالات را به بالای نقطه تبلور می‌رساند. سایر فاکتورها شامل هایپرکلسیوری، هایپراوگزالوری و هایپوسیتراتوری هستند. سیترات قوی‌ترین مهارکننده طبیعی تبلور است.",
            "lead_en": "Pathogenesis of calcium nephrolithiasis (calcium oxalate and calcium phosphate) hinges fundamentally upon thermodynamic urinary supersaturation. Low urinary volume (<1-1.5 L/day driven by inadequate fluid intake or excess perspiration) is the single most common and powerful modifiable physical risk factor promoting crystal nucleation. High urinary volume and urinary citrate conversely prevent crystallization.",
            "golden_fa": "مهم‌ترین و شایع‌ترین ریسک‌فاکتور ایجاد سنگ کلیه کلسیمی = حجم کم ادرار (Low urinary volume ناشی از کم‌آبی).",
            "golden_en": "Foremost modifiable risk factor driving calcium nephrolithiasis = low urinary volume secondary to dehydration.",
            "points_fa": [
                "توصیه به نوشیدن آب کافی جهت دستیابی به حجم ادرار روزانه حداقل ۲ تا ۲/۵ لیتر سنگ‌بنای پیشگیری است.",
                "سیترات ادرار با اتصال به کلسیم محلول مانع از تشکیل کریستال‌های اگزالات کلسیم می‌شود.",
                "رژیم پرنمک (سدیم بالا) دفع کلسیم در ادرار را به شدت بالا برده و ریسک سنگ را زیاد می‌کند.",
                "دیورتیک‌های تیازیدی با کاهش دفع کلسیم ادرار در پیشگیری از سنگ‌های کلسیمی عودکننده کاربرد دارند."
            ],
            "points_en": [
                "Diluting urine to maintain a 24-hour output exceeding 2.0-2.5 liters is the single most effective preventive directive.",
                "Urinary citrate binds free ionized calcium, forming soluble complexes that blunt crystal agglomeration.",
                "High dietary sodium intake drives obligatory proximal calciuresis, sharply amplifying stone formation.",
                "Thiazide diuretics promote distal tubular calcium reabsorption, providing long-term stone prophylaxis in idiopathic hypercalciuria."
            ]
        }
    },
    16: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: در معتادان تزریقی اندوکاردیت عمدتاً در دریچه تریکوسپید رخ می‌دهد و در یک‌سوم موارد سوفل سمع نمی‌شود و گزاره صحیح است.",
            "صحیح است (جمله‌ای که نادرست است)؛ در معتادان به مواد مخدر تزریقی (IVDU) مبتلا به اندوکاردیت عفونی دریچه تریکوسپید، شایع‌ترین میکروارگانیسم مسبب با فاصله زیاد «استافیلوکوک اورئوس (Staphylococcus aureus در بیش از ۶۰ تا ۷۰ درصد موارد)» است نه استرپتوکوک؛ باکتری استافیلوکوک اورئوس از فلور پوستی محل تزریق وارد وریدها شده و دریچه تریکوسپید سالم را تخریب می‌کند؛ بنابراین گزاره «شایع‌ترین مسبب استرپتوکوک است» کاملاً غلط و نادرست می‌باشد.",
            "نادرست است؛ دلیل رد: آمبولی‌های سپتیک کنده شده از تریکوسپید به ریه رفته و پنومونی نکروزان، آبسه ریه و انفارکتوس ریوی می‌دهند و گزاره صحیح است.",
            "نادرست است؛ دلیل رد: باکتری پسودوموناس آئروژینوزا در معتادان تزریقی تهاجم شدیدی داشته و پروگنوز بسیار ضعیفی با نیاز به جراحی دارد و گزاره درست است."
        ],
        "exp": "در معتادان تزریقی، شایع‌ترین ارگانیسم اندوکاردیت تریکوسپید، استافیلوکوک اورئوس (>۶۰-۷۰٪) است نه استرپتوکوک.",
        "micro": {
            "lead_fa": "اندوکاردیت عفونی سمت راست (دریچه تریکوسپید) مشخصه افراد مصرف‌کننده مواد مخدر تزریقی (IVDU) است. پاتوژن اصلی استافیلوکوک اورئوس (MSSA یا MRSA) است که بیش از ۷۰ درصد موارد را شامل می‌شود؛ در حالی که استرپتوکوک‌ها مسبب اندوکاردیت سمت چپ در دریچه‌های از قبل آسیب‌دیده هستند. تظاهر بالینی غالباً با علائم ریوی ناشی از پرتاب آمبولی‌های سپتیک به ریه (سرفه، درد پلوریتیک سینه، انفارکتوس‌های کاویتاری ریه) مشخص می‌شود و سوفل تریکوسپید ممکن است ملایم باشد.",
            "lead_en": "Infective endocarditis in intravenous drug users characteristically targets the tricuspid valve. Staphylococcus aureus is the undisputed predominant causative pathogen (>60-70%), introduced directly from cutaneous flora via unsterile needles; oral streptococci are distinctly less common. Right-sided vegetations classically break off as septic pulmonary emboli, presenting as cavitary pulmonary infiltrates.",
            "golden_fa": "اندوکاردیت در معتاد تزریقی (دریچه تریکوسپید): شایع‌ترین عامل = استافیلوکوک اورئوس (نه استرپتوکوک).",
            "golden_en": "Endocarditis in IV drug users (tricuspid valve): predominant pathogen = Staphylococcus aureus (not streptococci).",
            "points_fa": [
                "گره‌های اسلر (Osler nodes) پتشی‌های دردناک پالپ انگشتان ناشی از کمپلکس‌های ایمنی هستند.",
                "درمان تجربی خط اول در معتادان تزریقی شامل ونکومایسین وریدی به علاوه پوشش پسودوموناس (سفپیم) است.",
                "اکوکاردیوگرافی از راه مری (TEE) حساسیت بالای ۹۰ تا ۹۵ درصد در مشاهده وژتاسیون‌های تریکوسپید دارد.",
                "سودوموناس آئروژینوزا و کاندیدا از عوامل با مرگ‌ومیر فوق‌العاده بالا در این گروه هستند."
            ],
            "points_en": [
                "Osler nodes represent tender, erythematous violaceous micro-nodules on digital pads mediated by immune complexes.",
                "Empiric intravenous antimicrobial therapy must combine vancomycin with antipseudomonal coverage (cefepime).",
                "Transesophageal echocardiography (TEE) demonstrates exceptional sensitivity (>95%) visualizing mobile tricuspid vegetations.",
                "Pseudomonas aeruginosa and fungal Candida endocarditis carry ominous prognoses, frequently demanding surgical intervention."
            ]
        }
    },
    17: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: سکته مغزی ایسکمیک بیش از ۳ ماه قبل کنترااندیکاسیون نسبی است نه قطعی.",
            "نادرست است؛ دلیل رد: مصرف وارفارین یا داروهای ضدانعقاد خوراکی کنترااندیکاسیون نسبی است.",
            "نادرست است؛ دلیل رد: جراحی عمده بیش از ۳ هفته قبل (یک ماه قبل) کنترااندیکاسیون نسبی است.",
            "صحیح است؛ در بیماری با درد حاد قفسه سینه یا شک به انفارکتوس، وجود «شک بالینی به دایسکشن آئورت (Suspected Aortic Dissection)» یک «کنترااندیکاسیون قطعی و مطلق (Absolute Contraindication)» برای تجویز داروهای فیبرینولیتیک و ترومبولیتیک (نظیر استرپتوکیناز، آلتپلاز یا تنکتپلاز) است؛ زیرا لیز لخته و مهار سیستم انعقادی در حضور پارگی دیواره آئورت، منجر به پارگی فاجعه‌بار آئورت به پریکارد یا پلور، تامپوناد حاد قلبی، خونریزی کشنده و مرگ فوری بیمار می‌گردد."
        ],
        "exp": "شک به دایسکشن حاد آئورت کنترااندیکاسیون قطعی و مطلق تجویز ترومبولیتیک‌ها است زیرا خطر مرگ فوری ناشی از پارگی آئورت دارد.",
        "micro": {
            "lead_fa": "تجویز داروهای ترومبولیتیک در STEMI نیازمند بررسی دقیق موارد منع مصرف است. کنترااندیکاسیون‌های مطلق (Absolute Contraindications) شامل: ۱) هرگونه سابقه خونریزی داخل مغزی (ICH)؛ ۲) سکته مغزی ایسکمیک در ۳ ماه اخیر؛ ۳) ضایعه ساختاری عروق مغزی (AVM) یا تومور بدخیم مغز؛ ۴) ترومای شدید اخیر سر یا صورت؛ ۵) شک به دیسکسیون آئورت؛ ۶) خونریزی فعال داخلی. دیسکسیون آئورت به دلیل خطر پارگی مرگبار به فضای پریکارد بالاترین اولویت رد بالینی را دارد.",
            "lead_en": "Fibrinolytic therapy in acute myocardial infarction requires rigorous contraindication screening. Absolute contraindications encompass any prior intracranial hemorrhage, ischemic stroke within 3 months, known intracranial structural vascular malformations/malignancy, recent significant closed head trauma, active internal bleeding, and suspected acute aortic dissection. Administering thrombolysis in aortic dissection provokes fatal hemopericardium.",
            "golden_fa": "کنترااندیکاسیون قطعی و مطلق ترومبولیتیک‌ها = شک به دایسکشن آئورت، سابقه خونریزی مغزی و تروما/سکته در ۳ ماه اخیر.",
            "golden_en": "Absolute contraindication to thrombolytics = suspected aortic dissection, prior intracranial hemorrhage, recent stroke.",
            "points_fa": [
                "دیسکسیون آئورت صعودی می‌تواند با درگیری سوراخ شریان کرونر راست نمای نوار قلب Inferior STEMI را تقلید کند.",
                "درد خنجری و تیرکشنده به پشت، اختلاف نبض یا فشار در دست‌ها و سوفل جدید نارسایی آئورت سرنخ‌های دیسکسیون هستند.",
                "سی‌تی آنژیوگرافی قفسه صدری روش انتخابی قطعی برای تأیید یا رد دیسکسیون آئورت است.",
                "در صورت شک به دایسکشن، انجام پرایمری PCI در کت‌لب به جای ترومبولیتیک نجات‌بخش است."
            ],
            "points_en": [
                "Ascending aortic dissection extending retrograde can occlude the right coronary ostium, masquerading as an inferior STEMI.",
                "Tearing back pain, upper-extremity blood pressure asymmetry (>20 mmHg), and a new diastolic murmur signal dissection.",
                "Contrast-enhanced helical thoracic CT angiography is the diagnostic investigation of choice confirming aortic dissection.",
                "Suspected aortic pathology demands withholding thrombolysis and transferring emergently for catheterization or CT imaging."
            ]
        }
    },
    18: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: افت فشار خون و هیپوتنشن عضو کلاسیک تریاد بک در تامپوناد قلبی است.",
            "نادرست است؛ دلیل رد: افزایش شدید JVP و اتساع وریدهای ژوگولار گردن یافته محوری تریاد بک در تامپوناد است.",
            "صحیح است (یافته‌ای که در تامپوناد بسیار کمتر محتمل است)؛ در بیمار مبتلا به تامپوناد قلبی (Cardiac Tamponade)، به دلیل تجمع حاد مایع پریکارد، پرشدگی هر دو بطن راست و چپ به یک اندازه مسدود می‌شود و نارسایی حاد رو به عقب بطن چپ با احتقان آلوئولی رخ نمی‌دهد؛ بنابراین «سمع رال‌های ریوی (Pulmonary Rales / Crackles) وجود ندارد و ریه‌ها در سمع کاملاً پاک (Clear Lung Fields)» هستند؛ وجود رال‌های ریوی مطرح‌کننده ادم ریه و نارسایی بطن چپ است نه تامپوناد ساده.",
            "نادرست است؛ دلیل رد: کاهش شدت و خفه بودن صداهای قلبی (Muffled Heart Sounds) سومین عضو تریاد بک در تامپوناد است."
        ],
        "exp": "در تامپوناد قلبی ریه‌ها در سمع کاملاً پاک (Clear) هستند و سمع رال در ریه‌ها دیده نمی‌شود و بسیار بعید است.",
        "micro": {
            "lead_fa": "تامپوناد قلبی یک اختلال پرشدگی حاد دیاستولی کل قلب است. سه نشانه بالینی شاخص تریاد بک (Beck's triad) عبارتند از: ۱) هیپوتنشن شریانی به علت افت حجم ضربه‌ای؛ ۲) اتساع و برجستگی شدید وریدهای گردن (JVP بالا با افت موج y)؛ ۳) صداهای قلبی خفه و دوردست (Muffled heart sounds). یک نکته معاینه‌ای حیاتی: ریه‌ها در سمع کاملاً تمیز و بدون رال هستند؛ زیرا برون‌ده بطن راست افت کرده و خون کافی برای ایجاد احتقان مویرگی ریه پمپ نمی‌شود.",
            "lead_en": "Cardiac tamponade impairs biventricular diastolic filling under pericardial pressure. The classic physical presentation centers on Beck's triad (hypotension, elevated jugular venous distention, and muffled heart sounds) coupled with pulsus paradoxus. Because right ventricular forward output is mechanically throttled, pulmonary capillary wedge pressure does not exceed hydrostatic thresholds; breath sounds are clear, making pulmonary rales remarkably absent.",
            "golden_fa": "در تامپوناد قلبی: تریاد بک (افت فشار، JVP بالا، صدای خفه قلب)؛ ریه‌ها کاملاً پاک هستند و رال شنیده نمی‌شود.",
            "golden_en": "Cardiac tamponade features Beck's triad alongside clear lungs; pulmonary rales are distinctly absent.",
            "points_fa": [
                "وجود رال ریوی و تنگی نفس حاد با احتقان به نفع انفارکتوس بطن چپ یا میوکاردیت حاد است نه تامپوناد.",
                "نبض متناقض (Pulsus paradoxus افت فشار سیستولی > ۱۰ در دم) علامت فیزیولوژیک کلیدی تامپوناد است.",
                "اکوکاردیوگرافی فوری استاندارد طلایی کشف افیوژن و کلاپس حفرات راست قلب است.",
                "پریکاردیوسنتز اورژانسی با سوزن اقدام درمانی نجات‌بخش و فوری در تامپوناد است."
            ],
            "points_en": [
                "Prominent bilateral pulmonary crackles and alveolar edema favor acute left ventricular failure, arguing against pure tamponade.",
                "Pulsus paradoxus (inspiratory systolic blood pressure drop exceeding 10 mmHg) represents a cardinal physical sign.",
                "Emergency bedside echocardiography is the definitive diagnostic modality demonstrating right chamber diastolic collapse.",
                "Emergent needle pericardiocentesis decompresses intrapericardial hypertension, restoring systemic hemodynamics."
            ]
        }
    },
    19: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: پارگی عضله پاپیلری سوفل نارسایی حاد میترال در اپکس قلب با انتشار به آگزیلا و ادم ریوی برق‌آسا می‌دهد نه سوفل در LLSB با تریل.",
            "نادرست است؛ دلیل رد: پارگی دیواره آزاد بطن چپ با هموپری‌کارد، تامپوناد کشنده و ایست قلبی با PEA تظاهر می‌یابد و سوفل هولوسیستولیک خشن ندارد.",
            "نادرست است؛ دلیل رد: پارگی دیواره بطن راست سوفل خشن همراه با تریل لرزاننده در LLSB ایجاد نمی‌کند.",
            "صحیح است؛ بروز تنگی نفس حاد، ناپایداری و سمع «یک سوفل هولوسیستولیک خشن و بلند همراه با تریل لمسی در قسمت تحتانی کناره چپ استرنوم (Lower Left Sternal Border / LLSB)» حدود ۲۴ ساعت تا چند روز پس از یک انفارکتوس میوکارد دیواره تحتانی (Inferior STEMI)، تابلوی پاتوگنومونیک و کلاسیک «پارگی سپتوم بین‌بطنی (Ventricular Septal Rupture / VSR)» ناشی از نکروز ایسکمیک سپتوم بین بطنی است که نیازمند اکو و ترمیم جراحی فوری است."
        ],
        "exp": "سوفل هولوسیستولیک خشن در LLSB همراه با تریل پس از سکته قلبی، نشانه پارگی سپتوم بین‌بطنی (VSR) است.",
        "micro": {
            "lead_fa": "پارگی سپتوم بین‌بطنی (VSR) یک عارضه مکانیکی فاجعه‌بار انفارکتوس میوکارد (STEMI قدامی یا تحتانی) است که معمولاً در روزهای اول (۲۴ ساعت تا ۵ روز پس از MI) رخ می‌دهد. مشخصه بارز بالینی در معاینه سمع یک سوفل هولوسیستولیک خشن و بسیار بلند در کناره چپ استرنوم (LLSB) است که در نیمی از بیماران با تریل لمسی (Systolic thrill) همراه است. شانت چپ به راست حاد منجر به شوک کاردیوژنیک و نارسایی احتقانی حاد می‌شود. اکوکاردیوگرافی با کالر داپلر فوراً پارگی را نشان می‌دهد.",
            "lead_en": "Ventricular septal rupture (VSR) is a lethal mechanical complication of STEMI occurring within 1 to 5 days post-infarction, mediated by transmural coagulation necrosis. Physical examination reveals an explosive, harsh holosystolic murmur maximal at the lower left sternal border, accompanied in >50% by a palpable thrill. Color Doppler echocardiography definitively establishes the interventricular shunt.",
            "golden_fa": "سوفل هولوسیستولیک خشن در کناره تحتانی-چپ استرنوم (LLSB) با تریل پس از MI = پارگی سپتوم بین‌بطنی (VSR).",
            "golden_en": "Harsh holosystolic murmur at lower left sternal border with thrill post-MI = ventricular septal rupture (VSR).",
            "points_fa": [
                "افتراق از نارسایی حاد میترال: سوفل VSR در LLSB با تریل است؛ سوفل MR در اپکس با انتشار به آگزیلا و معمولاً بدون تریل است.",
                "پمپ بادکنکی داخل آئورت (IABP) با کاهش افترلود شانت چپ به راست را کم کرده و وضعیت بیمار را پایدار می‌سازد.",
                "اکوکاردیوگرافی داپلر جریان شانت پرسرعت بین‌بطنی را اثبات می‌نماید.",
                "درمان قطعی جراحی باز قلب جهت ترمیم و پچ کردن نقص سپتوم بین‌بطنی است."
            ],
            "points_en": [
                "Differentiating papillary muscle rupture: MR murmur radiates to the axilla without a thrill; VSR murmur peaks at LLSB with a thrill.",
                "Intra-aortic balloon pump (IABP) counterpulsation provides critical hemodynamic stabilization by afterload reduction.",
                "Transthoracic color flow Doppler echocardiography visualizes left-to-right trans-septal high-velocity jetting.",
                "Definitive management requires emergent or urgent cardiac surgical patch repair and coronary revascularization."
            ]
        }
    },
    20: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: نارسایی مزمن دریچه میترال (MR) الگوی کلاسیک سوفل پان‌سیستولیک با انتشار به زیر بغل است.",
            "نادرست است؛ دلیل رد: نارسایی مزمن دریچه تریکوسپید (TR) سوفل پان‌سیستولیک با تشدید در دم (علامت کاروالو) دارد.",
            "نادرست است؛ دلیل رد: نقص دیواره بین‌بطنی (VSD) سوفل پان‌سیستولیک خشن در کناره تحتانی استرنوم دارد.",
            "صحیح است (بیماری‌ای که سوفل پان‌سیستولیک ندارد)؛ در بیماری «نقص دیواره بین‌دهلیزی (Atrial Septal Defect / ASD)»، جریان شانت خون از دهلیز چپ به راست در سپتوم دهلیزی به دلیل گرادیان فشار ناچیز هیچ‌گونه سوفلی تولید نمی‌کند؛ سوفلی که در ASD شنیده می‌شود ناشی از افزایش حجم خون عبوری از دریچه پولمونر است که یک «سوفل میدسیستولی جهشی (Ejection Midsystolic Murmur در فضای دوم چپ)» به همراه «شکاف ثابت و پهن صدای دوم (Fixed Split S2)» ایجاد می‌نماید نه سوفل پان‌سیستولیک."
        ],
        "exp": "در نقص دیواره بین‌دهلیزی (ASD) سوفل میدسیستولی جهشی پولمونر و S2 با شکاف ثابت شنیده می‌شود نه سوفل پان‌سیستولیک.",
        "micro": {
            "lead_fa": "سوفل‌های پان‌سیستولیک (هولوسیستولیک) از شروع صدای اول (S1) آغاز شده و تا بعد از صدای دوم (S2) ادامه دارند و ناشی از جریان خون از حفره‌ای با فشار بالا به حفره‌ای با فشار پایین هستند؛ سه علت کلاسیک: ۱) نارسایی میترال (MR)؛ ۲) نارسایی تریکوسپید (TR)؛ ۳) نقص دیواره بین‌بطنی (VSD). در نقطه مقابل، در ASD شانت بین‌دهلیزی فاقد سوفل است و سوفل سمع‌شده ناشی از جریان مازاد از دریچه نرمال پولمونر است که یک سوفل میدسیستولی جهشی همراه با Fixed Split S2 تولید می‌کند.",
            "lead_en": "Holosystolic (pansystolic) murmurs extend uniformly from S1 through S2, characteristic of high-to-low pressure ventricular ejection chambers: mitral regurgitation, tricuspid regurgitation, and ventricular septal defect (VSD). In atrial septal defect (ASD), low interatrial pressure gradients generate no audible shunt murmur; instead, flow across the pulmonary valve yields a midsystolic ejection murmur alongside a fixed, widely split S2.",
            "golden_fa": "سوفل پان‌سیستولیک در MR، TR و VSD شنیده می‌شود؛ در ASD سوفل میدسیستولی جهشی با Fixed Split S2 شنیده می‌شود.",
            "golden_en": "Pansystolic murmurs occur in MR, TR, and VSD; ASD features a midsystolic ejection murmur and fixed split S2.",
            "points_fa": [
                "شکاف ثابت و پهن صدای دوم قلب (Fixed Wide Splitting of S2) علامت سمعی پاتوگنومونیک ASD است.",
                "سوفل نارسایی تریکوسپید با دم تشدید می‌شود (علامت Carvallo).",
                "سوفل نارسایی میترال در اپکس با انتشار به آگزیلا شنیده می‌شود.",
                "سوفل VSD خشن‌ترین سوفل پان‌سیستولیک بوده و اغلب با تریل لمسی همراه است."
            ],
            "points_en": [
                "Fixed, wide splitting of the second heart sound (S2) without respiratory variation is the clinical signature of ASD.",
                "Carvallo's sign (inspiratory augmentation of murmur intensity) uniquely characterizes tricuspid regurgitation.",
                "Mitral regurgitation produces an apical holosystolic murmur radiating into the left axilla.",
                "Ventricular septal defect generates a harsh holosystolic murmur at the left sternal border frequently accompanied by a thrill."
            ]
        }
    },
    21: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: آملودیپین (کلسیم چنل بلوکر) بهترین و مؤثرترین داروی ترکیبی با لوزارتان است.",
            "صحیح است (دارویی که اضافه کردن آن توصیه نمی‌شود و ممنوع است)؛ در بیماری که تحت درمان با یک مسدودکننده گیرنده آنژیوتانسین نظیر لوزارتان (ARB) قرار دارد، اضافه کردن همزمان یک داروی مهارکننده آنزیم تبدیل‌کننده آنژیوتانسین نظیر «کاپتوپریل (ACEI)» طبق تمام مطالعات بالینی بزرگ (نظیر ONTARGET) و راهنماهای معتبر فشار خون «مطلقاً ممنوع و غیرتوصیه (Contraindicated)» است؛ زیرا مهار دوگانه محور رنین-آنژیوتانسین (Dual RAAS Blockade) مورتالیتی قلبی را کاهش نمی‌دهد اما خطرات فاجعه‌بار نارسایی حاد کلیه، هایپرکالمی شدید و سنکوپ را چند برابر می‌سازد.",
            "نادرست است؛ دلیل رد: هیدروکلروتیازید دیورتیکی با اثر هم‌افزا با لوزارتان است و ترکیب استاندارد فشار خون است.",
            "نادرست است؛ دلیل رد: کارودیلول در صورت لزوم داروی مجاز است گرچه خط اول نیست."
        ],
        "exp": "ترکیب همزمان ARB (لوزارتان) با ACEI (کاپتوپریل) به دلیل خطرات نارسایی حاد کلیه و هایپرکالمی اکیداً ممنوع است.",
        "micro": {
            "lead_fa": "یک قانون اساسی در فارماکولوژی قلب و فشار خون: مهار همزمان دوگانه محور رنین-آنژیوتانسین-آلدوسترون (Dual RAAS Blockade) یعنی تجویز همزمان مهارکننده ACE (کاپتوپریل، انالاپریل) به همراه آنتاگونیست ARB (لوزارتان، والزارتان) به طور مطلق در تمام راهنماهای جهانی (AHA، ESC، KDIGO) ممنوع اعلام شده است. مطالعات کارآزمایی بالینی ثابت کرده‌اند که این ترکیب هیچ اثری در کنترل بهتر فشار خون یا بقا ندارد اما عوارض نارسایی حاد کلیه، هایپرکالمی کشنده و سنکوپ را به شدت بالا می‌برد.",
            "lead_en": "Dual blockade of the renin-angiotensin-aldosterone system via concurrent administration of an ACE inhibitor (captopril) alongside an ARB (losartan) is unequivocally contraindicated across all major guidelines (ACC/AHA, ESC, KDIGO). Seminal randomized clinical trials (ONTARGET) conclusively demonstrated that dual RAAS inhibition yields zero additive cardiovascular protection while significantly multiplying acute renal failure and hyperkalemia.",
            "golden_fa": "تجویز همزمان لوزارتان (ARB) با کاپتوپریل (ACEI) ممنوعیت مطلق دارد؛ ترکیب صحیح: افزودن آملودیپین یا تیازید.",
            "golden_en": "Co-prescribing losartan (ARB) with captopril (ACEI) is strictly contraindicated; correct add-on is amlodipine or thiazide.",
            "points_fa": [
                "ترکیب استاندارد و طلایی فشار خون شامل ARB به علاوه کلسیم بلوکر دی‌هیدروپیریدینی (آملودیپین) است.",
                "ترکیب ARB با دیورتیک تیازیدی (هیدروکلروتیازید) احتباس نمک را برطرف کرده و هم‌افزایی دارد.",
                "مهار دوگانه RAAS ریسک هیپرکالمی را به ویژه در بیماران دیابتی یا مسن به شدت تشدید می‌کند.",
                "در صورت عدم کنترل با سه داروی خط اول، داروی خط چهارم اسپیرونولاکتون خواهد بود."
            ],
            "points_en": [
                "Preferred first-line dual combination pairs an ARB with a dihydropyridine calcium channel blocker (amlodipine).",
                "Combining an ARB with a thiazide diuretic promotes natriuretic synergism while blunting hypokalemic tendencies.",
                "Dual RAAS blockade severely compromises glomerular efferent arteriolar tone, triggering acute drop in filtration.",
                "Spironolactone represents the guideline-directed fourth-line agent of choice for true resistant hypertension."
            ]
        }
    },
    22: {
        "ci": 0,
        "whys": [
            "صحیح است؛ تست چالش برونکواسپاسم با متاکولین (Methacholine Challenge Test / Bronchoprovocation) دارای «حساسیت و ارزش اخباری منفی فوق‌العاده بالا (Negative Predictive Value نزدیک به ۱۰۰٪)» در ارزیابی آسم برونش است؛ بنابراین «منفی بودن تست تحریکی متاکولین (Negative Methacholine Test)»، با اطمینان تقریباً قطعی تشخیص بیماری آسم را در این بیمار رد می‌نماید.",
            "نادرست است؛ دلیل رد: اسپیرومتری نرمال در فواصل بین حملات در اکثریت مطلق مبتلایان به آسم دیده می‌شود و آسم را رد نمی‌کند.",
            "نادرست است؛ دلیل رد: رادیوگرافی قفسه سینه در آسم بدون عارضه در بیش از ۹۰ درصد بیماران کاملاً نرمال است.",
            "نادرست است؛ دلیل رد: سی‌تی‌اسکن نرمال نیز قادر به رد بیماری آسم نیست."
        ],
        "exp": "تست تحریکی متاکولین منفی به علت حساسیت و ارزش اخباری منفی نزدیک به ۱۰۰٪، تشخیص آسم را به طور قطعی رد می‌کند.",
        "micro": {
            "lead_fa": "در ارزیابی بیماران مشکوک به آسم که اسپیرومتری اولیه آن‌ها در حالت استراحت طبیعی است، تست چالش یا تحریکی برونش با متاکولین (Methacholine challenge test) ابزار تشخیصی استاندارد است. این تست هایپرری‌اکتیویتی مجاری هوایی را می‌سنجد. به دلیل حساسیت استثنایی بالای ۹۵ تا ۹۸ درصد، تست متاکولین ارزش اخباری منفی بسیار بالایی دارد؛ به این معنی که اگر تست متاکولین در فردی منفی شود (غلظت PC20 بالاتر از ۱۶ میلی‌گرم در میلی‌لیتر باشد)، تشخیص آسم با اطمینان رد می‌گردد.",
            "lead_en": "The methacholine bronchoprovocation challenge test measures dynamic airway hyperresponsiveness, indicated when baseline spirometry is normal despite asthma symptoms. Because of its near-perfect sensitivity (95-100%) and extraordinarily high negative predictive value, a negative methacholine test virtually excludes active asthma from the differential diagnosis. Normal baseline spirometry or chest imaging cannot exclude asthma.",
            "golden_fa": "منفی بودن تست تحریکی متاکولین با ارزش اخباری منفی ۱۰۰٪، تشخیص آسم را به طور قطعی رد می‌کند.",
            "golden_en": "A negative methacholine challenge test virtually excludes asthma owing to its extraordinarily high negative predictive value.",
            "points_fa": [
                "تست مثبت با افت بیش از ۲۰ درصدی FEV1 با دوزهای تحریکی متاکولین (PC20 < 8-16 mg/mL) تعریف می‌شود.",
                "اسپیرومتری در بیش از ۷۰ درصد بیماران مبتلا به آسم در فواصل بدون علامت کاملاً طبیعی است.",
                "عکس قفسه سینه در آسم فقط برای رد سایر علل نظیر پنوموتوراکس یا توده اندیکاسیون دارد.",
                "برگشت‌پذیری با برونکودیلاتور (افزایش FEV1 به میزان بیش از ۱۲٪ و ۲۰۰ میلی‌لیتر) تست تأییدی در اسپیرومتری غیرطبیعی است."
            ],
            "points_en": [
                "A positive challenge is defined by a ≥20% decrease in FEV1 provoked by provocative methacholine concentrations (PC20).",
                "Baseline resting spirometry is completely normal between acute bronchospastic paroxysms in >70% of asthmatics.",
                "Chest radiography in uncomplicated bronchial asthma is characteristically normal, serving solely to exclude competing mimics.",
                "Bronchodilator reversibility (FEV1 improving by >12% and >200 mL post-SABA) confirms airflow reversibility."
            ]
        }
    },
    23: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: رادیوگرافی ساده قفسه سینه اولین، سریع‌ترین و ضروری‌ترین اقدام در ارزیابی هموپتزی است.",
            "نادرست است؛ دلیل رد: بررسی تست‌های انعقادی (PT, PTT, INR) برای رد کوآگولوپاتی زمینه‌ای در هموپتزی الزامی است.",
            "نادرست است؛ دلیل رد: آزمایش CBC (برای آنمی و پلاکت) و U/A (برای بررسی هماچوری و سندرم‌های ریوی-کلیوی) اقدام پایه‌ای است.",
            "صحیح است (اقدامی که در ارزیابی اولیه سرپایی انجام نمی‌شود)؛ در یک بیمار با خلط خونی اندک در حد رگه (Mild Hemoptysis) با وضعیت همودینامیک کاملاً پایدار، «انجام فوری برونکوسکوپی» جزء ارزیابی‌های اولیه و خط اول محسوب نمی‌شود؛ ارزیابی اولیه شامل عکس قفسه سینه، آزمایش‌های خونی و سی‌تی‌اسکن با وضوح بالا است و برونکوسکوپی تنها در صورت غیرطبیعی بودن گرافی، عدم بهبودی یا شک بالا به توده پس از سی‌تی‌اسکن اندیکاسیون پیدا می‌کند."
        ],
        "exp": "در هموپتزی خفیف پایدار، ارزیابی اولیه شامل گرافی، آزمایشات و سی‌تی است؛ برونکوسکوپی فوری جزء ارزیابی اولیه نیست.",
        "micro": {
            "lead_fa": "در رویکرد بالینی به هموپتزی خفیف و پایدار (رگه‌های خونی در خلط)، اقدامات اولیه و گام اول عبارتند از: ۱) رادیوگرافی ساده قفسه سینه (CXR)؛ ۲) آزمایش‌های روتین شامل CBC با پلاکت، تست‌های انعقادی و آنالیز ادرار (جهت رد گلومرولونفریت و واسکولیت)؛ ۳) سی‌تی‌اسکن اسپیرال قفسه صدری. انجام برونکوسکوپی تهاجمی بوده و در مرحله اولیه الزامی نیست، بلکه به عنوان اقدام تکمیلی در صورت کشف توده، مشکوک بودن سی‌تی یا هموپتزی راجعه انجام می‌شود.",
            "lead_en": "Diagnostic evaluation of mild, non-massive hemoptysis (blood-streaked sputum) in a hemodynamically stable patient fundamentally initiates with non-invasive baseline studies: upright chest radiography, coagulation profiling, CBC/platelet count, and urinalysis (screening for pulmonary-renal syndromes). Invasive flexible bronchoscopy is not an immediate initial-tier test, deferred pending high-resolution chest CT results.",
            "golden_fa": "ارزیابی اولیه هموپتزی پایدار: گرافی سینه، آزمایش انعقادی و CBC؛ برونکوسکوپی جزء اقدامات اولیه فوری نیست.",
            "golden_en": "Initial workup of stable hemoptysis: chest X-ray, coag profile, and CBC/UA; bronchoscopy is not an immediate first step.",
            "points_fa": [
                "سی‌تی‌اسکن قفسه صدری با کنتراست حساسیت بالاتری نسبت به برونکوسکوپی در کشف برونشکتازی و تومورهای محیطی دارد.",
                "در هموپتزی وسیع و ماسیو (بیش از ۱۰۰ تا ۵۰۰ میلی‌لیتر در ۲۴ ساعت) برونکوسکوپی اورژانس در ICU اندیکاسیون می‌یابد.",
                "شایع‌ترین علل رگه خونی در خلط برونشیت حاد، برونشکتازی و عفونت‌های تنفسی هستند.",
                "آنالیز ادرار با کشف گلبول قرمز کست‌دار سندرم گودپاسچر و گرانولوماتوز با پلی‌آنژئیت را آشکار می‌سازد."
            ],
            "points_en": [
                "Contrast-enhanced multidetector chest CT demonstrates superior diagnostic yield over bronchoscopy for peripheral lesions and bronchiectasis.",
                "Massive life-threatening hemoptysis (>300-600 mL/day) conversely warrants emergent rigid/flexible bronchoscopy.",
                "The most prevalent clinical etiologies of blood-streaked sputum are acute bronchitis, bronchiectasis, and bronchogenic carcinoma.",
                "Urinalysis with microscopic examination is critical to exclude concurrent glomerulonephritis in ANCA vasculitis or anti-GBM disease."
            ]
        }
    },
    24: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: آزمایش D-dimer زمانی به کار می‌رود که احتمال بالینی DVT پایین باشد و برای رد کردن استفاده شود نه اثبات در فرد علامت‌دار.",
            "صحیح است؛ در یک بیمار با تابلوی تورم، درد و عدم تقارن سایز ساق پا (بیش از ۲ سانتی‌متر) با شک بالینی به ترومبوز وریدهای عمقی (DVT)، روش تشخیصی انتخابی، قطعی و استاندارد طلایی خط اول «سونوگرافی داپلر فشاری عروق وریدی اندام تحتانی (Compression Venous Duplex Ultrasonography)» است که با بررسی عدم فشردگی وریدها و فقدان جریان خون لخته را با دقت بالای ۹۵ تا ۹۸ درصد اثبات می‌نماید.",
            "نادرست است؛ دلیل رد: سی‌تی آنژیوگرافی عروق ریه برای تشخیص آمبولی ریه (PE) است و تست خط اول ارزیابی تورم ساق پا نیست.",
            "نادرست است؛ دلیل رد: اکوکاردیوگرافی حفرات قلب را ارزیابی می‌کند و روش تشخیصی برای اثبات DVT اندام تحتانی نیست."
        ],
        "exp": "سونوگرافی داپلر فشاری عروق وریدی اندام تحتانی، روش تشخیصی استاندارد و انتخابی اول در بررسی و اثبات DVT است.",
        "micro": {
            "lead_fa": "ترومبوز ورید عمقی اندام تحتانی (DVT) یکی از شایع‌ترین اورژانس‌های عروقی است. در ارزیابی بالینی با معیارهای ولز (Wells score)، وجود تورم موضعی اندام با اختلاف قطر بیش از ۲ تا ۳ سانتی‌متر نسبت به پای مقابل شک قوی ایجاد می‌کند. روش تصویربرداری استاندارد طلایی خط اول سونوگرافی داپلر عروق وریدی همراه با مانور فشاری (CUS) است؛ عدم کلاپس ورید تحت فشار پروب سونوگرافی، وجود ترومبوز را با حساسیت و ویژگی بالای ۹۵ درصد به اثبات می‌رساند.",
            "lead_en": "Diagnostic evaluation of suspected lower-extremity deep vein thrombosis (DVT) utilizes the clinical Wells criteria. In a patient with symptomatic asymmetrical calf swelling (>2-3 cm disparity), compression venous duplex ultrasonography (CUS) is the undisputed imaging procedure of choice. Inability to compress the venous lumen under direct ultrasound probe pressure unequivocally verifies endoluminal thrombosis.",
            "golden_fa": "تورم و درد نامتقارن ساق پا = شک به DVT؛ اقدام تشخیصی انتخابی: سونوگرافی داپلر فشاری وریدهای اندام تحتانی.",
            "golden_en": "Unilateral calf pain and swelling = suspected DVT; diagnostic modality of choice: compression venous duplex ultrasonography.",
            "points_fa": [
                "معیار اصلی تشخیص در سونوگرافی ناتوانی در فشرده شدن ورید با فشار مستقیم پروب است.",
                "تست D-dimer به روش الایزا فقط برای رد DVT در بیماران با احتمال بالینی پایین کاربرد دارد.",
                "در صورت تأیید DVT پروگزیمال، شروع فوری درمان ضدانعقادی (DOACs یا LMWH) الزامی است.",
                "DVTهای پروگزیمال (وریدهای فمورال و پوپلیتئال) بیشترین خطر آمبولی ریوی کشنده را دارند."
            ],
            "points_en": [
                "The single most reliable sonographic diagnostic criterion is failure of complete venous luminal compressibility.",
                "High-sensitivity D-dimer testing serves strictly as a 'rule-out' tool in cohorts categorized as low clinical pretest probability.",
                "Verified proximal DVT mandates immediate therapeutic anticoagulation with direct oral anticoagulants (DOACs) or LMWH.",
                "Proximal vein thromboses (popliteal, femoral, iliac) carry the predominant hazard of fatal embolization to the pulmonary arteries."
            ]
        }
    },
    25: {
        "ci": 0,
        "whys": [
            "صحیح است؛ وجود تنگی نفس پیشرونده، سن بالای ۶۰ سال و سابقه مصرف سیگار، همراه با چماقی شدن انگشتان (کلابینگ)، سمع کراکل‌های ظریف دوفازیک (Fine Crackles / صدای باز شدن نوار چسب واکرو) در هر دو قاعده ریه، الگوی تحدیدی در اسپیرومتری و مشاهده «منظره هانی‌کامبینگ (Honeycombing / لانه‌زنبوری) در قاعده‌های ریه در HRCT» (معیارهای قطعی پترن پاتولوژیک UIP)، تابلوی کلاسیک و پاتوگنومونیک «فیبروز ریوی ایدیوپاتیک (Idiopathic Pulmonary Fibrosis / IPF)» است.",
            "نادرست است؛ دلیل رد: فیبروز فامیلیال زمانی اطلاق می‌شود که سابقه مثبت در حداقل دو عضو خانواده درجه یک وجود داشته باشد.",
            "نادرست است؛ دلیل رد: پنومونیت ناشی از افزایش حساسیت (HP) سابقه مواجهه شغلی با پرندگان/کپک داشته و در لوب‌های فوقانی غالب است.",
            "نادرست است؛ دلیل رد: سارکوئیدوز بیماری جوانان با درگیری غالب لوب‌های فوقانی و لنفادنوپاتی ناف ریه است و هانی‌کامبینگ قاعده‌ای نمی‌دهد."
        ],
        "exp": "کراکل‌های ظریف قاعده‌ای، کلابینگ و منظره هانی‌کامبینگ (UIP) در قاعده‌های ریه در HRCT، مشخصه قطعی IPF است.",
        "micro": {
            "lead_fa": "فیبروز ریوی ایدیوپاتیک (IPF) شایع‌ترین و کشنده‌ترین فرم بیماری‌های بینابینی ریه (ILD) با علت ناشناخته در افراد بالای ۶۰ سال و سیگاری است. علائم بالینی: تنگی نفس پیشرونده فعالیتی، سرفه خشک، چماقی شدن انگشتان (در بیش از ۵۰٪ موارد) و کراکل‌های ظریف بازدمی شبیه صدای باز شدن زیپ چسبی (Velcro crackles) در هر دو قاعده ریه. سی‌تی‌اسکن با وضوح بالا (HRCT) منظره قطعی UIP شامل شبکه‌بندی ساب‌پلورال با ترجیح قاعده‌ها، برونشکتازی کششی و کیست‌های لانه‌زنبوری (Honeycombing) را نشان می‌دهد.",
            "lead_en": "Idiopathic pulmonary fibrosis (IPF) is a progressive, fibrosing interstitial pneumonia afflicting older adult smokers. Hallmark physical signs include digital clubbing and bilateral basilar 'Velcro-like' inspiratory fine crackles. High-resolution chest CT (HRCT) establishing the definitive UIP pattern—subpleural, basilar-predominant reticulation, traction bronchiectasis, and macroscopic honeycombing cysts—secures the diagnosis without lung biopsy.",
            "golden_fa": "کراکل‌های ظریف قاعده‌ای + کلابینگ + منظره لانه‌زنبوری (Honeycombing) در قاعده‌ها = فیبروز ریوی ایدیوپاتیک (IPF).",
            "golden_en": "Basilar fine crackles + clubbing + subpleural honeycombing on HRCT = idiopathic pulmonary fibrosis (IPF).",
            "points_fa": [
                "در صورت وجود نمای قطعی UIP در HRCT در بستر بالینی مناسب، نیازی به انجام بیوپسی جراحی ریه نیست.",
                "داروهای ضدفیبروز نوین (پیرفنیدون و نینتدانیب) سرعت افت FVC را کند کرده و بیماری را مهار می‌کنند.",
                "پیوند ریه تنها درمان قطعی بقا در بیماران پیشرفته واجد شرایط است.",
                "اسپیرومتری الگوی تحدیدی با کاهش FVC و افت شدید ظرفیت انتشار گاز مونوکسید کربن (DLCO) را نشان می‌دهد."
            ],
            "points_en": [
                "A definitive UIP pattern on HRCT in the appropriate clinical setting precludes the necessity for surgical lung biopsy.",
                "Antifibrotic therapeutics (pirfenidone and nintedanib) significantly retard disease progression and annual FVC decline.",
                "Single or bilateral lung transplantation represents the sole definitive curative option for eligible advanced candidates.",
                "Pulmonary function testing confirms a restrictive physiological defect with disproportionately impaired DLCO."
            ]
        }
    },
    26: {
        "ci": 0,
        "whys": [
            "صحیح است؛ در بیماری انسدادی مزمن ریه (COPD)، پس از اثبات وجود انسداد ثابت راه‌های هوایی با نسبت FEV1/FVC کمتر از ۰/۷۰ پس از برونکودیلاتور، طبق طبقه‌بندی رسمی و جهانی ابتکار جهانی برای بیماری‌های انسدادی مزمن ریه (GOLD Guidelines)، شدت انسداد جریان هوا بر اساس «درصد حجم بازدمی پرفشار در ثانیه اول نسبت به مقدار پیش‌بینی‌شده (FEV1 % Predicted)» به چهار مرحله (GOLD 1 خفیف بالای ۸۰٪، GOLD 2 متوسط ۵۰ تا ۷۹٪، GOLD 3 شدید ۳۰ تا ۴۹٪ و GOLD 4 بسیار شدید زیر ۳۰٪) سنجیده و طبقه‌بندی می‌شود.",
            "نادرست است؛ دلیل رد: حجم باقیمانده (RV) حبس هوا را نشان می‌دهد اما شاخص رسمی تعیین شدت بیماری در راهنماهای GOLD نیست.",
            "نادرست است؛ دلیل رد: ظرفیت باقیمانده عملکردی (FRC) شاخص هیپراینفلیشن است و شدت انسداد را گریدبندی نمی‌کند.",
            "نادرست است؛ دلیل رد: ظرفیت تام ریوی (TLC) اتساع ریه را می‌سنجد اما معیار رتبه‌بندی انسداد COPD نیست."
        ],
        "exp": "در بیماری COPD، شدت انسداد مجاری هوایی طبق دستورالعمل GOLD منحصراً با میزان درصد FEV1 پیش‌بینی‌شده سنجیده می‌شود.",
        "micro": {
            "lead_fa": "طبق راهنمای بین‌المللی GOLD، تشخیص COPD مستلزم اثبات انسداد غیرقابل برگشت برونکودیلاتوری با نسبت FEV1/FVC کمتر از ۰/۷۰ در اسپیرومتری است. پس از تأیید تشخیص، شدت نقص انسدادی جریان هوا صرفاً بر اساس درصد FEV1 پیش‌بینی‌شده پس از مصرف برونکودیلاتور سنجیده و رتبه‌بندی می‌شود: ۱) خفیف (GOLD 1): FEV1 مساوی یا بالای ۸۰٪؛ ۲) متوسط (GOLD 2): FEV1 بین ۵۰ تا ۷۹٪؛ ۳) شدید (GOLD 3): FEV1 بین ۳۰ تا ۴۹٪؛ ۴) بسیار شدید (GOLD 4): FEV1 کمتر از ۳۰٪.",
            "lead_en": "Following spirometric confirmation of persistent airflow limitation (post-bronchodilator FEV1/FVC <0.70), the Global Initiative for Chronic Obstructive Lung Disease (GOLD) system stages the physiological severity of airflow obstruction exclusively based on post-bronchodilator FEV1 percentage of predicted value: GOLD 1 (≥80%), GOLD 2 (50-79%), GOLD 3 (30-49%), and GOLD 4 (<30%).",
            "golden_fa": "سنجش شدت انسداد راه هوایی در COPD طبق گایدلاین GOLD = میزان درصد FEV1 پیش‌بینی‌شده.",
            "golden_en": "Grading severity of airflow limitation in COPD under GOLD guidelines = post-bronchodilator FEV1 % predicted.",
            "points_fa": [
                "نسبت FEV1/FVC کمتر از ۰/۷۰ معیار ورود و اثبات وجود بیماری انسدادی در اسپیرومتری است.",
                "تعیین شدت بر اساس FEV1 در انتخاب دوز داروهای برونکودیلاتور طولانی‌اثر (LAMA/LABA) کمک‌کننده است.",
                "در مراحل بسیار شدید (GOLD 4 یا FEV1 زیر ۳۰٪) خطر نارسایی تنفسی و نیاز به اکسیژن‌درمانی به شدت بالا می‌رود.",
                "پارامترهای حجم باقیمانده (RV) پدیده حبس هوا (Air trapping) را می‌سنجند اما معیار درجه‌بندی شدت نیستند."
            ],
            "points_en": [
                "A post-bronchodilator FEV1/FVC ratio <0.70 is the definitive physiological hallmark establishing airflow limitation.",
                "Staging airflow severity via FEV1 guides risk stratification, disease monitoring, and therapeutic pharmacotherapy escalations.",
                "Very severe airflow obstruction (GOLD 4, FEV1 <30%) correlates with recurrent exacerbations, hypercapnia, and cor pulmonale.",
                "Residual volume (RV) and total lung capacity (TLC) quantify static hyperinflation, but do not dictate GOLD obstruction tiers."
            ]
        }
    },
    27: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: دیابت نوع یک به علت ژنتیک مشترک HLA-DQ2/DQ8 در ۵ تا ۱۰ درصد بیماران با سلیاک همراهی اثبات‌شده دارد.",
            "نادرست است؛ دلیل رد: بیماری‌های اتوایمیون تیروئید (هاشیموتو و گریوز) همراهی ژنتیکی و اپیدمیولوژیک بسیار قوی با سلیاک دارند.",
            "نادرست است؛ دلیل رد: درماتیت هرپتی‌فرم تظاهر پوستی مستقیم بیماری سلیاک است و در ۱۰۰ درصد موارد پاتولوژی روده باریک دارد.",
            "صحیح است (بیماری‌ای که همراهی ثابت‌شده با سلیاک ندارد)؛ بیماری «لوپوس اریتماتوی سیستمیک (SLE)» هیچ‌گونه همراهی ژنتیکی، آماری یا اپیدمیولوژیک ثابت‌شده و معناداری با بیماری سلیاک ندارد؛ بیماری‌های با همراهی ثابت‌شده و قطعی با سلیاک شامل: دیابت نوع یک، تیروئیدیت هاشیموتو، درماتیت هرپتی‌فرم، سندرم داون، سندرم ترنر، کمبود انتخابی IgA و هپاتیت اتوایمیون هستند."
        ],
        "exp": "سلیاک با دیابت نوع ۱، بیماری‌های تیروئید و درماتیت هرپتی‌فرم همراهی اثبات‌شده دارد اما با لوپوس (SLE) همراهی ندارد.",
        "micro": {
            "lead_fa": "بیماری سلیاک یک آنتروپاتی خودایمن حساس به گلوتن با زمینه ژنتیکی قوی (آلل‌های HLA-DQ2 و HLA-DQ8) است. به دلیل ژنتیک ایمونولوژیک مشترک، سلیاک با طیف وسیعی از بیماری‌های اتوایمیون همراهی قطعی دارد: دیابت قندی نوع ۱ (در ۸٪ موارد)، تیروئیدیت اتوایمیون، درماتیت هرپتی‌فرم (تظاهر پوستی خارش‌دار پاتوگنومونیک سلیاک)، آلوپسی آره‌آتا، سندرم داون و کمبود انتخابی IgA. در نقطه مقابل، لوپوس اریتماتوی سیستمیک (SLE) مسیر پاتوژنز متفاوتی داشته و همراهی ثابت‌شده‌ای با سلیاک ندارد.",
            "lead_en": "Celiac disease is an immune-mediated enteropathy triggered by dietary gluten in genetically susceptible individuals expressing HLA-DQ2 or HLA-DQ8. Established autoimmune co-morbidities sharing common immunogenetic alleles incorporate type 1 diabetes mellitus, autoimmune thyroiditis, dermatitis herpetiformis, Down syndrome, and selective IgA deficiency. Systemic lupus erythematosus (SLE) lacks an established association.",
            "golden_fa": "همراهی‌های قطعی سلیاک: دیابت نوع ۱، هاشیموتو و درماتیت هرپتی‌فرم؛ سلیاک همراهی ثابت‌شده‌ای با لوپوس ندارد.",
            "golden_en": "Definite celiac associations: type 1 diabetes, thyroid disease, and dermatitis herpetiformis; SLE has no proven link.",
            "points_fa": [
                "غربالگری سلیاک با آنتی‌بادی tTG-IgA در تمام کودکان و بزرگسالان مبتلا به دیابت نوع ۱ توصیه می‌شود.",
                "درماتیت هرپتی‌فرم با تاول‌های به شدت خارش‌دار در سطوح اکستنسور آرنج و زانو مشخص می‌شود.",
                "کمبود انتخابی IgA در مبتلایان به سلیاک شایع‌تر است و نیازمند بررسی آنتی‌بادی‌های از کلاس IgG است.",
                "رعایت رژیم کاملاً بدون گلوتن مادام‌العمر خطر عوارض لنفومی و گوارشی سلیاک را مهار می‌سازد."
            ],
            "points_en": [
                "Routine celiac screening with tissue transglutaminase (tTG-IgA) is recommended in all patients with type 1 diabetes.",
                "Dermatitis herpetiformis features intensely pruritic papulovesicles over extensor surfaces, clearing under a gluten-free diet.",
                "Concomitant selective IgA deficiency is elevated tenfold in celiac disease, mandating IgG-based deamidated gliadin testing.",
                "Strict lifelong adherence to a gluten-free diet reverses mucosal enteropathy and slashes enteropathy-associated T-cell lymphoma risks."
            ]
        }
    },
    28: {
        "ci": 0,
        "whys": [
            "صحیح است؛ در معاینه فیزیکی سیستم تنفسی، تجمع غیرطبیعی و آزاد مقادیر زیاد هوا در فضای پرده پلور در بیماری «پنوموتوراکس (Pneumothorax)»، باعث تشدید ارتعاش و ایجاد صدای طبل‌مانند و «هایپررزونانس در دق قفسه سینه (Hyperresonance to Percussion)» همراه با کاهش صداهای تنفسی در همان سمت می‌گردد.",
            "نادرست است؛ دلیل رد: پلورال افیوژن به علت وجود مایع در دق صدای ماتیت (Dullness) ایجاد می‌کند.",
            "نادرست است؛ دلیل رد: بالازدگی دیافراگم احشای متراکم شکم را بالا آورده و در دق ماتیت ایجاد می‌نماید.",
            "نادرست است؛ دلیل رد: پنومونی به علت پر شدن آلوئول‌ها با اگزودای التهابی و کنسولیداسیون در دق صدای ماتیت می‌دهد."
        ],
        "exp": "وجود هوای آزاد در فضای پرده جنب در پنوموتوراکس، صدای دق را به شدت طبل‌مانند و هایپررزونانس می‌کند.",
        "micro": {
            "lead_fa": "در معاینه فیزیکی ریه، مانور دق (Percussion) به تعیین تراکم بافت زیرین کمک می‌نماید. بافت ریه نرمال صدایی طنین‌دار (Resonant) دارد. حضور بافت جامد یا مایع (افیوژن پلورال، کنسولیداسیون پنومونی، اتلکتازی) رزونانس را از بین برده و صدای مات و خفه (Dullness) ایجاد می‌کند. در نقطه مقابل، وجود هوای بیش از حد در قفسه سینه در بیماری پنوموتوراکس (یا آمفیزم شدید) موجب ایجاد صدای با طنین بسیار بالا، بم و طبل‌مانند تحت عنوان هایپررزونانس (Hyperresonance) می‌گردد.",
            "lead_en": "Thoracic percussion assesses underlying tissue density. Normal aerated lung parenchyma yields resonant notes. Replacement of air by fluid or consolidated tissue (pleural effusion, lobar pneumonia) dampens vibrations to produce dullness to percussion. Conversely, abnormal free air trapped within the pleural space under tension in pneumothorax generates a drum-like, tympanic hyperresonant percussion note.",
            "golden_fa": "دق قفسه سینه: وجود هوا در پلور (پنوموتوراکس) = هایپررزونانس؛ وجود مایع (افیوژن) یا عفونت (پنومونی) = ماتیت.",
            "golden_en": "Chest percussion: pleural air (pneumothorax) = hyperresonance; fluid (effusion) or consolidation (pneumonia) = dullness.",
            "points_fa": [
                "تتراد معاینه در پنوموتوراکس: هایپررزونانس در دق، کاهش صداهای تنفسی، کاهش فرمنیکوس لمسی، و کاهش اتساع قفسه سینه.",
                "در پنوموتوراکس فشارنده انحراف تراشه به سمت مخالف همراه با هایپوتنشن اورژانس دکمپرسیون با سوزن است.",
                "پلورال افیوژن با صدای ماتیت در دق و کاهش صداهای تنفسی سمعی مشخص می‌شود.",
                "پنومونی با ماتیت در دق همراه با افزایش فرمنیکوس لمسی (Tactile Fremitus) و صدای تنفس برونکیال همراه است."
            ],
            "points_en": [
                "The classic physical exam tetrad of pneumothorax: hyperresonance, diminished breath sounds, decreased tactile fremitus, and lag.",
                "Tension pneumothorax couples unilateral hyperresonance with contralateral tracheal shift and hemodynamic collapse.",
                "Pleural effusion contrasts sharply with pneumothorax by demonstrating stony dullness to percussion alongside absent tactile fremitus.",
                "Lobar consolidation in bacterial pneumonia exhibits dullness to percussion coupled uniquely with increased tactile fremitus."
            ]
        }
    },
    29: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: هیپوناترمی اختلالات هوشیاری و تشنج می‌دهد اما اسپاسم و تتانی عضلانی کارپوپدال ایجاد نمی‌کند.",
            "صحیح است؛ در بیماری که به دنبال خونریزی حاد مقادیر زیادی خون ترانسفوزیون شده (۴ واحد پک‌سل در ۳ ساعت) دریافت کرده و اکنون دچار اسپاسم دردناک انگشتان دست (اسپاسم کارپوپدال / علامت تروسو Trousseau's Sign ناشی از تتانی عضلانی) شده است، شایع‌ترین و محتمل‌ترین علت «هیپوکلسمی حاد (Hypocalcemia)» ناشی از «کیلاتور سیترات (Citrate Toxicity)» موجود در محلول‌های ضدانعقاد کیسه‌های خون است که به کلسیم یونیزه آزاد سرم متصل شده و سطح کلسیم فعال بیولوژیک را به شدت کاهش می‌دهد.",
            "نادرست است؛ دلیل رد: هایپرکالمی اختلالات قلبی و تغییرات نوار قلب می‌دهد نه تابلوی کلاسیک تتانی عضلانی.",
            "نادرست است؛ دلیل رد: هایپرمنیزیمی رفلکس‌ها را مهار کرده و ضعف شل می‌دهد نه انقباض اسپاستیک."
        ],
        "exp": "تزریق سریع خون حجیم به علت وجود ضدانعقاد سیترات که کلسیم را متصل می‌کند، موجب هیپوکلسمی حاد و تتانی انگشتان می‌شود.",
        "micro": {
            "lead_fa": "کیسه‌های خون انتقالی محتوی محلول ضدانعقاد سیترات هستند که برای مهار آبشار انعقادی با کلسیم پیوند می‌خورد. در ترانسفوزیون مقادیر انبوه یا سریع خون (بیش از ۳ تا ۴ واحد در چند ساعت) به ویژه در حضور اختلال عملکرد کبدی که نمی‌تواند سیترات را متابولیزه کند، سیترات اضافه وارد گردش خون شده و یون‌های آزاد کلسیم سرم را به دام می‌اندازد. این پدیده منجر به افت شدید کلسیم یونیزه (Acute Hypocalcemia) و تحریک‌پذیری عصبی-عضلانی با علائم تتانی، اسپاسم کارپوپدال و پارستزی دور دهان می‌شود.",
            "lead_en": "Banked packed red blood cells are anticoagulated with citrate, which chelates divalent cations. Massive or rapid blood transfusion (transfusing ≥3-4 units over several hours) overwhelms normal hepatic citrate clearance. Free circulating citrate binds ionized calcium, precipitating acute ionized hypocalcemia. This neuromuscular hyper-excitability triggers carpopedal spasm (Trousseau's sign), circumoral paresthesias, and tetany.",
            "golden_fa": "اسپاسم انگشتان دست (تتانی) پس از تزریق سریع چند واحد خون = هیپوکلسمی حاد ناشی از سمیت سیترات خون.",
            "golden_en": "Carpopedal spasm (tetany) following rapid red blood cell transfusion = acute hypocalcemia from citrate toxicity.",
            "points_fa": [
                "علامت شووستوک (Chvostek sign) با دق روی عصب فاسیال و علامت تروسو با باد کردن کاف فشار خون تتانی را آشکار می‌سازند.",
                "درمان فوری شامل تزریق داخل وریدی آهسته ۱۰ میلی‌لیتر گلوکونات کلسیم ۱۰٪ است.",
                "طولانی شدن فاصله QT در نوار قلب نشانه بارز الکتروکاردیوگرافیک هیپوکلسمی است.",
                "سیترات در کبد به بی‌کربنات متابولیزه شده و متعاقباً می‌تواند آلکالوز متابولیک تاخیری ایجاد کند."
            ],
            "points_en": [
                "Latent tetany is clinically demonstrated via Chvostek's sign (facial twitching) or Trousseau's carpopedal spasm sign.",
                "Immediate emergency intervention mandates slow intravenous administration of 10 mL of 10% calcium gluconate.",
                "Electrocardiography demonstrates prolongation of the corrected QT interval (QTc), predisposing to arrhythmias.",
                "Subsequent hepatic metabolism of the citrate load generates delayed metabolic alkalosis as an expected late sequela."
            ]
        }
    }
}


def main():
    print(f"Loading payload from: {PAYLOAD_PATH}")
    with open(PAYLOAD_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    questions = data.get("questions", [])
    print(f"Total questions in payload: {len(questions)}")

    enriched_count = 0
    for idx, enrich in ENRICHMENTS_BATCH1.items():
        if idx >= len(questions):
            print(f"Warning: Index {idx} out of range!")
            continue

        q = questions[idx]
        # PER USER DIRECTIVE: question_fa and options_fa are PRESERVED EXACTLY AS ORIGINAL.
        q["options_why_fa"] = enrich["whys"]
        q["explanation_fa"] = enrich["exp"]
        if "ci" in enrich:
            q["correct_index"] = enrich["ci"]
        if "key_source" in enrich:
            q["key_source"] = enrich["key_source"]
        if "micro" in enrich:
            q["micro"] = enrich["micro"]

        enriched_count += 1

    with open(PAYLOAD_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Successfully enriched {enriched_count} questions in {PAYLOAD_PATH} while preserving original stems and options.")


if __name__ == "__main__":
    main()
