# پژوهش عمیق — لندینگ + دانشگاه‌ها + ورود دسته‌جمعی (۲۰۲۶-۱۰-۰۴)

> **قانون:** اول گزارش باگ‌ها، سپس اصلاح با اجازه — این سند «ریسرچ» است، اصلاح در فاز بعد.

---

## ۱) لندینگ — ممیزی بصریِ «در چشم» (Landing.jsx + design-refresh.css)

### یافته‌های کد و UX (research 2026)
**مرجع:** 21st.dev glassmorphism, Landy/Hero 2026, HelpfulHero 9 modern landings — اصول: headline benefit-driven 48px+ CTA، trust در نقطه تصمیم، whitespace کافی، sticky header بدون دوباره‌کاری.

**وضع موجود (کد):**
- هدر **تک‌هدر** `.lp-nav` با `position:sticky` و کلاس `raised` پس از 320px — قبلاً دو هدر روی هم بود و ۲۵٪ viewport موبایل را می‌گرفت (اکنون رفع شده، اما سایه `raised` خیلی کم‌مایه است و در تم روشن دیده نمی‌شود).
- `.lp-hero` دارای `lp-hero-glow` (گرادیان radial) + `lp-hero-inner` (متن) + `lp-hero-mock` (ماکِ مسیر Duolingo) — **باگ چشمی محتمل:** `mock` با `marginInlineStart: 0/60px` روی موبایل باریک، از کادر بیرون می‌زند و `overflow:hidden` هیرو آن را می‌بُرد؛ فاصله `gap` بین دو ستون هیرو در `<900px` به‌هم می‌چسبد.
- CTA اصلی `lp-btn-primary` + `lp-btn-outline` کنار هم — **باگ RTL:** `gap` و `marginInlineStart` درست است اما `mock-path` با `marginInlineStart` LTR-first است؛ در `dir=rtl` مسیر زیگ‌زاگ برعکسِ انتظارِ چشم فارسی می‌افتد.
- آمار `lp-stats` فقط وقتی `live?.stats` مقدار داشته باشد نمایش داده می‌شود — اگر آستانه ادمین نرسیده باشد، **فضای خالی بزرگی** زیر CTA می‌ماند و هیرو «خالی» به‌نظر می‌رسد (بدون fallback).
- بخش Audiences: دو کارت `lp-aud-card` با گرادیان؛ **باگ:** کارت‌ها `min-height` یکسان ندارند — اگر `landLearnerDesc` کوتاه‌تر از `landUniDesc` باشد، دکمه‌های `→` تراز نیستند.
- Features: ۶ فیچر در گرید — **باگ:** آیکون‌ها ۲۲px و عنوان ۱rem؛ در فارسی عنوان‌ها طولانی‌تر و به دو خط می‌شکنند اما `lp-feature` `align-items: start` ندارد → ناهم‌ترازی عمودی.
- Steps: شماره `۱/۲/۳` + آیکون — **باگ:** `lp-step-num` دایره‌ای با `background: var(--primary)` اما در تم تاریک کنتراست کم است.
- Gamify: `lp-gamify` دو ستونه (متن + `MockLeague`) — **باگ:** در موبایل `MockLeague` زیر متن می‌افتد اما `gap` زیاد و `padding` کم → چسبندگی.
- Testimonials: فقط اگر `cmsTestimonials` یا `live.testimonials` باشد — اگر خالی، سکشن حذف می‌شود و **پرش ناگهانی** از Gamify به FAQ حس می‌شود.
- FAQ: `lp-faq` با `open` — **باگ:** انیمیشن باز/بسته ندارد و `aria-expanded` درست است اما `focus-ring` دیده نمی‌شود.
- Footer: سه خط ساده — **باگ:** لوگو 20px و متن حقوق با `©` در یک خط؛ در موبایل `flex-wrap` ندارد و سرریز می‌کند.

**ریسرچِ پیشنهادیِ اصلاح (بدون اجرای فعلاً):**
1. هیرو: گرید `1fr 380px` در دسکتاپ، `stack` در `<960px` با `gap: 28px`، `mock` با `max-width: 360px` و `margin: 0 auto`.
2. هدر `raised`: سایه `0 8px 24px rgba(15,23,42,.10)` در روشن و `.14` در تاریک + `backdrop-blur: 10px`.
3. RTL: `mock-path` با `logical properties` (`margin-inline-start`) تست RTL.
4. Stats fallback: اگر `stats.length===0`، نمایش ۴ عدد دمو با `opacity:.55` + برچسب «به‌زودی» به‌جای حذف کامل.
5. کارت Audiences: `display:flex; flex-direction:column; flex:1` + `margin-top:auto` روی دکمه.
6. Features/Steps/Gamify: `align-items: stretch` و `gap` یکسان + `prefers-reduced-motion`.

