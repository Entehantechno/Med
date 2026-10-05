#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Create the read-only round63 rewrite-specification dossier.

The script consolidates the 27 already identified editorial-rewrite/ambiguity
records from rounds 60–62.  It deliberately writes only review artifacts.  In
particular, it never writes a canonical bank payload and never proposes a
replacement question, replacement option, or correct_index.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DOCS = ROOT / ".work" / "proj" / "docs"
BANK = ROOT / ".work" / "proj" / "tools" / "master-bank"
OUTPUT = DOCS / "round63-rewrite-specification.json"
BRIEF = HERE / "rewrite-specification-brief.md"
PARTS = (23, 24, 25, 27, 28, 29)
DATE = "2026-09-24"

# These categories name the primary blocking defect.  A record can have more
# than one issue, but exactly one primary category makes the next editorial
# action auditable and prioritizable.
CATEGORY_LABELS = {
    "protocol_safety_or_guideline_drift": "پروتکل ایمنی یا تغییر راهنما",
    "missing_or_corrupt_decision_data": "دادهٔ تصمیم‌ساز مفقود یا مخدوش",
    "nonunique_or_undefined_construct": "پاسخ چندگانه یا سازهٔ تعریف‌نشده",
}

# The 27 specifications below intentionally contain only a *contract* for a
# future authorized rewrite.  They contain no replacement text or option text.
SPECS: dict[tuple[int, int], dict[str, Any]] = {
    (23, 88): {
        "upstream": "round60",
        "category": "protocol_safety_or_guideline_drift", "priority": "high",
        "objective_fa": "تشخیص یا رد عفونت HIV در شیرخوارِ مواجهه‌یافته در حوالی تولد، بر پایهٔ روش تشخیصی جاری.",
        "why_rewrite_fa": "الایزا و وسترن‌بلات در شیرخوار کم‌سن به‌دلیل آنتی‌بادی مادری، چارچوب تشخیصی قطعی فعلی نیستند؛ صرف تغییر کلید، پروتکل منسوخ را اصلاح نمی‌کند.",
        "minimum_context_fa": ["سن دقیق کودک و نوع مواجهه", "وضعیت تغذیه با شیر مادر و آخرین مواجهه", "نوع و زمان پایان پیشگیری/درمان ضدویروسی", "روش مولکولی موردنظر و زمان‌بندی آزمون‌ها"],
        "option_rules_fa": ["همهٔ گزینه‌ها بر یک روش تشخیصی معاصر بنا شوند", "حداقل یک برنامهٔ زمانی قابل‌راستی‌آزمایی و فقط یک پاسخ کامل وجود داشته باشد", "روش‌های سرولوژیک منسوخ در زیر ۱۸ ماه به‌عنوان پاسخ قطعی عرضه نشوند"],
        "refs": ["nih_infant_hiv"],
    },
    (23, 102): {
        "upstream": "round61",
        "category": "nonunique_or_undefined_construct", "priority": "medium",
        "objective_fa": "یک نکتهٔ روشن دربارهٔ درمان یا وراثت سندرم ویسکوت–آلدریچ، نه چند گزارهٔ مطلق در یک سؤال.",
        "why_rewrite_fa": "دو گزینهٔ مربوط به «کمک‌نکردن» پیوند مغز استخوان هم‌زمان نادرست‌اند و نقش انتخابی اسپلنکتومی نیز مطلق نیست.",
        "minimum_context_fa": ["این‌که هدف سؤال درمان قطعی است یا درمان یک تظاهر", "شدت/مقاومت ترومبوسیتوپنی در صورت طرح اسپلنکتومی", "نوع گزاره: درست یا نادرست"],
        "option_rules_fa": ["هر گزینه فقط یک ادعای قابل‌بررسی داشته باشد", "درمان قطعی و درمان حمایتی از هم تفکیک شوند", "واژه‌های مطلق مانند «کمک نمی‌کند» فقط با پشتوانهٔ یکتا استفاده شوند"],
        "refs": ["was_genereviews"],
    },
    (23, 144): {
        "upstream": "round61",
        "category": "missing_or_corrupt_decision_data", "priority": "medium",
        "objective_fa": "تخمین سن تکاملی بر پایهٔ مجموعه‌ای هم‌سنخ از مهارت‌های مشخص.",
        "why_rewrite_fa": "مهارت‌ها با حوالی سه‌سالگی هم‌خوان‌اند اما همهٔ سن‌های چاپ‌شده نامعتبر، مخدوش یا ناسازگارند؛ کلید به‌تنهایی قابل نجات نیست.",
        "minimum_context_fa": ["مرجع تکاملی واحد", "زمینهٔ مهارت‌های حرکتی/خودمراقبتی/شناختی", "واحد سن و بازهٔ زمانی معتبر"],
        "option_rules_fa": ["سن‌ها واقع‌بینانه و غیرهم‌پوشان باشند", "تمام مهارت‌های صورت سؤال با یک سن هدف سازگار باشند", "اعداد و واحدها پیش از انتشار کنترل شوند"],
        "refs": ["developmental_milestones"],
    },
    (23, 176): {
        "upstream": "round61",
        "category": "nonunique_or_undefined_construct", "priority": "medium",
        "objective_fa": "تشخیص یک سناریوی خارج از آستانهٔ بررسی نقص ایمنی اولیه با معیار واحد.",
        "why_rewrite_fa": "هر چهار سناریو نشانهٔ هشدارِ قابل‌ارزیابی دارند؛ عبارت «به‌جز» پاسخ یکتا نمی‌سازد.",
        "minimum_context_fa": ["فهرست معیار/آستانهٔ واحد", "بازهٔ زمانی و شدت هر عفونت", "روشن‌بودن هدف: نیاز به ارزیابی یا تشخیص"],
        "option_rules_fa": ["فقط یک گزینه خارج از آستانهٔ تعریف‌شده بماند", "آستانه‌های مستقل در یک گزینه با هم مخلوط نشوند", "سناریوها با همان منبع معیار نوشته شوند"],
        "refs": ["pid_warning_signs"],
    },
    (24, 50): {
        "upstream": "round61",
        "category": "nonunique_or_undefined_construct", "priority": "medium",
        "objective_fa": "ارزیابی یک شاخص آزمایشگاهی مشخص در آسیب حاد کلیه با زمینهٔ گلومرولونفریت پس‌استرپتوکوکی.",
        "why_rewrite_fa": "سدیم ادرار پایین و اسمولالیتهٔ بالا هر دو می‌توانند با سناریو سازگار باشند، در حالی که گزینهٔ کلیدی الگوی دیگری را توصیف می‌کند؛ هدف فیزیولوژیک سؤال روشن نیست.",
        "minimum_context_fa": ["هدف آموزشیِ واحد: پیش‌کلیوی، گلومرولی یا نکروز توبولی", "وضعیت حجم و مرحلهٔ بیماری", "تعریف شاخص منتخب و واحدها"],
        "option_rules_fa": ["فقط یک شاخص آزمایشگاهیِ منطبق با هدف سؤال سنجیده شود", "کسر دفعی سدیم، سدیم ادرار و اسمولالیته در یک چارچوب سازگار باشند", "گزینهٔ درست و حواس‌پرت‌کن‌ها هم‌زمان درست نباشند"],
        "refs": ["psgn_aap"],
    },
    (24, 58): {
        "upstream": "round60",
        "category": "protocol_safety_or_guideline_drift", "priority": "high",
        "objective_fa": "شناخت منع واقعی واکسیناسیون در کودک، با تقویم و فرآوردهٔ واکسنی مشخص.",
        "why_rewrite_fa": "حساسیت به تخم‌مرغ به‌تنهایی منع واکسن آنفلوانزا نیست و حضور OPV در گزینه‌ها با برنامهٔ امروزی/محلی ممکن است پاسخ کاذب بسازد.",
        "minimum_context_fa": ["سن کودک", "برنامهٔ واکسیناسیون و کشور/سیاست هدف", "نوع فرآوردهٔ واکسن", "تعریف واکنش آلرژیک و منع مورد سؤال"],
        "option_rules_fa": ["فقط فرآورده‌های قابل‌استفاده در برنامهٔ هدف مطرح شوند", "یک منع واقعی و به‌روز هدف قرار گیرد", "تفاوت احتیاط، ارجاع و منع مطلق در گزینه‌ها روشن باشد"],
        "refs": ["cdc_egg_allergy"],
    },
    (24, 193): {
        "upstream": "round61",
        "category": "missing_or_corrupt_decision_data", "priority": "high",
        "objective_fa": "انتخاب دوز ویتامین A فقط برای یک سن و یک اندیکاسیون دقیق.",
        "why_rewrite_fa": "سن، واحد، راه تجویز، هدف درمانی/پیشگیری و دفعات دوز غایب‌اند و بازه‌های عددی گزینه‌ها هم‌پوشانی و جهت مبهم دارند.",
        "minimum_context_fa": ["سن دقیق و در صورت نیاز وزن", "اندیکاسیون درمانی مشخص", "واحد بین‌المللی، راه تجویز و تعداد/فاصلهٔ دوزها", "راهنمای مبنا"],
        "option_rules_fa": ["هر گزینه یک رژیم کامل و غیرهم‌پوشان داشته باشد", "اعداد به‌صورت استاندارد و بدون بازهٔ معکوس نوشته شوند", "پیشگیری و درمان در یک سؤال مخلوط نشوند"],
        "refs": ["vitamin_a_who"],
    },
    (24, 201): {
        "upstream": "round61",
        "category": "protocol_safety_or_guideline_drift", "priority": "high",
        "objective_fa": "اقدام واکسیناسیونی ایمن در نوزاد با سابقهٔ خانوادگی نگران‌کننده برای نقص ایمنی.",
        "why_rewrite_fa": "گزینه‌ها واکسن زنده و غیرزنده را جدا نمی‌کنند و هیچ‌یک اقدام ایمن همراه با ارجاع را کامل بیان نمی‌کند؛ تزریق روتین BCG در این سناریو قابل اتکا نیست.",
        "minimum_context_fa": ["شدت و نوع سابقهٔ خانوادگی", "وضعیت نقص ایمنیِ مشکوک یا تأییدشده", "سیاست BCG محلی", "دسترسی به ارجاع و غربالگری"],
        "option_rules_fa": ["واکسن‌های زنده و غیرزنده صریحاً تفکیک شوند", "یک اقدام فوریِ ایمن و مسیر ارجاع در پاسخ یکتا باشد", "منع نادرست واکسن غیرزنده ساخته نشود"],
        "refs": ["bcg_immunodeficiency"],
    },
    (24, 213): {
        "upstream": "round62",
        "category": "protocol_safety_or_guideline_drift", "priority": "high",
        "objective_fa": "انتخاب مرحلهٔ درست الگوریتم احیای نوزاد مکونیومی پس از تعیین وضعیت تنفسی و ضربان قلب.",
        "why_rewrite_fa": "صورت سؤال ضربان قلب و تون را نمی‌دهد و معلوم نیست پرسش گام نخست یا اقدام پس از گام‌های اولیه را می‌خواهد؛ تحریک و PPV در مراحل متفاوت می‌توانند مطرح شوند.",
        "minimum_context_fa": ["تون نوزاد", "HR و الگوی تنفس", "تصریح مرحلهٔ الگوریتم: ابتدا یا پس از گام‌های اولیه", "وجود یا عدم وجود انسداد راه هوایی"],
        "option_rules_fa": ["گزینه‌ها یک مرحلهٔ الگوریتمی مشترک را پاسخ دهند", "ساکشن روتین نای به‌عنوان پاسخ پیش‌فرض عرضه نشود", "فقط یک اقدام با داده‌های داده‌شده سازگار باشد"],
        "refs": ["nrp_aafp"],
    },
    (25, 27): {
        "upstream": "round61",
        "category": "nonunique_or_undefined_construct", "priority": "medium",
        "objective_fa": "زمان پاسخ درمانی کم‌خونی فقر آهن بر پایهٔ یک شاخص قابل‌اندازه‌گیری.",
        "why_rewrite_fa": "«بهبود دائم» تعریف نشده و چند شاخص با زمان‌های متفاوت در گزینه‌ها آمده‌اند؛ ترتیب زمانی و بازه‌ها نیز مخدوش‌اند.",
        "minimum_context_fa": ["شاخص هدف: رتیکولوسیت، هموگلوبین یا علامت بالینی", "دوز/پایبندی درمان در صورت نیاز", "واحد و بازهٔ زمانی دقیق"],
        "option_rules_fa": ["فقط یک شاخص در صورت سؤال هدف باشد", "زمان‌ها بدون وارونگی و با واحد یکسان نوشته شوند", "سه گزینهٔ دیگر از نظر زمانی قطعاً نادرست باشند"],
        "refs": ["iron_response"],
    },
    (25, 94): {
        "upstream": "round61",
        "category": "missing_or_corrupt_decision_data", "priority": "high",
        "objective_fa": "محاسبهٔ شفاف برنامهٔ مایع در هایپرناترمی کودک، نه حدس‌زدن حجم از دادهٔ ناقص.",
        "why_rewrite_fa": "درصد کم‌آبی/کسری آب، هدف سدیم، زمان اصلاح، اتلاف جاری و احتساب بولوس قبلی مشخص نشده‌اند؛ چهار حجم چاپی پاسخ یکتا ندارند.",
        "minimum_context_fa": ["درصد یا فرمول کسری آب", "وزن مبنا و مایع نگهدارنده", "هدف سدیم و مدت اصلاح", "اتلاف جاری و نقش بولوس اولیه"],
        "option_rules_fa": ["فرمول و فرض‌های محاسبه در صورت سؤال کامل باشند", "واحدهای حجم و زمان یک‌دست باشند", "فقط یک پاسخ با فرمول اعلام‌شده به دست آید"],
        "refs": ["hypernatraemia_rch"],
    },
    (25, 98): {
        "upstream": "round60",
        "category": "nonunique_or_undefined_construct", "priority": "medium",
        "objective_fa": "افتراق ویروسی/باکتریایی کونژونکتیویت با یک یافتهٔ بالینی مشخص و قابل اتکا.",
        "why_rewrite_fa": "کموز، فوتوفوبی و حس جسم خارجی می‌توانند در طیف ویروسی هم دیده شوند و عبارت «کمتر به نفع» معیار کافی برای پاسخ یکتا نمی‌سازد.",
        "minimum_context_fa": ["هدف افتراقی روشن", "شدت درد/افت بینایی یا درگیری قرنیه در صورت ارتباط", "یافتهٔ معاینه یا نوع ترشح مشخص"],
        "option_rules_fa": ["یک یافتهٔ تمایزدهندهٔ معتبر هدف باشد", "موارد هم‌پوشان به‌عنوان حواس‌پرت‌کن قطعی استفاده نشوند", "در صورت نیاز، هشدار ارجاع از تشخیص افتراقی جدا شود"],
        "refs": ["merck_conjunctivitis"],
    },
    (25, 126): {
        "upstream": "round61",
        "category": "missing_or_corrupt_decision_data", "priority": "medium",
        "objective_fa": "سنجش یک گزارهٔ رشد کودک با سن، واحد و مرجع رشد معلوم.",
        "why_rewrite_fa": "اعداد/بازه‌ها مخدوش‌اند و عبارت «حداقل» با مرجع رشد هم‌سنخ نیست؛ چند گزینه در حاشیهٔ بازهٔ طبیعی‌اند.",
        "minimum_context_fa": ["سن دقیق و واحد استاندارد", "یک نمودار یا مرجع رشد", "شاخص هدف: وزن‌گیری، کاهش وزن نوزادی یا قد"],
        "option_rules_fa": ["هر گزینه فقط یک گزارهٔ سنی داشته باشد", "بازه‌های زمانی/عددی قابل خواندن و غیرهم‌پوشان باشند", "از واژهٔ مبهم «حداقل» بدون مرجع پرهیز شود"],
        "refs": ["growth_merck"],
    },
    (25, 145): {
        "upstream": "round60",
        "category": "nonunique_or_undefined_construct", "priority": "medium",
        "objective_fa": "مقایسهٔ یک ویژگی دقیق ایمنی واکسن‌ها با تعریف زمان و نوع ایمنی.",
        "why_rewrite_fa": "«ایمنی بیشتر» نه نوع حفاظت را تعریف می‌کند و نه دوام یا نیاز به یادآور را؛ چند واکسنِ گزینه‌ها با معیارهای متفاوت قابل دفاع‌اند.",
        "minimum_context_fa": ["نوع ایمنی موردنظر", "بازهٔ پیگیری", "کامل‌بودن سری واکسیناسیون", "مبنای مقایسه مانند نیاز به یادآور"],
        "option_rules_fa": ["یک سازهٔ قابل‌راستی‌آزمایی تعریف شود", "اثر نوع واکسن و یادآور در گزینه‌ها در نظر گرفته شود", "پاسخ از یک زمان/معیار مشخص نتیجه بگیرد"],
        "refs": ["cdc_immunization_best_practices"],
    },
    (25, 173): {
        "upstream": "round61",
        "category": "missing_or_corrupt_decision_data", "priority": "medium",
        "objective_fa": "تمایز یک ژنوتیپ بیماری سلول داسی یا تشخیص کلی سندرم، نه هر دو هم‌زمان.",
        "why_rewrite_fa": "داکتیلیت و سابقهٔ تزریق برای تفکیک HbSS از HbS/بتا‌تالاسمی کافی نیستند و انتقال خون نیز می‌تواند تفسیر را تغییر دهد.",
        "minimum_context_fa": ["هدف تشخیصی: سندرم یا زیرگونه", "الگوی HPLC/الکتروفورز و زمان نسبت به انتقال خون", "یافتهٔ افتراقی معتبر در صورت هدف‌گرفتن زیرگونه"],
        "option_rules_fa": ["اگر زیرگونه هدف است دادهٔ اختصاصی اضافه شود", "اگر سندرم هدف است گزینه‌های زیرگونه حذف شوند", "سابقهٔ انتقال خون در تفسیر آزمون روشن باشد"],
        "refs": ["sickle_genereviews"],
    },
    (27, 133): {
        "upstream": "round62",
        "category": "protocol_safety_or_guideline_drift", "priority": "high",
        "objective_fa": "اولویت‌بندی ایمن اقدام فوری در سقط سپتیک همراه با ناپایداری همودینامیک.",
        "why_rewrite_fa": "در شوک سپتیک، احیا، آنتی‌بیوتیک وریدی و کنترل منبع هم‌زمان‌اند؛ هیچ گزینه‌ای پاسخ کامل «اولین اقدام» نیست و سونوگرافی نباید تأخیر بسازد.",
        "minimum_context_fa": ["پایداری همودینامیک و شواهد عفونت", "هدف سؤال: اولین اقدام یا بستهٔ اقدام فوری", "وضعیت نیاز به کنترل منبع"],
        "option_rules_fa": ["اقدام نجات‌بخش از آزمون تشخیصیِ تأخیرزا جدا شود", "پاسخ درست همهٔ اجزای فوری لازم را در بر گیرد", "گزینه‌ها درمان خوراکی یا تأخیر غیرایمن را واضحاً نادرست کنند"],
        "refs": ["septic_abortion_msd"],
    },
    (27, 146): {
        "upstream": "round62",
        "category": "protocol_safety_or_guideline_drift", "priority": "high",
        "objective_fa": "مشاورهٔ فردمحور PPROM پیش‌زیست/پری‌زیست با نمایش هر دو مسیر مراقبتی.",
        "why_rewrite_fa": "گزینهٔ مشاوره فقط برای ختم بارداری، مدیریت انتظاریِ قابل‌ارائه و تصمیم مشترک را حذف می‌کند؛ پاسخ تک‌گزینه‌ای کامل نیست.",
        "minimum_context_fa": ["سن دقیق بارداری و آستانهٔ احیای نوزاد در مرکز", "وضعیت عفونت/خونریزی/پایداری", "ارزش‌ها و انتخاب بیمار", "پیامدهای مادری و جنینی هر مسیر"],
        "option_rules_fa": ["هر دو مسیر ختم و انتظار در چارچوب مشاوره مطرح شوند", "گزینهٔ درست بی‌طرف و مبتنی بر تصمیم مشترک باشد", "داروهای وابسته به سن بارداری فقط با قید مناسب بیایند"],
        "refs": ["pprom_smfm"],
    },
    (27, 150): {
        "upstream": "round60",
        "category": "nonunique_or_undefined_construct", "priority": "medium",
        "objective_fa": "تصمیم غربالگری پوکی استخوان در گروه سنی و سطح خطر مشخص.",
        "why_rewrite_fa": "سیگار و مصرف زیاد الکل هر دو عامل خطرند و سن ۶۰ سال نیز بدون سن دقیق/ابزار خطر پاسخ یکتا نمی‌سازد.",
        "minimum_context_fa": ["سن دقیق و وضعیت یائسگی", "شدت مواجهه با سیگار/الکل", "آستانه یا ابزار برآورد خطر", "هدف: غربالگری یا ارزیابی تشخیصی"],
        "option_rules_fa": ["فقط یک عامل خطر یا یک آستانهٔ صریح هدف قرار گیرد", "گزینه‌ها چند عامل معتبر را در برابر هم قرار ندهند", "راهنمای مبنا و جمعیت هدف مشخص باشد"],
        "refs": ["uspstf_osteoporosis"],
    },
    (27, 151): {
        "upstream": "round62",
        "category": "protocol_safety_or_guideline_drift", "priority": "high",
        "objective_fa": "تعیین شرایط توقف غربالگری سرطان سرویکس پس از ۶۵ سالگی با همهٔ قیود لازم.",
        "why_rewrite_fa": "توقف به غربالگری کافیِ مستند و نبود سابقهٔ CIN2+ در بازهٔ مناسب وابسته است؛ گزینه‌های چاپی هیچ معیار کامل و یکتایی نمی‌دهند.",
        "minimum_context_fa": ["نوع و تعداد آزمون‌های قبلی و بازهٔ زمانی", "سابقهٔ CIN2+ و زمان درمان/پیگیری", "وضعیت خطر ویژه یا نقص ایمنی", "راهنمای هدف"],
        "option_rules_fa": ["یک گزینه تمام معیارهای توقف را یک‌جا داشته باشد", "گزینه‌های ناقص به‌گونه‌ای نوشته شوند که شروط کامل را نداشته باشند", "تعریف آزمون کافی با راهنمای انتخابی سازگار باشد"],
        "refs": ["cervical_uspstf"],
    },
    (27, 153): {
        "upstream": "round62",
        "category": "protocol_safety_or_guideline_drift", "priority": "high",
        "objective_fa": "تفکیک توصیهٔ سبک زندگی در PCOS از داروی القای تخمک‌گذاری در ناباروری بدون تخمک‌گذاری.",
        "why_rewrite_fa": "کاهش وزن و لتروزول پاسخ‌های قابل دفاع برای دو هدف متفاوت‌اند؛ صورت سؤال هدف درمان را روشن نمی‌کند.",
        "minimum_context_fa": ["هدف سؤال: توصیهٔ سبک زندگی یا درمان دارویی ناباروری", "تأیید ناباروری بدون تخمک‌گذاری", "BMI/ریسک‌ها و منع مصرف", "ارزیابی عوامل دیگر ناباروری در صورت هدف دارویی"],
        "option_rules_fa": ["هر سؤال فقط یک هدف درمانی داشته باشد", "اگر دارو هدف است، گزینه‌ها در یک خط درمان مقایسه شوند", "اگر سبک زندگی هدف است، القای دارویی با آن مخلوط نشود"],
        "refs": ["pcos_2023_asrm"],
    },
    (27, 169): {
        "upstream": "round60",
        "category": "protocol_safety_or_guideline_drift", "priority": "high",
        "objective_fa": "شناسایی یک هشدار عصبی/عروقی مشخص در مصرف‌کنندهٔ قرص ترکیبی و اقدام ایمن بعدی.",
        "why_rewrite_fa": "گزینهٔ چهارم به متن نامرتبط آلوده شده و بیش از یک علامت عصبی می‌تواند مسیر قطع و ارزیابی فوری را توجیه کند؛ پاسخ یکتا نیست.",
        "minimum_context_fa": ["نوع قرص هورمونی و زمان شروع علائم", "نشانهٔ هشدار هدف", "وجود یا نبود علائم کانونی/میگرن با اورا", "هدف سؤال: قطع فوری یا ارزیابی"],
        "option_rules_fa": ["متن آلودهٔ گزینه حذف/بازیابی شود", "فقط یک هشدار روشن در پاسخ صحیح هدف باشد", "علائم مبهم یا غیرمرتبط با هشدار واقعی قاطی نشوند"],
        "refs": ["contraception_cdc_mec"],
    },
    (27, 179): {
        "upstream": "round60",
        "category": "protocol_safety_or_guideline_drift", "priority": "high",
        "objective_fa": "پیگیری پس از مول هیداتی‌فرم بر مبنای نوع مول و زمان طبیعی‌شدن hCG.",
        "why_rewrite_fa": "نوع مول و راهنمای پیگیری مشخص نیستند؛ بازه‌های ۶ و ۱۲ ماه در منابع/سیاست‌های متفاوت دیده می‌شوند و pregnancy-after-normalization بدون این قیود یکتا نیست.",
        "minimum_context_fa": ["مول کامل یا ناقص", "زمان طبیعی‌شدن hCG نسبت به تخلیه", "راهنما/سیاست پیگیری هدف", "نقطهٔ شروع بازهٔ منع بارداری"],
        "option_rules_fa": ["یک سیاست پیگیری مشخص انتخاب شود", "گزینه‌ها با همان نوع مول و نقطهٔ شروع نوشته شوند", "بازه‌های تاریخی یا متناقض هم‌زمان عرضه نشوند"],
        "refs": ["figo_mole"],
    },
    (28, 25): {
        "upstream": "round60",
        "category": "missing_or_corrupt_decision_data", "priority": "medium",
        "objective_fa": "مدیریت تودهٔ آدنکس در بارداری با دادهٔ کافی برای تمایز پیگیری از جراحی.",
        "why_rewrite_fa": "اندازهٔ ۶ سانتی‌متر به‌تنهایی میان پیگیری و جراحی تصمیم‌ساز نیست؛ شکل سونوگرافی، علائم و احتمال بدخیمی حذف شده‌اند.",
        "minimum_context_fa": ["ویژگی کامل سونوگرافی", "وجود درد/پیچ‌خوردگی یا علامت", "نشانه‌های خطر بدخیمی", "سن بارداری و زمان پیگیری در صورت انتظار"],
        "option_rules_fa": ["یک سناریوی خوش‌خیمِ بی‌علامت یا یک سناریوی پرخطر تعریف شود", "روش جراحی فقط با اندیکاسیون روشن عرضه شود", "زمان پیگیری در گزینهٔ انتظار دقیق باشد"],
        "refs": ["pregnancy_adnexal"],
    },
    (28, 50): {
        "upstream": "round60",
        "category": "missing_or_corrupt_decision_data", "priority": "high",
        "objective_fa": "تشخیص یک اندیکاسیون مشخص برای سزارین اورژانس در TOLAC با زمینهٔ کافی.",
        "why_rewrite_fa": "هیچ الگوی ضربان قلب جنین یا مجموعهٔ علائم پارگی رحم داده نشده؛ تاکی‌کاردی مادر به‌تنهایی شاخص یکتای سزارین اورژانس نیست.",
        "minimum_context_fa": ["نوار/الگوی ضربان قلب جنین یا نشانهٔ واضح مادر", "درد، خونریزی، فشارخون و وضعیت همودینامیک", "نوع سابقهٔ سزارین و مرحلهٔ زایمان", "هدف سؤال: پارگی رحم یا دیسترس جنین"],
        "option_rules_fa": ["یک معیار اورژانسی معتبر به‌طور کامل توصیف شود", "نشانه‌های غیر اختصاصی بدون زمینه، پاسخ یکتا تلقی نشوند", "امکان سزارین فوری و اقدام هم‌زمان در صورت طرح‌شدن روشن باشد"],
        "refs": ["figo_vbac_2025"],
    },
    (28, 113): {
        "upstream": "round61",
        "category": "nonunique_or_undefined_construct", "priority": "medium",
        "objective_fa": "سنجش یک محور واحد دربارهٔ جفت سرراهی: عامل خطر یا تظاهر بالینی.",
        "why_rewrite_fa": "گزینهٔ عامل خطر و گزینهٔ تظاهر کلاسیک هر دو درست‌اند و گزینهٔ نخست هم دو عامل را در هم می‌آمیزد.",
        "minimum_context_fa": ["محور سؤال", "در صورت طرح نوع جفت سرراهی، تعریف آن", "سن بارداری و زمینهٔ تظاهر در صورت نیاز"],
        "option_rules_fa": ["هر گزینه فقط یک ادعا داشته باشد", "عامل خطر و تظاهر در یک سؤال مخلوط نشوند", "فقط یک گزینه با محور انتخاب‌شده صحیح باشد"],
        "refs": ["placenta_previa_merck"],
    },
    (28, 118): {
        "upstream": "round61",
        "category": "nonunique_or_undefined_construct", "priority": "high",
        "objective_fa": "تفکیک ارزیابی علت IUFD از انتخاب روش/زمان ختم بارداری در بیمار پایدار.",
        "why_rewrite_fa": "چند گزارهٔ ارزیابی و مدیریت در یک سؤال مخلوط شده‌اند، ادعای علت اکثریت پشتوانهٔ پایدار ندارد و اطلاعات لازم برای انتخاب روش ختم ناقص است.",
        "minimum_context_fa": ["هدف سؤال: علت‌یابی یا تدبیر زایمان", "پایداری مادر و اطلاعات سرویکس/ترجیح بیمار در صورت مدیریت", "اجزای ارزیابی علت و سطح ادعا"],
        "option_rules_fa": ["گزینه‌های تشخیصی و تدبیر زایمان در یک سازه آمیخته نشوند", "یک ادعای قابل‌استناد به‌عنوان پاسخ درست باقی بماند", "گزینه‌های وابسته به آمادگی سرویکس دادهٔ لازم داشته باشند"],
        "refs": ["stillbirth_acog"],
    },
    (29, 191): {
        "upstream": "round62",
        "category": "nonunique_or_undefined_construct", "priority": "medium",
        "objective_fa": "تشخیص یک عامل مستعدکنندهٔ بریچ با حذف عوامل هم‌زمان قابل دفاع.",
        "why_rewrite_fa": "در صورت سؤال هم جفت سرراهی و هم الیگوهیدرآمنیوس قابل ارتباط با بریچ‌اند؛ کلید فعلی و پیشنهاد تاریخی هر دو قابل دفاع‌اند.",
        "minimum_context_fa": ["هدف دقیق سؤال: عامل واحد یا چندعامل", "اطلاعاتی که یک عامل رقیب را حذف کند", "سن بارداری و نوع presentation در صورت نیاز"],
        "option_rules_fa": ["فقط یک عامل با داده‌های صورت سؤال سازگار بماند", "اگر هدف چندعامل است قالب پرسش چندپاسخی شود", "گزینه‌های صحیح متعدد در آزمون تک‌پاسخ کنار هم نیایند"],
        "refs": ["breech_review"],
    },
}

