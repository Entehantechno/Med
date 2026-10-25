/* Visual check: the central nervous system chapter as a student actually sees it.

   This is the ninth visual file, and it inherits every lesson the previous
   eight paid for:

     * the browse list shows only the STEM; the lesson and the answer key
       appear one interaction deeper, after picking an option and pressing
       "بررسی"
     * the modal is dismissed by clicking the BACKDROP, not with Escape
     * search terms must be copied out of the STORED text — which contains
       stray spaces inside Persian words — and must be UNIQUE
     * uniqueness is measured against the WHOLE BANK (1712 cards), not the
       chapter: every term below was run through
       /api/learn/browse?q=<term> and required to return total === 1
     * a correction lesson deliberately QUOTES the broken text, so the
       stale-value check must read the STEM alone, never the whole page
     * Persian strings must be compared with the zero-width non-joiner
       stripped from both sides

   One draft term was rejected by the uniqueness check and is recorded here so
   nobody tries it again: 'Glu: 20 mg/dl' returns total = 2, because q9156 and
   q9173 received the SAME repair — both panels really do read 20 mg/dl after
   the dropped zero was restored. 'از صبح امروز به اورژانس آورده' is ambiguous
   for the same reason (total = 2). The unique substitute used below is
   'PRO: 120 mg/dl'.

   What is checked here:

   1. THE REPAIRED LABORATORY PANELS ARE ON SCREEN. In this chapter the CSF
      panel IS the diagnosis. A mirrored or truncated glucose turns bacterial
      meningitis into viral meningitis and the whole question into nonsense,
      so these ten numbers are not cosmetic:
        q9156 — glucose 20 and protein 120 (stored "2 mg/dl" and "21 mg/dl")
        q9158 — glucose 32 and protein 150 (stored "23" and "51")
        q9161 — pleocytosis 340 per mm3 (stored "mm043", not even a number)
        q9163 — protein 90 and RBC 100 (stored "09" and "001")
        q9172 — temperature 38 and glucose 38 (stored "C38" and "83")
        q9179 — 80% neutrophils (stored "%08")
        q9181 — 82% neutrophils on 1300 cells (stored fused as "0031")
        q9182 — 75% neutrophils (stored "%57")
        q9134 — fever 40 with pulse 84: relative bradycardia, Faget's sign of
                typhoid. Stored mirrored, pulse 48, which is an ABSOLUTE
                bradycardia and points at a different diagnosis entirely.

   2. BOTH TEACHING BLOCKS REACH THE STUDENT: the order of actions and the CSF
      panel (batch 26); empirical therapy, brain abscess and prophylaxis
      (batch 27).

   3. THE FOUR KNOWN RENDERING DEFECTS DO NOT RETURN: literal ** markers,
      untranslated i18n keys, split or non-ASCII digits, and a lesson with no
      emphasis at all.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

const NUMBERS = [
  {
    q: "PRO: 120 mg/dl",
    must: "Glu: 20 mg/dl",
    not: "21 mg/dl:PRO",
    what: "q9156 CSF glucose 20 and protein 120 restored",
  },
  {
    q: "Glu=32 mg/dl",
    must: "protein=150 mg/dl",
    not: "23 mg/dl=Glu",
    what: "q9158 CSF glucose 32 un-mirrored and protein 150 restored",
  },
  {
    q: "340 در میلی‌متر مکعب",
    must: "340",
    not: "mm043",
    what: "q9161 pleocytosis rebuilt as 340 per cubic millimetre",
  },
  {
    q: "RBC=100",
    must: "pro=90",
    not: "RBC=001",
    what: "q9163 CSF protein 90 and red cells 100 un-mirrored",
  },
  {
    q: "Glucose = 38 mg/Dl",
    must: "T=38 °C",
    not: "83 mg/Dl = Glucose",
    what: "q9172 temperature and CSF glucose both read 38 as printed",
  },
  {
    q: "PMN 80%",
    must: "80%",
    not: "PMN %08",
    what: "q9179 neutrophil share un-mirrored to 80%",
  },
  {
    q: "WBC: 1300",
    must: "PMN: 82%",
    not: "0031",
    what: "q9181 the fused count is split into 82% of 1300 cells",
  },
  {
    q: "PMN 75%",
    must: "75%",
    not: "PMN %57",
    what: "q9182 neutrophil share un-mirrored to 75%",
  },
  {
    q: "نبض 84",
    must: "40 °C",
    not: "نبض 48",
    what: "q9134 fever 40 with pulse 84, the relative bradycardia of typhoid",
  },
];

const LESSONS = [
  {
    q: "فاقد اختلال نورولوژیک موضعی",
    must: "کشت خون",
    what: "antibiotics never wait for imaging; blood culture goes first (batch 26)",
  },
  {
    q: "به ترتیب اقدامات لازم",
    must: "ادم پاپی",
    what: "papilloedema and seizure are CT-before-LP indications (batch 26)",
  },
  {
    q: "اندیکاسیونی برای انجام",
    must: "دگزامتازون",
    what: "age alone is not a CT indication; dexamethasone timing (batch 26)",
  },
  {
    q: "PRO: 120 mg/dl",
    must: "پنوموکوک",
    what: "neutrophilic panel with low glucose reads as pneumococcus (batch 26)",
  },
  {
    q: "340 در میلی‌متر مکعب",
    must: "قند طبیعی",
    what: "lymphocytic panel with normal glucose is enteroviral (batch 26)",
  },
  {
    q: "سردرد 20 روزه",
    must: "سلی",
    what: "subacute course with very high protein is tuberculous (batch 26)",
  },
  {
    q: "RBC=100",
    must: "تمپورال",
    what: "red cells plus temporal lobe means herpes encephalitis (batch 26)",
  },
  {
    q: "امکان انجام اقدامات تشخیصی",
    must: "آسیکلوویر",
    what: "altered consciousness adds aciclovir to the empirical regimen (batch 27)",
  },
  {
    q: "قبل از آماده شدن جواب آنالیز",
    must: "لیستریا",
    what: "a diabetic over fifty needs ampicillin for Listeria (batch 27)",
  },
  {
    q: "کانسر معده را دارد",
    must: "سفتازیدیم",
    what: "neutropenia swaps ceftriaxone for antipseudomonal cover (batch 27)",
  },
  {
    q: "اوتیت مدیای مزمن",
    must: "مترونیدازول",
    what: "chronic otitis abscess needs anaerobic cover (batch 27)",
  },
  {
    q: "همسر باردار",
    must: "بارداری",
    what: "ceftriaxone is the prophylaxis of choice in pregnancy (batch 27)",
  },
  {
    q: "ساکن آسایشگاه",
    must: "مننگوکوک",
    what: "only meningococcus requires contact prophylaxis (batch 27)",
  },
  {
    q: "link india",
    must: "کپسول",
    what: "India ink shows the cryptococcal capsule (batch 27)",
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

/* Compare Persian text with ZWNJ (U+200C) stripped: the stored string and the
   rendered DOM do not always agree on where the zero-width non-joiner sits,
   and an invisible character must never fail a real test. */

