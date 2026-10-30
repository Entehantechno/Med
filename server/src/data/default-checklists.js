// Default virtual-patient OSCE checklists (ACS, abdominal pain, history-taking).
// Seeded for fresh installs (seed.js) and used by the R63 migration (lib/r63-migration.js)
// to upgrade untouched existing rows. Every criterion lists evidence points as
// "a|b|c" synonym groups; each group is one point (see keyedCredit in ai-engine.js).

export const DEFAULT_CHECKLIST_1 = [
  { id: "i1", section: "communication", weight: 2, fa: "معرفی خود به‌عنوان پزشک و کسب رضایت", en: "Introduce self as doctor & obtain consent", keys: ["معرفی|من دکتر|من پزشک|دکتر شما|پزشک شما|من دانشجو|من اکسترن|من اینترن|دانشجوی پزشکی|introduce|i am dr|i am doctor|i am a medical student|i am a student|i am an extern|i am an intern", "اجازه هست|با اجازه|رضایت دارید|کسب رضایت|consent|permission"] },
  { id: "i2", section: "history", weight: 3, fa: "پرسش ماهیت، محل و انتشار درد", en: "Ask pain character, site & radiation", keys: ["کجا|محل|location|site", "فشارنده|crush|character|quality", "انتشار|بازو|تیر کشیدن|radiat|arm"] },
  { id: "i3", section: "history", weight: 2, fa: "پرسش عوامل خطر قلبی (دیابت، فشار، چربی، سیگار)", en: "Ask cardiac risk factors (DM, HTN, smoking, family)", keys: ["دیابت|diabet", "فشار خون|hypertens", "سیگار|smok", "سابقه قلبی|cardiac history"] },
  { id: "i_ros", section: "history", weight: 2, fa: "مرور سیستم‌ها (ROS: تنگی‌نفس، تعریق سرد، تهوع، تپش قلب)", en: "Review of systems (ROS: dyspnea, cold sweat, nausea, palpitation)", keys: ["تنگی نفس|dyspnea|shortness of breath", "تعریق|عرق سرد|sweat", "تهوع|nausea", "تپش|palpitation"] },
  { id: "i_exam", section: "exam", weight: 2, fa: "معاینه فیزیکی و علائم حیاتی (فشار خون، نبض، سمع قلب و ریه)", en: "Physical exam & vitals (BP, pulse, auscultation)", keys: ["معاینه|physical exam|examin", "علائم حیاتی|vitals|فشار خون|bp", "نبض|pulse", "سمع|auscultat"] },
  { id: "i4", section: "workup", weight: 3, fa: "درخواست نوار قلب (ECG)", en: "Order ECG", keys: ["ecg|نوار قلب|الکتروکاردیو|ekg", "فوری|فوراً|سریع|بلافاصله|اولویت|as soon|soon|stat|immediate|urgent"] },
  { id: "i5", section: "workup", weight: 3, fa: "درخواست تروپونین و بیومارکرهای قلبی", en: "Order troponin & cardiac biomarkers", keys: ["troponin|تروپونین", "ck-mb|ck mb|بیومارکر|biomarker|انزیم های قلبی|انزیم قلبی|cardiac enzyme"] },
  { id: "i6", section: "diagnosis", weight: 4, fa: "تشخیص صحیح STEMI / ACS", en: "Correct STEMI/ACS diagnosis", keys: ["stemi|st elevation|st-elevation", "acs|سندرم کرونری حاد|انفارکتوس|سکته قلبی|myocardial|coronary syndrome"] },
  { id: "i7", section: "management", weight: 3, fa: "بیان برنامه درمان اولیه (آسپرین، نیترات، ارجاع برای آنژیوگرافی/PCI)", en: "State initial management (Aspirin, nitrate, cath lab/PCI)", keys: ["aspirin|آسپرین", "نیترات|nitrat|nitro", "آنژیوگرافی|pci|reperfus|cath"] },
];

