# گزارش دور ۵۶ — باگ‌یابی، وصل‌کردن قطعات یتیم، حذف کد مرده، سرعت و امنیت

تاریخ: 2026-10-24 · شاخه: `arena/3419d01b-med` · پایهٔ دور: `0d11e6a` (R55)

> این گزارش مربوط به **نرم‌افزار سایت** است. با فایل‌های بانک سؤال (`ROUND55-SUMMARY.md`، `ROUND56-AUDIT.md`، …) که شماره‌گذاری دیگری دارند اشتباه نشود.

---

## ۱) خلاصهٔ مدیریتی

| بخش | وضعیت |
|---|---|
| قطعات وصل‌نشده (orphan) | **۲ مورد وصل شد**: مدیریت بانک نقشه‌های ذهنی (پنل ادمین) و کارت حالت ناشناس در رتبه‌بندی |
| کد مرده و وابستگی زائد | **۴ فایل + ۱ وابستگی + ۱ فراخوانی مرده** حذف شد؛ هاب بیمار مجازی یادگیرنده (یتیم) حذف شد (تصمیم شما: فقط دانشگاهی) |
| باگ‌های رفع‌شده | ایموجی اشتباه جم، `window.open` بدون `noopener`، هدر تکراری Permissions-Policy، CSP بدون `report-uri` و Report-Only تکراری |
| امنیت | محدودکنندهٔ API per-account برای کاربران واردشده؛ `report-uri` روی CSP اجباری؛ `npm audit` سرور در وابستگی‌های تولیدی **۰** |
| سرعت | بودجهٔ کارایی به‌روز شد (تصمیم شما، با دلیل مستند) و اکنون **سبز** است؛ write-behind برای DB (R56) |
| کلید پاسخ بانک | **۶۴ اصلاح `correct_index` اعمال شد** (۵۸ تأییدشده + ۶ منسوخ، طبق `ROUND58-REMEDIATION.md` و تأیید شما) |
| تست‌ها | سرور: **۱۳۸۳ سبز** / ۴۵ قرمز (همه `master-bank`، از قبل در `HEAD` قرمز بودند) · کلاینت: **۸۵/۸۵ سبز** · `npm run build` ✅ · `perf:budget` ✅ · `release:check` ✅ |

---

## ۲) تغییرات

### ۲.۱ وصل‌کردن قطعات یتیم (wire-up)
| قطعه | مشکل | کار انجام‌شده |
|---|---|---|
| `pages/admin/MindmapBankAdmin.jsx` (32 KB) | ویرایشگر کامل بانک نقشه‌های ذهنی؛ بک‌اند کامل (`/admin/mindmap-bank` CRUD، import/export، bulk، history، link) ولی **بدون ورودی منو** | آیتم `mindmapBank` در گروه «محتوا» پنل ادمین، lazy import و رندر، کلید ترجمهٔ fa/en. دسترسی: `learn.content` |
| `components/AnonRankingCard.jsx` | حالت ناشناس در رتبه‌بندی (`GET/PUT /learn/anon`، منطق در `gamify.js`) ولی **کارت هیچ‌جا mount نشده بود** | اتصال به `pages/learn/RankingView.jsx`. کارت با flag `anon_ranking` گیت است؛ تا وقتی flag خاموش است چیزی نمایش داده نمی‌شود |

### ۲.۲ بیمار مجازی یادگیرنده — تصمیم شما: «فقط دانشگاهی بماند»
- `pages/learn/VirtualPatient.jsx` (هاب یادگیرنده) **حذف شد**. در شاخهٔ فعلی هیچ route یا تبی به آن وصل نبود (در `LearnApp.jsx` تب `vpatient` از قبل نبود)، پس فایل یتیم بود.
- فراخوانی مرده‌ی `POST /learn/vpatient/daily-reward` در `pages/Exam.jsx` حذف شد (سرور همیشه `410` می‌داد و خطایش بی‌صدا گرفته می‌شد).
- **نگه‌داشته شد:** پاسخ‌های `410 university_only` در سرور برای `/learn/vpatient*` (عمدی و تست‌شده در `vp-pilot.test.js`). `vpatientLive()` در `lib/vpatient.js` بدون تغییر ماند.
- **لندینگ تغییر نکرد:** بررسی دقیق نشان داد لندینگ بیمار مجازی را تبلیغ نمی‌کند؛ `modCases` فقط در `StudentHome` (دانشجوی دانشگاهی) استفاده می‌شود، که با این تصمیم سازگار است.
- ادمین بیمار مجازی (`vpatientAdmin`) و مسیر دانشگاهی دست‌نخورده‌اند.