# New references were used only to sharpen formalization requirements.  All
# other references are imported from the upstream review dossiers below.
EXTRA_REFERENCES = {
    "cdc_immunization_best_practices": {
        "organization": "CDC",
        "title_fa": "راهنمای عمومی بهترین‌روش واکسیناسیون",
        "url": "https://www.cdc.gov/pinkbook/hcp/table-of-contents/chapter-2-general-best-practice-guidance.html",
        "use_fa": "برای تفاوت دوام ایمنی واکسن زنده و کاهش تیتر/نیاز به یادآور در برخی واکسن‌های غیرفعال یا توکسوئیدی.",
    },
    "figo_vbac_2025": {
        "organization": "FIGO",
        "title_fa": "توصیه‌های عملی زایمان واژینال پس از سزارین",
        "url": "https://obgyn.onlinelibrary.wiley.com/doi/10.1002/ijgo.70406",
        "use_fa": "برای شایع‌بودن ناهنجاری ضربان قلب جنین در پارگی رحم و نیاز به زمینهٔ کامل برای تفسیر علائم مادری در TOLAC.",
    },
}


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def dump(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_hash(value: Any) -> str:
    text = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def payload_path(part: int) -> Path:
    return BANK / f"import-payload.master-preint.part{part:02d}.json"


def load_bank() -> dict[tuple[int, int], dict[str, Any]]:
    rows: dict[tuple[int, int], dict[str, Any]] = {}
    for part in PARTS:
        payload = load(payload_path(part))
        for number, q in enumerate(payload["questions"], start=1):
            rows[(part, number)] = q
    return rows


def upstream_rows() -> dict[tuple[int, int], dict[str, Any]]:
    records: dict[tuple[int, int], dict[str, Any]] = {}
    r60 = load(DOCS / "round60-open-evidence.json")
    r61 = load(DOCS / "round61-remaining-review.json")
    r62 = load(DOCS / "round62-legacy-review.json")
    for row in r60["rows"]:
        if row.get("review_route") == "needs_editorial_rewrite":
            records[(row["part"], row["local_question"])] = {"upstream": "round60", "row": row}
    for row in r61["rows"]:
        if row.get("review_route") == "editorial_rewrite_required":
            records[(row["part"], row["local_question"])] = {"upstream": "round61", "row": row}
    for row in r62["rows"]:
        if row.get("classification") == "rewrite_or_ambiguity":
            records[(row["part"], row["local_question"])] = {"upstream": "round62", "row": row}
    expected_counts = Counter(record["upstream"] for record in records.values())
    if expected_counts != Counter({"round60": 9, "round61": 12, "round62": 6}):
        raise RuntimeError(f"unexpected upstream rewrite scope: {expected_counts}")
    return records


def upstream_references() -> dict[str, dict[str, str]]:
    registry: dict[str, dict[str, str]] = {}
    for path, key in (
        (DOCS / "round60-open-evidence.json", "references"),
        (DOCS / "round61-remaining-review.json", "references"),
        (DOCS / "round62-legacy-review.json", "reference_registry"),
    ):
        for ident, item in load(path)[key].items():
            normalized = {
                "organization": item.get("organization", "منبع حرفه‌ای"),
                "title_fa": item.get("title_fa", ident),
                "url": item["url"],
                "use_fa": item.get("use_fa", "منبع شواهد یا قید بالینی در dossier بالادستی."),
            }
            if ident in registry and registry[ident]["url"] != normalized["url"]:
                raise RuntimeError(f"conflicting reference registry entry: {ident}")
            registry[ident] = normalized
    registry.update(EXTRA_REFERENCES)
    return registry


def source_defect(row: dict[str, Any], upstream: str) -> str:
    if upstream == "round60":
        return row["original_open_reason_fa"]
    if upstream == "round61":
        return row["original_defect_fa"]
    return row["rationale_fa"]


def source_evidence(row: dict[str, Any], upstream: str) -> str:
    return row.get("evidence_fa") if upstream != "round62" else row["rationale_fa"]


def build() -> dict[str, Any]:
    before = {str(part): sha(payload_path(part)) for part in PARTS}
    bank = load_bank()
    upstream = upstream_rows()
    if set(SPECS) != set(upstream):
        raise RuntimeError(f"spec/source mismatch; missing={set(upstream)-set(SPECS)}, extra={set(SPECS)-set(upstream)}")
    refs = upstream_references()
    rows: list[dict[str, Any]] = []
    for key in sorted(SPECS):
        spec = SPECS[key]
        upstream_record = upstream[key]
        previous = upstream_record["row"]
        q = bank[key]
        if spec["upstream"] != upstream_record["upstream"]:
            raise RuntimeError(f"incorrect upstream assignment for {key}")
        if q["tags"][0] != previous["id"]:
            raise RuntimeError(f"canonical identifier mismatch for {key}")
        previous_index = previous.get("current_index", previous.get("legacy_current_index"))
        if q["correct_index"] != previous_index:
            raise RuntimeError(f"canonical key mismatch for {key}")
        if not all(ref in refs and refs[ref]["url"].startswith("https://") for ref in spec["refs"]):
            raise RuntimeError(f"unregistered reference for {key}")
        row = {
            "part": key[0],
            "local_question": key[1],
            "id": previous["id"],
            "upstream_review": spec["upstream"],
            "upstream_status": previous.get("status", previous.get("input_status")),
            "upstream_route": previous.get("review_route") or previous.get("classification"),
            "primary_blocker": spec["category"],
            "primary_blocker_fa": CATEGORY_LABELS[spec["category"]],
            "action_priority": spec["priority"],
            "action_priority_fa": "بالا" if spec["priority"] == "high" else "متوسط",
            "content_mutation_allowed": False,
            "key_mutation_allowed": False,
            "status": "specified_not_rewritten",
            "rewrite_text_proposed": False,
            "correct_index_recommendation": None,
            "rewrite_objective_fa": spec["objective_fa"],
            "why_rewrite_fa": spec["why_rewrite_fa"],
            "minimum_context_fa": spec["minimum_context_fa"],
            "option_design_rules_fa": spec["option_rules_fa"],
            "authorization_gate_fa": "هر ویرایش `question_fa` یا `options_fa` فقط با مجوز مستقل و صریح کاربر، پس از بازبینی بالینی دوم، مجاز است.",
            "reference_ids": spec["refs"],
            "upstream_defect_fa": source_defect(previous, spec["upstream"]),
            "upstream_evidence_fa": source_evidence(previous, spec["upstream"]),
            "question_snapshot": {
                "question_fa": q["question_fa"],
                "options_fa": q["options_fa"],
                "correct_index_before": q["correct_index"],
                "question_sha256": canonical_hash(q),
            },
        }
        rows.append(row)

    categories = Counter(row["primary_blocker"] for row in rows)
    priorities = Counter(row["action_priority"] for row in rows)
    expected_categories = {
        "protocol_safety_or_guideline_drift": 10,
        "missing_or_corrupt_decision_data": 7,
        "nonunique_or_undefined_construct": 10,
    }
    expected_priorities = {"high": 14, "medium": 13}
    if dict(categories) != expected_categories or dict(priorities) != expected_priorities:
        raise RuntimeError(f"unexpected formalization counts: {categories}, {priorities}")
    after = {str(part): sha(payload_path(part)) for part in PARTS}
    if before != after:
        raise RuntimeError("round63 curator must not mutate a canonical payload")
    used_ref_ids = sorted({ref for row in rows for ref in row["reference_ids"]})
    return {
        "schema_version": "round63-rewrite-specification/v1",
        "status": "reviewed_not_applied",
        "round": 63,
        "review_date": DATE,
        "language": "fa",
        "scope": {
            "round60_editorial_rewrite": 9,
            "round61_editorial_rewrite": 12,
            "round62_rewrite_or_ambiguity": 6,
            "total": 27,
        },
        "mode_fa": "مشخصات‌گذاری فقط‌خواندنی برای بازنویسی آینده؛ هیچ متن، گزینه، کلید یا غنی‌سازی payload تغییر نکرده است.",
        "exclusions_fa": [
            "۱۵ مورد منبع/آرتیفکت به‌علت فقدان دادهٔ اولیه در این بسته بازنویسی نشده‌اند.",
            "۵۵ کاندیدای تغییر کلید دور۶۲، ۶ کاندیدای دور۶۰ و یک کاندیدای دور۶۱ خارج از دامنهٔ بازنویسی‌اند.",
            "ردیف رفع تکرار گزینهٔ 25:136 خارج از این ۲۷ مورد و همچنان نیازمند مجوز مستقل ویرایش است.",
        ],
        "primary_blocker_counts": dict(sorted(categories.items())),
        "action_priority_counts": dict(sorted(priorities.items())),
        "priority_policy_fa": "اولویت بالا یعنی خطر پروتکل/ایمنی، راهنمای تغییرکرده یا محاسبهٔ حساس؛ اولویت متوسط یعنی نقص سازه یا داده که باز هم پیش از استفادهٔ آموزشی باید بازنویسی شود. اولویت پایین در این بسته وجود ندارد.",
        "publication_guardrails_fa": [
            "هیچ `correct_index` پیشنهاد یا اعمال نشده است.",
            "هیچ متن جایگزین برای `question_fa` یا `options_fa` در dossier ساخته نشده است.",
            "هر بازنویسی آینده به مجوز صریح کاربر و بازبینی مستقل دوم نیاز دارد.",
            "داده یا زمینهٔ غایب از حدس تکمیل نمی‌شود.",
        ],
        "protected_payload_sections": {
            "parts": list(PARTS),
            "before_sha256": before,
            "after_sha256": after,
            "unchanged": before == after,
        },
        "upstream_queue_status": {
            "actionable_total_unchanged": 105,
            "reason_fa": "این دور فقط قرارداد بازنویسی را روشن می‌کند؛ هیچ موردی از صف حل یا اعمال نشده است.",
        },
        "reference_registry": {key: refs[key] for key in used_ref_ids},
        "rows": rows,
    }


def write_brief(dossier: dict[str, Any], path: Path) -> None:
    rows = dossier["rows"]
    by_category = {category: [row for row in rows if row["primary_blocker"] == category] for category in CATEGORY_LABELS}
    lines = [
        "# دور ۶۳ — مشخصات بازنویسیِ فقط‌خواندنی برای موارد مبهم",
        "",
        "> **وضعیت:** این پرونده فقط قرارداد حداقلیِ بازنویسی را تعیین می‌کند. هیچ متن سؤال، گزینه، کلید یا غنی‌سازی بانک تغییر نکرده و حتی متن جایگزین پیشنهادی نیز تولید نشده است.",
        "",
        "## دامنه و نتیجه",
        "",
        "- ۹ مورد بازنویسی از دور۶۰، ۱۲ مورد از دور۶۱ و ۶ مورد از دور۶۲ = **۲۷ ردیف**.",
        "- اولویت اصلاح: **۱۴ بالا** و **۱۳ متوسط**؛ مورد کم‌اولویت در این بسته نیست.",
        "- هر ردیف در یکی از سه مانع اصلی دسته‌بندی شده و قرارداد حداقل داده/طراحی برای بازنویسی آینده دارد.",
        "- این اولویت‌بندی، اولویت اصلاح محتواست نه تریاژ یا دستور درمان بیمار.",
        "",
        "| مانع اصلی | شمار |",
        "|---|---:|",
        "| پروتکل ایمنی یا تغییر راهنما | ۱۰ |",
        "| دادهٔ تصمیم‌ساز مفقود یا مخدوش | ۷ |",
        "| پاسخ چندگانه یا سازهٔ تعریف‌نشده | ۱۰ |",
        "",
    ]
    for category, label in CATEGORY_LABELS.items():
        lines.extend([f"## {label} — {len(by_category[category])} ردیف", ""])
        for row in by_category[category]:
            refs = "؛ ".join(
                f"[{ident}] {dossier['reference_registry'][ident]['title_fa']} — {dossier['reference_registry'][ident]['url']}"
                for ident in row["reference_ids"]
            )
            lines.extend([
                f"### `{row['part']}:{row['local_question']}` — `{row['id']}`",
                "",
                f"- **منشأ:** {row['upstream_review']}؛ اولویت اصلاح: **{row['action_priority_fa']}**.",
                f"- **هدف بازنویسی آینده:** {row['rewrite_objective_fa']}",
                f"- **چرا کلید به‌تنهایی کافی نیست:** {row['why_rewrite_fa']}",
                "- **حداقل داده/بافت لازم:** " + "؛ ".join(row["minimum_context_fa"]),
                "- **قواعد طراحی گزینه‌ها:** " + "؛ ".join(row["option_design_rules_fa"]),
                f"- **دروازهٔ مجوز:** {row['authorization_gate_fa']}",
                f"- **استدلال بالادستی:** {row['upstream_evidence_fa']}",
                f"- **منابع:** {refs}",
                "",
            ])
    lines.extend([
        "## قفل‌های انتشار",
        "",
        "1. این dossier هیچ `correct_index`، `question_fa` یا `options_fa` را تغییر نمی‌دهد و متن جایگزین ارائه نمی‌کند.",
        "2. هر بازنویسی واقعی به مجوز مستقل کاربر، بازبینی بالینی دوم و آزمون یکتایی پاسخ نیاز دارد.",
        "3. ۱۵ مورد وابسته به منبع اولیه همچنان باید ابتدا آرتیفکت قابل‌انتساب دریافت کنند؛ این قرارداد جای منبع غایب را پر نمی‌کند.",
        "4. صف actionable بدون تغییر **۱۰۵** مورد می‌ماند، زیرا این دور هیچ مشکل را در payload حل نکرده است.",
        "",
        "## بازتولیدپذیری",
        "",
        "اجرای `python3 .work/round63-rewrite-specification/test_round63.py` باید پوشش ۲۷تایی، دسته‌بندی ۱۰/۷/۱۰، اولویت ۱۴/۱۳، نبود پیشنهاد متن/کلید و برابری هش payloadها را تأیید کند.",
    ])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="ساخت dossier مشخصات بازنویسی دور۶۳")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--brief", type=Path, default=BRIEF)
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    dossier = build()
    if args.check_only:
        print(json.dumps({
            "status": dossier["status"],
            "scope": dossier["scope"],
            "primary_blocker_counts": dossier["primary_blocker_counts"],
            "action_priority_counts": dossier["action_priority_counts"],
            "payload_unchanged": dossier["protected_payload_sections"]["unchanged"],
        }, ensure_ascii=False, indent=2))
        return 0
    dump(args.output, dossier)
    write_brief(dossier, args.brief)
    print(f"written: {args.output.relative_to(ROOT)}")
    print(f"written: {args.brief.relative_to(ROOT)}")
    print("canonical payloads changed: no")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
