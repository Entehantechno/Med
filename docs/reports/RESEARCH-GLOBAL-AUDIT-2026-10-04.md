# حسابرسی جهانی زیبایی‌شناسی و تجربه کاربری — MED School (2026-10-04)

> **نقش‌های بررسی‌شده:** مهمان (Landing/Blog/Store)، زبان‌آموز (LearnApp — خانه، مسیر، درس، مرور، بانک سؤال، فیلترها، مایندمپ، پرمیوم، لیگ، کوئست‌ها)، دانشجوی دانشگاه (Classes/Exams/Flashcards)، ادمین (داشبورد، جدول داده، ایمپورت، تنظیمات).  
> **روش:** بازخوانی ۵۲ صفحهٔ `learn` + ۵ صفحهٔ عمومی + ۹ صفحهٔ ادمین + ۳ فایل طراحی (styles.css ۱۹۸۲ خط، design-refresh.css ۲۴۸۴ خط، mobile-learn.css ۳۶۸ خط)، تحلیل توکن‌های دیزاین سیستم، و ریسرچ تطبیقی با UWorld / AMBOSS / Anki / Duolingo / shadcn / Stripe / Figma — بدون تغییر منطق، فقط لایهٔ دیداری.

---

## خلاصه اجرایی (یک نگاه)

| محور | وضعیت فعلی | ریسک/فرصت | اولویت زیباسازی |
|---|---|---|---|
| دیزاین سیستم (توکن، تایپ، سایه) | قابل قبول، اما کارت‌ها و سایه‌ها یک‌دست نیستند | **متوسط** — فرصت شیشه‌ای کردن | **P0** |
| Landing hero | شبیه AMBOSS block؛ اعتماد خوب است اما عمق شیشه کم است | **بالا** — اولین تاثیر | **P0** |
| LearnHome (خانهٔ زبان‌آموز) | اطلاعات زیاد (استریک، حلقهٔ هدف، placement، daily report) — تراکم عمودی | **بالا** — شلوغی | **P0** |
| LearnPath + Flashcards | قبلاً فاز 10 شیشه‌ای شد؛ عالی | **کم** — تکمیلی | P2 |
| Lesson (کارت سؤال) | شیشه‌ای جدید خوب؛ گزینه‌ها هنوز تخت‌اند | **متوسط** | **P0** |
| Browse (بانک سؤال) | فیلترهای سریع خوب؛ اما کارت نتایج و شیت فیلتر سنگین | **متوسط** | **P0** |
| Review / Mistakes / Flagged | یکسان با lesson؛ خالی بودن خشک است | **متوسط** | P1 |
| TopBar + Learn Nav + TabBar موبایل | TopBar گرادیان سرمه‌ای؛ Nav فعال آبی — کمی خشک | **متوسط** | **P0** |
| Student (دانشگاهی) | ساده‌تر از learner؛ کارت‌های کلاس/آزمون تخت | **متوسط** | P1 |
| Admin | جدول DataTable کاربردی؛ سایدبار و هدر خشک، empty خالی | **متوسط** | **P0** |
| RTL + فارسی | Vazirmatn عالی؛ اما فواصل و خطوط در کارت‌های طولانی تنگ | **کم** | P1 |
| Dark mode | توکن‌ها اصلاح شده (۵.۶:۱)؛ اما شیشه در تاریک هنوز کم‌نور | **کم** | P1 |

---

## ۱) دیزاین سیستم جهانی — یافته‌ها

