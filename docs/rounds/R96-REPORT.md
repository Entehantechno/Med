# R96 — performance round (2026-11-07)

Scope: speed, measured with the skills (`core-web-vitals`, `performance`) and the
systematic-debugging / TDD / verification-before-completion workflow. Every change below has a
test written first (red), a green run, and a measurement before and after on the same lab data.
All numbers are lab numbers (one machine, sandboxed Node + SQLite, a copy of a seeded dev
database with 11,697 flashcards). None of them is field (CrUX) data.

## What changed (server)

| Endpoint (role) | Before (server time) | After (server time) | Change |
|---|---|---|---|
| `GET /api/flashcards` (student, teacher, admin) | 101–112 ms | 2–5 ms | expression index on the track + `INDEXED BY` + three-range non-bank predicate (`server/src/lib/flashcard-track.js`) |
| `GET /api/reports/summary` (teacher, admin) | 106–115 ms | 2–4 ms | flashcard counts use the track index, university filter after it |
| `GET /api/admin/overview` (admin) | ~200–213 ms | 2–3 ms | flashcard and bank counts use the track index |
| `GET /api/learn/browse` (learner, warm) | ~63–75 ms | 7–12 ms | covering index for the browse cache key (was ~35 ms of every request); facet counts memoised per bank signature |
| `GET /api/admin/learn-cards` (admin) | 215–246 ms (2.8 s on the first build after restart) | unchanged | deferred (see below) |

Why the flashcards query was slow: each request parsed `data_json` (about 6 KB per row) for all
~11.7k rows, synchronously, on the event loop. The fix stores nothing new in the table:
`CREATE INDEX idx_flashcards_active_track ON flashcards(active, (CASE WHEN json_valid(data_json)
THEN json_extract(data_json,'$.track') END))`. The planner does not pick it for `IS NOT 'learn'`,
so the list reads `FROM flashcards INDEXED BY idx_flashcards_active_track`, and the non-bank
predicate is three index ranges (`IS NULL OR < 'learn' OR > 'learn'`). Equivalence with the old
predicate is covered by fixture tests (corrupt JSON, missing track, numeric track, inactive rows).

The browse cache key (`browsePool` signature) ran `COUNT/MAX/SUM` over the active rows, which read
the full 6 KB rows. `idx_flashcards_sig(active, revision, content_updated_at, updated_at, id)` is a
covering index for it (33.5 ms → 1.1 ms, same values).

Verified equal counts against a direct SQL count on the lab data: admin overview
`flashcards 31 / learnQuestions 11665`; teacher reports `cards 4`; admin reports `cards 31`.

## Tests

- New: `server/test/r96-flashcard-track-index.test.js` (6 tests), `server/test/r96-browse-facet-memo.test.js` (4 tests).
- Updated one source guard, `server/test/vp-stability.test.js` (it pinned the old literal predicate; it now pins the shared constant and the content.js selection).
- Server suite: 2157 passed, 15 skipped, 45 failed. The 45 are the same pre-existing `master-bank.test.js` failures as in R95 (not related to this round). The first full run showed one more failure, `vp-stability`, a source guard that pinned the old literal; it is fixed and passes (180 passed, 15 skipped).
- Client suite: 56 files, 278 tests passed (client code unchanged).
- `npm run perf:budget`: pass, `entryJsGzipKb` 25.0908 (unchanged, budget not raised).
- `npm run audit:gate`: pass, zero high or critical in production dependencies.

## Client measurements (lab, not changed in this round)

Playwright, mobile 390×844, CDP Slow-4G-like (150 ms RTT, 1.6 Mbps down), CPU 4× slower, cache disabled:

| Page | LCP (median of 3 or 1) | Notes |
|---|---|---|
| Landing, anonymous | 1,768 ms (1 run) | LCP element is the static hero H1 (`h1#landing-hero-title`) |
| Student home | ~468 ms | |
| Learner home | ~360 ms | total blocking time 562 ms in one run (main-thread work, see below) |
| Teacher home | ~416 ms | |

Lighthouse 12 (simulated throttling, landing, mobile, valid runs only): LCP 2,560 and 2,753 ms, TBT ~95 ms, CLS 0.032, score 94–95.

Findings that drive the next client work (not implemented here):
1. The main app stylesheet is 304 KB raw (about 59 KB gzipped), and it is loaded globally by `main.jsx`
   (`design-refresh.css` 161 KB and `styles.css` 153 KB). Lighthouse reports 92.8% unused on the landing
   page (44.8 KB). A per-route split would fix this, but the cascade order matters, so it needs a visual
   regression check first. Not done in this round.
2. Learner home: about 2.7 s of browser style/layout/paint and about 0.6 s of JavaScript in the profile.
   The entry chunk and React account for most of the script time.
3. The learner's `/api/flashcards` response is about 91 MB (see the open decision below).

## Open decisions (owner)

1. **Paywall leak on `GET /api/flashcards` for free learners.** The list returns all 11,605 learn-track
   bank cards to a learner who is not premium (`/api/learn/browse` reports `premiumRequired: true`, and
   the detail route `/api/learn/browse/:id` returns 402 for the same card). Of the 11,665 active learn-track
   cards, 2,683 are premium-flagged and 1,955 are off the free path. The fix changes what free learners see in the
   Flashcards page, so it needs a product decision: show only free-path cards, only the three teasers,
   or nothing. Not changed in this round.
2. **Learner payload size.** The learner Flashcards page downloads the whole bank (~91 MB) on every open,
   which takes ~2.5–3 s of server time. The fix needs a paged or session-sized list in the client, so it
   is a client change. Recommended for the next round together with decision 1.
3. **Admin learn-cards.** It serializes all 11.6k cards on every request, and the first build after a
   restart took 2.8 s. It is admin-only. A paged API is the fix. Deferred.

## Not done (explicitly)

- CSS per-route split (client change, needs visual regression).
- Field measurement (CrUX), or desktop Lighthouse runs. Only the mobile lab runs listed above were done.
- Release zip: not rebuilt in this round. The R95 zip is still the latest tracked artifact.
- Infrastructure items (CDN, load balancer, deploy near the database, background queue) from the earlier list stay deferred.

## Commands used

- `cd server && npx vitest run test/r96-*.test.js test/vp-stability.test.js test/flash*.test.js test/api.test.js`
- Lab server: `NODE_ENV=production FORCE_HTTPS=0 DISABLE_RATE_LIMIT=1 PORT=4030 DATA_DIR=/home/user/data-perf node src/index.js`
  (lab only, local HTTP; the env-check warnings for production flags are expected here)
- Measurement scripts (outside the repo, in `/home/user/qa`): `sweep.mjs`, `cwv-pw.mjs`, `cpuprof.mjs`, `longtasks.mjs`, `browse-prof.mjs`, `learner-leak-check.mjs`, `detail-check.mjs`.
