# گزارش دور ۶۰ — تأیید اجباری کارت‌های فلش‌کارت، بازگشت و تغییر پاسخ، اتصال جفتی با رنگ، پاک‌کن نقاشی

- تاریخ: 2026-10-25 (Asia/Tehran)
- شاخه: `arena/3419d01b-med` (پایه: `a51f154` = R59)
- نسخهٔ جدید: `2026.10.25-r60-flash-confirm-nav-matching-eraser` (`VERSION.txt`)

---

## ۱) خلاصهٔ مدیریتی

درخواست دور ۶۰ چهار مورد بود: (۱) هر فلش‌کارتی که به دانشجو نشان داده می‌شود باید قبل از رفتن به سؤال بعد با دکمهٔ تأیید بسته شود؛ (۲) بازگشت به سؤال قبلی و تغییر پاسخ، هر دو قابل فعال/غیرفعال‌شدن به‌ازای هر آزمون یا کلاس توسط استاد یا ادمین باشند؛ (۳) در سؤال‌های جفت‌کردنی (match)، دانشجو بتواند اتصال را تغییر دهد یا لغو کند و دو سر هر جفت یک رنگ مشترک و متمایز داشته باشند؛ (۴) پاک‌کن نقاشی فقط بخشی را که دانشجو انتخاب کرده پاک کند، نه کل تصویر.

نتیجهٔ کلی:

- **تأیید اجباری برای همهٔ انواع کارت.** قبلاً گزینه‌ای (MCQ) با یک کلیک نمره می‌گرفت و بخش hotspot بسته به تنظیم هر کارت می‌توانست با رهاکردن ماوس نمره بگیرد. حالا هیچ کارتی بدون تأیید ثبت نمی‌شود و دکمهٔ «کارت بعدی» تا پاسخ تأییدشده ظاهر نمی‌شود. گزینهٔ «تأیید پاسخ» برای hotspot حذف شد تا رفتار یکنواخت باشد.
- **بازگشت و تغییر پاسخ به‌صورت سه‌حالته** (`inherit / on / off`) در سطح کلاس، آزمون، دانشگاه و تنظیمات سراسری قابل تنظیم است. سرور هم در زمان ثبت، تغییر پاسخ را وقتی غیرمجاز است رد می‌کند.
- **Matching:** اتصال قابل تغییر و لغو است، هر جفت رنگ مشترک و شماره دارد.
- **Drawing:** دو لایهٔ کانواس (پایه و جوهر)؛ پاک‌کن فقط روی جوهر کار می‌کند و تصویر مرجع دست‌نخورده می‌ماند.
- **پاک‌سازی:** prop منسوخ `withSubmit` از `SearchAnswer` حذف شد؛ ستون/گزینهٔ `confirm` از hotspot حذف شد؛ کلیدهای تکراری در `Admin.jsx` پاک شدند؛ کد مردهٔ `Flashcards` و سه متغیر بالاسری بلااستفاده حذف شد.
- **بیلد و تست:** بیلد کلاینت موفق؛ `vitest` کلاینت: ۲۱ فایل، ۱۰۳ تست، همه سبز؛ `vitest` سرور (اجرای کامل): ۱۳۹۴ سبز، ۴۵ رد، همهٔ ردها در `master-bank` و از قبل موجود (بدون تغییر نسبت به R59)؛ به‌علاوه تست جدید enforcement (۳/۳ سبز)؛ `perf:budget` سبز.

---

## ۲) تحقیق و یافته‌ها (پیش از اصلاح)

| نوع کارت | وضعیت قبل از R60 | اقدام |
|---|---|---|
| MCQ / image (`answerMode: choice`) | با کلیک نمره می‌گرفت، بدون تأیید | `pick` → `confirmChoice` |
| جستجو (`answerMode: search`) | انتخاب در فهرست، سپس دکمهٔ «ثبت» جدا (`withSubmit`) | انتخاب فقط اشاره‌گر است؛ تأیید با دکمهٔ مشترک |
| hotspot | با `confirm=false` با رهاکردن ماوس نمره می‌گرفت | `confirm` حذف شد؛ همیشه «نشانه‌گذاری + تأیید» |
| truefalse / fill / match / order (ExamOtherType) | دکمهٔ بررسی صریح داشتند | حفظ شد؛ اکنون پاسخ ویرایش‌شده هم از همین مسیر می‌گذرد |
| drawing / stepwise / kf / puzzle / compare | دکمهٔ تأیید صریح داشتند | حفظ شد؛ `disabled` با `checked` یکپارچه است |
| پیشروی خودکار | وجود نداشت؛ `next()` فقط از دکمه صدا زده می‌شد | بدون تغییر؛ اکنون دکمه فقط پس از پاسخ تأییدشده ظاهر می‌شود |

