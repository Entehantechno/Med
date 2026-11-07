# -*- coding: utf-8 -*-
"""Create a source-and-evidence review for the 15 rows still open after round59.

This is a review-only artifact.  It never writes a bank payload and it never
changes question_fa, options_fa, correct_index, educational fields, or the
round57 deferred queue.  Any future key move still requires explicit user
approval and an independent second clinical review.
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
    "who_csf": {
        "title_fa": "جدول الگوی معمول مایع مغزی‌نخاعی در مننژیت باکتریایی و ویروسی — سازمان جهانی بهداشت",
        "url": "https://www.ncbi.nlm.nih.gov/books/NBK614844/table/ch3.tab1/",
        "use_fa": "برای مقایسهٔ غالب‌بودن نوتروفیل/لنفوسیت و گلوکز در مننژیت باکتریایی و ویروسی.",
    },
    "merck_viral_meningitis": {
        "title_fa": "مننژیت ویروسی — راهنمای حرفه‌ای مرک",
        "url": "https://www.merckmanuals.com/professional/neurologic-disorders/meningitis/viral-meningitis",
        "use_fa": "برای این نکته که گلوکز مایع مغزی‌نخاعی در مننژیت ویروسی معمولاً طبیعی یا فقط اندکی پایین است.",
    },
    "winters_formula": {
        "title_fa": "ارزیابی اختلالات اسید و باز — دانشگاه کلرادو",
        "url": "https://medschool.cuanschutz.edu/docs/librariesprovider60/education-docs/heartbeat-im-res/suggested-read/evaluation-of-acid-base-disorders.pdf?sfvrsn=7d5f31b9_2",
        "use_fa": "برای فرمول وینتر: فشار دی‌اکسیدکربن مورد انتظار برابر ۱٫۵ ضربدر بی‌کربنات به‌اضافهٔ ۸، با بازهٔ دو واحدی است.",
    },
    "asccp_pregnancy": {
        "title_fa": "راهنمای مدیریت نتایج غربالگری دهانهٔ رحم در بارداری — انجمن کولپوسکوپی و پاتولوژی گردن رحم آمریکا",
        "url": "https://www.guidelinecentral.com/guideline/41167/",
        "use_fa": "برای ممنوع‌بودن کورتاژ اندوسرویکال در بارداری و انجام نمونه‌برداری یا اقدام تشخیصی فقط هنگام شک به سرطان.",
    },
    "uspstf_osteoporosis": {
        "title_fa": "غربالگری پوکی استخوان برای پیشگیری از شکستگی — گروه خدمات پیشگیرانهٔ ایالات متحده",
        "url": "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/osteoporosis-screening",
        "use_fa": "برای این نکته که هم سیگار و هم مصرف زیاد الکل از عوامل خطر در زنان یائسهٔ زیر ۶۵ سال‌اند.",
    },
    "acr_enterography": {
        "title_fa": "پارامتر انجام سی‌تی انتروگرافی — کالج رادیولوژی آمریکا",
        "url": "https://gravitas.acr.org/PPTS/DownloadPreviewDocument?DocId=75",
        "use_fa": "برای نیاز سی‌تی انتروگرافی به مادهٔ حاجب خوراکی خنثی هنگام ارزیابی بیماری رودهٔ کوچک.",
    },
    "oral_contrast_review": {
        "title_fa": "کاربرد مادهٔ حاجب خوراکی در سال ۲۰۲۴ — مرور علمی دسترس‌آزاد",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11300474/",
        "use_fa": "برای تمایز مادهٔ حاجب خنثی در بیماری التهابی روده از پرهیز از مادهٔ حاجب خوراکی مثبت در ترومای شکمی حاد.",
    },
    "mothertobaby_pseudoephedrine": {
        "title_fa": "سودوافدرین در بارداری — مادر‌به‌کودک/کتابخانهٔ ملی پزشکی آمریکا",
        "url": "https://www.ncbi.nlm.nih.gov/books/NBK582924/",
        "use_fa": "برای ارتباط کوچک و غیرقطعی سودوافدرین با برخی ناهنجاری‌ها و توصیهٔ پرهیز در سه‌ماههٔ نخست.",
    },
    "figo_ectopic": {
        "title_fa": "مدیریت حاملگی خارج‌رحمی — فدراسیون بین‌المللی زنان و زایمان",
        "url": "https://www.figo.org/sites/default/files/2020-03/1_MAS%20Ectopic.pdf",
        "use_fa": "برای معیارهای درمان دارویی در بیمار پایدار: نبود پارگی یا ضربان، تودهٔ کوچک و تیتر کمتر از ۵۰۰۰.",
    },
    "figo_mole": {
        "title_fa": "پیگیری پس از مول هیداتی‌فرم — مرور مبتنی بر راهنمای فدراسیون بین‌المللی زنان و زایمان",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7813445/",
        "use_fa": "برای تفاوت پیگیری مول کامل و ناقص پس از طبیعی‌شدن تیتر هورمون بارداری.",
    },
    "pregnancy_adnexal": {
        "title_fa": "مدیریت توده‌های آدنکس در بارداری — مرور دسترس‌آزاد",
        "url": "https://link.springer.com/article/10.1186/s10397-021-01084-9",
        "use_fa": "برای وابستگی تصمیم به شکل سونوگرافی، علائم و پایداری توده و ترجیح پیگیری در تودهٔ خوش‌خیمِ بدون علامت.",
    },
    "acog_tolerac": {
        "title_fa": "زایمان واژینال پس از سزارین — بولتن کالج متخصصان زنان و زایمان آمریکا",
        "url": "https://www.sdb.unipd.it/sites/sdb.unipd.it/files/VBAC%20ACOG%202017.pdf",
        "use_fa": "برای این نکته که ناهنجاری ضربان قلب جنین شایع‌ترین نشانهٔ پارگی رحم در زایمان پس از سزارین است.",
    },
    "nih_infant_hiv": {
        "title_fa": "تشخیص اچ‌آی‌وی در شیرخوار و کودک — مؤسسهٔ ملی سلامت آمریکا",
        "url": "https://clinicalinfo.hiv.gov/en/guidelines/perinatal/management-infants-diagnosis-hiv-infection-children",
        "use_fa": "برای لزوم آزمون مولکولی ویروس در کودک زیر ۱۸ ماه و زمان‌بندی آزمون‌ها.",
    },
    "cdc_egg_allergy": {
        "title_fa": "واکسن آنفلوانزا و حساسیت به تخم‌مرغ — مرکز کنترل و پیشگیری بیماری آمریکا",
        "url": "https://www.cdc.gov/flu/vaccines/egg-allergies.html",
        "use_fa": "برای این نکته که حساسیت به تخم‌مرغ به‌تنهایی منع دریافت واکسن آنفلوانزا نیست.",
    },
    "merck_conjunctivitis": {
        "title_fa": "کونژونکتیویت ویروسی — راهنمای حرفه‌ای مرک",
        "url": "https://www.merckmanuals.com/professional/eye-disorders/conjunctival-and-scleral-disorders/viral-conjunctivitis",
        "use_fa": "برای هم‌پوشانی کموز، فوتوفوبی و حس جسم خارجی در طیف کونژونکتیویت ویروسی.",
    },
}

# Six rows now have an evidence-supported *candidate* option.  They are still
# deliberately below the round58 "verified" bar: the user has not approved a
# key correction, and a second clinical review remains mandatory.
CANDIDATES = {
    (22, 166): {
        "proposed_index": 2,
        "confidence_fa": "زیاد",
        "evidence_fa": "گلوکز ۱۵، پروتئین ۱۲۵ و غلبهٔ لنفوسیتی با مننژیت سلی/قارچی همخوانی دارند؛ در الگوی معمول، مننژیت ویروسی گلوکز طبیعی یا فقط اندکی پایین دارد. بنابراین از میان چهار گزینه، مننگوانسفالیت ویروسی کمترین انطباق را دارد.",
        "review_limit_fa": "الگوی مایع مغزی‌نخاعی به‌تنهایی تشخیص قطعی نمی‌دهد و مننژیت باکتریاییِ درمان‌شده می‌تواند غیرتیپیک باشد؛ این فقط پیشنهاد کلید آزمونی است، نه توصیهٔ درمانی.",
        "reference_ids": ["who_csf", "merck_viral_meningitis"],
    },
    (27, 114): {
        "proposed_index": 1,
        "confidence_fa": "متوسط",
        "evidence_fa": "با بی‌کربنات ۱۲، فرمول وینتر فشار دی‌اکسیدکربن مورد انتظار را ۲۶ با بازهٔ ۲۴ تا ۲۸ می‌دهد. مقدار ۲۳ اندکی پایین‌تر از بازه است و به آلکالوز تنفسیِ هم‌زمان اشاره می‌کند، نه اسیدوز تنفسیِ هم‌زمان.",
        "review_limit_fa": "اختلاف یک واحدی با مرز بازه و گردشدن اعداد چاپی، بازبینی مستقل را ضروری می‌کند؛ این ردیف نباید هنوز به ابزار اعمال کلید افزوده شود.",
        "reference_ids": ["winters_formula"],
    },
    (27, 140): {
        "proposed_index": 3,
        "confidence_fa": "زیاد",
        "evidence_fa": "در بارداری، کورتاژ اندوسرویکال مجاز نیست و پیگیری سه‌ماهه برای ال‌اس‌آی‌الِ تنها، قاعدهٔ عمومی نیست. نمونه‌برداری یا اقدام تشخیصی در صورت شک به سرطان مسیر قابل دفاع است.",
        "review_limit_fa": "آستانهٔ دقیق کولپوسکوپی به سابقه، نتیجهٔ ویروس پاپیلومای انسانی و برآورد خطر وابسته است؛ پیشنهاد فقط میان گزینه‌های چاپ‌شده انتخاب شده است.",
        "reference_ids": ["asccp_pregnancy"],
    },
    (27, 166): {
        "proposed_index": 2,
        "confidence_fa": "زیاد",
        "evidence_fa": "سی‌تی انتروگرافی برای بیماری التهابی روده از مادهٔ حاجب خوراکی خنثی استفاده می‌کند. در ترومای شکمی حاد، مادهٔ خوراکی مثبت معمولاً لازم نیست و می‌تواند ارزیابی را به تأخیر اندازد.",
        "review_limit_fa": "نوع مادهٔ حاجب و پروتکل مرکز اهمیت دارد؛ این پیشنهاد دربارهٔ گزینهٔ استاندارد آزمونی است، نه نسخهٔ تصویربرداری برای بیمار واقعی.",
        "reference_ids": ["acr_enterography", "oral_contrast_review"],
    },
    (27, 185): {
        "proposed_index": 2,
        "confidence_fa": "متوسط",
        "evidence_fa": "منابع ایمنی دارو در بارداری برای سودوافدرین یک ارتباط کوچک و غیرقطعی با برخی ناهنجاری‌ها گزارش کرده‌اند و پرهیز در سه‌ماههٔ نخست را مطرح می‌کنند؛ برای دکسترومتورفان افزایش مورد انتظار خطر ناهنجاری گزارش نشده است.",
        "review_limit_fa": "عبارت «می‌تواند منجر شود» بیش‌ازحد قطعی است و داده‌ها رابطهٔ قطعی را ثابت نمی‌کنند؛ پیش از هر تغییر، بازنویسی متن یا تأیید بالینی مستقل لازم است.",
        "reference_ids": ["mothertobaby_pseudoephedrine"],
    },
    (27, 198): {
        "proposed_index": 2,
        "confidence_fa": "متوسط",
        "evidence_fa": "در سناریوی چاپ‌شده، بیمار پایدار است، توده ۲ سانتی‌متر، تیتر ۴۲۰۰ و مایع آزاد ندارد؛ این ویژگی‌ها با معیارهای متداول درمان دارویی با متوترکسات سازگارند و الزام فوری برای لاپاروسکوپی نشان نمی‌دهند.",
        "review_limit_fa": "نبود اطلاعات دربارهٔ ضربان جنینی، آزمایش‌های پایه و امکان پیگیری سرپایی، انتخاب نهایی بالینی را محدود می‌کند؛ این صرفاً پیشنهاد آزمونیِ مشروط است.",
        "reference_ids": ["figo_ectopic"],
    },
}

UNRESOLVED = {
    (25, 98): {
        "route": "needs_editorial_rewrite",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "کموز، فوتوفوبی و حس جسم خارجی همگی می‌توانند در طیف کونژونکتیویت ویروسی، به‌ویژه درگیری قرنیه، دیده شوند. هیچ گزینه‌ای به‌تنهایی «کمتر به نفع ویروس» نیست.",
        "next_step_fa": "پس از مجوز مستقل، پرسش به یک یافتهٔ افتراق‌دهندهٔ روشن مانند ترشح چرکی یا یافتهٔ معاینه‌ای مشخص محدود شود.",
        "reference_ids": ["merck_conjunctivitis"],
    },
    (25, 145): {
        "route": "needs_editorial_rewrite",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "عبارت «ایمنی بیشتری» معیار قابل سنجش، بازهٔ زمانی یا نوع ایمنی را مشخص نمی‌کند؛ مقایسهٔ چهار واکسن با این عبارت پاسخ یکتا نمی‌سازد.",
        "next_step_fa": "پس از مجوز مستقل، نوع ایمنی مورد نظر و دورهٔ پیگیری مشخص شود یا پرسش با یک گزارهٔ قابل راستی‌آزمایی جایگزین گردد.",
        "reference_ids": [],
    },
    (27, 150): {
        "route": "needs_editorial_rewrite",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "راهنمای غربالگری پوکی استخوان، هم سیگار و هم مصرف زیاد الکل را عامل خطر می‌داند؛ بنابراین پرسش تک‌پاسخ نیست.",
        "next_step_fa": "پس از مجوز مستقل، سن، شدت مواجهه و منظور پرسش روشن یا گزینه‌ها طوری بازنویسی شوند که فقط یک عامل خطر معتبر بماند.",
        "reference_ids": ["uspstf_osteoporosis"],
    },
    (27, 169): {
        "route": "needs_editorial_rewrite",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "گزینهٔ چهارم به متن نامرتبط دفترچه آلوده شده و بیش از یک نشانهٔ عصبی در گزینه‌ها می‌تواند قطع فوری قرص ضدبارداری و ارزیابی را ایجاب کند؛ کلید یکتا ساخته نمی‌شود.",
        "next_step_fa": "پس از مجوز مستقل، متن گزینهٔ چهارم بازیابی یا بازنویسی و پرسش به یک نشانهٔ هشدار مشخص محدود شود.",
        "reference_ids": [],
    },
    (27, 179): {
        "route": "needs_editorial_rewrite",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "مدت پیگیری و پرهیز از بارداری پس از مول به نوع مول کامل یا ناقص وابسته است؛ صورت پرسش این تمایز را نمی‌دهد و ۶ یا ۱۲ ماه از راهنماهای مختلف می‌آیند.",
        "next_step_fa": "پس از مجوز مستقل، نوع مول، روش و نقطهٔ شروع پایش مشخص و سپس یک بازهٔ یکتا نوشته شود.",
        "reference_ids": ["figo_mole"],
    },
    (28, 25): {
        "route": "needs_editorial_rewrite",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "برای کیست ۶ سانتی‌متری در هفتهٔ دهم، تصمیم به شکل سونوگرافی، علائم و احتمال بدخیمی وابسته است. در متن فعلی این داده‌ها نیستند و پیگیری یا جراحی هر دو می‌توانند مطرح شوند.",
        "next_step_fa": "پس از مجوز مستقل، مشخصات سونوگرافی و وضعیت علائم افزوده شود؛ اگر خوش‌خیم و بی‌علامت فرض می‌شود، زمان پیگیری نیز صریح باشد.",
        "reference_ids": ["pregnancy_adnexal"],
    },
    (28, 50): {
        "route": "needs_editorial_rewrite",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "در زایمان پس از سزارین، ناهنجاری ضربان قلب جنین شایع‌ترین نشانهٔ پارگی رحم است، اما هیچ نوار یا الگوی جنینی در صورت سؤال نیست. تاکی‌کاردی مادر یک علامت غیر اختصاصی است و به‌تنهایی معیار یکتا برای سزارین اورژانس نیست.",
        "next_step_fa": "پس از مجوز مستقل، یک یافتهٔ مشخص جنینی یا مادری با زمینهٔ کافی افزوده و گزینه‌ها بر همان مبنا بازنویسی شوند.",
        "reference_ids": ["acog_tolerac"],
    },
    (23, 88): {
        "route": "needs_editorial_rewrite",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "در شیرخوار زیر ۱۸ ماه با مواجههٔ پیرامون تولد، تشخیص با آزمون مولکولی ویروس است، نه الایزا یا وسترن‌بلاتِ گزینه‌ها. بنابراین جابه‌جایی کلید، پرسش را امروزی نمی‌کند.",
        "next_step_fa": "پس از مجوز مستقل، زمان‌بندی آزمون مولکولی و وضعیت شیردهی یا پیشگیری دارویی در پرسش و گزینه‌ها بازنویسی شود.",
        "reference_ids": ["nih_infant_hiv"],
    },
    (24, 58): {
        "route": "needs_editorial_rewrite",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "حساسیت به تخم‌مرغ به‌تنهایی منع واکسن آنفلوانزا نیست و گزینه‌های قدیمی دربارهٔ واکسن خوراکی فلج اطفال نیز انتخاب امروزی و یکتایی نمی‌سازند.",
        "next_step_fa": "پس از مجوز مستقل، سن کودک، برنامهٔ واکسیناسیون مورد نظر و منع واقعی واکسن در متن و گزینه‌ها روشن شود.",
        "reference_ids": ["cdc_egg_allergy"],
    },
}


def question(part, number):
    payload = json.loads((BANK / f"import-payload.master-preint.part{part:02d}.json").read_text(encoding="utf-8"))
    return payload["questions"][number - 1]


def fingerprint(item, reason):
    text = "\n".join([
        item["tags"][0],
        item["question_fa"],
        *item["options_fa"],
        str(item["correct_index"]),
        reason,
    ])
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main():
    disputed = json.loads((DOCS / "round58-disputed-rows.json").read_text(encoding="utf-8"))
    outdated = json.loads((DOCS / "round58-outdated-rows.json").read_text(encoding="utf-8"))
    open_outdated = [row for row in outdated["rows"] if not row["apply"]]
    source_rows = [("disputed", row, row["open_question_fa"]) for row in disputed["rows"]]
    source_rows.extend(("outdated_open", row, row["note_fa"]) for row in open_outdated)
    expected = {(row["part"], row["local_question"]) for _, row, _ in source_rows}
    assert len(source_rows) == 15
    assert set(CANDIDATES) | set(UNRESOLVED) == expected
    assert not (set(CANDIDATES) & set(UNRESOLVED))

    rows = []
    for origin, source, reason in source_rows:
        key = (source["part"], source["local_question"])
        item = question(*key)
        assert source["id"] in item["tags"], key
        assert item.get("image") is None and item.get("media") is None
        assert (item.get("micro") or {}).get("media") is None
        base = {
            "part": source["part"],
            "local_question": source["local_question"],
            "id": source["id"],
            "origin": origin,
            "current_index": item["correct_index"],
            "current_option_fa": item["options_fa"][item["correct_index"]],
            "original_open_reason_fa": reason,
            "content_mutation_allowed": False,
            "key_mutation_allowed": False,
            "requires_independent_second_review": True,
            "status": "reviewed_not_applied",
            "record_fingerprint_sha256": fingerprint(item, reason),
        }
        if key in CANDIDATES:
            spec = CANDIDATES[key]
            proposed = spec["proposed_index"]
            assert proposed != item["correct_index"]
            base.update({
                "review_route": "evidence_candidate_not_applied",
                "review_route_fa": "پیشنهاد مبتنی بر شواهد؛ اعمال‌نشده",
                "proposed_index": proposed,
                "proposed_option_fa": item["options_fa"][proposed],
                "confidence_fa": spec["confidence_fa"],
                "evidence_fa": spec["evidence_fa"],
                "review_limit_fa": spec["review_limit_fa"],
                "reference_ids": spec["reference_ids"],
                "next_step_fa": "پیش از هر اعمال، بازبینی مستقل بالینی و مجوز صریح کاربر لازم است؛ تا آن زمان کلید فعلی دست‌نخورده می‌ماند.",
            })
        else:
            spec = UNRESOLVED[key]
            base.update({
                "review_route": spec["route"],
                "review_route_fa": spec["route_fa"],
                "proposed_index": None,
                "proposed_option_fa": None,
                "confidence_fa": "نامشخص؛ پاسخ یکتا وجود ندارد",
                "evidence_fa": spec["evidence_fa"],
                "review_limit_fa": "جابه‌جایی کلید به‌تنهایی نقص را برطرف نمی‌کند.",
                "reference_ids": spec["reference_ids"],
                "next_step_fa": spec["next_step_fa"],
            })
        rows.append(base)

    assert len(rows) == 15
    assert sum(r["review_route"] == "evidence_candidate_not_applied" for r in rows) == 6
    assert sum(r["review_route"] == "needs_editorial_rewrite" for r in rows) == 9
    for row in rows:
        assert all(ref in REFERENCES for ref in row["reference_ids"]), row["id"]

    bundle = {
        "status": "reviewed_not_applied",
        "round": 60,
        "count": len(rows),
        "evidence_candidate_not_applied": 6,
        "needs_editorial_rewrite": 9,
        "authorization_fa": "این بسته صرفاً بازبینی شواهد است. هیچ کلید، پرسش، گزینه یا متن آموزشی تغییر نکرده و هیچ پیشنهاد آن برای اعمال آماده نیست.",
        "scope_fa": "۱۳ ردیف مورد اختلاف دور ۵۸ به‌همراه ۲ ردیف منسوخِ باز، با متن و گزینه‌های فعلی دوباره خوانده شدند.",
        "source_policy_fa": "پیوندها برای راستی‌آزمایی بالینی و آموزشی ثبت شده‌اند. منبع اصلی دفترچه بر آنها مقدم است و تصمیم درمانی فردی از این بسته استخراج نمی‌شود.",
        "references": REFERENCES,
        "rows": rows,
    }
    (DOCS / "round60-open-evidence.json").write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    brief = [
        "# دور ۶۰ — بررسی شواهد ۱۵ ردیف باز",
        "",
        "> این دور فقط بررسی است. هیچ `question_fa`، `options_fa`، `correct_index` یا متن آموزشی تغییر نکرده است.",
        "",
        "## جمع‌بندی",
        "",
        "| نتیجهٔ بازبینی | تعداد | وضعیت |",
        "| --- | ---: | --- |",
        "| پیشنهاد مبتنی بر شواهد، اما اعمال‌نشده | ۶ | بازبینی مستقل و مجوز صریح پیش از هر تغییر لازم است |",
        "| نیازمند بازنویسی تحریریه‌ای | ۹ | پاسخ یکتا با گزینه‌های موجود ساخته نمی‌شود |",
        "| **جمع** | **۱۵** | هیچ payloadی تغییر نکرده است |",
        "",
        "## یادداشت روش",
        "",
        "برای هر ردیف، متن و چهار گزینهٔ فعلی دوباره خوانده شد، سپس فقط منبع‌های راهنما برای سنجش سازگاری گزینه‌ها استفاده شدند. "
        "هیچ دادهٔ غایب ساخته نشد و هیچ پیشنهاد این گزارش در ابزار اعمال کلید دور ۵۸ وارد نشده است.",
        "",
    ]
    for row in rows:
        brief.extend([
            f"### {row['part']}:{row['local_question']} — {row['id']} ({row['review_route_fa']})",
            "",
            f"- کلید فعلی: {row['current_index']} — {row['current_option_fa']}",
            f"- علت بازبودن پیشین: {row['original_open_reason_fa']}",
            f"- نتیجهٔ بازبینی: {row['evidence_fa']}",
        ])
        if row["proposed_index"] is not None:
            brief.append(f"- پیشنهادِ اعمال‌نشده: {row['proposed_index']} — {row['proposed_option_fa']} (اطمینان: {row['confidence_fa']})")
        brief.extend([
            f"- محدودیت: {row['review_limit_fa']}",
            f"- گام بعدی: {row['next_step_fa']}",
        ])
        if row["reference_ids"]:
            brief.append("- منابع: " + "، ".join(f"[{ref}]({REFERENCES[ref]['url']})" for ref in row["reference_ids"]))
        brief.extend(["", ""])
    brief.extend([
        "## قاعدهٔ اعمال آینده",
        "",
        "- شش پیشنهاد این گزارش **تأییدشده برای اعمال نیستند**؛ فقط ورودی بازبینی مستقل بعدی‌اند.",
        "- نه ردیف دیگر با جابه‌جایی کلید درست نمی‌شوند و بازنویسی مستقل پرسش/گزینه می‌خواهند.",
        "- هر تغییر در کلید یا متن، به مجوز صریح کاربر در یک دور جدا نیاز دارد.",
        "",
    ])
    (HERE / "evidence-brief.md").write_text("\n".join(brief), encoding="utf-8")

    snapshot = [
        "# تصویر محافظت‌شدهٔ ۱۵ ردیف باز دور ۶۰",
        "",
        "> این فایل از payload فعلی خوانده شده و فقط برای بازبینی است؛ هیچ فیلدی را تغییر نمی‌دهد.",
        "",
    ]
    for row in rows:
        item = question(row["part"], row["local_question"])
        snapshot.extend([
            f"## {row['part']}:{row['local_question']} — {row['id']}",
            "",
            f"- مسیر: {row['review_route_fa']}",
            f"- کلید فعلی: {row['current_index']} — {row['current_option_fa']}",
            f"- اثرانگشت محافظت‌شده: `{row['record_fingerprint_sha256']}`",
            f"- علت بازبودن: {row['original_open_reason_fa']}",
            "",
            f"**پرسش فعلی:** {item['question_fa']}",
            "",
            "**گزینه‌های فعلی:**",
            *[f"{index}. {option}" for index, option in enumerate(item["options_fa"])],
            "",
            f"**متن آموزشی فعلی:** {item['explanation_fa']}",
            "",
            "---",
            "",
        ])
    (HERE / "open-records.md").write_text("\n".join(snapshot), encoding="utf-8")
    print("reviewed 15 rows: 6 evidence candidates / 9 editorial rewrites; nothing applied")


if __name__ == "__main__":
    main()
