# R97 — learner payload (paging) and first design pass (2026-11-07)

Version: `2026.11.07-r97-ui`. Branch `arena/3419d01b-med`. Builds on R96 (`1126aa4`).

## 0. Owner decisions in this round

- **Entry JS budget:** the owner accepted the change from 25.0908 KB to 25.0947 KB (+0.004 KB, from
  the icon imports in `LearnHome.jsx`). Gate value unchanged at 25.1 KB. See section 4 for the
  additional +0.001 KB that appeared after the deck work.
- **Premium payload:** the owner approved server-side paging. Implemented as a light deck summary
  plus deck-start body fetch (section 1).
- **Second approval (2026-11-07, "تایید می‌کنم"):** read as acceptance of the two recommendations
  in the previous report: the budget figure, and a per-session cap for learner "practice all"
  (implemented at 200 cards, section 1b). Course labels on the bank are still a content task.
- **Paywall rule (R96):** unchanged. Free learners get the three teasers.

## 1. Learner payload

### What was wrong

The learner's flashcards picker called `GET /api/flashcards` and received the whole competitive
bank (11,605 full cards, about 91 MB decoded). The picker needs only `id`, `topic` and the
category/course labels to group and filter. The full bodies are needed only for the deck that the
learner starts.

### What changed

- `GET /api/flashcards?summary=1` (learner only): returns `{id, topic, category*, course*}` per card.
  Same rows, same teaser gate, demo seed cards excluded, corrupt rows skipped. Other roles ignore
  the parameter. Module: `server/src/lib/flashcard-summary.js`. Route: `server/src/routes/content.js`.
- The summary is parsed once per bank signature (`BANK_SIG_SQL`) and kept in memory.
- `client/src/pages/Flashcards.jsx`: learners boot on the summary. Starting a deck fetches the full
  bodies with `GET /api/flashcards?ids=…`, 200 ids per request. A spinner shows while this loads.
  Exams and class runs are unchanged. Staff are unchanged.

### 1b. Session cap (learner)

A learner session loads at most **200 cards** (`LEARNER_SESSION_CAP` in `Flashcards.jsx`). When a
deck is larger, a random sample of 200 is practised. The picker button shows the real session size,
for example "Practice all cards (200)". Exams, class runs and staff are not capped.

Effect on the lab deck: "practice all" for 11,605 cards used to load 86.7 MB in 59 requests. Now it
loads 200 cards (1,605 KB decoded, about 8.0 KB per card) in one request. The cardio topic deck (534 cards) loads 200 cards.
The earlier estimate of 6.3 KB per card was low; the measured figure is used here.

### Measured (lab DB `/home/user/data-ui`, 11,665 learn cards)

| Request (premium learner) | Items | Size | Time |
|---|---|---|---|
| Picker boot `?summary=1`, first call after restart / bank change | 11,605 | 320 KB raw, 31 KB gzip | 1.24 s (cache build, once) |
| Picker boot, warm | 11,605 | 320 KB | 6 ms |
| Topic deck "cardio" (from a virtual-patient link) | 534 | about 4.3 MB in 3 requests | about 0.1 s per request |
| "Practice all" (whole bank as one deck) | 11,605 | **86.7 MB in 59 requests** | 3.9 s total |

Before this round the picker call alone was about 91 MB and 2.5–2.9 s on every open.
Free learner (`learner` account, not premium): 3 teaser cards on boot, about 28 KB before this
round.

### Browser check (390 px, learner, `/#flashcards?topic=cardio`)

- Boot: one request, `GET /api/flashcards?summary=1`.
- Start "Practice all cards (534)": three `ids` requests (200, 200, 134 ids), then card 1 of 534
  shows the full question. No console errors.

### Tests

- `server/test/r97-learner-summary.test.js` (8 tests): summary keys are limited to the picker
  fields; summary ids equal the full learner list (premium and free); demo cards are excluded from
  both; labels match the full list; body fetch by ids matches the full list; a bank change appears
  in the summary; other roles ignore `summary=1`.
- `client/src/pages/Flashcards.learner-summary.test.jsx` (3 tests): learner boots on the summary;
  starting a deck fetches bodies by id; student boots on the full list and does not fetch by id.

## 2. Open issues — decisions for the owner

1. **Course labels on the bank (content work).** Only 1 of 11,605 bank cards has a `category` or
   `course` label, so the course view is one deck. The session cap (section 1b) bounds the cost of
   a session, but the picker is still not useful by course until the labels exist. Owner to decide
   who fills them and when.
2. **Cache cost on bank edits.** The summary cache signature covers every active flashcard,
   including university cards. A teacher edit to a university card rebuilds the learner summary on
   the next learner request (about 1.2 s once). Making the signature bank-only would mean scanning
   rows on every request, so this was not changed.
3. **Public `/vp` page is dark while the app is light.** Theme decision; not changed.
4. **Learner home has about eight cards with competing accents and gradients,** including the
   premium banner. Product decision; not changed.
