#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json, pathlib, re
from collections import defaultdict, Counter
ROOT = pathlib.Path("/home/user/Med/.work/proj/tools/master-bank")
OUT_MD = pathlib.Path("/home/user/Med/AUDIT-BANK-DETAILED-2026-10-04.md")
OUT_CSV = pathlib.Path("/home/user/Med/AUDIT-BANK-FAILURES-2026-10-04.csv")
MIN_EXPL=500
MIN_WHY=20
MIN_LEAD=10
MIN_GOLDEN=10
MIN_POINT=10
GENERIC_LEAD=["در تابلوی بالینی مطروحه","اقدام استاندارد و انتخابی است"]
GENERIC_GOLDEN=["نکته کلیدی بالینی: بر اساس رفرنس‌های معتبر","مبانی طب کودکان نلسون ویرایش ۲۱)، انتخاب"]
GENERIC_POINT=["تشخیص بالینی: توجه ویژه","انتخاب درمانی/تشخیصی: برتری","رویکرد احتیاطی: اجتناب","پایش بالینی: پایش مداوم"]
PLACEHOLDER_EXPL=["نیازمند تطبیق دقیق با رفرنس","جهت ممیزی کلید در صف بررسی"]
BAD_WHY_PREFIX="دلیل بررسی گزینه:"
CONCEDE_PHRASES=('رژیم درستی است','گزینه‌ی درستی است','هم درست است','نیز صحیح است','هم صحیح است','درست است','صحیح است','قابل قبول است','مؤثر است')
REJECT_PHRASES=('ولی','اما','نیست','نادرست','اشتباه','غلط','بجز','کافی نیست','توصیه نمی','بیش‌درمانی','خطرناک','نه ','بی‌مورد','کنترااندیکه','ناکافی','رد می‌شود','انتخاب اول نیست','به‌ندرت','پایین','کمتر','ندارد','نمی','فقط','مگر','در حالی که','برعکس','اختصاصی‌تر','دقیق‌تر','ممنوع','بی‌اثر','تفاوت با کلید')
NEG_PAT=re.compile('نمی‌باشد|نمیباشد|صحیح نیست|درست نیست|نادرست است|غلط است|کدام غلط|بجز|به‌جز|به جز|جز مورد|نادرست کدام|اشتباه است|EXCEPT|except|صحیح نمی‌باشد|نیست\\s*؟|کدام.{0,20}نمی|نمی‌پذیرید|نمیپذیرید|نمی‌گردد|نمیگردد|کاربردی ندارد|ندارد\\s*؟|محسوب نمی|توصیه نمی|انتخاب اول نیست|نمیشود|نمی‌شود|منع مصرف|کدام.{0,25}ندارد|کدام.{0,25}نیست|نادرست[^؟]{0,45}است|به غیر|به ?وز')
def is_negative(q):
    if (q.get('question_style') or '') == 'negative':
        return True
    return bool(NEG_PAT.search(q.get('question_fa') or ''))
