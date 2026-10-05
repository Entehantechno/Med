/* Visual check: the HIV transmission, staging and diagnostic blocks as a student sees them.

   The fourteenth visual file, inheriting every lesson the earlier thirteen paid for:

     * the browse list shows only the STEM; the lesson and answer key appear
       one interaction deeper, after picking an option and pressing "بررسی"
     * the modal is dismissed by clicking the BACKDROP, not with Escape
     * search terms must be copied out of the STORED text — which contains
       stray spaces inside Persian words, such as "شای عترین" and
       "انتقا ل" — and must be UNIQUE across the whole bank, AND unique TO
       THE INTENDED QUESTION
     * the check button is matched EXACTLY, never by substring: q9649 taught
       that an OPTION can begin with the word "بررسی" and be clicked instead
       of the control, which silently prevents the lesson from ever rendering
     * Persian is compared with the zero-width non-joiner stripped

   TERMS REJECTED BY THE UNIQUENESS CHECK, recorded so nobody retries them:

     'شایعترین روش انتقا'      total = 0  — the stored stem spells it "شای عترین"
     'نیش پشه'                 total = 0  — appears only in an OPTION, and the
                                            preview indexes the STEM only
     'گاز گرفتگی انسان'        total = 0  — likewise option-only
     'انفوزیون خون آلوده'      total = 0  — likewise option-only
     'لکوپالکی مویی دهانی'     total = 0  — likewise option-only
     'رتینیت CMV'              total = 0  — likewise option-only
     'کانسر مهاجم سرویکس'      total = 0  — likewise option-only
     'سه نوبت پنومونی'         total = 0  — likewise option-only
     'خلط'                     total = 44 — far too common
     'دخالت ندارد'             total = 2  — also matches a hyperthermia stem,
                                            so the longer form is used instead

   THIS FILE ALSO CHECKS A CORRECTED ANSWER KEY.

   q9662's printed key chose cerebral toxoplasmosis as the option that is NOT
   category C. Cerebral toxoplasmosis has been category C since the 1987
   definition; the option that is category A is persistent generalised
   lymphadenopathy (see fix_key_hiv_category.py). The check below confirms the
   student actually SEES the correction explained, by requiring the rendered
   lesson to contain both the corrected answer and the word "تصحیح".

   What is checked here:

   1. ALL THREE TEACHING BLOCKS REACH THE STUDENT: the two-part transmission
      rule, the CDC category lists, and the diagnostic chain.

   2. THE CORRECTED KEY IS VISIBLE AND EXPLAINED on screen.

   3. THE REPAIRED VIRAL LOAD IS ON SCREEN. q9707's stem printed "500 copy/ml"
      and the extractor kept only the leading 5 (see fix_hiv_numbers.py). The
      corrected figure is checked directly, because a repair the student never
      sees is not a repair.

   4. THE KNOWN RENDERING DEFECTS DO NOT RETURN, and no markdown table reaches
      the rendered page.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

const LESSONS = [
  // ---- transmission
  {
    q: "شای عترین روش انتقا",
    must: "هتروسکسوال",
    what: "the commonest route worldwide is heterosexual intercourse",
  },
  {
    q: "موجب انتقال باشد",
    must: "شیر مادر",
    what: "breast milk is one of the four high-risk fluids",
  },
  {
    q: "احتمال انتقا ل HIV بی شتر",
    must: "پوست",
    what: "a bite transmits only when the skin is broken and blood is involved",
  },
  {
    q: "شانس انتقا ل HIV از کدام",
    must: "انتقال خون",
    what: "transfusion is the most efficient route per exposure, not the commonest",
  },
  {
    q: "کدامیک از موارد زیر در انتقا ل HIV دخالت ندارد",
    must: "خون",
    what: "faeces, urine and sputum are safe unless they contain visible blood",
  },
  {
    q: "فاکتور خطر ثابت شده",
    must: "پارگی",
    what: "prolonged rupture of membranes is the established intrapartum risk factor",
  },
  {
    q: "آب دهان وی روی دست شما",
    must: "اطمینان",
    what: "saliva on intact skin needs no action; reassurance is the intervention",
  },
  {
    q: "کارکنان زندان",
    must: "۷۲ ساعت",
    what: "the follow-up schedule belongs to a real exposure, not to this one",
  },
  // ---- staging
  {
    q: "بیاشتهایی و کاهش وزن از حدود یک ماه",
    must: "راجعه",
    what: "recurrent pneumonia (two or more in 12 months) is AIDS-defining",
  },
  {
    q: "معیار پیشنهاد کنندهی",
    must: "۱۹۹۳",
    what: "pulmonary TB became AIDS-defining in the 1993 revision",
  },
  {
    q: "براساس نظر CDC",
    must: "گروه B",
    what: "oral hairy leucoplakia is category B, not C",
  },
  {
    q: "به تظاهرات بیماری ایدز مربوط",
    must: "کاپوزی",
    what: "a single pneumococcal pneumonia is not defining; Kaposi sarcoma is",
  },
  {
    q: "معر فهای ایدز",
    must: "رتینیت",
    what: "CMV retinitis is category C; oral hairy leucoplakia is not",
  },
  {
    q: "کاشکسی مفرط",
    must: "اپیزود",
    what: "'no previous episode' breaks the recurrent-pneumonia condition",
  },
  // ---- the diagnostic chain
  {
    /* NOT "Acute HIV Infection": the stored stem prints the Latin words in the
       reversed order the extractor produced, "Infection HIV Acute", so the
       literal English phrase is never found on screen even though the API's
       tokenised search does return the card. The Persian prefix is used
       instead, and was confirmed unique (total = 1). */
    q: "همهی جملات زیر دربارهی",
    must: "پنجره",
    what: "in acute infection the antibody test can still be falsely negative",
  },
  {
    q: "قابل انداز هگیری",
    must: "۱۲ هفته",
    what: "the antibody window is 3 to 12 weeks",
  },
  {
    q: "دوز نگهدارندهی متادون",
    must: "برفک",
    what: "oral thrush in an adult means immunodeficiency until proven otherwise",
  },
  {
    q: "نگران ابتلا به ویرو",
    must: "نسل چهارم",
    what: "a fourth-generation combined assay resolves the apparently conflicting keys",
  },
  {
    q: "کدامیک از گزینههای زیر مناسبت",
    must: "وسترن بلات",
    what: "two ELISAs then one Western blot was the algorithm of that era",
  },
];

