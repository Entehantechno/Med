/* Visual check: the tuberculosis chapter as a student actually sees it.

   Built on what the three previous visual files learned the hard way:
     * the browse list shows only the STEM; the lesson and answer key appear
       one interaction deeper, after picking an option and pressing "بررسی"
     * the modal is dismissed by clicking the BACKDROP, not with Escape
     * search terms must be copied from the STORED text, which contains stray
       spaces inside Persian words, and must be unique to their question

   What is checked here:

   1. THE REPAIRED PPD IS ON SCREEN. q9266's tuberculin reading was stored as
      71 mm — an induration no human arm can produce — where the page prints
      17. This is the chapter where a single millimetre changes the management,
      so the rendered value matters more than in any previous chapter.

   2. THE OTHER REPAIRED NUMBERS RENDER: the 12 mm PPD of q9267 and the 10 kg
      weight loss of q9225.

   3. BOTH LESSON BATCHES REACH THE STUDENT. One question from batch 17
      (drug toxicity) and one from batch 18 (latent TB), to prove each shipped.

   4. THE THREE KNOWN RENDERING DEFECTS DO NOT RETURN: literal ** markers,
      untranslated i18n keys, and split or non-ASCII digits.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

const NUMBERS = [
  { q: "جهت استخدام در بانک", must: "17", not: "mm71", what: "bank screen PPD" },
  { q: "لوپوس اریتروماتوزیس", must: "12", not: "mm21", what: "lupus patient PPD" },
  { q: "خلط خونی و کاهش وزن حدود", must: "10", not: "Kg01", what: "weight loss in kg" },
];

const LESSONS = [
  { q: "انگشت شست پای", must: "پیرازینامید", what: "gout -> pyrazinamide (batch 17)" },
  { q: "پیشگیری دارویی با ایزونیازید", must: "آستانه", what: "PPD thresholds (batch 18)" },
  { q: "کودک 5 سالهی وی", must: "پروفیلاکسی", what: "child contact prophylaxis (batch 18)" },
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
  await page.screenshot({ path: `/tmp/tb-${c.what.replace(/\W+/g, "-")}.png` });
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
console.log("\nthe tuberculosis chapter renders exactly as repaired.");
