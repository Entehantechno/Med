# گزارش دور ۵۶ — باگ‌یابی، وصل‌کردن قطعات یتیم، حذف کد مرده، سرعت و امنیت

تاریخ: 2026-10-24 · شاخه: `arena/3419d01b-med` · پایهٔ دور: `0d11e6a` (R55)

> این گزارش مربوط به **نرم‌افزار سایت** است و با فایل‌های بانک سؤال (`ROUND55-SUMMARY.md`, `ROUND56-AUDIT.md`, …) که شماره‌گذاری دیگری دارند اشتباه نشود.

---

## ۱) خلاصهٔ مدیریتی

| بخش | وضعیت |
|---|---|
| قطعات وصل‌نشده (orphan) | **۲ مورد وصل شد**: مدیریت بانک نقشه‌های ذهنی (ادمین) و کارت حالت ناشناس در رتبه‌بندی |
| کد مرده و وابستگی زائد | **۴ فایل + ۱ وابستگی** حذف شد |
| باگ‌های پیداشده و رفع‌شده | **۳ مورد** (ایموجی اشتباه جم، `window.open` بدون `noopener`، هدر/سیاست تکراری CSP و Permissions-Policy) |
| امنیت | محدودکنندهٔ API به‌صورت per-account برای کاربران واردشده؛ `report-uri` روی CSP اجباری؛ `npm audit` سرور در وابستگی‌های تولیدی **۰ آسیب‌پذیری** |
| سرعت | بررسی شد؛ ۱ مورد جدید: write-behind برای DB (R56, با trade-off) — بودجهٔ کارایی CSS **هنوز قرمز** است (از قبل بوده) |
| تست‌ها | سرور: **۱۳۸۱ سبز** / ۴۷ قرمز (همه در `master-bank`، از قبل در `HEAD` قرمز بودند) · کلاینت: **۸۵/۸۵ سبز** · `npm run build` ✅ · `release:check` ✅ |

---

## ۲) تغییرات

### ۲.۱ وصل‌کردن قطعات یتیم (wire-up)
| قطعه | مشکل | کار انجام‌شده |
|---|---|---|
| `pages/admin/MindmapBankAdmin.jsx` (32 KB) | ویرایشگر کامل بانک نقشه‌های ذهنی؛ بک‌اند کامل (`/admin/mindmap-bank` CRUD, import/export, bulk, history, link) اما **هیچ ورودی منو** | افزودن آیتم `mindmapBank` به گروه «محتوا» در پنل ادمین (`Admin.jsx`)، lazy import و رندر، کلید ترجمه fa/en در `i18n.js`. دسترسی: `learn.content` (همان دسترسی سایر ابزارهای محتوا) |
| `components/AnonRankingCard.jsx` | حالت ناشناس در رتبه‌بندی (`GET/PUT /learn/anon`، منطق در `gamify.js`) اما **کارت UI هیچ‌جا mount نشده** | اتصال به `pages/learn/RankingView.jsx` (بالای جدول رتبه). کارت خودش با flag `anon_ranking` گیت شده است، پس تا وقتی flag خاموش است چیزی نمایش داده نمی‌شود |

### ۲.۲ کد مرده و وابستگی زائد (حذف شد)
| مورد | دلیل حذف |
|---|---|
| `client/src/data/medical-catalog.js` | کپی قدیمیِ فال‌بک کاتالوگ سفارش آزمایش؛ سرور همیشه از `order-catalog-defaults.js` پیش‌فرض برمی‌گرداند و هیچ import نداشت |
| `client/src/lib/icons.js` | «منبع واحد» ایموجی‌ها که هیچ‌جا import نمی‌شد؛ منبع فعلی `components/StatIcons.jsx` است |
| `rollup-plugin-visualizer` (devDependency) | در `vite.config.js` استفاده نشده بود؛ با `npm uninstall` حذف شد (lock به‌روز شد) |

