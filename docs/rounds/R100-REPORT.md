# R100 — virtual-patient case screen, learner access, dark headings, solid-text token (2026-11-07)

Version: `2026.11.07-r100-vp`. Branch `arena/3419d01b-med`. Builds on R99 (`e870385`).
Skills: `ui-ux-pro-max` (accessibility), `design` / `design-system` (tokens). Measurement: axe-core 4.14.0
in a Playwright browser (both themes), pixel comparison with `pngjs`, Vitest (client and server),
`npm run build`, `npm run perf:budget`, `npm run audit:gate`.

## 0. Scope, stated plainly

- **Done, a real production bug:** no competitive learner could open a virtual-patient case. The
  case screen returned "this case belongs to the university track" for every learner. Fixed, with tests.
- **Done:** the learner's virtual-patient screens had a second top bar and two axe findings. Fixed.
- **Done:** a dark-mode bug: six headings and timers were nearly invisible. Fixed (found by a screenshot;
  axe does not flag it).
- **Done:** token migration for solid-fill text (`#fff` → `var(--on-solid)`, 165 places), pixel-neutral.
- **Not done:** the rest of the token migration. CSS raw hex is 864 (was 998 at the start of this round).
  JSX raw hex is 571. Most are palette values, not white text, and each needs a design decision.
- **Not done, found this round (open, needs an owner decision):** an unfinished encounter whose AI
  evaluation fails blocks new encounters (section 6).
- **Lab-only data changes:** see section 7. None of them are code.

## 1. The case-screen bug (production)

Symptom: a learner opens the virtual-patient tab, chooses a case, and sees
"بارگذاری پرونده — این کیس مال مسیر دانشگاه است، نه مسیر رقابتی".

Two causes, both in `server/src/routes/content.js`:

1. `r.use('/cases', …)` returned 403 `university_only` for every learner on every `/cases` route, before
   the single-case handler ran. The case screen calls `GET /cases/:id` for every learner
   (`client/src/pages/Exam.jsx`), so no learner could read any case.
2. Even without (1), the single-case handler called `canAccessCase()`, which returns `false` for learners.
   The learner's real gate is different: the learn track, plus the VP switch (`vpatientAccess`).

Fix:
- The guard lets a learner read one case by id (`GET /cases/:id`, `/^\/\d+$/`). The case list and every
  other `/cases` route stay closed for learners.
- The handler skips `canAccessCase()` for learners. It keeps the learn-track check and the VP check,
  and still returns `studentSafeCase()`, which removes answer-key fields.

Tests: `server/test/r100-learner-case-read.test.js` (6 tests). Against the old code, 2 fail (the VP-off and
VP-on reads). The other 4 cover the intended refusals (university case, list, student, write). Against the fix, 6 pass.

Not traced: when the blanket guard was added. It is in the current code. The R87 comment in
`VpatientHub.jsx` says the learner screen was reachable from R87, so the guard may have come later.
I did not check git history for this.

## 2. Learner shell: duplicate top bar and axe findings

- `CaseList` always rendered its own `TopBar`. Inside LearnApp, the shell already has one, so the learner saw
  two. Fix: `CaseList` gets an `embedded` prop, like `Flashcards` and `Exam`. `VpatientHub` passes
  `embedded` to both screens. Staff pages are unchanged (`embedded` defaults to false).
- axe `region` (moderate): the program switcher sat outside any landmark. It is now `<nav aria-label>`.
- axe `scrollable-region-focusable` (serious): `.tab-content` in the case panel scrolls but could not be
  focused. It is now `role="region"`, `tabIndex={0}`, with a label that follows the active tab.

Result: on the learner VP list and case (light and dark, desktop), axe reports 0 rules and 0 nodes.

## 3. Dark-mode headings (found by a screenshot)

`.section-title h2`, `.login-card h2`, `.timer`, `.score-ring .val`, `.ddle-title` and `.lb-head h3` were
coloured `var(--header)`. That token is the navy header **background** (`#0e1730` in dark). On dark
surfaces the text was nearly invisible: for example the student welcome heading, and the case title.

Fix: `--header-ink` in `design-refresh.css`. Light: `#26527a`, the same as light `--header`, so light
pixels do not change. Dark: `#eaf1ff`. Six rules now use `var(--header-ink)`.

axe did not report this, because the contrast check returned "incomplete" (not "violation"). The
measured value came from `getComputedStyle`: `rgb(14,23,48)` before, `rgb(234,241,255)` after.
The guard test `on-solid-token.test.js` fails if `color: var(--header)` returns.

## 4. Solid-text token and pixel check

- `--on-solid:#ffffff` is defined once, in `:root` (a token with the same value in both themes).
- 141 CSS declarations and 24 JSX inline styles replaced `#fff` / `#ffffff` with `var(--on-solid)`.
  Only the text colour changed (`color:` declarations). Backgrounds and borders were not touched.
