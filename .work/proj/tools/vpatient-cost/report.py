"""Build reproducible CSV/JSON and an editable, cached-formula XLSX from offline runs.
Requires xlsxwriter. Run measure.mjs for floors 0,60,120 first (see README).
"""
from pathlib import Path
import json,csv,statistics,math
import xlsxwriter
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/vpatient-costs';OUT.mkdir(parents=True,exist_ok=True)
sets=[('authored_short',0,'cost-measurement'),('length_stress_60',60,'cost-60'),('length_stress_120',120,'cost-120')]
all_runs=[]; calls=[]
for label,floor,folder in sets:
    data=json.loads((ROOT/'e2e-data'/folder/'samples.json').read_text())
    for run in data['runs']:
        all_runs.append({'responseScenario':label,'patientOutputFloor':floor,**{k:v for k,v in run.items() if k!='calls'}})
        for i,c in enumerate(run['calls'],1):
            calls.append([label,run['caseId'],run['lang'],run['profile'],i,c['stage'],c['tokens']['o200k_base']['inputContent'],c['tokens']['o200k_base']['estimatedChatOverhead'],c['tokens']['o200k_base']['input'],c['tokens']['o200k_base']['output'],c['tokens']['cl100k_base']['input'],c['tokens']['cl100k_base']['output']])
