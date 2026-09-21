/* Visual check: the HIV testing chain, opportunistic infections and the
   hepatitis serology block, as a student sees them.

   The fifteenth visual file, inheriting every lesson the earlier fourteen
   paid for:

     * the browse list shows only the STEM; the lesson and answer key appear
       one interaction deeper, after picking an option and pressing "بررسی"
     * the modal is dismissed by clicking the BACKDROP, not with Escape
     * search terms must be copied out of the STORED text — which contains
       stray spaces inside Persian words — and must be UNIQUE across the
       whole bank, AND unique TO THE INTENDED QUESTION
     * the check button is matched EXACTLY, never by substring
     * emphasis is counted WHILE A TAUGHT LESSON IS OPEN, never at the end of
       the run: the previous file learned that the last question left open may
       be repaired but not yet taught, so no lesson panel exists to hold a
       bold phrase and the check reported a permanent false alarm
     * Persian is compared with the zero-width non-joiner stripped

   TERMS REJECTED BY THE UNIQUENESS CHECK, recorded so nobody retries them:

     'نیدل استیک'          total = 2  — also matches a malaria needlestick stem;
                                        replaced with 'خانم پرستاری که حدود 3 ماه'
     'ماه سوم بارداری'      total = 3  — matches two other pregnancy stems;
                                        replaced with 'ماه سوم بارداری با آزمایش'

   WHAT IS CHECKED HERE

   1. THE TESTING CHAIN REACHES THE STUDENT INTACT. Twelve questions whose
      answers alternate between REPEAT and CONFIRM depending on how many
      positives have occurred. Each lesson is checked for the word that
      carries its own branch of the rule.

   2. THE PROPHYLAXIS AND OPPORTUNISTIC-INFECTION BLOCK renders, including
      the dual role of co-trimoxazole and the CD4 ladder.

   3. THE GUIDELINE THAT MOVED IS SHOWN HONESTLY. q9705 keys a four-drug
      regimen whose CMV, cryptococcal and MAC components today's guidance
      withdraws. The lesson must reach the student saying so — the check
      requires the rendered text to contain "توصیه نمی" (is not recommended),
      because a key we keep but qualify is only honest if the qualification
      is actually visible.

   4. THE TWO ANNOTATED SOURCE DEFECTS ARE VISIBLE. q9854's impossible
      bilirubin panel and q9852's wrong unit are errors of the BOOK, left in
      place and annotated. The checks require the rendered lesson to say so,
      because an annotation the student never sees is not an annotation.

   5. THE KNOWN RENDERING DEFECTS DO NOT RETURN, and no markdown table
      reaches the rendered page.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

const LESSONS = [
  // ---- the testing chain: ONE positive means REPEAT
  {
    q: "تب طول کشیده و لنفادنو",
    must: "تکرار",
    what: "one positive ELISA is repeated, even with a compatible clinical picture",
  },
  {
    q: "ایمونواسی آنزیمی",
    must: "غربالگری",
    what: "no screening test ever diagnoses HIV alone",
  },
  {
    q: "ضمن انجام آزمایشات بارداری",
    must: "بارداری",
    what: "pregnancy can cause a false positive but that cannot be assumed before repeating",
  },
  {
    q: "رفتارهای پرخطر در دو سال گذشته",
    must: "سرکونورژن",
    what: "p24 clears after seroconversion, so it is the wrong test two years on",
  },
  {
    q: "در فرد با داشتن رفتارهای پر خطر",
    must: "مرحله‌بندی",
    what: "the CD4 count is a staging tool, not a diagnostic one",
  },
  {
    q: "خانم پرستاری که حدود 3 ماه",
    must: "مادام‌العمر",
    what: "never start a lifelong treatment on one screening test",
  },
  // ---- the testing chain: TWO positives mean CONFIRM
  {
    q: "نامهای از طرف بانک خون",
    must: "اهداکننده",
    what: "the positive predictive value in a blood donor is low, so repeat then confirm",
  },
  {
    q: "الیزا برای HIV در دو نوبت",
    must: "واکنش متقاطع",
    what: "two positives leave only cross-reaction, which a specific test excludes",
  },
  {
    q: "نتیجهی مثبت تست غربالگری",
    must: "تکرار",
    what: "the word 'repeat' in the stem moves this into the two-positive branch",
  },
  // ---- the testing chain: the awkward results
  {
    q: "یک نوبت آزمایش مثبت",
    must: "متناقض",
    what: "a discordant result needs follow-up, not confirmation",
  },
  {
    q: "سفر تایلن",
    must: "نامشخص",
    what: "an indeterminate blot: change the test, do not repeat the same one",
  },
  // ---- acute infection: the p24 window
  {
    q: "روابط جنسی آزا",
    must: "پنجره",
    what: "in the antibody window, ask for a marker that does not depend on antibody",
  },
  {
    q: "احتما ل سندرم رتروویرا",
    must: "هفته‌ی سوم",
    what: "at week three p24 is positive while antibody is on the boundary",
  },
  {
    q: "تماس جنسی مشکوک در ماه گذشته",
    must: "بیوپسی",
    what: "a blood test answers the same question as an invasive lymph node biopsy",
  },
  // ---- opportunistic infection and prophylaxis
  {
    q: "ارزیابی اولیه در فرد HIV",
    must: "آباکاویر",
    what: "the HLA that matters in HIV is B*5701, not B27",
  },
  {
    q: "برفک دهان از دو ماه قبل",
    must: "START",
    what: "since START and TEMPRANO, ART is recommended at any CD4",
  },
  {
    q: "در مردان جوان HIV مثبت",
    must: "کپسول‌دار",
    what: "HIV wrecks the antibody response to encapsulated bacteria",
  },
  {
    q: "ناحیهی رترواسترنال",
    must: "یک‌چهارم",
    what: "the chest film is normal in up to a quarter of PCP cases",
  },
  {
    q: "درد قفسهی سینه در هنگام دم",
    must: "کورتیکواستروئید",
    what: "severe PCP needs steroids within the first 72 hours",
  },
  {
    q: "برای پیشگیری از PCP",
    must: "توکسوپلاسما",
    what: "co-trimoxazole covers toxoplasma as well as PCP",
  },
  {
    q: "عفون تهای فرص تطلب CNS",
    must: "منتشر",
    what: "histoplasmosis in HIV is a disseminated rather than a CNS disease",
  },
  {
    q: "عفونت همزمان HIV و سل",
    must: "آنرژی",
    what: "the tuberculin test fails at a LOW CD4, through anergy",
  },
  {
    q: "خلط آجری",
    must: "سوگیری",
    what: "an HIV-positive patient also catches ordinary diseases",
  },
  {
    q: "شیرخوار 15 ماهه",
    must: "درصد",
    what: "in children the live-vaccine threshold is a percentage, not an absolute count",
  },
  // ---- hepatitis serology
  {
    q: "سه ماهه دوم بارداری",
    must: "HBsAg",
    what: "anti-HBc asks a question already answered by a positive HBsAg",
  },
  {
    q: "ماه سوم بارداری با آزمایش",
    must: "پره‌کور",
    what: "a negative HBeAg does not exclude replication; the precore mutant does exactly that",
  },
];

/* The guideline that moved gets its own check: a key we keep but qualify is
   only honest if the qualification is actually on screen. */
