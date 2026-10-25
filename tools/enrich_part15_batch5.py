#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enrichment script for Part 15 Batch 5 (Questions 120 to 149)
Target payload: work/tools/master-bank/import-payload.master-preint.part15.json
Note: Per user instructions, question_fa and options_fa are preserved exactly as original.
Only options_why_fa, explanation_fa, and micro are enriched.
"""

import json
import sys

PAYLOAD_PATH = "work/tools/master-bank/import-payload.master-preint.part15.json"

ENRICHMENTS_BATCH5 = {
    120: {
        "whys": [
            "نادرست است؛ دلیل رد: کیست ساب‌کندرال (Subchondral pseudocyst) از یافته‌های کلاسیک رادیوگرافی در استئوآرتریت پیشرفته است.",
            "صحیح است (یافته‌ای که قابل انتظار نیست)؛ «خوردگی یا اروزیون استخوانی (Bone Erosion)» مشخصه رادیولوژیک بیماری‌های التهابی سینوویوم به ویژه آرتریت روماتوئید است؛ در بیماری استئوآرتریت اولیه روند بیماری تولید استخوان (استئوفیت) و اسکلروز است و اروزیون استخوانی به هیچ وجه دیده نمی‌شود.",
            "نادرست است؛ دلیل رد: کاهش نامتقارن فاصله مفصلی (Joint space narrowing) علامت مشخصه از دست رفتن غضروف در آرتروز است.",
            "نادرست است؛ دلیل رد: تشکیل استئوفیت در لبه‌های مفصل شایع‌ترین و پاتوگنومونیک‌ترین یافته رادیوگرافی در استئوآرتریت است."
        ],
        "exp": "اروزیون استخوانی مشخصه آرتریت‌های التهابی نظیر RA است و در استئوآرتریت اولیه هرگز دیده نمی‌شود.",
        "micro": {
            "lead_fa": "چهار ویژگی رادیوگرافی کلاسیک استئوآرتریت اولیه عبارتند از: ۱) کاهش نامتقارن فضای مفصلی (به‌ویژه در کمپارتمان داخلی زانو)؛ ۲) اسکلروز استخوان زیر غضروف (Subchondral sclerosis)؛ ۳) استئوفیت‌های لبه‌ای (Marginal osteophytes)؛ ۴) کیست‌های زیر غضروفی. وجود اروزیون استخوانی در گرافی زانو یا مفاصل دست فوراً تشخیص استئوآرتریت اولیه را زیر سؤال برده و مطرح‌کننده آرتریت روماتوئید یا استئوآرتریت اروزیو است.",
            "lead_en": "The classic radiographic tetrad of primary osteoarthritis comprises asymmetric joint space narrowing, subchondral bone sclerosis, marginal osteophyte formation, and subchondral pseudocysts. Focal osseous erosions are strictly non-existent in primary OA, serving as the cardinal radiographic hallmark of rheumatoid arthritis.",
            "golden_fa": "علائم رادیولوژی استئوآرتریت: استئوفیت، اسکلروز ساب‌کندرال و تنگی فضا؛ وجود اروزیون نشانه RA است نه آرتروز.",
            "golden_en": "Radiographic features of OA: osteophytes, subchondral sclerosis, space narrowing; bone erosion denotes RA.",
            "points_fa": [
                "استئوفیت‌های لبه‌ای حساس‌ترین یافته رادیولوژیک در اثبات استئوآرتریت هستند.",
                "کاهش فضای مفصلی در استئوآرتریت برعکس آرتریت روماتوئید به صورت نامتقارن رخ می‌دهد.",
                "رادیوگرافی در وضعیت ایستاده (Weight-bearing) برای بررسی دقیق فاصله مفصلی زانو الزامی است.",
                "در آرتریت روماتوئید، پوکی استخوان اطراف مفصلی (Juxta-articular osteopenia) همراه با اروزیون دیده می‌شود."
            ],
            "points_en": [
                "Marginal osteophytes represent the single most sensitive radiographic feature verifying established osteoarthritis.",
                "Joint space loss in osteoarthritis is characteristically asymmetric, contrasting with uniform concentric narrowing in RA.",
                "Standing weight-bearing knee films are mandatory to reliably assess true functional tibiofemoral joint space.",
                "Rheumatoid arthritis uniquely couples early marginal erosions with prominent periarticular osteopenia."
            ]
        }
    },
    121: {
        "whys": [
            "نادرست است؛ دلیل رد: استئوآرتریت یک بیماری کل ارگان مفصل است و تغییرات در غضروف، استخوان، سینوویوم و کپسول دیده می‌شود.",
            "نادرست است؛ دلیل رد: چاقی در خانم‌ها هم از نظر مکانیکی و هم ترشح ادیپوکین‌ها فاکتور خطر بسیار قوی‌تری برای آرتروز زانو است.",
            "نادرست است؛ دلیل رد: غضروف مفصل مچ پا مقاومت فیزیولوژیک بالایی در برابر تنش‌ها دارد و آرتروز مچ پا بسیار نادرتر از زانو است.",
            "صحیح است (جمله‌ای که صحیح نیست)؛ بررسی‌های ژنتیکی نشان داده است که توارث و نقص ژنتیکی در «استئوآرتریت دست‌ها (به‌ویژه فرم ندولار با گره‌های هبردن با توارث بیش از ۶۵ درصد)» به مراتب بارزتر از نوع ژنرالیزه یا ابتلای منفرد هیپ و زانو است؛ بنابراین بیان اینکه نقص ژنتیک در نوع ژنرالیزه بیشتر از دست به تنهایی است نادرست می‌باشد."
        ],
        "exp": "نقص ژنتیکی و توارث در آرتروز مفاصل دست (گره‌های هبردن) بالاترین میزان (بیش از ۶۵٪) را در میان تمام انواع دارد.",
        "micro": {
            "lead_fa": "نقش ژنتیک در استئوآرتریت بسیار وابسته به موضع مفصلی است. بالاترین میزان وراثت‌پذیری ژنتیکی (Heritability تا حدود ۶۵ درصد) مربوط به استئوآرتریت دست‌ها (مفاصل DIP و PIP با گره‌های هبردن و بوچارد) است که اغلب الگوی توارث اتوزومال غالب با نفوذپذیری بالا در زنان بعد از یائسگی دارد. در مقابل، استئوآرتریت مفاصل بزرگ (زانو و هیپ) به میزان بیشتری تحت تأثیر فاکتورهای محیطی، مکانیکی، بیومکانیک و چاقی قرار دارد.",
            "lead_en": "Genetic predisposition within osteoarthritis exhibits striking phenotypic variation. Hand osteoarthritis (nodal Heberden/Bouchard disease) displays the highest heritability (>65%), showing strong autosomal dominant transmission in postmenopausal women. Conversely, knee and hip osteoarthritis are predominantly governed by mechanical load and obesity.",
            "golden_fa": "بالاترین وراثت ژنتیکی در استئوآرتریت مربوط به درگیری مفاصل دست (گره‌های هبردن) است نه نوع ژنرالیزه یا زانو.",
            "golden_en": "Highest genetic heritability in OA belongs to nodal hand osteoarthritis (Heberden nodes), exceeding hip/knee forms.",
            "points_fa": [
                "گره‌های هبردن در مفاصل DIP ناشی از برجستگی‌های استئوفیتی با توارث بالا در زنان هستند.",
                "مفصل مچ پا به دلیل ویژگی‌های ماتریکس پروتئوگلیکان غضروف در برابر آرتروز اولیه بسیار مقاوم است.",
                "استئوآرتریت به عنوان نارسایی کامل کل ارگان مفصل تعریف می‌شود.",
                "کاهش وزن در زنان ۵۰ درصد ریسک پیشرفت آرتروز علامت‌دار زانو را کم می‌کند."
            ],
            "points_en": [
                "Heberden's nodes at the DIP joints represent bony osteophytic enlargements with pronounced matrilineal heritability.",
                "The talocrural ankle joint possesses unique proteoglycan stiffness, resisting primary osteoarthritic degradation.",
                "Osteoarthritis is pathophysiologically defined as failure of the synovial joint organ as an integrated system.",
                "A modest 5% weight reduction diminishes symptomatic knee osteoarthritis progression in women by over 50%."
            ]
        }
    },
    122: {
        "whys": [
            "نادرست است؛ دلیل رد: اپی‌کوندیلیت خارجی نام علمی همان بیماری آرنج تنیس‌بازان (Tennis Elbow) است و دو بیماری جداگانه نیستند.",
            "نادرست است؛ دلیل رد: بیماری در اکثریت مطلق افراد غیرورزشکار با کارهای یدی تکراری و تایپیست‌ها دیده می‌شود نه فقط تنیس‌بازان.",
            "صحیح است؛ در بیماری اپی‌کوندیلیت خارجی (آرنج تنیس‌بازان / Tennis Elbow) که ناشی از میکروترومای تاندون منشأ اکستنسورهای مچ دست (عضله اکستنسور کارپی رادیالیس برویس ECRB) در محل اتصال به اپی‌کوندیل لترال هومروس است؛ تست تشخیصی بالینی عبارت است از: «بروز درد شدید و ضعف در اکستنشن مچ دست در مقابل مقاومت ایجاد شده توسط معاینه‌کننده (Resisted wrist extension)» یا تست کوزن.",
            "نادرست است؛ دلیل رد: ضعف و درد با فلکسیون مقاومتی مچ دست مربوط به اپی‌کوندیلیت داخلی (آرنج گلف‌بازان) است."
        ],
        "exp": "در اپی‌کوندیلیت خارجی (آرنج تنیس‌بازان)، اکستنشن مچ دست در برابر مقاومت به شدت دردناک و ضعیف می‌شود.",
        "micro": {
            "lead_fa": "اپی‌کوندیلیت لترال (آرنج تنیس‌بازان) ناشی از تاندینوپاتی ناشی از کشیدگی مکرر در منشأ مشترک تاندون‌های اکستانسور ساعد روی اپی‌کوندیل لترال هومروس، به ویژه تاندون عضله Extensor Carpi Radialis Brevis (ECRB) است. ویژگی‌های تشخیصی بالینی: ۱) تندرنس نقطه‌ای شدید در لمس مستقیم روی اپی‌کوندیل لترال؛ ۲) بازتولید درد شدید با اکستنشن مقاومتی مچ دست (تست Cozen)؛ ۳) درد با اکستنشن مقاومتی انگشت سوم (تست Maudsley).",
            "lead_en": "Lateral epicondylitis (tennis elbow) results from angiofibroblastic tendinosis localized to the common extensor origin, specifically the extensor carpi radialis brevis (ECRB). The hallmark clinical sign is sharp lateral epicondylar pain provoked by resisted wrist extension with the elbow in extension (Cozen's test) and resisted middle finger extension.",
            "golden_fa": "اپی‌کوندیلیت خارجی (آرنج تنیس‌بازان) = تندرنس اپی‌کوندیل لترال + درد با اکستنشن مقاومتی مچ دست.",
            "golden_en": "Lateral epicondylitis (tennis elbow) = lateral epicondyle tenderness + pain on resisted wrist extension.",
            "points_fa": [
                "اپی‌کوندیلیت داخلی (آرنج گلف‌بازان) با فلکسیون مقاومتی مچ دست دردناک می‌شود.",
                "بیش از ۹۵ درصد مبتلایان افراد غیرورزشکار نظیر نجاران و کاربران کامپیوتر هستند.",
                "استفاده از بریس کانتربند (Counterforce strap) بار کششی روی تاندون را مهار می‌کند.",
                "تمرینات اکسنتریک کششی عضلات اکستنسور ساعد مؤثرترین درمان فیزیوتراپی است."
            ],
            "points_en": [
                "Medial epicondylitis (golfer's elbow) triggers localized pain upon resisted active wrist flexion and pronation.",
                "Over 95% of presentations arise in non-athletes engaging in repetitive manual forearm pronation/supination.",
                "A counterforce forearm band dissipates tensile forces across the diseased common extensor tendon origin.",
                "Eccentric loading strengthening protocols constitute the single most efficacious physical therapy strategy."
            ]
        }
    },
    123: {
        "whys": [
            "نادرست است؛ دلیل رد: هیدروکسی‌کلروکین در طول تمام دوران بارداری در بیماران لوپوسی ایمن و توصیه می‌شود.",
            "نادرست است؛ دلیل رد: پردنیزولون در بارداری ایمن است زیرا توسط آنزیم ۱۱-بتا هیدروکسی‌استروئید دهیدروژناز جفت غیرفعال می‌شود.",
            "صحیح است (دارویی که منع مصرف مطلق دارد)؛ داروی «متوترکسات (Methotrexate)» به عنوان یک آنتاگونیست اسید فولیک، دارای اثرات شدید تراتوژنیسیته، مرگ جنین، میکروسفالی و ناهنجاری‌های اسکلتی است؛ بنابراین مصرف متوترکسات در تمام طول دوران بارداری «منع مصرف قطعی و مطلق (Category X)» دارد و باید حداقل ۳ ماه قبل از لقاح قطع شود.",
            "نادرست است؛ دلیل رد: آزاتیوپرین (تا دوز ۲ میلی‌گرم/کیلوگرم) در دوران بارداری برای کنترل بیماری لوپوس داروی ایمن و انتخابی است."
        ],
        "exp": "متوترکسات تراتوژن شدید بوده و در دوران بارداری منع مصرف مطلق دارد؛ هیدروکسی‌کلروکین، آزاتیوپرین و کورتون ایمن هستند.",
        "micro": {
            "lead_fa": "در درمان بیماری‌های روماتولوژی در دوران بارداری، تفکیک دقیق داروهای مجاز و ممنوع حیاتی است. داروهای با منع مصرف مطلق شامل: متوترکسات (آنتی‌متابولیت با نقایص شدید مادرزادی جمجمه و صورت و مرگ جنین)، مایکوفنولات موفتیل، لفلونوماید و سیکلوفسفامید هستند. داروهای ایمن در بارداری لوپوسی شامل: هیدروکسی‌کلروکین (که خطر شعله‌وری بیماری و مرگ جنین را کم می‌کند)، پردنیزولون و آزاتیوپرین هستند.",
            "lead_en": "Pharmacotherapy during pregnancy in SLE strictly delineates safe maintenance agents from teratogenic drugs. Methotrexate is an absolute contraindication (Category X) owing to potent dihydrofolate reductase inhibition, provoking embryonic demise, severe craniofacial malformations, and skeletal dysplasias. Hydroxychloroquine, azathioprine, and prednisone are safe.",
            "golden_fa": "داروی با منع مصرف قطعی و تراتوژن در بارداری = متوترکسات؛ داروهای ایمن: هیدروکسی‌کلروکین، کورتون و آزاتیوپرین.",
            "golden_en": "Absolutely contraindicated teratogen in pregnancy = methotrexate; safe agents: HCQ, prednisone, and azathioprine.",
            "points_fa": [
                "متوترکسات باید حداقل ۳ ماه قبل از اقدام به بارداری قطع گردد.",
                "هیدروکسی‌کلروکین نه تنها در بارداری مجاز است بلکه ادامه آن برای بقای جنین و پیشگیری از شعله‌وری توصیه اکید می‌شود.",
                "پردنیزولون به دلیل تجزیه جفتی به گردش خون جنین نفوذ نمی‌کند.",
                "آزاتیوپرین به علت فقدان آنزیم فعال‌کننده در کبد جنین، تراتوژنیک نیست."
            ],
            "points_en": [
                "Methotrexate must be discontinued at least 3 months prior to planned conception alongside folate supplementation.",
                "Hydroxychloroquine continuation through gestation substantially suppresses maternal flares and neonatal lupus.",
                "Prednisone is rapidly inactivated by placental 11-beta-hydroxysteroid dehydrogenase 2, shielding the fetus.",
                "Azathioprine lacks fetal hepatotoxicity due to immature embryonic conversion enzymes, remaining clinically safe."
            ]
        }
    },
    124: {
        "whys": [
            "صحیح است؛ داروهای تعدیل‌کننده بیماری نظیر متوترکسات (DMARDs) برای شروع اثربخشی بالینی و کنترل سینوویت مفاصل نیازمند «حداقل ۶ تا ۱۲ هفته زمان» هستند؛ در بیماری که تنها ۳ هفته از شروع متوترکسات گذشته است، اثربخشی آن هنوز آغاز نشده و قضاوت در مورد شکست درمان زودهنگام است؛ در این بازه زمانی، برای تسکین درد شدید و مهار فوری التهاب فعال بیمار تا زمان اثرگذاری متوترکسات، مناسب‌ترین اقدام «افزایش موقت دوز پردنیزولون (به عنوان پل درمانی / Bridging therapy)» است.",
            "نادرست است؛ دلیل رد: شروع بیولوژیک نظیر اینفلکسی‌ماب حداقل پس از ۳ تا ۶ ماه عدم پاسخ به حداکثر دوز متوترکسات ارزیابی می‌شود نه در هفته سوم.",
            "نادرست است؛ دلیل رد: متوترکسات برای اثربخشی به زمان نیاز دارد و قضاوت در مورد افزایش دوز در هفته سوم خیلی زود است.",
            "نادرست است؛ دلیل رد: جایگزینی با لفلونوماید بسیار زودهنگام است و بیمار هنوز فرصت کافی برای پاسخ به MTX را نداشته است."
        ],
        "exp": "متوترکسات برای اثرگذاری به ۶ تا ۱۲ هفته زمان نیاز دارد؛ در هفته سوم، افزایش موقت دوز استروئید پل درمانی انتخابی است.",
        "micro": {
            "lead_fa": "شروع اثر داروهای تعدیل‌کننده بیماری سنتی (csDMARDs) مانند متوترکسات آهسته بوده و معمولاً بین ۶ تا ۱۲ هفته زمان می‌برد. در بیمار مبتلا به آرتریت روماتوئید که تنها ۳ هفته از شروع درمان می‌گذرد، تداوم درد مفاصل نشان‌دهنده شکست درمانی نیست. راهکار استاندارد روماتولوژی استفاده از کورتیکواستروئیدها به عنوان درمان رابط یا پل درمانی (Bridging therapy) با افزایش موقت دوز پردنیزولون (۱۰ تا ۲۰ میلی‌گرم) جهت مهار التهاب تا شروع اثر متوترکسات است.",
            "lead_en": "Conventional synthetic DMARDs such as methotrexate exhibit an indolent onset of action, typically demanding 6 to 12 weeks to achieve therapeutic synovial suppression. Pain persistence at 3 weeks represents expected pharmacodynamic latency, not therapeutic failure. The correct strategy is temporary corticosteroid bridging via an increase in prednisone dosage.",
            "golden_fa": "متوترکسات بعد از ۶ تا ۱۲ هفته اثر می‌کند؛ در هفته سوم برای کنترل درد = افزایش موقت دوز پردنیزولون (پل درمانی).",
            "golden_en": "Methotrexate requires 6-12 weeks for efficacy; at week 3, severe pain is managed by temporary prednisone escalation.",
            "points_fa": [
                "قضاوت در مورد کفایت دوز یا تعویض متوترکسات حداقل پس از ۳ ماه درمان ارزیابی می‌شود.",
                "پردنیزولون به سرعت ظرف چند روز درد و خشکی صبحگاهی را فرو می‌نشاند.",
                "پس از استقرار اثر متوترکسات در هفته ۸ تا ۱۲، دوز پردنیزولون تدریجاً کاهش یافته و قطع می‌گردد.",
                "مصرف روزانه ۱ میلی‌گرم فولیک اسید جهت کاهش عوارض گوارشی و خونی متوترکسات الزامی است."
            ],
            "points_en": [
                "Formal clinical appraisal of methotrexate efficacy requires a minimum therapeutic trial of 3 months.",
                "Prednisone escalation swiftly dampens pain, swelling, and systemic morning stiffness within days.",
                "Once methotrexate takes effect around weeks 8-12, bridging steroids are systematically tapered to discontinuation.",
                "Daily folic acid co-prescription (1 mg/day) mitigates gastrointestinal, mucosal, and hematologic MTX toxicities."
            ]
        }
    },
    125: {
        "whys": [
            "نادرست است؛ دلیل رد: درد مفصلی نیست زیرا دامنه حرکات زانو نرمال است و افیوژنی وجود ندارد.",
            "صحیح است؛ وجود درد موضعی در قسمت قدامی-داخلی (Anteromedial) زانو با تندرنس شدید در لمس ناحیه پروگزیمال استخوان تیبیا (حدود ۵ سانتی‌متر زیر خط مفصلی زانو) همراه با دامنه حرکات نرمال و عدم وجود افیوژن مفصلی در یک خانم میانسال، مشخصه پاتوگنومونیک «بورسیت آنسرین (Pes Anserine Bursitis / محل اتصال تاندون‌های سارتوریوس، گراسیلیس و سمی‌تاندینوس)» است که یک پاتولوژی غیرمفصلی بافت نرم می‌باشد.",
            "نادرست است؛ دلیل رد: کپسول مفصلی در سراسر خط مفصل قرار دارد و تندرنس اختصاصی در پروگزیمال تیبیا نمی‌دهد.",
            "نادرست است؛ دلیل رد: درد بیمار مفصلی نبوده بلکه پاتولوژی اطراف مفصلی (پری‌آرتیکولار) بورس بافت نرم است."
        ],
        "exp": "تندرنس شدید در ناحیه قدامی-داخلی پروگزیمال تیبیا زیر خط مفصل زانو، نشانه بورسیت آنسرین (پاتولوژی پری‌آرتیکولار) است.",
        "micro": {
            "lead_fa": "بورسیت پنجه غازی (Pes anserine bursitis) علت شایع درد زانو در زنان میانسال مبتلا به استئوآرتریت یا چاقی است. تاندون‌های سه عضله سارتوریوس، گراسیلیس و سمی‌تندینوس (مخفف SGT) در ناحیه قدامی-داخلی استخوان تیبیا حدود ۵ سانتی‌متر پایین‌تر از خط مفصلی به استخوان متصل می‌شوند. التهاب بورس زیر این تاندون‌ها موجب درد موقع بالارفتن از پله و تندرنس شدید نقطه‌ای در لمس این ناحیه می‌شود در حالی که خود مفصل زانو فاقد افیوژن است.",
            "lead_en": "Pes anserine bursitis is a prevalent etiology of medial knee pain in middle-aged women, frequently co-occurring with knee osteoarthritis. The bursa underlies the conjoined tendinous insertions of the sartorius, gracilis, and semitendinosus muscles at the anteromedial proximal tibia. Striking focal tenderness 5 cm distal to the medial joint line with normal passive ROM localizes the bursa.",
            "golden_fa": "تندرنس موضعی در قدام-داخل پروگزیمال تیبیا ۵ سانتی‌متر زیر خط زانو = بورسیت آنسرین (پاتولوژی غیرمفصلی).",
            "golden_en": "Focal tenderness over anteromedial proximal tibia 5 cm below joint line = pes anserine bursitis (periarticular lesion).",
            "points_fa": [
                "حرکات فعال و غیرفعال مفصل زانو کاملاً طبیعی و بدون افیوژن است.",
                "درد هنگام بالا و پایین رفتن از پله‌ها یا خوابیدن با زانوهای چسبیده به هم تشدید می‌شود.",
                "درمان شامل حرکات کششی عضلات هامسترینگ، کاهش وزن و NSAIDs است.",
                "تزریق موضعی کورتیکواستروئید داخل بورس آنسرین به سرعت علائم بیمار را تسکین می‌دهد."
            ],
            "points_en": [
                "True intra-articular range of motion is completely preserved without an accompanying joint effusion.",
                "Pain is notably aggravated when negotiating stairs or when lying supine with touching medial knees.",
                "Conservative care prioritizes hamstring stretching, quadriceps stabilization, weight loss, and oral NSAIDs.",
                "Targeted local corticosteroid instillation directly into the anserine bursa yields rapid, enduring relief."
            ]
        }
    },
    126: {
        "whys": [
            "نادرست است؛ دلیل رد: ایندومتاسین و NSAIDs در نارسایی کلیه (کراتینین ۲/۵ و BUN ۶۰) منع مصرف مطلق دارند زیرا به شدت GFR را تخریب می‌کنند.",
            "صحیح است؛ در بیماری با حمله حاد پوداگرا (تورم و اریتم حاد مفصل اول MTP) که دچار نارسایی متوسط تا شدید کلیوی (Cr=2.5 و BUN=60) است، داروهای NSAID به علت سمیت شدید کلیوی و کلشی‌سین به دلیل تجمع و سمیت عصبی-عضلانی منع مصرف دارند؛ درمان انتخابی، مؤثر و ایمن در این بیمار «تجویز گلوکوکورتیکوئیدها (پردنیزولون خوراکی یا استروئید داخل مفصلی)» است.",
            "نادرست است؛ دلیل رد: کلشی‌سین در نارسایی کلیوی تجمع یافته و می‌تواند باعث نورومیوپاتی شدید و سمیت خونی گردد.",
            "نادرست است؛ دلیل رد: آلوپورینول داروی فاز مزمن است و شروع آن در فاز حاد حمله نقرس ممنوع است."
        ],
        "exp": "در حمله حاد نقرس همراه با نارسایی کلیوی (Cr=2.5)، گلوکوکورتیکوئیدها درمان ایمن و انتخابی هستند.",
        "micro": {
            "lead_fa": "نارسایی کلیه تعیین‌کننده‌ترین متغیر در انتخاب داروی ضدالتهاب برای حمله حاد نقرس است. داروهای ضدالتهاب غیراستروئیدی (NSAIDs) با مهار پروستاگلاندین‌ها جریان خون کلیه را قطع کرده و آسیب حاد کلیوی شدید ایجاد می‌کنند. کلشی‌سین نیز در کراتینین بالای ۲ خطر تجمع و سمیت سیستمیک کشنده دارد. بنابراین، گلوکوکورتیکوئیدهای سیستمیک (پردنیزولون خوراکی ۳۰ تا ۳۵ میلی‌گرم روزانه به مدت ۵ تا ۱۰ روز) درمان انتخابی و نجات‌بخش در این بیماران هستند.",
            "lead_en": "Renal insufficiency (creatinine 2.5 mg/dL) dramatically dictates therapeutic choices in acute gouty arthritis. NSAIDs are strictly contraindicated due to acute prostaglandin blockade precipitating acute tubular necrosis, while colchicine is avoided due to clearance failure and fatal neuromyopathy. Systemic glucocorticoids (oral prednisone 30-35 mg/day) represent the treatment of choice.",
            "golden_fa": "حمله حاد نقرس + نارسایی کلیوی (Cr=2.5) = درمان انتخابی: گلوکوکورتیکوئیدها (پردنیزولون).",
            "golden_en": "Acute gout flare + renal insufficiency (Cr=2.5) = treatment of choice: glucocorticoids (prednisone).",
            "points_fa": [
                "تزریق داخل مفصلی تریامسینولون در صورت مهارت پزشک گزینه‌ای بسیار عالی و بدون عارضه سیستمیک است.",
                "پردنیزولون خوراکی ظرف چند روز تیتر شده و طی ۱۰ روز قطع می‌شود.",
                "شروع آلوپورینول باید تا حداقل ۲ هفته پس از فروکش کردن کامل این حمله به تعویق بیفتد.",
                "در شروع بعدی آلوپورینول، دوز دارو بر اساس کراتینین به دقت تعدیل خواهد شد."
            ],
            "points_en": [
                "Intra-articular triamcinolone injection is exceptionally effective, bypassing systemic steroid metabolism.",
                "Oral prednisone is administered as a short 5- to 10-day burst without risking further nephrotoxicity.",
                "Urate-lowering therapy with allopurinol must not be instituted until the acute flare has fully resolved.",
                "Subsequent allopurinol titration demands conservative dose reductions calibrated to residual renal clearance."
            ]
        }
    },
    127: {
        "whys": [
            "صحیح است (آزمایشی که کمترین کمک را می‌کند)؛ «تعیین میزان قند و LDH مایع مفصلی» حساسیت و اختصاصیت بسیار ضعیفی داشته و در تمام راهنماهای مدرن روماتولوژی و ارتوپدی به عنوان تست‌های فاقد ارزش تشخیصی شناخته می‌شوند؛ افتراق آرتریت سپسیس بر اساس اسمیر گرم، کشت مایع و خون و شمارش سلولی صورت می‌گیرد و قند/LDH مایع نقشی در تصمیم‌گیری ندارد.",
            "نادرست است؛ دلیل رد: بررسی کریستال‌های اسید اوریک برای رد یا اثبات نقرس حاد که مهم‌ترین تقلیدکننده آرتریت سپتیک است بسیار ارزشمند است.",
            "نادرست است؛ دلیل رد: کشت خون در تا ۵۰ درصد موارد سپسیس مفصلی مثبت شده و به شناسایی باکتری کمک حیاتی می‌کند.",
            "نادرست است؛ دلیل رد: رنگ‌آمیزی گرم مایع سینوویال سریع‌ترین و حیاتی‌ترین اقدام برای شروع فوری آنتی‌بیوتیک هدفمند است."
        ],
        "exp": "سنجش قند و LDH مایع مفصلی ارزش تشخیصی و تفکیکی ندارد؛ رنگ‌آمیزی گرم، کشت و بررسی کریستال‌ها اقدامات حیاتی هستند.",
        "micro": {
            "lead_fa": "در ارزیابی آزمایشگاهی مایع سینوویال در مواجهه با مونوآرتریت حاد چرکی مشکوک به سپسیس، تست‌های حیاتی عبارتند از: ۱) رنگ‌آمیزی گرم فوری (Gram stain)؛ ۲) کشت باکتریایی مایع سینوویال و کشت خون همزمان؛ ۳) شمارش گلبول‌های سفید و درصد نوتروفیل‌ها؛ ۴) میکروسکوپ پلاریزان جهت بررسی کریستال‌های MSU و CPPD. سنجش‌های شیمیایی نظیر گلوکز، پروتئین و LDH مایع مفصلی به علت تداخلات وسیع و عدم اختصاصیت، دیگر هیچ جایگاهی در راهنماهای تشخیصی ندارند.",
            "lead_en": "Diagnostic synovial fluid analysis in suspected acute septic arthritis fundamentally prioritizes Gram stain, bacterial culture, leukocyte/differential quantification, and polarized light crystal analysis. Measuring synovial fluid glucose, total protein, or LDH levels is definitively obsolete, exhibiting negligible diagnostic sensitivity or specificity, and offers the least clinical assistance.",
            "golden_fa": "در بررسی مایع مفصلی شک به سپسیس: قند و LDH مایع کمترین ارزش تشخیصی را دارند و درخواست نمی‌شوند.",
            "golden_en": "Synovial fluid analysis in suspected sepsis: fluid glucose and LDH provide the least diagnostic utility.",
            "points_fa": [
                "رنگ‌آمیزی گرم مایع در ۵۰ تا ۷۵ درصد آرتریت‌های استافیلوکوکی مثبت می‌شود.",
                "آرتریت نقرسی حاد می‌تواند شمارش سلولی مشابه سپسیس ایجاد کند، لذا بررسی کریستال ضروری است.",
                "کشت خون در ۳۰ تا ۵۰ درصد بیماران مبتلا به آرتریت سپتیک ارگانیسم را شناسایی می‌کند.",
                "شروع فوری آنتی‌بیوتیک تجربی وسیع‌الطیف پس از نمونه‌گیری مایع مفصل الزامی است."
            ],
            "points_en": [
                "Immediate Gram stain identifies organisms in 50-75% of staphylococcal and 50% of gram-negative infections.",
                "Severe acute gout can mimic septic joint leukocytosis; mandatory crystal evaluation rules out crystalline flares.",
                "Blood cultures yield the causative circulating pathogen in 30-50% of hematogenously seeded joint infections.",
                "Prompt empirical broad-spectrum parenteral antibiotics must be instituted directly following arthrocentesis."
            ]
        }
    },
    128: {
        "whys": [
            "نادرست است؛ دلیل رد: مسدودکننده‌های کانال کلسیم دی‌هیدروپیریدینی (نظیر نیفدیپین) خط اول درمان دارویی پدیده رینود هستند.",
            "نادرست است؛ دلیل رد: مسدودکننده‌های گیرنده آنژیوتانسین (لوزارتان) اثرات گشادکننده عروقی داشته و در رینود استفاده می‌شوند.",
            "نادرست است؛ دلیل رد: مهارکننده‌های PDE5 (سیلدنافیل) درمان خط دوم بسیار مؤثر در رینود مقاوم و اولسرهای دیجیتال هستند.",
            "صحیح است (دارویی که منع مصرف دارد)؛ مصرف «داروهای بتابلوکر (Beta-blockers)» در بیماران مبتلا به پدیده رینود شدید «منع مصرف مطلق» دارد؛ زیرا بتابلوکرها با مهار گیرنده‌های بتای عروقی و باقی گذاشتن تحریک خالص گیرنده‌های آلفا-۱، «اسپاسم عروقی شریانی محیطی را به شدت تشدید کرده» و خطر بروز ایسکمی حاد، نکروز و گانگرن انگشتان را به دنبال دارند."
        ],
        "exp": "بتابلوکرها اسپاسم عروقی رینود را تشدید می‌کنند و در بیماران اسکلرودرمی دارای رینود شدید منع مصرف دارند.",
        "micro": {
            "lead_fa": "پدیده رینود در اسکلرودرمی ناشی از اسپاسم عروقی شدید شریانچه‌های دیجیتال و آسیب لایه اندوتلیوم است. مسدودکننده‌های کانال کلسیم خط اول درمان هستند و مهارکننده‌های PDE5 (سیلدنافیل) برای زخم‌های ایسکمیک افزوده می‌شوند. در نقطه مقابل، تجویز داروهای بتابلوکر غیراختصاصی به علت بلاک کردن اتساع عروقی با واسطه گیرنده‌های بتا-۲ و ایجاد انقباض عروقی آلفا-آدرنرژیک شدید، تشنج عروقی را شعله‌ور ساخته و مصرف آن‌ها کاملاً ممنوع است.",
            "lead_en": "Raynaud's phenomenon in systemic sclerosis stems from microvascular vasospasm superimposed on structural intimal proliferation. Dihydropyridine calcium channel blockers are first-line vasodilators. Conversely, beta-blockers are strictly contraindicated; by blocking vascular beta-2 mediated dilation, they leave alpha-mediated vasoconstriction unopposed, precipitating severe digital ischemia and gangrene.",
            "golden_fa": "در پدیده رینود شدید: مصرف بتابلوکرها اکیداً ممنوع است؛ داروی انتخابی: کلسیم چنل بلاکرها (نیفدیپین).",
            "golden_en": "In severe Raynaud phenomenon: beta-blockers are contraindicated; treatment of choice: calcium channel blockers.",
            "points_fa": [
                "نیفدیپین طولانی‌اثر فراوانی و شدت حملات وازواسپاستیک رینود را به طور چشمگیری کاهش می‌دهد.",
                "بتابلوکرها جریان خون مویرگی اندام‌ها را کاهش داده و می‌توانند زخم‌های ایسکمیک انگشت را تشدید کنند.",
                "سیلدنافیل و ایلوپروست وریدی در موارد اولسرهای دیجیتال ایسکمیک نجات‌بخش هستند.",
                "گرم نگه داشتن تنه و دست‌ها اساسی‌ترین اقدام غیردارویی پیشگیرانه است."
            ],
            "points_en": [
                "Long-acting oral nifedipine substantially decreases both the frequency and severity of ischemic vasospastic attacks.",
                "Beta-blockers critically compromise cutaneous digital microcirculation, worsening digital ulcerations.",
                "Phosphodiesterase-5 inhibitors (sildenafil) and prostacyclin analogs are designated for refractory ischemic ulcers.",
                "Systemic cold avoidance, core warming, and smoking cessation remain non-negotiable conservative tenets."
            ]
        }
    },
    129: {
        "whys": [
            "صحیح است (موردی که صحیح نیست)؛ جمله «تشخیص استئوآرتریت زانو فقط بالینی است و نیاز به انجام رادیوگرافی ندارد» به عنوان یک حکم کلی نادرست است؛ گرچه در موارد بسیار تیپیک می‌توان بر شرح حال تکیه کرد، اما طبق معیارهای رسمی کالج روماتولوژی آمریکا (ACR)، «انجام رادیوگرافی ساده زانو در وضعیت ایستاده معیار استاندارد اثبات و تعیین شدت استئوآرتریت است» و ادعای عدم نیاز همیشگی به آن غیرصحیح می‌باشد.",
            "نادرست است؛ دلیل رد: در استئوآرتریت دست و هیپ انجام رادیوگرافی برای افتراق از بیماری‌های التهابی کاملاً اندیکاسیون دارد.",
            "نادرست است؛ دلیل رد: در موارد غیرتیپیک بالینی انجام رادیوگرافی الزامی و اندیکاسیون قطعی است.",
            "نادرست است؛ دلیل رد: باقی ماندن درد پس از درمان مؤثر اندیکاسیون انجام رادیوگرافی جهت بررسی پیشرفت یا عوارض است."
        ],
        "exp": "رادیوگرافی زانو در وضعیت ایستاده معیار استاندارد استئوآرتریت است و ادعای عدم نیاز همیشگی به آن نادرست است.",
        "micro": {
            "lead_fa": "در استئوآرتریت زانو، اگرچه در بیمار بالای ۵۰ سال با درد تیپیک مکانیکی می‌توان شک قوی بالینی داشت، اما رادیوگرافی ساده دوطرفه زانو در وضعیت ایستاده (Weight-bearing AP/Lateral) همچنان روش استاندارد طلایی تصویربرداری برای تأیید تشخیص، ارزیابی کاهش فاصله مفصلی، وجود استئوفیت‌ها و تعیین شدت بیماری بر اساس مقیاس Kellgren-Lawrence است؛ همچنین در موارد غیرتیپیک، شک به استئونکروز و عدم پاسخ به درمان، گرافی واجب است.",
            "lead_en": "While typical mechanical symptoms in older adults raise high clinical suspicion for knee osteoarthritis, plain weight-bearing radiography remains the standard diagnostic and staging tool under ACR criteria. Radiographs establish joint space narrowing, marginal osteophytes, and Kellgren-Lawrence grade, rendering the assertion that knee OA 'never requires radiography' incorrect.",
            "golden_fa": "رادیوگرافی زانو در وضعیت ایستاده استاندارد ارزیابی و تأیید استئوآرتریت است و انجام آن در ارزیابی کامل اندیکاسیون دارد.",
            "golden_en": "Weight-bearing knee radiography remains the standard for evaluating and grading osteoarthritis.",
            "points_fa": [
                "گرافی در وضعیت ایستاده تنها روش دقیق ارزیابی کاهش فاصله مفصلی تیبیوفمورال است.",
                "در موارد غیرتیپیک (درد ناگهانی، قفل شدن، یا سن کمتر) انجام عکس ساده الزامی است.",
                "رادیوگرافی مفاصل هیپ و دست‌ها برای رد علل ثانویه و آرتریت‌های التهابی توصیه می‌شود.",
                "ام‌آر‌آی به طور روتین توصیه نمی‌شود زیرا پارگی‌های دژنراتیو منیسک در سنین بالا بدون ارتباط با درد شایع هستند."
            ],
            "points_en": [
                "Weight-bearing views are indispensable to objectively unmask true functional cartilage narrowing.",
                "Atypical symptoms (acute onset, locked joint, nocturnal rest pain) demand prompt radiographic evaluation.",
                "Pelvic and hand radiographs are routinely indicated to exclude inflammatory mimicking arthritides.",
                "Knee MRI is clinically discouraged routinely due to ubiquitous non-specific incidental degenerative changes."
            ]
        }
    },
    130: {
        "whys": [
            "نادرست است؛ دلیل رد: لزوم خاموش بودن کامل بیماری برای حداقل ۶ ماه قبل از اقدام به بارداری توصیه استاندارد و الزامی است.",
            "نادرست است؛ دلیل رد: چک کردن Anti-Ro و Anti-La برای پیش‌بینی خطر لوپوس نوزادی و بلوک قلبی جنین واجب است.",
            "نادرست است؛ دلیل رد: بررسی آنتی‌بادی‌های آنتی‌فسفولیپید برای ارزیابی ریسک ترومبوز و سقط جنین کاملاً ضروری است.",
            "صحیح است (توصیه‌ای که به بیمار نمی‌شود)؛ سابقه بلوک قلبی جنینی در بارداری قبلی «منع مصرف و کنترااندیکاسیون برای حاملگی مجدد نیست»؛ اگرچه ریسک ابتلای نوزاد در بارداری بعدی افزایش می‌یابد (حدود ۱۵ تا ۱۸ درصد در مقایسه با ۲ درصد در بارداری اول)، اما بارداری مجدد با نظارت دقیق، انجام اکوکاردیوگرافی سریال جنینی از هفته ۱۶ تا ۲۶ و در صورت لزوم درمان دارویی با دگزامتازون یا هیدروکسی‌کلروکین کاملاً امکان‌پذیر و مجاز است."
        ],
        "exp": "سابقه بلوک قلبی جنین در بارداری قبلی مانع و کنترااندیکاسیون بارداری مجدد نیست؛ بلکه نیازمند پایش با اکوی سریال است.",
        "micro": {
            "lead_fa": "مشاوره پیش از بارداری در مادران لوپوسی نیازمند سنجش پروفایل اتوآنتی‌بادی‌ها است. حضور Anti-SSA/Ro با خطر ۲ درصدی بلوک مادرزادی قلب جنین همراه است؛ در صورت وقوع بلوک در بارداری اول، این خطر در حاملگی‌های بعدی به حدود ۱۵ تا ۱۸ درصد افزایش می‌یابد، اما هرگز حاملگی بعدی ممنوع نمی‌شود. راهکار مراقبتی: تجویز هیدروکسی‌کلروکین و انجام اکوکاردیوگرافی داپلر سریال جنین از هفته ۱۶ تا ۲۶ است.",
            "lead_en": "Preconception counseling in SLE incorporates autoantibody profiling (anti-Ro/SSA, anti-La/SSB, and antiphospholipids) alongside 6 months of remission. A prior child with congenital heart block elevates subsequent risk from 2% to ~18%, but strictly does not contraindicate future pregnancy; instead, it mandates serial fetal echocardiography and hydroxychloroquine continuation.",
            "golden_fa": "سابقه بلوک قلبی جنین کنترااندیکاسیون بارداری مجدد نیست؛ بلکه نیازمند اکوی سریال جنین و مصرف هیدروکسی‌کلروکین است.",
            "golden_en": "A history of fetal heart block does not contraindicate subsequent pregnancy; it dictates serial fetal echo surveillance.",
            "points_fa": [
                "مصرف مستمر هیدروکسی‌کلروکین ریسک عود بلوک قلبی جنینی را تا بیش از ۵۰ درصد کاهش می‌دهد.",
                "اکوکاردیوگرافی سریال قلب جنین در صورت سابقه قبلی باید از هفته ۱۶ هر هفته انجام گیرد.",
                "در صورت کشف زودهنگام بلوک درجه ۱ یا ۲، تجویز دگزامتازون با قابلیت عبور از جفت مدنظر قرار می‌گیرد.",
                "بلوک قلبی درجه ۳ (کامل) پس از استقرار غیرقابل برگشت است."
            ],
            "points_en": [
                "Continuous maternal hydroxychloroquine therapy slashes congenital heart block recurrence risk by over 50%.",
                "Serial fetal echocardiograms are scheduled weekly to biweekly between gestational weeks 16 and 26.",
                "Emergence of incomplete (first- or second-degree) AV block prompts trial therapy with transplacental dexamethasone.",
                "Established third-degree complete AV heart block is permanent and necessitates pacing at delivery."
            ]
        }
    },
    131: {
        "whys": [
            "نادرست است؛ دلیل رد: فاکتور روماتوئید در ۷۰ تا ۸۰ درصد مبتلایان به RA مثبت است و این گزاره کاملاً صحیح است.",
            "صحیح است (گزینه‌ای که نادرست است)؛ جمله «تیتر بالای فاکتور روماتوئید با علائم خارج مفصلی ارتباطی ندارد» کاملاً غلط است؛ در واقعیت، «تیتر بالای فاکتور روماتوئید (High-titer RF) قویاً با بروز تظاهرات خارج مفصلی شدید (نظیر ندول‌های روماتوئید، واسکولیت روماتوئیدی، پلوریت، سندرم فلتی و اسکلریت)» و همچنین بیماری تخریبی فرسایشی استخوان ارتباط مستقیم و معنادار دارد.",
            "نادرست است؛ دلیل رد: Anti-CCP ویژگی بسیار بالاتری (۹۶٪ در برابر ۷۵٪) و حساسیت مشابهی با RF دارد و این گزاره کاملاً صحیح است.",
            "نادرست است؛ دلیل رد: Anti-CCP سال‌ها قبل از ظهور آرتریت در سرم مثبت می‌شود و این گزاره صحیح است."
        ],
        "exp": "تیتر بالای فاکتور روماتوئید (RF) قویاً با بروز تظاهرات خارج مفصلی (ندول‌ها، واسکولیت، پلوریت) و سیر شدید بیماری همراه است.",
        "micro": {
            "lead_fa": "فاکتور روماتوئید (RF) یک اتوآنتی‌بادی از کلاس IgM علیه بخش Fc ایمونوگلوبولین IgG است. وجود تیترهای بسیار بالای RF در سرم بیمار مبتلا به آرتریت روماتوئید اهمیت پروگنوستیک فوق‌العاده‌ای دارد: ۱) ارتباط مستقیم با بروز تظاهرات خارج مفصلی شدید (ندول‌های زیرجلدی روماتوئید، واسکولیت عروقی نکروزان، اسکلریت چشمی و درگیری ریوی)؛ ۲) پیشرفت سریع‌تر تخریب و اروزیون‌های استخوانی در رادیوگرافی.",
            "lead_en": "Rheumatoid factor (RF) represents an autoantibody directed against the Fc region of IgG. High-titer RF serves as a powerful adverse prognostic indicator, correlating intimately with severe systemic extra-articular manifestations—specifically subcutaneous rheumatoid nodules, necrotizing rheumatoid vasculitis, scleritis, and interstitial lung disease—and accelerated joint erosions.",
            "golden_fa": "تیتر بالای RF = همراهی قوی با بروز تظاهرات خارج مفصلی (ندول‌ها، واسکولیت و پلوریت) و سیر تهاجمی RA.",
            "golden_en": "High-titer RF = strongly correlates with severe extra-articular manifestations (nodules, vasculitis) and erosive RA.",
            "points_fa": [
                "فاکتور روماتوئید در ۷۰ تا ۸۰ درصد بیماران مبتلا به RA مثبت می‌شود (سروپوزیتیو).",
                "ندول‌های روماتوئید تقریباً منحصراً در بیماران دارای تیتر بالای RF دیده می‌شوند.",
                "آنتی‌بادی Anti-CCP اختصاصیت بالاتری دارد اما RF نیز ارزش بالینی بالایی دارد.",
                "بیماران سرونگاتیو (RF و Anti-CCP منفی) معمولاً سیر خارج مفصلی بسیار خفیف‌تری دارند."
            ],
            "points_en": [
                "Rheumatoid factor is detectable in approximately 70-80% of adult rheumatoid arthritis patients.",
                "Subcutaneous rheumatoid nodules occur almost exclusively in high-titer seropositive patients.",
                "Anti-CCP confers greater specificity (>96%), while RF retains exceptional predictive capacity for extra-articular disease.",
                "Seronegative patients rarely develop rheumatoid nodules or severe necrotizing systemic vasculitis."
            ]
        }
    },
    132: {
        "whys": [
            "صحیح است (تشخیصی که کمتر مطرح است)؛ «آرتریت روماتوئید (RA)» یک بیماری پلی‌آرتریت مزمن، متقارن و پیشرونده مفاصل کوچک دست و مچ است؛ شروع بیماری به صورت «مونوآرتریت حاد مفصل مچ پا» فوق‌العاده نادر و غیرمعمول است؛ در حالی که آرتریت سپسیس، آرتریت کریستالی (نقرس یا نقرس کاذب) و آرتریت واکنشی همگی به وفور با مونوآرتریت حاد مچ پا تظاهر می‌کنند.",
            "نادرست است؛ دلیل رد: آرتریت سپتیک از مهم‌ترین و شایع‌ترین علل مونوآرتریت حاد مچ پا است.",
            "نادرست است؛ دلیل رد: آرتریت کریستالی (نقرس و سودونقرس) شایع‌ترین علت مونوآرتریت حاد مچ پا در بزرگسالان است.",
            "نادرست است؛ دلیل رد: آرتریت واکنشی به طور کلاسیک با اولیگوآرتریت یا مونوآرتریت حاد مچ پا تظاهر می‌یابد."
        ],
        "exp": "آرتریت روماتوئید با پلی‌آرتریت متقارن مزمن دست‌ها مشخص می‌شود؛ مونوآرتریت حاد مچ پا برای RA بسیار بعید است.",
        "micro": {
            "lead_fa": "مواجهه با بیمار دچار مونوآرتریت حاد مچ پا نیازمند ارزیابی فوری اورژانس‌های روماتولوژی است. مهم‌ترین تشخیص‌های افتراقی عبارتند از: آرتریت سپسیس باکتریایی، آرتریت‌های کریستالی (نقرس و نقرس کاذب)، تروما، و آرتریت واکنشی یا اسپوندیلوآرتریت‌ها. در نقطه مقابل، آرتریت روماتوئید به عنوان یک بیماری پلی‌آرتیکولار مزمن، متقارن و ساب‌کیوت با درگیری اولیه مفاصل MCP، PIP و مچ دست شناخته می‌شود و تظاهر آن به شکل مونوآرتریت حاد مچ پا کمترین احتمال را دارد.",
            "lead_en": "Acute inflammatory monoarthritis of the ankle represents an acute clinical presentation driven primarily by crystal deposition (gout, pseudogout), pyogenic septic arthritis, or reactive arthritis. Rheumatoid arthritis is an insidious, chronic, symmetric polyarthritis of small hand/foot joints; presenting as an isolated acute ankle monoarthritis is exceptionally atypical.",
            "golden_fa": "مونوآرتریت حاد مچ پا: نقرس، سپسیس و آرتریت واکنشی محتمل‌ترین‌ها هستند؛ آرتریت روماتوئید بسیار بعید است.",
            "golden_en": "Acute ankle monoarthritis: gout, septic, and reactive arthritis are likely; rheumatoid arthritis is least likely.",
            "points_fa": [
                "آرتروسنتز فوری مایع مچ پا جهت شمارش سلولی و رد عفونت در تمام این موارد الزامی است.",
                "نقرس پس از انگشت اول شست پا، تمایل بالایی به درگیری مچ پا دارد.",
                "آرتریت واکنشی معمولاً همراه با انتزیت تاندون آشیل در مجاورت مچ پا است.",
                "آرتریت روماتوئید در مراحل اولیه مفاصل مچ پا را به صورت ایزوله و حاد مبتلا نمی‌سازد."
            ],
            "points_en": [
                "Immediate diagnostic arthrocentesis is required to quantify leukocytes and rule out bacterial infection.",
                "Gouty arthritis demonstrates high secondary affinity for the ankle joint complex.",
                "Reactive arthritis characteristically couples ankle synovitis with adjacent retrocalcaneal Achilles enthesitis.",
                "Rheumatoid arthritis does not characteristically initiate as an explosive, isolated monoarticular ankle flare."
            ]
        }
    },
    133: {
        "whys": [
            "نادرست است؛ دلیل رد: Anti-platelet آزمایشی روتین نبوده و ارتباطی با بررسی‌های پیش از بارداری و جنین ندارد.",
            "نادرست است؛ دلیل رد: Anti-Smith اختصاصی‌ترین آنتی‌بادی لوپوس است اما نقشی در عوارض نوزادی و بلوک قلبی جنین ندارد.",
            "صحیح است؛ در یک خانم مبتلا به بیماری لوپوس اریتماتوی سیستمیک که قصد بارداری دارد، بررسی آنتی‌بادی «Anti-Ro (یا Anti-SSA)» (و Anti-La) به طور اکید توصیه می‌شود؛ زیرا این آنتی‌بادی‌ها از جفت عبور کرده و می‌توانند به بافت هدایتی قلب جنین آسیب زده و منجر به «بلوک کامل قلبی مادرزادی نوزاد (Congenital Heart Block)» یا لوپوس نوزادی گردند.",
            "نادرست است؛ دلیل رد: آنتی‌هیستون در لوپوس دارویی مثبت می‌شود و جایگاهی در مشاوره پیش از بارداری ندارد."
        ],
        "exp": "بررسی آنتی‌بادی Anti-Ro (SSA) قبل از بارداری برای پیش‌بینی و پیشگیری از بلوک قلبی مادرزادی جنین الزامی است.",
        "micro": {
            "lead_fa": "سنجش اتوآنتی‌بادی‌های ضد Ro/SSA و ضد La/SSB جزء الزامات مشاوره پیش از بارداری در تمام زنان مبتلا به لوپوس سیستمیک است. ایمونوگلوبولین‌های IgG مادری ضد Ro از هفته ۱۶ بارداری از جفت عبور کرده و در بافت گره دهلیزی-بطنی قلب جنین میوکاردیت و فیبروز غیرقابل برگشت ایجاد می‌کنند. مثبت بودن این آنتی‌بادی نیازمند شروع هیدروکسی‌کلروکین و نظارت هفتگی با اکوکاردیوگرافی داپلر جنین بین هفته‌های ۱۶ تا ۲۶ است.",
            "lead_en": "Maternal serum anti-Ro (SSA) and anti-La (SSB) screening is a mandatory prerequisite when evaluating pregnancy in SLE. Pathogenic maternal IgG crosses the syncytiotrophoblast starting at gestational week 16, eliciting autoimmune myocarditis that permanently scars the fetal AV node (congenital complete heart block). Positivity dictates fetal echo surveillance.",
            "golden_fa": "مشاوره قبل از بارداری در لوپوس: بررسی Anti-Ro (SSA) جهت پیشگیری و پایش بلوک قلبی مادرزادی نوزاد.",
            "golden_en": "Preconception workup in SLE: anti-Ro (SSA) testing to assess and intercept fetal congenital heart block.",
            "points_fa": [
                "خطر بلوک قلبی جنین در مادر دارای Anti-Ro در اولین بارداری حدود ۲ درصد است.",
                "در صورت تولد نوزاد مبتلا در بارداری قبلی، این ریسک در بارداری بعدی تا ۱۸ درصد افزایش می‌یابد.",
                "هیدروکسی‌کلروکین مصرفی مادر عبور ایمونوگلوبولین‌های آسیب‌رسان را مهار کرده و محافظت‌کننده است.",
                "آنتی‌بادی‌های آنتی‌فسفولیپید (aPL) نیز جهت ارزیابی خطر ترومبوز و سقط جنین همزمان چک می‌شوند."
            ],
            "points_en": [
                "The baseline risk of fetal heart block in an anti-Ro-positive primigravida is roughly 2%.",
                "Following an index affected infant, the recurrence risk in subsequent pregnancies rises tenfold to ~18%.",
                "Maternal hydroxychloroquine mitigates inflammatory transplacental insult, offering significant protection.",
                "Concurrent antiphospholipid antibody screening is mandatory to evaluate pregnancy loss and preeclampsia hazards."
            ]
        }
    },
    134: {
        "whys": [
            "صحیح است؛ داروی متوترکسات (Methotrexate) دو عارضه سمی اصلی و بالقوه کشنده دارد: ۱) سرکوب مغز استخوان و سیتوپنی‌های خونی (لکوپنی، آنمی، ترومبوسیتوپنی)؛ ۲) سمیت کبدی و هپاتوتوکسیسیتی همراه با فیبروز بافتی؛ بنابراین طبق دستورالعمل‌های معتبر روماتولوژی، بیمار تحت درمان با متوترکسات باید به طور دوره‌ای و منظم (هر ۸ تا ۱۲ هفته) تحت آزمایش‌های «شمارش کامل سلول‌های خون (CBC) و آنزیم‌های کبدی (ALT/AST)» قرار گیرد.",
            "نادرست است؛ دلیل رد: معاینه چشم‌پزشکی برای پایش عوارض داروی هیدروکسی‌کلروکین به کار می‌رود نه متوترکسات.",
            "نادرست است؛ دلیل رد: متوترکسات اختلال اختصاصی بر روی الکترولیت‌های سدیم، پتاسیم و کلسیم ندارد.",
            "نادرست است؛ دلیل رد: آزمایشات چربی و قند خون برای پایش کورتیکواستروئیدها هستند نه متوترکسات."
        ],
        "exp": "پایش آزمایشگاهی منظم بیمار تحت درمان با متوترکسات نیازمند بررسی دوره‌ای CBC (سیتوپنی) و ALT/AST (سمیت کبدی) است.",
        "micro": {
            "lead_fa": "متوترکسات داروی سنگ‌بنایی خط اول در درمان آرتریت روماتوئید است. پایش ایمنی این دارو بر کشف زودهنگام دو عارضه متمرکز است: سمیت مغز استخوان و سمیت سلول‌های کبدی. بر اساس گایدلاین‌های روماتولوژی، در فاز نگه‌دارنده، انجام آزمایش CBC با تفکیک و ترانس‌آمینازهای کبدی (ALT/AST) و کراتینین هر ۸ تا ۱۲ هفته یک‌بار اجباری است. در صورت افزایش آنزیم‌های کبدی به بیش از ۲ تا ۳ برابر نرمال یا بروز لکوپنی، دوز دارو تعدیل یا قطع می‌شود.",
            "lead_en": "Methotrexate constitutes the anchor DMARD in rheumatoid arthritis therapy. Routine pharmacovigilance prioritizes early interception of myelosuppression and hepatic parenchymal toxicity. Validated ACR safety guidelines dictate checking a complete blood count (CBC), serum creatinine, and liver transaminases (ALT/AST) every 8 to 12 weeks during stable maintenance.",
            "golden_fa": "پایش آزمایشگاهی دوره‌ای متوترکسات = بررسی منظم CBC (مغز استخوان) و آنزیم‌های کبدی ALT (سمیت کبد).",
            "golden_en": "Routine laboratory monitoring for methotrexate = periodic CBC (bone marrow) and ALT/AST (hepatotoxicity).",
            "points_fa": [
                "تجویز روزانه یا هفتگی اسید فولیک خطر سمیت خونی و کبدی متوترکسات را به شدت کاهش می‌دهد.",
                "مصرف همزمان الکل به علت تشدید شدید سمیت کبدی متوترکسات باید کاملاً محدود شود.",
                "معاینه چشم‌پزشکی دوره‌ای برای داروی هیدروکسی‌کلروکین واجب است.",
                "کراتینین سرم نیز باید پایش شود زیرا دفع متوترکسات کاملاً وابسته به کلیه‌ها است."
            ],
            "points_en": [
                "Daily folic acid supplementation substantially blunts mucosal ulceration, myelotoxicity, and transaminitis.",
                "Alcohol consumption must be strictly minimized to prevent synergistic fibrotic hepatotoxicity.",
                "Periodic ophthalmic perimetry surveillance is selectively indicated for hydroxychloroquine, not methotrexate.",
                "Serum creatinine monitoring is indispensable because methotrexate excretion is entirely renal."
            ]
        }
    },
    135: {
        "whys": [
            "نادرست است؛ دلیل رد: تزریق استروئید داخل مفصل در مفاصل بسیار کوچک DIP دست خطرات آتروفی پوست و آسیب تاندونی دارد و اندیکاسیون ندارد.",
            "صحیح است؛ وجود درد و تغییر شکل در مفاصل اینترفالانژیال دیستال (DIP) با گره‌های استخوانی هبردن (Heberden Nodes) و خشکی صبحگاهی کوتاه ۵ دقیقه‌ای در یک خانم مسن، تابلوی تیپیک «استئوآرتریت ندولار دست‌ها (Hand Osteoarthritis)» است؛ خط اول و مناسب‌ترین اقدام درمانی اقدامات غیردارویی و محافظتی شامل «آموزش روش‌های حفاظت از مفاصل و عدم انجام کار سنگین با دست، استفاده از وسایل کمکی و مصرف مسکن‌های ساده (نظیر استامینوفن یا NSAID موضعی) در صورت نیاز» است.",
            "نادرست است؛ دلیل رد: کلشی‌سین داروی نقرس است و نقشی در درمان استئوآرتریت مفاصل دیستال دست ندارد.",
            "نادرست است؛ دلیل رد: متوترکسات داروی آرتریت روماتوئید است و مصرف آن در آرتروز مفاصل دست کاملاً اشتباه است."
        ],
        "exp": "در استئوآرتریت مفاصل DIP دست (گره‌های هبردن)، اجتناب از کارهای سنگین دست و مصرف مسکن در صورت نیاز، درمان مناسب است.",
        "micro": {
            "lead_fa": "استئوآرتریت دست‌ها شایع‌ترین آرتروز در زنان بالای ۵۰ سال است که مفاصل DIP (گره‌های هبردن) و PIP (گره‌های بوچارد) را مبتلا می‌سازد. مشخصات بارز: خشکی صبحگاهی کوتاه (کمتر از ۱۵ دقیقه)، برجستگی‌های سفت استخوانی بدون اریتم شدید، و درد ناشی از فعالیت کاری. درمان محافظه‌کارانه شامل: پرهیز از کارهای تکراری سنگین با انگشتان، استفاده از وسایل دسته‌بزرگ، تمرینات کششی، ژل موضعی NSAID (نظیر دیکلوفناک) و استامینوفن در صورت نیاز است.",
            "lead_en": "Nodal hand osteoarthritis characteristically manifests in postmenopausal women with bony enlargement of distal interphalangeal joints (Heberden's nodes) and brief morning stiffness (<15 minutes). Management prioritizes non-pharmacologic joint protection strategies, ergonomic task adaptation, avoidance of forceful gripping, and as-needed topical NSAIDs or acetaminophen.",
            "golden_fa": "آرتروز مفاصل DIP دست (گره‌های هبردن): حفاظت مفصل، پرهیز از کار سنگین دست و مصرف مسکن در صورت نیاز.",
            "golden_en": "DIP joint osteoarthritis (Heberden nodes): joint protection, avoidance of heavy hand tasks, and PRN analgesia.",
            "points_fa": [
                "مفاصل DIP در آرتریت روماتوئید سالم می‌مانند و ابتلای آن‌ها نشانه بارز استئوآرتریت است.",
                "ژل‌ها و پمادهای موضعی ضدالتهابی (NSAIDs موضعی) خط اول دارویی ایمن در آرتروز دست هستند.",
                "گره‌های هبردن استخوانی بوده و ناشی از استئوفیت‌های لبه‌ای هستند.",
                "داروهای تهاجمی سیستمیک نظیر متوترکسات یا استروئید هیچ جایگاهی در آرتروز اولیه دست ندارند."
            ],
            "points_en": [
                "DIP joints are characteristically spared in rheumatoid arthritis, solidifying the diagnosis of osteoarthritis.",
                "Topical NSAID formulations (e.g., diclofenac gel) provide effective localized analgesia with minimal systemic risk.",
                "Heberden's nodes represent hard, bony marginal osteophytes rather than soft-tissue inflammatory synovitis.",
                "Systemic immunosuppressive agents (methotrexate) are strictly devoid of efficacy in primary hand osteoarthritis."
            ]
        }
    },
    136: {
        "whys": [
            "نادرست است؛ دلیل رد: مونونوریت مولتیپلکس در بیش از ۶۰ تا ۷۰ درصد بیماران مبتلا به پلی‌آرتریت ندوزا دیده می‌شود.",
            "صحیح است (موردی که کمتر دیده می‌شود)؛ بیماری پلی‌آرتریت ندوزا (Polyarteritis Nodosa / PAN) واسکولیت عروق با کالیبر متوسط است؛ بنابراین برعکس واسکولیت‌های عروق کوچک و لوپوس، در PAN مویرگ‌های گلومرولی کلیه مبتلا نمی‌شوند و «گلومرولونفریت (Glomerulonephritis) به طور کلاسیک سالم می‌ماند و دیده نمی‌شود»؛ نارسایی کلیه در PAN به علت آرتریت شریان‌های قوسی و بین‌لوبولی با انفارکتوس‌های گوه ای قشر کلیه است نه گلومرولونفریت.",
            "نادرست است؛ دلیل رد: فشار خون بالا (به علت ایسکمی کلیه و افزایش ترشح رنین) در اکثریت مبتلایان به PAN شایع است.",
            "نادرست است؛ دلیل رد: علائم سرشتی شامل تب، کاهش وزن و بی‌حالی مشخصه همیشگی PAN فعال هستند."
        ],
        "exp": "پلی‌آرتریت ندوزا (PAN) عروق متوسط را درگیر می‌کند و گلومرولونفریت و درگیری مویرگ‌های گلومرول در آن دیده نمی‌شود.",
        "micro": {
            "lead_fa": "پلی‌آرتریت ندوزا (PAN) به طور اختصاصی شریان‌های عضلانی با کالیبر متوسط را گرفتار می‌کند و از دو ناحیه مهم اجتناب می‌ورزد: ۱) عروق ریوی (عدم درگیری ریه)؛ ۲) مویرگ‌های گلومرولی کلیه. بنابراین، گلومرولونفریت و سدیمان فعال ادراری با کست‌های خونی در PAN غایب هستند. آسیب کلیوی در PAN به علت آرتریت شریان‌های کلیوی با ایجاد میکروآنوریسم و انفارکتوس‌های کورتیکال رخ می‌دهد که پرفشاری خون شدید ایجاد می‌کند.",
            "lead_en": "Polyarteritis nodosa (PAN) is historically and pathologically defined by necrotizing inflammation of medium-sized muscular arteries. A cornerstone negative criterion is the strict sparing of glomerular capillaries and pulmonary vasculature. Consequently, glomerulonephritis and cellular urine casts are characteristically absent, with renal damage mediated by renovascular ischemia.",
            "golden_fa": "تظاهری که در پلی‌آرتریت ندوزا (PAN) دیده نمی‌شود = گلومرولونفریت (مویرگ‌های گلومرول سالم می‌مانند).",
            "golden_en": "Manifestation distinctly spared in polyarteritis nodosa (PAN) = glomerulonephritis (glomerular capillaries are spared).",
            "points_fa": [
                "نارسایی کلیه در PAN همراه با رسوب ادراری کاملاً طبیعی (Normal urinalysis) است.",
                "مونونوریت مولتیپلکس شایع‌ترین تظاهر عصبی PAN است (افتادگی مچ پا یا دست).",
                "ایسکمی مزانتر منجر به دردهای شدید شکمی بعد از غذا (آنژین روده) می‌شود.",
                "در صورت وجود گلومرولونفریت یا ابتلای ریه، باید به ANCA واسکولیت‌ها (GPA، MPA) مشکوک شد."
            ],
            "points_en": [
                "Renal insufficiency in PAN is uniquely characterized by a bland, inactive urinary sediment.",
                "Mononeuritis multiplex (foot drop, wrist drop) represents the most common neurological hallmark of PAN.",
                "Mesenteric arteritis provokes severe postprandial abdominal angina, nausea, and profound weight loss.",
                "Presence of glomerulonephritis or alveolar hemorrhage excludes classic PAN, confirming ANCA-associated vasculitis."
            ]
        }
    },
    137: {
        "whys": [
            "صحیح است (موردی که در مورد یووئیت اسپوندیلیت آنکیلوزان غلط است)؛ یووئیت قدامی در بیماری اسپوندیلیت آنکیلوزان (Ankylosing Spondylitis) «به طور کلاسیک و بارز یک‌طرفه حاد (Acute Unilateral)» است که به صورت حملات مجزا و ناگهانی در یک چشم رخ می‌دهد و با رفع حمله ممکن است در آینده چشم دیگر را درگیر سازد؛ بنابراین گزاره «اغلب دو طرفه است» نادرست و غلط می‌باشد.",
            "نادرست است؛ دلیل رد: یووئیت حاد قدامی در AS به شدت دردناک است و با فوتوفوبی و اشک‌ریزش همراه است.",
            "نادرست است؛ دلیل رد: التهاب زلالیه و اگزودای التهابی در اتاق قدامی چشم منجر به تاری دید می‌شود.",
            "نادرست است؛ دلیل رد: در صورت حملات مکرر و عدم درمان مناسب استروئیدی، چسبندگی عنبیه (سونکی) و آب‌سیاه منجر به نابینایی می‌شود."
        ],
        "exp": "یووئیت قدامی در اسپوندیلیت آنکیلوزان به صورت کلاسیک یک‌طرفه حاد، ناگهانی و راجعه است نه دوطرفه همزمان.",
        "micro": {
            "lead_fa": "یووئیت قدامی حاد (Acute Anterior Uveitis / ایریدوسیکلیت) شایع‌ترین تظاهر خارج مفصلی در اسپوندیلیت آنکیلوزان است که در ۲۵ تا ۴۰ درصد بیماران رخ می‌دهد. ویژگی‌های پاتوگنومونیک این یووئیت: شروع بسیار ناگهانی، درگیری کاملاً یک‌طرفه (Unilateral)، درد شدید چشم، قرمزی مژگانی (Ciliary injection)، فوتوفوبی شدید و تاری دید است. حملات خودمحدودشونده ظرف ۴ تا ۸ هفته بوده و تمایل بالایی به عود در همان چشم یا چشم مقابل دارند.",
            "lead_en": "Acute anterior uveitis (iritis/iridocyclitis) is the most frequent extra-articular manifestation of ankylosing spondylitis, occurring in 25-40% of patients. Pathognomonic features are an explosive acute onset, strictly unilateral presentation, intense ocular pain, photophobia, and ciliary flush. It resolves within 4-8 weeks, frequently recurring alternately in either eye.",
            "golden_fa": "یووئیت در اسپوندیلیت آنکیلوزان: یک‌طرفه حاد، بسیار دردناک و راجعه؛ درگیری همزمان دوطرفه غلط است.",
            "golden_en": "Uveitis in ankylosing spondylitis: acute unilateral, intensely painful, and recurrent; bilateral involvement is wrong.",
            "points_fa": [
                "یووئیت دوطرفه و مزمن بیشتر در سارکوئیدوز یا بیماری بهجت دیده می‌شود.",
                "بیش از ۹۰ درصد بیماران AS دچار یووئیت حامل آلل HLA-B27 هستند.",
                "درمان فوری با قطره‌های کورتیکواستروئید چشمی موضعی و قطره‌های گشادکننده مردمک (سیکلوپلژیک) است.",
                "تأخیر در درمان موجب تشکیل سینشی خلفی (چسبندگی عنبیه به لنز) و گلوکوم ثانویه می‌گردد."
            ],
            "points_en": [
                "Simultaneous bilateral chronic anterior uveitis is characteristic of sarcoidosis or juvenile idiopathic arthritis, not AS.",
                "Over 90% of ankylosing spondylitis patients developing anterior uveitis are HLA-B27 positive.",
                "Immediate emergency ophthalmic intervention pairs intensive topical corticosteroid drops with cycloplegics.",
                "Treatment delays risk posterior synechiae formation, cataracts, secondary glaucoma, and irreversible visual loss."
            ]
        }
    },
    138: {
        "whys": [
            "نادرست است؛ دلیل رد: اندازه‌گیری اسید اوریک برای بررسی آرتریت کریستالی حاد همزمان مشکلی ایجاد نمی‌کند.",
            "نادرست است؛ دلیل رد: آسپیراسیون مایع مفصلی اولین و حیاتی‌ترین اقدام تشخیصی برای اثبات یا رد آرتریت سپتیک است.",
            "نادرست است؛ دلیل رد: کشت خون برای شناسایی باکتریمی در حضور تب و لرز الزامی است.",
            "صحیح است (اقدامی که نباید انجام شود)؛ در یک بیمار با نقص ایمنی تحت درمان دارویی که دچار تب، لرز، لکوسیتوز و مونوآرتریت حاد داغ و متورم زانو شده است، محتمل‌ترین تشخیص تهدیدکننده حیات «آرتریت سپسیس حاد باکتریایی (Septic Arthritis)» است؛ در مواجهه با عفونت چرکی فعال داخل مفصل، «افزایش دوز پردنیزولون (کورتیکواستروئید)» با سرکوب بیشتر سیستم ایمنی فاجعه‌بار بوده و موجب انتشار باکتری، تخریب غضروف و شوک سپتیک می‌گردد و مطلقاً ممنوع است."
        ],
        "exp": "در بیمار روماتوئیدی با تب، لرز و زانوی حاد متورم (شک به سپسیس مفصل)، افزایش دوز پردنیزولون سرکوب‌کننده ایمنی و ممنوع است.",
        "micro": {
            "lead_fa": "بیماران مبتلا به آرتریت روماتوئید که داروهای سرکوب‌کننده ایمنی (پردنیزولون و متوترکسات) مصرف می‌کنند در معرض خطر بسیار بالای آرتریت چرکی باکتریایی (Septic arthritis به ویژه استافیلوکوک اورئوس) هستند. بروز تب و لرز ناگهانی همراه با تورم و گرمی شدید یک مفصل بزرگ منفرد، تا زمان اثبات خلاف آن عفونت سپتیک تلقی می‌شود. در این موقعیت، آسپیراسیون فوری و کشت مایع واجب است، اما افزایش دوز کورتون به شدت منع مصرف دارد زیرا عفونت را شعله‌ور می‌سازد.",
            "lead_en": "Rheumatoid arthritis patients receiving immunosuppressive therapy (methotrexate and corticosteroids) carry a heightened vulnerability to joint sepsis, predominantly Staphylococcus aureus. An acute febrile presentation featuring a solitary hot, swollen knee represents septic arthritis until proven otherwise. Escalating corticosteroid dosage blunts host defense, facilitating invasive articular destruction.",
            "golden_fa": "تب، لرز و زانوی حاد در بیمار تحت درمان RA = شک به آرتریت سپتیک؛ اقدام ممنوع: افزایش دوز پردنیزولون.",
            "golden_en": "Fever, chills, and acute swollen knee in an RA patient = suspect joint sepsis; contraindicated: escalating prednisolone.",
            "points_fa": [
                "بیماران مبتلا به RA به علت آسیب مفصلی قبلی و ایمونوساپرسیون بیشترین ریسک سپسیس مفصلی را دارند.",
                "آسپیراسیون فوری مایع مفصل جهت اسمیر گرم و کشت اورژانسی‌ترین اقدام است.",
                "کشت خون همزمان به شناسایی منشأ هماتوژن عفونت کمک شایانی می‌کند.",
                "درمان فوری با آنتی‌بیوتیک‌های وریدی باکتریسید (نظیر ونکومایسین) بلافاصله پس از آرتروسنتز آغاز می‌شود."
            ],
            "points_en": [
                "Underlying rheumatoid synovial joint architecture combined with immunosuppressive drugs creates ideal grounds for sepsis.",
                "Emergent arthrocentesis for synovial leukocyte count, Gram stain, and culture is the cardinal clinical directive.",
                "Blood cultures must be procured concurrently to identify hematogenous bacteremic seeding.",
                "Bactericidal parenteral antibiotic therapy (e.g., intravenous vancomycin) must be initiated without delay."
            ]
        }
    },
    139: {
        "whys": [
            "نادرست است؛ دلیل رد: آلوپورینول داروی فاز مزمن است و شروع آن در فاز حاد حمله اول نقرس به هیچ وجه تجویز نمی‌شود.",
            "نادرست است؛ دلیل رد: شروع همزمان آلوپورینول با کلشی‌سین در حین حمله فعال ممنوع است و حمله را طولانی می‌کند.",
            "نادرست است؛ دلیل رد: پردنیزولون در بیمار دیابتی قند خون را به شدت بالا می‌برد و در حضور عملکرد نرمال کلیه خط اول نیست.",
            "صحیح است؛ در یک بیمار با «اولین حمله حاد پوداگرا (MTP اول پا)» بدون سابقه حملات قبلی و با عملکرد کلیوی نرمال، درمان انتخابی خط اول برای فرونشاندن التهاب فاز حاد، استفاده از یک داروی ضدالتهاب غیراستروئیدی با اثر سریع و دوز کامل نظیر «ناپروکسن ۵۰۰ میلی‌گرم دو بار در روز (یا ایندومتاسین)» است؛ شروع آلوپورینول در اولین حمله نقرس اندیکاسیون ندارد و در فاز حاد نیز ممنوع است."
        ],
        "exp": "در اولین حمله حاد نقرس در بیمار دیابتی با کلیه سالم، ناپروکسن خوراکی دوز کامل داروی انتخابی مهار التهاب حاد است.",
        "micro": {
            "lead_fa": "در اولین حمله آرتریت نقرسی، دو اصل بالینی وجود دارد: ۱) درمان تنها بر تسکین التهاب حاد با داروهای NSAIDs یا کلشی‌سین متمرکز است؛ ۲) درمان کاهنده اسید اوریک (آلوپورینول) در اولین حمله نقرس بدون علامت قبلی اندیکاسیون ندارد (مگر اینکه سطح اسید اوریک بالای ۹ تا ۱۰ با عوارض همراه باشد، اما حتی در آن صورت هرگز در فاز حاد شروع نمی‌شود). در بیمار دیابتی با کارکرد کلیوی سالم، ناپروکسن به پردنیزولون ترجیح داده می‌شود زیرا استروئید کنترل قند خون را مختل می‌سازد.",
            "lead_en": "Management of a first-ever acute gout attack prioritizes rapid anti-inflammatory relief utilizing full-dose scheduled NSAIDs (such as naproxen 500 mg twice daily) or low-dose colchicine. Urate-lowering therapy (allopurinol) is never initiated during an acute flare, and a single uncomplicated attack does not warrant long-term ULT initiation.",
            "golden_fa": "اولین حمله حاد نقرس با کلیه سالم = ناپروکسن ۵۰۰ میلی‌گرم دو بار در روز؛ شروع آلوپورینول ممنوع است.",
            "golden_en": "First acute gout attack with intact renal function = full-dose naproxen; initiating allopurinol is contraindicated.",
            "points_fa": [
                "ناپروکسن باید تا ۲ تا ۳ روز پس از برطرف شدن کامل درد و التهاب ادامه یابد.",
                "شروع آلوپورینول در اواسط حمله فعال موجب نوسان سطح اورات و تشدید آرتریت می‌شود.",
                "در صورت تکرار دو حمله یا بیشتر در سال، درمان طولانی‌مدت با آلوپورینول آغاز می‌گردد.",
                "پرهیز از غذاهای پرپورین و الکل پس از فروکش کردن فاز حاد آموزش داده می‌شود."
            ],
            "points_en": [
                "Full-dose naproxen is maintained continuously until 48-72 hours following total clinical symptom resolution.",
                "Initiating allopurinol amidst acute inflammation destabilizes articular urate pools, severely prolonging the flare.",
                "Long-term allopurinol therapy is withheld until validated recurrence criteria (≥2 flares/year, tophi) are met.",
                "Lifestyle education addressing purine restriction and hydration is delivered during the intercritical phase."
            ]
        }
    },
    140: {
        "whys": [
            "صحیح است؛ داروی «کاپتوپریل (Captopril)» از داروهای مهارکننده آنزیم ACE است که به علت دارا بودن گروه سولفیدریل (-SH) در ساختار شیمیایی خود، قابلیت اتصال به ماکرومولکول‌ها و تحریک سیستم ایمنی جهت تولید آنتی‌بادی‌های ضد هسته (ANA) و بروز «لوپوس ناشی از دارو (Drug-Induced Lupus Erythematosus / DILE)» با علائم سروزیت، آرترالژی و تب را دارد.",
            "نادرست است؛ دلیل رد: آملودیپین از مسدودکننده‌های کانال کلسیم است و پتانسیل القای لوپوس دارویی را ندارد.",
            "نادرست است؛ دلیل رد: پرازوسین آنتاگونیست آلفا-۱ است و عامل ایجاد لوپوس دارویی نیست.",
            "نادرست است؛ دلیل رد: فوروزماید دیورتیک لوپ است و ارتباطی با ایجاد لوپوس سیستمیک دارویی ندارد."
        ],
        "exp": "کاپتوپریل (مهارکننده ACE دارای گروه سولفیدریل) از داروهای شناخته‌شده در القای لوپوس دارویی (DILE) است.",
        "micro": {
            "lead_fa": "لوپوس ناشی از دارو (DILE) یک سندرم اتوایمیون است که با علائمی نظیر تب، درد مفاصل، سروزیت (پلوریت یا پریکاردیت) و راش‌های پوستی پس از مصرف داروهای خاص تظاهر می‌یابد. اگرچه شایع‌ترین داروها پروکائین‌آمید و هیدرالازین هستند، اما در بین داروهای ضد فشار خون، کاپتوپریل به دلیل داشتن گروه تیول (-SH) پتانسیل اثبات‌شده‌ای در القای لوپوس دارویی دارد. مشخصه آزمایشگاهی DILE مثبت بودن تیتر بالای آنتی‌بادی ضد هیستون (Anti-histone) است.",
            "lead_en": "Drug-induced lupus erythematosus (DILE) manifests with constitutional symptoms, serositis, and arthralgias following chronic exposure to inciting pharmacological agents. While procainamide and hydralazine carry the highest risk, the ACE inhibitor captopril is an established culprit due to its reactive sulfhydryl moiety. Anti-histone antibodies are positive in >95% of DILE cases.",
            "golden_fa": "داروی ضد فشار خون مرتبط با ایجاد لوپوس دارویی (DILE) = کاپتوپریل (مشخصه آزمایشگاهی: Anti-histone).",
            "golden_en": "Antihypertensive agent capable of inducing drug-induced lupus = captopril (hallmark: anti-histone antibodies).",
            "points_fa": [
                "آنتی‌بادی ضد هیستون (Anti-histone antibody) در بیش از ۹۵ درصد مبتلایان به لوپوس دارویی مثبت است.",
                "درگیری شدید کلیه و سیستم عصبی مرکزی در لوپوس دارویی بسیار نادر است.",
                "قطع داروی مسبب منجر به بهبود کامل بالینی و آزمایشگاهی ظرف چند هفته تا چند ماه می‌شود.",
                "سایر داروهای مهم القاکننده لوپوس شامل ایزونیازید، مینوسیکلین و مهارکننده‌های TNF هستند."
            ],
            "points_en": [
                "Circulating anti-histone antibodies are present in >95% of patients with drug-induced lupus erythematosus.",
                "Severe renal glomerulonephritis and central nervous system manifestations are characteristically absent in DILE.",
                "Discontinuation of the offending pharmaceutical agent leads to complete clinical resolution over weeks to months.",
                "Other high-risk inciting medications encompass hydralazine, procainamide, isoniazid, and minocycline."
            ]
        }
    },
    141: {
        "whys": [
            "نادرست است؛ دلیل رد: بورسیت ساب‌آکرومیون با قوس دردناک در ابداکسیون فعال مشخص می‌شود و حرکات را در تمام جهات مسدود نمی‌سازد.",
            "صحیح است؛ بروز درد مداوم و شبانه شانه به مدت چند ماه در یک خانم میانسال مبتلا به دیابت، همراه با مشاهده «محدودیت دامنه حرکات شانه در تمامی جهات (Global Restriction in all planes)»، پاتوگنومونیک «کپسولیت چسبنده (Adhesive Capsulitis / شانه منجمد)» است؛ دیابت ملیتوس قوی‌ترین فاکتور خطر زمینه‌ساز این بیماری است.",
            "نادرست است؛ دلیل رد: تاندونیت بای‌سپس درد موضعی قدام شانه با تست‌های اختصاصی یرگاسون دارد و محدودیت همه‌جانبه حرکات نمی‌دهد.",
            "نادرست است؛ دلیل رد: در پارگی روتاتور کاف حرکات غیرفعال شانه توسط پزشک آزاد است و حرکات در تمام جهات قفل نمی‌شود."
        ],
        "exp": "درد مداوم شانه با محدودیت حرکات در تمامی جهات در بیمار دیابتی، مشخصه پاتوگنومونیک کپسولیت چسبنده (شانه منجمد) است.",
        "micro": {
            "lead_fa": "کپسولیت چسبنده (شانه منجمد) یک بیماری فیبروزان کپسول مفصل گلنوهومورال است که در مبتلایان به دیابت تا ۵ برابر شایع‌تر از جمعیت عمومی رخ می‌دهد. سیر بالینی با فاز درد مداوم و شبانه شروع شده و وارد فاز انجماد با از دست رفتن شدید دامنه حرکات فعال و غیرفعال در تمامی جهات (به‌ویژه چرخش خارجی و ابداکسیون) می‌شود. درمان شامل ورزش‌های کششی ملایم، فیزیوتراپی و تزریق داخل مفصلی گلوکوکورتیکوئید است.",
            "lead_en": "Adhesive capsulitis (frozen shoulder) involves progressive contracture of the glenohumeral capsule, exhibiting a five-fold heightened incidence among diabetic cohorts. The definitive physical examination finding is painful restriction of both active and passive motion across all planes, characteristically targeting external rotation.",
            "golden_fa": "درد شانه در بیمار دیابتی با محدودیت حرکات در تمامی جهات = کپسولیت چسبنده (شانه منجمد).",
            "golden_en": "Shoulder pain in a diabetic with global restriction of motion in all planes = adhesive capsulitis (frozen shoulder).",
            "points_fa": [
                "چرخش خارجی شانه بیش از سایر جهات محدود و مسدود می‌شود.",
                "در پارگی‌های روتاتور کاف دامنه غیرفعال باز است اما در کپسولیت هم فعال و هم غیرفعال مسدود هستند.",
                "کنترل مناسب قند خون به کاهش عوارض اسکلتی در دیابت کمک می‌نماید.",
                "تزریق کورتیکواستروئید داخل مفصل گلنوهومورال در فاز التهابی درد را سریعاً کاهش می‌دهد."
            ],
            "points_en": [
                "Loss of passive external rotation with the arm at the side is the most sensitive early clinical sign.",
                "Rotator cuff tears preserve passive glenohumeral excursion, distinguishing them from true capsular contracture.",
                "Optimal glycemic control remains an essential foundational strategy reducing connective tissue glycation.",
                "Intra-articular glenohumeral corticosteroid injections significantly shorten the painful inflammatory phase."
            ]
        }
    },
    142: {
        "whys": [
            "نادرست است؛ دلیل رد: ترانسلوکاسیون Del 5q مشخصه سندرم میلودیسپلاستیک (MDS) است و عامل انعقاد داخل عروقی منتشر حاد نیست.",
            "صحیح است؛ بروز لوسمی حاد میلوئیدی همراه با انعقاد داخل عروقی منتشر شدید (DIC: خونریزی مخاطی، افت شدید پلاکت، افزایش PT و PTT و افزایش شدید FDP)، تابلوی پاتوگنومونیک «لوسمی پرومیلوسیتیک حاد (APL / AML M3)» است؛ ناهنجاری سیتوژنتیک اختصاصی و قطعی این بیماری ترانسلوکاسیون «t(15;17)(q22;q12)» است که موجب همجوشی ژن‌های PML-RARA می‌گردد و درمان هدفمند با All-Trans Retinoic Acid (ATRA) و آرسنیک تریاکسید دارد.",
            "نادرست است؛ دلیل رد: ناهنجاری Inv(16) مشخصه AML با ائوزینوفیلی (AML M4eo) است.",
            "نادرست است؛ دلیل رد: ترانسلوکاسیون t(8;21) مشخصه AML با بلوغ میلوئیدی (AML M2) با پروگنوز مطلوب است اما DIC شدید نمی‌دهد."
        ],
        "exp": "لوسمی پرومیلوسیتیک حاد (APL) با ترانسلوکاسیون t(15;17) شناخته می‌شود و عارضه مرگبار انعقاد داخل عروقی منتشر (DIC) دارد.",
        "micro": {
            "lead_fa": "لوسمی پرومیلوسیتیک حاد (APL) زیرگروه M3 لوسمی حاد میلوئیدی است که یک اورژانس پزشکی هماتولوژی به شمار می‌رود. ویژگی‌های شاخص: سلول‌های پرومیلوسیت با میله‌های اور متعدد (Auer rods) و ترشح گرانول‌های غنی از پروکواگولانت که منجر به بروز طوفان DIC با خونریزی‌های تهدیدکننده حیات و ترومبوسیتوپنی شدید می‌شود. سیتوژنتیک اختصاصی جابجایی t(15;17) است که پروتئین هیبرید PML-RARA ایجاد می‌کند. درمان فوری با ATRA نجات‌بخش است.",
            "lead_en": "Acute promyelocytic leukemia (APL, AML-M3) is an oncologic emergency characterized by life-threatening disseminated intravascular coagulation (DIC) with hyperfibrinolysis, driven by procoagulant release from abnormal promyelocytes packed with Auer rods. The defining cytogenetic hallmark is the reciprocal translocation t(15;17)(q22;q21), fusing the PML and RARA genes.",
            "golden_fa": "لوسمی AML همراه با خونریزی شدید و DIC = لوسمی پرومیلوسیتیک حاد (APL)؛ سیتوژنتیک: ترانسلوکاسیون t(15;17).",
            "golden_en": "AML complicated by severe coagulopathy and DIC = acute promyelocytic leukemia (APL); cytogenetics: t(15;17).",
            "points_fa": [
                "شروع درمان با ATRA (ترتینوئین) باید بلافاصله با اولین شک بالینی حتی قبل از جواب سیتوژنتیک انجام شود.",
                "افزایش PT، PTT و محصولات تجزیه فیبرین (FDP/D-dimer) همراه با کاهش فیبرینوژن مؤید DIC هستند.",
                "آرسنیک تری‌اکسید (ATO) در ترکیب با ATRA میزان بهبودی کامل را به بیش از ۹۵ درصد رسانده است.",
                "پایش سندروم تمایز APL (تب، دیسترس تنفسی و افیوژن) در طول درمان الزامی است."
            ],
            "points_en": [
                "Initiation of ATRA (all-trans retinoic acid) must precede genetic confirmation to halt fatal coagulopathy.",
                "Prolonged PT/PTT, elevated fibrin degradation products (FDPs), and hypofibrinogenemia establish consumptive DIC.",
                "Arsenic trioxide (ATO) combined with ATRA achieves complete cure rates exceeding 95% without cytotoxic chemotherapy.",
                "Surveillance for APL differentiation syndrome (fever, pulmonary infiltrates, fluid overload) is mandatory."
            ]
        }
    },
    143: {
        "whys": [
            "صحیح است (روشی که برای رسیدن به تشخیص مناسب نیست)؛ سنجش «آنتی‌ژن HLA-B27» به تنهایی یک تست تشخیصی برای اثبات یا رد بیماری اسپوندیلیت آنکیلوزان (AS) نیست؛ زیرا حدود ۸ تا ۱۰ درصد از افراد کاملاً سالم جامعه دارای این ژن هستند و از سوی دیگر منفی بودن آن نیز بیماری را رد نمی‌کند؛ بنابراین در ارزیابی کمردرد التهابی، درخواست روتین HLA-B27 به عنوان ابزار منفرد تشخیصی روش مناسبی نبوده و مبنای تشخیص اثبات رادیولوژیک ساکروایلییت با ام‌آر‌آی ساکروایلیاک است.",
            "نادرست است؛ دلیل رد: ام‌آر‌آی فقرات کمری در مراحل پیشرفته‌تر تغییرات دیسک و مهره‌ها را نشان می‌دهد اما ابزار اول نیست.",
            "نادرست است؛ دلیل رد: اندازه‌گیری فاز حاد ESR به تأیید ماهیت التهابی سیستمیک کمردرد کمک می‌کند.",
            "نادرست است؛ دلیل رد: ام‌آر‌آی مفاصل ساکروایلیاک استاندارد طلایی و حساس‌ترین ابزار اثبات ساکروایلییت زودهنگام در مراحل ابتدایی است."
        ],
        "exp": "سنجش HLA-B27 به تنهایی آزمون تشخیصی نیست؛ استاندارد طلایی اثبات اسپوندیلوآرتریت، ام‌آر‌آی مفاصل ساکروایلیاک است.",
        "micro": {
            "lead_fa": "کمردرد التهابی در یک مرد جوان (شروع در سن زیر ۴۰ سال، درد شبانه که بیمار را بیدار می‌کند، بهبود با فعالیت و بدتر شدن با استراحت) به همراه انتزیت پاشنه پا، شک قوی به اسپوندیلوآرتریت محوری را برمی‌انگیزد. روش استاندارد طلایی و حساس‌ترین اقدام جهت اثبات ساکروایلییت فعال زودهنگام، انجام MRI مفاصل ساکروایلیاک است. بررسی HLA-B27 یک تست ژنتیکی همراهی‌کننده است اما به عنوان تست تشخیصی مناسب نیست زیرا نه حساسیت و نه اختصاصیت کافی دارد.",
            "lead_en": "Inflammatory back pain in a young adult (nocturnal waking, relief with exercise, worsening with rest) alongside heel enthesitis prompts suspicion for axial spondyloarthritis. MRI of the sacroiliac joints is the diagnostic gold standard identifying early active bone marrow edema. HLA-B27 testing is an etiologic genetic marker, not a definitive standalone diagnostic tool.",
            "golden_fa": "روش تشخیصی قطعی اسپوندیلوآرتریت محوری = MRI مفاصل ساکروایلیاک؛ تست HLA-B27 به تنهایی تشخیصی نیست.",
            "golden_en": "Definitive diagnostic tool for axial spondyloarthritis = sacroiliac joint MRI; HLA-B27 alone is not diagnostic.",
            "points_fa": [
                "ام‌آر‌آی با توالی STIR ادم مغز استخوان ساب‌کندرال در مفصل ساکروایلیاک را به وضوح نشان می‌دهد.",
                "درد پاشنه پا در صبح ناشی از انتزیت محل اتصال تاندون آشیل یا فاسیای کف پا است.",
                "بیش از ۹۰ درصد بیماران مبتلا به اسپوندیلیت آنکیلوزان آلل HLA-B27 مثبت دارند اما این آلل در جمعیت سالم نیز شایع است.",
                "درمان خط اول دارویی شامل تجویز دوزهای کامل و مستمر داروهای ضدالتهاب غیراستروئیدی (NSAIDs) است."
            ],
            "points_en": [
                "Short tau inversion recovery (STIR) sequence MRI visualizes active inflammatory subchondral bone marrow edema.",
                "Morning heel pain reflects enthesitis localized to the Achilles tendon or plantar fascial calcaneal insertions.",
                "While >90% of AS patients carry HLA-B27, ~8% of healthy individuals also express it, making it non-diagnostic alone.",
                "Continuous, scheduled high-dose nonsteroidal anti-inflammatory drugs represent the definitive first-line pharmacotherapy."
            ]
        }
    },
    144: {
        "whys": [
            "صحیح است؛ وجود «تندرنس و حساسیت موضعی استخوانی در دق مستقیم مهره‌های ستون فقرات (Point tenderness on percussion)» یک پرچم قرمز (Red Flag) بالینی بسیار مهم در ارزیابی کمردرد است که به شدت شک به آسیب‌های خطرناک ساختاری شامل: «شکستگی فشاری مهره ناشی از پوکی استخوان یا بدخیمی، استئومیلیت مهره‌ای و دیسکیت عفونی» را مطرح ساخته و انجام فوری بررسی‌های رادیوگرافیک ساده و تصویربرداری را اجباری می‌سازد.",
            "نادرست است؛ دلیل رد: خشکی صبحگاهی ۱۰ دقیقه‌ای یافته مکانیکی است و نیازی به رادیوگرافی ندارد.",
            "نادرست است؛ دلیل رد: احساس درد موضعی لومبار در SLR بدون انتشار نشانه سفتی همسترینگ است و پرچم قرمز نیست.",
            "نادرست است؛ دلیل رد: سابقه خانوادگی آرتریت روماتوئید در برادر ارتباطی با ضرورت گرافی کمر ندارد."
        ],
        "exp": "حساسیت موضعی مهره در دق ستون فقرات پرچم قرمز مهم برای شکستگی مهره یا عفونت است و نیازمند رادیوگرافی فوری است.",
        "micro": {
            "lead_fa": "در ارزیابی بالینی کمردرد حاد، شناسایی نشانه‌های هشداردهنده (Red Flags) که انجام تصویربرداری رادیوگرافیک یا ام‌آر‌آی فوری را الزامی می‌سازند حیاتی است. تندرنس موضعی استخوانی در لمس یا دق دقیق زائده خاری یک مهره، ارزش اخباری بالایی برای کشف پاتولوژی‌های مهره‌ای خطرناک نظیر شکستگی‌های استئوپروتیک، متاستازهای بدخیم و اسپوندیلودیسکیت باکتریایی دارد و عکس‌برداری فوری را ایجاب می‌کند.",
            "lead_en": "Evaluation of acute low back pain pivots on identifying red flag clinical indicators that mandate immediate radiographic imaging. Point bony tenderness elicited by firm percussion directly overlying a specific vertebral spinous process carries strong predictive value for vertebral compression fracture, spinal epidural infection, or osseous metastasis.",
            "golden_fa": "پرچم قرمز در کمردرد: حساسیت موضعی مهره در دق ستون فقرات = انجام فوری رادیوگرافی جهت رد شکستگی یا عفونت.",
            "golden_en": "Low back pain red flag: focal spinous process tenderness on percussion = urgent radiography for fracture or infection.",
            "points_fa": [
                "درد مکانیکی بدون پرچم قرمز در ۴ تا ۶ هفته اول نیاز به هیچ عکس‌برداری ندارد.",
                "در افراد مسن بالای ۵۰ سال تندرنس مهره‌ای قویاً مطرح‌کننده شکستگی فشاری استئوپروتیک است.",
                "وجود تب، لرز و افزایش ESR در کنار تندرنس مهره‌ای شک به دیسکیت عفونی را قطعی می‌سازد.",
                "ام‌آر‌آی در صورت غیرطبیعی بودن عکس ساده روش انتخابی تکمیلی است."
            ],
            "points_en": [
                "Uncomplicated mechanical back pain devoid of red flags warrants watchful waiting without imaging for 4-6 weeks.",
                "In patients >50 years, focal vertebral tenderness strongly suggests acute osteoporotic insufficiency fracture.",
                "Fever, rigors, and elevated ESR alongside point vertebral tenderness indicate pyogenic spondylodiscitis.",
                "Spinal MRI without contrast serves as the definitive secondary imaging modality when radiographs raise concern."
            ]
        }
    },
    145: {
        "whys": [
            "صحیح است (جمله‌ای که نادرست است)؛ بورس آنسرین در «قسمت قدامی-داخلی (Anteromedial) زانو» قرار دارد نه قدامی-خارجی؛ محل آن تقریباً ۲ تا ۳ بند انگشت (حدود ۵ سانتی‌متر) زیر خط مفصلی در سطح داخلی تیبیا است؛ بنابراین گزاره فشار در قسمت «قدامی خارجی» کاملاً غلط و نادرست است.",
            "نادرست است؛ دلیل رد: استراحت، داروهای ضدالتهابی NSAID و تزریق موضعی کورتیکواستروئید درمان‌های استاندارد آن هستند.",
            "نادرست است؛ دلیل رد: ماهیت درد مکانیکی بوده و با بالارفتن از پله و پا روی پا انداختن تشدید می‌شود.",
            "نادرست است؛ دلیل رد: بیمار از درد در ناحیه قدام-داخل زانو شکایت دارد."
        ],
        "exp": "بورس آنسرین در قسمت قدامی-داخلی (Anteromedial) پروگزیمال تیبیا قرار دارد نه قدامی-خارجی.",
        "micro": {
            "lead_fa": "بورس آنسرین (Pes Anserine Bursa) بین تاندون‌های منسجم پِس آنسرینوس (سارتوریوس، گراسیلیس، سمی‌تندینوس) و سطح مدیال استخوان تیبیا واقع شده است. نقطه آناتومیک تندرنس شدید در معاینه، سطح قدامی-داخلی (Anteromedial) پروگزیمال تیبیا تقریباً ۵ سانتی‌متر پایین‌تر از خط مفصلی زانو است. این عارضه در زنان مبتلا به آرتروز زانو بسیار شایع است و به علت محل داخلی آن نباید با پاتولوژی‌های خارجی زانو اشتباه شود.",
            "lead_en": "The pes anserine bursa is anatomically nestled beneath the conjoined insertion of the sartorius, gracilis, and semitendinosus tendons upon the anteromedial aspect of the proximal tibia, roughly 5 cm below the medial joint line. Asserting that point tenderness localizes to the 'anterolateral' knee is anatomically false.",
            "golden_fa": "محل آناتومیک بورسیت آنسرین: قدامی-داخلی (Anteromedial) زانو ۵ سانتی‌متر زیر خط مفصل نه خارجی.",
            "golden_en": "Anatomic localization of pes anserine bursitis: anteromedial knee 5 cm below the joint line, never lateral.",
            "points_fa": [
                "تاندون‌های سارتوریوس، گراسیلیس و سمی‌تندینوس ساختار پنجه غازی را تشکیل می‌دهند.",
                "درد هنگام خوابیدن به پهلو به دلیل فشرده شدن دو زانو به هم تشدید می‌شود.",
                "برخلاف آرتروز زانو، دامنه حرکات غیرفعال خود مفصل زانو کاملاً طبیعی و بدون افیوژن است.",
                "تزریق داخل بورس استروئید علائم بیمار را سریعاً تسکین می‌بخشد."
            ],
            "points_en": [
                "The tendons comprising the pes anserinus (goose foot) are the sartorius, gracilis, and semitendinosus.",
                "Nocturnal pain is classically provoked when the knees press together during lateral recumbency.",
                "Unlike tibiofemoral arthritis, passive intra-articular motion is painless and the joint space has no effusion.",
                "Targeted local corticosteroid injection directly within the anserine bursa produces dramatic pain alleviation."
            ]
        }
    },
    146: {
        "whys": [
            "صحیح است؛ همراهی بیماری آرتریت روماتوئید شدید و طول‌کشیده (سابقه ۱۵ ساله) با بزرگی طحال (اسپلنومگالی) و زخم‌های پوستی ایسکمیک اندام تحتانی، تابلوی بالینی تیپیک «سندرم فلتی (Felty's Syndrome)» است؛ یافته آزمایشگاهی شاخص، محوری و تعریف‌کننده این سندرم، وجود «لکوپنی و به ویژه نوتروپنی شدید (Neutropenia با ANC کمتر از ۱۰۰۰ تا ۲۰۰۰)» است که بیمار را مستعد عفونت‌های مکرر باکتریایی می‌سازد.",
            "نادرست است؛ دلیل رد: سردرد جزء مشخصات سندرم فلتی نیست.",
            "نادرست است؛ دلیل رد: حساسیت به نور (فتوسنسیتیویتی) مشخصه لوپوس است نه سندرم فلتی در RA.",
            "نادرست است؛ دلیل رد: هپاتومگالی یافته اصلی نبوده و شاخص تشخیصی سندرم فلتی اسپلنومگالی همراه با لکوپنی است."
        ],
        "exp": "سندرم فلتی با تریاد آرتریت روماتوئید شدید، اسپلنومگالی و لکوپنی/نوتروپنی مشخص می‌شود.",
        "micro": {
            "lead_fa": "سندرم فلتی (Felty's syndrome) عارضه نادر اما بسیار خطیر در کمتر از ۱ درصد مبتلایان به آرتریت روماتوئید باسابقه، سرپوزیتیو شدید و تخریبی است. این سندرم با تریاد کلاسیک شناخته می‌شود: ۱) آرتریت روماتوئید پیشرفته همراه با ندول‌های زیرجلدی؛ ۲) اسپلنومگالی (بزرگی طحال)؛ ۳) لکوپنی با غلبه نوتروپنی شدید (ANC < 1500). تظاهرات پوستی شایع شامل زخم‌های مزمن عودکننده ساق پا و هیپرپیگمانتاسیون به همراه استعداد بالا به عفونت‌های باکتریایی است.",
            "lead_en": "Felty's syndrome is a severe extra-articular manifestation emerging in <1% of long-standing, seropositive, destructive rheumatoid arthritis patients. The hallmark diagnostic triad comprises: 1) deforming rheumatoid arthritis with nodules; 2) splenomegaly; and 3) severe leukopenia/neutropenia (ANC <1,500/μL), frequently complicated by recurrent refractory lower leg ulcers.",
            "golden_fa": "تریاد سندرم فلتی = آرتریت روماتوئید شدید + اسپلنومگالی + لکوپنی (نوتروپنی) و زخم‌های ساق پا.",
            "golden_en": "Felty's syndrome triad = severe rheumatoid arthritis + splenomegaly + leukopenia/neutropenia and leg ulcers.",
            "points_fa": [
                "نوتروپنی ناشی از حبس نوتروفیل‌ها در طحال بزرگ‌شده و تخریب ایمونولوژیک آن‌ها است.",
                "زخم‌های ساق پا ناشی از واسکولیت عروقی و نوتروپنی همراه هستند.",
                "تیترهای فاکتور روماتوئید (RF) و Anti-CCP در سندرم فلتی فوق‌العاده بالا هستند.",
                "درمان استاندارد متوترکسات است و در موارد مقاوم داروی بیولوژیک ریتوکسیماب یا G-CSF به کار می‌رود."
            ],
            "points_en": [
                "Profound neutropenia results from splenic sequestration coupled with antibody-mediated granulocyte clearance.",
                "Non-healing lower extremity leg ulcers arise secondary to concurrent rheumatoid dermal microvasculitis.",
                "Serum rheumatoid factor and anti-CCP titers are uniformly, exceptionally high alongside HLA-DR4.",
                "Methotrexate serves as standard first-line therapy; refractory severe cytopenias respond to rituximab or G-CSF."
            ]
        }
    },
    147: {
        "ci": 3,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: وقوع دو بار یا بیشتر حمله نقرس در یک سال (و به ویژه چهار حمله در سال) اندیکاسیون قطعی شروع آلوپورینول است.",
            "نادرست است؛ دلیل رد: سابقه سنگ‌های ادراری اسید اوریکی مکرر (Urolithiasis) اندیکاسیون قطعی شروع درمان دارویی کاهنده اسید اوریک است.",
            "نادرست است؛ دلیل رد: وجود توفوس نقرسی (در معاینه یا تصویربرداری) اندیکاسیون قطعی و فوری شروع آلوپورینول است.",
            "صحیح است (موردی که اندیکاسیون شروع آلوپورینول نیست)؛ «سابقه حمله قلبی (انفارکتوس میوکارد)» به تنهایی جزء اندیکاسیون‌های راهنماهای بالینی (ACR) برای شروع درمان کاهنده اسید اوریک با آلوپورینول محسوب نمی‌شود؛ اندیکاسیون‌های قطعی آلوپورینول شامل: وجود توفوس نقرسی، آسیب ساختاری مفاصل در گرافی، بروز دو بار یا بیشتر حمله حاد در سال و سنگ‌های کلیوی مکرر هستند."
        ],
        "exp": "سابقه حمله قلبی اندیکاسیون شروع آلوپورینول نیست؛ اندیکاسیون‌ها شامل توفوس، سنگ کلیه و بیش از ۲ حمله در سال هستند.",
        "micro": {
            "lead_fa": "بر اساس راهنماهای بالینی انجمن روماتولوژی آمریکا (ACR)، اندیکاسیون‌های شروع درمان دارویی کاهنده اسید اوریک با آلوپورینول به شرح زیر است: ۱) وجود حتی یک توفوس نقرسی در معاینه یا تصویربرداری؛ ۲) وجود آسیب تخریبی و فرسایشی مفصل ناشی از نقرس در رادیوگرافی؛ ۳) بروز مکرر حملات نقرس یعنی ۲ بار یا بیشتر در سال؛ ۴) سابقه سنگ‌های کلیوی ادراری (Urolithiasis). بیماری‌های قلبی یا سابقه انفارکتوس میوکارد اندیکاسیونی برای شروع آلوپورینول ایجاد نمی‌کنند.",
            "lead_en": "ACR clinical practice guidelines strictly delineate the indications for establishing long-term urate-lowering therapy (allopurinol): 1) presence of ≥1 subcutaneous tophus; 2) radiographic damage attributable to gout; 3) frequent attacks (≥2 flares per year); or 4) recurrent urolithiasis. A remote history of myocardial infarction is not an indication for allopurinol.",
            "golden_fa": "اندیکاسیون‌های قطعی شروع آلوپورینول در نقرس: وجود توفوس، سنگ کلیه و ≥ ۲ حمله در سال؛ سابقه حمله قلبی اندیکاسیون نیست.",
            "golden_en": "Indications for allopurinol: tophi, nephrolithiasis, and ≥2 flares/year; history of myocardial infarction is not an indication.",
            "points_fa": [
                "هدف از درمان با آلوپورینول کاهش اسید اوریک به زیر ۶ میلی‌گرم در دسی‌لیتر است.",
                "در شروع آلوپورینول، کلشی‌سین پروفیلاکسی با دوز پایین به مدت ۳ تا ۶ ماه همراه آن تجویز می‌شود.",
                "سابقه یک حمله ساده بدون توفوس نیازی به شروع آلوپورینول ندارد.",
                "تنظیم دوز بر اساس عملکرد کلیه جهت پیشگیری از سندرم کشنده حساسیت به آلوپورینول الزامی است."
            ],
            "points_en": [
                "The target serum uric acid concentration is strictly titrated below 6.0 mg/dL (or <5.0 mg/dL for tophi).",
                "Concomitant low-dose colchicine flare prophylaxis is co-prescribed for the first 3 to 6 months of initiation.",
                "A solitary, first-time uncomplicated gout flare without tophi or stones does not warrant urate-lowering drugs.",
                "Allopurinol dosing must start low and titrate carefully based on renal function to prevent severe hypersensitivity."
            ]
        }
    },
    148: {
        "ci": 2,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: پلورال افیوژن سلی یک افیوژن اگزوداتیو شدید با نسبت پروتئین بالای ۰/۵ و غلبه لنفوسیت است.",
            "نادرست است؛ دلیل رد: بدخیمی‌های پلور مایع اگزوداتیو با پروتئین و LDH بالا ایجاد می‌کنند.",
            "صحیح است؛ با اعمال «معیارهای لایت (Light's Criteria)»: ۱) نسبت پروتئین مایع پلور به پروتئین سرم = 2.1 / 6.5 = 0.32 (که کمتر از 0.5 است)؛ ۲) نسبت LDH مایع پلور به LDH سرم = 200 / 480 = 0.41 (که کمتر از 0.6 است)؛ ۳) LDH مایع پلور (۲۰۰) نیز کمتر از دو‌سوم حد بالای نرمال LDH سرم است؛ بنابراین مایع به طور قطعی «ترانسوداتیو (Transudative Effusion)» است؛ در میان گزینه‌ها تنها علت ایجادکننده پلورال افیوژن ترانسودا، «نارسایی احتقانی قلب (Heart Failure)» است (سل، بدخیمی و پنومونی همگی اگزوداتیو هستند).",
            "نادرست است؛ دلیل رد: افیوژن پاراپنومونیک ناشی از پنومونی اگزودای حاد چرکی با نسبت LDH بالای ۰/۶ است."
        ],
        "exp": "با توجه به معیارهای لایت، مایع پلورال ترانسودا است (نسبت پروتئین < ۰/۵ و نسبت LDH < ۰/۶) که مشخصه نارسایی احتقانی قلب است.",
        "micro": {
            "lead_fa": "طبق معیارهای کلاسیک لایت (Light's Criteria)، افیوژن در صورتی اگزودا است که حداقل یکی از سه شرط زیر را داشته باشد: ۱) نسبت پروتئین پلور به سرم > ۰/۵؛ ۲) نسبت LDH پلور به سرم > ۰/۶؛ ۳) LDH پلور > دوسوم حد بالای نرمال LDH سرم. در این بیمار تمام این نسبت‌ها پایین‌تر از آستانه هستند (پروتئین ۰/۳۲ و LDH ۰/۴۱)، بنابراین مایع پلور ترانسوداتیو است. شایع‌ترین علت افیوژن ترانسودا نارسایی احتقانی قلب و سپس سیروز و سندرم نفروتیک است.",
            "lead_en": "Applying Light's criteria: 1) Pleural/serum protein ratio is 2.1/6.5 = 0.32 (<0.5); 2) Pleural/serum LDH ratio is 200/480 = 0.41 (<0.6); 3) Pleural LDH (200 IU/L) is <2/3 the upper limit of normal serum LDH. Failing all three criteria unequivocally defines a transudative effusion. Congestive heart failure is the sole transudative cause among the options.",
            "golden_fa": "معیارهای لایت: نسبت پروتئین < ۰/۵ و نسبت LDH < ۰/۶ = مایع ترانسودا (نارسایی قلب)؛ سل و بدخیمی اگزودا هستند.",
            "golden_en": "Light's criteria: protein ratio <0.5 and LDH ratio <0.6 = transudative effusion (heart failure); malignancy/TB are exudates.",
            "points_fa": [
                "نارسایی احتقانی قلب شایع‌ترین علت افیوژن ترانسوداتیو دوطرفه در سراسر جهان است.",
                "مایع ترانسودا به دلیل عدم تعادل نیروهای هیدرواستاتیک و انکوتیک بدون التهاب پرده پلور تشکیل می‌شود.",
                "در صورت نیاز به افتراق ترانسودای ناشی از دیورتیک، گرادیان آلبومین سرم به پلور بالای ۱/۲ ترانسودا را تأیید می‌کند.",
                "سل پلور، بدخیمی و عفونت‌ها همگی افیوژن اگزوداتیو ایجاد می‌کنند."
            ],
            "points_en": [
                "Congestive heart failure is the preeminent etiology driving bilateral transudative pleural effusions worldwide.",
                "Transudates stem from systemic hydrostatic/oncotic pressure imbalances rather than local pleural surface inflammation.",
                "When diuretic therapy falsely elevates transudative protein levels, a serum-to-pleural albumin gradient >1.2 g/dL confirms CHF.",
                "Tuberculous pleurisy, pleural carcinomatosis, and parapneumonic effusions are universally exudative."
            ]
        }
    },
    149: {
        "whys": [
            "صحیح است؛ بروز ناگهانی درد تیز قفسه سینه و تنگی نفس حاد در یک مرد جوان، بلندقد و لاغراندام (تیپ بدنی استنیک)، همراه با مشاهده «هایپررزونانس در دق ریه راست، کاهش صداهای تنفسی در سمع همان سمت و انحراف تراشه به سمت مقابل (چپ)»، تابلوی کلاسیک و پاتوگنومونیک «پنوموتوراکس خودبه‌خودی (Spontaneous Pneumothorax و احتمالاً پنوموتوراکس فشارنده Tension Pneumothorax)» ناشی از پارگی بِلِب‌های زیر پرده پلور در قله ریه است.",
            "نادرست است؛ دلیل رد: پلورال افیوژن در دق صدای ماتیت (Dullness) ایجاد می‌کند نه هایپررزونانس و طبل‌مانند.",
            "نادرست است؛ دلیل رد: آمبولی ریه تغییرات هایپررزونانس در دق و انحراف تراشه به سمت مقابل ایجاد نمی‌کند.",
            "نادرست است؛ دلیل رد: سکته قلبی در جوان ۲۳ ساله لاغر بدون علامت انحراف تراشه و هایپررزونانس بسیار بعید است."
        ],
        "exp": "درد ناگهانی قفسه سینه، هایپررزونانس در دق و کاهش صداهای تنفسی با انحراف تراشه در مرد جوان لاغر، مشخصه پنوموتوراکس است.",
        "micro": {
            "lead_fa": "پنوموتوراکس خودبه‌خودی اولیه (PSP) در جوانان قدبلند و لاغر بین سنین ۲۰ تا ۴۰ سال به دنبال پارگی بلب‌های ساب‌پلورال راسی در پرده جنب رخ می‌دهد. علائم کلاسیک: شروع ناگهانی درد قفسه سینه پلورتیک یک‌طرفه و تنگی نفس. یافته‌های فیزیکی: کاهش اتساع قفسه سینه در سمت درگیر، هایپررزونانس طبل‌مانند در دق، کاهش شدید یا الغای صداهای تنفسی، و در صورت تبدیل به پنوموتوراکس فشارنده، انحراف تراشه به سمت مخالف و افت فشار خون.",
            "lead_en": "Primary spontaneous pneumothorax typically strikes tall, slender young men in their twenties due to spontaneous rupture of apical subpleural blebs. Physical examination hallmarks feature sudden pleuritic chest pain, hyperresonance to percussion, diminished or absent breath sounds on the affected hemithorax, and contralateral tracheal deviation in tension pneumothorax.",
            "golden_fa": "جوان قدبلند و لاغر + درد ناگهانی سینه + هایپررزونانس در دق و کاهش صدا = پنوموتوراکس.",
            "golden_en": "Tall slender young male + sudden chest pain + tympanic hyperresonance and diminished breath sounds = pneumothorax.",
            "points_fa": [
                "انحراف تراشه به سمت مقابل زنگ خطر پنوموتوراکس فشارنده و لزوم دکمپرسیون فوری با سوزن است.",
                "عکس رادیوگرافی ساده سینه در فاز بازدم خط پلور احشایی و فقدان مارکینگ‌های عروقی ریه را نشان می‌دهد.",
                "سیگار کشیدن قوی‌ترین فاکتور خطر محیطی ایجاد و عود پنوموتوراکس خودبه‌خودی است.",
                "درمان پنوموتوراکس‌های بزرگ یا علامت‌دار تعبیه چست تیوب (لوله سینه‌ای) است."
            ],
            "points_en": [
                "Contralateral tracheal deviation heralds tension pneumothorax, demanding emergent immediate needle decompression.",
                "Upright expiratory chest radiography establishes the visceral pleural line devoid of peripheral bronchovascular markings.",
                "Cigarette smoking elevates the lifetime risk of primary spontaneous pneumothorax up to twenty-fold.",
                "Large (>2-3 cm) or symptomatic pneumothoraces require chest tube thoracostomy or pigtail catheter drainage."
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
    for idx, enrich in ENRICHMENTS_BATCH5.items():
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
