# MED-School-94-vpatient-audit1 — QA candidate

Date: 2026-09-18. Baseline: round50, commit `5ed1b7a`.
Branch: `arena/01a0b428-med`.

## Scope

Virtual-patient audit stage 1, not a declaration that every stage is bug-free or clinically validated. Question enrichment is paused. No bank changes, deployment, production database changes or schema migration.

Changes include strict complete/unique scoring contracts, rejection of string booleans, explicit scoring fallback, private examiner references separated from patient context, final-answer-only response handling, sanitized provider errors, and JSON-format compatibility retries limited to 400/422 responses. Scoring and teaching provenance/fallback metadata are independent and persisted. Teaching uses refreshed, role-scoped assessment results and the role's score, with targeted deterministic exercises. The frontend safely renders supported lesson Markdown without interpreting HTML or model links/images, and displays separate evaluation/teaching provenance. Missing bilingual hub labels were added.

Tests include 19 model-contract regressions, three benchmark-policy checks and four new UI checks. Existing incomplete-encounter grading fixtures and the fake provider were corrected to supply meaningful evidence and schema-correct responses; grading thresholds were not lowered.

## Validation

- Final stable backend run: **1149 passed, 1 failed, 1150 total**, 31 files, 155.86 seconds.
- The remaining failure is the existing bank distractor lint, also reproduced on the untouched baseline. It flags 28 strings, not 28 proven medically incorrect questions. Neither bank contents nor that test were changed to hide the failure.
- Client: **21 passed**, seven files. Production build and compressed assets successful.
- Playwright Chromium download failed. **No real-browser, visual or mobile E2E execution**; jsdom component tests are not browser E2E.
- Independent archive checks: CRC integrity, unique entries, required new source/tests/docs present, no non-dist baseline paths removed, all **54 bank payloads byte-identical**, round50 cumulative deferral queue and preservation fixture byte-identical.
- Shipped `.env` equals `.env.ready` and the baseline release `.env`, not the locally mutated test configuration.
- Archive excludes dependencies, runtime databases, scratch benchmark/test data and logs. No OpenRouter key matching the `sk-or-v1-` plus 64-hex pattern found in archive content; this is a pattern scan, not a universal secret certification.

## OpenRouter: no live ranking

Direct catalog access failed at connection/TLS from this workspace. **Zero authenticated completions were executed.** Fifteen text-capable zero-price candidates observed on the public collection page are documented, but that page is usage-ranked and not exhaustive. No model is claimed to have won a medical-quality benchmark.

Included harness dynamically filters numeric free prices and text capability, uses synthetic cases only, restricts provider pricing/data collection, blocks redirects, and requires explicit `--live` plus a securely configured replacement key. Its default 20-call budget is a smoke budget, not sufficient to test every model. A working connection, secure key, larger quota, repeated runs and blinded clinical review remain necessary. An exposed chat key must be revoked, not reused or copied into source.

## Known limitations

Unrecorded findings may still default to normal/negative; recorded tests are not reliable ground truth for clinical indication. Keyword scoring can confuse mention/negation with performed actions. Server-authoritative encounter evidence, heterogeneous rubric cases, structured management/dose/contraindication validation, multi-step retry edge cases, clinical review, real model safety/adherence and browser testing remain open. Prompt restrictions and strict JSON validation do not establish medical accuracy or fairness.

## Included guidance

- `docs/vpatient-audit1-review.md`: Persian stage matrix, changes, test results and prioritized unresolved risks.
- `docs/openrouter-vpatient-benchmark.md`: observed candidates, secure harness instructions and proposed clinical evaluation rubric.
- `tools/benchmark-vpatient-openrouter.mjs`: reproducible opt-in live benchmark harness.

Question continuation remains part25 Q201–220 plus part26 Q1–180. All 81 deferred records remain unchanged and reserved for final review.

## Artifact

`MED-School-94-vpatient-audit1.zip`: **910 entries; 17,742,783 bytes**.

SHA-256: `20b6d134d9be1089cc8e2ffebb8fa16bd2214b26477f08708ed1c1f4d7a11151`.

This replaces the previous round50 ZIP after independent validation. Previous release notes are retained. This is a QA candidate with one known failing regression and incomplete clinical/live/browser validation, not an unconditional production approval.
