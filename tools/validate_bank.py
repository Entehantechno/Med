# -*- coding: utf-8 -*-
"""Shared quality gate for every MED School question bank.

Grew out of the infectious-bank validator after it caught a genuine
two-correct-answer defect. Both banks emit the same payload shape, so the same
checks apply; this version takes any number of payload files (the neurology bank
is split into seven parts) and reports per-bank.

    python3 validate_bank.py NAME payload1.json [payload2.json ...]

Exit code 1 on any error, so it can gate a release.
"""
import json, io, re, os, sys, collections

DIG = str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789')


def norm(s):
    s = (s or '').translate(DIG)
    s = s.replace('\u200c', '').replace('ي', 'ی').replace('ك', 'ک')
    s = re.sub(r'[^\w\s]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def tri(s):
    return {s[i:i + 3] for i in range(len(s) - 2)}


# A distractor rationale may concede the option is partly right ("the drug is
# correct but the dose is wrong") — that is a legitimate rejection. What must
# never happen is a concession with no rebuttal, because that means the question
# has two defensible answers.
CONCEDE = ('رژیم درستی است', 'گزینه‌ی درستی است', 'هم درست است', 'نیز صحیح است',
           'هم صحیح است', 'درست است', 'صحیح است', 'قابل قبول است', 'مؤثر است')
# Words that genuinely take the concession back. Deliberately excludes "ترجیح"
# (preferred) and similar praise: "it is a valid regimen and is PREFERRED in
# pregnancy" concedes a second correct answer rather than rejecting one.
REJECT = ('ولی', 'اما', 'نیست', 'نادرست', 'اشتباه', 'غلط', 'بجز', 'کافی نیست',
          'توصیه نمی', 'بیش‌درمانی', 'خطرناک', 'نه ', 'بی‌مورد', 'کنترااندیکه',
          'ناکافی', 'رد می‌شود', 'انتخاب اول نیست', 'به‌ندرت', 'پایین',
          'کمتر', 'ندارد', 'نمی', 'فقط', 'مگر', 'در حالی که', 'برعکس',
          'اختصاصی‌تر', 'دقیق‌تر', 'ممنوع', 'بی‌اثر', 'تفاوت با کلید')


# A "negative" item asks which option is FALSE / does not apply / is the
# exception. Detected from the declared style or from the stem wording, since
# older payloads do not always set question_style.
NEG_PAT = re.compile(
    'نمی‌باشد|نمیباشد|صحیح نیست|درست نیست|نادرست است|غلط است|کدام غلط|'
    'بجز|به‌جز|به جز|جز مورد|نادرست کدام|اشتباه است|EXCEPT|except|'
    'صحیح نمی‌باشد|نیست\\s*؟|کدام.{0,20}نمی|نمی‌پذیرید|نمیپذیرید|'
    'نمی‌گردد|نمیگردد|کاربردی ندارد|ندارد\\s*؟|محسوب نمی|توصیه نمی|'
    'انتخاب اول نیست|نمیشود|نمی‌شود|منع مصرف|کدام.{0,25}ندارد|کدام.{0,25}نیست|'
    'نادرست[^؟]{0,45}است|به غیر|به ?وز'
)


def is_negative(q):
    if (q.get('question_style') or '') == 'negative':
        return True
    return bool(NEG_PAT.search(q.get('question_fa') or ''))


def check(name, paths, min_points=10, near_dup=0.80):
    qs = []
    for p in paths:
        body = json.load(io.open(p, encoding='utf-8'))
        qs += body['questions']

    errors, warns = [], []

    def tag(q):
        return f"{q.get('year','?')}-{q.get('month','?')} q{q.get('question_no','?')}"

    # ---- 1. structural completeness
    for q in qs:
        t = tag(q)
        for f in ('question_fa', 'question_en', 'explanation_fa', 'explanation_en',
                  'chapter_fa', 'chapter_en'):
            if not q.get(f):
                errors.append(f'{t}: empty {f}')
        for f in ('options_fa', 'options_en', 'options_why_fa', 'options_why_en'):
            v = q.get(f) or []
            if len(v) != 4:
                errors.append(f'{t}: {f} has {len(v)} entries, expected 4')
            elif any(not (x or '').strip() for x in v):
                errors.append(f'{t}: {f} contains a blank entry')
        ci = q.get('correct_index')
        if not isinstance(ci, int) or not 0 <= ci <= 3:
            errors.append(f'{t}: bad correct_index {ci!r}')
        m = q.get('micro') or {}
        pf, pe = m.get('points_fa') or [], m.get('points_en') or []
        if len(pf) < min_points or len(pf) != len(pe):
            warns.append(f'{t}: micro points {len(pf)}/{len(pe)} (want >={min_points}, equal)')

    # ---- 2. the correct option must be marked correct
    for q in qs:
        t = tag(q)
        why = (q.get('options_why_fa') or [''] * 4)
        ci = q.get('correct_index')
        if not isinstance(ci, int) or not 0 <= ci < len(why):
            continue
        if 'صحیح' not in why[ci] and 'پاسخ' not in why[ci]:
            errors.append(f'{t}: correct option rationale does not mark it correct')
        for i, w in enumerate(why):
            if i != ci and w.startswith('پاسخ صحیح'):
                errors.append(f'{t}: distractor {i} is labelled correct')

    # ---- 2b. no distractor conceded as also-correct without rebuttal
    # Skipped for negative ("which is NOT true / all EXCEPT") questions: there
    # the distractors are true statements by design, so conceding them is the
    # whole point rather than a defect.
    for q in qs:
        t = tag(q)
        if is_negative(q):
            continue
        ci = q.get('correct_index')
        for i, w in enumerate(q.get('options_why_fa') or []):
            if i == ci:
                continue
            for c in CONCEDE:
                mm = re.search(r'(?<![\u0600-\u06FF])' + re.escape(c), w)
                if not mm:
                    continue
                # The concession must be about THIS option. Phrases like
                # "MRI is the right choice" or "one unit less than the correct
                # answer" praise something else, so look at what precedes it.
                lead = w[max(0, mm.start() - 40):mm.start() + len(c)]
                # قضاوت صریح نویسنده در اطراف عبارت امتیازدهنده («نادرست است؛»،
                # «دلیل رد»، «دلیل انتخاب») یعنی رد مستند وجود دارد و تداخلی نیست.
                verdict_lead = w
                if re.search('نادرست است؛|دلیل رد|دلیل انتخاب', verdict_lead):
                    break
                if re.search('انتخاب|گزینه‌ی درست|پاسخ درست|پاسخ صحیح|ایمنی|عوارض|تحمل|'
                             'کمتر از|بیشتر از|نسبت به', lead):
                    break
                if not any(r in w[mm.start():] for r in REJECT):
                    errors.append(f'{t}: distractor {i} conceded as correct, no rebuttal ("{c}")')
                break

    # ---- 3. duplicates
    seen = {}
    for q in qs:
        k = norm(q['question_fa'])
        if k in seen:
            errors.append(f'{tag(q)}: exact duplicate of {seen[k]}')
        else:
            seen[k] = tag(q)
    keys = list(seen)
    tris = {k: tri(k) for k in keys}
    for i in range(len(keys)):
        a = tris[keys[i]]
        if not a:
            continue
        for j in range(i + 1, len(keys)):
            b = tris[keys[j]]
            if not b:
                continue
            if len(a & b) / min(len(a), len(b)) >= near_dup:
                warns.append(f'near-duplicate: {seen[keys[i]]} vs {seen[keys[j]]}')

    # ---- 4. repeated options inside one question
    for q in qs:
        o = [norm(x) for x in (q.get('options_fa') or [])]
        if len(o) == 4 and len(set(o)) != 4:
            errors.append(f'{tag(q)}: repeated options')

    # ---- 5. plausible ages
    for q in qs:
        for mm in re.finditer(r'(\d{1,3})\s*ساله', (q['question_fa'] or '').translate(DIG)):
            a = int(mm.group(1))
            if a > 100 or a == 0:
                errors.append(f'{tag(q)}: implausible age {a}')

    # ---- 6. broken glyphs
    for q in qs:
        blob = (q['question_fa'] or '') + ' '.join(q.get('options_fa') or []) + (q.get('explanation_fa') or '')
        if '\x00' in blob or '□' in blob or '\ufffd' in blob:
            errors.append(f'{tag(q)}: broken glyph')

    # ---- 7. English side is actually English
    for q in qs:
        if not re.search(r'[A-Za-z]', q.get('question_en') or ''):
            errors.append(f'{tag(q)}: English stem is not English')
        for i, o in enumerate(q.get('options_en') or []):
            if not re.search(r'[A-Za-z]', o):
                errors.append(f'{tag(q)}: English option {i} is not English')

    dist = collections.Counter(q.get('correct_index') for q in qs)
    print(f'\n=== {name} ===')
    print(f'questions: {len(qs)}')
    print('answer spread: ' + ', '.join(f'{k}={dist[k]}' for k in range(4)))
    print(f'bilingual: {sum(1 for q in qs if q.get("question_en") and q.get("explanation_en"))}/{len(qs)}')
    print(f'with micro: {sum(1 for q in qs if q.get("micro"))}/{len(qs)}')
    if warns:
        print(f'{len(warns)} warning(s)')
        for w in warns[:8]:
            print('  ⚠️ ', w)
        if len(warns) > 8:
            print(f'  ... and {len(warns)-8} more')
    if errors:
        print(f'{len(errors)} ERROR(s):')
        for e in errors[:30]:
            print('  ❌', e)
        if len(errors) > 30:
            print(f'  ... and {len(errors)-30} more')
    else:
        print('✅ no errors')
    return len(errors)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    n = check(sys.argv[1], sys.argv[2:])
    sys.exit(1 if n else 0)
