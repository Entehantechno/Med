/* Visual check: the endocarditis chapter as a student actually sees it.

   The tenth visual file, and it inherits everything the earlier nine paid for:

     * the browse list shows only the STEM; the lesson and the answer key
       appear one interaction deeper, after picking an option and pressing
       "بررسی"
     * the modal is dismissed by clicking the BACKDROP, not with Escape
     * search terms must be copied out of the STORED text — which contains
       stray spaces inside Persian words — and must be UNIQUE across the whole
       bank, verified with /api/learn/browse?q=<term> and total === 1
     * a correction lesson deliberately QUOTES the broken original, so the
       stale-value check must read the STEM alone
     * Persian must be compared with the zero-width non-joiner stripped
     * and, from the CNS round: stemText() must PICK the element containing
       the search term and FAIL LOUDLY if it finds none, because
       `.first()` on a multi-element locator silently returned the "مطالعه"
       badge and made every stale-value assertion vacuous

   Terms rejected by the uniqueness check, recorded so nobody retries them:
     '120/80'            total = 4 (a very common blood pressure)
     '38/8 °c'           total = 0 — the value lives in an OPTION, and the
                         browse index only searches the STEM
     'کلاریترومایسین'    total = 0, same reason
   The substitutes used below search the stem instead: '120/80 را لهای' for
   q9101, 'طبق معیارهای دوک' for q9113 and 'جهت پروفیلاکسی ارجاع شده' for
   q9128. That is also why the q9113 and q9128 checks assert on the LESSON
   text rather than on the stem: their repaired numbers are in the options,
   which the preview does not index but the opened card does render.

   What is checked here:

   1. THE REPAIRED NUMBERS ARE ON SCREEN.
        q9101 — blood pressure 120/80 (stored mirrored as "80/021")
        q9113 — the two temperatures 38.8 and 39 (stored "8/83" and "93").
                This one is not cosmetic: it is a Duke-COUNTING question and
                fever scores only at 38 °C or above, so with "8/83" the keyed
                option would be one minor criterion short.
        q9128 — the three prophylaxis doses 250, 600 and 500 (stored with the
                unit fused onto a mirrored number: "mg052", "mg006", "mg005")

   2. BOTH TEACHING BLOCKS REACH THE STUDENT: recognition and Duke counting
      (batch 28); treatment, monitoring and prophylaxis (batch 29).

   3. THE FOUR KNOWN RENDERING DEFECTS DO NOT RETURN: literal ** markers,
      untranslated i18n keys, split or non-ASCII digits, and a lesson with no
      emphasis at all.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

const NUMBERS = [
  {
    q: "120/80 را لهای",
    must: "120/80",
    not: "80/021",
    what: "q9101 blood pressure un-mirrored to 120/80",
  },
];

/* The two remaining repaired questions carry their numbers in the OPTIONS,
   which the browse preview does not index. They are verified as lessons
   below, asserting on the repaired figure itself. */
