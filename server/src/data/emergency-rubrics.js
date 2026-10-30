// Original educational summaries, not copied guideline text. These apply to
// future encounters; sealed encounter checklists and prior scores stay intact.
const item = (id, section, fa, en, keys, source) => ({id, section, weight: 1, fa, en, keys, source});
const hf = 'https://www.nice.org.uk/guidance/cg187/chapter/Recommendations';
const bleed = 'https://www.nice.org.uk/guidance/cg141/chapter/Recommendations';
export const EMERGENCY_RUBRICS = {
  101: {
    name_fa: 'نارسایی قلبی حاد — معیار آموزشی نسخه ۱',
    name_en: 'Acute heart failure — educational rubric v1',
    legacyId: 1,
    legacyName: 'ACS Checklist',
    legacyHash: '541e0fa9641e14e036cfb0b5554c19865531f761f84c9b14accf35e914eb24af',
    items: [
      item('hf-consent','communication','معرفی، کسب رضایت و توضیح ارزیابی','Introduce self, seek consent and explain assessment',["معرفی|من دکتر|من پزشک|دکتر شما|پزشک شما|من دانشجو|من اکسترن|من اینترن|دانشجوی پزشکی|introduce|i am dr|i am doctor|i am a medical student|i am a student|i am an extern|i am an intern", "اجازه هست|با اجازه|رضایت دارید|کسب رضایت|consent|permission", "توضیح|explain|explanation"],hf+'#initial-pharmacological-treatment'),
      item('hf-history','history','شرح‌حال تنگی‌نفس، ارتوپنه، ادم و تغییر وزن','Assess dyspnoea, orthopnoea, oedema and weight change',["تنگی نفس|dyspn|shortness of breath", "ارتوپنه|orthopn|بالش|شب بیدار", "ادم|oedema|edema|ورم|تورم", "وزن|weight|کیلو|kg"],hf+'#diagnosis-assessment-and-monitoring'),
      item('hf-trigger','history','بررسی عوامل تشدید، پایبندی به دارو و بیماری‌های همراه','Assess precipitants, medication adherence and comorbidities',["precipitant|trigger|عامل|محرک|علت|عفونت|infection|ischaem|ischem|ایسکمی", "adherence|compliance|پایبندی|مصرف دارو|دارو|نسخه", "comorbid|بیماری زمینه|دیابت|فشار خون|hypertens|diabet|کلیه|کبد"],hf+'#diagnosis-assessment-and-monitoring'),
      item('hf-exam','exam','ارزیابی علائم حیاتی، اکسیژناسیون، پرفیوژن و احتقان','Assess vital signs, oxygenation, perfusion and congestion',["vitals|علائم حیاتی|فشار خون|bp|pulse|نبض", "saturation|oxygen|اشباع|spo2|اکسیژن", "perfusion|پرفیوژن|cold|سرد|extremit|اندام", "congestion|احتقان|crackles|رال|jvp|ژوگولار"],hf+'#diagnosis-assessment-and-monitoring'),
      item('hf-ecg','workup','درخواست ECG و تصویربرداری قفسه سینه در ارزیابی اولیه','Request ECG and chest imaging as part of initial assessment',["ecg|نوار قلب|ekg", "chest x-ray|cxr|گرافی سینه|رادیوگرافی|x-ray|chest radiograph"],hf+'#diagnosis-assessment-and-monitoring'),
      item('hf-blood','workup','ارزیابی عملکرد کلیه، الکترولیت‌ها و پپتید ناتریورتیک متناسب با سناریو','Assess renal function, electrolytes and appropriate natriuretic peptide testing',["creatinine|کراتینین|renal function|کلیه|bun|اوره", "electrolyte|الکترولیت|sodium|potassium|پتاسیم|سدیم", "bnp|nt-probnp|natriuretic|ناتریورتیک"],hf+'#diagnosis-assessment-and-monitoring'),
      item('hf-echo','workup','بررسی اکو و اختلال ساختاری یا عملکردی قلب','Review echocardiography and cardiac structural/function abnormalities',["echo|echocardiograph|اکو|اکوکاردیو", "ejection|ef|کسر تخلیه|function|عملکرد|دریچه|valve|structur|ساختار"],hf+'#diagnosis-assessment-and-monitoring'),
      item('hf-diagnosis','diagnosis','تشخیص نارسایی قلبی حاد با احتقان بر اساس یافته‌های سناریو','Diagnose acute heart failure with congestion using the recorded findings',["heart failure|نارسایی قلب|adhf", "congestion|احتقان|pulmonary oedema|pulmonary edema|ادم ریوی|acute|حاد"],hf+'#diagnosis-assessment-and-monitoring'),
      item('hf-diuretic','management','درمان دیورتیک وریدی متناسب با وضعیت بیمار','Plan appropriate intravenous diuretic therapy',["diuretic|دیورتیک|ادرار آور|furosemide|فوروزماید", "intravenous|iv|وریدی|تزریق ورید"],hf+'#initial-pharmacological-treatment'),
      item('hf-monitor','management','پایش عملکرد کلیه، وزن و برون‌ده ادرار هنگام درمان','Monitor renal function, weight and urine output during treatment',["urine output|برون‌ده ادرار|برون ده ادرار|ادرار|urine", "renal function|عملکرد کلیه|کلیه|creatinin|کراتینین", "weight|وزن|monitor|پایش|مانیتور"],hf+'#initial-pharmacological-treatment'),
      item('hf-escalate','management','ارزیابی نیاز به حمایت تنفسی و ارجاع متناسب با شدت؛ نه استفادهٔ روتین برای همه','Assess respiratory support/escalation according to severity, not routine use for everyone',["respiratory support|حمایت تنفسی|ventilat|تهویه|cpap|nippv|bipap|mechanical", "escalat|ارجاع|icu|مراقبت ویژه|severity|شدت|بستری"],hf+'#initial-non-pharmacological-treatment'),
    ],
  },
  102: {
    name_fa: 'خونریزی گوارشی فوقانی — معیار آموزشی نسخه ۱',
    name_en: 'Upper gastrointestinal bleeding — educational rubric v1',
    legacyId: 2,
    legacyName: 'Abdominal Pain Checklist',
    legacyHash: '53a6b12661750cee9118076115c86266bf387ee49788c211ed493404e04b2ce2',
    items: [
      item('ugib-consent','communication','معرفی، رضایت و توضیح ارزیابی فوری','Introduce self, seek consent and explain urgent assessment',["معرفی|من دکتر|من پزشک|دکتر شما|پزشک شما|من دانشجو|من اکسترن|من اینترن|دانشجوی پزشکی|introduce|i am dr|i am doctor|i am a medical student|i am a student|i am an extern|i am an intern", "اجازه هست|با اجازه|رضایت دارید|کسب رضایت|consent|permission", "توضیح|explain|explanation"],bleed+'#information-and-support-for-patients-and-carers'),
      item('ugib-history','history','بررسی هماتمز، ملنا، زمان شروع و علائم کاهش حجم','Assess haematemesis, melaena, onset and symptoms of volume loss',["hematemesis|haematemesis|هماتمز|استفراغ خون|قی خونی|vomit blood", "melena|melaena|ملنا|مدفوع سیاه|سیاه|تیره", "syncope|سنکوپ|سرگیجه|dizz|lightheaded|volume loss|hypovol|تعریق"],bleed+'#risk-assessment'),
      item('ugib-drugs','history','بررسی NSAID، ضدانعقاد و سابقهٔ زخم یا بیماری کبد','Review NSAIDs, anticoagulants, ulcer history and liver disease',["nsaid|ضدالتهاب|ibuprofen|آسپرین|aspirin|دیکلوفناک|diclofenac", "anticoagul|ضدانعقاد|warfarin|وارفارین|doac|apixaban|rivaroxaban|کلوپیدوگرل|clopidogrel", "ulcer|زخم|peptic|پپتیک|معده", "liver|کبد|cirrho|سیروز|hepat"],bleed+'#control-of-bleeding-and-prevention-of-re-bleeding-in-patients-on-nsaids-aspirin-or-clopidogrel'),
      item('ugib-exam','exam','ارزیابی علائم حیاتی، سطح هوشیاری، پرفیوژن و ناپایداری همودینامیک','Assess vital signs, consciousness, perfusion and haemodynamic instability',["vitals|علائم حیاتی|فشار خون|pulse|نبض|bp", "shock|شوک|hypotension|افت فشار|tachycard|تاکی", "consciousness|هوشیاری|gcs|mental status", "perfusion|پرفیوژن|hemodynamic|haemodynamic|همودینامیک|instabil|ناپایدار"],bleed+'#resuscitation-and-initial-management'),
      item('ugib-blood','workup','درخواست CBC، عملکرد کلیه، انعقاد و آمادگی فرآورده‌های خونی','Request blood count, renal function, coagulation and blood-bank testing',["cbc|blood count|شمارش خون|hemoglobin|haemoglobin|هموگلوبین|hb", "renal|کلیه|creatinin|کراتینین|bun|اوره|urea", "coagul|انعقاد|inr|ptt|pt", "crossmatch|کراس مچ|blood bank|بانک خون|گروه خونی"],bleed+'#resuscitation-and-initial-management'),
      item('ugib-risk','workup','ارزیابی خطر با گلاسگو بلچفورد در مراجعهٔ اولیه','Assess initial risk using Glasgow-Blatchford score',["blatchford|بلچفورد|gbs|glasgow", "risk|score|امتیاز|نمره|ریسک"],bleed+'#risk-assessment'),
      item('ugib-diagnosis','diagnosis','تشخیص خونریزی گوارشی فوقانی؛ افتراق علت واریسی از غیر واریسی با شواهد','Diagnose upper gastrointestinal bleeding; distinguish likely variceal/non-variceal cause using evidence',["upper gastrointestinal bleeding|upper gi bleed|ugib|خونریزی گوارشی فوقانی|خونریزی دستگاه گوارش فوقانی", "واریس|variceal|varice|غیرواریسی|non-variceal|non variceal|peptic|پپتیک"],bleed+'#management-of-non-variceal-bleeding'),
      item('ugib-resuscitation','management','احیای اولیه و تصمیم تزریق خون بر اساس وضعیت کامل بیمار و پروتکل محلی','Resuscitate and individualise transfusion to the clinical picture and local protocol',["resuscitat|احیا|کریستالوئید|crystalloid|مایعات|fluid|iv access|وریدی", "transfus|تزریق خون|blood products|فرآورده|rbc|prbc", "threshold|protocol|پروتکل|آستانه|target|هدف"],bleed+'#resuscitation-and-initial-management'),
      item('ugib-endoscopy','management','آندوسکوپی بعد از احیا: فوری در ناپایداری شدید و ظرف ۲۴ ساعت در سایر بیماران','Arrange endoscopy after resuscitation: immediately for severe unstable bleeding, otherwise within 24 hours',["endoscop|آندوسکوپی|اندوسکوپی|egd|گاستروسکوپی", "24|۲۴|فوری|فوراً|urgent|immediate|سریع|اولویت|زودهنگام|early"],bleed+'#timing-of-endoscopy'),
      item('ugib-followup','management','انتخاب درمان هموستاز و پایش خونریزی مجدد متناسب با یافتهٔ آندوسکوپی','Select haemostasis and rebleeding surveillance according to endoscopic findings',["hemostasis|haemostasis|هموستاز|هموستازی", "rebleed|خونریزی مجدد|ریبلید|re-bleed|surveillance|پایش", "ppi|پانتوپرازول|pantoprazole|omeprazole|امپرازول|اومپرازول"],bleed+'#management-of-non-variceal-bleeding'),
    ],
  },
};