### ۲.۳ کد مرده و وابستگی زائد (حذف شد)
| مورد | دلیل حذف |
|---|---|
| `client/src/data/medical-catalog.js` | کپی قدیمی فال‌بک کاتالوگ سفارش آزمایش؛ سرور همیشه از `order-catalog-defaults.js` پیش‌فرض برمی‌گرداند و هیچ import نداشت |
| `client/src/lib/icons.js` | «منبع واحد» ایموجی که هیچ‌جا import نمی‌شد؛ منبع فعلی `components/StatIcons.jsx` است |
| `rollup-plugin-visualizer` (devDependency) | در `vite.config.js` استفاده نشده بود؛ با `npm uninstall` حذف شد |

**نگه‌داشته‌شده (با دلیل):** `data/medical-universities.js` (fallback در `db.js`)؛ `server/src/lib/masterbank-md.js` (پارسر بانک اصلی)؛ `server/src/seed_if_empty.js` (در `Dockerfile`)؛ `server/src/seed-emergency-ten.js` (ابزار دستی عملیاتی؛ تصمیم با شماست)؛ `test/setup.js` (تنظیم vitest).

### ۲.۴ باگ‌های رفع‌شده
1. **ایموجی اشتباه جم** — `components/LessonInsights.jsx`: پاداش جم با `💎` نمایش داده می‌شد، در حالی که سیاست پروژه (`StatIcons.jsx`) می‌گوید `💎` فقط نماد رتبهٔ «الماس» است. اکنون `<GemIcon />` استفاده می‌شود. در `Admin.jsx` (بنر تبلیغ پاداشی) هم `💎` به `💉` تغییر کرد.
2. **`window.open` بدون `noopener`** — `pages/learn/Certificates.jsx`: اشتراک‌گذاری LinkedIn/Telegram/WhatsApp با `"noopener,noreferrer"` باز می‌شود. دو `window.open("", "_blank")` در `Admin.jsx` عمداً باقی ماندند (پنجرهٔ خالی برای چاپ HTML، بدون هدایت به URL غیرقابل‌اعتماد).
3. **هدر تکراری Permissions-Policy** — `app.js` یک سیاست ناقص تنظیم می‌کرد که بعد از Helmet توسط `permissionsPolicy()` بازنویسی می‌شد. خط تکراری حذف شد؛ منبع واحد `lib/security.js` است.
4. **CSP: گزارش‌دهی ناقص و تکراری** — سیاست اجباری Helmet `report-uri` نداشت (نقض‌های واقعی گزارش نمی‌شدند) و یک هدر `Content-Security-Policy-Report-Only` جدا با `media-src`/`worker-src` متفاوت، نویز گزارش برای منابع قانونی https می‌ساخت. اکنون `reportUri: ["/api/security/csp-report"]` روی سیاست اجباری است و هدر Report-Only حذف شد. (تأیید: خروجی Helmet شامل `report-uri` است؛ هدر Report-Only دیگر ست نمی‌شود.)

### ۲.۵ امنیت
- **محدودکنندهٔ API (تصمیم باز R55) — اعمال شد.** قبلاً سقف ۳۰۰ درخواست در ۱۵ دقیقه per-IP بود و کل NAT دانشگاهی با یک IP شمرده می‌شد. اکنون:
  - **کاربر واردشده:** سقف جدا per-account (`security.api_user_max`، پیش‌فرض **۱۲۰۰ / ۱۵ دقیقه**) با کلیدِ شناسهٔ کاربر. شناسه فقط از توکنی گرفته می‌شود که **امضای HS256 را با `JWT_SECRET` verify کرده** باشد (`verifiedUserIdFromRequest` در `lib/auth.js`). توکن جعلی یا منقضی → fallback به bucket کی‌پی IP؛ پس مهاجم نمی‌تواند bucket دیگری را پر کند یا محدودیت را دور بزند.
  - **ناشناس:** همان سقف per-IP (۳۰۰)، بدون تغییر.
  - تغییر عدد نیازمند ری‌استارت است (رفتار قبلی limiter).
