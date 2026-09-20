# MED-School-94-vpatient-audit5 — authorized-key connection attempt

2026-09-18. Baseline: audit4 / `00f825b`. Branch: `arena/01a0b428-med`.

The user explicitly authorized the supplied OpenRouter key. It was configured verbatim in a private copy of the synthetic database, not the production site or public demo preview. The public preview was stopped to avoid exposing live credentials through demo administrator accounts. The transient key-transfer file was deleted after reading; the private database remains in the excluded test-data area with restricted permissions. No credential is included in this report, source or ZIP.

Three actual authorized requests to OpenRouter's `/api/v1/key` all failed with `ECONNRESET` before any HTTP response. Two actual application patient-reply requests then attempted OpenRouter completions using the configured key. Both failed at the provider connection and fell back locally: HTTP 200 from the application, `source: mock`, `providerFailed: true`. **Zero live completions.** Key validity could not be established or rejected. Lack of a key is no longer the blocker for this attempt; network connectivity remains unresolved.

The completion transport was constrained to the official endpoint, redirects blocked, free-only pricing, provider data collection denied and 160 output tokens. Only synthetic case data was used. No secret relay or TLS-verification bypass. Model selection was the free router, not a benchmark or ranking of individual models.

Added: `docs/vpatient-audit5-connection.md` and credential-free `docs/vpatient-audit5-connection.json`. All prior archive entries are byte-identical, including all code, tests, 54 bank payloads, deferred queue, release configuration and built client. Full tests were not rerun this round; previous QA limitations remain.

Archive integrity and unique entries verified; excluded private test data absent; no long generic `sk-` key patterns in archive contents. Pattern scanning is not universal secret certification.

Artifact: `MED-School-94-vpatient-audit5.zip`, **921 entries; 18,346,349 bytes**.
SHA-256: `8b3098fddb4a9b3575e6d13acc3d99ca5302698ffccc83996f4b1a1cf8c8e791`.

Previous audit4 ZIP removed after validation. This is a diagnostic update, not an assertion of successful OpenRouter connectivity or completion of the clinical audit.
