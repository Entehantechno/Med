# -*- coding: utf-8 -*-
"""Build the round59 content-recovery review without changing a bank payload.

Round 58 established that these 27 rows cannot be repaired by moving a key.
This script freezes a review-only route for every row: either recover a missing
source artifact or authorize a clinically reviewed editorial rewrite.  It does
not write question_fa, options_fa, correct_index, or educational fields.
"""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PROJ = ROOT / ".work" / "proj"
DOCS = PROJ / "docs"
BANK = PROJ / "tools" / "master-bank"

ARCHIVE_INDEX = (
    "https://www.medqb.ir/"
    "%D8%B3%D9%88%D8%A7%D9%84%D8%A7%D8%AA-%D8%A2%D8%B2%D9%85%D9%88%D9%86-"
    "%D9%BE%DB%8C%D8%B4-%DA%A9%D8%A7%D8%B1%D9%88%D8%B1%D8%B2%DB%8C-"
    "%D9%BE%D8%B2%D8%B4%DA%A9%DB%8C"
)

# This is deliberately a remediation route, not replacement question text.
# Writing a new stem or option belongs to a separately authorized content round.
CURATION = {
    (22, 142): {
        "route": "source_artifact_required",
        "route_fa": "بازیابی منبع",
        "evidence_fa": "جدول انعقادیِ ارجاع‌شده در پرسش موجود نیست؛ علائم به‌تنهایی میان اختلالات فاکتوری، فون‌ویلبراند و اختلال عملکرد پلاکت تمایز قطعی نمی‌دهند.",
        "next_step_fa": "تصویر یا جدول آزمایش اصلی شامل شمارش پلاکت و شاخص‌های انعقادی از دفترچه دریافت و سپس با کلید چاپی تطبیق داده شود.",
    },
    (22, 145): {
        "route": "source_artifact_required",
        "route_fa": "بازیابی منبع",
        "evidence_fa": "پرسش صریحاً به نمودار رشد ارجاع می‌دهد، اما نمودار و نوع مرجع رشد در رکورد نیست.",
        "next_step_fa": "تصویر نمودار رشدِ همان دفترچه، همراه با جنس کودک و محور مورد سؤال، بازیابی شود؛ از حدس‌زدن صدک پرهیز شود.",
    },
    (23, 68): {
        "route": "source_artifact_required",
        "route_fa": "بازیابی منبع",
        "evidence_fa": "خصوصیات تعیین‌کنندهٔ تودهٔ سر نوزاد حذف شده است؛ زمان شروع، عبور از درزها و تغییر اندازه در متن حاضر نیست.",
        "next_step_fa": "بخشِ «به شرح زیر» از دفترچه بازیابی شود تا سفال‌هماتوم، خون‌ریزی زیرگاله‌آ و کاپوت بر پایهٔ دادهٔ واقعی افتراق یابند.",
    },
    (23, 77): {
        "route": "source_artifact_required",
        "route_fa": "بازیابی منبع",
        "evidence_fa": "تصمیم میان اکسیژن، فشار مثبت پیوسته و تهویهٔ مکانیکی به مقادیر گاز خون و شیوهٔ اکسیژن‌رسانی وابسته است؛ هر دو حذف شده‌اند.",
        "next_step_fa": "جدول کامل گاز خون شریانی و مقدار اکسیژنِ هم‌زمان از منبع اصلی بازیابی و سپس اقدام تنفسی دوباره ارزیابی شود.",
    },
    (23, 102): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "در پرسشِ ویسکوت–آلدریچ بیش از یک گزینهٔ «صحیح نیست» است؛ تغییر کلید به‌تنهایی تک‌پاسخ‌بودن را بازنمی‌گرداند.",
        "next_step_fa": "پس از مجوز مستقل، هدف آموزشی و جهت پرسش بازنویسی و گزینه‌ها به‌گونه‌ای تنظیم شوند که فقط یک گزاره نادرست باقی بماند.",
    },
    (23, 144): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "دو گزینهٔ سنیِ دو و چهار ماه برای مهارت‌های ذکرشده ناممکن‌اند و هیچ گزینهٔ چاپ‌شده‌ای با پاسخ تکاملیِ قابل دفاع سازگار نیست.",
        "next_step_fa": "پس از مجوز مستقل، سن‌ها و صورت مهارت‌ها با یک مرجع تکاملی واحد بازنویسی و یک پاسخ یکتا ایجاد شود.",
    },
    (23, 152): {
        "route": "source_artifact_required",
        "route_fa": "بازیابی منبع",
        "evidence_fa": "پرسش برای افتراق سینوویت گذرا از آرتریت سپتیک به آزمایش‌های غایب ارجاع دارد؛ یافتهٔ بالینیِ موجود به‌تنهایی کافی نیست.",
        "next_step_fa": "مقادیر آزمایشِ ردیف یا تصویر کامل دفترچه بازیابی شود؛ هیچ مقدار آزمایشگاهی ساخته نشود.",
    },
    (23, 163): {
        "route": "source_artifact_required",
        "route_fa": "بازیابی منبع",
        "evidence_fa": "گزینهٔ کلیدی تنها «۱۵» است و نام مهارت تکاملی ندارد؛ تکمیل آن با حدس می‌تواند پاسخ را عوض کند.",
        "next_step_fa": "متن کامل همان گزینه از دفترچه بازیابی و پیش از هر اقدام با سایر نقاط عطف تکاملی تطبیق داده شود.",
    },
    (23, 176): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "هر چهار سناریو آستانهٔ بررسی نقص ایمنی را دارند؛ بنابراین پرسشِ «به‌جز» پاسخ یکتایی ندارد.",
        "next_step_fa": "پس از مجوز مستقل، آستانه‌ها یا جهت پرسش بازنویسی شوند تا فقط یک گزینه از معیار بررسی خارج باشد.",
    },
    (24, 48): {
        "route": "source_artifact_required",
        "route_fa": "بازیابی منبع",
        "evidence_fa": "نتایج انعقادیِ وعده‌داده‌شده در پرسش نیست؛ شرح خون‌ریزی مخاطی میان تشخیص‌های گزینه‌ها به‌تنهایی کافی نیست.",
        "next_step_fa": "جدول آزمایش شامل شمارش پلاکت و آزمون‌های انعقادی از دفترچه دریافت و سپس تشخیص و کلید بازبینی شود.",
    },
    (24, 50): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "در الگوی نفریتیِ پس از گلودرد، بیش از یک شاخص آزمایشگاهی با آسیب پیش‌کلیوی سازگار است، اما گزینهٔ کلیدی الگوی آسیب توبولی را می‌گوید.",
        "next_step_fa": "پس از مجوز مستقل، هدف تشخیصی و گزینه‌ها با یک سناریوی آزمایشگاهیِ یکتا بازنویسی شوند؛ جابه‌جایی کلید کافی نیست.",
    },
    (24, 66): {
        "route": "source_artifact_required",
        "route_fa": "بازیابی منبع",
        "evidence_fa": "کل پرسش به شجره‌نامه وابسته است و هیچ تصویر یا توصیف متنی از آن در رکورد وجود ندارد.",
        "next_step_fa": "تصویر شجره‌نامهٔ دفترچه بازیابی شود؛ سپس الگوی انتقال و کلید فقط بر پایهٔ همان شکل بررسی شوند.",
    },
    (24, 171): {
        "route": "source_artifact_required",
        "route_fa": "بازیابی منبع",
        "evidence_fa": "مقادیر آزمون‌های تیروئید حذف شده‌اند و میان کمبود یا افزایش پروتئین حامل و کم‌کاری اولیه/ثانویه تمایز ممکن نیست.",
        "next_step_fa": "جدول کامل آزمون‌های تیروئید از دفترچه بازیابی و با الگوی هورمونی مناسب تطبیق داده شود.",
    },
    (24, 193): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "دوز ویتامین آ فاقد واحد، راه تجویز و فاصلهٔ دوز است و بازه‌های گزینه‌ها هم‌پوشانی دارند؛ پاسخ یکتا ساخته نمی‌شود.",
        "next_step_fa": "پس از مجوز مستقل، سن یا وزن، واحد، راه تجویز و برنامهٔ دوز بر پایهٔ یک راهنمای مشخص افزوده و گزینه‌ها بدون هم‌پوشانی بازنویسی شوند.",
    },
    (24, 201): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "با سابقهٔ مرگ مشکوک به نقص ایمنی سلولی، گزینهٔ واکسن زنده با اصل احتیاط ناسازگار است و هیچ گزینه‌ای اقدام ایمن و دقیق را جدا نمی‌کند.",
        "next_step_fa": "پس از مجوز مستقل، پرسش با زمان‌بندی واکسن‌ها و اقدام ارجاعیِ روشن بازنویسی شود؛ از تثبیت گزینهٔ واکسن زنده پرهیز شود.",
    },
    (25, 27): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "چند گزاره دربارهٔ پاسخ زمانی به درمان کم‌خونی فقر آهن می‌توانند درست باشند و ترتیب زمانی گزینه‌ها نیز مخدوش است.",
        "next_step_fa": "پس از مجوز مستقل، پرسش به یک شاخص زمانی مشخص محدود و بازه‌های زمانی گزینه‌ها بر اساس همان شاخص بازنویسی شوند.",
    },
    (25, 31): {
        "route": "source_artifact_required",
        "route_fa": "بازیابی منبع",
        "evidence_fa": "انتخاب بیماری فقط با شجره‌نامهٔ غایب ممکن است و متن جایگزین برای شکل وجود ندارد.",
        "next_step_fa": "تصویر شجره‌نامهٔ اصلی بازیابی و سپس با الگوی انتقال هر چهار گزینه تطبیق داده شود.",
    },
    (25, 93): {
        "route": "source_artifact_required",
        "route_fa": "بازیابی منبع",
        "evidence_fa": "شجره‌نامهٔ مورد اشاره حذف شده است؛ نام بیماری را نمی‌توان از متن فعلی استنتاج کرد.",
        "next_step_fa": "تصویر شجره‌نامهٔ اصلی بازیابی و قبل از هر ویرایش، ویژگی‌های انتقال آن ثبت شود.",
    },
    (25, 94): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "محاسبهٔ مایع در هایپرناترمی به فرض‌های اعلام‌نشده دربارهٔ کسری آب، هدف سدیم و احتساب بولوس وابسته است؛ داده‌ها جواب عددی یکتا نمی‌دهند.",
        "next_step_fa": "پس از مجوز مستقل، پارامترهای محاسبه و هدف درمانی صریح شوند و فقط یک پاسخ عددی حاصل شود.",
    },
    (25, 96): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "در سناریوی زوستر مادر، بیش از یک ترکیب درمان یا پیشگیری می‌تواند قابل دفاع باشد و گزینه‌ها اقدام مادر و نوزاد را درهم می‌آمیزند.",
        "next_step_fa": "پس از مجوز مستقل، زمان‌بندی ضایعات نسبت به زایمان و گروه خطر نوزاد مشخص و پرسش به یک اقدام اصلی محدود شود.",
    },
    (25, 126): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "سن‌ها و نشانه‌های بازه در گزینه‌ها مخدوش‌اند و ادعای وزن‌گیری نیز واحد و مرجع روشنی ندارد.",
        "next_step_fa": "پس از مجوز مستقل، همهٔ عددها، واحدها و بازه‌های سنی با یک جدول رشد مرجع بازنویسی و گزینهٔ نادرست یکتا شود.",
    },
    (25, 136): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "دو گزینهٔ پایانی عیناً تکراری‌اند؛ بنابراین حتی در صورت درست بودن بازه، پرسش تک‌پاسخ باقی نمی‌ماند.",
        "next_step_fa": "پس از مجوز مستقل، گزینهٔ تکراری حذف یا با یک بازهٔ متمایز جایگزین و بازهٔ سرایت بر اساس منبع واحد بازبینی شود.",
    },
    (25, 173): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "داکتیلیت با هر دو تشخیص داسی و داسی–تالاسمی سازگار است و سابقهٔ تزریق خونِ موجود تمایز یکتایی نمی‌سازد.",
        "next_step_fa": "پس از مجوز مستقل، یافتهٔ افتراق‌دهندهٔ معتبر یا نتیجهٔ آزمایش افزوده شود تا یک تشخیص باقی بماند.",
    },
    (28, 87): {
        "route": "source_artifact_required",
        "route_fa": "بازیابی منبع",
        "evidence_fa": "مقادیر اسپرموگرام حذف شده‌اند؛ طبیعی بودن، نیاز به تکرار و انتخاب روش کمک‌باروری بدون آنها تعیین نمی‌شود.",
        "next_step_fa": "جدول کامل اسپرموگرام و شرایط نمونه‌گیری از دفترچه بازیابی و سپس گام بعدی بررسی شود.",
    },
    (28, 91): {
        "route": "source_artifact_required",
        "route_fa": "بازیابی منبع",
        "evidence_fa": "بخش تعیین‌کنندهٔ ترجیح باروری و متن پایانیِ سناریو در استخراج موجود نیست؛ نسبت گزینهٔ «بارداری» با مسئله روشن نیست.",
        "next_step_fa": "صفحهٔ کامل دفترچه بازیابی شود؛ پیش از هر اقدام باید هدف باروری و متن پایان پرسش روشن باشد.",
    },
    (28, 113): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "هم سابقهٔ جراحی رحم و هم خون‌ریزی روشنِ بدون درد در نیمهٔ دوم با جفت سرراهی سازگارند؛ پرسشِ «کدام صحیح است» دو پاسخ دارد.",
        "next_step_fa": "پس از مجوز مستقل، پرسش به یک محور، مانند عامل خطر یا تظاهر بالینی، محدود و سایر گزینه‌ها بازنویسی شوند.",
    },
    (28, 118): {
        "route": "editorial_rewrite_required",
        "route_fa": "بازنویسی تحریریه‌ای",
        "evidence_fa": "در مرگ داخل‌رحمی جنین چند گزینه قابل بحث یا درست‌اند و کلید فعلی ادعای علت غالب را بدون پشتوانهٔ کافی تثبیت می‌کند.",
        "next_step_fa": "پس از مجوز مستقل، زمان مرگ، پرسش تشخیصی یا روش ختم به‌صورت جداگانه و با یک پاسخ یکتا بازنویسی شود.",
    },
}


