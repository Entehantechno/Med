# -*- coding: utf-8 -*-
"""Generate tools/round57_items.py and tools/round57_lessons.py from the batches.

Round 57 enriches deferred-queue rows whose audit verdict was K or K_EXC (key
sound). Every authored topic is unique, so each lesson unit is that row's own
teaching text.
"""
import importlib.util
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
TOOLS = HERE.parent / 'proj' / 'tools'

ITEMS = {}
for name in sorted(HERE.glob('r57_b*.py')):
    spec = importlib.util.spec_from_file_location('batch_' + name.stem, name)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    ITEMS.update(module.BATCH)

LESSONS = {}
for (part, n), item in sorted(ITEMS.items(), key=lambda kv: kv[0][1]):
    topic = item['topic']
    assert topic not in LESSONS, (topic, n)
    LESSONS[topic] = {'lesson': item['interpretation'], 'golden': item['lead'],
                      'points': list(item['reasons'])}

for (part, n), item in ITEMS.items():
    unit = LESSONS[item['topic']]
    assert len(item['interpretation'] + '\n\n' + unit['lesson']) > 300, n
    assert len(item['reasons']) == len(unit['points']) == 4, n
    assert len(set(unit['points'])) == 4, n
    assert all(len(pt) > 20 for pt in unit['points']), n
    assert len(unit['golden']) > 20, n


def dump_items():
    lines = ['# -*- coding: utf-8 -*-',
             '"""Round57 authored items — 55 deferred-queue rows with sound keys',
             '(audit verdict K/K_EXC), parts 22-25/27-28.',
             'question_fa/options_fa and every key are NEVER touched; only',
             'explanation_fa, options_why_fa and micro.*_fa are written.',
             'topic -> round57_lessons.LESSONS key · lead -> micro.lead_fa ·',
             'interpretation -> explanation_fa head · reasons -> 4 in printed option',
             'order, the enricher prefixes the payload correct_index entry with',
             '«گزینه صحیح: »."""',
             '',
             'ITEMS = {']
    for (part, n), item in sorted(ITEMS.items(), key=lambda kv: (kv[0][0], kv[0][1])):
        lines.append(f' ({part}, {n}): {{')
        for field in ('topic', 'lead', 'interpretation'):
            lines.append(f'  "{field}": {json.dumps(item[field], ensure_ascii=False)},')
        lines.append('  "reasons": [')
        for reason in item['reasons']:
            lines.append(f'  {json.dumps(reason, ensure_ascii=False)},')
        lines.append('],')
        lines.append(' },')
    lines.append('}')
    return '\n'.join(lines) + '\n'


def dump_lessons():
    lines = ['# -*- coding: utf-8 -*-',
             '"""Round57 clinical units (55 rows from the deferred queue, sound keys).',
             '',
             'One unit per topic; every topic is unique to this round."""',
             '',
             'LESSONS = {']
    for topic in sorted(LESSONS):
        unit = LESSONS[topic]
        lines.append(f' {json.dumps(topic, ensure_ascii=False)}: {{')
        lines.append(f'  "lesson": {json.dumps(unit["lesson"], ensure_ascii=False)},')
        lines.append(f'  "golden": {json.dumps(unit["golden"], ensure_ascii=False)},')
        lines.append('  "points": [')
        for point in unit['points']:
            lines.append(f'  {json.dumps(point, ensure_ascii=False)},')
        lines.append('],')
        lines.append(' },')
    lines.append('}')
    return '\n'.join(lines) + '\n'


if __name__ == '__main__':
    (TOOLS / 'round57_items.py').write_text(dump_items(), encoding='utf-8')
    (TOOLS / 'round57_lessons.py').write_text(dump_lessons(), encoding='utf-8')
    print(f'items: {len(ITEMS)}  lessons: {len(LESSONS)}')
