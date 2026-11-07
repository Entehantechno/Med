# R96 — performance round (2026-11-07)

Scope: speed, measured with the skills (`core-web-vitals`, `performance`) and the
systematic-debugging / TDD / verification-before-completion workflow. Each change has a test
written first (red), a green run, and a before/after measurement on the same lab data.
All numbers are lab numbers (one machine, sandboxed Node and SQLite, a seeded dev database with
11,697 flashcards). None of them is field (CrUX) data.

## What changed (server)

| Endpoint (role) | Before (server time) | After (server time) | Change |
|---|---|---|---|
| `GET /api/flashcards` (student, teacher, admin) | 101–112 ms | 2–5 ms | expression index on the track + `INDEXED BY` + three-range non-bank predicate (`server/src/lib/flashcard-track.js`) |
| `GET /api/flashcards` (free learner) | ~2.5–3 s, ~91 MB decoded | 7–17 ms, 3 cards, 26 KB | teasers-only rule (see decision 1 below) |
| `GET /api/reports/summary` (teacher, admin) | 106–115 ms | 2–4 ms | flashcard counts use the track index, university filter after it |
| `GET /api/admin/overview` (admin) | ~200–213 ms | 2–3 ms | flashcard and bank counts use the track index |
| `GET /api/learn/browse` (learner, warm) | ~63–75 ms | 7–12 ms | covering index for the browse cache key (~35 ms of every request before); facet counts memoised per bank signature |
| `GET /api/admin/learn-cards` (admin) | 215–246 ms (2.8 s on the first build after restart) | unchanged | deferred (see below) |

Why the flashcards query was slow: each request parsed `data_json` (about 6 KB per row) for all
~11.7k rows, synchronously, on the event loop. Nothing new is stored in the table. The index is
`idx_flashcards_active_track ON flashcards(active, (CASE WHEN json_valid(data_json) THEN
json_extract(data_json,'$.track') END))`. The planner does not pick it for `IS NOT 'learn'`, so the
list reads `FROM flashcards INDEXED BY idx_flashcards_active_track`, and the non-bank predicate is
three index ranges (`IS NULL OR < 'learn' OR > 'learn'`). Equivalence with the old predicate is covered
by fixture tests (corrupt JSON, missing track, numeric track, inactive rows).

The browse cache key (`browsePool` signature) ran `COUNT/MAX/SUM` over the active rows, which read
the full 6 KB rows. `idx_flashcards_sig(active, revision, content_updated_at, updated_at, id)` is a
covering index for it (33.5 ms → 1.1 ms, same values).

The browse pool moved from `routes/learn.js` to `lib/bank-pool.js` (pure move, no behaviour change),
so `routes/content.js` can apply the same teaser rule without importing a route module.

Counts checked against a direct SQL count on the lab data: admin overview `flashcards 31 /
learnQuestions 11665`; teacher reports `cards 4`; admin reports `cards 31`.

## Decision 1 (owner, this round): free learners see only the three teasers on `/api/flashcards`

Finding (security, pre-existing, not caused by R96): `GET /api/flashcards` returned the whole
competitive bank (11,605 cards, premium-flagged included, with question text, options, explanations and
micro-lessons) to a learner who is not premium. The detail route `/api/learn/browse/:id` returned 402 for
the same card, and `/api/learn/browse` reported `premiumRequired: true`.

Owner choice: teasers only, the same rule as `/api/learn/browse` (`lockedTeaserIds`, the three newest
non-demo cards). The rule applies only to the `learner` role, only when `full_bank` is on, and only
when the learner is not premium (`getProfile(...).premium_effective`). Students, teachers, admins,
content managers and support keep their current lists.

Measured on the lab (free learner): before ~11,605 cards, ~91 MB decoded, 2.5–3 s server time;
after 3 cards, 25.8 KB, 7–17 ms server time.

## Open item: premium learners still get the full deck

The non-exam practice route `/flashcards` shows the whole list (no slicing in `Flashcards.jsx`).
For a premium learner the full deck is still returned: measured **7.28 MB on the wire** (gzipped, about
91 MB decoded) and **3.1 s of server time** (`full_bank` switched off for this measurement only, then
restored to 1). Reducing this without changing the practice deck needs a client change (paged or
session-sized loading), and a sampled deck would be a product change. Not done; needs a decision.

## Tests

- New: `server/test/r96-flashcard-track-index.test.js` (7 tests), `server/test/r96-browse-facet-memo.test.js` (4),
  `server/test/r96-learner-bank-gate.test.js` (6).
- Updated one source guard, `server/test/vp-stability.test.js`, which pinned the old literal predicate. It now pins the
  shared constant and the content.js selection.
- Server suite (final, after the teaser rule): 2163 passed, 15 skipped, 45 failed. All 45 are the same pre-existing
  `master-bank.test.js` failures as in R95.
- Client suite: 56 files, 278 tests passed (client code not changed in this round).
- `npm run perf:budget`: pass, `entryJsGzipKb` 25.0908 (unchanged, budget not raised).
- `npm run audit:gate`: pass, zero high or critical in production dependencies.

## Client measurements (lab, client code not changed in this round)

Playwright, mobile 390×844, CDP Slow-4G-like (150 ms RTT, 1.6 Mbps down), CPU 4× slower, cache disabled:

| Page | LCP | Notes |
|---|---|---|
| Landing, anonymous | 1,768 ms (1 run) | LCP element is the static hero H1 (`h1#landing-hero-title`) |
| Student home | ~468 ms (median of 3) | |
| Learner home | ~360 ms (median of 3) | total blocking time 562 ms in one run (main-thread work, see below) |
| Teacher home | ~416 ms (median of 3) | |

Lighthouse 12 (simulated throttling, landing, mobile, valid runs only): LCP 2,560 and 2,753 ms, TBT ~95 ms, CLS 0.032, score 94–95.

Findings that drive the next client work (not implemented here):
1. The main app stylesheet is 304 KB raw (about 59 KB gzipped), loaded globally by `main.jsx`
   (`design-refresh.css` 161 KB and `styles.css` 153 KB). Lighthouse reports 92.8% unused on the landing
   page (44.8 KB). A per-route split would fix this, but the cascade order matters, so it needs a visual
   regression check first. Not done in this round.
2. Learner home: about 2.7 s of browser style/layout/paint and about 0.6 s of JavaScript in the profile.
   The entry chunk and React account for most of the script time.

## Other open items

- Admin learn-cards: serializes all 11.6k cards on every request, and the first build after a restart
  took 2.8 s. Admin-only. The fix is a paged API. Deferred.
- CSS per-route split (client change, needs visual regression).
- Field measurement (CrUX), or desktop Lighthouse runs. Only the mobile lab runs above were done.
- Release zip: not rebuilt in this round (a 30 MB artifact). The R95 zip is still the latest tracked one.
- Infrastructure items (CDN, load balancer, deploy near the database, background queue) stay deferred.

## Environment note

The sandbox was reset during this round. `/home/user/Med` was re-checked out at `b4ec28f`, and it was
fast-forwarded to `origin/arena/3419d01b-med` (no reset or re-clone). The measurement scripts and lab
databases were lost in the reset; the numbers above were recorded before it. `server/` and `client/`
dependencies were reinstalled with `npm ci` (server: `npm_config_nodedir=/usr/local`), and the client was
rebuilt so the homepage SEO tests have `client/dist`.
