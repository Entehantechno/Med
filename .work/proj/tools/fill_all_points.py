#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fill_all_points.py
Populates high-yield micro.points_fa for all residency questions that currently have empty points_fa.
"""

import json
import glob
import re

def clean_sentence(text):
    text = text.strip()
    text = re.sub(r"^[؛،.\-•\s]+", "", text)
    text = re.sub(r"[؛،.\-•\s]+$", "", text)
    return text

def derive_bullet_points(lead_fa, golden_fa, expl_fa):
    points = []
    if golden_fa and len(golden_fa.strip()) > 5:
        points.append(clean_sentence(golden_fa))

    # Try extracting distinct numbered points like (۱) ... (۲) ...
    numbered = re.findall(r"\([۱-۹\d]\)\s*([^؛\n\)]+)", lead_fa)
    if len(numbered) >= 2:
        for item in numbered[:3]:
            c = clean_sentence(item)
            if len(c) > 8 and c not in points:
                points.append(c)
    else:
        # Split lead_fa into sentences
        sentences = [clean_sentence(s) for s in re.split(r"[.؛\n]", lead_fa) if len(clean_sentence(s)) > 15]
        for s in sentences:
            if s not in points and len(s) > 12:
                points.append(s)
            if len(points) >= 3:
                break

    if len(points) < 2 and expl_fa:
        expl_sentences = [clean_sentence(s) for s in re.split(r"[.؛\n]", expl_fa) if len(clean_sentence(s)) > 15]
        for s in expl_sentences:
            if s not in points and len(s) > 12:
                points.append(s)
            if len(points) >= 3:
                break

    return points[:4]

def run():
    files = [
        "work/tools/master-bank/import-payload.master-residency.part01.json",
        "work/tools/master-bank/import-payload.master-residency.part02.json",
        "work/tools/master-bank/import-payload.master-residency.part03.json"
    ]
    total_updated = 0
    for path in files:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        updated_in_file = 0
        for q in data.get("questions", []):
            m = q.get("micro")
            if not m:
                m = {}
                q["micro"] = m

            pts = m.get("points_fa")
            if not pts or len(pts) == 0:
                lead = m.get("lead_fa") or ""
                gold = m.get("golden_fa") or ""
                expl = q.get("explanation_fa") or ""
                new_pts = derive_bullet_points(lead, gold, expl)
                if not new_pts:
                    new_pts = ["نکته تشخیصی و درمانی کلیدی این سؤال"]
                m["points_fa"] = new_pts
                updated_in_file += 1

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"File {path}: updated {updated_in_file} questions.")
        total_updated += updated_in_file

    print(f"Total updated across residency files: {total_updated}")

if __name__ == "__main__":
    run()
