# -*- coding: utf-8 -*-
"""Build tools/round54_items.py + tools/round54_lessons.py from the six
repaired draft batches. LESSONS is one unit per clinical topic: the first
(by row order) case supplies the lesson text and golden line, and its reasons
are re-ordered so the correct-answer rationale comes first."""
import importlib.util, json
from pathlib import Path

DRAFTS = Path("/home/user/Med/.work/round54-drafts")
TOOLS = Path("/home/user/Med/.work/proj/tools")
PAYLOAD = TOOLS / "master-bank/import-payload.master-preint.part28.json"
DEFERRED = {8, 23, 25, 27, 28, 30, 32, 50, 55, 57, 66, 87, 91, 94, 113, 118, 151, 189, 218}

B = {}
for i in range(1, 7):
    spec = importlib.util.spec_from_file_location(f"r54_b{i}", DRAFTS / f"r54_b{i}.py")
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    B.update(m.BATCH)

rows = sorted((p, n) for (p, n) in B if p == 28)
edited = [n for (p, n) in rows]
assert edited == sorted(set(range(6, 221)) - DEFERRED), "scope mismatch"

qs = json.loads(PAYLOAD.read_text())["questions"]
ITEMS, LESSONS, seen = {}, {}, {}
for (p, n) in rows:
    item = B[(p, n)]
    ci = qs[n - 1]["correct_index"]
    reasons = list(item["reasons"])
    assert len(reasons) == 4 and reasons[ci].endswith(("پاسخ صحیح.", "پاسخ صحیح", "نادرست است؛ پاسخ صحیح.")) or 'پاسخ صحیح' in reasons[ci]
    ITEMS[(p, n)] = {"topic": item["topic"], "lead": item["lead"],
                     "interpretation": item["interpretation"], "reasons": reasons}
    if item["topic"] not in LESSONS:
        LESSONS[item["topic"]] = {
            "lesson": item["interpretation"], "golden": item["lead"],
            "points": [reasons[ci]] + [r for i, r in enumerate(reasons) if i != ci]}
    seen.setdefault(item["topic"], []).append(n)

def dump(name, var, obj, doc):
    lines = ['# -*- coding: utf-8 -*-', f'"""{doc}"""', '', f'{var} = {{']
    for key, val in obj.items():
        lines.append(f' {"("+str(key[0])+", "+str(key[1])+")" if isinstance(key, tuple) else repr(key)}: {{')
        for k, v in val.items():
            lines.append(f'  "{k}": {json.dumps(v, ensure_ascii=False, indent=2) if isinstance(v, list) else json.dumps(v, ensure_ascii=False)},')
        lines.append(' },')
    lines.append('}')
    (TOOLS / name).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(name, "->", len(obj), "entries")

dump("round54_items.py", "ITEMS", ITEMS,
     "Round54 authored items — part28 rows 6-220 except 19 deferred (1403/1404 sittings).\n"
     "question_fa/options_fa NEVER touched; mirrors round53 schema:\n"
     "topic -> round54_lessons.LESSONS key · lead -> micro.lead_fa ·\n"
     "interpretation -> explanation_fa head · reasons -> 4 in printed option order,\n"
     "the enricher prefixes the payload correct_index entry with «گزینه صحیح: ».")
dump("round54_lessons.py", "LESSONS", LESSONS,
     "Round54 shared clinical units (part28 rows 6-220).\n\n"
     "Lesson language is Persian-first; Latin/English terms appear only where the\n"
     "standard medical term is itself the established name.")
print("unique units:", len(LESSONS), "| items:", len(ITEMS))
print("shared topics:", {k: v for k, v in seen.items() if len(v) > 1})
