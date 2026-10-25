/* Default orderable lab tests and imaging studies for the virtual patient.
   Teachers/admins can add/remove items; these are the seed if none are saved. */
export const DEFAULT_LAB_TESTS = [
  { fa: "شمارش کامل خون (CBC)", en: "Complete blood count (CBC)", aliases: ["cbc", "wbc"] },
  { fa: "تروپونین", en: "Troponin", aliases: ["trop", "troponin"] },
  { fa: "CK-MB", en: "CK-MB", aliases: ["ckmb"] },
  { fa: "الکترولیت‌ها (Na, K, Cl)", en: "Electrolytes (Na, K, Cl)", aliases: ["na", "k", "electrolytes"] },
  { fa: "قند خون ناشتا (FBS)", en: "Fasting blood sugar (FBS)", aliases: ["fbs", "glucose", "bs"] },
  { fa: "هموگلوبین A1c", en: "Hemoglobin A1c", aliases: ["hba1c", "a1c"] },
  { fa: "کراتینین و BUN", en: "Creatinine & BUN", aliases: ["cr", "bun", "creatinine"] },
  { fa: "آزمایش عملکرد کبد (LFT)", en: "Liver function tests (LFT)", aliases: ["lft", "ast", "alt"] },
  { fa: "بیلی‌روبین توتال و مستقیم", en: "Total & direct bilirubin", aliases: ["bili", "bilirubin"] },
  { fa: "آمیلاز", en: "Amylase", aliases: ["amylase"] },
  { fa: "لیپاز", en: "Lipase", aliases: ["lipase"] },
  { fa: "پروفایل چربی (Lipid profile)", en: "Lipid profile", aliases: ["lipid", "ldl", "hdl"] },
  { fa: "آزمایش عملکرد تیروئید (TSH)", en: "Thyroid function (TSH)", aliases: ["tsh", "t4"] },
  { fa: "CRP", en: "C-reactive protein (CRP)", aliases: ["crp"] },
  { fa: "ESR", en: "Erythrocyte sedimentation rate (ESR)", aliases: ["esr"] },
  { fa: "D-dimer", en: "D-dimer", aliases: ["ddimer", "d-dimer"] },
  { fa: "PT / INR", en: "PT / INR", aliases: ["pt", "inr"] },
  { fa: "PTT", en: "PTT", aliases: ["ptt", "aptt"] },
  { fa: "گازهای خون شریانی (ABG)", en: "Arterial blood gas (ABG)", aliases: ["abg"] },
  { fa: "آزمایش کامل ادرار (U/A)", en: "Urinalysis (U/A)", aliases: ["ua", "u/a"] },
  { fa: "کشت ادرار", en: "Urine culture", aliases: ["uc", "urine culture"] },
  { fa: "کشت خون", en: "Blood culture", aliases: ["bc", "blood culture"] },
  { fa: "BNP / NT-proBNP", en: "BNP / NT-proBNP", aliases: ["bnp"] },
  { fa: "لاکتات", en: "Lactate", aliases: ["lactate"] },
  { fa: "تست بارداری (β-hCG)", en: "Pregnancy test (β-hCG)", aliases: ["hcg", "b-hcg"] },
  { fa: "پروکلسی‌تونین", en: "Procalcitonin", aliases: ["pct", "procalcitonin"] },
  { fa: "فریتین", en: "Ferritin", aliases: ["ferritin"] },
  { fa: "آهن و TIBC", en: "Iron & TIBC", aliases: ["iron", "tibc"] },
  { fa: "ویتامین D", en: "Vitamin D", aliases: ["vit d", "25oh"] },
  { fa: "ویتامین B12", en: "Vitamin B12", aliases: ["b12"] },
  { fa: "منیزیم", en: "Magnesium", aliases: ["mg", "magnesium"] },
  { fa: "کلسیم", en: "Calcium", aliases: ["ca", "calcium"] },
  { fa: "فسفر", en: "Phosphorus", aliases: ["phos", "phosphorus"] },
  { fa: "آلبومین", en: "Albumin", aliases: ["alb", "albumin"] },
  { fa: "اسید اوریک", en: "Uric acid", aliases: ["ua", "uric"] },
  { fa: "تست عملکرد کلیه (GFR)", en: "Renal function (GFR)", aliases: ["gfr", "egfr"] },
  { fa: "کشت خلط", en: "Sputum culture", aliases: ["sputum"] },
  { fa: "مدفوع (OB)", en: "Stool occult blood", aliases: ["ob", "fobt"] },
];

