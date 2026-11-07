# R98 — text-ink tokens, dark-theme contrast, staff landmarks (2026-11-07)

Version: `2026.11.07-r98-design`. Branch `arena/3419d01b-med`. Builds on R97 (`64367b1`).
Skills: `ui-ux-pro-max` (accessibility rules: contrast, landmarks), `design` / `design-system`
(token structure, reference in `docs/design/DESIGN.md`). Measurement: axe-core 4.14.0 in a
Playwright browser, both themes.

## 0. Scope, stated plainly

- **Done:** a measured dark-theme audit (it had never been run); text-ink tokens for status
  colours, with a guard; a `main` landmark for the admin and teacher panel; one dark-theme
  rule fixed for a button. Light and dark are both at zero axe findings on seven screens.
- **Not done:** the full token migration. The repo still has about 900 raw hex values in CSS
  and about 530 in JSX. This round moved only text colours that used status fill tokens.
- **Not done:** the virtual-patient case screen (`Exam.jsx` with a case). It could not be reached
  in the lab. See section 4.

## 1. Dark-theme audit (new)

The earlier audits ran in the light theme only. Running the same five screens in the dark
theme, plus the teacher and admin homes, found real failures:

| Screen (dark) | Before | After |
|---|---|---|
| Landing (anonymous) | 1 rule, 3 nodes (`color-contrast`: heart on the mock card 3.42:1; muted on the mock card 4.4:1; the footer brand, black on dark, 1.25:1) | 0 |
| Flashcards picker | 1 rule, 1 node (`color-contrast`: heart on the card 4.42:1) | 0 |
| Student home | 0 | 0 |
| Learner home | 0 | 0 |
| Teacher home | 2 rules, 9 nodes (`landmark-one-main`, `region`) | 0 |
| Admin home | 2 rules, 21 nodes (`landmark-one-main`, `region`) | 0 |

Light theme, same seven screens: the teacher and admin homes had the same two landmark rules
(9 and 21 nodes). Those are fixed too. The other five light screens were already at zero
(section 4 of R97).

Raw data: `/home/user/axe-dark-base.json`, `/home/user/axe-light-wide.json` (before),
`/home/user/axe-dark-after.json`, `/home/user/axe-light-after.json` (after). Script:
`/tmp/uilab/axe-wide.mjs <base> <out> <light|dark>`.

## 2. Changes

### 2a. Text-ink tokens

- New tokens in `client/src/design-refresh.css`, in a block marked `R98 text-ink tokens`:
  `--danger-ink`, `--ok-ink`, `--warn-ink`, `--heart-ink` (both themes), and new values for
  `--muted` and `--muted2` in both themes. The fill tokens are unchanged, so backgrounds,
  borders and badges keep their colours.
- Migration: 47 CSS `color:var(--danger|ok|warn|heart|green2|accent2)` and 19 JSX inline
  `color: "var(--…)"` text colours now use the matching `-ink` token. `green2` and `accent2`
  map to `--ok-ink`. Border and background uses were not touched.
- `.hud-chip.heart`, `.mock-pill.heart` and `.lp-chip.heart` (light) use `--heart-ink`
  (light value unchanged, `#b7362f`).
- Dark mock card: `[data-theme="dark"] .mock-league{ --muted:#b4c1d9 }`. The mock card is a
  darker surface than the panel, and this is the one scoped override.

Visible effect: in light, status text (errors, "correct" labels, warnings) is a little
darker. In dark, heart and danger text is a little brighter. Fills look the same.

Guard: `client/src/design-tokens.test.js` (6 tests). It reads the R98 block, checks each token
on every surface in both themes at 4.5:1 or better, and fails if any CSS or JSX file colours
text with a fill token.

### 2b. Landing brand (button default colour)

`.lp-brand` is a `<button>`. Buttons do not inherit `color` by default, so it rendered black on
the dark footer. Fixed with `color: inherit` in the R98 block. On the light landing page the
brand text is now the page text colour (`#1e2b3d`), not black.

### 2c. Staff panel landmark

`client/src/pages/Admin.jsx`: the `container` under `app` is `role="main"`. This is shared by
the admin and teacher panels. Guard: 1 test in `client/src/a11y-landmarks.test.js`.

### 2d. Version

`VERSION.txt` → `2026.11.07-r98-design`. This sets the service-worker cache key
(`stamp-sw` → `medschool-2026.11.07-r98-design`).

## 3. Verification

| Check | Result |
|---|---|
| Targeted tests (design tokens, landmarks, Admin) | 42 passed |
| Client full suite | 60 files, **296 tests passed** (R97: 289) |
| Server suite | not run this round; no server files changed |
| `npm run build` | exit 0 |
| `npm run perf:budget` | passed. Entry JS **25.0850 KB** (gate 25.1). Entry CSS gz **59.07** (limit 60). Total CSS gz **65.40** (limit 66). Learn app 24.13 (limit 25). Fonts 126.31 KB (limit 150) |
| `npm run audit:gate` | passed (0 high or critical in production deps) |
| axe, dark, seven screens | **0 findings on all seven** |
| axe, light, seven screens | **0 findings on all seven** |
| Browser: dark flash picker and dark admin home | screenshots reviewed (`/home/user/r98-flash-dark.png`, `/home/user/r98-admin-dark.png`) |

**Budget note:** the total CSS gzip headroom is now 0.6 KB (65.40 of 66). The next CSS change
will need a decision on the limit or a reduction. The migration was roughly size-neutral: it
replaced variable names of about the same length.

## 4. Virtual-patient case screen: not audited

The case screen is `Exam.jsx` with a `caseId`. Routing is in-memory state (`go()`), not a URL,
so it has to be reached by clicks. In the lab that path does not exist for a normal user:

- Competitive VP is off by default (admin switch `vpatient.enabled`, a settings row that is
  absent in the lab). With it off, the learner sees "بیمار مجازی در حال حاضر فعال نیست".
- I enabled it for a probe (`PUT /api/admin/vpatient`, `enabled: true`, `premium_only: false`).
  The learner list then showed "هیچ آزمونی برای شما تعریف نشده است" ("no exam is defined for
  you"). The cause is not diagnosed yet.
- The student `40012345` has zero exams assigned, so the classes route does not reach a case.

**Lab state changes, all reversed:**
- `vpatient` settings row: created by the probe, then deleted. The DB is back to "no row".
  `GET /api/admin/vpatient` returns the default config (`enabled: false`).
- `learner` (user_id 14) premium: set to 1 for the flashcard-picker check, then reset to 0
  (`premium_until` NULL). Verified 0 after each change.

To audit the case screen, the lab needs a published exam or class assignment for a test
student. That is content setup, so it is left open.

## 5. Open items

1. **Virtual-patient case screen, teacher exam screens, admin editors:** not audited with axe.
   Blocked on lab content (section 4).
2. **Design-token migration:** about 900 raw hex values in CSS and 530 in JSX still use literal
   colours. A full migration is a multi-round task. The text-ink layer is the first step, and
   the guard now stops new text uses of fill tokens.
3. **A dark-theme detail that axe does not flag:** the admin page title (top right, below the top
   bar) reads faint in dark mode. Check it by eye during the token pass.
4. **Course labels on the bank:** still a content task (R97, section 2, item 1).
5. **Learner VP case list empty in the lab** (section 4): diagnose before any VP-related change.
