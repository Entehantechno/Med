#!/usr/bin/env python3
"""Round51 — paediatrics part26 rows 1-45 (official paeds 1395 exam).

Exact five-field edit only:
  explanation_fa  = case interpretation + '\n\n' + lesson
  options_why_fa  = ['گزینه صحیح: ' | 'دلیل رد گزینه: '] + reason   (4 entries)
  micro.lead_fa / micro.golden_fa / micro.points_fa

question_fa / options_fa / English fields / grading metadata are NEVER touched.
The fixture server/test/fixtures/round51-preservation.json is auto-created on
first run from the untampered payload and hash-verifies every other part file.
Idempotent: re-running yields identical output.
"""
import copy
import hashlib
import json
from pathlib import Path

from round51_items import ITEMS
from round51_lessons import LESSONS

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / 'server/test/fixtures/round51-preservation.json'
RELPATH = 'tools/master-bank/import-payload.master-preint.part26.json'
FIELDS = ('explanation_fa', 'options_why_fa')
MICRO_FIELDS = ('lead_fa', 'golden_fa', 'points_fa')
EDITED = set(range(1, 46))
DEFERRED = set(range(46, 221))


def payload_files():
    names = [f'tools/master-bank/import-payload.master-preint.part{i:02}.json'
             for i in range(1, 52)]
    names += [f'tools/master-bank/import-payload.master-residency.part{i:02}.json'
              for i in range(1, 4)]
    return names


def protected(q):
    result = copy.deepcopy(q)
    for field in FIELDS:
        result.pop(field, None)
    for field in MICRO_FIELDS:
        result['micro'].pop(field, None)
    return result


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def create_fixture():
    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    original = json.loads((ROOT / RELPATH).read_text())
    fixture = {
        'baseline': 'MED-School-100-round50.zip (payload reconstructed in workspace after sandbox restore)',
        'baseline_sha256': sha(ROOT / RELPATH),
        'edited_numbers': sorted(EDITED),
        'deferred_numbers': sorted(DEFERRED),
        'original_file_hashes': {name: sha(ROOT / name) for name in payload_files()},
        'original_part26': original,
    }
    FIXTURE.write_text(json.dumps(fixture, ensure_ascii=False, indent=2) + '\n')
    print('fixture created: server/test/fixtures/round51-preservation.json')
    return fixture


def enrich():
    fixture = json.loads(FIXTURE.read_text()) if FIXTURE.exists() else create_fixture()
    edited = set(fixture['edited_numbers'])
    deferred = set(fixture['deferred_numbers'])
    assert edited == EDITED and deferred == DEFERRED
    assert edited.isdisjoint(deferred) and edited | deferred == set(range(1, 221))
    assert set(ITEMS) == {(26, n) for n in edited}, 'items keys must cover rows 1..45'

    path = ROOT / RELPATH
    baseline = fixture['original_part26']
    before = json.loads(path.read_text())
    assert len(before['questions']) == len(baseline['questions']) == 220
    assert ({k: v for k, v in before.items() if k != 'questions'}
            == {k: v for k, v in baseline.items() if k != 'questions'})

    for name, digest in fixture['original_file_hashes'].items():
        if name != RELPATH:
            assert sha(ROOT / name) == digest, name

    for n, (old, current) in enumerate(zip(baseline['questions'], before['questions']), 1):
        assert (protected(old) == protected(current)) if n in edited else (old == current), n

    after = copy.deepcopy(before)
    for (part, n), item in ITEMS.items():
        q = after['questions'][n - 1]
        unit = LESSONS[item['topic']]
        assert len(item['reasons']) == len(unit['points']) == 4
        assert q['correct_index'] in range(4)
        q['explanation_fa'] = item['interpretation'] + '\n\n' + unit['lesson']
        q['options_why_fa'] = [
            ('گزینه صحیح: ' if i == q['correct_index'] else 'دلیل رد گزینه: ') + reason
            for i, reason in enumerate(item['reasons'])
        ]
        q['micro']['lead_fa'] = item['lead']
        q['micro']['golden_fa'] = unit['golden']
        q['micro']['points_fa'] = list(unit['points'])
        assert len(q['explanation_fa']) > 300
        assert len(q['micro']['lead_fa']) > 20 and len(q['micro']['golden_fa']) > 20
        assert all(len(p) > 20 for p in q['micro']['points_fa'])
        assert protected(q) == protected(baseline['questions'][n - 1])

    assert {n for n, (a, b) in enumerate(zip(baseline['questions'], after['questions']), 1)
            if a != b} == edited

    restored = copy.deepcopy(after)
    for n in edited:
        for key in FIELDS:
            restored['questions'][n - 1][key] = baseline['questions'][n - 1][key]
        for key in MICRO_FIELDS:
            restored['questions'][n - 1]['micro'][key] = baseline['questions'][n - 1]['micro'][key]
    assert restored == baseline

    path.write_text(json.dumps(after, ensure_ascii=False, indent=2) + '\n')
    print('PASS: 45 rows of part26 enriched; 175 rows deferred untouched; '
          'all other part files hash-verified; protected fields preserved.')


if __name__ == '__main__':
    enrich()
