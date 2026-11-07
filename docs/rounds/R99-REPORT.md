# R99 — student dashboard redesign (2026-11-07)

Version: `2026.11.07-r99-student`. Branch `arena/3419d01b-med`. Builds on R98 (`12b7b07`).
Skills: `ui-ux-pro-max` (dashboard and bento rules), `design` / `design-system` (token and
component structure), reference `docs/design/DESIGN.md`. Measurement: axe-core 4.14.0 in a
Playwright browser, both themes; Vitest; `npm run build`; `npm run perf:budget`.

## 0. Scope, stated plainly

- **Done:** the student home (`client/src/pages/StudentHome.jsx`) was redesigned. The long
  full-width box is gone. It is replaced by one next-step card, a stats column, and compact
  module cards.
- **Done:** a layout test (`StudentHome.layout.test.jsx`, 5 tests). Each test failed before the
  change and passes after it.
- **Not done:** the virtual-patient case screen, the rest of the token migration (about 900 raw
  hex values in CSS, about 530 in JSX), and the VP learner-list diagnosis. These stay open.
- **Not verified visually:** the state with an open exam, or with two or more modules. The lab
  student has neither. Structure is covered by the test, not by pixels.

## 1. Research (before the change)

Sources read: uitop.design (2025 dashboard trends), brightinstudio (2026 SaaS checklist),
orbix.studio (2026 dashboard practice; bento grid), pencilandpaper (next-action pattern),
lexingtonthemes (responsive bento), superdesign (bento CSS; warns that `grid-auto-flow: dense`
breaks focus order), vp0 (size tiles by importance). Rules taken from them:

1. One primary purpose. The most important status and action are easy to find.
2. The next action is in the empty or success state. Do not show a dead end.
3. Size tiles by importance, not decoration. Keep DOM order equal to visual order.
4. Colour is not the only signal. Each interactive tile has an icon.
5. Empty and error states guide the next step.
6. Mobile prioritises rather than just stacking.

## 2. Diagnosis

Root cause of the "long box": `StudentHome.jsx` used `grid-${Math.min(modules.length, 3)}`. With
one module, `grid-1` gave a single full-width `.mod-card-row`. A lone module spanned the
whole page. The two link tiles (exams, classes) had no icon and no affordance. The progress
tile was not interactive but looked the same as the links.

## 3. Changes

- **Hero (`.sd-hero`).** One card. If the student has an open exam, it lists those exams, each
  with a `btn-accent` "enter exam" button. Otherwise it shows the first module with one
  explicit action button. The button is pinned to the bottom (`justify-content: space-between`).
- **Stats column (`.sd-stats`).** Two link buttons (exams → `myExams`, classes → `enterClass`)
  with an icon and a pointer cursor. The progress tile is a non-interactive `div`.
  The column is 3 tiles in a row on mobile and a vertical stack on desktop.
- **Module cards (`.sd-mods`).** The remaining modules are compact cards, `auto-fit`
  `minmax(240px, 1fr)`. Each card sizes to its content. There is no `grid-N` class.
- **Desktop grid.** From 900 px: hero (2fr) beside the stats column (1fr), `align-items: stretch`.
- **Empty state.** Kept as before (`noExamsAssigned`).
- **Not used:** `grid-auto-flow: dense`. It would break focus order, which the superdesign
  reference warns about.

Module actions are unchanged: exams → `myExams`, classes → `enterClass`, caseList → `startVp`.

## 4. Evidence

| Check | Result |
|---|---|
| `StudentHome.layout.test.jsx` | 5 passed (5 failed before the change) |
| `design-tokens.test.js`, `a11y-landmarks.test.js` | pass |
| Full client Vitest | 301 passed, 0 failed (`/home/user/r99-client-tests.log`) |
| Server `npm test` | 2171 passed, 15 skipped, 45 failed. The 45 are the pre-existing `test/master-bank.test.js` failures, the same as R96 and R97 (`/home/user/r99-server-tests.log`). Not caused by R99: no `server/` file changed. |
| `npm run audit:gate` | passed (0 high or critical in production deps) |
| `npm run build` | exit 0 (`/home/user/r99-build2.log`) |
| `npm run perf:budget` | passed (`/home/user/r99-perf2.log`) |
| axe, student home, light | 0 rules, 0 nodes |
| axe, student home, dark | 0 rules, 0 nodes |

Budgets after R99: entry JS 25.088 KB (gate 25.1). Entry CSS 59.331 KB (limit 60). Total CSS
65.656 KB (limit 66). Headroom on CSS is about 0.35 KB, so the next CSS change will need to
trim something.

Screenshots: `screenshots/r99/` (4 PNG, `README.md`). Before-shots are in `screenshots/r98/`.
Visible result on desktop light: the hero sits beside a stats column, and the button is at
the bottom of the hero. There is no full-width box.

## 5. Open items

- The VP case screen audit (the Exam page with a case) is still open.
- The rest of the token migration (CSS hex about 900, JSX about 530) is still open.
- The VP learner-list diagnosis is still open (the lab VP is off).
- The server suite's 45 `master-bank` failures are pre-existing. They should be fixed or the
  test expectations updated by the content owner. Not touched in R99.
- The open-exam and multi-module states should get a screenshot when a lab student has data
  for them.
