# -*- coding: utf-8 -*-
"""Build the read-only round61 review of the 27 remaining BROKEN rows.

This script is intentionally documentation-only.  It reads canonical bank payloads
and writes review artifacts, but never edits question_fa, options_fa, correct_index,
explanation_fa, options_why_fa, micro, media, or any other canonical payload field.
"""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PROJ = ROOT / ".work" / "proj"
DOCS = PROJ / "docs"
BANK = PROJ / "tools" / "master-bank"

REFERENCES = {
    "was_genereviews": {
        "title_fa": "درمان تظاهرهای سندرم ویسکوت–آلدریچ — ژن‌ریویوز/کتابخانهٔ ملی پزشکی آمریکا",
        "url": "https://www.ncbi.nlm.nih.gov/sites/books/NBK1178/table/was.T.wiskottaldrich_syndrome_and_xlinke/",
        "use_fa": "برای نقش پیوند سلول‌های بنیادی خون‌ساز در درمان و امکان بهبود ترومبوسیتوپنی با اسپلنکتومیِ انتخابی، همراه با خطر عفونت.",
    },
    "developmental_milestones": {
        "title_fa": "نقاط عطف تکاملی سه‌سالگی — مدلاین‌پلاس",
        "url": "https://medlineplus.gov/ency/article/002014.htm",
        "use_fa": "برای سازگاری مهارت‌های پله، خودمراقبتی و شناخت با حوالی سه‌سالگی، نه ماه‌های اول زندگی.",
    },
    "pid_warning_signs": {
        "title_fa": "ده نشانهٔ هشدار نقص ایمنی اولیه در کودک — بنیاد مشورتی جفری مدل",
        "url": "https://immunodeficiency.ca/primary-immunodeficiency/10-warning-signs/",
        "use_fa": "برای آستانه‌های چهار عفونت گوش، دو سینوزیت جدی و دو پنومونی در سال و نیز عفونت‌های عمقیِ راجعه.",
    },
    "psgn_aap": {
        "title_fa": "گلومرولونفریت حاد پس از استرپتوکوک در کودک — مرور آکادمی کودکان آمریکا",
        "url": "https://publications.aap.org/pediatricsinreview/article/36/1/3/32223/Acute-Poststreptococcal-Glomerulonephritis-The",
        "use_fa": "برای این نکته که در گلومرولونفریت پس‌استرپتوکوکیِ الیگوریک، کسر دفعی سدیم غالباً پایین است و نگه‌داشت سدیم رخ می‌دهد.",
    },
    "vitamin_a_who": {
        "title_fa": "ویتامین آ در شیرخوار و کودک — راهنمای سازمان جهانی بهداشت",
        "url": "https://iris.who.int/server/api/core/bitstreams/af8ab64a-7d09-4789-af43-60ccd68a548d/content",
        "use_fa": "برای وابستگی دوز به سن و تفاوت میان دوزهای ۱۰۰٬۰۰۰ و ۲۰۰٬۰۰۰ واحد بین‌المللی در گروه‌های سنی مختلف.",
    },
    "bcg_immunodeficiency": {
        "title_fa": "عفونت منتشر ب‌ث‌ژ در شیرخوار دارای نقص ایمنی — مرور دسترس‌آزاد",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC5420150/",
        "use_fa": "برای پرهیز از واکسن زنده ب‌ث‌ژ وقتی سابقهٔ خانوادگی یا شواهد بالینی نگران‌کنندهٔ نقص ایمنی وجود دارد.",
    },
    "iron_response": {
        "title_fa": "پاسخ به درمان کم‌خونی فقر آهن در کودک — مرور دسترس‌آزاد",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9029079/",
        "use_fa": "برای شروع رتیکولوسیتوز در حدود ۷۲ تا ۹۶ ساعت و تأخیر نسبی افزایش هموگلوبین.",
    },
    "hypernatraemia_rch": {
        "title_fa": "هایپرناترمی در کودکان — راهنمای بیمارستان رویال چلدرنز ملبورن",
        "url": "https://www.rch.org.au/clinicalguide/guideline_index/hypernatraemia/",
        "use_fa": "برای این اصل که مایع نگهدارنده، کسری و اتلاف جاری باید جدا محاسبه شوند و اصلاح کسری آب معمولاً طی ۴۸ ساعت است.",
    },
    "neonatal_zoster": {
        "title_fa": "واریسلای نوزادی ناشی از زوستر مادری — گزارش موردی با جمع‌بندی راهنمای ردبوک",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7965958/",
        "use_fa": "برای تفاوت زوستر موضعی مادر از واریسلای اولیهٔ حوالی زایمان و نبود اندیکاسیون معمول ایمونوگلوبولین واریسلا–زوستر در زوستر مادری.",
    },
    "maternal_zoster_treatment": {
        "title_fa": "مدیریت زوستر در بارداری — مرور بالینی",
        "url": "https://pubmed.ncbi.nlm.nih.gov/29565203/",
        "use_fa": "برای این‌که زوستر بدون عارضه در بارداری با درمان ضدویروس خوراکی مادری مدیریت می‌شود؛ انتخاب دقیق دارو و زمان شروع باید با سناریوی بالینی سنجیده شود.",
    },
    "growth_merck": {
        "title_fa": "رشد جسمی شیرخوار و کودک — راهنمای حرفه‌ای مرک",
        "url": "https://www.merckmanuals.com/professional/pediatrics/growth-and-development/physical-growth-of-infants-and-children",
        "use_fa": "برای سرعت تقریبی وزن‌گیری ماه‌های نخست، کاهش وزن نوزادی و رشد سالانه پس از دو سالگی.",
    },
    "measles_cdc": {
        "title_fa": "مرور بالینی سرخک — مرکز کنترل و پیشگیری بیماری آمریکا",
        "url": "https://www.cdc.gov/measles/hcp/clinical-overview/index.html",
        "use_fa": "برای دورهٔ واگیری چهار روز پیش تا چهار روز پس از شروع راش.",
    },
    "sickle_genereviews": {
        "title_fa": "بیماری سلول داسی‌شکل — ژن‌ریویوز/کتابخانهٔ ملی پزشکی آمریکا",
        "url": "https://www.ncbi.nlm.nih.gov/sites/books/NBK1377/",
        "use_fa": "برای این‌که هم هموزیگوت HbS و هم گونه‌های HbS/بتا‌تالاسمی نیازمند تفکیک با سنجش هموگلوبین یا آزمون مولکولی‌اند.",
    },
    "placenta_previa_merck": {
        "title_fa": "جفت سرراهی — راهنمای حرفه‌ای مرک",
        "url": "https://www.merckmanuals.com/professional/gynecology-and-obstetrics/antenatal-complications/placenta-previa",
        "use_fa": "برای عوامل خطر شامل سزارین و کورتاژ قبلی و تظاهر خون‌ریزی روشنِ بدون درد در نیمهٔ دوم بارداری.",
    },
    "stillbirth_acog": {
        "title_fa": "مدیریت مرده‌زایی — کالج متخصصان زنان و زایمان آمریکا",
        "url": "https://www.acog.org/clinical/clinical-guidance/obstetric-care-consensus/articles/2020/03/management-of-stillbirth",
        "use_fa": "برای اجزای اصلی ارزیابی مرگ داخل‌رحمی: آسیب‌شناسی جفت، کالبدگشایی جنین و ارزیابی ژنتیک؛ بررسی جفت مفیدترین جزء منفرد است.",
    },
    "official_booklet_index": {
        "title_fa": "نمایهٔ رسمی فایل‌های آزمون پیش‌کارورزی — دانشکدهٔ پزشکی دانشگاه علوم پزشکی کرمانشاه",
        "url": "https://medicine-school.kums.ac.ir/fa/news/35408/%DA%A9%D9%84%DB%8C%D8%AF%D9%87%D8%A7-%D9%88-%D9%81%D8%A7%DB%8C%D9%84-%D8%B3%D9%88%D8%A7%D9%84%D8%A7%D8%AA-%D8%A2%D8%B2%D9%85%D9%88%D9%86-%D8%B9%D9%84%D9%88%D9%85-%D9%BE%D8%A7%DB%8C%D9%87-%D9%88-%D9%BE%DB%8C%D8%B4-%DA%A9%D8%A7%D8%B1%D9%88%D8%B1%D8%B2%DB%8C",
        "use_fa": "فقط سرنخ بیرونی برای دفترچه‌های شهریور ۱۳۹۸ است؛ به هیچ‌یک از رکوردهای نسخهٔ ۰۰۵ پیوند قطعی ندارد و به‌عنوان منبع بازیابی استفاده نشده است.",
    },
}

