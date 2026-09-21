import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon.jsx";
import { useScrollLock } from "../utils/useScrollLock.js";
import { normFa } from "./SearchBox.jsx";

export const LAB_CATEGORIES = [
  { id: "all", fa: "همه مقادیر", en: "All Values" },
  { id: "heme", fa: "خون و هماتولوژی", en: "Hematology & CBC" },
  { id: "chem", fa: "الکترولیت و ABG", en: "Electrolytes & ABG" },
  { id: "renal", fa: "کلیه و کبد", en: "Renal & Hepatic" },
  { id: "cardiac", fa: "قلب و انعقاد", en: "Cardiac & Coagulation" },
  { id: "csf", fa: "CSF و ادرار", en: "CSF & Urinalysis" },
  { id: "endocrine", fa: "غدد و چربی", en: "Endocrine & Lipids" },
];

export const LAB_DATA = [
  // --- Hematology & CBC ---
  { cat: "heme", nameFa: "گلبول‌های سفید (WBC)", nameEn: "White Blood Cells", abbr: "WBC", ref: "4,500 – 11,000 /µL", pearlFa: "نوتروفیل ۵۰–۷۰٪، لنفوسیت ۲۰–۴۰٪", pearlEn: "Neutrophils 50-70%, Lymphocytes 20-40%" },
  { cat: "heme", nameFa: "هموگلوبین (Hb)", nameEn: "Hemoglobin", abbr: "Hb", ref: "مردان: 13.5 – 17.5 g/dL | زنان: 12.0 – 15.5 g/dL", pearlFa: "کم‌خونی در مردان < 13.5 و در زنان < 12.0", pearlEn: "Anemia: < 13.5 (male), < 12.0 (female)" },
  { cat: "heme", nameFa: "هماتوکریت (Hct)", nameEn: "Hematocrit", abbr: "Hct", ref: "مردان: 41% – 53% | زنان: 36% – 46%", pearlFa: "تقریباً ۳ برابر هموگلوبین", pearlEn: "Roughly 3x Hemoglobin" },
  { cat: "heme", nameFa: "پلاکت (Platelets)", nameEn: "Platelets", abbr: "PLT", ref: "150,000 – 450,000 /µL", pearlFa: "ترومبوسیتوپنی < ۱۵۰ هزار، خطر خونریزی خودبه‌خودی < ۲۰ هزار", pearlEn: "Thrombocytopenia < 150k; spontaneous bleeding < 20k" },
  { cat: "heme", nameFa: "حجم متوسط گلبول (MCV)", nameEn: "Mean Corpuscular Volume", abbr: "MCV", ref: "80 – 100 fL", pearlFa: "میکروسیتیک < ۸۰ (فقر آهن، تالاسمی)؛ ماکروسیتیک > ۱۰۰ (B12، فولات)", pearlEn: "Microcytic < 80 (IDA, Thalassemia); Macrocytic > 100 (B12, Folate)" },
  { cat: "heme", nameFa: "هموگلوبین متوسط گلبول (MCH)", nameEn: "Mean Corpuscular Hemoglobin", abbr: "MCH", ref: "27 – 33 pg", pearlFa: "کاهش در کم‌خونی‌های هیپوکروم", pearlEn: "Decreased in hypochromic anemias" },
  { cat: "heme", nameFa: "پهنای توزیع گلبول قرمز (RDW)", nameEn: "Red Cell Distribution Width", abbr: "RDW", ref: "11.5% – 14.5%", pearlFa: "در فقر آهن بالا می‌رود، در تالاسمی مینور طبیعی است", pearlEn: "Elevated in Iron Deficiency; normal in Thalassemia trait" },
  { cat: "heme", nameFa: "شمارش رتیکولوسیت", nameEn: "Reticulocyte Count", abbr: "Retic", ref: "0.5% – 1.5%", pearlFa: "شاخص تولید گلبول قرمز؛ در همولیز و خونریزی حاد افزایش می‌یابد", pearlEn: "Reflects bone marrow response; elevated in hemolysis" },
  { cat: "heme", nameFa: "سرعت رسوب گلبول قرمز (ESR)", nameEn: "Erythrocyte Sedimentation Rate", abbr: "ESR", ref: "مردان: < 15 mm/hr | زنان: < 20 mm/hr", pearlFa: "شاخص التهاب غیراختصاصی", pearlEn: "Non-specific inflammatory marker" },

  // --- Electrolytes & ABG ---
  { cat: "chem", nameFa: "سدیم سرم (Na+)", nameEn: "Serum Sodium", abbr: "Na", ref: "135 – 145 mEq/L", pearlFa: "هیپوناترمی < ۱۳۵ (اصلاح سریع: خطر CPM)؛ هیپرناترمی > ۱۴۵", pearlEn: "Hyponatremia < 135; Hypernatremia > 145" },
  { cat: "chem", nameFa: "پتاسیم سرم (K+)", nameEn: "Serum Potassium", abbr: "K", ref: "3.5 – 5.0 mEq/L", pearlFa: "هیپوکالمی: موج U و تاکی‌کاردی؛ هیپرکالمی: موج T بلند نوک‌تیز و ایست قلبی", pearlEn: "Hypokalemia: U waves; Hyperkalemia: peaked T waves" },
  { cat: "chem", nameFa: "کلر (Cl-)", nameEn: "Serum Chloride", abbr: "Cl", ref: "96 – 106 mEq/L", pearlFa: "محاسبه شکاف آنیونی: Na - (Cl + HCO3)", pearlEn: "Anion Gap = Na - (Cl + HCO3)" },
  { cat: "chem", nameFa: "بی‌کربنات (HCO3-)", nameEn: "Serum Bicarbonate", abbr: "HCO3", ref: "22 – 26 mEq/L", pearlFa: "کاهش در اسیدوز متابولیک، افزایش در آلکالوز متابولیک", pearlEn: "Decreased in metabolic acidosis, elevated in alkalosis" },
  { cat: "chem", nameFa: "کلسیم تام (Total Calcium)", nameEn: "Total Serum Calcium", abbr: "Ca", ref: "8.5 – 10.5 mg/dL", pearlFa: "اصلاح بر اساس آلبومین: Ca اصلاح‌شده = Ca تام + 0.8 * (4.0 - Albumin)", pearlEn: "Corrected Ca = Total Ca + 0.8 * (4 - Albumin)" },
  { cat: "chem", nameFa: "کلسیم یونیزه (Ionized Calcium)", nameEn: "Ionized Calcium", abbr: "iCa", ref: "4.5 – 5.6 mg/dL (1.15 – 1.33 mmol/L)", pearlFa: "جزء فعال فیزیولوژیک کلسیم بدون وابستگی به آلبومین", pearlEn: "Physiologically active fraction independent of albumin" },
  { cat: "chem", nameFa: "منیزیم (Mg2+)", nameEn: "Serum Magnesium", abbr: "Mg", ref: "1.7 – 2.2 mg/dL", pearlFa: "هیپومنیزیمی علت مقاومت به درمان هیپوکالمی و هیپوکلسمی است", pearlEn: "Hypomagnesemia causes refractory hypokalemia and hypocalcemia" },
  { cat: "chem", nameFa: "فسفر غیرآلی (Phosphorus)", nameEn: "Inorganic Phosphorus", abbr: "Phos", ref: "2.5 – 4.5 mg/dL", pearlFa: "رابطه عکس با کلسیم در اختلالات پاراتیروئید", pearlEn: "Inversely related to calcium in parathyroid disease" },
  { cat: "chem", nameFa: "pH شریانی (Arterial pH)", nameEn: "Arterial Blood pH", abbr: "pH", ref: "7.35 – 7.45", pearlFa: "اسیدمی < ۷.۳۵ | آلکالمی > ۷.۴۵", pearlEn: "Acidemia < 7.35 | Alkalemia > 7.45" },
  { cat: "chem", nameFa: "فشار دی‌اکسید کربن شریانی (PaCO2)", nameEn: "Arterial PaCO2", abbr: "PaCO2", ref: "35 – 45 mmHg", pearlFa: "شاخص تهویه ریوی (جزء تنفسی تعادل اسید و باز)", pearlEn: "Respiratory component of acid-base balance" },
  { cat: "chem", nameFa: "فشار اکسیژن شریانی (PaO2)", nameEn: "Arterial PaO2", abbr: "PaO2", ref: "80 – 100 mmHg", pearlFa: "هیپوکسمی شریانی < ۸۰ mmHg در هوای اتاق", pearlEn: "Hypoxemia < 80 mmHg on room air" },

  // --- Renal & Hepatic ---
  { cat: "renal", nameFa: "کراتینین سرم (Creatinine)", nameEn: "Serum Creatinine", abbr: "Cr", ref: "مردان: 0.7 – 1.3 mg/dL | زنان: 0.6 – 1.1 mg/dL", pearlFa: "معیار اصلی ارزیابی فیلتراسیون گلومرولی (GFR)", pearlEn: "Primary marker of glomerular filtration rate (GFR)" },
  { cat: "renal", nameFa: "نیتروژن اوره خون (BUN)", nameEn: "Blood Urea Nitrogen", abbr: "BUN", ref: "7 – 20 mg/dL", pearlFa: "نسبت BUN/Cr > ۲۰ نشان‌دهنده آزوتمی پیش‌کلیوی یا خونریزی گوارشی است", pearlEn: "BUN/Cr ratio > 20 indicates prerenal azotemia" },
  { cat: "renal", nameFa: "اسید اوریک (Uric Acid)", nameEn: "Uric Acid", abbr: "UA", ref: "مردان: 3.5 – 7.2 mg/dL | زنان: 2.6 – 6.0 mg/dL", pearlFa: "افزایش در نقرس و سندرم لیز تومور", pearlEn: "Elevated in gout and tumor lysis syndrome" },
  { cat: "renal", nameFa: "آلبومین سرم (Albumin)", nameEn: "Serum Albumin", abbr: "Alb", ref: "3.5 – 5.0 g/dL", pearlFa: "کاهش در سیروز کبدی، سندرم نفروتیک و سوءتغذیه", pearlEn: "Decreased in cirrhosis, nephrotic syndrome, malnutrition" },
  { cat: "renal", nameFa: "بیلی‌روبین تام (Total Bilirubin)", nameEn: "Total Bilirubin", abbr: "TBil", ref: "0.1 – 1.2 mg/dL", pearlFa: "زردی بالینی در مقادیر > ۲.۵ تا ۳.۰ پدیدار می‌شود", pearlEn: "Clinical jaundice appears at > 2.5 - 3.0 mg/dL" },
  { cat: "renal", nameFa: "بیلی‌روبین مستقیم (Direct Bilirubin)", nameEn: "Direct (Conjugated) Bilirubin", abbr: "DBil", ref: "0.0 – 0.3 mg/dL", pearlFa: "افزایش نشان‌دهنده کلستاز یا آسیب پارانشیم کبدی است", pearlEn: "Elevated in cholestasis or hepatic parenchymal injury" },
  { cat: "renal", nameFa: "آسپارتات آمینوترانسفراز (AST)", nameEn: "Aspartate Aminotransferase", abbr: "AST / SGOT", ref: "8 – 48 U/L", pearlFa: "نسبت AST/ALT > ۲ مطرح‌کننده هپاتیت الکلی است", pearlEn: "AST/ALT ratio > 2 suggests alcoholic hepatitis" },
  { cat: "renal", nameFa: "آلانین آمینوترانسفراز (ALT)", nameEn: "Alanine Aminotransferase", abbr: "ALT / SGPT", ref: "7 – 55 U/L", pearlFa: "آنزیم اختصاصی‌تر برای آسیب هپاتوسلولی", pearlEn: "More liver-specific than AST" },
  { cat: "renal", nameFa: "آلکالن فسفاتاز (ALP)", nameEn: "Alkaline Phosphatase", abbr: "ALP", ref: "45 – 115 U/L", pearlFa: "افزایش در انسداد صفراوی و بیماری‌های استخوانی پرفعال", pearlEn: "Elevated in biliary obstruction and high bone turnover" },
  { cat: "renal", nameFa: "آمیلاز و لیپاز", nameEn: "Amylase & Lipase", abbr: "Amy / Lip", ref: "آمیلاز: 30 – 110 U/L | لیپاز: 0 – 160 U/L", pearlFa: "لیپاز برای پانکراتیت حاد حساس‌تر و اختصاصی‌تر است", pearlEn: "Lipase is more sensitive and specific for acute pancreatitis" },

  // --- Cardiac & Coagulation ---
  { cat: "cardiac", nameFa: "زمان پروترومبین (PT)", nameEn: "Prothrombin Time", abbr: "PT", ref: "11.0 – 13.5 ثانیه", pearlFa: "مسیر خارجی و مشترک انعقاد (وابسته به ویتامین K و فاکتور ۷)", pearlEn: "Extrinsic & common pathway (Vitamin K dependent)" },
  { cat: "cardiac", nameFa: "نسبت نرمال‌شده بین‌المللی (INR)", nameEn: "International Normalized Ratio", abbr: "INR", ref: "طبیعی: 0.8 – 1.1 | هدف در وارفارین: 2.0 – 3.0", pearlFa: "هدف در دریچه مکانیکی میترال: ۲.۵ تا ۳.۵", pearlEn: "Target 2.0 - 3.0 on warfarin (2.5 - 3.5 for mech mitral)" },
  { cat: "cardiac", nameFa: "زمان ترومبوپلاستین نسبی (aPTT)", nameEn: "Activated Partial Thromboplastin Time", abbr: "aPTT", ref: "25 – 35 ثانیه", pearlFa: "مسیر داخلی انعقاد؛ پایش درمان با هپارین استاندارد (UFH)", pearlEn: "Intrinsic pathway; monitors unfractionated heparin" },
  { cat: "cardiac", nameFa: "تروپونین قلبی (Troponin I)", nameEn: "Cardiac Troponin I", abbr: "cTnI", ref: "< 0.04 ng/mL", pearlFa: "اختصاصی‌ترین بیومارکر نکروز میوکارد؛ تا ۷–۱۰ روز بالا می‌ماند", pearlEn: "Most specific marker of myocardial necrosis; stays elevated 7-10d" },
  { cat: "cardiac", nameFa: "پپتید ناتریورتیک مغزی (BNP)", nameEn: "B-Type Natriuretic Peptide", abbr: "BNP", ref: "< 100 pg/mL", pearlFa: "مقدار < ۱۰۰ نارسایی احتقانی قلب (CHF) را رد می‌کند (ارزش اخباری منفی بالا)", pearlEn: "< 100 pg/mL has high negative predictive value for CHF" },
  { cat: "cardiac", nameFa: "دایمر دی (D-Dimer)", nameEn: "D-Dimer", abbr: "D-Dimer", ref: "< 0.5 µg/mL FEU", pearlFa: "ارزش اخباری منفی برای رد ترومبوز ورید عمقی (DVT) و آمبولی ریه (PE)", pearlEn: "High NPV to rule out DVT and PE when clinical pretest probability is low" },

  // --- CSF & Urinalysis ---
  { cat: "csf", nameFa: "فشار باز شدن مایع نخاع (CSF Pressure)", nameEn: "CSF Opening Pressure", abbr: "CSF OP", ref: "70 – 180 mm H2O", pearlFa: "افزایش > ۲۰۰ در مننژیت باکتریال و پرفشاری داخل جمجمه (ICP)", pearlEn: "Elevated > 200 in bacterial meningitis and raised ICP" },
  { cat: "csf", nameFa: "پروتئین مایع نخاع (CSF Protein)", nameEn: "CSF Protein", abbr: "CSF Prot", ref: "15 – 45 mg/dL", pearlFa: "افزایش چشمگیر در مننژیت باکتریال و گیلن باره (تفکیک آلبومینوسیتولوژیک)", pearlEn: "Elevated in bacterial meningitis and Guillain-Barre" },
  { cat: "csf", nameFa: "گلوکز مایع نخاع (CSF Glucose)", nameEn: "CSF Glucose", abbr: "CSF Glu", ref: "40 – 70 mg/dL (≥ 60% قند خون همزمان)", pearlFa: "کاهش بارز (< ۴۰٪ قند خون) در مننژیت باکتریال و سلی", pearlEn: "Significantly decreased in bacterial and fungal meningitis" },
  { cat: "csf", nameFa: "شمارش گلبول سفید CSF", nameEn: "CSF White Blood Cells", abbr: "CSF WBC", ref: "0 – 5 /µL (همگی تک‌هسته‌ای)", pearlFa: "غلبه پلی‌مورفونوکلئر در مننژیت باکتریال؛ غلبه لنفوسیت در ویروسی و سلی", pearlEn: "PMN predominance in bacterial; Lymphocytic in viral/TB" },
  { cat: "csf", nameFa: "وزن مخصوص ادرار (Specific Gravity)", nameEn: "Urine Specific Gravity", abbr: "Urine SG", ref: "1.005 – 1.030", pearlFa: "کاهش در دیابت بی‌مزه (< ۱.۰۰۵)؛ افزایش در کم‌آبی شدید", pearlEn: "Decreased in diabetes insipidus (< 1.005); high in dehydration" },
  { cat: "csf", nameFa: "سدیم ادرار (Urine Sodium)", nameEn: "Random Urine Sodium", abbr: "UNa", ref: "20 – 40 mEq/L", pearlFa: "در اولیگوری حاد: < ۲۰ در نارسایی پیش‌کلیوی، > ۴۰ در ATN", pearlEn: "In acute oliguria: < 20 in prerenal, > 40 in ATN" },

  // --- Endocrine & Lipids ---
  { cat: "endocrine", nameFa: "گلوکز ناشتای پلاسما (FBS)", nameEn: "Fasting Blood Sugar", abbr: "FBS", ref: "70 – 99 mg/dL", pearlFa: "پیش‌دیابت: ۱۰۰–۱۲۵ mg/dL | دیابت: ≥ ۱۲۶ در دو نوبت مجزا", pearlEn: "Prediabetes: 100-125 | Diabetes: >= 126 mg/dL" },
  { cat: "endocrine", nameFa: "هموگلوبین گلیکوزیله (HbA1c)", nameEn: "Glycated Hemoglobin", abbr: "HbA1c", ref: "طبیعی: < 5.7% | پیش‌دیابت: 5.7% – 6.4%", pearlFa: "دیابت: ≥ ۶.۵٪ | میانگین قند ۲ تا ۳ ماه گذشته", pearlEn: "Diabetes >= 6.5%; reflects past 2-3 months blood glucose" },
  { cat: "endocrine", nameFa: "هورمون محرک تیروئید (TSH)", nameEn: "Thyroid Stimulating Hormone", abbr: "TSH", ref: "0.4 – 4.0 mIU/L", pearlFa: "بهترین تست غربالگری بیماری‌های تیروئید؛ در هیپوتیروئیدی اولیه بالا می‌رود", pearlEn: "Best initial screen; elevated in primary hypothyroidism" },
  { cat: "endocrine", nameFa: "تیروکسین آزاد (Free T4)", nameEn: "Free Thyroxine", abbr: "FT4", ref: "0.8 – 1.8 ng/dL", pearlFa: "ارزیابی شدت عملکرد تیروئید همراه با TSH", pearlEn: "Assesses thyroid status in conjunction with TSH" },
  { cat: "endocrine", nameFa: "چربی‌های خون (پروفایل لیپید)", nameEn: "Lipid Profile", abbr: "Lipids", ref: "کلسترول تام: < 200 mg/dL | تری‌گلیسرید: < 150 mg/dL | LDL: < 100 mg/dL | HDL: > 40 (مردان)، > 50 (زنان)", pearlFa: "هدف LDL در بیماران با ریسک قلبی بسیار بالا: < ۵۵ تا ۷۰ mg/dL", pearlEn: "Target LDL < 70 or < 55 mg/dL in high-risk ASCVD patients" },
];