def fingerprint(question, defect):
    """A stable guard for the protected row fields reviewed in this round."""
    text = "\n".join([
        question["tags"][0],
        question["question_fa"],
        *question["options_fa"],
        str(question["correct_index"]),
        defect,
    ])
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_question(part, number):
    payload = json.loads((BANK / f"import-payload.master-preint.part{part:02d}.json").read_text(encoding="utf-8"))
    return payload["questions"][number - 1]


def main():
    broken = json.loads((DOCS / "round58-broken-rows.json").read_text(encoding="utf-8"))
    expected = {(row["part"], row["local_question"]) for row in broken["rows"]}
    assert set(CURATION) == expected, (set(CURATION) ^ expected)

    rows = []
    routes = {"source_artifact_required": 0, "editorial_rewrite_required": 0}
    for source in broken["rows"]:
        key = (source["part"], source["local_question"])
        spec = CURATION[key]
        question = load_question(*key)
        assert source["id"] in question["tags"], key
        assert question.get("image") is None, key
        assert question.get("media") is None, key
        assert (question.get("micro") or {}).get("media") is None, key
        routes[spec["route"]] += 1
        rows.append({
            "part": source["part"],
            "local_question": source["local_question"],
            "id": source["id"],
            "current_index": question["correct_index"],
            "current_option_fa": question["options_fa"][question["correct_index"]],
            "defect_fa": source["defect_fa"],
            "route": spec["route"],
            "route_fa": spec["route_fa"],
            "evidence_fa": spec["evidence_fa"],
            "next_step_fa": spec["next_step_fa"],
            "authorization_required_fa": "هرگونه تغییر متن پرسش، گزینه‌ها یا کلید فقط با مجوز مستقل و صریح کاربر در یک دور جدا مجاز است.",
            "content_mutation_allowed": False,
            "status": "reviewed_not_applied",
            "archive_locator": ARCHIVE_INDEX,
            "record_fingerprint_sha256": fingerprint(question, source["defect_fa"]),
        })

    assert routes == {"source_artifact_required": 13, "editorial_rewrite_required": 14}, routes
    result = {
        "status": "reviewed_not_applied",
        "round": 59,
        "count": len(rows),
        "source_artifact_required": routes["source_artifact_required"],
        "editorial_rewrite_required": routes["editorial_rewrite_required"],
        "authorization_fa": "این بسته فقط بررسی و مسیر اصلاح است. هیچ سؤال، گزینه، کلید یا متن آموزشی تغییر نکرده است.",
        "local_source_audit_fa": "برای هر ۲۷ ردیف، سه محل رسانه‌ای رکورد بررسی شد: image، media و micro.media. هر سه در همهٔ ردیف‌ها خالی‌اند؛ بنابراین دادهٔ غایب از فایل‌های فعلی ساخته نشد.",
        "external_archive_note_fa": "نشانی آرشیو فقط راهنمای یافتن دفترچهٔ ثانویه است، نه مجوزِ بازنویسی یا دلیل کافی برای اعمال تغییر. منبع اصلی یا دفترچهٔ دارای مجوز بر آن مقدم است.",
        "rows": rows,
    }
    (DOCS / "round59-broken-recovery.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    brief = [
        "# دور ۵۹ — بررسی مسیر بازیابی ۲۷ ردیف نیازمند بازنویسی",
        "",
        "> این دور فقط بررسی است: هیچ `question_fa`، `options_fa`، `correct_index` یا متن آموزشی تغییر نکرده است.",
        "",
        "## نتیجهٔ عددی",
        "",
        "| مسیر ایمن | تعداد | اقدام لازم |",
        "| --- | ---: | --- |",
        "| بازیابی منبع | ۱۳ | صفحه، جدول، شکل یا ادامهٔ متنِ اصلی لازم است |",
        "| بازنویسی تحریریه‌ای | ۱۴ | مجوز مستقل برای تغییر پرسش/گزینه و بازبینی بالینی لازم است |",
        "| **جمع** | **۲۷** | همه در صف باقی می‌مانند |",
        "",
        "## کنترل منبع محلی",
        "",
        "برای هر ۲۷ رکورد، فیلدهای `image`، `media` و `micro.media` بررسی شد و همگی خالی بودند. "
        "فایل‌های بارگذاری‌شدهٔ موجود نیز به دفترچه‌های ۱۴۰۲ و ۱۴۰۳ مربوط‌اند، نه این ردیف‌های ۱۳۹۳ تا ۱۳۹۷. "
        "بنابراین هیچ جدول، نمودار، شجره‌نامه، گاز خون یا اسپرموگرام از خودِ مخزن ساخته یا حدس زده نشد.",
        "",
        "## مسیر هر ردیف",
        "",
    ]
    for row in rows:
        brief.extend([
            f"### {row['part']}:{row['local_question']} — {row['id']} ({row['route_fa']})",
            "",
            f"- مسئله: {row['defect_fa']}",
            f"- نتیجهٔ بازبینی: {row['evidence_fa']}",
            f"- گام بعدی: {row['next_step_fa']}",
            "",
        ])
    brief.extend([
        "## قاعدهٔ اعمال آینده",
        "",
        "- برای ۱۳ ردیف بازیابی منبع، نخست تصویر یا صفحهٔ اصلی لازم است؛ بدون آن تغییر داده نمی‌شود.",
        "- برای ۱۴ ردیف تحریریه‌ای، تغییر کلید کافی نیست. بازنویسی مستقلِ پرسش و گزینه‌ها و بازبینی بالینی لازم است.",
        "- این مجوز از بستهٔ اصلاح کلید دور ۵۸ جداست. تا مجوز صریح داده نشود، همهٔ ۲۷ ردیف در صف باقی می‌مانند.",
        "- شناساگر آرشیو ثانویه: " + ARCHIVE_INDEX,
        "",
    ])
    (HERE / "content-recovery-brief.md").write_text("\n".join(brief), encoding="utf-8")

    snapshot = [
        "# تصویر محافظت‌شدهٔ ۲۷ ردیف دور ۵۹",
        "",
        "> این فایل از payload فعلی خوانده شده و فقط برای بازبینی است؛ هیچ فیلدی را تغییر نمی‌دهد.",
        "",
    ]
    for review in rows:
        question = load_question(review["part"], review["local_question"])
        snapshot.extend([
            f"## {review['part']}:{review['local_question']} — {review['id']}",
            "",
            f"- مسیر: {review['route_fa']}",
            f"- کلید فعلی: {review['current_index']} — {review['current_option_fa']}",
            f"- اثرانگشت محافظت‌شده: `{review['record_fingerprint_sha256']}`",
            f"- نقص: {review['defect_fa']}",
            "",
            f"**پرسش فعلی:** {question['question_fa']}",
            "",
            "**گزینه‌های فعلی:**",
            *[f"{index}. {option}" for index, option in enumerate(question["options_fa"])],
            "",
            f"**متن آموزشی فعلی:** {question['explanation_fa']}",
            "",
            "---",
            "",
        ])
    (HERE / "broken-records.md").write_text("\n".join(snapshot), encoding="utf-8")
    print(f"reviewed {len(rows)} rows: {routes['source_artifact_required']} source / {routes['editorial_rewrite_required']} editorial")


if __name__ == "__main__":
    main()
