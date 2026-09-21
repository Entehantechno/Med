#!/usr/bin/env python3
"""Enrich the 194 non-deferred questions in the 200-question round47 scope.
No key, stem, option, English field or grading metadata is edited.
Source dataset and authored clinical units are local, deterministic and auditable.
"""
import copy
import hashlib
import json
from pathlib import Path
from round47_items import ITEMS
from round47_lessons import LESSONS

ROOT = Path(__file__).resolve().parents[1]
DEFERRED = {(22, 142), (22, 145), (22, 166), (22, 174), (22, 214), (23, 32)}
SCOPE = {(22, n) for n in range(61, 221)} | {(23, n) for n in range(1, 41)}
ALLOWED = ('explanation_fa', 'options_why_fa')
MICRO_ALLOWED = ('lead_fa', 'golden_fa', 'points_fa')


def enrich():
    assert len(SCOPE) == 200
    assert set(ITEMS) == SCOPE - DEFERRED
    assert len(ITEMS) == 194
    pending = []
    for part in (22, 23):
        path = ROOT / f'tools/master-bank/import-payload.master-preint.part{part:02}.json'
        before = json.loads(path.read_text(encoding='utf-8'))
        after = copy.deepcopy(before)
        for number, q in enumerate(after['questions'], 1):
            item = ITEMS.get((part, number))
            if item is None:
                continue
            unit = LESSONS[item['topic']]
            assert len(unit['points']) == len(item['reasons']) == 4
            assert q['correct_index'] in range(4), (part, number)
            q['explanation_fa'] = item['interpretation'] + '\n\n' + unit['lesson']
            q['options_why_fa'] = [
                ('گزینه صحیح: ' if i == q['correct_index'] else 'دلیل رد گزینه: ') + reason
                for i, reason in enumerate(item['reasons'])
            ]
            q['micro']['lead_fa'] = item['lead']
            q['micro']['golden_fa'] = unit['golden']
            q['micro']['points_fa'] = list(unit['points'])
            assert len(q['explanation_fa']) > 300
        # Compare EVERY field, not just stems/options; deferred items are untouched.
        restored = copy.deepcopy(after)
        for number, (old, new) in enumerate(zip(before['questions'], restored['questions']), 1):
            if (part, number) in ITEMS:
                for field in ALLOWED:
                    new[field] = old[field]
                for field in MICRO_ALLOWED:
                    new['micro'][field] = old['micro'][field]
        assert restored == before, f'Out-of-scope change in part{part}'
        pending.append((path, json.dumps(after, ensure_ascii=False, indent=2) + '\n'))
    # Do not write either payload until all validation succeeds.
    for path, text in pending:
        path.write_text(text, encoding='utf-8')
    print('PASS: enriched 194 (part22:155, part23:39); deferred 6 unchanged; all keys/stems/options preserved.')


if __name__ == '__main__':
    enrich()
