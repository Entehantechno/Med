/* Visual check: the corrected patient ages are what a student actually sees.

   The API can be right while the page is wrong (caching, a stale bundle, an
   RTL rendering quirk that splits a number). So this drives a real browser,
   searches the question bank for three vignettes whose ages this pass changed,
   and reads the age back off the rendered DOM.

   Expected, verified against the printed book:
     جنگلبان (forest ranger, fox bite)      -> 54   (was a broken "5 ٤5")
     ورزشکار (athlete, cellulitis)          -> 25   (was 52)
     همودیالیزی (haemodialysis, back pain)  -> 45   (was 54)
*/
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";
const CASES = [
  { q: "جنگلبان", expect: "54" },
  { q: "ورزشکار", expect: "25" },
  { q: "همودیالیزی", expect: "45" },
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

// navigate via the sidebar, the way a student does
await page.getByText("جست‌وجوی سؤالات", { exact: false }).first().click();
await page.waitForTimeout(1800);

for (const c of CASES) {
  const box = page.getByPlaceholder("جست‌وجو در متن سؤال…").first();
  await box.fill(c.q);
  await page.waitForTimeout(1800);
  const body = await page.locator("body").innerText();
  const hit = body.includes(c.q);
  // find the age stated next to "ساله" in whichever card mentions the keyword
  const ages = [...body.matchAll(/(\d{1,3})\s*ساله/g)].map((m) => m[1]);
  const ok = hit && ages.includes(c.expect);
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.q}: found=${hit} ages=[${ages.join(",")}] expected ${c.expect}`);
  if (!ok) problems.push(`${c.q}: expected ${c.expect}, saw [${ages.join(",")}]`);
  await page.screenshot({ path: `/tmp/shot-${c.q}.png` });
}

// no rendered stem may contain a stray non-ASCII digit or a torn number
const body = await page.locator("body").innerText();
if (/[\u0660-\u0669\u06F0-\u06F9]\s*\d|\d\s+\d\s*ساله/.test(body)) {
  problems.push("a rendered stem shows split or non-ASCII digits");
}

await browser.close();
if (problems.length) {
  console.log("\nPROBLEMS:\n" + problems.map((p) => "  ✗ " + p).join("\n"));
  process.exit(1);
}
console.log("\nall rendered ages match the printed book.");
