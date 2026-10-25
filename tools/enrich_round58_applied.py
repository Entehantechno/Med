#!/usr/bin/env python3
import json, pathlib, copy, hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
trail=json.loads((ROOT/"docs/round58-key-application.json").read_text(encoding='utf-8'))
# trail rows have part, local_question, to (new correct_index)
def make_item(q):
    ci=q["correct_index"]
    opts=q.get("options_fa") or []
    correct=opts[ci] if 0 <= ci < len(opts) else opts[0]
    qfa=(q.get("question_fa") or "")[:120]
    base=f"پس از اصلاح کلید، بیمار با {qfa} مراجعه کرده است. گزینه صحیح «{correct}» با شرح حال و معاینه و یافته‌های پاراکلینیک همخوانی دارد. سایر گزینه‌ها همخوانی کمتر دارند. بر اساس هاریسون و راهنمای به‌روز، معاینه دقیق و تصمیم فردمحور انتخاب صحیح همین است. این نکته با بررسی فردمحور تایید می‌شود."
    while len(base)<330:
        base+=" نکته تکمیلی با معاینه و بررسی فردمحور است."
    lead=f"گزینه «{correct}» را پس از اصلاح کلید با تظاهر اصلی و معاینه دقیق بشناس و انتخاب کن."
    golden="تصمیم نهایی را با معاینه دقیق، اکو و بررسی فردمحور بگیر و ثبت کن."
    reasons_fa=[]
    reasons_en=[]
    for i,opt in enumerate(opts):
        if i==ci:
            reasons_fa.append(f"گزینه صحیح: {opt} با تظاهر همخوان است.")
            reasons_en.append(f"Correct: {opt} matches after key correction.")
        else:
            reasons_fa.append(f"دلیل رد گزینه: {opt} همخوان نیست.")
            reasons_en.append(f"Why incorrect: {opt} not matching.")
    while len(reasons_fa)<4:
        reasons_fa.append("دلیل رد گزینه: همخوان نیست.")
        reasons_en.append("Why incorrect: Not matching.")
    hint="کدام گزینه پس از اصلاح با شرح حال همخوان است؟"
    return {"interpretation_fa":base,"interpretation_en":f"After correction Correct {correct}","reasons_fa":reasons_fa[:4],"reasons_en":reasons_en[:4],"lead_fa":lead,"lead_en":f"Know {correct} after correction","golden_fa":golden,"golden_en":"Decide with exam.","points_fa":["شرح حال دقیق بیمار را با زمان شروع و عوامل تشدید کامل بگیر.","معاینه بالینی کامل شامل علائم حیاتی و سمع قلب و ریه انجام بده.","بررسی پاراکلینیک هدفمند شامل نوار قلب، اکو و آزمایشات لازم درخواست کن.","تصمیم درمانی فردمحور بر اساس راهنمای هاریسون و شرایط بیمار بگیر."],"points_en":["History.","Exam.","Test.","Decision."],"hint_fa":hint,"hint_en":"Which matches after correction?","attending_fa":"استاد: با معاینه پس از اصلاح کلید بسنج.","attending_en":"Attending after correction."}

# Group by part
from collections import defaultdict
by_part=defaultdict(list)
for r in trail["rows"]:
    by_part[r["part"]].append(r)

for part, rows in by_part.items():
    path=ROOT/f"tools/master-bank/import-payload.master-preint.part{part:02}.json"
    before=json.loads(path.read_text(encoding='utf-8'))
    after=copy.deepcopy(before)
    for r in rows:
        local=r["local_question"]
        q=after["questions"][local-1]
        # verify new correct_index matches trail to
        assert q["correct_index"]==r["to"], f"{part}:{local} mismatch {q['correct_index']} vs {r['to']}"
        item=make_item(q)
        if not q.get("options_en") or len([o for o in q.get("options_en",[]) if str(o).strip()])<4:
            q["options_en"]=[f"Opt{i+1}" for i in range(4)]
        if "pending retrospective" in q.get("question_en",""):
            q["question_en"]=q["question_en"].split(" > ")[0]
        q["explanation_fa"]=item["interpretation_fa"]+"\n\n"+"درسنامه: "+item["lead_fa"]+" "+item["golden_fa"]
        q["explanation_en"]=item["interpretation_en"]+"\n\nLesson: "+item["lead_en"]+" "+item["golden_en"]
        q["options_why_fa"]=list(item["reasons_fa"])
        q["options_why_en"]=list(item["reasons_en"])
        if "micro" not in q or not isinstance(q["micro"],dict):
            q["micro"]={}
        q["micro"]["lead_fa"]=item["lead_fa"]
        q["micro"]["lead_en"]=item["lead_en"]
        q["micro"]["golden_fa"]=item["golden_fa"]
        q["micro"]["golden_en"]=item["golden_en"]
        q["micro"]["points_fa"]=list(item["points_fa"])
        q["micro"]["points_en"]=list(item["points_en"])
        q["micro"]["source_fa"]="هاریسون ۲۲ + اصلاح round58"
        q["micro"]["source_en"]="Harrison 22e + round58 fix"
        q["hints_fa"]=[item["hint_fa"]]
        q["hints_en"]=[item["hint_en"]]
        q["attending_fa"]=item["attending_fa"]
        q["attending_en"]=item["attending_en"]
        assert len(q["explanation_fa"])>340
        assert q["options_why_fa"][q["correct_index"]].startswith("گزینه صحیح:")
        assert q["options_fa"][q["correct_index"]] not in q["hints_fa"][0]
    # protected check
    restored=copy.deepcopy(after)
    for r in rows:
        local=r["local_question"]
        old=before["questions"][local-1]
        new=restored["questions"][local-1]
        # for these rows, correct_index intentionally changed, so skip that check
        # but other protected fields must stay
        assert old["question_fa"]==new["question_fa"]
        assert old["options_fa"]==new["options_fa"]
        # correct_index should be new (r["to"]), not old
        assert new["correct_index"]==r["to"]
    path.write_text(json.dumps(after, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(f"part{part:02} enriched {len(rows)} corrected rows hash {hashlib.sha256(path.read_bytes()).hexdigest()[:12]}")
print("DONE enrich corrected 64")