- **CSP** و **Permissions-Policy**: بالا.
- **`npm audit` سرور (production):** قبل: ۶ آسیب‌پذیری (`proxy-addr` critical، `nodemailer` moderate، `sharp` high) → بعد از `npm audit fix` (غیر-force): **۰**. باقی‌مانده فقط devDependency (`vitest`/`tinypool`) است و نیازمند `--force` (major breaking) است؛ اعمال نشد.
- **بررسی‌شده و سالم:** Helmet با `scriptSrcAttr: 'none'`، JWT HS256 با issuer/audience و عمر ۱۲ ساعت، کوکی `httpOnly` + `sameSite=lax`، TRACE/TRACK/CONNECT مسدود، Host check، کش API حساس `no-store`، `/assets/` با هش و `immutable`.

### ۲.۶ سرعت
- **بودجهٔ کارایی (`client/scripts/perf-budget.mjs`) — به‌روزرسانی با دلیل مستند (تصمیم شما):**

| شاخص (gzip KB) | قبل | بعد | اندازهٔ واقعی R56 |
|---|---|---|---|
| entry JS | 24 | **25** | 24.80 |
| entry CSS | 47 | **60** | 59.69 |
| total CSS | 65 | **66** | 65.49 |
| learnApp | 24 | **25** | 24.15 |
| fonts (raw) | 150 | 150 (بدون تغییر) | 126.3 |

  دلیل: CSS در R52–R55 رشد کرد (design refresh، motion/ads، keyboard-safe، mobile learn، scroll unlock) و هر شش فایل در entry از `main.jsx` بارگذاری می‌شوند. بودجه‌ها در کد هم مستند شده‌اند. **بدهی فنی باز:** تقسیم CSS به ازای route (با حفظ ترتیب cascade) و حذف قواعد override‌شده در `styles.css` / `design-refresh.css` / `styles-speed-fixes.css`. PurgeCSS فقط ~۴٪ حذف می‌کند، پس این مسیر اصلی کاهش است.
- **Write-behind برای DB (R56):** نوشتن‌های معمولی (~۲۴۱ نقطهٔ `persistNow()`) قبلاً کل DB را هر بار export می‌کردند. اکنون با `DB_FLUSH_DELAY_MS` (پیش‌فرض ۱٫۵ ثانیه، حداکثر ۶۰ ثانیه) یک‌جا flush می‌شوند. نوشتن‌های durable (`durableTransaction`، `throwOnError`، `force`) همگام می‌مانند؛ در `exit`/`SIGINT`/`SIGTERM` یک flush همگام انجام می‌شود.
  - **trade-off:** در crash سخت (SIGKILL، قطع برق) ممکن است تا ۱٫۵ ثانیه نوشتن معمولی از دست برود. بنچ‌مارک: DB دِو ۱٫۹ MB، میانگین export+write قبلی ۷٫۶ ms؛ DB تولید ~۱۲۵ MB.
- **Compression/cache:** `compression` با threshold ۱۰۲۴ بایت؛ فایل‌های precompressed `.br/.gz` سرو می‌شوند؛ کش‌ها درست تنظیم شده‌اند.

### ۲.۷ کلید پاسخ بانک — اعمال بستهٔ R58 (با تأیید شما)
- ابزار: `tools/apply_round58_keys.py` با `--apply --include-outdated` (ابتدا dry-run تأیید شد).
- **۶۴ جابه‌جایی `correct_index`** (۵۸ اصلاح تأییدشده + ۶ ردیف منسوخ) روی فایل‌های payload بخش‌های ۲۳، ۲۴، ۲۵، ۲۷، ۲۸، ۲۹ اعمال شد.
- حسابرسی: `docs/round58-key-application.json` (هش پیش/پس هر فایل و from/to هر ردیف).
- متن پرسش، گزینه‌ها و فیلدهای دیگر دست‌نخورده‌اند؛ فقط کلید تغییر کرده است.
- نتیجه: دو تست `round58 remediation pack` از قرمز به سبز تغییر کردند.

### ۲.۸ نسخه
- `VERSION.txt` → `2026.10.24-r56-wiring-security-cleanup` (stamp سرویس‌ورکر را عوض می‌کند تا کش قدیمی باطل شود؛ build تأیید شد).

---

## ۳) نتایج تست و ساخت

