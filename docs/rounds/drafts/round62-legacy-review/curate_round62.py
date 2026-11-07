#!/usr/bin/env python3
"""Build the round-62 legacy-queue review artifacts without editing bank payloads.

This curator is deliberately read-only with respect to the six canonical payload
sections.  It reads the two round-58 queues, checks every candidate against the
canonical bank, and writes only the round-62 dossier and Persian review brief.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / ".work"
DOCS = WORK / "proj" / "docs"
BANK = WORK / "proj" / "tools" / "master-bank"
KEY_QUEUE = DOCS / "round58-key-proposals.json"
OUTDATED_QUEUE = DOCS / "round58-outdated-rows.json"
DEFAULT_DOSSIER = DOCS / "round62-legacy-review.json"
DEFAULT_BRIEF = WORK / "round62-legacy-review" / "legacy-queue-review-brief.md"
PARTS = (23, 24, 25, 27, 28, 29)
TODAY = "2026-09-24"

# Every row in the active legacy queue has one—and only one—classification.
# The evidence summaries are educational review notes, not clinical directives.
ROW_SPECS: dict[tuple[int, int], dict[str, Any]] = {
    (23, 98): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "سؤال «کمترین نقش» را می‌پرسد. کریگلر–نجار هیپربیلی‌روبینمی غیرکنژوگه می‌دهد و با کلستاز، هپاتواسپلنومگالی و فشار پورت همخوانی ندارد؛ بنابراین میان گزینه‌ها کمترین نقش را دارد.",
        "caveat_fa": "جمع‌بندی فقط دربارهٔ پاسخ آزمونی میان گزینه‌های موجود است.",
        "refs": ["crigler_medlineplus"],
    },
    (27, 100): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "آنژیوادم عودکننده بدون شرح کهیر، همراه درد شکم و تحریک با تروما، الگوی کمبود مهارکنندهٔ C1 است؛ C4 آزمون غربالگری مناسب‌تری از IgE یا تست پوستی است.",
        "caveat_fa": "در عمل، C1-inhibitor نیز برای تأیید لازم است.",
        "refs": ["hae_wao_eaaci"],
    },
    (27, 121): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "فشارخون دیاستولیک ۱۱۵ میلی‌متر جیوه در محدودهٔ فشارخون شدید قرار می‌گیرد؛ سایر گزینه‌ها به‌تنهایی معیار شدیدبودن در این صورت سؤال نیستند.",
        "caveat_fa": "ارزیابی واقعی پره‌اکلامپسی باید همهٔ علائم شدید و وضعیت مادر/جنین را دربرگیرد.",
        "refs": ["preeclampsia_acog"],
    },
    (27, 126): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "از دست رفتن رفلکس عمقی پاتلا یافتهٔ زودرس سمیت منیزیم است و پیش از افسردگی تنفسی رخ می‌دهد.",
        "caveat_fa": "در مصرف بالینی، رفلکس، تنفس، برون‌ده ادرار و سطح منیزیم هم‌زمان پایش می‌شوند.",
        "refs": ["preeclampsia_acog"],
    },
    (27, 128): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "تب، درد پهلو و پیوری در بارداری با پیلونفریت سازگار است و نیاز به بستری، هیدراتاسیون و آنتی‌بیوتیک وریدی دارد؛ درمان خوراکی سرپایی پاسخ مناسب نیست.",
        "caveat_fa": "کشت ادرار و تعدیل آنتی‌بیوتیک بر پایهٔ حساسیت نیز لازم است.",
        "refs": ["uti_pregnancy_acog"],
    },
    (27, 129): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "سابقهٔ بارداری/فرزند با نقص لولهٔ عصبی، اندیکاسیون شناخته‌شدهٔ فولات با دوز بالاتر پیش از لقاح و اوایل بارداری است.",
        "caveat_fa": "دوز و زمان‌بندی باید طبق راهنمای محلی و وضعیت فرد تعیین شود.",
        "refs": ["folic_acid_cdc"],
    },
    (27, 130): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "در فرد غیر باردار با الیگومنوره و هیرسوتیسم خفیف، قرص ترکیبی خوراکی درمان دارویی خط اول برای نظم قاعدگی/هیرسوتیسم است؛ متفورمین یا ضدآندروژن جایگزین خط اولِ این صورت سؤال نیستند.",
        "caveat_fa": "منع مصرف استروژن، نیاز به پیشگیری و برنامهٔ بارداری باید جداگانه بررسی شود.",
        "refs": ["pcos_2023_asrm"],
    },
    (27, 132): {
        "category": "candidate_remaining", "confidence": "medium",
        "rationale_fa": "تأخیر قاعدگی، درد شانه، تاکی‌کاردی، رنگ‌پریدگی و تندرنس شکم، حاملگی خارج‌رحمیِ ناپایدار/احتمالاً پاره‌شده را مطرح می‌کند؛ کنترل منبع خونریزی با جراحی اورژانسی پاسخ آزمونی مناسب‌تر است.",
        "caveat_fa": "این گزینه جایگزین احیای هم‌زمان، دسترسی وریدی/خون و آماده‌سازی جراحی نیست؛ مدیریت واقعی هم‌زمان انجام می‌شود.",
        "refs": ["ectopic_aafp"],
    },
    (27, 133): {
        "category": "rewrite_or_ambiguity", "confidence": "high",
        "rationale_fa": "در شوک ناشی از سقط سپتیک، اقدام درست احیا با مایع، آنتی‌بیوتیک وسیع‌الطیف وریدی و کنترل سریع منبع است. گزینهٔ ۳ نزدیک‌تر است، اما سونوگرافی نباید درمان یا تخلیهٔ لازم را به تأخیر بیندازد و هیچ گزینه‌ای پاسخ کاملِ «اولین اقدام» نیست.",
        "caveat_fa": "تا بازنویسی، هیچ جابه‌جایی کلیدی توصیه نمی‌شود.",
        "refs": ["septic_abortion_msd"],
    },
    (27, 134): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "آمنوره همراه FSH بسیار بالا و استرادیول پایین، الگوی هیپوگنادیسم هیپرگنادوتروپیک/نارسایی زودرس تخمدان را نشان می‌دهد.",
        "caveat_fa": "علت‌یابی و مراقبت طولانی‌مدت نارسایی تخمدان بخش جداگانهٔ کار بالینی است.",
        "refs": ["poi_asrm"],
    },
    (27, 135): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "متیل‌ارگونوین در پره‌اکلامپسی/هیپرتانسیون به‌علت خطر افزایش فشارخون منع یا نامناسب است؛ گزینه‌های دیگر می‌توانند در مسیر درمان آتونی رحم به‌کار روند.",
        "caveat_fa": "انتخاب داروی uterotonic باید با وضعیت فشارخون، آسم و علل دیگر خونریزی هماهنگ شود.",
        "refs": ["pph_acog"],
    },
    (27, 137): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "ترشح چرکی، اتساع رحم پس از یائسگی و پاسخ‌ندادن به آنتی‌بیوتیک، پیومتر/انسداد دهانه و احتمال آسیب آندومتر را مطرح می‌کند؛ بررسی بافت‌شناسی آندومتر قدم تشخیصی مناسب‌تری از درمان تجربی است.",
        "caveat_fa": "ارزیابی واقعی باید هم‌زمان تخلیهٔ امن ورد بدخیمی را در نظر بگیرد.",
        "refs": ["endometrial_eval_aafp"],
    },
    (27, 138): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "کلمپ تأخیری بند ناف در نوزاد ترم می‌تواند نیاز به درمان زردی/هیپربیلی‌روبینمی را اندکی افزایش دهد؛ گزینه‌های دیگر عارضهٔ شاخص آن نیستند.",
        "caveat_fa": "فایده‌های هماتولوژیک کلمپ تأخیری نیز باید در آموزش ذکر شوند.",
        "refs": ["delayed_cord_acog"],
    },
    (27, 141): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "پس از رد بارداری، پرولاکتین و TSH در ارزیابی اولیهٔ آمنوره ثانویه کاربرد دارند؛ LH به‌تنهایی آزمون ضروری اولیه در این قالب نیست.",
        "caveat_fa": "آزمایش‌ها با شرح حال و معاینه و احتمال اختلال تخمدانی/هیپوفیزی هدفمند می‌شوند.",
        "refs": ["amenorrhea_asrm"],
    },
    (27, 142): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "واکسیناسیون HPV در شیردهی مجاز است؛ مواجههٔ قبلی یا انجام تست HPV پیش‌نیاز واکسیناسیون نیست. واکسن در بارداری شروع نمی‌شود.",
        "caveat_fa": "اگر بارداری پس از شروع سری تشخیص داده شود، دوزهای باقی‌مانده پس از بارداری داده می‌شوند.",
        "refs": ["hpv_cdc"],
    },
    (27, 143): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "بلوغ زودرس و تودهٔ یک‌طرفهٔ تخمدان با جزء جامد، تومور ترشح‌کنندهٔ هورمون مانند تومور سلول گرانولوزای نوجوانان را مطرح می‌کند؛ جراحی یک‌طرفه با حفظ باروری پاسخ مناسب‌تر از بیوپسی ساده است.",
        "caveat_fa": "نوع و گسترهٔ جراحی باید با مرحله‌بندی و نظر انکولوژی کودکان/زنان تعیین شود.",
        "refs": ["nci_childhood_ovarian"],
    },
    (27, 145): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "در خونریزی آتونی پس از زایمان همراه پره‌اکلامپسی شدید، متیل‌ارگونوین به‌علت اثر پرفشاری مناسب نیست.",
        "caveat_fa": "در خونریزی پس از زایمان، ماساژ رحم و رسیدگی مرحله‌ای به چهار T نیز ضروری است.",
        "refs": ["pph_acog"],
    },
    (27, 146): {
        "category": "rewrite_or_ambiguity", "confidence": "high",
        "rationale_fa": "در PPROM در ۲۱ هفتگی، مشاورهٔ فردمحور باید هر دو مسیر مراقبتِ ختم بارداری و مدیریت انتظاری را همراه با خطرهای مادری/جنینی عرضه کند. گزینهٔ «مشاوره فقط برای ختم» پاسخ تک‌گزینه‌ای کامل نیست.",
        "caveat_fa": "تا افزودن گزینهٔ مشاورهٔ بی‌طرفانهٔ دو مسیر، کلید تغییر نکند.",
        "refs": ["pprom_smfm"],
    },
    (27, 148): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "غربالگری زودرسِ منفی در فرد پرخطر، غربالگری استاندارد دیابت بارداری در ۲۴ تا ۲۸ هفتگی را حذف نمی‌کند.",
        "caveat_fa": "مسیر تشخیصی پس از GCT غیرطبیعی به آستانه و پروتکل مرکز وابسته است.",
        "refs": ["gdm_acog_summary"],
    },
    (27, 151): {
        "category": "rewrite_or_ambiguity", "confidence": "high",
        "rationale_fa": "توقف غربالگری سرویکس پس از ۶۵ سالگی به غربالگری قبلی کافی و مستند و نبود سابقهٔ CIN2+ در بازهٔ پیگیری مناسب وابسته است. گزینهٔ «دو سیتولوژی منفی در ۱۰ سال» به‌تنهایی این معیار را کامل و یکتا نمی‌سازد.",
        "caveat_fa": "تا درج شرایط کامل، هیچ گزینه‌ای نباید به‌عنوان کلید جدید تثبیت شود.",
        "refs": ["cervical_uspstf"],
    },
    (27, 153): {
        "category": "rewrite_or_ambiguity", "confidence": "high",
        "rationale_fa": "پرسش میان توصیهٔ سبک زندگی برای همهٔ مبتلایان PCOS و القای دارویی تخمک‌گذاری در ناباروری بدون تخمک‌گذاری تمایز نگذاشته است؛ لتروزول درمان دارویی خط اول است، اما کاهش وزن نیز توصیهٔ مهم اولیه است.",
        "caveat_fa": "باید هدف سؤال (توصیهٔ سبک زندگی یا داروی القای تخمک‌گذاری) صریح شود.",
        "refs": ["pcos_2023_asrm"],
    },
    (27, 154): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "در سقط سپتیک، به‌تعویق‌انداختن تخلیهٔ لازم تا ۲۴ ساعت پس از افت تب اندیکاسیون ندارد؛ آنتی‌بیوتیک وریدی، مایع‌درمانی و ارزیابی آسیب/عوارض اجزای درمان‌اند.",
        "caveat_fa": "تخلیه پس از شروع احیا و آنتی‌بیوتیک و با پایداری بیمار انجام می‌شود، نه با تأخیر ثابت زمانی.",
        "refs": ["septic_abortion_msd"],
    },
    (27, 156): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "ضعف پروگزیمال متقارن همراه راش هلیوتروپ و پاپول‌های گوترون با درماتومیوزیت سازگار است و کورتیکواستروئید سیستمیک درمان خط اول معمول محسوب می‌شود.",
        "caveat_fa": "غربالگری بدخیمی و ارزیابی درگیری ریه/بلع در بزرگسالان ضروری است.",
        "refs": ["dermatomyositis_merck"],
    },
    (27, 160): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "فلج نزولی متقارن پس از مصرف غذای کنسروی با بوتولیسم سازگار است؛ آنتی‌توکسین نباید در انتظار تأیید آزمایشگاهی به تأخیر افتد و باید برای نارسایی تنفسی آماده بود.",
        "caveat_fa": "تأمین راه هوایی و تماس فوری با مقام‌های بهداشت عمومی بخش مدیریت واقعی است.",
        "refs": ["botulism_cdc"],
    },
    (27, 161): {
        "category": "candidate_remaining", "confidence": "medium",
        "rationale_fa": "برای زخم آلوده در فردی با سری اولیهٔ کامل و آخرین واکسن کزاز بیش از ۵ سال پیش، دوز یادآور حاوی توکسوئید لازم است؛ ایمونوگلوبولین برای این سابقهٔ واکسیناسیون کامل لازم نیست.",
        "caveat_fa": "پاک‌سازی مناسب زخم همواره بخشی از پیشگیری است؛ نام گزینهٔ «توکسوئید و واکسن» نیازمند تفسیر آموزشی است.",
        "refs": ["tetanus_cdc"],
    },
    (27, 162): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "دیسکیت/آبسهٔ اپیدورال همراه رشد MRSA در کشت خون، درمان ضد MRSA مانند وانکومایسین را می‌طلبد؛ سایر گزینه‌ها پوشش قابل‌اعتماد MRSA ندارند.",
        "caveat_fa": "نقص عصبی یا آبسهٔ فشاری به مشاورهٔ فوری جراحی ستون فقرات نیاز دارد.",
        "refs": ["mrsa_idsa"],
    },
    (27, 163): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "آبسهٔ ریوی با کاویتاسیون و سطح مایع–هوا در لوب تحتانی راست، همراه بهداشت ضعیف دهان و مصرف الکل، معمولاً از آسپیراسیون ترشحات اوروفارنکس ایجاد می‌شود.",
        "caveat_fa": "انسداد برونش و علت‌های دیگر در بعضی بیماران باید بررسی شوند.",
        "refs": ["lung_abscess_merck"],
    },
    (27, 164): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "وجود transition point به سود انسداد مکانیکی است، نه ایلئوس منتشر؛ اتساع منتشر، کاهش پریستالتیسم و هوا در رکتوم با ایلئوس سازگارترند.",
        "caveat_fa": "تصویربرداری و وضعیت بالینی برای رد ایسکمی/انسداد کامل مهم‌اند.",
        "refs": ["intestinal_obstruction_merck"],
    },
    (27, 167): {
        "category": "candidate_remaining", "confidence": "medium",
        "rationale_fa": "برای تشخیص بسیار زودرس سکتهٔ ایسکمیک، MRI با diffusion-weighted imaging حساسیت بالایی دارد؛ در تریاژ اورژانس، CT بدون کنتراست اغلب برای رد خونریزی سریع‌تر انجام می‌شود.",
        "caveat_fa": "صورت سؤال «حساس‌ترین برای تشخیص» است، نه «اولین تصویربرداری در همهٔ اورژانس‌ها».",
        "refs": ["acute_stroke_aafp"],
    },
    (27, 170): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "خونریزی فعال در ۳۷ هفتگی با placenta previa شناخته‌شده، اندیکاسیون سزارین است؛ معاینهٔ واژینال دیجیتال نباید انجام شود.",
        "caveat_fa": "احیا و آماده‌سازی خون باید هم‌زمان با تصمیم زایمان انجام شود.",
        "refs": ["placenta_previa_merck"],
    },
    (27, 171): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "حل زنجیرهٔ مقایسه‌ای «بلندتر/کوتاه‌تر» توانایی تفکر/استدلال را می‌سنجد، نه جهت‌یابی، حافظه یا خلق.",
        "caveat_fa": "این یک طبقه‌بندی آموزشیِ معاینهٔ وضعیت روانی است.",
        "refs": ["mental_status_merck"],
    },
    (27, 172): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "پارکینسونیسم همراه سقوط زودرس و محدودیت نگاه ارادی عمودی، الگوی کلاسیک فلج فوق‌هسته‌ای پیشرونده است.",
        "caveat_fa": "تشخیص قطعی بالینی و افتراقی با اختلال‌های حرکتی دیگر انجام می‌شود.",
        "refs": ["psp_ninds"],
    },
    (27, 173): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "سردرد و تشنج پس از زایمان همراه empty-delta sign، ترومبوز وریدی مغزی را مطرح می‌کند؛ ضدانعقاد با هپارین درمان استاندارد اولیه است.",
        "caveat_fa": "تصمیم درمانی باید با تصویربرداری و ارزیابی خونریزی/فشار داخل جمجمه هماهنگ شود.",
        "refs": ["cvt_aha"],
    },
    (27, 174): {
        "category": "source_or_context_required", "confidence": "high",
        "rationale_fa": "ابتدای stem در payload ناقص است و فقط از «میکروگرم روزانه» آغاز می‌شود؛ با وجود TSH طبیعی و T4 بالا پس از آمیودارون، تعیین پاسخ بدون دوز/تشخیص/بافت کامل با اطمینان کافی ممکن نیست.",
        "caveat_fa": "منبع کامل یا بازسازی مورد تأیید stem پیش از هر تصمیم دربارهٔ کلید لازم است.",
        "refs": ["amiodarone_ata"],
    },
    (27, 175): {
        "category": "candidate_remaining", "confidence": "high", "reject_proposal": True,
        "rationale_fa": "ترشح چرکی، pH=۶، آمین منفی و حضور WBC/سلول‌های پارابازال با واژینیت التهابی دِسکواماتیو سازگار است؛ کلیندامایسین واژینال درمان پذیرفته‌شده است. بنابراین پیشنهاد تاریخی برای انتقال کلید به استروژن پذیرفته نمی‌شود.",
        "caveat_fa": "استروژن موضعی در آتروفی واژینال می‌تواند کاربرد داشته باشد، اما یافته‌های این stem الگوی DIV را تقویت می‌کنند.",
        "refs": ["div_merck"],
    },
    (27, 176): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "در خونریزی پس از زایمان همراه پره‌اکلامپسی، متیل‌ارگونوین توصیه نمی‌شود؛ سایر uterotonicهای فهرست‌شده با توجه به وضعیت بیمار قابل‌بررسی‌اند.",
        "caveat_fa": "درمان خونریزی فقط انتخاب یک دارو نیست و باید علت‌یابی مرحله‌ای شود.",
        "refs": ["pph_acog"],
    },
    (27, 178): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "تب، خونریزی، حساسیت شکمی/گردن رحم و ترشح بدبو در بارداری با عفونت شدید داخل رحم سازگار است؛ آنتی‌بیوتیک وریدی همراه تخلیهٔ سریع محصولات بارداری پاسخ مناسب است.",
        "caveat_fa": "احیا، کشت‌ها و پوشش ضد میکروبی نباید به تأخیر افتند.",
        "refs": ["septic_abortion_msd"],
    },
    (27, 180): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "Podophyllin در بارداری نباید برای زگیل تناسلی استفاده شود؛ کرایوتراپی، TCA و لیزر از گزینه‌های قابل‌بررسی‌اند.",
        "caveat_fa": "درمان زگیل در بارداری باید با محل/اندازهٔ ضایعه و وضعیت دهانهٔ رحم فردی‌سازی شود.",
        "refs": ["genital_warts_cdc"],
    },
    (27, 183): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "در منومتروراژی با ضخیم‌شدگی فوکال آندومتر، هیستروسکوپی همراه نمونه‌برداری هدفمند نسبت به نمونه‌برداری کور برای ضایعهٔ کانونی مناسب‌تر است.",
        "caveat_fa": "پایداری بیمار و خطر بدخیمی مسیر ارزیابی را تعیین می‌کند.",
        "refs": ["endometrial_eval_aafp"],
    },
    (27, 184): {
        "category": "candidate_remaining", "confidence": "medium",
        "rationale_fa": "در فرد مبتلا به پرفشاری خون و خونریزی قاعدگی نسبتاً زیاد، IUD لوونورژسترلی معمولاً گزینهٔ مناسب‌تری برای پیشگیری و کاهش خونریزی از IUD مسی یا قرص ترکیبی است.",
        "caveat_fa": "شدت و کنترل فشارخون و معیارهای واجدشرایط‌بودن باید پیش از انتخاب قطعی بررسی شوند.",
        "refs": ["contraception_cdc_mec"],
    },
    (27, 186): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "تب و تاکی‌کاردی در PPROM سه‌روزه در ۳۰ هفتگی، عفونت داخل‌آمنیونی را مطرح می‌کند؛ پس از شروع آنتی‌بیوتیک، با پرزانتاسیون سفالیک نباید زایمان برای کورتون یا ۳۴ هفتگی به تأخیر افتد و القا مناسب است.",
        "caveat_fa": "زایمان باید با وضعیت مادر، جنین و اندیکاسیون‌های مامایی هماهنگ شود.",
        "refs": ["intraamniotic_acog"],
    },
    (27, 203): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "کاهش لاکتوباسیل، pH بالاتر از ۴٫۵، استرپتوکوک و فقدان تریکوموناس با DIV/واژینیت التهابی سازگار است؛ کرم کلیندامایسین درمان اولیهٔ مناسب است.",
        "caveat_fa": "تشخیص‌های عفونی و درماتولوژیک دیگر باید بر اساس معاینه/آزمایش رد شوند.",
        "refs": ["div_merck"],
    },
    (27, 204): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "وزیکول‌های دردناک ولو با گسترش پری‌آنال مشخصهٔ هرپس تناسلی است و آسیکلوویر درمان مناسب‌تری از آنتی‌بیوتیک‌هاست.",
        "caveat_fa": "آزمون تأییدی و مشاورهٔ انتقال/بارداری در مدیریت واقعی مهم‌اند.",
        "refs": ["herpes_cdc"],
    },
    (28, 23): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "خونریزی پس از یائسگی همراه ضخامت آندومتر ۸ میلی‌متر نیازمند نمونه‌برداری آندومتر برای رد هایپرپلازی/بدخیمی است.",
        "caveat_fa": "اگر نمونه ناکافی باشد یا خونریزی ادامه یابد، ارزیابی تکمیلی لازم است.",
        "refs": ["postmenopausal_bleeding_acog"],
    },
    (28, 27): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "GCT پنجاه‌گرمی غیرطبیعی در ۲۶ هفتگی، با تست تشخیصی تحمل گلوکز خوراکی ۱۰۰ گرمی/سه‌ساعته پیگیری می‌شود.",
        "caveat_fa": "آستانه‌ها و روش یک‌مرحله‌ای/دو‌مرحله‌ای به پروتکل محلی وابسته‌اند.",
        "refs": ["gdm_acog_summary"],
    },
    (28, 28): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "تشخیص PMS بر ثبت آینده‌نگر علائم در چرخه‌های متوالی تکیه دارد؛ یادآوری گذشته‌نگر اعتبار کافی ندارد.",
        "caveat_fa": "برای PMDD، اثر عملکردی و رد اختلال‌های هم‌زمان نیز سنجیده می‌شود.",
        "refs": ["pms_acog"],
    },
    (28, 30): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "در بیمار پایدار با تاکی‌کاردی منظمِ کمپلکس باریک، آدنوزین درمان اولیهٔ مناسب‌تر است؛ ریتم نامنظم یا کمپلکس پهن مسیر دیگری دارد.",
        "caveat_fa": "ارزیابی پایداری همودینامیک و مانور واگ در الگوریتم واقعی مقدم است.",
        "refs": ["svt_esc"],
    },
    (28, 32): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "میوم داخل‌جداریِ کوچک، بدون علامت و پایدار در زن یائسه معمولاً نیازمند مداخلهٔ خاص یا تصویربرداری سه‌ماهه نیست.",
        "caveat_fa": "رشد پس از یائسگی یا ایجاد علامت، ارزیابی مجدد را لازم می‌کند.",
        "refs": ["leiomyoma_acog"],
    },
    (28, 189): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "در pregnancy of unknown location پایدار، با β-hCG زیر discriminatory zone و نبود ساک داخل رحم، β-hCG سریالی معمولاً اقدام بعدی است؛ متوترکسات یا جراحی فوری بدون شواهد کافی نیست.",
        "caveat_fa": "علائم پارگی یا ناپایداری مسیر اورژانسی جداگانه‌ای دارد.",
        "refs": ["ectopic_aafp"],
    },
    (28, 218): {
        "category": "candidate_remaining", "confidence": "medium",
        "rationale_fa": "PPROM در بارداری سه‌قلویی ۲۴ هفته‌ای، در نبود عفونت/خونریزی/دیسترس، با بستری و کورتیکواستروئید (و ارزیابی فردی انتظار) بهتر از ختم فوری صرف پاسخ می‌یابد.",
        "caveat_fa": "چندقلویی و سن بارداری نیازمند تصمیم‌گیری تخصصی فردمحور است؛ این فقط بهترین گزینهٔ موجود است.",
        "refs": ["pprom_acog"],
    },
    (29, 59): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "خونریزی شدید با placenta previa در ۳۶ هفتگی، اندیکاسیون سزارین اورژانسی پس از شروع اقدامات حمایتی است.",
        "caveat_fa": "در ناپایداری، احیا و آماده‌سازی فرآورده‌های خونی هم‌زمان است.",
        "refs": ["placenta_previa_merck"],
    },
    (29, 103): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "ترشح کف‌آلود واژینال با تریکومونیازیس سازگار است و مترونیدازول خوراکی درمان مناسب‌تری از درمان‌های کاندیدا یا گنوره است.",
        "caveat_fa": "درمان شریک جنسی و آزمایش سایر STIها بخش مهم مدیریت است.",
        "refs": ["sti_cdc"],
    },
    (29, 110): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "واکسنی برای پیشگیری روتین CMV در بارداری در دسترس نیست؛ بهداشت دست و کاهش تماس با بزاق/ادرار کودکان مهم‌ترین راه پیشگیری است.",
        "caveat_fa": "مشاوره باید راهکارهای عملی بهداشت را توضیح دهد.",
        "refs": ["cmv_cdc"],
    },
    (29, 132): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "خونریزی، حساسیت رحم و وجود دیسترس جنین با جداشدگی جفت و اختلال جنینی سازگار است؛ در این وضعیت ختم بارداری پس از اقدامات حمایتی پاسخ مناسب است.",
        "caveat_fa": "راه زایمان به پایداری مادر، وضعیت جنین و امکان زایمان واژینال وابسته است.",
        "refs": ["abruption_merck"],
    },
    (29, 166): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "ترشح سفید چسبنده همراه خارش، التهاب و اریتم ولو در بارداری با کاندیدیازیس ولوواژینال سازگار است؛ آزول موضعی مانند کلوتریمازول مناسب است.",
        "caveat_fa": "در بارداری از فلوکونازول خوراکی روتین پرهیز می‌شود.",
        "refs": ["candidiasis_cdc"],
    },
    (29, 183): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "با حجم ۳ میلی‌لیتر، تحرک ۵۵٪ و مورفولوژی ۴۰٪، مورد غیرطبیعی در گزینه‌ها غلظت ۱۰ میلیون در میلی‌لیتر است که زیر حد مرجع پایین WHO قرار می‌گیرد.",
        "caveat_fa": "یک اسپرموگرام به‌تنهایی ناباروری را تشخیص نمی‌دهد و تکرار استاندارد لازم است.",
        "refs": ["who_semen_2021"],
    },
    (29, 191): {
        "category": "rewrite_or_ambiguity", "confidence": "high",
        "rationale_fa": "در stem، هم placenta previa و هم الیگوهیدرآمنیوس می‌توانند با بریچ ارتباط داشته باشند؛ بنابراین گزینهٔ فعلی و پیشنهادی هر دو قابل دفاع‌اند و پاسخ یکتا نیست.",
        "caveat_fa": "برای کلید تک‌گزینه‌ای، باید یکی از عوامل یا پرسش به‌طور روشن محدود شود.",
        "refs": ["breech_review"],
    },
    (29, 218): {
        "category": "source_or_context_required", "confidence": "high",
        "rationale_fa": "پس از متوترکسات، پاسخ استاندارد با افت حداقل ۱۵٪ β-hCG از روز ۴ تا روز ۷ سنجیده می‌شود؛ stem فقط مقدار روز صفر و روز ششم را دارد و مقدار روز ۴ حذف شده است.",
        "caveat_fa": "ثبت مقدار روز ۴ یا بازنویسی سناریو پیش از انتخاب تکرار متوترکسات/جراحی لازم است.",
        "refs": ["ectopic_aafp"],
    },
    (24, 102): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "نوزاد مکونیومی، هیپوتون و با HR=۵۰ پس از گام‌های اولیه باید با تهویهٔ فشار مثبت مدیریت شود؛ لوله‌گذاری و ساکشن روتین توصیه نمی‌شود.",
        "caveat_fa": "گام‌های اولیهٔ احیا و ارزیابی HR نباید حذف شوند.",
        "refs": ["nrp_aafp"],
    },
    (24, 113): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "با HR=۵۰ و تنفس ناکافی، تهویهٔ فشار مثبت پاسخ درست است؛ مکونیوم به‌تنهایی اندیکاسیون ساکشن داخل‌تراشه‌ای روتین نیست.",
        "caveat_fa": "فشردن قفسهٔ سینه پس از تهویهٔ مؤثر و تداوم HR کمتر از ۶۰ مطرح می‌شود.",
        "refs": ["nrp_aafp"],
    },
    (24, 123): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "در نوزاد غیرسرحال مکونیومی با HR=۵۰، تهویهٔ بگ و ماسک پس از گام‌های اولیه ارجح است و ساکشن نای روتین نیست.",
        "caveat_fa": "اگر تهویه مؤثر نباشد، اصلاح راه هوایی و سپس مراحل بعدی دنبال می‌شود.",
        "refs": ["nrp_aafp"],
    },
    (24, 147): {
        "category": "candidate_remaining", "confidence": "medium",
        "rationale_fa": "نوزاد کاملاً هیپوتون و بدون تنفس مؤثر، پس از گام‌های اولیه، تهویهٔ فشار مثبت نیاز دارد؛ مکونیوم رقیق دلیل ساکشن تراشه‌ای روتین نیست.",
        "caveat_fa": "نبود HR در stem اعتماد را متوسط می‌کند، اما گزینهٔ تهویه بهترین پاسخ موجود است.",
        "refs": ["nrp_aafp"],
    },
    (24, 213): {
        "category": "rewrite_or_ambiguity", "confidence": "high",
        "rationale_fa": "عبارت «بدون تنفس خودبه‌خودی» HR و تون را مشخص نکرده و بین گام اولیهٔ تحریک و شروع PPV تمایز نمی‌گذارد. NRP ابتدا گام‌های اولیه و سپس برای apnea/gasping یا HR<100، PPV را توصیه می‌کند؛ پس پاسخ یکتا نیست.",
        "caveat_fa": "برای حل، HR/تون و اینکه سؤال «پس از گام‌های اولیه» است یا نه باید افزوده شود.",
        "refs": ["nrp_aafp"],
    },
    (25, 149): {
        "category": "candidate_remaining", "confidence": "high",
        "rationale_fa": "نوزاد سیانوتیکِ بدون تنفس با HR=۴۰ پس از گام‌های اولیه، نیازمند شروع تهویه با فشار مثبت است؛ پاک‌سازی روتین راه هوایی جایگزین PPV نیست.",
        "caveat_fa": "در صورت HR پایدار زیر ۶۰ پس از تهویهٔ مؤثر، فشار قفسه سینه وارد الگوریتم می‌شود.",
        "refs": ["nrp_aafp"],
    },
}

# Only sources used by the row notes are registered here.  Each is a direct
# professional, public-health, or full-text source suitable for audit.
REFERENCES: dict[str, dict[str, str]] = {
    "crigler_medlineplus": {"organization": "MedlinePlus Genetics", "title_fa": "سندرم کریگلر–نجار", "url": "https://medlineplus.gov/genetics/condition/crigler-najjar-syndrome/"},
    "hae_wao_eaaci": {"organization": "WAO/EAACI", "title_fa": "راهنمای بین‌المللی آنژیوادم ارثی", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9023902/"},
    "preeclampsia_acog": {"organization": "ACOG", "title_fa": "فشارخون بارداری و پره‌اکلامپسی", "url": "https://www.acog.org/womens-health/faqs/preeclampsia-and-high-blood-pressure-during-pregnancy"},
    "uti_pregnancy_acog": {"organization": "ACOG", "title_fa": "عفونت ادراری در بارداری", "url": "https://www.acog.org/clinical/clinical-guidance/clinical-consensus/articles/2023/08/urinary-tract-infections-in-pregnant-individuals"},
    "folic_acid_cdc": {"organization": "CDC", "title_fa": "اسیدفولیک و پیشگیری از نقص لولهٔ عصبی", "url": "https://www.cdc.gov/folic-acid/about/index.html"},
    "pcos_2023_asrm": {"organization": "ASRM / Monash", "title_fa": "راهنمای مبتنی بر شواهد PCOS ۲۰۲۳", "url": "https://www.asrm.org/globalassets/_asrm/practice-guidance/practice-guidelines/pdf/recommendations_from_the_2023_int_evidence-based_guideline_on_pcos.pdf"},
    "ectopic_aafp": {"organization": "AAFP", "title_fa": "تشخیص و درمان حاملگی خارج‌رحمی", "url": "https://www.aafp.org/pubs/afp/issues/2020/0515/p599.html"},
    "septic_abortion_msd": {"organization": "MSD Manual Professional", "title_fa": "سقط سپتیک", "url": "https://www.msdmanuals.com/professional/gynecology-and-obstetrics/early-pregnancy-disorders/septic-abortion"},
    "poi_asrm": {"organization": "ASRM", "title_fa": "راهنمای نارسایی زودرس تخمدان", "url": "https://www.asrm.org/practice-guidance/practice-committee-documents/evidence-based-guideline-premature-ovarian-insufficiency--2024/"},
    "pph_acog": {"organization": "ACOG", "title_fa": "خونریزی پس از زایمان", "url": "https://www.acog.org/clinical/clinical-guidance/practice-bulletin/articles/2017/10/postpartum-hemorrhage"},
    "endometrial_eval_aafp": {"organization": "AAFP", "title_fa": "خونریزی غیرطبیعی رحم و ارزیابی آندومتر", "url": "https://www.aafp.org/pubs/afp/issues/2019/0401/p435.html"},
    "delayed_cord_acog": {"organization": "ACOG", "title_fa": "کلمپ تأخیری بند ناف", "url": "https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/01/delayed-umbilical-cord-clamping-after-birth"},
    "amenorrhea_asrm": {"organization": "ASRM", "title_fa": "ارزیابی آمنوره", "url": "https://www.asrm.org/practice-guidance/practice-committee-documents/current-evaluation-of-amenorrhea-2024/"},
    "hpv_cdc": {"organization": "CDC", "title_fa": "واکسیناسیون HPV", "url": "https://www.cdc.gov/hpv/hcp/vaccination-considerations/index.html"},
    "nci_childhood_ovarian": {"organization": "NCI", "title_fa": "درمان تومورهای تخمدان در کودکان", "url": "https://www.cancer.gov/types/ovarian/hp/child-ovarian-treatment-pdq"},
    "pprom_smfm": {"organization": "SMFM", "title_fa": "PPROM پیش‌زیست و پری‌زیست", "url": "https://assets.noviams.com/novi-file-uploads/smfm/Publications_and_Guidelines/Consults/PPROM_Final_Publication.pdf"},
    "gdm_acog_summary": {"organization": "AAFP / ACOG", "title_fa": "راهنمای دیابت بارداری", "url": "https://www.aafp.org/pubs/afp/issues/2014/0915/p416.html"},
    "cervical_uspstf": {"organization": "USPSTF", "title_fa": "غربالگری سرطان سرویکس", "url": "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/cervical-cancer-screening"},
    "dermatomyositis_merck": {"organization": "Merck Manual Professional", "title_fa": "درماتومیوزیت", "url": "https://www.merckmanuals.com/professional/musculoskeletal-and-connective-tissue-disorders/autoimmune-rheumatic-disorders/dermatomyositis"},
    "botulism_cdc": {"organization": "CDC", "title_fa": "بوتولیسم و آنتی‌توکسین", "url": "https://www.cdc.gov/botulism/hcp/clinical-overview/index.html"},
    "tetanus_cdc": {"organization": "CDC", "title_fa": "پیشگیری کزاز در مدیریت زخم", "url": "https://www.cdc.gov/tetanus/hcp/clinical-guidance/index.html"},
    "mrsa_idsa": {"organization": "IDSA", "title_fa": "راهنمای عفونت‌های MRSA", "url": "https://academic.oup.com/cid/article/52/3/e18/306145"},
    "lung_abscess_merck": {"organization": "Merck Manual Professional", "title_fa": "آبسهٔ ریوی", "url": "https://www.merckmanuals.com/professional/pulmonary-disorders/bronchiectasis-and-lung-abscess/lung-abscess"},
    "intestinal_obstruction_merck": {"organization": "Merck Manual Professional", "title_fa": "انسداد روده", "url": "https://www.merckmanuals.com/professional/gastrointestinal-disorders/acute-abdomen-and-surgical-gastroenterology/intestinal-obstruction"},
    "acute_stroke_aafp": {"organization": "AAFP", "title_fa": "سکتهٔ ایسکمیک حاد", "url": "https://www.aafp.org/pubs/afp/issues/2022/0600/p616.html"},
    "placenta_previa_merck": {"organization": "Merck Manual Professional", "title_fa": "پلاسنتا پرویا", "url": "https://www.merckmanuals.com/professional/gynecology-and-obstetrics/antenatal-complications/placenta-previa"},
    "mental_status_merck": {"organization": "Merck Manual Professional", "title_fa": "معاینهٔ وضعیت روانی", "url": "https://www.merckmanuals.com/professional/psychiatric-disorders/approach-to-the-patient-with-mental-symptoms/mental-status-examination"},
    "psp_ninds": {"organization": "NINDS", "title_fa": "فلج فوق‌هسته‌ای پیشرونده", "url": "https://www.ninds.nih.gov/health-information/disorders/progressive-supranuclear-palsy-psp"},
    "cvt_aha": {"organization": "AHA/ASA", "title_fa": "بیانیهٔ ترومبوز وریدی مغزی", "url": "https://www.ahajournals.org/doi/10.1161/STR.0000000000000456"},
    "amiodarone_ata": {"organization": "American Thyroid Association", "title_fa": "اختلال عملکرد تیروئید ناشی از آمیودارون", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9934045/"},
    "div_merck": {"organization": "Merck Manual Professional", "title_fa": "واژینیت التهابی دِسکواماتیو", "url": "https://www.merckmanuals.com/professional/gynecology-and-obstetrics/vaginitis-cervicitis-and-pelvic-inflammatory-disease/desquamative-inflammatory-vaginitis"},
    "genital_warts_cdc": {"organization": "CDC", "title_fa": "زگیل تناسلی", "url": "https://www.cdc.gov/std/treatment-guidelines/anogenital-warts.htm"},
    "contraception_cdc_mec": {"organization": "CDC", "title_fa": "معیارهای واجدشرایط‌بودن پیشگیری از بارداری", "url": "https://www.cdc.gov/contraception/hcp/usmec/index.html"},
    "intraamniotic_acog": {"organization": "ACOG", "title_fa": "مدیریت عفونت داخل‌آمنیونی", "url": "https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/08/intrapartum-management-of-intraamniotic-infection"},
    "herpes_cdc": {"organization": "CDC", "title_fa": "هرپس تناسلی", "url": "https://www.cdc.gov/std/treatment-guidelines/herpes.htm"},
    "postmenopausal_bleeding_acog": {"organization": "ACOG", "title_fa": "ارزیابی خونریزی پس از یائسگی", "url": "https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2018/05/the-role-of-transvaginal-ultrasonography-in-evaluating-the-endometrium-of-women-with-postmenopausal-bleeding"},
    "pms_acog": {"organization": "ACOG", "title_fa": "سندرم پیش از قاعدگی", "url": "https://www.acog.org/womens-health/faqs/premenstrual-syndrome-pms"},
    "svt_esc": {"organization": "ESC", "title_fa": "راهنمای تاکی‌کاردی‌های فوق‌بطنی", "url": "https://www.escardio.org/Guidelines/Clinical-Practice-Guidelines/Supraventricular-Tachycardia-Guidelines"},
    "leiomyoma_acog": {"organization": "ACOG", "title_fa": "مدیریت لیومیوم علامت‌دار", "url": "https://journals.lww.com/greenjournal/fulltext/2021/06000/management_of_symptomatic_uterine_leiomyomas__acog.36.aspx"},
    "pprom_acog": {"organization": "ACOG", "title_fa": "پارگی پیش از موعد پرده‌ها", "url": "https://www.acog.org/clinical/clinical-guidance/practice-bulletin/articles/2020/03/prelabor-rupture-of-membranes"},
    "sti_cdc": {"organization": "CDC", "title_fa": "راهنمای درمان STI", "url": "https://www.cdc.gov/std/treatment-guidelines/trichomoniasis.htm"},
    "cmv_cdc": {"organization": "CDC", "title_fa": "پیشگیری از CMV در بارداری", "url": "https://www.cdc.gov/cytomegalovirus/about/index.html"},
    "abruption_merck": {"organization": "Merck Manual Professional", "title_fa": "جداشدگی جفت", "url": "https://www.merckmanuals.com/professional/gynecology-and-obstetrics/antenatal-complications/placental-abruption-abruptio-placentae"},
    "candidiasis_cdc": {"organization": "CDC", "title_fa": "کاندیدیازیس ولوواژینال", "url": "https://www.cdc.gov/std/treatment-guidelines/candidiasis.htm"},
    "who_semen_2021": {"organization": "WHO", "title_fa": "راهنمای آزمایش و پردازش مایع منی، ویرایش ششم", "url": "https://iris.who.int/handle/10665/343208"},
    "breech_review": {"organization": "Springer / J Perinatology", "title_fa": "مرور عوامل خطر پرزانتاسیون بریچ", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9006544/"},
    "nrp_aafp": {"organization": "AAFP", "title_fa": "احیای نوزادان", "url": "https://www.aafp.org/pubs/afp/issues/2021/1000/p425.html"},
}

CATEGORY_LABELS = {
    "candidate_remaining": "کاندیدای باقی‌مانده",
    "rewrite_or_ambiguity": "نیازمند بازنویسی/رفع ابهام",
    "source_or_context_required": "نیازمند منبع یا بافت تکمیلی",
}
DISPOSITION_LABELS = {
    "candidate_key_change_not_applied": "کاندیدای تغییر کلید؛ اعمال نشده است",
    "legacy_proposal_rejected_current_key_retained": "پیشنهاد تاریخی رد شد؛ کلید فعلی حفظ می‌شود",
    "rewrite_required_no_key_change": "بازنویسی لازم است؛ کلید تغییر نمی‌کند",
    "source_or_context_required_no_key_change": "منبع/بافت لازم است؛ کلید تغییر نمی‌کند",
}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def question_digest(question: dict[str, Any]) -> str:
    return sha256_bytes(canonical_json(question).encode("utf-8"))


def payload_path(part: int) -> Path:
    return BANK / f"import-payload.master-preint.part{part:02d}.json"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    path.write_text(text, encoding="utf-8")


def priority(category: str, rejected: bool) -> str:
    if rejected:
        return "low"
    if category in {"rewrite_or_ambiguity", "source_or_context_required"}:
        return "high"
    return "medium"


def build() -> dict[str, Any]:
    proposals = load_json(KEY_QUEUE)["proposals"]
    outdated_all = load_json(OUTDATED_QUEUE)["rows"]
    legacy_by_key = {(row["part"], row["local_question"]): row for row in proposals}
    outdated_by_key = {
        (row["part"], row["local_question"]): row
        for row in outdated_all
        if row.get("apply") is True
    }
    expected = set(legacy_by_key) | set(outdated_by_key)
    if len(legacy_by_key) != 58 or len(outdated_by_key) != 6 or len(expected) != 64:
        raise RuntimeError("دامنهٔ ورودی دور۶۲ باید دقیقاً ۵۸+۶=۶۴ باشد.")
    if set(ROW_SPECS) != expected:
        missing = sorted(expected - set(ROW_SPECS))
        extra = sorted(set(ROW_SPECS) - expected)
        raise RuntimeError(f"پوشش مشخصات ناقص/اضافی است: missing={missing}; extra={extra}")

    payloads = {part: payload_path(part) for part in PARTS}
    payload_before = {str(part): sha256_bytes(path.read_bytes()) for part, path in payloads.items()}
    bank_questions: dict[tuple[int, int], dict[str, Any]] = {}
    for part, path in payloads.items():
        payload = load_json(path)
        for local, question in enumerate(payload["questions"], start=1):
            bank_questions[(part, local)] = question

    rows: list[dict[str, Any]] = []
    for key in sorted(expected):
        part, local = key
        spec = ROW_SPECS[key]
        q = bank_questions[key]
        source_type = "legacy_key_proposal" if key in legacy_by_key else "legacy_outdated_apply_true"
        source = legacy_by_key.get(key) or outdated_by_key[key]
        if q["tags"][0] != source["id"]:
            raise RuntimeError(f"شناسهٔ بانک با صف برای {key} یکی نیست.")
        if q["correct_index"] != source["current_index"]:
            raise RuntimeError(f"کلید فعلی بانک با صف برای {key} یکی نیست.")
        if source.get("proposed_index") is None:
            raise RuntimeError(f"پیشنهاد بدون index در دامنهٔ فعال: {key}")
        category = spec["category"]
        rejected = bool(spec.get("reject_proposal"))
        if rejected and category != "candidate_remaining":
            raise RuntimeError(f"رد پیشنهاد باید در دستهٔ candidate باشد: {key}")
        if rejected:
            disposition = "legacy_proposal_rejected_current_key_retained"
            recommendation_index: int | None = source["current_index"]
            key_change_needed = False
        elif category == "candidate_remaining":
            disposition = "candidate_key_change_not_applied"
            recommendation_index = source["proposed_index"]
            key_change_needed = True
        elif category == "rewrite_or_ambiguity":
            disposition = "rewrite_required_no_key_change"
            recommendation_index = None
            key_change_needed = False
        else:
            disposition = "source_or_context_required_no_key_change"
            recommendation_index = None
            key_change_needed = False
        if not all(ref in REFERENCES for ref in spec["refs"]):
            raise RuntimeError(f"مرجع ثبت‌نشده برای {key}")
        row = {
            "part": part,
            "local_question": local,
            "id": source["id"],
            "input_source": source_type,
            "input_status": source.get("status"),
            "input_apply": source.get("apply"),
            "classification": category,
            "classification_fa": CATEGORY_LABELS[category],
            "disposition": disposition,
            "disposition_fa": DISPOSITION_LABELS[disposition],
            "action_priority": priority(category, rejected),
            "action_priority_fa": {"high": "بالا", "medium": "متوسط", "low": "پایین"}[priority(category, rejected)],
            "review_confidence": spec["confidence"],
            "legacy_current_index": source["current_index"],
            "legacy_current_option_fa": source["current_option_fa"],
            "legacy_proposed_index": source["proposed_index"],
            "legacy_proposed_option_fa": source.get("proposed_option_fa", q["options_fa"][source["proposed_index"]]),
            "round62_recommendation_index": recommendation_index,
            "round62_key_change_needed": key_change_needed,
            "rationale_fa": spec["rationale_fa"],
            "caveat_fa": spec["caveat_fa"],
            "reference_ids": spec["refs"],
            "question_snapshot": {
                "question_fa": q["question_fa"],
                "options_fa": q["options_fa"],
                "correct_index_before": q["correct_index"],
                "question_sha256": question_digest(q),
            },
        }
        rows.append(row)

    category_counts = Counter(row["classification"] for row in rows)
    disposition_counts = Counter(row["disposition"] for row in rows)
    priority_counts = Counter(row["action_priority"] for row in rows)
    expected_categories = {
        "candidate_remaining": 56,
        "rewrite_or_ambiguity": 6,
        "source_or_context_required": 2,
    }
    expected_dispositions = {
        "candidate_key_change_not_applied": 55,
        "legacy_proposal_rejected_current_key_retained": 1,
        "rewrite_required_no_key_change": 6,
        "source_or_context_required_no_key_change": 2,
    }
    if dict(category_counts) != expected_categories or dict(disposition_counts) != expected_dispositions:
        raise RuntimeError("شمارش نتیجهٔ بازبینی با انتظار دور۶۲ یکسان نیست.")
    if dict(priority_counts) != {"medium": 55, "high": 8, "low": 1}:
        raise RuntimeError("شمارش اولویت‌ها با انتظار دور۶۲ یکسان نیست.")

    payload_after = {str(part): sha256_bytes(path.read_bytes()) for part, path in payloads.items()}
    if payload_before != payload_after:
        raise RuntimeError("curator نباید payloadهای بانک را تغییر دهد.")

    return {
        "schema_version": "round62-legacy-review/v1",
        "status": "reviewed_not_applied",
        "round": 62,
        "review_date": TODAY,
        "language": "fa",
        "mode_fa": "بازبینی فقط‌خواندنی؛ هیچ کلید یا payloadی اعمال/ویرایش نشده است.",
        "scope": {
            "legacy_key_proposals": 58,
            "legacy_outdated_apply_true": 6,
            "total": 64,
            "included_outdated_rows": ["24:102", "24:113", "24:123", "24:147", "24:213", "25:149"],
            "excluded_outdated_open_rows": ["23:88", "23:99"],
        },
        "classification_counts": dict(sorted(category_counts.items())),
        "disposition_counts": dict(sorted(disposition_counts.items())),
        "action_priority_counts": dict(sorted(priority_counts.items())),
        "decision_rules_fa": {
            "candidate_remaining": "شواهد برای جمع‌بندی آزمونی کافی است. ۵۵ مورد هنوز تغییر کلید پیشنهادی‌اند اما بدون مجوز صریح اعمال نمی‌شوند؛ یک مورد (27:175) پیشنهاد قبلی را رد و کلید فعلی را حفظ می‌کند.",
            "rewrite_or_ambiguity": "گزینه‌ها/هدف سؤال پاسخ یکتای ایمن یا کامل نمی‌دهند؛ اعمال کلید ممنوع است تا بازنویسی مستقل.",
            "source_or_context_required": "متن/دادهٔ ضروری ناقص است؛ اعمال کلید ممنوع است تا منبع کامل یا دادهٔ گمشده تأمین شود.",
            "priority": "اولویت، اولویت اصلاح محتواست نه تریاژ بیمار: بالا=۸ مورد بازنویسی/بافت، متوسط=۵۵ تغییر کلید معلق، پایین=یک پیشنهاد ردشده و بسته.",
        },
        "publication_guardrails_fa": [
            "correct_index، question_fa و options_fa در این دور تغییر نکرده‌اند.",
            "برای هرگونه اعمال ۵۵ تغییر کلید، مجوز صریح و جداگانهٔ کاربر لازم است.",
            "برای بازنویسی question_fa/options_fa در ۶ مورد مبهم، مجوز مستقل لازم است.",
            "غنی‌سازی آموزشی payload در این دور انجام نشده است.",
        ],
        "protected_payload_sections": {
            "before_sha256": payload_before,
            "after_sha256": payload_after,
            "unchanged": payload_before == payload_after,
            "parts": list(PARTS),
        },
        "updated_deferred_queue": {
            "round62_pending_key_changes": 55,
            "round62_rewrite_or_ambiguity": 6,
            "round62_source_or_context_required": 2,
            "round62_closed_keep_current": 1,
            "preexisting_round60_candidate_key_changes": 6,
            "preexisting_round61_candidate_key_changes": 1,
            "preexisting_rewrite_or_integrity": 21,
            "preexisting_deduplication": 1,
            "preexisting_artifact_or_source": 13,
            "actionable_total": 105,
            "calculation_fa": "۵۵+۶+۱+۲۷+۱+۱۵=۱۰۵؛ مورد 27:175 بسته است و در صف actionable شمرده نمی‌شود.",
        },
        "reference_registry": REFERENCES,
        "rows": rows,
    }


def reference_text(reference_id: str) -> str:
    ref = REFERENCES[reference_id]
    return f"[{reference_id}] {ref['organization']} — {ref['title_fa']} — {ref['url']}"


def write_brief(dossier: dict[str, Any], path: Path) -> None:
    rows = dossier["rows"]
    by_category = {
        category: [row for row in rows if row["classification"] == category]
        for category in CATEGORY_LABELS
    }
    lines = [
        "# دور ۶۲ — بازبینی باقی‌ماندهٔ صف legacy بانک سؤال",
        "",
        "> **وضعیت:** بازبینی فقط‌خواندنی و مستند. هیچ `correct_index`، `question_fa`، `options_fa` یا enrichment payload در این دور تغییر نکرده است.",
        "",
        "## دامنه و روش",
        "",
        "- **دامنهٔ دقیق:** ۵۸ پیشنهاد کلید دور۵۸ + ۶ ردیف منسوخ `apply=true` = **۶۴ ردیف**.",
        "- **کنترل read-only:** هش کامل payloadهای بخش‌های ۲۳، ۲۴، ۲۵، ۲۷، ۲۸ و ۲۹ پیش و پس از ساخت dossier یکسان است.",
        "- **معیار:** متن و همهٔ گزینه‌های فعلی هر ردیف از payload قانونی خوانده شد؛ پیشنهاد تاریخی دوباره با راهنمای حرفه‌ای/منبع عمومی معتبر سنجیده شد.",
        "- **مرزبندی:** این متن ابزار آموزش/کیفیت است، نه دستور درمان بیمار.",
        "",
        "## جمع‌بندی تصمیم",
        "",
        "| دسته | شمار | نتیجه | اولویت اصلاح |",
        "|---|---:|---|---|",
        "| کاندیدای باقی‌مانده | ۵۶ | ۵۵ تغییر کلید هنوز نیازمند مجوز صریح‌اند؛ ۱ پیشنهاد رد و کلید فعلی حفظ شد | متوسط/پایین |",
        "| نیازمند بازنویسی/رفع ابهام | ۶ | کلید تغییر نکند تا سؤال/گزینه‌ها بازنویسی شوند | بالا |",
        "| نیازمند منبع یا بافت تکمیلی | ۲ | کلید تغییر نکند تا متن/دادهٔ مفقود تأمین شود | بالا |",
        "",
        "**توضیح اولویت:** این اولویت فقط ترتیب اصلاح محتواست، نه فوریت بالینی. ۸ مورد high (۶ بازنویسی و ۲ بافت)، ۵۵ مورد medium (تغییر کلیدِ معلق) و ۱ مورد low (بسته‌شده با حفظ کلید) وجود دارد.",
        "",
    ]
    for category, label in CATEGORY_LABELS.items():
        items = by_category[category]
        lines += [f"## {label} — {len(items)} ردیف", ""]
        for row in items:
            source_mark = "پیشنهاد کلید" if row["input_source"] == "legacy_key_proposal" else "ردیف منسوخ apply=true"
            lines += [
                f"### `{row['part']}:{row['local_question']}` — `{row['id']}`",
                "",
                f"- **منشأ:** {source_mark}؛ کلید ثبت‌شده: گزینهٔ {row['legacy_current_index']} (`{row['legacy_current_option_fa']}`)؛ پیشنهاد تاریخی: گزینهٔ {row['legacy_proposed_index']} (`{row['legacy_proposed_option_fa']}`).",
                f"- **تصمیم دور۶۲:** {row['disposition_fa']}؛ اطمینان: **{row['review_confidence']}**؛ اولویت اصلاح: **{row['action_priority_fa']}**.",
                f"- **استدلال:** {row['rationale_fa']}",
                f"- **قید ایمنی/کیفی:** {row['caveat_fa']}",
                "- **منابع:** " + "؛ ".join(reference_text(ref) for ref in row["reference_ids"]),
                "",
            ]
    lines += [
        "## قفل‌های انتشار و گام بعد",
        "",
        "1. این review هیچ تغییر بانک یا کلید را اعمال نمی‌کند؛ ۵۵ تغییر کلید فقط پس از مجوز صریح جداگانه قابل بررسی برای اعمال‌اند.",
        "2. شش مورد ابهام/بازنویسی (`27:133`, `27:146`, `27:151`, `27:153`, `29:191`, `24:213`) به مجوز مستقل برای ویرایش متن/گزینه‌ها نیاز دارند.",
        "3. دو مورد بافت/منبع (`27:174`, `29:218`) تا بازیابی stem کامل یا دادهٔ روز چهارم، قفل می‌مانند.",
        "4. `27:175` بسته است: پیشنهاد تاریخی `0→1` رد شد و کلید فعلی `0` حفظ می‌شود.",
        "5. صف actionable به‌روز شده **۱۰۵** مورد است: ۵۵ تغییر کلید دور۶۲ + ۶ کاندید دور۶۰ + ۱ کاندید دور۶۱ + ۲۷ بازنویسی/یکپارچگی + ۱ deduplication + ۱۵ منبع/آرتیفکت. مورد بستهٔ `27:175` در این عدد نیست.",
        "",
        "## کنترل بازتولیدپذیری",
        "",
        "اجرای `python3 .work/round62-legacy-review/test_round62.py` باید پوشش دقیق ۶۴ ردیف، breakdown، عدم اعمال همهٔ کلیدها و برابری هش payloadهای بخش‌های محافظت‌شده را تأیید کند.",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="ساخت dossier بازبینی فقط‌خواندنی دور۶۲")
    parser.add_argument("--output", type=Path, default=DEFAULT_DOSSIER)
    parser.add_argument("--brief", type=Path, default=DEFAULT_BRIEF)
    parser.add_argument("--check-only", action="store_true", help="فقط اعتبارسنجی و چاپ خلاصه؛ آرتیفکت ننویس")
    args = parser.parse_args()
    dossier = build()
    if args.check_only:
        print(json.dumps({
            "status": dossier["status"],
            "scope_total": dossier["scope"]["total"],
            "classification_counts": dossier["classification_counts"],
            "protected_payload_unchanged": dossier["protected_payload_sections"]["unchanged"],
        }, ensure_ascii=False, indent=2))
        return 0
    write_json(args.output, dossier)
    write_brief(dossier, args.brief)
    print(f"written dossier: {args.output.relative_to(ROOT)}")
    print(f"written brief: {args.brief.relative_to(ROOT)}")
    print("payloads changed: no")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
