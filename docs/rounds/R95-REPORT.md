# R95 — virtual-patient honorific, whole-site bug hunt (skills-based)

Version: `2026.11.06-r95-bughunt`. Base: `4b97307` (R94). Release zip: `releases/MED-School-FINAL-2026-11-06-R95.zip` (see Verification).

## Method
- **Skills used.** `systematic-debugging` (root cause before any fix), `diagnosing-bugs` (a tight pass/fail loop first), `test-driven-development` (a failing test before each fix), `verification-before-completion` (evidence before any "fixed" claim). Sources: `obra/superpowers` and `mattpocock/skills`, cloned to `/tmp` and installed under `~/.claude/skills/`.
- **QA loop.** Headless Chromium (`@sparticuz/chromium` + `playwright-core`, in `/home/user/qa`, outside the repo). A walker signs in as each role and clicks each visible control once (text-deduplicated), recording page errors, console errors, API 4xx and 5xx. Production build, development seed database (`/home/user/data-r95`).
- **Limits.** One pass per control, so coverage is not exhaustive. Anonymous landing was not walked this round (the R94 Lighthouse results still stand for it). Lab only: no field data.

## Fixed in R95
1. **Virtual patient always says plain «دکتر»** (commit `5f51073`, the first half of the round). The name-based honorific logic is gone; `addressDoctor` only ever returns «دکتر». Tests in `server/test/r68-patient-persona.test.js` and `r68-bughunt.test.js` (the gender block was removed).
2. **Student context mismatch.** `App.jsx` set `contextType` from the route name but took `contextId` from `route.examId || route.classId`. A class card opens the exam route with a `classId` and no `examId`, so the client sent `contextType=exam&contextId=<class id>`, and the server refused it with 403. The classes and exams list pages sent `class`/`exam` with a null id, which gave another 403 on every visit. Fix: the type and id are derived together. An exam with an `examId` is `exam`; a class-based exam is `class`; everything else (including the list pages) is `general`. Regression guard: `client/src/student-tool-context.test.js`. Browser result: the student walk went from 2 console errors and 4 4xx to 0 and 0.
3. **Payment "not configured" returned 502.** A missing gateway configuration is a service state, not a bad upstream response. `gatewayErrorStatus()` in `server/src/lib/zarinpal.js` returns 503 for `gateway_not_configured` and `mock_disabled`, and 502 otherwise. Used at the three checkout call sites (`payments.js` ×2, `store.js`). No client code branches on the status, and the learner still sees the same Persian message. Test: `server/test/r95-payment-status.test.js`.
4. **heading-order on the admin and teacher home screens.** The overview title and the four dashboard card titles were `h4` directly under the page `h2`. They are now `h3` (`.section-title h3.overview-title` and `.card > h3.card-title`). The old look is preserved: I captured the computed styles before and after (font, size, weight, line-height, letter-spacing, colour, margins, padding, border, box size) and every property matched. A first attempt would have restyled five other `h3`s inside `.section-title`, so the new rule is scoped to the overview title only. Test: `client/src/heading-order.test.js`.

## Checked and not a bug
- **Learner 402** on `/api/learn/summaries` and `/api/learn/custom-test/options`. This is the premium gate. The page shows "بانک خلاصه، ویژهٔ پریمیوم است …" (checked in the browser).
- **Keyless past-exam cards** (31 active). The bug-hunt auto-scan reports them as "needs admin review". They are intentionally excluded from the learning path, from the custom-test pool (`learn.js` ~1515) and from the path curator. The client shows a "browse only" notice. The scan is informational. Still worth an admin look when convenient.
- **Virtual-patient "mock" replies** for two inputs («متوجه سؤالتان نشدم دکتر»). The app runs in mock mode until an AI key is saved (boot log: "mock until an API key is saved"). Expected.
- **Slow first request.** `GET /flashcards` took about 3.5 s on the first request after boot and about 127 ms in steady state (three repeated calls). It is a cold-start cost, not a per-request fault. See open items.
- **Teacher 403 re-check (open from R94).** The teacher walk now has 0 4xx and 0 console errors.

## Measured
| Check | Result |
|---|---|
| Student walk (final build) | 22 clicks, 1 skipped, 0 page errors, 0 console errors, 0 4xx, 0 5xx |
| Admin walk (after heading change) | 31 clicks, 2 skipped, 0 errors |
| Teacher walk (after heading change) | 20 clicks, 0 errors |
| Learner walk (after payment change) | 57 clicks, 7 skipped; 2× 402 (premium gate, intended), 2× 503 (gateway not configured in this sandbox; the UI shows a Persian message) |
| heading-order (home screens) | admin and teacher: no jumps (was one each); student: no jumps; anonymous: no jumps |
| Computed style, moved headings | no difference on any checked property |
| Student context pairs (API) | `class/1` → 200 (enrolled); `exam/1` (the old wrong pair) → 403 by server policy |

## Still open (not done in R95)
- Cold first request on `GET /flashcards` (about 3.5 s after boot). Candidate: warm the flashcard list at boot. Not changed here because it needs its own measurement.
- Cold mobile LCP of 3.8–4.6 s (from R94). Not re-measured: the Lighthouse toolchain was lost in a sandbox reset.
- Entry JS is at 25.091 KB against the 25.1 KB budget (R94: 25.076). The budget was **not** raised. I kept the context fix within it (see Verification). Any further entry growth needs an owner decision.
- `master-bank.test.js`: 45 failures, unchanged since R93/R94. The bank JSON files have no diff against HEAD, so these failures are pre-existing and not caused by R95. The expected hashes in the test appear to be stale. Needs an owner decision on whether to refresh the hashes or the test.
- The bug-hunt scan's 31 keyless cards: admin review.
- Anonymous landing was not walked in R95.

## Verification
- Client: `npx vitest run`: 56 files, 278 tests, all passed (final code). Before R95: 54 files, 270.
- Server: `npx vitest run`: 2146 passed, 15 skipped, 45 failed (all `master-bank.test.js`, pre-existing). Before R95: 2143 passed, same 45.
- Build: `npm run build` exit 0; service-worker cache stamped `medschool-2026.11.06-r95-bughunt`.
- Perf budget: passes. Entry JS 25.091 KB (limit 25.1); entry CSS 58.95 (limit 60); total CSS 65.27 (limit 66); learn 24.10 (limit 25); fonts 126.31 raw (limit 150).
- Audit gate (`npm run audit:gate`): 0 critical, 0 high, 0 moderate, 0 low in production deps.
- Lint: the repo has no lint script. The changed source was reviewed by hand (diff read in full); no unused imports in `App.jsx`.

## Sandbox notes
- The QA database is seeded development data, not production. The admin account still uses the public demo password, and the server warns about this at boot. Change it before the site is public.
- Payments run in mock mode here (`gateway_not_configured`), which is why the learner walk shows 503.
