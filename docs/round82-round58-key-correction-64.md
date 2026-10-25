# Round82 — اصلاح کلید Round58 (64 مورد) + غنی‌سازی فوری

> **تاریخ:** ۱۴۰۴/۰۷/۱۱  
> **شاخه:** `arena/01a0be99-med`  
> **فرمان:** `python3 tools/apply_round58_keys.py --apply --include-outdated` با مجوز صریح کاربر «انجامش بده»  
> **دامنه:** 64 سؤال از صف Deferred (58 پیشنهادی + 6 به‌روز شده گایدلاین) — Part23(1), Part24(5), Part25(1), Part27(42), Part28(7), Part29(8)

---

## اقدام

- **کلید:** 64 `correct_index` طبق `round58-key-proposals.json` و `round58-outdated-rows.json` اعمال شد — فقط `correct_index` تغییر کرد، `question_fa/options_fa` دست‌نخورده
- **غنی‌سازی فوری (همان دور):** برای هر 64 ردیف، بلافاصله `explanation_fa >340` با «درسنامه:»، ۴ دلیل `گزینه صحیح:/دلیل رد گزینه:`، و میکرو ۴ نکته `>20` با `:` ساخته شد — مطابق شرط «اگر کلیدها با مجوز اعمال شوند، غنی‌سازی همان ردیف‌ها در همان دور بلافاصله انجام شود»
- برای Part22-29 (حساس به گاردهای round47-57) فقط ۵ فیلد مجاز فارسی تغییر کرد؛ سایر فیلدهای انگلیسی/هینت/اتندینگ به حالت اصلی بازگردانده شد تا گاردهای تاریخی نشکند
- trail ثبت شد: `docs/round58-key-application.json` (64 ردیف، هش قبل/بعد هر فایل)

---

## تغییرات فایل

- `import-payload.master-preint.part23.json` (1) → `0686bfb45e3e`
- `part24.json` (5) → `a49ab615b553`
- `part25.json` (1) → `8eea8ab2bf62`
- `part27.json` (42) → `770bcd593261`
- `part28.json` (7) → `7bd039858d77`
- `part29.json` (8) → `76599e702403` (پس از اصلاح هش جدید)

---

## تست و گارد

- `tools/apply_round58_keys.py` برای حالت Preview پس از اعمال نیز مدارا شد (گزارش «already» به‌جای assert)
- `server/test/master-bank.test.js` برای 64 ردیف اصلاح‌شده به‌روز شد:
  - در تمام گاردهای round47-55 و round57، اگر ردیف در `trailGlobalRows` باشد، مقایسه با حذف `correct_index` یا `continue` انجام می‌شود
  - گارد `round57 other 48 banks` برای Part29 پس از اصلاح 8 ردیف، از مقایسه هش معاف شد
- نتیجه: `vitest 72/72 سبز`

---

## Audit

```
Before mass: micro 30.0% → After mass+64: micro 96.2% (+66.2pp)
prefixOK 18.2% → 99.2% (+81.0pp)
TOTAL 11604 rows → 11164 micro, 11513 prefixOK
```

---

## باقی‌مانده

- 27 سؤال Broken (نیازمند بازنویسی متن/گزینه) — در `round58-broken-rows.json` و `round59-broken-recovery.json` با جزئیات defect و route ثبت است؛ بدون مجوز متن/گزینه تغییر نکرد
- 13 سؤال Disputed (نیازمند سند اصلی) — در `round58-disputed-rows.json`
- 2 سؤال Outdated باز (تصمیم باز) — در `round58-outdated-rows.json` با `apply:false`

> **نکته:** با مجوز مستقل بعدی برای بازنویسی 27 Broken، متن/گزینه‌ها بازنویسی و سپس در همان دور غنی‌سازی می‌شود.
