# R94 — web-quality upgrade (skills-based), returning-user boot fix

Version: `2026.11.06-r94-web-quality`. Base: `6010b22` (R93). Release zip: `releases/MED-School-FINAL-2026-11-06-R94.zip` (1051 files; see Verification).
Machine-readable measurements: `docs/rounds/R94-lighthouse-summary.json`. Raw Lighthouse JSON stays in the sandbox (not committed).

## Method
- **Skills used.** `web-quality-skills` (installed to `~/.claude/skills/`): `core-web-vitals` (LCP/INP/CLS targets, the "client-rendered LCP" row in `LCP.md`), `performance` (measurement method), `accessibility` (WCAG AA contrast, heading order, accessible names), `best-practices`, `seo`, `web-quality-audit` (evidence model: field, RUM, trace/lab, static).
- **Lab.** Lighthouse 12 with Slow 4G and 4× CPU for mobile; desktop at 1350×940. Headless Chromium in a sandbox with software raster, so absolute paint times are pessimistic. Single runs, not medians (noise ≈ ±3 performance points, ±300 ms LCP).
- **Profiles.** Anonymous runs use a fresh profile. Signed-in runs use profiles seeded with the bearer token. "Cold" runs clear HTTP cache, code cache, service worker and Cache Storage (`CLEAR_CACHE=1`). "Warm" runs keep whatever the profile holds.
- **Field data.** None available (no RUM traffic in the sandbox). All numbers below are lab numbers.

## Fixed in R94

1. **Returning users loaded the app twice after a deploy (`client/src/lib/sw-update.js`, new `client/src/lib/build-check.js`).**
   - Cause, measured: when a new service worker takes control, `controllerchange` reloads the page unconditionally. A returning user's first document was already the newest HTML (fetched from the network), so the reload booted the whole app a second time.
   - Evidence: Playwright on a warm profile showed two main-frame loads of `/` (`controllerchange` → reload). The same build with the service worker cleared showed one load. Lighthouse on the same warm profile gave TBT 1437 ms and then 6324 ms on repeat (desktop) and perf 65–69 / TBT 6–11 s (mobile, pre-fix).
   - Fix: on `controllerchange`, compare the loaded entry script (`assets/index-<hash>.js`) with a fresh copy of the HTML. Reload only if they differ. Any failure answers "stale", which keeps the old behaviour. The check lives in its own module, loaded on demand, so the entry bundle does not grow.
   - Result after fix: one load on the warm profile (probe ×3). Warm mobile student home: perf 93, LCP 1950 ms, TBT 177 ms. Warm desktop student home: perf 98 and 94, TBT 0.
   - Tests: `client/src/test/sw-update.test.jsx` (+4: same build → no reload; newer build → reload; check fails → reload; no entry script → reload with no fetch).

2. **Teacher 403 storm on `/api/admin/notifications` (`client/src/pages/Admin.jsx`).** `AdminBell` now loads and polls only for `user.role === "admin"`. Test: `client/src/pages/Admin.bell.test.jsx` (2 tests). Browser check: signed-in teacher `/` → `auth/me` 200, 0 calls to `/api/admin/notifications`, 0 API responses ≥400, 0 console errors. Admin `/admin` → notifications 200 (expected), 0 errors.

3. **Idle prefetch of learner/student chunks starts after `load` (`client/src/App.jsx`).** Previously a 3 s idle timeout could fire inside the authenticated LCP window. **Honest result: no measurable LCP change** (student 3939 → 3907 ms; teacher 4450 → 4501 ms; learner 3888 → 3801 ms; all within noise). Kept because it moves non-critical requests out of the first-paint window; it is not a fix for the cold LCP problem below.

4. **Text contrast for amber XP labels (`client/src/styles.css`).** New token `--xp-ink`: `#8a5a00` in light theme, `#f2c35c` in dark. Applied to `.hud-chip.xp`, `.goal-ring .gv b`, `.celebrate .big`, `.mock-pill.xp`, `.lp-chip.xp`, and the Admin XP total. `--xp` (`#e0a52e`, 2.19:1 on white) stays for graphics and decoration only.
   - Measured contrast (WCAG formula, actual panel colours): `#8a5a00` on `#ffffff` 5.93; on `#eef1f6` 5.24; on `#eaeff6` 5.13. `#f2c35c` on `#243052` 7.86; on `#1b2540` 9.19. All ≥ 4.5:1 for normal text.
   - Lighthouse color-contrast audit: no failures on the teacher, learner, admin or student home runs.