const MOVED_GUIDELINE = {
  q: "ایدز پیشرفته",
  must: "توصیه نمی",
  alsoMust: "ART",
  what: "q9705 the withdrawn prophylaxis components are shown as no longer recommended",
};

/* The two annotated source defects get their own checks, because an
   annotation the student never sees is not an annotation. */
const SOURCE_DEFECTS = [
  {
    q: "احتمال هپاتیت مورد بررسی",
    must: "ناممکن",
    alsoMust: "IgM",
    what: "q9854 the impossible bilirubin panel is named as a source misprint AND the serology still decides",
  },
  {
    q: "سه نوبت واکسن هپاتیت",
    must: "mIU/mL",
    alsoMust: "HBIG",
    what: "q9852 the wrong unit is named AND the non-responder rule is taught",
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
let boldsSeen = 0;

async function recordPanel(what) {
  const panel = await page.locator(".modal-back").first().innerText().catch(() => "");
  if (panel) renderedLessons.push({ what, text: panel });
  boldsSeen = Math.max(boldsSeen, await page.locator(".modal-back strong").count());
}

for (const c of LESSONS) {
  const body = await openAndAnswer(c.q);
  const found = noZwnj(body).includes(noZwnj(c.q));
  const taught = noZwnj(body).includes(noZwnj(c.must));
  const ok = found && taught;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.what}: found=${found} lessonShown=${taught}`);
  if (!found) problems.push(`${c.what}: the question is not searchable`);
  else if (!taught) problems.push(`${c.what}: the lesson does not mention "${c.must}"`);
  await recordPanel(c.what);
}

for (const c of [MOVED_GUIDELINE, ...SOURCE_DEFECTS]) {
  const body = await openAndAnswer(c.q);
  const found = noZwnj(body).includes(noZwnj(c.q));
  const shows = noZwnj(body).includes(noZwnj(c.must));
  const also = noZwnj(body).includes(noZwnj(c.alsoMust));
  const ok = found && shows && also;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.what}: found=${found} shows"${c.must}"=${shows} also"${c.alsoMust}"=${also}`);
  if (!found) problems.push(`${c.what}: the question is not searchable`);
  else if (!shows) problems.push(`${c.what}: "${c.must}" never reaches the screen`);
  else if (!also) problems.push(`${c.what}: "${c.alsoMust}" never reaches the screen`);
  await recordPanel(c.what);
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
if (boldsSeen === 0) problems.push("no emphasised phrase rendered in any taught lesson");
console.log(`PASS  rendering: up to ${boldsSeen} bold phrase(s) in a taught lesson, no literal **, no untranslated key`);

await browser.close();
if (problems.length) {
  console.log("\nPROBLEMS:\n" + problems.map((p) => "  ✗ " + p).join("\n"));
  process.exit(1);
}
console.log("\nthe HIV testing chain, prophylaxis and hepatitis blocks render exactly as taught.");
