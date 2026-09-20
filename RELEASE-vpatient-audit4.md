# MED-School-94-vpatient-audit4 — patient-role guard

Date: 2026-09-18. Baseline: audit3 / `5991ddb`. Branch: `arena/01a0b428-med`.

## User-reported problem

The patient replied to a greeting as a helpful assistant ("What can I do for you?"). We reproduced acceptance of that inappropriate output with a synthetic provider response, not with a live model. The old local greeting response was already appropriate; the separate local bug was discarding a clinical question that followed a greeting.

## Changes

- Fixed patient-role instructions supplement even empty admin prompts, distinguish patient from assistant/clinician/receptionist, restrict replies to chart facts and clarify simple versus question-bearing greetings.
- Removed generic chest/stomach symptom exemplars from the patient prompt to reduce unintended case priming.
- A narrow opening-phrase guard rejects obvious assistant-role output in Persian/English. A rejected output produces explicit `source: mock` and a fixed role-violation error; no extra completion request is sent. `throwOnError` preserves the failure for connection diagnostics.
- Local fallback strips opening salutations without discarding the clinical question, and recognizes standalone English good morning.

This guard is not a comprehensive semantic classifier. Unknown paraphrases, quoted phrases, indirect role drift, broad conversational naturalness and real-model compliance still need live evaluation. No all-bugs-fixed claim.

## Evidence

- New `vp-patient-role.test.js`: 17 tests; before changes, 13 failed and 4 passed; after changes, all 17 passed. Focused three-file suite: 56 passed.
- Final complete backend suite: **1189 passed, 1 failed, 1190 total**, 34 files, 156.98 seconds. The unchanged existing bank distractor lint is the only failure. No tests removed or skipped to hide it.
- Real Chromium student-path UI run on restarted application: login, class, case and three submitted messages. All responses HTTP 200, **source mock**, not OpenRouter. The exact user greeting returned the patient greeting; onset and medication questions prefixed with hello returned the chart answers.
- Screenshot: `docs/evidence/vpatient-browser-role.png`; Persian report: `docs/vpatient-audit4-patient-role.md`.
- Client source/build unchanged; no client suite/build rerun this round. Broader browser/mobile/final-evaluation coverage not claimed.

## OpenRouter and authorization

The user authorized using their own key. The key value was unavailable in this session: `OPENROUTER_API_KEY` absent and environment-file AI keys empty. Permission is acknowledged; a different removed legacy seed credential was not assumed to be that OpenRouter key or restored.

Python public-catalog retry failed TLS EOF. Four unauthenticated Node public-catalog attempts spaced 15 seconds apart all failed `ECONNRESET`. No live OpenRouter completion, no model ranking, no TLS bypass or third-party credential relay. Live validation requires both a reachable HTTPS endpoint and the actual key supplied through secure environment/admin configuration rather than chat.

## Remaining risks and preservation

Previously documented missing-test/exam normal defaults, language-sensitive keyword scoring and broader clinical/evidence issues remain open. No question banks, keys, rubric weights, 81-record deferral queue, publication configuration or frontend code were changed.

Independent ZIP CRC/uniqueness/content validation: all existing archive entries byte-identical except `server/src/lib/ai-engine.js`; three new evidence/report/test files added. Thus all 54 bank payloads, round50 queue and preservation fixture remain unchanged. Shipped `.env` equals `.env.ready`, not local runtime configuration. Runtime databases, logs, browser dependencies and cache directories excluded; no generic long `sk-` key patterns found. Pattern scanning is not universal secret certification.

## Artifact

`MED-School-94-vpatient-audit4.zip`: **919 entries; 18,344,029 bytes**.
SHA-256: `2f6a9d4bdae19cc683a0c5811ff990315e882fe0e6a3085ea1ce602813c0f00e`.

Previous audit3 ZIP removed after independent validation. Local preview remains an isolated seeded test instance, not a production deployment.