یافته‌های اضافی:

- `Flashcards.jsx`: کلید تکراری `picked` در یک آبجکت (یک‌بار `picked: null` و بار دیگر `picked: optIdx` در `pick()`). بیلد نمی‌شکست اما کد مبهم بود؛ اصلاح شد.
- `Admin.jsx`: کلیدهای تکراری `questionText_fa/en` در شیء کارت خالی (وجود از قبل). کلیدهای ابتدایی بی‌اثر بودند و حذف شدند.
- `SearchAnswer`: `withSubmit` فقط در یک مسیر استفاده می‌شد که دیگر وجود نداشت؛ کد و استایل `.with-submit` حذف شد.
- خروجی پاسخ‌ها (`answerDetails`) تعداد تغییرات هر کارت را (`changes`) ندارد؛ این فیلد حالا از `cardStates` پر می‌شود.

---

## ۳) تغییرات این دور

### ۳.۱) تأیید اجباری کارت‌ها (`Flashcards.jsx`, `HotspotPlayer.jsx`, `HotspotEditor.jsx`)
- `renderCard(j)` برای هر اندیس وضعیت جدا (`cardStates[]`) نگه می‌دارد: `picked`، `tried`، `solved`، `revealed`، `editing`، `snapshot`، `changes`.
- MCQ و جستجو: انتخاب → `pickFirst` / `yourChoice` → دکمهٔ `confirmAnswer`.
- hotspot: نشانه‌گذاری → تأیید. گزینهٔ `confirm` از ادیتور، پلیر و مدل داده حذف شد.
- `next()` فقط وقتی `!locked` است کار می‌کند.

### ۳.۲) بازگشت و تغییر پاسخ (سرور + کلاینت + مدیریت)
- ستون‌های جدید: `classes.flash_allow_back/flash_allow_change`، `exams.flash_allow_back/flash_allow_change`، `universities.flash_allow_back/flash_allow_change`، و تنظیمات سراسری `default_flash_allow_back/default_flash_allow_change`.
- ترتیب تعیین: ردیف (کلاس/آزمون) → دانشگاه → تنظیم سراسری → خاموش. (`lib/orglimits.js`: `effectiveFlashAllowBack/Change`، `triInput`، `parseLicensingBody`)
- کلاینت: `allowBack/allowChange` از `App.jsx` و `StudentExams.jsx` و `Classes.jsx` به `Flashcards` می‌رسد؛ کلاس ترکیبی (combined) از `/classes/:id/flashcards/config` می‌خواند.
- بازگشت: کارت‌های دیده‌شده پایدار می‌مانند و مخفی می‌شوند. اگر تغییر پاسخ خاموش باشد، کارت قبلی با پیام `lockedAnswer` قفل است.
- تغییر پاسخ: `changeAnswer` → ویرایش با `snapshot` → `confirmAnswer` یا `cancelChange`. `changes` هر کارت شمارش می‌شود.
- **اجرای سرور:**
  - `POST /api/exam/flashcard-result`: اگر `changes > 0` باشد و `flash_allow_change` برای آزمون خاموش باشد → **403** `answer_change_not_allowed`.
  - `POST /api/classes/:id/flashcards/finish` (ترکیبی): همان بررسی با `deck.allowChange`.
  - `POST /api/classes/:id/flashcard/:fid/finish` (تک‌کارت): همان بررسی با `effectiveFlashAllowChange(clsRow)`.
  - پیکربندی کلاس (`decorateClass`, `GET .../config`, `.../flashcards/config`) و پیکربندی آزمون (`flashNav`) مقدار مؤثر را برمی‌گرداند.
- **مدیریت:**
  - `Admin.jsx` کلاس: دو `select` (inherit/on/off) با نمایش «وضعیت مؤثر فعلی».
  - `Admin.jsx` آزمون: دو `select` بعد از `show_micro`.
  - `Admin.jsx` دانشگاه: دو checkbox در تنظیمات پیش‌فرض و دو `select` در فرم دانشگاه.
  - `portable.js` (وارد/صادر): ستون‌های جدید در INSERT کلاس (۲۶ جای‌نما) و آزمون (۲۹ جای‌نما) — تطابق بررسی شد.
