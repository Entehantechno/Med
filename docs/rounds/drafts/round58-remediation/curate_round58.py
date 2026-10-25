#!/usr/bin/env python3
"""Second-pass curation of the round56 key proposals (nothing is applied).

The extraction script turns the audit tables into JSON; this script adds the
reviewer's own clinical verdict on top, decides the six guideline-drift
("outdated") rows that the audit had left open, and flags option texts that
carry garbled Latin fragments so an approved key fix is not mistaken for a
clean question.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / '.work/proj/docs'
BANK = ROOT / '.work/proj/tools/master-bank'

# Rows the reviewer read end-to-end against the printed stem; the entry records
# what the reviewer checked, not a new proposal.
NOTES = {
    (23, 98): ('verified', 'متن کامل پرسش «کمترین نقش» است و کریگلر نجار با کلستاز و فشار پورت همخوان نیست؛ کلید فعلی (اختلالات متابولیک) نادرست است.'),
    (27, 133): ('verified', 'شوک سپتیک (BP=90/50، PR=110) با سابقهٔ سقط غیرقانونی؛ اولین گام شروع آنتی‌بیوتیک وریدی است.'),
    (27, 154): ('verified', 'پرسش «اندیکاسیون ندارد» است؛ تأخیر تخلیه تا افت تب بدون اندیکاسیون است.'),
    (29, 191): ('verified', 'پرسش علل مستعدکنندهٔ پرزانتاسیون است؛ جفت سرراهی در خود متن آمده و پاسخ مستند الیگوهیدرآمنیوس است.'),
    (27, 141): ('verified', '«LH» کوتاه بود و فیلتر تطابق را رد کرد؛ دستی بازبینی شد و پیشنهاد درست است.'),
    (27, 204): ('verified', 'خانهٔ پیشنهاد «—» بود و شمارهٔ گزینه از استدلال خوانده شد؛ آسیکلوویر درمان هرپس تناسلی است.'),
    (27, 163): ('verified', 'گزینهٔ ۳ متن مخدوش «سلlatent» دارد و پیش از هر استفادهٔ آموزشی نیازمند اصلاح متن گزینه است.'),
    (27, 160): ('verified', 'تصویر بوتولیسم (دوبینی، پتوز، دیسفاژی و ضعف نزولی) پس از کنسرو ماهی؛ آنتی‌توکسین و آمادگی انتوباسیون.'),
    (27, 167): ('verified', 'حساسترین روش در سکتهٔ حاد، MRI با تصویربرداری نشر انتشار است.'),
    (28, 30): ('verified', 'تاکی‌کاردی با کمپلکس باریک و منظم در بیمار جوان بدون سابقهٔ قلبی، اندیکاسیون آدنوزین است.'),
}

# Guideline-drift rows: the printed key follows the pre-2015 meconium rule.
OUTDATED_DECISIONS = {
    (24, 102): (1, 'verified', 'راهنمای امروز در نوزاد آغشته به مکونیوم و غیرفعال، تهویه با بگ و ماسک را پیش از لوله‌گذاری می‌داند.'),
    (24, 113): (0, 'verified', 'همان الگوی ردیف ۱۰۲؛ گزینهٔ ۰ تهویه با ماسک و بگ است.'),
    (24, 123): (0, 'verified', 'همان الگوی ردیف ۱۰۲؛ گزینهٔ ۰ تهویه با بگ و ماسک است.'),
    (24, 147): (1, 'verified', 'نوزاد پست‌ترم بدون تنفس؛ تهویه با فشار مثبت گزینهٔ ۱ است.'),
    (24, 213): (2, 'review', 'گزینهٔ ۲ «شروع تنفس با بگ و ماسک» است؛ اگر پرسش اقدام‌های گام نخست را بخواهد، تحریک (گزینهٔ ۱) نیز قابل بحث است.'),
    (25, 149): (3, 'verified', 'ضربان ۴۰ و بدون تنفس خودبخودی؛ شروع تهویه با فشار مثبت گزینهٔ ۳ است.'),
    (24, 58): (None, 'review', 'کلید فعلی آنفلوانزا با راهنمای امروز همخوان نیست (منع مطلق تخم‌مرغ برداشته شده) و OPV نیز از برنامهٔ کشوری حذف شده است؛ اصلاح این ردیف نیازمند بازنویسی گزینه‌ها است.'),
    (23, 88): (None, 'review', 'کلید فعلی («الیزا پس از ۴ ماه») قابل دفاع است ولی چارچوب تشخیص با آزمون مولکولی امروز منسوخ شده؛ کلید جابه‌جا نمی‌شود.'),
}

ACRONYMS = {'MRI', 'CT', 'LH', 'TSH', 'C4', 'C3', 'IgE', 'HPV', 'HIV', 'hCG', 'PH', 'OCP', 'IU', 'IUD', 'FSH',
            'BMI', 'OPV', 'DTP', 'MMR', 'GCT', 'GTT', 'AF', 'CMV', 'BP', 'PR', 'TAH', 'BSO', 'ICU', 'MRI',
            'Podophyllin', 'latent', 'prolactin', 'Cefepime', 'Vancomycin', 'clindamycin', 'Ciprofloxacin'}


def latin_fragments(text):
    return [tok for tok in re.findall(r'[A-Za-z]{3,}', text) if tok not in ACRONYMS]


def main():
    proposals = json.loads((DOCS / 'round58-key-proposals.json').read_text(encoding='utf-8'))
    payloads = {}

    def options(part, number):
        if part not in payloads:
            payloads[part] = json.loads((BANK / f'import-payload.master-preint.part{part:02d}.json').read_text(encoding='utf-8'))
        return payloads[part]['questions'][number - 1]

    for entry in proposals['proposals']:
        key = (entry['part'], entry['local_question'])
        note = NOTES.get(key)
        if note:
            entry['status'], entry['reviewer_note_fa'] = note
        entry['option_text_defects'] = sorted({
            token for index, option in enumerate(options(*key)['options_fa'])
            for token in latin_fragments(option)
        })
        assert entry['proposed_index'] is not None
        assert 0 <= entry['proposed_index'] <= 3
        assert entry['proposed_index'] != entry['current_index'], key

    reviewed = [e for e in proposals['proposals'] if 'reviewer_note_fa' in e]
    proposals['review_pass'] = {
        'reviewer': 'round58 manual second pass (stem + all four options read)',
        'rows_reviewed_in_full': len(reviewed),
        'notes': {f"{e['part']}:{e['local_question']}": e['reviewer_note_fa'] for e in reviewed},
        'verdict': 'all 58 proposals stand; two of them were re-exported by hand because the audit phrase was too short to auto-match',
    }
    (DOCS / 'round58-key-proposals.json').write_text(
        json.dumps(proposals, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    outdated = json.loads((DOCS / 'round58-outdated-rows.json').read_text(encoding='utf-8'))
    for row in outdated['rows']:
        key = (row['part'], row['local_question'])
        if key in OUTDATED_DECISIONS:
            index, status, note = OUTDATED_DECISIONS[key]
            row['proposed_index'] = index
            row['status'] = status
            row['reviewer_note_fa'] = note
            row['apply'] = index is not None
        else:
            row['status'] = 'review'
            row['apply'] = False
    outdated['decided'] = sum(1 for r in outdated['rows'] if r.get('apply'))
    outdated['open'] = sum(1 for r in outdated['rows'] if not r.get('apply'))
    (DOCS / 'round58-outdated-rows.json').write_text(
        json.dumps(outdated, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    printable = sum(1 for e in proposals['proposals'] if e['status'] == 'verified')
    print(f"proposals: {len(proposals['proposals'])} (verified {printable})")
    print(f"outdated: ready {outdated['decided']} / open {outdated['open']}")
    print(f"rows with option-text defects: {sum(1 for e in proposals['proposals'] if e['option_text_defects'])}")


if __name__ == '__main__':
    main()
