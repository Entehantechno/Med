# گزارش دور ۵۹ — باگ‌یابی سرتاسری، رفع خطاهای async، سخت‌سازی Docker و پاک‌سازی کد مرده

تاریخ: 2026-10-25 · شاخه: `arena/3419d01b-med` · پایهٔ دور: `2fa4a1e` (R56 follow-up)
نسخه: `2026.10.25-r59-async-docker-hardening`

> این گزارش مربوط به **نرم‌افزار سایت** است. فایل‌های بانک سؤال (`ROUND58-REMEDIATION.md` و …) شماره‌گذاری جدا دارند.

---

## ۱) خلاصهٔ مدیریتی

| بخش | نتیجه |
|---|---|
| باگ‌های برطرف‌شده | **۸ مورد** (یکی با ریسک بالا: درخواست‌های معلق در Express 4) |
| قطعات یتیم وصل/حذف‌شده | ۱ اسکریپت وصل‌شد (`seed:emergency`)، ۳ فایل مرده حذف‌شد |
| سخت‌سازی امنیت | Dockerfile غیر-root + healthcheck، compose با `no-new-privileges`/`cap_drop`/limits، Caddy بدون هدر تکراری |
| تست‌های اضافه‌شده | `async-errors.test.js` (۳ تست) |
| سرور | **۱۳۸۵ پاس / ۴۵ شکست** — همه ۴۵ شکست در `master-bank` (مشکل داده‌ای قدیمی، بخش ۵) |
| کلاینت | **۸۵/۸۵ پاس**؛ `build` موفق؛ `perf:budget` پاس |
| `audit:gate` | پاس (صفر آسیب‌پذیری در وابستگی‌های production) |

---

## ۲) باگ‌های برطرف‌شده

| # | شدت | مشکل | رفع |
|---|---|---|---|
| B1 | **بالا** | Express 4 به‌طور پیش‌فرض rejection هندلرهای `async` را به middleware خطا نمی‌فرستد. ۵۴ هندلر بدون `try` وجود داشت (از جمله `payments.js` و `store.js`). در صورت خطا، **پاسخ هرگز ارسال نمی‌شد** و کاربر تا timeout منتظر می‌ماند. | افزودن `express-async-errors@3.1.1` در `app.js` (اولین import). در آزمایش مستقل: قبل از رفع، پاسخ بعد از 3 ثانیه هنوز نیامده بود (HANG)؛ بعد از رفع، `500 JSON` در کمتر از 2 ثانیه. |
| B2 | متوسط | پروکسی توسعهٔ Vite به `localhost:3001` اشاره می‌کرد، در حالی که سرور پیش‌فرض روی `PORT=4000` است. نتیجه: `npm run dev:client` همهٔ درخواست‌های `/api` را خراب می‌کرد. | هدف پروکسی از `VITE_API_TARGET` خوانده می‌شود، پیش‌فرض `http://localhost:4000`. پروکسی سمت سرور است (مرورگر فقط origin خودش را می‌بیند). |
| B3 | پایین | `esbuild.drop: console` در حالت توسعه هم اعمال می‌شد و لاگ‌های dev را پنهان می‌کرد. | فقط در `command === "build"` اعمال می‌شود. |
| B4 | متوسط (امنیت/عملکرد) | `errorHandler` برای **هر** خطا از جمله 400 (JSON نامعتبر) stack کامل لاگ می‌کرد. مهاجم می‌توانست لاگ را سیل کند و هر درخواست بد را کندتر کند. | فقط 5xx stack دارد. کد وضعیت به بازهٔ 400–599 محدود شد. تست: `logs stack traces only for 5xx`. تأیید روی سرور زنده: سه درخواست JSON خراب → 400 و بدون `[error]` در لاگ. |
| B5 | پایین (کد مرده + ریسک) | در `db.js` یک شاخهٔ fallback با `eval()` فایل `client/src/data/medical-universities.js` را می‌خواند. این شاخه هرگز اجرا نمی‌شد (JSON همیشه موجود است) ولی `eval` در کد بود. | شاخهٔ `eval` حذف شد. |
| B6 | پایین (کد یتیم) | دو کپی از `medical-universities.js` (سرور و کلاینت) هیچ import‌کننده‌ای نداشتند. منبع واقعی `medical-universities.json` است (هر دو کپی با JSON هم‌کد بودند). | هر دو کپی حذف شدند. |
| B7 | پایین (قطعهٔ وصل‌نشده) | `seed-emergency-ten.js` در README به‌عنوان اسکریپت نصب معرفی شده بود ولی در `package.json` نبود. | `npm run seed:emergency` اضافه شد. |
| B8 | متوسط (امنیت) | Caddy هدر `Permissions-Policy` کوتاه‌تری تنظیم می‌کرد که **هدر کامل اپ را بازنویسی** می‌کرد؛ و هدر `Server` افشا بود. | هدر تکراری از Caddy حذف شد (سیاست کامل از اپ می‌آید)؛ `-Server` اضافه شد. |

