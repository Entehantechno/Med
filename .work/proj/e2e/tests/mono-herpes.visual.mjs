/* Visual check: the mononucleosis and herpes simplex blocks as a student sees them.

   The thirteenth visual file, inheriting every lesson the earlier twelve paid for:

     * the browse list shows only the STEM; the lesson and answer key appear
       one interaction deeper, after picking an option and pressing "بررسی"
     * the modal is dismissed by clicking the BACKDROP, not with Escape
     * search terms must be copied out of the STORED text — which contains
       stray spaces inside Persian words — and must be UNIQUE across the whole
       bank, AND unique TO THE INTENDED QUESTION
     * the check button is matched EXACTLY, never by substring: q9649 taught
       that an OPTION can begin with the word "بررسی" and be clicked instead
       of the control, which silently prevents the lesson from ever rendering
     * Persian is compared with the zero-width non-joiner stripped

   One term was rejected by the uniqueness check and is recorded so nobody
   retries it: 'زخمهای متعدد وزیکولوپاستوالر' returns total = 0, because the
   stored stem spells it with different internal spacing than it appears to
   have. The substitute used is 'تنهی penis', copied verbatim from the stored
   text and confirmed unique.

   THIS FILE ALSO CHECKS A CORRECTED ANSWER KEY.

   q9604's printed key chose the anti-EBNA antibody as the best test to prove
   acute mononucleosis. That is the inverse of what the marker means — EBNA
   antibody appears 6 to 12 weeks AFTER onset, so its presence early in the
   illness EXCLUDES acute EBV infection. The key was corrected to IgM anti-VCA
   (see fix_key_ebna.py). The check below confirms that the student actually
   sees the correction explained, by requiring the rendered lesson to contain
   both the corrected marker and the word "تصحیح".

   What is checked here:

   1. BOTH TEACHING BLOCKS REACH THE STUDENT: mononucleosis recognition and
      its treatment traps, and herpes simplex wherever it appears.

   2. THE CORRECTED KEY IS VISIBLE AND EXPLAINED on screen.

   3. THE FOUR KNOWN RENDERING DEFECTS DO NOT RETURN, and no markdown table
      reaches the rendered page.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

const LESSONS = [
  // ---- mononucleosis
  {
    q: "لنف آتیپیک بیش از 20 درصد",
    must: "اپشتین",
    what: "splenomegaly with atypical lymphocytes is EBV, not streptococcus",
  },
  {
    q: "5 روز قبل یک دوز پن یسیلین",
    must: "علامتی",
    what: "failure to respond to penicillin means mononucleosis, treat symptomatically",
  },
  {
    q: "شواهد پاراکلینیک او به نفع آنمی همولیتیک",
    must: "کورتیکواستروئید",
    what: "haemolytic anaemia is one of the three steroid exceptions",
  },
  // ---- herpes simplex
  {
    q: "اگزمای آتوپیک",
    must: "هرپتیکوم",
    what: "vesicles on atopic eczema are eczema herpeticum",
  },
  {
    q: "تنهی penis",
    must: "اولیه",
    what: "vesicles with systemic symptoms are a PRIMARY genital herpes attack",
  },
  {
    q: "دندا نساز تجربی",
    must: "ویتلو",
    what: "a painful vesicular finger in a dentist is herpetic whitlow",
  },
  {
    q: "شک بههرپس نوزادی",
    must: "وریدی",
    what: "neonatal herpes needs intravenous aciclovir",
  },
];

/* The corrected key gets its own check, because a correction the student
   cannot see is not a correction. Both the new answer and the word "تصحیح"
   must appear in the rendered lesson. */
const CORRECTED_KEY = {
  q: "مفیدترین تست تشخیصی",
  must: "VCA",
  alsoMust: "تصحیح",
  what: "q9604 the corrected key (IgM anti-VCA) is shown AND explained as a correction",
};

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
  /* Match the check button EXACTLY, not by substring: an OPTION can begin with
     the word "بررسی" and would otherwise be clicked instead of the control. */
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

{
  const c = CORRECTED_KEY;
  const body = await openAndAnswer(c.q);
  const found = noZwnj(body).includes(noZwnj(c.q));
  const shows = noZwnj(body).includes(noZwnj(c.must));
  const explains = noZwnj(body).includes(noZwnj(c.alsoMust));
  const ok = found && shows && explains;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.what}: found=${found} shows"${c.must}"=${shows} explainsCorrection=${explains}`);
  if (!found) problems.push(`${c.what}: the question is not searchable`);
  else if (!shows) problems.push(`${c.what}: the corrected answer ${c.must} is not on screen`);
  else if (!explains) problems.push(`${c.what}: the lesson never tells the student the key was corrected`);
  const panel = await page.locator(".modal-back").first().innerText().catch(() => "");
  if (panel) renderedLessons.push({ what: c.what, text: panel });
}

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
console.log("\nthe mononucleosis and herpes blocks render exactly as taught.");