---

## ۲) دانشگاه‌ها — فقط «پیش‌فرض» وجود دارد

**کد:**
- `server/src/db.js:1456` — فقط یک سطر: `INSERT OR IGNORE INTO universities (id=1, 'دانشگاه پیش‌فرض','Default University', code='DEFAULT')`
- `client/src/data/provinces.js` — ۳۱ استان هست، اما **هیچ فایل `universities.js` یا `medical-universities.js` وجود ندارد**.
- `Admin.jsx` — انتخاب دانشگاه فقط `select` از `universities` که از `GET /admin/universities` می‌آید؛ اگر فقط یکی باشد، لیست خالیِ واقعی دیده می‌شود.
- وابستگی‌ها: `users.university_id`, `classes.university_id`, `cases.university_id`, `flashcards.university_id`, `exams.university_id`, `university_usage`, `reference_catalog` — همه `FK` منطقی به `universities.id` دارند؛ **تغییر نام دانشگاه نباید `id` را عوض کند** تا روابط حفظ شود.

**نیاز کاربر:**
- فهرست **تمام دانشگاه‌های علوم پزشکی ایران** (۶۵+ مورد) — با `name_fa`, `name_en`, `city_fa`, `city_en`, `code` یکتا (مثلاً `TUMS`, `SUMS`, `MUMS`, `TBZMED`, `ARAK` ...)، `active=1`
- حفظ ارتباط: `code` به‌عنوان کلید پایدار، `id` ثابت (1 = پیش‌فرض باقی می‌ماند)، بقیه `AUTOINCREMENT` از 2 به بعد.
- منبع رسمی: وزارت بهداشت + Wikipedia Category:Medical schools in Iran (۴۵ صفحه) + GFMER list — تجمیع به ۶۸ مورد:
  - تهران: TUMS, SBMU, IUMS, Baqiyatallah, AJA, Shahed, Army
  - البرز، قم، قزوین، زنجان، اردبیل، گیلان، مازندران، گلستان، سمنان، بابل، گناباد، سبزوار، نیشابور (در صورت وجود)، مشهد، تربت حیدریه، بیرجند، زاهدان، ایرانشهر، زابل، کرمان، رفسنجان، جیرفت، بم، یزد (شهید صدوقی)، شیراز، فسا، جهرم، یاسوج، بوشهر، بندرعباس، کاشان، اصفهان، شهرکرد، همدان، ایلام، کرمانشاه، کردستان، لرستان، اهواز جندی‌شاپور، آبادان، دزفول، اراک، همدان، خمین (در صورت ادغام)، ارومیه، تبریز، مراغه (در صورت وجود)، خلخال، سراب

**ریسرچِ اصلاح:**
- فایل جدید `client/src/data/medical-universities.js` + `server/src/data/medical-universities.js` (یا seed واحد) با ۶۸ ردیف.
- `server/src/db.js` — تابع `seedMedicalUniversities()` با `INSERT OR IGNORE` بر اساس `code` (نه `id`) تا `id=1` دست‌نخورده بماند؛ `code` یکتا و قابل `JOIN` است.
- `server/src/routes/admin.js` — `GET /admin/universities` بدون تغییر می‌ماند (فقط داده بیشتر برمی‌گرداند)؛ `POST /admin/universities` برای افزودن دستی حفظ شود.
- تست: `university_id` در `users/classes/cases` پس از seed همچنان `1` برای داده‌های قدیمی — روابط با `code` حفظ می‌شود چون `id` عوض نمی‌شود.

---

## ۳) ورود دسته‌جمعی دانشجویان — فعلی و شکاف

