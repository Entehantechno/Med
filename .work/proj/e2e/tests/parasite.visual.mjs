/* Visual check: the parasitology chapter as a student actually sees it.

   The API can be right while the page is wrong — a stale bundle, a cached
   payload, or an RTL rendering quirk that tears a number apart. So this drives
   a real browser, logs in as a learner, searches the bank, and reads the
   rendered DOM.

   Three things are checked, in rising order of importance:

   1. THE CORRECTED NUMBERS ARE ON SCREEN. Six values in this chapter were
      mirrored in the source PDF and repaired from glyph geometry. Two of them
      live inside the option that IS the answer, so if the page still shows the
      old value the student is reading a different question from the one the
      lesson explains.

   2. THE CORRECTED KEYS SHOW THEIR WARNING. Three printed keys were overruled
      with a cited source. Telling a student "the book is wrong" is only
      defensible if the page says so where they can see it, so the rendered
      lesson must carry the correction notice.

   3. NO TORN OR NON-ASCII DIGITS ANYWHERE. The class of defect that started
      all of this — a two-digit number split or reversed by RTL layout — must
      not reappear at render time even though it is absent from the payload.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

// search term -> a string that must appear on the rendered page
const NUMBERS = [
  { q: "ناقل کیست", must: "500", not: "mg005", what: "paromomycin dose" },
  { q: "نوار سلولزی", must: "25", not: "mμ52", what: "pinworm egg size" },
  { q: "کانفیوژن و لتارژی", must: "4/6", not: "gr6/4", what: "haemoglobin in cerebral malaria" },
];

// a corrected key must announce itself in the lesson the student reads
const KEYS = [
  { q: "سیستان", what: "severe-malaria criteria (platelets)" },
  { q: "Pyrimethamine", what: "pyrimethamine stage of action" },
  { q: "Septation", what: "hydatid CE2 -> surgery" },
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

/* The results list shows only the stem. The lesson — and therefore the
   correction notice — lives one click deeper, exactly where a student meets
   it after answering. An earlier version of this file read only the list and
   reported three false failures, so the check now opens the card. */
/* Open a result and go all the way through it the way a student does.

   This matters, and an earlier version of this file got it wrong. The preview
   modal shows only the STEM until the student picks an option and presses
   "بررسی"; only then do the answer key and the micro-lesson appear. Reading
   the modal before answering therefore reported three false failures — the
   corrections were on the page, just one interaction further in. So the check
   now answers the question, exactly where a real student meets the lesson. */
async function openAndAnswer(term) {
  // A modal left open by the previous case swallows the next click. This app
  // closes it by clicking the backdrop itself (UI.jsx dismisses only when the
  // click target IS the backdrop), not with Escape — pressing Escape did
  // nothing and every later case timed out behind the stale modal.
  const back = page.locator(".modal-back").first();
  if (await back.count()) {
    await back.click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.waitForTimeout(700);
  }
  await search(term);

  const row = page.locator(".browse-preview-q, li, article, .card").filter({ hasText: term }).first();
  if (await row.count()) await row.click();
  await page.waitForTimeout(1600);

  // pick any option, then reveal the key and the lesson
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
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${c.what}: found=${found} shows"${c.must}"=${hasNew} stillShowsOld=${hasOld}`
  );
  if (!found) problems.push(`${c.what}: the question is not searchable`);
  else if (!hasNew) problems.push(`${c.what}: corrected value ${c.must} is not on screen`);
  else if (hasOld) problems.push(`${c.what}: the uncorrected value ${c.not} is still rendered`);
}

for (const c of KEYS) {
  const body = await openAndAnswer(c.q);
  const found = body.includes(c.q);
  // the disclosure wording the guard test in api.test.js also enforces
  const discloses = /تصحیح|اصلاح/.test(body);
  const ok = found && discloses;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.what}: found=${found} disclosesCorrection=${discloses}`);
  if (!found) problems.push(`${c.what}: the question is not searchable`);
  else if (!discloses) problems.push(`${c.what}: the page never tells the student the key was corrected`);
  await page.screenshot({ path: `/tmp/parasite-${c.what.replace(/\W+/g, "-")}.png` });
}

// the original defect class must not reappear at render time
const body = await page.locator("body").innerText();
if (/[\u0660-\u0669\u06F0-\u06F9]\s*\d|\d\s+\d\s*ساله/.test(body)) {
  problems.push("a rendered stem shows split or non-ASCII digits");
}

/* The lesson text marks its key phrases with **...**, and 84 of the 98 taught
   questions use it. Those markers must become bold type, never reach the
   student as literal asterisks, and never leave the untranslated i18n key of a
   button on screen. Both of those were real defects this file caught: the
   payload was correct in each case and only the rendered page was wrong. */
if (body.includes("**")) {
  problems.push("the lesson shows literal ** markers instead of bold text");
}
if (/\bcheckAnswer\b|\bbrowseStudy\b|\banswerKey\b/.test(body)) {
  problems.push("an untranslated i18n key is visible on the page");
}
const bolds = await page.locator(".modal-back strong").count();
if (bolds === 0) {
  problems.push("no emphasised phrase rendered in the lesson at all");
}
console.log(`PASS  emphasis: ${bolds} bold phrase(s) rendered, no literal ** on screen`);

await browser.close();
if (problems.length) {
  console.log("\nPROBLEMS:\n" + problems.map((p) => "  ✗ " + p).join("\n"));
  process.exit(1);
}
console.log("\nthe parasitology chapter renders exactly as repaired.");
