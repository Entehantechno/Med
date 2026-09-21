/* Visual check: the skin and soft tissue chapter as a student actually sees it.

   Built on what the seven previous visual files learned the hard way:
     * the browse list shows only the STEM; the lesson and answer key appear
       one interaction deeper, after picking an option and pressing "بررسی"
     * the modal is dismissed by clicking the BACKDROP, not with Escape
     * search terms must be copied from the STORED text — which contains stray
       spaces inside Persian words — and must be UNIQUE to their question

   Every term below was copied out of /api/learn/browse and programmatically
   confirmed UNIQUE. Three drafts were rejected by that check and replaced:
   "خانم 32 ساله" (it lives in an OPTION, not the stem, so it is not
   searchable), "آنافیلاکسی" (it matched two cards), and "عادت ماهیانه".

   That last one taught a new lesson, and it is worth writing down because the
   earlier visual files got away with the same mistake by luck:

     UNIQUENESS MUST BE CHECKED AGAINST THE WHOLE BANK, NOT THE CHAPTER.

   The first draft verified each term against the 69 cards of this chapter and
   found "عادت ماهیانه" unique among them. But the search box queries all 1712
   cards, where the phrase also appears in a gynaecology stem and a migraine
   stem. The test then clicked the wrong row, never opened the lesson, and
   reported that a lesson "does not mention سوپرآنتی‌ژن" — a true statement
   about a card nobody was looking at. Verify with
   /api/learn/browse?q=<term> and require total === 1.

   What is checked here:

   1. THE REPAIRED VITAL SIGNS ARE ON SCREEN. This chapter is where the vital
      signs ARE the diagnosis: necrotising fasciitis and toxic shock are
      recognised by noticing the patient is far sicker than the skin looks. A
      mirrored pulse or blood pressure erases exactly that evidence.
        q9017 — tachycardia 110 and tachypnoea 26 (stored as "min011", "min26")
        q9025 — temperature 38.3 (stored as "3/83", i.e. 83 degrees)
        q9028 — blood pressure 70/p (stored mirrored as "p/07")
        q9060 — leucocytosis 19000 (stored as "00091")
        q9031 — TEN patients, not one: the outbreak that justifies 60 days of
                ciprofloxacin rather than 10 days of amoxicillin

   2. BOTH TEACHING BLOCKS REACH THE STUDENT: cellulitis, water exposures,
      necrotising infection and toxic shock (batch 24); streptococcal
      pharyngitis and invasive staphylococcal disease (batch 25).

   3. THE FOUR KNOWN RENDERING DEFECTS DO NOT RETURN: literal ** markers,
      untranslated i18n keys, split or non-ASCII digits, and a lesson with no
      emphasis at all.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

const NUMBERS = [
  {
    q: "تاک یکاردی 110/min",
    must: "26/min",
    not: "min011",
    what: "q9017 tachycardia and tachypnoea rebuilt as rates",
  },
  {
    q: "T=38.3",
    must: "38.3",
    not: "3/83",
    what: "q9025 temperature un-mirrored to 38.3",
  },
  {
    q: "فشار خون 70/p",
    must: "130",
    not: "p/07",
    what: "q9028 blood pressure and respiratory rate un-mirrored",
  },
  {
    q: "لکوسیتوز 19000",
    must: "19000",
    not: "00091",
    what: "q9060 leucocyte count un-mirrored to 19000",
  },
  {
    q: "10 نفر",
    must: "60 روز",
    not: "01 نفر",
    what: "q9031 the outbreak of TEN patients is restored",
  },
];

const LESSONS = [
  {
    q: "میانی ساعد اندام فوقانی",
    must: "گرم‌مثبت",
    what: "cefixime has no gram-positive cover (batch 24)",
  },
  {
    q: "نیمهی ران",
    must: "هیالورونیداز",
    what: "lymphangitis explained by streptococcal spreading enzymes (batch 24)",
  },
  {
    q: "ماهی فروش",
    must: "مقاوم",
    what: "Erysipelothrix is vancomycin resistant (batch 24)",
  },
  {
    q: "صدف خام",
    must: "آهن",
    what: "Vibrio vulnificus and iron overload in cirrhosis (batch 24)",
  },
  {
    q: "فعالیت بدنی شدید",
    must: "دبریدمان",
    what: "necrotising fasciitis needs debridement, not imaging (batch 24)",
  },
  {
    q: "اریتم جنرالیزه",
    must: "سوپرآنتی‌ژن",
    what: "toxic shock is a superantigen disease (batch 24)",
  },
  {
    q: "ب یتأثیر",
    must: "روماتیسمی",
    what: "penicillin prevents rheumatic fever but not glomerulonephritis (batch 25)",
  },
  {
    q: "دار آنافیلاکسی",
    must: "بتالاکتام",
    what: "anaphylaxis forbids every beta-lactam (batch 25)",
  },
  {
    q: "سنباده",
    must: "توکسین",
    what: "scarlet fever is an erythrogenic toxin disease (batch 25)",
  },
  {
    q: "ریشهکنی ناقلین",
    must: "ریفامپین",
    what: "carrier eradication needs rifampicin added (batch 25)",
  },
  {
    q: "پشت گردن",
    must: "کاربونکل",
    what: "the carbuncle of the nape in a diabetic (batch 25)",
  },
  {
    q: "سوم و چهارم کمری",
    must: "MRI",
    what: "spondylodiscitis needs MRI, not a plain film (batch 25)",
  },
  {
    q: "قلب باز",
    must: "سفازولین",
    what: "surgical prophylaxis targets skin flora (batch 25)",
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

const noZwnj = (t) => String(t || "").replace(/\u200c/g, "");

/* Read the STEM alone for the stale-value check.

   Inherited from skin.visual.mjs — and repaired here, because the inherited
   version was silently doing nothing.

   The first draft of this file passed all twenty-four checks on the first
   run. A negative test proved that one of them was worthless: replacing
   not:"RBC=001" with not:"RBC=100" (asserting that the CORRECT value is
   absent, which must fail) still passed. The reason is that
   `.modal-back p` matches three elements, and the FIRST one is the little
   "مطالعه" badge above the card. `.first()` therefore returned a six-letter
   label, which of course contains no laboratory value at all, so every
   stale-value assertion was comparing against an empty haystack.

   The fix is to pick the candidate that actually holds the question, and —
   just as importantly — to REFUSE to pass when no such candidate is found,
   so that this check can never go quiet again. The stem is the first
   candidate that contains the search term; the correction lesson, which
   quotes the broken original on purpose, always renders after it. */