summary={'method':'OFFLINE synthetic request sizing; NO live OpenRouter responses or charges','engineSha256':data['engineSha256'],'runs':all_runs}
(OUT/'samples-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
with (OUT/'per-request-tokens.csv').open('w',newline='',encoding='utf-8-sig') as f:
    w=csv.writer(f);w.writerow(['response_scenario','case','language','profile','request_index','stage','o200k_input_content','estimated_overhead','o200k_input','o200k_output','cl100k_input','cl100k_output']);w.writerows(calls)
standard=[r for r in all_runs if r['patientOutputFloor']==60 and r['lang']=='fa' and r['profile']=='standard']
I=statistics.mean(r['total']['o200k_base']['input'] for r in standard)
O=statistics.mean(r['total']['o200k_base']['output'] for r in standard)
models=[('GPT-4.1 nano',.10,.40,'https://openrouter.ai/openai/gpt-4.1-nano','o200k-based text estimate; not measured API usage'),('GPT-4.1 mini',.40,1.60,'https://openrouter.ai/openai/gpt-4.1-mini','o200k-based text estimate; not measured API usage'),('Gemini 2.5 Flash',.30,2.50,'https://openrouter.ai/google/gemini-2.5-flash','Proxy token volume; native tokenizer/reasoning differs. Page says retiring 2026-10-20.'),('Gemini 3.1 Flash Lite Preview',.25,1.50,'https://openrouter.ai/google/gemini-3.1-flash-lite-preview','Preview model; proxy token volume and additional reasoning may differ.'),('DeepSeek V3.2 / DeepInfra',.26,.38,'https://openrouter.ai/deepseek/deepseek-v3.2','Named provider rate, not cheapest promo. Proxy tokenizer; reasoning excluded.')]
prices=[{'model':name,'input_price_per_million':p,'output_price_per_million':q,'usd_per_encounter':(I*p+O*q)/1e6,'usd_per_100':(I*p+O*q)/1e4,'usd_per_3000':(I*p+O*q)*.003,'source':url,'caveat':note} for name,p,q,url,note in models]
(OUT/'price-examples.json').write_text(json.dumps({'asOf':'2026-09-18','assumed_input':I,'assumed_output':O,'cache':0,'reasoning':0,'retries':0,'models':prices},indent=2))
wb=xlsxwriter.Workbook(str(OUT/'calculator.xlsx'))
wb.set_properties({'title':'Virtual patient AI token and cost planning — offline samples','comments':'No credentials; no live-model benchmark. Prices observed 2026-09-18.'})
header=wb.add_format({'bold':True,'bg_color':'#163C56','font_color':'white','text_wrap':True,'valign':'top'})
text=wb.add_format({'text_wrap':True,'valign':'top'})
blue=wb.add_format({'font_color':'#1268C4','num_format':'0.00','bg_color':'#EDF5FF'})
num=wb.add_format({'num_format':'#,##0.00'})
usd=wb.add_format({'num_format':'$0.000000'})
note=wb.add_format({'text_wrap':True,'bg_color':'#FFF3CC','valign':'top'})
ws=wb.add_worksheet('راهنما');ws.right_to_left();ws.set_column('A:A',30);ws.set_column('B:B',105)
rows=[('وضعیت','تمام مقادیر توکن، شمارش محلی متن‌های مصنوعی هستند؛ هیچ completion زنده و هیچ صورتحساب واقعی در این پژوهش وجود ندارد.'),('تعداد نمونه','۱۸ ترکیب اصلی از ۳ کیس × ۲ زبان × ۳ طول؛ ۳۶ ترکیب اضافه برای آزمون طول پاسخ؛ مجموع ۵۴ اجرای آفلاین و ۱۶۵۶ درخواست شبیه‌سازی‌شده.'),('نمونه پیش‌فرض','میانگین ۳ کیس فارسی با ۲۰ پرسش شرح‌حال، ۳ معاینه، ۲ گزارش فاقد نتیجه ثبت‌شده و ۲ درخواست نمره/درسنامه؛ حداقل طول مصنوعی پاسخ بیمار ۶۰ توکن. طول واقعی میانگین پاسخ حدود ۶۵ توکن است.'),('هشدار','متن‌های افزوده آزمون طول، filler آشکارند؛ مکالمه طبیعی یا میانگین واقعی کاربران معرفی نمی‌شوند. دو آزمایش ثبت‌شده دیگر نیز وجود دارند که درخواست مدل ندارند.'),('AI grading','تصمیم معیارها و درسنامه باید از مدل معتبر باشند؛ جمع وزن‌ها توسط کد انجام می‌شود. شکست مدل نباید نمره قاعده‌محور نهایی ثبت کند.'),('توکنایزر','o200k_base برای تخمین GPT-4.1 مناسب است؛ overhead پیام تخمینی است. اعداد Gemini/DeepSeek فقط جایگذاری حجم فرضی‌اند، نه شمارش توکنایزر بومی آن مدل‌ها.'),('هزینه','قیمت‌ها دلار بر میلیون توکن‌اند؛ کارمزد شارژ، مالیات، reasoning، retry و caching از هزینه پایه جدا هستند. خروجی usage واقعی معمولاً reasoning را از پیش شامل می‌شود؛ آن را دوبار اضافه نکنید.'),('سهمیه','سهمیه عمومی ۵۰ یا ۱۰۰۰ درخواست روزانه و ۲۰ در دقیقه است؛ سهمیه واقعی حساب باید از /api/v1/key بررسی شود. سهمیه بین کاربران/کلیدهای همان حساب تقسیم می‌شود.'),('ویرایش','در ماشین‌حساب، سلول‌های آبی ورودی قابل تغییرند. تمام نتایج از فرمول اکسل محاسبه می‌شوند. ضریب ذخیره ۱٫۳ صرفاً پیشنهاد بودجه است، نه تضمین سقف هزینه.'),('تاریخ','2026-09-18. قیمت و ظرفیت مدل‌ها تغییر می‌کنند؛ Gemini 2.5 Flash در صفحه فعلی تاریخ پایان 2026-10-20 دارد.'),('منابع','https://openrouter.ai/docs/api_reference/limits\nhttps://openrouter.ai/docs/faq\nhttps://openrouter.ai/docs/cookbook/administration/usage-accounting\nhttps://openrouter.ai/docs/guides/best-practices/reasoning-tokens\nhttps://openrouter.ai/docs/guides/best-practices/prompt-caching')]
for r,(a,b) in enumerate(rows):ws.write(r,0,a,header);ws.write(r,1,b,text);ws.set_row(r,70 if r!=10 else 110)
ws=wb.add_worksheet('ماشین‌حساب');ws.right_to_left();ws.set_column('A:A',66);ws.set_column('B:B',24);ws.set_column('C:C',65)
ws.merge_range('A1:C1','ماشین‌حساب قابل ویرایش — نمونه آفلاین، نه صورتحساب',header)
ws.merge_range('A2:C2','پیش‌فرض برای GPT-4.1 mini و ۱۰۰ برخورد؛ هزینه پایه بدون reasoning/cache/retry است.',note)
inputs=[('توکن ورودی هر برخورد',I),('توکن خروجی قابل مشاهده هر برخورد',O),('reasoning اضافه هر برخورد — اگر قبلاً در خروجی نیست',0),('تعداد برخورد',100),('ضریب ذخیره بودجه',1.3),('قیمت ورودی / میلیون دلار',.4),('قیمت خروجی / میلیون دلار',1.6),('سهم توکن ورودی cache شده؛ بین صفر و یک',0),('قیمت cache read / میلیون دلار',.1),('درخواست API هر برخورد',27),('سهمیه روزانه درخواست',1000),('درخواست در دقیقه',20),('مبلغ اعتبار خریداری‌شده، جدا از کارمزد',10)]
for r,(label,value) in enumerate(inputs,3):ws.write(r,0,label,text);ws.write_number(r,1,value,blue)
ws.data_validation('B4:B16',{'validate':'decimal','criteria':'>=','value':0})
ws.data_validation('B11',{'validate':'decimal','criteria':'between','minimum':0,'maximum':1})
ws.data_validation('B13:B15',{'validate':'integer','criteria':'>=','value':1})
base=(I*.4+O*1.6)/1e6
outputs=[(18,'هزینه پایه هر برخورد','=((B4*((1-B11)*B9+B11*B12))+(B5+B6)*B10)/1000000',base,usd),(19,'هزینه پایه همه برخوردها','=B19*B7',base*100,usd),(20,'بودجه با ضریب ذخیره','=B20*B8',base*130,usd),(21,'کل درخواست‌های لازم','=B13*B7',2700,num),(22,'برخورد کامل در روز، بدون retry','=ROUNDDOWN(B14/B13,0)',37,num),(23,'روز لازم، اگر برخوردها در همان روز تمام شوند','=IF(B23>0,ROUNDUP(B7/B23,0),"برخورد در سهمیه یک روز جا نمی‌شود")',3,num),(24,'دقیقه ظرفیت متوسط درخواست؛ نه تضمین زمان تکمیل','=B22/B15',135,num),(25,'کارمزد مستقل خرید اعتبار با کارت','=IF(B16>0,MAX(0.8,B16*0.055),0)',.8,usd),(26,'اعتبار + کارمزد، پیش از مالیات','=B16+B26',10.8,usd)]
for row,label,formula,cached,fmt in outputs:ws.write(row,0,label,text);ws.write_formula(row,1,formula,fmt,cached)
ws.write('C7','اگر ۱۰۰ برخورد در روز دارید، برای هزینه ماه ۳۰روزه تعداد را ۳۰۰۰ بگذارید.',text)
ws.write('C9','ضریب ۳۰٪ ذخیره، هزینه اضافی قطعی نیست.',text)
ws.write('C11','cache فقط با اندازه‌گیری واقعی فرض شود؛ پیش‌فرض صفر است.',text)
ws.write('C16','۱۰ اعتبار خرید، با کارمزد حداقل ۰٫۸ دلار → ۱۰٫۸ دلار پیش از مالیات.',text)
ws.freeze_panes(3,1)
ws=wb.add_worksheet('قیمت مدل‌ها');ws.right_to_left();ws.set_column('A:A',30);ws.set_column('B:F',20);ws.set_column('G:G',60);ws.set_column('H:H',85)
heads=['مدل','ورودی / ۱M دلار','خروجی / ۱M دلار','هر برخورد دلار','تعداد انتخاب‌شده دلار','۳۰۰۰ برخورد دلار','منبع','محدودیت']
ws.write_row(0,0,heads,header)
for r,item in enumerate(prices,1):
 ws.write(r,0,item['model']);ws.write_number(r,1,item['input_price_per_million'],blue);ws.write_number(r,2,item['output_price_per_million'],blue)
 rr=r+1;formula=f"=('ماشین‌حساب'!$B$4*B{rr}+('ماشین‌حساب'!$B$5+'ماشین‌حساب'!$B$6)*C{rr})/1000000"
 ws.write_formula(r,3,formula,usd,item['usd_per_encounter']);ws.write_formula(r,4,f"=D{rr}*'ماشین‌حساب'!$B$7",usd,item['usd_per_100']);ws.write_formula(r,5,f'=D{rr}*3000',usd,item['usd_per_3000']);ws.write_url(r,6,item['source']);ws.write(r,7,item['caveat'],text);ws.set_row(r,55)
ws.freeze_panes(1,1)
ws=wb.add_worksheet('سهمیه');ws.right_to_left();ws.set_column('A:A',42);ws.set_column('B:G',22)
ws.write_row(0,0,['سناریو','پرسش شرح‌حال','معاینه','گزارش ناموجود','API با نمره و درسنامه','برخورد/روز با ۵۰','برخورد/روز با ۱۰۰۰'],header)
for r,(label,n,e,u) in enumerate([('فقط یک سؤال و ارزیابی',1,0,0),('کوتاه',10,2,0),('متوسط',20,3,2),('طولانی',40,5,4)],1):
 rr=r+1;R=n+e+u+2;ws.write(r,0,label);ws.write_row(r,1,[n,e,u]);ws.write_formula(r,4,f'=SUM(B{rr}:D{rr})+2',num,R);ws.write_formula(r,5,f'=ROUNDDOWN(50/E{rr},0)',num,50//R);ws.write_formula(r,6,f'=ROUNDDOWN(1000/E{rr},0)',num,1000//R)
ws=wb.add_worksheet('نمونه‌ها');ws.right_to_left();ws.set_column('A:A',22);ws.set_column('B:E',14);ws.set_column('F:J',22)
ws.write_row(0,0,['حالت پاسخ','کیس','زبان','طول','درخواست','ورودی o200k','خروجی o200k','ورودی cl100k','خروجی cl100k','حداقل هدف پاسخ بیمار'],header)
for row,r in enumerate(all_runs,1):ws.write_row(row,0,[r['responseScenario'],r['caseId'],r['lang'],r['profile'],r['requestCount'],r['total']['o200k_base']['input'],r['total']['o200k_base']['output'],r['total']['cl100k_base']['input'],r['total']['cl100k_base']['output'],r['patientOutputFloor']])
ws.autofilter(0,0,len(all_runs),9);ws.freeze_panes(1,0)
wb.close()
print(json.dumps({'runs':len(all_runs),'synthetic_requests':len(calls),'standard_fa_input':I,'standard_fa_output':O,'workbook':str(OUT/'calculator.xlsx')},ensure_ascii=False))
