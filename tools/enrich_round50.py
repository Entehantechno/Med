#!/usr/bin/env python3
"""Round50: exact five-field edit; baseline is the verified round49 ZIP."""
import copy
import hashlib
import json
from pathlib import Path
from round50_items import ITEMS
from round50_lessons import LESSONS

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / 'server/test/fixtures/round50-preservation.json'
FIELDS = ('explanation_fa', 'options_why_fa')
MICRO_FIELDS = ('lead_fa', 'golden_fa', 'points_fa')


def protected(q):
    result = copy.deepcopy(q)
    for field in FIELDS:
        result.pop(field, None)
    for field in MICRO_FIELDS:
        result['micro'].pop(field, None)
    return result


def enrich():
    fixture = json.loads(FIXTURE.read_text())
    edited = set(fixture['edited_numbers'])
    deferred = set(fixture['deferred_numbers'])
    assert len(edited) == 160 and len(deferred) == 40
    assert edited.isdisjoint(deferred) and edited | deferred == set(range(1, 201))
    assert set(ITEMS) == {(25, n) for n in edited}
    relpath = 'tools/master-bank/import-payload.master-preint.part25.json'
    path = ROOT / relpath
    baseline = fixture['original_part25']
    before = json.loads(path.read_text())
    assert len(before['questions']) == len(baseline['questions']) == 220
    assert {k:v for k,v in before.items() if k != 'questions'} == {k:v for k,v in baseline.items() if k != 'questions'}
    for name, sha in fixture['original_file_hashes'].items():
        if name != relpath:
            assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == sha, name
    for n,(old,current) in enumerate(zip(baseline['questions'],before['questions']),1):
        assert (protected(old)==protected(current)) if n in edited else (old==current), n
    after = copy.deepcopy(before)
    for (part,n),item in ITEMS.items():
        q = after['questions'][n-1]
        unit = LESSONS[item['topic']]
        assert len(item['reasons']) == len(unit['points']) == 4
        assert q['correct_index'] in range(4)
        q['explanation_fa'] = item['interpretation'] + '\n\n' + unit['lesson']
        q['options_why_fa'] = [('گزینه صحیح: ' if i==q['correct_index'] else 'دلیل رد گزینه: ') + reason for i,reason in enumerate(item['reasons'])]
        q['micro']['lead_fa'] = item['lead']
        q['micro']['golden_fa'] = unit['golden']
        q['micro']['points_fa'] = list(unit['points'])
        assert len(q['explanation_fa']) > 300
        assert protected(q) == protected(baseline['questions'][n-1])
    assert {n for n,(a,b) in enumerate(zip(baseline['questions'],after['questions']),1) if a!=b} == edited
    restored=copy.deepcopy(after)
    for n in edited:
        for key in FIELDS:restored['questions'][n-1][key]=baseline['questions'][n-1][key]
        for key in MICRO_FIELDS:restored['questions'][n-1]['micro'][key]=baseline['questions'][n-1]['micro'][key]
    assert restored == baseline
    path.write_text(json.dumps(after,ensure_ascii=False,indent=2)+'\n')
    print('PASS: 160 enriched;40 new deferred;all protected and out-of-scope fields preserved.')

if __name__ == '__main__':
    enrich()