export default function LabValuesModal({ isOpen, onClose, lang = "fa" }) {
  const fa = lang === "fa";
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const filtered = useMemo(() => {
    let list = LAB_DATA;
    if (cat !== "all") list = list.filter((item) => item.cat === cat);
    if (q.trim()) {
      const term = normFa(q.trim());
      list = list.filter((item) =>
        normFa(item.nameFa).includes(term) ||
        normFa(item.nameEn).includes(term) ||
        normFa(item.abbr).includes(term) ||
        normFa(item.ref).includes(term) ||
        normFa(item.pearlFa).includes(term) ||
        normFa(item.pearlEn).includes(term)
      );
    }
    return list;
  }, [cat, q]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="modal-back lab-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-body lab-modal-shell" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="lab-modal-header">
          <div className="lab-modal-title">
            <span className="lab-modal-ico">🧪</span>
            <div>
              <h3>{fa ? "مقادیر نرمال آزمایشگاهی و تست‌های بالینی" : "Normal Clinical Laboratory Values"}</h3>
              <p className="small muted">{fa ? "مرجع سریع مقادیر مرجع و نکات کلیدی آزمون‌های پزشکی (USMLE / دستیاری / پره‌انترنی)" : "Quick reference & high-yield pearls for medical licensing exams"}</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm lab-modal-close" onClick={onClose} aria-label="Close" title={fa ? "بستن (Esc)" : "Close (Esc)"}>
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Search Input */}
        <div className="lab-modal-search-wrap">
          <Icon name="search" size={16} />
          <input
            type="text"
            className="lab-modal-search"
            placeholder={fa ? "جستجوی آزمایش، الکترولیت، اختصار (مثلاً K، پتاسیم، WBC، کراتینین)..." : "Search lab test, electrolyte, abbreviation (e.g. K, Na, WBC, Creatinine)..."}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          {q && (
            <button type="button" className="lab-search-clear" onClick={() => setQ("")} aria-label="Clear">
              ✕
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="lab-cat-tabs" role="tablist">
          {LAB_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={cat === c.id}
              className={`lab-cat-tab ${cat === c.id ? "active" : ""}`}
              onClick={() => setCat(c.id)}
            >
              {fa ? c.fa : c.en}
            </button>
          ))}
        </div>

        {/* Table Results */}
        <div className="lab-table-container">
          <table className="lab-table">
            <thead>
              <tr>
                <th style={{ width: "28%" }}>{fa ? "آزمایش / اختصار" : "Test / Abbr"}</th>
                <th style={{ width: "32%" }}>{fa ? "مقدار مرجع نرمال" : "Reference Range"}</th>
                <th style={{ width: "40%" }}>{fa ? "نکتهٔ بالینی و تفسیری" : "High-Yield Clinical Pearl"}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <div className="lab-test-name">{fa ? item.nameFa : item.nameEn}</div>
                    <div className="lab-test-sub small muted">
                      <span className="lab-abbr-tag">{item.abbr}</span> {fa ? item.nameEn : item.nameFa}
                    </div>
                  </td>
                  <td>
                    <span className="lab-ref-val">{item.ref}</span>
                  </td>
                  <td>
                    <span className="lab-pearl-text">{fa ? item.pearlFa : item.pearlEn}</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="center muted" style={{ padding: 32 }}>
                    {fa ? "موردی با این عبارت یافت نشد." : "No laboratory values matched your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="lab-modal-footer">
          <span className="small muted">
            {fa ? `نمایش ${filtered.length} مورد از ${LAB_DATA.length} مقدار مرجع استاندارد` : `Showing ${filtered.length} of ${LAB_DATA.length} standard reference ranges`}
          </span>
          <button className="btn btn-primary btn-sm" onClick={onClose}>
            {fa ? "بازگشت به آزمون" : "Back to Lesson"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