### سخت‌سازی Docker و Compose (بدون تغییر رفتار عملکردی)

| فایل | تغییر |
|---|---|
| `Dockerfile` | `npm install` → `npm ci` در هر دو مرحله (نصب بر اساس lockfile، تکرارپذیر و سریع‌تر)؛ `npm cache clean`؛ `chown` به کاربر `node`؛ `USER node` (قبلاً root بود)؛ `HEALTHCHECK` روی `/api/health` با `start-period=120s`. |
| `docker-compose.deploy.yml` (medlab) | `no-new-privileges:true`، `cap_drop: ALL`، `tmpfs: /tmp`، `init: true`، `mem_limit: 1g`، `pids_limit: 256`، چرخش لاگ (`10m × 5`). |
| `docker-compose.deploy.yml` (caddy, backup) | `no-new-privileges:true`. (`cap_drop` برای Caddy و backup عمداً اعمال نشد چون بدون امکان تست، خطر شکستن bind روی 80/443 یا نوشتن در volume وجود دارد.) |

**یادداشت تأیید:** در این محیط `docker` نصب نیست و image ساخته/اجرا نشد. YAML هر دو فایل با `js-yaml` پارس شد؛ `npm ci --dry-run` برای سرور و کلاینت پاس شد؛ دستور healthcheck به‌صورت محلی تست شد (سرور زنده → exit 0، بدون سرور → exit 1). **ساخت image باید روی سرور مقصد یک‌بار تأیید شود.**

---

## ۳) بررسی‌های انجام‌شده که باگ جدید نداشتند (ثبت برای ممیزی)

- **اسکن ایستای SQL:** همهٔ interpolation‌های `prepare()` (حدود ۶۱ مورد) یا نام ستون/جدول ثابت یا whitelist یا لیست placeholder هستند. تزریق SQL پیدا نشد.
- **Fuzz مسیرهای GET:** ۲۷۷ مسیر × (ادمین، یادگیرنده) = ۵۵۴ درخواست → **۰ پاسخ 500**، ۰ timeout.
- **Fuzz مسیرهای POST:** ۲۰۰ مسیر × (ادمین، یادگیرنده) × ۳ بدنهٔ (`{}`، فیلدهای نامعتبر، JSON خراب) = ۱۲۰۰ درخواست → **۰ پاسخ 500**. تنها 503 مربوط به `/api/auth/google` بود که «پیکربندی نشده» است (رفتار مورد انتظار).
- **کنترل دسترسی (Authorization):**
  - یادگیرنده روی ۸۱ مسیر `/api/admin/*`: ۷۶ × 403، ۵ × 410 (tombstone عمدی).
  - یادگیرنده روی POST ادمین: فقط `/api/auth/logout` موفق (2xx) بود (درست است).
  - IDOR: یادگیرنده روی `assignments/:userId`، `reports/progress/:userId`، `reports/student/:userId`، `live-board/.../details`، `members/.../attempts` با ۱۳ شناسه دیگر → همه 403.
  - `/api/questionnaires/prompts`: یادگیرنده `forms: []` می‌گیرد و ادمین 403 — عمدی (فرم‌ها فقط برای student) و غیرامنیتی؛ ثبت شد.