- **برچسب‌های دانشجو** در کلاس: «بازگشت به کارت قبلی» و «تغییر پاسخ مجاز» نمایش داده می‌شود.

### ۳.۳) جفت‌کردن (matching) — `lib/match-pairs.js`، `ExamOtherType.jsx`
- حالت: `{ pairs: { [leftId]: rightId }, activeLeft }`. هر سمت راست حداکثر به یک سمت چپ وصل است.
- لمس سمت چپ متصل → لغو اتصال و انتخاب مجدد. لمس سمت راست متصل بدون انتخاب → لغو.
- انتخاب سمت چپ آزاد و سپس سمت راست → اتصال؛ اگر سمت راست قبلاً وصل بود، از جفت قبلی جدا و به جفت جدید منتقل می‌شود.
- رنگ: `PAIR_COLORS[indexOfLeft]` برای هر دو سر. شمارهٔ جفت (۱، ۲، …) هم نمایش داده می‌شود تا تشخیص جفت به رنگ وابسته نباشد.
- پیام راهنما در متن سؤال به زبان فارسی و انگلیسی اضافه شد.

### ۳.۴) پاک‌کن نقاشی — `ExamOtherType.jsx` (`DrawingQuestion`)
- دو کانواس روی هم: `drawing-base` (پس‌زمینه و تصویر مرجع، فقط نمایش، `pointer-events: none`) و `drawing-ink` (لایهٔ شفاف که همهٔ ابزارها را دریافت می‌کند، `touch-action: none`).
- پاک‌کن با `destination-out` فقط روی جوهر کار می‌کند؛ مرجع و پس‌زمینه پاک نمی‌شود.
- Undo/Redo فقط تصویر جوهر و برچسب‌ها را ذخیره می‌کند.
- پاک‌کن در شمارش `strokeCount` حساب نمی‌شود.
- ماسک ارزیابی (mask) فقط از آلفای لایهٔ جوهر ساخته می‌شود؛ پیش‌نمایش در `try/catch` ترکیب می‌شود (برای تصویر مرجع cross-origin که canvas را آلوده می‌کند).

### ۳.۵) استایل — `client/src/styles-r60.css`
- `.flash-nav` (ردیف دکمه‌ها)، `.flash-nav-next` (تمام‌عرض)، `.flash-nav-note`.
- `.drawing-base` و `.drawing-ink` (لایه‌بندی و `touch-action`).
- `.pair-no` (نشان شمارهٔ جفت) و `.match-item.connected`.
- فایل جدا برای قابل‌ممیزی بودن؛ در `main.jsx` بعد از `styles-speed-fixes.css` بارگذاری می‌شود.

### ۳.۶) i18n
- کلیدهای جدید در fa و en: `confirmAnswer`، `changeAnswer`، `cancelChange`، `prevCard`، `yourChoice`، `pickFirst`، `lockedAnswer`.

---

## ۴) تست‌ها و دستورات اجراشده

| دستور | نتیجه |
|---|---|
| `node --check` روی فایل‌های سرور لمس‌شده (exam, classes, exams, flashcard-grade, orglimits, universities, portable, db) | بدون خطا |
| `cd client && npx vitest run` | **21 فایل، 103 تست — همه سبز** |
| `cd client && npm run build` | موفق؛ `stamp-sw` → `medschool-2026.10.25-r60-…` |
| `cd client && npm run perf:budget` | **سبز** (entry JS gzip ≈ 24.8 KB، entry CSS gzip ≈ 59.8 KB) |
| `cd server && npx vitest run` (کامل، پیش از افزودن تست enforcement) | **1394 سبز، 45 skip، 45 رد** — همهٔ ردها `master-bank.test.js` (از قبل موجود؛ نیاز به تصمیم ویراستاری) |
| `server/test/flash-navigation.test.js` | 8/8 سبز (شامل تست `changedCardCount`) |
| `server/test/flash-change-enforcement.test.js` (جدید، سطح route) | 3/3 سبز: 403 وقتی خاموش، عبور وقتی بدون تغییر، عبور وقتی روشن |
| `server/test/flashcard-types.test.js` | 10/10 سبز (assert مربوط به `confirm` حذف شد) |

تست‌های جدید کلاینت:

