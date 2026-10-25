/* Compact clickable glossary for hard medical words in lessons.
   Keys are matched case-insensitively; longer phrases first. */

export const GLOSSARY = [
  { k: ["همی‌آنوپی بای‌تمپورال", "bitemporal hemianopia"], fa: "از دست رفتن نیمهٔ گیجگاهی میدان بینایی هر دو چشم. تقریباً همیشه یعنی ضایعه در کیاسمای بینایی (مثلاً آدنوم هیپوفیز).", en: "Loss of both temporal visual fields. Almost always a chiasmal lesion (e.g. pituitary adenoma)." },
  { k: ["همی‌آنوپی هومونیموس", "homonymous hemianopia"], fa: "از دست رفتن نیمهٔ هم‌نام میدان هر دو چشم (هر دو راست یا هر دو چپ). ضایعه پشت کیاسما است.", en: "Same-sided field loss in both eyes. The lesion is behind the chiasm." },
  { k: ["کیاسما", "optic chiasm", "chiasm"], fa: "محل تقاطع فیبرهای نازال عصب بینایی. ضایعهٔ مرکز آن همی‌آنوپی بای‌تمپورال می‌دهد.", en: "Crossing of nasal optic-nerve fibres. A central lesion causes bitemporal hemianopia." },
  { k: ["پریمتری", "perimetry"], fa: "سنجش کامپیوتری یا دستی میدان بینایی؛ نقشهٔ نقاطی که بیمار می‌بیند یا نمی‌بیند.", en: "Measurement of the visual field — a map of where the patient can and cannot see." },
  { k: ["اسکوتوم", "scotoma"], fa: "جزیرهٔ کوری داخل میدان بینایی که اطرافش بینایی دارد.", en: "An island of blindness inside an otherwise seeing field." },
  { k: ["پاپیل‌ادم", "papilledema", "ادم پاپی"], fa: "تورم دیسک بینایی به‌خاطر فشار بالای داخل جمجمه. معمولاً دوطرفه است.", en: "Swelling of the optic disc from raised intracranial pressure. Usually bilateral." },
  { k: ["Marcus Gunn", "مارکوس گان", "RAPD"], fa: "نقص نسبی آوران مردمک: وقتی نور از چشم سالم به چشم بیمار تابیده می‌شود مردمک‌ها گشاد می‌شوند.", en: "Relative afferent pupillary defect: swinging the light to the bad eye dilates both pupils." },
  { k: ["کتواسیدوز", "DKA", "diabetic ketoacidosis"], fa: "عارضهٔ حاد دیابت با قند بالا + کتون + اسیدوز متابولیک با آنیون‌گپ بالا.", en: "Acute diabetes crisis: high glucose + ketones + high-anion-gap metabolic acidosis." },
  { k: ["STEMI"], fa: "انفارکتوس میوکارد با بالا رفتن قطعهٔ ST؛ انسداد کامل کرونر و اورژانس ریپرفیوژن.", en: "ST-elevation myocardial infarction — complete coronary occlusion; reperfusion emergency." },
  { k: ["tPA", "alteplase"], fa: "فعال‌کنندهٔ پلاسمینوژن بافتی؛ ترومبولیتیک وریدی برای سکتهٔ ایسکمیک در پنجرهٔ زمانی.", en: "Tissue plasminogen activator — IV thrombolytic for ischaemic stroke within the time window." },
  { k: ["آنیون‌گپ", "anion gap"], fa: "Na − (Cl + HCO₃). گپ بالا یعنی اسید اضافه (لاکتات، کتون، توکسین).", en: "Na − (Cl + HCO₃). A high gap means extra acid (lactate, ketones, toxins)." },
  { k: ["سپسیس", "sepsis"], fa: "پاسخ ایمنی بی‌نظم به عفونت که باعث اختلال ارگان می‌شود.", en: "Dysregulated host response to infection causing organ dysfunction." },
  { k: ["شوک سپتیک", "septic shock"], fa: "سپسیس به‌علاوه افت فشار که با مایع اصلاح نمی‌شود و نیاز به وازوپرسور دارد.", en: "Sepsis plus hypotension that persists after fluids and needs vasopressors." },
  { k: ["اندوکاردیت", "endocarditis"], fa: "عفونت لایهٔ داخلی قلب / دریچه‌ها. معیار دوک برای تشخیص.", en: "Infection of the heart lining or valves. Diagnosed with the Duke criteria." },
  { k: ["معیار دوک", "Duke criteria"], fa: "قواعد تشخیصی اندوکاردیت عفونی بر اساس کشت خون، اکو و یافته‌های بالینی.", en: "Diagnostic rules for infective endocarditis based on blood cultures, echo and clinical findings." },
  { k: ["مننژیت", "meningitis"], fa: "التهاب پرده‌های مغز. سفتی گردن، فتوفوبیا، تب. پونکسیون کمری تشخیصی است.", en: "Inflammation of the meninges. Neck stiffness, photophobia, fever. LP is diagnostic." },
  { k: ["آنسفالیت", "encephalitis"], fa: "التهاب خودِ بافت مغز؛ تغییر سطح هوشیاری و تشنج شایع‌تر از مننژیت خالص است.", en: "Inflammation of brain parenchyma; altered consciousness and seizures are more typical than in pure meningitis." },
  { k: ["آبسه مغزی", "brain abscess"], fa: "کانون چرکی داخل پارانشیم مغز. تب + نقص کانونی + ضایعه حلقوی در تصویر.", en: "Focal pus inside brain tissue. Fever + focal deficit + ring-enhancing lesion." },
  { k: ["سل", "tuberculosis", "TB"], fa: "عفونت مایکوباکتریوم توبرکلوزیس. می‌تواند ریوی یا خارج‌ریوی (مننژ، استخوان، کلیه) باشد.", en: "Mycobacterium tuberculosis infection — pulmonary or extrapulmonary (meninges, bone, kidney)." },
  { k: ["PPD", "توبرکولین", "TST"], fa: "تست پوستی توبرکولین برای مواجهه با سل. تفسیر آستانه بستگی به ریسک بیمار دارد.", en: "Tuberculin skin test for TB exposure. The cutoff depends on the patient's risk." },
  { k: ["HIV", "ایدز", "AIDS"], fa: "ویروس نقص ایمنی انسانی. ایدز مرحلهٔ پیشرفته با CD4 پایین یا عفونت فرصت‌طلب است.", en: "Human immunodeficiency virus. AIDS is the late stage with low CD4 or an opportunistic infection." },
  { k: ["CD4"], fa: "نوعی لنفوسیت T که HIV آن را هدف می‌گیرد. عدد آن شدت نقص ایمنی را نشان می‌دهد.", en: "The T-helper cell HIV targets. Its count marks how severe the immune damage is." },
  { k: ["پروگnostic", "prognosis"], fa: "پیش‌آگهی: سیر محتمل بیماری و احتمال بهبود یا عارضه.", en: "The likely course of the disease and the chance of recovery or complication." },
  { k: ["پاتognومونیک", "pathognomonic"], fa: "یافته‌ای که به‌تنهایی تشخیص را قطعی می‌کند.", en: "A finding that by itself settles the diagnosis." },
  { k: ["افتراقی", "differential"], fa: "فهرست تشخیص‌های محتمل که باید از هم جدا شوند.", en: "The list of plausible diagnoses that must be told apart." },
  { k: ["پروفیلاکسی", "prophylaxis", "PEP"], fa: "دارو یا واکسن برای جلوگیری از بیماری قبل یا بلافاصله بعد از مواجهه.", en: "A drug or vaccine given to prevent disease before or right after exposure." },
  { k: ["امپریک", "empiric", "تجربی"], fa: "شروع درمان بر اساس شایع‌ترین عامل، قبل از آماده شدن کشت.", en: "Starting treatment for the most likely organism before cultures return." },
  { k: ["باکتریمی", "bacteremia"], fa: "وجود باکتری در خون. همیشه معادل سپسیس نیست.", en: "Bacteria in the blood. Not automatically the same as sepsis." },
  { k: ["نوتروپنی", "neutropenia"], fa: "کاهش نوتروفیل‌ها؛ بیمار به‌شدت مستعد عفونت باکتریایی و قارچی است.", en: "Low neutrophils — the patient is highly prone to bacterial and fungal infection." },
  { k: ["CSF", "مایع مغزی‌نخاعی"], fa: "مایع مغزی‌نخاعی که با پونکسیون کمری گرفته می‌شود.", en: "Cerebrospinal fluid, sampled by lumbar puncture." },
  { k: ["پونکسیون کمری", "lumbar puncture", "LP"], fa: "نمونه‌گیری CSF از فضای زیرعنکبوتیه در کمر برای تشخیص مننژیت و خونریزی.", en: "Sampling CSF from the lumbar subarachnoid space to diagnose meningitis or bleeding." },
  { k: ["هیپوناترمی", "hyponatraemia", "hyponatremia"], fa: "سدیم سرم پایین. اصلاح خیلی سریع می‌تواند میلینولیز پونتین بدهد.", en: "Low serum sodium. Over-rapid correction can cause central pontine myelinolysis." },
  { k: ["میلینولیز پونتین", "central pontine myelinolysis", "CPM", "ODS"], fa: "تخریب میلین پل مغز پس از اصلاح سریع هیپوناترمی. کوادری‌پارزی و سندرم قفل‌شدگی.", en: "Pontine myelin injury after rapid sodium correction. Quadriparesis and locked-in syndrome." },
  { k: ["NMO", "Devic", "نورومیلیت اپتیکا", "aquaporin-4"], fa: "بیماری آنتی‌بادی آکواپورین-۴: نوریت اپتیک + میلیت طولی گسترده، مغز معمولاً طبیعی.", en: "Aquaporin-4 antibody disease: optic neuritis + longitudinally extensive myelitis; brain often normal." },
  { k: ["میلیت", "myelitis"], fa: "التهاب نخاع. سطح حسی و ضعف اندام مشخصه است.", en: "Inflammation of the spinal cord. A sensory level and limb weakness are typical." },
  { k: ["نوریت اپتیک", "optic neuritis"], fa: "التهاب عصب بینایی؛ کاهش دید دردناک با حرکت چشم و اغلب RAPD.", en: "Inflammation of the optic nerve — painful vision loss on eye movement, often with RAPD." },
  { k: ["آفازی", "aphasia"], fa: "اختلال زبان به‌خاطر ضایعهٔ نیمکرهٔ غالب (معمولاً چپ).", en: "Language disorder from a dominant-hemisphere lesion (usually left)." },
  { k: ["دیزآرتری", "dysarthria"], fa: "گفتار نامفهوم به‌خاطر ضعف عضلات تکلم، نه اختلال زبان.", en: "Slurred speech from weak articulatory muscles, not a language problem." },
  { k: ["آتاکسی", "ataxia"], fa: "ناهماهنگی حرکت؛ اغلب مخچه‌ای یا حسی.", en: "Incoordination of movement — often cerebellar or sensory." },
  { k: ["همی‌پارزی", "hemiparesis"], fa: "ضعف یک نیمهٔ بدن. ضایعهٔ راه هرمی مقابل (بالای دکوساسیون).", en: "Weakness of one side of the body. Contralateral pyramidal lesion above the decussation." },
  { k: ["کوادری‌پارزی", "quadriparesis"], fa: "ضعف هر چهار اندام. ضایعهٔ گردنی یا ساقهٔ مغز.", en: "Weakness of all four limbs. Cervical cord or brainstem lesion." },
  { k: ["سندرم قفل‌شدگی", "locked-in"], fa: "بیداری با فلج چهاراندام و بولبر؛ فقط حرکت عمودی چشم می‌ماند. ضایعهٔ شکمی پل.", en: "Awake quadriplegia and anarthria; only vertical eye movement remains. Ventral pontine lesion." },
  { k: ["TIG", "ایمونوگلوبولین کزاز"], fa: "آنتی‌بادی آماده علیه سم کزاز؛ برای زخم کثیف در کسی که واکسن ناکافی دارد.", en: "Ready-made antibody against tetanus toxin, for dirty wounds in under-vaccinated people." },
  { k: ["توکسوئید", "toxoid"], fa: "سم غیرفعال‌شده که به‌عنوان واکسن ایمنی فعال می‌سازد (کزاز، دیفتری).", en: "Inactivated toxin used as a vaccine to build active immunity (tetanus, diphtheria)." },
  { k: ["Tdap", "Td"], fa: "واکسن یادآور کزاز-دیفتری (± سیاه‌سرفه). Tdap یک‌بار در بزرگسالی، بعد Td هر ۱۰ سال.", en: "Tetanus-diphtheria booster (± pertussis). One Tdap in adulthood, then Td every 10 years." },
  { k: ["اسلتامیویر", "oseltamivir"], fa: "مهارکنندهٔ نورآمینیداز آنفلوانزا. در پرخطرها ظرف ۴۸ ساعت شروع شود.", en: "Influenza neuraminidase inhibitor. Start within 48 hours in high-risk patients." },
  { k: ["BMI"], fa: "شاخص تودهٔ بدنی: وزن(کیلو) ÷ قد²(متر). ≥۴۰ چاقی مرضی و پرخطر برای آنفلوانزا است.", en: "Body-mass index: kg / m². ≥40 is severe obesity and a high-risk flu group." },
];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function glossaryPayload(lang = "fa") {
  return GLOSSARY.map((g) => ({
    keys: g.k,
    def: lang === "en" ? g.en : g.fa,
  }));
}