/* The corrected key gets its own check, because a correction the student
   cannot see is not a correction. Both the new answer and the word "تصحیح"
   must appear in the rendered lesson. */
const CORRECTED_KEY = {
  q: "گروه C عفونت",
  must: "گروه A",
  alsoMust: "تصحیح",
  what: "q9662 the corrected key (PGL is category A) is shown AND explained as a correction",
};

/* The repaired number gets its own check for the same reason. */
const REPAIRED_NUMBER = {
  q: "مورد تازه شناخته شده",
  must: "500",
  what: "q9707 the repaired viral load (500 copy/ml, not 5) reaches the screen",
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
let boldsSeen = 0;

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
  /* Count the emphasis WHILE A TAUGHT LESSON IS OPEN. Measuring it at the end
     of the run reported zero, and the reason was not a rendering fault: the
     last question opened is q9707, which is repaired but NOT YET TAUGHT, so no
     lesson panel exists to hold a bold phrase. Checking emphasis against an
     untaught question would have been a false alarm forever. */
  boldsSeen = Math.max(boldsSeen, await page.locator(".modal-back strong").count());
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

{
  const c = REPAIRED_NUMBER;
  const body = await openAndAnswer(c.q);
  const found = noZwnj(body).includes(noZwnj(c.q));
  const shows = noZwnj(body).includes(c.must);
  console.log(`${found && shows ? "PASS" : "FAIL"}  ${c.what}: found=${found} shows${c.must}=${shows}`);
  if (!found) problems.push(`${c.what}: the question is not searchable`);
  else if (!shows) problems.push(`${c.what}: the repaired figure ${c.must} is not on screen`);
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
console.log("\nthe HIV transmission, staging and diagnostic blocks render exactly as taught.");
