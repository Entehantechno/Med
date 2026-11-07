# R93 — bug hunt on the R92 baseline

Version: `2026.11.06-r93-bug-hunt`. Base: `3bf335d` (R92). Release zip: `releases/MED-School-FINAL-2026-11-06-R93.zip` (1049 files, 29.9 MB; `check-release-zip.mjs` passed).

## Method
- **Auth coverage (runtime).** Every `/api` route (626) was called with no token. 598 returned 401. The rest are public by design (site content, store catalogue, health, auth entry points, telemetry), except the two payment callbacks, which verify with the gateway (see below).
- **Role matrix (runtime).** Every route was called as a student, a learner and a teacher, with `{}` bodies on mutating calls and auth/destructive paths skipped. Each 2xx response was reviewed by hand.
- **Response leak scan (runtime).** GET responses for student and learner were searched for answer-key and diagnosis fields.
- **Static scans.** Every `${}` SQL interpolation was traced to a constant or a whitelist. `res.redirect`, `path.join`, `eval`, `dangerouslySetInnerHTML`, `...req.body` and external `href`s were grepped.
- **Lint.** ESLint 9 with `@eslint/js` recommended plus `react-hooks`. Client: 0 rules-of-hooks errors after the fix. Server: no `no-undef`.
- **Index plans.** `EXPLAIN QUERY PLAN` on a copy with 50,000 synthetic users, 200,000 `class_members` rows and 50,025 `league_members` rows, after `ANALYZE`.
- **Skills.** `anthropics/skills` was cloned again. `webapp-testing` (recon, then action, with `domcontentloaded` and element waits) and `frontend-design` (focus and reduced-motion floor) were re-read. No design change was made.

## Fixed (confirmed bugs)
1. **Student read of learn-track case answer keys (security).** `GET /api/site-bank/cases` returned the full case to students and learners: diagnosis, objectives, labs, imaging results and images. The detail route already hid these. The list now applies the same `studentSafeCase` view. Reproduced before the fix. Test: `r93-hardening` "gives a student the same reduced view…".
2. **Promotion requests readable by students.** `GET /api/site-bank/promotion-requests` returned 200 to a student, with rows for the student's university. It now requires the teacher or admin role. Test: "refuses a student".
3. **Practice XP farming and unchecked cards.** `POST /api/learn/practice/answer` trusted the client's `correct` flag. It accepted any card id, including retired and missing ones (200), and each request awarded XP and review-quest progress.
   - Single-choice cards are now graded from the stored option, using the `sel` index. Missing or out-of-range `sel` counts as wrong.
   - Other types (true/false, fill, match, order, compare) still use the client judgement.
   - A missing or inactive card returns 404.
   - XP and review-quest progress count once per card per learner per Tehran day.
   - Behaviour change: the review quest now counts correct first answers per card per day, instead of every answer.
   - `api.test.js` "grading a practice answer…" sent `correct:true` without a selection. It now sends the correct option index, because the real client always sends `sel`.
4. **Hook-order crash in the custom test runner.** In `CustomTest.jsx`, `Runner` had `if (!card) return null;` above a `useEffect`. When the question list became empty or shorter, React threw "Rendered fewer hooks than expected". The early return now sits after the hook. Test `CustomTest.runner.test.jsx` fails on the old code with that exact error and passes on the new code.
5. **Mindmap history actor.** Every teacher save or delete was recorded as `admin`. Also, `upsertMindmap` took `actor` from the request body, so the history could be forged. The actor is now `role:id` from the signed-in user. Test: "records the teacher who saves and deletes…".
6. **Missing `league_members(user_id)` index.** A user-keyed lookup (account delete) scanned the table. At 50k users, 2,000 lookups took 63 ms with the scan and 15 ms with `idx_league_members_user`. Added in `db.js`.
7. **`Glyph.jsx` duplicate key `🔍`** (lint `no-dupe-keys`, console warning). Removed the duplicate.

Before/after for the new `r93-hardening` file on the old code: 7 of 9 tests fail. The 2 that pass are controls (admin still sees the full case; teacher and admin still reach the promotion list and the mindmap save).