export const DEFAULT_IMAGING = [
  { fa: "نوار قلب (ECG)", en: "Electrocardiogram (ECG)", aliases: ["ecg", "ekg", "نوار قلب"] },
  { fa: "رادیوگرافی قفسه سینه", en: "Chest X-ray", aliases: ["cxr", "chest xray"] },
  { fa: "رادیوگرافی شکم", en: "Abdominal X-ray", aliases: ["axr"] },
  { fa: "سونوگرافی شکم", en: "Abdominal ultrasound", aliases: ["us", "sonography"] },
  { fa: "سونوگرافی لگن", en: "Pelvic ultrasound", aliases: ["pelvic us"] },
  { fa: "اکوکاردیوگرافی", en: "Echocardiography", aliases: ["echo"] },
  { fa: "سی‌تی‌اسکن سر", en: "CT scan of head", aliases: ["ct head", "brain ct"] },
  { fa: "سی‌تی‌اسکن قفسه سینه", en: "CT scan of chest", aliases: ["ct chest"] },
  { fa: "سی‌تی‌اسکن شکم و لگن", en: "CT scan of abdomen & pelvis", aliases: ["ct abd"] },
  { fa: "سی‌تی آنژیوگرافی ریه (CTPA)", en: "CT pulmonary angiography (CTPA)", aliases: ["ctpa"] },
  { fa: "ام‌آر‌آی مغز", en: "MRI of brain", aliases: ["brain mri"] },
  { fa: "ام‌آر‌آی ستون فقرات", en: "MRI of spine", aliases: ["spine mri"] },
  { fa: "آنژیوگرافی عروق کرونر", en: "Coronary angiography", aliases: ["cag", "angio"] },
  { fa: "رادیوگرافی اندام", en: "Extremity X-ray", aliases: ["limb xray"] },
  { fa: "سونوگرافی داپلر عروق", en: "Doppler ultrasound", aliases: ["doppler"] },
  { fa: "ماموگرافی", en: "Mammography", aliases: ["mammo"] },
  { fa: "اسکن استخوان", en: "Bone scan", aliases: ["bone scan"] },
  { fa: "آندوسکوپی فوقانی", en: "Upper endoscopy", aliases: ["egd", "endoscopy"] },
  { fa: "کولونوسکوپی", en: "Colonoscopy", aliases: ["colonoscopy"] },
  { fa: "سی‌تی‌اسکن کلیه و مجاری ادراری (CT-KUB)", en: "CT-KUB (renal)", aliases: ["ctkub", "kub"] },
];

/* Paraclinical / functional studies that are neither a blood test nor a
   radiology image: ECG, spirometry, EEG, etc. Same smart-search UX as labs. */
