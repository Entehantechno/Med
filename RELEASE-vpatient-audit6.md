# MED-School-94-vpatient-audit6 — direct-browser alternative

Date: 2026-09-18. Baseline: audit5 / `ec123d5`. Branch: `arena/01a0b428-med`.

## Purpose

Provide a practical alternative execution location: the user's own browser sends requests directly to official OpenRouter, rather than relying on the sandbox's failed outbound connection. **This route has not yet been confirmed from the user's network.** No live completion or bug-free certification is claimed.

Added self-contained diagnostic at `tools/openrouter-browser-check/index.html`, usage instructions, pinned browser-test dev dependencies, reproducible `test.mjs`, and Persian findings in `docs/vpatient-audit6-browser-route.md`. A static preview serves only the tool directory on port 4175.

The user must open the preview or downloaded HTML in their own browser, enter the key in its password field, retrieve the zero-price catalog and start the bounded test. The previously configured private-database key is deliberately not embedded or served by this public tool. No server-side key endpoint, third-party relay, external script/font, URL key, local/session storage or TLS bypass.

## Scope and safeguards

Two synthetic Persian cases, five turns each, using captured built-in patient prompts from the current engine with empty custom admin prompts. Reports contain the engine hash, requested/returned model identifiers, raw final answers and limited review flags. This is a prompt-only diagnostic: application postprocessing, scoring, teaching, authorization and full UI are not executed. It does not replace application E2E or clinician review.

Only explicit zero-priced text models; empty prices, router and nonzero auxiliary prices excluded conservatively. Ten attempts maximum, 3.5-second spacing, 45-second timeout, 220 output tokens, zero prompt/completion price caps, provider data collection denied, redirects forbidden, no automatic retry. Stop/Clear cancels fetch/pacing. Output is text-only; reports redact the entered key and long key-like patterns and omit raw provider errors/headers. Synthetic data only; report review still recommended before sharing.

## Verification

The shipped browser test ran successfully in real Chromium with mocked network responses. Ten assertion groups: free selection, no-key behavior, budgets/provider policy, injection-safe rendering and key redaction, no browser storage, JSON download, HTTP 401 stop, network stop, invalid output stop, and clear-key cancellation. These are not ten new backend Vitest tests and are not live-model evidence.

An additional unmocked public-catalog probe through the new tool from the sandbox browser still failed Network/CORS, with no credential supplied and no completion sent. The user's browser route remains to be tried by the user; no remote control of their browser is available here.

## Other routes checked

TCP connected to official OpenRouter but TLS closed after ClientHello; GitHub still returned HTTP 200. The official API documentation continues to show `https://openrouter.ai/api/v1/chat/completions`. Bare/www hosts failed without credentials; `api.openrouter.ai` did not resolve. No unsupported alternate credential destination used.

GitHub Actions was considered as an independent runner, but the integration returned HTTP 403 for secure Actions secret storage/public-key access and Actions permission inspection. No secret, workflow or Actions run was created. The public repository must never receive the key in code or public workflow inputs.

## Preservation and artifact

All audit5 archive entries are byte-identical, including application code, tests, production frontend, release environment, 54 banks and deferred queue. Five files added only. Main backend/client suites were not rerun because their code is unchanged. Previously documented clinical and grading issues remain open.

Archive CRC and unique entries verified; no dependency/cache directories, private test data/databases, logs or long generic `sk-` key patterns included. Pattern scanning is not universal secret certification.

`MED-School-94-vpatient-audit6.zip`: **926 entries; 18,360,631 bytes**.
SHA-256: `8d1171d111497dee1ccb457b36f3dd6c15bbcad1e5a368c02113daa82abc6d75`.

Previous audit5 ZIP removed after validation. This release adds a diagnostic tool, not a claim that all virtual-patient bugs are fixed.