**نگه‌داشته‌شده (با دلیل):**
- `data/medical-universities.js`: سرور (`db.js` ~۱۵۹۴) آن را fallback می‌خواند.
- `server/src/lib/masterbank-md.js`: پارسر منبع اصلی بانک (مربوط به سوییت `master-bank`).
- `server/src/seed_if_empty.js`: در `Dockerfile` استفاده می‌شود.
- `server/src/seed-emergency-ten.js`: ابزار دستی عملیاتی؛ حذف نشد (تصمیم شما).
- `pages/learn/VirtualPatient.jsx`: **حذف نشد** — ← بخش ۴ را ببینید.

### ۲.۳ باگ‌های رفع‌شده
1. **ایموجی اشتباه جم** — `components/LessonInsights.jsx`: پاداش جم با `💎` نمایش داده می‌شد، در حالی که سیاست پروژه (`StatIcons.jsx`) می‌گوید `💎` فقط نماد رتبهٔ «الماس» است. اکنون از `<GemIcon />` استفاده می‌کند. در `Admin.jsx` (بنر تبلیغ پاداشی) هم `💎` به `💉` تغییر کرد.
2. **`window.open` بدون `noopener`** — `pages/learn/Certificates.jsx`: اشتراک‌گذاری LinkedIn/Telegram/WhatsApp اکنون با `"noopener,noreferrer"` باز می‌شود (جلوگیری از tabnabbing). دو `window.open("", "_blank")` در `Admin.jsx` عمداً باقی ماندند: پنجرهٔ خالی برای چاپ HTML است و به URL غیرقابل‌اعتماد هدایت نمی‌شود.
3. **هدر تکراری Permissions-Policy** — `app.js` یک سیاست ناقص تنظیم می‌کرد که بعد از Helmet توسط `permissionsPolicy()` بازنویسی می‌شد (dead header). خط تکراری حذف شد؛ `lib/security.js` منبع واحد است.
4. **CSP: گزارش‌دهی ناقص و تکراری** — سیاست اجباری Helmet هیچ `report-uri` نداشت، یعنی نقض‌های واقعی گزارش نمی‌شدند؛ و یک هدر `Content-Security-Policy-Report-Only` جدا (با `media-src`/`worker-src` متفاوت) نویز گزارش برای منابع قانونی https می‌ساخت. اکنون `reportUri: ["/api/security/csp-report"]` روی سیاست اجباری است و هدر Report-Only حذف شد. (تأیید با تست هدر: `report-uri` در `Content-Security-Policy` ✅، Report-Only ✅ حذف شد.)

### ۲.۴ امنیت
- **محدودکنندهٔ API (تصمیم باز R55) — اعمال شد.** قبلاً سقف ۳۰۰ درخواست در ۱۵ دقیقه per-IP بود؛ کل یک NAT دانشگاهی پشت یک IP شمرده می‌شد. اکنون:
  - **کاربر واردشده**: سقف جدا per-account (`api_user_max`، پیش‌فرض **۱۲۰۰ / ۱۵ دقیقه**) با کلیدِ شناسهٔ کاربر. شناسه از توکنی گرفته می‌شود که **امضای HS256 با `JWT_SECRET` را verify کرده** باشد (`verifiedUserIdFromRequest` در `lib/auth.js`)؛ توکن جعلی یا منقضی → fallback به bucket کی‌پی IP. پس مهاجم نمی‌تواند bucket دیگری را پر کند یا محدودیت را دور بزند.
  - **ناشناس**: همان سقف per-IP (۳۰۰)، بدون تغییر.
  - تنظیم از طریق gameconfig (`security.api_user_max`). **نکته:** تغییر عدد نیاز به ری‌استارت دارد (همان رفتار قبلی limiter).
- **CSP** — `report-uri` روی سیاست اجباری (بالا).
- **Permissions-Policy** — یک منبع (بالا).
- **`npm audit` سرور (production):** قبل: ۶ آسیب‌پذیری (`proxy-addr` critical، `nodemailer` moderate، `sharp` high) → بعد از `npm audit fix` (غیر-force): **۰**. باقی‌مانده فقط devDependency (`vitest`/`tinypool`) است و نیاز به `--force` (major breaking) دارد؛ اعمال نشد.
- **بررسی‌شده و سالم:** Helmet با `scriptSrcAttr: 'none'`، JWT HS256 با issuer/audience و کوتاه‌عمر (۱۲h)، کوکی `httpOnly` + `sameSite=lax`، TRACE/TRACK/CONNECT مسدود، Host check، کش API حساس `no-store`، `/assets/` با هش + `immutable`.

