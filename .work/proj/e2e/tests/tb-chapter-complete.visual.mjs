/* Visual check: the completed tuberculosis chapter, as a student sees it.

   The NINETEENTH visual file, and the one that closes the FOURTH chapter of
   the book. It covers the 62 questions taught in batches 51 to 57: who
   progresses from latent to active disease, primary versus post-primary
   disease, the extrapulmonary forms, the diagnostic ladder, the regimens,
   drug toxicity, the tuberculin thresholds, and preventive therapy in the
   HIV-positive contact, the child and the newborn.

   Every lesson the earlier eighteen files paid for is inherited here:

     * the browse list indexes only the STEM; the lesson and the answer key
       appear one interaction deeper, after picking an option and pressing
       "بررسی"
     * the modal is dismissed by clicking the BACKDROP, not with Escape
     * search terms are copied out of the STORED text — which contains stray
       spaces inside Persian words ("کود ک", "سالهای") — and every one was
       verified UNIQUE across all 1652 cards before being written here
     * every "must" phrase was verified to exist in that question's OWN
       lesson text, not merely somewhere in the bank. TWO CANDIDATES WERE
       REJECTED BY THAT VERIFICATION AND REPLACED:
           q9264 "چهارسؤالی"  — the lesson writes the WHO screen out in full
                                as "غربالگری علامتی", never as that compound
           q9272 "منحنی"      — the age curve is drawn in the q9278 lesson,
                                not in this one; replaced with the phrase this
                                lesson actually uses for the third argument
     * the check button is matched EXACTLY, never by substring
     * emphasis is counted WHILE A TAUGHT LESSON IS OPEN, never at the end
     * Persian is compared with the zero-width non-joiner stripped

   WHAT IS CHECKED HERE

   1. THE MECHANISM IS ON SCREEN, NOT JUST THE CONCLUSION. Each check targets
      the word that explains WHY: the pncA gene for pyrazinamide's inertness
      against M. bovis, the RD1 deletion for why BCG does not confound IGRA,
      the rpoB gene for how Xpert reports resistance in the same two hours,
      the PXR receptor behind every rifampicin interaction, the hapten
      mechanism behind rifampicin thrombocytopenia, and pyridoxine kinase
      inhibition behind isoniazid neuropathy.

   2. THE COUNTER-INTUITIVE ANSWERS ARE EXPLAINED, not merely asserted:
        q9222  the smear becomes LESS often positive as HIV advances, because
               cavitation is an act of immunity
        q9239 / q9245  the DECEPTIVE TWINS — the same enzyme rise, opposite
               decisions, separated by one word ("symptomatic")
        q9246  ethambutol is safe for the liver and blinds in renal failure,
               so "safe" is made relative to an organ
        q9258  hepatitis can be rechallenged, an immune reaction never
        q9276  an ABNORMAL film means full treatment, not prophylaxis — the
               option that inverts this is the trap
        q9283 / q9284  the mirror pair: one mother still infectious at
               delivery, one no longer, deciding milk, separation,
               prophylaxis and BCG all at once

   3. THE FOUR REPAIRED NUMBERS REACH THE STUDENT. q9214 carried a defect of a
      NEW KIND — a TRUNCATION rather than a mirroring, the pleural LDH reduced
      to its leading digit — plus two mirrored values; q9249's haemoglobin was
      mirrored from 12 to 21. The haemoglobin is the most consequential in the
      chapter: at 21 the panel reads as polycythaemia and the student hunts
      for another cause of the purpura; at 12, with a normal white count, the
      platelet count of 40,000 stands alone as an ISOLATED THROMBOCYTOPENIA,
      which is precisely what names rifampicin. See fix_tb_numbers2.py.

   4. THE KNOWN RENDERING DEFECTS DO NOT RETURN, and no markdown table
      reaches the rendered page.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

const LESSONS = [
  { q: "با توجه به این که 1", must: "ده برابر شدن سالانه",
    what: "q9205 the annual tenfold multiplication makes HIV the largest single risk" },
  { q: "مرد 35 سالهای با ش", must: "تضاد بین سمع فقیر",
    what: "q9206 a normal chest on auscultation is named as characteristic of tuberculosis" },
  { q: "دختر نوجوان 13 سال", must: "کمپلکس رانکه",
    what: "q9207 the Ghon/Ranke complex explains why hilar adenopathy means primary disease" },
  { q: "کدامیک از علائم زیر ا", must: "باسیل ندارد ولی التهاب دارد",
    what: "q9208 the hypersensitivity rule that unites all three primary findings" },
  { q: "در آدنیت توبرکلوزی", must: "بافت را نمونه بگیر",
    what: "q9210 the tissue-not-secretion rule that also decides the pleural question" },
  { q: "آقایی 30 سالهای با", must: "CD4 زیر ۱۰۰",
    what: "q9211 the CD4 threshold that removes toxoplasmosis in an HIV-negative patient" },
  { q: "خانم متأهلی با درد", must: "اسمگماتیس",
    what: "q9212 M. smegmatis is why the urinary answer is culture and not smear" },
  { q: "بیماری به علت پلور", must: "واکنش ازدیاد حساسیت",
    what: "q9213 the effusion is explained as hypersensitivity, which is why the fluid is sterile" },
  { q: "آقایی با سابقهی سر", must: "معیارهای لایت",
    what: "q9214 Light’s criteria are computed, which the repaired numbers make possible" },
  { q: "آقایی 45 سالهای با", must: "کیفیت نمونه",
    what: "q9215 specimen quality is given as a reason repeating the smear is not futile" },
  { q: "بیمار 30 سالهای با", must: "منتشر می‌کند",
    what: "q9216 the prednisolone trap is explained by dissemination, not merely forbidden" },
  { q: "آقای 27 سالهای به", must: "آئروسل‌ساز",
    what: "q9218 bronchoscopy is rejected as aerosol-generating, protecting the staff too" },
  { q: "خانم 30 سالهی بارد", must: "محافظ شکمی",
    what: "q9219 abdominal shielding is named, so pregnancy does not block the film" },
  { q: "بیمار مرد HIV مثبت", must: "ژن rpoB",
    what: "q9220 the rpoB gene is why Xpert reports resistance in the same two hours" },
  { q: "تست FEERON Quanti", must: "RD1",
    what: "q9221 the RD1 deletion is why BCG does not make IGRA positive" },
  { q: "در مورد عفونت همزم", must: "مایکوباکتریمی",
    what: "q9222 mycobacteraemia is explained by the failure to build a granuloma" },
  { q: "بیماری به علت سرفه", must: "آزمون درمانی",
    what: "q9223 the antibiotic course is framed as a therapeutic test, not blind treatment" },
  { q: "آقای 55 سالهای با", must: "ستون فقرات",
    what: "q9225 the fluoroquinolone is placed as the backbone of MDR regimens" },
  { q: "مرد 35 سالهای به س", must: "شیوه‌ی خوب عملکرد",
    what: "q9226 the 2017 good practice statement is given beside the book key" },
  { q: "بیمار مبتلا به سل ریه", must: "اسمیر ۳+",
    what: "q9228 the 3+ smear is tied to infectiousness, which is why treatment cannot wait" },
  { q: "بیمار زن جوانی است که با تو", must: "واکنش پارادوکسیکال",
    what: "q9229 paradoxical enlargement is taught so it is not mistaken for failure" },
  { q: "بیمار خانم 32 ساله ا", must: "گرانولوم کازئیفیه",
    what: "q9230 the caseating granuloma is treated as a near-diagnosis, not a finding" },
  { q: "خانم 25 سالهی افغا", must: "فشار انتخابی",
    what: "q9232 two weeks of drugs is explained as insufficient selective pressure" },
  { q: "آقای 52 سالهای با ت", must: "دستور پخت مقاومت",
    what: "q9233 two months on then three off is named the recipe for acquired resistance" },
  { q: "بیماری پس از شروع", must: "پیرازینوئیک اسید",
    what: "q9236 pyrazinoic acid blocking urate excretion is the mechanism, not just the fact" },
  { q: "بیمار خانم 27 ساله", must: "پس از دیالیز",
    what: "q9237 dosing after dialysis is added, which the question does not ask but the ward does" },
  { q: "نوزادی که تحت برنا", must: "pncA",
    what: "q9238 the pncA mutation is why the pyrazinamide prodrug never switches on" },
  { q: "آقای 45 سالهای که", must: "سازگاری کبدی",
    what: "q9239 hepatic adaptation explains why an asymptomatic 3x rise is continued" },
  { q: "مردی 40 ساله تحت د", must: "نامتقارن",
    what: "q9242 the asymmetry of the two errors is what justifies stopping before the result" },
  { q: "بیمار آقای 57 ساله", must: "دوقلوی",
    what: "q9245 the twin question is named, so the one-word difference is unmissable" },
  { q: "کدامیک از داروهای ضد سل زیر ه", must: "برای کدام عضو",
    what: "q9246 safety is made relative: ethambutol spares the liver but blinds in renal failure" },
  { q: "خانم 68 سالهای به", must: "قرمز و سبز",
    what: "q9247 red-green colour loss is given as the earliest sign of optic neuritis" },
  { q: "بیماری با سیل ریوی", must: "هاپتن",
    what: "q9249 the hapten mechanism is why the antibody persists and rechallenge kills" },
  { q: "بیماری مبتلا به سل", must: "ناشنوایی برگشت‌ناپذیر",
    what: "q9250 the injectables are placed in their modern context, with the reason" },
  { q: "خانم 30 ساله دوهفت", must: "آلرژی دائمی",
    what: "q9251 recording it as a permanent allergy is made an explicit action" },
  { q: "بیمار 45 سالهای به", must: "حساس‌سازی قبلی",
    what: "q9254 prior sensitisation explains why the reaction comes in month two" },
  { q: "در صورت مصرف کدامی", must: "PXR",
    what: "q9255 the PXR receptor is the mechanism behind every rifampicin interaction" },
  { q: "خانم 25 سالهای که ب", must: "IUD مسی",
    what: "q9256 the copper IUD is recommended because it bypasses hepatic metabolism" },
  { q: "بیمار خانم حامله ک", must: "پیریدوکسین کیناز",
    what: "q9257 pyridoxine kinase inhibition is the mechanism of the neuropathy" },
  { q: "در بیمار مبتلا به س", must: "قابل بازگشت",
    what: "q9258 the reversible-versus-permanent table is stated as one rule" },
  { q: "در بیماری که TB ری", must: "تکثیر مقاومت",
    what: "q9259 amplification of resistance is why a single added drug is monotherapy" },
  { q: "در بیماری که تست ج", must: "کلسینورین",
    what: "q9262 the calcineurin inhibitor is why transplant sits at the 5 mm threshold" },
  { q: "پرستاری در بخش عفو", must: "پدیده‌ی بوستر",
    what: "q9263 the booster phenomenon is why repeating adds nothing with a known baseline" },
  { q: "بیمار مبتلا به ویر", must: "غربالگری علامتی",
    what: "q9264 the WHO four-symptom screen is named as the tool that excludes disease" },
  { q: "بیمار مبتلا به HIV با m", must: "مساوی یا بیشتر",
    what: "q9265 the rule is stated as five OR MORE, so 5 mm is not borderline" },
  { q: "خانم پرستاری به عل", must: "شبه‌لوپوس",
    what: "q9267 the isoniazid lupus-like syndrome is flagged in a lupus patient" },
  { q: "مرد 25 سالهای با ع", must: "آنرژیک",
    what: "q9268 anergy is why a negative PPD in HIV carries zero information" },
  { q: "بیمار مبتلا به عفو", must: "پیش‌آزمون",
    what: "q9269 pre-test probability is why documented contact outranks the test" },
  { q: "مرد 25 ساله HIV مث", must: "هم‌بند",
    what: "q9270 prison sharing is treated as the closest and longest exposure there is" },
  { q: "آقای جوان HIV مثبت", must: "دو دلیل مستقل",
    what: "q9271 two independent routes to the 5 mm threshold are identified" },
  { q: "در یک بیمار مبتلا به س", must: "هزینه‌ی مداخله",
    what: "q9272 the cheapness of the intervention completes the asymmetric-risk argument" },
  { q: "خانم 32 سالهای با", must: "پروفیلاکسی پنجره‌ای",
    what: "q9274 window prophylaxis is named, which is the whole strategy" },
  { q: "خانم 27 سالهای با", must: "منحنی رشد",
    what: "q9275 the growth curve is offered as the most sensitive index in an infant" },
  { q: "کود ک 4 سالهای در", must: "مادربزرگ",
    what: "q9276 the grandmother is highlighted as a contact tracing often misses" },
  { q: "دو ماه پس از زایما", must: "ماستیت سلی",
    what: "q9277 the one true exception to the breast-milk rule is stated" },
  { q: "خانم خان هداری که", must: "سن طلایی",
    what: "q9278 the U-shaped age curve, including the low-risk golden age" },
  { q: "تست توبرکولین پسرب", must: "شست‌وشوی معده",
    what: "q9279 gastric lavage is named, because children do not expectorate" },
  { q: "مادر کودک سه سالها", must: "سه مسیر",
    what: "q9280 the three possible paths are why diagnosis must come first" },
  { q: "مریض 55 ساله دیابت", must: "دوره‌ی پنجره",
    what: "q9281 the window period is the concept absent from the threshold table" },
  { q: "آقای 55 سالهای مبتلا به سل", must: "مقرون‌به‌صرفه",
    what: "q9282 the modern contact-screening standard is given beside the book key" },
  { q: "خانم 28 سالهای در", must: "تبدیل اسمیر",
    what: "q9283 smear conversion is named the objective end of infectiousness" },
  { q: "زنی 24 ساله درهفت", must: "واکسن زنده",
    what: "q9284 BCG being a live vaccine is why it must not accompany isoniazid" },
];

/* The repaired numbers get their own checks, because a correction the student
   cannot see is not a correction.

   ⭐ AND A BLIND SPOT THAT THIS FILE'S OWN NEGATIVE TEST EXPOSED.
   The first version of these checks asserted only that the CORRECTED value
   appears somewhere on the page. Reverting q9249's haemoglobin in the payload
   back to the mirrored ",21 mg/dl:Hb" and re-importing the bank LEFT THE
   CHECK GREEN — because the LESSON QUOTES THE CORRECTED VALUE when it
   explains the repair, and the lesson text is on the same page as the stem.
   The check was reading its own explanation back to itself.

   That is the eighth "unique is necessary but not sufficient" lesson in this
   suite, in a new dress: PRESENT IS NECESSARY BUT NOT SUFFICIENT. A repair
   check must also assert that THE BROKEN FORM IS GONE, which no amount of
   lesson prose can fake. Both directions are asserted below. */
