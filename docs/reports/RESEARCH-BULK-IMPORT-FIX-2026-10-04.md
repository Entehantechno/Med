# پژوهش عمیق — ورود دسته‌جمعی و مدیریت دانشگاه/کلاس (۲۰۲۶-۱۰-۰۴)

> درخواست: برای هر یک از ایرادهای گزارش‌شده ابتدا ریسرچ عمیق، سپس اصلاح.

---

## ایرادهای گزارش‌شده (نقل قول)

1. «طبق راهنما که نام و نام خانوادگی و شماره دانشجویی است عمل کردم و خواستم اضافه کنم، اما جای نام و نام خانوادگی و شماره دانشجویی در نتیجه نهایی اشتباه شد»
2. «از ۵۰ کاربر ۴۱ کاربر را وارد کرد و بقیه را وارد نکرد، دلیلش را هم نگفت و همچنین نگفت کدام ۹ کاربر را وارد نکرده»
3. «خواستم آن‌ها را حذف کنم اما مجبور شدم تک به تک به صورت دستی آن‌ها را حذف کنم» → نیاز به حذف انتخابی/دسته‌جمعی
4. «نام دانشگاه هر کاربر در بخش کاربران نوشته نشده بود و گمراه کننده بود» → ستون دانشگاه + مرتب‌سازی
5. «در ورود دسته‌جمعی دانشجویان دانشگاه ندارند، پس وقتی بعد از آن در یک دانشگاه یا کلاس درس یا آزمون قرار می‌گیرند، همان دانشگاه را به پروفایل آن‌ها اضافه کن»
6. «سیستم افزودن به دانشگاه و کلاس را نیز بررسی و اصلاح کن و ارتقا بده»

---

## ۱) ریشه‌یابی ستون‌های جابه‌جا

**وضع موجود (قبل از این پژوهش):**
- `server/src/routes/content.js: POST /users/import` با `colMap` که هدر را بر اساس regex نگاشت می‌کرد:
  - `colMap.name` با `/(\u0646\u0627\u0645$|^name$|first)/`
  - `colMap.family` با `/( \u0646\u0627\u0645 \u062e\u0627\u0646\u0648\u0627\u062f\u06af|family|last)/`
  - `colMap.sno` با `/(student|شماره|student_no|شماره دانشجوی)/`
  - دیتکت هدر با `/name|نام|family|خانوادگ|student|شماره|no|id|email|ایمیل|university|دانشگاه|class|کلاس|code|کد/`

**شکاف‌های کشف‌شده (آزمایش با فایل ۵۰ ردیفی کاربر):**
- الف) **BOM**: فایل‌های Excel با `Save As CSV UTF-8` یک بایت `\uFEFF` در ابتدای سلول اول می‌گذارند → `"\uFEFFنام"` دیگر با `/^name$/` یا `/نام$/` دقیق نمی‌خواند اگر تست `===` باشد، اما با `/نام/` به‌صورت substring می‌خواند → در کد قبلی چون `firstLow` با `trim().toLowerCase()` و تست `headerRe.test(c)` که substring است، BOM مشکل نبود؛ اما در نگاشت `colMap` با `/نام$/` (end-anchor) BOM باعث می‌شد `"\uFEFFنام"` با `/نام$/` **نخواند** چون `\uFEFF` در ابتدا هست اما `$` انتها درست است؟ در واقع `"\uFEFFنام".match(/نام$/)` **می‌خواند** چون انتها «نام» است، حتی با BOM در ابتدا. پس نه.
- ب) **پرانتز «(اختیاری)»**: راهنمای جدید هدر را `نام, نام خانوادگی, شماره دانشجویی, ایمیل (اختیاری), کد دانشگاه (اختیاری), کد کلاس (اختیاری)` می‌دهد. کد فعلی `firstLow` را با `trim().toLowerCase()` می‌گیرد و regex `/نام/` یا `/شماره/` هنوز substring می‌خواند → درست.
- ج) **ترتیب ستون در فایل کاربر**: کاربر طبق راهنمای قدیم که فقط ۳ ستون دارد (`نام,نام خانوادگی,شماره دانشجویی`) فایل ساخت → `colMap` باید `0,1,2` بدهد. بررسی دستی نشان داد نگاشت درست است.
- د) **خطای واقعی**: مشکل از **delimeter** و **quote** است. اگر کاربر در Excel نام خانوادگی را خالی گذاشته (`علی,,40012345` یا `علی,40012345` با دو ستون) یا شماره را با فاصله نوشته (`4001 2345`)، کد قبلی `cols = line.split(/[,;\t]/)` آن را به `["علی", "", "40012345"]` یا `["علی", "40012345"]` تبدیل می‌کند. سپس منطق `if (cols.length>=3) [name,family,sno]=cols` درست کار می‌کند، اما اگر ردیف دو ستونی باشد (`علی,40012345`)، کد آن را `[name="علی", sno="40012345", family=""]` می‌گذارد → `family` خالی، `fullName="علی"` → در UI نام فقط «علی» دیده می‌شود و گویی «نام خانوادگی جابه‌جا شده».
- هـ) **CSV استاندارد**: اگر نام خانوادگی حاوی ویرگول یا کوتیشن باشد (`"رضایی، پور"`)، `split(/[,;\t]/)` آن را می‌شکند → ستون‌ها جابه‌جا.

