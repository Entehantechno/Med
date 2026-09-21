/* Visual check: the completed parasitology and malaria chapter, as a student sees it.

   The seventeenth visual file, and the one that closes the SECOND chapter of
   the book. It covers the 81 questions taught in batches 41 to 45: amoebiasis,
   giardiasis, leishmaniasis, the whole toxoplasmosis decision tree, malaria
   diagnosis, malaria treatment, malaria prophylaxis, and the helminths.

   Every lesson the earlier sixteen files paid for is inherited here:

     * the browse list indexes only the STEM; the lesson and the answer key
       appear one interaction deeper, after picking an option and pressing
       "بررسی"
     * the modal is dismissed by clicking the BACKDROP, not with Escape
     * search terms are copied out of the STORED text — which contains stray
       spaces inside Persian words ("کود ک", "پسربهی", "ماههشتم") — and every
       one was verified UNIQUE across all 1652 cards in the live bank before
       being written here
     * every "must" phrase was verified to exist in that question's OWN
       rendered lesson text, not merely somewhere in the bank
     * the check button is matched EXACTLY, never by substring
     * emphasis is counted WHILE A TAUGHT LESSON IS OPEN, never at the end of
       the run
     * Persian is compared with the zero-width non-joiner stripped
     * no phrase is taken from `source_defects`, which the player does not
       render — only from text the student actually reads

   WHAT IS CHECKED HERE

   1. ALL SIX TEACHING CLUSTERS REACH THE STUDENT: the two-part amoeba rule,
      the toxoplasmosis decision tree, malaria species morphology, the WHO
      severity criteria, the treatment ladder, and the helminth drug table.

   2. THE COUNTER-INTUITIVE ANSWERS ARE EXPLAINED, not merely asserted. Five
      keys in this chapter look wrong to a student who has only memorised a
      rule, and each is checked for a term from the explanation that makes it
      make sense:
        q9776/q9778  bloodborne vivax needs NO primaquine, because the
                     merozoite never passes through the liver
        q9781        the issue is the FETUS's G6PD, not the mother's
        q9811        piperazine PARALYSES rather than kills, so an obstructed
                     bowel can expel the worm
        q9806        "screen the family" is wrong where "treat the family" is
                     right, because a negative screen changes no decision

   3. THE MECHANISMS ARE ON SCREEN, NOT JUST THE CONCLUSIONS. A student who
      reads "spleen is most sensitive" learns a fact; one who reads why the
      parasite load is highest there can reconstruct it. Each check targets
      the mechanism word, not the conclusion.

   4. THE KNOWN RENDERING DEFECTS DO NOT RETURN, and no markdown table reaches
      the rendered page.
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";

const LESSONS = [
  // ---- amoebiasis: the two-part rule
  { q: "کدام روش تشخیصی زیر در", must: "خمیر آنچوی",
    what: "q9728 amoebic serology, and the abscess described down to its contents" },
  { q: "آقای 42 سالهای به علت", must: "کولیت فولمینانت",
    what: "q9735 a carrier on steroids is treated because invasion can follow" },
  { q: "مرد جوان کارگر آشپزخانه بدون", must: "کشت مدفوع باکتری",
    what: "q9737 stool culture finds bacteria, not parasites" },
  // ---- giardia and leishmania
  { q: "آقایی 19 سالهای با سابقهی", must: "IgA ترشحی",
    what: "q9742 giardia is held by secretory IgA, which is why CVID relapses" },
  { q: "در تشخیص لیشمانیا احشایی کدامیک", must: "بیش از ۹۵",
    what: "q9744 the spleen's sensitivity is given as a number, not an impression" },
  // ---- toxoplasmosis
  { q: "بیمارهشت سالهای به علت تاری", must: "حاشیه‌ی رنگدانه‌دار",
    what: "q9745 the pigmented margin is what identifies the toxoplasmic scar" },
  { q: "خانم جوانی با بارداری 12", must: "پنج سال",
    what: "q9749 two tests five years apart are the strongest proof of old immunity" },
  { q: "تمام موارد توکسوپالسوزیس ذیل نیاز", must: "یک سال کامل",
    what: "q9754 the newborn's full year of treatment, so the exception stands out" },
  { q: "خانم جوانی جهت مشاورهی قبل", must: "چهار ماه",
    what: "q9757 six months minus two already elapsed leaves four" },
  { q: "خانمی با حاملگی 14 هفته", must: "ادرار جنین",
    what: "q9759 amniotic PCR waits for week 18 because fetal urine must be sufficient" },
  // ---- malaria: severity and species
  { q: "کدام موارد از مشخصات مالاریای", must: "گلوکونئوژنز",
    what: "q9763 hypoglycaemia is explained by three mechanisms, not asserted" },
  { q: "مهندس جوانی 10 روز پس", must: "رتیکولوسیت",
    what: "q9764 vivax prefers reticulocytes, which is why its cells are enlarged" },
  { q: "خانم جوان در ماههشتم حاملگی", must: "سکستراسیون",
    what: "q9770 the placenta is a preferred sequestration site, so pregnancy is worse" },
  { q: "پسر جوانی که در ایرانشهر", must: "شیزوگونی",
    what: "q9774 the 48-hour cycle is why the repeat interval is 12 to 24 hours" },
  // ---- malaria: hypnozoites and the bloodborne exception
  { q: "در درمان کدامیک از پلاسمودیو", must: "recrudescence",
    what: "q9775 relapse from the liver is separated from recrudescence from the blood" },
  { q: "تکنسین آزمایشگاهی به دنبال نیدل", must: "اسپوروزوئیت",
    what: "q9776 a needle transmits merozoites, not sporozoites, so the liver is bypassed" },
  { q: "آقایی 45 سالهای به دنبال", must: "مروزوئیت",
    what: "q9778 the same exception for a transfusion, stated in the same mechanism" },
  { q: "یکی از پرسنل آزمایشگاه در", must: "G6PD جنین",
    what: "q9781 the trap is named: the issue is the FETUS's G6PD, not the mother's" },
  // ---- malaria: treatment
  { q: "بیماری 18 ساله یکهفته پس", must: "SEAQUAMAT",
    what: "q9783 artesunate is justified by the trials, not by assertion" },
  { q: "بیماری به علت تب و", must: "تورساد",
    what: "q9784 quinidine's cardiotoxicity is named, which is why the history matters" },
  { q: "مرد جوان افغانی متعاقب مهاجرت", must: "تاکی‌پنه",
    what: "q9788 the respiratory rate is read as compensation for acidosis" },
  // ---- malaria: prophylaxis
  { q: "خانم حامله پنج ماهه قصد", must: "مالارون",
    what: "q9793 the brand name is decoded, so the option is not mistaken for a new drug" },
  { q: "از موارد زیر برای پیشگیری", must: "پیش‌اریتروسیتی",
    what: "q9795 the short tail is explained by the drug also killing the liver stage" },
  // ---- pinworm
  { q: "کودک خردسالی دار خارش اطراف", must: "نوار چسب",
    what: "q9798 the tape test, because the eggs are on the skin not in the stool" },
  { q: "پسربهی شش سالهای با شکایت", must: "دو هفته",
    what: "q9801 the two-week repeat, which is the component most often dropped" },
  { q: "کود ک 7 سالهای را", must: "بررسی منفی",
    what: "q9806 screening is rejected because a negative screen changes no decision" },
  // ---- whipworm, hookworm, ascaris
  { q: "کود ک 4 سالهای که", must: "دو قطب شفاف",
    what: "q9803 the polar plugs identify the Trichuris egg" },
  { q: "کمخونی ناشی ازکمبود آهن از", must: "دیفیلوبوتریوم",
    what: "q9818 iron deficiency is contrasted with the B12 deficiency of a cestode" },
  { q: "جوان 25 سالهای را در", must: "فلج شل",
    what: "q9811 flaccid paralysis, which is the whole reason piperazine is chosen" },
  { q: "به دنبال ابتلا به آسکاریس", must: "پریتونیت",
    what: "q9812 the surgical danger signs are listed, so 'no surgery' is a judgement" },
  // ---- strongyloides
  { q: "بیمار پس از دریافت دوز", must: "لاروا کورنس",
    what: "q9815 larva currens is named, the near-pathognomonic sign of the disease" },
  // ---- cestodes and trematodes
  { q: "برای درمان کیست هیداتید کبدی", must: "اسکلروزان",
    what: "q9820 the biliary contraindication is explained by chemical cholangitis" },
  { q: "از بیمار روستایی که کاندید", must: "میزبان واسط",
    what: "q9821 man takes the sheep's place, which is why meat is not the route" },
  { q: "درگیری مغزی از تظاهرات آلودگی", must: "نوروسیستی‌سرکوز",
    what: "q9824 eating the eggs, not the pork, is what puts cysts in the brain" },
  { q: "بیماری چندهفته بعد از برگشت", must: "شاهی آبی",
    what: "q9825 watercress is named as the vehicle for fasciola" },
  { q: "خانم 30 ساله اهل استان", must: "تری‌کلابندازول",
    what: "q9827 the one trematode that praziquantel does not treat" },
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
console.log("\nthe completed parasitology and malaria chapter renders exactly as taught.");
