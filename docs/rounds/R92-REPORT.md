# R92 — bug review of the whole site

Version: `2026.11.06-r92-bug-review`. Base: `e159e56` (R91).

Scope: a bounded bug hunt, not a redesign. Each finding below was reproduced first, then fixed and covered by a test.

## Method
- **Static check, client and server.** ESLint 9 with `no-undef`, `no-dupe-keys`, `no-unreachable`, `no-redeclare`, `no-const-assign` and TDZ rules (kept outside the repo, `/tmp/lint`). Client: no undefined identifiers. Server: no undefined identifiers. Remaining hits are harmless (functions called after module init; a duplicate emoji key that maps to the same icon).
- **Route sweep, GET.** 288 GET routes × 3 roles (admin, teacher, student) against the preview build. Zero 5xx.
- **Route sweep, write.** 299 POST/PUT/PATCH/DELETE routes × 3 roles × 3 bodies (empty, `{}`, and a malformed body with string ids, wrong types and `confirm: true`), run against a copy of the dev database on a separate port. 2,691 calls. The only 5xx-class results were expected configuration states (`google not configured` 503, `gateway_not_configured` 502) and one long admin curation job that exceeded the 15 s probe timeout.
- **Targeted reading** of retention, inspection holds, account deletion, Dr Tutor, virtual-patient chat and the admin hold UI.
- **Browser check** of the admin per-student inspection request: open, see it listed, close after confirm, gone from the list. No page errors and no failed API calls.

## Bugs found and fixed

| # | Where | Bug | Effect | Fix |
|---|---|---|---|---|
| 1 | `routes/admin.js` `DELETE /users/:id` | The single-delete path did not remove roster rows. The bulk path did. | A deleted student stayed in `class_members` (a ghost roster row, counted in class sizes and purge counts). | One helper `deleteAccountRows()` in a transaction, used by both routes. |
| 2 | same | Account deletion never removed the account's personal Dr Tutor chat (`tutor_chats`). | Private chat text stayed after the account was gone. | The helper now deletes the personal tutor chat. Attempts and VP encounters are kept on purpose (graded records under the retention settings). |
| 3 | `routes/tutor.js` | Any `contextType` string was accepted and stored as-is. A general chat kept whatever `contextId` was sent. | Junk rows and the same conversation filed under two keys. | Only `general`, `class`, `exam` are accepted (400 `bad_context` otherwise). A general chat always stores `context_id = NULL`. Applied to send, status and history. |
| 4 | `routes/tutor.js` `PUT /context-settings` | The list used `COALESCE(university_id,1)` but the teacher check compared the raw value. | A teacher could see a class and get `wrong_university` when saving it (legacy rows with no university). | The check uses the same COALESCE. |
| 5 | `routes/tutor.js`, `routes/exam.js` `/patient-reply` | Only the global API limiter applied: 1,200 requests per account per 15 min, which lets one account drive about 80 paid model calls a minute. | Cost exposure at 50,000 users (a loop or a script). | `lib/ai-budget.js`: a per-account window for model calls only (Dr Tutor 30 per 10 min, VP 60 per 10 min; env `AI_TUTOR_TURNS_PER_10MIN`, `AI_VP_TURNS_PER_10MIN`). Mock replies and refused requests do not count. Over budget: 429 `ai_rate_limited` with a clear message. Test switch `DISABLE_RATE_LIMIT=1` turns it off, like the other limiters. |
| 6 | `client/src/components/DrTutorChat.jsx` | Every failed send showed "Not sent. Please try again.", including a disabled tutor, a per-account limit, and a context the student is not enrolled in. | Misleading advice; a retry cannot help in those cases. | The message now depends on the server code (`ai_rate_limited`, `tutor_disabled`, `bad_context`, enrolment refusals, network). |

## Checked and not a bug
- Admin hold routes exist and are wired: `GET/POST /api/admin/retention/student-holds`, `POST …/:id/close` (confirm required). The admin UI works end to end in the browser.
- `DELETE /users/:id` and `POST /users/bulk-delete` both check the open inspection request (409 / `blocked: inspection_hold`).
- `tutor_chats` purge is covered: `TABLE_RULE` uses `heldBy: user_id`, so an open request protects the chat rows.
- `security_events` and `rum_vitals` carry an optional `user_id`. They are operational logs, not student records, so they are not held. This is a stated scope boundary, not a gap.
- Password hashing is argon2 on workers; bcrypt is only the fallback.
- No `innerHTML` or `dangerouslySetInnerHTML` path without `sanitizeHtml`.
- Express 4 with `express-async-errors`: async route errors reach the error handler.

## Open (needs a decision or an editor, not fixed here)
- **Master-bank suite:** 45 failing tests, all in `test/master-bank.test.js`. They check exact editorial text (for example, the correct option's `options_why_fa` must start with a fixed phrase). Changing medical wording is an editorial decision, so it is not changed here. This matches R88–R91.
- **Account deletion keeps attempts and VP encounters.** They are graded records, and the retention settings govern them. If the owner wants a full erasure on request, that is a separate policy decision.
- **Dormant orphans:** attempts of a deleted account keep their `user_id`. Reports show them as unknown. No foreign keys exist in the schema (existing design).
- **Live board** polls every 5 s per open teacher screen. It is by design, and it is hidden when the tab is hidden. At large class sizes it is the next place to add a short server cache.
- Carried over from R89–R91: QB-04877 and QB-04880 editorial text; `universityOnlyCases` opt-in; reveal of the generic-specialty topic; admin still on the public demo password; infrastructure items (CDN, Redis, OpenTelemetry, load balancing, background queue).

## Verification
- Server suite: 2139 passed, 45 failed (all `master-bank`), 15 skipped. New file `server/test/r92-hardening.test.js` (9 tests) passes.
- Client suite: 52 files, 263 passed (2 new Dr Tutor error-message tests).
- `npm run build`: exit 0. `npm run perf:budget`: pass (entry JS 24.99 KB, entry CSS 58.89, total CSS 65.21, learn 24.12, fonts 126.3).
- Browser: admin per-student inspection request open/close flow passes at 1280 px.