5. **Accessibility names and headings (`Landing.jsx`, `UI.jsx`, `learn/Store.jsx`, `styles.css`).**
   - Landing: feature and step titles `h4` → `h3` (CSS selectors updated). Brand links: removed `aria-label` that contradicted visible text ("Go to home" over "MED School…"); logo marked `aria-hidden`.
   - Language toggle: `aria-label` equal to its visible label.
   - Store course cards: removed `aria-label` that differed from the visible title; the name now comes from content (`course-title`).
   - Lighthouse a11y: anonymous home 98 → 100, anonymous store 93 → 100, student VP mobile 92 → 100 (warm before vs cold after; the after value is the stronger test).

## Checked and not a bug
- `bank` digest tests (`master-bank.test.js`): 45 failures are the digest-locked baseline already recorded in R90/R93. No server file changed in R94, so R94 did not cause them. Not investigated this round; see open items.
- `api.test.js` XP test (open in R93, ~3598–3611): passes now (29 XP-tagged tests, 0 failures). I made no server change, so the earlier failure was environmental (most likely the missing client build). Not confirmed as a root cause.
- Admin's XP total (`Admin.jsx` ~9020) already uses `--xp-ink`. There is no `var(--xp)` text colour left in that file.
- Store and Landing accessible names: derived from visible text after the `aria-label` removals (checked in the source).
- Service worker API caching (`sw.js`): every non-public `/api/` GET is answered with `fetch(…, {cache:"no-store"})`, so authenticated data is never served from the Cache API. Only the public endpoints (`/api/health`, `/api/pwa/config`, `/api/site-content/*`) are cached, network-first. No change needed.

## Measured (lab, single runs)

| Scenario | Build state | Perf | a11y | LCP (ms) | TBT (ms) |
|---|---|---|---|---|---|
| Anonymous `/` mobile, before (R93) | fresh | 93 | 98 | 2681 | 159 |
| Anonymous `/` mobile, after | fresh | 94 | 100 | 2635 | 122 |
| Anonymous `/store` mobile, before → after | fresh | 86 → 94 | 93 → 100 | 2921 → 2691 | 304 → 117 |
| Anonymous `/` desktop, before → after | fresh | 98 → 97 | 98 → 100 | 581 → 614 | 0 → 0 |
| Student `/` mobile, cold | cold cache | 82 / 81 | 100 | 3933 / 3955 | 171 |
| Student `/vp` mobile, cold | cold cache | 84 | 100 | 3933 | 102 |
| Teacher `/` mobile, cold | cold cache | 79 | 98 | 4470 | 42 |
| Learner `/` mobile, cold | cold cache | 78 | 98 | 4643 | 140 |
| Admin `/admin` mobile, cold | cold cache | 78 | 97 | 4617 | 49 |
| Student `/` desktop, cold | cold cache | 98 | 100 | 796 | 0 |
| Student `/` desktop, warm, pre-fix (r94b) | old SW in profile | 69 | 100 | 591 | 1437 |
| Student `/` desktop, warm, post-fix | old SW in profile | 98 / 94 | 100 | 741 / 736 | 0 |
| Student `/` mobile, warm, pre-fix (r94) | old SW in profile | 68 | 100 | 2225 | 6713 |
| Teacher `/` mobile, warm, pre-fix (r94) | old SW in profile | 69 | 98 | 1759 | 10642 |
| Learner `/` mobile, warm, pre-fix (r94) | old SW in profile | 65 | 98 | 2827 | 7652 |
| Admin `/admin` mobile, warm, pre-fix (r94) | old SW in profile | 68 | 97 | 1863 | 6493 |
| Student `/vp` mobile, warm, pre-fix (r94) | old SW in profile | 69 | 100 | 1736 | 9670 |
| Student `/` mobile, warm, post-fix | old SW in profile | 93 | 100 | 1950 | 177 |

Baselines for comparison, same R93 build, pre-change: signed-in student VP mobile perf 94, LCP 1351, TBT 192 (warm profile); teacher home perf 91, console 403; learner perf 93, LCP 2278; admin perf 89, a11y 83. Desktop student home pre-change: perf 98, LCP 538, TBT 0 (warm profile, pre-change build). Warm vs cold are not like-for-like, which is why both are reported.

**Why the pre-fix warm rows look worse than the baseline.** The R93 baseline's signed-in profiles were already on the R93 service worker, so they never saw an update. The R94 profiles still carried the older worker, so the first load of the new build triggered an update and the reload described above. The same thing happens to a real returning user on the first visit after every deploy, so this is an update-path cost, not a steady-state regression of R94 code. The `sw.js` file itself did not change in R94. The fix removes the second boot.

