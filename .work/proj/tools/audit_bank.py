#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Comprehensive structural/quality audit of the master bank (read-only).

Reports per part: micro coverage, options_why prefix compliance, explanation
length stats, stub detection, and edited-batch detection (the enrichment
format used by the curated rounds). Output: console table + JSON report.
Never modifies question_fa/options_fa — this script is read-only.
"""
import json, os, re, sys, statistics, collections

BANK = os.path.join(os.path.dirname(__file__), "master-bank")
OUT = os.path.join(os.path.dirname(__file__), "..", "work", "audit-report.json")
PART_RE = re.compile(r"^import-payload\.(master-preint|master-residency)\.part(\d+)\.json$")

OK, BAD = "گزینه صحیح: ", "دلیل رد گزینه: "

def q_report(q, idx):
    rep = {"i": idx}
    micro = q.get("micro")
    rep["micro"] = bool(
        micro and isinstance(micro, dict)
        and len((micro.get("lead_fa") or "").strip()) > 20
        and len((micro.get("golden_fa") or "").strip()) > 20
        and isinstance(micro.get("points_fa"), list)
        and len(micro["points_fa"]) == 4
        and len(set(micro["points_fa"])) == 4
        and all(len(str(p).strip()) > 20 for p in micro["points_fa"])
    )
    why = q.get("options_why_fa") or []
    exp_len = len((q.get("explanation_fa") or "").strip())
    rep["exp_len"] = exp_len
    rep["whyN"] = len(why)
    rep["why_prefix_ok"] = False
    keyless = q.get("keyless") is True
    ci = q.get("correct_index")
    if len(why) == 4:
        if keyless:
            rep["why_prefix_ok"] = all(isinstance(w, str) and (w.startswith(OK) or w.startswith(BAD)) for w in why)
        else:
            rep["why_prefix_ok"] = all(
                isinstance(w, str) and (w.startswith(OK) if i == ci else w.startswith(BAD))
                for i, w in enumerate(why)
            )
    return rep

def main():
    totals = collections.Counter()
    parts_out = []
    for fam in ("master-preint", "master-residency"):
        for n in sorted(os.listdir(BANK)):
            m = PART_RE.match(n)
            if not m or m.group(1) != fam:
                continue
            pno = int(m.group(2))
            body = json.load(open(os.path.join(BANK, n), encoding="utf-8"))
            rows = body.get("questions", [])
            reps = [q_report(q, i) for i, q in enumerate(rows)]
            n = len(reps) or 1
            micro_n = sum(r["micro"] for r in reps)
            why_n = sum(r["whyN"] == 4 for r in reps)
            pref_n = sum(r["why_prefix_ok"] for r in reps)
            lens = [r["exp_len"] for r in reps]
            stub_n = sum(l < 120 for l in lens)
            parts_out.append({
                "part": f"{fam[-7:]}:part{pno:02d}",
                "qty": len(reps),
                "micro%": round(micro_n * 100 / n, 1),
                "why=4%": round(why_n * 100 / n, 1),
                "prefixOK%": round(pref_n * 100 / n, 1),
                "exp_min": min(lens) if lens else 0,
                "exp_med": int(statistics.median(lens)) if lens else 0,
                "exp_<120": stub_n,
                # first contiguous enriched window (micro+prefix both true)
                "enriched_rows": [i for i, r in enumerate(reps) if r["micro"] and r["why_prefix_ok"]][:5],
            })
            totals.update({"micro": micro_n, "why4": why_n, "prefix": pref_n, "rows": n})
    for p in parts_out:
        print(f"{p['part']:>11} qty={p['qty']:>3} micro={p['micro%']:>5}% why4={p['why=4%']:>5}% prefixOK={p['prefixOK%']:>5}% exp_med={p['exp_med']:>5} exp<120={p['exp_<120']:>3} e.g.{p['enriched_rows']}")
    print("-" * 100)
    t = totals
    print(f"TOTAL rows={t['rows']}  micro={t['micro']} ({t['micro']*100/t['rows']:.1f}%)  why4={t['why4']} ({t['why4']*100/t['rows']:.1f}%)  prefixOK={t['prefix']} ({t['prefix']*100/t['rows']:.1f}%)")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({"parts": parts_out, "totals": dict(t)}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("wrote", OUT)

if __name__ == "__main__":
    main()