**وضع موجود:**
- **UI:** `Admin.jsx:619 StudentImportModal` — مودال با `textarea` یا `input[type=file]` (`.csv,.txt`)؛ متن را با `api.post("/users/import", {csv})` می‌فرستد؛ نتیجه `created/skipped` + `errors[]` + `wrongUniversity[]` را نشان می‌دهد. `placeholder="40012345\n40067890"` — فقط شماره دانشجویی.
- **سرور:** `server/src/routes/admin.js` — `POST /users/import` — CSV را خط‌به‌خط می‌خواند، `student_no` را نرمال می‌کند، `username = student_no`, `password = student_no` (hash)، `role=student`, `university_id = currentUniversityId(req.user)` (یا از CSV اگر ستون `university_code` باشد — در کد فعلی پشتیبانی نمی‌شود).
- **نواقصِ در چشم (شکاف):**
  1. **بدون راهنمای CSV:** نه `template.csv` برای دانلود، نه توضیح ستون‌ها (`student_no, name_fa, email?`) — کاربر نمی‌داند فرمت.
  2. **بدون انتخاب مقصد:** نمی‌توان مستقیم به **کلاس** یا **دانشگاه دیگر** (برای ادمین کل) اضافه کرد — فقط دانشگاهِ خودِ ادمین/استاد.
  3. **بدون ثبت‌نام خودکار:** دانشجویانِ ایمپورت‌شده با `status=active` ساخته می‌شوند اما **ایمیل/پیام خوش‌آمد** یا `enroll to class` خودکار ندارند؛ باید جداگانه به کلاس اضافه شوند (`bulk` textarea با `studentNos`).
  4. **بدون پیش‌نمایش و اعتبارسنجی:** خطاهای `duplicate`, `wrong_university`, `invalid student_no` فقط پس از POST نشان داده می‌شود، نه پیش‌نمایش.
  5. **تجربه bulk به کلاس:** `Admin.jsx:3470 bulk` — `textarea` با `split(/[\n,;\s]+/)` و `POST /classes/:id/bulk-students` — کار می‌کند اما **بدون CSV و بدون راهنما**.

**ریسرچِ بهترین الگو (Duolingo/CSV import + UWorld):**
- قالب CSV با هدر **الزامی** `student_no` + **اختیاری** `name_fa,name_en,email,university_code,class_code,phone`؛ ستون `password` اختیاری (پیش‌فرض = `student_no`).
- **سه مسیر ورود:**
  a) **مستقیم به دانشگاه** (`/users/import?university_id=X` — ادمین کل می‌تواند انتخاب کند، استاد فقط دانشگاهِ خود).
  b) **مستقیم به کلاس** (`/classes/:id/import-students` — CSV یا لیست شماره‌ها + `autoEnroll=true`).
  c) **ثبت‌نام خودکار:** اگر `autoEnroll` یا ستون `class_code` پر باشد، پس از `INSERT user`، `INSERT class_members` هم انجام شود.
- **راهنمای درون‌مودال:** تب `راهنما` با جدول ستون‌ها + نمونه ۳ سطر + دکمه `دانلود قالب CSV` + `دانلود نمونه پرشده`.
- **پیش‌نمایش dry-run:** `POST /users/import/preview` — CSV را می‌خواند، `created/skipped/errors` را بدون نوشتن برمی‌گرداند؛ سپس `commit`.
- **اعتبارسنجی:** `student_no` با `^[0-9]{7,12}$` (یا `^[A-Za-z0-9._-]{3,20}$` برای username)، `email` اختیاری با regex، `university_code` باید در `universities.code` موجود باشد.

---

## ۴) جمع‌بندی اولویت اصلاح (پس از تأیید)

**P0 — لندینگ (بصری):** گرید هیرو، سایه هدر، تراز کارت‌ها، fallback stats، RTL mock — فقط `Landing.jsx` + `design-refresh.css` (تأثیر سراسری ندارد).

**P0 — دانشگاه‌ها:** seed ۶۸ دانشگاه علوم پزشکی با `code` یکتا؛ `id=1` دست‌نخورده؛ `GET /admin/universities` بدون تغییر API؛ تست روابط با `code`.

**P1 — ورود دسته‌جمعی:** 
- افزودن `GET /users/import/template.csv` + نمونه
- افزودن پارامتر `university_id` و `class_code` به import
- مودال جدید با سه تب: `آپلود CSV` / `افزودن مستقیم به کلاس` / `راهنما` + پیش‌نمایش
- گزینه `ثبت‌نام خودکار در کلاس` + `ایجاد دانشگاه در صورت نبود code` (اختیاری)

> **نکته حفظ ارتباط:** همه‌جا کلید `universities.code` به‌عنوان شناسه پایدار استفاده می‌شود؛ `users.university_id` به `universities.id` می‌ماند، اما CSV با `code` کار می‌کند و سرور آن را به `id` تبدیل می‌کند — بنابراین تغییر نام دانشگاه (`name_fa`) هیچ رابطه‌ای را نمی‌شکند.

---
*این پژوهش بر اساس کد واقعیِ `Landing.jsx`, `db.js:1456`, `Admin.jsx:619`, `medical-universities` web search و الگوی Duolingo/UWorld تهیه شد.*