export const DEFAULT_PARACLINIC = [
  { fa: "نوار قلب (ECG)", en: "Electrocardiogram (ECG)", aliases: ["ecg", "ekg", "نوار قلب"] },
  { fa: "تست ورزش (Exercise stress test)", en: "Exercise stress test", aliases: ["ett", "est", "stress test"] },
  { fa: "هولتر مانیتورینگ ۲۴ ساعته", en: "24-h Holter monitoring", aliases: ["holter"] },
  { fa: "اسپیرومتری / تست عملکرد ریه (PFT)", en: "Spirometry / pulmonary function test (PFT)", aliases: ["pft", "spirometry", "اسپیرومتری"] },
  { fa: "پیک فلومتری", en: "Peak flow", aliases: ["pefr", "peak flow"] },
  { fa: "پالس‌اکسیمتری ۶ دقیقه راه رفتن", en: "Six-minute walk test", aliases: ["6mwt"] },
  { fa: "نوار مغز (EEG)", en: "Electroencephalogram (EEG)", aliases: ["eeg"] },
  { fa: "نوار عصب و عضله (EMG/NCS)", en: "EMG / nerve conduction study", aliases: ["emg", "ncs", "ncv"] },
  { fa: "ادیومتری", en: "Audiometry", aliases: ["audiometry"] },
  { fa: "پونکسیون کمری (LP) و آنالیز CSF", en: "Lumbar puncture (CSF analysis)", aliases: ["lp", "csf"] },
  { fa: "آسپیراسیون / بیوپسی مغز استخوان", en: "Bone marrow aspiration / biopsy", aliases: ["bma", "bone marrow"] },
  { fa: "پاراسنتز و آنالیز مایع آسیت", en: "Paracentesis (ascitic fluid analysis)", aliases: ["paracentesis", "ascitic"] },
  { fa: "توراسنتز و آنالیز مایع پلور", en: "Thoracentesis (pleural fluid analysis)", aliases: ["thoracentesis", "pleural"] },
  { fa: "آسپیراسیون مایع مفصلی", en: "Arthrocentesis (synovial fluid)", aliases: ["arthrocentesis", "synovial"] },
  { fa: "تست پوستی توبرکولین (PPD)", en: "Tuberculin skin test (PPD)", aliases: ["ppd", "tst", "mantoux"] },
  { fa: "تست تحمل گلوکز (OGTT)", en: "Oral glucose tolerance test", aliases: ["ogtt", "gtt"] },
  { fa: "مانومتری مری", en: "Esophageal manometry", aliases: ["manometry"] },
  { fa: "pH‌متری ۲۴ ساعته مری", en: "24-h esophageal pH monitoring", aliases: ["ph monitoring"] },
  { fa: "یورودینامیک", en: "Urodynamic study", aliases: ["urodynamic"] },
  { fa: "تست اسلامپ / تیلت", en: "Tilt-table test", aliases: ["tilt"] },
  { fa: "پلی‌سومنوگرافی (تست خواب)", en: "Polysomnography (sleep study)", aliases: ["psg", "sleep study"] },
  { fa: "معاینهٔ ته چشم (فوندوسکوپی)", en: "Fundoscopy", aliases: ["fundoscopy", "fundus"] },
  { fa: "پاپ‌اسمیر", en: "Pap smear", aliases: ["pap"] },
  { fa: "بیوپسی پوست", en: "Skin biopsy", aliases: ["skin biopsy"] },
  { fa: "اندازه‌گیری فشار داخل چشم (تونومتری)", en: "Tonometry (intraocular pressure)", aliases: ["tonometry", "iop"] },
];

export function cleanOrderItem(x) {
  const fa = String(x?.fa || x?.name_fa || "").trim().slice(0, 200);
  const en = String(x?.en || x?.name_en || "").trim().slice(0, 200);
  if (!fa && !en) return null;
  const aliases = (Array.isArray(x?.aliases) ? x.aliases : String(x?.aliases || "").split(","))
    .map((s) => String(s || "").trim().slice(0, 80)).filter(Boolean).slice(0, 20);
  return { fa: fa || en, en: en || fa, aliases };
}

export function cleanOrderList(arr, fallback) {
  const out = (Array.isArray(arr) ? arr : []).map(cleanOrderItem).filter(Boolean).slice(0, 400);
  return out.length ? out : fallback;
}

function nrmOrder(s) {
  return (s || "").toString().toLowerCase()
    .replace(/[ي]/g, "ی").replace(/[ك]/g, "ک")
    .replace(/[ًٌٍَُِّْ]/g, "").replace(/\s+/g, " ").trim();
}

export function orderItemMatchesQuery(item, query) {
  const nq = nrmOrder(query);
  if (!nq) return false;
  const names = [item?.fa, item?.en, item?.name_fa, item?.name_en, ...(item?.aliases || [])].filter(Boolean);
  return names.some((n) => {
    const nn = nrmOrder(n);
    if (!nn) return false;
    if (nn === nq || nn.includes(nq)) return true;
    // Reverse include only for aliases long enough to not match every query
    // that happens to contain "k" / "cr" / "ua".
    return nn.length >= 3 && nq.includes(nn);
  });
}

export function catalogContainsQuery(list, query) {
  return (list || []).some((item) => orderItemMatchesQuery(item, query));
}
