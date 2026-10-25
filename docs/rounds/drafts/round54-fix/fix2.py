# -*- coding: utf-8 -*-
"""Second repair pass over the cleaned round54 batches (targeted leftovers)."""
import importlib.util, json, os, re
D="/home/user/Med/.work/round54-fix"
FIX = [
 ("حضورر","حضور"), ("فاکتورهایای","فاکتورهای"), ("بریچسب‌دار","برچسب‌دار"),
 ("ارگانوژنزز","ارگانوژنز"), ("همولیزز","همولیز"), ("مونته‌ویدئوو","مونته‌ویدئو"),
 ("ولوارواژن","ولوار واژن"), ("دومرحله‌ایٔ","دومرحله‌ای"), ("اولوارت‌بندی","اولویت‌بندی"),
 ("بودغزی شدید فشار سنتی نیست","پرفشاری شدید نیست"),
 ("سندرم نگاه‌نبودن به آندروژن","سندرم عدم حساسیت به آندروژن"),
 ("پیش‌گیری‌زدایی","پیشگیری از بارداری"), ("سرویکسی","سرویکال"),
 ("بی‌روت","کرایو"), ("بیروت","کرایو"), ("شریط","شرایط"),
 ("دگلوت","بلع"), ("مجیّز","مجاز"), ("تکذیب","انکار"),
 ("عارضه‌خیر","بی‌عارضه"), ("دربند ناف است","ناشی از فشار روی بند ناف است"),
 ("شش‌ویال","ویال‌های استاندارد"), ("مشخصه‌ها","ویژگی‌ها"), ("درعمل","در عمل"),
 ("دیالتاسیون","دیلاتاسیون"), ("معمولاً بی‌لدوز متغیر است","معمولاً مارکرهای متغیر دارد"),
 ("نفوذ فراسرراهی به مثانه","نفوذ فراتر از سروزا به مثانه"),
 ("جدول امتیاز Creasy زایمان زودرس انقباضات رحمی","جدول امتیازدهی Creasy برای زایمان زودرس، انقباضات رحمی"),
 ("از سه معیار فاکتورهای است","از معیارهای امتیازدهندهٔ آن است"),
 ("دو گزینهٔ دیلاتاسیون و انقباض در شرکت «۴۶ انقباض در ۴۰ دقیقه» مطابق تعریف نوشته نشده‌اند و بنابراین جزء شیوهٔ این کلید نیستند.",
  "دو گزینهٔ دیلاتاسیون و انقباض (۴۶ انقباض در ۴۰ دقیقه) مطابق تعریف این معیار نیستند و جزء اجزای امتیازدهنده شمرده نمی‌شوند."),
 ("فاکتور هفت برای آتونی بدند کاربرد ندارد.","فاکتور هفت برای آتونی کاربرد ندارد."),
 ("عملکرد سیستم‌ها لطمه می‌زنند","عملکرد دستگاه‌ها آسیب می‌زنند"),
 ("سیستم‌ها","دستگاه‌ها"), ("جنوب","جنوب"), ("مدلول","مفهوم"),
 ("ژنیتو","ژنیتال"), ("اورژنسی","اورژانسی"), ("حلقه‌واژینال","حلقهٔ واژینال"),
 ("پیش‌قاعدگی","پیش از قاعدگی"), ("دیسمنورهٔ","دیسمنوره"), ("شایعی‌اند","شایع‌اند"),
 ("سرویکس‌اند","سرویکس هستند"), ("ناقص‌اند","ناقص‌اند"), ("قبول‌اند","قبول‌اند"),
 ("واژینویت","واژینیت"), ("ین","ین"),
]
def fix(t):
    for a,b in FIX:
        if a!=b and a in t: t=t.replace(a,b)
    return t
B={}
for i in range(1,6):
    spec=importlib.util.spec_from_file_location(f"d{i}", f"/home/user/Med/.work/round54-drafts-clean/r54_b{i}.py")
    m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); B.update(m.BATCH)
out={}
for (p,n),it in sorted(B.items(), key=lambda kv: kv[0][1]):
    out[(p,n)]={k:(fix(v) if isinstance(v,str) else [fix(x) for x in v]) for k,v in it.items()}
def ser(B):
    items=[]
    for (p,n),v in sorted(B.items(), key=lambda kv: kv[0][1]) if False else B.items():
        items.append(f"  ({p}, {n}): {{\n"+"".join(f"   \"{k}\": {json.dumps(val, ensure_ascii=True)},\n" for k,val in v.items())+"  },")
    return "{\n"+"\n".join(items)+"\n}"
for i in range(1,6):
    sub={k:v for k,v in out.items() if k[0]==28 and (i==1 and k[1]<=41 or i==2 and 42<=k[1]<=77 or i==3 and 78<=k[1]<=112 or i==4 and 114<=k[1]<=149 or i==5 and 150<=k[1]<=185)}
    # keep original batch grouping based on current clean files
    spec=importlib.util.spec_from_file_location(f"e{i}", f"/home/user/Med/.work/round54-drafts-clean/r54_b{i}.py")
    mm=importlib.util.module_from_spec(spec); spec.loader.exec_module(mm)
    keys=sorted(mm.BATCH.keys(), key=lambda k:k[1])
    sub={k:out[k] for k in keys}
    header=f"# Round 54 -- part28 rows {keys[0][1]}-{keys[-1][1]}; {len(keys)} items\n"
    open(f"/home/user/Med/.work/round54-drafts-clean/r54_b{i}.py","w",encoding="ascii").write(header+"BATCH="+ser(sub)+"\n")
    print(f"b{i}: {len(sub)}")
