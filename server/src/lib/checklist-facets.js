/* Round 62 — evidence-point grouping for the default virtual-patient checklists.

   Historically each checklist item listed flat synonyms and was scored all or
   nothing. Items are now split into evidence points: a key written as
   "a|b|c" is one point whose synonyms all count, and the item earns the share of
   points covered (see keyedCredit in ai-engine.js).

   REGROUPINGS lists the legacy key set of each default item and its new points.
   Only an item whose id AND legacy keys match exactly is rewritten, so a teacher's
   edited item is never touched. Used by seed.js (fresh installs) and the one-off
   migration in db.js (existing installs). */
export const REGROUPINGS = [
 {
  "id": "i1",
  "legacy": [
   "من دکتر",
   "من پزشک",
   "دکتر شما",
   "پزشک شما",
   "معرفی",
   "اجازه هست",
   "کسب رضایت",
   "با اجازه",
   "رضایت دارید",
   "introduce",
   "i am dr",
   "i am doctor",
   "consent"
  ],
  "facets": [
   "معرفی|من دکتر|من پزشک|دکتر شما|پزشک شما|من دانشجو|من اکسترن|من اینترن|دانشجوی پزشکی|introduce|i am dr|i am doctor|i am a medical student|i am a student|i am an extern|i am an intern",
   "اجازه هست|با اجازه|رضایت دارید|کسب رضایت|consent|permission"
  ]
 },
 {
  "id": "i2",
  "legacy": [
   "انتشار",
   "بازو",
   "فشارنده",
   "تیر کشیدن",
   "radiat",
   "arm",
   "crush"
  ],
  "facets": [
   "کجا|محل|location|site",
   "فشارنده|crush|character|quality",
   "انتشار|بازو|تیر کشیدن|radiat|arm"
  ]
 },
 {
  "id": "i3",
  "legacy": [
   "دیابت",
   "فشار خون",
   "سیگار",
   "سابقه قلبی",
   "diabet",
   "smok",
   "hypertens",
   "cardiac history"
  ],
  "facets": [
   "دیابت|diabet",
   "فشار خون|hypertens",
   "سیگار|smok",
   "سابقه قلبی|cardiac history"
  ]
 },
 {
  "id": "i_ros",
  "legacy": [
   "مرور سیستم",
   "ros",
   "تنگی نفس",
   "تعریق",
   "عرق سرد",
   "تهوع",
   "تپش",
   "dyspnea",
   "sweat",
   "nausea",
   "palpitation"
  ],
  "facets": [
   "تنگی نفس|dyspnea|shortness of breath",
   "تعریق|عرق سرد|sweat",
   "تهوع|nausea",
   "تپش|palpitation"
  ]
 },
 {
  "id": "i_exam",
  "legacy": [
   "معاینه",
   "علائم حیاتی",
   "فشار خون",
   "سمع",
   "نبض",
   "vitals",
   "physical exam",
   "auscultat",
   "bp",
   "pulse"
  ],
  "facets": [
   "معاینه|physical exam|examin",
   "علائم حیاتی|vitals|فشار خون|bp",
   "نبض|pulse",
   "سمع|auscultat"
  ]
 },
 {
  "id": "i7",
  "legacy": [
   "aspirin",
   "آسپرین",
   "آنژیوگرافی",
   "pci",
   "درمان",
   "treatment",
   "reperfus"
  ],
  "facets": [
   "aspirin|آسپرین",
   "آنژیوگرافی|pci|reperfus",
   "درمان|treatment"
  ]
 },
 {
  "id": "i1",
  "legacy": [
   "من دکتر",
   "من پزشک",
   "دکتر شما",
   "پزشک شما",
   "معرفی",
   "اجازه هست",
   "کسب رضایت",
   "با اجازه",
   "رضایت دارید",
   "introduce",
   "i am dr",
   "i am doctor",
   "consent"
  ],
  "facets": [
   "معرفی|من دکتر|من پزشک|دکتر شما|پزشک شما|من دانشجو|من اکسترن|من اینترن|دانشجوی پزشکی|introduce|i am dr|i am doctor|i am a medical student|i am a student|i am an extern|i am an intern",
   "اجازه هست|با اجازه|رضایت دارید|کسب رضایت|consent|permission"
  ]
 },
 {
  "id": "i2",
  "legacy": [
   "غذا",
   "چرب",
   "کجا",
   "کیفیت درد",
   "meal",
   "fatty",
   "pain"
  ],
  "facets": [
   "کجا|محل|location|site",
   "کیفیت درد|quality|character",
   "غذا|چرب|meal|fatty"
  ]
 },
 {
  "id": "i3",
  "legacy": [
   "تهوع",
   "استفراغ",
   "تب",
   "nausea",
   "vomit",
   "fever"
  ],
  "facets": [
   "تهوع|nausea",
   "استفراغ|vomit",
   "تب|fever"
  ]
 },
 {
  "id": "i_ros",
  "legacy": [
   "مرور سیستم",
   "ros",
   "زردی",
   "ادرار",
   "مدفوع",
   "jaundice",
   "stool",
   "urine"
  ],
  "facets": [
   "زردی|jaundice",
   "ادرار|urine",
   "مدفوع|stool"
  ]
 },
 {
  "id": "i4",
  "legacy": [
   "مورفی",
   "murphy",
   "معاینه شکم",
   "تندرنس",
   "لمس",
   "tenderness",
   "palpat"
  ],
  "facets": [
   "معاینه شکم|abdominal exam|physical exam|examin",
   "مورفی|murphy|تندرنس|tenderness|لمس|palpat"
  ]
 }
];

export function regroupDefaultItem(item) {
  const legacy = JSON.stringify(Array.isArray(item?.keys) ? item.keys : []);
  const hit = REGROUPINGS.find((r) => r.id === item?.id && JSON.stringify(r.legacy) === legacy);
  return hit ? { ...item, keys: [...hit.facets] } : item;
}

/* Returns { items, changed } for a checklist's items array. */
export function regroupDefaultItems(items) {
  let changed = 0;
  const out = (Array.isArray(items) ? items : []).map((it) => {
    const next = regroupDefaultItem(it);
    if (next !== it) changed++;
    return next;
  });
  return { items: out, changed };
}
