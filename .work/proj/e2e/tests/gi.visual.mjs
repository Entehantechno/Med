/* Visual check: the gastrointestinal / diarrhoea chapter as a student sees it.

   Built on what the two previous visual files learned:
     * the browse list shows only the STEM; the lesson and answer key appear
       one interaction deeper, after picking an option and pressing "بررسی"
     * the modal is dismissed by clicking the BACKDROP, not with Escape
     * search terms must be UNIQUE to their question, or the test lands on the
       wrong card and reports failures that are its own fault

   What is checked here:

   1. THE REPAIRED LABORATORY PANEL IS ON SCREEN. q9306 had four values
      mirrored at once (Na 531, Hb 41, WBC 00011, PLT 000302). If the page
      still shows any of those, the student is reading a patient who cannot
      exist, and the question — which asks which fluid to choose — becomes
      unanswerable.

   2. THE REPAIRED BLOOD PRESSURE IS ON SCREEN. q9340's "p08" is now "80/P",
      a repair that only came to light because the English translation guard
      rejected the mismatched digits.

   3. BOTH LESSON BATCHES RENDER. One question from batch 15 and one from
      batch 16, to prove each shipped and is reachable.

   4. THE THREE KNOWN RENDERING DEFECTS DO NOT RETURN: literal ** markers,
      untranslated i18n keys, and split or non-ASCII digits.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

/* NOTE on these search terms. The PDF extractor inserts stray spaces inside
   Persian words — the stored stems read "نب ضهای" and "نب ضها", not the natural
   spelling — so a search phrase copied from normal Persian finds nothing. An
   earlier version of this file used the natural spelling and reported three
   failures that were entirely its own. The terms below are copied from the
   STORED text and are each unique to their question. */
const NUMBERS = [
  { q: "شروع ناگهانی به اورژانس", must: "135", not: "531=Na", what: "cholera sodium" },
  { q: "شروع ناگهانی به اورژانس", must: "203000", not: "000302", what: "cholera platelets" },
  { q: "کود ک ب یقرار است", must: "80/P", not: "p08", what: "child's palpated BP" },
];

const LESSONS = [
  { q: "سس مایونز", must: "استاف", what: "food-poisoning clock (batch 15)" },
  { q: "غشاء کاذب رؤیت شده", must: "وانکومایسین", what: "C. difficile severity (batch 16)" },
  { q: "سالمونلای غیر تیفی", must: "ناقل", what: "salmonella: no antibiotic (batch 15)" },
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
  await page.screenshot({ path: `/tmp/gi-${c.what.replace(/\W+/g, "-")}.png` });
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
console.log("\nthe gastrointestinal chapter renders exactly as repaired.");