**مثبت:** توکن‌های `--panel`, `--border`, `--grad-*` منسجم؛ دکمه‌ها tactile با `box-shadow` عمق؛ Vazirmatn/Inter با `--fs` مقیاس‌پذیر؛ دارک‌مود با کنتراست AA.
**نازیبایی‌ها:**
- `.card` سایه `var(--shadow-sm)` کمی سنگین و یکنواخت؛ hover فقط `box-shadow` بدون lift شیشه‌ای — حس “کاغذ” به‌جای “شیشهٔ مات” مدرن (Flux 2026: glassmorphism با blur 12–18px روی پنل‌های روشن).
- `.skeleton` شیمر خاکستری ساده؛ Stripe/Baymard: اسکلتون باید گرد و نرم‌تر باشد تا LCP دلپذیر شود.
- `.empty-state .ico` شناور 3s اما آیکون تک‌رنگ؛ Duolingo: empty با mascots + پیام کوتاه و CTA دوگانه.
- فاصلهٔ `grid` ۱۸px ثابت — در موبایل کمی تنگ.
- **ریسرچ:** shadcn Admin (۱۴k★) از `Card` با `border` نازک + `backdrop-blur` + `shadow-sm` و `DataTable` با `TanStack`؛ Flux dashboard: شیشه روی پس‌زمینهٔ عمیق + گرادیان متحرک.

**اصلاح پیشنهادی (اعمال‌شده در Round 12):** لایهٔ شیشهٔ سبک روی تمام `.card`‌ها (blur 10–14px در لایت، 12px در دارک) + lift 2px روی hover + empty-state با گرادیان ملایم + skeleton گردتر.

---

## ۲) Landing (مهمان) — یافته‌ها

**مثبت:** یک هدر چسبان (نه دو)، اسکرول shadow، hero با `MockPath`، بخش مخاطبان (learner/uni)، ویژگی‌ها ۶تایی، How-it-works، گیمیفیکیشن، تستیمونیال CMS.
**نازیبایی‌ها:**
- hero `lp-hero-glow` ثابت؛ 21st.dev Glassmorphism Trust Hero: hero باید کارت شیشه‌ای شناور با آمار و لوگوهای “Trusted by” داشته باشد — در حال حاضر آمار زیر CTA و بدون کارت شناور.
- فاصلهٔ بین `lp-section`‌ها یکنواخت؛ Baymard: hero → ویژگی‌ها باید تنفس بیشتر داشته باشد (whitespace +20%).
- دکمه‌های hero `lp-btn-primary/outline` کمی کوچک برای انگشت (Landy 2026: CTA با کنتراست بالا + اندازه ۴۸px).
- تستیمونیال بدون ستارهٔ بصری در موبایل.

**اصلاح:** hero glow بزرگ‌تر + کارت شیشه‌ای شناور برای آمار (glass stats) + CTA بزرگ‌تر با شیمر + فاصلهٔ عمودی بیشتر + تستیمونیال با ستارهٔ طلایی.

---

## ۳) LearnHome (خانهٔ زبان‌آموز — پرترافیک‌ترین صفحه)

**مثبت:** hero با حلقهٔ هدف + streak/gems/xp؛ کوئیک‌ناو ۴تایی؛ استریک strip، کوئست strip، review reminder، placement دوستانه (dismissible).
**نازیبایی‌ها:**
- تراکم عمودی: ۷ کارت پشت‌سرهم (placement, reco, dx, onboarding, streak, quests, review) بدون گروه‌بندی — Duolingo Home: مسیر و کارت‌های “up next” باید گروه شوند و فاصلهٔ ریتمیک داشته باشند.
- `home-hero` بدون شیشه — حس تخت.
- کوئیک‌ناو دکمه‌ها تخت، آیکون ۱۸px کوچک.
- رنکینگ preview `case-item` با `tag` کوچک — خوانایی کم.

**اصلاح:** home-hero شیشه‌ای + کوئیک‌ناو با کارت‌های شیشه‌ای برجسته + گروه‌بندی با divider ریتمیک + رنکینگ با هالهٔ طلایی.

---

## ۴) Browse (بانک سؤال — پیچیده‌ترین UI)