- **مسیرهای بدون احراز هویت (فهرست ۱۴ مسیر 2xx):** همه عمومی‌اند (تنظیمات سایت، بلاگ، کاتالوگ دوره، اعتبارسنجی گواهی، صفحات callback پرداخت). `/api/pay/mock/:authority` با `mockAllowed()` در production → 404 (درست).
- **هدرهای امنیتی (سرور زنده):** CSP بدون `unsafe-eval`، `script-src-attr 'none'`، `frame-ancestors 'none'`، HSTS با preload، `X-Frame-Options: DENY`، `nosniff`، COOP/CORP (سازگار با Google Sign-In)، `Referrer-Policy`، `Permissions-Policy` کامل، `x-powered-by` غیرفعال.
- **کوکی احراز هویت:** `httpOnly`، `sameSite: lax`، `secure` در production، `maxAge` 12 ساعت.
- **JWT:** در production اگر secret ضعیف/خالی باشد، `load-env.js` یک secret تصادفی (۴۸ بایت) می‌سازد؛ `auth.js` هم fail-closed است.
- **CORS:** بدون `*`؛ فقط allow-list صریح از `CORS_ORIGIN`.
- **حد اندازهٔ بدنه:** JSON 2mb، csp-report 20kb.
- **کش و فشرده‌سازی:** HTML `no-cache`، `/assets/*` یک‌ساله immutable، `sw.js` no-cache، `compression` فعال، Caddy با `encode zstd gzip`.
- **سرعت (اندازه‌گیری محلی):** `/` ≈ 9 ms، `/api/health` ≈ 2 ms، `/api/site-content/landing` ≈ 3–20 ms، `/api/store/courses` ≈ 4 ms.
- **بودجهٔ bundle:** entry JS 24.80 KB، entry CSS 59.69 KB، total CSS 65.49 KB، learn 24.15 KB، fonts 126.3 KB raw — همه در بودجه.
- **Dead-code scan:** از نقاط ورود سرور و کلاینت، فایل‌های غیرقابل‌دسترس فقط موارد بخش ۲ بودند؛ بقیه یا تست هستند یا از طریق CLI/Dockerfile/npm script مصرف می‌شوند.

---

## ۴) تغییرات آمده در این دور

- `server/src/app.js`: import `express-async-errors` (اولین import پس از dotenv).
- `server/src/lib/security.js`: `errorHandler` با stack فقط برای 5xx و بازهٔ وضعیت معتبر.
- `server/src/db.js`: حذف شاخهٔ fallback با `eval`.
- `server/src/data/medical-universities.js` و `client/src/data/medical-universities.js`: حذف شدند.
- `server/package.json`: `express-async-errors@^3.1.1` و اسکریپت `seed:emergency`؛ `package-lock.json` به‌روز شد.
- `server/test/async-errors.test.js`: ۳ تست جدید (رد async → 500 سریع؛ forward شدن خطای typed؛ عدم لاگ stack برای 4xx).
- `client/vite.config.js`: پورت پروکسی 4000 + `VITE_API_TARGET`؛ `drop console` فقط در build.
- `Dockerfile`، `docker-compose.deploy.yml`، `deploy/Caddyfile`: بخش ۲.
- `VERSION.txt`: `2026.10.25-r59-async-docker-hardening`.

---

## ۵) مشکلات باز که نیاز به تصمیم دارند (عمداً تغییر داده نشدند)

### ۵.۱ — ۴۵ شکست `master-bank` (پیش‌تر وجود داشت؛ این دور کاهش/تغییر نکرد)
این تست‌ها «زنجیرهٔ هش» بانک سؤال را بررسی می‌کنند. بررسی انجام‌شده:

