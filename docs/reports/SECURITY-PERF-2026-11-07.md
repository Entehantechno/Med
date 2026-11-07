# Security and performance pass — 2026-11-07

Scope: the items in the user's request, each researched first, then applied where the
code did not already cover it. Everything marked **verified** was checked against the
running server (local, fresh seed) or by a test; everything marked **deferred** is not
done and is listed with the reason.

## Security

| Item | Status | What was done / found |
|---|---|---|
| CSP | Verified (existing) + gap noted | Live header: `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `script-src 'self'` with no `unsafe-inline` for scripts. Gap: `script-src` still allowlists `accounts.google.com`, and there is no nonce/hash-based strict CSP. Deferred (needs a per-request nonce injected into the cached `index.html`). |
| Stored XSS | Existing | Rich text goes through `sanitizeHtml()`; JSON-LD escaping test in `security-hardening.test.js` (pre-existing failure on base, see tests). |
| CSRF | Verified (existing) | Origin + `Sec-Fetch-Site` check in `app.js`. Live: cross-site cookie-only POST → **403**; same-origin and Bearer requests reach the handler. No change needed. |
| CORS | Reviewed (existing) | Allowlist from `CORS_ORIGIN`, no wildcard. Not re-tested live in this pass. |
| Cookie flags | Reviewed (existing) | `medlab_token` is httpOnly, SameSite=Lax, Secure on HTTPS. |
| `X-Content-Type-Options` | Verified | `nosniff` on pages and on `/uploads`. |
| SVG uploads | Verified (existing) | `/uploads/*.svg` served as `image/svg+xml` with `default-src 'none'; script-src 'none'` and `nosniff`, so an SVG cannot run script when opened directly. Upload-side sanitisation not added (deferred; delivery sandbox is the control). |
| API key in localStorage | Checked | No AI API key found in localStorage. The bearer token `medlab_token` is still in localStorage; moving it to cookie-only auth is a client auth refactor and is deferred. |
| Raw IP storage | **Done** | New `lib/ip-privacy.js`: HMAC-SHA256 digest (keyed by `IP_HASH_SECRET`, random per process if unset). Applied to `security_events`, `audit_log` (which previously stored the spoofable `X-Forwarded-For` value), and rate-limit keys. Verified live: no raw IPv4 in `security_events` or `audit_log`. |
| Login alerts | **Done** | `lib/login-anomaly.js`: each failed login is recorded (account as a 16-hex digest, client as the IP digest). Alert once per threshold crossing: 5 failures on one account in 15 min, or 20 from one client. Verified live: one `login_anomaly` row and a server warning, with no username or raw IP. |
| Logs / encryption of sensitive data | Partly | Reviewed `console.*` calls: no tokens or passwords in normal request logs. `reset-admin-password.js` prints the new password to the operator's console by design. Encryption of stored logs is deferred. |
| Idempotent exam finish | **Done** | `POST /exam/evaluate` accepts `Idempotency-Key` (`lib/idempotency.js`, table `idempotency_keys`). Same key + same body → stored response replayed (`Idempotent-Replayed: true`); same key + different body → 422; concurrent duplicate → 409 `idempotency_in_progress` (retryable, which the client already retries); 5xx not stored. The client sends one key per finish and re-sends it on every retry. Verified live (replay) and by 11 unit/integration tests. |

## Performance

| Item | Status | Result |
|---|---|---|
| Brotli / compression | Verified | `br` served for the main bundle: 21.5 KB vs 76.7 KB raw. Build writes 198 pre-compressed sidecars. |
| HTTP/2 / HTTP/3 | Verified in config | The Node server speaks HTTP/1.1 only. Production runs behind Caddy (`deploy/Caddyfile`), which has no protocol restriction, so Caddy's default HTTP/2 and HTTP/3 apply. Not tested from the sandbox. |
| Load test (100 concurrent users) | **Done** | `scripts/load-test.mjs`, 100 VUs, 20 s ramp, 60 s hold, 1–3 s think time, 3,656 requests on authenticated reads. **p95 3 ms, p99 6 ms, 0 errors, 0 × 429.** Report: `docs/reports/load-test-2026-11-07.json`. Caveat: local server, light read endpoints only. Exam evaluation and AI paths were not load-tested. |
| Concurrent logins | **Done** | 20 distinct accounts logged in at once: all 200. Latency **p50 979 ms, p95 1,688 ms**. Login is CPU-bound (password hashing); the next step is to move hashing off the event loop or use a worker pool. Report: `docs/reports/login-burst-2026-11-07.json`. |
| Per-account API limits | Finding | Signed-in traffic is limited per account (1,200 per 15 min). A single account driving 50 virtual users exceeded it within ~85 s, which is the expected behaviour. The per-IP login budget (96 per 15 min) can throttle a whole campus NAT during a login surge. Not changed; recommend reviewing for exam-start scenarios. |
| Question-by-question loading, offline answering, local sync | Deferred | Needs a design pass (local store, conflict rules, server sync endpoint). |
| Processing-status display, separate per-user queues, fast submit | Deferred | Needs a job queue. Exam grading already runs in a durable transaction with a completion lock. |
| Separate API paths under 100 concurrent users | Partly | The 100-user test shows the read path is well within budget. Splitting heavy AI paths is deferred. |

## Tests

- Server, full suite (`npx vitest run`): 102 of 105 files pass. The three failing files are
  `master-bank.test.js` (45 tests) and one JSON-LD test in `security-hardening.test.js`.
  **All of them fail identically on the base commit** (checked in a clean worktree), so they are not caused by this pass.
  `api.test.js` fails only when run in parallel with other files that reseed the shared database; run alone it passes 542 of 542.
- New server tests: `server/test/ip-login-idempotency.test.js`, 11 of 11 pass.
- Client, full suite: 311 of 311 pass (includes `idempotency-key.test.js`).
  This required one fix: `r107.css` used a raw `color:#fff` that the R100 guard forbids; it now uses `var(--on-solid,#fff)`.
- Client build: OK.

## Screenshots

- `screenshots/r106/` (new): 12 captures of the R106 build (commit `91bbcb0`), taken from the same seeded data.
- `screenshots/r107/` (regenerated): 12 captures of the current build.
- Method: `/tmp/uilab/capture.mjs` (Playwright, headless Chromium). The app's router is state-based, so the script walks the UI: home → classes → class detail → case → flashcards.
- Known content gap, not fixed: the tissue-identification flashcard has no image, so the card shows its missing-image notice. Flagged to the content owner; no image was invented.