### ۲.۵ سرعت
- **Write-behind برای DB (R56، از قبل در همین شاخه):** نوشتن‌های معمولی بیش از ۲۴۱ نقطه‌ی فراخوانی `persistNow()` داشت که هر بار کل DB را export می‌کرد. اکنون با `FLUSH_DELAY_MS` (env: `DB_FLUSH_DELAY_MS`، پیش‌فرض ۱٫۵ ثانیه، حداکثر ۶۰ ثانیه) یک‌جا flush می‌شود. نوشتن‌های durable (`durableTransaction`، `throwOnError`، `force`) همچنان همگام‌اند. هنگام `exit`/`SIGINT`/`SIGTERM` یک flush همگام انجام می‌شود.
  - **trade-off (باید بدانید):** در یک crash سخت (SIGKILL، قطع برق) ممکن است تا ۱٫۵ ثانیه نوشته‌ی معمولی از دست برود. بنچ‌مارک: DB دِو ۱٫۹ MB، میانگین export+write قبلی ۷٫۶ ms روی هر نوشتن؛ DB تولید ~۱۲۵ MB.
  - تست رگرسیون: `server/test/write-behind.test.js` (۴/۴ سبز).
- **CSS:** PurgeCSS فقط ~۴٪ (۳۰۹ → ۲۹۶ KB خام) حذف می‌کند؛ کاهش واقعی نیازمند تقسیم CSS به ازای route یا حذف قواعد override‌شده است (کار بزرگ‌تر، بخش ۴).
- **Compression/cache:** `compression` با threshold ۱۰۲۴ بایت؛ فایل‌های precompressed `.br/.gz` سرو می‌شوند؛ کش‌ها درست تنظیم شده‌اند (بالا).

### ۲.۶ نسخه
- `VERSION.txt` → `2026.10.24-r56-wiring-security-cleanup` (stamp سرویس‌ورکر را عوض می‌کند تا کش قدیمی باطل شود).

---

## ۳) نتایج تست و ساخت

| بررسی | نتیجه |
|---|---|
| سرور `vitest run` (کامل) | **۵۹ فایل سبز / ۱ فایل قرمز** · تست‌ها: **۱۳۸۱ سبز**، ۴۵ skip، **۴۷ قرمز** |
| ۴۷ قرمز | همه در `test/master-bank.test.js` (round47/48/57/58 «editorial boundaries»). **این شکست‌ها از قبل در `HEAD` (`0d11e6a`) هم بودند** (بررسی با استخراج `git archive` در پوشهٔ موقت). علت: این تست‌ها وضعیت اصلاح کلید‌های بانک را می‌خواهند که طبق `ROUND58-REMEDIATION.md` «هیچ‌چیز اعمال نشده» و منتظر تأیید شماست. **تست‌ها دست‌کاری نشدند.** |
| تست‌های جدید/مرتبط | `rate-limit-account.test.js` ۴/۴ ✅ · `write-behind.test.js` ۴/۴ ✅ · `security-hardening` ۲۷/۲۷ ✅ · `vp-pilot` ۳۶/۳۶ ✅ |
| کلاینت `vitest run` | **۱۸ فایل / ۸۵ تست سبز** |
| کلاینت `npm run build` | ✅ (stamp: `medschool-2026.10.24-r56-…`، ۱۷۲ sidecar فشرده) |
| کلاینت `npm run perf:budget` | ❌ **قرمز — از قبل بود** (مقادیر در `HEAD` هم همین بود؛ CSS تغییری نکرده). جزئیات بخش ۴. |
| `npm run release:check` (ZIP) | ✅ `MED-School-FINAL-2026-10-24-R56.zip` (27.5 MB، 833 فایل)، 54 payload بانک، 79 feature marker |

