#!/usr/bin/env python3
import sys, json, re
from docx import Document

def extract(fname):
    doc = Document(fname)
    students = []
    for table in doc.tables:
        for row in table.rows:
            texts = [c.text.strip() for c in row.cells]
            seen = set()
            uniq = []
            for t in texts:
                t = t.strip()
                if not t or t == ".":
                    continue
                if t not in seen:
                    seen.add(t)
                    uniq.append(t)
            cand_nos = [x for x in uniq if re.fullmatch(r"\d{8,16}", x.replace(" ", ""))]
            if not cand_nos:
                continue
            fields = {"تکنولوژی اتاق عمل", "پزشکی"}
            filtered = []
            student_no = cand_nos[0]
            for x in uniq:
                if x == student_no:
                    continue
                if x in fields:
                    continue
                if re.fullmatch(r"\d{1,3}", x):
                    continue
                if x in {"نام", "نام خانوادگی", "شماره دانشجویی", "رشته", "ردیف", "ملاحظات", "علوم پزشکی اراک", "لیست حضور و غیاب", "بافت شناسی", "کارآموزی بیماریهای داخلی", "1405/06/18: تاریخ صدور", "1 : صفحه"}:
                    continue
                # skip header like "1399" etc? no
                filtered.append(x)
            if len(filtered) >= 2:
                family = filtered[0]
                first = filtered[1]
            elif len(filtered) == 1:
                family = ""
                first = filtered[0]
            else:
                family = ""
                first = ""
            field = ""
            for x in uniq:
                if x in fields:
                    field = x
                    break
            students.append({"student_no": student_no, "family": family, "first": first, "field": field})
    return students

if __name__ == "__main__":
    fname = sys.argv[1]
    data = extract(fname)
    json.dump(data, sys.stdout, ensure_ascii=False)