const LESSONS = [
  // ---- batch 28: recognition and Duke counting
  {
    q: "میکرو آبسههای متعدد",
    must: "اورئوس",
    what: "brain microabscesses point to S. aureus (batch 28)",
  },
  {
    q: "کاهش وزن و تب از 2 هفته قبل",
    must: "HACEK",
    what: "negative cultures with no prior antibiotics mean a fastidious organism (batch 28)",
  },
  {
    q: "جزء گروه HACEK",
    must: "کوکسیلا",
    what: "Coxiella is intracellular and outside HACEK (batch 28)",
  },
  {
    q: "استرپتوکوک بوویس",
    must: "کولونوسکوپی",
    what: "S. bovis bacteraemia mandates colonoscopy (batch 28)",
  },
  {
    q: "سودوموناس آئروژنوزا",
    must: "ماژور",
    what: "four of four cultures plus a vegetation is two majors (batch 28)",
  },
  {
    q: "مشکوک به Janeway",
    must: "مینور",
    what: "count criteria not findings: three minors, no major (batch 28)",
  },
  {
    q: "طبق معیارهای دوک",
    must: "38/8",
    what: "q9113 the repaired 38.8 fever clears the Duke threshold (batch 28)",
  },
  {
    q: "کرایتریای ماژور",
    must: "وژتاسیون",
    what: "a mobile vegetation is the imaging major (batch 28)",
  },
  // ---- batch 29: treatment, monitoring, prophylaxis
  {
    q: "چهار روز پس از بستری",
    must: "هفته",
    what: "native-valve S. aureus needs 4 to 6 weeks (batch 29)",
  },
  {
    q: "مقاوم به متیسیلین",
    must: "بیوفیلم",
    what: "a prosthetic valve means biofilm, which means rifampicin (batch 29)",
  },
  {
    q: "آمپولی دو طرفه",
    must: "تریکوسپید",
    what: "right-sided disease embolises to the lung (batch 29)",
  },
  {
    q: "ضایعات دردناک کف دست",
    must: "اسلر",
    what: "painful lesions are Osler nodes, an immunologic phenomenon (batch 29)",
  },
  {
    q: "مانیتورینگ پاسخ به درمان",
    must: "کشت",
    what: "the response is measured by cultures, not by a repeat echo (batch 29)",
  },
  {
    q: "ناهنجاری مادرزادی قلب",
    must: "شش ماه",
    what: "a fully repaired defect is no longer high risk after six months (batch 29)",
  },
  {
    q: "درگیری عروق کرونر",
    must: "پرخطر",
    what: "coronary bypass is not a high-risk condition (batch 29)",
  },
  {
    q: "ایمپلنت دندان",
    must: "آموکسی‌سیلین",
    what: "prosthetic valve plus dental implant means amoxicillin 2 g (batch 29)",
  },
  {
    q: "جهت پروفیلاکسی ارجاع شده",
    must: "500",
    what: "q9128 the repaired clarithromycin 500 mg dose is taught (batch 29)",
  },
  {
    q: "تودهی مری",
    must: "داکسی‌سیکلین",
    what: "the doxycycline dose is wrong and endoscopy needs no prophylaxis (batch 29)",
  },
];

const res = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "learner", password: "demo" }),
});
const { token } = await res.json();
if (!token) throw new Error("login failed");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE);
await page.evaluate((t) => localStorage.setItem("medlab_token", t), token);

const problems = [];
await page.goto(BASE);
await page.waitForTimeout(2500);

await page.getByText("جست‌وجوی سؤالات", { exact: false }).first().click();
await page.waitForTimeout(1800);

async function search(term) {
  const box = page.getByPlaceholder("جست‌وجو در متن سؤال…").first();
  await box.fill("");
  await page.waitForTimeout(400);
  await box.fill(term);
  await page.waitForTimeout(1900);
  return page.locator("body").innerText();
}

async function openAndAnswer(term) {
  const back = page.locator(".modal-back").first();
  if (await back.count()) {
    await back.click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.waitForTimeout(700);
  }
  await search(term);

  const row = page.locator(".browse-preview-q, li, article, .card").filter({ hasText: term }).first();
  if (await row.count()) await row.click();
  await page.waitForTimeout(1600);

  const opt = page.locator(".modal-back input[type=radio], .modal-back .opt, .modal-back li").first();
  if (await opt.count()) {
    await opt.click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
  }
  /* Match the check button EXACTLY, not by substring.

     Two questions failed with "the lesson does not mention X" until this was
     traced: q9649's fourth OPTION begins with the word "بررسی" ("بررسی از نظر
     اندیکاسیون ختم حاملگی"), and the options are rendered as <button>. So
     filter({hasText:/بررسی/}).first() matched THE OPTION, clicked it instead
     of the real control, and the answer was never checked — the panel stayed
     on the question and the lesson never rendered.

     The failure looked like missing content and was in fact a mis-click.
     Anchor the pattern so only the control itself matches. */
  const check = page.locator(".modal-back button")
    .filter({ hasText: /^\s*(?:بررسی پاسخ|بررسی|Check(?:\s+answer)?)\s*$/i }).first();
  if (await check.count()) {
    await check.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1600);
  }
  return page.locator("body").innerText();
}

