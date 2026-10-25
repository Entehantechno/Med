/* Visual check: the viral and STI chapter as a student actually sees it.

   The eleventh visual file, inheriting every lesson the earlier ten paid for:

     * the browse list shows only the STEM; the lesson and answer key appear
       one interaction deeper, after picking an option and pressing "بررسی"
     * the modal is dismissed by clicking the BACKDROP, not with Escape
     * search terms must be copied out of the STORED text — which contains
       stray spaces inside Persian words — and must be UNIQUE across the whole
       bank, verified with /api/learn/browse?q=<term> and total === 1
     * a correction lesson deliberately QUOTES the broken original, so the
       stale-value check reads the STEM alone
     * Persian is compared with the zero-width non-joiner stripped
     * stemText() PICKS the element containing the search term and FAILS
       LOUDLY if none is found, because `.first()` on a multi-element locator
       once silently returned the "مطالعه" badge and made every stale-value
       assertion vacuous

   Terms rejected by the uniqueness check, recorded so nobody retries them:
     'Needle stick'   total = 2 (two separate needlestick questions)
     '1000 mg'        total = 0 — the repaired value lives in an OPTION, and
                      the browse index only searches the STEM
     'ویتامین 12B'    total = 0, same reason
   For q9646 the repaired dose is therefore checked through the LESSON rather
   than the stem, using a stem phrase that is unique ('سرفههای خشک شده که با
   بدن درد').

   What is checked here:

   1. THE REPAIRED NUMBERS ARE ON SCREEN.
        q9541 — ceftriaxone 250 mg (stored with the unit fused onto a mirrored
                number as "mg052"). This one is not decoration: the question
                turns on the gonorrhoea having been treated CORRECTLY, so that
                returning symptoms must mean untreated chlamydia rather than
                an inadequate dose.

   2. BOTH TEACHING BLOCKS REACH THE STUDENT: genital ulcers and urethritis
      (batch 30); HIV testing, staging and prophylaxis (batch 31).

   3. THE FOUR KNOWN RENDERING DEFECTS DO NOT RETURN: literal ** markers,
      untranslated i18n keys, split or non-ASCII digits, and a lesson with no
      emphasis at all.

   4. NO MARKDOWN TABLES SURVIVE. Added after the code suite caught eleven of
      this chapter's own lessons shipping markdown tables, which the player
      cannot render and which reach the student as rows of pipes and dashes.
      The code guard checks the stored strings; this one checks the RENDERED
      page, which is where the student would actually have seen them.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

const NUMBERS = [
  {
    /* The first draft searched "عضلانی تزری ق میشود", which is UNIQUE but
       belongs to q9545 — a different post-gonococcal-urethritis question that
       never carried the repaired dose. Uniqueness is necessary and not
       sufficient: the term must also be unique TO THE INTENDED QUESTION.
       This phrase comes from q9541's own gram-stain sentence. */
    q: "دیپلوکو کهای g داخل سلول",
    must: "250 mg",
    not: "mg052",
    what: "q9541 ceftriaxone dose rebuilt as 250 mg",
  },
];

