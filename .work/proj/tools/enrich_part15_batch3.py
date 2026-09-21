#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enrichment script for Part 15 Batch 3 (Questions 60 to 89)
Target payload: work/tools/master-bank/import-payload.master-preint.part15.json
Note: Per user instructions, question_fa and options_fa are preserved exactly as original.
Only options_why_fa, explanation_fa, and micro are enriched.
"""

import json
import sys

PAYLOAD_PATH = "work/tools/master-bank/import-payload.master-preint.part15.json"

ENRICHMENTS_BATCH3 = {
    60: {
        "whys": [
            "نادرست است؛ دلیل رد: ریشه C5 عضله دلتوئید و رفلکس بای‌سپس را عصب‌دهی می‌کند و درد آن به لترال بازو انتشار دارد نه انگشت سوم.",
            "صحیح است؛ ریشه عصبی «C7» (ناشی از فتق دیسک C6-C7) شایع‌ترین رادیکولوپاتی گردنی است؛ مشخصات تیپیک آن: انتشار درد به پشت بازو، «سطح دورسال ساعد و انگشت سوم (انگشت میانی) دست»، ضعف عضله تری‌سپس (اکستنشن آرنج و مچ دست)، و «کاهش یا الغای رفلکس تاندون عضله سه‌سربازویی (Triceps Reflex)» است.",
            "نادرست است؛ دلیل رد: ریشه C6 به انگشت شست و اشاره انتشار داشته و رفلکس براکیورادیالیس و بای‌سپس را مختل می‌سازد.",
            "نادرست است؛ دلیل رد: ریشه C8 به سطح داخلی ساعد و انگشت کوچک (پنجم) انتشار دارد و بر عضلات اینترنسیک دست اثر می‌گذارد."
        ],
        "exp": "انتشار درد به سطح دورسال ساعد و انگشت سوم همراه با کاهش رفلکس تری‌سپس، مشخصه درگیری ریشه عصبی C7 است.",
        "micro": {
            "lead_fa": "رادیکولوپاتی گردنی C7 شایع‌ترین سندرم فشاری ریشه‌های گردن (بیش از ۶۰ درصد موارد) است که معمولاً به دنبال فتق دیسک C6-C7 رخ می‌دهد. آزمون‌های بالینی: انتشار درد به پشت بازو، پشت ساعد و انگشت وسط (انگشت ۳)؛ ضعف در اکستنشن آرنج (عضله تری‌سپس) و فلکسیون مچ؛ کاهش مشخص رفلکس تاندون تری‌سپس؛ تست اسپرلینگ (Spurling) برای برانگیختن درد رادیکولار مثبت می‌شود.",
            "lead_en": "C7 radiculopathy is the most frequent cervical nerve root compression syndrome, predominantly provoked by C6-C7 posterolateral disc herniation. Classic neurological localization features pain radiating into the dorsal forearm and third digit (middle finger), triceps motor weakness, and a diminished triceps deep tendon reflex.",
            "golden_fa": "درد گردن با انتشار به انگشت سوم دست + کاهش رفلکس تری‌سپس = درگیری ریشه عصبی C7.",
            "golden_en": "Neck pain radiating to the middle finger + diminished triceps reflex = C7 nerve root lesion.",
            "points_fa": [
                "تست اسپرلینگ (اکستنشن و چرخش گردن به سمت مبتلا با اعمال فشار محوری) درد انتشاری C7 را بازتولید می‌کند.",
                "ریشه C6 با حس انگشت شست و رفلکس‌های بای‌سپس و براکیورادیالیس ارزیابی می‌شود.",
                "درمان محافظه‌کارانه شامل گردنبند نرم کوتاه‌مدت، NSAIDs و فیزیوتراپی در اغلب بیماران مؤثر است.",
                "ام‌آر‌آی گردن بدون تزریق روش تشخیصی انتخابی برای اثبات فتق دیسک و فشردگی فورامنیال است."
            ],
            "points_en": [
                "Spurling maneuver (cervical extension, ipsilateral rotation, and axial compression) reproduces radicular pain.",
                "C6 radiculopathy selectively maps to the thumb/index finger with depressed biceps and brachioradialis reflexes.",
                "Conservative management with short-term soft cervical collar and NSAIDs succeeds in the majority of patients.",
                "Non-contrast cervical MRI is the definitive imaging tool identifying neuroforaminal disc extrusion."
            ]
        }
    },
    61: {
        "whys": [
            "صحیح است؛ تورم یکدست، منتشر و سوسیسی‌شکل کل یک انگشت «داکتیلیت (Dactylitis / Sausage Digit)» ناشی از التهاب همزمان مفاصل و غلاف تاندون‌های فلکسور است؛ داکتیلیت علامت پاتوگنومونیک خانواده اسپوندیلوآرتریت‌ها به ویژه «آرتریت پسوریاتیک (Psoriatic Arthritis)» است و در بیش از ۴۰ درصد مبتلایان دیده می‌شود.",
            "نادرست است؛ دلیل رد: آرتریت لوپوس داکتیلیت انگشت سوسیسی ایجاد نمی‌کند و تظاهر آرترالژی یا تورم مفاصل بدون درگیری تاندونی دارد.",
            "نادرست است؛ دلیل رد: آرتریت گونوکوکی تنوسینوویت مچ و دست با وزیکول‌های پوستی می‌دهد اما تظاهر انگشت سوسیسی دوطرفه اختصاصی ندارد.",
            "نادرست است؛ دلیل رد: آرتریت روماتوئید سینوویت مفاصل مجزا (MCP/PIP) می‌دهد و تورم سوسیسی کل انگشت (داکتیلیت) در RA غایب است."
        ],
        "exp": "تورم سوسیسی‌شکل کل انگشت (داکتیلیت) علامت مشخصه و پاتوگنومونیک آرتریت پسوریاتیک است.",
        "micro": {
            "lead_fa": "داکتیلیت (انگشت سوسیسی) با تورم منتشره، دردناک و یکدست تمام طول یک انگشت دست یا پا مشخص می‌شود که فراتر از کپسول مفصلی بوده و تاندون‌های فلکسور و انسیج بافت نرم را در بر می‌گیرد. داکتیلیت مشخصه بارز آرتریت پسوریاتیک و اسپوندیلوآرتریت‌ها است و در آرتریت روماتوئید دیده نمی‌شود. سایر علل داکتیلیت شامل بحران انسداد عروقی در کم‌خونی داسی‌شکل (در اطفال)، سارکوئیدوز و سل هستند.",
            "lead_en": "Dactylitis (sausage digit) represents diffuse, uniform swelling of an entire digit resulting from concurrent synovitis of interphalangeal joints and tenosynovitis of the digital flexor tendons. It is a pathognomonic hallmark of psoriatic arthritis and peripheral spondyloarthropathies, characteristically absent in rheumatoid arthritis.",
            "golden_fa": "تورم سوسیسی‌شکل انگشت دست یا پا (داکتیلیت) = آرتریت پسوریاتیک (یا اسپوندیلوآرتریت).",
            "golden_en": "Sausage-like swelling of an entire digit (dactylitis) = psoriatic arthritis (or spondyloarthritis).",
            "points_fa": [
                "داکتیلیت در معیارهای طبقه‌بندی CASPAR برای آرتریت پسوریاتیک یک امتیاز ارزشمند دارد.",
                "معاینه دقیق پوست سر، ناف و ناخن‌ها برای کشف پلاک‌های مخفی پسوریازیس در حضور داکتیلیت الزامی است.",
                "درمان داکتیلیت مقاوم نیازمند داروهای تعدیل‌کننده بیماری یا مهارکننده‌های TNF و اینترلوکین-۱۷ است.",
                "در رادیوگرافی، واکنش پری‌اوستال و تورم بافت نرم در طول بندهای انگشت مشاهده می‌شود."
            ],
            "points_en": [
                "Dactylitis confers 1 point under the validated CASPAR diagnostic criteria for psoriatic arthritis.",
                "Detection of a sausage digit mandates a thorough search of hidden skin sites for subtle plaque psoriasis.",
                "Refractory dactylitis responds poorly to conventional synthetic DMARDs, requiring biologic TNF/IL-17 inhibition.",
                "Radiographic imaging shows extensive soft tissue fusiform swelling alongside periosteal new bone formation."
            ]
        }
    },
    62: {
        "whys": [
            "نادرست است؛ دلیل رد: مفصل زانو شایع‌ترین مفصل بزرگ مبتلا به استئوآرتریت اولیه در سراسر جهان است.",
            "نادرست است؛ دلیل رد: مفصل ران (هیپ) دومین مفصل بزرگ شایع در استئوآرتریت مفاصل متحمل وزن است.",
            "صحیح است (مفصلی که با شیوع بسیار کمتری دچار آرتروز می‌شود)؛ «مفصل مچ دست (مفصل رادیوکارپال Radiocarpal Joint)» به طور کلاسیک و طبیعی در بیماری استئوآرتریت اولیه «سالم می‌ماند و مبتلا نمی‌شود»؛ در صورت مشاهده آرتروز در مچ دست، باید به علل ثانویه نظیر ترومای قبلی، بیماری رسوب پیروفسفات کلسیم (CPPD) یا هموکروماتوز مشکوک شد.",
            "نادرست است؛ دلیل رد: مفصل کارپومتاکارپال اول (CMC1 در قاعده شست) یکی از شایع‌ترین مفاصل مبتلا به آرتروز دست در زنان است."
        ],
        "exp": "مفصل مچ دست در استئوآرتریت اولیه سالم می‌ماند؛ درگیری آن مطرح‌کننده علل ثانویه نظیر تروما، CPPD یا هموکروماتوز است.",
        "micro": {
            "lead_fa": "الگوی مفاصل درگیر در استئوآرتریت اولیه کاملاً مشخص است: مفاصل اینترفالانژیال دیستال (DIP)، اینترفالانژیال پروکسیمال (PIP)، قاعده شست (CMC1)، مفصل اول متاتارسوفالانژیال (MTP1)، مهره‌های گردنی و لومبار، زانوها و هیپ‌ها. مفاصل مچ دست، آرنج و شانه در استئوآرتریت اولیه به ندرت دچار درگیری می‌شوند. ابتلای مچ دست در گرافی سرنخ قوی برای جستجوی بیماری‌های متابولیک نظیر هموکروماتوز و کندروکلسینوز است.",
            "lead_en": "Primary osteoarthritis characteristically targets the DIPs, PIPs, first CMC, knees, hips, and spine. The radiocarpal wrist joint is distinctly spared in primary osteoarthritis. Radiographic wrist arthropathy strongly prompts an etiologic workup for secondary causes including CPPD crystal deposition, hemochromatosis, or remote carpal trauma.",
            "golden_fa": "مفصل مچ دست در استئوآرتریت اولیه درگیر نمی‌شود؛ ابتلای آن نشانه علل ثانویه (تروما، CPPD، هموکروماتوز) است.",
            "golden_en": "The wrist joint is spared in primary OA; its involvement indicates secondary etiologies (trauma, CPPD, hemochromatosis).",
            "points_fa": [
                "آرتروز مفاصل MCP و مچ دست نشانه پاتوگنومونیک آرتریت هموکروماتوز است.",
                "درد قاعده شست ناشی از آرتروز مفصل CMC1 است و نباید با مچ دست اشتباه گرفته شود.",
                "آرتریت روماتوئید برعکس استئوآرتریت علاقه ویژه‌ای به درگیری مفاصل مچ دست دارد.",
                "بیماری کندروکلسینوز (CPPD) با کلسیفیکاسیون غضروف مثلثی فیبروکارتیلاژ مچ دست تظاهر می‌کند."
            ],
            "points_en": [
                "Isolated MCP and wrist arthropathy is a classic diagnostic clue for hereditary hemochromatosis.",
                "First carpometacarpal (CMC1) joint osteoarthritis produces prominent local thumb base squaring and pinch pain.",
                "Rheumatoid arthritis stands in direct contrast, demonstrating an overwhelming affinity for bilateral wrist synovitis.",
                "CPPD disease characteristically calcifies the triangular fibrocartilage complex within the wrist joint."
            ]
        }
    },
    63: {
        "whys": [
            "نادرست است؛ دلیل رد: پدیده رینود در بیماری‌های بافت همبند (اسکلرودرمی و لوپوس) دیده می‌شود و ارتباطی با آرتریت واکنشی ندارد.",
            "نادرست است؛ دلیل رد: راش مالار تظاهر اختصاصی بیماری لوپوس اریتماتوی سیستمیک است.",
            "صحیح است؛ در بیماری با اولیگوآرتریت محیطی نامتقارن، انتزیت تاندون آشیل، داکتیلیت (انگشت سوسیسی) و کمردرد، وجود علامت بالینی «کنژونکتیویت چشمی (Conjunctivitis / التهاب ملتحمه)» یا یوئیت قدامی، تریاد کلاسیک و پاتوگنومونیک «آرتریت واکنشی (Reactive Arthritis / سندرم رایتر)» را تکمیل کرده و تشخیص را به شدت اثبات می‌نماید.",
            "نادرست است؛ دلیل رد: ندول یا گره روماتیسمی تظاهر خارج مفصلی آرتریت روماتوئید سروپوزیتیو شدید است نه آرتریت واکنشی."
        ],
        "exp": "کنژونکتیویت چشمی تظاهر خارج مفصلی کلاسیک و شاخص در تأیید تشخیص آرتریت واکنشی (سندرم رایتر) است.",
        "micro": {
            "lead_fa": "آرتریت واکنشی به طور کلاسیک با تریاد بالینی: ۱) اولیگوآرتریت غیرقرینه اندام تحتانی؛ ۲) اورتریت یا سرویسیت غیرگونوکوکی؛ ۳) کنژونکتیویت یا یوئیت چشمی شناخته می‌شود. کنژونکتیویت معمولاً ملایم، دوطرفه و گذراست و چند روز تا چند هفته پس از عفونت گوارشی یا ادراری آغاز می‌شود. حضور کنژونکتیویت در کنار انتزیت تاندون آشیل و داکتیلیت مهر تأیید تشخیصی آرتریت واکنشی است.",
            "lead_en": "Reactive arthritis is historically encapsulated by the classic triad of asymmetric lower-extremity oligoarthritis, non-gonococcal urethritis, and ocular conjunctivitis/uveitis. Conjunctivitis is typically sterile, bilateral, and transient, emerging in tandem with peripheral enthesitis to corroborate the clinical diagnosis.",
            "golden_fa": "اولیگوآرتریت نامتقارن + تاندونیت آشیل + داکتیلیت + کنژونکتیویت چشمی = آرتریت واکنشی.",
            "golden_en": "Asymmetric oligoarthritis + Achilles enthesitis + dactylitis + conjunctivitis = reactive arthritis.",
            "points_fa": [
                "یوئیت قدامی حاد در صورت بروز با چشم قرمز دردناک، فوتوفوبی و تاری دید همراه است.",
                "کراتودرما بلنوراژیکا و بالانیت سرسیناتا سایر تظاهرات پوستی-مخاطی اختصاصی هستند.",
                "بیش از ۷۰ درصد موارد همراه با آنتی‌ژن سازگاری بافتی HLA-B27 هستند.",
                "درمان اولیه شامل دوزهای بالای NSAIDs و در موارد مزمن سولفاسالازین است."
            ],
            "points_en": [
                "Acute anterior uveitis manifests with painful ciliary injection, photophobia, and visual impairment.",
                "Keratoderma blennorrhagica (vesicopustular sole lesions) and circinate balanitis are highly specific signs.",
                "HLA-B27 positivity is present in >70% of patients with severe or axial manifestations.",
                "Initial medical therapy relies on full-dose scheduled NSAIDs, reserving sulfasalazine for chronic cases."
            ]
        }
    },
    64: {
        "whys": [
            "نادرست است؛ دلیل رد: آرتریت پسوریاتیک با سابقه اسهال عفونی حاد یک ماه قبل و کراتودرما بلنوراژیکا همراه نیست.",
            "نادرست است؛ دلیل رد: آرتریت انتروپاتیک در زمینه بیماری‌های التهابی مزمن روده (IBD نظیر کرون یا کولیت اولسروز) رخ می‌دهد نه گاستروانتریت حاد قبلی.",
            "نادرست است؛ دلیل رد: لوپوس با راش مالار و نفریت تظاهر می‌کند نه اولیگوآرتریت حاد، داکتیلیت و ضایعات کف پا پس از اسهال.",
            "صحیح است؛ سابقه اسهال عفونی حاد یک ماه قبل، بروز اولیگوآرتریت نامتقارن در مفاصل زانوها و مچ پا، داکتیلیت (تورم سوسیسی کل انگشت پا)، و ضایعات پوستی پاپولواسکواموس تیپیک در کف پاها (کراتودرما بلنوراژیکا / Keratoderma Blennorrhagica)، تابلوی کامل و پاتوگنومونیک «آرتریت واکنشی (Reactive Arthritis)» است."
        ],
        "exp": "اولیگوآرتریت نامتقارن، داکتیلیت و ضایعات پوستی کف پا (کراتودرما بلنوراژیکا) به دنبال اسهال، تابلوی آرتریت واکنشی است.",
        "micro": {
            "lead_fa": "آرتریت واکنشی ۱ تا ۴ هفته پس از اسهال باکتریایی (شیگلا، سالمونلا، کامپیلوباکتر، یرسینیا) بروز می‌کند. ضایعات پوستی کف دست و پا تحت عنوان کراتودرما بلنوراژیکا (Keratoderma blennorrhagica) پلاک‌های هیپرکراتوتیک و پاپولواسکواموسی هستند که از نظر بالینی و بافت‌شناسی شباهت بسیار زیادی به پسوریازیس پوسچولار دارند. همراهی این ضایعات با داکتیلیت و اولیگوآرتریت محیطی تشخیص را قطعی می‌سازد.",
            "lead_en": "Reactive arthritis follows enteric infections caused by Salmonella, Shigella, Yersinia, or Campylobacter. Keratoderma blennorrhagica represents pathognomonic hyperkeratotic, papulosquamous skin eruptions on the soles and palms mimicking pustular psoriasis, solidifying the diagnosis alongside asymmetric oligoarthritis and dactylitis.",
            "golden_fa": "اسهال قبلی + اولیگوآرتریت پا + داکتیلیت + ضایعات پوستی کف پا (کراتودرما بلنوراژیکا) = آرتریت واکنشی.",
            "golden_en": "Prior diarrhea + lower extremity oligoarthritis + dactylitis + sole lesions (keratoderma) = reactive arthritis.",
            "points_fa": [
                "ضایعات کراتودرما بلنوراژیکا معمولاً بدون درد بوده و با کنترل آرتریت خودبه‌خود محو می‌شوند.",
                "کشت مدفوع در زمان شروع آرتریت معمولاً منفی است زیرا ارگانیسم پاک شده است.",
                "درمان آنتی‌بیوتیکی در فاز آرتریت واکنشی پس از اسهال تأثیری در سیر مفصلی ندارد.",
                "داروهای ضدالتهاب غیراستروئیدی (NSAIDs) با دوز کامل خط اول درمان دارویی هستند."
            ],
            "points_en": [
                "Keratoderma blennorrhagica lesions are typically non-tender and resolve spontaneously with joint improvement.",
                "Stool cultures are typically sterile by the time arthritis manifests due to clearance of the enteric pathogen.",
                "Post-dysenteric reactive arthritis derives no therapeutic benefit from antimicrobial therapy once arthritis is established.",
                "High-dose continuous nonsteroidal anti-inflammatory drugs constitute the initial standard of care."
            ]
        }
    },
    65: {
        "whys": [
            "نادرست است؛ دلیل رد: آرتریت روماتوئید بیماری پلی‌آرتریت مزمن، متقارن و پایدار مفاصل کوچک دست‌ها است و حملات حاد خودمحدودشونده انگشت شست پا نمی‌دهد.",
            "صحیح است؛ آرتریت حاد، بسیار دردناک، داغ و قرمز در مفصل متاتارسوفالانژیال اول پای راست (پوداگرا / Podagra) با سابقه حملات حاد عودکننده مشابه در همان مفصل که «خودبه‌خود ظرف چند روز بهبود می‌یابند (Spontaneously resolving)» و فواصل کاملاً بدون درد دارند، تابلوی کلاسیک و پاتوگنومونیک «بیماری نقرس (Gout)» است.",
            "نادرست است؛ دلیل رد: آرتریت سپتیک بدون درمان آنتی‌بیوتیکی خودبه‌خود بهبود نمی‌یابد و مفصل را به سرعت تخریب می‌کند.",
            "نادرست است؛ دلیل رد: بروسلوزیس معمولاً با ساکروایلییت، اسپوندیلودیسکیت یا اولیگوآرتریت بزرگ همراه با تب مالت مواج تظاهر می‌کند نه پوداگرای راجعه خودمحدودشونده."
        ],
        "exp": "حملات حاد عودکننده مفصل MTP اول پا که خودبه‌خود فروکش می‌کنند، تابلوی پاتوگنومونیک آرتریت نقرسی (پوداگرا) است.",
        "micro": {
            "lead_fa": "پوداگرا (التهاب حاد مفصل متاتارسوفالانژیال اول پا) تظاهر اولیه نقرس در بیش از ۵۰ درصد بیماران است و در طول سیر بیماری در بیش از ۹۰ درصد مبتلایان رخ می‌دهد. ویژگی شاخص نقرس زودهنگام وقوع حملات ناگهانی و بسیار دردناک است که حتی بدون درمان ظرف ۷ تا ۱۴ روز کاملاً تخفیف یافته و بیمار وارد فاز بین‌حمله‌ای بدون علامت (Intercritical period) می‌شود. تشخیص با مشاهده کریستال‌های سوزنی MSU در آرتروسنتز اثبات می‌گردد.",
            "lead_en": "Podagra (acute first metatarsophalangeal joint synovitis) is the index presentation in >50% of gout cases. Early gout paroxysms are classically self-limiting, reaching peak intensity within 24 hours and spontaneously resolving within 7 to 14 days, followed by symptom-free intercritical quiescent periods.",
            "golden_fa": "حملات حاد عودکننده شست پا با بهبود خودبه‌خود و فواصل بدون علامت = نقرس (پوداگرا).",
            "golden_en": "Recurrent acute self-limiting first MTP arthritis with asymptomatic intervals = gout (podagra).",
            "points_fa": [
                "کریستال‌های اورات مونوسدیم در زیر میکروسکوپ پلاریزان دارای انکسار نوری منفی قوی هستند.",
                "درمان فاز حاد شامل کلشی‌سین دوز پایین یا NSAIDs خوراکی دوز کامل است.",
                "شروع آلوپورینول در اواسط حمله فعال حاد ممنوع است.",
                "با توجه به وقوع ۳ حمله در سال گذشته، بیمار اندیکاسیون قطعی شروع آلوپورینول پس از رفع حمله را دارد."
            ],
            "points_en": [
                "Compensated polarized light microscopy confirms intracellular needle-shaped negatively birefringent MSU crystals.",
                "Acute flare management prioritizes low-dose colchicine or full-dose NSAIDs initiated within 24 hours.",
                "Urate-lowering therapy must not be newly initiated during an active inflammatory attack.",
                "Experiencing ≥2 flares in the preceding year represents an absolute indication for long-term allopurinol therapy."
            ]
        }
    },
    66: {
        "whys": [
            "نادرست است؛ دلیل رد: ژنتیک نقش بسیار پررنگی در استئوآرتریت دارد (به‌ویژه در آرتروز ندولار دست که توارث آن بیش از ۵۰ تا ۶۰ درصد است).",
            "صحیح است؛ «چاقی و اضافه وزن مفرط (Obesity)» مهم‌ترین فاکتور خطر قابل تعدیل در استئوآرتریت مفاصل متحمل وزن است؛ چاقی هم از طریق بارگذاری مکانیکی مضاعف بر غضروف و هم از طریق ترشح ادیپوکین‌های پیش‌التهابی سیستمیک (نظیر لپتین) «سبب القا و تشدید علائم استئوآرتریت زانو و هیپ» می‌شود.",
            "نادرست است؛ دلیل رد: آرتروز زانو با چاقی و ترومای قبلی مرتبط است نه شغل کشاورزی (کشاورزان بیشتر در معرض آرتروز هیپ هستند).",
            "نادرست است؛ دلیل رد: معدن‌چیان به علت زانو زدن مکرر بیشتر دچار آرتروز زانو می‌شوند نه هیپ."
        ],
        "exp": "چاقی مهم‌ترین فاکتور خطر مکانیکی و متابولیک قابل اصلاح در ایجاد و تشدید علائم استئوآرتریت مفاصل است.",
        "micro": {
            "lead_fa": "چاقی قوی‌ترین فاکتور خطر قابل پیشگیری برای استئوآرتریت زانو است. مکانیسم اثر دوگانه است: ۱) مکانیکی: هر کیلوگرم اضافه وزن نیرویی معادل ۴ برابر در هر گام به زانو وارد می‌کند؛ ۲) متابولیک-هورمونی: بافت چربی ادیپوکین‌ها و سیتوکین‌های پیش‌التهابی ترشح می‌کند که تخریب غضروف را حتی در مفاصل غیرمتحمل وزن تسریع می‌سازد. کاهش حتی ۵ تا ۱۰ درصد وزن بدن درد را تا بیش از ۵۰ درصد تخفیف می‌دهد.",
            "lead_en": "Obesity is the most powerful modifiable risk factor driving the onset and symptomatic progression of knee osteoarthritis. It operates through excessive biomechanical joint loading (multiplying forces 4-fold across the knee) and systemic adipokine-mediated pro-inflammatory cartilage catabolism.",
            "golden_fa": "قوی‌ترین ریسک‌فاکتور قابل اصلاح استئوآرتریت = چاقی (کاهش وزن علائم و درد را به شدت کم می‌کند).",
            "golden_en": "Strongest modifiable risk factor for osteoarthritis = obesity; weight reduction markedly alleviates joint symptoms.",
            "points_fa": [
                "توارث ژنتیکی در استئوآرتریت دست‌ها (گره‌های هبردن و بوچارد) بسیار بالاست.",
                "تقویت عضلات چهارسر ران اثر هم‌افزا با کاهش وزن در مهار آرتروز دارد.",
                "مشاغل با زانو زدن مکرر (معدن‌کاری، کاشی‌کاری) ریسک استئوآرتریت زانو را بالا می‌برند.",
                "ورزش‌های هوازی در آب (هیدروتراپی) بدون وارد کردن ضربه وزن، درد آرتروز را تسکین می‌دهند."
            ],
            "points_en": [
                "Genetic heritability is particularly pronounced in generalized nodal hand osteoarthritis (Heberden nodes).",
                "Quadriceps muscle strengthening acts synergistically with weight loss to stabilize the patellofemoral joint.",
                "Occupations requiring repetitive kneeling and squatting significantly escalate knee osteoarthritis risk.",
                "Low-impact aquatic exercise programs unload joint stress while conditioning periarticular musculature."
            ]
        }
    },
    67: {
        "whys": [
            "نادرست است؛ دلیل رد: فیزیوتراپی گردن در بیمار روماتوئیدی با درد حاد گردن بدون گرافی ممنوع است زیرا خطر آسیب نخاع را دارد.",
            "صحیح است؛ بیمار تابلوی شعله‌وری فعال بیماری آرتریت روماتوئید (پلی‌آرتریت فعال مچ و MCPها، خشکی صبحگاهی طولانی دو ساعته و ESR=50) دارد در حالی که رژیم درمانی فعلی برای کنترل بیماری ناکافی بوده است؛ در قدم اول بالینی جهت مهار فوری فاز فعال التهاب سیستمیک و محافظت از مفاصل، «افزایش موقت دوز کورتیکواستروئید (پردنیزولون)» به عنوان پل درمانی توصیه می‌شود؛ (در ادامه ارزیابی رادیولوژی گردن نیز جهت بررسی سابلوکساسیون آتلانتواگزیال مدنظر خواهد بود).",
            "نادرست است؛ دلیل رد: با توجه به سابقه ۱۰ ساله بیماری و RF مثبت بالا، نیازی به تکرار مجدد Anti-CCP در این ویزیت نیست.",
            "نادرست است؛ دلیل رد: گرافی گردن بررسی مهمی است اما قدم اول در مواجهه با شعله‌وری فعال بیماری، کنترل التهاب دارویی با افزایش دوز استروئید است."
        ],
        "exp": "در شعله‌وری فعال آرتریت روماتوئید با پلی‌آرتریت و فاز حاد بالا، افزایش دوز کورتیکواستروئید به عنوان پل درمانی قدم اول است.",
        "micro": {
            "lead_fa": "در مدیریت بالینی بیماران مبتلا به آرتریت روماتوئید طول‌کشیده، بروز علائم شعله‌وری سیستمیک (تورم مفاصل دست، خشکی صبحگاهی طولانی و افزایش نشانگرهای فاز حاد ESR) نیازمند مداخله دارویی سریع است. کورتیکواستروئیدهای خوراکی سریع‌ترین اثر ضدالتهابی را دارند و افزایش موقت دوز آن‌ها به عنوان پل درمانی (Bridging therapy) علائم را کنترل می‌کند. همزمان به علت شکایت درد گردن، خطر سابلوکساسیون آتلانتواگزیال (C1-C2) باید مدنظر باشد.",
            "lead_en": "In a patient with long-standing rheumatoid arthritis experiencing an active systemic disease flare (polyarticular synovitis, prolonged morning stiffness, and elevated ESR), immediate clinical management requires temporary escalation of corticosteroid bridging therapy to suppress synovitis while optimizing the DMARD regimen.",
            "golden_fa": "شعله‌وری فعال آرتریت روماتوئید با فاز حاد بالا = اقدام اول: افزایش موقت دوز استروئید جهت مهار التهاب.",
            "golden_en": "Active rheumatoid arthritis flare with high ESR = initial step: temporary corticosteroid dose escalation.",
            "points_fa": [
                "پردنیزولون خوراکی علائم سینوویت را ظرف چند روز به طور چشمگیری کاهش می‌دهد.",
                "درد گردن در RA طول‌کشیده نیازمند بررسی رادیوگرافی در وضعیت فلکسیون-اکستنشن جهت رد سابلوکساسیون C1-C2 است.",
                "در صورت مقاومت به درمان ترکیبی سه دارویی، افزودن داروهای بیولوژیک ضد TNF اندیکاسیون دارد.",
                "مانیپولاسیون گردن در فیزیوتراپی بیماران روماتوئید به علت خطر آسیب بصل‌النخاع کاملاً ممنوع است."
            ],
            "points_en": [
                "Oral corticosteroids deliver rapid symptomatic relief and suppress acute-phase reactants within days.",
                "Cervical pain in chronic RA mandates flexion-extension radiography to evaluate atlantoaxial instability.",
                "Persistent high disease activity despite triple synthetic DMARDs justifies escalating to a biologic TNF inhibitor.",
                "Forceful cervical spine manipulation is strictly contraindicated due to catastrophic spinal cord compression risks."
            ]
        }
    },
    68: {
        "whys": [
            "نادرست است؛ دلیل رد: تاندونیت روتاتور کاف دامنه حرکات غیرفعال شانه را محدود نمی‌سازد و انسداد همه‌جانبه ایجاد نمی‌کند.",
            "صحیح است؛ درد شانه چپ در یک خانم میانسال با انتشار به بازو و مشاهده «محدودیت حرکات شانه در تمامی جهات (Global restriction of shoulder motion)»، پاتوگنومونیک «کپسولیت چسبنده (Adhesive Capsulitis / شانه منجمد)» است که به علت فیبروز و جمع‌شدگی کپسول مفصل گلنوهومورال رخ می‌دهد.",
            "نادرست است؛ دلیل رد: تاندونیت بای‌سپس درد قدام شانه با تست‌های اختصاصی یرگاسون و اسپید می‌دهد و حرکات را در تمام جهات مسدود نمی‌سازد.",
            "نادرست است؛ دلیل رد: در پارگی روتاتور کاف حرکات فعال مسدود است اما حرکات غیرفعال مفصل آزاد باقی می‌ماند."
        ],
        "exp": "محدودیت حرکات شانه در تمامی جهات، نشانه بالینی پاتوگنومونیک کپسولیت چسبنده (شانه منجمد) است.",
        "micro": {
            "lead_fa": "کپسولیت چسبنده یا شانه منجمد (Frozen Shoulder) ناشی از التهاب مزمن سینوویال و ضخیم شدن کپسول مفصل گلنوهومورال است. شایع‌ترین ویژگی بالینی در معاینه، مسدود شدن حرکات در تمام جهات (الگوی کپسولی: چرخش خارجی > ابداکسیون > چرخش داخلی) است. این بیماری در زنان میانسال، افراد دیابتی و مبتلایان به بیماری‌های تیروئید شیوع بالایی دارد و سیر طبیعی طولانی چندماهه دارد.",
            "lead_en": "Adhesive capsulitis (frozen shoulder) involves chronic fibrosing inflammation and progressive contracture of the glenohumeral capsule. The cardinal physical finding is global restriction of both active and passive motion across all cardinal planes, predominantly compromising external rotation.",
            "golden_fa": "درد شانه با محدودیت حرکات در تمامی جهات = کپسولیت چسبنده (Adhesive capsulitis).",
            "golden_en": "Shoulder pain with global limitation of motion in all directions = adhesive capsulitis.",
            "points_fa": [
                "چرخش خارجی بیش از سایر حرکات شانه محدود و دردناک می‌شود.",
                "در پارگی روتاتور کاف دامنه غیرفعال باز است اما در کپسولیت هر دو مسدود هستند.",
                "تزریق داخل مفصلی کورتیکواستروئید در فاز اولیه همراه با فیزیوتراپی درمان انتخابی است.",
                "رادیوگرافی ساده فضای مفصل را سالم نشان می‌دهد و صرفاً استئوپنی ناشی از بی‌حرکتی را به نمایش می‌گذارد."
            ],
            "points_en": [
                "External rotation is typically the earliest and most severely restricted arc of motion.",
                "Rotator cuff tears preserve passive excursion, whereas capsulitis locks both active and passive motion.",
                "Intra-articular glenohumeral corticosteroid injections combined with stretching exercises represent standard therapy.",
                "Plain radiography displays preserved glenohumeral joint space without articular cartilage destruction."
            ]
        }
    },
    69: {
        "whys": [
            "صحیح است (روشی که در تشخیص و پروگنوز اسکلرودرمی کاربردی ندارد)؛ «آنژیوگرافی عروقی» یک روش تهاجمی است و در ارزیابی روتین، تشخیص یا تعیین پیش‌آگهی بیماران مبتلا به اسکلروز سیستمیک (اسکلرودرمی) هیچ جایگاهی ندارد و کمکی نمی‌کند؛ بررسی‌های استاندارد شامل کاپیلاروسکوپی، سی‌تی‌اسکن ریه و اکوکاردیوگرافی هستند.",
            "نادرست است؛ دلیل رد: کاپیلاروسکوپی بستر ناخن الگوی تغییرات میکروواسکولار اختصاصی اسکلرودرمی و خطر پیشرفت احشایی را نشان می‌دهد.",
            "نادرست است؛ دلیل رد: سی‌تی‌اسکن ریه (HRCT) روش طلایی تعیین پیش‌آگهی درگیری فیبروز بینابینی ریه (ILD) است.",
            "نادرست است؛ دلیل رد: اکوکاردیوگرافی روش استاندارد غربالگری برای تعیین پیش‌آگهی هایپرتانسیون شریان ریوی (PAH) است."
        ],
        "exp": "آنژیوگرافی در ارزیابی و تعیین پیش‌آگهی اسکلرودرمی نقشی ندارد؛ کاپیلاروسکوپی، HRCT ریه و اکو اقدامات استاندارد هستند.",
        "micro": {
            "lead_fa": "در بیمار با پدیده رینود و سفتی پوست انگشتان (اسکلروداکتیلی) با شک به اسکلروز سیستمیک، بررسی‌های استاندارد جهت تأیید و ارزیابی پیش‌آگهی اندام‌های حیاتی عبارتند از: ۱) کاپیلاروسکوپی بستر ناخن (مویرگ‌های غول‌آسا و مناطق بی‌عروق)؛ ۲) سی‌تی‌اسکن HRCT ریه و اسپیرومتری (کشف زودهنگام ILD)؛ ۳) اکوکاردیوگرافی داپلر (غربالگری هایپرتانسیون ریوی). آنژیوگرافی تهاجمی بوده و در راهنماها جایگاهی ندارد.",
            "lead_en": "Diagnostic and prognostic workup for systemic sclerosis systematically incorporates nailfold capillaroscopy (microvascular architecture), high-resolution chest CT (interstitial lung disease staging), and Doppler echocardiography (pulmonary hypertension screening). Invasive catheter angiography offers no routine prognostic utility.",
            "golden_fa": "ارزیابی اسکلرودرمی: کاپیلاروسکوپی، HRCT ریه و اکوکاردیوگرافی؛ آنژیوگرافی در پروگنوز نقشی ندارد.",
            "golden_en": "Systemic sclerosis staging: capillaroscopy, chest HRCT, echocardiography; angiography plays no routine prognostic role.",
            "points_fa": [
                "کاپیلاروسکوپی بستر ناخن رینود اولیه را از اسکلرودرمی تفکیک می‌نماید.",
                "بیماری بینابینی ریه شایع‌ترین علت مرگ در اسکلرودرمی است و با HRCT پایش می‌شود.",
                "افزایش فشار شریان ریوی در اکو نیازمند تأیید نهایی با کاتتریزاسیون قلب راست است.",
                "پایش منظم فشار خون هفتگی برای کشف زودهنگام کریز کلیوی اسکلرودرمی اجباری است."
            ],
            "points_en": [
                "Nailfold capillaroscopy reliably differentiates benign primary Raynaud from evolving systemic sclerosis.",
                "Interstitial lung disease represents the primary cause of scleroderma mortality, tracked via HRCT.",
                "Echocardiographic suspicion of pulmonary hypertension warrants confirmatory right heart catheterization.",
                "Routine weekly home blood pressure surveillance enables early interception of scleroderma renal crisis."
            ]
        }
    },
    70: {
        "whys": [
            "نادرست است؛ دلیل رد: سی‌تی‌اسکن مغز تغییرات التهابی عروق خونی را نشان نمی‌دهد و تشخیصی برای واسکولیت تمپورال نیست.",
            "نادرست است؛ دلیل رد: سونوگرافی شریان تمپورال هاله‌دار شدن دیواره را نشان می‌دهد اما استاندارد طلایی تشخیصی نیست.",
            "صحیح است؛ در یک بیمار ۷۲ ساله با تابلوی کلاسیک لنگش فک حین غذا خوردن (Jaw Claudication)، سردرد جدید و تاری دید (شک بالا به آرتریت تمپورال / GCA)، استاندارد طلایی برای اثبات قطعی تشخیص بیماری، انجام «بیوپسی شریان تمپورال (Temporal Artery Biopsy)» به طول حداقل ۲ تا ۳ سانتی‌متر است؛ درمان با کورتیکواستروئید دوز بالا باید فوراً پیش از انجام بیوپسی آغاز گردد تا از نابینایی دائمی پیشگیری شود.",
            "نادرست است؛ دلیل رد: سونوگرافی کاروتید آترواسکلروز عروق را می‌سنجد و روش تشخیصی برای آرتریت تمپورال نیست."
        ],
        "exp": "بیوپسی شریان تمپورال استاندارد طلایی تشخیصی در آرتریت سلول غول‌آسا (تمپورال) است و نباید شروع استروئید را به تعویق بیندازد.",
        "micro": {
            "lead_fa": "آرتریت سلول غول‌آسا (تمپورال) شایع‌ترین واسکولیت سیستمیک در سالمندان بالای ۵۰ سال است. تظاهرات شاخص: سردرد جدید یک‌طرفه تمپورال، لنگش فک حین جویدن غذا (Jaw claudication که بسیار اختصاصی است)، و تاری دید ناشی از ایسکمی عصب بینایی. بیوپسی جراحی از شریان تمپورال به طول حداقل ۲ تا ۳ سانتی‌متر استاندارد طلایی تشخیصی است که التهاب گرانولوماتوز با سلول‌های غول‌آسا را اثبات می‌نماید.",
            "lead_en": "Giant cell arteritis (temporal arteritis) typically manifests in elderly patients with new-onset temporal headache, jaw claudication, and visual blurring. Temporal artery biopsy (excising a segment ≥2-3 cm) represents the definitive diagnostic gold standard, demonstrating transmural granulomatous inflammation and internal elastic lamina fragmentation.",
            "golden_fa": "سردرد + لنگش فک + تاری دید در سالمند = آرتریت تمپورال؛ اقدام تشخیصی طلایی: بیوپسی شریان تمپورال.",
            "golden_en": "Headache + jaw claudication + visual symptoms in elderly = giant cell arteritis; gold standard: temporal artery biopsy.",
            "points_fa": [
                "کورتیکواستروئید دوز بالا (پردنیزولون ۶۰ میلی‌گرم) بلافاصله پیش از انجام بیوپسی جهت نجات بینایی تجویز می‌شود.",
                "بیوپسی شریان تمپورال تا ۲ هفته پس از شروع استروئید همچنان ویژگی‌های پاتولوژیک مثبت را حفظ می‌کند.",
                "لنگش فک اختصاصی‌ترین علامت بالینی در شرح حال آرتریت تمپورال است.",
                "افزایش شدید مارکرهای فاز حاد (ESR بالای ۵۰ و اغلب بالای ۱۰۰) مشخصه همیشگی بیماری است."
            ],
            "points_en": [
                "High-dose systemic corticosteroids must be started immediately to prevent irreversible ischemic blindness.",
                "Temporal artery biopsy remains histopathologically diagnostic even when obtained up to 2 weeks after steroid initiation.",
                "Jaw claudication is the single most specific clinical feature denoting severe cranial ischemia.",
                "Markedly elevated acute-phase reactants (ESR characteristically >50 to 100 mm/h) are virtually universal."
            ]
        }
    },
    71: {
        "whys": [
            "نادرست است؛ دلیل رد: فتق دیسک حاد معمولاً درد رادیکولار یک‌طرفه با انتشار در یک درماتوم مشخص ایجاد می‌کند و با نشستن بدتر می‌شود نه بهتر.",
            "نادرست است؛ دلیل رد: هیپرتروفی فاست درد موضعی محوری کمر می‌دهد و لنگش متناوب ساق هر دو پا ایجاد نمی‌کند.",
            "نادرست است؛ دلیل رد: لنگش عروقی ناشی از آترواسکلروز صرفاً با ایستادن بدون راه رفتن برانگیخته نمی‌شود و با ایستادن ثابت بهبود می‌یابد.",
            "صحیح است؛ درد و احساس سنگینی دوطرفه در اندام‌های تحتانی و ساق پاها که با راه رفتن و به ویژه با «ایستادن طولانی و اکستنشن کمر برانگیخته شده و با نشستن و خم شدن به جلو (فلکسیون کمر) تسکین می‌یابد» (لنگش متناوب عصبی / Neurogenic Claudication یا پدیده کالسکه خرید)، تابلوی پاتوگنومونیک و کلاسیک «تنگی کانال نخاعی کمری (Lumbar Spinal Stenosis)» است."
        ],
        "exp": "درد دوطرفه پاها با راه رفتن و ایستادن که با نشستن و خم شدن به جلو تسکین می‌یابد، مشخصه تنگی کانال نخاعی است.",
        "micro": {
            "lead_fa": "تنگی کانال نخاعی کمری در اثر تغییرات دژنراتیو مفاصل فاست، استئوفیت‌ها و هیپرتروفی لیگامان فلاووم ایجاد می‌شود. علامت شاخص لنگش عصبی (Neurogenic pseudoclaudication) است: درد و کرختی دوطرفه ساق پاها که با ایستادن و اکستنشن کمر تشدید شده (چون کانال تنگ‌تر می‌شود) و با نشستن یا خم شدن به جلو نظیر تکیه دادن به چرخ دستی خرید (Shopping cart sign) برطرف می‌گردد.",
            "lead_en": "Lumbar spinal canal stenosis results from degenerative facet hypertrophy, disc bulging, and ligamentum flavum thickening. Neurogenic claudication is the pathognomonic symptom: bilateral lower extremity ache provoked by walking and standing (spinal extension narrowing the canal) and promptly relieved by sitting or forward flexion (shopping cart sign).",
            "golden_fa": "درد دوطرفه پاها با ایستادن و راه رفتن + بهبود با نشستن و خم شدن به جلو = تنگی کانال نخاعی کمری.",
            "golden_en": "Bilateral leg pain with standing/walking relieved by sitting and forward flexion = lumbar spinal stenosis.",
            "points_fa": [
                "افتراق از لنگش عروقی: لنگش عصبی با ایستادن ثابت برطرف نمی‌شود و نیازمند فلکشن ستون فقرات یا نشستن است.",
                "نبض‌های محیطی پا در تنگی کانال نخاعی کاملاً نرمال و پرجهش لمس می‌شوند.",
                "ام‌آر‌آی بدون تزریق ستون فقرات کمری روش تصویربرداری انتخابی برای اثبات تنگی است.",
                "درمان‌های اولیه شامل فیزیوتراپی در وضعیت فلکسیون، دوچرخه ثابت و تزریق اپیدورال استروئید است."
            ],
            "points_en": [
                "Differentiating vascular claudication: neurogenic claudication is not relieved by standing still and requires sitting.",
                "Distal peripheral arterial pulses are intact and bounding in neurogenic claudication.",
                "Non-contrast lumbar MRI is the definitive imaging study establishing the cross-sectional canal area.",
                "Conservative therapy incorporates flexion-based physical therapy, stationary cycling, and epidural steroid injections."
            ]
        }
    },
    72: {
        "whys": [
            "نادرست است؛ دلیل رد: درماتومیوزیت ضعف پروکسیمال ایجاد می‌کند، با راش‌های پوستی مشخص همراه است و تمایلی به ابتلای انتخابی دیستال ندارد.",
            "نادرست است؛ دلیل رد: پلی‌میوزیت به طور متقارن عضلات پروکسیمال را مبتلا می‌سازد و عضلات دیستال در مراحل اولیه سالم می‌مانند.",
            "نادرست است؛ دلیل رد: دیستروفی‌های عضلانی بیماری‌های ژنتیکی با شروع در سنین پایین‌تر هستند و تابلوی شروع تدریجی در سن ۶۳ سالگی ندارند.",
            "صحیح است؛ بروز ضعف عضلانی پیشرونده مزمن در یک مرد بالای ۵۰ سال (۶۳ ساله) که «هم عضلات دیستال (به‌ویژه فلکسورهای عمقی انگشتان و دست) و هم عضلات پروکسیمال (به‌ویژه عضله چهارسر ران / کوادری‌سپس)» را مبتلا ساخته و معاینه حسی نرمال است، تابلوی تیپیک و پاتوگنومونیک «میوزیت با گنجاندگی سلولی (Inclusion Body Myositis / IBM)» است که شایع‌ترین میوپاتی التهابی اکتسابی در افراد بالای ۵۰ سال می‌باشد."
        ],
        "exp": "ضعف پیشرونده همزمان عضلات دیستال (فلکسور انگشتان) و پروکسیمال (کوادری‌سپس) در مرد بالای ۵۰ سال، مشخصه میوزیت انکلوژن بادی (IBM) است.",
        "micro": {
            "lead_fa": "میوزیت با گنجاندگی سلولی (IBM) شایع‌ترین میوپاتی التهابی در مردان بالای ۵۰ سال است. ویژگی‌های تشخیصی منحصربه‌فرد: ۱) شروع بسیار موذی و پیشرونده چندساله؛ ۲) الگوی مشخص ضعف عضلانی نامتقارن که هم عضلات پروکسیمال (به‌ویژه عضله چهارسر ران با زمین خوردن‌های مکرر) و هم عضلات دیستال (به‌ویژه فلکسورهای مچ و انگشتان دست) را درگیر می‌کند؛ ۳) مقاومت تقریباً کامل به کورتیکواستروئیدها و داروهای سرکوب‌کننده ایمنی.",
            "lead_en": "Inclusion body myositis (IBM) is the most common acquired idiopathic inflammatory myopathy in patients over age 50, featuring a male predilection. Unlike polymyositis, IBM characteristically involves both proximal muscles (quadriceps femoris, causing frequent falls) and distal muscles (deep finger flexors), and is notoriously refractory to corticosteroids.",
            "golden_fa": "ضعف عضلات دیستال دست + ضعف کوادری‌سپس در مرد بالای ۵۰ سال = میوزیت انکلوژن بادی (IBM).",
            "golden_en": "Distal finger flexor weakness + quadriceps weakness in male >50 years = inclusion body myositis (IBM).",
            "points_fa": [
                "آنزیم CPK در IBM نرمال یا با افزایش خفیف (کمتر از ۱۰ برابر) گزارش می‌شود.",
                "بیوپسی عضله واکوئول‌های لبه‌دار (Rimmed vacuoles) و ارتشاح التهابی را نشان می‌دهد.",
                "آنتی‌بادی ضد cN1A در سرم مبتلایان به IBM قابل شناسایی است.",
                "درمان بر فیزیوتراپی تقویتی و استفاده از وسایل کمکی پیاده‌روی به دلیل عدم پاسخ به استروئیدها استوار است."
            ],
            "points_en": [
                "Serum creatine kinase levels in IBM are characteristically normal or only mildly elevated (<10-fold).",
                "Muscle biopsy confirms pathognomonic basophilic rimmed vacuoles and amyloid-positive inclusions.",
                "Circulating autoantibodies targeting cytosolic 5'-nucleotidase 1A (anti-cN1A) support the diagnosis.",
                "Therapy focuses on physical therapy and assistive walking devices, as pharmacologic immunosuppression fails."
            ]
        }
    },
    73: {
        "whys": [
            "نادرست است؛ دلیل رد: آلوپورینول در هایپراوریسمی بدون علامت زیر ۹ تا ۱۰ میلی‌گرم بدون سابقه نقرس یا سنگ اندیکاسیون ندارد.",
            "نادرست است؛ دلیل رد: کلشی‌سین داروی ضدالتهاب نقرس است و برای هایپراوریسمی بدون علامت به کار نمی‌رود.",
            "نادرست است؛ دلیل رد: پروبنسید داروی اوریکوزوریک است و مصرف آن در فرد بدون علامت کاملاً اشتباه است.",
            "صحیح است؛ در یک فرد ۵۹ ساله که کاملاً بدون علامت است و سطح اسید اوریک سرم ۸ میلی‌گرم در دسی‌لیتر و عملکرد کلیوی طبیعی (کراتینین ۰/۹) دارد، تابلوی «هایپراوریسمی بدون علامت (Asymptomatic Hyperuricemia)» مطرح است؛ بر اساس تمام راهنماهای بالینی معتبر بین‌المللی (ACR و EULAR)، هایپراوریسمی بدون علامت تا زمانی که اسید اوریک به زیر ۹ تا ۱۰ میلی‌گرم است و سابقه حمله نقرس یا سنگ کلیه وجود ندارد، به هیچ وجه نیازی به درمان دارویی نداشته و «پیگیری بیمار بدون تجویز دارو همراه با اصلاح رژیم غذایی و فعالیت ورزشی» مناسب‌ترین اقدام است."
        ],
        "exp": "هایپراوریسمی بدون علامت بدون سابقه نقرس یا سنگ کلیه نیازی به درمان دارویی ندارد و پیگیری بدون دارو اقدام صحیح است.",
        "micro": {
            "lead_fa": "بیش از ۹۰ درصد افراد دارای هایپراوریسمی در طول زندگی خود هرگز دچار نقرس یا سنگ کلیه نمی‌شوند. بر اساس راهنماهای کالج روماتولوژی آمریکا (ACR)، درمان دارویی کاهنده اسید اوریک در هایپراوریسمی بدون علامت اندیکاسیون ندارد مگر در مواردی که اسید اوریک سرم به ارقام بسیار خطرناک بالای ۱۲ یا ۱۳ میلی‌گرم در دسی‌لیتر برسد یا قبل از شیمی‌درمانی تومورهای با ترن‌اور بالا جهت پیشگیری از سندرم لیز تومور تجویز شود.",
            "lead_en": "Asymptomatic hyperuricemia (serum urate 8 mg/dL) in a patient without prior gout flares, subcutaneous tophi, or nephrolithiasis warrants no pharmacological urate-lowering therapy. The overwhelming majority never develop clinical disease, and guidelines universally recommend observation alongside lifestyle and dietary modifications.",
            "golden_fa": "اسید اوریک ۸ بدون هیچ علامت یا سابقه نقرس = پیگیری بدون دارو همراه با اصلاح تغذیه و ورزش.",
            "golden_en": "Asymptomatic uric acid 8 mg/dL without gout history = observation without medication plus lifestyle modification.",
            "points_fa": [
                "کاهش مصرف گوشت قرمز، الکل و نوشابه‌های حاوی فروکتوز به کنترل اسید اوریک کمک می‌کند.",
                "درمان دارویی مادام‌العمر آلوپورینول عوارض پوستی و آلرژیک بالقوه کشنده دارد و نباید بی‌مورد شروع شود.",
                "در صورت وقوع اولین حمله حاد بالینی نقرس، تصمیم‌گیری جهت درمان دارویی ارزیابی خواهد شد.",
                "تنها اندیکاسیون روتین درمان هایپراوریسمی بدون علامت پیشگیری از سندرم لیز تومور (TLS) است."
            ],
            "points_en": [
                "Dietary counseling emphasizes limiting red meat, organ meats, alcohol, and high-fructose beverages.",
                "Allopurinol carries risks of severe cutaneous adverse reactions and must not be prescribed without clear indications.",
                "Pharmacological intervention is reserved until recurrent gout attacks or structural tophi emerge.",
                "Prophylaxis for tumor lysis syndrome prior to aggressive oncology chemotherapy is a distinct exception."
            ]
        }
    },
    74: {
        "whys": [
            "صحیح است؛ تست «دق پاشنه پا (Heel Strike Test / Heel Tap Test)» با ضربه زدن به پاشنه پا در حالت درازکشیده با زانوی مستقیم انجام می‌شود؛ نیروی ضربه از استخوان درشت‌نی و فمور عبور کرده و مستقیماً به «مفصل ران و هیپ (Hip Joint)» منتقل می‌گردد؛ بروز درد شدید در کشاله ران با این مانور، نشانه قطعی پاتولوژی در خود مفصل هیپ (نظیر استئوآرتریت پیشرفته هیپ، شکستگی فمور یا نکروز آواسکولار سر فمور AVN) است و به افتراق آن از کمردرد کمکی شایان می‌کند.",
            "نادرست است؛ دلیل رد: پاتولوژی ساکروایلیاک با تست‌های پاتریک (فابر) و گانزلین ارزیابی می‌شود.",
            "نادرست است؛ دلیل رد: مفاصل فاست ستون فقرات با اکستنشن و چرخش ستون فقرات کمری تحریک می‌شوند.",
            "نادرست است؛ دلیل رد: دیسک بین‌مهره‌ای با مانور بالا آوردن مستقیم پا (SLR) ارزیابی می‌شود."
        ],
        "exp": "تست دق پاشنه پا با انتقال ضربه به استخوان فمور، نشانه پاتولوژی و بیماری در مفصل ران و هیپ است.",
        "micro": {
            "lead_fa": "در ارزیابی دردهای ناحیه کمر و لگن، افتراق درد ارجاعی ستون فقرات از پاتولوژی داخل مفصل هیپ اهمیت بالایی دارد. تست دق پاشنه پا (Heel strike test) با زدن ضربه محکم به کف پاشنه بیمار در وضعیت خوابیده با پای اکستند انجام می‌شود. این ضربه نیروی فشاری محوری را مستقیماً به سر استخوان فمور و استابولوم وارد کرده و در صورت وجود آرتریت، شکستگی استرسی گردن فمور یا نکروز آواسکولار هیپ، درد شدیدی در کشاله ران برمی‌انگیزد.",
            "lead_en": "The heel strike (heel percussion) test applies a firm axial blow to the patient's calcaneus with the lower extremity extended. The mechanical shock wave travels proximally through the femoral shaft into the acetabulum, selectively triggering sharp groin pain in intra-articular hip pathology (coxarthrosis, femoral neck fracture, or avascular necrosis).",
            "golden_fa": "ایجاد درد در کشاله ران با ضربه به پاشنه پا (دق پاشنه) = نشانه پاتولوژی در مفصل هیپ (ران).",
            "golden_en": "Groin pain elicited by calcaneal percussion (heel strike test) = pathology within the hip joint.",
            "points_fa": [
                "تست چرخش داخلی مفصل هیپ نیز با دقت بالا آسیب داخل مفصل ران را تأیید می‌کند.",
                "درد ستون فقرات کمری به ندرت با تست دق پاشنه بازتولید می‌شود.",
                "در صورت مثبت بودن تست دق پاشنه، انجام رادیوگرافی ساده لگن و مفصل هیپ الزامی است.",
                "تست FABER (پاتریک) نیز برای بررسی همزمان مفصل هیپ و ساکروایلیاک به کار می‌رود."
            ],
            "points_en": [
                "Passive internal rotation of the hip joint exhibits high sensitivity confirming true intra-articular disease.",
                "Lumbar spinal radicular pain is rarely reproduced by pure calcaneal axial percussion.",
                "A positive heel strike test mandates focused anteroposterior pelvic and frog-leg lateral hip radiography.",
                "The FABER (Patrick) test supplements physical examination to differentiate hip from sacroiliac pathology."
            ]
        }
    },
    75: {
        "whys": [
            "صحیح است؛ درد سمت رادیال مچ دست همراه با تندرنس روی استیلوئید رادیوس و برانگیخته شدن درد شدید با انحراف اولنار مچ در وضعیت فلکسیون شست (مانور فینکلشتاین مثبت)، تابلوی تنوسینوویت دکوئروان است؛ پاتوژنز و عامل زمینه‌ای اصلی این بیماری «آسیب و استرس مکانیکی تکراری (Mechanical Microtrauma / Repetitive Strain)» ناشی از حرکات مکرر شست و انحراف مچ دست است که موجب اصطکاک و تنگی غلاف تاندون‌های APL و EPB می‌گردد.",
            "نادرست است؛ دلیل رد: رسوب کریستال (نقرس یا نقرس کاذب) معمولاً مفاصل را درگیر می‌کند و علت تنوسینوویت دکوئروان نیست.",
            "نادرست است؛ دلیل رد: آرتریت روماتوئید پلی‌آرتریت التهابی قرینه ایجاد می‌کند و عامل شایع این تابلوی ایزوله نیست.",
            "نادرست است؛ دلیل رد: استئوآرتریت غضروف مفاصل را تخریب می‌کند در حالی که این ضایعه التهاب غلاف تاندونی است."
        ],
        "exp": "آسیب و استرس مکانیکی تکراری (Repetitive Mechanical Strain) عامل زمینه‌ای اصلی در بروز تنوسینوویت دکوئروان است.",
        "micro": {
            "lead_fa": "تنوسینوویت دکوئروان یک استرس آسیب‌زای ناشی از استفاده مکرر (Repetitive strain injury) است که به علت فعالیت‌های شغلی یا ورزشی با حرکات پی‌درپی گرفتن، چرخاندن و انحراف مچ دست ایجاد می‌شود. اصطکاک مداوم تاندون‌های ابداکتور پولیسیس لونگوس و اکستانسور پولیسیس برویس در عبور از روی استیلوئید رادیوس موجب ضخیم شدن فیبروتیک و تنگی غلاف تاندون می‌گردد.",
            "lead_en": "De Quervain's tenosynovitis is a classic overuse repetitive mechanical strain injury. Repetitive thumb pinching, gripping, and wrist wringing mechanically irritate the abductor pollicis longus and extensor pollicis brevis tendons against the narrow first extensor compartment overlying the radial styloid.",
            "golden_fa": "عامل زمینه‌ای بروز تنوسینوویت دکوئروان در مچ دست = آسیب مکانیکی تکراری (Mechanical Microtrauma).",
            "golden_en": "Underlying etiology of De Quervain tenosynovitis = repetitive mechanical microtrauma and strain.",
            "points_fa": [
                "تست فینکلشتاین تست بالینی پاتوگنومونیک برای بازتولید درد این بیماری است.",
                "شایع‌ترین گروه‌های در معرض خطر شامل مادران پس از زایمان، تایپیست‌ها و نجاران هستند.",
                "استفاده از آتل تامب اسپایکا استرس مکانیکی وارده بر تاندون‌ها را متوقف می‌سازد.",
                "تزریق داخل غلاف کورتیکواستروئید در بیش از ۸۵ درصد بیماران موجب درمان قطعی می‌شود."
            ],
            "points_en": [
                "Finkelstein's test is the pathognomonic physical examination maneuver reproducing radial wrist pain.",
                "High-risk cohorts encompass postpartum caregivers, clerical typists, and assembly-line workers.",
                "Immobilization with a rigid thumb-spica splint eliminates mechanical friction across the retinaculum.",
                "Intralesional corticosteroid injection delivers curative outcomes in >85% of presenting patients."
            ]
        }
    },
    76: {
        "whys": [
            "صحیح است؛ در بیماری با حمله حاد نقرس مفصل زانو (مشاهده کریستال‌های سوزنی MSU) که مبتلا به نارسایی کلیوی پیشرفته با کراتینین 4.0 mg/dL است، داروهای NSAID (ایندومتاسین) به علت سمیت شدید کلیوی و کلشی‌سین به علت سمیت عصبی-عضلانی و تجمع دارویی منع مصرف مطلق دارند؛ داروی انتخابی، مؤثر و ایمن برای مهار فاز حاد التهاب در حضور نارسایی کلیه، «پردنیزولون خوراکی (یا تزریق داخل مفصلی کورتیکواستروئید)» است.",
            "نادرست است؛ دلیل رد: کلشی‌سین در نارسایی کلیه تجمع یافته و خطر میوپاتی شدید، نوروپاتی و سرکوب مغز استخوان دارد.",
            "نادرست است؛ دلیل رد: ایندومتاسین و NSAIDها در کراتینین ۴ فاجعه‌بار هستند و نارسایی حاد کلیه و هیپرکالمی شدید ایجاد می‌کنند.",
            "نادرست است؛ دلیل رد: شروع آلوپورینول در حین حمله فعال حاد ممنوع است زیرا التهاب حاد را تشدید و طولانی می‌نماید."
        ],
        "exp": "در حمله حاد نقرس همراه با نارسایی کلیه (Cr=4)، پردنیزولون خوراکی یا استروئید داخل مفصل امن‌ترین درمان انتخابی است.",
        "micro": {
            "lead_fa": "انتخاب داروی ضدالتهاب در حمله حاد نقرس مستقیماً توسط عملکرد کلیوی بیمار تعیین می‌شود. در بیماران دارای نارسایی شدید کلیوی (کراتینین بالای ۲/۵ یا GFR زیر ۳۰)، مصرف NSAIDها به دلیل مهار تولید پروستاگلاندین‌های گلومرولی می‌تواند منجر به نارسایی کلیوی حاد اولیگوریک شود و کلشی‌سین نیز سمیت سیستمیک ایجاد می‌کند. در این شرایط، گلوکوکورتیکوئیدها (پردنیزولون خوراکی ۳۰ تا ۳۵ میلی‌گرم یا استروئید داخل مفصلی) داروی انتخابی هستند.",
            "lead_en": "Acute gout flare therapy in advanced renal failure (creatinine 4.0 mg/dL) precludes NSAIDs due to severe nephrotoxicity and hyperkalemia, and precludes colchicine due to neuro-muscular toxicity. Systemic oral corticosteroids (prednisone 30-35 mg/day tapered over 10-14 days) or intra-articular steroid injections are the safest agents.",
            "golden_fa": "حمله حاد نقرس + نارسایی کلیه (Cr=4) = پردنیزولون (استروئید)؛ مصرف NSAIDs و کلشی‌سین ممنوع است.",
            "golden_en": "Acute gout flare + severe renal failure (Cr=4) = prednisone (corticosteroids); NSAIDs and colchicine are contraindicated.",
            "points_fa": [
                "پردنیزولون خوراکی با دوز ۳۰ تا ۳۵ میلی‌گرم روزانه به مدت ۵ روز تجویز شده و تدریجاً قطع می‌گردد.",
                "تزریق داخل مفصلی تریامسینولون در صورتی که فقط یک مفصل درگیر باشد انتخابی‌تر است.",
                "شروع آلوپورینول باید تا زمان برطرف شدن کامل حمله حاد به تعویق بیفتد.",
                "در شروع آلوپورینول پس از بهبود حمله، تنظیم دوز دقیق بر اساس کلیرانس کراتینین اجباری است."
            ],
            "points_en": [
                "Oral prednisone (30-35 mg daily for 5 days, then tapered over 5-10 days) provides safe, potent anti-inflammatory relief.",
                "Intra-articular triamcinolone injection is exceptionally efficacious when a single accessible joint is involved.",
                "Urate-lowering therapy with allopurinol must never be newly instituted during an active inflammatory attack.",
                "Post-flare allopurinol titration requires rigorous dose reduction adjusted for residual renal clearance."
            ]
        }
    },
    77: {
        "whys": [
            "نادرست است؛ دلیل رد: آرتریت کریستالی حملات حاد ناگهانی با فواصل بدون علامت می‌دهد نه تابلوی پیشرونده ۵ ماهه با مایع التهابی خفیف.",
            "نادرست است؛ دلیل رد: استئوآرتریت بیماری دژنراتیو است و با ESR=55 و هیپرتروفی سینوویال واضح در مرد ۴۵ ساله همخوانی ندارد.",
            "صحیح است؛ مونوآرتریت مزمن زانو با تداوم ۵ ماهه همراه با هیپرتروفی سینوویال واضح، افزایش ESR، منفی بودن سرولوژی RF/CCP، مایع سینوویال التهابی ملایم (WBC=2800 با ۵۵٪ نوتروفیل)، و منفی بودن اسمیر و کشت باکتری‌های معمول در یک فرد بومی منطقه آندمیک (استان گلستان)، تابلوی کلاسیک و پاتوگنومونیک «آرتریت توبرکولوزی (سل مفصلی / Tuberculous Arthritis)» است که نیازمند بیوپسی سینوویال است.",
            "نادرست است؛ دلیل رد: آرتریت سپتیک حاد باکتریایی یک بیماری برق‌آسا چند روزه با مایع چرکی بالای ۵۰٬۰۰۰ سلول است نه ۵ ماه سابقه."
        ],
        "exp": "مونوآرتریت مزمن ۵ ماهه با هیپرتروفی سینوویال و کشت معمول منفی در منطقه اندمیک، تابلوی تیپیک آرتریت سلی است.",
        "micro": {
            "lead_fa": "سل مفصلی شایع‌ترین علت مونوآرتریت مزمن کم‌درد (Cold arthritis) در کشورهای در حال توسعه و مناطق اندمیک است. ویژگی‌های شاخص: ۱) سیر موذی چندماهه در مفاصل بزرگ (زانو و هیپ)؛ ۲) افیوژن سرد با هیپرتروفی ضخیم سینوویال؛ ۳) مایع مفصلی التهابی ملایم با گلبول سفید اغلب زیر ۲۰٬۰۰۰ و تعادل سلولی؛ ۴) منفی بودن کشت باکتری‌های معمول. تشخیص قطعی نیازمند بیوپسی سینوویال و بررسی پاتولوژی گرانولوم و کشت باسیل کخ است.",
            "lead_en": "Tuberculous monoarthritis characteristically presents as an insidious, indolent chronic monoarthritis persisting over months, with the knee being the most common peripheral site. In endemic regions, a 5-month history of joint swelling, elevated ESR, and sterile standard bacterial cultures strongly points to mycobacterial infection, requiring synovial biopsy.",
            "golden_fa": "مونوآرتریت مزمن زانو با کشت منفی باکتری در منطقه اندمیک = آرتریت توبرکولوزی (سل مفصلی).",
            "golden_en": "Chronic indolent knee monoarthritis with sterile standard cultures in endemic area = tuberculous arthritis.",
            "points_fa": [
                "رنگ‌آمیزی اسید فست مایع سینوویال در کمتر از ۳۰ درصد موارد مثبت است و منفی بودن آن سل را رد نمی‌کند.",
                "بیوپسی بافت سینوویال استاندارد طلایی با حساسیت بالای ۸۵ تا ۹۰ درصد است.",
                "تریاد فیمیستر در رادیوگرافی ساده زانو دیده می‌شود.",
                "درمان استاندارد شامل مصرف داروهای ضدسل چهارگانه به مدت ۹ تا ۱۲ ماه است."
            ],
            "points_en": [
                "Direct acid-fast staining of synovial fluid displays low sensitivity (<30%); a negative smear does not exclude TB.",
                "Synovial tissue biopsy with mycobacterial culture represents the definitive gold standard (>85% sensitivity).",
                "Radiographic Phemister triad exhibits juxta-articular osteopenia, joint space narrowing, and peripheral erosions.",
                "Standard therapy mandates quadruple antituberculous chemotherapy sustained for 9 to 12 months."
            ]
        }
    },
    78: {
        "whys": [
            "نادرست است؛ دلیل رد: احتمال بلوک قلبی جنین در مادر دارای Anti-Ro در اولین بارداری حدود ۲ درصد است نه ۴۰ درصد.",
            "نادرست است؛ دلیل رد: اکوکاردیوگرافی سریال جنین جهت بررسی بلوک قلبی از هفته ۱۶ بارداری (نه هفته ۴ تا ۱۲) آغاز می‌شود.",
            "صحیح است؛ در خانم مبتلا به بیماری لوپوس اریتماتوی سیستمیک (به‌ویژه با سابقه نفریت لوپوسی و Anti-dsDNA بالا)، مهم‌ترین اصل در برنامه‌ریزی بارداری ایمن «لزوم خاموش و ساکت بودن کامل بیماری حداقل به مدت ۶ ماه قبل از لقاح (Quiescent disease for ≥ 6 months)» است؛ بارداری در فاز فعال بیماری با خطرات بسیار بالای سقط، پره‌اکلامپسی شدید و آسیب غیرقابل برگشت کلیه مادر همراه است.",
            "نادرست است؛ دلیل رد: مایکوفنولات موفتیل (MMF) داروی به شدت تراتوژن است و باید حداقل ۶ هفته تا ۳ ماه قبل از بارداری قطع شود."
        ],
        "exp": "در بیمار لوپوسی قصد بارداری، شرط اساسی خاموشی و عدم فعالیت کامل بیماری برای حداقل ۶ ماه قبل از لقاح است.",
        "micro": {
            "lead_fa": "مشاوره پیش از بارداری در بیماران لوپوسی نیازمند رعایت دو اصل حیاتی است: ۱) زمان‌بندی: بارداری باید پس از حداقل ۶ ماه خاموشی بالینی و سرولوژیک کامل بیماری برنامه‌ریزی شود؛ ۲) تنظیم داروها: داروهای تراتوژن شامل مایکوفنولات موفتیل (MMF)، متوترکسات و مهارکننده‌های ACE باید ماه‌ها قبل قطع شده و با داروهای ایمن در بارداری (آزاتیوپرین و هیدروکسی‌کلروکین) جایگزین گردند.",
            "lead_en": "Preconception counseling in systemic lupus erythematosus mandates at least 6 months of documented clinical and serological disease quiescence prior to conception to optimize maternal and fetal outcomes. Teratogenic agents like mycophenolate mofetil must be discontinued at least 6-12 weeks before conception and transitioned to azathioprine.",
            "golden_fa": "برنامه‌ریزی بارداری در مادر لوپوسی: خاموشی کامل بیماری برای حداقل ۶ ماه قبل از بارداری الزامی است.",
            "golden_en": "Pregnancy planning in SLE: documented disease quiescence for at least 6 months prior to conception is mandatory.",
            "points_fa": [
                "هیدروکسی‌کلروکین در طول تمام دوران بارداری ادامه می‌یابد و مانع از شعله‌وری بیماری مادر و بلوک قلبی جنین می‌شود.",
                "مایکوفنولات موفتیل ناهنجاری‌های شدید مادرزادی صورت و گوش ایجاد می‌کند و در بارداری ممنوع است.",
                "اکوکاردیوگرافی داپلر قلب جنین در مادران با Anti-Ro مثبت از هفته ۱۶ تا ۲۶ هر ۱ تا ۲ هفته انجام می‌گردد.",
                "فعال بودن نفریت در زمان لقاح با مورتالیتی بالای جنین و نارسایی کلیه مادر همراه است."
            ],
            "points_en": [
                "Hydroxychloroquine should be maintained throughout pregnancy, reducing disease flares and neonatal complications.",
                "Mycophenolate mofetil causes severe craniofacial teratogenicity and must be cleared prior to conception.",
                "Serial fetal echocardiography is performed every 1-2 weeks from weeks 16 through 26 in anti-Ro-positive mothers.",
                "Active lupus nephritis at the time of conception dramatically elevates preeclampsia, fetal loss, and renal failure."
            ]
        }
    },
    79: {
        "whys": [
            "نادرست است؛ دلیل رد: آلوپورینول داروی کاهنده اسید اوریک است و با دوز ثابت عامل هایپراوریسمی و حمله نیست.",
            "صحیح است؛ داروی «فورزماید (دیورتیک لوپ / Furosemide)» با القای کاهش حجم درون‌عروقی، بازجذب فعال اسید اوریک را در لوله‌های پروکسیمال کلیه به شدت تحریک کرده و کلیرانس ادراری اورات را مهار می‌سازد؛ در نتیجه دیورتیک‌ها از شایع‌ترین علل دارویی افزایش اسید اوریک خون و بروز حملات راجعه نقرس (پوداگرا) هستند.",
            "نادرست است؛ دلیل رد: لوزارتان داروی ضد فشار خون با خاصیت اوریکوزوریک (دفع اسید اوریک) است و محافظت‌کننده در برابر نقرس است.",
            "نادرست است؛ دلیل رد: آتورواستاتین داروی کاهنده چربی است و اثر نامطلوبی بر متابولیسم اسید اوریک ندارد."
        ],
        "exp": "فورزماید (دیورتیک لوپ) با کاهش حجم و افزایش بازجذب توبولار اورات، محرک اصلی بروز حملات راجعه نقرس است.",
        "micro": {
            "lead_fa": "دیورتیک‌ها (شامل دیورتیک‌های لوپ نظیر فورزماید و دیورتیک‌های تیازیدی) مهم‌ترین عامل ایتروژنیک هایپراوریسمی و شعله‌وری نقرس هستند. دیورتیک‌ها با انقباض حجم خارج سلولی، بازجذب اورات از طریق ترانسپورتر URAT1 را در توبول پروکسیمال به شدت افزایش می‌دهند. در نقطه مقابل، لوزارتان تنها داروی آنتاگونیست گیرنده آنژیوتانسین (ARB) است که URAT1 را مهار کرده و اسید اوریک را دفع می‌کند.",
            "lead_en": "Loop diuretics (furosemide) and thiazides are prominent pharmacological culprits triggering recurrent gout attacks. By inducing volume depletion, they stimulate proximal tubular reabsorption of urate, impairing renal urate excretion. Conversely, losartan uniquely exerts a uricosuric effect by blocking URAT1, making it the preferred antihypertensive in gout.",
            "golden_fa": "دیورتیک‌های لوپ (فورزماید) و تیازیدها شایع‌ترین عامل دارویی تشدید هایپراوریسمی و بروز حمله نقرس هستند.",
            "golden_en": "Loop diuretics (furosemide) and thiazides are the most common pharmacologic triggers for recurrent gout attacks.",
            "points_fa": [
                "در صورت امکان، دیورتیک باید در بیماران مبتلا به نقرس قطع شده یا به لوزارتان تغییر یابد.",
                "لوزارتان داروی انتخابی درمان پرفشاری خون در بیماران مبتلا به نقرس است.",
                "درمان حمله حاد با کلشی‌سین یا استروئید انجام می‌گیرد بدون اینکه رژیم آلوپورینول تغییر یابد.",
                "مصرف آب فراوان در طول روز به رقیق شدن ادرار و دفع اسید اوریک کمک می‌کند."
            ],
            "points_en": [
                "Discontinuing unnecessary diuretics or substituting them with losartan substantially reduces gout recurrences.",
                "Losartan is the ideal first-line antihypertensive in hyperuricemic and gouty hypertensive cohorts.",
                "Acute gout attacks should be treated with short-course anti-inflammatories without altering baseline allopurinol.",
                "Copious daily hydration facilitates renal urate clearance and prevents urinary supersaturation."
            ]
        }
    },
    80: {
        "whys": [
            "نادرست است؛ دلیل رد: در آرتریت روماتوئید مایع مفصلی در محدوده التهابی وسیع قرار دارد و شمارش سلول به تنهایی تشخیصی برای RA نیست.",
            "نادرست است؛ دلیل رد: نقرس بر اساس مشاهده کریستال‌های MSU زیر میکروسکوپ پلاریزان تشخیص داده می‌شود نه شمارش سلولی.",
            "صحیح است؛ شمارش گلبول‌های سفید مایع مفصلی (Synovial WBC Count) بالاترین ارزش افتراقی را در «تفکیک بیماری غیرالتهابی استئوآرتریت (WBC کمتر از ۲۰۰۰ در میکرولیتر، معمولاً زیر ۱۰۰۰ با غلبه تک‌هسته‌ای) از سایر آرتریت‌های التهابی (WBC بالای ۲۰۰۰ تا ۵۰٬۰۰۰) و عفونی (WBC بالای ۵۰٬۰۰۰)» دارد؛ بنابراین عدد ۲۰۰۰ سلول در میکرولیتر مرز قطعی افتراق استئوآرتریت از سایر بیماری‌های مفصلی است.",
            "نادرست است؛ دلیل رد: آرتریت سپتیک بر اساس اسمیر گرم و کشت باکتریولوژی تأیید می‌شود و گلبول سفید بالا در آرتریت‌های کریستالی شدید نیز دیده می‌شود."
        ],
        "exp": "شمارش گلبول سفید مایع سینوویال (مرز ۲۰۰۰ سلول) بالاترین ارزش افتراقی را در تشخیص استئوآرتریت غیرالتهابی دارد.",
        "micro": {
            "lead_fa": "آنالیز شمارش گلبول‌های سفید مایع سینوویال اولین و پایه‌ای‌ترین تقسیم‌بندی را در مایعات مفصلی ایجاد می‌کند: ۱) گروه I یا غیرالتهابی با گلبول سفید کمتر از ۲۰۰۰ در میکرولیتر (به‌ویژه کمتر از ۱۰۰۰ با کمتر از ۲۵٪ نوتروفیل) که مشخصه قطعی استئوآرتریت و تروما است؛ ۲) گروه II یا التهابی با گلبول سفید ۲۰۰۰ تا ۵۰٬۰۰۰ (RA، نقرس، اسپوندیلوآرتریت)؛ ۳) گروه III یا چرکی با گلبول سفید بالای ۵۰٬۰۰۰ (آرتریت سپتیک). بنابراین شمارش سلولی بیشترین نقش را در افتراق استئوآرتریت دارد.",
            "lead_en": "Synovial fluid leukocyte quantification provides its most definitive differential diagnostic demarcation in separating non-inflammatory Group I effusions (<2,000 WBCs/μL, typically <1,000 with <25% PMNs), characteristic of osteoarthritis, from inflammatory and septic categories.",
            "golden_fa": "ارزش افتراقی اصلی شمارش WBC مایع مفصلی = تفکیک استئوآرتریت غیرالتهابی (زیر ۲۰۰۰) از آرتریت‌های التهابی.",
            "golden_en": "The primary differential utility of synovial WBC count = distinguishing non-inflammatory osteoarthritis (<2,000) from inflammatory arthritis.",
            "points_fa": [
                "مایع سینوویال در استئوآرتریت شفاف، زرد کهربایی و با ویسکوزیته کاملاً طبیعی و حفظ رشته چسبنده است.",
                "در آرتریت‌های التهابی ویسکوزیته کاهش یافته و مایع کدر می‌شود.",
                "شمارش گلبول سفید بالای ۵۰٬۰۰۰ با بیش از ۹۰٪ نوتروفیل شک به سپسیس را قطعی می‌سازد.",
                "آزمایش کریستال زیر نور پلاریزان برای تشخیص قطعی نقرس و نقرس کاذب الزامی است."
            ],
            "points_en": [
                "Synovial fluid in osteoarthritis is crystal clear, straw-yellow, and retains high string-sign viscosity.",
                "Inflammatory synovial fluid loses viscosity due to leukocyte hyaluronidase degradation.",
                "Counts exceeding 50,000/μL with >90% neutrophils strongly substantiate pyogenic joint infection.",
                "Polarized microscopy crystal evaluation is the definitive gold standard for crystalline arthropathies."
            ]
        }
    },
    81: {
        "whys": [
            "صحیح است؛ در بیماری که قبلاً تشخیص آرتریت روماتوئید در وی قطعی شده و تحت درمان دارویی قرار دارد، اتوآنتی‌بادی‌ها (RF و Anti-CCP) جنبه تشخیصی داشته و تیتر آن‌ها برای پایش تغییرات کوتاه‌مدت فعالیت بیماری مناسب نیست؛ جهت «ارزیابی فعالیت جاری بیماری (Disease Activity Assessment)»، اندازه‌گیری «شاخص‌های فاز حاد التهابی شامل ESR (یا CRP)» بالاترین ارزش بالینی را دارد و در فرمول‌های استاندارد DAS28 برای تصمیم‌گیری در تغییر دوز داروها استفاده می‌شود.",
            "نادرست است؛ دلیل رد: Anti-CCP مارکر تشخیصی و پیش‌آگهی است و تیتر آن با نوسانات فعالیت بیماری تغییر نمی‌کند.",
            "نادرست است؛ دلیل رد: RF در طول زمان نوسان منظمی با شدت فعالیت سینوویت ندارد و پایش آن روتین نیست.",
            "نادرست است؛ دلیل رد: ANA آزمایشی برای لوپوس است و نقشی در ارزیابی فعالیت آرتریت روماتوئید ندارد."
        ],
        "exp": "نشانگرهای فاز حاد التهابی (ESR و CRP) آزمایش‌های استاندارد برای ارزیابی و پایش فعالیت بیماری در آرتریت روماتوئید هستند.",
        "micro": {
            "lead_fa": "در پیگیری بالینی بیماران مبتلا به آرتریت روماتوئید، تفکیک تست‌های تشخیصی از تست‌های پایش فعالیت ضروری است. آنتی‌بادی‌های Anti-CCP و RF مارکرهای تشخیصی هستند که پس از اثبات بیماری نیازی به تکرار ندارند زیرا نوسان آن‌ها منعکس‌کننده فعالیت سینوویت نیست. در نقطه مقابل، نشانگرهای فاز حاد ESR و CRP به سرعت با شدت التهاب همگام می‌شوند و اجزای اصلی شاخص‌های نمره‌دهی بالینی DAS28 و CDAI هستند.",
            "lead_en": "In established rheumatoid arthritis, autoantibodies (RF and anti-CCP) establish initial diagnostic classification but do not reliably fluctuate with clinical synovitis. Serial assessment of disease activity strictly relies upon acute-phase reactants, predominantly erythrocyte sedimentation rate (ESR) and C-reactive protein (CRP), embedded within composite scoring systems (DAS28).",
            "golden_fa": "ارزیابی و پایش فعالیت بیماری در آرتریت روماتوئید = اندازه‌گیری نشانگرهای فاز حاد ESR و CRP.",
            "golden_en": "Assessing disease activity in rheumatoid arthritis = acute-phase reactants ESR and CRP (not RF/anti-CCP).",
            "points_fa": [
                "شاخص نمره فعالیت بیماری (DAS28) از تعداد مفاصل متورم، تندر و سطح ESR یا CRP تشکیل می‌شود.",
                "پروتئین واکنشی C (CRP) تغییرات سریع‌تری نسبت به ESR در پاسخ به درمان نشان می‌دهد.",
                "هدف درمانی در آرتریت روماتوئید رسیدن به وضعیت خاموشی (Remission) یا حداقل فعالیت بیماری است.",
                "تکرار روتین آزمایشات RF و Anti-CCP در طول درمان اتلاف هزینه بوده و توصیه نمی‌شود."
            ],
            "points_en": [
                "The DAS28 disease activity score integrates tender/swollen joint counts with patient global health and ESR or CRP.",
                "C-reactive protein responds more rapidly to therapeutic adjustments than the erythrocyte sedimentation rate.",
                "The overarching therapeutic goal is achieving clinical remission (DAS28 <2.6) or low disease activity.",
                "Routine repeat testing of RF and anti-CCP titers during follow-up provides zero added clinical utility."
            ]
        }
    },
    82: {
        "ci": 1,
        "key_source": "registry-corrected",
        "whys": [
            "نادرست است؛ دلیل رد: استئوآرتریت مفصل استرنوکلاویکولار به صورت حاد با قرمزی و درد شدید در فرد جوان معتاد تزریقی بروز نمی‌کند.",
            "صحیح است؛ در یک فرد معتاد به مواد مخدر تزریقی (IV Drug User) که با شروع حاد تورم، قرمزی، گرما و تندرنس شدید در مفصل استرنوکلاویکولار (Sternoclavicular Joint) مراجعه کرده است، محتمل‌ترین و خطرناک‌ترین تشخیص «آرتریت عفونی یا سپتیک (Infectious Arthritis)» است؛ مفصل استرنوکلاویکولار و مفاصل فیبروکارتیلاژینوس محوری (ساکروایلیاک و سمفیز پوبیس) تمایل بالایی برای آلودگی با باکتری‌های پسودوموناس آئروژینوزا و استافیلوکوک اورئوس در معتادان تزریقی دارند.",
            "نادرست است؛ دلیل رد: نقرس در مفصل استرنوکلاویکولار بسیار نادر است و در یک فرد جوان معتاد تزریقی در اولویت قرار ندارد.",
            "نادرست است؛ دلیل رد: آرتریت ناشی از HIV به شکل اولیگوآرتریت زانو یا مچ پا است و مونوآرتریت حاد چرکی استرنوکلاویکولار نمی‌دهد."
        ],
        "exp": "تورم حاد، درد و قرمزی مفصل استرنوکلاویکولار در فرد معتاد تزریقی، پاتوگنومونیک آرتریت عفونی (سپتیک) است.",
        "micro": {
            "lead_fa": "مفصل استرنوکلاویکولار (SC joint) کمتر از ۱ درصد کل موارد آرتریت سپسیس در جمعیت عمومی را شامل می‌شود، اما در افراد مصرف‌کننده مواد مخدر تزریقی (IVDU) یکی از شایع‌ترین نقاط ابتلا است. باکتری‌ها از طریق تزریق غیربهداشتی وارد وریدها شده و در مفاصل فیبروکارتیلاژینوس محوری (استرنوکلاویکولار، ساکروایلیاک و سمفیز پوبیس) مستقر می‌شوند. پاتوژن‌های شایع شامل سودوموناس آئروژینوزا و استافیلوکوک اورئوس هستند. اقدام فوری آرتروسنتز یا درناژ جراحی و آنتی‌بیوتیک وریدی است.",
            "lead_en": "Sternoclavicular joint septic arthritis is distinctly rare in the general population but exhibits an extraordinary predilection for intravenous drug users. Hematogenous seeding of fibrocartilaginous axial articulations typically involves Pseudomonas aeruginosa and Staphylococcus aureus, presenting as acute erythema and exquisite localized tenderness.",
            "golden_fa": "معتاد تزریقی + درد، قرمزی و تورم مفصل استرنوکلاویکولار = آرتریت عفونی (سپتیک) ناشی از سودوموناس یا استاف.",
            "golden_en": "IV drug user + red tender sternoclavicular joint = infectious (septic) arthritis (Pseudomonas or S. aureus).",
            "points_fa": [
                "سودوموناس آئروژینوزا و استافیلوکوک اورئوس شایع‌ترین پاتوژن‌های باکتریایی در معتادان تزریقی هستند.",
                "سی‌تی‌اسکن یا ام‌آر‌آی مفصل استرنوکلاویکولار جهت رد استئومیلیت کلاویکل و آبسه مدیاستن الزامی است.",
                "پوشش آنتی‌بیوتیکی تجربی وریدی باید ونکومایسین به همراه یک داروی ضد سودوموناس (نظیر سفپیم یا مروپنم) باشد.",
                "در صورت وجود آبسه یا تخریب کورتکس، دبریدمان جراحی مفصل استرنوکلاویکولار ضرورت می‌یابد."
            ],
            "points_en": [
                "Pseudomonas aeruginosa and Staphylococcus aureus are the predominant causative microorganisms in IV drug users.",
                "Chest CT or MRI is required to rule out contiguous osteomyelitis, retrosternal phlegmon, or mediastinitis.",
                "Empiric intravenous therapy must combine vancomycin with an antipseudomonal beta-lactam (cefepime/meropenem).",
                "Extensive bone erosion or retrosternal extension mandates surgical joint debridement or resection."
            ]
        }
    },
    83: {
        "whys": [
            "نادرست است؛ دلیل رد: سنجش Anti-dsDNA برای ارزیابی فعال شدن نفریت لوپوسی کاملاً ضروری است.",
            "نادرست است؛ دلیل رد: اندازه‌گیری کمپلمان‌های C3 و C4 برای اثبات مصرف کمپلمان و شعله‌وری کلیوی واجب است.",
            "نادرست است؛ دلیل رد: آزمایش ادرار و کراتینین برای ارزیابی پروتئینوری، سندرم نفروتیک و نارسایی کلیه اقدام پایه‌ای اجباری است.",
            "صحیح است (تستی که ضرورت ندارد)؛ «آنتی‌بادی Anti-U1-RNP» مارکر سرولوژیک بیماری بافت همبند مختلط (MCTD) و پدیده رینود است؛ حضور یا تیتر آن هیچ ارتباطی با ارزیابی بروز ادم اندام‌ها، سندرم نفروتیک یا شعله‌وری نفریت لوپوسی ندارد؛ بنابراین درخواست آن در این شرایط بالینی غیرضروری و فاقد ارزش است."
        ],
        "exp": "در ارزیابی ادم و درگیری کلیه در لوپوس، U/A، کراتینین، کمپلمان و Anti-dsDNA ضروری هستند اما Anti-U1-RNP کاربردی ندارد.",
        "micro": {
            "lead_fa": "بروز ادم اندام تحتانی در یک بیمار لوپوسی زنگ خطر وقوع سندرم نفروتیک ثانویه به نفریت لوپوسی فعال (به‌ویژه کلاس ۴ پرولیفراتیو یا کلاس ۵ ممبرانوس) است. پنل بررسی آزمایشگاهی استاندارد شامل: ۱) آزمایش کامل ادرار (U/A) جهت کست‌ها و هماچوری؛ ۲) نسبت پروتئین به کراتینین ادرار ۲۴ ساعته؛ ۳) سنجش سطح کمپلمان‌های C3 و C4؛ ۴) تیتر Anti-dsDNA است. آنتی‌بادی Anti-U1-RNP نقشی در ارزیابی عملکرد و التهاب کلیه ندارد.",
            "lead_en": "New-onset peripheral edema in an established systemic lupus erythematosus patient raises urgent suspicion for nephrotic syndrome driven by active lupus nephritis. Essential laboratory surveillance incorporates urinalysis, 24-hour proteinuria, serum creatinine, complement levels (C3/C4), and anti-dsDNA titers. Anti-U1-RNP testing provides zero diagnostic value here.",
            "golden_fa": "بررسی ادم در بیمار لوپوسی: U/A، پروتئینوری، کراتینین، C3/C4 و dsDNA؛ آزمایش Anti-U1-RNP ضرورت ندارد.",
            "golden_en": "Evaluating edema in SLE: U/A, proteinuria, creatinine, C3/C4, and dsDNA; anti-U1-RNP is non-contributory.",
            "points_fa": [
                "افت سطح C3 و C4 همگام با افزایش Anti-dsDNA پاتوگنومونیک شعله‌وری حاد نفریت لوپوسی است.",
                "پروتئینوری بالای ۰/۵ تا ۱ گرم در روز اندیکاسیون قطعی بیوپسی سوزنی کلیه است.",
                "کنترل فشار خون و تجویز مهارکننده ACE در کنار درمان سرکوب ایمنی پروتئینوری را کاهش می‌دهد.",
                "هیدروکسی‌کلروکین داروی سنگ‌بنایی است که باید همواره ادامه یابد."
            ],
            "points_en": [
                "Hypocomplementemia coupled with rising anti-dsDNA titers classically heralds an active lupus nephritis flare.",
                "Proteinuria exceeding 0.5 to 1.0 g/day establishes a firm indication for percutaneous ultrasound-guided renal biopsy.",
                "ACE inhibitors or ARBs serve as crucial adjunctive antiproteinuric and renoprotective agents.",
                "Hydroxychloroquine therapy must be sustained continuously to enhance renal and overall survival."
            ]
        }
    },
    84: {
        "whys": [
            "نادرست است؛ دلیل رد: مایع شفاف با WBC=2000 مایع غیرالتهابی است و با زانوی تب‌دار، داغ و قرمز مطابقت ندارد.",
            "صحیح است؛ تابلوی مونوآرتریت حاد، گرم، اریتماتو، افیوژن و بسیار حساس زانو همراه با تب در یک بیمار دیابتی، تابلوی تیپیک «آرتریت سپتیک حاد چرکی (Septic Arthritis / گروه III)» است؛ مشخصات استاندارد مایع سینوویال در آرتریت چرکی عبارت است از: «مایع چرکی کدر (Purulent)، شمارش گلبول سفید به شدت بالا (معمولاً بین ۵۰٬۰۰۰ تا ۱۰۰٬۰۰۰ در میکرولیتر یا بیشتر)، غلبه شدید نوتروفیل‌های چند‌هسته‌ای (بیش از ۹۰٪ PMN)، و ویسکوزیته به شدت کاهش‌یافته» به علت تخریب اسید هیالورونیک.",
            "نادرست است؛ دلیل رد: مایع شفاف با WBC=200 مایع کاملاً نرمال است.",
            "نادرست است؛ دلیل رد: WBC=5000 با ۵۰٪ نوتروفیل مایع التهابی ملایم است و تابلوی سپسیس حاد مفصلی را توضیح نمی‌دهد."
        ],
        "exp": "مایع سینوویال در آرتریت سپسیس حاد چرکی است، گلبول سفید بالای ۵۰ تا ۱۰۰ هزار با بیش از ۹۰٪ نوتروفیل و ویسکوزیته کاهش‌یافته دارد.",
        "micro": {
            "lead_fa": "مایع سینوویال گروه ۳ (سپتیک) نشانه عفونت باکتریایی حاد چرکی داخل مفصل است. ویژگی‌های فیزیکی و بیوشیمیایی مایع چرکی: ۱) ظاهر کدر، مات یا چرکی به رنگ شیری تا زرد-سبز؛ ۲) شمارش گلبول‌های سفید بسیار بالا (WBC بالای ۵۰٬۰۰۰ و شایعاً بالای ۱۰۰٬۰۰۰ در میکرولیتر)؛ ۳) درصد نوتروفیل‌های چند‌هسته‌ای (PMN) بیش از ۹۰ درصد؛ ۴) ویسکوزیته بسیار پایین به طوری که از دهانه سوزن مانند آب قطره‌قطره می‌چکد (String test منفی).",
            "lead_en": "Group III septic synovial fluid denotes acute purulent bacterial arthritis. Key laboratory findings include turbid, frankly purulent appearance, profound neutrophilic leukocytosis (WBC >50,000-100,000/μL with >90% polymorphonuclears), and markedly diminished viscosity secondary to bacterial hyaluronidase degradation.",
            "golden_fa": "مایع مفصلی آرتریت سپسیس: ظاهر چرکی + گلبول سفید بالای ۵۰ تا ۱۰۰ هزار + بیش از ۹۰٪ نوتروفیل + ویسکوزیته کاهش‌یافته.",
            "golden_en": "Septic synovial fluid: frankly purulent + WBC >50,000-100,000/μL + >90% neutrophils + markedly reduced viscosity.",
            "points_fa": [
                "رنگ‌آمیزی گرم مایع سینوویال بلافاصله پس از آسپیراسیون ارگانیسم را جستجو می‌کند.",
                "کشت مایع مفصلی استاندارد طلایی قطعی شناسایی باکتری و تعیین آنتی‌بیوگرام است.",
                "شروع فوری آنتی‌بیوتیک تجربی وسیع‌الطیف وریدی بدون اتلاف وقت الزامی است.",
                "آرتریت‌های کریستالی بسیار شدید (نقرس حاد) ندرتاً می‌توانند شمارش سلولی شبیه سپسیس تقلید کنند."
            ],
            "points_en": [
                "Synovial Gram stain should be evaluated immediately following aspiration for early pathogen identification.",
                "Synovial fluid bacterial culture remains the gold standard directing targeted pathogen-specific therapy.",
                "Immediate empiric broad-spectrum intravenous antimicrobial therapy must follow joint decompression.",
                "Severe crystalline arthropathy flares (hyperacute gout) can occasionally produce pseudo-septic counts."
            ]
        }
    },
    85: {
        "whys": [
            "نادرست است؛ دلیل رد: افیوژن زانو در هر دو بیماری استئوآرتریت و آرتریت روماتوئید ممکن است دیده شود و اختصاصی نیست.",
            "صحیح است؛ «مفاصل مچ دست (Wrist Joints)» به طور کلاسیک و پاتوگنومونیک کانون اصلی التهاب در «آرتریت روماتوئید (Rheumatoid Arthritis)» هستند؛ در نقطه مقابل، مفاصل رادیوکارپال مچ دست در «استئوآرتریت اولیه به طور اکید سالم می‌مانند و درگیر نمی‌شوند»؛ بنابراین وجود تورم و تندرنس واضح در مچ دست‌ها قویاً به نفع RA و قاطعانه بر ضد تشخیص استئوآرتریت اولیه است.",
            "نادرست است؛ دلیل رد: درد و تورم مفاصل DIP مشخصه بارز استئوآرتریت اولیه (گره‌های هبردن) است و در RA دیده نمی‌شود.",
            "نادرست است؛ دلیل رد: کریپتاسیون زانو یافته کلاسیک استئوآرتریت است و بر ضد RA نیست."
        ],
        "exp": "تورم و تندرنس مچ دست مشخصه اصلی آرتریت روماتوئید است و در استئوآرتریت اولیه دیده نمی‌شود و سالم می‌ماند.",
        "micro": {
            "lead_fa": "یکی از مهم‌ترین قواعد افتراق آرتریت روماتوئید از استئوآرتریت، الگوی مفاصل درگیر است. استئوآرتریت مفاصل اینترفالانژیال دیستال (DIP)، قاعده شست (CMC1)، زانوها و هیپ را درگیر می‌سازد و مفاصل مچ دست را کاملاً سالم می‌گذارد. در مقابل، آرتریت روماتوئید علاقه وافری به مفاصل مچ دست، MCPها و PIPها دارد و مفاصل DIP را درگیر نمی‌کند. بنابراین سینوویت مچ دست استئوآرتریت اولیه را قاطعانه رد می‌کند.",
            "lead_en": "Joint distribution is the paramount discriminator separating rheumatoid arthritis from osteoarthritis. Osteoarthritis targets the DIPs, first CMC, knees, and hips, characteristically sparing the radiocarpal wrist joint. Conversely, rheumatoid arthritis universally attacks the wrists, MCPs, and PIPs, strictly sparing the DIP joints.",
            "golden_fa": "تورم و تندرنس مفاصل مچ دست = به نفع آرتریت روماتوئید و بر ضد استئوآرتریت اولیه.",
            "golden_en": "Wrist joint swelling and tenderness = supports rheumatoid arthritis and strongly argues against primary osteoarthritis.",
            "points_fa": [
                "مفاصل DIP در آرتریت روماتوئید به طور مشخص سالم می‌مانند.",
                "گره‌های هبردن در مفاصل DIP و بوچارد در PIP مشخصه استئوآرتریت هستند.",
                "درد در استئوآرتریت مکانیکی با خشکی صبحگاهی کوتاه است، در حالی که RA خشکی صبحگاهی طولانی دارد.",
                "درگیری مچ دست در استئوآرتریت فقط در صورت ترومای قبلی یا بیماری‌های متابولیک نظیر CPPD دیده می‌شود."
            ],
            "points_en": [
                "Distal interphalangeal (DIP) joints are characteristically spared in rheumatoid arthritis.",
                "Heberden (DIP) and Bouchard (PIP) nodes are hard bony hallmarks of hand osteoarthritis.",
                "Osteoarthritis features mechanical loading pain and brief stiffness, contrasted with prolonged RA morning stiffness.",
                "Wrist involvement in an osteoarthritic pattern only occurs secondary to remote fracture or metabolic CPPD."
            ]
        }
    },
    86: {
        "whys": [
            "صحیح است؛ تست «Crossed Straight Leg Raise (Crossed SLR / Well-leg raise test)» - که با بالا آوردن پای سالم و بدون درد انجام می‌شود و باعث برانگیخته شدن درد تیرکشنده سیاتیک در پای مبتلای طرف مقابل می‌گردد - دارای «اختصاصیت فوق‌العاده بالا (Specificity بیش از ۹۰٪)» برای اثبات فتق دیسک کمری بین‌مهره‌ای و رادیکولوپاتی فشاری ریشه عصبی است.",
            "نادرست است؛ دلیل رد: تست SLR معمولی حساسیت بالایی دارد (بیش از ۸۰-۹۰٪) اما اختصاصیت پایینی دارد (حدود ۴۰-۵۰٪) و در بسیاری از دردهای عضلانی یا مثبت کاذب است.",
            "نادرست است؛ دلیل رد: Reversed SLR برای ارزیابی ریشه‌های فوقانی کمری (L2 تا L4 و عصب فمورال) به کار می‌رود نه عصب سیاتیک.",
            "نادرست است؛ دلیل رد: علامت پاتریک (تست FABER) برای ارزیابی پاتولوژی مفصل ران و ساکروایلیاک است."
        ],
        "exp": "تست Crossed SLR با اختصاصیت بالای ۹۰ درصد، اختصاصی‌ترین تست بالینی برای تشخیص رادیکولوپاتی فشاری سیاتیک است.",
        "micro": {
            "lead_fa": "در معاینه فیزیکی رادیکولوپاتی کمری-ساکرو، دو تست کششی عصب سیاتیک بررسی می‌شوند: ۱) تست SLR مستقیم (Lasègue): حساسیت بالا (۹۰٪) دارد اما اختصاصیت ضعیفی دارد؛ ۲) تست Crossed SLR (بالا آوردن پای مقابل سالم): با بالا بردن پای غیردردناک، ریشه عصبی فشرده در سمت مبتلا کشیده شده و درد سیاتیک را بازتولید می‌کند. تست Crossed SLR گرچه حساسیت کمتری دارد اما با اختصاصیت بالای ۹۰ درصد اختصاصی‌ترین تست بالینی است.",
            "lead_en": "The straight leg raise (SLR) is sensitive but non-specific for lumbar disc herniation. The crossed straight leg raise test (well-leg raise), wherein elevating the asymptomatic contralateral lower extremity reproduces radicular pain in the affected limb, demonstrates superior diagnostic specificity (>90%) for nerve root compression.",
            "golden_fa": "اختصاصی‌ترین تست بالینی برای فتق دیسک و رادیکولوپاتی سیاتیک = تست Crossed SLR (اختصاصیت بالای ۹۰٪).",
            "golden_en": "Most specific physical examination test for sciatic radiculopathy = Crossed SLR test (>90% specificity).",
            "points_fa": [
                "مثبت شدن Crossed SLR نشان‌دهنده فتق دیسک بزرگ، مرکزی یا ساب‌لیگامنتوس است.",
                "تست SLR مستقیم در زاویه ۳۰ تا ۷۰ درجه درد رادیکولار زیر زانو ایجاد می‌کند.",
                "تست Reverse SLR (مانور کشش فمورال در حالت دمر) برای ریشه‌های L2-L4 به کار می‌رود.",
                "ام‌آر‌آی لومبوساکرال روش قطعی تصویربرداری در صورت مثبت بودن علائم رادیکولار است."
            ],
            "points_en": [
                "A positive crossed SLR strongly correlates with a large, extruded, or paracentral disc herniation.",
                "Classic direct SLR elicits true shooting radicular pain extending below the knee between 30° and 70°.",
                "The reverse straight leg raise (femoral stretch test) selectively evaluates high lumbar roots (L2-L4).",
                "Lumbar MRI without contrast provides definitive anatomic confirmation when radicular signs are present."
            ]
        }
    },
    87: {
        "whys": [
            "نادرست است؛ دلیل رد: آرتروپاتی جاکود (دفورمیتی‌های مفصلی غیراروزیو و جاافتادنی دست) در ۱۰ تا ۱۵ درصد بیماران لوپوسی دیده می‌شود.",
            "نادرست است؛ دلیل رد: لنفوپنی (لنفوسیت کمتر از ۱۰۰۰ یا ۱۵۰۰) از معیارهای رسمی خونی بیماری SLE است.",
            "صحیح است (علامتی که با لوپوس قابل توجیه نیست)؛ بیماری لوپوس اریتماتوی سیستمیک به علت تولید اتوآنتی‌بادی‌های ضد پلاکت و تخریب در طحال، باعث «ترومبوسیتوپنی (کاهش پلاکت به زیر ۱۰۰٬۰۰۰ در میکرولیتر)» می‌شود؛ بنابراین مشاهده «ترومبوسیتوز (پلاکت ۶۰۰٬۰۰۰)» با روند بیماری SLE همخوانی ندارد و ناشی از علل دیگر نظیر فاز حاد شدید عفونت، کم‌خونی فقر آهن یا اختلالات میلوپرولیفراتیو است.",
            "نادرست است؛ دلیل رد: اختلال عملکرد شناختی (Cognitive dysfunction) از شایع‌ترین تظاهرات لوپوس عصبی-روانی (NPSLE) است."
        ],
        "exp": "لوپوس موجب ترومبوسیتوپنی و لنفوپنی می‌شود؛ بنابراین افزایش پلاکت به ۶۰۰٬۰۰۰ با سیر SLE قابل توجیه نیست.",
        "micro": {
            "lead_fa": "درگیری سیستم خونی در لوپوس اریتماتوی سیستمیک همواره به سمت سیتوپنی‌ها میل می‌کند. معیارهای تشخیصی هماتولوژیک شامل: لکوپنی، لنفوپنی، آنمی همولیتیک اتوایمیون و ترومبوسیتوپنی ایمنی است. ترومبوسیتوز (پلاکت بالای ۴۵۰٬۰۰۰ یا ۶۰۰٬۰۰۰) در لوپوس رخ نمی‌دهد مگر به صورت یک واکنش فاز حاد واکنشی به عفونت باکتریایی شدید همزمان یا کم‌خونی فقر آهن زمینه‌ای.",
            "lead_en": "Hematologic manifestations of systemic lupus erythematosus are universally cytopenic, incorporating autoimmune hemolytic anemia, leukopenia, lymphopenia, and immune thrombocytopenia (<100,000/μL). Marked thrombocytosis (platelets 600,000/μL) is incompatible with primary SLE pathology, signaling severe intercurrent infection or iron deficiency.",
            "golden_fa": "لوپوس موجب کاهش پلاکت (ترومبوسیتوپنی) می‌شود؛ پلاکت ۶۰۰٬۰۰۰ با لوپوس قابل توجیه نیست.",
            "golden_en": "SLE induces immune thrombocytopenia; a platelet count of 600,000/μL is incompatible with uncomplicated lupus.",
            "points_fa": [
                "آرتروپاتی جاکود در لوپوس بدون اروزیون استخوانی و با شلی کپسول و تاندون‌ها همراه است.",
                "ترومبوسیتوپنی شدید در لوپوس با کورتیکواستروئید و در صورت لزوم IVIG درمان می‌شود.",
                "اختلالات شناختی و اختلال حافظه در بیش از ۳۰ درصد بیماران لوپوسی دیده می‌شود.",
                "ترومبوسیتوز شدید در یک بیمار لوپوسی مستلزم جستجوی دقیق کانون عفونت است."
            ],
            "points_en": [
                "Jaccoud's arthropathy represents a non-erosive, passively reducible joint deformity typical of chronic SLE.",
                "Severe immune thrombocytopenia in SLE responds to high-dose systemic steroids and intravenous immunoglobulin.",
                "Cognitive dysfunction and mood disorders affect over 30-50% of patients with neuropsychiatric lupus.",
                "Emergence of reactive thrombocytosis mandates a rigorous diagnostic search for intercurrent occult sepsis."
            ]
        }
    },
    88: {
        "whys": [
            "نادرست است؛ دلیل رد: کاهش قدرت عضلات پروکسیمال شانه و کمربند لگنی علامت محوری بیماری درماتومیوزیت است.",
            "نادرست است؛ دلیل رد: افزایش شدید سطح آنزیم‌های عضلانی (CPK، آلدولاز، LDH و ترانس‌آمینازها) ویژگی شاخص میوزیت فعال است.",
            "نادرست است؛ دلیل رد: ضعف عضلات فلکسور گردن در معاینه فیزیکی میوپاتی‌های التهابی تظاهری شایع و شناخته‌شده است.",
            "صحیح است (یافته‌ای که با بیماری منطبق نیست)؛ در میوپاتی‌های اولیه و بیماری‌های عضلانی نظیر «درماتومیوزیت (Dermatomyositis)»، رفلکس‌های تاندونی عمقی (DTRs) و حس بیمار «کاملاً طبیعی و حفظ‌شده (Preserved)» باقی می‌مانند؛ کاهش یا الغای زودهنگام رفلکس‌های وتری نشانه پاتولوژی نوروپاتی محیطی یا آسیب نورون حرکتی تحتانی است و در درماتومیوزیت رخ نمی‌دهد مگر در مراحل انتهایی آتروفی شدید عضله."
        ],
        "exp": "در بیماری‌های عضلانی نظیر درماتومیوزیت رفلکس‌های تاندونی عمقی (DTRs) حفظ می‌شوند؛ کاهش رفلکس‌ها با آن منطبق نیست.",
        "micro": {
            "lead_fa": "درماتومیوزیت با ضعف متقارن عضلات پروکسیمال کمربند شانه‌ای و لگنی، ضعف عضلات فلکسور گردن و ضایعات پوستی پاتوگنومونیک (راش هلیوتروپ پلک‌ها و پاپول‌های گاترون مفاصل دست) شناخته می‌شود. یک اصل بنیادین در معاینه نورولوژی و روماتولوژی: در بیماری‌های اولیه بافت عضله (میوپاتی‌ها)، رفلکس‌های تاندونی (DTRs) و حس بیمار کاملاً طبیعی هستند. کاهش رفلکس‌ها مطرح‌کننده بیماری‌های نوروپاتیک (نظیر گیلن‌باره) است.",
            "lead_en": "Dermatomyositis manifests with symmetric proximal limb weakness, neck flexor weakness, elevated muscle enzymes, and pathognomonic cutaneous eruptions (heliotrope rash, Gottron papules). Fundamentally, primary myopathies spare deep tendon reflexes (DTRs) and sensation until end-stage muscle atrophy; early hyporeflexia strongly argues against myopathy.",
            "golden_fa": "در درماتومیوزیت رفلکس‌های وتری (DTRs) نرمال و حفظ‌شده هستند؛ کاهش رفلکس‌ها مربوط به نوروپاتی است نه میوزیت.",
            "golden_en": "Deep tendon reflexes are preserved in dermatomyositis; depressed reflexes signify neuropathy rather than myopathy.",
            "points_fa": [
                "راش هلیوتروپ به صورت اریتم بنفش‌رنگ پشت پلک‌ها همراه با ادم تظاهر می‌کند.",
                "پاپول‌های گاترون پلاک‌های بنفش پوسته‌دار بر روی مفاصل اینترفالانژیال و MCP هستند.",
                "آنزیم کراتین کیناز (CPK) مهم‌ترین شاخص آزمایشگاهی سنجش تخریب و پاسخ درمانی است.",
                "غربالگری بدخیمی‌های مخفی در بزرگسالان مبتلا به درماتومیوزیت اجباری است."
            ],
            "points_en": [
                "Heliotrope rash presents as a violaceous periorbital erythema frequently complicated by soft tissue edema.",
                "Gottron papules are erythematous-to-violaceous scaling plaques situated across dorsal MCP and PIP joints.",
                "Serum creatine kinase (CK) serves as the primary biochemical marker tracking active myofiber necrosis.",
                "Malignancy screening remains a mandatory clinical directive in all newly diagnosed adult dermatomyositis cases."
            ]
        }
    },
    89: {
        "whys": [
            "نادرست است؛ دلیل رد: بیمار در حال حاضر حداکثر دوز ایمن استامینوفن (۳ گرم در روز) را مصرف می‌کند و افزایش آن خطرات هپاتوتوکسیسیتی دارد بدون اینکه التهاب زانو را مهار کند.",
            "نادرست است؛ دلیل رد: افزایش دوز سلوکسیب به ۴۰۰ میلی‌گرم در یک خانم مسن با فشار خون ۱۴۰/۱۰۰ و سابقه بیماری قلبی-عروقی، خطرات ترومبوتیک و نارسایی کلیه را به شدت بالا می‌برد.",
            "صحیح است؛ وجود گرمی، تورم و افیوژن حاد زانو در یک خانم با فشار خون بالا و مشاهده کلسیفیکاسیون غضروف مفصلی (کندروکلسینوز / Chondrocalcinosis ناشی از رسوب کریستال‌های پیروفسفات کلسیم CPPD) همراه با استئوآرتریت، مطرح‌کننده شعله‌وری حاد آرتریت کریستالی نقرس کاذب (Pseudogout) است؛ در بیماری با فشار خون بالا که درمان‌های خوراکی مهار نشده است، مناسب‌ترین، امن‌ترین و مؤثرترین اقدام درمانی «تزریق داخل مفصلی کورتیکواستروئید (نظیر تریامسینولون)» است که التهاب موضعی را مهار کرده و از عوارض سیستمیک قلبی-کلیوی NSAIDها اجتناب می‌ورزد.",
            "نادرست است؛ دلیل رد: فیزیوتراپی در فاز حاد التهاب و افیوژن مفصل اثربخشی تسکینی فوری ندارد."
        ],
        "exp": "در آرتریت کریستالی حاد (کندروکلسینوز/نقرس کاذب) در بیمار با فشار خون بالا، تزریق داخل مفصلی استروئید درمان انتخابی است.",
        "micro": {
            "lead_fa": "کلسیفیکاسیون غضروف مفصل (کندروکلسینوز) در رادیوگرافی ساده نشانه رسوب کریستال‌های پیروفسفات کلسیم دی‌هیدرات (CPPD) است که می‌تواند حملات حاد آرتریت شبیه نقرس (نقرس کاذب / Pseudogout) در مفصل زانو ایجاد کند. در بیماران سالمند دارای پرفشاری خون شریانی، افزایش دوز داروهای NSAID خطرات بحران فشار خون، نارسایی کلیوی و سکته قلبی را تشدید می‌کند. تزریق کورتیکواستروئید به داخل مفصل بدون عوارض سیستمیک سریعاً التهاب را فرو می‌نشاند.",
            "lead_en": "Chondrocalcinosis on plain radiography indicates calcium pyrophosphate dihydrate (CPPD) crystal deposition, which commonly precipitates acute inflammatory monoarthritis (pseudogout) superimposed on osteoarthritis. In an elderly hypertensive patient failing oral analgesics, intra-articular corticosteroid injection provides safe, definitive local anti-inflammatory relief avoiding NSAID toxicity.",
            "golden_fa": "آرتریت حاد زانو با کندروکلسینوز در فرد با فشار خون بالا = تزریق داخل مفصلی کورتیکواستروئید.",
            "golden_en": "Acute pseudogout flare with chondrocalcinosis in a hypertensive patient = intra-articular corticosteroid injection.",
            "points_fa": [
                "کریستال‌های CPPD زیر میکروسکوپ پلاریزان متوازی‌الاضلاع با انکسار نوری مثبت ضعیف هستند.",
                "کلسیفیکاسیون غضروف هیالین و منیسک‌های فیبروکارتیلاژ زانو نشانه رادیوگرافیک مشخص کندروکلسینوز است.",
                "NSAIDها و مهارکننده‌های COX-2 فشار خون را بالا برده و در بیماری قلبی باید محدود شوند.",
                "تخلیه کامل مایع مفصلی قبل از تزریق استروئید فشار داخل مفصل را کم کرده و درد را تسکین می‌دهد."
            ],
            "points_en": [
                "CPPD crystals display rhomboid morphology with weak positive birefringence under compensated polarized light.",
                "Punctate and linear calcification of hyaline cartilage and fibrocartilaginous menisci establishes chondrocalcinosis.",
                "NSAIDs and COX-2 inhibitors induce sodium retention and blunt antihypertensive efficacy.",
                "Arthrocentesis decompressing synovial effusion prior to steroid instillation accelerates symptomatic relief."
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
    for idx, enrich in ENRICHMENTS_BATCH3.items():
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