export const DEFAULT_CHECKLIST_2 = [
  { id: "i1", section: "communication", weight: 2, fa: "معرفی خود به‌عنوان پزشک و کسب رضایت", en: "Introduce self as doctor & obtain consent", keys: ["معرفی|من دکتر|من پزشک|دکتر شما|پزشک شما|من دانشجو|من اکسترن|من اینترن|دانشجوی پزشکی|introduce|i am dr|i am doctor|i am a medical student|i am a student|i am an extern|i am an intern", "اجازه هست|با اجازه|رضایت دارید|کسب رضایت|consent|permission"] },
  { id: "i2", section: "history", weight: 3, fa: "شرح‌حال درد، محل و ارتباط با مصرف غذای چرب", en: "Pain history, site & relation to fatty meals", keys: ["کجا|محل|location|site", "کیفیت درد|quality|character", "غذا|چرب|meal|fatty"] },
  { id: "i3", section: "history", weight: 2, fa: "پرسش تهوع، استفراغ و تب", en: "Ask nausea/vomiting & fever", keys: ["تهوع|nausea", "استفراغ|vomit", "تب|fever"] },
  { id: "i_ros", section: "history", weight: 2, fa: "مرور سیستم‌ها (ROS: وضعیت ادرار، ایکتر/زردی، تغییر رنگ مدفوع)", en: "Review of systems (ROS: jaundice, urinary, acholic stool)", keys: ["زردی|jaundice", "ادرار|urine", "مدفوع|stool"] },
  { id: "i4", section: "exam", weight: 3, fa: "معاینه فیزیکی شکم و بررسی تندرنس یا علامت مورفی", en: "Abdominal physical exam & Murphy's sign / tenderness", keys: ["معاینه شکم|abdominal exam|physical exam|examin", "مورفی|murphy|تندرنس|tenderness|لمس|palpat"] },
  { id: "i5", section: "workup", weight: 4, fa: "درخواست سونوگرافی شکم و کبد/کیسه صفرا", en: "Order abdominal/gallbladder ultrasound", keys: ["سونوگرافی|سونو|ultrasound|sono|usg|اولتراسوند|اولتراساند", "شکم|کبد|کیسه صفرا|gallbladder|abdom|liver|ruq"] },
  { id: "i6", section: "diagnosis", weight: 4, fa: "تشخیص کوله‌سیستیت حاد", en: "Diagnose acute cholecystitis", keys: ["کوله سیستیت|کوله‌سیستیت|cholecystitis|cholecyst", "حاد|acute", "کیسه صفرا|gallbladder|biliary|سنگ|stone|lithiasis|لیتیاز"] },
];

