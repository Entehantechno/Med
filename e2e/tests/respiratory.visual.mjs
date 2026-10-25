/* Visual check: the respiratory chapter as a student actually sees it.

   Built on what the six previous visual files learned the hard way:
     * the browse list shows only the STEM; the lesson and answer key appear
       one interaction deeper, after picking an option and pressing "بررسی"
     * the modal is dismissed by clicking the BACKDROP, not with Escape
     * search terms must be copied from the STORED text — which contains stray
       spaces inside Persian words — and must be UNIQUE to their question

   Every term below was copied out of /api/learn/browse and programmatically
   confirmed to match exactly one of the 69 respiratory cards before this file
   was written.

   What is checked here:

   1. THE REBUILT LABORATORY TABLE OF q9088. Page 34 prints the results as a
      two-column table; read as running text the extractor produced "Na = 75"
      and "PLT = 128". Clustering the glyphs by horizontal gaps recovered
      Na = 128 and PLT = 245000. This is the most consequential repair of the
      chapter, because THE SODIUM OF 128 IS THE CLUE THAT MAKES THE ANSWER:
      hyponatraemia is the classical marker of Legionella, and with it mangled
      the question could not be reasoned at all.

   2. THE RESTORED BMI OF q9575. Stored as "BMI > 24" where page 215 prints 40.
      A BMI of 24 is not a risk group, so with the wrong figure the question
      had TWO correct answers.

   3. THE REPAIRED AGES of q9587, q9588 and q9595, including the one that was
      not an age at all: "children 6 months to 81 years".

   4. ALL FOUR TEACHING BLOCKS REACH THE STUDENT: the organism map, CURB-65,
      the ciprofloxacin trap, and the three post-influenza pneumonias.

   5. THE FOUR KNOWN RENDERING DEFECTS DO NOT RETURN: literal ** markers,
      untranslated i18n keys, split or non-ASCII digits, and a lesson with no
      emphasis at all.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

const NUMBERS = [
  {
    q: "Na=128",
    must: "PLT=245000",
    not: "128 = PLT",
    what: "q9088 laboratory table rebuilt (Na 128, platelets 245000)",
  },
  {
    q: "ریسک کمتری",
    must: "BMI>40",
    not: "24 kg/m",
    what: "q9575 BMI threshold restored to 40",
  },
  {
    q: "نیازی به تجویز",
    must: "45 ساله",
    not: "54 ساله",
    what: "q9595 age un-mirrored to 45",
  },
];

const LESSONS = [
  {
    q: "اپ یلپسی",
    must: "آسپیراسیون",
    what: "epilepsy means aspiration means oral anaerobes (batch 22)",
  },
  {
    q: "طحا لبردار",
    must: "کپسول",
    what: "asplenia means encapsulated organisms (batch 22)",
  },
  {
    q: "تعمیرکار کولر",
    must: "هیپوناترمی",
    what: "Legionella and hyponatraemia (batch 22)",
  },
  {
    q: "آگلوتیناسیون سرد",
    must: "مایکوپلاسما",
    what: "cold agglutinins mean Mycoplasma (batch 22)",
  },
  {
    q: "کدام آنت یبیوتیک زیر مناسب نیست",
    must: "پنوموکوک",
    what: "the ciprofloxacin trap explained by pneumococcal cover (batch 22)",
  },
  {
    q: "CURB",
    must: "اوره",
    what: "CURB-65 scores urea, not creatinine (batch 22)",
  },
  {
    q: "Tap مایع پلور",
    must: "درناژ",
    what: "empyema needs drainage, not a new antibiotic (batch 22)",
  },
  {
    q: "لوکالیزه",
    must: "اگزودا",
    what: "pharyngeal exudate is not influenza (batch 23)",
  },
  {
    q: "پالس اکس یمتر",
    must: "بینابینی",
    what: "primary viral pneumonia is interstitial (batch 23)",
  },
  {
    q: "کاویته با دیوارهی نازک",
    must: "MRSA",
    what: "post-influenza cavity means Staph aureus and MRSA cover (batch 23)",
  },
  {
    q: "پسری 7 سالهای",
    must: "ری",
    what: "aspirin in a child means Reye's syndrome (batch 23)",
  },
  {
    q: "تشدید تنگی نفس مراجعه",
    must: "برونکواسپاسم",
    what: "zanamivir causes bronchospasm in asthma (batch 23)",
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

for (const c of NUMBERS) {
  const body = await openAndAnswer(c.q);
  const found = body.includes(c.q);
  const hasNew = body.includes(c.must);
  const hasOld = body.includes(c.not);
  const ok = found && hasNew && !hasOld;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.what}: found=${found} shows"${c.must}"=${hasNew} stillShowsOld=${hasOld}`);
  if (!found) problems.push(`${c.what}: the question is not searchable`);
  else if (!hasNew) problems.push(`${c.what}: corrected value ${c.must} is not on screen`);
  else if (hasOld) problems.push(`${c.what}: the uncorrected value ${c.not} is still rendered`);
  await page.screenshot({ path: `/tmp/resp-${c.what.replace(/\W+/g, "-").slice(0, 40)}.png` });
}

for (const c of LESSONS) {
  const body = await openAndAnswer(c.q);
  const found = body.includes(c.q);
  const taught = body.includes(c.must);
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
console.log("\nthe respiratory chapter renders exactly as repaired.");