- `client/src/pages/Flashcards.test.jsx` (۵ تست): انتخاب بدون امتیاز؛ تأیید → `/flashcards/check`؛ نبودن «کارت بعدی» پیش از تأیید؛ نبودن کنترل‌های بازگشت/تغییر وقتی خاموش؛ وجود آن‌ها وقتی روشن؛ بازگشت با پیام قفل.
- `client/src/components/ExamOtherType.match.test.jsx` (۳ تست): اتصال با رنگ و شماره مشترک؛ لغو با لمس سمت چپ؛ جابه‌جایی سمت راست به جفت جدید.
- `client/src/lib/match-pairs.test.js` (۱۰ تست): منطق خالص اتصال، جابه‌جایی، لغو و رنگ‌ها.
- `client/src/components/SearchAnswer.test.jsx` (۳ تست): به‌روزرسانی شده؛ دیگر `withSubmit` ندارد.

---

## ۵) محدودیت‌ها و مواردی که هنوز نیاز به بررسی دارند

1. **پاک‌کن در مرورگر واقعی تأیید نشده.** jsdom کانواس ندارد؛ منطق با بررسی کد تأیید شد اما باید روی موبایل و دسکتاپ با دست واقعی آزموده شود (به‌ویژه با تصویر مرجع و حالت‌های dark/cream).
2. **اجرای سمت سرور برای تغییر پاسخ مبتنی بر گزارش کلاینت است.** سرور فقط پاسخ‌های نهایی را می‌بیند؛ اگر کلاینتی دستکاری‌شده `changes` را کمتر گزارش کند، می‌تواند از محدودیت عبور کند. اجرای کامل نیازمند وضعیت «اولین پاسخ ثبت‌شده» برای هر کارت در سرور است (کار بعدی، جدا از این دور).
3. **بازگشت به سؤال قبلی** فقط در UI است و روی نمره اثری ندارد، چون سرور پاسخ نهایی را نمره می‌دهد.
4. **تست یکپارچه برای مسیر تک‌کارت کلاس** وجود ندارد؛ منطق با همان helper (`changedCardCount`) و بررسی کد پوشش داده شده است.
5. **رفتار جدید برای دانشجو:** MCQ دیگر با یک کلیک نمره نمی‌گیرد؛ یک کلیک اضافه (تأیید) لازم است. این عمدی و مطابق درخواست است.
6. **مشکلات از قبل موجود (تغییری نکرد):**
   - ۴۵ شکست `master-bank` (hash pinها و ۳۱ رکورد بدون کلید صحیح) — نیاز به تصمیم ویراستاری.
   - `masterbank-md.js`: نگه‌داشتن یا حذف — تصمیم باز.
   - حجم مخزن (ZIPهای R48–R55 در Git، حدود ۲۴۰ MB) — تصمیم کاربر.
   - `style-src 'unsafe-inline'` در CSP — باقی است.

---

## ۶) وضعیت شاخه و فایل‌ها

- تغییرات در `` (پروژه) و این گزارش در `.work/APP-ROUND60-REPORT.md`.
- فایل‌های جدید:
  - `client/src/lib/match-pairs.js`، `match-pairs.test.js`
  - `client/src/styles-r60.css`
  - `client/src/pages/Flashcards.test.jsx`
  - `client/src/components/ExamOtherType.match.test.jsx`
  - `server/test/flash-navigation.test.js`
  - `server/test/flash-change-enforcement.test.js`
- `.work/` در `.gitignore` است؛ فایل‌های tracked با `git add -f` و فایل‌های جدید با `git add -f` اضافه شدند. پوشهٔ `.work/tmp/` (اسکریپت‌های patch) عمداً commit نشد.
- ZIP انتشار: `MED-School-FINAL-2026-10-25-R60.zip` در ریشهٔ مخزن (ساخته‌شده از همین commit، غیر tracked، مانند R59). `release:check` سبز؛ ۸۳۲ فایل، ۲۷.۵ MB؛ `JWT_SECRET` در `.env` خالی؛ `client/dist` و `node_modules` مطابق قاعده.
- یادداشت عملیاتی: در میانهٔ دور، ورک‌اسپیس به یک snapshot قدیمی برگشت (شاخهٔ محلی روی `b4ec28f`). شاخه با `git fetch` و fast-forward به `origin/arena/3419d01b-med` (`e91788c`) همگام شد؛ هیچ commit محلی از دست نرفت. ZIP اولیه که در آن وضعیت ساخته شده بود دور ریخته شد و ZIP فعلی از کد commit‌شده ساخته شد.
