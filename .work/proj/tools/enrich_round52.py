#!/usr/bin/env python3
"""Round52 — paediatrics part26 rows 46-220 + part27 rows 1-25 except 23.

Exact five-field edit only:
  explanation_fa  = case interpretation + '\\n\\n' + lesson
  options_why_fa  = ['گزینه صحیح: ' | 'دلیل رد گزینه: '] + reason   (4 entries)
  micro.lead_fa / micro.golden_fa / micro.points_fa

question_fa / options_fa / English fields / grading metadata are NEVER touched.
The fixture server/test/fixtures/round52-preservation.json is auto-created on
first run from the untampered payloads and hash-verifies every other part file.
Idempotent: re-running yields identical output.
"""
import copy
import hashlib
import json
from pathlib import Path

from round52_items import ITEMS
from round52_lessons import LESSONS

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / 'server/test/fixtures/round52-preservation.json'
FIELDS = ('explanation_fa', 'options_why_fa')
MICRO_FIELDS = ('lead_fa', 'golden_fa', 'points_fa')

PARTS = {
    26: 'tools/master-bank/import-payload.master-preint.part26.json',
    27: 'tools/master-bank/import-payload.master-preint.part27.json',
}
EDITED = {26: set(range(46, 221)), 27: set(range(1, 26)) - {23}}
DEFERRED = {26: set(range(1, 46)), 27: {23}}


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
    fixture = {
        'baseline': 'MED-School-100-round51.zip workspace payload state',
        'baseline_sha256': {p: sha(ROOT / rel) for p, rel in PARTS.items()},
        'edited_numbers': {str(p): sorted(EDITED[p]) for p in PARTS},
        'deferred_numbers': {str(p): sorted(DEFERRED[p]) for p in PARTS},
        'original_file_hashes': {name: sha(ROOT / name) for name in payload_files()},
        'original_parts': {str(p): json.loads((ROOT / rel).read_text())
                           for p, rel in PARTS.items()},
    }
    FIXTURE.write_text(json.dumps(fixture, ensure_ascii=False, indent=2) + '\n')
    print('fixture created: server/test/fixtures/round52-preservation.json')
    return fixture


def enrich_part(part, fixture):
    edited, deferred = EDITED[part], DEFERRED[part]
    assert edited.isdisjoint(deferred)
    baseline = fixture['original_parts'][str(part)]
    path = ROOT / PARTS[part]
    before = json.loads(path.read_text())
    assert len(before['questions']) == len(baseline['questions'])
    assert ({k: v for k, v in before.items() if k != 'questions'}
            == {k: v for k, v in baseline.items() if k != 'questions'})

    for n, (old, current) in enumerate(zip(baseline['questions'], before['questions']), 1):
        assert (protected(old) == protected(current)) if n in edited else (old == current), n

    items = {(p, n): it for (p, n), it in ITEMS.items() if p == part}
    assert {n for (p, n) in ITEMS if p == part} == edited

    after = copy.deepcopy(before)
    for (p, n), item in items.items():
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
        assert len(q['explanation_fa']) > 300, (p, n)
        assert len(q['micro']['lead_fa']) > 20 and len(q['micro']['golden_fa']) > 20
        assert all(len(pt) > 20 for pt in q['micro']['points_fa'])
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
    return len(edited), len(deferred)


def enrich():
    fixture = json.loads(FIXTURE.read_text()) if FIXTURE.exists() else create_fixture()

    for name, digest in fixture['original_file_hashes'].items():
        if name not in PARTS.values():
            assert sha(ROOT / name) == digest, name

    assert set(ITEMS) == {(26, n) for n in EDITED[26]} | {(27, n) for n in EDITED[27]}, \
        'items keys must cover part26 rows 46..220 + part27 rows 1..25 except 23'
    assert all(t in LESSONS for t in {it['topic'] for it in ITEMS.values()}), 'topic gap'

    e26, d26 = enrich_part(26, fixture)
    e27, d27 = enrich_part(27, fixture)
    print(f'PASS: part26 rows 46..220 enriched ({e26} rows, {d26} deferred); '
          f'part27 rows 1..25 except 23 enriched ({e27} rows, {d27} deferred); '
          'all other part files hash-verified; protected fields preserved.')


if __name__ == '__main__':
    enrich()