const REPAIRS = [
  { q: "آقایی با سابقهی سر", must: "LDH=2000",
    what: "q9214 the repaired pleural LDH (was the truncated single digit 2) renders" },
  { q: "آقایی با سابقهی سر", must: "= 500",
    what: "q9214 the repaired serum LDH (was the mirrored 005) renders" },
  { q: "آقایی با سابقهی سر", must: "قند = 60",
    what: "q9214 the repaired pleural glucose (was the mirrored 06) renders" },
  { q: "بیماری با سیل ریوی", must: "Hb: 12",
    what: "q9249 the repaired haemoglobin (was the mirrored 21) renders — isolating the thrombocytopenia" },
];

/* The mirrored forms these repairs replaced. Each MUST NOT appear anywhere on
   the page once the question is open — not in the stem, not quoted back by
   the lesson. This is the half of the check that cannot be satisfied by
   explanatory prose. */
const MIRRORED = [
  { q: "آقایی با سابقهی سرفه، ", gone: "2 mg/dL=LDH",
    what: "q9214 the truncated pleural LDH must not return" },
  { q: "آقایی با سابقهی سرفه، ", gone: "=،)005",
    what: "q9214 the mirrored serum LDH must not return" },
  { q: "آقایی با سابقهی سرفه، ", gone: "قند = 06",
    what: "q9214 the mirrored pleural glucose must not return" },
  { q: "بیماری با سیل ریوی اسم", gone: ",21 mg/dl:Hb",
    what: "q9249 the mirrored haemoglobin must not return" },
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

for (const c of [...LESSONS, ...REPAIRS]) {
  const body = await openAndAnswer(c.q);
  const found = noZwnj(body).includes(noZwnj(c.q));
  const taught = noZwnj(body).includes(noZwnj(c.must));
  const ok = found && taught;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.what}: found=${found} lessonShown=${taught}`);
  if (!found) problems.push(`${c.what}: the question is not searchable`);
  else if (!taught) problems.push(`${c.what}: the lesson does not mention "${c.must}"`);
  await recordPanel(c.what);
}

for (const c of MIRRORED) {
  const body = await openAndAnswer(c.q);
  const returned = noZwnj(body).includes(noZwnj(c.gone));
  console.log(`${returned ? "FAIL" : "PASS"}  ${c.what}: brokenFormPresent=${returned}`);
  if (returned) problems.push(`${c.what}: the mirrored form "${c.gone}" is back on the page`);
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
console.log("\nthe completed tuberculosis chapter renders exactly as taught.");