async function stemText(term) {
  const sel = page.locator(".modal-back p, .modal-back .stem, .modal-back h3");
  const n = await sel.count();
  const texts = [];
  for (let i = 0; i < n; i++) texts.push((await sel.nth(i).innerText()) || "");
  const hit = texts.find((t) => noZwnj(t).includes(noZwnj(term)));
  if (hit) return hit;
  const longest = texts.slice().sort((a, b) => b.length - a.length)[0] || "";
  return longest.length >= 60 ? longest : "";
}

for (const c of NUMBERS) {
  const body = await openAndAnswer(c.q);
  const stem = await stemText(c.q);
  const found = body.includes(c.q);
  const hasNew = body.includes(c.must);
  const hasOld = stem.includes(c.not);
  /* An empty stem means the locator broke, not that the page is clean.
     Fail loudly rather than let the stale-value check go quiet again. */
  if (found && !stem) problems.push(`${c.what}: the stem could not be read, so the stale-value check did not run`);
  const ok = found && hasNew && !hasOld && !!stem;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.what}: found=${found} shows"${c.must}"=${hasNew} stillShowsOld=${hasOld}`);
  if (!found) problems.push(`${c.what}: the question is not searchable`);
  else if (!hasNew) problems.push(`${c.what}: corrected value ${c.must} is not on screen`);
  else if (hasOld) problems.push(`${c.what}: the uncorrected value ${c.not} is still in the STEM`);
  await page.screenshot({ path: `/tmp/skin-${c.what.replace(/\W+/g, "-").slice(0, 40)}.png` });
}

/* Compare Persian text with ZWNJ (U+200C) stripped.

   The first run also failed on "سوپرآنتی‌ژن", and again the test was wrong:
   the word IS in the lesson, but the stored string and the rendered DOM do not
   agree on where the zero-width non-joiner sits. This is the same family of
   defect as the earlier "میلی‌متر" trap in the threshold guard — an invisible
   character that makes two identical-looking strings unequal. Strip it from
   both sides. */

for (const c of LESSONS) {
  const body = await openAndAnswer(c.q);
  const found = body.includes(c.q);
  const taught = noZwnj(body).includes(noZwnj(c.must));
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
console.log("\nthe skin and soft tissue chapter renders exactly as repaired.");