for (const c of NUMBERS) {
  const body = await openAndAnswer(c.q);
  const stem = await stemText(c.q);
  const found = noZwnj(body).includes(noZwnj(c.q));
  const hasNew = noZwnj(body).includes(noZwnj(c.must));
  const hasOld = noZwnj(stem).includes(noZwnj(c.not));
  /* An empty stem means the locator broke, not that the page is clean.
     Fail loudly rather than let the stale-value check go quiet again. */
  if (found && !stem) problems.push(`${c.what}: the stem could not be read, so the stale-value check did not run`);
  const ok = found && hasNew && !hasOld && !!stem;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.what}: found=${found} shows"${c.must}"=${hasNew} stillShowsOld=${hasOld}`);
  if (!found) problems.push(`${c.what}: the question is not searchable`);
  else if (!hasNew) problems.push(`${c.what}: corrected value ${c.must} is not on screen`);
  else if (hasOld) problems.push(`${c.what}: the uncorrected value ${c.not} is still in the STEM`);
  await page.screenshot({ path: `/tmp/cns-${c.what.replace(/\W+/g, "-").slice(0, 40)}.png` });
}

for (const c of LESSONS) {
  const body = await openAndAnswer(c.q);
  const found = noZwnj(body).includes(noZwnj(c.q));
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
console.log("\nthe central nervous system chapter renders exactly as repaired.");