5. **Student home is sparse** (one classes card, three stat tiles). Needs the owner's priorities.
6. **Virtual-patient case screen, admin and teacher pages** not audited with axe this round. The
   design-token pass (`client/src/design-refresh.css`) has not started.
7. **Admin learn-cards** still 215–246 ms warm (deferred in R96).

## 3. Design pass (first step)

Reference: Notion entry of `VoltAgent/awesome-design-md`. Process: `ui-ux-pro-max` skill
(design-system search, RTL-aware). The generic recommendation (claymorphism, Baloo 2) was rejected
for this audience. Decision and tokens: `docs/design/DESIGN.md`.

- `client/src/pages/learn/LearnHome.jsx`: 8 emoji replaced by the shared SVG `Icon` set; the wave
  emoji in the greeting removed.
- `client/src/pages/learn/LearnHome.icons.test.js` (2 tests): fails if pictographic emoji return
  (red on the R96 file: 9 matches; green now: 0).
- Desktop before/after screenshots of the learner home: the empty emoji boxes are now icons. The
  layout is otherwise unchanged.

## 3b. Accessibility audit (axe-core 4.14.0, five key screens)

Skill: `ui-ux-pro-max`, accessibility rules (landmarks, labels, contrast). Method: `/tmp/uilab/axe-run.mjs`
audits five screens in a Playwright browser (one browser per screen) against the lab server. The
results are in `/home/user/axe-base.json` (before) and `/home/user/axe-after.json` (after).

| Screen | Before (rules / nodes) | After |
|---|---|---|
| Landing (anonymous) | 0 / 0 | 0 / 0 |
| Virtual patient sign-in `/vp` (anonymous) | 1 / 1 (`landmark-unique`) | 0 / 0 |
| Student home | 2 / 3 (`landmark-one-main`, `region`) | 0 / 0 |
| Learner home | 3 / 19 (`heading-order`, `landmark-one-main`, `region`) | 0 / 0 |
| Flashcards picker | 2 / 7 (`landmark-one-main`, `region`) | 0 / 0 |

Baseline: no critical or serious findings, and no colour-contrast or button-name failures. Every
finding was moderate and was about landmarks or heading order.

Fixes (each is a single, asserted edit):
- `LearnApp.jsx`: the learner content `#learn-main` is `role="main"`. The top bar row (back button,
  HUD, notification bell) is a labelled `section` so it sits inside a region.
- `StudentHome.jsx`: the loaded-state container is `role="main"`.
- `VirtualPatientPage.jsx`: the `/vp` wrapper was a second labelled `section` with the same name as
  the login card. It is now a `div`. The login card keeps `section#vp-login`.
- `PremiumBanner.jsx`: the title is `h3` (was `h4`, which skipped a level).

Guards: `client/src/a11y-landmarks.test.js` (5 tests, red before the fixes, green after). It reads
the source, so it runs without a browser.

Not covered by axe in this round: the virtual-patient case screen, admin, and teacher pages.
Contrast was not measured against the design tokens (see section 2, item 6).

## 4. Verification

| Check | Result |
|---|---|
| Server, learner gate + summary + index tests | 21 passed (r97 summary 8, r96 gate 6, r96 index 7) |
| Server full suite | 2171 passed, 15 skipped, 45 failed. All 45 are the pre-existing `test/master-bank.test.js` failures (R96 baseline 2157 / 45) |
| Client full suite | 59 files, 289 tests passed (R96: 278; log `r97-client-tests4.log`) |
| axe re-run (5 screens) | 0 rules on every screen (section 3b) |
| `npm run perf:budget` | passed. Entry JS **25.0898 KB** (below the original 25.0908; gzip size varies with chunk hashes; gate 25.1). Entry CSS 58.95, total CSS 65.27 (limit 66), learn app 24.11 (limit 25), fonts 126 KB |
| `npm run audit:gate` | passed (0 critical, 0 high) |
| Browser flow (learner deck, 390 px) | no console errors; `summary=1` (312 KB decoded) then one `ids` request with exactly **200** ids (1,605 KB decoded); picker label "Practice all cards (200)" |
| Learner home, flashcards picker | screenshot after the a11y fixes: top bar unchanged, cap label shown |

**Budget assumption (for the owner to confirm):** the owner's "تایید می‌کنم" reply is read as approving
the entry-JS figure of **25.0957 KB**, the value after the paging work, which was 0.001 KB over the
25.0947 KB figure from the icon change. The gate stays at 25.1 KB. The a11y fixes did not change the
measured figure (still 25.0898 KB). The budget was not raised. After
the final cap change the measured figure is 25.0898 KB, below the original 25.0908 KB and under the
25.1 KB gate. The gate was not edited.

## 5. Environment notes

- Skills installed in `~/.claude/skills`: `ui-ux-pro-max`, `design`, `design-system`.
- Playwright lab: `/tmp/uilab`. Chromium needs `LD_LIBRARY_PATH=/tmp/al2023x/lib`.
- Lab data: `/home/user/data-ui` (seeded with `SEED_ALLOW_PRODUCTION=1`), not part of the repo.
  The premium flag used for measurement was reverted.