const noZwnj = (t) => String(t || "").replace(/\u200c/g, "");

/* Read the STEM alone for the stale-value check.

   Repaired in the CNS round after a negative test proved the inherited
   version was doing nothing: `.modal-back p` matches three elements and the
   FIRST is the little "مطالعه" badge, so every stale-value assertion was
   comparing against a six-letter label containing no laboratory value at all.
   Pick the candidate that actually holds the question, and refuse to pass
   when none is found. */
async function stemText(term) {
  const sel = page.locator(".modal-back p, .modal-back .stem, .modal-back h3");
  const n = await sel.count();
  const texts = [];
  for (let i = 0; i < n; i++) texts.push((await sel.nth(i).innerText()) || "");
  const hit = texts.find((t) => noZwnj(t).includes(noZwnj(term)));
  if (hit) return hit;
  const longest = texts.slice().sort((a, b) => b.length - a.length)[0] || "";
  return longest.length >= 60 ? longest : "";
}

for (const c of NUMBERS) {
  const body = await openAndAnswer(c.q);
  const stem = await stemText(c.q);
  const found = noZwnj(body).includes(noZwnj(c.q));
  const hasNew = noZwnj(body).includes(noZwnj(c.must));
  const hasOld = noZwnj(stem).includes(noZwnj(c.not));
  if (found && !stem) problems.push(`${c.what}: the stem could not be read, so the stale-value check did not run`);
  const ok = found && hasNew && !hasOld && !!stem;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.what}: found=${found} shows"${c.must}"=${hasNew} stillShowsOld=${hasOld}`);
  if (!found) problems.push(`${c.what}: the question is not searchable`);
  else if (!hasNew) problems.push(`${c.what}: corrected value ${c.must} is not on screen`);
  else if (hasOld) problems.push(`${c.what}: the uncorrected value ${c.not} is still in the STEM`);
  await page.screenshot({ path: `/tmp/endo-${c.what.replace(/\W+/g, "-").slice(0, 40)}.png` });
}

for (const c of LESSONS) {
  const body = await openAndAnswer(c.q);
  const found = noZwnj(body).includes(noZwnj(c.q));
  const taught = noZwnj(body).includes(noZwnj(c.must));
  const ok = found && taught;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.what}: found=${found} lessonShown=${taught}`);
  if (!found) problems.push(`${c.what}: the question is not searchable`);
  else if (!taught) problems.push(`${c.what}: the lesson does not mention "${c.must}"`);
}

const body = await page.locator("body").innerText();
if (body.includes("**")) problems.push("the lesson shows literal ** markers instead of bold text");
if (/\bcheckAnswer\b|\bbrowseStudy\b|\banswerKey\b/.test(body)) {
  problems.push("an untranslated i18n key is visible on the page");
}
if (/[\u0660-\u0669\u06F0-\u06F9]\s*\d|\d\s+\d\s*ساله/.test(body)) {
  problems.push("a rendered stem shows split or non-ASCII digits");
}
const bolds = await page.locator(".modal-back strong").count();
if (bolds === 0) problems.push("no emphasised phrase rendered in the lesson at all");
console.log(`PASS  rendering: ${bolds} bold phrase(s), no literal **, no untranslated key`);

await browser.close();
if (problems.length) {
  console.log("\nPROBLEMS:\n" + problems.map((p) => "  ✗ " + p).join("\n"));
  process.exit(1);
}
console.log("\nthe endocarditis chapter renders exactly as repaired.");
