#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enrichment script for Part 15 Batch 7 (Questions 180 to 219)
Completing Part 15 to 100%!
Target payload: work/tools/master-bank/import-payload.master-preint.part15.json
Note: Per user instructions, question_fa and options_fa are preserved exactly as original.
Only options_why_fa, explanation_fa, and micro are enriched.
"""

import json
import sys

PAYLOAD_PATH = "work/tools/master-bank/import-payload.master-preint.part15.json"

ENRICHMENTS_BATCH7 = {
    180: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: سن در زمان تشخیص فاکتور مهمی است اما مهم‌ترین فاکتور زیستی مستقل پیش‌آگهی نیست.",
            "نادرست است؛ دلیل رد: فاصله زمانی تا شروع درمان تأثیر ثانویه دارد و فاکتور اصلی بیولوژیک بیماری محسوب نمی‌شود.",
            "نادرست است؛ دلیل رد: لکوسیتوز بالای ۱۰۰ هزار ریسک لوکوستاز را بالا می‌برد اما تعیین‌کننده اصلی پیش‌آگهی درازمدت بقا نیست.",
            "صحیح است؛ بر اساس تمام طبقه‌بندی‌های بین‌المللی هماتولوژی (WHO و ELN)، مهم‌ترین، مستقل‌ترین و تعیین‌کننده‌ترین فاکتور پروگنوستیک در تعیین پیش‌آگهی بقا، احتمال پاسخ به شیمی‌درمانی و خطر عود در بیماران مبتلا به لوسمی میلوئیدی حاد (AML)، «یافته‌های سیتوژنتیک و ناهنجاری‌های کروموزومی و مولکولی در زمان تشخیص بیماری» (تقسیم به گروه‌های مطلوب نظیر t(8;21) و inv(16)، متوسط، و نامطلوب نظیر کاریوتایپ کمپلکس یا مونوزومی) است."
        ],
        "exp": "یافته‌های سیتوژنتیک و ناهنجاری‌های کروموزومی در زمان تشخیص، مهم‌ترین فاکتور تعیین پیش‌آگهی در لوسمی حاد میلوئیدی (AML) هستند.",
        "micro": {
            "lead_fa": "در لوسمی حاد میلوئیدی (AML)، سیتوژنتیک و جهش‌های مولکولی در زمان تشخیص سنگ‌بنای طبقه‌بندی خطر و تعیین رویکرد درمانی (شیمی‌درمانی در برابر پیوند آلوژنیک سلول‌های بنیادی) هستند. طبق سیستم ELN، سیتوژنتیک بیماران را به سه گروه پیش‌آگهی تقسیم می‌کند: ۱) مطلوب (Favorable): نظیر t(8;21)، inv(16) و جهش‌های NPM1 بدون FLT3-ITD با بقای بالای ۶۰٪؛ ۲) متوسط (Intermediate)؛ ۳) نامطلوب (Adverse): نظیر کاریوتایپ‌های پیچیده، حذف کروموزوم‌های ۵ یا ۷، و جهش TP53 با پیش‌آگهی بسیار ضعیف.",
            "lead_en": "Pretreatment cytogenetic and molecular genetic analysis represents the single most powerful prognostic determinant in adult acute myeloid leukemia (AML). European LeukemiaNet (ELN) criteria stratify patients into favorable [t(8;21), inv(16), mutated NPM1], intermediate, and adverse risk [complex karyotype, -5, -7, TP53] categories, which dictate post-remission consolidation versus allogeneic transplantation.",
            "golden_fa": "مهم‌ترین فاکتور پروگنوستیک در لوسمی AML = یافته‌های سیتوژنتیک و جهش‌های کروموزومی در زمان تشخیص.",
            "golden_en": "Most critical prognostic factor in AML = pretreatment cytogenetic and chromosomal abnormalities.",
            "points_fa": [
                "گروه با پروگنوز مطلوب شامل ترانسلوکاسیون‌های CBF نظیر t(8;21) و inv(16) هستند.",
                "کاریوتایپ کمپلکس (سه یا بیشتر ناهنجاری کروموزومی) نشانگر پیش‌آگهی بسیار نامطلوب است.",
                "جهش مولکولی FLT3-ITD با افزایش نرخ عود و کاهش بقای کلی همراه است.",
                "سن بیمار به عنوان مهم‌ترین فاکتور مرتبط با میزبان در تحمل درمان‌های سیتوتوکسیک در نظر گرفته می‌شود."
            ],
            "points_en": [
                "Core-binding factor (CBF) leukemias harboring t(8;21) or inv(16) yield high remission and cure rates.",
                "A complex monosomal karyotype signifies profound chemoresistance and extremely poor overall survival.",
                "FLT3-internal tandem duplication (FLT3-ITD) confers aggressive biology, mandating FLT3-inhibitor therapy.",
                "Patient age serves as the foremost host-related determinant governing physical tolerance to induction regimens."
            ]
        }
    },
    181: {
        "ci": 0,
        "whys": [
            "صحیح است؛ آزمایش «سنجش سطح سرمی پروتئین گیرنده ترانسفرین (Serum Transferrin Receptor / sTfR)» مفیدترین و دقیق‌ترین مارکر در تفکیک آنمی فقر آهن خالص (IDA) از آنمی ناشی از التهاب و بیماری‌های مزمن (ACD) است؛ زیرا sTfR برعکس فریتین «پروتئین فاز حاد نبوده و تحت تأثیر التهاب سیستمیک قرار نمی‌گیرد»؛ در فقر آهن سطح sTfR به شدت افزایش می‌یابد، در حالی که در آنمی التهاب در محدوده نرمال باقی می‌ماند (شاخص sTfR/log Ferritin افتراق‌دهنده قطعی است).",
            "نادرست است؛ دلیل رد: سطح آهن سرم (Serum Iron) در هر دو بیماری فقر آهن و التهاب کاهش می‌یابد و ارزش افتراقی ندارد.",
            "نادرست است؛ دلیل رد: TIBC در التهاب پایین و در فقر آهن بالا است اما همپوشانی وسیعی دارد و به اندازه sTfR دقیق نیست.",
            "نادرست است؛ دلیل رد: پروتوپورفیرین آزاد گلبول قرمز در هر دو بیماری و مسمومیت با سرب بالا می‌رود و اختصاصی نیست."
        ],
        "exp": "سنجش سطح گیرنده ترانسفرین سرم (sTfR) چون تحت تأثیر التهاب قرار نمی‌گیرد، مفیدترین تست تفکیک فقر آهن از آنمی التهاب است.",
        "micro": {
            "lead_fa": "افتراق کم‌خونی فقر آهن (IDA) از کم‌خونی بیماری‌های مزمن و التهاب (ACD) به دلیل افزایش کاذب فریتین در شرایط التهابی با چالش روبروست. گیرنده محلول ترانسفرین (sTfR) بیومارکری است که بیانگر کمبود آهن داخل‌سلولی گلبول‌های قرمز است. از آنجا که sTfR یک واکنش‌دهنده فاز حاد نیست، در حضور عفونت یا بیماری روماتیسمی بالا نمی‌رود؛ بنابراین در فقر آهن افزایش یافته اما در ACD طبیعی می‌ماند. شاخص sTfR تقسیم بر لگاریتم فریتین دقیق‌ترین ابزار افتراق است.",
            "lead_en": "Differentiating iron deficiency anemia (IDA) from anemia of chronic disease/inflammation (ACD) is obscured by ferritin's behavior as an acute-phase reactant. Serum soluble transferrin receptor (sTfR) reflects cellular iron hunger and is uninfluenced by systemic inflammation; sTfR levels rise markedly in iron deficiency but remain strictly normal in pure ACD, yielding the highest diagnostic discriminative value.",
            "golden_fa": "دقیق‌ترین مارکر افتراق فقر آهن از آنمی بیماری مزمن = سنجش گیرنده ترانسفرین سرم (sTfR).",
            "golden_en": "Most reliable biomarker distinguishing iron deficiency from anemia of chronic disease = serum transferrin receptor (sTfR).",
            "points_fa": [
                "فریتین کمتر از ۳۰ نانوگرم بر میلی‌لیتر فقر آهن را قطعی می‌سازد اما فریتین در حضور التهاب می‌تواند تا ۱۰۰ کاذباً بالا باشد.",
                "در آنمی ناشی از التهاب هپسیدین کبدی افزایش یافته و رهایش آهن از ماکروفاژها مسدود می‌شود.",
                "شاخص sTfR به لگاریتم فریتین (sTfR Index) بالاتر از ۲ نشانگر فقر آهن همزمان در بستر التهاب است.",
                "بیوپسی مغز استخوان با رنگ‌آمیزی پروسین بلو استاندارد طلایی کلاسیک ارزیابی ذخایر آهن است."
            ],
            "points_en": [
                "A serum ferritin <30 ng/mL unequivocally establishes iron deficiency, but inflammation can elevate it above 100 ng/mL.",
                "Anemia of chronic disease is orchestrated by hepcidin hyperproduction, sequestering iron within macrophages.",
                "The sTfR-ferritin index (>2.0) reliably identifies coexistent iron deficiency superimposed upon chronic inflammatory states.",
                "Prussian blue staining of bone marrow aspirate remains the definitive historical reference standard."
            ]
        }
    },
    182: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: تست‌های تیروئید کم‌کاری را پایش می‌کنند اما علت آنمی ماکروسیتیک شدید را توضیح نمی‌دهند.",
            "صحیح است؛ در یک بیمار با بیماری‌های خودایمن متعدد (کم‌کاری تیروئید و ویتیلیگو) که دچار آنمی ماکروسیتیک شدید (Hb=7, MCV=115) و ترومبوسیتوپنی ملایم شده است، شک قوی به «آنمی پرنیسیوز (کمبود ویتامین B12)» مطرح است؛ با این حال، در ۱۰ تا ۳۰ درصد بیماران مبتلا به کمبود سلولی B12، سطح سرمی ویتامین B12 ممکن است «به طور کاذب در محدوده طبیعی گزارش شود»؛ در این موقعیت، سنجش بیومارکر عملکردی «اسید متیل‌مالونیک سرم (Serum Methylmalonic Acid / MMA)» حساس‌ترین، دقیق‌ترین و استانداردترین روش برای اثبات کمبود بافتی کوبالامین است.",
            "نادرست است؛ دلیل رد: هموسیستئین سرم هم در کمبود B12 و هم در کمبود فولات بالا می‌رود و اختصاصیت MMA را ندارد.",
            "نادرست است؛ دلیل رد: سطح فولات سرم علت زمینه ای کم‌خونی در این بیمار اتوایمیون را مشخص نمی‌سازد."
        ],
        "exp": "در آنمی ماکروسیتیک مشکوک به کمبود B12 با سطح سرمی طبیعی ویتامین، سنجش اسید متیل‌مالونیک (MMA) روش تشخیصی انتخابی است.",
        "micro": {
            "lead_fa": "همراهی ویتیلیگو و هاشیموتو زمینه اتوایمیون بیمار را برای آنمی پرنیسیوز (تخریب با واسطه آنتی‌بادی علیه سلول‌های پاریتال و فاکتور داخلی) فراهم می‌سازد. در ارزیابی آنمی مگالوبلاستیک، اندازه‌گیری سطح تام ویتامین B12 سرم گاهی با نتایج نرمال کاذب همراه است زیرا بخش متصل به ترانس‌کوبالامین فعال سلولی را منعکس نمی‌کند. متابولیت متیل‌مالونیک اسید (MMA) منحصراً در کمبود B12 تجمع می‌یابد؛ بنابراین افزایش MMA سرم کمبود سلولی کوبالامین را قطعی می‌سازد.",
            "lead_en": "Coexistence of vitiligo and autoimmune thyroiditis strongly predisposes to pernicious anemia. In patients presenting with severe macrocytic anemia and paradoxically borderline-normal serum cobalamin levels, measuring serum methylmalonic acid (MMA) is the definitive diagnostic maneuver. Elevated MMA confirms tissue-level B12 deficiency with high sensitivity (>98%), unmasking functional intracellular cobalamin depletion.",
            "golden_fa": "آنمی ماکروسیتیک با سطح ویتامین B12 نرمال = اقدام تشخیصی انتخابی: اندازه‌گیری متیل‌مالونیک اسید (MMA) سرم.",
            "golden_en": "Macrocytic anemia with normal serum B12 = diagnostic test of choice: serum methylmalonic acid (MMA) level.",
            "points_fa": [
                "تجمع اسید متیل‌مالونیک ناشی از اختلال آنزیم متیل‌مالونیل-کوآ موتاز وابسته به کوبالامین است.",
                "افزایش توأم هموسیستئین و متیل‌مالونات مؤید کمبود ویتامین B12 است؛ کمبود فولات فقط هموسیستئین را بالا می‌برد.",
                "بررسی آنتی‌بادی ضد فاکتور داخلی (Anti-Intrinsic Factor) علت آنمی پرنیسیوز را اثبات می‌کند.",
                "درمان فوری با تزریق عضلانی ویتامین B12 برای جلوگیری از عوارض عصبی غیرقابل برگشت طناب نخاعی الزامی است."
            ],
            "points_en": [
                "MMA accumulation arises from cobalamin deficiency paralyzing the mitochondrial methylmalonyl-CoA mutase reaction.",
                "Elevated homocysteine alongside elevated MMA characterizes B12 deficiency; pure folate deficiency elevates homocysteine alone.",
                "Anti-intrinsic factor antibodies demonstrate high specificity verifying an underlying pernicious anemia etiology.",
                "Parenteral intramuscular cyanocobalamin repletion must be instituted to arrest subacute combined spinal cord degeneration."
            ]
        }
    },
    183: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: سرطان پستان شایع‌ترین تومور توپر مرتبط با هایپرکلسمی ناشی از متاستازهای استخوانی استئولیتیک است.",
            "نادرست است؛ دلیل رد: مولتیپل میلوما به علت ترشح سایتوکاین‌های فعال‌کننده استئوکلاست‌ها از شایع‌ترین علل هایپرکلسمی خونی است.",
            "صحیح است (بدخیمی‌ای که به ندرت موجب هایپرکلسمی می‌شود)؛ «سرطان کولون و رکتوم (Colon Cancer)» به ندرت و با شیوع بسیار اندک (کمتر از ۱ درصد) با عارضه هایپرکلسمی بدخیمی همراه است؛ در حالی که شایع‌ترین بدخیمی‌های مولد هایپرکلسمی شامل: کارسینوم‌های اسکواموس سلول (ریه، سر و گردن)، سرطان پستان، مولتیپل میلوما و کارسینوم سلول کلیوی (RCC) هستند.",
            "نادرست است؛ دلیل رد: کارسینوم سلول سنگفرشی (به‌ویژه ریه) شایع‌ترین علت هایپرکلسمی هومورال بدخیمی ناشی از ترشح نابجای PTHrP است."
        ],
        "exp": "سرطان پستان، میلوم و اسکواموس ریه از شایع‌ترین علل هایپرکلسمی بدخیمی هستند؛ کانسر کولون به ندرت هایپرکلسمی می‌دهد.",
        "micro": {
            "lead_fa": "هایپرکلسمی ناشی از بدخیمی (HCM) در ۲۰ تا ۳۰ درصد بیماران سرطانی در طول سیر بیماری رخ می‌دهد. مکانیسم‌های اصلی عبارتند از: ۱) هایپرکلسمی هومورال ناشی از ترشح پپتید وابسته به هورمون پاراتیروئید (PTHrP در ۸۰٪ موارد) به ویژه در کارسینوم‌های سلول سنگفرشی (ریه، مری، گردن) و کلیه؛ ۲) استئولیز موضعی استخوان ناشی از متاستازهای متعدد در سرطان پستان و مولتیپل میلوما. سرطان کولورکتال به ندرت منجر به هایپرکلسمی می‌شود.",
            "lead_en": "Hypercalcemia of malignancy (HCM) complicates up to 30% of advanced neoplastic diseases, primarily driven by tumor secretion of parathyroid hormone-related protein (PTHrP, 80%) in squamous cell carcinomas, or osteolytic bone destruction in breast cancer and multiple myeloma. Colorectal cancer represents a distinct clinical exception, exceptionally rarely provoking hypercalcemia.",
            "golden_fa": "شایع‌ترین بدخیمی‌های همراه با هایپرکلسمی: پستان، میلوم و اسکواموس ریه؛ کانسر کولون به ندرت هایپرکلسمی می‌دهد.",
            "golden_en": "Most common malignancies causing hypercalcemia: breast, myeloma, and squamous cell lung cancer; colon cancer rarely does.",
            "points_fa": [
                "سنجش PTHrP در سرم بیماران با کلسیم بالا و PTH مهارشده بدخیمی هومورال را اثبات می‌کند.",
                "درمان فوری هایپرکلسمی بدخیمی هیدراسیون تهاجمی با نرمال سالین و بیس‌فسفونات‌های وریدی (زولدرونیک اسید) است.",
                "آنتی‌بادی دنوزوماب (Denosumab) در موارد هایپرکلسمی مقاوم به بیس‌فسفونات‌ها داروی انتخابی است.",
                "در مولتیپل میلوما گلوکوکورتیکوئیدها با مهار تولید سایتوکاین‌های فعال‌کننده استئوکلاست به کنترل کلسیم کمک می‌کنند."
            ],
            "points_en": [
                "Suppressed intact PTH alongside elevated plasma PTHrP establishes humoral hypercalcemia of malignancy.",
                "Immediate medical therapy combines aggressive isotonic saline resuscitation with intravenous zoledronic acid.",
                "Denosumab (monoclonal antibody targeting RANKL) is highly effective for bisphosphonate-refractory hypercalcemia.",
                "Glucocorticoids play an adjunctive role specifically in myeloma and lymphoma by inhibiting osteoclast activating factors."
            ]
        }
    },
    184: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: طول مدت بیماری (۲ ماه) بیش از ۶ هفته است و کاملاً با معیارهای تشخیصی RA تطابق دارد.",
            "نادرست است؛ دلیل رد: منفی بودن فاکتور روماتوئید در ۲۰ تا ۳۰ درصد بیماران مبتلا به RA (فرم سرونگاتیو) دیده می‌شود و بیماری را رد نمی‌کند.",
            "نادرست است؛ دلیل رد: سن ۴۸ سالگی سن اوج شیوع آرتریت روماتوئید در زنان است.",
            "صحیح است؛ بیماری آرتریت روماتوئید (RA) یک قاعده بنیادین دارد: «آرتریت روماتوئید ستون فقرات لومبار و مفاصل کمر را به طور کامل معاف می‌گذارد و هرگز کمردرد ایجاد نمی‌کند»؛ تنها قسمت اسکلت محوری که در RA ممکن است درگیر شود، ستون فقرات گردنی است؛ بنابراین وجود «درد قسمت تحتانی کمر (Low Back Pain)» بیش از هر یافته دیگری تشخیص آرتریت روماتوئید را زیر سؤال برده و مطرح‌کننده بیماری‌های دیگر نظیر اسپوندیلوآرتریت‌ها است."
        ],
        "exp": "آرتریت روماتوئید هرگز ستون فقرات کمری را درگیر نمی‌کند؛ بنابراین وجود کمردرد تحتانی تشخیص RA را قویاً زیر سؤال می‌برد.",
        "micro": {
            "lead_fa": "در ارزیابی درگیری اسکلتی در آرتریت روماتوئید، شناخت مفاصل معاف از بیماری اهمیت حیاتی دارد. بیماری RA ستون فقرات توراسیک، ستون فقرات کمری (Lumbar) و مفاصل ساکروایلیاک را مطلقاً مبتلا نمی‌سازد. تنها قسمت از محور بدن که به علت داشتن مفاصل سینوویال درگیر می‌شود ستون فقرات گردن (Cervical C1-C2) است. شکایت کمردرد تحتانی در بیماری با پلی‌آرتریت، تشخیص RA را مردود ساخته و توجه پزشک را به اسپوندیلوآرتریت‌ها (نظیر آرتریت پسوریاتیک) جلب می‌کند.",
            "lead_en": "Rheumatoid arthritis exhibits strict anatomical selectivity: it fundamentally spares the thoracic spine, lumbar spine, and sacroiliac joints. The cervical spine (specifically the atlantoaxial synovial complex) represents the solitary axial target. Presence of low back pain strongly refutes a primary diagnosis of rheumatoid arthritis, redirecting suspicion toward axial spondyloarthritis.",
            "golden_fa": "یافته‌ای که تشخیص آرتریت روماتوئید را زیر سؤال می‌برد = درد قسمت تحتانی کمر (RA ستون فقرات کمری را معاف می‌دارد).",
            "golden_en": "Finding calling rheumatoid arthritis into question = low back pain (RA strictly spares the lumbar spine).",
            "points_fa": [
                "تنها قسمت محوری درگیر در آرتریت روماتوئید ستون فقرات گردنی با خطر سابلوکساسیون آتلانتواگزیال است.",
                "درگیری ستون فقرات کمری و ساکروایلییت مشخصه بارز گروه اسپوندیلوآرتریت‌ها است.",
                "مفاصل DIP دست نیز در آرتریت روماتوئید سالم می‌مانند.",
                "حدود ۲۰ تا ۳۰ درصد مبتلایان به RA در شروع بیماری سرونگاتیو (RF منفی) هستند."
            ],
            "points_en": [
                "The cervical spine is the sole axial segment susceptible to rheumatoid synovitis, risking C1-C2 instability.",
                "Lumbar and sacroiliac inflammatory involvement is the diagnostic signature of peripheral or axial spondyloarthritis.",
                "Distal interphalangeal (DIP) joints of the hands are characteristically spared in rheumatoid arthritis.",
                "Roughly 20-30% of authentic rheumatoid arthritis patients are seronegative for rheumatoid factor at presentation."
            ]
        }
    },
    185: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: کورتیکواستروئید خوراکی در فرم ساده غددی شوگرن جایگاهی ندارد و تنها در عوارض شدید سیستمیک احشایی تجویز می‌شود.",
            "صحیح است؛ طبق تمام معیارهای تشخیصی و طبقه‌بندی بین‌المللی سندرم شوگرن اولیه (معیارهای 2016 ACR/EULAR)، شرط اساسی اثبات بیماری «رد و بررسی دقیق سایر علل زمینه‌ای احتمالی ایجادکننده خشکی دهان و چشم (Exclusion Criteria)» شامل: مصرف داروهای آنتی‌کولینرژیک، سابقه پرتودرمانی سر و گردن، عفونت فعال ویروس هپاتیت C، عفونت HIV، سارکوئیدوز، آمیلوئیدوز و بیماری مرتبط با IgG4 است که باید به دقت رد شوند.",
            "نادرست است؛ دلیل رد: نمونه‌برداری از پاروتید به دلیل خطر آسیب به شاخه‌های عصب فاسیال انجام نمی‌شود و بیوپسی لب تحتانی استاندارد است.",
            "نادرست است؛ دلیل رد: بیوپسی غدد اشکی روتین نیست و خطرات آسیب بافتی دارد."
        ],
        "exp": "در مواجهه با علائم سیکا و Anti-Ro مثبت، بررسی و رد سایر علل احتمالی خشکی چشم و دهان (معیارهای خروج) اقدام ضروری است.",
        "micro": {
            "lead_fa": "تشخیص سندرم شوگرن اولیه طبق معیارهای اعتبارسنجی‌شده ACR/EULAR 2016 نیازمند احراز معیارهای ورود و خروج است. معیارهای خروج شامل بررسی عللی است که سندرم سیکا را تقلید می‌کنند: سابقه رادیوتراپی سر و گردن، هپاتیت C مزمن، عفونت HIV، سارکوئیدوز، آمیلوئیدوز، بیماری مرتبط با IgG4 و عوارض جانبی داروهای با اثر آنتی‌کولینرژیک. بیوپسی بافت غدد بزاقی کوچک لب تحتانی در موارد مبهم به کار می‌رود نه بیوپسی تهاجمی غده پاروتید.",
            "lead_en": "Classification criteria for primary Sjogren's syndrome (2016 ACR/EULAR) strictly mandate ruling out exclusionary mimics that produce sicca symptoms prior to formal diagnosis. Essential rule-outs include chronic hepatitis C, HIV, head and neck radiation therapy, sarcoidosis, amyloidosis, and IgG4-related disease. Biopsy of the minor salivary glands of the lower lip is preferred over invasive parotid biopsy.",
            "golden_fa": "در شک به سندرم شوگرن: اقدام بعدی = رد سایر علل احتمالی ایجادکننده خشکی دهان و چشم (سارکوئیدوز، داروها، هپاتیت C).",
            "golden_en": "Suspected Sjogren's syndrome: next step = ruling out secondary and mimicking causes of sicca (sarcoidosis, drugs, HCV).",
            "points_fa": [
                "تست شیرمر (Schirmer test) ترشح اشک کمتر از ۵ میلی‌متر در ۵ دقیقه را مثبت و غیرطبیعی در نظر می‌گیرد.",
                "بیوپسی غدد بزاقی فرعی لب تحتانی (Focal lymphocytic sialadenitis) روش انتخابی پاتولوژی است.",
                "درمان فرم غددی علامتی با قطره‌های اشک مصنوعی و ستیواگوگ‌ها نظیر پیلوکارپین یا سِوی‌ملین است.",
                "بیماران مبتلا به شوگرن ریسک بالایی (تا ۲۰ تا ۴۰ برابر) برای ابتلا به لنفوم B سل غیرهوچکین دارند."
            ],
            "points_en": [
                "A positive Schirmer test demonstrates wetting of ≤5 mm on filter paper within 5 minutes without anesthesia.",
                "Minor salivary gland labial biopsy demonstrating focal lymphocytic sialadenitis (focus score ≥1) is the tissue standard.",
                "Glandular sicca management relies on preservative-free artificial tears and muscarinic secretagogues (pilocarpine).",
                "Sjogren's syndrome confers an extraordinarily high lifetime risk (20- to 40-fold) of B-cell non-Hodgkin lymphoma."
            ]
        }
    },
    186: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: سندرم تونل کارپ (CTS) از تظاهرات بسیار شایع روماتولوژیک در دیابت است.",
            "نادرست است؛ دلیل رد: کپسولیت چسبنده شانه (شانه منجمد) شیوع بالایی در مبتلایان به دیابت دارد.",
            "نادرست است؛ دلیل رد: نوروآرتروپاتی شارکوت به دنبال نوروپاتی محیطی دیابتی شایع‌ترین علت تخریب مفاصل پا در دیابت است.",
            "صحیح است (تظاهری که جزء علائم دیابت نیست)؛ «کلسیفیکاسیون زیرجلدی (Subcutaneous Calcinosis)» جزء تظاهرات روماتولوژیک بیماری دیابت ملیتوس نیست؛ کلسینوز زیرجلدی عارضه بارز بیماری‌های بافت همبند اتوایمیون نظیر «اسکلرودرمی (سندرم CREST) و درماتومیوزیت» است؛ تظاهرات اسکلتی دیابت شامل شانه منجمد، CTS، شارکو، چیروآرتروپاتی و انقباض دوپویترن هستند."
        ],
        "exp": "کلسیفیکاسیون زیرجلدی مشخصه اسکلرودرمی و درماتومیوزیت است و جزء تظاهرات اسکلتی-عضلانی بیماری دیابت نیست.",
        "micro": {
            "lead_fa": "عوارض موسکولواسکلتال دیابت ناشی از تغییرات میکروواسکولار و گلیکاسیون پیشرفته کلاژن هستند که بافت‌های فیبروز و مفاصل را گرفتار می‌سازند. شایع‌ترین این عوارض عبارتند از: شانه منجمد (کپسولیت چسبنده)، چیروآرتروپاتی دیابتی، سندرم تونل کارپال (CTS)، انقباض دوپویترن و مفاصل نوروپاتیک شارکو. در مقابل، رسوب کلسیم در پوست و زیر جلد (کلسینوز کوتیس) ویژگی اختصاصی بیماری‌های کلاژن واسکولار شامل اسکلرودرمی و درماتومیوزیت جوانان است.",
            "lead_en": "Musculoskeletal complications of diabetes mellitus arise from advanced glycation end-products cross-linking collagen fibers, encompassing diabetic cheiroarthropathy, adhesive capsulitis, carpal tunnel syndrome, and Charcot neuroarthropathy. Subcutaneous calcinosis (calcinosis cutis) is etiologically tied to systemic sclerosis (CREST) and dermatomyositis, absent in uncomplicated diabetes.",
            "golden_fa": "تظاهرات روماتولوژیک دیابت: CTS، شانه منجمد و شارکو؛ کلسیفیکاسیون زیرجلدی مربوط به اسکلرودرمی است نه دیابت.",
            "golden_en": "Musculoskeletal diabetes signs: CTS, frozen shoulder, Charcot joint; subcutaneous calcinosis belongs to scleroderma.",
            "points_fa": [
                "مفصل شارکو منجر به کلاپس قوس طولی کف پا و ایجاد پای گهواره‌ای (Rocker-bottom foot) می‌شود.",
                "کپسولیت چسبنده در بیماران دیابتی اغلب دوطرفه، طولانی‌تر و مقاوم‌تر به درمان است.",
                "انقباض دوپویترن با ضخیم شدن گره‌ای فاسیای کف دست انگشتان چهارم و پنجم را خمیده می‌کند.",
                "کلسینوز در اسکلرودرمی در زمینه نکروز چربی و ایسکمی عروقی ایجاد می‌شود."
            ],
            "points_en": [
                "Charcot foot precipitates midfoot architecture collapse, culminating in classic 'rocker-bottom' deformity.",
                "Adhesive capsulitis in diabetics demonstrates higher recurrence rates, bilaterality, and treatment resistance.",
                "Dupuytren's contracture involves nodular fibromatosis of the palmar fascia flexing the fourth and fifth digits.",
                "Calcinosis cutis in systemic sclerosis reflects dystrophic calcification triggered by chronic tissue ischemia."
            ]
        }
    },
    187: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: افزایش فشار شریان ریه (PAH) در ۱۰ تا ۱۵ درصد بیماران اسکلرودرمی رخ می‌دهد.",
            "نادرست است؛ دلیل رد: ریفلاکس مری و اختلالات حرکتی در ۷۰ تا ۸۰ درصد دیده می‌شود اما شایع‌ترین نیست.",
            "صحیح است؛ در بیماری با تابلوی اسکلروز سیستمیک (سفتی پوست اندام‌ها و صورت همراه با اولسرهای پیتینگ در نوک انگشتان)، شایع‌ترین، زودرس‌ترین و پایدارترین تظاهر بالینی بیماری «پدیده رینود (Raynaud's Phenomenon)» است که در «بیش از ۹۵ تا ۹۸ درصد از مبتلایان به اسکلرودرمی» به عنوان اولین علامت بالینی حضور داشته و منجر به ایسکمی و اولسرهای انگشتان می‌گردد.",
            "نادرست است؛ دلیل رد: تلانژکتازی در ۶۰ تا ۷۰ درصد دیده می‌شود اما فراوانی آن کمتر از رینود است."
        ],
        "exp": "پدیده رینود در بیش از ۹۵ تا ۹۸ درصد بیماران اسکلرودرمی وجود دارد و شایع‌ترین و زودرس‌ترین یافته بالینی بیماری است.",
        "micro": {
            "lead_fa": "پدیده رینود (Raynaud's phenomenon) تغییر رنگ سه‌مرحله‌ای انگشتان (سفید ناشی از رنگ‌پریدگی ایسکمیک، آبی ناشی از سیانوز و قرمز ناشی از پرخونی واکنشی) در مواجهه با سرما است. این پدیده در بیش از ۹۵ تا ۹۹ درصد از کل مبتلایان به اسکلروز سیستمیک دیده می‌شود و در اکثریت مطلق آن‌ها سال‌ها قبل از ظهور تغییرات پوستی به عنوان نخستین تظاهر بالینی آغاز می‌گردد. اولسرهای ایسکمیک نوک انگشتان عارضه مستقیم رینود شدید است.",
            "lead_en": "Raynaud's phenomenon represents episodic digital vasospasm characterized by classic triphasic color changes (pallor, cyanosis, erythema) triggered by cold or emotional stress. It is universally acknowledged as the earliest, most prevalent clinical hallmark of systemic sclerosis, present in >95-98% of all patients and driving secondary digital pitting ulcers.",
            "golden_fa": "شایع‌ترین و زودرس‌ترین یافته بالینی در اسکلرودرمی = پدیده رینود (در بیش از ۹۵ تا ۹۸ درصد بیماران).",
            "golden_en": "Most prevalent and earliest physical finding in systemic sclerosis = Raynaud's phenomenon (>95-98% of patients).",
            "points_fa": [
                "زخم‌های پیتینگ نوک انگشتان ناشی از انسداد عروق شریانی کوچک و ایسکمی پیشرفته دیجیتال هستند.",
                "کاپیلاروسکوپی بستر ناخن ناهنجاری‌های بارز عروقی و مویرگ‌های غول‌آسا را در اسکلرودرمی آشکار می‌سازد.",
                "مسدودکننده‌های کانال کلسیم دی‌هیدروپیریدینی (نیفدیپین) خط اول درمان دارویی رینود هستند.",
                "سیگار کشیدن به علت تحریک انقباض عروقی ایسکمی انگشتان را تشدید می‌نماید."
            ],
            "points_en": [
                "Digital pitting scars and loss of finger pulp tissue reflect severe fixed microvascular obliterative ischemia.",
                "Nailfold video capillaroscopy visualizes enlarged megacapillaries and avascular dropout zones.",
                "Dihydropyridine calcium channel blockers (oral nifedipine) constitute first-line pharmacotherapy.",
                "Cigarette smoking precipitates profound sympathomimetic vasospasm, dramatically accelerating digital gangrene."
            ]
        }
    },
    188: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: پلی‌آنژئیت میکروسکوپی (MPA) با آسم شدید و ائوزینوفیلی بالا در خون محیطی همراه نیست.",
            "نادرست است؛ دلیل رد: آرتریت سلول غول‌آسا (GCA) واسکولیت عروق بزرگ سالمندان است و آسم و ائوزینوفیلی نمی‌دهد.",
            "صحیح است؛ تابلوی بیمار میانسال با سابقه طولانی آسم شدید، بروز پورپورای برجسته و آرترالژی، ائوزینوفیلی بارز در خون محیطی (EOS=1700 cells/mL معادل ۱۸٪) و مثبت بودن تیتر بالای آنتی‌بادی p-ANCA (Anti-MPO)، تابلوی پاتوگنومونیک و کلاسیک «پلی‌آنژئیت گرانولوماتوز ائوزینوفیلیک (EGPA / سندروم چرگ-اشتراوس)» است.",
            "نادرست است؛ دلیل رد: گرانولوماتوزیس با پلی‌آنژئیت (GPA یا وگنر) با c-ANCA (Anti-PR3) همراه است و با آسم و ائوزینوفیلی شدید تظاهر نمی‌کند."
        ],
        "exp": "آسم طولانی‌مدت، ائوزینوفیلی محیطی شدید، پورپورا و آنتی‌بادی Anti-MPO (p-ANCA)، تابلوی پاتوگنومونیک EGPA (چرگ-اشتراوس) است.",
        "micro": {
            "lead_fa": "پلی‌آنژئیت گرانولوماتوز ائوزینوفیلیک (EGPA که قبلاً سندرم چورگ-اشتراوس نامیده می‌شد) یک واسکولیت نکروزان عروق کوچک است که با سه فاز بالینی مشخص می‌شود: ۱) فاز آلرژیک با آسم شدید بالغین و رینوسینوزیت مزمن؛ ۲) فاز ائوزینوفیلیک با ائوزینوفیلی بالای خون محیطی (بیش از ۱۰۰۰ تا ۱۵۰۰) و ارتشاح ریوی؛ ۳) فاز واسکولیت سیستمیک با پورپورای قابل لمس، مونونوریت مولتیپلکس و آنتی‌بادی ضد میلوپروکسیداز (Anti-MPO / p-ANCA).",
            "lead_en": "Eosinophilic granulomatosis with polyangiitis (EGPA, historically Churg-Strauss syndrome) is an ANCA-associated necrotizing vasculitis of small-to-medium vessels. Hallmarks include adult-onset asthma, severe tissue and peripheral blood eosinophilia (>1,500 cells/μL), palpable purpura, and high-titer p-ANCA / anti-myeloperoxidase (anti-MPO) positivity.",
            "golden_fa": "آسم قبلی + ائوزینوفیلی محیطی بالا + پورپورای برجسته و Anti-MPO مثبت = واسکولیت EGPA (چرگ-اشتراوس).",
            "golden_en": "Preexisting asthma + high eosinophilia + palpable purpura + anti-MPO (p-ANCA) = EGPA (Churg-Strauss).",
            "points_fa": [
                "درگیری قلبی (میوکاردیت ائوزینوفیلیک) شایع‌ترین علت مرگ‌ومیر بیماران مبتلا به EGPA است.",
                "پلی‌آرتریت ندوزا و MPA برعکس EGPA با سابقه آسم آلرژیک همراه نیستند.",
                "درمان خط اول فاز فعال کورتیکواستروئید با دوز بالا است که در موارد ارگان‌های حیاتی با سیکلوفسفامید یا مپولیزوماب همراه می‌شود.",
                "آنتی‌بادی Anti-MPO در حدود ۵۰ تا ۷۰ درصد بیماران مبتلا به EGPA مثبت است."
            ],
            "points_en": [
                "Cardiac involvement (eosinophilic endomyocarditis and heart failure) represents the primary cause of mortality.",
                "Microscopic polyangiitis (MPA) and PAN are strictly devoid of asthma or prominent peripheral eosinophilia.",
                "Systemic glucocorticoids are the mainstay of remission induction, paired with cyclophosphamide in severe organ disease.",
                "Perinuclear ANCA (anti-MPO) is identified in roughly 40-60% of EGPA presentations, particularly with glomerulonephritis."
            ]
        }
    },
    189: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: استئوپروز مهره‌های کمری در بیماران مبتلا به AS حتی در مراحل اولیه به علت التهاب سیستمیک سایتوکاینی و عدم تحرک شایع است.",
            "صحیح است (یافته‌ای که بسیار کمتر محتمل است)؛ درگیری چشمی در بیماری اسپوندیلیت آنکیلوزان (AS) به طور کلاسیک و اختصاصی «یووئیت قدامی حاد یک‌طرفه (Acute Anterior Uveitis / Iridocyclitis)» است؛ بروز «یووئیت خلفی (Posterior Uveitis)» در این بیماری فوق‌العاده نادر و غیرمحتمل است و در صورت مشاهده یووئیت خلفی باید به بیماری‌های دیگری نظیر بیماری بهجت، سارکوئیدوز، سل یا توکسوپلاسموز مشکوک شد.",
            "نادرست است؛ دلیل رد: انتزیت (التهاب محل اتصال تاندون به استخوان) علامت مشخصه و بسیار شایع اسپوندیلیت آنکیلوزان است.",
            "نادرست است؛ دلیل رد: داکتیلیت (انگشت سوسیسی) در خانواده اسپوندیلوآرتریت‌ها به وفور دیده می‌شود."
        ],
        "exp": "یووئیت در اسپوندیلیت آنکیلوزان به صورت تیپیک قدامی حاد (Anterior Uveitis) است؛ یووئیت خلفی در AS فوق‌العاده بعید است.",
        "micro": {
            "lead_fa": "شایع‌ترین تظاهر خارج مفصلی در اسپوندیلیت آنکیلوزان یووئیت قدامی حاد (ایریتیس/ایریدوسیکلیت) است که در ۳۰ تا ۴۰ درصد بیماران رخ می‌دهد و با درد یک‌طرفه، قرمزی و فوتوفوبی تظاهر می‌یابد. یووئیت میانی و یووئیت خلفی (کوروئیدیت، رتینیت) با AS ارتباطی ندارند و در بیماری‌هایی نظیر بهجت و سارکوئیدوز دیده می‌شوند. همچنین انتزیت، استئوپنی مهره‌ها و داکتیلیت از تظاهرات شناخته‌شده خانواده اسپوندیلوآرتریت هستند.",
            "lead_en": "Acute anterior uveitis is the preeminent extra-articular manifestation in ankylosing spondylitis, afflicting 25-40% of cohorts, characterized by sudden, painful, unilateral anterior chamber inflammation. Posterior uveitis (choroiditis/retinitis) is exceptionally atypical in AS, prompting alternative diagnostic workup for Behcet's disease, sarcoidosis, or systemic infections.",
            "golden_fa": "در اسپوندیلیت آنکیلوزان یووئیت همیشه قدامی حاد (یک‌طرفه) است؛ بروز یووئیت خلفی در AS کمتر محتمل است.",
            "golden_en": "Uveitis in ankylosing spondylitis is characteristically acute anterior; posterior uveitis is extremely unlikely in AS.",
            "points_fa": [
                "استئوپروز مهره‌ای در AS بیمار را مستعد شکستگی‌های مهره‌ای حتی با ضربه ملایم می‌سازد.",
                "یووئیت قدامی نیازمند درمان فوری با قطره‌های استروئیدی و مایدراتیک جهت جلوگیری از چسبندگی عنبیه است.",
                "انتزیت محل اتصال تاندون آشیل و فاسیای پلانتار در بیش از یک‌سوم بیماران دیده می‌شود.",
                "بیماری بهجت برعکس AS کانون اصلی یووئیت خلفی و پان‌یووئیت با واژینیت رتینال است."
            ],
            "points_en": [
                "Early vertebral trabecular osteoporosis in AS substantially elevates the vulnerability to traumatic spinal fractures.",
                "Urgent ophthalmologic instillation of topical corticosteroids and cycloplegics averts permanent posterior synechiae.",
                "Calcaneal Achilles and plantar fascial enthesitis affects over one-third of spondyloarthritis patients.",
                "Behcet's syndrome represents the quintessential prototype for destructive posterior uveitis and retinal vasculitis."
            ]
        }
    },
    190: {
        "ci": 0,
        "whys": [
            "صحیح است؛ در یک بیمار با اسهال حاد آبکی همراه با تب (T=38°C) که نشان‌دهنده انتروکولیت باکتریایی مهاجم احتمالی است و در شرایطی که بیمار اصرار به دریافت درمان دارویی اختصاصی در همین مرحله دارد، درمان تجربی استاندارد «تجویز یک دوره کوتاه فلوروکینولون خوراکی نظیر سیپروفلوکساسین (Ciprofloxacin ۵۰۰ میلی‌گرم دو بار در روز به مدت ۳ تا ۵ روز)» جهت مهار عفونت باکتریایی و کاهش طول مدت اسهال است.",
            "نادرست است؛ دلیل رد: مصرف داروی ضدحرکت لوپرامید در اسهال‌های حاد تب‌دار یا مهاجم به دلیل خطر توکسیک مگاکولون و مهار دفع پاتوژن ممنوع است.",
            "نادرست است؛ دلیل رد: در دهیدراتاسیون خفیف نیازی به سرم‌تراپی وریدی نیست و هیدراسیون خوراکی (ORS) کافی است.",
            "نادرست است؛ دلیل رد: بررسی مدفوع در اسهال حاد کمتر از ۴۸ ساعت اقدام درمانی فوری محسوب نمی‌شود."
        ],
        "exp": "در اسهال حاد همراه با تب با اصرار بیمار به درمان دارویی، آنتی‌بیوتیک تجربی فلوروکینولون (سیپروفلوکساسین) درمان انتخابی است.",
        "micro": {
            "lead_fa": "در رویکرد به اسهال حاد عفونی، درمان پایه‌ای همواره جایگزینی آب و الکترولیت‌ها با پودر ORS است. در صورتی که اسهال با تب (دمای ۳۸ درجه یا بالاتر)، علائم خونی، مدفوع بیش از ۶ بار در روز، یا اصرار بیمار همراه باشد، درمان ضدباکتری تجربی با یک فلوروکینولون خوراکی نظیر سیپروفلوکساسین به مدت ۳ روز دوره بیماری را به نصف کاهش می‌دهد. داروهای مهارکننده حرکات روده نظیر لوپرامید در اسهال‌های تب‌دار اکیداً ممنوع هستند.",
            "lead_en": "Management of acute infectious diarrhea fundamentally centers on oral rehydration therapy. When fever (≥38°C), systemic toxicity, or severe dysentery is present and targeted intervention is pursued, empiric antimicrobial therapy with an oral fluoroquinolone (ciprofloxacin 500 mg twice daily for 3 days) accelerates clearance and reduces symptom duration. Motility-inhibiting agents (loperamide) are contraindicated in febrile enteritis.",
            "golden_fa": "اسهال حاد همراه با تب (T=38) با اصرار بیمار به درمان = تجویز سیپروفلوکساسین؛ لوپرامید در اسهال تب‌دار ممنوع است.",
            "golden_en": "Acute febrile diarrhea (T=38) requesting treatment = ciprofloxacin; loperamide is contraindicated in febrile diarrhea.",
            "points_fa": [
                "لوپرامید در اسهال‌های باکتریایی تب‌دار یا خونی خطر تکثیر باکتری و باکتریمی را بالا می‌برد.",
                "آزیترومایسین در مناطقی با مقاومت بالای فلوروکینولون‌ها جایگزین سیپروفلوکساسین می‌شود.",
                "درمان دهیدراتاسیون خفیف با مایعات خوراکی محتوی گلوکز و الکترولیت به تنهایی کافی است.",
                "کشت مدفوع برای اسهال‌های طول‌کشیده بالای ۷ تا ۱۴ روز یا در بیماران دچار نقص ایمنی اندیکاسیون دارد."
            ],
            "points_en": [
                "Loperamide delays pathogen clearance and provokes toxic megacolon when prescribed during invasive bacterial enteritis.",
                "Azithromycin serves as the preferred first-line alternative in regions with high Campylobacter fluoroquinolone resistance.",
                "Mild dehydration is optimally managed with oral rehydration salts (ORS), bypassing unnecessary intravenous lines.",
                "Stool culture and parasite microscopy are indicated for persistent symptoms (>7-14 days) or immunocompromised hosts."
            ]
        }
    },
    191: {
        "ci": 0,
        "whys": [
            "صحیح است؛ در تست محرومیت از آب (Water Deprivation Test)، اسمولاریته ادرار بیمار پس از ساعت‌ها دهیدراتاسیون تغلیظ نشد (تنها از ۲۲۰ به ۲۳۰ رسید که کمتر از ۳۰۰ mOsm/kg است)؛ اما پس از تجویز هورمون دسموپرسین خارجی (DDAVP)، اسمولاریته ادرار با افزایش چشمگیر «بیش از ۱۸۰ درصد (از ۲۳۰ به ۶۵۰ mOsm/kg یعنی بیش از ۵۰٪ افزایش)» غلیظ گردید؛ این پاسخ تشخیصی قطعی و پاتوگنومونیک «دیابت بی‌مزه مرکزی کامل (Complete Central Diabetes Insipidus)» است که فقدان ترشح وازوپرسین از هیپوفیز خلفی را اثبات می‌نماید.",
            "نادرست است؛ دلیل رد: در دیابت بی‌مزه نفروژنیک نسبی، پاسخ به DDAVP کمتر از ۵۰ درصد (بین ۱۰ تا ۴۵ درصد) است.",
            "نادرست است؛ دلیل رد: در دیابت بی‌مزه نفروژنیک کامل، کلیه به دسموپرسین پاسخ نمی‌دهد و افزایش اسمولاریته کمتر از ۹ تا ۱۰ درصد است.",
            "نادرست است؛ دلیل رد: در پرنوشی اولیه (پلی‌دیپسی)، اسمولاریته ادرار صرفاً با محرومیت از آب به بالای ۶۰۰ تا ۷۵۰ می‌رسد."
        ],
        "exp": "عدم تغلیظ ادرار با تشنگی و افزایش بیش از ۵۰ درصدی اسمولاریته ادرار با دسموپرسین، مشخصه دیابت بی‌مزه مرکزی کامل است.",
        "micro": {
            "lead_fa": "تست محرومیت از آب تست استاندارد افتراق علل سندرم پرادراری هیپواسمولار است. تفسیر پاسخ به وازوپرسین اگزوژن (DDAVP): ۱) در دیابت بی‌مزه مرکزی کامل: اسمولاریته ادرار در محرومیت زیر ۳۰۰ باقی مانده و پس از تزریق DDAVP بیش از ۵۰ درصد (معمولاً بالای ۱۰۰ تا ۲۰۰ درصد) جهش می‌کند؛ ۲) در دیابت بی‌مزه نفروژنیک کامل: افزایش اسمولاریته پس از DDAVP کمتر از ۹ تا ۱۰ درصد است؛ ۳) در پلی‌دیپسی اولیه: اسمولاریته ادرار در فاز محرومیت از آب به بالای ۵۰۰ تا ۶۰۰ می‌رسد.",
            "lead_en": "The water deprivation test reliably dissects polyuric syndromes. Complete central diabetes insipidus is verified when prolonged dehydration fails to concentrate urine (<300 mOsm/kg), followed by a dramatic >50% (here >180%) surge in urine osmolality surpassing 600 mOsm/kg following desmopressin (DDAVP) administration, confirming intact renal tubular sensitivity in the face of hypothalamic ADH deficiency.",
            "golden_fa": "تست تشنگی: عدم غلیظ شدن ادرار با تشنگی + افزایش > ۵۰٪ با DDAVP = دیابت بی‌مزه مرکزی کامل.",
            "golden_en": "Water deprivation: failure to concentrate with thirst + >50% increase after DDAVP = complete central DI.",
            "points_fa": [
                "درمان انتخابی دیابت بی‌مزه مرکزی تجویز دسموپرسین (DDAVP) به صورت اسپری بینی یا قرص خوراکی است.",
                "ام‌آر‌آی هیپوفیز با کنتراست جهت بررسی تومور، گرانولوم، تروما یا هیپوفیزیت لنفوسیتی انجام می‌گیرد.",
                "نبود سیگنال طبیعی روشن هیپوفیز خلفی (Loss of posterior pituitary bright spot) در MRI تیپیک است.",
                "در دیابت بی‌مزه نفروژنیک هیدروکلروتیازید، آمیلوراید و ایندومتاسین درمان‌های دارویی هستند."
            ],
            "points_en": [
                "Desmopressin (DDAVP) administered intranasally or orally represents the definitive long-term maintenance therapy.",
                "Contrast-enhanced sellar MRI is mandatory to evaluate for craniopharyngioma, infundibular thickening, or granulomas.",
                "Loss of the normal hyperintense T1 posterior pituitary 'bright spot' on MRI is a classic hallmark of central DI.",
                "Nephrogenic diabetes insipidus responds to low-sodium diet, thiazide diuretics, amiloride, and indomethacin."
            ]
        }
    },
    192: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: انجام MRI هیپوفیز برای بررسی آدنوم یا نارسایی هیپوفیز اقدامی ضروری و صحیح است.",
            "صحیح است (اقدامی که در این مرحله نادرست و خطرناک است)؛ در این بیمار با کم‌کاری تیروئید مرکزی (T4 و T3 به شدت پایین با TSH نامتناسب و آمنوره همراه)، «شروع کورکورانه لووتیروکسین قبل از بررسی محور آدرنال» به شدت ممنوع و خطرناک است؛ زیرا در صورت وجود نارسایی ثانویه آدرنال همزمان ناشی از نارسایی هیپوفیز (هیپوپیتوئیتاریسم)، تجویز لووتیروکسین کلیرانس متابولیک کورتیزول را بالا برده و بیمار را وارد یک «بحران آدرنال حاد کشنده» می‌کند؛ درمان با هیدروکورتیزون باید بر تیروکسین تقدم داشته باشد.",
            "نادرست است؛ دلیل رد: بررسی سایر محورهای هیپوفیز (کورتیزول، ACTH، پرولاکتین) اقدام حیاتی بعدی است.",
            "نادرست است؛ دلیل رد: تکرار تست‌های تیروئید برای تأیید نتایج اقدامی مناسب است."
        ],
        "exp": "در کم‌کاری تیروئید مرکزی ناشی از نارسایی هیپوفیز، شروع لووتیروکسین قبل از رد نارسایی آدرنال می‌تواند کریز کشنده آدرنال القا کند.",
        "micro": {
            "lead_fa": "سطوح پایین T4 و T3 همراه با TSH که به صورت نامتناسب طبیعی یا مختصراً بالا است (TSH=6 در برابر T4=3) در بیماری با آمنوره نشانه نارسایی هیپوفیز (کم‌کاری تیروئید مرکزی/ثانویه) است. یک اصل مرگ‌وزندگی در غدد: شروع هورمون تیروئید متابولیسم پایه را بالا برده و کاتابولیسم کبدی کورتیزول را تسریع می‌کند؛ اگر بیمار نارسایی آدرنال همزمان داشته باشد، تجویز لووتیروکسین بحران آدرنال فوری و کلاپس گردش خون ایجاد می‌کند. ابتدا باید محور آدرنال بررسی و با کورتون پوشش داده شود.",
            "lead_en": "Concurrently depressed free T4 alongside an inappropriately normal or minimally elevated TSH in a patient with secondary amenorrhea diagnoses central (secondary) hypothyroidism. Blindly initiating levothyroxine prior to assessing the hypothalamic-pituitary-adrenal axis is catastrophic; accelerating cortisol metabolism in unmasked secondary adrenal insufficiency precipitates fatal adrenal collapse.",
            "golden_fa": "کم‌کاری تیروئید مرکزی: ابتدا رد نارسایی آدرنال و تجویز هیدروکورتیزون؛ شروع مستقیم لووتیروکسین ممنوع است.",
            "golden_en": "Central hypothyroidism: evaluate adrenal axis first; initiating levothyroxine before corticosteroids is contraindicated.",
            "points_fa": [
                "بررسی محور آدرنال با اندازه‌گیری کورتیزول صبحگاهی و تست تحریک ACTH انجام می‌شود.",
                "ام‌آر‌آی هیپوفیز با تزریق گادولینیوم ماکروآدنوم‌ها یا سندرم زین ترکی خالی را مشخص می‌سازد.",
                "پایش درمان کم‌کاری مرکزی تیروئید صرفاً بر اساس FT4 است زیرا TSH بی‌ارزش است.",
                "درمان جایگزینی با هیدروکورتیزون باید حداقل چند روز قبل از شروع لووتیروکسین آغاز گردد."
            ],
            "points_en": [
                "Adrenal integrity is evaluated via morning serum cortisol and cosyntropin (ACTH) stimulation testing.",
                "Dedicated pituitary MRI with gadolinium visualizes sellar adenomas, empty sella, or infiltrative hypophysitis.",
                "Therapeutic titration in central hypothyroidism relies exclusively on free T4 targets, as TSH is non-informative.",
                "Corticosteroid replacement must precede levothyroxine administration by several days to ensure safety."
            ]
        }
    },
    193: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: چاقی تنه (کوپ چربی) عارضه ۶ ماه مصرف قبلی کورتیکواستروئید است و در بیمار وجود دارد.",
            "صحیح است (علامتی که در این بیمار بسیار کمتر محتمل است)؛ بیمار دچار «نارسایی ثانویه قشر آدرنال به دنبال قطع ناگهانی کورتیکواستروئید (Steroid-induced secondary adrenal insufficiency)» شده است؛ در این وضعیت، ترشح هورمون ACTH از هیپوفیز به شدت سرکوب شده است؛ بنابراین «هیپرپیگمانتاسیون پوست و مخاط (که ناشی از ترشح مقادیر بالای ACTH و پپتید MSH در بیماری آدیسون اولیه است) در نارسایی ثانویه هرگز رخ نمی‌دهد و دیده نمی‌شود».",
            "نادرست است؛ دلیل رد: استریای ارغوانی جلد ناشی از ۶ ماه مصرف کورتون با دوز بالا است و در بیمار دیده می‌شود.",
            "نادرست است؛ دلیل رد: کاهش فشار خون ناشی از کمبود حاد گلوکوکورتیکوئید پس از قطع ناگهانی دارو تظاهر شایع است."
        ],
        "exp": "هیپرپیگمانتاسیون پوست و مخاط فقط در نارسایی اولیه آدرنال (آدیسون) دیده می‌شود و در نارسایی ثانویه پس از قطع کورتون غایب است.",
        "micro": {
            "lead_fa": "مصرف مزمن گلوکوکورتیکوئیدها (بیش از ۳ تا ۴ هفته) با مهار فیدبکی قوی، محور هیپوتالاموس-هیپوفیز-آدرنال (HPA) را سرکوب می‌کند. قطع ناگهانی دارو بیمار را دچار بحران نارسایی ثانویه آدرنال می‌سازد. افتراق حیاتی نارسایی اولیه آدرنال (آدیسون) از نارسایی ثانویه: در نارسایی ثانویه سطح ACTH به شدت پایین است، لذا هیپرپیگمانتاسیون مخاطی وجود ندارد. علاوه بر این، محور رنین-آلدوسترون در نارسایی ثانویه سالم می‌ماند، لذا هایپرکالمی شدید رخ نمی‌دهد.",
            "lead_en": "Prolonged exogenous corticosteroid administration suppresses endogenous CRH and ACTH release. Abrupt cessation unmasks secondary adrenal insufficiency. A cardinal distinguishing feature separating primary from secondary adrenal failure is cutaneous hyperpigmentation; because circulating ACTH is profoundly suppressed rather than elevated in secondary disease, hyperpigmentation is characteristically absent.",
            "golden_fa": "در نارسایی ثانویه آدرنال ناشی از قطع کورتون: ACTH پایین است، لذا هیپرپیگمانتاسیون پوست و مخاط هرگز دیده نمی‌شود.",
            "golden_en": "Secondary adrenal insufficiency due to steroid withdrawal: low ACTH precludes mucosal hyperpigmentation.",
            "points_fa": [
                "بیمار علائم ظاهری کوشینگویید (چاقی تنه، استریا) ناشی از مصرف قبلی را همراه با علائم کریز حاد دارد.",
                "درمان فوری شامل هیدراتاسیون وریدی با سرم قندی-نمکی و تزریق وریدی هیدروکورتیزون است.",
                "قطع کورتون در مصرف بیش از ۳ هفته باید همواره به صورت تیپرینگ تدریجی چندماهه انجام گیرد.",
                "مینرالوکورتیکوئید (فلودروکورتیزون) در نارسایی ثانویه آدرنال نیازی به تجویز ندارد."
            ],
            "points_en": [
                "The patient exhibits cushingoid stigmata (truncal obesity, striae) paradoxical to concurrent acute hypocortisolemic crisis.",
                "Immediate resuscitation dictates intravenous dextrose-saline infusion and stress-dose intravenous hydrocortisone.",
                "Glucocorticoid withdrawal exceeding 3 weeks duration mandates a protracted, gradual dose-tapering schedule.",
                "Mineralocorticoid replacement (fludrocortisone) is unnecessary in secondary insufficiency as aldosterone is preserved."
            ]
        }
    },
    194: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: آرتریوگرافی شریانی است و برای ارزیابی ترومبوز وریدی کاربردی ندارد.",
            "نادرست است؛ دلیل رد: پیلوگرافی داخل وریدی (IVP) یک روش قدیمی با حساسیت ضعیف است و در ترومبوز وریدی روش انتخابی نیست.",
            "صحیح است؛ در یک بیمار جوان مبتلا به سندرم نفروتیک شدید (پروتئینوری ۵/۵ گرم و آلبومین ۱/۹) که به طور ناگهانی دچار درد شدید پهلو (Flank pain) و هماچوری ماکروسکوپیک گراس شده است، تشخیص محتمل و اورژانس «ترومبوز حاد ورید کلیوی (Renal Vein Thrombosis / RVT)» است؛ با توجه به اینکه سونوگرافی اولیه نرمال بوده و منفی کاذب دارد، روش تصویربرداری استاندارد، دقیق و با بالاترین اولویت برای اثبات قطعی وجود ترومبوز «سی‌تی ونوگرافی کلیه با کنتراست (CT Venography)» (یا MRI ونوگرافی) است.",
            "نادرست است؛ دلیل رد: سی‌تی روتین شکم فاز عروقی اختصاصی وریدی را برای کشف نقص پرشدگی ورید کلیه نشان نمی‌دهد."
        ],
        "exp": "درد ناگهانی پهلو و هماچوری در سندرم نفروتیک نشانه ترومبوز ورید کلیه (RVT) است و سی‌تی ونوگرافی روش تشخیصی اولویت‌دار است.",
        "micro": {
            "lead_fa": "ترومبوز ورید کلیوی (RVT) خطرناک‌ترین عارضه ترومبوتیک سندرم نفروتیک به ویژه با آلبومین زیر ۲ گرم در دسی‌لیتر است. تظاهر حاد با درد ناگهانی پهلو، هماچوری آشکار، پروتئینوری تشدیدیافته و کاهش سریع GFR مشخص می‌شود. سونوگرافی داپلر در مراحل اولیه ممکن است طبیعی باشد. سی‌تی ونوگرافی با ماده کنتراست روش تشخیصی انتخابی استاندارد طلایی است که نقص پرشدگی ناشی از لخته در ورید رنال و امتداد آن به ورید اجوف تحتانی (IVC) را با دقت بالا نشان می‌دهد.",
            "lead_en": "Acute renal vein thrombosis (RVT) is a catastrophic complication of severe nephrotic syndrome driven by urinary antithrombin III depletion. Classic presentation combines acute flank pain, macroscopic hematuria, and deteriorating renal clearance. Contrast-enhanced CT venography represents the definitive imaging modality of choice, delineating intraluminal filling defects.",
            "golden_fa": "سندرم نفروتیک + درد ناگهانی پهلو و هماچوری = ترومبوز ورید کلیوی (RVT)؛ اقدام تشخیصی با بالاترین اولویت: CT ونوگرافی.",
            "golden_en": "Nephrotic syndrome + acute flank pain and gross hematuria = renal vein thrombosis; priority diagnostic test: CT venography.",
            "points_fa": [
                "شروع فوری درمان ضدانعقادی با هپارین وریدی و سپس وارفارین بقای ارگان کلیه را نجات می‌دهد.",
                "نفروپاتی ممبرانوس بالاترین استعداد را برای ایجاد ترومبوز ورید کلیه در میان تمام علل دارد.",
                "در صورت امتداد لخته به ورید اجوف تحتانی خطر آمبولی ریوی کشنده به شدت افزایش می‌یابد.",
                "در بیماران با نارسایی شدید کلیوی MR ونوگرافی بدون گادولینیوم برای پیشگیری از نفروپاتی کنتراست ارجح است."
            ],
            "points_en": [
                "Immediate systemic anticoagulation with intravenous heparin transitioning to oral warfarin prevents renal infarction.",
                "Membranous nephropathy confers the highest susceptibility to RVT among all nephrotic glomerular diseases.",
                "Thrombus extension into the inferior vena cava substantially elevates the peril of fatal pulmonary embolism.",
                "In severe renal impairment, non-contrast magnetic resonance venography avoids contrast-induced acute nephropathy."
            ]
        }
    },
    195: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: مسمومیت با متانول به علت تجمع اسید فرمیک اسیدوز با آنیون گپ بالا (High AG) ایجاد می‌کند.",
            "نادرست است؛ دلیل رد: کتواسیدوز دیابتی (DKA) به دلیل تولید بتاهیدروکسی‌بوتیرات و استواستات اسیدوز High AG کلاسیک است.",
            "نادرست است؛ دلیل رد: مسمومیت با اتیلن گلیکول با تولید اسید گلیکولیک و اگزالیک اسیدوز High AG ایجاد می‌کند.",
            "صحیح است (بیماری‌ای که آنیون گپ بالا نمی‌دهد)؛ «اسهال شدید (Severe Diarrhea)» به علت دفع مقادیر فراوان بی‌کربنات (HCO3) و مایعات غنی از ترشحات روده‌ای، موجب بروز «اسیدوز متابولیک با آنیون گپ طبیعی (Normal Anion Gap / Hyperchloremic Metabolic Acidosis)» می‌گردد؛ زیرا با دفع یون بی‌کربنات، یون کلر (Cl) بازجذب شده و آنیون گپ سرم در محدوده نرمال ۱۰ تا ۱۲ باقی می‌ماند."
        ],
        "exp": "اسهال با دفع مستقیم بی‌کربنات، اسیدوز متابولیک با آنیون گپ نرمال (هایپرکلرمیک) ایجاد می‌کند نه آنیون گپ بالا.",
        "micro": {
            "lead_fa": "اسیدوز متابولیک با محاسبه آنیون گپ [AG = Na - (Cl + HCO3)] به دو گروه بنیادین تقسیم می‌شود: ۱) اسیدوز با آنیون گپ بالا (High AG بالای ۱۲) با فرمول GOLDMARK شامل متانول، اورمی، DKA، پروپیلن گلیکول، لاکتات، اتیلن گلیکول و سالیسیلات؛ ۲) اسیدوز با آنیون گپ طبیعی (هایپرکلرمیک Normal AG) که به دلیل از دست رفتن مستقیم بی‌کربنات از دستگاه گوارش (اسهال شدید، فیستول انتروکوتانئوس) یا ناتوانی کلیه در بازجذب بی‌کربنات و دفع اسید (RTA) ایجاد می‌شود.",
            "lead_en": "Metabolic acidosis classifies fundamentally via serum anion gap [Na - (Cl + HCO3)]. High anion gap (>12 mEq/L) acidoses stem from unmeasured fixed acid accumulation (ketoacidosis, lactic acidosis, methanol, ethylene glycol). Conversely, severe osmotic or secretory diarrhea causes pure gastrointestinal bicarbonate loss, replaced stoichiometrically by chloride to produce a normal anion gap (hyperchloremic) metabolic acidosis.",
            "golden_fa": "علل اسیدوز متابولیک آنیون گپ بالا: DKA، متانول، اتیلن گلیکول؛ اسهال اسیدوز با آنیون گپ طبیعی (هایپرکلرمیک) می‌دهد.",
            "golden_en": "High anion gap acidosis: DKA, methanol, ethylene glycol; diarrhea causes normal anion gap (hyperchloremic) acidosis.",
            "points_fa": [
                "آنیون گپ طبیعی سرم بین ۸ تا ۱۲ میلی‌اکی‌والان در لیتر است.",
                "در اسهال همراه با افت بی‌کربنات، کلر سرم بالا می‌رود تا خنثایی الکتریکی حفظ شود.",
                "اسیدوز توبولار کلیوی (RTA) دومین علت شایع اسیدوز متابولیک با آنیون گپ طبیعی است.",
                "آنیون گپ ادراری (Urine Anion Gap) برای افتراق اسهال از RTA به کار می‌رود."
            ],
            "points_en": [
                "Normal physiological serum anion gap ranges between 8 and 12 mEq/L, predominantly governed by albumin.",
                "Diarrheal bicarbonate wasting triggers reciprocal proximal tubular chloride retention, preserving electroneutrality.",
                "Renal tubular acidosis (RTA) represents the principal renal etiology yielding a normal anion gap acidosis.",
                "Negative urine anion gap [Na + K - Cl] confirms intact ammonium excretion characteristic of gastrointestinal diarrhea."
            ]
        }
    },
    196: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: استفراغ دهیدراتاسیون و هایپوولمی با کاهش فشار خون و سدیم ادراری پایین زیر ۲۰ ایجاد می‌کند.",
            "نادرست است؛ دلیل رد: بیماری آدیسون با هایپوولمی، کاهش فشار خون و هایپرکالمی همراه است در حالی که بیمار نرموتانسیو و نورموکالمیک است.",
            "صحیح است؛ در یک بیمار با هیپوناترمی هیپواسمولار واقعی (سدیم ۱۲۵، اسمولاریته پلاسما ۲۶۰) که از نظر بالینی یوولمیک (Euvolemic با فشار خون کاملاً نرمال و بدون ادم) است، همراه با «اسمولاریته ادرار به شدت تغلیظ‌شده (Urine Osm=660 که بیش از ۱۰۰ است)، سدیم ادراری بالا (Urine Na=50 که بیش از ۳۰-۴۰ است) و اسید اوریک پایین سرم (Uric acid=3)»، معیارهای کلاسیک و قطعی «سندرم ترشح نامتناسب هورمون ضدادراری (SIADH)» برقرار است.",
            "نادرست است؛ دلیل رد: هایپرلیپیدمی شدید هیپوناترمی کاذب با اسمولاریته سرمی نرمال ایجاد می‌کند."
        ],
        "exp": "هیپوناترمی یوولمیک، ادرار غلیظ (اسمولاریته ۶۶۰)، سدیم ادرار بالای ۳۰ و اسید اوریک پایین، تابلوی پاتوگنومونیک SIADH است.",
        "micro": {
            "lead_fa": "سندرم ترشح نامتناسب هورمون ضدادراری (SIADH) شایع‌ترین علت هیپوناترمی یوولمیک در بیماران بستری است. معیارهای تشخیصی استاندارد: ۱) هیپوناترمی هیپواسموتیک حقیقی (پلاسما زیر ۲۷۵)؛ ۲) وضعیت حجم درون‌عروقی طبیعی (Euvolemia بدون ادم یا دهیدراتاسیون)؛ ۳) تغلیظ نامتناسب ادرار (اسمولاریته ادرار > ۱۰۰)؛ ۴) ترشح مداوم سدیم در ادرار (Urine Na > 30-40)؛ ۵) اسید اوریک سرم پایین (زیر ۴) و BUN پایین؛ ۶) کارکرد طبیعی تیروئید و آدرنال.",
            "lead_en": "The syndrome of inappropriate antidiuretic hormone secretion (SIADH) is the prototypical etiology of euvolemic hypoosmolar hyponatremia. Diagnostic criteria mandate: true hypoosmolality (plasma Osm <275 mOsm/kg), clinical euvolemia (normal BP, absence of edema), inappropriate urine concentration (urine Osm >100 mOsm/kg), natriuresis (urine Na >30-40 mEq/L), hypouricemia, and intact adrenal/thyroid function.",
            "golden_fa": "هیپوناترمی یوولمیک + اسمولاریته ادرار بالا (> ۱۰۰) + سدیم ادرار > ۳۰ و اسید اوریک پایین = SIADH.",
            "golden_en": "Euvolemic hyponatremia + concentrated urine (>100) + high urine sodium (>30) + hypouricemia = SIADH.",
            "points_fa": [
                "درمان خط اول در SIADH علامت‌دار ملایم یا بدون علامت محدودیت مصرف آب (کمتر از ۸۰۰ تا ۱۰۰۰ میلی‌لیتر در روز) است.",
                "در صورت وجود علائم شدید عصبی (تشنج یا کما) تزریق سرم سالین هیپرتونیک ۳٪ اندیکاسیون فوری دارد.",
                "سرعت اصلاح سدیم نباید از ۸ میلی‌اکی‌والان در ۲۴ ساعت فراتر رود تا از میلینولیز مرکزی پل مغزی (CPM) پیشگیری شود.",
                "آنتاگونیست‌های گیرنده وازوپرسین (تولواپتان) در موارد مقاوم به کار می‌روند."
            ],
            "points_en": [
                "First-line standard of care for asymptomatic or mild SIADH is strict fluid restriction (<800-1,000 mL/day).",
                "Severe neuroglycopenic manifestations (seizures, stupor) necessitate emergent 3% hypertonic saline infusion.",
                "Sodium correction velocity must never exceed 8 mEq/L in 24 hours to avert catastrophic central pontine myelinolysis.",
                "Vasopressin V2 receptor antagonists (vaptans) promote pure aquaresis in refractory inpatient presentations."
            ]
        }
    },
    197: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: سندرم بارتر بیماری توبولی شبیه اثر دیورتیک لوپ با هایپوکالمی است اما فشار خون نرمال یا پایین دارد نه ۱۶۰/۹۰.",
            "نادرست است؛ دلیل رد: اسهال مزمن موجب کاهش حجم، دهیدراتاسیون و اسیدوز متابولیک با آنیون گپ نرمال می‌شود نه آلکالوز و هایپرتانسیون.",
            "صحیح است؛ تابلوی جوان با پرفشاری خون شریانی قابل توجه (BP=160/90)، هایپوکالمی شدید (K=2.8) با ضعف عضلانی، و آلکالوز متابولیک (pH=7.54, HCO3=30)، نشان‌دهنده یک سندرم ترشح یا اثر بیش از حد مینرالوکورتیکوئید است؛ در میان گزینه‌ها «سندرم لیدل (Liddle's Syndrome)» یک اختلال ژنتیکی اتوزومال غالب ناشی از جهش فعال‌کننده ساب‌یونیت‌های کانال سدیمی اپیتلیال (ENaC) در توبول جمع‌کننده کلیه است که دقیقاً این تابلوی بالینی (پرفشاری خون، هیپوکالمی و آلکالوز متابولیک همراه با رنین و آلدوسترون سرکوب‌شده) را ایجاد می‌نماید.",
            "نادرست است؛ دلیل رد: فلج دوره‌ای هیپوکالمیک ناشی از شیفت درون‌سلولی حاد پتاسیم است و پرفشاری خون و آلکالوز مزمن ایجاد نمی‌کند."
        ],
        "exp": "سندرم لیدل ناشی از بیش‌فعالی کانال ENaC است و با پرفشاری خون، هایپوکالمی شدید و آلکالوز متابولیک تظاهر می‌یابد.",
        "micro": {
            "lead_fa": "سندرم لیدل (Liddle syndrome) یک شبه‌آلدوسترونیسم کاذب اتوزومال غالب ناشی از جهش در زیرواحدهای بتا یا گامای کانال سدیمی ENaC است که مانع از تخریب آن توسط پروتئازها می‌شود. بازجذب کنترل‌نشده سدیم در توبول دیستال منجر به اتساع حجم، هایپرتانسیون شدید و ترشح اجباری پتاسیم و هیدروژن در ادرار (هایپوکالمی شدید و آلکالوز متابولیک) می‌شود. ویژگی بیوشیمیایی شاخص سرکوب کامل هر دو سطح رنین و آلدوسترون است. درمان انتخابی آمیلوراید یا تریامترن است.",
            "lead_en": "Liddle's syndrome is a rare autosomal dominant monogenic hypertensive disorder stemming from gain-of-function mutations within epithelial sodium channel (ENaC) subunits, preventing ubiquitin-mediated degradation. Unchecked distal sodium reabsorption mimics hyperaldosteronism, provoking severe early-onset hypertension, hypokalemia, and metabolic alkalosis, but with suppressed renin and aldosterone. Amiloride is curative.",
            "golden_fa": "فشار خون بالا + هایپوکالمی و آلکالوز متابولیک در فرد جوان = سندرم لیدل؛ درمان: مسدودکننده ENaC (آمیلوراید).",
            "golden_en": "Hypertension + hypokalemia and metabolic alkalosis in a young adult = Liddle's syndrome; treatment: amiloride.",
            "points_fa": [
                "اسپیرونولاکتون در سندرم لیدل بی‌اثر است زیرا این بیماری وابسته به گیرنده مینرالوکورتیکوئید نیست.",
                "داروهای مسدودکننده مستقیم ENaC شامل آمیلوراید و تریامترن درمان قطعی و مؤثر هستند.",
                "سندرم بارتر و گیتلمن علائم مشابه هایپوکالمی دارند اما فشار خون در آن‌ها همواره پایین یا نرمال است.",
                "سطح رنین پلاسما و آلدوسترون پلاسما در سندرم لیدل هر دو پایین و سرکوب‌شده هستند."
            ],
            "points_en": [
                "Spironolactone is entirely ineffective in Liddle's syndrome because pathogenesis is independent of the aldosterone receptor.",
                "Direct pharmacological ENaC antagonists (amiloride or triamterene) successfully correct hypertension and kaliuresis.",
                "Bartter and Gitelman syndromes share hypokalemic metabolic alkalosis but feature normal to low blood pressure.",
                "Suppressed plasma renin activity alongside undetectable plasma aldosterone establishes low-renin pseudoaldosteronism."
            ]
        }
    },
    198: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: مولتیپل میلوم بیشتر با پروتئینوری بنس جونز، نارسایی کلیه و زنجیره سبک تظاهر می‌کند نه سندرم نفروتیک اولیه پستان.",
            "نادرست است؛ دلیل رد: FSGS همراهی اختصاصی با تومورهای توپر ندارد.",
            "نادرست است؛ دلیل رد: نفروپاتی IgA با هماچوری و پروتئینوری ملایم دیده می‌شود نه سندرم نفروتیک ۸ گرمی پارانئوپلاستیک.",
            "صحیح است؛ در بیماران مبتلا به تومورهای توپر بدخیم (Solid Tumors نظیر کارسینوم پستان، ریه، کولون و معده) که دچار سندرم نفروتیک شدید (دفع پروتئین ادرار ۸ گرم در روز) می‌شوند، شایع‌ترین، کلاسیک‌ترین و قطعی‌ترین علت گلومرولوپاتی پارانئوپلاستیک «نفروپاتی غشایی (Membranous Nephropathy / MGN)» (در بیش از ۷۰ تا ۸۰ درصد موارد گلومرولوپاتی‌های توموری) ناشی از رسوب کمپلکس‌های ایمنی آنتی‌ژن توموری در زیر سلول‌های پودوسیت است."
        ],
        "exp": "نفروپاتی غشایی (Membranous Nephropathy) شایع‌ترین علت سندرم نفروتیک پارانئوپلاستیک در بدخیمی‌های توپر نظیر کانسر پستان است.",
        "micro": {
            "lead_fa": "سندرم نفروتیک پارانئوپلاستیک با بدخیمی‌های متعددی در ارتباط است. یک قانون هماتولوژی و انکولوژی کلیه: بدخیمی‌های توپر (Solid tumors نظیر کارسینوم پستان، ریه و دستگاه گوارش) به طور کلاسیک و غالب موجب نفروپاتی ممبرانوس (MGN) می‌شوند. در مقابل، بدخیمی‌های هماتولوژیک نظیر لنفوم هوچکین به طور تیپیک با بیماری با تغییرات حداقل (MCD) پیوند دارند. در بیماران بالای ۵۰ سال مبتلا به MGN آنتی‌بادی PLA2R منفی، غربالگری بدخیمی مخفی الزامی است.",
            "lead_en": "Paraneoplastic nephrotic syndrome displays striking histological specificity. Carcinomas of solid organ origins (breast, lung, gastrointestinal tract, prostate) are overwhelmingly dominated by secondary membranous nephropathy (MGN), driven by subepithelial in situ immune-complex deposition. Hodgkin lymphoma conversely correlates with minimal change disease. Cancer screening is mandatory in PLA2R-negative adult MGN.",
            "golden_fa": "شایع‌ترین علت گلومرولی سندرم نفروتیک در بیماران مبتلا به تومورهای توپر (کانسر پستان/ریه) = نفروپاتی غشایی (MGN).",
            "golden_en": "Most common glomerular cause of nephrotic syndrome in solid malignancy (breast cancer) = membranous nephropathy (MGN).",
            "points_fa": [
                "در نفروپاتی ممبرانوس پارانئوپلاستیک، درمان موفق و برداشتن تومور بدخیم زمینه‌ای منجر به فروکش کامل سندرم نفروتیک می‌شود.",
                "آنتی‌بادی ضد گیرنده فسفولیپاز A2 (Anti-PLA2R) در فرم ایدیوپاتیک مثبت و در فرم ناشی از سرطان معمولاً منفی است.",
                "در بیوپسی کلیه ضخیم‌شدگی منتشر غشای پایه گلومرول همراه با سنبله‌های ساب‌اپیتلیال (Spikes) دیده می‌شود.",
                "لنفوم هوچکین کلاسیک‌ترین علت بیماری تغییرات حداقل (MCD) پارانئوپلاستیک است."
            ],
            "points_en": [
                "Successful resection or definitive chemoradiotherapy of the underlying primary neoplasm induces complete nephrotic remission.",
                "Circulating anti-PLA2R antibodies characterize primary idiopathic MGN; absence strongly prompts paraneoplastic investigation.",
                "Renal histopathology exhibits diffuse glomerular basement membrane thickening and subepithelial silver-positive spikes.",
                "Hodgkin lymphoma represents the classical neoplastic counterpart generating paraneoplastic minimal change disease."
            ]
        }
    },
    199: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: در پلی‌دیپسی اولیه (پرنوشی روانی) سدیم سرم نرمال یا رو به پایین (زیر ۱۳۷) است نه هایپرناترمی ۱۵۰.",
            "نادرست است؛ دلیل رد: دیابت قندی ادرار غلیظ پر از گلوکز با وزن مخصوص بالا (SG > 1.030) ایجاد می‌کند نه SG رقیق ۱۰۰۵.",
            "صحیح است؛ بروز پرادراری شدید با حجم ۴ لیتر در روز، همراه با ادرار بسیار رقیق و هیپواسمولار با وزن مخصوص پایین (SG=1005) و مشاهده «هایپرناترمی سرمی (Na=150 mEq/L)»، تابلوی بالینی تیپیک و قطعی «دیابت بی‌مزه (Diabetes Insipidus / DI)» ناشی از کمبود ترشح یا مقاومت به هورمون وازوپرسین است؛ افتراق آن از پرنوشی اولیه با وجود هایپرناترمی (سدیم ۱۵۰) در دیابت بی‌مزه در برابر هایپوناترمی رقیق‌شدگی در پلی‌دیپسی مشخص می‌گردد.",
            "نادرست است؛ دلیل رد: مصرف تیازیدها به جای هایپرناترمی موجب هیپوناترمی و هیپوکالمی می‌شود."
        ],
        "exp": "پرادراری با ادرار رقیق (SG=1005) و هایپرناترمی (Na=150)، تابلوی پاتوگنومونیک دیابت بی‌مزه (Diabetes Insipidus) است.",
        "micro": {
            "lead_fa": "در ارزیابی سندرم پلی‌اوری (دفع ادرار بیش از ۳ لیتر در روز)، تفکیک دیورز محلول (دیابت قندی) از دیورز آب خالص (دیابت بی‌مزه و پلی‌دیپسی اولیه) اولین گام است. وزن مخصوص ادرار پایین (SG < 1.005) دیورز آب را اثبات می‌کند. در مرحله بعد، سطح سدیم سرم تفکیک‌کننده قطعی است: سطح سدیم بالا (Na > 145) نشانه نقص اولیه در دفع آب کلیوی و اثبات‌کننده دیابت بی‌مزه (مرکزی یا نفروژنیک) است، در حالی که در پرنوشی اولیه سدیم همواره زیر ۱۳۷ باقی می‌ماند.",
            "lead_en": "Diagnostic evaluation of a polyuric state (>3 L/24 hours) starts by measuring urine specific gravity; a low value (SG ≤1.005) unequivocally establishes water diuresis. Distinguishing diabetes insipidus from primary polydipsia hinges on serum sodium: hypernatremia (Na 150 mEq/L) unequivocally verifies diabetes insipidus, reflecting inability to concentrate urine, contrasting with dilutional low-normal sodium in polydipsia.",
            "golden_fa": "پلی‌اوری با ادرار رقیق (SG=1005) + سدیم بالای پلاسما (Na=150) = دیابت بی‌مزه (Diabetes Insipidus).",
            "golden_en": "Polyuria with dilute urine (SG 1005) + hypernatremia (Na 150) = diabetes insipidus (excludes primary polydipsia).",
            "points_fa": [
                "برای افتراق فرم مرکزی از نفروژنیک تست پاسخ به دسموپرسین (DDAVP) انجام می‌شود.",
                "در دیابت بی‌مزه مرکزی اسمولاریته ادرار بیش از ۵۰ درصد پس از دسموپرسین بالا می‌رود.",
                "درمان دیابت بی‌مزه مرکزی تجویز DDAVP به صورت اسپری بینی یا قرص است.",
                "محرومیت از آب در بیماری که از قبل دچار هایپرناترمی است ممنوع است زیرا به سرعت بیمار را وارد کما می‌کند."
            ],
            "points_en": [
                "Subtyping into central versus nephrogenic forms utilizes the standard desmopressin (DDAVP) challenge test.",
                "Complete central diabetes insipidus demonstrates >50% surge in urine osmolality following exogenous DDAVP.",
                "Maintenance therapy for central DI relies on synthetic DDAVP replacement via nasal spray or oral tablets.",
                "Water deprivation testing is strictly contraindicated when baseline hypernatremia (Na >145) is already established."
            ]
        }
    },
    200: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: ترک مصرف سیگار اساسی‌ترین و مهم‌ترین اقدام درمانی غیردارویی در پیشگیری از اسپاسم عروق کرونر است.",
            "صحیح است (درمانی که به هیچ وجه توصیه نمی‌شود و ممنوع است)؛ در بیماری با تشخیص آنژین وازواسپاستیک یا پرینزمتال (Prinzmetal / Vasospastic Angina) با عروق کرونر نرمال، تجویز «داروهای بتابلوکر (نظیر متوپرولول یا پروپرانولول)» اکیداً «ممنوع و کنترااندیکاسیون» دارد؛ زیرا مسدود کردن گیرنده‌های بتای عروق کرونر باعث تحریک مهارتشیافته گیرنده‌های آلفا-۱ آدرنرژیک شده و «اسپاسم عروق کرونر را به شدت تشدید کرده» و خطر انفارکتوس قلبی کشنده را به دنبال دارد.",
            "نادرست است؛ دلیل رد: نیترات‌های خوراکی طولانی‌اثر (نیتروکانتین) خط اول گشادکننده عروق کرونر در آنژین پرینزمتال هستند.",
            "نادرست است؛ دلیل رد: مسدودکننده‌های کانال کلسیم (دیلتیازم، وراپامیل، املودیپین) سنگ‌بنای خط اول درمان دارویی در پیشگیری از عود آنژین پرینزمتال هستند."
        ],
        "exp": "در آنژین وازواسپاستیک (پرینزمتال)، بتابلوکرها به علت تشدید اسپاسم عروق کرونر منع مصرف مطلق دارند.",
        "micro": {
            "lead_fa": "آنژین پرینزمتال (وازواسپاستیک) با درد شدید ایسکمیک سینه در حالت استراحت و ساعات صبحگاهی با صعود موقت ST در نوار قلب و عروق کرونر سالم در آنژیوگرافی مشخص می‌شود. سنگ‌بنای درمان مسدودکننده‌های کانال کلسیم (CCBها) همراه با نیترات‌های طولانی‌اثر است که اسپاسم عضله صاف را رفع می‌کنند. یک ممنوعیت مطلق بالینی: استفاده از بتابلوکرها (نظیر متوپرولول) کاملاً ممنوع است زیرا با مهار اتساع عروقی گیرنده بتا-۲، انقباض عروقی آلفا را تشدید می‌سازد.",
            "lead_en": "Prinzmetal's vasospastic angina features severe resting chest pain coupled with transient ST elevation in the setting of angiographically normal coronary arteries. First-line therapy relies on calcium channel blockers and long-acting nitrates. Beta-blockers (metoprolol) are strictly contraindicated; blocking beta-2 vasodilatory receptors leaves alpha-1-mediated vasoconstriction unopposed, precipitating fatal refractory coronary vasospasm.",
            "golden_fa": "آنژین وازواسپاستیک (پرینزمتال): درمان با کلسیم‌بلوکر و نیترات؛ بتابلوکرها به علت تشدید اسپاسم ممنوع هستند.",
            "golden_en": "Prinzmetal angina: treated with CCBs and nitrates; beta-blockers are strictly contraindicated due to worsening spasm.",
            "points_fa": [
                "دیلتیازم و وراپامیل از مؤثرترین داروهای پیشگیری از حملات اسپاسم عروق کرونر هستند.",
                "ترک کامل سیگار مهم‌ترین اقدام قابل اصلاح در جلوگیری از حوادث قلبی در این بیماران است.",
                "استاتین‌ها نیز به دلیل بهبود کارکرد اندوتلیال در پیشگیری از اسپاسم اثرات مفیدی نشان داده‌اند.",
                "در صورت مقاومت به یک کلسیم بلوکر، ترکیب دو داروی کلسیم بلوکر با کلاس متفاوت تجویز می‌شود."
            ],
            "points_en": [
                "Non-dihydropyridine calcium channel blockers (diltiazem, verapamil) demonstrate superior efficacy preventing vasospasm.",
                "Absolute smoking cessation is the mandatory lifestyle intervention eliminating the principal trigger of endothelial dysfunction.",
                "Statins provide beneficial adjunctive protection via endothelial nitric oxide synthase upregulation and Rho-kinase inhibition.",
                "Refractory vasospastic angina is managed by dual-class calcium channel blocker therapy (diltiazem plus amlodipine)."
            ]
        }
    },
    201: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: مهارکننده‌های آنزیم تبدیل‌کننده آنژیوتانسین (ACEIs) از داروهای اصلی خط اول درمان پرفشاری خون هستند.",
            "صحیح است (دارویی که جزء خط اول درمان فشار خون نیست)؛ بر اساس تمام دستورالعمل‌های بین‌المللی نوین کارگروه‌های تخصصی فشار خون (شامل JNC-8، راهنمای کالج کاردیولوژی آمریکا ACC/AHA و گایدلاین انجمن قلب اروپا ESC)، «مهارکننده‌های گیرنده بتا (Beta-Blockers)» در درمان فشار خون اولیه بدون عارضه «دیگر جزء داروهای خط اول محسوب نمی‌شوند»؛ زیرا در مقایسه با سایر داروها کارایی کمتری در کاهش مورتالیتی قلبی و سکته مغزی داشته‌اند؛ چهار دسته خط اول عبارتند از: دیورتیک‌های تیازیدی، مهارکننده‌های ACE، مسدودکننده‌های ARB و کلسیم چنل بلوکرها (CCBs).",
            "نادرست است؛ دلیل رد: مهارکننده‌های کانال کلسیم (CCBs) از داروهای استاندارد خط اول درمان فشار خون هستند.",
            "نادرست است؛ دلیل رد: دیورتیک‌های شبه‌تیازیدی و تیازیدی از داروهای ثابت‌شده خط اول در کاهش حوادث قلبی هستند."
        ],
        "exp": "طبق گایدلاین‌های نوین، بتابلوکرها جزء خط اول درمان پرفشاری خون اولیه بدون عارضه نیستند؛ تیازید، ACEI، ARB و CCB خط اول هستند.",
        "micro": {
            "lead_fa": "در درمان پرفشاری خون اولیه طبق گایدلاین‌های معتبر جهانی (ACC/AHA و JNC8)، چهار دسته دارویی به عنوان خط اول درمان اثبات‌شده با شواهد قوی در کاهش مورتالیتی قلبی و سکته مغزی انتخاب شده‌اند: ۱) دیورتیک‌های تیازیدی (کلروتالیدون و هیدروکلروتیازید)؛ ۲) مهارکننده‌های ACE؛ ۳) مسدودکننده‌های گیرنده آنژیوتانسین (ARBs)؛ ۴) کلسیم چنل بلوکرهای دی‌هیدروپیریدینی. داروهای بتابلوکر به دلیل اثربخشی کمتر در پیشگیری از حوادث عروقی مغز، خط اول نبوده و تنها در حضور بیماری‌های قلبی همراه (نظیر سابقه MI، آنژین یا HFrEF) اندیکاسیون دارند.",
            "lead_en": "Modern hypertension management guidelines (ACC/AHA, JNC8, ESC) identify four primary first-line pharmacotherapeutic classes exhibiting robust cardiovascular and stroke mortality reduction: thiazide-type diuretics, ACE inhibitors, angiotensin receptor blockers (ARBs), and dihydropyridine calcium channel blockers. Beta-blockers are no longer designated as first-line therapy for uncomplicated primary hypertension.",
            "golden_fa": "داروهای خط اول فشار خون: تیازید، ACEI، ARB و کلسیم بلوکر؛ بتابلوکرها جزء خط اول فشار خون نیستند.",
            "golden_en": "First-line antihypertensives: thiazides, ACEIs, ARBs, and CCBs; beta-blockers are not first-line for uncomplicated hypertension.",
            "points_fa": [
                "بتابلوکرها تنها در صورت وجود اندیکاسیون اجباری نظیر نارسایی قلبی HFrEF یا پس از انفارکتوس میوکارد خط اول می‌شوند.",
                "کلروتالیدون به دلیل نیمه‌عمر طولانی‌تر نسبت به هیدروکلروتیازید داروی تیازیدی ارجح است.",
                "ترکیب دو داروی خط اول از کلاس‌های متفاوت در فشار خون مرحله ۲ (بالای ۲۰/۱۰ بیش از هدف) الزامی است.",
                "مصرف همزمان مهارکننده ACE با مسدودکننده ARB به علت خطرات شدید کلیوی و هایپرکالمی ممنوع است."
            ],
            "points_en": [
                "Beta-blockers are reserved for compelling cardiac indications including HFrEF, post-myocardial infarction, or stable angina.",
                "Chlorthalidone is favored over hydrochlorothiazide owing to prolonged duration of action and proven clinical trial data.",
                "Initiating dual-combination therapy from complementary classes is recommended when blood pressure exceeds target by >20/10 mmHg.",
                "Combining an ACE inhibitor directly with an ARB is contraindicated due to heightened risks of hyperkalemia and renal failure."
            ]
        }
    },
    202: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: نارسایی دریچه میترال سوفل هولوسیستولی در اپکس با انتشار به آگزیلا دارد و در فضای دوم راست شنیده نمی‌شود.",
            "نادرست است؛ دلیل رد: تنگی دریچه پولمونر در فضای دوم بین‌دنده‌ای چپ سمع می‌شود نه فضای دوم راست.",
            "نادرست است؛ دلیل رد: کاردیومیوپاتی هیپرتروفیک انسدادی (HOCM) حداکثر شدت سوفل در کناره تحتانی-چپ استرنوم دارد نه فضای دوم راست، و با مانور والسالوا تشدید می‌شود در حالی که نبض محیطی پس از PVC ضعیف می‌گردد.",
            "صحیح است؛ سمع سوفل میدسیستولی خشن جهشی (Crescendo-Decrescendo) با «حداکثر شدت صدا در کانون دریچه آئورت یعنی فضای دوم بین‌دنده‌ای راست (2nd Right Intercostal Space)» با انتشار به شریان‌های کاروتید، همراه با «تشدید سوفل در ضربان متعاقب یک ضربه انقباض نارس بطنی (Post-PVC Augmentation / پدیده برکنبورو)» ناشی از پر شدن بیشتر بطن چپ در دیاستول طولانی‌تر و افزایش حجم ضربه‌ای، تشخیص قطعی و پاتوگنومونیک «تنگی دریچه آئورت (Aortic Stenosis / AS)» است."
        ],
        "exp": "سوفل میدسیستولی در فضای دوم بین‌دنده‌ای راست که به دنبال PVC تشدید می‌یابد، مشخصه تنگی دریچه آئورت (AS) است.",
        "micro": {
            "lead_fa": "تنگی دریچه آئورت (Aortic Stenosis) با سوفل سیستولی جهشی کرشندو-دم‌کرشندو در فضای دوم بین‌دنده‌ای راست در کناره استرنوم با انتشار به عروق کاروتید گردن مشخص می‌شود. یکی از مانورهای فیزیولوژیک تشخیصی تشدید سوفل در ضربان پس از PVC (Post-PVC beat) است؛ مکث دیاستولی طولانی‌تر پرشدگی بطن چپ را بیشتر کرده و حجم ضربه‌ای عبورکننده از دریچه تنگ را افزایش می‌دهد که منجر به بلندتر شدن صدای سوفل و پرش قوی‌تر نبض شریانی در AS می‌شود (برعکس HOCM که نبض ضعیف می‌شود).",
            "lead_en": "Aortic stenosis (AS) characteristically generates a harsh crescendo-decrescendo midsystolic ejection murmur maximal at the 2nd right intercostal space with classical radiation into the carotid arteries. Following a premature ventricular contraction (PVC), prolonged compensatory pause augments left ventricular end-diastolic filling and stroke volume, strikingly intensifying the systolic murmur across the stenotic aortic valve.",
            "golden_fa": "سوفل میدسیستولی در فضای دوم راست بین‌دنده‌ای با تشدید به دنبال PVC = تنگی دریچه آئورت (Aortic Stenosis).",
            "golden_en": "Midsystolic murmur at the 2nd right intercostal space intensifying post-PVC = aortic stenosis.",
            "points_fa": [
                "نبض پارووس و تاردوس (نبض ضعیف با صعود با تأخیر کاروتید) نشانه شدت تنگی دریچه آئورت است.",
                "اکوکاردیوگرافی داپلر روش استاندارد طلایی تعیین گرادیان فشار و مساحت دریچه آئورت (تنگی شدید مساحت < 1 cm2) است.",
                "تریاد کلاسیک علائم در تنگی آئورت شامل آنژین، سنکوپ و تنگی نفس فعالیتی نارسایی قلبی است.",
                "بروز علائم در تنگی شدید آئورت اندیکاسیون قطعی تعویض دریچه آئورت با جراحی (SAVR) یا روش بسته (TAVI) است."
            ],
            "points_en": [
                "Pulsus parvus et tardus (delayed, weak carotid upstroke) reliably reflects severe hemodynamic aortic valve stenosis.",
                "Transthoracic Doppler echocardiography represents the gold standard establishing mean transvalvular gradient and valve area (<1.0 cm2).",
                "The classic symptomatic triad encompasses angina, exertional syncope, and heart failure dyspnea, heralding precipitous mortality.",
                "Symptomatic severe AS establishes an absolute, urgent indication for surgical (SAVR) or transcatheter (TAVI) valve replacement."
            ]
        }
    },
    203: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: فیبریلاسیون دهلیزی عارضه شایع کوآرکتاسیون آئورت نیست و بیشتر در بیماری‌های دریچه میترال دیده می‌شود.",
            "نادرست است؛ دلیل رد: کورپولمونال نارسایی بطن راست ناشی از بیماری‌های ریوی است و با کوآرکتاسیون ارتباطی ندارد.",
            "صحیح است؛ وجود سوفل سیستولی، نبض‌های براکیال قوی در اندام فوقانی همراه با «نبض‌های فمورال ضعیف و با تأخیر در اندام تحتانی (Radiofemoral delay)»، کاردیومگالی و هایپرتروفی بطن چپ در یک نوجوان ۱۵ ساله، تابلوی کلاسیک «کوآرکتاسیون آئورت (Coarctation of the Aorta)» است؛ شایع‌ترین، مهم‌ترین و قابل‌انتظارترین عارضه بالینی در این بیماران «پرفشاری خون سیستمیک شدید در اندام فوقانی (Systemic Hypertension)» و عوارض ناشی از آن (سکته مغزی، آنوریسم مغزی، نارسایی قلبی و پارگی آئورت) است.",
            "نادرست است؛ دلیل رد: نارسایی دریچه تریکوسپید عارضه کوآرکتاسیون نیست (دریچه درگیر شایع دریچه دولتی آئورت BAV است)."
        ],
        "exp": "نبض‌های ضعیف فمورال در کنار نبض‌های قوی اندام فوقانی نشانه کوآرکتاسیون آئورت است و عارضه محتمل آن پرفشاری خون سیستمیک است.",
        "micro": {
            "lead_fa": "کوآرکتاسیون آئورت تنگی مادرزادی مجرای آئورت نزولی معمولاً در محل اتصال لیگامان آرتریوزوم درست بعد از منشأ شریان ساب‌کلاوین چپ است. نشانه‌های پاتوگنومونیک: فشار خون بالا در دست‌ها همراه با کاهش محسوس فشار و نبض‌های ضعیف و با تأخیر در پاها (تأخیر رادیوفمورال). پرفشاری خون شریانی سیستمیک شایع‌ترین عارضه بیماری است که در صورت عدم اصلاح منجر به هایپرتروفی بطن چپ، نارسایی قلبی، خونریزی داخل مغزی (آنوریسم بری) و تشریح آئورت می‌شود.",
            "lead_en": "Coarctation of the aorta entails discrete luminal narrowing of the descending thoracic aorta immediately distal to the left subclavian artery origin. Cardinal diagnostic findings include upper extremity hypertension juxtaposed with diminished, delayed femoral arterial pulses (radiofemoral delay). Accelerated systemic hypertension is the preeminent, most probable clinical complication.",
            "golden_fa": "نبض فمورال ضعیف + نبض دست قوی در نوجوان = کوآرکتاسیون آئورت؛ عارضه بسیار محتمل: پرفشاری خون سیستمیک.",
            "golden_en": "Weak femoral pulses + strong arm pulses in an adolescent = aortic coarctation; most probable complication: systemic hypertension.",
            "points_fa": [
                "بیش از ۵۰ تا ۸۰ درصد بیماران مبتلا به کوآرکتاسیون آئورت دریچه آئورت دو‌لتی (Bicuspid Aortic Valve) همزمان دارند.",
                "رادیوگرافی ساده قفسه سینه علامت دندانه‌دار شدن لبه دنده‌ها (Rib notching به علت اتساع عروق بین‌دنده‌ای) را نشان می‌دهد.",
                "اکوکاردیوگرافی و سی‌تی آنژیوگرافی قفسه صدری ابزارهای قطعی اثبات آناتومیک تنگی هستند.",
                "درمان قطعی در کودکان و نوجوانان آنژیوپلاستی با بالون و تعبیه استنت یا جراحی رزکسیون تنگی است."
            ],
            "points_en": [
                "Over 50-80% of individuals with aortic coarctation carry a concurrent congenital bicuspid aortic valve (BAV).",
                "Chest radiography demonstrates pathognomonic inferior rib notching (Roesler sign) and the aortic 'figure-of-3' contour.",
                "Transthoracic echocardiography and contrast CT angiography represent definitive diagnostic and anatomical staging tools.",
                "Definitive treatment encompasses transcatheter endovascular stent placement or surgical resection with end-to-end anastomosis."
            ]
        }
    },
    204: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: در STEMI صعود ST محدود به یک قلمرو شریانی خاص است و با تغییرات متقابل (Reciprocal) همراه است نه صعود منتشر.",
            "نادرست است؛ دلیل رد: آمبولی ریه معمولاً الگوی S1Q3T3، تاکی‌کاردی سینوسی یا بلوک شاخه‌ای راست می‌دهد نه صعود منتشر تقعردار ST.",
            "صحیح است؛ در بیماری که با درد قفسه سینه مراجعه کرده و در نوار قلب «صعود منتشر و گسترده قطعه ST با تقعر رو به بالا (Diffuse Concave-upward ST Elevation در اکثر لیدهای لترال، قدامی و تحتانی) همراه با فرورفتگی قطعه PR (PR Depression) و تغییرات معکوس صعود PR و افت ST در لید aVR» مشاهده می‌شود، تابلوی الکتروکاردیوگرافی کلاسیک و پاتوگنومونیک «پریکاردیت حاد (Acute Pericarditis)» است.",
            "نادرست است؛ دلیل رد: سندرم بروگادا با صعود ST طرح بال پرنده در لیدهای راست پره‌کوردیال (V1-V2) مشخص می‌شود نه صعود منتشر سراسری."
        ],
        "exp": "صعود منتشر قطعه ST با تقعر رو به بالا و دپرسیون قطعه PR در سراسر لیدها، تابلوی اختصاصی پریکاردیت حاد (Acute Pericarditis) است.",
        "micro": {
            "lead_fa": "پریکاردیت حاد با التهاب لایه‌های پریکارد مشخص می‌شود. افتراق نوار قلب پریکاردیت از سکته قلبی حاد (STEMI) حیاتی است. چهار ویژگی شاخص ECG در پریکاردیت حاد (مرحله ۱): ۱) بالا رفتن منتشر و سراسری قطعه ST در تمام لیدها (به جز aVR و V1) که تقعر آن رو به بالاست (شبیه لبخند Smiley face)؛ ۲) فرورفتگی قطعه PR (PR depression) در اکثر لیدها که بسیار اختصاصی است؛ ۳) صعود قطعه PR و افت قطعه ST در لید aVR؛ ۴) عدم وجود امواج Q پاتولوژیک یا تغییرات متقابل موضعی.",
            "lead_en": "Acute pericarditis electrocardiographic staging (Stage I) is distinguished from STEMI by widespread, diffuse ST-segment elevation across virtually all limb and precordial leads exhibiting a concave-upward contour. The pathognomonic discriminator is widespread PR-segment depression, mirrored by reciprocal PR-segment elevation and ST depression in lead aVR, lacking focal reciprocal changes.",
            "golden_fa": "صعود منتشر ST با تقعر رو به بالا + دپرسیون قطعه PR در اکثر لیدها = پریکاردیت حاد (Acute Pericarditis).",
            "golden_en": "Diffuse concave ST elevation + widespread PR depression = acute pericarditis (spares reciprocal changes).",
            "points_fa": [
                "درد سینه در پریکاردیت پلوریتیک بوده، با دراز کشیدن بدتر شده و با نشستن و خم شدن به جلو تسکین می‌یابد.",
                "سمع صدای مالش پریکارد (Pericardial friction rub) یافته بالینی پاتوگنومونیک در معاینه فیزیکی است.",
                "درمان استاندارد خط اول تجویز دوزهای کامل NSAIDs (نظیر ایبوپروفن یا ایندومتاسین) به همراه کلشی‌سین به مدت ۳ ماه است.",
                "کلشی‌سین نرخ عود بیماری را به میزان بیش از ۵۰ درصد کاهش می‌دهد."
            ],
            "points_en": [
                "Pericarditic chest pain is characteristically sharp and pleuritic, worsening when supine and relieved by leaning forward.",
                "Pericardial friction rub is the pathognomonic physical examination sign, best heard at the lower left sternal border.",
                "First-line standard therapy combines high-dose scheduled NSAIDs/aspirin with adjunct colchicine for 3 months.",
                "Colchicine co-administration slashes recurrent pericarditis episodes by greater than 50%."
            ]
        }
    },
    205: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: در انفارکتوس قدامی (Ant. MI)، بلوک کامل قلبی ناشی از نکروز وسیع هیس-پورکنژ با QRS پهن و ناپایدار است که با PCI ساده سریعاً برنمی‌گردد.",
            "نادرست است؛ دلیل رد: دیواره خلفی به تنهایی تأمین‌کننده اصلی گره AV نیست.",
            "نادرست است؛ دلیل رد: دیواره لترال توسط شریان سیرکومفلکس چپ تغذیه می‌شود و معمولاً بلوک کامل برگشت‌پذیر نمی‌دهد.",
            "صحیح است؛ بروز بلوک کامل دهلیزی-بطنی (CHB) متعاقب STEMI که پس از بازگشایی فوری شریان در پرایمری PCI ظرف کمتر از یک ساعت «به سرعت برطرف شده و ریتم بیمار کاملاً سینوسی می‌گردد»، مشخصه قطعی «انفارکتوس دیواره تحتانی (Inferior Wall MI)» است؛ شریان کرونر راست (RCA) در ۹۰ درصد افراد شریان گره AV را تأمین می‌کند و بلوک قلبی ناشی از ایسکمی موقت گره AV در اینفریور MI با ریتم فرار باریک و پاسخ سریع و کامل به برقراری مجدد خون‌رسانی (Reperfusion) همراه است."
        ],
        "exp": "بلوک کامل قلبی گذرا در STEMI که بلافاصله پس از PCI برطرف می‌شود، مشخصه انفارکتوس دیواره تحتانی (Inferior MI) با انسداد RCA است.",
        "micro": {
            "lead_fa": "مکانیسم و پیش‌آگهی بلوک کامل دهلیزی-بطنی (CHB) در STEMI کاملاً به موضع انفارکتوس بستگی دارد: ۱) در انفارکتوس تحتانی (Inferior MI ناشی از انسداد RCA): شریان گره AV در بالای گره دچار ایسکمی یا رفلکس واگ شدید (بزولد-یاریش) می‌شود؛ ریتم فرار باریک و پایدار است و بلوک گذرا بوده و بلافاصله پس از PCI یا آتروپین برطرف می‌شود؛ ۲) در انفارکتوس قدامی (Anterior MI ناشی از LAD): بلوک ناشی از نکروز فاجعه‌بار بافت هیس و دیواره بین‌بطنی است، با QRS پهن و شوک کاردیوژنیک همراه است و خودبه‌خود برنمی‌گردد.",
            "lead_en": "High-degree AV block in STEMI reflects starkly divergent pathophysiological mechanisms. In acute inferior MI, occlusion of the RCA compromises the AV nodal artery; the resulting AV block is intranodal, transient, mediated by localized ischemia and Bezold-Jarisch vagal tone, promptly resolving upon primary PCI revascularization. Conversely, anterior MI-induced block reflects irreversible extensive septal necrosis.",
            "golden_fa": "STEMI با بلوک کامل قلبی که بلافاصله پس از باز شدن رگ با PCI رفع می‌شود = انفارکتوس دیواره تحتانی (Inferior MI).",
            "golden_en": "STEMI with complete heart block resolving immediately following primary PCI = inferior wall MI (RCA occlusion).",
            "points_fa": [
                "شریان کرونر راست (RCA) در ۹۰ درصد افراد مسئول تغذیه شریانی گره AV است.",
                "ریتم فرار بطنی در بلوک ناشی از اینفریور MI معمولاً باریک، همودینامیک پایدار و پاسخ‌دهنده به آتروپین است.",
                "در انفارکتوس قدامی مورتالیتی همراه با بلوک کامل بالای ۵۰ تا ۸۰ درصد است و نیازمند پی‌س‌میکر دائمی است.",
                "بلوک قلبی در اینفریور MI معمولاً ظرف چند ساعت تا چند روز کاملاً خودبه‌خود محو می‌شود."
            ],
            "points_en": [
                "The right coronary artery provides the AV nodal branch in approximately 90% of individuals (right-dominant circulation).",
                "The escape rhythm in inferior STEMI AV block originates within the junction, characterized by narrow QRS complexes.",
                "Anterior MI high-grade AV block entails infranodal His-Purkinje destruction carrying extreme mortality and pacing requirements.",
                "AV conduction defects complicating inferior infarction are virtually always self-limiting following myocardial salvage."
            ]
        }
    },
    206: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: رژیم مایعات شفاف پس از هموستاز آندوسکوپی موفق استاندارد مراقبت بالینی است.",
            "نادرست است؛ دلیل رد: تجویز پنتوپرازول وریدی دوز بالا (۸۰ میلی‌گرم بولوس و انفوزیون ۸ میلی‌گرم در ساعت) خط اول مهار اسید در زخم دوازدهه است.",
            "نادرست است؛ دلیل رد: بستری تا سه روز (۷۲ ساعت) به دلیل اینکه بیشترین خطر خونریزی مجدد در ۷۲ ساعت اول است توصیه می‌شود.",
            "صحیح است (اقدامی که در خونریزی اولسر پپتیک کاربردی ندارد)؛ داروی «اوکترئوتاید وریدی (Octreotide / آنالوگ سوماتواستاتین)» منحصراً در درمان «خونریزی‌های واریسی ناشی از پرفشاری خون ورید باب (سیروز کبدی)» اندیکاسیون دارد و در خونریزی‌های ناشی از اولسر پپتیک دوازدهه و معده هیچ‌گونه جایگاه، اثربخشی یا توجیه بالینی ندارد؛ بنابراین تجویز آن در زخم بولب دوازدهه نادرست است."
        ],
        "exp": "اوکترئوتاید منحصراً در خونریزی واریسی پورت اندیکاسیون دارد و در خونریزی ناشی از زخم پپتیک دوازدهه تجویز نمی‌شود.",
        "micro": {
            "lead_fa": "در مدیریت خونریزی گوارشی فوقانی ناشی از اولسر پپتیک پرخطر (زخم دوازدهه با رگ قابل مشاهده Visible vessel یا رده Forrest IIa)، پس از هموستاز موفق دوگانه اندوسکوپیک (تزریق اپی‌نفرین به همراه هموکلیپ یا کوتر حرارتی)، اقدامات استاندارد عبارتند از: ۱) انفوزیون وریدی دوز بالای پنتوپرازول (PPI) به مدت ۷۲ ساعت جهت حفظ pH معده بالای ۶ و پایداری لخته؛ ۲) بستری و تحت نظر داشتن بیمار برای ۷۲ ساعت به علت اوج ریسک عود مجدد؛ ۳) بررسی هلیکوباکتر پیلوری. اوکترئوتاید فقط برای واریس مری است.",
            "lead_en": "Endoscopic dual therapy (epinephrine injection plus mechanical hemoclips) for high-risk bleeding peptic ulcer disease (Forrest IIa non-bleeding visible vessel) mandates continuous high-dose intravenous proton pump inhibitor (pantoprazole) infusion for 72 hours alongside hospitalization, as rebleeding peaks within 72 hours. Intravenous octreotide reduces splanchnic portal pressure, reserved strictly for variceal hemorrhage.",
            "golden_fa": "درمان خونریزی اولسر پپتیک دوازدهه: اندوسکوپی + PPI وریدی به مدت ۷۲ ساعت؛ اوکترئوتاید فقط برای واریس است نه زخم.",
            "golden_en": "Bleeding duodenal ulcer management: endoscopy + IV PPI for 72 hours; octreotide is indicated solely for variceal bleeding.",
            "points_fa": [
                "اوکترئوتاید با مهار هورمون‌های وازودیلاتور فشار ورید باب را در سیروز کاهش می‌دهد و نقشی در زخم پپتیک ندارد.",
                "مهار اسید معده با PPI وریدی از حل شدن آنزیمی پپتیک لخته پلاکت‌ها بر روی رگ ممانعت می‌کند.",
                "بیش از ۸۰ درصد موارد خونریزی مجدد زخم در سه روز اول رخ می‌دهند.",
                "غربالگری و ریشه‌کنی عفونت H. pylori پس از ترخیص برای پیشگیری از عود زخم اجباری است."
            ],
            "points_en": [
                "Octreotide selectively blunts splanchnic hyperperfusion in portal hypertension, offering no benefit in non-variceal ulcers.",
                "Sustained gastric hypochlorhydria (pH >6.0) induced by high-dose PPI prevents pepsin-mediated clot fibrinolysis.",
                "Over 80% of ulcer rebleeding episodes concentrate within the critical initial 72-hour post-endoscopic window.",
                "Helicobacter pylori testing and eradication therapy are mandatory post-stabilization to avert ulcer recurrence."
            ]
        }
    },
    207: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: گرافی قفسه سینه انبساط آناتومیک را نشان می‌دهد اما قدرت دینامیک عضلات بازدمی و جریان سرفه را نمی‌سنجد.",
            "صحیح است؛ برای ارزیابی عینی، کمی و بالینی قدرت، کفایت و اثربخشی مکانیکی سرفه (Cough Efficacy)، ابزار استاندارد و معتبر «اندازه‌گیری اوج جریان بازدمی حین سرفه در پیک‌فلومتری (Peak Cough Flow / PCF یا Peak Expiratory Flow Rate)» است؛ دستیابی به جریان پیک سرفه حداقل بالای ۱۶۰ تا ۲۷۰ لیتر در دقیقه برای پاکسازی مؤثر ترشحات ریوی و محافظت از مجاری هوایی ضروری تلقی می‌گردد.",
            "نادرست است؛ دلیل رد: بلندی صدای سرفه معیاری ذهنی و غیراستاندارد است.",
            "نادرست است؛ دلیل رد: پالس‌اکسیمتری تبادل اکسیژن خون را می‌سنجد و معیاری برای قدرت عضلات سرفه نیست."
        ],
        "exp": "سنجش حداکثر جریان بازدمی در پیک فلومتری (Peak Cough Flow) ابزار استاندارد و کمی ارزیابی قدرت و کفایت سرفه است.",
        "micro": {
            "lead_fa": "کفایت رفلکس سرفه مستلزم همکاری عضلات دمی (جهت ورود حجم کافی هوا)، بسته شدن کامل گلوت و سپس انقباض انفجاری قدرتمند عضلات بازدمی شکم و بین‌دنده‌ای است. در بیماری‌های نوروموسکولار (مانند ALS و گیلن‌باره) ارزیابی قدرت سرفه جهت جلوگیری از آسپیراسیون و پنومونی حیاتی است. اندازه‌گیری حداکثر جریان بازدمی سرفه (Peak Cough Flow / PCF) با دستگاه پیک‌فلومتر استاندارد بالینی است: مقادیر کمتر از ۱۶۰ لیتر/دقیقه سرفه ناکارآمد را اثبات می‌نماید.",
            "lead_en": "Cough efficacy is mechanically contingent upon explosive expiratory muscle contraction against a transiently closed glottis. Measuring peak expiratory flow rate during cough (Peak Cough Flow / PCF) using a peak flow meter provides the definitive quantitative clinical metric of cough strength. A PCF <160-270 L/min establishes cough inadequacy, predicting airway secretion retention and respiratory failure in neuromuscular disorders.",
            "golden_fa": "ارزیابی کمی قدرت و کفایت سرفه = اندازه‌گیری حداکثر جریان بازدمی در پیک‌فلومتری (Peak Cough Flow).",
            "golden_en": "Objective quantitative evaluation of cough strength and efficacy = peak expiratory flow on peak flowmetry (Peak Cough Flow).",
            "points_fa": [
                "جریان پیک سرفه (PCF) زیر ۱۶۰ لیتر در دقیقه نشان‌دهنده ناتوانی در پاک‌سازی خلط و ترشحات برونش است.",
                "در بیماری‌های عصبی-عضلانی ضعف سرفه پیش‌بینی‌کننده شکست در جداسازی از ونتیلاتور است.",
                "دستگاه‌های کمکی سرفه مکانیکی (Cough Assist) در جریان‌های پایین سرفه اندیکاسیون دارند.",
                "پالس اکسیمتری اکسیژناسیون را نشان می‌دهد اما قدرت مکانیکی تخلیه راه‌های هوایی را ارزیابی نمی‌کند."
            ],
            "points_en": [
                "A peak cough flow <160 L/min establishes critical inability to clear endotracheal mucus secretions independently.",
                "In neuromuscular cohorts (e.g., ALS, myasthenia), depressed PCF reliably predicts extubation failure.",
                "Mechanical insufflation-exsufflation (cough assist devices) is indicated when voluntary peak cough flow is compromised.",
                "Pulse oximetry reflects capillary gas diffusion, remaining completely blind to dynamic biomechanical muscle pump strength."
            ]
        }
    },
    208: {
        "ci": 0,
        "whys": [
            "صحیح است؛ در یک فرد میانسال سیگاری با سابقه مصرف دخانیات که با خلط خونی (هموپتزی / Hemoptysis)، کاهش وزن قابل توجه (۵ کیلو در ۳ ماه)، ویزینگ موضعی یک‌طرفه در سمع قاعده ریه راست (نشانه انسداد نسبی مجرای برونش توسط توده اندوبرونکیال) و شروع چماقی شدن انگشتان (Digital Clubbing) مراجعه کرده است، محتمل‌ترین و قطعی‌ترین تشخیص بالینی «سرطان اولیه ریه (Primary Lung Cancer / برونکوژنیک کارسینوما)» است.",
            "نادرست است؛ دلیل رد: سیستیک فیبروزیس بیماری ارثی با شروع در دوران کودکی با عفونت‌های مکرر پسودوموناسی و برونشکتازی دوطرفه است.",
            "نادرست است؛ دلیل رد: پنومونی حاد باکتریال با تب بالا، لرز شدید، سرفه چرکی و کنسولیداسیون همراه است نه کاهش وزن مزمن و کلابینگ بدون تب.",
            "نادرست است؛ دلیل رد: ادم حاد ریوی تظاهر تنگی نفس شدید ارتوپنه و کراکل دوطرفه دارد و ویزینگ موضعی یک‌طرفه و کلابینگ ایجاد نمی‌کند."
        ],
        "exp": "هموپتزی، کاهش وزن، ویزینگ موضعی و کلابینگ در فرد سیگاری، تابلوی تیپیک سرطان اولیه ریه (برونکوژنیک) است.",
        "micro": {
            "lead_fa": "سرطان ریه شایع‌ترین علت مرگ ناشی از بدخیمی‌ها در سراسر جهان است که بیش از ۸۵ درصد موارد آن به مصرف دخانیات مرتبط است. تظاهرات شاخص: سرفه مداوم یا تغییر ویژگی‌های سرفه قبلی، هموپتزی حتی به مقدار اندک، کاهش وزن غیرقابل توجیه و شروع چماقی شدن انگشتان (هیپرتروفیک استئوآرتروپاتی ریوی). سمع ویزینگ موضعی و ثابت در یک ناحیه ریه نشانه پاتوگنومونیک انسداد مجرای برونش با یک توده تومورال است. اقدام فوری سی‌تی‌اسکن اسپیرال قفسه صدری است.",
            "lead_en": "Primary bronchogenic carcinoma presents with insidious constitutional and respiratory symptoms in long-term smokers. The clinical constellation of hemoptysis, weight loss, digital clubbing, and focal monophonic wheezing (signifying endobronchial airway narrowing by an obstructing mass) strongly mandates an urgent workup for primary lung cancer via contrast chest CT and bronchoscopy.",
            "golden_fa": "سیگاری + خلط خونی (هموپتزی)، کاهش وزن، ویزینگ موضعی و کلابینگ = سرطان اولیه ریه (Lung Cancer).",
            "golden_en": "Smoker + hemoptysis, weight loss, focal wheeze, and digital clubbing = primary lung cancer.",
            "points_fa": [
                "ویزینگ موضعی تک‌صدایی (Monophonic wheeze) نشانه انسداد فیکس برونش با تومور یا جسم خارجی است.",
                "انجام سی‌تی‌اسکن با تزریق قفسه سینه همراه با کبد و آدرنال اقدام تشخیصی و مرحله‌بندی اولیه است.",
                "برونکوسکوپی فیبراپتیک جهت مشاهده توده و اخذ بیوپسی بافت‌شناسی الزامی است.",
                "کلابینگ در حضور علائم ریوی در فرد سیگاری زنگ خطر سرطان سلول غیرکوچک ریه (NSCLC) است."
            ],
            "points_en": [
                "Fixed monophonic localized wheezing reflects critical luminal airway compromise driven by an endobronchial lesion.",
                "Contrast-enhanced chest computed tomography extending through adrenals establishes anatomical tumor staging.",
                "Flexible fiberoptic bronchoscopy enables direct visualization and endobronchial tissue biopsy.",
                "Digital clubbing emerging in an adult smoker demands immediate exclusion of non-small cell lung cancer."
            ]
        }
    },
    209: {
        "ci": 0,
        "whys": [
            "صحیح است؛ در بیماری با انقباض برونش ناشی از فعالیت ورزشی یا آسم ورزشی (Exercise-Induced Bronchoconstriction / EIB)، بهترین، مؤثرترین و خط اول‌ترین روش پیشگیری و درمان دارویی «مصرف بتا-۲ آگونیست استنشاقی کوتاه‌اثر (نظیر ۲ پاف سالبوتامول) ۱۰ تا ۱۵ دقیقه قبل از شروع فعالیت ورزشی» است که در بیش از ۸۰ تا ۹۰ درصد بیماران اتساع کامل برونش ایجاد کرده و مانع از بروز اسپاسم حاد مجاری هوایی می‌گردد.",
            "نادرست است؛ دلیل رد: مهارکننده‌های لوکوترین (مونته‌لوکاست) اثربخشی کمتری نسبت به بتا-۲ آگونیست‌های استنشاقی دارند و درمان خط دوم هستند.",
            "نادرست است؛ دلیل رد: کورتیکواستروئید استنشاقی مداوم زمانی اندیکاسیون دارد که بیمار علائم آسم پایدار زمینه‌ای داشته باشد نه آسم ورزشی ایزوله.",
            "نادرست است؛ دلیل رد: کورتیکواستروئید خوراکی عوارض سیستمیک فراوان دارد و در آسم ورزشی جایگاهی ندارد."
        ],
        "exp": "استفاده از بتا-۲ آگونیست استنشاقی کوتاه‌اثر (سالبوتامول) ۱۰ تا ۱۵ دقیقه قبل از ورزش، بهترین روش درمان آسم ورزشی است.",
        "micro": {
            "lead_fa": "اسپاسم ناشی از ورزش (EIB) ناشی از تبخیر سریع رطوبت راه‌های هوایی و خنک شدن مخاط به دنبال هیپرونتیلاسیون ورزشی است که موجب آزادسازی واسطه‌های ماست‌سل‌ها می‌شود. طبق گایدلاین‌های رسمی انجمن قفسه سینه آمریکا (ATS)، مصرف ۲ پاف بتا-۲ آگونیست استنشاقی کوتاه‌اثر (SABA مانند سالبوتامول) ۱۰ تا ۱۵ دقیقه قبل از فعالیت ورزشی، درمان استاندارد طلایی خط اول است و محافظت تا ۲ تا ۴ ساعت ایجاد می‌کند. در صورت تکرار مکرر، کورتون استنشاقی روزانه افزوده می‌شود.",
            "lead_en": "Exercise-induced bronchoconstriction (EIB) stems from mucosal thermal/osmotic flux provoked by exercise hyperpnea, degranulating mast cells. American Thoracic Society (ATS) guidelines establish inhaled short-acting beta-2 agonists (SABA, e.g., albuterol 2 puffs) administered 10-15 minutes prior to exercise as the definitive first-line prophylactic and therapeutic intervention of choice.",
            "golden_fa": "بهترین روش درمان و پیشگیری از آسم ورزشی = استنشاق اسپری بتا-۲ آگونیست (سالبوتامول) قبل از ورزش.",
            "golden_en": "Best treatment/prophylaxis for exercise-induced asthma = inhaled short-acting beta-2 agonist (SABA) prior to exercise.",
            "points_fa": [
                "گرم کردن تدریجی بدن قبل از ورزش شدید (Warm-up) به عنوان یک روش غیردارویی بسیار مؤثر است.",
                "در صورت نیاز به مصرف روزانه SABA قبل از ورزش، باید درمان ضدالتهابی نگهدارنده با ICS شروع شود.",
                "آنتاگونیست‌های گیرنده لوکوترین (مونته‌لوکاست) برای بیمارانی که به SABA پاسخ نمی‌دهند گزینه کمکی مفیدی هستند.",
                "ورزش در هوای سرد و خشک به دلیل تبخیر بیشتر مخاطی محرک قوی‌تر آسم ورزشی است."
            ],
            "points_en": [
                "Structured pre-exercise warm-up protocols induce a refractory period, blunting subsequent bronchoconstriction.",
                "Frequent daily SABA dependence warrants scheduled daily inhaled corticosteroid (ICS) controller therapy.",
                "Leukotriene receptor antagonists (montelukast) serve as an efficacious oral alternative for non-responders.",
                "Cold, dry ambient air accelerates respiratory heat and water loss, sharply magnifying bronchospastic triggers."
            ]
        }
    },
    210: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: آمفیزم سنتری‌لوبولار در لوب‌های فوقانی تغییر پاتولوژیک کلاسیک ناشی از دود سیگار است و به کمبود آلفا-۱ مرتبط نیست.",
            "صحیح است؛ در ارزیابی رادیولوژیک بیماری‌های انسدادی ریه، وجود «آمفیزم پان‌لوبولار (Panlobular / Panacinar Emphysema) با ارجحیت مشخص و درگیری شدید در لوب‌های تحتانی و قاعده‌های ریه (Lower Lobes / Basilar Predominance)» در سی‌تی‌اسکن با وضوح بالا (HRCT)، مشخصه پاتوگنومونیک و کلاسیک «کمبود آنزیم آلفا-۱ آنتی‌تریپسین (AAT Deficiency)» است و انجام بررسی سرولوژیک سطح آنزیم و ژنوتایپ را الزامی می‌سازد.",
            "نادرست است؛ دلیل رد: آمفیزم پاراسپتال در حاشیه ساب‌پلورال دیده می‌شود و عامل ایجاد بولا و پنوموتوراکس خودبه‌خودی است.",
            "نادرست است؛ دلیل رد: برونشکتازی مرکزی مشخصه آسپرژیلوز برونکوپولمونری آلرژیک (ABPA) است نه کمبود AAT."
        ],
        "exp": "آمفیزم پان‌لوبولار با غلبه در لوب‌های تحتانی ریه در سی‌تی‌اسکن، یافته پاتوگنومونیک کمبود آلفا-۱ آنتی‌تریپسین است.",
        "micro": {
            "lead_fa": "کمبود آلفا-۱ آنتی‌تریپسین (AATD) یک اختلال ژنتیکی اتوزومال کواودومیننت است که با کاهش مهارکننده پروتئاز سرم مشخص می‌شود. برعکس آمفیزم سنتری‌اسینار ناشی از سیگار که در لوب‌های فوقانی غالب است، آمفیزم ناشی از کمبود AAT از نوع پان‌اسینار (Panacinar / Panlobular) بوده و به دلیل جریان خون بیشتر به قسمت‌های تحتانی ریه، علاقه شدیدی به تخریب لوب‌های تحتانی (Basilar emphysema) دارد. وجود آمفیزم در سنین پایین یا با برتری قاعده‌ای نیازمند سنجش سطح سرمی AAT است.",
            "lead_en": "Alpha-1 antitrypsin deficiency (AATD) leads to uncontrolled neutrophil elastase destruction of alveolar connective tissue. Unlike typical smoking-related centrilobular emphysema which selectively destroys upper lung zones, AATD classically drives panlobular (panacinar) emphysema with a distinctive lower-lobe (basilar) predominance. Detecting basilar panlobular emphysema mandates serum AAT quantification and Pi-typing.",
            "golden_fa": "آمفیزم پان‌لوبولار در لوب‌های تحتانی ریه = نشانه پاتوگنومونیک کمبود آنزیم آلفا-۱ آنتی‌تریپسین (AAT).",
            "golden_en": "Panlobular emphysema with lower-lobe basilar predominance = pathognomonic of alpha-1 antitrypsin deficiency.",
            "points_fa": [
                "سیگار کشیدن روند تخریب ریوی را در بیماران مبتلا به کمبود AAT تا دهه‌ها تسریع می‌سازد.",
                "تجمع پروتئین‌های غیرطبیعی در هپاتوسیت‌ها می‌تواند همزمان بیماری کبدی و سیروز ایجاد نماید.",
                "شایع‌ترین آلل جهش‌یافته بیماری‌زا آلل Z (ژنوتایپ PiZZ) است.",
                "درمان اختصاصی در بیماران علامت‌دار انفوزیون هفتگی داخل‌وریدی آنزیم آلفا-۱ آنتی‌تریپسین خالص‌شده انسانی است."
            ],
            "points_en": [
                "Cigarette smoking accelerates respiratory decline in PiZZ homozygotes, shifting onset from the fifth to the third decade.",
                "Intrahepatocellular accumulation of polymerized mutant protein precipitates chronic hepatitis and cirrhosis.",
                "The severe deficiency phenotype is driven predominantly by homozygosity for the Z allele (PiZZ genotype).",
                "Augmentation therapy via weekly intravenous human pooled alpha-1 antitrypsin infusions arrests emphysema progression."
            ]
        }
    },
    211: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: سی‌تی آنژیوگرافی عروق ریه برای تشخیص آمبولی ریه به کار می‌رود و تومورهای اندوبرونکیال را به دقت نمونه‌برداری نمی‌کند.",
            "نادرست است؛ دلیل رد: بررسی آسپرژیلوس در پنومونی‌های حفره‌دار یا نقص ایمنی شدید مطرح است و علت اولیه پنومونی عودکننده لوبار نیست.",
            "نادرست است؛ دلیل رد: کشت خون در زمان عود انجام می‌شود اما علت انسدادی زمینه‌ای را مشخص نمی‌سازد.",
            "صحیح است؛ در یک فرد میانسال سیگاری که دچار «پنومونی راجعه و مکرر در یک سگمان یا لوب آناتومیک ثابت (لوب تحتانی چپ)» شده است، زنگ خطر پاتولوژی انسداد مکانیکی مجرای هوایی به صدا درمی‌آید؛ طبق تمام اصول بالینی ریه، اقدام تشخیصی انتخابی، قطعی و الزامی بعدی «انجام برونکوسکوپی فیبراپتیک انعطاف‌پذیر (Flexible Bronchoscopy)» جهت بررسی دقیق مجاری هوایی و رد انسداد ناشی از «سرطان برونکوژنیک ریه (تومور اندوبرونکیال)» یا جسم خارجی و اخذ نمونه بیوپسی است."
        ],
        "exp": "پنومونی عودکننده در یک لوب ثابت در فرد سیگاری شک قوی به کانسر ریه است؛ اقدام انتخابی بعدی برونکوسکوپی است.",
        "micro": {
            "lead_fa": "وقوع پنومونی مکرر در یک لوب یا سگمان آناتومیک یکسان (Recurrent pneumonia in the same lobe) در یک فرد بزرگسال و به ویژه سیگاری، نشانه پاتوگنومونیک انسداد مکانیکی مجرای برونشیال آن لوب (Post-obstructive pneumonia) است. شایع‌ترین و وخیم‌ترین علت انسداد، سرطان برونکوژنیک ریه است که جریان ترشحات را مسدود کرده و زمینه عفونت مکرر را فراهم می‌سازد. برونکوسکوپی فیبراپتیک امکان مشاهده مستقیم لومن برونش، ارزیابی توده و تهیه بیوپسی بافت را فراهم می‌سازد.",
            "lead_en": "Recurrent pneumonia localizing to the identical anatomical lobe in an adult smoker is post-obstructive pneumonia until proven otherwise. A partially or completely obstructing endobronchial malignancy (bronchogenic carcinoma) impairs downstream mucociliary clearance, precipitating bacterial recolonization. Flexible bronchoscopy is the mandatory diagnostic investigation directly inspecting the bronchial tree.",
            "golden_fa": "پنومونی مکرر در یک لوب ثابت در فرد سیگاری = شک به سرطان ریه انسدادی؛ اقدام تشخیصی انتخابی: برونکوسکوپی.",
            "golden_en": "Recurrent pneumonia in the same lobe in a smoker = suspect endobronchial lung cancer; diagnostic test: bronchoscopy.",
            "points_fa": [
                "سی‌تی‌اسکن قفسه صدری قبل از برونکوسکوپی جهت راهنمایی مسیر نمونه‌برداری توصیه می‌شود.",
                "سایر علل انسداد برونش شامل تومور کارسینوئید، تنگی ناشی از عفونت‌های قبلی و جسم خارجی فراموش‌شده هستند.",
                "کشت خلط و کشت خون درمان آنتی‌بیوتیکی حاد را هدایت می‌کنند اما بررسی علت ساختاری را جایگزین نمی‌سازند.",
                "به تعویق انداختن برونکوسکوپی در فرد سیگاری با عود پنومونی تأخیر جبران‌ناپذیر در تشخیص تومور ایجاد می‌کند."
            ],
            "points_en": [
                "Contrast chest CT is typically procured immediately beforehand to map endobronchial lesions and nodal staging.",
                "Alternative non-malignant etiologies encompass bronchial carcinoid, foreign body aspiration, and post-TB strictures.",
                "Blood and sputum cultures guide immediate antimicrobial therapy but cannot substitute for structural luminal evaluation.",
                "Delaying diagnostic bronchoscopy in this high-risk setting risks diagnostic postponement of an early-stage resectable neoplasm."
            ]
        }
    },
    212: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: افیوژن سل پلور به طور تیپیک یک مایع اگزوداتیو با ارجحیت شدید لنفوسیت‌ها (اغلب بالای ۸۰٪) است و این گزاره صحیح است.",
            "نادرست است؛ دلیل رد: پاتوژنز افیوژن ناشی از نشت پروتئین‌ها به دنبال واکنش افزایش حساسیت تاخیری به پروتئین‌های باسیل کخ است و گزاره صحیح است.",
            "نادرست است؛ دلیل رد: سطح مارکر آنزیمی آدنوزین دی‌آمیناز (ADA) بالای ۴۰ تا ۵۰ واحد در لیتر با حساسیت و ویژگی بالای ۹۰٪ مؤید سل است و این گزاره درست است.",
            "صحیح است (گزینه‌ای که صحیح نیست)؛ جمله «رنگ‌آمیزی و کشت از نظر باسیل اسید-فست در نیمی از موارد افیوژن مثبت است» کاملاً غلط است؛ در واقعیت، مایع پلور سلی دارای بار باکتریایی بسیار ناچیزی است و «رنگ‌آمیزی مستقیم اسمیر اسید-فست (AFB Smear) مایع پلور در کمتر از ۱۰ درصد (و حداکثر تا ۲۰ درصد در کشت) مثبت می‌شود»؛ ادعای مثبت شدن در نیمی از موارد (۵۰٪) کاملاً نادرست است؛ (تشخیص قطعی نیازمند بیوپسی پلور است)."
        ],
        "exp": "اسمیر مستقیم باسیل اسید-فست مایع پلور سلی در کمتر از ۱۰٪ موارد مثبت می‌شود و ادعای مثبت شدن در نیمی از موارد غلط است.",
        "micro": {
            "lead_fa": "پلوریت سلی (Tuberculous Pleurisy) یک واکنش افزایش حساسیت تأخیری شدید به آنتی‌ژن‌های باسیل مایکوباکتریوم توبرکولوزیس در فضای پلور است. مشخصات مایع پلور: اگزودا با پروتئین بالا، گلوکز پایین تا نرمال، و لنفوسیتوز غالب (بیش از ۸۰٪ لنفوسیت). سطح بالای آدنوزین دآمیناز (ADA > 40 U/L) ارزش تشخیصی فوق‌العاده‌ای دارد. به دلیل کم بودن تعداد باسیل‌ها در مایع (Paucibacillary)، اسمیر مستقیم اسید فست در کمتر از ۱۰٪ موارد مثبت است و بیوپسی پلور لازم است.",
            "lead_en": "Tuberculous pleurisy represents a delayed-type hypersensitivity reaction provoked by rupture of a subpleural caseous focus into the pleural space. The effusion is an exudate dominated by mature lymphocytes with elevated adenosine deaminase (ADA >40-50 U/L). Because the fluid is paucibacillary, direct AFB smear examination is notoriously insensitive (<10% positive); asserting it is positive in half of cases is false.",
            "golden_fa": "مایع پلور سلی: لنفوسیت غالب + ADA بالای ۴۰-۵۰؛ رنگ‌آمیزی مستقیم اسمیر باسیل کخ در کمتر از ۱۰٪ موارد مثبت می‌شود.",
            "golden_en": "TB pleural effusion: lymphocyte predominance + ADA >40-50; direct AFB smear positivity is very low (<10%).",
            "points_fa": [
                "سلول‌های مزوتلیال در مایع پلورال سلی به ندرت (کمتر از ۵٪) دیده می‌شوند و حضور آن‌ها شک به سل را کم می‌کند.",
                "کشت مایع پلور برای باسیل سل در حدود ۳۰ درصد موارد مثبت است.",
                "بیوپسی بسته یا توراکوسکوپیک سوزنی پلور با حساسیت بالای ۸۵ تا ۹۰ درصد گرانولوم‌های کازئیفیه را نشان می‌دهد.",
                "درمان استاندارد با رژیم دارویی ضدسل چهارگانه به مدت ۶ ماه است."
            ],
            "points_en": [
                "Pleural fluid mesothelial cells are characteristically sparse (<5%) in TB pleurisy; their presence argues against tuberculosis.",
                "Mycobacterial culture of pleural fluid yields positive results in approximately 30-40% of cases.",
                "Percutaneous needle pleural biopsy or thoracoscopic biopsy demonstrates necrotizing caseating granulomas in >85%.",
                "Standard therapy mandates a standard 6-month course of four-drug antituberculous chemotherapy."
            ]
        }
    },
    213: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: واکسیناسیون هپاتیت B دقیقاً با پروفایل اختصاصی Anti-HBs مثبت به صورت ایزوله همراه با منفی بودن HBsAg و Anti-HBc مطابقت کامل دارد.",
            "نادرست است؛ دلیل رد: عفونت در گذشته بسیار دور گاهی با افت تیتر Anti-HBc به سطوح غیرقابل اندازه‌گیری می‌تواند این تابلو را تقلید کند.",
            "نادرست است؛ دلیل رد: نتیجه مثبت کاذب سرولوژیک یک احتمال آزمایشگاهی شناخته‌شده است.",
            "صحیح است (وضعیتی که کمتر با یافته‌ها مطابقت دارد)؛ «ناقل مزمن هپاتیت B (Low-level hepatitis B carrier)» بر اساس تعریف بیولوژیک و تشخیصی باید «آنتی‌ژن سطحی هپاتیت B (HBsAg مثبت) و آنتی‌بادی ضد هسته (Anti-HBc مثبت)» داشته باشد؛ غیرممکن است فردی ناقل بیماری هپاتیت B باشد اما هم HBsAg منفی باشد و هم Anti-HBc منفی باشد و فقط آنتی‌بادی خنثی‌کننده Anti-HBs مثبت باشد؛ بنابراین این یافته‌ها کمترین مطابقت را با ناقل هپاتیت دارند."
        ],
        "exp": "در ناقل هپاتیت B، آنتی‌ژن HBsAg مثبت است؛ وجود Anti-HBs مثبت منفرد نشانه ایمنی ناشی از واکسیناسیون است و با ناقل مطابقت ندارد.",
        "micro": {
            "lead_fa": "تفسیر آزمایشگاهی مارکرهای سرولوژی هپاتیت B بنیادین است: ۱) ایمنی ناشی از واکسیناسیون: Anti-HBs مثبت به صورت ایزوله همراه با منفی بودن قطعی تمام مارکرهای دیگر (HBsAg منفی و Anti-HBc منفی)؛ ۲) بهبود طبیعی از عفونت قبلی: حضور توأم Anti-HBs مثبت و Anti-HBc IgG مثبت؛ ۳) وضعیت ناقل مزمن یا هپاتیت مزمن: HBsAg مثبت به مدت بیش از ۶ ماه به همراه Anti-HBc مثبت. بنابراین فردی با HBsAg منفی و Anti-HBc منفی به هیچ وجه نمی‌تواند ناقل هپاتیت باشد.",
            "lead_en": "Serologic interpretation of hepatitis B viral markers dictates that isolated anti-HBs positivity with negative HBsAg and negative anti-HBc is the diagnostic signature of successful immunization following recombinant hepatitis B vaccination. Chronic hepatitis B carriage is defined by persistent HBsAg positivity (>6 months) alongside positive anti-HBc; it is biochemically impossible for a carrier to be HBsAg negative and isolated anti-HBs positive.",
            "golden_fa": "مارکرهای هپاتیت: Anti-HBs مثبت منفرد با منفی بودن بقیه = ایمنی با واکسن؛ این تابلو به هیچ وجه با ناقل مطابقت ندارد.",
            "golden_en": "Hepatitis B serology: isolated anti-HBs positive = post-vaccination immunity; completely incompatible with a chronic carrier state.",
            "points_fa": [
                "تیتر Anti-HBs بالای ۱۰ میلی‌واحد بین‌المللی در میلی‌لیتر نشان‌دهنده ایمنی محافظت‌کننده کامل است.",
                "آنتی‌بادی Anti-HBc IgM نشانه عفونت حاد هپاتیت B در ۶ ماه اول است.",
                "آنتی‌بادی Anti-HBc Total (IgG) مادام‌العمر در هر فردی که با ویروس طبیعی تماس داشته مثبت باقی می‌ماند.",
                "ناقل غیرفعال هپاتیت B دارای HBsAg مثبت، HBeAg منفی و سطح پایین HBV DNA است."
            ],
            "points_en": [
                "An anti-HBs titer ≥10 mIU/mL verifies long-term protective immunity against hepatitis B infection.",
                "IgM anti-HBc is the specific seromarker identifying acute hepatitis B virus infection during the window period.",
                "Total anti-HBc persists indefinitely following exposure to natural wild-type virus, absent in vaccinated cohorts.",
                "Inactive chronic carriers display persistent HBsAg, negative HBeAg, normal transaminases, and low viral loads."
            ]
        }
    },
    214: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: سی‌تی‌اسکن شکم در ساعات اولیه (زیر ۴۸ تا ۷۲ ساعت) در غیاب شک تشخیصی اندیکاسیون ندارد زیرا وسعت واقعی نکروز هنوز پدیدار نشده است.",
            "صحیح است؛ در یک بیمار با تشخیص قطعی پانکراتیت حاد (درد شدید کمربندی اپی‌گاستر با انتشار به پشت و آمیلاز ۶ برابر نرمال) که تحت احیای مایعات وریدی با رینگر لاکتات قرار گرفته است، اقدام ضروری و انسانی بعدی «تجویز فوری داروهای ضددرد قوی (مانند اپیوئیدها نظیر فنتانیل، بوپرنورفین یا مورفین)» جهت تسکین درد زجرآور بیمار و مهار پاسخ سمپاتیک سیستمیک است؛ کنترل درد از اصول اساسی مدیریت اولیه پانکراتیت حاد است.",
            "نادرست است؛ دلیل رد: تجویز پروفیلاکتیک آنتی‌بیوتیک در پانکراتیت حاد به طور روتین توصیه نمی‌شود و ممنوع است.",
            "نادرست است؛ دلیل رد: سنجش CA19-9 تومورمارکر آدنوکارسینوم پانکراس است و نقشی در مدیریت اورژانس پانکراتیت حاد ندارد."
        ],
        "exp": "کنترل فوری درد با مسکن‌های اپیوئیدی قوی در کنار مایع‌درمانی، اقدام درمانی ضروری و بعدی در پانکراتیت حاد است.",
        "micro": {
            "lead_fa": "در برخورد با پانکراتیت حاد، پس از شروع احیای سریع مایعات با سرم رینگر لاکتات، مدیریت درد شدید و زجرآور اولویت بعدی است. داروهای مسکن اپیوئیدی (نظیر هیدرومورفون، فنتانیل یا مورفین) داروهای انتخابی ایمن برای کنترل درد هستند (فرضیه قدیمی اسپاسم اسفنگتر اودی با مورفین از نظر بالینی رد شده است). سی‌تی‌اسکن در ۴۸ ساعت اول فاقد ارزش تعیین نکروز است و آنتی‌بیوتیک پروفیلاکسی نیز جایگاهی ندارد.",
            "lead_en": "Immediate management of acute pancreatitis fundamentally couples early goal-directed crystalloid hydration (lactated Ringer's) with aggressive analgesia. Intravenous opioids (hydromorphone, fentanyl, morphine) represent the definitive standard of care to relieve severe visceral pain; historical concerns regarding morphine-induced sphincter of Oddi spasm are clinically unsubstantiated. Routine prophylactic antibiotics are contraindicated.",
            "golden_fa": "اقدام بعدی در پانکراتیت حاد پس از شروع سرم: تجویز مسکن‌های ضد درد قوی (اپیوئیدها)؛ سی‌تی‌اسکن زودرس لازم نیست.",
            "golden_en": "Next step in acute pancreatitis after hydration = immediate multimodal analgesia with potent opioids.",
            "points_fa": [
                "انجام سونوگرافی اولیه جهت بررسی سنگ کیسه صفرا و اتساع مجرای مشترک صفراوی (کلدوک) الزامی است.",
                "سی‌تی‌اسکن با کنتراست شکم در صورتی که بیمار پس از ۴۸ تا ۷۲ ساعت بهبود نیابد انجام می‌شود.",
                "تغذیه روده‌ای زودهنگام (به محض تحمل بیمار) سد مخاطی روده را حفظ کرده و عفونت را کم می‌کند.",
                "آنتی‌بیوتیک‌ها تنها در صورت اثبات بالینی نکروز عفونی پانکراس (معمولاً بعد از هفته دوم) تجویز می‌شوند."
            ],
            "points_en": [
                "Transabdominal ultrasonography is mandatory upon admission to screen for biliary cholelithiasis and choledocholithiasis.",
                "Contrast-enhanced abdominal CT is indicated after 48-72 hours if clinical deterioration or necrotizing complications arise.",
                "Early oral or enteral feeding once pain wanes preserves gut barrier architecture, blunting bacterial translocation.",
                "Broad-spectrum antibiotics are restricted to confirmed infected pancreatic necrosis, typically developing after week two."
            ]
        }
    },
    215: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: آنمی همولیتیک در والدنشتروم با واسطه آنتی‌بادی مونوکلونال IgM علیه آنتی‌ژن I گلبول‌های قرمز (بیماری آگلوتینین سرد) رخ می‌دهد.",
            "نادرست است؛ دلیل رد: در این بیمار با رتیکولوسیت بالا (۶/۵٪) و LDH بالا (۱۵۰۰)، آنمی همولیتیک اتوایمیون سرد مزمن وجود دارد.",
            "صحیح است (عبارتی که در مورد درمان نادرست است)؛ در آنمی همولیتیک ناشی از ماکروگلوبولینمی والدنشتروم که با واسطه آنتی‌بادی‌های IgM (سندرم آگلوتینین سرد / Cold Agglutinin Disease) ایجاد می‌شود، تخریب گلبول‌های قرمز اوپسونیزه‌شده با جزء C3b کمپلمان «در کبد توسط سلول‌های کوپفر» صورت می‌گیرد نه در طحال؛ بنابراین طبق اصول هماتولوژی «اسپلنکتومی در درمان همولیز با واسطه IgM به هیچ وجه مؤثر نبوده و کاملاً بی‌اثر است»؛ بنابراین مؤثر بودن اسپلنکتومی گزاره‌ای غلط است.",
            "نادرست است؛ دلیل رد: تجویز آنتی‌بادی مونوکلونال ضد CD20 (ریتوکسیماب) در بیش از ۶۰ درصد بیماران موجب پاسخ هماتولوژیک و رفع همولیز می‌گردد."
        ],
        "exp": "در بیماری آگلوتینین سرد (IgM) در والدنشتروم، همولیز در کبد رخ می‌دهد و اسپلنکتومی کاملاً بی‌اثر و نادرست است.",
        "micro": {
            "lead_fa": "ماکروگلوبولینمی والدنشتروم یک نئوپلاسم لنفوپلاسموسیتیک با تولید پاراپروتئین مونوکلونال IgM است. در صورت بروز آنمی همولیتیک اتوایمیون در والدنشتروم، آنتی‌بادی‌های IgM به عنوان آگلوتینین سرد عمل کرده و آبشار کمپلمان را تا مرحله C3b فعال می‌سازند. تخریب این گلبول‌ها توسط ماکروفاژهای کبد صورت می‌پذیرد؛ به همین دلیل برعکس آنمی همولیتیک گرم (IgG)، اسپلنکتومی و کورتیکواستروئیدها در آگلوتینین سرد کاملاً بی‌اثر هستند. درمان انتخابی داروی بیولوژیک ریتوکسیماب است.",
            "lead_en": "Waldenstrom's macroglobulinemia produces monoclonal IgM that can function as a cold agglutinin, fixing complement (C3b) onto erythrocytes at cooler temperatures. Extravascular clearance of C3b-opsonized red cells occurs predominantly within hepatic Kupffer cells rather than the splenic red pulp; consequently, splenectomy is entirely ineffective in IgM-mediated cold hemolytic disease. Rituximab is the cornerstone therapy.",
            "golden_fa": "آنمی همولیتیک با واسطه IgM در والدنشتروم = همولیز در کبد؛ اسپلنکتومی در درمان آن کاملاً بی‌اثر است.",
            "golden_en": "IgM cold agglutinin hemolysis in Waldenstrom's occurs in the liver; splenectomy is completely ineffective.",
            "points_fa": [
                "بیمار با رتیکولوسیت ۶/۵٪ و LDH ۱۵۰۰ تابلوی همولیز آشکار دارد.",
                "پلاسمافرزیس در موارد سندرم هایپرویسکوزیته (اختلال هوشیاری و خونریزی مخاطی) درمان اورژانس است.",
                "ریتوکسیماب با مهار کلون‌های لنفوپلاسموسیتیک تولیدکننده IgM آنمی را کنترل می‌کند.",
                "پرهیز از مواجهه با هوای سرد اساسی‌ترین اقدام غیردارویی در سندرم آگلوتینین سرد است."
            ],
            "points_en": [
                "The biochemical profile displaying 6.5% reticulocytosis and LDH 1,500 IU/L validates active hemolysis.",
                "Therapeutic plasma exchange (plasmapheresis) is indicated emergently for acute IgM-driven hyperviscosity syndrome.",
                "Rituximab-based chemoimmunotherapy targets underlying CD20+ lymphoplasmacytic clones, achieving sustained remissions.",
                "Avoidance of cold exposure remains an indispensable non-pharmacologic directive for cold agglutinin disease."
            ]
        }
    },
    216: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: بیماری داسی‌شکل خالص هموزیگوت (HbSS) به طور کلاسیک با اندیس‌های گلبولی نرموسیتیک (MCV نرمال بین ۸۰ تا ۹۰) تظاهر می‌یابد و میکروسیتوز شدید با MCV=70 با آن همخوانی ندارد.",
            "صحیح است؛ وجود کریزهای دردناک داسی‌شکل و نکروز آواسکولار سر فمور همراه با الکتروفورز نشان‌دهنده «فقدان کامل هموگلوبین A (نسبت HbS/A = 100/0)» و «میکروسیتوز بارز گلبول‌های قرمز (MCV=70)»، تابلوی پاتوگنومونیک «بیماری تالاسمی داسی‌شکل بتا صفر (HbS/Beta-0 Thalassemia)» است؛ در این سندرم، فرد یک ژن بتا داسی‌شکل و یک ژن تالاسمی بتا صفر را به ارث برده که به دلیل خاموش بودن کامل ژن بتای طبیعی، هیچ هموگلوبین A تولید نمی‌شود و تالاسمی موجب میکروسیتوز شدید می‌گردد.",
            "نادرست است؛ دلیل رد: در سندرم S/Beta+ تالاسمی، ژن بتا هنوز مقداری هموگلوبین A می‌سازد و HbA در حد ۵ تا ۳۰ درصد وجود دارد و نسبت ۱۰۰ به صفر نیست.",
            "نادرست است؛ دلیل رد: در بیماری هموگلوبین SC، در الکتروفورز هموگلوبین C در کنار HbS به میزان مساوی دیده می‌شود."
        ],
        "exp": "فقدان کامل HbA در الکتروفورز (HbS=100%) همراه با میکروسیتوز شدید (MCV=70)، تابلوی HbS/Beta-0 تالاسمی است.",
        "micro": {
            "lead_fa": "افتراق سندرم‌های داسی‌شکل با استفاده از اندیس‌های سلولی MCV و الکتروفورز هموگلوبین صورت می‌پذیرد: ۱) کم‌خونی داسی‌شکل هموزیگوت (HbSS): الکتروفورز HbS غالب دارد اما MCV نرموسیتیک (بالای ۸۰) است؛ ۲) بیماری HbS/Beta-0 تالاسمی: الکتروفورز کاملاً فاقد HbA است (۱۰۰٪ HbS شبیه به HbSS) اما همراه با میکروسیتوز شدید (MCV < 75) است؛ ۳) بیماری HbS/Beta+ تالاسمی: میکروسیتیک است اما مقداری هموگلوبین A (بین ۵ تا ۳۰ درصد) در الکتروفورز شناسایی می‌شود.",
            "lead_en": "Differentiating sickling hemoglobinopathies integrates MCV indices with quantitative hemoglobin electrophoresis. Homozygous sickle cell anemia (HbSS) produces predominantly HbS with normal MCV (normocytic). Sickle-beta-0-thalassemia (HbS/Beta-0) exhibits a total absence of HbA (HbS 100%) indistinguishable from HbSS on electrophoresis, but features pronounced microcytosis (MCV 70 fL) driven by the co-inherited beta-zero thalassemic allele.",
            "golden_fa": "کریزهای داسی‌شکل + الکتروفورز فاقد HbA (۱۰۰٪ HbS) + میکروسیتوز شدید (MCV=70) = تالاسمی داسی‌شکل S/Beta-0.",
            "golden_en": "Sickle vaso-occlusion + zero HbA (100% HbS) + microcytosis (MCV 70) = sickle-beta-0 thalassemia.",
            "points_fa": [
                "نکروز آسپتیک سر فمور (AVN) ناشی از انسداد عروقی میکروواسکولار در مفاصل است.",
                "درمان با هیدروکسی‌اوره سطح HbF را بالا برده و فراوانی کریزهای دردناک را به شدت کم می‌کند.",
                "واکسیناسیون علیه کپسول‌دارهای باکتریایی به علت اتواسپبلنکتومی در تمام این بیماران الزامی است.",
                "اسپاسم و چسبندگی گلبول‌های قرمز داسی منجر به ایسکمی و انفارکتوس‌های بافتی مکرر می‌گردد."
            ],
            "points_en": [
                "Avascular osteonecrosis of the femoral head results from microvascular vaso-occlusion and marrow infarction.",
                "Hydroxyurea therapy augments fetal hemoglobin (HbF) synthesis, substantially diminishing painful vaso-occlusive crises.",
                "Encapsulated bacterial immunization is mandatory due to functional hyposplenism from repetitive micro-infarctions.",
                "Polymerization of deoxygenated HbS molecules drives erythrocyte sickling, endothelial adhesion, and ischemia."
            ]
        }
    },
    217: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: سیروز کبدی با تست‌های کبدی مختل، کاهش آلبومین، اختلال انعقادی و هایپربیلی‌روبینمی مختلط تظاهر می‌یابد.",
            "نادرست است؛ دلیل رد: سندرم ژیلبرت یک وضعیت خوش‌خیم بدون آنمی است و با هموگلوبین پایین Hb=10 مطابقت ندارد.",
            "نادرست است؛ دلیل رد: سندرم کریگلر-نجار یک بیماری ژنتیکی شدید مادرزادی نوزادان با بیلی‌روبین‌های بسیار بالا (بالای ۲۰ در تیپ ۱) است.",
            "صحیح است؛ وجود آنمی نرموسیتیک (Hb=10, MCV=98) همراه با زردی و هایپربیلی‌روبینمی غیرکونژوگه خالص (بیلی‌روبین توتال ۵ با بیلی‌روبین مستقیم ۰/۸ یعنی بیلی‌روبین غیرمستقیم بالای ۴/۲) در حضور آنزیم‌های کاملاً طبیعی کبدی (ALT=20, ALP=120)، تابلوی کلاسیک و پاتوگنومونیک «همولیز (Hemolysis / آنمی همولیتیک)» است؛ تولید بیش از حد بیلی‌روبین ناشی از تخریب گلبول‌های قرمز از ظرفیت کونژوگاسیون کبد سالم فراتر رفته است."
        ],
        "exp": "آنمی همراه با هایپربیلی‌روبینمی غیرمستقیم غالب و آنزیم‌های کبدی نرمال، مشخصه همولیز (Hemolysis) است.",
        "micro": {
            "lead_fa": "در رویکرد تشخیصی به ایکتر، تعیین نوع بیلی‌روبین قدم اول است. هایپربیلی‌روبینمی غیرکونژوگه (غیرمستقیم بیش از ۸۰ تا ۸۵ درصد بیلی‌روبین تام) به سه علت عمده رخ می‌دهد: همولیز، اریتروپوئز ناکارآمد، و نقایص ژنتیکی آنزیم گلوکورونیل ترانسفراز (سندرم ژیلبرت و کریگلر-نجار). در یک فرد بالغ مبتلا به آنمی (افت هموگلوبین) با آنزیم‌های کبدی کاملاً طبیعی، همولیز محتمل‌ترین تشخیص است. بررسی بعدی سنجش رتیکولوسیت، LDH، هاپتوگلوبین و اسمیر خون محیطی است.",
            "lead_en": "Diagnostic evaluation of jaundice starts by fractionating total bilirubin into conjugated versus unconjugated pools. Unconjugated hyperbilirubinemia (>80% indirect fraction) alongside normocytic anemia and completely preserved liver enzymes in an adult is the clinical hallmark of hemolysis. Accelerated erythrocyte catabolism overwhelms normal hepatic glucuronidation, raising indirect bilirubin.",
            "golden_fa": "آنمی + زردی با بیلی‌روبین غیرمستقیم بالا و آنزیم‌های کبدی طبیعی = همولیز (Hemolysis).",
            "golden_en": "Anemia + jaundice with isolated unconjugated hyperbilirubinemia and normal liver enzymes = hemolysis.",
            "points_fa": [
                "تست‌های تأییدی همولیز شامل افزایش رتیکولوسیت‌ها، افزایش شدید LDH و کاهش یا محو شدن هاپتوگلوبین سرم است.",
                "اسمیر خون محیطی شواهدی نظیر اسفروسیت‌ها یا شیستوسیت‌ها را نشان می‌دهد.",
                "در سندرم ژیلبرت آنمی وجود ندارد و آزمایش خون کامل کاملاً طبیعی است.",
                "انجام تست کومبس مستقیم (DAT) برای تفکیک همولیز اتوایمیون الزامی است."
            ],
            "points_en": [
                "Confirmatory testing incorporates elevated reticulocyte count, markedly increased LDH, and undetectable serum haptoglobin.",
                "Peripheral blood smear analysis readily identifies morphological hallmarks such as spherocytes or fragmented schistocytes.",
                "Gilbert's syndrome preserves entirely normal hemoglobin, erythrocyte morphology, and reticulocyte counts.",
                "Direct antiglobulin test (DAT/Coombs) is mandatory to rule out autoimmune hemolytic anemia (AIHA)."
            ]
        }
    },
    218: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: هدف رساندن هموگلوبین به ارقام غیرواقعی نظیر ۱۵ در زنان جوان نیست.",
            "نادرست است؛ دلیل رد: عدد ۱۱ همچنان در محدوده آنمی ملایم است و درمان ناکافی تلقی می‌شود.",
            "نادرست است؛ دلیل رد: با برطرف شدن علائم بالینی یا طبیعی شدن هموگلوبین نباید آهن را قطع کرد زیرا ذخایر هنوز تخلیه هستند.",
            "صحیح است؛ هدف غایی و استاندارد در درمان دارویی کم‌خونی فقر آهن (Iron Deficiency Anemia)، دو مرحله دارد: «۱) اصلاح و طبیعی شدن سطح هموگلوبین (Normalizing Hemoglobin)؛ به علاوه ۲) بازسازی و اصلاح کامل ذخایر آهن بدن (Replenishing Iron Stores / به حد نرمال رساندن فریتین)»؛ به همین دلیل بر اساس تمام راهنماهای پزشکی، درمان با آهن خوراکی باید «به مدت ۳ تا ۶ ماه پس از طبیعی شدن هموگلوبین» ادامه یابد تا ذخایر آهن در مغز استخوان و کبد کاملاً احیا گردند."
        ],
        "exp": "هدف درمان کم‌خونی فقر آهن، اصلاح سطح هموگلوبین به همراه پر کردن کامل ذخایر آهن بدن (فریتین) است.",
        "micro": {
            "lead_fa": "در مدیریت دارویی آنمی فقر آهن، قطع زودهنگام قرص آهن به محض طبیعی شدن هموگلوبین شایع‌ترین علت عود سریع کم‌خونی است. تولید گلبول‌های قرمز جدید ابتدا تمام آهن دریافتی را جذب می‌کند و ذخایر بافتی مغز استخوان (فریتین) همچنان خالی می‌مانند. بنابراین هدف کامل درمانی شامل اصلاح سطح هموگلوبین به محدوده طبیعی و ادامه تجویز آهن خوراکی به مدت ۳ تا ۶ ماه دیگر جهت رسیدن سطح فریتین سرم به بالای ۵۰ تا ۱۰۰ نانوگرم بر میلی‌لیتر است.",
            "lead_en": "The therapeutic objective in iron deficiency anemia extends beyond normalizing hemoglobin concentration; it fundamentally mandates the complete replenishment of depleted systemic iron stores (ferritin). Erythropoiesis preferentially utilizes newly administered iron, leaving marrow storage pools depleted; oral iron therapy must therefore be sustained for an additional 3 to 6 months post-Hb normalization.",
            "golden_fa": "هدف درمان کم‌خونی فقر آهن = طبیعی شدن هموگلوبین به علاوه بازسازی کامل ذخایر آهن بدن (فریتین).",
            "golden_en": "Goal of iron deficiency anemia therapy = normalizing hemoglobin plus fully replenishing bone marrow iron stores.",
            "points_fa": [
                "افزایش رتیکولوسیت‌ها اولین نشانه پاسخ درمانی است که ظرف ۵ تا ۷ روز پس از شروع آهن دیده می‌شود.",
                "هموگلوبین معمولاً ظرف ۶ تا ۸ هفته به حد نرمال بازمی‌گردد.",
                "آهن خوراکی (سولفات فرو) بهتر است با معده خالی یا همراه با ویتامین C مصرف شود تا جذب بهتری داشته باشد.",
                "فریتین سرم دقیق‌ترین بیومارکر برای سنجش پر شدن مجدد ذخایر آهن بدن است."
            ],
            "points_en": [
                "A reticulocyte surge peaking between days 5 and 7 represents the earliest objective laboratory sign of response.",
                "Hemoglobin levels systematically normalize within 6 to 8 weeks of compliant oral iron supplementation.",
                "Ferrous sulfate absorption is optimized on an empty stomach or co-ingested with ascorbic acid (vitamin C).",
                "Serum ferritin represents the definitive biomarker verifying satisfactory reconstitution of reticuloendothelial storage pools."
            ]
        }
    },
    219: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: زندگی با افراد سیگاری (دود دست دوم / Passive Smoking) یک فاکتور خطر اثبات‌شده است که ریسک کانسر ریه را ۲۰ تا ۳۰ درصد بالا می‌برد.",
            "نادرست است؛ دلیل رد: مواجهه با آزبست فاکتور خطر قوی برای کانسر ریه و مزوتلیوما است و اثر هم‌افزا با سیگار دارد.",
            "نادرست است؛ دلیل رد: مواجهه شغلی با مشتقات نفتی، رادون و هیدروکربن‌های آروماتیک پلی‌سیکلیک از ریسک‌فاکتورهای ثابت‌شده ریه هستند.",
            "صحیح است (موردی که ریسک‌فاکتور کانسر ریه نیست)؛ «رژیم غذایی پرکالری (High-Calorie Diet)» ارتباط اپیدمیولوژیک و علمی اثبات‌شده‌ای با بروز کارسینوم ریه ندارد (رژیم‌های پرکالری و چربی بیشتر با سرطان‌های کولون، پستان و پروستات مرتبط هستند)؛ عوامل خطر اصلی کانسر ریه استنشاقی و محیطی شامل: دود سیگار (فعال و غیرفعال)، آزبست، رادون، آرسنیک و آلودگی هوا هستند."
        ],
        "exp": "دود سیگار محیطی، آزبست و مشتقات نفتی ریسک‌فاکتورهای ریه هستند؛ رژیم پرکالری عامل خطر کانسر ریه نیست.",
        "micro": {
            "lead_fa": "عوامل خطرساز سرطان ریه عمدتاً از طریق استنشاق مواد سرطان‌زا و جهش در سلول‌های اپیتلیوم مجاری تنفسی عمل می‌کنند. مهم‌ترین عوامل خطر: ۱) استعمال دخانیات (مسبب بیش از ۸۵٪ موارد)؛ ۲) مواجهه غیرفعال با دود سیگار (Passive smoking)؛ ۳) گاز رادون (دومین علت در افراد غیرسیگاری)؛ ۴) مواجهه شغلی با آزبست، مشتقات نفتی و فلزات سنگین؛ ۵) سابقه بیماری‌های انسدادی و فیبروز ریه. رژیم غذایی پرکالری هیچ ارتباط سببیتی با سرطان ریه ندارد.",
            "lead_en": "Etiological risk factors driving lung cancer primarily operate through inhalational mutagenic carcinogens. Proven triggers encompass active cigarette smoking, involuntary passive environmental tobacco smoke exposure (elevating risk by 20-30%), occupational asbestos exposure, and petroleum/radon derivatives. High-calorie diets carry zero verified causal association with bronchogenic carcinoma.",
            "golden_fa": "ریسک‌فاکتورهای کانسر ریه: سیگار (فعال و غیرفعال)، آزبست و مواد نفتی؛ رژیم پرکالری جزء عوامل خطر ریه نیست.",
            "golden_en": "Lung cancer risk factors: active/passive smoking, asbestos, petroleum products; high-calorie diet is not a risk factor.",
            "points_fa": [
                "هم‌افزایی دود سیگار و آزبست ریسک کانسر ریه را تا بیش از ۵۰ برابر افزایش می‌دهد.",
                "دود دست دوم حاوی بیش از ۶۰ ماده کارسینوژن شناخته‌شده است.",
                "غربالگری سالانه با سی‌تی‌اسکن با دوز کم تابش (Low-dose CT) در افراد ۵۰ تا ۸۰ سال با سابقه ۲۰ سال/بسته سیگار توصیه می‌شود.",
                "آلودگی هوای شهری با ذرات معلق کمتر از ۲/۵ میکرون ریسک کارسینوم ریه را بالا می‌برد."
            ],
            "points_en": [
                "Concomitant exposure to asbestos and cigarette smoke synergistically multiplies lung cancer risk up to fifty-fold.",
                "Secondhand tobacco smoke exposes non-smokers to over sixty established classified chemical carcinogens.",
                "Annual low-dose helical chest CT screening is guideline-recommended for individuals aged 50-80 with a ≥20 pack-year history.",
                "Ambient outdoor particulate air pollution (PM 2.5) constitutes an established environmental respiratory carcinogen."
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
    for idx, enrich in ENRICHMENTS_BATCH7.items():
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
