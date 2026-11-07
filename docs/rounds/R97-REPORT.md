# R97 — learner payload gate and first design pass (2026-11-07)

Version: `2026.11.07-r97-ui`. Branch `arena/3419d01b-med`. Builds on R96 (`1126aa4`).

## 1. Learner payload gate (owner decision: teasers only)

Rule (owner, R96): a free learner sees only the three teaser cards on `GET /api/flashcards`,
the same rule as `/learn/browse`. Implemented in the uncommitted R96 gate work and committed here:
`server/src/lib/bank-pool.js` (pool, cache, `lockedTeaserIds`, `browsePoolSignature`),
`server/src/routes/learn.js`, `server/src/routes/content.js`.
Test: `server/test/r96-learner-bank-gate.test.js` (6 tests, passing).

Measured after the gate (lab DB `/home/user/data-ui`, 11,665 learn cards, server time and
decoded body size, `curl`):

| Account | Cards returned | Body | Server time |
|---|---|---|---|
| Free learner (`learner`) | 3 | 28 KB | 13 ms |
| Student (`40012345`) | 4 | 9 KB | 6 ms |
| Premium learner (`learner`, premium set for the test) | 11,605 | 90.9 MB | 2.5–2.9 s |

Before the gate (R96 baseline): about 91 MB and 2.5–3.1 s for a free learner.
**Open:** premium learners still receive the whole bank in one response, so the premium
payload is unchanged. Reducing it needs paging or a search API and a client change. This is
an owner decision (see section 4). The premium test flag was reverted in the lab database.

## 2. Design pass (first step)

Reference: Notion entry of `VoltAgent/awesome-design-md`. Process: `ui-ux-pro-max` skill
(design-system search, RTL-aware). The generic recommendation (claymorphism, Baloo 2) was
rejected for this audience. The decision and the token rules are in `docs/design/DESIGN.md`.

Changes:
- `client/src/pages/learn/LearnHome.jsx`: 8 emoji (wave, target, party, warning, compass, strength,
  gift ×3) replaced by the shared SVG `Icon` set. The wave emoji in the greeting was removed.
- `client/src/pages/learn/LearnHome.icons.test.js` (new, 2 tests): fails if pictographic emoji come
  back into the learner home (verified red on the R96 file: 9 matches; green now: 0).

Screenshots (desktop, learner home) were checked before and after. The boxes that used to render
as empty glyphs are now icons. The rest of the layout is unchanged.

## 3. Verification

| Check | Result |
|---|---|
| Server suite (`npx vitest run`) | 2163 passed, 15 skipped, 45 failed. All 45 are the pre-existing `test/master-bank.test.js` failures (baseline in R96: 2157 / 45). +6 new passing tests. |
| Client suite (`npx vitest run`) | 57 files, 280 tests passed (R96: 278; +2 icon guard tests). |
| `npm run perf:budget` | Passed. Entry JS **25.0947 KB** (was 25.0908, +0.004 KB from the icon imports; limit 25.1). Entry CSS 58.95, total CSS 65.27 (limit 66), learn app 24.11, fonts 126 KB. |
| `npm run audit:gate` | Passed. Production deps: 0 critical, 0 high. |
| Browser check | No console errors on the learner home after the restart. |

Note: the measured entry JS moved from 25.0908 to 25.0947 KB (+0.004 KB). It is still under the
25.1 KB limit, but the standing rule is to keep the figure at 25.0908 unless the owner approves a
change. **The owner should confirm this change.** The number is not silently raised; the gate
value itself (25.1) was not edited.

## 4. Not done in this round, and open decisions

1. **Premium learner payload (owner decision needed).** Options: (a) server-side paging of the
   bank for premium learners with a client change; (b) keep the full bank and cache it on the
   client. Option (a) is recommended. No change was made without the owner's decision.
2. **Public `/vp` page is dark while the app is light.** A theme decision for the owner; not
   changed.
3. **Learner home still has about eight cards with competing accents and gradients,** including
   the premium banner. Reducing them is a product decision (the premium banner is a revenue
   surface); not changed.
4. **Student home is sparse** (one classes card and three stat tiles). A redesign needs the
   owner's priorities for that screen; not changed.
5. **Virtual-patient case screen was not re-audited in this round.** Next step.
6. **Admin learn-cards** remains at about 215–246 ms warm (R96 deferred).

## 5. Environment notes

- The `ui-ux-pro-max`, `design`, and `design-system` skills are installed in `~/.claude/skills`.
  The first copy attempt picked the wrong `SKILL.md` (`banner-design`); it was removed and the
  correct skill was copied.
- The Playwright lab is in `/tmp/uilab`. Chromium needs `LD_LIBRARY_PATH=/tmp/al2023x/lib`
  (unpacked from `@sparticuz/chromium`).
- The lab data directory is `/home/user/data-ui` (seeded with `SEED_ALLOW_PRODUCTION=1`).
  It is not part of the repository.
