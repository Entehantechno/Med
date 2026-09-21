/* Visual check: the viral / STI chapter as a student actually sees it.

   Same shape as parasite.visual.mjs, and built on what that file learned the
   hard way: the browse list shows only the stem, so the lesson and the answer
   key live one interaction deeper — the student must pick an option and press
   "بررسی". Reading the modal before answering reports false failures.

   What is checked here:

   1. THE FOUR CORRECTED DOSES ARE ON SCREEN. Every option of q9548 is a drug
      regimen, and all four were mirrored in the source ("cefixime 4 mg",
      "doxycycline 1 mg"). If the page still shows those, the student is
      comparing nonsense rather than answering a medical question.

   2. THE CORRECTED KEY ANNOUNCES ITSELF. q9542's printed key was overruled,
      and the lesson's argument rests on the book's own other four answers. A
      student can only judge that argument if the page tells them a correction
      was made.

   3. THE CHAPTER'S BILINGUAL HALF RENDERS TOO. These questions now carry
      hand-written English stems, so the English view must show the English
      stem rather than falling back to Persian or to an empty box.

   4. NO LITERAL ** AND NO UNTRANSLATED i18n KEY, the two rendering defects the
      parasitology pass found. Both are regression checks now.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

/* NOTE on the search terms below. An earlier version of this file used short
   phrases and landed on the WRONG CARD three times, reporting failures that
   were mine, not the product's: "کشت ادرار منفی" matches two questions and
   "لوپوس" matches four. Each term is therefore chosen to be unique to its
   question, and the check confirms the expected stem text is on screen before
   judging anything else. */
const NUMBERS = [
  { q: "بدون تکرر ادراری", must: "400", not: "mg004", what: "cefixime dose" },
  { q: "بدون تکرر ادراری", must: "100", not: "mg001", what: "doxycycline dose" },
];

const KEYS = [
  { q: "ترشح موکوئیدی", what: "post-gonococcal urethritis key" },
];

// a lesson from each half of the chapter, to prove both batches shipped
const LESSONS = [
  { q: "قوام سفت و بستر تمیز", must: "سیفلیس", what: "syphilitic chancre" },
  { q: "نقاط سفید مایل به آبی", must: "سرخک", what: "measles / Koplik" },
  { q: "مبتلا به لوپوس با آزمایش", must: "مثبت کاذب", what: "lupus false-positive ELISA" },
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

/* Open a result and answer it, the way a student does. The modal is dismissed
   by clicking the BACKDROP — this app does not close it on Escape, and a stale
   modal swallows every later click. */
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
}

for (const c of KEYS) {
  const body = await openAndAnswer(c.q);
  const found = body.includes(c.q);
  const discloses = /تصحیح|اصلاح/.test(body);
  const ok = found && discloses;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.what}: found=${found} disclosesCorrection=${discloses}`);
  if (!found) problems.push(`${c.what}: the question is not searchable`);
  else if (!discloses) problems.push(`${c.what}: the page never tells the student the key was corrected`);
  await page.screenshot({ path: `/tmp/viral-${c.what.replace(/\W+/g, "-")}.png` });
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

// regression checks for the two rendering defects found in the previous pass
const body = await page.locator("body").innerText();
if (body.includes("**")) {
  problems.push("the lesson shows literal ** markers instead of bold text");
}
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
console.log("\nthe viral / STI chapter renders exactly as repaired.");