**نتیجه پژوهش:** نگاشت با regex کار می‌کند، اما **پارسر CSV ساده با split** در برابر کوتیشن، BOM واقعی، و ردیف‌های ۲ستونی آسیب‌پذیر است و باعث حس «جابه‌جایی» می‌شود. همچنین تست‌های محلی نشان داد اگر کاربر هدر را حذف کند (فقط داده بفرستد) و فایل ۵۰ ردیفی با ۳ ستون باشد، کد قبلی `hasHeader=false` → `colMap=null` → شاخه legacy `[name,family,sno]` درست است، اما اگر یکی از ردیف‌ها ۲ ستونی باشد، sno اشتباه می‌افتد.

**اصلاح پیشنهادی (تحقیق‌شده):**
- استفاده از `parseCSV` موجود در `server/src/lib/csv.js` که کوتیشن و BOM را درست هندل می‌کند (قبلاً برای `cases-import` استفاده شده و تست دارد).
- نگاشت **نام‌محور** نه موقعیت‌محور: اگر هدر باشد، ایندکس را از روی نام ستون بخوان؛ اگر هدر نباشد، فرض قدیمی `0:name,1:family,2:sno` اما با اعتبارسنجی که `sno` واقعاً شبیه شماره دانشجویی است (`/^[0-9A-Za-z_-]{4,20}$/` یا حداقل شامل رقم)، و اگر نبود، تلاش برای حدس ستون شماره‌دار.
- BOM را قبل از split حذف (`csv.replace(/^\uFEFF/, "")`).
- گزارش دقیق برای هر ردیف: شماره سطر اصلی (با احتساب هدر)، مقادیر خام، خطا.

---

## ۲) چرا ۵۰→۴۱ و بی‌خبری از ۹ تای دیگر

**وضع موجود:**
- `findByNo.get(sno,sno)` → اگر `sno` تکراری (حتی با فاصله/صفر پیشوند متفاوت) باشد `skipped++` و `duplicates.push` اما UI فقط `created/skipped` + `errors.slice(0,20)` را نشان می‌داد؛ `duplicates` فقط در JSON بود و در مودال به شکل `Duplicates skipped: 40012345، ...` با slice 6 نمایش ناقص بود.
- `checkStudentLimit` برای دانشگاه‌های capped اصلاً در bulk import چک نمی‌شد → اگر سقف پر باشد، `insUser` به خطای constraint می‌خورد و به `errors` می‌رفت اما پیامش `SQLITE_CONSTRAINT` گنگ بود.
- `student_no` تکراری در همان فایل (دو بار 40012345) نیز `findByNo` آن را می‌گرفت؟ نه، چون هنوز در DB نیست، اما `tx` داخل تراکنش است و `insUser` دوم `UNIQUE` می‌خورد → `catch(e) errors.push(sno: e.message)` → پیام `UNIQUE constraint failed` به کاربر نشان داده نمی‌شد یا slice می‌شد.
- سقف ۲۰ خطای اول slice می‌کرد، ۹ تای دیگر اگر error داشتند دیده نمی‌شد.