## Checked and not a bug
- **SQL interpolation.** All `${}` values are constants or whitelisted: `academicKind`, the `classes|exams` group guard, the sort map in `admin.js`, `CLASS_USED_BY_ACTIVE_EXAM`, retention table constants, `DX_COLS`, and `order` in `browseCommunity` (fixed strings).
- **Mutating routes without auth.** None found in the runtime sweep.
- **Teacher access to `/api/admin/users`.** Scoped to the teacher's own university and to students and teachers only.
- **Teacher ownership of exams.** `DELETE`/`PUT` on exams checks `owner_id` for teachers.
- **Class detail for students.** Membership and active-class checks are in place.
- **Payment callbacks.** `GET /api/pay/callback` and `/api/store/callback` verify with the gateway server-side in real mode. Mock mode is off in production unless `ALLOW_MOCK_PAY=1`.
- **Index `class_members(user_id)`.** The `SCAN` seen in R92 came from an empty table with stale stats. With data and `ANALYZE` (run at boot via `PRAGMA optimize`), the planner uses `idx_class_members_user` (15 ms per 2,000 lookups). No change.

## Found, not changed (decision or follow-up needed)
- **A. Placement and jump-ahead answer keys in GET responses.** `GET /api/learn/placement/start`, `POST /placement/next` and `GET /api/learn/jump/:topicId` include each option's `correct` and `why`. Both quizzes show immediate client-side feedback. A learner can read the jump-ahead answers from the network before a pass that unlocks topics. The fix needs a product decision: a per-answer server check, plus hiding `why` in these quizzes. Lesson and practice flows also ship `correct` by design.
- **B. Teachers can edit and delete the shared mindmap bank.** The bank is global and not per university. This follows the route guards (`admin`, `teacher`). Confirm that this is intended.
- **C. Mock payment gateway.** The mock authority is `MOCK` + time + 6 random base-36 characters, so it is guessable. Mock checkout is off in production (`mockAllowed`) unless `ALLOW_MOCK_PAY=1`. Make sure the production env has `ZARINPAL_MERCHANT_ID`.
- **D. Dead code.** About 140 unused variables and helpers (for example `hintText`/`hintImage` in `Flashcards.jsx`, `logoutAll` in `Profile.jsx`, `exhausted` in `StudentExams.jsx`). Not removed. Each one should be checked for a missing UI first.
- **E. `suspiciousInput` in `app.js`.** The filter blocks bodies with patterns such as `;select` or `/* */`. It may reject legitimate medical text. Not tested in this round.
- **F. Lint backlog (not reviewed one by one).** 83 `react-hooks/exhaustive-deps` warnings (one, in `CustomTest.jsx`, can be a stale closure over `finish`/`submit`), about 84 empty `catch` blocks (mostly best-effort), and `no-useless-escape` and `no-control-regex` items.
- **G. Open decisions from R92** (unchanged): hold scope for `security_events` and `rum_vitals`; deleting `tutor_chats` with the account (current choice: yes); AI word-by-word streaming (not answered).
- **H. Master-bank tests.** 45 failures remain. They check editorial text (`options_why_fa` prefixes) and are not code bugs. They were already present in R90 and R92.

## Verification
- Server `vitest` (full run, final): 2148 passed / 45 failed / 15 skipped (2208). The 45 failures are all `master-bank.test.js` editorial-text checks, the same set as R90 and R92 (baseline 2130 / 45 / 15 before this round).
- `api.test.js` and `security-hardening.test.js`: 569 passed. An earlier full run failed 9 SEO tests in these files only because `client/dist` was missing after the re-clone; they pass after `npm run build`.
- Client `vitest run`: 53 files, 264 tests passed.
- Client `npm run build`: exit 0. Service-worker stamp `medschool-2026.11.06-r93-bug-hunt-academic-private-v1`.
- `npm run perf:budget`: pass. Entry JS 25.00 KB (limit 25.1), entry CSS 58.89 KB (60), total CSS 65.21 KB (66), learn 24.10 KB (25), fonts 126.3 KB raw (150).
- `pack-host-zip.mjs` and `check-release-zip.mjs`: pass. The zip's `.env` is the bundled template (`.env.ready`), not the local one.

## Not re-run in this round
- **Browser checks.** The Playwright harness was lost in the sandbox re-clone. CustomTest and DrTutor are covered by component tests. Route behaviour is covered by the API tests and the runtime sweeps above.
- **Penetration testing.** This round used local runtime sweeps and static checks only. Nothing was tested against production.

## Sandbox notes
- The copy DB `/home/user/data-r93` was seeded with `NODE_ENV=development`. Two test rows were added there (a learn-track case and a synthetic exam deletion), not in the repo.
- The local root `.env` (gitignored) was created by `seed.js`.
