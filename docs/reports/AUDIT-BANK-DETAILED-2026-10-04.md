# گزارش غربالگری دقیق بانک سؤالات — ۲۰۲۶-۱۰-۰۴

**تاریخ:** ۲۰۲۶-۱۰-۰۴ — **شاخه:** `arena/01a0be99-med` — **مجموع:** 11604 (۵۴ payload)

## چکیده معیارها

- توضیح هر گزینه: `options_why_fa` ۴تایی با پیشوند دقیق و طول ≥20
- درسنامه: `explanation_fa` ≥500، ≥۳ پاراگراف، حاوی ارجاع و بدون placeholder
- micro: `lead_fa` سقراطی (حاوی «؟») ≥10، `golden_fa` ≥10، `points_fa` ۴تایی ≥10 و غیرgeneric
- کلید: `correct_index` معتبر و بدون two-correct

## نتایج کلی

- **سالم:** 11604 / 11604 (100.0٪)
- **ناسالم:** 0 / 11604 (0.0٪)
- **انواع اشکال:**

## توزیع به تفکیک فایل (Top 20)

| فایل | کل | جزئیات |
|---|---|---|

## فهرست ناسالم (۲۰۰ اول — کامل در CSV)

CSV: `AUDIT-BANK-FAILURES-2026-10-04.csv` — 0 ردیف

| فایل | QNo | QID | موضوع | فصل | CI | طول | اشکالات |
|---|---|---|---|---|---|---|---|

## اولویت اصلاح

1. P0 — NULL_KEY / TWO_CORRECT / WRONG_PREFIX
2. P1 — SHORT_EXPL / PLACEHOLDER / MISSING_REF / SINGLE_PARAGRAPH
3. P2 — GENERIC_MICRO / LEAD_NOT_SOCRATIC
4. P3 — SHORT_POINT

---
_تولید: 0 ناسالم از 11604_
