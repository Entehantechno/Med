# گزارش R71 — پایگاه داده و انتشار (SQLite با better-sqlite3)

> تاریخ: ۱۰ آبان ۱۴۰۵ (۲۰۲۶-۱۱-۰۱) · نسخه: `2026.11.01-r71-sqlite`
> پژوهش کامل: `docs/research/DATABASE-RESEARCH-FA.md`
> محدوده: موتور پایگاه داده، بکاپ، فهرست دانش‌آموزان ARAK، Node، اسکریپت‌های انتشار.
> **سرور زنده و دیتابیس زنده دست‌نخورده ماندند. رمز ادمین تغییر نکرد.** همهٔ آزمون‌ها روی کپی انجام شد.

---

## ۱. خلاصه

- **پژوهش:** گزینه‌های `sql.js`، `better-sqlite3`، `node:sqlite`، libSQL، PostgreSQL/MySQL بررسی شد. **better-sqlite3 با WAL** انتخاب و اجرا شد. جزئیات و منابع در پژوهش آمده است.
- **نتیجهٔ اندازه‌گیری (کپی ۱۱۴ مگابایتی):** هر ذخیره در `sql.js` حدود **۲۵۵ ms** و در حین آن حلقهٔ رویداد بسته بود. در `better-sqlite3` هر نوشتن میانهٔ **۰.۲۵ ms** است (p95 ۰.۷۰ ms).
- **ایمنی داده:** `synchronous=FULL` و WAL. بکاپ‌ها با `VACUUM INTO` و تأیید `quick_check` ساخته می‌شوند. دیگر کپی مستقیم فایل زنده وجود ندارد.
- **مهاجرت:** دیتابیس R70 بدون تبدیل دستی باز شد (۱۲۰ کاربر، ۱۲۷ جدول، ۸۸ دانش‌آموز ARAK، `quick_check` = ok). قبل از اولین شروع، نسخهٔ تأییدشدهٔ `pre-upgrade-r71-*.db` ساخته می‌شود.
- **فهرست دانش‌آموزان ARAK:** از داخل کد حذف شد و در zip به‌صورت `ARAK-STUDENTS-IMPORT.csv` (۸۸ ردیف) آمده است. ابزار `npm run import-students` این فایل را به‌صورت افزایشی وارد می‌کند.
- **Node:** حداقل **۲۲.۱۴** (یا ۲۳.۶+ یا ۲۴.x). این یک تغییر در محیط استقرار است (بخش ۵).
- **تست‌ها:** کل سرور `1977 پاس`، `45 شکست`، `45 رد شده`. همهٔ ۴۵ شکست همان ۴۵ شکست پایهٔ `master-bank` از R70 است.

---

## ۲. تغییرات اصلی

### ۲.۱ موتور پایگاه داده (`server/src/db.js`)
- `sql.js` حذف شد و `better-sqlite3 ^13.0.3` جایگزین آن شد.
- پیکربندی اتصال: WAL، `synchronous=FULL` (قابل تغییر با `DB_SYNCHRONOUS`)، `busy_timeout` ۵۰۰۰ ms، `cache_size` ۱۶ MB (`DB_CACHE_KIB`)، `trusted_schema=OFF`، `secure_delete=FAST`، `journal_size_limit` ۶۴ MB.
- `persist`، `persistNow` و `markDirty` دیگر کاری نمی‌کنند (تراکنش‌ها هنگام commit دائمی‌اند). این توابع برای سازگاری با فراخوانی‌های قدیمی باقی مانده‌اند.
- `durableTransaction` با تراکنش واقعی کار می‌کند؛ اگر یک مرحله خطا دهد، همهٔ مراحل برگردانده می‌شوند.
- بازیابی فایل خراب: فایل اصلی و `-wal`/`-shm` به `.corrupt-*` منتقل می‌شوند و هیچ‌چیز حذف نمی‌شود. اگر نسخهٔ سالمی نباشد، `database_corrupt_no_valid_backup` و توقف.
- `user_version` = ۷۱ به‌عنوان نشانهٔ نسل موتور.
- کش statement با سقف ۱۰۰۰.
- یک کد مرده (`isProcessAlive`) حذف شد.
- یادداشت‌های قدیمی `sql.js` در کد اصلاح شد (`index.js`، `seed.js`، `srs.js`، `pathcurator.js`، `bankbootstrap.js`، `admin.js`، `learn.js`، `landing.js`، `fsrs-optimizer.js`، `vp-completion.js`).

