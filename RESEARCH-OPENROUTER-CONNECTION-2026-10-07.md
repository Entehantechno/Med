# تحقیق اتصال OpenRouter — ۲۰۲۶-۱۰-۰۷

## نتیجهٔ اجرایی

**اتصال هنوز برقرار نشده است.** شواهد با محدودیت خروجی شبکهٔ محیط یا قطع اتصال در مسیر سازگارند. تنظیم واقعی فایروال/control plane در دسترس این عامل نیست، بنابراین علت دقیق بدون تأیید اپراتور قطعی اعلام نمی‌شود. هیچ کلید OpenRouter، درخواست inference یا دادهٔ بیمار برای این بررسی ارسال نشد.

این دور تغییر نرم‌افزاری در MED ایجاد نکرده و نسخهٔ اجرایی R10 جایگزین نشده است. تحقیق حاضر مجوز دورزدن فایروال، تغییر هویت مقصد، غیرفعال‌کردن اعتبارسنجی TLS یا ارسال کلید به پراکسی ناشناس نیست.

## آزمون‌های انجام‌شده

جزئیات قابل بازبینی در `OPENROUTER-NETWORK-EVIDENCE-2026-10-07.json` است.

| بررسی | نتیجه |
|---|---|
| DNS محلی IPv4 | `104.18.2.115` و `104.18.3.115` |
| پاسخ مستقل DNS عمومی | همان دو آدرس |
| هر دو IP، TLS 1.2، SNI صحیح و بررسی گواهی روشن | اتصال TCP ظاهراً موفق؛ سپس `SSLZeroReturnError` قبل از TLS کامل |
| هر دو IP، TLS 1.3، SNI صحیح و بررسی گواهی روشن | همان شکست |
| OpenSSL با `-verify_return_error` | `no peer certificate available`؛ handshake: صفر بایت خوانده‌شده، ۳۲۶ بایت نوشته‌شده |
| مقصد کنترلی `api.github.com` | TLS 1.3 موفق، گواهی معتبر و پاسخ HTTP؛ درخواست خامِ بدون User-Agent پاسخ 403 داد، نه خطای TLS |
| دو IP مقصد کنترلی `registry.npmjs.org` | TLS موفق، گواهی معتبر و HTTP 200 |
| بررسی قبلی Node/curl/Chromium 153 | به‌ترتیب ECONNRESET / SSL_ERROR_SYSCALL / ERR_CONNECTION_CLOSED؛ نتیجهٔ قبلی، نه اجرای مجدد مرورگر در این دور |

عبارت `Verify return code: 0 (ok)` در خروجی شکست‌خوردهٔ OpenSSL **نباید تأیید گواهی OpenRouter تعبیر شود**: هیچ گواهی دریافت نشده و cipher نیز NONE است.

## یافته‌های مستند

### ۱. موفقیت TCP می‌تواند گمراه‌کننده باشد

مستندات رسمی E2B توضیح می‌دهند که فایروال برای تصمیم‌گیری دربارهٔ مجازبودن مقصد ممکن است ابتدا اتصال را بپذیرد؛ بنابراین socket باز از داخل sandbox لزوماً به معنی رسیدن ترافیک به مقصد نیست. ملاک، TLS کامل یا پاسخ HTTP است. مستندات همچنین فیلتر دامنه بر پایهٔ SNI روی پورت 443 را توضیح می‌دهند. این توضیح با آزمایش ما سازگار است؛ **مشاهدهٔ مستقیم پیکربندی فایروال محسوب نمی‌شود**. [1]

### ۲. کلید و انتخاب مدل هنوز وارد مسئله نشده‌اند

طبق مستندات رسمی OpenRouter، کلید نامعتبر معمولاً پاسخ HTTP 401، محدودیت مجوز 403، کمبود اعتبار 402 و محدودیت نرخ 429 تولید می‌کند. این محیط برای OpenRouter اصلاً به مرحلهٔ HTTP نرسیده است. در نتیجه تعویض مدل، افزودن Authorization یا افزایش موجودی درمان این شکستِ مشاهده‌شده نیست. وضعیت اعتبار خود کلید آزموده نشده است. [2]

### ۳. خطای 35 به‌تنهایی علت دقیق را ثابت نمی‌کند

مستندات curl خطای 35 را خطای عمومی handshake معرفی می‌کنند. نتیجهٔ «احتمال محدودیت خروجی» از ترکیب آن با صفر بایت دریافتی، فقدان گواهی، شکست هر دو IP/نسخهٔ TLS و موفقیت مقصدهای کنترلی به دست می‌آید؛ نه صرفاً از یک شمارهٔ خطا. [3]

### ۴. راه‌حل مدیریتی رسمی وجود دارد، اما ابزار آن در این جلسه موجود نیست

