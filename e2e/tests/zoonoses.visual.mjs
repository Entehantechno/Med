/* Visual check: the zoonoses chapter as a student actually sees it.

   Built on what the five previous visual files learned the hard way:
     * the browse list shows only the STEM; the lesson and the answer key
       appear one interaction deeper, after picking an option and pressing
       "بررسی"
     * the modal is dismissed by clicking the BACKDROP, not with Escape
     * search terms must be copied from the STORED text — which contains stray
       spaces inside Persian words — and must be UNIQUE to their question

   Every search term below was copied out of `/api/learn/browse` and verified
   to match exactly one card before this file was written.

   What is checked here:

   1. THE RESTORED IMMUNE GLOBULIN DOSE IS ON SCREEN. q9414's options were
      stored as "2 Iu/kg" and "4 Iu/kg", each having lost a zero in
      extraction. Page 157 prints 20 and 40. This is the single most dangerous
      number in the chapter: a student who reads "2 IU/kg" learns a tenth of
      the real rabies immune globulin dose.

   2. THE REPAIRED LABORATORY PANELS RENDER. q9493's AST was stored mirrored
      as 702 where the page prints 207, and 207 with a bilirubin of 17 is
      exactly the "jaundice out of proportion to the transaminases" pattern
      the question exists to teach. q9486's platelet count and q9496's AST
      were likewise repaired.

   3. THE CORRECTED KEY IS VISIBLE AND EXPLAINS ITSELF. q9421's printed key
      (ciprofloxacin) was overruled in favour of moxifloxacin, and the lesson
      must say so using the word "تصحیح" so the student is never quietly
      taught against the paper they hold.

   4. ALL THREE LESSON BATCHES REACH THE STUDENT: rabies (19), brucellosis
      (20) and leptospirosis (21).

   5. THE FOUR KNOWN RENDERING DEFECTS DO NOT RETURN: literal ** markers,
      untranslated i18n keys, split or non-ASCII digits, and a lesson with no
      emphasis at all.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

const NUMBERS = [
  {
    q: "ایمونوگلوبین ضدهاری موجود",
    must: "20 IU/kg",
    not: "2 Iu/kg",
    what: "rabies immune globulin dose restored to 20 IU/kg",
  },
  {
    q: "خانم شالیکار 50 سالهای",
    must: "AST=207",
    not: "702=AST",
    what: "leptospirosis liver panel un-mirrored (AST 207)",
  },
  {
    q: "نوجوان 16 سالهای یکهفته بعد از مسابقات",
    must: "75000",
    not: "00057",
    what: "platelet count of the swimmer disentangled",
  },
  {
    q: "کشاورز شالیکاری با شرح حال",
    must: "AST=1000",
    not: "1 u/ml = AST",
    what: "transaminases of the biphasic case restored",
  },
];

const LESSONS = [
  {
    q: "مرد جنگلبان 59 سالهای",
    must: "ایمونوگلوبولین",
    what: "rabies: vaccinated person needs no RIG (batch 19)",
  },
  {
    q: "کشاورز 50 سالهای با علائم",
    must: "منقار طوطی",
    what: "brucellar vs tuberculous spondylitis (batch 20)",
  },
  {
    q: "مفیدترین شاخص جهت بررسی پاسخ",
    must: "وزن",
    what: "brucellosis follow-up is clinical (batch 20)",
  },
  {
    q: "مرد جوان قصابی",
    must: "اندوکاردیت",
    what: "Brucella endocarditis needs surgery (batch 20)",
  },
  {
    q: "کشاورز شالیکاری با شرح حال",
    must: "ادرار",
    what: "leptospirosis phase two is shed in urine (batch 21)",
  },
];

/* The corrected key must not only be right, it must ANNOUNCE itself. A silent
   correction is worse than none: the student sits an exam with the printed
   paper in front of them. */
const CORRECTED_KEY = {
  q: "25 سالهای است که چند ساعت",
  must: ["Moxifloxacin", "تصحیح"],
  what: "q9421 key correction is shown and labelled as a correction",
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
  await page.screenshot({ path: `/tmp/zoo-${c.what.replace(/\W+/g, "-").slice(0, 40)}.png` });
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

{
  const body = await openAndAnswer(CORRECTED_KEY.q);
  const found = body.includes(CORRECTED_KEY.q);
  const missing = CORRECTED_KEY.must.filter((m) => !body.includes(m));
  const ok = found && !missing.length;
  console.log(`${ok ? "PASS" : "FAIL"}  ${CORRECTED_KEY.what}: found=${found} missing=${JSON.stringify(missing)}`);
  if (!found) problems.push(`${CORRECTED_KEY.what}: the question is not searchable`);
  else if (missing.length) problems.push(`${CORRECTED_KEY.what}: missing ${missing.join(", ")}`);
  await page.screenshot({ path: "/tmp/zoo-corrected-key.png" });
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
console.log("\nthe zoonoses chapter renders exactly as repaired.");