Diagnostic experiment on the same warm profile (desktop, pre-fix): clearing the HTTP cache alone gave TBT 455 ms; clearing service worker + Cache Storage gave perf 99, TBT 0. That isolated the service worker, which led to the reload finding above.

## Still open (not done in R94)
1. **Cold signed-in LCP is 3.9–4.6 s on mobile, above the 2.5 s target.** The LCP element is the dashboard greeting (`h2`) and its render delay is ~3.5 s. The LCP reference calls this the "client-rendered LCP" pattern: the element is absent from the initial HTML and render delay dominates. The fix is an earlier render (for example a greeting that uses a cached name, or server rendering of the shell). Not built; needs its own design and measurement.
2. **`heading-order` fails on app-shell pages.** `h4` section titles follow the topbar `h1`. Needs a per-page heading pass with visual checks. Deferred.
3. **Topbar title structure (option A: move `h1` out of the brand button; option B: wrap only the title text).** Not applied. A DOM change needs a visual check, and this round did not include one.
4. **Landing LCP render delay** (83% of 2681 ms, anonymous mobile). Not investigated. Candidates: `backdrop-filter` on `.lp-nav.raised`, `polishPulse` on `.mock-node.active`.
5. **Unused CSS ~44–47 KB** on app pages; `uses-long-cache-ttl` on `/defer-css.js` (1 day).
6. **Entry JS is at 25.076 KB gzip against a 25.1 KB budget.** Any further entry growth will fail `perf:budget`. Reducing the budget's headroom is a decision for the owner, not a silent raise.
7. **45 `master-bank` digest tests fail** (baseline, pre-existing). Should be checked on whether the bank content or its fixtures changed.
8. **AI word-by-word streaming:** no decision yet (from R89).
9. **Lint (low priority):** client `exhaustive-deps` 83, `no-empty` 23; `CustomTest.jsx` exhaustive-deps (~377); dead code in `Flashcards.jsx` ~320–321.

## Audit plan for the next round (skills-based)
- **Scope:** all public pages (`/`, `/blog`, `/store`, `/vp`, `/login`) and signed-in shells (student, teacher, learner, admin home), mobile and desktop.
- **Accessibility:** heading order per page; keyboard path through the topbar and language toggle; focus visibility; tap targets ≥ 48 px on mobile controls (WCAG 2.5.5 is 44 px; the skill sets 48 px); colour contrast with measured ratios, not estimates.
- **Core Web Vitals:** cold and warm runs, medians of ≥ 3 runs per row; trace the LCP element's render path for the signed-in dashboard; check the Landing render delay.
- **Best practices:** security headers already verified in R93 (HSTS, CSP, `frame-ancestors`); re-check `valid-source-maps` and console errors per page.
- **SEO:** unique title and description per public page; canonical; JSON-LD validation against `STRUCTURED-DATA.md`.
- **Apply rule:** fix only what a measurement or a check confirms. No layout change without a before and after screenshot.

## Verification
- Client: `npx vitest run`: 54 files, 270 tests, all passed (final code). `npm run build`: exit 0 (`r94d`).
- Perf budget: passes (entry JS 25.076 KB; entry CSS 58.90; total CSS 65.22; learn 24.10; fonts 126.31 raw).
- Server: `npx vitest run`: 2148 passed, 15 skipped, 45 failed (all in `master-bank.test.js`, baseline; unchanged from R93). No server file changed in R94.
- Lighthouse: see table and `R94-lighthouse-summary.json`.
- Browser probes (Playwright): warm-profile navigation count (1 load after fix; 2 before), teacher and admin notification calls and API errors (as above).
- Release zip: `releases/MED-School-FINAL-2026-11-06-R94.zip` (1051 files, 31.4 MB). `check-release-zip.mjs` passed (54 question-bank payloads, 79 feature markers). The zip contains no plain `.env` (the bundled template is `.env.ready`).

## Sandbox notes
- Lighthouse runs need `LD_LIBRARY_PATH=/home/user/lh/al2023/lib`; the Chromium launcher is `run-lh3.mjs`. New in R94: `CLEAR_ITEMS` (clear named profile folders) next to `CLEAR_CACHE`.
- The server keeps `index.html` in memory after a build: restart after every build before measuring.
- Stale browser profiles reproduce the reload effect. Measurements must state the profile state.
- `npm ci` in `server/` needs `npm_config_nodedir=/usr/local` in this sandbox.