failures=[]
stats=Counter()
file_stats=defaultdict(Counter)
for p in sorted(ROOT.glob("import-payload*.json")):
    data=json.loads(p.read_text(encoding="utf-8"))
    for q in data["questions"]:
        qno=q.get("question_no")
        qid=q.get("tags", [""])[0] if q.get("tags") else ""
        fid=p.name
        reasons=[]
        ci=q.get("correct_index")
        if not isinstance(ci,int) or ci not in (0,1,2,3):
            reasons.append("NULL_KEY: correct_index نامعتبر/None")
            stats["NULL_KEY"]+=1
            file_stats[fid]["NULL_KEY"]+=1
        expl=(q.get("explanation_fa") or "").strip()
        expl_len=len(expl)
        if expl_len < MIN_EXPL:
            reasons.append(f"SHORT_EXPL: {expl_len} < {MIN_EXPL}")
            stats["SHORT_EXPL"]+=1
            file_stats[fid]["SHORT_EXPL"]+=1
        for ph in PLACEHOLDER_EXPL:
            if ph in expl:
                reasons.append(f"PLACEHOLDER_EXPL: حاوی «{ph}»")
                stats["PLACEHOLDER_EXPL"]+=1
                file_stats[fid]["PLACEHOLDER_EXPL"]+=1
                break
        if expl_len >= MIN_EXPL:
            if not any(r in expl for r in ["هاریسون","نلسون","ویلیامز","شوارتز","منبع:"]):
                reasons.append("MISSING_REF: بدون ارجاع هاریسون/نلسون")
                stats["MISSING_REF"]+=1
                file_stats[fid]["MISSING_REF"]+=1
            if expl.count("\n\n") < 2:
                reasons.append("SINGLE_PARAGRAPH: تک‌پاراگرافی (<3 پاراگراف)")
                stats["SINGLE_PARAGRAPH"]+=1
                file_stats[fid]["SINGLE_PARAGRAPH"]+=1
        why=q.get("options_why_fa") or []
        if len(why)!=4:
            reasons.append(f"BAD_WHY_COUNT: {len(why)} !=4")
            stats["BAD_WHY_COUNT"]+=1
            file_stats[fid]["BAD_WHY_COUNT"]+=1
        else:
            for idx,w in enumerate(why):
                w=w or ""
                if len(w.strip())<MIN_WHY:
                    reasons.append(f"SHORT_WHY[{idx}]: {len(w.strip())} < {MIN_WHY}")
                    stats["SHORT_WHY"]+=1
                    file_stats[fid]["SHORT_WHY"]+=1
                if BAD_WHY_PREFIX in w:
                    reasons.append(f"BAD_WHY_PREFIX[{idx}]: حاوی «{BAD_WHY_PREFIX}»")
                    stats["BAD_WHY_PREFIX"]+=1
                    file_stats[fid]["BAD_WHY_PREFIX"]+=1
                if isinstance(ci,int) and 0 <= ci <4:
                    if idx==ci:
                        if not w.strip().startswith("صحیح است؛"):
                            reasons.append(f"WRONG_PREFIX_CORRECT[{idx}]: باید با «صحیح است؛» شروع شود")
                            stats["WRONG_PREFIX"]+=1
                            file_stats[fid]["WRONG_PREFIX"]+=1
                    else:
                        if not w.strip().startswith("نادرست است؛"):
                            reasons.append(f"WRONG_PREFIX_DISTRACTOR[{idx}]: باید با «نادرست است؛» شروع شود")
                            stats["WRONG_PREFIX"]+=1
                            file_stats[fid]["WRONG_PREFIX"]+=1
                        if not is_negative(q):
                            for c in CONCEDE_PHRASES:
                                mm=re.search(r'(?<![\u0600-\u06FF])'+re.escape(c), w)
                                if not mm: continue
                                if re.search('نادرست است؛|دلیل رد|دلیل انتخاب', w): break
                                lead=w[max(0,mm.start()-40):mm.start()+len(c)]
                                if re.search('انتخاب|گزینه‌ی درست|پاسخ درست|پاسخ صحیح|ایمنی|عوارض|تحمل|کمتر از|بیشتر از|نسبت به', lead): break
                                if not any(r in w[mm.start():] for r in REJECT_PHRASES):
                                    reasons.append(f"TWO_CORRECT[{idx}]: distractor conceded «{c}»")
                                    stats["TWO_CORRECT"]+=1
                                    file_stats[fid]["TWO_CORRECT"]+=1
                                    break
        micro=q.get("micro") or {}
        lead=(micro.get("lead_fa") or "").strip()
        golden=(micro.get("golden_fa") or "").strip()
        points=micro.get("points_fa") or []
        if len(lead) < MIN_LEAD:
            reasons.append(f"SHORT_LEAD: {len(lead)} < {MIN_LEAD}")
            stats["SHORT_LEAD"]+=1
            file_stats[fid]["SHORT_LEAD"]+=1
        else:
            for gp in GENERIC_LEAD:
                if gp in lead:
                    reasons.append(f"GENERIC_LEAD: حاوی «{gp}»")
                    stats["GENERIC_LEAD"]+=1
                    file_stats[fid]["GENERIC_LEAD"]+=1
                    break
            if "؟" not in lead and "?" not in lead:
                reasons.append("LEAD_NOT_SOCRATIC: بدون علامت سؤال «؟»")
                stats["LEAD_NOT_SOCRATIC"]+=1
                file_stats[fid]["LEAD_NOT_SOCRATIC"]+=1
        if len(golden) < MIN_GOLDEN:
            reasons.append(f"SHORT_GOLDEN: {len(golden)} < {MIN_GOLDEN}")
            stats["SHORT_GOLDEN"]+=1
            file_stats[fid]["SHORT_GOLDEN"]+=1
        else:
            for gp in GENERIC_GOLDEN:
                if gp in golden:
                    reasons.append(f"GENERIC_GOLDEN: حاوی «{gp}»")
                    stats["GENERIC_GOLDEN"]+=1
                    file_stats[fid]["GENERIC_GOLDEN"]+=1
                    break
        if len(points)!=4:
            reasons.append(f"BAD_POINTS_COUNT: {len(points)} !=4")
            stats["BAD_POINTS_COUNT"]+=1
            file_stats[fid]["BAD_POINTS_COUNT"]+=1
        else:
            for pi,pt in enumerate(points):
                pt=pt or ""
                if len(pt.strip())<MIN_POINT:
                    reasons.append(f"SHORT_POINT[{pi}]: {len(pt.strip())} < {MIN_POINT}")
                    stats["SHORT_POINT"]+=1
                    file_stats[fid]["SHORT_POINT"]+=1
                for gp in GENERIC_POINT:
                    if gp in pt:
                        reasons.append(f"GENERIC_POINT[{pi}]: حاوی «{gp}»")
                        stats["GENERIC_POINT"]+=1
                        file_stats[fid]["GENERIC_POINT"]+=1
                        break
        if not (q.get("question_fa") or "").strip():
            reasons.append("EMPTY_QUESTION_FA")
            stats["EMPTY_QUESTION"]+=1
            file_stats[fid]["EMPTY_QUESTION"]+=1
        opts=q.get("options_fa") or []
        if len(opts)!=4 or any(not (o or "").strip() for o in opts):
            reasons.append("BAD_OPTIONS_FA")
            stats["BAD_OPTIONS"]+=1
            file_stats[fid]["BAD_OPTIONS"]+=1
        if reasons:
            failures.append({"file":fid,"qno":qno,"qid":qid,"subject":q.get("subject_fa"),"chapter":q.get("chapter_fa"),"ci":ci,"expl_len":expl_len,"reasons":reasons})
