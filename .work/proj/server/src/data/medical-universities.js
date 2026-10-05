/* فهرست دانشگاه‌های علوم پزشکی ایران — کانونی برای MED School
   کد یکتا (code) کلید پایدار است؛ تغییر نام دانشگاه رابطهٔ داده را نمی‌شکند (JOIN بر id، اما CSV بر code).
   منبع: وزارت بهداشت، درمان و آموزش پزشکی + الگوی ویکی‌پدیا Iran_medical_universities + به‌روزرسانی ۱۴۰۴.
   ترتیب: بر پایه قطب آموزشی وزارت (تهران، گیلان، مازندران، اصفهان، تبریز، شیراز، اهواز، کرمان، مشهد، زاهدان)
   فقط علوم‌پزشکی دولتی (۶۵) + «دانشگاه پیش‌فرض» (id=1) جداگانه در DB می‌ماند. */

export const MEDICAL_UNIVERSITIES = [
  // قطب تهران
  { code: "TUMS",        name_fa: "دانشگاه علوم پزشکی تهران",               name_en: "Tehran University of Medical Sciences",              city_fa: "تهران",        city_en: "Tehran" },
  { code: "SBMU",        name_fa: "دانشگاه علوم پزشکی شهید بهشتی",           name_en: "Shahid Beheshti University of Medical Sciences",    city_fa: "تهران",        city_en: "Tehran" },
  { code: "IUMS",        name_fa: "دانشگاه علوم پزشکی ایران",                name_en: "Iran University of Medical Sciences",              city_fa: "تهران",        city_en: "Tehran" },
  { code: "BAQIYAT",     name_fa: "دانشگاه علوم پزشکی بقیه‌الله",            name_en: "Baqiyatallah University of Medical Sciences",      city_fa: "تهران",        city_en: "Tehran" },
  { code: "AJA-MED",     name_fa: "دانشگاه علوم پزشکی ارتش (آجا)",           name_en: "AJA University of Medical Sciences",               city_fa: "تهران",        city_en: "Tehran" },
  { code: "SHAHED-MED",  name_fa: "دانشگاه علوم پزشکی شاهد",                 name_en: "Shahed University of Medical Sciences",             city_fa: "تهران",        city_en: "Tehran" },
  { code: "USWR",        name_fa: "دانشگاه علوم توانبخشی و سلامت اجتماعی",   name_en: "University of Social Welfare & Rehabilitation Sciences", city_fa: "تهران", city_en: "Tehran" },
  { code: "ALBORZ",      name_fa: "دانشگاه علوم پزشکی البرز",                name_en: "Alborz University of Medical Sciences",            city_fa: "کرج",          city_en: "Karaj" },
  { code: "QAZVIN",      name_fa: "دانشگاه علوم پزشکی قزوین",                name_en: "Qazvin University of Medical Sciences",            city_fa: "قزوین",        city_en: "Qazvin" },
  { code: "QOM-MED",     name_fa: "دانشگاه علوم پزشکی قم",                   name_en: "Qom University of Medical Sciences",               city_fa: "قم",           city_en: "Qom" },
  { code: "ZANJAN",      name_fa: "دانشگاه علوم پزشکی زنجان",                name_en: "Zanjan University of Medical Sciences",            city_fa: "زنجان",        city_en: "Zanjan" },
  { code: "ARAK",        name_fa: "دانشگاه علوم پزشکی اراک",                 name_en: "Arak University of Medical Sciences",              city_fa: "اراک",         city_en: "Arak" },
  { code: "SAVEH",       name_fa: "دانشکده علوم پزشکی ساوه",                 name_en: "Saveh School of Medical Sciences",                city_fa: "ساوه",         city_en: "Saveh" },
  { code: "KHOMEYN",     name_fa: "دانشکده علوم پزشکی خمین",                 name_en: "Khomeyn School of Medical Sciences",               city_fa: "خمین",         city_en: "Khomeyn" },

  // قطب گیلان/مازندران
  { code: "GUMS",        name_fa: "دانشگاه علوم پزشکی گیلان",                name_en: "Guilan University of Medical Sciences",            city_fa: "رشت",          city_en: "Rasht" },
  { code: "MAZUMS",      name_fa: "دانشگاه علوم پزشکی مازندران",             name_en: "Mazandaran University of Medical Sciences",        city_fa: "ساری",         city_en: "Sari" },
  { code: "BABOL",       name_fa: "دانشگاه علوم پزشکی بابل",                 name_en: "Babol University of Medical Sciences",             city_fa: "بابل",         city_en: "Babol" },
  { code: "GOLESTAN",    name_fa: "دانشگاه علوم پزشکی گلستان",               name_en: "Golestan University of Medical Sciences",          city_fa: "گرگان",        city_en: "Gorgan" },
  { code: "SEMNAN",      name_fa: "دانشگاه علوم پزشکی سمنان",                name_en: "Semnan University of Medical Sciences",            city_fa: "سمنان",        city_en: "Semnan" },
  { code: "SHAHROUD",    name_fa: "دانشگاه علوم پزشکی شاهرود",               name_en: "Shahroud University of Medical Sciences",          city_fa: "شاهرود",       city_en: "Shahroud" },
  { code: "GONABAD",     name_fa: "دانشگاه علوم پزشکی گناباد",               name_en: "Gonabad University of Medical Sciences",            city_fa: "گناباد",       city_en: "Gonabad" },
  { code: "SABZEVAR",    name_fa: "دانشگاه علوم پزشکی سبزوار",               name_en: "Sabzevar University of Medical Sciences",          city_fa: "سبزوار",       city_en: "Sabzevar" },
  { code: "TORBAT-HEY",  name_fa: "دانشگاه علوم پزشکی تربت حیدریه",           name_en: "Torbat Heydarieh University of Medical Sciences",  city_fa: "تربت حیدریه", city_en: "Torbat Heydarieh" },

  // قطب تبریز/آذربایجان
  { code: "TBZMED",      name_fa: "دانشگاه علوم پزشکی تبریز",                name_en: "Tabriz University of Medical Sciences",            city_fa: "تبریز",        city_en: "Tabriz" },
  { code: "ARDEBIL",     name_fa: "دانشگاه علوم پزشکی اردبیل",               name_en: "Ardabil University of Medical Sciences",           city_fa: "اردبیل",       city_en: "Ardabil" },
  { code: "URMIA",       name_fa: "دانشگاه علوم پزشکی ارومیه",               name_en: "Urmia University of Medical Sciences",             city_fa: "ارومیه",       city_en: "Urmia" },
  { code: "MARAGHEH",    name_fa: "دانشکده علوم پزشکی مراغه",                name_en: "Maragheh School of Medical Sciences",              city_fa: "مراغه",        city_en: "Maragheh" },
  { code: "KHALKHAL",    name_fa: "دانشکده علوم پزشکی خلخال",                name_en: "Khalkhal School of Medical Sciences",              city_fa: "خلخال",        city_en: "Khalkhal" },
  { code: "SARAB",       name_fa: "دانشکده علوم پزشکی سراب",                 name_en: "Sarab School of Medical Sciences",                 city_fa: "سراب",         city_en: "Sarab" },

  // قطب اصفهان/یزد/شهرکرد
  { code: "MUI",         name_fa: "دانشگاه علوم پزشکی اصفهان",                name_en: "Isfahan University of Medical Sciences",           city_fa: "اصفهان",       city_en: "Isfahan" },
  { code: "KASHAN",      name_fa: "دانشگاه علوم پزشکی کاشان",                name_en: "Kashan University of Medical Sciences",            city_fa: "کاشان",        city_en: "Kashan" },
  { code: "SHAHREKORD",  name_fa: "دانشگاه علوم پزشکی شهرکرد",                name_en: "Shahrekord University of Medical Sciences",        city_fa: "شهرکرد",      city_en: "Shahrekord" },
  { code: "YAZD-SSU",    name_fa: "دانشگاه علوم پزشکی شهید صدوقی یزد",       name_en: "Shahid Sadoughi University of Medical Sciences",   city_fa: "یزد",          city_en: "Yazd" },

  // قطب همدان/غرب
  { code: "HAMEDAN",     name_fa: "دانشگاه علوم پزشکی همدان",                name_en: "Hamadan University of Medical Sciences",           city_fa: "همدان",        city_en: "Hamadan" },
  { code: "ILAM",        name_fa: "دانشگاه علوم پزشکی ایلام",                name_en: "Ilam University of Medical Sciences",              city_fa: "ایلام",        city_en: "Ilam" },
  { code: "KERMANSHAH",  name_fa: "دانشگاه علوم پزشکی کرمانشاه",             name_en: "Kermanshah University of Medical Sciences",        city_fa: "کرمانشاه",    city_en: "Kermanshah" },
  { code: "KURDISTAN",   name_fa: "دانشگاه علوم پزشکی کردستان",              name_en: "Kurdistan University of Medical Sciences",         city_fa: "سنندج",       city_en: "Sanandaj" },
  { code: "LORSTAN",     name_fa: "دانشگاه علوم پزشکی لرستان",               name_en: "Lorestan University of Medical Sciences",          city_fa: "خرم‌آباد",    city_en: "Khorramabad" },

  // قطب اهواز
  { code: "AJUMS",       name_fa: "دانشگاه علوم پزشکی جندی‌شاپور اهواز",     name_en: "Ahvaz Jundishapur University of Medical Sciences", city_fa: "اهواز",        city_en: "Ahvaz" },
  { code: "ABADAN",      name_fa: "دانشگاه علوم پزشکی آبادان",               name_en: "Abadan University of Medical Sciences",            city_fa: "آبادان",       city_en: "Abadan" },
  { code: "DEZFUL",      name_fa: "دانشگاه علوم پزشکی دزفول",                name_en: "Dezful University of Medical Sciences",            city_fa: "دزفول",        city_en: "Dezful" },
  { code: "BEHBAHAN",    name_fa: "دانشکده علوم پزشکی بهبهان",               name_en: "Behbahan School of Medical Sciences",              city_fa: "بهبهان",       city_en: "Behbahan" },
  { code: "SHUSHTAR",    name_fa: "دانشکده علوم پزشکی شوشتر",                name_en: "Shushtar School of Medical Sciences",              city_fa: "شوشتر",       city_en: "Shushtar" },

  // قطب کرمان/سیستان
  { code: "KERM-UM",     name_fa: "دانشگاه علوم پزشکی کرمان",                name_en: "Kerman University of Medical Sciences",            city_fa: "کرمان",        city_en: "Kerman" },
  { code: "RAFSANJAN",   name_fa: "دانشگاه علوم پزشکی رفسنجان",              name_en: "Rafsanjan University of Medical Sciences",         city_fa: "رفسنجان",      city_en: "Rafsanjan" },
  { code: "JIR-OFT",     name_fa: "دانشگاه علوم پزشکی جیرفت",                name_en: "Jiroft University of Medical Sciences",            city_fa: "جیرفت",        city_en: "Jiroft" },
  { code: "BAM",         name_fa: "دانشگاه علوم پزشکی بم",                   name_en: "Bam University of Medical Sciences",               city_fa: "بم",           city_en: "Bam" },
  { code: "SIRJAN",      name_fa: "دانشکده علوم پزشکی سیرجان",               name_en: "Sirjan School of Medical Sciences",                city_fa: "سیرجان",       city_en: "Sirjan" },
  { code: "ZAHEDAN",     name_fa: "دانشگاه علوم پزشکی زاهدان",               name_en: "Zahedan University of Medical Sciences",           city_fa: "زاهدان",       city_en: "Zahedan" },
  { code: "ZABOL",       name_fa: "دانشگاه علوم پزشکی زابل",                 name_en: "Zabol University of Medical Sciences",             city_fa: "زابل",         city_en: "Zabol" },
  { code: "IRANSHAHR",   name_fa: "دانشگاه علوم پزشکی ایرانشهر",             name_en: "Iranshahr University of Medical Sciences",         city_fa: "ایرانشهر",     city_en: "Iranshahr" },
  { code: "CHABAHAR",    name_fa: "دانشگاه علوم پزشکی چابهار",               name_en: "Chabahar University of Medical Sciences",          city_fa: "چابهار",       city_en: "Chabahar" },

  // قطب مشهد/خراسان
  { code: "MUMS",        name_fa: "دانشگاه علوم پزشکی مشهد",                 name_en: "Mashhad University of Medical Sciences",            city_fa: "مشهد",         city_en: "Mashhad" },
  { code: "BIRJAND",     name_fa: "دانشگاه علوم پزشکی بیرجند",               name_en: "Birjand University of Medical Sciences",           city_fa: "بیرجند",       city_en: "Birjand" },
  { code: "BOJNORD",     name_fa: "دانشگاه علوم پزشکی خراسان شمالی",         name_en: "North Khorasan University of Medical Sciences",   city_fa: "بجنورد",       city_en: "Bojnord" },
  { code: "NEYSHA-BUR",  name_fa: "دانشکده علوم پزشکی نیشابور",              name_en: "Neyshabur School of Medical Sciences",             city_fa: "نیشابور",     city_en: "Neyshabur" },
  { code: "ESFAR-A",     name_fa: "دانشکده علوم پزشکی اسفراین",              name_en: "Esfarayen School of Medical Sciences",             city_fa: "اسفراین",      city_en: "Esfarayen" },
  { code: "TORBAT-JAM",  name_fa: "دانشکده علوم پزشکی تربت جام",             name_en: "Torbat Jam School of Medical Sciences",            city_fa: "تربت جام",    city_en: "Torbat Jam" },

  // قطب شیراز/جنوب
  { code: "SUMS",        name_fa: "دانشگاه علوم پزشکی شیراز",                name_en: "Shiraz University of Medical Sciences",            city_fa: "شیراز",        city_en: "Shiraz" },
  { code: "FASA",        name_fa: "دانشگاه علوم پزشکی فسا",                  name_en: "Fasa University of Medical Sciences",              city_fa: "فسا",          city_en: "Fasa" },
  { code: "JAHROM",      name_fa: "دانشگاه علوم پزشکی جهرم",                 name_en: "Jahrom University of Medical Sciences",            city_fa: "جهرم",         city_en: "Jahrom" },
  { code: "LARESTAN",    name_fa: "دانشکده علوم پزشکی لارستان",              name_en: "Larestan School of Medical Sciences",              city_fa: "لار",          city_en: "Lar" },
  { code: "GERASH",      name_fa: "دانشکده علوم پزشکی گراش",                 name_en: "Gerash School of Medical Sciences",                city_fa: "گراش",         city_en: "Gerash" },
  { code: "YASUJ",       name_fa: "دانشگاه علوم پزشکی یاسوج",                name_en: "Yasuj University of Medical Sciences",             city_fa: "یاسوج",        city_en: "Yasuj" },
  { code: "BUSHEHR",     name_fa: "دانشگاه علوم پزشکی بوشهر",                name_en: "Bushehr University of Medical Sciences",           city_fa: "بوشهر",        city_en: "Bushehr" },
  { code: "HORMOZGAN",   name_fa: "دانشگاه علوم پزشکی هرمزگان",              name_en: "Hormozgan University of Medical Sciences",         city_fa: "بندرعباس",    city_en: "Bandar Abbas" },
];

export function findUniversityByCode(code) {
  if (!code) return null;
  const c = String(code).trim().toUpperCase();
  return MEDICAL_UNIVERSITIES.find((u) => u.code.toUpperCase() === c) || null;
}