**مثبت:** Baymard: OR درون فاست، AND بین فاست‌ها، هش‌استیت، شمارش صادقانه، glass quick-row، شیت فیلتر با اسلاید.
**نازیبایی‌ها:**
- `browse-search-card--glass` شیشه‌اش کم‌رنگ — در اسکرول گم می‌شود.
- کارت نتایج `browse-item-new card` بدون هالهٔ موضوعی — AMBOSS: هر سیستم یک گرادیان لبه دارد.
- شیت فیلتر `browse-filters-new` بدون blur — حس مودال خشک.

**اصلاح:** search-card با blur 16px + نتایج با لبهٔ گرادیان سیستم + شیت با backdrop-blur + chip‌های فعال با سایهٔ نرم.

---

## ۵) Lesson / Review / Mistakes (کارت سؤال — قلب محصول)

**مثبت:** progress bar با شیمر، high-yield toggle، micro-lesson، bug-report، confidence.
**نازیبایی‌ها:**
- گزینه‌ها `.opt-wrap` تخت — Anki: گزینهٔ انتخاب‌شده باید scale کوچک + هاله داشته باشد (تاکتیل).
- فیدبک `lesson-fb` بدون آیکون بزرگ — Duolingo: فیدبک باید با ایموجی/آیکون و حرکت اسلاید بیاید.

**اصلاح:** گزینه‌ها با lift و رینگ انتخاب + فیدبک با آیکون بزرگ و اسلاید.

---

## ۶) TopBar + Learn Nav + Mobile TabBar

**یافته:** TopBar گرادیان سرمه‌ای سنگین؛ Nav فعال فقط رنگ آبی؛ TabBar تخت.
**ریسرچ:** shadcn sidebar: active با `background: rgba(primary,.08) + border-left 3px` + icon 20px؛ Flux: topbar شیشه‌ای با blur.
**اصلاح:** TopBar با highlight شیشه‌ای نازک + Nav active با ریل ۳px + TabBar شیشه‌ای شناور با blur + badge پالس‌دار.

---

## ۷) Admin

**یافته:** جدول با TanStack، سایدبار ۲۳۲px sticky، مودال portaled.
**ریسرچ:** AdminLTE 4 / shadcn-admin: هدر جدول sticky با `backdrop-blur`، سطر hover با `translateX(2px)`، empty با illustration.
**اصلاح:** table header شیشه‌ای sticky + row hover lift + empty با گرادیان + سایدبار glass.

---

## ۸) Student (دانشگاهی) + PublicStore / Blog / Verify

**یافته:** StudentHome ساده؛ PublicStore کارت محصول تخت؛ Blog hero تخت.
**اصلاح:** کارت‌های محصول با گرادیان موضوعی + Blog hero شیشه‌ای.

---

## ۹) RTL / فارسی / دسترسی‌پذیری

**مثبت:** `dir` پویا، Vazirmatn Variable، `prefers-reduced-motion` رعایت شده.
**نازیبایی:** فاصلهٔ خط ۱.۷ در کارت‌های فارسی طولانی کمی تنگ؛ focus ring ۳px خوب اما روی دکمه‌های شیشه‌ای کم‌کنتراست.
**اصلاح:** خط فارسی ۱.۹ در `.lesson-q` + focus ring با `box-shadow` دوگانه.

---

## اقدامات Round 12 (اعمال‌شده)

- **Global glass pass:** تمام `.card`‌ها، `.empty-state`، `.skeleton`، `.topbar`، `.learn-nav`، `.learn-tabbar`، `.browse-*`، `.admin-layout` با blur/shadow/lift یکدست.
- **Landing hero:** glow بزرگ‌تر + glass stats + CTA shine.
- **LearnHome:** hero شیشه‌ای + quick-nav شیشه‌ای + ریتم عمودی.
- **Browse/Lesson:** گزینه‌ها tactile + شیت فیلتر شیشه‌ای.
- **Admin/Student:** header sticky glass + row hover.

همه با `prefers-reduced-motion` و هر دو تم تست شدند — بدون تغییر منطق، فقط لایهٔ دیداری. Build 4s موفق.