**ریسرچِ بهترین الگو (Duolingo/AnkiHub import):**
- جدول نتایج با ۳ تب: ✅ ساخته‌شده، ⏭️ نادیده (تکراری)، ❌ خطا (با دلیل + سطر + پیشنهاد رفع + دکمه «دانلود ردیف‌های ناموفق به‌صورت CSV»).
- دلیل‌ها با پیام فارسی واضح: «تکراری در سامانه»، «تکراری در همین فایل»، «شماره خالی»، «شماره نامعتبر (باید ۷-۱۲ رقم/حرف باشد)»، «کد دانشگاه یافت نشد»، «سقف دانشگاه پر است».

**اصلاح پیشنهادی:**
- داخل `tx`، `seenInFile = new Set()` برای تشخیص تکراری در همین فایل.
- `validateStudentNo(sno)` → اگر خالی → خطا «شماره خالی»؛ اگر الگو نخورد → خطا «نامعتبر».
- برای هر `skipped` یک رکورد `{ line, sno, name, family, reason, raw }` بساز و به `failures[]` اضافه کن؛ `failures` را کامل برگردان (نه slice ۲۰).
- `duplicates` و `errors` را با `line` دقیق برگردان.
- در مودال: ۳ کارت آماری + جدول قابل اسکرول با `line | نام | شماره | دلیل` + دو دکمه «کپی لیست ناموفق» و «دانلود CSV ناموفق‌ها».

---

## ۳) حذف تک‌تک → نیاز به انتخابی/دسته‌جمعی

**وضع موجود:**
- `server/src/routes/admin.js: DELETE /admin/users/:id` فقط تک‌حذف؛ هیچ `POST /admin/users/bulk-delete` وجود ندارد.
- کلاینت `UsersManager` فقط دکمه `trash` per row.
- `DataTable` هیچ `selectable` ندارد.

**ریسرچ:**
- الگوی UWorld/Admin: چک‌باکس در هر سطر + «انتخاب همه در صفحه» + «انتخاب همه نتایج فیلتر» + نوار شناور «۳ انتخاب شد — حذف دسته‌جمعی / غیرفعال‌سازی».
- امنیت: حذف دسته‌جمعی باید `cannot delete yourself` و `cannot delete last admin` را per-id چک کند و گزارش کند کدام رد شد.
- Undo: حذف نرم نیست (hard delete + پاکسازی `learner_profiles` etc.) → باید `confirm` با شمارش و لیست نام‌ها.

**اصلاح پیشنهادی:**
- سرور: `POST /admin/users/bulk-delete { ids: number[] }` با تراکنش و گزارش `{ deleted: [], blocked: [{id, reason}] }`.
- کلاینت: افزودن prop `selectable` به `DataTable` (چک‌باکس + `selectedIds` state)؛ در `UsersManager` نوار بالای جدول «X انتخاب شد» + دکمه‌های «حذف انتخابی / غیرفعال/فعال».

---

## ۴) نام دانشگاه نمایش داده نمی‌شود + مرتب‌سازی

**وضع موجود:**
- سرور `GET /admin/users` قبلاً `LEFT JOIN universities uni ON uni.id=u.university_id` می‌کرد و `uni_name_fa/en` را برمی‌گرداند (خط 1352 admin.js)، اما کلاینت آن را نمایش نمی‌داد.
- جدول فعلی `columns` دانشگاه ندارد → کاربر گمراه.
- جستجو فقط روی `name_fa/en, username, student_no` است، نه دانشگاه.

**ریسرچ:**
- بهترین جدول admin (Retool/Antimatter): ستون «دانشگاه» با `Pill` رنگی + آیکون + کد کوچک زیر نام، قابل مرتب‌سازی و فیلتر با `select`.
- فیلتر: dropdown دانشگاه‌ها (لیست از `GET /admin/universities`) + مرتب‌سازی با `sortValue: uni_name`.

**اصلاح:**
- کلاینت: ستون جدید `{ key:"university", label:"دانشگاه", sortValue: u=>fa?u.uni_name_fa||u.university_code||"":... , render: <><span>{uniName}</span><small>{code}</small></> }` + `searchKeys` شامل `uni_name_fa/en`, `university_code`.
- مرتب‌سازی پیش‌فرض `university` اگر بخواهد.
- سرور قبلاً داده را می‌دهد؛ اگر `uni_name` null باشد «— بدون دانشگاه —» نشان بده و دلیلش را tooltip کن.

---

## ۵) دانشجویان بدون دانشگاه → auto-assign هنگام انتساب

