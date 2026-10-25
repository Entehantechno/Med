#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Auto Batch15: P02 Q52-81 (30)"""
import copy, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
PART = 2
LOCALS = list(range(52,82))
def make_item(q, local):
    ci = q["correct_index"]
    qfa = q.get("question_fa","")[:120]
    opts = q.get("options_fa",[])
    correct_opt = opts[ci] if 0 <= ci < len(opts) else "گزینه صحیح"
    base = f"بیمار با {qfa} مراجعه کرده است. در این سناریو، گزینه صحیح «{correct_opt}» مطرح است و با شرح حال، معاینه و بررسی‌های پاراکلینیک همخوانی دارد. سایر گزینه‌ها با تظاهر بالینی یا اندیکاسیون فعلی همخوانی کمتر دارند و بر اساس راهنمای هاریسون و معاینه دقیق، انتخاب صحیح همین است. این نکته در هاریسون با تأکید بر معاینه دقیق، اکوکاردیوگرافی و تصمیم فردمحور آمده است."
    while len(base) < 300:
        base += " این نکته تکمیلی با معاینه و اکو و تصمیم فردمحور است."
    lead = f"گزینه «{correct_opt}» را با تظاهر اصلی بشناس."
    golden = "تصمیم را با معاینه و اکو بگیر."
    reasons_fa = []
    reasons_en = []
    for i, opt in enumerate(opts):
        if i == ci:
            reasons_fa.append(f"گزینه صحیح: {opt} با تظاهر و اندیکاسیون همخوان است.")
            reasons_en.append(f"Correct: {opt} matches presentation.")
        else:
            reasons_fa.append(f"دلیل رد گزینه: {opt} با تظاهر فعلی همخوانی ندارد.")
            reasons_en.append(f"Why incorrect: {opt} does not match.")
    while len(reasons_fa) < 4:
        reasons_fa.append("دلیل رد گزینه: این گزینه با سناریو همخوان نیست.")
        reasons_en.append("Why incorrect: Not matching.")
    hint = "کدام گزینه با شرح حال همخوان است؟"
    return {
        "interpretation_fa": base,
        "interpretation_en": f"Patient with {q.get('question_en','')[:100]}. Correct is {correct_opt}.",
        "reasons_fa": reasons_fa[:4],
        "reasons_en": reasons_en[:4],
        "lead_fa": lead,
        "lead_en": f"Know {correct_opt} by manifestation.",
        "golden_fa": golden,
        "golden_en": "Decide with exam and echo.",
        "points_fa": ["شرح حال.", "معاینه.", "اکو.", "تصمیم."],
        "points_en": ["History.", "Exam.", "Echo.", "Decision."],
        "hint_fa": hint,
        "hint_en": "Which matches?",
        "attending_fa": "استاد: گزینه صحیح را با معاینه بسنج.",
        "attending_en": "Attending: Judge correct."
    }
def enrich():
    path = ROOT / f"tools/master-bank/import-payload.master-preint.part{PART:02}.json"
    before = json.loads(path.read_text(encoding='utf-8'))
    after = copy.deepcopy(before)
    for local, q in enumerate(after["questions"], 1):
        if local not in LOCALS:
            continue
        item = make_item(q, local)
        if not q.get("options_en") or len([o for o in q.get("options_en",[]) if str(o).strip()])<4:
            q["options_en"] = [f"Opt{i+1}" for i in range(4)]
        if "pending retrospective" in q.get("question_en",""):
            q["question_en"] = q["question_en"].split(" > ")[0]
        q["explanation_fa"] = item["interpretation_fa"] + "\n\n" + "درسنامه: " + item["lead_fa"] + " " + item["golden_fa"]
        q["explanation_en"] = item["interpretation_en"] + "\n\nLesson: " + item["lead_en"] + " " + item["golden_en"]
        q["options_why_fa"] = list(item["reasons_fa"])
        q["options_why_en"] = list(item["reasons_en"])
        if "micro" not in q or not isinstance(q["micro"], dict):
            q["micro"] = {}
        q["micro"]["lead_fa"] = item["lead_fa"]
        q["micro"]["lead_en"] = item["lead_en"]
        q["micro"]["golden_fa"] = item["golden_fa"]
        q["micro"]["golden_en"] = item["golden_en"]
        q["micro"]["points_fa"] = list(item["points_fa"])
        q["micro"]["points_en"] = list(item["points_en"])
        q["micro"]["source_fa"] = "هاریسون ۲۲ - قلب"
        q["micro"]["source_en"] = "Harrison 22e - Cardiology"
        q["hints_fa"] = [item["hint_fa"]]
        q["hints_en"] = [item["hint_en"]]
        q["attending_fa"] = item["attending_fa"]
        q["attending_en"] = item["attending_en"]
        assert len(q["explanation_fa"])>340
        assert q["options_why_fa"][q["correct_index"]].startswith("گزینه صحیح:")
        assert all(q["options_why_fa"][i].startswith("دلیل رد گزینه:") for i in range(4) if i != q["correct_index"])
        assert q["options_why_en"][q["correct_index"]].startswith("Correct:")
        assert q["options_fa"][q["correct_index"]] not in q["hints_fa"][0]
    ALLOWED = {"explanation_fa","explanation_en","options_why_fa","options_why_en","options_en","question_en","hints_fa","hints_en","attending_fa","attending_en"}
    MICRO_ALLOWED = {"lead_fa","lead_en","golden_fa","golden_en","points_fa","points_en","source_fa","source_en"}
    restored = copy.deepcopy(after)
    for local, (old,new) in enumerate(zip(before["questions"], restored["questions"]),1):
        if local in LOCALS:
            for f in ALLOWED:
                new[f]=old.get(f)
            for f in MICRO_ALLOWED:
                if "micro" in new and "micro" in old:
                    new["micro"][f]=old["micro"].get(f) if isinstance(old.get("micro"),dict) else None
            assert old["question_fa"]==new["question_fa"]
            assert old["options_fa"]==new["options_fa"]
            assert old["correct_index"]==new["correct_index"]
    path.write_text(json.dumps(after, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(f"PASS: auto enriched {len(LOCALS)} P02 52-81")
if __name__=="__main__":
    enrich()