### ۲.۲ بکاپ
- `POST /api/admin/backup/create` و `GET /api/admin/backup/download` از `createSnapshot` (`VACUUM INTO`) استفاده می‌کنند. فایل دانلودی در `backups/tmp-download` ساخته و پس از انتقال حذف می‌شود.
- بکاپ خودکار: هنگام شروع و سپس بررسی هر ۶ ساعت. با سیاست ۲۴ ساعت، ۳ نسخه نگه داشته می‌شود. بکاپ دستی ۵ نسخه نگه می‌دارد. این دو مجموعه جدا هرس می‌شوند.
- `deploy/backup.sh` بازنویسی شد: نسخه‌های تازهٔ `DATA_DIR/backups` را به `/backups` کپی می‌کند (با `BACKUP_KEEP`، پیش‌فرض ۱۴). فایل زنده را هرگز کپی نمی‌کند.
- **اصلاح خطر:** قبلاً کپی مستقیم فایل WAL‌دار می‌توانست صفحه‌های commit‌شده را جا بیندازد.

### ۲.۳ فهرست دانش‌آموزان ARAK
- `server/src/data/arak-students.json` حذف شد (`git rm`، در stage).
- `data/students/ARAK-STUDENTS-IMPORT.csv` (۸۸ ردیف، BOM و CRLF، ستون‌های `student_no,name_fa,name_en,field`) ساخته شد. `data/students/` مطابق دستور R64 در Git می‌ماند.
- `server/src/lib/student-roster.js`: تجزیهٔ CSV، عدد فارسی/عربی به انگلیسی، حذف ZWNJ، شمارهٔ دانشجویی ۸ تا ۱۶ رقم، حذف تکراری‌ها در فایل، `name_en` پیش‌فرض `name_fa`، سقف ۲ MB.
- `server/src/lib/arak-students-provision.js`: در شروع فقط از `DATA_DIR/rosters/ARAK-STUDENTS-IMPORT.csv` (یا `ARAK_ROSTER_FILE`) می‌خواند و درج افزایشی انجام می‌دهد. نبودن فایل یعنی هیچ‌کاری نکردن.
- `server/src/import-students.js` (CLI): پیش‌فرض dry-run است. با `--apply` ابتدا `pre-import` می‌گیرد و فقط شماره‌های جدید را اضافه می‌کند.
- `scripts/pack-host-zip.mjs`: فایل CSV را در ریشهٔ zip می‌گذارد. `scripts/check-release-zip.mjs` وجود آن (حداقل ۸۰ ردیف) و نبود JSON را بررسی می‌کند.

### ۲.۴ Node و وابستگی‌ها
- `sql.js` از `package.json` و `server/package.json` حذف شد. `better-sqlite3` ۱۳.۰.۳ (بدون اسکریپت نصب، باینری پیش‌ساخته) در lock است.
- `engines.node` = `>=22.14.0` در هر دو `package.json`.
- `server/src/lib/node-version.js`: نخستین ماژول `index.js` است و روی نسخهٔ قدیمی‌تر با پیام روشن متوقف می‌شود.
- `START-MED-School.bat`: نسخهٔ Node را بررسی و نسخهٔ خیلی قدیمی را رد می‌کند؛ نسخهٔ فعلی را هم نشان می‌دهد.
- `Dockerfile`: `node:22-slim` (آخرین ۲۲.x، یعنی ≥ ۲۲.۱۴).
- `scripts/check-release-zip.mjs`: حالا `engines.node` باید شامل ۲۲.۱۴ باشد.

### ۲.۵ دامنه‌های کاربر (`domain-storage.js`)
- فایل‌های `learning.db` و `university.db` دیگر کپی کامل دیتابیس نیستند؛ یک placeholder خالی ساخته می‌شود. **کپی‌های قدیمی روی دیسک زنده را اپراتور باید بررسی و حذف کند.**