E2B برای دامنه‌های مجاز `allowOut` / `allow_out` و برای تغییر پیکربندی sandbox فعال `updateNetwork` / `update_network` دارد. این کار باید توسط اپراتوری انجام شود که مجوز مدیریت همان sandbox را دارد. ابزارهای این جلسه چنین عملیاتی ارائه نمی‌کنند. **این متد پیکربندی موجود را جایگزین می‌کند، نه merge**؛ در نتیجه نباید با `{}`، wildcard عمومی یا فهرست ناقص، سیاست موجود را پاک کرد. [1]

## اقدام پیشنهادی برای رفع واقعی

اولویت اول: اپراتور Arena تنظیمات خروجی همین sandbox را بررسی کند و در صورت مجازبودن درخواست، دامنهٔ دقیق `openrouter.ai` را برای HTTPS روی پورت 443 به سیاست مجاز موجود اضافه کند؛ قواعد و مقصدهای مجاز قبلی حفظ شوند. در صورت وجود قاعدهٔ مجاز، لاگ‌های فایروال/پراکسی و محدودیت IP مبدأ در مسیر بررسی شوند. صرف تغییر فایل‌های پروژه نمی‌تواند چنین سیاست مدیریتی را اصلاح کند.

پس از اصلاح، معیار پذیرش این است:

```sh
curl --fail-with-body --connect-timeout 10 --max-time 20 \
  https://openrouter.ai/api/v1/models
```

این GET عمومی است و کلید نمی‌خواهد. باید TLS معتبر و پاسخ HTTP 200 با JSON دارای آرایهٔ `data` دریافت شود. سپس ابزار آمادهٔ `scripts/benchmark-openrouter.mjs --preflight` اجرا شود. فقط پس از موفقیت اتصال، تست‌های واقعی رایگان با محدودیت هزینه و کلید خصوصی آغاز شوند.

اگر سیاست خروجی این محیط قابل تغییر نیست، اجرای runner در محیط مورد تأییدِ دیگری که دسترسی شبکه دارد، جایگزین است. GitHub Actions یکی از گزینه‌هاست، نه تنها راه و نه راه‌حل قطعی. بررسی قبلی API مربوط به Secretهای مخزن با 403 integration permission مواجه شد؛ مجوز حساب کاربر به‌تنهایی به معنی مجوز اتصال Arena نیست. درخواست قبلی برای تغییر مجوز GitHub، راه‌حل اصلی این شکست TLS نبود و فقط یک مسیر جایگزین بود.

کلید نباید در workflow، آرگومان CLI، گزارش، artifact یا commit قرار بگیرد. از فرستادن کلید به سرویس تبدیل URL/پراکسی عمومی یا تغییر SNI برای عبور از قواعد استفاده نمی‌شود.

## متن آماده برای پشتیبانی Arena

> In this Agent Mode session, outbound HTTPS to `https://openrouter.ai/api/v1/models` fails before HTTP/authentication. DNS resolves to 104.18.2.115 and 104.18.3.115; an independent public DNS query agrees. Both addresses fail with verified TLS 1.2 and TLS 1.3 using the correct SNI. OpenSSL reports “no peer certificate available” and “SSL handshake has read 0 bytes and written 326 bytes”. Verified TLS and HTTP responses work for api.github.com and registry.npmjs.org. Please inspect this session's egress policy and, if approved, permit the exact hostname openrouter.ai on TCP 443 while preserving existing rules. If already allowed, investigate firewall/proxy logs or upstream source-IP filtering. No API key is needed to reproduce. Please do not disable certificate validation or globally open egress.

این متن آماده شده است؛ از طرف عامل تیکت پشتیبانی ارسال نشده است.

## منابع و دامنهٔ مطالعه

1. E2B، **Internet access**، هر سه بخش متن بازیابی‌شده خوانده شد؛ شامل domain filtering، رفتار blocked TCP و جایگزینی تنظیمات با updateNetwork:
   https://docs.e2b.dev/network/internet-access
2. OpenRouter، **API Error Handling and Debugging**، بخش اول از پنج بخش خوانده شد؛ شامل Error codes و تفاوت خطاهای HTTP/بدنهٔ پاسخ:
   https://openrouter.ai/docs/api_reference/errors-and-debugging
3. curl، **libcurl error codes**، بخش اول از سه بخش خوانده شد؛ شامل CURLE_SSL_CONNECT_ERROR (35):
   https://curl.se/libcurl/c/libcurl-errors.html
4. Google Public DNS، پاسخ A در زمان تحقیق:
   https://dns.google/resolve?name=openrouter.ai&type=A

جست‌وجوی عمومی برای تنظیم اختصاصی allowlist در رابط Arena، راهنمای رسمی قابل اتکایی برای دکمه/منوی کاربر پیدا نکرد؛ بنابراین مسیر UI اختراع نشده است. برخی راهنماهای غیررسمی خطای پیش از TLS را با کلید نامعتبر مخلوط می‌کردند؛ مبنای نتیجه‌گیری قرار نگرفتند.