# The thirteen records below cannot be clinically resolved without a missing,
# source-specific artifact.  The review deliberately records exactly what must
# be recovered and never invents the omitted values, figures, or text.
SOURCE_BLOCKED = {
    (22, 142): {
        "artifact_kind_fa": "جدول آزمایش‌های انعقادی",
        "minimum_fields_fa": ["شمارش پلاکت", "PT", "aPTT", "زمان خون‌ریزی یا آزمون عملکرد پلاکت", "مقادیر و واحدهای کامل"],
        "reason_fa": "منوراژی و کبودی بدون جدول نمی‌تواند کمبود فاکتور ۸/۱۱، فون‌ویلبراند و گلانزمان را از هم جدا کند.",
    },
    (22, 145): {
        "artifact_kind_fa": "نمودار رشدِ ارجاع‌شده",
        "minimum_fields_fa": ["جنس کودک", "نوع نمودار یا مرجع رشد", "محور وزن و قد", "خطوط صدکیِ قابل خواندن"],
        "reason_fa": "وزن و قد بدون نمودار مرجع و جنس کودک، صدک یکتا نمی‌سازند.",
    },
    (23, 68): {
        "artifact_kind_fa": "ادامهٔ توصیف ویژگی‌های تودهٔ سر نوزاد",
        "minimum_fields_fa": ["زمان شروع", "عبور یا عدم عبور از درزها", "محل قرارگیری", "تغییر اندازه یا قوام"],
        "reason_fa": "عبارت «خصوصیات به شرح زیر است» دادهٔ افتراقی سفال‌هماتوم، ساب‌گالئال و کاپوت را حذف کرده است.",
    },
    (23, 77): {
        "artifact_kind_fa": "جدول گاز خون شریانی و روش اکسیژن‌رسانی هم‌زمان",
        "minimum_fields_fa": ["pH", "PaCO2", "PaO2", "HCO3", "FiO2 یا وسیلهٔ اکسیژن‌رسانی", "زمان نمونه‌گیری"],
        "reason_fa": "انتخاب اکسیژن، فشار مثبت مداوم راه هوایی یا تهویهٔ مکانیکی به مقادیر حذف‌شده وابسته است.",
    },
    (23, 152): {
        "artifact_kind_fa": "جدول آزمایش‌های کودک دچار درد لگن",
        "minimum_fields_fa": ["دما", "شمارش گلبول سفید", "ESR یا CRP", "یافتهٔ مایع مفصل یا تصویربرداری در صورت وجود"],
        "reason_fa": "تمایز سینوویت گذرا از آرتریت سپتیک بدون داده‌های وعده‌داده‌شده ایمن نیست.",
    },
    (23, 163): {
        "artifact_kind_fa": "متن کامل گزینهٔ بریده‌شدهٔ ۱۵",
        "minimum_fields_fa": ["نام مهارت", "سن کامل", "نشانه‌گذاری و جهت گزاره"],
        "reason_fa": "گزینهٔ کلیدی فعلی فقط عدد «۱۵» است و تکمیل آن با حدس می‌تواند معنای آن را تغییر دهد.",
    },
    (24, 48): {
        "artifact_kind_fa": "جدول آزمایش‌های خون‌ریزی",
        "minimum_fields_fa": ["شمارش پلاکت", "PT", "aPTT", "آزمون‌های مرتبط با فون‌ویلبراند یا فاکتور در صورت درج"],
        "reason_fa": "شرح خون‌ریزی مخاطی میان هموفیلی، فون‌ویلبراند و برنارد–سولیه تشخیص یکتا نمی‌سازد.",
    },
    (24, 66): {
        "artifact_kind_fa": "شکل شجره‌نامه",
        "minimum_fields_fa": ["جنس و ابتلای همهٔ افراد", "رابطهٔ نسل‌ها", "نمادهای ناقل یا فوت‌شده در صورت وجود"],
        "reason_fa": "کل سؤال فقط به شکل ارجاع می‌دهد و هیچ توصیف متنی جایگزینی ندارد.",
    },
    (24, 171): {
        "artifact_kind_fa": "جدول آزمون‌های تیروئید",
        "minimum_fields_fa": ["TSH", "T4 آزاد یا کل", "T3 در صورت درج", "واحد و بازهٔ مرجع"],
        "reason_fa": "بدون الگوی هورمونی، کمبود/افزایش TBG و کم‌کاری اولیه/ثانویه تفکیک‌پذیر نیستند.",
    },
    (25, 31): {
        "artifact_kind_fa": "شجره‌نامهٔ مقابل",
        "minimum_fields_fa": ["جنس و ابتلای همهٔ افراد", "رابطهٔ نسل‌ها", "هرگونه ازدواج فامیلی یا حامل‌بودن مشخص‌شده"],
        "reason_fa": "هر چهار بیماری الگوی ارثی متفاوت دارند و متن پرسش جای شکل را نمی‌گیرد.",
    },
    (25, 93): {
        "artifact_kind_fa": "شجره‌نامهٔ مشاهده‌شده",
        "minimum_fields_fa": ["جنس و ابتلای همهٔ افراد", "رابطهٔ نسل‌ها", "وجود انتقال عمودی یا وابستگی به جنس"],
        "reason_fa": "گزینه‌های نوروفاکوماتوز/اختلال وابسته به X بدون شجره‌نامه قابل برچسب‌گذاری نیستند.",
    },
    (28, 87): {
        "artifact_kind_fa": "جدول کامل اسپرموگرام و شرایط نمونه‌گیری",
        "minimum_fields_fa": ["حجم", "غلظت", "تحرک", "مورفولوژی", "زمان پرهیز و زمان تکرار در صورت درج"],
        "reason_fa": "طبیعی‌بودن، تکرار آزمایش و انتخاب IUI/IVF همگی به مقادیر حذف‌شده وابسته‌اند.",
    },
    (28, 91): {
        "artifact_kind_fa": "صفحهٔ کامل و پایان سناریوی میوم",
        "minimum_fields_fa": ["هدف باروری بیمار", "عبارت کامل پرسش", "هر قید یا اطلاعات بالینیِ پس از گزینه‌ها"],
        "reason_fa": "گزینهٔ «بارداری» فقط با خواست باروری و بخش پایانیِ حذف‌شده نسبت روشن پیدا می‌کند.",
    },
}

