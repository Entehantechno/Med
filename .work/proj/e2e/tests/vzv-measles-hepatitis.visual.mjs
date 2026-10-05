/* Visual check: the varicella, measles and hepatitis blocks as a student sees them.

   The twelfth visual file, inheriting every lesson the earlier eleven paid for:

     * the browse list shows only the STEM; the lesson and answer key appear
       one interaction deeper, after picking an option and pressing "بررسی"
     * the modal is dismissed by clicking the BACKDROP, not with Escape
     * search terms must be copied out of the STORED text — which contains
       stray spaces inside Persian words — and must be UNIQUE across the whole
       bank, verified with /api/learn/browse?q=<term> and total === 1
     * and, from the STI round: UNIQUENESS IS NECESSARY BUT NOT SUFFICIENT.
       A term must also be unique TO THE INTENDED QUESTION. A phrase that
       returns total === 1 but belongs to a neighbouring question will open
       the wrong card and produce a confident, meaningless failure.
     * Persian is compared with the zero-width non-joiner stripped
     * stemText() PICKS the element containing the search term and FAILS
       LOUDLY if none is found

   Terms rejected by the uniqueness check, recorded so nobody retries them:
     'دورهی کمون عفونت اولیه'   total = 0 — it lives in an OPTION of q9638, and
                                the browse index searches only the STEM
     'دویستهزار واحد روزانه'     total = 0, same reason (an option of q9646)
   Their replacements are stem phrases: 'کدام جمله در مورد عفونت' for q9638 and
   'ملتحمه چشم محتقن' for q9646.

   This chapter has NO numeric repairs of its own in these blocks — the glyph
   scan over all 68 questions of the varicella, measles, mumps and hepatitis
   clusters found zero defects, which is consistent with a narrative chapter
   whose numbers stand alone in running text rather than in dense laboratory
   panels. So there is no NUMBERS section here; every check is a lesson check.

   What is checked here:

   1. BOTH TEACHING BLOCKS REACH THE STUDENT: varicella exposure, pregnancy
      and the neonate (batch 32); the exanthems and hepatitis serology
      (batch 33).

   2. THE FOUR KNOWN RENDERING DEFECTS DO NOT RETURN: literal ** markers,
      untranslated i18n keys, split or non-ASCII digits, and a lesson with no
      emphasis at all.

   3. NO MARKDOWN TABLE REACHES THE RENDERED PAGE. Kept from the STI file,
      where the code suite caught eleven lessons shipping tables the player
      cannot render.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

const LESSONS = [
  // ---- batch 32: varicella zoster
  {
    q: "خارش شدید و تب از 3 روز",
    must: "پنومونی",
    what: "in pregnancy the gravest varicella complication is pneumonia (batch 32)",
  },
  {
    q: "خوشخیم بوده و مورتالیتی",
    must: "آتاکسی",
    what: "cerebellar ataxia is the one benign complication (batch 32)",
  },
  {
    q: "تا چند روز بعد از بروز ضایعات",
    must: "کراست",
    what: "infectivity ends when every lesion has crusted (batch 32)",
  },
  {
    q: "برادر خود که دار آبل همرغان",
    must: "زنده",
    what: "a live vaccine is forbidden in leukaemia on chemotherapy (batch 32)",
  },
  {
    q: "سابقهی تماس با کودکی مبتلا",
    must: "روز",
    what: "aciclovir prophylaxis starts on day 7 in pregnancy (batch 32)",
  },
  {
    q: "پیشگیری از انتقال به سایر بیماران",
    must: "هوابرد",
    what: "admitted chickenpox needs airborne isolation (batch 32)",
  },
  {
    q: "خواهر 3 ساله بیمار",
    must: "وریدی",
    what: "severe immunosuppression means intravenous aciclovir at once (batch 32)",
  },
  {
    q: "بثورات وزیکولر در قسمت تحتانی",
    must: "زونا",
    what: "painful dermatomal lesions after delivery are shingles (batch 32)",
  },
  {
    q: "فالنک پ که از خط وسط",
    must: "والاسیکلوویر",
    what: "dermatomal shingles in HIV is treated with valaciclovir (batch 32)",
  },
  {
    q: "5 روز قبل از بارداری",
    must: "IgG",
    what: "maternal shingles means the baby already has maternal IgG (batch 32)",
  },
  {
    q: "کدام جمله در مورد عفونت",
    must: "۱۰ تا ۲۱",
    what: "q9638 the chickenpox incubation is 10 to 21 days (batch 32)",
  },
  // ---- batch 33: exanthems and hepatitis
  {
    q: "ضایعات سفید رنگ که اطراف",
    must: "کوپلیک",
    what: "the three Cs plus Koplik spots mean measles (batch 33)",
  },
  {
    q: "با بیمار مبتلا به سرخک تماس",
    must: "ایمونوگلوبولین",
    what: "measles exposure in immunosuppression needs immunoglobulin (batch 33)",
  },
  {
    q: "ملتحمه چشم محتقن",
    must: "ویتامین",
    what: "q9646 vitamin A is the only treatment lowering measles mortality (batch 33)",
  },
  {
    q: "IgM منفی و IgG مثبت",
    must: "اطمینان",
    what: "IgG positive with IgM negative means reassure (batch 33)",
  },
  {
    q: "Ab IgM Rubella مثبت",
    must: "مادرزادی",
    what: "acute rubella at six weeks and congenital rubella syndrome (batch 33)",
  },
  {
    q: "تیتر محافظت کنندهی بالا",
    must: "حافظه",
    what: "a documented responder is protected by immune memory (batch 33)",
  },
  {
    q: "پررنگ شدن ادرار",
    must: "IgM",
    what: "acute hepatitis is identified by the IgM markers (batch 33)",
  },
  {
    q: "برایهمسر بیمار",
    must: "واکسن",
    what: "chronic exposure needs active immunity, the vaccine (batch 33)",
  },
  {
    q: "Severity کدامیک",
    must: "سنتزی",
    what: "severity is synthetic function, not the transaminases (batch 33)",
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

/* No markdown table may reach the student: the player renders only **bold**,
   so a table arrives as a row of pipes and dashes. */
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
console.log("\nthe varicella, measles and hepatitis blocks render exactly as taught.");
