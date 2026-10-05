# -*- coding: utf-8 -*-
"""Final micro-pass: leftover contaminated spans -> canonical round54 drafts."""
import importlib.util, json, re, os
SRC="/home/user/Med/.work/round54-drafts-clean"
DST="/home/user/Med/.work/round54-drafts"
FIX = [
 (r"بس[\u0080-\u02ff]+ی","جزو بررسی‌های ابتدایی نیستند"),
 (r"۱۰-۱۳\u207a\u2076","۱۰ تا ۱۳ هفته و ۶ روز"),
 (r"\u207a\u2076"," تابستان "),
 (r"شش\u200c?ویال","ویال‌های استاندارد"),
 (r"سین\u200c?قل فشار و دیورتیک","فقط کنترل فشار و دیورتیک"),
 (r"در چنین وضعی افراط است","در چنین وضعی زیاده‌روی است"),
 (r"در چنین سؤالی","در چنین پرسشی"),
 (r"دیالتاسیون","دیلاتاسیون"),
]
def fix(t):
    for a,b in FIX: t=re.sub(a,b,t)
    return t
def ser(B):
    return "{\n"+"\n".join(
        f"  ({p}, {n}): {{\n"+"".join(f"   \"{k}\": {json.dumps(v, ensure_ascii=True)},\n" for k,v in item.items())+"  },"
        for (p,n),item in B.items())+"\n}"
for i in range(1,6):
    spec=importlib.util.spec_from_file_location(f"h{i}", f"{SRC}/r54_b{i}.py")
    m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    keys=sorted(m.BATCH.keys(), key=lambda k:k[1])
    out={k:{kk:(fix(vv) if isinstance(vv,str) else [fix(x) for x in vv]) for kk,vv in m.BATCH[k].items()} for k in keys}
    open(f"{DST}/r54_b{i}.py","w",encoding="ascii").write(
        f"# Round 54 -- part28 rows {keys[0][1]}-{keys[-1][1]}; {len(keys)} items\nBATCH="+ser(out)+"\n")
    print(f"b{i}: {len(out)} -> drafts")
