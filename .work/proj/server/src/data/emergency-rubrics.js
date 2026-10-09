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
      item('hf-consent','communication','معرفی، کسب رضایت و توضیح ارزیابی','Introduce self, seek consent and explain assessment',['introduce','consent','معرفی','رضایت'],hf+'#initial-pharmacological-treatment'),
      item('hf-history','history','شرح‌حال تنگی‌نفس، ارتوپنه، ادم و تغییر وزن','Assess dyspnoea, orthopnoea, oedema and weight change',['orthopnea','orthopnoea','weight','edema','oedema','ارتوپنه','ادم','وزن'],hf+'#diagnosis-assessment-and-monitoring'),
      item('hf-trigger','history','بررسی عوامل تشدید، پایبندی به دارو و بیماری‌های همراه','Assess precipitants, medication adherence and comorbidities',['adherence','precipitant','infection','ischaemia','ischemia','دارو','پایبندی','عفونت'],hf+'#diagnosis-assessment-and-monitoring'),
      item('hf-exam','exam','ارزیابی علائم حیاتی، اکسیژناسیون، پرفیوژن و احتقان','Assess vital signs, oxygenation, perfusion and congestion',['vitals','saturation','perfusion','congestion','علائم حیاتی','اشباع','احتقان','پرفیوژن'],hf+'#diagnosis-assessment-and-monitoring'),
      item('hf-ecg','workup','درخواست ECG و تصویربرداری قفسه سینه در ارزیابی اولیه','Request ECG and chest imaging as part of initial assessment',['ecg','chest x-ray','cxr','نوار قلب','گرافی سینه'],hf+'#diagnosis-assessment-and-monitoring'),
      item('hf-blood','workup','ارزیابی عملکرد کلیه، الکترولیت‌ها و پپتید ناتریورتیک متناسب با سناریو','Assess renal function, electrolytes and appropriate natriuretic peptide testing',['creatinine','electrolyte','bnp','nt-probnp','کراتینین','الکترولیت'],hf+'#diagnosis-assessment-and-monitoring'),
      item('hf-echo','workup','بررسی اکو و اختلال ساختاری یا عملکردی قلب','Review echocardiography and cardiac structural/function abnormalities',['echo','echocardiography','اکو'],hf+'#diagnosis-assessment-and-monitoring'),
      item('hf-diagnosis','diagnosis','تشخیص نارسایی قلبی حاد با احتقان بر اساس یافته‌های سناریو','Diagnose acute heart failure with congestion using the recorded findings',['heart failure','adhf','pulmonary oedema','pulmonary edema','نارسایی قلب','ادم ریوی'],hf+'#diagnosis-assessment-and-monitoring'),
      item('hf-diuretic','management','درمان دیورتیک وریدی متناسب با وضعیت بیمار','Plan appropriate intravenous diuretic therapy',['diuretic','furosemide','دیورتیک','فوروزماید'],hf+'#initial-pharmacological-treatment'),
      item('hf-monitor','management','پایش عملکرد کلیه، وزن و برون‌ده ادرار هنگام درمان','Monitor renal function, weight and urine output during treatment',['urine output','renal function','monitor','برون‌ده ادرار','پایش','عملکرد کلیه'],hf+'#initial-pharmacological-treatment'),
      item('hf-escalate','management','ارزیابی نیاز به حمایت تنفسی و ارجاع متناسب با شدت؛ نه استفادهٔ روتین برای همه','Assess respiratory support/escalation according to severity, not routine use for everyone',['ventilation','respiratory support','escalat','cpap','nippv','حمایت تنفسی','تهویه','ارجاع'],hf+'#initial-non-pharmacological-treatment'),
    ],
  },
  102: {
    name_fa: 'خونریزی گوارشی فوقانی — معیار آموزشی نسخه ۱',
    name_en: 'Upper gastrointestinal bleeding — educational rubric v1',
    legacyId: 2,
    legacyName: 'Abdominal Pain Checklist',
    legacyHash: '53a6b12661750cee9118076115c86266bf387ee49788c211ed493404e04b2ce2',
    items: [
      item('ugib-consent','communication','معرفی، رضایت و توضیح ارزیابی فوری','Introduce self, seek consent and explain urgent assessment',['introduce','consent','معرفی','رضایت'],bleed+'#information-and-support-for-patients-and-carers'),
      item('ugib-history','history','بررسی هماتمز، ملنا، زمان شروع و علائم کاهش حجم','Assess haematemesis, melaena, onset and symptoms of volume loss',['hematemesis','haematemesis','melena','melaena','هماتمز','ملنا','سنکوپ'],bleed+'#risk-assessment'),
      item('ugib-drugs','history','بررسی NSAID، ضدانعقاد و سابقهٔ زخم یا بیماری کبد','Review NSAIDs, anticoagulants, ulcer history and liver disease',['nsaid','anticoagulant','warfarin','ulcer','liver','ضدانعقاد','وارفارین','زخم','کبد'],bleed+'#control-of-bleeding-and-prevention-of-re-bleeding-in-patients-on-nsaids-aspirin-or-clopidogrel'),
      item('ugib-exam','exam','ارزیابی علائم حیاتی، سطح هوشیاری، پرفیوژن و ناپایداری همودینامیک','Assess vital signs, consciousness, perfusion and haemodynamic instability',['vitals','shock','perfusion','hemodynamic','haemodynamic','علائم حیاتی','شوک','هوشیاری'],bleed+'#resuscitation-and-initial-management'),
      item('ugib-blood','workup','درخواست CBC، عملکرد کلیه، انعقاد و آمادگی فرآورده‌های خونی','Request blood count, renal function, coagulation and blood-bank testing',['cbc','hemoglobin','haemoglobin','inr','crossmatch','هموگلوبین','انعقاد','کراس مچ'],bleed+'#resuscitation-and-initial-management'),
      item('ugib-risk','workup','ارزیابی خطر با گلاسگو بلچفورد در مراجعهٔ اولیه','Assess initial risk using Glasgow-Blatchford score',['blatchford','gbs','بلچفورد'],bleed+'#risk-assessment'),
      item('ugib-diagnosis','diagnosis','تشخیص خونریزی گوارشی فوقانی؛ افتراق علت واریسی از غیر واریسی با شواهد','Diagnose upper gastrointestinal bleeding; distinguish likely variceal/non-variceal cause using evidence',['upper gastrointestinal bleeding','ugib','upper gi bleed','خونریزی گوارشی فوقانی','خونریزی دستگاه گوارش فوقانی'],bleed+'#management-of-non-variceal-bleeding'),
      item('ugib-resuscitation','management','احیای اولیه و تصمیم تزریق خون بر اساس وضعیت کامل بیمار و پروتکل محلی','Resuscitate and individualise transfusion to the clinical picture and local protocol',['resuscitat','transfus','blood products','احیا','تزریق خون','فرآورده خونی'],bleed+'#resuscitation-and-initial-management'),
      item('ugib-endoscopy','management','آندوسکوپی بعد از احیا: فوری در ناپایداری شدید و ظرف ۲۴ ساعت در سایر بیماران','Arrange endoscopy after resuscitation: immediately for severe unstable bleeding, otherwise within 24 hours',['endoscopy','endoscop','آندوسکوپی','اندوسکوپی'],bleed+'#timing-of-endoscopy'),
      item('ugib-followup','management','انتخاب درمان هموستاز و پایش خونریزی مجدد متناسب با یافتهٔ آندوسکوپی','Select haemostasis and rebleeding surveillance according to endoscopic findings',['hemostasis','haemostasis','rebleed','ppi','هموستاز','خونریزی مجدد','پانتوپرازول'],bleed+'#management-of-non-variceal-bleeding'),
    ],
  },
};
