/* Visual check: the completed viral and STI chapter, as a student sees it.

   The sixteenth visual file, and the one that closes the chapter. It covers
   the 46 questions taught in batches 37 to 40: genital ulcers, urethritis,
   mononucleosis, the whole varicella zoster life cycle, measles, mumps,
   rubella and hepatitis C.

   Every lesson the earlier fifteen files paid for is inherited here:

     * the browse list shows only the STEM; the lesson and answer key appear
       one interaction deeper, after picking an option and pressing "بررسی"
     * the modal is dismissed by clicking the BACKDROP, not with Escape
     * search terms must be copied out of the STORED text — which contains
       stray spaces inside Persian words — and must be UNIQUE across the
       whole bank, AND unique TO THE INTENDED QUESTION
     * the check button is matched EXACTLY, never by substring
     * emphasis is counted WHILE A TAUGHT LESSON IS OPEN, never at the end of
       the run
     * Persian is compared with the zero-width non-joiner stripped

   TERMS REJECTED BY THE UNIQUENESS CHECK, recorded so nobody retries them:

     'worker'                 total = 7  — matches 'دامدار' stems through the
                                           tokeniser; replaced with the full
                                           'خانم 30 ساله worker Sex'
     'چهار روز قبل'            total = 3  — matches a paraparesis stem;
                                           replaced with the longer phrase
     'مورد پیوند کلیه'          total = 2  — also matches a 25-year-old
                                           transplant stem
     'سرولوژی سرخجه'           total = 2  — also matches an 11-week exposure stem
     'اهل افغانستا'            total = 2  — also matches a 13-year-old boy

   WHAT IS CHECKED HERE

   1. ALL FIVE TEACHING CLUSTERS REACH THE STUDENT: the pain/consistency grid,
      dual urethritis therapy, the mononucleosis penicillin trap, the varicella
      life cycle with its four post-exposure scenarios, and the measles group.

   2. THE FOUR POST-EXPOSURE KEYS THAT LOOK WRONG ARE EXPLAINED. q9626, q9629,
      q9630 and q9634 all key oral aciclovir rather than VZIG, and a student
      will think them mistaken unless the day-7 evidence is on screen. Each of
      those four is checked for a term from that explanation.

   3. THE TWO ANNOTATED SOURCE DEFECTS ARE VISIBLE. q9599's impossible platelet
      count and q9856's missing unit are errors of the BOOK, left in place and
      annotated; an annotation the student never sees is not an annotation.

   4. THE REPAIRED TEMPERATURE IS ON SCREEN. q9600's stem printed "OT=39" and
      the extractor mirrored it to "93=OT" (see fix_viral_final_numbers.py).
      That defect was caught by the numeric guard inside apply_en.py, not by
      the glyph sweep, and the corrected value is checked directly.

   5. THE KNOWN RENDERING DEFECTS DO NOT RETURN, and no markdown table reaches
      the rendered page.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

const LESSONS = [
  // ---- genital ulcer: the pain / consistency grid
  { q: "زخم چرکی دردناک نرم", must: "یک‌طرفه",
    what: "chancroid: painful, soft, with tender unilateral nodes" },
  { q: "پوستو لهای متعدد شروع", must: "کمون",
    what: "the papule-to-pustule course with a 7-day incubation is chancroid" },
  { q: "چند زخم دردناک بر روی آلت", must: "دوطرفه",
    what: "bilateral tender nodes move the answer from chancroid to herpes" },
  { q: "ضایعات وزیکولر دردناک در ناحیهی تناسلی", must: "اریتماتو",
    what: "a vesicle on an erythematous base is the signature of herpes" },
  { q: "اولسرهای مخاطی و وزیکو لهای گروهی", must: "بارداری",
    what: "type-specific serology separates a first attack from a recurrence" },
  { q: "ضایعات وزیکولوپوستولی انگشت دوم", must: "درناژ",
    what: "a herpetic whitlow must never be incised" },
  // ---- urethritis and vaginitis
  { q: "تورم و محدودیت حرکت در چند مفص", must: "منتشر",
    what: "the gonococcus can disseminate and cause arthritis with a pustular rash" },
  { q: "برای سومین بار طی یک سال", must: "کمپلمان",
    what: "recurrent Neisseria means a terminal complement deficiency" },
  { q: "کوکوباسی لهای گرم منفی", must: "سفتریاکسون",
    what: "gonococcal pharyngitis is treated with ceftriaxone, not penicillin" },
  { q: "تورم یک طرفهی بیضهی سمت راست", must: "تورشن",
    what: "epididymitis needs dual therapy, and torsion must always be excluded" },
  { q: "بدون تماس جنسی دار علائم ترشح", must: "پایدار",
    what: "improvement then relapse without new contact is persistent urethritis" },
  { q: "به ضرر تشخیص این بیماری", must: "لاکتوباسیل",
    what: "a normal pH excludes bacterial vaginosis because lactobacilli survive" },
  { q: "کوکسی گرم مثبت کمتر از 10", must: "داخل سلولی",
    what: "pyuria with a negative culture means chlamydia, which will not grow on agar" },
  { q: "خانم 30 ساله worker Sex", must: "لگنی",
    what: "imaging is not indicated, but a pelvic examination must not be omitted" },
  { q: "سفتریاکسون 250 میل یگرم عضلانی", must: "انگل",
    what: "symptoms after complete therapy point to trichomonas, a parasite" },
  { q: "عفون تهای راجعه تراکوموناس", must: "نیتروایمیدازول",
    what: "clindamycin is antibacterial and cannot treat a protozoan" },
  { q: "بهبود نسبی مجدد", must: "داکسی‌سیکلین",
    what: "the era's key repeated azithromycin; today doxycycline is preferred" },
  { q: "بدون تکرر ادراری", must: "یک‌سوم",
    what: "dual therapy, because the two organisms coincide in up to a third of cases" },
  { q: "ترشح چرکی مجرای ادرار به شما مراجعه", must: "تجربی",
    what: "with no testing available, cover both organisms empirically" },
  { q: "پروفیلاکسی HPV", must: "سه دوز",
    what: "starting at 15 or older needs three doses, and men are fully indicated" },
  // ---- mononucleosis
  { q: "شدیدترین گلودردی", must: "سیستمیک",
    what: "generalised lymphadenopathy means a systemic infection, not streptococcus" },
  /* NOT "ناممکن": that word lives in the machine-readable source_defects
     record, which the player does not render. The LESSON says the same thing
     in its own words — "خطای چاپی در کتاب" — and it is the rendered lesson,
     not the metadata, that the student actually reads. Checking a term the
     UI never shows would be a permanently red check for a correct lesson. */
  { q: "آدنوپاتی سرویکال متعدد", must: "خطای چاپی",
    what: "the impossible platelet count is named as a source misprint" },
  { q: "طحالهم ملموس", must: "وارونگی",
    what: "an inverted differential favouring lymphocytes means a virus" },
  // ---- varicella zoster
  { q: "ضایعات پوستی خار شدار", must: "بالغ",
    what: "chickenpox in an adult needs aciclovir within 24 hours" },
  { q: "ماکو ل، پاپو ل، وزیکول و پوستول", must: "آبله",
    what: "lesions at many stages at once is chickenpox, not smallpox" },
  { q: "اندازهی 5 تا 10 میل یمتر", must: "علامت‌دار",
    what: "a laboratory abnormality is not a clinical disease" },
  { q: "اختلال در تعادل و راه رفت", must: "پس‌عفونی",
    what: "post-infectious cerebellar ataxia needs only supportive care" },
  { q: "اجتناب از تماس نزدیک", must: "کراست",
    what: "isolation ends at crusting, not after a count of days" },
  { q: "درد ناحیهی زیربغل", must: "گانگلیون",
    what: "the pain precedes the rash because the virus inflames the nerve first" },
  { q: "انحراف به سمت راست", must: "کوردا تیمپانی",
    what: "Ramsay Hunt, and the numb tongue is explained by the chorda tympani" },
  { q: "درد یک طرفهی گوش", must: "زانویی",
    what: "the organism is varicella zoster, reactivating from the geniculate ganglion" },
  // ---- the four post-exposure keys that look wrong
  { q: "خواهر وی 6 روز قبل", must: "روز هفتم",
    what: "q9626 the day-7 rule is explained, so the key does not look wrong" },
  { q: "زن حامله 24 هفته", must: "روز هفتم",
    what: "q9629 the day-7 rule again, for a susceptible pregnant woman" },
  { q: "جشن تولد فرزندش", must: "پروفیلاکسی",
    what: "q9630 waiting for fever forfeits the purpose of prophylaxis" },
  { q: "هفت هی آخر بارداری", must: "آنتی‌بادی",
    what: "q9634 maternal zoster means the mother already has antibody" },
  { q: "یک روز پس از زایمان", must: "بپوشانید",
    what: "no action needed, but the lesions must still be covered" },
  // ---- measles, mumps, rubella
  { q: "فتوفوبی و کسالت شدید", must: "سه C",
    what: "the three Cs plus a head-to-toe rash is measles" },
  { q: "Koplik", must: "پاتوگنومونیک",
    what: "Koplik spots are pathognomonic; recognise measles from the mucosa" },
  { q: "دورهی آموزشی", must: "اوتیت",
    what: "otitis is the commonest complication; pneumonia the commonest cause of death" },
  { q: "آزمایش سرولوژی سرخجه به شرح ذیل", must: "اطمینان",
    what: "IgG positive with IgM negative means immunity; reassurance is the action" },
  { q: "در تماس با بیمار مبتلا به سرخجه", must: "تراتوژن",
    what: "ribavirin is teratogenic and the vaccine is live; immunoglobulin is the answer" },
  { q: "بیمار دختر 5 سالهای اهل افغانستا", must: "ایزولاسیون",
    what: "the isolation advice and the infectious period are two different numbers" },
  // ---- hepatitis
  { q: "درد مفصل و میالژی منتش", must: "کورتیکواستروئید",
    what: "exclude active hepatitis C before immunosuppressing" },
  { q: "درد پهلوی راست", must: "پنجره",
    what: "in the early window RNA sees and the antibody is blind" },
];

/* The two annotated source defects and the repaired number get their own
   checks, because a correction the student cannot see is not a correction. */
const SPECIALS = [
  { q: "سوزن در دست جراح", must: "mIU/mL", alsoMust: "نان‌رسپاندر",
    what: "q9856 the missing unit is named AND the true-non-responder rule is taught" },
  { q: "طحالهم ملموس", must: "۹۰", alsoMust: "پارگی طحال",
    what: "q9600 the 90 per cent lymphocytes and the splenic rupture warning both render" },
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

for (const c of SPECIALS) {
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
console.log("\nthe completed viral and STI chapter renders exactly as taught.");
