# نقشهٔ دانش پروژه با graphify (R75)

ابزار: `graphify` (مخزن Graphify-Labs/graphify، نسخهٔ 0.9.100 از PyPI با نام `graphifyy`).
بخش کد با تحلیل AST (tree-sitter) انجام می‌شود، بدون مدل زبانی و بدون ارسال داده به بیرون.

## اجرا
```bash
uv tool install graphifyy        # یا: pip install graphifyy
graphify update .                 # ساخت گراف کد (بدون LLM، حدود ۳۰ ثانیه)
graphify cluster-only . --no-label --no-viz   # خوشه‌بندی و GRAPH_REPORT.md
graphify query "..."              # پرس‌وجو از گراف به‌جای grep
graphify path "A" "B"             # کوتاه‌ترین مسیر بین دو نماد
```
خروجی در `graphify-out/` ساخته می‌شود و در `.gitignore` است (محلی، بزرگ).

## یافته‌ها (وضعیت R75)
- گراف: ۶٬۴۹۵ گره، ۱۵٬۴۷۶ یال، ۳۱۲ خوشه. ۹۷٪ یال‌ها `EXTRACTED` و ۳٪ `INFERRED`.
- هاب‌های اصلی (بیشترین یال): `useApp()` (۳۹۷)، `Icon()` (۳۳۲)، `db` (۱۴۵)، `Spinner()` (۱۱۹)، `api` (۱۰۰)، `useToast()` (۹۰)، `getGameConfig()` (۸۴)، `createApp()` (۸۱)، `Admin()` (۷۷).
- **چرخهٔ وارد‌کردن:** قبل از R75 یک چرخه بود: `server/src/db.js ⇄ server/src/lib/leases.js`. `leases.js` حالا `makeLeases(db)` را صادر می‌کند و خودش `db.js` را وارد نمی‌کند. گزارش بعد از تغییر: «چرخه‌ای یافت نشد».
- `Icon()` چهار یال `INFERRED` دارد که باید بازبینی شود.
- گره‌های بدون اتصال: `RFC-9116`، `RFC-4180` (مستندات) و `./src/db.js` (ورودی مسیر نسبی؛ اشکال واقعی نیست).

## محدودیت‌ها
- یال‌های `INFERRED` تأیید انسانی ندارند.
- خوشه‌ها بدون برچسب زبانی ساخته شدند (`--no-label`).
- گراف با کامیت فعلی هم‌خوان است؛ بعد از هر تغییر کد `graphify update .` را دوباره اجرا کنید.