export const DEFAULT_CHECKLIST_3 = [
  { id: "c1", weight: 1, fa: "خود را به‌عنوان پزشک، دانشجو، اکسترن یا اینترن به بیمار معرفی کرد.", en: "Introduced self to the patient as a doctor, student, extern or intern.", keys: ["من دکتر|من پزشک|دکتر شما|پزشک شما|من دانشجو|من اکسترن|من اینترن|دانشجوی پزشکی|i am dr|i am doctor|i am a medical student|i am a student|i am an extern|i am an intern", "معرفی|introduc|اسمم|اسم من|نامم|نام من|my name"] },
  { id: "c2", weight: 1, fa: "درباره‌ی سن و شغل بیمار پرسید.", en: "Asked the patient's age and occupation.", keys: ["سن|چند سال|چندساله|how old|age", "شغل|occupation|job|work"] },
  { id: "c3", weight: 1, fa: "درباره‌ی سابقه‌ی بیماری خاص پرسید.", en: "Asked about significant past medical history.", keys: ["سابقه|past history|pmh|medical history", "بیماری قبلی|بیماری زمینه|مزمن|chronic|comorbid"] },
  { id: "c4", weight: 1, fa: "پرسش‌ها واضح، منظم و با زبان ساده و قابل‌فهم برای بیمار عادی بود.", en: "Questions were clear, organized and in plain, patient-friendly language.", keys: ["ساده|واضح|روشن|plain|simple|clear|قابل فهم", "منظم|سازمان|پشت سر هم|ترتیب|organized|structured|stepwise"] },
  { id: "c5", weight: 1, fa: "از سؤالات باز (Open-ended) استفاده کرد و اجازه‌ی صحبت آزادانه به بیمار داد.", en: "Used open-ended questions and let the patient speak freely.", keys: ["بگویید|بفرمایید|تعریف کنید|توضیح بدهید|بیان کنید|describe|tell me|explain", "چطور|چگونه|چه کاری|چه اتفاقی|چه شده|how|what happened", "ادامه بدید|ادامه بده|ادامه بدهید|go on|continue|بقیه"] },
  { id: "c6", weight: 2, fa: "درباره‌ی شکایت اصلی (Chief Complaint) دقیق و کامل پرسید.", en: "Asked about the chief complaint accurately and completely.", keys: ["شکایت|complaint|chief complaint|cc", "مشکل|چه شده|چی شده|مشکلتان|مشکلتون|problem|what brings"] },
  { id: "c7", weight: 2, fa: "شکایت اصلی را سیستماتیک بررسی کرد (محل، شدت، زمان شروع، عوامل تشدید/تسکین و ...).", en: "Explored the complaint systematically (site, severity, onset, aggravating/relieving factors…).", keys: ["محل|کجا|location|site|انتشار|radiat", "شدت|severity|چقدر|scale|how bad", "زمان|شروع|onset|از کی|چند وقت|duration|since", "تشدید|تسکین|بدتر|بهتر|aggravat|relie|worse|better|provok"] },
  { id: "c8", weight: 1, fa: "درباره‌ی سابقه‌ی دارویی فعلی و آلرژی دارویی پرسید.", en: "Asked about current medications and drug allergies.", keys: ["دارو|قرص|medication|drug|مصرف", "آلرژی|حساسیت|allerg|sensitiv"] },
  { id: "c9", weight: 1, fa: "درباره‌ی سابقه‌ی بیماری‌های خانوادگی پرسید.", en: "Asked about family history of disease.", keys: ["خانواده|family|فامیل", "ارثی|hereditary|genetic", "پدر|مادر|برادر|خواهر|father|mother|sibling|relative"] },
  { id: "c10", weight: 1, fa: "درباره‌ی مصرف سیگار، الکل و مواد مخدر پرسید.", en: "Asked about smoking, alcohol and drug use.", keys: ["سیگار|smok|tobacco|قلیان", "الکل|alcohol", "مواد|اعتیاد|drug|opium|تریاک|مخدر"] },
  { id: "c11", weight: 1, fa: "درباره‌ی قدم بعدی (مثلاً معاینه‌ی فیزیکی یا آزمایش) به بیمار توضیح داد.", en: "Explained the next step (e.g. physical exam or tests) to the patient.", keys: ["قدم بعد|next step|مرحله بعد|بعد از این", "معاینه|exam|examin|لمس|بررسی فیزیکی", "آزمایش|test|lab|سونو|ecg|نوار|تصویربرداری|imaging"] },
  { id: "c12", weight: 1, fa: "رفتار کلی دانشجو باعث شد بیمار احساس راحتی و احترام کند.", en: "Overall conduct made the patient feel comfortable and respected.", keys: ["ممنون|thank|متشکر|سپاس", "لطفا|لطفاً|خواهش|please", "راحت|احترام|comfortable|respect|نگران نباشید|reassur|دلداری"] },
  { id: "c13", weight: 2, fa: "امتیاز کلی مهارت ارتباطی و شرح‌حال‌گیری دانشجو.", en: "Overall communication & history-taking skill.", keys: ["شنید|گوش|listen", "همدل|نگران|متاسف|متأسف|empath|sorry|درک", "خلاصه|جمع‌بندی|جمع بندی|summar"] },
];