1. **هش فایل مطابق fixture نیست، اما فایل از زمان ورود به repo تغییر نکرده:** `import-payload.master-preint.part01.json` در `b4ec28f` (merge PR #2) با هش `8183ec…` وارد شد و در `2fa4a1e` همان است. fixtures (`round47..51-preservation.json`) هش `202b39…` را ثبت کرده‌اند. یعنی fixtureها از نسخهٔ قبلی‌ای ساخته شده‌اند که دیگر در repo نیست.
2. **۳۱ رکورد با `keyless: true` و `correct_index: 0`:** تست انتظار `null` دارد. **ریسک امتیازدهی وجود ندارد:** در `routes/admin.js` تابع `officialQuestionIsKeyless()` برای این رکوردها `correct = -1` می‌گذارد، پس هیچ گزینه‌ای `correct` نمی‌گیرد و کارت وارد سطح‌های نمره‌دار نمی‌شود. با این حال داده از نظر بهداشت ناسازگار است.

**تصمیم لازم:** (الف) فیکسچرها را با هش فعلی بازتولید کنیم و `correct_index` این ۳۱ رکورد را `null` کنیم (تغییر editorial، نیازمند تأیید)؛ یا (ب) تست را با قاعدهٔ واقعی (`keyless` ⇒ هیچ گزینه‌ای `correct` نیست) بازنویسی کنیم. تا تصمیم کاربر، این ۴۵ شکست دست‌نخورده ماندند.

### ۵.۲ — رمز پیش‌فرض ادمین
هشدار سرور هنگام بالا آمدن: حساب `admin` هنوز رمز عمومی demo دارد. **این را باید خودتان در Admin → Users تغییر دهید** قبل از عمومی شدن سایت.

### ۵.۳ — توکن احراز هویت در `localStorage`
کوکی `httpOnly` وجود دارد، اما کلاینت توکن را در `localStorage` هم نگه می‌دارد؛ هر XSS می‌تواند آن را بخواند. حذف کامل آن یک تغییر بزرگ احراز هویت است (cookie-only) و در این دور انجام نشد.

### ۵.۴ — `style-src 'unsafe-inline'` در CSP
برای استایل‌های inline ری‌اکت لازم است. سخت‌تر کردن آن نیازمند nonce یا hash است.

### ۵.۵ — حجم repository
هشت ZIP انتشار (R48–R55) در Git ردیابی می‌شوند (حدود ۲۴۰ MB) و `.git` حدود ۲۶۳ MB است. این ZIPها خروجی‌های تحویل‌اند، پس حذفشان بدون تصمیم شما انجام نشد. پیشنهاد: انتقال به GitHub Releases یا storage بیرونی.

### ۵.۶ — `masterbank-md.js`
این فایل پارسر «بانک اصلی» (کتاب‌های Markdown) است و در runtime استفاده نمی‌شود. در repo فایل `tools/master-bank/build.mjs` وجود ندارد، بنابراین فعلاً مصرف‌کنندهٔ مستقیمی دیده نمی‌شود. مطابق R56 نگه داشته شد.

### ۵.۷ — ریشهٔ فایل‌سیستم کانتینر و secret
- `read_only: true` برای medlab اعمال نشد چون بدون اجرای واقعی کانتینر قابل تأیید نیست.
- در Docker، `load-env.js` secret تولیدی را در `/app/.env` (لایهٔ کانتینر) می‌نویسد؛ با **بازسازی** کانتینر (نه restart) secret عوض می‌شود و نشست‌ها باطل می‌شوند. **راه حل:** `JWT_SECRET` را در فایل `.env` کنار compose تنظیم کنید؛ آن‌وقت نشست‌ها بین بازسازی‌ها هم باقی می‌مانند.

---

## ۶) تست‌ها و دستورات اجراشده

| دستور | نتیجه |
|---|---|
| `server: npx vitest run` | ۱۳۸۵ پاس، ۴۵ شکست (همه `master-bank`، بخش ۵.۱)، ۴۵ skip |
| `server: npx vitest run test/async-errors.test.js` | ۳/۳ پاس |
| `server: npx vitest run test/security-hardening.test.js test/api.test.js -t SEO\|Blog\|JSON-LD` (بعد از `client build`) | ۲۹ پاس (۹ تست SEO/JSON-LD که قبلاً به‌خاطر نبود `dist` شکست می‌خوردند) |
| `client: npx vitest run` | ۸۵/۸۵ پاس |
| `client: npm run build` | موفق |
| `client: npm run perf:budget` | پاس |
| `npm run audit:gate` (root) | پاس |
| اسکن GET/POST/IDOR/anonymous روی سرور زنده | بخش ۳ |

---

## ۷) وضعیت شاخه و فایل‌ها

- شاخهٔ کاری: `arena/3419d01b-med` (پایه `2fa4a1e`).
- این گزارش در `.work/APP-ROUND59-REPORT.md` قرار دارد (با `git add -f`).
- ZIP انتشار R59 در ریشهٔ repo ساخته می‌شود و **commit نمی‌شود** (طبق روش R56).
- یادداشت: فایل ZIP R56 (`MED-School-FINAL-2026-10-24-R56.zip`) در این محیط دیگر موجود نیست؛ از commit `2fa4a1e` قابل بازتولید است.