- Guard: `client/src/on-solid-token.test.js` (3 tests): the token is defined as white in `:root` only, no
  raw text-colour white remains, and `--header` is never a text colour.

Pixel check (same capture method, animations off, before and after the token change):

| Screen | Result |
|---|---|
| landing light / dark | identical |
| public VP light | identical |
| student light / dark | identical in light; dark differs only in the welcome heading (section 3) |
| teacher light | identical |
| admin light | identical |
| admin dark | differs in the page-heading area only (bounding box `x1209–1334, y107–137`; the heading was not cropped) |
| learner home mobile light, desktop dark | differ only in the rotating tip text (random per load); checked by cropping |

The comparison tool is `pixdiff.mjs` (lab). The raw captures are in `/home/user/r100-base` and `/home/user/r100-after2`.

## 5. Evidence

| Check | Result |
|---|---|
| `server/test/r100-learner-case-read.test.js` | 6 passed (2 fail on the old code) |
| Full server Vitest | 2177 passed, 15 skipped, 45 failed. The 45 are the pre-existing `test/master-bank.test.js` failures (R96 and R97). Not caused by R100. |
| Full client Vitest | 304 passed (62 files), including the 3 new guard tests |
| `npm run build` | exit 0 (`/home/user/r100-build4.log`) |
| `npm run perf:budget` | passed. Entry JS 25.0947 KB (the owner's gate is 25.1). Entry CSS 59.415 KB of 60. Total CSS 65.745 KB of 66. **Headroom on total CSS is now 0.255 KB.** |
| `npm run audit:gate` | run at R99; no dependency change in R100 |
| axe, light, 7 standard screens | 0 / 0 (`/home/user/axe-r100-light.json`; run before the header-ink change, which keeps the light value unchanged) |
| axe, dark, 7 standard screens | 0 / 0 (`/home/user/axe-r100-final-dark.json`) |
| axe, learner VP list and case, light and dark | 0 / 0 |

## 6. Open findings (not fixed here)

1. **Blocked by an unfinished encounter (needs an owner decision).** An encounter that finished or timed out
   without grading blocks a new encounter (`findGradingPending`, `server/src/lib/timed-session.js`). Background
   grading retries. In the lab, two learner sessions failed three times with `ai_evaluation_unavailable`
   (the lab AI is in mock mode), so the learner was refused "previous encounter still being recorded"
   for as long as it ran. In production, an AI outage would block every learner who had an open encounter.
   The options are a time limit after which the encounter goes to review, or a clear message with a way out.
   This changes how grades are recorded, so I did not decide it alone.
2. **Error-state heading order (moderate, axe).** The start-error card uses `<h3>` with no `<h2>` before it
   (`Exam.jsx`, the boot-error state). It only appears when the start fails.
3. **Sticky learner HUD overlaps the sidebar top** on the case screen (visual, desktop).
4. **Mobile virtual patient not captured.** The mobile "more" sheet needs its own navigation step.
5. **Token migration (partial).** CSS raw hex 864, JSX raw hex 571. Palette values (`#64748b`, `#2f7fd1`,
   and others) need a semantic-name decision before they can move to tokens.
6. **CSS budget headroom 0.255 KB.** The next CSS change needs a trim.
7. **Server suite 45 pre-existing failures** (`master-bank`), content owned by the question-bank owner.

## 7. Lab-only changes (not in the repo)

To reach the case screen in the lab, I changed the lab database `/home/user/data-ui/medlab.db`:

- Virtual patient switch: enabled, `premium_only: false` (admin API, `PUT /api/admin/vpatient`).
- Three lab cases (ids 1, 2 and 3) set to `track: "learn"` in `data_json`. The lab had no learn-track
  cases, so the learner list was empty. This is data, not a code bug: an admin promotes a university case
  (`case-promotions`) to create a learn-track case.
- Two stale learner encounters (user 14) set to `review_required=1`, so the grading gate released.

Production is not affected by these changes.

## 8. Files

- Server: `server/src/routes/content.js`, `server/test/r100-learner-case-read.test.js`.
- Client: `client/src/pages/Exam.jsx`, `client/src/pages/CaseList.jsx`, `client/src/pages/learn/VpatientHub.jsx`,
  `client/src/pages/learn/LearnApp.jsx`, `client/src/styles.css` (header-ink, 6 rules),
  `client/src/design-refresh.css` (R100 block: `--on-solid`, `--header-ink`), token migration across ~30 CSS and JSX files,
  `client/src/on-solid-token.test.js`.
- Screenshots: `screenshots/r100/` (15 PNG, README), `screenshots/r100/before/` (3 PNG).
- `VERSION.txt` = `2026.11.07-r100-vp`.