# The prior editorial route is refined here by current evidence.  It does not
# provide rewritten question wording or options, because that needs its own
# authorization.  One row gains only a candidate key; one has a confirmed key
# but retains a duplicate-choice copy defect.
EDITORIAL = {
    (23, 102): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای لازم است",
        "evidence_fa": "در ویسکوت–آلدریچ، پیوند سلول‌های بنیادی درمان اصلی است و می‌تواند مؤلفه‌های خونی و ایمنی را اصلاح کند؛ اسپلنکتومی نیز در ترومبوسیتوپنی شدیدِ مقاوم ممکن است شمارش پلاکت را بهتر کند. بنابراین دست‌کم دو گزینهٔ «پیوند کمک نمی‌کند» هم‌زمان نادرست‌اند.",
        "minimum_editorial_constraints_fa": ["فقط یک گزارهٔ نادرست یا درست تعیین شود", "درمان قطعی و درمان حمایتی در گزینه‌های جدا و بدون اطلاق جمع شوند", "خطر و اندیکاسیون انتخابی اسپلنکتومی در صورت طرح‌شدن روشن شود"],
        "reference_ids": ["was_genereviews"],
    },
    (23, 144): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای لازم است",
        "evidence_fa": "ترکیب بالا/پایین‌رفتن از پله، شستن و خشک‌کردن دست و شناخت اعضای بدن با حوالی سه‌سالگی سازگار است. هیچ‌یک از سن‌های چاپ‌شده، از جمله ۱۵ یا ۱۸ ماه و ۲ یا ۴ ماه، پاسخ کامل و قابل دفاعی نیست.",
        "minimum_editorial_constraints_fa": ["سن‌ها به بازه‌های واقع‌بینانه و غیرهم‌پوشان تبدیل شوند", "یک مرجع تکاملی واحد انتخاب شود", "سن هدف با همهٔ مهارت‌های ذکرشده سازگار باشد"],
        "reference_ids": ["developmental_milestones"],
    },
    (23, 176): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای لازم است",
        "evidence_fa": "شش اوتیت در سال، سه سینوزیت شدید در سال و دو پنومونی در سال، همگی از آستانه‌های هشدارِ بررسی نقص ایمنی عبور می‌کنند؛ عفونت‌های مکرر پوستی همراه با دیر افتادن بند ناف نیز ارزیابی را توجیه می‌کند. پس برای سؤال «به‌جز» گزینهٔ یکتا وجود ندارد.",
        "minimum_editorial_constraints_fa": ["همهٔ آستانه‌ها با یک فهرست معیار واحد سنجیده شوند", "فقط یک سناریو خارج از آستانه باقی بماند", "از آمیختن هشدارهای مستقل در یک گزینه پرهیز شود"],
        "reference_ids": ["pid_warning_signs"],
    },
    (24, 50): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای لازم است",
        "evidence_fa": "در گلومرولونفریت حاد پس‌استرپتوکوکیِ الیگوریک، کلیه سدیم را نگه می‌دارد و کسر دفعی سدیم غالباً پایین است؛ در نتیجه هم سدیم ادرار پایین و هم ادرار غلیظ می‌توانند با سناریو سازگار باشند، در حالی که گزینهٔ کلیدیِ دفع سدیمِ بالا ناسازگار است. میان گزینه‌های حاضر پاسخ یکتا ساخته نمی‌شود.",
        "minimum_editorial_constraints_fa": ["یک هدف آموزشی مشخص، مانند الگوی پیش‌کلیوی یا گلومرولی، انتخاب شود", "فقط یک شاخص آزمایشگاهی با همان هدف سازگار باشد", "کسر دفعی سدیم، سدیم ادرار و اسمولالیته با وضعیت حجم/مرحلهٔ بیماری یک‌دست شوند"],
        "reference_ids": ["psgn_aap"],
    },
    (24, 193): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای لازم است",
        "evidence_fa": "دوز ویتامین آ به سن، هدف درمانی یا پیشگیری، واحد و برنامهٔ تکرار وابسته است. صورت سؤال سن شیرخوار، واحد و دفعات را نمی‌دهد و بازه‌های گزینه‌ها هم‌پوشانی دارند؛ بنابراین هیچ پاسخ عددی یکتا نیست.",
        "minimum_editorial_constraints_fa": ["سن دقیق و وزن در صورت لزوم نوشته شود", "واحد بین‌المللی، راه تجویز و تعداد دوز روشن شوند", "هدفِ درمانی از پیشگیری تفکیک و بازه‌های گزینه‌ها غیرهم‌پوشان شوند"],
        "reference_ids": ["vitamin_a_who"],
    },
    (24, 201): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای لازم است",
        "evidence_fa": "مرگ خواهر/برادر با شک به نقص ایمنی سلولی، پیش از تزریق واکسن زنده ب‌ث‌ژ نیازمند ارزیابی اختصاصی است. «تزریق روتین همهٔ واکسن‌ها» و «تزریق ب‌ث‌ژ» ایمن و کامل نیستند، اما منع واکسن هپاتیت B نیز درست نیست؛ هیچ گزینهٔ چاپ‌شده اقدام کامل و ایمنی را جدا نمی‌کند.",
        "minimum_editorial_constraints_fa": ["واکسن زنده و غیرزنده صریحاً تفکیک شوند", "اقدام فوریِ ایمن و مسیر ارجاع در یک گزینه یکتا گنجانده شود", "پیش از بازنویسی، سیاست واکسیناسیون هدف مشخص شود"],
        "reference_ids": ["bcg_immunodeficiency"],
    },
    (25, 27): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای لازم است",
        "evidence_fa": "بهبود علامتی می‌تواند زود رخ دهد، رتیکولوسیتوز در چند روز آغاز می‌شود و افزایش هموگلوبین با فاصله قابل مشاهده است؛ گزینه‌های فعلی بیش از یک گزارهٔ زمانی قابل دفاع دارند و «بهبود دائم» را به شاخصی دقیق گره نمی‌زنند.",
        "minimum_editorial_constraints_fa": ["فقط یک شاخص، مانند رتیکولوسیت یا هموگلوبین، پرسیده شود", "بازه و واحد زمانی بدون وارونگی/ابهام نوشته شود", "پاسخ صحیح با زمان‌بندی مرجع سازگار و سه گزینهٔ دیگر قطعاً نادرست باشند"],
        "reference_ids": ["iron_response"],
    },
    (25, 94): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای لازم است",
        "evidence_fa": "در هایپرناترمی، مجموع مایع نگهدارنده، کسری آب و اتلاف جاری تعیین‌کننده است و کسری آب معمولاً طی ۴۸ ساعت اصلاح می‌شود. متن درصد کم‌آبی، هدف سدیم، روش محاسبه و نحوهٔ احتساب بولوس قبلی را تعیین نمی‌کند؛ پس حجم ۲۴ساعته یکتا نیست.",
        "minimum_editorial_constraints_fa": ["درصد یا فرمول کسری آب و وزن مبنا صریح شود", "هدف سدیم و زمان اصلاح مشخص شود", "جایگاه بولوس اولیه و اتلاف جاری در محاسبه معلوم شود"],
        "reference_ids": ["hypernatraemia_rch"],
    },
    (25, 96): {
        "route": "evidence_candidate_not_applied",
        "route_fa": "پیشنهاد مبتنی بر شواهد؛ اعمال‌نشده",
        "proposed_index": 1,
        "confidence_fa": "متوسط",
        "evidence_fa": "ضایعهٔ وزیکولی دردناک و یک‌طرفهٔ قفسهٔ سینه، زوستر موضعی را مطرح می‌کند. در مادر دارای زوستر، ایمونوگلوبولین واریسلا–زوستر به‌طور معمول برای نوزاد اندیکاسیون ندارد، در حالی که درمان ضدویروس خوراکی مادر یک مسیر بالینی شناخته‌شده است. در میان گزینه‌ها، گزینهٔ ۱ تنها انتخابی است که مداخلهٔ نوزادیِ نامتناسب را اضافه نمی‌کند، اما انتخاب دقیق والاسیکلوویر به زمان شروع و وضعیت مادر وابسته است.",
        "review_limit_fa": "ایمنی مادر، زمان دقیق شروع ضایعه، شدت بیماری و توانایی دریافت داروی خوراکی در متن نیامده‌اند؛ این پیشنهاد هنوز نیازمند بازبینی بالینی مستقل و مجوز صریح کاربر است.",
        "reference_ids": ["neonatal_zoster", "maternal_zoster_treatment"],
    },
    (25, 126): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای لازم است",
        "evidence_fa": "رشد در ماه‌های نخست و پس از دو سالگی بازه‌دار است و عبارت «حداقل ۱۵ گرم» برای ماه‌های نخست با میانگین مرجع هم‌سنخ نیست؛ در عین حال ۲٫۵ کیلوگرم در سال نیز بسته به مرجع و سن می‌تواند در مرز بازه باشد. صورت و گزینه‌ها پاسخ نادرست یکتا نمی‌سازند.",
        "minimum_editorial_constraints_fa": ["هر گزاره به سن دقیق و واحد استاندارد متصل شود", "به‌جای «حداقل» از نرخ هدف یا صدک مرجع استفاده شود", "یک نمودار یا مرجع رشد مشخص مبنا باشد"],
        "reference_ids": ["growth_merck"],
    },
    (25, 136): {
        "route": "editorial_copy_deduplication_only",
        "route_fa": "فقط رفع تکرار گزینه؛ کلید فعلی از نظر شواهد پشتیبانی می‌شود",
        "evidence_fa": "دورهٔ واگیری سرخک چهار روز پیش تا چهار روز پس از شروع راش است؛ بنابراین گزینهٔ فعلیِ ۰ با مرجع سازگار است. با این حال دو گزینهٔ پایانی عیناً تکراری‌اند و کیفیت سنجش را کاهش می‌دهند، هرچند دو پاسخ درست نمی‌سازند.",
        "minimum_editorial_constraints_fa": ["کلید فعلی دست‌نخورده بماند", "فقط یکی از دو گزینهٔ تکراری پس از مجوز مستقل با حواس‌پرت‌کنِ نادرست و غیرتکراری جایگزین شود", "بازهٔ درست در سؤال یا پاسخ تغییر نکند"],
        "reference_ids": ["measles_cdc"],
    },
    (25, 173): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای لازم است",
        "evidence_fa": "داکتیلیت در شیرخوار با بیماری سلول داسی‌شکل رخ می‌دهد، اما تنها بر اساس آن و سابقهٔ تزریق، تفکیک HbSS از HbS/بتا‌تالاسمی امکان‌پذیر نیست. تشخیص به سنجش هموگلوبین و گاه آزمون مولکولی وابسته است.",
        "minimum_editorial_constraints_fa": ["برای تشخیص اختصاصی، الگوی الکتروفورز/HPLC یا شاخص‌های افتراقی معتبر افزوده شود", "اگر فقط تشخیص سندرم داسی هدف است، گزینه‌های زیرگونه حذف شوند", "اثر انتقال خون قبلی بر آزمون تشخیصی در صورت لزوم مشخص شود"],
        "reference_ids": ["sickle_genereviews"],
    },
    (28, 113): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای لازم است",
        "evidence_fa": "سزارین و کورتاژ قبلی عوامل خطر جفت سرراهی‌اند و خون‌ریزی روشنِ بدون درد در نیمهٔ دوم نیز تظاهر کلاسیک آن است. بنابراین گزینهٔ ۰ و ۳ هم‌زمان قابل دفاع‌اند و سؤال تک‌پاسخ نیست.",
        "minimum_editorial_constraints_fa": ["محور سؤال فقط عامل خطر یا فقط تظاهر بالینی باشد", "هر گزینه فقط یک ادعا داشته باشد", "مبنای طبقه‌بندی جفت سرراهی در صورت ذکر نوع آن روشن شود"],
        "reference_ids": ["placenta_previa_merck"],
    },
    (28, 118): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای لازم است",
        "evidence_fa": "راهنمای امروز ارزیابی مرگ داخل‌رحمی را مجموعه‌ای از آسیب‌شناسی جفت، کالبدگشایی جنین و ارزیابی ژنتیک می‌داند و آسیب‌شناسی جفت را مفیدترین جزء منفرد معرفی می‌کند. متن پرسش چند ادعای تشخیصی و تدبیر زایمان را در هم می‌آمیزد و با داده‌های ناقص، پاسخ یکتا پایدار ندارد.",
        "minimum_editorial_constraints_fa": ["هدف پرسش به ارزیابی علت یا تدبیر ختم بارداری محدود شود", "اگر تشخیص علت هدف است، اجزای ارزیابی امروز و سطح ادعا مشخص باشند", "گزینه‌های وابسته به آمادگی سرویکس و ترجیح بیمار با اطلاعات لازم همراه شوند"],
        "reference_ids": ["stillbirth_acog"],
    },
}


