#!/usr/bin/env python3
"""Apply the round58 key proposals — DRY RUN unless --apply is passed.

The round56 audit proposed a corrected option for 58 rows whose printed key is
wrong, plus 6 guideline-drift rows. Nothing in this repository is changed by
default: running the script prints the planned moves and exits.

  python3 tools/apply_round58_keys.py                    # preview (default)
  python3 tools/apply_round58_keys.py --apply            # 58 key corrections
  python3 tools/apply_round58_keys.py --apply --include-outdated

`--apply` writes only `correct_index`; question_fa, options_fa, the English
fields and every grading metadata stay byte-identical. Each touched file's
sha256 before/after and every row's old/new index are recorded in
docs/round58-key-application.json as the audit trail for the release.
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
BANK = ROOT / 'tools/master-bank'
APPLIED = DOCS / 'round58-key-application.json'


def load(name):
    return json.loads((DOCS / name).read_text(encoding='utf-8'))


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def plan(include_outdated):
    rows = []
    for entry in load('round58-key-proposals.json')['proposals']:
        rows.append({'part': entry['part'], 'local_question': entry['local_question'], 'id': entry['id'],
                     'current_index': entry['current_index'], 'proposed_index': entry['proposed_index'],
                     'proposed_option_fa': entry['proposed_option_fa'], 'source': 'round56 audit §4'})
    if include_outdated:
        for row in load('round58-outdated-rows.json')['rows']:
            if not row.get('apply'):
                continue
            rows.append({'part': row['part'], 'local_question': row['local_question'], 'id': row['id'],
                         'current_index': row['current_index'], 'proposed_index': row['proposed_index'],
                         'proposed_option_fa': None, 'source': 'round56 audit §5 (guideline update)'})
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='write the corrections (default: preview only)')
    parser.add_argument('--include-outdated', action='store_true', help='also move the guideline-drift rows')
    args = parser.parse_args()

    rows = plan(args.include_outdated)
    by_part = {}
    for row in rows:
        by_part.setdefault(row['part'], []).append(row)

    print(f'{"APPLY" if args.apply else "PREVIEW"}: {len(rows)} key move(s) across {len(by_part)} payload(s)')
    for part in sorted(by_part):
        payload_path = BANK / f'import-payload.master-preint.part{part:02d}.json'
        payload = json.loads(payload_path.read_text(encoding='utf-8'))
        for row in sorted(by_part[part], key=lambda r: r['local_question']):
            question = payload['questions'][row['local_question'] - 1]
            assert question['correct_index'] == row['current_index'], (
                f"{part}:{row['local_question']} moved already? file={question['correct_index']} pack={row['current_index']}")
            print(f"  {row['part']:>2}:{row['local_question']:<4} {row['id']}  "
                  f"[{row['current_index']}] → [{row['proposed_index']}]  {question['options_fa'][row['proposed_index']][:60]}")
    if not args.apply:
        print('\nNothing was written. Re-run with --apply once the corrections are approved.')
        return

    trail = {'round': 58, 'source': 'round56 audit, approved for application by the user',
             'include_outdated': args.include_outdated, 'files': {}, 'rows': []}
    for part in sorted(by_part):
        payload_path = BANK / f'import-payload.master-preint.part{part:02d}.json'
        before_hash = sha256(payload_path)
        payload = json.loads(payload_path.read_text(encoding='utf-8'))
        for row in sorted(by_part[part], key=lambda r: r['local_question']):
            question = payload['questions'][row['local_question'] - 1]
            question['correct_index'] = row['proposed_index']
            trail['rows'].append({'part': part, 'local_question': row['local_question'], 'id': row['id'],
                                  'from': row['current_index'], 'to': row['proposed_index'], 'source': row['source']})
        payload_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        trail['files'][f'tools/master-bank/{payload_path.name}'] = {'before': before_hash, 'after': sha256(payload_path)}
    APPLIED.write_text(json.dumps(trail, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f"\nApplied {len(trail['rows'])} key move(s); audit trail: docs/round58-key-application.json")


if __name__ == '__main__':
    main()
