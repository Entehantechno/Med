#!/usr/bin/env python3
"""Parse .work/ROUND56-AUDIT.md into a machine-readable remediation pack.

Nothing is applied to the payloads here: the output files describe what a
future, explicitly approved round would change (58 key proposals) plus the
rows that cannot be fixed by moving a key (27 broken, 13 disputed, 8 outdated).
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # /home/user/Med
AUDIT = ROOT / '.work/ROUND56-AUDIT.md'
BANK = ROOT / '.work/proj/tools/master-bank'
OUT = ROOT / '.work/proj/docs'

DIGITS = str.maketrans('۰۱۲۳۴۵۶۷۸۹', '0123456789')
ZERO_WIDTH = dict.fromkeys(map(ord, '\u200c\u200d\u200e\u200f'), None)


def norm(text):
    text = text.translate(DIGITS).translate(ZERO_WIDTH)
    text = re.sub(r'[\u064b-\u0652\u0640]', '', text)      # harakat + tatweel
    text = text.replace('ي', 'ی').replace('ك', 'ک').replace('ۀ', 'ه')
    text = re.sub(r'[^\w\u0600-\u06ff]+', ' ', text)
    return re.sub(r'\s+', ' ', text).strip().lower()


def parse_table(title):
    lines = AUDIT.read_text(encoding='utf-8').splitlines()
    start = next(k for k, l in enumerate(lines) if l.startswith('## ') and title in l)
    body = []
    for line in lines[start + 1:]:
        if line.startswith('## '):
            break
        if line.startswith('|') and not re.match(r'^\|\s*-+', line) and 'بخش' not in line.split('|')[1]:
            body.append([c.strip() for c in line.strip('|').split('|')])
    return body


def load_options(part, number):
    payload = json.loads((BANK / f'import-payload.master-preint.part{part:02d}.json').read_text(encoding='utf-8'))
    return payload['questions'][number - 1]


def score(phrase, option):
    """Token overlap between the audit's short phrase and a printed option."""
    want = [t for t in norm(phrase).split() if len(t) > 2]
    have = set(norm(option).split())
    if not want:
        return 0.0
    return sum(1 for t in want if t in have) / len(want)


def main():
    key_rows, outdated, broken, disputed = [], [], [], []
    review = []

    for part, number, qid, current_text, proposal, rationale in parse_table('۴) پیشنهاد اصلاح کلید'):
        q = load_options(int(part.translate(DIGITS)), int(number.translate(DIGITS)))
        assert qid in q['tags'], (part, number, qid, q['tags'])
        applied = int(proposal.translate(DIGITS)[0]) if proposal[:1].translate(DIGITS).isdigit() else None
        if applied is None:                      # proposal cell was '—': read the rationale
            found = re.search(r'گزینهٔ\s*([۰-۹0-9])', rationale.translate(DIGITS))
            applied = int(found.group(1)) if found else None
        phrase = proposal.split(')', 1)[-1] if applied is not None else rationale
        scores = [score(phrase, option) for option in q['options_fa']]
        best = max(range(len(scores)), key=lambda i: scores[i])
        ok = applied is not None and (scores[applied] >= 0.5 or best == applied)
        entry = {
            'part': int(part.translate(DIGITS)),
            'local_question': int(number.translate(DIGITS)),
            'id': qid,
            'current_index': q['correct_index'],
            'current_option_fa': q['options_fa'][q['correct_index']],
            'proposed_index': applied,
            'proposed_option_fa': q['options_fa'][applied] if applied is not None else None,
            'audit_phrase_fa': phrase,
            'match': round(scores[applied], 2) if applied is not None else None,
            'audit_reason_fa': rationale,
            'status': 'verified' if ok else 'review',
        }
        key_rows.append(entry)
        if not ok:
            review.append(entry)

    for part, number, qid, note in parse_table('۵) ردیف‌های نیازمند به‌روزرسانی قاعده'):
        q = load_options(int(part.translate(DIGITS)), int(number.translate(DIGITS)))
        assert qid in q['tags'], (part, number, qid, q['tags'])
        found = re.search(r'\(گزینهٔ\s*([۰-۹0-9])\)', note.translate(DIGITS))
        outdated.append({
            'part': int(part.translate(DIGITS)), 'local_question': int(number.translate(DIGITS)), 'id': qid,
            'current_index': q['correct_index'], 'current_option_fa': q['options_fa'][q['correct_index']],
            'proposed_index': int(found.group(1)) if found else None,
            'note_fa': note,
        })

    for part, number, qid, note in parse_table('۶) ردیف‌های غیرقابل اصلاح'):
        broken.append({'part': int(part.translate(DIGITS)), 'local_question': int(number.translate(DIGITS)),
                       'id': qid, 'defect_fa': note})

    for part, number, qid, note in parse_table('۷) ردیف‌های نیازمند منبع'):
        disputed.append({'part': int(part.translate(DIGITS)), 'local_question': int(number.translate(DIGITS)),
                         'id': qid, 'open_question_fa': note})

    OUT.joinpath('round58-key-proposals.json').write_text(json.dumps({
        'status': 'proposed_not_applied',
        'source': '.work/ROUND56-AUDIT.md section 4 (round56 audit)',
        'requires': 'explicit user approval before tools/apply_round58_keys.py --apply',
        'count': len(key_rows),
        'proposals': key_rows,
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    OUT.joinpath('round58-outdated-rows.json').write_text(json.dumps({
        'status': 'proposed_not_applied',
        'count': len(outdated), 'rows': outdated,
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    OUT.joinpath('round58-broken-rows.json').write_text(json.dumps({
        'status': 'needs_content_rewrite', 'count': len(broken), 'rows': broken,
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    OUT.joinpath('round58-disputed-rows.json').write_text(json.dumps({
        'status': 'needs_source_document', 'count': len(disputed), 'rows': disputed,
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    print(f'proposals {len(key_rows)} (verified {len(key_rows)-len(review)}, review {len(review)})')
    print(f'outdated {len(outdated)} (index known {sum(1 for r in outdated if r["proposed_index"] is not None)})')
    print(f'broken {len(broken)} | disputed {len(disputed)}')
    for entry in review:
        print('  REVIEW', entry['part'], entry['local_question'], entry['proposed_index'], repr(entry['audit_phrase_fa'][:50]))


if __name__ == '__main__':
    main()