### ۲.۶ مستندات
- `docs/research/DATABASE-RESEARCH-FA.md` (جدید).
- `docs/راهنمای-آپگرید-امن-و-حفظ-دیتابیس.md`: بخش «تغییرات R71» اضافه شد.
- `docs/راهنمای-اجرا.md`، `docs/راهنمای-cPanel.md`، `docs/شروع-سریع-cPanel.md`: Node 22.14+ به جای Node 18/20.
- `docs/متن-تیکت-به-هاست.md`: Node 22.14 و better-sqlite3.
- `docs/security/SECURITY-PLAN-FA.md`: موتور ذکرشده به‌روز شد.
- `VERSION.txt` = `2026.11.01-r71-sqlite`؛ سرویس‌ورکر کلاینت با همین نسخه ساخته شد (`medschool-2026.11.01-r71-sqlite`).

---

## ۳. نتایج آزمون‌ها

| آزمون | نتیجه |
|---|---|
| `r71-database-engine` + `db-restore` | **۱۹ از ۱۹** پاس |
| `student-roster` | **۱۰ از ۱۰** پاس |
| `api` + `security-hardening` + `vp-pilot` | **۵۷۸ پاس، ۲۷ رد شده** (قبلاً با ساخت کلاینت) |
| **کل سرور (`npx vitest run`)** | **۱۹۷۷ پاس، ۴۵ شکست، ۴۵ رد شده** (از ۲۰۶۷) |
| شکست‌ها | همه ۴۵ مورد `master-bank.test.js` (پایهٔ R70، روی نسخهٔ R70 هم تکرار شد) |
| کلاینت `npm run build` | موفق؛ سرویس‌ورکر با نسخهٔ R71 |

تست‌های اصلاح‌شده در این راند:
- `vp-pilot`: قبلاً `fs.renameSync` را mock می‌کرد که R71 دیگر استفاده نمی‌کند. حالا با `query_only` یک خطای نوشتن واقعی ایجاد می‌شود.
- `db-restore` و `r71`: وابستگی به ترتیب اجرا و به پوشهٔ `backups` رفع شد.
- `write-behind.test.js` (تست منسوخ R56) حذف شد.

### آزمون‌های انجام‌شده روی کپی (بدون دست زدن به زنده)

- **مهاجرت:** `user_version` از ۰ به ۷۱؛ WAL؛ `synchronous=2`؛ `quick_check` = ok؛ ۱۲۰ کاربر.
- **بوت کامل (کپی R70):** ۴۹.۵ ثانیه در R71 در برابر ۶۸.۱ ثانیه در R70 (هر دو شامل بار اول ۸۰۸۴ سؤال). R71 **سریع‌تر** است؛ کاهشی در کارایی وجود ندارد.
- **ورود:** دانشجوی نمونه (۴۰۰۱۲۳۴۵) و ادمین (ورود ۲۰۰)، با `Origin` و `X-Forwarded-Proto: https`.
- **بکاپ دستی:** `POST /backup/create` پاسخ ۲۰۰؛ `GET /backup/download` ۱۱۴ MB، هدر `SQLite format 3`، `quick_check` = ok، ۱۲۰ کاربر؛ پوشهٔ موقت حذف شد.
- **خاموشی تمیز (SIGTERM):** WAL ادغام شد، `-wal`/`-shm` باقی نماند.
- **import دانش‌آموزان:** dry-run روی ۸۸ ردیف: ۰ جدید، ۸۸ موجود. `--apply` روی فایل آزمایشی: ۱ جدید، ۱ موجود، ۱ شمارهٔ نامعتبر گزارش شد، و `pre-import` ساخته شد.
- **فایل خراب و WAL یتیم:** در تست‌های `db-restore` پوشش داده شد.
- **فایل اصلی R70:** SHA-256 قبل و بعد برابر است (`8c155a39…`).

---

## ۴. نکات مهم برای اپراتور (قبل از استقرار روی زنده)