def get_payload(part):
    return json.loads((BANK / f"import-payload.master-preint.part{part:02d}.json").read_text(encoding="utf-8"))


def get_question(part, local_question):
    return get_payload(part)["questions"][local_question - 1]


def fingerprint(question, recovery_reason):
    protected = "\n".join([
        question["tags"][0],
        question["question_fa"],
        *question["options_fa"],
        str(question["correct_index"]),
        recovery_reason,
    ])
    return hashlib.sha256(protected.encode("utf-8")).hexdigest()


def source_provenance():
    """Facts from the read-only source and repository history inspection."""
    return {
        "status": "no_provenance_safe_primary_artifact_found",
        "status_fa": "هیچ قطعهٔ منبع اولیهٔ قابل‌انتساب با ایمنی کافی یافت نشد",
        "canonical_media_slots_checked": ["image", "media", "micro.media"],
        "canonical_result_fa": "برای همهٔ ۱۳ ردیفِ نیازمند منبع، هر سه جایگاه رسانه‌ای در payload فعلی تهی است.",
        "tracked_local_media_fa": "رسانه‌های booklet محلیِ موجود فقط به نام‌های ۱۴۰۲ و ۱۴۰۳ برچسب خورده‌اند و هیچ نگاشت قابل اثباتی به این ۱۳ شناسه یا نسخهٔ ۰۰۵ ندارند.",
        "history_search_fa": "جست‌وجوی تاریخچهٔ Git برای سه عبارت نماینده فقط نسخه‌های payload، fixture و گزارش‌های audit را یافت؛ اسکن یا صفحهٔ اولیهٔ قابل‌استخراج پیدا نشد.",
        "external_lead": "official_booklet_index",
        "external_lead_fa": "نمایهٔ رسمی دفترچه‌های شهریور ۱۳۹۸ پیدا شد، اما رکوردهای فعلی فاقد تاریخ/نسخه‌ای هستند که آنها را به آن دفترچه پیوند دهد؛ بنابراین به‌درستی به‌عنوان منبع داده مصرف نشد.",
        "recovery_acceptance_fa": "تنها تصویر/صفحهٔ دفترچهٔ اصلی یا منبعِ دارای مجوز که نسخه، صفحه و شناسهٔ رکورد را قابل تطبیق کند، برای تکمیل این موارد پذیرفتنی است. بازسازی از حدس یا از منبع بی‌تطبیق ممنوع است.",
    }