failures_sorted=sorted(failures, key=lambda x: (x["file"], x["qno"]))
import csv
with open(OUT_CSV,"w",newline="",encoding="utf-8") as f:
    w=csv.writer(f)
    w.writerow(["file","question_no","qid","subject","chapter","correct_index","expl_len","reasons"])
    for rec in failures_sorted:
        w.writerow([rec["file"],rec["qno"],rec["qid"],rec["subject"],rec["chapter"],rec["ci"],rec["expl_len"]," | ".join(rec["reasons"])])
with open(OUT_MD,"w",encoding="utf-8") as out:
    out.write("# گزارش غربالگری دقیق بانک سؤالات — ۲۰۲۶-۱۰-۰۴\n\n")
    out.write(f"**تاریخ:** ۲۰۲۶-۱۰-۰۴ — **شاخه:** `arena/01a0be99-med` — **مجموع:** 11604 (۵۴ payload)\n\n")
    out.write("## چکیده معیارها\n\n")
    out.write(f"- توضیح هر گزینه: `options_why_fa` ۴تایی با پیشوند دقیق و طول ≥{MIN_WHY}\n")
    out.write(f"- درسنامه: `explanation_fa` ≥{MIN_EXPL}، ≥۳ پاراگراف، حاوی ارجاع و بدون placeholder\n")
    out.write(f"- micro: `lead_fa` سقراطی (حاوی «؟») ≥{MIN_LEAD}، `golden_fa` ≥{MIN_GOLDEN}، `points_fa` ۴تایی ≥{MIN_POINT} و غیرgeneric\n")
    out.write("- کلید: `correct_index` معتبر و بدون two-correct\n\n")
    out.write("## نتایج کلی\n\n")
    out.write(f"- **سالم:** {11604 - len(failures)} / 11604 ({(11604 - len(failures))/11604*100:.1f}٪)\n")
    out.write(f"- **ناسالم:** {len(failures)} / 11604 ({len(failures)/11604*100:.1f}٪)\n")
    out.write(f"- **انواع اشکال:**\n")
    for k,v in stats.most_common():
        out.write(f"  - `{k}`: {v}\n")
    out.write("\n## توزیع به تفکیک فایل (Top 20)\n\n| فایل | کل | جزئیات |\n|---|---|---|\n")
    from collections import Counter as C
    per_file_total=C()
    for rec in failures:
        per_file_total[rec["file"]]+=1
    for fid,tot in per_file_total.most_common(20):
        details=", ".join(f"{k}:{v}" for k,v in file_stats[fid].most_common(3))
        out.write(f"| `{fid}` | {tot} | {details} |\n")
    out.write("\n## فهرست ناسالم (۲۰۰ اول — کامل در CSV)\n\n")
    out.write(f"CSV: `{OUT_CSV.name}` — {len(failures)} ردیف\n\n")
    out.write("| فایل | QNo | QID | موضوع | فصل | CI | طول | اشکالات |\n|---|---|---|---|---|---|---|---|\n")
    for rec in failures_sorted[:200]:
        rs="<br>".join(rec["reasons"][:3])
        if len(rec["reasons"])>3:
            rs+=f"<br>… +{len(rec['reasons'])-3}"
        out.write(f"| `{rec['file']}` | {rec['qno']} | {rec['qid']} | {rec['subject']} | {rec['chapter']} | {rec['ci']} | {rec['expl_len']} | {rs} |\n")
    if len(failures)>200:
        out.write(f"\n> کامل {len(failures)} در CSV\n")
    out.write("\n## اولویت اصلاح\n\n1. P0 — NULL_KEY / TWO_CORRECT / WRONG_PREFIX\n2. P1 — SHORT_EXPL / PLACEHOLDER / MISSING_REF / SINGLE_PARAGRAPH\n3. P2 — GENERIC_MICRO / LEAD_NOT_SOCRATIC\n4. P3 — SHORT_POINT\n\n---\n")
    out.write(f"_تولید: {len(failures)} ناسالم از 11604_\n")
print(f"Audit done: {len(failures)} failures / 11604")
for k,v in stats.most_common(10):
    print(f"  {k}: {v}")
print(f"MD: {OUT_MD}")
print(f"CSV: {OUT_CSV}")