1. **Node را به ۲۲.۱۴+ یا ۲۴ تغییر دهید.** در cPanel از «Setup Node.js App» و در Docker نیازی به کار نیست. روی Node 20 سرور متوقف می‌شود و پیام روشن می‌دهد.
2. **اولین شروع نسخهٔ جدید** `backups/pre-upgrade-r71-*.db` می‌سازد. آن را نگه دارید.
3. **DATA_DIR باید روی دیسک محلی باشد.** WAL روی NFS/SMB کار نمی‌کند.
4. **فهرست دانش‌آموزان:** `ARAK-STUDENTS-IMPORT.csv` را در `DATA_DIR/rosters/` بگذارید و `npm run import-students -- <CSV> --university ARAK` را اول بدون `--apply` و سپس با `--apply` اجرا کنید. دانش‌آموزان موجود دست نمی‌خورند. دانش‌آموز حذف‌شده دیگر خودکار برنمی‌گردد.
5. **کپی‌های قدیمی `learning.db` و `university.db`** روی دیسک زنده را بعد از بررسی حذف کنید.
6. **فضای دیسک:** هر بکاپ تقریباً اندازهٔ کل دیتابیس است (حدود ۱۲۵ MB). `BACKUP_KEEP` را متناسب با سهمیهٔ هاست تنظیم کنید.
7. **`SETTINGS_ENCRYPTION_KEY` و `ZARINPAL_MERCHANT_ID` و `SMTP_HOST` هنوز تنظیم نشده‌اند.** این‌ها هشدار سرور هستند و به R71 مربوط نیستند.

---

## ۵. تصمیم‌های نیازمند تأیید کاربر

- **Node 22.14 و تغییر `engines`:** این تغییر لازم است، چون better-sqlite3 ۱۳ به آن نیاز دارد. اگر رد شود، باید `server/package.json`، `package-lock.json`، `package.json` ریشه و lock آن، `Dockerfile`، `engines`، `START-MED-School.bat`، `check-release-zip.mjs` و `pack-host-zip.mjs` به `sql.js` برگردند. یادآوری: `sql.js` همان مشکل ۲۵۵ ms و پنجرهٔ ۱۵۰۰ ms را دارد.
- **رمز پیش‌فرض دانش‌آموزان ARAK = شماره دانشجویی** (`POST /users` و اسکریپت‌های provisioning هم همین کار را می‌کنند). این یک خطر امنیتی است و در R70 دیده نشده بود. گزینه‌ها: رمز تصادفی اولیه، یا اجبار به تغییر رمز در اولین ورود، یا جریان یک‌بار مصرف. **تا تصمیم شما، حساب‌های موجود تغییر نکرده‌اند.**
- **بوت اول ۵۰ ثانیه‌ای** روی دیتابیس بدون بانک سؤال (از کد R70 است). بهینه‌سازی نشد؛ علت‌ها در پژوهش آمده است.

---

## ۶. مشکلات باقی‌مانده (از R70 و کارهای بعدی)

- پشتیبانی نقش ادمین (support) — هنوز محدود نشده است.
- توکن JWT در `localStorage` کلاینت هنوز نگه داشته می‌شود (فقط کوکی‌محور نشده است).
- اعتبارسنجی ورودی روی مسیرهای نوشتن (`admin.js` حدود ۱۹۹ مسیر، `learn.js` ۷۰ مسیر) کامل نیست.
- بررسی مرورگری صفحهٔ بازنشانی رمز.
- اسکن کامل فایل‌های نشت‌شده (leak-scan) و تاریخچهٔ Git هنوز در این راند انجام نشده است. zip یک `.env` تولیدشده از `.env.ready` دارد؛ در `.env.ready` مقدار `JWT_SECRET` و `AI_API_KEY` خالی است و سرور در اولین شروع کلید تصادفی می‌سازد.
- تست `master-bank`: ۴۵ شکست پایه (R70) هنوز باز است.

---

## ۷. فایل‌های اصلی این راند

- `server/src/db.js`، `server/src/lib/node-version.js`، `server/src/index.js`
- `server/src/lib/student-roster.js`، `server/src/lib/arak-students-provision.js`، `server/src/lib/demo-students.js`
- `server/src/import-students.js`، `server/package.json`، `package.json`، `package-lock.json`
- `server/src/lib/domain-storage.js`، `server/src/routes/admin.js`، `server/src/lib/first-run.js`
- `deploy/backup.sh`، `Dockerfile`، `START-MED-School.bat`
- `scripts/check-release-zip.mjs`، `scripts/pack-host-zip.mjs`
- `data/students/ARAK-STUDENTS-IMPORT.csv`، `data/students/ARAK-STUDENTS-2026-10-04.csv`
- `server/test/r71-database-engine.test.js`، `server/test/db-restore.test.js`، `server/test/student-roster.test.js`، `server/test/vp-pilot.test.js`
- `VERSION.txt`، `docs/research/DATABASE-RESEARCH-FA.md`، `docs/rounds/APP-ROUND71-REPORT.md`