---

## ۴) مسائل باز — نیازمند تصمیم شما

1. **بیمار مجازی (Virtual Patient) برای یادگیرنده — تناقض محصولی.**
   - `pages/learn/VirtualPatient.jsx` (هاب یادگیرنده) به `GET /learn/vpatient` وصل است، اما **هیچ تب/ورودی ناوبری ندارد**.
   - سرور عمداً مسیرهای یادگیرنده را با **410 `university_only`** می‌بندد و `vpatientLive()` در `lib/vpatient.js` همیشه `false` است.
   - لندینگ (`modVirtualPatient`/`modCases`) قابلیت بیمار مجازی را برای یادگیرنده **تبلیغ** می‌کند.
   - **گزینه‌ها:** (الف) فعال‌سازی: `vpatientLive` و مسیرهای 410 را برداریم، تب `virtualPatient` را به `LearnApp` و کارت به خانهٔ یادگیرنده اضافه کنیم؛ (ب) فقط برای دانشگاه نگه داریم و متن لندینگ را اصلاح کنیم.
   - تا تصمیم شما، فایل **حذف نشده** است.
2. **بودجهٔ کارایی CSS (perf:budget) — قرمز از قبل.** مقادیر فعلی: entry JS **24.80** KB gz (بودجه ۲۴)، entry CSS **59.69** (بودجه ۴۷)، total CSS **65.49** (بودجه ۶۵)، learn **24.16** (بودجه ۲۴). منبع: `main.jsx` شش فایل CSS را در entry بارگذاری می‌کند.
   - **گزینه‌ها:** (الف) تقسیم CSS به ازای route (کار بزرگ؛ ترتیب cascade باید حفظ شود)؛ (ب) به‌روزرسانی بودجه‌ها با دلیل مستند. **بودجه‌ها بی‌صدا تغییر نکردند.**
3. **۴۷ تست `master-bank` در انتظار تأیید ویرایشی:** اعمال بستهٔ `ROUND58-REMEDIATION.md` (۵۸ اصلاح کلید تأییدشده + ۶ منسوخ) با تأیید شما، تست‌ها سبز می‌شوند. **بدون تأیید شما اعمال نمی‌شود** (تغییر کلید پاسخ پزشکی است).
4. **توکن احراز هویت در `localStorage`:** پاسخ سرور کوکی `httpOnly` هم می‌گذارد، اما کلاینت توکن را در `localStorage` نگه می‌دارد (در صورت XSS قابل خواندن است). تغییر به کوکی-only یک تغییر بزرگ در auth است؛ در این دور اعمال **نشد**.
5. **رمز پیش‌فرض عمومی ادمین:** سرور هشدار می‌دهد که حساب admin هنوز رمز demo عمومی دارد. باید تغییر کند.
6. **ZIP در Git ثبت نشد:** `MED-School-FINAL-2026-10-24-R56.zip` در ریشهٔ مخزن ساخته شد ولی commit نشد (حجم ~۲۸ MB؛ راهنمای مخزن artifacts بزرگ را خارج از Git می‌خواهد). نسخه‌های R48–R55 قبلاً در Git هستند؛ حذف‌شان انجام نشد.

---

## ۵) ریسک‌ها و یادداشت‌ها
- write-behind: پنجرهٔ ۱٫۵ ثانیه‌ای برای نوشتن‌های معمولی (بخش ۲.۵). برای تغییر: `DB_FLUSH_DELAY_MS`.
- محدودکنندهٔ per-account: کاربر واردشده سقف بالاتری دارد؛ اگر یک اسکریپت با توکن معتبر یک حساب را بکوبد، سقف ۱۲۰۰/۱۵ دقیقه اعمال می‌شود.
- CSP enforced حالا `report-uri` دارد؛ حجم گزارش‌ها ممکن است بیشتر شود (endpoint با `limit: 20kb` و خلاصه‌سازی محافظت شده است).
- `db-restore.test.js` به‌تنهایی شکست می‌خورد (وابسته به seed تست `api`)؛ از قبل بود.
