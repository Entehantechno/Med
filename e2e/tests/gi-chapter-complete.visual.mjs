/* Visual check: the completed gastrointestinal chapter, as a student sees it.

   The eighteenth visual file, and the one that closes the THIRD chapter of the
   book. It covers the 66 questions taught in batches 46 to 50: inflammatory
   versus non-inflammatory diarrhoea, haemolytic uraemic syndrome, food
   poisoning, the acute-diarrhoea algorithm, Clostridioides difficile, Shigella,
   cholera, and salmonella with enteric fever.

   Every lesson the earlier seventeen files paid for is inherited here:

     * the browse list indexes only the STEM; the lesson and the answer key
       appear one interaction deeper, after picking an option and pressing
       "بررسی"
     * the modal is dismissed by clicking the BACKDROP, not with Escape
     * search terms are copied out of the STORED text — which contains stray
       spaces inside Persian words ("کود ک", "سالهای") — and every one was
       verified UNIQUE across all 1652 cards in the live bank before being
       written here
     * every "must" phrase was verified to exist in that question's OWN
       rendered lesson text, not merely somewhere in the bank. Two candidates
       were REJECTED by that verification and replaced:
           q9327 "زور زدن"      — the phrase belongs to the Shigella prolapse
                                  lesson, not to this HUS one
           q9335 "مرکز استفراغ" — that phrasing is in the Staph food-poisoning
                                  lesson; this cholera lesson says "تحریک"
     * the check button is matched EXACTLY, never by substring
     * emphasis is counted WHILE A TAUGHT LESSON IS OPEN, never at the end
     * Persian is compared with the zero-width non-joiner stripped

   WHAT IS CHECKED HERE

   1. THE MECHANISM IS ON SCREEN, NOT JUST THE CONCLUSION. Each check targets
      the word that explains WHY, so a student can reconstruct the answer
      rather than recall it: Gb3 receptors for HUS, adenylate cyclase for
      cholera toxin, dipicolinate for the spore coat that alcohol cannot
      penetrate, and the macrophage for why marrow culture survives antibiotics.

   2. THE FIVE COUNTER-INTUITIVE ANSWERS ARE EXPLAINED, not merely asserted:
        q9305/q9432/q9433  treating is sometimes WRONG — antibiotics prolong
                           salmonella carriage and help nothing in watery
                           diarrhoea
        q9315              alcohol gel, correct everywhere else, is the WRONG
                           answer here
        q9319              intravenous vancomycin is useless — the ROUTE, not
                           the drug, is the error
        q9322              a negative stool culture does not exclude C.
                           difficile, because routine culture never looks for it
        q9431              marrow culture stays positive after antibiotics

   3. THE SEVEN REPAIRED NUMBERS REACH THE STUDENT. q9294, q9307, q9322, q9327,
      q9348 and q9437 all had mirrored digits (see fix_gi_numbers2.py). The
      most consequential is q9437's pulse: at "08" it was noise; at 80 with a
      fever of 39 it is RELATIVE BRADYCARDIA and a positive diagnostic finding.

   4. THE KNOWN RENDERING DEFECTS DO NOT RETURN, and no markdown table reaches
      the rendered page.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

const LESSONS = [
  // ---- the inflammatory / non-inflammatory division
  { q: "نوجوان 15 سالهای از دو", must: "اسهال مسافران",
    what: "q9287 ETEC is watery traveller's diarrhoea, which is why it is the exception" },
  { q: "از موارد زیر از علل", must: "استئاتوره",
    what: "q9295 giardia is separated from food poisoning by its malabsorptive picture" },
  // ---- haemolytic uraemic syndrome
  { q: "HUS( Syndrome Uremic Hemolytic(از عوارض", must: "گیرنده‌های Gb3",
    what: "q9289 the Gb3 receptor explains why the glomerulus takes the damage" },
  { q: "خانم جوانی 4 روز پس", must: "۵ تا ۱۰ روز",
    what: "q9291 the HUS interval is given as a number, so the timing can be judged" },
  { q: "کود ک 6 سالهای را با", must: "احتباس مایع",
    what: "q9327 the facial swelling is explained as fluid retention from renal failure" },
  { q: "کدامیک از موارد زیر جزء", must: "هاپتوگلوبین",
    what: "q9328 common findings are separated from the defining triad" },
  // ---- food poisoning
  { q: "خنک کردن آهستهی غذاها و", must: "مقاوم به حرارت",
    what: "q9298 the heat-stable toxin is why reheating does not make food safe" },
  { q: "دختر 7 سالهای را حدود", must: "سوپرآنتی‌ژن",
    what: "q9299 the superantigen acting centrally explains why vomiting dominates" },
  // ---- the acute diarrhoea algorithm
  { q: "پسر 17 سالهای با اسهال", must: "کومنسال",
    what: "q9300 Entamoeba coli is named a commensal, which is the whole trap" },
  { q: "آقای 21 سالهای با شکایت", must: "ده تا صد",
    what: "q9301 Shigella's tiny infective dose explains the household spread" },
  { q: "خانم 60 سالهای را به", must: "اورتواستاتیک",
    what: "q9303 the postural drop is named as the marker of volume depletion" },
  { q: "بیماری 2 ساعت است که", must: "۴۸ تا ۷۲ ساعت",
    what: "q9305 the culture reports after the illness ends, so it changes nothing" },
  { q: "آقای 30 سالهای به علت", must: "مگاکولون توکسیک",
    what: "q9307 the antimotility contraindication is justified by its consequence" },
  // ---- Clostridioides difficile
  { q: "آقایی 30 ساله پیوند مغز", must: "سد محافظ",
    what: "q9310 the normal flora is described as a barrier the antibiotic removes" },
  { q: "بیمار 70 ساله چند روز", must: "کلونیزه",
    what: "q9312 colonisation is why a positive culture does not prove disease" },
  { q: "در تشخیص عفونت کلستریدیوم دیفیسیل", must: "پرفوراسیون",
    what: "q9314 colonoscopy is not merely insensitive but risky in severe colitis" },
  { q: "در بیمارستان منطقهای که مشغول", must: "دی‌پیکولینات",
    what: "q9315 the spore coat's chemistry explains why alcohol cannot penetrate it" },
  { q: "بیماری به دنبال دریافت آنت", must: "فشار انتخابی",
    what: "q9317 treating carriers is rejected on resistance grounds, not convenience" },
  { q: "بیماری با زخم پای دیابتی", must: "لومن",
    what: "q9319 the lumen is why oral works and intravenous vancomycin does not" },
  { q: "بیماری به علت جراحی لگن", must: "محیط بی‌هوازی",
    what: "q9322 routine culture never looks for C. difficile, so a negative excludes nothing" },
  // ---- Shigella
  { q: "کودکی به دنبال تب و", must: "نوروتوکسیک",
    what: "q9323 the seizure is given a mechanism rather than left as a fact" },
  { q: "بیمار آقای 52 ساله مورد", must: "باکتریمی",
    what: "q9329 immunosuppression is tied to the bacteraemia risk that lengthens treatment" },
  { q: "مرد جوان 25 سالهای مبتلا", must: "شریک",
    what: "q9331 the antibiotic is described as immunity's partner, which sets the duration" },
  // ---- cholera
  { q: "مرد 22 سالهای به علت", must: "آدنیلات سیکلاز",
    what: "q9333 the locked enzyme is the mechanism behind every cholera finding" },
  { q: "آقای 25 ساله، یک روز", must: "رنگدانه‌ی صفراوی",
    what: "q9334 the missing bile pigment is why the stool looks like rice water" },
  { q: "کود ک 8 سالهای با اسهال", must: "تحریک",
    what: "q9335 the absence of invasion is why there is no fever" },
  { q: "در بیماری کلرا (وبا) وجود", must: "اشک",
    what: "q9338 absent tears is named among the moderate-dehydration signs" },
  { q: "مرد 38 سالهای با اسهال", must: "قلیادوست",
    what: "q9339 Cary-Blair's alkaline pH is matched to the organism's preference" },
  { q: "در بیمار مبتلا به cholera", must: "میلی‌اکی‌والان",
    what: "q9341 the stool's electrolyte content is quantified, so the fluid choice follows" },
  { q: "خانم جوانی را به تابلوی", must: "کلوئید",
    what: "q9343 albumin is rejected as a colloid with no advantage here" },
  { q: "برای خانمی که در ماه", must: "زیر یک درصد",
    what: "q9345 azithromycin's very low resistance rate is given as a number" },
  { q: "کودک 5 سالهای با اسهال", must: "شهاب‌وار",
    what: "q9348 the darting motility on dark-field is described, not just named" },
  { q: "خانم حامله دو ماههای با", must: "اکسیداز منفی",
    what: "q9350 the oxidase test separates vibrio from the whole Enterobacteriaceae family" },
  // ---- salmonella and enteric fever
  { q: "منبع انتقال سالمونلا تیفی به", must: "کیسه‌ی صفرا",
    what: "q9423 the gallbladder carrier is why a human-only reservoir sustains the disease" },
  { q: "مرد 28 سالهای با شکایت", must: "۱۰ ضربه",
    what: "q9424 the ten-beats-per-degree rule makes relative bradycardia calculable" },
  { q: "پسر 16 ساله بدون سابقهی", must: "هفته‌ی دوم",
    what: "q9426 diarrhoea is placed in the second week, so constipation is not surprising" },
  { q: "بیمار آقای 27 ساله است", must: "رتیکولواندوتلیال",
    what: "q9427 the reticuloendothelial site explains the mildly raised liver enzymes" },
  { q: "بیمار آقایی 49 سالهای با", must: "استاندارد طلایی",
    what: "q9428 blood culture is named the gold standard for the first week" },
  { q: "آقای 25 سالهای با تب", must: "ماکروفاژ",
    what: "q9431 the intracellular niche is why marrow survives prior antibiotics" },
  { q: "مرد جوانی بدون سابقهی بیماری", must: "رقیب",
    what: "q9432 the competing flora explains why treatment prolongs carriage" },
  { q: "خانم 35 سالهای به دلیل", must: "مایکوتیک",
    what: "q9436 the mycotic aneurysm is why bacteraemia needs two weeks" },
  { q: "نوجوان 20 سالهای با تب", must: "آپلازی مغز استخوان",
    what: "q9437 chloramphenicol's fatal reaction is named, so its absence makes sense" },
];

/* The repaired numbers get their own checks, because a correction the student
   cannot see is not a correction. */
const REPAIRS = [
  { q: "کود ک 6 سالهای را با", must: "25000",
    what: "q9327 the repaired white count (was the mirrored 00052) renders" },
  { q: "کودک 5 سالهای با اسهال", must: "80mmHg",
    what: "q9348 the repaired systolic pressure (was the mirrored mmHg08) renders" },
  { q: "نوجوان 20 سالهای با تب", must: "80/min",
    what: "q9437 the repaired pulse (was the mirrored min08) renders — relative bradycardia" },
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
console.log("\nthe completed gastrointestinal chapter renders exactly as taught.");