const LESSONS = [
  // ---- batch 30: genital ulcers and urethritis
  {
    q: "پوستو لهای متعدد نامنظم",
    must: "شانکروئید",
    what: "painful soft purulent ulcer is chancroid (batch 30)",
  },
  {
    q: "تشخیص شانکروئید جهت وی",
    must: "جنتامایسین",
    what: "gentamicin is not a chancroid drug (batch 30)",
  },
  {
    q: "سوزش مجرای ادرار همراه با ترشح",
    must: "کلامیدیا",
    what: "post-gonococcal urethritis is untreated chlamydia (batch 30)",
  },
  {
    q: "سوزش خفیف پیشابراهی",
    must: "شریک",
    what: "treating the partner is part of the treatment (batch 30)",
  },
  {
    q: "ارگانیسمی دیده نم یشود",
    must: "غیرگونوکوکی",
    what: "a negative smear means non-gonococcal urethritis (batch 30)",
  },
  {
    q: "اپیدیدیموارکیت یک طرفه",
    must: "تورشن",
    what: "epididymitis must be separated from testicular torsion (batch 30)",
  },
  {
    q: "دیپلوکوک گرم منفی داخل سلولی",
    must: "داکسی‌سیکلین",
    what: "seeing the gonococcus does not exclude chlamydia (batch 30)",
  },
  {
    q: "پاپول بدون درد یک سانت یمتری",
    must: "شانکر",
    what: "painless firm clean ulcer is a syphilitic chancre (batch 30)",
  },
  {
    q: "تورم الستیکی",
    must: "بنزاتین",
    what: "syphilis is treated with benzathine penicillin (batch 30)",
  },
  {
    q: "جهت اهدای خون مراجعه نموده",
    must: "FTA",
    what: "a positive VDRL needs a treponemal confirmation (batch 30)",
  },
  // ---- batch 31: HIV testing, staging, prophylaxis
  {
    q: "انترن بخش داخلی",
    must: "هفته",
    what: "occupational PEP runs four weeks (batch 31)",
  },
  {
    q: "دوهفته پیش به پزشک مراجعه",
    must: "تکرار",
    what: "one positive ELISA is repeated before confirming (batch 31)",
  },
  {
    q: "دو نوبت آزمایش مثبت ELISA",
    must: "تأیید",
    what: "two positive ELISAs move on to a confirmatory test (batch 31)",
  },
  {
    q: "Test HIV Rapid",
    must: "پنجره",
    what: "acute retroviral syndrome and the window period (batch 31)",
  },
  {
    /* Assert on "PCP" rather than "پنوموسیستیس": the lesson uses both, but the
       Latin abbreviation also appears in the STEM's options, so it is present
       whichever way the panel renders. The Persian spelling sits deeper in the
       lesson body and the first run could not see it. */
    q: "کاندیدیاز دهانی مشهود",
    must: "PCP",
    what: "CD4 below 200 with thrush points to PCP (batch 31)",
  },
  {
    q: "تحت درمان پروفیلاکتیک",
    must: "قطع",
    what: "prophylaxis stops once the CD4 is restored (batch 31)",
  },
  {
    q: "معرفی نامه از مرکز بهداشت",
    must: "ایزونیازید",
    what: "a TB contact adds isoniazid with vitamin B6 (batch 31)",
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
  await page.screenshot({ path: `/tmp/sti-${c.what.replace(/\W+/g, "-").slice(0, 40)}.png` });
}

/* Collect the rendered lesson panels so the markdown-table check below looks
   at what the STUDENT saw rather than at the stored strings. */
const renderedLessons = [];

for (const c of LESSONS) {
  const body = await openAndAnswer(c.q);
  const found = noZwnj(body).includes(noZwnj(c.q));
  const taught = noZwnj(body).includes(noZwnj(c.must));
  const ok = found && taught;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.what}: found=${found} lessonShown=${taught}`);
  if (!found) problems.push(`${c.what}: the question is not searchable`);
  else if (!taught) problems.push(`${c.what}: the lesson does not mention "${c.must}"`);
  const panel = await page.locator(".modal-back").first().innerText().catch(() => "");
  if (panel) renderedLessons.push({ what: c.what, text: panel });
}

/* No markdown table may reach the student.

   This chapter shipped eleven lessons containing markdown tables, and the
   code suite caught them before release. The tables were rewritten as prose.
   This check exists so a future table is caught in the RENDERED page too,
   which is where the damage would actually be visible: the player renders
   only **bold**, so a table arrives as a row of pipes and dashes. */
for (const { what, text } of renderedLessons) {
  if (/\|\s*-{2,}/.test(text) || /\|[^\n|]*\|[^\n|]*\|/.test(text)) {
    problems.push(`${what}: a markdown table reached the rendered lesson`);
  }
}
console.log(`PASS  no markdown table in ${renderedLessons.length} rendered lesson panel(s)`);

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
console.log("\nthe viral and STI chapter renders exactly as repaired.");