| بررسی | نتیجه |
|---|---|
| سرور `vitest run` (کامل) | **۵۹ فایل سبز / ۱ فایل قرمز** · تست‌ها: **۱۳۸۳ سبز**، ۴۵ skip، **۴۵ قرمز** |
| ۴۵ قرمز | همه در `test/master-bank.test.js` و **از قبل در `HEAD` قرمز بودند** (مقایسهٔ دقیق نام تست‌ها: فقط ۲ تست round58 تغییر کردند، بقیه یکسان‌اند). علت: فیکسچرهای هش‌زنجیره‌ای `server/test/fixtures/round47..51-preservation.json` بایت‌های مشخصی از فایل‌های payload را مرجع گرفته‌اند؛ مثلاً `import-payload.master-preint.part01.json` در Git تغییر نکرده ولی هشش با فیکسچر نمی‌خواند. **این یک ناسازگاری داده‌ای از قبل است و با تغییر فیکسچر «سبز» نشد.** |
| تست‌های جدید/مرتبط | `rate-limit-account.test.js` ۴/۴ ✅ · `write-behind.test.js` ۴/۴ ✅ · `security-hardening` ۲۷/۲۷ ✅ · `vp-pilot` ۳۶/۳۶ ✅ |
| کلاینت `vitest run` | **۱۸ فایل / ۸۵ تست سبز** |
| کلاینت `npm run build` | ✅ (stamp: `medschool-2026.10.24-r56-wiring-security-cleanup`، ۱۷۲ sidecar فشرده) |
| کلاینت `npm run perf:budget` | ✅ با بودجهٔ به‌روز (بخش ۲.۶) |
| `npm run release:check` (ZIP) | ✅ (بخش ۴) |

---

## ۴) ZIP انتشار
- فایل: `MED-School-FINAL-2026-10-24-R56.zip` در ریشهٔ مخزن (ساخته‌شده با `scripts/pack-host-zip.mjs` و بررسی‌شده با `scripts/check-release-zip.mjs`).
- **commit نشده است:** حجم ZIP ~۲۸ MB است و راهنمای مخزن artifacts بزرگ را خارج از Git می‌خواهد. ZIPهای R48–R55 قبلاً در Git هستند؛ حذف‌شان انجام نشد.

---

## ۵) مسائل باز
1. **۴۵ تست `master-bank` (ناسازگاری فیکسچر هش‌زنجیره‌ای):** مالک محتوا باید مشخص کند کدام حالت مرجع است؛ بعد فیکسچرها یا payloadها هم‌تراز شوند. تا آن زمان قرمز می‌مانند.
2. **توکن احراز هویت در `localStorage`:** سرور کوکی `httpOnly` هم می‌گذارد، ولی کلاینت توکن را در `localStorage` نگه می‌دارد (در صورت XSS قابل خواندن است). تغییر به کوکی-only تغییر بزرگ در auth است؛ در این دور **اعمال نشد**.
3. **رمز پیش‌فرض عمومی ادمین:** سرور هشدار می‌دهد که حساب admin هنوز رمز demo عمومی دارد. باید تغییر کند.
4. **بدهی CSS:** تقسیم CSS به ازای route (برای برگشت بودجه‌ها به مقادیر قبلی).
5. **ZIP در Git ثبت نشد** (بخش ۴).

---

## ۶) یادداشت عملیاتی: بازیابی شاخه
- در میانهٔ دور، workspace بازسازی شد و شاخهٔ محلی روی lineage قدیمی‌تر (`b4ec28f`) قرار گرفت. commit R56 (`170a3c7`) روی remote سالم بود؛ شاخهٔ محلی با `git reset --hard origin/arena/3419d01b-med` همگام شد و تغییرات مرحلهٔ بعد (R58، بودجه، حذف هاب بیمار مجازی و فراخوانی مرده) دوباره اعمال شد. فایل‌های untracked (تست‌ها و گزارش) در commit بودند و بازیابی شدند.
- تغییرات R58 و بودجه و ... در commit بعدی روی همین شاخه ثبت شده‌اند.

## ۷) ریسک‌ها و یادداشت‌ها
- write-behind: پنجرهٔ ۱٫۵ ثانیه‌ای برای نوشتن‌های معمولی (بخش ۲.۶). تنظیم: `DB_FLUSH_DELAY_MS`.
- محدودکنندهٔ per-account: کاربر واردشده سقف بالاتری دارد؛ یک اسکریپت با توکن معتبر یک حساب، بعد از ۱۲۰۰ درخواست در ۱۵ دقیقه محدود می‌شود.
- CSP اجباری حالا `report-uri` دارد؛ حجم گزارش‌ها ممکن است بیشتر شود (endpoint با `limit: 20kb` و خلاصه‌سازی محافظت شده است).
- `db-restore.test.js` به‌تنهایی شکست می‌خورد (وابسته به seed تست `api`)؛ از قبل بود.