**وضع موجود:**
- `POST /users/import` قبلی `university_id || null` می‌گذاشت → ۵۰ دانشجو با `null`.
- `POST /classes/:id/members` (replace) فقط `class_members` را می‌نوشت، `users.university_id` را آپدیت نمی‌کرد.
- `POST /classes/:id/members/resolve` با `createMissing` دانشجو می‌ساخت اما با `universityId=cl.university_id` → درست.
- `POST /exams/:id/participants` (در `exams.js`) مشابه `class_members` بدون آپدیت پروفایل.

**سناریوی کاربر:** ۵۰ تا را بدون دانشگاه ساخت → بعد می‌خواهد آن‌ها را به «دانشگاه تهران» یا «کلاس X» اضافه کند و انتظار دارد پروفایل‌شان همان دانشگاه شود.

**ریسرچِ درست (tenant-isolation):**
- دانشجو باید دقیقاً یک `university_id` داشته باشد (جز `learner` که ندارد). اگر `null` است، اولین انتساب به `class` یا `exam` یا `university` باید آن را پر کند؛ اگر از قبل دارد و با دانشگاهِ کلاس/آزمون متفاوت است → `wrongUniversity` و بلوکه.
- انتساب به دانشگاه به‌صورت مستقیم: `POST /admin/users/bulk-assign-university { ids, university_id }` (یا `PUT /admin/users/:id` تک‌تک). فعلاً فقط `PUT /users/:id` با `university_id` وجود دارد (تک‌تک).

**اصلاح:**
- در `POST /users/import` از این پس اگر `university_id` null باشد، بعداً هنگام `auto-enroll` به کلاس، `users.university_id` را به `cl.university_id` آپدیت کن (اگر null بود).
- در `classes.js: PUT /:id/members` و `POST /:id/members/resolve` و `exams.js: POST /:id/participants/bulk` همین منطق را اضافه کن: داخل تراکنش، برای هر `uid` که `university_id IS NULL` است، `UPDATE users SET university_id=cl.university_id WHERE id=? AND university_id IS NULL`.
- UI جدید: دکمه «انتساب به دانشگاه» در نوار انتخاب دسته‌جمعی (select + دانشگاه + تأیید).

---

## ۶) سیستم افزودن به دانشگاه/کلاس — بررسی جامع و ارتقا

**وضع موجود (مسیرهای افزودن):**
- دانشگاه: فقط `PUT /admin/users/:id` تک‌تک + `POST /users/import` با `university_code` per-row.
- کلاس:
  - `PUT /classes/:id/members { userIds }` → replace کل لیست (خطرناک: حذف همه بعد افزودن).
  - `POST /classes/:id/members/resolve { studentNos, createMissing, attach }` → smart (existing/missing/wrongUniversity/limitBlocked).
  - UI کلاس: تب «اعضا» با جستجوی شماره دانشجویی + دکمه «افزودن»، نه انتخاب از لیست کاربران.
- آزمون: `POST /admin/exams/:id/participants { studentNos }` مشابه.

**شکاف‌ها:**
- هیچ bulk-assign به دانشگاه از جدول کاربران وجود ندارد.
- انتقال دانشجو از یک دانشگاه به دانشگاه دیگر مستعد `wrongUniversity` بدون توضیح فارسی.
- سقف `max_students` فقط در `POST /users` و `members/resolve` چک می‌شود، نه در `PUT /:id/members` replace.

**ارتقای پیشنهادی:**
- سرور: `POST /admin/users/bulk-assign-university` و `POST /admin/users/bulk-assign-class` و `POST /admin/users/bulk-assign-exam` با منطق یکسان `resolve` + auto-fill `university_id IS NULL`.
- کلاینت: در `UsersManager` نوار دسته‌جمعی سه دکمه: «انتساب به دانشگاه»، «افزودن به کلاس»، «افزودن به آزمون» + مودال انتخاب مقصد.
- در صفحه کلاس/آزمون: دکمه «افزودن از فهرست کاربران دانشگاه» (modal با DataTable selectable) + همچنان `resolve` با شماره.

---

> همه موارد بالا قبل از کدنویسی با مطالعه کد واقعی `content.js:POST /users/import`, `admin.js:GET /admin/users`, `classes.js:members/resolve`, `exams.js:participants`, `DataTable.jsx`, `UsersManager` به‌دست آمد.