def main():
    old = json.loads((DOCS / "round59-broken-recovery.json").read_text(encoding="utf-8"))
    prior_rows = {(row["part"], row["local_question"]): row for row in old["rows"]}
    expected = set(prior_rows)
    assert len(expected) == 27
    assert set(SOURCE_BLOCKED) | set(EDITORIAL) == expected
    assert not (set(SOURCE_BLOCKED) & set(EDITORIAL))

    rows = []
    for old_row in old["rows"]:
        key = (old_row["part"], old_row["local_question"])
        q = get_question(*key)
        assert old_row["id"] in q["tags"], key
        assert q.get("image") is None and q.get("media") is None
        assert (q.get("micro") or {}).get("media") is None
        record = {
            "part": old_row["part"],
            "local_question": old_row["local_question"],
            "id": old_row["id"],
            "previous_route": old_row["route"],
            "current_index": q["correct_index"],
            "current_option_fa": q["options_fa"][q["correct_index"]],
            "original_defect_fa": old_row["defect_fa"],
            "content_mutation_allowed": False,
            "key_mutation_allowed": False,
            "requires_independent_second_review": True,
            "status": "reviewed_not_applied",
            "record_fingerprint_sha256": fingerprint(q, old_row["defect_fa"]),
        }
        if key in SOURCE_BLOCKED:
            spec = SOURCE_BLOCKED[key]
            record.update({
                "review_route": "source_artifact_required",
                "review_route_fa": "بازیابی منبع اولیه لازم است",
                "proposed_index": None,
                "proposed_option_fa": None,
                "confidence_fa": "نامشخص؛ دادهٔ تعیین‌کننده وجود ندارد",
                "evidence_fa": spec["reason_fa"],
                "artifact_kind_fa": spec["artifact_kind_fa"],
                "minimum_artifact_fields_fa": spec["minimum_fields_fa"],
                "reference_ids": [],
                "next_step_fa": "فقط منبع اولیهٔ قابل‌انتساب بازیابی و سپس در یک بازبینی مستقل خوانده شود؛ هیچ داده‌ای از حدس تکمیل نشود.",
            })
        else:
            spec = EDITORIAL[key]
            proposed = spec.get("proposed_index")
            record.update({
                "review_route": spec["route"],
                "review_route_fa": spec["route_fa"],
                "proposed_index": proposed,
                "proposed_option_fa": q["options_fa"][proposed] if proposed is not None else None,
                "confidence_fa": spec.get("confidence_fa", "پاسخ یکتا یا کلید قابل اعمال وجود ندارد"),
                "evidence_fa": spec["evidence_fa"],
                "minimum_editorial_constraints_fa": spec.get("minimum_editorial_constraints_fa", ["نوع ضایعه، ایمنی مادر و زمان شروع باید در بازبینی مستقل دوباره کنترل شوند", "هیچ تغییر کلید بدون مجوز صریح کاربر انجام نشود"]),
                "review_limit_fa": spec.get("review_limit_fa", "جابه‌جایی کلید به‌تنهایی نقص متن یا گزینه‌ها را برطرف نمی‌کند."),
                "reference_ids": spec["reference_ids"],
                "next_step_fa": (
                    "پیش از هر اعمال، بازبینی مستقل بالینی و مجوز صریح کاربر لازم است؛ تا آن زمان کلید فعلی دست‌نخورده می‌ماند."
                    if proposed is not None else
                    "این مسیر تغییر متن/گزینه می‌خواهد و فقط با مجوز مستقل کاربر آغاز می‌شود؛ تا آن زمان payload دست‌نخورده می‌ماند."
                ),
            })
            if proposed is not None:
                assert proposed != q["correct_index"]
        rows.append(record)

    routes = {route: sum(row["review_route"] == route for row in rows) for route in {
        "source_artifact_required", "editorial_rewrite_required",
        "editorial_copy_deduplication_only", "evidence_candidate_not_applied",
    }}
    assert routes == {
        "source_artifact_required": 13,
        "editorial_rewrite_required": 12,
        "editorial_copy_deduplication_only": 1,
        "evidence_candidate_not_applied": 1,
    }, routes
    for row in rows:
        assert all(ref in REFERENCES for ref in row["reference_ids"]), row["id"]

    legacy_proposals = json.loads((DOCS / "round58-key-proposals.json").read_text(encoding="utf-8"))
    outdated = json.loads((DOCS / "round58-outdated-rows.json").read_text(encoding="utf-8"))
    round60 = json.loads((DOCS / "round60-open-evidence.json").read_text(encoding="utf-8"))
    aggregate = {
        "legacy_verified_key_proposals": len(legacy_proposals["proposals"]),
        "legacy_outdated_apply_candidates": sum(bool(row["apply"]) for row in outdated["rows"]),
        "round60_evidence_candidates_not_applied": round60["evidence_candidate_not_applied"],
        "round61_evidence_candidate_not_applied": routes["evidence_candidate_not_applied"],
        "substantive_editorial_rewrite_required": round60["needs_editorial_rewrite"] + routes["editorial_rewrite_required"],
        "editorial_copy_deduplication_only": routes["editorial_copy_deduplication_only"],
        "source_artifact_required": routes["source_artifact_required"],
    }
    assert sum(aggregate.values()) == 106, aggregate

    output = {
        "status": "reviewed_not_applied",
        "round": 61,
        "count": len(rows),
        **routes,
        "authorization_fa": "این بسته فقط بازبینی، شواهد و مسیر بازیابی است. هیچ پرسش، گزینه، کلید یا متن آموزشی تغییر نکرده و هیچ پیشنهاد آن مجوز اعمال ندارد.",
        "scope_fa": "این دور ۲۷ ردیف BROKEN باقی‌مانده را از نظر بازیابی منبع، ابهام علمی و نقص تحریریه دوباره بررسی کرد؛ ۵۸ پیشنهاد کلید و ۱۵ رکورد دور ۶۰ فقط برای شمارش تجمیعی خوانده شدند.",
        "aggregate_deferred_queue": aggregate,
        "source_provenance": source_provenance(),
        "references": REFERENCES,
        "rows": rows,
    }
    (DOCS / "round61-remaining-review.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    brief = [
        "# دور ۶۱ — بازبینی باقی‌ماندهٔ ۲۷ ردیف BROKEN",
        "",
        "> **فقط بازبینی:** هیچ `question_fa`، `options_fa`، `correct_index`، متن آموزشی یا رسانه‌ای تغییر نکرده است.",
        "",
        "## نتیجهٔ این دور",
        "",
        "| مسیر نهایی | تعداد | اثر بر بانک |",
        "| --- | ---: | --- |",
        "| بازیابی منبع اولیه لازم است | ۱۳ | بدون صفحه/جدول/شکلِ اصلی، هیچ پاسخ حدس زده نمی‌شود |",
        "| بازنویسی تحریریه‌ای اساسی لازم است | ۱۲ | کلیدِ تنها مشکل نیست؛ متن یا گزینه‌ها پاسخ یکتا نمی‌سازند |",
        "| فقط رفع تکرار گزینه لازم است | ۱ | کلید فعلی پشتیبانی می‌شود، اما یک حواس‌پرت‌کن تکراری است |",
        "| پیشنهاد مبتنی بر شواهد، اعمال‌نشده | ۱ | بازبینی مستقل و مجوز صریح پیش از هر تغییر لازم است |",
        "| **جمع** | **۲۷** | هیچ payloadی تغییر نکرده است |",
        "",
        "## وضعیت کل صف deferred",
        "",
        "| مسیر | تعداد |",
        "| --- | ---: |",
        *[f"| {label} | {value} |" for label, value in [
            ("پیشنهادهای کلیدِ تأییدشدهٔ پیشین، اعمال‌نشده", aggregate["legacy_verified_key_proposals"]),
            ("کاندیداهای قدیمیِ منسوخ، اعمال‌نشده", aggregate["legacy_outdated_apply_candidates"]),
            ("کاندیداهای شواهدی دور ۶۰، اعمال‌نشده", aggregate["round60_evidence_candidates_not_applied"]),
            ("کاندیدای شواهدی دور ۶۱، اعمال‌نشده", aggregate["round61_evidence_candidate_not_applied"]),
            ("بازنویسی تحریریه‌ای اساسی", aggregate["substantive_editorial_rewrite_required"]),
            ("رفع تکرار گزینه", aggregate["editorial_copy_deduplication_only"]),
            ("بازیابی منبع اولیه", aggregate["source_artifact_required"]),
            ("**جمع صف بدون تغییر**", sum(aggregate.values())),
        ]],
        "",
        "## کنترل مسیر بازیابی منبع",
        "",
        source_provenance()["canonical_result_fa"],
        "",
        source_provenance()["tracked_local_media_fa"],
        "",
        source_provenance()["history_search_fa"],
        "",
        f"سرنخ بیرونی: [{REFERENCES['official_booklet_index']['title_fa']}]({REFERENCES['official_booklet_index']['url']}) — {source_provenance()['external_lead_fa']}",
        "",
        f"**قاعدهٔ پذیرش:** {source_provenance()['recovery_acceptance_fa']}",
        "",
        "### ۱۳ نیاز منبع اولیه",
        "",
    ]
    for row in rows:
        if row["review_route"] != "source_artifact_required":
            continue
        brief.extend([
            f"#### {row['part']}:{row['local_question']} — {row['id']}",
            f"- دادهٔ گم‌شده: **{row['artifact_kind_fa']}**",
            "- حداقل اجزای لازم: " + "، ".join(row["minimum_artifact_fields_fa"]),
            f"- علت توقف ایمن: {row['evidence_fa']}",
            "",
        ])

    brief.extend(["## ۱۴ نتیجهٔ تحریریه/شواهد", ""])
    for row in rows:
        if row["review_route"] == "source_artifact_required":
            continue
        brief.extend([
            f"### {row['part']}:{row['local_question']} — {row['id']} ({row['review_route_fa']})",
            "",
            f"- کلید فعلی: {row['current_index']} — {row['current_option_fa']}",
            f"- نتیجهٔ بازبینی: {row['evidence_fa']}",
        ])
        if row["proposed_index"] is not None:
            brief.append(f"- پیشنهادِ اعمال‌نشده: {row['proposed_index']} — {row['proposed_option_fa']} (اطمینان: {row['confidence_fa']})")
        brief.extend([
            "- شرط اصلاح آینده: " + "؛ ".join(row["minimum_editorial_constraints_fa"]),
            f"- محدودیت: {row['review_limit_fa']}",
            f"- گام بعدی: {row['next_step_fa']}",
        ])
        if row["reference_ids"]:
            brief.append("- منابع: " + "، ".join(f"[{ref}]({REFERENCES[ref]['url']})" for ref in row["reference_ids"]))
        brief.extend(["", ""])

    brief.extend([
        "## مرز تصمیم",
        "",
        "- تنها پیشنهاد تازهٔ کلید (`25:96 → 1`) **اعمال‌نشده** است و نباید بدون بازبینی بالینی مستقل و مجوز صریح کاربر وارد payload شود.",
        "- ردیف `25:136` از نظر دورهٔ واگیری سرخک، کلید فعلی را حفظ می‌کند؛ فقط دو گزینهٔ نادرست تکراری‌اند و هر تغییر آنها مجوز جدا می‌خواهد.",
        "- ۱۳ ردیفِ وابسته به منبع تنها با تصویر/صفحهٔ قابل‌انتساب قابل ادامه‌اند؛ بازسازی دادهٔ گم‌شده ممنوع است.",
        "- هر تغییر کلید در آینده، مطابق تصمیم جاری، باید در همان دور با غنی‌سازی آموزشی همان ردیف همراه شود.",
        "",
    ])
    (HERE / "remaining-review-brief.md").write_text("\n".join(brief), encoding="utf-8")
    print("reviewed 27 broken rows: 13 source-blocked / 12 rewrite / 1 copy-only / 1 evidence candidate; nothing applied")


if __name__ == "__main__":
    main()
