# MED-School-94-vpatient-audit3 — browser evidence, no live-model claim

Date: 2026-09-18. Baseline: audit2 / `9432089`. Branch: `arena/01a0b428-med`.

This diagnostic-only release adds a Persian connectivity report and a real local Chromium screenshot. Every audit2 archive file remains byte-identical, including application code, environment template, built frontend, tests, all 54 question-bank payloads and the 81-item deferred queue.

## Progress

The earlier browser-install obstacle was resolved using `playwright-core` and `@sparticuz/chromium` from the reachable npm registry. Missing NSPR/NSS libraries came from the same package's bundled library archive. No arbitrary binary mirror or TLS-verification bypass was used. Browser dependencies and test data are excluded from the release.

A real desktop browser logged in as a seeded synthetic student, opened their class, started the chest-pain patient and sent three messages through the UI. Each actual API response was HTTP 200 with **`source: mock`**. Screenshot: `docs/evidence/vpatient-browser-local.png`. Report: `docs/vpatient-audit3-connectivity.md`.

This is a student-path browser smoke test, not full browser E2E, mobile validation, final assessment verification or a live OpenRouter conversation. Screenshot animations were finished using Playwright's screenshot option; the image was not generated/reconstructed.

## Remaining connection blocker

Outbound internet is not wholly unavailable: curl reached GitHub and npm with HTTP 200. OpenRouter failed with curl TLS errors and Chromium `ERR_CONNECTION_CLOSED`; an example.com HTTPS control also failed. Chromium additionally reported an untrusted certificate for GitHub, and verification was not disabled. These observations do not establish the exact infrastructure cause.

`OPENROUTER_API_KEY` was absent. The old exposed provider key was not restored. No credentials were relayed through third parties, and no live OpenRouter completion was obtained. A working HTTPS path to `openrouter.ai:443` and a securely supplied replacement key are still required. The referenced earlier chat's live-test details are unavailable here and are neither independently confirmed nor denied.

## Validation and artifact

Archive CRC and unique entries verified; all old entries byte-identical and only two report/evidence entries added. No runtime data, logs, browser packages or generic long `sk-` key patterns in archive contents. Full regression suites were not rerun because code/tests are unchanged. The last backend/client counts remain audit2 results (1172 backend passes, one known bank-lint failure, 21 client passes), not new runs.

Known clinical unknown-data policy, language-sensitive keyword grading and other audit2 limitations remain unresolved. No all-bugs-fixed claim.

`MED-School-94-vpatient-audit3.zip`: **916 entries; 18,050,744 bytes**.
SHA-256: `2045bcdffa9e19149bf35990c770667a6ffb29d6e0ddc7bfe0f3927151e1a0d5`.

The old audit2 ZIP is removed after validation. A local preview runs on port 4000 with an isolated synthetic database, not a production deployment.
